/**
 * ─────────────────────────────────────────────────────────────────────────
 *  ASTRUM, the flight simulation platform featured at the top of the
 *  Projects section and on the flight deck. Facts come from the ASTRUM
 *  README, design docs and commits; anything starting "Placeholder:" is
 *  filler to replace with your own words or results.
 *
 *  Replays and charts live in public/projects/astrum/, built by
 *    node scripts/build-astrum-assets.mjs path/to/astrum
 * ─────────────────────────────────────────────────────────────────────────
 */

import type { UasGroup } from "./profile";

/** The parts of ASTRUM, as drawn in the architecture diagram. */
export type ArchId = "sim" | "fdm" | "geo" | "bus" | "env" | "ctl" | "ctltool" | "bag" | "web";

export interface ArchNode {
  id: ArchId;
  label: string;
  /** Crate or package, shown under the label. */
  sub: string;
  blurb: string;
}

export interface Replay {
  kind: "replay";
  /** Under public/, e.g. "/projects/astrum/formation.json". */
  src: string;
  caption: string;
  /** Show the flight-data strips under the track. */
  strips?: boolean;
}
export interface Curve {
  kind: "curve";
  src: string;
  caption: string;
}
export interface Course {
  kind: "course";
  src: string;
  caption: string;
}
export type Visual = Replay | Curve | Course;

export interface AstrumProject {
  slug: string;
  name: string;
  tagline: string;
  status: "Shipped" | "In progress";
  problem: string;
  approach: string;
  highlights: string[];
  tech: string[];
  /** Which parts of ASTRUM it builds on; hovering lights them up in the diagram. */
  uses: ArchId[];
  /** Projects this one led to, by slug. */
  ledTo?: string[];
  visual?: Visual;
  /** Shown on the flight deck, and as what. Four fit. */
  deck?: { vehicle: "jet" | "quadcopter" };
  groups?: UasGroup[];
}

export interface Astrum {
  name: string;
  tagline: string;
  summary: string[];
  /** Set when the repository is public; until then the case study says so. */
  repo?: string;
  stats: { value: string; label: string }[];
  nodes: ArchNode[];
  tick: { name: string; what: string }[];
  realism: { replay: Replay; facts: { title: string; text: string }[] };
  perf: { fleet: string; threads: number; x: number }[];
  projects: AstrumProject[];
}

