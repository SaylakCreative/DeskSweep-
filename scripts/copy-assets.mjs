import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist/renderer", { recursive: true });
mkdirSync("dist/settings", { recursive: true });
mkdirSync("dist/native", { recursive: true });
cpSync("src/renderer/index.html", "dist/renderer/index.html");
cpSync("src/settings/index.html", "dist/settings/index.html");
cpSync("src/settings/logo.png", "dist/settings/logo.png");
cpSync("src/native/desktop-icons.ps1", "dist/native/desktop-icons.ps1");
cpSync("src/native/keep-bottom.ps1", "dist/native/keep-bottom.ps1");
cpSync("src/native/import-cached.ps1", "dist/native/import-cached.ps1");
console.log("assets copied");
