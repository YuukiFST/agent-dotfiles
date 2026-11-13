#!/usr/bin/env pwsh
# Install or upgrade the browser-use CLI with uv, installing uv into ~/.local/bin first when it is missing.
# Shared by setup-claude.ps1, setup-opencode.ps1 and update-claude.ps1. Idempotent: re-running upgrades in place.
# browser-use pins the browser-harness engine and replaces its standalone CLI (browser-harness README),
# so a leftover browser-harness tool is uninstalled to keep one daemon and one skill text on PATH.
# Python 3.12 is pinned because uv otherwise picks old releases that still support older Pythons.
$ErrorActionPreference = "Stop"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}

# `uv tool install --force` deletes the tool's venv before reinstalling. On Windows a running daemon
# holds its Scripts dir, so the delete fails halfway and leaves ModuleNotFoundError: browser_harness.
# The engine's daemon keeps its browser_harness module name inside the browser-use tool.
function Get-BrowserToolProcess {
  $toolsRoot = uv tool dir
  $toolDirs = "browser-use", "browser-harness" | ForEach-Object { Join-Path $toolsRoot $_ }
  Get-CimInstance Win32_Process | Where-Object {
    $exe = $_.ExecutablePath
    ($exe -and ($toolDirs | Where-Object { $exe.StartsWith("$_\", [StringComparison]::OrdinalIgnoreCase) })) -or
    ($_.Name -like "browser-use*") -or ($_.Name -like "browser-harness*") -or
    ($_.Name -like "python*" -and $_.CommandLine -match "\s-m\s+browser_harness\.")
  }
}

$running = @(Get-BrowserToolProcess)
if ($running.Count -gt 0) {
  $pids = ($running.ProcessId | Sort-Object) -join ", "
  Write-Warning "browser-use update skipped: running processes hold its files (PIDs $pids). Close them and rerun this script."
} else {
  uv tool install --python 3.12 --upgrade --force browser-use
  if ((uv tool list) -match "^browser-harness ") { uv tool uninstall browser-harness }
}
if (Get-Command browser-use -ErrorAction SilentlyContinue) { browser-use --version }
