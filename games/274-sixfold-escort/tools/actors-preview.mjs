// 人物預覽：只打包 src/view/chars.js、weapons.js 的小頁面，內嵌 actors.glb，排一列各預設＋出招特寫，
// 用 Metal WebGPU 與 SwiftShader WebGL2 兩種後端截圖到 dist/actors-*.png，並檢查 console error／pageerror。
//   node tools/actors-preview.mjs            # 兩種後端全部鏡頭
//   node tools/actors-preview.mjs --only=gpu # 只跑 Metal
//   node tools/actors-preview.mjs --shots=lineup,close
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
mkdirSync(dist, { recursive: true });
const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const only = arg('only', '');
const shots = arg('shots', 'lineup,back,close,weapons').split(',');

const page = String.raw`
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { loadActors, createActor } from './chars.js';
import { makeWeapon, makeCase, makeStowed, WEAPON_TYPES } from './weapons.js';

const q = new URLSearchParams(location.search);
const shot = q.get('shot') || 'lineup';
window.__sf = { ready: false, shot };
const canvas = document.querySelector('canvas');
let renderer;
for (const gl of q.get('gl') ? [true] : [false, true]) {
  try {
    renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL: gl });
    await renderer.init();
    break;
  } catch (e) { renderer = null; }
}
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
window.__sf.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8f8a80);
scene.fog = new THREE.Fog(0x8f8a80, 14, 30);
scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x5a4a3a, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
sun.position.set(-4, 7, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -2, near: 0.5, far: 30 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x7a6e5e, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 80);
await loadActors();

const actors = [];
function add(look, x, anim, { weapon = null, t = 0.5, z = 0, ry = 0 } = {}) {
  const a = createActor(look);
  a.root.position.set(x, 0, z);
  a.root.rotation.y = Math.PI + ry; // 面向 +Z（鏡頭）
  scene.add(a.root);
  a.drawWeapon(weapon);
  a.play(anim, { fade: 0 });
  a.update(t);
  actors.push(a);
  return a;
}

if (shot === 'lineup' || shot === 'back') {
  const L = [
    [{ preset: 'escort', gender: 'Male', palette: 'indigo', hair: 0 }, 'idle', {}],
    [{ preset: 'escort', gender: 'Female', palette: 'ochre', hair: 0 }, 'ready', { weapon: 'SWORD' }],
    [{ preset: 'chief', gender: 'Male', hair: 0, height: 1.02 }, 'idle', {}],
    [{ preset: 'herbalist', gender: 'Female', palette: 'moon', hair: 1 }, 'idle', {}],
    [{ preset: 'smith', gender: 'Male', hair: 1, build: 1.08 }, 'idle', {}],
    [{ preset: 'vendor', gender: 'Male', hair: 1 }, 'sit', {}],
    [{ preset: 'bandit', gender: 'Male', hair: 0 }, 'ready', { weapon: 'BLADE' }],
    [{ preset: 'escort', gender: 'Male', palette: 'pine', hair: 0 }, 'ready', { weapon: 'SPEAR' }],
    [{ preset: 'escort', gender: 'Female', palette: 'moon', hair: 1 }, 'idle', { weapon: 'BOW' }],
    [{ preset: 'clerk', gender: 'Male', hair: 1, height: 0.96 }, 'idle', {}],
  ];
  const n = L.length;
  L.forEach(([look, anim, o], i) => add(look, (i - (n - 1) / 2) * 0.95, anim, o));
  // 攤販坐的板凳
  const stool = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.34), new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.8 }));
  stool.position.set((5 - (n - 1) / 2) * 0.95, 0.22, 0.12);
  stool.castShadow = stool.receiveShadow = true;
  scene.add(stool);
  if (shot === 'back') {
    for (const a of actors) a.root.rotation.y += Math.PI;
    camera.position.set(0, 1.5, 11.5);
    camera.lookAt(0, 0.95, 0);
  } else {
    camera.position.set(0, 1.45, 11.5);
    camera.lookAt(0, 0.95, 0);
  }
} else if (shot === 'close') {
  const a = add({ preset: 'escort', gender: 'Male', palette: 'indigo', hair: 0 }, 0, 'slash', { weapon: 'BLADE', t: Number(q.get('t') || 0.45), ry: Number(q.get('ry') || 0.6) });
  const b = add({ preset: 'escort', gender: 'Female', palette: 'ochre', hair: 0 }, 1.05, 'ready', { ry: 0.7, t: 0.2 });
  camera.position.set(0.9, 1.45, 3.1);
  camera.lookAt(0.35, 1.15, 0);
} else if (shot === 'portrait') {
  add({ preset: q.get('preset') || 'escort', gender: q.get('g') || 'Male', palette: q.get('pal') || 'indigo', hair: Number(q.get('hair') || 0) }, 0, q.get('anim') || 'idle', { weapon: q.get('w') || null, ry: Number(q.get('ry') || 0), t: Number(q.get('t') || 0.5) });
  if (q.get('tilt')) actors[0].handR.rotateX(Number(q.get('tilt')));
  if (q.get('roll')) actors[0].handR.rotateY(Number(q.get('roll')));
  const zoom = Number(q.get('zoom') || 1);
  camera.position.set(0, 1.3, 4.2 / zoom);
  camera.lookAt(0, Number(q.get('ly') || 1.0), 0);
} else if (shot === 'weapons') {
  scene.background = new THREE.Color(0x6f6a62);
  scene.fog = null;
  // 每件兵器：刃面朝鏡頭（兵器 X 軸朝 +Z），長軸橫放（Y → +X）
  const lay = (w, x, y, s = 1, flip = false) => {
    const outer = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = flip ? Math.PI : -Math.PI / 2;
    inner.add(w);
    outer.add(inner);
    outer.rotation.z = -Math.PI / 2;
    outer.position.set(x, y, 0);
    outer.scale.setScalar(s);
    scene.add(outer);
  };
  lay(makeWeapon('SWORD'), -0.55, 1.75);
  lay(makeWeapon('BLADE'), -0.55, 1.5);
  lay(makeWeapon('SPEAR'), -1.0, 0.2, 0.75);
  lay(makeWeapon('BOW'), -0.95, 1.05);
  lay(makeWeapon('FIST'), -0.25, 0.55, 3);
  lay(makeWeapon('THROWN'), 0.15, 0.55, 3);
  for (const [x, ry] of [[0.85, Math.PI * 0.82], [1.4, 0.3]]) {
    const c = makeCase();
    for (const t of WEAPON_TYPES) c.add(makeStowed(t));
    c.position.set(x, 1.0, -0.2);
    c.rotation.y = ry;
    scene.add(c);
  }
  camera.fov = 34;
  camera.position.set(0.2, 1.05, 3.6);
  camera.lookAt(0.2, 1.0, 0);
}
// 自我檢查：once 動作播完要回到之前的循環
{
  const t = createActor({ preset: 'escort' });
  t.play('idle');
  t.play('slash');
  for (let i = 0; i < 150; i++) t.update(1 / 30);
  window.__sf.onceOk = t.curName === 'idle' && !t.curOnce;
  t.dispose();
}
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();

let frames = 0;
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
  if (++frames === 4) window.__sf.ready = true;
});
`;

