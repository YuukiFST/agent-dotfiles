// The sidebar's Orchestration tab: crewmates grouped by what they need from the person, then the
// decisions waiting for them. Read-only: the person answers in the orchestrator's chat, which this
// tab shows in the work area, and the Orchestrator row above them goes to it.

import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { GROUPS, age, attentionOf, countText, detailOf, groupOf, progressOf } from "./roster.js";

const TINT_ALPHA = "14";
const BADGE_ALPHA = "26";
const AGE_WIDTH = 24;
// As wide as "10 of 10", so every card's step bar ends on one line down the list.
const STEPS_WIDTH = 44;
// More steps than this are drawn as this many pills: past it a pill is under 4px wide.
const MAX_PILLS = 20;
const DOT_SIZE = 6;
// A crewmate's lines start under its group's name: past the dot and one gap.
const CHILD_INDENT = DOT_SIZE + 8;
const PILL_HEIGHT = 6;
const BADGE_HEIGHT = 16;

// What waits for the person, for the tabs control's badge: { count, color }.
export function needsOf(t, roster, decisions, now) {
  const needing = roster.crew.filter((c) => groupOf(c, now) === "needs");
  const isBlocking = decisions.length > 0 || needing.some((c) => attentionOf(c, now) === "blocked");
  return { count: needing.length + decisions.length, color: isBlocking ? t.blocked : t.working };
}

function statusColor(t, c, now) {
  const attention = attentionOf(c, now);
  if (attention) return t[attention];
  return c.status === "running" ? t.working : t.dim;
}

function groupColor(t, groupId, members, now) {
  if (groupId === "running") return t.working;
  if (groupId === "finished") return t.dim;
  // Never blue: across the app blue says done, and this group asks for the person.
  return members.some((c) => attentionOf(c, now) === "blocked") ? t.blocked : t.working;
}

function badge(t, text, color) {
  return div().h(BADGE_HEIGHT).min_w(BADGE_HEIGHT).px(4).flex_none().flex().items_center().justify_center().rounded(BADGE_HEIGHT / 2)
    .bg(color + BADGE_ALPHA).text_color(color).text_size(10.5).font_medium().child(text);
}

function textAction(t, id, label, action) {
  // 2px plus its 6px padding: its glyphs sit one 8px gap after the text before it.
  return div().id(id).flex_none().ml(2).px(6).rounded(4).text_color(t.muted).cursor_pointer()
    .hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(action).child(label);
}

function stepBar(t, name, progress, color) {
  const shown = Math.min(progress.total, MAX_PILLS);
  const lit = Math.round((shown * progress.done) / progress.total);
  const pills = Array.from({ length: shown }, (_, i) =>
    div().flex_1().h(PILL_HEIGHT).rounded(1).bg(i < lit ? color : t.border));
  return h_flex().id(`crew-steps-${name}`).h(14).gap(6).items_center()
    .child(h_flex().flex_1().min_w(0).gap(2).items_center().children(pills))
    .child(div().w(STEPS_WIDTH).flex_none().flex().justify_end().font_family("Geist Mono").text_color(t.dim).child(`${progress.done} of ${progress.total}`));
}

function crewRow(t, c, now, actions) {
  const attention = attentionOf(c, now);
  const color = statusColor(t, c, now);
  const progress = progressOf(c.progress);
  const detail = detailOf(c);
  const isBright = c.status === "running" || Boolean(attention);
  const rowActions = [
    c.hasReport && textAction(t, `crew-report-${c.name}`, "Report", () => actions.openReport(c)),
    textAction(t, `crew-watch-${c.name}`, "Watch", () => actions.watch()),
  ].filter(Boolean);
  rowActions[rowActions.length - 1] = rowActions[rowActions.length - 1].mr_neg_1p5();
  return v_flex().id(`crew-${c.name}`).flex_none().pl(8 + CHILD_INDENT).pr(8).pb(6).rounded(8)
    // The left edge takes its 2px out of the padding, so the text stays on its line.
    .when(Boolean(attention), (el) => el.bg(color + TINT_ALPHA).border_l(2).border_color(color).pl(8 + CHILD_INDENT - 2))
    .child(h_flex().h(30).gap(8).items_center()
      .child(div().id(`crew-name-${c.name}`).flex_1().min_w(0).truncate().text_color(isBright ? t.foreground : t.muted).tooltip(c.name).child(c.name))
      .child(div().flex_none().text_size(11).font_medium().text_color(color).child(c.status))
      .when(c.spawnedMs !== null, (el) => el.child(div().w(AGE_WIDTH).flex_none().text_right().text_size(11).text_color(t.dim).child(age(now - c.spawnedMs)))))
    .child(v_flex().mt(-4).gap(3).text_size(11)
      .when(Boolean(progress.text), (el) => el.child(div().id(`crew-progress-${c.name}`).truncate().text_color(t.muted).tooltip(c.progress).child(progress.text)))
      .when(progress.total !== null, (el) => el.child(stepBar(t, c.name, progress, isBright ? color : t.muted)))
      .child(h_flex().items_center()
        .child(div().id(`crew-detail-${c.name}`).flex_1().min_w(0).truncate().text_color(t.dim).when(Boolean(detail), (el) => el.tooltip(detail)).child(detail))
        .children(rowActions)));
}

