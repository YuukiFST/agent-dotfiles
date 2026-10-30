#!/usr/bin/env python3
"""Save a live page as one standalone HTML file and a screenshot of the live page.

Used by ui-polish audit.md step 1 when a site is known only by its URL. It runs the
page function of unslop's scripts/snapshot.mjs (read from the ui-refs clone) in
browser-harness, or in chrome-devtools-axi when browser-harness is not installed,
so no Playwright is needed.

    python capture-url.py <url> <out-dir> [--theme dark|light] [--backend harness|axi]

Writes <out-dir>/original.html, <out-dir>/original.live.png and <out-dir>/assets/.
"""
import argparse
import base64
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

SNAPSHOT = Path(os.environ.get("UI_REFS", Path.home() / ".claude" / "ui-refs")) / "unslop/skills/unslop/scripts/snapshot.mjs"
FUNCTION_START = "page.evaluate(async ([label, scheme]) =>"
FUNCTION_END = '}, [label ?? "", scheme]);'
VIEWPORT = (1440, 810)
class CaptureError(Exception):
    pass


DATA_URL = re.compile(r"data:(image/[\w.+-]+);base64,([A-Za-z0-9+/=]{2048,})")


def page_function():
    if not SNAPSHOT.is_file():
        sys.exit(f"{SNAPSHOT} is missing: run update-refs.sh beside ui-polish's SKILL.md")
    source = SNAPSHOT.read_text(encoding="utf-8")
    start, end = source.find(FUNCTION_START), source.find(FUNCTION_END)
    if start < 0 or end < start:
        sys.exit(f"{SNAPSHOT} no longer passes its page function to page.evaluate the way capture-url.py expects; update its markers")
    return source[start + len("page.evaluate("):end + 1]


def capture_function(theme):
    # base64 keeps the HTML intact through each backend's string encoding: chrome-devtools-axi drops backslashes,
    # which would break escaped selectors like .hover\:bg-x.
    return (
        "async () => {"
        f" const html = await ({page_function()})([\"\", {json.dumps(theme)}]);"
        " const bytes = new TextEncoder().encode(html); let text = '';"
        " for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));"
        " return btoa(text); }"
    )


def executable(name):
    path = shutil.which(name)
    if not path:
        raise CaptureError(f"{name} is not on PATH")
    if not path.lower().endswith((".cmd", ".bat")):
        return [path]
    # An npm shim runs through cmd.exe, which mangles the & ^ % of the page function: run its node entry directly.
    package = Path(path).parent / "node_modules" / name
    entry = json.loads((package / "package.json").read_text(encoding="utf-8"))["bin"]
    return ["node", str(package / (entry[name] if isinstance(entry, dict) else entry))]


def run(command, **kwargs):
    command = executable(command[0]) + command[1:]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", **kwargs)
    if result.returncode != 0:
        raise CaptureError(f"{command[0]} failed ({result.returncode}): {(result.stderr or result.stdout).strip()[-2000:]}")
    return result.stdout


def capture_with_harness(url, theme, shot, encoded_file):
    media = theme if theme in ("dark", "light") else ""
    expression = "(" + capture_function(theme) + ")()"
    program = f"""
tab = new_tab()
try:
    cdp("Emulation.setDeviceMetricsOverride", width={VIEWPORT[0]}, height={VIEWPORT[1]}, deviceScaleFactor=1, mobile=False)
    cdp("Emulation.setEmulatedMedia", features=[{{"name": "prefers-color-scheme", "value": {media!r}}}])
    goto_url({url!r})
    wait_for_load(30)
    wait_for_network_idle(15)
    js("document.fonts.ready.then(() => true)")
    wait(0.6)
    reply = cdp("Runtime.evaluate", expression={expression!r}, awaitPromise=True, returnByValue=True, _response_timeout=180)
    if "exceptionDetails" in reply:
        raise RuntimeError(reply["exceptionDetails"])
    open({str(encoded_file)!r}, "w").write(reply["result"]["value"])
    js("window.scrollTo(0, 0)")
    capture_screenshot({str(shot)!r})
finally:
    close_tab(tab)
"""
    run(["browser-harness"], input=program)
    return encoded_file.read_text()


