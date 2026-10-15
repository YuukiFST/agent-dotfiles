# CODING_STANDARDS.md — Global

Rules for editing or running any project (code, tests, CI, docs, builds, worktrees, dev servers), reached from the pointer in the global `CLAUDE.md`; they override model defaults.
Sections run in the order an edit walks them.

## Before the first edit

- **Verifiable goal:** restate the task as a check you run against the real artifact (CLI run, HTTP request, browser flow, existing test); a refactor keeps the existing tests green before and after.
- **Characterization:** pin legacy code's current behavior with a golden-master E2E run before changing it.

## Tests

Skill `test-audit` gates every new or changed test; these add what it lacks.

- **E2E only:** every test you write drives the outermost interface the caller touches (browser flow, HTTP request, CLI run, a library's public API); unit and integration tests are written only when the user asks for one.
  A lower-layer test from your own reading of the task restates the implementation and costs tokens without lifting the resolve rate.
- **Every bug fix ships its regression test:** a behavior bug the user reports or you fix gets one E2E test that reproduces it as the end user hits it, fails on the pre-fix code for the bug's reason, passes after the fix and stays in the suite.
  Its name carries `regression` plus the issue ref or the symptom, so grep finds the frozen set and a later failure says which bug came back.
  A bug with no deterministic E2E repro (race, performance) gets none: say so in the report instead of shipping a flaky test.
- **Regression tests are frozen:** one red on your branch and green on the base means your change brought its bug back, so fix the code.
  Skipping, deleting, loosening one or regenerating its golden needs the user's approval; a behavior change the user asked for that contradicts one counts as approval, and the report names the test.
  A flaky or base-red one gets the Boy Scout fix, keeping every assertion it makes.
- **CI runs the suite:** a project whose CI does not run the E2E suite on every PR gets that job as its own commit in the next bug-fix PR, or proposed in a repo the user does not own; a test only an agent remembers to run guards nothing.
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
  A known value keeps its type: widening it to `unknown` or a generic record and casting it back later fabricates the evidence the type carried; parse only what crosses a boundary.
  An assertion the type system cannot avoid carries, directly above it, a `SAFETY:` comment proving the runtime type, a `Verified by:` line naming the test that fails if the invariant breaks, and the narrowest lint suppression.
- **Inject dependencies** (constructor/parameter) so a test swaps in a named fake; fakes stand in for external I/O only.
- **Formatter decides style** (`prettier`/`ruff`/`gofmt`/`cargo fmt`/`rubocop -A`): run it and move on.
- **The project's linter outranks this file:** where its config covers a rule here (file length, nesting depth, `any`), the config wins; where it lacks one, propose the lint rule instead of leaning on this text.
- **Structured (JSON) logs** for debug/observability; plain text only for user-facing CLI output.
- **Defensive code is opt-in:** add retry/backoff, timeout, circuit-breaker, rate-limit or fallback only for the categories the project names.
- **Code before comment:** a name, a type or a test says it first; a comment stays only for a *why* the code cannot express (upstream constraint with its link, bug ref).
  The reasoning and provenance of a change go in the commit body, where `git log`/`blame` finds them.
  A docstring states what the signature cannot (units, invariants, side effects); its example stays only if it runs (doctest).
  A comment explaining a workaround, stub or shortcut marks wrong code: fix the code, or flag it in the report.

## Before you show it

- **Green before shown:** run the project's tests, lint and typecheck on your change; repair what fails and rerun until green.
- **Boy Scout rule:** a lint, typecheck or test failure or flake you see gets fixed, even if unrelated to your change; on UI work, so do visible pixel issues.

## Leave no trace

Disk is finite and a Rust `target/` reaches gigabytes in a day: a session ends with the footprint it found, plus only what the user asked to keep.

- **Footprint ledger:** every worktree, clone, scratch dir, container, image, volume and background process (dev server, watcher) the session creates goes on a running list.
  Before the final report each entry is removed, stopped, or named in the report with the reason it stays (a worktree behind an open PR, a server the user wants running).
- **Worktree lifetime = PR lifetime:** a worktree stays while its PR is open and goes once `gh-axi pr view` says merged or closed (or the user drops the branch); judge by the PR, since a rebase merge leaves local SHAs that look unpushed.
  Removal order: stop processes running from it and move the shell out, delete the session's own untracked scratch in it, `git worktree remove <path>` (its ignored `target/`, `node_modules/`, `.venv/` go with it), then delete the branch.
  A worktree that still refuses (uncommitted work, submodules) stays and goes in the report; `--force` only when the user says so, and `git worktree prune` only for a worktree dir deleted by hand.
- **Scratch lives in OS temp:** throwaway files, clones and downloads go in a fresh `mktemp -d` dir, deleted at the end; the repo and home dir hold only deliverables.
- **Cheapest build that proves it:** `cargo check` when compiling is the proof, debug over `--release` unless the task measures release; an extra profile or toolchain is one more full copy of `target/`.
- **The user's checkout keeps its caches:** build output in the user's own checkout (`target/`, `node_modules/`) is their warm cache, whether it predates the session or a test run created it; so are package caches (`~/.cargo/registry`, npm, pip) and Docker images that predate the session.
  `cargo clean`, `docker system prune` and cache purges run only on request; when one is large, report its size and the command that frees it.

## Project hygiene

- **Generated files** (CHANGELOG.md, anything marked auto-generated) change only through their generator.
- **README leads with the problem** it solves (one sentence, top); stack and architecture go in `docs/`.
- **Uniform entry points:** the same command does the same thing across projects (`bin/deploy`, tag-release, layout), so an agent runs "deploy" without guessing.
- **Second occurrence → encode:** a class of problem seen twice (style, API misuse, missing check), or a PR rejected for an unwritten convention, gets a proposal to encode it, cheapest enforceable option first: a type, a lint rule, a test, a hook or CI step.
  Prose (CLAUDE.md, a skill) holds only what no tool can check; once a tool enforces a rule, delete its prose.
