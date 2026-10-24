"use client";

import type { ReactNode } from "react";
import styles from "./Badge.module.css";

// Drawn from photos of the 2015 production board: 86 x 74 mm acrylic case, blue PCB,
// 16x2 LCD module with side LED backlight, push button, 3.5 mm jack and an AAA holder.
const W = 860;
const H = 740;
const GLASS = { x: 176, y: 198, w: 574 };

function Screw({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="30" fill="url(#screw)" stroke="#6b7480" strokeWidth="2" />
      <circle r="30" fill="url(#screwShine)" />
      <rect x="-22" y="-3.5" width="44" height="7" rx="2" fill="#4b525c" transform="rotate(-28)" />
    </g>
  );
}

function Part({ x, y, w = 22, h = 34, label, dark = false }: { x: number; y: number; w?: number; h?: number; label: string; dark?: boolean }) {
  return (
    <g>
      <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx="3" fill="#c9ccd1" />
      <rect x={x} y={y} width={w} height={h} rx="2" fill={dark ? "#1e1f22" : "#b98a4e"} />
      <text x={x + w / 2} y={y + h + 24} className={styles.silk} textAnchor="middle">{label}</text>
    </g>
  );
}

/** The badge itself; `children` is placed on the LCD glass. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <div className={styles.badge} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg className={styles.body} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id="pcb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#245fb3" />
            <stop offset="1" stopColor="#1a4a94" />
          </linearGradient>
          <linearGradient id="acrylic" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="0.3" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.28)" />
          </linearGradient>
          <radialGradient id="screw" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#f4f6f8" />
            <stop offset="0.6" stopColor="#a9b1bb" />
            <stop offset="1" stopColor="#7c858f" />
          </radialGradient>
          <radialGradient id="screwShine" cx="0.3" cy="0.25" r="0.35">
            <stop offset="0" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8ccd2" />
            <stop offset="1" stopColor="#8e949c" />
          </linearGradient>
          <linearGradient id="led" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#dfe7ff" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
          <linearGradient id="battery" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f6f4c" />
            <stop offset="0.5" stopColor="#2b5638" />
            <stop offset="1" stopColor="#1d3c27" />
          </linearGradient>
          <linearGradient id="batteryCap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f2d27a" />
            <stop offset="0.5" stopColor="#c99a2e" />
            <stop offset="1" stopColor="#8f6a17" />
          </linearGradient>
          <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#0a1030" floodOpacity="0.35" />
          </filter>
        </defs>

        <rect x="6" y="6" width={W - 12} height={H - 12} rx="34" fill="rgba(210,225,245,0.18)" stroke="rgba(255,255,255,0.7)" strokeWidth="3" filter="url(#soft)" />
        <rect x="34" y="96" width={W - 68} height={H - 150} rx="14" fill="url(#pcb)" />
        <circle cx="62" cy="660" r="10" fill="#d8b45a" />
        <circle cx="798" cy="124" r="10" fill="#d8b45a" />

        <rect x="150" y="150" width="626" height="222" rx="6" fill="url(#bezel)" />
        <rect x="160" y="160" width="606" height="202" rx="4" fill="#15171c" />
        <path d="M776 178 L812 214 L812 308 L776 344 Z" fill="url(#led)" opacity="0.9" />
        <rect x="160" y="372" width="606" height="42" fill="#0f1013" />
        {Array.from({ length: 16 }, (_, k) => (
          <rect key={k} x={316 + k * 18} y="400" width="11" height="22" rx="2" fill="#d4d7dc" />
        ))}

        <rect x="58" y="148" width="74" height="74" rx="6" fill="#d9dce1" />
        <circle cx="95" cy="185" r="24" fill="#18191c" />
        <circle cx="88" cy="178" r="8" fill="rgba(255,255,255,0.18)" />

        <rect x="40" y="440" width="104" height="96" rx="4" fill="#1b1c20" />
        <rect x="22" y="468" width="24" height="40" rx="4" fill="#141518" />
        <rect x="70" y="446" width="36" height="16" fill="#c99a2e" />

        <Part x={176} y={442} label="R1" />
        <Part x={214} y={442} label="D2" dark />
        <Part x={252} y={442} label="D1" dark />
        <Part x={290} y={442} label="C2" />
        <Part x={328} y={442} label="C4" />
        <Part x={366} y={442} label="R3" dark />
        <Part x={404} y={442} label="R2" dark />
        <Part x={470} y={442} label="C10" />
        <Part x={508} y={442} label="C8" />
        <Part x={556} y={442} label="C9" />
        <g>
          {[0, 1, 2, 3].map((k) => (
            <g key={k}>
              <rect x={632 + k * 18} y="418" width="9" height="14" fill="#c9ccd1" />
              <rect x={632 + k * 18} y="486" width="9" height="14" fill="#c9ccd1" />
            </g>
          ))}
          <rect x="624" y="430" width="78" height="58" rx="3" fill="#202125" />
          <circle cx="634" cy="440" r="3" fill="#3a3b40" />
          <text x="663" y="514" className={styles.silk} textAnchor="middle">U1</text>
        </g>

        <rect x="214" y="540" width="488" height="108" rx="10" fill="#141518" />
        <rect x="230" y="556" width="440" height="76" rx="30" fill="url(#battery)" />
        <rect x="614" y="556" width="56" height="76" rx="20" fill="url(#batteryCap)" />
        <rect x="670" y="580" width="14" height="28" rx="4" fill="#c99a2e" />
        <text x="350" y="602" className={styles.cell}>AAA 1.2V</text>

        <rect x="716" y="540" width="62" height="62" rx="8" fill="#2b2d33" />
        <text x="747" y="578" className={styles.inductor} textAnchor="middle">470</text>

        <text x="52" y="578" className={styles.brand}>Tagsu.io</text>
        <g fill="#d8b45a">
          {[0, 1, 2, 3].map((k) => <rect key={k} x={74 + k * 22} y={k % 2 ? 612 : 600} width="14" height="24" rx="2" />)}
        </g>

        <rect x="6" y="6" width={W - 12} height={H - 12} rx="34" fill="url(#acrylic)" opacity="0.35" />
        <rect x="246" y="30" width="140" height="34" rx="17" fill="rgba(10,16,40,0.18)" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" />
        <rect x="474" y="30" width="140" height="34" rx="17" fill="rgba(10,16,40,0.18)" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" />
        <Screw x={62} y={62} />
        <Screw x={798} y={62} />
        <Screw x={62} y={678} />
        <Screw x={798} y={678} />
      </svg>

      <div
        className={styles.glass}
        style={{ left: `${(GLASS.x / W) * 100}%`, top: `${(GLASS.y / H) * 100}%`, width: `${(GLASS.w / W) * 100}%` }}
      >
        {children}
      </div>
    </div>
  );
}
