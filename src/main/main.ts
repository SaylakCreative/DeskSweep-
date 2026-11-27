import { BrowserWindow, Menu, Notification, Tray, app, dialog, ipcMain, nativeImage, nativeTheme, screen, shell } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { BUILTIN_CATEGORIES, normalizeConfig, parseConfigText } from "../core/config";
import { matchIcons } from "../core/iconMatch";
import { strings, t } from "../core/i18n";
import { Journal, applyMove } from "../core/journal";
import { estimateIconPositions, pickDockSpot } from "../core/layout";
import { buildPlan, resolveDestination } from "../core/planner";
import { resolveSkin } from "../core/skins";
import type { Config, Entry, Language, PlanItem } from "../core/types";
import type { ChildProcess } from "node:child_process";
import { readDesktopIcons } from "./icons";
import { checkForUpdates, startUpdateChecks } from "./updater";
import { pushToBottom } from "./zorder";

interface Run {
  win: BrowserWindow;
  helper?: ChildProcess;
  dry: boolean;
  plan: PlanItem[];
  batchId: string;
  moved: number;
  failed: number;
}

let tray: Tray | undefined;
let run: Run | undefined;
let starting = false;
let settingsWin: BrowserWindow | undefined;
let scheduleTimer: NodeJS.Timeout | undefined;
let quitting = false;
let trayHintShown = false;

// The robot overlay sits behind every other window. Without these switches Chromium decides a
// fully covered window is hidden and pauses its animation, which froze the sweep whenever an app
// was maximized.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

// Test hooks: let automated runs use throw-away folders instead of the real profile and desktop.
if (process.env.DESKSWEEP_USERDATA) app.setPath("userData", process.env.DESKSWEEP_USERDATA);
const desktopDir = (): string => process.env.DESKSWEEP_DESKTOP || app.getPath("desktop");

const configPath = () => path.join(app.getPath("userData"), "config.json");
const journal = () => new Journal(path.join(app.getPath("userData"), "journal.json"));
const systemLanguage = (): Language => (app.getLocale().toLowerCase().startsWith("tr") ? "tr" : "en");

function loadConfig(): Config {
  const file = configPath();
  if (!fs.existsSync(file)) {
    const fresh = normalizeConfig({}, systemLanguage());
    saveConfig(fresh);
    return fresh;
  }
  try {
    return parseConfigText(fs.readFileSync(file, "utf8"), systemLanguage());
  } catch {
    const fallback = normalizeConfig({}, systemLanguage());
    notify(t(fallback.language, "invalidConfig"));
    return fallback;
  }
}

function saveConfig(config: Config): void {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), "utf8");
}

const lang = (): Language => loadConfig().language;

function notify(body: string): void {
  if (Notification.isSupported()) new Notification({ title: "DeskSweep", body }).show();
}

function readDesktop(dir: string): Entry[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    try {
      return [{ name: d.name, isDirectory: d.isDirectory(), mtimeMs: fs.statSync(path.join(dir, d.name)).mtimeMs }];
    } catch {
      return []; // broken link or file in use: just skip it
    }
  });
}

/* ---------- sweeping ---------- */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Timing output for debugging, enabled with the DESKSWEEP_TRACE environment variable. */
const traceStart = Date.now();
const trace = (...args: unknown[]): void => {
  if (process.env.DESKSWEEP_TRACE) console.log(`[trace +${((Date.now() - traceStart) / 1000).toFixed(1)}s]`, ...args);
};

