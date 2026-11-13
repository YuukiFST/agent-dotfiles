// The Hardware Monitor, in the place of the Context Window Map: can a job run now, why not, and what
// to close. Only what can be acted on: Windows's own processes never show.

import { Background, PathBuilder, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { STATE, clock, verdictGroups } from "./hardware-analysis.js";

const NUMBER_FONT = "Geist Mono";
const SECTION_GAP = 14;
const CARD_RADIUS = 8;
const METER_MIN_HEIGHT = 136;
const HERO_SIZE = 28;
const CONSUMER_ROW_HEIGHT = 30;
const BAR_HEIGHT = 3;
const CPU_COLUMN = 104;
const RAM_COLUMN = 120;
const NUMBER_WIDTH = 52;
const VERDICT_ROW_HEIGHT = 34;
const STATE_COLUMN = 48;
const CHART_SLOTS = 120;
const CHART_SPAN_MS = 10 * 60000;
const CHART_HEADROOM_PCT = 8;
const CHART_GRID_LEVELS = [25, 50, 75];
const AREA_TOP_ALPHA = "44";
const TINT_ALPHA = "14";
const TINT_BORDER_ALPHA = "50";
const HOT_PCT = 85;
const WARM_PCT = 60;
const STATE_WORD = { [STATE.ok]: "OK", [STATE.tight]: "Tight", [STATE.wait]: "Wait" };

const stateColor = (t, state) => ({ [STATE.ok]: t.ansi2, [STATE.tight]: t.ansi3, [STATE.wait]: t.blocked })[state];
const heatColor = (t, pct) => (pct >= HOT_PCT ? t.blocked : pct >= WARM_PCT ? t.ansi3 : t.accent);

const dot = (color, size = 6) => div().size(size).flex_none().rounded(size / 2).bg(color);

function sectionTitle(t, text, note) {
  return h_flex().flex_none().h(18).items_center().gap(8).text_size(11).text_color(t.dim)
    .child(div().flex_none().font_medium().child(text))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().font_family(NUMBER_FONT).text_size(10.5).child(note ?? "")));
}

// Coordinates are percent of the plot, so the curve follows the card as the window resizes.
const percentOf = (n) => `${n.toFixed(2)}%`;
const plotHeight = (pct) => CHART_HEADROOM_PCT + (100 - CHART_HEADROOM_PCT) * (1 - Math.min(100, Math.max(0, pct)) / 100);

// Right edge is now: the line grows from there, so time keeps its place while history builds up.
function chartPoints(history, now, pctOf) {
  const slotMs = CHART_SPAN_MS / CHART_SLOTS;
  const slots = new Map();
  for (const h of history) {
    const slot = CHART_SLOTS - 1 - Math.floor((now - h.at) / slotMs);
    if (slot >= 0 && slot < CHART_SLOTS) slots.set(slot, Math.max(slots.get(slot) ?? 0, pctOf(h)));
  }
  return [...slots].sort(([a], [b]) => a - b).map(([slot, pct]) => ({ x: (100 * slot) / (CHART_SLOTS - 1), y: plotHeight(pct) }));
}

// A curve through the midpoints, with each reading as its control: sharp samples read as a trend.
function traceCurve(path, points) {
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    path = path.curve_to(percentOf((from.x + to.x) / 2), percentOf((from.y + to.y) / 2), percentOf(from.x), percentOf(from.y));
  }
  const last = points.at(-1);
  return path.line_to(percentOf(last.x), percentOf(last.y));
}

const linePath = (points) => traceCurve(PathBuilder.stroke(1.5).move_to(percentOf(points[0].x), percentOf(points[0].y)), points).build();

function areaPath(points) {
  const first = points[0];
  const start = PathBuilder.fill().move_to(percentOf(first.x), "100%").line_to(percentOf(first.x), percentOf(first.y));
  return traceCurve(start, points).line_to(percentOf(points.at(-1).x), "100%").close().build();
}

function gridPath() {
  let path = PathBuilder.stroke(1).dash_array([2, 5]);
  for (const level of CHART_GRID_LEVELS) path = path.move_to("0%", percentOf(plotHeight(level))).line_to("100%", percentOf(plotHeight(level)));
  return path.build();
}

const pathLayer = (path, fill) => window.paint_path(path, fill).absolute().top(0).left(0).size_full();

function plot(t, id, points, color, signalXs) {
  const box = div().id(id).relative().flex_1().min_h(0).overflow_hidden().child(pathLayer(gridPath(), t.border));
  if (points.length < 2) return box;
  return box
    .child(pathLayer(areaPath(points), Background.linear_gradient(180, color + AREA_TOP_ALPHA, `${color}00`)))
    .child(pathLayer(linePath(points), color))
    .children(signalXs.map((x) => div().absolute().top(0).bottom(0).left(percentOf(x)).w(1).bg(t.blocked)));
}

