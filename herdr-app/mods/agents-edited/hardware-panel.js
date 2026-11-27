// The Hardware Monitor, in the place of the Context Window Map: how busy the machine is, what is
// stuck, and what uses the most. Only what can be acted on: Windows's own processes never show.

import { Background, PathBuilder, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { clock } from "./hardware-analysis.js";

const NUMBER_FONT = "Geist Mono";
const SECTION_GAP = 14;
const CARD_RADIUS = 8;
const METER_MIN_HEIGHT = 136;
const HERO_SIZE = 28;
const CONSUMER_ROW_HEIGHT = 30;
const BAR_HEIGHT = 3;
// As wide as the column's widest figure ("100%", "10.0 GB"), so each figure sits by its bar.
const CPU_FIGURE_WIDTH = 30;
const RAM_FIGURE_WIDTH = 50;
const ROW_GAP = 12;
const NOTE_GAP = 6;
// A text's width estimated from its length: the 12.5px UI font averages ~6.3px a glyph, and the
// estimate rounds up so a name fits; the name truncates if one ever runs longer.
const GLYPH_PX = 7;
const NAME_COLUMN_MAX = 260;
const CONSUMERS_TITLE = "Top consumers";
const CHART_SLOTS = 120;
const CHART_SPAN_MS = 10 * 60000;
const CHART_HEADROOM_PCT = 8;
const CHART_GRID_LEVELS = [25, 50, 75];
const AREA_TOP_ALPHA = "44";
const TINT_ALPHA = "14";
const TINT_BORDER_ALPHA = "50";
// The same thresholds as the plan gauges and the footer meters, so one reading has one color.
const HOT_PCT = 90;
const WARM_PCT = 70;

const heatColor = (t, pct) => (pct >= HOT_PCT ? t.blocked : pct >= WARM_PCT ? t.ansi3 : t.accent);

const dot = (color, size = 6) => div().size(size).flex_none().rounded(size / 2).bg(color);

function sectionTitle(t, text, note) {
  return h_flex().flex_none().h(18).items_center().gap(8).text_size(11).text_color(t.dim)
    .child(div().flex_none().font_medium().child(text))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().child(note ?? "")));
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

const timeAxis = (t) => h_flex().flex_none().justify_between().px(12).pt(4).pb(8).font_family(NUMBER_FONT).text_size(10).text_color(t.dim).child("10m").child("now");

function meterCard(t, id, label, detail, value, unit, plotEl) {
  return v_flex().id(id).flex_1().min_w(0).rounded(CARD_RADIUS).border(1).border_color(t.border).bg(t.background).overflow_hidden()
    .child(v_flex().flex_none().gap(2).px(12).pt(12)
      .child(h_flex().justify_between().items_center().gap(8).text_size(11).text_color(t.dim)
        .child(div().flex_none().font_medium().child(label))
        .child(div().min_w(0).truncate().child(detail)))
      .child(h_flex().items_baseline().gap(6)
        .child(div().flex_none().font_family(NUMBER_FONT).text_size(HERO_SIZE).text_color(t.foreground).child(value))
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
    .child(meterCard(t, "meter-cpu", "CPU", `${Math.round(a.cpu.average)}% over 2m`, `${Math.round(a.cpu.now)}%`, "in use", cpuPlot))
    .child(meterCard(t, "meter-ram", "Memory", `peak ${(a.ram.totalGb - a.ram.lowestGb).toFixed(1)} GB in 10m`, `${(a.ram.totalGb - a.ram.freeGb).toFixed(1)} GB`, `of ${Math.round(a.ram.totalGb)} GB used`, ramPlot));
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
  return alertBanner(t, `stuck-${p.id}`, tooltip, `Stuck? ${p.name} ${p.id}: ${p.cores.toFixed(1)} cores${since}`);
}

const textWidth = (text) => (text ? text.length * GLYPH_PX : 0);
const consumerWidth = (c) => textWidth(c.name) + (c.mostly ? NOTE_GAP + textWidth(c.mostly) : 0);

// The consumers' name column, as wide as the longest name or the column's own header: the bars
// start right after the names.
function nameColumn(a) {
  const widest = Math.max(textWidth(CONSUMERS_TITLE), ...a.consumers.map(consumerWidth));
  return Math.min(NAME_COLUMN_MAX, Math.ceil(widest));
}

// Grows with the row, so the space beside a name is bar, not a gap.
function usageCell(t, share, text, figureWidth) {
  return h_flex().flex_1().min_w(0).gap(8).items_center()
    .child(div().flex_1().min_w(0).h(BAR_HEIGHT).rounded(1).bg(t.border)
      .child(div().h(BAR_HEIGHT).rounded(1).bg(heatColor(t, share)).w(`${Math.min(100, Math.max(share >= 0.5 ? 3 : 0, share))}%`)))
    .child(div().w(figureWidth).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_size(11.5).text_color(t.muted).child(text));
}

function consumerTooltip(c) {
  const name = c.mostly ? `${c.name} (${c.mostly})` : c.name;
  const running = `${c.count} ${c.count === 1 ? "process" : "processes"} running${c.isSession ? " in this session" : ""}`;
  const shortLived = c.shortLivedCpu >= 1 ? `. ${Math.round(c.shortLivedCpu)}% CPU from processes that started and ended since the last reading` : "";
  return `${name}: ${running}${shortLived}`;
}

function consumerRow(t, c, totalGb, column) {
  return h_flex().id(`consumer-${c.name}`).flex_none().h(CONSUMER_ROW_HEIGHT).px(12).gap(ROW_GAP).items_center().hover((s) => s.bg(t.raised))
    .border_t(1).border_color(t.border)
    .tooltip(consumerTooltip(c))
    .child(h_flex().w(column).flex_none().min_w(0).gap(NOTE_GAP).items_center()
      .child(div().min_w(0).truncate().text_size(12.5).text_color(c.isSession ? t.foreground : t.muted).child(c.name))
      .when(Boolean(c.mostly), (el) => el.child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).child(c.mostly))))
    .child(usageCell(t, c.cpu, `${Math.round(c.cpu)}%`, CPU_FIGURE_WIDTH))
    .child(usageCell(t, (100 * c.ramGb) / totalGb, `${c.ramGb.toFixed(1)} GB`, RAM_FIGURE_WIDTH));
}

