// 零件：每件一個函式，依設計參數 D 產生沿 Y 拉伸的截面稜柱。
// 座標（攤平狀態）：原點在鉸鏈中心、厚度中央；x 寬度方向（左半 x<0 背面是外螢幕，右半 x>0 背面是相機），
// y 高度方向，z 厚度方向（+z 為內螢幕）。單位 mm。標「推估」者為 Apple 未公開、依外形與常規推算。
import { rect, sector, circle, polygon, cut, uni, mirror, ribbon, contour } from './geom.mjs';
import { PX, PZ, D2R, DISP, displayFold, mirrorFull, rotAbout, apply, inv, fpcSweep, elastica } from './kin.mjs';

export const HY = 58.9, IY = 58.1; // 機身半高、內腔半高
const P_L = [-PX, PZ];

// 初版設計（動工前公布的零件表）。檢查失敗後的修正以 FIXES 依序套用。
export function designV1() {
  return {
    lobeTo: 270,                                    // 中脊側翼外緣（r≤2.64）延伸到的角度
    pocket: 'rect',                                 // 中脊上方凹槽：'rect' 或 'env'（依活動件包絡挖出）
    slider: { r0: 1.6, r1: 2.4, tip: 2.45, b0: 170, b1: 365, web: [190, 205] },
    gears: [ // 左半鏈（右半鏡射）：x, z, 齒數；模數 0.05
      { x: -1.8, z: -1.672, n: 16 }, { x: -1.05, z: -1.672, n: 14 }, { x: -0.35, z: -1.672, n: 14 }],
    recess: false,                                  // 中框是否依顯示屏包絡下挖
    plate: { hx: 2.80, hz: 2.05, L: 2.74, t: 0.30, law: 'lin', ys: [[-57, 57]] },
    fpc: { ax: -5.68, az: 0.9, extra: 1.0, notch: false },
    magR: [[4, 18], [-18, -4]],
    yGap: 0,
    pocketPlates: false,
    lipNotch: false,                                // 齒輪鏈區段的中框下唇是否讓出端齒輪                            // 中脊凹槽是否也依支撐板掃掠挖出                                        // 活動件與溝槽在 y 方向的單側間隙
  };
}

// ---------- 小工具 ----------
const R = (x0, x1, z0, z1) => rect(x0, x1, z0, z1);
const M = s => mirror(s);
export const pr = (y0, y1, frame, shape, tag) => ({ y0, y1, frame, shape, tag });
const symY = (y0, y1) => [[y0, y1], [-y1, -y0]];
// 依 y 斷點切段：fn(yMid) 回傳該段截面（或 null 表示該段沒有）
function zoned(cuts, frame, fn, tag) { // fn(y) 回傳 [鍵, 產生器]；同鍵共用同一形狀物件（檢查時可共用快取）
  const out = [], memo = new Map();
  for (let i = 0; i < cuts.length - 1; i++) {
    const y0 = cuts[i], y1 = cuts[i + 1], r = fn((y0 + y1) / 2, y0, y1);
    if (!r) continue;
    const [k, make] = r;
    if (!memo.has(k)) memo.set(k, make());
    out.push(pr(y0, y1, frame, memo.get(k), tag));
  }
  return out;
}
const inZ = (y, [a, b]) => y > a && y < b;
const absIn = (y, r) => inZ(Math.abs(y), r);

export const ZONE = { A: [20, 26.5], B: [26.5, 33], chain: [20, 33], fpc: [42.5, 49.5], fpcCable: [43, 49] };

