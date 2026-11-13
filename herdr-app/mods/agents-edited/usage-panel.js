// Under the status dashboard's sessions: the Claude plan's limits or OpenCode's spend. It also reads
// the machine, for the Hardware Monitor beside it.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { appHome, exec, home, readTextFile } from "herdr";
import { HardwareWatch } from "./hardware.js";
import { harnessSwitch, loadHarnesses } from "./harness-switch.js";
import { PlanUsage, TokenUsage, resetsText, timeLeft, tokenBreakdown, tokenCount } from "./plan-usage.js";

const NUMBER_FONT = "Geist Mono";
const SAMPLE_MS = 5000;
// The footer of every layout keeps this file current (mods/claude-usage/system-sample.mjs).
const SAMPLE_FILE = () => `${home()}/.config/herdr-app/data/claude-usage/system-sample.json`;
const SAMPLE_STALE_MS = 30000;
const READING_STALE_MS = 15 * 60000;
const GIB = 1073741824;
const METER_BLOCKS = 10;
// Fits "Session", the longest label the plan sends.
const LABEL_WIDTH = 56;
// As wide as "100%" and "renewed": the figures sit beside their bar, the bar takes the rest.
const PERCENT_WIDTH = 28;
const DETAIL_WIDTH = 44;

const USAGE_VIEW_KEY = "usage.view";
const CLAUDE_VIEW = "claude";
const OPENCODE_VIEW = "opencode";
const SWITCH_TILE_SIZE = 18;

// Written by ./opencode-sample.mjs. OpenCode has no plan limit to measure against, so its view
// shows what was spent, not a percentage.
const OPENCODE_USAGE_FILE = () => `${home()}/.claude/state/ctx/opencode/usage.json`;
const OPENCODE_USAGE_STALE_MS = 7 * 24 * 3600000;
const OPENCODE_REFRESH_MS = 60000;

const parseSample = (text) => {
  try {
    return JSON.parse(text ?? "null");
  } catch {
    return null; // Being replaced: the next read gets it.
  }
};

export class UsagePanel {
  constructor(cx) {
    this.plan = new PlanUsage(cx);
    this.tokens = new TokenUsage(cx);
    this.hardware = new HardwareWatch(cx);
    this.sample = null;
    this.shownSample = null;
    this.opencode = null;
    this.harnesses = [];
    this.view = localStorage.getItem(USAGE_VIEW_KEY) === OPENCODE_VIEW ? OPENCODE_VIEW : CLAUDE_VIEW;
    this.isRefreshingOpenCode = false;
    this.readSample(cx);
    this.refreshOpenCode(cx);
    cx.spawn(async (cx) => {
      this.harnesses = await loadHarnesses().catch(() => []);
      cx.notify();
    });
    cx.timer.every(SAMPLE_MS, (cx) => this.readSample(cx));
    cx.timer.every(OPENCODE_REFRESH_MS, (cx) => this.refreshOpenCode(cx));
  }

  showView(view, cx) {
    this.view = view;
    localStorage.setItem(USAGE_VIEW_KEY, view);
    this.refreshOpenCode(cx);
    cx.notify();
  }

  async showOpenCodeFile(cx) {
    const usage = parseSample(await readTextFile(OPENCODE_USAGE_FILE()).catch(() => null));
    const fresh = usage && Date.now() - usage.at < OPENCODE_USAGE_STALE_MS ? usage : null;
    if (fresh?.at === this.opencode?.at) return;
    this.opencode = fresh;
    cx.notify();
  }

  // Runs only while that view shows: spawning node for numbers nobody is looking at is waste.
  refreshOpenCode(cx) {
    if (this.view !== OPENCODE_VIEW || this.isRefreshingOpenCode) return;
    this.isRefreshingOpenCode = true;
    cx.spawn(async (cx) => {
      await this.showOpenCodeFile(cx);
      await exec("node", [`${appHome()}/mods/agents-edited/opencode-sample.mjs`, "--usage"]).catch(() => null);
      await this.showOpenCodeFile(cx);
      this.isRefreshingOpenCode = false;
    });
  }

  readSample(cx) {
    cx.spawn(async (cx) => {
      const sample = parseSample(await readTextFile(SAMPLE_FILE()).catch(() => null));
      const fresh = sample?.totalKb && Date.now() - sample.at < SAMPLE_STALE_MS ? sample : null;
      if (fresh) this.hardware.addSample(fresh);
      const shown = fresh && [fresh.cpu, Math.round(fresh.freeKb / 10486), Math.round(fresh.diskFree / GIB)].join();
      if (shown === this.shownSample) return;
      this.shownSample = shown;
      this.sample = fresh;
      cx.notify();
    });
  }
}

