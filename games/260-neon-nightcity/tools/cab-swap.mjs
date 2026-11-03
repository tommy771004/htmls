// 換掉實車的車內：拿掉原模型座艙裡的三角形，換成 blender/cab_<id>.py 做的車內（blender/out/cab_<id>.glb）；
// 也做不換車內的修正（FIX：半透明拆成 MASK／不透明、換低解析貼圖、重算平滑法線）
//   node tools/cab-swap.mjs <id> [--mark] [--tint=3,7]   --mark：不拿掉，把要拿掉的三角形塗成洋紅色（先確認範圍）；--tint：把那幾個 primitive 塗成洋紅色（找零件用）
// 原本的 assets/260/<id>.glb 第一次執行時備份到 .cache/cab-src/<id>.glb，之後一律從備份重做（可以重複跑）。
// 新車內的材質照 blender/out/cab_<id>.json 的材質表轉成頂點屬性（COLOR_0 線性底色、_PBR 粗糙／金屬／清漆／車漆、_EMI 自發光＋燈種 0），
// 和 tools/cars.mjs 的慣例相同；沒貼圖的併進原本的 nc|opaque，有貼圖的每張一個 primitive（atlas 不重複、perf／carbon 重複）。
// 拿掉的範圍（CUT）：座艙箱裡、不透明、不是車漆色（紅色車身）的三角形；窗線以上的車頂內襯與後艙壁留著。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { dequantize, prune, dedup, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

// 每台車要拿掉的座艙範圍（車身座標）：|x| < x、y0 < y < y1、z0 < z < z1，而且 y > hy 的部分只到 z < hz（擋風玻璃下緣前面是引擎蓋與通風口）；
// keep(r, g, b)：sRGB 0–1 的底色，回傳 true 的不拿（車身漆色）；paint：_PBR.w 有車漆旗標的不拿；bright：有貼圖的照貼圖亮度保留；ex：[[x0, x1, y0, y1, z0, z1]…] 保留的小箱（|x|）
const CUT = {
  viper: { x: .80, y0: .16, y1: .97, z0: -.9, z1: .66, hy: .62, hz: .47, ex: [[.68, .9, .16, .75, .36, .7]], keep: (r, g, b) => r > .3 && r > g * 2 },
  r8: { x: .84, y0: .17, y1: 1.08, z0: -.74, z1: 1.0, hy: .9, hz: .5, ex: [[.55, .9, .1, .7, .7, 1.1], [.72, .9, .8, 1.1, .3, 1.0]], keep: (r, g, b) => r > .45 && r > b * 2 },
  svj: { bright: .6, ex: [[.62, .9, .2, .55, -.65, -.3], [.62, .9, .55, .8, -.65, -.4], [.6, .9, .8, 1.1, .45, 1.0]], x: .88, y0: .24, y1: 1.06, z0: -.6, z1: 1.0, hy: .95, hz: .5, keep: () => false },
  sf90: { x: 0, y0: 0, y1: 0, z0: 0, z1: 0, hy: 0, hz: 0, keep: () => false },   // 只加儀表，不切原車內
  f40: { paint: true, ex: [[.62, .9, .1, .6, .85, 1.0], [.62, .9, .68, 1.0, -.5, .94]], x: .80, y0: .17, y1: 1.0, z0: -.5, z1: .94, hy: .9, hz: .55, keep: () => false },
};

