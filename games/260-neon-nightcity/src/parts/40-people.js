
// ═══ 人物：一份幾何、一個 InstancedMesh，骨架動作全在頂點 shader 裡算 ═══
// 骨頭：0 骨盆 1 脊椎 2 頭 3/4 左上臂/前臂 5/6 右上臂/前臂 7/8 左大腿/小腿 9/10 右大腿/小腿（左手在 +x）
// 部位：0 上衣 1 褲子 2 皮膚 3 頭髮 4 鞋 5 發光飾條 6 長外套 7 長髮 8 帽子 9 裙子
const charGeo = (() => {
  const P = [], N = [], B = [], K = [];
  const push = (g, bone, part, m) => {
    const gg = g.index ? g.toNonIndexed() : g; if (m) gg.applyMatrix4(m);
    gg.computeVertexNormals();
    const p = gg.attributes.position.array, n = gg.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) { P.push(p[i], p[i + 1], p[i + 2]); N.push(n[i], n[i + 1], n[i + 2]); B.push(bone); K.push(part); }
  };
  // 上下不同寬的盒子
  const tbox = (cx, cy, cz, h, wB, dB, wT, dT, bone, part, sh = 0) => {
    const g = new T.BoxGeometry(1, 1, 1, 1, 1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const top = p.getY(i) > 0;
      p.setXYZ(i, p.getX(i) * (top ? wT : wB), p.getY(i) * h, p.getZ(i) * (top ? dT : dB) + (top ? sh : 0));
    }
    push(g, bone, part, tf(cx, cy, cz));
  };
  const ball = (cx, cy, cz, sx, sy, sz, bone, part, det = 1) => push(new T.IcosahedronGeometry(1, det), bone, part, tf(cx, cy, cz, 0, 0, 0, sx, sy, sz));
  tbox(0, .95, 0, .22, .33, .21, .34, .22, 0, 1);
  tbox(0, 1.13, 0, .18, .31, .2, .32, .21, 1, 0);
  tbox(0, 1.32, .005, .22, .33, .22, .41, .24, 1, 0, .01);
  tbox(0, 1.465, 0, .07, .41, .23, .3, .2, 1, 0);
  tbox(0, 1.535, 0, .09, .1, .1, .09, .09, 2, 2);
  ball(0, 1.665, .012, .102, .122, .112, 2, 2);
  ball(0, 1.7, -.012, .112, .108, .122, 2, 3);
  tbox(0, 1.6, .105, .03, .1, .02, .1, .02, 2, 3);
  tbox(0, 1.5, -.075, .3, .2, .06, .21, .08, 2, 7);
  push(new T.CylinderGeometry(.13, .13, .07, 14), 2, 8, tf(0, 1.79, -.005));
  push(new T.CylinderGeometry(.2, .2, .012, 16), 2, 8, tf(0, 1.755, .03));
  for (const s of [1, -1]) {
    const ua = s > 0 ? 3 : 5, fa = s > 0 ? 4 : 6, th = s > 0 ? 7 : 9, sn = s > 0 ? 8 : 10;
    tbox(s * .245, 1.29, 0, .3, .09, .1, .115, .12, ua, 0);
    tbox(s * .25, 1.005, .005, .28, .08, .085, .09, .1, fa, 0);
    tbox(s * .255, .82, .012, .1, .065, .035, .075, .045, fa, 2);
    tbox(s * .1, .715, 0, .42, .12, .13, .155, .16, th, 1);
    tbox(s * .1, .3, 0, .42, .1, .11, .12, .13, sn, 1);
    tbox(s * .1, .045, .045, .09, .11, .27, .1, .2, sn, 4);
    tbox(s * .105, 1.3, .118, .2, .018, .01, .018, .01, 1, 5);
  }
  tbox(0, .74, -.01, .56, .48, .31, .37, .25, 0, 6);
  tbox(0, 1.47, -.04, .12, .36, .2, .3, .16, 1, 6);
  tbox(0, .78, 0, .36, .44, .33, .34, .23, 0, 9);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
  g.setAttribute('aBone', new T.Float32BufferAttribute(B, 1));
  g.setAttribute('aPart', new T.Float32BufferAttribute(K, 1));
  g.boundingSphere = new T.Sphere(V3(0, 1, 0), 1.4);
  return g;
})();

