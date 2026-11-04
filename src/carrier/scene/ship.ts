import * as THREE from "three";
import { box, CLS, clamp, colored, merge, rng, sstep, tag } from "./util";

/*
 * Units are metres. +x is the bow, +z is starboard, y is up from the waterline.
 * Proportions follow a Nimitz-class carrier: 333 m long, 77 m across the flight deck.
 */

export const DECK_Y = 18.5;

/** Bow catapults. A jet hooked up sits with its centre at `x0`; the shot carries it to `x1`. */
export const CATS = [
  { z: 9.5, x0: 68, x1: 158, turn: 1 },
  { z: -8, x0: 68, x1: 158, turn: -1 },
] as const;

/** Elevator 1, forward of the island. The ambient launches come up on it. */
export const ELEVATOR = { x0: 45, x1: 71, z0: 34, z1: 50, drop: 9 } as const;

/** The angled landing deck: centreline from `origin`, 9° to port. */
export const ANGLED = {
  origin: [-150, 8] as const,
  yaw: THREE.MathUtils.degToRad(9),
  touchdown: 46,
  stop: 132,
  halfWidth: 12,
};
export function angledPoint(s: number, offset = 0): [number, number] {
  const c = Math.cos(ANGLED.yaw), sn = Math.sin(ANGLED.yaw);
  return [ANGLED.origin[0] + s * c + offset * sn, ANGLED.origin[1] - s * sn + offset * c];
}

/** Flight deck outline, stern starboard round to stern port. */
const DECK: [number, number][] = [
  [-162, 27], [-120, 33], [-60, 34], [20, 34], [90, 33], [125, 28], [150, 18], [164, 9], [168, -4],
  [160, -16], [130, -26], [80, -30], [40, -31], [10, -40], [-30, -42], [-70, -40], [-110, -34], [-150, -26], [-163, -18],
];

/** Hull half-beam at the waterline. Mirrored in the sea shader so the hull foam hugs the hull. */
export function halfBeam(x: number) {
  if (x > 160 || x < -158) return -1;
  let b = 20.5;
  if (x > 60) b *= Math.sqrt(Math.max(0, 1 - ((x - 60) / 100) ** 2.2));
  if (x < -130) b *= 1 - 0.17 * ((-130 - x) / 28);
  return b;
}

const ISLAND = { x0: -24, x1: 8, z0: 23, z1: 32 };

// ---------- painted deck ----------
const TX0 = -172, TX1 = 172, TZ0 = -54, TZ1 = 54, PX = 6;

