#!/usr/bin/env pwsh
<#
One-command install on a fresh Windows machine: clone this repo, then set up each harness.

  # auto: set up every harness already on PATH (claude / pi / opencode)
  irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1 | iex

  # pick the harness (irm | iex cannot take arguments, so wrap it in a scriptblock)
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/YuukiFST/agent-dotfiles/main/scripts/bootstrap.ps1))) -Target pi

`stacks/` is NEVER downloaded: the clone is a non-cone sparse checkout that excludes it,
so the archived stacks cost no disk and cannot leak into a live harness dir. Pass -Full to
get them anyway (needed only by `scripts/stack.sh enable <name>`).
#>
param(
  # auto = every harness found on PATH; all = install all three regardless.
  [ValidateSet("auto", "all", "claude", "pi", "opencode")][string]$Target = "auto",
  [string]$Dest = (Join-Path $env:USERPROFILE "agent-dotfiles"),
  [string]$Ref = "main",
  [switch]$Full
)
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/YuukiFST/agent-dotfiles.git"

function Test-Cmd($name) { $null -ne (Get-Command $name -ErrorAction SilentlyContinue) }

# $ErrorActionPreference does not apply to native executables, so a failed git call would
# otherwise be swallowed and the setup would run against a stale or missing clone.
function Invoke-Git {
  & git @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

# Bring the sparse config in line with -Full, on a fresh clone AND on an existing one:
# the patterns persist in .git/info/sparse-checkout, so re-running with -Full has to
# actively turn them off or stacks/ stays missing with no explanation.
function Set-SparseState($Dest, [bool]$Full) {
  if ($Full) {
    if ((& git -C $Dest config --get core.sparseCheckout) -eq "true") {
      Invoke-Git -C $Dest sparse-checkout disable
    }
    return
  }
  # Non-cone mode is the only one that can express an exclusion.
  "/*`n!/stacks/" | & git -C $Dest sparse-checkout set --no-cone --stdin
  if ($LASTEXITCODE -ne 0) { throw "git sparse-checkout set failed (exit $LASTEXITCODE)" }
}

foreach ($dep in "git", "npm") {
  if (-not (Test-Cmd $dep)) { throw "$dep is required and not on PATH" }
}

# Running from inside an existing clone (scripts/bootstrap.ps1) - use it, don't re-clone.
if ($PSScriptRoot -and (Test-Path (Join-Path (Split-Path $PSScriptRoot -Parent) "CLAUDE.md"))) {
  $Dest = Split-Path $PSScriptRoot -Parent
  Write-Host "Using the clone this script lives in: $Dest"
} elseif (Test-Path (Join-Path $Dest ".git")) {
  Write-Host "Updating existing clone: $Dest"
  Invoke-Git -C $Dest fetch origin $Ref --quiet
  Invoke-Git -C $Dest checkout $Ref --quiet
  Invoke-Git -C $Dest pull --ff-only origin $Ref --quiet
  Set-SparseState $Dest $Full.IsPresent
} else {
  Write-Host "Cloning $RepoUrl -> $Dest"
  Invoke-Git clone --filter=blob:none --no-checkout --branch $Ref $RepoUrl $Dest
  Set-SparseState $Dest $Full.IsPresent
  Invoke-Git -C $Dest checkout $Ref --quiet
}

if (Test-Path (Join-Path $Dest "stacks")) {
  Write-Host "  stacks/ present in this clone (full checkout)"
} else {
  Write-Host "  stacks/ excluded from the checkout"
}

$targets = switch ($Target) {
  "all" { @("claude", "pi", "opencode") }
  "auto" {
    @("claude", "pi", "opencode") | Where-Object {
      switch ($_) { "claude" { Test-Cmd claude } "pi" { Test-Cmd pi } "opencode" { Test-Cmd opencode } }
    }
  }
  default { @($Target) }
}

if (-not $targets) {
  throw "no harness found on PATH. Re-run with -Target pi (or claude / opencode / all)."
}

foreach ($t in $targets) {
  Write-Host ""
  Write-Host "=== $t ==="
  & (Join-Path $Dest "scripts\setup-$t.ps1")
}

Write-Host ""
Write-Host "Bootstrap done: $($targets -join ', '). Repo at $Dest - re-run scripts/setup-<harness>.ps1 to update."
