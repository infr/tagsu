import { SPACE } from "./font";
import type { Cgram } from "./types";

/*
 * Two-row letters drawn with custom characters. The firmware only loads a screen's logo into codes
 * 0 1 2 4 5 6, so each big-text screen gets a logo made of exactly the shapes its letters use.
 */
const SHAPES: Record<string, number[]> = {
  "#": [31, 31, 31, 31, 31, 31, 31, 31],
  u: [31, 31, 31, 0, 0, 0, 0, 0],
  l: [0, 0, 0, 0, 0, 31, 31, 31],
  e: [31, 31, 31, 0, 0, 0, 31, 31],
  E: [31, 0, 0, 0, 0, 31, 31, 31],
  "\\": [24, 28, 12, 14, 6, 7, 3, 3],
  "/": [3, 7, 6, 14, 12, 28, 24, 24],
};
const SHAPE_ORDER = Object.keys(SHAPES);
const SLOTS = [0, 1, 2, 4, 5, 6];
const FALLBACK: Record<string, string> = { E: "l", e: "u", "\\": "#", "/": "#" };

const FONT: Record<string, [string, string]> = {
  A: ["#e#", "#.#"], B: ["#e\\", "#E/"], C: ["#uu", "#ll"], D: ["#u\\", "#l/"], E: ["#ee", "#EE"],
  F: ["#ee", "#.."], G: ["#uu", "#l#"], H: ["#l#", "#.#"], I: ["u#u", "l#l"], J: ["..#", "ll#"],
  K: ["#/", "#\\"], L: ["#..", "#ll"], M: ["#\\/#", "#..#"], N: ["#\\.#", "#.\\#"], O: ["#u#", "#l#"],
  P: ["#e#", "#.."], Q: ["#u#.", "#l#\\"], R: ["#e#", "#.\\"], S: ["#ee", "ll#"], T: ["u#u", ".#."],
  U: ["#.#", "#l#"], V: ["\\../", ".\\/."], W: ["#..#", "#/\\#"], X: ["\\/", "/\\"], Y: ["\\./", ".#."],
  Z: ["u/", "/l"], Ä: ["#e#", "#.#"], Ö: ["#u#", "#l#"], Å: ["#e#", "#.#"],
  "0": ["#u#", "#l#"], "1": ["u#.", "l#l"], "2": ["ee#", "#ll"], "3": ["ue#", "ll#"], "4": ["#l#", "..#"],
  "5": ["#ee", "ll#"], "6": ["#ee", "#l#"], "7": ["uu#", "..#"], "8": ["#e#", "#E#"], "9": ["#e#", "ll#"],
  " ": [".", "."], "!": ["#", "l"], "?": ["ue#", ".l."], ".": [".", "l"], "-": ["ll", ".."], ":": ["l", "l"],
};

const bigChar = (ch: string) => FONT[ch.toUpperCase()] ?? FONT["?"];

/** Shape rows for a text: letters side by side with one empty column between them. */
function lines(text: string): [string, string] {
  let top = "";
  let bottom = "";
  [...text].forEach((ch, k) => {
    const [t, b] = bigChar(ch);
    const gap = k ? "." : "";
    top += gap + t;
    bottom += gap + b;
  });
  return [top, bottom];
}

export const bigWidth = (text: string) => lines(text)[0].length;

/** Splits text into chunks that each fit on the screen; words stay apart and long words split evenly. */
export function bigParts(text: string): { text: string; start: number }[] {
  const parts: { text: string; start: number }[] = [];
  let cur: { text: string; start: number } | null = null;
  let pos = 0;
  for (const token of text.split(/( +)/)) {
    const chars = [...token];
    if (token && !token.startsWith(" ")) {
      if (cur && bigWidth(`${cur.text} ${token}`) <= 16) {
        cur.text += " " + token;
      } else if (bigWidth(token) <= 16) {
        if (cur) parts.push(cur);
        cur = { text: token, start: pos };
      } else {
        if (cur) parts.push(cur);
        cur = null;
        let n = 2;
        while (Math.ceil(chars.length / n) > 1 && bigWidth(chars.slice(0, Math.ceil(chars.length / n)).join("")) > 16) n++;
        const size = Math.ceil(chars.length / n);
        for (let k = 0; k < chars.length; k += size) parts.push({ text: chars.slice(k, k + size).join(""), start: pos + k });
      }
    }
    pos += chars.length;
  }
  if (cur) parts.push(cur);
  return parts.length ? parts : [{ text: "", start: 0 }];
}

/** Column where each character starts, plus the total width as the last entry. */
export function bigStarts(text: string): number[] {
  const starts = [0];
  for (const ch of text) starts.push(starts[starts.length - 1] + bigChar(ch)[0].length + 1);
  starts[starts.length - 1] = Math.max(0, starts[starts.length - 1] - 1);
  return starts;
}

/** The custom shapes a text needs, at most 6 (rare overflows fall back to similar shapes). */
function bigShapes(text: string): { shapes: string[]; subst: Record<string, string> } {
  const used = lines(text).join("");
  let shapes = SHAPE_ORDER.filter((s) => used.includes(s));
  const subst: Record<string, string> = {};
  for (const s of ["E", "e", "\\", "/"]) {
    if (shapes.length <= SLOTS.length) break;
    if (shapes.includes(s)) {
      subst[s] = FALLBACK[s];
      shapes = shapes.filter((x) => x !== s && x !== FALLBACK[s]).concat(FALLBACK[s]);
    }
  }
  return { shapes: SHAPE_ORDER.filter((s) => shapes.includes(s)), subst };
}

/** Columns 0-15 of both rows; starts at `offset`, everything outside is a space. */
export function bigCodes(text: string, offset: number): number[] {
  const { shapes, subst } = bigShapes(text);
  const code = (c: string) => (c === "." ? SPACE : SLOTS[shapes.indexOf(subst[c] ?? c)]);
  return lines(text).flatMap((line) => {
    const row = Array(16).fill(SPACE);
    [...line].forEach((c, k) => {
      if (offset + k >= 0 && offset + k < 16) row[offset + k] = code(c);
    });
    return row;
  });
}

/** The 15x16 logo holding a text's shapes in the cells the firmware maps to codes 0 1 2 / 4 5 6. */
export function bigLogoRows(text: string): string[] {
  const { shapes } = bigShapes(text);
  const cells = SLOTS.map((_, k) => SHAPES[shapes[k]] ?? Array(8).fill(0));
  return Array.from({ length: 16 }, (_, y) =>
    [0, 1, 2].map((c) => cells[(y < 8 ? 0 : 3) + c][y % 8].toString(2).padStart(5, "0")).join(""),
  );
}

export function bigCgram(text: string): Cgram {
  const { shapes } = bigShapes(text);
  const cg: Cgram = {};
  shapes.forEach((s, k) => (cg[SLOTS[k]] = SHAPES[s]));
  return cg;
}
