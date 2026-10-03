// 從 Quaternius 的 Universal Animation Library（CC0）挑出 NPC 用得到的動畫，存成 assets/197/models/q/npc_anims.glb。
//
//   node tools/build-anims.mjs
//
// 來源是不含 root motion 的 UAL1_Standard.glb（角色原地動，位移由遊戲自己推），
// 只留骨架節點與動畫，網格與材質全部拿掉；縮放與骨盆以外的位移軌拿掉，重複的關鍵影格合併。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { prune, resample } from '@gltf-transform/functions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, '.cache/ual/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const out = path.resolve(root, '../../assets/197/models/q/npc_anims.glb');
const KEEP = ['Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop'];
// 位移只有骨盆需要（上下起伏、坐下）；其他骨頭的長度不變，縮放也都是 1
const MOVING = new Set(['pelvis']);

const io = new NodeIO();
const doc = await io.read(src);
const docRoot = doc.getRoot();
// 只 dispose 動畫的話 sampler 還留著、繼續引用資料，prune 收不掉；先拆 sampler（時間軸 accessor 是共用的，交給 prune）
const drop = (ch) => {
  const sampler = ch.getSampler();
  ch.dispose();
  sampler?.dispose();
};
for (const anim of docRoot.listAnimations()) {
  const keep = KEEP.includes(anim.getName());
  for (const ch of anim.listChannels()) {
    const p = ch.getTargetPath();
    if (!keep || p === 'scale' || (p === 'translation' && !MOVING.has(ch.getTargetNode()?.getName()))) drop(ch);
  }
  if (!keep) anim.dispose();
}
for (const node of docRoot.listNodes()) {
  node.setMesh(null).setSkin(null);
}
for (const mesh of docRoot.listMeshes()) mesh.dispose();
await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }));
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
const names = docRoot.listAnimations().map((a) => a.getName());
console.log(`ok    npc_anims.glb  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  ${names.join(', ')}`);
const missing = KEEP.filter((n) => !names.includes(n));
if (missing.length) throw new Error('找不到動畫：' + missing.join(', '));
