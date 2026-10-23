// 車流車型：把 cars.mjs 處理過的車（車長、車頭 +z、接地、輪子節點、材質頂點屬性都整理好了）烘成給 InstancedMesh 用的幾何
// → blender/out/traffic.glb（打包時內嵌成 #glb-traffic）。
//   node tools/traffic.mjs            （全部）
//   node tools/traffic.mjs police     （只重烘其中幾台，其他沿用舊檔）
// 每台車：貼圖在頂點上取樣成頂點色（sRGB → 線性）、依 _PBR／_EMI／輪子節點分成 uber 材質編號（_MAT），
// 分材質減面到 tris 左右，輸出 POSITION、NORMAL、COLOR_0、_MAT，最後量化＋meshopt 壓縮。
// 車流裡車身同時有幾十台，所以壓在幾千面；輪子不轉（車流本來就沒有輪子動畫）。
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, Document } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { quantize, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

// src：cars.mjs 的輸出（車行的車在 assets/260/，車流專用的在 .cache/traffic/，要先 TRAFFIC=1 node tools/cars.mjs）；
// pal：車漆交給遊戲的調色盤（車漆材質寫成 _MAT 0）；彩繪車（計程車、警車）與沒有車漆材質的保留原色
export const TRAFFIC = [
  { id: 'e34', src: 'e34', pal: true, tris: 4000 },
  { id: 'evo190', src: 'evo190', pal: true, tris: 4000 },
  // DanielZhabotinsky 的虛構廠牌車（原檔約兩萬面）
  { id: 'fh_taxi', pal: false, tris: 4000 },
  { id: 'fh_cop', pal: false, tris: 4000 },
  { id: 'il_cop', pal: false, tris: 4000 },
  { id: 'negotiator', pal: true, tris: 3600 },
  { id: 'milano', pal: true, tris: 3600 },
  { id: 'kiri', pal: true, tris: 3600 },
  { id: 'carter', pal: true, tris: 3600 },
  { id: 'compact', pal: true, tris: 3200 },
  { id: 'urban', pal: true, tris: 3600 },
  { id: 'tiara', pal: true, tris: 3600 },
  { id: 'shvan', pal: true, tris: 3600 },
  { id: 'lct', pal: true, tris: 4000 },
  { id: 'conquer', pal: true, tris: 3600 },
  { id: 'fvan', pal: false, tris: 3200 },
  // 第二階段：執法、救護、計程車與房車（同一位作者）
  { id: 'urban_cop', pal: false, tris: 4000 },
  { id: 'md84', pal: false, tris: 4400 },
  { id: 'ambulance', pal: false, tris: 4000 },
  { id: 'canyon_taxi', pal: false, tris: 4000 },
  { id: 'fh', pal: true, tris: 3600 },
  { id: 'il', pal: true, tris: 3600 },
  // 直接讀原檔（raw，.cache/raw/）：不是車，不走 cars.mjs。scale 縮放、rot 繞 y 轉（度，轉完車頭朝 +z）、nodes 只取哪些節點；
  // 同一個原檔的各部件共用同一個原點（整檔或 center 指定節點的底面中心），part: true 的部件再把自己的中心移到原點（轉軸），偏移記在 extras.piv
  { id: 'heli', raw: 'as350_b2', scale: 99, rot: 180, nodes: /^(cabine|patins|tuyere|moyeu)/, pal: false, tris: 3600 },
  { id: 'heli_rotor', raw: 'as350_b2', scale: 99, rot: 180, nodes: /^rotor_pales/, part: true, pivot: [0, 2.988, 1.95], pal: false, tris: 300, noFar: true },
  { id: 'heli_tail', raw: 'as350_b2', scale: 99, rot: 180, nodes: /^rotor_anticouple/, part: true, pal: false, tris: 120, noFar: true },
  // 坦克：原點在車體（Hull）的中心；砲塔轉軸量自砲塔寬的部分（不含砲管）的中心
  { id: 'tank', raw: 'low_poly_abrams_free_model', scale: 1, rot: -90, center: /^Abrams_Hull_/, nodes: /^(?!Abrams_Tower)/, pal: false, tris: 3600 },
  { id: 'tank_turret', raw: 'low_poly_abrams_free_model', scale: 1, rot: -90, center: /^Abrams_Hull_/, nodes: /^Abrams_Tower/, part: true, pivot: [0, 1.53, -.69], pal: false, tris: 1600 },
  { id: 'barricade', raw: 'barricade_set_low_poly_game_ready', scale: 1, rot: 0, nodes: /^(Barricade3L|Light[789]_)/, part: true, pal: false, tris: 500, noFar: true },
  { id: 'cone', raw: 'barricade_set_low_poly_game_ready', scale: 1, rot: 0, nodes: /^ConeTraffic/, part: true, pal: false, tris: 120, noFar: true },
  { id: 'spike', raw: 'spike_strip', scale: 1, rot: 90, part: true, pal: false, tris: 500, noFar: true },
  // 武裝直升機（69-gunship.js）：PolyDucky 的 AH-64 低面數模型，原檔機頭已朝 +z；原點以機身（Object_4）置中，主旋翼與尾旋翼各自拆出來轉。
  // flat：原檔是低面數＋色塊迷彩，焊接時連顏色一起比，色塊才不會在相鄰面之間糊開（面數本來就在 tris 內，不必減面）
  { id: 'gunship', raw: 'ah-64_apache_attack_helicopter_low_poly', scale: 4.8, rot: 0, center: /^Object_4$/, nodes: /^Object_(?!(8|10|11|37|39)$)/, pal: false, tris: 4000, noFar: true, flat: true },
  { id: 'gunship_rotor', raw: 'ah-64_apache_attack_helicopter_low_poly', scale: 4.8, rot: 0, center: /^Object_4$/, nodes: /^Object_(8|10|11)$/, part: true, pal: false, tris: 400, noFar: true, flat: true },
  { id: 'gunship_tail', raw: 'ah-64_apache_attack_helicopter_low_poly', scale: 4.8, rot: 0, center: /^Object_4$/, nodes: /^Object_(37|39)$/, part: true, pal: false, tris: 300, noFar: true, flat: true },
  // world_1 gameready_city 路上的三台車：tools/props.mjs 的 w1_grc 已經切出來、擺正、接地（rawFile 直接讀那個輸出；節點名就是物件 id）。
  // 轎車與白色廂型貨車原檔車頭朝 +x，郵務車朝 +z；車身顏色在貼圖上，不給調色盤
  { id: 'grc_sedan', rawFile: '../../assets/260/props/w1_grc.glb', scale: 1, rot: -90, center: /^sedan$/, nodes: /^sedan$/, pal: false, tris: 2400 },
  { id: 'grc_stepvan', rawFile: '../../assets/260/props/w1_grc.glb', scale: 1, rot: -90, center: /^stepvan$/, nodes: /^stepvan$/, pal: false, tris: 2400 },
  { id: 'grc_mailvan', rawFile: '../../assets/260/props/w1_grc.glb', scale: 1, rot: 0, center: /^mailvan$/, nodes: /^mailvan$/, pal: false, tris: 2400 },
];
const srcOf = (cfg) => {
  const a = resolve(root, '../../assets/260', (cfg.src || cfg.id) + '.glb');
  return existsSync(a) ? a : resolve(root, '.cache/traffic', (cfg.src || cfg.id) + '.glb');
};
const out = resolve(root, 'blender/out/traffic.glb');
const only = process.argv.slice(2);

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const toLin = (c) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const texCache = new Map();
async function texPixels(tex) {
  if (texCache.has(tex)) return texCache.get(tex);
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = { data, w: info.width, h: info.height };
  texCache.set(tex, t);
  return t;
}
function sample(t, u, v) {
  const x = Math.min(t.w - 1, Math.max(0, Math.floor(((u % 1) + 1) % 1 * t.w)));
  const y = Math.min(t.h - 1, Math.max(0, Math.floor(((v % 1) + 1) % 1 * t.h)));
  const i = (y * t.w + x) * 4;
  return [toLin(t.data[i] / 255), toLin(t.data[i + 1] / 255), toLin(t.data[i + 2] / 255)];
}
// 4x4 矩陣（column-major）
const mulP = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const mulN = (m, x, y, z) => { const a = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]; const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

// uber 材質編號：0 車漆 1 玻璃 2 塑膠 3 鍍鉻 4 頭燈 5 尾燈 6 輪胎 7 輪圈 10 光滑 11 柔和自發光
function matOf(col, pbr, emi, wheel, pal) {
  const lum = .2126 * col[0] + .7152 * col[1] + .0722 * col[2];
  if (emi[3] === 1) return 4;
  if (emi[3] === 2) return 5;
  if (emi[0] + emi[1] + emi[2] > .05) return 11;
  if (col[3] < .99) return 1;
  if (wheel) return lum < .04 && pbr[1] < .5 ? 6 : 7;
  if (pbr[3] > .5 && pal) return 0;
  if (pbr[1] > .5 && pbr[0] < .35 && lum > .3) return 3;   // 暗色的金屬漆當成光滑漆面，不然整台像鍍鉻
  return pbr[0] < .4 || pbr[2] > .3 ? 10 : 2;
}

// 每台車分成幾個單元（車身、各個輪子）各自減面：輪框細節多、平面少，按比例分的話面數全被輪框吃掉。
// 每台烘兩級：近景 tris（40 m 內）與遠景 FAR_TRIS（節點名加 _far）
const WHEEL_TRIS = 140, FAR_TRIS = 600, FAR_WHEEL = 24;
async function bake(cfg, tris = cfg.tris, wheelTris = WHEEL_TRIS, id = cfg.id) {
  const doc = await io.read(cfg.rawFile ? resolve(root, cfg.rawFile) : cfg.raw ? resolve(root, '.cache/raw', cfg.raw + '.glb') : srcOf(cfg));
  // raw：縮放＋繞 y 轉，原點移到整檔（不只選到的節點）的底面中心
  let xf = (p) => p, xfN = (n) => n;
  if (cfg.raw || cfg.rawFile) {
    const a = -cfg.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = cfg.scale;
    const rot = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const wm = node.getWorldMatrix(), xz = !cfg.center || cfg.center.test(node.getName());   // 高度一律看整檔
      for (const prim of mesh.listPrimitives()) {
        const P = prim.getAttribute('POSITION'), e = [];
        for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); const q = rot(mulP(wm, e[0], e[1], e[2]).map((v) => v * k)); for (let j = 0; j < 3; j++) { if (j !== 1 && !xz) continue; lo[j] = Math.min(lo[j], q[j]); hi[j] = Math.max(hi[j], q[j]); } }
      }
    }
    const o = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
    xf = (p) => { const q = rot(p.map((v) => v * k)); return [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; };
    xfN = rot;
  }
  const units = new Map();   // 節點名 → { wheel, pos[], nor[], col[], mat[], idx[] }
  let total = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (cfg.nodes && !cfg.nodes.test(node.getName())) continue;
    const wm = node.getWorldMatrix(), wheel = !cfg.raw && !cfg.rawFile && /^wheel_/.test(node.getName()), un = cfg.raw || cfg.rawFile ? 'body' : node.getName();   // raw 的零件全部合成一個單元一起減面
    let u = units.get(un);
    if (!u) units.set(un, (u = { wheel, pos: [], nor: [], col: [], mat: [], idx: [] }));
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0');
      const PB = prim.getAttribute('_PBR'), E = prim.getAttribute('_EMI'), UV = prim.getAttribute('TEXCOORD_0');
      const mat = prim.getMaterial(), tex = mat?.getBaseColorTexture(), bcf = cfg.raw && mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
      const rawPbr = (cfg.raw || cfg.rawFile) && mat ? [mat.getRoughnessFactor(), mat.getMetallicFactor(), 0, 0] : null;
      const px = tex && UV ? await texPixels(tex) : null;
      const n = P.getCount(), base = u.pos.length / 3;
      const a = [], b = [], c = [], d = [], e = [], uv = [];
      for (let i = 0; i < n; i++) {
        P.getElement(i, a); N.getElement(i, b); C ? C.getElement(i, c) : c.splice(0, 4, 1, 1, 1, 1);
        PB ? PB.getElement(i, d) : d.splice(0, 4, ...(rawPbr || [.6, 0, 0, 0])); E ? E.getElement(i, e) : e.splice(0, 4, 0, 0, 0, 0);
        let rgb = [c[0] * bcf[0], c[1] * bcf[1], c[2] * bcf[2]];
        if (px) { UV.getElement(i, uv); const s = sample(px, uv[0], uv[1]); rgb = [rgb[0] * s[0], rgb[1] * s[1], rgb[2] * s[2]]; }
        const m = matOf([...rgb, c[3]], d, e, wheel, cfg.pal);
        // 燈：頂點色換成燈光的顏色（亮度交給 shader）；柔和自發光（燈條、儀表）壓暗，免得泛光整台爆白
        if (m === 4 || m === 11) { const l = Math.max(e[0], e[1], e[2]); if (l > .05) rgb = [e[0] / l, e[1] / l, e[2] / l]; if (m === 11) rgb = rgb.map((v) => v * .45); }
        u.mat.push(m);
        u.pos.push(...xf(mulP(wm, a[0], a[1], a[2]))); u.nor.push(...xfN(mulN(wm, b[0], b[1], b[2]))); u.col.push(...rgb);
      }
      const I = prim.getIndices();
      if (I) for (const v of I.getArray()) u.idx.push(base + v);
      else for (let i = 0; i < n; i++) u.idx.push(base + i);
      total += (I ? I.getCount() : n) / 3;
    }
  }
  const nWheel = [...units.values()].filter((u) => u.wheel).length;
  const bodyTris = Math.max(300, tris - nWheel * wheelTris);
  const P = [], N = [], C = [], M = [], IDX = [];
  for (const u of units.values()) {
    // 依「位置（1 mm）＋材質」焊接：原檔的硬邊把面板拆成互不相連的小片，不焊接的話減面只能退回 sloppy，整台會被撕碎
    const wid = new Map(), wsrc = [], wpos = [], ix = new Uint32Array(u.idx.length);
    u.idx.forEach((v, i) => {
      const key = `${Math.round(u.pos[v * 3] * 1000)},${Math.round(u.pos[v * 3 + 1] * 1000)},${Math.round(u.pos[v * 3 + 2] * 1000)},${u.mat[v]}` + (cfg.flat ? `,${u.col.slice(v * 3, v * 3 + 3).map((c) => Math.round(c * 255)).join(',')}` : '');
      let w = wid.get(key);
      if (w == null) { w = wsrc.length; wid.set(key, w); wsrc.push(v); wpos.push(u.pos[v * 3], u.pos[v * 3 + 1], u.pos[v * 3 + 2]); }
      ix[i] = w;
    });
    const pos = new Float32Array(wpos), target = (u.wheel ? wheelTris : bodyTris) * 3;
    let out = ix;
    if (ix.length > target) {
      // Prune：整塊小零件（螺絲、徽章）在誤差內可以直接拿掉
      [out] = MeshoptSimplifier.simplify(ix, pos, 3, target, u.wheel ? .1 : .025, ['Prune']);
      if (out.length > target * 1.5) [out] = MeshoptSimplifier.simplifySloppy(out, pos, 3, null, target, u.wheel ? 1 : .03);
    }
    // 法線：相鄰面夾角 40° 內平滑，其餘保留硬邊
    const fn = [], adj = new Map();
    for (let t = 0; t < out.length; t += 3) {
      const [i0, i1, i2] = [out[t] * 3, out[t + 1] * 3, out[t + 2] * 3];
      const e1 = [pos[i1] - pos[i0], pos[i1 + 1] - pos[i0 + 1], pos[i1 + 2] - pos[i0 + 2]], e2 = [pos[i2] - pos[i0], pos[i2 + 1] - pos[i0 + 1], pos[i2 + 2] - pos[i0 + 2]];
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...f) || 1;
      fn.push(f.map((x) => x / l));
      for (let k = 0; k < 3; k++) { const w = out[t + k]; if (!adj.has(w)) adj.set(w, []); adj.get(w).push(t / 3); }
    }
    const vmap = new Map();
    for (let t = 0; t < out.length; t += 3) {
      const f = fn[t / 3];
      for (let k = 0; k < 3; k++) {
        const w = out[t + k], src = wsrc[w];
        const n = [0, 0, 0];
        for (const g of adj.get(w)) { const h = fn[g]; if (h[0] * f[0] + h[1] * f[1] + h[2] * f[2] > .766) { n[0] += h[0]; n[1] += h[1]; n[2] += h[2]; } }
        const l = Math.hypot(...n) || 1;
        const key = `${w}|${Math.round(n[0] / l * 20)},${Math.round(n[1] / l * 20)},${Math.round(n[2] / l * 20)}`;
        let o = vmap.get(key);
        if (o == null) {
          o = P.length / 3; vmap.set(key, o);
          P.push(pos[w * 3], pos[w * 3 + 1], pos[w * 3 + 2]); N.push(n[0] / l, n[1] / l, n[2] / l);
          C.push(u.col[src * 3], u.col[src * 3 + 1], u.col[src * 3 + 2]); M.push(u.mat[src]);
        }
        IDX.push(o);
      }
    }
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = 0;
  for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  // 部件：轉軸移到原點（pivot 給的是轉軸在整檔座標裡的 x、y、z，沒給就用部件自己的中心），原本的位置記在 piv
  let piv = null;
  if (cfg.part) {
    piv = cfg.pivot || [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    for (let i = 0; i < P.length; i += 3) { P[i] -= piv[0]; P[i + 1] -= piv[1]; P[i + 2] -= piv[2]; }
    piv = piv.map((v) => +v.toFixed(3));
  }
  console.log(`${id}: ${total} → ${IDX.length / 3} 面（輪子 ${nWheel} 個），${P.length / 3} 頂點，${(x1 - x0).toFixed(2)}×${y1.toFixed(2)}×${(z1 - z0).toFixed(2)} m`);
  return { id, P, N, C, M, IDX, len: +(z1 - z0).toFixed(2), w: +(x1 - x0).toFixed(2), h: +(y1 - y0).toFixed(2), piv };
}

