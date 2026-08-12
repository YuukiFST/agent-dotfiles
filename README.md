# my-harness-config

My global config for **Claude Code**, **Cursor** and **pi** — spend
fewer tokens, write better code, verify it works.

| Path | What |
|------|------|
| `CLAUDE.md` | Global instructions, loaded every session |
| `rules/` | Conditional rule files the instructions point at (frontend, git, code quality, memory, prompting) |
| `skills/` | 58 skills, flat — Claude Code only discovers `~/.claude/skills/<name>/SKILL.md`, so subfolders would hide them. List: `ls skills/` |
| `hooks/`, `git-hooks/` | Session hooks; `pre-push` attribution gate and `git-safe-commit` |
| `scripts/` | Install and sync, one script per harness |
| `pi/`, `agent-browser/`, `portless/` | Per-tool config |

## Install

Clone the repo, run your agent's script. Idempotent — re-run to update.
Or open the repo with any agent and ask it to sync — `AGENTS.md` tells it how.

| Machine | Agent | Script |
|---------|-------|--------|
| **Windows** | Claude Code | `pwsh -File scripts/setup-claude.ps1` · update: `scripts/update-claude.ps1` |
| **macOS / Linux** | Claude Code | `bash scripts/setup-claude.sh` · update: `scripts/update-claude.sh` |
| **NixOS** | Cursor | `bash scripts/setup-cursor.sh` |
| **NixOS** | pi | `bash scripts/setup-pi.sh` |

Claude Code gets the full stack; Cursor gets skills + rules;
pi gets skills + rules + agent config from `pi/`. Restart the agent afterwards.

Installed separately, not by these scripts:
[rtk](https://github.com/rtk-ai/rtk),
[caveman](https://github.com/JuliusBrussee/caveman),
[superpowers](https://github.com/obra/superpowers),
[agent-browser](https://agent-browser.dev) (configs in `agent-browser/`),
[portless](https://portless.sh) (Node 24+, `portless/setup.md`),
[pi-codex-goal](https://github.com/fitchmultz/pi-codex-goal) (pi only).

## Gotchas

- **rtk corrupts `prisma`/`tsc`/`vitest` output** — run those raw, never through rtk.
- **Cursor User Rules are not file-backed** — paste `CLAUDE.md` into Customize → Rules by hand, and re-paste after editing it.
- **`settings.json` is a seed, not a mirror** — written only when absent. Claude Code and other installers own that file; mirroring it would destroy state this repo doesn't track.
- **pi ships no MCP** (upstream design choice). Goal tracking comes from `npm:pi-codex-goal` in `pi/settings.json`.

Most skills are vendored from upstream repos — provenance, refresh procedure and the local
tweaks a refresh must re-apply live in [`docs/vendored-skills.md`](docs/vendored-skills.md).
