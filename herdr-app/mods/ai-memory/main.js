import { View, div } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { theme, notify, props, run } from "herdr";
import { MemoryApi } from "./api.js";
import * as views from "./views.js";
import { WebPane } from "./webview.js";

const POLL_MS = 60000;
const TABS = [
  ["overview", "Overview"], ["project", "Project"], ["inbox", "Inbox"], ["pages", "Pages"], ["sessions", "Sessions"],
  ["search", "Search"], ["pending", "Pending"], ["workstreams", "Workstreams"], ["health", "Health"], ["graph", "Graph"], ["docs", "Docs"],
];
// Tabs that show a page of the web dashboard (path under /web/), and whether they follow the chosen project.
const WEB_TABS = {
  project: { path: (p) => `w/${encodeURIComponent(p.workspace_name)}/${encodeURIComponent(p.project_name)}`, perProject: true },
  inbox: { path: (p) => `inbox?workspace=${encodeURIComponent(p.workspace_name)}&project=${encodeURIComponent(p.project_name)}`, perProject: true },
  pending: { path: () => "pending" },
  workstreams: { path: () => "workstreams" },
  health: { path: () => "health" },
  graph: { path: () => "graph" },
  docs: { path: () => "docs" },
};

export default class AiMemory extends View {
  init(_props, cx) {
    this.api = new MemoryApi();
    this.error = null;
    this.projects = [];
    this.overview = null;
    this.capture = null;
    this.tab = localStorage.getItem("tab") ?? "overview";
    this.project = localStorage.getItem("project");
    this.pages = null;
    this.sessions = null;
    this.session = null;
    this.observations = null;
    this.open = JSON.parse(localStorage.getItem("open") ?? "null"); // { project, path }
    this.page = null;
    this.results = null;
    this.global = true;
    this.query = InputState.new({ placeholder: "Search memory… (Enter)" });
    this.query.on("submit", (_e, cx) => this.search(cx));
    this.web = new WebPane(this.api, cx);
    cx.spawn(async (cx) => {
      if (!(await this.api.connect())) { this.error = "ai-memory token not found"; cx.notify(); return; }
      this.refresh(cx, true);
      if (this.open) this.openPage(this.open.project, this.open.path, cx);
    });
    cx.timer.every(POLL_MS, (cx) => this.refresh(cx));
  }

  projectInfo(name) { return this.projects.find((p) => p.project_name === name) ?? null; }

