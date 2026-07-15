#!/usr/bin/env pwsh
# Copy config (CLAUDE.md, dreaming.md, skills/, rules/) from this repo into ~/.claude.
# Shared by setup-claude.ps1 and update-claude.ps1 so "git pull + update" always propagates config.
$ErrorActionPreference = "Stop"

$Repo   = Split-Path $PSScriptRoot -Parent
$Claude = Join-Path $env:USERPROFILE ".claude"
New-Item -ItemType Directory -Force -Path "$Claude\skills", "$Claude\rules" | Out-Null

Copy-Item "$Repo\CLAUDE.md" "$Claude\CLAUDE.md" -Force
Copy-Item "$Repo\dreaming.md" "$Claude\dreaming.md" -Force

# Per-skill replace: prunes files removed/renamed inside a repo skill, keeps local-only skills
Get-ChildItem "$Repo\skills" -Directory | ForEach-Object {
  $dest = Join-Path "$Claude\skills" $_.Name
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Copy-Item $_.FullName $dest -Recurse
}
# omarchy is Linux-only (Hyprland/waybar) — dead weight in the prompt on Windows
Remove-Item "$Claude\skills\omarchy" -Recurse -Force -ErrorAction SilentlyContinue

# rules/ is entirely repo-owned — full mirror so deleted rules don't linger
Remove-Item "$Claude\rules" -Recurse -Force
Copy-Item "$Repo\rules" "$Claude\rules" -Recurse

Write-Host "Config synced (claude)."
