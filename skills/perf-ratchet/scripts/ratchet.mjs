#!/usr/bin/env node
// Performance ratchet: measure every metric in .perf/ratchet.json, fail when one
// regresses past its noise threshold against .perf/baselines.json, and promote
// improvements to the new baseline. Zero dependencies, Node 18+.
//
//   node ratchet.mjs measure [--only a,b] [--stable-only]
//   node ratchet.mjs record <metric-id> <value>...
//   node ratchet.mjs check   [--only a,b] [--stable-only] [--no-promote]
//   node ratchet.mjs blocked <what is missing>
//
// Exit codes: 0 pass, 1 regression, 2 usage, config or measurement error.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXIT_PASS = 0;
const EXIT_REGRESSED = 1;
const EXIT_ERROR = 2;
// MAD times 1.4826 estimates the standard deviation of normal samples; a change
// must clear two of those before it counts as real.
const MAD_TO_SIGMA = 1.4826;
const NOISE_SIGMAS = 2;
// Deterministic metrics (bundle size, binary size) are machine-independent, so
// they share one baseline bucket and CI can gate them on any runner.
const STABLE_BUCKET = "stable";
// Time is recorded in integer microseconds, so a sub-millisecond phase keeps its
// digits and every report reads in one unit.
const COARSE_TIME_UNITS = new Set(["ms", "msec", "millis", "milliseconds", "s", "sec", "secs", "seconds"]);
const TIME_UNITS = new Set(["us", "ns"]);

class RatchetError extends Error {}
const fail = (message) => {
  throw new RatchetError(message);
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    fail(`${file}: ${err.code === "ENOENT" ? "not found" : err.message}`);
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function findRoot(start) {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".perf", "ratchet.json"))) return dir;
    if (path.dirname(dir) === dir) {
      fail("no .perf/ratchet.json in this directory or any parent; write one first (perf-ratchet SKILL.md, Setup)");
    }
  }
}

function numberField(value, fallback, where, { integer = false, min = 0 } = {}) {
  if (value === undefined) return fallback;
  const valid = typeof value === "number" && Number.isFinite(value) && value >= min && (!integer || Number.isInteger(value));
  if (!valid) fail(`${where} must be ${integer ? "an integer" : "a number"} >= ${min}`);
  return value;
}

function loadConfig(root) {
  const file = path.join(root, ".perf", "ratchet.json");
  const raw = readJson(file);
  if (!Array.isArray(raw.metrics) || raw.metrics.length === 0) fail(`${file}: "metrics" must be a non-empty array`);
  if (raw.profile !== undefined && typeof raw.profile !== "string") fail(`${file}: "profile" must be a string`);
  const seen = new Set();
  const metrics = raw.metrics.map((m, i) => {
    const where = `${file}: metrics[${i}]`;
    if (typeof m.id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(m.id)) fail(`${where}.id must match [a-z0-9][a-z0-9._-]*`);
    if (seen.has(m.id)) fail(`${where}: duplicate id "${m.id}"`);
    seen.add(m.id);
    if (m.better !== "lower" && m.better !== "higher") fail(`${where}.better must be "lower" or "higher"`);
    if (typeof m.unit !== "string" || m.unit === "") fail(`${where}.unit must be a non-empty string`);
    if (COARSE_TIME_UNITS.has(m.unit.toLowerCase())) {
      fail(`${where}.unit "${m.unit}": time is recorded in microseconds; set unit "us" and have the command print integer microseconds`);
    }
    for (const key of ["command", "pick", "description"]) {
      if (m[key] !== undefined && typeof m[key] !== "string") fail(`${where}.${key} must be a string`);
    }
    if (m.stable !== undefined && typeof m.stable !== "boolean") fail(`${where}.stable must be true or false`);
    const platformsValid = Array.isArray(m.platforms) && m.platforms.length > 0 && m.platforms.every((p) => typeof p === "string");
    if (m.platforms !== undefined && !platformsValid) fail(`${where}.platforms must be a non-empty array of OS names ("linux", "win32", "darwin")`);
    const stable = m.stable === true;
    return {
      id: m.id,
      unit: m.unit,
      better: m.better,
      command: m.command ?? null,
      pick: m.pick ?? null,
      stable,
      platforms: m.platforms ?? null,
      runs: numberField(m.runs, stable ? 1 : 5, `${where}.runs`, { integer: true, min: 1 }),
      warmup: numberField(m.warmup, 0, `${where}.warmup`, { integer: true }),
      tolerance: numberField(m.tolerance, stable ? 0 : 0.05, `${where}.tolerance`),
      minDelta: numberField(m.minDelta, 0, `${where}.minDelta`),
      resolution: numberField(m.resolution, 0, `${where}.resolution`),
    };
  });
  return { metrics, profile: raw.profile ?? "" };
}

