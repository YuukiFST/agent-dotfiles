#!/usr/bin/env pwsh
# Herdr UI setup (Windows). Run from a clone of this repo.
# Idempotent, and doubles as the updater: re-run it to pull the latest font releases.
$ErrorActionPreference = "Stop"

if (-not (Get-Command herdr-gpui -ErrorAction SilentlyContinue)) {
  throw "herdr-gpui not on PATH - install Herdr UI first"
}

# Installs one font family per user (no admin) from a release zip.
# $Prefix is the file name before the style ("GeistMonoNerdFontMono-"), $Family the
# registry label before the style, $Folder a zip subfolder to take files from.
function Install-FontZip([string]$Url, [string]$Prefix, [string]$Ext, [string]$Family, [string]$Folder = "") {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp "font.zip"
    Invoke-WebRequest $Url -OutFile $zip
    Expand-Archive $zip -DestinationPath $tmp
    $fonts = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Fonts"
    $reg = "HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts"
    $kind = if ($Ext -eq "otf") { "OpenType" } else { "TrueType" }
    New-Item -ItemType Directory -Force -Path $fonts | Out-Null
    $files = @(Get-ChildItem (Join-Path $tmp $Folder) -Filter "$Prefix*.$Ext")
    if (-not $files) { throw "$Url holds no $Folder\$Prefix*.$Ext" }
    foreach ($f in $files) {
      $target = Join-Path $fonts $f.Name
      # A loaded font file is locked, so an unchanged one is left in place.
      $same = (Test-Path $target) -and ((Get-FileHash $target).Hash -eq (Get-FileHash $f.FullName).Hash)
      if (-not $same) { Copy-Item $f.FullName $target -Force }
      # GeistMonoNerdFontMono-ExtraBoldItalic -> "GeistMono NFM ExtraBold Italic (OpenType)"
      $style = ($f.BaseName -replace "^$Prefix", '') -creplace '([a-z])([A-Z])', '$1 $2'
      $name = if ($style -eq "Regular") { "$Family ($kind)" } else { "$Family $style ($kind)" }
      New-ItemProperty -Path $reg -Name $name -Value $target -PropertyType String -Force | Out-Null
    }
    Write-Host "  installed $($files.Count) font file(s) to $fonts"
  } finally {
    Remove-Item $tmp -Recurse -Force
  }
}

# The Mono variants keep every Nerd Font glyph one cell wide, as a terminal grid needs.
Write-Host "[1/3] Ioskeley Mono Term Nerd Font Mono (terminal font)"
Install-FontZip "https://github.com/ahatem/IoskeleyMono/releases/latest/download/IoskeleyMono-Term-NerdFont.zip" `
  "IoskeleyMonoTermNerdFontMono-" "ttf" "IoskeleyMono Term NFM" "Normal"

Write-Host "[2/3] GeistMono Nerd Font Mono (fallback font)"
Install-FontZip "https://github.com/ryanoasis/nerd-fonts/releases/latest/download/GeistMono.zip" `
  "GeistMonoNerdFontMono-" "otf" "GeistMono NFM"

Write-Host "[3/3] Herdr UI themes and settings (from herdr/)"
& "$PSScriptRoot\sync-config.ps1" herdr

Write-Host @"

Done. Restart Herdr UI.

- Settings: %APPDATA%\herdr\config-gpui.local.toml (keys from herdr/config-gpui.toml)
- Themes: %APPDATA%\herdr\themes - Vercel Dark
- Check: herdr-gpui config check, with a window open to check the font too
"@
