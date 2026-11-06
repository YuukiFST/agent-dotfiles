// The editor's Workspaces view: add, rename, reorder and remove workspaces. A new one starts from
// the shown layout or from the parts picked here; removing one keeps its layout file.

import { div } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { appHome, readTextFile, run, shared, writeTextFile } from "herdr";
import { saveWorkspaces } from "./workspace-list.js";
import { PARTS, composeLayout } from "./compose.js";

const FOLLOW_FILE = "~/.config/herdr-app-shared/focus.json";
const DEFAULT_PARTS = ["sessions", "spaces", "agents", "status", "usage"];
const MAX_WORKSPACES = 9; // The number keys reach nine.

const layoutNameFor = (name, taken) => {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
};

async function editedMods() {
  const edited = async (name) => (await readTextFile(`${appHome()}/mods/${name}-edited/mod.json`)) !== null;
  return { agents: (await edited("agents")) ? "agents-edited" : "agents", spaces: (await edited("spaces")) ? "spaces-edited" : "spaces" };
}

export class WorkspacesPane {
  // workspaces: the list now; onChange(list, cx) gets each new one.
  constructor(workspaces, onChange, cx) {
    this.workspaces = workspaces;
    this.onChange = onChange;
    this.picked = 0;
    this.parts = new Set(DEFAULT_PARTS);
    this.message = null;
    this.name = InputState.new({ placeholder: "Workspace name" });
    this.name.on("change", (_e, cx) => cx.notify());
  }

  commit(list, cx) {
    this.workspaces = list;
    this.onChange(list, cx);
    cx.spawn(async (cx) => {
      await saveWorkspaces(list).catch((err) => { this.message = `Couldn't save: ${err?.message ?? err}`; });
      cx.notify();
    });
  }

  typedName() {
    return this.name.value().trim();
  }

  newLayoutName() {
    return layoutNameFor(this.typedName(), new Set(this.workspaces.map((w) => w.layout)));
  }

  addFromShown(cx) {
    const layout = this.newLayoutName();
    this.commit([...this.workspaces, { name: this.typedName(), layout }], cx);
    run("layout.clone", { name: shared("layout"), as: layout });
  }

  addFromParts(cx) {
    const layout = this.newLayoutName();
    const list = [...this.workspaces, { name: this.typedName(), layout }];
    cx.spawn(async (cx) => {
      const tree = composeLayout({ parts: this.parts, mods: await editedMods(), followFile: FOLLOW_FILE });
      await writeTextFile(`${appHome()}/layouts/${layout}.json`, `${JSON.stringify(tree, null, 2)}\n`, null);
      this.commit(list, cx);
      run("layout.switch", { name: layout });
    });
  }

  rename(index, cx) {
    this.commit(this.workspaces.map((w, i) => (i === index ? { ...w, name: this.typedName() } : w)), cx);
  }

  move(index, by, cx) {
    const list = [...this.workspaces];
    const [workspace] = list.splice(index, 1);
    list.splice(index + by, 0, workspace);
    this.picked = index + by;
    this.commit(list, cx);
  }

  remove(index, cx) {
    this.picked = 0;
    this.commit(this.workspaces.filter((_w, i) => i !== index), cx);
  }

  togglePart(id, cx) {
    if (this.parts.has(id)) this.parts.delete(id);
    else this.parts.add(id);
    cx.notify();
  }

  button(t, id, label, isEnabled, onClick) {
    return div().id(id).px(10).py(4).rounded(6).text_size(12).flex_none().bg(t.raised).text_color(isEnabled ? t.foreground : t.dim)
      .when(isEnabled, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(onClick))
      .child(label);
  }

  row(t, workspace, index) {
    const isPicked = index === this.picked;
    const count = this.workspaces.length;
    return h_flex().id(`ws-row-${index}`).h(40).px(10).gap(10).items_center().rounded(7).cursor_pointer()
      .bg(isPicked ? t.selected : t.chrome).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { this.picked = index; cx.notify(); })
      .child(div().w(16).text_color(t.dim).child(String(index + 1)))
      .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(workspace.name))
      .child(div().text_size(11.5).text_color(t.dim).child(`alt+shift+${index + 1}`))
      .when(isPicked, (el) => el
        .child(this.button(t, "ws-up", "↑", index > 0, (_e, cx) => this.move(index, -1, cx)))
        .child(this.button(t, "ws-down", "↓", index < count - 1, (_e, cx) => this.move(index, 1, cx)))
        .child(this.button(t, "ws-rename", "Rename", Boolean(this.typedName()), (_e, cx) => this.rename(index, cx)))
        .child(this.button(t, "ws-remove", "Remove", count > 1, (_e, cx) => this.remove(index, cx))));
  }

  partChip(t, part) {
    const isOn = this.parts.has(part.id);
    return div().id(`ws-part-${part.id}`).px(10).py(4).rounded(6).text_size(12).cursor_pointer()
      .border(1).border_color(isOn ? t.accent : t.border).bg(isOn ? t.selected : t.chrome).text_color(isOn ? t.foreground : t.muted)
      .hover((s) => s.bg(t.hover)).tooltip(part.about)
      .on_click((_e, cx) => this.togglePart(part.id, cx)).child(part.label);
  }

  render(t) {
    const canAdd = Boolean(this.typedName()) && this.workspaces.length < MAX_WORKSPACES;
    return v_flex().id("ws-root").flex_1().min_h(0).p(16).gap(14).overflow_y_scrollbar()
      .child(div().text_color(t.muted).child("Each workspace is a layout you switch to with alt+shift+number, or alt+PageUp / PageDown. Pick a chip above to edit its layout."))
      .child(v_flex().gap(2).children(this.workspaces.map((w, i) => this.row(t, w, i))))
      .child(v_flex().gap(10).pt(10).border_t(1).border_color(t.border)
        .child(Input.new(this.name).h(30).px(8).rounded(6).border_1().border_color(t.input).bg(t.background))
        .child(h_flex().gap(6).flex_wrap().children(PARTS.map((p) => this.partChip(t, p))))
        .child(h_flex().gap(8)
          .child(this.button(t, "ws-from-parts", "New from these parts", canAdd && this.parts.size > 0, (_e, cx) => this.addFromParts(cx)))
          .child(this.button(t, "ws-from-shown", "New from shown layout", canAdd, (_e, cx) => this.addFromShown(cx)))))
      .child(div().text_size(12).text_color(t.dim).child(this.message ?? ""));
  }
}
