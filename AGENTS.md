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
| Windows, work PC | Claude Code, pi, OpenCode | `pwsh -File scripts/sync-config.ps1 all` |
| Windows, home PC | pi, OpenCode | `pwsh -File scripts/sync-config.ps1 all` |
| NixOS, home PC | pi, OpenCode | `bash scripts/sync-config.sh pi` **and** `bash scripts/sync-config.sh opencode` |

Use the PowerShell script on Windows and the bash one on Unix; both take a harness
(`claude` / `pi` / `opencode`, plus `cursor` on bash), and `sync-config.ps1 all` covers every
harness found on PATH. Whichever you run, the shared payload (`~/.claude/rules`,
`~/.agents/skills`, `~/.agent-browser`) is written first, then the harness-specific dir.

Do not sync a harness the machine does not run: it grows a config dir nobody keeps current —
that is how the work PC ended up carrying a pi install for a harness it never ran
(removed 2026-08-26, issue #29; pi and OpenCode are genuinely in use there since 2026-09).

**Cursor** is no longer used on any machine. `scripts/setup-cursor.sh` and the Cursor notes
stay because the config is still correct, not because a machine consumes them.

## How to reach parity

Run the setup script for your harness (idempotent — also the updater):

| Harness | Windows | Unix |
|---------|---------|------|
| Claude Code | `pwsh -File scripts/setup-claude.ps1` | `bash scripts/setup-claude.sh` |
| pi | `pwsh -File scripts/setup-pi.ps1` | `bash scripts/setup-pi.sh` |
| OpenCode | `pwsh -File scripts/setup-opencode.ps1` | `bash scripts/setup-opencode.sh` |
| Cursor | — | `bash scripts/setup-cursor.sh` |

On a machine with no clone yet, `scripts/bootstrap.ps1` / `bootstrap.sh` does the whole thing
from a URL (see README) — it clones with a sparse checkout that **excludes `stacks/`**, then
runs the setup script for every harness on PATH.

If tools are already installed and only config drifted, `scripts/sync-config.sh <harness>`
(or `sync-config.ps1 <harness>` on Windows) is enough.

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
  `settings.json` there is a MERGE, not a mirror: pi owns keys like `lastChangelogVersion`
- `CLAUDE.md` → `~/.config/opencode/AGENTS.md` (OpenCode global instructions). Its skills come
  from `~/.agents/skills`, which OpenCode loads natively; `opencode.json` is never written
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
  See `rules/git.md` and `git-hooks/`. The issue → branch → PR → review → merge flow
  lives in the `git-workflow` skill, not in the rule file.
- Cursor global rules cannot be file-synced — tell the user to paste `CLAUDE.md` into
  Customize → Rules manually after edits.
- agent-browser deep dive: `agent-browser/setup-nixos-pi.md` (NixOS install, terminal
  screenshots, token-economy habits, CDP mode).
