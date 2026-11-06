// Writes what ~/.claude/hooks/statusline.ps1 writes for Claude Code, for an OpenCode session: the
// context reading, its tally, and a transcript in the shape ctxmap/analyze.mjs reads. OpenCode's
// plugins run in one background service with no terminal of their own, so the session is found
// from the outside: the title the terminal shows, and its folder.
//   node opencode-sample.mjs <terminal> <terminal title> <cwd>
import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.XDG_DATA_HOME ?? join(os.homedir(), ".local", "share");
const DB_FILE = join(DATA_DIR, "opencode", "opencode.db");
const MODELS_FILE = join(os.homedir(), ".cache", "opencode", "models.json");
const STATE_DIR = join(os.homedir(), ".claude", "state", "ctx");
const DEFAULT_WINDOW = 200000;
// The same limits as statusline.ps1: a hard cap at 40% of the window, a softer session target.
const CAP_SHARE = 0.4;
const SOFT_TOKENS = 120000;
const EDGE_PCT = 85;
const USAGE_WINDOW_MS = 7 * 24 * 3600000;

function sameFolder(a, b) {
  const real = (p) => {
    try {
      return realpathSync.native(p).toLowerCase();
    } catch {
      return p.replace(/\\/g, "/").toLowerCase();
    }
  };
  return real(a) === real(b);
}

function findSession(db, title, cwd) {
  const named = db.prepare("SELECT * FROM session_v2 WHERE parent_id IS NULL AND title = ? ORDER BY time_updated DESC").all(title);
  return named.find((s) => sameFolder(s.directory, cwd)) ?? null;
}

// Subagents' sessions count too: they spend tokens like any other.
function recentUsage(db) {
  const since = Date.now() - USAGE_WINDOW_MS;
  const { tokens, cost } = db.prepare(`SELECT
    SUM(tokens_input + tokens_output + tokens_reasoning + tokens_cache_read + tokens_cache_write) AS tokens,
    SUM(cost) AS cost
    FROM session_v2 WHERE time_updated >= ?`).get(since);
  return { tokens: tokens ?? 0, cost: cost ?? 0, at: Date.now() };
}

function windowOf(model) {
  if (!model) return DEFAULT_WINDOW;
  try {
    const { id, providerID } = JSON.parse(model);
    const catalog = JSON.parse(readFileSync(MODELS_FILE, "utf8"));
    return catalog[providerID]?.models?.[id]?.limit?.context ?? DEFAULT_WINDOW;
  } catch {
    return DEFAULT_WINDOW;
  }
}

function zoneOf(total, cap, soft) {
  if (total >= cap) return "DUMB";
  if ((100 * total) / cap >= EDGE_PCT) return "EDGE";
  if (soft < cap && total >= soft) return "CODE";
  return "SMART";
}

const usageOf = (t) => ({
  input_tokens: t.input,
  cache_read_input_tokens: t.cache.read,
  cache_creation_input_tokens: t.cache.write,
  output_tokens: t.output + t.reasoning,
  output_tokens_details: { thinking_tokens: t.reasoning },
});

function assistantEntries(row, data) {
  const parts = data.content ?? [];
  const calls = parts.filter((part) => part.type === "tool");
  const content = parts.flatMap((part) => {
    if (part.type === "text") return [{ type: "text", text: part.text }];
    if (part.type === "tool") return [{ type: "tool_use", id: part.id, name: part.name, input: part.state?.input ?? {} }];
    return [];
  });
  const assistant = { type: "assistant", message: { id: row.id, usage: usageOf(data.tokens), content } };
  if (!calls.length) return [assistant];
  const results = calls.map((part) => ({ type: "tool_result", tool_use_id: part.id, content: part.state?.content ?? part.state?.error ?? "" }));
  return [assistant, { type: "user", message: { content: results } }];
}

function transcriptEntries(rows) {
  return rows.flatMap((row) => {
    const data = JSON.parse(row.data);
    if (row.type === "user") return [{ type: "user", message: { content: data.text ?? "" } }];
    if (row.type === "system" || row.type === "synthetic") return [{ type: "user", isMeta: true, message: { content: data.text ?? "" } }];
    return row.type === "assistant" && data.tokens ? assistantEntries(row, data) : [];
  });
}

function writeWhole(file, text) {
  const partial = `${file}.${process.pid}.tmp`;
  writeFileSync(partial, text);
  renameSync(partial, file);
}

const [terminal, shownTitle, cwd] = process.argv.slice(2);
if (!terminal || !shownTitle || !cwd) process.exit(0);

const db = new DatabaseSync(DB_FILE, { readOnly: true });
const session = findSession(db, shownTitle.replace(/^OC \| /, ""), cwd);
if (!session) process.exit(0);
const rows = db.prepare("SELECT id, type, data FROM session_message WHERE session_id = ? ORDER BY seq").all(session.id);
const usage = recentUsage(db);
db.close();

const last = rows.findLast((row) => row.type === "assistant" && JSON.parse(row.data).tokens);
if (!last) process.exit(0);
const { tokens } = JSON.parse(last.data);
const total = tokens.input + tokens.cache.read + tokens.cache.write;
const window = windowOf(session.model);
const cap = Math.round(CAP_SHARE * window);

const transcriptDir = join(STATE_DIR, "opencode");
mkdirSync(transcriptDir, { recursive: true });
const transcript = join(transcriptDir, `${session.id}.jsonl`);
writeWhole(transcript, `${transcriptEntries(rows).map((entry) => JSON.stringify(entry)).join("\n")}\n`);
writeWhole(join(transcriptDir, "usage.json"), JSON.stringify(usage));
writeWhole(join(STATE_DIR, `${terminal}.tally.json`), JSON.stringify({ transcript }));
writeWhole(join(STATE_DIR, `${terminal}.json`), JSON.stringify({
  agent: "opencode",
  zone: zoneOf(total, cap, SOFT_TOKENS),
  soft: SOFT_TOKENS,
  cap,
  pct_cap: Math.round((1000 * total) / cap) / 10,
  total,
  window,
  background: 0,
  session: {
    input: session.tokens_input,
    cache_write: session.tokens_cache_write,
    cache_read: session.tokens_cache_read,
    output: session.tokens_output + session.tokens_reasoning,
    cost_usd: session.cost,
  },
  at: session.time_updated,
}));
