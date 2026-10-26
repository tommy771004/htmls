// 頁面：讀入烘焙好的幾何與檢查紀錄，逐件放置；全部通過後才開放開合與按鍵動畫。
// 座標對應：three.x = x（寬）、three.y = z（厚，內螢幕朝上）、three.z = −y（高）。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PX, PZ, D2R, DISP, rotAbout, displayFold, twoArcPts, mirrorFull, fpcSweep, elastica, bodyPoint } from './kin.mjs';

const G = JSON.parse(document.getElementById('geo').textContent);
const $ = id => document.getElementById(id);
const N = G.parts.length;
const zhOf = Object.fromEntries(G.parts.map(p => [p.id, p.zh]));
const fmt = (v, k = 3) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(k);
const thetaOf = phiDeg => 180 - 2 * phiDeg;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 材質 ----------
const MAT = {
  ti: ['#8d8981', .55, .42], tiDark: ['#4a4844', .5, .5], tiPolish: ['#b8b2a6', .6, .28], alu: ['#c4c0b8', .45, .5],
  steel: ['#9a9ea1', .6, .35], oled: ['#1c1e23', .1, .3], oledBack: ['#25282d', .1, .4], glass: ['#9fb2b8', .05, .1, .45],
  frost: ['#d9d3c6', 0, .75], carbon: ['#2c2b29', .2, .55], pcb: ['#2e4a3a', .1, .6], batt: ['#a9a497', .3, .5],
  cam: ['#151515', .3, .3], mag: ['#6c6f72', .5, .45], fpc: ['#c08416', .1, .5], sapphire: ['#9db1be', .1, .15, .7],
};
const clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const mats = {}, capMats = {};
function matFor(key, hi) {
  const k = key + (hi ? '!' : '');
  if (!mats[k]) {
    const [c, m, r, op] = MAT[key] || MAT.ti;
    mats[k] = new THREE.MeshStandardMaterial({
      color: hi ? '#d4541f' : c, metalness: hi ? .05 : m, roughness: hi ? .55 : r,
      transparent: !!op && !hi, opacity: hi ? 1 : (op || 1), side: THREE.DoubleSide, clippingPlanes: [clip],
    });
  }
  return mats[k];
}
function capMat(key, hi) {
  const k = key + (hi ? '!' : '');
  if (!capMats[k]) {
    const c = new THREE.Color(hi ? '#d4541f' : (MAT[key] || MAT.ti)[0]);
    if (!hi) c.lerp(new THREE.Color('#f4f6f3'), .18);
    if (hi) c.set('#a8401a');
    capMats[k] = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  }
  return capMats[k];
}
const edgeMat = new THREE.LineBasicMaterial({ color: '#1a1d1b', transparent: true, opacity: .28, clippingPlanes: [clip] });
const capLine = new THREE.LineBasicMaterial({ color: '#1a1d1b' });

// ---------- 場景 ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
renderer.setClearColor('#dfe3de');
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 3000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .12;
scene.add(new THREE.HemisphereLight('#f7fbf8', '#7f8781', 1.6));
const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(-40, 120, 90); scene.add(sun);
const fill = new THREE.DirectionalLight('#fff1dc', .8); fill.position.set(80, 30, -60); scene.add(fill);

const frames = {};
for (const f of ['S', 'L', 'R', 'PL', 'PR']) { const g = new THREE.Group(); g.matrixAutoUpdate = false; scene.add(g); frames[f] = g; }
const setT = (g, T) => { g.matrix.set(T.c, -T.s, 0, T.tx, T.s, T.c, 0, T.tz, 0, 0, 1, 0, 0, 0, 0, 1); g.matrixWorldNeedsUpdate = true; };

