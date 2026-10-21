// 檢查 assets/260/<id>.glb：側面、正面、俯視、四分之三視角拼成一張圖（輪子節點塗紅、車漆塗藍），確認車頭朝 +z 與輪子拆分
//   node tools/car-view.mjs <id> [out.png]
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { GPU_ARGS, chromePath } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const id = process.argv[2], out = process.argv[3] || resolve(root, `.cache/view-${id}.png`);
const three = resolve(root, 'node_modules/three');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const page = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#888">
<script type=importmap>{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type=module>
import * as T from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const R = new T.WebGLRenderer({ antialias: true }); R.setSize(1600, 900); document.body.appendChild(R.domElement); R.setScissorTest(true);
const S = new T.Scene(); S.background = new T.Color(0x9aa0a8);
S.add(new T.HemisphereLight(0xffffff, 0x444444, 2.2)); const d = new T.DirectionalLight(0xffffff, 2); d.position.set(3, 5, 4); S.add(d);
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/assets/260/${id}.glb');
const car = g.scene.getObjectByName('car'); const spec = car.userData;
g.scene.traverse(o => { if (!o.isMesh) return; const wheel = /wheel/.test(o.parent.name + o.name);
  const p = o.geometry.attributes._pbr, c = o.geometry.attributes.color, paint = p && p.getW(0) > .5;
  const nc = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { const pt = p.getW(i) > .5; nc[i * 3] = pt ? .05 : c.getX(i); nc[i * 3 + 1] = pt ? .2 : c.getY(i); nc[i * 3 + 2] = pt ? 1 : c.getZ(i); }
  o.geometry.setAttribute('color', new T.BufferAttribute(nc, 3));
  o.material = new T.MeshStandardMaterial({ vertexColors: true, map: o.material.map, emissive: wheel ? 0xff0000 : 0, emissiveIntensity: .6, roughness: .5, transparent: o.material.transparent, opacity: o.material.transparent ? .5 : 1 });
  window.attrs = (window.attrs || []).concat(o.name + ':' + Object.keys(o.geometry.attributes).join(',') + (p ? ' w=' + p.getW(0) : '')); });
S.add(g.scene); S.add(new T.GridHelper(10, 20, 0x000000, 0x555555)); S.add(new T.AxesHelper(3));
const L = spec.len;
const views = [[0, 0, 800, 450, [L * 1.2, .7, 0]], [800, 0, 800, 450, [0, .8, L * 1.1]], [0, 450, 800, 450, [0, L * 1.6, .01]], [800, 450, 800, 450, [L * .9, L * .45, L * .9]]];
for (const [x, y, w, h, p] of views) { const c = new T.PerspectiveCamera(35, w / h, .1, 100); c.position.set(...p); c.lookAt(0, spec.h * .4, 0); R.setViewport(x, 900 - y - h, w, h); R.setScissor(x, 900 - y - h, w, h); R.render(S, c); }
window.done = JSON.stringify(spec); console.log(window.attrs.slice(0,6).join(' | '));
</script>`;
const srv = createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end(page); }
  const f = u.startsWith('/three/') ? resolve(three, u.slice(7)) : resolve(repo, u.slice(1));
  if (!existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
}).listen(0);
const url = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ headless: true, args: GPU_ARGS, executablePath: chromePath() });
const pg = await browser.newPage({ viewport: { width: 1600, height: 900 } });
pg.on('pageerror', e => console.error(e.message)); pg.on('console', m => m.type() !== 'warning' && console.error(m.text()));
await pg.goto(url); await pg.waitForFunction(() => window.done, null, { timeout: 60000 });
await pg.screenshot({ path: out });
console.log(out);
await browser.close(); srv.close();
