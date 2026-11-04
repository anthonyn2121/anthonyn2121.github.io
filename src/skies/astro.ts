/** Spherical astronomy for the sky chart. Angles are degrees unless noted; vectors are unit length. */

export const DEG = Math.PI / 180;

export type Vec = [number, number, number];

export function toVec(raDeg: number, decDeg: number): Vec {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

/** [RA 0–360, Dec] of a unit vector. */
export function toRaDec([x, y, z]: Vec): [number, number] {
  return [(((Math.atan2(y, x) / DEG) % 360) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, z))) / DEG];
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function normalize(v: Vec): Vec {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Angle between two unit vectors, in degrees. */
export const angleBetween = (a: Vec, b: Vec) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / DEG;

/**
 * Looking out from the centre of the sphere toward `c`, with celestial north up:
 * `e` points toward increasing RA (east) and `n` toward north, both tangent at `c`.
 */
export interface Frame {
  c: Vec;
  e: Vec;
  n: Vec;
}

export function frameAt(raDeg: number, decDeg: number): Frame {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  return {
    c: [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)],
    e: [-Math.sin(a), Math.cos(a), 0],
    n: [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)],
  };
}

/** Point on the sphere for gnomonic tangent-plane coordinates (ξ east, η north, radians) around a frame's centre. */
export function fromGnomonic(f: Frame, xi: number, eta: number): Vec {
  return normalize([
    f.c[0] + xi * f.e[0] + eta * f.n[0],
    f.c[1] + xi * f.e[1] + eta * f.n[1],
    f.c[2] + xi * f.e[2] + eta * f.n[2],
  ]);
}

/** Spherical interpolation, for flying the view along a great circle. */
export function slerp(a: Vec, b: Vec, t: number): Vec {
  const w = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (w < 1e-6) return b;
  const s = Math.sin(w);
  const ka = Math.sin((1 - t) * w) / s;
  const kb = Math.sin(t * w) / s;
  return normalize([a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]);
}

/** Local mean sidereal time in degrees, for a longitude in degrees east. */
export function siderealDeg(date: Date, lonDeg: number) {
  const days = date.getTime() / 86400000 - 10957.5; // days since J2000.0
  return (((280.46061837 + 360.98564736629 * days + lonDeg) % 360) + 360) % 360;
}

/** The observer's zenith, plus north and east along the horizon. */
export interface Horizon {
  zenith: Vec;
  north: Vec;
  east: Vec;
}

export function horizonFrame(date: Date, latDeg: number, lonDeg: number): Horizon {
  const zenith = toVec(siderealDeg(date, lonDeg), latDeg);
  const north =
    latDeg > 89.999 ? toVec(siderealDeg(date, lonDeg) + 180, 0) : normalize(cross(cross(zenith, [0, 0, 1]), zenith));
  return { zenith, north, east: cross(north, zenith) };
}

/** Direction for an azimuth (from north through east) and altitude, in a horizon frame. */
export function altAz(h: Horizon, azDeg: number, altDeg: number): Vec {
  const A = azDeg * DEG;
  const a = altDeg * DEG;
  const ch = Math.cos(a);
  return [0, 1, 2].map(
    (i) => ch * (Math.cos(A) * h.north[i] + Math.sin(A) * h.east[i]) + Math.sin(a) * h.zenith[i],
  ) as Vec;
}

/** Point-in-polygon on the sphere: project the ring around `p` stereographically, then ray-cast. */
export function ringContains(ring: Float64Array, p: Vec, f: Frame) {
  let inside = false;
  const n = ring.length / 3;
  let px = 0;
  let py = 0;
  for (let i = 0; i <= n; i++) {
    const j = (i % n) * 3;
    const z = ring[j] * p[0] + ring[j + 1] * p[1] + ring[j + 2] * p[2];
    const k = 2 / (1 + z);
    const x = k * (ring[j] * f.e[0] + ring[j + 1] * f.e[1] + ring[j + 2] * f.e[2]);
    const y = k * (ring[j] * f.n[0] + ring[j + 1] * f.n[1] + ring[j + 2] * f.n[2]);
    if (i > 0 && py > 0 !== y > 0 && px + ((x - px) * (0 - py)) / (y - py) > 0) inside = !inside;
    px = x;
    py = y;
  }
  return inside;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * When a constellation is highest at about 9 PM local time. Local sidereal time at 21:00 is
 * roughly 3.68 h + 0.0657 h per day after 31 December, and an object is highest when LST = RA.
 */
export function bestMonth(raDeg: number) {
  const day = ((((raDeg / 15 - 3.68) / 0.0657) % 365.25) + 365.25) % 365.25;
  const date = new Date(2001, 0, Math.round(day) || 1);
  const d = date.getDate();
  return `${d <= 10 ? "early" : d <= 20 ? "mid" : "late"} ${MONTHS[date.getMonth()]}`;
}

/** How a constellation behaves from a latitude, given its declination range and centre. */
export function visibility(dec: [number, number], centerDec: number, lat: number) {
  const north = lat >= 0;
  const neverRises = north ? dec[1] < lat - 90 : dec[0] > lat + 90;
  if (neverRises) return "Never rises";
  const neverSets = north ? dec[0] > 90 - lat : dec[1] < -90 - lat;
  if (neverSets) return "Never sets: up every clear night";
  const peak = Math.max(0, Math.round(90 - Math.abs(lat - centerDec)));
  const side = centerDec < lat ? "south" : "north";
  const partial = north ? dec[0] < lat - 90 : dec[1] > lat + 90;
  if (peak >= 80) return `${partial ? "Partly rises; passes" : "Passes"} almost overhead`;
  return `${partial ? "Partly rises; climbs" : "Climbs"} to ${peak}° above the ${side} horizon`;
}

const pad = (v: number, n = 2) => String(v).padStart(n, "0");

/** RA as "05h 35m", or "05h 35m 17s" with seconds. */
export function formatRa(raDeg: number, seconds = false) {
  const total = Math.round((raDeg / 15) * (seconds ? 3600 : 60));
  const t = seconds ? total : total * 60;
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor(t / 60) % 60;
  return `${pad(h)}h ${pad(m)}m${seconds ? ` ${pad(t % 60)}s` : ""}`;
}

/** Dec as "+05° 23′". */
export function formatDec(decDeg: number) {
  const t = Math.round(Math.abs(decDeg) * 60);
  return `${decDeg < 0 ? "−" : "+"}${pad(Math.floor(t / 60))}° ${pad(t % 60)}′`;
}