// The kernel version is left out on purpose: it changes on every OS update
// (weekly on NixOS) and would orphan every baseline each time.
function environment(profile) {
  const cpus = os.cpus();
  return {
    platform: os.platform(),
    arch: os.arch(),
    cpu: cpus[0]?.model.trim() ?? "unknown",
    cores: cpus.length,
    memGB: Math.round(os.totalmem() / 2 ** 30),
    profile,
  };
}

const bucketKey = (env) => createHash("sha256").update(JSON.stringify(env)).digest("hex").slice(0, 12);

function gitRef(root) {
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
  if (head.status !== 0) return "no-git";
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" });
  return `${head.stdout.trim()}${status.stdout.trim() ? "-dirty" : ""}`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, positional: [], only: null, stableOnly: false, promote: true };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--only") opts.only = (rest[++i] ?? fail("--only needs a comma-separated list of metric ids")).split(",");
    else if (arg === "--stable-only") opts.stableOnly = true;
    else if (arg === "--no-promote") opts.promote = false;
    else if (arg.startsWith("--")) fail(`unknown flag ${arg}`);
    else opts.positional.push(arg);
  }
  return opts;
}

function selectMetrics(config, opts) {
  if (opts.only) {
    const unknown = opts.only.filter((id) => !config.metrics.some((m) => m.id === id));
    if (unknown.length) fail(`--only names unknown metrics: ${unknown.join(", ")}`);
  }
  const wanted = config.metrics.filter((m) => (!opts.only || opts.only.includes(m.id)) && (!opts.stableOnly || m.stable));
  // A metric whose tool exists on one OS only (Valgrind on Linux) is gated where it
  // can be measured, and CI or a Linux machine covers it for everyone else.
  const elsewhere = wanted.filter((m) => m.platforms && !m.platforms.includes(os.platform()));
  if (elsewhere.length) {
    process.stderr.write(`skipped on ${os.platform()}: ${elsewhere.map((m) => `${m.id} (${m.platforms.join(", ")} only)`).join(", ")}\n`);
  }
  return wanted.filter((m) => !elsewhere.includes(m));
}

function tail(text, lines = 20) {
  return text.trim().split(/\r?\n/).slice(-lines).join("\n");
}

function runOnce(command, root) {
  const res = spawnSync(command, { cwd: root, shell: true, encoding: "utf8", maxBuffer: 64 * 2 ** 20 });
  if (res.error) fail(`"${command}" did not start: ${res.error.message}`);
  if (res.status !== 0) fail(`"${command}" exited ${res.status}:\n${tail(res.stderr || res.stdout)}`);
  return res.stdout.trim().split(/\r?\n/).pop()?.trim() ?? "";
}

// Measurement contract: the command's last stdout line is the value, or a JSON
// object when the metric names a "pick" key, so one trace can feed many metrics.
function parseValue(line, metric) {
  if (metric.pick) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      fail(`${metric.id}: "pick" needs a JSON object on the last stdout line, got: ${line}`);
    }
    const value = obj?.[metric.pick];
    if (typeof value !== "number" || !Number.isFinite(value)) fail(`${metric.id}: key "${metric.pick}" is not a finite number in: ${line}`);
    return value;
  }
  const value = line === "" ? NaN : Number(line);
  if (!Number.isFinite(value)) fail(`${metric.id}: last stdout line is not a number: "${line}"`);
  return value;
}

