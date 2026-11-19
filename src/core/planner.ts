import * as path from "node:path";
import { classify, isProtected } from "./classifier";
import type { Config, Entry, PlanItem, Rule } from "./types";

const DAY_MS = 86_400_000;
const FOLDER_RULE: Rule = { name: "Folders", category: "Folders" };

/** Category names come from a user editable config: never let them escape the backup folder. */
export function sanitizeSegment(segment: string): string {
  const cleaned = segment.replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+$/, "_").trim();
  return cleaned || "_";
}

export function resolveDestination(config: Config, desktopDir: string): string {
  return config.destinationDir ? path.resolve(config.destinationDir) : path.join(desktopDir, "DeskSweep");
}

function uniqueTarget(dir: string, name: string, taken: Set<string>, exists: (p: string) => boolean): string {
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let candidate = path.join(dir, name);
  let n = 1;
  while (taken.has(candidate.toLowerCase()) || exists(candidate)) {
    candidate = path.join(dir, `${stem} (${n})${ext}`);
    n++;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Pure planning step: decides what would move where. Touches nothing on disk,
 * which is what makes dry-run mode and testing trivial.
 */
export function buildPlan(
  entries: Entry[],
  desktopDir: string,
  config: Config,
  now: number,
  exists: (p: string) => boolean
): PlanItem[] {
  const destRoot = resolveDestination(config, desktopDir);
  const destLower = destRoot.toLowerCase();
  const taken = new Set<string>();
  const plan: PlanItem[] = [];

  for (const entry of entries) {
    if (isProtected(entry.name, config.protectedPatterns)) continue;
    if (config.minAgeDays > 0 && now - entry.mtimeMs < config.minAgeDays * DAY_MS) continue;

    const from = path.join(desktopDir, entry.name);
    let rule: Rule | undefined;
    if (entry.isDirectory) {
      if (!config.sweepFolders) continue;
      // Never move the backup folder itself, or a folder that contains it.
      const f = from.toLowerCase();
      if (destLower === f || destLower.startsWith(f + path.sep)) continue;
      rule = FOLDER_RULE;
    } else {
      rule = classify(entry, config.rules);
    }
    if (!rule) continue;

    const category = sanitizeSegment(rule.category);
    const to = uniqueTarget(path.join(destRoot, category), entry.name, taken, exists);
    plan.push({ id: plan.length, name: entry.name, from, to, category, ruleName: rule.name });
  }
  return plan;
}
