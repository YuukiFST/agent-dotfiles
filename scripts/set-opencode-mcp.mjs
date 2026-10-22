#!/usr/bin/env node
// Add or replace one local MCP server in OpenCode's global config, leaving every other key alone.
// Shared by install-fff.ps1 and install-fff.sh.
//
// Usage: node scripts/set-opencode-mcp.mjs <name> <command> [args...]
//
// opencode.json(c) is machine-owned (providers, models, other MCP servers), so only mcp.<name>
// changes. OpenCode accepts comments and trailing commas in it and JSON.stringify keeps neither,
// so the first rewrite keeps the original as <file>.bak.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [name, ...command] = process.argv.slice(2);
if (!name || command.length === 0) {
  console.error("usage: set-opencode-mcp.mjs <name> <command> [args...]");
  process.exit(2);
}

// OpenCode reads both names from its global dir and merges them; edit the one already there.
const dir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode");
const file =
  ["opencode.json", "opencode.jsonc"].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f)) ??
  path.join(dir, "opencode.json");
const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/^﻿/, "") : "";
const config = text.trim() ? JSON.parse(stripJsonc(text)) : { $schema: "https://opencode.ai/config.json" };

const entry = { type: "local", command, enabled: true };
if (JSON.stringify(config.mcp?.[name]) === JSON.stringify(entry)) {
  console.log(`  OpenCode mcp.${name} already set in ${file}`);
  process.exit(0);
}
config.mcp = { ...config.mcp, [name]: entry };
if (text.trim() && !fs.existsSync(`${file}.bak`)) fs.copyFileSync(file, `${file}.bak`);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log(`  OpenCode mcp.${name} set in ${file}`);

// JSONC to JSON: drop // and /* */ comments, then commas before a closing bracket,
// both only outside string literals.
function stripJsonc(src) {
  const indexOrEnd = (s, token, from) => (s.indexOf(token, from) === -1 ? s.length : s.indexOf(token, from));
  const noComments = scan(src, (s, i) => {
    if (s.startsWith("//", i)) return [indexOrEnd(s, "\n", i), ""];
    if (s.startsWith("/*", i)) return [Math.min(indexOrEnd(s, "*/", i) + 2, s.length), ""];
  });
  return scan(noComments, (s, i) => {
    if (s[i] === "," && /^\s*[}\]]/.test(s.slice(i + 1))) return [i + 1, ""];
  });
}

// Copy src, letting skip(src, i) replace a span outside strings: it returns [end, replacement].
function scan(src, skip) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (src[i] === '"') {
      let end = i + 1;
      while (end < src.length && src[end] !== '"') end += src[end] === "\\" ? 2 : 1;
      out += src.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    const hit = skip(src, i);
    if (hit) {
      out += hit[1];
      i = hit[0];
      continue;
    }
    out += src[i++];
  }
  return out;
}
