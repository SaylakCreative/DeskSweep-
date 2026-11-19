import * as path from "node:path";
import type { Entry, Rule } from "./types";

/** Converts a simple glob (* and ?) into a case-insensitive RegExp. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export function isProtected(name: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegExp(p).test(name));
}

export function classify(entry: Entry, rules: Rule[]): Rule | undefined {
  const ext = path.extname(entry.name).slice(1).toLowerCase();

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const byExt = rule.extensions?.includes(ext) ?? false;
    const byName = rule.namePattern ? new RegExp(rule.namePattern, "i").test(entry.name) : false;
    if (byExt || byName) return rule;
  }
  return undefined;
}
