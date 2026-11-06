// The board as a status dashboard (props { compact: true }): a summary strip, the sessions grouped
// by state in a list that scrolls on its own, and beside it the context map.

import { chosenSessionName } from "./session-name.js";
import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { home } from "herdr";
import { icon } from "./insight.js";
import { averageContextTree, contextTreemap } from "./ctxmap/treemap.js";
import { usagePanel } from "./usage-panel.js";
import { alertLight, alertOf, alertOrb } from "./attention.js";

const NUMBER_FONT = "Geist Mono";
const SESSIONS_WIDTH = 470;
const CONTEXT_WIDTH = 660;
const USAGE_HEIGHT = 300;
const NUMBER_WIDTH = 54;
const GAP = 8;

const STATES = {
  blocked: { word: "Needs you", color: (t) => t.blocked },
  finished: { word: "Done", color: (t) => t.done },
  working: { word: "Working", color: (t) => t.working },
  idle: { word: "Idle", color: (t) => t.dim },
};
const SUMMARY_STATES = ["blocked", "finished", "working"];

const stateOf = (a) => (a.status === "blocked" || a.status === "working" ? a.status : a.status === "done" ? "finished" : "idle");

export const kilo = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

// The folder with the home folder as ~.
export function tilde(cwd) {
  const slashed = cwd.replaceAll("\\", "/");
  const homeDir = home().replaceAll("\\", "/");
  return slashed.toLowerCase().startsWith(homeDir.toLowerCase()) ? `~${slashed.slice(homeDir.length)}` : slashed;
}

