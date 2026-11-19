import * as path from "node:path";
import type { Point } from "./layout";
import type { Entry } from "./types";

export interface IconText {
  text: string;
  x: number;
  y: number;
}

/** Parses the helper's "text TAB x TAB y" lines, ignoring anything malformed. */
export function parseIconDump(output: string): IconText[] {
  const icons: IconText[] = [];
  for (const line of output.replace(/^﻿/, "").split(/\r?\n/)) {
    const parts = line.split("\t");
    if (parts.length !== 3) continue;
    const x = Number(parts[1]);
    const y = Number(parts[2]);
    if (parts[0] && Number.isFinite(x) && Number.isFinite(y)) icons.push({ text: parts[0], x, y });
  }
  return icons;
}

/**
 * Explorer hides known extensions ("report.pdf" is drawn as "report", shortcuts never show .lnk),
 * so an icon matches a file by its full name or by its name without the extension.
 */
export function matchIcons(entries: Entry[], icons: IconText[]): Map<string, Point> {
  const byText = new Map<string, Point>();
  for (const icon of icons) {
    const key = icon.text.toLowerCase();
    if (!byText.has(key)) byText.set(key, { x: icon.x, y: icon.y });
  }

  const result = new Map<string, Point>();
  for (const entry of entries) {
    const hit = byText.get(entry.name.toLowerCase()) ?? byText.get(path.parse(entry.name).name.toLowerCase());
    if (hit) result.set(entry.name, hit);
  }
  return result;
}
