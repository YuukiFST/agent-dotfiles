# CLAUDE.md — Global

Cross-project guidance. Lean by design: only what's non-obvious or machine-specific. Project `CLAUDE.md` overrides this; for generic best-practice the model already knows, trust the model. For trivial tasks, use judgment over ceremony.

## Output

- Read files before editing; don't re-read unchanged files.
- Concise output, thorough reasoning. No sycophantic openers/closers, no emojis, no em-dashes. Plain "Done", never "✅ Done".
- Never guess APIs, versions, flags, SHAs, or package names — verify in code/docs first.
- Don't print full files back; show diffs with `...` for omitted parts.
- When writing or substantially editing long Markdown files, put each full sentence on its own line.
- Never manually modify CHANGELOG.md files or any files marked as auto-generated.
- **Don't prune an agent's own comments on refactor** — they carry intent/provenance the next edit needs. Comment the *why* (bug, upstream constraint, issue#/SHA), never the obvious *what*. Docstrings on public functions: intent + one usage example.

## Working method

- State assumptions; if uncertain or ambiguous, ask before coding. Surface tradeoffs, don't pick silently.
- Simplest code that solves it. No speculative features, abstractions, or config not asked for.
- Surgical: touch only what the request needs. Match existing style. Remove only orphans *your* change created; flag pre-existing dead code, don't delete it.
- Turn tasks into verifiable goals with a clear success check; for refactors, keep existing tests green before and after.
- **Generate-evaluate-repair loop for debugging:** produce a fix → run tests/lint → repair only failures → repeat until clean. Don't critique and generate simultaneously.
- **Check your work before outputting.** After generating code or edits, run lint/typecheck on your own output before showing it. Verify files are valid, diffs apply correctly.
- **No TDD / test-first.** Do NOT use the superpowers `test-driven-development` skill or any red-green-refactor flow. Write the implementation first; add a regression test after a bugfix. This overrides any skill that says "always TDD".
- Same error twice → stop, show error, ask one question. Never install packages to fix errors.
- When making technical decisions, prefer quality, simplicity, robustness, scalability, and long-term maintainability over development cost.
- **Bug fixes:** reproduce the bug in an E2E setting first, as close to how an end user experiences it. This ensures you find the real problem, not a symptom.
- **Lint/test hygiene:** if you see a lint failure, test failure, or test flakiness, fix it — even if it wasn't caused by your change. Leave the codebase cleaner than you found it.
- **UI work:** be obsessive about pixel perfection. If something looks off, even if unrelated to your task, try to fix it along the way.
- **Standardize for agent automation.** Same command does the same thing across projects (`bin/deploy`, tag-release, layout) so an agent can run "deploy"/"cut a release" without guessing. Predictable structure is the precondition for trusting agent-run commands.
- **README leads with the problem, not the stack.** Top = what problem it solves and for whom, in one sentence. Stack/architecture/deps go in `docs/` for contributors. It's a "solution looking for a problem" if you can't state the use-case in one line.

## Code rules (override model defaults)

- **Before a helper:** grep for the canonical one. Duplicating an existing helper is a failure, not a nit.
- **File > 500 lines = decompose first**, don't append. The agent reads in bounded chunks — a unit that fits one read is reasoned about with full attention; a paginated one fragments it.
- **Grep-able names:** unique, distinctive names are the agent's nav API. Avoid `data`/`handler`/`Manager`/`Service` — a name that returns 50 grep hits is wrong; one that returns a handful is right.
- **Types explicit:** no `any`, no `@ts-ignore`, no `as X` papering over an invariant. No `T | undefined` on always-set fields.
- **Tests:** cover bugfixes with a regression test. Mock external I/O with named fakes.

## Clean code for agents (the reader is an LLM)

The primary reader of code is now the agent, not a human. These are technical constraints, not style opinions — they map to token cost, tool-call latency, and output quality.

- **SRP, small functions.** One responsibility per module, one thing per function. Three 250-line modules beat one 800-line file doing three things — the agent isolates and edits one without loading the rest.
- **Flatten control flow.** Early returns / guard clauses over nested `if`/`for`/`try`. Each indent level is more state the model tracks; deep nesting measurably degrades its answers. Cap ~2 levels.
- **Inject dependencies, don't hardcode them.** Constructor/parameter injection so the agent swaps a real I/O dep for a named fake without monkey-patching or spinning up infra.
- **Tests run headless, one command.** No manual DB seed, no missing config, no secret. Predictable output the agent parses. If the test can't run unattended, the agent's generate→run→repair loop breaks.
- **Formatter decides style.** Run the language default (`prettier`/`ruff`/`gofmt`/`cargo fmt`/`rubocop -A`). Never spend a turn on tabs/columns/brace style.
- **Structured (JSON) logs for debug/observability** — named fields the agent filters and correlates. Plain text only for user-facing CLI output.
- **Defensive code is opt-in — ship the happy path unless the project asks for more.** The agent won't propose retry/backoff, timeout, circuit-breaker, rate-limit, or fallback on its own (it doesn't know your failure points). If a project needs them, its rule file must name the categories or they won't appear.

