#!/usr/bin/env pwsh
# Download rtk into ~/.local/bin, put that dir on the user PATH, and run `rtk init -g`.
# Shared by setup-claude.ps1 and setup-pi.ps1. Idempotent: re-running just refreshes the exe.
#
# Usage: install-rtk.ps1 [-Agent claude|pi] [-AutoPatch]
param([string]$Agent = "", [switch]$AutoPatch)
$ErrorActionPreference = "Stop"

$Bin = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

$rtkUrl = (Invoke-RestMethod "https://api.github.com/repos/rtk-ai/rtk/releases/latest").assets |
  Where-Object name -EQ "rtk-x86_64-pc-windows-msvc.zip" | ForEach-Object browser_download_url
$tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "rtk-dl")
Invoke-WebRequest $rtkUrl -OutFile "$tmp\rtk.zip"
Expand-Archive "$tmp\rtk.zip" -DestinationPath $tmp -Force
Copy-Item (Get-ChildItem $tmp -Recurse -Filter rtk.exe)[0].FullName "$Bin\rtk.exe" -Force
Remove-Item -Recurse -Force $tmp

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$Bin*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$Bin", "User")
  $env:Path += ";$Bin"
}

$initArgs = @("init", "-g")
if ($Agent) { $initArgs += @("--agent", $Agent) }
if ($AutoPatch) { $initArgs += "--auto-patch" }
& "$Bin\rtk.exe" @initArgs | Out-Null
