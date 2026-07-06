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

## Skills

Files stay **flat** in `skills/` — Claude Code discovers a personal skill only at
`~/.claude/skills/<name>/SKILL.md` (one level, single searchable namespace), so
category subfolders would hide them on install. The grouping below is by purpose,
not by directory.

| Category | Skills |
|----------|--------|
| **Code quality** | `thermo-nuclear-code-quality-review` (max-intensity audit), `improve` (advisor audit → read-only plans), `improve-codebase-architecture` (architecture deepening), `autoreview` (review closeout before commit/ship) |
| **Planning & handoff** | `grill-me` (interrogate a plan), `grill-with-docs` (grill against the domain model + ADRs), `to-prd` (conversation → PRD), `handoff` (compact context for the next agent) |
| **Context & skill authoring** | `claude-md-auditor` (audit CLAUDE/AGENTS/GEMINI files), `write-a-skill` (author new skills), `skill-cleaner` (audit installed skills + prompt budget), `setup-matt-pocock-skills` (wire an Agent-skills block into AGENTS.md) |
| **Research & learning** | `storm-research` (Stanford STORM multi-perspective research), `teach` (teach a concept in-workspace), `prototype` (throwaway prototype to flesh out a design) |
| **System config** | `omarchy` (Linux desktop / window-manager / dotfile customization) |

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