// 不換車內的修正（box 是 [|x| 上限, y0, y1, z0, z1]；prim 是原檔備份 body 的 primitive 序號）：
// lining：{ prim, col, push } 這個半透明 primitive 裡、前後 3 cm 內貼著不透明面背面的三角形是車殼內襯：拆成不透明的 col 色，往離開外殼的方向推 push 公尺、正面翻向座艙；貼在不透明面正面（車外那側）的拿掉。
//         原檔內襯和外殼同深度：畫陰影時 FrontSide 材質改畫背面，內襯的背面朝外，在外殼上投出三角形斑塊；從車裡看內襯又是半透明的
// alpha：box 裡半透明 primitive 的三角形，有效 alpha（材質 × 頂點 × 貼圖 UV 裡 7 點）全是 0 或 1、又不是貼在不透明面上的貼花，拆到 MASK（原檔把不透明零件標成 BLEND，疊在一起很亂）
// retex：[{ prim, tex, col, r, m, rep }] 換掉低解析／斑駁的貼圖（blender/out/cab_tex/<tex>.png，照原 UV 的密度換算成一格 rep 公尺），頂點色換成 col
const FIX = {
  lc200: { lining: { prim: 1, col: '#2b2b2b', push: .01 } },
  ramtrx: { alpha: { box: [.9, .6, 2.0, -1.2, 1.5] } },
  m3c: {
    alpha: { box: [.85, .2, 1.3, -1.2, 1.2] },
    retex: [
      { prim: 20, tex: 'felt', col: '#2a2a2a', r: .95, m: 0, rep: .12 },        // 地墊：原本是花紋鋼板
      { prim: 21, tex: 'leather', col: '#3a3a3a', r: .6, m: 0, rep: .08 },     // 儀表板下半、門板下緣、中控台
      { prim: 24, tex: 'leather', col: '#8a8a8a', r: .55, m: 0, rep: .08 },    // 座椅
      { prim: 0, tex: 'carbon', col: '#b4b4b8', r: .25, m: .3, rep: .05 },     // 引擎蓋、車頂的碳纖（原本鍛造碳 512 貼圖拉滿整片、金屬 .89 一片雜訊）
    ],
  },
  gt3rs: {
    retex: [
      { prim: 18, tex: 'alcantara', col: '#6e6e6e', r: .9, m: 0, rep: .04 },   // 座椅、儀表板、方向盤、柱子的麂皮
      { prim: 2, tex: 'alcantara', col: '#767676', r: .9, m: 0, rep: .04 },    // 門板（原本金屬 .75）
    ],
  },
};

