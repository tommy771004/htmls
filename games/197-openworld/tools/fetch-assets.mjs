// 下載可選的外部資產（three.js 官方 repo 的範例模型與貼圖）到 assets/197/。
// 這些檔案不存在時遊戲仍可執行，只是會退回程序生成的版本；來源與授權見 CREDITS.md。
//
//   npm run assets
//
// 用系統的 curl 下載：公司網路的 TLS 由 Windows 憑證庫信任，Node 內建的 fetch 反而過不了。
// --ssl-no-revoke 只略過「憑證撤銷清單」查詢（在內網常連不上），憑證鏈本身仍會驗證。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 素材放在網站的 assets/197/（網頁版從 ../assets/197/ 讀取）
const PUBLIC = '../../assets/197';
const BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/';

const FILES = [
  // [來源路徑, 目的路徑（相對 assets/197/）]
  ['models/gltf/Stork.glb', 'models/stork.glb'],
  ['models/gltf/Parrot.glb', 'models/parrot.glb'],
  ['models/gltf/Flamingo.glb', 'models/flamingo.glb'],
  ['textures/terrain/grasslight-big.jpg', 'textures/grass.jpg'],
  ['textures/waternormals.jpg', 'textures/waternormals.jpg'],
  ['textures/planets/moon_1024.jpg', 'textures/moon.jpg'],
  ['textures/opengameart/smoke1.png', 'textures/smoke.png'],
  ['textures/opengameart/Caustic_Free.jpg', 'textures/caustics.jpg'],
  ['textures/hardwood2_diffuse.jpg', 'textures/wood.jpg'],
  ['textures/hardwood2_bump.jpg', 'textures/wood_bump.jpg'],
];

// ambientCG（https://ambientcg.com，全部 CC0）的掃描貼圖：每個資產是一包 zip，只取用得到的幾張
const ACG = {
  Ground037: { Color: 'ground.jpg', NormalGL: 'ground_n.jpg' }, // 帶苔的林地草皮
  Rock030: { Color: 'rock.jpg', NormalGL: 'rock_n.jpg' },
  Ground054: { Color: 'sand.jpg', NormalGL: 'sand_n.jpg' },
  Ground048: { Color: 'dirt.jpg', NormalGL: 'dirt_n.jpg' },
  Bark012: { Color: 'bark_oak.jpg', NormalGL: 'bark_oak_n.jpg' },
  Bark014: { Color: 'bark_fir.jpg', NormalGL: 'bark_fir_n.jpg' },
  LeafSet024: { Color: 'leaves.jpg', Opacity: 'leaves_a.jpg' }, // 闊葉（3×3 片）
  LeafSet019: { Color: 'conifer.jpg', Opacity: 'conifer_a.jpg' }, // 針葉枝
  Planks023A: { Color: 'planks.jpg', NormalGL: 'planks_n.jpg' },
  Fabric030: { Color: 'fabric.jpg', NormalGL: 'fabric_n.jpg' },
};

const force = process.argv.includes('--force');
let ok = 0;
let failed = 0;
for (const [src, dst] of FILES) {
  const out = path.join(root, PUBLIC, dst);
  if (!force && fs.existsSync(out) && fs.statSync(out).size > 1024) {
    console.log(`skip  ${dst}`);
    ok++;
    continue;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    const args = ['-sS', '-L', '--fail', '-m', '180', '-o', out, BASE + src];
    try {
      execFileSync('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch {
      execFileSync('curl', ['--ssl-no-revoke', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    }
    // 被網路管制擋下時會拿到一頁 HTML，而不是真正的檔案
    const head = fs.readFileSync(out).subarray(0, 64).toString('latin1');
    if (/<html|<!doctype/i.test(head)) throw new Error('拿到的是 HTML（可能被網路政策擋下）');
    console.log(`ok    ${dst}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
    ok++;
  } catch (err) {
    fs.rmSync(out, { force: true });
    console.warn(`FAIL  ${dst}: ${String(err.message).split('\n')[0]}`);
    failed++;
  }
}
const curl = (args) => {
  try {
    execFileSync('curl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch {
    execFileSync('curl', ['--ssl-no-revoke', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  }
};
const acgDir = path.join(root, PUBLIC, 'textures', 'acg');
fs.mkdirSync(acgDir, { recursive: true });
for (const [id, files] of Object.entries(ACG)) {
  const wanted = Object.entries(files);
  if (!force && wanted.every(([, name]) => fs.existsSync(path.join(acgDir, name)))) {
    console.log(`skip  acg/${id}`);
    ok++;
    continue;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acg-'));
  try {
    const zip = path.join(tmp, id + '.zip');
    curl(['-sS', '-L', '--fail', '-m', '300', '-o', zip, `https://ambientcg.com/get?file=${id}_1K-JPG.zip`]);
    // Windows 內建的 tar（bsdtar）與 Linux/macOS 的 unzip 都能解 zip
    try {
      execFileSync('tar', ['-xf', zip, '-C', tmp], { stdio: 'ignore' });
    } catch {
      execFileSync('unzip', ['-o', '-q', zip, '-d', tmp], { stdio: 'ignore' });
    }
    for (const [map, name] of wanted) fs.copyFileSync(path.join(tmp, `${id}_1K-JPG_${map}.jpg`), path.join(acgDir, name));
    console.log(`ok    acg/${id}`);
    ok++;
  } catch (err) {
    console.warn(`FAIL  acg/${id}: ${String(err.message).split('\n')[0]}`);
    failed++;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(`\n${ok} 個就緒、${failed} 個失敗${failed ? '（失敗的項目會退回程序生成）' : ''}`);
