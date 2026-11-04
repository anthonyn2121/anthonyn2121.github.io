import * as THREE from "three";
import { CLS, time } from "./util";

/** Visual speed of the water past the ship, m/s. Slower than real so the glyphs don't strobe. */
const SPEED = 5;

const frag = /* glsl */ `
uniform float uT, uNight; uniform vec2 uEsc; varying vec3 vW;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ return vn(p)*.55+vn(p*2.1+3.1)*.3+vn(p*4.3+7.7)*.15; }

// Same as halfBeam() in ship.ts.
float hb(float x){
  if(x>160.||x<-158.) return -1.;
  float b = 20.5;
  if(x>60.) b *= sqrt(max(0.,1.-pow((x-60.)/100.,2.2)));
  if(x<-130.) b *= 1.-.17*((-130.-x)/28.);
  return b;
}

// Foam and churned water for a ship at the origin of q (ship frame, bow at +x). w is the water frame for noise.
vec2 wake(vec2 q, vec2 w){
  float foam = 0., churn = 0., ax = abs(q.y), b = hb(q.x);
  if(b>0.){
    float e = ax-b;
    foam = smoothstep(5.5,0.,e)*smoothstep(-1.,0.,e)*(.45+.75*smoothstep(40.,150.,q.x))*(.5+.7*fbm(w*.18+vec2(0.,uT*.4)));
  }
  float d = 160.-q.x;
  if(d>0.){
    float arm = abs(ax-(d*.354+3.)), wid = 1.6+d*.018;
    foam = max(foam, smoothstep(wid,0.,arm)*exp(-d/300.)*(.55+.6*vn(w*.12+uT*.3)));
    float inside = smoothstep(d*.354+2., d*.354-6., ax);
    churn = max(churn, inside*exp(-d/420.)*.3*(.5+.5*sin(d*.22-ax*.55)));
  }
  float ds = -158.-q.x;
  if(ds>-4.){
    float s = max(ds,0.), wd = 15.+s*.085, inside = smoothstep(wd, wd-7., ax);
    churn = max(churn, inside*exp(-s/850.)*(.55+.45*fbm(w*vec2(.05,.09))));
    foam = max(foam, inside*smoothstep(.52,.74,fbm(w*.11+3.))*exp(-s/420.));
    foam = max(foam, smoothstep(2.6,0.,abs(ax-wd))*exp(-s/500.)*(.4+.6*vn(w*.2)));
    float prop = smoothstep(2.,0.,abs(ax-7.))+smoothstep(2.,0.,abs(ax-15.));
    foam = max(foam, prop*exp(-s/160.)*.9);
  }
  return vec2(foam, churn);
}

void main(){
  vec2 p = vW.xz, w = p+vec2(uT*${SPEED.toFixed(1)},0.);
  float sw = sin(dot(w,vec2(.031,.022))+uT*.7)*.5 + sin(dot(w,vec2(-.018,.05))-uT*.95+fbm(w*.01)*3.)*.35;
  float rip = fbm(w*vec2(.09,.15)+vec2(0.,uT*.15));
  vec3 deep = mix(vec3(.02,.12,.24), vec3(.004,.02,.045), uNight);
  vec3 mid = mix(vec3(.07,.32,.48), vec3(.016,.06,.1), uNight);
  vec3 c = mix(deep, mid, clamp(.4+sw*.55+(rip-.5)*.9, 0., 1.));
  c += mix(vec3(.25,.3,.3), vec3(.06,.09,.12), uNight)*smoothstep(.82,.92,vn(w*vec2(.6,1.3)+uT*vec2(.4,.7)));
  float caps = smoothstep(.78,.84,fbm(w*.022+vec2(uT*.01,0.)))*smoothstep(.55,.85,vn(w*.25+uT*.2));
  vec2 a = wake(p, w), e = wake((p-uEsc)/.5, w);
  float foam = max(max(a.x, e.x*.9), caps*.9), churn = max(a.y, e.y);
  c = mix(c, mix(vec3(.18,.5,.55), vec3(.05,.12,.14), uNight), churn*.85);
  float cls = churn>.35 ? ${CLS.wake}. : ${CLS.water}.;
  if(foam>.32){ c = mix(c, mix(vec3(.95,.98,.97), vec3(.32,.4,.42), uNight), clamp(foam*1.5,0.,1.)); cls = ${CLS.foam}.; }
  gl_FragColor = vec4(c, cls/16.);
}`;

export function buildSea(escort: THREE.Vector2) {
  const uniforms = { uT: time, uNight: { value: 0 }, uEsc: { value: escort } };
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.); }",
    fragmentShader: frag,
  });
  const g = new THREE.PlaneGeometry(3200, 3200);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m);
  return { mesh, night: uniforms.uNight };
}
