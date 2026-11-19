import { execFile } from "node:child_process";
import { parseIconDump, type IconText } from "../core/iconMatch";
import { nativeScript } from "./native";

/**
 * Asks Explorer where every desktop icon is drawn. Resolves to undefined on any failure
 * (non-Windows, locked-down PowerShell, Explorer not running...), so callers can fall back
 * to the estimated grid.
 */
export function readDesktopIcons(): Promise<IconText[] | undefined> {
  if (process.platform !== "win32") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", nativeScript("desktop-icons.ps1")],
      { timeout: 20_000, windowsHide: true, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve(undefined);
        const icons = parseIconDump(stdout);
        resolve(icons.length ? icons : undefined);
      }
    );
  });
}