const CHAR_VS = /* glsl */`
${GL_LIB}
attribute float aBone, aPart;
attribute vec4 aAnim, aAnim2, aTop, aBot, aSkin, aHair, aGlow;
varying vec3 vW, vN, vCol, vEmi;
const vec3 PIV[11] = vec3[](vec3(0.,.95,0.), vec3(0.,1.05,0.), vec3(0.,1.5,0.), vec3(.21,1.43,0.), vec3(.25,1.15,0.), vec3(-.21,1.43,0.), vec3(-.25,1.15,0.), vec3(.1,.93,0.), vec3(.1,.51,0.), vec3(-.1,.93,0.), vec3(-.1,.51,0.));
const int PAR[11] = int[](-1, 0, 1, 1, 3, 1, 5, 0, 7, 0, 9);
mat3 rx(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 ry(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rz(float a){ float c = cos(a), s = sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
mat3 eul(vec3 a){ return ry(a.y) * rx(a.x) * rz(a.z); }
const float PI2 = 6.2831853;
void walkLegs(inout vec3 A[11], float w, float amp, float knee){
  A[7].x = -amp * sin(w);           A[9].x = amp * sin(w);
  A[8].x = .06 + knee * max(0., sin(w + 1.2));
  A[10].x = .06 + knee * max(0., sin(w + 1.2 + 3.14159));
}
void pose(float id, float t, float b, float v, out vec3 A[11], out vec3 root){
  for (int i = 0; i < 11; i++) A[i] = vec3(0.);
  root = vec3(0.);
  A[3].z = .07; A[5].z = -.07; A[4].x = -.12; A[6].x = -.12;
  float bp = b * PI2;
  float bounce = .5 + .5 * cos(bp);
  if (id < .5) {                                         // 待機
    A[1].x = .02 * sin(t * 1.4); A[2].y = .35 * sin(t * .23 + v * 9.); A[2].x = .04 * sin(t * .7);
    A[0].z = .03 * sin(t * .4 + v); A[7].z = .03; A[9].z = -.03;
  } else if (id < 1.5 || abs(id - 8.) < .5) {            // 走路（8：一手撐傘）
    float w = t * PI2;
    walkLegs(A, w, .42, .62);
    A[3].x = .34 * sin(w); A[5].x = -.34 * sin(w);
    A[4].x = -.22 - .22 * max(0., -sin(w)); A[6].x = -.22 - .22 * max(0., sin(w));
    A[0].y = .1 * sin(w); A[1].y = -.14 * sin(w); A[1].x = .04;
    root.y = .03 * (1. - abs(sin(w))) - .02;
    if (id > 7.5) { A[5] = vec3(-.55, .25, -.12); A[6] = vec3(-1.35, -.3, 0.); A[1].y *= .4; }
  } else if (id < 2.5) {                                 // 跑步
    float w = t * PI2;
    walkLegs(A, w, .8, 1.35);
    A[3].x = .7 * sin(w); A[5].x = -.7 * sin(w);
    A[4].x = -1.25; A[6].x = -1.25;
    A[1].x = .2; A[0].y = .15 * sin(w); A[1].y = -.2 * sin(w);
    root.y = .07 * abs(cos(w)) - .05;
  } else if (id < 3.5) {                                 // 跳舞：彈膝兩步
    A[7].x = -.18 - .25 * bounce; A[9].x = -.18 - .25 * bounce;
    A[8].x = .45 * bounce + .1; A[10].x = .45 * bounce + .1;
    root.y = -.07 * bounce; root.x = .12 * sin(bp * .5);
    A[7].z = .06; A[9].z = -.06;
    A[3] = vec3(-.55 + .3 * sin(bp), 0., .3); A[5] = vec3(-.55 - .3 * sin(bp), 0., -.3);
    A[4].x = -1.5; A[6].x = -1.5;
    A[2].x = .15 * bounce; A[1].y = .28 * sin(bp * .5); A[1].x = .08;
  } else if (id < 4.5) {                                 // 跳舞：雙手舉高
    float k = sin(bp * 2.);
    A[3] = vec3(-.25, 0., 2.55 + .25 * sin(bp)); A[5] = vec3(-.25, 0., -2.55 - .25 * sin(bp + 1.));
    A[4].x = -.3 - .3 * k; A[6].x = -.3 + .3 * k;
    root.y = -.06 * bounce + .05 * max(0., sin(bp * .25)) ;
    A[0].z = .1 * sin(bp * .5); A[1].z = -.08 * sin(bp * .5);
    A[7].x = -.12 * bounce; A[9].x = -.12 * bounce; A[8].x = .25 * bounce; A[10].x = .25 * bounce;
    A[2].x = -.15 + .1 * bounce;
  } else if (id < 5.5) {                                 // 跳舞：左右搖擺、輪流抬膝
    float s = sin(bp * .5);
    A[0].z = .14 * s; A[1].z = -.12 * s; root.x = .14 * s;
    A[3].x = .5 * sin(bp); A[5].x = -.5 * sin(bp); A[3].z = .25; A[5].z = -.25;
    A[4].x = -.9; A[6].x = -.9;
    A[7].x = -.45 * max(0., s); A[8].x = .9 * max(0., s);
    A[9].x = -.45 * max(0., -s); A[10].x = .9 * max(0., -s);
    A[2].z = .12 * s; A[2].x = .1 * bounce; root.y = -.04 * bounce;
  } else if (id < 6.5) {                                 // 坐在吧台高腳椅
    A[7] = vec3(-1.45, 0., .08); A[9] = vec3(-1.45, 0., -.08);
    A[8].x = 1.35; A[10].x = 1.5;
    A[1].x = .12; A[3] = vec3(-.75, 0., .12); A[5] = vec3(-.75, 0., -.12); A[4].x = -.85; A[6].x = -.85;
    float drink = smoothstep(.0, .08, fract(t * .07 + v)) * smoothstep(.2, .12, fract(t * .07 + v));
    A[5].x = mix(-.75, -1.0, drink); A[6].x = mix(-.85, -2.0, drink); A[2].x = mix(.05, -.25, drink);
    A[2].y = .3 * sin(t * .3 + v * 7.);
    root.y = -.17;
  } else if (id < 7.5) {                                 // 調酒：搖雪克杯或擦杯
    if (fract(t * .08 + v) < .5) {
      float sh = sin(t * 19.);
      A[3] = vec3(-1.25 + .12 * sh, 0., .25); A[5] = vec3(-1.25 + .12 * sh, 0., -.25);
      A[4].x = -1.5; A[6].x = -1.5; A[4].y = -.6; A[6].y = .6;
    } else {
      A[5] = vec3(-.7 + .1 * sin(t * 4.), .2 * cos(t * 4.), -.1); A[6].x = -1.1;
      A[3] = vec3(-.6, 0., .1); A[4].x = -1.2;
      A[1].x = .15;
    }
    A[2].y = .25 * sin(t * .4);
  } else if (id < 9.5) {                                 // DJ：一手扶耳機、一手刷盤
    A[3] = vec3(-.35, 0., 2.05); A[4].x = -2.3;
    A[5] = vec3(-.75, .15 * sin(t * 7.), -.15); A[6].x = -.75;
    A[2].x = .25 * bounce; A[1].x = .15 + .05 * bounce; root.y = -.03 * bounce;
  } else if (id < 10.5) {                                // 雙手抱胸
    A[3] = vec3(-.35, 0., -.12); A[5] = vec3(-.35, 0., .12);
    A[4] = vec3(-1.6, -.85, 0.); A[6] = vec3(-1.6, .85, 0.);
    A[2].y = .5 * sin(t * .17 + v * 4.); A[0].z = .02 * sin(t * .3);
    A[7].z = .08; A[9].z = -.08;
  } else if (id < 11.5) {                                // 站著講話、比手勢
    A[5] = vec3(-.4 - .15 * sin(t * 2.6), 0., -.15); A[6].x = -1.2 - .3 * sin(t * 3.3);
    A[2].z = .08 * sin(t * 1.3); A[2].y = .2 * sin(t * .5); A[0].z = .04;
  } else if (id < 12.5) {                                // 騎機車
    A[7] = vec3(-1.15, 0., .2); A[9] = vec3(-1.15, 0., -.2);
    A[8].x = 1.45; A[10].x = 1.45;
    A[1].x = .5; A[2].x = -.4;
    A[3] = vec3(-1.05, 0., .3); A[5] = vec3(-1.05, 0., -.3); A[4].x = -.35; A[6].x = -.35;
    root.y = -.08;
  } else if (id < 14.5) {                                // 跳舞：交替揮拳
    float k = sin(bp);
    A[3] = vec3(-1.4 - .9 * max(0., k), 0., .35); A[4].x = -.6 * (1. - max(0., k));
    A[5] = vec3(-1.4 - .9 * max(0., -k), 0., -.35); A[6].x = -.6 * (1. - max(0., -k));
    root.y = -.08 * bounce; A[8].x = .35 * bounce; A[10].x = .35 * bounce; A[7].x = -.18 * bounce; A[9].x = -.18 * bounce;
    A[2].x = .2 * bounce;
  } else {                                               // 靠牆抽菸
    A[9] = vec3(-.55, 0., -.05); A[10].x = 1.15;
    float puff = smoothstep(.0, .1, fract(t * .1 + v)) * smoothstep(.25, .15, fract(t * .1 + v));
    A[5] = vec3(mix(-.3, -.6, puff), 0., mix(-.1, .2, puff)); A[6].x = mix(-.9, -2.25, puff);
    A[3] = vec3(.1, 0., .12); A[4].x = -.2;
    A[1].x = -.08; A[2].x = mix(.05, -.12, puff);
  }
}
void main(){
  int b = int(aBone + .5); float part = aPart;
  vec3 A[11]; vec3 root;
  float t = uTime * aAnim.z + aAnim.y;
  pose(aAnim.x, t, uBeat + aAnim.w, aAnim.y, A, root);
  if (aAnim2.y > .01) {
    vec3 A2[11]; vec3 root2;
    pose(aAnim2.x, uTime * aAnim2.z + aAnim.y, uBeat + aAnim.w, aAnim.y, A2, root2);
    for (int i = 0; i < 11; i++) A[i] = mix(A[i], A2[i], aAnim2.y);
    root = mix(root, root2, aAnim2.y);
  }
  vec3 p = position, n = normal;
  bool hide = (part > 5.5 && part < 6.5 && aTop.w < .5) || (part > 6.5 && part < 7.5 && aSkin.w < .5) ||
              (part > 7.5 && part < 8.5 && aHair.w < .5) || (part > 8.5 && aBot.w < .5) || (part > 4.5 && part < 5.5 && aGlow.w < .01);
  if (hide) p = PIV[0];
  int k = b;
  for (int s = 0; s < 4; s++) {
    if (k < 0) break;
    mat3 R = eul(A[k]);
    p = R * (p - PIV[k]) + PIV[k]; n = R * n;
    k = PAR[k];
  }
  p += root;
  vec4 lp = instanceMatrix * vec4(p, 1.);
  vec4 w = modelMatrix * lp; vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
  vec3 col = part < .5 ? aTop.rgb : part < 1.5 ? aBot.rgb : part < 2.5 ? aSkin.rgb : part < 3.5 ? aHair.rgb : part < 4.5 ? vec3(.025) :
             part < 5.5 ? vec3(0.) : part < 6.5 ? aTop.rgb * .7 : part < 7.5 ? aHair.rgb : part < 8.5 ? aTop.rgb * .5 : aBot.rgb;
  vCol = col; vEmi = part > 4.5 && part < 5.5 ? aGlow.rgb * aGlow.w : vec3(0.);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CHAR_FS = /* glsl */`
