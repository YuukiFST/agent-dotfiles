# CODING_STANDARDS.md — Global

Rules for writing code and tests in any project, reached from the pointer in the global `CLAUDE.md`; they override model defaults.

## Method

- **Simplest code that solves it;** surgical diffs; match existing style. Remove only orphans *your* change created; flag pre-existing dead code, don't delete it.
- **Turn tasks into verifiable goals;** refactors keep existing tests green before and after.
- **Debugging loop:** produce fix → run tests/lint → repair only failures → repeat. Run lint/typecheck on your own output before showing it.

## Code

The reader is an LLM: token cost, tool-call latency and output quality are technical constraints here, not style opinions.

- **Before a helper:** grep for the canonical one, reuse it.
- **File > 500 lines = decompose first**, don't append. SRP, small functions: three 250-line modules beat one 800-line file doing three things.
- **Flatten control flow:** early returns / guard clauses; cap ~2 indent levels.
- **Grep-able names:** avoid `data`/`handler`/`Manager`/`Service` — a name returning 50 grep hits is wrong.
- **Types explicit:** no `any`, no `@ts-ignore`, no `as X` papering over an invariant, no `T | undefined` on always-set fields.
- **Inject dependencies** (constructor/parameter) so a named fake swaps in without infra.
- **Formatter decides style** (`prettier`/`ruff`/`gofmt`/`cargo fmt`/`rubocop -A`); never spend a turn on formatting.
- **Structured (JSON) logs** for debug/observability; plain text only for user-facing CLI output.
- **Defensive code is opt-in:** no retry/backoff, timeout, circuit-breaker, rate-limit, or fallback unless the project names the categories it needs.
- **Comments carry the *why*** (bug, upstream constraint, issue#/SHA), never the obvious *what*. Keep an agent's own comments on refactor — they carry intent/provenance. Docstrings on public functions: intent + one usage example.
- **Paragraph-long comment = code is wrong:** an agent writing a long comment to justify a stub or a shortcut is hiding incorrect code. Flag the comment; don't accept the explanation.

## Testing

- **Black-box first.** Test through the outermost interface the caller touches: browser flow, HTTP request, CLI run, a library's public API. E2E is the default; go lower only when the outer layer can't reach the failure.
- **A test earns its maintenance cost.** Add one only when you can name the observable behavior it protects and the credible regression that turns it red; a change with no such regression ships without a new test. When existing coverage already catches that regression, add nothing; when a nearby test shares its setup, extend it (a table row, a shared fixture) instead of writing a near-duplicate. Assert behavior at the public boundary, so a behavior-preserving refactor keeps the test green. Full authoring gate and pruning workflow: skill `test-audit`.
- **Failure list before code.** When something needs isolated tests, first list the distinct regressions as test cases, one case per regression (table-driven when setup is shared), watch them go red, then write the code. A test written after the code restates it and passes by construction.
- **Artifact per E2E run:** each run leaves a checkable artifact (golden file, HTTP transcript, screenshot, log) that the same one command regenerates. Diff against it; don't eyeball.
- **Bug fixes:** reproduce E2E as the end user experiences it; that red test becomes the regression test once green, and the only one: no copies at the inner layers the bug crosses.
- **Legacy code:** pin current behavior with characterization (golden master) tests before changing it.
- Mock only external I/O, with named fakes. Headless, one command — no manual seed, missing config, or secret.
