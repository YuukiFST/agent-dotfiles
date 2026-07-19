---
name: thermo-nuclear-code-quality-review
description: >
  Maximum-intensity, no-holds-barred code quality review. Goes far beyond
  linting — audits correctness, security, performance, architecture, testing,
  error handling, edge cases, race conditions, resource leaks, and API
  contracts with zero mercy. Every finding is actionable with severity and
  fix. Use when user says "thermo-nuclear review", "nuke this code",
  "destroy this PR", "brutal code review", "maximum scrutiny", or demands
  the most thorough review possible.
disable-model-invocation: true
---

# Thermo-Nuclear Code Quality Review 🔥☢️

## Philosophy

No mercy. No sugar-coating. Every line guilty until proven innocent.
If it ships, it must survive this. Assume nothing. Trust nobody.

## Output Format

Every finding:
```
[SEVERITY] [DIMENSION] file:line — WHAT_IS_WRONG
  FIX: concrete_fix_instruction
  WHY: one_sentence_rationale
```

Severities: `🔴CRITICAL` `🟠HIGH` `🟡MEDIUM` `🔵LOW` `❓QUESTION`

End with verdict:
```
VERDICT: ✅ APPROVE / ⚠️ APPROVE WITH NITS / ❌ REJECT
SUMMARY: N🔴 N🟠 N🟡 N🔵 N❓
RATING: ★★★★★ to ★☆☆☆☆
FATAL FLAW: <most dangerous finding, or "none">
```

## Review Dimensions (all 8, every review, in order)

See [REFERENCE.md](REFERENCE.md) for the full checklist per dimension.

1. **Correctness** 🔴 — off-by-one, inverted logic, dead code, async bugs
2. **Security** 🟠 — injection, secrets, auth, insecure defaults
3. **Robustness** 🟡 — nulls, edge cases, races, resource leaks, timeouts
4. **Performance** 🔵 — O(n²), allocations, N+1, unbounded memory
5. **Architecture** 🟢 — SRP, coupling, circular deps, leaky abstractions
6. **Error Handling** ⚪ — right level, actionable messages, partial failures
7. **Testing** 🟣 — edge paths, precise assertions, deterministic, meaningful
8. **API Contracts** 🔵 — breaking changes, validation, versioning, docs

## Process

1. Read full diff + surrounding code. Every line. No skimming.
2. Run every dimension. In order. Do not skip any.
3. For each finding, ask: could this cause a production incident?
4. Prioritize: criticals first, then work down.
5. Be specific: file:line, exact problem, exact fix. No hand-waving.
6. Deliver verdict. No hedging. Approve or reject.

## Anti-patterns

- ❌ "LGTM" — there is always something.
- ❌ "Consider..." — it's wrong or it isn't.
- ❌ "Minor: variable naming" — give the exact better name.
- ❌ "This might be a problem" — prove it or drop it.
- ❌ "Overall good job" — irrelevant. Code works or it doesn't.
- ❌ Reviewing only the diff context. Read surrounding code too.
