// 下載 Poly Haven（https://polyhaven.com，全部 CC0）的掃描模型，減面後存成 assets/197/models/ph/*.glb。
// 每個資產輸出兩個檔：<id>.glb（近景，含顏色與法線貼圖）與 <id>_far.glb（遠景，只有幾何，執行時沿用近景的材質）。
//
//   npm run assets     （fetch-assets.mjs 之後接著跑）
//   node tools/fetch-polyhaven.mjs --force
//
// 掃描原檔動輒數萬到數十萬個三角形，場景裡又要擺上百個，所以用 meshoptimizer 減到 SCANS 裡的目標面數。
// 粗糙度／AO 貼圖（arm）不帶進遊戲：遠看分不出差別，省下約三分之一的檔案大小。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 素材放在網站的 assets/197/（網頁版從 ../assets/197/ 讀取）
const PUBLIC = '../../assets/197';
const outDir = path.join(root, PUBLIC, 'models', 'ph');

// near／far：減面後的三角形數上限；alphaPng：顏色貼圖改抓帶透明度的 PNG（gltf 版附的是 JPG，葉片的鏤空會不見）
const SCANS = {
  rock_07: { near: 2200, far: 260 },
  rock_face_02: { near: 3000, far: 320 },
  tree_stump_01: { near: 2400, far: 300 },
  dead_tree_trunk: { near: 3000, far: 360 },
  fern_02: { near: 0, far: 0, alphaPng: true }, // 葉片卡本來就只有約六千面（四株），不減面、也不做遠景
};

const curl = (args) => {
  try {
    execFileSync('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    execFileSync('curl', ['--ssl-no-revoke', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  }
};
const getJson = (url, tmp) => {
  const file = path.join(tmp, 'api.json');
  curl(['-sS', '-L', '--fail', '-m', '60', '-o', file, url]);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const triangles = (doc) => {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) n += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
  }
  return n;
};

/** 依目標面數減面；error 給寬一點，讓 ratio 決定停在哪裡 */
async function reduce(doc, target) {
  const tris = triangles(doc);
  if (!target || tris <= target) return;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: target / tris, error: 0.02 }));
}

function stripRoughness(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicRoughnessTexture(null).setOcclusionTexture(null).setMetallicFactor(0).setRoughnessFactor(0.92);
  }
}

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const force = process.argv.includes('--force');
fs.mkdirSync(outDir, { recursive: true });
let ok = 0;
let failed = 0;
for (const [id, cfg] of Object.entries(SCANS)) {
  const nearFile = path.join(outDir, `${id}.glb`);
  const farFile = path.join(outDir, `${id}_far.glb`);
  if (!force && fs.existsSync(nearFile) && (!cfg.far || fs.existsSync(farFile))) {
    console.log(`skip  ph/${id}`);
    ok++;
    continue;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-'));
  try {
    const files = getJson(`https://api.polyhaven.com/files/${id}`, tmp);
    const gltf = files.gltf['1k'].gltf;
    const gltfPath = path.join(tmp, path.basename(gltf.url));
    curl(['-sS', '-L', '--fail', '-m', '120', '-o', gltfPath, gltf.url]);
    for (const [rel, f] of Object.entries(gltf.include)) {
      const dst = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      curl(['-sS', '-L', '--fail', '-m', '300', '-o', dst, f.url]);
    }
    if (cfg.alphaPng) {
      // 把 gltf 裡的顏色貼圖換成帶 alpha 的 PNG
      const png = files.Diffuse['1k'].png;
      const pngRel = `textures/${path.basename(png.url)}`;
      curl(['-sS', '-L', '--fail', '-m', '300', '-o', path.join(tmp, pngRel), png.url]);
      const json = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
      for (const img of json.images) {
        if (/_diff_/.test(img.uri)) Object.assign(img, { uri: pngRel, mimeType: 'image/png' });
      }
      fs.writeFileSync(gltfPath, JSON.stringify(json));
    }

    const before = triangles(await io.read(gltfPath));
    const near = await io.read(gltfPath);
    stripRoughness(near);
    await reduce(near, cfg.near);
    await near.transform(dedup(), prune());
    await io.write(nearFile, near);

    let farInfo = '';
    if (cfg.far) {
      const far = await io.read(gltfPath);
      for (const mat of far.getRoot().listMaterials()) {
        mat.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null);
      }
      await reduce(far, cfg.far);
      await far.transform(prune());
      await io.write(farFile, far);
      farInfo = `，遠景 ${triangles(far)} 面`;
    }
    const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0);
    console.log(`ok    ph/${id}  ${before} → ${triangles(near)} 面${farInfo}  ${kb(nearFile)} KB`);
    ok++;
  } catch (err) {
    fs.rmSync(nearFile, { force: true });
    fs.rmSync(farFile, { force: true });
    console.warn(`FAIL  ph/${id}: ${String(err.message).split('\n')[0]}`);
    failed++;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(`\nPoly Haven：${ok} 個就緒、${failed} 個失敗${failed ? '（失敗的項目會退回程序生成）' : ''}`);
