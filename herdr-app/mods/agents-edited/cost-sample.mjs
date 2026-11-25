// What each Claude Code session cost at API prices, subagents included, for the Cost panel. A
// session is one task. Headless runs (claude -p) are left out: they are steps of other work.
// Only what a transcript gained since the last run is read, and the ledger beside the reading keeps
// every session's total, so the history outlives Claude Code's transcript cleanup.
//   node cost-sample.mjs <file>
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { messageCost } from "./cost-prices.mjs";

const LEDGER_VERSION = 1;
const DAY_MS = 24 * 3600000;
const NEWLINE = 10;
// A message repeats once per content block and its counts can grow; a resumed or forked session
// copies older messages. Past this age a message counts in its session's total and a copy is ignored.
const FOLD_AFTER_MS = 2 * DAY_MS;
// The panel draws 30 days of 7-day windows.
const SHOWN_MS = 38 * DAY_MS;
const HEADLESS = /^sdk-/;
const SYNTHETIC = "<synthetic>";

const file = process.argv[2];
const ledgerFile = `${file}.ledger`;
const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(os.homedir(), ".claude");
const transcriptsDir = join(configDir, "projects");

const emptyLedger = () => ({ version: LEDGER_VERSION, offsets: {}, messages: {}, sessions: {}, repos: {}, foldedBefore: 0 });

async function readLedger() {
  const stored = await readFile(ledgerFile, "utf8").then(JSON.parse).catch(() => null);
  return stored?.version === LEDGER_VERSION ? stored : emptyLedger();
}

// Oldest first, so a message that several sessions hold counts in the one it was written in.
async function transcripts() {
  const entries = await readdir(transcriptsDir, { recursive: true, withFileTypes: true });
  const paths = entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl")).map((e) => join(e.parentPath, e.name));
  const found = await Promise.all(paths.map(async (path) => {
    const info = await stat(path).catch(() => null);
    return info && { path, size: info.size, createdMs: info.birthtimeMs };
  }));
  return found.filter(Boolean).sort((a, b) => a.createdMs - b.createdMs);
}

// Calls onLine for each whole line from offset and returns where the next run starts: a line still
// being written stays for it.
async function eachNewLine(path, offset, size, onLine) {
  let rest = Buffer.alloc(0);
  let consumed = offset;
  for await (const chunk of createReadStream(path, { start: offset, end: size - 1 })) {
    const bytes = rest.length ? Buffer.concat([rest, chunk]) : chunk;
    const end = bytes.lastIndexOf(NEWLINE) + 1;
    if (end) bytes.toString("utf8", 0, end).split("\n").forEach(onLine);
    consumed += end;
    rest = bytes.subarray(end);
  }
  return consumed;
}

function assistantEntry(line) {
  if (!line.includes('"usage"')) return null;
  try {
    const entry = JSON.parse(line);
    const isMessage = entry.type === "assistant" && entry.message?.id && entry.message.usage && entry.sessionId;
    return isMessage && entry.message.model !== SYNTHETIC ? entry : null;
  } catch {
    return null;
  }
}

function sessionOf(ledger, entry) {
  ledger.sessions[entry.sessionId] ??= { cost: 0, endAt: 0, cwd: entry.cwd ?? "", isHeadless: false, isUnpriced: false };
  return ledger.sessions[entry.sessionId];
}

function recordMessage(ledger, entry) {
  const at = Date.parse(entry.timestamp);
  if (!(at >= ledger.foldedBefore)) return;
  const { id, model, usage } = entry.message;
  const cost = messageCost(model, usage);
  const known = ledger.messages[id];
  const session = sessionOf(ledger, entry);
  if (HEADLESS.test(entry.entrypoint ?? "")) session.isHeadless = true;
  if (cost === null) session.isUnpriced = true;
  ledger.messages[id] = known ? { ...known, cost: Math.max(known.cost, cost ?? 0) } : { session: entry.sessionId, at, cost: cost ?? 0 };
}