${GL_LIB}
varying vec3 vW, vN, vCol, vEmi;
void main(){
  if (vW.y < uClipY) discard;
  vec3 n = normalize(vN), v = normalize(uCam - vW);
  vec3 c = shade(vW, n, v, vCol, .65, 0.);
  c += vCol * pow(1. - max(dot(n, v), 0.), 3.) * (uFogHi * 1.5 + .02);
  c += vEmi;
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const MAT_CHAR = new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: CHAR_VS, fragmentShader: CHAR_FS });
const ANIM = { idle: 0, walk: 1, run: 2, danceA: 3, danceB: 4, danceC: 5, sit: 6, bartend: 7, umbrella: 8, dj: 9, cross: 10, talk: 11, ride: 12, punch: 14, smoke: 15 };
const SKINS = [0xf1c8a8, 0xd9a07a, 0xb57a52, 0x8a5636, 0x5e3a24, 0xe8b894].map(lin);
const HAIRS = [0x15110e, 0x2b1d14, 0x5a3a22, 0xb08a5a, 0x777777, 0x1a1a2a, 0x8a2a3a, 0x3a6a8a].map(lin);
const TOPS = [0x2a2c30, 0x3b2a22, 0x5a1d22, 0x1f2f45, 0x6d6a60, 0x23352a, 0x8a6a3a, 0x111215, 0x4a2a4a, 0x9a9a92, 0x2a4a5a].map(lin);
const BOTS = [0x1a1c22, 0x2a2d35, 0x3a3228, 0x101012, 0x2f3a4a, 0x4a4038].map(lin);
const GLOWS = [0x2cf2d8, 0xff3fa0, 0xffae57, 0x7af0ff, 0xd6ff3a].map(lin);
// 建一群人：每人一組外觀與動作
function crowd(n, cap = n) {
  const g = charGeo.clone();
  const attrs = {};
  for (const k of ['aAnim', 'aAnim2', 'aTop', 'aBot', 'aSkin', 'aHair', 'aGlow']) { attrs[k] = new T.InstancedBufferAttribute(new Float32Array(cap * 4), 4); g.setAttribute(k, attrs[k]); }
  const m = new T.InstancedMesh(g, MAT_CHAR, cap);
  m.count = n; m.frustumCulled = false;
  const people = [];
  for (let k = 0; k < cap; k++) people.push({ k, x: 0, y: 0, z: 0, yaw: 0, s: 1 });
  const api = {
    mesh: m, people, attrs,
    look(k, o = {}) {
      const r = o.r || Math.random;
      const pick = (arr) => arr[Math.floor(r() * arr.length)];
      const set = (name, c, w) => attrs[name].setXYZW(k, c.r, c.g, c.b, w);
      set('aTop', o.top || pick(TOPS), o.coat ?? (r() < .35 ? 1 : 0));
      set('aBot', o.bot || pick(BOTS), o.skirt ?? (r() < .2 ? 1 : 0));
      set('aSkin', o.skin || pick(SKINS), o.longHair ?? (r() < .4 ? 1 : 0));
      set('aHair', o.hair || pick(HAIRS), o.hat ?? (r() < .15 ? 1 : 0));
      const gc = o.glow || pick(GLOWS); set('aGlow', gc, o.glowI ?? (r() < .3 ? 1.6 : 0));
      people[k].s = o.scale || (.92 + r() * .14);
    },
    anim(k, id, phase = Math.random() * 10, speed = 1, beatOff = 0) { attrs.aAnim.setXYZW(k, id, phase, speed, beatOff); },
    anim2(k, id, w, speed = 1) { attrs.aAnim2.setXYZW(k, id, w, speed, 0); },
    place(k, x, y, z, yaw) { const p = people[k]; p.x = x; p.y = y; p.z = z; p.yaw = yaw; _o.position.set(x, y, z); _o.rotation.set(0, yaw, 0); _o.scale.setScalar(p.s); _o.updateMatrix(); m.setMatrixAt(k, _o.matrix); },
    flush() { m.instanceMatrix.needsUpdate = true; for (const k in attrs) attrs[k].needsUpdate = true; },
  };
  return api;
}

