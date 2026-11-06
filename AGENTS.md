# Agent bootstrap — reaching config parity

This repo is the **canonical source** of the user's harness configuration.
Asked to "sync", "set up", or "reach parity", you make the machine you run on match this repo for the harnesses in its row below.

`GLOBAL.md`, `CODING_STANDARDS.md` and `PROMPT_ENGINEERING.md` at the repo root are **payloads** (the user's global instructions, copied into harness config dirs by the scripts), not instructions for working on this repo.
This file is; the root `CLAUDE.md` only imports it, because by default Claude Code skips `AGENTS.md` when a `CLAUDE.md` or `CLAUDE.local.md` sits in the working directory or above.

**Orient with `bin/agent-cli` first:** it runs the CI jobs locally (`check`), compares the repo with the live dirs (`drift`), reports one skill's route, pins and sync state (`skill <name>`) and the git state a commit needs (`state`); reach for it before reading those files or composing those commands.

## Hard rules

- **Edit here, sync there:** config changes land in this repo; the live dirs (`~/.claude`, `~/.agents`, `~/.pi/agent`) change only through a sync script.
- **Seeds are machine-owned:** `settings.json` (Claude Code, `sync-config.ps1` only) is written only when absent, and in `pi/settings.json` the `defaultProvider`, `defaultModel` and `defaultThinkingLevel` keys apply on first install only.
  Once written, the live value belongs to the machine and a sync leaves it alone; the rest of pi's `settings.json` is a merge in which `enabledModels`, `theme` and `packages` converge from the repo and pi-owned keys like `lastChangelogVersion` survive.
- **Commits and pushes follow `rules/git.md`** (hooks in `git-hooks/`).
- **Sensitive paths** for `interrogate` in this repo: `AGENTS.md`, `CLAUDE.md`, `GLOBAL.md` and `rules/` (instructions every session loads), `skills/interrogate/` and `skills/git-workflow/` (the review and merge gate), `hooks/`, `mods/`, `git-hooks/`, `scripts/` and `.github/workflows/` (code run on every machine or in CI), `settings.json` (Claude Code permissions and hooks), `pi/cloak.json` (secret masking), `pi/extensions/`, `rtk/config.toml` and `herdr/` (live harness config).

## Machines

| Machine | Harnesses in use | Sync command |
|---------|------------------|--------------|
| Windows, work PC | Claude Code, pi, OpenCode, Herdr UI | `pwsh -File scripts/sync-config.ps1 all` |
| Windows, home PC | pi, OpenCode | `pwsh -File scripts/sync-config.ps1 all` |
| NixOS, home PC | pi, OpenCode | `bash scripts/sync-config.sh pi` **and** `bash scripts/sync-config.sh opencode` |

**Cursor** runs on no machine: skip it when syncing, and keep `scripts/setup-cursor.sh` and the Cursor notes in place.

## Steps

1. **Find the row.** Match OS and machine to a row above.
   Done when you hold its harness list; a harness outside the row stays unsynced, since an extra one grows a config dir nobody keeps current.
2. **Install or sync.** A harness in the row not yet set up, or missing a tool (rtk, gh-axi, chrome-devtools-axi, browser-harness, and in OpenCode the caveman-lean, ponytail-subagent and goal plugins), gets its setup script from `README.md` § Already cloned (idempotent, also the updater); otherwise run the row's sync command.
   `all` exists only in `sync-config.ps1`; `sync-config.sh` takes one harness per run.
   The scripts copy the working tree of their own checkout, uncommitted files included, so a checkout on another branch installs that branch: run the sync from a tree at `origin/main`, or tell the user to.
   Done when every command exits 0 and ends with `Config synced (...)`.
3. **Fetch the design references** when `~/.claude/ui-refs/` is missing (first sync) or a refresh is asked for: `bash skills/ui-polish/update-refs.sh`.
   Sync never runs it, and the clones sit outside every skills dir on purpose so none of their frontmatter reaches a session.
   Done when `~/.claude/ui-refs/` lists the cloned repos and the script printed no `UNROUTED` or `MISSING` line; each such line is fixed here in `skills/ui-polish/` (a route in `SKILL.md`, a **Not routed** entry in `not-routed.md`, a repointed path or section citation, or a local term defined) and the script rerun.
4. **Verify.** Done when every check passes, or each failure is traced to a missing prerequisite and reported.
   Run checks 1 and 2 plus the checks for the row's harnesses and report each by number with its result; `drift` or a hand diff answers check 1 alone, and a check not run leaves the sync reported as unverified.
   1. `bin/agent-cli drift` prints `summary: 0 drift`: rules, payload files and every `skills/<name>/` match their live copies byte for byte, and no `REMOVED.txt` skill is still live.
   2. `browser-harness --version` prints a version, and `chrome-devtools-axi open https://example.com && chrome-devtools-axi snapshot` returns a page snapshot.
      A snapshot failure means Chrome is missing, not that the repo drifted.
      browser-harness reaches the user's Chrome only after a one-time tick at `chrome://inspect/#remote-debugging` and an Allow click, which `browser-harness --doctor` reports as `daemon alive`.
   3. pi only: `pi --version` exits 0, and `show-shot <any png>` renders in the terminal.
   4. OpenCode only: `node scripts/opencode-plugins.mjs wait` exits 0 and prints `caveman`, `ponytail-subagent` and `local.goal-mode.server`, and `~/.config/opencode/cli.json` lists the goal plugin.
      One `opencode plugin list` proves nothing: a directory the server has not loaded yet answers with only the goal plugin, ID `-`, so that script polls, with a limit, until the answer settles.

## What the scripts won't tell you

Destinations are in `scripts/sync-config.{sh,ps1}`; these are the semantics an edit can trip on.

- **`skills/` is copied per skill, never mirrored,** so local-only skills survive a sync; a skill deleted from the repo reaches an already-synced machine only through its name in `skills/REMOVED.txt`.
- **A user-invoked skill needs two markers:** `disable-model-invocation: true` covers Claude Code and pi, but OpenCode reads `metadata` keys `opencode/autoinvoke: "false"` and `opencode/slash: "true"` instead; `scripts/check-skill-frontmatter.sh` fails CI when the pair is missing.
- **OpenCode makes every skill a `/name` command by itself,** so no per-skill command file belongs in `~/.config/opencode/commands`: one shadows the native command with a frozen description and outlives its skill, and the sync deletes each file carrying the `generated:opencode-skill-command` marker.
- **`opencode.json(c)` stays machine-owned:** the setup scripts add only the tracked plugins to `plugins`, and `remove-fff` deletes the retired `mcp.fff` key through `scripts/remove-opencode-mcp.mjs`, whose rewrite drops comments, so the first rewrite keeps the original as `.bak`.
- **OpenCode 2 splits plugin loading in two files:** `opencode plugin add` writes the server half into `opencode.json(c)`, while the TUI half (sidebar, palette) loads only from `cli.json`, which that CLI never writes. `scripts/add-opencode-tui-plugin.mjs` appends the goal plugin to its `plugins[]` and keeps a `.bak` of the first rewrite, so the machine's theme, keybinds and session keys survive.
- **A vendored or adapted skill, hook or plugin gets a row in `skills/UPSTREAMS.tsv`,** pinned at the upstream commit it was taken from (a plugin in its own repo, like `YuukiFST/caveman-lean`, is listed by that repo's name); the weekly `upstreams.yml` run reports every row whose upstream moved past its pin in one `upstream-drift` issue, and only the manifest holds pins.
- **`mods/` is copied over, never mirrored:** Claude Code writes each mod's `.claude-plugin/types/` itself, so the repo leaves it out and a file deleted from a repo mod stays on synced machines until removed by hand.
- **`rules/` is a full mirror** at `~/.claude/rules` on every harness, because GLOBAL.md's pointers hardcode that path; a file written there by hand is gone on the next sync.
- **OpenCode reviewer agents are generated, not copied:** OpenCode's `task` tool takes no model, so the sync writes one `~/.config/opencode/agents/interrogate-reviewer-<n>.md` per `opencode` row of `skills/interrogate/reviewers.md` and deletes the rest of that prefix; edit the table, never the generated files.
- **`herdr/config-gpui.toml` is set key by key, never copied:** `Sync-Herdr` passes each key to `herdr-gpui config set`, which validates it and rewrites `config-gpui.local.toml` without its comments, so keys the app writes there survive.
  Strings use single quotes because PowerShell 5.1 drops double quotes inside native arguments; Herdr UI runs on Windows only here, so `sync-config.sh` has no herdr target.
- **`rtk/config.toml` replaces the live rtk config whole,** at the path `rtk config` prints; an rtk setting changed by hand on a machine is gone on the next sync, so it belongs in the repo file.
- **`CODING_STANDARDS.md` and `PROMPT_ENGINEERING.md` sit outside `rules/` on purpose:** Claude Code auto-loads every `rules/*.md` in every session and subagent, and these files are disclosed, read only when a pointer fires (in `GLOBAL.md` and `rules/prompting.md`).
- **Assume CRLF on a Windows checkout:** `.gitattributes` pins LF only for `*.sh` and `bin/*`, so make multi-line edits with Edit, never an LF-anchored script, and compare files by blob hash (`git hash-object`).
- **Git Bash rewrites slash-leading arguments:** `/caveman off` reaches a native CLI as `C:/Program Files/Git/caveman off`, which can pass a test falsely, so send such arguments from PowerShell or with `MSYS_NO_PATHCONV=1`.
