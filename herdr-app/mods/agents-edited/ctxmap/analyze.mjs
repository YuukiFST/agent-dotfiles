// What fills a Claude Code session's context window, read from its transcript.
//
//   node analyze.mjs <transcript.jsonl>   prints one JSON object on stdout
//
// Measured, not guessed: every API call reports its whole input (input + cache read +
// cache write). Between two calls the input grows by exactly the previous call's output
// plus whatever was added after it (tool results, hooks, prompts). So each response is
// sized by its own output_tokens (thinking by thinking_tokens), and each gap's additions by
// delta - previous output. Only when one gap holds several pieces is that gap's measured
// total shared by their characters. The first call's input (system prompt, tool schemas,
// CLAUDE.md, listings) arrives as one block, so its split is estimated by characters and
// flagged `exact: false`, unless the context-meter Claude mod has written the session's counted
// breakdown (~/.claude/state/ctx/meter/<session>.json). That replaces the estimate, except for
// its Messages row: /context reconciles that row to the API's total, so it also holds the
// built-in tools it calls deferred (removing one from a request drops the total by that row).
// Those count as tool schemas; what neither source explains stays visible as Untracked.
// The transcript format is Claude Code's own; unknown entries are ignored.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const CHARS_PER_TOKEN = 3.7;
const TOP_ITEMS = 200;
// The API's own estimate for an image whose size the transcript does not keep.
const IMAGE_TOKENS = 1600;

// Attachments that never reach the model: bookkeeping, and tool hooks' raw output.
const SKIPPED_ATTACHMENTS = new Set(["prompt_snapshot", "deferred_tools_record", "hook_cancelled", "command_permissions", "credential_org", "remote_session_change"]);
const LISTING_ATTACHMENTS = {
  skill_listing: "Skill listing",
  agent_listing_delta: "Subagent types",
  deferred_tools_delta: "Deferred tool names",
  mcp_instructions_delta: "MCP server instructions",
  output_style_instructions: "Output style",
};
const REMINDER_NAMES = {
  file: "Attached files (@)",
  invoked_skills: "Invoked skills",
  edited_text_file: "Edited file snippets",
  output_style: "Output style reminder",
  environment: "Environment",
  session_context: "Session context",
  silent_turn_reminder: "Turn reminder",
  date: "Date",
  language: "Language",
  model: "Model",
  auto_mode: "Auto mode",
};

export const CATEGORIES = [
  ["system", "System prompt"],
  ["tools", "Tool schemas"],
  ["memory", "Memory (CLAUDE.md)"],
  ["listings", "Skills, agents, MCP"],
  ["reminders", "Reminders & hooks"],
  ["prompts", "Your prompts"],
  ["summary", "Compaction summary"],
  ["text", "Responses"],
  ["thinking", "Thinking"],
  ["calls", "Tool calls"],
  ["results", "Tool results"],
  ["other", "Untracked"],
];

const size = (v) => (v == null ? 0 : typeof v === "string" ? v.length : JSON.stringify(v).length);
const short = (s, n = 48) => {
  const one = String(s ?? "").replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};
const baseName = (p) => String(p ?? "").split(/[\\/]/).pop();
const inputOf = (u) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);

// A tool result or message body, as characters (images count as their tokens' worth).
function contentChars(content) {
  if (!Array.isArray(content)) return size(content);
  return content.reduce((n, part) => n + (part?.type === "image" ? IMAGE_TOKENS * CHARS_PER_TOKEN : part?.type === "text" ? size(part.text) : size(part)), 0);
}

// What a tool call was about: the file, the command, the pattern. `key` is the whole of it,
// so two commands that share a beginning stay apart; `label` is what fits on a row.
function callName(name, input = {}) {
  if (input.file_path || input.notebook_path) {
    const file = input.file_path ?? input.notebook_path;
    return { key: `${name} ${file}`, label: `${name} ${String(file).split(/[\\/]/).slice(-2).join("/")}` };
  }
  const what = input.command ?? input.url ?? input.pattern ?? input.query ?? input.path ?? input.skill ?? input.description ?? input.prompt;
  if (typeof what !== "string") return { key: name, label: name };
  // A leading `cd somewhere &&` says where, not what.
  const body = what.replace(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*(&&|;)\s*/, "").trim() || what;
  return { key: `${name} ${what}`, label: `${name} ${short(body, 52)}` };
}

