import { useId } from "react";

/**
 * Sent's brand mark.
 *
 * An "S" drawn as a single continuous stroke, then severed by a clean angled
 * channel: the circuit breaker doing its job to the logo itself. The cut is
 * masked rather than drawn as two paths, so the gap stays a constant width and
 * reads as deliberate at every size, down to a 16px favicon.
 *
 * Geometry lives in a 32x32 box. Gap 3.6 at -34 degrees was tuned against
 * 16 / 24 / 32px renders: wide enough to read as a break, tight enough that
 * the glyph still resolves as an S when it is 16 pixels tall.
 */

const S_PATH =
  "M22.8 10.6c-1.3-3-4.3-4.2-6.8-4.2-3.5 0-6.2 1.9-6.2 4.8 0 2.2 1.5 3.5 " +
  "3.8 4.4l4.6 1.8c2.4 1 3.9 2.4 3.9 4.6 0 3.1-2.8 4.8-6.3 4.8-2.7 0-5.6-1.2-6.9-3.9";

const GAP = 3.6;
const ANGLE = -34;

/** The full lockup tile: gradient square with the severed S knocked out. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Sent">
      <defs>
        <linearGradient id={`sg-${uid}`} x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="#00F5A0" />
          <stop offset="1" stopColor="#00D2FF" />
        </linearGradient>
        <mask id={`sm-${uid}`}>
          <rect width="32" height="32" fill="#fff" />
          <rect
            x="-10"
            y={16 - GAP / 2}
            width="52"
            height={GAP}
            fill="#000"
            transform={`rotate(${ANGLE} 16 16)`}
          />
        </mask>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#sg-${uid})`} />
      <path
        d={S_PATH}
        stroke="#07090D"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
        mask={`url(#sm-${uid})`}
      />
    </svg>
  );
}

/** Glyph only, gradient stroke on transparent. For dense or monochrome spots. */
export function LogoGlyph({ className = "h-6 w-6" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Sent">
      <defs>
        <linearGradient id={`gg-${uid}`} x1="4" y1="4" x2="28" y2="28">
          <stop offset="0" stopColor="#00F5A0" />
          <stop offset="1" stopColor="#00D2FF" />
        </linearGradient>
        <mask id={`gm-${uid}`}>
          <rect width="32" height="32" fill="#fff" />
          <rect
            x="-10"
            y={16 - GAP / 2}
            width="52"
            height={GAP}
            fill="#000"
            transform={`rotate(${ANGLE} 16 16)`}
          />
        </mask>
      </defs>
      <path
        d={S_PATH}
        stroke={`url(#gg-${uid})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        fill="none"
        mask={`url(#gm-${uid})`}
      />
    </svg>
  );
}
