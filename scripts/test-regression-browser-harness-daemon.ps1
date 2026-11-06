#!/usr/bin/env pwsh
# E2E regression test for scripts/install-browser-harness.ps1 with stub uv and browser-harness on PATH
# and a real process running `python -m browser_harness.daemon`: the install must not start while
# one runs, because `uv tool install --force` fails halfway on Windows and breaks the tool.
# Stops only the processes this test started.
# Run: pwsh -NoProfile -File scripts/test-regression-browser-harness-daemon.ps1
$ErrorActionPreference = "Stop"

$installScript = Join-Path $PSScriptRoot "install-browser-harness.ps1"
$work = Join-Path ([IO.Path]::GetTempPath()) "bh-regression-$PID"
New-Item -ItemType Directory -Force -Path "$work\bin", "$work\tools", "$work\pkg\browser_harness" | Out-Null
"@echo %* >> `"$work\uv-calls.log`"`r`n@if `"%1 %2`"==`"tool dir`" echo $work\tools" | Set-Content "$work\bin\uv.cmd"
"@echo 9.9.9" | Set-Content "$work\bin\browser-harness.cmd"
"import time; time.sleep(60)" | Set-Content "$work\pkg\browser_harness\daemon.py"
$env:Path = "$work\bin;$env:Path"

$script:failed = $false
function Expect($what, $ok) {
  if ($ok) { Write-Host "ok: $what" } else { Write-Host "FAILED: $what"; $script:failed = $true }
}
function Invoke-Install {
  Remove-Item "$work\uv-calls.log" -ErrorAction SilentlyContinue
  $output = & pwsh -NoProfile -File $installScript 2>&1 3>&1 | Out-String
  $calls = if (Test-Path "$work\uv-calls.log") { Get-Content "$work\uv-calls.log" -Raw } else { "" }
  [pscustomobject]@{ Output = $output; Installed = $calls -match "tool install" }
}
function Get-ProcessTree($rootId) {
  $rootId
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$rootId" | ForEach-Object { Get-ProcessTree $_.ProcessId }
}
function Stop-OwnProcessTree($rootId) {
  Get-ProcessTree $rootId | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
function Get-ForeignDaemon {
  @(Get-CimInstance Win32_Process | Where-Object { $_.Name -like "python*" -and $_.CommandLine -match "-m browser_harness\." })
}

$env:PYTHONPATH = "$work\pkg"
$foreignDaemons = @(Get-ForeignDaemon)
$daemon = Start-Process python -ArgumentList "-m", "browser_harness.daemon" -PassThru -WindowStyle Hidden
try {
  # Reported: "`uv tool install ... --force browser-harness` falhou com `failed to remove directory
  # ...\uv\tools\browser-harness\Scripts: Acesso negado. (os error 5)`, porque havia daemons
  # `browser_harness.daemon` abertos." Done: "com um daemon rodando, o script não quebra
  # `browser-harness --version`, e o aviso nomeia os PIDs."
  Start-Sleep -Milliseconds 800
  $run = Invoke-Install
  Expect "daemon running: uv does not reinstall the tool" (-not $run.Installed)
  Expect "daemon running: the warning names the daemon's PID" ($run.Output -match "\b$($daemon.Id)\b")
  Expect "daemon running: the tool still answers --version" ($run.Output -match "9\.9\.9")
} finally {
  Stop-OwnProcessTree $daemon.Id
  Remove-Item Env:PYTHONPATH
}

if ($foreignDaemons.Count -gt 0) {
  Write-Host "skipped: no-daemon cases, this machine runs PIDs $($foreignDaemons.ProcessId -join ', '), left untouched"
} else {
  Start-Sleep -Milliseconds 500
  $run = Invoke-Install
  Expect "no daemon: uv installs" $run.Installed

  # A shell whose command line merely mentions the daemon holds no tool file.
  $bystander = Start-Process pwsh -ArgumentList "-NoProfile", "-Command", "Start-Sleep 20 # python -m browser_harness.daemon" -PassThru -WindowStyle Hidden
  try {
    Start-Sleep -Milliseconds 800
    $run = Invoke-Install
    Expect "shell naming the daemon: uv still installs" $run.Installed
  } finally {
    Stop-OwnProcessTree $bystander.Id
  }
}

Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
if ($script:failed) { exit 1 }
Write-Host "All browser-harness daemon regression tests passed."
