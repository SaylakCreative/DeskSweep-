interface SweepItem {
  id: number;
  name: string;
  category: string;
  x: number;
  y: number;
}

interface StartData {
  /** Where the robot's charging dock is: it rolls out of it and returns to it. */
  dock: { x: number; y: number };
  skin: string;
  /** Speech-bubble texts in the app's language. */
  bubbles: { eat: string; dryEat: string; oops: string; done: string; dryDone: string };
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
  let skin: Skin = DeskSkins.get("classic");
  let ambient: SkinAmbient | undefined;
  let bubble: { text: string; until: number } | undefined;
  const dust: { x: number; y: number; vx: number; vy: number; born: number }[] = [];
  const eating: { label: string; x: number; y: number; born: number }[] = [];
  const confetti: { x: number; y: number; vx: number; vy: number; born: number; color: string; spin: number }[] = [];

  function burstConfetti(x: number, y: number, colors: string[], now: number): void {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 110;
      confetti.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 70, born: now, color: colors[i % colors.length], spin: Math.random() * 8 });
    }
  }

  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /**
   * requestAnimationFrame, with a timer as a safety net: if Chromium ever pauses animation frames
   * (it does for windows it considers hidden), the sweep logic still moves on instead of freezing.
   */
  function nextFrame(cb: (now: number) => void): void {
    let called = false;
    requestAnimationFrame((now) => { if (!called) { called = true; cb(now); } });
    setTimeout(() => { if (!called) { called = true; cb(performance.now()); } }, 80);
  }

  function resize(width: number, height: number): void {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let dock = { x: 80, y: 0 };
  let sceneAlpha = 0; // the dock and robot fade in at the start and out at the end
  let charging = false;

  function drawDock(now: number): void {
    ctx.save();
    ctx.translate(dock.x, dock.y);
    ctx.fillStyle = "#2b2d34"; ctx.strokeStyle = "#454852"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-52, -44, 104, 88, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8a8f9c";                       // charging contacts
    ctx.fillRect(-18, 34, 12, 4); ctx.fillRect(6, 34, 12, 4);
    const glow = charging ? 0.55 + 0.45 * Math.sin(now / 160) : 0.25; // status LED
    ctx.fillStyle = `rgba(62,207,142,${glow})`;
    ctx.beginPath(); ctx.arc(38, -32, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function fade(to: number, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const from = sceneAlpha;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        sceneAlpha = from + (to - from) * k;
        if (k < 1) nextFrame(step); else resolve();
      };
      nextFrame(step);
    });
  }

  function drawRobot(now: number): void {
    const state = { time: now, accent };
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.angle);
    skin.drawBody(ctx, state);
    ctx.restore();
    if (skin.drawOverlay) {
      ctx.save();
      ctx.translate(robot.x, robot.y);
      skin.drawOverlay(ctx, state);
      ctx.restore();
    }
  }

  function frame(now: number): void {
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ambient?.draw(ctx, now);

    ctx.save(); ctx.globalAlpha = sceneAlpha; drawDock(now); ctx.restore();

    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      const age = (now - p.born) / 600;
      if (age >= 1) { dust.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(220,220,230,${0.5 * (1 - age)})`;
      ctx.beginPath(); ctx.arc(p.x + p.vx * age * 20, p.y + p.vy * age * 20, 3 * (1 - age) + 1, 0, Math.PI * 2); ctx.fill();
    }

    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      const age = (now - c.born) / 1000;
      if (age >= 1) { confetti.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.translate(c.x + c.vx * age, c.y + c.vy * age + 220 * age * age);
      ctx.rotate(c.spin * age);
      ctx.fillStyle = c.color;
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }

    for (let i = eating.length - 1; i >= 0; i--) {
      const e = eating[i];
      const k = (now - e.born) / 420;
      if (k >= 1) { eating.splice(i, 1); continue; }
      skin.drawEaten(ctx, e.label, e.x + (robot.x - e.x) * k, e.y + (robot.y - e.y) * k, k);
    }

    ctx.save(); ctx.globalAlpha = sceneAlpha; drawRobot(now); ctx.restore();

    if (bubble && now < bubble.until) {
      ctx.font = "bold 14px Segoe UI, sans-serif";
      const w = ctx.measureText(bubble.text).width + 16;
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#999"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(robot.x - w / 2, robot.y - 66, w, 24, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#222"; ctx.textAlign = "center";
      ctx.fillText(bubble.text, robot.x, robot.y - 49);
    }
    nextFrame(frame);
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
        if (k < 1) nextFrame(step); else resolve();
      };
      nextFrame(step);
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
    // Short hops between neighbouring icons keep the set speed; long legs (to and from the dock)
    // cruise up to twice as fast so the user is not left waiting for the robot to cross the screen.
    const cruise = SPEED * Math.min(2, 1 + dist / 1200);
    const dur = Math.max(400, (dist / cruise) * 1000 * (1 + ramp / 2));
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
        if (k < 1) nextFrame(step); else resolve();
      };
      nextFrame(step);
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
    console.log(`start received, visibility=${document.visibilityState}`);
    SPEED = data.speed;
    accent = data.color;
    skin = DeskSkins.get(data.skin);
    ambient = skin.createAmbient?.(data.width, data.height);
    resize(data.width, data.height);
    dock = data.dock;
    robot.x = dock.x;
    robot.y = dock.y;
    robot.angle = -Math.PI / 2; // parked facing up
    sceneAlpha = 0;
    nextFrame(frame);

    // The robot is visible from the first moment: the dock fades in with it on top, "wakes up"
    // for a beat, then rolls out.
    await fade(1, 350);
    charging = true;
    await sleep(550);
    charging = false;

    for (const item of order(data.items, robot)) {
      await moveTo(item.x, item.y);
      // Sweep the moment the robot is on top of the icon, then pause only briefly.
      const result = await window.deskSweep.sweep(item.id);
      const at = performance.now();
      bubble = { text: result.ok ? (data.dry ? data.bubbles.dryEat : data.bubbles.eat) : data.bubbles.oops, until: at + 700 };
      console.log(`bubble: ${bubble.text}`);
      if (result.ok) {
        eating.push({ label: item.name, x: item.x, y: item.y + 30, born: at });
        if (skin.confetti) burstConfetti(item.x, item.y, skin.confetti, at);
      }
      await sleep(250);
    }

    bubble = { text: data.dry ? data.bubbles.dryDone : data.bubbles.done, until: performance.now() + 1800 };
    console.log(`bubble: ${bubble.text}`);
    await moveTo(dock.x, dock.y); // back home: the message stays up while it drives
    charging = true;
    await sleep(700);
    await fade(0, 400);
    window.deskSweep.finish();
  });
})();
