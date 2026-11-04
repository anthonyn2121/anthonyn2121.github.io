import type { ReactElement, SVGProps } from "react";
import type { UasGroup } from "../data/profile";

/**
 * Generic top-down silhouettes, nose up, centred on (0,0) in a 100 × 100 box.
 * They suggest each group's typical airframe without copying any real aircraft.
 */
const SHAPES: Record<UasGroup, ReactElement> = {
  1: (
    <>
      <path d="M-26 -26L26 26M26 -26L-26 26" strokeWidth={4} />
      <circle cx={-26} cy={-26} r={14} />
      <circle cx={26} cy={-26} r={14} />
      <circle cx={-26} cy={26} r={14} />
      <circle cx={26} cy={26} r={14} />
      <rect x={-9} y={-11} width={18} height={22} rx={4} />
    </>
  ),
  2: (
    <>
      <path d="M0 -34C5 -34 6 -24 6 -10L44 6L44 12L6 6L5 22L-5 22L-6 6L-44 12L-44 6L-6 -10C-6 -24 -5 -34 0 -34Z" />
      <path d="M-9 26L9 26" />
    </>
  ),
  3: (
    <>
      <path d="M-46 -12L46 -12L46 -2L-46 -2Z" />
      <path d="M-17 -2L-17 32M17 -2L17 32" strokeWidth={3} />
      <path d="M-21 30L21 30L21 36L-21 36Z" />
      <path d="M0 -36C6 -36 7 -28 7 -16L7 6L-7 6L-7 -16C-7 -28 -6 -36 0 -36Z" />
      <path d="M-7 10L7 10" />
    </>
  ),
  4: (
    <>
      <path d="M-48 -6L-6 -10L6 -10L48 -6L48 -1L6 2L-6 2L-48 -1Z" />
      <path d="M-3 28L-18 42L-15 44L0 34L15 44L18 42L3 28Z" />
      <path d="M0 -42C5 -42 6 -34 6 -24L4 34L-4 34L-6 -24C-6 -34 -5 -42 0 -42Z" />
    </>
  ),
  5: (
    <>
      <path d="M-50 0L-8 -8L8 -8L50 0L50 4L8 0L-8 0L-50 4Z" />
      <path d="M-4 28L-20 40L-17 42L0 33L17 42L20 40L4 28Z" />
      <path d="M0 -40C9 -40 10 -30 9 -16L5 30L-5 30L-9 -16C-10 -30 -9 -40 0 -40Z" />
      <ellipse cx={0} cy={18} rx={6} ry={10} />
    </>
  ),
};

/** Relative display size, so the roster reads small-to-large like the real classes. */
export const GROUP_SCALE: Record<UasGroup, number> = { 1: 0.5, 2: 0.62, 3: 0.76, 4: 0.9, 5: 1 };

interface ShapeProps extends SVGProps<SVGGElement> {
  group: UasGroup;
}

/** The silhouette as an SVG group, for embedding inside another SVG (e.g. the map). */
export function AircraftShape({ group, ...rest }: ShapeProps) {
  return (
    <g
      fill="var(--silhouette-fill)"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      {...rest}
    >
      {SHAPES[group]}
    </g>
  );
}

/** A standalone silhouette icon. */
export function AircraftIcon({ group, size = 96, className }: { group: UasGroup; size?: number; className?: string }) {
  return (
    <svg
      className={`aircraft-icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="-52 -52 104 104"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      <AircraftShape group={group} />
    </svg>
  );
}
