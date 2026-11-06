// The panel's list rows. A row opens in place; everything it does comes in through `context`
// from main.js: { opened, armed, agent, onToggle, onOpenCompare, onAskPort, onReviewed, onAskAudit, onSync }.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";

const MS_PER_MINUTE = 60000;
const COPY_LABEL = { same: "same", differs: "differs from repo", missing: "not installed" };
const TARGET_LABEL = { claude: "~/.claude/skills", agents: "~/.agents/skills" };

export function ago(at) {
  const minutes = Math.round((Date.now() - new Date(at).getTime()) / MS_PER_MINUTE);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (60 * 24))} d ago`;
}

export function actionButton(t, id, label, isStrong, onClick) {
  return h_flex().id(id).h(24).px(8).flex_none().items_center().rounded(5).cursor_pointer().text_size(11)
    .bg(isStrong ? t.solid : t.raised).text_color(isStrong ? t.solid_foreground : t.foreground)
    .hover((s) => s.opacity(0.85)).on_click(onClick).child(label);
}

export function groupHeading(t, text, color, action = null) {
  return h_flex().flex_none().h(28).px(6).mt(6).items_center().text_size(11).font_medium().text_color(color)
    .child(div().flex_1().min_w(0).truncate().child(text))
    .when(Boolean(action), (el) => el.child(action));
}

function row(t, key, color, title, detail, isOpen, onToggle) {
  return h_flex().id(`row-${key}`).flex_none().h(44).px(6).gap(8).items_center().rounded(6).cursor_pointer()
    .when(isOpen, (el) => el.bg(t.raised)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => onToggle(key, cx))
    .child(div().size(7).flex_none().rounded(4).bg(color))
    .child(v_flex().flex_1().min_w(0)
      .child(div().truncate().text_size(12).text_color(t.foreground).child(title))
      .child(div().truncate().text_size(11).text_color(t.dim).child(detail)))
    .child(div().flex_none().text_size(13).text_color(t.dim).child(isOpen ? "⌄" : "›"));
}

const opening = (children) => v_flex().flex_none().pr(6).pl(21).pt(4).pb(10).gap(6).text_size(11).children(children);
const buttons = (list) => h_flex().flex_wrap().gap(6).pt(2).children(list.filter(Boolean));

function commitLine(t, commit) {
  return h_flex().flex_none().gap(6).text_color(t.muted)
    .child(div().flex_none().text_color(t.dim).child(commit.date.slice(5)))
    .child(div().flex_1().min_w(0).truncate().child(commit.subject));
}

// A "./skills" row watches a whole upstream collection for skills not vendored yet.
const sourceTitle = (source) => (source.target === "./skills" ? "New skills" : source.target);
const sourceName = (source) => (source.path === "." ? source.repo : `${source.repo} · ${source.path}`);

// One tracked source with commits past its pin, the unit a review moves.
export function sourceRow(t, source, context) {
  const key = `${source.target}|${source.repo}|${source.path}`;
  const isOpen = context.opened === key;
  const commits = `${source.count} ${source.count === 1 ? "commit" : "commits"}`;
  const rest = source.count - source.commits.length;
  return v_flex().flex_none()
    .child(row(t, key, t.accent, sourceTitle(source), `${commits} · ${sourceName(source)}`, isOpen, context.onToggle))
    .when(isOpen, (el) => el.child(opening([
      ...source.commits.map((c) => commitLine(t, c)),
      rest > 0 ? div().text_color(t.dim).child(`+${rest} more`) : null,
      buttons([
        actionButton(t, `compare-${key}`, "Compare", false, () => context.onOpenCompare(source)),
        context.agent ? actionButton(t, `port-${key}`, `Ask ${context.agent.space_name}`, false, (_e, cx) => context.onAskPort(source, cx)) : null,
        actionButton(t, `reviewed-${key}`, "Mark reviewed", true, (_e, cx) => context.onReviewed(source, cx)),
      ]),
    ].filter(Boolean))));
}

export function failureRow(t, failure) {
  return v_flex().flex_none().px(6).py(5).text_size(11).child(div().truncate().text_color(t.foreground).child(`${failure.target} · ${failure.source}`))
    .child(div().text_color(t.dim).child(failure.reason));
}

export function skillRow(t, skill, context) {
  const key = `skill-${skill.name}`;
  const isOpen = context.opened === key;
  const color = skill.state === "drift" ? t.blocked : skill.state === "local" ? t.muted : t.ansi2;
  const syncId = `sync-${skill.name}`;
  return v_flex().flex_none()
    .child(row(t, key, color, skill.name, skill.description || "No description", isOpen, context.onToggle))
    .when(isOpen, (el) => el.child(opening([
      div().text_color(t.muted).child(skill.description),
      ...Object.entries(skill.copies).map(([target, copy]) => h_flex().gap(6).text_color(t.dim)
        .child(div().flex_1().child(TARGET_LABEL[target])).child(div().child(COPY_LABEL[copy]))),
      ...skill.upstreams.map((u) => div().truncate().text_color(t.dim).child(`from ${sourceName(u)}`)),
      skill.state === "local" ? null : buttons([
        skill.state === "drift" ? actionButton(t, syncId, context.armed === syncId ? "Replace copies?" : "Sync", context.armed === syncId, (_e, cx) => context.onSync(skill, cx)) : null,
        context.agent ? actionButton(t, `audit-${skill.name}`, `Audit with ${context.agent.space_name}`, false, (_e, cx) => context.onAskAudit(skill, cx)) : null,
      ]),
    ].filter(Boolean))));
}
