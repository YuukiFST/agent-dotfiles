# Leaves a reading of every process in raw.json for the Hardware Monitor, and logs each time Windows
# signals low memory, the signal Claude Code's memory-pressure reaper reacts to.
# A long-lived loop because starting powershell.exe takes this machine 1.5 s each time: a
# cycle here costs about 0.4 s. One instance at a time, and it ends once wanted stops being
# touched, so closing the board leaves nothing running.
#   powershell -File hardware-watch.ps1 <data folder>
param([Parameter(Mandatory)][string]$Folder)

$CycleSeconds = 15
$MaxCommandChars = 400
$WantedTimeoutSeconds = 120
$SignalCooldownSeconds = 60
$SignalKeepHours = 24

$instance = New-Object System.Threading.Mutex($false, 'Local\herdr-hardware-watch')
try {
  if (-not $instance.WaitOne(0)) { exit 0 }
} catch [System.Threading.AbandonedMutexException] {
  # The last instance was killed: this one owns the mutex now.
}

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HerdrLowMemory {
  [DllImport("kernel32.dll")] public static extern IntPtr CreateMemoryResourceNotification(int notificationType);
}
'@
$LowMemoryResourceNotification = 0
$lowMemory = New-Object System.Threading.ManualResetEvent($false)
$lowMemory.SafeWaitHandle = New-Object Microsoft.Win32.SafeHandles.SafeWaitHandle([HerdrLowMemory]::CreateMemoryResourceNotification($LowMemoryResourceNotification), $true)

New-Item -ItemType Directory -Force -Path $Folder | Out-Null
$rawFile = Join-Path $Folder 'raw.json'
$wantedFile = Join-Path $Folder 'wanted'
$signalsFile = Join-Path $Folder 'low-memory.json'
Set-Content -LiteralPath $wantedFile -Value '' -NoNewline

function Now { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

function WriteWhole([string]$File, [string]$Text) {
  $partial = "$File.$PID"
  [System.IO.File]::WriteAllText($partial, $Text)
  Move-Item -LiteralPath $partial -Destination $File -Force
}

$signals = @()
if (Test-Path -LiteralPath $signalsFile) { $signals = @(Get-Content -LiteralPath $signalsFile -Raw | ConvertFrom-Json) }

while (((Get-Date) - (Get-Item -LiteralPath $wantedFile).LastWriteTime).TotalSeconds -lt $WantedTimeoutSeconds) {
  $parents = @{}
  $starts = @{}
  $system = @{}
  $commands = @{}
  foreach ($p in Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId, CreationDate, ExecutablePath, CommandLine) {
    $id = [int]$p.ProcessId
    $parents[$id] = [int]$p.ParentProcessId
    if ($p.CreationDate) { $starts[$id] = ([DateTimeOffset]$p.CreationDate).ToUnixTimeMilliseconds() }
    # No path means Windows would not say: a protected process, not one this user can close.
    $system[$id] = (-not $p.ExecutablePath) -or ($p.ExecutablePath -match '^[A-Za-z]:\\Windows\\|\\Windows Defender\\')
    # Names the tool behind an interpreter: node.exe alone does not say vitest or next.
    if (-not $system[$id] -and $p.CommandLine) { $commands[$id] = $p.CommandLine.Substring(0, [math]::Min($MaxCommandChars, $p.CommandLine.Length)) }
  }
  $queue = (Get-CimInstance Win32_PerfFormattedData_PerfOS_System -Property ProcessorQueueLength).ProcessorQueueLength
  $diskIdle = (Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name='_Total'" -Property PercentIdleTime).PercentIdleTime
  # The perf counters, not System.Diagnostics.Process: that one reads 0 for protected processes.
  # cpuAt: the counters' own clock, so CPU over a gap does not drift with how long a cycle took.
  $cpuAt = $null
  $processes = foreach ($p in Get-CimInstance Win32_PerfRawData_PerfProc_Process -Property Name, IDProcess, PercentProcessorTime, WorkingSet, Timestamp_Sys100NS) {
    if ($p.Name -eq '_Total') { $cpuAt = [int64]($p.Timestamp_Sys100NS / 10000); continue }
    $id = [int]$p.IDProcess
    @{ id = $id; parent = $parents[$id]; started = $starts[$id]; system = ($system[$id] -ne $false); name = ($p.Name -replace '#\d+$', ''); ws = [int64]$p.WorkingSet; cpuMs = [int64]($p.PercentProcessorTime / 10000); cmd = $commands[$id] }
  }
  $reading = @{ at = (Now); cpuAt = $cpuAt; cores = [Environment]::ProcessorCount; queue = $queue; diskIdle = $diskIdle; lowMemory = @($signals); processes = $processes }
  WriteWhole $rawFile ($reading | ConvertTo-Json -Compress -Depth 3)

  # Waiting on the signal itself: a dip between two readings would otherwise go unseen.
  $waitStarted = Get-Date
  if ($lowMemory.WaitOne($CycleSeconds * 1000)) {
    $now = Now
    $last = if ($signals.Count) { $signals[-1].at } else { 0 }
    if ($now - $last -ge $SignalCooldownSeconds * 1000) {
      $freeKb = (Get-CimInstance Win32_OperatingSystem -Property FreePhysicalMemory).FreePhysicalMemory
      $oldest = $now - $SignalKeepHours * 3600000
      $signals = @($signals | Where-Object { $_.at -ge $oldest }) + @([pscustomobject]@{ at = $now; freeGb = [math]::Round($freeKb / 1048576, 2) })
      WriteWhole $signalsFile (ConvertTo-Json -InputObject @($signals) -Compress)
    }
    $left = $CycleSeconds - ((Get-Date) - $waitStarted).TotalSeconds
    if ($left -gt 0) { Start-Sleep -Milliseconds ([int]($left * 1000)) }
  }
}
