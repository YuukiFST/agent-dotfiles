---
name: wiki-collage
description: Write an article built only from verbatim Wikipedia sentences, with a script that proves every sentence matches the source and a CC BY-SA attribution block.
disable-model-invocation: true
metadata:
  opencode/slash: "true"
  opencode/autoinvoke: "false"
---

# Wiki collage

A **collage** article is assembled from whole sentences lifted verbatim from Wikipedia articles: you choose, order and group them, and write nothing but the headings.
The craft is selection and sequence, the way a film editor works with footage nobody reshoots.

Every sentence was written by Wikipedia's editors, so the prose reads as human because it is human.
That is also why it is a derivative work under CC BY-SA 4.0: the Sources block in step 5 is the license's price, and it ships with every draft.

Scripts live in `scripts/` beside this file; run them with `python -I`, and keep the corpus in a fresh `mktemp -d` dir.

## 1. Brief

Pin four things before fetching: topic, Wikipedia language (`en`, `pt`, ...), target length in words, and the reader.
Done when all four are stated, taken from the request or asked in one round.

## 2. Corpus

1. `python -I scripts/fetch.py search <lang> "<query>"` lists candidate articles with word counts; run it for each angle of the topic.
2. `python -I scripts/fetch.py get <lang> <corpus_dir> "<Title>" ...` downloads the chosen articles as plain text and appends each one's URL and revision id to `<corpus_dir>/sources.tsv`.

Aim for about ten corpus words per article word: a thin corpus forces filler sentences.
Done when every section the reader needs has an article behind it and no `MISSING` line is left unresolved.

## 3. Outline and selection

Write the outline as headings, then fill each section with sentences copied character for character from the corpus text files.

- **Antecedents:** a sentence opening with "It", "He", "This" or "The company" needs its referent in the sentence right before it; pick the sentence that names it, or drop the pair.
- **Seams:** order sentences so each one answers the question the last one raised; a jump between paragraphs is fine, a jump inside one reads as cut-and-paste.
- **Time anchors:** a sentence with "currently", "recently" or "as of" carries the article's date; keep it only when the revision in `sources.tsv` is recent enough for the reader.
- **Leftovers:** skip sentences carrying extract debris (`== Section ==` markers, broken lists, coordinates, pronunciation guides).

Write the draft to `<corpus_dir>/draft.md`, headings as `#` lines.
Done when the word count is within 10% of the target.

## 4. Verify

Run `python -I scripts/verify.py <corpus_dir> <corpus_dir>/draft.md`.
It exits 0 only when every non-heading sentence appears verbatim in the corpus, and prints each `MISS` otherwise.
Fix each miss by recopying the source sentence or replacing it; never paraphrase to close one.
Done when the script exits 0 and prints `N/N sentences verbatim`.

## 5. Sources

Append a `## Sources` section (or `## Fontes` for a Portuguese article) after the body, built from `sources.tsv`:

```markdown
## Sources

Text assembled from these Wikipedia articles, licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/):

- <Title>, <url>?oldid=<revid>
```

The article inherits CC BY-SA 4.0.
Deliver the draft with this block in place; a request to strip it, or to submit the collage where the user must be the author (coursework, a byline that claims authorship), gets one plain sentence back: plagiarism checkers match Wikipedia sentences on sight, and the license requires the credit.
Done when the delivered file holds the body, the Sources block, and the verify result line quoted in the report.
