#!/usr/bin/env node
// Count what agents repeated across Claude Code sessions in one repo: files read, command
// segments run, --help lookups. Repetition is counted in sessions, not calls, so one session
// looping on a command does not look like a habit.
// Run: node sweep.mjs [repo-root] [--min N] [--json]   (defaults: git toplevel of cwd, 3)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const json = args.includes('--json');
const minIdx = args.indexOf('--min');
const minSessions = minIdx >= 0 ? Number(args[minIdx + 1]) : 3;
const rootArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--min');
const root = path.resolve(rootArg || execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());

const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '');
const fold = (p) => (process.platform === 'win32' ? norm(p).toLowerCase() : norm(p));
const rootKey = fold(root);
const home = norm(os.homedir());
const projects = path.join(os.homedir(), '.claude', 'projects');

if (!fs.existsSync(projects)) {
  console.error(`no ${projects}: no Claude Code transcripts on this machine (pi and OpenCode keep none there)`);
  process.exit(1);
}

// A transcript belongs to the repo when a line's "cwd" is the root or a path under it.
async function sessionCwd(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8') });
  for await (const line of rl) {
    const m = line.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
    if (m) { rl.close(); return JSON.parse(`"${m[1]}"`); }
  }
  return null;
}

const files = [];
for (const dir of fs.readdirSync(projects)) {
  const full = path.join(projects, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  for (const f of fs.readdirSync(full)) if (f.endsWith('.jsonl')) files.push(path.join(full, f));
}

const reads = new Map();
const segments = new Map();
const helps = new Map();
const tools = new Map();
const add = (map, key, sid) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(sid); };
const stripRoot = (s) => s.split(norm(root)).join('.').split(root).join('.').split(home).join('~');

// One command line holds several intents; split on && ; | and keep each segment's head.
function commandSegments(cmd) {
  const first = cmd.split('\n')[0].replace(/<<-?\s*'?(\w+)'?.*$/, '<<$1');
  return stripRoot(first)
    .split(/\s*(?:&&|\|\||;|\|)\s*/)
    .map((s) => s.trim().replace(/^cd \S+$/, '').replace(/\s*2>&1$/, '').replace(/\s+/g, ' '))
    // Pipe filters, shell keywords and assignments shape output; they are not an intent.
    .filter((s) => s && !/^(echo|printf|cat >|true|exit|head|tail|sort|uniq|wc|cut|tr|ls|done|fi|then|else|do|\w+=\S*)(\s|$)/.test(s))
    .map((s) => s.slice(0, 100));
}

let sessions = 0;
for (const file of files) {
  const cwd = await sessionCwd(file);
  if (!cwd) continue;
  const key = fold(cwd);
  if (key !== rootKey && !key.startsWith(rootKey + '/')) continue;
  sessions++;
  const sid = path.basename(file, '.jsonl').slice(0, 8);
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8') });
  for await (const line of rl) {
    if (!line.includes('"tool_use"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const content = o.type === 'assistant' && o.message && o.message.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (b.type !== 'tool_use') continue;
      const input = b.input || {};
      tools.set(b.name, (tools.get(b.name) || 0) + 1);
      if (b.name === 'Read' && input.file_path) add(reads, stripRoot(norm(input.file_path)), sid);
      if ((b.name === 'Bash' || b.name === 'PowerShell') && input.command) {
        for (const s of commandSegments(input.command)) {
          add(segments, s, sid);
          const h = s.match(/^(\S+(?: \S+)?) .*--help/);
          if (h) add(helps, h[1], sid);
        }
      }
    }
  }
}

const top = (map) =>
  [...map].filter(([, s]) => s.size >= minSessions).sort((a, b) => b[1].size - a[1].size)
    .map(([key, s]) => ({ key, sessions: s.size, ids: [...s].slice(0, 5) }));
const result = {
  root: norm(root), sessions, minSessions,
  tools: Object.fromEntries([...tools].sort((a, b) => b[1] - a[1])),
  reads: top(reads), commands: top(segments), helpLookups: top(helps),
};

if (json) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`sessions: ${sessions} under ${result.root} (showing items in >= ${minSessions} sessions)`);
  console.log(`tool calls: ${Object.entries(result.tools).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const [title, list] of [['reads', result.reads], ['commands', result.commands], ['--help lookups', result.helpLookups]]) {
    console.log(`\n== ${title}`);
    for (const r of list.slice(0, 40)) console.log(`${String(r.sessions).padStart(3)}  ${r.key}  [${r.ids.join(' ')}]`);
  }
}
if (!sessions) process.exit(1);
