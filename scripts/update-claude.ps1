#!/usr/bin/env pwsh
# Update every external tool/hook the harness depends on (Windows).
# Companion to setup-claude.ps1: setup installs, this refreshes to latest.
$ErrorActionPreference = "Stop"

$Bin = Join-Path $env:USERPROFILE ".local\bin"

Write-Host "[0/3] Config files (skills, rules, CLAUDE.md)"
& "$PSScriptRoot\sync-config.ps1"

Write-Host "[1/3] rtk"
$rtkUrl = (Invoke-RestMethod "https://api.github.com/repos/rtk-ai/rtk/releases/latest").assets |
  Where-Object name -EQ "rtk-x86_64-pc-windows-msvc.zip" | ForEach-Object browser_download_url
$tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "rtk-up")
Invoke-WebRequest $rtkUrl -OutFile "$tmp\rtk.zip"
Expand-Archive "$tmp\rtk.zip" -DestinationPath $tmp -Force
Copy-Item (Get-ChildItem $tmp -Recurse -Filter rtk.exe)[0].FullName "$Bin\rtk.exe" -Force
Remove-Item -Recurse -Force $tmp
& "$Bin\rtk.exe" --version

Write-Host "[2/3] npm globals (chrome-devtools-axi, gh-axi, portless)"
npm install -g chrome-devtools-axi@latest gh-axi@latest portless@latest
# Windows runs Claude Code only — pi/Cursor live on the NixOS box and are
# updated by their own scripts there. Nothing else to refresh here.

Write-Host "[3/3] Claude Code plugins"
foreach ($p in "caveman@caveman") {
  claude plugin update $p
}

Write-Host "Done. Restart Claude Code to load updated plugins."
