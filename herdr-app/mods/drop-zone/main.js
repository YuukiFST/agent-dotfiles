// Shown over the whole window while a session is dragged out of the sidebar (spaces or
// agents): a compass in the middle drops it beside the open session. Releasing the drag
// keeps it open; a click on an arrow places the session, a click anywhere else cancels.
// The dragged terminals come in shared("drag.session").
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { shared, setShared, focused, panes, run, theme, props, closeOverlay, notify } from "herdr";

export const DRAG_KEY = "drag.session";
// terminal -> { name, at }: what each dropped session was called before it joined another
// tab, for the Spaces list's rows under that tab.
export const ORIGIN_KEY = "session.origin";
const GIVE_UP_MS = 60000;

// Where each drop puts the terminal: keep it right/down of the open session, and for
// left/up swap it back past that session.
const PLACES = {
  left: { keep: "right", swap: "left", glyph: "←", label: "left" },
  right: { keep: "right", swap: null, glyph: "→", label: "right" },
  up: { keep: "down", swap: "up", glyph: "↑", label: "above" },
  down: { keep: "down", swap: null, glyph: "↓", label: "below" },
  tab: { keep: "tab", swap: null, glyph: "+", label: "new tab" },
};

export default class DropZone extends View {
  init(_props, cx) {
    this.closed = false;
    this.placing = false;
    cx.timer.after(GIVE_UP_MS, () => this.close());
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    setShared(DRAG_KEY, null);
    closeOverlay(props()?.overlay);
  }

  // Parks each terminal, then keeps it beside the open session. The overlay stays open
  // (drawn empty) until the last step: its timers end with it, and a terminal parked
  // without its keep is left running with no pane.
  drop(where, cx) {
    if (this.placing) return;
    const drag = shared(DRAG_KEY);
    const anchor = focused()?.terminal;
    // The anchor's own pane, by id: pane.focus {terminal} would pick a layout block showing
    // that terminal, and keep right/down fails from a layout block.
    const anchorPane = panes().find((p) => p.terminal === anchor)?.pane;
    const place = PLACES[where];
    const moving = (drag?.terminals ?? []).filter((t) => t !== anchor);
    if (!place || !moving.length) { this.close(); return; }
    this.placing = true;
    if (drag?.label) {
      const origin = { ...(shared(ORIGIN_KEY) ?? {}) };
      for (const terminal of moving) origin[terminal] = { name: drag.label, at: Date.now() };
      setShared(ORIGIN_KEY, origin);
    }
    setShared(DRAG_KEY, null);
    cx.notify();
    for (const terminal of moving) run("terminal.park", { terminal });
    moving.forEach((terminal, k) => {
      const at = 300 + 500 * k;
      const keep = place.keep !== "tab" && anchorPane ? place.keep : "tab";
      if (keep !== "tab") cx.timer.after(at, () => run("pane.focus", { pane: anchorPane }));
      cx.timer.after(at + 220, () => run("terminal.keep", { terminal, place: keep }));
      if (place.swap && keep !== "tab") cx.timer.after(at + 420, () => run("pane.swap", { direction: place.swap }));
    });
    const end = 300 + 500 * moving.length + 1500;
    cx.timer.after(end, () => {
      const lost = moving.filter((terminal) => !panes().some((p) => p.terminal === terminal));
      for (const terminal of lost) run("terminal.keep", { terminal, place: "tab" });
      if (lost.length) notify({ title: "Couldn't place it beside the open session", body: "It's open as a new tab instead.", level: "warning" });
      this.close();
    });
  }

  zone(t, where) {
    const p = PLACES[where];
    return v_flex().id(`dz-${where}`).size(88).rounded(12).items_center().justify_center().gap(2)
      .bg(t.raised).border(2).border_color(t.border).text_color(t.muted)
      .hover((s) => s.bg(t.selected).border_color(t.accent).text_color(t.foreground))
      // Only a click drops: releasing the drag over it keeps the compass open.
      .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.drop(where, cx); })
      .child(div().text_size(26).child(p.glyph))
      .child(div().text_size(11).child(p.label));
  }

  render() {
    const t = theme();
    if (this.placing) return div().size_full();
    const drag = shared(DRAG_KEY);
    const target = panes().find((p) => p.terminal && p.terminal === focused()?.terminal);
    const name = drag?.label ?? "session";
    const gap = () => div().size(88);
    return v_flex().id("dz-root").size_full().items_center().justify_center().bg("#00000066")
      .on_mouse_down("left", () => this.close())
      .child(v_flex().gap(8).p(16).rounded(16).bg(t.chrome).border(1).border_color(t.border).items_center()
        .child(div().pb(4).text_color(t.foreground).text_size(13).child(`Place ${name}`))
        .child(div().pb(6).text_color(t.dim).text_size(11.5).child(`next to ${target?.title || "the open session"}`))
        .child(h_flex().gap(8).child(gap()).child(this.zone(t, "up")).child(gap()))
        .child(h_flex().gap(8).child(this.zone(t, "left")).child(this.zone(t, "tab")).child(this.zone(t, "right")))
        .child(h_flex().gap(8).child(gap()).child(this.zone(t, "down")).child(gap())));
  }
}
