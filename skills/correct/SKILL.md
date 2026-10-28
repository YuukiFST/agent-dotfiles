---
name: correct
description: "Find the mistakes agents keep repeating in a repo and make each one impossible: architecture first, then types, then a lint whose error names the fix, then a test, docs last, each check proven to fail on a real past mistake. Run as /correct."
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---
<!-- Source: https://github.com/cursor/plugins/tree/main/pstack/skills/correct (MIT, notice in LICENSE); sources and commits adapted to Claude Code and rules/git.md -->

# Correct

The user keeps correcting agents in this repo for the same mistakes. Change the repo so the next agent can't make them.

Assume every contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. Design the repo so a change that looks right from one file is right for the whole repo.

## Find the mistake classes

First, read the record of past corrections:

- recent commits and reverts (`git log`, `git log --grep=Revert`);
- PR review comments (`gh-axi pr view <n> --reviews --comments`);
- the agent instruction files (`AGENTS.md`, `CLAUDE.md`, `.claude/rules/`) and comments that explain workarounds;
- the user's corrections in this repo's Claude Code transcripts: the `~/.claude/projects/*/*.jsonl` files whose `"cwd"` field is the repo root (`git rev-parse --show-toplevel`) or a path under it, written as the native path JSON-escaped (`C:\\Users\\...` on Windows).
  Hand the transcript sweep to a read-only explore subagent and keep only its list of corrections, each with its transcript id.
  No matching transcript (no `~/.claude/projects` on a pi or OpenCode machine, or none for this repo): say so in the Reply instead of counting zero corrections.

Group the mistakes into classes. A class counts once it has happened twice.

## Fix each class at the highest level that works

1. **Eliminate it with architecture.** Give each piece of state one owner and each task one supported way. Hide internals so the wrong import fails. Replace hand-synced lists with one source of truth. Delete old ways and dead code an agent would copy.
2. **Enforce it with types so the bad state can't be written.** If bad code still compiles, add a lint or CI check whose error names the file, type, or function to use instead. If the pattern is already common, fail only when a change adds more.
3. **Test the behavior.** Fix or delete any test that still passes when the behavior it checks breaks, or that fails when only the internals change.
4. **Write docs or agent rules last, only for judgment calls.** Nothing fails when an agent skips them.

## Fix and prove

Then fix the most frequent classes now, one commit each, under `~/.claude/rules/git.md`. Prove each new check fails on a real past mistake. Run the same command locally and in CI. Exceptions go on the offending line with a reason, an expiry date, and a human's approval.

## Keep the rule table

Last, keep a table in the repo's `AGENTS.md` (its `CLAUDE.md` when it has no `AGENTS.md`) that pairs each rule with what enforces it. Head the table with a line every later session loads: a correction whose rule is already in this table with nothing enforcing it is a repeat, fixed at the highest level in the same change. When the user corrects you, fix the mistake and add the rule. If the rule was already there and nothing enforces it, that's a repeat, so fix it at the highest level in the same change. Drop a rule once its mistake can't happen.

**Reply:** each class with its evidence, the level you picked, and why a higher level didn't work.
