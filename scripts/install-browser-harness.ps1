#!/usr/bin/env pwsh
# Install or upgrade browser-harness with uv, installing uv into ~/.local/bin first when it is missing.
# Shared by setup-claude.ps1, setup-opencode.ps1 and update-claude.ps1. Idempotent: re-running upgrades in place.
# Python 3.12 is pinned because uv otherwise picks old releases that still support older Pythons (upstream install.md).
$ErrorActionPreference = "Stop"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}
uv tool install --python 3.12 --upgrade --force browser-harness
browser-harness --version
