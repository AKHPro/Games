/* v12: modern effects for Mila Quest — GPU particles, aura, trail, shield, bloom, env lighting.
   Every effect scales with the graphics tier (GFX.level): LOW keeps a light version. */
import * as THREE from "../assets/lib/three.module.js";
import { EffectComposer } from "../assets/lib/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../assets/lib/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../assets/lib/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "../assets/lib/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "../assets/lib/jsm/environments/RoomEnvironment.js";
import { GFX } from "./gfx.js";

/* ---------- shared textures ---------- */
function canvasTex(size, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const TEX = {};
function texDot() {
  return TEX.dot || (TEX.dot = canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.85)");
    r.addColorStop(0.6, "rgba(255,255,255,.25)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }));
}
function texStar() {
  return TEX.star || (TEX.star = canvasTex(64, (g, s) => {
    g.translate(s / 2, s / 2);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? s * 0.16 : s * 0.48; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }));
}
function texHeart() {
  return TEX.heart || (TEX.heart = canvasTex(64, (g, s) => {
    g.fillStyle = "#fff"; g.translate(s / 2, s / 2 + 4); g.scale(s / 40, s / 40);
    g.beginPath(); g.moveTo(0, 12); g.bezierCurveTo(-18, 0, -12, -16, 0, -6); g.bezierCurveTo(12, -16, 18, 0, 0, 12); g.fill();
  }));
}
function texRing() {
  return TEX.ring || (TEX.ring = canvasTex(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, s * 0.30, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.55, "rgba(255,255,255,.95)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }));
}

/* ---------- GPU particle pool (one draw call per texture) ---------- */
const PVERT = `
attribute float size; attribute vec4 col; attribute float rot;
uniform float uScale; varying vec4 vC; varying float vR;
void main(){ vC=col; vR=rot; vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize = size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const PFRAG = `
uniform sampler2D map; varying vec4 vC; varying float vR;
void main(){ vec2 p=gl_PointCoord-0.5; float c=cos(vR),s=sin(vR); p=vec2(c*p.x-s*p.y,s*p.x+c*p.y)+0.5;
  vec4 t=texture2D(map,p); float a=vC.a*t.a; if(a<0.004) discard; gl_FragColor=vec4(vC.rgb*t.rgb, a); }`;
class Pool {
  constructor(n, map, blending) {
    this.n = n; this.next = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n); this.rot = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.base = new Float32Array(n);
    this.grav = new Float32Array(n); this.drag = new Float32Array(n); this.spin = new Float32Array(n); this.rgb = new Float32Array(n * 3); this.grow = new Float32Array(n);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("col", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("rot", new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { map: { value: map }, uScale: { value: 400 } };
    const m = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false, blending: blending || THREE.AdditiveBlending });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.alive = 0;
  }
  spawn(x, y, z, vx, vy, vz, life, size, color, o) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.base[i] = size;
    this.rgb[i * 3] = color.r; this.rgb[i * 3 + 1] = color.g; this.rgb[i * 3 + 2] = color.b;
    this.grav[i] = o && o.g != null ? o.g : 0; this.drag[i] = o && o.drag != null ? o.drag : 1.2;
    this.spin[i] = o && o.spin != null ? o.spin : (Math.random() - 0.5) * 6; this.rot[i] = Math.random() * 6.28;
    this.grow[i] = o && o.grow != null ? o.grow : 0;
  }
  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.col[i * 4 + 3] !== 0) { this.col[i * 4 + 3] = 0; this.size[i] = 0; } continue; }
      alive++;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.rot[i] += this.spin[i] * dt;
      const fadeIn = Math.min(1, (1 - k) * 8);
      this.col[i * 4] = this.rgb[i * 3]; this.col[i * 4 + 1] = this.rgb[i * 3 + 1]; this.col[i * 4 + 2] = this.rgb[i * 3 + 2];
      this.col[i * 4 + 3] = Math.min(1, k * 1.6) * fadeIn;
      this.size[i] = this.base[i] * (1 + this.grow[i] * (1 - k)) * (0.4 + 0.6 * Math.sqrt(k));
    }
    this.alive = alive;
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.col.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.rot.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

const _c = new THREE.Color();
const HUE = (h, s = 1, l = 0.6) => _c.clone().setHSL(((h % 1) + 1) % 1, s, l);
const rnd = (a, b) => a + Math.random() * (b - a);

/* FX manager: one per scene (run / title) */
export class FX {
  constructor(scene) {
    this.scene = scene;
    const n = GFX.level === "high" ? 900 : GFX.level === "medium" ? 520 : 220;
    this.dots = new Pool(n, texDot());
    this.stars = new Pool(Math.round(n / 3), texStar());
    this.hearts = new Pool(80, texHeart(), THREE.NormalBlending);
    this.pools = [this.dots, this.stars, this.hearts];
    this.pools.forEach((p) => scene.add(p.points));
    this.rings = [];
    this.amb = null;
    this.ambT = 0;
  }
  get q() { return GFX.level === "high" ? 1 : GFX.level === "medium" ? 0.65 : 0.35; }
  setScale(camera, heightPx) {
    const s = heightPx * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
    this.pools.forEach((p) => { p.uniforms.uScale.value = s; });
  }
  /* correct answer: bright burst + sparkles + expanding ring */
  burst(pos, style = "confetti") {
    const n = Math.round(46 * this.q) + 10;
    const cols = style === "fire" ? [0xffb020, 0xff5a1a, 0xffe08a] : style === "ice" ? [0x9be8ff, 0xffffff, 0x5ab8ff]
      : style === "gold" ? [0xffd34a, 0xfff2b0, 0xffb000] : style === "love" ? [0xff5b8a, 0xff9ec0, 0xffffff]
      : style === "electric" ? [0x7cf3ff, 0x4a7bff, 0xffffff] : [0xffc83d, 0xff5b8a, 0x4ecdc4, 0x7cff6b, 0x6a8cff, 0xffffff];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, up = rnd(0.2, 1), sp = rnd(3, 8.5);
      _c.setHex(cols[i % cols.length]).multiplyScalar(1.6);
      const pool = style === "love" && i % 2 ? this.hearts : (style === "stars" || style === "gold") && i % 3 === 0 ? this.stars : this.dots;
      pool.spawn(pos.x, pos.y, pos.z, Math.cos(a) * sp * Math.sqrt(1 - up * up), up * sp + 2, Math.sin(a) * sp * Math.sqrt(1 - up * up),
        rnd(0.55, 1.1), rnd(0.16, 0.34) * (pool === this.hearts ? 1.6 : 1), _c, { g: 9, drag: 1.6 });
    }
    if (style === "stars" || style === "fireworks") {
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Vector3(pos.x + rnd(-1.6, 1.6), pos.y + rnd(0.8, 2.2), pos.z + rnd(-1, 0.5));
        const h = Math.random();
        for (let i = 0; i < Math.round(26 * this.q) + 6; i++) {
          const v = new THREE.Vector3().randomDirection().multiplyScalar(rnd(3, 4.4));
          this.stars.spawn(c.x, c.y, c.z, v.x, v.y, v.z, rnd(0.6, 0.95), 0.24, HUE(h + rnd(-0.05, 0.05), 1, 0.65).multiplyScalar(1.5), { g: 3, drag: 2.2 });
        }
      }
    }
    this.ring(pos, cols[0]);
  }
  ring(pos, color, size = 2.6) {
    let r = this.rings.find((x) => x.t >= x.dur);
    if (!r) {
      if (this.rings.length > 6) return;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texRing(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.renderOrder = 6;
      r = { m, t: 0, dur: 0.5 };
      this.rings.push(r); this.scene.add(m);
    }
    r.t = 0; r.size = size; r.m.visible = true;
    r.m.material.color.setHex(color).multiplyScalar(1.4);
    r.m.position.copy(pos);
    r.billboard = true;
  }
  coin(pos) {
    const n = Math.round(14 * this.q) + 4;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(rnd(1.2, 3));
      _c.setHex(i % 3 ? 0xffd34a : 0xfff6c8).multiplyScalar(1.8);
      (i % 2 ? this.stars : this.dots).spawn(pos.x, pos.y, pos.z, v.x, v.y + 1.4, v.z, rnd(0.35, 0.6), rnd(0.12, 0.22), _c, { g: 2, drag: 3 });
    }
  }
  puff(pos, color = 0xd9d2c4) {
    const n = Math.round(16 * this.q) + 4;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd(-2, 2), rnd(0.5, 2), rnd(-2, 2));
      _c.setHex(color).multiplyScalar(0.55);
      this.dots.spawn(pos.x, pos.y, pos.z, v.x, v.y, v.z, rnd(0.4, 0.8), rnd(0.3, 0.55), _c, { g: -0.5, drag: 3, grow: 1.5, spin: 0 });
    }
  }
  /* subtle footstep dust: a few small, dim motes (the pools are additive, so keep them dark) */
  step(pos, color = 0xd9d2c4) {
    const n = this.q < 0.7 ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd(-0.8, 0.8), rnd(0.3, 0.9), rnd(0.2, 1.2));
      _c.setHex(color).multiplyScalar(0.22);
      this.dots.spawn(pos.x + rnd(-0.15, 0.15), pos.y, pos.z, v.x, v.y, v.z, rnd(0.3, 0.45), rnd(0.16, 0.26), _c, { g: -0.3, drag: 3, grow: 1.2, spin: 0 });
    }
  }
  shieldPop(pos) {
    for (let i = 0; i < Math.round(40 * this.q) + 8; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(rnd(3, 6));
      _c.setHex(i % 2 ? 0x7ce3ff : 0xffffff).multiplyScalar(1.6);
      this.dots.spawn(pos.x, pos.y, pos.z, v.x, v.y, v.z, rnd(0.4, 0.7), 0.2, _c, { g: 2, drag: 2 });
    }
    this.ring(pos, 0x7ce3ff, 3.4);
  }
  /* gentle floating motes around the camera (pollen / snow / embers / bubbles by theme) */
  ambient(on, color = 0xfff4c0, kind = "pollen") { this.amb = on ? { color, kind } : null; }
  update(dt, camera, center) {
    if (this.amb && GFX.level !== "low" && center) {
      this.ambT += dt;
      const rate = GFX.level === "high" ? 0.03 : 0.06;
      while (this.ambT > rate) {
        this.ambT -= rate;
        const k = this.amb.kind;
        _c.setHex(this.amb.color).multiplyScalar(k === "embers" ? 1.6 : 1.1);
        const x = center.x + rnd(-11, 11), z = center.z + rnd(-26, 4), y = center.y + rnd(0.2, 6);
        const vy = k === "snow" ? rnd(-1.4, -0.6) : k === "embers" ? rnd(0.6, 1.6) : k === "bubbles" ? rnd(0.5, 1.2) : rnd(-0.15, 0.25);
        this.dots.spawn(x, y, z, rnd(-0.3, 0.3), vy, rnd(-0.3, 0.3), rnd(2.2, 4), k === "snow" ? 0.11 : 0.075, _c, { g: 0, drag: 0.1, spin: 0 });
      }
    }
    this.pools.forEach((p) => p.update(dt));
    for (const r of this.rings) {
      if (r.t >= r.dur) { r.m.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      r.m.scale.setScalar(0.3 + r.size * (1 - Math.pow(1 - k, 3)));
      r.m.material.opacity = 1 - k;
      if (camera) r.m.quaternion.copy(camera.quaternion);
    }
  }
  clear() { this.pools.forEach((p) => p.clear()); this.rings.forEach((r) => { r.t = r.dur; r.m.visible = false; }); }
}

/* ---------- AURA: soft halo + ground glow ring + rising sparkles ---------- */
const HALO_FRAG = `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uRainbow; varying vec2 vUv;
vec3 hsv(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
void main(){ vec2 p=vUv-0.5; float d=length(p)*2.0; float a=atan(p.y,p.x);
  float rim=smoothstep(1.0,0.55,d)*smoothstep(0.05,0.55,d);
  float rays=0.75+0.25*sin(a*9.0+uTime*2.0)*sin(a*5.0-uTime*1.3);
  float core=smoothstep(1.0,0.0,d)*0.35;
  vec3 c=mix(uColor, hsv(fract(a/6.2832+uTime*0.15)), uRainbow);
  float al=(rim*rays*0.8+core*0.5)*uOpacity; gl_FragColor=vec4(c*1.15, al); }`;
const RING_FRAG = `
uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uRainbow; varying vec2 vUv;
vec3 hsv(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
void main(){ vec2 p=vUv-0.5; float d=length(p)*2.0; float a=atan(p.y,p.x);
  float ring=exp(-pow((d-0.78)*9.0,2.0)) + 0.5*exp(-pow((d-fract(uTime*0.6))*10.0,2.0))*(1.0-d);
  float glow=smoothstep(1.0,0.0,d)*0.25;
  vec3 c=mix(uColor, hsv(fract(a/6.2832-uTime*0.2)), uRainbow);
  gl_FragColor=vec4(c*1.2,(ring+glow)*uOpacity*0.8*step(d,1.0)); }`;
const UV_VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
export const AURA_LOOK = {
  "aura.gold": { color: 0xffc83d, spark: 0xfff0a0, kind: "rise" },
  "aura.ice": { color: 0x6fd8ff, spark: 0xe8fbff, kind: "snow" },
  "aura.fire": { color: 0xff6a1a, spark: 0xffc04a, kind: "embers" },
  "aura.rainbow": { color: 0xff66cc, spark: 0xffffff, kind: "rise", rainbow: 1 },
  "aura.galaxy": { color: 0x8a5cff, spark: 0xc8b6ff, kind: "orbit" }
};
export function makeAura(id) {
  const L = AURA_LOOK[id];
  if (!L) return null;
  const g = new THREE.Group();
  g.name = "aura";
  const uni = () => ({ uColor: { value: new THREE.Color(L.color) }, uTime: { value: 0 }, uOpacity: { value: 0.85 }, uRainbow: { value: L.rainbow || 0 } });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.6), new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: UV_VERT, fragmentShader: HALO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 0.95; halo.renderOrder = 4; halo.name = "halo";
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.ShaderMaterial({ uniforms: uni(), vertexShader: UV_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.renderOrder = 4; ring.name = "ring";
  g.add(halo, ring);
  g.userData = { L, halo, ring, t: 0, acc: 0 };
  return g;
}
/* call every frame: aura group sits under the actor; fx = FX pool for sparkles */
export function updateAura(g, dt, camera, fx, worldPos) {
  if (!g) return;
  const u = g.userData; u.t += dt;
  [u.halo, u.ring].forEach((m) => { m.material.uniforms.uTime.value = u.t; });
  u.halo.material.uniforms.uOpacity.value = 0.42 + Math.sin(u.t * 3) * 0.08;
  if (camera) {
    // billboard, and sit just BEHIND the character so the body stays clearly visible in front of the glow
    const pq = new THREE.Quaternion();
    if (g.parent) g.parent.getWorldQuaternion(pq);
    u.halo.quaternion.copy(camera.quaternion).premultiply(pq.clone().invert());
    const wp = new THREE.Vector3(); g.getWorldPosition(wp);
    const back = wp.sub(camera.position).setY(0).normalize().multiplyScalar(0.55).applyQuaternion(pq.invert());
    u.halo.position.set(back.x, 0.95, back.z);
  }
  if (!fx || !worldPos) return;
  u.acc += dt;
  const rate = GFX.level === "high" ? 0.035 : GFX.level === "medium" ? 0.07 : 0.16;
  while (u.acc > rate) {
    u.acc -= rate;
    const L = u.L, a = Math.random() * 6.283, r = rnd(0.35, 0.65);
    _c.setHex(L.spark); if (L.rainbow) _c.copy(HUE(u.t * 0.3 + Math.random() * 0.3, 1, 0.65)); _c.multiplyScalar(1.7);
    if (L.kind === "orbit") {
      fx.stars.spawn(worldPos.x + Math.cos(a) * 0.7, worldPos.y + rnd(0.3, 1.7), worldPos.z + Math.sin(a) * 0.7, -Math.sin(a) * 1.6, rnd(-0.2, 0.2), Math.cos(a) * 1.6, rnd(0.5, 0.9), 0.14, _c, { g: 0, drag: 0.4 });
    } else {
      const vy = L.kind === "snow" ? rnd(0.1, 0.5) : L.kind === "embers" ? rnd(1.4, 2.6) : rnd(0.7, 1.5);
      fx.dots.spawn(worldPos.x + Math.cos(a) * r, worldPos.y + rnd(0, 0.5), worldPos.z + Math.sin(a) * r, rnd(-0.2, 0.2), vy, rnd(-0.2, 0.2), rnd(0.6, 1.1), L.kind === "snow" ? 0.13 : 0.1, _c, { g: 0, drag: 0.6 });
    }
  }
}

/* ---------- TRAIL: glowing ribbon behind the runner ---------- */
export const TRAIL_LOOK = {
  "trail.rainbow": { rainbow: 1, width: 0.26, spark: 0 },
  "trail.fire": { a: 0xffd25a, b: 0xff3a10, width: 0.3, spark: 0xffa040 },
  "trail.ice": { a: 0xffffff, b: 0x3ab8ff, width: 0.26, spark: 0xd8f6ff },
  "trail.stars": { a: 0xfff3b0, b: 0x8a5cff, width: 0.2, spark: 0xffffff, stars: 1 },
  "trail.leaf": { a: 0xb8ff7a, b: 0x1fa85a, width: 0.24, spark: 0xd8ff9a }
};
export function makeTrail(id) {
  const L = TRAIL_LOOK[id];
  if (!L) return null;
  const N = GFX.level === "low" ? 16 : 30;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 2 * 3), col = new Float32Array(N * 2 * 4);
  const idx = [];
  for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  // normal blending keeps the trail's own colours (additive washed a rainbow out to white on bright ground)
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = "trail";
  mesh.userData = { L, N, hist: [], acc: 0, t: 0 };
  return mesh;
}
const _tmp = new THREE.Vector3(), _side = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
/* head: world position (hip height); drift: optional vector added to history each frame (title preview) */
export function updateTrail(mesh, dt, head, fx, drift) {
  if (!mesh || !head) return;
  const u = mesh.userData; u.t += dt;
  const h = u.hist;
  if (drift) h.forEach((p) => p.addScaledVector(drift, dt));
  if (!h.length || h[0].distanceToSquared(head) > 0.0016) { h.unshift(head.clone()); if (h.length > u.N) h.pop(); }
  else h[0].copy(head);
  const pos = mesh.geometry.attributes.position.array, col = mesh.geometry.attributes.color.array;
  const L = u.L, ca = new THREE.Color(L.a || 0xffffff), cb = new THREE.Color(L.b || 0xffffff);
  const MAXLEN = 3.2; // metres of ribbon behind the runner, whatever the frame rate
  let dist = 0;
  for (let i = 0; i < u.N; i++) {
    const p = h[Math.min(i, h.length - 1)] || head;
    const q = h[Math.min(i + 1, h.length - 1)] || p;
    _tmp.subVectors(p, q); if (_tmp.lengthSq() < 1e-6) _tmp.set(0, 0, 1);
    _side.crossVectors(_tmp, _up).normalize();
    if (i > 0) dist += p.distanceTo(h[Math.min(i - 1, h.length - 1)] || p);
    const k = Math.min(1, Math.max(i / (u.N - 1), dist / MAXLEN)), w = L.width * (1 - k) * (i === 0 ? 0.6 : 1);
    pos[i * 6] = p.x + _side.x * w; pos[i * 6 + 1] = p.y + 0.02; pos[i * 6 + 2] = p.z + _side.z * w;
    pos[i * 6 + 3] = p.x - _side.x * w; pos[i * 6 + 4] = p.y + 0.02; pos[i * 6 + 5] = p.z - _side.z * w;
    const c = L.rainbow ? HUE(k * 0.9 - u.t * 0.4, 1, 0.5) : ca.clone().lerp(cb, k);
    const al = Math.min(1, k * 7) * Math.pow(1 - k, 1.3) * (i < h.length ? 0.85 : 0);
    for (let s = 0; s < 2; s++) { const o = (i * 2 + s) * 4; col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b; col[o + 3] = al * 0.7; }
  }
  mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.attributes.color.needsUpdate = true;
  if (fx && L.spark && GFX.level !== "low") {
    u.acc += dt;
    while (u.acc > 0.05) {
      u.acc -= 0.05;
      _c.setHex(L.spark).multiplyScalar(1.6);
      (L.stars ? fx.stars : fx.dots).spawn(head.x + rnd(-0.2, 0.2), head.y + rnd(-0.3, 0.3), head.z + rnd(-0.1, 0.3), rnd(-0.3, 0.3), rnd(0, 0.8), rnd(0.2, 0.8), rnd(0.4, 0.8), L.stars ? 0.16 : 0.1, _c, { g: L.spark === 0xffa040 ? -1 : 0.6, drag: 1 });
    }
  }
}

/* ---------- SHIELD bubble (super run) ---------- */
export function makeShield() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); vP=position; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ float f=pow(1.0-abs(dot(vN,vV)),2.2); float hex=0.5+0.5*sin(vP.y*18.0+uTime*3.0)*sin(vP.x*18.0); 
        vec3 c=mix(vec3(0.35,0.85,1.0),vec3(1.0),f*0.5); gl_FragColor=vec4(c*1.4,(f*0.85+hex*0.06)*uOpacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  m.scale.set(0.85, 1.05, 0.85); m.position.y = 0.85; m.name = "shield"; m.renderOrder = 7;
  return m;
}

/* ---------- environment lighting for shiny skins / coins ---------- */
let envTex = null;
export function getEnvMap(renderer) {
  if (envTex) return envTex;
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pm.dispose();
  return envTex;
}

/* ---------- bloom post-processing (HIGH only) ---------- */
export function makeComposer(renderer, w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
  const comp = new EffectComposer(renderer, rt);
  const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.45, 0.92);
  comp.addPass(rp); comp.addPass(bloom); comp.addPass(new OutputPass());
  return { comp, rp, bloom, render(scene, camera) { rp.scene = scene; rp.camera = camera; comp.render(); },
    setSize(w2, h2) { comp.setSize(w2, h2); }, dispose() { comp.dispose(); rt.dispose(); bloom.dispose(); } };
}
