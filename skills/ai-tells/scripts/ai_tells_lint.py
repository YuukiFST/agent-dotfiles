#!/usr/bin/env python3
"""Flag the lexical AI tells in Markdown or plain text, using the ids from patterns.md.

Findings are candidates, not verdicts: the skill decides whether each one is a tell in
context. Structural tells (triads, staging, rhythm) are a reading job and are not linted.
Code fences, inline code, YAML frontmatter, URLs and link targets are skipped.

Usage:
    python3 ai_tells_lint.py draft.md other.md   # files
    python3 ai_tells_lint.py < draft.md          # stdin, reported as <stdin>
    python3 ai_tells_lint.py --list-rules        # every id this lint can print

Output, one finding per line, sorted: path:line:col: id: "match" (plain: swap)
Exit status: 0 no findings, 1 findings, 2 usage or read error.
"""

import argparse
import re
import sys
from typing import Iterator, NamedTuple

APOS = "['’]"  # models and editors emit both straight and curly apostrophes


class Rule(NamedTuple):
    id: str
    pattern: re.Pattern[str]
    hint: str = ""


class Finding(NamedTuple):
    line: int
    col: int
    id: str
    match: str
    hint: str


def words(rule_id: str, *phrases: str, hint: str = "", case: bool = False) -> Rule:
    """Build a rule matching any phrase as whole words; phrases are regex fragments."""
    body = "|".join(phrases)
    flags = 0 if case else re.IGNORECASE
    return Rule(rule_id, re.compile(rf"(?<!\w)(?:{body})(?!\w)", flags), hint)


def swap(word: str, plain: str) -> Rule:
    return words("fancy-word", word, hint=plain)


