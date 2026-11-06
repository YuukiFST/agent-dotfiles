// The agents list's sort picker (a popup the list opens with props { sortMenu: true }).

import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { shared, setShared, closeOverlay, props } from "herdr";

export const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
export const sortOf = () => SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[0];

export function sortMenu(t) {
  const on = sortOf().id;
  return v_flex()
    .w_full()
    .p(5)
    .bg(t.popover)
    .text_size(13)
    .child(div().px(8).pt(4).pb(6).text_size(11).text_color(t.dim).child("Sort agents"))
    .children(SORTS.map((s) => h_flex()
      .id(`sort-${s.id}`)
      .h(31)
      .px(8)
      .gap(9)
      .rounded(7)
      .items_center()
      .text_color(t.foreground)
      .hover((el) => el.bg(t.hover))
      .on_click(() => {
        setShared("agents.sort", s.id);
        closeOverlay(props().overlay);
      })
      .child(svg(`mods/workspace-chrome/${s.icon}.svg`).size(14).flex_none().text_color(t.muted))
      .child(div().flex_1().child(s.label))
      .when(s.id === on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.foreground)))));
}
