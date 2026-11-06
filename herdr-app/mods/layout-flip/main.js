// Footer button that swaps this window to another layout: props { to, label, icon, tooltip }.
import { View, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, props, run } from "herdr";

export default class LayoutFlip extends View {
  render() {
    const t = theme();
    const { to, label = "", icon = "mods/workspace-chrome/terminal.svg", tooltip = label } = props() ?? {};
    return h_flex().id("layout-flip").size_full().gap(6).items_center().justify_center().cursor_pointer()
      .bg(t.chrome).border_t(1).border_l(1).border_color(t.border).text_size(12).text_color(t.accent)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(tooltip)
      .on_click(() => run("layout.switch", { name: to }))
      .child(svg(icon).size(14).flex_none())
      .child(label);
  }
}
