export type Align = "left" | "center" | "right";
export type LogoPos = "left" | "right";

/** "" = no logo, "b<n>" = built-in logo n, "c<id>" = custom logo with that id. */
export type LogoKey = string;

export type Screen = {
  id: string;
  r1: string;
  r2: string;
  a1: Align;
  a2: Align;
  delay: number;
  inFx: number;
  inBlink: boolean;
  outFx: number;
  outBlink: boolean;
  logo: LogoKey;
  logoPos: LogoPos;
  /** Row 1 drawn two rows tall with custom characters; row 2 and the logo are unused. */
  big: boolean;
  /** Row 1 in the LCD's own double-height mode (entry bit 7, LCD command 0x34); row 2 and the logo are unused. */
  tall: boolean;
};

/** 15x16 pixels; each row is a string of 15 "0"/"1" characters. */
export type Logo = { id: string; rows: string[] };

/** Custom LCD characters (codes 0-7): 8 rows of 5-bit values, bit 4 = leftmost pixel. */
export type Cgram = Record<number, number[]>;

export const MAX_SCREENS = 42;
export const MAX_LOGOS = 10;
export const MAX_DELAY = 255;
