"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { simulateScreen } from "../lib/badgeSim";
import { BLANK_CODES, effectName } from "../lib/effects";
import { screenCgram, screenCodes } from "../lib/layout";
import type { Cgram, Logo, Screen } from "../lib/types";

export type Frame = { codes: number[]; light: boolean; cgram: Cgram; tall: boolean };
type Step = { codes: number[]; light: boolean; ms: number; cgram: Cgram };

/** The badge's own effects (simulated from its firmware), then the measured blank between screens. */
function steps(s: Screen, logos: Logo[]): Step[] {
  const frames = simulateScreen({
    codes: screenCodes(s, logos),
    cgram: screenCgram(s, logos),
    inFx: s.inFx,
    inBlink: s.inBlink,
    outFx: s.outFx,
    outBlink: s.outBlink,
    holdMs: s.delay * 1000 + 1000,
  });
  return [...frames, { codes: BLANK_CODES, light: true, ms: 800, cgram: {} }];
}

export function describe(s: Screen) {
  return `${effectName(s.inFx, false)}${s.inBlink ? " + blink" : ""} → ${s.delay} s → ${effectName(s.outFx, true)}${s.outBlink ? " + blink" : ""}`;
}

/** Plays the screens like the badge does; when paused it shows the active screen as stored. */
export function usePreview(screens: Screen[], logos: Logo[], active: number, playing: boolean) {
  const [shown, setShown] = useState({ index: active, step: 0 });
  const [startedFrom, setStartedFrom] = useState({ active, playing });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (startedFrom.active !== active || startedFrom.playing !== playing) {
    setStartedFrom({ active, playing });
    setShown({ index: active, step: 0 });
  }

  const index = Math.min(shown.index, screens.length - 1);
  const sequence = useMemo(() => steps(screens[index], logos), [screens, logos, index]);

  useEffect(() => {
    if (!playing) return;
    const current = sequence[shown.step];
    timer.current = setTimeout(() => {
      setShown(({ index: i, step }) =>
        step + 1 < sequence.length ? { index: i, step: step + 1 } : { index: (i + 1) % screens.length, step: 0 },
      );
    }, current?.ms ?? 100);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, shown, sequence, screens.length]);

  const screen = screens[index];
  const frame: Frame = playing
    ? (() => {
        const step = sequence[shown.step] ?? sequence[0];
        return { codes: step.codes, light: step.light, cgram: step.cgram, tall: screen.tall };
      })()
    : { codes: screenCodes(screens[active], logos), light: true, cgram: screenCgram(screens[active], logos), tall: screens[active].tall };

  return { frame, index: playing ? index : active };
}
