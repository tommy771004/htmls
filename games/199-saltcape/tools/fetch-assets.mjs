// 下載 CC0 素材到 ../../assets/199/（來源與授權見 CREDITS.md）：
//   ambientCG 掃描貼圖（顏色＋法線，縮成 1024 的 WebP）、Poly Haven 天空 HDRI、Kenney 車輛、Poly Haven 道具模型。
// node tools/fetch-assets.mjs [--force]；需要 curl、unzip、cwebp、sips（macOS）。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(root, 'assets/199');
const force = process.argv.includes('--force');
const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
const get = (url, file) => sh('curl', ['-sS', '-L', '--fail', '-m', '600', '-A', 'Mozilla/5.0', '-o', file, url]);
const have = (f) => !force && fs.existsSync(f) && fs.statSync(f).size > 1024;
let failed = 0;
const step = (name, fn) => { try { fn(); } catch (e) { failed++; console.warn(`FAIL  ${name}: ${String(e.message).split('\n')[0]}`); } };

// ambientCG：資產 → 檔名（色、法線）
export const ACG = {
  Bricks085: 'brick', Plaster001: 'plaster', PaintedPlaster017: 'wall', Concrete034: 'concrete', Concrete031: 'concrete2',
  Road012A: 'asphalt', PavingStones070: 'paving', WoodFloor051: 'wood', Tiles107: 'tile', CorrugatedSteel005: 'metal',
  Metal041B: 'rust', RoofingTiles014B: 'roof', Grass004: 'grass', Ground037: 'grassdirt', Ground103: 'dirt', Rock030: 'rock',
  Ground054: 'sand', Facade006: 'facade', Bark012: 'bark', WoodSiding009: 'siding',
};
const tex = path.join(OUT, 'tex');
fs.mkdirSync(tex, { recursive: true });
for (const [id, name] of Object.entries(ACG)) {
  if (have(path.join(tex, name + '.webp')) && have(path.join(tex, name + '_n.webp'))) { console.log(`skip  tex/${name}`); continue; }
  step(`acg/${id}`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acg-'));
    const zip = path.join(tmp, 'a.zip');
    get(`https://ambientcg.com/get?file=${id}_1K-JPG.zip`, zip);
    sh('unzip', ['-o', '-q', zip, '-d', tmp]);
    const pick = (suffix) => fs.readdirSync(tmp).find((f) => f.endsWith(`_${suffix}.jpg`));
    sh('cwebp', ['-quiet', '-q', '80', '-resize', '1024', '1024', path.join(tmp, pick('Color')), '-o', path.join(tex, name + '.webp')]);
    sh('cwebp', ['-quiet', '-q', '88', '-resize', '1024', '1024', path.join(tmp, pick('NormalGL')), '-o', path.join(tex, name + '_n.webp')]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`ok    tex/${name}  ← ${id}`);
  });
}
// 樹葉卡片（顏色＋透明度）
step('acg/LeafSet024', () => {
  if (have(path.join(tex, 'leaves.webp'))) { console.log('skip  tex/leaves'); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acg-'));
  get('https://ambientcg.com/get?file=LeafSet024_1K-PNG.zip', path.join(tmp, 'a.zip'));
  sh('unzip', ['-o', '-q', path.join(tmp, 'a.zip'), '-d', tmp]);
  const f = (s) => path.join(tmp, fs.readdirSync(tmp).find((x) => x.endsWith(`_${s}.png`)));
  // 透明度併進 alpha：用 sips 做不到，交給前端在 canvas 合成；這裡各存一張
  sh('cwebp', ['-quiet', '-q', '82', '-resize', '1024', '1024', f('Color'), '-o', path.join(tex, 'leaves.webp')]);
  sh('cwebp', ['-quiet', '-q', '82', '-resize', '1024', '1024', f('Opacity'), '-o', path.join(tex, 'leaves_a.webp')]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('ok    tex/leaves');
});

// Poly Haven 天空：1k HDR 給環境光，色調對應過的 JPG 縮成 4096×2048 當背景
const HDRI = 'kloofendal_48d_partly_cloudy_puresky';
const sky = path.join(OUT, 'sky');
fs.mkdirSync(sky, { recursive: true });
step('sky/env.hdr', () => { if (have(path.join(sky, 'env.hdr'))) return console.log('skip  sky/env.hdr'); get(`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${HDRI}_1k.hdr`, path.join(sky, 'env.hdr')); console.log('ok    sky/env.hdr'); });
step('sky/sky.jpg', () => {
  if (have(path.join(sky, 'sky.jpg'))) return console.log('skip  sky/sky.jpg');
  const tmp = path.join(os.tmpdir(), 'sky-big.jpg');
  get(`https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/${HDRI}.jpg`, tmp);
  sh('sips', ['-z', '2048', '4096', '-s', 'formatOptions', '80', tmp, '--out', path.join(sky, 'sky.jpg')]);
  console.log('ok    sky/sky.jpg');
});

// Kenney Car Kit（CC0）：挑幾台車，貼圖是共用的 colormap
const cars = path.join(OUT, 'cars');
step('kenney car kit', () => {
  const want = ['sedan', 'hatchback-sports', 'van', 'suv', 'taxi', 'truck', 'police'];
  if (want.every((c) => have(path.join(cars, c + '.glb')))) return console.log('skip  cars');
  fs.mkdirSync(cars, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'car-'));
  const page = execFileSync('curl', ['-sSL', '-m', '60', '-A', 'Mozilla/5.0', 'https://kenney.nl/assets/car-kit']).toString();
  const url = page.match(/https:\/\/kenney\.nl\/media\/pages\/assets\/car-kit\/[^"]+\.zip/)[0];
  get(url, path.join(tmp, 'k.zip'));
  sh('unzip', ['-o', '-q', path.join(tmp, 'k.zip'), '-d', tmp]);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(tmp);
  for (const c of want) {
    const src = files.find((f) => f.endsWith(`${path.sep}${c}.glb`) && f.includes('GLB'));
    if (src) fs.copyFileSync(src, path.join(cars, c + '.glb'));
  }
  const cm = files.find((f) => /GLB.*colormap\.png$/i.test(f)) || files.find((f) => /colormap\.png$/i.test(f));
  if (cm) { fs.mkdirSync(path.join(cars, 'Textures'), { recursive: true }); fs.copyFileSync(cm, path.join(cars, 'Textures', 'colormap.png')); }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('ok    cars');
});

// Poly Haven 道具（glTF 1k → 單檔 GLB 由前端 GLTFLoader 讀）
const PH_MODELS = ['old_military_crate', 'metal_jerrycan_green', 'power_box_01'];
const props = path.join(OUT, 'props');
for (const id of PH_MODELS) {
  step(`props/${id}`, () => {
    if (have(path.join(props, id, `${id}_1k.gltf`))) return console.log(`skip  props/${id}`);
    const info = JSON.parse(execFileSync('curl', ['-sS', '-m', '60', `https://api.polyhaven.com/files/${id}`]).toString());
    const g = info.gltf['1k'].gltf;
    const dir = path.join(props, id);
    fs.mkdirSync(dir, { recursive: true });
    get(g.url, path.join(dir, `${id}_1k.gltf`));
    for (const [rel, f] of Object.entries(g.include || {})) {
      const out = path.join(dir, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      get(f.url, out);
      // 道具在畫面上很小：貼圖縮到 512
      if (/\.(jpg|png)$/i.test(out)) sh('sips', ['-Z', '512', '-s', 'formatOptions', '80', out, '--out', out]);
    }
    console.log(`ok    props/${id}`);
  });
}
console.log(failed ? `${failed} 項失敗` : '完成');
process.exitCode = failed ? 1 : 0;
