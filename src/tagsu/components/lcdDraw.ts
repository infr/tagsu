import { GLYPHS } from "../lib/font";
import type { Cgram } from "../lib/types";

// Geometry in dot pitches: 16x2 cells of 5x8 dots, 1 pitch between cells, 2 between rows.
const PAD = 1.8;
const COLS = 16;
export const LCD_RATIO = (PAD * 2 + COLS * 5 + (COLS - 1)) / (PAD * 2 + 2 * 8 + 2);

const COLORS = {
  glassTop: "#3a58ff",
  glassBottom: "#1b34de",
  darkTop: "#111a5c",
  darkBottom: "#0a1145",
  cell: "rgba(255,255,255,0.045)",
  off: "rgba(190,205,255,0.10)",
  on: "#eef3ff",
  glow: "rgba(205,220,255,0.85)",
  onDim: "rgba(200,210,255,0.28)",
};

/** `tall`: row 1 in the LCD's double-height mode, spread over both rows. */
export type LcdPicture = { codes: number[]; cgram?: Cgram; light?: boolean; cursor?: number | null; tall?: boolean };

type DrawOptions = { sheen?: boolean };

/** Draws the 16x2 LCD (glass, dots, glow) into a w x h area of a 2D context. */
export function drawLcd(ctx: CanvasRenderingContext2D, w: number, h: number, { codes, cgram = {}, light = true, cursor = null, tall = false }: LcdPicture, { sheen = true }: DrawOptions = {}) {
  const p = h / (PAD * 2 + 18);
  const glass = ctx.createLinearGradient(0, 0, 0, h);
  glass.addColorStop(0, light ? COLORS.glassTop : COLORS.darkTop);
  glass.addColorStop(1, light ? COLORS.glassBottom : COLORS.darkBottom);
  ctx.fillStyle = glass;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 32; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const code = (tall ? codes[col] : codes[i]) ?? 0x20;
    const x0 = (PAD + col * 6) * p;
    const y0 = (PAD + row * 10) * p;
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.cell;
    ctx.fillRect(x0 - p * 0.1, y0 - p * 0.1, p * 5.1, p * 8.1);
    const glyph = cgram[code] ?? (code < 8 ? [] : GLYPHS[code] ?? GLYPHS[0x3f]);
    const showCursor = tall ? cursor === col && row === 1 : cursor === i;
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 8; r++) {
        let lit = ((glyph[tall ? Math.floor((row * 8 + r) / 2) : r] ?? 0) >> (4 - c)) & 1;
        if (showCursor && r === 7) lit = 1;
        if (lit) {
          ctx.shadowBlur = light ? p * 0.9 : 0;
          ctx.shadowColor = COLORS.glow;
          ctx.fillStyle = light ? COLORS.on : COLORS.onDim;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = COLORS.off;
        }
        ctx.fillRect(x0 + c * p, y0 + r * p, p * 0.84, p * 0.84);
      }
    }
  }
  ctx.shadowBlur = 0;
  if (!sheen) return;
  const gloss = ctx.createLinearGradient(0, 0, w, h);
  gloss.addColorStop(0, "rgba(255,255,255,0.08)");
  gloss.addColorStop(0.45, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, w, h);
}

/** The LCD cell under a point of the picture, given as fractions of its width and height from the top-left. */
export function cellAt(fx: number, fy: number): { row: 0 | 1; col: number } {
  const x = fx * (PAD * 2 + COLS * 5 + (COLS - 1)) - PAD;
  const y = fy * (PAD * 2 + 18) - PAD;
  return { row: y < 9 ? 0 : 1, col: Math.max(0, Math.min(15, Math.floor(x / 6))) };
}
