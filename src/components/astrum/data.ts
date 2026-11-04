/** Thinned ASTRUM replay, as written by scripts/build-astrum-assets.mjs. */
export interface ReplayData {
  kind: "astrum-site-replay";
  version: 1;
  note: string;
  rate_hz: number;
  duration: number;
  bounds: { e: [number, number]; n: [number, number]; u: [number, number] };
  aircraft: { id: number; kind: string }[];
  t: number[];
  tracks: Record<string, Partial<Record<Channel, number[]>>>;
  events: { t: number; id: number; by?: number; kind: "hit" | "kill" }[];
  summary?: {
    t_inverted: number;
    t_nose_low: number;
    t_level: number;
    min_pitch_deg: number;
    alt_loss_m: number;
    tas_start_mps: number;
    tas_max_mps: number;
    nz_max: number;
  };
}

export type Channel = "e" | "n" | "u" | "psi" | "phi" | "theta" | "tas" | "nz" | "health";

export interface CurveData {
  kind: "astrum-site-curve";
  filler?: string;
  x_label: string;
  y_label: string;
  x: number[];
  y: number[];
}

export interface CourseData {
  kind: "astrum-site-course";
  filler?: string;
  opening_m: number;
  reach_m: number;
  clearance_m: number;
  clearance_crabbed_m: number;
  gates: { x: number; y: number; yaw: number }[];
  line: [number, number][];
}

const cache = new Map<string, Promise<unknown>>();

/** Fetches a file under public/ once per page; `src` is root-relative, e.g. "/projects/astrum/x.json". */
export function loadAsset<T>(src: string): Promise<T> {
  let p = cache.get(src);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`).then((r) => {
      if (!r.ok) throw new Error(`${src}: ${r.status}`);
      return r.json();
    });
    cache.set(src, p);
  }
  return p as Promise<T>;
}

/** Index of the last sample at or before `t`, and how far it is toward the next. */
export function sampleAt(t: number[], at: number): [number, number] {
  let lo = 0, hi = t.length - 1;
  if (at <= t[0]) return [0, 0];
  if (at >= t[hi]) return [hi, 0];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= at) lo = mid;
    else hi = mid;
  }
  return [lo, (at - t[lo]) / (t[lo + 1] - t[lo])];
}

/** Reads the theme's colour tokens; the canvas can't use CSS variables directly. */
export function themeColors() {
  const s = getComputedStyle(document.documentElement), v = (n: string) => s.getPropertyValue(n).trim();
  return { ink: v("--ink"), dim: v("--ink-dim"), faint: v("--ink-faint"), line: v("--line"), strong: v("--line-strong"), select: v("--select"), route: v("--route"), caution: v("--caution"), panel: v("--panel") };
}
