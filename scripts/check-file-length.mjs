#!/usr/bin/env node
// Ratchet for the 500-line ceiling in CODING_STANDARDS.md ("Decompose past 500 lines").
// Every tracked text file stays at or under 500 lines, except the files listed in
// scripts/file-length-baseline.tsv, which may not grow past their recorded count.
// A listed file that shrank fails too until its line is lowered (or removed once at 500 or under),
// so the list only ever tightens: run with --update to rewrite it, which never raises a count.
// Skipped: lockfiles, binary files, and the dirs UPSTREAMS.tsv marks as vendored
// (a skill target is skills/<name>/, a ./path target is that path; ./skills watch rows and
// owner/name downstream repos vendor nothing here).
// Run from the repo root: node scripts/check-file-length.mjs [--update]
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const LIMIT = 500;
const BASELINE = "scripts/file-length-baseline.tsv";
const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|uv\.lock|Gemfile\.lock|go\.sum)$/;

function readTsv(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => l.split("\t"));
}

const vendored = readTsv("skills/UPSTREAMS.tsv")
  .map(([target]) => target)
  .filter((t) => t && t !== "./skills" && (t.startsWith("./") || !t.includes("/")))
  .map((t) => (t.startsWith("./") ? t.slice(2) : `skills/${t}`).replace(/\/?$/, "/"));

function countLines(file) {
  const buf = fs.readFileSync(file);
  if (buf.includes(0)) return null;
  const text = buf.toString("utf8");
  if (!text) return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const sizes = new Map();
for (const file of tracked) {
  if (LOCKFILE.test(file) || vendored.some((dir) => file.startsWith(dir)) || !fs.existsSync(file)) continue;
  const lines = countLines(file);
  if (lines !== null) sizes.set(file, lines);
}

const baseline = new Map(readTsv(BASELINE).map(([file, lines]) => [file, Number(lines)]));
const problems = [];
for (const [file, lines] of sizes) {
  const recorded = baseline.get(file);
  if (recorded === undefined && lines > LIMIT) problems.push(`${file}: ${lines} lines, over the ${LIMIT}-line limit; split it before adding to it`);
  if (recorded !== undefined && lines > recorded) problems.push(`${file}: grew to ${lines} lines, past its recorded ${recorded}; split it instead of growing it`);
  if (recorded !== undefined && lines < recorded) problems.push(`${file}: shrank to ${lines} lines; lower its count in ${BASELINE} (--update does it)`);
}
for (const file of baseline.keys()) {
  if (!sizes.has(file)) problems.push(`${file}: listed in ${BASELINE} but no longer tracked or now skipped; remove its line (--update does it)`);
}

if (process.argv.includes("--update")) {
  const growth = problems.filter((p) => !p.includes("--update"));
  if (growth.length) {
    console.error(`not updating ${BASELINE}: a count would rise or a new file is over the limit\n${growth.join("\n")}`);
    process.exit(1);
  }
  const rows = [...baseline.keys()].filter((f) => sizes.has(f) && sizes.get(f) > LIMIT).sort().map((f) => `${f}\t${sizes.get(f)}`);
  const header = fs.readFileSync(BASELINE, "utf8").split(/\r?\n/).filter((l) => l.startsWith("#"));
  fs.writeFileSync(BASELINE, [...header, ...rows].join("\n") + "\n");
  console.log(`${BASELINE}: ${rows.length} file(s) over ${LIMIT} lines`);
  process.exit(0);
}

for (const p of problems) console.log(p);
console.log(`check-file-length: ${sizes.size} files checked, ${baseline.size} grandfathered, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
