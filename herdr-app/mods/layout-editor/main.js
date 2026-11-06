// A visual editor for the shown layout: the layout drawn to scale, dividers that drag
// (snapping to common fractions), and an inspector to split, move, hide, remove or
// re-point a block. Every change goes live through `layout.set` and lands in the file.
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { layout, shared, run, exec, home, theme, props, closeOverlay, agents, watchFolder } from "herdr";
import * as T from "./tree.js";
import { WorkspacesPane } from "./workspaces-pane.js";
import { DEFAULT_WORKSPACES, SHARED_DIR, readWorkspaces } from "./workspace-list.js";

const SNAPS = [1 / 5, 1 / 4, 1 / 3, 0.382, 2 / 5, 1 / 2, 3 / 5, 0.618, 2 / 3, 3 / 4, 4 / 5];
const SNAP_RANGE = 0.025;
const HANDLE = 6;
// A fixed-size node drawn smaller than this can't show its name: a 28 px footer at the
// canvas's scale, minus a container's padding, leaves no room for a line of text.
const MIN_BLOCK = 22;
const MIN_CONTAINER = 30;
const HISTORY = 30;
// The overlay opens at this share of the window; the canvas recovers the window size from it.
const SHARE = { width: 0.9, height: 0.88 };
// Mods that only open as menus or dialogs: no use as a block.
const OVERLAY_ONLY = new Set(["menu", "confirm", "picker", "prompt", "toast", "new-menu", "machine-add", "peek", "layout-editor", "pane", "help"]);

