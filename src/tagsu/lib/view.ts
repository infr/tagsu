import { bigParts, bigStarts } from "./bigfont";
import { alignOffset, bigOffset, screenCgram, screenCodes, textColumn, textWidth } from "./layout";
import type { Cgram, Logo, Screen } from "./types";

export type Caret = { row: 0 | 1; pos: number };
export type LcdView = { codes: number[]; cgram: Cgram; cursor: number | null; tall: boolean };

/** Big text wider than the screen scrolls by in parts; the LCD shows the part the caret is in. */
function shownPart(screen: Screen, caretPos: number) {
  if (!screen.big) return { shown: screen, start: 0 };
  const parts = bigParts(screen.r1);
  const part = parts.filter((p) => p.start <= caretPos).pop() ?? parts[0];
  return { shown: { ...screen, r1: part.text }, start: part.start };
}

function rowStart(screen: Screen, logos: Logo[], row: 0 | 1) {
  const width = textWidth(screen, logos);
  const text = row === 0 ? screen.r1 : screen.r2;
  const len = Math.min([...text].length, width);
  return { len, width, start: textColumn(screen, logos) + alignOffset(len, row === 0 ? screen.a1 : screen.a2, width) };
}

/** What the LCD shows while a screen is edited: its characters and the cell with the caret. */
export function lcdView(screen: Screen, logos: Logo[], caret: Caret | null): LcdView {
  const { shown, start } = shownPart(screen, caret?.pos ?? 0);
  let cursor: number | null = null;
  if (caret && screen.big) {
    const starts = bigStarts(shown.r1);
    const local = Math.max(0, caret.pos - start);
    const col = bigOffset(shown) + (local < starts.length - 1 ? starts[local] : starts[starts.length - 1] + (local ? 1 : 0));
    cursor = 16 + Math.min(col, 15);
  } else if (caret) {
    const { start: col, width } = rowStart(screen, logos, caret.row);
    cursor = caret.row * 16 + col + Math.min(caret.pos, width - 1);
  }
  return { codes: screenCodes(shown, logos), cgram: screenCgram(shown, logos), cursor, tall: screen.tall };
}

/** The caret position for a click on LCD column `col` of `row` (big text: within the part on show). */
export function caretAt(screen: Screen, logos: Logo[], row: 0 | 1, col: number, currentPos = 0): number {
  if (screen.big) {
    const { shown, start } = shownPart(screen, currentPos);
    const starts = bigStarts(shown.r1);
    const c = col - bigOffset(shown);
    return start + (c < 0 ? 0 : starts.slice(0, -1).filter((s) => s <= c).length);
  }
  const { len, start } = rowStart(screen, logos, row);
  return Math.max(0, Math.min(len, col - start));
}
