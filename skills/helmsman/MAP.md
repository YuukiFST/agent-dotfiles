# The map body

The template Chart fills; every later session updates these sections in place.

```markdown
## Problem and goals

<!-- in their language: the problem and who has it, and the checks that will show it is solved; a correction rewrites this section -->

## Destination

<what reaching the end of this map looks like, in one or two lines; every session orients to it before choosing a ticket>

## Notes

- Givens: <each given from the brief or added later, or "none">
- Budget: <zero | the stated budget>
- Skills: <skills every session should consult>
- Plan: <the plan branch and `docs/plan/<effort>/`>
- Design: <core screens, plus `blueprint approved` once it is | no interface>
- Coverage: <each concern from the sweep that does not apply, with why>

## Product decisions

<!-- what the human decided, in their language: one line per closed `po` ticket, or per answer from a charting packet, which has no ticket -->

- [<closed ticket title>](link) - <one-line gist of the answer>
- <charting answer in one line>

## Assumed

<!-- product defaults taken without asking, in their language; the human vetoes any line by saying so -->

- <the assumption>

## Technical decisions

<!-- what you decided: one line per closed `dev` ticket, gist plus the constraint it imposes -->

- [<closed ticket title>](link) - <the choice> - locks: <what later tickets must now assume>

## Design

<!-- the approved look: a link to DESIGN.md once the design is locked; empty until then -->

## Waiting on you

<!-- every open `po` ticket, refreshed from the frontier query at the start and end of every session -->

- [<ticket title>](link) - <the question in one line>

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet -->

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination -->

## Spec

<!-- empty until SPEC.md publishes the spec; then its link and marks, which accumulate: `approved` and `built` sit beside `complete`, per "The map body" in SKILL.md -->
```
