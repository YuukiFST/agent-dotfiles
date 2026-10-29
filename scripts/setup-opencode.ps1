#!/usr/bin/env pwsh
# OpenCode harness setup (Windows). Run from a clone of this repo.
# Idempotent, and doubles as the updater.
# Unix equivalent: scripts/setup-opencode.sh
$ErrorActionPreference = "Stop"

Write-Host "[1/6] opencode (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when opencode is on PATH would never update.
npm install -g opencode-ai@latest
opencode --version

Write-Host "[2/6] Config (AGENTS.md + skills + rules)"
& "$PSScriptRoot\sync-config.ps1" opencode

Write-Host "[3/6] rtk (+ OpenCode plugin)"
& "$PSScriptRoot\install-rtk.ps1" -OpenCode
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
& "$PSScriptRoot\sync-config.ps1" opencode | Out-Null

Write-Host "[4/6] OpenCode plugins (caveman-lean, ponytail-subagent, goal mode)"
# `plugin add` skips a plugin already in opencode.jsonc without updating it, so `update` follows.
foreach ($p in "github:YuukiFST/caveman-lean", "github:YuukiFST/ponytail-subagent", "@prevalentware/opencode-goal-plugin") {
  opencode plugin add $p
  opencode plugin update $p
}
# OpenCode 2 loads a plugin's TUI half (sidebar, palette) only from cli.json, which `plugin add`
# never writes. Same run, idempotent, and it keeps the machine's theme/keybinds.
node "$PSScriptRoot\add-opencode-tui-plugin.mjs" "@prevalentware/opencode-goal-plugin"

Write-Host "[5/6] gh-axi + chrome-devtools-axi"
npm install -g gh-axi chrome-devtools-axi

Write-Host "[6/6] fff MCP (retired, unregister)"
& "$PSScriptRoot\remove-fff.ps1"

Write-Host @"

Done. Restart OpenCode.

- Global instructions: ~/.config/opencode/AGENTS.md (copy of GLOBAL.md)
- Skills: ~/.agents/skills - OpenCode loads that dir natively, no second copy
- ~/.config/opencode/opencode.json(c) holds per-machine MCP/provider state: only the retired mcp.fff key is removed,
  and the first rewrite keeps the original as opencode.json(c).bak
"@
