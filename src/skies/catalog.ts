import { toVec, type Vec } from "./astro";

/** The shape of public/skies/sky.json, written by scripts/build-sky-data.mjs. Positions in degrees, J2000. */
export interface SkyCatalog {
  /** [RA, Dec, magnitude, B−V colour] per star, brightest first. */
  stars: number[];
  /** Star index → [proper name, designation such as "α Ori"]. Either may be empty. */
  names: Record<string, [string, string]>;
  constellations: ConstellationData[];
  /** [RA, Dec, level 1–5] samples of the Milky Way, on a grid `milkyWayStep` degrees apart. */
  milkyWay: number[];
  milkyWayStep: number;
}

export interface ConstellationData {
  /** IAU abbreviation, e.g. "Ori". */
  id: string;
  name: string;
  /** English meaning, e.g. "Hunter". */
  meaning: string;
  /** 1 for the biggest and brightest, 3 for the faintest. Decides at which zoom the name shows. */
  rank: number;
  label: [number, number];
  center: [number, number];
  /** Degrees from the centre to the farthest boundary point. */
  radius: number;
  /** Declination range of the boundary. */
  dec: [number, number];
  /** Stick-figure polylines as flat [RA, Dec, …]. */
  lines: number[][];
  /** IAU boundary rings as flat [RA, Dec, …]. */
  bounds: number[][];
  brightest: { name: string; desig: string; mag: number } | null;
}

export interface Constellation extends Omit<ConstellationData, "lines" | "bounds"> {
  centerVec: Vec;
  labelVec: Vec;
  /** Polylines and rings as flat unit vectors [x, y, z, …]. */
  lines: Float64Array[];
  bounds: Float64Array[];
}

export interface Sky {
  count: number;
  /** Unit vectors [x, y, z, …]. */
  starVec: Float64Array;
  starMag: Float32Array;
  /** Index into STAR_TINTS, from the star's B−V colour. */
  starTint: Uint8Array;
  names: Map<number, [string, string]>;
  constellations: Constellation[];
  byId: Map<string, Constellation>;
  mwVec: Float64Array;
  mwLevel: Uint8Array;
  mwStep: number;
}

/** Star colours by B−V, from hot blue-white to cool orange, softened toward white so the sky stays calm. */
export const STAR_TINTS = ["#c6d4ff", "#dbe4ff", "#f1f3ff", "#fff8ef", "#ffe9d2", "#ffd7b0", "#ffc391"];
const TINT_BREAKS = [-0.05, 0.15, 0.4, 0.65, 0.95, 1.35];

function vectors(flat: number[]) {
  const out = new Float64Array((flat.length / 2) * 3);
  for (let i = 0, j = 0; i < flat.length; i += 2, j += 3) out.set(toVec(flat[i], flat[i + 1]), j);
  return out;
}

export async function loadSky(): Promise<Sky | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}skies/sky.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as SkyCatalog;

    const count = data.stars.length / 4;
    const starVec = new Float64Array(count * 3);
    const starMag = new Float32Array(count);
    const starTint = new Uint8Array(count);
    for (let i = 0; i < count; i++) {
      const [ra, dec, mag, bv] = data.stars.slice(i * 4, i * 4 + 4);
      starVec.set(toVec(ra, dec), i * 3);
      starMag[i] = mag;
      let t = 0;
      while (t < TINT_BREAKS.length && bv > TINT_BREAKS[t]) t++;
      starTint[i] = t;
    }

    const constellations = data.constellations.map((c): Constellation => ({
      ...c,
      centerVec: toVec(...c.center),
      labelVec: toVec(...c.label),
      lines: c.lines.map(vectors),
      bounds: c.bounds.map(vectors),
    }));

    const mwCount = data.milkyWay.length / 3;
    const mwVec = new Float64Array(mwCount * 3);
    const mwLevel = new Uint8Array(mwCount);
    for (let i = 0; i < mwCount; i++) {
      mwVec.set(toVec(data.milkyWay[i * 3], data.milkyWay[i * 3 + 1]), i * 3);
      mwLevel[i] = data.milkyWay[i * 3 + 2];
    }

    return {
      count,
      starVec,
      starMag,
      starTint,
      names: new Map(Object.entries(data.names).map(([k, v]) => [Number(k), v])),
      constellations,
      byId: new Map(constellations.map((c) => [c.id, c])),
      mwVec,
      mwLevel,
      mwStep: data.milkyWayStep,
    };
  } catch {
    return null;
  }
}
