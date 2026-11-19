# Keeps one window at the very bottom of the normal z-order: above the desktop (wallpaper and
# icons live in a lower band) but below every ordinary app window. Runs until the window is gone.
param([Int64]$Hwnd)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ZOrder {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
}
"@

$h = [IntPtr]$Hwnd
# HWND_BOTTOM = 1; SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE
[void][ZOrder]::SetWindowPos($h, [IntPtr]1, 0, 0, 0, 0, 0x13)
[Console]::Out.WriteLine('ready')
[Console]::Out.Flush()

while ([ZOrder]::IsWindow($h)) {
  [void][ZOrder]::SetWindowPos($h, [IntPtr]1, 0, 0, 0, 0, 0x13)
  Start-Sleep -Milliseconds 150
}
