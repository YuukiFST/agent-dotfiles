#!/usr/bin/env pwsh
# Herdr UI setup (Windows). Run from a clone of this repo.
# Idempotent, and doubles as the updater: re-run it to pull the latest GeistMono release.
$ErrorActionPreference = "Stop"

if (-not (Get-Command herdr-gpui -ErrorAction SilentlyContinue)) {
  throw "herdr-gpui not on PATH - install Herdr UI first"
}

Write-Host "[1/2] GeistMono Nerd Font Mono (per user, no admin)"
# The Mono variant keeps every Nerd Font glyph one cell wide, as a terminal grid needs.
$tmp = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp "GeistMono.zip"
  Invoke-WebRequest "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/GeistMono.zip" -OutFile $zip
  Expand-Archive $zip -DestinationPath $tmp
  $fonts = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Fonts"
  $reg = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts"
  New-Item -ItemType Directory -Force -Path $fonts | Out-Null
  $files = @(Get-ChildItem $tmp -Filter "GeistMonoNerdFontMono-*.otf")
  if (-not $files) { throw "GeistMono.zip holds no GeistMonoNerdFontMono-*.otf" }
  foreach ($f in $files) {
    $target = Join-Path $fonts $f.Name
    # A loaded font file is locked, so an unchanged one is left in place.
    $same = (Test-Path $target) -and ((Get-FileHash $target).Hash -eq (Get-FileHash $f.FullName).Hash)
    if (-not $same) { Copy-Item $f.FullName $target -Force }
    # GeistMonoNerdFontMono-ExtraBoldItalic -> "GeistMono NFM ExtraBold Italic (OpenType)"
    $style = ($f.BaseName -replace '^GeistMonoNerdFontMono-', '') -creplace '([a-z])([A-Z])', '$1 $2'
    $name = if ($style -eq "Regular") { "GeistMono NFM (OpenType)" } else { "GeistMono NFM $style (OpenType)" }
    New-ItemProperty -Path $reg -Name $name -Value $target -PropertyType String -Force | Out-Null
  }
  Write-Host "  installed $($files.Count) font file(s) to $fonts"
} finally {
  Remove-Item $tmp -Recurse -Force
}

Write-Host "[2/2] Herdr UI themes and settings (from herdr/)"
& "$PSScriptRoot\sync-config.ps1" herdr

Write-Host @"

Done. Restart Herdr UI.

- Settings: %APPDATA%\herdr\config-gpui.local.toml (keys from herdr/config-gpui.toml)
- Themes: %APPDATA%\herdr\themes - Vercel Dark / Light follow the system appearance
- Check: herdr-gpui config check, with a window open to check the font too
"@
