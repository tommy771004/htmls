// 行道樹（assets/260/props/nat_trees.glb 的楓樹）葉片貼圖補 alpha：原檔沒有 alpha，props.mjs 的 keyWhite 只把純白當透明，
// 但這張貼圖葉子外面是淺綠的延伸填色（烘焙時往外拉的邊），所以整張幾乎不透明、近看每一片葉卡都是方塊。
// 這裡就地改輸出檔：葉子是深綠（G < 106）或棕色的莖，先取這些當核心、去雜點，再往外長兩格到「還算深」（G < 122）的地方，
// 補洞、丟掉小於 300 px 的碎塊（延伸填色裡一條條的橫豎紋）。重跑 props.mjs 的 nat_trees 之後要再跑一次：
//   node tools/leafkey.mjs
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { MeshoptEncoder, MeshoptDecoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const FILE = resolve(root, '../../assets/260/props/nat_trees.glb'), MAT = /^sugar_maple_leaf$/;
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(FILE);

function leafMask(data, W, H) {
  const N = W * H, at = (m, x, y) => x < 0 || y < 0 || x >= W || y >= H ? 0 : m[y * W + x];
  // 方形結構元素的膨脹（er = 0）與侵蝕（er = 1）
  const morph = (m, r, er) => {
    const o = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = er;
      for (let dy = -r; dy <= r && v === er; dy++) for (let dx = -r; dx <= r; dx++) if (at(m, x + dx, y + dy) !== er) { v = 1 - er; break; }
      o[y * W + x] = v;
    }
    return o;
  };
  const core = new Uint8Array(N), dark = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2], stem = r > g * .95 && r > b * 1.5 && Math.min(r, g, b) < 200;
    core[p] = g < 106 || stem ? 1 : 0;
    dark[p] = Math.min(r, g, b) <= 200 && (g < 122 || stem) ? 1 : 0;
  }
  let m = morph(morph(core, 1, 1), 1, 0);
  for (let it = 0; it < 2; it++) { const d = morph(m, 1, 0); for (let p = 0; p < N; p++) if (d[p] && dark[p]) m[p] = 1; }
  m = morph(morph(m, 1, 0), 1, 1);
  const lab = new Uint8Array(N), keep = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    if (!m[p] || lab[p]) continue;
    const st = [p], px = []; lab[p] = 1;
    while (st.length) {
      const q = st.pop(); px.push(q);
      const x = q % W, y = q / W | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (y + dy) * W + x + dx; if (at(m, x + dx, y + dy) && !lab[k]) { lab[k] = 1; st.push(k); } }
    }
    if (px.length > 300) for (const q of px) keep[q] = 1;
  }
  return keep;
}

let n = 0;
for (const mat of doc.getRoot().listMaterials()) {
  const tex = mat.getBaseColorTexture();
  if (!MAT.test(mat.getName()) || !tex) continue;
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keep = leafMask(data, info.width, info.height);
  let on = 0;
  for (let p = 0; p < keep.length; p++) { data[p * 4 + 3] = keep[p] ? 255 : 0; on += keep[p]; }
  tex.setImage(new Uint8Array(await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 85, alphaQuality: 100 }).toBuffer())).setMimeType('image/webp');
  mat.setAlphaMode('MASK').setAlphaCutoff(.5);
  console.log(`${mat.getName()}：葉子佔 ${(on / keep.length * 100).toFixed(1)}%`);
  n++;
}
if (!n) throw new Error('找不到 sugar_maple_leaf');
await io.write(FILE, doc);
