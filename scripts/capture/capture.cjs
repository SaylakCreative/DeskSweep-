// Generates docs/images: settings screenshots and the robot demo GIF.
// Run with: npm run build && npm run capture
const { app, BrowserWindow, ipcMain, nativeTheme } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

const root = path.join(__dirname, "..", "..");
const out = path.join(root, "docs", "images");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Never touch the real profile.
app.setPath("userData", path.join(app.getPath("temp"), "desksweep-capture"));

async function settingsShots() {
  const shots = [
    { file: "settings-clean-dark.png", theme: "dark", page: 0, cfg: {} },
    { file: "settings-clean-light.png", theme: "light", page: 0, cfg: {} },
    { file: "settings-backup-dark.png", theme: "dark", page: 1, cfg: { destinationDir: "D:\\Backups\\Desktop" } },
    { file: "settings-robot-dark.png", theme: "dark", page: 2, cfg: {} }
  ];
  for (const s of shots) {
    nativeTheme.themeSource = s.theme;
    process.env.CAPTURE_CFG = JSON.stringify({ theme: s.theme, ...s.cfg });
    const win = new BrowserWindow({
      width: 1040, height: 760, show: true, useContentSize: true,
      backgroundColor: s.theme === "dark" ? "#131314" : "#f3f3f1",
      webPreferences: { preload: path.join(__dirname, "settings-preload.cjs"), sandbox: false, contextIsolation: true }
    });
    await win.loadFile(path.join(root, "dist", "settings", "index.html"));
    await sleep(600);
    await win.webContents.executeJavaScript(`document.querySelectorAll('#nav button')[${s.page}].click()`);
    await sleep(500);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(out, s.file), image.toPNG());
    win.destroy();
    console.log("wrote", s.file);
  }
}

function recordDemo() {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 960, height: 540, show: false, useContentSize: true,
      webPreferences: { offscreen: true, preload: path.join(__dirname, "demo-preload.cjs"), sandbox: false, contextIsolation: true }
    });
    win.webContents.setFrameRate(12);
    const startedAt = Date.now();

    const gif = GIFEncoder();
    let prev = null, prevTime = 0, size = null;
    const flush = (now, minDelay) => {
      if (!prev) return;
      const delay = Math.max(minDelay, Math.round(now - prevTime));
      const palette = quantize(prev, 256, { format: "rgb444" });
      gif.writeFrame(applyPalette(prev, palette, "rgb444"), size.width, size.height, { palette, delay });
    };

    win.webContents.on("paint", (_e, _dirty, image) => {
      const small = image.resize({ width: 800, quality: "good" });
      size = small.getSize();
      const bgra = small.toBitmap();
      const rgba = new Uint8Array(bgra.length);
      for (let i = 0; i < bgra.length; i += 4) {
        rgba[i] = bgra[i + 2]; rgba[i + 1] = bgra[i + 1]; rgba[i + 2] = bgra[i]; rgba[i + 3] = 255;
      }
      const now = Date.now();
      if (process.env.CAPTURE_DEBUG && !win.debugSaved && now - startedAt > 5000) {
        win.debugSaved = true; // a still from mid-sweep, to eyeball the result
        fs.writeFileSync(path.join(app.getPath("temp"), "demo-frame.png"), small.toPNG());
      }
      flush(now, 20);
      prev = rgba;
      prevTime = now;
    });

    const finish = async () => {
      await sleep(900);
      flush(Date.now(), 2500); // hold the last frame (clean desktop) before looping
      gif.finish();
      fs.writeFileSync(path.join(out, "demo.gif"), Buffer.from(gif.bytes()));
      win.destroy();
      console.log("wrote demo.gif");
      resolve();
    };
    ipcMain.once("demo-finish", finish);
    setTimeout(finish, 60_000); // safety net
    win.loadFile(path.join(__dirname, "demo.html"));
  });
}

// Between shots no window is open; don't let Electron quit.
app.on("window-all-closed", () => {});

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  await settingsShots();
  await recordDemo();
  app.quit();
});
