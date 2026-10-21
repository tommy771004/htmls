
// ═══ 城市：街區、建築立面、路面與人行道 ═══
await bootStep(BOOT.city, '正在鋪路…');
const scene = new T.Scene();
const LY = { MAIN: 0, NOREFL: 1 };     // 1 號圖層不進倒影（雨、蒸氣、小物件）
const rnd = rng(20261019);
const colliders = [];                   // 靜態 AABB：{x0,x1,z0,z1}
const circles = [];                     // 靜態圓柱：{x,z,r}
let activeBoxes = colliders, activeCircles = circles;   // 室內時換成室內的碰撞表
const blocks = [], lots = [], shopUnits = [];

for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++)
  blocks.push({ i, j, x0: avX(i) + HR, x1: avX(i + 1) - HR, z0: stZ(j) + HR, z1: stZ(j + 1) - HR, outer: 0 });
{ // 外圍：一整圈連續的樓牆，背後再一圈高樓
  const D = 50, ax0 = avX(0) - HR, ax1 = avX(NX) + HR, sz0 = stZ(0) - HR, sz1 = stZ(NZ) + HR;
  blocks.push({ x0: ax0 - D, x1: ax1 + D, z0: sz1, z1: sz1 + D, outer: 'n' });
  blocks.push({ x0: ax0 - D, x1: ax1 + D, z0: sz0 - D, z1: sz0, outer: 's' });
  blocks.push({ x0: ax0 - D, x1: ax0, z0: sz0, z1: sz1, outer: 'w' });
  blocks.push({ x0: ax1, x1: ax1 + D, z0: sz0, z1: sz1, outer: 'e' });
}
const district = (x, z) => {
  const i = (x - X0) / P, j = (z - Z0) / Q;
  if (i < 0 || i > NX || j < 0 || j > NZ) return '城郊 Outskirts';
  if (i >= 1 && i <= 3.4 && j >= 1.5 && j <= 4) return '霓虹區 Neon District';
  if (i < 1.6) return '舊碼頭 Old Docks';
  if (j < 1.5) return '紅磚巷 Brick Row';
  if (i > 3.4) return '中城 Midtown';
  return '霓虹區 Neon District';
};

// 特殊店面：LAZARUS 夜店（Atlas 與 Bishop 之間，面向 9 St）、AFTERGLOW 酒吧（Cinder 與 Delmar 之間，面向 7 St）、
// CHROME WORKS 改裝廠（Bishop 與 Cinder 之間，面向 8 St）、VELOCE MOTORS 車行（Cinder 與 Delmar 之間，面向 9 St）、
// 你的車庫 GARAGE 07（Harbor 與 Atlas 之間，面向 8 St）
const SPECIAL = {
  club: { i: 1, j: 2, side: +1, at: .5, w: 20 },
  bar: { i: 3, j: 0, side: +1, at: .45, w: 13 },
  garage: { i: 2, j: 1, side: +1, at: .5, w: 13 },
  dealer: { i: 3, j: 2, side: +1, at: .5, w: 22 },
  home: { i: 0, j: 2, side: -1, at: .78, w: 12 },
};
const DEAL_X = lerp(avX(3) + HR + SW, avX(4) - HR - SW, SPECIAL.dealer.at), DEAL_Z = stZ(3) - HR - SW;
const HOME_X = lerp(avX(0) + HR + SW, avX(1) - HR - SW, SPECIAL.home.at), HOME_Z = stZ(2) + HR + SW;
const venues = {};

