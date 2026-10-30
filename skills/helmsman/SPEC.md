# Spec and build tickets

Reached from Advance step 0, when nothing is left to decide: the frontier is empty in both audiences and **Not yet specified** is clear.
This phase **synthesizes**; it asks the human nothing.
Everything it needs is on the map, and the granularity of the build is a technical call, so it is yours.

**Resume, don't duplicate.** Before publishing anything, query the tracker for a `helmsman:spec` issue (or `spec.md`) belonging to this map and for its build tickets.
What exists is reused and completed; only what is missing gets published.
Link the spec from the map's **Spec** section the moment it is published, before slicing the tickets.

## 1. Write the spec

Build it from the map, in the vocabulary of `CONTEXT.md`:

- **Givens**, **Product decisions** and **Assumed** become the problem, the solution and the user stories.
- **Technical decisions** and their `locks:` become the implementation decisions.
- **Out of scope** carries over as it stands.

```markdown
## Problem

<the problem the people using it face, from their perspective>

## Solution

<the solution, from their perspective>

## User stories

1. As a <actor>, I want <feature>, so that <benefit>

## Implementation decisions

<modules, their interfaces, schema, API contracts, auth, hosting and deploy shape and how a deploy is undone, each traced to its ticket on the map; no file paths or code, except a prototype snippet that pins a decision more precisely than prose>

## Testing decisions

<the outermost interface each module is tested through (browser flow, HTTP request, CLI run), per `~/.claude/CODING_STANDARDS.md`; the one command that runs the suite>

## Budget

<zero, or the stated budget; every service the build depends on with its free-tier limit or monthly cost, from the research tickets>

## Out of scope

<from the map>
```

The user stories are a **long** list: every flow and rule on the map appears in at least one.
Publish the spec with the tracker's spec operation.
Done when every product decision and assumption on the map is reflected in a user story.

## 2. Slice the build tickets

Break the spec into **tracer bullets**: each ticket cuts a narrow but complete path through every layer (schema, API, UI, tests), is demoable on its own, and fits one fresh context window.

- **The first ticket is the walking skeleton**: the project scaffold, the test harness running one E2E test, lint and typecheck, and, when the spec has hosting, the deploy configuration with the production build verified locally. Every other ticket is blocked by it.
  The deploy itself is never a build ticket: going live is the human's go, so BUILD.md hands it over in its final report.
  In an existing repo, the first ticket is instead the thinnest end-to-end slice through the harness it already has, adding only the skeleton pieces it lacks, and every other ticket is blocked by it the same way.
- Then one ticket per user-facing flow, smallest useful flow first, each blocked only by the tickets that genuinely gate it, so independent flows can be built in parallel.
  Two flows that meet at an interface (an API shape, a schema, an event) that **Implementation decisions** leaves open are not built in parallel: one blocks the other, and the one built first settles the interface as a technical gap (BUILD.md step 7), so two implementers never each invent it.
- A wide mechanical change across an existing codebase runs as expand, migrate in batches, contract, each its own ticket.

Each ticket's body:

```markdown
## What to build

<the end-to-end behaviour this ticket makes work, from the user's perspective, not a layer-by-layer list>

## Acceptance criteria

- [ ] <a behaviour an E2E run can check>

## Context

<pointers: the spec, the user stories it covers by number, the map's technical decisions it builds on>
```

## 3. Publish and check

Publish the tickets blockers-first with the tracker's build-ticket operation, then wire the blocking edges.
Done when all of these hold, each failure with its fix:

- every user story is covered by at least one ticket's acceptance criteria; an uncovered story gets a ticket, or an existing ticket's criteria grow to cover it;
- no ticket contradicts a `locks:` clause or a given; a ticket that does is re-sliced to respect it;
- no ticket depends on a service outside the budget; one that does gets a **Money** `po` ticket that blocks it.

## 4. Hand over

Tell the human in their language what the spec says the product does, in three to five lines, and how many build tickets it became.
Then [the next command](SKILL.md#the-next-command), which is `/helmsman <map> --build` unless a `po` ticket blocks every build ticket.
