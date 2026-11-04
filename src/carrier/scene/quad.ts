import * as THREE from "three";
import { selectMaterial, type Pose, type Vehicle } from "./jet";
import { DECK_Y } from "./ship";
import { box, CLS, colored, merge, tag, time } from "./util";

/*
 * A Group 1 quadcopter (under 20 lb): X-frame, four props, a gimbal under the nose, skids.
 * Real size is about 1 m motor to motor; it is drawn 3.2× so it reads at deck scale, next
 * to 15 m jets. Built in real metres with +x forward; the root carries the scale.
 */

const SCALE = 3.2;
const ARM = 0.5;
const PROP_R = 0.19;
const LEG = 0.25;

function frameGeometry() {
  const parts = [
    box(-0.17, 0.17, LEG, LEG + 0.12, -0.17, 0.17, "#3a3f45", "#555b62"),
    box(-0.1, 0.1, LEG + 0.12, LEG + 0.18, -0.07, 0.07, "#4a5057", "#6a7178"),
    colored(new THREE.SphereGeometry(0.05, 10, 8).translate(0.15, LEG - 0.02, 0), "#202326"),
  ];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, cx = Math.cos(a) * ARM, cz = Math.sin(a) * ARM;
    const arm = new THREE.BoxGeometry(ARM, 0.035, 0.04).translate(ARM / 2, 0, 0).rotateY(-a).translate(0, LEG + 0.06, 0);
    parts.push(colored(arm, "#50565c", "#666d74"));
    parts.push(colored(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10).translate(cx, LEG + 0.1, cz), "#2c3034"));
  }
  for (const s of [-1, 1]) parts.push(box(-0.16, 0.16, 0, 0.02, s * 0.14 - 0.01, s * 0.14 + 0.01, "#2c3034"), box(-0.01, 0.01, 0, LEG, s * 0.14 - 0.01, s * 0.14 + 0.01, "#2c3034"));
  return merge(parts);
}

const geo = {
  frame: frameGeometry(),
  blades: new THREE.BoxGeometry(PROP_R * 2, 0.006, 0.03),
  disc: new THREE.CylinderGeometry(PROP_R, PROP_R, 0.004, 20),
  led: new THREE.SphereGeometry(0.03, 6, 4),
};

const mats = {
  frame: tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.jet),
  selected: selectMaterial(CLS.jet),
  rotor: tag(new THREE.MeshLambertMaterial({ color: "#c9cdd0" }), CLS.rotor),
  red: tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.15, 0.1) }), CLS.light),
  green: tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 1.8, 0.4) }), CLS.light),
  white: tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6) }), CLS.light),
};

/** Visual prop speed at full spin, rad/s: slow enough that the blades don't alias into a stutter. */
const PROP_RATE = 9;

export class Quad implements Vehicle {
  readonly root = new THREE.Group();
  readonly length = [0.7 * SCALE, -0.7 * SCALE] as const;
  private readonly frame: THREE.Mesh;
  private readonly props: { blade: THREE.Mesh; disc: THREE.Mesh; dir: number }[] = [];
  private readonly leds: THREE.Mesh[] = [];
  private angle = 0;
  private lastT = 0;
  private lastSpin = 0;
  private isNight = false;

  constructor() {
    this.frame = new THREE.Mesh(geo.frame, mats.frame);
    this.frame.castShadow = true;
    const body = new THREE.Group();
    body.scale.setScalar(SCALE);
    body.add(this.frame);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, x = Math.cos(a) * ARM, z = Math.sin(a) * ARM;
      const blade = new THREE.Mesh(geo.blades, mats.rotor), disc = new THREE.Mesh(geo.disc, mats.rotor);
      blade.position.set(x, LEG + 0.14, z);
      disc.position.copy(blade.position);
      blade.castShadow = true;
      body.add(blade, disc);
      this.props.push({ blade, disc, dir: i % 2 ? 1 : -1 });
      // Front arms carry red (port) and green (starboard); the rear arms white.
      const led = new THREE.Mesh(geo.led, x > 0 ? (z < 0 ? mats.red : mats.green) : mats.white);
      led.position.set(x, LEG + 0.04, z);
      body.add(led);
      this.leds.push(led);
    }
    this.root.add(body);
    this.root.rotation.order = "YZX";
    this.pose({ x: 0, y: DECK_Y, z: 0, yaw: 0 });
  }

  pose(p: Pose) {
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.set(p.roll ?? 0, p.yaw, p.pitch ?? 0);
    const spin = p.spin ?? 0;
    // Props turn by spin speed on the scene clock (so they stop when paused); fast props show as a disc.
    const dt = Math.min(0.1, Math.max(0, time.value - this.lastT));
    this.lastT = time.value;
    this.angle += spin * PROP_RATE * dt;
    for (const pr of this.props) {
      pr.blade.rotation.y = this.angle * pr.dir;
      pr.blade.visible = spin < 0.75;
      pr.disc.visible = spin >= 0.35;
    }
    this.lastSpin = spin;
    this.lights();
  }

  set selected(on: boolean) {
    this.frame.material = on ? mats.selected : mats.frame;
  }

  set night(on: boolean) {
    this.isNight = on;
    this.lights();
  }

  /** Strobes and position lights burn once armed; at night they also show parked. */
  private lights() {
    for (const l of this.leds) l.visible = this.lastSpin > 0.05 || this.isNight;
  }
}

/** A painted UAS landing pad: white outer ring, yellow inner ring, white cross. */
export function buildPad(x: number, z: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#5a6065";
  g.fillRect(0, 0, 256, 256);
  const ring = (r: number, w: number, color: string) => {
    g.beginPath();
    g.arc(128, 128, r, 0, Math.PI * 2);
    g.lineWidth = w;
    g.strokeStyle = color;
    g.stroke();
  };
  ring(118, 12, "#eef0ea");
  ring(78, 10, "#f2c21b");
  g.fillStyle = "#eef0ea";
  g.fillRect(122, 70, 12, 116);
  g.fillRect(70, 122, 116, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40).rotateX(-Math.PI / 2), tag(new THREE.MeshLambertMaterial({ map: t }), CLS.paint));
  pad.position.set(x, DECK_Y + 0.04, z);
  pad.receiveShadow = true;
  return pad;
}
