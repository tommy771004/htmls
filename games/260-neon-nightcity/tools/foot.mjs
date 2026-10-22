// 灰鷗島兩個基地的碰撞佔地：量 assets/260/props/isle_*.glb，寫回 props.json 該物件的 foot（[x0, x1, z0, z1, 高]…，模型座標，公尺）
//   node tools/foot.mjs [組名…]（預設 isle_ruin、isle_office）
// 每個三角形以不超過 0.2 m 的間距取樣，落在人身高度帶（離地 0.35–2.0 m）的樣本把那一格（0.5 m）標成擋住；
// 散落的單格雜點（垃圾、細桿）去掉，再把擋住的格子貪婪合併成矩形。高是那個矩形裡最高的頂點（給以檔案開啟時的方塊替身與日照高度圖）。
// gltf-transform 與 meshoptimizer 借 197 的 node_modules（和 tools/seats.mjs 一樣）。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { MeshoptDecoder } = await imp('meshoptimizer');
await MeshoptDecoder.ready;

const OUT = resolve(root, '../../assets/260/props');
const manifestPath = resolve(OUT, 'props.json');
// 不算碰撞的材質：廢墟街上空的電線（扁平的帶子，會被當成屋頂）
const SKIP = { isle_ruin: /^material$/ };
const RES = .5, Y0 = .35, Y1 = 2, ROOF = 2.6;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const sets = process.argv.slice(2).length ? process.argv.slice(2) : ['isle_ruin', 'isle_office'];
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

for (const set of sets) {
  const doc = await io.read(resolve(OUT, set + '.glb'));
  for (const node of doc.getRoot().listNodes()) {
    const id = node.getName(), it = manifest[set]?.items[id], mesh = node.getMesh();
    if (!it || !mesh) continue;
    const M = node.getWorldMatrix(), tri = [];
    for (const prim of mesh.listPrimitives()) {
      if (SKIP[set] && SKIP[set].test(prim.getMaterial()?.getName() || '')) continue;
      const P = prim.getAttribute('POSITION'), I = prim.getIndices(), n = I ? I.getCount() : P.getCount(), a = [0, 0, 0];
      const at = (i) => { P.getElement(I ? I.getScalar(i) : i, a); const [x, y, z] = a; return [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]]; };
      for (let i = 0; i < n; i += 3) tri.push([at(i), at(i + 1), at(i + 2)]);
    }
    const W = Math.ceil(it.w / RES) + 4, H = Math.ceil(it.d / RES) + 4, ox = -it.w / 2 - RES * 2, oz = -it.d / 2 - RES * 2;
    const occ = new Uint8Array(W * H), cover = new Uint8Array(W * H), top = new Float32Array(W * H);
    const cell = (x, z) => { const i = Math.floor((x - ox) / RES), j = Math.floor((z - oz) / RES); return i >= 0 && j >= 0 && i < W && j < H ? j * W + i : -1; };
    for (const [A, B, C] of tri) {
      const ymax = Math.max(A[1], B[1], C[1]);
      if (ymax < Y0) continue;
      const L = Math.max(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), Math.hypot(C[0] - A[0], C[1] - A[1], C[2] - A[2]), Math.hypot(C[0] - B[0], C[1] - B[1], C[2] - B[2]));
      const s = Math.max(1, Math.ceil(L / .2));
      // 屋頂只算接近水平的面（|法線 y| > 0.7）：電線、斜靠的樑、招牌不算
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], flat = Math.abs(ny) > .7 * Math.hypot(nx, ny, nz);
      for (let u = 0; u <= s; u++) for (let v = 0; u + v <= s; v++) {
        const a = u / s, b = v / s, c = 1 - a - b, y = A[1] * c + B[1] * a + C[1] * b;
        if (y < Y0) continue;
        const k = cell(A[0] * c + B[0] * a + C[0] * b, A[2] * c + B[2] * a + C[2] * b);
        if (k < 0) continue;
        top[k] = Math.max(top[k], ymax);
        if (y <= Y1) occ[k] = 1; else if (y > ROOF && flat) cover[k] = 1;
      }
    }
    // 單格雜點：上下左右都沒有擋住的格子去掉
    const keep = occ.slice();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (!occ[k]) continue;
      if (!(i > 0 && occ[k - 1]) && !(i < W - 1 && occ[k + 1]) && !(j > 0 && occ[k - W]) && !(j < H - 1 && occ[k + W])) keep[k] = 0;
    }
    // 樓裡面：模型只有外殼，門窗的缺口會讓人走進空殼。頭上有屋頂（ROOF 以上有面）的格子算室內，也擋住；
    // 再從邊界往裡灌，灌不到的空格（被牆圍住、頭上沒東西的天井）一樣擋住
    // 屋頂先做一次斷開（侵蝕再膨脹 1 格），一兩格寬的雨遮、樑去掉
    const er = new Uint8Array(W * H), roof = new Uint8Array(W * H);
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { const k = j * W + i; er[k] = cover[k] && cover[k - 1] && cover[k + 1] && cover[k - W] && cover[k + W] ? 1 : 0; }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { const k = j * W + i; roof[k] = er[k] || er[k - 1] || er[k + 1] || er[k - W] || er[k + W] ? 1 : 0; }
    let filled = 0;
    for (let k = 0; k < W * H; k++) if (roof[k] && !keep[k]) { keep[k] = 1; filled++; }
    const out = new Uint8Array(W * H), st = [];
    for (let i = 0; i < W; i++) st.push(i, (H - 1) * W + i); for (let j = 0; j < H; j++) st.push(j * W, j * W + W - 1);
    while (st.length) { const k = st.pop(); if (out[k] || keep[k]) continue; out[k] = 1; const i = k % W; if (i > 0) st.push(k - 1); if (i < W - 1) st.push(k + 1); if (k >= W) st.push(k - W); if (k + W < W * H) st.push(k + W); }
    for (let k = 0; k < W * H; k++) if (!keep[k] && !out[k]) { keep[k] = 1; filled++; }
    // 貪婪合併：每列由左往右找還沒用掉的格子，先往右延伸，再整段往下延伸
    const used = new Uint8Array(W * H), foot = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!keep[j * W + i] || used[j * W + i]) continue;
      let i1 = i; while (i1 + 1 < W && keep[j * W + i1 + 1] && !used[j * W + i1 + 1]) i1++;
      let j1 = j; for (;;) { const r = j1 + 1; if (r >= H) break; let ok = true; for (let x = i; x <= i1; x++) if (!keep[r * W + x] || used[r * W + x]) { ok = false; break; } if (!ok) break; j1 = r; }
      let h = 0; for (let z = j; z <= j1; z++) for (let x = i; x <= i1; x++) { used[z * W + x] = 1; h = Math.max(h, top[z * W + x]); }
      foot.push([ox + i * RES, ox + (i1 + 1) * RES, oz + j * RES, oz + (j1 + 1) * RES, h].map((v) => +v.toFixed(2)));
    }
    it.foot = foot;
    console.log(`${set}/${id}：${tri.length} 個三角形 → ${keep.reduce((a, v) => a + v, 0)} 格（樓內補 ${filled}）、${foot.length} 個矩形`);
  }
}
// 和 props.mjs 一樣縮排 1，只是 foot 的每個矩形寫成一行
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1).replace(/\[\n\s*(-?[\d.]+),\n\s*(-?[\d.]+),\n\s*(-?[\d.]+),\n\s*(-?[\d.]+),\n\s*(-?[\d.]+)\n\s*\]/g, '[$1, $2, $3, $4, $5]') + '\n');
