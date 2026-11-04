import * as THREE from "three";
import { CLS, time } from "./util";

/*
 * The glyph pass and the tilt-shift pass, after the ascii-diorama skill's starter scene.
 * Each grid cell samples the scene at its own mip level, reads the surface class from alpha,
 * and picks a glyph from that class's rule, its brightness, and its edge direction.
 */

const GLYPHS = " .'`,:;-~=+*oOsS$%&8#@/\\|_^vx\u2014";
const GI = Object.fromEntries([...GLYPHS].map((c, i) => [c, i]));
const g = (c: string) => GI[c].toFixed(1);

function atlas() {
  const tw = 64, th = 120, c = document.createElement("canvas");
  c.width = tw * GLYPHS.length;
  c.height = th;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#fff";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = "bold 100px Menlo, Monaco, ui-monospace, monospace";
  [...GLYPHS].forEach((ch, i) => (ch === "\u2014" ? x.fillRect(i * tw, th * 0.44, tw, th * 0.12) : x.fillText(ch, (i + 0.5) * tw, th * 0.52)));
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  t.flipY = false;
  return t;
}

const asciiFrag = /* glsl */ `
precision highp float;
uniform sampler2D uScene, uAtlas; uniform vec2 uGrid; uniform float uTime, uN, uNight;
in vec2 vUv; out vec4 outColor;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float lum(vec3 c){ return dot(c,vec3(.25,.6,.15)); }
vec3 grade(vec3 c){
  c = max(c,0.); c = c/(1.+c*.12);
  c *= mix(1., 2.1, uNight);
  c = pow(c,vec3(1./2.2));
  c = mix(c,c*c*(3.-2.*c),.5);
  float l = lum(c); c = mix(vec3(l),c,mix(1.28,1.1,uNight));
  return clamp(c,0.,1.);
}
void main(){
  vec2 g = vUv*uGrid, cell = floor(g), cuv = (cell+.5)/uGrid;
  ivec2 sz = textureSize(uScene,0);
  float lodC = log2(float(sz.x)/uGrid.x)+.05;
  vec3 col = grade(textureLod(uScene,cuv,lodC).rgb);
  float cls = floor(texelFetch(uScene,ivec2(cuv*vec2(sz)),0).a*16.+.5);
  float L = lum(col);
  vec2 e = 1./uGrid;
  float lx0=lum(grade(textureLod(uScene,cuv-vec2(e.x,0),lodC).rgb)), lx1=lum(grade(textureLod(uScene,cuv+vec2(e.x,0),lodC).rgb));
  float ly0=lum(grade(textureLod(uScene,cuv-vec2(0,e.y),lodC).rgb)), ly1=lum(grade(textureLod(uScene,cuv+vec2(0,e.y),lodC).rgb));
  vec2 grad = vec2(lx1-lx0,(ly1-ly0)*.55); float mag = length(grad);
  float a4 = mod(atan(grad.y,grad.x)+.3927,3.14159)/.7854;
  float edgeG = a4<1.?${g("|")}:a4<2.?${g("\\")}:a4<3.?${g("\u2014")}:${g("/")};
  float w = vn(cell*vec2(.05,.09)+vec2(-uTime*.22,uTime*.06))*2.-1.;
  float gl = ${g(".")};
  if(cls<${CLS.water}.5){ // water
    gl = L<.1?${g("-")}:L<.22?(w>.1?${g("~")}:${g("-")}):L<.4?(w>-.3?${g("~")}:${g("=")}):${g("=")};
  } else if(cls<${CLS.foam}.5){
    gl = L<.6?${g("*")}:L<.82?${g("%")}:${g("#")};
  } else if(cls<${CLS.deck}.5){ // non-skid
    gl = L<.14?${g(".")}:L<.24?${g(":")}:L<.42?(w>.25?${g("=")}:w<-.25?${g("-")}:${g(":")}):L<.56?${g("=")}:${g("#")};
  } else if(cls<${CLS.paint}.5){ // deck markings
    gl = mag>.08?edgeG:(L<.4?${g("=")}:${g("#")});
  } else if(cls<${CLS.steel}.5){ // hull and island
    gl = L<.12?${g(":")}:L<.28?${g("%")}:${g("#")};
    if(mag>.16) gl = edgeG;
  } else if(cls<${CLS.jet}.5){
    gl = L<.2?${g("%")}:L<.55?${g("#")}:${g("@")};
    if(mag>.2) gl = edgeG;
  } else if(cls<${CLS.canopy}.5){
    gl = L<.45?${g("o")}:${g("O")};
  } else if(cls<${CLS.crew}.5){
    gl = L<.4?${g("&")}:${g("$")};
  } else if(cls<${CLS.steam}.5){
    gl = L<.45?${g(":")}:L<.75?${g("*")}:${g("%")};
  } else if(cls<${CLS.plume}.5){
    gl = L<.6?${g("+")}:${g("*")};
  } else if(cls<${CLS.light}.5){
    gl = ${g("+")};
  } else if(cls<${CLS.wake}.5){ // churned water behind the ship
    gl = L<.3?${g("~")}:L<.6?${g("=")}:${g("%")};
  } else if(cls<${CLS.glass}.5){ // bridge windows
    gl = ${g("=")};
  } else if(cls<${CLS.jetWing}.5){ // wings, tailplanes, fins: edges by direction, so the planform draws itself
    gl = mag>.06?edgeG:(L<.25?${g("=")}:${g("#")});
  } else { // props: turn over between + and x a few times a second, so a spinning rotor reads as moving
    gl = mod(floor(uTime*2.5+cell.x*.5+cell.y*.5),2.)<1.?${g("+")}:${g("x")};
  }
  vec2 gv = g-cell, dx = dFdx(g), dy = dFdy(g);
  float ink = smoothstep(.12,.78,textureGrad(uAtlas,vec2((gl+gv.x)/uN,1.-gv.y),dx/uN,dy).r);
  vec3 blur = grade(textureLod(uScene,vUv,lodC+1.2).rgb);
  // Large flat surfaces (deck, markings) keep more of their colour between glyphs, so the deck reads lit, not black.
  // Jets go the other way: a dark ground and brighter ink, so each airframe stands off the deck.
  bool isJet = cls>${CLS.steel}.5 && cls<${CLS.canopy}.5 || cls>${CLS.glass}.5;
  float bgk = (cls>${CLS.foam}.5 && cls<${CLS.paint}.5) ? .5 : isJet ? .14 : mix(.26,.32,uNight);
  outColor = vec4(mix(blur*bgk,col*(isJet?1.5:1.3)+.012,ink),1.);
}`;

