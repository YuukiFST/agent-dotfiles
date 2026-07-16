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
| **Planning & handoff** | `grilling`, `batch-grill-me`, `grill-for-unknowns`, `to-prd`, `to-spec`, `to-issues`, `handoff`, `triage` |
| **Frontend & design** | `impeccable`, `better-ui`/`better-colors`/`better-typography`, `apple-design`, `improve-animations`, `transitions-dev`, `tailwind-v4-shadcn`, image-gen skills (+15 more) |
| **Research & authoring** | `storm-research`, `research`, `teach`, `claude-md-auditor`, `writing-great-skills` |
| **Libraries & system** | `effect` ([kitlangton/skills](https://github.com/kitlangton/skills/tree/main/skills/effect)), `omarchy` |

## Setup

Two machines, four harnesses:

| Machine | Harnesses | Scripts |
|---------|-----------|---------|
| **Windows** | Claude Code, alone | `setup-claude.ps1` / `update-claude.ps1` |
| **NixOS** | Cursor, pi, OpenCode | `setup-cursor.sh`, `setup-pi.sh`, `setup-opencode.sh` / `update-opencode.sh` |

Claude Code and OpenCode get the **same** toolset (rtk, caveman, superpowers,
ponytail, code-review-graph, agent-browser, portless, no-mistakes, goal mode);
only the install mechanism differs per platform. Cursor and pi get the skills and
rules, not the plugin/hook stack — see their sections. Run the script for your
agent from a clone of this repo — it installs binaries, registers MCP servers,
wires plugins, and copies config. Idempotent: safe to re-run.

Every setup/update script also runs a **shared** sync, so the NixOS box converges
no matter which of its three scripts ran:

| Destination | Read by | Contents |
|-------------|---------|----------|
| `~/.claude/rules/` | all — CLAUDE.md's conditional pointers hardcode this path, so it is created even where Claude Code is absent | `rules/` |
| `~/.agents/skills/` | Cursor and pi, both natively | `skills/` |
| `~/.pi/agent/AGENTS.md` | pi — written only when the binary is on PATH | `CLAUDE.md` |

### Claude Code

```bash
git clone https://github.com/YuukiFST/my-harness-config && cd my-harness-config
pwsh -File scripts/setup-claude.ps1     # Windows
bash scripts/setup-claude.sh            # macOS / Linux
```

Installs to `~/.claude`: copies `CLAUDE.md` + `dreaming.md` + `skills/` + `rules/` +
`hooks/`; installs rtk (+`rtk init -g` hook), no-mistakes, code-review-graph, the
agent-browser CLI, gh-axi; registers the code-review-graph MCP server (agent-browser
is a CLI, not an MCP); installs portless; installs the caveman, ponytail, superpowers
and goal-ledger plugins. Auto-memory is left **on** (the curated per-project memory
dir is used alongside durable `CLAUDE.md`/`AGENTS.md` context).

> **`settings.json` is a seed, not a mirror.** It is written only when `~/.claude/settings.json`
> is absent, and the author's profile path in it is rewritten for the installing user.
> An existing one is never touched: Claude Code rewrites that file itself (`model`,
> `effortLevel`, `theme` via `/config`) and other installers merge into it — herdr adds a
> `SessionStart` hook — so mirroring it would silently destroy state this repo does not
> track. `hooks/` copies per-file for the same reason (herdr's `herdr-agent-state.ps1`
> lives there and is owned by herdr, not by this repo).

**Keeping tools current:** run the update script for your agent/platform — it
refreshes every external tool to its latest release (rtk, no-mistakes,
agent-browser/gh-axi/portless, code-review-graph + MCP re-registration, plugins).
Restart the agent afterwards. Tools invoked via `npx …@latest` (`react-doctor`,
`lighthouse`) need no install or update step at all — each run fetches the current
release.

```bash
pwsh -File scripts/update-claude.ps1    # Claude Code, Windows
bash scripts/update-claude.sh           # Claude Code, macOS / Linux
bash scripts/update-opencode.sh         # OpenCode, NixOS
bash scripts/setup-pi.sh                # pi — re-run to update
bash scripts/setup-cursor.sh            # Cursor — re-run to re-sync
```

### OpenCode (Linux / macOS)

```bash
git clone https://github.com/YuukiFST/my-harness-config && cd my-harness-config
bash scripts/setup-opencode.sh
```

Installs to `~/.config/opencode`: copies `opencode.jsonc` + `skills/` (auto-
discovered, no `skills.paths` needed) + `CLAUDE.md` as **`AGENTS.md`** (OpenCode
reads `~/.config/opencode/AGENTS.md`; a `CLAUDE.md` at that path is never read —
its only CLAUDE.md fallback is `~/.claude/CLAUDE.md`); installs rtk (+`rtk init
-g --opencode`), no-mistakes, code-review-graph (symlinked onto PATH so the bare
MCP command resolves), agent-browser, portless; installs the caveman plugin.
ponytail (`@dietrichgebert/ponytail`) and superpowers are referenced in
`opencode.jsonc` and resolve on launch.

After the script finishes, **restart the agent**. Then, in each repo you push
from, run `no-mistakes init` once to create the `no-mistakes` push remote.

### Cursor (Linux / macOS)

```bash
bash scripts/setup-cursor.sh
```

Syncs skills + rules and registers the code-review-graph MCP server in
`~/.cursor/mcp.json` (never clobbers an existing file — it prints the snippet to
merge by hand instead). Cursor reads `~/.agents/skills` natively, so no
Cursor-specific skill copy exists.

**Manual step, unavoidable:** Cursor has no file-backed global rules — User Rules
live in **Customize → Rules** in the app, not on disk, so `CLAUDE.md` cannot be
synced. Paste it there once, and re-paste after editing it. Everything else
(skills, MCP, hooks) is file-based and scripted.

On **NixOS**, Cursor comes from the community `code-cursor` package (nixpkgs
repackages the official AppImage); its built-in auto-update does not work, so the
editor itself updates on nixpkgs bumps. This script only handles config.

### pi (NixOS)

```bash
bash scripts/setup-pi.sh    # installs or updates — re-runnable
```

[earendil-works/pi](https://github.com/earendil-works/pi). Installs the agent from npm
(`--ignore-scripts`, per its own docs), then syncs: skills to `~/.agents/skills` (pi
reads it natively and recursively) and `CLAUDE.md` to `~/.pi/agent/AGENTS.md` as global
instructions.

> pi ships **no MCP, no sub-agents and no hooks** — a deliberate upstream design choice
> ("It intentionally does not include built-in MCP…"). code-review-graph and the rtk hook
> are therefore unavailable there; skills + AGENTS.md are the entire surface. Don't confuse
> it with `omp` ([can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)), a separate fork
> with its own binary and version line — not used here.

On NixOS, `npm install -g` needs a writable prefix (`npm config set prefix ~/.npm-global`,
with `~/.npm-global/bin` on PATH). Installing pi from nixpkgs instead is fine — then run
`bash scripts/sync-config.sh pi` alone.


## Install reference

| Tool | Install |
|------|---------|
| rtk | `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh \| sh` then `rtk init -g` |
| no-mistakes | `curl -fsSL https://raw.githubusercontent.com/kunchenguid/no-mistakes/main/docs/install.sh \| sh` — then run `no-mistakes init` **inside each repo** to create the `no-mistakes` push remote (without it `git push no-mistakes` has no remote to hit) |
| code-review-graph | Linux/macOS: `python3 -m venv ~/.local/crg-venv && ~/.local/crg-venv/bin/pip install code-review-graph` (expose `code-review-graph` on PATH). Windows: `uv tool install --force code-review-graph` |
| agent-browser | `npm install -g agent-browser && agent-browser install` — the second command fetches the browser driver; without it every call fails |
| portless | `npm install -g portless` |
| pi | `npm install -g --ignore-scripts @earendil-works/pi-coding-agent` |
| react-doctor, lighthouse | nothing to install — invoked as `npx react-doctor@latest` / `npx lighthouse@latest`. Lighthouse needs a Chrome/Chromium binary on PATH |

> rtk corrupts `prisma`/`tsc`/`vitest` output — run those raw, never through rtk.
