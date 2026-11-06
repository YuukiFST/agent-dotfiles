// The panel's view of the ai-memory web dashboard: loads /web/ pages with the root token,
// shows their HTML through TextView and draws the parts that act natively, so links, tabs,
// filters, the message composer and message edits all work inside Herdr.
import { div } from "gpui-kit";
import { h_flex, v_flex, TextView, InputState, Input } from "gpui-base";
import { exec, notify } from "herdr";
import { prepare, webPath, WEB } from "./web.js";
import { Composer, MailEditor } from "./mail.js";

const RELOAD_MS = 20000;
const HISTORY = 30;

export class WebPane {
  constructor(api, cx) {
    this.api = api;
    this.path = null;
    this.history = [];
    this.page = null;
    this.error = null;
    this.loading = false;
    this.inputs = {}; // `${form}:${name}` -> InputState, kept across refreshes of one page
    this.values = {}; // `${form}:${name}` -> chosen value of selects and checkboxes
    this.openSelect = null;
    this.composer = new Composer(this);
    this.editor = new MailEditor(this);
    this.version = 0; // TextView ids change with the content
    cx.timer.every(RELOAD_MS, (cx) => this.path !== null && !this.busy() && this.load(this.path, cx, { quiet: true }));
  }

  // Typing or editing in progress: an automatic reload would throw it away.
  busy() {
    return this.loading || this.editor.open || this.composer.dirty() || this.openSelect !== null;
  }

  async request(path, options = {}) {
    return fetch(WEB + path, { ...options, headers: { Authorization: `Bearer ${this.api.token}`, "X-Ai-Memory-UI": "1", ...(options.headers ?? {}) } });
  }

