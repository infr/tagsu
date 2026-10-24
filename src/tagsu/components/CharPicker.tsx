"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CharPicker.module.css";
import { GLYPHS, ROM_CHARS } from "../lib/font";

const CODES = [
  ...Array.from({ length: 24 }, (_, k) => 0x08 + k),
  0x5c, 0x7e, 0x7f,
  ...Array.from({ length: 128 }, (_, k) => 0x80 + k).filter((c) => c !== 0xa0),
];

function Glyph({ code }: { code: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 5, 8);
    ctx.fillStyle = "#eef3ff";
    GLYPHS[code].forEach((bits, r) => {
      for (let c = 0; c < 5; c++) if ((bits >> (4 - c)) & 1) ctx.fillRect(c, r, 1, 1);
    });
  }, [code]);
  return <canvas ref={ref} width={5} height={8} aria-hidden="true" />;
}

function insert(el: HTMLInputElement, ch: string, atEnd: boolean) {
  const start = atEnd ? el.value.length : el.selectionStart ?? el.value.length;
  const end = atEnd ? start : el.selectionEnd ?? start;
  const next = el.value.slice(0, start) + ch + el.value.slice(end);
  if (el.maxLength > 0 && [...next].length > el.maxLength) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  if (!atEnd) el.setSelectionRange(start + ch.length, start + ch.length);
}

/** Inserts characters of the badge's ROM that a keyboard can't type into the LCD row last focused. */
export function CharPicker({ fallbackInputId }: { fallbackInputId: string }) {
  const [open, setOpen] = useState(false);
  const target = useRef<HTMLInputElement | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.closest("[data-lcd]")) target.current = e.target;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        target.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !pop.current || getComputedStyle(pop.current).position !== "fixed") return;
    const row = (target.current?.isConnected ? target.current : document.getElementById(fallbackInputId))?.closest("li");
    if (!row) return;
    const covered = row.getBoundingClientRect().bottom - pop.current.getBoundingClientRect().top + 8;
    if (covered > 0) window.scrollBy({ top: covered, behavior: "smooth" });
  }, [open, fallbackInputId]);

  const pick = (code: number) => {
    let el = target.current;
    if (!el?.isConnected) el = document.getElementById(fallbackInputId) as HTMLInputElement | null;
    if (!el) return;
    const focused = document.activeElement === el;
    if (!focused && matchMedia("(pointer: coarse)").matches) return insert(el, ROM_CHARS[code], true);
    if (!focused) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
    insert(el, ROM_CHARS[code], false);
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        className="chip"
        aria-expanded={open}
        aria-haspopup="true"
        title="Insert a special character"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
      >
        Ω
      </button>
      {open && (
        <div ref={pop} className={styles.pop} role="group" aria-label="Special characters">
          {CODES.map((code) => (
            <button
              key={code}
              type="button"
              className={styles.cell}
              title={`${ROM_CHARS[code]}  0x${code.toString(16).toUpperCase()}`}
              aria-label={ROM_CHARS[code]}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(code)}
            >
              <Glyph code={code} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
