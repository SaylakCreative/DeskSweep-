import { t } from "./i18n";
import type { Language, SkinPreference } from "./types";

/** Concrete skins that have drawing code in src/shared/skins.ts. */
export type SkinId = "classic" | "winter";

export const SKIN_PREFERENCES: SkinPreference[] = ["auto", "classic", "winter"];

/** The moments the robot says something in its speech bubble. */
export const BUBBLE_KINDS = ["eat", "dryEat", "oops", "done", "dryDone"] as const;
export type BubbleKind = (typeof BUBBLE_KINDS)[number];
export type BubbleTexts = Record<BubbleKind, string>;

/** What the robot says, in the app's language and in the voice of the skin (i18n keys "bubble.<skin>.<kind>"). */
export function bubbleTexts(language: Language, skin: SkinId): BubbleTexts {
  return Object.fromEntries(BUBBLE_KINDS.map((kind) => [kind, t(language, `bubble.${skin}.${kind}`)])) as BubbleTexts;
}

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
