export type Language = "en" | "tr";
export type Theme = "system" | "light" | "dark";
/** "auto" picks the seasonal skin by date; the others force one skin. */
export type SkinPreference = "auto" | "classic" | "winter";

export interface Rule {
  /** Human readable rule name. */
  name: string;
  /** Sub-folder (inside the backup folder) the matching files are moved to. */
  category: string;
  /** Rule is skipped when false. Missing means enabled. */
  enabled?: boolean;
  /** Lowercase extensions without the dot, e.g. ["png", "jpg"]. */
  extensions?: string[];
  /** Case-insensitive regular expression matched against the file name. */
  namePattern?: string;
}

export interface IconGrid {
  cellWidth: number;
  cellHeight: number;
  margin: number;
}

export interface RobotSettings {
  /** Which look the robot has (see src/shared/skins.ts). */
  skin: SkinPreference;
  /** Cruise speed in px/s. */
  speed: number;
  /** Accent colour (#rrggbb) of the robot's lens. */
  color: string;
}

export type ScheduleMode = "off" | "startup" | "interval";

export interface Schedule {
  /** off = manual only, startup = once when the app starts with Windows, interval = every N hours. */
  mode: ScheduleMode;
  hours: number;
}

export interface Config {
  language: Language;
  theme: Theme;
  /** Launch DeskSweep (tray only) when you sign in to Windows. Installed builds only. */
  startWithWindows: boolean;
  schedule: Schedule;
  /**
   * Absolute path of the backup folder that receives swept items.
   * Empty string means "<Desktop>\DeskSweep".
   */
  destinationDir: string;
  /** First matching enabled rule wins. Files matching no rule are left alone. */
  rules: Rule[];
  /** When true, whole folders are swept too (into a "Folders" sub-folder). */
  sweepFolders: boolean;
  /** Case-insensitive globs (* and ?) for names the robot must never touch. */
  protectedPatterns: string[];
  /** Only sweep items last modified at least this many days ago (0 = everything). */
  minAgeDays: number;
  robot: RobotSettings;
  /** Used to estimate where desktop icons are drawn (see src/core/layout.ts). */
  iconGrid: IconGrid;
}

export interface Entry {
  name: string;
  isDirectory: boolean;
  mtimeMs: number;
}

export interface PlanItem {
  id: number;
  name: string;
  from: string;
  to: string;
  category: string;
  ruleName: string;
}

export interface JournalMove {
  from: string;
  to: string;
}

export interface JournalBatch {
  id: string;
  time: string;
  moves: JournalMove[];
}
