# The notes' image files. Exit 0: done; 2: the clipboard holds no image.
#   paste <target.png> | copy <target> <source> | remove <file>
param(
  [Parameter(Mandatory)][ValidateSet("paste", "copy", "remove")][string]$Action,
  [Parameter(Mandatory)][string]$Target,
  [string]$Source
)
$ErrorActionPreference = "Stop"
if ($Action -eq "remove") {
  Remove-Item -LiteralPath $Target -Force -ErrorAction SilentlyContinue
  exit 0
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Target) | Out-Null
if ($Action -eq "copy") {
  Copy-Item -LiteralPath $Source -Destination $Target
  exit 0
}
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$image = [System.Windows.Forms.Clipboard]::GetImage()
if (-not $image) { exit 2 }
$image.Save($Target, [System.Drawing.Imaging.ImageFormat]::Png)
