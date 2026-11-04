import * as THREE from "three";
import { Jet, type Pose, type Vehicle } from "./jet";
import { buildPad, Quad } from "./quad";
import { ANGLED, angledPoint, CATS, DECK_Y, ELEVATOR, type Ship } from "./ship";
import { box, CLS, clamp, colored, merge, rng, sstep, tag, yawOf } from "./util";

/*
 * Everything that moves on deck.
 *
 * Cat 1 runs an ambient cycle as a pure function of time: a jet rises on elevator 1, taxis to
 * the catapult, runs up, and is shot off the bow every 8 s. Cat 2 belongs to the visitor: each
 * project has a jet in the row forward of the island, and launching a project sends that jet.
 * It stays airborne until recalled, then traps on the angled deck and taxis back to its spot.
 * Parked jets keep their wings folded; they spread them while taxiing to a cat and fold them
 * again on the way back from a trap.
 *
 * A project can be a Group 1 quadcopter instead. It sits on a UAS pad in the row, spins up,
 * lifts off and circles over the deck while its card is open, then flies home and lands. It
 * never needs the cat, so it launches at once.
 */

const AMBIENT_PERIOD = 16;
const PARKED_YAW = yawOf(0, -1);

/** Ambient shots stay brisk; a visitor's launch runs slower and turns across the frame so it can be watched. */
const AMBIENT_LAUNCH = { shot: 2, climb: 4.5, turn: 0.32, vy: 32 };
const PROJECT_LAUNCH = { shot: 2.8, climb: 7, turn: 1.9, vy: 12 };
type LaunchProfile = typeof AMBIENT_LAUNCH;
const PROJECT_TAXI = 4.5, PROJECT_HOLD = 2.6;

/** Project spots: a row forward of the island, noses inboard. */
const SPOTS: [number, number][] = [[10, 18], [20.5, 18], [31, 18], [41.5, 18]];

/** Deck park that never moves: aft along the starboard side, and the port bow. */
const STATIC_JETS: [number, number, number][] = [
  ...[-145, -134, -123, -112, -101, -90, -79, -68].map((x) => [x, 22, PARKED_YAW] as [number, number, number]),
  ...[92, 104, 116].map((x) => [x, -23.5, yawOf(0, 1)] as [number, number, number]),
];

/** What a vehicle is doing, for the status strip and for where the camera looks. */
export type Phase =
  | "parked" | "taxi-out" | "on-cat" | "launch" | "departure" | "airborne" | "approach" | "trap" | "taxi-in" | "spotting"
  | "spin-up" | "liftoff" | "on-station" | "landing";

export interface ProjectSpec {
  slug: string;
  vehicle: "jet" | "quadcopter";
}

/**
 * The quadcopter's station: a slow circle off the starboard side of the deck park. The centre sits low and
 * right of frame centre on the deck so that, lifted by its altitude, the circle lands in the sharp band.
 */
const QUAD = { alt: 18, radius: 17, period: 22, center: [62, 20] as const, spinUp: 1.6, lift: 3.2, transit: 2.6, home: 3.4, descend: 3.2, spinDown: 1.4 };

type Seg = { dur: number; phase: Phase; at: (u: number) => Pose };

const ease = (u: number) => u * u * (3 - 2 * u);

/** Follows a deck path, nose along the tangent (or tail first, for a pushback); wings move from fold[0] to fold[1] early on. */
function taxi(pts: [number, number][], dur: number, phase: Phase, fold: [number, number] = [1, 1], reverse = false): Seg {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  return {
    dur,
    phase,
    at: (u) => {
      const k = ease(u);
      c.getPointAt(k, p);
      c.getTangentAt(k, t);
      const yaw = reverse ? yawOf(-t.x, -t.z) : yawOf(t.x, t.z);
      return { x: p.x, y: DECK_Y, z: p.z, yaw, fold: fold[0] + (fold[1] - fold[0]) * sstep(0.05, 0.6, u) };
    },
  };
}

