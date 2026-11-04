import * as THREE from "three";
import { box, CLS, colored, merge, tag } from "./util";

/*
 * An F-35C, the carrier variant: wide chined body with caret intakes, a large trapezoidal wing
 * whose outer panels fold up for parking, twin tails canted outward, a gold-tinted canopy, and
 * no external stores. Metres, nose at +x, wheels on y = 0.
 */

const FUS_Y = 1.9;
const WING_Y = FUS_Y - 0.12;
const WING_T = 0.14;
/** Spanwise station of the wing fold. Spread span 13.1 m, folded about 9.5 m. */
const FOLD_Z = 4.75;
const TIP_Z = 6.55;

/** Nose and tail stations, for sizing screen hit areas. */
export const JET_NOSE = 7.6;
export const JET_TAIL = -8.1;

/** A flat panel from (x, z) points in the deck plane, `thick` metres deep, bottom face at y = 0. */
function panel(pts: [number, number][], thick: number, hex: string, top: string) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return colored(g, hex, top);
}
const mirror = (pts: [number, number][]) => pts.map(([x, z]) => [x, -z] as [number, number]).reverse();

const BODY = "#767d84", BODY_TOP = "#8d949b", WING = "#70777e", WING_TOP = "#868d94";

/** The airframe in two parts: fuselage (intakes, gear, nozzle) and flying surfaces, which glyph differently. */
function airframe() {
  const profile: [number, number][] = [
    [JET_NOSE, 0], [7, 0.22], [6, 0.48], [5, 0.68], [4, 0.82], [2.5, 0.95], [0, 1], [-3, 0.98], [-5, 0.85], [-6.4, 0.68], [-7, 0.6], [-7.02, 0],
  ];
  const fus = new THREE.LatheGeometry(profile.map(([x, r]) => new THREE.Vector2(r, x)).reverse(), 16);
  fus.rotateZ(-Math.PI / 2);
  fus.scale(1, 0.68, 1.9);
  fus.translate(0, FUS_Y, 0);

  // Inner wing, root to the fold: leading edge swept 34°, trailing edge swept slightly forward.
  const innerHalf: [number, number][] = [[2.6, 1], [1.2, 1.6], [-0.93, FOLD_Z], [-4.27, FOLD_Z], [-5.2, 1.6], [-5.3, 1]];
  const wing = panel([...innerHalf, ...mirror(innerHalf)], WING_T, WING, WING_TOP).translate(0, WING_Y, 0);
  const stabHalf: [number, number][] = [[-5.5, 1.1], [-7, 3.35], [JET_TAIL, 3.35], [JET_TAIL, 0.9]];
  const stab = panel([...stabHalf, ...mirror(stabHalf)], 0.1, WING, WING_TOP).translate(0, FUS_Y - 0.18, 0);

  const finShape = new THREE.Shape([[-4.3, 0], [-6.1, 2.5], [-7, 2.5], [-7.3, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
  const body = [colored(fus, BODY, BODY_TOP)], surfaces = [wing, stab];
  for (const s of [-1, 1]) {
    // Twin tails canted 25° outward.
    const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06);
    fin.rotateX(s * THREE.MathUtils.degToRad(25));
    fin.translate(0, FUS_Y + 0.45, s * 1.5);
    surfaces.push(colored(fin, BODY));
    // Caret intakes beside the cockpit, and the main gear.
    body.push(box(1.2, 3.8, FUS_Y - 0.6, FUS_Y + 0.28, s > 0 ? 1.5 : -2.2, s > 0 ? 2.2 : -1.5, BODY, BODY_TOP));
    body.push(box(-1.1, -0.9, 0, FUS_Y - 0.55, s * 1.7 - 0.12, s * 1.7 + 0.12, "#33373b"));
  }
  body.push(box(4.5, 4.7, 0, FUS_Y - 0.55, -0.1, 0.1, "#33373b"));
  body.push(colored(new THREE.CylinderGeometry(0.55, 0.62, 0.8, 14).rotateZ(Math.PI / 2).translate(-7.3, FUS_Y, 0), "#4a4f54", "#5a6066"));
  return { body: merge(body), surfaces: merge(surfaces) };
}

/** Outer wing panel for one side, with the fold hinge at the local origin. */
function outerGeometry(side: 1 | -1) {
  const pts: [number, number][] = [[-0.93, FOLD_Z], [-2.14, TIP_Z], [-3.74, TIP_Z], [-4.27, FOLD_Z]];
  const g = panel(side > 0 ? pts : mirror(pts), WING_T, WING, WING_TOP);
  return g.translate(0, 0, -side * FOLD_Z);
}

const frame = airframe();
const geo = {
  body: frame.body,
  surfaces: frame.surfaces,
  outer: { [1]: outerGeometry(1), [-1]: outerGeometry(-1) },
  canopy: new THREE.SphereGeometry(1, 16, 10).scale(1.5, 0.42, 0.48).translate(3.6, FUS_Y + 0.6, 0),
  /** Base at the origin, tip trailing 4.2 m aft; placed at the nozzle so scaling grows it from there. */
  plume: new THREE.ConeGeometry(0.5, 4.2, 10, 1, true).rotateZ(Math.PI / 2).translate(-2.1, 0, 0),
  light: new THREE.SphereGeometry(0.35, 6, 4),
};

const mats = {
  body: tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.jet),
  wing: tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.jetWing),
  selected: tag(new THREE.MeshLambertMaterial({ color: "#3fd0e8", emissive: "#0f4f5c" }), CLS.jet),
  selectedWing: tag(new THREE.MeshLambertMaterial({ color: "#3fd0e8", emissive: "#0f4f5c" }), CLS.jetWing),
  canopy: tag(new THREE.MeshLambertMaterial({ color: "#d9a43a", emissive: "#3a2508" }), CLS.canopy),
  plume: tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1, 0.28), side: THREE.DoubleSide }), CLS.plume),
  red: tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.12, 0.1) }), CLS.light),
  green: tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.12, 1.6, 0.35) }), CLS.light),
  white: tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5) }), CLS.light),
};