// 一個街區切成兩排（面向 -z 與 +z），每排沿 x 切成數個地塊
function makeLots(b) {
  const bx0 = b.x0 + SW, bx1 = b.x1 - SW, bz0 = b.z0 + SW, bz1 = b.z1 - SW;
  if (b.outer) {
    const face = { n: -1, s: 1, w: 1, e: -1 }[b.outer];
    if (b.outer === 'n' || b.outer === 's') {
      const zf = b.outer === 'n' ? bz0 : bz1, zb = b.outer === 'n' ? bz0 + 22 : bz1 - 22;
      rowLots(bx0, bx1, Math.min(zf, zb), Math.max(zf, zb), face, b, 'z');
      backTowers(bx0, bx1, b.outer === 'n' ? zb : b.z0, b.outer === 'n' ? b.z1 : zb, 'x');
    } else {
      const xf = b.outer === 'w' ? bx1 : bx0, xb = b.outer === 'w' ? bx1 - 22 : bx0 + 22;
      rowLots(Math.min(xf, xb), Math.max(xf, xb), b.z0 + SW, b.z1 - SW, face, b, 'x');
      backTowers(b.outer === 'w' ? b.x0 : xb, b.outer === 'w' ? xb : b.x1, b.z0, b.z1, 'z');
    }
    const c = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 };
    if (b.outer === 'n') c.z0 += SW; else if (b.outer === 's') c.z1 -= SW; else if (b.outer === 'w') c.x1 -= SW; else c.x0 += SW;
    colliders.push(c);
    return;
  }
  const mid = (bz0 + bz1) / 2;
  rowLots(bx0, bx1, bz0, mid, -1, b, 'z');
  rowLots(bx0, bx1, mid, bz1, +1, b, 'z');
  colliders.push({ x0: bx0, x1: bx1, z0: bz0, z1: bz1 });
}
// axis 'z'：地塊沿 x 排開、正面朝 ±z；axis 'x'：沿 z 排開、正面朝 ±x
function rowLots(x0, x1, z0, z1, face, b, axis) {
  const along0 = axis === 'z' ? x0 : z0, along1 = axis === 'z' ? x1 : z1;
  let a = along0;
  const sp = Object.entries(SPECIAL).find(([, s]) => s.i === b.i && s.j === b.j && s.side === face && axis === 'z');
  const cuts = [];
  if (sp) { const c = lerp(along0, along1, sp[1].at); cuts.push([c - sp[1].w / 2, c + sp[1].w / 2, sp[0]]); }
  while (a < along1 - .01) {
    let w = 7 + rnd() * 9;
    const cut = cuts.find(c => a < c[1] && a + w > c[0]);
    if (cut) {
      if (a < cut[0] - .01) w = cut[0] - a;
      else { addLot(axis, cut[0], cut[1], x0, x1, z0, z1, face, b, cut[2]); a = cut[1]; continue; }
    }
    if (along1 - (a + w) < 6) w = along1 - a;
    addLot(axis, a, a + w, x0, x1, z0, z1, face, b, null);
    a += w;
  }
}
function addLot(axis, a0, a1, x0, x1, z0, z1, face, b, special) {
  const L = axis === 'z' ? { x0: a0, x1: a1, z0, z1 } : { x0, x1, z0: a0, z1: a1 };
  const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  const dist = district(cx, cz);
  const neon = dist.startsWith('霓虹'), mid = dist.startsWith('中城'), docks = dist.startsWith('舊碼頭');
  let style, floors;
  const r = rnd();
  if (special === 'club') { style = 5; floors = 3; }
  else if (special === 'bar') { style = 6; floors = 4; }
  else if (special === 'garage') { style = 2; floors = 2; }
  else if (special === 'dealer') { style = 3; floors = 0; }
  else if (special === 'home') { style = 2; floors = 3; }
  else if (b.outer) { style = r < .5 ? 0 : r < .75 ? 1 : 2; floors = 5 + Math.floor(rnd() * 6); }
  else if (mid && r < .35) { style = 3; floors = 0; }
  else if (neon && r < .3) { style = 4; floors = 4 + Math.floor(rnd() * 5); }
  else if (neon && r < .4) { style = 3; floors = 0; }
  else { style = docks ? (r < .7 ? 1 : 0) : r < .55 ? 0 : r < .8 ? 1 : 2; floors = 3 + Math.floor(rnd() * (docks ? 3 : 6)); }
  const fh = style === 3 ? 3.7 : style === 2 ? 3.4 : 3.1;
  const h = style === 3 ? 38 + rnd() * (mid ? 70 : 40) : 4.6 + floors * fh + .7;
  lots.push({ ...L, h, style, seed: rnd() * 1000, face, axis, special, fh, b });
}
function backTowers(x0, x1, z0, z1, along) {
  const a0 = along === 'x' ? x0 : z0, a1 = along === 'x' ? x1 : z1;
  for (let a = a0; a < a1 - 4;) {
    const w = Math.min(a1 - a, 16 + rnd() * 18);
    const L = along === 'x' ? { x0: a, x1: a + w, z0, z1 } : { x0, x1, z0: a, z1: a + w };
    lots.push({ ...L, h: 50 + rnd() * 110, style: rnd() < .7 ? 3 : 2, seed: rnd() * 1000, face: 0, axis: along === 'x' ? 'z' : 'x', back: 1, fh: 3.7 });
    a += w;
  }
}
blocks.forEach(makeLots);