// 迴圈 → THREE.Shape（依包含深度分外框與孔）
function shapesOf(loops) {
  const area = l => l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  const pip = (poly, [x, z]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const L = loops.filter(l => l.length > 2).map(l => ({ l, a: Math.abs(area(l)) })).sort((a, b) => b.a - a.a);
  const out = [];
  L.forEach((o, i) => {
    const parents = L.slice(0, i).filter(p => pip(p.l, o.l[0]));
    o.depth = parents.length; o.parent = parents[parents.length - 1];
    if (o.depth % 2 === 0) { o.shape = new THREE.Shape(o.l.map(([x, z]) => new THREE.Vector2(x, z))); out.push(o.shape); }
    else if (o.parent && o.parent.shape) o.parent.shape.holes.push(new THREE.Path(o.l.map(([x, z]) => new THREE.Vector2(x, z))));
  });
  return out;
}
const geoCache = new Map();
function extrudeGeo(key, shapes, depth) {
  const k = key + ':' + depth;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 }));
  return geoCache.get(k);
}
const capGeo = new Map();
function capOf(key, shapes, loops) {
  if (!capGeo.has(key)) {
    const pts = [];
    for (const l of loops) for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; pts.push(a[0], a[1], 0, b[0], b[1], 0); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    capGeo.set(key, { fill: new THREE.ShapeGeometry(shapes), line: lg });
  }
  return capGeo.get(key);
}

// 齒輪外形（漸開線近似：梯形齒）
function gearLoop(g) {
  const m = 0.05, ra = g.tip, rf = g.p - 1.25 * m, out = [];
  for (let i = 0; i < g.n; i++) {
    const a = i / g.n * Math.PI * 2, w = Math.PI / g.n;
    for (const [da, r] of [[-w * .55, rf], [-w * .32, ra], [w * .32, ra], [w * .55, rf]]) out.push([g.x + r * Math.cos(a + da), g.z + r * Math.sin(a + da)]);
  }
  return out;
}

// ---------- 建立每件零件的網格 ----------
const parts = G.parts.map((p, idx) => {
  const P = { ...p, idx, meshes: [], caps: [], dyn: [], keyOff: [], keyCaps: [] };
  p.prisms.forEach((q, qi) => {
    const parent = frames[q.f], depth = q.y1 - q.y0;
    let holder = parent, loops, key;
    if (q.dyn) { P.dyn.push({ q }); return; }
    const gi = p.gears && q.tag && q.tag[0] === 'g' ? +q.tag.slice(1) : -1;
    if (gi >= 0) {
      const g = p.gears[gi];
      holder = new THREE.Group(); holder.position.set(g.x, g.z, 0); parent.add(holder);
      loops = [gearLoop({ ...g, x: 0, z: 0 })]; key = 'gear' + gi;
      P.gearGroups = P.gearGroups || []; P.gearGroups.push({ grp: holder, g, gi });
    } else { loops = G.shapes[q.s]; key = 's' + q.s; }
    const shapes = shapesOf(loops);
    const mesh = new THREE.Mesh(extrudeGeo(key, shapes, depth), matFor(p.mat));
    mesh.position.z = -q.y1;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), edgeMat);
    mesh.add(edges);
    holder.add(mesh);
    const c = capOf(key, shapes, loops);
    const cap = new THREE.Mesh(c.fill, capMat(p.mat)), cl = new THREE.LineSegments(c.line, capLine);
    cap.add(cl); holder.add(cap);
    P.meshes.push(mesh); P.caps.push({ mesh: cap, q });
    if (p.press && q.tag === p.press.tag) { mesh.userData.z0 = mesh.position.z; P.keyOff.push(mesh); P.keyCaps.push(cap); }
  });
  return P;
});
const byId = Object.fromEntries(parts.map(p => [p.id, p]));