// ─── 街上的行人：沿著街區人行道繞圈，多數撐傘 ───
const PED_N = LOW ? 18 : 38;
const peds = crowd(PED_N + 8);
const pedState = [];
const rP = rng(77);
const umbrellas = [];
{
  const inner = blocks.filter(b => !b.outer);
  for (let k = 0; k < PED_N; k++) {
    const b = inner[Math.floor(rP() * inner.length)];
    const inset = 1.3 + rP() * 2.4;
    const w = b.x1 - b.x0 - inset * 2, d = b.z1 - b.z0 - inset * 2;
    const per = 2 * (w + d);
    const um = rP() < .62;
    pedState.push({ b, inset, w, d, per, s: rP() * per, dir: rP() < .5 ? 1 : -1, v: 1.05 + rP() * .5, um, dodge: 0, dx: 0, dz: 0 });
    peds.look(k, { r: rP });
    peds.anim(k, um ? ANIM.umbrella : ANIM.walk, rP() * 10, pedState[k].v * .78);
    if (um) umbrellas.push(k);
  }
  // 夜店門口排隊的人與保鑣
  for (let q = 0; q < 6; q++) {
    const k = PED_N + q;
    peds.look(k, { r: rP, glowI: q % 2 ? 1.6 : 0 });
    const x = CLUB_X - 4.5 - q * 1.05, z = CLUB_Z + 1.5 + (q % 2) * .3;
    peds.anim(k, q % 3 === 0 ? ANIM.talk : q % 3 === 1 ? ANIM.idle : ANIM.smoke, rP() * 10, 1);
    peds.place(k, x, .15, z, Math.PI / 2 + (rP() - .5) * .8);
    circles.push({ x, z, r: .3 });
  }
  peds.look(PED_N + 6, { top: lin(0x0c0c0e), bot: lin(0x0c0c0e), skin: SKINS[3], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, glowI: 0, scale: 1.12 });
  peds.anim(PED_N + 6, ANIM.cross, 0, 1);
  peds.place(PED_N + 6, CLUB_X + 1.6, .15, CLUB_Z + 1.1, 0);
  circles.push({ x: CLUB_X + 1.6, z: CLUB_Z + 1.1, r: .35 });
  // 酒吧門口抽菸的人
  peds.look(PED_N + 7, { r: rP, coat: 1 });
  peds.anim(PED_N + 7, ANIM.smoke, 3, 1);
  peds.place(PED_N + 7, BAR_X - 3.2, .15, BAR_Z + .45, .2);
  circles.push({ x: BAR_X - 3.2, z: BAR_Z + .45, r: .3 });
  peds.mesh.count = PED_N + 8;
  scene.add(peds.mesh);
}
const BOUNCER = { x: CLUB_X + 1.6, z: CLUB_Z + 1.1 };
const umbMesh = (() => {
  const k = new Kit();
  const cone = new T.ConeGeometry(.62, .32, 10, 1, true);
  k.add(cone, 0xffffff, 10, tf(0, .16, 0));
  k.cyl(0, -.45, 0, .012, .012, .95, 5, 0x222222, 15);
  k.cyl(0, -.94, .03, .02, .02, .12, 5, 0x3a2a1a, 2, .5);
  const g = k.build();
  const m = new T.InstancedMesh(g, MAT.uberD, Math.max(1, umbrellas.length));
  const cols = [0x111214, 0x1a1c22, 0x5a1218, 0x1d2a45, 0x8fa8b8, 0x2c3e2c].map(lin);
  const ic = new Float32Array(Math.max(1, umbrellas.length) * 3);
  umbrellas.forEach((_, i) => { const c = cols[i % cols.length]; ic.set([c.r, c.g, c.b], i * 3); });
  m.instanceColor = new T.InstancedBufferAttribute(ic, 3);
  m.frustumCulled = false; scene.add(m);
  return m;
})();
// uberD 是雙面材質：傘面顏色以 instanceColor 乘上
MAT.uberD.vertexShader = MAT.uberD.vertexShader.replace('vCol = color;', `vCol = color;
  #ifdef USE_INSTANCING_COLOR
  vCol *= instanceColor;
  #endif
  `);
