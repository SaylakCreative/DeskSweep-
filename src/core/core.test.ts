import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { classify, globToRegExp, isProtected } from "./classifier";
import { defaultConfig, normalizeConfig, parseConfigText } from "./config";
import { strings, t } from "./i18n";
import { isWinterSeason, resolveSkin } from "./skins";
import { launchDetached } from "./launch";
import { localFeedOverride } from "./updates";
import { matchIcons, parseIconDump } from "./iconMatch";
import { Journal, applyMove } from "./journal";
import { estimateIconPositions, pickDockSpot } from "./layout";
import { buildPlan, sanitizeSegment } from "./planner";
import type { Config, Entry } from "./types";

const NOW = Date.UTC(2026, 10, 19);
const file = (name: string, ageDays = 0): Entry => ({ name, isDirectory: false, mtimeMs: NOW - ageDays * 86_400_000 });
const dir = (name: string): Entry => ({ name, isDirectory: true, mtimeMs: NOW });
const plan = (entries: Entry[], config: Config = defaultConfig, desktop = "D:\\Desktop") =>
  buildPlan(entries, desktop, config, NOW, () => false);

describe("classifier", () => {
  it("matches by extension and by name pattern", () => {
    expect(classify(file("boarding pass (1).pdf"), defaultConfig.rules)?.category).toBe("Documents");
    expect(classify(file("Screenshot 2026-1.png"), defaultConfig.rules)?.category).toBe("Screenshots");
    expect(classify(file("song.mp3"), defaultConfig.rules)?.category).toBe("Music");
    expect(classify(file("mystery.xyz"), defaultConfig.rules)).toBeUndefined();
  });

  it("skips disabled rules", () => {
    const rules = defaultConfig.rules.map((r) => (r.category === "Music" ? { ...r, enabled: false } : r));
    expect(classify(file("song.mp3"), rules)).toBeUndefined();
  });

  it("protects names via globs", () => {
    expect(globToRegExp("*.lnk").test("Chrome.LNK")).toBe(true);
    expect(isProtected("DONT_DELETE.pdf", defaultConfig.protectedPatterns)).toBe(true);
  });
});

describe("planner", () => {
  it("never plans folders by default, nor protected names", () => {
    const items = plan([dir("archive_do_not_open"), file("DONT DELETE.pdf"), file("shortcut.lnk"), file("a.pdf")]);
    expect(items.map((p) => p.name)).toEqual(["a.pdf"]);
  });

  it("sweeps folders only when enabled, but never the backup folder itself", () => {
    const cfg = { ...defaultConfig, sweepFolders: true };
    const items = plan([dir("projects"), dir("DeskSweep")], cfg);
    expect(items.map((p) => p.name)).toEqual(["projects"]);
    expect(items[0].category).toBe("Folders");
  });

  it("never moves a folder that contains a custom backup folder", () => {
    const cfg = { ...defaultConfig, sweepFolders: true, destinationDir: "D:\\Desktop\\Stuff\\Backup" };
    expect(plan([dir("Stuff"), dir("Other")], cfg).map((p) => p.name)).toEqual(["Other"]);
  });

  it("uses a custom backup location anywhere on the machine", () => {
    const cfg = { ...defaultConfig, destinationDir: "E:\\Backups\\Desk" };
    expect(plan([file("a.pdf")], cfg)[0].to).toBe(path.join("E:\\Backups\\Desk", "Documents", "a.pdf"));
  });

  it("honours the global minimum age", () => {
    const cfg = { ...defaultConfig, minAgeDays: 7 };
    expect(plan([file("new.pdf", 1), file("old.pdf", 9)], cfg).map((p) => p.name)).toEqual(["old.pdf"]);
  });

  it("avoids collisions, including within the same plan", () => {
    const items = plan([file("a.pdf"), file("A.PDF")]);
    expect(new Set(items.map((p) => p.to.toLowerCase())).size).toBe(2);
  });

  it("keeps hostile category names inside the backup folder", () => {
    expect(sanitizeSegment("..\\..\\Windows")).not.toMatch(/[\\/]/);
    expect(sanitizeSegment("..")).toBe("_");
  });
});

