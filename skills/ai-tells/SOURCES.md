# Sources

`ai-tells` merges three skills that covered the same ground and contradicted each other on dashes, colons, parentheses, and spoken adverbs (issue #110).
The catalogue is rewritten and deduplicated, so upstream text does not map line for line; each source below lists what it contributed.
All three are MIT; their notices are in `LICENSE`.

| Source | Pinned at | Contributed |
|---|---|---|
| [akitaonrails/my-skills `humanizer/`](https://github.com/akitaonrails/my-skills/tree/main/humanizer), derived from Siqi Chen's humanizer | `8a7d0e5` | the default-choice theory, strength ranking and weak alone tells, "When not to act", most before/after examples, file and embedded modes, the fact check after rewriting |
| [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) | `000650b` | voice preservation and the minimum effective edit, audit mode, colon reveals, interpretive metadiscourse, faux-insight openers, the portability test, the post-rewrite checklist |
| [cursor/plugins `pstack/skills/unslop`](https://github.com/cursor/plugins/tree/main/pstack/skills/unslop) | `70b2dc8` | stable rule ids, the plain speech section (metaphor jargon, mechanism over feeling, active voice, adverbs, plain words, mannered prose, over-compression), the colon and bold lead-in rules |

The patterns trace back to [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), maintained by WikiProject AI Cleanup.

Decisions that differ from every source: dashes are banned with no voice-sample exception, and the register table in `SKILL.md` replaces each source's single global rule.

## Refreshing

1. Open `https://github.com/<repo>/compare/<pinned>...main` for each source and read the diff of its skill folder.
2. Map each new or changed rule to an existing id in `patterns.md`, or add an id when nothing covers it; a lexical form also gets a lint rule and a fixture line.
3. Run `bash skills/ai-tells/tests/run.sh` and update the pinned SHA in the table above.
