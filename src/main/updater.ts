import { app, dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";
import * as fs from "node:fs";
import * as path from "node:path";
import { t } from "../core/i18n";
import { launchDetached } from "../core/launch";
import { localFeedOverride } from "../core/updates";
import type { Config } from "../core/types";

export interface UpdateStatus {
  state: "disabled" | "upToDate" | "available" | "error";
  version?: string;
  message?: string;
}

interface Deps {
  config(): Config;
  /** True while a sweep is running: an update is never installed in the middle of one. */
  busy(): boolean;
  notify(body: string): void;
}

// Automated tests may point the updater at a feed on this computer and answer "Install"
// automatically. Both are ignored unless the URL is a localhost one.
const testFeed = localFeedOverride(process.env.DESKSWEEP_UPDATE_URL);
const autoConfirm = Boolean(testFeed) && process.env.DESKSWEEP_UPDATE_AUTOCONFIRM === "1";

const log = (...args: unknown[]): void => {
  if (process.env.DESKSWEEP_TRACE) console.log("[updater]", ...args);
};

let deps: Deps;
let configured = false;
let checking = false;
let installing = false;

/** Only the installed app can update itself (a dev checkout has no update feed). */
const available = (): boolean => app.isPackaged || Boolean(testFeed);

const stateFile = (): string => path.join(app.getPath("userData"), "updater.json");

function lastDeclined(): string | undefined {
  try {
    return (JSON.parse(fs.readFileSync(stateFile(), "utf8")) as { declined?: string }).declined;
  } catch {
    return undefined;
  }
}

function rememberDeclined(version: string): void {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ declined: version }));
  } catch {
    /* not important: the user is simply asked again */
  }
}

const RELEASES_URL = "https://github.com/SaylakCreative/DeskSweep-/releases/latest";
const INSTALLER_GRACE_MS = 2500;

function configure(): void {
  if (configured) return;
  configured = true;
  autoUpdater.autoDownload = false; // nothing is downloaded before the user says yes
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = { info: log, warn: log, error: log };

  if (testFeed) {
    if (!app.isPackaged) {
      // An unpackaged (development) app has no app-update.yml: give the updater one for the test feed.
      const config = path.join(app.getPath("userData"), "dev-app-update.yml");
      fs.writeFileSync(config, `provider: generic\nurl: ${testFeed}\nupdaterCacheDirName: desksweep-dev-updater\n`);
      autoUpdater.forceDevUpdateConfig = true;
      autoUpdater.updateConfigPath = config;
    }
    autoUpdater.setFeedURL({ provider: "generic", url: testFeed });
  }

}

/** Windows refused to start the installer: say so and point to the manual download. */
async function installFailed(reason: string): Promise<void> {
  if (!installing) return;
  installing = false;
  log("install failed:", reason);
  if (autoConfirm) return; // automated test: no dialog

  const lang = deps.config().language;
  const { response } = await dialog.showMessageBox({
    type: "warning",
    title: "DeskSweep",
    message: t(lang, "updateFailed"),
    detail: t(lang, "updateFailedDetail"),
    buttons: [t(lang, "updateOpenPage"), t(lang, "updateClose")],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  });
  if (response === 0) await shell.openExternal(RELEASES_URL);
}

async function offer(version: string): Promise<void> {
  const lang = deps.config().language;
  let accepted = autoConfirm;

  if (!accepted) {
    const { response } = await dialog.showMessageBox({
      type: "question",
      title: "DeskSweep",
      message: t(lang, "updateAvailable", { v: version }),
      detail: t(lang, "updateAvailableDetail"),
      buttons: [t(lang, "updateInstall"), t(lang, "updateLater")],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    accepted = response === 0;
  }
  if (!accepted) {
    rememberDeclined(version);
    return;
  }

  deps.notify(t(lang, "updateDownloading"));
  const [installer] = await autoUpdater.downloadUpdate(); // the file's sha512 is checked against latest.yml
  while (deps.busy()) await new Promise((resolve) => setTimeout(resolve, 2000));

  installing = true;
  log("installing", version, installer);
  // Same arguments electron-updater uses: silent install, then start the new version. Unlike its own
  // quitAndInstall(), this waits to learn whether Windows let the installer start before we quit,
  // so a blocked installer (Smart App Control) never leaves the user without DeskSweep.
  if (await launchDetached(installer, ["--updated", "/S", "--force-run"], INSTALLER_GRACE_MS)) {
    app.quit(); // the installer waits for us to close, replaces the files and starts the new version
    return;
  }
  await installFailed("Windows did not let the installer start");
}

/**
 * Looks for a newer release. Automatic checks ask at most once per version; a manual check
 * (Settings or tray) always asks.
 */
export async function checkForUpdates(manual: boolean): Promise<UpdateStatus> {
  if (!available()) return { state: "disabled" };
  if (checking || installing) return { state: "upToDate", version: app.getVersion() };

  checking = true;
  try {
    configure();
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo.version;
    log("current", app.getVersion(), "latest", version, "newer:", result?.isUpdateAvailable);

    if (!result || !result.isUpdateAvailable || !version) return { state: "upToDate", version: app.getVersion() };
    if (manual || autoConfirm || lastDeclined() !== version) await offer(version);
    return { state: "available", version };
  } catch (err) {
    log("check failed:", (err as Error).message);
    return { state: "error", message: (err as Error).message };
  } finally {
    checking = false;
  }
}

/** Checks shortly after start and then once a day, if the user has not switched it off. */
export function startUpdateChecks(dependencies: Deps): void {
  deps = dependencies;
  const tick = (): void => {
    if (!deps.config().updates.check || deps.busy()) return;
    void checkForUpdates(false);
  };
  setTimeout(tick, testFeed ? 2_000 : 20_000);
  setInterval(tick, 24 * 3_600_000);
}