const timeAxis = (t) => h_flex().flex_none().justify_between().px(14).pt(4).pb(8).font_family(NUMBER_FONT).text_size(10).text_color(t.dim).child("10m").child("now");

function meterCard(t, id, label, detail, value, unit, plotEl) {
  return v_flex().id(id).flex_1().min_w(0).rounded(CARD_RADIUS).border(1).border_color(t.border).bg(t.background).overflow_hidden()
    .child(v_flex().flex_none().gap(2).px(14).pt(12)
      .child(h_flex().justify_between().items_center().gap(8).text_size(11).text_color(t.dim)
        .child(div().flex_none().font_medium().child(label))
        .child(div().min_w(0).truncate().font_family(NUMBER_FONT).text_size(10.5).child(detail)))
      .child(h_flex().items_baseline().gap(5).font_family(NUMBER_FONT)
        .child(div().flex_none().text_size(HERO_SIZE).text_color(t.foreground).child(value))
        .child(div().flex_none().text_size(12).text_color(t.muted).child(unit))))
    .child(plotEl)
    .child(timeAxis(t));
}

function machineMeters(t, a) {
  const now = Date.now();
  const usedPct = (h) => 100 * (1 - h.freeGb / a.ram.totalGb);
  const signalXs = a.signals.map((s) => 100 * (1 - (now - s.at) / CHART_SPAN_MS)).filter((x) => x >= 0);
  const cpuPlot = plot(t, "plot-cpu", chartPoints(a.history, now, (h) => h.cpu), heatColor(t, a.cpu.now), []);
  const ramPlot = plot(t, "plot-ram", chartPoints(a.history, now, usedPct), heatColor(t, 100 * (1 - a.ram.freeGb / a.ram.totalGb)), signalXs);
  return h_flex().flex_1().min_h(METER_MIN_HEIGHT).items_stretch().gap(10)
    .child(meterCard(t, "meter-cpu", "CPU", `${Math.round(a.cpu.average)}% over 2m`, String(Math.round(a.cpu.now)), "% in use", cpuPlot))
    .child(meterCard(t, "meter-ram", "Memory", `peak ${(a.ram.totalGb - a.ram.lowestGb).toFixed(1)} GB in 10m`, (a.ram.totalGb - a.ram.freeGb).toFixed(1), `GB used of ${Math.round(a.ram.totalGb)}`, ramPlot));
}

function alertBanner(t, id, tooltip, text) {
  return h_flex().id(id).flex_none().h(30).px(12).gap(8).items_center().rounded(CARD_RADIUS).border(1).border_color(t.blocked + TINT_BORDER_ALPHA).bg(t.blocked + TINT_ALPHA)
    .text_size(12).text_color(t.blocked).tooltip(tooltip)
    .child(dot(t.blocked))
    .child(div().flex_1().min_w(0).truncate().child(text));
}

function signalBanner(t, a) {
  const worst = a.signal.freeGb != null ? `, ${a.signal.freeGb.toFixed(1)} GB free then` : "";
  const today = a.signals.length > 1 ? ` · ${a.signals.length} in 24h` : "";
  const tooltip = "Windows signalled low memory. Claude Code stops background commands on this signal once a session has been idle 30m, even if RAM reads free a moment later.";
  return alertBanner(t, "low-memory-signal", tooltip, `Low memory signal ${clock(a.signal.at)}${worst}${today}`);
}

function stuckBanner(t, p) {
  const since = p.started ? ` since ${clock(p.started)}` : "";
  const tooltip = `Process ${p.id}${p.session ? ` in ${p.session}` : ", no session"}. Holding a core for minutes usually means a loop nobody is watching.`;
  return alertBanner(t, `stuck-${p.id}`, tooltip, `Stuck? ${p.name} ${p.id}: ${p.cores.toFixed(1)} core${since}`);
}

function jobName(t, row) {
  return h_flex().id(`job-${row.id}`).flex_none().gap(5).items_center().tooltip(row.tooltip)
    .child(div().flex_none().text_size(12.5).text_color(t.foreground).child(row.name))
    .when(Boolean(row.note), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(row.note)));
}

function verdictRow(t, group, isFirst) {
  const color = stateColor(t, group.state);
  const isOk = group.state === STATE.ok;
  return h_flex().id(`verdict-${group.rows[0].id}`).flex_none().h(VERDICT_ROW_HEIGHT).px(12).gap(12).items_center()
    .when(!isOk, (el) => el.bg(color + TINT_ALPHA))
    .when(!isFirst, (el) => el.border_t(1).border_color(t.border))
    .child(h_flex().w(STATE_COLUMN).flex_none().gap(6).items_center().text_size(11)
      .child(dot(color))
      .child(div().flex_none().font_medium().text_color(color).child(STATE_WORD[group.state])))
    .child(h_flex().flex_none().gap(14).items_center().children(group.rows.map((row) => jobName(t, row))))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().text_size(11.5).text_color(color).child(isOk ? "" : group.why)));
}