const toolGroup = (name) => (name?.startsWith("mcp__") ? `MCP ${name.split("__")[1]}` : name ?? "tool");

class Tally {
  constructor() {
    this.items = new Map(); // `${bucket}\u0000${label}` -> { bucket, label, tool, tokens, n, estimated }
  }
  add(piece, tokens, exact) {
    if (!(tokens > 0)) return;
    const key = `${piece.bucket}\u0000${piece.key ?? piece.label}`;
    const it = this.items.get(key) ?? { bucket: piece.bucket, label: piece.label, tool: piece.tool ?? null, tokens: 0, n: 0, estimated: 0 };
    it.tokens += tokens;
    it.n++;
    if (!exact) it.estimated += tokens;
    this.items.set(key, it);
  }
  // Shares `tokens` over `pieces` by their characters; with no characters to go by, the
  // tokens are untracked.
  share(pieces, tokens, exact) {
    const weighted = pieces.filter((p) => p.chars > 0);
    const total = weighted.reduce((n, p) => n + p.chars, 0);
    if (!total) {
      this.add({ bucket: "other", label: "Untracked additions" }, tokens, exact);
      return;
    }
    for (const p of weighted) this.add(p, (tokens * p.chars) / total, exact);
  }
}

// The pieces an attachment entry adds to the context, if any.
function attachmentPieces(a) {
  if (SKIPPED_ATTACHMENTS.has(a.type)) return [];
  if (a.type === "instructions") return (a.files ?? []).map((f) => ({ bucket: "memory", label: `${baseName(f.path)} (${f.type ?? "?"})`, chars: size(f.content) }));
  if (LISTING_ATTACHMENTS[a.type]) return [{ bucket: "listings", label: LISTING_ATTACHMENTS[a.type], chars: size(a.content ?? a) }];
  if (a.type === "hook_success" || a.type === "hook_additional_context") {
    // Tool hooks' stdout stays out of context unless it carries additional context,
    // which comes as its own hook_additional_context entry.
    const event = a.hookEvent ?? a.hookName ?? "";
    if (a.type === "hook_success" && !/SessionStart|UserPromptSubmit/.test(event)) return [];
    return [{ bucket: "reminders", label: `Hook ${String(a.hookName ?? event).split(":")[0]}`, chars: size(a.content) }];
  }
  if (a.type === "queued_command") return [{ bucket: "prompts", label: short(a.prompt ?? a.content ?? "Queued prompt"), chars: size(a.prompt ?? a.content) }];
  return [{ bucket: "reminders", label: REMINDER_NAMES[a.type] ?? a.type ?? "Attachment", chars: size(a.content ?? a.snippet ?? a) }];
}

function userPieces(e, callOf) {
  const m = e.message;
  const text = (s) => {
    if (e.isCompactSummary) return { bucket: "summary", label: "Summary", chars: s.length };
    if (s.startsWith("Base directory for this skill")) return { bucket: "listings", label: "Loaded skill bodies", chars: s.length };
    if (e.isMeta) return { bucket: "reminders", label: "System message", chars: s.length };
    // Tagged messages the harness types in: a slash command, or a background task's news.
    const tag = /^\s*<([a-z][\w-]*)>/.exec(s)?.[1];
    if (tag === "command-name") return { bucket: "prompts", label: short(/<command-name>([^<]*)/.exec(s)?.[1] ?? "Command"), chars: s.length };
    if (tag && tag !== "pasted_content") return { bucket: "reminders", label: `<${tag}>`, chars: s.length };
    return { bucket: "prompts", label: short(s.replace(/<[^>]+>/g, " ")) || "Prompt", chars: s.length };
  };
  if (typeof m.content === "string") return [text(m.content)];
  return (m.content ?? []).flatMap((block) => {
    if (block.type === "tool_result") {
      const call = callOf.get(block.tool_use_id);
      return [{ bucket: "results", key: call?.key, label: call?.label ?? "Tool result", tool: call?.tool ?? "tool", chars: contentChars(block.content) }];
    }
    if (block.type === "text") return [text(block.text)];
    if (block.type === "image") return [{ bucket: "prompts", label: "Image", chars: IMAGE_TOKENS * CHARS_PER_TOKEN }];
    return [];
  });
}

