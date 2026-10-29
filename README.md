# agent-dotfiles

`/yuu-mode <task>` sends any task to the skill or playbook in this repo that fits it, so you stop picking a skill by hand.
It runs in Claude Code and OpenCode, and in pi as `/skill:yuu-mode`.

```text
/yuu-mode the csv export drops its last row. repro first, then fix.
```

Each task's reply opens with the route it took (`route: playbooks/bug-fix.md`) and then works through that route's steps until the result is verified.
UI work goes to `ui-polish`, reviews to `interrogate`, diagrams to `show-me`; the full table is in [`skills/yuu-mode/SKILL.md`](skills/yuu-mode/SKILL.md).
Say "new task" to switch subjects mid-session.

## Install

The bootstrap needs `git` and `npm`. It clones the repo to `~/agent-dotfiles` and sets up each of Claude Code, pi and OpenCode found on PATH:

```powershell
# Windows
irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1 | iex
```

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash
```

With none on PATH yet, name a target (`claude`, `pi`, `opencode` or `all`):

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1))) -Target pi
```

```bash
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash -s -- pi
```

The install overwrites the global `CLAUDE.md`, mirrors `rules/` to `~/.claude/rules` (hand edits there are lost), writes `settings.json` only when it is absent, and in `opencode.json` removes only the retired `mcp.fff` key.
On Linux and macOS it also points `core.hooksPath` at `git-hooks/` for every repo.
Restart the agent after install.

## Already cloned

From the clone, run the setup script for your harness. It is idempotent, so rerun it to update:

| Harness | Windows | Linux / macOS |
|---------|---------|---------------|
| Claude Code | `pwsh -File scripts/setup-claude.ps1` | `bash scripts/setup-claude.sh` |
| pi | `pwsh -File scripts/setup-pi.ps1` | `bash scripts/setup-pi.sh` |
| OpenCode | `pwsh -File scripts/setup-opencode.ps1` | `bash scripts/setup-opencode.sh` |
| Cursor | | `bash scripts/setup-cursor.sh` |

Each setup script installs or updates what its harness needs, such as rtk and the axi CLIs, then syncs the config.
For config only, run `pwsh -File scripts/sync-config.ps1 all` (every harness on PATH) or `bash scripts/sync-config.sh <harness>` (one per run).
Skills land in `~/.claude/skills` for Claude Code and in `~/.agents/skills` for OpenCode, pi and Cursor.
OpenCode also gets `~/.config/opencode/AGENTS.md` and the interrogate reviewer agents generated from `skills/interrogate/reviewers.md`.
Its setup script also installs the [caveman-lean](https://github.com/YuukiFST/caveman-lean) and [ponytail-subagent](https://github.com/YuukiFST/ponytail-subagent) plugins, which Claude Code gets from `setup-claude`, plus the [goal-mode](https://github.com/prevalentWare/opencode-goal-plugin) plugin that adds `/goal`, persistent objectives and a goal sidebar to OpenCode.
Every skill is a `/name` command in OpenCode too, with no command file per skill.
Cursor keeps User Rules outside files, so paste `GLOBAL.md` into Customize > Rules > User Rules by hand after each edit.

## Layout

| Path | What |
|------|------|
| `skills/` | `yuu-mode` and the skills it loads, one folder each |
| `skills/UPSTREAMS.tsv` | Upstream source and reviewed commit of each vendored skill, checked weekly by `scripts/check-upstreams.sh` |
| `GLOBAL.md` | Global instructions, loaded every session |
| `CODING_STANDARDS.md` | Rules for editing a project, read when `GLOBAL.md` points to it |
| `PROMPT_ENGINEERING.md` | Prompt design, debugging, evals and maintenance, read when `rules/prompting.md` points to it |
| `rules/` | Git and prompting rules |
| `hooks/`, `git-hooks/` | Session hooks and the `commit-msg` and `pre-push` gates |
| `mods/` | Claude Code mods (function-hook plugins), copied to `~/.claude/mods`; `ponytail-notice` logs a line in the main thread when a subagent gets the Ponytail ruleset |
| `scripts/` | Install, sync and `git-safe-commit.sh` |
| `settings.json` | Claude Code seed, written only when absent |
| `pi/` | pi config |
| `AGENTS.md` | Instructions for an agent working on this repo, imported by the root `CLAUDE.md` |
