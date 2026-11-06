// Skills: a footer button and a panel for agent-dotfiles' skills. The button (props.role
// "toggle") shows how many upstream sources wait for review and starts the periodic scan; the
// panel, a floating window so opening it never resizes a terminal, lists those sources and
// every skill's copies.

import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { agents, closeOverlay, exec, focused, hc, notify, props, run, theme } from "herdr";
import { STATE_DIR, backend, followFolder, readProgress, readScan } from "./store.js";
import { actionButton, ago, failureRow, groupHeading, skillRow, sourceRow } from "./rows.js";

const CHECK_DUE_MS = 60 * 60 * 1000;
const TABS = [["updates", "Updates"], ["skills", "Skills"]];

// A press that is not stopped drags the window.
const stayPut = (_e, cx) => cx.stop_propagation();

function openUrl(url) {
  exec("rundll32", ["url.dll,FileProtocolHandler", url]);
}

// The agent a hand-off goes to: the one in focus, or the last one that changed.
function chosenAgent() {
  const focusedAgent = focused()?.agent;
  const all = agents();
  return all.find((a) => a.address === focusedAgent) ?? [...all].sort((x, y) => y.seq - x.seq)[0] ?? null;
}

class Toggle {
  constructor(cx) {
    this.scan = null;
    this.reload(cx);
    this.scanIfDue(cx);
    followFolder(cx, STATE_DIR, (cx) => this.reload(cx));
    cx.timer.every(CHECK_DUE_MS, (cx) => this.scanIfDue(cx));
  }

  scanIfDue(cx) {
    cx.spawn(async () => {
      await backend("scan-if-due").catch(() => null);
    });
  }

  reload(cx) {
    cx.spawn(async (cx) => {
      this.scan = (await readScan()) ?? this.scan;
      cx.notify();
    });
  }

  render() {
    const t = theme();
    const waiting = this.scan?.changed?.length ?? 0;
    return h_flex().id("skills-toggle").size_full().gap(6).items_center().justify_center().cursor_pointer()
      .bg(t.chrome).border_t(1).border_l(1).border_color(t.border).text_size(12).text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .tooltip(waiting ? `${waiting} upstream sources to review` : "Skills")
      .on_click(() => run("mod.open", { name: "skills" }))
      .child(svg("mods/skills/icon.svg").size(14).flex_none())
      .child("Skills")
      .when(waiting > 0, (el) => el.child(div().px(5).rounded(4).text_size(11).bg(t.selected).text_color(t.accent).child(String(waiting))));
  }
}

export default class Skills extends View {
  init(_props, cx) {
    if (props()?.role === "toggle") {
      this.toggle = new Toggle(cx);
      return;
    }
    this.tab = localStorage.getItem("tab") ?? "updates";
    this.status = null;
    this.scan = null;
    this.progress = null;
    this.opened = null;
    this.armed = null; // the sync button waiting for its second click
    this.filter = InputState.new({ placeholder: "Filter by skill or repo" });
    this.filter.on("change", (_e, cx) => cx.notify());
    this.reloadScan(cx);
    followFolder(cx, STATE_DIR, (cx) => this.reloadScan(cx));
    cx.spawn(async (cx) => {
      await this.loadStatus();
      cx.notify();
      if (this.status.repo) followFolder(cx, this.status.repo, (cx) => this.reloadStatus(cx));
    });
  }

  async loadStatus() {
    this.status = await backend("status").catch((err) => ({ failure: String(err.message), skills: [] }));
  }

  reloadStatus(cx) {
    cx.spawn(async (cx) => {
      await this.loadStatus();
      cx.notify();
    });
  }

  reloadScan(cx) {
    cx.spawn(async (cx) => {
      const [scan, progress] = await Promise.all([readScan(), readProgress()]);
      this.scan = scan ?? this.scan;
      this.progress = progress;
      cx.notify();
    });
  }

  attempt(cx, work, done) {
    cx.spawn(async (cx) => {
      try {
        await work();
        if (done) notify({ title: done, level: "info" });
      } catch (err) {
        notify({ title: "Skills", body: String(err.message ?? err), level: "error" });
      }
      cx.notify();
    });
  }