function canIRun(t, a) {
  const groups = verdictGroups(a.rows);
  return v_flex().flex_none().gap(6)
    .child(sectionTitle(t, "Can I run", `${a.room.cores.toFixed(1)} cores · ${a.room.ramGb.toFixed(1)} GB spare`))
    .child(v_flex().flex_none().rounded(CARD_RADIUS).border(1).border_color(t.border).bg(t.background).overflow_hidden()
      .children(groups.map((group, i) => verdictRow(t, group, i === 0))))
    .when(Boolean(a.advice), (el) => el.child(div().flex_none().truncate().text_size(11.5).text_color(t.accent).child(a.advice)));
}

function usageCell(t, width, share, text) {
  return h_flex().w(width).flex_none().gap(8).items_center()
    .child(div().flex_1().min_w(0).h(BAR_HEIGHT).rounded(1).bg(t.border)
      .child(div().h(BAR_HEIGHT).rounded(1).bg(heatColor(t, share)).w(`${Math.min(100, Math.max(share >= 0.5 ? 3 : 0, share))}%`)))
    .child(div().w(NUMBER_WIDTH).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_size(11.5).text_color(t.muted).child(text));
}

function consumerTooltip(c) {
  const running = `${c.count} ${c.count === 1 ? "process" : "processes"} running${c.isSession ? " in this session" : ""}`;
  const shortLived = c.shortLivedCpu >= 1 ? `. ${Math.round(c.shortLivedCpu)}% CPU from processes that started and ended since the last reading` : "";
  return `${running}${shortLived}`;
}

function consumerRow(t, c, totalGb, isFirst) {
  return h_flex().id(`consumer-${c.name}`).flex_none().h(CONSUMER_ROW_HEIGHT).px(12).gap(14).items_center().hover((s) => s.bg(t.raised))
    .when(!isFirst, (el) => el.border_t(1).border_color(t.border))
    .tooltip(consumerTooltip(c))
    .child(h_flex().flex_1().min_w(0).gap(6).items_center()
      .child(div().min_w(0).truncate().text_size(12.5).text_color(c.isSession ? t.foreground : t.muted).child(c.name))
      .when(Boolean(c.mostly), (el) => el.child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(c.mostly))))
    .child(usageCell(t, CPU_COLUMN, c.cpu, `${Math.round(c.cpu)}%`))
    .child(usageCell(t, RAM_COLUMN, (100 * c.ramGb) / totalGb, `${c.ramGb.toFixed(1)} GB`));
}

function consumerList(t, a) {
  if (!a.consumers.length) return sectionTitle(t, "Top consumers", "Nothing heavy running");
  return v_flex().flex_none().gap(6)
    .child(sectionTitle(t, "Top consumers", "CPU · RAM"))
    .child(v_flex().flex_none().rounded(CARD_RADIUS).border(1).border_color(t.border).bg(t.background).overflow_hidden()
      .children(a.consumers.map((c, i) => consumerRow(t, c, a.ram.totalGb, i === 0))));
}

export function hardwareMonitor(t, analysis, leading) {
  const panel = v_flex().flex_1().min_w(0).p(10).gap(SECTION_GAP).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden();
  const title = (status) => h_flex().h(22).flex_none().gap(10).items_center()
    .child(leading).child(div().flex_none().text_size(12).font_medium().text_color(t.foreground).child("Hardware Monitor"))
    .child(h_flex().flex_1().min_w(0).gap(6).items_center().justify_end().text_size(12).children(status));
  if (!analysis) return panel.child(title([div().text_color(t.dim).child("Measuring the machine…")]));
  const { isBad, text } = analysis.headline;
  const hasAlerts = Boolean(analysis.signal) || analysis.stuck.length > 0;
  const statusColor = isBad ? t.blocked : t.ansi2;
  return panel
    .child(title([dot(statusColor), div().min_w(0).truncate().text_color(isBad ? t.blocked : t.muted).child(analysis.signal ? "Low memory" : text)]))
    .when(hasAlerts, (el) => el.child(v_flex().flex_none().gap(6)
      .when(Boolean(analysis.signal), (box) => box.child(signalBanner(t, analysis)))
      .children(analysis.stuck.map((p) => stuckBanner(t, p)))))
    .child(machineMeters(t, analysis))
    .child(canIRun(t, analysis))
    .child(consumerList(t, analysis));
}