// ─── 建築幾何：每個面一個四邊形，帶面寬、樣式、店面遮罩 ───
const FACADE_VS = /* glsl */`
attribute vec4 aB; attribute vec4 aB2;
varying vec3 vW, vN; varying vec2 vUv; varying vec4 vB, vB2;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv; vB = aB; vB2 = aB2;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FACADE_FS = /* glsl */`
${GL_LIB}
varying vec3 vW, vN; varying vec2 vUv; varying vec4 vB, vB2;
vec3 L(vec3 c){ return c*c; }
float brick(vec2 q, out vec2 id){
  vec2 b = q / vec2(.23, .076);
  b.x += step(1., mod(floor(b.y), 2.)) * .5;
  id = floor(b);
  vec2 f = fract(b);
  float m = smoothstep(0., .1, f.y) * smoothstep(1., .9, f.y) * smoothstep(0., .04, f.x) * smoothstep(1., .96, f.x);
  float lod = 1. - smoothstep(.12, .45, fwidth(b.y));
  return mix(.8, m, lod);
}
// 室內映射：從窗面往房間裡射線，求出撞到後牆、側牆或天花板地板
vec3 room(vec3 o, vec3 vd, vec3 dim, float hs, vec3 lc, float kind){
  vec3 inv = 1. / max(abs(vd), vec3(1e-4));
  float tx = (vd.x > 0. ? dim.x - o.x : o.x) * inv.x;
  float ty = (vd.y > 0. ? dim.y - o.y : o.y) * inv.y;
  float tz = (dim.z - o.z) * inv.z;
  float t = min(tx, min(ty, tz));
  vec3 hp = o + vd * t;
  vec3 c; float lit = 1.;
  if (t == tz) {
    vec2 bw = hp.xy / dim.xy;
    c = mix(vec3(.5,.42,.36), vec3(.36,.4,.44), fract(hs*13.));
    if (kind < .5) {                       // 住家：畫框、書架、人影
      float pic = step(.18, bw.x)*step(bw.x, .5)*step(.45, bw.y)*step(bw.y, .72)*step(.45, fract(hs*7.));
      c = mix(c, vec3(.16,.1,.06), pic);
      float shelf = step(.62, bw.x)*step(bw.x, .92)*step(bw.y, .75)*step(.6, fract(hs*3.));
      c = mix(c, vec3(.2,.13,.08) * (.6 + .4*step(.5, fract(bw.y*6.))), shelf);
      float px = fract(hs*29.)*.6 + .2;
      float person = step(abs(bw.x - px), .07 - .03*step(.55, bw.y)) * step(bw.y, .62 + .08*step(abs(bw.x-px), .035)) * step(.72, fract(hs*17.));
      c = mix(c, vec3(.04), person);
    } else if (kind < 1.5) {              // 辦公室：隔板與螢幕
      c = vec3(.5,.52,.55);
      float desk = step(bw.y, .32) * step(.2, bw.y);
      c = mix(c, vec3(.18,.2,.22), desk);
      float scr = step(.32, bw.y) * step(bw.y, .42) * step(.5, fract(bw.x*5.));
      c = mix(c, vec3(.3,.6,1.)*2., scr * step(.4, fract(hs*5.)));
    }
  } else if (t == ty) {
    if (vd.y > 0.) { c = vec3(.75,.72,.66); if (kind > .5 && kind < 1.5) c += step(.85, fract(hp.z*.8)) * 3.; }
    else c = kind > .5 ? vec3(.28,.28,.3) : vec3(.3,.2,.13);
  } else c = vec3(.46,.4,.35) * .85;
  float ld = length(hp - vec3(dim.x*.5, dim.y*.92, dim.z*.45));
  c *= lc * (.45 + 1.3 / (1. + ld*ld*.5));
  return c * mix(1., .55, hp.z / dim.z);
}
// 店面室內：貨架、日光燈、地磚
vec3 shopRoom(vec3 o, vec3 vd, vec3 dim, float hs){
  vec3 inv = 1. / max(abs(vd), vec3(1e-4));
  float tx = (vd.x > 0. ? dim.x - o.x : o.x) * inv.x;
  float ty = (vd.y > 0. ? dim.y - o.y : o.y) * inv.y;
  float tz = (dim.z - o.z) * inv.z;
  float t = min(tx, min(ty, tz));
  vec3 hp = o + vd * t;
  float kind = floor(fract(hs*7.13) * 5.);
  vec3 lc = kind == 2. ? vec3(1.,.62,.32) : kind == 3. ? vec3(.5,.42,.9) : kind == 4. ? vec3(.7,1.,.85) : vec3(1.,.97,.9);
  vec3 c;
  if (t == tz || t == tx) {
    vec2 bw = t == tz ? hp.xy : vec2(hp.z, hp.y);
    c = vec3(.72,.7,.66);
    if (kind == 0. || kind == 4.) {          // 雜貨、藥局：一排排貨架
      float row = floor(bw.y / .42); float fy = fract(bw.y / .42);
      vec3 prod = .25 + .75*vec3(h21(vec2(floor(bw.x*5.), row)), h21(vec2(floor(bw.x*5.)+3., row)), h21(vec2(floor(bw.x*5.)+7., row)));
      c = mix(c, prod, step(.25, fy) * step(bw.y, 2.1) * step(.3, bw.y));
      c *= mix(1., .4, step(fy, .08));
    } else if (kind == 1.) {                 // 洗衣店：滾筒
      vec2 cell = vec2(fract(bw.x / .8) - .5, bw.y - .7);
      float drum = smoothstep(.27, .24, length(cell)) * step(bw.y, 1.2);
      c = mix(vec3(.85), vec3(.15,.2,.25), drum);
    } else if (kind == 2.) {                 // 小吃店：櫃台、菜單燈箱
      c = vec3(.55,.32,.18);
      c = mix(c, vec3(1.2,1.,.7), step(1.7, bw.y) * step(bw.y, 2.3) * step(.15, fract(bw.x*.7)));
    } else {                                 // 電器、遊樂場：亮著的螢幕
      c = vec3(.12,.1,.16);
      vec2 g = vec2(fract(bw.x*1.6), fract(bw.y*1.4));
      vec3 sc = .4 + .6*vec3(h21(floor(bw*vec2(1.6,1.4))), h21(floor(bw*vec2(1.6,1.4))+5.), h21(floor(bw*vec2(1.6,1.4))+9.));
      c = mix(c, sc * 2.2 * (.8 + .2*sin(uTime*3. + bw.x*9.)), step(.12, g.x)*step(g.x,.88)*step(.15,g.y)*step(g.y,.8)*step(.4, bw.y));
    }
  } else if (vd.y > 0.) {
    c = vec3(.6) + step(.8, fract(hp.z / 1.1)) * step(.15, fract(hp.x / 1.6)) * 4.;
  } else {
    vec2 tl = floor(hp.xz / .5);
    c = mix(vec3(.5), vec3(.35), mod(tl.x + tl.y, 2.));
  }
  // 店員或客人的剪影
  float px = fract(hs*31.)*dim.x*.7 + dim.x*.15, pz = dim.z * (.35 + .4*fract(hs*11.));
  float tp = (pz - o.z) / max(vd.z, 1e-3);
  vec3 pp = o + vd * tp;
  float person = step(abs(pp.x - px), .2 - .08*step(1.45, pp.y)) * step(pp.y, 1.72) * step(tp, t) * step(.35, fract(hs*23.));
  c = mix(c, vec3(.03), person);
  return c * lc * mix(1.25, .7, hp.z / dim.z);
}
void main(){
  if (vW.y < uClipY) discard;
  vec3 n = normalize(vN);
  vec3 v = normalize(uCam - vW);
  float seed = vB.x, fw = vB.z, shop = vB.w;
  int st = int(vB.y + .5);
  float u = vUv.x, y = vW.y, H = vB2.z;
  vec3 c;
  if (n.y > .5) {                                  // 屋頂：瀝青、積水
    float f = fbm(vW.xz*.5);
    vec3 alb = vec3(.035,.035,.04) * (.7 + .6*f);
    float pud = smoothstep(.55, .65, fbm(vW.xz*.15 + seed));
    c = shade(vW, n, v, alb, mix(.85, .1, pud), 0.);
    c += envMap(reflect(-v, n)) * pud * .35;
    gl_FragColor = vec4(applyFog(c, vW), 1.); return;
  }
  if (st == 7) {                                   // 簷口、女兒牆、窗台線
    vec3 alb = L(mix(vec3(.42,.36,.3), vec3(.3,.28,.27), fract(seed*3.))) * (.8 + .3*fbm(vec2(u, y)*2.));
    c = shade(vW, n, v, alb, .8, 0.);
    gl_FragColor = vec4(applyFog(c, vW), 1.); return;
  }
  vec3 Tn = vec3(n.z, 0., -n.x);
  vec3 V = -v;
  vec3 vd = vec3(dot(V, Tn), V.y, dot(V, -n));
  float grime = fbm(vec2(u*.6, y*.08) + seed);
  // 牆面底色
  vec3 wall; float rough = .85;
  vec2 bid; float bm = brick(vec2(u, y), bid);
  float bv = h21(bid + seed);
  if (st == 0) wall = L(vec3(.5,.22,.15)) * mix(.75, 1.15, bv) * (.55 + .45*bm);
  else if (st == 1) wall = L(vec3(.42,.3,.22)) * mix(.75, 1.12, bv) * (.55 + .45*bm);
  else if (st == 2) { wall = L(vec3(.55,.52,.47)) * (.85 + .15*fbm(vec2(u,y)*3.)); float bl = fract(y/.6); wall *= .8 + .2*smoothstep(0.,.04,bl); }
  else if (st == 3) wall = L(vec3(.22,.24,.27));
  else if (st == 4) wall = L(mix(vec3(.36,.5,.5), vec3(.55,.4,.44), fract(seed*7.))) * (.85 + .15*fbm(vec2(u,y)*2.));
  else if (st == 5) wall = L(vec3(.12,.11,.12)) * (.6 + .4*bm);
  else wall = L(vec3(.45,.2,.14)) * mix(.8, 1.1, bv) * (.55 + .45*bm);
  wall *= 1. - .35*grime*smoothstep(H, 0., y*.6);
  wall *= mix(.6, 1., smoothstep(0., .9, y));       // 雨水打濕的牆腳
  float gH = 4.6;
  float fh = st == 3 ? 3.7 : st == 2 ? 3.4 : 3.1;
  float ws = st == 3 ? 1.6 : st == 2 ? 2.2 : 2.5;
  float nF = floor((H - gH - .7) / fh);
  float cols = max(1., floor((fw - 1.) / ws)); float mg = (fw - cols*ws) * .5;
  float cu = (u - mg) / ws; float ci = floor(cu);
  float fy = (y - gH) / fh; float fi = floor(fy);
  vec2 f = vec2(fract(cu), fract(fy));
  vec2 wmin = st == 3 ? vec2(.03,.06) : vec2(.27,.18), wmax = st == 3 ? vec2(.97,.96) : vec2(.73,.8);
  bool grid = ci >= 0. && ci < cols && fi >= 0. && fi < nF;
  bool inWin = grid && f.x > wmin.x && f.x < wmax.x && f.y > wmin.y && f.y < wmax.y;
  // 地面層
  if (y < gH) {
    if (shop > .5 && st != 5) {
      float units = max(vB2.y, 1.); float uw = fw / units;
      float ui = floor(u / uw); float ux = fract(u / uw);
      float shut = mod(floor(vB2.x / exp2(ui)), 2.);
      float hs = h21(vec2(ui, seed));
      if (st == 6) { shut = 0.; }
      if (ux < .045 || ux > .955 || y > 3.42) {
        vec3 alb = y > 3.42 ? L(vec3(.08,.08,.09)) : L(vec3(.3,.28,.26)) * (.8 + .3*fbm(vec2(u,y)*4.));
        if (st == 6) alb = L(vec3(.06,.16,.12));
        c = shade(vW, n, v, alb, .7, 0.);
      } else if (y < .42) {
        c = shade(vW, n, v, L(vec3(.13,.12,.12)), .4, 0.);
      } else if (shut > .5) {                        // 鐵捲門與塗鴉
        float rib = .55 + .45*smoothstep(-.6, .6, sin(y*42.));
        vec3 alb = L(vec3(.32,.34,.33)) * rib;
        float g = fbm(vec2(u*.9, y*1.4) + hs*20.);
        vec3 gc = .5 + .5*cos(6.28*(hs + vec3(0., .33, .67)) + g*3.);
        alb = mix(alb, L(gc) * .7, smoothstep(.55, .6, g) * step(y, 2.6));
        c = shade(vW, n, v, alb, .5, .3);
      } else {
        vec3 dim = vec3(uw*.91, 3., 5.2);
        vec3 o = vec3((ux - .045) / .91 * dim.x, y - .42, 0.);
        vec3 inside = st == 6 ? room(o, vd, dim, hs, vec3(1.1,.6,.28)*1.4, 0.) : shopRoom(o, vd, dim, hs);
        float door = step(.7, ux) * step(ux, .86);
        float frame = max(step(abs(ux - .7), .008), step(abs(ux - .86), .008)) * step(y, 2.6) + step(abs(y - 2.6), .03) * door;
        frame += step(abs(y - 2.95), .025);
        float F = .06 + .94*pow(1. - max(dot(n, v), 0.), 5.);
        c = inside * .62 * (1. - F*.6) + envMap(reflect(-v, n)) * F * .8;
        c += shade(vW, n, v, vec3(0.), .05, 0.) * .5;
        c = mix(c, shade(vW, n, v, L(vec3(.12)), .4, .6), clamp(frame, 0., 1.));
      }
    } else if (st == 5) {                            // 夜店外牆：黑磚
      c = shade(vW, n, v, wall * .7, .6, 0.);
    } else {                                         // 住宅入口
      float d = abs(u - fw*.5);
      if (d < .75 && y < 2.7) {
        vec3 dim = vec3(1.5, 2.7, 4.);
        vec3 inside = room(vec3(u - fw*.5 + .75, y, 0.), vd, dim, seed, vec3(1.,.8,.55), 0.);
        float fr = step(.7, d) + step(2.62, y);
        c = mix(inside * .9, shade(vW, n, v, L(vec3(.1,.08,.06)), .5, 0.), clamp(fr, 0., 1.));
      } else c = shade(vW, n, v, st == 3 ? L(vec3(.3,.31,.33)) : wall * .9, rough, 0.);
    }
    gl_FragColor = vec4(applyFog(c, vW), 1.); return;
  }
  // 樓層
  if (inWin) {
    vec2 wc = vec2(ci, fi);
    float hs = h21(wc + seed*vec2(1.37, 2.71));
    float hs2 = h21(wc*1.7 + seed);
    float litP = uLit * (st == 3 ? (step(.55, h21(vec2(fi, seed))) * .9 + .25) : st == 5 ? .2 : 1.);
    bool lit = hs < litP;
    vec3 lc = hs2 < .55 ? vec3(1.,.66,.36) : hs2 < .8 ? vec3(.8,.86,1.) : hs2 < .92 ? vec3(1.,.4,.65) : vec3(.4,.6,1.);
    if (st == 5) lc = vec3(.9,.2,.6) * (.6 + .4*sin(uBeat*6.283));
    if (hs2 >= .92) lc *= .6 + .4*fract(sin(floor(uTime*5. + hs*20.))*91.);
    lc *= lit ? 1.5 : .025;
    vec3 dim = vec3(ws, fh, st == 3 ? 6. : 3.4);
    vec3 o = vec3(f.x*ws, f.y*fh, 0.);
    vec3 inside = room(o, vd, dim, hs, lc, st == 3 ? 1. : 0.);
    vec2 wf = (f - wmin) / (wmax - wmin);
    float cur = fract(hs*41.);
    if (lit && cur < .3) {                              // 窗簾
      float cov = step(wf.x, .28 + .1*sin(hs*9.)) + step(.72, wf.x);
      inside = mix(inside, lc * L(vec3(.6,.45,.35)) * (.6 + .2*sin(wf.x*60.)), clamp(cov, 0., 1.));
    } else if (lit && cur < .5) {                       // 百葉窗
      inside = mix(inside, lc * .5 * (.5 + .5*step(.35, fract(wf.y*14.))), .8);
    }
    float F = .05 + .95*pow(1. - max(dot(n, v), 0.), 5.);
    c = inside * (1. - F*.5) + envMap(reflect(-v, n)) * (F*.7 + .04);
    c += shade(vW, n, v, vec3(0.), .04, 0.) * .6;
    if (st == 3) { float mul = step(f.x, .035) + step(.965, f.x) + step(f.y, .07); c = mix(c, shade(vW, n, v, L(vec3(.2,.22,.25)), .4, .7), clamp(mul, 0., 1.)); }
    else {                                               // 窗框分隔
      float bar = step(abs(wf.y - .52), .018) + step(abs(wf.x - .5), .012);
      c = mix(c, shade(vW, n, v, L(vec3(.85,.82,.75))*.4, .6, 0.), clamp(bar, 0., 1.));
    }
  } else {
    vec3 alb = wall; float rr = rough;
    if (grid && st != 3) {
      float sill = step(abs(f.y - wmin.y + .03), .03) * step(wmin.x - .04, f.x) * step(f.x, wmax.x + .04);
      float lintel = step(abs(f.y - wmax.y - .035), .035) * step(wmin.x - .02, f.x) * step(f.x, wmax.x + .02);
      float frame = step(wmin.x - .025, f.x) * step(f.x, wmax.x + .025) * step(wmin.y - .02, f.y) * step(f.y, wmax.y + .02);
      alb = mix(alb, L(vec3(.15,.12,.1)), frame);
      alb = mix(alb, L(vec3(.62,.58,.5)) * (.8 + .2*grime), max(sill, lintel) * (st == 2 ? .5 : 1.));
      float streak = smoothstep(.0, .5, wmin.y - f.y) * step(wmin.x, f.x) * step(f.x, wmax.x) * fbm(vec2(u*8., y*.5));
      alb *= 1. - streak * .4;
    }
    if (st == 3) {                                        // 玻璃帷幕的樓板帶
      alb = L(vec3(.18,.2,.23));
      if (y > H - 1.6) { c = vec3(.2,.9,1.) * 1.6 * step(.5, fract(seed*3.)) + vec3(1.,.35,.6) * 1.6 * step(fract(seed*3.), .5); gl_FragColor = vec4(applyFog(c, vW), 1.); return; }
    }
    c = shade(vW, n, v, alb, rr, 0.);
    if (st == 4) {                                        // 翻新的霓虹樓：樓板 LED 線
      float band = step(abs(f.y - .02), .018) * step(0., fi) * step(fi, nF);
      vec3 bc = mix(vec3(.15,1.,.9), vec3(1.,.2,.6), step(.5, fract(seed*11.)));
      c += bc * band * 2.4 * (.7 + .3*sin(uTime*2. + u*.6));
    }
  }
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const MAT_FACADE = new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: FACADE_VS, fragmentShader: FACADE_FS });