export default class LayoutEditor extends View {
  init(_props, cx) {
    this.selected = null;
    this.sizes = {};          // node id -> measured canvas size
    this.drag = null;
    this.pressed = null;      // a press on a block or a palette chip: { id } or { content }, with where
    this.carry = null;        // the same once the pointer moved: a block or content being dragged
    this.dropAt = null;       // { id, zone } under the pointer while carrying
    this.preview = null;      // the tree while a divider is dragged
    this.history = [];
    this.showHidden = true;
    this.mods = [];
    this.overlaySize = null;
    this.area = null;
    this.workspaces = DEFAULT_WORKSPACES;
    this.managing = null; // the Workspaces view while it's open
    cx.spawn(async (cx) => {
      for (;;) {
        this.workspaces = (await readWorkspaces()) ?? this.workspaces;
        cx.notify();
        await watchFolder(SHARED_DIR());
      }
    });
    cx.spawn(async (cx) => {
      const appHome = await exec("powershell.exe", ["-NoProfile", "-Command", "$env:HERDR_APP_HOME"]).then((r) => r.stdout.trim()).catch(() => "");
      const dir = (appHome || `${home()}\\.config\\herdr-app`) + "\\mods";
      const r = await exec("powershell.exe", ["-NoProfile", "-Command", `Get-ChildItem -Directory '${dir}' | ForEach-Object Name`]).catch(() => null);
      this.mods = (r?.stdout ?? "").split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !OVERLAY_ONLY.has(s)).sort();
      cx.notify();
    });
  }

  current() { return layout(); }

  tree() { return this.preview ?? this.current(); }

  setLayout(next) {
    run("layout.set", { layout: next });
  }

  apply(next, cx) {
    const now = this.current();
    if (!now || JSON.stringify(now) === JSON.stringify(next)) return;
    this.history.push(now);
    if (this.history.length > HISTORY) this.history.shift();
    this.setLayout(next);
    cx.notify();
  }

  undo(cx) {
    const prev = this.history.pop();
    if (prev) this.setLayout(prev);
    cx.notify();
  }

  // ---- canvas ----

  startDrag(e, parent, a, b, cx) {
    cx.stop_propagation();
    const axis = parent.type === "row" ? "x" : "y", dim = axis === "x" ? "width" : "height";
    const sa = this.sizes[a.id]?.[dim], sb = this.sizes[b.id]?.[dim];
    if (!sa || !sb) return;
    if (e.click_count === 2) { this.apply(T.equalize(this.current(), parent.id), cx); return; }
    this.drag = { axis, start: e.position[axis], a: T.clone(a), b: T.clone(b), sa, sb };
  }

  moveDrag(e, cx) {
    const d = this.drag;
    if (!d) return;
    const delta = e.position[d.axis] - d.start, total = d.sa + d.sb;
    let na = Math.min(total - 24, Math.max(24, d.sa + delta));
    const aPx = d.a.size?.px, bPx = d.b.size?.px;
    let next = this.current();
    if (aPx !== undefined) {
      next = T.update(next, d.a.id, { size: { px: Math.round(na / this.scale) } });
    } else if (bPx !== undefined) {
      next = T.update(next, d.b.id, { size: { px: Math.round((total - na) / this.scale) } });
    } else {
      let ratio = na / total;
      if (!e.modifiers?.shift) {
        const snap = SNAPS.find((s) => Math.abs(s - ratio) < SNAP_RANGE);
        if (snap) ratio = snap;
      }
      const sum = (d.a.size?.weight ?? 1) + (d.b.size?.weight ?? 1);
      const wa = Math.round(sum * ratio * 1000) / 1000;
      next = T.update(T.update(next, d.a.id, { size: { weight: wa } }), d.b.id, { size: { weight: Math.round((sum - wa) * 1000) / 1000 } });
      this.dragRatio = ratio;
    }
    this.preview = next;
    cx.notify();
  }

  endDrag(cx) {
    if (!this.drag) return;
    const next = this.preview;
    this.drag = null; this.preview = null; this.dragRatio = null;
    if (next) this.apply(next, cx);
    cx.notify();
  }

  sized(el, node, parentType) {
    const s = node.size ?? { weight: 1 };
    if (s.px !== undefined) {
      const isContainer = node.type === "row" || node.type === "column" || node.type === "stack";
      const len = Math.max(s.px * this.scale, isContainer ? MIN_CONTAINER : MIN_BLOCK);
      return (parentType === "row" ? el.w(len) : el.h(len)).flex_none();
    }
    return el.flex_grow(s.weight ?? 1).flex_basis(0).min_w(0).min_h(0);
  }

  nodeView(node, parentType, t) {
    const sel = this.selected === node.id;
    const measure = (el) => el.on_size_change((size) => { this.sizes[node.id] = size; });
    const select = (_e, cx) => { cx.stop_propagation(); this.selected = node.id; cx.notify(); };
    if (node.type === "row" || node.type === "column" || node.type === "stack") {
      const kids = (node.type === "stack" ? node.children.filter((c) => c.id === node.active || (!node.active && c === node.children[0])) : node.children)
        .filter((c) => this.showHidden || !c.hidden);
      const items = [];
      kids.forEach((c, i) => {
        if (i > 0 && node.type !== "stack") items.push(this.handle(node, kids[i - 1], c, t));
        items.push(this.nodeView(c, node.type === "stack" ? "column" : node.type, t));
      });
      const box = (node.type === "row" ? h_flex() : v_flex()).id(`le-${node.id}`).items_stretch()
        .p(3).rounded(6).border(1).border_color(sel ? t.accent : "#00000000")
        .when(Boolean(node.hidden), (el) => el.opacity(0.35))
        .on_mouse_down("left", select).children(items);
      return measure(this.sized(box, node, parentType));
    }
    const name = T.label(node);
    const drop = this.carry && this.dropAt?.id === node.id && this.carry.id !== node.id ? this.dropAt.zone : null;
    const block = v_flex().id(`le-${node.id}`).relative().rounded(6).border(sel ? 2 : 1).items_center().justify_center().overflow_hidden()
      .when(this.carry?.id === node.id, (el) => el.opacity(0.4))
      .on_mouse_move((e, cx) => this.overBlock(e, node.id, cx))
      .on_hover((on, cx) => { if (!on && this.dropAt?.id === node.id) { this.dropAt = null; cx.notify(); } })
      .when(Boolean(drop), (el) => el.child(this.dropShade(drop, t)))
      .border_color(sel ? t.accent : t.border).bg(T.isSessions(node) ? t.raised : t.background)
      .when(Boolean(node.hidden), (el) => el.opacity(0.35).border_dashed())
      .hover((s) => s.bg(t.hover)).cursor_pointer()
      .on_mouse_down("left", (e, cx) => { select(e, cx); this.pressed = { id: node.id, x: e.position.x, y: e.position.y }; })
      .child(div().text_color(sel ? t.foreground : t.muted).text_size(12).truncate()
        .child(node.size?.px !== undefined ? `${name} · ${node.size.px}px` : name))
      .when(Boolean(node.hidden), (el) => el.child(div().text_color(t.dim).text_size(10).child("hidden")));
    return measure(this.sized(block, node, parentType));
  }

  // ---- tiling: drag a block, or a palette chip, onto a block ----

  overBlock(e, id, cx) {
    if (!this.carry || !e.bounds) return;
    const zone = T.zoneAt(e.local_position.x, e.local_position.y, e.bounds.size?.width ?? e.bounds.width, e.bounds.size?.height ?? e.bounds.height);
    if (this.dropAt?.id === id && this.dropAt.zone === zone) return;
    this.dropAt = { id, zone };
    cx.notify();
  }

  moveCarry(e, cx) {
    const p = this.pressed;
    if (!p || this.carry) return;
    if (Math.hypot(e.position.x - p.x, e.position.y - p.y) < 6) return;
    this.carry = p.id ? { id: p.id } : { content: p.content, label: p.label };
    cx.notify();
  }

  endCarry(cx) {
    const carry = this.carry, at = this.dropAt;
    this.pressed = null; this.carry = null; this.dropAt = null;
    if (!carry) return;
    if (at && at.id !== carry.id) {
      const tree = this.current();
      this.apply(carry.id ? T.dock(tree, carry.id, at.id, at.zone) : T.dropContent(tree, at.id, at.zone, carry.content), cx);
      if (carry.id) this.selected = carry.id;
    }
    cx.notify();
  }

  // The half (or the middle) a drop lands on, tinted.
  dropShade(zone, t) {
    const shade = div().absolute().rounded(5).bg(t.accent + "33").border(2).border_color(t.accent);
    if (zone === "center") return shade.top("25%").bottom("25%").left("25%").right("25%");
    if (zone === "left") return shade.top(0).bottom(0).left(0).w("50%");
    if (zone === "right") return shade.top(0).bottom(0).right(0).w("50%");
    if (zone === "up") return shade.left(0).right(0).top(0).h("50%");
    return shade.left(0).right(0).bottom(0).h("50%");
  }

  // A chip that drops `content` where it's dragged to; a click runs `onClick`.
  carryChip(t, id, text, content, on, tip, onClick) {
    return div().id(`le-c-${id}`).px(7).py(3).rounded(5).text_size(11.5).cursor_grab()
      .border(1).border_color(on ? t.accent : t.border).bg(on ? t.selected : t.chrome).text_color(on ? t.foreground : t.muted)
      .hover((st) => st.bg(t.hover)).when(Boolean(tip), (el) => el.tooltip(tip))
      .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); this.pressed = { content, label: text, x: e.position.x, y: e.position.y }; })
      .when(Boolean(onClick), (el) => el.on_click((e, cx) => { if (!this.carry) onClick(e, cx); }))
      .child(text);
  }

  // Everything that can go in a block, to drag onto the drawing.
  palette(t, node) {
    const tree = this.current();
    const set = (content) => node ? (_e, cx) => this.apply(T.update(tree, node.id, { content }), cx) : null;
    const agentChips = agents().filter((a) => !a.address.includes("/")).map((a) => this.carryChip(t, `t-${a.address}`,
      `${a.space_name || a.address} · ${a.tab_name || a.title}`.slice(0, 40), { terminal: a.address }, node?.content?.terminal === a.address,
      `always shows terminal ${a.address}, whatever tab is open`, set({ terminal: a.address })));
    const modChips = this.mods.map((m) => this.carryChip(t, `m-${m}`, m, { mod: m }, node?.content?.mod === m, null, set({ mod: m })));
    return [
      div().text_size(11).text_color(t.dim).child("Agents"),
      h_flex().gap(6).flex_wrap()
        .child(this.carryChip(t, "agent", "focused agent", { agent: "focused" }, node?.content?.agent === "focused",
          "one agent full size: the one you pick in the agents list or with alt+up/down", set({ agent: "focused" })))
        .children(agentChips),
      div().text_size(11).text_color(t.dim).child("Mods"),
      h_flex().gap(6).flex_wrap().children(modChips),
    ];
  }

  handle(parent, a, b, t) {
    const row = parent.type === "row";
    const active = this.drag && this.drag.a.id === a.id;
    return div().id(`le-h-${a.id}`).flex_none().rounded(3)
      .when(row, (el) => el.w(HANDLE).h_full().cursor_col_resize())
      .when(!row, (el) => el.h(HANDLE).w_full().cursor_row_resize())
      .bg(active ? t.accent : "#00000000").hover((s) => s.bg(t.accent))
      .on_mouse_down("left", (e, cx) => this.startDrag(e, parent, a, b, cx));
  }

  canvas(t) {
    const wrap = div().id("le-area").flex_1().h_full().min_w(0).min_h(0).flex().items_center().justify_center().p(16)
      .on_size_change((size, cx) => { this.area = size; cx.notify(); });
    if (!this.area || !this.overlaySize) return wrap;
    const winW = this.overlaySize.width / SHARE.width;
    const winH = this.overlaySize.height / SHARE.height;
    const availW = this.area.width - 32, availH = this.area.height - 32;
    this.scale = Math.min(availW / winW, availH / winH);
    const root = this.tree();
    if (!root) return wrap.child(div().text_color(t.dim).child("no layout"));
    const screen = v_flex().items_stretch().w(winW * this.scale).h(winH * this.scale).rounded(8).border(1).border_color(t.border).bg(t.chrome).p(2)
      .child(this.nodeView(root, "column", t).flex_grow(1).flex_basis(0));
    return wrap.child(screen);
  }

  // ---- inspector ----

  button(t, id, text, action, enabled = true, tip = null) {
    return div().id(`le-b-${id}`).px(8).py(4).rounded(6).border(1).border_color(t.border).text_size(12)
      .text_color(enabled ? t.foreground : t.dim)
      .when(enabled, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(action))
      .when(Boolean(tip), (el) => el.tooltip(tip))
      .child(text);
  }

  inspector(t) {
    const tree = this.current();
    const node = this.selected ? T.find(tree, this.selected) : null;
    const panel = v_flex().id("le-inspector").w(300).flex_none().h_full().gap(10).p(12).border_l(1).border_color(t.border).overflow_y_scrollbar();
    if (!node) return panel
      .child(div().text_color(t.muted).child("Drag a block onto another: an edge splits it in half there, the middle swaps them. Click a block to edit it."))
      .child(div().pt(4).text_size(11).text_color(t.dim).child("DRAG ONTO THE DRAWING"))
      .children(this.palette(t, null));
    const parent = T.parentOf(tree, node.id);
    const isRoot = !parent;
    const container = node.type === "row" || node.type === "column";
    const s = node.size ?? { weight: 1 };
    const fixed = s.px !== undefined;
    const set = (patch) => (_e, cx) => this.apply(T.update(tree, node.id, patch), cx);
    const section = (title) => div().pt(4).text_size(11).text_color(t.dim).child(title);
    const line = () => h_flex().gap(6).flex_wrap();
    const locked = T.containsSessions(node);

    panel.child(h_flex().gap(6).items_center()
      .child(div().font_semibold().text_color(t.foreground).child(T.label(node)))
      .child(div().text_color(t.dim).text_size(11).truncate().child(node.id.length > 20 ? node.id.slice(0, 8) + "…" : node.id)));
    if (parent) panel.child(this.button(t, "up", `↑ select ${T.label(parent)}`, (_e, cx) => { this.selected = parent.id; cx.notify(); }));

    if (!isRoot) {
      panel.child(section("SIZE"));
      panel.child(line()
        .child(this.button(t, "mode-w", fixed ? "share" : "● share", set({ size: { weight: 1 } }), fixed))
        .child(this.button(t, "mode-px", fixed ? "● fixed" : "fixed", set({ size: { px: Math.round((this.sizes[node.id]?.[parent.type === "row" ? "width" : "height"] ?? 200 * this.scale) / (this.scale || 1)) } }), !fixed)));
      const step = fixed ? 20 : 0.5;
      const value = fixed ? s.px : s.weight ?? 1;
      const bump = (dir) => set({ size: fixed ? { px: Math.max(28, value + dir * step) } : { weight: Math.max(0.5, Math.round((value + dir * step) * 10) / 10) } });
      panel.child(line().items_center()
        .child(this.button(t, "minus", "−", bump(-1)))
        .child(div().w(64).text_center().text_color(t.foreground).child(fixed ? `${value} px` : `weight ${value}`))
        .child(this.button(t, "plus", "+", bump(1))));
      panel.child(this.button(t, "hide", node.hidden ? "show" : "hide", set({ hidden: node.hidden ? undefined : true }), !locked,
        "a hidden block stays in the layout; layout.toggle or a key shows it"));
    }

    panel.child(section("STRUCTURE"));
    panel.child(line()
      .child(this.button(t, "split-r", "split →", (_e, cx) => this.splitAt(tree, node, "right", cx)))
      .child(this.button(t, "split-d", "split ↓", (_e, cx) => this.splitAt(tree, node, "down", cx))));
    if (parent) panel.child(line()
      .child(this.button(t, "prev", parent.type === "row" ? "← move" : "↑ move", (_e, cx) => this.apply(T.move(tree, node.id, -1), cx), parent.children[0].id !== node.id))
      .child(this.button(t, "next", parent.type === "row" ? "move →" : "move ↓", (_e, cx) => this.apply(T.move(tree, node.id, 1), cx), parent.children.at(-1).id !== node.id)));
    if (container) panel.child(line()
      .child(this.button(t, "flip", node.type === "row" ? "make column" : "make row", (_e, cx) => this.apply(T.flip(tree, node.id), cx)))
      .child(this.button(t, "even", "equal children", (_e, cx) => this.apply(T.equalize(tree, node.id), cx))));
    if (!isRoot) panel.child(this.button(t, "remove", "remove", (_e, cx) => { this.selected = parent.id; this.apply(T.remove(tree, node.id), cx); },
      !locked, locked ? "holds this window's sessions block" : null));

    if (node.type === "block" && !T.isSessions(node)) {
      panel.child(section("CONTENT"));
      panel.child(line().child(this.sessionsChip(tree, node, t)));
      panel.children(this.palette(t, node));
    }
    return panel;
  }

  // The sessions (the shown tab's terminals): put here, or moved here from their block.
  sessionsChip(tree, node, t) {
    const sessions = T.findSessions(tree);
    return div().id("le-kind-sessions").px(7).py(3).rounded(5).text_size(11.5).cursor_pointer()
      .border(1).border_color(t.border).bg(t.chrome).text_color(t.muted).hover((st) => st.bg(t.hover))
      .tooltip(sessions ? "moves the sessions here; this block's content goes where they were" : "the open tab's terminals, as it arranges them")
      .on_click((_e, cx) => this.apply(sessions ? T.swapContent(tree, node.id, sessions.id) : T.update(tree, node.id, { content: T.sessionsContent() }), cx))
      .child(sessions ? "sessions (move here)" : "sessions");
  }

  splitAt(tree, node, dir, cx) {
    const mods = this.mods;
    const content = { mod: mods.includes("ai-memory") ? "ai-memory" : mods[0] ?? "help" };
    const { tree: next, created } = T.split(tree, node.id, dir, content);
    this.selected = created;
    this.apply(next, cx);
  }

  // ---- frame ----

  topBar(t) {
    const shown = shared("layout");
    const chip = (workspace, index) => {
      const isOn = !this.managing && workspace.layout === shown;
      return div().id(`le-w-${index}`).px(8).py(3).rounded(6).text_size(12).cursor_pointer()
        .bg(isOn ? t.selected : t.chrome).text_color(isOn ? t.foreground : t.muted).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => {
          run("layout.switch", { name: workspace.layout });
          this.selected = null; this.history = []; this.managing = null; cx.notify();
        }).child(`${index + 1} ${workspace.name}`);
    };
    return h_flex().px(12).py(8).gap(6).items_center().border_b(1).border_color(t.border)
      .child(div().font_semibold().text_color(t.foreground).pr(6).child("Workspaces"))
      .children(this.workspaces.map(chip))
      .child(div().w(1).h(16).mx(4).bg(t.border))
      .child(div().id("le-manage").px(8).py(3).rounded(6).text_size(12).cursor_pointer()
        .border(1).border_color(this.managing ? t.accent : t.border)
        .bg(this.managing ? t.selected : t.chrome).text_color(this.managing ? t.foreground : t.muted).hover((s) => s.bg(t.hover))
        .tooltip("add, rename, reorder or remove workspaces")
        .on_click((_e, cx) => {
          this.managing = this.managing ? null : new WorkspacesPane(this.workspaces, (list, cx) => { this.workspaces = list; cx.notify(); }, cx);
          cx.notify();
        }).child("Manage"))
      .child(div().flex_1())
      .child(this.button(t, "hidden", this.showHidden ? "hide hidden" : "show hidden", (_e, cx) => { this.showHidden = !this.showHidden; cx.notify(); }))
      .child(this.button(t, "undo", `undo${this.history.length ? ` (${this.history.length})` : ""}`, (_e, cx) => this.undo(cx), this.history.length > 0))
      .child(this.button(t, "close", "×", () => closeOverlay(props()?.overlay)));
  }

  hint(t) {
    const live = this.dragRatio ? ` · ${Math.round(this.dragRatio * 100)}% / ${Math.round((1 - this.dragRatio) * 100)}%` : "";
    return div().px(12).py(6).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
      .child(this.carry
        ? `Drop on a block: an edge puts ${this.carry.label ?? "it"} in that half, the middle ${this.carry.id ? "swaps them" : "replaces it"}. Release elsewhere to cancel.`
        : `Drag a block onto another to tile it (edge: half, middle: swap). Drag the dividers to resize: snaps to 1/5, 1/4, 1/3, 1/2, 2/3, 3/4; Shift drags freely; double-click evens out.${live}`);
  }

  render() {
    const t = theme();
    return v_flex().id("le-root").size_full().bg(t.chrome).text_size(12.5)
      .on_size_change((size, cx) => { this.overlaySize = size; cx.notify(); })
      .on_mouse_move((e, cx) => { this.moveDrag(e, cx); this.moveCarry(e, cx); })
      .on_mouse_up("left", (_e, cx) => { this.endDrag(cx); this.endCarry(cx); })
      .child(this.topBar(t))
      .when(Boolean(this.managing), (el) => el.child(this.managing.render(t)))
      .when(!this.managing, (el) => el
        .child(h_flex().flex_1().min_h(0).child(this.canvas(t)).child(this.inspector(t)))
        .child(this.hint(t)));
  }
}