const args = process.argv.slice(2), id = args.find((a) => !a.startsWith('--')), mark = args.includes('--mark');
const tint = (args.find((a) => a.startsWith('--tint=')) || '').slice(7).split(',').filter(Boolean).map(Number);
const C = CUT[id], X = FIX[id];
if (!C && !X) throw new Error('CUT／FIX 都沒有 ' + id);
const dst = resolve(repo, `assets/260/${id}.glb`), bak = resolve(root, `.cache/cab-src/${id}.glb`);
// 換過的檔案在 asset.extras.cab 留記號：沒有備份時不能拿它當原檔（會把新車內也切掉）
if (!existsSync(bak)) {
  const cur = await io.read(dst);
  if (cur.getRoot().getAsset().extras?.cab || cur.getRoot().getAsset().extras?.fix) throw new Error(`${dst} 已經換過車內，又找不到原檔備份 ${bak}：先從 git 取回換之前的版本放到那裡`);
  mkdirSync(dirname(bak), { recursive: true }); copyFileSync(dst, bak); console.log('備份原檔 →', bak);
}
const PAL = mark || !C ? {} : JSON.parse(readFileSync(resolve(root, `blender/out/cab_${id}.json`), 'utf8')).pal;
const s2l = (c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const l2s = (c) => c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055;
const lin = (h) => [1, 3, 5].map((i) => s2l(parseInt(h.slice(i, i + 2), 16) / 255));

const doc = await io.read(bak);
await doc.transform(dequantize());
const R = doc.getRoot(), buf = R.listBuffers()[0];
const body = R.listNodes().find((n) => n.getName() === 'body');
const M = body.getWorldMatrix();
const xf = (m, t) => [m[0] * t[0] + m[4] * t[1] + m[8] * t[2] + m[12], m[1] * t[0] + m[5] * t[1] + m[9] * t[2] + m[13], m[2] * t[0] + m[6] * t[1] + m[10] * t[2] + m[14]];
const xn = (m, t) => { const v = [m[0] * t[0] + m[4] * t[1] + m[8] * t[2], m[1] * t[0] + m[5] * t[1] + m[9] * t[2], m[2] * t[0] + m[6] * t[1] + m[10] * t[2]], l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const acc = (arr, type) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);

// ─── 1. body 的頂點換成車身座標（節點歸零），拿掉座艙裡的三角形 ───
let cut = 0, opaque = null;
const prims0 = body.getMesh().listPrimitives();
for (const p of prims0) {
  const pa = p.getAttribute('POSITION'), na = p.getAttribute('NORMAL'), N = pa.getCount(), P = new Float32Array(N * 3), Nn = new Float32Array(N * 3), t = [0, 0, 0];
  for (let i = 0; i < N; i++) { pa.getElement(i, t); P.set(xf(M, t), i * 3); na.getElement(i, t); Nn.set(xn(M, t), i * 3); }
  p.setAttribute('POSITION', acc(P, 'VEC3')).setAttribute('NORMAL', acc(Nn, 'VEC3'));
  const blend = p.getMaterial().getAlphaMode() === 'BLEND';
  if (!blend && !p.getMaterial().getBaseColorTexture()) opaque = p;
  if (blend || !C) continue;
  // bright：有貼圖的三角形照 UV 中心取樣貼圖，亮度超過門檻的是車殼（svj 的內外共用一張圖）
  let img = null, uvA = null;
  if (C.bright && p.getMaterial().getBaseColorTexture()) {
    const { data, info } = await sharp(Buffer.from(p.getMaterial().getBaseColorTexture().getImage())).raw().toBuffer({ resolveWithObject: true });
    img = { data, w: info.width, h: info.height, ch: info.channels }; uvA = p.getAttribute('TEXCOORD_0');
  }
  const luma = (k) => {
    const u = [0, 0]; let su = 0, sv = 0;
    for (let j = 0; j < 3; j++) { uvA.getElement(idx[k + j], u); su += u[0] / 3; sv += u[1] / 3; }
    const fx = ((su % 1) + 1) % 1, fy = ((sv % 1) + 1) % 1, o = (Math.min(img.h - 1, fy * img.h | 0) * img.w + Math.min(img.w - 1, fx * img.w | 0)) * img.ch;
    return (.2126 * img.data[o] + .7152 * img.data[o + 1] + .0722 * img.data[o + 2]) / 255;
  };
  const col = p.getAttribute('COLOR_0'), pbr = p.getAttribute('_PBR'), idx = p.getIndices().getArray(), keep = [], c = [0, 0, 0, 0], q = [0, 0, 0, 0];
  for (let k = 0; k < idx.length; k += 3) {
    let x = 0, y = 0, z = 0;
    for (let j = 0; j < 3; j++) { x += P[idx[k + j] * 3]; y += P[idx[k + j] * 3 + 1]; z += P[idx[k + j] * 3 + 2]; }
    x = Math.abs(x / 3); y /= 3; z /= 3;
    col.getElement(idx[k], c);
    if (img && luma(k) > C.bright) {   // 亮的而且朝外（側面朝外或朝上）才是車殼，朝座艙裡的亮色碎片照樣拿掉
      const A = idx[k] * 3, B = idx[k + 1] * 3, D = idx[k + 2] * 3;
      const ux = P[B] - P[A], uy = P[B + 1] - P[A + 1], uz = P[B + 2] - P[A + 2], vx = P[D] - P[A], vy = P[D + 1] - P[A + 1], vz = P[D + 2] - P[A + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const sx = Math.sign(P[A] + P[B] + P[D]) || 1, na = [Nn[A] + Nn[B] + Nn[D], Nn[A + 1] + Nn[B + 1] + Nn[D + 1]];
      if (na[0] * nx + na[1] * ny < 0) { nx = -nx; ny = -ny; }   // 用頂點法線決定面朝哪邊
      if (nx * sx > .2 || ny > .6) { keep.push(idx[k], idx[k + 1], idx[k + 2]); continue; }
    }
    if (C.paint && pbr) { pbr.getElement(idx[k], q); if (q[3] > .5) { keep.push(idx[k], idx[k + 1], idx[k + 2]); continue; } }   // 車漆旗標（_PBR.w）的不拿
    const inside = x < C.x && y > C.y0 && y < C.y1 && z > C.z0 && z < C.z1 && !(y > C.hy && z > C.hz) && !(C.ex || []).some((e) => x > e[0] && x < e[1] && y > e[2] && y < e[3] && z > e[4] && z < e[5]) && !C.keep(l2s(c[0]), l2s(c[1]), l2s(c[2]));
    if (inside) { cut++; if (mark) for (let j = 0; j < 3; j++) col.setElement(idx[k + j], [1, 0, 1, 1]); else continue; }
    keep.push(idx[k], idx[k + 1], idx[k + 2]);
  }
  if (!mark) p.setIndices(acc(Uint32Array.from(keep), 'SCALAR'));
}
body.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
if (C) console.log(`${id}：座艙裡 ${cut} 個三角形${mark ? '塗成洋紅色' : '拿掉'}`);

// ─── 1b. 不換車內的修正 ───
const inBox = (b, P, idx, k) => {
  if (!b) return true;
  let x = 0, y = 0, z = 0;
  for (let j = 0; j < 3; j++) { x += P[idx[k + j] * 3]; y += P[idx[k + j] * 3 + 1]; z += P[idx[k + j] * 3 + 2]; }
  x = Math.abs(x / 3); y /= 3; z /= 3;
  return x < b[0] && y > b[1] && y < b[2] && z > b[3] && z < b[4];
};
const texImg = async (t) => { const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
// 三角形 UV 裡 7 點（三角、三邊中點、中心）的貼圖 alpha
const BARY = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1 / 3, 1 / 3, 1 / 3]];
const sampleA = (img, uvA, idx, k) => {
  const U = [0, 1, 2].map((j) => uvA.getElement(idx[k + j], [0, 0]));
  return BARY.map((b) => {
    const su = b[0] * U[0][0] + b[1] * U[1][0] + b[2] * U[2][0], sv = b[0] * U[0][1] + b[1] * U[1][1] + b[2] * U[2][1];
    const fx = ((su % 1) + 1) % 1, fy = ((sv % 1) + 1) % 1;
    return img.data[(Math.min(img.h - 1, fy * img.h | 0) * img.w + Math.min(img.w - 1, fx * img.w | 0)) * 4 + 3] / 255;
  });
};
// 原檔不透明面的射線查詢（lining 與 alpha 共用，第一次用到才建）
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const tri = (P, idx, k) => [0, 1, 2].map((j) => [P[idx[k + j] * 3], P[idx[k + j] * 3 + 1], P[idx[k + j] * 3 + 2]]);
// 三角形中心與朝背面的單位方向（面的朝向照頂點法線）
const face = (P, idx, N, k) => {
  const t = tri(P, idx, k), c = [0, 1, 2].map((q) => (t[0][q] + t[1][q] + t[2][q]) / 3);
  const n = crs(sub(t[1], t[0]), sub(t[2], t[0])), L = Math.hypot(...n) || 1;
  const s = [0, 1, 2].reduce((a, j) => a + dot(n, [N[idx[k + j] * 3], N[idx[k + j] * 3 + 1], N[idx[k + j] * 3 + 2]]), 0);
  return { t, c, back: n.map((x) => x / L * (s < 0 ? 1 : -1)) };
};
let OPQ = null;
const opaqueRay = () => {
  if (OPQ) return OPQ;
  const G = .05, M = .03, T = [], g = new Map();
  for (const p of prims0) {
    if (p.getMaterial().getAlphaMode() !== 'OPAQUE') continue;
    const P = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray(), N = p.getAttribute('NORMAL').getArray();
    for (let k = 0; k < idx.length; k += 3) {
      const { t, back } = face(P, idx, N, k); t.n = back.map((x) => -x); T.push(t);   // t.n：朝外的面法線
      const lo = [0, 1, 2].map((q) => Math.floor((Math.min(t[0][q], t[1][q], t[2][q]) - M) / G)), hi = [0, 1, 2].map((q) => Math.floor((Math.max(t[0][q], t[1][q], t[2][q]) + M) / G));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const kk = x + ',' + y + ',' + z; let l = g.get(kk); if (!l) g.set(kk, l = []); l.push(T.length - 1); }
    }
  }
  // 從 o 沿 d 在 R（≤ 3 cm）內打到不透明面：1＝打到那面的背面那側（o 在它後面）、-1＝在它正面那側、0＝沒打到
  return OPQ = (o, d, R) => { let r = 0, best = R; for (const ti of g.get(o.map((x) => Math.floor(x / G)).join(',')) || []) {   // Möller–Trumbore
    const t = T[ti], e1 = sub(t[1], t[0]), e2 = sub(t[2], t[0]), pv = crs(d, e2), det = dot(e1, pv);
    if (Math.abs(det) < 1e-12) continue;
    const tv = sub(o, t[0]), u = dot(tv, pv) / det; if (u < -.01 || u > 1.01) continue;
    const qv = crs(tv, e1), v = dot(d, qv) / det; if (v < -.01 || u + v > 1.01) continue;
    const s = dot(e2, qv) / det; if (s > -.001 && s < best) { best = s; r = dot(t.n, d) > 0 ? 1 : -1; }
  } return r; };
};
if (X?.lining) {
  // 從三角形中心沿法線兩個方向打射線，3 cm 內打到不透明面就是內襯（少數面的法線是反的）；車窗前後都沒有東西
  const ray = opaqueRay(), behind = (o, d) => ray(o, d, .03);
  const { prim, col, push } = X.lining, o = prims0[prim], oP = o.getAttribute('POSITION').getArray(), oi = o.getIndices().getArray(), oN = o.getAttribute('NORMAL').getArray();
  let out = 0; const stay = [], lin_ = [], away = new Float32Array(oN.length);   // away：離開外殼的方向（每個頂點累加）
  for (let k = 0; k < oi.length; k += 3) {
    const { t, c, back: n } = face(oP, oi, oN, k);
    const hb = behind(c, n), hf = hb ? 0 : behind(c, n.map((x) => -x)), h = hb || hf;
    if (!h) { stay.push(oi[k], oi[k + 1], oi[k + 2]); continue; }
    if (h < 0) { out++; continue; }   // 貼在車漆外側的多一層：拿掉（原檔就是它在外殼上蓋出斑塊）
    const a = hb ? n.map((x) => -x) : n, gn = crs(sub(t[1], t[0]), sub(t[2], t[0]));
    lin_.push(...(dot(gn, a) < 0 ? [oi[k], oi[k + 2], oi[k + 1]] : [oi[k], oi[k + 1], oi[k + 2]]));   // 正面朝座艙
    for (let j = 0; j < 3; j++) for (let q = 0; q < 3; q++) away[oi[k + j] * 3 + q] += a[q];
  }
  o.setIndices(acc(Uint32Array.from(stay), 'SCALAR'));
  const P2 = oP.slice(), N2 = oN.slice(), ca = o.getAttribute('COLOR_0').getArray().slice(), cl = lin(col);
  for (let i = 0; i < P2.length / 3; i++) {
    const a = [away[i * 3], away[i * 3 + 1], away[i * 3 + 2]], L = Math.hypot(...a);
    if (L > 0) { for (let q = 0; q < 3; q++) P2[i * 3 + q] += a[q] / L * push; if (dot(a, [oN[i * 3], oN[i * 3 + 1], oN[i * 3 + 2]]) < 0) N2.set(a.map((x) => x / L), i * 3); }
    ca.set([...cl, 1], i * 4);
  }
  const mm = o.getMaterial().clone().setName('nc|opaque').setAlphaMode('OPAQUE'); mm.setBaseColorFactor([1, 1, 1, 1]);
  body.getMesh().addPrimitive(o.clone().setIndices(acc(Uint32Array.from(lin_), 'SCALAR')).setAttribute('POSITION', acc(P2, 'VEC3')).setAttribute('NORMAL', acc(N2, 'VEC3')).setAttribute('COLOR_0', acc(ca, 'VEC4')).setMaterial(mm));
  console.log(`${id}：半透明 primitive ${prim} 裡 ${lin_.length / 3} 面是車殼內襯 → 不透明 ${col}，${out} 面貼在車漆外側拿掉，剩 ${stay.length / 3} 面半透明`);
}
if (X?.alpha) {
  const { box } = X.alpha, ray = opaqueRay();
  let nm = 0;
  for (const p of prims0) {
    const m = p.getMaterial();
    if (m.getAlphaMode() !== 'BLEND') continue;
    const P = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray(), N = p.getAttribute('NORMAL').getArray(), col = p.getAttribute('COLOR_0'), fa = m.getBaseColorFactor()[3];
    const t = m.getBaseColorTexture(), uvA = p.getAttribute('TEXCOORD_0'), img = t && uvA ? await texImg(t) : null, c = [0, 0, 0, 0];
    const stay = [], mask = [];
    for (let k = 0; k < idx.length; k += 3) {
      const tr = [idx[k], idx[k + 1], idx[k + 2]];
      if (!inBox(box, P, idx, k)) { stay.push(...tr); continue; }
      col.getElement(idx[k], c);
      const as = (img ? sampleA(img, uvA, idx, k) : [1]).map((t) => t * fa * c[3]);
      if (!as.every((a) => a >= .97 || a <= .03)) { stay.push(...tr); continue; }   // 有一點是半透明就留在 BLEND
      const { c: o, back } = face(P, idx, N, k);
      if (ray(o, back, .003) || ray(o, back.map((x) => -x), .003)) { stay.push(...tr); continue; }   // 貼花：疊在不透明面上 3 mm 內，要在不透明之後畫才蓋得住
      mask.push(...tr);
    }
    if (!mask.length) continue;
    body.getMesh().addPrimitive(p.clone().setIndices(acc(Uint32Array.from(mask), 'SCALAR')).setMaterial(m.clone().setName('nc|mask').setAlphaMode('MASK').setAlphaCutoff(.5)));
    nm += mask.length / 3;
    if (stay.length) p.setIndices(acc(Uint32Array.from(stay), 'SCALAR')); else body.getMesh().removePrimitive(p);   // 空的 primitive 過不了 meshopt
  }
  console.log(`${id}：半透明裡只有全透／不透的 ${nm} 面拆成 MASK`);
}
for (const f of X?.retex || []) {
  const p = prims0[f.prim], m = p.getMaterial(), uvA = p.getAttribute('TEXCOORD_0');
  if (!uvA) throw new Error(`retex ${f.prim} 沒有 UV`);
  const P = p.getAttribute('POSITION').getArray(), idx = p.getIndices().getArray(), U = uvA.getArray();
  let wa = 0, ua = 0;   // 原 UV 一個單位是幾公尺：sqrt(面積和 / UV 面積和)
  for (let k = 0; k < idx.length; k += 3) {
    const [a, b, c] = [idx[k], idx[k + 1], idx[k + 2]];
    const e1 = [0, 1, 2].map((q) => P[b * 3 + q] - P[a * 3 + q]), e2 = [0, 1, 2].map((q) => P[c * 3 + q] - P[a * 3 + q]);
    wa += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
    ua += Math.abs((U[b * 2] - U[a * 2]) * (U[c * 2 + 1] - U[a * 2 + 1]) - (U[c * 2] - U[a * 2]) * (U[b * 2 + 1] - U[a * 2 + 1])) / 2;
  }
  const k = Math.sqrt(wa / (ua || 1)) / f.rep;
  p.setAttribute('TEXCOORD_0', acc(U.map((v) => v * k), 'VEC2'));
  const webp = await sharp(readFileSync(resolve(root, `blender/out/cab_tex/${f.tex}.png`))).webp({ quality: 88 }).toBuffer();
  const tex = doc.createTexture('fix_' + f.tex).setImage(webp).setMimeType('image/webp');
  const mm = m.clone().setBaseColorTexture(tex); mm.getBaseColorTextureInfo().setWrapS(10497).setWrapT(10497);
  p.setMaterial(mm);
  const N = p.getAttribute('POSITION').getCount(), cl = lin(f.col), ca = new Float32Array(N * 4), pb = p.getAttribute('_PBR').getArray().slice();
  const c0 = p.getAttribute('COLOR_0').getArray();
  for (let i = 0; i < N; i++) { ca.set(cl, i * 4); ca[i * 4 + 3] = c0[i * 4 + 3]; if (f.r != null) pb[i * 4] = f.r; if (f.m != null) pb[i * 4 + 1] = f.m; }
  p.setAttribute('COLOR_0', acc(ca, 'VEC4')).setAttribute('_PBR', acc(pb, p.getAttribute('_PBR').getType()));
  console.log(`${id}：primitive ${f.prim} 換成 ${f.tex}（原 UV 一單位 ${(k * f.rep).toFixed(2)} m）`);
}
for (const i of tint) { const p = prims0[i], c = p.getAttribute('COLOR_0'), a = c.getArray().slice(); for (let k = 0; k < a.length; k += 4) a.set([1, 0, 1], k); p.setAttribute('COLOR_0', acc(a, 'VEC4')); }

