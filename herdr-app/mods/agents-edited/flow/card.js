// The task card under an agent on the board: the pull request, its commits on lanes
// with what moved on the base, conflicts, CI and the step the agent is on. Changes
// animate natively: rows and badges grow in, bars slide, spinners turn, attention pulses.

import { div, svg, PathBuilder } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { settings, hc, exec, notify } from "herdr";
import { OP, phaseOf, rowsOf, checksSummary } from "./model.js";
import { layoutFlowLanes } from "./lanes.js";

const ROW = 22;
const LANE = 12;
const PAD = 7;
const DOT = 7;
const STROKE = 1.5;
const BAR_H = 4;
const GROW = { duration: 260, easing: "ease-out" };
const FADE = { duration: 200, easing: "ease-out" };
const SLIDE = { duration: 700, easing: "ease-out" };
// Real files in each window's home: Herdr loads no asset through a junction (the second window links this mod).
const icon = (name) => `assets/flow/${name}.svg`;
const CHECK_PHASES = new Set(["checking", "failed", "ready", "merged"]);

function palette(t) {
  return { own: t.ansi4, side: t.ansi6, base: t.dim, culprit: t.ansi3, ok: t.ansi2, bad: t.ansi1, merged: t.ansi5 };
}

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function secs(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const mono = (el) => (typeof settings().font_family === "string" ? el.font_family(settings().font_family) : el);

// The top row: what is happening to the branch as a whole.
function opLine(flow, phase, pal, t) {
  const into = `Merge into ${flow.base}`;
  const c = checksSummary(flow.jobs);
  switch (phase) {
    case "changes": return { label: "Uncommitted changes", tip: flow.branch, right: plural(flow.uncommitted, "file"), color: t.dim };
    case "unpublished": return { label: "Not on GitHub yet", tip: flow.branch, right: plural(flow.own, "commit"), color: t.dim };
    case "conflicts": return { label: into, right: plural(flow.conflictFiles.length || 1, "conflict"), color: pal.culprit };
    case "resolving": {
      const left = flow.merging.remaining;
      return { label: into, right: left ? plural(left, "conflict") : "Resolved", color: left ? pal.culprit : pal.ok };
    }
    case "checking": return { label: into, right: c.total ? `Checking ${c.done} of ${c.total}` : "Checking", color: t.muted };
    case "failed": return { label: into, right: "Checks failed", color: pal.bad };
    case "ready": return { label: into, right: "Ready", color: pal.ok };
    default: return { label: `Merged into ${flow.base}`, right: "Merged", color: pal.merged };
  }
}

// The bottom row: the step now, the agent's own words first.
function footLine(flow, phase, step, pal, t) {
  const c = checksSummary(flow.jobs);
  const pr = flow.pr;
  const words = {
    changes: { text: "Commit your changes to open a PR", mark: "dashring", color: t.dim },
    unpublished: { text: "Push the branch to open a PR", mark: "dashring", color: t.dim },
    conflicts: { text: `${plural(flow.conflictFiles.length || 1, "conflict")} with ${flow.base}`, mark: "alert", color: pal.culprit },
    resolving: flow.merging && { text: `Resolving conflicts · ${flow.merging.total - flow.merging.remaining} of ${flow.merging.total}`, mark: "spin", color: pal.culprit },
    checking: { text: c.total ? `Checks ${c.done} of ${c.total}` : "Waiting for checks", mark: "spin", color: t.muted },
    failed: { text: `${c.failed.map((j) => j.name).join(", ")} failed`, mark: "cross", color: pal.bad },
    ready: { text: "Ready to merge", mark: "check", color: pal.ok },
    merged: { text: `Merged into ${flow.base}`, mark: "merge", color: pal.merged },
  }[phase] ?? { text: "", mark: "dashring", color: t.dim };
  const fromAgent = step && phase !== "merged" ? { text: step, mark: "spin", color: words.color } : null;
  const n = pr?.number;
  const button = {
    changes: { label: "Create PR", ask: `Commit what is left on ${flow.branch}, push it and open a pull request into ${flow.base}.` },
    unpublished: { label: "Create PR", ask: `Push ${flow.branch} and open a pull request into ${flow.base}.` },
    conflicts: { label: "Resolve conflicts", ask: `PR #${n} conflicts with ${flow.base}. Merge ${flow.base} into ${flow.branch}, resolve the conflicts and push.` },
    failed: { label: "Fix checks", ask: `On PR #${n} the check ${c.failed.map((j) => j.name).join(", ")} failed. Find the cause, fix it and push.` },
    ready: { label: "Merge", ask: `PR #${n} is green. Merge it.` },
  }[phase] ?? (pr?.url ? { label: "Open on GitHub", url: pr.url } : null);
  return { ...(fromAgent ?? words), button };
}

export class FlowCards {
  constructor() {
    this.seen = new Set();
    this.again = false;
    this.open = new Set(); // addresses whose CI timeline stays open after the checks end
    this.sent = {}; // address -> button label clicked, until the phase moves on
  }

  // First sight of an element renders it collapsed; the next frame grows it, and the transition animates.
  born(id, cx) {
    if (this.seen.has(id)) return true;
    this.seen.add(id);
    if (!this.again) {
      this.again = true;
      cx.timer.after(20, (cx) => {
        this.again = false;
        cx.notify();
      });
    }
    return false;
  }

  render(t, address, flow, step, cx) {
    if (!flow) return null;
    const phase = phaseOf(flow);
    if (phase === "gone") return null;
    const pal = palette(t);
    const rows = rowsOf(flow, phase);
    const layout = layoutFlowLanes(rows);
    const opLane = layout.rows[0].lane;
    const op = opLine(flow, phase, pal, t);
    const colorOf = new Map(rows.map((r, i) => [r.hash, this.commitColor(r, layout.rows[i].lane === opLane, op, pal)]));
    const graphW = PAD * 2 + layout.width * LANE;
    const key = `${address}-${flow.top}`;
    const sentFor = this.sent[address];
    if (sentFor && sentFor.phase !== phase) delete this.sent[address];
    const shown = this.born(`card-${key}`, cx);
    return v_flex().id(`flow-${key}`).mt(2).rounded(8).bg(t.background).border(1).border_color(t.border).overflow_hidden()
      .opacity(shown ? 1 : 0).transition("opacity", FADE)
      .child(this.header(t, flow, phase, pal))
      .child(v_flex().px(2)
        .children(rows.map((r, i) => this.row(t, key, r, layout.rows[i], colorOf, graphW, op, phase, pal, cx))))
      .when(flow.jobs.length > 0 && CHECK_PHASES.has(phase), (el) => el.child(this.chips(t, flow, pal, address, cx)))
      .when(flow.jobs.length > 0 && (phase === "checking" || phase === "failed" || this.open.has(address)), (el) => el.child(this.timeline(t, flow, pal, key, cx)))
      .child(this.footer(t, address, flow, phase, step, pal, key, cx));
  }

  commitColor(r, onOpLane, op, pal) {
    if (r.op) return op.color;
    if (r.kind === "incoming") return r.conflicts && !r.resolved ? pal.culprit : pal.base;
    if (r.kind === "base") return pal.base;
    return onOpLane ? pal.own : pal.side;
  }

  header(t, flow, phase, pal) {
    const pr = flow.pr;
    const state = phase === "merged" ? ["Merged", pal.merged] : pr?.isDraft ? ["Draft", t.dim] : pr ? ["Open", pal.ok] : ["Local", t.dim];
    return h_flex().h(30).px(10).gap(6).items_center().border_b(1).border_color(t.border)
      .child(div().flex_shrink(1).min_w(0).truncate().text_color(t.foreground).font_medium().child(pr?.title ?? flow.branch))
      .when(Boolean(pr), (el) => el.child(div().flex_none().text_color(t.dim).child(`#${pr.number}`)))
      .child(div().flex_1())
      .child(h_flex().flex_none().gap(5).items_center().text_size(11).text_color(state[1])
        .child(div().size(6).rounded(3).bg(state[1]))
        .child(state[0]));
  }

  row(t, key, r, lay, colorOf, graphW, op, phase, pal, cx) {
    const id = `${key}-${r.hash}`;
    const shown = this.born(id, cx);
    const color = colorOf.get(r.hash) ?? pal.base;
    const quiet = !r.op && r.kind !== "own";
    const label = r.op ? op.label : r.subject;
    const tip = r.op ? op.tip : r.tip;
    return h_flex().id(`row-${id}`).h(shown ? ROW : 0).overflow_hidden().gap(6).items_center().pr(8)
      .opacity(shown ? 1 : 0).transition("height", GROW).transition("opacity", FADE)
      .hover((s) => s.bg(t.hover))
      .when(!r.op, (el) => el.tooltip(`${r.hash.slice(0, 7)} · ${r.subject}`))
      .child(this.graphCell(t, r, lay, colorOf, graphW, color, phase))
      .child(div().flex_shrink(1).min_w(0).truncate()
        .text_color(r.kind === "incoming" && r.conflicts && !r.resolved ? pal.culprit : quiet ? t.muted : t.foreground)
        .child(label))
      .when(Boolean(tip), (el) => el.child(mono(div().flex_none().max_w(96).truncate().px(4).h(15).rounded(3).text_size(10.5)
        .bg(color + "22").text_color(color).child(tip))))
      .when(!r.op && r.conflicts > 0, (el) => el.child(this.conflictBadge(id, r, pal, cx)))
      .child(div().flex_1())
      .child(r.op
        ? div().id(`op-${id}-${op.right}`).flex_none().text_size(11).text_color(op.color).child(op.right)
        : div().flex_none().max_w(140).truncate().text_size(10.5).text_color(t.dim).child(`${r.author} · ${ago(r.at)}`));
  }

  // A count while the commit's changes still conflict, a check once they are resolved: each grows in as it changes.
  conflictBadge(id, r, pal, cx) {
    const badgeId = `badge-${id}-${r.resolved ? "ok" : r.conflicts}`;
    const shown = this.born(badgeId, cx);
    const size = shown ? 15 : 0;
    const body = r.resolved
      ? svg(icon("check")).size(10).text_color(pal.ok)
      : div().text_size(10.5).text_color(pal.culprit).child(String(r.conflicts));
    return h_flex().id(badgeId).flex_none().w(size).h(size).rounded(8).items_center().justify_center()
      .bg((r.resolved ? pal.ok : pal.culprit) + "22").opacity(shown ? 1 : 0)
      .transition("width", GROW).transition("height", GROW).transition("opacity", FADE)
      .child(body);
  }

  graphCell(t, r, lay, colorOf, graphW, color, phase) {
    const x = (lane) => PAD + lane * LANE + LANE / 2;
    const y = (v) => v * ROW;
    const paths = new Map();
    for (const [a, ya, b, yb, toward, dashed] of lay.segments) {
      const c = colorOf.get(toward) ?? t.dim;
      const k = `${c}${dashed ? "-" : ""}`;
      let p = paths.get(k)?.p ?? (dashed ? PathBuilder.stroke(STROKE).dash_array([2.5, 2.5]) : PathBuilder.stroke(STROKE));
      p = p.move_to(x(a), y(ya));
      if (a === b) p = p.line_to(x(b), y(yb));
      else {
        const mid = (y(ya) + y(yb)) / 2;
        p = p.cubic_bezier_to(x(b), y(yb), x(a), mid, x(b), mid);
      }
      paths.set(k, { p, color: c });
    }
    const cx = x(lay.lane);
    const cy = ROW / 2;
    const at = (size) => div().absolute().left(cx - size / 2).top(cy - size / 2).size(size).rounded(size / 2);
    return div().relative().flex_none().w(graphW).h(ROW)
      .children([...paths.values()].map(({ p, color: c }) => window.paint_path(p.build(), c).absolute().top(0).left(0).size_full()))
      .children(r.op ? this.opMark(at, cx, cy, phase, color) : [r.parents.length > 1
        ? at(DOT + 1).bg(t.background).border(1.5).border_color(color)
        : at(DOT).bg(color).border(1.5).border_color(t.background)]);
  }

  // The task's node: a ring that turns while work is under way, a pulsing halo when it needs attention.
  opMark(at, cx, cy, phase, color) {
    const ring = (name) => svg(icon(name)).absolute().left(cx - 6).top(cy - 6).size(12).text_color(color);
    switch (phase) {
      case "changes": return [ring("dashring")];
      case "unpublished": return [ring("dashring")];
      case "checking":
      case "resolving": return [ring("spin").spin(1100)];
      case "ready": return [at(DOT + 6).bg(color + "33"), at(DOT + 1).bg(color)];
      case "conflicts":
      case "failed": return [at(DOT + 8).bg(color + "40"), at(DOT + 1).bg(color)];
      default: return [at(DOT + 1).bg(color)];
    }
  }

  chips(t, flow, pal, address, cx) {
    const opened = this.open.has(address);
    return h_flex().px(10).py(6).gap(5).flex_wrap().border_t(1).border_color(t.border)
      .children(flow.jobs.map((j) => {
        const id = `chip-${address}-${j.name}`;
        const shown = this.born(id, cx);
        const c = j.state === "passed" ? pal.ok : j.state === "failed" ? pal.bad : t.muted;
        const mark = j.state === "passed" ? svg(icon("check")).size(10).text_color(c)
          : j.state === "failed" ? svg(icon("cross")).size(10).text_color(c)
            : svg(icon("spin")).size(10).text_color(c).spin(1100);
        const took = j.start ? secs((j.end ?? Date.now()) - j.start) : "queued";
        return h_flex().id(id).flex_none().h(20).px(6).gap(4).items_center().rounded(5).border(1).border_color(t.border)
          .text_size(10.5).opacity(shown ? 1 : 0).transition("opacity", FADE)
          .tooltip(`${j.name} · ${j.state} · ${took}`)
          .cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => {
            if (opened) this.open.delete(address);
            else this.open.add(address);
            cx.notify();
          })
          .child(mark)
          .child(div().max_w(160).truncate().text_color(t.foreground).child(j.name))
          .child(div().text_color(t.dim).child(j.state === "running" ? "running" : j.state));
      }));
  }

  // Each job as a bar on one clock: where it started, how long it ran. Bars slide as they grow.
  timeline(t, flow, pal, key, cx) {
    const now = Date.now();
    const starts = flow.jobs.map((j) => j.start).filter(Boolean);
    const t0 = starts.length ? Math.min(...starts) : now;
    const t1 = Math.max(now - 1, ...flow.jobs.map((j) => j.end ?? (j.start ? now : 0)));
    const span = Math.max(1000, t1 - t0);
    const head = flow.commits.find((c) => c.hash === flow.pr?.headRefOid);
    return v_flex().px(10).py(6).gap(4).border_t(1).border_color(t.border).text_size(11)
      .child(h_flex().gap(6).text_color(t.dim)
        .child(div().child("Checks on"))
        .child(mono(div().px(4).rounded(3).bg(t.raised).text_color(t.muted).child((flow.pr?.headRefOid ?? "").slice(0, 7))))
        .child(div().flex_1().min_w(0).truncate().text_color(t.muted).child(head?.subject ?? ""))
        .child(div().flex_none().child(secs(span))))
      .children(flow.jobs.map((j) => {
        const c = j.state === "passed" ? pal.ok : j.state === "failed" ? pal.bad : pal.own;
        const left = j.start ? ((j.start - t0) / span) * 100 : 0;
        const width = j.start ? Math.max(1.5, (((j.end ?? now) - j.start) / span) * 100) : 0;
        const bar = div().absolute().top((ROW - 6 - BAR_H) / 2).h(BAR_H).rounded(2).bg(c)
          .left(`${left}%`).w(`${Math.min(width, 100 - left)}%`)
          .transition("width", SLIDE).transition("left", SLIDE);
        return h_flex().id(`job-${key}-${j.name}`).h(ROW - 6).gap(8).items_center()
          .when(Boolean(j.url), (el) => el.cursor_pointer().on_click(() => exec("explorer", [j.url]).catch(() => null)))
          .child(div().w(110).flex_none().truncate().text_color(j.state === "failed" ? pal.bad : t.foreground).child(j.name))
          .child(div().relative().flex_1().h(ROW - 6)
            .child(bar))
          .child(div().w(44).flex_none().text_color(t.dim).child(j.start ? secs((j.end ?? now) - j.start) : "queued"));
      }));
  }

  footer(t, address, flow, phase, step, pal, key, cx) {
    const f = footLine(flow, phase, step, pal, t);
    const markEl = svg(icon(f.mark)).size(12).text_color(f.color);
    const busy = f.mark === "spin";
    const sent = this.sent[address];
    return h_flex().h(32).px(10).gap(7).items_center().border_t(1).border_color(t.border)
      .child(busy ? markEl.spin(1100) : markEl)
      .child(div().id(`foot-${key}`).flex_1().min_w(0).truncate().text_size(11).text_color(t.muted).tooltip(f.text).child(f.text))
      .when(Boolean(f.button), (el) => el.child(this.button(t, address, f.button, sent, phase, pal)));
  }

  button(t, address, b, sent, phase, pal) {
    const waiting = sent?.label === b.label;
    return h_flex().id(`act-${address}-${b.label}`).flex_none().h(24).px(9).gap(5).items_center().rounded(6)
      .text_size(11).bg(waiting ? t.raised : pal.own + "1f").text_color(waiting ? t.dim : pal.own)
      .cursor_pointer().hover((s) => s.bg(pal.own + "33"))
      .on_click((_e, cx) => {
        if (b.url) {
          exec("explorer", [b.url]).catch(() => null);
          return;
        }
        if (waiting) return;
        this.sent[address] = { label: b.label, phase };
        cx.spawn(async (cx) => {
          const reply = await hc(["send", address, b.ask]).catch(() => null);
          if (reply?.code !== 0) {
            delete this.sent[address];
            notify({ title: `${b.label}: not sent`, body: "The agent did not get the request. Click the button to try again.", level: "warning" });
          }
          cx.notify();
        });
        cx.notify();
      })
      .when(waiting, (el) => el.child(svg(icon("spin")).size(10).text_color(t.dim).spin(1100)))
      .child(waiting ? "Sent" : b.label);
  }
}
