#!/usr/bin/env pwsh
# Claude Code harness setup (Windows). Run from a clone of this repo.
$ErrorActionPreference = "Stop"

$Repo   = Split-Path $PSScriptRoot -Parent
$Claude = Join-Path $env:USERPROFILE ".claude"
$Bin    = Join-Path $env:USERPROFILE ".local\bin"
New-Item -ItemType Directory -Force -Path $Bin, "$Claude\skills", "$Claude\rules" | Out-Null

Write-Host "[1/4] Config files"
& "$PSScriptRoot\sync-config.ps1"

Write-Host "[2/4] rtk"
$rtkUrl = (Invoke-RestMethod "https://api.github.com/repos/rtk-ai/rtk/releases/latest").assets |
  Where-Object name -EQ "rtk-x86_64-pc-windows-msvc.zip" | ForEach-Object browser_download_url
$tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "rtk-dl")
Invoke-WebRequest $rtkUrl -OutFile "$tmp\rtk.zip"
Expand-Archive "$tmp\rtk.zip" -DestinationPath $tmp -Force
Copy-Item (Get-ChildItem $tmp -Recurse -Filter rtk.exe)[0].FullName "$Bin\rtk.exe" -Force
Remove-Item -Recurse -Force $tmp
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$Bin*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$Bin", "User")
  $env:Path += ";$Bin"
}
& "$Bin\rtk.exe" init -g | Out-Null

Write-Host "[3/4] no-mistakes + portless + agent-browser + gh-axi"
# Checksum-verified release binary — keep in sync with update-claude.ps1 (same block)
$nmRel = Invoke-RestMethod "https://api.github.com/repos/kunchenguid/no-mistakes/releases/latest"
$nmAsset = $nmRel.assets | Where-Object name -Like "*windows-amd64.zip"
$tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP "nm-dl")
Invoke-WebRequest $nmAsset.browser_download_url -OutFile "$tmp\nm.zip"
$sums = (Invoke-RestMethod (($nmRel.assets | Where-Object name -EQ "checksums.txt").browser_download_url))
$expected = ($sums -split "`n" | Select-String $nmAsset.name).ToString().Split(" ")[0].Trim()
$actual = (Get-FileHash "$tmp\nm.zip" -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "no-mistakes checksum mismatch: $actual != $expected" }
Expand-Archive "$tmp\nm.zip" -DestinationPath $tmp -Force
Copy-Item (Get-ChildItem $tmp -Recurse -Filter "no-mistakes*.exe")[0].FullName "$Bin\no-mistakes.exe" -Force
Remove-Item -Recurse -Force $tmp
npm install -g portless agent-browser gh-axi
agent-browser install

Write-Host "[4/4] Plugins"
foreach ($m in "JuliusBrussee/caveman", "DietrichGebert/ponytail", "anthropics/claude-plugins-official", "kingbootoshi/goal-ledger") {
  claude plugin marketplace add $m
}
claude plugin install caveman@caveman
claude plugin install ponytail@ponytail
claude plugin install superpowers@claude-plugins-official
claude plugin install goal-ledger@goal-ledger

# Disable superpowers:writing-skills — superseded by personal writing-great-skills (duplicate trigger)
Get-ChildItem "$Claude\plugins\cache\claude-plugins-official\superpowers\*\skills\writing-skills\SKILL.md" -ErrorAction SilentlyContinue |
  ForEach-Object { Move-Item $_.FullName "$($_.FullName).disabled" -Force }

Write-Host "Done. Restart Claude Code."
