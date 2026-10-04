// 把 models.js 的英雄比例與 A 字綁定姿勢下的骨頭位置輸出成 blender/rig.json。
// Blender 腳本據此擺骨架、建模與刷權重，確保兩邊的骨頭位置一致。改了骨架或比例要重跑：node tools/rig-dump.mjs
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { HERO_IDS, heroSkeleton, bindPose, BIND, BONE_ORDER } from '../src/models.js';
const out = { bind: BIND, heroes: {} };
const w = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z)).toArray().map((v) => +v.toFixed(5));
for (const id of HERO_IDS) {
  const sk = heroSkeleton(id); bindPose(sk);
  const { d, J, hands } = sk;
  const bones = [];
  const add = (name, head, tail, parent) => bones.push({ name, head, tail, parent });
  // Blender 端的骨段只用來刷權重（JS 綁定用自己的骨架），所以骨盆段往上延伸到腰，讓褲頭跟著 hips
  add('hips', w(J.hips, 0, 0.1, 0), w(J.hips, 0, -0.12, 0), null);
  add('torso', w(J.torso, 0, 0.12, 0), w(J.head), 'hips');
  add('head', w(J.head), w(J.head, 0, 0.34, 0), 'torso');
  for (const s of ['L', 'R']) {
    add('sh' + s, w(J['sh' + s]), w(J['el' + s]), 'torso');
    add('el' + s, w(J['el' + s]), w(hands[s], 0, -d.fist * 0.6, 0), 'sh' + s);
  }
  for (const s of ['L', 'R']) {
    add('th' + s, w(J['th' + s]), w(J['kn' + s]), 'hips');
    add('kn' + s, w(J['kn' + s]), w(J['kn' + s], 0, -d.shinLen, 0), 'th' + s);
  }
  if (bones.map((b) => b.name).slice(0, BONE_ORDER.length).join() !== BONE_ORDER.join()) throw new Error('骨頭順序與 BONE_ORDER 不一致');
  for (const c of sk.chains) c.segs.forEach((b, i) => add(b.name, w(b), w(b, 0, -c.len, 0), i ? c.segs[i - 1].name : c.parent));
  const pick = ['H', 'L', 'hr', 'sw', 'chest', 'waist', 'arm', 'fore', 'fist', 'thigh', 'shin', 'hip', 'torso', 'upper', 'lower', 'thighLen', 'shinLen', 'skin', 'style', 'saiyan', 'hx', 'neck'];
  out.heroes[id] = { ...Object.fromEntries(pick.map((k) => [k, d[k]])), bones, hand: { L: w(hands.L), R: w(hands.R) } };
}
writeFileSync(new URL('../blender/rig.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('blender/rig.json', HERO_IDS.join(' '));