function newRun(root, config) {
  const env = environment(config.profile);
  return { env, bucket: bucketKey(env), ref: gitRef(root), date: new Date().toISOString(), samples: {} };
}

function runFile(root) {
  return path.join(root, ".perf", "runs", "latest.json");
}

function ensureRunsIgnored(root) {
  const ignore = path.join(root, ".perf", ".gitignore");
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, "runs/\n");
}

function measure(root, config, opts) {
  const selected = selectMetrics(config, opts);
  const run = newRun(root, config);
  const groups = new Map();
  for (const metric of selected) {
    if (!metric.command) {
      process.stderr.write(`${metric.id}: no command, feed it with: ratchet.mjs record ${metric.id} <value>...\n`);
      continue;
    }
    if (!groups.has(metric.command)) groups.set(metric.command, []);
    groups.get(metric.command).push(metric);
  }
  for (const [command, metrics] of groups) {
    const runs = Math.max(...metrics.map((m) => m.runs));
    const warmup = Math.max(...metrics.map((m) => m.warmup));
    for (let i = 0; i < warmup + runs; i++) {
      const label = i < warmup ? `warmup ${i + 1}/${warmup}` : `run ${i - warmup + 1}/${runs}`;
      process.stderr.write(`${metrics.map((m) => m.id).join(", ")}: ${label}\n`);
      const line = runOnce(command, root);
      if (i < warmup) continue;
      for (const metric of metrics) (run.samples[metric.id] ??= []).push(parseValue(line, metric));
    }
  }
  ensureRunsIgnored(root);
  writeJson(runFile(root), run);
  process.stdout.write(`Measured ${Object.keys(run.samples).length} metric(s) into .perf/runs/latest.json\n`);
}

