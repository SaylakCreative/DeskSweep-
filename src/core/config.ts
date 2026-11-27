import * as path from "node:path";
import { SKIN_PREFERENCES } from "./skins";
import type { Config, Language, Rule, SkinPreference } from "./types";

/** Display ids of the rules that ship with the app (the UI can't delete these, only disable them). */
export const BUILTIN_CATEGORIES = ["Screenshots", "Installers", "Archives", "Documents", "Images", "Music", "Videos", "Design", "Code"];

export const defaultConfig: Config = {
  language: "en",
  theme: "dark",
  startWithWindows: false,
  schedule: { mode: "off", hours: 24 },
  updates: { check: true },
  destinationDir: "",
  sweepFolders: false,
  minAgeDays: 0,
  protectedPatterns: [
    "desktop.ini",
    "*.lnk",
    "*.url",
    "*dont*delete*",
    "*don't*delete*",
    "*do_not*",
    "*do not*",
    "*silme*",
    "*keep*"
  ],
  robot: { skin: "auto", speed: 150, color: "#6ea8ff" },
  iconGrid: { cellWidth: 75, cellHeight: 100, margin: 8 },
  rules: [
    { name: "Screenshots", category: "Screenshots", namePattern: "^(screenshot|screen shot|ekran görüntüsü|capture)" },
    { name: "Installers", category: "Installers", extensions: ["exe", "msi", "dmg", "pkg", "appx", "msix"] },
    { name: "Archives", category: "Archives", extensions: ["zip", "rar", "7z", "tar", "gz", "tgz"] },
    { name: "Documents", category: "Documents", extensions: ["pdf", "doc", "docx", "txt", "md", "rtf", "odt", "ppt", "pptx", "xls", "xlsx", "csv"] },
    { name: "Images", category: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic"] },
    { name: "Music", category: "Music", extensions: ["mp3", "wav", "flac", "m4a", "ogg", "aac"] },
    { name: "Videos", category: "Videos", extensions: ["mp4", "mov", "mkv", "avi", "webm"] },
    { name: "Design", category: "Design", extensions: ["fig", "psd", "ai", "xd", "sketch", "blend"] },
    { name: "Code", category: "Code", extensions: ["js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "cs", "json", "html", "css", "sh", "ps1"] }
  ]
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const num = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function normalizeRule(raw: unknown): Rule[] {
  if (!isObj(raw) || typeof raw.category !== "string" || !raw.category.trim()) return [];
  const rule: Rule = {
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : raw.category.trim(),
    category: raw.category.trim(),
    enabled: raw.enabled !== false
  };
  const ext = strings(raw.extensions).map((e) => e.trim().replace(/^\.+/, "").toLowerCase()).filter(Boolean);
  if (ext.length) rule.extensions = [...new Set(ext)];
  if (typeof raw.namePattern === "string" && raw.namePattern) {
    try {
      new RegExp(raw.namePattern, "i");
      rule.namePattern = raw.namePattern;
    } catch {
      /* invalid regex from a hand-edited file: drop it instead of crashing every sweep */
    }
  }
  return [rule];
}

/**
 * Parses the text of config.json. Some editors (older Notepad, PowerShell's -Encoding utf8) save a
 * UTF-8 BOM that JSON.parse rejects, which would silently throw away the user's settings.
 */
export function parseConfigText(text: string, fallbackLanguage: Language = "en"): Config {
  return normalizeConfig(JSON.parse(text.replace(/^﻿/, "")), fallbackLanguage);
}

/** Turns anything read from disk or from the settings UI into a safe, complete Config. */
export function normalizeConfig(raw: unknown, fallbackLanguage: Language = "en"): Config {
  const r = isObj(raw) ? raw : {};
  const d = defaultConfig;
  const robot = isObj(r.robot) ? r.robot : {};
  const grid = isObj(r.iconGrid) ? r.iconGrid : {};
  const sched = isObj(r.schedule) ? r.schedule : {};

  const dest = typeof r.destinationDir === "string" ? r.destinationDir.trim() : "";
  // Old configs stored `skipFolders`; keep honouring it.
  const sweepFolders = typeof r.sweepFolders === "boolean" ? r.sweepFolders : typeof r.skipFolders === "boolean" ? !r.skipFolders : d.sweepFolders;

  return {
    language: r.language === "tr" || r.language === "en" ? r.language : fallbackLanguage,
    theme: r.theme === "light" || r.theme === "dark" || r.theme === "system" ? r.theme : d.theme,
    startWithWindows: r.startWithWindows === true,
    updates: { check: isObj(r.updates) && r.updates.check === false ? false : true },
    schedule: {
      mode: sched.mode === "startup" || sched.mode === "interval" ? sched.mode : "off",
      hours: Math.round(num(sched.hours, d.schedule.hours, 1, 168))
    },
    destinationDir: dest && path.isAbsolute(dest) ? path.normalize(dest) : "",
    sweepFolders,
    minAgeDays: num(r.minAgeDays, 0, 0, 3650),
    protectedPatterns: Array.isArray(r.protectedPatterns) ? strings(r.protectedPatterns).map((p) => p.trim()).filter(Boolean) : d.protectedPatterns,
    robot: {
      skin: SKIN_PREFERENCES.includes(robot.skin as SkinPreference) ? (robot.skin as SkinPreference) : d.robot.skin,
      speed: num(robot.speed, d.robot.speed, 40, 400),
      color: typeof robot.color === "string" && /^#[0-9a-f]{6}$/i.test(robot.color) ? robot.color : d.robot.color
    },
    iconGrid: {
      cellWidth: num(grid.cellWidth, d.iconGrid.cellWidth, 30, 400),
      cellHeight: num(grid.cellHeight, d.iconGrid.cellHeight, 30, 400),
      margin: num(grid.margin, d.iconGrid.margin, 0, 200)
    },
    rules: Array.isArray(r.rules) ? r.rules.flatMap(normalizeRule) : d.rules
  };
}
