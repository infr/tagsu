"use client";

import { useEffect, useMemo } from "react";
import { Icon } from "./icons";
import { LcdEditor, lcdInputId } from "./LcdEditor";
import styles from "./ScreenList.module.css";
import { ScreenOptions, ScreenSummary } from "./ScreenOptions";
import type { EditorState } from "../hooks/useEditorState";
import { expandScreens } from "../lib/expand";
import { bigTextSlots } from "../lib/image";
import { MAX_SCREENS } from "../lib/types";
import type { Caret } from "../lib/view";

type Props = {
  state: EditorState;
  focusId: string | null;
  onFocused: () => void;
  onAdd: (at?: number) => void;
  onNewLogoFor: (i: number, rows?: string[]) => void;
  /** Caret of the screen being edited, so the badge can show it. */
  onCaret: (caret: Caret | null) => void;
};

export const LIST_PREFIX = "s";

/**
 * One row per screen: the LCD you type on and, beside it, a fixed-height area with the options of the
 * screen being edited or a summary of the others. Switching screens never moves anything.
 */
export function ScreenList({ state, focusId, onFocused, onAdd, onNewLogoFor, onCaret }: Props) {
  const { screens, logos, active } = state;
  const noSlot = useMemo(() => {
    const badge = expandScreens(screens);
    const { overflow } = bigTextSlots(badge, logos);
    return new Set(badge.filter((b) => overflow.has(b.id)).map((b) => b.source));
  }, [screens, logos]);

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId)?.focus();
    onFocused();
  }, [focusId, onFocused]);

  const focusRow = (i: number, row: "r1" | "r2") => {
    const el = document.getElementById(lcdInputId(LIST_PREFIX, screens[i].id, row)) as HTMLInputElement | null;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  };

  return (
    <div className={styles.wrap}>
      <ol className={styles.list}>
        {screens.map((s, i) => {
          const isActive = i === active;
          return (
            <li key={s.id} className={`${styles.row} ${isActive ? styles.active : ""}`} onPointerDown={() => !isActive && state.setActive(i)}>
              <span className={styles.idx}>{String(i + 1).padStart(2, "0")}</span>
            <div className={styles.module}>
              <LcdEditor
                screen={s}
                logos={logos}
                idPrefix={LIST_PREFIX}
                label={`Screen ${i + 1}`}
                onChange={(patch) => state.updateScreen(i, patch)}
                onFocus={() => i !== active && state.setActive(i)}
                onCaret={i === active ? onCaret : undefined}
                onNavigate={(dir, add) => {
                  const j = i + dir;
                  if (j >= 0 && j < screens.length) focusRow(j, dir < 0 ? "r2" : "r1");
                  else if (add) onAdd(i + 1);
                }}
                onKey={(e, row) => {
                  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                    e.preventDefault();
                    const d = e.key === "ArrowUp" ? -1 : 1;
                    state.moveScreen(i, d);
                    requestAnimationFrame(() => focusRow(Math.max(0, Math.min(screens.length - 1, i + d)), row));
                    return true;
                  }
                  if ((e.metaKey || e.ctrlKey) && e.key === "Backspace" && !s.r1 && !s.r2) {
                    e.preventDefault();
                    state.removeScreen(i);
                    return true;
                  }
                  return false;
                }}
              />
            </div>
              {isActive ? <ScreenOptions state={state} i={i} noSlot={noSlot.has(i)} inputId={lcdInputId(LIST_PREFIX, s.id, "r1")} onNewLogoFor={onNewLogoFor} /> : <ScreenSummary s={s} logos={logos} />}
              <div className={styles.actions}>
                {isActive && (
                  <>
                    <button type="button" className="icon-btn" title="Move up (⌥↑)" aria-label={`Move screen ${i + 1} up`} disabled={i === 0} onClick={() => state.moveScreen(i, -1)}><Icon name="up" /></button>
                    <button type="button" className="icon-btn" title="Move down (⌥↓)" aria-label={`Move screen ${i + 1} down`} disabled={i === screens.length - 1} onClick={() => state.moveScreen(i, 1)}><Icon name="down" /></button>
                    <button type="button" className="icon-btn" title="Duplicate" aria-label={`Duplicate screen ${i + 1}`} disabled={screens.length >= MAX_SCREENS} onClick={() => state.duplicateScreen(i)}><Icon name="copy" /></button>
                    <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete screen ${i + 1}`} disabled={screens.length <= 1} onClick={() => state.removeScreen(i)}><Icon name="trash" /></button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className={styles.add} disabled={screens.length >= MAX_SCREENS} onClick={() => onAdd()}>
        <Icon name="plus" /> Add screen <kbd>⌘J</kbd>
      </button>
    </div>
  );
}