// 只重烘部分車型時，其他車型從舊的 traffic.glb 讀回來
const keep = new Map();
if (only.length && existsSync(out)) {
  const old = await io.read(out);
  for (const node of old.getRoot().listNodes()) if (!only.includes(node.getName().replace(/_far$/, ''))) keep.set(node.getName(), node);
}
const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene();
const acc = (arr, type, Ctor) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buf);
for (const [cfg, id, tris, wt] of TRAFFIC.flatMap((c) => [[c, c.id, c.tris, WHEEL_TRIS], ...(c.noFar ? [] : [[c, c.id + '_far', FAR_TRIS, FAR_WHEEL]])])) {
  let r;
  if (keep.has(id)) {
    const n = keep.get(id), p = n.getMesh().listPrimitives()[0], ex = n.getExtras();
    const get = (a) => { const o = []; const e = []; for (let i = 0; i < a.getCount(); i++) o.push(...a.getElement(i, e)); return o; };
    const wm = n.getWorldMatrix(), raw = get(p.getAttribute('POSITION')), P = [];
    for (let i = 0; i < raw.length; i += 3) P.push(...mulP(wm, raw[i], raw[i + 1], raw[i + 2]));
    r = { id, P, N: get(p.getAttribute('NORMAL')), C: get(p.getAttribute('COLOR_0')), M: get(p.getAttribute('_MAT')), IDX: Array.from(p.getIndices().getArray()), len: ex.len, w: ex.w, h: ex.h, piv: ex.piv };
  } else r = await bake(cfg, tris, wt, id);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(r.P, 'VEC3', Float32Array)).setAttribute('NORMAL', acc(r.N, 'VEC3', Float32Array))
    .setAttribute('COLOR_0', acc(r.C, 'VEC3', Float32Array)).setAttribute('_MAT', acc(r.M, 'SCALAR', Float32Array))
    .setIndices(acc(r.IDX, 'SCALAR', Uint32Array));
  const node = doc.createNode(r.id).setMesh(doc.createMesh(r.id).addPrimitive(prim)).setExtras({ len: r.len, w: r.w, h: r.h, pal: cfg.pal, ...(r.piv ? { piv: r.piv } : {}) });
  scene.addChild(node);
}
await doc.transform(quantize({ pattern: /^(POSITION|NORMAL|COLOR_0)$/ }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(out, doc);
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
