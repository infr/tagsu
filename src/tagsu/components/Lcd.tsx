"use client";

import { useEffect, useRef } from "react";
import { drawLcd, LCD_RATIO } from "./lcdDraw";
import type { Cgram } from "../lib/types";

export { LCD_RATIO };

type Props = {
  codes: number[];
  cgram?: Cgram;
  light?: boolean;
  /** Cell index 0-31 that shows the HD44780 underline cursor. */
  cursor?: number | null;
  className?: string;
  label?: string;
  tall?: boolean;
};

export function Lcd({ codes, cgram = {}, light = true, cursor = null, tall = false, className, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = w / LCD_RATIO;
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawLcd(ctx, w, h, { codes, cgram, light, cursor, tall });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [codes, cgram, light, cursor, tall]);

  return <canvas ref={ref} className={className} style={{ aspectRatio: LCD_RATIO }} role="img" aria-label={label ?? "Badge display"} />;
}
