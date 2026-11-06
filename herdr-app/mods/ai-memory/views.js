// The panel's screens. Each takes the theme, the panel (its state) and returns elements;
// clicks call back into the panel.
import { div } from "gpui-kit";
import { h_flex, v_flex, TextView } from "gpui-base";

// Maintained pages first, then notes, then raw session summaries.
const KINDS = [
  ["rule", "Rules"], ["gotcha", "Gotchas"], ["decision", "Decisions"], ["procedure", "Procedures"],
  ["fact", "Notes"], ["note", "Notes"], ["concept", "Concepts"], ["session", "Sessions"],
];
export const KIND_LABEL = Object.fromEntries(KINDS);
export const kindRank = (k) => { const i = KINDS.findIndex(([kind]) => kind === k); return i < 0 ? KINDS.length : i; };

const OBS_COLORS = { "user-prompt": "#60a5fa", stop: "#4ade80", "post-tool-use": null, "session-start": "#c084fc", "session-end": "#c084fc" };

export function ago(iso) {
  if (!iso) return "—";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

// "5m ago", or "just now" (ago() says "now" under a minute).
export function agoPhrase(iso) {
  const a = ago(iso);
  return a === "now" ? "just now" : a === "—" ? a : `${a} ago`;
}

function span(a, b) {
  const s = ((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, "0")}`;
}

export function compact(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

const pad2 = (n) => String(n).padStart(2, "0");
function stamp(iso) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const shortName = (name) => name.replace(/^[^-]+-/, "");
const unmark = (s) => s.replace(/<\/?mark>/g, "").replace(/\s+/g, " ").trim();

const section = (t, title) => div().px(12).pt(12).pb(6).text_size(10.5).font_semibold().text_color(t.dim).child(title.toUpperCase());
const empty = (t, text) => div().px(12).py(10).text_color(t.dim).child(text);

function stat(t, label, value, accent) {
  return v_flex().flex_1().min_w(96).p(10).gap(4).rounded(8).bg(t.background).border_1().border_color(t.border)
    .child(div().text_size(11).text_color(t.muted).child(label))
    .child(div().text_size(22).font_semibold().text_color(accent ?? t.foreground).child(value));
}

export function overview(t, m) {
  const ps = m.projects;
  const sum = (k) => ps.reduce((a, p) => a + (p[k] ?? 0), 0);
  const cap = m.capture;
  const brief = m.overview?.briefing;
  const health = (label, value, bad) => v_flex().flex_1().min_w(90).pl(10).gap(2).border_l(2).border_color(bad ? t.blocked : t.border)
    .child(div().text_size(11).text_color(t.muted).child(label))
    .child(div().text_size(16).font_semibold().text_color(bad ? t.blocked : value > 0 ? t.done : t.foreground).child(compact(value)));
  return v_flex().id("mem-overview").flex_1().overflow_y_scrollbar().pb(12)
    .child(h_flex().flex_wrap().gap(8).px(12).pt(12)
      .child(stat(t, "Projects", String(ps.length)))
      .child(stat(t, "Sessions", compact(sum("session_count"))))
      .child(stat(t, "Captured events", compact(sum("observation_count"))))
      .child(stat(t, "Compiled pages", compact(sum("page_count"))))
      .child(stat(t, "Open sessions", String(sum("open_session_count")), "#fbbf24")))
    .child(section(t, "Capture health"))
    .child(cap
      ? v_flex().mx(12).p(10).gap(8).rounded(8).bg(t.background).border_1().border_color(t.border)
        .child(h_flex().flex_wrap().gap(8)
          .child(health("Accepted", cap.accepted))
          .child(health("Dropped (policy)", cap.dropped, cap.dropped > 0))
          .child(health("Capacity", cap.saturated, cap.saturated > 0))
          .child(health("Rate-limit", cap.rateLimited, cap.rateLimited > 0)))
        .child(div().text_size(11).text_color(t.dim).child(
          `Last write ${cap.lastWrite ?? "—"} · pending queue ${compact(cap.spoolPending)} · counters since server start`))
      : empty(t, "ai-memory status unavailable"))
    .when(Boolean(brief), (el) => el.child(h_flex().px(12).pt(8).gap(12).text_size(11.5).text_color(t.muted)
      .child(div().child(`7 days: ${brief.activity_7d.sessions} sessions · ${compact(brief.activity_7d.observations)} events · ${brief.activity_7d.pages_updated} pages`))
      .when(brief.pending_handoff_count + brief.pending_message_count > 0, (el) => el.child(div().text_color("#fbbf24")
        .child(`${brief.pending_handoff_count} handoffs · ${brief.pending_message_count} pending messages`)))))
    .child(section(t, `Projects (${ps.length})`))
    .child(v_flex().gap(8).px(12).children(ps.map((p) => projectCard(t, m, p))));
}

function projectCard(t, m, p) {
  const cell = (label, value, color) => v_flex().flex_1().min_w(70).gap(1)
    .child(div().text_size(10.5).text_color(t.dim).child(label))
    .child(div().text_size(15).font_semibold().text_color(color ?? t.foreground).child(value));
  return v_flex().id(`mem-card-${p.project_name}`).p(10).gap(8).rounded(8).bg(t.background).border_1().border_color(t.border)
    .cursor_pointer().hover((s) => s.border_color(t.accent))
    .on_click((_e, cx) => m.openProject(p.project_name, "project", cx))
    .child(h_flex().gap(6).items_center()
      .child(div().text_size(10.5).text_color(t.dim).child(p.workspace_name))
      .child(div().flex_1().min_w_0().truncate().font_semibold().text_color(t.foreground).child(p.project_name)))
    .child(h_flex().flex_wrap().gap(8)
      .child(cell("Sessions", String(p.session_count)))
      .child(cell("Events", compact(p.observation_count)))
      .child(cell("Pages", String(p.page_count)))
      .child(cell("Open", String(p.open_session_count), p.open_session_count ? "#fbbf24" : null)))
    .child(h_flex().gap(10).text_size(11).text_color(t.dim)
      .child(div().flex_1().child(`Last capture ${agoPhrase(p.last_activity)}`))
      .child(div().id(`mem-card-s-${p.project_name}`).text_color(t.accent).cursor_pointer()
        .on_click((_e, cx) => { cx.stop_propagation(); m.openProject(p.project_name, "sessions", cx); }).child("sessions ›")));
}

export function projectChips(t, m) {
  return h_flex().id("mem-projects").px(12).pt(8).gap(4).overflow_x_scroll().children(m.projects.map((p) => {
    const on = p.project_name === m.project;
    return div().id(`mem-p-${p.project_name}`).flex_none().px(8).py(2).rounded(10).cursor_pointer()
      .bg(on ? t.accent + "26" : t.raised).text_color(on ? t.accent : t.muted).hover((s) => s.text_color(t.foreground))
      .tooltip(`${p.project_name} · ${p.page_count} pages · ${p.session_count} sessions`)
      .on_click((_e, cx) => m.openProject(p.project_name, m.tab, cx))
      .child(shortName(p.project_name));
  }));
}

function pageRow(t, m, p, snippet) {
  return v_flex().id(`mem-${p.project}-${p.path}`).px(12).py(5).gap(1).cursor_pointer()
    .hover((s) => s.bg(t.hover))
    .on_click((_e, cx) => m.openPage(p.project, p.path, cx))
    .child(h_flex().gap(6).items_center()
      .child(div().flex_1().min_w_0().truncate().text_color(t.foreground).child(p.title || p.path))
      .when(Boolean(p.updated_at), (el) => el.child(div().flex_none().text_color(t.dim).child(ago(p.updated_at)))))
    .when(Boolean(snippet), (el) => el.child(div().text_color(t.dim).truncate().child(snippet)))
    .when(Boolean(m.global && p.project), (el) => el.child(div().text_size(10.5).text_color(t.accent).child(shortName(p.project))));
}

export function pages(t, m) {
  if (!m.pages) return empty(t, "loading…");
  if (m.pages.length === 0) return empty(t, "no pages in this project");
  const rows = [];
  let kind = null;
  for (const p of m.pages) {
    if (p.kind !== kind) { kind = p.kind; rows.push(section(t, KIND_LABEL[kind] ?? kind)); }
    rows.push(pageRow(t, m, { ...p, project: m.project }));
  }
  return v_flex().id("mem-pages").flex_1().overflow_y_scrollbar().pb(8).children(rows);
}

export function page(t, m) {
  const p = m.page;
  const bar = backBar(t, m, p?.title ?? m.open.path, (cx) => m.closePage(cx));
  if (!p) return v_flex().size_full().child(bar).child(empty(t, "loading…"));
  const meta = `${KIND_LABEL[p.kind] ?? p.kind} · ${p.tier} · updated ${agoPhrase(p.updated_at)}${p.pinned ? " · pinned" : ""}`;
  return v_flex().size_full().child(bar)
    .child(div().px(12).pt(6).text_size(11).text_color(t.dim).child(meta))
    .child(div().id("mem-body").flex_1().overflow_y_scrollbar().px(12).py(8).text_size(12.5).text_color(t.foreground)
      .child(TextView.markdown(`mem-md-${p.id}`, p.body_markdown || "_(empty page)_")));
}

function backBar(t, m, title, back) {
  return h_flex().px(12).py(7).gap(8).items_center().border_b(1).border_color(t.border)
    .child(div().id("mem-back").text_color(t.muted).cursor_pointer().hover((s) => s.text_color(t.foreground))
      .on_click((_e, cx) => back(cx)).child("‹ back"))
    .child(div().flex_1().min_w_0().truncate().text_color(t.foreground).font_semibold().child(title));
}

export function sessions(t, m) {
  if (!m.sessions) return empty(t, "loading…");
  if (m.sessions.length === 0) return empty(t, "no sessions in this project");
  return v_flex().id("mem-sessions").flex_1().overflow_y_scrollbar().py(6).children(m.sessions.map((s) => {
    const open = !s.ended_at;
    const u = s.usage;
    return v_flex().id(`mem-s-${s.session_id}`).px(12).py(6).gap(2).cursor_pointer().hover((st) => st.bg(t.hover))
      .on_click((_e, cx) => m.openSession(s, cx))
      .child(h_flex().gap(6).items_center()
        .child(div().w(6).h(6).rounded(3).bg(open ? "#fbbf24" : t.dim))
        .child(div().text_color(t.foreground).child(s.agent_kind))
        .child(div().text_color(t.dim).child(`${agoPhrase(s.started_at)} · ${open ? "open" : span(s.started_at, s.ended_at)}`))
        .child(div().flex_1())
        .child(div().text_color(t.muted).child(`${s.observation_count} events`)))
      .when(Boolean(u), (el) => el.child(div().pl(12).text_size(11).text_color(t.dim).truncate()
        .child(`${u.model ?? ""} · output ${compact(u.output_tokens)} · input ${compact(u.input_tokens)} · cache ${compact(u.cache_read_tokens)} read / ${compact(u.cache_write_tokens)} written`)))
      .child(div().pl(12).text_size(11).text_color(t.dim).truncate().child(s.cwd ?? ""));
  }));
}

export function session(t, m) {
  const s = m.session;
  const bar = backBar(t, m, `${s.agent_kind} · ${stamp(s.started_at)}`, (cx) => m.closeSession(cx));
  if (!m.observations) return v_flex().size_full().child(bar).child(empty(t, "loading…"));
  return v_flex().size_full().child(bar)
    .child(v_flex().id("mem-obs").flex_1().overflow_y_scrollbar().py(6).children(m.observations.map((o) => {
      const color = OBS_COLORS[o.kind] ?? t.dim;
      return v_flex().px(12).py(5).gap(2).border_l(2).border_color(color).ml(8)
        .child(h_flex().gap(6).text_size(11)
          .child(div().text_color(color).font_semibold().child(o.kind))
          .child(div().flex_1().min_w_0().truncate().text_color(t.muted).child(o.title ?? ""))
          .child(div().text_color(t.dim).child(stamp(o.created_at).slice(-5))))
        .when(o.kind === "user-prompt" || o.kind === "stop", (el) => el.child(div().text_size(12).text_color(t.foreground)
          .child((o.body ?? "").slice(0, 600))));
    })));
}

export function results(t, m) {
  if (!m.results) return empty(t, "Type and press Enter. Searches all projects or only the selected one.");
  if (m.results.length === 0) return empty(t, "nothing found");
  return v_flex().id("mem-results").flex_1().overflow_y_scrollbar().py(6)
    .children(m.results.map((r) => pageRow(t, m, r, unmark(r.snippet ?? ""))));
}
