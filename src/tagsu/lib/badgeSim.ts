import { SPACE } from "./font";
import { ROCKET, SPRITES } from "./sprites";
import type { Cgram } from "./types";

/*
 * The badge's screen effects, re-implemented from the firmware (v1.19 disassembly) on a model of the LCD:
 * 40 DDRAM cells per row of which 16 are visible through a shiftable window, and 8 custom characters.
 * Sprite effects load 15x16 bitmaps (the firmware's, in sprites.ts) into the custom characters,
 * shifted a pixel at a time; Invaders and Scroll move the whole display window.
 */

export type SimFrame = { codes: number[]; cgram: Cgram; light: boolean; ms: number };

/** "Animate speed" (EEPROM setting); 2 matches the timing filmed on a v1.12 badge. */
const SPEED = 2;
/** The watchdog sleeps the firmware uses: 16 ms << n. */
const sleep = (n: number) => 16 << n;
const SUBSTEP_MS = SPEED * sleep(0) + 3;
const INVADER_STEP_MS = SPEED * (sleep(2) + sleep(1)) + 8;
const BLINKS = 3;

/** Custom characters 0-3 (top) and 4-7 (bottom) from a bitmap moved `shift` pixels right and rolled `roll` rows. */
function spriteCgram(rows: number[], shift: number, roll: number): Cgram {
  const cg: Cgram = {};
  for (let ch = 0; ch < 8; ch++) {
    cg[ch] = Array.from({ length: 8 }, (_, r) => {
      const word = rows[(r + (ch > 3 ? 8 : 0) + roll) & 15];
      return ((word << (5 - shift)) >>> ((3 - (ch & 3)) * 5)) & 31;
    });
  }
  return cg;
}

class Lcd {
  dd = [Array(40).fill(SPACE), Array(40).fill(SPACE)];
  shift = 0;
  addr = 0;
  cgram: Cgram;
  frames: SimFrame[] = [];

  constructor(cgram: Cgram) {
    this.cgram = { ...cgram };
  }

  clear() {
    this.dd = [Array(40).fill(SPACE), Array(40).fill(SPACE)];
    this.shift = 0;
  }

  /** DDRAM address like the controller: row 1 is 0x00-0x27, row 2 0x40-0x67, and writing wraps between them. */
  cursor(col: number, row: number) {
    this.addr = (row ? 0x40 : 0) + (((col % 40) + 40) % 40);
  }

  put(code: number) {
    const row = this.addr >= 0x40 ? 1 : 0;
    this.dd[row][this.addr & 0x3f] = code;
    this.addr = this.addr === 0x27 ? 0x40 : this.addr === 0x67 ? 0 : this.addr + 1;
  }

  /** Display shift: left moves the window right over DDRAM, so the content slides left. */
  move(left: boolean) {
    this.shift = (this.shift + (left ? 1 : 39)) % 40;
  }

  show(ms: number, light = true) {
    const codes: number[] = [];
    for (let row = 0; row < 2; row++) for (let col = 0; col < 16; col++) codes.push(this.dd[row][(this.shift + col) % 40]);
    this.frames.push({ codes, cgram: { ...this.cgram }, light, ms });
  }

  plain(buf: number[]) {
    for (let row = 0; row < 2; row++) {
      this.cursor(0, row);
      for (let col = 0; col < 16; col++) this.put(buf[row * 16 + col]);
    }
  }
}

function walls(lcd: Lcd, buf: number[], fromRight: boolean) {
  for (let k = 0; k < 16; k++) {
    const col = fromRight ? 15 - k : k;
    for (let row = 0; row < 2; row++) {
      lcd.cursor(col, row);
      lcd.put(buf[row * 16 + col]);
    }
    lcd.show(sleep(2));
  }
}

function curtains(lcd: Lcd, buf: number[], fromMiddle: boolean) {
  for (let k = 0; k < 8; k++) {
    const col = fromMiddle ? 7 - k : k;
    for (const c of [col, 15 - col]) {
      for (let row = 0; row < 2; row++) {
        lcd.cursor(c, row);
        lcd.put(buf[row * 16 + c]);
      }
    }
    lcd.show(sleep(2));
  }
}

let lfsr = 1;
const perm = Array.from({ length: 16 }, (_, k) => k);

