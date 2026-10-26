---
name: interrogate
description: "Adversarial code review of a diff, branch or PR: parallel read-only reviewers on the models in reviewers.md, a lead verdict (Act on / Consider / Noted / Dismissed), with reviewer count, lenses and a blast-radius proof scaled to the diff's risk. Use for a code review, 'review this PR', 'interrogate', 'what could this break', 'blast radius', or the review step before a merge."
---

# Interrogate

Spawn read-only reviewers from the rows of `reviewers.md` for the harness you run in, as many as the diff's risk calls for (Step 3), then judge their findings as the lead.
The adversarial signal comes from independent reviewers, and it is strongest when they run on different model families.
The deliverable is a verdict: apply no fix until the user picks one.

## Step 1, Scope

- The user named files, a diff or a PR: use that (`gh pr diff <n>` for a PR).
- On a feature branch: the merge base with the repo's default branch against the working tree, `git diff $(git merge-base HEAD <base>)`, so staged and unstaged work counts.
- Otherwise: uncommitted work, `git diff HEAD`; when that is empty, the changes made in this session.

Either way, add the full contents of each untracked file from `git ls-files --others --exclude-standard`.
When `git diff --cached` and `git diff` disagree on a hunk, review the staged one too: the commit takes the index, not the working tree.

Package the diff with the context files a reviewer needs to follow it (callers, types, the module it lives in).
Done when you can name every changed file and say why each context file is included.

## Step 2, Intent

State the intent in one paragraph, drawn from the user's message, the commit messages, the PR body and the code.
If you are unsure of the intent, ask the user before spawning reviewers.

## Step 3, Risk

A diff is **risky** when it changes shared state, a data or wire format, a public API, concurrency, a delete or cleanup path, runtime config a program reads, or a dependency version, or when it is sensitive.
A diff is **sensitive** when it touches a git or harness hook, a CI workflow, an install, sync or release script, auth, billing, any `CLAUDE.md` or `AGENTS.md`, or a path the repo's `CLAUDE.md` or `AGENTS.md` names as sensitive.
Read that list from the merge base (`git show <base>:AGENTS.md`), so a diff cannot shrink its own list.
A user asking for a deep or full review makes the diff risky.

| Diff | Reviewers | Lenses | Blast radius |
|------|-----------|--------|--------------|
| Not risky | First row for your harness | `rubric.md` | Only when an Act on finding stands or falls on runtime behavior |
| Risky | Every row for your harness | `rubric.md` and `code-quality-review.md` | Always |

Done when you can name the trigger that made the diff risky, and each sensitive path, or say none fired.

## Step 4, Spawn reviewers

Read `reviewers.md` and take the rows Step 3 calls for, in order; label them Reviewer A, B, and so on.
Fill `references/reviewer-prompt.md` once and send that same prompt to every reviewer.
Paste text into it, not paths or commands: the intent, the diff output, and the full contents of each lens Step 3 calls for; on a diff that is not risky, drop the template's Code Quality Lens section.
OpenCode reviewers have no shell, and the skill's own files sit outside the repo under review, so a reviewer cannot fetch any of it.
Launch all reviewers in a single message so they run in parallel.

| Harness | Call per row |
|---------|--------------|
| Claude Code (has the `Agent` tool) | `Agent` with `subagent_type: general-purpose`, and `model` and `effort` from the row |
| OpenCode (has the `task` tool) | `task` with `subagent_type: interrogate-reviewer-<n>`, where n is the row's position among the `opencode` rows; `sync-config` pins the row's model and variant in that agent file |
| No subagent tool | Run each reviewer pass yourself, one after another, and say in the verdict that the reviewers were not independent |

Fallbacks, each reported in the Reviewers section of the verdict:

- Claude Code rejects a row's `model` or `effort`: rerun that reviewer without the rejected parameter.
- OpenCode has no `interrogate-reviewer-<n>` agent, or its description names a different model or variant than the row: `sync-config` has not run since the table changed, so use the agent as it is (or `subagent_type: general` when missing), report the model it actually runs, and tell the user to run the sync.
- No row for your harness: one reviewer on the session model.

## Step 5, Synthesize

Parse every reviewer's findings.
Merge findings that describe the same issue in different words, and record which reviewers raised each one.
A finding two or more reviewers raised independently is the highest signal; read a lone reviewer's finding and weight it accordingly.
When one reviewer flags something and another explicitly says the opposite, keep both as context for the verdict.
A reviewer that failed, returned no parseable findings, or names changed files in its Coverage as skipped or partly read is **incomplete**: its silence on those files is no review, never agreement.

A finding that shows a Step 3 trigger the diff alone hid (a public API, shared state, a caller three hops away) makes a non-risky diff risky: spawn the remaining rows with the code-quality lens, merge their findings in, and run Step 7.

## Step 6, Lead judgment

You are the lead reviewer, a pragmatic senior engineer, not a neutral aggregator.
Read `references/lead-judgment.md`, then put every finding in one bucket, with the reviewers that raised it and a one-line rationale:

- **Act on:** real issues affecting correctness, security or maintainability given the actual goals; they would block a real PR.
- **Consider:** legitimate, but you are not sure they outweigh the cost of addressing them now.
- **Noted:** technically valid but not actionable at this stage, and every real bug the base already has without this diff, tagged pre-existing.
- **Dismissed:** wrong, nitpicky, or missing context, with a brief reason.

Done when every finding from every reviewer sits in exactly one bucket.

## Step 7, Blast radius

When Step 3 calls for it, read `references/blast-radius.md` and prove the one fact the change is safe because of.
Otherwise write "not risky" with the reason and stop.

## Output format

### Intent
> The intent paragraph from Step 2.

### Risk
Risky or not risky, with the trigger; sensitive or not, with the paths that made it so.

### Reviewers
- Reviewer [label]: [model], [effort], [N findings], [complete, or incomplete with the files it missed], plus any fallback taken.

### Act On
Each: description, bug class with every location it occurs, which reviewers raised it, why it matters.

### Consider
Each: description, which reviewers raised it, the tradeoff.

### Noted
Brief list.

### Dismissed
Each with a brief rationale.

### Agreement Map
Where reviewers agreed and diverged, and what that pattern tells us; omit with a single reviewer.

### Blast Radius
The safety fact, the proof level it reached, and the proof output; or "not risky" with the reason.

---

Adapted from pstack's [`interrogate`](https://github.com/cursor/plugins/tree/main/pstack/skills/interrogate) and [`blast-radius`](https://github.com/cursor/plugins/tree/main/pstack/skills/blast-radius), MIT, see `LICENSE`.
The performance, API-contract and error-message checks in the rubric come from the former `thermo-nuclear-code-quality-review` skill.
