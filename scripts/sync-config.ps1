#!/usr/bin/env pwsh
# Copy config (GLOBAL.md, CODING_STANDARDS.md, PROMPT_ENGINEERING.md, skills/, rules/, plus any root payload an active stack adds)
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

# PS 5.1 lacks ConvertFrom-Json -AsHashtable; the merge below needs dictionaries.
function ConvertTo-HashtableCompat($Object) {
  if ($null -eq $Object) { return $null }
  if ($Object -is [System.Collections.IDictionary]) { return $Object }
  if ($Object -is [System.Management.Automation.PSCustomObject]) {
    $h = @{}
    foreach ($p in $Object.PSObject.Properties) {
      $v = $p.Value
      if ($v -is [System.Management.Automation.PSCustomObject]) {
        $v = ConvertTo-HashtableCompat $v
      } elseif ($v -is [System.Collections.IEnumerable] -and $v -isnot [string]) {
        $v = @($v | ForEach-Object { if ($_ -is [System.Management.Automation.PSCustomObject]) { ConvertTo-HashtableCompat $_ } else { $_ } })
      }
      $h[$p.Name] = $v
    }
    return $h
  }
  return $Object
}

# Archived stacks + REMOVED.txt, no copy. Mirrors prune_stale_skills() in sync-config.sh.
function Remove-StaleSkills($Dest) {
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null

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
      if (-not $name) { return }
      # A name back in skills/ (re-enabled stack, e.g. effect) wins over the list.
      if (Test-Path (Join-Path "$Repo\skills" $name)) { return }
      $stale = Join-Path $Dest $name
      if (Test-Path $stale) { Remove-Item $stale -Recurse -Force }
    }
  }

  # caveman is pruned by sync-config.sh but NOT here: on Windows the Claude Code plugin owns
  # ~/.claude/skills/caveman and OpenCode owns ~/.config/opencode/skills/caveman — this script
  # would delete skills it never installed.
}

# Per-skill replace: prunes files removed/renamed inside a repo skill, keeps local-only skills.
# Mirrors sync_skills() in sync-config.sh.
function Sync-Skills($Dest) {
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Get-ChildItem "$Repo\skills" -Directory | ForEach-Object {
    $d = Join-Path $Dest $_.Name
    if (Test-Path $d) { Remove-Item $d -Recurse -Force }
    Copy-Item $_.FullName $d -Recurse
  }
  Remove-StaleSkills $Dest
}

# rules/ is entirely repo-owned — full mirror so deleted rules don't linger.
function Sync-Rules($Dest) {
  if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
  Copy-Item "$Repo\rules" $Dest -Recurse
}

# Every harness on this machine shares these.
function Sync-Shared {
  # rules/ live at ~/.claude/rules on EVERY harness — GLOBAL.md's conditional pointers
  # hardcode that path, so it must resolve even where Claude Code is not installed.
  Sync-Rules "$UserHome\.claude\rules"
  # Sits outside rules/ on purpose: Claude Code auto-loads every rules/*.md, and this file
  # is disclosed — read only when GLOBAL.md's pointer fires before a project edit.
  Copy-Item "$Repo\CODING_STANDARDS.md" "$UserHome\.claude\CODING_STANDARDS.md" -Force
  # Same reason; read only when rules/prompting.md's pointer fires.
  Copy-Item "$Repo\PROMPT_ENGINEERING.md" "$UserHome\.claude\PROMPT_ENGINEERING.md" -Force

  # rtk reads its config from an OS-specific dir that `rtk config` prints. The repo owns the
  # whole file, so the exclusions reach every harness whose rtk hook rewrites commands.
  # Mirrors sync_shared() in sync-config.sh.
  if (Test-Cmd rtk) {
    $rtkConfig = rtk config 2>$null | Select-String '^Config: (.+)$' | Select-Object -First 1
    if ($rtkConfig) {
      $rtkPath = $rtkConfig.Matches[0].Groups[1].Value.Trim()
      New-Item -ItemType Directory -Force -Path (Split-Path $rtkPath -Parent) | Out-Null
      Copy-Item "$Repo\rtk\config.toml" $rtkPath -Force
    }
  }

  # ~/.agents/skills is read natively by pi AND OpenCode (opencode.ai/docs/skills) — one dir,
  # two agents, no second copy.
  Sync-Skills "$UserHome\.agents\skills"

  # A pi/OpenCode-only sync still has to clean ~/.claude/skills: it can hold archived stack
  # copies from an earlier claude sync. Prune only — no mirror, no copy.
  if (Test-Path "$UserHome\.claude\skills") {
    Remove-StaleSkills "$UserHome\.claude\skills"
  }
}

