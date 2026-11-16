"""Check that every sentence of a wiki-collage draft appears verbatim in the corpus.

Run with: python -I verify.py <corpus_dir> <draft.md>

Headings (lines starting with #) are exempt. Checking stops at the first
"## Sources" or "## Fontes" heading, so the attribution block is not checked.
Whitespace is normalized on both sides; every other character must match.
Exit 0 when every sentence matches, 1 otherwise, with each miss printed.
"""

import re
import sys
from pathlib import Path

SOURCES_HEADING = re.compile(r"^##\s+(Sources|Fontes)\b", re.IGNORECASE)
SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[\"'(\[A-ZÀ-Ý0-9])")


def normalize(text: str) -> str:
    return " ".join(text.split())


def draft_sentences(draft: str) -> list[str]:
    body = []
    for line in draft.splitlines():
        if SOURCES_HEADING.match(line):
            break
        if not line.lstrip().startswith("#"):
            body.append(line)
    paragraphs = re.split(r"\n\s*\n", "\n".join(body))
    sentences = []
    for paragraph in paragraphs:
        text = normalize(paragraph)
        if text:
            sentences.extend(s for s in SENTENCE_END.split(text) if s.strip())
    return sentences


def main() -> None:
    # The Windows console defaults to cp1252, which mangles accented titles and sentences.
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    corpus_dir, draft_path = Path(sys.argv[1]), Path(sys.argv[2])
    corpus = normalize(" ".join(
        path.read_text(encoding="utf-8") for path in sorted(corpus_dir.glob("*.txt"))
    ))
    if not corpus:
        sys.exit(f"no .txt articles in {corpus_dir}: run fetch.py get first")
    sentences = draft_sentences(draft_path.read_text(encoding="utf-8"))
    misses = [s for s in sentences if s not in corpus]
    for miss in misses:
        print(f"MISS\t{miss}")
    print(f"{len(sentences) - len(misses)}/{len(sentences)} sentences verbatim")
    sys.exit(1 if misses else 0)


if __name__ == "__main__":
    main()
