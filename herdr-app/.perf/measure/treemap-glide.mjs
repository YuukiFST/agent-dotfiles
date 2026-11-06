#!/usr/bin/env node
// Frame cadence of the status board's context map while its tiles glide between layouts, with
// the app's CPU over the same window. The map steps through the saved sessions' splits once a
// second in a throwaway window (see treemap-glide-patch.mjs).
//   node .perf/measure/treemap-glide.mjs [--seconds 12] [--also <sh run in the copied mods>]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appHome = path.resolve(here, "..", "..");
const secondsAt = process.argv.indexOf("--seconds");
const seconds = secondsAt === -1 ? "12" : process.argv[secondsAt + 1];
const alsoAt = process.argv.indexOf("--also");
const also = alsoAt === -1 ? "" : ` && ${process.argv[alsoAt + 1]}`;

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-glide-"));
const framesDir = scratch.replaceAll("\\", "/");
const patcher = path.join(here, "treemap-glide-patch.mjs").replaceAll("\\", "/");
const maps = path.join(appHome, "context-maps.json").replaceAll("\\", "/");

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

try {
  const out = execFileSync("node", [
    path.join(here, "isolated.mjs"), "--layout", path.join(appHome, ".perf/layouts/perf-status.json"),
    "--working", "--settle", "4", "--seconds", seconds,
    "--patch", `node "${patcher}" "${framesDir}" "${maps}"${also}`,
  ], { encoding: "utf8", cwd: appHome });
  const stats = JSON.parse(out.trim().split(/\r?\n/).pop());
  const frames = fs.readdirSync(scratch).sort().flatMap((chunk) => JSON.parse(fs.readFileSync(path.join(scratch, chunk), "utf8")));
  const intervals = [];
  for (let i = 1; i < frames.length; i++) {
    if (frames[i - 1][2] && frames[i][2]) intervals.push(frames[i][0] - frames[i - 1][0]);
  }
  if (intervals.length < 30) throw new Error(`only ${intervals.length} glide frames of ${frames.length} renders`);
  const sorted = [...intervals].sort((x, y) => x - y);
  const buildMs = frames.filter((f) => f[2]).map((f) => f[1]).sort((x, y) => x - y);
  const windowStart = frames[frames.length - 1][0] - Number(seconds) * 1000;
  const framesInWindow = frames.filter((f) => f[0] >= windowStart).length;
  const round = (n) => Math.round(n * 100) / 100;
  console.log(JSON.stringify({
    frames: intervals.length,
    fps_median: round(1000 / percentile(sorted, 0.5)),
    fps_p5: round(1000 / percentile(sorted, 0.95)),
    frame_ms_p50: round(percentile(sorted, 0.5)),
    frame_ms_p95: round(percentile(sorted, 0.95)),
    tile_build_ms_p50: round(percentile(buildMs, 0.5)),
    tile_build_ms_p95: round(percentile(buildMs, 0.95)),
    cpu_ms_per_frame: round((stats.cpu_pct * Number(seconds) * 10) / framesInWindow),
    cpu_pct: stats.cpu_pct,
    private_mb: stats.private_mb,
  }));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
