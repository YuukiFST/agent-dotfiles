import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, openOverlay, theme, window, shared, setShared, layout, settings, notify } from "herdr";

// Set by the sidebar mods (spaces, agents) on a press: { terminals, at }. A drop on a tab
// merges those terminals into it; a stale press (released elsewhere) expires.
const DRAG_KEY = "drag.session";
const DRAG_MS = 15000;

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class Tabs extends View {
  init() {
    this.pressed = null;
    this.over = null;
    this.panels = JSON.parse(localStorage.getItem("panels") ?? "{}");
  }

  merge(from, to, cx) {
    this.mergeTerminals(panes().filter(p => p.tab === from && p.terminal).map(p => p.terminal), to, cx);
  }

  // Moves terminals next to the session of tab `to`: park them (an emptied tab
  // closes, the programs keep running), then keep each one to the right of the
  // target pane. The steps are spaced so each command lands first.
  mergeTerminals(terminals, to, cx) {
    const target = panes().filter(p => p.tab === to && p.terminal);
    const moving = terminals.filter(id => !target.some(p => p.terminal === id));
    // The anchor by pane id: pane.focus {terminal} would pick a layout block showing it,
    // and keep right fails from a layout block.
    const anchorPane = (target.find(p => p.focused) ?? target[0])?.pane;
    if (!moving.length || !anchorPane) { run("tab.select", { id: to }); return; }
    for (const terminal of moving) run("terminal.park", { terminal });
    cx.timer.after(300, () => { run("tab.select", { id: to }); run("pane.focus", { pane: anchorPane }); });
    moving.forEach((terminal, k) => cx.timer.after(550 + 250 * k, () => run("terminal.keep", { terminal, place: "right" })));
    // A terminal left parked (no pane) keeps running out of sight: give it a tab.
    cx.timer.after(550 + 250 * moving.length + 1500, () => {
      const lost = moving.filter(terminal => !panes().some(p => p.terminal === terminal));
      for (const terminal of lost) run("terminal.keep", { terminal, place: "tab" });
      if (lost.length) notify({ title: "Couldn't place it beside that session", body: "It's open as a new tab instead.", level: "warning" });
    });
  }

  // The side panel is remembered per space: switching shows that space's choice
  // (closed if it never had one), and opening or closing it records it.
  syncPanel(space, panel, body, enabled) {
    if (!space || !panel) return;
    const now = panel.hidden ? null : body?.active ?? null;
    if (space.id !== this.space) {
      const first = this.space === undefined;
      this.space = space.id; this.pending = null;
      if (!(first && !(space.id in this.panels))) {
        const stored = this.panels[space.id] ?? null, want = enabled.includes(stored) ? stored : null;
        if (want !== now) {
          this.pending = { want, until: Date.now() + 1000 };
          if (want) { run("layout.select", { stack: "panel-body", child: want }); run("layout.show", { id: "panel" }); }
          else run("layout.hide", { id: "panel" });
          return;
        }
      }
    }
    // Until the restore lands (or something else won), the old state isn't a choice.
    if (this.pending) {
      if (this.pending.want !== now && Date.now() < this.pending.until) return;
      this.pending = null;
    }
    if (this.panels[space.id] === now) return;
    this.panels[space.id] = now;
    localStorage.setItem("panels", JSON.stringify(this.panels));
  }

  render() {
    const t = theme();
    const space = spaces().find(p => p.active);
    // Settled tabs (put away, still running) leave the bar; a pill brings them back.
    const shown = (space?.tabs ?? []).filter(c => !c.settled);
    const parked = (space?.tabs ?? []).filter(c => c.settled);
    const stop = (_e, cx) => cx.stop_propagation();
    const drag = shared(DRAG_KEY);
    const sidebarDrag = drag && Date.now() - drag.at < DRAG_MS && drag.terminals?.length ? drag : null;
    const button = (id, label, action) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop).on_click(action).child(label);
    const item = (c, i) => {
      const program = panes().find(p => p.tab === c.id && p.program?.agent)?.program ?? panes().find(p => p.tab === c.id)?.program;
      const name = /^(tb)?\d+$/.test(c.name) ? program?.name ?? "Terminal" : c.name;
      return h_flex().id(`tab-${c.id}`).h(29).px(10).gap(7).rounded(7).items_center().flex_none().text_size(13)
        .border(1).border_color(c.active ? t.border : t.chrome).bg(c.active ? t.raised : t.chrome).text_color(c.active ? t.foreground : t.muted)
        .when(!c.active, el => el.hover(s => s.bg(t.hover)))
        .when((sidebarDrag || (this.pressed !== null && this.pressed !== i)) && this.over === i, el => el.border_color(t.accent).bg(t.selected))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_move((_e, cx) => { if ((this.pressed !== null || sidebarDrag) && this.over !== i) { this.over = i; cx.notify(); } })
        .on_mouse_up("left", (e, cx) => {
          const from = this.pressed; this.pressed = null; this.over = null;
          // A press that began on a sidebar row (spaces or agents) drops its session here.
          if (from === null && sidebarDrag) { setShared(DRAG_KEY, null); this.mergeTerminals(sidebarDrag.terminals, c.id, cx); return; }
          if (from === null || from === i) { run("tab.select", { id: c.id }); return; }
          // Shift keeps the old drop: reorder. A plain drop puts the dragged session beside this one.
          if (e.modifiers?.shift) run("tab.move", { id: shown[from].id, index: space.tabs.findIndex(x => x.id === c.id) + 1 });
          else this.merge(shown[from].id, c.id, cx);
          cx.notify();
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .when(Boolean(program?.icon), el => el.child(program.tint ? svg(program.icon).size(14).text_color(t.muted) : image(program.icon).size(14)))
        .child(div().id(`tab-name-${c.id}`).max_w(170).truncate().tooltip(name).child(c.zoomed ? `${name} · zoomed` : name))
        .when(c.status === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
        .when(c.status === "blocked", el => el.child(div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().justify_center().child("!")))
        .when(c.status === "done", el => el.child(div().size(6).flex_none().rounded(3).bg(t.done)))
        .when(c.active, el => el.child(div().id(`close-${c.id}`).p(2).rounded(4).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip("Close tab").on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); }).child(svg("mods/pane/close.svg").size(12))));
    };
    const root = layout(), sidebar = find(root, "sidebar"), w = window();
    // Old saved rails and a dragged-narrow sidebar can be smaller than the window buttons.
    const lightsPadding = w?.platform === "macos" && w.titlebar === "none" && !w.fullscreen && root?.traffic_lights
      ? Math.max(10, (root.traffic_lights[0] + 64) / settings().zoom - (sidebar?.hidden ? 0 : sidebar?.size?.px ?? 0))
      : 8;
    const panel = find(root, "panel"), body = find(root, "panel-body");
    const enabled = [...(shared("workspace.panels") ?? ["files", "changes"]), "graph"];
    this.syncPanel(space, panel, body, enabled);
    const panelButton = (id, label, icon) => {
      const on = panel && !panel.hidden && body?.active === id;
      return h_flex().id(`panel-${id}`).h(26).px(8).gap(5).flex_none().items_center().rounded(6)
        .text_size(12).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
        .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
        .on_click(() => {
          if (on) run("layout.hide", { id: "panel" });
          else { run("layout.select", { stack: "panel-body", child: id }); run("layout.show", { id: "panel" }); }
        }).child(svg(icon).size(14)).child(label);
    };
    return h_flex().size_full().min_w(0).px(8).pl(lightsPadding).gap(3).items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .on_mouse_up("left", (_e, cx) => {
        if (shared(DRAG_KEY)) setShared(DRAG_KEY, null);
        if (this.pressed !== null || this.over !== null) { this.pressed = null; this.over = null; cx.notify(); }
      })
      .on_scroll_wheel(e => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").flex_shrink(1).min_w(0).h_full().items_center().gap(3).overflow_x_scrollbar().children(shown.map(item))
        .when(parked.length > 0, el => el.child(h_flex().id("tabs-parked").h(26).px(8).gap(4).flex_none().items_center().rounded(6)
          .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground)).on_mouse_down("left", stop)
          .tooltip(`${parked.length} parked ${parked.length === 1 ? "tab" : "tabs"}: click to bring back`)
          .on_click(() => parked.forEach(c => run("tab.unsettle", { id: c.id })))
          .child(`${parked.length} parked`))))
      .child(button("tab-new", svg("mods/workspace-chrome/plus.svg").size(14), () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 })).tooltip("New tab"))
      .child(div().flex_1())
      .when(enabled.includes("files"), el => el.child(panelButton("files", "Files", "mods/files/file.svg")))
      .when(w?.buttons, el => el.child(button("minimize", w.platform === "windows" ? svg("mods/tabs/win-min.svg").size(16) : "−", () => run("window.minimize")).tooltip("Minimize"))
        .child(button("maximize", w.platform === "windows" ? svg(`mods/tabs/${w.maximized ? "win-restore" : "win-max"}.svg`).size(16) : "□", () => run("window.maximize")).tooltip(w.maximized ? "Restore" : "Maximize"))
        .child(button("close-window", w.platform === "windows" ? svg("mods/tabs/win-close.svg").size(16) : svg("mods/pane/close.svg").size(13), () => run("window.close")).tooltip("Close window")));
  }
}
