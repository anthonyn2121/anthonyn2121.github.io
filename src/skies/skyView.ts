/**
 * The sky chart's canvas renderer and interaction. A planetarium-style stereographic projection:
 * you look up from inside the celestial sphere with north at the top, so east is on the left.
 * Kept free of React so the frame loop never re-renders components.
 */

import type { Figure } from "../data/figures";
import {
  altAz,
  angleBetween,
  DEG,
  frameAt,
  fromGnomonic,
  horizonFrame,
  ringContains,
  slerp,
  toRaDec,
  toVec,
  type Frame,
  type Horizon,
  type Vec,
} from "./astro";
import { STAR_TINTS, type Constellation, type Sky } from "./catalog";

const MIN_HALF = 6;
const MAX_HALF = 80;
/** Wide enough that the horizon shows at the corners, like lying back under a dome. */
const HOME_HALF = 72;
const ALPHAS = [1, 0.85, 0.65, 0.45];
const MW_ALPHA = [0, 0.12, 0.2, 0.28, 0.36, 0.44];
const OBLIQUITY = 23.4393 * DEG;

interface Palette {
  bg: string;
  bgGlow: string;
  star: string;
  line: string;
  lineFeatured: string;
  select: string;
  bound: string;
  grid: string;
  ecliptic: string;
  mw: string;
  figure: string;
  label: string;
  labelFeatured: string;
  ground: string;
  horizon: string;
  halo: string;
}

const PALETTE_VARS: Record<keyof Palette, string> = {
  bg: "--sky-bg",
  bgGlow: "--sky-bg-glow",
  star: "--sky-star",
  line: "--sky-line",
  lineFeatured: "--sky-line-featured",
  select: "--sky-select",
  bound: "--sky-bound",
  grid: "--sky-grid",
  ecliptic: "--sky-ecliptic",
  mw: "--sky-mw",
  figure: "--sky-figure",
  label: "--sky-label",
  labelFeatured: "--sky-label-featured",
  ground: "--sky-ground",
  horizon: "--sky-horizon",
  halo: "--sky-halo",
};

export interface ClearRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface SkyViewOptions {
  canvas: HTMLCanvasElement;
  sky: Sky;
  featured: ReadonlySet<string>;
  location: { lat: number; lon: number };
  /** Moved to wherever the projection centre is. */
  crosshair: HTMLElement;
  onSelect: (id: string) => void;
  /** The constellation under the crosshair changed. */
  onCenter: (c: Constellation | null) => void;
  /** Field of view in degrees, across the shorter side. */
  onFov: (deg: number) => void;
  /** RA and Dec under the pointer, or under the crosshair when the pointer is elsewhere. */
  onCursor: (ra: number, dec: number) => void;
}

export interface SkyView {
  select: (id: string | null, figure: Figure | undefined) => void;
  setNight: (night: boolean) => void;
  setHorizon: (on: boolean) => void;
  setClear: (r: ClearRect) => void;
  zoom: (factor: number) => void;
  /** Pan by a fraction of the field of view. */
  nudge: (dx: number, dy: number) => void;
  overhead: () => void;
  selectCenter: () => void;
  /** The reticle cursor's lock target: the star near a pointer position, in client coordinates. */
  starBox: (clientX: number, clientY: number) => ClearRect | null;
  destroy: () => void;
}

interface FigureState {
  id: string;
  figure: Figure;
  img: HTMLImageElement | null;
  tinted: HTMLCanvasElement | null;
  alpha: number;
  target: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A copy of a white alpha mask, filled with one colour. */
function tinted(img: HTMLImageElement, color: string, into = document.createElement("canvas")) {
  into.width = img.naturalWidth;
  into.height = img.naturalHeight;
  const g = into.getContext("2d")!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, into.width, into.height);
  return into;
}

