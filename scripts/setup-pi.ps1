#!/usr/bin/env pwsh
# pi harness setup (Windows). Run from a clone of this repo.
# Idempotent, and doubles as the updater: re-run it to pull the latest pi.
# Unix equivalent: scripts/setup-pi.sh
$ErrorActionPreference = "Stop"

Write-Host "[1/3] pi (npm, latest)"
# Unconditional: `npm install -g @latest` is both the install and the upgrade path, and this
# script is documented as the updater. Skipping it when pi is on PATH would never update.
# --ignore-scripts per pi's own install docs.
npm install -g --ignore-scripts "@earendil-works/pi-coding-agent@latest"
pi --version

Write-Host "[2/3] rtk"
& "$PSScriptRoot\install-rtk.ps1" -Agent pi -AutoPatch

Write-Host "[3/3] pi agent config (AGENTS.md + skills + extensions + packages from pi/)"
& "$PSScriptRoot\sync-config.ps1" pi

Write-Host @"

Done. Restart pi.

- Agent config: ~/.pi/agent (synced from pi/)
- Skills: ~/.agents/skills - global instructions: ~/.pi/agent/AGENTS.md
- RTK: rewrites bash -> rtk (prisma/tsc/vitest: run raw)
- Context compaction: pi-vcc - goal tracking: /goal, /create-goal (pi-codex-goal)
"@
