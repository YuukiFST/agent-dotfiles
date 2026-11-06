// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "pane-info" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, its checkout (repo, worktree, branch, ahead/behind, uncommitted
// diff) or else its folder, and the agent's status; a stripe in its space's color.
// Buttons split, zoom and close this pane. Props from the app: { pane, terminal }.
// Click: focus the pane. The checkout comes from the agents list (shared "git.cwd").

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { focused, nextCommand, panes, props, run, terminals, theme, home, shared, spaces } from "herdr";
import { closeOnlyPane } from "./close-selected.js";

// The same avatar colors the spaces list draws (spaces/main.js MARK).
const SPACE_MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

function spaceStripe(t, tab) {
  const space = spaces().find((s) => s.tabs.some((x) => x.id === tab));
  const color = space && (shared("space.colors") ?? {})[space.id];
  if (!color) return null;
  return color.startsWith("#") ? color : SPACE_MARK[color] ?? t[color];
}

const TIPS = { "split-right": "Split right", "split-down": "Split down", zoom: "Zoom pane", unzoom: "Unzoom pane", close: "Close pane" };

const lastPart = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop();

function checkout(t, g) {
  const wt = g.linked ? lastPart(g.top) : null;
  const branch = g.branch ?? "detached";
  return h_flex().flex_1().min_w(0).overflow_hidden().gap(6).items_center().text_color(t.dim)
    .child(div().min_w(0).truncate().text_color(t.muted).child(g.repo))
    .when(Boolean(wt), (el) => el.child(h_flex().min_w(0).h(17).px(5).gap(3).rounded(4).items_center()
      .bg(t.ansi5 + "22").text_color(t.ansi5).text_size(11)
      .child(svg("mods/workspace-chrome/branch.svg").size(11).flex_none()).child(div().min_w(0).truncate().child(wt))))
    .child(h_flex().min_w(0).gap(3).items_center().text_color(branch === "main" || branch === "master" ? t.dim : t.ansi5)
      .when(!wt, (el) => el.child(svg("mods/workspace-chrome/branch.svg").size(12).flex_none()))
      .child(div().min_w(0).truncate().child(branch)))
    .when(g.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`↑${g.ahead}`)))
    .when(g.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi9).child(`↓${g.behind}`)))
    .when(g.added > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`+${g.added}`)))
    .when(g.removed > 0, (el) => el.child(div().flex_none().text_color(t.ansi9).child(`−${g.removed}`)))
    .when(g.untracked > 0, (el) => el.child(div().flex_none().child(`?${g.untracked}`)));
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const path = cwd.replaceAll("\\", "/"), h = home().replaceAll("\\", "/");
  if (path.toLowerCase() === h.toLowerCase()) return "~";
  return path.toLowerCase().startsWith(h.toLowerCase() + "/") ? "~" + path.slice(h.length) : path;
}

export default class Pane extends View {
  init(_props, cx) {
    this.hovered = false;
    cx.spawn(async () => {
      for (;;) {
        const command = await nextCommand();
        if (command === "close" && focused()?.pane === props()?.pane) closeOnlyPane(props().pane);
      }
    });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, action) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(TIPS[icon])
      .on_click((_e, cx) => {
        cx.stop_propagation();
        action();
      })
      .child(svg(`mods/pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const chosen = terminals().find((k) => k.address === p.terminal)?.labels?.["herdr.session-name"];
    const name = chosen || ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "Terminal";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    const pane = p.pane;
    const git = p.cwd ? (shared("git.cwd") ?? {})[p.cwd] : null;
    const stripe = spaceStripe(t, p.tab);
    return h_flex()
      .id(`pane-head-${pane}`)
      .relative()
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .border_b(1)
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().id(`pane-name-${pane}`).flex_shrink(0).min_w(0).truncate().max_w(260).font_medium().text_color(t.foreground).tooltip(name).child(name))
      .when(Boolean(stripe), (el) => el.child(div().absolute().left(0).top(7).bottom(7).w(3).rounded(2).bg(stripe)))
      .child(git ? checkout(t, git).id(`pane-git-${pane}`).tooltip(`${folder(p.cwd)} · ${git.branch ?? "detached"}`) : div().id(`pane-folder-${pane}`).flex_1().min_w(0).truncate().text_ellipsis_start().text_color(t.dim).tooltip(folder(p.cwd)).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", () => run("pane.split", { direction: "right", pane })))
        .child(this.button(t, `ph-d-${pane}`, "split-down", () => run("pane.split", { direction: "down", pane })))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", () => run("pane.zoom", { pane })))
        .child(this.button(t, `ph-x-${pane}`, "close", () => closeOnlyPane(pane))));
  }
}
