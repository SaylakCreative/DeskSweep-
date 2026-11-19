interface SweepItem {
  id: number;
  name: string;
  category: string;
  x: number;
  y: number;
}

interface StartData {
  speed: number;
  color: string;
  dry: boolean;
  width: number;
  height: number;
  items: SweepItem[];
}

interface Window {
  deskSweep: {
    onStart(cb: (data: StartData) => void): void;
    sweep(id: number): Promise<{ ok: boolean; error?: string }>;
    finish(): void;
  };
}

(() => {
  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const dpr = window.devicePixelRatio || 1;

  const robot = { x: -80, y: 0, angle: 0 };
  let bubble: { text: string; until: number } | undefined;
  const dust: { x: number; y: number; vx: number; vy: number; born: number }[] = [];
  const eating: { label: string; x: number; y: number; born: number }[] = [];

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  function resize(width: number, height: number): void {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawRobot(now: number): void {
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.angle);
    // soft shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.ellipse(4, 8, 36, 32, 0, 0, Math.PI * 2); ctx.fill();
    // spinning side brush
    ctx.save();
    ctx.translate(22, 22); ctx.rotate(now / 90);
    ctx.strokeStyle = "#ff9a3c"; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.rotate((Math.PI * 2) / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(11, 0); ctx.stroke(); }
    ctx.restore();
    // body
    ctx.fillStyle = "#f4f4f6"; ctx.strokeStyle = "#b9bcc4"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // lens
    ctx.fillStyle = "#1a1a1f";
    ctx.beginPath(); ctx.arc(8, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(11, -3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function frame(now: number): void {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      const age = (now - p.born) / 600;
      if (age >= 1) { dust.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(220,220,230,${0.5 * (1 - age)})`;
      ctx.beginPath(); ctx.arc(p.x + p.vx * age * 20, p.y + p.vy * age * 20, 3 * (1 - age) + 1, 0, Math.PI * 2); ctx.fill();
    }

    for (let i = eating.length - 1; i >= 0; i--) {
      const e = eating[i];
      const k = (now - e.born) / 420;
      if (k >= 1) { eating.splice(i, 1); continue; }
      const x = e.x + (robot.x - e.x) * k;
      const y = e.y + (robot.y - e.y) * k;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.font = `${Math.max(8, 13 * (1 - k))}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3;
      ctx.strokeText(e.label, x, y); ctx.fillText(e.label, x, y);
      ctx.restore();
    }

    drawRobot(now);

    if (bubble && now < bubble.until) {
      ctx.font = "bold 14px Segoe UI, sans-serif";
      const w = ctx.measureText(bubble.text).width + 16;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#999"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(robot.x - w / 2, robot.y - 66, w, 24, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#222"; ctx.textAlign = "center";
      ctx.fillText(bubble.text, robot.x, robot.y - 49);
    }
    requestAnimationFrame(frame);
  }

  /** Cruise speed in px/s and turn rate in rad/s: tuned to look like a real robot vacuum. */
  let SPEED = 150;
  let accent = "#6ea8ff";
  const TURN_RATE = 2.2;

  /** Rotates in place, taking the shortest way round, like a robot lining itself up. */
  function turnTo(target: number): Promise<void> {
    return new Promise((resolve) => {
      let diff = target - robot.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const start = robot.angle;
      const dur = Math.max(1, (Math.abs(diff) / TURN_RATE) * 1000);
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = k * k * (3 - 2 * k);
        robot.angle = start + diff * e;
        if (k < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** Turn, then drive straight: gentle acceleration, steady cruise, gentle braking, slight wobble. */
  async function moveTo(tx: number, ty: number): Promise<void> {
    const sx = robot.x, sy = robot.y;
    const dist = Math.hypot(tx - sx, ty - sy);
    if (dist < 2) return;
    const heading = Math.atan2(ty - sy, tx - sx);
    await turnTo(heading);

    const ramp = 0.18; // fraction of the trip spent accelerating / braking
    const v = 1 / (1 - ramp);
    const dur = Math.max(400, (dist / SPEED) * 1000 * (1 + ramp / 2));
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const p = k < ramp ? (v * k * k) / (2 * ramp)
          : k > 1 - ramp ? 1 - (v * (1 - k) * (1 - k)) / (2 * ramp)
          : v * (k - ramp / 2);
        robot.x = sx + (tx - sx) * p;
        robot.y = sy + (ty - sy) * p;
        robot.angle = heading + Math.sin(now / 130) * 0.03;
        if (Math.random() < 0.5) dust.push({ x: robot.x - Math.cos(heading) * 30, y: robot.y - Math.sin(heading) * 30, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, born: now });
        if (k < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  /** Greedy nearest-neighbour order keeps the robot's path short and natural. */
  function order(items: SweepItem[], from: { x: number; y: number }): SweepItem[] {
    const left = [...items];
    const out: SweepItem[] = [];
    let cur = from;
    while (left.length) {
      let best = 0;
      for (let i = 1; i < left.length; i++) {
        if (Math.hypot(left[i].x - cur.x, left[i].y - cur.y) < Math.hypot(left[best].x - cur.x, left[best].y - cur.y)) best = i;
      }
      const [next] = left.splice(best, 1);
      out.push(next);
      cur = next;
    }
    return out;
  }

  window.deskSweep.onStart(async (data) => {
    SPEED = data.speed;
    accent = data.color;
    resize(data.width, data.height);
    robot.x = -80;
    robot.y = data.height - 120;
    requestAnimationFrame(frame);

    for (const item of order(data.items, robot)) {
      await moveTo(item.x, item.y);
      // Sweep the moment the robot is on top of the icon, then pause only briefly.
      const result = await window.deskSweep.sweep(item.id);
      bubble = { text: result.ok ? (data.dry ? "would nom!" : "nom!") : "oops!", until: performance.now() + 700 };
      if (result.ok) eating.push({ label: item.name, x: item.x, y: item.y + 30, born: performance.now() });
      await sleep(250);
    }

    bubble = { text: data.dry ? "preview done" : "all clean!", until: performance.now() + 1800 };
    await sleep(1500);
    await moveTo(data.width + 100, data.height - 120);
    window.deskSweep.finish();
  });
})();
