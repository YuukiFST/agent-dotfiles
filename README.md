# my-harness-config

My global config for **Claude Code**, **Cursor** and **pi** — spend
fewer tokens, write better code, verify it works.

| Path | What |
|------|------|
| `CLAUDE.md` | Global instructions, loaded every session |
| `rules/` | Rule files (git, prompting). Claude Code loads every `.md` here at launch unless it carries `paths:` frontmatter — they are not lazy |
| `skills/` | Active skills, flat — Claude Code only discovers `~/.claude/skills/<name>/SKILL.md`, so subfolders would hide them. List: `ls skills/` |
| `stacks/` | Archived config, kept but not loaded: `frontend/` (31-skill UI pipeline), `memory/` (memory system + dreaming), `effect/` (Effect-TS skill). See [`stacks/README.md`](stacks/README.md) |
| `hooks/`, `git-hooks/` | Session hooks; `pre-push` attribution gate and `git-safe-commit` |
| `scripts/` | Install and sync, one script per harness |
| `docs/` | Reference notes, never loaded into a session: [vendored skills](docs/vendored-skills.md), [agent workflow notes](docs/agent-workflow-notes.md), [rules adherence baseline](docs/rules-audit-baseline.md) |
| `pi/`, `agent-browser/`, `portless/` | Per-tool config |

## Install

One command on a fresh machine — clones the repo and sets up every harness it finds on PATH:

```powershell
# Windows
irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1 | iex
```

```bash
# Linux / macOS
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash
```

Nothing on PATH yet? Name the harness — `claude`, `pi`, `opencode`, or `all`:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1))) -Target pi
```

```bash
curl -fsSL https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.sh | bash -s -- pi
```

The bootstrap clones into `~/agent-dotfiles` with a **non-cone sparse checkout that excludes
`stacks/`**, so the archived config never reaches the disk. Pass `-Full` / `--full` to get it
(only `scripts/stack.sh enable <name>` needs it).

Already cloned? Run your harness's script directly. Idempotent — re-run to update.
Or open the repo with any agent and ask it to sync — `AGENTS.md` tells it how.

| Harness | Windows | Linux / macOS |
|---------|---------|---------------|
| **Claude Code** | `pwsh -File scripts/setup-claude.ps1` · update: `scripts/update-claude.ps1` | `bash scripts/setup-claude.sh` · update: `scripts/update-claude.sh` |
| **pi** | `pwsh -File scripts/setup-pi.ps1` | `bash scripts/setup-pi.sh` |
| **OpenCode** | `pwsh -File scripts/setup-opencode.ps1` | `bash scripts/setup-opencode.sh` |
| **Cursor** | — | `bash scripts/setup-cursor.sh` (no machine uses Cursor today) |

Config only, tools already installed: `scripts/sync-config.ps1 <harness>` or
`scripts/sync-config.sh <harness>`; `sync-config.ps1 all` covers every harness on PATH.

Claude Code gets the full stack; pi gets skills + rules + agent config from `pi/`;
OpenCode gets skills + rules + `~/.config/opencode/AGENTS.md` (its `opencode.json` is never
touched — it holds per-machine MCP and provider state); Cursor would get skills + rules.
Restart the agent afterwards.

Installed separately, not by these scripts:
[rtk](https://github.com/rtk-ai/rtk),
[caveman](https://github.com/JuliusBrussee/caveman) (Claude plugin + pi extension — not vendored as a skill),
[agent-browser](https://agent-browser.dev) (configs in `agent-browser/`),
[portless](https://portless.sh) (Node 24+, `portless/setup.md`),
[pi-codex-goal](https://github.com/fitchmultz/pi-codex-goal) (pi only).

## Skills

Active skills live flat in `skills/`. The **frontend design pipeline** (31 skills + `rules/frontend.md`) is archived in `stacks/frontend/` to save harness tokens when not building premium UI; `agent-browser` and `webapp-testing` stay active. Re-enable any stack with `bash scripts/stack.sh enable <name>` + paste its `CLAUDE-snippet.md` into `CLAUDE.md`.

| Category | Highlights |
|----------|-----------|
| **Code quality & review** | `thermo-nuclear-code-quality-review`, `improve`, `improve-codebase-architecture`, `autoreview` |
| **Debugging & design** | `diagnosing-bugs`, `codebase-design`, `domain-modeling`, `prototype`, `webapp-testing` |
| **Security** | `security-review`, `security-bounty-hunter` |
| **Planning & workflow** | `brainstorming`, `writing-plans`, `executing-plans`, `systematic-debugging`, `verification-before-completion` (vendored from [obra/superpowers](https://github.com/obra/superpowers)) |
| **Planning & handoff** | `grilling`, `wayfinder`, `helmsman` (wayfinder's autonomous sibling — the agent makes the technical calls; `helmsman-explain` renders it as an HTML page) (+ `setup-matt-pocock-skills`, their per-repo bootstrap), `handoff` |
| **Git** | `git-workflow` — the issue → branch → PR → review → merge flow. The safety half (identity, push confirmation, no-AI-attribution) stays always-loaded in `rules/git.md` |
| **Frontend & design** | archived in `stacks/frontend/` — `impeccable`, the jakubkrehel set (`interface-review` + `better-ui`/`colors`/`typography`/`accessibility`/`interface`/`layout`/`writing`), `apple-design`, `animate`/`improve-animations`, `transitions-dev`, `tailwind-v4-shadcn`, image-gen skills (+13 more) |
| **Research & authoring** | `storm-research`, `research`, `teach`, `backpass`, `writing-for-agents`, [`no-ai-slop`](https://github.com/petergyang/no-ai-slop) |
| **Libraries & system** | archived in `stacks/effect/` — `effect` ([kitlangton/skills](https://github.com/kitlangton/skills/tree/main/skills/effect)) |

Most skills are vendored from upstream repos — provenance, refresh procedure and the local
tweaks a refresh must re-apply live in [`docs/vendored-skills.md`](docs/vendored-skills.md).
The frontend stack is opt-in via `stacks/frontend/`; `animation-vocabulary` and `transitions-polish` carry `disable-model-invocation: true`.

## Gotchas

- **rtk corrupts `prisma`/`tsc`/`vitest` output** — run those raw, never through rtk.
- **Cursor User Rules are not file-backed** — paste `CLAUDE.md` into Customize → Rules by hand, and re-paste after editing it.
- **`settings.json` is a seed, not a mirror** — written only when absent. Claude Code and other installers own that file; mirroring it would destroy state this repo doesn't track.
- **pi ships no MCP** (upstream design choice). Goal tracking comes from `npm:pi-codex-goal` in `pi/settings.json`; context compaction from [`npm:@monotykamary/pi-vcc`](https://pi.dev/packages/@monotykamary/pi-vcc) (algorithmic, no LLM call — tune it in `~/.pi/agent/pi-vcc-config.json`).
- **OpenCode reads `~/.agents/skills` natively**, the same dir pi uses — the sync writes it once and both harnesses see it. Only `AGENTS.md` is OpenCode-specific. A hand-written one is kept as `AGENTS.local.md.bak` on first sync.
