---
name: agent-cli
description: "Mine a repo's session transcripts for the lookups and commands agents repeat, and turn them into one bin/agent-cli with a subcommand each, --help and --json, then measure the saving. Run as /agent-cli."
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---

# agent-cli

Every session in a repo starts by getting oriented: the same files read, the same commands composed by hand, the same `--help` looked up.
Build `bin/agent-cli` so that orientation is one call with terse output, and point the repo's `AGENTS.md` at it.
Idea from Jean-Michel Lemieux's prompt (<https://x.com/jmwind/status/2116513031077384391>); `bin/agent-cli` in the agent-dotfiles repo is a worked example.

Sibling skills mine the same transcripts for other things: `backpass` for instructions, `correct` for mistakes. This one takes **habits**: actions repeated across sessions.

## 1. Sweep

Run `node <this skill dir>/scripts/sweep.mjs <repo-root>` (add `--min N` to raise the bar, `--json` for the raw lists).
It reads `~/.claude/projects/*/*.jsonl` whose `cwd` is the repo or a path under it and counts, in sessions, each file read, each command segment and each `--help` lookup, with up to five transcript ids per item.
No transcripts (exit 1, a pi or OpenCode machine, a new repo): say so and stop; a CLI built from guesses caches the wrong lookups.

Done when you hold a list of **habits**: groups of items that serve one intent (`git config user.name` + `git status` + `git worktree list` is one habit, "orient before a commit"), each with its session count and ids.

## 2. Pick subcommands

A habit earns a subcommand when it appears in at least 3 sessions **and** costs more than one cheap call: several commands, several files, or output the agent has to filter.
A single short command (`git log -1`) or a one-file read stays a lookup in the environment.
A habit already served by a dedicated tool (`gh-axi`, a project `verify-*` skill) stays with that tool.
Write the list as `subcommand: habit (N sessions, ids)` before any code.

## 3. Build `bin/agent-cli`

- In a language the repo already runs, with no new dependency; one executable file at `bin/agent-cli`.
- Read sources of truth at run time instead of copying them: a subcommand that runs CI jobs parses the CI workflow, one that lists modules reads the directory. A copied list goes stale without failing.
- Output written for an agent: one line per fact, problems before passes, a closing `summary:` line, exit code meaningful (0 clean, 1 found something, 2 usage).
  Every subcommand takes `--help` and `--json`.
- A check that could not run reports `SKIP` with the reason (missing tool), never `PASS`.

## 4. Test

One end-to-end script drives `bin/agent-cli` against a fixture repo and a fake home dir in `mktemp -d`, asserting each subcommand's output and exit code, including the failure paths (drift found, a failing job, an unknown name).
Add it to the repo's CI.
Done when the script passes locally and every subcommand ran once against the real repo.

## 5. Point at it

Add one line to the repo's `AGENTS.md` (or `CLAUDE.md` when that is the only file): `bin/agent-cli` lists its subcommands; run it before reading files or composing commands for orientation.
The line names when to reach for it; the CLI's `--help` holds the details, so the line never restates them.

## 6. Measure

The before and after numbers come from runs, never from the habit counts.
Pick two or three tasks the habits came from.
For each, give two fresh subagents the same brief: one in a worktree at the base ref (no CLI), one on the branch.
Record tool calls, total tokens and wall time from each subagent's usage report, and check both answers against the truth.
Report the table with its sample size; a run of one per arm is a sign, not a measurement.

## Reply

The habits table (habit, sessions, subcommand or why none), the measurement table, the files added, and each habit left out with its reason.
