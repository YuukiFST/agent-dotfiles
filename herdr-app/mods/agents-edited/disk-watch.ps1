# Measures what fills the system drive for the Disk panel, or clears its caches.
#   pwsh -File disk-watch.ps1 <data folder> scan
#   pwsh -File disk-watch.ps1 <data folder> clean
# scan.json holds the last measure; job.json the running job's progress, rewritten a few times a
# second, then its result. One job at a time: a second one exits at once.
param(
  [Parameter(Mandatory)][string]$Folder,
  [Parameter(Mandatory)][ValidateSet('scan', 'clean')][string]$Mode
)

$ProgressMs = 150
$LargestShown = 12
# Files in Temp younger than this may still belong to a running program, as Disk Cleanup assumes.
$TempMinAgeHours = 24

$instance = New-Object System.Threading.Mutex($false, 'Local\herdr-disk-watch')
try {
  if (-not $instance.WaitOne(0)) { exit 0 }
} catch [System.Threading.AbandonedMutexException] {
  # The last instance was killed: this one owns the mutex now.
}

New-Item -ItemType Directory -Force -Path $Folder | Out-Null
$scanFile = Join-Path $Folder 'scan.json'
$jobFile = Join-Path $Folder 'job.json'

function Now { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }

function WriteWhole([string]$File, $Value) {
  $partial = "$File.$PID"
  [System.IO.File]::WriteAllText($partial, ($Value | ConvertTo-Json -Depth 5 -Compress))
  Move-Item -LiteralPath $partial -Destination $File -Force
}

$local = $env:LOCALAPPDATA
$roaming = $env:APPDATA
$userHome = $env:USERPROFILE
$special = { param($name) [Environment]::GetFolderPath($name) }
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$systemDrive = "$($env:SystemDrive)\"

# Browsers keep one cache per profile, under User Data\<profile>.
$browserCaches = foreach ($browser in @('Google\Chrome', 'Microsoft\Edge', 'BraveSoftware\Brave-Browser')) {
  $data = Join-Path $local "$browser\User Data"
  if (Test-Path -LiteralPath $data) {
    foreach ($profile in Get-ChildItem -LiteralPath $data -Directory -ErrorAction SilentlyContinue) {
      foreach ($cache in @('Cache', 'Code Cache', 'GPUCache')) { Join-Path $profile.FullName $cache }
    }
  }
}

$caches = @(
  $env:TEMP
  (Join-Path $local 'Microsoft\Windows\INetCache')
  (Join-Path $local 'CrashDumps')
  (Join-Path $local 'D3DSCache')
  (Join-Path $local 'npm-cache')
  (Join-Path $local 'pip\Cache')
  (Join-Path $local 'Yarn\Cache')
  (Join-Path $roaming 'Code\Cache')
  (Join-Path $roaming 'Code\CachedData')
  (Join-Path $roaming 'discord\Cache')
) + @($browserCaches)

$categories = [ordered]@{
  apps      = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, (Join-Path $local 'Programs'))
  developer = @('.cargo', '.rustup', '.nuget', '.gradle', '.m2', 'go', '.vscode', '.bun', '.deno' | ForEach-Object { Join-Path $userHome $_ }) + @((Join-Path $local 'Docker'), (Join-Path $local 'pnpm'))
  desktop   = @(& $special 'Desktop')
  documents = @(& $special 'MyDocuments')
  downloads = @(Join-Path $userHome 'Downloads')
  photos    = @(& $special 'MyPictures')
  videos    = @(& $special 'MyVideos')
  music     = @(& $special 'MyMusic')
  trash     = @(Join-Path $systemDrive "`$Recycle.Bin\$sid")
  caches    = $caches
}

