// 車窗射擊的駕駛座位置：量 assets/260/<id>.glb 的車頂輪廓，寫回 assets/260/cars.json 的 db（[座椅高度, 往前偏移]，公尺）
//   node tools/seats.mjs [id…]
// 取車寬中間四成的頂點，每 10 cm 一段記最高點：最高點往下 15 cm 內、最長的一段範圍（中間缺兩段以內算連著）就是車頂（擋風玻璃上緣到後窗上緣），
// 駕駛的骨盆在車頂前緣（擋風玻璃上緣）往後 45 cm、頭頂離車頂 3 cm（坐姿頭頂比骨盆高約 0.95 m），座椅再低也不低於 0.15 m。
// 機車沒有車窗射擊，跳過。gltf-transform 與 meshoptimizer 借 197 的 node_modules（和 tools/cars.mjs 一樣）。
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

const OUT = resolve(root, '../../assets/260');
const manifestPath = resolve(OUT, 'cars.json');
const spec = JSON.parse(readFileSync(manifestPath, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const only = process.argv.slice(2);
const BIN = .1, HIP_HEAD = .95, DROP = .15;

for (const [id, s] of Object.entries(spec)) {
  if (s.bike || only.length && !only.includes(id)) continue;
  const doc = await io.read(resolve(OUT, `${id}.glb`));
  const top = new Map();
  const v = [0, 0, 0];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || /wheel/i.test(node.getName())) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
        if (Math.abs(x) > s.w * .2) continue;
        const k = Math.round(z / BIN);
        if (!(top.get(k) >= y)) top.set(k, y);
      }
    }
  }
  const ks = [...top.keys()].sort((a, b) => a - b), ys = ks.map((k) => top.get(k));
  // 最高點用中位附近的高段（避開天線、尾翼）：取前 5% 的值
  const roof = [...ys].sort((a, b) => b - a)[Math.floor(ys.length * .05)];
  // 車頂是最長的一段連續高點（車尾偶爾有尾翼、車牌燈之類的零件也一樣高）
  let i0 = 0, i1 = -1;
  for (let i = 0; i < ys.length; i++) {
    if (!(ys[i] > roof - DROP)) continue;
    let j = i;
    for (let n = j + 1; n < ys.length && ks[n] - ks[j] <= 3; n++) if (ys[n] > roof - DROP) j = n;
    if (ks[j] - ks[i] > (i1 < 0 ? -1 : ks[i1] - ks[i0])) { i0 = i; i1 = j; }
    i = j;
  }
  const z0 = ks[i0] * BIN, z1 = ks[i1] * BIN, hipZ = Math.max(z0 + .2, z1 - .45), hipY = Math.min(.5, Math.max(.15, roof - HIP_HEAD - .03));
  s.db = [+hipY.toFixed(3), +hipZ.toFixed(3)];
  console.log(`${id.padEnd(8)} 車頂 ${roof.toFixed(2)} m（z ${z0.toFixed(2)}–${z1.toFixed(2)}）→ 座椅 ${s.db.join(', ')}`);
}
writeFileSync(manifestPath, JSON.stringify(spec, null, 1) + '\n');
