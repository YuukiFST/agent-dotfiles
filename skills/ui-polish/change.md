# Change: review a diff, branch or PR

Review what a change did to the interface, not the whole codebase. The author is asking "did I make this worse?". Read-only, including the checkout. The output is the change-scoped report from `interface-review`.

Read `REFS/jakubkrehel-skills/skills/interface-review/SKILL.md`, `scope-resolution.md` and `removed-signals.md` in full before step 1. Headings in bold below are theirs.

## 1. Resolve the change scope

Resolve the target per **Resolve the change scope first**: the merge-base range before the working tree, untracked files included, lockfiles, snapshots and generated output excluded and named. A pull request is fetched into `refs/remotes/pr/<n>` and read with `git show`; `git checkout`, `git switch`, `gh pr checkout` and `git stash` stay unused.

No change to review → **With no change, ask rather than invent one**: state the facts, offer the open PR, the last commit by SHA, a named target, or a whole-screen Audit, and wait.

Done when: the scope block is filled (target, base ref and SHA, head ref and SHA, commit and uncommitted counts, files in scope, excluded).

## 2. Expand to surfaces and intent

Per **A diff is not a surface**: one hop of importers, two for tokens, theme values and shared primitives, at most five consumers, with the count not expanded stated. Per **Hold the change to its stated intent**: read the PR title and body, the linked issue and the commit subjects, then list the states and siblings the change should have covered.

Done when: the surface list and the intent line exist.

## 3. Fan out the domain reviewers

Dispatch per `SKILL.md` **Domain reviewers**, filling the Change block of [reviewer-prompt.md](reviewer-prompt.md). Scope files are the changed files plus the expanded surfaces, cited at the head ref. A domain with no evidence in the change gets no reviewer and is `Not reviewed: no evidence in the change scope`.

Rendered evidence is opt-in: only with a cheap preview or on request, in an isolated `git worktree add` removed afterwards. Otherwise visual claims are **Not verified**.

Done when: every dispatched reviewer returned a table with a status on every row, or an explicit "No actionable findings".

## 4. Consolidate and report

Consolidate per `SKILL.md`, with two changes from a screen review. The cap and the verdict cover `Introduced` and `Regression` only. A confirmed `Regression` against an escalation trigger is `HIGH`.

Report in `interface-review` **Review output format**: scope block, coverage, findings with a `Status` column, at most three `Pre-existing` findings in their own section, then `Block` or `Approve`. Correctness, test and security concerns are named once and pointed at the project's code review.

The user asks for the fixes → run [audit.md](audit.md) steps 5 to 7 with this report as the change scope.
