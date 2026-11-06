#!/usr/bin/env pwsh
# Install or upgrade browser-harness with uv, installing uv into ~/.local/bin first when it is missing.
# Shared by setup-claude.ps1, setup-opencode.ps1 and update-claude.ps1. Idempotent: re-running upgrades in place.
# Python 3.12 is pinned because uv otherwise picks old releases that still support older Pythons (upstream install.md).
$ErrorActionPreference = "Stop"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}

# `uv tool install --force` deletes the tool's venv before reinstalling. On Windows a running daemon
# holds its Scripts dir, so the delete fails halfway and leaves ModuleNotFoundError: browser_harness.
function Get-BrowserHarnessProcess {
  $toolDir = Join-Path (uv tool dir) "browser-harness"
  Get-CimInstance Win32_Process | Where-Object {
    ($_.ExecutablePath -and $_.ExecutablePath.StartsWith("$toolDir\", [StringComparison]::OrdinalIgnoreCase)) -or
    ($_.Name -like "browser-harness*") -or
    ($_.Name -like "python*" -and $_.CommandLine -match "\s-m\s+browser_harness\.")
  }
}

$running = @(Get-BrowserHarnessProcess)
if ($running.Count -gt 0) {
  $pids = ($running.ProcessId | Sort-Object) -join ", "
  Write-Warning "browser-harness update skipped: running processes hold its files (PIDs $pids). Close them and rerun this script."
} else {
  uv tool install --python 3.12 --upgrade --force browser-harness
}
if (Get-Command browser-harness -ErrorAction SilentlyContinue) { browser-harness --version }
