// The inbox's interactive parts, drawn natively: the "New message" composer and each
// message's Edit / Save / Return to queue. Both talk to the dashboard's own JSON endpoints
// (POST /web/messages, /web/messages/{id}/{edit|save|release}) with the root token.
import { div } from "gpui-kit";
import { h_flex, v_flex, InputState, Input, TextareaState, Textarea } from "gpui-base";
import { notify } from "herdr";

const MAX_BODY = 8000;

async function postJson(pane, path, payload) {
  const r = await pane.request(path, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
  let data = {};
  try { data = await r.json(); } catch { /* an empty answer is fine */ }
  if (!r.ok) throw new Error(data.error ?? `ai-memory responded ${r.status}`);
  return data;
}

const button = (t, id, label, color, onClick, enabled = true) => div().id(id).h(24).px(10).flex().items_center().rounded(6)
  .border_1().border_color(color + "66").bg(color + (enabled ? "22" : "0d")).text_color(enabled ? color : t.dim)
  .when(enabled, (el) => el.cursor_pointer().hover((s) => s.bg(color + "40")).on_click(onClick)).child(label);

const chips = (t, id, items, chosen, pick) => h_flex().flex_wrap().gap(4).children(items.map((item, i) => div().id(`${id}-${i}`)
  .px(8).py(2).rounded(10).cursor_pointer().bg(i === chosen ? t.accent + "26" : t.raised).text_color(i === chosen ? t.accent : t.muted)
  .hover((s) => s.text_color(t.foreground)).on_click((_e, cx) => pick(i, cx)).child(item.label)));

export class Composer {
  constructor(pane) {
    this.pane = pane;
    this.choices = null;
    this.subject = null;
    this.body = null;
    this.from = 0;
    this.to = 0;
    this.agent = 0;
    this.status = null;
    this.sending = false;
  }

  // Called from a task (InputState needs a live host call, never render).
  setChoices(choices) {
    this.choices = choices;
    if (!this.subject) {
      this.subject = InputState.new({ placeholder: "Subject (optional)" });
      this.body = TextareaState.new({ placeholder: "Message: plain text, secrets are scrubbed", rows: 4 });
      this.body.set_auto_grow(4, 12);
      this.from = Math.max(0, choices.from.findIndex((o) => o.selected));
      this.to = Math.max(0, choices.to.findIndex((o) => o.selected));
    }
  }

  dirty() {
    return Boolean(this.body?.value().trim() || this.subject?.value().trim());
  }

  reset() {
    this.subject?.release();
    this.body?.release();
    this.subject = this.body = null;
    this.status = null;
  }

  agents() {
    const to = this.choices?.to[this.to];
    return (this.choices?.agents ?? []).filter((a) => a.workspace === to?.workspace && a.project === to?.project);
  }

  send(cx) {
    const from = this.choices.from[this.from];
    const to = this.choices.to[this.to];
    const agent = this.agents()[this.agent];
    const body = this.body.value();
    if (!agent || !body.trim()) return;
    this.sending = true;
    this.status = "Queuing…";
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        await postJson(this.pane, "messages", { from_workspace: from.workspace, from_project: from.project, to_workspace: to.workspace, to_project: to.project, to_agent: agent.agent, subject: this.subject.value(), body });
        this.subject.set_value("");
        this.body.set_value("");
        this.status = `Queued for ${agent.label} in ${to.project}. It reads it at its next inbox check.`;
        this.pane.load(this.pane.path, cx, { quiet: true });
      } catch (e) {
        this.status = `Not sent: ${e?.message ?? e}`;
      }
      this.sending = false;
      cx.notify();
    });
  }

  render(t) {
    if (!this.choices || !this.subject) return div();
    const agents = this.agents();
    const length = this.body.value().length;
    const label = (text) => div().pt(4).text_size(10.5).text_color(t.dim).child(text);
    const ready = agents.length > 0 && length > 0 && length <= MAX_BODY && !this.sending;
    return v_flex().gap(4).p(10).rounded(8).bg(t.background).border_1().border_color(t.border)
      .child(label("From project"))
      .child(chips(t, "cmp-from", this.choices.from, this.from, (i, cx) => { this.from = i; cx.notify(); }))
      .child(label("To project"))
      .child(chips(t, "cmp-to", this.choices.to, this.to, (i, cx) => { this.to = i; this.agent = 0; cx.notify(); }))
      .child(label("To agent"))
      .child(agents.length
        ? chips(t, "cmp-agent", agents, this.agent, (i, cx) => { this.agent = i; cx.notify(); })
        : div().text_color(t.dim).child("No agents registered in this project yet. Capture a session or choose another project."))
      .child(label("Subject"))
      .child(Input.new(this.subject).h(26).px(8).rounded(6).border_1().border_color(t.input).bg(t.chrome).text_size(12).text_color(t.foreground))
      .child(label(`Message · ${length} / ${MAX_BODY.toLocaleString("en")}`))
      .child(Textarea.new(this.body).px(8).py(6).rounded(6).border_1().border_color(length > MAX_BODY ? t.blocked : t.input).bg(t.chrome).text_size(12).text_color(t.foreground))
      .child(h_flex().pt(4).gap(8).items_center()
        .child(button(t, "cmp-send", "Queue message", t.accent, (_e, cx) => this.send(cx), ready))
        .child(div().flex_1().text_size(11).text_color(t.dim).child(this.status ?? "Queued for the agent's next inbox check. Sending does not start an agent.")));
  }
}