// ---------- 包絡（掃掠區域）：以 marching squares 取外輪廓轉成多邊形 ----------
const envCache = new Map();
export const bakedEnv = {}; // 頁面端可預先填入烘焙好的多邊形
export const envKeys = () => Object.fromEntries([...envCache].map(([k, v]) => [k, v.loops]));
export function sweepEnv(key, { at, bb, res = 0.025, margin, phis }) {
  if (envCache.has(key)) return envCache.get(key);
  let loops = bakedEnv[key];
  if (!loops) {
    const items = phis.map(phi => at(phi)).filter(Boolean); // {shape, T: 目標→形狀座標}
    const probe = {
      bb,
      sdf(x, z) {
        let best = Infinity;
        for (const it of items) {
          const [u, v] = apply(it.T, x, z), b = it.shape.bb;
          const ox = Math.max(b[0] - u, 0, u - b[1]), oz = Math.max(b[2] - v, 0, v - b[3]);
          if (ox > best + margin || oz > best + margin) continue;
          const d = it.shape.sdf0 ? it.shape.sdf0(u, v) : it.shape.sdf(u, v); if (d < best) best = d;
        }
        return best - margin;
      },
    };
    loops = contour(probe, res).filter(l => Math.abs(area(l)) > res * res * 4);
    // 只留外輪廓（不在其他迴圈內者），內部空洞一併挖掉（保守）
    loops = loops.filter((l, i) => !loops.some((o, j) => j !== i && Math.abs(area(o)) > Math.abs(area(l)) && pip(o, l[0])));
    loops = loops.map(l => l.map(([x, z]) => [+x.toFixed(4), +z.toFixed(4)]));
  }
  const shape = loops.length ? uni(...loops.map(l => polygon(l))) : null;
  const v = { loops, shape };
  envCache.set(key, v);
  return v;
}
const area = l => l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function pip(poly, [x, z]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export const PHIS = Array.from({ length: 181 }, (_, i) => i * 0.5 * D2R);

// ---------- 支撐板角度律 ψ(φ) ----------
export function plateLaw(D) {
  const p = D.plate;
  if (p.law === 'lin') return phi => phi * 2 / 3;
  return phi => { // 表格（每 0.5°）線性內插
    const t = p.table, f = phi / (0.5 * D2R), i = Math.min(t.length - 2, Math.floor(f)), k = f - i;
    return t[i] * (1 - k) + t[i + 1] * k;
  };
}
export const plateShape = D => R(-D.plate.hx, -D.plate.hx + D.plate.L, D.plate.hz - D.plate.t, D.plate.hz);
export const plateFrame = (D, psi, side) => side < 0 ? rotAbout(-D.plate.hx, D.plate.hz, -psi) : rotAbout(D.plate.hx, D.plate.hz, psi);

// 顯示屏自由段截面（世界座標）：四段帶厚圓弧
const foldCache = new Map();
export function foldShape(phi) {
  const k = phi.toFixed(7);
  let v = foldCache.get(k);
  if (!v) { v = foldShape0(phi); if (foldCache.size > 4000) foldCache.clear(); foldCache.set(k, v); }
  return v;
}
function foldShape0(phi) {
  const t = DISP.t / 2;
  if (phi < 1e-5) return R(-DISP.bond, DISP.bond, DISP.nz - t, DISP.nz + t);
  const s = displayFold(phi), deg = 180 / Math.PI;
  const parts = [];
  for (const a of s.arcs) {
    parts.push(sector(a.cx, a.cz, s.R - t, s.R + t, a.a0 * deg, a.a1 * deg));
    parts.push(sector(-a.cx, a.cz, s.R - t, s.R + t, 180 - a.a1 * deg, 180 - a.a0 * deg));
  }
  const u = uni(...parts); u.fold = s;
  return u;
}

// 排線自由段（世界座標）：依 φ 延拓求解，快取
const fpcCache = new Map();
const fpcRibCache = new Map();
export function fpcFree(D, phi) {
  const ck = `${D.fpc.ax},${D.fpc.az},${D.fpc.extra},${phi.toFixed(7)}`;
  if (fpcRibCache.has(ck)) return fpcRibCache.get(ck);
  const v = fpcFree0(D, phi);
  if (fpcRibCache.size > 4000) fpcRibCache.clear();
  fpcRibCache.set(ck, v);
  return v;
}
function fpcFree0(D, phi) {
  const key = `${D.fpc.ax},${D.fpc.az},${D.fpc.extra}`;
  let tab = fpcCache.get(key);
  if (!tab) { tab = fpcSweep([D.fpc.ax, D.fpc.az], -D.fpc.ax + D.fpc.extra, PHIS); fpcCache.set(key, tab); }
  const f = phi / (0.5 * D2R), i = Math.round(f);
  let s = tab[Math.max(0, Math.min(tab.length - 1, i))];
  if (Math.abs(f - i) > 1e-6) { // 非表格角度：以鄰近解為初值重解
    const g = tab[Math.max(0, Math.min(tab.length - 1, i))];
    const [x0, z0] = apply(rotAbout(-PX, PZ, -phi), D.fpc.ax, D.fpc.az);
    const r = !g.fail && g.k0 !== undefined ? fpcSweepOne(x0, z0, phi, -D.fpc.ax + D.fpc.extra, [g.k0, g.lam]) : null;
    if (r) s = { phi, ...r };
  }
  if (!s || s.fail) return null;
  const pts = mirrorFull(s.pts);
  const rib = ribbon(pts, 0.02); rib.Rmin = s.Rmin; rib.zMin = Math.min(...pts.map(p => p[1]));
  return rib;
}
function fpcSweepOne(x0, z0, phi, S, g) { return elastica(x0, z0, -phi, S, g); }

// ==================== 零件 ====================

// 1. 鉸鏈中脊（鈦合金，固定參考座標）
export function makeSpine(D) {
  const slab = R(-4.7, 4.7, -2.6, 2.13);
  const lobe = sector(-PX, PZ, 2.64, 9, 100, D.lobeTo);
  let base = cut(slab, lobe, M(lobe));
  const s = D.slider, track = uni(
    sector(-PX, PZ, s.r0 - 0.06, s.tip + 0.06, s.b0 - 90 - 3.2, s.b1 + 3.2),   // 角向留 ≥0.08（在 R1.54 處）
    sector(-PX, PZ, s.r1 - 0.1, 9, s.web[0] - 90 - 2.2, s.web[1] + 2.2));
  const gearCav = uni(...gearList(D).map(g => circle(g.x, g.z, g.tip + 0.06)));
  const pocket = spinePocket(D);
  const fpcCut = D.fpc.notch ? fpcEnvWorld(D) : null;
  const cuts = [-HY, -49.5, -42.5, -33, -26.5, -20, 20, 26.5, 33, 42.5, 49.5, HY];
  const prisms = zoned(cuts, 'S', (y) => {
    const ay = Math.abs(y), c = [];
    let k = '';
    if (pocket) c.push(pocket);
    if (inZ(ay, ZONE.A)) { c.push(track); k += 'A'; }
    if (inZ(ay, ZONE.B)) { c.push(M(track)); k += 'B'; }
    if (inZ(ay, ZONE.chain)) { c.push(gearCav); k += 'G'; }
    if (inZ(ay, ZONE.fpc) && fpcCut) { c.push(fpcCut); k += 'F'; }
    return [k, () => c.length ? cut(base, ...c) : base];
  });
  return {
    id: 'spine', zh: '鉸鏈中脊', en: 'Hinge spine', group: 'S', mat: 'ti', est: true,
    dims: '9.4 × 117.8 × 4.73（兩側弧形外緣 R2.64）',
    note: '鈦合金，鉸鏈的固定座。上方凹槽讓顯示屏下垂，內含滑槽與同步齒輪腔。',
    prisms,
  };
}
function spinePocket(D) {
  if (D.pocket === 'rect') return R(-3.02, 3.02, -0.30, 2.5);
  const e1 = dispEnvWorld(), e2 = D.pocketPlates && D.plate.ys.length ? plateEnvSplit(D) : null;
  return e2 ? uni(e1, e2) : e1;
}
export function dispEnvWorld() {
  return sweepEnv('dispW', {
    phis: PHIS, margin: 0.08, bb: [-4.8, 4.8, 0, 2.7],
    at: phi => ({ shape: foldShape(phi), T: { c: 1, s: 0, tx: 0, tz: 0 } }),
  }).shape;
}
function plateEnvSplit(D) {
  const law = plateLaw(D), ps = plateShape(D);
  const key = 'plateWL' + (D.plate.table ? D.plate.table.map(v => v.toFixed(4)).join(',') : D.plate.law) + ':' + D.plate.hx + ':' + D.plate.hz + ':' + D.plate.L + ':' + D.plate.t;
  const e = sweepEnv(key, {
    phis: PHIS, margin: 0.08, bb: [-4.6, 0.3, -1.9, 2.4],
    at: phi => ({ shape: ps, T: inv(plateFrame(D, law(phi), -1)) }),
  }).shape;
  return e ? uni(e, M(e)) : null;
}

// 2. 左／右中框（再生鋁）：鉸鏈端塊、中板、下緣唇
function frameShape(D, side, fpcZone) {
  const block = R(-7.5, -PX, -1.6, 1.65), mid = R(-7.5, -5.0, 1.65, 2.2), lip = R(-2.34, -PX, -2.6, -1.6);
  const scoop = uni(sector(-PX, PZ, 0, 3.8, 90, 190), sector(-PX, PZ, 0, 2.7, 180, 272));
  const c = [scoop];
  if (D.recess) c.push(dispEnvBody());
  if (fpcZone === 'fpc' && D.fpc.notch) c.push(fpcEnvBody(D), fpcGroove(D));
  if (fpcZone === 'chain' && D.lipNotch) c.push(gearEnvBody(D));
  const s = cut(uni(block, mid, lip), ...c);
  return side < 0 ? s : M(s);
}
function frameEnd(side) {
  const s = cut(uni(R(-7.5, -PX, -1.6, 1.65), R(-2.34, -PX, -2.6, -1.6)), sector(-PX, PZ, 0, 3.8, 90, 190), sector(-PX, PZ, 0, 2.7, 180, 272));
  return side < 0 ? s : M(s);
}
function gearEnvBody(D) { // 端齒輪（固定在中脊）在左半機身座標中的掃掠包絡
  const g = gearList(D)[0], key = 'gearB' + g.x + ',' + g.z + ',' + g.tip;
  return sweepEnv(key, {
    phis: PHIS, margin: 0.08, bb: [-3.0, 1.0, -2.8, 0.0],
    at: phi => ({ shape: circle(g.x, g.z, g.tip), T: rotAbout(-PX, PZ, -phi) }),
  }).shape;
}
export function dispEnvBody() { // 顯示屏自由段在左半座標中的掃掠包絡
  return sweepEnv('dispBodyL', {
    phis: PHIS, margin: 0.08, bb: [-6.9, -1.0, -0.5, 2.7],
    at: phi => ({ shape: foldShape(phi), T: rotAbout(-PX, PZ, -phi) }),
  }).shape;
}
function makeFrame(D, side) {
  const f = side < 0 ? 'L' : 'R';
  const prisms = zoned([-HY, -IY, -49.5, -42.5, -33, -20, 20, 33, 42.5, 49.5, IY, HY], f, (y) => {
    const ay = Math.abs(y);
    if (ay > IY) return ['end', () => frameEnd(side)];
    const z = inZ(ay, ZONE.fpc) ? 'fpc' : inZ(ay, ZONE.chain) ? 'chain' : null;
    return [z || 'plain', () => frameShape(D, side, z)];
  });
  const plate = side < 0 ? R(-81.5, -7.5, 1.65, 2.2) : R(7.5, 81.5, 1.65, 2.2); // 中板外段（與鉸鏈端相接）
  prisms.push(pr(-IY, IY, f, plate, 'mid'));
  return {
    id: side < 0 ? 'frameL' : 'frameR', zh: side < 0 ? '左半中框' : '右半中框', en: side < 0 ? 'Frame L' : 'Frame R',
    group: f, mat: 'alu', est: true,
    dims: '80.4 × 117.8 × 5.2（中板厚 0.55、鉸鏈端塊 5.6 × 3.25）',
    note: '再生鋁結構件。鉸鏈端以 R3.8／R2.7 兩段圓弧讓開中脊，承托內螢幕。',
    prisms,
  };
}
export const makeFrameL = D => makeFrame(D, -1);
export const makeFrameR = D => makeFrame(D, 1);

// 3. 鈦金屬邊框（Grade 5）
function makeBand(D, side) {
  const f = side < 0 ? 'L' : 'R', m = s => side < 0 ? s : M(s);
  const outer = R(-82.3, -81.5, -2.6, 2.6), end = R(-81.5, -7.5, -2.6, 2.6);
  const prisms = [];
  if (side < 0) prisms.push(pr(-HY, HY, f, outer));
  else {
    // 右緣：Touch ID 側鍵與相機控制鈕開槽
    const O = R(81.5, 82.3, -2.6, 2.6);
    for (const [y0, y1, z] of [[-HY, -32.06, 0], [-32.06, -17.94, 1.06], [-17.94, 17.94, 0], [17.94, 36.06, 1.26], [36.06, HY, 0]]) {
      if (!z) prisms.push(pr(y0, y1, f, O));
      else prisms.push(pr(y0, y1, f, R(81.5, 82.3, -2.6, -z)), pr(y0, y1, f, R(81.5, 82.3, z, 2.6))); // 側鍵開槽
    }
  }
  // 頂邊／底邊：右半依音量鍵、USB-C 開口拆成數段
  const wall = (y0, y1, holes) => {
    if (side < 0 || !holes.length) { prisms.push(pr(y0, y1, f, m(end))); return; }
    let x = 7.5;
    for (const [a, b, z0, z1] of holes) {
      prisms.push(pr(y0, y1, f, R(x, a, -2.6, 2.6)), pr(y0, y1, f, R(a, b, -2.6, z0)), pr(y0, y1, f, R(a, b, z1, 2.6)));
      x = b;
    }
    prisms.push(pr(y0, y1, f, R(x, 81.5, -2.6, 2.6)));
  };
  wall(IY, HY, [[61.94, 70.06, -1.26, 1.26], [71.94, 80.06, -1.26, 1.26]]); // 音量鍵
  wall(-HY, -IY, [[37.94, 47.0, -1.86, 1.52]]);                               // USB-C 開口
  return {
    id: side < 0 ? 'bandL' : 'bandR', zh: side < 0 ? '左半鈦邊框' : '右半鈦邊框', en: side < 0 ? 'Ti band L' : 'Ti band R',
    group: f, mat: 'tiPolish', est: false,
    dims: side < 0 ? '0.8 壁厚 × 117.8 × 5.2' : '0.8 壁厚 × 117.8 × 5.2，含側鍵／音量鍵／USB-C 開口',
    note: 'Grade 5 鈦合金外框，三邊包覆，於鉸鏈端與中框接合。',
    prisms,
  };
}
export const makeBandL = D => makeBand(D, -1);
export const makeBandR = D => makeBand(D, 1);

// 4. 弧形滑軌（虛擬樞軸）：與機身一體，在中脊弧槽內繞樞軸轉動
export function sliderShape(D) {
  const s = D.slider;
  return uni(sector(-PX, PZ, s.r0, s.tip, s.b0, s.b1), sector(-PX, PZ, s.r1 - 0.05, 2.75, s.web[0], s.web[1]));
}
function makeSlider(D, side) {
  const f = side < 0 ? 'L' : 'R', z = side < 0 ? ZONE.A : ZONE.B, sh = side < 0 ? sliderShape(D) : M(sliderShape(D));
  const s = D.slider;
  return {
    id: side < 0 ? 'sliderL' : 'sliderR', zh: side < 0 ? '左弧形滑軌' : '右弧形滑軌', en: side < 0 ? 'Arc slider L' : 'Arc slider R',
    group: f, mat: 'tiDark', est: true,
    dims: `R${s.r0}–R${s.r1} 弧帶，${s.b1 - s.b0}° 弧長，外緣齒 m0.05，厚 ${(z[1] - z[0]).toFixed(1)}（上下各一）`,
    note: '鈦合金，固定在機身上，沿中脊弧槽繞虛擬樞軸 (∓1.925, 1.125) 轉動；外緣齒條帶動同步齒輪。',
    prisms: symY(z[0] + D.yGap, z[1] - D.yGap).map(([a, b]) => pr(a, b, f, sh)),
  };
}
export const makeSliderL = D => makeSlider(D, -1);
export const makeSliderR = D => makeSlider(D, 1);

// 5. 同步齒輪組（6 顆惰輪，7 次嚙合 → 兩半反向等速）
export function gearList(D) {
  const m = 0.05, L = D.gears.map(g => ({ ...g, p: m * g.n / 2, tip: m * g.n / 2 + m }));
  return [...L, ...L.map(g => ({ ...g, x: -g.x })).reverse()];
}
export function makeGears(D) {
  const gs = gearList(D);
  return {
    id: 'sync', zh: '同步齒輪組', en: 'Sync gear train', group: 'G', mat: 'steel', est: true,
    dims: gs.slice(0, 3).map(g => `${g.n}T`).join('／') + '（×2，m0.05，長 13）',
    note: '不鏽鋼長齒輪軸。左右滑軌齒條各咬一端，6 顆惰輪 7 次嚙合 → 兩半反向同角度轉動。',
    gears: gs,
    prisms: symY(ZONE.chain[0] + D.yGap, ZONE.chain[1] - D.yGap).flatMap(([a, b]) => gs.map((g, i) => pr(a, b, 'S', circle(g.x, g.z, g.tip), 'g' + i))),
  };
}

// 6. 內螢幕（7.6 吋可摺疊 OLED + UTG）
export function makeDisplay(D) {
  const bond = R(-80.5, -DISP.bond, DISP.nz - DISP.t / 2, DISP.nz + DISP.t / 2);
  return {
    id: 'display', zh: '內螢幕', en: 'Inner display', group: 'D', mat: 'oled', est: false,
    dims: '161.0 × 114.6 × 0.40（可視 157.7 × 110.9，7.6 吋 1878 × 2670）',
    note: '可摺疊 OLED 疊層。兩側黏在中板上，中間 13 mm 自由段摺成兩段等半徑圓弧（水滴形）。',
    prisms: [
      pr(-57.3, 57.3, 'L', bond, 'bondL'),
      pr(-57.3, 57.3, 'R', M(bond), 'bondR'),
      { y0: -57.3, y1: 57.3, frame: 'S', tag: 'fold', shapeAt: st => foldShape(st.phi) },
    ],
  };
}

// 7. 碳纖維支撐板（左右各一，鉸接在中脊凹槽邊）
export function makePlates(D) {
  const ps = plateShape(D);
  const prisms = [];
  for (const [y0, y1] of D.plate.ys) {
    prisms.push(pr(y0, y1, 'PL', ps, 'pl'), pr(y0, y1, 'PR', M(ps), 'pr'));
  }
  return {
    id: 'plates', zh: '碳纖維支撐板', en: 'CF support plates', group: 'P', mat: 'carbon', est: true,
    dims: `${D.plate.L} × ${D.plate.t} 截面，${D.plate.ys.length} 段共 ${D.plate.ys.reduce((s, [a, b]) => s + b - a, 0).toFixed(1)} 長 ×2`,
    note: '攤平時托住螢幕中段；摺疊時依 ψ(φ) 向下翻，讓出水滴形空間。',
    prisms,
  };
}

// 8. 外螢幕（左半背面）
export function makeOuterGlass() {
  return {
    id: 'outerGlass', zh: '外螢幕玻璃', en: 'Outer cover glass', group: 'L', mat: 'glass', est: false,
    dims: '79.0 × 116.0 × 0.45', note: 'Ceramic Shield 前蓋，保護 5.4 吋外螢幕。',
    prisms: [pr(-58.0, 58.0, 'L', R(-81.4, -2.4, -2.6, -2.15))],
  };
}
export function makeOuterPanel() {
  return {
    id: 'outerPanel', zh: '外螢幕面板', en: 'Outer OLED', group: 'L', mat: 'oledBack', est: false,
    dims: '78.0 × 115.2 × 0.40（可視 77.2 × 112.3，5.4 吋 1398 × 2034）', note: 'LTPO OLED，貼合在前蓋玻璃下方。',
    prisms: [pr(-57.6, 57.6, 'L', R(-80.8, -2.8, -2.15, -1.75))],
  };
}

// 9. 右半背面：背玻璃、相機凸台、相機
const CAM = { main: [63, 75, 38, 50], uw: [64.25, 73.75, 21.25, 30.75], plat: [58, 80, 15, 55] };
export function makeBackGlass() {
  const [px0, px1, py0, py1] = CAM.plat, g = 0.06;
  return {
    id: 'backGlass', zh: '背玻璃', en: 'Back glass', group: 'R', mat: 'frost', est: false,
    dims: '79.0 × 116.0 × 0.45，相機開口 22.1 × 40.1', note: '霧面玻璃背蓋，相機凸台處開孔。',
    prisms: [
      pr(-58.0, py0 - g, 'R', R(2.4, 81.4, -2.6, -2.15)),
      pr(py0 - g, py1 + g, 'R', R(2.4, px0 - g, -2.6, -2.15)), pr(py0 - g, py1 + g, 'R', R(px1 + g, 81.4, -2.6, -2.15)),
      pr(py1 + g, 58.0, 'R', R(2.4, 81.4, -2.6, -2.15)),
    ],
  };
}
export function makePlateau() {
  const [px0, px1, py0, py1] = CAM.plat, g = 0.06, z = [-4.40, -2.05];
  const hole = ([x0, x1, y0, y1]) => [y0 - g, y1 + g, [R(px0, x0 - g, ...z), R(x1 + g, px1, ...z)]];
  const [ua, ub, us] = hole(CAM.uw), [ma, mb, ms] = hole(CAM.main);
  return {
    id: 'plateau', zh: '相機凸台', en: 'Camera plateau', group: 'R', mat: 'tiDark', est: true,
    dims: '22.0 × 40.0 × 2.35（凸出背面 1.80）', note: '鈦合金凸台，相機鏡片退入台面 0.10。',
    prisms: [pr(py0, ua, 'R', R(px0, px1, ...z)), ...us.map(s => pr(ua, ub, 'R', s)), pr(ub, ma, 'R', R(px0, px1, ...z)), ...ms.map(s => pr(ma, mb, 'R', s)), pr(mb, py1, 'R', R(px0, px1, ...z))],
  };
}
export function makeMainCam() {
  const [x0, x1, y0, y1] = CAM.main;
  return { id: 'mainCam', zh: '主相機 48MP', en: 'Main camera', group: 'R', mat: 'cam', est: true,
    dims: '12.0 × 12.0 × 5.85', note: '感光元件位移防手震模組，鏡頭穿過主機板開孔。',
    prisms: [pr(y0, y1, 'R', R(x0, x1, -4.30, 1.55))] };
}
export function makeUltraWide() {
  const [x0, x1, y0, y1] = CAM.uw;
  return { id: 'uwCam', zh: '超廣角相機', en: 'Ultra wide', group: 'R', mat: 'cam', est: true,
    dims: '9.5 × 9.5 × 5.30', note: '超廣角模組。', prisms: [pr(y0, y1, 'R', R(x0, x1, -4.30, 1.0))] };
}

// 10. 主機板、電池
export function makeBoard() {
  const g = 0.06, z = [-1.4, 1.55], X = [55, 79.0];
  const [mx0, mx1, my0, my1] = CAM.main, [ux0, ux1, uy0, uy1] = CAM.uw;
  return {
    id: 'board', zh: '主機板（A20 Pro）', en: 'Logic board', group: 'R', mat: 'pcb', est: true,
    dims: '24.0 × 102.0 × 2.95（單層板含屏蔽罩）', note: '單層主機板，A20 Pro、記憶體與數據機在屏蔽罩下；相機穿孔。',
    prisms: [
      pr(-46, uy0 - g, 'R', R(...X, ...z)),
      pr(uy0 - g, uy1 + g, 'R', R(X[0], ux0 - g, ...z)), pr(uy0 - g, uy1 + g, 'R', R(ux1 + g, X[1], ...z)),
      pr(uy1 + g, my0 - g, 'R', R(...X, ...z)),
      pr(my0 - g, my1 + g, 'R', R(X[0], mx0 - g, ...z)), pr(my0 - g, my1 + g, 'R', R(mx1 + g, X[1], ...z)),
      pr(my1 + g, 56, 'R', R(...X, ...z)),
    ],
  };
}
export function makeBatteryL() {
  return { id: 'battL', zh: '左電池 2,962 mAh', en: 'Battery L', group: 'L', mat: 'batt', est: false,
    dims: '70.5 × 71.0 × 3.05（11.56 Wh）', note: '容量為公開值；尺寸依 760 Wh/L 推算。',
    prisms: [pr(-42, 29, 'L', R(-79, -8.5, -1.5, 1.55))] };
}
export function makeBatteryR() {
  return { id: 'battR', zh: '右電池 1,921 mAh', en: 'Battery R', group: 'R', mat: 'batt', est: false,
    dims: '44.5 × 73.0 × 3.05（7.5 Wh）', note: '容量為公開值；尺寸依 760 Wh/L 推算。',
    prisms: [pr(-42, 31, 'R', R(8.5, 53, -1.5, 1.55))] };
}

// 10b. 其他內部件（零件表 #12–14、#21、#24、#25）
export function makeFrontCam() {
  return { id: 'frontCam', zh: '前鏡頭 12MP', en: 'Front camera', group: 'L', mat: 'cam', est: true,
    dims: '8.5 × 8.5 × 2.99', note: '外螢幕打孔鏡頭。本體在外螢幕面板上方 0.06，面板與蓋板玻璃的開孔沒有建模。',
    prisms: [pr(47.0, 55.5, 'L', R(-46.35, -37.85, -1.69, 1.30))] };
}
export function makeSubBoardL() {
  return { id: 'subL', zh: '左半轉接板', en: 'Sub board L', group: 'L', mat: 'pcb', est: true,
    dims: '28.0 × 18.0 × 1.79（含屏蔽罩）', note: '外螢幕與左電池的轉接板，跨鉸鏈排線的板對板連接器在它上方。',
    prisms: [pr(31, 49, 'L', R(-36, -8, -1.40, 0.39))] };
}
export function makeTaptic() {
  return { id: 'taptic', zh: '線性振動馬達', en: 'Taptic Engine', group: 'L', mat: 'steel', est: true,
    dims: '28.0 × 8.0 × 2.80', note: '左半底部。',
    prisms: [pr(-57.4, -49.4, 'L', R(-50, -22, -1.30, 1.50))] };
}
export function makeMagSafe() { // 圓環：沿 y 切成 2 mm 的條，每條取該範圍內的最大 x 區間（保守）
  const cx = 35, cy = -2, ro = 27, ri = 23, prisms = [];
  const span = (r, y) => Math.abs(y) >= r ? null : Math.sqrt(r * r - y * y);
  for (let y0 = cy - ro; y0 < cy + ro - 1e-9; y0 += 2) {
    const y1 = Math.min(y0 + 2, cy + ro), near = Math.max(0, Math.min(Math.abs(y0 - cy), Math.abs(y1 - cy), (y0 - cy) * (y1 - cy) < 0 ? 0 : 1e9));
    const far = Math.max(Math.abs(y0 - cy), Math.abs(y1 - cy));
    const o = span(ro, near), i = span(ri, far);
    if (o === null) continue;
    if (i === null) prisms.push(pr(y0, y1, 'R', R(cx - o, cx + o, -2.09, -1.56)));
    else prisms.push(pr(y0, y1, 'R', R(cx - o, cx - i, -2.09, -1.56)), pr(y0, y1, 'R', R(cx + i, cx + o, -2.09, -1.56)));
  }
  return { id: 'magsafe', zh: 'MagSafe 線圈與磁鐵環', en: 'MagSafe ring', group: 'R', mat: 'mag', est: true,
    dims: '外徑 54.0／內徑 46.0 × 0.53', note: '貼在背玻璃內側，與電池之間各留 0.06。', prisms };
}
export function makeSpeakers() {
  const box = R(20, 34, -1.30, 1.30);
  return { id: 'speakers', zh: '上下喇叭', en: 'Speakers', group: 'R', mat: 'tiDark', est: true,
    dims: '14.0 × 8.0 × 2.60 ×2', note: '右半頂部與底部，立體聲。',
    prisms: [pr(49.5, 57.5, 'R', box), pr(-51.0, -43.0, 'R', box)] };
}
export function makeUdCam() {
  return { id: 'udCam', zh: '內螢幕下鏡頭', en: 'Under-display camera', group: 'R', mat: 'cam', est: true,
    dims: '6.0 × 6.0 × 2.75', note: '隱藏在內螢幕下，透過中板開孔取景。',
    prisms: [pr(50, 56, 'R', R(38, 44, -1.20, 1.55))] };
}

// 11. 闔上磁鐵
export function makeMagnets(D) {
  const prisms = [];
  for (const [a, b] of D.magR) { prisms.push(pr(a, b, 'L', R(-81.4, -79.4, -1.4, 1.4), 'mL'), pr(a, b, 'R', R(79.4, 81.4, -1.4, 1.4), 'mR')); }
  return { id: 'magnets', zh: '闔上磁鐵', en: 'Closure magnets', group: 'M', mat: 'mag', est: true,
    dims: `2.0 × 2.8 × 14.0 ×${prisms.length}`, note: 'N52 釹磁鐵，左右外緣相對，闔上時互吸。', prisms };
}

// 12. USB-C（模組化）
export function makeUsbC() {
  return { id: 'usbc', zh: 'USB-C 模組', en: 'USB-C module', group: 'R', mat: 'steel', est: true,
    dims: '8.94 × 7.0 × 3.26', note: '可單獨更換的接口模組，開口在右半底邊。',
    prisms: [pr(-HY, -51.9, 'R', R(38.0, 46.94, -1.80, 1.46))] };
}

// 13. 按鍵（帽＋開關），動畫時沿 −x／−y 按下 0.06
export function makeTouchId() {
  return { id: 'touchId', zh: 'Touch ID 側鍵', en: 'Touch ID key', group: 'K', mat: 'tiPolish', est: false,
    dims: '鍵帽 1.15 × 18.0 × 2.4，指紋感測器 0.64 × 14.0', note: '右緣電源鍵兼指紋辨識，鍵帽與開關間隙 0.06。',
    prisms: [pr(18, 36, 'R', R(81.6, 82.75, -1.2, 1.2), 'cap'), pr(20, 34, 'R', R(80.9, 81.54, -0.9, 0.9), 'sw')],
    press: { tag: 'cap', dx: -0.06 } };
}
export function makeCamControl() {
  return { id: 'camCtl', zh: '相機控制鈕', en: 'Camera Control', group: 'K', mat: 'sapphire', est: false,
    dims: '鍵帽 1.15 × 14.0 × 2.0，力感測器 0.64 × 12.0', note: '藍寶石鍵帽＋壓力與觸控感測。',
    prisms: [pr(-32, -18, 'R', R(81.6, 82.75, -1.0, 1.0), 'cap'), pr(-31, -19, 'R', R(80.9, 81.54, -0.8, 0.8), 'sw')],
    press: { tag: 'cap', dx: -0.06 } };
}
export function makeVolume() {
  return { id: 'volume', zh: '音量鍵', en: 'Volume keys', group: 'K', mat: 'tiPolish', est: false,
    dims: '8.0 × 1.19 × 2.4 ×2', note: '位於右半頂邊。',
    prisms: [pr(58.16, 59.35, 'R', R(62, 70, -1.2, 1.2), 'cap'), pr(58.16, 59.35, 'R', R(72, 80, -1.2, 1.2), 'cap'),
      pr(57.4, 58.10, 'R', R(62.5, 69.5, -0.6, 0.6), 'sw'), pr(57.4, 58.10, 'R', R(72.5, 79.5, -0.6, 0.6), 'sw')],
    press: { tag: 'cap', dy: -0.06 } };
}

// 14. 跨鉸鏈排線（上：外螢幕訊號；下：左電池供電），自由段為彈性線
export function fpcEnvWorld(D) {
  return sweepEnv('fpcW' + D.fpc.ax + ',' + D.fpc.az + ',' + D.fpc.extra, {
    phis: PHIS, margin: 0.08, bb: [-6.2, 6.2, -2.6, 5.4],
    at: phi => { const r = fpcFree(D, phi); return r && { shape: r, T: { c: 1, s: 0, tx: 0, tz: 0 } }; },
  }).shape;
}
export function fpcEnvBody(D) {
  return sweepEnv('fpcB' + D.fpc.ax + ',' + D.fpc.az + ',' + D.fpc.extra, {
    phis: PHIS, margin: 0.08, bb: [-6.2, -0.5, -2.6, 2.4],
    at: phi => { const r = fpcFree(D, phi); return r && { shape: r, T: rotAbout(-PX, PZ, -phi) }; },
  }).shape;
}
function fpcGroove(D) { return R(-14.0, D.fpc.ax + 0.05, D.fpc.az - 0.09, D.fpc.az + 0.09); }
export function fpcStatic(D) { // 機身內固定段（左半座標）：錨點往外走到板對板連接器
  const pts = []; for (let x = D.fpc.ax; x >= -12.0; x -= 0.05) pts.push([x, D.fpc.az]);
  return ribbon(pts.reverse(), 0.02);
}
function makeFpc(D, which) {
  const y = which === 1 ? ZONE.fpcCable : [-ZONE.fpcCable[1], -ZONE.fpcCable[0]];
  const st = fpcStatic(D), con = R(-13.7, -12.05, D.fpc.az - 0.45, D.fpc.az + 0.45);
  return {
    id: 'fpc' + which, zh: which === 1 ? '跨鉸鏈排線（上）' : '跨鉸鏈排線（下）', en: 'Hinge FPC ' + which, group: 'F', mat: 'fpc', est: true,
    dims: `寬 6.0 × 厚 0.04，自由段 ${(2 * (-D.fpc.ax + D.fpc.extra)).toFixed(2)}，動態最小彎曲半徑 0.80`,
    note: which === 1 ? '外螢幕與觸控訊號：左半 → 右半主機板。' : '左電池供電：左半 → 右半主機板。',
    prisms: [
      { y0: y[0], y1: y[1], frame: 'S', tag: 'free', shapeAt: st => fpcFree(D, st.phi) },
      pr(y[0], y[1], 'L', st, 'stL'), pr(y[0], y[1], 'R', M(st), 'stR'),
      pr(y[0] - 0.3, y[1] + 0.3, 'L', con, 'conL'), pr(y[0] - 0.3, y[1] + 0.3, 'R', M(con), 'conR'),
    ],
    bend: true,
  };
}
export const makeFpc1 = D => makeFpc(D, 1);
export const makeFpc2 = D => makeFpc(D, 2);

// 組裝順序（逐件放置）
export const BUILD = [
  ['spine', makeSpine], ['frameL', makeFrameL], ['frameR', makeFrameR], ['bandL', makeBandL], ['bandR', makeBandR],
  ['sliderL', makeSliderL], ['sliderR', makeSliderR], ['sync', makeGears], ['display', makeDisplay], ['plates', makePlates],
  ['outerGlass', makeOuterGlass], ['outerPanel', makeOuterPanel], ['backGlass', makeBackGlass], ['plateau', makePlateau],
  ['mainCam', makeMainCam], ['uwCam', makeUltraWide], ['board', makeBoard], ['battL', makeBatteryL], ['battR', makeBatteryR],
  ['frontCam', makeFrontCam], ['subL', makeSubBoardL], ['taptic', makeTaptic], ['magsafe', makeMagSafe], ['speakers', makeSpeakers], ['udCam', makeUdCam],
  ['magnets', makeMagnets], ['usbc', makeUsbC], ['touchId', makeTouchId], ['camCtl', makeCamControl], ['volume', makeVolume],
  ['fpc1', makeFpc1], ['fpc2', makeFpc2],
];
