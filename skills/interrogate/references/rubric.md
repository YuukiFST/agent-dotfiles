# Review Rubric

Review through whichever lenses are relevant. Not every lens applies to every change.

## Correctness

Does the code actually do what the intent says it should?

- Edge cases: empty inputs, nil/undefined, boundary values, concurrent access
- Error handling: are errors caught, propagated, or silently swallowed?
- Off-by-one, type coercion, integer overflow, string encoding
- Wrong operator or default: `==` vs `===`, `<` vs `<=`, `&&` vs `||`, `||` vs `??`
- Async: every promise awaited or deliberately detached; mutation of an input the caller doesn't expect
- Hostile input: huge payloads, deep nesting, multi-byte and normalization-sensitive strings
- State management: race conditions, stale closures, dangling references
- Do both the happy path and the sad path work?
- Idempotency: what happens if this operation runs twice, or if a previous run crashed halfway? If the answer is "it depends on what state was left behind," a reconciliation step is missing.
- Concurrency: if multiple actors can touch the same mutable state (files, branches, shared data), is access serialized structurally (locks, sequential phases, exclusive ownership), or by conventions that won't hold?

When you find a potential bug, trace the execution path. Don't just flag "this could be nil". Show the call chain that makes it nil.

## Root Causes vs. Symptoms

Is the code fixing the actual problem or papering over a symptom?

Answering this often requires looking beyond the changed files. Read the surrounding code (callers, callees, type definitions, sibling modules) and understand the architecture the change lives in. Use the tools available to you (Read, Grep, Glob) to follow the call chain, read the types, and understand why the code exists before judging whether the change addresses the right layer.

- Guard clauses that mask a deeper invariant violation
- Retry logic that hides a broken contract
- Type casts that silence a modeling error
- A workaround: why is it needed? What would a proper fix look like?
- A fix in module A that should really be a fix in module B's contract
- Instructions where structure would be better: if the fix is a comment saying "don't do X" or a convention someone has to remember, ask whether it could instead be a type constraint, a lint rule, or a runtime check that makes the wrong thing impossible

## Structural Integrity

Does the code fit well into the system it's part of?

- Boundary discipline: is validation at system boundaries, or scattered through business logic? Validate data once where it enters the system, then trust it internally.
- Abstraction level: is the code mixing high-level orchestration with low-level detail?
- Coupling: does this change introduce dependencies that will make future changes harder?
- Data model fit: do the data structures match the actual access patterns?
- Bolted-on vs. integrated: if the new requirement had been known from the start, would the code look like this, or does the change feel patched onto the existing design?
- Legacy dual-paths: does the change introduce a new API while keeping the old one alive? If there are no external consumers, migrate callers and delete the old path in the same wave. Don't leave compatibility layers that will become permanent.

Don't penalize simple code for lacking abstraction. Premature abstraction is worse than duplication.

## Verification

Can you tell that this code works from reading it?

- Are there tests? Do they test behavior or implementation details?
- The project's testing rule decides which tests a change owes: under the global CODING_STANDARDS.md that is an E2E test through the outermost interface, so a missing unit test is not a finding there.
- Does each new test trace to a source the user owns, named in the PR body or the commit that adds it: a bug they reported or confirmed, acceptance criteria quoted from them, or the behavior before the change? Under the global CODING_STANDARDS.md ("Human authority"), one whose only source is the agent's reading of the task is a finding.
- Are there assertions/invariants that would catch regressions?
- If this is a bug fix: is there a test for the bug?
- If this touches an integration boundary: is the full path tested?
- Reward hacking: did the diff turn a check green by weakening the check? Look for a test deleted, skipped or marked flaky, an assertion loosened, a golden or snapshot regenerated in the same diff as the logic it captures, a broad catch, or a cast or lint suppression where a check failed. Each one needs a reason tied to the intent; without one, report it with its location.
- When the diff changes a golden, snapshot or expect output, read that output diff beside the logic diff: is the new behavior the one the intent asks for?
- Check the real thing, not a proxy. If the code checks liveness via file mtime or cached state instead of reading the actual value, that's a verification gap.
- For delegated or async work: does the code verify actual output artifacts, or does it trust self-reports and summaries?

## Complexity Budget

Is the complexity justified by what the code accomplishes?

- Code that could be simpler without losing correctness or clarity
- Abstractions that serve only one call site
- Configuration or parameterization for cases that don't exist yet
- Dead code, unused imports, vestigial parameters
- Over-engineering: "just in case" code paths with no current callers
- Obsolete compatibility paths kept alive for transitional stability that's no longer needed. If the migration is done, delete the scaffolding
- Does the user experience justify the complexity? Every feature, control, and option should earn its place. Half-finished features are worse than missing ones.

Simpler is better unless simpler is wrong.

## Security

For each security finding, trace the input path through the code and show it.

- User input flowing to dangerous sinks (SQL, shell, eval, innerHTML, file paths) without sanitization; path traversal through `..`, absolute paths or symlinks
- Secret comparison that leaks timing (`==` on tokens or MACs instead of a constant-time compare)
- Authentication/authorization gaps in new endpoints
- Secrets in code, logs, or error messages; a suspected real credential (API key, token, password, private key) in the diff is always `critical`, reported by location and kind, never by quoting its value. Placeholders and test fixtures are not credentials.
- TOCTOU (time-of-check-time-of-use) in security-critical paths
- Non-cryptographic randomness (`Math.random()`) for tokens, IDs or secrets
- Prototype pollution or unsafe object merges of untrusted data
- Insecure defaults: debug on, CORS wildcard, stack traces or internal paths in production errors
- A dependency pinned to a version with a known vulnerability
- A version bump that neither the PR body nor a commit message explains (what changed between the old and new pins); a bulk bump of unrelated packages; a lockfile change the manifest does not explain

## Error Handling

- Caught at the right level: not so early that it masks the failure, not so late that it crashes the caller.
- Messages are actionable and carry no secrets, keys or internal paths.
- The original error type and context survive wrapping.
- A partial failure stays partial instead of cascading to a total one.
- Retry, timeout, circuit breaker and fallback belong only where the project names that category (the global CODING_STANDARDS.md makes defensive code opt-in); their absence elsewhere is not a finding.

## Performance

Flag only what the change makes worse on a path that runs often or on large input.

- Quadratic work where a set, map or sort would do; lookups inside nested loops
- N+1 queries; a full scan where an index exists or belongs
- Allocation or serialization (`JSON.parse`, regex compile) inside a hot loop
- Synchronous blocking in an async context (`readFileSync` in a request handler)
- Unbounded growth: caches without eviction, arrays that only append, listeners never removed
- Leaked resources: file handles, sockets, DB connections or child processes not closed on every path, the error path included

## API Contracts

For a public function, endpoint, CLI flag, file format or event the change touches:

- Breaking change to a signature, behavior, error shape or response schema, and whether the version or a migration note says so
- New response fields are optional, so old clients keep working
- Input is validated at the boundary, not deep in business logic
- Docs and help text match the new behavior
- Mutating endpoints that can be retried have an idempotency key
