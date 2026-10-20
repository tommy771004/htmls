// 太空梭與發射場（全部程式建模）：軌道器（雙三角翼、垂直尾翼、OMS 莢艙、三具主引擎、黑色隔熱底）、
// 橘色外部燃料箱、兩具固體火箭助推器、行動發射平台與勤務塔；加上加法混色的尾焰、
// 世界座標的煙柱粒子（升空時從噴口留下，越高越粗）與再入時包住機身的電漿光。
// 箭體座標：機頭朝 +y，軌道器在燃料箱的 +z 側（機腹朝燃料箱），升空後往 -z 傾倒即為「機腹朝下」。
import * as THREE from 'three';
import { Builder, P, mat } from './geo.js';
import { MLP_H } from '../core/shuttle.js';
import { clamp, mulberry32 } from '../core/math.js';

const WHITE = 0xeeeeea;
const TILE = 0x1d1f22;
const GREY = 0x8d9196;
const DARK = 0x34383d;
const ET_COL = 0xbf6a2a;
const VMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 });

// 把 m 套在 base 之後（mat() 回傳共用矩陣，必須先複製）
const M = (base, m) => base.clone().multiply(m);

// 軌道器（水平座標：機頭 -z、機腹 y = 0、全長約 37 m、翼展 23.8 m）
function orbiter(B, base) {
  const add = (g, m, c) => B.geom(g, M(base, m), c);
  // 機身斷面：平底、直側、圓頂
  const sec = new THREE.Shape();
  sec.moveTo(-2.6, 0.3);
  sec.lineTo(2.6, 0.3);
  sec.lineTo(2.7, 4.2);
  sec.quadraticCurveTo(2.5, 5.7, 0, 5.75);
  sec.quadraticCurveTo(-2.5, 5.7, -2.7, 4.2);
  sec.closePath();
  const body = new THREE.ExtrudeGeometry(sec, { depth: 27.5, bevelEnabled: false, curveSegments: 6 });
  body.translate(0, 0, -12);
  add(body, new THREE.Matrix4(), WHITE);
  // 機頭：橢球，前端與下半部是黑色隔熱瓦
  add(P.sphere(22, 14), mat(0, 3.0, -12, 2.68, 2.75, 6.6), WHITE);
  add(P.sphere(16, 10), mat(0, 2.35, -17.4, 1.55, 1.6, 1.4), TILE);
  add(P.sphere(18, 10), mat(0, 1.55, -12.6, 2.5, 1.35, 6.1), TILE);
  // 座艙窗
  add(P.box(), mat(0, 5.05, -14.4, 2.9, 0.12, 1.6, -0.62, 0, 0), 0x15181c);
  for (const s of [-1, 1]) add(P.box(), mat(s * 2.05, 4.45, -14.1, 0.12, 0.7, 1.7, 0, s * 0.35, 0), 0x15181c);
  // 機腹隔熱瓦
  add(P.box(), mat(0, 0.22, 1.6, 5.3, 0.16, 27.6), TILE);
  // 酬載艙門縫
  for (const s of [-1, 1]) add(P.box(), mat(s * 1.35, 5.72, 1.0, 0.08, 0.05, 20), 0xa9adb1);
  // 機翼（俯視雙三角翼）
  for (const s of [-1, 1]) {
    const pts = [[2.6, -8], [4.4, -3], [11.9, 11.6], [11.9, 13.6], [2.6, 14.2]].map(([x, z]) => [x * s, z]);
    if (s < 0) pts.reverse();
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const q of pts.slice(1)) sh.lineTo(q[0], q[1]);
    const wing = new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false });
    wing.rotateX(Math.PI / 2);
    add(wing, mat(0, 1.1, 0), WHITE);
    const under = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false });
    under.rotateX(Math.PI / 2);
    add(under, mat(0, 0.54, 0), TILE);
    // 前緣（強化碳碳，深灰）
    const lx = 4.4 * s;
    const dx = (11.9 - 4.4) * s;
    const len = Math.hypot(dx, 14.6);
    add(P.box(), mat(lx + dx / 2, 0.84, -3 + 7.3, 0.35, 0.5, len, 0, Math.atan2(dx, 14.6), 0), 0x4a4d52);
    // 升降副翼縫
    add(P.box(), mat(s * 7.3, 1.12, 12.6, 9, 0.04, 0.06), 0xa9adb1);
  }
  // 垂直尾翼
  const fin = new THREE.Shape();
  fin.moveTo(7.6, 5.4);
  fin.lineTo(15.8, 5.4);
  fin.lineTo(16.7, 15.3);
  fin.lineTo(14.6, 15.5);
  fin.closePath();
  const tail = new THREE.ExtrudeGeometry(fin, { depth: 0.5, bevelEnabled: false });
  tail.rotateY(-Math.PI / 2);
  add(tail, mat(0.25, 0, 0), WHITE);
  add(P.box(), mat(0, 10.4, 15.9, 0.56, 9.4, 0.5, -0.09, 0, 0), 0x4a4d52); // 方向舵／減速板分割
  // OMS 莢艙
  for (const s of [-1, 1]) {
    add(P.sphere(14, 10), mat(s * 1.95, 5.35, 12.1, 1.15, 0.95, 3.6), WHITE);
    add(P.cylOpen(10), mat(s * 1.95, 5.3, 15.9, 0.32, 0.8, 0.32, Math.PI / 2, 0, 0), DARK);
  }
  // 機尾與三具主引擎
  add(P.box(), mat(0, 2.9, 15.45, 5.3, 5.3, 0.4), 0xd8d8d3);
  add(P.box(), mat(0, 0.55, 16.4, 5.2, 0.35, 2.2), TILE); // 機體襟翼
  for (const [x, y] of [[0, 4.25], [-1.4, 2.15], [1.4, 2.15]]) {
    add(new THREE.CylinderGeometry(1.15, 0.42, 2.9, 18, 1, true), mat(x, y, 17.25, 1, 1, 1, Math.PI / 2, 0, 0), 0x50555b);
    add(new THREE.CylinderGeometry(0.4, 1.08, 2.7, 18, 1, true), mat(x, y, 17.2, 1, 1, 1, Math.PI / 2, 0, 0), 0x1a1c1f);
  }
}

