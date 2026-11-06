// What fills each agent's context window, for the board: a bar split by component, the
// biggest consumers while the pointer is on it, and the average over every session. The
// numbers come from ./analyze.mjs, run on the session's transcript whenever the statusline
// reports a new context reading (~/.claude/state/ctx/<terminal>.json). Values measured from
// the API's usage show as they are; values estimated from characters (only the first
// request's system prompt, tool schemas and listings) carry a "~".

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, readTextFile, writeTextFile, appHome, home } from "herdr";

const RERUN_MS = 15000;
const ITEMS_SHOWN = 4;
const BIGGEST_SHOWN = 5;

// One theme color per component, in the order analyze.mjs lists them.
const COLOR = {
  system: "ansi8",
  tools: "ansi4",
  memory: "ansi5",
  listings: "ansi13",
  reminders: "ansi3",
  prompts: "ansi2",
  summary: "ansi14",
  text: "ansi6",
  thinking: "ansi11",
  calls: "ansi10",
  results: "ansi1",
  other: "ansi7",
};

const kilo = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));
const amount = (n, exact) => `${exact === false ? "~" : ""}${kilo(n)}`;
const pct = (part, whole) => (whole > 0 ? (100 * part) / whole : 0);
const share = (part, whole) => `${Math.round(pct(part, whole))}%`;
const colorOf = (t, key) => t[COLOR[key]] ?? t.muted;

// Each local terminal's context split, refreshed when its statusline reading changes.
export class ContextMaps {
  constructor() {
    this.byTerminal = {};
    this.ranFor = {};
    this.running = new Set();
    this.script = `${appHome()}/mods/agents-edited/ctxmap/analyze.mjs`;
    this.stateDir = `${home()}/.claude/state/ctx`;
    this.savedPath = `${appHome()}/context-maps.json`;
    this.savedText = null;
    this.isSaving = false;
    this.liveAddresses = [];
  }

  // The last splits saved, so the map is there before the first analysis of this run finishes.
  restore(cx) {
    cx.spawn(async (cx) => {
      try {
        this.savedText = await readTextFile(this.savedPath);
        if (!this.savedText) return;
        this.byTerminal = { ...JSON.parse(this.savedText), ...this.byTerminal };
        cx.notify();
      } catch {
        // Unreadable: the analyses rebuild it.
      }
    });
  }

  async save() {
    if (this.isSaving) return;
    this.isSaving = true;
    const text = JSON.stringify(Object.fromEntries(this.liveAddresses.flatMap((a) => (this.byTerminal[a] ? [[a, this.byTerminal[a]]] : []))));
    try {
      await writeTextFile(this.savedPath, text, this.savedText);
      this.savedText = text;
    } catch {
      this.savedText = await readTextFile(this.savedPath).catch(() => null);
    } finally {
      this.isSaving = false;
    }
  }

  // contexts: ContextByTerminal (insight.js), whose readings carry `at`.
  tick(addresses, contexts, cx) {
    const now = Date.now();
    this.liveAddresses = addresses;
    for (const address of addresses) {
      const reading = contexts.of(address);
      if (!contexts.started(address)) {
        this.forget(address, cx);
        continue;
      }
      if (!reading?.at || this.running.has(address)) continue;
      const ran = this.ranFor[address];
      if (ran && (ran.at === reading.at || now - ran.when < RERUN_MS)) continue;
      this.ranFor[address] = { at: reading.at, when: now };
      this.run(address, cx);
    }
  }

  run(address, cx) {
    this.running.add(address);
    cx.spawn(async (cx) => {
      try {
        const tally = await readTextFile(`${this.stateDir}/${address}.tally.json`).catch(() => null);
        const transcript = tally ? JSON.parse(tally.replace(/^﻿/, "")).transcript : null;
        if (!transcript) return;
        const r = await exec("node", [this.script, transcript]);
        const map = JSON.parse(r.stdout);
        if (map.error || !map.categories) return;
        this.byTerminal[address] = map;
        cx.notify();
        await this.save();
      } catch {
        // A tally mid-write or node missing: the next reading tries again.
      } finally {
        this.running.delete(address);
      }
    });
  }

