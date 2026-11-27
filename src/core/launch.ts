import { spawn } from "node:child_process";

/**
 * Starts a program detached from this one and reports whether it really started.
 *
 * Resolves to false when it cannot be started (spawn error, or Windows blocks the file) and also
 * when it is gone again within `graceMs`: a healthy installer keeps running while it waits for
 * DeskSweep to close, so a process that vanishes at once never really ran.
 */
export function launchDetached(file: string, args: string[], graceMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (started: boolean): void => {
      if (!settled) {
        settled = true;
        resolve(started);
      }
    };

    try {
      const child = spawn(file, args, { detached: true, stdio: "ignore" });
      child.once("error", () => done(false));
      child.once("exit", () => done(false));
      child.once("spawn", () => {
        child.unref();
        setTimeout(() => done(true), graceMs);
      });
    } catch {
      done(false); // spawn throws synchronously when Windows blocks the file
    }
  });
}