async function startRun(dry: boolean): Promise<void> {
  if (run || starting) return;
  starting = true;
  try {
    const config = loadConfig();
    const desktop = desktopDir();
    const entries = readDesktop(desktop);
    const plan = buildPlan(entries, desktop, config, Date.now(), fs.existsSync);

    if (plan.length === 0) {
      notify(t(config.language, "nothingToSweep"));
      return;
    }

    const display = screen.getPrimaryDisplay();
    const { x, y, width, height } = display.bounds;
    const win = new BrowserWindow({
      x, y, width, height,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      hasShadow: false,
      skipTaskbar: true,
      focusable: false,
      show: false, // shown only after it has been sent behind every app window
      webPreferences: {
        backgroundThrottling: false, // keep animating while apps cover the desktop
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    });
    win.setIgnoreMouseEvents(true); // the desktop underneath stays fully usable

    run = { win, dry, plan, batchId: String(Date.now()), moved: 0, failed: 0 };

    win.on("closed", () => finishRun());

    // Never leave a half-started run behind: it would block every later sweep until restart.
    const abort = () => { if (run?.win === win) finishRun(); };
    win.webContents.on("render-process-gone", abort);
    win.webContents.on("console-message", (event) => trace("renderer:", (event as unknown as { message?: string }).message ?? event));
    win.webContents.on("did-fail-load", abort);
    setTimeout(abort, 15 * 60_000); // hard cap on a single run

    const loaded = new Promise<void>((resolve) => {
      win.webContents.once("did-finish-load", () => resolve());
      win.webContents.once("did-fail-load", () => resolve());
    });
    void win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

    // The three slow things run at the same time instead of one after another: the page loads,
    // Explorer is asked where the icons are, and the window is sent behind every other app
    // (the robot lives on the desktop: above the icons, below other windows).
    const t0 = Date.now();
    const [icons, helper] = await Promise.all([readDesktopIcons(), pushToBottom(win), loaded]);
    trace("ready after", Date.now() - t0, "ms; real icon positions:", icons ? icons.length : "none");

    if (!run || run.win !== win || win.isDestroyed()) {
      helper?.kill();
      return;
    }
    run.helper = helper;

    // Start from the estimated grid, then overwrite with the real icon positions Explorer reports.
    const positions = estimateIconPositions(entries, config.iconGrid, height);
    if (icons) {
      for (const [name, p] of matchIcons(entries, icons)) {
        const dip = screen.screenToDipPoint({ x: Math.round(p.x), y: Math.round(p.y) });
        // Icons on another monitor: send the robot to the nearest edge of this one.
        positions.set(name, { x: clamp(dip.x - x, 40, width - 40), y: clamp(dip.y - y, 40, height - 40) });
      }
    }

    // The robot's charging dock: a corner of the usable area (above the taskbar) away from the icons.
    const area = display.workArea;
    const dock = pickDockSpot({ x: area.x - x, y: area.y - y, width: area.width, height: area.height }, [...positions.values()]);

    win.showInactive();
    win.webContents.send("start", {
      dry,
      width,
      height,
      dock,
      skin: resolveSkin(config.robot.skin),
      speed: config.robot.speed,
      color: config.robot.color,
      items: plan.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        ...(positions.get(p.name) ?? { x: width / 2, y: height / 2 })
      }))
    });
  } finally {
    starting = false;
  }
}

function finishRun(): void {
  if (!run) return;
  const { win, helper, dry, plan, moved, failed } = run;
  trace("run finished");
  run = undefined;
  helper?.kill();
  if (!win.isDestroyed()) win.destroy();

  const l = lang();
  if (dry) notify(t(l, "dryDone", { n: plan.length }));
  else if (failed > 0) notify(t(l, "sweptFailed", { n: moved, m: failed }));
  else if (moved > 0) notify(t(l, "swept", { n: moved }));
}

function undoLast(): string {
  const l = lang();
  const result = journal().undoLast();
  if (!result) return t(l, "nothingToUndo");
  return result.skipped.length
    ? t(l, "restoredSkipped", { n: result.restored, m: result.skipped.length })
    : t(l, "restored", { n: result.restored });
}

ipcMain.handle("sweep", (_e, id: number) => {
  const item = run?.plan.find((p) => p.id === id);
  if (!run || !item) return { ok: false, error: "unknown item" };
  if (run.dry) return { ok: true };
  try {
    const move = { from: item.from, to: item.to };
    applyMove(move);
    journal().record(run.batchId, move); // logged right away: a crash mid-sweep stays undoable
    run.moved++;
    trace("swept", item.name);
    return { ok: true };
  } catch (err) {
    run.failed++;
    return { ok: false, error: (err as Error).message };
  }
});

ipcMain.on("finish", () => finishRun());

/* ---------- automation ---------- */

function applyAutomation(config: Config): void {
  if (scheduleTimer) {
    clearInterval(scheduleTimer);
    scheduleTimer = undefined;
  }
  if (config.schedule.mode === "interval") {
    scheduleTimer = setInterval(() => void startRun(false), config.schedule.hours * 3_600_000);
  }
  // Registering the dev copy of electron.exe as a login item would be wrong, so installed builds only.
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: config.startWithWindows, args: ["--background"] });
}

/* ---------- settings window ---------- */

function openSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  nativeTheme.themeSource = loadConfig().theme;
  const dark = nativeTheme.shouldUseDarkColors;
  settingsWin = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 720,
    minHeight: 540,
    title: "DeskSweep",
    icon: iconPath(),
    autoHideMenuBar: true,
    backgroundColor: dark ? "#131314" : "#f3f3f1",
    // Frameless look: the web content draws the title area, Windows still draws the caption buttons.
    titleBarStyle: "hidden",
    titleBarOverlay: { color: dark ? "#131314" : "#f3f3f1", symbolColor: dark ? "#ececec" : "#171717", height: 36 },
    webPreferences: {
      preload: path.join(__dirname, "settingsPreload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  settingsWin.removeMenu();

  // Closing the window only hides it: DeskSweep keeps running in the system tray.
  const win = settingsWin;
  win.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    if (!trayHintShown) {
      trayHintShown = true;
      notify(t(lang(), "trayHint"));
    }
  });
  void settingsWin.loadFile(path.join(__dirname, "..", "settings", "index.html"));
}