// ---------- 動態件：顯示屏自由段、排線自由段 ----------
function ribbonLoop(pts, half) {
  const n = pts.length, up = [], dn = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    up.push([pts[i][0] - tz / L * half, pts[i][1] + tx / L * half]); dn.push([pts[i][0] + tz / L * half, pts[i][1] - tx / L * half]);
  }
  return [...up, ...dn.reverse()];
}
function foldLoop(phi) {
  if (phi < 1e-5) return ribbonLoop([[-DISP.bond, DISP.nz], [DISP.bond, DISP.nz]], DISP.t / 2);
  return ribbonLoop(mirrorFull(twoArcPts(displayFold(phi), 0.05)), DISP.t / 2);
}
// 排線：開頁時從 φ=90° 往 0 延拓建表，任意角以最近表格解為初值重解
const FPC = G.D.fpc, S_FPC = -FPC.ax + FPC.extra;
let fpcTab = null;
function fpcSol(phi) {
  if (!fpcTab) fpcTab = fpcSweep([FPC.ax, FPC.az], S_FPC, Array.from({ length: 91 }, (_, i) => i * D2R));
  const i = Math.max(0, Math.min(90, Math.round(phi / D2R))), g = fpcTab[i];
  if (Math.abs(phi - g.phi) < 1e-9 || g.fail) return g.fail ? null : g;
  const [x0, z0] = bodyPoint(-1, FPC.ax, FPC.az, phi);
  return elastica(x0, z0, -phi, S_FPC, [g.k0, g.lam]) || g;
}
function fpcLoop(phi) {
  const s = fpcSol(phi); if (!s) return null;
  const pts = s.pts.filter((_, i) => i % 3 === 0 || i === s.pts.length - 1);
  return { loop: ribbonLoop(mirrorFull(pts), 0.02), R: s.Rmin };
}
const dynState = { phi: -1 };
function updateDynamic(phi) {
  if (Math.abs(phi - dynState.phi) < 1e-7) return;
  dynState.phi = phi;
  const fl = foldLoop(phi), fp = fpcLoop(phi);
  dynState.fpcR = fp ? fp.R : null;
  for (const P of parts) for (const d of P.dyn) {
    const loop = d.q.dyn === 'fold' ? fl : fp && fp.loop;
    if (!loop) continue;
    if (d.mesh) { d.mesh.geometry.dispose(); d.cap.geometry.dispose(); d.capLine.geometry.dispose(); }
    const shapes = shapesOf([loop]);
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: d.q.y1 - d.q.y0, bevelEnabled: false, curveSegments: 1 });
    const pts = []; for (let i = 0; i < loop.length; i++) { const a = loop[i], b = loop[(i + 1) % loop.length]; pts.push(a[0], a[1], 0, b[0], b[1], 0); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    if (!d.mesh) {
      d.mesh = new THREE.Mesh(geo, matFor(P.mat)); d.mesh.position.z = -d.q.y1; frames.S.add(d.mesh);
      d.cap = new THREE.Mesh(new THREE.ShapeGeometry(shapes), capMat(P.mat)); d.capLine = new THREE.LineSegments(lg, capLine);
      d.cap.add(d.capLine); frames.S.add(d.cap);
      P.meshes.push(d.mesh); P.caps.push({ mesh: d.cap, q: d.q });
    } else { d.mesh.geometry = geo; d.cap.geometry = new THREE.ShapeGeometry(shapes); d.capLine.geometry = lg; }
  }
}

// ---------- 姿態 ----------
const plateLaw = (() => {
  const p = G.D.plate;
  if (!p.table) return phi => phi * 2 / 3;
  return phi => { const t = p.table, f = phi / (0.5 * D2R), i = Math.min(t.length - 2, Math.floor(f)), k = f - i; return t[i] * (1 - k) + t[i + 1] * k; };
})();
const pose = { theta: 180, press: {} };
function applyPose() {
  const phi = (180 - pose.theta) / 2 * D2R, psi = plateLaw(phi), p = G.D.plate;
  setT(frames.S, { c: 1, s: 0, tx: 0, tz: 0 });
  setT(frames.L, rotAbout(-PX, PZ, -phi)); setT(frames.R, rotAbout(PX, PZ, phi));
  setT(frames.PL, rotAbout(-p.hx, p.hz, -psi)); setT(frames.PR, rotAbout(p.hx, p.hz, psi));
  updateDynamic(phi);
  // 齒輪：齒條（滑軌節圓 r1）帶動端齒輪，之後逐顆反向
  const sync = byId.sync;
  if (sync.gearGroups) {
    let a = phi * G.D.slider.r1 / sync.gears[0].p;
    sync.gears.forEach((g, i) => { if (i) a = -a * sync.gears[i - 1].p / g.p; const gg = sync.gearGroups.filter(o => o.gi === i); gg.forEach(o => { o.grp.rotation.z = a; }); });
  }
  for (const P of parts) if (P.press) {
    const k = pose.press[P.id] || 0;
    for (const m of P.keyOff) { m.position.x = (P.press.dx || 0) * k; m.position.z = m.userData.z0 - (P.press.dy || 0) * k; }
    for (const c of P.keyCaps) c.position.x = (P.press.dx || 0) * k;
  }
  updateCaps();
}