// 起落架（只在降落時顯示）
function gear() {
  const B = new Builder();
  for (const [x, z, h] of [[0, -12.5, 2.4], [-3.3, 4.5, 2.6], [3.3, 4.5, 2.6]]) {
    B.geom(P.cyl(8), mat(x, -h / 2 + 0.3, z, 0.16, h, 0.16), GREY);
    for (const s of [-0.32, 0.32]) B.geom(P.cyl(14), mat(x + s, -h + 0.55, z, 0.55, 0.3, 0.55, 0, 0, Math.PI / 2), 0x1c1e21);
  }
  return B.build();
}

function lathe(profile, seg = 24) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

function externalTank(B) {
  B.geom(lathe([[0, -0.6], [2.6, -0.3], [3.8, 0.4], [4.2, 1.4], [4.2, 36], [4.0, 39.5], [3.3, 42.5], [2.2, 45], [0.9, 47], [0.25, 48], [0, 48.2]], 32), new THREE.Matrix4(), ET_COL);
  // 箱間段的深色帶與縱向管線
  B.geom(P.cylOpen(32), mat(0, 29.5, 0, 4.26, 3.6, 4.26), 0x9e5520);
  B.geom(P.cyl(8), mat(1.2, 21, 4.25, 0.3, 26, 0.3), 0xa35a22);
  B.geom(P.cyl(8), mat(-1.0, 21, 4.3, 0.22, 26, 0.22), 0xa35a22);
  // 與軌道器相接的支架
  B.geom(P.box(), mat(0, 5.2, 4.4, 2.6, 0.5, 0.9), GREY);
  B.geom(P.box(), mat(0, 37.0, 4.4, 1.0, 0.5, 0.9), GREY);
}

