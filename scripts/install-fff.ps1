#!/usr/bin/env pwsh
# Download the latest stable fff-mcp into ~/.local/bin and register it as the `fff` MCP server
# in each harness on PATH: Claude Code (user scope) and OpenCode (global config).
# Shared by setup-claude.ps1, update-claude.ps1 and setup-opencode.ps1.
# Idempotent: re-running refreshes the exe. Unix equivalent: scripts/install-fff.sh
#
# Not upstream's install-mcp.ps1: it installs the newest release with a Windows asset, a nightly.
$ErrorActionPreference = "Stop"

$Bin = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

$exe = Join-Path $Bin "fff-mcp.exe"
$download = "$exe.download"
Invoke-WebRequest "https://github.com/dmtrKovalenko/fff/releases/latest/download/fff-mcp-x86_64-pc-windows-msvc.exe" -OutFile $download
# An open agent session keeps fff-mcp.exe running, which locks it against overwrite but not rename.
Remove-Item "$exe.old" -Force -ErrorAction SilentlyContinue
if (Test-Path $exe) { Move-Item $exe "$exe.old" -Force }
Move-Item $download $exe
& $exe --version

if (Get-Command claude -ErrorAction SilentlyContinue) {
  claude mcp remove fff -s user 2>$null | Out-Null
  claude mcp add -s user fff -- $exe
}
if (Get-Command opencode -ErrorAction SilentlyContinue) {
  node "$PSScriptRoot\set-opencode-mcp.mjs" fff $exe
  if ($LASTEXITCODE -ne 0) { throw "set-opencode-mcp.mjs exited $LASTEXITCODE" }
}
