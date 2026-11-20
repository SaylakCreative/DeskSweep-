import type { SkinPreference } from "./types";

/** Concrete skins that have drawing code in src/shared/skins.ts. */
export type SkinId = "classic" | "winter";

export const SKIN_PREFERENCES: SkinPreference[] = ["auto", "classic", "winter"];

/** Winter skin season: 15 December to 5 January, inclusive. */
export function isWinterSeason(date: Date): boolean {
  const month = date.getMonth(); // 0 = January
  const day = date.getDate();
  return (month === 11 && day >= 15) || (month === 0 && day <= 5);
}

/** Turns the user's choice into the skin that is actually drawn today. */
export function resolveSkin(preference: SkinPreference, date: Date = new Date()): SkinId {
  if (preference === "auto") return isWinterSeason(date) ? "winter" : "classic";
  return preference;
}
