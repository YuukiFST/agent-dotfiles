#!/usr/bin/env pwsh
# End-to-end test: sync-config.ps1 installs the global commit gate on Windows, as sync-config.sh
# does elsewhere, and the gate keeps working after the checkout it was synced from is gone.
# USERPROFILE, GIT_CONFIG_GLOBAL and rtk point into a temp dir, so the machine's own stay untouched.
# Run: pwsh -NoProfile -File scripts/test-sync-git-hooks.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent
$work = Join-Path ([IO.Path]::GetTempPath()) "sync-git-hooks-$PID"
$home_ = Join-Path $work "home"
$checkout = Join-Path $work "checkout"
New-Item -ItemType Directory -Force -Path $home_, "$work\bin", $checkout | Out-Null
# Sync-Shared writes the rtk config wherever `rtk config` points; this stub prints no path.
"@exit /b 0" | Set-Content "$work\bin\rtk.cmd"
New-Item -ItemType File -Force -Path "$work\gitconfig" | Out-Null

$saved = @{ USERPROFILE = $env:USERPROFILE; GIT_CONFIG_GLOBAL = $env:GIT_CONFIG_GLOBAL; Path = $env:Path; HOME = $env:HOME }
$script:failed = $false
function Expect($what, $ok) {
  if ($ok) { Write-Host "ok: $what" } else { Write-Host "FAILED: $what"; $script:failed = $true }
}

try {
  # Sync from a copy of the working tree, then delete the copy: the worktree-removed case.
  $files = (git -C $root ls-files -z --cached --others --exclude-standard) -split "`0" | Where-Object { $_ }
  foreach ($f in $files) {
    $dest = Join-Path $checkout $f
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    Copy-Item (Join-Path $root $f) $dest
  }

  $env:USERPROFILE = $home_
  $env:HOME = $home_
  $env:GIT_CONFIG_GLOBAL = "$work\gitconfig"
  $env:Path = "$work\bin;$env:Path"

  foreach ($run in 1, 2) {
    $out = & pwsh -NoProfile -File "$checkout\scripts\sync-config.ps1" claude 2>&1 | Out-String
    Expect "sync run $run exits 0" ($LASTEXITCODE -eq 0 -and $out -match "Config synced")
    if ($LASTEXITCODE -ne 0) { Write-Host $out }
  }

  # Leftovers of an interrupted sync go on the next run, and a process whose cwd is the live
  # dir (it blocks renaming it on Windows) makes the sync update the files in place, not abort.
  $live = Join-Path $home_ ".claude\git-hooks"
  New-Item -ItemType Directory -Force -Path "$live.new.orphan", "$live.old" | Out-Null
  $locker = Start-Process pwsh -ArgumentList "-NoProfile", "-Command", "Start-Sleep 120" -WorkingDirectory $live -PassThru -WindowStyle Hidden
  Start-Sleep 2
  $out = & pwsh -NoProfile -File "$checkout\scripts\sync-config.ps1" claude 2>&1 | Out-String
  Expect "sync exits 0 with leftovers and a busy live dir" ($LASTEXITCODE -eq 0 -and $out -match "Config synced")
  if ($LASTEXITCODE -ne 0) { Write-Host $out }
  Stop-Process -Id $locker.Id -Force -ErrorAction SilentlyContinue
  $locker.WaitForExit()
  $leftovers = @(Get-ChildItem (Split-Path $live -Parent) -Directory | Where-Object { $_.Name -like "git-hooks.new.*" -or $_.Name -eq "git-hooks.old" })
  Expect "no git-hooks.new.* or .old left behind" ($leftovers.Count -eq 0)
  if ($leftovers) { Write-Host "  left: $($leftovers.Name -join ', ')" }
  Remove-Item $checkout -Recurse -Force

  $hooksPath = git config --global --get core.hooksPath
  Expect "core.hooksPath points at ~/.claude/git-hooks" ($hooksPath -and (Test-Path $hooksPath) -and
    (Resolve-Path $hooksPath).Path -eq (Resolve-Path $live).Path)
  foreach ($hook in "commit-msg", "pre-push", "validate-commit-message.sh") {
    $same = (Test-Path "$live\$hook") -and
      (Get-FileHash "$root\git-hooks\$hook").Hash -eq (Get-FileHash "$live\$hook").Hash
    Expect "$hook is live and matches the repo" $same
  }
  Expect "hook tests stay out of the live dir" (-not (Test-Path "$live\test-pre-push.sh"))
  $safeCommit = Join-Path $home_ ".local\bin\git-safe-commit"
  Expect "git-safe-commit is installed" ((Test-Path $safeCommit) -and
    (Get-FileHash "$root\scripts\git-safe-commit.sh").Hash -eq (Get-FileHash $safeCommit).Hash)

  # The gate itself: a commit carrying an AI attribution trailer is refused in any repo.
  $repo = Join-Path $work "repo"
  git init -q $repo
  git -C $repo config user.name "Test User"
  git -C $repo config user.email "test@example.invalid"
  git -C $repo config commit.gpgsign false
  Set-Content "$repo\x" "x"
  git -C $repo add x
  "feat: add x`n`nCo-Authored-By: Claude <noreply@anthropic.com>`n" | Set-Content "$work\msg" -NoNewline
  git -C $repo commit -q -F "$work\msg" 2>$null
  Expect "commit with an AI trailer is refused after the checkout is gone" ($LASTEXITCODE -ne 0)
  git -C $repo commit -q -m "feat: add x"
  Expect "a clean commit still goes through" ($LASTEXITCODE -eq 0)
} finally {
  if ($locker) { Stop-Process -Id $locker.Id -Force -ErrorAction SilentlyContinue }
  foreach ($k in $saved.Keys) { Set-Item "Env:$k" $saved[$k] -ErrorAction SilentlyContinue }
  if (-not $saved.HOME) { Remove-Item Env:HOME -ErrorAction SilentlyContinue }
  if (-not $saved.GIT_CONFIG_GLOBAL) { Remove-Item Env:GIT_CONFIG_GLOBAL -ErrorAction SilentlyContinue }
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
}

if ($script:failed) { exit 1 }
