// 重建人物模型：Blender 無頭執行 blender/people.py → blender/out/people.glb，
// 再用 gltf-transform 去重、meshopt 壓縮（借 197 的 node_modules；gltfpack 會清掉網格名稱，前端靠名稱分辨髮型與眉毛）。
//   node tools/people.mjs     （需要 Blender 5.x；輸出有 commit，打包不需要它）
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, quantize, resample, meshopt } = await imp('@gltf-transform/functions');
const { PropertyType } = await imp('@gltf-transform/core');
const { MeshoptEncoder } = await imp('meshoptimizer');

const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const out = resolve(root, 'blender/out/people.glb');
execFileSync(blender, ['-b', '-P', resolve(root, 'blender/people.py')], { stdio: ['ignore', 'inherit', 'inherit'] });
if (!existsSync(out)) throw new Error('Blender 沒有輸出 people.glb');
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(out);
// 材質不去重：上衣／袖子、褲子／小腿在 Blender 裡是同色素材，合併後前端就分不出可換色的分區
await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }), resample(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(out, doc);
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
