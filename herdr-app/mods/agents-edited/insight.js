// What the agents list tells about each agent besides its state: what it says it is
// doing, where its checkout is (worktree, branch, uncommitted diff), how full its
// context is, and whether another working agent edits the same checkout.

import { div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, hc, home, readTextFile, watchFolder, setShared, shared, window } from "herdr";
import { OpenCodeContext } from "./opencode.js";

// Every local pane's git, by folder, for the pane headers too.
export const GIT_KEY = "git.cwd";
const GIT_FALLBACK_MS = 60000;
const CTX_RELOAD_MS = 30000;

// The same avatar colors the spaces list draws (spaces/main.js MARK).
const SPACE_MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

export function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// When each agent entered its state. A tab's times follow any agent in it, and terminals()
// keeps the status_ms it connected with, so a change is stamped here and a newcomer asks core.
// Done and idle count as one: looking at a done agent makes it idle.
export class StateClock {
  constructor() {
    this.byAddress = {};
  }

  watch(list, cx) {
    for (const a of list) {
      const state = a.status === "idle" ? "done" : a.status;
      const known = this.byAddress[a.address];
      if (known?.state === state) continue;
      this.byAddress[a.address] = { state, at: known ? Date.now() : null, createdAt: known?.createdAt ?? null };
      if (!known && !a.address.includes("/")) this.readFromCore(a.address, cx);
    }
  }

  readFromCore(address, cx) {
    cx.spawn(async (cx) => {
      const reply = await hc(["get", address, "--json"]).catch(() => null);
      if (reply?.code !== 0) return;
      const { status_ms, created_ms } = JSON.parse(reply.stdout);
      this.byAddress[address].at = status_ms ?? this.byAddress[address].at;
      this.byAddress[address].createdAt = created_ms ?? null;
      cx.notify();
    });
  }

  // How long the session has run, from its terminal; a remote agent has only its state's time.
  ageFrom(a, tab) {
    return this.byAddress[a.address]?.createdAt ?? this.since(a, tab);
  }

  // A remote agent, or one core has not answered for, has only its tab's times.
  since(a, tab) {
    return this.byAddress[a.address]?.at ?? (a.status === "working" ? tab?.working_since : tab?.changed_at);
  }
}

// The agent's icon from the app's program table: a one-color glyph or a picture.
export function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

const slash = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "");
const lastPart = (p) => slash(p).split("/").pop();
const sameFolder = (a, b) => slash(a).toLowerCase() === slash(b).toLowerCase();
const isTrunk = (branch) => branch === "main" || branch === "master";

// `colors`: another window's space.colors (the board reads the sessions window's).
export function spaceColor(t, spaceId, colors = shared("space.colors") ?? {}) {
  const color = colors[spaceId];
  if (!color) return null;
  return color.startsWith("#") ? color : SPACE_MARK[color] ?? t[color];
}

// `git status` and the diff, read without locks so a look never wakes a watcher.
async function readCheckout(cwd) {
  const git = (args) => exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", ...args], { cwd });
  const status = await git(["status", "--porcelain=v2", "--branch"]);
  if (status.code !== 0) return null;
  const where = await git(["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"]);
  const [top, common] = where.stdout.trim().split(/\r?\n/).map(slash);
  if (!top || !common) return null;
  const info = {
    top,
    repo: common.endsWith("/.git") ? lastPart(common.slice(0, -5)) : lastPart(common).replace(/\.git$/, ""),
    linked: !sameFolder(common, `${top}/.git`),
    branch: null,
    ahead: 0,
    behind: 0,
    added: 0,
    removed: 0,
    untracked: 0,
  };
  for (const line of status.stdout.split(/\r?\n/)) {
    if (line.startsWith("# branch.head ")) info.branch = line.slice(14);
    else if (line.startsWith("# branch.ab ")) {
      const [a, b] = line.slice(12).split(" ");
      info.ahead = Math.abs(parseInt(a, 10)) || 0;
      info.behind = Math.abs(parseInt(b, 10)) || 0;
    } else if (line.startsWith("? ")) info.untracked++;
  }
  const diff = await git(["diff", "--shortstat", "HEAD"]);
  info.added = Number(/(\d+) insertion/.exec(diff.stdout)?.[1] ?? 0);
  info.removed = Number(/(\d+) deletion/.exec(diff.stdout)?.[1] ?? 0);
  return info;
}

