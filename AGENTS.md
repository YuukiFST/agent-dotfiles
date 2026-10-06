# Agent bootstrap — reaching config parity

This repo is the **canonical source** of the user's harness configuration.
Your job when asked to "sync", "set up", or "reach parity": make the machine you are running on match this repo, for the harness you are running in.

Note: `CLAUDE.md` and `CODING_STANDARDS.md` at the repo root are **payloads** (the user's global instructions, copied into harness config dirs by the scripts) — not instructions for working on this repo.
This file is.

## Machines

| Machine | Harnesses in use | Sync command |
|---------|------------------|--------------|
| Windows, work PC | Claude Code, pi, OpenCode | `pwsh -File scripts/sync-config.ps1 all` |
| Windows, home PC | pi, OpenCode | `pwsh -File scripts/sync-config.ps1 all` |
| NixOS, home PC | pi, OpenCode | `bash scripts/sync-config.sh pi` **and** `bash scripts/sync-config.sh opencode` |

Sync only the harnesses in the machine's row: an extra one grows a config dir nobody keeps current.
`all` exists only in `sync-config.ps1`; `sync-config.sh` takes one harness per run.

**Cursor** runs on no machine: skip it when syncing, and keep `scripts/setup-cursor.sh` and the Cursor notes in place.

## How to reach parity

Full install or update: the setup script for your harness, listed in `README.md` § Already cloned (idempotent; also the updater).
Config drift only: the machine's sync command above.

What the scripts propagate:

- `CLAUDE.md` → global instructions: `~/.claude/CLAUDE.md`, `~/.pi/agent/AGENTS.md`, `~/.config/opencode/AGENTS.md`
- `CODING_STANDARDS.md` → `~/.claude/CODING_STANDARDS.md` on EVERY harness, read on demand via the pointer in `CLAUDE.md`
- `rules/` → `~/.claude/rules` on EVERY harness, full mirror (archived rules live in `stacks/<name>/rules/` and never ship)
- `skills/` → `~/.claude/skills`, `~/.agents/skills` (read natively by pi, OpenCode and Cursor); archived stacks pruned from live dirs.
  `sync-config.sh pi` and `cursor` also prune stale copies under `~/.claude/skills` when that dir exists.
  The copy is per-skill and never a mirror, so local-only skills survive — which is also why deleting a skill needs its name in `skills/REMOVED.txt` to actually reach a machine that already synced it.
- `skills/ui-polish/update-refs.sh` → `~/.claude/ui-refs/` (design reference repos the `ui-polish` skill reads).
  Not run by sync: run it once by hand after the first sync, and again to refresh.
  The clones sit outside every skills dir so none of their frontmatter reaches a session.
- `stacks/` → nothing: archived config, pruned from live dirs, and absent from a bootstrap clone (sparse checkout).
  Enable with `scripts/stack.sh enable <name>` (see `stacks/README.md`)
- `scripts/show-shot` → `~/.local/bin/show-shot` (inline terminal screenshots, any PNG)
- `settings.json` → `~/.claude/settings.json` (`sync-config.ps1` only), a seed: written only when absent; Claude Code owns the live file.
- `pi/` → `~/.pi/agent` agent config (settings packages, extensions, cloak).
  `settings.json` there is a MERGE, not a mirror: pi owns keys like `lastChangelogVersion`.
  `pi/settings.json` is a seed: `defaultProvider`, `defaultModel`, and `defaultThinkingLevel` apply on first install only — sync never overwrites a live choice.
  `enabledModels`, `theme`, and `packages` always converge from the repo.
- tools (setup scripts only): rtk, portless, gh-axi, chrome-devtools-axi

## Verify (after syncing)

1. `ls ~/.claude/rules` and the skills dir for your harness — non-empty, matches repo.
2. `chrome-devtools-axi open https://example.com && chrome-devtools-axi snapshot` — returns a page snapshot.
   It drives an installed Chrome and keeps no per-machine config, so a failure here means Chrome is missing, not that the repo drifted.
3. pi only: `show-shot <any png>` renders in the terminal.
4. `portless doctor` — passes once Node 24+ and the one-time bootstrap in `portless/setup.md` are in place.

## Hard rules for agents working on this repo

- Config is edited HERE and propagated by scripts; the live dirs (`~/.claude`, `~/.agents`, `~/.pi/agent`) change only through a sync.
  The seeds above are the exception: once written, the live copy is machine-owned.
- Commits and pushes follow `rules/git.md` (hooks in `git-hooks/`).
