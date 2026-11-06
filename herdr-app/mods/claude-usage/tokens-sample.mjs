// The tokens Claude Code spent today, in the plan's week, in the billing month and overall,
// subagents included, read from its transcripts. Only what a transcript gained since the last run
// is read: the ledger beside the reading keeps each message's usage, so a reading costs little
// after the first one. Claude Code deletes old transcripts (cleanupPeriodDays), so the ledger folds
// messages older than every period into `archive`, the only record left of them.
//   node tokens-sample.mjs <file>
import { mkdir, open, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import { dirname, join } from "node:path";

const NEWLINE = 10;
const LEDGER_VERSION = 2;
const WEEK_MS = 7 * 24 * 3600000;
const INPUT = 1;
const OUTPUT = 2;
const CACHE_WRITE = 3;
const CACHE_READ = 4;

const file = process.argv[2];
const ledgerFile = `${file}.ledger`;
const planUsageFile = join(dirname(file), "plan-usage.json");
const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(os.homedir(), ".claude");
const transcriptsDir = join(configDir, "projects");
const accountFile = process.env.CLAUDE_CONFIG_DIR ? join(configDir, ".claude.json") : join(os.homedir(), ".claude.json");

const readJson = (path) => readFile(path, "utf8").then(JSON.parse).catch(() => null);

function mondayOf(now) {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday).getTime();
}

// The plan's week ends at its reset. plan-usage.json can still hold a reset already past.
function planWeekStart(planUsage, now) {
  const resetsAt = planUsage?.windows?.find((w) => w.kind === "week")?.resetsAt;
  if (!resetsAt) return mondayOf(now);
  const elapsedWeeks = Math.floor((now.getTime() - resetsAt * 1000) / WEEK_MS);
  return resetsAt * 1000 + elapsedWeeks * WEEK_MS;
}

function billingDateIn(anchor, year, month) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay), anchor.getUTCHours(), anchor.getUTCMinutes());
}

// The month renews on the day of the month the subscription started.
function billingMonthStart(subscribedAt, now) {
  const anchor = new Date(subscribedAt);
  if (Number.isNaN(anchor.getTime())) return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = billingDateIn(anchor, now.getUTCFullYear(), now.getUTCMonth());
  return thisMonth <= now.getTime() ? thisMonth : billingDateIn(anchor, now.getUTCFullYear(), now.getUTCMonth() - 1);
}

function periodStarts(now, planUsage, subscribedAt) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const week = planWeekStart(planUsage, now);
  const month = billingMonthStart(subscribedAt, now);
  return { today, week, month, oldest: Math.min(today, week, month) };
}

async function transcriptPaths() {
  const entries = await readdir(transcriptsDir, { recursive: true, withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(".jsonl")).map((e) => join(e.parentPath, e.name));
}

// The line still being written stays for the next run: only whole lines are consumed.
async function readWholeLines(path, offset, size) {
  const handle = await open(path, "r");
  try {
    const bytes = Buffer.alloc(size - offset);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, offset);
    const end = bytes.lastIndexOf(NEWLINE, bytesRead - 1) + 1;
    return { lines: bytes.toString("utf8", 0, end).split("\n"), consumed: end };
  } finally {
    await handle.close();
  }
}

function usageOf(line) {
  if (!line.includes('"usage"')) return null;
  try {
    const entry = JSON.parse(line);
    return entry.type === "assistant" && entry.message?.id && entry.message.usage ? entry : null;
  } catch {
    return null;
  }
}

// A message repeats once per content block, and its counts can grow between repeats.
function recordMessage(ledger, entry) {
  const at = Date.parse(entry.timestamp);
  if (!(at >= ledger.foldedBefore)) return;
  const usage = entry.message.usage;
  const counts = [usage.input_tokens, usage.output_tokens, usage.cache_creation_input_tokens, usage.cache_read_input_tokens];
  const known = ledger.messages[entry.message.id] ?? [at, 0, 0, 0, 0];
  ledger.messages[entry.message.id] = [known[0], ...counts.map((count, i) => Math.max(count ?? 0, known[i + 1]))];
}