const tiltFrag = /* glsl */ `
precision highp float;
uniform sampler2D uA; uniform vec2 uRes; uniform float uFocus;
in vec2 vUv; out vec4 outColor;
void main(){
  float dy = abs(vUv.y-uFocus);
  float r = pow(smoothstep(.24,.6,dy),1.6)*26.*uRes.y/1000.;
  if(r<.2){ outColor = vec4(texture(uA,vUv).rgb,1.); return; }
  vec3 c = vec3(0.);
  float lod = max(log2(r/4.),0.);
  for(int i=0;i<36;i++){
    float t = float(i)+.5, a = t*2.39996, rr = sqrt(t/36.)*r;
    c += textureLod(uA,vUv+vec2(cos(a),sin(a))*rr/uRes,lod).rgb;
  }
  outColor = vec4(c/36.,1.);
}`;

const vtx = "in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }";

/** Renders `scene` through the glyph and tilt-shift passes to the canvas. */
export class Post {
  private rt: THREE.WebGLRenderTarget;
  private art: THREE.WebGLRenderTarget;
  private readonly ascii: THREE.RawShaderMaterial;
  private readonly tilt: THREE.RawShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly post = new THREE.Scene();
  private readonly cam = new THREE.Camera();
  readonly night = { value: 0 };
  /** Tilt-shift blur; the last quality fallback turns it off and draws the glyphs straight to the canvas. */
  blur = true;

  constructor() {
    const opts = { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { ...opts, type: THREE.HalfFloatType });
    this.art = new THREE.WebGLRenderTarget(4, 4, { ...opts, depthBuffer: false });
    const glyphs = atlas();
    this.ascii = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: vtx, fragmentShader: asciiFrag, depthTest: false, depthWrite: false,
      uniforms: {
        uScene: { value: this.rt.texture }, uAtlas: { value: glyphs }, uGrid: { value: new THREE.Vector2(200, 100) },
        uTime: time, uN: { value: GLYPHS.length }, uNight: this.night,
      },
    });
    this.tilt = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: vtx, fragmentShader: tiltFrag, depthTest: false, depthWrite: false,
      uniforms: { uA: { value: this.art.texture }, uRes: { value: new THREE.Vector2(4, 4) }, uFocus: { value: 0.46 } },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.ascii);
    this.quad.frustumCulled = false;
    this.post.add(this.quad);
  }

  /** Canvas size in pixels; cells stay about 7 × 14 CSS pixels. */
  setSize(w: number, h: number, cssW: number, cssH: number) {
    this.rt.setSize(w, h);
    this.art.setSize(w, h);
    this.ascii.uniforms.uGrid.value.set(Math.round(cssW / 7), Math.round(cssH / 14));
    this.tilt.uniforms.uRes.value.set(w, h);
  }

  /** Where the sharp band sits, 0 at the bottom of the view to 1 at the top. */
  set focus(v: number) {
    this.tilt.uniforms.uFocus.value = v;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    this.quad.material = this.ascii;
    renderer.setRenderTarget(this.blur ? this.art : null);
    renderer.render(this.post, this.cam);
    if (!this.blur) return;
    this.quad.material = this.tilt;
    renderer.setRenderTarget(null);
    renderer.render(this.post, this.cam);
  }

  dispose() {
    this.rt.dispose();
    this.art.dispose();
    this.ascii.uniforms.uAtlas.value.dispose();
    this.ascii.dispose();
    this.tilt.dispose();
  }
}