export class MailEditor {
  constructor(pane) {
    this.pane = pane;
    this.open = null; // { id, subject, body }
    this.status = null;
  }

  close() {
    this.open?.subject.release();
    this.open?.body.release();
    this.open = null;
    this.status = null;
  }

  edit(id, subject, body) {
    this.close();
    const s = InputState.new({ value: subject });
    const b = TextareaState.new({ value: body, rows: 4 });
    b.set_auto_grow(4, 12);
    this.open = { id, subject: s, body: b };
  }

  act(mail, scope, action, cx) {
    if (action === "resume") {
      this.edit(mail.id, mail.subject, mail.body);
      return cx.notify();
    }
    const payload = action === "save" ? { subject: this.open.subject.value(), body: this.open.body.value() } : {};
    const path = `messages/${encodeURIComponent(mail.id)}/${action === "begin" ? "edit" : action}`;
    this.status = "Working…";
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const data = await postJson(this.pane, path, { ...scope, ...payload });
        if (action === "begin") this.edit(mail.id, data.subject ?? mail.subject, data.body ?? mail.body);
        else this.close();
        if (action !== "begin") this.pane.load(this.pane.path, cx, { quiet: true });
        this.status = null;
      } catch (e) {
        this.status = String(e?.message ?? e);
        notify({ title: "AI Memory", body: this.status, level: "warning" });
      }
      cx.notify();
    });
  }

  render(t, mail, scope) {
    const editing = this.open?.id === mail.id;
    const state = { pending: t.accent, claimed: t.done, cancelled: t.dim, editing: "#fbbf24" }[mail.state] ?? t.muted;
    const card = v_flex().gap(4).p(10).rounded(8).bg(t.background).border_1().border_color(editing ? t.accent : t.border)
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().min_w(0).truncate().font_semibold().text_color(t.foreground).child(mail.subject || "(no subject)"))
        .child(div().px(6).rounded(8).text_size(10.5).text_color(state).bg(state + "22").child(mail.status || mail.state)))
      .child(div().text_size(11).text_color(t.muted).child(mail.route))
      .child(div().text_size(11).text_color(t.dim).child(`${mail.meta} · ${mail.id}`));
    if (!editing) {
      return card.child(div().pt(2).text_color(t.foreground).child(mail.body))
        .when(mail.actions.length > 0, (el) => el.child(h_flex().pt(4).gap(6).children(mail.actions.map((a) =>
          button(t, `mail-${mail.id}-${a.action}`, a.label, a.action === "release" ? t.muted : t.accent, (_e, cx) => this.act(mail, scope, a.action, cx))))));
    }
    return card
      .child(Input.new(this.open.subject).h(26).px(8).rounded(6).border_1().border_color(t.input).bg(t.chrome).text_size(12).text_color(t.foreground))
      .child(Textarea.new(this.open.body).px(8).py(6).rounded(6).border_1().border_color(t.input).bg(t.chrome).text_size(12).text_color(t.foreground))
      .child(h_flex().pt(4).gap(6).items_center()
        .child(button(t, `mail-${mail.id}-save`, "Save", t.accent, (_e, cx) => this.act(mail, scope, "save", cx)))
        .child(button(t, `mail-${mail.id}-release`, "Return to queue", t.muted, (_e, cx) => this.act(mail, scope, "release", cx)))
        .child(div().flex_1().text_size(11).text_color(t.dim).child(this.status ?? "The agent can't collect it while you edit.")));
  }
}