/** Keeps the Windows caption buttons in step with the page colours. */
function syncTitleBar(): void {
  if (!settingsWin || settingsWin.isDestroyed() || process.platform !== "win32") return;
  const dark = nativeTheme.shouldUseDarkColors;
  settingsWin.setBackgroundColor(dark ? "#131314" : "#f3f3f1");
  settingsWin.setTitleBarOverlay({ color: dark ? "#131314" : "#f3f3f1", symbolColor: dark ? "#ececec" : "#171717", height: 36 });
}
nativeTheme.on("updated", syncTitleBar);

ipcMain.handle("settings:get", () => {
  const config = loadConfig();
  return {
    config,
    strings,
    builtinCategories: BUILTIN_CATEGORIES,
    isPackaged: app.isPackaged,
    version: app.getVersion(),
    resolvedSkin: resolveSkin(config.robot.skin),
    defaultDestination: resolveDestination({ ...config, destinationDir: "" }, desktopDir())
  };
});

ipcMain.on("settings:theme", (_e, theme: unknown) => {
  if (theme === "light" || theme === "dark" || theme === "system") nativeTheme.themeSource = theme; // live preview
});

ipcMain.handle("settings:save", (_e, raw: unknown) => {
  const config = normalizeConfig(raw, systemLanguage());
  saveConfig(config);
  nativeTheme.themeSource = config.theme;
  applyAutomation(config);
  buildTray();
  return config;
});

ipcMain.handle("settings:pickFolder", async () => {
  const options: Electron.OpenDialogOptions = {
    properties: ["openDirectory", "createDirectory"],
    defaultPath: loadConfig().destinationDir || desktopDir()
  };
  const result = settingsWin && !settingsWin.isDestroyed()
    ? await dialog.showOpenDialog(settingsWin, options)
    : await dialog.showOpenDialog(options);
  return result.canceled || result.filePaths.length === 0 ? undefined : result.filePaths[0];
});

ipcMain.handle("settings:openDestination", async (_e, dir: string) => {
  const target = dir && path.isAbsolute(dir) ? dir : path.join(desktopDir(), "DeskSweep");
  fs.mkdirSync(target, { recursive: true });
  await shell.openPath(target);
});

ipcMain.handle("settings:checkUpdates", () => checkForUpdates(true));

/** Tray "Check for updates": answers with a notification (the install prompt is a dialog). */
async function manualUpdateCheck(): Promise<void> {
  const l = lang();
  const status = await checkForUpdates(true);
  if (status.state === "upToDate") notify(t(l, "updateUpToDateNote"));
  else if (status.state === "disabled") notify(t(l, "updatesDev"));
  else if (status.state === "error") notify(t(l, "updatesError"));
}

ipcMain.on("settings:run", (_e, dry: boolean) => void startRun(Boolean(dry)));
ipcMain.handle("settings:undo", () => undoLast());

/* ---------- tray ---------- */

/** Multi-size .ico (16..256px): Windows picks the crisp size for the current DPI. */
const iconPath = () => path.join(__dirname, "..", "..", "build", "icon.ico");

function trayIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(iconPath());
  return icon.isEmpty() ? nativeImage.createEmpty() : icon;
}

function buildTray(): void {
  const l = lang();
  if (!tray) {
    tray = new Tray(trayIcon());
    tray.on("click", openSettings);
    tray.on("double-click", openSettings);
  }
  tray.setToolTip("DeskSweep");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t(l, "traySettings"), click: openSettings },
      { type: "separator" },
      { label: t(l, "traySweep"), click: () => void startRun(false) },
      { label: t(l, "trayDry"), click: () => void startRun(true) },
      { label: t(l, "trayUndo"), click: () => notify(undoLast()) },
      { label: t(l, "trayUpdates"), click: () => void manualUpdateCheck() },
      { type: "separator" },
      { label: t(l, "trayQuit"), click: () => app.quit() }
    ])
  );
}

/* ---------- lifecycle ---------- */

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", openSettings);
app.on("before-quit", () => {
  quitting = true;
  run?.helper?.kill();
});
app.setAppUserModelId("com.desksweep.app"); // lets Windows show our notifications under the right name

app.whenReady().then(() => {
  const config = loadConfig();
  nativeTheme.themeSource = config.theme;
  buildTray();
  applyAutomation(config);
  startUpdateChecks({ config: loadConfig, busy: () => Boolean(run) || starting, notify });

  const args = process.argv;
  if (args.includes("--dry-run")) void startRun(true);
  else if (args.includes("--sweep")) void startRun(false);
  else if (args.includes("--background")) {
    // Started by Windows at sign-in: stay in the tray, optionally sweep once after things settle.
    if (config.schedule.mode === "startup") setTimeout(() => void startRun(false), 20_000);
  } else openSettings();
});

// Tray app: keep running with no windows.
app.on("window-all-closed", () => { /* stay alive */ });