// ---------- 剖切 ----------
const view = { mode: 'hinge', cut: 24 };
function updateCaps() {
  const on = view.mode === 'hinge';
  clip.constant = on ? -view.cut : 1e5;
  for (const P of parts) for (const c of P.caps) {
    let y0 = c.q.y0, y1 = c.q.y1;
    if (P.press && c.q.tag === P.press.tag && P.press.dy) { const k = (pose.press[P.id] || 0) * P.press.dy; y0 += k; y1 += k; }
    c.mesh.visible = on && P.shown && view.cut >= y0 && view.cut <= y1;
    c.mesh.position.z = -view.cut + 0.002;
  }
}

// ---------- 逐件放置 ----------
let step = 1, moved = false; // moved：開始動畫後取消「目前這一件」的標色
const stepStatus = G.steps.map(s => s.stages.length > 1 ? 'fixed' : 'done');
function showParts() {
  parts.forEach((P, i) => {
    P.shown = i < step;
    const hi = i === step - 1 && !moved;
    for (const m of P.meshes) { m.visible = P.shown; m.material = matFor(P.mat, hi); }
    for (const c of P.caps) c.mesh.material = capMat(P.mat, hi);
    if (P.gearGroups) P.gearGroups.forEach(o => { o.grp.visible = P.shown; });
  });
  updateCaps();
}
const allDone = () => step >= N && G.final.every(f => f.ok);

const FOCUS = {
  spine: 24, frameL: 24, frameR: 24, sliderL: 23, sliderR: 30, sync: 23, display: 10, plates: 10, fpc1: 46, fpc2: -46,
};
function partBox(P) {
  const b = new THREE.Box3();
  for (const m of P.meshes) { m.updateWorldMatrix(true, false); b.expandByObject(m); }
  return b;
}

// 相機補間
let camTween = null;
function flyTo(pos, tgt, ms = 650) {
  if (reduce) ms = 0;
  camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: tgt, s: performance.now(), ms };
}
function setView(mode, fly = true) {
  view.mode = mode;
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === mode)));
  $('cutctl').hidden = mode !== 'hinge';
  updateCaps();
  if (!fly) return;
  const phi = (180 - pose.theta) / 2 * D2R, lift = Math.sin(phi) * 1.5;
  if (mode === 'hinge') {
    const c = view.cut, d = narrow() ? 62 : 44;
    flyTo(new THREE.Vector3(d * .1, 0.6 + d * .14 + lift, -c + d), new THREE.Vector3(0, 0.6 + lift, -c));
  } else if (mode === 'whole') {
    const s = (narrow() ? 1.45 : 1) * (1 + .25 * Math.sin(phi)), h = 41 * Math.sin(phi);
    flyTo(new THREE.Vector3(-70 * s, h + 150 * s, 210 * s), new THREE.Vector3(0, h * .9, 0));
  } else {
    const P = parts[Math.min(step, N) - 1], b = partBox(P), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const r = Math.max(sz.x, sz.y, sz.z * .6, 6) * (narrow() ? 2.2 : 1.5) + 8;
    flyTo(new THREE.Vector3(c.x - r * .35, c.y + r * .7, c.z + r * .9), c);
  }
}
const narrow = () => innerWidth < 860;
function autoView() {
  const P = parts[step - 1];
  if (FOCUS[P.id] !== undefined) { view.mode = 'hinge'; setCut(FOCUS[P.id]); }
  else setView(['bandL', 'bandR', 'outerGlass', 'outerPanel', 'backGlass'].includes(P.id) ? 'whole' : 'part');
}