async function readNewLines(ledger, paths) {
  const offsets = {};
  let hasNewLines = false;
  for (const path of paths) {
    const info = await stat(path).catch(() => null);
    if (!info) continue;
    const known = ledger.offsets[path] ?? 0;
    // A shorter file was rewritten; re-reading it is safe because messages are keyed by id.
    const offset = known > info.size ? 0 : known;
    const isAlreadyFolded = info.mtimeMs < ledger.foldedBefore;
    if (offset === info.size || isAlreadyFolded) {
      offsets[path] = info.size;
      continue;
    }
    const read = await readWholeLines(path, offset, info.size).catch(() => null);
    if (!read) continue;
    offsets[path] = offset + read.consumed;
    hasNewLines ||= read.consumed > 0;
    for (const line of read.lines) {
      const entry = usageOf(line);
      if (entry) recordMessage(ledger, entry);
    }
  }
  return { offsets, hasNewLines };
}

function foldOldMessages(ledger, before) {
  const kept = Object.entries(ledger.messages).filter(([, message]) => {
    if (message[0] >= before) return true;
    ledger.archive.firstAt = Math.min(ledger.archive.firstAt ?? message[0], message[0]);
    ledger.archive.input += message[INPUT];
    ledger.archive.output += message[OUTPUT];
    ledger.archive.cacheWrite += message[CACHE_WRITE];
    ledger.archive.cacheRead += message[CACHE_READ];
    return false;
  });
  ledger.messages = Object.fromEntries(kept);
  ledger.foldedBefore = before;
}

function totalSince(messages, since, base = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }) {
  const inPeriod = messages.filter((message) => message[0] >= since);
  const sum = (field) => inPeriod.reduce((total, message) => total + message[field], 0);
  const period = {
    input: base.input + sum(INPUT),
    output: base.output + sum(OUTPUT),
    cacheWrite: base.cacheWrite + sum(CACHE_WRITE),
    cacheRead: base.cacheRead + sum(CACHE_READ),
  };
  return { since, tokens: period.input + period.output + period.cacheWrite + period.cacheRead, ...period };
}

const firstMessageAt = (ledger, messages) => messages.reduce((first, message) => Math.min(first, message[0]), ledger.archive.firstAt ?? Date.now());

async function writeWhole(path, text) {
  const temporary = `${path}.${process.pid}`;
  await writeFile(temporary, text);
  await rename(temporary, path);
}

const emptyLedger = () => ({
  version: LEDGER_VERSION,
  offsets: {},
  messages: {},
  foldedBefore: 0,
  archive: { firstAt: null, input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
});

const now = new Date();
const account = await readJson(accountFile);
const starts = periodStarts(now, await readJson(planUsageFile), account?.oauthAccount?.subscriptionCreatedAt);
const stored = await readJson(ledgerFile);
const isCurrentLedger = stored?.version === LEDGER_VERSION;
const ledger = isCurrentLedger ? stored : emptyLedger();
const { offsets, hasNewLines } = await readNewLines(ledger, await transcriptPaths());
ledger.offsets = offsets;
const shouldFold = starts.oldest > ledger.foldedBefore;
if (shouldFold) foldOldMessages(ledger, starts.oldest);
const messages = Object.values(ledger.messages);
const reading = JSON.stringify({
  today: totalSince(messages, starts.today),
  week: totalSince(messages, starts.week),
  month: totalSince(messages, starts.month),
  allTime: { ...totalSince(messages, 0, ledger.archive), since: firstMessageAt(ledger, messages) },
  checkedAt: Date.now(),
});
await mkdir(dirname(file), { recursive: true });
if (hasNewLines || shouldFold || !isCurrentLedger) await writeWhole(ledgerFile, JSON.stringify(ledger));
await writeWhole(file, reading);
process.stdout.write(reading);
