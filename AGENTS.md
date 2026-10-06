# Agent bootstrap — reaching config parity

This repo is the **canonical source** of the user's harness configuration.
Asked to "sync", "set up", or "reach parity", you make the machine you run on match this repo for the harnesses in its row below.

`CLAUDE.md` and `CODING_STANDARDS.md` at the repo root are **payloads** (the user's global instructions, copied into harness config dirs by the scripts), not instructions for working on this repo.
This file is.

## Hard rules

- **Edit here, sync there:** config changes land in this repo; the live dirs (`~/.claude`, `~/.agents`, `~/.pi/agent`) change only through a sync script.
- **Seeds are machine-owned:** `settings.json` (Claude Code, `sync-config.ps1` only) is written only when absent, and in `pi/settings.json` the `defaultProvider`, `defaultModel` and `defaultThinkingLevel` keys apply on first install only.
  Once written, the live value belongs to the machine and a sync leaves it alone; the rest of pi's `settings.json` is a merge in which `enabledModels`, `theme` and `packages` converge from the repo and pi-owned keys like `lastChangelogVersion` survive.
- **Commits and pushes follow `rules/git.md`** (hooks in `git-hooks/`).

## Machines

| Machine | Harnesses in use | Sync command |
|---------|------------------|--------------|
| Windows, work PC | Claude Code, pi, OpenCode | `pwsh -File scripts/sync-config.ps1 all` |
| Windows, home PC | pi, OpenCode | `pwsh -File scripts/sync-config.ps1 all` |
| NixOS, home PC | pi, OpenCode | `bash scripts/sync-config.sh pi` **and** `bash scripts/sync-config.sh opencode` |

**Cursor** runs on no machine: skip it when syncing, and keep `scripts/setup-cursor.sh` and the Cursor notes in place.

## Steps

1. **Find the row.** Match OS and machine to a row above.
   Done when you hold its harness list; a harness outside the row stays unsynced, since an extra one grows a config dir nobody keeps current.
2. **Install or sync.** A harness in the row not yet set up, or missing a tool (rtk, portless, gh-axi, chrome-devtools-axi), gets its setup script from `README.md` § Already cloned (idempotent, also the updater); otherwise run the row's sync command.
   `all` exists only in `sync-config.ps1`; `sync-config.sh` takes one harness per run.
   Done when every command exits 0 and ends with `Config synced (...)`.
3. **Fetch the design references** when `~/.claude/ui-refs/` is missing (first sync) or a refresh is asked for: `bash skills/ui-polish/update-refs.sh`.
   Sync never runs it, and the clones sit outside every skills dir on purpose so none of their frontmatter reaches a session.
   Done when `~/.claude/ui-refs/` lists the cloned repos.
4. **Verify.** Done when every check passes, or each failure is traced to a missing prerequisite and reported.
   1. `diff -rq rules ~/.claude/rules` prints nothing, and every `skills/<name>/` exists in the harness's skills dir (`~/.claude/skills` for Claude Code, `~/.agents/skills` for pi and OpenCode).
   2. `chrome-devtools-axi open https://example.com && chrome-devtools-axi snapshot` returns a page snapshot.
      It drives an installed Chrome and keeps no per-machine config, so a failure means Chrome is missing, not that the repo drifted.
   3. pi only: `show-shot <any png>` renders in the terminal.
   4. `portless doctor` passes once Node 24+ and the one-time bootstrap in `portless/setup.md` are in place.

## What the scripts won't tell you

Destinations are in `scripts/sync-config.{sh,ps1}`; these are the semantics an edit can trip on.

- **`skills/` is copied per skill, never mirrored,** so local-only skills survive a sync; a skill deleted from the repo reaches an already-synced machine only through its name in `skills/REMOVED.txt`.
- **`rules/` is a full mirror** at `~/.claude/rules` on every harness, because CLAUDE.md's pointers hardcode that path; a file written there by hand is gone on the next sync.
- **`CODING_STANDARDS.md` sits outside `rules/` on purpose:** Claude Code auto-loads every `rules/*.md`, and this file is disclosed, read only when CLAUDE.md's pointer fires.
