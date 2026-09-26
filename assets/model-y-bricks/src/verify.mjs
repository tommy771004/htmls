// 驗證 .ldr 模型：零件與顏色是否現行、接點是否合法、零件間有無碰撞、每一步能否實際裝上、重心是否落在輪胎支撐範圍內。
// 用法：LDRAW_DIR=... node verify.mjs ../model-y.ldr [--out ../verify-report]
import fs from 'node:fs';
import path from 'node:path';
import { parseModel } from './ldr.mjs';
import { checkCoverage } from './parts.mjs';
import { loadFile } from './ldraw.mjs';
import { worldPart, findConnections, findCollisions, insertion, add, sub, scale, dot, r3, EPS } from './geom.mjs';

const args = process.argv.slice(2);
const inFile = args[0];
const outBase = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const HERE = path.dirname(new URL(import.meta.url).pathname);
const model = parseModel(inFile);
const P = model.parts;
const problems = [];
const W = P.map((p, i) => worldPart(p, i));
for (const w of W) if (!w.pure) problems.push({ kind: 'matrix', part: w.idx, msg: '變換矩陣不是純旋轉' });

// ---------- 1. 零件與顏色 ----------
// 與設計程式相同的門檻：2024 年以後至少出現在 2 個官方套組
const MIN_SETS = 2;
let avail = null;
const availFile = path.join(HERE, '..', 'availability.json');
if (fs.existsSync(availFile)) avail = JSON.parse(fs.readFileSync(availFile, 'utf8'));
const catalogChecks = [];
const seenCombo = new Map();
for (const w of W) {
  const key = w.id + '|' + w.color;
  if (seenCombo.has(key)) { seenCombo.get(key).qty++; continue; }
  const title = loadFile(w.g.file).title;
  const rec = { id: w.id, file: w.g.file, color: w.color, qty: 1, ldrawTitle: title, ok: true, notes: [] };
  if (/^~Moved|^~Obsolete|\(Obsolete\)/i.test(title)) { rec.ok = false; rec.notes.push('LDraw 標記為已搬移或淘汰'); }
  if (avail) {
    const a = avail.combos[key];
    if (!a) { rec.ok = false; rec.notes.push('沒有現行供貨紀錄'); }
    else { rec.sets = a.sets; rec.lastYear = a.lastYear; rec.example = a.example; if (a.sets < MIN_SETS) { rec.ok = false; rec.notes.push(`2024 年後只出現在 ${a.sets} 個套組（門檻 ${MIN_SETS}）`); } }
  } else rec.notes.push('尚未產生 availability.json');
  seenCombo.set(key, rec); catalogChecks.push(rec);
}
for (const r of catalogChecks) if (!r.ok) problems.push({ kind: 'catalog', msg: `${r.id} 顏色 ${r.color}：${r.notes.join('、')}` });

// ---------- 2. 碰撞體覆蓋檢查 ----------
const coverage = [...new Set(W.map((w) => w.g.file))].map((f) => ({ file: f, ...checkCoverage(f) }));
for (const c of coverage) if (c.miss) problems.push({ kind: 'coverage', msg: `${c.file} 的碰撞體沒有包住 ${c.miss} 個網格取樣點` });

// ---------- 3. 接點 ----------
const CN = findConnections(W);
problems.push(...CN.problems);
const { studConns, techConns } = CN;

// ---------- 4. 碰撞 ----------
const collisions = findCollisions(W, CN);
for (const c of collisions) problems.push({ kind: 'collision', msg: `零件 ${c.a}（${W[c.a].id}）與零件 ${c.b}（${W[c.b].id}）${c.what}重疊 ${c.depth} LDU` });

// ---------- 5. 連通性 ----------
const adj = W.map(() => new Set());
for (const c of studConns) { adj[c.a].add(c.b); adj[c.b].add(c.a); }
for (const c of techConns) if (c.ok) { adj[c.a].add(c.b); adj[c.b].add(c.a); }
const comp = W.map(() => -1); let nComp = 0;
for (let i = 0; i < W.length; i++) {
  if (comp[i] >= 0) continue;
  const st = [i]; comp[i] = nComp;
  while (st.length) { const u = st.pop(); for (const v of adj[u]) if (comp[v] < 0) { comp[v] = nComp; st.push(v); } }
  nComp++;
}
if (nComp > 1) problems.push({ kind: 'connectivity', msg: `模型分成 ${nComp} 塊沒有相連` });
W.forEach((w) => { if (adj[w.idx].size === 0) problems.push({ kind: 'connectivity', msg: `零件 ${w.idx}（${w.id}）沒有任何接點` }); });

