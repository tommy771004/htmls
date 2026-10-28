// 壓縮 Blender 匯出的 glb：blender/out/_<組>.glb → blender/out/<組>.glb（build 只內嵌沒有底線的）
// 拿掉用不到的 UV（只有 leaf／grass 需要）、weld、meshopt 量化＋壓縮。gltf-transform 與 meshoptimizer 借用 197 的 node_modules。
// node tools/pack.mjs [組…]
// 注意：meshopt 量化會把位置的縮放／位移放到節點上，載入時要用節點的 matrixWorld（見 src/view/assets.js）。
import { createRequire } from 'node:module';
import { readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, PropertyType } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { weld, meshopt, prune, dedup } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const dir = resolve(root, 'blender/out');
const want = process.argv.slice(2);
for (const f of readdirSync(dir).filter((f) => /^_.*\.glb$/.test(f))) {
  const name = f.slice(1, -4);
  if (want.length && !want.includes(name)) continue;
  const doc = await io.read(resolve(dir, f));
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const m = prim.getMaterial()?.getName() || '';
      if (m !== 'leaf' && m !== 'grass') prim.setAttribute('TEXCOORD_0', null);
      else if (!prim.getAttribute('TEXCOORD_0')) throw new Error(`${name}: ${m} 沒有 UV`);
    }
  }
  // dedup 不能合併材質：材質名是執行時辨識用的標籤（屬性一樣、名字不同的材質要分開）
  // prune 要保留屬性：葉片的 UV 是給執行時的 alphaMap 用的，glb 裡的材質沒有貼圖，預設會被當成沒用的刪掉
  // 房子的遠景版（housesLod）不在這裡簡化：平面著色的每個頂點法線／顏色都不同，meshopt simplify 一個面也減不掉，改由 Blender 另出（export.py housesLod）
  await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }), prune({ keepAttributes: true }), weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = resolve(dir, name + '.glb');
  await io.write(out, doc);
  console.log(`${name}.glb ${(statSync(resolve(dir, f)).size / 1048576).toFixed(1)} MB → ${(statSync(out).size / 1048576).toFixed(2)} MB`);
}
