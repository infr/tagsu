"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import styles from "./SetMenu.module.css";
import type { EditorState } from "../hooks/useEditorState";

function ago(ms: number) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ms).toLocaleDateString();
}

/** The open set's name, edited in place, and a menu of all saved sets. */
export function SetMenu({ state }: { state: EditorState }) {
  const { sets, currentSet, onBadgeId, badgeState } = state;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentSet.name);
  const [shownFor, setShownFor] = useState(currentSet.id + currentSet.name);
  const [hi, setHi] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  if (shownFor !== currentSet.id + currentSet.name) {
    setShownFor(currentSet.id + currentSet.name);
    setName(currentSet.name);
  }

  const ordered = [...sets].sort((a, b) => (a.id === currentSet.id ? -1 : b.id === currentSet.id ? 1 : b.updated - a.updated));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };

  const choose = (id: string) => {
    state.openSet(id);
    close();
  };

  return (
    <div className={styles.root} ref={root}>
      <input
        className={styles.name}
        value={name}
        aria-label="Name of this set"
        size={Math.max(6, Math.min(28, name.length + 1))}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => state.renameSet(currentSet.id, name)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setName(currentSet.name);
            requestAnimationFrame(() => e.currentTarget?.blur());
          }
        }}
      />
      <button
        ref={toggle}
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Saved sets"
        title="Saved sets"
        onClick={() => {
          setHi(0);
          setOpen(!open);
        }}
      >
        <Icon name="chevron" />
      </button>
      {badgeState && <span className={styles.status}>{badgeState === "sent" ? "On badge" : "Edited since sent"}</span>}

      {open && (
        <div
          className={styles.menu}
          role="menu"
          tabIndex={-1}
          ref={(el) => el?.focus()}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown") setHi((h) => Math.min(ordered.length - 1, h + 1));
            else if (e.key === "ArrowUp") setHi((h) => Math.max(0, h - 1));
            else if (e.key === "Enter") choose(ordered[hi].id);
            else return;
            e.preventDefault();
          }}
        >
          <ul className={styles.list}>
            {ordered.map((set, k) => {
              const current = set.id === currentSet.id;
              const count = current ? state.screens.length : set.screens.length;
              return (
                <li key={set.id} className={`${styles.item} ${k === hi ? styles.hi : ""}`} onPointerEnter={() => setHi(k)}>
                  <button type="button" role="menuitem" className={styles.pick} onClick={() => choose(set.id)}>
                    <span className={styles.itemName}>{set.name}</span>
                    <span className={styles.meta}>
                      {count} screen{count === 1 ? "" : "s"} · {current ? "open" : ago(set.updated)}
                      {set.id === onBadgeId && <span className={styles.tag}>On badge</span>}
                    </span>
                  </button>
                  {sets.length > 1 && (
                    <button type="button" className="icon-btn danger" aria-label={`Delete ${set.name}`} title="Delete" onClick={() => state.deleteSet(set.id)}>
                      <Icon name="trash" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className={styles.footer}>
            <button type="button" className="btn small" onClick={() => { state.newSet(); close(); }}>
              <Icon name="plus" /> New
            </button>
            <button type="button" className="btn small" onClick={() => { state.duplicateSet(); close(); }}>
              <Icon name="copy" /> Duplicate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