describe("normalizeConfig", () => {
  it("fills defaults and clamps values", () => {
    const cfg = normalizeConfig({ robot: { speed: 99999, color: "red" }, minAgeDays: -3 });
    expect(cfg.robot).toEqual({ skin: "auto", speed: 400, color: defaultConfig.robot.color });
    expect(cfg.minAgeDays).toBe(0);
    expect(cfg.rules.length).toBe(defaultConfig.rules.length);
  });

  it("cleans extensions, drops bad regexes and relative backup paths", () => {
    const cfg = normalizeConfig({
      destinationDir: "relative\\dir",
      rules: [{ category: "X", extensions: [" .PNG ", "jpg"], namePattern: "(" }]
    });
    expect(cfg.destinationDir).toBe("");
    expect(cfg.rules).toEqual([{ name: "X", category: "X", enabled: true, extensions: ["png", "jpg"] }]);
  });

  it("migrates the old skipFolders flag and validates language", () => {
    expect(normalizeConfig({ skipFolders: false }).sweepFolders).toBe(true);
    expect(normalizeConfig({ language: "xx" }, "tr").language).toBe("tr");
    expect(normalizeConfig({ theme: "light" }).theme).toBe("light");
    expect(normalizeConfig({ theme: "neon" }).theme).toBe("dark");
  });
});

describe("icon matching", () => {
  const icons = parseIconDump("﻿report\t120\t80\r\nmusic.mp3\t200\t80\nbroken line\nbad\tx\ty\n");

  it("parses the helper output and skips garbage", () => {
    expect(icons).toEqual([{ text: "report", x: 120, y: 80 }, { text: "music.mp3", x: 200, y: 80 }]);
  });

  it("matches with and without hidden extensions", () => {
    const m = matchIcons([file("report.pdf"), file("Music.MP3"), file("other.txt")], icons);
    expect(m.get("report.pdf")).toEqual({ x: 120, y: 80 });
    expect(m.get("Music.MP3")).toEqual({ x: 200, y: 80 });
    expect(m.has("other.txt")).toBe(false);
  });
});

describe("config file text", () => {
  it("accepts a UTF-8 BOM (saved by some editors) without losing settings", () => {
    const cfg = parseConfigText('﻿{"robot":{"speed":300,"skin":"winter"},"language":"tr"}');
    expect(cfg.robot.speed).toBe(300);
    expect(cfg.robot.skin).toBe("winter");
    expect(cfg.language).toBe("tr");
  });

  it("still rejects text that is not JSON", () => {
    expect(() => parseConfigText("not json")).toThrow();
  });
});

describe("starting the installer", () => {
  const node = process.execPath;

  it("reports true for a program that keeps running (a healthy installer)", async () => {
    expect(await launchDetached(node, ["-e", "setTimeout(() => {}, 3000)"], 500)).toBe(true);
  });

  it("reports false for a program that is gone at once (blocked or crashed installer)", async () => {
    expect(await launchDetached(node, ["-e", "process.exit(1)"], 1500)).toBe(false);
  });

  it("reports false when the file cannot be started at all", async () => {
    expect(await launchDetached("C:\\no\\such\\installer.exe", [], 300)).toBe(false);
  });
});

describe("update settings", () => {
  it("checks for updates unless the user switched it off", () => {
    expect(normalizeConfig({}).updates.check).toBe(true);
    expect(normalizeConfig({ updates: {} }).updates.check).toBe(true);
    expect(normalizeConfig({ updates: { check: "no" } }).updates.check).toBe(true);
    expect(normalizeConfig({ updates: { check: false } }).updates.check).toBe(false);
  });

  it("only lets tests redirect the update feed to this computer", () => {
    expect(localFeedOverride("http://127.0.0.1:8123/")).toBe("http://127.0.0.1:8123/");
    expect(localFeedOverride("http://localhost:8123/feed")).toBe("http://localhost:8123/feed");
    expect(localFeedOverride("https://evil.example.com/")).toBeUndefined();
    expect(localFeedOverride("http://127.0.0.1.evil.example.com/")).toBeUndefined();
    expect(localFeedOverride("file:///C:/feed")).toBeUndefined();
    expect(localFeedOverride("not a url")).toBeUndefined();
    expect(localFeedOverride(undefined)).toBeUndefined();
  });
});

describe("automation config", () => {
  it("validates schedule and clamps hours", () => {
    expect(normalizeConfig({ schedule: { mode: "interval", hours: 9999 } }).schedule).toEqual({ mode: "interval", hours: 168 });
    expect(normalizeConfig({ schedule: { mode: "weird" } }).schedule.mode).toBe("off");
    expect(normalizeConfig({}).startWithWindows).toBe(false);
  });
});

