interface CfgRule {
  name: string;
  category: string;
  enabled?: boolean;
  extensions?: string[];
  namePattern?: string;
}

interface CfgShape {
  language: "en" | "tr";
  theme: "system" | "light" | "dark";
  startWithWindows: boolean;
  updates: { check: boolean };
  schedule: { mode: "off" | "startup" | "interval"; hours: number };
  destinationDir: string;
  sweepFolders: boolean;
  minAgeDays: number;
  protectedPatterns: string[];
  robot: { skin: "auto" | "classic" | "winter"; speed: number; color: string };
  rules: CfgRule[];
}

interface SettingsBootstrap {
  config: CfgShape;
  strings: Record<"en" | "tr", Record<string, string>>;
  builtinCategories: string[];
  isPackaged: boolean;
  version: string;
  resolvedSkin: string;
  defaultDestination: string;
}

interface Window {
  settingsApi: {
    get(): Promise<SettingsBootstrap>;
    save(config: CfgShape): Promise<CfgShape>;
    pickFolder(): Promise<string | undefined>;
    openDestination(dir: string): Promise<void>;
    setTheme(theme: string): void;
    checkUpdates(): Promise<{ state: "disabled" | "upToDate" | "available" | "error"; version?: string }>;
    run(dry: boolean): void;
    undo(): Promise<string>;
  };
}

