// The agents list as a board for a workspace of its own (props { board: true }):
// a card per agent, most urgent first, with what it says it is doing, its checkout,
// and the tokens its session spent. A click asks the sessions
// window to show that agent (it reads ~/.config/herdr-app-shared/focus-request.json).
// props { compact: true } draws status-board.js instead.

import { chosenSessionName } from "./session-name.js";
import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, terminals, panes, spaces, home, appHome, props, readTextFile, writeTextFile } from "herdr";
import { BlockedMenus } from "./answers.js";
import { CheckoutsByFolder, ContextByTerminal, agentDetails, reportOf, sharedCheckouts, spaceColor, StateClock, duration, icon, withBackground } from "./insight.js";
import { ContextMaps, contextMap, contextSummary } from "./ctxmap/view.js";
import { SilentAgents } from "./silent.js";
import { kilo, savedRightPanel, statusBoard, tilde } from "./status-board.js";
import { UsagePanel } from "./usage-panel.js";
import { NotesPanel } from "./notes/panel.js";
import { FinishGlow } from "./finish-glow.js";
import { TreemapTiles } from "./ctxmap/treemap.js";

const URGENCY = { blocked: 4, done: 3, working: 2, idle: 1 };
const WORD = { blocked: "needs you", done: "done", working: "working", idle: "idle", unknown: "no status" };
const FOCUS_REQUEST = () => `${home()}/.config/herdr-app-shared/focus-request.json`;
// The sessions window keeps the space avatar colors; this window has none of its own.
const SESSIONS_SHARED = () => `${home()}/.config/herdr-app/shared.json`;
const COLORS_MS = 30000;
// The compact board shows elapsed minutes.
const CLOCK_MS = 30000;

// The folder the agent works in, with the home folder as ~.
function folderLine(t, cwd) {
  if (!cwd) return null;
  const shown = tilde(cwd);
  return h_flex().id("cwd").gap(5).items_center().text_size(11).text_color(t.dim).tooltip(cwd)
    .child(svg("mods/workspace-chrome/folder.svg").size(11).flex_none())
    .child(div().flex_1().min_w(0).truncate().text_ellipsis_start().child(shown));
}

const capitalized = (word) => word[0].toUpperCase() + word.slice(1);

// Tokens this session (summed by ~/.claude/hooks/statusline.ps1 from the transcript) and the context now.
function tokenLine(t, ctx) {
  const s = ctx.session;
  const spent = s.input + s.cache_write + s.cache_read + s.output;
  const pair = (label, value, color) => h_flex().gap(4).child(div().text_color(t.dim).child(label)).child(div().text_color(color).child(value));
  return h_flex().id("tokens").gap(10).items_center().text_size(11)
    .tooltip(`input ${kilo(s.input)} · cache write ${kilo(s.cache_write)} · cache read ${kilo(s.cache_read)} · output ${kilo(s.output)}`)
    .child(pair("session", `${kilo(spent)} tokens`, t.foreground))
    .child(pair("out", kilo(s.output), t.muted))
    .child(pair("context", kilo(ctx.total), t.muted))
    .child(div().flex_1())
    .when(s.cost_usd > 0, (el) => el.child(div().text_color(t.dim).child(`$${s.cost_usd.toFixed(2)}`)));
}

export class AgentBoard {
  constructor(cx) {
    this.checkouts = new CheckoutsByFolder();
    this.contexts = new ContextByTerminal(cx);
    this.clock = new StateClock();
    this.menus = new BlockedMenus(cx);
    this.maps = new ContextMaps();
    this.maps.restore(cx);
    this.silent = new SilentAgents(cx);
    this.usagePanel = props()?.compact ? new UsagePanel(cx) : null;
    this.notesPanel = props()?.compact ? new NotesPanel(cx) : null;
    this.finishGlow = new FinishGlow();
    this.hovered = null;
    this.treemapTiles = props()?.compact ? cx.new(TreemapTiles, { tree: null }) : null;
    this.rightPanel = savedRightPanel();
    this.hover = {
      is: (id) => this.hovered === id,
      set: (id, on, cx) => {
        const next = on ? id : this.hovered === id ? null : this.hovered;
        if (next === this.hovered) return;
        this.hovered = next;
        cx.notify();
      },
    };
    this.requestText = undefined;
    this.spaceColors = {};
    this.readColors(cx);
    cx.timer.every(COLORS_MS, (cx) => this.readColors(cx));
    if (props()?.compact) cx.timer.every(CLOCK_MS, (cx) => cx.notify());
    cx.timer.every(1000, (cx) => this.checkouts.tick(panes(), cx));
    cx.timer.every(5000, (cx) => this.maps.tick(this.localAddresses(), this.contexts, cx));
  }

  readColors(cx) {
    cx.spawn(async (cx) => {
      let colors;
      try {
        colors = JSON.parse((await readTextFile(SESSIONS_SHARED())) ?? "{}")["space.colors"] ?? {};
      } catch {
        return; // Mid-write: the next read gets it.
      }
      if (JSON.stringify(colors) === JSON.stringify(this.spaceColors)) return;
      this.spaceColors = colors;
      cx.notify();
    });
  }

  localAddresses() {
    return this.silent.with(agents()).map((a) => a.address).filter((a) => !a.includes("/"));
  }