  scanNow(cx) {
    this.attempt(cx, () => backend("scan"));
  }

  markReviewed(source, cx) {
    this.opened = null;
    this.attempt(cx, () => backend("pin", source.target, source.repo, source.path, source.latest), `${source.target} reviewed up to ${source.latest}`);
  }

  handOff(prompt, cx) {
    const agent = chosenAgent();
    if (!agent) return;
    this.attempt(cx, async () => {
      const r = await hc(["send", "--if", "idle", agent.address, prompt]);
      if (r.code !== 0) throw new Error(`${agent.space_name} is busy: send it when it stops`);
    }, `Sent to ${agent.space_name}`);
  }

  askToPort(source, cx) {
    this.handOff(`In ${this.status.repo}, review upstream changes for "${source.target}": ${source.compare} (path ${source.path} of ${source.repo}). Follow the refresh procedure in the header of skills/UPSTREAMS.tsv: port what fits the local adaptation, then move the row's pin to ${source.latest}.`, cx);
  }

  askToAudit(skill, cx) {
    this.handOff(`In ${this.status.repo}, audit skills/${skill.name}/SKILL.md with the skill-diet skill and tell me what you find before changing anything.`, cx);
  }

  // A sync replaces the installed copies, so the first click only arms the button.
  sync(id, names, cx) {
    if (this.armed !== id) {
      this.armed = id;
      cx.notify();
      return;
    }
    this.armed = null;
    this.attempt(cx, async () => {
      await backend("sync", ...names);
      await this.loadStatus();
    }, `Synced ${names.length === 1 ? names[0] : `${names.length} skills`}`);
  }

  toggleRow(key, cx) {
    this.opened = this.opened === key ? null : key;
    this.armed = null;
    cx.notify();
  }

  matches(...texts) {
    const query = this.filter.value().trim().toLowerCase();
    return !query || texts.some((text) => text?.toLowerCase().includes(query));
  }

  rowContext() {
    return {
      opened: this.opened,
      armed: this.armed,
      agent: chosenAgent(),
      onToggle: (key, cx) => this.toggleRow(key, cx),
      onOpenCompare: (source) => openUrl(source.compare),
      onAskPort: (source, cx) => this.askToPort(source, cx),
      onReviewed: (source, cx) => this.markReviewed(source, cx),
      onAskAudit: (skill, cx) => this.askToAudit(skill, cx),
      onSync: (skill, cx) => this.sync(`sync-${skill.name}`, [skill.name], cx),
    };
  }

  updatesList(t) {
    const message = (text) => [div().p(8).text_size(12).text_color(t.dim).child(text)];
    if (!this.scan?.at) return message(this.progress ? "First scan running" : "No scan yet");
    const context = this.rowContext();
    const changed = (this.scan.changed ?? []).filter((c) => this.matches(c.target, c.repo, c.path))
      .sort((x, y) => (y.commits[0]?.date ?? "").localeCompare(x.commits[0]?.date ?? ""));
    const errors = (this.scan.errors ?? []).filter((e) => this.matches(e.target, e.source));
    if (!changed.length && !errors.length) return message("Nothing to review");
    return [
      changed.length ? groupHeading(t, `To review · ${changed.length}`, t.accent) : null,
      ...changed.map((c) => sourceRow(t, c, context)),
      errors.length ? groupHeading(t, `Could not check · ${errors.length}`, t.ansi1) : null,
      ...errors.map((e) => failureRow(t, e)),
    ].filter(Boolean);
  }

  skillsList(t) {
    const context = this.rowContext();
    const skills = (this.status?.skills ?? []).filter((s) => this.matches(s.name, s.description, ...s.upstreams.map((u) => u.repo)));
    const inState = (state) => skills.filter((s) => s.state === state).sort((x, y) => x.name.localeCompare(y.name));
    const drift = inState("drift"), synced = inState("synced"), local = inState("local");
    const isArmed = this.armed === "sync-all";
    const syncAll = drift.length > 1 ? actionButton(t, "sync-all", isArmed ? "Replace copies?" : "Sync all", isArmed, (_e, cx) => this.sync("sync-all", drift.map((s) => s.name), cx)) : null;
    return [
      drift.length ? groupHeading(t, `Needs sync · ${drift.length}`, t.blocked, syncAll) : null,
      ...drift.map((s) => skillRow(t, s, context)),
      synced.length ? groupHeading(t, `In sync · ${synced.length}`, t.muted) : null,
      ...synced.map((s) => skillRow(t, s, context)),
      local.length ? groupHeading(t, `Only installed · ${local.length}`, t.muted) : null,
      ...local.map((s) => skillRow(t, s, context)),
    ].filter(Boolean);
  }

