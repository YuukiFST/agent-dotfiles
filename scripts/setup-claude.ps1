#!/usr/bin/env pwsh
# Claude Code harness setup (Windows). Run from a clone of this repo.
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\invoke-native.ps1"

$Repo   = Split-Path $PSScriptRoot -Parent
$Claude = Join-Path $env:USERPROFILE ".claude"
$Bin    = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $Bin, "$Claude\skills", "$Claude\rules" | Out-Null

Write-Host "[1/6] Config files"
& "$PSScriptRoot\sync-config.ps1"

Write-Host "[2/6] rtk"
& "$PSScriptRoot\install-rtk.ps1"
# Again, now that rtk is on PATH: the sync writes rtk/config.toml where `rtk config` points.
& "$PSScriptRoot\sync-config.ps1" | Out-Null

Write-Host "[3/6] fff MCP (retired, unregister)"
& "$PSScriptRoot\remove-fff.ps1"

Write-Host "[4/6] gh-axi + chrome-devtools-axi"
Invoke-Native npm install -g gh-axi chrome-devtools-axi

Write-Host "[5/6] browser-use"
& "$PSScriptRoot\install-browser-use.ps1"

Write-Host "[6/6] Plugins"
foreach ($m in "YuukiFST/caveman-lean", "anthropics/claude-plugins-official", "YuukiFST/ponytail-subagent") {
  Invoke-Native claude plugin marketplace add $m
}
Invoke-Native claude plugin install caveman-lean@caveman-lean
Invoke-Native claude plugin install ponytail-subagent@ponytail-subagent

Write-Host "Done. Restart Claude Code."