  // A map outlives its session otherwise: the next one has no transcript to replace it with.
  forget(address, cx) {
    if (!this.byTerminal[address]) return;
    delete this.byTerminal[address];
    delete this.ranFor[address];
    cx.notify();
    this.save();
  }

  of(address) {
    return this.byTerminal[address] ?? null;
  }

  // Every component's average over the sessions that have a split, and the biggest single
  // consumers among all of them, each with its session.
  average(addresses, nameOf) {
    const maps = addresses.map((a) => [a, this.of(a)]).filter(([, m]) => m);
    if (!maps.length) return null;
    const sums = new Map();
    for (const [address, m] of maps) {
      for (const c of m.categories) {
        const s = sums.get(c.key) ?? { key: c.key, label: c.label, tokens: 0, exact: true, top: null };
        s.tokens += c.tokens;
        s.exact &&= c.exact !== false;
        if (!s.top || c.tokens > s.top.tokens) s.top = { label: nameOf(address), tokens: c.tokens, exact: c.exact };
        sums.set(c.key, s);
      }
    }
    const categories = [...sums.values()].map((s) => ({
      key: s.key,
      label: s.label,
      tokens: Math.round(s.tokens / maps.length),
      exact: s.exact,
      items: s.top && maps.length > 1 ? [{ label: s.top.label, tokens: s.top.tokens, exact: s.top.exact }] : [],
    }));
    const biggest = maps.flatMap(([address, m]) => (m.biggest ?? []).map((b) => ({ ...b, session: nameOf(address) })))
      .sort((x, y) => y.tokens - x.tokens).slice(0, BIGGEST_SHOWN);
    const total = categories.reduce((n, c) => n + c.tokens, 0);
    return { total, sessions: maps.length, sum: maps.reduce((n, [, m]) => n + m.total, 0), categories, biggest };
  }
}

// The bar: one segment per component, as wide as its share of the context.
function bar(t, id, map, height) {
  const shown = map.categories.filter((c) => pct(c.tokens, map.total) >= 0.4);
  return h_flex().id(id).w_full().h(height).rounded(3).overflow_hidden().bg(t.border)
    .children(shown.map((c) => div().id(`${id}-${c.key}`).h_full().w(`${pct(c.tokens, map.total)}%`).bg(colorOf(t, c.key))
      .tooltip(`${c.label} · ${amount(c.tokens, c.exact)} tokens (${share(c.tokens, map.total)})`)));
}

const row = (t, color, label, tokens, total, exact, strong) => h_flex().gap(6).items_center()
  .child(div().size(8).rounded(2).flex_none().bg(color))
  .child(div().flex_1().min_w(0).truncate().text_color(strong ? t.foreground : t.muted).child(label))
  .child(div().w(56).flex_none().h(4).rounded(2).bg(t.border)
    .child(div().h_full().rounded(2).bg(color).w(`${Math.max(2, pct(tokens, total))}%`)))
  .child(div().w(42).flex_none().text_right().text_color(t.muted).child(amount(tokens, exact)))
  .child(div().w(30).flex_none().text_right().text_color(t.dim).child(share(tokens, total)));

const sub = (t, label, tokens, exact) => h_flex().pl(14).gap(6)
  .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(label))
  .child(div().flex_none().text_color(t.dim).child(amount(tokens, exact)));

const heading = (t, text) => div().pt(4).text_size(10.5).font_medium().text_color(t.dim).child(text);

