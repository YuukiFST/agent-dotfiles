---
name: yuu-mode
description: "One front door for any task: route the prompt to the best skill or playbook in this kit, then work it to verified evidence. Run as /yuu-mode <task> (pi: /skill:yuu-mode)."
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---

# Yuu mode

The user states a goal; you pick the skill or playbook that fits it and run that.
Adapted from pstack's poteto-mode (MIT, see `LICENSE`).

## Loading a route

Every routed skill sits beside this one: read `../<name>/SKILL.md` relative to this file, then follow it, resolving its own relative paths against its own directory.
Read it by path even when the skill is user-invoked (`disable-model-invocation`); that is how this mode reaches skills the model cannot fire on its own.
A playbook lives at `playbooks/<name>.md` next to this file.
A routed skill missing on disk: name it in the reply and take the next-best route.

## Routing

Match on every new task: the prompt that came with `/yuu-mode`, a "new task", or a clear change of subject.
A follow-up on the same task ("continue", "do it", "keep going") keeps the current route; an explicit pause mid-task runs `playbooks/pause-safely.md` on it, and a hand-off to run unattended ("keep going until it passes", "going to bed") runs `playbooks/autonomous-run.md` with the current route as secondary.
The user says to leave yuu-mode: drop this file's rules for the rest of the session.

1. Pick the most specific row below as the primary route; a row can pull secondary skills during its steps (a bug whose fix crosses a module boundary runs the bug-fix playbook and designs the fix with `codebase-design`).
2. Put one line at the top of the reply: `route: <playbook or skill> (+ <secondary>)`, or `route: none` when no row fits and you work under Principles alone.
   When tool calls come between, the final message opens with the current route line.
3. Under the route line, restate the task in your own words: the user's goal, the problem behind it, and, when the task ships a change, the smallest change you expect to meet it.
   Keep working without waiting for a confirmation; when the evidence rules out the change the user asked for, show that evidence and stop.
   The same restatement goes into the context of every subagent brief (a template a routed skill prescribes keeps its own order), and opens the why of a PR body and the final message, except after a fully specified one-line edit.
4. Open a todo list: a playbook's steps copied verbatim, a skipped step kept with `skip: <reason>`; for a skill route, the skill's own workflow steps.

A casual question or one-line answer gets answered directly, with no route line, restatement or todo list.

### Understand

| Task | Route |
|------|-------|
| How does X work, why is Y built this way, should we do X or Y (read-only) | `playbooks/investigation.md` |
| Quick diagram or code-shape sketch of the topic or diff in this session | `show-me` |
| Research a question against primary sources, gather docs or API facts | `research` |
| Deep multi-angle briefing, map where experts disagree | `storm-research` |
| Technical illustration of a physical object or of how it works inside: exploded view, teardown, cutaway, assembly sheet | `teardown` |
| Interactive isometric SVG figure that explains an idea as a physical object | `anatomy` |
| Apple-style dimensional drawing, spec sheet or redline of a component | `dimensional-drawing` |
| Animate a finished dimensional drawing sheet into a motion film | `dimensional-drawing-motion` |
| Explain how `helmsman` works or whether to use it | `helmsman-explain` |
| Teach the user a new skill or concept | `teach` |

### Build

| Task | Route |
|------|-------|
| A reported defect, failing test, crash or wrong output | `playbooks/bug-fix.md` |
| New or changed behavior | `playbooks/feature.md` |
| Build, polish, redesign, animate or review a web UI (screen, component, flow, chart) | `ui-polish` |
| Behavior-preserving restructure: rename, extract, inline, dedupe, move | `playbooks/refactoring.md` |
| Port or rewrite code from another language in Rust | `rust-port` |
| Write or change Rust code | `rust-best-practices` |
| Write or change TypeScript code | `typescript-best-practices` |
| Add auth, user input handling, secrets, API endpoints or payment code | `security-review` |
| Simplify code just written | `code-simplifier` |
| Design a module interface, a seam, a deep module | `codebase-design` |
| Scan a codebase for deepening opportunities | `improve-codebase-architecture` |
| Pin down domain terms, record an architecture decision | `domain-modeling` |
| Settle a design or behavior question with a throwaway build | `prototype` |
| A whole new project from a loose idea | `helmsman` |
| Slow web page, Core Web Vitals, Lighthouse score | `web-perf` |
| Slow desktop app launch | `optimizing-startup` |
| Any other measured slowness | `playbooks/perf-issue.md` |