function gauge(t, label, pct, detail, tooltip) {
  const warning = pct >= 90 ? t.blocked : pct >= 70 ? t.ansi3 : null;
  // Anything above zero lights a block: 3% of the week must not read as unused.
  const lit = pct > 0 ? Math.max(1, Math.round(METER_BLOCKS * Math.min(pct, 100) / 100)) : 0;
  const blocks = Array.from({ length: METER_BLOCKS }, (_, i) =>
    div().flex_1().h(10).rounded(1).bg(i < lit ? warning ?? t.accent : t.border));
  return h_flex().id(`usage-${label}`).flex_1().min_h(24).px(12).gap(8).items_center().text_size(11)
    .when(Boolean(tooltip), (el) => el.tooltip(tooltip))
    .child(div().w(LABEL_WIDTH).flex_none().truncate().text_size(12).text_color(t.muted).child(label))
    .child(h_flex().flex_1().min_w(0).gap(2).items_center().children(blocks))
    .child(div().w(PERCENT_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(warning ?? t.foreground).child(`${Math.round(pct)}%`))
    .child(div().w(DETAIL_WIDTH).flex_none().flex().justify_end().text_color(t.dim).child(div().truncate().child(detail)));
}

function sectionTitle(t, title, note, leading) {
  return h_flex().h(26).flex_none().px(12).gap(6).items_center().text_size(11).text_color(t.dim)
    .when(Boolean(leading), (el) => el.child(leading))
    .child(div().flex_none().font_medium().child(title))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().child(note)));
}

function planGauge(t, win) {
  const isRenewed = win.resetsAt <= Date.now() / 1000;
  if (isRenewed) return gauge(t, win.label, 0, "renewed");
  return gauge(t, win.label, win.percent, win.resetsAt ? timeLeft(win.resetsAt) : "", win.resetsAt ? resetsText(win.resetsAt) : "");
}

function planNote({ plan, at, error }) {
  const age = Date.now() - (at ?? 0);
  return [plan, error, at && age > READING_STALE_MS && `as of ${Math.round(age / 60000)}m ago`].filter(Boolean).join(" · ");
}

function statRow(t, label, value) {
  return h_flex().flex_1().min_h(24).px(12).gap(8).items_center().text_size(12)
    .child(div().flex_none().text_color(t.muted).child(label))
    .child(div().flex_1().min_w(0).flex().justify_end().font_family(NUMBER_FONT).text_color(t.foreground).child(div().truncate().child(value)));
}

function tokenPeriodCell(t, label, period) {
  return h_flex().id(`tokens-${label}`).flex_1().min_w(0).gap(6).items_center().tooltip(tokenBreakdown(period))
    .child(div().flex_none().text_color(t.muted).child(label))
    .child(div().flex_none().font_family(NUMBER_FONT).text_size(11).text_color(t.foreground).child(tokenCount(period.tokens)));
}

function tokenPeriodsRow(t, { today, week, month, allTime }) {
  return h_flex().flex_1().min_h(24).px(12).gap(12).items_center().text_size(12)
    .child(tokenPeriodCell(t, "Today", today))
    .child(tokenPeriodCell(t, "Week", week))
    .child(tokenPeriodCell(t, "Month", month))
    .child(tokenPeriodCell(t, "All", allTime));
}

function openCodeRows(t, usage) {
  return [
    statRow(t, "Tokens", tokenCount(usage.tokens)),
    statRow(t, "Cost", `$${usage.cost.toFixed(2)}`),
    statRow(t, "Sessions", String(usage.sessions)),
    statRow(t, "Top model", usage.topModel ?? "—"),
  ];
}

export function usagePanel(t, panel) {
  const reading = panel.plan.reading;
  const windows = reading?.windows ?? [];
  const waiting = (text) => div().px(12).pb(6).text_size(11).text_color(t.dim).child(text);
  // pb 6 puts the last row's middle on the Notes send bar's beside it.
  const section = () => v_flex().flex_grow_1().pb(6);
  const switcher = harnessSwitch(t, "usage-view", panel.harnesses, panel.view, SWITCH_TILE_SIZE, (view, cx) => panel.showView(view, cx));
  const claudeSection = () => section()
    .child(sectionTitle(t, "Claude", reading ? planNote(reading) : "", switcher))
    .children(windows.length ? windows.map((w) => planGauge(t, w)) : [waiting(reading?.error ?? "Reading the plan…")])
    .when(Boolean(panel.tokens.reading), (el) => el.child(tokenPeriodsRow(t, panel.tokens.reading)));
  const openCodeSection = () => section()
    .child(sectionTitle(t, "OpenCode", "last 7 days", switcher))
    .children(panel.opencode ? openCodeRows(t, panel.opencode) : [waiting("No reading yet")]);
  return v_flex().flex_1().rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
    .child(panel.view === OPENCODE_VIEW ? openCodeSection() : claudeSection());
}
