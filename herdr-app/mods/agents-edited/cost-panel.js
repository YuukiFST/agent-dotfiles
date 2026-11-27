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
const REPOS_VISIBLE = 8;
const BAR_HEIGHT = 3;
// "$100.00" and "1000 tasks" in Geist Mono 11.5px.
const COST_WIDTH = 50;
const COUNT_WIDTH = 70;
const GLYPH_PX = 7;
const NAME_COLUMN_MAX = 220;
const REPOS_TITLE = "Repositories";
const ICON_SIZE = 13;
const CHECKBOX_SIZE = 13;
// Its middle on the last rows of the usage panel and the Notes composer beside it.
const FOOTER_HEIGHT = 48;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const AXIS_STEPS = [1, 2, 2.5, 5, 10];

const dollars = (n) => `$${n.toFixed(2)}`;
const dayText = (at) => `${MONTHS[new Date(at).getMonth()]} ${new Date(at).getDate()}`;
const repoName = (repo, hasHidden) => (repo !== ALL_REPOS ? repo : hasHidden ? "Selected repositories" : "All repositories");
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

const hasHidden = ({ choices }) => choices.some((choice) => choice.isHidden);

function title(t, analysis, leading) {
  // As tall as the summary strip and the Notes header, so the first rows share a line.
  return h_flex().h(30).flex_none().gap(10).items_center()
    .child(leading)
    .child(div().flex_none().text_size(12).font_medium().text_color(t.foreground).child("Cost per task"))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().text_size(12).text_color(t.muted).child(analysis ? repoName(analysis.repo, hasHidden(analysis)) : "")));
}

function figure(t, label, value, note, isFirst) {
  return v_flex().flex_1().min_w(0).gap(2)
    .when(!isFirst, (el) => el.pl(12).border_l(1).border_color(t.border))
    .child(div().text_size(11).text_color(t.dim).child(label))
    .child(div().truncate().font_family(NUMBER_FONT).text_size(HERO_SIZE).text_color(t.foreground).child(value))
    .child(div().truncate().text_size(11.5).text_color(t.dim).child(note));
}

function figures(t, { first, last, changePct }) {
  const since = first ? `since the week ending ${dayText(first.at)}` : "over the period shown";
  return h_flex().flex_none().gap(12).items_stretch()
    .child(figure(t, "Median now", last ? dollars(last.median) : "—", last ? `${tasksText(last.count)} in the last 7 days` : "under 3 tasks in 7 days", true))
    .child(figure(t, "At the start", first ? dollars(first.median) : "—", first ? `week ending ${dayText(first.at)}` : "no week with 3 tasks", false))
    .child(figure(t, "Change", changeText(changePct), since, false));
}

function sectionTitle(t, text, note) {
  return h_flex().flex_none().h(18).items_center().gap(8).text_size(11).text_color(t.dim)
    .child(div().flex_none().font_medium().child(text))
    .child(div().flex_1().min_w(0).flex().justify_end().child(div().truncate().child(note)));
}

const figureCell = (t, width, text) => div().w(width).flex_none().flex().justify_end().font_family(NUMBER_FONT).text_size(11.5).text_color(t.muted).child(text);

function chooseButton(t, cost) {
  return h_flex().id("cost-choose").flex_none().px(6).mr_neg_1p5().h(18).items_center().rounded(4).cursor_pointer()
    .text_size(11).text_color(cost.isChoosing ? t.accent : t.muted).hover((s) => s.text_color(t.foreground))
    .tooltip("Choose which repositories show and count in the totals")
    .on_click((_e, cx) => cost.toggleChoosing(cx))
    .child(cost.isChoosing ? "Done" : "Choose");
}

function checkbox(t, isOn) {
  return div().size(CHECKBOX_SIZE).flex_none().flex().items_center().justify_center().rounded(3).border(1).border_color(isOn ? t.accent : t.dim)
    .when(isOn, (el) => el.child(div().size(7).rounded(1).bg(t.accent)));
}

// The list bleeds to the panel's border like the Sessions rows; each row's padding puts its text
// back on the inset line.
const listRow = (t, id) => h_flex().id(id).flex_none().h(REPO_ROW_HEIGHT).px(12).gap(ROW_GAP).items_center().cursor_pointer()
  .hover((s) => s.bg(t.raised)).border_t(1).border_color(t.border);

// The counts end on the tasks column of the default view, so switching views moves no figure.
function choiceRow(t, cost, choice, column) {
  const isShown = !choice.isHidden;
  return listRow(t, `cost-choice-${choice.repo}`)
    .on_click((_e, cx) => cost.toggleHidden(choice.repo, cx))
    .child(checkbox(t, isShown))
    .child(div().id(`cost-choice-name-${choice.repo}`).w(column).flex_none().truncate().text_size(12.5).text_color(isShown ? t.foreground : t.dim).tooltip(choice.repo).child(choice.repo))
    .child(div().flex_1())
    .child(figureCell(t, COUNT_WIDTH, tasksText(choice.count)));
}

