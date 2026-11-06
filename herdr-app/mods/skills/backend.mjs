// What the Skills panel reads and changes outside the app, in Node so it behaves the same on
// every machine. Run from the mod with exec; each command prints one JSON object on stdout.
//
//   node backend.mjs status                     the skills, their copies and the repo's git state
//   node backend.mjs scan                       starts a detached scan and returns at once
//   node backend.mjs scan-if-due                the same, when the last scan is old enough
//   node backend.mjs pin <target> <repo> <path> <sha>   marks a source reviewed up to <sha>
//   node backend.mjs sync <skill>...            replaces the skills' installed copies
//
// A scan outlives exec's 30 s limit, so it runs detached and leaves its result in STATE, which
// the panel watches. skills/UPSTREAMS.tsv and scripts/check-upstreams.sh stay the source of
// truth for what is tracked and how a source counts as changed.

import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const REPO = process.env.SKILLS_REPO ?? join(homedir(), "Desktop", "agent-dotfiles");
const SOURCE = join(REPO, "skills");
const MANIFEST = join(SOURCE, "UPSTREAMS.tsv");
const TARGETS = { claude: join(homedir(), ".claude", "skills"), agents: join(homedir(), ".agents", "skills") };
const STATE = join(homedir(), ".claude", "state", "skills");
const SCAN_FILE = join(STATE, "scan.json");
const PROGRESS_FILE = join(STATE, "progress.json");
const LOCK_FILE = join(STATE, "scan.lock");
// Windows can resolve a bare "bash" to WSL's before Git's.
const GIT_BASH = "C:\\Program Files\\Git\\bin\\bash.exe";
const BASH = existsSync(GIT_BASH) ? GIT_BASH : "bash";
const DESCRIPTION_CHARS = 200;
const SCAN_EVERY_MS = 12 * 60 * 60 * 1000;

function writeAtomically(path, value) {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value));
  renameSync(temp, path);
}

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

// One row per tracked source; comments and blank lines are not rows.
function manifestRows() {
  return readFileSync(MANIFEST, "utf8").split("\n").map((line) => line.replace(/\r$/, ""))
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [target, repo, path, pin, branch] = line.split("\t");
      return { target, repo, path, pin, branch: branch || null };
    });
}

const skillNames = (dir) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [])
  .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "SKILL.md"))).map((e) => e.name);

function filesUnder(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const relative = prefix ? `${prefix}/${e.name}` : e.name;
    return e.isDirectory() ? filesUnder(join(dir, e.name), relative) : [relative];
  });
}

function sameFiles(a, b) {
  const files = filesUnder(a).sort();
  const others = filesUnder(b).sort();
  if (files.length !== others.length || files.some((f, i) => f !== others[i])) return false;
  return files.every((f) => statSync(join(a, f)).size === statSync(join(b, f)).size && readFileSync(join(a, f)).equals(readFileSync(join(b, f))));
}

