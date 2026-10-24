"use client";

import dynamic from "next/dynamic";

// The editor reads saved screens from localStorage and drives Web Audio, so it renders on the client only.
export const TagsuEditor = dynamic(() => import("./components/Editor").then((m) => m.Editor), { ssr: false });

export const TagsuBadge = dynamic(() => import("./components/BadgeEmbed").then((m) => m.BadgeEmbed), { ssr: false });
