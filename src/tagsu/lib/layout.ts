import { bigCgram, bigCodes, bigWidth } from "./bigfont";
import { lcdCode, SPACE, toLcdText } from "./font";
import { cgramFor, LOGO_BOTTOM, LOGO_TOP, logoRows } from "./logos";
import type { Align, Cgram, Logo, Screen } from "./types";

export const hasLogo = (s: Screen, logos: Logo[]) => !s.big && !s.tall && logoRows(s.logo, logos) !== null;
export const textWidth = (s: Screen, logos: Logo[]) => (hasLogo(s, logos) ? 13 : 16);

/** Left padding a row gets from its alignment, for mapping a caret to an LCD column. */
export function alignOffset(length: number, align: Align, width: number): number {
  const pad = width - Math.min(length, width);
  return align === "center" ? Math.floor(pad / 2) : align === "right" ? pad : 0;
}

function rowCodes(text: string, align: Align, width: number): number[] {
  const codes = [...toLcdText(text)].slice(0, width).map(lcdCode);
  const left = alignOffset(codes.length, align, width);
  return [...Array(left).fill(SPACE), ...codes, ...Array(width - codes.length - left).fill(SPACE)];
}

export const bigOffset = (s: Screen) => alignOffset(bigWidth(s.r1), s.a1, 16);

/** The 32 character codes the badge stores for a screen (row 1 then row 2). */
export function screenCodes(s: Screen, logos: Logo[]): number[] {
  if (s.big) return bigCodes(s.r1, bigOffset(s));
  if (s.tall) return [...rowCodes(s.r1, s.a1, 16), ...Array(16).fill(SPACE)];
  if (!hasLogo(s, logos)) return [...rowCodes(s.r1, s.a1, 16), ...rowCodes(s.r2, s.a2, 16)];
  const r1 = rowCodes(s.r1, s.a1, 13);
  const r2 = rowCodes(s.r2, s.a2, 13);
  return s.logoPos === "left" ? [...LOGO_TOP, ...r1, ...LOGO_BOTTOM, ...r2] : [...r1, ...LOGO_TOP, ...r2, ...LOGO_BOTTOM];
}

export function screenCgram(s: Screen, logos: Logo[]): Cgram {
  if (s.big) return bigCgram(s.r1);
  const rows = logoRows(s.logo, logos);
  return rows ? cgramFor(rows) : {};
}

/** First LCD column of a screen's text area (3 when the logo sits on the left). */
export const textColumn = (s: Screen, logos: Logo[]) => (hasLogo(s, logos) && s.logoPos === "left" ? 3 : 0);
