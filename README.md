# my-harness-config

My global config for **Claude Code** and **OpenCode** — spend fewer tokens, write
better code, verify it works.

## Tools

### Token economy

| Tool | Why | How |
|------|-----|-----|
| [rtk](https://github.com/rtk-ai/rtk) | Compresses shell output 60–90% before the model sees it. | Hook auto-wraps every shell command. Corrupts `prisma`/`tsc`/`vitest` → run those raw. |
| [caveman](https://github.com/JuliusBrussee/caveman) | Compresses agent replies ~75%. | Plugin, always-on (both agents). |
| [code-review-graph](https://github.com/tirth8205/code-review-graph) | Feeds the agent only the blast-radius of a change — ~82× fewer tokens. | MCP server, agent prefers it over raw Grep/Glob. |

### Code quality

| Tool | Why | How |
|------|-----|-----|
| [ponytail](https://github.com/DietrichGebert/ponytail) | Stdlib/native first → 80–94% less code. | Plugin (both agents). |
| [no-mistakes](https://github.com/kunchenguid/no-mistakes) | Validation gate on push — review/test/lint on throwaway worktree, opens PR only when green. | `git push no-mistakes` instead of `git push origin`. |
| [superpowers](https://github.com/obra/superpowers) | Discipline skills (brainstorming, debugging, planning, verification) that gate *how* the agent works. | Plugin (both agents). |
| code-quality skills | Max-intensity audit, advisor audit, architecture planning. | `thermo-nuclear..`, `improve`, `improve-codebase-architecture` in `skills/`. |

### Verification / E2E

| Tool | Why | How |
|------|-----|-----|
| [agent-browser](https://agent-browser.dev) | Drives a real browser E2E — navigate, click, fill, assert via ref-based snapshots (`snapshot` ≈ 200–400 tokens vs 3000–5000 for raw DOM). React DevTools + Web Vitals built in. ~10x fewer tokens than Playwright MCP. | Shell **CLI**, called directly (`npm i -g agent-browser`). Not an MCP server. Discovery via the `agent-browser` skill. Playwright kept only for durable multi-browser suites via the `webapp-testing` skill. |

### Development workflow

| Tool | Why | How |
|------|-----|-----|
| [portless](https://portless.sh) | Named `.localhost` URLs — agents reference stable hostnames instead of guessing ports. Auto-HTTPS, git worktree subdomains. | `npm install -g portless`. Prefix any dev command. |
| `git-hooks/` | Blocks `Co-authored-by` and forbidden subject terms before commits land. | `./scripts/install-git-hooks.sh` inside any git repo. |

## Skills

Files stay **flat** in `skills/` — Claude Code discovers a personal skill only at
`~/.claude/skills/<name>/SKILL.md` (one level, single searchable namespace), so
category subfolders would hide them on install. The grouping below is by purpose,
not by directory.

57 skills — highlights per category (full list: `ls skills/`):

| Category | Highlights |
|----------|-----------|
| **Code quality & review** | `thermo-nuclear-code-quality-review`, `improve`, `improve-codebase-architecture`, `autoreview`, `code-review`, `react-doctor` |
| **Debugging & design** | `diagnosing-bugs`, `codebase-design`, `domain-modeling`, `prototype`, `webapp-testing` |
| **Security** | `security-review`, `security-bounty-hunter` |
| **Planning & handoff** | `grilling`, `grill-for-unknowns`, `to-prd`, `to-spec`, `to-issues`, `handoff`, `triage` |
| **Frontend & design** | `impeccable`, `better-ui`/`better-colors`/`better-typography`, `apple-design`, `improve-animations`, `transitions-dev`, `tailwind-v4-shadcn`, image-gen skills (+15 more) |
| **Research & authoring** | `storm-research`, `research`, `teach`, `claude-md-auditor`, `writing-great-skills` |
| **Libraries & system** | `effect` ([kitlangton/skills](https://github.com/kitlangton/skills/tree/main/skills/effect)), `omarchy` |

## Setup

Both agents get the **same** toolset (rtk, caveman, superpowers, ponytail,
code-review-graph, agent-browser, portless, no-mistakes, goal mode); only the
install mechanism differs per platform. Run the script for your agent from a
clone of this repo — it installs binaries, registers MCP servers, wires
plugins, and copies config. Idempotent: safe to re-run.

### Claude Code

```bash
git clone https://github.com/YuukiFST/my-harness-config && cd my-harness-config
pwsh -File scripts/setup-claude.ps1     # Windows
bash scripts/setup-claude.sh            # macOS / Linux
```

Installs to `~/.claude`: copies `CLAUDE.md` + `dreaming.md` + `skills/` + `rules/`;
installs rtk (+`rtk init -g` hook), no-mistakes, code-review-graph, the agent-browser
CLI, gh-axi; registers the code-review-graph MCP server (agent-browser is a CLI, not
an MCP); installs portless; installs the caveman, ponytail, superpowers and
goal-ledger plugins. Auto-memory is left **on** (the curated per-project memory dir
is used alongside durable `CLAUDE.md`/`AGENTS.md` context).

**Keeping tools current:** run the update script for your agent/platform — it
refreshes every external tool to its latest release (rtk, no-mistakes,
agent-browser/gh-axi/portless, the pi agent when present, code-review-graph +
MCP re-registration, plugins). Restart the agent afterwards.

```bash
pwsh -File scripts/update-claude.ps1    # Claude Code, Windows
bash scripts/update-claude.sh           # Claude Code, macOS / Linux
bash scripts/update-opencode.sh         # OpenCode, macOS / Linux
```

### OpenCode (Linux / macOS)

```bash
git clone https://github.com/YuukiFST/my-harness-config && cd my-harness-config
bash scripts/setup-opencode.sh
```

Installs to `~/.config/opencode`: copies `opencode.jsonc` + `skills/` (auto-
discovered, no `skills.paths` needed); installs rtk (+`rtk init -g --opencode`),
no-mistakes, code-review-graph (symlinked onto PATH so the bare MCP command
resolves), agent-browser, portless; installs the caveman plugin. ponytail
(`@dietrichgebert/ponytail`) and superpowers are referenced in `opencode.jsonc`
and resolve on launch.

After the script finishes, **restart the agent**. Then, in each repo you push
from, run `no-mistakes init` once to create the `no-mistakes` push remote.


## Install reference

| Tool | Install |
|------|---------|
| rtk | `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh \| sh` then `rtk init -g` |
| no-mistakes | `curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh \| sh` — then run `no-mistakes init` **inside each repo** to create the `no-mistakes` push remote (without it `git push no-mistakes` has no remote to hit) |
| code-review-graph | `python3 -m venv ~/.local/crg-venv && ~/.local/crg-venv/bin/pip install code-review-graph` (expose `code-review-graph` on PATH) |
| agent-browser | `npm install -g agent-browser && agent-browser install` |
| portless | `npm install -g portless` |

> rtk corrupts `prisma`/`tsc`/`vitest` output — run those raw, never through rtk.
