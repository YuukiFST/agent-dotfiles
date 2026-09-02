#!/usr/bin/env python3
"""Regression test for bounce-frames.py on a synthetic launch recording.

Marker appears at 0.5 s, window at 0.7 s, content at 0.9 s, last change at 1.1 s.
Expected: settled +600 ms = 1.2 bounces, 3 frame changes.  Run: python selftest.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

here = Path(__file__).parent
with tempfile.TemporaryDirectory() as tmp:
    rec = Path(tmp) / "synth.mp4"
    layers = [
        ("gray", "640x360", None, None),
        ("magenta", "60x60", "0:0", 0.5),
        ("white", "400x250", "120:50", 0.7),
        ("blue", "200x40", "140:70", 0.9),
        ("red", "100x100", "300:150", 1.1),
    ]
    inputs = []
    for color, size, _, _ in layers:
        inputs += ["-f", "lavfi", "-i", f"color=c={color}:s={size}:r=60:d=2"]
    chain, prev = [], "[0]"
    for n, (_, _, pos, t) in enumerate(layers[1:], start=1):
        out = f"[l{n}]" if n < len(layers) - 1 else ""
        chain.append(f"{prev}[{n}]overlay={pos}:enable='gte(t,{t})'{out}")
        prev = out
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(chain),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(rec)], check=True)
    subprocess.run([sys.executable, str(here / "bounce-frames.py"), str(rec)], check=True)
    result = json.loads((Path(tmp) / "synth.frames" / "result.json").read_text())

got = (result["settled_ms"], result["bounces"], result["frame_changes_after_launch"])
want = (600, 1.2, 3)
print("PASS" if got == want else f"FAIL: got {got}, want {want}")
sys.exit(0 if got == want else 1)