  // Shows `path` (relative to /web/). `push` keeps the current page for ‹ back.
  load(path, cx, { push = false, quiet = false } = {}) {
    if (!this.api.token) return;
    const same = path === this.path;
    if (push && this.path !== null && !same) this.history = [...this.history, this.path].slice(-HISTORY);
    if (!same) this.reset();
    this.path = path;
    this.loading = !quiet;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await this.request(path, { headers: { Accept: "text/html" } });
        if (/\/web\/login/.test(r.url ?? "")) throw new Error("the dashboard asked to sign in");
        if (!r.ok) throw new Error(`ai-memory responded ${r.status}`);
        const text = await r.text();
        if (quiet && text === this.lastText && path === this.path) {
          this.loading = false;
          return;
        }
        this.lastText = text;
        const page = await prepare(text, path, () => cx.sleep(0));
        if (path !== this.path) return; // another page was asked for meanwhile; its load owns `loading`
        this.page = page;
        localStorage.setItem("webPath", path);
        this.makeInputs();
        this.version++;
        this.error = null;
      } catch (e) {
        this.error = `Couldn't load ${path || "home"}: ${String(e?.message ?? e).slice(0, 100)}`;
      }
      this.loading = false;
      cx.notify();
    });
  }

  reset() {
    for (const s of Object.values(this.inputs)) s.release();
    this.inputs = {};
    this.values = {};
    this.openSelect = null;
    this.editor.close();
    this.composer.reset();
  }

  leave() {
    this.reset();
    this.path = null;
    this.page = null;
    this.lastText = null;
    this.history = [];
  }

  back(cx) {
    const prev = this.history.pop();
    if (prev !== undefined) this.load(prev, cx);
  }

  // Text fields get retained state (created here, outside render); a refresh keeps what was typed.
  makeInputs() {
    for (const seg of this.page.segments) {
      if (seg.kind === "composer") this.composer.setChoices(seg.composer);
      if (seg.kind !== "form") continue;
      const form = seg.form;
      for (const f of form.fields) {
        const key = `${form.index}:${f.name}`;
        if (["text", "search", "date", "datetime-local", "number", "email", "url", "textarea"].includes(f.type)) {
          if (this.inputs[key]) continue;
          const state = InputState.new({ placeholder: f.label || f.name, value: f.value });
          state.on("submit", (_e, cx) => this.submit(form, cx));
          this.inputs[key] = state;
        } else if (!(key in this.values) && f.type !== "hidden") {
          this.values[key] = f.type === "checkbox" ? f.checked : f.value;
        }
      }
    }
  }

  fieldValue(form, f) {
    const key = `${form.index}:${f.name}`;
    if (this.inputs[key]) return this.inputs[key].value();
    if (f.type === "checkbox") return (this.values[key] ?? f.checked) ? f.value || "on" : null;
    return this.values[key] ?? f.value;
  }

  submit(form, cx) {
    const pairs = form.fields.filter((f) => f.name).map((f) => [f.name, this.fieldValue(form, f)]).filter(([, v]) => v !== null && v !== undefined);
    const query = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const base = (form.action ? webPath(form.action) : null) ?? this.path.replace(/[?#].*$/, "");
    if (form.method === "get") return this.load(`${base}?${query}`, cx, { push: true });
    cx.spawn(async (cx) => {
      try {
        const r = await this.request(base, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: query });
        if (!r.ok) throw new Error(`ai-memory responded ${r.status}`);
        notify({ title: "AI Memory", body: `${form.submit ?? "Sent"}: done` });
      } catch (e) {
        notify({ title: "AI Memory", body: String(e?.message ?? e), level: "warning" });
      }
      this.load(this.path, cx, { quiet: true });
    });
  }

  // TextView reports resolved URLs: dashboard links open here, the rest in the browser.
  follow(url, cx) {
    const path = webPath(url);
    if (path !== null) return this.load(path, cx, { push: true });
    if (/^https?:\/\//.test(url)) exec("cmd.exe", ["/c", "start", "", url]);
  }

  openInBrowser() {
    if (this.path !== null) exec("cmd.exe", ["/c", "start", "", WEB + this.path]);
  }

  render(t) {
    const bar = h_flex().px(12).py(6).gap(8).items_center().border_b(1).border_color(t.border)
      .child(div().id("web-back").text_color(this.history.length ? t.muted : t.dim)
        .when(this.history.length > 0, (el) => el.cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => this.back(cx)))
        .child("‹ back"))
      .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).font_semibold().child(this.page?.title ?? "…"))
      .when(this.loading, (el) => el.child(div().text_size(11).text_color(t.dim).child("loading…")))
      .child(div().id("web-open").text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
        .tooltip("open this page in the browser (asks to sign in)").on_click(() => this.openInBrowser()).child("↗"));
    const body = v_flex().id(`web-body-${this.path}`).flex_1().min_h(0).overflow_y_scrollbar().px(12).py(8).gap(8);
    if (this.error) body.child(div().text_color(t.blocked).child(this.error));
    if (this.page) this.page.segments.forEach((seg, i) => body.child(this.segment(t, seg, i)));
    return v_flex().flex_1().min_h(0).child(bar).child(body);
  }

  segment(t, seg, i) {
    if (seg.kind === "html") {
      return TextView.html(`web-${this.version}-${i}`, seg.html).selectable(true).text_size(12.5).text_color(t.foreground)
        .on_link_click((url, cx) => this.follow(url, cx));
    }
    if (seg.kind === "tabs") return this.tabs(t, seg.tabs);
    if (seg.kind === "form") return this.form(t, seg.form);
    if (seg.kind === "composer") return this.composer.render(t);
    return this.editor.render(t, seg.mail, this.page.mailScope);
  }

  tabs(t, tabs) {
    return h_flex().flex_wrap().gap(2).border_b(1).border_color(t.border).children(tabs.map((tab, i) => div().id(`web-tab-${i}`)
      .px(8).py(4).cursor_pointer().border_b(2).border_color(tab.selected ? t.accent : "#00000000")
      .text_color(tab.selected ? t.foreground : t.muted).hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => tab.path !== null && this.load(tab.path, cx, { push: true })).child(tab.label)));
  }

  form(t, form) {
    const visible = form.fields.filter((f) => f.type !== "hidden");
    if (!visible.length) return div();
    const hasText = visible.some((f) => this.inputs[`${form.index}:${f.name}`]);
    return h_flex().flex_wrap().gap(8).items_end().p(8).rounded(8).bg(t.background).border_1().border_color(t.border)
      .children(visible.map((f) => this.field(t, form, f)))
      .when(hasText || form.method !== "get", (el) => el.child(div().id(`web-go-${form.index}`).h(26).px(10).flex().items_center().rounded(6)
        .bg(t.solid).text_color(t.solid_foreground).cursor_pointer().on_click((_e, cx) => this.submit(form, cx)).child(form.submit || "Go")));
  }

  field(t, form, f) {
    const key = `${form.index}:${f.name}`;
    const label = div().text_size(10.5).text_color(t.dim).child(f.label || f.name);
    if (this.inputs[key]) {
      return v_flex().gap(2).min_w(140).flex_1().child(label)
        .child(Input.new(this.inputs[key]).h(26).px(8).rounded(6).border_1().border_color(t.input).bg(t.chrome).text_size(12).text_color(t.foreground));
    }
    if (f.type === "checkbox") {
      const on = Boolean(this.values[key]);
      return h_flex().id(`web-cb-${key}`).h(26).gap(6).items_center().cursor_pointer()
        .on_click((_e, cx) => { this.values[key] = !on; cx.notify(); })
        .child(div().size(12).rounded(3).border_1().border_color(t.input).when(on, (e) => e.bg(t.accent))).child(f.label || f.name);
    }
    if (f.type !== "select") return div();
    const chosen = f.options.find((o) => o.value === this.values[key]) ?? f.options[0];
    const open = this.openSelect === key;
    return v_flex().gap(2).min_w(120).child(label)
      .child(div().id(`web-sel-${key}`).h(26).px(8).flex().items_center().gap(6).rounded(6).border_1().border_color(open ? t.accent : t.input)
        .bg(t.chrome).cursor_pointer().on_click((_e, cx) => { this.openSelect = open ? null : key; cx.notify(); })
        .child(div().flex_1().truncate().child(chosen?.label ?? "—")).child(div().text_color(t.dim).child("▾")))
      .when(open, (el) => el.child(v_flex().id(`web-opts-${key}`).max_h(220).overflow_y_scrollbar().rounded(6).border_1().border_color(t.border).bg(t.raised)
        .children(f.options.map((o, i) => div().id(`web-opt-${key}-${i}`).px(8).py(3).cursor_pointer().hover((s) => s.bg(t.hover))
          .text_color(o.value === chosen?.value ? t.accent : t.foreground)
          .on_click((_e, cx) => {
            this.values[key] = o.value;
            this.openSelect = null;
            if (form.method === "get" && !form.fields.some((x) => this.inputs[`${form.index}:${x.name}`])) this.submit(form, cx);
            cx.notify();
          }).child(o.label)))));
  }
}
