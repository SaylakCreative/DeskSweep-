# Prints one line per desktop icon: <display text> TAB <center X> TAB <center Y>
# Coordinates are physical screen pixels. Read-only: it only asks Explorer's desktop
# list view where each icon is drawn (LVM_GETITEMRECT / LVM_GETITEMTEXT).
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class DeskIcons {
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int X; public int Y; }
  delegate bool EnumProc(IntPtr h, IntPtr l);

  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string c, string n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string n);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr p, IntPtr addr, UIntPtr size, uint type, uint prot);
  [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr p, IntPtr addr, UIntPtr size, uint type);
  [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr p, IntPtr addr, byte[] buf, int size, out IntPtr read);
  [DllImport("kernel32.dll")] static extern bool WriteProcessMemory(IntPtr p, IntPtr addr, byte[] buf, int size, out IntPtr written);

  static IntPtr FindListView() {
    IntPtr defView = FindWindowEx(FindWindow("Progman", null), IntPtr.Zero, "SHELLDLL_DefView", null);
    if (defView == IntPtr.Zero) {
      // With a slideshow wallpaper the icons live under a WorkerW window instead.
      EnumWindows(delegate (IntPtr h, IntPtr l) {
        IntPtr d = FindWindowEx(h, IntPtr.Zero, "SHELLDLL_DefView", null);
        if (d != IntPtr.Zero) { defView = d; return false; }
        return true;
      }, IntPtr.Zero);
    }
    if (defView == IntPtr.Zero) return IntPtr.Zero;
    return FindWindowEx(defView, IntPtr.Zero, "SysListView32", null);
  }

  public static string Dump() {
    if (IntPtr.Size != 8) throw new Exception("64-bit PowerShell required");
    SetProcessDPIAware();

    IntPtr lv = FindListView();
    if (lv == IntPtr.Zero) throw new Exception("desktop list view not found");

    uint pid;
    GetWindowThreadProcessId(lv, out pid);
    // VM_OPERATION | VM_READ | VM_WRITE
    IntPtr proc = OpenProcess(0x0008 | 0x0010 | 0x0020, false, pid);
    if (proc == IntPtr.Zero) throw new Exception("cannot open explorer process");

    // 0..15 RECT, 128..175 LVITEMW, 512..1031 text buffer
    IntPtr mem = VirtualAllocEx(proc, IntPtr.Zero, (UIntPtr)4096, 0x3000, 0x04);
    if (mem == IntPtr.Zero) { CloseHandle(proc); throw new Exception("remote allocation failed"); }

    try {
      int count = (int)SendMessage(lv, 0x1004, IntPtr.Zero, IntPtr.Zero); // LVM_GETITEMCOUNT
      POINT origin = new POINT();
      ClientToScreen(lv, ref origin);

      StringBuilder sb = new StringBuilder();
      IntPtr io;
      for (int i = 0; i < count; i++) {
        // icon rectangle
        byte[] rect = new byte[16];
        BitConverter.GetBytes(1).CopyTo(rect, 0); // LVIR_ICON
        WriteProcessMemory(proc, mem, rect, 16, out io);
        SendMessage(lv, 0x100E, (IntPtr)i, mem); // LVM_GETITEMRECT
        ReadProcessMemory(proc, mem, rect, 16, out io);
        int l = BitConverter.ToInt32(rect, 0), t = BitConverter.ToInt32(rect, 4);
        int r = BitConverter.ToInt32(rect, 8), b = BitConverter.ToInt32(rect, 12);

        // item text
        byte[] item = new byte[48];
        BitConverter.GetBytes(((long)mem) + 512).CopyTo(item, 24); // pszText
        BitConverter.GetBytes(260).CopyTo(item, 32);               // cchTextMax
        WriteProcessMemory(proc, (IntPtr)((long)mem + 128), item, 48, out io);
        int len = (int)SendMessage(lv, 0x1073, (IntPtr)i, (IntPtr)((long)mem + 128)); // LVM_GETITEMTEXTW
        if (len <= 0 || len > 259) continue;
        byte[] text = new byte[len * 2];
        ReadProcessMemory(proc, (IntPtr)((long)mem + 512), text, len * 2, out io);

        sb.Append(Encoding.Unicode.GetString(text)).Append('\t')
          .Append(origin.X + (l + r) / 2).Append('\t')
          .Append(origin.Y + (t + b) / 2).Append('\n');
      }
      return sb.ToString();
    } finally {
      VirtualFreeEx(proc, mem, UIntPtr.Zero, 0x8000);
      CloseHandle(proc);
    }
  }
}
"@

. "$PSScriptRoot\import-cached.ps1"
Import-CachedType 'DeskIcons' $source

[Console]::Out.Write([DeskIcons]::Dump())
