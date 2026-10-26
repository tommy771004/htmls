// 天樞島的地標大樓：Sketchfab 的 CC BY 模型（.cache/isle/，gitignore）→ assets/260/isle/<id>.glb 與 assets/260/isle/CREDITS.md
//   node tools/isle-glb.mjs [id…]
// 每個輸出檔一個物件（場景根節點，名稱是 id，extras 有 w／d／h／s）：底面中心在原點、接地、單位公尺、長邊沿 x。
// 材質和 tools/props.mjs 的一樣改成頂點屬性（COLOR_0＝原檔的底色係數、_PBR＝[粗糙度, 金屬度, 0, 0]、_EMI＝0），
// 頁面用 26-glb.js 的 glbMaterial 畫（28-isle-lm.js 載入）。NanoRay 的兩棟只有底色係數、沒有貼圖，顏色全靠 COLOR_0；
// 照片立面（novusod 的兩棟）的底色貼圖 alpha 換成窗戶遮罩，給夜間的窗燈用。
// 縮放照地塊：島上整塊街區的地是 47 × 37 m（10-city.js 的 isleLots），模型整個縮到放得進 fit 的範圍（人行道不能被蓋到）。
import { createRequire } from 'node:module';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, Document } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTTextureWebP } = await imp('@gltf-transform/extensions');
const { prune, dedup, weld, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const SRC = resolve(root, '.cache/isle');
const OUT = resolve(root, '../../assets/260/isle');
// file：來源檔名；fit：[沿 x, 沿 z] 最大的外框（公尺）；rot：先繞 y 轉幾個 90°（長邊轉到 x）；ground：原檔的地面高度（沒寫就用最低點）；
// metalMax：金屬度上限（夜城的環境光很暗，全金屬的玻璃會黑成一片）；winAll：整張貼圖都是窗的材質（一樓的櫥窗）
const ITEMS = [
  { id: 'owtc', file: 'one_world_trade_center', fit: [44, 35.5], metalMax: .55 },
  { id: 'wtc3', file: '3_world_trade_center', fit: [44, 35.5], rot: 1, metalMax: .55 },
  { id: 'exch20', file: '20_exchange_place', fit: [45, 35.5], ground: 0 },
  { id: 'whitehall', file: 'whitehall_building', fit: [45, 35.5], ground: -.8, winAll: /^Wind$/ },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptEncoder.ready;
const mulPt = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
function normalMat(m) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1;
  return { det, n: [A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det] };
}
// 來源檔的所有三角形 primitive（世界座標），和 props.mjs 的 collect 同一套
function collect(doc) {
  const R = doc.getRoot(), scene = R.getDefaultScene() || R.listScenes()[0], prims = [];
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const wm = node.getWorldMatrix(), { det, n: nm } = normalMat(wm);
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4 || !p.getAttribute('POSITION')) continue;
      const pa = p.getAttribute('POSITION'), na = p.getAttribute('NORMAL'), ua = p.getAttribute('TEXCOORD_0'), cnt = pa.getCount(), t = [0, 0, 0];
      const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), uv = ua ? new Float32Array(cnt * 2) : null;
      for (let i = 0; i < cnt; i++) {
        pa.getElement(i, t); pos.set(mulPt(wm, t[0], t[1], t[2]), i * 3);
        if (na) { na.getElement(i, t); const x = nm[0] * t[0] + nm[3] * t[1] + nm[6] * t[2], y = nm[1] * t[0] + nm[4] * t[1] + nm[7] * t[2], z = nm[2] * t[0] + nm[5] * t[1] + nm[8] * t[2], l = Math.hypot(x, y, z) || 1; nor.set([x / l, y / l, z / l], i * 3); }
        else nor.set([0, 1, 0], i * 3);
        if (ua) { const e = [0, 0]; ua.getElement(i, e); uv.set(e, i * 2); }
      }
      const ia = p.getIndices(), idx = ia ? Uint32Array.from(ia.getArray()) : Uint32Array.from({ length: cnt }, (_, i) => i);
      if (det < 0) for (let i = 0; i < idx.length; i += 3) { const s = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = s; }
      prims.push({ mat: p.getMaterial(), pos, nor, uv, idx, cnt });
    }
  });
  return prims;
}

