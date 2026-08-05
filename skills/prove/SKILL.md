---
name: prove
description: Prove code does what it claims by building its oracles — the tests, properties, simulations and gates that can say wrong. Use when deciding how a feature or project will be verified, when an existing suite needs teeth (mutation, coverage, fuzz), when a state machine, queue or workflow must hold up under failure and retry, or when a rule or ADR should become a gate that exits non-zero.
---

# Prove

An agent writes code many times faster than a human. That surplus buys verification: the arsenal that proves the code does what it claims and keeps doing it. Spend the surplus, and the result beats a human's even after the extra time.

Two words carry this skill.

An **oracle** is anything that can say *wrong* about an output — an assertion, an invariant, a Gherkin scenario, a lint rule, a threshold, a reference implementation. Code with no oracle is unverifiable no matter how many tests surround it.

**Teeth** is whether an oracle actually bites. A suite at 95% coverage that survives every mutation has no teeth: it executes the code without judging it. Coverage measures reach; mutation measures teeth.

## Two rules that outrank convenience

**A red test is a report.** It says the requirement and the code disagree, and the job is to resolve that disagreement — fix the code, or state in the report why the requirement itself changed. The assertion stays as written. Reaching green by editing the oracle instead — softened tolerance, widened range, skip, delete, swallowed throw — resolves nothing and buries the disagreement. When both sides look defensible, that is an escalation to the user, not a call to make quietly.

**Know the baseline.** Run the whole suite before touching anything and again after. A failure that was already red is a fact to report, not to absorb; a run whose starting state was never observed can attribute nothing to the change.

## Tiers

Every surface gets a tier. The tier decides which layers earn their place — running the whole arsenal on glue code is ceremony, and skipping it on money is malpractice.

| Tier | Surface | Floor |
|---|---|---|
| **T0** | Glue, config, pure re-export, thin adapter with no branching | Typecheck + lint. One smoke test if it can throw. |
| **T1** | Ordinary logic — business rules, transforms, components, endpoints | Unit tests per branch + acceptance oracle + coverage gate |
| **T2** | Money, auth, permissions, concurrency, migrations, data deletion, public API, parsers, state machines, queues and orchestration | T1 + property tests + torture run + mutation gate + adversarial pass; simulation when stateful |

When a surface sits between tiers, take the higher one.

## Steps

### 1. Map the surface, assign tiers

List every surface the work touches or creates — module, endpoint, job, migration, UI flow. Give each a tier and name the oracle that will judge it. For a greenfield project this comes from the PRD; for a change, from the diff and every caller of what it touches.

Done when every surface in scope has a tier and a named oracle, and no surface is listed without one.

### 2. Write the oracle before the code

Turn each requirement into an executable statement of *wrong*, not prose. Gherkin scenarios (`Given/When/Then`) for behaviour the user can describe; invariants and properties for behaviour they can't. Land them as skipped or pending tests that reference the surface, so the suite already lists what is unproven.

Write the whole oracle set up front as one spec pass, rather than one test at a time — the point is a complete map of what is unproven before any code exists. An agent has the short-term memory to hold the whole spec at once; the human micro-cycle of one test, one line, one test buys nothing here. Test-first still holds.

Write the acceptance oracles in a context that has not read the implementation — a separate session or subagent, given the requirement and the outermost seam, nothing else. Tests written after reading the code describe the code; tests written from the requirement judge it. Unit tests are exempt — whoever writes the code writes those.

Done when every acceptance criterion exists as a named test that fails or is explicitly pending, and that set was authored without the implementation in view. A criterion living only in a document is not done.

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

The same run names the redundancy. A test that kills no mutant another test does not already kill is paying maintenance for proof already owned. List those as pruning candidates for a later pass rather than deleting them mid-run, and keep any whose value is naming a requirement rather than catching a mutant. The target is semantic stability, not a test count in either direction.

Done when every surviving mutant on a T2 surface is either killed by a new assertion or annotated in place as equivalent with the reason, and every pruning candidate is listed. A mutation score reported without dispositioning survivors does not count.

### 7. Report the ledger

One table: surface, tier, layers applied, coverage, mutation score, gates enforced, layers skipped and why. This is the artifact — it says what is proven and what is merely untested.

Done when a reader can name, from the ledger alone, the riskiest unproven thing in the codebase.
