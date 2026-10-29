#!/usr/bin/env node
// Register one plugin in OpenCode 2's global cli.json, leaving every other key alone.
// OpenCode 2 splits plugin loading in two files: opencode.json(c) carries the server entrypoint
// and `opencode plugin add` writes it, while the TUI half (sidebar, command palette) loads only
// from cli.json, which that CLI never touches.
//
// Usage: node scripts/add-opencode-tui-plugin.mjs <package>
//
// cli.json is machine-owned (theme, keybinds, session), so only plugins[] changes. OpenCode
// accepts comments in it and JSON.stringify keeps none, so the first rewrite keeps the original
// as cli.json.bak.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stripJsonc } from "./jsonc.mjs";

const [pkg, ...extra] = process.argv.slice(2);
if (!pkg || extra.length > 0) {
  console.error("usage: add-opencode-tui-plugin.mjs <package>");
  process.exit(2);
}

const dir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode");
const file = path.join(dir, "cli.json");

let config = { $schema: "https://opencode.ai/v2/cli.json" };
if (fs.existsSync(file)) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  if (text.trim()) config = JSON.parse(stripJsonc(text));
}

if (config.plugins != null && !Array.isArray(config.plugins)) {
  console.error(`  ${file}: plugins is not an array, fix it by hand`);
  process.exit(1);
}
const plugins = config.plugins ?? [];
const enabled = plugins.some((entry) => (typeof entry === "string" ? entry : entry?.package) === pkg);
if (enabled) {
  console.log(`  ${pkg} already enabled in ${file}`);
  process.exit(0);
}

config.plugins = [...plugins, pkg];
fs.mkdirSync(dir, { recursive: true });
if (fs.existsSync(file) && !fs.existsSync(`${file}.bak`)) fs.copyFileSync(file, `${file}.bak`);
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log(`  ${pkg} enabled in ${file} (restart the TUI to load it)`);
