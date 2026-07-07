# CLAUDE.md — Global

Cross-project guidance. Lean by design: only what's non-obvious or machine-specific. Project `CLAUDE.md` overrides this; for generic best-practice, trust the model. For trivial tasks, judgment over ceremony.

## Output

- Concise output, thorough reasoning. No sycophantic openers/closers, no emojis, no em-dashes. Plain "Done", never "✅ Done".
- Never guess APIs, versions, flags, SHAs, or package names — verify in code/docs first.
- Don't print full files back; show diffs with `...` for omitted parts.
- Long Markdown files: each full sentence on its own line.
- Never manually modify CHANGELOG.md or files marked auto-generated.
- **Don't prune an agent's own comments on refactor** — they carry intent/provenance. Comment the *why* (bug, upstream constraint, issue#/SHA), never the obvious *what*. Docstrings on public functions: intent + one usage example.

## Working method

- State assumptions; if ambiguous, ask before coding. Surface tradeoffs, don't pick silently.
- Simplest code that solves it; surgical diffs; match existing style. Remove only orphans *your* change created; flag pre-existing dead code, don't delete it.
- Turn tasks into verifiable goals; refactors keep existing tests green before and after.
- **Debugging loop:** produce fix → run tests/lint → repair only failures → repeat. Run lint/typecheck on your own output before showing it.
- **No TDD / test-first.** Do NOT use the superpowers `test-driven-development` skill or any red-green-refactor flow. Implementation first; regression test after a bugfix. This overrides any skill that says "always TDD".
- Same error twice → stop, show error, ask one question. Never install packages to fix errors.
- **Bug fixes:** reproduce E2E first, as the end user experiences it — find the real problem, not a symptom.
- See a lint/test failure or flake → fix it, even if unrelated to your change. UI work: fix visible pixel issues along the way.
- Prefer quality, simplicity, robustness, and long-term maintainability over development cost.
- **Standardize for agent automation:** same command does the same thing across projects (`bin/deploy`, tag-release, layout) so an agent runs "deploy" without guessing.
- README leads with the problem it solves (one sentence, top); stack/architecture go in `docs/`.

## Code rules (override model defaults)

- **Before a helper:** grep for the canonical one. Duplicating an existing helper is a failure, not a nit.
- **File > 500 lines = decompose first**, don't append.
- **Grep-able names:** avoid `data`/`handler`/`Manager`/`Service` — a name returning 50 grep hits is wrong.
- **Types explicit:** no `any`, no `@ts-ignore`, no `as X` papering over an invariant, no `T | undefined` on always-set fields.
- **Tests:** regression test per bugfix. Mock external I/O with named fakes.

## Clean code for agents (the reader is an LLM)

Token cost, tool-call latency, output quality — technical constraints, not style opinions.

- SRP, small functions: three 250-line modules beat one 800-line file doing three things.
- Flatten control flow: early returns / guard clauses; cap ~2 indent levels.
- Inject dependencies (constructor/parameter) so a named fake swaps in without infra.
- Tests run headless, one command — no manual seed, missing config, or secret.
- Formatter decides style (`prettier`/`ruff`/`gofmt`/`cargo fmt`/`rubocop -A`); never spend a turn on formatting.
- Structured (JSON) logs for debug/observability; plain text only for user-facing CLI output.
- Defensive code is opt-in: no retry/backoff, timeout, circuit-breaker, rate-limit, or fallback unless the project names the categories it needs.

## Tools (machine-specific)

- **code-review-graph MCP before Grep/Glob/Read** when the project has it. Explore: `semantic_search_nodes` / `query_graph`. Impact: `get_impact_radius`. Review: `detect_changes` + `get_review_context`. Architecture: `get_architecture_overview`. Fall back when the graph doesn't cover the need.
- **gh-axi for GitHub ops** (subcommands `issue`/`pr`/`run`/`workflow`/`release`/`repo`/`label`/`search`/`api`) over plain `gh` — ~50% fewer tokens. Uses the existing `gh auth login` session; raw `gh` only for what gh-axi lacks.
- **RTK:** a PreToolUse hook auto-rewrites Bash commands to `rtk` form — don't manually prefix. Known break: `rtk` corrupts `prisma`/`tsc`/`vitest` output — run those directly.

## Conditional rules (read the file only when the task matches, otherwise skip)

- **Frontend/UI work** → `~/.claude/rules/frontend.md` (skill pipeline, phases, minimum bar). MANDATORY before UI code.
- **Improving the project** (audit, refactor, harden, optimize, review) → `~/.claude/rules/code-quality.md` (execution flow + skill inventory). MANDATORY — skills drive every change.
- **Cross-session memory, or 5+ sessions deep** → `~/.claude/rules/memory-system.md` (file taxonomy, write threshold, dreaming). Store: harness memory dir (`MEMORY.md` index) on Claude Code; `.opencode/memory/` on OpenCode. Never dream during active dev; >30 complex turns → suggest fresh session.
- **Writing prompts for sub-agents/tools/LLM calls** → `~/.claude/rules/prompt-engineering.md` + `~/.claude/rules/prompting-playbook.md`. Agent workflow strategies: `~/.claude/rules/agent-best-practices.md`.
- **Committing or pushing** → `~/.claude/rules/git.md` FIRST (commit identity confirmation, Conventional Commits, `no-mistakes` gate, no-AI-attribution). Not committing → skip.
