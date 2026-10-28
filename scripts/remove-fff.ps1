#!/usr/bin/env pwsh
# Unregister the retired `fff` MCP server from each harness on PATH (Claude Code user scope,
# OpenCode global config) and delete the fff-mcp exe from ~/.local/bin.
# Shared by setup-claude.ps1, update-claude.ps1 and setup-opencode.ps1, so a machine set up
# while fff was installed converges on its next setup run. Idempotent.
# Unix equivalent: scripts/remove-fff.sh
$ErrorActionPreference = "Stop"

if (Get-Command claude -ErrorAction SilentlyContinue) {
  claude mcp get fff 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    claude mcp remove fff -s user
    if ($LASTEXITCODE -ne 0) { throw "claude mcp remove fff exited $LASTEXITCODE" }
  }
}
if (Get-Command opencode -ErrorAction SilentlyContinue) {
  node "$PSScriptRoot\remove-opencode-mcp.mjs" fff
  if ($LASTEXITCODE -ne 0) { throw "remove-opencode-mcp.mjs exited $LASTEXITCODE" }
}

$exe = Join-Path $env:USERPROFILE ".local\bin\fff-mcp.exe"
foreach ($file in $exe, "$exe.old", "$exe.download") {
  if (-not (Test-Path $file)) { continue }
  # An open agent session keeps fff-mcp.exe running and locked; the next run deletes it.
  try { Remove-Item $file -Force } catch { Write-Host "  $file in use, close the agent sessions and rerun" }
}
