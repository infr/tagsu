"use client";

import { useEffect, useRef, useState } from "react";
import { CharPicker } from "./CharPicker";
import { Icon } from "./icons";
import { LogoPanel } from "./LogoPanel";
import styles from "./ScreenList.module.css";
import type { EditorState } from "../hooks/useEditorState";
import { bigParts } from "../lib/bigfont";
import { EFFECTS, effectName, SCROLL_FROM_RIGHT, SCROLL_TO_LEFT } from "../lib/effects";
import { BUILTIN_NAMES, logoRows } from "../lib/logos";
import { PRESETS } from "../lib/presets";
import { MAX_DELAY, MAX_LOGOS, type Align, type Logo, type Screen } from "../lib/types";

const ALIGNS: Align[] = ["left", "center", "right"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function logoName(s: Screen, logos: Logo[]) {
  if (s.logo[0] === "b") return BUILTIN_NAMES[Number(s.logo.slice(1))];
  const k = logos.findIndex((l) => "c" + l.id === s.logo);
  return k >= 0 ? `Custom ${k + 1}` : "";
}

/** The same three lines as the options, as quiet text, for screens not being edited. */
export function ScreenSummary({ s, logos }: { s: Screen; logos: Logo[] }) {
  const parts = s.big ? bigParts(s.r1).length : 1;
  const logoOn = !s.big && !s.tall && logoRows(s.logo, logos) !== null;
  const fx = (code: number, blink: boolean, out: boolean) => `${effectName(code, out)}${blink ? " + blink" : ""}`;
  return (
    <div className={styles.details}>
      <span className={styles.label}>Text</span>
      <span className={styles.summary}>{s.big ? `Big · ${cap(s.a1)}${parts > 1 ? ` · scrolls by in ${parts} parts` : ""}` : s.tall ? `Tall · ${cap(s.a1)}` : `${cap(s.a1)} · ${cap(s.a2)}`}</span>
      <span className={styles.label}>Show</span>
      <span className={styles.summary}>
        {s.delay} s · {parts > 1 ? "Scrolls by" : `${fx(s.inFx, s.inBlink, false)} → ${fx(s.outFx, s.outBlink, true)}`}
      </span>
      <span className={styles.label}>Logo</span>
      <span className={styles.summary}>{logoOn ? `${logoName(s, logos)} · ${cap(s.logoPos)}` : "None"}</span>
    </div>
  );
}

type Props = {
  state: EditorState;
  i: number;
  noSlot: boolean;
  /** The row-1 input, for special characters picked before any row had focus. */
  inputId: string;
  onNewLogoFor: (i: number, rows?: string[]) => void;
};

/** Options of the screen being edited, laid out over the same three lines as its summary. */
export function ScreenOptions({ state, i, noSlot, inputId, onNewLogoFor }: Props) {
  const { logos } = state;
  const s = state.screens[i];
  const [drawing, setDrawing] = useState(false);
  const pop = useRef<HTMLDivElement>(null);
  const logoOn = !s.big && !s.tall && logoRows(s.logo, logos) !== null;
  const noAnimations = s.big || s.tall || logoOn;
  const oneRow = s.big || s.tall;
  const parts = s.big ? bigParts(s.r1).length : 1;
  const banner = parts > 1;
  const customIndex = logoOn && s.logo[0] === "c" ? logos.findIndex((l) => "c" + l.id === s.logo) : -1;
  const update = (patch: Partial<Screen>) => state.updateScreen(i, patch);
  const canAdd = state.canNewLogoFor(i);
  const n = i + 1;

  useEffect(() => {
    if (!drawing) return;
    const onDown = (e: PointerEvent) => {
      if (!pop.current?.parentElement?.contains(e.target as Node)) setDrawing(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawing(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [drawing]);

  return (
    <div className={styles.details}>
      <span className={styles.label}>Text</span>
      <div className={`${styles.controls} ${styles.anchor}`}>
        {(["a1", "a2"] as const).map((key, r) => (
          <div key={key} className="seg" role="group" aria-label={`Row ${r + 1} alignment`}>
            {ALIGNS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={s[key] === a && !(r === 1 && oneRow)}
                disabled={r === 1 && oneRow}
                title={`Align row ${r + 1} ${a}`}
                aria-label={`Align row ${r + 1} ${a}`}
                onClick={() => update({ [key]: a })}
              >
                <Icon name={a} />
              </button>
            ))}
          </div>
        ))}
        <button type="button" className="chip" aria-pressed={s.big} title="Large letters drawn with custom characters, about 4 per screen; longer text scrolls by" onClick={() => update({ big: !s.big, tall: false })}>Big</button>
        <button type="button" className="chip" aria-pressed={s.tall} title="Row 1 in the LCD's own double height, up to 16 characters" onClick={() => update({ tall: !s.tall, big: false })}>Tall</button>
        <CharPicker fallbackInputId={inputId} />
        {noSlot ? <span className={styles.warn}>No free logo slot</span> : banner && <span className={styles.note}>Scrolls by in {parts} parts</span>}
      </div>

      <span className={styles.label}>Show</span>
      <div className={styles.controls}>
        <label className={styles.field}>
          <input
            type="number" min={0} max={MAX_DELAY} value={s.delay} className={styles.delay}
            aria-label={`Screen ${n} delay in seconds`}
            onChange={(e) => update({ delay: Math.max(0, Math.min(MAX_DELAY, parseInt(e.target.value, 10) || 0)) })}
          />
          s
        </label>
        <select value={banner ? SCROLL_FROM_RIGHT : s.inFx} disabled={banner} aria-label={`Screen ${n} in effect`} onChange={(e) => update({ inFx: Number(e.target.value) })}>
          {EFFECTS.map((fx) => <option key={fx.code} value={fx.code} disabled={fx.animation && noAnimations}>{fx.in}</option>)}
        </select>
        <button type="button" className="chip" aria-pressed={s.inBlink && !banner} disabled={banner} title="Blink the backlight after the in effect" onClick={() => update({ inBlink: !s.inBlink })}>Blink</button>
        <select value={banner ? SCROLL_TO_LEFT : s.outFx} disabled={banner} aria-label={`Screen ${n} out effect`} onChange={(e) => update({ outFx: Number(e.target.value) })}>
          {EFFECTS.map((fx) => <option key={fx.code} value={fx.code} disabled={fx.animation && noAnimations}>{fx.out}</option>)}
        </select>
        <button type="button" className="chip" aria-pressed={s.outBlink && !banner} disabled={banner} title="Blink the backlight before the out effect" onClick={() => update({ outBlink: !s.outBlink })}>Blink</button>
      </div>

      <span className={styles.label}>Logo</span>
      <div className={`${styles.controls} ${styles.anchor}`}>
        <select
          value={logoOn ? s.logo : ""}
          disabled={oneRow}
          aria-label={`Screen ${n} logo`}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "new") onNewLogoFor(i);
            else if (v[0] === "p") onNewLogoFor(i, PRESETS[Number(v.slice(1))].rows);
            else state.setScreenLogo(i, v);
          }}
        >
          <option value="">None</option>
          <optgroup label="Built-in">
            {BUILTIN_NAMES.map((name, k) => <option key={k} value={`b${k}`}>{name}</option>)}
          </optgroup>
          {logos.length > 0 && (
            <optgroup label="Custom">
              {logos.map((l, k) => <option key={l.id} value={`c${l.id}`}>Custom {k + 1}</option>)}
            </optgroup>
          )}
          {canAdd && (
            <optgroup label="More">
              {PRESETS.map((p, k) => <option key={p.name} value={`p${k}`}>{p.name}</option>)}
            </optgroup>
          )}
          {canAdd ? <option value="new">Draw new…</option> : <option disabled>All {MAX_LOGOS} custom logos in use</option>}
        </select>
        <div className="seg" role="group" aria-label="Logo position">
          {(["left", "right"] as const).map((p) => (
            <button key={p} type="button" disabled={!logoOn} aria-pressed={logoOn && s.logoPos === p} onClick={() => update({ logoPos: p })}>
              {p === "left" ? "Left" : "Right"}
            </button>
          ))}
        </div>
        {customIndex >= 0 && (
          <button type="button" className="chip" aria-pressed={drawing} aria-expanded={drawing} onClick={() => setDrawing(!drawing)}>
            Draw
          </button>
        )}
        {drawing && customIndex >= 0 && (
          <div ref={pop} className={styles.popover}>
            <LogoPanel state={state} index={customIndex} />
          </div>
        )}
      </div>
    </div>
  );
}