function descriptionOf(dir) {
  const lines = readFileSync(join(dir, "SKILL.md"), "utf8").split(/\r?\n/);
  const at = lines.findIndex((l) => l.startsWith("description:"));
  if (at < 0) return "";
  const inline = lines[at].slice("description:".length).trim();
  const text = /^[>|]/.test(inline) ? (lines[at + 1] ?? "").trim() : inline;
  return text.replace(/^["']|["']$/g, "").slice(0, DESCRIPTION_CHARS);
}

function copyState(source, target) {
  if (!existsSync(target)) return "missing";
  return sameFiles(source, target) ? "same" : "differs";
}

function gitState() {
  try {
    const lines = execFileSync("git", ["status", "--porcelain=v1", "--branch"], { cwd: REPO, encoding: "utf8", windowsHide: true }).trim().split("\n");
    const head = lines[0] ?? "";
    return {
      branch: head.match(/^## (?:No commits yet on )?([^.\s]+)/)?.[1] ?? "",
      ahead: Number(head.match(/ahead (\d+)/)?.[1] ?? 0),
      behind: Number(head.match(/behind (\d+)/)?.[1] ?? 0),
      uncommitted: lines.length - 1,
    };
  } catch {
    return null;
  }
}

function status() {
  const rows = manifestRows();
  const owned = skillNames(SOURCE).map((name) => {
    const dir = join(SOURCE, name);
    const copies = Object.fromEntries(Object.entries(TARGETS).map(([key, target]) => [key, copyState(dir, join(target, name))]));
    const inSync = Object.values(copies).every((c) => c === "same");
    return { name, description: descriptionOf(dir), state: inSync ? "synced" : "drift", copies, upstreams: rows.filter((r) => r.target === name) };
  });
  const ownedNames = new Set(owned.map((s) => s.name));
  const installed = new Map();
  for (const [key, target] of Object.entries(TARGETS)) {
    for (const name of skillNames(target)) {
      if (ownedNames.has(name)) continue;
      installed.set(name, { name, description: descriptionOf(join(target, name)), state: "local", copies: { ...installed.get(name)?.copies, [key]: "same" }, upstreams: [] });
    }
  }
  return { repo: REPO, sources: rows.length, skills: [...owned, ...installed.values()], git: gitState() };
}

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const scanIsRunning = () => {
  const pid = Number(existsSync(LOCK_FILE) ? readFileSync(LOCK_FILE, "utf8") : 0);
  return pid > 0 && isAlive(pid);
};

function startScan() {
  mkdirSync(STATE, { recursive: true });
  if (scanIsRunning()) return { started: false };
  const env = { ...process.env };
  delete env.HC_SCOPE; // Herdr hangs up programs that still carry their exec's scope.
  spawn(process.execPath, [fileURLToPath(import.meta.url), "scan-worker"], { detached: true, stdio: "ignore", env, windowsHide: true }).unref();
  return { started: true };
}

// An unreadable scan file is not a missing one: it says nothing about how old the scan is.
function startScanIfDue() {
  if (!existsSync(SCAN_FILE)) return startScan();
  const scan = readJson(SCAN_FILE);
  return scan && !(Date.now() - scan.at < SCAN_EVERY_MS) ? startScan() : { started: false };
}

function holdScanLock() {
  if (scanIsRunning()) return false;
  rmSync(LOCK_FILE, { force: true });
  try {
    writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
    return true;
  } catch {
    return false; // Another window's scan took it first.
  }
}

// Applies one line of `check-upstreams.sh --tsv` to the result being built.
function readScanLine(line, scan) {
  const [kind, ...f] = line.split("\t");
  if (kind === "row") scan.done += 1;
  if (kind === "error") scan.errors.push({ target: f[0], source: f[1], reason: f[2] });
  if (kind === "commit") scan.changed.at(-1).commits.push({ sha: f[0], date: f[1], subject: f.slice(2).join("\t") });
  if (kind === "changed") {
    const [target, repo, path, pin, latest, count, compare] = f;
    scan.changed.push({ target, repo, path, pin, latest, count: Number(count), compare, commits: [] });
  }
  return kind === "row";
}

function scanWorker() {
  mkdirSync(STATE, { recursive: true });
  if (!holdScanLock()) return;
  const total = manifestRows().length;
  const scan = { done: 0, changed: [], errors: [] };
  const finish = (failure) => {
    const result = failure ? { ...readJson(SCAN_FILE), failure } : { at: Date.now(), checked: scan.done, changed: scan.changed, errors: scan.errors, failure: null };
    writeAtomically(SCAN_FILE, result);
    rmSync(PROGRESS_FILE, { force: true });
    rmSync(LOCK_FILE, { force: true });
  };
  writeAtomically(PROGRESS_FILE, { done: 0, total });
  const script = spawn(BASH, [join(REPO, "scripts", "check-upstreams.sh"), "--tsv"], { cwd: REPO, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  script.stderr.on("data", (chunk) => { stderr += chunk; });
  createInterface({ input: script.stdout }).on("line", (line) => {
    if (readScanLine(line, scan)) writeAtomically(PROGRESS_FILE, { done: scan.done, total });
  });
  script.on("error", (err) => finish(String(err.message)));
  // 0 current, 2 changed, 1 some rows could not be checked: all three are a finished scan.
  script.on("close", (code) => finish(code === 0 || code === 1 || code === 2 ? null : stderr.trim().split("\n").pop() || `check-upstreams exited with ${code}`));
}

function pinSource(target, repo, path, sha) {
  if (!/^[0-9a-f]{7,40}$/.test(sha ?? "")) throw new Error(`Not a commit: ${sha}`);
  let moved = false;
  const lines = readFileSync(MANIFEST, "utf8").split("\n").map((line) => {
    const fields = line.split("\t");
    if (fields[0] !== target || fields[1] !== repo || fields[2] !== path) return line;
    moved = true;
    fields[3] = fields.length === 4 && line.endsWith("\r") ? `${sha}\r` : sha;
    return fields.join("\t");
  });
  if (!moved) throw new Error(`No row for ${target} ${repo} ${path}`);
  writeFileSync(MANIFEST, lines.join("\n"));
  const scan = readJson(SCAN_FILE);
  if (scan) writeAtomically(SCAN_FILE, { ...scan, changed: scan.changed.filter((c) => !(c.target === target && c.repo === repo && c.path === path)) });
  return { moved };
}

// The same per-skill replace as Sync-Skills in scripts/sync-config.ps1, limited to these skills.
function syncSkills(names) {
  const known = new Set(skillNames(SOURCE));
  const unknown = names.filter((name) => !known.has(name));
  if (unknown.length) throw new Error(`Not in skills/: ${unknown.join(", ")}`);
  for (const name of names) {
    for (const target of Object.values(TARGETS)) {
      rmSync(join(target, name), { recursive: true, force: true });
      cpSync(join(SOURCE, name), join(target, name), { recursive: true });
    }
  }
  return { synced: names.length };
}

const COMMANDS = {
  status,
  scan: startScan,
  "scan-if-due": startScanIfDue,
  "scan-worker": scanWorker,
  pin: pinSource,
  sync: (...names) => syncSkills(names),
};

const [command, ...args] = process.argv.slice(2);
try {
  if (!COMMANDS[command]) throw new Error(`Unknown command: ${command}`);
  const result = COMMANDS[command](...args);
  if (result) process.stdout.write(JSON.stringify(result));
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err?.message ?? err) }));
  process.exitCode = 1;
}
