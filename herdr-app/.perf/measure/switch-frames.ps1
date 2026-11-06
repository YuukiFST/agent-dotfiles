# Times workspace switches from outside the app: runs a `herdr-app do` per switch and reads the
# window's pixels until -WindowMs ends. Prints one JSON line per switch.
param([int]$AppId, [string]$Exe, [string]$Command, [int]$Switches = 6, [int]$WindowMs = 1500)
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class SwitchFrames {
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
  const uint ClientOnlyFullContent = 3;

  static long Hash(IntPtr window, Bitmap bitmap, Graphics graphics) {
    IntPtr dc = graphics.GetHdc();
    PrintWindow(window, dc, ClientOnlyFullContent);
    graphics.ReleaseHdc(dc);
    BitmapData bits = bitmap.LockBits(new Rectangle(0, 0, bitmap.Width, bitmap.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppRgb);
    int[] pixels = new int[bits.Stride / 4 * bits.Height];
    Marshal.Copy(bits.Scan0, pixels, 0, pixels.Length);
    long hash = 1469598103934665603L;
    for (int i = 0; i < pixels.Length; i += 7) hash = unchecked((hash ^ pixels[i]) * 1099511628211L);
    bitmap.UnlockBits(bits);
    return hash;
  }

  public static string Run(IntPtr window, string exe, string args, int windowMs) {
    Rect rect;
    GetClientRect(window, out rect);
    using (Bitmap bitmap = new Bitmap(rect.Right, rect.Bottom, PixelFormat.Format32bppRgb))
    using (Graphics graphics = Graphics.FromImage(bitmap)) {
      long before = Hash(window, bitmap, graphics);
      Stopwatch clock = Stopwatch.StartNew();
      ProcessStartInfo start = new ProcessStartInfo(exe, args);
      start.UseShellExecute = false;
      start.CreateNoWindow = true;
      Process trigger = Process.Start(start);
      long triggerMs = -1, firstChange = -1, lastChange = -1, previous = before;
      int frames = 0;
      List<string> changes = new List<string>();
      while (clock.ElapsedMilliseconds < windowMs) {
        long hash = Hash(window, bitmap, graphics);
        long now = clock.ElapsedMilliseconds;
        frames++;
        if (triggerMs < 0 && trigger.HasExited) triggerMs = now;
        if (hash == previous) continue;
        previous = hash;
        lastChange = now;
        if (firstChange < 0) firstChange = now;
        changes.Add(now.ToString());
      }
      trigger.WaitForExit();
      return "{\"trigger_ms\":" + triggerMs + ",\"first_change_ms\":" + firstChange + ",\"settled_ms\":" + lastChange + ",\"frames\":" + frames + ",\"exit\":" + trigger.ExitCode + ",\"changes\":[" + string.Join(",", changes.ToArray()) + "]}";
    }
  }
}
'@
$window = (Get-Process -Id $AppId).MainWindowHandle
for ($i = 0; $i -lt $Switches; $i++) {
  [SwitchFrames]::Run($window, $Exe, "do $Command", $WindowMs)
}
