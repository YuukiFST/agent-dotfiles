---
name: interrogate
description: "Adversarial code review of a diff, branch or PR: parallel read-only reviewers on the models in reviewers.md, a lead verdict (Act on / Consider / Noted / Dismissed), and a blast-radius proof for risky changes. Use for a code review, 'review this PR', 'interrogate', 'what could this break', 'blast radius', or the review step before a merge."
---

# Interrogate

Spawn one read-only reviewer per row of `reviewers.md` for the harness you run in, then judge their findings as the lead.
The adversarial signal comes from independent reviewers, and it is strongest when they run on different model families.
The deliverable is a verdict: apply no fix until the user picks one.

## Step 1, Scope

- The user named files, a diff or a PR: use that (`gh pr diff <n>` for a PR).
- On a feature branch: `git diff <base>...HEAD`, where base is the repo's default branch.
- Otherwise: the changes made in this session.

Package the diff with the context files a reviewer needs to follow it (callers, types, the module it lives in).
Done when you can name every changed file and say why each context file is included.

## Step 2, Intent

State the intent in one paragraph, drawn from the user's message, the commit messages, the PR body and the code.
If you are unsure of the intent, ask the user before spawning reviewers.

## Step 3, Spawn reviewers

Read `reviewers.md` and take the rows for your harness, in order; label them Reviewer A, B, and so on.
Fill `references/reviewer-prompt.md` once and send that same prompt to every reviewer.
Paste text into it, not paths or commands: the intent, the diff output, and the full contents of `references/rubric.md` and `references/code-quality-review.md`.
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

## Step 4, Synthesize

Parse every reviewer's findings.
Merge findings that describe the same issue in different words, and record which reviewers raised each one.
A finding two or more reviewers raised independently is the highest signal; read a lone reviewer's finding and weight it accordingly.
When one reviewer flags something and another explicitly says the opposite, keep both as context for the verdict.

## Step 5, Lead judgment

You are the lead reviewer, a pragmatic senior engineer, not a neutral aggregator.
Read `references/lead-judgment.md`, then put every finding in one bucket, with the reviewers that raised it and a one-line rationale:

- **Act on:** real issues affecting correctness, security or maintainability given the actual goals; they would block a real PR.
- **Consider:** legitimate, but you are not sure they outweigh the cost of addressing them now.
- **Noted:** technically valid but not actionable at this stage.
- **Dismissed:** wrong, nitpicky, or missing context, with a brief reason.

Done when every finding from every reviewer sits in exactly one bucket.

## Step 6, Blast radius

A diff is **risky** when it changes shared state, a data or wire format, a public API, concurrency, a delete or cleanup path, config, or a dependency version, or when an Act on finding stands or falls on runtime behavior.
For a risky diff, read `references/blast-radius.md` and prove the one fact the change is safe because of.
For any other diff, write "not risky" with the reason and stop.

## Output format

### Intent
> The intent paragraph from Step 2.

### Reviewers
- Reviewer [label]: [model], [effort], [N findings], plus any fallback taken.

### Act On
Each: description, which reviewers raised it, why it matters.

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
