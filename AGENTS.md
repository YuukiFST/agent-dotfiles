# Agent bootstrap — reaching config parity

You are an agent (Cursor, pi, Claude Code, or other) that was pointed at this
repo. This repo is the **canonical source** of the user's harness configuration.
Your job when asked to "sync", "set up", or "reach parity": make the machine you are
running on match this repo, for the harness you are running in.

Note: `CLAUDE.md` at the repo root is a **payload** (the user's global instructions,
copied into harness config dirs by the scripts) — it is not instructions for working on
this repo. This file is.

## Machines

| Machine | Harnesses |
|---------|-----------|
| Windows (work PC) | Claude Code only |
| NixOS (home PC) | pi, Cursor |

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
- `skills/` → `~/.claude/skills`, `~/.agents/skills` (Cursor + pi)
- `rules/` → `~/.claude/rules` on EVERY harness (CLAUDE.md's conditional pointers hardcode that path)
- `agent-browser/` → seeds `~/.agent-browser/config.json` (NixOS preset when `/etc/NIXOS`
  exists, base preset otherwise; Windows preset on Windows) and installs
  `~/.local/bin/show-shot` (inline terminal screenshots)
- `pi/` → `~/.pi/agent` agent config (settings packages, extensions, cloak, cursor-sdk)
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
- Commits: English, Conventional Commits, no AI attribution of any kind
  (no `Co-authored-by`, no "Generated with"). In Cursor use `git-safe-commit`, not `git commit`.
  See `rules/git.md` and `git-hooks/`.
- Cursor global rules cannot be file-synced — tell the user to paste `CLAUDE.md` into
  Customize → Rules manually after edits.
- agent-browser deep dive: `agent-browser/setup-nixos-pi.md` (NixOS install, terminal
  screenshots, token-economy habits, CDP mode).
