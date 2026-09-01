#!/usr/bin/env pwsh
# Copy config (CLAUDE.md, skills/, rules/, plus any root payload an active stack adds)
# from this repo into the harness dirs on a Windows machine.
# Shared by every setup-*.ps1 / update-*.ps1 so "git pull + update" always propagates config.
#
# Usage: sync-config.ps1 [claude|pi|opencode|all]
#   default is `claude` so the historical `pwsh -File scripts/sync-config.ps1` keeps working.
#   `all` syncs every harness found on PATH.
param([ValidateSet("claude", "pi", "opencode", "all")][string]$Target = "claude")
$ErrorActionPreference = "Stop"

$Repo = Split-Path $PSScriptRoot -Parent
$UserHome = $env:USERPROFILE   # $HOME is a read-only automatic variable in PowerShell

function Test-Cmd($name) { $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

# Per-skill replace: prunes files removed/renamed inside a repo skill, keeps local-only skills.
# Mirrors sync_skills() in sync-config.sh.
function Sync-Skills($Dest) {
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null

  Get-ChildItem "$Repo\skills" -Directory | ForEach-Object {
    $d = Join-Path $Dest $_.Name
    if (Test-Path $d) { Remove-Item $d -Recurse -Force }
    Copy-Item $_.FullName $d -Recurse
  }

  # Prune every archived stack so it does not stay in the live harness. Without this,
  # react-doctor survived every sync on Windows while sync-config.sh pruned it on pi.
  # A stack that is enabled also has its skills in skills/ above, so it is skipped here.
  # Absent on a sparse clone (bootstrap excludes stacks/) — then there is nothing to prune.
  Get-ChildItem (Join-Path $Repo "stacks") -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $archived = Join-Path $_.FullName "skills"
    if (-not (Test-Path $archived)) { return }
    Get-ChildItem $archived -Directory | ForEach-Object {
      if (Test-Path (Join-Path "$Repo\skills" $_.Name)) { return }
      $stale = Join-Path $Dest $_.Name
      if (Test-Path $stale) { Remove-Item $stale -Recurse -Force }
    }
  }

  # Skills deleted from the repo — see skills/REMOVED.txt for why the list has to exist.
  $removedList = Join-Path $Repo "skills\REMOVED.txt"
  if (Test-Path $removedList) {
    Get-Content $removedList | ForEach-Object {
      $name = ($_ -split "#")[0].Trim()
      if ($name) {
        $stale = Join-Path $Dest $name
        if (Test-Path $stale) { Remove-Item $stale -Recurse -Force }
      }
    }
  }

  # caveman is pruned by sync-config.sh but NOT here: on Windows the Claude Code plugin owns
  # ~/.claude/skills/caveman and OpenCode owns ~/.config/opencode/skills/caveman — this script
  # would delete skills it never installed.
}

# rules/ is entirely repo-owned — full mirror so deleted rules don't linger.
function Sync-Rules($Dest) {
  if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
  Copy-Item "$Repo\rules" $Dest -Recurse
}