  requestFocus(terminal, cx) {
    cx.spawn(async () => {
      const text = JSON.stringify({ terminal, at: Date.now(), from: appHome() });
      if (this.requestText === undefined) this.requestText = await readTextFile(FOCUS_REQUEST());
      try {
        await writeTextFile(FOCUS_REQUEST(), text, this.requestText);
      } catch {
        this.requestText = await readTextFile(FOCUS_REQUEST());
        await writeTextFile(FOCUS_REQUEST(), text, this.requestText).catch(() => {});
      }
      this.requestText = text;
    });
  }

  card(t, a, ctx, cx) {
    const tab = ctx.tabs.get(a.tab);
    const started = this.contexts.started(a.address);
    const since = started ? this.clock.since(a, tab) : null;
    const title = [a.space_name, chosenSessionName(a.address) || (tab?.named ? tab.name : a.title)].filter(Boolean).join(" · ");
    const stripe = spaceColor(t, a.space, this.spaceColors);
    const session = this.contexts.of(a.address);
    const details = agentDetails(t, {
      msg: reportOf(ctx.terminalOf.get(a.address)),
      git: this.checkouts.of(ctx.cwdOf(a)),
      ctx: session,
      clash: ctx.clash.get(a.address),
      status: a.status,
      indent: 0,
    });
    return v_flex().id(`card-${a.address}`).relative().p(10).pl(14).gap(6).rounded(10)
      .bg(t.surface).border(1).border_color(a.status === "blocked" ? t.blocked : t.border)
      .cursor_pointer().hover((s) => s.bg(t.raised))
      .on_click((_e, cx) => this.requestFocus(a.address, cx))
      .when(Boolean(stripe), (el) => el.child(div().absolute().left(0).top(10).bottom(10).w(3).rounded(2).bg(stripe)))
      .child(h_flex().gap(8).items_center()
        .children([icon(a.program, 16, t.foreground)].filter(Boolean))
        .child(div().id(`title-${a.address}`).flex_1().min_w(0).truncate().text_color(t.foreground).font_medium().tooltip(title).child(title))
        .child(div().flex_none().text_size(11).text_color(t[a.status] ?? t.dim).child(capitalized(WORD[a.status] ?? a.status)))
        .when(Boolean(since), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(duration(Date.now() - since)))))
      .children([folderLine(t, ctx.cwdOf(a))].filter(Boolean))
      .when(Boolean(details), (el) => el.child(details))
      .when(started && Boolean(session?.session), (el) => el.child(tokenLine(t, session)))
      .children([contextMap(t, a.address, this.maps.of(a.address), this.hover)].filter(Boolean))
      .when(a.status === "blocked", (el) => el.children([this.menus.buttons(t, a.address, 0)].filter(Boolean)));
  }

  render(t, cx) {
    const list = withBackground(this.silent.with(agents()), this.contexts).sort((x, y) => (URGENCY[y.status] ?? 0) - (URGENCY[x.status] ?? 0) || y.seq - x.seq);
    const paneOf = new Map(panes().map((p) => [p.pane, p]));
    const cwdOf = (a) => paneOf.get(a.pane)?.cwd;
    const terminalPanesOf = Map.groupBy(panes().filter((p) => p.terminal), (p) => p.tab);
    const ctx = {
      tabs: new Map(spaces().flatMap((s) => s.tabs).map((x) => [x.id, x])),
      terminalOf: new Map(terminals().map((k) => [k.address, k])),
      cwdOf,
      sharesTab: (a) => (terminalPanesOf.get(a.tab)?.length ?? 0) > 1,
      clash: sharedCheckouts(list, this.checkouts, cwdOf, (a) => a.space_name),
    };
    this.contexts.watch(list.map((a) => a.address), cx);
    this.clock.watch(list, cx);
    this.menus.watch(list, cx);
    if (props()?.compact) return statusBoard(t, this.finishGlow.apply(list, Date.now()), ctx, this, cx);
    const nameOf = (address) => {
      const a = list.find((x) => x.address === address);
      const tab = a && ctx.tabs.get(a.tab);
      return [a?.space_name, chosenSessionName(address) || (tab?.named ? tab.name : a?.title)].filter(Boolean).join(" · ") || address;
    };
    const average = this.maps.average(list.map((a) => a.address), nameOf);
    const counts = Object.keys(WORD).map((s) => [s, list.filter((a) => a.status === s).length]).filter(([, n]) => n);
    return v_flex().size_full().min_h(0).bg(t.canvas).text_size(13)
      .child(h_flex().h(36).px(14).gap(12).flex_none().items_center().border_b(1).border_color(t.border)
        .child(div().font_medium().text_color(t.muted).child("Agents"))
        .children(counts.map(([s, n]) => div().text_size(11).text_color(t[s] ?? t.dim).child(`${n} ${s === "blocked" && n > 1 ? "need you" : WORD[s]}`))))
      .child(contextSummary(t, average, this.hover) ?? div())
      .child(v_flex().id("board-list").flex_1().min_h(0).p(10).gap(8).overflow_y_scrollbar()
        .when(list.length === 0, (el) => el.child(div().text_color(t.dim).child("No agents yet. Start Claude Code or another agent in a terminal and it shows up here.")))
        .children(list.map((a) => this.card(t, a, ctx, cx))));
  }
}
