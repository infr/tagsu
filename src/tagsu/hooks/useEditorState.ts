"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isAnimation } from "../lib/effects";
import { blankLogoRows } from "../lib/logos";
import { MAX_LOGOS, MAX_SCREENS, type Logo, type Screen } from "../lib/types";

const STORE = "tagsu-editor-sets-v1";
const uid = () => Math.random().toString(36).slice(2, 10);

const blankScreen = (): Screen => ({
  id: uid(), r1: "", r2: "", a1: "left", a2: "left", delay: 5,
  inFx: 0, inBlink: false, outFx: 0, outBlink: false, logo: "", logoPos: "right", big: false, tall: false,
});

export const EXAMPLE: Screen[] = [
  { ...blankScreen(), id: "ex1", r1: "Hello", r2: "world!", delay: 6, inFx: 4, outFx: 5, logo: "b0" },
  { ...blankScreen(), id: "ex2", r1: "Tagsu is back", r2: "after 10 years", a1: "center", a2: "center", inFx: 1, outFx: 6 },
  { ...blankScreen(), id: "ex4", r1: "Moi!", a1: "center", big: true, delay: 3, inFx: 4, outFx: 1 },
  { ...blankScreen(), id: "ex3", r1: "Hacked on a", r2: "Friday night", a1: "right", a2: "right", inFx: 2, outFx: 3, outBlink: true, logo: "b3", logoPos: "left" },
];

function withoutClashingAnimations(s: Screen): Screen {
  if (!s.big && !s.tall && !s.logo) return s;
  return { ...s, inFx: isAnimation(s.inFx) ? 0 : s.inFx, outFx: isAnimation(s.outFx) ? 0 : s.outFx };
}

type Snapshot = { screens: Screen[]; logos: Logo[]; active: number; activeLogo: number };

/** A complete badge program: everything one update writes to the badge. */
export type SavedSet = { id: string; name: string; updated: number; screens: Screen[]; logos: Logo[] };
/** The set last sent to the badge, with its content at that moment. */
type OnBadge = { id: string; content: string } | null;
type Library = { current: string; sets: SavedSet[]; onBadge: OnBadge };

const contentOf = (screens: Screen[], logos: Logo[]) => JSON.stringify({ screens, logos });

/** A custom logo takes a slot on the badge only while some screen shows it. */
const inUse = (screens: Screen[], logos: Logo[]) => logos.filter((l) => screens.some((s) => s.logo === "c" + l.id));
const isDrawn = (l: Logo) => l.rows.some((r) => r.includes("1"));

function cleanSet(raw: Partial<SavedSet>): SavedSet {
  const screens = (raw.screens?.length ? raw.screens : [blankScreen()])
    .slice(0, MAX_SCREENS)
    .map((s: Partial<Screen>) => withoutClashingAnimations({ ...blankScreen(), ...s }));
  return {
    id: raw.id ?? uid(),
    name: raw.name || "Untitled",
    updated: raw.updated ?? Date.now(),
    screens,
    logos: inUse(screens, raw.logos ?? []).slice(0, MAX_LOGOS),
  };
}

function loadLibrary(): Library {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (saved?.sets?.length) {
      const sets = saved.sets.map(cleanSet);
      const current = sets.some((x: SavedSet) => x.id === saved.current) ? saved.current : sets[0].id;
      return { current, sets, onBadge: saved.onBadge ?? null };
    }
  } catch {
    /* storage unavailable: start from the example */
  }
  const set = cleanSet({ name: "Example", screens: EXAMPLE });
  return { current: set.id, sets: [set], onBadge: null };
}

/**
 * Saves the library with the open set's working copy to localStorage on every change.
 * `commit()` gives the sets with that working copy folded in, for switching to another set.
 */
