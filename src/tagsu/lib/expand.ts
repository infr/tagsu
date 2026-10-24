import { bigParts } from "./bigfont";
import { SCROLL_FROM_RIGHT, SCROLL_TO_LEFT } from "./effects";
import type { Screen } from "./types";

export type BadgeScreen = Screen & { source: number };

/** The screens as the badge stores them: big text too wide for one screen scrolls by as several. */
export function expandScreens(screens: Screen[]): BadgeScreen[] {
  return screens.flatMap((s, i) => {
    const parts = s.big ? bigParts(s.r1) : [];
    if (parts.length < 2) return [{ ...s, source: i }];
    return parts.map((p, k) => ({
      ...s,
      id: `${s.id}~${k}`,
      r1: p.text,
      inFx: SCROLL_FROM_RIGHT,
      inBlink: false,
      outFx: SCROLL_TO_LEFT,
      outBlink: false,
      source: i,
    }));
  });
}
