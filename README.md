# agent-dotfiles

`/yuu-mode <task>` sends any task to the skill or playbook in this repo that fits it, so you stop picking a skill by hand.
It runs in Claude Code and OpenCode, and in pi as `/skill:yuu-mode`.

```text
/yuu-mode the csv export drops its last row. repro first, then fix.
```

The reply opens with the route it took (`route: playbooks/bug-fix.md`) and then works through that route's steps until the result is verified.
UI work goes to `ui-polish`, reviews to `interrogate`, visual explanations to `anatomy`; the full table is in [`skills/yuu-mode/SKILL.md`](skills/yuu-mode/SKILL.md).
Say "new task" to switch subjects mid-session.

## Install

The bootstrap clones the repo to `~/agent-dotfiles` and sets up every harness on PATH:

```powershell
# Windows
irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1 | iex
```

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash
```

With no harness on PATH yet, name one (`claude`, `pi`, `opencode` or `all`):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1))) -Target pi
```

```bash
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash -s -- pi
```

Restart the agent after install.

## Already cloned

From the clone, rerun the sync; it is idempotent:

| Harness | Windows | Linux / macOS |
|---------|---------|---------------|
| Claude Code | `pwsh -File scripts/setup-claude.ps1` | `bash scripts/setup-claude.sh` |
| pi | `pwsh -File scripts/setup-pi.ps1` | `bash scripts/setup-pi.sh` |
| OpenCode | `pwsh -File scripts/setup-opencode.ps1` | `bash scripts/setup-opencode.sh` |
| Cursor | | `bash scripts/setup-cursor.sh` |

The setup scripts also install missing tools.
For config only, run `scripts/sync-config.ps1 all` or `scripts/sync-config.sh <harness>`.
Skills land in `~/.claude/skills` for Claude Code and in `~/.agents/skills` for OpenCode, pi and Cursor.
Cursor keeps User Rules outside files, so paste `CLAUDE.md` into Customize, Rules by hand after each edit.

## Layout

| Path | What |
|------|------|
| `skills/` | `yuu-mode` and every skill it routes to, one folder each |
| `CLAUDE.md` | Global instructions, loaded every session |
| `CODING_STANDARDS.md` | Rules for editing a project, read when `CLAUDE.md` points to it |
| `rules/` | Git and prompting rules |
| `hooks/`, `git-hooks/` | Session hooks, the `pre-push` gate and `git-safe-commit` |
| `scripts/` | Install and sync |
| `pi/`, `portless/` | Per-tool config |
| `AGENTS.md` | Instructions for an agent working on this repo |

Installed separately: [rtk](https://github.com/rtk-ai/rtk), [caveman](https://github.com/JuliusBrussee/caveman), [portless](https://portless.sh) (Node 24+), [pi-codex-goal](https://github.com/fitchmultz/pi-codex-goal) (pi only).
