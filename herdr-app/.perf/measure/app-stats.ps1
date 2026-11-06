# Samples herdr-app processes for -Seconds and prints one JSON line:
# CPU over the window (1 core = 100), memory at the end, and the programs they start.
param([string]$IdList, [int]$Seconds = 30)
$Ids = $IdList -split "," | ForEach-Object { [int]$_ }
$ErrorActionPreference = 'Stop'
$filter = ($Ids | ForEach-Object { "ParentProcessId=$_" }) -join ' or '
$known = @{}
Get-CimInstance Win32_Process -Filter $filter | ForEach-Object { $known["$($_.ProcessId)"] = 'present' }
$before = @{}
foreach ($id in $Ids) { $before[$id] = (Get-Process -Id $id).TotalProcessorTime.TotalMilliseconds }
$clock = [Diagnostics.Stopwatch]::StartNew()
$started = @{}
while ($clock.Elapsed.TotalSeconds -lt $Seconds) {
  foreach ($child in (Get-CimInstance Win32_Process -Filter $filter)) {
    $key = "$($child.ProcessId)"
    if ($known[$key]) { continue }
    $line = "$($child.CommandLine)"
    $kind = switch -Regex ($line) {
      'PerfOS_Processor' { 'system-ps'; break }
      'system-sample' { 'system-node'; break }
      'herdr-app status' { 'companion'; break }
      'analyze\.mjs' { 'ctxmap-node'; break }
      'gh(\.exe)?"? ' { 'gh'; break }
      'git' { 'git'; break }
      default { 'other' }
    }
    $known[$key] = $kind
    $started[$kind] = 1 + [int]$started[$kind]
  }
  Start-Sleep -Milliseconds 120
}
$ms = $clock.ElapsedMilliseconds
$cpu = 0; $private = 0; $working = 0
foreach ($id in $Ids) {
  $p = Get-Process -Id $id
  $cpu += $p.TotalProcessorTime.TotalMilliseconds - $before[$id]
  $private += $p.PrivateMemorySize64
  $working += $p.WorkingSet64
}
$perMinute = 60000 / $ms
$byKind = @{}
foreach ($k in $started.Keys) { $byKind[$k] = [math]::Round($started[$k] * $perMinute, 1) }
$total = ($started.Values | Measure-Object -Sum).Sum
@{
  cpu_pct = [math]::Round(100 * $cpu / $ms, 2)
  private_mb = [math]::Round($private / 1MB, 1)
  working_mb = [math]::Round($working / 1MB, 1)
  spawns_per_min = [math]::Round([double]$total * $perMinute, 1)
  spawns_by_kind = $byKind
} | ConvertTo-Json -Compress