const hold = (pose: Pose, dur: number, phase: Phase, burner: (u: number) => number = () => 0): Seg => ({
  dur,
  phase,
  at: (u) => ({ ...pose, burner: burner(u) }),
});

const pivot = (x: number, z: number, from: number, to: number, dur: number): Seg => ({
  dur,
  phase: "spotting",
  at: (u) => ({ x, y: DECK_Y, z, yaw: from + (to - from) * ease(u), fold: 1 }),
});

/** Constant acceleration down the cat track, from hookup to the bow. */
function shot(cat: (typeof CATS)[number], dur: number): Seg {
  const accel = (2 * (cat.x1 - cat.x0)) / dur ** 2;
  return {
    dur,
    phase: "launch",
    at: (u) => {
      const t = u * dur;
      return { x: cat.x0 + 0.5 * accel * t * t, y: DECK_Y, z: cat.z, yaw: 0, burner: 1 };
    },
  };
}

/** Off the bow: a slight settle, then pitch up into a clearing turn away from the other cat. */
function climb(cat: (typeof CATS)[number], lp: LaunchProfile): Seg {
  const v = (2 * (cat.x1 - cat.x0)) / lp.shot;
  return {
    dur: lp.climb,
    phase: "departure",
    at: (u) => {
      const T = u * lp.climb;
      let x = cat.x1, z = cat.z, y = DECK_Y, yaw = 0, vy = 0;
      for (let t = 0; t < T; t += 0.05) {
        const dt = Math.min(0.05, T - t);
        yaw = -cat.turn * lp.turn * sstep(0.2, Math.min(2.8, lp.climb * 0.7), t + dt);
        vy = Math.min((t + dt) * 6, lp.vy);
        x += Math.cos(yaw) * v * dt;
        z -= Math.sin(yaw) * v * dt;
        y += vy * dt;
      }
      y -= 1.2 * Math.sin(clamp(T / 0.7) * Math.PI);
      const bank = cat.turn * Math.min(0.9, lp.turn * 0.6) * Math.sin(clamp(T / (lp.climb * 0.75)) * Math.PI);
      return { x, y, z, yaw, pitch: Math.atan2(vy, v), roll: bank, burner: 1 - sstep(1.5, 3, T) };
    },
  };
}

/** Final approach down the glideslope to the wires, then the arrested rollout. */
function trap(): Seg[] {
  const v = 65, start = -300, glide = Math.tan(THREE.MathUtils.degToRad(3.5)), aoa = THREE.MathUtils.degToRad(8);
  const approachDur = (ANGLED.touchdown - start) / v, rollDur = 2.6;
  return [
    {
      dur: approachDur,
      phase: "approach",
      at: (u) => {
        const s = start + u * (ANGLED.touchdown - start), [x, z] = angledPoint(s);
        return { x, y: DECK_Y + (ANGLED.touchdown - s) * glide, z, yaw: ANGLED.yaw, pitch: aoa };
      },
    },
    {
      dur: rollDur,
      phase: "trap",
      at: (u) => {
        const s = ANGLED.touchdown + (ANGLED.stop - ANGLED.touchdown) * (1 - (1 - u) ** 2), [x, z] = angledPoint(s);
        return { x, y: DECK_Y, z, yaw: ANGLED.yaw, pitch: aoa * (1 - sstep(0, 0.35, u)) };
      },
    },
  ];
}

/** Plays a list of segments from a start time. */
class Track {
  readonly end: number;
  constructor(private readonly segs: Seg[], readonly start: number) {
    this.end = start + segs.reduce((a, s) => a + s.dur, 0);
  }
  private seg(t: number): [Seg, number] {
    let local = Math.max(0, t - this.start);
    for (const s of this.segs) {
      if (local <= s.dur) return [s, local / s.dur];
      local -= s.dur;
    }
    return [this.segs[this.segs.length - 1], 1];
  }
  at(t: number): Pose {
    const [s, u] = this.seg(t);
    return s.at(u);
  }
  phase(t: number): Phase {
    return this.seg(t)[0].phase;
  }
}

