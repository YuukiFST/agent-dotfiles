// Fila de revisão: os PRs abertos com a sua conta (os agentes abrem com ela) e os que
// pedem a sua revisão, em todos os repositórios, agrupados pelo que falta para o merge.
// Uma consulta GraphQL pelo `gh` a cada 2 min. Vive no stack `info` do layout dash.
import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { exec, panes, theme } from "herdr";

const REFRESH_MS = 120_000;
const PR_FIELDS = `number title url isDraft createdAt headRefName additions deletions reviewDecision mergeStateStatus
  repository { nameWithOwner } author { login } commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;
const QUERY = `query {
  mine: search(query: "is:pr is:open author:@me archived:false", type: ISSUE, first: 50) { nodes { ... on PullRequest { ${PR_FIELDS} } } }
  asked: search(query: "is:pr is:open review-requested:@me archived:false", type: ISSUE, first: 50) { nodes { ... on PullRequest { ${PR_FIELDS} } } }
}`;
// Ordem de exibição: o que dá para mergear primeiro, rascunho por último.
const GROUPS = [
  ["ready", "Pronto para merge"],
  ["review", "Aguardando aprovação"],
  ["running", "CI rodando"],
  ["behind", "Desatualizado com a base"],
  ["changes", "Mudanças pedidas"],
  ["failed", "CI falhou"],
  ["conflict", "Conflito"],
  ["draft", "Rascunho"],
];

function ciState(pr) {
  return pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state ?? null;
}

// mergeStateStatus e reviewDecision: docs.github.com/graphql/reference/enums
function classify(pr) {
  const ci = ciState(pr);
  if (pr.isDraft) return "draft";
  if (pr.mergeStateStatus === "DIRTY") return "conflict";
  if (ci === "FAILURE" || ci === "ERROR") return "failed";
  if (pr.reviewDecision === "CHANGES_REQUESTED") return "changes";
  if (ci === "PENDING" || ci === "EXPECTED") return "running";
  if (pr.mergeStateStatus === "BEHIND") return "behind";
  if (pr.mergeStateStatus === "BLOCKED" || pr.reviewDecision === "REVIEW_REQUIRED") return "review";
  return "ready";
}

function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

export default class ReviewQueue extends View {
  init(_props, cx) {
    this.mine = null;
    this.asked = [];
    this.error = null;
    this.loading = false;
    this.loadedAt = null;
    this.refresh(cx);
    cx.timer.every(REFRESH_MS, (cx) => this.refresh(cx));
    cx.timer.every(30_000, (cx) => cx.notify()); // idades e "atualizado há"
  }

  refresh(cx) {
    if (this.loading) return;
    this.loading = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await exec("gh", ["api", "graphql", "-f", `query=${QUERY}`]);
        if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").pop() || `gh saiu com código ${r.code}`);
        const data = JSON.parse(r.stdout).data;
        this.mine = data.mine.nodes.filter((p) => p.number);
        const mineUrls = new Set(this.mine.map((p) => p.url));
        this.asked = data.asked.nodes.filter((p) => p.number && !mineUrls.has(p.url));
        this.error = null;
        this.loadedAt = Date.now();
      } catch (e) {
        this.error = String(e?.message ?? e);
      } finally {
        this.loading = false;
      }
      cx.notify();
    });
  }

  openUrl(url) {
    exec("cmd.exe", ["/c", "start", "", url]);
  }

  ciDot(t, pr) {
    const ci = ciState(pr);
    const color = ci === "SUCCESS" ? t.done : ci === "FAILURE" || ci === "ERROR" ? t.blocked : ci ? t.working : t.dim;
    const label = { SUCCESS: "CI verde", FAILURE: "CI falhou", ERROR: "CI com erro", PENDING: "CI rodando", EXPECTED: "CI esperado" }[ci] ?? "sem CI";
    return div().id(`ci-${pr.url}`).w(8).h(8).rounded(4).bg(color).tooltip(label);
  }

  row(t, pr, onBranch) {
    const repo = pr.repository.nameWithOwner.split("/")[1];
    const where = onBranch.get(pr.headRefName);
    return h_flex().id(`pr-${pr.url}`).gap(10).px(12).py(7).items_center().rounded(8).cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => this.openUrl(pr.url))
      .child(this.ciDot(t, pr))
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(div().truncate().text_color(t.foreground).child(pr.title))
        .child(h_flex().gap(8).text_size(11).text_color(t.dim)
          .child(div().child(`${repo} #${pr.number}`))
          .child(div().min_w(0).truncate().child(pr.headRefName))
          .when(Boolean(where), (el) => el.child(div().text_color(t.accent).child(`aberto em ${where}`)))))
      .child(div().text_size(11).text_color(t.dim).child(`+${pr.additions} −${pr.deletions}`))
      .child(div().w(48).text_size(11).text_color(t.muted).child(ago(pr.createdAt)));
  }

  section(t, title, prs, onBranch, color) {
    if (!prs.length) return null;
    return v_flex().gap(1)
      .child(h_flex().px(12).pt(12).pb(4).gap(6).items_center().text_size(11.5)
        .child(div().text_color(color ?? t.muted).font_semibold().child(title))
        .child(div().text_color(t.dim).child(String(prs.length))))
      .children(prs.map((pr) => this.row(t, pr, onBranch)));
  }

  render() {
    const t = theme();
    // Branch -> onde está aberta num terminal (aba do herdr), para achar o agente do PR.
    const onBranch = new Map();
    for (const p of panes()) if (p.branch && !onBranch.has(p.branch)) onBranch.set(p.branch, p.title || p.branch);
    const groupColor = { ready: t.done, failed: t.blocked, conflict: t.blocked, changes: t.blocked, running: t.working };
    const byOldest = (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
    const mine = (this.mine ?? []).slice().sort(byOldest);
    const header = this.loading ? "atualizando…" : this.loadedAt ? `atualizado há ${ago(new Date(this.loadedAt).toISOString())}` : "";
    return v_flex().id("review-root").size_full().text_size(12.5).text_color(t.muted)
      .child(h_flex().px(14).py(8).gap(10).items_center().border_b(1).border_color(t.border)
        .child(div().text_size(13).text_color(t.foreground).child("Fila de revisão"))
        .child(div().text_size(11).text_color(t.dim).child(header))
        .child(div().flex_1())
        .child(div().id("review-refresh").px(8).py(2).rounded(6).text_size(11.5).cursor_pointer()
          .border(1).border_color(t.border).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => this.refresh(cx)).child("atualizar")))
      .when(Boolean(this.error), (el) => el.child(div().px(14).py(8).text_color(t.blocked).child(this.error)))
      .when(!this.mine && !this.error, (el) => el.child(div().px(14).py(12).text_color(t.dim).child("buscando PRs…")))
      .when(Boolean(this.mine) && mine.length === 0 && this.asked.length === 0,
        (el) => el.child(div().px(14).py(12).text_color(t.dim).child("Nenhum PR aberto.")))
      .child(v_flex().id("review-list").flex_1().min_h(0).overflow_y_scroll().pb(10)
        .children([
          this.section(t, "Pedem sua revisão", this.asked.slice().sort(byOldest), onBranch, t.accent),
          ...GROUPS.map(([key, title]) =>
            this.section(t, title, mine.filter((pr) => classify(pr) === key), onBranch, groupColor[key])),
        ].filter(Boolean)));
  }
}
