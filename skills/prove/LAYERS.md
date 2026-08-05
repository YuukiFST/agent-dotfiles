# Layers

Each layer is one kind of **oracle**. Tools are named for TS/JS; on another stack take the category and pick the local equivalent (Python: pytest + hypothesis + mutmut + ruff; Go: testing + rapid + go-mutesting + go vet; Rust: cargo test + proptest + cargo-mutants + clippy).

Reach for a layer when it proves something the layers already in place cannot. A layer that duplicates an existing oracle is cost without proof.

## Unit tests — T1+

Proves each branch behaves as specified.

Tool: `vitest`. One test per branch and per boundary value, not one per function. External I/O behind a named fake injected as a parameter, never a mock of the module system.

Done when every branch of the surface is exercised by an assertion that fails if that branch's behaviour changes.

## Acceptance / Gherkin — T1+

Proves the system does what the user asked, in the user's words. This is the layer that survives a rewrite: it names behaviour, not structure.

Tool: `@amiceli/vitest-cucumber` for real `.feature` files, or plain `describe('Given…')/it('When… Then…')` when a separate feature file buys nothing. Steps drive the system at its outermost seam it can be driven at headlessly — HTTP handler, CLI entry, exported use case — not through internal functions.

Done when every acceptance criterion in the PRD or issue maps to a named scenario, and each scenario fails if the feature is removed.

## Property tests — T2, and any pure function with an algebraic law

Proves an invariant across generated inputs, catching the cases nobody thought to enumerate.

Tool: `fast-check`. Reach for it where a law exists: round-trip (`parse(print(x)) === x`), idempotence, commutativity, ordering preserved, output always in range, never throws on valid input, conservation (money in equals money out).

Done when each named invariant runs against generated input and the shrinker's counterexample for a deliberately broken implementation is readable. A law that only holds across a *sequence* of calls belongs to the simulation layer below, not here.

## Simulation and Monte-Carlo — T2 stateful: state machines, workflows, job queues, schedulers, orchestrators, anything that retries

Proves the invariants hold across *sequences* of operations under failure. Every layer above judges one call; the bugs that survive them are the ones needing step 7 to follow step 3 after a retry that arrived late. This is the layer nobody reaches for unprompted, and the one that finds the edge case a production run would otherwise find first.

Two shapes, by size of the thing under test:

**Model-based tests**, for a stateful unit — a reducer, a state machine, a cache, a connection pool. Tool: `fast-check` commands (`fc.commands` + `fc.modelRun`; on other stacks, `hypothesis` `RuleBasedStateMachine`, `rapid`'s state machine, `proptest-state-machine`): one command class per operation, a simplified model of the expected state kept beside the real one, invariants asserted after every step. The generator produces the operation orders nobody enumerates by hand.

**A simulator**, for a system of participants — a worker pool, an orchestration, a queue with consumers. Build fakes that answer like the real participants, drive them through the same state machine the production code drives, and assert the invariants that must hold at every step. Then jitter it: inject delay, timeout, out-of-order completion, duplicate delivery, a participant that fails, a crash and restart between steps. Run thousands of randomized runs (Monte Carlo). The jitter distribution is part of the oracle — a profile that never produces the slow case proves only the fast one.

Invariants worth asserting in either shape: no transition the diagram forbids, no work lost, no work done twice, every started job reaches a terminal state, no interleaving that leaves the store inconsistent, and a replayed or duplicated message changing nothing.

Done when a randomized run under failure injection holds every invariant, and each counterexample found is committed as a fixed-seed regression test that fails against the unfixed code.

## Torture / fuzz — T2 parsers, protocols, uploads, anything eating untrusted bytes

Proves the code survives hostile and malformed input instead of merely handling the happy path.

Tool: `fast-check` with adversarial arbitraries, or a corpus of real malformed payloads. Feed empty, huge, deeply nested, wrong-encoding, truncated, duplicated-key, and unicode-edge input.

Done when no input crashes the process, hangs, or produces a silent wrong value — every rejection is an explicit typed error.

## Mutation testing — T2

Proves the oracles have **teeth**. The only layer that tests the tests.

Tool: `stryker` (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`). Scope it to the T2 files — running it repo-wide is slow enough that it stops being run at all. Set `thresholds.break` so survivors fail CI.

Done when every survivor is killed or annotated as equivalent. A score alone proves nothing.

## Coverage — T1+ as a floor, never a target

Proves reach, not correctness. Its only honest use is a ratchet that blocks regression.

Tool: `vitest --coverage` with `thresholds.autoUpdate` off and per-file thresholds on the T2 paths. Set the floor at what the suite already achieves, then raise it deliberately.

Weight the raise by complexity, not by file order. The dangerous file is the one that is both branchy and thinly covered — the pairing the CRAP metric names. Get the ranking from ESLint's `complexity` rule against the per-file coverage report, and spend the next tests at the top of that list; a 60% branchy state machine is a worse hole than a 60% mapper, and the global percentage hides which one you fixed.

Done when the threshold fails the build on a drop. Chasing a percentage by writing assertion-free tests is the failure this layer invites — mutation testing is the check against it.

## Contract tests — anywhere two deployables agree on a shape

Proves the consumer's expectation and the provider's response stay in sync without a full integration environment.

Tool: schema-first — one `zod` (or JSON Schema) definition owned by the provider, imported by the consumer, asserted in both suites. Reach for `pact` only when the two sides ship on separate release cycles and can't share a package.

Done when a breaking change to the provider's shape fails the provider's own test run.

## Architecture constraints — any project with layers, modules, or an ADR

Proves the design rule holds, instead of trusting everyone to remember it. See `GATES.md`.

Done when violating the rule fails lint.

## Golden / snapshot — serializers, formatters, generated output, rendered markup

Proves output stability. Weak as an oracle (it asserts *unchanged*, not *correct*), so it supplements rather than replaces the layers above.

Tool: `vitest` inline snapshots for small output, file snapshots for large. Review every snapshot diff as a real diff; a blanket `-u` erases the layer.

Done when the snapshot was read and confirmed correct at the moment it was written.

## Performance budget — hot paths, list rendering, anything with a user-visible latency claim

Proves speed claims the same way tests prove behaviour.

Tool: `vitest bench` or `tinybench` for functions; `lighthouse` for pages a user loads. Assert against a committed budget number, not against the previous run.

Done when exceeding the budget fails the build.

## Accessibility — any user-facing UI

Proves the UI is operable, not just rendered.

Tool: `vitest-axe` in component tests plus a keyboard-only pass in the browser. Automated checks catch roughly a third of real issues; the keyboard pass catches the rest.

Done when axe reports no violations and every interactive element is reachable and operable by keyboard alone.

## Manual QA pass — anything a user touches, before declaring done

Proves the thing works as experienced, which no headless layer can. Drive the real app: load the page, run the flow, check the console, check mobile width and dark mode.

Tool: the `agent-browser` or `webapp-testing` skill.

Done when the flow completes with a clean console and screenshots at desktop and mobile width.

## Adversarial pass — T2, last

Proves nothing; hunts. Re-read the surface assuming it is wrong and try to make it produce a wrong answer: concurrent calls, partial failure mid-transaction, clock skew, retry after timeout, the same request twice, the caller who passes the wrong tier of data.

Every hole found becomes a regression test at the layer that should have caught it.

Done when the hunt produces either a new failing test or a written statement of what was attempted and why it held.
