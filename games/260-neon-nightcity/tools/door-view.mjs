// 檢查實車的車門切分（src/doors.mjs，規格在 assets/260/cars.json 的 door）：
//   node tools/door-view.mjs <id> [out.png] [--door='{"p":[[z,y],…],"xi":.55}'] [--ang=62] [--zy=.8]（放大側視的中心高度，高的車調高） [--cab='[…]'|--nocab]（車內改色，src/cabin.mjs）
// 左上：左側正視（正交、10 cm 格線、每 0.5 m 標數字；黃線是門框多邊形，綠色是切到左門的三角形）；
// 右上：俯視（車頭朝下）；下排：兩扇門照 ang 打開的四分之三視角（外側、從車頭斜看車內）。
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
const id = pos[0], out = pos[1] || resolve(root, `.cache/door-${id}.png`);
const spec = JSON.parse(readFileSync(resolve(repo, 'assets/260/cars.json'), 'utf8'))[id];
if (!spec) throw new Error('cars.json 沒有 ' + id);
const door = opt.door ? JSON.parse(opt.door) : spec.door;
const cab = opt.nocab ? null : opt.cab ? JSON.parse(opt.cab) : spec.cab || null;   // 車內重新上色：--cab='[…]' 試規則、--nocab 看原本的顏色
if (!door) throw new Error(id + ' 沒有 door 規格（用 --door= 給）');
const ang = +(opt.ang ?? door.ang ?? 62);
const three = resolve(root, 'node_modules/three');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const page = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#888">
<script type=importmap>{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type=module>
import * as T from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { doorBuild, doorHinge, doorTurn } from '/games/260-neon-nightcity/src/doors.mjs'; import { cabTint, cabBox } from '/games/260-neon-nightcity/src/cabin.mjs';
const CAB = ${JSON.stringify(cab)}, BOX = ${JSON.stringify(cabBox({ ...spec, door: spec.door || door }))};
const ZY = ${+(opt.zy ?? .8)}, D = ${JSON.stringify(door)}, ANG = ${ang} * Math.PI / 180, L = ${spec.len}, H = ${spec.h}, W = ${spec.w};
const R = new T.WebGLRenderer({ antialias: true }); R.setSize(1600, 1500); document.body.appendChild(R.domElement); R.setScissorTest(true);
const S = new T.Scene(); S.background = new T.Color(0x9aa0a8);
S.add(new T.HemisphereLight(0xffffff, 0x444444, 2.4)); const dl = new T.DirectionalLight(0xffffff, 1.6); dl.position.set(3, 5, 4); S.add(dl);
const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/assets/260/${id}.glb');
g.scene.updateMatrixWorld(true);
const car = g.scene.getObjectByName('car'), inv = car.matrixWorld.clone().invert();
const closed = new T.Group(), open = new T.Group(); S.add(closed, open);
const stats = { body: 0, L: 0, R: 0 };
const piv = { 1: new T.Group(), 2: new T.Group() }; open.add(piv[1], piv[2]);
const hinge = { 1: null, 2: null }, pts = {};
const mats = new Map();
const matOf = (src, hl) => { const k = src.uuid + hl; if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ vertexColors: true, map: src.map, emissive: hl ? 0x00ff40 : 0, emissiveIntensity: hl ? .55 : 0, roughness: .6, transparent: src.transparent, opacity: src.transparent ? .35 : 1, side: T.DoubleSide, depthWrite: !src.transparent })); return mats.get(k); };
const meshes = []; car.traverse((o) => { if (o.isMesh) meshes.push(o); });
for (const m of meshes) {
  let n = m; while (n.parent && n.parent !== car) n = n.parent;
  const geo = m.geometry, rel = new T.Matrix4().multiplyMatrices(inv, m.matrixWorld);
  if (CAB && !/^wheel/.test(n.name)) cabTint(geo, rel, CAB, BOX, !!m.material.map, !!m.material.transparent);   // 車內重新上色（src/cabin.mjs）
  const c = geo.attributes.color, nc = new Float32Array(c.count * 3); for (let i = 0; i < c.count; i++) { nc[i * 3] = c.getX(i); nc[i * 3 + 1] = c.getY(i); nc[i * 3 + 2] = c.getZ(i); }
  geo.setAttribute('color', new T.BufferAttribute(nc, 3));
  if (/^wheel/.test(n.name)) { for (const grp of [closed, open]) { const o = new T.Mesh(geo, matOf(m.material, 0)); o.matrixAutoUpdate = false; o.matrix.copy(rel); grp.add(o); } continue; }
  const dbg = [], r = doorBuild(T, geo, rel, D, dbg); for (const d of dbg) (window.dbg ||= []).push({ mat: m.material.name + (m.material.transparent ? '/T' : ''), ...d });
  const parts = r ? r.parts : [[geo], [], []];
  if (r) for (const s of [1, 2]) (pts[s] ||= []).push(...r.pts[s]);
  parts.forEach((list, s) => { for (const gg of list) {
    gg.computeBoundingSphere(); const ix = gg.index ? gg.index.count : gg.attributes.position.count; stats[['body', 'L', 'R'][s]] += ix / 3;
    const a = new T.Mesh(gg, matOf(m.material, s)); a.matrixAutoUpdate = false; a.matrix.copy(rel); closed.add(a);
    const b = new T.Mesh(gg, matOf(m.material, 0)); b.matrixAutoUpdate = false; b.matrix.copy(rel);
    if (s) { b.userData.s = s; (open.userData.d ||= []).push(b); } else open.add(b);
  } });
}
for (const s of [1, 2]) if (pts[s] && pts[s].length) hinge[s] = doorHinge(pts[s], s, D);
for (const s of [1, 2]) if (hinge[s]) {
  const h = hinge[s];
  const tu = doorTurn(D, s); piv[s].position.set(h.x, h.y, h.z); piv[s].quaternion.setFromAxisAngle(new T.Vector3(...tu.ax), tu.sg * ANG);   // 左門（+x）往外開：門的後緣往 +x（蝴蝶門繞 axis 往上掀）
}
for (const b of open.userData.d || []) { const h = hinge[b.userData.s]; b.matrix.premultiply(new T.Matrix4().makeTranslation(-h.x, -h.y, -h.z)); piv[b.userData.s].add(b); }
// 格線與門框
const gridM = new T.LineBasicMaterial({ color: 0x30343a }), gridM2 = new T.LineBasicMaterial({ color: 0x000000 }), polyM = new T.LineBasicMaterial({ color: 0xffee00 });
const gx = W / 2 + .5, side = new T.Group(); S.add(side);
for (let z = -3; z <= 3.001; z += .1) { const k = Math.abs(z * 2 - Math.round(z * 2)) < .01; side.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(gx, 0, z), new T.Vector3(gx, 2, z)]), k ? gridM2 : gridM)); }
for (let y = 0; y <= 2.001; y += .1) { const k = Math.abs(y * 2 - Math.round(y * 2)) < .01; side.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(gx, y, -3), new T.Vector3(gx, y, 3)]), k ? gridM2 : gridM)); }
for (const P of D.ps || [D.p]) side.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(P.map(([z, y]) => new T.Vector3(W / 2 + .3, y, z))), polyM));
const ctx = document.createElement('canvas'); ctx.width = 800; ctx.height = 500;
// 四個視角
const view = (x, y, w, h, cam, grp) => { closed.visible = grp === closed; open.visible = grp === open; side.visible = grp === closed && cam.isOrthographicCamera && cam.position.x > 5; R.setViewport(x, 1500 - y - h, w, h); R.setScissor(x, 1500 - y - h, w, h); R.render(S, cam); };
const zoom = 1.35, oc = new T.OrthographicCamera(-L / 2 * zoom, L / 2 * zoom, L / 2 * zoom * 500 / 800, -L / 2 * zoom * 500 / 800, .1, 50);
oc.position.set(10, H / 2, 0); oc.lookAt(0, H / 2, 0); view(0, 0, 800, 500, oc, closed);
const tc = new T.OrthographicCamera(-L / 2 * zoom, L / 2 * zoom, L / 2 * zoom * 500 / 800, -L / 2 * zoom * 500 / 800, .1, 50); tc.position.set(0, 10, 0); tc.up.set(0, 0, -1); tc.lookAt(0, 0, 0); view(800, 0, 800, 500, tc, closed);
const p1 = new T.PerspectiveCamera(38, 1.6, .05, 100); p1.position.set(L * .75, 1.7, L * .55); p1.lookAt(0, H * .45, 0); view(0, 1000, 800, 500, p1, open);
const p2 = new T.PerspectiveCamera(42, 1.6, .05, 100); p2.position.set(W * .95, 1.45, L * .05 - .6); p2.lookAt(-W * .1, H * .5, .15); view(800, 1000, 800, 500, p2, open);
// 放大的側視：門框附近 2.4 × 1.5 m，原色（看真正的門縫）
{ let z0 = 1e9, z1 = -1e9; for (const P of D.ps || [D.p]) for (const [z] of P) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } const zc = (z0 + z1) / 2, hw = 1.2, hh = .75;
  const zc2 = new T.OrthographicCamera(-hw, hw, hh, -hh, .1, 50); zc2.position.set(10, ZY, zc); zc2.lookAt(0, ZY, zc);
  for (const o of closed.children) o.userData.m0 = o.material;
  for (const o of closed.children) if (o.material.emissiveIntensity > 0) o.material = matOf(o.material.map ? { uuid: o.material.uuid + 'n', map: o.material.map, transparent: o.material.transparent } : { uuid: o.material.uuid + 'n', transparent: o.material.transparent }, 0);
  view(0, 500, 1600, 500, zc2, closed); window.zc = [zc, hw, hh]; }
