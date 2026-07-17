# Unknowns taxonomy and blindspot pass

Load this when the territory is unfamiliar, the stakes are high, or a previous attempt failed on hidden assumptions.
The goal is not more questions — it is finding the few answers that would materially change the build.

## Taxonomy

| Type | Meaning | How to expose it |
| --- | --- | --- |
| Known knowns | Stated or proven by docs/source | Restate and cite |
| Known unknowns | A decision everyone knows is unresolved | Frontier question, or labeled default |
| Unknown knowns | The user recognizes the right answer when shown, but can't verbalize it | Taste rounds: contrasting options, references, cheap prototypes; capture the reaction as an explicit criterion |
| Unknown unknowns | Constraints nobody has considered | Blindspot pass |

## Blindspot pass

Search the relevant docs/source/tests (sub-agents for slow sweeps) for constraints that could invalidate the plan — rate limits, platform behavior, schema realities, deployment quirks.
Report:

```md
## Blindspot pass

### Highest-risk unknown unknowns
1. <unknown>
   - Why it matters:
   - Evidence:
   - Cheap resolution:
   - Owner: user / agent / docs / prototype

### Likely safe assumptions
- <assumption> — why safe, how to verify later

### Questions worth asking now
- <only the material ones — these join the frontier>
```

## Unknown knowns: prototype before wiring

When the user will know it when they see it, build cheap before building real: single-file mocks with fake data, 2–3 directions with meaningful contrast (not tiny variations), or side-by-side reference implementations.
Extract every reaction into an explicit criterion in the artifact — the prototype is disposable, the criterion is not.
