#!/usr/bin/env node
// Count the instructions or heap allocations of one program run under Valgrind
// (Linux only) and print one JSON line for ratchet.mjs. Valgrind runs the program
// on a simulated CPU, so the count barely moves between runs of the same binary,
// input and toolchain: a low-noise metric where wall time is noisy, and one that
// gates in CI, whose VMs expose no hardware counters to `perf`.
//
//   node count.mjs instructions -- <program> [args...]  {"instructions":N}
//   node count.mjs heap -- <program> [args...]          {"heap_bytes":N,"heap_blocks":N,"heap_peak_bytes":N}
//
// The program runs directly, without a shell, and child processes are not counted:
// point it at the binary doing the work, not at a launcher script.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function die(message) {
  process.stderr.write(`count: ${message}\n`);
  process.exit(2);
}

// Thrown once the scratch dir exists, so the finally below always removes it.
class CountError extends Error {}
const fail = (message) => {
  throw new CountError(message);
};

const [mode, dash, program, ...args] = process.argv.slice(2);
if (!["instructions", "heap"].includes(mode) || dash !== "--" || !program) {
  die("usage: count.mjs <instructions|heap> -- <program> [args...]");
}
if (os.platform() !== "linux") die(`Valgrind runs on Linux only, not ${os.platform()}; WSL counts as Linux`);

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "count-"));
const outFile = path.join(scratch, "valgrind.out");
const toolArgs =
  mode === "instructions"
    ? ["--tool=callgrind", `--callgrind-out-file=${outFile}`]
    : ["--tool=dhat", `--dhat-out-file=${outFile}`];

try {
  const res = spawnSync("valgrind", [...toolArgs, "--", program, ...args], { encoding: "utf8", maxBuffer: 64 * 2 ** 20 });
  if (res.error) fail(res.error.code === "ENOENT" ? "valgrind is not installed (apt-get install valgrind)" : res.error.message);
  if (res.status !== 0) fail(`${program} exited ${res.status} under valgrind:\n${res.stderr.trim().split("\n").slice(-20).join("\n")}`);
  process.stdout.write(`${JSON.stringify(mode === "instructions" ? instructions(outFile) : heap(res.stderr))}\n`);
} catch (err) {
  if (!(err instanceof CountError)) throw err;
  process.stderr.write(`count: ${err.message}\n`);
  process.exitCode = 2;
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

// Callgrind counts only instruction reads ("Ir") unless cache simulation is on, so
// the profile's summary (or totals) line holds the total instruction count.
function instructions(file) {
  const profile = fs.readFileSync(file, "utf8");
  const total = profile.match(/^(?:summary|totals):\s*(\d+)/m);
  if (!total) fail(`no summary or totals line in the callgrind profile ${file}`);
  return { instructions: Number(total[1]) };
}

// DHAT's end-of-run report, on stderr: "Total: 823,849,731 bytes in 3,929,133 blocks".
function heap(stderr) {
  const num = (s) => Number(s.replaceAll(",", ""));
  const total = stderr.match(/Total:\s+([\d,]+) bytes in ([\d,]+) blocks/);
  const peak = stderr.match(/At t-gmax:\s+([\d,]+) bytes/);
  if (!total || !peak) fail(`no DHAT summary in valgrind's output:\n${stderr.trim().split("\n").slice(-10).join("\n")}`);
  return { heap_bytes: num(total[1]), heap_blocks: num(total[2]), heap_peak_bytes: num(peak[1]) };
}