const selectMats: THREE.MeshLambertMaterial[] = [mats.selected, mats.selectedWing];

/** A highlight material for a surface class, recoloured with the others by `setSelectColor`. */
export function selectMaterial(cls: number) {
  const m = tag(new THREE.MeshLambertMaterial({ color: "#3fd0e8", emissive: "#0f4f5c" }), cls);
  selectMats.push(m);
  return m;
}

/** Recolours every selection highlight to the theme's `--select`. */
export function setSelectColor(hex: string) {
  for (const m of selectMats) {
    m.color.set(hex);
    m.emissive.set(hex).multiplyScalar(0.3);
  }
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch?: number;
  roll?: number;
  /** Afterburner plume, 0 to 1. */
  burner?: number;
  /** Wing fold, 0 spread to 1 folded. */
  fold?: number;
  /** Rotor speed for multirotors, 0 stopped to 1 flying. */
  spin?: number;
}

/** Anything that can stand in for a project on deck. */
export interface Vehicle {
  readonly root: THREE.Object3D;
  /** Nose and tail stations along local x, for sizing the tag's hit area. */
  readonly length: readonly [number, number];
  pose(p: Pose): void;
  selected: boolean;
  night: boolean;
}

/** Folded outer panels stand just short of vertical. */
const FOLD_ANGLE = THREE.MathUtils.degToRad(88);

export class Jet implements Vehicle {
  readonly root = new THREE.Group();
  readonly length = [JET_NOSE, JET_TAIL] as const;
  /** Each skin mesh with its normal and highlighted material. */
  private readonly skin: [THREE.Mesh, THREE.Material, THREE.Material][] = [];
  private readonly hinges: [THREE.Object3D, 1 | -1][] = [];
  private readonly plume: THREE.Mesh;
  private readonly navLights: THREE.Mesh[] = [];
  private isNight = false;
  private fold = 0;

  constructor() {
    const body = new THREE.Mesh(geo.body, mats.body);
    const surfaces = new THREE.Mesh(geo.surfaces, mats.wing);
    const canopy = new THREE.Mesh(geo.canopy, mats.canopy);
    this.plume = new THREE.Mesh(geo.plume, mats.plume);
    this.plume.position.set(-7.7, FUS_Y, 0);
    this.plume.visible = false;
    this.skin.push([body, mats.body, mats.selected], [surfaces, mats.wing, mats.selectedWing]);
    for (const side of [1, -1] as const) {
      const hinge = new THREE.Group();
      hinge.position.set(0, WING_Y, side * FOLD_Z);
      const outer = new THREE.Mesh(geo.outer[side], mats.wing);
      outer.castShadow = outer.receiveShadow = true;
      // Navigation lights ride on the wingtips, so they fold with them: red to port, green to starboard.
      const light = new THREE.Mesh(geo.light, side > 0 ? mats.green : mats.red);
      light.position.set(-3, 0.1, side * (TIP_Z - FOLD_Z));
      hinge.add(outer, light);
      this.navLights.push(light);
      this.skin.push([outer, mats.wing, mats.selectedWing]);
      this.hinges.push([hinge, side]);
      this.root.add(hinge);
    }
    const tail = new THREE.Mesh(geo.light, mats.white);
    tail.position.set(-6.8, FUS_Y + 2.9, 0);
    this.navLights.push(tail);
    this.lights();
    body.castShadow = surfaces.castShadow = canopy.castShadow = true;
    body.receiveShadow = surfaces.receiveShadow = true;
    this.root.add(body, surfaces, canopy, this.plume, tail);
    this.root.rotation.order = "YZX";
  }

  pose(p: Pose) {
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.set(p.roll ?? 0, p.yaw, p.pitch ?? 0);
    const b = p.burner ?? 0;
    this.plume.visible = b > 0.02;
    this.plume.scale.setScalar(0.45 + 0.55 * b);
    // Starboard panel folds up by turning about -x, port about +x.
    this.fold = p.fold ?? 0;
    for (const [hinge, side] of this.hinges) hinge.rotation.x = -side * FOLD_ANGLE * this.fold;
    this.lights();
  }

  set selected(on: boolean) {
    for (const [mesh, normal, highlighted] of this.skin) mesh.material = on ? highlighted : normal;
  }

  /** Navigation lights burn at night once the jet is manned and spread; parked jets stay dark. */
  set night(on: boolean) {
    this.isNight = on;
    this.lights();
  }

  private lights() {
    for (const l of this.navLights) l.visible = this.isNight && this.fold < 0.5;
  }
}
