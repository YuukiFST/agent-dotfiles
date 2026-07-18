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

# rules/ is entirely repo-owned — full mirror so deleted rules don't linger
Remove-Item "$Claude\rules" -Recurse -Force
Copy-Item "$Repo\rules" "$Claude\rules" -Recurse

# hooks/ — per-file copy, never a mirror: other installers drop their own hooks here
# (herdr writes herdr-agent-state.ps1) and a mirror would delete them.
New-Item -ItemType Directory -Force -Path "$Claude\hooks" | Out-Null
Get-ChildItem "$Repo\hooks" -File | ForEach-Object {
  Copy-Item $_.FullName (Join-Path "$Claude\hooks" $_.Name) -Force
}

# settings.json is a SEED, not a mirror. Claude Code rewrites this file itself (model,
# effortLevel, theme via /config) and other tools merge into it (herdr adds a SessionStart
# hook), so overwriting a live one silently throws away state this repo does not track.
$settings = Join-Path $Claude "settings.json"
if (Test-Path $settings) {
  Write-Host "  settings.json exists — left alone (repo copy seeds fresh machines only)"
} else {
  # The seed hardcodes this author's profile path; rewrite it for whoever is installing.
  $esc = $env:USERPROFILE.Replace('\', '\\')
  (Get-Content "$Repo\settings.json" -Raw).Replace('C:\\Users\\tisao', $esc) |
    Set-Content $settings -NoNewline
  Write-Host "  seeded settings.json"
}

# agent-browser config is per-MACHINE (~/.agent-browser), read by the CLI on every
# invocation regardless of harness. Seed only — the live file may grow local state.
$abConfig = Join-Path $env:USERPROFILE ".agent-browser\config.json"
if (-not (Test-Path $abConfig)) {
  New-Item -ItemType Directory -Force -Path (Join-Path $env:USERPROFILE ".agent-browser\screenshots") | Out-Null
  $esc = $env:USERPROFILE.Replace('\', '\\')
  (Get-Content "$Repo\agent-browser\config.windows.json" -Raw).Replace('C:\\Users\\tisao', $esc) |
    Set-Content $abConfig -NoNewline
  Write-Host "  seeded ~/.agent-browser/config.json"
}

Write-Host "Config synced (claude)."
