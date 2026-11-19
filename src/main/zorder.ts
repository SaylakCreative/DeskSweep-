import { spawn, type ChildProcess } from "node:child_process";
import type { BrowserWindow } from "electron";
import { nativeScript } from "./native";

/**
 * Sends the (still hidden) overlay window to the bottom of the normal z-order and keeps it there,
 * so the robot roams over the desktop icons but never above other apps or folders.
 * Resolves to the helper process once it is in place, or undefined if that was not possible.
 */
export function pushToBottom(win: BrowserWindow): Promise<ChildProcess | undefined> {
  if (process.platform !== "win32" || win.isDestroyed()) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const handle = win.getNativeWindowHandle();
    const hwnd = (handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0))).toString();

    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", nativeScript("keep-bottom.ps1"), "-Hwnd", hwnd],
      { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
    );

    let settled = false;
    const done = (value: ChildProcess | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => { child.kill(); done(undefined); }, 8000);

    child.stdout?.on("data", (chunk) => { if (String(chunk).includes("ready")) done(child); });
    child.on("error", () => done(undefined));
    child.on("exit", () => done(undefined));
  });
}