function useAutosave(library: Library, screens: Screen[], logos: Logo[], firstUpdated: number) {
  const state = useRef({ content: contentOf(screens, logos), edited: firstUpdated, library, screens, logos });

  useEffect(() => {
    const st = state.current;
    const content = contentOf(screens, logos);
    if (content !== st.content) {
      st.content = content;
      st.edited = Date.now();
    }
    Object.assign(st, { library, screens, logos });
    try {
      localStorage.setItem(STORE, JSON.stringify({ ...library, sets: merge(st) }));
    } catch {
      /* storage unavailable */
    }
  }, [library, screens, logos]);

  return {
    commit: () => merge(state.current),
    reset: (set: SavedSet) => Object.assign(state.current, { content: contentOf(set.screens, set.logos), edited: set.updated }),
  };
}

function merge(st: { edited: number; library: Library; screens: Screen[]; logos: Logo[] }): SavedSet[] {
  return st.library.sets.map((x) => (x.id === st.library.current ? { ...x, screens: st.screens, logos: st.logos, updated: st.edited } : x));
}

/** Client-only: reads the saved sets from localStorage on first render. */
export function useEditorState() {
  const [initial] = useState(loadLibrary);
  const first = initial.sets.find((x) => x.id === initial.current)!;
  const [screens, setScreens] = useState<Screen[]>(first.screens);
  const [logos, setLogos] = useState<Logo[]>(first.logos);
  const [active, setActiveRaw] = useState(0);
  const [activeLogo, setActiveLogo] = useState(first.logos.length ? 0 : -1);
  const [undo, setUndo] = useState<{ label: string; apply: () => void } | null>(null);
  const [library, setLibrary] = useState<Library>(initial);

  const autosave = useAutosave(library, screens, logos, first.updated);
  const committed = () => autosave.commit();

  const restore = (snap: Snapshot) => () => {
    setScreens(snap.screens);
    setLogos(snap.logos);
    setActiveRaw(snap.active);
    setActiveLogo(snap.activeLogo);
  };

  const open = (set: SavedSet) => {
    autosave.reset(set);
    setScreens(set.screens);
    setLogos(set.logos);
    setActiveRaw(0);
    setActiveLogo(set.logos.length ? 0 : -1);
  };

  const openSet = (id: string) => {
    const set = library.sets.find((x) => x.id === id);
    if (!set || id === library.current) return;
    setLibrary({ ...library, sets: committed(), current: id });
    open(set);
    setUndo(null);
  };

  const addSet = (base: Partial<SavedSet>) => {
    const set = cleanSet({ ...base, id: uid(), updated: Date.now() });
    setLibrary({ ...library, current: set.id, sets: [...committed(), set] });
    open(set);
    setUndo(null);
  };

  const newSet = () => addSet({ name: `Badge ${library.sets.length + 1}` });

  const duplicateSet = () => {
    const name = library.sets.find((x) => x.id === library.current)?.name ?? "Badge";
    addSet({ name: `${name} copy`, screens: screens.map((x) => ({ ...x, id: uid() })), logos });
  };

  const renameSet = useCallback((id: string, name: string) => {
    setLibrary((lib) => ({ ...lib, sets: lib.sets.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x)) }));
  }, []);

  const deleteSet = (id: string) => {
    if (library.sets.length <= 1) return;
    const before = { ...library, sets: committed() };
    const editing = { screens, logos, active, activeLogo };
    const sets = before.sets.filter((x) => x.id !== id);
    if (id === library.current) {
      const next = [...sets].sort((a, b) => b.updated - a.updated)[0];
      setLibrary({ ...library, sets, current: next.id });
      open(next);
    } else {
      setLibrary({ ...library, sets });
    }
    const name = library.sets.find((x) => x.id === id)?.name ?? "Set";
    setUndo({
      label: `${name} deleted`,
      apply: () => {
        setLibrary(before);
        const set = before.sets.find((x) => x.id === before.current)!;
        open(set);
        restore(editing)();
      },
    });
  };

  const markSent = useCallback(() => {
    setLibrary((lib) => ({ ...lib, onBadge: { id: lib.current, content: contentOf(screens, logos) } }));
  }, [screens, logos]);

  const currentSet = library.sets.find((x) => x.id === library.current)!;
  const badgeState = library.onBadge?.id !== library.current ? null : library.onBadge.content === contentOf(screens, logos) ? "sent" : "edited";

  const snapshot = (): Snapshot => ({ screens, logos, active, activeLogo });

  const setActive = useCallback((i: number) => setActiveRaw(i), []);

  const updateScreen = useCallback((i: number, patch: Partial<Screen>) => {
    setScreens((list) => list.map((s, j) => (j === i ? withoutClashingAnimations({ ...s, ...patch }) : s)));
  }, []);

  const addScreen = (at = screens.length): string | null => {
    if (screens.length >= MAX_SCREENS) return null;
    const s = blankScreen();
    setScreens([...screens.slice(0, at), s, ...screens.slice(at)]);
    setActiveRaw(at);
    return s.id;
  };

  const duplicateScreen = (i: number): string | null => {
    if (screens.length >= MAX_SCREENS) return null;
    const s = { ...screens[i], id: uid() };
    setScreens([...screens.slice(0, i + 1), s, ...screens.slice(i + 1)]);
    setActiveRaw(i + 1);
    return s.id;
  };

  const removeScreen = (i: number) => {
    if (screens.length <= 1) return;
    setUndo({ label: `Screen ${i + 1} deleted`, apply: restore(snapshot()) });
    const next = screens.filter((_, j) => j !== i);
    setScreens(next);
    setLogos(inUse(next, logos));
    setActiveRaw(Math.min(i, screens.length - 2));
  };

  const moveScreen = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= screens.length) return;
    const next = screens.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setScreens(next);
    setActiveRaw(j);
  };

  /** Sets a screen's logo and frees custom logos no screen shows any more; undo brings back a drawn one. */
  const changeLogo = (i: number, logo: string, list: Logo[]) => {
    const next = screens.map((s, j) => (j === i ? withoutClashingAnimations({ ...s, logo }) : s));
    const kept = inUse(next, list);
    if (logos.some((l) => !kept.includes(l) && isDrawn(l))) setUndo({ label: "Custom logo removed", apply: restore(snapshot()) });
    setScreens(next);
    setLogos(kept);
  };

  const setScreenLogo = (i: number, logo: string) => changeLogo(i, logo, logos);

  const canNewLogoFor = (i: number) => inUse(screens.map((s, j) => (j === i ? { ...s, logo: "" } : s)), logos).length < MAX_LOGOS;

  const newLogoFor = (i: number, rows?: string[]): boolean => {
    if (!canNewLogoFor(i)) return false;
    const l = { id: uid(), rows: rows ? rows.slice() : blankLogoRows() };
    changeLogo(i, "c" + l.id, [...logos, l]);
    return true;
  };

  const updateLogo = useCallback((k: number, rows: string[]) => {
    setLogos((list) => list.map((l, j) => (j === k ? { ...l, rows } : l)));
  }, []);

  const clearLogo = (k: number) => {
    setUndo({ label: "Logo cleared", apply: restore(snapshot()) });
    updateLogo(k, blankLogoRows());
  };

  const deleteLogo = (k: number) => {
    const l = logos[k];
    if (!l) return;
    setUndo({ label: `Custom logo ${k + 1} deleted`, apply: restore(snapshot()) });
    setScreens(screens.map((s) => (s.logo === "c" + l.id ? { ...s, logo: "" } : s)));
    setLogos(logos.filter((_, j) => j !== k));
    setActiveLogo(Math.min(k, logos.length - 2));
  };

  const dismissUndo = useCallback(() => setUndo(null), []);

  const applyUndo = () => {
    undo?.apply();
    setUndo(null);
  };

  return {
    screens, logos, active, activeLogo, undo,
    setActive, setActiveLogo, updateScreen, addScreen, duplicateScreen, removeScreen, moveScreen,
    setScreenLogo, canNewLogoFor, newLogoFor, updateLogo, clearLogo, deleteLogo, applyUndo, dismissUndo,
    sets: library.sets, currentSet, onBadgeId: library.onBadge?.id ?? null, badgeState,
    openSet, newSet, duplicateSet, renameSet, deleteSet, markSent,
  };
}

export type EditorState = ReturnType<typeof useEditorState>;