function booster(x) {
  const B = new Builder();
  B.geom(lathe([[1.4, -1.8], [0.85, 0], [1.6, 0.2], [2.55, 2.6], [1.86, 3.1], [1.86, 40.5], [1.7, 42.5], [1.25, 44.4], [0.6, 45.6], [0, 46.2]], 28), mat(x, 0, 0), WHITE);
  for (const y of [11.5, 19.5, 27.5, 35.5]) B.geom(P.cylOpen(28), mat(x, y, 0, 1.9, 0.35, 1.9), 0xc9c9c4);
  B.geom(new THREE.CylinderGeometry(0.85, 1.4, 1.9, 20, 1, true), mat(x, -0.95, 0), 0x2b2e32);
  // 與燃料箱的連桿
  const toward = -Math.sign(x);
  for (const y of [4.5, 38]) B.geom(P.box(), mat(x + toward * 1.6, y, 0, 1.4, 0.4, 0.6), GREY);
  return B.build();
}

// 發射場（地點座標原點 = 箭體中心正下方地面）
function padGeo() {
  const B = new Builder();
  const concrete = 0xa29f97;
  B.geom(P.box(), mat(0, 0.25, 0, 82, 2.5, 82), concrete);
  B.geom(P.box(), mat(0, 1.52, 0, 82, 0.06, 14), 0x55524c); // 導焰槽（東西向，蒸汽從兩端噴出）
  // 行動發射平台
  for (const x of [-18, 18]) for (const z of [-12, 12]) B.geom(P.box(), mat(x, 2.3, z, 3, 1.6, 3), 0x5a5e63);
  B.geom(P.box(), mat(0, (3 + MLP_H) / 2, 0, 48, MLP_H - 3, 34), 0x6f7378);
  for (const x of [-6.3, 6.3]) B.geom(P.box(), mat(x, MLP_H + 0.01, 0, 5, 0.04, 5), 0x1f2124);
  B.geom(P.box(), mat(0, MLP_H + 0.01, 7.5, 6, 0.04, 5), 0x1f2124);
  // 勤務塔：四根立柱、每 6 m 一層橫梁與斜撐
  const tx = -25;
  const tz = 8;
  const H = 82;
  const steel = 0x8f9396;
  for (const sx of [-5, 5]) for (const sz of [-5, 5]) B.geom(P.box(), mat(tx + sx, MLP_H + H / 2, tz + sz, 0.7, H, 0.7), steel);
  for (let y = MLP_H + 3; y < MLP_H + H; y += 6) {
    for (const s of [-5, 5]) {
      B.geom(P.box(), mat(tx, y, tz + s, 10.4, 0.4, 0.4), steel);
      B.geom(P.box(), mat(tx + s, y, tz, 0.4, 0.4, 10.4), steel);
      B.geom(P.box(), mat(tx, y + 3, tz + s, 0.3, 0.3, 8.5, Math.PI / 2 - 0.62, Math.PI / 2, 0), 0x777b7f);
      B.geom(P.box(), mat(tx + s, y + 3, tz, 0.3, 8.5, 0.3, 0.62, 0, 0), 0x777b7f);
    }
    B.geom(P.box(), mat(tx, y - 0.25, tz, 10, 0.12, 10), 0x6a6e72);
  }
  B.geom(P.box(), mat(tx, MLP_H + H + 1, tz, 12, 2, 12), 0xb0402f);
  B.geom(P.cyl(8), mat(tx, MLP_H + H + 14, tz, 0.35, 26, 0.35), steel); // 避雷針
  // 乘員通道臂（伸向軌道器艙門）
  B.geom(P.box(), mat(tx + 13, MLP_H + 36, tz, 16, 2.6, 2.4), 0xd7d4cc);
  B.geom(P.box(), mat(tx + 21.4, MLP_H + 36, tz, 1.4, 3.2, 3.4), 0xeeeeea);
  // 水塔與燈桿
  const wx = 62;
  const wz = -46;
  for (const sx of [-4, 4]) for (const sz of [-4, 4]) B.geom(P.cyl(6), mat(wx + sx, 30, wz + sz, 0.3, 60, 0.3, sx * 0.008, 0, sz * 0.008), steel);
  B.geom(P.sphere(18, 12), mat(wx, 64, wz, 9, 7, 9), 0xd9dadb);
  for (const [x, z] of [[-40, -40], [40, 40], [-40, 40], [40, -40]]) {
    B.geom(P.cyl(6), mat(x, 22, z, 0.35, 44, 0.35), steel);
    B.geom(P.box(), mat(x, 44, z, 3, 1.6, 0.6), 0x3a3d42);
  }
  return B.build();
}

