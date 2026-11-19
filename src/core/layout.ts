import type { Entry, IconGrid } from "./types";

export interface Point {
  x: number;
  y: number;
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
