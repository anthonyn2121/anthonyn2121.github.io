import * as THREE from "three";
import { setSelectColor } from "./jet";
import { FlightOps, type DeckState, type Phase, type ProjectSpec } from "./ops";
import { Post } from "./post";
import { buildSea } from "./sea";
import { buildEscort, buildShip, DECK_Y } from "./ship";
import { time } from "./util";

export type { DeckState, Phase, ProjectSpec };

/** Where a project's vehicle is on screen, in CSS pixels relative to the canvas. */
export interface DeckTag {
  slug: string;
  x: number;
  y: number;
  /** Screen length of the jet, for sizing the hit area. */
  size: number;
  visible: boolean;
  state: DeckState;
  phase: Phase;
}

export interface CarrierScene {
  launch(slug: string): void;
  recall(slug: string): void;
  hover(slug: string | null): void;
  setTheme(theme: "day" | "night"): void;
  setPaused(paused: boolean): void;
  /** Stops rendering while the hero is scrolled away or the tab is hidden. */
  setActive(active: boolean): void;
  /** Pointer position over the hero, -1 to 1 on each axis. */
  setPointer(x: number, y: number): void;
  onFrame(cb: (tags: DeckTag[]) => void): () => void;
  /** Smoothed frame rate and the current quality level (0 is full). */
  stats(): { fps: number; level: number };
  dispose(): void;
}

export interface SceneOptions {
  projects: ProjectSpec[];
  hullNumber: string;
  theme: "day" | "night";
  /** Reduced motion: one still frame, no camera sweep, no launches. */
  still: boolean;
}

/** One camera sweep, s; the camera eases across and back, so the loop never jumps. */
const SWEEP = 36;
/** A moment for the still frame: a jet run up on cat 1 with its deflector raised. */
const STILL_T = 9.2;
/**
 * Camera looks aft-port from off the starboard bow, so the project row and the bow cats sit side by
 * side in the sharp band, launches leave to the right, and the landing area recedes into the top blur.
 */
const TARGET = new THREE.Vector3(46, DECK_Y, 13);
const AZIMUTH = 59;
/** Close enough that an F-35C spans about 15 glyphs, far enough to hold the project row and both cats. */
const DISTANCE = 188;
/** Where the sharp band sits when nothing is being followed, 0 at the bottom of the view. */
const BASE_FOCUS = 0.46;
/** Fallbacks for slow GPUs, in order: render smaller, then lighter shadows, then drop the blur. */
const QUALITY = [
  { scale: 1, shadow: 4096, tilt: true },
  { scale: 0.75, shadow: 2048, tilt: true },
  { scale: 0.5, shadow: 2048, tilt: true },
  { scale: 0.5, shadow: 1024, tilt: false },
] as const;
const MAX_INTERNAL_W = 1800;

