// 開發用角色檢視頁（不進成品）：node tools/viewer.mjs 打包並截圖。
// URL 參數：ids=goku,vegeta、anim=idle、t=0.4、ang=0（度）、zoom=1、form=ssj、y=0.9（鏡頭看向的高度）、
// focus=handL｜handR｜head（對準第一名角色的部位）＋fy（高度偏移）、nool=1（隱藏外框，查外框殼的問題）
import * as THREE from 'three';
import { buildHero, HERO_IDS } from '../src/models.js';
const q = new URLSearchParams(location.search);
const ids = (q.get('ids') || HERO_IDS.join(',')).split(',');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xb9ad94);
const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd8c8a4 }));
floor.receiveShadow = true; scene.add(floor);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4a3a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(6, 10, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); scene.add(sun);
const cam = new THREE.PerspectiveCamera(22, innerWidth / innerHeight, 0.1, 100);
const rigs = ids.map((id, i) => {
  const r = buildHero(id, i % 2); r.root.position.x = (i - (ids.length - 1) / 2) * 1.25; scene.add(r.root);
  if (q.get('form')) r.setForm(q.get('form'));
  return r;
});
if (q.get('nool')) for (const r of rigs) r.root.traverse((o) => { if (o.material && o.material.side === THREE.BackSide) o.visible = false; });
const anim = q.get('anim') || 'idle', t = +(q.get('t') || 0.4), ang = (+(q.get('ang') || 0) * Math.PI) / 180;
for (const r of rigs) r.root.rotation.y = ang;
for (let i = 0; i < 40; i++) for (const r of rigs) r.update(1 / 60, { name: anim, t: anim === 'idle' ? 0 : Math.min(t, (i / 39) * t), k: 0.5 });
const zoom = +(q.get('zoom') || 1), y = +(q.get('y') || 0.95);
const width = ids.length * 1.25 + 0.4;
const dist = (Math.max(width / (innerWidth / innerHeight), 2.3) / zoom) / (2 * Math.tan((22 * Math.PI) / 360));
const tgt = new THREE.Vector3(0, y, 0);
const focus = q.get('focus'); // handL｜handR｜head：對準第一名角色的該部位
if (focus) { rigs[0].root.updateMatrixWorld(true); rigs[0][focus].getWorldPosition(tgt); tgt.y += +(q.get('fy') || 0); }
cam.position.set(tgt.x, tgt.y + dist * 0.08, tgt.z + dist); cam.lookAt(tgt);
renderer.render(scene, cam);
window.__v = { ready: true };