function repoRow(t, cost, row, name, isLit, highest, column) {
  const share = (100 * row.median) / highest;
  return listRow(t, `cost-repo-${row.repo}`)
    .when(isLit, (el) => el.bg(t.selected))
    .on_click((_e, cx) => cost.pick(row.repo, cx))
    .child(div().id(`cost-repo-name-${row.repo}`).w(column).flex_none().truncate().text_size(12.5).text_color(isLit ? t.foreground : t.muted).tooltip(name).child(name))
    .child(div().flex_1().min_w(0).h(BAR_HEIGHT).rounded(1).bg(t.border)
      .child(div().h(BAR_HEIGHT).rounded(1).bg(t.accent).w(`${Math.max(1, share)}%`)))
    .child(figureCell(t, COST_WIDTH, dollars(row.median)))
    .child(figureCell(t, COUNT_WIDTH, tasksText(row.count)));
}

const nameColumn = (names) => Math.min(NAME_COLUMN_MAX, Math.max(REPOS_TITLE.length * GLYPH_PX, ...names.map((name) => name.length * GLYPH_PX)));

function repoRows(t, cost, analysis, column) {
  const { repo, repos, choices } = analysis;
  if (cost.isChoosing) return choices.map((choice) => choiceRow(t, cost, choice, column));
  const highest = Math.max(...repos.map((r) => r.median));
  return repos.map((row) => repoRow(t, cost, row, repoName(row.repo, hasHidden(analysis)), row.repo === repo, highest, column));
}

// Built with the rows' own columns, so "median" and "tasks" sit over their figures.
function repoHeader(t, cost, column, note) {
  const label = (width, text) => div().w(width).flex_none().flex().justify_end().child(text);
  return h_flex().flex_none().h(18).gap(ROW_GAP).items_center().text_size(11).text_color(t.dim)
    .child(div().w(column).flex_none().font_medium().child(REPOS_TITLE))
    .child(h_flex().flex_1().min_w(0).gap(8).items_center().justify_end().child(div().truncate().child(note)).child(chooseButton(t, cost)))
    .child(label(COST_WIDTH, "median"))
    .child(label(COUNT_WIDTH, "tasks"));
}

function repoList(t, cost, analysis) {
  if (!analysis.choices.length) return div();
  const names = cost.isChoosing ? analysis.choices.map((c) => c.repo) : analysis.repos.map((r) => repoName(r.repo, hasHidden(analysis)));
  const column = nameColumn(names);
  const rows = repoRows(t, cost, analysis, column);
  const hiddenCount = analysis.choices.filter((choice) => choice.isHidden).length;
  const hidden = hiddenCount ? ` · ${hiddenCount} hidden` : "";
  const header = cost.isChoosing
    ? sectionTitle(t, REPOS_TITLE, `click to show or hide${hidden}`).child(chooseButton(t, cost))
    : repoHeader(t, cost, column, `last 30 days${hidden}`);
  // A scroll area needs a set height: under max_h it cuts its rows off and never scrolls. While
  // choosing, the list takes the chart's place.
  const visible = cost.isChoosing ? rows.length : Math.min(rows.length, REPOS_VISIBLE);
  return v_flex().gap(6)
    .when(cost.isChoosing, (el) => el.flex_1().min_h(0))
    .when(!cost.isChoosing, (el) => el.flex_none())
    .child(header)
    .when(rows.length > 0, (el) => el.child(v_flex().id("cost-repos").mx_neg_3().h(visible * REPO_ROW_HEIGHT).flex_shrink(1).min_h(0).overflow_y_scrollbar()
      .children(rows)));
}

function footer(t, analysis) {
  const unpriced = analysis?.unpriced ? ` ${tasksText(analysis.unpriced)} with no estimate left out.` : "";
  const text = `API list prices, one task per Claude Code session. Band: the middle half.${unpriced}`;
  return h_flex().flex_none().h(FOOTER_HEIGHT).px(12).gap(8).items_center().border_t(1).border_color(t.border)
    .child(svg("mods/agents-edited/icons/cost.svg").size(ICON_SIZE).flex_none().text_color(t.muted))
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
      .when(Boolean(analysis), (el) => el.child(figures(t, analysis)).when(!cost.isChoosing, (box) => box.child(chart(t, analysis))).child(repoList(t, cost, analysis))))
    .child(footer(t, analysis));
}