# Every harness on this machine shares these.
function Sync-Shared {
  # rules/ live at ~/.claude/rules on EVERY harness — CLAUDE.md's conditional pointers
  # hardcode that path, so it must resolve even where Claude Code is not installed.
  Sync-Rules "$UserHome\.claude\rules"

  # ~/.agents/skills is read natively by pi AND OpenCode (opencode.ai/docs/skills) — one dir,
  # two agents, no second copy.
  Sync-Skills "$UserHome\.agents\skills"

  # agent-browser config is per-MACHINE (~/.agent-browser), read by the CLI on every
  # invocation regardless of harness. Seed only — the live file may grow local state.
  $abConfig = Join-Path $UserHome ".agent-browser\config.json"
  if (-not (Test-Path $abConfig)) {
    New-Item -ItemType Directory -Force -Path (Join-Path $UserHome ".agent-browser\screenshots") | Out-Null
    $esc = $UserHome.Replace('\', '\\')
    (Get-Content "$Repo\agent-browser\config.windows.json" -Raw).Replace('C:\\Users\\tisao', $esc) |
      Set-Content $abConfig -NoNewline
    Write-Host "  seeded ~/.agent-browser/config.json"
  }
}

function Sync-Claude {
  $Claude = Join-Path $UserHome ".claude"
  New-Item -ItemType Directory -Force -Path "$Claude\skills" | Out-Null

  Copy-Item "$Repo\CLAUDE.md" "$Claude\CLAUDE.md" -Force

  # dreaming.md ships with the memory stack (stacks/memory/root/) - present only while
  # that stack is enabled, so a stale copy has to go when it is not.
  $dreaming = Join-Path $Repo "dreaming.md"
  if (Test-Path $dreaming) {
    Copy-Item $dreaming "$Claude\dreaming.md" -Force
  } elseif (Test-Path "$Claude\dreaming.md") {
    Remove-Item "$Claude\dreaming.md" -Force
  }

  Sync-Skills "$Claude\skills"

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
    Write-Host "  settings.json exists - left alone (repo copy seeds fresh machines only)"
  } else {
    # The seed hardcodes this author's profile path; rewrite it for whoever is installing.
    $esc = $UserHome.Replace('\', '\\')
    (Get-Content "$Repo\settings.json" -Raw).Replace('C:\\Users\\tisao', $esc) |
      Set-Content $settings -NoNewline
    Write-Host "  seeded settings.json"
  }
}

# ~/.pi/agent — pi's agent config. Mirrors sync_pi_agent() in sync-config.sh.
function Sync-Pi {
  $piSrc = Join-Path $Repo "pi"
  $agent = Join-Path $UserHome ".pi\agent"
  if (-not (Test-Path $piSrc)) { return }
  New-Item -ItemType Directory -Force -Path "$agent\extensions" | Out-Null

  # pi takes global instructions from ~/.pi/agent/AGENTS.md.
  Copy-Item "$Repo\CLAUDE.md" "$agent\AGENTS.md" -Force

  foreach ($f in "cloak.json", "cursor-sdk.json", "package.json", "tsconfig.json", "models.json", ".gitignore") {
    $src = Join-Path $piSrc $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $agent $f) -Force }
  }

  # settings.json is a MERGE, not a mirror: pi writes its own keys there
  # (lastChangelogVersion, auth state), so only the keys this repo owns are replaced.
  $seed = Get-Content (Join-Path $piSrc "settings.json") -Raw | ConvertFrom-Json -AsHashtable
  $livePath = Join-Path $agent "settings.json"
  $live = @{}
  if (Test-Path $livePath) {
    $live = Get-Content $livePath -Raw | ConvertFrom-Json -AsHashtable
  }
  foreach ($key in "theme", "defaultProvider", "defaultModel", "enabledModels", "defaultThinkingLevel") {
    if ($seed.ContainsKey($key)) { $live[$key] = $seed[$key] }
  }
  $packages = @()
  $seen = @{}
  foreach ($pkg in $seed["packages"]) {
    $key = if ($pkg -is [string]) { $pkg } else { $pkg["source"] }
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    $packages += , $pkg
  }
  $live["packages"] = @($packages)
  ($live | ConvertTo-Json -Depth 10) + "`n" | Set-Content $livePath -NoNewline

  Get-ChildItem "$piSrc\extensions" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $dest = Join-Path "$agent\extensions" $_.Name
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item "$($_.FullName)\*" $dest -Recurse -Force
  }

  # `pi install` resolves each package and registers it; re-running is a no-op.
  if (Test-Cmd pi) {
    foreach ($pkg in $packages) {
      $src = if ($pkg -is [string]) { $pkg } else { $pkg["source"] }
      Write-Host "  pi install $src"
      pi install $src 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { Write-Host "    failed (left for a manual retry)" }
    }
  } else {
    Write-Host "  pi not on PATH - packages not installed (run setup-pi.ps1)"
  }
}

# ~/.config/opencode — OpenCode reads AGENTS.md there globally (opencode.ai/docs/rules).
# Skills need no copy: OpenCode already loads ~/.agents/skills, written by Sync-Shared.
function Sync-OpenCode {
  $oc = Join-Path $UserHome ".config\opencode"
  New-Item -ItemType Directory -Force -Path $oc | Out-Null
  $agents = Join-Path $oc "AGENTS.md"
  $backup = Join-Path $oc "AGENTS.local.md.bak"

  # A hand-maintained AGENTS.md predates this sync path on machines that had OpenCode
  # configured by hand — keep one copy of it instead of dropping it silently.
  if ((Test-Path $agents) -and -not (Test-Path $backup)) {
    $repoText = (Get-Content "$Repo\CLAUDE.md" -Raw)
    if ((Get-Content $agents -Raw) -ne $repoText) {
      Copy-Item $agents $backup -Force
      Write-Host "  kept the previous hand-written AGENTS.md as AGENTS.local.md.bak"
    }
  }
  Copy-Item "$Repo\CLAUDE.md" $agents -Force
}

$targets = if ($Target -eq "all") {
  @("claude", "pi", "opencode") | Where-Object {
    switch ($_) {
      "claude" { Test-Cmd claude }
      "pi" { Test-Cmd pi }
      "opencode" { Test-Cmd opencode }
    }
  }
} else { @($Target) }

if (-not $targets) { throw "no harness found on PATH (claude / pi / opencode)" }

Sync-Shared
foreach ($t in $targets) {
  switch ($t) {
    "claude" { Sync-Claude }
    "pi" { Sync-Pi }
    "opencode" { Sync-OpenCode }
  }
}

Write-Host "Config synced ($($targets -join ', '))."