window.done = JSON.stringify({ stats, hinge, dbg: (window.dbg || []).sort((a, b) => b.n - a.n).slice(0, 40) });
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
const pg = await browser.newPage({ viewport: { width: 1600, height: 1500 } });
pg.on('pageerror', (e) => console.error(e.message)); pg.on('console', (m) => m.type() !== 'warning' && console.error(m.text()));
await pg.goto(url); await pg.waitForFunction(() => window.done, null, { timeout: 60000 });
console.log(await pg.evaluate(() => window.done));
// 側視格線的數字：z 每 0.5 m、y 每 0.5 m（左上那格；畫面右邊是車尾 −z）
await pg.evaluate(({ L, H, ZY }) => {
  const zoom = 1.35, hw = L / 2 * zoom, hh = hw * 500 / 800, el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:0;top:0;width:800px;height:500px;pointer-events:none;font:11px monospace;color:#000';
  for (let z = -2.5; z <= 2.51; z += .5) { const x = (-z + hw) / (2 * hw) * 800; if (x > 0 && x < 800) el.insertAdjacentHTML('beforeend', `<span style="position:absolute;left:${x + 2}px;top:2px">${z.toFixed(1)}</span>`); }
  for (let y = 0; y <= 2.01; y += .5) { const py = (hh - (y - H / 2)) / (2 * hh) * 500; if (py > 0 && py < 500) el.insertAdjacentHTML('beforeend', `<span style="position:absolute;left:2px;top:${py - 12}px">${y.toFixed(1)}</span>`); }
  const [zc, zw, zh] = window.zc;
  for (let z = Math.ceil((zc - zw) * 10) / 10; z <= zc + zw; z += .1) { const x = (-(z - zc) + zw) / (2 * zw) * 1600; el.insertAdjacentHTML('beforeend', `<span style="position:absolute;left:${x + 2}px;top:${502}px;background:#fff8">${z.toFixed(1)}</span>`); }
  for (let y = Math.round((ZY - .7) * 10) / 10; y <= ZY + .7; y += .1) { const py = 500 + (zh - (y - ZY)) / (2 * zh) * 500; el.insertAdjacentHTML('beforeend', `<span style="position:absolute;left:2px;top:${py - 12}px;background:#fff8">${y.toFixed(1)}</span>`); }
  document.body.appendChild(el);
}, { L: spec.len, H: spec.h, ZY: +(opt.zy ?? .8) });
await pg.screenshot({ path: out });
console.log(out);
await browser.close(); srv.close();
