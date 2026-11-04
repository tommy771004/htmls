// 量實車的方向盤（cars.json 的 sw，src/doors.mjs 的 swSplit）：在駕駛座附近切薄片看，2 cm 格線、每 10 cm 標數字。
//   node tools/wheel-view.mjs <id> [out.png] [--sw='{"c":[x,y,z],"r":.18,"t":22}'] [--cab='[…]'|--nocab]（車內改色，src/cabin.mjs）
// 數字標在格線上（標籤的中心就是那個值）。左上：側視（從 +x 看，只畫駕駛座左右 25 cm 的薄片）；右上：從駕駛往前看（只畫座位前 0.1–1 m）；
// 左下：俯視（只畫 0.45–1.15 m 高）；右下：駕駛眼睛的透視。給了 sw（或 cars.json 已經有）就把拆到的三角形塗綠、畫出圓圈。
// 另外印出座位前方大小像方向盤（最長邊 0.25–0.5 m、最短邊 0.15 m 以下）的連通塊，當起點。
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { GPU_ARGS, chromePath } from './lib.mjs';
import { cabBox } from '../src/cabin.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return [a.slice(2, i < 0 ? undefined : i), i < 0 ? '1' : a.slice(i + 1)]; }));
const id = pos[0], out = pos[1] || resolve(root, `.cache/wheel-${id}.png`);
const spec = JSON.parse(readFileSync(resolve(repo, 'assets/260/cars.json'), 'utf8'))[id];
if (!spec) throw new Error('cars.json 沒有 ' + id);
const door = spec.door || {}, db = spec.db || [.4, 0];
const seat = door.seat || [Math.max(.3, spec.w / 2 - .58) * (door.rhd ? -1 : 1), db[0], db[1]];
const sw = opt.sw ? JSON.parse(opt.sw) : spec.sw || null;
const cab = opt.nocab ? null : opt.cab ? JSON.parse(opt.cab) : spec.cab || null;   // 車內重新上色：--cab='[…]' 試規則、--nocab 看原本的顏色
const three = resolve(root, 'node_modules/three');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const page = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#888">
<script type=importmap>{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type=module>
import * as T from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { swSplit, swAxis } from '/games/260-neon-nightcity/src/doors.mjs'; import { cabTint, cabBox } from '/games/260-neon-nightcity/src/cabin.mjs';
const CAB = ${JSON.stringify(cab)}, BOX = ${JSON.stringify(cabBox({ ...spec, door: spec.door || door }))};
const ST = ${JSON.stringify(seat)}, SW = ${JSON.stringify(sw)};
const E = SW ? SW.c : [ST[0], ST[1] + .45, ST[2] + .5];   // 看哪裡：已知的方向盤中心，或座位前上方的估計
const R = new T.WebGLRenderer({ antialias: true }); R.setSize(1600, 1000); R.localClippingEnabled = true; document.body.appendChild(R.domElement); R.setScissorTest(true);
const S = new T.Scene(); S.background = new T.Color(0x9aa0a8);
S.add(new T.HemisphereLight(0xffffff, 0x444444, 2.6)); const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(2, 4, -3); S.add(dl);
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/assets/260/${id}.glb');
g.scene.updateMatrixWorld(true);
const car = g.scene.getObjectByName('car'), inv = car.matrixWorld.clone().invert();
const clip = [];   // 每個視角換一組切平面（所有材質共用這個陣列）
const mats = new Map();
const matOf = (src, hl) => { const k = src.uuid + hl; if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ vertexColors: true, map: src.map, emissive: hl ? 0x00ff40 : 0, emissiveIntensity: hl ? .9 : 0, transparent: !!src.transparent, opacity: src.transparent ? .35 : 1, side: T.DoubleSide, clippingPlanes: clip, roughness: .7 })); return mats.get(k); };
const meshes = []; car.traverse((o) => { if (o.isMesh) meshes.push(o); });
let swTris = 0;
const cand = [];
for (const m of meshes) {
  let n = m; while (n.parent && n.parent !== car) n = n.parent;
  const geo = m.geometry, rel = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld);
  if (CAB && !/^wheel/.test(n.name)) cabTint(geo, rel, CAB, BOX, !!m.material.map, !!m.material.transparent);   // 車內重新上色（src/cabin.mjs）
  const c = geo.attributes.color; if (c) { const nc = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { nc[i * 3] = c.getX(i); nc[i * 3 + 1] = c.getY(i); nc[i * 3 + 2] = c.getZ(i); } geo.setAttribute('color', new T.BufferAttribute(nc, 3)); }
  const add = (gg, hl) => { const a = new T.Mesh(gg, matOf(m.material, hl)); a.matrixAutoUpdate = false; a.matrix.copy(rel); S.add(a); };
  const r = !/^wheel/.test(n.name) && SW ? swSplit(T, geo, rel, SW) : null;
  if (r) { if (r.rest) add(r.rest, 0); add(r.wheel, 1); swTris += r.tris; } else add(geo, 0);
  if (/^wheel/.test(n.name) || m.material.transparent) continue;
  // 方向盤候選：座位前方的連通塊
  const p = geo.attributes.position, nv = p.count, v = new T.Vector3(), P = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) { v.fromBufferAttribute(p, i).applyMatrix4(rel); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
  const idx = geo.index ? geo.index.array : Uint32Array.from({ length: nv }, (_, i) => i);
  const par = new Int32Array(nv).map((_, i) => i), find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let i = 0; i < idx.length; i += 3) { const a = find(idx[i]); par[find(idx[i + 1])] = a; par[find(idx[i + 2])] = a; }
  const bb = new Map();
  for (let i = 0; i < nv; i++) { const k = find(i); let b = bb.get(k); if (!b) bb.set(k, b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9, 0]); for (let j = 0; j < 3; j++) { b[j] = Math.min(b[j], P[i * 3 + j]); b[j + 3] = Math.max(b[j + 3], P[i * 3 + j]); } b[6]++; }
  for (const b of bb.values()) {
    const cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, cz = (b[2] + b[5]) / 2, ex = [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
    if (Math.abs(cx - ST[0]) > .3 || cy < ST[1] + .15 || cy > ST[1] + .8 || cz < ST[2] + .15 || cz > ST[2] + 1) continue;
    if (Math.max(...ex) < .25 || Math.max(...ex) > .5 || b[6] < 20) continue;
    cand.push({ mat: m.material.name, n: b[6], c: [cx, cy, cz].map((x) => +x.toFixed(3)), ex: ex.map((x) => +x.toFixed(3)) });
  }
}
if (SW) {   // 圓圈：外緣
  const n = new T.Vector3(...swAxis(SW)), u = new T.Vector3(1, 0, 0), w = new T.Vector3().crossVectors(n, u), pts = [];
  for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push(new T.Vector3(...SW.c).addScaledVector(u, Math.cos(a) * SW.r).addScaledVector(w, Math.sin(a) * SW.r)); }
  S.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xff2020 })));
}
const grid = (ax, at, c0, c1, half) => {   // ax 這個軸固定在 at；另兩軸以 (c0, c1) 為中心、半寬 half
  const G = new T.Group(), m1 = new T.LineBasicMaterial({ color: 0x50545a }), m2 = new T.LineBasicMaterial({ color: 0x000000 });
  const P = (a, b) => { const v = [0, 0, 0], o = [0, 1, 2].filter((i) => i !== ax); v[ax] = at; v[o[0]] = a; v[o[1]] = b; return new T.Vector3(...v); };
  for (let k = Math.ceil((c0 - half) * 50); k <= (c0 + half) * 50; k++) { const a = k / 50; G.add(new T.Line(new T.BufferGeometry().setFromPoints([P(a, c1 - half), P(a, c1 + half)]), k % 5 ? m1 : m2)); }
  for (let k = Math.ceil((c1 - half) * 50); k <= (c1 + half) * 50; k++) { const b = k / 50; G.add(new T.Line(new T.BufferGeometry().setFromPoints([P(c0 - half, b), P(c0 + half, b)]), k % 5 ? m1 : m2)); }
  S.add(G); return G;
};
const HW = .5, HH = HW * 500 / 800;
const gSide = grid(0, ST[0] - .3, E[1], E[2], .8), gFront = grid(2, ST[2] + 1.05, E[0], E[1], .8), gTop = grid(1, .44, E[0], E[2], .8);
const labels = [];
const view = (x, y, cam, planes, gv, lab) => {
  clip.length = 0; clip.push(...planes);
  for (const G of [gSide, gFront, gTop]) G.visible = G === gv;
  R.setViewport(x, 1000 - y - 500, 800, 500); R.setScissor(x, 1000 - y - 500, 800, 500); R.render(S, cam);
  if (lab) for (const [p, t] of lab) { const v = new T.Vector3(...p).project(cam); labels.push([x + (v.x + 1) / 2 * 800, y + (1 - v.y) / 2 * 500, t]); }
};
const P = (nx, ny, nz, d) => new T.Plane(new T.Vector3(nx, ny, nz), d);
const tick = (f) => { const L = []; for (let k = -6; k <= 6; k++) L.push(...f(k / 10)); return L; };
const sc = new T.OrthographicCamera(-HW, HW, HH, -HH, .01, 20); sc.position.set(ST[0] + 5, E[1], E[2]); sc.lookAt(ST[0], E[1], E[2]);
view(0, 0, sc, [P(-1, 0, 0, ST[0] + .25), P(1, 0, 0, -(ST[0] - .25))], gSide, tick((d) => [[[ST[0], Math.round((E[1] + d) * 10) / 10, E[2] + HW - .03], 'y' + (Math.round((E[1] + d) * 10) / 10).toFixed(1)], [[ST[0], E[1] - HH + .02, Math.round((E[2] + d) * 10) / 10], 'z' + (Math.round((E[2] + d) * 10) / 10).toFixed(1)]]));
const fc = new T.OrthographicCamera(-HW, HW, HH, -HH, .01, 20); fc.position.set(E[0], E[1], ST[2] - 4); fc.lookAt(E[0], E[1], ST[2]);
view(800, 0, fc, [P(0, 0, 1, -(ST[2] + .1)), P(0, 0, -1, ST[2] + 1)], gFront, tick((d) => [[[E[0] + HW - .03, Math.round((E[1] + d) * 10) / 10, ST[2]], 'y' + (Math.round((E[1] + d) * 10) / 10).toFixed(1)], [[Math.round((E[0] + d) * 10) / 10, E[1] - HH + .02, ST[2]], 'x' + (Math.round((E[0] + d) * 10) / 10).toFixed(1)]]));
const tc = new T.OrthographicCamera(-HW, HW, HH, -HH, .01, 20); tc.position.set(E[0], 5, E[2]); tc.up.set(0, 0, 1); tc.lookAt(E[0], 0, E[2]);
view(0, 500, tc, [P(0, -1, 0, 1.15), P(0, 1, 0, -.45)], gTop, tick((d) => [[[Math.round((E[0] + d) * 10) / 10, 1, E[2] - HH + .02], 'x' + (Math.round((E[0] + d) * 10) / 10).toFixed(1)], [[E[0] - HW + .03, 1, Math.round((E[2] + d) * 10) / 10], 'z' + (Math.round((E[2] + d) * 10) / 10).toFixed(1)]]));
const ec = new T.PerspectiveCamera(70, 1.6, .02, 50); ec.position.set(ST[0], ST[1] + .66, ST[2] - .02); ec.lookAt(ST[0], ST[1] + .5, ST[2] + 2);
view(800, 500, ec, [], null, null);
for (const [x, y, t] of labels) document.body.insertAdjacentHTML('beforeend', '<span style="position:absolute;left:' + x + 'px;top:' + y + 'px;transform:translate(-50%,-50%);font:11px monospace;background:#fff9">' + t + '</span>');
cand.sort((a, b) => b.n - a.n);
window.done = JSON.stringify({ seat: ST, look: E, swTris, cand: cand.slice(0, 15) });
</script>`;
const srv = createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end(page); }
  const f = u.startsWith('/three/') ? resolve(three, u.slice(7)) : resolve(repo, u.slice(1));
  if (!existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
}).listen(0);
const browser = await chromium.launch({ headless: true, args: GPU_ARGS, executablePath: chromePath() });
const pg = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
pg.on('pageerror', (e) => console.error(e.message)); pg.on('console', (m) => m.type() !== 'warning' && console.error(m.text()));
await pg.goto(`http://127.0.0.1:${srv.address().port}/`); await pg.waitForFunction(() => window.done, null, { timeout: 60000 });
const r = JSON.parse(await pg.evaluate(() => window.done));
console.log(`座位 ${JSON.stringify(r.seat)}，看 ${JSON.stringify(r.look)}${sw ? `，sw 拆到 ${r.swTris} 個三角形` : ''}`);
for (const c of r.cand) console.log(`  候選 ${c.mat} ${c.n} 頂點 中心 ${JSON.stringify(c.c)} 大小 ${JSON.stringify(c.ex)}`);
await pg.screenshot({ path: out });
console.log(out);
await browser.close(); srv.close();