// The header names each figure column over its figures, built with the rows' own columns.
function consumerHeader(t, column) {
  const label = (width, text) => h_flex().flex_1().min_w(0).justify_end().child(div().w(width).flex_none().flex().justify_end().child(text));
  return h_flex().flex_none().h(18).gap(ROW_GAP).items_center().text_size(11).text_color(t.dim)
    .child(div().w(column).flex_none().font_medium().child(CONSUMERS_TITLE))
    .child(label(CPU_FIGURE_WIDTH, "CPU"))
    .child(label(RAM_FIGURE_WIDTH, "Memory"));
}

function consumerList(t, a, column) {
  if (!a.consumers.length) return sectionTitle(t, CONSUMERS_TITLE, "Nothing heavy running");
  return v_flex().flex_none().gap(6)
    .child(consumerHeader(t, column))
    // Bleeds to the panel's border like the Sessions rows; each row's padding puts its text back on
    // the inset line.
    .child(v_flex().flex_none().mx_neg_3().children(a.consumers.map((c) => consumerRow(t, c, a.ram.totalGb, column))));
}

export function hardwareMonitor(t, analysis, leading) {
  const panel = v_flex().flex_1().min_w(0).px(12).pb(12).gap(SECTION_GAP).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden();
  // As tall as the summary strip and the Notes header, so the first rows share a line.
  const title = (status) => h_flex().h(30).flex_none().gap(10).items_center()
    .child(leading).child(div().flex_none().text_size(12).font_medium().text_color(t.foreground).child("Hardware Monitor"))
    .child(h_flex().flex_1().min_w(0).gap(6).items_center().justify_end().text_size(12).children(status));
  if (!analysis) return panel.child(title([div().text_color(t.dim).child("Measuring the machine…")]));
  const { isBad, text } = analysis.headline;
  const hasAlerts = Boolean(analysis.signal) || analysis.stuck.length > 0;
  const statusColor = isBad ? t.blocked : t.ansi2;
  const column = nameColumn(analysis);
  return panel
    .child(title([dot(statusColor), div().min_w(0).truncate().text_color(isBad ? t.blocked : t.muted).child(analysis.signal ? "Low memory" : text)]))
    .when(hasAlerts, (el) => el.child(v_flex().flex_none().gap(6)
      .when(Boolean(analysis.signal), (box) => box.child(signalBanner(t, analysis)))
      .children(analysis.stuck.map((p) => stuckBanner(t, p)))))
    .child(machineMeters(t, analysis))
    .child(consumerList(t, analysis, column));
}
