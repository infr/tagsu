import { SPACE } from "./font";

/** Effect codes understood by the badge firmware (bit 7 = blink, added separately). */
export const EFFECTS: { code: number; in: string; out: string; animation?: boolean }[] = [
  { code: 0, in: "No effect", out: "No effect" },
  { code: 1, in: "Random write", out: "Random clear" },
  { code: 2, in: "Wall from left", out: "Wall from left" },
  { code: 3, in: "Wall from right", out: "Wall from right" },
  { code: 4, in: "Scroll from left", out: "Scroll to left" },
  { code: 5, in: "Scroll from right", out: "Scroll to right" },
  { code: 6, in: "Curtains in", out: "Curtains in" },
  { code: 7, in: "Curtains out", out: "Curtains out" },
  { code: 8, in: "Invaders", out: "Invaders", animation: true },
  { code: 16, in: "Flying rockets", out: "Flying rockets", animation: true },
  { code: 32, in: "Pac", out: "Pac", animation: true },
  { code: 33, in: "Boulder", out: "Boulder", animation: true },
  { code: 34, in: "Miner", out: "Miner", animation: true },
  { code: 35, in: "Archer", out: "Archer", animation: true },
  { code: 36, in: "Aeroplane", out: "Aeroplane", animation: true },
];

/** Sprite animations overwrite the custom characters, so they can't run on logo or big-text screens. */
export const isAnimation = (code: number) => EFFECTS.some((e) => e.code === (code & 0x7f) && e.animation);
export const SCROLL_FROM_RIGHT = 5;
export const SCROLL_TO_LEFT = 4;

export const effectName = (code: number, out: boolean) => {
  const e = EFFECTS.find((x) => x.code === code);
  return e ? (out ? e.out : e.in) : "?";
};

export const BLANK_CODES: number[] = Array(32).fill(SPACE);
