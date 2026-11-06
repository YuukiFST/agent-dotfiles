# Companion skills

Every session reads this file when it loads the map; a row applies from the moment its condition holds. In Build, the lead names each ticket's rows in the implementer's brief, with each skill's absolute path.
Skills the phases already name (`research`, `prototype`, `domain-modeling`, `ui-polish`, `pr-writing`, `interrogate`) need no row.
A companion serves the step it joins and never replaces that step's output. A question it would ask is answered from the map and the spec; what they leave open goes through the [ask test](SKILL.md#the-ask-test), or BUILD.md step 7 during a build.
A user-invoked skill below is read by path, as `../<name>/SKILL.md` from this file.

| When | Skill | Applies at |
|---|---|---|
| A `dev` ticket decides modules, a seam or a public interface | `codebase-design`; its `DESIGN-IT-TWICE.md` when the choice is hard to undo | the resolution, and the spec's Implementation decisions |
| A `dev` ticket decides a schema, a state model or a lifecycle | `principle-model-the-domain`; `principle-type-system-discipline` in a typed language | the resolution |
| A decision is hard to reverse, surprising without context, and a real trade-off | `domain-modeling`'s ADR, on the plan branch | the resolution |
| The product touches auth, user input, secrets, payments or personal data | `security-audit`, guidance mode | the ticket deciding it, each build ticket touching it, and the integration branch before `/interrogate` |
| A product decision sets a speed or resource target | `perf-ratchet`; `web-perf` for a website, `optimizing-startup` for desktop launch | the walking skeleton sets the baseline; each later ticket keeps it |
| Tests are written or changed | `test-audit` | every build ticket |
| The interface carries words: labels, empty states, errors, CTAs | `ai-copywriter` | the prototype, and each screen's build ticket |
| TypeScript or Rust is in the stack | `typescript-best-practices` or `rust-best-practices`; `rust-port` when porting | every build ticket |
| Docs ship beyond the README | `technical-writing` | the ticket writing them |

The `principle-*` skills not named here fire on their own descriptions.

## Left out on purpose

- `grilling`: it runs every branch past the human, the cost the ask test exists to avoid. A human who wants it says so, and its answers land as a packet's would.
- `storm-research`: a `research` ticket settles the facts a decision waits on; a market or strategy briefing is the human's to run before charting.
- `handoff`: the map and the next command already are the handoff.
