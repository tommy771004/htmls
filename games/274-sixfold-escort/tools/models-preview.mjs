// 外部模型預覽：把 blender/out/<group>.glb 每件（m_<id> 根節點）排成格子、統一光照拍照 → dist/models-<group>-<a|b>.png
//   每件一格、鏡頭依包圍球取景。a：正面右前方俯拍（模型正面朝 +Z）；b：背面左後方；c：正前方平視；t：正上方俯視（找 cut 盒用，畫面上方是 −Z）；s：從 +X 側面平視（畫面左邊是 +Z，看刃口朝向）。大於 1.2 m 的件旁邊立一根 1.75 m 白柱當人體比例，
//   標籤是 id、正規化後的寬×高×深（公尺）、三角形數、draw call、貼圖張數（取自 dist/models-report.json）。
// 用法：node tools/models-preview.mjs [--only=arch,props] [--views=a,b,c] [--ids=qp_hall,qp_gate] [--test] [--soft]
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { open } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3).split(',').filter(Boolean) : null; };
const RESERVED = new Set(['actors']);
const testDir = process.argv.includes('--test'); // 讀 pack-models --id 的試做檔 dist/models-test-<group>.glb
const FILE = (g) => resolve(root, testDir ? `dist/models-test-${g}.glb` : `blender/out/${g}.glb`);
const groups = (arg('only') || readdirSync(resolve(root, 'blender/out')).filter((f) => f.endsWith('.glb') && !f.startsWith('_')).map((f) => basename(f, '.glb')).filter((g) => !RESERVED.has(g)));
const views = arg('views') || ['a', 'b'];
const ids = arg('ids');
const soft = process.argv.includes('--soft');
const repFile = resolve(root, 'dist/models-report.json');
const report = existsSync(repFile) ? JSON.parse(readFileSync(repFile, 'utf8')).filter((r) => !r.groupSummary) : [];

const pageJs = `
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const q = new URLSearchParams(location.search);
const group = q.get('group'), view = q.get('view') || 'a';
const report = JSON.parse(document.getElementById('report').textContent);
const W = innerWidth, H = innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const el = document.getElementById('glb-' + group);
const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
const only = q.get('ids') ? q.get('ids').split(',') : null;
const items = [...gltf.scene.children].filter((o) => !only || only.includes(o.name.replace(/^m_/, '')));
const n = items.length, cols = Math.min(n, Math.ceil(Math.sqrt(n * (W / H) * 0.9))), rows = Math.ceil(n / cols);
const tw = Math.floor(W / cols), th = Math.floor(H / rows);
items.forEach((obj, i) => {
  const c = i % cols, r = Math.floor(i / cols);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color((c + r) % 2 ? 0x868a8e : 0x7e8286);
  scene.environment = env; scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x5a5248, 0.9));
  scene.add(obj);
  obj.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const R = Math.max(size.length() / 2, 0.01);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(R * 1.6, 48), new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 1 }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = box.min.y - R * 0.002; pad.receiveShadow = true; scene.add(pad);
  if (obj.name.indexOf('m_arm') !== 0 && R > 0.6) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.75, 8), new THREE.MeshStandardMaterial({ color: 0xe8e2d6 }));
    post.position.set(box.max.x + 0.25, 0.875, box.max.z); scene.add(post);
  }
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(ctr.x + R * 1.2, ctr.y + R * 2.2, ctr.z + R * 1.6); sun.target.position.copy(ctr);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -R * 1.7; sc.right = sc.top = R * 1.7; sc.far = R * 8; sc.near = R * 0.01;
  scene.add(sun, sun.target);
  const cam = new THREE.PerspectiveCamera(28, tw / th, R * 0.01, R * 20);
  const yaw = view === 'a' ? 0.55 : view === 's' ? Math.PI / 2 : Math.PI + 0.55, pitch = view === 'c' || view === 's' ? 0.05 : view === 't' ? 1.5 : 0.38;
  const yaw2 = view === 'c' || view === 't' ? 0 : yaw;
  const d = R / Math.sin((28 * Math.PI) / 360) * 1.02;
  cam.position.set(ctr.x + Math.sin(yaw2) * Math.cos(pitch) * d, ctr.y + Math.sin(pitch) * d, ctr.z + Math.cos(yaw2) * Math.cos(pitch) * d);
  cam.lookAt(ctr);
  const x = c * tw, y = H - (r + 1) * th;
  renderer.setViewport(x, y, tw, th); renderer.setScissor(x, y, tw, th);
  renderer.render(scene, cam);
  const id = obj.name.replace(/^m_/, '');
  const rec = report.find((x) => x.id === id) || {};
  const div = document.createElement('div'); div.className = 'lab';
  div.style.left = (x + 4) + 'px'; div.style.top = (r * th + 4) + 'px';
  div.innerHTML = '<b>' + id + '</b> ' + [size.x, size.y, size.z].map((v) => v.toFixed(2)).join('×') + ' m<br>' + (rec.tris ?? '?') + ' 三角 · ' + (rec.drawCalls ?? '?') + ' dc · ' + (rec.tex ?? '?') + ' 張 ≤' + (rec.texDims ? Math.max(0, ...rec.texDims) : '') + ' · ' + ((rec.texKB ?? 0) + (rec.geoKB ?? 0)) + ' KB';
  document.body.appendChild(div);
});
window.__sf = { ready: true, count: n };
`;

const res = await build({ stdin: { contents: pageJs, resolveDir: resolve(root, 'src'), loader: 'js' }, bundle: true, format: 'esm', write: false, target: 'es2022', logLevel: 'warning' });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const glbs = groups.map((g) => `<script type="application/octet-stream" id="glb-${g}">${gzipSync(readFileSync(FILE(g))).toString('base64')}</script>`).join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;background:#8b8f93;overflow:hidden;font:11px/1.25 -apple-system,"PingFang TC",sans-serif}
.lab{position:absolute;color:#111;background:rgba(255,255,255,.78);padding:1px 4px;border-radius:2px;white-space:nowrap}
</style></head><body>${glbs}<script type="application/json" id="report">${JSON.stringify(report)}</script><script type="module">${js}</script></body></html>`;
mkdirSync(resolve(root, 'dist'), { recursive: true });
const htmlFile = resolve(root, 'dist/models-preview.html');
writeFileSync(htmlFile, html);

for (const g of groups) {
  for (const v of views) {
    const { browser, page, log } = await open(htmlFile, { w: 1800, h: 1200, soft, query: `?group=${g}&view=${v}${ids ? '&ids=' + ids.join(',') : ''}` });
    const out = resolve(root, `dist/models-${g}-${v}.png`);
    await page.screenshot({ path: out });
    console.log(`${out}（${log.gpu}）${[...log.pageerrors, ...log.errors].slice(0, 3).join(' | ')}`);
    await browser.close();
  }
}
