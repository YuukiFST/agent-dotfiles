# agent-dotfiles

Global agent config for **Claude Code**, **pi**, **OpenCode** and **Cursor** — one repo, one install command per machine.

## Install

Clones the repo to `~/agent-dotfiles` and sets up every harness found on PATH:

```powershell
# Windows
irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1 | iex
```

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash
```

Nothing on PATH yet? Name the target — `claude`, `pi`, `opencode` or `all`:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1))) -Target pi
```

```bash
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash -s -- pi
```

The clone uses a sparse checkout that excludes `stacks/` (archived config). Pass `-Full` / `--full` if you want it.

Restart the agent after install.

## Already cloned

Run the script for your harness directly. Idempotent — re-run to update.

| Harness | Windows | Linux / macOS |
|---------|---------|---------------|
| **Claude Code** | `pwsh -File scripts/setup-claude.ps1` | `bash scripts/setup-claude.sh` |
| **pi** | `pwsh -File scripts/setup-pi.ps1` | `bash scripts/setup-pi.sh` |
| **OpenCode** | `pwsh -File scripts/setup-opencode.ps1` | `bash scripts/setup-opencode.sh` |
| **Cursor** | — | `bash scripts/setup-cursor.sh` |

Config only, tools already installed: `scripts/sync-config.ps1 <harness>` / `scripts/sync-config.sh <harness>`; use `all` to cover every harness on PATH.

## What each harness gets

| Harness | Installed |
|---------|-----------|
| **Claude Code** | `CLAUDE.md`, `rules/`, `skills/`, `hooks/`, seed `settings.json` |
| **pi** | `skills/`, `rules/`, agent config from `pi/` |
| **OpenCode** | `skills/`, `rules/`, `~/.config/opencode/AGENTS.md` (its `opencode.json` is never touched) |
| **Cursor** | `skills/`, `rules/` — User Rules are not file-backed: paste `CLAUDE.md` into Customize → Rules by hand, re-paste after edits |

## Repo layout

| Path | What |
|------|------|
| `CLAUDE.md`, `AGENTS.md` | Global instructions, loaded every session |
| `rules/` | Rule files (git, prompting) — Claude Code loads every `.md` here at launch |
| `skills/` | Active skills, flat (`~/.claude/skills/<name>/SKILL.md`) |
| `stacks/` | Archived config, not loaded — enable with `bash scripts/stack.sh enable <name>` |
| `hooks/`, `git-hooks/` | Session hooks; `pre-push` gate and `git-safe-commit` |
| `scripts/` | Install and sync, one per harness |
| `pi/`, `agent-browser/`, `portless/` | Per-tool config |
| `docs/` | Reference notes, never loaded into a session |

## Not installed by these scripts

[rtk](https://github.com/rtk-ai/rtk) ·
[caveman](https://github.com/JuliusBrussee/caveman) ·
[agent-browser](https://agent-browser.dev) ·
[portless](https://portless.sh) (Node 24+) ·
[pi-codex-goal](https://github.com/fitchmultz/pi-codex-goal) (pi only)

`settings.json` here is a seed, not a mirror — written only when absent, so it never overwrites harness-owned state.
