// Newer npm versions don't run dependency install scripts by default, which leaves Electron
// without its binary ("Electron failed to install correctly"). Download it if it is missing.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const installer = "node_modules/electron/install.js";

if (existsSync(installer) && !existsSync("node_modules/electron/path.txt")) {
  console.log("Downloading the Electron binary...");
  execFileSync(process.execPath, [installer], { stdio: "inherit" });
}
