// 改裝外觀件的安裝點：量 assets/260/<id>.glb 的車身，寫回 assets/260/cars.json 的 kit（66-chrome.js 的 modParts 照它把前下巴、防撞鋼架、
// 尾翼、排氣尾管、側排管與底盤霓虹貼著這台車的真實外形做出來）
//   node tools/kitfit.mjs [id…]      DEBUG=1 印每台車的數值
// 車身（不含 wheel_ 節點、貼地 3 cm 內的陰影片）的三角形分別投影到俯視（x, z）、正視（x, y）、側視（z, y）三張 2.5 cm 的格子，
// 每格記最高／最低（俯視）、最前／最後（正視）、最外側（側視）的那一點：
//   f／r   前、後保險桿貼地那一圈（最低點 + 3 cm）的平面輪廓：[y, 半寬, a, b, c]，z = a + b·x² + c·x⁴（貼著外側包絡擬合，進氣口的凹洞不算）
//   fm／rm 保險桿中段（最低點到引擎蓋前緣／尾箱後緣高度的 45%）的輪廓，同樣格式
//   s      側裙：[外側 x, 下緣 y, 前端 z, 後端 z, 車底中央離地]（前後輪拱之間）
//   d      尾箱後緣：[半寬, y0, ky, z0, kz, yf0, kyf]，後緣高度 y0 + ky·x²、位置 z0 + kz·x²，往前 15 cm 的尾箱面高度 yf0 + kyf·x²
//   wing   1 是原廠就有尾翼（側視的車尾翼面底下看得穿），這種車不能再裝尾翼（66-chrome.js 的 modCan）
// 機車跳過。gltf-transform 與 meshoptimizer 借 197 的 node_modules（和 tools/cars.mjs、seats.mjs 一樣）。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { MeshoptDecoder } = await imp('meshoptimizer');
await MeshoptDecoder.ready;

const OUT = resolve(root, '../../assets/260');
const manifestPath = resolve(OUT, 'cars.json');
const spec = JSON.parse(readFileSync(manifestPath, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const only = process.argv.slice(2);
const C = .025;
// 偵測不準的車（對過 car-view 的側視圖）：RX-7 的拱形尾翼底下的縫太窄；Evija、SLK 55 的車尾沒有尾翼（Evija 是車身的導流道、SLK 是硬頂的收納縫）
const WING = { rx7: 1, evija: 0, slk55: 0 };
const r3 = (v) => Math.round(v * 1000) / 1000;
const median = (a) => { const b = a.filter(Number.isFinite).sort((p, q) => p - q); return b.length ? b[b.length >> 1] : NaN; };

// 一張投影格子：u、v 是投影平面的兩軸，記每格深度的最大與最小
function grid(u0, u1, v0, v1) {
  const nu = Math.ceil((u1 - u0) / C) + 1, nv = Math.ceil((v1 - v0) / C) + 1;
  const hi = new Float32Array(nu * nv).fill(-Infinity), lo = new Float32Array(nu * nv).fill(Infinity);
  return {
    u0, v0, nu, nv, hi, lo,
    // 三角形（a、b、c 是 [u, v, 深度]）蓋到的格點都更新
    tri(a, b, c) {
      const iu0 = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - u0) / C)), iu1 = Math.min(nu - 1, Math.floor((Math.max(a[0], b[0], c[0]) - u0) / C));
      const iv0 = Math.max(0, Math.ceil((Math.min(a[1], b[1], c[1]) - v0) / C)), iv1 = Math.min(nv - 1, Math.floor((Math.max(a[1], b[1], c[1]) - v0) / C));
      const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-12) return;
      for (let iu = iu0; iu <= iu1; iu++) for (let iv = iv0; iv <= iv1; iv++) {
        const pu = u0 + iu * C, pv = v0 + iv * C;
        const l1 = ((b[1] - c[1]) * (pu - c[0]) + (c[0] - b[0]) * (pv - c[1])) / d, l2 = ((c[1] - a[1]) * (pu - c[0]) + (a[0] - c[0]) * (pv - c[1])) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        const z = l1 * a[2] + l2 * b[2] + l3 * c[2], k = iu * nv + iv;
        if (z > hi[k]) hi[k] = z;
        if (z < lo[k]) lo[k] = z;
      }
    },
    at(arr, u, v) { const iu = Math.round((u - u0) / C), iv = Math.round((v - v0) / C); return iu < 0 || iv < 0 || iu >= nu || iv >= nv ? NaN : Number.isFinite(arr[iu * nv + iv]) ? arr[iu * nv + iv] : NaN; },
  };
}