// ─── 2. 新車內：每個網格依材質轉成頂點屬性，依貼圖分組 ───
if (C && !mark) {
  const cab = await io.read(resolve(root, `blender/out/cab_${id}.glb`));
  const G = new Map();   // 貼圖名（'' 是沒貼圖）→ { pos, nor, uv, col, pbr, emi, idx }
  let tris = 0;
  for (const node of cab.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const W = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const name = (p.getMaterial()?.getName() || '').replace(/^cab_/, ''), q = PAL[name];
      if (!q) throw new Error('材質表沒有 ' + name);
      const key = q.tex || '';
      let g = G.get(key); if (!g) G.set(key, g = { pos: [], nor: [], uv: [], col: [], pbr: [], emi: [], idx: [], n: 0 });
      const pa = p.getAttribute('POSITION'), na = p.getAttribute('NORMAL'), ua = p.getAttribute('TEXCOORD_0'), N = pa.getCount(), t = [0, 0, 0], u = [0, 0];
      if (key.startsWith('atlas') && !ua) throw new Error(name + ' 用 atlas 但沒有 UV');
      const c = lin(q.col), e = q.emi || 0;
      for (let i = 0; i < N; i++) {
        pa.getElement(i, t); const w = xf(W, t); g.pos.push(...w);
        na.getElement(i, t); const nn = xn(W, t); g.nor.push(...nn);
        if (key && ua) { ua.getElement(i, u); g.uv.push(u[0], u[1]); }
        else if (key) {   // 重複貼圖沒有 UV：照法線最大的軸平面投影，一格 rep 公尺
          const r = q.rep || .05, ax = Math.abs(nn[0]) > Math.abs(nn[1]) && Math.abs(nn[0]) > Math.abs(nn[2]) ? 0 : Math.abs(nn[1]) > Math.abs(nn[2]) ? 1 : 2;
          const [a, b] = ax === 0 ? [w[2], w[1]] : ax === 1 ? [w[0], w[2]] : [w[0], w[1]];
          g.uv.push(a / r, b / r);
        }
        g.col.push(c[0], c[1], c[2], 1);
        g.pbr.push(q.r ?? .5, q.m || 0, 0, 0);
        g.emi.push(e * (q.tex ? 1 : c[0]), e * (q.tex ? 1 : c[1]), e * (q.tex ? 1 : c[2]), 0);
      }
      const ix = p.getIndices().getArray();
      for (const k of ix) g.idx.push(g.n + k);
      g.n += N; tris += ix.length / 3;
    }
  }
  // 沒貼圖的併進原本的 nc|opaque
  const flat = G.get('');
  if (flat && opaque) {
    const cat = (a, s, add, T) => { const o = a.getArray(), r = new T(o.length + add.length); r.set(o); r.set(add, o.length); return r; };
    const base = opaque.getAttribute('POSITION').getCount();
    const sem = { POSITION: flat.pos, NORMAL: flat.nor, COLOR_0: flat.col, _PBR: flat.pbr, _EMI: flat.emi };
    for (const [k, add] of Object.entries(sem)) { const a = opaque.getAttribute(k); opaque.setAttribute(k, acc(cat(a, 0, add, Float32Array), a.getType())); }
    for (const k of opaque.listSemantics()) if (!(k in sem)) throw new Error('nc|opaque 還有 ' + k);
    const ix = opaque.getIndices().getArray(), ni = new Uint32Array(ix.length + flat.idx.length);
    ni.set(ix); for (let i = 0; i < flat.idx.length; i++) ni[ix.length + i] = flat.idx[i] + base;
    opaque.setIndices(acc(ni, 'SCALAR'));
    G.delete('');
  }
  for (const [key, g] of G) {
    const m = doc.createMaterial('nc|opaque').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1);
    if (key) {   // key '' 是車身沒有可併的 nc|opaque（svj 整台都有貼圖）時另開的無貼圖 primitive
      const png = readFileSync(resolve(root, `blender/out/cab_tex/${key}.png`));
      const webp = await sharp(png).webp({ quality: 88 }).toBuffer();
      const tex = doc.createTexture('cab_' + key).setImage(webp).setMimeType('image/webp');
      const rep = !key.startsWith('atlas'), wrap = rep ? 10497 : 33071;
      m.setBaseColorTexture(tex).getBaseColorTextureInfo().setWrapS(wrap).setWrapT(wrap);
      if (g.emi.some((v) => v > 0)) m.setEmissiveTexture(tex).setEmissiveFactor([1, 1, 1]);
    }
    const prim = doc.createPrimitive().setMaterial(m)
      .setAttribute('POSITION', acc(Float32Array.from(g.pos), 'VEC3')).setAttribute('NORMAL', acc(Float32Array.from(g.nor), 'VEC3'))
      .setAttribute('COLOR_0', acc(Float32Array.from(g.col), 'VEC4')).setAttribute('_PBR', acc(Float32Array.from(g.pbr), 'VEC4')).setAttribute('_EMI', acc(Float32Array.from(g.emi), 'VEC4'))
      .setIndices(acc(Uint32Array.from(g.idx), 'SCALAR'));
    if (key) prim.setAttribute('TEXCOORD_0', acc(Float32Array.from(g.uv), 'VEC2'));
    body.getMesh().addPrimitive(prim);
  }
  console.log(`${id}：新車內 ${tris} 面（貼圖 ${[...G.keys()].join('、') || '無'}）`);
}

if (!mark && !tint.length) R.getAsset().extras = { ...(R.getAsset().extras || {}), ...(C ? { cab: `blender/cab_${id}.py` } : {}), ...(X ? { fix: 1 } : {}) };
await doc.transform(prune({ keepSolidTextures: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
let trisOut = 0; for (const m of R.listMeshes()) for (const p of m.listPrimitives()) trisOut += p.getIndices().getCount() / 3;
const draws = R.listMeshes().reduce((a, m) => a + m.listPrimitives().length, 0), kb = Math.round(statSync(dst).size / 1024);
console.log(`寫好 ${dst}：${trisOut} 面、${draws} 個 primitive、${kb} KB`);
if (!mark && !tint.length) {
  const jp = resolve(repo, 'assets/260/cars.json'), J = JSON.parse(readFileSync(jp, 'utf8'));
  Object.assign(J[id], { tris: trisOut, kb, draws });
  writeFileSync(jp, JSON.stringify(J, null, 1) + '\n');
}