function random(lcd: Lcd, buf: number[]) {
  for (let k = 0; k < 16; k++) {
    lfsr = (lfsr >> 1) | (((lfsr ^ (lfsr >> 1)) & 1) << 3);
    [perm[k], perm[lfsr & 15]] = [perm[lfsr & 15], perm[k]];
  }
  for (let k = 0; k < 16; k++) {
    lcd.cursor(perm[k], 0);
    lcd.put(buf[perm[k]]);
    lcd.show(sleep(1));
    const col = (perm[7] - perm[k]) & 15;
    lcd.cursor(col, 1);
    lcd.put(buf[16 + col]);
    lcd.show(sleep(1));
  }
}

function scrollIn(lcd: Lcd, buf: number[], toRight: boolean) {
  for (let k = 0; k < 16; k++) lcd.move(toRight);
  lcd.plain(buf);
  for (let k = 0; k < 16; k++) {
    lcd.move(!toRight);
    lcd.show(sleep(2));
  }
}

function scrollOut(lcd: Lcd, toRight: boolean) {
  for (let k = 0; k < 22; k++) {
    lcd.move(!toRight);
    lcd.show(sleep(2));
  }
  lcd.clear();
}

function invaders(lcd: Lcd, buf: number[], isIn: boolean) {
  if (isIn) {
    for (let k = 0; k < 24; k++) lcd.move(true);
    lcd.plain(buf);
  }
  lcd.cursor(0x10, 0);
  for (const c of [1, 2, 1, 2, 1, 2, 1, 2]) lcd.put(c);
  lcd.cursor(0x10, 1);
  for (const c of [5, 6, 5, 6, 5, 6, 5, 6]) lcd.put(c);
  let frame = 0;
  for (let k = 0; k < 24; k++) {
    frame ^= 1;
    lcd.cgram = spriteCgram(SPRITES[frame], 0, 0);
    lcd.show(INVADER_STEP_MS);
    lcd.move(!isIn);
  }
}

/** Pac, Boulder, Miner, Archer, Aeroplane (index 1-5) and the rolling rocket (index 0). */
function sprite(lcd: Lcd, buf: number[], index: number) {
  let frame = 0;
  let roll = 0;
  for (let step = 0; step < 21; step++) {
    const col = step < 5 ? 0x23 + step : step - 5;
    const behind = (row: number) => (step < 5 ? SPACE : buf[row * 16 + step - 5]);
    lcd.cursor(col, 0);
    for (const c of [behind(0), 0, 1, 2, 3]) lcd.put(c);
    lcd.cursor(col, 1);
    for (const c of [behind(1), 4, 5, 6, 7]) lcd.put(c);
    for (let shift = 0; shift < 5; shift++) {
      const rows = index === 0 ? ROCKET : SPRITES[index * 2 + frame];
      lcd.cgram = spriteCgram(rows, shift, index === 0 ? roll++ : 0);
      lcd.show(SUBSTEP_MS);
    }
    frame ^= 1;
  }
}

function effect(lcd: Lcd, code: number, buf: number[], isIn: boolean) {
  const fx = code & 0x7f;
  if (fx === 1) random(lcd, buf);
  else if (fx === 2 || fx === 3) walls(lcd, buf, fx === 3);
  else if (fx === 4 || fx === 5) {
    if (isIn) scrollIn(lcd, buf, fx === 4);
    else scrollOut(lcd, fx === 5);
  } else if (fx === 6 || fx === 7) curtains(lcd, buf, fx === 7);
  else if (fx === 8) invaders(lcd, buf, isIn);
  else if (fx === 16) sprite(lcd, buf, 0);
  else if (fx >= 32 && fx <= 36) sprite(lcd, buf, fx - 31);
  else {
    lcd.plain(buf);
    lcd.show(0);
  }
}

function blink(lcd: Lcd) {
  for (let k = 0; k < BLINKS; k++) {
    lcd.show(sleep(4), false);
    lcd.show(sleep(4), true);
  }
}

export type SimScreen = { codes: number[]; cgram: Cgram; inFx: number; inBlink: boolean; outFx: number; outBlink: boolean; holdMs: number };

/** Everything the badge shows for one screen, frame by frame: in effect, blink, hold, blink, out effect. */
export function simulateScreen(s: SimScreen): SimFrame[] {
  const lcd = new Lcd(s.cgram);
  effect(lcd, s.inFx, s.codes, true);
  if (s.inBlink) blink(lcd);
  lcd.show(s.holdMs);
  if (s.outBlink) blink(lcd);
  effect(lcd, s.outFx, Array(32).fill(SPACE), false);
  return lcd.frames.filter((f) => f.ms > 0 || f === lcd.frames[lcd.frames.length - 1]);
}
