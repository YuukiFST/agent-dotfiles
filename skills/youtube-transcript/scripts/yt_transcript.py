#!/usr/bin/env python3
"""YouTube video links -> transcript files, using the video's captions.

Output per video, overwritten on re-run:
  <out>/<YYYYMMDD>_<slug>_<id>/
    transcript.md   metadata header plus the transcript in paragraphs
    transcript.srt  timed captions

Prints one line per video: `ok <id> <lang> <track> <transcript.md path>`, or
`no-captions <id>` / `error <url> <reason>`. Exit code 1 when any video lacks a transcript.

Deps: python3 stdlib, plus yt-dlp on PATH or uv to run it through uvx.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, unicodedata
from pathlib import Path

VIDEO_ID_PATTERN = re.compile(r"(?:[?&]v=|youtu\.be/|/(?:shorts|live|embed)/)([\w-]{11})(?![\w-])")


def slugify(s, n=50):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:n].rstrip("-") or "item"




def build_cues(json3: Path):
    """YouTube json3 word-timed events -> cues split at sentence ends / ~84 chars / pauses / 7 s."""
    words, ends = [], []
    for ev in json.loads(json3.read_text(encoding="utf-8")).get("events", []):
        if "segs" not in ev or ev.get("aAppend"):
            continue
        t0 = ev["tStartMs"]
        for s in ev["segs"]:
            w = s.get("utf8", "").replace("\n", " ").strip()
            if w:
                words.append((t0 + s.get("tOffsetMs", 0), w))
        ends.append(t0 + ev.get("dDurationMs", 0))
    if not words:
        return []
    last_end = max(ends)
    cues, cur = [], []
    def flush(end_ms):
        if cur:
            cues.append({"start": cur[0][0], "end": end_ms, "text": " ".join(w for _, w in cur)})
            cur.clear()
    for i, (t, w) in enumerate(words):
        nxt = words[i + 1][0] if i + 1 < len(words) else last_end
        cur.append((t, w))
        length = sum(len(x) + 1 for _, x in cur)
        gap = nxt - t
        if (w[-1] in ".!?…" and length >= 30) or length >= 84 or gap > 1500 or nxt - cur[0][0] > 7000:
            flush(min(nxt, t + 1500) if gap > 1500 else nxt)
    flush(last_end)
    for c in cues:
        c["end"] = max(c["end"], c["start"] + 500)
    for a, b in zip(cues, cues[1:]):
        a["end"] = min(a["end"], b["start"])
    return cues



def ts(ms):
    ms = int(ms)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(path: Path, cues, texts):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{t}\n\n"
                            for i, (c, t) in enumerate(zip(cues, texts), 1)), encoding="utf-8")



def paragraphs(cues):
    paras, cur = [], []
    for i, c in enumerate(cues):
        cur.append(c["text"])
        gap = cues[i + 1]["start"] - c["end"] if i + 1 < len(cues) else 0
        if c["text"][-1] in ".!?…" and (gap > 1200 or sum(len(t) for t in cur) > 900):
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    return paras


def write_transcript(path: Path, info, cues):
    head = [f"# {info['title']}", "", f"- URL: {info['url']}", f"- Channel: {info['channel']}"]
    if info["upload_date"] not in ("NA", "None", ""):
        head.append(f"- Date: {info['upload_date']}")
    if info["duration"]:
        head.append(f"- Duration: {info['duration'] // 60} min")
    track = info["caption_track"]
    head.append(f"- Captions: {track}{' (automatic speech recognition, unedited)' if track.endswith('-orig') else ''}")
    path.write_text("\n".join(head) + "\n\n---\n\n" + "\n\n".join(paragraphs(cues)) + "\n", encoding="utf-8")


def ytdlp_command():
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    if shutil.which("uvx"):
        return ["uvx", "yt-dlp"]
    sys.exit("error yt-dlp not found: install it (`uv tool install yt-dlp`, `pipx install yt-dlp`) and rerun")


def ytdlp(*args):
    # YouTube may require cookies for some videos; set YT_DLP_COOKIES_FROM_BROWSER
    # (e.g. "chrome", "brave:Profile 1") or YT_DLP_COOKIES (a cookies.txt path).
    extra = []
    if os.environ.get("YT_DLP_COOKIES_FROM_BROWSER"):
        extra = ["--cookies-from-browser", os.environ["YT_DLP_COOKIES_FROM_BROWSER"]]
    elif os.environ.get("YT_DLP_COOKIES"):
        extra = ["--cookies", os.environ["YT_DLP_COOKIES"]]
    r = subprocess.run([*ytdlp_command(), "--no-warnings", "--encoding", "utf-8", *extra, *args],
                       capture_output=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[-500:])
    return r.stdout


def fetch_captions(vid, tmp: Path, src):
    langs = f"{src},{src}-orig" if src != "auto" else ".*-orig"
    url = f"https://www.youtube.com/watch?v={vid}"
    out = ytdlp("-q", "--skip-download", "--no-simulate", "--write-auto-subs", "--write-subs",
                "--sub-langs", langs, "--sub-format", "json3", "-o", str(tmp / "%(id)s.%(ext)s"),
                *(["--extractor-args", f"youtube:lang={src}"] if src != "auto" else []),
                "--print", "%(title)s\t%(upload_date)s\t%(duration)s\t%(language)s\t%(channel,uploader)s", url)
    title, date, dur, lang, channel = out.strip().splitlines()[-1].split("\t")
    info = {"id": vid, "url": url, "title": title, "upload_date": date, "channel": channel,
            "duration": int(float(dur)) if dur not in ("NA", "None") else 0}
    want = src if src != "auto" else (lang if lang not in ("NA", "None", "") else None)
    if src == "auto" and (want or not any(tmp.glob(f"{vid}.*.json3"))):
        # a video with no declared language and no *-orig track can still carry manual subtitles
        manual_langs = f"{want}(-.*)?" if want else "all,-live_chat"
        ytdlp("-q", "--skip-download", "--no-simulate", "--write-subs", "--sub-langs", manual_langs,
              "--sub-format", "json3", "-o", str(tmp / "%(id)s.%(ext)s"), url)
    files = sorted(tmp.glob(f"{vid}.*.json3"))
    code = lambda f: f.name.split(".")[-2]
    in_lang = lambda c: want is None or c == want or c.startswith(want + "-")
    manual = [f for f in files if not code(f).endswith("-orig") and in_lang(code(f))]
    if want is None:  # manual tracks of unknown origin: English over alphabetical order
        manual.sort(key=lambda f: not code(f).startswith("en"))
    # only the declared-language *-orig track is the original; dubbed audio adds other *-orig tracks
    orig = [f for f in files if code(f).endswith("-orig") and in_lang(code(f).removesuffix("-orig"))]
    pick = (manual or orig or [None])[0]
    if pick is None:
        return info, None
    info["caption_track"] = code(pick)
    info["language"] = want or code(pick).removesuffix("-orig")
    return info, pick


def transcribe_video(url, out: Path, src):
    match = VIDEO_ID_PATTERN.search(url)
    if not match:
        print(f"error {url} not a YouTube video link")
        return False
    vid = match.group(1)
    with tempfile.TemporaryDirectory() as tmp:
        try:
            info, captions = fetch_captions(vid, Path(tmp), src)
        except RuntimeError as err:
            print(f"error {url} {err}")
            return False
        cues = build_cues(captions) if captions else []
    if not cues:
        print(f"no-captions {vid}")
        return False
    vdir = out / f"{info['upload_date']}_{slugify(info['title'])}_{vid}"
    vdir.mkdir(parents=True, exist_ok=True)
    write_srt(vdir / "transcript.srt", cues, [c["text"] for c in cues])
    write_transcript(vdir / "transcript.md", info, cues)
    print(f"ok {vid} {info['language']} {info['caption_track']} {vdir / 'transcript.md'}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Write transcripts of YouTube videos from their captions.")
    parser.add_argument("urls", nargs="+", help="YouTube video links")
    parser.add_argument("--lang", default="auto", help="caption language code; auto = the video's original language")
    parser.add_argument("--out", type=Path, default=Path(tempfile.gettempdir()) / "youtube-transcripts")
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")
    results = [transcribe_video(url, args.out, args.lang) for url in args.urls]
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
