// Stand-in for the real settings preload, used only to take README screenshots.
const { contextBridge } = require("electron");
const path = require("node:path");

const core = path.join(__dirname, "..", "..", "dist", "core");
const { strings } = require(path.join(core, "i18n"));
const { defaultConfig, BUILTIN_CATEGORIES } = require(path.join(core, "config"));

const overrides = JSON.parse(process.env.CAPTURE_CFG || "{}");
const config = { ...JSON.parse(JSON.stringify(defaultConfig)), ...overrides };

contextBridge.exposeInMainWorld("settingsApi", {
  get: async () => ({
    config,
    strings,
    builtinCategories: BUILTIN_CATEGORIES,
    isPackaged: true,
    resolvedSkin: config.robot.skin === "winter" ? "winter" : "classic",
    defaultDestination: "C:\\Users\\you\\Desktop\\DeskSweep"
  }),
  save: async (c) => c,
  pickFolder: async () => undefined,
  openDestination: async () => {},
  setTheme: () => {},
  run: () => {},
  undo: async () => ""
});