### Review

| Task | Route |
|------|-------|
| Review a diff, branch or PR; "what could this break" | `interrogate` |
| Review Rust code for idiom, API design, error handling or safety | `rust-review` |
| Write, change or audit tests | `test-audit` |
| Agents keep repeating the same mistakes in a repo; make each class impossible | `correct` |
| Security review or audit of existing code | `security-audit` |
| Hunt for bounty-worthy vulnerabilities | `security-bounty-hunter` |
| Survey a codebase and write plans for other agents | `improve` |
| Stress-test a plan or idea | `grilling` |
| Measure whether a change to a user-invoked skill or a playbook alters agent behavior | `playbooks/eval.md` |

### Write

| Task | Route |
|------|-------|
| Make prose read less AI-written, or audit a draft | `ai-tells` |
| New marketing copy, titles, microcopy, CTAs, LinkedIn or strategic blog posts | `ai-copywriter` |
| Docs, RFCs, readmes or other technical prose | `technical-writing` |
| Improve a project `CLAUDE.md` from its own session transcripts | `backpass` |
| A skill, `AGENTS.md` or `CLAUDE.md` | `writing-for-agents` |
| Edit an existing skill, keep it in sync with code it describes, or put a bloated or drifted skill on a diet | `skill-diet` |

### Ship and operate

| Task | Route |
|------|-------|
| Ship a change end to end (issue, PR, review, merge, cleanup) when the user invoked `/git-workflow` | `git-workflow` |
| Drive a web page in a real browser | `browser-harness` |
| Give a project a scripted verify-<app> skill | `create-verification-skill` |
| Audit or refresh a verify-<app> skill and its feature map | `maintain-verification-skill` |
| Hand the work to another session | `handoff` |
| Drive a task to a stated end while the user is away ("keep going until it passes", "going to bed"); the task's own route rides as secondary | `playbooks/autonomous-run.md` |
| Stop now so the work resumes cleanly later ("stop here", "I need to restart") | `playbooks/pause-safely.md` |
| Resume a prior session from its id, a handoff note or a pushed branch | `playbooks/session-pickup.md` |
| Find or install a skill this kit lacks | `find-skills` |
| Set up a repo's issue tracker and labels for the engineering skills | `setup-matt-pocock-skills` |

## Non-negotiables

- **Observe before you ask.** A "which approach" fork whose answer you could see by running something (behavior, timing, layout, output) gets a `prototype` or a quick run, and the result decides.
  Ask the user only for a product or preference call no experiment settles.
- **Verify on the surface the user touches.** A project skill under `.claude/skills/verify-*` comes first; otherwise `browser-harness` for web UIs, a real CLI run, or `curl` for a service.
  An inconclusive run or a run on the wrong surface is not a pass: report it as such.
- **Contested or risky change:** `interrogate` before it ships.
- **Prose that ships** (PR body, docs, commit body): an `ai-tells` pass before it goes out.
- **Broken skill mid-task:** name the defect and the fix in the reply; edit only the agent-dotfiles repo copy, never `~/.claude/skills` or `~/.agents/skills`. Keep the current task moving.

## Principles

The `principle-*` skills fire on their own descriptions.
In this mode, read the full SKILL.md of every principle you apply, and in the reply name each principle that changed a decision and the choice it changed.
Cite only principles whose SKILL.md you read this session.
Before any code, name the data shape and its organizing structure (`principle-model-the-domain`).

## Autonomy

Pauses follow the global instructions and `~/.claude/rules/git.md` §3.
"Don't stop", "run until done" or "going to bed" run `playbooks/autonomous-run.md`, which keeps you going through reversible steps; those stop rules still hold, and a message other people will see waits for a yes.
Asked whether to do something or shown an approach, give your real judgment; "this doesn't earn its place" is a valid answer.

## Subagents

- Route bulk reads (a sweep across many files, long logs) to a read-only explore subagent and keep its summary; read a single known file yourself.
- You own every subagent's output: review its diff and write your own summary.
- A routed skill that prescribes its own subagents (`interrogate`) keeps them.
- Re-delegating after a subagent's report: give a fresh subagent the original brief, every later directive, and that report.

## Reply

Every claim carries its evidence (file:line, command output) or a label: measured, inferred, or guess.
Link only artifacts you produced or read this session.
Each playbook's **Reply** line names what that playbook adds.
