// Robot skins: how the robot (and the scene around it) is drawn.
//
// This is a plain script, loaded before renderer.js (the overlay) and settings.js (the preview),
// so it exposes everything through the single global `DeskSkins`. To add a skin: write a Skin
// object below, register it in `skins`, and add its id to src/core/skins.ts and its name and speech-bubble
// texts ("bubble.<id>.<kind>") to src/core/i18n.ts in both languages.

interface SkinDrawState {
  /** Milliseconds, drives animations such as the spinning side brush. */
  time: number;
  /** Lens highlight colour chosen by the user. */
  accent: string;
}

interface SkinAmbient {
  /** Draws scene-wide effects (e.g. falling snow) behind the robot. */
  draw(ctx: CanvasRenderingContext2D, now: number): void;
}

interface Skin {
  id: string;
  /** Draws the robot centred on (0,0), already rotated to its heading. */
  drawBody(ctx: CanvasRenderingContext2D, state: SkinDrawState): void;
  /** Drawn after the body, centred on the robot but NOT rotated (hats, antennas...). */
  drawOverlay?(ctx: CanvasRenderingContext2D, state: SkinDrawState): void;
  createAmbient?(width: number, height: number): SkinAmbient;
  /** An item being swept up; k goes 0 -> 1 while it flies into the robot. */
  drawEaten(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, k: number): void;
  /** If set, a burst of confetti in these colours pops where an item was swept. */
  confetti?: string[];
}

const DeskSkins = (() => {
  const TAU = Math.PI * 2;

  function drawClassicBody(ctx: CanvasRenderingContext2D, s: SkinDrawState): void {
    // soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(4, 8, 36, 32, 0, 0, TAU); ctx.fill();
    // spinning side brush
    ctx.save();
    ctx.translate(22, 22); ctx.rotate(s.time / 90);
    ctx.strokeStyle = "#ff9a3c"; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke(); }
    ctx.restore();
    // body
    ctx.fillStyle = "#f4f4f6"; ctx.strokeStyle = "#b9bcc4"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill(); ctx.stroke();
    // lens
    ctx.fillStyle = "#1a1a1f";
    ctx.beginPath(); ctx.arc(8, 0, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = s.accent;
    ctx.beginPath(); ctx.arc(11, -3, 3, 0, TAU); ctx.fill();
  }

  function drawFileLabel(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, k: number): void {
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.font = `${Math.max(8, 13 * (1 - k))}px Segoe UI, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3;
    ctx.strokeText(label, x, y); ctx.fillText(label, x, y);
    ctx.restore();
  }

  const classic: Skin = {
    id: "classic",
    drawBody: drawClassicBody,
    drawEaten: drawFileLabel
  };

  /* ---------- winter / New Year ---------- */

  function drawSantaHat(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(-10, -27);
    ctx.rotate(-0.42);
    // hat
    ctx.fillStyle = "#d8302f";
    ctx.beginPath();
    ctx.moveTo(-19, 3);
    ctx.bezierCurveTo(-17, -24, 5, -33, 25, -19);
    ctx.bezierCurveTo(14, -14, 12, -6, 19, 3);
    ctx.closePath();
    ctx.fill();
    // fur trim
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.roundRect(-23, -3, 46, 11, 5.5); ctx.fill();
    // pompom
    ctx.beginPath(); ctx.arc(26, -19, 6.5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawGift(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
    const h = size / 2;
    ctx.fillStyle = "#d8302f"; ctx.fillRect(x - h, y - h, size, size);
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(x - size * 0.09, y - h, size * 0.18, size);
    ctx.fillRect(x - h, y - size * 0.09, size, size * 0.18);
    ctx.beginPath(); ctx.arc(x - size * 0.17, y - h, size * 0.17, 0, TAU); ctx.arc(x + size * 0.17, y - h, size * 0.17, 0, TAU); ctx.fill();
  }

  function createSnow(width: number, height: number): SkinAmbient {
    // Density follows the area: sparse in the small preview, still festive on a full desktop.
    const count = Math.min(180, Math.max(18, Math.round((width * height) / 9000)));
    const flakes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1 + Math.random() * 2.6,
      speed: 18 + Math.random() * 30,
      phase: Math.random() * TAU,
      sway: 6 + Math.random() * 14
    }));
    let last = 0;
    return {
      draw(ctx, now) {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        ctx.fillStyle = "#ffffff";
        for (const f of flakes) {
          f.y += f.speed * dt;
          f.phase += dt;
          if (f.y > height + 6) { f.y = -6; f.x = Math.random() * width; }
          ctx.globalAlpha = 0.5 + f.r / 7;
          ctx.beginPath(); ctx.arc(f.x + Math.sin(f.phase) * f.sway, f.y, f.r, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  const winter: Skin = {
    id: "winter",
    drawBody: drawClassicBody,
    drawOverlay: drawSantaHat,
    createAmbient: createSnow,
    confetti: ["#d8302f", "#2f9e5f", "#f5c542", "#ffffff"],
    drawEaten(ctx, _label, x, y, k) {
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.6;
      drawGift(ctx, x, y, 24 * (1 - k) + 6);
      ctx.restore();
    }
  };

  const skins: Record<string, Skin> = { classic, winter };

  return {
    /** Unknown ids fall back to the classic look. */
    get(id: string): Skin { return skins[id] ?? classic; }
  };
})();