function record(root, config, opts) {
  const [id, ...values] = opts.positional;
  const metric = config.metrics.find((m) => m.id === id) ?? fail(`unknown metric "${id}"`);
  if (values.length === 0) fail("record needs at least one value");
  const parsed = values.map((v) => parseValue(v, { ...metric, pick: null }));
  const file = runFile(root);
  const fresh = newRun(root, config);
  const run = fs.existsSync(file) ? readJson(file) : fresh;
  if (run.bucket !== fresh.bucket) fail(`.perf/runs/latest.json was measured on another environment; run measure first`);
  run.samples[metric.id] = [...(run.samples[metric.id] ?? []), ...parsed];
  ensureRunsIgnored(root);
  writeJson(file, run);
  process.stdout.write(`${metric.id}: ${run.samples[metric.id].length} sample(s)\n`);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function noise(xs) {
  if (xs.length < 2) return 0;
  const m = median(xs);
  return MAD_TO_SIGMA * median(xs.map((x) => Math.abs(x - m)));
}

// A difference smaller than the threshold is noise or below what the measurement
// can resolve, so it is neither a verdict nor a speedup worth printing.
function compare(metric, older, current) {
  const threshold = Math.max(
    metric.tolerance * Math.abs(older.median),
    NOISE_SIGMAS * Math.max(older.noise ?? 0, current.noise),
    metric.minDelta,
    metric.resolution,
  );
  const gain = metric.better === "lower" ? older.median - current.median : current.median - older.median;
  const verdict = gain < -threshold ? "regressed" : gain > threshold ? "improved" : "flat";
  return { verdict, threshold, gain };
}

function judge(metric, base, samples) {
  const current = { median: median(samples), noise: noise(samples) };
  if (!base) return { verdict: "new", current, threshold: null, gain: null };
  if (base.unit !== metric.unit || base.better !== metric.better) {
    return { verdict: "reset", current, threshold: null, gain: null };
  }
  return { ...compare(metric, base, current), current };
}

function fmt(x) {
  if (x === null || x === undefined) return "-";
  return Math.abs(x) >= 100 ? x.toFixed(0).replace(/\B(?=(\d{3})+$)/g, ",") : String(Number(x.toPrecision(3)));
}

function fmtRatio(ratio) {
  return `${ratio.toFixed(ratio < 2 ? 2 : ratio < 100 ? 1 : 0)}x`;
}

// "5.9x faster": how many times better the current median is than an older one.
// Null when a ratio would mislead: a zero or negative operand has no multiple.
function speedup(metric, from, to) {
  const [good, bad] = TIME_UNITS.has(metric.unit.toLowerCase()) ? ["faster", "slower"] : metric.better === "lower" ? ["lower", "higher"] : ["higher", "lower"];
  if (from < 0 || to < 0 || from === to) return null;
  if (to === 0) return metric.better === "lower" ? "eliminated" : "dropped to 0";
  if (from === 0) return null;
  const ratio = metric.better === "lower" ? from / to : to / from;
  return ratio >= 1 ? `${fmtRatio(ratio)} ${good}` : `${fmtRatio(1 / ratio)} ${bad}`;
}

function report(rows) {
  const lines = [
    "| Metric | Baseline | Current | Change | Speedup | Since first | Threshold | Verdict |",
    "|--------|----------|---------|--------|---------|-------------|-----------|---------|",
  ];
  for (const { metric, base, result } of rows) {
    const unit = ` ${metric.unit}`;
    let change = "-";
    if (base && result.gain !== null) {
      const delta = result.current.median - base.median;
      const pct = base.median !== 0 ? ` (${delta >= 0 ? "+" : ""}${fmt((delta / Math.abs(base.median)) * 100)}%)` : "";
      change = `${delta >= 0 ? "+" : ""}${fmt(delta)}${unit}${pct}`;
    }
    const baseline = base ? `${fmt(base.median)}${unit}` : "-";
    const current = `${fmt(result.current.median)}${unit} (n=${result.n})`;
    const threshold = result.threshold === null ? "-" : `${fmt(result.threshold)}${unit}`;
    const moved = result.verdict === "improved" || result.verdict === "regressed";
    const versusBase = (moved && speedup(metric, base.median, result.current.median)) || "-";
    // The first value this machine ever recorded for the metric survives every
    // promotion, so the gain of a whole series of changes stays on the report.
    const first = result.gain === null ? null : (base.first ?? base);
    const sinceFirst = (first && compare(metric, first, result.current).verdict !== "flat" && speedup(metric, first.median, result.current.median)) || null;
    const versusFirst = sinceFirst ? `${sinceFirst} (${fmt(first.median)}${unit} at ${first.ref})` : "-";
    lines.push(`| ${metric.id} (${metric.better} is better) | ${baseline} | ${current} | ${change} | ${versusBase} | ${versusFirst} | ${threshold} | ${result.verdict} |`);
  }
  return lines.join("\n");
}

function check(root, config, opts) {
  const selected = selectMetrics(config, opts);
  if (selected.length === 0) fail("no metric matches the selection");
  const run = readJson(runFile(root));
  const fresh = newRun(root, config);
  if (run.bucket !== fresh.bucket) fail(".perf/runs/latest.json was measured on another environment; run measure first");
  const unmeasured = selected.filter((m) => !run.samples[m.id]?.length).map((m) => m.id);
  if (unmeasured.length) fail(`unmeasured: ${unmeasured.join(", ")}; run measure, or record the values by hand`);

  const baselinesFile = path.join(root, ".perf", "baselines.json");
  const baselines = fs.existsSync(baselinesFile) ? readJson(baselinesFile) : { version: 1, buckets: {} };
  const bucketFor = (metric) => (metric.stable ? STABLE_BUCKET : run.bucket);
  const firstOnMachine = selected.some((m) => !m.stable) && !baselines.buckets[run.bucket];
  const rows = selected.map((metric) => {
    const base = baselines.buckets[bucketFor(metric)]?.metrics[metric.id] ?? null;
    const samples = run.samples[metric.id];
    return { metric, base, samples, result: { ...judge(metric, base, samples), n: samples.length } };
  });

  const regressed = rows.filter((r) => r.result.verdict === "regressed");
  const table = report(rows);
  const lines = [table, ""];
  const promotable = rows.filter((r) => ["improved", "new", "reset"].includes(r.result.verdict));
  if (regressed.length) {
    lines.push(`FAIL: ${regressed.map((r) => r.metric.id).join(", ")} regressed. Baselines unchanged.`);
  } else if (promotable.length && opts.promote) {
    for (const { metric, base, samples, result } of promotable) {
      const key = bucketFor(metric);
      const bucket = (baselines.buckets[key] ??= { env: metric.stable ? "machine-independent" : run.env, metrics: {} });
      const entry = { median: result.current.median, noise: result.current.noise, ref: run.ref, date: run.date };
      const previous = base && { median: base.median, noise: base.noise, ref: base.ref, date: base.date };
      bucket.metrics[metric.id] = {
        ...entry,
        unit: metric.unit,
        better: metric.better,
        samples,
        first: result.verdict === "improved" ? (base.first ?? previous) : entry,
      };
    }
    writeJson(baselinesFile, sortKeys(baselines));
    lines.push(`PASS. Promoted to baseline: ${promotable.map((r) => `${r.metric.id} (${r.result.verdict})`).join(", ")}. Commit .perf/baselines.json with this change.`);
  } else {
    lines.push(promotable.length ? "PASS. --no-promote: baselines unchanged." : "PASS. No metric moved past its threshold; baselines unchanged.");
  }
  if (firstOnMachine) lines.push(`No baseline for this machine yet (bucket ${run.bucket}): its machine-bound metrics start here.`);

  const text = lines.join("\n");
  fs.mkdirSync(path.dirname(runFile(root)), { recursive: true });
  fs.writeFileSync(path.join(root, ".perf", "runs", "report.md"), `${text}\n`);
  process.stdout.write(`${text}\n`);
  return regressed.length ? EXIT_REGRESSED : EXIT_PASS;
}

// The target cannot run on this machine (no device, no toolchain): the config and
// the measurement scripts are still owed, so the next machine that can run it
// only has to measure. Writes the report and never a sample or a baseline.
function blocked(root, config, opts) {
  const missing = opts.positional.join(" ").trim();
  if (!missing) fail('blocked needs what is missing, e.g. blocked "no Android device attached"');
  const measureDir = path.join(root, ".perf", "measure");
  const scripts = fs.existsSync(measureDir) ? fs.readdirSync(measureDir) : [];
  if (scripts.length === 0) {
    fail(".perf/measure/ holds no measurement script; write the scripts a machine that can run the target will use (perf-ratchet SKILL.md, Setup step 3)");
  }
  const lines = [
    `No baseline recorded: ${missing}.`,
    "Nothing was measured on this machine, and every fix made without a baseline is unmeasured.",
    "",
    "| Metric | Unit | Fed by |",
    "|--------|------|--------|",
    ...config.metrics.map((m) => `| ${m.id} (${m.better} is better) | ${m.unit} | ${m.command ? `\`${m.command}\`` : `\`ratchet.mjs record ${m.id} <value>...\``} |`),
    "",
    `Measurement scripts: ${scripts.map((name) => `.perf/measure/${name}`).join(", ")}.`,
    "On a machine that can run the target: `node .perf/bin/ratchet.mjs measure`, then `check`.",
  ];
  const text = lines.join("\n");
  ensureRunsIgnored(root);
  fs.mkdirSync(path.dirname(runFile(root)), { recursive: true });
  fs.writeFileSync(path.join(root, ".perf", "runs", "report.md"), `${text}\n`);
  process.stdout.write(`${text}\n`);
}

// Stable key order keeps the committed baselines file diff-friendly.
function sortKeys(value) {
  if (Array.isArray(value) || value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
}

function main(argv) {
  const opts = parseArgs(argv);
  const commands = { measure, record, check, blocked };
  const handler = commands[opts.command];
  if (!handler) fail(`usage: ratchet.mjs <measure|record|check|blocked> [...]; got "${opts.command ?? ""}"`);
  const root = findRoot(process.cwd());
  return handler(root, loadConfig(root), opts) ?? EXIT_PASS;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  if (!(err instanceof RatchetError)) throw err;
  process.stderr.write(`ratchet: ${err.message}\n`);
  process.exitCode = EXIT_ERROR;
}