// Listings the meter counts itself; the rest of the first request is left to the transcript.
const METERED_LISTINGS = new Set([LISTING_ATTACHMENTS.skill_listing, LISTING_ATTACHMENTS.agent_listing_delta, LISTING_ATTACHMENTS.mcp_instructions_delta]);
const isMetered = (p) => p.bucket === "memory" || METERED_LISTINGS.has(p.label);

const shortPath = (p) => p.split(/[\\/]/).slice(-2).join("/");

// What the meter counts piece by piece: everything but the built-in tools and the messages.
function meterPieces(meter) {
  const row = (name) => meter.categories.find((c) => c.kind === "used" && c.name === name)?.tokens ?? 0;
  const skills = meter.skills?.skillFrontmatter ?? [];
  return [
    { bucket: "system", label: "System prompt", tokens: row("System prompt") },
    ...meter.mcpTools.filter((m) => m.isLoaded).map((m) => ({ bucket: "tools", label: m.name, tokens: m.tokens })),
    ...meter.memoryFiles.map((f) => ({ bucket: "memory", key: f.path, label: `${shortPath(f.path)} (${f.type})`, tokens: f.tokens })),
    ...skills.map((s) => ({ bucket: "listings", label: `Skill ${s.name}`, tokens: s.tokens })),
    ...meter.agents.map((a) => ({ bucket: "listings", label: `Agent ${a.agentType}`, tokens: a.tokens })),
    { bucket: "listings", label: "MCP server instructions", tokens: row("MCP server instructions") },
  ].filter((p) => p.tokens > 0);
}

