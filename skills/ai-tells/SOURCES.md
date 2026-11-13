# Sources

`ai-tells` merges three skills that covered the same ground and contradicted each other on dashes, colons, parentheses, and spoken adverbs (issue #110).
The catalogue is rewritten and deduplicated, so upstream text does not map line for line; each source below lists what it contributed.
All three are MIT; their notices are in `LICENSE`, and their pins are in `skills/UPSTREAMS.tsv`.
Later releases of Siqi Chen's original are ported by hand and credited in the last row.

| Source | Contributed |
|---|---|
| [akitaonrails/my-skills `humanizer/`](https://github.com/akitaonrails/my-skills/tree/main/humanizer), derived from Siqi Chen's humanizer | the default-choice theory, strength ranking and weak alone tells, "When not to act", most before/after examples, file and embedded modes, the fact check after rewriting |
| [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) | voice preservation and the minimum effective edit, audit mode, colon reveals, interpretive metadiscourse, faux-insight openers, the portability test, the post-rewrite checklist |
| [cursor/plugins `pstack/skills/unslop`](https://github.com/cursor/plugins/tree/main/pstack/skills/unslop) | stable rule ids, the plain speech section (metaphor jargon, mechanism over feeling, active voice, adverbs, plain words, mannered prose, over-compression), the colon and bold lead-in rules |
| [blader/humanizer](https://github.com/blader/humanizer) by Siqi Chen, 3.1.0 to 4.0.0 | `re-explaining` and the reply-context note in step 1, `self-description` (widened from the previous-version tell), effect headings in `decorative-heading`, example restatement in `one-line-closer`, dictionary hyphens in `hyphen-pairs`, the file mode full read and section count, fake tags and operator notes as material, reworked after examples; its 4.0.0 permission to add known facts is left out, since the no-new-facts rule guards rewrites of the user's own PR bodies and docs |

The patterns trace back to [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), maintained by WikiProject AI Cleanup.

Decisions that differ from every source: dashes are banned with no voice-sample exception, and the register table in `SKILL.md` replaces each source's single global rule.

## Refreshing

1. Run `bash scripts/check-upstreams.sh ai-tells` and read the diff of each source folder behind the compare link it prints.
2. Map each new or changed rule to an existing id in `patterns.md`, or add an id when nothing covers it; a lexical form also gets a lint rule and a fixture line.
3. Run `bash skills/ai-tells/tests/run.sh` and move each pin in `skills/UPSTREAMS.tsv`.