// 對稱曲線 v(x) = a + b·x² + c·x⁴ 的穩健擬合，貼著外側的包絡（sg = 1 取大的一側、−1 取小的一側）：
// 每輪丟掉落在曲線內側 3 cm 以上的點（進氣口、車牌凹槽、尾燈的凹洞），最後的半寬是最外側一個貼著曲線（內外 5 cm 內）、而且從中間到它有六成的點都貼著的點（中間的凹洞不算斷掉，輪拱以外整段離開曲線）
function fitEven(pts, sg, quart = true) {
  let use = pts.slice(), p = [0, 0, 0];
  for (let it = 0; it < 6 && use.length >= 4; it++) {
    const B = ([x]) => quart ? [1, x * x, x ** 4] : [1, x * x], n = quart ? 3 : 2;
    const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
    for (const q of use) { const b = B(q); for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += b[i] * b[j]; A[i][n] += b[i] * q[1]; } }
    for (let i = 0; i < n; i++) A[i][i] += 1e-9;
    for (let i = 0; i < n; i++) for (let k = i + 1; k < n; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j <= n; j++) A[k][j] -= f * A[i][j]; }
    const r = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let v = A[i][n]; for (let j = i + 1; j < n; j++) v -= A[i][j] * r[j]; r[i] = v / A[i][i]; }
    p = quart ? r : [r[0], r[1], 0];
    use = pts.filter(([x, v]) => sg * (v - ev(p, x)) > -.03);
  }
  let hw = 0, n = 0, ok = 0; for (const [x, v] of pts.slice().sort((a, b) => a[0] - b[0])) { n++; if (Math.abs(v - ev(p, x)) <= .05) { ok++; if (ok >= n * .6) hw = x; } }
  return { p, hw };
}
const ev = (p, x) => p[0] + p[1] * x * x + p[2] * x ** 4;
// 正視或後視的輪廓：y 高度那一排每 2.5 cm 的最前（front）或最後的 z（左右平均），擬合成 [y, 半寬, a, b, c]（z = a + b·x² + c·x⁴）
function contour(G, y, front) {
  const arr = front ? G.hi : G.lo, pts = [];
  for (let x = 0; x < 1.4; x += C) { const a = G.at(arr, x, y), b = G.at(arr, -x, y); if (Number.isFinite(a) && Number.isFinite(b)) pts.push([x, (a + b) / 2]); }   // 中間的格柵、車牌框可能是空的，跳過
  if (pts.length < 8) return null;
  const { p, hw } = fitEven(pts, front ? 1 : -1);
  return hw < .3 ? null : [r3(y), r3(hw), r3(p[0]), r3(p[1]), r3(p[2])];
}