describe("skins", () => {
  it("winter season runs from 15 December to 5 January", () => {
    const d = (m: number, day: number) => new Date(2026, m, day);
    expect(isWinterSeason(d(11, 14))).toBe(false);
    expect(isWinterSeason(d(11, 15))).toBe(true);
    expect(isWinterSeason(d(11, 31))).toBe(true);
    expect(isWinterSeason(d(0, 1))).toBe(true);
    expect(isWinterSeason(d(0, 5))).toBe(true);
    expect(isWinterSeason(d(0, 6))).toBe(false);
    expect(isWinterSeason(d(6, 10))).toBe(false);
  });

  it("auto follows the season, explicit choices always win", () => {
    expect(resolveSkin("auto", new Date(2026, 11, 25))).toBe("winter");
    expect(resolveSkin("auto", new Date(2026, 5, 1))).toBe("classic");
    expect(resolveSkin("classic", new Date(2026, 11, 25))).toBe("classic");
    expect(resolveSkin("winter", new Date(2026, 5, 1))).toBe("winter");
  });

  it("config accepts only known skins", () => {
    expect(normalizeConfig({ robot: { skin: "winter" } }).robot.skin).toBe("winter");
    expect(normalizeConfig({ robot: { skin: "disco" } }).robot.skin).toBe("auto");
  });
});

describe("i18n", () => {
  it("English and Turkish define exactly the same keys", () => {
    expect(Object.keys(strings.tr).sort()).toEqual(Object.keys(strings.en).sort());
  });

  it("translates and interpolates", () => {
    expect(t("tr", "restored", { n: 3 })).toBe("3 öğe geri yüklendi.");
    expect(t("en", "restored", { n: 3 })).toBe("Restored 3 item(s).");
  });
});

describe("journal", () => {
  it("moves files and undoes the last sweep", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "desksweep-"));
    const from = path.join(root, "note.txt");
    const to = path.join(root, "DeskSweep", "Documents", "note.txt");
    fs.writeFileSync(from, "hi");

    const journal = new Journal(path.join(root, "journal.json"));
    applyMove({ from, to });
    journal.commit([{ from, to }]);
    expect(fs.existsSync(from)).toBe(false);

    expect(journal.undoLast()).toEqual({ restored: 1, skipped: [] });
    expect(fs.readFileSync(from, "utf8")).toBe("hi");
    expect(journal.undoLast()).toBeUndefined();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("moves whole folders", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "desksweep-"));
    fs.mkdirSync(path.join(root, "proj"));
    fs.writeFileSync(path.join(root, "proj", "a.txt"), "x");
    const to = path.join(root, "Backup", "Folders", "proj");
    applyMove({ from: path.join(root, "proj"), to });
    expect(fs.readFileSync(path.join(to, "a.txt"), "utf8")).toBe("x");
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("records moves one by one and undoes them newest-first", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "desksweep-"));
    const journal = new Journal(path.join(root, "journal.json"));
    const a = { from: path.join(root, "a.txt"), to: path.join(root, "B", "a.txt") };
    const b = { from: path.join(root, "b.txt"), to: path.join(root, "B", "b.txt") };
    for (const m of [a, b]) { fs.writeFileSync(m.from, m.from); applyMove(m); journal.record("1", m); }

    expect(journal.undoLast()).toEqual({ restored: 2, skipped: [] });
    expect(fs.existsSync(a.from) && fs.existsSync(b.from)).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("refuses to overwrite an existing target", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "desksweep-"));
    const a = path.join(root, "a.txt"), b = path.join(root, "b.txt");
    fs.writeFileSync(a, "1"); fs.writeFileSync(b, "2");
    expect(() => applyMove({ from: a, to: b })).toThrow();
    expect(fs.readFileSync(b, "utf8")).toBe("2");
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("dock placement", () => {
  const area = { x: 0, y: 0, width: 1000, height: 600 };

  it("prefers the bottom-left corner when it is free", () => {
    expect(pickDockSpot(area, [{ x: 500, y: 100 }])).toEqual({ x: 80, y: 530 });
    expect(pickDockSpot(area, [])).toEqual({ x: 80, y: 530 });
  });

  it("moves away from icons crowding the corner", () => {
    const icons = [{ x: 60, y: 520 }, { x: 140, y: 500 }];
    const spot = pickDockSpot(area, icons);
    expect(spot).not.toEqual({ x: 80, y: 530 });
    // whichever corner wins, the dock keeps well clear of every icon
    for (const icon of icons) expect(Math.hypot(icon.x - spot.x, icon.y - spot.y)).toBeGreaterThan(300);
  });
});

describe("layout", () => {
  it("places folders first, column-major", () => {
    const grid = { cellWidth: 100, cellHeight: 100, margin: 0 };
    const pos = estimateIconPositions([file("b.txt"), dir("z"), file("a.txt")], grid, 200);
    expect(pos.get("z")).toEqual({ x: 50, y: 50 });
    expect(pos.get("a.txt")).toEqual({ x: 50, y: 150 });
    expect(pos.get("b.txt")).toEqual({ x: 150, y: 50 });
  });
});
