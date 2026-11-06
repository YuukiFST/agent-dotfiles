// Named tabs for a layout stack: props { stack: "<stack id>", tabs: [["<child id>", "Label"], ...] }.
// Used as the header of the info monitor's stack (AI Memory | GitHub).
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, layout, props, run } from "herdr";

function findNode(node, id) {
  if (!node || typeof node !== "object") return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

export default class InfoTabs extends View {
  render() {
    const t = theme();
    const { stack, tabs = [] } = props() ?? {};
    const active = findNode(layout(), stack)?.active ?? tabs[0]?.[0];
    return h_flex().size_full().px(8).gap(2).items_end().bg(t.chrome).border_b(1).border_color(t.border).text_size(12.5)
      .children(tabs.map(([child, label]) => {
        const on = child === active;
        return div().id(`info-tab-${child}`).px(12).py(6).cursor_pointer().border_b(2).border_color(on ? t.accent : "#00000000")
          .text_color(on ? t.foreground : t.muted).font_semibold().hover((s) => s.text_color(t.foreground))
          .on_click(() => run("layout.select", { stack, child })).child(label);
      }));
  }
}
