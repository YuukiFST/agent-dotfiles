// Under the status dashboard's sessions: the Claude plan's limits or OpenCode's spend. It also reads
// the machine, for the Hardware Monitor beside it.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { appHome, exec, home, readTextFile } from "herdr";
import { HardwareWatch } from "./hardware.js";
import { harnessSwitch, loadHarnesses } from "./harness-switch.js";
import { PlanUsage, TokenUsage, remaining, resetsText, timeLeft, tokenBreakdown, tokenCount } from "./plan-usage.js";

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
const DETAIL_WIDTH = 48;
// As wide as "656.9M" and "max 656.9M" in the number font.
const TOKENS_WIDTH = 44;
const BEST_WIDTH = 68;
const TOKENS_BAR_HEIGHT = 3;
// The pace tick stands this far above and below the token bar, so it reads over the fill.
const PACE_TICK_OVERHANG = 2;
// Fits "Top model", the longest OpenCode label.
const STAT_LABEL_WIDTH = 72;

const USAGE_VIEW_KEY = "usage.view";
const CLAUDE_VIEW = "claude";
const OPENCODE_VIEW = "opencode";
const SWITCH_TILE_SIZE = 22;

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
  const hasPercent = Number.isFinite(pct);
  const warning = pct >= 90 ? t.blocked : pct >= 70 ? t.ansi3 : null;
  // Anything above zero lights a block, so 3% of the week never reads as unused; all ten light only at 100%.
  const lit = pct > 0 ? Math.max(1, Math.floor(METER_BLOCKS * Math.min(pct, 100) / 100)) : 0;
  const blocks = Array.from({ length: METER_BLOCKS }, (_, i) =>
    div().flex_1().h(10).rounded(1).bg(i < lit ? warning ?? t.accent : t.border));
  return h_flex().id(`usage-${label}`).flex_1().min_h(24).px(12).gap(8).items_center().text_size(11)
    .tooltip(tooltip ? `${label} · ${tooltip}` : label)
    .child(div().w(LABEL_WIDTH).flex_none().truncate().text_size(12).text_color(t.muted).child(label))
    .child(h_flex().flex_1().min_w(0).gap(2).items_center().children(blocks))
    .child(div().w(PERCENT_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(warning ?? t.foreground).child(hasPercent ? `${Math.round(pct)}%` : "—"))
    .child(div().w(DETAIL_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(t.muted).child(div().truncate().child(detail)));
}

function sectionTitle(t, title, note, leading) {
  return h_flex().id(`usage-title-${title}`).h(26).flex_none().px(12).gap(6).items_center().text_size(11).text_color(t.muted)
    .when(Boolean(note), (el) => el.tooltip(note))
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
  return [plan, error, at && age > READING_STALE_MS && `as of ${remaining(age / 1000)} ago`].filter(Boolean).join(" · ");
}

// The value starts one gap after a shared label column, so the eye does not cross an empty row.
function statRow(t, label, value) {
  return h_flex().id(`stat-${label}`).flex_1().min_h(24).px(12).gap(8).items_center().text_size(12).tooltip(`${label}: ${value}`)
    .child(div().w(STAT_LABEL_WIDTH).flex_none().text_color(t.muted).child(label))
    .child(div().flex_1().min_w(0).truncate().text_ellipsis_middle().font_family(NUMBER_FONT).text_color(t.foreground).child(value));
}

const dayText = (at) => new Date(at).toLocaleDateString("en-CA");

// How far through its period `now` is, in percent: the pace a record would need.
function elapsedPct(kind, since) {
  const end = new Date(since);
  if (kind === "Today") end.setDate(end.getDate() + 1);
  else if (kind === "Week") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  return Math.min(100, Math.max(0, (100 * (Date.now() - since)) / (end.getTime() - since)));
}

// best: the busiest period of this kind, the current one included. The bar is this one's share of
// it, and the tick how much of the period has passed: a fill past the tick is ahead of record pace.
function tokenPeriodRow(t, label, period, best, isFirst) {
  const isRecord = Boolean(best) && period.tokens >= best.tokens;
  const share = best?.tokens > 0 ? Math.min(100, (100 * period.tokens) / best.tokens) : 0;
  const pace = elapsedPct(label, period.since);
  const periodName = label === "Today" ? "day" : label.toLowerCase();
  const tooltip = [tokenBreakdown(period), best && `max ${tokenCount(best.tokens)} from ${dayText(best.since)}`, `${Math.round(pace)}% of the ${periodName} gone`].filter(Boolean).join(" · ");
  return h_flex().id(`tokens-${label}`).flex_1().min_h(24).px(12).gap(8).items_center().text_size(11).tooltip(tooltip)
    .when(isFirst, (el) => el.border_t(1).border_color(t.border))
    .child(div().w(LABEL_WIDTH).flex_none().truncate().text_size(12).text_color(t.muted).child(label))
    .child(div().relative().flex_1().min_w(0).h(TOKENS_BAR_HEIGHT).rounded(1).bg(t.border)
      .child(div().h(TOKENS_BAR_HEIGHT).rounded(1).bg(t.accent).w(`${share}%`))
      .when(Boolean(best), (el) => el.child(div().absolute().top(-PACE_TICK_OVERHANG).left(`${pace}%`).w(1).h(TOKENS_BAR_HEIGHT + 2 * PACE_TICK_OVERHANG).bg(t.muted))))
    .child(div().w(TOKENS_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(t.foreground).child(tokenCount(period.tokens)))
    .child(div().w(BEST_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_color(isRecord ? t.ansi2 : t.muted)
      .child(!best ? "" : isRecord ? "record" : `max ${tokenCount(best.tokens)}`));
}

function tokenPeriodRows(t, { today, week, month, best }) {
  return [
    tokenPeriodRow(t, "Today", today, best?.today, true),
    tokenPeriodRow(t, "Week", week, best?.week, false),
    tokenPeriodRow(t, "Month", month, best?.month, false),
  ];
}

function openCodeRows(t, usage) {
  return [
    statRow(t, "Tokens", tokenCount(usage.tokens)),
    statRow(t, "Cost", Number.isFinite(usage.cost) ? `${usage.cost.toFixed(2)}` : "—"),
    statRow(t, "Sessions", String(usage.sessions ?? "—")),
    statRow(t, "Top model", usage.topModel ?? "—"),
  ];
}

export function usagePanel(t, panel) {
  const reading = panel.plan.reading;
  const windows = reading?.windows ?? [];
  const waiting = (text) => div().px(12).pb(6).text_size(11).text_color(t.muted).whitespace_normal().child(text);
  const planWait = reading?.error ?? (panel.plan.hasFailed ? "Plan usage could not be read. Retrying every 30s" : "Reading the plan…");
  const openCodeWait = panel.isRefreshingOpenCode ? "Reading OpenCode usage…" : "No OpenCode usage in the last 7 days";
  // The bottom padding puts the last row's middle on the Notes send bar's beside it: 6 under the
  // OpenCode rows, 10 under the Claude gauges and token rows.
  const section = (bottom = 6) => v_flex().flex_grow_1().pb(bottom);
  const switcher = harnessSwitch(t, "usage-view", panel.harnesses, panel.view, SWITCH_TILE_SIZE, (view, cx) => panel.showView(view, cx));
  const claudeSection = () => section(10)
    .child(sectionTitle(t, "Claude", reading ? planNote(reading) : "", switcher))
    .children(windows.length ? windows.map((w) => planGauge(t, w)) : [waiting(planWait)])
    .when(Boolean(panel.tokens.reading), (el) => el.children(tokenPeriodRows(t, panel.tokens.reading)));
  const hasOpenCodeUse = panel.opencode?.sessions > 0;
  const openCodeSection = () => section()
    .child(sectionTitle(t, "OpenCode", "last 7 days", switcher))
    .children(hasOpenCodeUse ? openCodeRows(t, panel.opencode) : [waiting(openCodeWait)]);
  return v_flex().flex_1().rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
    .child(panel.view === OPENCODE_VIEW ? openCodeSection() : claudeSection());
}