export type DeckState = "parked" | "launching" | "airborne" | "recovering";

interface ProjectCraft {
  slug: string;
  kind: ProjectSpec["vehicle"];
  craft: Vehicle;
  spot: [number, number];
  state: DeckState;
  phase: Phase;
  track: Track | null;
  recallWanted: boolean;
  /** Quadcopter: where it joins its station circle, radians; it circles on from there. */
  stationTheta: number;
}

/** Shortest-way blend between two headings. */
function blendYaw(a: number, b: number, u: number) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * u;
}

function stationPoint(theta: number) {
  return [QUAD.center[0] + Math.cos(theta) * QUAD.radius, QUAD.center[1] + Math.sin(theta) * QUAD.radius] as const;
}

/** Circling the station: nose along the circle, a little nose-down and banked into the turn. */
function onStation(theta: number, t: number): Pose {
  const [x, z] = stationPoint(theta), dx = -Math.sin(theta), dz = Math.cos(theta), yaw = yawOf(dx, dz);
  return { x, y: DECK_Y + QUAD.alt + Math.sin(t * 1.1) * 0.6, z, yaw, pitch: -0.14, roll: 0.12, spin: 1 };
}

/** Spin up on the pad, climb straight up while turning to face the station, then fly to it. */
function quadLaunch([sx, sz]: [number, number]): { segs: Seg[]; theta: number } {
  const theta = Math.atan2(sz - QUAD.center[1], sx - QUAD.center[0]);
  const [ex, ez] = stationPoint(theta), top = DECK_Y + QUAD.alt, heading = yawOf(ex - sx, ez - sz);
  return {
    theta,
    segs: [
      { dur: QUAD.spinUp, phase: "spin-up", at: (u) => ({ x: sx, y: DECK_Y, z: sz, yaw: 0, spin: u }) },
      { dur: QUAD.lift, phase: "liftoff", at: (u) => ({ x: sx, y: DECK_Y + QUAD.alt * ease(u), z: sz, yaw: blendYaw(0, heading, ease(u)), spin: 1 }) },
      {
        dur: QUAD.transit,
        phase: "liftoff",
        at: (u) => {
          const k = ease(u);
          return { x: sx + (ex - sx) * k, y: top, z: sz + (ez - sz) * k, yaw: blendYaw(heading, onStation(theta, 0).yaw, k), pitch: -0.2 * Math.sin(Math.PI * u), spin: 1 };
        },
      },
    ],
  };
}

/** From wherever it is, fly to above the pad, descend, and spin down. */
function quadRecover(from: Pose, [sx, sz]: [number, number]): Seg[] {
  const top = DECK_Y + QUAD.alt, heading = yawOf(sx - from.x, sz - from.z);
  return [
    {
      dur: QUAD.home,
      phase: "landing",
      at: (u) => {
        const k = ease(u);
        return { x: from.x + (sx - from.x) * k, y: from.y + (top - from.y) * k, z: from.z + (sz - from.z) * k, yaw: blendYaw(from.yaw, heading, sstep(0, 0.3, u)), pitch: -0.2 * Math.sin(Math.PI * u), spin: 1 };
      },
    },
    { dur: QUAD.descend, phase: "landing", at: (u) => ({ x: sx, y: top - QUAD.alt * ease(u), z: sz, yaw: blendYaw(heading, 0, ease(u)), spin: 1 }) },
    { dur: QUAD.spinDown, phase: "landing", at: (u) => ({ x: sx, y: DECK_Y, z: sz, yaw: 0, spin: 1 - u }) },
  ];
}

/** A moving jet the camera should keep in view: a visitor's launch, or a recovery. */
export interface Attention {
  x: number;
  y: number;
  z: number;
  kind: "launch" | "recover";
}