function elapsed(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${String(m % 60).padStart(2, "0")}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

const tokensOf = (session) => session.input + session.cache_write + session.cache_read + session.output;
const lastPart = (cwd) => cwd.replaceAll("\\", "/").replace(/\/+$/, "").split("/").pop();
const numberCell = (el) => el.w(NUMBER_WIDTH).flex_none().flex().justify_end();
const number = (text, color) => numberCell(div()).font_family(NUMBER_FONT).text_size(12).text_color(color).child(text);

const dot = (color) => div().size(6).flex_none().rounded(3).bg(color);

function summaryCell(t, label, value, color, first) {
  return h_flex().flex_1().min_w(0).h(30).px(10).gap(6).items_center()
    .when(!first, (el) => el.border_l(1).border_color(t.border))
    .when(Boolean(color), (el) => el.child(dot(color)))
    .child(div().flex_none().text_size(12).text_color(t.dim).child(label))
    .child(div().flex_none().font_family(NUMBER_FONT).text_size(13).text_color(value === "0" ? t.dim : t.foreground).child(value));
}

function summary(t, list, board) {
  const count = (state) => String(list.filter((a) => stateOf(a) === state).length);
  const total = list.reduce((sum, a) => {
    const session = board.contexts.of(a.address)?.session;
    return sum + (session ? tokensOf(session) : 0);
  }, 0);
  return h_flex().flex_none().rounded(8).border(1).border_color(t.border).bg(t.surface)
    .children(SUMMARY_STATES.map((id, i) => summaryCell(t, STATES[id].word, count(id), STATES[id].color(t), i === 0)))
    .child(summaryCell(t, "Tokens", kilo(total), null, false));
}

function sessionRow(t, a, ctx, board) {
  const tab = ctx.tabs.get(a.tab);
  const started = board.contexts.started(a.address);
  const since = started ? board.clock.ageFrom(a, tab) : null;
  const cwd = ctx.cwdOf(a);
  const session = started ? board.contexts.of(a.address)?.session : null;
  const name = chosenSessionName(a.address) || ((tab?.named ? tab.name : a.title) ?? "");
  const alert = alertOf(t, a.status);
  const isWorking = a.status === "working";
  return v_flex().id(`status-${a.address}`).relative().flex_none().cursor_pointer().border_t(1).border_color(t.border).hover((s) => s.bg(t.raised))
    .when(Boolean(alert), (el) => el.overflow_hidden().children(alertLight(alert)))
    .on_click((_e, cx) => board.requestFocus(a.address, cx))
    .child(h_flex().h(38).pl(8).pr(12).gap(8).items_center()
      .child(alert ? alertOrb(alert) : div().w(14).flex_none())
      .children([icon(a.program, 14, t.foreground)].filter(Boolean))
      .child(v_flex().flex_1().min_w(0)
        .child(h_flex().gap(8).items_center().min_w(0)
          .child(div().flex_none().max_w(220).truncate().text_size(13).font_medium().text_color(isWorking ? t.muted : t.foreground).child(cwd ? lastPart(cwd) : a.space_name))
          .child(div().flex_1().min_w(0).truncate().text_size(12).text_color(t.dim).child(name)))
        .when(Boolean(cwd), (el) => el.child(div().id(`status-path-${a.address}`).truncate().text_ellipsis_start().text_size(11).text_color(t.dim).tooltip(cwd).child(tilde(cwd)))))
      .child(number(since ? elapsed(Date.now() - since) : "—", t.muted))
      .child(number(session ? kilo(tokensOf(session)) : "—", isWorking ? t.muted : t.foreground)))
    .when(a.status === "blocked", (el) => el.children([board.menus.buttons(t, a.address, 40)].filter(Boolean)));
}

function stateGroup(t, id, members, ctx, board) {
  const state = STATES[id];
  const color = state.color(t);
  return v_flex().flex_none()
    .child(h_flex().h(22).px(12).gap(6).items_center().border_t(1).border_color(t.border).bg(t.canvas)
      .child(dot(color))
      .child(div().text_size(12).font_medium().text_color(color).child(state.word))
      .child(div().font_family(NUMBER_FONT).text_size(12).text_color(t.dim).child(String(members.length))))
    .children(members.map((a) => sessionRow(t, a, ctx, board)));
}

function sessionsPanel(t, list, ctx, board) {
  const groups = Object.keys(STATES).map((id) => [id, list.filter((a) => stateOf(a) === id)]).filter(([, members]) => members.length);
  return v_flex().flex_1().min_h(0).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
    .child(h_flex().h(26).flex_none().px(12).gap(10).items_center().text_size(11).text_color(t.dim)
      .child(div().flex_1().min_w(0).child("Sessions"))
      .child(numberCell(div()).child("Time"))
      .child(numberCell(div()).child("Tokens")))
    .child(v_flex().id("status-sessions").flex_1().min_h(0).overflow_y_scrollbar()
      .when(list.length === 0, (el) => el.child(div().p(14).border_t(1).border_color(t.border).text_size(13).text_color(t.dim).child("No agents running.")))
      .children(groups.map(([id, members]) => stateGroup(t, id, members, ctx, board))));
}

// The context map's sessions: all of them averaged, or the one stepped to.
function contextScope(list, ctx, board) {
  const measured = list.filter((a) => board.maps.of(a.address));
  const index = measured.findIndex((a) => a.address === board.treemapSession);
  const shown = measured[index] ?? null;
  const nameOf = (a) => lastPart(ctx.cwdOf(a) ?? a.space_name);
  return {
    maps: (shown ? [shown] : measured).map((a) => board.maps.of(a.address)),
    view: {
      scope: shown ? nameOf(shown) : "All sessions",
      open: board.treemapOpen,
      onToggle: (key, cx) => { board.treemapOpen = board.treemapOpen === key ? null : key; cx.notify(); },
      // Position 0 is "All sessions"; a session the list lost counts as that.
      onStep: (by, cx) => {
        const positions = measured.length + 1;
        board.treemapSession = measured[(index + 1 + by + positions) % positions - 1]?.address ?? null;
        cx.notify();
      },
    },
  };
}

const sameMaps = (a, b) => a.length === b?.length && a.every((map, i) => map === b[i]);

export function statusBoard(t, list, ctx, board, cx) {
  const { maps, view } = contextScope(list, ctx, board);
  if (maps.length && !sameMaps(maps, board.shownContextMaps)) {
    board.shownContextMaps = maps;
    board.shownContextTree = averageContextTree(maps);
    const tree = board.shownContextTree;
    cx.timer.after(0, () => board.treemapTiles.set_props({ tree }));
  }
  return h_flex().size_full().min_h(0).p(10).gap(GAP).items_stretch().bg(t.canvas)
    .child(v_flex().w(SESSIONS_WIDTH).flex_none().min_h(0).gap(GAP)
      .child(v_flex().flex_1().min_h(0).gap(GAP)
        .child(summary(t, list, board))
        .child(sessionsPanel(t, list, ctx, board)))
      .child(v_flex().h(USAGE_HEIGHT).flex_none().child(usagePanel(t, board.usagePanel))))
    .child(board.notesPanel.render(t))
    .child(h_flex().w(CONTEXT_WIDTH).flex_none().min_h(0).items_stretch().child(contextTreemap(t, board.shownContextTree, view, board.treemapTiles)));
}
