# End-to-end test for sync-config.ps1, the Windows sync: runs the claude, pi and opencode
# targets twice each against a temporary home holding state an earlier sync or a hand edit
# left behind, then checks what each live dir holds.
# Stub pi and rtk commands on PATH keep every write inside the temporary home: the real rtk
# names a config path under %APPDATA%. Mirrors scripts/test-sync-pi.sh and test-sync-opencode.sh.
# Run: pwsh -NoProfile -File scripts/test-sync-config-windows.ps1
$ErrorActionPreference = "Stop"

$Repo = Split-Path $PSScriptRoot -Parent
$Sync = Join-Path $PSScriptRoot "sync-config.ps1"
$Work = Join-Path ([IO.Path]::GetTempPath()) ("sync-windows-" + [guid]::NewGuid().ToString("N"))
$TempHome = Join-Path $Work "home"
$StubBin = Join-Path $Work "bin"
$Claude = Join-Path $TempHome ".claude"
$Agent = Join-Path $TempHome ".pi\agent"
$OpenCode = Join-Path $TempHome ".config\opencode"
$PiLog = Join-Path $Work "pi.log"

# State an earlier sync or a hand edit left behind.
New-Item -ItemType Directory -Force -Path "$Claude\rules", "$Claude\skills\prove", "$TempHome\.agents\skills\prove",
  "$TempHome\.agents\skills\local-only", "$Agent\bin", "$OpenCode\commands", "$OpenCode\agents", $StubBin | Out-Null
Set-Content "$Claude\rules\hand-written.md" "gone after a sync"
Set-Content "$Claude\skills\prove\SKILL.md" "listed in REMOVED.txt"
Set-Content "$TempHome\.agents\skills\prove\SKILL.md" "listed in REMOVED.txt"
Set-Content "$TempHome\.agents\skills\local-only\SKILL.md" "kept"
Set-Content "$Agent\package.json" '{ "type": "module" }'
Set-Content "$Agent\bin\package.json" '{ "type": "commonjs" }'
Set-Content "$Agent\settings.json" '{ "defaultModel": "machine-choice", "lastChangelogVersion": "1.0.0" }'
Set-Content "$OpenCode\AGENTS.md" "hand-written instructions"
Set-Content "$OpenCode\commands\grilling.md" "<!-- generated:opencode-skill-command -->"
Set-Content "$OpenCode\commands\mine.md" "hand-written command"
Set-Content "$OpenCode\agents\interrogate-reviewer-9.md" "row deleted from reviewers.md"

Set-Content "$StubBin\pi.cmd" "@if `"%1`"==`"install`" echo %* >> `"$PiLog`"`r`n@echo pi stub"
Set-Content "$StubBin\rtk.cmd" "@echo Config: $TempHome\rtk\config.toml"

$failures = 0
function Expect([string]$What, [bool]$Ok) {
  if ($Ok) { Write-Host "ok: $What" } else { Write-Host "FAILED: $What"; $script:failures++ }
}
function Test-SameFile([string]$RepoFile, [string]$Live) {
  (Test-Path $Live) -and ((Get-FileHash (Join-Path $Repo $RepoFile)).Hash -eq (Get-FileHash $Live).Hash)
}
function Invoke-Sync([string]$Target) {
  $env:USERPROFILE = $TempHome; $env:HOME = $TempHome; $env:PATH = "$StubBin;$savedPath"
  & pwsh -NoProfile -File $Sync $Target *> $null
  $code = $LASTEXITCODE
  $env:USERPROFILE = $savedProfile; $env:HOME = $savedHome; $env:PATH = $savedPath
  return $code
}

