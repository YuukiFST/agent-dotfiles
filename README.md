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

Clone the repo, run your agent's script. Idempotent — re-run to update.
Or open the repo with any agent and ask it to sync — `AGENTS.md` tells it how.

| Machine | Agent | Script |
|---------|-------|--------|
| **Windows** (work PC) | Claude Code | `pwsh -File scripts/setup-claude.ps1` · update: `scripts/update-claude.ps1` |
| **Windows / NixOS** (home) | pi | `bash scripts/setup-pi.sh` |
| **macOS / Linux** | Claude Code | `bash scripts/setup-claude.sh` · update: `scripts/update-claude.sh` |
| — | Cursor | `bash scripts/setup-cursor.sh` (no machine uses Cursor today) |

Claude Code gets the full stack; pi gets skills + rules + agent config from `pi/`;
Cursor would get skills + rules. Restart the agent afterwards.
OpenCode also runs on the home machines and is **not** covered by these scripts —
its config is maintained by hand. `AGENTS.md` holds the machine-by-machine table.

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
| **Planning & handoff** | `grilling`, `wayfinder` (+ `setup-matt-pocock-skills`, its per-repo bootstrap), `handoff` |
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
- **pi ships no MCP** (upstream design choice). Goal tracking comes from `npm:pi-codex-goal` in `pi/settings.json`.