function groupRow(t, group, members, isOpen, now, toggle) {
  const color = groupColor(t, group.id, members, now);
  return h_flex().id(`crew-group-${group.id}`).flex_none().h(30).px(8).gap(8).items_center().rounded(8).cursor_pointer()
    .hover((s) => s.bg(t.hover)).on_click((_e, cx) => toggle(group.id, cx))
    .child(div().size(DOT_SIZE).flex_none().rounded_full().bg(color))
    .child(div().min_w(0).truncate().text_color(group.id === "finished" ? t.muted : t.foreground).child(group.name))
    .when(group.id === "needs", (el) => el.child(badge(t, "!", color)))
    .child(badge(t, String(members.length), t.muted))
    .child(div().flex_1())
    .child(svg(`mods/workspace-chrome/chevron-${isOpen ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim));
}

const ORCHESTRATOR_COLOR = { working: "working", blocked: "blocked", done: "done" };

// orchestrator: { status } of its running session (an agent status, null before it reports one),
// or null when its space is not there.
function orchestratorRow(t, orchestrator, actions) {
  if (!orchestrator) {
    return h_flex().id("crew-orchestrator").flex_none().h(30).px(8).gap(8).items_center()
      .child(div().size(DOT_SIZE).flex_none().rounded_full().bg(t.border))
      .child(div().min_w(0).truncate().text_color(t.muted).child("Orchestrator"))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(t.dim).child("Not running"))
      .child(textAction(t, "crew-orchestrator-start", "Start", () => actions.showOrchestrator()).mr_neg_1p5());
  }
  const color = t[ORCHESTRATOR_COLOR[orchestrator.status] ?? "dim"];
  return h_flex().id("crew-orchestrator").flex_none().h(30).px(8).gap(8).items_center().rounded(8).cursor_pointer()
    .hover((s) => s.bg(t.hover)).on_click(() => actions.showOrchestrator())
    .child(div().size(DOT_SIZE).flex_none().rounded_full().bg(color))
    .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child("Orchestrator"))
    .when(Boolean(orchestrator.status), (el) => el.child(div().flex_none().text_size(11).font_medium().text_color(color).child(orchestrator.status)));
}

function decisionBlock(t, d) {
  return v_flex().id(`crew-decision-${d.id}`).flex_none().pl(6).pb(8).gap(4)
    .child(div().pr(8).text_size(12.5).text_color(t.foreground).child(d.question))
    .when(Boolean(d.crewmate), (el) => el.child(div().id(`crew-decision-who-${d.id}`).pr(8).truncate().text_size(11).text_color(t.dim).tooltip(d.crewmate).child(d.crewmate)))
    .child(v_flex().gap(2).children(d.options.map((o, i) => v_flex().id(`crew-option-${d.id}-${i}`).px(8).py(5).rounded(6).gap(2)
      .when(o.isRecommended, (el) => el.bg(t.accent + TINT_ALPHA))
      // A label that wraps sends the tag to the next line instead of leaving it beside a block.
      .child(h_flex().flex_wrap().gap_x(6).items_center()
        .child(div().min_w(0).text_size(12).text_color(t.foreground).child(o.label))
        .when(o.isRecommended, (el) => el.child(div().flex_none().text_size(10.5).font_medium().text_color(t.accent).child("recommended"))))
      .when(Boolean(o.effect), (el) => el.child(div().text_size(11).text_color(t.muted).child(o.effect))))));
}

function decisionsSection(t, decisions) {
  // The badge counting these decisions is red; the list it counts says so in the same color.
  const color = t.blocked;
  return v_flex().id("crew-decisions").flex_none().mt(8).border_l(2).border_color(color)
    .child(h_flex().h(30).pl(6).gap(8).items_center().text_size(12).font_medium().text_color(color)
      .child(`Pending decisions (${decisions.length})`))
    .children(decisions.map((d) => decisionBlock(t, d)))
    .child(div().pl(6).pr(8).pb(4).text_size(11).text_color(t.dim).child("Answer in the orchestrator chat"));
}

// actions: { toggleGroup(id, cx), openReport(c), watch(), showOrchestrator() };
// openGroups: Set of the expanded group ids.
export function orchestrationPanel(t, { roster, decisions, orchestrator, now, isNarrow, openGroups, actions }) {
  const panel = v_flex().id("crew").size_full().min_h(0).bg(t.chrome).text_size(13);
  if (isNarrow) {
    return panel.child(h_flex().h(31).flex_none().items_center().justify_center().text_size(11).text_color(t.dim).child(countText(roster)));
  }
  const groups = GROUPS.map((g) => ({ group: g, members: roster.crew.filter((c) => groupOf(c, now) === g.id) }))
    .filter((g) => g.members.length > 0);
  const list = groups.flatMap(({ group, members }) => {
    const isOpen = openGroups.has(group.id);
    return [groupRow(t, group, members, isOpen, now, actions.toggleGroup), ...(isOpen ? members.map((c) => crewRow(t, c, now, actions)) : [])];
  });
  return panel
    .child(h_flex().h(31).pl(16).pr(16).flex_none().gap(6).items_center().text_size(12).font_medium().text_color(t.dim)
      .child("Orchestration")
      .child(div().text_color(t.muted).child(countText(roster))))
    .child(v_flex().id("crew-list").flex_1().min_h(0).px(8).pb(8).gap(2).overflow_y_scrollbar()
      .child(orchestratorRow(t, orchestrator, actions))
      .when(roster.crew.length === 0, (el) => el.child(div().px(8).text_size(12).text_color(t.dim).child("No crewmates")))
      .children(list)
      .when(decisions.length > 0, (el) => el.child(decisionsSection(t, decisions))));
}
