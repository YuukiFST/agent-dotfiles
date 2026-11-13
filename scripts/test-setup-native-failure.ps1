# A setup script whose native command fails (npm, claude, pi, opencode, node) must stop with
# a non-zero exit instead of printing "Done". Each script runs from a temporary scripts/ dir
# whose sibling scripts (sync-config, install-rtk, ...) are empty stubs, with stub commands on
# PATH, so nothing reaches the network or this machine's config.
# update-claude.ps1 downloads rtk from GitHub before its first native command, so it is not run here.
# Run: pwsh -NoProfile -File scripts/test-setup-native-failure.ps1
$ErrorActionPreference = "Stop"

$Scripts = $PSScriptRoot
$Work = Join-Path ([IO.Path]::GetTempPath()) ("setup-native-" + [guid]::NewGuid().ToString("N"))
$TempHome = Join-Path $Work "home"
$StubScripts = Join-Path $Work "scripts"
$StubBin = Join-Path $Work "bin"
New-Item -ItemType Directory -Force -Path $TempHome, $StubScripts, $StubBin | Out-Null

foreach ($sibling in "sync-config.ps1", "install-rtk.ps1", "install-browser-use.ps1", "remove-fff.ps1") {
  Set-Content (Join-Path $StubScripts $sibling) "# stub: takes any arguments, does nothing"
}
foreach ($helper in Get-ChildItem $Scripts -Filter "*.ps1" | Where-Object Name -like "invoke-*") {
  Copy-Item $helper.FullName $StubScripts
}
Set-Content (Join-Path $StubScripts "opencode-plugins.mjs") ""
Set-Content (Join-Path $StubScripts "add-opencode-tui-plugin.mjs") ""

$failures = 0
function Expect([string]$What, [bool]$Ok) {
  if ($Ok) { Write-Host "ok: $What" } else { Write-Host "FAILED: $What"; $script:failures++ }
}

# Runs one setup script with every stub command exiting 0 except $FailingCommand.
function Invoke-Setup([string]$Script, [string]$FailingCommand) {
  Get-ChildItem $StubBin | Remove-Item -Force
  foreach ($cmd in "npm", "claude", "pi", "opencode", "node") {
    $code = if ($cmd -eq $FailingCommand) { 1 } else { 0 }
    Set-Content (Join-Path $StubBin "$cmd.cmd") "@exit /b $code"
  }
  Copy-Item (Join-Path $Scripts $Script) $StubScripts -Force
  $env:USERPROFILE = $TempHome; $env:HOME = $TempHome; $env:PATH = "$StubBin;$savedPath"
  $out = & pwsh -NoProfile -File (Join-Path $StubScripts $Script) 2>&1 | Out-String
  $code = $LASTEXITCODE
  $env:USERPROFILE = $savedProfile; $env:HOME = $savedHome; $env:PATH = $savedPath
  return [pscustomobject]@{ Code = $code; Done = $out -match 'Done\.' }
}

$savedProfile = $env:USERPROFILE; $savedHome = $env:HOME; $savedPath = $env:PATH
try {
  foreach ($case in @(
      @("setup-claude.ps1", "npm"), @("setup-claude.ps1", "claude"),
      @("setup-opencode.ps1", "npm"), @("setup-opencode.ps1", "opencode"), @("setup-opencode.ps1", "node"),
      @("setup-pi.ps1", "npm"), @("setup-pi.ps1", "pi"))) {
    $script, $failing = $case
    $run = Invoke-Setup $script $failing
    Expect "$script stops when $failing fails" (($run.Code -ne 0) -and -not $run.Done)
  }
  foreach ($script in "setup-claude.ps1", "setup-opencode.ps1", "setup-pi.ps1") {
    $run = Invoke-Setup $script ""
    Expect "$script reaches Done when every command succeeds" (($run.Code -eq 0) -and $run.Done)
  }
} finally {
  $env:USERPROFILE = $savedProfile; $env:HOME = $savedHome; $env:PATH = $savedPath
  Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
}
exit [int]($failures -gt 0)