RULES: list[Rule] = [
    Rule("dash", re.compile(r"[—–]|(?<=\s)--(?=\s)")),
    Rule("curly-quotes", re.compile(r"[“”‘’]")),
    words(
        "not-x-but-y",
        r"not (?:just|only|merely|simply) [^.;:!?]{1,80}?\bbut",
        rf"(?:it|this|that)(?:{APOS}s| is) not [^.;:!?]{{1,60}}?[,;] (?:it|this|that)(?:{APOS}s| is)",
        rf"(?:this|that|it) (?:does not|doesn{APOS}t) mean [^.]{{1,80}}\. It means",
        rf"isn{APOS}t (?:about )?[^.]{{1,60}}\. It{APOS}s",
        r"Not an? [^.]{1,40}\. Not an?",
    ),
    words(
        "staged-opener",
        rf"let{APOS}s (?:dive in(?:to)?|break (?:this|it) down|explore|unpack|be honest)",
        rf"here{APOS}s (?:the thing|what you need to know|what nobody tells you|the kicker)",
        r"without further ado",
        r"honestly\?",
        r"real talk",
        r"let me be clear",
        r"the uncomfortable truth is",
        r"what most people get wrong",
        r"the part (?:everyone|most people) (?:misses|miss|skips|skip)",
        r"what if i told you",
        r"plot twist:",
        r"think about it:",
        r"the thing is,",
    ),
    words(
        "metadiscourse",
        r"(?:this|that|the) (?:distinction|last part) matters",
        r"matters more than it sounds",
        r"the key (?:point|takeaway|insight) (?:is|here)",
        r"as you can see",
        r"let that sink in",
        r"read that again",
    ),
    words(
        "chatbot-residue",
        r"i hope this helps",
        r"great question",
        r"certainly!",
        r"of course!",
        rf"you{APOS}re absolutely right",
        r"let me know if",
        r"would you like me to",
        r"want me to",
        r"feel free to",
        r"happy to help",
    ),
    words(
        "knowledge-limit",
        r"as of my (?:last|latest) (?:training|knowledge)(?: update| cutoff)?",
        r"up to my last training",
        r"while specific details",
        r"based on (?:the )?available information",
        r"not (?:widely|publicly|extensively) (?:documented|available|disclosed)",
        r"maintains a low profile",
        r"it is believed that",
    ),
    words(
        "ai-vocabulary",
        r"additionally",
        r"align(?:s|ed)? with",
        r"bolster(?:s|ed)?",
        r"crucial(?:ly)?",
        r"delv(?:e|es|ed|ing)",
        r"embark(?:s|ed|ing)?",
        r"elevat(?:e|es|ed|ing)",
        r"enduring",
        r"enhanc(?:e|es|ed|ing)",
        r"ever-evolving",
        r"foster(?:s|ed|ing)?",
        r"garner(?:s|ed)?",
        r"interplay",
        r"intricac(?:y|ies)",
        r"intricate",
        r"meticulous(?:ly)?",
        r"multifaceted",
        r"paramount",
        r"pivotal",
        r"realm",
        r"seamless(?:ly)?",
        r"showcas(?:e|es|ed|ing)",
        r"supercharg(?:e|es|ed|ing)",
        r"tapestry",
        r"testament",
        r"transformative",
        r"underscor(?:e|es|ed|ing)",
        r"vibrant",
        r"game[- ]changer",
        r"cutting-edge",
        r"paradigm shift",
    ),
    swap(r"utiliz(?:e|es|ed|ing|ation)", "use"),
    swap(r"leverag(?:e|es|ed|ing)", "use"),
    swap(r"facilitat(?:e|es|ed|ing)", "help"),
    swap(r"numerous", "many"),
    swap(r"commenc(?:e|es|ed|ing)", "start"),
    swap(r"endeavou?rs?", "try"),
    swap(r"in the event that", "if"),
    swap(r"empower(?:s|ed|ing)?", "let"),
    swap(r"streamlin(?:e|es|ed|ing)", "simplify"),
    words(
        "copula-avoidance",
        r"serv(?:es|ed|ing) as",
        r"stands as",
        r"functions as",
        r"boast(?:s|ed|ing)?",
    ),
    words(
        "ing-rider",
        r"(?<=, )(?:highlighting|underscoring|emphasi[sz]ing|ensuring|reflecting|symboli[sz]ing"
        r"|showcasing|fostering|contributing to|cementing|solidifying)",
    ),
    words(
        "sales-language",
        r"nestled",
        r"in the heart of",
        r"breathtaking",
        r"stunning",
        r"must-visit",
        r"renowned",
        r"world-class",
        r"rich cultural heritage",
        r"diverse array",
        r"groundbreaking",
    ),
    words(
        "borrowed-authority",
        r"(?:experts|researchers|critics|observers|analysts|scientists)"
        r" (?:say|believe|agree|argue|suggest|note|warn)",
        r"studies (?:show|suggest|have shown)",
        r"industry reports",
        r"widely regarded",
        r"many (?:argue|believe)",
        r"some (?:critics|experts|observers) (?:argue|say|believe)",
    ),
    words(
        "inflated-significance",
        r"stands as a testament",
        r"a testament to",
        r"pivotal (?:moment|role|point)",
        r"plays? an? (?:vital|key|crucial|pivotal|significant) role",
        r"marks? an? (?:pivotal|significant|major|new) (?:moment|milestone|chapter|shift)",
        r"indelible mark",
        r"setting the stage for",
        r"evolving landscape",
        r"(?:lasting|enduring) legacy",
        r"the future looks bright",
        r"exciting times (?:lie )?ahead",
        r"a step in the right direction",
    ),
    Rule(
        "recap-ending",
        re.compile(
            r"(?:^|(?<=[.!?] ))(?:in conclusion|in summary|to sum up|to summarize"
            r"|ultimately|overall|all in all),",
            re.IGNORECASE,
        ),
    ),
    swap(r"in order to", "to")._replace(id="filler-phrase"),
    swap(r"due to the fact that", "because")._replace(id="filler-phrase"),
    swap(r"made a decision", "decided")._replace(id="filler-phrase"),
    swap(r"ha(?:s|ve) the ability to", "can")._replace(id="filler-phrase"),
    words(
        "filler-phrase",
        rf"it(?:{APOS}s| is) (?:worth noting|important to note)",
        r"at the end of the day",
        r"when it comes to",
        rf"in today{APOS}s (?:world|fast-paced)",
        r"in terms of",
        r"with regard to",
        r"going forward",
    ),
    words(
        "stacked-hedges",
        r"(?:could|may|might|can) (?:potentially|possibly|arguably|conceivably)",
        rf"it{APOS}s also possible that",
    ),
    words(
        "over-compression",
        r"→|⇒|(?<=\s)->(?=\s)|(?<=\s)=>(?=\s)",
    ),
    words(
        "metaphor-jargon",
        r"substrate",
        r"north star",
        r"flywheel",
        r"nexus",
        r"locus",
        r"bedrock",
        r"gold-plating",
        r"endgame",
    ),
    words(
        "adverb-crutch",
        r"significantly",
        r"dramatically",
        r"overwhelmingly",
        r"incredibly",
        r"tremendously",
        r"extremely",
    ),
    words(
        "one-line-closer",
        rf"that{APOS}s the (?:real|whole) (?:win|point|story|trick)",
        r"this changes everything",
        r"every\. single\.",
    ),
]

# Arrows are left to over-compression so one arrow is not reported twice.
EMOJI_CHARS = "\U0001f300-\U0001faff☀-➿⭐"
EMOJI = re.compile(f"[{EMOJI_CHARS}]")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
BULLET = r"^\s*(?:[-*+]|\d+[.)])\s+"
BULLET_EMOJI = re.compile(BULLET + rf"(?:\*\*)?([{EMOJI_CHARS}])")
BOLD_LABEL = re.compile(BULLET + r"(?:\*\*([^*]+?):\*\*|\*\*([^*]+?)\*\*:)(.*)")
# Masked, not deleted, so columns still point at the original text.
MASKS = [
    re.compile(r"`[^`]*`"),
    re.compile(r"\]\([^)]*\)"),
    re.compile(r"<https?://[^>]*>"),
    re.compile(r"https?://\S+"),
]
FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")