// ---------- 6. 逐步組裝 ----------
// 依檔案順序一個一個放。每個零件必須接到已放好的零件；所有接點要求的插入方向必須一致；
// 從遠處沿插入方向移到定位的整段路徑上，不能撞到已放好的零件或其凸點。
const placed = new Set();
const stepResults = model.steps.map((st, i) => ({ step: i + 1, title: st.title, parts: st.parts.length, ok: true, issues: [], insert: {} }));
for (const w of W) {
  const sr = stepResults[w.step];
  if (placed.size === 0) { placed.add(w.idx); continue; }
  const r = insertion(W, CN, w, placed);
  if (r.dir) { const k = r3(r.dir).join(','); sr.insert[k] = (sr.insert[k] || 0) + 1; }
  if (!r.ok) {
    sr.ok = false; sr.issues.push(`零件 ${w.idx}（${w.id}）${r.msg}`);
    problems.push({ kind: 'buildability', msg: `步驟 ${w.step + 1}：零件 ${w.idx}（${w.id}）${r.msg}` });
  }
  placed.add(w.idx);
}

// ---------- 7. 落地、重心與支撐範圍 ----------
// 質量：有 BrickLink 重量（weights.json，公克）就用，否則用碰撞體體積 × 0.45 填充率 × ABS 密度 1.05 g/cm³ 估計
let weights = {};
const wFile = path.join(HERE, '..', 'weights.json');
if (fs.existsSync(wFile)) weights = JSON.parse(fs.readFileSync(wFile, 'utf8'));
const LDU_CM = 0.04;
function pieceVolume(pc) { const d = sub(pc.hi, pc.lo); return d[0] * d[1] * d[2]; }
let M = 0; const C = [0, 0, 0]; let weightSource = 'bricklink';
for (const w of W) {
  let g = weights[w.id];
  if (g == null) { weightSource = weights && Object.keys(weights).length ? 'mixed' : 'estimate'; g = w.pieces.reduce((s, pc) => s + pieceVolume(pc), 0) * LDU_CM ** 3 * 0.45 * 1.05; }
  const ctr = scale(add(w.lo, w.hi), 0.5);
  M += g; for (let k = 0; k < 3; k++) C[k] += ctr[k] * g;
}
for (let k = 0; k < 3; k++) C[k] /= M;
const wheels = W.filter((w) => w.id === '72206p01');
const groundY = Math.max(...W.map((w) => w.hi[1]));
const contacts = [];
for (const w of wheels) {
  // 輪胎接地線：輪軸正下方、跨輪胎寬度的一段
  const ax = w.tech.find((t) => t.kind === 'pinhole').axis;
  const ctr = scale(add(w.lo, w.hi), 0.5);
  const halfW = Math.abs(dot(sub(w.hi, w.lo), ax)) / 2;
  contacts.push(add([ctr[0], groundY, ctr[2]], scale(ax, halfW)), add([ctr[0], groundY, ctr[2]], scale(ax, -halfW)));
}
const nonWheelLow = Math.max(...W.filter((w) => w.id !== '72206p01').map((w) => w.hi[1]));
const clearance = +(groundY - nonWheelLow).toFixed(2);
if (clearance <= 0) problems.push({ kind: 'ground', msg: '除了輪胎之外還有零件碰到地面' });
const wheelsOnGround = wheels.filter((w) => Math.abs(w.hi[1] - groundY) < 0.5).length;
// 真實網格的接地高度（碰撞體是外接多邊形，會比網格略低）
const hull = hull2dXZ(contacts.map((p) => [p[0], p[2]]));
const cg = [C[0], C[2]];
const margin = pointHullMargin(cg, hull);
if (!(margin > 0)) problems.push({ kind: 'balance', msg: '重心投影不在輪胎支撐範圍內' });
function hull2dXZ(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of s) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function pointHullMargin(p, h) {
  if (h.length < 3) return -Infinity;
  let m = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const e = [b[0] - a[0], b[1] - a[1]]; const L = Math.hypot(e[0], e[1]);
    const d = ((p[0] - a[0]) * e[1] - (p[1] - a[1]) * e[0]) / L; // 逆時針外殼：內側為負
    m = Math.min(m, -d);
  }
  return m;
}

