// 把 models.js 的英雄比例與 A 字綁定姿勢下的骨頭位置輸出成 blender/rig.json。
// Blender 腳本據此擺骨架、建模與刷權重，確保兩邊的骨頭位置一致。改了骨架或比例要重跑：node tools/rig-dump.mjs
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { HERO_IDS, heroSkeleton, bindPose, BIND, BONE_ORDER, BONE_EXTRA, HAND_GEO, TOE_GEO, handScale, footScale } from '../src/models.js';
const out = { bind: BIND, heroes: {} };
const w = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z)).toArray().map((v) => +v.toFixed(5));
for (const id of HERO_IDS) {
  const sk = heroSkeleton(id); bindPose(sk);
  const { d, J, hands } = sk;
  const bones = [];
  const add = (name, head, tail, parent) => bones.push({ name, head, tail, parent });
  // Blender 端的骨段只用來刷權重（JS 綁定用自己的骨架），所以骨盆段往上延伸到腰，讓褲頭跟著 hips
  add('hips', w(J.hips, 0, 0.1, 0), w(J.hips, 0, -0.12, 0), null);
  // 腰段（torso）只到胸骨，胸骨（ribs）再到頭；兩根分攤扭轉
  add('torso', w(J.torso, 0, 0.12, 0), w(J.ribs), 'hips');
  add('head', w(J.head), w(J.head, 0, 0.34, 0), 'neck');
  for (const s of ['L', 'R']) {
    add('sh' + s, w(J['sh' + s]), w(J['el' + s]), 'cl' + s);
    add('el' + s, w(J['el' + s]), w(J['wr' + s]), 'sh' + s);
  }
  for (const s of ['L', 'R']) {
    add('th' + s, w(J['th' + s]), w(J['kn' + s]), 'hips');
    add('kn' + s, w(J['kn' + s]), w(J['kn' + s], 0, -d.shinLen, 0), 'th' + s);
  }
  if (bones.map((b) => b.name).slice(0, BONE_ORDER.length).join() !== BONE_ORDER.join()) throw new Error('骨頭順序與 BONE_ORDER 不一致');
  for (const c of sk.chains) c.segs.forEach((b, i) => add(b.name, w(b), w(b, 0, -c.len, 0), i ? c.segs[i - 1].name : c.parent));
  const tip = (o, dir, len) => o.localToWorld(new THREE.Vector3()).add(dir.clone().multiplyScalar(len)).toArray().map((v) => +v.toFixed(5));
  const k = handScale(d), H = HAND_GEO;
  const fdir = (s) => new THREE.Vector3().subVectors(J['el' + s].localToWorld(new THREE.Vector3()), J['sh' + s].localToWorld(new THREE.Vector3())).normalize();
  const tdir = (s) => { const t = J._thumbDir.clone(); if (s === 'R') t.x = -t.x; return t; };
  const ex = {
    ribs: [w(J.ribs), w(J.neck), 'torso'],
    neck: [w(J.neck), w(J.head), 'ribs'],
    clL: [w(J.clL), w(J.shL), 'ribs'], clR: [w(J.clR), w(J.shR), 'ribs'],
    toL: [w(J.toL), w(J.toL, 0, 0, 0.06), 'anL'], toR: [w(J.toR), w(J.toR, 0, 0, 0.06), 'anR'],
    wrL: [w(J.wrL), w(hands.L, 0, -d.fist * 0.6, 0), 'elL'], wrR: [w(J.wrR), w(hands.R, 0, -d.fist * 0.6, 0), 'elR'],
    anL: [w(J.anL), w(J.anL, 0, 0, d.shin * 2.2), 'knL'], anR: [w(J.anR), w(J.anR, 0, 0, d.shin * 2.2), 'knR'],
  };
  for (const s of ['L', 'R']) {
    ex['fa' + s] = [w(J['fa' + s]), w(J['fb' + s]), 'wr' + s];
    ex['fb' + s] = [w(J['fb' + s]), w(J['fc' + s]), 'fa' + s];
    ex['fc' + s] = [w(J['fc' + s]), tip(J['fc' + s], fdir(s), H.L[2] * k), 'fb' + s];
    ex['tb' + s] = [w(J['tb' + s]), tip(J['tb' + s], tdir(s), (H.thumb.L[0] + H.thumb.L[1]) * k), 'wr' + s];
  }
  for (const n of BONE_EXTRA) add(n, ...ex[n]);
  const pick = ['H', 'L', 'hr', 'sw', 'chest', 'waist', 'arm', 'fore', 'fist', 'thigh', 'shin', 'hip', 'torso', 'upper', 'lower', 'thighLen', 'shinLen', 'skin', 'style', 'saiyan', 'hx', 'neck', 'armK', 'handK'];
  out.heroes[id] = { ...Object.fromEntries(pick.map((q) => [q, d[q]])), bones, hand: { L: w(hands.L), R: w(hands.R) }, rig: 3,
    handGeo: { ...H, k }, toe: { ...TOE_GEO, s: footScale(d), L: w(J.toL), R: w(J.toR) } };
}
writeFileSync(new URL('../blender/rig.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('blender/rig.json', HERO_IDS.join(' '));
