// Builds public/skies/sky.json from the d3-celestial data set (BSD-3-Clause, Olaf Frohn),
// which compiles Hipparcos (XHIP) stars, IAU constellation lines, Davenhall & Leggett
// constellation boundaries, and Jose R. Vieira's Milky Way outlines. All positions are J2000.
//
//   node scripts/build-sky-data.mjs [magnitudeLimit=6]
//
// Output shape is the SkyCatalog interface in src/skies/catalog.ts.

import { writeFile, mkdir } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/";
const MAG_LIMIT = Number(process.argv[2] ?? 6);
const OUT = new URL("../public/skies/sky.json", import.meta.url);

/**
 * English meanings where d3-celestial's "en" field repeats the Latin name, gives an asterism
 * instead of the figure (the Big Dipper is only part of the Great Bear), or is ambiguous.
 */
const MEANINGS = {
  And: "Chained Maiden",
  Aqr: "Water Bearer",
  Cae: "Chisel",
  Cap: "Sea Goat",
  Cas: "Queen",
  Cep: "King",
  Cha: "Chameleon",
  Cir: "Drawing Compass",
  Eri: "River",
  Her: "Hero",
  Hya: "Water Snake",
  Hyi: "Lesser Water Snake",
  Lyn: "Lynx",
  Men: "Table Mountain",
  Nor: "Carpenter's Square",
  Oph: "Serpent Bearer",
  Ori: "Hunter",
  Peg: "Winged Horse",
  Per: "Hero",
  Phe: "Phoenix",
  Pic: "Painter's Easel",
  Pyx: "Mariner's Compass",
  Scl: "Sculptor",
  UMa: "Great Bear",
  UMi: "Little Bear",
};

const get = async (f) => {
  const r = await fetch(BASE + f);
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return r.json();
};

const ra = (lon) => (lon < 0 ? lon + 360 : lon);
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const vec = (a, d) => {
  const A = (a * Math.PI) / 180;
  const D = (d * Math.PI) / 180;
  return [Math.cos(D) * Math.cos(A), Math.cos(D) * Math.sin(A), Math.sin(D)];
};
const angle = (u, v) => (Math.acos(Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])) * 180) / Math.PI;

/** Split long boundary edges so they curve correctly when projected. Works in unwrapped longitude. */
function densify(ring, step = 2) {
  const out = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lo1, la1] = ring[i];
    const [lo2, la2] = ring[i + 1];
    let d = lo2 - lo1;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    const arc = Math.max(Math.abs(d) * Math.cos((((la1 + la2) / 2) * Math.PI) / 180), Math.abs(la2 - la1));
    const n = Math.max(1, Math.ceil(arc / step));
    for (let k = 0; k < n; k++) out.push([lo1 + (d * k) / n, la1 + ((la2 - la1) * k) / n]);
  }
  return out;
}

const [stars, starnames, cons, lines, bounds, mw] = await Promise.all(
  ["stars.6.json", "starnames.json", "constellations.json", "constellations.lines.json", "constellations.bounds.json", "mw.json"].map(get),
);

// ─── Stars, brightest first ───────────────────────────────────────────────
const list = stars.features
  .filter((f) => f.properties.mag <= MAG_LIMIT)
  .sort((a, b) => a.properties.mag - b.properties.mag);

const flat = [];
const names = {};
const brightest = {};
list.forEach((f, i) => {
  const [lon, lat] = f.geometry.coordinates;
  const bv = Number.parseFloat(f.properties.bv);
  flat.push(r2(ra(lon)), r2(lat), r2(f.properties.mag), Number.isFinite(bv) ? r2(bv) : 0.6);
  const n = starnames[f.id];
  if (!n) return;
  const letter = n.bayer || n.flam;
  const desig = letter && n.c ? `${letter} ${n.c}` : "";
  const name = n.name || "";
  if (name || desig) names[i] = [name, desig];
  if (n.c && desig && !(n.c in brightest)) brightest[n.c] = { name, desig, mag: r2(f.properties.mag) };
});

