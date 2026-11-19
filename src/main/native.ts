import * as path from "node:path";

/** Path of a bundled PowerShell helper. PowerShell cannot read inside an asar archive, so use the unpacked copy. */
export function nativeScript(name: string): string {
  const script = path.join(__dirname, "..", "native", name);
  return script.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}
