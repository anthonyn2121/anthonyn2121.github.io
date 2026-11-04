import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Surface classes, written into the alpha channel of the scene render so the glyph pass knows what each pixel is. */
export const CLS = {
  water: 1,
  foam: 2,
  deck: 3,
  paint: 4,
  steel: 5,
  jet: 6,
  canopy: 7,
  crew: 8,
  steam: 9,
  plume: 10,
  light: 11,
  wake: 12,
  glass: 13,
  /** Wings, tailplanes and fins: drawn by edge direction so the planform reads. */
  jetWing: 14,
  /** Multirotor props: glyphs that turn over, so a spinning rotor reads as moving. */
  rotor: 15,
} as const;

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const sstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const fract = (x: number) => x - Math.floor(x);
const hash2 = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
export function vnoise(x: number, y: number) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j;
  const u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return (hash2(i, j) * (1 - u) + hash2(i + 1, j) * u) * (1 - v) + (hash2(i, j + 1) * (1 - u) + hash2(i + 1, j + 1) * u) * v;
}

/** Seeded Park–Miller generator, so the deck lays out the same on every load. */
export function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Shared clock uniform for every animated shader. */
export const time = { value: 0 };

type Shader = THREE.WebGLProgramParametersWithUniforms;

/** Makes a material write its surface class into alpha. */
export function tag<M extends THREE.Material>(mat: M, cls: number, extra?: (s: Shader) => void): M {
  mat.onBeforeCompile = (s) => {
    extra?.(s);
    s.fragmentShader = s.fragmentShader.replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>\n gl_FragColor.a = ${(cls / 16).toFixed(4)};`,
    );
  };
  mat.customProgramCacheKey = () => `c${cls}${extra?.name ?? ""}`;
  return mat;
}

/** Non-indexed copy of `g` with one vertex colour; faces pointing up get `top` if given (pale tops read from a steep camera). */
export function colored(g: THREE.BufferGeometry, hex: THREE.ColorRepresentation, top?: THREE.ColorRepresentation) {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute("uv");
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const c = new THREE.Color(hex), t = new THREE.Color(top ?? hex);
  const n = geo.attributes.normal, count = geo.attributes.position.count, a = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const k = n.getY(i) > 0.6 ? t : c;
    a[i * 3] = k.r;
    a[i * 3 + 1] = k.g;
    a[i * 3 + 2] = k.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return geo;
}

export function merge(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts);
  if (!g) throw new Error("mergeGeometries: incompatible attributes");
  return g;
}

/** An axis-aligned box from its extents, coloured. */
export function box(
  x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
  hex: THREE.ColorRepresentation, top?: THREE.ColorRepresentation,
) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return colored(g, hex, top);
}

/** Yaw for a heading in the deck plane: the jet's nose (+x) turned to point along (dx, dz). */
export const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);
