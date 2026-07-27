# Gates

A gate is a constraint that exits non-zero. A rule that lives in a document, a code review habit, or a comment is not a gate — it is a wish, and it decays the moment attention moves on.

The trigger for building one: **the same class of problem appears twice**. Not the same bug — the same *class*. Two accidental imports across a boundary, two components reaching into the store directly, two endpoints missing auth. Fixing occurrence three by hand guarantees occurrence four.

## From rule to gate

| Rule | Gate |
|---|---|
| "Domain must not import infrastructure" | `eslint-plugin-boundaries`, or `dependency-cruiser` with a `forbidden` rule |
| "Nobody imports `X` outside `Y`" | ESLint `no-restricted-imports` with `patterns` |
| "Never call `fetch` directly, use the client" | ESLint `no-restricted-globals` / `no-restricted-syntax` with a selector |
| "No `any`, no `@ts-ignore`, no `as` papering over an invariant" | `@typescript-eslint/no-explicit-any`, `ban-ts-comment`, `consistent-type-assertions` |
| "Every endpoint checks auth" | ESLint `no-restricted-syntax` selector on the route export, or a router wrapper that makes the unauthenticated path unrepresentable |
| "Every exported function has a docstring" | `eslint-plugin-jsdoc` `require-jsdoc` scoped to the public entry points |
| "Files stay under 500 lines" | `max-lines` with `skipBlankLines` |
| "Money is never a float" | ESLint `no-restricted-syntax` on the numeric type, or a branded type that the compiler enforces |
| "This ADR decided X" | Whichever of the above encodes X, with the ADR number in the rule's `message` |
| "Coverage must not drop" | `vitest` `coverage.thresholds`, per-file on the risky paths |
| "Tests must have teeth" | `stryker` `thresholds.break` |
| "The bundle stays under N kb" | `size-limit` |

Two rungs before writing a custom rule: an existing ESLint rule with the right options, then `no-restricted-syntax` with an AST selector. Only reach for a custom plugin when neither expresses the constraint.

## Make it unrepresentable first

The strongest gate is the one that cannot be violated. Before writing a lint rule, check whether the type system can hold the invariant instead — a branded type, a discriminated union with no invalid member, a constructor that only returns valid values, a required parameter. A rule the compiler enforces needs no message, no CI step, and no maintenance.

Write the lint rule when the design cannot carry the invariant.

## Every rule carries its why

A gate whose message says only `Forbidden import` gets deleted by whoever hits it at 3am. The message names the reason and where the decision lives:

```js
// eslint.config.js
'no-restricted-imports': ['error', {
  patterns: [{
    group: ['**/infrastructure/**'],
    message: 'Domain stays free of infrastructure — see docs/adr/0007-hexagonal-boundaries.md',
  }],
}]
```

## Wiring

One command runs everything, and CI runs that same command. Divergence between what runs locally and what runs in CI means one of them is not a gate.

```json
{
  "scripts": {
    "verify": "npm run typecheck && npm run lint && npm run test -- --coverage && npm run test:mutation",
    "typecheck": "tsc --noEmit",
    "test:mutation": "stryker run"
  }
}
```

Pre-commit runs the fast subset (`lint-staged` + typecheck); CI runs `verify` whole. Mutation is slow — scope it to the changed T2 paths on pull requests and run it full on the default branch.

## Ratchet, don't cliff

Adopting a gate on an existing codebase produces hundreds of violations, which produces a disabled gate. Set the threshold at today's number and tighten it as work lands. For lint, `--max-warnings` at the current count fails on any new violation while tolerating the backlog.

## The gate must be seen failing

An untested gate is a green check that proves nothing. When each gate lands, break the rule on purpose once and watch it exit non-zero, then revert. A gate never observed failing is indistinguishable from a gate that does not run.
