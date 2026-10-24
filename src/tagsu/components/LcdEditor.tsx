"use client";

import { useEffect, useState } from "react";
import { Lcd } from "./Lcd";
import styles from "./LcdEditor.module.css";
import type { Frame } from "../hooks/usePreview";
import { toLcdText } from "../lib/font";
import { textWidth } from "../lib/layout";
import type { Logo, Screen } from "../lib/types";
import { caretAt, lcdView, type Caret } from "../lib/view";

type Row = "r1" | "r2";

type Props = {
  screen: Screen;
  logos: Logo[];
  /** Prefix for the input ids, so the same screen can be edited in two places. */
  idPrefix: string;
  label: string;
  onChange: (patch: Partial<Screen>) => void;
  /** Shown instead of the stored text, e.g. while the preview plays. */
  display?: Frame | null;
  onFocus?: () => void;
  /** Leaving the screen with the arrow keys or Enter (add = Enter on the last row). */
  onNavigate?: (dir: -1 | 1, add: boolean) => void;
  /** Extra shortcuts; return true when handled. */
  onKey?: (e: React.KeyboardEvent<HTMLInputElement>, row: Row) => boolean;
  /** Reports where the caret is (null when the LCD isn't being edited). */
  onCaret?: (caret: Caret | null) => void;
  className?: string;
};

export const lcdInputId = (prefix: string, screenId: string, row: Row) => `${prefix}-${screenId}-${row}`;

/** A 16x2 LCD you type on: two invisible inputs sit over the rows, the LCD draws the text and cursor. */
export function LcdEditor({ screen, logos, idPrefix, label, onChange, display, onFocus, onNavigate, onKey, onCaret, className }: Props) {
  const [caret, setCaret] = useState<Caret | null>(null);
  const width = textWidth(screen, logos);
  const view = lcdView(screen, logos, caret);
  const cursor = display ? null : view.cursor;

  useEffect(() => {
    onCaret?.(caret);
  }, [caret, onCaret]);

  const track = (row: 0 | 1) => (e: React.SyntheticEvent<HTMLInputElement>) => setCaret({ row, pos: e.currentTarget.selectionStart ?? 0 });

  const placeCaret = (row: 0 | 1) => (e: React.MouseEvent<HTMLInputElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) / r.width) * 16);
    const pos = caretAt(screen, logos, row, col, caret?.pos ?? 0);
    e.currentTarget.setSelectionRange(pos, pos);
    setCaret({ row, pos });
  };

  const focusRow = (row: Row) => {
    const el = document.getElementById(lcdInputId(idPrefix, screen.id, row)) as HTMLInputElement | null;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  };

  const onKeyDown = (row: 0 | 1) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key: Row = row === 0 ? "r1" : "r2";
    if (onKey?.(e, key)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (row === 1 && !screen.big && !screen.tall) focusRow("r1");
      else onNavigate?.(-1, false);
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      if (row === 0 && !screen.big && !screen.tall) focusRow("r2");
      else onNavigate?.(1, e.key === "Enter");
    }
  };

  return (
    <div className={`${styles.lcd} ${className ?? ""}`} data-lcd>
      <Lcd
        codes={display?.codes ?? view.codes}
        cgram={display?.cgram ?? view.cgram}
        light={display?.light ?? true}
        tall={display ? display.tall : view.tall}
        cursor={cursor}
        label={label}
      />
      <div className={styles.inputs}>
        {(screen.big || screen.tall ? ([0] as const) : ([0, 1] as const)).map((row) => (
          <input
            key={row}
            id={lcdInputId(idPrefix, screen.id, row === 0 ? "r1" : "r2")}
            value={row === 0 ? screen.r1 : screen.r2}
            maxLength={screen.big ? 64 : width}
            className={screen.big || screen.tall ? styles.tall : undefined}
            spellCheck={false}
            autoComplete="off"
            aria-label={`${label}, row ${row + 1}`}
            onChange={(e) => {
              const value = toLcdText(e.target.value);
              onChange(row === 0 ? { r1: value } : { r2: value });
              setCaret({ row, pos: e.target.selectionStart ?? 0 });
            }}
            onFocus={(e) => {
              setCaret({ row, pos: e.currentTarget.selectionStart ?? 0 });
              onFocus?.();
            }}
            onBlur={() => setCaret(null)}
            onSelect={track(row)}
            onKeyUp={track(row)}
            onMouseUp={placeCaret(row)}
            onKeyDown={onKeyDown(row)}
          />
        ))}
      </div>
    </div>
  );
}
