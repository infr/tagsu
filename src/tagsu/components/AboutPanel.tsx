"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AboutPanel.module.css";
import { Icon } from "./icons";

const LINKS = [
  { href: "https://rakettitiede.com/", label: "Rakettitiede", note: "made the badge" },
  { href: "https://firebay.pelaaja.info/embedded/12kbps-simple-audio-data-transfer-for-avr/", label: "12kbps data transfer for AVR using audio", note: "the audio modem, by Jari Tulilahti" },
  { href: "https://github.com/Jartza/tagsu-avr-modem", label: "tagsu-avr-modem", note: "the badge's audio modem" },
  { href: "https://web.archive.org/web/20160531133748/http://labs.rakettitiede.com/tagsun-tarina/", label: "The story of Tagsu", note: "archived, in Finnish" },
  { href: "https://web.archive.org/web/20160410054421/http://tagsu.io/edit/", label: "The original editor", note: "archived" },
];

/** What this editor is and where the badge came from. */
export function AboutPanel() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={root}>
      <button ref={toggle} type="button" className="icon-btn" aria-label="About" title="About" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="info" />
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="About this editor">
          <h2 className={styles.title}>About</h2>
          <p>
            Tagsu is an LCD name badge made by Rakettitiede in 2015. Its editor at tagsu.io is no longer online, so this is an unofficial
            stand-in to keep badges working: it sends screens in the same audio format, worked out from the badge itself.
          </p>
          <p className={styles.note}>Not affiliated with Rakettitiede. No firmware is included.</p>
          <ul className={styles.links}>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                <span>{l.note}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>
            Built with Next.js, React and three.js. Board lettering uses the Hershey fonts via hersheytext (MIT).
          </p>
        </div>
      )}
    </div>
  );
}