(() => {
  const api = window.settingsApi;
  const page = document.getElementById("page") as HTMLElement;
  const nav = document.getElementById("nav") as HTMLElement;
  const status = document.getElementById("status") as HTMLElement;

  /** One consistent 24px line-icon set (stroke = currentColor). Constant markup, never user data. */
  const PATHS: Record<string, string> = {
    rules: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
    backup: '<path d="M4 14l2.4-8h11.2L20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 14h16M8 17h.01M12 17h4"/>',
    robot: '<circle cx="12" cy="12" r="8.5"/><circle cx="14.2" cy="12" r="3"/><path d="M14.2 10.6v0"/>',
    safety: '<path d="M12 3l7.5 2.8v5.7c0 4.4-3 7.7-7.5 9.5-4.5-1.8-7.5-5.1-7.5-9.5V5.8z"/><path d="M8.8 12l2.3 2.3 4.2-4.4"/>',
    automation: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    general: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>',
    Screenshots: '<path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/><circle cx="12" cy="12" r="3"/>',
    Installers: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4.3 7.7L12 12l7.7-4.3M12 12v9"/>',
    Archives: '<rect x="4" y="4" width="16" height="5" rx="1.5"/><path d="M5.5 9v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M10 13h4"/>',
    Documents: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    Images: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
    Music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    Videos: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M10.5 9.5v5l4.5-2.5z"/>',
    Design: '<path d="M12 3l4.5 8.5L12 21l-4.5-9.5z"/><circle cx="12" cy="11" r="1.4"/><path d="M12 12.4V21"/>',
    Code: '<path d="M8 8l-4.5 4L8 16M16 8l4.5 4L16 16M13.5 5l-3 14"/>',
    Folders: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    custom: '<path d="M3.5 12V4.5H11l9 9-7.5 7.5z"/><circle cx="8" cy="9" r="1.2"/>',
    folderOpen: '<path d="M3.5 18.5V6.5a2 2 0 0 1 2-2h3.8l2 2.2h7.2a2 2 0 0 1 2 2V10"/><path d="M3.5 18.5l2.4-7.2a1.5 1.5 0 0 1 1.4-1h13.2a1 1 0 0 1 1 1.3l-2 6.4a1.5 1.5 0 0 1-1.4 1.1z"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h9.5a6.5 6.5 0 0 1 0 13H10"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    play: '<path d="M7 4.8l12 7.2-12 7.2z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    system: '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'
  };

  const icon = (name: string): HTMLElement => {
    const s = document.createElement("span");
    s.className = "ico";
    s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] ?? PATHS.custom}</svg>`;
    return s;
  };

  type PageId = "clean" | "backup" | "robot" | "safety" | "automation" | "general";
  const PAGES: { id: PageId; icon: string }[] = [
    { id: "clean", icon: "rules" },
    { id: "backup", icon: "backup" },
    { id: "robot", icon: "robot" },
    { id: "safety", icon: "safety" },
    { id: "automation", icon: "automation" },
    { id: "general", icon: "general" }
  ];
  const SWATCHES = ["#6ea8ff", "#ff7a2f", "#3ecf8e", "#f5c542", "#ff5c7a", "#b5b5bd"];

  let boot: SettingsBootstrap;
  let cfg: CfgShape;
  let current: PageId = "clean";
  let dirty = false;

  const t = (key: string): string => boot.strings[cfg.language][key] ?? boot.strings.en[key] ?? key;

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<HTMLElementTagNameMap[K]> = {},
    ...children: (Node | string)[]
  ): HTMLElementTagNameMap[K] {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  }

  function setStatus(text: string, kind: "" | "dirty" | "ok" = ""): void {
    status.textContent = text;
    status.className = kind;
  }

  function markDirty(): void {
    dirty = true;
    setStatus(t("unsaved"), "dirty");
  }

  function switchEl(checked: boolean, onChange: (v: boolean) => void): HTMLElement {
    const input = el("input", { type: "checkbox", checked });
    input.onchange = () => onChange(input.checked);
    return el("label", { className: "switch" }, input, el("span"));
  }

  /** Extension editor: removable chips plus an input that turns Enter / comma / space into a new chip. */
  function chipEditor(values: string[], onChange: (v: string[]) => void): HTMLElement {
    const box = el("div", { className: "chips" });
    const draw = () => {
      box.replaceChildren();
      values.forEach((v, i) => {
        const x = el("button", { type: "button" }, icon("close"));
        x.onclick = () => { values.splice(i, 1); onChange(values); draw(); };
        box.append(el("span", { className: "chip" }, v, x));
      });
      const input = el("input", { type: "text", placeholder: t("addExt") });
      const commit = () => {
        const parts = input.value.split(/[,\s]+/).map((e) => e.replace(/^\.+/, "").toLowerCase()).filter(Boolean);
        let changed = false;
        for (const p of parts) if (!values.includes(p)) { values.push(p); changed = true; }
        input.value = "";
        if (changed) { onChange(values); draw(); box.querySelector("input")?.focus(); }
      };
      input.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === "," || e.key === " ") { e.preventDefault(); commit(); }
        else if (e.key === "Backspace" && !input.value && values.length) { values.pop(); onChange(values); draw(); box.querySelector("input")?.focus(); }
      };
      input.onblur = commit;
      box.append(input);
    };
    draw();
    return box;
  }

  const head = (title: string, text: string): HTMLElement =>
    el("div", { className: "page-head" }, el("h1", { textContent: title }), el("p", { textContent: text }));

  /* ---------- pages ---------- */

  function ruleCard(rule: CfgRule, index: number): HTMLElement {
    const builtin = boot.builtinCategories.includes(rule.category);
    const card = el("div", { className: `card${rule.enabled === false ? " off" : ""}` });

    const title = builtin
      ? el("div", { className: "title", textContent: t(`rule.${rule.category}`) })
      : (() => {
          const input = el("input", { type: "text", value: rule.name, className: "title-input" });
          input.oninput = () => { rule.name = input.value; rule.category = input.value.trim() || "Custom"; markDirty(); };
          return el("div", { className: "title" }, input);
        })();

    const toggle = switchEl(rule.enabled !== false, (v) => { rule.enabled = v; card.classList.toggle("off", !v); markDirty(); });
    const top = el("div", { className: "card-top" }, el("div", { className: "tile" }, icon(builtin ? rule.category : "custom")), title);

    if (!builtin) {
      const del = el("button", { className: "btn icon-only", title: t("remove"), type: "button" }, icon("close"));
      del.onclick = () => { cfg.rules.splice(index, 1); markDirty(); render(); };
      top.append(del);
    }
    top.append(toggle);

    rule.extensions = rule.extensions ?? [];
    card.append(top, chipEditor(rule.extensions, () => markDirty()));
    return card;
  }

  function cleanPage(): HTMLElement {
    const grid = el("div", { className: "grid" });
    cfg.rules.forEach((rule, i) => grid.append(ruleCard(rule, i)));

    const folderCard = el("div", { className: `card${cfg.sweepFolders ? "" : " off"}` },
      el("div", { className: "card-top" },
        el("div", { className: "tile" }, icon("Folders")),
        el("div", { className: "title", textContent: t("folders") }),
        switchEl(cfg.sweepFolders, (v) => { cfg.sweepFolders = v; folderCard.classList.toggle("off", !v); markDirty(); })),
      el("div", { className: "sub", textContent: t("foldersHint") }));
    grid.append(folderCard);

    const add = el("button", { className: "card add", type: "button" }, icon("plus"), t("addType").replace(/^\+\s*/, ""));
    add.onclick = () => {
      const base = t("newTypeName");
      let name = base;
      for (let n = 2; cfg.rules.some((r) => r.category === name); n++) name = `${base} ${n}`;
      cfg.rules.push({ name, category: name, enabled: true, extensions: [] });
      markDirty();
      render();
    };
    grid.append(add);

    return el("div", {}, head(t("whatToClean"), t("whatToCleanHint")), grid);
  }

  function backupPage(): HTMLElement {
    const shown = cfg.destinationDir || boot.defaultDestination;
    const pathBox = el("div", { className: "pathbox" }, icon("folderOpen"), el("div", { className: "p", textContent: shown }));

    const browse = el("button", { className: "btn primary", type: "button" }, icon("folderOpen"), t("browse"));
    browse.onclick = async () => {
      const picked = await api.pickFolder();
      if (picked) { cfg.destinationDir = picked; markDirty(); render(); }
    };
    const reset = el("button", { className: "btn", textContent: t("useDefault"), type: "button" });
    reset.onclick = () => { cfg.destinationDir = ""; markDirty(); render(); };
    const open = el("button", { className: "btn", textContent: t("openFolder"), type: "button" });
    open.onclick = () => void api.openDestination(cfg.destinationDir);

    const card = el("div", { className: "card" }, pathBox, el("div", { className: "row" }, browse, reset, open));
    if (!cfg.destinationDir) card.append(el("p", { className: "sub", textContent: t("usingDefault") }));
    return el("div", {}, head(t("backup"), t("backupHint")), el("div", { className: "stack" }, card));
  }

  let previewFrame = 0;
  const stopPreview = () => cancelAnimationFrame(previewFrame);

  /** Live preview: the real skin drawing code, on a small canvas. */
  function skinPreview(): HTMLElement {
    const box = el("div", { className: "robot-prev" });
    const canvas = el("canvas");
    canvas.width = 300;
    canvas.height = 300;
    canvas.style.width = "150px";
    canvas.style.height = "150px";
    box.append(canvas);

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const skin = DeskSkins.get(cfg.robot.skin === "auto" ? boot.resolvedSkin : cfg.robot.skin);
    const ambient = skin.createAmbient?.(150, 150);

    const tick = (now: number) => {
      const state = { time: now, accent: cfg.robot.color };
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 150, 150);
      ambient?.draw(ctx, now);
      ctx.save(); ctx.translate(75, 82); ctx.scale(1.2, 1.2); ctx.rotate(0.3);
      skin.drawBody(ctx, state);
      ctx.restore();
      if (skin.drawOverlay) {
        ctx.save(); ctx.translate(75, 82); ctx.scale(1.2, 1.2);
        skin.drawOverlay(ctx, state);
        ctx.restore();
      }
      previewFrame = requestAnimationFrame(tick);
    };
    previewFrame = requestAnimationFrame(tick);
    return box;
  }

  function robotPage(): HTMLElement {
    const prev = skinPreview();
    const paint = () => { /* the preview reads cfg.robot.color on every frame */ };

    const speedValue = el("span", { textContent: `${cfg.robot.speed} px/s` });
    const speed = el("input", { type: "range", min: "40", max: "400", step: "10", value: String(cfg.robot.speed) });
    speed.oninput = () => { cfg.robot.speed = Number(speed.value); speedValue.textContent = `${cfg.robot.speed} px/s`; markDirty(); };

    const swatches = el("div", { className: "swatches" });
    const custom = el("input", { type: "color", value: cfg.robot.color });
    const markSwatches = () => swatches.querySelectorAll<HTMLElement>(".sw").forEach((s) => s.classList.toggle("on", s.dataset.c === cfg.robot.color));
    const setColor = (c: string) => { cfg.robot.color = c; custom.value = c; paint(); markSwatches(); markDirty(); };
    for (const c of SWATCHES) {
      const b = el("button", { className: "sw", type: "button" });
      b.dataset.c = c;
      b.style.background = c;
      b.onclick = () => setColor(c);
      swatches.append(b);
    }
    custom.oninput = () => setColor(custom.value);
    swatches.append(custom);
    markSwatches();

    const skinPicker = optionGroup<CfgShape["robot"]["skin"]>(
      [
        { value: "auto", label: t("skinAuto"), icon: "automation" },
        { value: "classic", label: t("skinClassic"), icon: "robot" },
        { value: "winter", label: t("skinWinter"), icon: "snow" }
      ],
      cfg.robot.skin,
      (v) => { cfg.robot.skin = v; markDirty(); render(); });

    const controls = el("div", { className: "grow" },
      el("div", { className: "field" }, el("label", { className: "lbl" }, t("skin")), skinPicker,
        el("p", { className: "sub spaced", textContent: t("skinHint") })),
      el("div", { className: "field" }, el("label", { className: "lbl" }, t("speed"), speedValue), speed,
        el("div", { className: "row between" }, el("span", { className: "sub", textContent: t("slow") }), el("span", { className: "sub", textContent: t("fast") }))),
      el("div", { className: "field" }, el("label", { className: "lbl" }, t("color")), swatches));

    return el("div", {}, head(t("robot"), t("robotHint")),
      el("div", { className: "stack" }, el("div", { className: "card" }, el("div", { className: "robot-wrap" }, prev, controls))));
  }

  function safetyPage(): HTMLElement {
    const patterns = el("textarea", { value: cfg.protectedPatterns.join("\n"), spellcheck: false });
    patterns.oninput = () => { cfg.protectedPatterns = patterns.value.split("\n").map((p) => p.trim()).filter(Boolean); markDirty(); };

    const age = el("input", { type: "number", min: "0", max: "3650", value: String(cfg.minAgeDays), className: "num" });
    age.oninput = () => { cfg.minAgeDays = Math.max(0, Number(age.value) || 0); markDirty(); };

    return el("div", {}, head(t("safety"), t("safetyHint")),
      el("div", { className: "stack" },
        el("div", { className: "card" }, el("div", { className: "field" }, el("label", { className: "lbl" }, t("protectedNames")), patterns)),
        el("div", { className: "card" }, el("div", { className: "row" }, el("label", { className: "lbl", textContent: t("minAge") }), age))));
  }

  function optionGroup<T extends string>(items: { value: T; label: string; icon?: string }[], selected: T, onPick: (v: T) => void): HTMLElement {
    const box = el("div", { className: "opts" });
    for (const item of items) {
      const b = el("button", { type: "button", className: `opt${item.value === selected ? " on" : ""}` });
      if (item.icon) b.append(icon(item.icon));
      b.append(item.label);
      b.onclick = () => onPick(item.value);
      box.append(b);
    }
    return box;
  }

  function automationPage(): HTMLElement {
    const startup = switchEl(cfg.startWithWindows, (v) => { cfg.startWithWindows = v; markDirty(); });
    const startupInput = startup.querySelector("input") as HTMLInputElement;
    startupInput.disabled = !boot.isPackaged;
    const startupCard = el("div", { className: "card" },
      el("div", { className: "card-top" },
        el("div", { className: "tile" }, icon("play")),
        el("div", { className: "title", textContent: t("startWithWindows") }),
        startup),
      el("div", { className: "sub", textContent: boot.isPackaged ? t("startWithWindowsHint") : t("installedOnly") }));

    const hours = el("input", { type: "number", min: "1", max: "168", value: String(cfg.schedule.hours), className: "num" });
    hours.oninput = () => { cfg.schedule.hours = Math.min(168, Math.max(1, Math.round(Number(hours.value) || 24))); markDirty(); };

    const mode = optionGroup<CfgShape["schedule"]["mode"]>(
      [
        { value: "off", label: t("scheduleOff"), icon: "close" },
        { value: "startup", label: t("scheduleStartup"), icon: "play" },
        { value: "interval", label: t("scheduleInterval"), icon: "automation" }
      ],
      cfg.schedule.mode,
      (v) => { cfg.schedule.mode = v; markDirty(); render(); });

    const scheduleCard = el("div", { className: "card" }, el("h3", { textContent: t("scheduleTitle") }), mode);
    if (cfg.schedule.mode === "interval") {
      scheduleCard.append(el("div", { className: "row spaced" }, el("label", { className: "lbl", textContent: t("everyHours") }), hours));
    }

    return el("div", {}, head(t("automation"), t("automationHint")), el("div", { className: "stack" }, startupCard, scheduleCard));
  }

  function generalPage(): HTMLElement {
    const language = optionGroup<"en" | "tr">(
      [{ value: "en", label: "English" }, { value: "tr", label: "Türkçe" }],
      cfg.language,
      (v) => { cfg.language = v; markDirty(); render(); });

    const theme = optionGroup<CfgShape["theme"]>(
      [
        { value: "system", label: t("themeSystem"), icon: "system" },
        { value: "light", label: t("themeLight"), icon: "light" },
        { value: "dark", label: t("themeDark"), icon: "dark" }
      ],
      cfg.theme,
      (v) => { cfg.theme = v; api.setTheme(v); markDirty(); render(); });

    return el("div", {}, head(t("general"), t("generalHint")),
      el("div", { className: "stack" },
        el("div", { className: "card" }, el("h3", { textContent: t("language") }), language),
        el("div", { className: "card" }, el("h3", { textContent: t("theme") }), theme),
        updatesCard()));
  }

  function updatesCard(): HTMLElement {
    const result = el("span", { className: "sub", textContent: t("versionLabel").replace("{v}", boot.version) });

    const auto = switchEl(cfg.updates.check, (v) => { cfg.updates.check = v; markDirty(); });
    const check = el("button", { className: "btn", type: "button", textContent: t("updatesCheckNow") });
    check.onclick = async () => {
      check.disabled = true;
      result.textContent = t("updatesChecking");
      const status = await api.checkUpdates();
      check.disabled = false;
      result.textContent =
        status.state === "disabled" ? t("updatesDev")
        : status.state === "error" ? t("updatesError")
        : status.state === "available" ? t("updatesAvailable").replace("{v}", status.version ?? "")
        : t("updatesUpToDate").replace("{v}", boot.version);
    };

    return el("div", { className: "card" },
      el("div", { className: "card-top" },
        el("div", { className: "tile" }, icon("check")),
        el("div", { className: "title", textContent: t("updatesAuto") }),
        auto),
      el("p", { className: "sub", textContent: t("updatesHint") }),
      el("div", { className: "row spaced" }, check, result));
  }

  /* ---------- shell ---------- */

  function renderNav(): void {
    nav.replaceChildren(...PAGES.map(({ id, icon: ic }) => {
      const label = id === "clean" ? t("whatToCleanShort") : t(id);
      const b = el("button", { type: "button", className: id === current ? "active" : "" }, icon(ic), el("span", { className: "lbl-t", textContent: label }));
      b.onclick = () => { current = id; render(); };
      return b;
    }));
  }

  function setButton(id: string, ic: string, text: string): void {
    (document.getElementById(id) as HTMLButtonElement).replaceChildren(icon(ic), el("span", { className: "lbl-t", textContent: text }));
  }

  function render(): void {
    stopPreview();
    document.title = t("appTitle");
    (document.getElementById("tagline") as HTMLElement).textContent = t("tagline");
    renderNav();
    const scroll = page.scrollTop;
    page.replaceChildren({ clean: cleanPage, backup: backupPage, robot: robotPage, safety: safetyPage, automation: automationPage, general: generalPage }[current]());
    page.scrollTop = scroll;

    setButton("btn-undo", "undo", t("undo"));
    setButton("btn-dry", "eye", t("preview"));
    setButton("btn-sweep", "play", t("sweepNow"));
    setButton("btn-save", "check", t("save"));
  }

  async function save(): Promise<void> {
    cfg = await api.save(cfg);
    dirty = false;
    render();
    setStatus(t("saved"), "ok");
  }

  /** Sweeping uses the saved config, so persist pending edits first. */
  async function saveThen(action: () => void): Promise<void> {
    if (dirty) await save();
    action();
    // Feedback while the robot gets ready (it takes a moment to appear).
    setStatus(t("starting"));
    setTimeout(() => { if (status.textContent === t("starting")) setStatus(""); }, 4000);
  }

  (document.getElementById("btn-save") as HTMLButtonElement).onclick = () => void save();
  (document.getElementById("btn-dry") as HTMLButtonElement).onclick = () => void saveThen(() => api.run(true));
  (document.getElementById("btn-sweep") as HTMLButtonElement).onclick = () => void saveThen(() => api.run(false));
  (document.getElementById("btn-undo") as HTMLButtonElement).onclick = async () => { setStatus(await api.undo()); };

  void api.get().then((data) => {
    boot = data;
    cfg = data.config;
    render();
  });
})();
