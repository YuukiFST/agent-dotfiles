#!/usr/bin/env pwsh
# OpenCode harness setup (Windows). Run from a clone of this repo.
# Idempotent, and doubles as the updater.
# Unix equivalent: scripts/setup-opencode.sh
$ErrorActionPreference = "Stop"

Write-Host "[1/2] opencode (npm, latest)"
if (Get-Command opencode -ErrorAction SilentlyContinue) {
  Write-Host "  opencode already on PATH: $((Get-Command opencode).Source)"
} else {
  npm install -g opencode-ai@latest
}
opencode --version

Write-Host "[2/2] Config (AGENTS.md + skills + rules)"
& "$PSScriptRoot\sync-config.ps1" opencode

Write-Host @"

Done. Restart OpenCode.

- Global instructions: ~/.config/opencode/AGENTS.md (copy of CLAUDE.md)
- Skills: ~/.agents/skills - OpenCode loads that dir natively, no second copy
- ~/.config/opencode/opencode.json is NOT touched: it holds per-machine MCP/provider state
"@
