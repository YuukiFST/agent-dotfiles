---
name: prove
description: Prove code meets its functional and quality requirements by building the verification arsenal around it — acceptance criteria as executable oracles, unit and property tests, torture/fuzz runs, mutation testing, coverage thresholds, and architecture constraints enforced as lint. Use when starting a project or feature and deciding how it will be verified, when hardening an existing test suite, checking whether tests have teeth, raising coverage meaningfully, or turning an ADR or architecture rule into an enforced gate.
---

# Prove

An agent writes code many times faster than a human. That surplus buys verification: the arsenal that proves the code does what it claims and keeps doing it. Spend the surplus, and the result beats a human's even after the extra time.

Two words carry this skill.

An **oracle** is anything that can say *wrong* about an output — an assertion, an invariant, a Gherkin scenario, a lint rule, a threshold, a reference implementation. Code with no oracle is unverifiable no matter how many tests surround it.

**Teeth** is whether an oracle actually bites. A suite at 95% coverage that survives every mutation has no teeth: it executes the code without judging it. Coverage measures reach; mutation measures teeth.

## Tiers

Every surface gets a tier. The tier decides which layers earn their place — running the whole arsenal on glue code is ceremony, and skipping it on money is malpractice.

| Tier | Surface | Floor |
|---|---|---|
| **T0** | Glue, config, pure re-export, thin adapter with no branching | Typecheck + lint. One smoke test if it can throw. |
| **T1** | Ordinary logic — business rules, transforms, components, endpoints | Unit tests per branch + acceptance oracle + coverage gate |
| **T2** | Money, auth, permissions, concurrency, migrations, data deletion, public API, parsers | T1 + property tests + torture run + mutation gate + adversarial pass |

When a surface sits between tiers, take the higher one.

## Steps

### 1. Map the surface, assign tiers

List every surface the work touches or creates — module, endpoint, job, migration, UI flow. Give each a tier and name the oracle that will judge it. For a greenfield project this comes from the PRD; for a change, from the diff and every caller of what it touches.

Done when every surface in scope has a tier and a named oracle, and no surface is listed without one.

### 2. Write the oracle before the code

Turn each requirement into an executable statement of *wrong*, not prose. Gherkin scenarios (`Given/When/Then`) for behaviour the user can describe; invariants and properties for behaviour they can't. Land them as skipped or pending tests that reference the surface, so the suite already lists what is unproven.

Write the whole oracle set up front as one spec pass, rather than one test at a time — the point is a complete map of what is unproven before any code exists.

Done when every acceptance criterion exists as a named test that fails or is explicitly pending. A criterion living only in a document is not done.

### 3. Install the gates

A rule nobody executes is a comment. Every constraint that matters — architecture boundary, ADR decision, coverage floor, mutation floor, forbidden import, bundle budget — becomes a command that exits non-zero. Read `GATES.md` for how to make each kind executable and where to wire it.

Done when one command runs the whole gate set, it fails on a fresh clone with the code unwritten, and CI runs that same command.

### 4. Build against the oracle

Implement. The oracle set from step 2 is the target; a gate going green is the signal to move on.

Done when every pending test from step 2 is active and passing, and the gate command is green.

### 5. Escalate layers by tier

Add the layers the tiers demand. `LAYERS.md` holds each layer: what it proves, when it earns its place, the tool per stack, and its completion criterion.

Done when every T1 and T2 surface carries the layers its tier requires, and every layer deliberately skipped is named in the report with the reason.

### 6. Check teeth

Run mutation testing over the T2 surfaces at minimum. Each survivor is a hole: an oracle that reads the code without judging it.

Done when every surviving mutant on a T2 surface is either killed by a new assertion or annotated in place as equivalent with the reason. A mutation score reported without dispositioning survivors does not count.

### 7. Report the ledger

One table: surface, tier, layers applied, coverage, mutation score, gates enforced, layers skipped and why. This is the artifact — it says what is proven and what is merely untested.

Done when a reader can name, from the ledger alone, the riskiest unproven thing in the codebase.