// 每個街區一個網格，方便視錐剔除
const chunkBuf = new Map();
const buf = key => { if (!chunkBuf.has(key)) chunkBuf.set(key, { p: [], n: [], uv: [], b: [], b2: [], idx: [] }); return chunkBuf.get(key); };
function quad(B, a, b, c, d, nrm, u0, u1, attrB, attrB2) {
  const base = B.p.length / 3;
  for (const [p, u] of [[a, u0], [b, u1], [c, u1], [d, u0]]) {
    B.p.push(p[0], p[1], p[2]); B.n.push(nrm[0], nrm[1], nrm[2]); B.uv.push(u, p[1]);
    B.b.push(...attrB); B.b2.push(...attrB2);
  }
  B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
// 盒子：四面＋頂，面朝外；u 從面向觀看者的左邊算起
function boxFaces(B, x0, x1, z0, z1, y0, y1, seed, style, shopFaces, h, masks, roof = true) {
  const faces = [
    { n: [0, 0, 1], a: [x0, y0, z1], b: [x1, y0, z1], w: x1 - x0, key: 'pz' },
    { n: [0, 0, -1], a: [x1, y0, z0], b: [x0, y0, z0], w: x1 - x0, key: 'nz' },
    { n: [1, 0, 0], a: [x1, y0, z1], b: [x1, y0, z0], w: z1 - z0, key: 'px' },
    { n: [-1, 0, 0], a: [x0, y0, z0], b: [x0, y0, z1], w: z1 - z0, key: 'nx' },
  ];
  for (const f of faces) {
    const shop = shopFaces && shopFaces[f.key] ? 1 : 0;
    const m = masks && masks[f.key] || [0, 1];
    quad(B, f.a, f.b, [f.b[0], y1, f.b[2]], [f.a[0], y1, f.a[2]], f.n, 0, f.w, [seed, style, f.w, shop], [m[0], m[1], h, 0]);
  }
  if (roof) quad(B, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 0, x1 - x0, [seed, style, x1 - x0, 0], [0, 1, h, 0]);
}
const shopSigns = [];      // 之後由招牌模組使用：{x,z,nx,nz,w,unit}
const winSpots = [];       // 窗型冷氣、逃生梯
for (const L of lots) {
  const key = L.b && !L.b.outer ? `${L.b.i},${L.b.j}` : `o${Math.floor((L.x0 + 400) / 120)},${Math.floor((L.z0 + 400) / 120)}`;
  const B = buf(key);
  const shopF = {};
  const masks = {};
  // 面向街道的那一面有店面；排尾的地塊在大道那側也有
  if (!L.back) {
    const fkey = L.axis === 'z' ? (L.face > 0 ? 'pz' : 'nz') : (L.face > 0 ? 'px' : 'nx');
    shopF[fkey] = true;
    if (L.axis === 'z' && L.b && !L.b.outer) {
      if (Math.abs(L.x0 - (L.b.x0 + SW)) < .01) shopF.nx = true;
      if (Math.abs(L.x1 - (L.b.x1 - SW)) < .01) shopF.px = true;
    }
    for (const k in shopF) {
      const fw = k === 'pz' || k === 'nz' ? L.x1 - L.x0 : L.z1 - L.z0;
      const units = Math.max(1, Math.round(fw / 6.5));
      let mask = 0;
      for (let u = 0; u < units; u++) if ((rnd() < .28 && !L.special) || L.special === 'garage' || L.special === 'home') mask |= 1 << u;
      masks[k] = [mask, units];
      const nrm = { pz: [0, 1], nz: [0, -1], px: [1, 0], nx: [-1, 0] }[k];
      for (let u = 0; u < units; u++) {
        const uw = fw / units, along = (u + .5) * uw;
        // 沿著「面向觀看者的左邊」算 u；和 boxFaces 的方向一致
        let x, z;
        if (k === 'pz') { x = L.x0 + along; z = L.z1; }
        else if (k === 'nz') { x = L.x1 - along; z = L.z0; }
        else if (k === 'px') { x = L.x1; z = L.z1 - along; }
        else { x = L.x0; z = L.z0 + along; }
        shopUnits.push({ x, z, nx: nrm[0], nz: nrm[1], w: uw, shut: (mask >> u) & 1, lot: L, special: L.special });
      }
    }
  }
  boxFaces(B, L.x0, L.x1, L.z0, L.z1, 0, L.h, L.seed, L.style, shopF, L.h, masks);
  // 簷口與女兒牆（磚樓、石樓）
  if (L.style !== 3) {
    const o = .35, y = L.h;
    boxFaces(B, L.x0 - o, L.x1 + o, L.z0 - o, L.z1 + o, y - .55, y + .06, L.seed, 7, null, L.h, null);
    boxFaces(B, L.x0 - .18, L.x1 + .18, L.z0 - .18, L.z1 + .18, 4.45, 4.75, L.seed, 7, null, L.h, null);
  } else if (rnd() < .5 && L.h > 50) {   // 高樓退縮頂
    const ix = (L.x1 - L.x0) * .18, iz = (L.z1 - L.z0) * .18, h2 = L.h + 8 + rnd() * 20;
    boxFaces(B, L.x0 + ix, L.x1 - ix, L.z0 + iz, L.z1 - iz, L.h, h2, L.seed + 1, 3, null, h2, null);
    L.h2 = h2;
  }
  if (L.style <= 2 && !L.back) winSpots.push(L);
}
const cityChunks = [];
for (const [key, B] of chunkBuf) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('aB', new T.Float32BufferAttribute(B.b, 4));
  g.setAttribute('aB2', new T.Float32BufferAttribute(B.b2, 4));
  g.setIndex(B.idx);
  g.computeBoundingSphere();
  const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false;
  scene.add(m); cityChunks.push(m);
}