## Tools (machine-specific)

- **code-review-graph MCP before Grep/Glob/Read** when the project has it — faster, gives callers/dependents/coverage. Fall back only when the graph doesn't cover the need.
  - Explore: `semantic_search_nodes` / `query_graph`. Impact: `get_impact_radius`. Review: `detect_changes` + `get_review_context`. Architecture: `get_architecture_overview`.
- **gh-axi for GitHub ops** — prefer `gh-axi` (subcommands `issue`/`pr`/`run`/`workflow`/`release`/`repo`/`label`/`search`/`api`) over plain `gh`: AXI-format output, ~50% fewer tokens and fewer turns at same task success. Uses the existing `gh auth login` session. Fall back to raw `gh` only for what gh-axi doesn't cover.
- **RTK:** a PreToolUse hook (`rtk hook claude`, installed by `rtk init -g`) auto-rewrites Bash commands to their `rtk` form — don't manually prefix. `rtk gain` views savings.
  - Known break: `rtk` corrupts `prisma`/`tsc`/`vitest` output — run those directly, never through rtk.

## Frontend design — multi-skill pipeline (MANDATORY)

Working on frontend/UI? Read `~/.claude/rules/frontend.md` first — it defines the skill pipeline, phases, and minimum bar. Otherwise skip it.

## Code quality & project improvement (MANDATORY — skills drive every change)

Improving the project (audit, refactor, harden, optimize, review)? Read `~/.claude/rules/code-quality.md` first — it defines the execution flow and skill inventory. Otherwise skip it.

## Agent Memory (self-learning)

Reading/writing cross-session memory, or 5+ sessions deep on a project (consider dreaming/consolidation)? Read `~/.claude/rules/memory-system.md` first — file taxonomy (`INDEX/codebase/patterns/errors`), the ≥5-min write threshold, when-not-to-write, dreaming. Otherwise skip.

- Store path is harness-dependent: `.opencode/memory/` on OpenCode; the harness memory dir (`MEMORY.md` index) on Claude Code.
- Never run dreaming during active development — separate out-of-band session.
- Very long session (>30 complex turns) → suggest a fresh session; the memory store preserves learnings.

## Prompting — writing effective instructions

Writing a prompt for a sub-agent, tool, or LLM call? Read `~/.claude/rules/prompt-engineering.md` first (task-first, delimiters, output contract upfront, balanced tradeoffs, tool-over-verbal, anti-hallucination, stable-context-before-dynamic-data) + `~/.claude/rules/prompting-playbook.md` for maintenance (prune stale model-patches, version-control defensive rules). Otherwise skip. Agent workflow strategies: `~/.claude/rules/agent-best-practices.md`.

## Git — commit & push (read the rules file first)

About to commit or push? Read `~/.claude/rules/git.md` BEFORE acting. It covers: confirming the commit identity (shared/work PC — never commit on the configured identity unconfirmed), Conventional Commits format + allowed types, the `no-mistakes` push gate, and the no-AI-attribution rule (no AI/tool trailers from any agent). Not committing/pushing → skip it.