/** Great circles and small circles for the coordinate grid and the ecliptic, as flat unit vectors. */
function guides() {
  const grid: Float64Array[] = [];
  for (let ra = 0; ra < 360; ra += 15) {
    const pts: number[] = [];
    for (let dec = -80; dec <= 80; dec += 2) pts.push(...toVec(ra, dec));
    grid.push(Float64Array.from(pts));
  }
  for (let dec = -75; dec <= 75; dec += 15) {
    const pts: number[] = [];
    for (let ra = 0; ra <= 360; ra += 2) pts.push(...toVec(ra, dec));
    grid.push(Float64Array.from(pts));
  }
  const ecl: number[] = [];
  for (let l = 0; l <= 360; l += 2) {
    const L = l * DEG;
    ecl.push(Math.cos(L), Math.sin(L) * Math.cos(OBLIQUITY), Math.sin(L) * Math.sin(OBLIQUITY));
  }
  return { grid, ecliptic: Float64Array.from(ecl) };
}

export function createSkyView(o: SkyViewOptions): SkyView {
  const { canvas, sky } = o;
  const ctx = canvas.getContext("2d")!;
  const mwCanvas = document.createElement("canvas");
  const mwCtx = mwCanvas.getContext("2d")!;
  const { grid, ecliptic } = guides();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Stars grouped by tint and brightness, so each frame needs a few dozen fills, not thousands.
  const buckets: number[][] = Array.from({ length: STAR_TINTS.length * ALPHAS.length }, () => []);
  for (let i = 0; i < sky.count; i++) {
    const m = sky.starMag[i];
    buckets[sky.starTint[i] * ALPHAS.length + (m < 3 ? 0 : m < 4 ? 1 : m < 5 ? 2 : 3)].push(i);
  }
  const sx = new Float32Array(sky.count);
  const sy = new Float32Array(sky.count);
  const sr = new Float32Array(sky.count);
  const vis = new Uint8Array(sky.count);

  let w = 0;
  let h = 0;
  let dpr = 1;
  let night = true;
  let horizonOn = true;
  let pal = readPalette();
  // The theme attribute changes after React effects run, so re-read colours on the next frame.
  let paletteStale = false;

  // Start looking straight up from your home location, right now.
  let [ra0, dec0] = toRaDec(horizonFrame(new Date(), o.location.lat, o.location.lon).zenith);
  let half = HOME_HALF;
  let cx = 0;
  let cy = 0;
  let clear: ClearRect | null = null;

  // Per-frame projection state.
  let f: Frame = frameAt(ra0, dec0);
  let scale = 1;
  let zMin = 0;
  let PX = 0;
  let PY = 0;

  let selected: Constellation | null = null;
  let hovered: Constellation | null = null;
  let hoverStar = -1;
  let centerC: Constellation | null | undefined;
  let lastFov = -1;
  const figs = new Map<string, FigureState>();

  let fly: { from: Vec; to: Vec; half0: number; half1: number; bump: number; t0: number; dur: number } | null = null;
  /** A selection made before the chart has a size (a deep link) waits for one before flying. */
  let pendingFit = false;
  let raf = 0;
  let lastFrame = 0;

  function readPalette(): Palette {
    const cs = getComputedStyle(canvas);
    const out = {} as Palette;
    for (const k of Object.keys(PALETTE_VARS) as (keyof Palette)[])
      out[k] = cs.getPropertyValue(PALETTE_VARS[k]).trim();
    return out;
  }

  const invalidate = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  // ─── Projection ────────────────────────────────────────────────────────

  function setup() {
    f = frameAt(ra0, dec0);
    scale = Math.min(w, h) / 2 / (2 * Math.tan((half / 2) * DEG));
    const corner = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(w - cx, cy),
      Math.hypot(cx, h - cy),
      Math.hypot(w - cx, h - cy),
    );
    const reach = Math.min(150, (2 * Math.atan(corner / (2 * scale))) / DEG + 3);
    zMin = Math.cos(reach * DEG);
  }

  /** Projects a unit vector into PX/PY. Returns false when it's outside the visible cap. */
  function proj(x: number, y: number, z: number, cull = true) {
    const zz = x * f.c[0] + y * f.c[1] + z * f.c[2];
    if (cull ? zz < zMin : zz < -0.995) return false;
    const k = (2 / (1 + zz)) * scale;
    PX = cx - k * (x * f.e[0] + y * f.e[1] + z * f.e[2]);
    PY = cy - k * (x * f.n[0] + y * f.n[1] + z * f.n[2]);
    return true;
  }

  function unproject(px: number, py: number): Vec {
    const X = (cx - px) / scale;
    const Y = (cy - py) / scale;
    const r2 = X * X + Y * Y;
    const z = (4 - r2) / (4 + r2);
    const k = (1 + z) / 2;
    return [0, 1, 2].map((i) => k * X * f.e[i] + k * Y * f.n[i] + z * f.c[i]) as Vec;
  }

  function constellationAt(p: Vec) {
    const pf = frameAt(...toRaDec(p));
    for (const c of sky.constellations) {
      if (angleBetween(p, c.centerVec) > c.radius + 0.5) continue;
      if (c.bounds.some((ring) => ringContains(ring, p, pf))) return c;
    }
    return null;
  }

  /** Field of view that fits a constellation inside the clear area. */
  function fitHalf(c: Constellation) {
    const clearMin = clear ? Math.min(clear.width, clear.height) : Math.min(w, h);
    const want = Math.tan(((c.radius * 1.2) / 2) * DEG) * (Math.min(w, h) / Math.max(clearMin, 120));
    return clamp((2 * Math.atan(want)) / DEG, MIN_HALF * 2, 70);
  }

  // ─── Drawing ───────────────────────────────────────────────────────────

  function polyline(v: Float64Array) {
    let pen = false;
    for (let i = 0; i < v.length; i += 3) {
      if (proj(v[i], v[i + 1], v[i + 2])) {
        if (pen) ctx.lineTo(PX, PY);
        else ctx.moveTo(PX, PY);
        pen = true;
      } else pen = false;
    }
  }

  function ring(v: Float64Array) {
    polyline(v);
    if (proj(v[0], v[1], v[2])) ctx.lineTo(PX, PY);
  }

  function drawBackground() {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.6);
    g.addColorStop(0, pal.bgGlow);
    g.addColorStop(1, pal.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawMilkyWay() {
    // Paint the samples small, blur them, then scale up: a soft band for very little work.
    const s = 4;
    const mw = Math.ceil(w / s);
    const mh = Math.ceil(h / s);
    if (mwCanvas.width !== mw || mwCanvas.height !== mh) {
      mwCanvas.width = mw;
      mwCanvas.height = mh;
    }
    mwCtx.clearRect(0, 0, mw, mh);
    mwCtx.fillStyle = pal.mw;
    const step = sky.mwStep * DEG * scale;
    for (let level = 1; level <= 5; level++) {
      mwCtx.globalAlpha = MW_ALPHA[level];
      mwCtx.beginPath();
      for (let i = 0; i < sky.mwLevel.length; i++) {
        if (sky.mwLevel[i] !== level) continue;
        const j = i * 3;
        const x = sky.mwVec[j];
        const y = sky.mwVec[j + 1];
        const z = sky.mwVec[j + 2];
        if (!proj(x, y, z)) continue;
        const zz = x * f.c[0] + y * f.c[1] + z * f.c[2];
        const size = (step * (2 / (1 + zz)) * 1.7) / s;
        mwCtx.rect(PX / s - size / 2, PY / s - size / 2, size, size);
      }
      mwCtx.fill();
    }
    mwCtx.globalAlpha = 1;
    ctx.save();
    ctx.filter = `blur(${Math.max(2, Math.min(10, step / 2))}px)`;
    ctx.globalAlpha = night ? 0.55 : 0.4;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mwCanvas, 0, 0, mw * s, mh * s);
    ctx.restore();
  }

  function drawGuides() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.grid;
    ctx.beginPath();
    for (const g of grid) polyline(g);
    ctx.stroke();
    ctx.strokeStyle = pal.ecliptic;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    polyline(ecliptic);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawFigure(fs: FigureState) {
    if (!fs.tinted) return;
    const F = fs.figure;
    const ff = frameAt(F.center[0], F.center[1]);
    const [a, b, c, d, e, g] = F.affine;
    const det = a * e - b * d;
    const N = 8;
    const pts: ([number, number, number, number] | null)[] = [];
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const px = (F.width * i) / N;
        const py = (F.height * j) / N;
        const xi = (e * (px - c) - b * (py - g)) / det;
        const eta = (a * (py - g) - d * (px - c)) / det;
        const v = fromGnomonic(ff, xi, eta);
        pts.push(proj(v[0], v[1], v[2]) ? [px, py, PX, PY] : null);
      }
    ctx.save();
    ctx.globalAlpha = fs.alpha * (night ? 0.6 : 0.72);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const p00 = pts[j * (N + 1) + i];
        const p10 = pts[j * (N + 1) + i + 1];
        const p01 = pts[(j + 1) * (N + 1) + i];
        const p11 = pts[(j + 1) * (N + 1) + i + 1];
        if (!p00 || !p10 || !p01 || !p11) continue;
        triangle(fs.tinted, p00, p10, p11);
        triangle(fs.tinted, p00, p11, p01);
      }
    ctx.restore();
  }

  /** Draws one textured triangle: clip to the screen triangle, then map the image triangle onto it. */
  function triangle(img: HTMLCanvasElement, s0: number[], s1: number[], s2: number[]) {
    const [u0, v0, x0, y0] = s0;
    const [u1, v1, x1, y1] = s1;
    const [u2, v2, x2, y2] = s2;
    const den = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (!den) return;
    const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / den;
    const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / den;
    const c = ((u1 - u0) * (x2 - x0) - (u2 - u0) * (x1 - x0)) / den;
    const d = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den;
    // Grow the clip a little so neighbouring triangles overlap instead of leaving hairline seams.
    const mx = (x0 + x1 + x2) / 3;
    const my = (y0 + y1 + y2) / 3;
    const grow = (x: number, y: number): [number, number] => {
      const l = Math.hypot(x - mx, y - my) || 1;
      return [x + ((x - mx) / l) * 0.7, y + ((y - my) / l) * 0.7];
    };
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...grow(x0, y0));
    ctx.lineTo(...grow(x1, y1));
    ctx.lineTo(...grow(x2, y2));
    ctx.clip();
    ctx.transform(a, b, c, d, x0 - a * u0 - c * v0, y0 - b * u0 - d * v0);
    const ul = Math.max(0, Math.floor(Math.min(u0, u1, u2)) - 1);
    const vt = Math.max(0, Math.floor(Math.min(v0, v1, v2)) - 1);
    const uw = Math.min(img.width, Math.ceil(Math.max(u0, u1, u2)) + 1) - ul;
    const vh = Math.min(img.height, Math.ceil(Math.max(v0, v1, v2)) + 1) - vt;
    if (uw > 0 && vh > 0) ctx.drawImage(img, ul, vt, uw, vh, ul, vt, uw, vh);
    ctx.restore();
  }

  function drawConstellations() {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.bound;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (const c of sky.constellations) if (c !== selected && c !== hovered) for (const r of c.bounds) ring(r);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const c of [hovered, selected]) {
      if (!c) continue;
      ctx.strokeStyle = c === selected ? pal.select : pal.label;
      ctx.globalAlpha = c === selected ? 0.6 : 0.45;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (const r of c.bounds) ring(r);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const c of sky.constellations)
      if (!o.featured.has(c.id) && c !== selected) for (const l of c.lines) polyline(l);
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = pal.lineFeatured;
    ctx.lineWidth = 1.4;
    if (night) {
      ctx.shadowColor = pal.lineFeatured;
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    for (const c of sky.constellations)
      if (o.featured.has(c.id) && c !== selected) for (const l of c.lines) polyline(l);
    ctx.stroke();
    if (selected) {
      ctx.strokeStyle = pal.select;
      ctx.lineWidth = 2.2;
      if (night) {
        ctx.shadowColor = pal.select;
        ctx.shadowBlur = 12;
      }
      ctx.beginPath();
      for (const l of selected.lines) polyline(l);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStars() {
    const boost = clamp((HOME_HALF / half) ** 0.35, 0.85, 1.9);
    const base = night ? 0.55 : 0.6;
    const per = night ? 0.42 : 0.5;
    for (let i = 0; i < sky.count; i++) {
      const j = i * 3;
      vis[i] = proj(sky.starVec[j], sky.starVec[j + 1], sky.starVec[j + 2]) ? 1 : 0;
      if (!vis[i]) continue;
      sx[i] = PX;
      sy[i] = PY;
      sr[i] = (base + Math.max(0, 5.8 - sky.starMag[i]) * per) * boost;
    }

    if (night) {
      // A soft halo around the brightest stars.
      for (let i = 0; i < sky.count && sky.starMag[i] < 1.6; i++) {
        if (!vis[i]) continue;
        const r = sr[i] * 5;
        const g = ctx.createRadialGradient(sx[i], sy[i], 0, sx[i], sy[i], r);
        g.addColorStop(0, STAR_TINTS[sky.starTint[i]]);
        g.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = g;
        ctx.fillRect(sx[i] - r, sy[i] - r, r * 2, r * 2);
      }
    } else {
      // Printed atlases knock the paper out around each star so lines don't run into it.
      ctx.strokeStyle = pal.bg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < sky.count && sky.starMag[i] < 4; i++) {
        if (!vis[i]) continue;
        ctx.moveTo(sx[i] + sr[i], sy[i]);
        ctx.arc(sx[i], sy[i], sr[i], 0, Math.PI * 2);
      }
      ctx.stroke();
    }

    buckets.forEach((list, k) => {
      if (!list.length) return;
      const tint = Math.floor(k / ALPHAS.length);
      const a = k % ALPHAS.length;
      ctx.globalAlpha = night ? ALPHAS[a] : Math.min(1, ALPHAS[a] + 0.2);
      ctx.fillStyle = night ? STAR_TINTS[tint] : pal.star;
      ctx.beginPath();
      for (const i of list) {
        if (!vis[i]) continue;
        ctx.moveTo(sx[i] + sr[i], sy[i]);
        ctx.arc(sx[i], sy[i], sr[i], 0, Math.PI * 2);
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /**
   * Shades the ground below the horizon. It goes under the stars and figures: this is a
   * whole-sky chart, so constellations that are down right now stay readable.
   */
  function drawGround(hz: Horizon, rim: Vec[]) {
    // Stereographic projection maps circles to circles, so the horizon is a circle on screen.
    // Fit it through three well-spread points and shade the side the ground is on.
    let best = 0;
    let bestZ = -2;
    rim.forEach((v, i) => {
      const z = v[0] * f.c[0] + v[1] * f.c[1] + v[2] * f.c[2];
      if (z > bestZ) {
        bestZ = z;
        best = i;
      }
    });
    const three: [number, number][] = [];
    for (const k of [0, 18, -18]) {
      const v = rim[(best + k + rim.length) % rim.length];
      if (proj(v[0], v[1], v[2], false)) three.push([PX, PY]);
    }
    const below = altAz(hz, best * 5, -20);
    if (three.length === 3 && proj(below[0], below[1], below[2], false)) {
      const [[x1, y1], [x2, y2], [x3, y3]] = three;
      const bx = PX;
      const by = PY;
      const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
      const ground = new Path2D();
      if (Math.abs(D) > 1e-6) {
        const s1 = x1 * x1 + y1 * y1;
        const s2 = x2 * x2 + y2 * y2;
        const s3 = x3 * x3 + y3 * y3;
        const ux = (s1 * (y2 - y3) + s2 * (y3 - y1) + s3 * (y1 - y2)) / D;
        const uy = (s1 * (x3 - x2) + s2 * (x1 - x3) + s3 * (x2 - x1)) / D;
        const R = Math.hypot(x1 - ux, y1 - uy);
        if (R < 1e6) {
          const groundInside = Math.hypot(bx - ux, by - uy) < R;
          if (!groundInside) ground.rect(0, 0, w, h);
          ground.moveTo(ux + R, uy);
          ground.arc(ux, uy, R, 0, Math.PI * 2, true);
          ctx.fillStyle = pal.ground;
          ctx.fill(ground, "evenodd");
        }
      }
    }
  }

  /** The horizon itself, the compass points, and the zenith. */
  function drawHorizon(hz: Horizon, rim: Vec[]) {
    ctx.strokeStyle = pal.horizon;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= rim.length; i++) {
      const v = rim[i % rim.length];
      if (proj(v[0], v[1], v[2])) {
        if (pen) ctx.lineTo(PX, PY);
        else ctx.moveTo(PX, PY);
        pen = true;
      } else pen = false;
    }
    ctx.stroke();

    ctx.font = "700 12px B612, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = pal.horizon;
    (["N", "E", "S", "W"] as const).forEach((label, i) => {
      const v = altAz(hz, i * 90, -3.5);
      if (proj(v[0], v[1], v[2])) halo(label, PX, PY);
    });
    // At the home view the crosshair already marks the zenith.
    if (proj(...hz.zenith) && Math.hypot(PX - cx, PY - cy) > 24) {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PX - 5, PY);
      ctx.lineTo(PX + 5, PY);
      ctx.moveTo(PX, PY - 5);
      ctx.lineTo(PX, PY + 5);
      ctx.stroke();
      ctx.font = "400 10px B612, sans-serif";
      halo("ZENITH", PX, PY + 13);
    }
  }

  function halo(text: string, x: number, y: number) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.halo;
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    ctx.restore();
    ctx.fillText(text, x, y);
  }

  function drawLabels() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rankLimit = half > 55 ? 1 : half > 30 ? 2 : 3;
    ctx.font = "700 11px B612, sans-serif";
    ctx.letterSpacing = "1.5px";
    for (const c of sky.constellations) {
      const feat = o.featured.has(c.id);
      if (!(feat || c.rank <= rankLimit || c === hovered || c === selected)) continue;
      if (!proj(...c.labelVec)) continue;
      ctx.fillStyle = c === selected ? pal.select : feat ? pal.labelFeatured : pal.label;
      halo(c.name.toUpperCase(), PX, PY);
    }
    ctx.letterSpacing = "0px";

    const magLimit = half > 50 ? 0.6 : half > 25 ? 1.6 : half > 12 ? 2.6 : 3.6;
    ctx.font = "400 11px B612, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = pal.label;
    for (let i = 0; i < sky.count && sky.starMag[i] <= magLimit; i++) {
      const name = sky.names.get(i)?.[0];
      if (!vis[i] || !name || i === hoverStar) continue;
      halo(name, sx[i] + sr[i] + 4, sy[i]);
    }

    if (hoverStar >= 0 && vis[hoverStar]) {
      const [name, desig] = sky.names.get(hoverStar) ?? ["", ""];
      const title = [name, desig].filter(Boolean).join("  ") || "Unnamed star";
      const x = sx[hoverStar] + sr[hoverStar] + 8;
      const y = sy[hoverStar];
      ctx.fillStyle = pal.select;
      ctx.font = "700 12px B612, sans-serif";
      halo(title, x, y - 7);
      ctx.font = "400 11px B612, sans-serif";
      ctx.fillStyle = pal.label;
      halo(`mag ${sky.starMag[hoverStar].toFixed(2)}`, x, y + 8);
    }
  }

  // ─── Frame loop ────────────────────────────────────────────────────────

  function frame(now: number) {
    raf = 0;
    if (!w || !h) return;
    if (paletteStale) {
      paletteStale = false;
      pal = readPalette();
      for (const fs of figs.values()) if (fs.img) fs.tinted = tinted(fs.img, pal.figure, fs.tinted ?? undefined);
    }
    const dt = lastFrame ? Math.min(64, now - lastFrame) : 16;
    lastFrame = now;
    let busy = false;

    if (fly) {
      const t = Math.min(1, (now - fly.t0) / fly.dur);
      const e = easeInOut(t);
      [ra0, dec0] = toRaDec(slerp(fly.from, fly.to, e));
      half =
        Math.exp(Math.log(fly.half0) + (Math.log(fly.half1) - Math.log(fly.half0)) * e) *
        (1 + fly.bump * Math.sin(Math.PI * e));
      if (t >= 1) fly = null;
      busy = true;
    }

    if (clear) {
      const tx = clear.left + clear.width / 2;
      const ty = clear.top + clear.height / 2;
      const k = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 90);
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
      if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) busy = true;
      else {
        cx = tx;
        cy = ty;
      }
    }

    for (const fs of figs.values()) {
      if (fs.alpha === 0 && fs.target === 0) {
        figs.delete(fs.id);
        continue;
      }
      if (fs.alpha === fs.target || !fs.tinted) continue;
      const step = reducedMotion.matches ? 1 : dt / 450;
      fs.alpha = fs.target > fs.alpha ? Math.min(fs.target, fs.alpha + step) : Math.max(fs.target, fs.alpha - step);
      busy = true;
    }

    setup();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hz = horizonOn ? horizonFrame(new Date(), o.location.lat, o.location.lon) : null;
    const rim: Vec[] = [];
    if (hz) for (let az = 0; az < 360; az += 5) rim.push(altAz(hz, az, 0));
    drawBackground();
    drawMilkyWay();
    drawGuides();
    if (hz) drawGround(hz, rim);
    for (const fs of figs.values()) drawFigure(fs);
    drawConstellations();
    drawStars();
    if (hz) drawHorizon(hz, rim);
    drawLabels();

    o.crosshair.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
    const fov = Math.round(half * 2);
    if (fov !== lastFov) {
      lastFov = fov;
      o.onFov(fov);
    }
    const center = constellationAt(f.c);
    if (center !== centerC) {
      centerC = center;
      o.onCenter(center);
    }
    if (!pointerInside) o.onCursor(ra0, dec0);

    if (busy) invalidate();
  }

  // ─── Sizing ────────────────────────────────────────────────────────────

  const ro = new ResizeObserver(([entry]) => {
    const first = !w;
    w = entry.contentRect.width;
    h = entry.contentRect.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (first && !clear) {
      cx = w / 2;
      cy = h / 2;
    }
    flyPending();
    invalidate();
  });
  ro.observe(canvas);

  // Keep the horizon and zenith in step with the turning sky.
  const tick = window.setInterval(invalidate, 20000);

  // ─── Interaction ───────────────────────────────────────────────────────

  function pan(dx: number, dy: number) {
    fly = null;
    ra0 = (((ra0 + dx / scale / Math.max(Math.cos(dec0 * DEG), 0.2) / DEG) % 360) + 360) % 360;
    dec0 = clamp(dec0 + dy / scale / DEG, -90, 90);
    invalidate();
  }

  function zoomAt(factor: number, px: number, py: number) {
    fly = null;
    const anchor = unproject(px, py);
    half = clamp(half * factor, MIN_HALF, MAX_HALF);
    setup();
    if (proj(anchor[0], anchor[1], anchor[2], false)) pan(px - PX, py - PY);
    invalidate();
  }

  function flyTo(to: Vec, half1: number) {
    const from = toVec(ra0, dec0);
    if (reducedMotion.matches) {
      [ra0, dec0] = toRaDec(to);
      half = half1;
      fly = null;
    } else {
      const dist = angleBetween(from, to);
      fly = {
        from,
        to,
        half0: half,
        half1,
        bump: clamp(dist / 140, 0, 0.6),
        t0: performance.now(),
        dur: clamp(500 + dist * 9, 600, 1700),
      };
    }
    invalidate();
  }

  function flyPending() {
    if (!pendingFit || !w || !clear || !selected) return;
    pendingFit = false;
    flyTo(selected.centerVec, fitHalf(selected));
  }

  function nearestStar(px: number, py: number, radius: number) {
    let best = -1;
    let bestD = radius * radius;
    for (let i = 0; i < sky.count && sky.starMag[i] <= 5.2; i++) {
      if (!vis[i]) continue;
      const d = (sx[i] - px) ** 2 + (sy[i] - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number; moved: boolean } | null = null;
  let pinch: { dist: number; half: number } | null = null;
  let pointerInside = false;

  const local = (e: PointerEvent | WheelEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function hover(x: number, y: number) {
    const p = unproject(x, y);
    const c = constellationAt(p);
    const s = nearestStar(x, y, 12);
    if (c !== hovered || s !== hoverStar) {
      hovered = c;
      hoverStar = s;
      invalidate();
    }
    o.onCursor(...toRaDec(p));
  }

  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) down = { ...p, t: performance.now(), moved: false };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), half };
      if (down) down.moved = true;
    }
  };

  const onMove = (e: PointerEvent) => {
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === "mouse") hover(p.x, p.y);
      return;
    }
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0) {
        const factor = (pinch.half * (pinch.dist / dist)) / half;
        zoomAt(factor, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      return;
    }
    if (down && !down.moved && Math.hypot(p.x - down.x, p.y - down.y) > 5) down.moved = true;
    if (down?.moved) pan(p.x - prev.x, p.y - prev.y);
  };

  const onUp = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0 && down && p) {
      if (!down.moved && performance.now() - down.t < 700) {
        const c = constellationAt(unproject(p.x, p.y));
        if (c) o.onSelect(c.id);
      }
      down = null;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(Math.exp(clamp(delta, -120, 120) * 0.0022), p.x, p.y);
  };

  const onEnter = () => {
    pointerInside = true;
  };
  const onLeave = () => {
    pointerInside = false;
    if (hovered || hoverStar >= 0) {
      hovered = null;
      hoverStar = -1;
    }
    invalidate();
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerenter", onEnter);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return {
    select(id, figure) {
      selected = id ? (sky.byId.get(id) ?? null) : null;
      for (const fs of figs.values()) if (fs.id !== id) fs.target = 0;
      if (id && figure) {
        const fs = figs.get(id) ?? { id, figure, img: null, tinted: null, alpha: 0, target: 1 };
        fs.target = 1;
        figs.set(id, fs);
        if (!fs.img) {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            fs.img = img;
            fs.tinted = tinted(img, pal.figure);
            invalidate();
          };
          img.src = `${import.meta.env.BASE_URL}skies/figures/${figure.file}`;
        }
      }
      pendingFit = !!selected;
      flyPending();
      invalidate();
    },
    setNight(n) {
      night = n;
      paletteStale = true;
      invalidate();
    },
    setHorizon(on) {
      horizonOn = on;
      invalidate();
    },
    setClear(r) {
      const first = !clear;
      clear = r;
      if (first) {
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      }
      flyPending();
      invalidate();
    },
    zoom(factor) {
      zoomAt(factor, cx, cy);
    },
    nudge(dx, dy) {
      const px = Math.min(w, h) * 0.08;
      pan(dx * px, dy * px);
    },
    overhead() {
      flyTo(horizonFrame(new Date(), o.location.lat, o.location.lon).zenith, HOME_HALF);
    },
    selectCenter() {
      const c = constellationAt(f.c);
      if (c) o.onSelect(c.id);
    },
    starBox(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const i = nearestStar(clientX - r.left, clientY - r.top, 12);
      if (i < 0) return null;
      const s = sr[i] + 3;
      return { left: r.left + sx[i] - s, top: r.top + sy[i] - s, width: s * 2, height: s * 2 };
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.clearInterval(tick);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    },
  };
}
