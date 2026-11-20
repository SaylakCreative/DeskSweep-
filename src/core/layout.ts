import type { Entry, IconGrid } from "./types";

export interface Point {
  x: number;
  y: number;
}

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Picks where the robot's charging dock goes: the bottom-left corner of the usable area unless an
 * icon is closer there than at another spot (bottom-right, bottom-centre, top-right), so the dock
 * does not hide icons while the robot works.
 */
export function pickDockSpot(area: Area, obstacles: Point[]): Point {
  const margin = 80;
  const lift = 70;
  const bottom = area.y + area.height - lift;
  const candidates: Point[] = [
    { x: area.x + margin, y: bottom },
    { x: area.x + area.width - margin, y: bottom },
    { x: area.x + area.width / 2, y: bottom },
    { x: area.x + area.width - margin, y: area.y + lift }
  ];

  let best = candidates[0];
  let bestClearance = -1;
  for (const c of candidates) {
    const clearance = obstacles.length ? Math.min(...obstacles.map((o) => Math.hypot(o.x - c.x, o.y - c.y))) : Infinity;
    if (clearance > bestClearance) { best = c; bestClearance = clearance; }
  }
  return best;
}

/**
 * Estimates where Explorer draws each desktop icon (default "sort by name",
 * column-major, folders first). It is an approximation: a native helper that
 * reads real icon positions can replace it later (see ROADMAP in README).
 */
export function estimateIconPositions(entries: Entry[], grid: IconGrid, screenHeight: number): Map<string, Point> {
  const sorted = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  });

  const rows = Math.max(1, Math.floor((screenHeight - grid.margin * 2) / grid.cellHeight));
  const result = new Map<string, Point>();
  sorted.forEach((entry, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    result.set(entry.name, {
      x: grid.margin + col * grid.cellWidth + grid.cellWidth / 2,
      y: grid.margin + row * grid.cellHeight + grid.cellHeight / 2
    });
  });
  return result;
}
