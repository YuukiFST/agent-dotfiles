#!/usr/bin/env pwsh
# Update every external tool/hook the harness depends on (Windows).
# Companion to setup-claude.ps1: setup installs, this refreshes the npm globals and plugins to
# latest and reinstalls rtk at the build pinned in rtk-pin.txt.
$ErrorActionPreference = "Stop"

$Bin = Join-Path $env:USERPROFILE ".local\bin"

Write-Host "[0/5] Config files (skills, rules, CLAUDE.md)"
& "$PSScriptRoot\sync-config.ps1"

Write-Host "[1/5] rtk"
& "$PSScriptRoot\install-rtk.ps1"
& "$Bin\rtk.exe" --version

Write-Host "[2/5] fff MCP (retired, unregister)"
& "$PSScriptRoot\remove-fff.ps1"

Write-Host "[3/5] npm globals (chrome-devtools-axi, gh-axi)"
npm install -g chrome-devtools-axi@latest gh-axi@latest
# Windows runs Claude Code only — pi/Cursor live on the NixOS box and are
# updated by their own scripts there. Nothing else to refresh here.

Write-Host "[4/5] browser-harness"
& "$PSScriptRoot\install-browser-harness.ps1"

Write-Host "[5/5] Claude Code plugins"
foreach ($p in "caveman-lean@caveman-lean", "ponytail-subagent@ponytail-subagent") {
  claude plugin update $p
}

Write-Host "Done. Restart Claude Code to load updated plugins."
