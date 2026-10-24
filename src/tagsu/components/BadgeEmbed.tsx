"use client";

import Link from "next/link";
import { lazy, Suspense, useMemo, useState } from "react";
import { Badge } from "./Badge";
import "../tagsu.css";
import styles from "./BadgeEmbed.module.css";
import { Lcd } from "./Lcd";
import { EXAMPLE } from "../hooks/useEditorState";
import { usePreview } from "../hooks/usePreview";
import { expandScreens } from "../lib/expand";

const Badge3D = lazy(() => import("./badge3d/Badge3D"));

/** The 3D badge alone, playing the example screens, for embedding in other pages. */
export function BadgeEmbed() {
  const screens = useMemo(() => expandScreens(EXAMPLE), []);
  const { frame } = usePreview(screens, [], 0, true);
  const [exploded, setExploded] = useState(false);
  const flat = (
    <Badge>
      <Lcd codes={frame.codes} cgram={frame.cgram} light={frame.light} tall={frame.tall} />
    </Badge>
  );

  return (
    <div className={`tagsu ${styles.embed}`}>
      <Suspense fallback={flat}>
        <Badge3D picture={frame} flat={false} exploded={exploded} fill fit={1.45} onLcdClick={() => {}} fallback={flat} />
      </Suspense>
      <div className={styles.controls}>
        <button type="button" className="chip" aria-pressed={exploded} title="Lay out every part side by side" onClick={() => setExploded(!exploded)}>
          {exploded ? "Assemble" : "Explode"}
        </button>
        <Link href="/" target="_blank" rel="noopener" className={styles.open}>
          Open editor <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
