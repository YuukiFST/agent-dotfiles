#!/usr/bin/env pwsh
# End-to-end test for install-rtk.ps1 against the real GitHub release, with USERPROFILE in a temp dir:
# a pin whose SHA256 does not match the release installs nothing, and on CI the pinned build
# installs and reports the pinned version. The second case runs only under GitHub Actions because
# install-rtk.ps1 appends to the user PATH in the registry and runs `rtk init -g`, which a temp
# USERPROFILE does not contain.
# Run: pwsh -NoProfile -File scripts/test-install-rtk.ps1
$ErrorActionPreference = "Stop"

$work = New-Item -ItemType Directory -Path (Join-Path ([IO.Path]::GetTempPath()) "test-install-rtk-$([guid]::NewGuid())")
$realProfile = $env:USERPROFILE
$pass = 0
$fail = 0
function Check([string]$name, [bool]$ok) {
  if ($ok) { $script:pass++ } else { $script:fail++; Write-Host "FAILED: $name" }
}

try {
  $pinPath = Join-Path $PSScriptRoot "rtk-pin.txt"
  $tag = ((Get-Content $pinPath | Where-Object { $_ -like "tag *" }) -split '\s+')[1]

  $tampered = New-Item -ItemType Directory -Path (Join-Path $work "tampered")
  Copy-Item (Join-Path $PSScriptRoot "install-rtk.ps1") $tampered
  Get-Content $pinPath | ForEach-Object { $_ -replace '^[0-9a-f]{64}  ', ('0' * 64 + '  ') } |
    Set-Content (Join-Path $tampered "rtk-pin.txt")
  $env:USERPROFILE = Join-Path $work "bad"
  $badLog = & pwsh -NoProfile -File (Join-Path $tampered "install-rtk.ps1") 2>&1 | Out-String
  Check "hash mismatch exits non-zero" ($LASTEXITCODE -ne 0)
  Check "hash mismatch installs nothing" (-not (Test-Path (Join-Path $work "bad\.local\bin\rtk.exe")))
  Check "hash mismatch says nothing was installed" ($badLog -match "nothing was installed")
  if ($fail -ne 0) { $badLog -split "`n" | ForEach-Object { Write-Host "  bad: $_" } }

  if ($env:GITHUB_ACTIONS -eq "true") {
    $env:USERPROFILE = Join-Path $work "good"
    $goodLog = & pwsh -NoProfile -File (Join-Path $PSScriptRoot "install-rtk.ps1") 2>&1 | Out-String
    Check "pinned build installs" ($LASTEXITCODE -eq 0)
    $version = & (Join-Path $work "good\.local\bin\rtk.exe") --version 2>&1 | Out-String
    Check "installed rtk reports $tag" ($version -match [regex]::Escape($tag.TrimStart("v")))
    if ($fail -ne 0) { $goodLog -split "`n" | ForEach-Object { Write-Host "  good: $_" } }
  } else {
    Write-Host "skipped: pinned install (runs only under GitHub Actions; it writes the user PATH)"
  }
} finally {
  $env:USERPROFILE = $realProfile
  Remove-Item -Recurse -Force $work
}

Write-Host "ok: $pass | failed: $fail"
if ($fail -ne 0) { exit 1 }
