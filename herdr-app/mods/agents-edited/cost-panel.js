// The Cost panel, in the place of the Context Window Map: the median cost per task over a sliding
// week, the spread around it, and the repositories to narrow it to.

import { PathBuilder, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { ALL_REPOS } from "./cost-analysis.js";

const NUMBER_FONT = "Geist Mono";
const SECTION_GAP = 12;
const CARD_RADIUS = 8;
const HERO_SIZE = 28;
const CHART_MIN_HEIGHT = 160;
const AXIS_WIDTH = 44;
const AXIS_LABEL_HEIGHT = 12;
const BAND_ALPHA = "2e";
const ROW_GAP = 8;
const REPO_ROW_HEIGHT = 30;
// Eight whole rows and the border.
const REPOS_MAX_HEIGHT = 242;
const BAR_HEIGHT = 3;
// "$100.00" and "999 tasks" in Geist Mono 11.5px.
const COST_WIDTH = 50;
const COUNT_WIDTH = 64;
const GLYPH_PX = 7;
const NAME_COLUMN_MAX = 220;
const ICON_SIZE = 13;
// Its middle on the last rows of the usage panel and the Notes composer beside it.
const FOOTER_HEIGHT = 48;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AXIS_STEPS = [1, 2, 2.5, 5, 10];

const dollars = (n) => `$${n.toFixed(2)}`;
const dayText = (at) => `${MONTHS[new Date(at).getMonth()]} ${new Date(at).getDate()}`;
const repoName = (repo) => (repo === ALL_REPOS ? "All repositories" : repo);
const tasksText = (n) => `${n} ${n === 1 ? "task" : "tasks"}`;

function changeText(pct) {
  if (pct === null) return "—";
  if (pct === 0) return "Flat";
  return `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}%`;
}

// The axis' top: two round steps that hold the highest value.
function axisTop(highest) {
  const half = Math.max(highest, 0.01) / 2;
  const unit = 10 ** Math.floor(Math.log10(half));
  return 2 * unit * AXIS_STEPS.find((step) => step * unit >= half);
}

// Coordinates are percent of the plot, so the curve follows the card as the window resizes.
const percentOf = (n) => `${n.toFixed(2)}%`;
const pathLayer = (path, fill) => window.paint_path(path, fill).absolute().top(0).left(0).size_full();

const plotPoints = (points, top, field) => points.map((p) => [percentOf(100 * p.share), percentOf(100 * (1 - p[field] / top))]);

function linePath([first, ...others]) {
  return others.reduce((path, [x, y]) => path.line_to(x, y), PathBuilder.stroke(1.75).move_to(...first)).build();
}

const bandPath = (lows, highs) => PathBuilder.fill().add_polygon([...highs, ...lows.toReversed()], true).build();

const gridPath = () => ["0%", "50%", "100%"].reduce((path, y) => path.move_to("0%", y).line_to("100%", y), PathBuilder.stroke(1)).build();

function axis(t, top) {
  const label = (text) => div().h(AXIS_LABEL_HEIGHT).flex().items_center().font_family(NUMBER_FONT).text_size(10).text_color(t.dim).child(text);
  return v_flex().w(AXIS_WIDTH).flex_none().justify_between()
    .child(label(dollars(top))).child(label(dollars(top / 2))).child(label(dollars(0)));
}

function chart(t, { points }) {
  const card = v_flex().id("cost-chart").flex_1().min_h(CHART_MIN_HEIGHT).p(12).gap(6).rounded(CARD_RADIUS).border(1).border_color(t.border).bg(t.background).overflow_hidden();
  if (points.length < 2) return card.items_center().justify_center().child(div().text_size(12).text_color(t.dim).child("Too few finished tasks for a chart."));
  const top = axisTop(Math.max(...points.map((p) => p.high)));
  // Half an axis label of padding puts the grid lines on the labels' middles.
  const plot = div().flex_1().min_w(0).py(AXIS_LABEL_HEIGHT / 2)
    .child(div().relative().size_full()
      .child(pathLayer(gridPath(), t.border))
      .child(pathLayer(bandPath(plotPoints(points, top, "low"), plotPoints(points, top, "high")), t.accent + BAND_ALPHA))
      .child(pathLayer(linePath(plotPoints(points, top, "median")), t.accent)));
  return card
    .child(h_flex().flex_1().min_h(0).items_stretch().child(axis(t, top)).child(plot))
    .child(h_flex().flex_none().pl(AXIS_WIDTH).justify_between().font_family(NUMBER_FONT).text_size(10).text_color(t.dim).child("30d ago").child("now"));
}

function title(t, analysis, leading) {
  // As tall as the summary strip and the Notes header, so the first rows share a line.
  return h_flex().h(30).flex_none().gap(10).items_center()
    .child(leading)
    .child(div().flex_none().text_size(12).font_medium().text_color(t.foreground).child("Cost per task"))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().text_size(12).text_color(t.muted).child(analysis ? repoName(analysis.repo) : "")));
}