const res = await build({
  stdin: { contents: page, resolveDir: resolve(root, 'src/view'), loader: 'js', sourcefile: 'actors-preview-entry.js' },
  bundle: true, format: 'esm', target: 'es2022', write: false, logLevel: 'warning', minify: false,
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const glb = gzipSync(readFileSync(resolve(root, 'blender/out/actors.glb')), { level: 9 }).toString('base64');
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>六器鏢行 人物預覽</title><style>html,body{margin:0;height:100%;overflow:hidden;background:#8f8a80}canvas{display:block;width:100vw;height:100vh}</style></head>
<body><canvas></canvas><script type="application/octet-stream" id="glb-actors">${glb}</script><script type="module">${js}</script></body></html>`;
const file = resolve(dist, 'actors-preview.html');
writeFileSync(file, html);
console.log(`預覽頁 ${file}（glb gzip ${(glb.length * 0.75 / 1024).toFixed(0)} KB）`);

const backends = [['gpu', false], ['soft', true]].filter(([k]) => !only || only === k);
let bad = 0;
for (const [tag, soft] of backends) {
  for (const s of shots) {
    const extra = arg('q', '');
    const w = s === 'close' || s === 'weapons' || s === 'portrait' ? 1200 : 1600;
    const h = s === 'close' || s === 'weapons' || s === 'portrait' ? 900 : 700;
    const t0 = Date.now();
    const { browser, page: pg, log } = await open(file, { w, h, soft, query: `?shot=${s}${soft ? '&gl=1' : ''}${extra ? '&' + extra : ''}` });
    await raf(pg);
    const be = await pg.evaluate(() => window.__sf.backend);
    const onceOk = await pg.evaluate(() => window.__sf.onceOk);
    if (!onceOk) { bad++; console.error('once 動作沒有回到循環'); }
    const out = resolve(dist, `actors-${s}-${tag}.png`);
    await pg.screenshot({ path: out });
    await browser.close();
    const errs = [...log.errors, ...log.pageerrors];
    bad += errs.length;
    console.log(`${tag} ${s}: ${be}/${log.gpu} ${Date.now() - t0}ms → ${out}${errs.length ? `\n  錯誤 ${errs.length}：\n  ` + errs.slice(0, 6).join('\n  ') : ''}${log.warns.length ? `\n  警告 ${log.warns.length}：${log.warns.slice(0, 3).join(' | ')}` : ''}`);
  }
}
if (bad) {
  console.error(`console error／pageerror 共 ${bad} 筆`);
  process.exit(1);
}
console.log('console error／pageerror：0');
