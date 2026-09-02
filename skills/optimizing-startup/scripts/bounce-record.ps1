<#
.SYNOPSIS
Record a cold app launch at 60 fps with a launch marker, for bounce-frames.py.

.DESCRIPTION
Starts ffmpeg (gdigrab, whole desktop, no mouse cursor), shows a magenta 60x60
marker window in the top-left corner at the exact instant the app is started,
optionally types a key every 100 ms into the app once its window exists, and
stops after -Seconds.  Windows PowerShell 5.1 and pwsh 7 both work.

t0 in the recording = first frame where the marker is visible.

.EXAMPLE
  .\bounce-record.ps1 -Exe "C:\path\app.exe" -Out C:\tmp\cold-a.mp4
  .\bounce-record.ps1 -Exe "C:\path\app.exe" -Out C:\tmp\cold-b.mp4 -Keys

Run A (no keys) gives the settled frame.  Run B (-Keys) shows in the sheet when
the first keystroke was echoed = first interactivity accepted.
#>
param(
  [Parameter(Mandatory)] [string] $Exe,
  [string[]] $AppArgs = @(),
  [string] $Out = "$env:TEMP\bounce.mp4",
  [int] $Seconds = 4,
  [int] $Fps = 60,
  [switch] $Keys,
  [string] $KeyText = "q",
  [int] $KeyEveryMs = 100
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Namespace Native -Name Win32 -MemberDefinition @"
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
"@
[Native.Win32]::SetProcessDPIAware() | Out-Null   # physical pixels everywhere, same as gdigrab

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds   # primary monitor only; app must open there
$ffmpegArgs = @(
  "-loglevel", "error", "-y",
  "-f", "gdigrab", "-framerate", "$Fps", "-draw_mouse", "0",
  "-offset_x", "$($screen.X)", "-offset_y", "$($screen.Y)", "-video_size", "$($screen.Width)x$($screen.Height)",
  "-i", "desktop",
  "-t", "$Seconds", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p",
  $Out
)
$ffmpeg = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -PassThru -WindowStyle Hidden
Start-Sleep -Milliseconds 1000   # let capture reach steady state before t0

$marker = New-Object System.Windows.Forms.Form
$marker.FormBorderStyle = "None"
$marker.StartPosition = "Manual"
$marker.Location = New-Object System.Drawing.Point(0, 0)
$marker.Size = New-Object System.Drawing.Size(60, 60)
$marker.BackColor = [System.Drawing.Color]::Magenta
$marker.TopMost = $true
$marker.ShowInTaskbar = $false

# Windows visible before launch; the app window is the largest new one afterwards.  Works for
# launcher-style apps (Store Notepad, Electron) whose first process is not the one owning the window.
function Get-TopWindows {
  Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Id -ne $PID } | ForEach-Object { [int64]$_.MainWindowHandle }
}
$before = @(Get-TopWindows)

$marker.Show()
$marker.Refresh()
$launchedAt = [System.Diagnostics.Stopwatch]::StartNew()
if ($AppArgs.Count -gt 0) { $app = Start-Process -FilePath $Exe -ArgumentList $AppArgs -PassThru }
else { $app = Start-Process -FilePath $Exe -PassThru }
[System.Windows.Forms.Application]::DoEvents()

$sent = @()
if ($Keys) {
  while ($launchedAt.ElapsedMilliseconds -lt ($Seconds - 1) * 1000) {
    $app.Refresh()
    if ($app.MainWindowHandle -ne 0) {
      [System.Windows.Forms.SendKeys]::SendWait($KeyText)
      $sent += $launchedAt.ElapsedMilliseconds
    }
    Start-Sleep -Milliseconds $KeyEveryMs
  }
}

$ffmpeg.WaitForExit()
$marker.Close()

# App window rect relative to the captured screen; bounce-frames.py diffs only this region.
$rect = $null
$new = @(Get-TopWindows | Where-Object { $before -notcontains $_ })
$best = 0
foreach ($h in $new) {
  $r = New-Object Native.Win32+RECT
  [Native.Win32]::GetWindowRect([IntPtr]$h, [ref]$r) | Out-Null
  $area = ($r.Right - $r.Left) * ($r.Bottom - $r.Top)
  if ($area -gt $best) {
    $best = $area
    $rect = @(($r.Left - $screen.X), ($r.Top - $screen.Y), ($r.Right - $screen.X), ($r.Bottom - $screen.Y))   # comma binds tighter than minus
  }
}
if ($rect) {
  if ($rect[0] -lt 0 -or $rect[1] -lt 0 -or $rect[2] -gt $screen.Width -or $rect[3] -gt $screen.Height) {
    Write-Warning "app window is not fully on the primary monitor ($($rect -join ',')); move it there and re-record"
  }
} else {
  Write-Warning "no new top-level window found after launch; whole screen will be diffed"
}

$meta = @{ exe = $Exe; out = $Out; fps = $Fps; keys = $Keys.IsPresent; key_sent_ms = $sent
           screen = @($screen.Width, $screen.Height); window_rect = $rect }
$meta | ConvertTo-Json -Compress | Set-Content -Path ($Out + ".json")
Write-Host "recorded $Out  (keys sent: $($sent.Count))"
Write-Host "next: python bounce-frames.py `"$Out`""