# The walk runs in C#: a PowerShell loop over every file of Program Files takes minutes.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
public static class HerdrDiskWalk {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern uint GetLongPathName(string shortPath, StringBuilder longPath, uint size);
  // %TEMP% comes as a short name (DESENV~1); the files under it enumerate with the long one.
  public static string LongPath(string path) {
    var buffer = new StringBuilder(1024);
    return GetLongPathName(path, buffer, (uint)buffer.Capacity) > 0 ? buffer.ToString() : path;
  }
  public static long Bytes;
  public static string Path = "";
  static readonly EnumerationOptions Options = new EnumerationOptions { RecurseSubdirectories = true, IgnoreInaccessible = true, AttributesToSkip = FileAttributes.ReparsePoint };
  static readonly Stopwatch SinceReport = Stopwatch.StartNew();
  static void Tick(string path, long progressMs, Action report) {
    if (SinceReport.ElapsedMilliseconds < progressMs) return;
    SinceReport.Restart();
    Path = path;
    report();
  }
  // Bytes per folder directly under a measured root, the files right in it counted as the root.
  public static readonly Dictionary<string, long> Children = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
  public static long Size(string root, long progressMs, Action report) {
    long total = 0;
    root = LongPath(root);
    char slash = System.IO.Path.DirectorySeparatorChar;
    string prefix = root.TrimEnd(slash) + slash;
    foreach (var file in new DirectoryInfo(root).EnumerateFiles("*", Options)) {
      total += file.Length;
      Bytes += file.Length;
      int cut = file.FullName.IndexOf(slash, prefix.Length);
      string child = cut < 0 ? root : file.FullName.Substring(0, cut);
      Children.TryGetValue(child, out long sum);
      Children[child] = sum + file.Length;
      Tick(file.DirectoryName, progressMs, report);
    }
    return total;
  }
  // Deletes the files under root written before cutoff; a file in use stays with the program
  // holding it. Emptied folders go too, deepest first; root itself stays.
  public static void Clean(string root, DateTime cutoffUtc, long progressMs, Action report) {
    var dir = new DirectoryInfo(root);
    foreach (var file in dir.EnumerateFiles("*", Options)) {
      if (file.LastWriteTimeUtc > cutoffUtc) continue;
      long length = file.Length;
      try { file.Delete(); Bytes += length; } catch (IOException) { } catch (UnauthorizedAccessException) { }
      Tick(file.DirectoryName, progressMs, report);
    }
    foreach (var folder in dir.EnumerateDirectories("*", Options).OrderByDescending(d => d.FullName.Length).ToList()) {
      try { folder.Delete(false); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
  }
}
'@

$job = @{ kind = $Mode; startedAt = (Now); path = ''; bytes = 0; isDone = $false }
$report = [Action]{
  $job.path = [HerdrDiskWalk]::Path
  $job.bytes = [HerdrDiskWalk]::Bytes
  $job.at = Now
  WriteWhole $jobFile $job
}

# Each folder once, even when two categories name it (a Desktop inside Documents).
$seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$isNew = { param($root) $root -and (Test-Path -LiteralPath $root) -and $seen.Add($root) }

function SizeOf([string[]]$Roots) {
  $total = [long]0
  foreach ($root in $Roots) {
    if (& $isNew $root) { $total += [HerdrDiskWalk]::Size($root, $ProgressMs, $report) }
  }
  $total
}

function DriveNow {
  $drive = [System.IO.DriveInfo]::new($systemDrive)
  @{ name = $drive.Name.TrimEnd('\'); totalBytes = $drive.TotalSize; freeBytes = $drive.AvailableFreeSpace }
}

$report.Invoke()
if ($Mode -eq 'scan') {
  $sizes = [ordered]@{}
  $largest = @()
  foreach ($key in $categories.Keys) {
    [HerdrDiskWalk]::Children.Clear()
    $sizes[$key] = SizeOf $categories[$key]
    $largest += [HerdrDiskWalk]::Children.GetEnumerator() | ForEach-Object { @{ path = $_.Key; bytes = $_.Value; category = $key } }
  }
  $largest = @($largest | Sort-Object { $_.bytes } -Descending | Select-Object -First $LargestShown)
  WriteWhole $scanFile @{ at = (Now); drive = (DriveNow); bytes = $sizes; largest = $largest; cachePaths = @($caches | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | ForEach-Object { [HerdrDiskWalk]::LongPath($_) }) }
} else {
  $tempCutoff = [DateTime]::UtcNow.AddHours(-$TempMinAgeHours)
  foreach ($root in $caches) {
    if (-not (& $isNew $root)) { continue }
    [HerdrDiskWalk]::Clean($root, $(if ($root -eq $env:TEMP) { $tempCutoff } else { [DateTime]::MaxValue }), $ProgressMs, $report)
  }
  if (Test-Path -LiteralPath $scanFile) {
    $scan = Get-Content -LiteralPath $scanFile -Raw | ConvertFrom-Json -AsHashtable
    $freed = [HerdrDiskWalk]::Bytes
    $seen.Clear()
    $scan.bytes.caches = SizeOf $caches
    # The cleared folders are gone or smaller; the next scan finds what is heavy now.
    $scan.largest = @($scan.largest | Where-Object { $_.category -ne 'caches' })
    [HerdrDiskWalk]::Bytes = $freed
    $scan.drive = DriveNow
    $scan.at = Now
    WriteWhole $scanFile $scan
  }
}

[HerdrDiskWalk]::Path = ''
$job.isDone = $true
$job.finishedAt = Now
$report.Invoke()