// ---------- steam ----------
class Steam {
  private readonly mesh: THREE.InstancedMesh;
  private readonly p: { x: number; z: number; born: number; life: number; size: number }[] = [];
  private next = 0;
  private readonly o = new THREE.Object3D();
  private readonly r = rng(7);

  constructor(scene: THREE.Scene, private readonly n = 140) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      tag(new THREE.MeshLambertMaterial({ color: "#f1f3f2", emissive: "#5d6466" }), CLS.steam),
      n,
    );
    this.mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) this.p.push({ x: 0, z: 0, born: -99, life: 1, size: 1 });
    scene.add(this.mesh);
  }

  emit(x: number, z: number, t: number, spread = 1) {
    const q = this.p[this.next++ % this.n];
    q.x = x + (this.r() - 0.5) * 2 * spread;
    q.z = z + (this.r() - 0.5) * 2 * spread;
    q.born = t;
    q.life = 1.6 + this.r() * 1.6;
    q.size = 0.6 + this.r() * 0.9;
  }

  update(t: number) {
    this.p.forEach((q, i) => {
      const a = (t - q.born) / q.life;
      if (a < 0 || a > 1) this.o.scale.setScalar(0);
      else {
        this.o.position.set(q.x - a * 6, DECK_Y + 0.4 + a * 4.5, q.z + Math.sin(q.born * 9) * a * 2);
        this.o.scale.setScalar(q.size * (0.5 + a * 1.8) * (1 - a * a));
      }
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- deck crew ----------
const JERSEY = {
  yellow: "#f5c518", green: "#2ea043", purple: "#8a3ffc", red: "#e5322d", white: "#f2f2f2", blue: "#2f6fe0", brown: "#9a6232",
} as const;
type Walker = { a: [number, number]; b: [number, number]; period: number; phase: number; color: keyof typeof JERSEY };

function crewList(): Walker[] {
  const r = rng(5), list: Walker[] = [];
  const stand = (x: number, z: number, color: keyof typeof JERSEY, roam = 1.2) =>
    list.push({ a: [x, z], b: [x + (r() - 0.5) * roam * 2, z + (r() - 0.5) * roam * 2], period: 5 + r() * 9, phase: r(), color });
  const walk = (a: [number, number], b: [number, number], color: keyof typeof JERSEY) =>
    list.push({ a, b, period: 10 + r() * 10, phase: r(), color });
  // Cat 1 and cat 2: the shooters, hookup crews, and safety observers, clear of the jets' wings.
  stand(76, 19, "yellow");
  stand(78, -16, "yellow");
  for (const x of [56, 62, 68]) stand(x, 18, "green", 0.8);
  for (const x of [56, 63]) stand(x, -16, "green", 0.8);
  for (const x of [60, 72, 86, 100]) stand(x, 0.7, "white", 0.6);
  stand(66, 0.7, "green", 0.6);
  // Directors along the taxi routes.
  stand(46, 36, "yellow", 0.5);
  stand(47, 8, "yellow", 0.5);
  stand(26, 4, "yellow", 0.5);
  stand(-6, -1, "yellow", 0.5);
  // Plane captains at the noses of the parked jets, chock and chain crews, fuel and ordnance.
  for (const [x, z] of SPOTS) stand(x + 2.5, z - 9, "brown", 0.4);
  for (const x of [-140, -118, -96, -74]) stand(x, 13.6, "brown", 0.4);
  for (const x of [5, 26, 37]) stand(x, 9.5, "blue", 0.6);
  for (const x of [-128, -84]) stand(x, 13.4, "purple", 0.8);
  for (const x of [98, 110]) stand(x, -17, "red", 0.5);
  // People crossing the deck.
  walk([-60, 15], [0, 15], "blue");
  walk([-40, 16], [12, 6], "purple");
  walk([84, -15.4], [124, -15.4], "red");
  walk([30, 6], [52, 30], "white");
  walk([-150, 18], [-62, 15], "brown");
  walk([120, 6], [86, 2], "green");
  return list;
}

class Crew {
  private readonly mesh: THREE.InstancedMesh;
  private readonly list = crewList();
  private readonly o = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const person = merge([box(-0.3, 0.3, 0, 1.15, -0.2, 0.2, "#ffffff"), colored(new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.4, 0), "#ffffff")]);
    this.mesh = new THREE.InstancedMesh(person, tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.crew), this.list.length);
    const c = new THREE.Color();
    this.list.forEach((w, i) => this.mesh.setColorAt(i, c.set(JERSEY[w.color]).multiplyScalar(1.2)));
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update(t: number) {
    this.list.forEach((w, i) => {
      // Ping-pong between a and b with a pause at each end; the body bobs with each step.
      const k = (t / w.period + w.phase) % 1, u = sstep(0.1, 0.45, k) * (1 - sstep(0.6, 0.95, k));
      const moving = (k > 0.1 && k < 0.45) || (k > 0.6 && k < 0.95);
      const dir = k < 0.5 ? 1 : -1;
      const x = w.a[0] + (w.b[0] - w.a[0]) * u, z = w.a[1] + (w.b[1] - w.a[1]) * u;
      this.o.position.set(x, DECK_Y + (moving ? Math.abs(Math.sin(t * 7 + i)) * 0.09 : 0), z);
      this.o.rotation.y = yawOf((w.b[0] - w.a[0]) * dir, (w.b[1] - w.a[1]) * dir) + Math.PI / 2;
      this.o.updateMatrix();
      this.mesh.setMatrixAt(i, this.o.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- plane guard helicopter ----------
function buildHelo() {
  const mat = tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.steel);
  const root = new THREE.Group();
  root.rotation.order = "YZX";
  const body = new THREE.Mesh(
    merge([
      box(-3, 4.6, -1.2, 1.4, -1.3, 1.3, "#7c838a", "#9aa1a7"),
      box(-11, -3, 0, 0.9, -0.35, 0.35, "#7c838a", "#9aa1a7"),
      box(-11.6, -10.4, 0, 3, -0.15, 0.15, "#7c838a"),
      box(-1, 3, 1.4, 2.1, -0.9, 0.9, "#6c7279", "#8a9097"),
    ]),
    mat,
  );
  body.castShadow = true;
  const rotor = new THREE.Mesh(merge([box(-8, 8, 0, 0.12, -0.3, 0.3, "#2d3134"), box(-0.3, 0.3, 0, 0.12, -8, 8, "#2d3134")]), mat);
  rotor.position.y = 2.3;
  rotor.castShadow = true;
  root.add(body, rotor);
  return { root, rotor };
}

// ---------- the ops ----------
export class FlightOps {
  readonly projects: ProjectCraft[];
  private readonly ambient = [new Jet(), new Jet()];
  private readonly steam: Steam;
  private readonly crew: Crew;
  private readonly helo = buildHelo();
  private readonly queue: string[] = [];
  private cat2BusyUntil = 0;
  private lastT = 0;
  private readonly allCraft: Vehicle[] = [];
  private hovered: string | null = null;
  /** Quadcopter launches asked for since the last update; they need no cat, so they go next frame. */
  private readonly pendingQuads: string[] = [];
  /** The project whose mission card is open; its jet stays highlighted wherever it goes. */
  open: string | null = null;
  /** The jet the camera should follow this frame, if any. */
  attention: Attention | null = null;
  private readonly ambientTaxi = taxi(
    [[(ELEVATOR.x0 + ELEVATOR.x1) / 2, (ELEVATOR.z0 + ELEVATOR.z1) / 2 - 2], [52, 28], [54, 16], [61, 10.6], [CATS[0].x0, CATS[0].z]],
    4,
    "taxi-out",
    [1, 0],
  );
  private readonly ambientShot = shot(CATS[0], AMBIENT_LAUNCH.shot);
  private readonly ambientClimb = climb(CATS[0], AMBIENT_LAUNCH);

  constructor(scene: THREE.Scene, private readonly ship: Ship, specs: ProjectSpec[]) {
    // Quadcopters take the row's spots from the middle of the frame outward; jets fill the rest in order.
    const list = specs.slice(0, SPOTS.length), free = [...SPOTS];
    const quadSpots = new Map(list.filter((s) => s.vehicle === "quadcopter").map((s) => [s.slug, free.pop()!]));
    this.projects = list.map((spec) => {
      const spot = quadSpots.get(spec.slug) ?? free.shift()!;
      const craft = spec.vehicle === "quadcopter" ? new Quad() : new Jet();
      if (spec.vehicle === "quadcopter") scene.add(buildPad(spot[0], spot[1]));
      craft.pose({ x: spot[0], y: DECK_Y, z: spot[1], yaw: spec.vehicle === "quadcopter" ? 0 : PARKED_YAW, fold: 1 });
      return { slug: spec.slug, kind: spec.vehicle, craft, spot, state: "parked", phase: "parked", track: null, recallWanted: false, stationTheta: 0 };
    });
    for (const [x, z, yaw] of STATIC_JETS) {
      const j = new Jet();
      j.pose({ x, y: DECK_Y, z, yaw, fold: 1 });
      this.allCraft.push(j);
    }
    this.allCraft.push(...this.ambient, ...this.projects.map((p) => p.craft));
    for (const c of this.allCraft) scene.add(c.root);
    this.steam = new Steam(scene);
    this.crew = new Crew(scene);
    scene.add(this.helo.root);
  }

  set night(on: boolean) {
    for (const c of this.allCraft) c.night = on;
  }

  /** Pointer or keyboard focus on a jet's tag. Only parked jets take hover, so a moving jet can't keep a stale one. */
  hover(slug: string | null) {
    this.hovered = slug;
  }

  launch(slug: string) {
    const p = this.projects.find((q) => q.slug === slug);
    if (!p) return;
    p.recallWanted = false;
    if (p.state !== "parked") return;
    if (p.kind === "quadcopter") this.pendingQuads.push(slug);
    else if (!this.queue.includes(slug)) this.queue.push(slug);
  }

  recall(slug: string) {
    const i = this.queue.indexOf(slug);
    if (i >= 0) this.queue.splice(i, 1);
    const p = this.projects.find((q) => q.slug === slug);
    if (p && (p.state === "launching" || p.state === "airborne")) p.recallWanted = true;
  }

  update(t: number) {
    const dt = clamp(t - this.lastT, 0, 0.1);
    this.lastT = t;
    this.updateAmbient(t, dt);
    this.updateProjects(t, dt);
    this.steam.update(t);
    this.crew.update(t);
    this.ship.radar.rotation.y = t * 1.6;

    // Plane guard: a slow racetrack off the port quarter.
    const a = (t / 60) * Math.PI * 2, hx = -20 + Math.cos(a) * 110, hz = -150 + Math.sin(a) * 40;
    this.helo.root.position.set(hx, 46 + Math.sin(a * 2) * 4, hz);
    this.helo.root.rotation.set(Math.sin(a) * -0.12, yawOf(-Math.sin(a) * 110, Math.cos(a) * 40), -0.06);
    this.helo.rotor.rotation.y = t * 9;
  }

  /** Two jets, half a period apart, so one goes off cat 1 every 8 s. */
  private updateAmbient(t: number, dt: number) {
    const cat = CATS[0], ex = (ELEVATOR.x0 + ELEVATOR.x1) / 2, ez = (ELEVATOR.z0 + ELEVATOR.z1) / 2;
    const half = AMBIENT_PERIOD / 2, q = t % half;
    const lift = q < 3 ? ease(q / 3) : q < 6 ? 1 - ease((q - 3) / 3) : 0;
    const elevY = DECK_Y - ELEVATOR.drop * (1 - lift);
    this.ship.elevator.position.y = elevY - 0.4;

    const hookup: Pose = { x: cat.x0, y: DECK_Y, z: cat.z, yaw: 0 };
    let jbd = 0, shuttle = cat.x0 + 4;
    this.ambient.forEach((jet, i) => {
      const tau = (t + i * half) % AMBIENT_PERIOD;
      let p: Pose;
      if (tau < 3) p = { x: ex, y: elevY, z: ez - 2, yaw: PARKED_YAW, fold: 1 };
      else if (tau < 7) p = this.ambientTaxi.at((tau - 3) / 4);
      else if (tau < 10) p = { ...hookup, burner: sstep(9, 9.6, tau) };
      else if (tau < 12) p = this.ambientShot.at((tau - 10) / AMBIENT_LAUNCH.shot);
      else p = this.ambientClimb.at(Math.min(1, (tau - 12) / AMBIENT_LAUNCH.climb));
      jet.root.visible = tau < 15.6;
      jet.pose(p);
      jbd = Math.max(jbd, sstep(6.8, 7.8, tau) * (1 - sstep(12, 13.4, tau)));
      if (tau >= 10 && tau < 12) shuttle = p.x + 4;
      else if (tau >= 12 && tau < 14) shuttle = cat.x1 + 4 - (cat.x1 - cat.x0) * ease((tau - 12) / 2);
      if (dt > 0 && tau > 10.2 && tau < 12.6) for (let k = 0; k < 3; k++) this.steam.emit(cat.x0 + Math.random() * (cat.x1 - cat.x0), cat.z, t, 0.8);
      if (dt > 0 && tau > 7.5 && tau < 10 && Math.random() < 0.25) this.steam.emit(cat.x0 + 6 + Math.random() * 4, cat.z, t, 0.5);
    });
    this.ship.jbd[0].rotation.z = -THREE.MathUtils.degToRad(52) * jbd;
    this.ship.shuttle[0].position.x = shuttle;
  }

  private updateProjects(t: number, dt: number) {
    const cat = CATS[1], lp = PROJECT_LAUNCH, shotStart = PROJECT_TAXI + PROJECT_HOLD;
    // Start the next queued jet once cat 2 is clear.
    if (this.queue.length && t >= this.cat2BusyUntil) {
      const p = this.projects.find((q) => q.slug === this.queue[0])!;
      this.queue.shift();
      const [sx, sz] = p.spot;
      p.state = "launching";
      p.track = new Track(
        [
          taxi([[sx, sz], [sx, sz - 9], [sx + 10, -2], [46, -6.5], [58, -7.8], [cat.x0, cat.z]], PROJECT_TAXI, "taxi-out", [1, 0]),
          hold({ x: cat.x0, y: DECK_Y, z: cat.z, yaw: 0 }, PROJECT_HOLD, "on-cat", (u) => sstep(0.7, 0.95, u)),
          shot(cat, lp.shot),
          climb(cat, lp),
        ],
        t,
      );
      this.cat2BusyUntil = t + shotStart + lp.shot + 1.4;
    }
    // Quadcopters go straight from the pad.
    for (const slug of this.pendingQuads.splice(0)) {
      const p = this.projects.find((q) => q.slug === slug)!;
      const { segs, theta } = quadLaunch(p.spot);
      p.state = "launching";
      p.track = new Track(segs, t);
      p.stationTheta = theta;
    }

    let jbd = 0, shuttle = cat.x0 + 4;
    this.attention = null;
    for (const p of this.projects) {
      p.craft.selected = p.slug === this.open || (p.slug === this.hovered && p.state === "parked");
      if (p.kind === "quadcopter") {
        this.updateQuad(p, t);
        continue;
      }
      if (!p.track) {
        p.phase = "parked";
        continue;
      }
      const local = t - p.track.start, pose = p.track.at(t);
      p.craft.pose(pose);
      p.phase = p.state === "airborne" ? "airborne" : p.track.phase(t);
      // Follow the shot and the first seconds of the climb-out; after that the jet is leaving and the camera goes home.
      const launchFollow = p.phase === "launch" || (p.phase === "departure" && local < shotStart + lp.shot + 3);
      if (launchFollow) this.attention = { x: pose.x, y: pose.y, z: pose.z, kind: "launch" };
      if (p.phase === "approach" || p.phase === "trap") this.attention = { x: pose.x, y: pose.y, z: pose.z, kind: "recover" };
      if (p.state === "launching") {
        jbd = Math.max(jbd, sstep(PROJECT_TAXI + 0.1, PROJECT_TAXI + 0.9, local) * (1 - sstep(shotStart + lp.shot, shotStart + lp.shot + 1.4, local)));
        if (local >= shotStart && local < shotStart + lp.shot) shuttle = pose.x + 4;
        if (dt > 0 && local > shotStart + 0.2 && local < shotStart + lp.shot + 0.6) for (let k = 0; k < 3; k++) this.steam.emit(cat.x0 + Math.random() * (cat.x1 - cat.x0), cat.z, t, 0.8);
        if (t >= p.track.end) {
          p.state = "airborne";
          p.craft.root.visible = false;
          p.track = new Track([hold(pose, 1.5, "airborne")], t);
        }
      } else if (p.state === "airborne") {
        if (p.recallWanted && t >= p.track.end) {
          const [sx, sz] = p.spot, [rx, rz] = angledPoint(ANGLED.stop);
          p.state = "recovering";
          p.recallWanted = false;
          p.craft.root.visible = true;
          p.track = new Track(
            [
              ...trap(),
              taxi([[rx, rz], [rx + 9, rz + 0.5], [-4, -4], [sx - 12, 3], [sx, 3]], 5.5, "taxi-in", [0, 1]),
              pivot(sx, 3, 0, PARKED_YAW, 1.4),
              taxi([[sx, 3], [sx, sz]], 2.4, "spotting", [1, 1], true),
            ],
            t,
          );
        }
      } else if (p.state === "recovering" && t >= p.track.end) {
        p.state = "parked";
        p.phase = "parked";
        p.track = null;
      }
    }
    this.ship.jbd[1].rotation.z = -THREE.MathUtils.degToRad(52) * jbd;
    this.ship.shuttle[1].position.x = shuttle;
  }

  /**
   * Pad → spin up → lift → station; it circles there (on the scene clock, so it never runs out)
   * until recalled, then flies home and lands.
   */
  private updateQuad(p: ProjectCraft, t: number) {
    if (p.state === "airborne") {
      const theta = p.stationTheta + ((t - (p.track?.start ?? t)) / QUAD.period) * Math.PI * 2;
      const pose = onStation(theta, t);
      p.craft.pose(pose);
      p.phase = "on-station";
      if (p.recallWanted) {
        p.recallWanted = false;
        p.state = "recovering";
        p.track = new Track(quadRecover(pose, p.spot), t);
      }
      return;
    }
    if (!p.track) {
      p.phase = "parked";
      p.craft.pose({ x: p.spot[0], y: DECK_Y, z: p.spot[1], yaw: 0 });
      return;
    }
    const pose = p.track.at(t);
    p.craft.pose(pose);
    p.phase = p.track.phase(t);
    if (t < p.track.end) return;
    if (p.state === "launching") {
      // Reached the station: from here the circle is a function of time since arrival.
      p.state = "airborne";
      p.track = new Track([hold(pose, 0, "on-station")], t);
      if (p.recallWanted) this.updateQuad(p, t);
    } else {
      p.state = "parked";
      p.phase = "parked";
      p.track = null;
    }
  }
}
