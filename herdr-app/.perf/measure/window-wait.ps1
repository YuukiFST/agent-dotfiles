# Prints the milliseconds from -StartMs (Unix time) until the process has a window.
param([int]$AppId, [double]$StartMs, [int]$MaxMs = 15000)
function Elapsed { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $StartMs }
while ((Elapsed) -lt $MaxMs) {
  $app = Get-Process -Id $AppId -ErrorAction SilentlyContinue
  if ($app -and $app.MainWindowHandle -ne 0) { Elapsed; exit 0 }
  Start-Sleep -Milliseconds 10
}
throw "no window after $MaxMs ms"