function figure(t, label, value, note, isFirst) {
  return v_flex().flex_1().min_w(0).gap(2)
    .when(!isFirst, (el) => el.pl(12).border_l(1).border_color(t.border))
    .child(div().text_size(11).text_color(t.dim).child(label))
    .child(div().truncate().font_family(NUMBER_FONT).text_size(HERO_SIZE).text_color(t.foreground).child(value))
    .child(div().truncate().text_size(11.5).text_color(t.dim).child(note));
}

function figures(t, { first, last, changePct }) {
  return h_flex().flex_none().gap(12).items_stretch()
    .child(figure(t, "Median now", last ? dollars(last.median) : "—", last ? `${tasksText(last.count)} in the last 7 days` : "under 3 tasks in 7 days", true))
    .child(figure(t, "At the start", first ? dollars(first.median) : "—", first ? `week ending ${dayText(first.at)}` : "no week with 3 tasks", false))
    .child(figure(t, "Change", changeText(changePct), "over the period shown", false));
}

function sectionTitle(t, text, note) {
  return h_flex().flex_none().h(18).items_center().gap(8).text_size(11).text_color(t.dim)
    .child(div().flex_none().font_medium().child(text))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().font_family(NUMBER_FONT).text_size(10.5).child(note)));
}

const figureCell = (t, width, text) => div().w(width).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_size(11.5).text_color(t.muted).child(text);

function repoRow(t, cost, row, isLit, highest, column, isFirst) {
  const share = (100 * row.median) / highest;
  return h_flex().id(`cost-repo-${row.repo}`).flex_none().h(REPO_ROW_HEIGHT).px(12).gap(ROW_GAP).items_center().cursor_pointer()
    .bg(isLit ? t.selected : t.background)
    .hover((s) => s.bg(t.raised))
    .when(!isFirst, (el) => el.border_t(1).border_color(t.border))
    .on_click((_e, cx) => cost.pick(row.repo, cx))
    .child(div().w(column).flex_none().truncate().text_size(12.5).text_color(isLit ? t.foreground : t.muted).child(repoName(row.repo)))
    .child(div().flex_1().min_w(0).h(BAR_HEIGHT).rounded(1).bg(t.border)
      .child(div().h(BAR_HEIGHT).rounded(1).bg(t.accent).w(`${Math.max(1, share)}%`)))
    .child(figureCell(t, COST_WIDTH, dollars(row.median)))
    .child(figureCell(t, COUNT_WIDTH, tasksText(row.count)));
}

function repoList(t, cost, { repo, repos }) {
  if (!repos.length) return div();
  const highest = Math.max(...repos.map((r) => r.median));
  const column = Math.min(NAME_COLUMN_MAX, Math.max(...repos.map((r) => repoName(r.repo).length * GLYPH_PX)));
  return v_flex().flex_none().gap(6)
    .child(sectionTitle(t, "Repositories", "median · tasks, 30 days"))
    .child(v_flex().id("cost-repos").max_h(REPOS_MAX_HEIGHT).rounded(CARD_RADIUS).border(1).border_color(t.border).bg(t.background).overflow_y_scrollbar()
      .children(repos.map((row, i) => repoRow(t, cost, row, row.repo === repo, highest, column, i === 0))));
}

function footer(t, analysis) {
  const unpriced = analysis?.unpriced ? ` ${tasksText(analysis.unpriced)} with no estimate left out.` : "";
  const text = `API list prices, one task per Claude Code session. Band: the middle half.${unpriced}`;
  return h_flex().flex_none().h(FOOTER_HEIGHT).px(12).gap(8).items_center().border_t(1).border_color(t.border)
    .child(svg("mods/agents-edited/icons/cost.svg").size(ICON_SIZE).flex_none().text_color(t.accent))
    .child(div().id("cost-footer").flex_1().min_w(0).truncate().text_size(12).text_color(t.muted).tooltip("Subagents count in their session; headless runs (claude -p) are left out.").child(text));
}

export function costPanel(t, cost, leading, cx) {
  cost.wanted(cx);
  const analysis = cost.analysis();
  const waiting = cost.hasFailed ? "The last reading failed; trying again in a minute." : "Reading the transcripts. The first time takes about half a minute.";
  return v_flex().flex_1().min_w(0).rounded(8).border(1).border_color(t.border).bg(t.surface).overflow_hidden()
    .child(v_flex().flex_1().min_h(0).px(12).pb(12).gap(SECTION_GAP)
      .child(title(t, analysis, leading))
      .when(!analysis, (el) => el.child(div().text_size(12).text_color(t.dim).child(waiting)))
      .when(Boolean(analysis), (el) => el.child(figures(t, analysis)).child(chart(t, analysis)).child(repoList(t, cost, analysis))))
    .child(footer(t, analysis));
}