// 遠方天際線：一圈更高的塔樓
{
  const B = buf('sky'); const r2 = rng(77);
  for (let k = 0; k < 70; k++) {
    const a = k / 70 * Math.PI * 2 + r2() * .05, rr = 330 + r2() * 260;
    const cx = Math.cos(a) * rr * 1.1, cz = Math.sin(a) * rr;
    const w = 20 + r2() * 30, d = 20 + r2() * 30, h = 70 + r2() * 200;
    boxFaces(B, cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, 0, h, r2() * 1000, r2() < .75 ? 3 : 2, null, h, null);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(B.p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(B.n, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(B.uv, 2));
  g.setAttribute('aB', new T.Float32BufferAttribute(B.b, 4));
  g.setAttribute('aB2', new T.Float32BufferAttribute(B.b2, 4));
  g.setIndex(B.idx); g.computeBoundingSphere();
  const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false; scene.add(m);
}

// ─── 路面：一張大平面，標線、人孔、積水、雨滴漣漪與倒影都在 shader 裡 ───
const reflU = { tRefl: { value: null }, uReflMat: { value: new T.Matrix4() }, uReflOn: { value: 0 } };
const GROUND_VS = /* glsl */`
uniform mat4 uReflMat;
varying vec3 vW, vN; varying vec4 vRP;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vRP = uReflMat * w;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GROUND_COMMON = /* glsl */`
${GL_LIB}
uniform sampler2D tRefl; uniform float uReflOn;
varying vec3 vW, vN; varying vec4 vRP;
vec2 ripple(vec2 p, float t){
  vec2 acc = vec2(0);
  for (int k=0; k<2; k++){
    vec2 q = p * 1.7 + float(k)*vec2(.37, .71);
    vec2 ci = floor(q), cf = fract(q) - .5;
    float hs = h21(ci + float(k)*13.);
    vec2 off = (vec2(h21(ci + 3.1), h21(ci + 7.7)) - .5) * .5;
    float tt = fract(t*1.2 + hs);
    vec2 d = cf - off; float r = length(d);
    float ring = exp(-pow((r - tt*.42)*28., 2.)) * (1. - tt) * step(hs, .35 + uRain*.65);
    acc += d / max(r, 1e-3) * ring;
  }
  return acc;
}
vec3 reflSample(vec2 ruv, float blur){
  vec3 c = texture2D(tRefl, ruv).rgb * .3;
  c += texture2D(tRefl, ruv + vec2(blur*.15, blur)).rgb * .2;
  c += texture2D(tRefl, ruv - vec2(blur*.15, blur)).rgb * .2;
  c += texture2D(tRefl, ruv + vec2(0., blur*2.2)).rgb * .15;
  c += texture2D(tRefl, ruv - vec2(0., blur*2.2)).rgb * .15;
  return c;
}
vec3 wetSurface(vec3 base, vec3 n, float wet, float pud, float paint){
  vec3 v = normalize(uCam - vW);
  float rough = mix(.75, .08, max(pud, wet*.6));
  vec3 c = shade(vW, n, v, base, rough, 0.);
  float F = .05 + .95*pow(1. - max(dot(n, v), 0.), 5.);
  float refl = mix(.3, 1., F) * mix(wet*.55, 1., pud) * (1. - paint*.4);
  vec3 rc;
  if (uReflOn > .5) {
    vec2 ruv = vRP.xy / vRP.w + n.xz * vec2(.05, .09) * (1. + 1.5*(1. - pud));
    float dist = length(vW - uCam);
    rc = reflSample(ruv, mix(.024, .003, pud) / (1. + dist*.01));
  } else rc = envMap(reflect(-v, n));
  return mix(c, rc, clamp(refl, 0., 1.) * uWet);
}
`;
const ROAD_FS = /* glsl */`
${GROUND_COMMON}
void main(){
  vec2 p = vW.xz;
  float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
  float ia = floor((p.x - X0)/P + .5); float dx = p.x - (X0 + ia*P);
  float js = floor((p.y - Z0)/Q + .5); float dz = p.y - (Z0 + js*Q);
  bool onA = abs(dx) < 8., onS = abs(dz) < 8.;
  bool inter = onA && onS;
  float n1 = fbm(p*.3), fine = h21(floor(p*37.));
  vec3 alb = vec3(.034,.036,.04) * (.7 + .6*n1) * (.88 + .24*fine);
  float patchv = step(.66, n2(p*.07 + 3.)); alb *= mix(1., .72, patchv);
  float seam = smoothstep(.04, .0, abs(fract(p.x*.031 + n2(p*.05)*.3) - .5)) * .3; alb *= 1. - seam;
  float paint = 0.; vec3 pc = vec3(.8);
  // 大道上的標線
  if (onA && !inter) {
    float ax = abs(dx);
    float yel = step(abs(ax - .2), .085) * step(.12, ax);
    if (yel > 0.) { paint = 1.; pc = vec3(.85,.6,.1); }
    paint = max(paint, step(abs(ax - 5.1), .07) * step(.42, fract(p.y*.25)));
    float cw = step(8.7, abs(dz)) * step(abs(dz), 12.2) * step(.45, fract(dx / 1.15)) * step(ax, 7.6);
    paint = max(paint, cw);
    float stop = step(12.4, abs(dz)) * step(abs(dz), 12.85) * step(.3, ax) * step(ax, 5.1) * step(0., dz*dx);
    paint = max(paint, stop);
    // 直行箭頭
    float aa = 19. - abs(dz), ll = ax - 3.;
    float arrow = step(abs(ll), .13) * step(-1.6, aa) * step(aa, .6) + step(.6, aa) * step(aa, 1.8) * step(abs(ll), (1.8 - aa) * .45);
    paint = max(paint, clamp(arrow, 0., 1.) * step(0., dz*dx));
  }
  if (onS && !inter) {
    float az = abs(dz);
    float yel = step(abs(az - .2), .085) * step(.12, az);
    if (yel > 0.) { paint = 1.; pc = vec3(.85,.6,.1); }
    paint = max(paint, step(abs(az - 5.1), .07) * step(.42, fract(p.x*.25)));
    float cw = step(8.7, abs(dx)) * step(abs(dx), 12.2) * step(.45, fract(dz / 1.15)) * step(az, 7.6);
    paint = max(paint, cw);
    float stop = step(12.4, abs(dx)) * step(abs(dx), 12.85) * step(.3, az) * step(az, 5.1) * step(0., -dz*dx);
    paint = max(paint, stop);
  }
  float wear = smoothstep(.35, .7, fbm(p*1.3 + 9.));
  alb = mix(alb, pc * .55 * (.75 + .25*fine), paint * (1. - wear*.6));
  // 人孔蓋
  float mh = 1.;
  {
    float d = onA ? length(vec2(abs(dx) - 3., mod(p.y - Z0, Q) - 31.)) : 99.;
    float d2 = onS ? length(vec2(mod(p.x - X0, P) - 36., abs(dz) - 3.)) : 99.;
    float md = min(d, d2);
    float disc = smoothstep(.45, .43, md);
    alb = mix(alb, vec3(.03,.028,.026) * (.8 + .4*step(.5, fract(md*12.))), disc);
    mh = 1. - disc * .6;
  }
  // 積水與排水溝
  float gut = onA && !inter ? smoothstep(6.6, 7.9, abs(dx)) : onS && !inter ? smoothstep(6.6, 7.9, abs(dz)) : 0.;
  float pud = smoothstep(.56, .66, fbm(p*.09 + 7.) + gut*.25 + (1. - n1)*.05);
  pud = max(pud, gut * .6);
  vec3 n = vec3(0., 1., 0.);
  float h0 = n2(p*4.), hx = n2(p*4. + vec2(.05, 0.)), hz = n2(p*4. + vec2(0., .05));
  n.xz -= vec2(hx - h0, hz - h0) * 1.6 * (1. - pud);
  float dist = length(vW - uCam);
  if (dist < 40.) n.xz += ripple(p, uTime) * .5 * (.3 + .7*pud) * (1. - dist/40.);
  n = normalize(n);
  vec3 c = wetSurface(alb * mh, n, .8, pud, paint);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const WALK_FS = /* glsl */`
${GROUND_COMMON}
void main(){
  vec3 n = normalize(vN);
  vec2 p = vW.xz;
  vec3 c;
  if (n.y < .5) {                                         // 路緣石側面
    vec3 alb = vec3(.16,.155,.15) * (.8 + .3*n2(p*3. + vW.y));
    c = shade(vW, n, normalize(uCam - vW), alb, .5, 0.);
  } else {
    vec2 tile = p / 1.5; vec2 tf = fract(tile); vec2 ti = floor(tile);
    float joint = smoothstep(.0, .025, tf.x) * smoothstep(1., .975, tf.x) * smoothstep(.0, .025, tf.y) * smoothstep(1., .975, tf.y);
    vec3 alb = vec3(.14,.135,.13) * (.8 + .35*h21(ti)) * (.85 + .3*fbm(p*.8)) * mix(.55, 1., joint);
    // 路緣石帶
    float X0=uCity.x, Z0=uCity.y, P=uCity.z, Q=uCity.w;
    float ia = floor((p.x - X0)/P + .5); float dx = abs(p.x - (X0 + ia*P));
    float js = floor((p.y - Z0)/Q + .5); float dz = abs(p.y - (Z0 + js*Q));
    float curb = max(step(dx, 8.35) * step(8., dx), step(dz, 8.35) * step(8., dz));
    alb = mix(alb, vec3(.2,.19,.18) * (.8 + .3*n2(p*6.)), curb);
    float stain = smoothstep(.5, .8, fbm(p*.25 + 3.));
    alb *= 1. - stain * .35;
    float pud = smoothstep(.62, .7, fbm(p*.2 + 11.) + (1. - joint)*.08) * (1. - curb);
    vec3 nn = vec3(0, 1, 0);
    float dist = length(vW - uCam);
    if (dist < 30.) nn.xz += ripple(p, uTime + 3.) * .35 * pud * (1. - dist/30.);
    nn.xz += (vec2(h21(ti), h21(ti + 4.)) - .5) * .04;
    c = wetSurface(alb, normalize(nn), .6, pud, 0.);
  }
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
const MAT_ROAD = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: ROAD_FS });
const MAT_WALK = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), ...reflU }, vertexShader: GROUND_VS, fragmentShader: WALK_FS });
const groundGroup = new T.Group(); scene.add(groundGroup);
{
  const g = new T.PlaneGeometry(1400, 1400); g.rotateX(-Math.PI / 2);
  const road = new T.Mesh(g, MAT_ROAD); road.position.y = 0; groundGroup.add(road);
  // 人行道：每個街區一塊高 15 公分的板（建築就坐在上面）
  const parts = [];
  for (const b of blocks) {
    const bg = new T.BoxGeometry(b.x1 - b.x0, .15, b.z1 - b.z0);
    bg.translate((b.x0 + b.x1) / 2, .075, (b.z0 + b.z1) / 2);
    parts.push(bg.toNonIndexed());
  }
  const pos = [], nor = [];
  for (const g2 of parts) { pos.push(...g2.attributes.position.array); nor.push(...g2.attributes.normal.array); }
  const wg = new T.BufferGeometry();
  wg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  wg.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  wg.computeBoundingSphere();
  groundGroup.add(new T.Mesh(wg, MAT_WALK));
}
const groundH = (x, z) => {   // 人行道高 0.15
  for (const b of blocks) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return .15;
  return 0;
};
const onRoad = (x, z) => groundH(x, z) === 0;
