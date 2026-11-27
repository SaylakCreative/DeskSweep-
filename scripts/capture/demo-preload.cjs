// Stand-in for the real preload: lets the unmodified renderer.js play on a fake desktop.
const { contextBridge, ipcRenderer } = require("electron");
const { bubbleTexts } = require(require("node:path").join(__dirname, "..", "..", "dist", "core", "skins"));

let startCallback;

contextBridge.exposeInMainWorld("deskSweep", {
  onStart: (cb) => { startCallback = cb; },
  sweep: async (id) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "scale(.2)";
      setTimeout(() => el.remove(), 350);
    }
    return { ok: true };
  },
  finish: () => ipcRenderer.send("demo-finish")
});

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const items = [...document.querySelectorAll("[data-sweep]")].map((el, i) => {
      el.dataset.id = String(i);
      const r = el.querySelector(".glyph").getBoundingClientRect();
      return { id: i, name: el.dataset.name, category: "x", x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    // same rule as the app: the corner with the most room around it (the demo has an icon at bottom-left)
    const obstacles = [...document.querySelectorAll(".icon")].map((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const spots = [{ x: 80, y: window.innerHeight - 110 }, { x: window.innerWidth - 80, y: window.innerHeight - 110 }, { x: window.innerWidth / 2, y: window.innerHeight - 110 }, { x: window.innerWidth - 80, y: 70 }];
    const dock = spots.reduce((best, c) => {
      const clearance = Math.min(...obstacles.map((o) => Math.hypot(o.x - c.x, o.y - c.y)));
      return clearance > best.clearance ? { ...c, clearance } : best;
    }, { x: 0, y: 0, clearance: -1 });
    startCallback({ dock: { x: dock.x, y: dock.y }, bubbles: bubbleTexts("en", process.env.CAPTURE_SKIN || "classic"), skin: process.env.CAPTURE_SKIN || "classic", dry: false, width: window.innerWidth, height: window.innerHeight, speed: 300, color: "#6ea8ff", items });
  }, 700);
});
