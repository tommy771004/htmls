// 掃描人物：Blender 無頭執行 blender/scan_people.py（綁到 Quaternius 骨架）→ assets/260/people/<id>.glb，
// 再用 gltf-transform 量化、meshopt 壓縮（借 197 的 node_modules）。原檔在 gitignore 的 .cache/people/。
//   node tools/scan-people.mjs [id ...]     （需要 Blender 5.x；輸出有 commit，打包不需要它）
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, quantize, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');

const IDS = ['jason', 'lucia'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : IDS;
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
execFileSync(blender, ['-b', '--factory-startup', '-P', resolve(root, 'blender/scan_people.py'), '--', ...ids], { stdio: ['ignore', 'inherit', 'inherit'] });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
for (const id of ids) {
  const out = resolve(root, `../../assets/260/people/${id}.glb`);
  const doc = await io.read(out);
  await doc.transform(dedup(), prune(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await io.write(out, doc);
  console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
}