for (const [id, s] of Object.entries(spec)) {
  if (s.bike || only.length && !only.includes(id)) continue;
  const doc = await io.read(resolve(OUT, `${id}.glb`));
  const tris = [];
  const v = [0, 0, 0];
  let car = null;
  for (const n of doc.getRoot().listNodes()) if (n.getName() === 'car') car = n;
  const inv = invert(car ? car.getWorldMatrix() : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    let wheel = false; for (let p = node; p; p = p.getParentNode && p.getParentNode()) if (/wheel/i.test(p.getName())) wheel = true;
    if (wheel) continue;
    const m = mul(inv, node.getWorldMatrix());
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), P = [];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        P.push([m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]);
      }
      const n = idx ? idx.getCount() : P.length;
      for (let i = 0; i < n; i += 3) {
        const a = P[idx ? idx.getScalar(i) : i], b = P[idx ? idx.getScalar(i + 1) : i + 1], c = P[idx ? idx.getScalar(i + 2) : i + 2];
        if (a[1] < .03 && b[1] < .03 && c[1] < .03) continue;   // 貼地的陰影片
        tris.push([a, b, c]);
      }
    }
  }
  const L = s.len, W = s.w, H = s.h;
  const top = grid(-W / 2 - .1, W / 2 + .1, -L / 2 - .2, L / 2 + .2);   // u = x, v = z, 深度 y
  const fr = grid(-W / 2 - .1, W / 2 + .1, 0, H + .2);                  // u = x, v = y, 深度 z
  const sd = grid(-L / 2 - .2, L / 2 + .2, 0, H + .2);                  // u = z, v = y, 深度 |x|
  const sc = grid(-L / 2 - .2, L / 2 + .2, 0, H + .2);                  // 同上，只投影中間 1 m 寬（尾翼兩側的端板會擋住側視的縫）
  for (const [a, b, c] of tris) {
    top.tri([a[0], a[2], a[1]], [b[0], b[2], b[1]], [c[0], c[2], c[1]]);
    fr.tri([a[0], a[1], a[2]], [b[0], b[1], b[2]], [c[0], c[1], c[2]]);
    sd.tri([a[2], a[1], Math.abs(a[0])], [b[2], b[1], Math.abs(b[0])], [c[2], c[1], Math.abs(c[0])]);
    if (Math.max(Math.abs(a[0]), Math.abs(b[0]), Math.abs(c[0])) < .5) sc.tri([a[2], a[1], 0], [b[2], b[1], 0], [c[2], c[1], 0]);
  }
  // 車頭、車尾的最前、最後 z（中間 0.6 m 寬、離地 0.15–0.7 m）
  const zs = (front) => { let best = front ? -Infinity : Infinity; for (let x = -.3; x <= .3; x += C) for (let y = .15; y < .7; y += C) { const z = fr.at(front ? fr.hi : fr.lo, x, y); if (Number.isFinite(z)) best = front ? Math.max(best, z) : Math.min(best, z); } return best; };
  const zF = zs(true), zR = zs(false);
  // 保險桿最低點：中間 0.7 m 寬、前（後）端 0.3 m 內的車身底面
  const lowAt = (z0, z1) => median(Array.from({ length: 29 }, (_, i) => { const x = -.35 + i * C; let m = Infinity; for (let z = z0; z <= z1; z += C) { const y = top.at(top.lo, x, z); if (Number.isFinite(y)) m = Math.min(m, y); } return m; }));
  const highAt = (z0, z1) => median(Array.from({ length: 25 }, (_, i) => { const x = -.3 + i * C; let m = -Infinity; for (let z = z0; z <= z1; z += C) { const y = top.at(top.hi, x, z); if (Number.isFinite(y)) m = Math.max(m, y); } return m; }));
  const fy = Math.max(.06, lowAt(zF - .3, zF)), ry = Math.max(.06, lowAt(zR, zR + .3));
  const fh = highAt(zF - .25, zF), rh = highAt(zR, zR + .25);
  const kit = {};
  kit.f = contour(fr, Math.round((fy + .03) / C) * C, true);
  kit.fm = contour(fr, Math.round((fy + (fh - fy) * .45) / C) * C, true);
  kit.r = contour(fr, Math.round((ry + .03) / C) * C, false);
  kit.rm = contour(fr, Math.round((ry + (rh - ry) * .45) / C) * C, false);
  // 側裙：前後輪拱之間（各離輪子 r + 10 cm）
  const sz0 = s.fa - s.wr - .1, sz1 = s.ra + s.wr + .1;
  const sxs = [], sys = [], cys = [];
  for (let z = sz1; z <= sz0; z += C) {
    let xo = -Infinity; for (let y = .1; y < .45; y += C) { const x = sd.at(sd.hi, z, y); if (Number.isFinite(x)) xo = Math.max(xo, x); }
    if (!Number.isFinite(xo)) continue;
    sxs.push(xo);
    let yb = Infinity; for (let x = xo - .12; x <= xo; x += C) for (const sx of [-1, 1]) { const y = top.at(top.lo, sx * x, z); if (Number.isFinite(y)) yb = Math.min(yb, y); }
    sys.push(yb);
    cys.push(top.at(top.lo, 0, z));
  }
  kit.s = [r3(median(sxs)), r3(Math.max(.06, median(sys))), r3(sz0), r3(sz1), r3(Math.max(.06, median(cys)))];
  // 原廠尾翼：側視在車尾 1.2 m 內、離地 0.5 m 以上，從頂往下先有東西、再空 5–35 cm、下面又有東西（翼面底下看得穿），
  // 而且這樣的列連續 10 cm 以上（尾箱蓋後緣往外翻的唇邊底下也是空的，但只有一兩列）；整台車與只看中間 1 m 寬（最後 0.8 m，再往前是車廂）各判一次
  let wing = null;
  for (const [G, zl] of [[sd, 1.2], [sc, .8]]) for (let z = zR, run = []; z < zR + zl; z += C) {
    const occ = []; for (let y = H + .15; y > .5; y -= C) occ.push([y, Number.isFinite(G.at(G.hi, z, y))]);
    const i0 = occ.findIndex(o => o[1]); let hole = null;
    if (i0 >= 0) {
      let i = i0; while (i < occ.length && occ[i][1]) i++;
      let j = i; while (j < occ.length && !occ[j][1]) j++;
      if (j < occ.length && j - i >= 2 && j - i <= 14) hole = [occ[i0][0], z, occ[i][0]];
    }
    if (hole) run.push(hole);
    if ((!hole || z + C >= zR + zl) && run.length) {
      if (run.length >= 4) { const t = run.reduce((p, q) => q[0] > p[0] ? q : p); if (!wing || t[0] > wing[0]) wing = t.map(r3); }
      run = [];
    }
  }
  kit.wing = id in WING ? WING[id] : wing ? 1 : 0;
  // 尾箱後緣：每一列（x 固定）從車尾往前，頂面的坡度第一次變緩（每 5 cm 升不到 3.5 cm）、高於 0.45 m、往前 20 cm 內不再升高 12 cm 以上的那一點
  const edgeAt = (x) => {
    const ys = []; for (let z = zR - .1; z < zR + 1.4; z += C) ys.push([z, top.at(top.hi, x, z)]);
    for (let i = 0; i + 2 < ys.length; i++) {
      const [z, y] = ys[i], y2 = ys[i + 2][1];
      if (!Number.isFinite(y) || !Number.isFinite(y2) || y < .45 || y2 - y > .035) continue;
      let mx = -Infinity; for (let j = i; j < ys.length && ys[j][0] < z + .2; j++) if (Number.isFinite(ys[j][1])) mx = Math.max(mx, ys[j][1]);
      if (mx - y > .12) continue;
      let yf = NaN; for (const [zz, yy] of ys) if (zz >= z + .15) { yf = yy; break; }
      return [y, z, yf];
    }
    return null;
  };
  // 每 2.5 cm 一列量後緣，y、z、往前 15 cm 的高度各自擬合成 a + b·x²：d = [半寬, y0, ky, z0, kz, yf0, kyf]
  const ed = []; for (let x = 0; x < W / 2; x += C) { const a = edgeAt(x), b = edgeAt(-x); if (a && b && Number.isFinite(a[2]) && Number.isFinite(b[2])) ed.push([x, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); }
  if (ed.length >= 8) {
    const fy = fitEven(ed.map(e => [e[0], e[1]]), 1, false), fz = fitEven(ed.map(e => [e[0], e[2]]), -1, false), ff = fitEven(ed.map(e => [e[0], e[3]]), 1, false);
    const hw = Math.min(fy.hw, fz.hw);
    kit.d = hw > .3 ? [r3(hw), r3(fy.p[0]), r3(fy.p[1]), r3(fz.p[0]), r3(fz.p[1]), r3(ff.p[0]), r3(ff.p[1])] : null;
  } else kit.d = null;
  s.kit = kit;
  console.log(`${id.padEnd(9)} 前 ${zF.toFixed(2)} 低 ${fy.toFixed(2)}／後 ${zR.toFixed(2)} 低 ${ry.toFixed(2)} 側裙 x ${kit.s[0]} y ${kit.s[1]} 尾箱 ${kit.d ? `y ${kit.d[1]} z ${kit.d[3]} 半寬 ${kit.d[0]}` : '—'}${kit.wing ? ` 原廠尾翼${wing ? ` y ${wing[0]} z ${wing[1]}` : ''}` : ''}`);
  if (process.env.DEBUG) console.log(JSON.stringify(kit));
}
writeFileSync(manifestPath, JSON.stringify(spec, null, 1) + '\n');

function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}
// 剛體加等比縮放的反矩陣（car 節點只有平移、旋轉、縮放）
function invert(m) {
  const sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
  const R = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz];
  const o = [R[0] / sx, R[3] / sy, R[6] / sz, 0, R[1] / sx, R[4] / sy, R[7] / sz, 0, R[2] / sx, R[5] / sy, R[8] / sz, 0, 0, 0, 0, 1];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  return o;
}