  refresh(cx, first = false) {
    if (!this.api.token) return;
    cx.spawn(async (cx) => {
      try {
        const list = await this.api.projects();
        this.projects = list.sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""));
        if (!this.projectInfo(this.project)) {
          this.project = (this.projects.find((p) => p.page_count > 0) ?? this.projects[0])?.project_name ?? null;
        }
        const ws = this.projects[0]?.workspace_name ?? "default";
        [this.overview, this.capture] = await Promise.all([
          this.api.overview(ws).catch(() => null),
          this.api.capture().catch(() => null),
        ]);
        this.error = null;
        await this.loadTab();
        if (first || (WEB_TABS[this.tab] && this.web.path === null)) this.showWeb(cx, first);
        else if (WEB_TABS[this.tab] && !this.web.busy()) this.web.load(this.web.path, cx, { quiet: true });
      } catch (e) {
        this.error = `ai-memory down? ${String(e?.message ?? e).slice(0, 80)}`;
      }
      cx.notify();
    });
  }

  async loadTab() {
    const p = this.projectInfo(this.project);
    if (!p) return;
    if (this.tab === "pages") {
      const pages = await this.api.pages(p);
      this.pages = pages.sort((a, b) => views.kindRank(a.kind) - views.kindRank(b.kind) || b.updated_at.localeCompare(a.updated_at));
    }
    if (this.tab === "sessions" && !this.session) this.sessions = await this.api.sessions(p);
  }

  // Loads the chosen web tab's page from the start (its link history cleared).
  // `resume`: at start, reopen the dashboard page the panel showed last.
  showWeb(cx, resume = false) {
    const spec = WEB_TABS[this.tab];
    if (!spec) return;
    const p = this.projectInfo(this.project) ?? { workspace_name: "default", project_name: this.project ?? "" };
    this.web.history = [];
    this.web.load((resume && localStorage.getItem("webPath")) || spec.path(p), cx);
  }

  setTab(tab, cx) {
    this.tab = tab;
    localStorage.setItem("tab", tab);
    this.session = null;
    this.observations = null;
    if (WEB_TABS[tab]) this.showWeb(cx);
    else this.web.leave(); // its 20 s reload stops until a web tab is back
    cx.notify();
    cx.spawn(async (cx) => {
      try { await this.loadTab(); } catch (e) { this.error = String(e?.message ?? e); }
      cx.notify();
    });
  }

  openProject(name, tab, cx) {
    this.project = name;
    localStorage.setItem("project", name);
    this.pages = null;
    this.sessions = null;
    if (this.tab === "search" && tab === "search" && this.query.value().trim()) this.search(cx);
    this.setTab(tab, cx);
  }

  webBody(t) {
    if (!WEB_TABS[this.tab].perProject) return this.web.render(t);
    return v_flex().flex_1().min_h(0).child(views.projectChips(t, this)).child(this.web.render(t));
  }

  openPage(project, path, cx) {
    this.open = { project, path };
    localStorage.setItem("open", JSON.stringify(this.open));
    this.page = null;
    cx.notify();
    cx.spawn(async (cx) => {
      const p = this.projectInfo(project) ?? { workspace_name: "default", project_name: project };
      try {
        this.page = await this.api.page(p, path);
      } catch (e) {
        this.closePage(cx);
        notify({ title: "Page failed to open", body: String(e?.message ?? e), level: "warning" });
      }
      cx.notify();
    });
  }

  closePage(cx) {
    this.open = null;
    this.page = null;
    localStorage.removeItem("open");
    cx.notify();
  }

  openSession(s, cx) {
    this.session = s;
    this.observations = null;
    cx.notify();
    cx.spawn(async (cx) => {
      try { this.observations = await this.api.observations(this.projectInfo(this.project), s.session_id); }
      catch (e) { this.observations = []; this.error = String(e?.message ?? e); }
      cx.notify();
    });
  }

  closeSession(cx) {
    this.session = null;
    this.observations = null;
    cx.notify();
  }

  search(cx) {
    const q = this.query.value().trim();
    if (!q || !this.api.token) return;
    cx.spawn(async (cx) => {
      try { this.results = await this.api.search(q, this.global ? null : this.projectInfo(this.project)); }
      catch (e) { this.results = []; this.error = String(e?.message ?? e); }
      cx.notify();
    });
  }

  header(t) {
    const block = props()?.block;
    const icon = (id, glyph, tip, action) => div().id(id).px(4).text_color(t.dim).cursor_pointer()
      .hover((s) => s.text_color(t.foreground)).tooltip(tip).on_click(action).child(glyph);
    return v_flex().border_b(1).border_color(t.border)
      .child(h_flex().px(12).pt(8).items_center().gap(4)
        .child(div().font_semibold().text_color(t.foreground).child("AI Memory"))
        .child(div().flex_1())
        .child(icon("mem-refresh", "↻", "refresh", (_e, cx) => this.refresh(cx)))
        .when(Boolean(block), (el) => el.child(icon("mem-close", "×", "close (ctrl+shift+m reopens)",
          () => run("layout.hide", { id: block })))))
      .child(h_flex().px(8).pt(6).gap(2).flex_wrap().children(TABS.map(([id, label]) => {
        const on = this.tab === id;
        return div().id(`mem-tab-${id}`).px(8).py(4).cursor_pointer().border_b(2).border_color(on ? t.accent : "#00000000")
          .text_color(on ? t.foreground : t.muted).hover((s) => s.text_color(t.foreground))
          .on_click((_e, cx) => this.setTab(id, cx)).child(label);
      })));
  }

  body(t) {
    if (this.open) return views.page(t, this);
    if (this.tab === "overview") return views.overview(t, this);
    if (WEB_TABS[this.tab]) return this.webBody(t);
    if (this.tab === "pages") return v_flex().flex_1().min_h(0).child(views.projectChips(t, this)).child(views.pages(t, this));
    if (this.tab === "sessions") {
      if (this.session) return views.session(t, this);
      return v_flex().flex_1().min_h(0).child(views.projectChips(t, this)).child(views.sessions(t, this));
    }
    const scope = h_flex().id("mem-scope").gap(6).items_center().cursor_pointer().text_size(11).text_color(t.muted)
      .on_click((_e, cx) => { this.global = !this.global; this.search(cx); cx.notify(); })
      .child(div().size(12).rounded(3).border_1().border_color(t.input).when(this.global, (e) => e.bg(t.accent)))
      .child(div().child("all projects"));
    return v_flex().flex_1().min_h(0)
      .child(v_flex().px(12).pt(10).gap(6)
        .child(Input.new(this.query).h(28).px(8).rounded(7).border_1().border_color(t.input).bg(t.background)
          .text_size(12).text_color(t.foreground))
        .child(scope))
      .when(!this.global, (el) => el.child(views.projectChips(t, this)))
      .child(views.results(t, this));
  }

  render() {
    const t = theme();
    return v_flex().size_full().bg(t.chrome).text_size(12)
      .when(!this.open, (el) => el.child(this.header(t)))
      .when(Boolean(this.error), (el) => el.child(div().px(12).pt(6).text_color(t.blocked).child(this.error)))
      .child(this.body(t));
  }
}