// Each local pane folder's checkout, looked at when it first shows up, when a turn or
// command in it ends (a checkout, a commit, edits), and once a minute while in front.
export class CheckoutsByFolder {
  constructor() {
    this.info = {};
    this.checkedAt = {};
    this.busy = {};
    this.pending = new Set();
    this.running = false;
  }

  tick(allPanes, cx) {
    const now = Date.now();
    // A remote pane's tab id carries its machine ("vps/tb..."): its folder isn't here.
    const local = allPanes.filter((p) => p.terminal && p.cwd && !p.tab.includes("/"));
    const busy = {};
    for (const p of local) {
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      const turnEnded = this.busy[p.pane] && !busy[p.pane];
      const stale = this.info[p.cwd] && window()?.active && now - this.checkedAt[p.cwd] > GIT_FALLBACK_MS;
      if (!(p.cwd in this.checkedAt) || turnEnded || stale) this.pending.add(p.cwd);
    }
    this.busy = busy;
    const shown = new Set(local.map((p) => p.cwd));
    for (const cwd of Object.keys(this.checkedAt)) if (!shown.has(cwd)) { delete this.checkedAt[cwd]; delete this.info[cwd]; }
    if (this.pending.size && !this.running) this.drain(cx);
  }

  drain(cx) {
    this.running = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const batch = [...this.pending];
        this.pending.clear();
        for (const cwd of batch) {
          this.checkedAt[cwd] = Date.now();
          this.info[cwd] = await readCheckout(cwd).catch(() => null);
        }
      }
      this.running = false;
      const text = JSON.stringify(this.info);
      if (text !== JSON.stringify(shared(GIT_KEY) ?? {})) setShared(GIT_KEY, this.info);
      if (text === this.infoText) return;
      this.infoText = text;
      cx.notify();
    });
  }

  of(cwd) {
    return cwd ? this.info[cwd] ?? null : null;
  }
}

const BACKGROUND_TRUST_MS = 3 * 3600000;

// Context use per terminal, written by ~/.claude/hooks/statusline.ps1 as
// ~/.claude/state/ctx/<terminal>.json: { total, cap, soft, pct_cap, zone, background, at }.
export class ContextByTerminal {
  constructor(cx) {
    this.dir = `${home()}/.claude/state/ctx`;
    this.byTerminal = {};
    this.textOf = {};
    this.addresses = [];
    this.opencode = new OpenCodeContext(cx);
    cx.timer.every(CTX_RELOAD_MS, (cx) => this.reload(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        try {
          await watchFolder(this.dir);
        } catch {
          return; // No folder yet: the timer reads it once the statusline makes it.
        }
        this.reload(cx);
      }
    });
  }

  watch(addresses, cx) {
    const fresh = addresses.filter((a) => !a.includes("/"));
    const known = fresh.every((a) => this.addresses.includes(a));
    this.addresses = fresh;
    if (!known) this.reload(cx);
  }

  reload(cx) {
    cx.spawn(async (cx) => {
      let changed = false;
      for (const address of this.addresses) {
        const text = await readTextFile(`${this.dir}/${address}.json`).catch(() => null);
        if (text === this.textOf[address]) continue;
        try {
          this.byTerminal[address] = text ? JSON.parse(text) : null;
          this.textOf[address] = text;
          changed = true;
        } catch {
          // A write in progress: keep the last reading.
        }
      }
      if (changed) cx.notify();
    });
  }

  of(address) {
    return this.byTerminal[address] ?? null;
  }

  // False once a session opened and has not answered yet; no reading says nothing either way.
  started(address) {
    const session = this.of(address)?.session;
    return !session || session.input + session.cache_write + session.cache_read + session.output > 0;
  }
}