async function readNewLines(ledger) {
  const offsets = {};
  for (const { path, size } of await transcripts()) {
    const known = ledger.offsets[path] ?? 0;
    // A shorter file was rewritten; re-reading it is safe because messages are keyed by id.
    const offset = known > size ? 0 : known;
    offsets[path] = offset === size ? size : await eachNewLine(path, offset, size, (line) => {
      const entry = assistantEntry(line);
      if (entry) recordMessage(ledger, entry);
    }).catch(() => offset);
  }
  ledger.offsets = offsets;
}

function foldOldMessages(ledger, before) {
  for (const [id, message] of Object.entries(ledger.messages)) {
    if (message.at >= before) continue;
    const session = ledger.sessions[message.session];
    session.cost += message.cost;
    session.endAt = Math.max(session.endAt, message.at);
    delete ledger.messages[id];
  }
  ledger.foldedBefore = Math.max(ledger.foldedBefore, before);
}

// The repository a worktree belongs to: its .git is a file naming <repo>/.git/worktrees/<name>.
function repoOfGitFile(folder, gitFile) {
  const gitDir = readFileSync(gitFile, "utf8").match(/^gitdir:\s*(.+?)\s*$/m)?.[1];
  const common = gitDir && resolve(folder, gitDir).split(/[\\/]\.git[\\/]worktrees[\\/]/);
  return common?.length === 2 ? common[0] : folder;
}

function gitRepoOf(cwd) {
  for (let folder = cwd; ; folder = dirname(folder)) {
    const git = join(folder, ".git");
    if (existsSync(git)) return statSync(git).isDirectory() ? folder : repoOfGitFile(folder, git);
    if (dirname(folder) === folder) return null;
  }
}

const isInside = (folder, parent) => folder.toLowerCase().startsWith(`${parent.toLowerCase()}\\`) || folder.toLowerCase().startsWith(`${parent.toLowerCase()}/`);

// Remembered, so a worktree keeps its repository after it is removed.
function rememberRepos(ledger) {
  const homeDir = os.homedir();
  for (const { cwd } of Object.values(ledger.sessions)) {
    if (!cwd || ledger.repos[cwd] || !existsSync(cwd)) continue;
    const repo = gitRepoOf(cwd);
    if (repo && repo !== homeDir) ledger.repos[cwd] = repo;
  }
}

// A removed worktree nobody measured while it lived sits beside its repository as <repo>-<name>.
function repoOf(ledger, cwd, knownRepos) {
  if (ledger.repos[cwd]) return basename(ledger.repos[cwd]);
  if (isInside(cwd, os.tmpdir())) return "Temp";
  if (existsSync(cwd)) return basename(cwd);
  const lower = cwd.toLowerCase();
  const owner = knownRepos.find((repo) => isInside(cwd, repo) || lower.startsWith(`${repo.toLowerCase()}-`));
  return basename(owner ?? cwd);
}

function sessionTotals(ledger) {
  const totals = new Map(Object.entries(ledger.sessions).map(([id, s]) => [id, { ...s }]));
  for (const message of Object.values(ledger.messages)) {
    const total = totals.get(message.session);
    total.cost += message.cost;
    total.endAt = Math.max(total.endAt, message.at);
  }
  return [...totals.values()];
}

function tasksOf(ledger, since) {
  const knownRepos = [...new Set(Object.values(ledger.repos))].sort((a, b) => b.length - a.length);
  return sessionTotals(ledger)
    .filter((s) => !s.isHeadless && s.endAt >= since && (s.cost > 0 || s.isUnpriced))
    .map((s) => ({ cost: s.isUnpriced ? null : Math.round(s.cost * 1e4) / 1e4, endAt: s.endAt, repo: repoOf(ledger, s.cwd, knownRepos) }))
    .sort((a, b) => a.endAt - b.endAt);
}

async function writeWhole(path, text) {
  const temporary = `${path}.${process.pid}`;
  await writeFile(temporary, text);
  await rename(temporary, path);
}

const now = Date.now();
const ledger = await readLedger();
await readNewLines(ledger);
foldOldMessages(ledger, now - FOLD_AFTER_MS);
rememberRepos(ledger);
const reading = JSON.stringify({ tasks: tasksOf(ledger, now - SHOWN_MS), checkedAt: now });
await mkdir(dirname(file), { recursive: true });
await writeWhole(ledgerFile, JSON.stringify(ledger));
await writeWhole(file, reading);
process.stdout.write(reading);
