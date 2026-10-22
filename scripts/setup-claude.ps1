#!/usr/bin/env pwsh
# Claude Code harness setup (Windows). Run from a clone of this repo.
$ErrorActionPreference = "Stop"

$Repo   = Split-Path $PSScriptRoot -Parent
$Claude = Join-Path $env:USERPROFILE ".claude"
$Bin    = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $Bin, "$Claude\skills", "$Claude\rules" | Out-Null

Write-Host "[1/5] Config files"
& "$PSScriptRoot\sync-config.ps1"

Write-Host "[2/5] rtk"
& "$PSScriptRoot\install-rtk.ps1"
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
& "$PSScriptRoot\sync-config.ps1" | Out-Null

Write-Host "[3/5] fff MCP"
& "$PSScriptRoot\install-fff.ps1"

Write-Host "[4/5] portless + gh-axi + chrome-devtools-axi"
npm install -g portless gh-axi chrome-devtools-axi

Write-Host "[5/5] Plugins"
foreach ($m in "JuliusBrussee/caveman", "anthropics/claude-plugins-official") {
  claude plugin marketplace add $m
}
claude plugin install caveman@caveman

Write-Host "Done. Restart Claude Code."
