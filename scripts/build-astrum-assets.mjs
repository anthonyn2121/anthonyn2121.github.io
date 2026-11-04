// Builds the ASTRUM case-study assets in public/projects/astrum/ from an ASTRUM checkout:
// thinned flight replays (resampled, rounded, with derived load factor and hit/kill events),
// plus two clearly-flagged placeholder sets until real ones are exported.
//
//   node scripts/build-astrum-assets.mjs [path/to/astrum=../astrum]
//
// Only the small outputs are committed; the multi-MB recordings stay in the ASTRUM repo.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] ?? "../astrum");
const OUT = new URL("../public/projects/astrum/", import.meta.url);
const G = 9.80665;

/** Each output: source replay, resample rate, and which channels the player needs. */
const REPLAYS = [
  { out: "split-s.json", src: "recordings/split_s.json", hz: 20, channels: ["e", "n", "u", "psi", "phi", "theta", "tas", "nz"] },
  { out: "formation.json", src: "recordings/session.json", hz: 5, channels: ["e", "n", "u", "psi", "phi"] },
  { out: "merge-20s.json", src: "replays/nose2nose_asp0_ep1_kill_20s.json", hz: 20, channels: ["e", "n", "u", "psi", "phi", "tas", "health"] },
  { out: "merge-4s.json", src: "replays/nose2nose_asp45_ep2_kill_4s.json", hz: 20, channels: ["e", "n", "u", "psi", "phi", "tas", "health"] },
];

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const DIGITS = { e: 1, n: 1, u: 1, psi: 3, phi: 3, theta: 3, tas: 1, nz: 2, health: 1 };

/** Unwraps a heading series so interpolation never swings the long way round. */
function unwrap(a) {
  const out = [a[0]];
  for (let i = 1; i < a.length; i++) {
    let d = a[i] - a[i - 1];
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    out.push(out[i - 1] + d);
  }
  return out;
}

/** Load factor from the inertial velocity: |a − g| / g, smoothed over ~0.1 s. */
function loadFactor(fs) {
  const raw = fs.map((_, i) => {
    const a = fs[Math.max(0, i - 1)], b = fs[Math.min(fs.length - 1, i + 1)], dt = b.sim_time_s - a.sim_time_s || 1;
    const an = (b.vel_north_mps - a.vel_north_mps) / dt, ae = (b.vel_east_mps - a.vel_east_mps) / dt, ad = (b.vel_down_mps - a.vel_down_mps) / dt;
    return Math.hypot(an, ae, ad - G) / G;
  });
  const w = Math.max(1, Math.round(0.1 / ((fs[fs.length - 1].sim_time_s - fs[0].sim_time_s) / fs.length)));
  return raw.map((_, i) => {
    let s = 0, n = 0;
    for (let k = i - w; k <= i + w; k++) if (raw[k] !== undefined) (s += raw[k]), n++;
    return s / n;
  });
}

function series(fs) {
  return {
    t: fs.map((f) => f.sim_time_s),
    e: fs.map((f) => f.enu_e),
    n: fs.map((f) => f.enu_n),
    u: fs.map((f) => f.enu_u),
    psi: unwrap(fs.map((f) => f.psi_rad)),
    phi: fs.map((f) => f.phi_rad),
    theta: fs.map((f) => f.theta_rad),
    tas: fs.map((f) => f.airspeed_mps),
    health: fs.map((f) => f.health ?? 100),
    nz: loadFactor(fs),
  };
}

/** Linear resample of every channel onto a shared grid. */
function resample(s, grid, channels) {
  const out = Object.fromEntries(channels.map((c) => [c, []]));
  let j = 0;
  for (const t of grid) {
    while (j < s.t.length - 2 && s.t[j + 1] < t) j++;
    const k = s.t[j + 1] === s.t[j] ? 0 : Math.min(1, Math.max(0, (t - s.t[j]) / (s.t[j + 1] - s.t[j])));
    for (const c of channels) out[c].push(round(s[c][j] + (s[c][j + 1] - s[c][j]) * k, DIGITS[c]));
  }
  return out;
}

/** Hits (health drops, merged within 0.25 s) and the kill, from the full-rate frames. */
function events(byId) {
  const evs = [], ids = [...byId.keys()];
  for (const [id, fs] of byId) {
    const by = ids.length === 2 ? ids.find((o) => o !== id) : undefined;
    let lastHit = -1, dead = false;
    for (let i = 1; i < fs.length; i++) {
      const h0 = fs[i - 1].health ?? 100, h1 = fs[i].health ?? 100, t = round(fs[i].sim_time_s, 2);
      if (!dead && h1 <= 0) {
        evs.push({ t, id, by, kind: "kill" });
        dead = true;
      } else if (h1 < h0 && t - lastHit > 0.25) {
        evs.push({ t, id, by, kind: "hit" });
        lastHit = t;
      }
    }
  }
  return evs.sort((a, b) => a.t - b.t);
}