// Herdr marks a session done when its turn ends, even with background shells or agents still
// running; the statusline counts those. A count this old lost its end notice: stop believing it.
export function withBackground(list, contexts) {
  const now = Date.now();
  return list.map((a) => {
    const ctx = contexts.of(a.address);
    const running = ctx?.background > 0 && now - ctx.at < BACKGROUND_TRUST_MS;
    return running && (a.status === "done" || a.status === "idle") ? { ...a, status: "working" } : a;
  });
}

// What the agent itself reports it is doing (OSC 7501 `msg`).
export function reportOf(terminal) {
  const r = terminal?.report;
  if (typeof r === "string") return r.trim() || null;
  const msg = r?.msg ?? r?.message ?? terminal?.status?.msg;
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

// Busy (working or blocked) agents that share a checkout: address -> the names of the others there.
export function sharedCheckouts(list, checkouts, cwdOf, nameOf) {
  const byTop = new Map();
  for (const a of list) {
    if (a.status !== "working" && a.status !== "blocked") continue;
    const top = checkouts.of(cwdOf(a))?.top?.toLowerCase();
    if (!top) continue;
    byTop.set(top, [...(byTop.get(top) ?? []), a]);
  }
  const clash = new Map();
  for (const group of byTop.values()) {
    if (group.length < 2) continue;
    for (const a of group) clash.set(a.address, group.filter((b) => b !== a).map(nameOf));
  }
  return clash;
}

const CONTEXT_BLOCKS = 10;

function zoneColor(t, zone) {
  if (zone === "DUMB" || zone === "EDGE") return t.blocked;
  return zone === "CODE" ? t.ansi3 : t.accent;
}

// Context used against the hard cap, in the same blocks as the footer's CPU and RAM meters.
function contextMeter(t, ctx) {
  const pct = Math.min(100, ctx.pct_cap);
  const lit = pct > 0 ? Math.max(1, Math.round(CONTEXT_BLOCKS * pct / 100)) : 0;
  const color = zoneColor(t, ctx.zone);
  return h_flex().id("ctx").gap(5).items_center()
    .tooltip(`context ${Math.round(ctx.total / 1000)}k · ${Math.round(ctx.pct_cap)}% of cap · ${ctx.zone}`)
    .child(h_flex().gap(2).items_center().children(Array.from({ length: CONTEXT_BLOCKS }, (_, i) =>
      div().w(5).h(8).rounded(1).bg(i < lit ? color : t.border))))
    .child(div().text_size(10.5).text_color(ctx.zone === "SMART" ? t.dim : color).child(`${Math.round(ctx.pct_cap)}%`));
}

function chip(t, color, children) {
  return h_flex().flex_none().h(16).px(4).gap(3).rounded(4).items_center().bg(color + "22").text_color(color).children(children);
}

// The lines under an agent's name; null when there is nothing to tell.
export function agentDetails(t, { msg, git, ctx, clash, status, indent = 25 }) {
  const wt = git?.linked ? lastPart(git.top) : null;
  const branch = git?.branch && !isTrunk(git.branch) && git.branch !== wt ? git.branch : null;
  const chips = [
    wt && chip(t, t.ansi5, [svg("mods/workspace-chrome/branch.svg").size(10), div().id("wt").max_w(78).truncate().tooltip(wt).child(wt)]),
    branch && div().id("branch").flex_shrink(1).min_w(0).truncate().text_color(wt ? t.dim : t.ansi5).tooltip(branch).child(branch),
  ].filter(Boolean);
  if (!msg && !chips.length && !ctx && !clash?.length) return null;
  return v_flex()
    .pl(indent)
    .pb(5)
    .gap(3)
    .text_size(11)
    .when(Boolean(msg), (el) => el.child(div().id("report").truncate().text_color(status === "blocked" ? t.blocked : t.muted).tooltip(msg).child(msg)))
    .when(chips.length > 0, (el) => el.child(h_flex().min_w(0).flex_wrap().gap(5).items_center().text_size(10.5).children(chips)))
    .when(Boolean(clash?.length), (el) => el.child(div().id("clash").truncate().text_size(10.5).text_color(t.blocked).tooltip(clash.join(", ")).child(`Same checkout as ${clash.join(", ")}`)))
    .when(Boolean(ctx), (el) => el.child(contextMeter(t, ctx)));
}
