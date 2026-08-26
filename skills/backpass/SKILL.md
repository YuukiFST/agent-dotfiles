---
name: backpass
description: Train a project CLAUDE.md on its own session transcripts — one evidence-backed gradient step per run.
disable-model-invocation: true
---

# backpass — the backward pass on project memory

A project `CLAUDE.md` is **weights**. Every session that loads it is a forward pass; the gap
between what the agent did and what you wanted is the **loss**; reading the transcripts and
nudging the file is the **backward pass**. Most files never get one — they are appended to
from anecdote until they are bloated, stale and drifted.

`backpass` (`npx -y backpass`, MIT, [kunchenguid/backpass](https://github.com/kunchenguid/backpass))
runs that loop: sample transcripts, distil each, calculate loss per instruction, aggregate
gradients deterministically, propose a small edit set you accept or reject one by one.

Method write-up: <https://blog.kunchenguid.com/p/your-agentsmd-is-a-neural-net>.

## The two levels

| File | Treatment |
|---|---|
| `~/.claude/CLAUDE.md` + `rules/` (this repo's payload) | **Handwritten.** Your preferences, your opinions, your ownership. No tool trains it. Change it by hand, rarely. |
| A repo's own `CLAUDE.md` / `AGENTS.md` | **Trained.** Give it a token budget and run a gradient step on real transcripts. |

Never point `backpass` at the global file: it would optimise your preferences against sessions
that happened to run last month.

## Pick the right tool

- **`backpass`** — the repo has real session history and you want evidence: which instruction
  earned its keep, which one was violated, which one was wrong, what the agent kept
  rediscovering. Needs transcripts.
- **`claude-md-auditor`** — a new or history-less file, or you want the file judged against the
  research rubric (conciseness, specificity, hierarchy, mechanical validity) rather than against
  sessions. Needs nothing but the file.

They compose: audit shapes the file, backpass keeps it honest.

## Prerequisites

1. `acpx` on PATH (`npm i -g acpx`) — backpass drives the model through your existing harness
   login, not an API key. Without it the run exits with `error acpx not found on PATH`.
2. Node 22+.
3. Sessions on disk for this repo. `npx -y backpass scan` prints how many; under ~10 the batch
   is too small to separate pattern from noise — wait and run later.

## Run a gradient step

```bash
npx -y backpass init      # writes .backpassrc.json, excludes .backpass/ locally
npx -y backpass scan      # how many transcripts, from which harnesses
npx -y backpass           # collect -> loss -> aggregate -> propose  (read-only)
npx -y backpass apply     # review each edit, accept or reject
```

After `init`, set `skillsDir` in `.backpassrc.json` to where the repo actually keeps skills —
the default is `.agents/skills`, and a Claude Code repo uses `.claude/skills`. Getting this wrong
makes every "extract to a skill" proposal land in a directory nothing reads.

Nothing is written until `apply`, and `apply` writes only what you accept. Rejections are
remembered in `.backpass/rejections.json`, so a rejected edit does not come back without new
evidence.

## The knobs are the training hyperparameters

| Flag | Is | Default |
|---|---|---|
| `budgetTokens` (rc file) | model size | `5000` |
| `--max-edits` | learning rate | adaptive, ≤5 |
| `minGapEvidence` (rc file) | batch size — sessions needed before a new rule is proposed | `2` |
| `--since` | training window | `30d` |
| `--max-transcripts` | sample size per run | `100` |

Small steps beat a rewrite. A large step on a memory file is indistinguishable from starting
over, and everything that was working is lost with everything that wasn't.

## Reading a proposal

Each proposed edit carries a verbatim quote from a transcript. Judge the quote, not the summary:

- **Add** — the agent rediscovered or got this wrong in ≥2 independent sessions. Accept if the
  quote shows a real loss, reject if it shows one confused session.
- **Remove** — the unit was never relevant, or was followed and turned out wrong. Removing a
  wrong rule is worth more than adding a right one.
- **Rewrite** — the unit was right but the agent misread it.
- **Extract to a skill** — the unit is narrow (fires in a small share of sessions) but has a
  detectable trigger. This is the release valve when the file is at budget.

Reject on over-reach without guilt. The loop expects rejection; that is what the human gate is.

## Rhythm

One run a week per active repo. At or near budget every addition names the removal or extraction
that pays for it — the file stops growing and starts getting better instead.

Do not commit `.backpass/`; `init` excludes it via `.git/info/exclude`. `.backpassrc.json` is
repo config and should be committed, so every machine trains the same weights.