async function buildReplay({ out, src, hz, channels }) {
  const d = JSON.parse(await readFile(path.join(ROOT, src), "utf8"));
  const byId = new Map();
  for (const f of d.frames) (byId.get(f.id) ?? byId.set(f.id, []).get(f.id)).push(f);
  for (const fs of byId.values()) fs.sort((a, b) => a.sim_time_s - b.sim_time_s);
  const all = [...byId.values()];
  const t0 = Math.max(...all.map((fs) => fs[0].sim_time_s)), t1 = Math.min(...all.map((fs) => fs[fs.length - 1].sim_time_s));
  const grid = [];
  for (let t = t0; t <= t1 + 1e-9; t += 1 / hz) grid.push(t);

  const tracks = {}, bounds = { e: [Infinity, -Infinity], n: [Infinity, -Infinity], u: [Infinity, -Infinity] };
  const full = new Map();
  for (const [id, fs] of byId) {
    const s = series(fs);
    full.set(id, s);
    tracks[id] = resample(s, grid, channels);
    for (const c of ["e", "n", "u"]) for (const v of s[c]) (bounds[c][0] = Math.min(bounds[c][0], v)), (bounds[c][1] = Math.max(bounds[c][1], v));
  }
  const replay = {
    kind: "astrum-site-replay",
    version: 1,
    source: src,
    note: d.meta?.note ?? "",
    rate_hz: hz,
    duration: round(t1 - t0, 2),
    bounds: Object.fromEntries(Object.entries(bounds).map(([k, [a, b]]) => [k, [round(a, 1), round(b, 1)]])),
    aircraft: [...byId.keys()].map((id) => ({ id, kind: byId.get(id)[0].kind })),
    t: grid.map((t) => round(t - t0, 2)),
    tracks,
    // Only armed runs carry meaningful health; unarmed recordings report 0 throughout.
    events: channels.includes("health") ? events(byId).map((e) => ({ ...e, t: round(e.t - t0, 2) })) : [],
  };
  if (out === "split-s.json") replay.summary = splitSSummary(full.get([...byId.keys()][0]), t0);
  const json = JSON.stringify(replay);
  await writeFile(new URL(out, OUT), json);
  console.log(`${out}: ${byId.size} aircraft, ${grid.length} samples @ ${hz} Hz, ${replay.events.length} events, ${(json.length / 1024).toFixed(0)} KB`);
}

/** The numbers the split-S callouts quote: when it rolls inverted, bottoms out, and recovers. */
function splitSSummary(s, t0) {
  const i0 = 0, iInv = s.phi.findIndex((p) => Math.abs(p) > 2.6);
  let iLow = 0;
  s.theta.forEach((v, i) => v < s.theta[iLow] && (iLow = i));
  const iLevel = s.theta.findIndex((v, i) => i > iLow && v > -0.05);
  const iEnd = s.t.length - 1;
  const uMin = Math.min(...s.u);
  return {
    t_inverted: round(s.t[iInv] - t0, 2),
    t_nose_low: round(s.t[iLow] - t0, 2),
    t_level: round(s.t[iLevel < 0 ? iEnd : iLevel] - t0, 2),
    min_pitch_deg: round((s.theta[iLow] * 180) / Math.PI, 0),
    alt_loss_m: round(s.u[i0] - uMin, 0),
    tas_start_mps: round(s.tas[i0], 0),
    tas_max_mps: round(Math.max(...s.tas), 0),
    nz_max: round(Math.max(...s.nz), 1),
  };
}

/** Deterministic noise, so the placeholders don't change between builds. */
function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

async function placeholderCurve() {
  const r = rng(11), x = [], y = [];
  for (let i = 0; i <= 50; i++) {
    const steps = i * 100_000;
    x.push(steps);
    y.push(round(Math.max(0, 38 / (1 + Math.exp(-(steps - 2.2e6) / 4.5e5)) + (r() - 0.5) * 6), 1));
  }
  const data = {
    kind: "astrum-site-curve",
    filler: "Placeholder curve. Replace with a real run's kill rate from the BFM program's training log.",
    x_label: "Environment steps",
    y_label: "Kill rate vs Tier-3 opponent (%)",
    x,
    y,
  };
  await writeFile(new URL("bfm-training.json", OUT), JSON.stringify(data));
  console.log("bfm-training.json: placeholder");
}

async function placeholderCourse() {
  // Eight gates on a lazy loop about 120 m round; yaw follows the loop. Real gate geometry is
  // quoted from the racing controller's README (opening, airframe reach, clearance).
  const gates = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rx = 22 + (i % 2) * 6, ry = 14 + ((i + 1) % 3) * 3;
    gates.push({ x: round(Math.cos(a) * rx, 2), y: round(Math.sin(a) * ry, 2), yaw: round(a + Math.PI / 2, 3) });
  }
  const line = [];
  for (let k = 0; k <= 160; k++) {
    const a = (k / 160) * Math.PI * 2, i = (k / 160) * 8;
    const rx = 22 + 3 + Math.cos(i * Math.PI) * -3, ry = 15.5 + Math.sin(a * 3) * 1.5;
    line.push([round(Math.cos(a) * rx, 2), round(Math.sin(a) * ry, 2)]);
  }
  const data = {
    kind: "astrum-site-course",
    filler: "Placeholder course and line. Replace with `astrum-race --dump-course` and the planner's output.",
    opening_m: 0.787,
    reach_m: 0.284,
    clearance_m: 0.109,
    clearance_crabbed_m: 0.041,
    gates,
    line,
  };
  await writeFile(new URL("race-course.json", OUT), JSON.stringify(data));
  console.log("race-course.json: placeholder");
}

await mkdir(OUT, { recursive: true });
for (const r of REPLAYS) await buildReplay(r);
await placeholderCurve();
await placeholderCourse();
