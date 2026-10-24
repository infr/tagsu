const PATHS = {
  up: <path d="M4 10l4-4 4 4" />,
  down: <path d="M4 6l4 4 4-4" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="7" height="7" rx="1" />
      <path d="M10.5 3.5h-6a1 1 0 0 0-1 1v6" />
    </>
  ),
  trash: <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" />,
  left: <path d="M3 4h10M3 7h6M3 10h10M3 13h6" />,
  center: <path d="M3 4h10M5 7h6M3 10h10M5 13h6" />,
  right: <path d="M3 4h10M7 7h6M3 10h10M7 13h6" />,
  plus: <path d="M8 3v10M3 8h10" />,
  chevron: <path d="M4.5 6.5L8 10l3.5-3.5" />,
  info: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.5v3M8 5.25v.01" />
    </>
  ),
  play: <path d="M5 3.5l7 4.5-7 4.5z" />,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" />,
  speaker: (
    <>
      <path d="M3 6v4h2.5L9 13V3L5.5 6H3z" />
      <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