// ── 尾焰：沿 -y 的錐體，加法混色 ──
const FLAME_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLAME_FS = `uniform float uTime; uniform float uPow; uniform vec3 uCore; uniform vec3 uEdge; uniform float uDiamond;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(float n){ return fract(sin(n)*43758.5); }
void main(){
  float v = vUv.y;                       // 1 = 噴口、0 = 末端
  float edge = pow(abs(dot(normalize(vN), vV)), 1.4);
  float flick = 0.82 + 0.18 * sin(uTime * 53.0 + v * 21.0) * sin(uTime * 31.0 + vUv.x * 40.0);
  float body = pow(v, 1.7) * edge * flick;
  float dia = uDiamond * smoothstep(0.55, 1.0, sin(v * 38.0 - uTime * 2.0)) * smoothstep(0.35, 0.9, v) * edge;
  vec3 c = mix(uEdge, uCore, clamp(pow(v, 3.0) * edge * 1.4 + dia, 0.0, 1.0));
  gl_FragColor = vec4(c * (body * 1.8 + dia * 1.2) * uPow, 1.0);
}`;

function flameMat(core, edge, diamond) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPow: { value: 0 }, uCore: { value: new THREE.Color(core) }, uEdge: { value: new THREE.Color(edge) }, uDiamond: { value: diamond } },
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, side: THREE.DoubleSide,
  });
}
function flameGeo(r, len) {
  const g = new THREE.CylinderGeometry(r, r * 0.22, len, 20, 6, true);
  g.translate(0, -len / 2, 0);
  return g;
}

// ── 煙：世界座標的面向相機方片 ──
const SMOKE_VS = `attribute vec4 iPos; attribute vec2 iFx; varying vec2 vUv; varying vec2 vFx; varying float vSeed;
void main(){ vUv = uv; vFx = iFx; vSeed = iPos.w;
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  float a = iPos.w * 6.28; mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
  mv.xy += r * position.xy * iFx.x;
  gl_Position = projectionMatrix * mv; }`;
const SMOKE_FS = `uniform vec3 uLit; uniform vec3 uShade; varying vec2 vUv; varying vec2 vFx; varying float vSeed;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 q = vUv - 0.5; float d = length(q) * 2.0;
  float n = vn(vUv * 3.5 + vSeed * 17.0) * 0.6 + vn(vUv * 7.0 - vSeed * 9.0) * 0.4;
  float a = smoothstep(1.0, 0.25, d + (n - 0.5) * 0.6);
  float heat = fract(vFx.y) * 2.0;           // 小數部分：熱度
  float alpha = floor(vFx.y) / 1000.0;       // 整數部分：不透明度×1000
  vec3 c = mix(uShade, uLit, clamp(0.55 - q.y * 0.9 + n * 0.3, 0.0, 1.0));
  c = mix(c, vec3(1.6, 0.85, 0.35), clamp(heat, 0.0, 1.0));
  gl_FragColor = vec4(c, a * alpha);
  #include <colorspace_fragment>
}`;