def capture_with_axi(url, theme, shot):
    run(["chrome-devtools-axi", "open", "about:blank"])
    run(["chrome-devtools-axi", "emulate", "--color-scheme", theme if theme in ("dark", "light") else "auto"])
    run(["chrome-devtools-axi", "resize", str(VIEWPORT[0]), str(VIEWPORT[1])])
    run(["chrome-devtools-axi", "open", url])
    run(["chrome-devtools-axi", "wait", "1500"])
    output = run(["chrome-devtools-axi", "eval", "--full", capture_function(theme)])
    encoded = max(re.findall(r"[A-Za-z0-9+/=]{64,}", output), key=len, default="")
    run(["chrome-devtools-axi", "eval", "window.scrollTo(0, 0)"])
    run(["chrome-devtools-axi", "screenshot", str(shot)])
    return encoded


def move_images_beside(html, out):
    assets = out / "assets"
    count = 0

    def replace(match):
        nonlocal count
        count += 1
        assets.mkdir(exist_ok=True)
        name = f"{count}{mimetypes.guess_extension(match[1]) or '.bin'}"
        (assets / name).write_bytes(base64.b64decode(match[2]))
        return f"assets/{name}"

    return DATA_URL.sub(replace, html), count


def refuse_unignored(out):
    probe = out if out.exists() else out.parent
    inside = subprocess.run(["git", "-C", str(probe), "rev-parse", "--is-inside-work-tree"], capture_output=True, text=True)
    if inside.returncode == 0 and subprocess.run(["git", "-C", str(probe), "check-ignore", "-q", str(out)]).returncode != 0:
        sys.exit(f"{out} sits in a git work tree and is not ignored; the copy can hold the signed-in user's data, so pick an ignored path or OS temp")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("url")
    parser.add_argument("out", type=Path)
    parser.add_argument("--theme", choices=("dark", "light"), default="")
    parser.add_argument("--backend", choices=("harness", "axi"), help="default: browser-harness, falling back to chrome-devtools-axi when it fails")
    args = parser.parse_args()
    out = args.out.resolve()
    refuse_unignored(out)
    out.mkdir(parents=True, exist_ok=True)
    shot = out / "original.live.png"
    encoded, backend = "", ""
    for backend in [args.backend] if args.backend else ["harness", "axi"]:
        try:
            with tempfile.TemporaryDirectory() as scratch:
                if backend == "harness":
                    encoded = capture_with_harness(args.url, args.theme, shot, Path(scratch) / "page.b64")
                else:
                    encoded = capture_with_axi(args.url, args.theme, shot)
        except CaptureError as error:
            print(f"{backend}: {error}", file=sys.stderr)
            continue
        if encoded:
            break
        print(f"{backend}: returned no page", file=sys.stderr)
    if not encoded:
        sys.exit("no backend captured the page")
    html = base64.b64decode(encoded).decode("utf-8")
    html, images = move_images_beside(html, out)
    # One CSS rule per line, and a break inside each tag that has attributes, where whitespace renders nothing,
    # so a reviewer can read the minified page and cite a line.
    html = re.sub(r"(<style>)(.*?)(</style>)", lambda m: m[1] + m[2].replace("}", "}\n") + m[3], html, flags=re.S)
    html = re.sub(r"<([a-zA-Z][\w-]*)(\s)", r"<\1\n\2", html)
    (out / "original.html").write_text(html, encoding="utf-8")
    print(f"{backend}: {out / 'original.html'} ({len(html):,} chars, {images} images in assets/), {shot}")


if __name__ == "__main__":
    main()