function Sync-Claude {
  $Claude = Join-Path $UserHome ".claude"
  New-Item -ItemType Directory -Force -Path "$Claude\skills" | Out-Null

  Copy-Item "$Repo\GLOBAL.md" "$Claude\CLAUDE.md" -Force

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

  # mods/ — copied over, never replaced: Claude Code writes each mod's .claude-plugin/types/
  # itself, and the mod's tsconfig.json extends it.
  Get-ChildItem "$Repo\mods" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $dest = Join-Path "$Claude\mods" $_.Name
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item "$($_.FullName)\*" $dest -Recurse -Force
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
  Copy-Item "$Repo\GLOBAL.md" "$agent\AGENTS.md" -Force

  foreach ($f in "cloak.json", "tsconfig.json", "models.json", ".gitignore") {
    $src = Join-Path $piSrc $f
    if (Test-Path $src) { Copy-Item $src (Join-Path $agent $f) -Force }
  }

  # pi/package.json is for tsc only. Its "type": "module" in ~/.pi/agent made Node load
  # pi's CommonJS launcher (bin/pi-launcher.js) as ESM (#148); each extension declares
  # its own type in extensions/<name>/package.json instead. Remove the package.json files
  # earlier syncs wrote, root first: a root that stays must keep the bin/ override (#150).
  foreach ($stale in "$agent\package.json", "$agent\bin\package.json") {
    if (Test-Path $stale) { Remove-Item $stale -Force }
  }

  # settings.json is a MERGE, not a mirror: pi writes its own keys there
  # (lastChangelogVersion, auth state), so only the keys this repo owns are replaced.
  # Same split as sync_pi_agent() in sync-config.sh - keep the two in step.
  $seed = ConvertTo-HashtableCompat (Get-Content (Join-Path $piSrc "settings.json") -Raw | ConvertFrom-Json)
  $livePath = Join-Path $agent "settings.json"
  $fresh = -not (Test-Path $livePath)
  $live = @{}
  if (-not $fresh) {
    $live = ConvertTo-HashtableCompat (Get-Content $livePath -Raw | ConvertFrom-Json)
  }
  # Repo-owned keys - always converge on sync.
  foreach ($key in "theme", "enabledModels") {
    if ($seed.ContainsKey($key)) { $live[$key] = $seed[$key] }
  }
  # Machine-specific keys - seed a fresh install only; never overwrite a live choice.
  foreach ($key in "defaultProvider", "defaultModel", "defaultThinkingLevel") {
    if ($seed.ContainsKey($key) -and ($fresh -or -not $live.ContainsKey($key))) {
      $live[$key] = $seed[$key]
    }
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
  # A pi that cannot start fails every install below with the same hidden error (#148).
  if (Test-Cmd pi) {
    $piVersion = pi --version 2>&1
    if ($LASTEXITCODE -ne 0) {
      $piError = $piVersion | Where-Object { "$_" -match 'Error' } | Select-Object -First 1
      if (-not $piError) { $piError = $piVersion | Select-Object -Last 1 }
      Write-Warning "pi does not start, packages not installed: $piError"
      return
    }
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
    $repoText = (Get-Content "$Repo\GLOBAL.md" -Raw)
    if ((Get-Content $agents -Raw) -ne $repoText) {
      Copy-Item $agents $backup -Force
      Write-Host "  kept the previous hand-written AGENTS.md as AGENTS.local.md.bak"
    }
  }
  Copy-Item "$Repo\GLOBAL.md" $agents -Force
  Sync-OpenCodeReviewers $oc
  Remove-OpenCodeSkillCommands $oc
}

# OpenCode lists every skill as a /name command on its own. A generated commands/<skill>.md
# wrapper shadows that entry with a frozen copy of the description, and outlives the skill
# it points at, so wrappers carrying the generator's marker go. Hand-written commands stay.
# Mirrors prune_opencode_skill_commands() in sync-config.sh.
function Remove-OpenCodeSkillCommands($oc) {
  $wrappers = @(Get-ChildItem (Join-Path $oc "commands") -Filter "*.md" -File -ErrorAction SilentlyContinue |
    Where-Object { Select-String -Path $_.FullName -Pattern "generated:opencode-skill-command" -SimpleMatch -Quiet })
  if (-not $wrappers) { return }
  $wrappers | Remove-Item -Force
  Write-Host "  removed $($wrappers.Count) generated skill command wrapper(s) from $oc\commands"
}

# OpenCode's task tool takes no model, so each opencode row of skills/interrogate/reviewers.md
# becomes an agent pinned to that row's model. Mirrors sync_opencode_reviewers() in sync-config.sh.
function Sync-OpenCodeReviewers($oc) {
  $dir = Join-Path $oc "agents"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  # The interrogate-reviewer- prefix is repo-owned: clearing it drops agents for deleted rows.
  Get-ChildItem $dir -Filter "interrogate-reviewer-*.md" | Remove-Item -Force
  # Row grammar, shared with sync-config.sh: split on |, trim each cell, harness cell exactly
  # "opencode", trailing pipe and effort cell optional. A row it can't use is warned, never skipped silently.
  $n = 0
  foreach ($line in Get-Content (Join-Path $Repo "skills\interrogate\reviewers.md")) {
    $row = $line.Trim()
    if (-not $row.StartsWith("|")) { continue }
    $cells = @($row.Substring(1).Split("|") | ForEach-Object { $_.Trim() })
    if ($cells[0] -cne "opencode") { continue }
    $model = if ($cells.Count -gt 1) { $cells[1] } else { "" }
    $effort = if ($cells.Count -gt 2) { $cells[2] } else { "" }
    if ($model -eq "" -or $model -match '\s' -or $effort -match '\s') {
      Write-Warning "skills/interrogate/reviewers.md: unusable opencode row, no agent written: $line"
      continue
    }
    $n++
    $variant = if ($effort) { "variant: $effort`n" } else { "" }
    $label = if ($effort) { "$model ($effort)" } else { $model }
    $agent = "---`n" +
      "description: Read-only interrogate reviewer on $label, generated by sync-config from skills/interrogate/reviewers.md (edit that file and re-sync)`n" +
      "mode: subagent`n" +
      "model: $model`n" +
      $variant +
      "permission:`n  edit: deny`n  bash: deny`n  webfetch: deny`n" +
      "---`n" +
      "Follow the review prompt you receive and return your findings in its output format.`n"
    Set-Content -Path (Join-Path $dir "interrogate-reviewer-$n.md") -Value $agent -NoNewline
  }
  Write-Host "  wrote $n interrogate reviewer agent(s) to $dir"
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