class Smoke {
  constructor(parent, max = 1800) {
    this.max = max;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(base.index);
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('uv', base.attributes.uv);
    this.pos = new Float32Array(max * 4);
    this.fx = new Float32Array(max * 2);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iFx', new THREE.InstancedBufferAttribute(this.fx, 2).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    this.geo = g;
    this.u = { uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.6, 0.62, 0.66) } };
    const m = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SMOKE_VS, fragmentShader: SMOKE_FS, transparent: true, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    parent.add(this.mesh);
    this.list = [];
    this.rnd = mulberry32(919);
  }

  clear() {
    this.list.length = 0;
    this.geo.instanceCount = 0;
  }

  emit(x, y, z, vx, vy, vz, size, grow, life, alpha, heat = 0) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x, y, z, vx, vy, vz, size, grow, life, age: 0, alpha, heat, seed: this.rnd() });
  }

  update(dt, lit, shade) {
    this.u.uLit.value.copy(lit);
    this.u.uShade.value.copy(shade);
    const L = this.list;
    let w = 0;
    for (let i = 0; i < L.length; i++) {
      const q = L[i];
      q.age += dt;
      if (q.age > q.life) continue;
      const drag = Math.exp(-dt * 1.4);
      q.vx *= drag;
      q.vy *= drag;
      q.vz *= drag;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.heat *= Math.exp(-dt * 5);
      L[w++] = q;
    }
    L.length = w;
    for (let i = 0; i < w; i++) {
      const q = L[i];
      const u = q.age / q.life;
      const s = q.size * (1 + q.grow * Math.sqrt(u));
      const a = q.alpha * Math.min(1, q.age * 6) * (1 - u) ** 1.3;
      this.pos[i * 4] = q.x;
      this.pos[i * 4 + 1] = q.y;
      this.pos[i * 4 + 2] = q.z;
      this.pos[i * 4 + 3] = q.seed;
      this.fx[i * 2] = s;
      this.fx[i * 2 + 1] = Math.floor(clamp(a, 0, 0.999) * 1000) + clamp(q.heat, 0, 1) * 0.499;
    }
    this.geo.instanceCount = w;
    this.geo.attributes.iPos.needsUpdate = true;
    this.geo.attributes.iFx.needsUpdate = true;
  }
}

