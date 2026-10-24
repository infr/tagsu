"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RATE, type Encoded } from "../lib/modem";

export type SendStatus =
  | { phase: "idle" }
  | { phase: "sending"; block: number; blocks: number; progress: number; secondsLeft: number }
  | { phase: "done"; what: SendWhat }
  | { phase: "stopped" }
  | { phase: "error"; message: string };

/** What a send carries, for the message afterwards. */
export type SendWhat = { kind: "screens"; count: number };

type Callbacks = { onDone?: (what: SendWhat) => void; onError?: (message: string) => void };

/** Plays update audio through the default output (the headphone jack). */
export function useSender(callbacks: Callbacks = {}) {
  const [status, setStatus] = useState<SendStatus>({ phase: "idle" });
  const run = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; frame: number } | null>(null);
  const cb = useRef(callbacks);
  useEffect(() => {
    cb.current = callbacks;
  });

  const stop = useCallback((done?: SendWhat) => {
    const r = run.current;
    if (!r) return;
    run.current = null;
    cancelAnimationFrame(r.frame);
    r.src.onended = null;
    try {
      r.src.stop();
    } catch {
      /* already stopped */
    }
    void r.ctx.close();
    setStatus(done ? { phase: "done", what: done } : { phase: "stopped" });
    if (done) cb.current.onDone?.(done);
  }, []);

  const send = useCallback(
    async ({ samples, blockStarts, seconds, blocks }: Encoded, what: SendWhat) => {
      if (run.current) return;
      let ctx: AudioContext;
      try {
        try {
          ctx = new AudioContext({ sampleRate: RATE });
        } catch {
          ctx = new AudioContext();
        }
        await ctx.resume();
      } catch {
        const message = "This browser can't play audio here. Try another browser.";
        setStatus({ phase: "error", message });
        cb.current.onError?.(message);
        return;
      }
      const buffer = ctx.createBuffer(2, samples.length, RATE);
      buffer.copyToChannel(samples, 0);
      buffer.copyToChannel(samples, 1);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const t0 = ctx.currentTime + 0.05;
      src.start(t0);
      run.current = { ctx, src, frame: 0 };
      src.onended = () => stop(what);
      const tick = () => {
        if (!run.current) return;
        const t = ctx.currentTime - t0;
        setStatus({
          phase: "sending",
          block: blockStarts.filter((s) => s <= t).length,
          blocks,
          progress: Math.min(1, Math.max(0, t / seconds)),
          secondsLeft: Math.max(0, Math.ceil(seconds - t)),
        });
        run.current.frame = requestAnimationFrame(tick);
      };
      tick();
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { status, send, stop: () => stop() };
}
