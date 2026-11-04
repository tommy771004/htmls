// pack-models.mjs 的前處理：models.json 裡有 prep 欄位的件，先把原檔轉成管線讀得了的中間檔（寫到 entry.file）。
//   prep.decode = '<原檔>'：Draco 壓縮的 GLB 解碼（gltf-transform 讀不了 KHR_draco_mesh_compression 時用；
//     解碼器借 ../197-openworld/node_modules/three 的 draco_decoder.js），輸出 .cache/models/_decoded/...
//   prep.bake = { src, tris, tex, voxel, solid, ext, ray, uvAngle = 66, smooth = 35 }：Blender 無頭跑 tools/bake-model.py，
//     高模 → 加厚＋體素外殼＋減面＋重展 UV → 底色烘成一張圖，輸出 .cache/models/_baked/...（一件一個材質、一次 draw call）
// 用法：node tools/prep-models.mjs [--id=bk_house,bk_pagoda] [--force]
//   已存在的中間檔預設跳過；BLENDER 可指定 Blender 執行檔（預設 /Applications/Blender.app/Contents/MacOS/Blender）。
// .cache/ 不進 git：換機器或清快取後，先跑這支再 npm run models。
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const depsRoot = process.env.MODELS_DEPS || resolve(root, '../197-openworld');
const CACHE = resolve(root, '.cache/models');
const BLENDER = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const arg = (k) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3).split(',').filter(Boolean) : null; };
const onlyIds = arg('id');
const force = process.argv.includes('--force');
const spec = JSON.parse(readFileSync(resolve(root, 'tools/models.json'), 'utf8'));
const items = spec.models.filter((m) => m.prep && !m.skip && (!onlyIds || onlyIds.includes(m.id)));

let io = null;
async function decoder() {
  if (io) return io;
  const req = createRequire(resolve(depsRoot, 'package.json'));
  const { NodeIO, Logger } = req('@gltf-transform/core');
  const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
  const src = readFileSync(resolve(depsRoot, 'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js'), 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', '__filename', '__dirname', src)(mod, mod.exports, req, 'draco_decoder.js', '.');
  const draco = await (mod.exports.DracoDecoderModule || mod.exports)();
  io = new NodeIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': draco });
  return io;
}

for (const it of items) {
  const out = resolve(CACHE, it.file);
  if (existsSync(out) && !force) { console.log(`  略過 ${it.id}（${it.file} 已存在）`); continue; }
  mkdirSync(dirname(out), { recursive: true });
  const t0 = Date.now();
  if (it.prep.decode) {
    const rw = await decoder();
    const doc = await rw.read(resolve(CACHE, it.prep.decode));
    for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
    await rw.write(out, doc);
  } else if (it.prep.bake) {
    const b = it.prep.bake;
    const res = execFileSync(BLENDER, ['-b', '--factory-startup', '--python', resolve(root, 'tools/bake-model.py'), '--',
      resolve(CACHE, b.src), out, String(b.tris), String(b.tex ?? 1024), String(b.voxel ?? 0), String(b.solid ?? 0), String(b.ext ?? 0.05), String(b.ray ?? 0.2), String(b.uvAngle ?? 66), String(b.smooth ?? 35)], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const line = res.split('\n').find((s) => s.startsWith('BAKED'));
    if (!line) throw new Error(`${it.id}: Blender 沒有輸出烘焙結果\n${res.slice(-2000)}`);
  }
  console.log(`  ${it.id} → ${it.file}（${((Date.now() - t0) / 1000).toFixed(1)} s）`);
}