// ─── Constellations (Serpens comes in two parts; merge them) ─────────────
const byId = new Map();
for (const f of cons.features) {
  const p = f.properties;
  if (byId.has(f.id)) continue;
  byId.set(f.id, {
    id: f.id,
    name: p.name,
    meaning: MEANINGS[f.id] ?? p.en.replace(/\s/g, " "),
    rank: Number(p.rank),
    label: [r2(ra(f.geometry.coordinates[0])), r2(f.geometry.coordinates[1])],
    center: [r2(((p.display[0] % 360) + 360) % 360), r2(p.display[1])],
    radius: 0,
    dec: [90, -90],
    lines: [],
    bounds: [],
    brightest: brightest[f.id] ?? null,
  });
}
for (const f of lines.features) {
  const c = byId.get(f.id);
  for (const line of f.geometry.coordinates) c.lines.push(line.flatMap(([lo, la]) => [r2(ra(lo)), r2(la)]));
}
for (const f of bounds.features) {
  const c = byId.get(f.id);
  const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
  const cv = vec(...c.center);
  for (const ring of rings) {
    const pts = densify(ring);
    for (const [lo, la] of pts) {
      c.dec[0] = Math.min(c.dec[0], la);
      c.dec[1] = Math.max(c.dec[1], la);
      c.radius = Math.max(c.radius, angle(cv, vec(ra(lo), la)));
    }
    c.bounds.push(pts.flatMap(([lo, la]) => [r1(ra(((lo + 540) % 360) - 180)), r1(la)]));
  }
}
const constellations = [...byId.values()].map((c) => ({ ...c, radius: r1(c.radius), dec: [r1(c.dec[0]), r1(c.dec[1])] }));
if (constellations.length !== 88) throw new Error(`expected 88 constellations, got ${constellations.length}`);

// ─── Milky Way: sample the five nested outline levels on a grid ──────────
// The outermost level's rings wrap all the way round the sky, so fill each RA column
// along declination (even-odd), which handles both wrapping rings and closed loops.
const STEP = 1.5;
const levelGrid = new Map();
mw.features.forEach((f, level) => {
  const edges = [];
  for (const poly of f.geometry.coordinates)
    for (const ring of poly)
      for (let i = 0; i < ring.length - 1; i++) {
        let [x1, y1] = ring[i];
        let [x2, y2] = ring[i + 1];
        if (Math.abs(x2 - x1) > 180) {
          // Crosses the ±180° seam: split into two edges meeting at the seam.
          if (x1 > x2) x2 += 360;
          else x1 += 360;
          const t = (180 - x1) / (x2 - x1);
          const ym = y1 + (y2 - y1) * t;
          edges.push([x1, y1, 180, ym], [-180, ym, x2 - 360, y2]);
        } else edges.push([x1, y1, x2, y2]);
      }
  for (let lon = -180 + STEP / 2; lon < 180; lon += STEP) {
    const hits = [];
    for (const [x1, y1, x2, y2] of edges) {
      if (x1 <= lon !== x2 <= lon) hits.push(y1 + ((y2 - y1) * (lon - x1)) / (x2 - x1));
    }
    hits.sort((a, b) => a - b);
    for (let k = 0; k + 1 < hits.length; k += 2)
      for (let lat = Math.ceil(hits[k] / STEP) * STEP; lat <= hits[k + 1]; lat += STEP) {
        // Thin the columns toward the poles so samples stay roughly equal-area.
        const every = Math.max(1, Math.round(1 / Math.cos((lat * Math.PI) / 180)));
        if (Math.round((lon + 180) / STEP) % every) continue;
        levelGrid.set(`${lon},${lat}`, level + 1);
      }
  }
});
const milkyWay = [];
for (const [key, level] of levelGrid) {
  const [lon, lat] = key.split(",").map(Number);
  milkyWay.push(r2(ra(lon)), r2(lat), level);
}

await mkdir(new URL(".", OUT), { recursive: true });
const json = JSON.stringify({ stars: flat, names, constellations, milkyWay, milkyWayStep: STEP });
await writeFile(OUT, json);
console.log(`${list.length} stars, ${Object.keys(names).length} names, ${constellations.length} constellations, ${milkyWay.length / 3} Milky Way samples, ${(json.length / 1024).toFixed(0)} KB`);