export const astrum: Astrum = {
  name: "ASTRUM",
  tagline: "A simulation environment for multi-agent flight",
  summary: [
    "ASTRUM flies dozens to hundreds of independent fixed-wing aircraft and quadrotors, each with its own high-fidelity JSBSim flight model, inside one headless Rust state server. Controllers, recorders, a browser viewer and an embedded RL environment all talk to it over one Zenoh session in a Cap'n Proto wire format shared across Rust, C++ and Python.",
    "Placeholder: one or two sentences in your own voice on why you built it, and what it let you do that existing simulators didn't.",
  ],
  stats: [
    { value: "1 FDM", label: "per aircraft: every entity owns its own JSBSim instance" },
    { value: "1126×", label: "real time for one F-16, headless at 120 Hz" },
    { value: "64", label: "F-16s at 45× real time on 8 threads" },
    { value: "0 drift", label: "bit-identical runs at any speed or thread count" },
  ],

  nodes: [
    { id: "sim", label: "State server", sub: "astrum-sim", blurb: "A headless Bevy ECS that owns every aircraft. One chained schedule per tick: commands in, autopilots, guns, physics, hits and damage, then telemetry and events out." },
    { id: "fdm", label: "JSBSim 6-DOF", sub: "astrum-fdm", blurb: "A safe Rust wrapper over JSBSim 1.3.1. Each aircraft gets its own instance, stepped in parallel; a C shim catches every C++ exception." },
    { id: "geo", label: "Geodesy", sub: "astrum-geo", blurb: "WGS84 geodetic ↔ ECEF ↔ local East-North-Up, so global lat/lon/height state lives on a metric grid about the scenario origin." },
    { id: "bus", label: "Zenoh · Cap'n Proto v2", sub: "astrum-net · astrum-proto", blurb: "One Zenoh session multiplexes telemetry, commands, events, scenario, controller presence and run control. The schema is pinned by cross-language wire fixtures." },
    { id: "env", label: "Embedded RL env", sub: "astrum-env (Python)", blurb: "PyO3 bindings that step the same sim in-process with no network: Env and BatchEnv with NumPy in and out, plus a Gymnasium-style dogfight adapter." },
    { id: "ctl", label: "Flight controllers", sub: "controllers/ (C++, Python)", blurb: "Out-of-sim processes that only ever write control inputs over the wire: hold laws, LQR, MPC, figure-eight and formation followers." },
    { id: "ctltool", label: "Run control", sub: "astrum-ctl", blurb: "Pause, single-step and re-pace a running sim from any client. A paused, stepped and resumed lockstep run ends bit-identical to one flown straight through." },
    { id: "bag", label: "Recorder", sub: "astrum-bag (MCAP)", blurb: "Records every tick, command and event in-process, losslessly at any speed, and replays telemetry paced by sim time." },
    { id: "web", label: "Viewer", sub: "astrum-web + web/", blurb: "An axum telemetry bridge and a browser 3-D renderer (Three.js, procedural meshes) for live fleets or exported bags." },
  ],

  /** One sim tick, in order: the chained schedule from the README. */
  tick: [
    { name: "serve_control", what: "Apply pause, resume, step and speed requests. While paused, hold here and keep re-sending telemetry." },
    { name: "track_controllers", what: "A controller's liveliness token vanished: fail a lockstep run within a tick, or put its aircraft in failsafe hold." },
    { name: "ingest_commands", what: "Decode each aircraft's command; refuse stale, future, duplicate or forged ones. In lockstep, wait here." },
    { name: "expire_leases", what: "A raw command older than its lease puts the aircraft into failsafe hold: current heading, altitude and airspeed." },
    { name: "autopilot_step", what: "Turn autopilot and failsafe targets into normalized control-surface and throttle commands, per vehicle kind." },
    { name: "fire_guns", what: "Rounds leave the muzzle; trigger presses and releases are reported." },
    { name: "step_fdm", what: "Every JSBSim model steps once, each on its fixed worker thread." },
    { name: "resolve_hits", what: "Advance the clock and the bullets, then resolve hits, apply damage, and end the run on elimination." },
    { name: "publish_telemetry", what: "One telemetry message per aircraft at its control rate; with --record, every tick goes to the MCAP bag." },
    { name: "publish_events", what: "This tick's hits, kills, mode changes and presence changes go out on the bus and into the bag." },
  ],

  realism: {
    replay: { kind: "replay", src: "/projects/astrum/split-s.json", caption: "An F-16 split-S, flown in ASTRUM: roll inverted, pull through, and trade altitude for speed.", strips: true },
    facts: [
      { title: "Real flight dynamics", text: "JSBSim computes all motion. Controllers write control inputs, never state; the ECS mirrors the physics and never feeds back into it." },
      { title: "Trimmed starts", text: "Fixed-wing aircraft start trimmed for their scenario's speed and altitude, and a failed trim is fatal rather than silently wrong." },
      { title: "Real coordinates", text: "State is integrated in geodetic WGS84 with heights above the ellipsoid and true airspeed; relative geometry uses a local ENU grid." },
      { title: "Deterministic", text: "For a given scenario, seed and command sequence, the result is identical at any speed and any thread count (tested)." },
      { title: "Fails safe", text: "Commands are a lease. Lose the controller and the aircraft holds heading, altitude and speed instead of departing." },
    ],
  },

  perf: [
    { fleet: "1 × F-16", threads: 1, x: 1126 },
    { fleet: "4 × F-16", threads: 1, x: 340 },
    { fleet: "4 × F-16", threads: 4, x: 685 },
    { fleet: "16 × F-16", threads: 8, x: 345 },
    { fleet: "64 × F-16", threads: 8, x: 45 },
  ],

  projects: [
    {
      slug: "formation-mpc",
      name: "Formation MPC",
      tagline: "A figure-eight leader and three decentralized MPC followers",
      status: "Shipped",
      problem: "Keep a four-ship in formation through hard turns when each follower only sees the others' telemetry, with no central planner.",
      approach: "Each follower runs its own model-predictive controller on a linearized model of its own aircraft, tracking a slot relative to the leader, while the leader flies a tight figure-eight. All four are separate processes talking to the sim over Zenoh.",
      highlights: [
        "Holds 76 to 140 m spacing through a 220 s figure-eight (from the recorded run shown).",
        "79× real time with four Python controllers in lockstep, recording every tick.",
        "Placeholder: one result or lesson in your own words.",
      ],
      tech: ["Python", "C++", "MPC", "LQR", "Zenoh"],
      uses: ["ctl", "bus", "sim", "fdm", "bag", "web"],
      ledTo: ["sweeps"],
      visual: { kind: "replay", src: "/projects/astrum/formation.json", caption: "The recorded four-ship formation run, from above. At this scale the four tracks overlap: the followers hold within about 140 m of the leader for the whole 14 km figure-eight." },
      deck: { vehicle: "jet" },
    },
    {
      slug: "dogfight-env",
      name: "Dogfight environment",
      tagline: "Within-visual-range gun combat between F-16s, as an RL environment",
      status: "Shipped",
      problem: "Training a dogfighting agent needs fast, deterministic, physically honest combat: real flight dynamics, real ballistics, and opponents that punish bad habits.",
      approach: "An M61A1 gun with drag-modelled ballistics, hits and damage inside the sim's tick, exposed through the embedded Python env with no network in the loop. A numpy-only Gym adapter adds the observation vector, reward, episode boundaries and three tiers of scripted opponents.",
      highlights: [
        "The Tier-3 scripted tactician guns the learner down end to end through the real combat pipeline.",
        "Replays shown: a head-on merge decided in 4.7 s, and a 20 s fight ending in a gun kill.",
        "Placeholder: what you learned shaping the reward or the curriculum.",
      ],
      tech: ["Rust", "Bevy", "JSBSim", "PyO3", "NumPy", "Gymnasium"],
      uses: ["env", "sim", "fdm", "geo", "bag"],
      ledTo: ["bfm-program"],
      visual: { kind: "replay", src: "/projects/astrum/merge-20s.json", caption: "A head-on merge: the baseline policy against the Tier-3 opponent, ending in a gun kill at 20 s." },
      deck: { vehicle: "jet" },
    },
    {
      slug: "bfm-program",
      name: "BFM program",
      tagline: "Learning basic fighter maneuvers with TD-MPC2",
      status: "In progress",
      problem: "Scripted opponents plateau. The next step is a learned policy that wins merges by managing energy and turn circles, not by luck.",
      approach: "A TD-MPC2 trainer over the batched embedded env, with a curriculum that tightens the merge geometry as the kill rate passes each gate, an honest weapon-engagement zone, and a library and detector for basic fighter maneuvers.",
      highlights: [
        "Curriculum stages gated on kill rate, with rehearsal workers pinned to earlier stages against forgetting.",
        "Placeholder: the best kill rate so far, and against which opponent.",
      ],
      tech: ["Python", "PyTorch", "TD-MPC2", "CUDA"],
      uses: ["env", "sim", "fdm"],
      visual: { kind: "curve", src: "/projects/astrum/bfm-training.json", caption: "Kill rate against the Tier-3 opponent over training." },
      deck: { vehicle: "jet" },
    },
    {
      slug: "drone-racing",
      name: "Drone racing",
      tagline: "Randomized gate courses for the F450, and a planner that threads them",
      status: "In progress",
      problem: "A square-on gate crossing leaves 0.109 m either side of the airframe, and 0.041 m crabbed 45°: far smaller than any voxel a grid search over a 120 m course could afford.",
      approach: "A randomized racing environment for ASTRUM's quadrotor class, and a C++ controller that reads the course off the wire and plans a line with hybrid A* over the vehicle's own motion, instead of searching free space.",
      highlights: [
        "Plans from the live course, or offline from a dumped course file in about a second.",
        "Placeholder: lap time or gates cleared once the follower flies the line.",
      ],
      tech: ["C++", "Hybrid A*", "Zenoh", "Cap'n Proto"],
      uses: ["ctl", "bus", "sim", "fdm"],
      visual: { kind: "course", src: "/projects/astrum/race-course.json", caption: "A course and its planned line, with the clearance at a gate." },
      deck: { vehicle: "quadcopter" },
      groups: [1],
    },
    {
      slug: "sweeps",
      name: "Scenario sweeps",
      tagline: "Fly a grid of scenario variants at once",
      status: "Shipped",
      problem: "Tuning a controller one run at a time hides how it behaves across the envelope.",
      approach: "astrum-sweep flies one base scenario as a grid of overrides times repeats, many runs at once, and writes each run's scenario, MCAP bag and logs plus a summary CSV of status, seed, varied values and speed.",
      highlights: ["Dry-run mode lists the planned runs before flying anything.", "Placeholder: a sweep you ran and what it showed."],
      tech: ["Rust", "MCAP", "CSV"],
      uses: ["sim", "fdm", "ctl", "bag"],
    },
  ],
};
