"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AboutPanel } from "./AboutPanel";
import { Badge } from "./Badge";
import "../tagsu.css";
import styles from "./Editor.module.css";
import { Icon } from "./icons";
import { Lcd } from "./Lcd";
import { cellAt, type LcdPicture } from "./lcdDraw";
import { lcdInputId } from "./LcdEditor";
import { LIST_PREFIX, ScreenList } from "./ScreenList";
import { SetMenu } from "./SetMenu";
import { useEditorState } from "../hooks/useEditorState";
import { describe, usePreview } from "../hooks/usePreview";
import { useSender } from "../hooks/useSender";
import { expandScreens } from "../lib/expand";
import { buildImage } from "../lib/image";
import { encode } from "../lib/modem";
import { MAX_SCREENS } from "../lib/types";
import { caretAt, lcdView, type Caret } from "../lib/view";

const Badge3D = lazy(() => import("./badge3d/Badge3D"));

export function Editor() {
  const state = useEditorState();
  const { screens, logos, active } = state;
  const [playing, setPlaying] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [caret, setCaret] = useState<Caret | null>(null);
  const [exploded, setExploded] = useState(false);
  const badgeScreens = useMemo(() => expandScreens(screens), [screens]);
  const firstPart = Math.max(0, badgeScreens.findIndex((b) => b.source === active));
  const { frame, index } = usePreview(badgeScreens, logos, firstPart, playing);
  const playingScreen = badgeScreens[index] ?? badgeScreens[0];
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  const sender = useSender({
    onDone: (what) => {
      state.markSent();
      showToast(`Sent ${what.count} screen${what.count > 1 ? "s" : ""}`);
    },
    onError: showToast,
  });

  const screen = screens[active];
  const editing = caret !== null;
  const picture: LcdPicture = playing && !editing ? frame : lcdView(screen, logos, caret);

  // Clicking the badge's LCD types into the active screen at that spot.
  const editAt = useCallback(
    (row: 0 | 1, col: number) => {
      setPlaying(false);
      const r = screen.big ? 0 : row;
      const el = document.getElementById(lcdInputId(LIST_PREFIX, screen.id, r === 0 ? "r1" : "r2")) as HTMLInputElement | null;
      if (!el) return;
      const pos = caretAt(screen, logos, r, col, caret?.pos ?? 0);
      el.focus({ preventScroll: true });
      el.setSelectionRange(pos, pos);
      setCaret({ row: r, pos });
    },
    [screen, logos, caret],
  );
  const sending = sender.status.phase === "sending";
  const clearFocus = useCallback(() => setFocusId(null), []);

  const { undo, dismissUndo } = state;
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(dismissUndo, 6000);
    return () => clearTimeout(t);
  }, [undo, dismissUndo]);
  const toast = undo?.label ?? message;

  const send = useCallback(() => {
    if (sending) return;
    if (badgeScreens.length > MAX_SCREENS) showToast(`Too many screens: ${badgeScreens.length} / ${MAX_SCREENS}`);
    else void sender.send(encode(buildImage(badgeScreens, logos)), { kind: "screens", count: badgeScreens.length });
  }, [sending, sender, badgeScreens, logos, showToast]);

  const add = useCallback(
    (at?: number) => {
      const id = state.addScreen(at ?? active + 1);
      if (id) setFocusId(lcdInputId(LIST_PREFIX, id, "r1"));
      else showToast(`The badge holds ${MAX_SCREENS} screens`);
    },
    [state, active, showToast],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "Enter") {
        e.preventDefault();
        send();
      } else if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        add();
      } else if (e.key === "Escape" && sending) {
        sender.stop();
      } else if (e.key === "Escape" && exploded) {
        setExploded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send, add, sending, sender, exploded]);

  const status = sender.status;

  const flatBadge = (
    <Badge>
      <Lcd
        codes={picture.codes}
        cgram={picture.cgram}
        light={picture.light}
        cursor={picture.cursor}
        tall={picture.tall}
        label={`Screen ${active + 1} on the badge`}
        className={styles.flatLcd}
      />
    </Badge>
  );

  return (
    <div className={`tagsu ${styles.app}`}>
      <header className={styles.bar}>
        <h1 className={styles.title}>Tagsu</h1>
        <SetMenu state={state} />
        <span className={`${styles.meta} ${badgeScreens.length > MAX_SCREENS ? styles.over : ""}`}>{badgeScreens.length} / {MAX_SCREENS}</span>
        <div className={styles.spacer} />
        {sending && status.phase === "sending" && (
          <span className={styles.meta} role="status">Block {status.block} / {status.blocks} · {status.secondsLeft} s</span>
        )}
        <AboutPanel />
        {sending ? (
          <button type="button" className="btn" onClick={sender.stop}>Stop</button>
        ) : (
          <button type="button" className="btn primary" onClick={send} title="Headphone jack, volume at max">
            <Icon name="speaker" /> Send to Tagsu <kbd>⌘↵</kbd>
          </button>
        )}
        {sending && status.phase === "sending" && (
          <div className={styles.progress} style={{ transform: `scaleX(${status.progress})` }} aria-hidden="true" />
        )}
      </header>

      <main className={styles.layout}>
        <div className={`${styles.stage} ${exploded ? styles.raised : ""}`}>
          <div
            className={`${styles.badge} ${exploded ? styles.exploded : ""}`}
            onClick={(e) => {
              const canvas = (e.target as HTMLElement).closest("canvas");
              if (!canvas || !canvas.classList.contains(styles.flatLcd)) return;
              const r = canvas.getBoundingClientRect();
              const { row, col } = cellAt((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
              editAt(row, col);
            }}
          >
            <Suspense fallback={flatBadge}>
              <Badge3D picture={picture} flat={editing} exploded={exploded} fill={exploded} onLcdClick={editAt} fallback={flatBadge} />
            </Suspense>
            {exploded && (
              <button type="button" className={`btn ${styles.assemble}`} onClick={() => setExploded(false)}>
                Assemble <kbd>Esc</kbd>
              </button>
            )}
          </div>
          <div className={styles.transport}>
            <button type="button" className="icon-btn" aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <span className={`${styles.meta} ${styles.now}`}>
              {playingScreen.source + 1} / {screens.length} · {describe(playingScreen)}
            </span>
            <button type="button" className="chip" aria-pressed={exploded} title="Lay out every part side by side" onClick={() => setExploded(!exploded)}>
              {exploded ? "Assemble" : "Explode"}
            </button>
          </div>
        </div>

        <section aria-label="Screens">
          <ScreenList
            state={state}
            focusId={focusId}
            onFocused={clearFocus}
            onAdd={add}
            onCaret={setCaret}
            onNewLogoFor={(i, rows) => {
              if (!state.newLogoFor(i, rows)) showToast("The badge holds 10 custom logos");
            }}
          />
        </section>
      </main>

      <div className={`${styles.toast} ${toast ? styles.show : ""}`} role="status" aria-live="polite">
        <span>{toast}</span>
        {undo && <button type="button" onClick={state.applyUndo}>Undo</button>}
      </div>
    </div>
  );
}
