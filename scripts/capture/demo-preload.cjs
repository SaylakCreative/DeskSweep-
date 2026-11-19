// Stand-in for the real preload: lets the unmodified renderer.js play on a fake desktop.
const { contextBridge, ipcRenderer } = require("electron");

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
    startCallback({ dry: false, width: window.innerWidth, height: window.innerHeight, speed: 300, color: "#6ea8ff", items });
  }, 700);
});