// 再入電漿：包住軌道器的光殼
// 只有迎風面（機腹與機頭，物件座標的 -y、-z）發光
const PLASMA_VS = `varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vWind;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
  vWind = dot(normal, normalize(vec3(0.0, -1.0, -0.8)));
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const PLASMA_FS = `uniform float uHeat; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying float vWind;
void main(){
  float f = 1.0 - abs(dot(normalize(vN), vV));
  float wind = smoothstep(-0.1, 0.8, vWind);
  float flick = 0.8 + 0.2 * sin(uTime * 40.0 + vUv.y * 30.0);
  vec3 c = mix(vec3(1.0, 0.32, 0.12), vec3(1.0, 0.7, 0.95), f);
  gl_FragColor = vec4(c * (pow(f, 2.2) * 0.9 + 0.35) * wind * uHeat * flick * 1.5, 1.0);
}`;

export class ShuttleView {
  constructor(scene) {
    this.scene = scene;
    // 升空時的整個箭體
    this.stack = new THREE.Group();
    const sB = new Builder();
    externalTank(sB);
    this.etMesh = new THREE.Mesh(sB.build(), VMAT);
    this.etMesh.castShadow = true;
    this.stack.add(this.etMesh);
    const oB = new Builder();
    orbiter(oB, new THREE.Matrix4());
    const orbGeo = oB.build();
    // 軌道器在箭體上：Rx(90°) 把機頭轉成 +y、機腹朝 -z，再移到燃料箱的 +z 側
    this.mount = new THREE.Matrix4().makeTranslation(0, 22, 4.6).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    this.orbiterOnStack = new THREE.Mesh(orbGeo, VMAT);
    this.orbiterOnStack.applyMatrix4(this.mount);
    this.orbiterOnStack.castShadow = true;
    this.stack.add(this.orbiterOnStack);
    this.srbs = [-6.3, 6.3].map((x) => {
      const m = new THREE.Mesh(booster(x), VMAT);
      m.castShadow = true;
      this.stack.add(m);
      return m;
    });
    // 尾焰
    this.srbFlameMat = flameMat(0xfff2cc, 0xff7a1a, 0.0);
    this.ssmeFlameMat = flameMat(0xf4f6ff, 0x6f8cff, 1.0);
    this.srbFlames = [-6.3, 6.3].map((x) => {
      const f = new THREE.Mesh(flameGeo(1.45, 30), this.srbFlameMat);
      f.position.set(x, -1.6, 0);
      this.stack.add(f);
      return f;
    });
    // 主引擎噴口（水平座標 z = 18.6）換到箭體座標
    this.ssmeFlames = [[0, 4.25], [-1.4, 2.15], [1.4, 2.15]].map(([x, y]) => {
      const f = new THREE.Mesh(flameGeo(1.0, 16), this.ssmeFlameMat);
      f.position.copy(new THREE.Vector3(x, y, 18.6).applyMatrix4(this.mount));
      this.stack.add(f);
      return f;
    });
    scene.add(this.stack);
    // 單獨的軌道器（入軌後、再入與滑翔）
    this.orbiter = new THREE.Group();
    const om = new THREE.Mesh(orbGeo, VMAT);
    om.castShadow = true;
    om.position.set(0, -2.8, 0);
    this.orbiter.add(om);
    this.gear = new THREE.Mesh(gear(), VMAT);
    this.gear.position.copy(om.position);
    this.gear.visible = false;
    this.orbiter.add(this.gear);
    this.plasmaU = { uHeat: { value: 0 }, uTime: { value: 0 } };
    this.plasma = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.ShaderMaterial({ uniforms: this.plasmaU, vertexShader: PLASMA_VS, fragmentShader: PLASMA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    this.plasma.scale.set(7.4, 3.6, 21);
    this.plasma.position.set(0, -1.6, -1.2);
    this.orbiter.add(this.plasma);
    this.wake = new THREE.Mesh(flameGeo(5, 70), flameMat(0xffd2f0, 0xff5a2a, 0.0));
    this.wake.rotation.x = -Math.PI / 2; // 指向 +z（機尾後方）
    this.wake.position.set(0, -2, 8);
    this.orbiter.add(this.wake);
    this.cockpit = new THREE.Object3D();
    this.cockpit.position.set(0, 2.2, -13.6);
    this.orbiter.add(this.cockpit);
    scene.add(this.orbiter);
    // 分離後自由落下的助推器／燃料箱
    this.debris = [];
    // 發射場
    this.pad = new THREE.Mesh(padGeo(), VMAT);
    this.pad.castShadow = true;
    this.pad.receiveShadow = true;
    scene.add(this.pad);
    this.smoke = new Smoke(scene);
    this.light = new THREE.PointLight(0xffa860, 0, 600, 1.2);
    scene.add(this.light);
    this.hide();
    this.lastSep = -1;
    this.lastEt = -1;
    this.emitAcc = 0;
  }

  hide() {
    this.stack.visible = false;
    this.orbiter.visible = false;
    this.pad.visible = false;
    this.light.intensity = 0;
    for (const d of this.debris) this.scene.remove(d.obj);
    this.debris.length = 0;
  }

  // p：玩家；sc：天色（決定煙的受光）；sunDir；hemiCol
  update(p, t, dt, lit, shade, space) {
    const S = p.shuttle;
    const on = p.mode === 'shuttle' && S.phase !== 'off';
    if (!on) {
      if (this.stack.visible || this.orbiter.visible || this.pad.visible || this.debris.length) this.hide();
      this.smoke.update(dt, lit, shade);
      return;
    }
    const ph = S.phase;
    const stackOn = ph === 'pad' || ph === 'count' || ph === 'ascent';
    this.stack.visible = stackOn;
    this.orbiter.visible = !stackOn;
    this.pad.visible = stackOn && S.alt < 9000;
    this.pad.position.set(S.padX, S.padY, S.padZ);
    this.pad.rotation.y = -S.heading0;
    if (stackOn) {
      this.stack.position.set(p.x, p.y, p.z);
      this.stack.rotation.set(-S.tilt, -S.heading, 0, 'YXZ');
      for (const m of this.srbs) m.visible = S.srb;
      this.etMesh.visible = S.et;
      // 尾焰：真空中羽流張開
      const expand = 1 + clamp(S.alt / 25000, 0, 3);
      const pw = S.thrust;
      this.srbFlameMat.uniforms.uPow.value = ph === 'ascent' ? pw : 0;
      this.ssmeFlameMat.uniforms.uPow.value = pw * 0.85;
      this.srbFlameMat.uniforms.uTime.value = t;
      this.ssmeFlameMat.uniforms.uTime.value = t;
      for (const f of this.srbFlames) {
        f.visible = S.srb && ph === 'ascent';
        f.scale.set(expand, (0.8 + 0.2 * Math.sin(t * 37)) * (1 + (expand - 1) * 0.4), expand);
      }
      for (const f of this.ssmeFlames) {
        f.visible = pw > 0.02;
        f.scale.set(expand * 1.2, (0.6 + pw * 0.4) * (1 + (expand - 1) * 0.6), expand * 1.2);
      }
      this.light.position.set(p.x, p.y - 8, p.z);
      this.light.intensity = ph === 'ascent' ? (S.srb ? 900 : 300) * (S.alt < 3000 ? 1 : 0) : pw * 300;
    } else this.light.intensity = 0;
    // 單獨軌道器的姿態
    if (!stackOn) {
      const o = this.orbiter;
      if (ph === 'glide') {
        o.position.set(p.x, p.y, p.z);
        o.rotation.set(p.plane.pitch + 0.08, -p.yaw, -p.plane.roll, 'YXZ');
      } else {
        const pitch = ph === 'reentry' ? 0.7 : ph === 'orbit' ? 0.05 : 0;
        o.position.set(p.x, p.y, p.z);
        o.rotation.set(pitch, -S.heading, -S.roll, 'YXZ');
      }
      this.gear.visible = ph === 'glide' && S.alt < 160;
      this.plasmaU.uHeat.value = S.heat || 0;
      this.plasmaU.uTime.value = t;
      this.plasma.visible = S.heat > 0.01;
      this.wake.visible = S.heat > 0.01;
      this.wake.material.uniforms.uPow.value = S.heat;
      this.wake.material.uniforms.uTime.value = t;
    }
    // 分離
    if (S.sepT > 0 && S.sepT !== this.lastSep) {
      this.lastSep = S.sepT;
      for (const m of this.srbs) this.detach(m, p, S, 1);
    }
    if (S.etT > 0 && S.etT !== this.lastEt) {
      this.lastEt = S.etT;
      this.detach(this.etMesh, p, S, 0);
    }
    this.updateDebris(dt, p);
    this.emitSmoke(p, S, dt);
    this.smoke.update(dt, lit, shade);
    void space;
  }

  // 從箭體複製一份到世界座標，給它一個分離速度
  detach(mesh, p, S, side) {
    const obj = mesh.clone();
    obj.visible = true;
    this.stack.updateMatrixWorld(true);
    obj.applyMatrix4(this.stack.matrixWorld);
    this.scene.add(obj);
    const hx = Math.sin(S.heading);
    const hz = -Math.cos(S.heading);
    // 相對速度：助推器往兩側外推、比箭體慢；燃料箱緩緩落後
    const out = new THREE.Vector3(mesh.geometry.boundingBox ? (mesh.geometry.boundingBox.min.x + mesh.geometry.boundingBox.max.x) / 2 : 0, 0, 0).applyQuaternion(obj.quaternion).normalize();
    this.debris.push({ obj, v: new THREE.Vector3(out.x * 8 * side - hx * 30, -40 - side * 40, out.z * 8 * side - hz * 30), spin: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2, side ? 0.25 : 0.05), age: 0, ref: { x: p.x, y: p.y, z: p.z } });
  }

  updateDebris(dt, p) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.age += dt;
      // 世界座標以箭體為參考（箭體在高空時位置凍結、只有高度上升），這裡只要讓碎片「落後」
      d.v.y -= 9.8 * dt;
      d.obj.position.addScaledVector(d.v, dt);
      d.obj.rotation.x += d.spin.x * dt;
      d.obj.rotation.z += d.spin.z * dt;
      if (d.age > 25 || d.obj.position.distanceTo(new THREE.Vector3(p.x, p.y, p.z)) > 12000) {
        this.scene.remove(d.obj);
        this.debris.splice(i, 1);
      }
    }
  }

  emitSmoke(p, S, dt) {
    const sm = this.smoke;
    const rnd = sm.rnd;
    // 發射台的區域座標 x 軸（導焰槽方向）在世界中的方向
    const ax = Math.cos(S.heading0);
    const az = Math.sin(S.heading0);
    const trench = (k, sp, size, grow, life, alpha) => {
      for (let i = 0; i < k; i++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const l = side * (38 + rnd() * 6);
        const w = (rnd() - 0.5) * 12;
        const v = sp * (0.6 + rnd() * 0.8);
        const spread = (rnd() - 0.5) * 0.5;
        sm.emit(S.padX + ax * l - az * w, S.padY + 3 + rnd() * 4, S.padZ + az * l + ax * w, (ax - az * spread) * side * v, 3 + rnd() * 6, (az + ax * spread) * side * v, size * (0.8 + rnd() * 0.5), grow, life * (0.8 + rnd() * 0.4), alpha);
      }
    };
    // 點火瞬間：導焰槽兩端噴出的蒸汽雲
    if (S.phase === 'count' && S.thrust > 0.05) trench(3, 24, 9, 3.5, 11, 0.75);
    if (S.phase !== 'ascent') return;
    // 剛離台：地面兩側翻滾的煙
    if (S.alt < 700) trench(5, 34, 12, 3, 16, 0.85);
    // 噴口位置（箭體座標 y = -3）
    const base = new THREE.Vector3(0, -3, 0).applyEuler(this.stack.rotation).add(this.stack.position);
    if (S.alt > 45000) return;
    // 煙柱：沿軌跡每隔 spacing 公尺放一顆，越高越粗越淡
    const spacing = clamp(5 + S.alt / 500, 5, 70);
    const v = Math.hypot(S.vUp, S.vH);
    this.emitAcc += v * dt;
    const n = Math.min(12, Math.floor(this.emitAcc / spacing));
    this.emitAcc -= n * spacing;
    const dir = new THREE.Vector3(0, -1, 0).applyEuler(this.stack.rotation);
    for (let k = 0; k < n; k++) {
      const back = (k / Math.max(1, n)) * v * dt;
      const x = base.x + dir.x * back + (rnd() - 0.5) * 2;
      const y = base.y + dir.y * back;
      const z = base.z + dir.z * back + (rnd() - 0.5) * 2;
      const size = S.srb ? spacing * 1.7 + 6 : spacing * 0.9;
      sm.emit(x, y, z, (rnd() - 0.5) * 3, (rnd() - 0.5) * 2, (rnd() - 0.5) * 3, size, S.srb ? 2.2 : 1.4, S.srb ? 70 : 20, S.srb ? 0.82 : 0.22, k === n - 1 ? 1 : 0);
    }
  }
}
