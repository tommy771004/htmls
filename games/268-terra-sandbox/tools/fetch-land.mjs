// 下載 Natural Earth 1:110m 陸地輪廓（公有領域），量化成 0.1° 整數差分後寫入 src/land.js。
// 只在更新地圖資料時手動執行；產出有 commit，build 不需要網路。
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
const gj = await (await fetch(URL)).json();

const rings = [];
for (const f of gj.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) {
    const ring = p[0];
    const q = [];
    let px = null;
    let pz = null;
    for (const [lon, lat] of ring) {
      const x = Math.round(lon * 10);
      const z = Math.round(lat * 10);
      if (x === px && z === pz) continue;
      q.push([x, z]);
      px = x;
      pz = z;
    }
    if (q.length >= 4) rings.push(q);
  }
}

// 每個環：起點絕對值 + 之後的差分，全部攤平成以 ; 分隔的字串
const enc = rings
  .map((r) => {
    const out = [r[0][0], r[0][1]];
    for (let i = 1; i < r.length; i++) out.push(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    return out.join(',');
  })
  .join(';');

const src = `// Natural Earth 1:110m land（public domain），由 tools/fetch-land.mjs 產生，請勿手改。
// 格式：環以 ; 分隔；每環為 lon×10, lat×10 起點，之後為差分。
const RAW = '${enc}';

export const LAND = RAW.split(';').map((s) => {
  const v = s.split(',').map(Number);
  const pts = [];
  let x = v[0];
  let z = v[1];
  pts.push([x / 10, z / 10]);
  for (let i = 2; i < v.length; i += 2) {
    x += v[i];
    z += v[i + 1];
    pts.push([x / 10, z / 10]);
  }
  return pts;
});
`;
writeFileSync(resolve(root, 'src/land.js'), src);
console.log(`rings ${rings.length}, points ${rings.reduce((a, r) => a + r.length, 0)}, ${(src.length / 1024).toFixed(1)} KB`);
