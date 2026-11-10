# sync-config.ps1 replaces each skill and rules/ through a staging copy and a rename,
# so a copy that fails halfway (a locked file, an interrupted run) leaves the live dir intact.
# Holds one repo file open without sharing, so the sync's Copy-Item of its dir fails.
# Mirrors scripts/test-sync-replace-on-failure.sh.
# Run: pwsh -NoProfile -File scripts/test-sync-replace-on-failure.ps1
$ErrorActionPreference = "Stop"

$Repo = Split-Path $PSScriptRoot -Parent
$Sync = Join-Path $PSScriptRoot "sync-config.ps1"
$Work = Join-Path ([IO.Path]::GetTempPath()) ("sync-replace-" + [guid]::NewGuid().ToString("N"))
$TempHome = Join-Path $Work "home"
$StubBin = Join-Path $Work "bin"
$Skills = Join-Path $TempHome ".agents\skills"
$Rules = Join-Path $TempHome ".claude\rules"
New-Item -ItemType Directory -Force -Path "$Skills\grilling", $Rules, $StubBin | Out-Null
Set-Content "$Skills\grilling\SKILL.md" "previous sync"
Set-Content "$Rules\git.md" "previous sync"
# rtk config would name a path outside this home (%APPDATA% on Windows).
Set-Content "$StubBin\rtk.cmd" "@echo Config: $TempHome\rtk\config.toml"

$failures = 0
function Expect([string]$What, [bool]$Ok) {
  if ($Ok) { Write-Host "ok: $What" } else { Write-Host "FAILED: $What"; $script:failures++ }
}

function Invoke-Sync {
  $env:USERPROFILE = $TempHome; $env:HOME = $TempHome
  $env:PATH = "$StubBin;$savedPath"
  & pwsh -NoProfile -File $Sync opencode *> $null
  $code = $LASTEXITCODE
  $env:USERPROFILE = $savedProfile; $env:HOME = $savedHome; $env:PATH = $savedPath
  return $code
}

function Invoke-SyncWithLocked([string]$RepoFile) {
  $lock = [IO.File]::Open((Join-Path $Repo $RepoFile), 'Open', 'Read', 'None')
  try { return Invoke-Sync } finally { $lock.Dispose() }
}

function Test-PreviousSync([string]$File) {
  (Test-Path $File) -and ((Get-Content $File -Raw) -match 'previous sync')
}

function Test-NoStaging([string]$Dir) {
  -not [bool](Get-ChildItem $Dir -Force -ErrorAction SilentlyContinue | Where-Object Name -match 'sync')
}

$savedProfile = $env:USERPROFILE; $savedHome = $env:HOME; $savedPath = $env:PATH
try {
  Expect "sync whose rules/ copy fails exits non-zero" ((Invoke-SyncWithLocked "rules\git.md") -ne 0)
  Expect "rules/ keeps its previous files" (Test-PreviousSync "$Rules\git.md")
  Expect "sync whose skill copy fails exits non-zero" ((Invoke-SyncWithLocked "skills\grilling\SKILL.md") -ne 0)
  Expect "the skill keeps its previous files" (Test-PreviousSync "$Skills\grilling\SKILL.md")
  Expect "sync without failures exits 0" ((Invoke-Sync) -eq 0)
  Expect "rules/ converges on the repo copy" ((Get-FileHash "$Rules\git.md").Hash -eq (Get-FileHash "$Repo\rules\git.md").Hash)
  Expect "the skill converges on the repo copy" ((Get-FileHash "$Skills\grilling\SKILL.md").Hash -eq (Get-FileHash "$Repo\skills\grilling\SKILL.md").Hash)
  Expect "no staging dir left among the skills" (Test-NoStaging $Skills)
  Expect "no staging dir left in ~/.claude" (Test-NoStaging "$TempHome\.claude")
  Expect "no staging dir left in ~/.agents" (Test-NoStaging "$TempHome\.agents")
} finally {
  $env:USERPROFILE = $savedProfile; $env:HOME = $savedHome; $env:PATH = $savedPath
  Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
}
exit [int]($failures -gt 0)
