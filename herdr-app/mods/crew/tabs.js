// The sidebar's Sessions | Orchestration switch: one segmented control over the layout's
// sidebar-view stack. The stack's active child is the layout's own state, so a click and a
// key bound to layout.select show the same tab.

import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";

export const SIDEBAR_STACK = "sidebar-view";
export const SESSIONS_TAB = "sessions";
export const ORCHESTRATION_TAB = "orchestration";
const TABS = [
  { child: SESSIONS_TAB, label: "Sessions", icon: "mods/workspace-chrome/layers.svg" },
  { child: ORCHESTRATION_TAB, label: "Orchestration", icon: "mods/workspace-chrome/git-compare.svg" },
];
const CONTROL_HEIGHT = 26;
const BADGE_HEIGHT = 16;
const BADGE_ALPHA = "26";

function badge(t, count, color) {
  return div().h(BADGE_HEIGHT).min_w(BADGE_HEIGHT).px(4).flex_none().flex().items_center().justify_center().rounded(BADGE_HEIGHT / 2)
    .bg(color + BADGE_ALPHA).text_color(color).text_size(10.5).font_medium().child(String(count));
}

// needs: { count, color } of what waits for the person; select(child) shows that tab.
export function tabsBlock(t, { active, needs, isNarrow, select }) {
  const segment = (tab) => {
    const isActive = tab.child === active;
    const hasBadge = tab.child === ORCHESTRATION_TAB && needs.count > 0;
    return h_flex().id(`crew-tab-${tab.child}`).flex_auto().min_w(0).px(isNarrow ? 0 : 6).h_full().gap(6).items_center().justify_center().rounded(6)
      .text_color(isActive ? t.foreground : t.dim).cursor_pointer()
      .when(isActive, (el) => el.bg(t.raised))
      .when(!isActive, (el) => el.hover((s) => s.text_color(t.foreground)))
      .when(isNarrow, (el) => el.relative().tooltip(hasBadge ? `${tab.label} · ${needs.count}` : tab.label))
      .on_click(() => select(tab.child))
      .child(svg(tab.icon).size(isNarrow ? 12 : 13).flex_none())
      .when(!isNarrow, (el) => el.child(div().min_w(0).truncate().child(tab.label)))
      .when(hasBadge && !isNarrow, (el) => el.child(badge(t, needs.count, needs.color)))
      .when(hasBadge && isNarrow, (el) => el.child(div().absolute().top(1).right(0).size(5).rounded_full().bg(needs.color)));
  };
  // The 44px rail leaves each icon a 16px segment.
  return h_flex().id("crew-tabs").size_full().px(isNarrow ? 4 : 8).items_center().bg(t.chrome).text_size(12)
    .child(h_flex().flex_1().min_w(0).h(CONTROL_HEIGHT).p(isNarrow ? 1 : 2).gap(isNarrow ? 0 : 2).rounded(8).bg(t.background).border(1).border_color(t.border)
      .children(TABS.map(segment)));
}
