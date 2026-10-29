// 重建服裝模型：Blender 無頭執行 blender/wear.py → blender/out/wear.glb，再用 gltf-transform 去重、量化、meshopt 壓縮
// （借 197 的 node_modules，同 tools/people.mjs）。_TRIM 不量化：部位是整數、小數是鏡片的漸層（40-people.js 的 lg）
//   node tools/wear.mjs     （需要 Blender 5.x；輸出有 commit，打包不需要它）
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, PropertyType } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, quantize, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');

const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const out = resolve(root, 'blender/out/wear.glb');
if (!process.argv.includes('--pack')) execFileSync(blender, ['-b', '-P', resolve(root, 'blender/wear.py')], { stdio: ['ignore', 'inherit', 'inherit'] });
if (!existsSync(out)) throw new Error('Blender 沒有輸出 wear.glb');
const raw = statSync(out).size;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(out);
await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH] }), prune(),
  quantize({ pattern: /^(POSITION|NORMAL|JOINTS|WEIGHTS)/i, quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(out, doc);
console.log(`${out}: ${(raw / 1024).toFixed(0)} → ${(statSync(out).size / 1024).toFixed(0)} KB`);
