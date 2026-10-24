"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LogoPanel.module.css";
import type { EditorState } from "../hooks/useEditorState";
import { BUILTIN, BUILTIN_NAMES, invertRows } from "../lib/logos";
import { PRESETS } from "../lib/presets";
import { fileToLogo, textToLogo } from "../lib/toLogo";

const ON = "#eef3ff";
const OFF = "rgba(190,205,255,0.14)";
const BG = "#2440ec";

function paint(canvas: HTMLCanvasElement, rows: string[], cursor?: { x: number; y: number } | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const s = canvas.width / 15;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, y) =>
    [...row].forEach((bit, x) => {
      ctx.fillStyle = bit === "1" ? ON : OFF;
      ctx.fillRect(x * s + s * 0.08, y * s + s * 0.08, s * 0.84, s * 0.84);
    }),
  );
  if (canvas.width > 100) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    for (const x of [5, 10]) {
      ctx.beginPath();
      ctx.moveTo(x * s, 0);
      ctx.lineTo(x * s, canvas.height);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, 8 * s);
    ctx.lineTo(canvas.width, 8 * s);
    ctx.stroke();
  }
  if (cursor) {
    ctx.strokeStyle = "#ffcf5a";
    ctx.lineWidth = 3;
    ctx.strokeRect(cursor.x * s + 1.5, cursor.y * s + 1.5, s - 3, s - 3);
  }
}

/** Pixel editor for one custom logo, shown under the options of a screen that uses it. */
export function LogoPanel({ state, index }: { state: EditorState; index: number }) {
  const activeLogo = index;
  const logo = state.logos[index];
  const canvas = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const paintValue = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [glyph, setGlyph] = useState("");

  useEffect(() => {
    if (canvas.current && logo) paint(canvas.current, logo.rows, cursor);
  }, [logo, cursor]);

  if (!logo) return null;

  const setPixel = (x: number, y: number, v: string) => {
    if (!logo || x < 0 || y < 0 || x > 14 || y > 15 || logo.rows[y][x] === v) return;
    const rows = logo.rows.slice();
    rows[y] = rows[y].slice(0, x) + v + rows[y].slice(x + 1);
    state.updateLogo(activeLogo, rows);
  };

  const importFile = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    try {
      state.updateLogo(activeLogo, await fileToLogo(file));
    } catch {
      /* not a readable image */
    }
  };

  const cellAt = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: Math.floor(((e.clientX - r.left) / r.width) * 15), y: Math.floor(((e.clientY - r.top) / r.height) * 16) };
  };

  return (
    <div
      className={styles.panel}
      role="group"
      aria-label={`Custom logo ${index + 1}`}
      onPaste={(e) => {
        const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
        if (file && logo) {
          e.preventDefault();
          void importFile(file);
        }
      }}
    >
      {logo && (
        <div className={styles.editor}>
          <canvas
            ref={canvas}
            className={styles.pixels}
            width={450}
            height={480}
            tabIndex={0}
            aria-label={`Custom logo ${activeLogo + 1}, 15 by 16 pixels`}
            onPointerDown={(e) => {
              const { x, y } = cellAt(e);
              paintValue.current = logo.rows[y]?.[x] === "1" ? "0" : "1";
              e.currentTarget.setPointerCapture(e.pointerId);
              setPixel(x, y, paintValue.current);
            }}
            onPointerMove={(e) => {
              if (!paintValue.current) return;
              const { x, y } = cellAt(e);
              setPixel(x, y, paintValue.current);
            }}
            onPointerUp={() => (paintValue.current = null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void importFile(e.dataTransfer.files[0]);
            }}
            onFocus={() => setCursor((c) => c ?? { x: 7, y: 7 })}
            onBlur={() => setCursor(null)}
            onKeyDown={(e) => {
              const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
              const c = cursor ?? { x: 7, y: 7 };
              if (moves[e.key]) {
                e.preventDefault();
                setCursor({ x: Math.max(0, Math.min(14, c.x + moves[e.key][0])), y: Math.max(0, Math.min(15, c.y + moves[e.key][1])) });
              } else if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setPixel(c.x, c.y, logo.rows[c.y][c.x] === "1" ? "0" : "1");
              }
            }}
          />
          <div className={styles.tools}>
            <select
              value=""
              aria-label="Copy a logo"
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const source = v[0] === "b" ? BUILTIN[Number(v.slice(1))] : PRESETS[Number(v.slice(1))].rows;
                state.updateLogo(activeLogo, source.slice());
              }}
            >
              <option value="">Copy from…</option>
              <optgroup label="Built-in">
                {BUILTIN_NAMES.map((n, k) => <option key={n} value={`b${k}`}>{n}</option>)}
              </optgroup>
              <optgroup label="More">
                {PRESETS.map((p, k) => <option key={p.name} value={`p${k}`}>{p.name}</option>)}
              </optgroup>
            </select>
            <input
              className={styles.glyph}
              value={glyph}
              placeholder="Emoji"
              aria-label="Draw an emoji or character as the logo"
              title="Type or paste an emoji or character"
              onChange={(e) => {
                setGlyph(e.target.value);
                if (e.target.value.trim()) state.updateLogo(activeLogo, textToLogo(e.target.value.trim()));
              }}
            />
            <button type="button" className="btn small" title="Or drop or paste an image on the logo" onClick={() => fileInput.current?.click()}>Image…</button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn small" onClick={() => state.updateLogo(activeLogo, invertRows(logo.rows))}>Invert</button>
            <button type="button" className="btn small" onClick={() => state.clearLogo(activeLogo)}>Clear</button>
            <button type="button" className="btn small" onClick={() => state.deleteLogo(activeLogo)}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
