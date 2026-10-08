# Dimension Checklists

## 1. Correctness 🔴

- Does this code actually do what it claims?
- Off-by-one: every loop boundary, slice index, fencepost condition.
- Boolean inversion: trace every `if`, `while`, `assert`.
- Right operator: `==` vs `===`, `<` vs `<=`, `&&` vs `||`.
- Default values correct: every `||`, `??`, default parameter.
- Dead code and impossible branches.
- Async properly awaited: every Promise, async, .then() chain.
- Error propagation: are errors swallowed silently?
- Side effects: mutation where caller doesn't expect it?
- Type coercion surprises: implicit conversions causing bugs.

## 2. Security 🟠

- Injection: SQL, shell, HTML, path traversal, regex, LDAP, XPath.
- Unsanitized user input reaching dangerous sinks.
- Missing auth/authz checks on every endpoint/function.
- Hardcoded secrets, keys, tokens, passwords, API keys.
- Insecure randomness (`Math.random()` for crypto/tokens).
- Timing attacks, side channels.
- Prototype pollution, unsafe object merges/spreads.
- Insecure defaults: debug on, CORS wildcard, verbose errors in prod.
- Dependency chain: known-vulnerable versions?

## 3. Robustness & Edge Cases 🟡

- Null/undefined/empty on every access and iteration.
- Boundary values: 0, -1, MAX_INT, MIN_INT, empty string, empty array.
- Concurrent access: race conditions, TOCTOU, atomicity.
- Resource exhaustion: unbounded allocations, missing timeouts, infinite retries.
- External dependency failures: network, disk, DB, API — every call site.
- Input size: massive payloads, deep nesting, long strings.
- Unicode/encoding: multi-byte, RTL override, homoglyphs, normalization.
- State machine: every transition handled? Invalid states impossible?
- Idempotency: retried operations safe? Duplicate detection?
- Ordering dependencies: what breaks if A happens before B?

## 4. Performance 🔵

- O(n²) where O(n log n) possible. Check nested loops, sorts, lookups.
- Unnecessary allocations in hot paths. Object/array creation in loops.
- Missing memoization on expensive pure computations.
- Synchronous blocking in async contexts (fs.readFileSync in server).
- N+1 query patterns in any data access.
- Unbounded memory: caches without eviction, accumulating arrays, leaking listeners.
- Missing DB indexes, full table scans.
- Excessive serialization/deserialization (JSON.parse in loop).
- Debounce/throttle missing on rapid-fire events.

## 5. Architecture & Design 🟢

- Single Responsibility: does this module/class/function have ONE reason to change?
- Tight coupling: can you swap this dependency without touching its callers?
- Circular dependencies (direct or transitive).
- Leaky abstractions: implementation details exposed through API.
- God objects/functions. Over 50 lines? Justify every one.
- Missing interfaces/contracts at extension points.
- Inverted dependencies: high-level policy depending on low-level detail.
- Configuration scattered vs centralized. Magic numbers.

## 6. Error Handling ⚪

- Errors caught at right level: not too early (masking), not too late (crash).
- Error messages actionable? Or "something went wrong"?
- Sensitive info in error messages (stack traces, internal paths, keys)?
- Retry with exponential backoff + jitter for transient failures?
- Partial failures handled? Or does one failure cascade to total failure?
- Error type preserved? Or wrapped into generic Error losing context?
- Are error codes/names machine-readable for monitoring?
- Is there a top-level unhandled rejection/exception handler?

## 7. Testing 🟣

- Tests testing the right thing? Or just asserting mocks were called?
- Edge cases from dimension 3 covered?
- Error paths tested? Happy path only = untested.
- Assertions precise? `expect(x).toBeTruthy()` is lazy. Use exact values.
- Tests deterministic? No random, no time-dependence, no shared mutable state.
- Coverage meaningful? 100% with weak assertions = fake safety.
- Test names describe the scenario + expected outcome?
- Are slow tests marked? Is there a fast unit suite for the inner loop?

## 8. API Contracts 🔵

- Breaking change to public API? Signature, type, behavior, error shape?
- Semantic versioning violation?
- Deprecation path with timeline and migration guide?
- Input validation at the boundary (not deep in business logic)?
- Response schema backward-compatible? New fields optional?
- Documentation matches actual behavior?
- Rate limiting, pagination, filtering considered?
- Idempotency keys for mutating endpoints?
