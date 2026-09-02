#!/usr/bin/env python3
"""Turn a startup screen recording into a bounce measurement.

Input: a recording made by bounce-record.ps1 (or any recording where a magenta
marker square appears in the top-left corner at the launch instant).

Output (in --out, default <recording>.frames/):
  frames/NNNNN.png   every frame, resampled to --fps
  sheet.png          contact sheet from launch to settle, labelled with +ms
  result.json        t0 frame, settled frame, ms, bounces, per-frame diff

Usage:
  python bounce-frames.py rec.mp4 [--fps 60] [--bounce-ms 500] [--threshold 0.0005]

"Settled" = last frame whose pixels differ from the previous frame by more than
--threshold (fraction of pixels).  The marker region is excluded from the diff.
Interactivity is NOT detected here: read sheet.png from a keystroke run.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def extract_frames(rec: Path, out: Path, fps: int) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.png"):
        old.unlink()
    cmd = [
        "ffmpeg", "-loglevel", "error", "-y", "-i", str(rec),
        "-vf", f"fps={fps}", str(out / "%05d.png"),
    ]
    subprocess.run(cmd, check=True)
    return sorted(out.glob("*.png"))


def load(path: Path, scale: int) -> np.ndarray:
    img = Image.open(path).convert("RGB")
    if scale > 1:
        img = img.reduce(scale)
    return np.asarray(img, dtype=np.int16)


def is_marker(frame: np.ndarray, size: int) -> bool:
    region = frame[:size, :size].reshape(-1, 3).mean(axis=0)
    r, g, b = region
    return r > 180 and g < 90 and b > 180


Rect = tuple[int, int, int, int]


def region_mask(shape: tuple[int, ...], marker: int, rect: Rect | None) -> np.ndarray:
    """True where pixels count: inside the app window rect (if known), never inside the marker."""
    mask = np.zeros(shape[:2], dtype=bool)
    if rect:
        x0, y0, x1, y1 = rect
        mask[y0:y1, x0:x1] = True
    else:
        mask[:] = True
    mask[:marker, :marker] = False
    return mask


def changed_fraction(a: np.ndarray, b: np.ndarray, mask: np.ndarray, pixel_delta: int) -> float:
    diff = (np.abs(a - b).max(axis=2) > pixel_delta) & mask
    return float(diff.sum() / mask.sum())


def changed_bbox(first: np.ndarray, last: np.ndarray, mask: np.ndarray, pixel_delta: int, scale: int) -> Rect | None:
    """Region the app touched between launch and settle, in full-res pixels (the app window, roughly)."""
    diff = (np.abs(first - last).max(axis=2) > pixel_delta) & mask
    ys, xs = np.nonzero(diff)
    if len(ys) == 0:
        return None
    pad = 8
    return (int(max(0, xs.min() - pad) * scale), int(max(0, ys.min() - pad) * scale), int((xs.max() + pad) * scale), int((ys.max() + pad) * scale))


def sheet_indices(t0: int, changed: list[int], last: int) -> list[int]:
    """Every frame when short; otherwise launch, each change and the frame before it, and the tail."""
    if last - t0 <= 40:
        return list(range(t0, last + 1))
    keep = {t0, last - 1, last}
    for c in changed:
        keep.update((c - 1, c))
    return sorted(i for i in keep if t0 <= i <= last)


def contact_sheet(paths: list[Path], indices: list[int], t0: int, fps: int, dest: Path, crop: tuple[int, int, int, int] | None) -> None:
    thumbs = []
    width = 480
    for i in indices:
        img = Image.open(paths[i]).convert("RGB")
        if crop:
            img = img.crop(crop)
        ratio = width / img.width
        img = img.resize((width, int(img.height * ratio)))
        draw = ImageDraw.Draw(img)
        label = f"f{i - t0}  +{round((i - t0) * 1000 / fps)}ms"
        draw.rectangle([0, 0, 150, 18], fill=(0, 0, 0))
        draw.text((4, 3), label, fill=(255, 255, 0))
        thumbs.append(img)
    if not thumbs:
        return
    per_row = 4
    th = thumbs[0].height
    rows = (len(thumbs) + per_row - 1) // per_row
    sheet = Image.new("RGB", (width * per_row, th * rows), (40, 40, 40))
    for n, img in enumerate(thumbs):
        sheet.paste(img, ((n % per_row) * width, (n // per_row) * th))
    sheet.save(dest)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("recording", type=Path)
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--bounce-ms", type=int, default=500, help="one full Dock bounce, per mitchellh: ~500ms")
    ap.add_argument("--threshold", type=float, default=0.0005, help="fraction of changed pixels that counts as a frame change")
    ap.add_argument("--pixel-delta", type=int, default=24, help="per-channel delta for a pixel to count as changed")
    ap.add_argument("--marker-size", type=int, default=60, help="marker square side in screen pixels")
    ap.add_argument("--downscale", type=int, default=2, help="integer downscale before diffing (speed)")
    ap.add_argument("--rect", help="x0,y0,x1,y1 of the app window in screen pixels; default: window_rect from <recording>.json")
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()

    rect = None
    meta_path = Path(str(args.recording) + ".json")
    if args.rect:
        rect = tuple(int(v) for v in args.rect.split(","))
    elif meta_path.exists() and json.loads(meta_path.read_text()).get("window_rect"):
        rect = tuple(json.loads(meta_path.read_text())["window_rect"])
    if rect is None:
        print("no window rect: diffing the whole screen; anything else that moves on screen counts as a frame change", file=sys.stderr)

    out = args.out or args.recording.with_suffix(".frames")
    paths = extract_frames(args.recording, out / "frames", args.fps)
    if not paths:
        print("no frames extracted", file=sys.stderr)
        return 1

    marker = max(1, args.marker_size // args.downscale)
    frames = [load(p, args.downscale) for p in paths]

    t0 = next((i for i, f in enumerate(frames) if is_marker(f, marker)), None)
    if t0 is None:
        print("launch marker (magenta square, top-left) never appeared; was the recording made with bounce-record.ps1?", file=sys.stderr)
        return 1

    scaled_rect = tuple(v // args.downscale for v in rect) if rect else None
    mask = region_mask(frames[0].shape, marker, scaled_rect)
    diffs = [0.0] * len(frames)
    for i in range(t0 + 1, len(frames)):
        diffs[i] = changed_fraction(frames[i], frames[i - 1], mask, args.pixel_delta)
    changed = [i for i in range(t0 + 1, len(frames)) if diffs[i] > args.threshold]
    settled = changed[-1] if changed else t0
    ms = round((settled - t0) * 1000 / args.fps)
    bounces = round(ms / args.bounce_ms, 2)

    crop = rect or changed_bbox(frames[t0], frames[settled], mask, args.pixel_delta, args.downscale)
    last = min(settled + 2, len(frames) - 1)
    contact_sheet(paths, sheet_indices(t0, changed, last), t0, args.fps, out / "sheet.png", crop)
    result = {
        "recording": str(args.recording),
        "fps": args.fps,
        "t0_frame": t0,
        "settled_frame": settled,
        "settled_ms": ms,
        "bounces": bounces,
        "frame_changes_after_launch": len(changed),
        "changed_frames": [{"frame": i - t0, "ms": round((i - t0) * 1000 / args.fps), "fraction": round(diffs[i], 5)} for i in changed],
        "window_rect": rect,
        "window_bbox": crop,
        "sheet": str(out / "sheet.png"),
    }
    (out / "result.json").write_text(json.dumps(result, indent=2))
    print(f"t0=frame {t0}  settled=+{ms}ms  = {bounces} bounces  ({len(changed)} frame changes)")
    print(f"sheet: {out / 'sheet.png'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