// The breakdown under the bar: the biggest single consumers, then every component biggest
// first with its biggest pieces (and, for tool calls and results, the total per tool).
function breakdown(t, map) {
  const sorted = [...map.categories].sort((x, y) => y.tokens - x.tokens);
  const keyColor = new Map(map.categories.map((c) => [c.key, colorOf(t, c.key)]));
  return v_flex().gap(5).pt(4).text_size(11)
    .when((map.biggest ?? []).length > 0, (el) => el
      .child(heading(t, "Top consumers"))
      .children(map.biggest.map((b) => row(t, keyColor.get(b.category) ?? t.muted,
        [b.n > 1 ? `${b.label} ×${b.n}` : b.label, b.session].filter(Boolean).join(" · "), b.tokens, map.total, true, true))))
    .child(heading(t, "By component"))
    .children(sorted.map((c) => v_flex().gap(1)
      .child(row(t, colorOf(t, c.key), c.label, c.tokens, map.total, c.exact, true))
      .when(Boolean(c.byTool?.length > 1), (el) => el.child(h_flex().pl(14).gap(8).overflow_hidden().text_color(t.dim)
        .children(c.byTool.slice(0, 5).map((x) => div().flex_none().child(`${x.label} ${kilo(x.tokens)}`)))))
      .children(c.items.slice(0, ITEMS_SHOWN).filter((it) => it.label !== c.label)
        .map((it) => sub(t, it.n > 1 ? `${it.label} ×${it.n}` : it.label, it.tokens, it.exact)))));
}

// One agent's context: the bar with its two biggest components, and the breakdown while hovered.
// hover: { is(id) → bool, set(id, on, cx) }, owned by the board.
export function contextMap(t, address, map, hover) {
  if (!map) return null;
  const id = `ctxmap-${address}`;
  const top = [...map.categories].sort((x, y) => y.tokens - x.tokens).slice(0, 2);
  const open = hover.is(id);
  return v_flex().id(id).gap(3)
    .on_hover((on, cx) => hover.set(id, on, cx))
    .child(h_flex().gap(10).items_center().text_size(10.5).overflow_hidden()
      .children(top.map((c) => h_flex().flex_none().gap(4).items_center()
        .child(div().size(7).rounded(2).bg(colorOf(t, c.key)))
        .child(div().text_color(t.muted).child(`${c.label} ${share(c.tokens, map.total)}`))))
      .child(div().flex_1())
      .when(map.compactions > 0, (el) => el.child(div().flex_none().text_color(t.dim).child(`compacted ×${map.compactions}`))))
    .child(bar(t, `${id}-bar`, map, 6))
    .when(open, (el) => el.child(breakdown(t, map)));
}

// Every session at once: the average split, the sum, and the breakdown while hovered.
export function contextSummary(t, avg, hover) {
  if (!avg) return null;
  const id = "ctxmap-all";
  const open = hover.is(id);
  return v_flex().id(id).flex_none().mx(10).mt(10).p(10).gap(5).rounded(10).bg(t.surface).border(1).border_color(t.border)
    .on_hover((on, cx) => hover.set(id, on, cx))
    .child(h_flex().gap(8).items_center().text_size(11)
      .child(div().font_medium().text_color(t.muted).child("Context window"))
      .child(div().text_color(t.dim).child(`${avg.sessions} ${avg.sessions === 1 ? "session" : "sessions"}`))
      .child(div().flex_1())
      .child(div().text_color(t.dim).child("avg"))
      .child(div().text_color(t.foreground).child(kilo(avg.total)))
      .child(div().text_color(t.dim).child("· total"))
      .child(div().text_color(t.muted).child(kilo(avg.sum))))
    .child(bar(t, `${id}-bar`, avg, 8))
    .when(!open, (el) => el.child(h_flex().gap(10).text_size(10.5).overflow_hidden()
      .children([...avg.categories].sort((x, y) => y.tokens - x.tokens).slice(0, 4).map((c) => h_flex().flex_none().gap(4).items_center()
        .child(div().size(7).rounded(2).bg(colorOf(t, c.key)))
        .child(div().text_color(t.dim).child(`${c.label} ${share(c.tokens, avg.total)}`))))))
    .when(open, (el) => el.child(breakdown(t, avg)));
}
