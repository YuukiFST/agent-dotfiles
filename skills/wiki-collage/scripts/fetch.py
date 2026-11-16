"""Search Wikipedia or download articles as plain text for wiki-collage.

Run with: python -I fetch.py search <lang> "<query>"
          python -I fetch.py get <lang> <out_dir> "<Title>" ["<Title>" ...]

`get` writes one <Title>.txt per article plus sources.tsv (title, url, revid),
which the Sources block of the article is built from. Stdlib only.
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "wiki-collage-skill/1.0 (sentence-collage article writer)"


def api(lang: str, params: dict) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    url = f"https://{lang}.wikipedia.org/w/api.php?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def search(lang: str, query: str) -> None:
    data = api(lang, {"action": "query", "list": "search", "srsearch": query, "srlimit": "15"})
    for hit in data["query"]["search"]:
        print(f"{hit['title']}\t{hit['wordcount']} words")


def get(lang: str, out_dir: Path, titles: list[str]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for title in titles:
        # Full-text extracts come back one page per request, so fetch titles one by one.
        data = api(lang, {
            "action": "query", "prop": "extracts|revisions|info", "explaintext": "1",
            "rvprop": "ids", "inprop": "url", "redirects": "1", "titles": title,
        })
        page = data["query"]["pages"][0]
        if page.get("missing") or not page.get("extract"):
            print(f"MISSING\t{title}", file=sys.stderr)
            continue
        name = page["title"]
        safe = "".join(c if c.isalnum() or c in " -_" else "_" for c in name)
        (out_dir / f"{safe}.txt").write_text(page["extract"], encoding="utf-8")
        rows.append(f"{name}\t{page['fullurl']}\t{page['revisions'][0]['revid']}")
        print(f"OK\t{name}\t{len(page['extract'].split())} words")
    with (out_dir / "sources.tsv").open("a", encoding="utf-8") as sources:
        sources.writelines(row + "\n" for row in rows)


def main() -> None:
    # The Windows console defaults to cp1252, which mangles accented titles and sentences.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    if len(sys.argv) >= 4 and sys.argv[1] == "search":
        search(sys.argv[2], " ".join(sys.argv[3:]))
    elif len(sys.argv) >= 5 and sys.argv[1] == "get":
        get(sys.argv[2], Path(sys.argv[3]), sys.argv[4:])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