// ---------- 面板 ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function pairText(p) {
  const who = zhOf[p.other] || p.other;
  const where = p.press ? '按下時' : `θ = ${thetaOf(p.phi).toFixed(1)}°`;
  return p.d < G.tol ? `與${who}${p.d < 0 ? '干涉' : '間隙不足'} ${fmt(p.d)} mm（${where}）` : `最近：${who} ${fmt(p.d)} mm（${where}）`;
}
function selfText(s) {
  if (s.kind === 'bend') return `${s.what}最小彎曲半徑 R ${s.R.toFixed(3)} mm（下限 ${s.min}${s.phi !== undefined ? `，θ = ${thetaOf(s.phi).toFixed(1)}°` : ''}）`;
  if (s.kind === 'key') return `${s.what}：${fmt(s.rest)} → ${fmt(s.pressed)} mm`;
  if (s.kind === 'mesh' && s.err) return `${s.what} 誤差 ${fmt(s.err, 4)} mm`;
  return s.what;
}
const sketchOf = (id, k) => G.sketches.find(s => s.step === id && s.stage === k);
function renderStep() {
  const P = parts[step - 1], S = G.steps[step - 1];
  $('stepN').textContent = step; $('stepT').textContent = N;
  $('pname').innerHTML = `${esc(P.zh)}<small>${esc(P.en)}</small>`;
  $('pmeta').innerHTML = `${esc(P.dims)}　<span class="${P.est ? 'src-est' : ''}">${P.est ? '尺寸為推估' : '依公開規格'}</span>`;
  $('pnote').textContent = P.note;
  $('track').innerHTML = G.steps.map((s, i) => `<span class="${i === step - 1 ? 'cur' : i < step ? stepStatus[i] : ''}"></span>`).join('');
  $('prev').disabled = step <= 1; $('next').disabled = step >= N; $('all').disabled = step >= N;
  $('trail').innerHTML = S.stages.map((g, k) => {
    const worst = g.res.pairs.find(p => p.d < G.tol), badSelf = g.res.self.filter(s => !s.ok);
    const title = k === 0 ? '依零件表放上' : `修正 ${k}：${esc(g.fix.zh)}`;
    let r;
    if (g.res.ok) r = `<div class="r ok">通過。${g.res.pairs[0] ? esc(pairText(g.res.pairs[0])) : ''}</div>`;
    else r = `<div class="r bad">未通過。${worst ? esc(pairText(worst)) : ''}${badSelf.map(s => '；' + esc(selfText(s))).join('')}</div>`;
    const why = g.fix ? `<div class="why">${esc(g.fix.why)}<br>做法：${esc(g.fix.what)}</div>` : '';
    const sk = sketchOf(S.id, k);
    return `<li class="${g.res.ok ? 'ok' : 'bad'}"><div class="t">${title}</div>${why}${r}${sk ? sketchPair(sk, P.id) : ''}</li>`;
  }).join('');
  const last = S.stages[S.stages.length - 1].res;
  $('pairs').innerHTML = last.pairs.slice(0, 6).map(p => `<tr><td>${esc(zhOf[p.other] || p.other)}</td><td class="n"><span class="${p.d < G.tol ? 'bad' : ''}">${fmt(p.d)}</span></td><td class="n">${p.press ? '按下時' : thetaOf(p.phi).toFixed(1) + '°'}</td></tr>`).join('') || '<tr><td colspan="3">第一件，沒有其他零件可比。</td></tr>';
  $('selfs').innerHTML = last.self.map(s => `<li class="${s.ok ? 'ok' : 'bad'}">${s.ok ? '✓' : '✗'} ${esc(selfText(s))}</li>`).join('');
  $('motion').classList.toggle('locked', !allDone());
  document.querySelectorAll('#ptable tr').forEach(tr => tr.classList.toggle('cur', +tr.dataset.step === step));
}