// ---------- 外露凸點 ----------
// 沒插進凸點孔的朝上凸點：往正上方看不到任何零件的算「外露」（外觀看得到），其餘在車廂內部
const unmated = [];
W.forEach((w) => w.studs.forEach((st, k) => { if (!CN.studMate[w.idx][k]) unmated.push({ w, st }); }));
const exposed = unmated.filter(({ w, st }) => {
  if (st.up[1] > -0.5) return true;
  return !W.some((v) => v.idx !== w.idx && v.pieces.some((pc) => st.p[0] > pc.lo[0] && st.p[0] < pc.hi[0] && st.p[2] > pc.lo[2] && st.p[2] < pc.hi[2] && pc.hi[1] <= st.p[1] + 0.01));
});
const exemptPairs = techConns.filter((c) => c.ok).map((c) => ({ a: c.a, aId: W[c.a].id, b: c.b, bId: W[c.b].id, kind: c.kind, overlap: c.overlap }));

// ---------- 報告 ----------
const byKind = (k) => problems.filter((p) => p.kind === k).length;
const report = {
  model: path.basename(inFile),
  generated: new Date().toISOString(),
  method: {
    unit: '單位 LDU（LDraw Unit，1 LDU = 0.4 mm；凸點間距 20、磚高 24、薄板高 8）',
    contactTolerance: `接觸容差 ${EPS} LDU：兩個碰撞體重疊深度在此以內視為貼合（真實零件每邊約有 0.1 mm 公差）`,
    collision: '每個零件用保守凸體（包圍盒或側面輪廓凸包；複雜零件手工定義）表示，覆蓋檢查確認凸體包住 LDraw 真實網格每個取樣點；兩兩以分離軸定理計算重疊深度',
    studs: '凸點位置從 LDraw 網格中的 stud 原始檔讀出；凸點孔為零件底面每一格中心。凸點與凸點孔位置一致且方向相對才算接上；沒接上的凸點視為 12×12×4 LDU 的方塊參與碰撞',
    technic: '軸插軸孔、銷插銷孔需同軸（偏差 < 0.1 LDU）且插入長度 ≥ 較短一方的 80%；互相插接的兩個零件之間以此規則取代體積碰撞',
    build: '依 .ldr 順序逐一放入；每個零件至少接到一個已放好的零件，所有接點的插入方向一致，並沿該方向以 2 LDU 間距取樣整段路徑不得碰撞',
    balance: '重心投影到地面，需落在四個輪胎接地線圍成的凸包內（汽車沒有腳掌，以輪胎接地範圍作為支撐範圍）',
  },
  summary: {
    parts: W.length,
    uniqueParts: new Set(W.map((w) => w.id)).size,
    lots: catalogChecks.length,
    steps: model.steps.length,
    studConnections: studConns.length,
    technicConnections: techConns.filter((c) => c.ok).length,
    connections: studConns.length + techConns.filter((c) => c.ok).length,
    collisions: collisions.length,
    components: nComp,
    buildFailures: byKind('buildability'),
    catalogFailures: byKind('catalog'),
    coverageFailures: byKind('coverage'),
    wheelsOnGround,
    groundClearanceLDU: clearance,
    massGrams: +M.toFixed(2),
    weightSource,
    centerOfMass: r3(C),
    supportPolygon: hull.map(r3),
    comMarginLDU: +margin.toFixed(2),
    unmatedStuds: unmated.length,
    exposedStuds: exposed.length,
    technicExemptPairs: exemptPairs.length,
    pass: problems.length === 0,
  },
  exposedStuds: exposed.map(({ w, st }) => ({ part: w.idx, id: w.id, p: r3(st.p) })),
  technicExempt: exemptPairs,
  problems,
  steps: stepResults,
  catalog: catalogChecks,
  coverage,
  technic: techConns,
};
if (outBase) {
  fs.writeFileSync(outBase + '.json', JSON.stringify(report, null, 1));
  fs.writeFileSync(outBase + '.md', markdown(report));
}
function markdown(R) {
  const S = R.summary;
  const CN_NAME = { 0: '黑', 15: '白', 19: '棕黃（Tan）', 36: '透明紅', 47: '透明', 72: '深藍灰' };
  const dirName = (k) => ({ '0,1,0': '往下壓', '0,-1,0': '往上插', '0,0,1': '側向（+z）', '0,0,-1': '側向（-z）' }[k] || k);
  const L = [];
  L.push('# Model Y 積木模型驗證報告', '');
  L.push(`模型檔：\`${R.model}\`　產生時間：${R.generated.slice(0, 16).replace('T', ' ')} UTC`, '');
  L.push(`**結果：${S.pass ? '全部通過' : '有 ' + R.problems.length + ' 項問題'}**`, '');
  L.push('| 項目 | 數值 |', '|---|---|');
  const rows = [
    ['零件總數', `${S.parts}（${S.uniqueParts} 種零件、${S.lots} 種零件＋顏色組合）`],
    ['搭建步驟', S.steps],
    ['接點數', `${S.connections}（凸點 ${S.studConnections}、科技軸銷 ${S.technicConnections}）`],
    ['碰撞數', S.collisions],
    ['連通塊', `${S.components}（1 代表整台車是一體）`],
    ['無法裝上的零件', S.buildFailures],
    ['零件／顏色不符現行目錄', S.catalogFailures],
    ['碰撞體未包住網格', S.coverageFailures],
    ['著地輪胎', `${S.wheelsOnGround} / 4`],
    ['最低車身離地', `${S.groundClearanceLDU} LDU（${(S.groundClearanceLDU * 0.4).toFixed(1)} mm）`],
    ['總重', `${S.massGrams} g（${S.weightSource === 'bricklink' ? 'BrickLink 目錄重量' : S.weightSource === 'mixed' ? '部分為 BrickLink 重量、部分估計' : '估計值：碰撞體體積 × 0.45 × 1.05 g/cm³'}）`],
    ['重心（x, 離地高度, z）', `${S.centerOfMass[0]}, ${-S.centerOfMass[1]}, ${S.centerOfMass[2]} LDU`],
    ['重心離支撐邊界', `${S.comMarginLDU} LDU（${(S.comMarginLDU * 0.4).toFixed(1)} mm，在四輪接地範圍內）`],
    ['外露凸點', `${S.exposedStuds}（另有 ${S.unmatedStuds - S.exposedStuds} 顆在車廂內部）`],
  ];
  for (const [k, v] of rows) L.push(`| ${k} | ${v} |`);
  L.push('', '## 檢查方法', '');
  for (const v of Object.values(R.method)) L.push('- ' + v);
  L.push(`- 科技接點免做體積碰撞的配對共 ${R.technicExempt.length} 組（軸銷↔輪軸磚、輪子↔軸銷），改以同軸與插入深度檢查；最淺插入 ${Math.min(...R.technicExempt.map((c) => c.overlap))} LDU`);
  L.push('- 支撐範圍：汽車沒有腳掌，以四個輪胎接地線圍成的凸包作為支撐範圍', '');
  L.push('## 逐步結果', '', '| 步驟 | 內容 | 零件數 | 插入方向 | 結果 |', '|---|---|---|---|---|');
  for (const st of R.steps) L.push(`| ${st.step} | ${st.title} | ${st.parts} | ${Object.keys(st.insert).map(dirName).join('、') || '第一個零件'} | ${st.ok ? '通過' : st.issues.join('；')} |`);
  L.push('', '## 零件與顏色（對照 Rebrickable 2024 年後的官方套組）', '', '| 零件 | LDraw 檔 | 顏色 | 數量 | 2024 年後出現的套組數 | 例：最近的套組 |', '|---|---|---|---|---|---|');
  for (const c of [...R.catalog].sort((a, b) => a.id.localeCompare(b.id) || a.color - b.color)) L.push(`| ${c.id} | ${c.file} | ${CN_NAME[c.color] || c.color} | ${c.qty} | ${c.sets ?? '—'} | ${c.example ? c.example.set + ' ' + c.example.name + '（' + c.example.year + '）' : '—'} |`);
  if (R.problems.length) { L.push('', '## 問題', ''); for (const p of R.problems) L.push(`- [${p.kind}] ${p.msg}`); }
  return L.join('\n') + '\n';
}
const s = report.summary;
console.log(`零件 ${s.parts}（${s.uniqueParts} 種、${s.lots} 批）｜步驟 ${s.steps}｜接點 ${s.connections}（凸點 ${s.studConnections}、科技 ${s.technicConnections}）｜碰撞 ${s.collisions}｜連通塊 ${s.components}｜組裝失敗 ${s.buildFailures}｜目錄問題 ${s.catalogFailures}`);
console.log(`重量 ${s.massGrams} g（${s.weightSource}）｜重心 ${s.centerOfMass}｜離支撐邊界 ${s.comMarginLDU} LDU｜離地 ${s.groundClearanceLDU} LDU｜著地輪胎 ${s.wheelsOnGround}`);
console.log(problems.length ? `問題 ${problems.length} 項：\n` + problems.slice(0, 40).map((p) => ' - [' + p.kind + '] ' + p.msg).join('\n') : '全部通過');