export function analyze(lines, meter = null) {
  const entries = [];
  for (const line of lines) {
    if (!line) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // A line being written: ignore it.
    }
  }

  const boundaries = entries.map((e, i) => (e.type === "system" && e.subtype === "compact_boundary" ? i : -1)).filter((i) => i >= 0);
  const start = boundaries.length ? boundaries.at(-1) + 1 : 0;

  const snapshot = entries.filter((e) => e.type === "attachment" && e.attachment?.type === "prompt_snapshot" && e.attachment.tools).at(-1)?.attachment
    ?? entries.filter((e) => e.type === "attachment" && e.attachment?.type === "prompt_snapshot").at(-1)?.attachment;
  const fixed = [];
  if (snapshot) {
    const sys = Array.isArray(snapshot.systemPrompt) ? snapshot.systemPrompt : [snapshot.systemPrompt];
    fixed.push({ bucket: "system", label: "System prompt", chars: sys.reduce((n, s) => n + size(s), 0) });
    for (const tool of Array.isArray(snapshot.tools) ? snapshot.tools : []) fixed.push({ bucket: "tools", label: toolGroup(tool.name), chars: size(tool) });
  }

  const tally = new Tally();
  const callOf = new Map();
  let gap = []; // what was added since the last call
  let call = null; // { id, input, output, thinking, pieces }
  let calls = 0;
  let countedBuckets = new Set(); // the categories the meter counted: exact, whatever their items

  const closeCall = (next) => {
    if (!call) {
      // The first call: everything so far arrived as one block.
      if (meter) {
        const counted = meterPieces(meter);
        const messages = gap.filter((p) => !isMetered(p));
        const countedTokens = counted.reduce((n, p) => n + p.tokens, 0);
        const toolTokens = meter.categories.filter((c) => /^System tools/.test(c.name)).reduce((n, c) => n + c.tokens, 0);
        const room = next.input - countedTokens - toolTokens;
        const messageTokens = Math.min(room, messages.reduce((n, p) => n + p.chars, 0) / CHARS_PER_TOKEN);
        if (room >= 0) {
          for (const p of counted) tally.add(p, p.tokens, true);
          const builtIn = fixed.filter((p) => p.bucket === "tools" && !p.label.startsWith("MCP "));
          if (builtIn.length) tally.share(builtIn, toolTokens, false);
          else tally.add({ bucket: "tools", label: "System tools" }, toolTokens, true);
          tally.share(messages, messageTokens, false);
          tally.add({ bucket: "other", label: "Not in the transcript" }, room - messageTokens, true);
          countedBuckets = new Set([...counted.map((p) => p.bucket), "tools"]);
          return;
        }
      }
      if (snapshot) {
        tally.share([...fixed, ...gap], next.input, false);
        return;
      }
      // No snapshot: what the transcript shows is sized by characters, the rest is the prompt.
      const shown = Math.min(next.input, gap.reduce((n, p) => n + p.chars, 0) / CHARS_PER_TOKEN);
      tally.add({ bucket: "system", label: "System prompt + tool schemas" }, next.input - shown, false);
      tally.share(gap, shown, false);
      return;
    }
    const delta = next.input - call.input;
    const kept = Math.min(Math.max(0, delta), call.output);
    const thinking = Math.min(call.thinking, kept);
    tally.add({ bucket: "thinking", label: "Thinking" }, thinking, true);
    tally.share(call.pieces, kept - thinking, true);
    const added = delta - call.output;
    if (added > 0) tally.share(gap, added, true);
  };

  for (const e of entries.slice(start)) {
    if (e.isSidechain) continue;
    if (e.type === "attachment") {
      gap.push(...attachmentPieces(e.attachment ?? {}));
      continue;
    }
    const m = e.message;
    if (!m) continue;
    if (e.type === "user") {
      gap.push(...userPieces(e, callOf));
      continue;
    }
    if (e.type !== "assistant" || !m.usage) continue;
    // One API response is written as one entry per content block, all with its id and usage.
    if (!call || call.id !== m.id) {
      const next = { id: m.id, input: inputOf(m.usage), output: m.usage.output_tokens ?? 0, thinking: m.usage.output_tokens_details?.thinking_tokens ?? 0, pieces: [] };
      closeCall(next);
      gap = [];
      call = next;
      calls++;
    }
    for (const block of m.content ?? []) {
      if (block.type === "text") call.pieces.push({ bucket: "text", label: "Text", chars: block.text.length });
      else if (block.type === "tool_use") {
        const named = callName(block.name, block.input);
        callOf.set(block.id, { ...named, tool: toolGroup(block.name) });
        call.pieces.push({ bucket: "calls", ...named, tool: toolGroup(block.name), chars: size(block.input) });
      }
    }
  }

  const total = call?.input ?? 0;
  const items = [...tally.items.values()];
  const exactOf = (it) => it.estimated < it.tokens / 2;
  const categories = CATEGORIES.map(([key, label]) => {
    const mine = items.filter((it) => it.bucket === key).sort((x, y) => y.tokens - x.tokens);
    const tokens = Math.round(mine.reduce((n, it) => n + it.tokens, 0));
    const estimated = Math.round(mine.reduce((n, it) => n + it.estimated, 0));
    const top = mine.slice(0, TOP_ITEMS).map((it) => ({ label: it.label, tokens: Math.round(it.tokens), n: it.n, exact: exactOf(it) }));
    const rest = mine.slice(TOP_ITEMS);
    if (rest.length) top.push({ label: `+${rest.length} more`, tokens: Math.round(rest.reduce((n, it) => n + it.tokens, 0)), n: rest.length, exact: rest.every(exactOf), isRest: true });
    // Tool results by tool: which tool's output fills the context.
    const byTool = key === "results" || key === "calls"
      ? [...mine.reduce((acc, it) => acc.set(it.tool, (acc.get(it.tool) ?? 0) + it.tokens), new Map())]
        .map(([tool, t]) => ({ label: tool, tokens: Math.round(t) })).sort((x, y) => y.tokens - x.tokens)
      : null;
    return { key, label, tokens, exact: countedBuckets.has(key) || estimated < tokens / 2, items: top, byTool };
  }).filter((c) => c.tokens > 0);

  // The biggest single measured pieces anywhere.
  const biggest = items.filter(exactOf).sort((x, y) => y.tokens - x.tokens).slice(0, 5)
    .map((it) => ({ label: it.label, category: it.bucket, tokens: Math.round(it.tokens), n: it.n }));
  const estimated = Math.round(items.reduce((n, it) => n + it.estimated, 0));

  return { total, window: meter?.rawMaxTokens ?? null, counted: countedBuckets.size > 0, calls, estimated, compactions: boundaries.length, categories, biggest, at: Date.now() };
}

// The session's counted breakdown, when the context-meter mod has written one.
function meterOf(transcript) {
  try {
    return JSON.parse(readFileSync(join(homedir(), ".claude", "state", "ctx", "meter", `${basename(transcript, ".jsonl")}.json`), "utf8"));
  } catch {
    return null;
  }
}

if (process.argv[2]) {
  try {
    const text = readFileSync(process.argv[2], "utf8");
    process.stdout.write(JSON.stringify(analyze(text.split("\n"), meterOf(process.argv[2]))));
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: String(err?.message ?? err) }));
    process.exitCode = 1;
  }
}