$savedProfile = $env:USERPROFILE; $savedHome = $env:HOME; $savedPath = $env:PATH
try {
  foreach ($target in "claude", "pi", "opencode") {
    foreach ($run in 1, 2) { Expect "sync $target run $run exits 0" ((Invoke-Sync $target) -eq 0) }
  }

  # Shared by every target.
  Expect "CODING_STANDARDS.md lands in ~/.claude" (Test-SameFile "CODING_STANDARDS.md" "$Claude\CODING_STANDARDS.md")
  Expect "PROMPT_ENGINEERING.md lands in ~/.claude" (Test-SameFile "PROMPT_ENGINEERING.md" "$Claude\PROMPT_ENGINEERING.md")
  Expect "rules/ is mirrored" (Test-SameFile "rules\git.md" "$Claude\rules\git.md")
  Expect "a live rule the repo lacks is gone" (-not (Test-Path "$Claude\rules\hand-written.md"))
  Expect "skills reach ~/.agents/skills" (Test-SameFile "skills\grilling\SKILL.md" "$TempHome\.agents\skills\grilling\SKILL.md")
  Expect "a local-only skill stays" (Test-Path "$TempHome\.agents\skills\local-only\SKILL.md")
  Expect "a REMOVED.txt skill leaves ~/.agents/skills" (-not (Test-Path "$TempHome\.agents\skills\prove"))
  Expect "a REMOVED.txt skill leaves ~/.claude/skills" (-not (Test-Path "$Claude\skills\prove"))
  Expect "rtk config lands where rtk config points" (Test-SameFile "rtk\config.toml" "$TempHome\rtk\config.toml")

  # claude
  Expect "GLOBAL.md lands as ~/.claude/CLAUDE.md" (Test-SameFile "GLOBAL.md" "$Claude\CLAUDE.md")
  Expect "skills reach ~/.claude/skills" (Test-SameFile "skills\grilling\SKILL.md" "$Claude\skills\grilling\SKILL.md")
  Expect "hooks reach ~/.claude/hooks" (Test-SameFile "hooks\statusline.ps1" "$Claude\hooks\statusline.ps1")
  $mod = Get-ChildItem "$Repo\mods" -Directory | Select-Object -First 1
  Expect "mods reach ~/.claude/mods" (Test-Path "$Claude\mods\$($mod.Name)")
  $settings = Get-Content "$Claude\settings.json" -Raw
  Expect "settings.json is seeded with this home's path" (($settings -notmatch 'tisao') -and ($settings -match [regex]::Escape($TempHome.Replace('\', '\\'))))
  Set-Content "$Claude\settings.json" '{ "machine": true }'
  Expect "sync claude over an existing settings.json exits 0" ((Invoke-Sync "claude") -eq 0)
  Expect "an existing settings.json is left alone" ((Get-Content "$Claude\settings.json" -Raw) -match '"machine"')

  # pi
  Expect "GLOBAL.md lands as ~/.pi/agent/AGENTS.md" (Test-SameFile "GLOBAL.md" "$Agent\AGENTS.md")
  Expect "no package.json in ~/.pi/agent" (-not (Test-Path "$Agent\package.json"))
  Expect "no package.json in ~/.pi/agent/bin" (-not (Test-Path "$Agent\bin\package.json"))
  Expect "pi extensions are copied" (Test-Path "$Agent\extensions\caveman\index.js")
  $piSettings = Get-Content "$Agent\settings.json" -Raw | ConvertFrom-Json
  Expect "a live defaultModel survives the merge" ($piSettings.defaultModel -eq "machine-choice")
  Expect "a pi-owned key survives the merge" ($piSettings.lastChangelogVersion -eq "1.0.0")
  Expect "repo-owned enabledModels converge" ($piSettings.enabledModels.Count -gt 0)
  Expect "settings.json packages are installed through pi" ((Test-Path $PiLog) -and ((Get-Content $PiLog -Raw) -match 'install npm:pi-codex-goal'))

  # opencode
  Expect "GLOBAL.md lands as ~/.config/opencode/AGENTS.md" (Test-SameFile "GLOBAL.md" "$OpenCode\AGENTS.md")
  Expect "the hand-written AGENTS.md is kept as a backup" ((Get-Content "$OpenCode\AGENTS.local.md.bak" -Raw) -match 'hand-written')
  Expect "a generated skill command wrapper is removed" (-not (Test-Path "$OpenCode\commands\grilling.md"))
  Expect "a hand-written command stays" (Test-Path "$OpenCode\commands\mine.md")
  Expect "reviewer agents are generated from reviewers.md" ((Get-Content "$OpenCode\agents\interrogate-reviewer-1.md" -Raw) -match 'model: opencode-go/')
  Expect "an agent for a deleted reviewer row is removed" (-not (Test-Path "$OpenCode\agents\interrogate-reviewer-9.md"))
} finally {
  $env:USERPROFILE = $savedProfile; $env:HOME = $savedHome; $env:PATH = $savedPath
  Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
}
exit [int]($failures -gt 0)
