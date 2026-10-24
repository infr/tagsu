import { bigLogoRows } from "./bigfont";
import { hasLogo, screenCodes } from "./layout";
import { MAX_LOGOS, type Logo, type Screen } from "./types";

/*
 * Badge user data (entry byte 0 bit 7 = double height), 2064 bytes (reverse engineered from firmware v1.12):
 *   0x000  16-byte header, left erased (FF)
 *   0x010  42 screens x 32 characters (row 1, row 2)
 *   0x550  6-byte entries [text#, delay s, in effect, out effect, logo#, logo kind]; FF ends the list
 *   0x6D0  10 custom logos x 32 bytes: 16 rows, 16-bit little-endian, 15 pixels per row
 * Logo kind: 0x40 = built-in, 0x80 = custom. Effects use bit 7 for blink.
 */
const IMAGE_SIZE = 2064;
const TEXT_BASE = 0x10;
const ENTRY_BASE = 0x550;
const LOGO_BASE = 0x6d0;
const LOGO_BUILTIN = 0x40;
const LOGO_CUSTOM = 0x80;

/** Big-text screens share custom logo slots after the user's logos; ids that found no slot are in `overflow`. */
export function bigTextSlots(screens: Screen[], logos: Logo[]) {
  const extra: string[][] = [];
  const slot = new Map<string, number>();
  const overflow = new Set<string>();
  for (const s of screens) {
    if (!s.big) continue;
    const rows = bigLogoRows(s.r1);
    let k = extra.findIndex((r) => r.join() === rows.join());
    if (k < 0 && logos.length + extra.length < MAX_LOGOS) k = extra.push(rows) - 1;
    if (k < 0) overflow.add(s.id);
    else slot.set(s.id, logos.length + k);
  }
  return { extra, slot, overflow };
}

export function buildImage(screens: Screen[], logos: Logo[]): Uint8Array {
  const img = new Uint8Array(IMAGE_SIZE).fill(0xff);
  const big = bigTextSlots(screens, logos);
  [...logos.map((l) => l.rows), ...big.extra].forEach((rows, k) =>
    rows.forEach((row, r) => {
      const v = parseInt(row, 2);
      img[LOGO_BASE + 32 * k + 2 * r] = v & 0xff;
      img[LOGO_BASE + 32 * k + 2 * r + 1] = v >> 8;
    }),
  );
  screens.forEach((s, i) => {
    let index = 0;
    let kind = 0;
    if (s.big && big.slot.has(s.id)) {
      index = big.slot.get(s.id)!;
      kind = LOGO_CUSTOM;
    } else if (hasLogo(s, logos)) {
      if (s.logo[0] === "b") {
        index = Number(s.logo.slice(1));
        kind = LOGO_BUILTIN;
      } else {
        index = logos.findIndex((l) => "c" + l.id === s.logo);
        kind = LOGO_CUSTOM;
      }
    }
    img.set(screenCodes(s, logos), TEXT_BASE + 32 * i);
    img.set(
      [i | (s.tall ? 0x80 : 0), s.delay, s.inFx | (s.inBlink ? 0x80 : 0), s.outFx | (s.outBlink ? 0x80 : 0), index, kind],
      ENTRY_BASE + 6 * i,
    );
  });
  return img;
}
