# Agent bootstrap — reaching config parity

You are an agent (Cursor, pi, Claude Code, or other) that was pointed at this
repo. This repo is the **canonical source** of the user's harness configuration.
Your job when asked to "sync", "set up", or "reach parity": make the machine you are
running on match this repo, for the harness you are running in.

Note: `CLAUDE.md` at the repo root is a **payload** (the user's global instructions,
copied into harness config dirs by the scripts) — it is not instructions for working on
this repo. This file is.

## Machines

| Machine | Harnesses in use | Sync command |
|---------|------------------|--------------|
| Windows, work PC | Claude Code CLI | `pwsh -File scripts/sync-config.ps1` |
| Windows, home PC | pi, OpenCode | `bash scripts/sync-config.sh pi` |
| NixOS, home PC | pi, OpenCode | `bash scripts/sync-config.sh pi` |

Run only the command for the machine you are on. `sync-config.ps1` writes `~/.claude`;
`sync-config.sh` writes `~/.agents/skills` and `~/.pi/agent`. A machine that runs the wrong
one grows a config dir nobody keeps current — that is how the work PC ended up carrying a pi
install for a harness it never runs (removed 2026-08-26, issue #29).

**Cursor** is no longer used on any machine. `scripts/setup-cursor.sh` and the Cursor notes
stay because the config is still correct, not because a machine consumes them.
**OpenCode** runs on both home machines and this repo has no sync path for it: its config is
maintained by hand, outside here.

## How to reach parity

Run the setup script for your harness (idempotent — also the updater):

| Harness | Command |
|---------|---------|
| Claude Code (Windows) | `pwsh -File scripts/setup-claude.ps1` |
| Claude Code (Unix) | `bash scripts/setup-claude.sh` |
| Cursor | `bash scripts/setup-cursor.sh` |
| pi | `bash scripts/setup-pi.sh` |

If tools are already installed and only config drifted, `scripts/sync-config.sh <harness>`
(or `sync-config.ps1` on Windows) is enough.

What the scripts propagate:

- `CLAUDE.md` → global instructions (`~/.claude/CLAUDE.md`, `~/.pi/agent/AGENTS.md`)
- `stacks/` → nothing: archived config, pruned from live dirs. Enable with `scripts/stack.sh enable <name>` (see `stacks/README.md`)
- `skills/` → `~/.claude/skills`, `~/.agents/skills` (Cursor + pi); archived stacks pruned from live dirs.
  The copy is per-skill and never a mirror, so local-only skills survive — which is also why deleting a
  skill needs its name in `skills/REMOVED.txt` to actually reach a machine that already synced it.
- `rules/` → `~/.claude/rules` on EVERY harness, full mirror (archived rules live in `stacks/<name>/rules/` and never ship)
- `agent-browser/` → seeds `~/.agent-browser/config.json` (NixOS preset when `/etc/NIXOS`
  exists, base preset otherwise; Windows preset on Windows) and installs
  `~/.local/bin/show-shot` (inline terminal screenshots)
- `pi/` → `~/.pi/agent` agent config (settings packages, extensions, cloak, cursor-sdk).
  `pi/settings.json` is a seed: `defaultProvider`, `defaultModel`, and `defaultThinkingLevel`
  apply on first install only — sync never overwrites a live choice. `enabledModels`, `theme`,
  and `packages` always converge from the repo.
- tools (setup scripts only): rtk, portless,
  agent-browser (+ Chrome), gh-axi

## Verify (after syncing)

1. `ls ~/.claude/rules` and the skills dir for your harness — non-empty, matches repo.
2. `agent-browser doctor --offline --quick` — must pass. On NixOS the config must point
   `executablePath` at the nixpkgs chromium (bundled Chrome does not run on non-FHS).
3. pi only: `show-shot <any png>` renders in the terminal.
4. `portless doctor` — requires Node 24+ and a one-time bootstrap (`portless service
   install` + `portless trust`, see `portless/setup.md`). When the proxy is up, prefer
   `https://<name>.localhost` URLs over `http://localhost:<port>` when driving dev servers.

## Hard rules for agents working on this repo

- Config is edited HERE and propagated by scripts — never patch `~/.claude`,
  `~/.agents` directly (except files documented as seeds:
  `settings.json`, `~/.agent-browser/config.json`, which the scripts never overwrite).
  For pi, `defaultProvider` / `defaultModel` / `defaultThinkingLevel` in the live
  `~/.pi/agent/settings.json` are also machine-owned after the first sync.
- Commits: English, Conventional Commits, no AI attribution of any kind
  (no `Co-authored-by`, no "Generated with"). In Cursor use `git-safe-commit`, not `git commit`.
  See `rules/git.md` and `git-hooks/`. The issue → branch → PR → review → merge flow
  lives in the `git-workflow` skill, not in the rule file.
- Cursor global rules cannot be file-synced — tell the user to paste `CLAUDE.md` into
  Customize → Rules manually after edits.
- agent-browser deep dive: `agent-browser/setup-nixos-pi.md` (NixOS install, terminal
  screenshots, token-economy habits, CDP mode).