function pedPos(ps) {
  const { b, inset, w, d } = ps;
  let s = ((ps.s % ps.per) + ps.per) % ps.per;
  const x0 = b.x0 + inset, z0 = b.z0 + inset;
  if (s < w) return [x0 + s, z0, 1, 0];
  s -= w; if (s < d) return [x0 + w, z0 + s, 0, 1];
  s -= d; if (s < w) return [x0 + w - s, z0 + d, -1, 0];
  s -= w; return [x0, z0 + d - s, 0, -1];
}
function updatePeds(dt) {
  let u = 0;
  pedState.forEach((ps, k) => {
    ps.s += ps.v * ps.dir * dt;
    let [x, z, tx, tz] = pedPos(ps);
    tx *= ps.dir; tz *= ps.dir;
    // 被玩家逼近時往旁邊閃
    const px = player.mode === 'drive' ? player.veh.x : player.x, pz = player.mode === 'drive' ? player.veh.z : player.z;
    const dx = x + ps.dx - px, dz = z + ps.dz - pz, dd = Math.hypot(dx, dz);
    const danger = player.mode === 'drive' ? (Math.hypot(player.veh.vx, player.veh.vz) > 3 ? 4.5 : 2.4) : .9;
    if (dd < danger && dd > .01) { ps.dx += dx / dd * (danger - dd) * 4 * dt; ps.dz += dz / dd * (danger - dd) * 4 * dt; ps.dodge = 1.2; }
    ps.dx = damp(ps.dx, 0, ps.dodge > 0 ? .3 : 1.2, dt); ps.dz = damp(ps.dz, 0, ps.dodge > 0 ? .3 : 1.2, dt);
    const lim = 1.4; ps.dx = clamp(ps.dx, -lim, lim); ps.dz = clamp(ps.dz, -lim, lim);
    if (ps.dodge > 0) ps.dodge -= dt;
    x += ps.dx; z += ps.dz;
    const yaw = Math.atan2(tx, tz);
    peds.place(k, x, .15, z, yaw);
    if (ps.um) {
      const sc = peds.people[k].s;
      _o.position.set(x + Math.cos(yaw) * -.1 * sc + Math.sin(yaw) * .05, .15 + 2.02 * sc, z - Math.sin(yaw) * -.1 * sc + Math.cos(yaw) * .05);
      _o.rotation.set(.08, yaw, 0); _o.scale.setScalar(1); _o.updateMatrix();
      umbMesh.setMatrixAt(u++, _o.matrix);
    }
  });
  umbMesh.count = u; umbMesh.instanceMatrix.needsUpdate = true;
  peds.flush();
}

