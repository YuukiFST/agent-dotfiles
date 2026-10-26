---
name: git-workflow
description: "Ship a change through GitHub end to end, only when the user invokes /git-workflow: open the issue, name the branch, sequence commits, open a PR that closes the issue, record a review, merge the PR, then delete the dead branches, worktrees and leftover files on the machine. Also covers reverting a merged mistake, forks vs standalone repos, and contributing to someone else's repo."
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---

# Git workflow — issue → branch → PR → review → merge → cleanup

The safety rules live in `~/.claude/rules/git.md` and are always loaded: commit identity (§1), commit-message format (§2), push confirmation (§3), the AI-attribution ban (§4). **This skill does not restate them. Follow both.**

**User-invoked only.** The flow runs when the user invokes `/git-workflow` or asks to ship the change with it; a message that only talks about this skill (editing it, quoting a step) does not start it.
That invocation is the user's go-ahead to merge the PR this run opened, once steps 5 and 6 pass; it covers no other PR, and a merge that triggers a release or deploy, or lands a PR the review marks sensitive, still needs its own yes.
A skill that points here for one convention (branch name, PR body) applies that convention only, and the merge and cleanup do not run.

**Never push straight to `main`/`master` on a repo you own.** Turn on branch protection requiring a PR. Every change shipped through this skill, including one-liners, follows the flow below. A repo may override it in its own `CLAUDE.md`.

## The flow

1. **Issue first.** Before writing code, open an issue stating the problem and the acceptance criteria — not the solution. `gh-axi issue create`. Label it with an existing label that fits the change type, read from `gh-axi label list`; with GitHub's defaults that is `bug` for a fix and `enhancement` for a feat or chore. A label the repo lacks fails the create, and adding one to someone else's repo is their call. Skip only for pure formatting runs.
2. **Branch per issue.** `<type>/<issue-number>-<slug>` — `feat/42-dashboard-consumo`, `fix/57-token-expiry`. Types match Conventional Commits (`rules/git.md` §2).
3. **Atomic commits.** One logical change per commit. Resist the end-of-day blob: a commit touching three unrelated things cannot be reverted or bisected. Read the diff before committing it, not after.
4. **PR closes the issue.** Body contains `Closes #42`, plus what changed, why, and how it was verified: the output of the check that proves the issue's acceptance criteria, run on the PR's head commit and trimmed to the decisive lines, with secrets, tokens, personal data and home paths redacted, so the reviewer checks the outcome before reading the diff.
   UI work adds a screenshot or recording with `gh pr create --attach '<file>#<alt>'` or `gh pr edit <n> --attach` (gh-axi has no attach flag; evidence paths stay git-ignored, never committed); a later push reruns the check and updates the body.
   No runnable check: write **Not verified** and why. Open it as a draft if the work spans sessions.
   Then confirm GitHub linked it: `gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<pr>){closingIssuesReferences(first:5){nodes{number}}}}}'` lists the issue. Empty list: the merge will not close it, so step 8 closes it by hand. #105 and #107 in agent-dotfiles had `Closes #N` on line one and still never linked.
5. **Review before merge — always.** Run the `interrogate` skill on the PR and post its verdict **as a PR review on GitHub**, not as chat text. A PR merged with no recorded review is a broken flow, even solo.
   A verdict that marks the diff sensitive holds the merge: once the Act on fixes are pushed, show the user the verdict and the head SHA to merge, and wait for their go-ahead; a push after it needs a new one, since an agent's review is not a human approval.
6. **CI green before merge.** A red or skipped check blocks the merge. Fix the failure, never merge past it (global CODING_STANDARDS.md, "Boy Scout rule": a lint/test failure found along the way gets fixed).
7. **Merge with rebase or a merge commit — not squash by default.** Squash collapses the branch's atomic commits into one and destroys the history `git log`/`git blame` investigation depends on (global CLAUDE.md, "Git history is an investigation tool"). Squash only when the branch is genuinely WIP noise (`wip`, `fix typo`, `oops`).
   Before merging, fix and push every review finding marked Act on, then wait for step 6 to pass again on the new head commit.
   Then merge it yourself: `gh-axi pr merge <n> --rebase` or `--merge`, without `--delete-branch`, since step 9 deletes branches in the order a worktree needs.
   A merge that GitHub refuses (conflict, protection rule) stops the run: report the refusal and ask.
8. **Confirm the issue is closed.** `gh-axi issue view <n>` still `open` → `gh-axi issue close <n>`.
9. **Delete what the merge left dead, on every branch of the repo, not only this run's.** Work from the main checkout, never from inside a worktree you remove.
    1. `git status --porcelain` must print nothing; then `git switch <default-branch>`, `git pull --ff-only` and `git fetch --prune`. Any of these failing stops the cleanup: report it and ask.
    2. Only a local branch named `<type>/<issue-number>-<slug>` (step 2) can be dead; the default branch and long-lived branches (`develop`, `release/*`, `gh-pages`) never are.
       It is dead when `gh pr view <branch> --json number,state,headRefOid,isCrossRepository` shows `MERGED`, `isCrossRepository` false, and the branch tip holds no commit beyond the PR head: `git fetch origin pull/<number>/head`, then `git merge-base --is-ancestor <branch> <headRefOid>` exits 0.
       Judge by the PR, not `git branch --merged`: a rebase merge leaves local SHAs that look unmerged.
       A branch with no PR is dead only when `git log <default-branch>..<branch>` prints nothing.
       Any other branch (a PR closed unmerged, commits past the PR head, no PR and unlanded commits) is live work: keep it and name it in the report.
    3. For each dead branch, in order: remove its worktree (global CODING_STANDARDS.md, "Leave no trace"), `git branch -D <branch>`, then `git push origin --delete <branch>` if the remote still has it and the repo is yours.
       A worktree that refuses removal stays, with its branch, and goes in the report.
    4. `git worktree list` marks a worktree whose directory is already gone as `prunable`: run `git worktree prune`.
    5. Delete the leftover files this run created: scratch dirs and clones in OS temp, and the step 4 evidence files.
       `git clean -n` lists the other untracked files in the checkout. Name them in the report and leave them, since they may be work in progress.
       Build caches (`target/`, `node_modules/`) and package caches stay, as "Leave no trace" says.

    Done when `git branch -vv` and `git worktree list` show no dead branch, and the report names each branch, worktree and file kept, with the reason.

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
