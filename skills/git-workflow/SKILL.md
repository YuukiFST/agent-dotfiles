---
name: git-workflow
description: "Use when shipping a change through GitHub end to end — before the first commit, not at merge time. Covers opening the issue, naming the branch, sequencing commits, opening a PR that closes the issue, recording a review before merge, choosing merge vs rebase vs squash, and cleaning up after. Also covers reverting a merged mistake, forks vs standalone repos, and contributing to someone else's repo."
---

# Git workflow — issue → branch → PR → review → merge

The safety rules live in `~/.claude/rules/git.md` and are always loaded: commit identity (§1), commit-message format (§2), push confirmation (§3), the AI-attribution ban (§4). **This skill does not restate them. Follow both.**

**Never push straight to `main`/`master` on a repo you own.** Turn on branch protection requiring a PR. Every change, including one-liners, follows the flow below. A repo may override it in its own `CLAUDE.md`.

## The flow

1. **Issue first.** Before writing code, open an issue stating the problem and the acceptance criteria — not the solution. `gh-axi issue create`. Label it (`bug`, `feat`, `chore`). Skip only for pure formatting runs.
2. **Branch per issue.** `<type>/<issue-number>-<slug>` — `feat/42-dashboard-consumo`, `fix/57-token-expiry`. Types match Conventional Commits (`rules/git.md` §2).
3. **Atomic commits.** One logical change per commit. Resist the end-of-day blob: a commit touching three unrelated things cannot be reverted or bisected. Read the diff before committing it, not after.
4. **PR closes the issue.** Body contains `Closes #42`, plus what changed, why, and how it was verified. Open it as a draft if the work spans sessions.
5. **Review before merge — always.** Run `autoreview` on the diff and post the findings **as a PR review on GitHub**, not as chat text. A PR merged with no recorded review is a broken flow, even solo.
6. **CI green before merge.** A red or skipped check blocks the merge. Fix the failure, never merge past it (global CLAUDE.md: a lint/test failure found along the way gets fixed).
7. **Merge with rebase or a merge commit — not squash by default.** Squash collapses the branch's atomic commits into one and destroys the history `git log`/`git blame` investigation depends on (global CLAUDE.md, "Git history is an investigation tool"). Squash only when the branch is genuinely WIP noise (`wip`, `fix typo`, `oops`).
8. **Delete the branch after merge.** The issue closes itself via `Closes #`.

## Shape of the work

- **Small PRs.** One issue, one concern. A 40-file PR gets rubber-stamped, which is the same as no review.
- **Own work lives in standalone repos.** Fork only to contribute upstream.
- **Upstream contributions are the highest-value work here** — PRs and reviews on other people's repos get real review from someone who is not you.

## Documented GitHub conditions the flow has to respect

Verified against [Profile contributions reference](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference). These are constraints on the repo setup, not reasons to do extra work:

- Issues, pull requests and discussions register only when opened **in a standalone repository, not a fork**.
- Commits register only when **all** of: the author e-mail is associated with the GitHub account; the repo is standalone, not a fork; the commit is on the **default branch or `gh-pages`**; and you are a collaborator/org member, forked it, or opened a PR or issue in it.

The e-mail condition binds directly to `rules/git.md` §1: committing under an identity that is not linked to the account silently detaches every commit from it. Verify the identity before the first commit in a repo.

Not documented either way: whether a review you submit on **your own** PR registers. Do not build any assumption on it — step 5 stands on the review being recorded where a human can read it, not on what it registers as.

## Enforcement mechanics (what actually works)

**Cursor injects `Co-authored-by` after `git commit`.** `commit-msg` alone does not stop that. Enforcement is:

1. **Global hooks** — `scripts/install-global-git-hooks.sh` sets `core.hooksPath` to `git-hooks/` (runs from every `sync-config.sh`).
2. **`pre-push`** — blocks push if any outgoing commit contains forbidden trailers (the real gate).
3. **`git-safe-commit.sh`** — agents in Cursor MUST use this instead of `git commit`:

```bash
/path/to/my-harness-config/scripts/git-safe-commit.sh \
  --author "Name <email>" \
  -m "type(scope): subject"
```

It builds the commit with `git commit-tree` (Cursor does not intercept). Author and committer are the same.

If a bad commit already exists, rebuild with `git commit-tree` + `git update-ref` and a clean message file.

Per-repo hook copy (`install-git-hooks.sh`) is optional fallback only — global `core.hooksPath` is the default.

## Why this shape

Traceability from issue to commit, a reviewable unit before code reaches `main`, a bisectable history. A legible public record is a by-product, never a goal: it does not justify splitting one change across five PRs, opening issues nobody will act on, or padding commit counts. If a step stops serving the code, drop the step.