// ─── 玩家 ───
const me = crowd(1);
me.look(0, { top: lin(0x2b2420), bot: lin(0x17181c), skin: SKINS[1], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, glow: lin(0xffae57), glowI: 1.4, scale: 1 });
me.anim(0, ANIM.idle, 0, 1);
scene.add(me.mesh);
const player = { mode: 'walk', x: avX(1) - 9.6, z: stZ(2) + 18, y: .15, yaw: 0, v: 0, vx: 0, vz: 0, veh: null, walkPh: 0, dance: 0, anim: ANIM.idle, blend: 0, prevAnim: ANIM.idle, where: 'out', stepT: 0 };
function updatePlayerWalk(inp, dt, camYaw) {
  let mx = inp.mx, mz = inp.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  if (ml > .05) player.dance = 0;
  // 相機的前方 = (sin yaw, cos yaw)；右方 = (-cos, sin)
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
  const wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
  const run = inp.run && ml > .1;
  const target = ml > .05 ? (run ? 4.6 : 1.7) * Math.min(1, ml) : 0;
  player.v = damp(player.v, target, target > player.v ? 6 : 10, dt);
  if (ml > .05) {
    const ty = Math.atan2(wx, wz);
    player.yaw += wrapA(ty - player.yaw) * (1 - Math.exp(-12 * dt));
  }
  const nx = player.x + Math.sin(player.yaw) * player.v * dt, nz = player.z + Math.cos(player.yaw) * player.v * dt;
  let r = collideCircle(nx, nz, .32, false);
  let x = r.x, z = r.z;
  // 車流與座駕也會擋路
  const pushOut = (ox, oz, rr) => { const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz); if (d < rr && d > 1e-4) { x = ox + dx / d * rr; z = oz + dz / d * rr; } };
  for (const c of traffic) { const L = TYPES[c.type].len * .3; for (const s of [-1, 1]) pushOut(c.x + Math.sin(c.yaw) * L * s, c.z + Math.cos(c.yaw) * L * s, TYPES[c.type].w * .5 + .32); }
  for (const v of vehicles) { const L = v.off; for (const s of [-1, 1]) pushOut(v.x + Math.sin(v.yaw) * L * s, v.z + Math.cos(v.yaw) * L * s, v.rad + .3); }
  for (let k = 0; k < PED_N; k++) { const p = peds.people[k]; pushOut(p.x, p.z, .55); }
  player.x = x; player.z = z;
  player.y = damp(player.y, groundH(x, z), 20, dt);
  // 動作混合
  const sp = player.v;
  let a = sp > 3 ? ANIM.run : sp > .25 ? ANIM.walk : player.dance ? [ANIM.danceA, ANIM.danceB, ANIM.danceC, ANIM.punch][player.dance - 1] : ANIM.idle;
  if (a !== player.anim) { player.prevAnim = player.anim; player.anim = a; player.blend = 1; }
  player.blend = Math.max(0, player.blend - dt * 5);
  const rate = a === ANIM.run ? sp / 4.6 * 1.45 : a === ANIM.walk ? sp / 1.7 * .9 : 1;
  player.walkPh += dt * rate;
  me.anim(0, a, player.walkPh - uTimeNow(), 1, 0);
  me.anim2(0, player.prevAnim, player.blend, 1);
  me.place(0, player.x, player.y, player.z, player.yaw);
  me.flush();
  // 腳步聲
  if (a === ANIM.walk || a === ANIM.run) {
    const ph = player.walkPh * 2;
    if (Math.floor(ph) !== Math.floor(player.stepT)) sfx.step(a === ANIM.run, player.where !== 'out');
    player.stepT = ph;
  }
}
const uTimeNow = () => U.uTime.value;
