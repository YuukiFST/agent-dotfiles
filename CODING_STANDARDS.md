# CODING_STANDARDS.md — Global

Rules for editing any project (code, tests, CI, docs), reached from the pointer in the global `CLAUDE.md`; they override model defaults.
Sections run in the order an edit walks them.

## Before the first edit

- **Verifiable goal:** restate the task as a check you run against the real artifact (CLI run, HTTP request, browser flow, existing test); a refactor keeps the existing tests green before and after.
- **Characterization:** pin legacy code's current behavior with a golden-master E2E run before changing it.

## Tests

Skill `test-audit` gates every new or changed test; these add what it lacks.

- **E2E only:** every test you write drives the outermost interface the caller touches (browser flow, HTTP request, CLI run, a library's public API); unit and integration tests are written only when the user asks for one.
  A lower-layer test from your own reading of the task restates the implementation and adds time without lifting the pass rate (DeepSWE and ProgramBench evals, 2026, where TDD lowered it).
- **Bug repro is E2E:** reproduce as the end user hits it; once green, that red test is the bug's one regression test.
- **Golden artifact:** each E2E run leaves a golden file, HTTP transcript, screenshot or log that the same one command regenerates, and the check is a diff against it.
- **One command, headless:** the suite seeds itself and needs no manual step, unshipped config or secret.

## Code

The reader is an LLM: token cost, tool-call latency and output quality are technical constraints here, not style opinions.

- **Surgical diff:** the simplest code that solves it, in the file's existing style; delete only orphans your change created and report pre-existing dead code.
- **Reuse first:** grep for the canonical helper before writing one.
- **Decompose past 500 lines:** split a file over 500 lines (SRP, small functions) before appending to it.
- **Guard clauses:** early returns, about 2 indent levels at most.
- **Grep-able names:** specific enough that grep finds its own uses; `data`, `handler`, `Manager`, `Service` return 50 hits and fail.
- **Types tell the truth:** what the compiler can't prove gets validated; no `any`, `@ts-ignore`, or `as X` over an invariant, and always-set fields are non-optional.
- **Inject dependencies** (constructor/parameter) so a test swaps in a named fake; fakes stand in for external I/O only.
- **Formatter decides style** (`prettier`/`ruff`/`gofmt`/`cargo fmt`/`rubocop -A`): run it and move on.
- **Structured (JSON) logs** for debug/observability; plain text only for user-facing CLI output.
- **Defensive code is opt-in:** add retry/backoff, timeout, circuit-breaker, rate-limit or fallback only for the categories the project names.
- **Comments carry the *why*** (bug, upstream constraint, issue#/SHA); keep an agent's own intent/provenance comments through a refactor; docstrings on public functions give intent plus one usage example.
  A paragraph justifying a stub or shortcut marks wrong code: flag it instead of accepting the explanation.

## Before you show it

- **Green before shown:** run the project's tests, lint and typecheck on your change; repair what fails and rerun until green.
- **Boy Scout rule:** a lint, typecheck or test failure or flake you see gets fixed, even if unrelated to your change; on UI work, so do visible pixel issues.

## Project hygiene

- **Generated files** (CHANGELOG.md, anything marked auto-generated) change only through their generator.
- **README leads with the problem** it solves (one sentence, top); stack and architecture go in `docs/`.
- **Uniform entry points:** the same command does the same thing across projects (`bin/deploy`, tag-release, layout), so an agent runs "deploy" without guessing.
- **Second occurrence → encode:** a class of problem seen twice (style, API misuse, missing check) gets a proposed lint rule, CI step or hook that ends the class; a PR rejected for an unwritten convention is resolved only once the convention is encoded (CLAUDE.md, lint, skill).
