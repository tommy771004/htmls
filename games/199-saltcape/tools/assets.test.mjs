// 前端 assets.js 會請求的每個網址都必須存在於 ../../assets/199/，否則線上會出現 404（console.error）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../../assets/199');
const src = fs.readFileSync(path.resolve(here, '../src/client/assets.js'), 'utf8');
const list = (re) => JSON.parse('[' + src.match(re)[1].replace(/'/g, '"') + ']');

test('assets.js 引用的素材都在 assets/199/', () => {
  const tex = list(/TEX_NAMES = \[([^\]]+)\]/);
  const cars = list(/for \(const c of \[([^\]]+)\]\)/);
  const props = list(/for \(const p of \[([^\]]+)\]\)/);
  const files = [
    ...tex.flatMap((n) => [`tex/${n}.webp`, `tex/${n}_n.webp`]),
    'tex/leaves.webp', 'tex/leaves_a.webp', 'sky/sky.jpg', 'sky/env.hdr', 'models/soldier.glb',
    ...cars.map((c) => `cars/${c}.glb`), 'cars/Textures/colormap.png',
    ...props.map((p) => `props/${p}/${p}_1k.gltf`),
  ];
  const missing = files.filter((f) => !fs.existsSync(path.join(dir, f)));
  assert.deepEqual(missing, []);
  // glTF 參照的 bin 與貼圖
  for (const p of props) {
    const g = JSON.parse(fs.readFileSync(path.join(dir, `props/${p}/${p}_1k.gltf`), 'utf8'));
    for (const u of [...(g.buffers || []), ...(g.images || [])].map((x) => x.uri).filter(Boolean)) assert.ok(fs.existsSync(path.join(dir, 'props', p, decodeURIComponent(u))), `${p} 缺 ${u}`);
  }
});