// 照片立面找窗戶（改自 tools/props.mjs 的 photoWindows）：比周圍 129 px 平均暗 28%，或低於整張的 Otsu 門檻（圖集的全黑空白不算），再做開運算去雜點；
// 連通區太小、太大（超過貼圖 1/12，一扇窗不會更大）、不夠方正（填滿外框不到 55%）或太細長（磚縫、簷口的陰影，長寬比超過 4）的丟掉。回傳每個像素是第幾扇窗（0＝不是窗）
function photoWindows(data, S) {
  const N = S * S, L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = (data[i * 4] * .3 + data[i * 4 + 1] * .59 + data[i * 4 + 2] * .11) / 255;
  const med = Float32Array.from(L).sort()[N >> 1];
  const hist = new Float64Array(64); let tot = 0, sum = 0;
  for (const l of L) if (l > .02) { const k = Math.min(63, Math.floor(l * 64)); hist[k]++; tot++; sum += k; }
  let wB = 0, sB = 0, best = 0, otsu = 0;
  for (let k = 0; k < 64; k++) { wB += hist[k]; if (!wB || wB === tot) continue; sB += k * hist[k]; const v = wB * (tot - wB) * (sB / wB - (sum - sB) / (tot - wB)) ** 2; if (v > best) { best = v; otsu = (k + 1) / 64; } }
  const I = new Float64Array((S + 1) * (S + 1)), R = 64;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) I[(y + 1) * (S + 1) + x + 1] = L[y * S + x] + I[y * (S + 1) + x + 1] + I[(y + 1) * (S + 1) + x] - I[y * (S + 1) + x];
  const box = (x, y) => { const x0 = Math.max(0, x - R), x1 = Math.min(S, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(S, y + R + 1); return (I[y1 * (S + 1) + x1] - I[y0 * (S + 1) + x1] - I[y1 * (S + 1) + x0] + I[y0 * (S + 1) + x0]) / ((x1 - x0) * (y1 - y0)); };
  let g = new Uint8Array(N);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const l = L[y * S + x]; g[y * S + x] = (l < box(x, y) * .72 || l < otsu * .85) && l < Math.max(.12, med * .8) ? 1 : 0; }
  const pass = (a, er, horiz) => { const o = new Uint8Array(N); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let v = er ? 1 : 0; for (let d = -1; d <= 1; d++) { const X = horiz ? x + d : x, Y = horiz ? y : y + d; const q = X < 0 || Y < 0 || X >= S || Y >= S ? 0 : a[Y * S + X]; if (er ? !q : q) { v = er ? 0 : 1; break; } } o[y * S + x] = v; } return o; };
  g = pass(pass(pass(pass(g, 1, 1), 1, 0), 0, 1), 0, 0);
  const g0 = g; g = pass(pass(g, 0, 1), 0, 0);   // 標號前先膨脹一格：上下推拉窗的兩片、被窗櫺切開的玻璃算同一扇（編號只寫回原本的窗格）
  const lab = new Int32Array(N).fill(-1), keep = new Int32Array(N);
  for (let i = 0, n = 0, k = 0; i < N; i++) {
    if (!g[i] || lab[i] >= 0) continue;
    const st = [i], px = []; lab[i] = n; let x0 = S, x1 = 0, y0 = S, y1 = 0;
    while (st.length) {
      const j = st.pop(), x = j % S, y = (j / S) | 0; px.push(j); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const k of [x > 0 ? j - 1 : -1, x < S - 1 ? j + 1 : -1, y > 0 ? j - S : -1, y < S - 1 ? j + S : -1]) if (k >= 0 && g[k] && lab[k] < 0) { lab[k] = n; st.push(k); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (px.length >= 12 && bw <= S / 12 && bh <= S / 12 && px.length / (bw * bh) > .55 && Math.max(bw, bh) < 4 * Math.min(bw, bh)) { k++; for (const j of px) if (g0[j]) keep[j] = k; }
    n++;
  }
  return keep;
}
// 貼圖的 alpha 改成窗戶編號：255＝牆，窗是 8–207（每扇窗一個值，頁面照它決定這扇窗亮不亮，一扇窗整扇一起亮）。
// 材質是 OPAQUE，頁面不拿 alpha 做透明（28-isle-lm.js 的夜間窗燈讀第 0 層 mip）。all：整張都是窗（一樓的櫥窗）
async function winAlpha(img, all) {
  const { width: w, height: h } = await sharp(Buffer.from(img)).metadata(), S = w === h ? Math.min(w, 1024) : 512;   // 原尺寸找（窗戶在 1024 的圖集上只有十幾 px）
  const sq = await sharp(Buffer.from(img)).resize(S, S, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const lab = all ? null : photoWindows(sq, S), m = Buffer.alloc(S * S);
  for (let i = 0; i < S * S; i++) m[i] = all ? 8 + (((i % S) >> 5) * 37 + ((i / S | 0) >> 5) * 11) % 200 : lab[i] ? 8 + (lab[i] * 37) % 200 : 255;
  const a = await sharp(m, { raw: { width: S, height: S, channels: 1 } }).resize(w, h, { fit: 'fill', kernel: 'nearest' }).extractChannel(0).raw().toBuffer();   // 單通道輸入縮放後會變成三通道
  const rgb = await sharp(Buffer.from(img)).removeAlpha().raw().toBuffer(), out = Buffer.alloc(w * h * 4);
  let n = 0;
  for (let i = 0; i < w * h; i++) { out[i * 4] = rgb[i * 3]; out[i * 4 + 1] = rgb[i * 3 + 1]; out[i * 4 + 2] = rgb[i * 3 + 2]; out[i * 4 + 3] = a[i]; if (a[i] < 230) n++; }
  return { raw: out, w, h, frac: n / (w * h) };
}
// 底色貼圖：最大 1024，WebP（有窗戶編號的 alpha 用無損，編號不能有失真）
async function webp(t) {
  const img = t.raw ? sharp(t.raw, { raw: { width: t.w, height: t.h, channels: 4 } }) : sharp(Buffer.from(t));
  const meta = t.raw ? { width: t.w, height: t.h } : await img.metadata(), k = Math.min(1, 1024 / Math.max(meta.width, meta.height));
  return new Uint8Array(await img.resize(Math.round(meta.width * k), Math.round(meta.height * k), { kernel: t.raw ? 'nearest' : 'lanczos3' }).webp({ quality: 80, alphaQuality: 100, nearLossless: false }).toBuffer());
}

async function build(it) {
  const doc = await io.read(resolve(SRC, it.file + '.glb'));
  const info = doc.getRoot().getAsset().extras || {};
  const prims = collect(doc);
  // 轉 rot 個 90°（繞 y：x → −z）
  for (let r = 0; r < (it.rot || 0); r++) for (const p of prims) for (let i = 0; i < p.cnt; i++) {
    const x = p.pos[i * 3], z = p.pos[i * 3 + 2], nx = p.nor[i * 3], nz = p.nor[i * 3 + 2];
    p.pos[i * 3] = z; p.pos[i * 3 + 2] = -x; p.nor[i * 3] = nz; p.nor[i * 3 + 2] = -nx;
  }
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of prims) for (let i = 0; i < p.cnt; i++) for (let k = 0; k < 3; k++) { const v = p.pos[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  const g0 = it.ground ?? mn[1], cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  const s = Math.min(it.fit[0] / (mx[0] - mn[0]), it.fit[1] / (mx[2] - mn[2]));
  for (const p of prims) for (let i = 0; i < p.cnt; i++) { p.pos[i * 3] = (p.pos[i * 3] - cx) * s; p.pos[i * 3 + 1] = (p.pos[i * 3 + 1] - g0) * s; p.pos[i * 3 + 2] = (p.pos[i * 3 + 2] - cz) * s; }
  const dims = { w: +((mx[0] - mn[0]) * s).toFixed(2), d: +((mx[2] - mn[2]) * s).toFixed(2), h: +((mx[1] - g0) * s).toFixed(2), s: +s.toFixed(4) };

  const out = new Document(); out.createBuffer();
  const acc = (arr, type, Ctor) => out.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(out.getRoot().listBuffers()[0]);
  const node = out.createNode(it.id).setExtras(dims), mesh = out.createMesh(it.id), mats = new Map();
  const groups = new Map();
  for (const p of prims) { if (!groups.has(p.mat)) groups.set(p.mat, []); groups.get(p.mat).push(p); }
  let tris = 0;
  for (const [m, ps] of groups) {
    const bc = m ? m.getBaseColorFactor() : [.6, .6, .6, 1], tex = m && m.getBaseColorTexture();
    const pbr = [m ? m.getRoughnessFactor() : .8, Math.min(m ? m.getMetallicFactor() : 0, it.metalMax ?? 1), 0, 0];
    if (!mats.has(m)) {
      const n = out.createMaterial(m ? m.getName() : 'flat').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(!!(m && m.getDoubleSided()));
      if (tex) {
        const big = Math.min(...tex.getSize()) >= 128, all = !!(it.winAll && it.winAll.test(m.getName())), wa = big || all ? await winAlpha(tex.getImage(), all) : null;
        if (wa) console.log(`  ${m.getName()}：窗戶遮罩 ${(wa.frac * 100).toFixed(1)}%`);
        n.setBaseColorTexture(out.createTexture(m.getName()).setImage(await webp(wa || tex.getImage())).setMimeType('image/webp'));
      }
      mats.set(m, n);
    }
    const P = [], N = [], U = [], C = [], B = [], E = [], I = [];
    let base = 0;
    for (const p of ps) {
      for (let i = 0; i < p.cnt; i++) {
        P.push(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]); N.push(p.nor[i * 3], p.nor[i * 3 + 1], p.nor[i * 3 + 2]);
        if (tex) U.push(p.uv ? p.uv[i * 2] : 0, p.uv ? p.uv[i * 2 + 1] : 0);
        C.push(bc[0], bc[1], bc[2], 1); B.push(...pbr); E.push(0, 0, 0, 0);
      }
      for (const v of p.idx) I.push(v + base);
      base += p.cnt; tris += p.idx.length / 3;
    }
    const prim = out.createPrimitive().setMaterial(mats.get(m))
      .setAttribute('POSITION', acc(P, 'VEC3', Float32Array)).setAttribute('NORMAL', acc(N, 'VEC3', Float32Array))
      .setAttribute('COLOR_0', acc(C, 'VEC4', Float32Array)).setAttribute('_PBR', acc(B, 'VEC4', Float32Array)).setAttribute('_EMI', acc(E, 'VEC4', Float32Array))
      .setIndices(acc(I, 'SCALAR', Uint32Array));
    if (tex) prim.setAttribute('TEXCOORD_0', acc(U, 'VEC2', Float32Array));
    mesh.addPrimitive(prim);
  }
  node.setMesh(mesh); out.createScene().addChild(node);
  if (mats.size && [...mats.values()].some(n => n.getBaseColorTexture())) out.createExtension(EXTTextureWebP).setRequired(true);
  await out.transform(dedup(), weld(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  mkdirSync(OUT, { recursive: true });
  const file = resolve(OUT, it.id + '.glb');
  await io.write(file, out);
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`${it.id}: ${dims.w}×${dims.d}×${dims.h} m（×${dims.s}）、${tris} 面、${kb} KB`);
  return { ...dims, kb, tris, title: info.title, author: info.author, license: info.license, source: info.source };
}

const only = process.argv.slice(2), built = {};
for (const it of ITEMS) if (!only.length || only.includes(it.id)) built[it.id] = await build(it);
if (!only.length) {
  const md = ['# 天樞島地標大樓（tools/isle-glb.mjs）', '', '頁面 `games/260-neon-nightcity/src/parts/28-isle-lm.js` 載入；幾何照地塊縮放、依材質合併，材質改成頂點屬性，照片立面的底色貼圖 alpha 換成夜間窗燈用的窗戶編號，WebP 與 meshopt 壓縮。外形照原作。', '',
    '| 檔案 | 作品 | 作者 | 授權 | 來源 |', '| --- | --- | --- | --- | --- |',
    ...Object.entries(built).map(([id, b]) => `| ${id}.glb | ${b.title} | ${(b.author || '').replace(/ \(.*\)$/, '')} | CC BY 4.0 | ${b.source} |`), ''];
  writeFileSync(resolve(OUT, 'CREDITS.md'), md.join('\n'));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(built).map(([id, b]) => [id, { w: b.w, d: b.d, h: b.h, kb: b.kb }]))));
}
