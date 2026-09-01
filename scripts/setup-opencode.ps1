#!/usr/bin/env pwsh
# OpenCode harness setup (Windows). Run from a clone of this repo.
# Idempotent, and doubles as the updater.
# Unix equivalent: scripts/setup-opencode.sh
$ErrorActionPreference = "Stop"

Write-Host "[1/2] opencode (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when opencode is on PATH would never update.
npm install -g opencode-ai@latest
opencode --version

Write-Host "[2/2] Config (AGENTS.md + skills + rules)"
& "$PSScriptRoot\sync-config.ps1" opencode

Write-Host @"

Done. Restart OpenCode.

- Global instructions: ~/.config/opencode/AGENTS.md (copy of CLAUDE.md)
- Skills: ~/.agents/skills - OpenCode loads that dir natively, no second copy
- ~/.config/opencode/opencode.json is NOT touched: it holds per-machine MCP/provider state
"@
