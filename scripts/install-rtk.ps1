#!/usr/bin/env pwsh
# Download the rtk release pinned in rtk-pin.txt into ~/.local/bin, refusing a zip whose SHA256
# differs from the pin, put that dir on the user PATH, and run `rtk init -g`.
# Shared by setup-claude.ps1, setup-pi.ps1, setup-opencode.ps1 and update-claude.ps1.
# Idempotent: re-running reinstalls the same pinned build.
#
# Usage: install-rtk.ps1 [-Agent claude|pi] [-AutoPatch] [-OpenCode]
param([string]$Agent = "", [switch]$AutoPatch, [switch]$OpenCode)
$ErrorActionPreference = "Stop"

$pin = Get-Content (Join-Path $PSScriptRoot "rtk-pin.txt")
$tag = (($pin | Where-Object { $_ -like "tag *" }) -split '\s+')[1]
$asset = "rtk-x86_64-pc-windows-msvc.zip"
$pinLine = $pin | Where-Object { ($_ -split '\s+')[1] -eq $asset } | Select-Object -First 1
if (-not $pinLine) { throw "install-rtk: rtk-pin.txt has no SHA256 for $asset; copy its line from the $tag checksums.txt." }
$expected = ($pinLine -split '\s+')[0]

$tmp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP "rtk-dl-$([guid]::NewGuid())")
try {
  Invoke-WebRequest "https://github.com/rtk-ai/rtk/releases/download/$tag/$asset" -OutFile "$tmp\$asset"
  $actual = (Get-FileHash "$tmp\$asset" -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    throw "install-rtk: SHA256 of $asset ($tag) is $actual, rtk-pin.txt expects $expected; nothing was installed. Compare both with the release page before changing rtk-pin.txt."
  }
  Expand-Archive "$tmp\$asset" -DestinationPath $tmp -Force
  $Bin = Join-Path $env:USERPROFILE ".local\bin"
  New-Item -ItemType Directory -Force -Path $Bin | Out-Null
  Copy-Item (Get-ChildItem $tmp -Recurse -Filter rtk.exe)[0].FullName "$Bin\rtk.exe" -Force
} finally {
  Remove-Item -Recurse -Force $tmp
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$Bin*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$Bin", "User")
  $env:Path += ";$Bin"
}

$initArgs = @("init", "-g")
# Without --agent, rtk also appends @RTK.md to ~/.claude/CLAUDE.md, which the sync owns as a copy of
# GLOBAL.md. --hook-only keeps the hook and the OpenCode plugin and leaves that file alone.
if (-not $Agent) { $initArgs += "--hook-only" }
if ($Agent) { $initArgs += @("--agent", $Agent) }
if ($AutoPatch) { $initArgs += "--auto-patch" }
if ($OpenCode) { $initArgs += "--opencode" }
& "$Bin\rtk.exe" @initArgs | Out-Null
