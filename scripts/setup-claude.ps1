#!/usr/bin/env pwsh
# Claude Code harness setup (Windows). Run from a clone of this repo.
$ErrorActionPreference = "Stop"

$Repo   = Split-Path $PSScriptRoot -Parent
$Claude = Join-Path $env:USERPROFILE ".claude"
$Bin    = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $Bin, "$Claude\skills", "$Claude\rules" | Out-Null

Write-Host "[1/4] Config files"
& "$PSScriptRoot\sync-config.ps1"

Write-Host "[2/4] rtk"
& "$PSScriptRoot\install-rtk.ps1"

Write-Host "[3/4] portless + agent-browser + gh-axi"
npm install -g portless agent-browser gh-axi
agent-browser install

Write-Host "[4/4] Plugins"
foreach ($m in "JuliusBrussee/caveman", "anthropics/claude-plugins-official", "kingbootoshi/goal-ledger") {
  claude plugin marketplace add $m
}
claude plugin install caveman@caveman
claude plugin install goal-ledger@goal-ledger

Write-Host "Done. Restart Claude Code."