  scanLine(t) {
    const { scan, progress } = this;
    const text = progress ? `Scanning ${progress.done} of ${progress.total}`
      : scan?.failure ? `Scan failed: ${scan.failure}`
      : scan?.at ? `Scanned ${ago(scan.at)} · ${scan.checked} sources` : "Not scanned yet";
    return h_flex().flex_none().h(30).px(14).gap(6).items_center().text_size(11).text_color(scan?.failure ? t.ansi1 : t.dim)
      .when(Boolean(progress), (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(11).flex_none().text_color(t.working).spin(900)))
      .child(div().flex_1().min_w(0).truncate().child(text))
      .when(!progress, (el) => el.child(actionButton(t, "scan", "Scan now", false, (_e, cx) => this.scanNow(cx))));
  }

  tabButton(t, key, label, count) {
    const isShown = this.tab === key;
    return h_flex().id(`tab-${key}`).h(32).px(2).mr(14).gap(5).items_center().cursor_pointer().text_size(12)
      .border_b(isShown ? 2 : 0).border_color(t.foreground).text_color(isShown ? t.foreground : t.dim)
      .hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => {
        this.tab = key;
        this.opened = null;
        localStorage.setItem("tab", key);
        cx.notify();
      })
      .child(label)
      .child(div().text_color(t.dim).child(String(count)));
  }

  gitLine(t) {
    const git = this.status?.git;
    if (!git) return null;
    const parts = [git.branch, git.uncommitted ? `${git.uncommitted} uncommitted` : "clean", git.ahead ? `↑${git.ahead}` : null, git.behind ? `↓${git.behind}` : null];
    return h_flex().flex_none().h(28).px(14).items_center().border_t(1).border_color(t.border).text_size(11)
      .text_color(git.behind ? t.blocked : t.dim)
      .child(div().truncate().child(`agent-dotfiles · ${parts.filter(Boolean).join(" · ")}`));
  }

  render() {
    if (this.toggle) return this.toggle.render();
    const t = theme();
    const counts = { updates: this.scan?.changed?.length ?? 0, skills: this.status?.skills?.length ?? 0 };
    return v_flex().id("skills").size_full().min_h(0).bg(t.chrome).text_color(t.foreground)
      .child(h_flex().flex_none().h(42).px(14).gap(8).items_center()
        .child(svg("mods/skills/icon.svg").size(15).flex_none().text_color(t.muted))
        .child(div().flex_1().text_size(13).font_semibold().child("Skills"))
        .child(div().id("skills-close").w(22).h(22).flex().items_center().justify_center().rounded(5).cursor_pointer()
          .text_size(14).text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_mouse_down("left", stayPut).on_click(() => closeOverlay(props().overlay)).child("×")))
      .child(h_flex().flex_none().px(14).border_b(1).border_color(t.border)
        .children(TABS.map(([key, label]) => this.tabButton(t, key, label, counts[key]))))
      .child(div().id("skills-filter").flex_none().px(14).pt(10).pb(6).on_mouse_down("left", stayPut)
        .child(Input.new(this.filter).h(28).px(8).rounded(6).border_1().border_color(t.input).bg(t.background).text_size(12)))
      .when(this.tab === "updates", (el) => el.child(this.scanLine(t)))
      .when(Boolean(this.status?.failure), (el) => el.child(div().px(14).pb(6).text_size(11).text_color(t.ansi1).child(this.status.failure)))
      .child(v_flex().id("skills-list").flex_1().min_h(0).px(8).pb(8).gap(1).overflow_y_scrollbar().on_mouse_down("left", stayPut)
        .children(this.tab === "updates" ? this.updatesList(t) : this.skillsList(t)))
      .children([this.gitLine(t)].filter(Boolean));
  }
}
