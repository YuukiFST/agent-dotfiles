#!/usr/bin/env node
// Remove one MCP server from OpenCode's global config, leaving every other key alone.
// Shared by remove-fff.ps1 and remove-fff.sh.
//
// Usage: node scripts/remove-opencode-mcp.mjs <name>
//
// opencode.json(c) is machine-owned (providers, models, other MCP servers), so only mcp.<name>
// changes. OpenCode accepts comments and trailing commas in it and JSON.stringify keeps neither,
// so the first rewrite keeps the original as <file>.bak.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripJsonc } from "./jsonc.mjs";

const [name, ...extra] = process.argv.slice(2);
if (!name || extra.length > 0) {
  console.error("usage: remove-opencode-mcp.mjs <name>");
  process.exit(2);
}

// OpenCode reads both names from its global dir and merges them; edit each one that has the key.
const dir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode");
for (const file of ["opencode.json", "opencode.jsonc"].map((f) => path.join(dir, f))) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  if (!text.trim()) continue;
  const config = JSON.parse(stripJsonc(text));
  if (!config.mcp || !(name in config.mcp)) continue;
  delete config.mcp[name];
  if (Object.keys(config.mcp).length === 0) delete config.mcp;
  if (!fs.existsSync(`${file}.bak`)) fs.copyFileSync(file, `${file}.bak`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
  console.log(`  OpenCode mcp.${name} removed from ${file}`);
}