function paintDeck(hullNumber: string) {
  const w = (TX1 - TX0) * PX, h = (TZ1 - TZ0) * PX;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")!] as const;
  };
  const [colC, col] = make(), [clsC, cls] = make();
  const cx = (x: number) => (x - TX0) * PX, cy = (z: number) => (TZ1 - z) * PX;
  const PAINT = "rgb(64,0,0)";

  const outline = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    DECK.forEach(([x, z], i) => (i ? ctx.lineTo(cx(x), cy(z)) : ctx.moveTo(cx(x), cy(z))));
    ctx.closePath();
  };
  // Non-skid: dark grey, mottled, with tie-down pads on a grid.
  col.fillStyle = "#5a6065";
  col.fillRect(0, 0, w, h);
  cls.fillStyle = "rgb(48,0,0)";
  cls.fillRect(0, 0, w, h);
  const r = rng(91);
  for (let i = 0; i < 26000; i++) {
    const v = 74 + r() * 30;
    col.fillStyle = `rgba(${v},${v + 3},${v + 6},${0.25 + r() * 0.35})`;
    col.fillRect(r() * w, r() * h, 2 + r() * 10, 2 + r() * 10);
  }
  col.fillStyle = "rgba(28,30,32,.8)";
  for (let x = -160; x < 166; x += 4.6) for (let z = -40; z < 34; z += 4.6) col.fillRect(cx(x) - 2, cy(z) - 2, 4, 4);

  // Rubber and exhaust stains: the landing area and behind each catapult.
  const smear = (x: number, z: number, len: number, wid: number, yaw: number, n: number, a: number) => {
    for (let i = 0; i < n; i++) {
      const s = (r() - 0.5) * len, o = (r() - 0.5) * wid * (1 - Math.abs(s / len));
      const px = x + s * Math.cos(yaw) + o * Math.sin(yaw), pz = z - s * Math.sin(yaw) + o * Math.cos(yaw);
      col.fillStyle = `rgba(30,32,34,${a * r()})`;
      col.beginPath();
      col.ellipse(cx(px), cy(pz), 6 + r() * 26, 2 + r() * 5, -yaw, 0, Math.PI * 2);
      col.fill();
    }
  };
  const [tx, tz] = angledPoint(70);
  smear(tx, tz, 120, 10, ANGLED.yaw, 500, 0.16);
  for (const cat of CATS) smear(cat.x0 - 16, cat.z, 22, 9, 0, 160, 0.12);

  // Paint helpers: draw the same stroke on the colour and class canvases.
  const stroke = (pts: [number, number][], color: string, width: number, dash: number[] = []) => {
    for (const [ctx, style] of [[col, color], [cls, PAINT]] as const) {
      ctx.beginPath();
      pts.forEach(([x, z], i) => (i ? ctx.lineTo(cx(x), cy(z)) : ctx.moveTo(cx(x), cy(z))));
      ctx.setLineDash(dash.map((d) => d * PX));
      ctx.strokeStyle = style;
      ctx.lineWidth = width * PX;
      ctx.stroke();
    }
    col.setLineDash([]);
    cls.setLineDash([]);
  };
  const curve = (pts: [number, number][], n = 24) => {
    const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    return c.getPoints(n).map((p) => [p.x, p.z] as [number, number]);
  };

  // Deck edge: a thin white line inset from the outline.
  for (const ctx of [col, cls]) {
    outline(ctx);
    ctx.lineWidth = 1.6 * PX;
    ctx.strokeStyle = ctx === col ? "rgba(225,228,224,.85)" : PAINT;
    ctx.setLineDash([3 * PX, 2 * PX]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Angled deck: dashed white edges, a dashed centreline, the foul lines, and four arresting wires.
  const L = 196;
  for (const off of [-ANGLED.halfWidth, ANGLED.halfWidth]) stroke([angledPoint(4, off), angledPoint(L, off)], "#e9ebe6", 0.7, [6, 4]);
  stroke([angledPoint(4), angledPoint(L)], "#f4f2ea", 0.9, [9, 6]);
  for (const off of [-ANGLED.halfWidth - 2.2, ANGLED.halfWidth + 2.2]) stroke([angledPoint(14, off), angledPoint(L, off)], "#d8382c", 0.8, [2.5, 2.5]);
  for (const s of [38, 50, 62, 74]) stroke([angledPoint(s, -14), angledPoint(s, 14)], "#1b1d1f", 0.45);
  // Stern ramp stripes.
  for (let i = -5; i <= 5; i++) stroke([angledPoint(1, i * 2.4), angledPoint(9, i * 2.4)], i % 2 ? "#f2f0e8" : "#2a2c2e", 1.1);

  // Bow catapults: slot, white run lines, yellow hold-back box, and the end marker.
  for (const cat of CATS) {
    const z = cat.z, x0 = cat.x0 + 3, x1 = cat.x1 + 8;
    stroke([[x0, z], [x1, z]], "#101213", 0.5);
    for (const o of [-1.6, 1.6]) stroke([[x0, z + o], [x1, z + o]], "#eceee8", 0.35);
    stroke([[x0 - 3, z - 2.4], [x0 + 3, z - 2.4], [x0 + 3, z + 2.4], [x0 - 3, z + 2.4], [x0 - 3, z - 2.4]], "#f2c21b", 0.5);
    for (let x = x0 + 10; x < x1; x += 10) stroke([[x, z - 2.6], [x, z + 2.6]], "#eceee8", 0.35);
    stroke([[x1 - 2, z - 4], [x1 - 2, z + 4]], "#f2c21b", 0.8);
  }

  // Yellow taxi lines: elevator 1 to cat 1, the port bow park to cat 2, and round the island.
  const Y = "#e8bd22";
  stroke(curve([[58, 40], [52, 28], [54, 16], [62, 10.5], [70, 9.5]]), Y, 0.45);
  stroke(curve([[118, -24], [96, -18], [74, -10], [62, -8]]), Y, 0.45);
  stroke(curve([[-40, 22], [-20, 16], [10, 16], [30, 20], [44, 30]]), Y, 0.45);
  stroke(curve([[-150, 21], [-110, 20], [-70, 19], [-40, 22]]), Y, 0.45);
  stroke(curve([[30, -14], [40, -22], [60, -26], [100, -27]]), Y, 0.45);

  // Hull number on the bow, reading toward the bow, and a smaller one at the stern.
  const number = (x: number, z: number, size: number, rot: number) => {
    for (const [ctx, style] of [[col, "#eef0ea"], [cls, PAINT]] as const) {
      ctx.save();
      ctx.translate(cx(x), cy(z));
      ctx.rotate(rot);
      ctx.font = `bold ${size * PX}px "B612 Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = style;
      ctx.fillText(hullNumber, 0, 0);
      ctx.restore();
    }
  };
  number(140, 1, 15, Math.PI / 2);
  number(-140, 15, 8, Math.PI / 2);

  const colTex = new THREE.CanvasTexture(colC);
  colTex.colorSpace = THREE.SRGBColorSpace;
  colTex.anisotropy = 8;
  colTex.minFilter = THREE.LinearMipmapLinearFilter;
  const clsTex = new THREE.CanvasTexture(clsC);
  clsTex.minFilter = clsTex.magFilter = THREE.NearestFilter;
  clsTex.generateMipmaps = false;
  return { colTex, clsTex };
}

function elevatorTexture() {
  const c = document.createElement("canvas");
  c.width = 260;
  c.height = 160;
  const x = c.getContext("2d")!;
  x.fillStyle = "#43484c";
  x.fillRect(0, 0, 260, 160);
  x.lineWidth = 10;
  for (let i = -160; i < 420; i += 24) {
    x.strokeStyle = (i / 24) % 2 ? "#e8bd22" : "#202224";
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 160, 160);
    x.stroke();
  }
  x.fillStyle = "#43484c";
  x.fillRect(12, 12, 236, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- the ship ----------
export interface Ship {
  group: THREE.Group;
  radar: THREE.Object3D;
  /** Jet blast deflectors, one per cat. Set `rotation.z` to `-angle` to raise. */
  jbd: THREE.Object3D[];
  shuttle: THREE.Object3D[];
  elevator: THREE.Object3D;
  lights: THREE.Object3D;
}

export function buildShip(hullNumber: string): Ship {
  const group = new THREE.Group();
  const { colTex, clsTex } = paintDeck(hullNumber);
  const steel = tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.steel);
  const glass = tag(new THREE.MeshLambertMaterial({ color: "#1b2730" }), CLS.glass);

  // Flight deck slab.
  const deckShape = new THREE.Shape(DECK.map(([x, z]) => new THREE.Vector2(x, -z)));
  const slab = new THREE.ExtrudeGeometry(deckShape, { depth: 4.5, bevelEnabled: false });
  slab.rotateX(-Math.PI / 2);
  slab.translate(0, DECK_Y - 4.5, 0);
  {
    const p = slab.attributes.position, uv = slab.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - TX0) / (TX1 - TX0), (p.getZ(i) - TZ0) / (TZ1 - TZ0));
  }
  const deckMat = new THREE.MeshLambertMaterial({ map: colTex });
  deckMat.onBeforeCompile = (s) => {
    s.uniforms.clsTex = { value: clsTex };
    s.fragmentShader =
      "uniform sampler2D clsTex;\n" +
      s.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n gl_FragColor.a = texture2D(clsTex, vMapUv).r;");
  };
  const sideMat = tag(new THREE.MeshLambertMaterial({ color: "#6f767d" }), CLS.steel);
  const deck = new THREE.Mesh(slab, [deckMat, sideMat]);
  deck.receiveShadow = deck.castShadow = true;
  group.add(deck);

  // Hull: waterline plan extruded up to the deck, flaring outward toward the bow.
  const pts: THREE.Vector2[] = [];
  for (let x = -158; x <= 160; x += 2) pts.push(new THREE.Vector2(x, -Math.max(halfBeam(x), 0.2)));
  for (let x = 160; x >= -158; x -= 2) pts.push(new THREE.Vector2(x, Math.max(halfBeam(x), 0.2)));
  const hullG = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 16.5, bevelEnabled: false });
  hullG.rotateX(-Math.PI / 2);
  hullG.translate(0, -2, 0);
  const hull = hullG.toNonIndexed();
  {
    const p = hull.attributes.position, n = p.count, c = new Float32Array(n * 3);
    const boot = new THREE.Color("#1c1f22"), grey = new THREE.Color("#737a81");
    for (let i = 0; i < n; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, p.getZ(i) * (1 + (0.12 + 0.55 * sstep(40, 150, x)) * clamp((y + 2) / 16.5)));
      (y < 1.2 ? boot : grey).toArray(c, i * 3);
    }
    hull.setAttribute("color", new THREE.BufferAttribute(c, 3));
    hull.deleteAttribute("uv");
    hull.computeVertexNormals();
  }
  const hullMesh = new THREE.Mesh(hull, steel);
  hullMesh.castShadow = hullMesh.receiveShadow = true;
  group.add(hullMesh);

  // Island: stacked blocks with pale tops, a bridge with a window band, a mast and a turning radar.
  const G = "#848b92", T = "#b7bcc1", { x0, x1, z0, z1 } = ISLAND, D = DECK_Y;
  const island = [
    box(x0, x1, D, D + 11, z0, z1, G, T),
    box(x0 + 5, x1 - 4, D + 11, D + 18, z0 + 1, z1 - 0.5, G, T),
    box(x0 + 11, x1 - 6, D + 18, D + 22.5, z0 + 0.4, z1 + 0.8, G, T),
    box(x0 + 15, x1 - 10, D + 22.5, D + 27, z0 + 2.5, z1 - 2, G, T),
    box(x0 + 17.5, x0 + 18.5, D + 27, D + 44, z0 + 4, z0 + 5, "#6c7279"),
    box(x0 + 15, x0 + 21, D + 39, D + 39.6, z0 + 4.2, z0 + 4.8, "#6c7279"),
    box(x0 + 1, x0 + 4, D + 11, D + 14, z0 - 0.5, z0 + 0.6, "#5d636a"),
    box(x1 - 3, x1 - 1, D + 4, D + 7, z0 - 0.6, z0, "#5d636a"),
  ];
  const islandMesh = new THREE.Mesh(merge(island), steel);
  islandMesh.castShadow = islandMesh.receiveShadow = true;
  group.add(islandMesh);
  const windows = new THREE.Mesh(box(x0 + 10.8, x1 - 5.8, D + 19.5, D + 21, z0 + 0.2, z1 + 1, "#1b2730"), glass);
  group.add(windows);
  const radar = new THREE.Group();
  const dish = new THREE.Mesh(merge([box(-3.5, 3.5, 0, 2, -0.25, 0.25, "#9aa0a6", "#c4c8cc"), box(-0.3, 0.3, -1.5, 0, -0.3, 0.3, "#5d636a")]), steel);
  dish.castShadow = true;
  radar.add(dish);
  radar.position.set(x0 + 18, D + 28.6, z0 + 7);
  group.add(radar);

  // Point defence mounts and sponsons at the corners.
  const mounts: THREE.BufferGeometry[] = [];
  for (const [x, z] of [[-156, 24], [-158, -16], [150, 14], [128, -24], [-40, -40]] as const) {
    mounts.push(box(x - 3, x + 3, D - 3, D - 1.4, z - 3, z + 3, "#6f767d", "#8f969c"));
    mounts.push(colored(new THREE.CylinderGeometry(0.9, 1.1, 2.4, 10).translate(x, D - 0.2, z), "#e6e8e6", "#f4f5f2"));
  }
  const mountMesh = new THREE.Mesh(merge(mounts), steel);
  mountMesh.castShadow = true;
  group.add(mountMesh);

  // Elevator 1.
  const elevator = new THREE.Mesh(
    new THREE.BoxGeometry(ELEVATOR.x1 - ELEVATOR.x0, 0.8, ELEVATOR.z1 - ELEVATOR.z0),
    tag(new THREE.MeshLambertMaterial({ map: elevatorTexture() }), CLS.deck),
  );
  elevator.position.set((ELEVATOR.x0 + ELEVATOR.x1) / 2, D - 0.4, (ELEVATOR.z0 + ELEVATOR.z1) / 2);
  elevator.receiveShadow = elevator.castShadow = true;
  group.add(elevator);
  // The other three elevators stay at deck level.
  for (const [ex0, ez0] of [[-55, 34], [-100, 33], [-105, -52]] as const) {
    const e = elevator.clone();
    e.position.set(ex0 + 13, D - 0.4, ez0 + 8);
    group.add(e);
  }

  // Jet blast deflectors (hinged at the edge nearest the jet) and cat shuttles.
  const jbdMat = tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.steel);
  const jbdGeo = merge([box(-4.6, 0, 0, 0.35, -5.8, 5.8, "#585e64", "#6a7076")]);
  const jbd: THREE.Object3D[] = [], shuttle: THREE.Object3D[] = [];
  for (const cat of CATS) {
    const hinge = new THREE.Group();
    const panel = new THREE.Mesh(jbdGeo, jbdMat);
    panel.castShadow = panel.receiveShadow = true;
    hinge.add(panel);
    hinge.position.set(cat.x0 - 9, D, cat.z);
    group.add(hinge);
    jbd.push(hinge);
    const sh = new THREE.Mesh(merge([box(-0.8, 0.8, 0, 0.35, -0.45, 0.45, "#c9ccc8", "#e6e8e4")]), steel);
    sh.position.set(cat.x0 + 4, D, cat.z);
    group.add(sh);
    shuttle.push(sh);
  }

  // Night deck lighting: landing area edge and centreline lights, and the deck edge.
  const lightPts: [number, number, number][] = [];
  for (let s = 6; s < 196; s += 6) {
    for (const off of [-ANGLED.halfWidth, ANGLED.halfWidth]) lightPts.push([...angledPoint(s, off), 0]);
    if (s % 12 === 0) lightPts.push([...angledPoint(s), 1]);
  }
  for (let i = 0; i < DECK.length; i++) {
    const [ax, az] = DECK[i], [bx, bz] = DECK[(i + 1) % DECK.length], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 9);
    for (let k = 0; k < n; k++) lightPts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n, 2]);
  }
  const lights = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.7, 0.25, 0.7),
    tag(new THREE.MeshBasicMaterial({ color: "#ffffff" }), CLS.light),
    lightPts.length,
  );
  {
    const o = new THREE.Object3D(), c = new THREE.Color();
    const tones = [new THREE.Color(0.9, 0.85, 0.7), new THREE.Color(0.45, 0.65, 1.05), new THREE.Color(0.35, 0.55, 0.95)];
    lightPts.forEach(([x, z, k], i) => {
      o.position.set(x, D + 0.12, z);
      o.updateMatrix();
      lights.setMatrixAt(i, o.matrix);
      lights.setColorAt(i, c.copy(tones[k]));
    });
  }
  lights.visible = false;
  group.add(lights);

  return { group, radar, jbd, shuttle, elevator, lights };
}

/** A destroyer escort: hull, superstructure, mast. Bow at +x, length about 155 m. */
export function buildEscort() {
  const steel = tag(new THREE.MeshLambertMaterial({ vertexColors: true }), CLS.steel);
  const pts: THREE.Vector2[] = [];
  const hb = (x: number) => (x > 30 ? 10 * Math.sqrt(Math.max(0, 1 - ((x - 30) / 48) ** 2)) : x < -70 ? 10 - (-70 - x) * 0.35 : 10);
  for (let x = -77; x <= 78; x += 3) pts.push(new THREE.Vector2(x, -Math.max(hb(x), 0.2)));
  for (let x = 78; x >= -77; x -= 3) pts.push(new THREE.Vector2(x, Math.max(hb(x), 0.2)));
  const hull = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 9, bevelEnabled: false });
  hull.rotateX(-Math.PI / 2);
  hull.translate(0, -1, 0);
  const parts = [
    colored(hull, "#6f767d", "#59606a"),
    box(-30, 28, 8, 15, -7, 7, "#8a9097", "#b4b9be"),
    box(-14, 18, 15, 21, -5.5, 5.5, "#8a9097", "#b4b9be"),
    box(0, 2, 21, 34, -0.5, 0.5, "#6c7279"),
    box(-38, -30, 8, 12, -3, 3, "#8a9097", "#b4b9be"),
    box(38, 50, 8, 9.2, -2, 2, "#6c7279", "#8a9097"),
  ];
  const mesh = new THREE.Mesh(merge(parts), steel);
  mesh.castShadow = true;
  return mesh;
}
