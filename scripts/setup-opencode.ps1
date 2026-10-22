#!/usr/bin/env pwsh
# OpenCode harness setup (Windows). Run from a clone of this repo.
# Idempotent, and doubles as the updater.
# Unix equivalent: scripts/setup-opencode.sh
$ErrorActionPreference = "Stop"

Write-Host "[1/5] opencode (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when opencode is on PATH would never update.
npm install -g opencode-ai@latest
opencode --version

Write-Host "[2/5] Config (AGENTS.md + skills + rules)"
& "$PSScriptRoot\sync-config.ps1" opencode

Write-Host "[3/5] rtk (+ OpenCode plugin)"
& "$PSScriptRoot\install-rtk.ps1" -OpenCode
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
& "$PSScriptRoot\sync-config.ps1" opencode | Out-Null

Write-Host "[4/5] gh-axi + chrome-devtools-axi"
npm install -g gh-axi chrome-devtools-axi

Write-Host "[5/5] fff MCP"
& "$PSScriptRoot\install-fff.ps1"

Write-Host @"

Done. Restart OpenCode.

- Global instructions: ~/.config/opencode/AGENTS.md (copy of GLOBAL.md)
- Skills: ~/.agents/skills - OpenCode loads that dir natively, no second copy
- ~/.config/opencode/opencode.json(c) holds per-machine MCP/provider state: only its mcp.fff key is set,
  and the first rewrite keeps the original as opencode.json(c).bak
"@