export function createCarrierScene(canvas: HTMLCanvasElement, opts: SceneOptions): CarrierScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight("#ffe9c9", 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 230, bottom: -230, near: 10, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  sun.position.set(TARGET.x - 170, 260, TARGET.z - 45);
  sun.target.position.copy(TARGET);
  const hemi = new THREE.HemisphereLight("#dfe8f2", "#2c3a44", 1.5);
  scene.add(sun, sun.target, hemi);

  const ship = buildShip(opts.hullNumber);
  scene.add(ship.group);
  const escortPos = new THREE.Vector2(330, -360);
  const escort = buildEscort();
  escort.position.set(escortPos.x, 0, escortPos.y);
  scene.add(escort);
  const sea = buildSea(escortPos);
  scene.add(sea.mesh);
  const ops = new FlightOps(scene, ship, opts.projects);
  const post = new Post();
  let clock = opts.still ? STILL_T : 0, last = performance.now(), paused = false, active = true, raf = 0, dirty = true;

  const camera = new THREE.PerspectiveCamera(23, 16 / 9, 20, 2400);
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let distance = DISTANCE;
  // Where the camera is paying attention, eased: w is how much it follows, reach how far (recoveries pan further).
  const look = { x: TARGET.x, y: TARGET.y, z: TARGET.z, w: 0, reach: 0 };
  const aim = new THREE.Vector3(), lookPt = new THREE.Vector3();
  function placeCamera(t: number, dt: number) {
    const k = opts.still ? 0.5 : 0.5 - 0.5 * Math.cos((Math.PI * t) / SWEEP);
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;

    // Follow a visitor's launch part of the way, and pan most of the way aft for a recovery, then ease back.
    const a = opts.still ? null : ops.attention, e = 1 - Math.exp(-dt * 2.4);
    look.w += ((a ? 1 : 0) - look.w) * e;
    if (a) {
      look.x += (a.x - look.x) * e;
      look.y += (a.y - look.y) * e;
      look.z += (a.z - look.z) * e;
      look.reach += ((a.kind === "recover" ? 1 : 0) - look.reach) * e;
    }
    const dx = look.x - TARGET.x, dz = look.z - TARGET.z, len = Math.hypot(dx, dz);
    // Track the followed jet nearly all the way (up to 150 m), so a shot down the bow and a trap aft both stay in frame.
    const reach = Math.min(len * 0.9, 150);
    const pan = len > 0 ? (reach / len) * look.w : 0;
    aim.set(TARGET.x + dx * pan, TARGET.y, TARGET.z + dz * pan);

    const az = THREE.MathUtils.degToRad(AZIMUTH + 9 * (k - 0.5) - 3 * pointer.sx);
    const el = THREE.MathUtils.degToRad(54 + 1.2 * Math.sin(k * Math.PI) + 1.5 * pointer.sy);
    // Pull back while following a launch, so the climb-out stays in frame against the sea.
    const R = distance * (1 - 0.03 * k) * (1 + look.w * (0.35 - 0.25 * look.reach));
    camera.position.set(aim.x + Math.cos(az) * Math.cos(el) * R, aim.y + Math.sin(el) * R, aim.z + Math.sin(az) * Math.cos(el) * R);
    camera.lookAt(aim);
    camera.updateMatrixWorld();

    // Rack the tilt-shift focus onto the followed jet, like a miniature photographer pulling focus.
    const v = lookPt.set(look.x, look.y, look.z).project(camera).y * 0.5 + 0.5;
    post.focus = BASE_FOCUS + (THREE.MathUtils.clamp(v, 0.3, 0.74) - BASE_FOCUS) * look.w;
  }

  let cssW = 1, cssH = 1;
  function resize() {
    cssW = Math.max(1, canvas.clientWidth);
    cssH = Math.max(1, canvas.clientHeight);
    const scale = Math.min(1, MAX_INTERNAL_W / cssW) * QUALITY[level].scale;
    const w = Math.round(cssW * scale), h = Math.round(cssH * scale);
    renderer.setSize(w, h, false);
    post.setSize(w, h, cssW, cssH);
    camera.aspect = cssW / cssH;
    // Narrow screens: back off a little as the view gets taller, but not so far that the deck shrinks to nothing.
    distance = DISTANCE * Math.max(1, Math.sqrt(1.45 / camera.aspect));
    camera.updateProjectionMatrix();
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function setTheme(theme: "day" | "night") {
    const night = theme === "night";
    sun.color.set(night ? "#9fb6ff" : "#ffe9c9");
    sun.intensity = night ? 0.95 : 3.1;
    hemi.color.set(night ? "#5b6f94" : "#dfe8f2");
    hemi.groundColor.set(night ? "#0b1018" : "#2c3a44");
    hemi.intensity = night ? 0.7 : 1.5;
    sea.night.value = post.night.value = night ? 1 : 0;
    ship.lights.visible = night;
    ops.night = night;
    setSelectColor(night ? "#3fd0e8" : "#2f7bf0");
    invalidate();
  }
  setTheme(opts.theme);

  const listeners = new Set<(tags: DeckTag[]) => void>();
  const v = new THREE.Vector3(), nose = new THREE.Vector3(), tail = new THREE.Vector3();
  function emitTags() {
    if (!listeners.size) return;
    const tags = ops.projects.map((p) => {
      const r = p.craft.root;
      v.copy(r.position).setY(r.position.y + 3.5).project(camera);
      nose.set(p.craft.length[0], 0, 0).applyMatrix4(r.matrixWorld).project(camera);
      tail.set(p.craft.length[1], 0, 0).applyMatrix4(r.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * cssW, y = (0.5 - v.y * 0.5) * cssH;
      const size = Math.hypot((nose.x - tail.x) * 0.5 * cssW, (nose.y - tail.y) * 0.5 * cssH);
      const onScreen = v.z < 1 && x > -40 && x < cssW + 40 && y > -40 && y < cssH + 40;
      return { slug: p.slug, x, y, size, visible: r.visible && onScreen, state: p.state, phase: p.phase };
    });
    for (const l of listeners) l(tags);
  }
  function draw(dt: number) {
    time.value = clock;
    ops.update(clock);
    placeCamera(clock, dt);
    scene.updateMatrixWorld();
    post.render(renderer, scene, camera);
    emitTags();
  }

  // Adaptive quality: if frames stay slow for a couple of seconds, step down a level. The glyph grid
  // stays tied to CSS pixels, so the page looks the same, only softer per glyph and, at the end, unblurred.
  let level = 0, slowFrames = 0, sampled = 0, fps = 60;
  function applyQuality() {
    const q = QUALITY[level];
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    post.blur = q.tilt;
    resize();
  }
  function frame(now: number) {
    raf = 0;
    const running = active && !paused && !opts.still;
    const dt = Math.min(0.1, (now - last) / 1000);
    if (running) clock += dt;
    last = now;
    if (running && dt > 0) {
      fps += (1 / dt - fps) * 0.05;
      if (level < QUALITY.length - 1) {
        sampled++;
        if (dt > 1 / 38) slowFrames++;
        if (sampled >= 90) {
          if (slowFrames > 60) {
            level++;
            applyQuality();
          }
          sampled = slowFrames = 0;
        }
      }
    }
    if (running || dirty) {
      dirty = false;
      draw(running ? dt : 0);
    }
    if (running || Math.abs(pointer.x - pointer.sx) + Math.abs(pointer.y - pointer.sy) > 0.002) raf = requestAnimationFrame(frame);
  }
  function invalidate() {
    dirty = true;
    if (!raf && active) raf = requestAnimationFrame(frame);
  }
  const onVisibility = () => {
    last = performance.now();
    invalidate();
  };
  document.addEventListener("visibilitychange", onVisibility);
  resize();

  return {
    launch: (slug) => {
      ops.open = slug;
      if (!opts.still) ops.launch(slug);
      invalidate();
    },
    recall: (slug) => {
      if (ops.open === slug) ops.open = null;
      ops.recall(slug);
      invalidate();
    },
    hover: (slug) => {
      ops.hover(slug);
      invalidate();
    },
    setTheme,
    setPaused: (p) => {
      paused = p;
      last = performance.now();
      invalidate();
    },
    setActive: (a) => {
      active = a && !document.hidden;
      last = performance.now();
      invalidate();
    },
    setPointer: (x, y) => {
      if (opts.still) return;
      pointer.x = x;
      pointer.y = y;
      invalidate();
    },
    onFrame: (cb) => {
      listeners.add(cb);
      invalidate();
      return () => listeners.delete(cb);
    },
    stats: () => ({ fps, level }),
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      post.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const m of [o.material].flat()) {
            for (const val of Object.values(m)) if (val instanceof THREE.Texture) val.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}
