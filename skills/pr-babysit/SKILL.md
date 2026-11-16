---
name: pr-babysit
description: "Deterministic loop over your open PRs: one state and at most one next action per PR, a ledger against acting twice on a commit, an agent started only to fix a red pipeline, a conflict or review feedback, under a trust ladder that starts at L0."
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---
<!-- Source: Jalal Ashrafi, "Stop babysitting your PRs" (https://x.com/i/status/2122066461007175851). Changed: no footer links an artifact to its session (rules/git.md §4), a local registry routes fixes instead; reviewer nudges always wait for the user's yes. -->

# PR babysit

The loop is `scripts/babysit.mjs`, plain code with no model in it.
Each `tick` snapshots every open PR you authored (`gh search prs --author @me`, then `gh pr view --json`), puts each PR in one state, picks at most one next action, and skips any action the ledger already holds for that head commit.
State lives outside every repo, in `$PR_BABYSIT_HOME` or `~/.local/state/pr-babysit`: `snapshot.json`, `plan.txt`, `ledger.jsonl`, `sessions.json`, `briefs/` and `logs/` (each fix agent's output, its drafted replies included).

## Steps

1. **Tick once by hand.** `node <this skill's dir>/scripts/babysit.mjs tick` prints one line per PR: repo and number, short head, state, risk, then the action and its note.
   Done when the line count matches `open=` in the header and you have read each `fix:` brief it wrote.
2. **Register the builder.** When an agent opens a PR, it runs `babysit.mjs register <owner/repo#n>` in its own session; the id comes from `CLAUDE_CODE_SESSION_ID`, or `--session` on another harness.
   This mapping is the only link from a PR to its agent, and it never leaves the machine.
3. **Grade the risk.** The PR body carries `Risk: low|medium|high` (criteria in the `pr-writing` skill); a PR without it reads as `risk=unknown`, which every question treats as high.
4. **Schedule it** as plain code, so a tick costs no tokens: `*/10 * * * * node <dir>/scripts/babysit.mjs tick` in cron, or `schtasks /create /sc minute /mo 10 /tn pr-babysit /tr "node <dir>\scripts\babysit.mjs tick"` on Windows.
   `/loop 10m` with the same command also works, but wakes a model every tick.
   Creating the scheduled task is the user's call: show the command and wait for a yes.
5. **Answer the questions.** A `question:` note is a numbered choice for the user (merge, or ask reviewers to look); relay it and act only on the number they give.

## States and actions

Rules run top to bottom; the first match is the PR's state.

| State | Rule | Action |
|---|---|---|
| `draft` | draft PR | wait |
| `conflict` | `mergeable` is `CONFLICTING` | `fix:conflict` |
| `ci-red` | a check failed, errored, timed out or was cancelled | `fix:ci` |
| `ci-pending` | a check is still running | wait |
| `review-feedback` | someone with write access (`OWNER`, `MEMBER`, `COLLABORATOR`) other than you reviewed or commented after the head commit and after the last `fix:review` for it | `fix:review` |
| `merge-unknown` | `mergeable` not yet computed (`UNKNOWN`) | wait |
| `ready` | approved, or no review required, green and `MERGEABLE` | `ask:merge` |
| `awaiting-review` | review still required | after 4 h without one (counted from the head commit or the last `fix:review`), inside working hours (Mon to Fri, 9 to 18), at most every 3 days: `ask:nudge` |

A `fix:` action writes a brief to `briefs/`: the failing checks and their log links, or the review text fenced as untrusted data, and the done criteria for the agent.

## Trust ladder

Start at L0; raise the level with `--level` only when the user says so.

| Level | Fix agents | Replies on review threads | Merge |
|---|---|---|---|
| L0 | briefs only, nobody started | none | asked |
| L1 | registered session resumed with the brief | drafted in the agent's report, the user posts | asked |
| L2 | same | posted by the agent, naming the fixing commit | asked |
| L3 | same | same | approving low-risk PRs you review; the loop snapshots only your own PRs, so L3 runs as L2 |

Nudging reviewers is a message to other people, so at every level it stays a question.
The fix command is `claude --resume <session> -p "Fix the PR described in <brief>"`; `$PR_BABYSIT_DISPATCH` swaps it for another harness.
On Windows the `claude` on PATH is an npm `.cmd` shim that `spawn` cannot start, so point `$PR_BABYSIT_DISPATCH` at `claude.exe` under `npm/node_modules/@anthropic-ai/claude-code/bin/`; a start that fails prints `dispatch failed` and retries on the next tick.

## Test

`node --test skills/pr-babysit/scripts/babysit.test.mjs` replays `scripts/fixtures/snapshot.json`; `UPDATE_GOLDEN=1` rewrites `tick-l0.golden.txt`, whose diff you read before committing.
