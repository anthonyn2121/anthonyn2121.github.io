/**
 * Topographic contour generator: builds a smooth height field from Gaussian
 * hills and periodic ripples, then traces iso-lines with marching squares.
 * With `periodic: true` the field wraps, so the output tiles seamlessly.
 */

export interface ContourLine {
  d: string;
  /** Every fifth line is an index contour, drawn heavier, as on real charts. */
  index: boolean;
}

export interface TopoOptions {
  width: number;
  height: number;
  seed: number;
  cell?: number;
  hills?: number;
  levels?: number;
  periodic?: boolean;
}

export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Edge ids: 0 top, 1 right, 2 bottom, 3 left. Pairs of edges per marching-squares case.
const CASES: number[][] = [
  [], [3, 2], [2, 1], [3, 1], [0, 1], [0, 1, 3, 2], [0, 2], [0, 3],
  [0, 3], [0, 2], [3, 0, 1, 2], [0, 1], [3, 1], [1, 2], [3, 2], [],
];

export function contours(opts: TopoOptions): ContourLine[] {
  const { width, height, seed, cell = 8, hills = 7, levels = 14, periodic = false } = opts;
  const rand = mulberry32(seed);
  const nx = Math.ceil(width / cell);
  const ny = Math.ceil(height / cell);
  const cw = width / nx;
  const ch = height / ny;

  const hillList = Array.from({ length: hills }, () => ({
    x: rand() * width,
    y: rand() * height,
    sx: (0.08 + rand() * 0.16) * width,
    sy: (0.08 + rand() * 0.16) * height,
    a: 0.5 + rand() * 0.8,
  }));
  const ripples = Array.from({ length: 3 }, () => ({
    kx: 1 + Math.floor(rand() * 3),
    ky: 1 + Math.floor(rand() * 3),
    p: rand() * Math.PI * 2,
    a: 0.08 + rand() * 0.1,
  }));

  const wrap = (d: number, span: number) => {
    if (!periodic) return d;
    d %= span;
    if (d > span / 2) d -= span;
    if (d < -span / 2) d += span;
    return d;
  };

  const field = new Float32Array((nx + 1) * (ny + 1));
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = i * cw;
      const y = j * ch;
      let v = 0;
      for (const h of hillList) {
        const dx = wrap(x - h.x, width) / h.sx;
        const dy = wrap(y - h.y, height) / h.sy;
        v += h.a * Math.exp(-(dx * dx + dy * dy) / 2);
      }
      for (const r of ripples) {
        v += r.a * Math.sin((2 * Math.PI * r.kx * x) / width + (2 * Math.PI * r.ky * y) / height + r.p);
      }
      field[j * (nx + 1) + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  const at = (i: number, j: number) => field[j * (nx + 1) + i];
  const out: ContourLine[] = [];

  for (let l = 1; l <= levels; l++) {
    const level = min + ((max - min) * l) / (levels + 1);
    const pts = new Map<number, [number, number]>();
    const adj = new Map<number, number[]>();
    const segs: [number, number][] = [];

    const edgeKey = (i: number, j: number, e: number) => {
      // Horizontal edges are shared by vertically adjacent cells, vertical by horizontal neighbours.
      if (e === 0) return (j * (nx + 1) + i) * 2;
      if (e === 2) return ((j + 1) * (nx + 1) + i) * 2;
      if (e === 3) return (j * (nx + 1) + i) * 2 + 1;
      return (j * (nx + 1) + i + 1) * 2 + 1;
    };
    const edgePoint = (i: number, j: number, e: number): [number, number] => {
      const v0 = at(i, j), v1 = at(i + 1, j), v2 = at(i + 1, j + 1), v3 = at(i, j + 1);
      switch (e) {
        case 0: return [(i + (level - v0) / (v1 - v0)) * cw, j * ch];
        case 1: return [(i + 1) * cw, (j + (level - v1) / (v2 - v1)) * ch];
        case 2: return [(i + (level - v3) / (v2 - v3)) * cw, (j + 1) * ch];
        default: return [i * cw, (j + (level - v0) / (v3 - v0)) * ch];
      }
    };

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx =
          (at(i, j) > level ? 8 : 0) |
          (at(i + 1, j) > level ? 4 : 0) |
          (at(i + 1, j + 1) > level ? 2 : 0) |
          (at(i, j + 1) > level ? 1 : 0);
        const edges = CASES[idx];
        for (let k = 0; k < edges.length; k += 2) {
          const a = edgeKey(i, j, edges[k]);
          const b = edgeKey(i, j, edges[k + 1]);
          if (!pts.has(a)) pts.set(a, edgePoint(i, j, edges[k]));
          if (!pts.has(b)) pts.set(b, edgePoint(i, j, edges[k + 1]));
          const s = segs.length;
          segs.push([a, b]);
          (adj.get(a) ?? adj.set(a, []).get(a)!).push(s);
          (adj.get(b) ?? adj.set(b, []).get(b)!).push(s);
        }
      }
    }

    // Join segments into polylines by walking shared edge keys.
    const used = new Uint8Array(segs.length);
    const walk = (start: number, from: number, chain: number[]) => {
      let key = from;
      let seg = start;
      for (;;) {
        const next = (adj.get(key) ?? []).find((s) => s !== seg && !used[s]);
        if (next === undefined) return;
        used[next] = 1;
        const [a, b] = segs[next];
        key = a === key ? b : a;
        chain.push(key);
        seg = next;
      }
    };
    for (let s = 0; s < segs.length; s++) {
      if (used[s]) continue;
      used[s] = 1;
      const [a, b] = segs[s];
      const fwd: number[] = [b];
      walk(s, b, fwd);
      const back: number[] = [];
      walk(s, a, back);
      const chain = [...back.reverse(), a, ...fwd];
      if (chain.length < 4) continue;
      out.push({ d: smooth(chain.map((k) => pts.get(k)!)), index: l % 5 === 0 });
    }
  }
  return out;
}

/** Midpoint quadratic smoothing for a polyline. */
function smooth(p: [number, number][]): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    d += `Q${f(p[i][0])} ${f(p[i][1])} ${f(mx)} ${f(my)}`;
  }
  const last = p[p.length - 1];
  return d + `L${f(last[0])} ${f(last[1])}`;
}

/** A seamless SVG tile as a data URL, for use as a CSS mask. */
export function contourTile(size: number, seed: number): string {
  const lines = contours({ width: size, height: size, seed, cell: 9, hills: 9, levels: 16, periodic: true });
  const thin = lines.filter((l) => !l.index).map((l) => l.d).join("");
  const thick = lines.filter((l) => l.index).map((l) => l.d).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${thin}" stroke-width="1"/><path d="${thick}" stroke-width="1.8"/></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