// 失敗處剖面：修正前／修正後同一位置
const LAYER = { me: ['#d4541f', .32], other: ['#b8321f', .18], rest: ['#848c86', .16] };
function sketchSvg(sk, me, other, label) {
  const [x0, x1, z0, z1] = sk.win, w = x1 - x0, h = z1 - z0;
  const body = sk.layers.map(l => {
    const [c, a] = l.id === me ? LAYER.me : l.id === other ? LAYER.other : LAYER.rest;
    const d = l.loops.map(lp => 'M' + lp.map(([x, z]) => `${(x - x0).toFixed(3)} ${(z1 - z).toFixed(3)}`).join('L') + 'Z').join('');
    return `<path d="${d}" fill="${c}" fill-opacity="${a}" stroke="${c}" stroke-width="${(w / 220).toFixed(4)}" fill-rule="evenodd"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
}
function afterCap(sk) {
  if (sk.after === null) return '這一對已不在最近的幾對內';
  if (sk.afterPhi !== null && Math.abs(sk.afterPhi - sk.before.phi) > 0.3) return `此處已讓開；這一對的最差處移到 θ = ${thetaOf(sk.afterPhi).toFixed(1)}°（${fmt(sk.after)} mm）`;
  return fmt(sk.after) + ' mm';
}
function sketchPair(sk, me) {
  const cx = sk.at[0] - sk.before.win[0], cz = sk.before.win[3] - sk.at[1], s = (sk.before.win[1] - sk.before.win[0]) / 40;
  const mark = `<circle cx="${cx}" cy="${cz}" r="${s * 1.6}" fill="none" stroke="#1a1d1b" stroke-width="${s / 3}"/>`;
  const b = sketchSvg(sk.before, me, sk.other, '修正前剖面').replace('</svg>', mark + '</svg>');
  const a = sketchSvg(sk.afterSk, me, sk.other, '修正後剖面').replace('</svg>', mark + '</svg>');
  const where = `y = ${sk.before.y.toFixed(1)}，θ = ${thetaOf(sk.before.phi).toFixed(1)}°，視窗 4.4 mm`;
  return `<div class="pair"><figure>${b}<figcaption>修正前：${fmt(sk.d)} mm</figcaption></figure><figure>${a}<figcaption>修正後：${afterCap(sk)}</figcaption></figure></div><div class="cap">${where}。橘：這一件；紅：${esc(zhOf[sk.other] || sk.other)}；灰：其他。</div>`;
}

function renderPartsTable() {
  $('ptable').innerHTML = parts.map((P, i) => {
    const f = G.final[i], m = f.pairs[0];
    const v = m ? `<span class="${m.d < G.tol ? 'bad' : 'ok'}">${fmt(m.d)}</span>` : '–';
    return `<tr data-step="${i + 1}"><td class="n">${i + 1}</td><td>${esc(P.zh)}</td><td>${esc(P.dims)}</td><td>${P.est ? '推估' : '公開'}</td><td class="n">${v}${f.ok ? '' : ' ✗'}</td></tr>`;
  }).join('');
  $('ptable').addEventListener('click', e => { const tr = e.target.closest('tr[data-step]'); if (tr) { goStep(+tr.dataset.step); selectTab('build'); } });
}
function renderLog() {
  const box = $('fixes'); if (!box) return;
  const html = [];
  G.steps.forEach((S, i) => S.stages.forEach((g, k) => {
    if (!g.fix) return;
    const prev = S.stages[k - 1].res, worst = prev.pairs.find(p => p.d < G.tol), sk = sketchOf(S.id, k);
    html.push(`<div class="fix"><h3>${esc(zhOf[S.id])}：${esc(g.fix.zh)}</h3><div class="at">第 ${i + 1} 件。觸發：${sk ? esc(pairText({ other: sk.other, d: sk.d, phi: sk.before.phi })) : worst ? esc(pairText(worst)) : esc(prev.self.filter(s => !s.ok).map(selfText).join('；'))}</div><p>${esc(g.fix.why)}</p><p>做法：${esc(g.fix.what)}</p><p class="${g.res.ok ? '' : ''}">結果：${g.res.ok ? '通過' : '仍未通過，接著下一個修正'}。</p>${sk ? sketchPair(sk, S.id) : ''}</div>`);
  }));
  box.innerHTML = html.join('');
}

// ---------- 開合動畫與圖表 ----------
function setTheta(t) {
  if (!moved) { moved = true; showParts(); }
  pose.theta = t; $('theta').value = t; $('thetav').textContent = t.toFixed(1) + '°';
  applyPose(); readout();
  chart.mark(t);
}
function readout() {
  const phi = (180 - pose.theta) / 2 * D2R, f = phi > 1e-5 ? displayFold(phi) : null;
  const psi = plateLaw(phi) / D2R, m = chart.at(pose.theta);
  $('readout').innerHTML = [
    ['每半邊轉角 φ', (phi / D2R).toFixed(1) + '°'],
    ['支撐板下翻 ψ', psi.toFixed(1) + '°'],
    ['螢幕摺彎 R', f ? f.R.toFixed(2) + ' mm' : '攤平'],
    ['排線最小 R', dynState.fpcR ? (isFinite(dynState.fpcR) ? dynState.fpcR.toFixed(2) + ' mm' : '直線') : '–'],
    ['鉸鏈最小間隙', m ? fmt(m.d) + ' mm' : '–'],
    ['在', m ? esc(m.label) : '–'],
  ].map(([k, v]) => `<span>${k}　<b>${v}</b></span>`).join('');
}
const chart = (() => {
  const keys = Object.keys(G.curves), W = 400, H = 170, L = 36, B = 22, T = 8, Rr = 8;
  const X = th => L + (180 - th) / 180 * (W - L - Rr), YM = 0.3, Y = d => T + (1 - Math.min(Math.max(d, 0), YM) / YM) * (H - T - B);
  const thetas = Array.from({ length: 91 }, (_, i) => 180 - 2 * i);
  const env = thetas.map((_, i) => { let best = null; for (const k of keys) { const v = G.curves[k][i]; if (v !== null && (!best || v < best.d)) best = { d: v, k }; } return best; });
  const lab = k => k.split('|').map(id => zhOf[id] || id).join(' ↔ ');
  const box = $('chart');
  const path = arr => { let s = '', pen = false; arr.forEach((v, i) => { if (v === null) { pen = false; return; } s += (pen ? 'L' : 'M') + X(thetas[i]).toFixed(1) + ',' + Y(v).toFixed(1); pen = true; }); return s; };
  const grid = [0, .1, .2, .3].map(v => `<line x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#cdd3cc" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#848c86">${v.toFixed(2)}</text>`).join('');
  const xt = [0, 45, 90, 135, 180].map(t => `<text x="${X(t)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#848c86">${t}°</text>`).join('');
  const lo = env.reduce((a, b, i) => b && (!a || b.d < a.d) ? { ...b, i } : a, null);
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-label="最小間隙對開合角">${grid}${xt}
    ${keys.map(k => `<path d="${path(G.curves[k])}" fill="none" stroke="#a9b1aa" stroke-width="1"/>`).join('')}
    <line x1="${L}" x2="${W - Rr}" y1="${Y(G.tol)}" y2="${Y(G.tol)}" stroke="#d4541f" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="${path(env.map(e => e && e.d))}" fill="none" stroke="#1a1d1b" stroke-width="2"/>
    ${lo ? `<circle cx="${X(thetas[lo.i])}" cy="${Y(lo.d)}" r="4" fill="#1a1d1b"/><text x="${Math.min(X(thetas[lo.i]) + 8, W - 190)}" y="${Y(lo.d) - 14}" font-size="11" fill="#1a1d1b">${esc(fmt(lo.d))} mm，${esc(lab(lo.k))}</text>` : ''}
    <line id="cm" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="#d4541f" stroke-width="1"/>
    <rect x="${L}" y="${T}" width="${W - L - Rr}" height="${H - T - B}" fill="transparent" id="hit"/>
  </svg><div class="tip" hidden></div>`;
  const svg = box.querySelector('svg'), tip = box.querySelector('.tip'), cm = svg.querySelector('#cm');
  const at = th => { const i = Math.max(0, Math.min(90, Math.round((180 - th) / 2))); return env[i] && { d: env[i].d, label: lab(env[i].k) }; };
  svg.querySelector('#hit').addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, th = Math.max(0, Math.min(180, 180 - (x - L) / (W - L - Rr) * 180));
    const v = at(th); if (!v) return;
    const th2 = Math.round(th / 2) * 2;
    tip.hidden = false; tip.style.left = (X(th2) / W * r.width) + 'px'; tip.style.top = (Y(v.d) / H * r.height - 8) + 'px';
    tip.innerHTML = `<b>${esc(fmt(v.d))} mm</b>　θ ${th2}°<br>${esc(v.label)}`;
  });
  svg.querySelector('#hit').addEventListener('pointerleave', () => { tip.hidden = true; });
  return { at, mark: th => { cm.setAttribute('x1', X(th)); cm.setAttribute('x2', X(th)); } };
})();

let playing = null;
$('play').addEventListener('click', () => {
  if (playing) { playing = null; $('play').textContent = '播放開合'; return; }
  playing = { s: performance.now(), t0: pose.theta }; $('play').textContent = '停止';
});
$('theta').addEventListener('input', e => { playing = null; $('play').textContent = '播放開合'; setTheta(+e.target.value); });
document.querySelectorAll('[data-press]').forEach(b => b.addEventListener('click', () => {
  const id = b.dataset.press, t0 = performance.now();
  const tick = now => {
    const t = (now - t0) / 700, k = t < .2 ? t / .2 : t < .6 ? 1 : Math.max(0, 1 - (t - .6) / .2);
    pose.press[id] = k; applyPose();
    if (t < 1) requestAnimationFrame(tick); else { pose.press[id] = 0; applyPose(); }
  };
  requestAnimationFrame(tick);
  const P = byId[id], b0 = partBox(P), c = b0.getCenter(new THREE.Vector3());
  setView('part', false); flyTo(new THREE.Vector3(c.x + 9, c.y + 6, c.z + 10), c);
}));

// ---------- 事件 ----------
function goStep(k) { step = Math.max(1, Math.min(N, k)); moved = false; showParts(); renderStep(); autoView(); if (step < N) { pose.theta = 180; applyPose(); } }
$('prev').addEventListener('click', () => goStep(step - 1));
$('next').addEventListener('click', () => goStep(step + 1));
$('all').addEventListener('click', () => goStep(N));
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
function setCut(c) { view.cut = c; $('cut').value = c; $('cutv').textContent = c.toFixed(1); updateCaps(); if (view.mode === 'hinge') setView('hinge'); }
$('cut').addEventListener('input', e => setCut(+e.target.value));
function selectTab(t) {
  document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  for (const n of ['build', 'parts', 'log']) $('pane-' + n).hidden = n !== t;
}
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
const ease = t => 1 - Math.pow(1 - t, 3);
const scaleBar = $('scale');
function frame(now) {
  if (camTween) {
    const k = camTween.ms ? Math.min(1, (now - camTween.s) / camTween.ms) : 1, e = ease(k);
    camera.position.lerpVectors(camTween.p0, camTween.p1, e); controls.target.lerpVectors(camTween.t0, camTween.t1, e);
    if (k >= 1) camTween = null;
  }
  if (playing) {
    const t = (now - playing.s) / 7000, ph = (t % 1);
    setTheta(Math.round((90 + 90 * Math.cos(ph * Math.PI * 2)) * 2) / 2);
  }
  controls.update();
  // 比例尺：目標處 1 mm 的螢幕長度
  const dist = camera.position.distanceTo(controls.target), px = stage.clientHeight / (2 * Math.tan(camera.fov * D2R / 2) * dist);
  const unit = [0.5, 1, 2, 5, 10, 20, 50].find(u => u * px >= 40) || 50;
  scaleBar.firstChild.style.width = (unit * px).toFixed(0) + 'px'; scaleBar.lastChild.textContent = unit + ' mm';
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// 開頁
resize();
renderPartsTable(); renderLog();
applyPose();
const q = new URLSearchParams(location.search);
step = q.has('step') ? +q.get('step') : 1;
showParts(); renderStep();
camera.position.set(4, 6, -24 + 24); controls.target.set(0, .6, -24);
autoView(); camTween && (camTween.ms = 0);
if (q.has('theta') && allDone()) setTheta(+q.get('theta'));
if (q.has('view')) setView(q.get('view'));
requestAnimationFrame(frame);
window.__duo = { goStep, setTheta, setView, setCut, view, pose, parts, G, camera, controls, render: () => renderer.render(scene, camera) };
