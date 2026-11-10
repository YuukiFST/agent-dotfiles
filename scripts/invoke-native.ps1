# Dot-sourced by the setup-*.ps1 and update-*.ps1 scripts.
# $ErrorActionPreference = "Stop" ignores a native command's exit code, and
# $PSNativeCommandUseErrorActionPreference needs PowerShell 7.3, while bootstrap.ps1 runs the
# setup scripts inside whatever host ran it, Windows PowerShell 5.1 included.

# Runs a native command and throws when it exits non-zero. Usage: Invoke-Native npm install -g x
function Invoke-Native {
  $command, $commandArgs = $args
  & $command @commandArgs
  if ($LASTEXITCODE -ne 0) { throw "$($args -join ' ') failed (exit $LASTEXITCODE)" }
}
