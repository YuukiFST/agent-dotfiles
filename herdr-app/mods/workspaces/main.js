// Workspaces: named layouts you move between, like a tiling window manager's. The footer block
// shows them and takes the go-<n>, next and prev key commands.

import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { nextCommand, run, shared, theme, watchFolder } from "herdr";
import { DEFAULT_WORKSPACES, LAYOUTS_DIR, SHARED_DIR, pullLayouts, pushLayouts, readWorkspaces, focusWindowShowing } from "./list.js";

export default class Workspaces extends View {
  init(_props, cx) {
    this.workspaces = DEFAULT_WORKSPACES;
    cx.spawn(async (cx) => {
      await this.reload(cx);
      await pullLayouts(this.workspaces);
    });
    this.followChanges(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        this.obey(await nextCommand(), cx);
        cx.notify();
      }
    });
  }

  async reload(cx) {
    this.workspaces = (await readWorkspaces()) ?? this.workspaces;
    cx.notify();
  }

  followChanges(cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        await watchFolder(SHARED_DIR());
        await this.reload(cx);
      }
    });
    cx.spawn(async () => {
      for (;;) await pushLayouts(this.workspaces, await watchFolder(LAYOUTS_DIR()));
    });
  }

  shownIndex() {
    return this.workspaces.findIndex((w) => w.layout === shared("layout"));
  }

  obey(command, cx) {
    const count = this.workspaces.length;
    const shown = this.shownIndex();
    const number = command.match(/^go-(\d)$/)?.[1];
    if (number) this.go(Number(number) - 1, cx);
    if (command === "next") this.go((shown + 1) % count, cx);
    if (command === "prev") this.go((shown - 1 + count) % count, cx);
  }

  go(index, cx) {
    const workspace = this.workspaces[index];
    if (!workspace || index === this.shownIndex() || this.isSwitching) return;
    this.isSwitching = true;
    cx.spawn(async () => {
      const isElsewhere = await focusWindowShowing(workspace.layout).catch(() => false);
      this.isSwitching = false;
      if (isElsewhere) return;
      run("layout.switch", { name: workspace.layout });
    });
  }

  numberChip(t, index, isShown) {
    return div().id(`ws-${index}`).w(20).h(18).flex().items_center().justify_center().rounded(4).cursor_pointer().text_size(11)
      .bg(isShown ? t.selected : t.chrome).text_color(isShown ? t.foreground : t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(this.workspaces[index].name)
      .on_click((_e, cx) => this.go(index, cx))
      .child(String(index + 1));
  }

  render() {
    const t = theme();
    const shown = this.shownIndex();
    return h_flex().id("workspaces").size_full().px(8).gap(3).items_center().bg(t.chrome).border_t(1).border_l(1).border_color(t.border).text_size(12)
      .when(this.workspaces.length > 1, (el) => el.children(this.workspaces.map((_w, i) => this.numberChip(t, i, i === shown))))
      .child(div().flex_1().min_w(0).pl(5).truncate().text_color(t.muted).child(this.workspaces[shown]?.name ?? shared("layout") ?? ""));
  }
}