def prose_lines(text: str) -> Iterator[tuple[int, str]]:
    """Yield (line number, line) for prose only: no frontmatter, no fenced code."""
    lines = text.split("\n")
    start = 0
    if lines and lines[0].strip() == "---":
        end = next((i for i in range(1, len(lines)) if lines[i].strip() == "---"), None)
        if end is not None:
            start = end + 1
    fence = ""
    for i in range(start, len(lines)):
        line = lines[i]
        opener = FENCE.match(line)
        if opener and not fence:
            fence = opener.group(1)[0] * 3
            continue
        if fence:
            if line.strip().startswith(fence):
                fence = ""
            continue
        yield i + 1, line


def mask(line: str) -> str:
    for pattern in MASKS:
        line = pattern.sub(lambda m: " " * len(m.group(0)), line)
    return line


def is_title_case(heading: str) -> bool:
    """Two or more capitalized words after the first, making up most of them."""
    tokens = re.findall(r"[A-Za-z][A-Za-z'’-]*", heading)[1:]
    # Acronyms (CI) and internal capitals (GitHub) are names, not title case.
    candidates = [t for t in tokens if not t.isupper() and not any(c.isupper() for c in t[1:])]
    capitalized = [t for t in candidates if t[0].isupper()]
    return len(capitalized) >= 2 and len(capitalized) * 4 >= len(candidates) * 3


def heading_findings(number: int, line: str) -> Iterator[Finding]:
    heading = HEADING.match(line)
    if heading:
        for emoji in EMOJI.finditer(line):
            yield Finding(number, emoji.start() + 1, "decorative-heading", emoji.group(0), "")
        if is_title_case(heading.group(2)):
            yield Finding(number, heading.start(2) + 1, "decorative-heading", heading.group(2), "")
    bullet = BULLET_EMOJI.match(line)
    if bullet:
        yield Finding(number, bullet.start(1) + 1, "decorative-heading", bullet.group(1), "")


def label_findings(number: int, line: str) -> Iterator[Finding]:
    """A bold list label the line then restates ("**Speed:** Speed improved").

    A label followed by new detail is a legitimate lead-in, so only the echo is flagged.
    """
    m = BOLD_LABEL.match(line)
    if not m:
        return
    label = {w.rstrip("s") for w in re.findall(r"[a-z]{3,}", (m.group(1) or m.group(2)).lower())}
    opening = {w.rstrip("s") for w in re.findall(r"[a-z]{3,}", m.group(3).lower())[:4]}
    # Half the label echoed: one shared word ("**E2E run:** each run leaves") is chance.
    if len(label & opening) * 2 >= len(label):
        indent = len(line) - len(line.lstrip())
        yield Finding(number, indent + 1, "decorative-bold", line[indent : m.start(3)].strip(), "")


def line_findings(number: int, line: str) -> Iterator[Finding]:
    masked = mask(line)
    for rule in RULES:
        for m in rule.pattern.finditer(masked):
            yield Finding(number, m.start() + 1, rule.id, line[m.start() : m.end()].strip(), rule.hint)
    yield from heading_findings(number, masked)
    yield from label_findings(number, masked)


def lint(text: str) -> list[Finding]:
    found = [f for number, line in prose_lines(text) for f in line_findings(number, line)]
    return sorted(set(found))


def format_finding(path: str, f: Finding) -> str:
    hint = f" (plain: {f.hint})" if f.hint else ""
    return f'{path}:{f.line}:{f.col}: {f.id}: "{f.match}"{hint}'


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("files", nargs="*", help="files to lint; none or - reads stdin")
    parser.add_argument("--list-rules", action="store_true", help="print every rule id")
    args = parser.parse_args(argv)
    # Windows consoles default to cp1252, which cannot print the dashes and emoji we report.
    sys.stdout.reconfigure(encoding="utf-8")

    if args.list_rules:
        ids = dict.fromkeys([r.id for r in RULES] + ["decorative-heading", "decorative-bold"])
        print("\n".join(ids))
        return 0

    any_found = False
    for path in args.files or ["-"]:
        try:
            if path == "-":
                text, shown = sys.stdin.read(), "<stdin>"
            else:
                with open(path, encoding="utf-8-sig") as handle:
                    text, shown = handle.read(), path
        except OSError as err:
            print(f"{path}: {err.strerror}", file=sys.stderr)
            return 2
        for finding in lint(text):
            any_found = True
            print(format_finding(shown, finding))
    return 1 if any_found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
