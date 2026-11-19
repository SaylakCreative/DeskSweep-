// Builds the app icon set from scripts/icon/source.webp.
//   build/icon.png            1024px master (transparent corners, graphite squircle)
//   build/icon.ico            16..256px, small sizes redrawn simplified so they stay readable
//   docs/images/logo.png      README logo
//   src/settings/logo.png     sidebar logo
// Run with: npx electron scripts/icon/make-icon.cjs
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const GRAPHITE = "#1e1e20";
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const SIMPLE_MAX = 32; // up to this size the simplified artwork is used

// Runs inside the page (canvas available). Returns PNG data URLs.
const pageScript = (dataUrl, graphite, icoSizes, simpleMax) => `(async () => {
  const GRAPHITE = ${JSON.stringify(graphite)};
  const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const make = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  function squirclePath(ctx, cx, cy, half, n) {
    ctx.beginPath();
    const N = 720;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      const x = cx + half * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const y = cy + half * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function shrink(canvas, size) {            // step-halving keeps small sizes crisp
    let cur = canvas;
    while (cur.width / 2 >= size) {
      const next = make(cur.width / 2, cur.height / 2), x = next.getContext("2d");
      x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, next.width, next.height); cur = next;
    }
    const out = make(size, size), x = out.getContext("2d");
    x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, size, size);
    return out;
  }

  // ---------- master ----------
  const img = await load(${JSON.stringify(dataUrl)});
  const W = img.naturalWidth, H = img.naturalHeight, k = W / 1254;
  const src = make(W, H), sctx = src.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, W, H), d = data.data;

  // Flood-fill the dark background (and the soft shadow) from inside the squircle, then lift it to graphite.
  const [gr, gg, gb] = hex(GRAPHITE);
  const dark = (i) => d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60;
  const seen = new Uint8Array(W * H), stack = [Math.round(0.18 * H) * W + Math.round(W / 2)];
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    const i = p * 4;
    if (!dark(i)) continue;
    seen[p] = 1;
    d[i] = Math.max(d[i], gr); d[i + 1] = Math.max(d[i + 1], gg); d[i + 2] = Math.max(d[i + 2], gb);
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W);
  }
  sctx.putImageData(data, 0, 0);

  // New, perfectly symmetric squircle (kept inside the original shape so no white edge can leak in).
  const SIZE = 1024, C = 958 * k, cx = 626 * k, cy = 618 * k, SIDE = 900 * k;
  const scale = SIZE / C, half = (SIDE / 2) * scale;
  const master = make(SIZE, SIZE), m = master.getContext("2d");
  m.imageSmoothingQuality = "high";
  m.save();
  squirclePath(m, SIZE / 2, SIZE / 2, half, 5);
  m.clip();
  m.fillStyle = GRAPHITE; m.fillRect(0, 0, SIZE, SIZE);
  m.drawImage(src, cx - C / 2, cy - C / 2, C, C, 0, 0, SIZE, SIZE);
  m.restore();

  // Leak check: any near-white pixel in the outer 8px ring of the shape means the old border got in.
  const ring = make(SIZE, SIZE), rc = ring.getContext("2d");
  rc.fillStyle = "#fff"; squirclePath(rc, SIZE / 2, SIZE / 2, half, 5); rc.fill();
  rc.globalCompositeOperation = "destination-out"; squirclePath(rc, SIZE / 2, SIZE / 2, half - 8, 5); rc.fill();
  const ra = rc.getImageData(0, 0, SIZE, SIZE).data, md = m.getImageData(0, 0, SIZE, SIZE).data;
  let leak = 0;
  for (let i = 0; i < ra.length; i += 4) if (ra[i + 3] > 200 && md[i] > 120) leak++;

  // ---------- simplified artwork for tiny sizes ----------
  function simple(size) {
    const c = make(size, size), x = c.getContext("2d"), s = size;
    squirclePath(x, s / 2, s / 2, s * 0.47, 5); x.fillStyle = GRAPHITE; x.fill();
    x.beginPath(); x.arc(s / 2, s * 0.49, s * 0.30, 0, Math.PI * 2); x.fillStyle = "#f1f1f3"; x.fill();
    if (s >= 20) { x.lineWidth = Math.max(1, s * 0.035); x.strokeStyle = "#b9bcc4"; x.stroke(); }
    x.beginPath(); x.arc(s / 2, s * 0.56, s * 0.105, 0, Math.PI * 2); x.fillStyle = "#17171a"; x.fill();
    if (s >= 24) { x.beginPath(); x.arc(s / 2 + s * 0.02, s * 0.535, s * 0.03, 0, Math.PI * 2); x.fillStyle = "#6ea8ff"; x.fill(); }
    if (s >= 24) { x.beginPath(); x.arc(s * 0.79, s * 0.64, s * 0.05, 0, Math.PI * 2); x.fillStyle = "#ff9a3c"; x.fill(); }
    return c;
  }

  const png = (c) => c.toDataURL("image/png");
  const sizes = {};
  for (const s of ${JSON.stringify(icoSizes)}) sizes[s] = png(s <= ${simpleMax} ? simple(s) : shrink(master, s));

  return { leak, master: png(master), sizes, logo256: png(shrink(master, 256)), logo128: png(shrink(master, 128)) };
})()`;

const toBuffer = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");

/** Minimal ICO writer: a directory of PNG-compressed images. */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  let offset = 6 + entries.length * 16;
  const dir = [];
  for (const { size, png } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8); e.writeUInt32LE(offset, 12);
    offset += png.length;
    dir.push(e);
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.png)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL("data:text/html,<html></html>");
  const source = "data:image/webp;base64," + fs.readFileSync(path.join(__dirname, "source.webp")).toString("base64");
  const result = await win.webContents.executeJavaScript(pageScript(source, GRAPHITE, ICO_SIZES, SIMPLE_MAX));

  const write = (rel, buf) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); };
  write("build/icon.png", toBuffer(result.master));
  write("docs/images/logo.png", toBuffer(result.logo256));
  write("src/settings/logo.png", toBuffer(result.logo128));
  write("build/icon.ico", buildIco(ICO_SIZES.map((size) => ({ size, png: toBuffer(result.sizes[size]) }))));
  for (const size of ICO_SIZES) write(`scripts/icon/preview/${size}.png`, toBuffer(result.sizes[size]));

  console.log("edge leak pixels:", result.leak);
  app.quit();
});
