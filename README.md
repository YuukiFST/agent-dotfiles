# my-harness-config

My global config for **Claude Code**, **OpenCode**, **Cursor** and **pi** — spend
fewer tokens, write better code, verify it works.

## Tools

| Tool | Why |
|------|-----|
| [rtk](https://github.com/rtk-ai/rtk) | Compresses shell output 60–90% before the model sees it. |
| [caveman](https://github.com/JuliusBrussee/caveman) | Compresses agent replies ~75%. |
| [code-review-graph](https://github.com/tirth8205/code-review-graph) | Feeds the agent only the blast-radius of a change — ~82× fewer tokens. |
| [ponytail](https://github.com/DietrichGebert/ponytail) | Stdlib/native first → 80–94% less code. |
| [superpowers](https://github.com/obra/superpowers) | Discipline skills (brainstorming, debugging, planning, verification) that gate *how* the agent works. |
| [no-mistakes](https://github.com/kunchenguid/no-mistakes) | Validation gate on push — review/test/lint on a throwaway worktree, opens a PR only when green. |
| [agent-browser](https://agent-browser.dev) | Real-browser E2E via ref-based snapshots — ~10× fewer tokens than Playwright MCP. Configs + NixOS/pi setup guide in `agent-browser/`. |
| [portless](https://portless.sh) | Named `.localhost` URLs — stable hostnames instead of guessed ports. |
| `git-hooks/` | Blocks `Co-authored-by` and forbidden subject terms before commits land. |

## Skills

55 skills, flat in `skills/` (Claude Code only discovers `~/.claude/skills/<name>/SKILL.md`
— one level, so subfolders would hide them). Full list: `ls skills/`.

| Category | Highlights |
|----------|-----------|
| **Code quality & review** | `thermo-nuclear-code-quality-review`, `improve`, `improve-codebase-architecture`, `autoreview`, `code-review`, `react-doctor` |
| **Debugging & design** | `diagnosing-bugs`, `codebase-design`, `domain-modeling`, `prototype`, `webapp-testing` |
| **Security** | `security-review`, `security-bounty-hunter` |
| **Planning & handoff** | `grilling`, `batch-grill-me`, `grill-for-unknowns`, `to-prd`, `to-spec`, `to-issues`, `handoff`, `triage` |
| **Frontend & design** | `impeccable`, `better-ui`/`better-colors`/`better-typography`, `apple-design`, `improve-animations`, `transitions-dev`, `tailwind-v4-shadcn`, image-gen skills (+13 more) |
| **Research & authoring** | `storm-research`, `research`, `teach`, `claude-md-auditor`, `writing-great-skills` |
| **Libraries & system** | `effect` ([kitlangton/skills](https://github.com/kitlangton/skills/tree/main/skills/effect)), `omarchy` |

## Setup

Clone the repo, run your agent's script. Idempotent — re-run to update.
Or just open the repo with any agent and ask it to sync — `AGENTS.md` tells it how.

| Machine | Agent | Script |
|---------|-------|--------|
| **Windows** | Claude Code | `pwsh -File scripts/setup-claude.ps1` · update: `scripts/update-claude.ps1` |
| **macOS / Linux** | Claude Code | `bash scripts/setup-claude.sh` · update: `scripts/update-claude.sh` |
| **NixOS** | OpenCode | `bash scripts/setup-opencode.sh` · update: `scripts/update-opencode.sh` |
| **NixOS** | Cursor | `bash scripts/setup-cursor.sh` |
| **NixOS** | pi | `bash scripts/setup-pi.sh` |

Claude Code and OpenCode get the full stack; Cursor and pi get skills + rules only.
Restart the agent afterwards.

## Gotchas

- **rtk corrupts `prisma`/`tsc`/`vitest` output** — run those raw, never through rtk.
- **`no-mistakes init` once per repo**, or `git push no-mistakes` has no remote to hit.
- **Cursor User Rules are not file-backed** — paste `CLAUDE.md` into Customize → Rules by hand, and re-paste after editing it.
- **`settings.json` is a seed, not a mirror** — written only when absent. Claude Code and other installers own that file; mirroring it would destroy state this repo doesn't track.
- **pi ships no MCP, hooks or sub-agents** (upstream design choice) — skills + AGENTS.md are its entire surface.
