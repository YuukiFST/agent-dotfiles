---
name: autoreview
description: "Use when running a closeout code review before commit/ship — after non-trivial edits, or when the user asks for a code review, second-model review, or autoreview of a local branch or PR. Works on Claude Code, OpenCode, Cursor, and Pi."
disable-model-invocation: true
---

# Auto Review

Closeout code-review pass before final/commit/ship. This is code review, not approval routing.

Default reviewer is the **session model** of the current harness. A second engine is opt-in for a panel — never switch the requested engine silently.

A clean autoreview judges the change bundle (source-aware). It is NOT proof that a UI, CLI, API, or generated artifact works from the user's perspective — for user-visible behavior, also exercise the running product (e.g. a verify/webapp-testing pass).

Use when:

- user asks for a code review / autoreview / second-model review
- after non-trivial code edits, before final/commit/ship
- reviewing a local branch or PR branch after fixes

## Contract

- Treat review output as **advisory**. Never blindly apply it.
- Verify every finding by reading the real code path and adjacent files before acting on it.
- Read dependency docs/source/types when a finding depends on external behavior.
- Reject unrealistic edge cases, speculative risks, broad rewrites, and fixes that over-complicate the code.
- Prefer small fixes at the right ownership boundary; no refactor unless it clearly improves the bug class.
- When an accepted finding reveals a bug class or repeated pattern, inspect the current change scope for sibling instances before fixing. Fix the scoped bug class at once when practical; stop at touched surfaces, owner boundaries, and clear follow-up territory.
- Loop until the review returns no accepted/actionable findings — but only while the work remains inside the original task scope (see Scope Governor).
- If a review-triggered fix changes code, rerun focused tests and rerun the review.
- Security perspective is always included, but must not cripple legitimate functionality. Report a security finding only when the change creates a concrete, actionable risk or removes an important safety check.
- If you reject a finding as intentional, add a brief inline comment only when it documents a real invariant or ownership decision a future reviewer should know.
- Do not push just to review. Push only when the user asked to push/ship/update the PR.
- Stop as soon as the review is clean. Do not run an extra pass for a nicer "clean" line or a redundant second opinion.

## Scope Governor

Autoreview is a closeout gate, not permission to rewrite the task.

Before the first review, freeze a scope baseline: original request or issue, target branch, intended behavior, owner boundary, changed files, and non-test LOC. For inherited or already-bloated branches, use the intended PR diff as the baseline rather than accepting all existing branch drift.

Before patching a finding, classify it:

- **In-scope blocker** — introduced by the current diff, same owner boundary, fixable without changing the task's contract. Fix it.
- **Follow-up** — real, but belongs to an adjacent bug class, sibling surface, cleanup, or broader hardening track. Record it; don't fix now.
- **Stop-and-escalate** — requires a new protocol/config/storage/public API contract, a different owner boundary, a release-process change, or a design choice outside the original request. Stop and report.

Stop patching and report the scope break instead of continuing when:

- a narrow change turns into an architecture change, protocol change, migration, or release-process change;
- the diff grows past ~2x the original files or non-test LOC without explicit approval to expand scope;
- two review-triggered patch cycles have not converged — pause and reclassify every remaining finding before another edit;
- the best fix is "define the canonical contract first" rather than another local inference layer;
- fixing the accepted finding would make the change no longer describe the same behavior, issue, or owner boundary.

After the two-cycle pause, continue only when every remaining accepted finding is still an in-scope blocker. Otherwise preserve the useful analysis, identify the smallest safe landed subset if one exists, and propose a follow-up for the larger fix. Do not keep committing speculative fixes just to satisfy the reviewer.

Critical exceptions must be explicit: active data loss, crash, broken install/upgrade, release blocker, or concrete security exposure. Anything else is not critical enough to blow up scope.

## Release branches

On release, beta, stable, hotfix, signing, packaging, or release-check work, use freeze discipline even when the branch name is not release-like:

- Fix only release blockers, failed release infrastructure, exact backports, install/upgrade breakage, data loss, crashes, or concrete security exposure.
- Treat non-blocking findings as follow-ups for the main branch, not reasons to broaden the release branch.
- Do not introduce new product behavior, config surface, protocol shape, migration, or process policy unless it directly unblocks the release.
- If review finds a real but non-critical design problem during release closeout, stop with a follow-up plan; the release branch is not the refactor lane.

