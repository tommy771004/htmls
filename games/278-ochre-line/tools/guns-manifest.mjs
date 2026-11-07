#!/usr/bin/env node
// 掃 assets/278/models/guns/，重寫 index.json。開機時先讀它再載模型，沒列到的槍走 state 裡的替身，不會打出 404。
// 掃描是冪等的，多個 agent 同時跑也安全；寫檔走暫存改名，遊戲讀不到半個檔。node tools/guns-manifest.mjs
import { readFileSync, readdirSync, writeFileSync, renameSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), dir = resolve(root, '../../assets/278/models/guns');
mkdirSync(dir, { recursive: true });
// 壞檔或別人烘到一半的檔回傳 null：這把跳過走替身，不能讓整個掃描（和打包）失敗
const readJson = f => { try { const b = readFileSync(f), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); } catch { return null; } };
const out = { guns: {} }, warn = [];
for (const f of readdirSync(dir).sort()) {
  const m = /^([a-z0-9]+)\.glb$/.exec(f); if (!m) continue;
  const id = m[1], J = readJson(resolve(dir, f));
  if (!J?.nodes) { warn.push(`${f} 讀不出來，跳過`); continue; }
  const node = n => J.nodes.find(x => x.name === n), tris = n => { const o = node(n); if (o?.mesh === undefined) return 0; return J.meshes[o.mesh].primitives.reduce((a, p) => a + J.accessors[p.indices].count / 3, 0); };
  const bbox = n => { const o = node(n); if (o?.mesh === undefined) return null; const a = J.meshes[o.mesh].primitives.map(p => J.accessors[p.attributes.POSITION]); return [[0, 1, 2].map(k => Math.min(...a.map(x => x.min[k]))), [0, 1, 2].map(k => Math.max(...a.map(x => x.max[k])))]; };
  const mz = node(id + '_muzzle'), mb = statSync(resolve(dir, f)).size / 1e6, arms = existsSync(resolve(dir, id + '_arms.glb'));
  for (const n of [id, id + '_w']) if (!node(n)) warn.push(`${f} 缺節點 ${n}`);
  if (!mz) warn.push(`${f} 缺節點 ${id}_muzzle`);
  if (!node(id) || !node(id + '_w') || !mz) continue;   // 節點不全就不列，遊戲繼續用替身
  out.guns[id] = { muzzle: mz.translation.map(v => +v.toFixed(4)), arms, mag: tris(id + '_mag') > 0, tris: tris(id) + tris(id + '_mag'), lod: tris(id + '_w'), mb: +mb.toFixed(2), box: bbox(id).map(a => a.map(v => +v.toFixed(3))) };
  if (mb > 1.5) warn.push(`${f} ${mb.toFixed(2)} MB，超過 1.5 MB`);
  if (!arms) warn.push(`${id} 還沒有 ${id}_arms.glb，遊戲裡看不到手`);
}
const tmp = resolve(dir, `.index.${process.pid}.tmp`);
writeFileSync(tmp, JSON.stringify(out, null, 1) + '\n'); renameSync(tmp, resolve(dir, 'index.json'));
console.log(`guns index：${Object.keys(out.guns).join(' ') || '（空）'}`);
for (const w of warn) console.log('  注意 ' + w);