## Pick Target

Build the diff from git, then review that bundle. Pick the smallest target that covers the change.

Dirty local work (unstaged/staged/untracked in the current checkout):

```bash
git diff HEAD          # + git status for untracked
```

Branch / PR work — diff against the real base:

```bash
base=$(gh pr view --json baseRefName --jq .baseRefName 2>/dev/null || echo main)
git diff "origin/$base"...HEAD
```

Already-landed single commit:

```bash
git show HEAD
```

Reviewing a clean branch against its own base is usually an empty diff after push — review the commit(s) or the branch before merge, not `main` vs `origin/main`.

For very large diffs, split the review into coherent chunks at file boundaries (each chunk with enough surrounding context), review every chunk, and merge findings before deciding. Never drop lockfiles, generated clients, schemas, or other independently semantic artifacts merely to shrink the review.

## Running the review

Same recipe in every harness: (1) build the diff bundle, (2) hand bundle + this Contract to a reviewer, (3) main agent verifies and accepts/rejects each finding, (4) loop per Contract/Scope Governor. Only the reviewer dispatch differs per harness:

**Claude Code** — either:

1. Built-in slash command on the current diff:

   ```text
   /code-review            # Claude Code-only flags: --comment posts inline PR comments, --fix applies
   ```

2. Dispatch a reviewer subagent (Task tool) with the diff bundle + this Contract as the brief. If available, `caveman:cavecrew-reviewer` (terse, severity-tagged) or `thermo-nuclear-code-quality-review` (deep quality audit) are good choices; otherwise a general-purpose subagent with the Contract as brief.

**OpenCode** — dispatch a reviewer subagent (or its review command, if configured) against the same git diff bundle, with this Contract as the brief.

**Cursor** — run a fresh agent/Composer conversation as the reviewer: paste or attach the diff bundle + this Contract, instruct it to only report findings (no edits). The main conversation verifies and applies accepted fixes.

**Pi** — dispatch a subagent, or start a fresh session with the diff bundle + this Contract as the prompt, output restricted to findings only.

If the harness has no subagent mechanism available, do the review inline in a dedicated pass: re-read the full diff with fresh adversarial eyes, assume the code is wrong, and apply the Contract — but prefer a separate context whenever one exists, since same-context review inherits the implementer's bias.

Note: upstream autoreview refuses Cursor/OpenCode as isolated *reviewer engines* (their CLIs can't sandbox the review). That doesn't apply here — in this skill they act as the *host harness* running the review, a different role.

Keep target selection, the review call, and the accept/reject decision in one path. If output is noisy, summarize it after it returns; don't ask another agent to rerun the whole review.

## Panels (opt-in)

Use a second engine only when explicitly requested or when risk justifies the spend. Run both reviewers against the **same frozen diff bundle**, then the main agent reconciles — verifying each accepted finding against real code before fixing.

```text
Reviewer 1: session model (via the harness dispatch above)
Reviewer 2: a second model/engine, only if asked
```

## Parallel closeout

Format first if formatting can move line locations, then tests and review may run in parallel. Tests may force code changes that stale the review — if either leads to edits, rerun the affected tests and rerun review until clean, then stop.

## Final report

Include:

- review path used (slash command, subagent, inline pass, or panel) and the target diff
- tests / proof run
- findings accepted vs rejected, briefly why
- follow-ups recorded (Scope Governor) if any
- the clean result of the final review run, or why a remaining finding was consciously rejected

Do not run another review solely to improve the report wording. If the final run was clean, report that run.

## Installing on each harness

Canonical copy lives in the config repo: `my-harness-config/skills/autoreview/SKILL.md` (https://github.com/YuukiFST/my-harness-config). Edit there, commit, then run the harness setup/update script on each machine — never hand-edit the installed copies.

| Harness | Installed to | Propagated by |
|---|---|---|
| Claude Code | `~/.claude/skills/autoreview/SKILL.md` | `scripts/setup-claude.ps1` / `.sh` (or `update-claude.*`) |
| Cursor | `~/.cursor/rules/autoreview.mdc` (same body; `.mdc` frontmatter with `description` and `alwaysApply: false`) | no repo script yet — copy manually or add one |
| Pi | Pi's skills directory (confirm via `pi --help` / Pi docs on the machine) | no repo script yet — copy manually or add one |
