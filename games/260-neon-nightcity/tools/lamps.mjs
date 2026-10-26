// 實車的頭燈、尾燈（煞車燈）：很多 Sketchfab 原檔的燈罩只是貼圖上的顏色，沒有自發光材質，cars.mjs 的 _EMI 就是空的，
// 夜裡不亮、踩煞車也沒有煞車燈。這裡照位置、朝向與底色（COLOR_0 × 底色貼圖）找出燈，直接改寫 assets/260/<id>.glb 的 _EMI：
//   尾燈：車尾 0.5 m 內、朝後、不是車漆的面整片標成範圍（交給頁面逐像素挑底色紅的）；紅色的車（車身色紅，或兩側不是車漆的面四分之一以上是紅的）
//         只挑很紅、和車身色差得夠多的或透明燈罩；車尾有 30 個以上紅色透明燈罩的頂點時，只取車尾的透明燈罩
//   頭燈：車頭 0.5 m 內、朝前、透明燈罩，或燈殼裡亮白的金屬反光碗（不是車漆）；高度在車身下緣與引擎蓋之間（擋風玻璃不算）
// 寫成燈種 1.25（頭燈）、2.25（尾燈）：26-glb.js 看到小數 .25 就照片段的底色決定哪裡亮（燈罩裡的鍍鉻框、黑色底座不亮），不乘自發光貼圖。
// 判斷不準的車在 FIX 手量範圍，寫成 1.5／2.5（整片發光）。
// 原檔已經有的燈照舊：有 200 個頂點以上就不補；車尾的自發光只認紅色（沒有自發光貼圖、光和燈罩都不紅的是倒車燈，改成不發光，免得一直亮著還跟著煞車閃；
// 燈罩紅、光是白的改成 2.25 逐像素發紅光）。
// 燈的三角形整片換成燈的屬性，和車身共用的頂點拆開（頂點屬性在三角形裡是內插的，不拆的話燈的邊緣會糊成一圈漸層）。
//   node tools/lamps.mjs [id…]       沒給 id 就做 cars.json 裡全部的車；DRY=1 只印統計不寫檔
//   node tools/lamps.mjs --traffic   做 .cache/traffic/ 的車流專用車（tools/traffic.mjs 的來源，gitignore）
// 每台車只能跑一次：cars.mjs 重新產生之後接著跑（倒車燈歸零、紅燈罩改成 2.25 之後，再跑就分不出原本的燈了）。
// tools/traffic.mjs 烘車流低模時照這裡寫的燈種分材質，所以這裡改了要重烘車流。
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);

const toLin = (c) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
export const HEAD = 1.25, TAIL = 2.25, HEAD_RGB = [1, .95, .86], TAIL_RGB = [1, .05, .03];
const isDetected = (k) => k > .5 && Math.abs(k - Math.floor(k) - .25) < .01 || Math.abs(k - Math.floor(k) - .5) < .01;
// 自動判斷不準的車（紅色車身的燈只是貼圖上的紅、燈在車尾很高的地方、原檔的頭燈只有一點點）：手量燈的範圍（車身座標，
// x 是離中線的距離 [內, 外]、y 是高度、d 是離車頭（車尾）最前緣的深度，預設 0.5 m），範圍裡朝前（後）、不是車漆的面整片當燈，寫成 1.5（頭燈）／2.5（尾燈），
// 頁面整片發光、不逐像素挑。用 node 印車尾的文字投影圖（每格標車漆、透明、紅、亮暗）量出來，夜裡踩煞車截圖確認
export const FIX = {
  m3c: { tail: { x: [.4, .85], y: [.73, .9] } },   // 燻黑燈罩
  e92: { tail: { x: [.3, .9], y: [.75, .9] } },
  m4gt3: { head: { x: [.5, .95], y: [.52, .7] }, tail: { x: [.45, 1], y: [.7, .86] } },
  r8: { tail: { x: [.5, 1], y: [.72, .9] } },
  g63: { tail: { x: [.55, 1], y: [.76, 1.12] } },
  evo6: { tail: { x: [.45, .95], y: [.78, 1.02] } },
  sf90: { tail: { x: [.7, 1.1], y: [.98, 1.15] } },
  s1krr19: { tail: { x: [0, .3], y: [.88, .97] } },
  gt3r: { head: { x: [.55, .92], y: [.56, .75], d: .8 } },   // 前下擾流板凸出去，燈在 0.6 m 後面
  gt3rs: { head: { x: [.55, .95], y: [.6, .83] } },
  charger: { head: { x: [.55, .95], y: [.62, .8] } },
  m5f90: { head: { x: [.65, 1.05], y: [.6, .8] } },   // 燻黑燈罩
  spano8: { head: { x: [.6, 1.05], y: [.45, .68] } },
};

// v：{ pos[], nor[], col[]（線性 rgb）, alpha[], metal[], paint[] }（車身座標，車頭 +z）；回傳每個頂點的燈種（0／1／2）
export function findLamps(v, { bike = false, fix = {} } = {}) {
  const n = v.alpha.length;
  let z0 = Infinity, z1 = -Infinity, y1 = 0;
  for (let i = 0; i < n; i++) { z0 = Math.min(z0, v.pos[i * 3 + 2]); z1 = Math.max(z1, v.pos[i * 3 + 2]); y1 = Math.max(y1, v.pos[i * 3 + 1]); }
  // 車身色：有車漆旗標就取車漆，沒有就取兩側車門一帶（朝左右、不透明）的中位數（車頂、引擎蓋常是碳纖維或彩繪條紋）
  const pick = [];
  for (let i = 0; i < n; i++) if (v.paint[i]) pick.push(i);
  const painted = pick.length >= 200;
  if (!painted) { pick.length = 0; for (let i = 0; i < n; i++) if (Math.abs(v.nor[i * 3]) > .8 && v.pos[i * 3 + 1] > y1 * .3 && v.pos[i * 3 + 1] < y1 * .6 && v.alpha[i] >= .99) pick.push(i); }
  const med = (k) => { const a = pick.map((i) => v.col[i * 3 + k]).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };
  const body = [med(0), med(1), med(2)];
  // 紅色（或橘紅）的車：車身色偏紅，或兩側不透明的面超過四分之一是紅的。這種車的車尾整片都是紅的，只能逐頂點挑很紅的、或透明燈罩；
  // 其他車把車尾朝後、不是車漆的面整片標成尾燈的範圍，交給 26-glb.js 逐像素挑底色紅的部分發光（很多燈是畫在貼圖上、落在大三角形中間）
  let side = 0, sideRed = 0;
  for (let i = 0; i < n; i++) {
    const r = v.col[i * 3];
    if (v.paint[i] || v.alpha[i] < .99 || Math.abs(v.nor[i * 3]) < .6 || v.pos[i * 3 + 1] < .3 || v.pos[i * 3 + 1] > y1 * .7) continue;
    side++; if (r > .05 && r > 2.6 * Math.max(v.col[i * 3 + 1], v.col[i * 3 + 2])) sideRed++;
  }
  // 有車漆旗標的車，車漆本來就不算燈，車漆紅不紅無關（消防車、紅色車流車），只看其餘部分
  const redCar = !painted && body[0] > .05 && body[0] > 2.6 * Math.max(body[1], body[2]) || sideRed > side * .25;
  const yTop = bike ? y1 * .95 : Math.min(1.3, y1 * .72), out = new Uint8Array(n);
  const inTail = (i) => !v.paint[i] && v.pos[i * 3 + 2] < z0 + .5 && v.nor[i * 3 + 2] < -.25 && v.pos[i * 3 + 1] > .3 && v.pos[i * 3 + 1] < yTop;
  const isRed = (i) => { const r = v.col[i * 3]; return r > .05 && r > 2.6 * Math.max(v.col[i * 3 + 1], v.col[i * 3 + 2]); };
  // 有紅色的透明燈罩：尾燈就是車尾的透明燈罩（不管紅不紅，交給逐像素挑紅的），不透明的面都不算（紅色車漆、反光片）
  let lens = 0; for (let i = 0; i < n; i++) if (inTail(i) && v.alpha[i] < .99 && isRed(i)) lens++;
  const inBox = (i, bx) => { const ax = Math.abs(v.pos[i * 3]), y = v.pos[i * 3 + 1]; return ax >= bx.x[0] && ax <= bx.x[1] && y >= bx.y[0] && y <= bx.y[1]; };
  for (let i = 0; i < n; i++) {
    if (v.paint[i]) continue;
    const y = v.pos[i * 3 + 1], z = v.pos[i * 3 + 2], nz = v.nor[i * 3 + 2], r = v.col[i * 3], g = v.col[i * 3 + 1], b = v.col[i * 3 + 2];
    // 手量的範圍（3 頭燈、4 尾燈）取代那一端的自動判斷
    if (fix.tail && z < z0 + (fix.tail.d || .5) && nz < -.25) { if (inBox(i, fix.tail)) out[i] = 4; continue; }
    if (fix.head && z > z1 - (fix.head.d || .5) && nz > .25) { if (inBox(i, fix.head)) out[i] = 3; continue; }
    if (y < .3 || y > yTop) continue;
    const red = r > .05 && r > 2.6 * Math.max(g, b);
    if (lens >= 30) { if (inTail(i) && v.alpha[i] < .99) { out[i] = 2; continue; } }
    else if (z < z0 + .5 && nz < -.25 && (redCar ? red && (v.alpha[i] < .99 || r > .2 && r > 5 * Math.max(g, b)) && Math.hypot(r - body[0], g - body[1], b - body[2]) > .2 : true)) { out[i] = 2; continue; }
    const lum = .2126 * r + .7152 * g + .0722 * b, sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (z > z1 - .5 && nz > .25 && !red && (v.alpha[i] < .99 || v.metal[i] && lum > .45 && sat < .12)) out[i] = 1;
  }
  return { type: out, body, redCar, lens: lens >= 30 };
}

// 讀一台車（cars.mjs 的輸出）：車身節點的頂點（車身座標）、底色、旗標；wheel_ 節點不算
export async function carVerts(doc, sharp) {
  const tex = new Map(), prims = [];
  const v = { pos: [], nor: [], col: [], alpha: [], metal: [], paint: [], emiK: [], emiL: [] };
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh || /^wheel_/.test(node.getName())) continue;
    const m = node.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION'), N = p.getAttribute('NORMAL'), C = p.getAttribute('COLOR_0'), PB = p.getAttribute('_PBR'), E = p.getAttribute('_EMI'), UV = p.getAttribute('TEXCOORD_0');
      const load = async (t) => {
        if (!t || !UV) return null;
        let px = tex.get(t);
        if (!px) { const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); px = { data, w: info.width, h: info.height }; tex.set(t, px); }
        return px;
      };
      const px = await load(p.getMaterial()?.getBaseColorTexture()), ex = await load(p.getMaterial()?.getEmissiveTexture());   // 自發光貼圖：燈的顏色常常畫在這裡
      const start = v.alpha.length, a = [], nn = [], c = [], d = [], e = [], uv = [];
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, a); N.getElement(i, nn); C ? C.getElement(i, c) : c.splice(0, 4, 1, 1, 1, 1); PB ? PB.getElement(i, d) : d.splice(0, 4, .6, 0, 0, 0); E ? E.getElement(i, e) : e.splice(0, 4, 0, 0, 0, 0);
        v.pos.push(m[0] * a[0] + m[4] * a[1] + m[8] * a[2] + m[12], m[1] * a[0] + m[5] * a[1] + m[9] * a[2] + m[13], m[2] * a[0] + m[6] * a[1] + m[10] * a[2] + m[14]);
        const q = [m[0] * nn[0] + m[4] * nn[1] + m[8] * nn[2], m[1] * nn[0] + m[5] * nn[1] + m[9] * nn[2], m[2] * nn[0] + m[6] * nn[1] + m[10] * nn[2]], l = Math.hypot(...q) || 1;
        v.nor.push(q[0] / l, q[1] / l, q[2] / l);
        let rgb = [c[0], c[1], c[2]];
        if (px || ex) UV.getElement(i, uv);
        const at = (t) => { const x = Math.min(t.w - 1, Math.max(0, Math.floor(((uv[0] % 1) + 1) % 1 * t.w))), y = Math.min(t.h - 1, Math.max(0, Math.floor(((uv[1] % 1) + 1) % 1 * t.h))), k = (y * t.w + x) * 4; return [0, 1, 2].map((j) => toLin(t.data[k + j] / 255)); };
        if (px) { const s = at(px); rgb = [rgb[0] * s[0], rgb[1] * s[1], rgb[2] * s[2]]; }
        if (ex) { const s = at(ex); e[0] *= s[0]; e[1] *= s[1]; e[2] *= s[2]; }
        v.col.push(...rgb); v.alpha.push(c[3]); v.metal.push(d[1] > .5 ? 1 : 0); v.paint.push(d[3] > .5 ? 1 : 0);
        const lit = e[0] + e[1] + e[2] > .05;
        v.emiK.push(isDetected(e[3]) ? 0 : lit ? Math.round(e[3]) : 0);
        // 原檔車尾的自發光：發紅光或燈罩是紅的才是尾燈（-2：燈罩紅、光是白的，改成紅光），其餘是倒車燈（-1）
        const redE = e[0] > 1.5 * e[1] && e[0] > 1.5 * e[2], redB = rgb[0] > .05 && rgb[0] > 2.6 * Math.max(rgb[1], rgb[2]);
        v.emiL.push(isDetected(e[3]) || !(e[3] > 1.5 && lit) || redE || ex ? 1 : redB ? -2 : -1);   // 有自發光貼圖的照原檔（顏色在貼圖上，逐頂點取樣不準）
      }
      prims.push({ p, start, n: P.getCount() });
    }
  }
  return { v, prims };
}

async function main() {
  const { NodeIO } = await imp('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
  const { MeshoptEncoder, MeshoptDecoder } = await imp('meshoptimizer');
  const sharp = (await imp('sharp')).default;
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const args = process.argv.slice(2), traffic = args[0] === '--traffic';
  const dir = traffic ? resolve(root, '.cache/traffic') : resolve(root, '../../assets/260');
  const manifest = traffic ? null : JSON.parse(readFileSync(resolve(dir, 'cars.json'), 'utf8'));
  const ids = traffic ? (args.length > 1 ? args.slice(1) : readdirSync(dir).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4)))
    : args.length ? args : Object.keys(manifest);
  for (const id of ids) {
    const file = resolve(dir, id + '.glb');
    if (!existsSync(file)) { console.log(`${id}：沒有 ${file}`); continue; }
    const doc = await io.read(file);
    const { v, prims } = await carVerts(doc, sharp);
    const bike = !!manifest?.[id]?.bike;
    const fix = FIX[id] || {};
    const { type, body, redCar, lens } = findLamps(v, { bike, fix });
    // 原檔已有的燈：頭燈夠多就不補；尾燈只算紅色的
    let h0 = 0, t0 = 0, rev = 0;
    for (let i = 0; i < type.length; i++) { if (v.emiK[i] === 1) h0++; if (v.emiK[i] === 2 && v.emiL[i] !== -1) t0++; if (v.emiL[i] === -1) rev++; }
    const addH = h0 < 200, addT = t0 < 200;   // 原檔的燈太少（只有燈眉、一小塊）也補
    let nh = 0, nt = 0, split = 0;
    for (const { p, start, n } of prims) {
      const E = p.getAttribute('_EMI'), I = p.getIndices();
      const idx = I ? Array.from(I.getArray()) : Array.from({ length: n }, (_, i) => i);
      // 每個頂點新的 _EMI：偵測到的燈（要補的那種）或原本的值（清掉上次寫的、倒車燈歸零）
      const emiOf = (i, t) => {
        if (t === 1) return [...HEAD_RGB, HEAD];
        if (t === 2) return [...TAIL_RGB, TAIL];
        if (t === 3) return [...HEAD_RGB, 1.5];
        if (t === 4) return [...TAIL_RGB, 2.5];
        const e = [0, 0, 0, 0]; if (E) E.getElement(i, e);
        if (isDetected(e[3]) || v.emiL[start + i] === -1) return [0, 0, 0, 0];
        if (v.emiL[start + i] === -2) return [...TAIL_RGB, TAIL];   // 燈罩紅、光是白的：和偵測到的燈一樣逐像素挑紅的發光（不乘自發光貼圖）
        return e;
      };
      const want = (i) => { const t = type[start + i]; return t === 1 && addH || t === 2 && addT || t > 2 ? t : 0; };   // 手量的範圍不管原檔有沒有燈都蓋上
      // 三角形的燈種：兩個以上頂點是同一種燈就整片算燈
      const key = new Map(), src = [], emi = [], nidx = new Uint32Array(idx.length);
      for (let f = 0; f < idx.length; f += 3) {
        const w = [want(idx[f]), want(idx[f + 1]), want(idx[f + 2])];
        const t = [1, 2, 3, 4].find((k) => w.filter((x) => x === k).length >= 2) || 0;
        if (t === 1 || t === 3) nh++; else if (t) nt++;
        for (let k = 0; k < 3; k++) {
          const i = idx[f + k], kk = i * 3 + t;
          let o = key.get(kk);
          if (o == null) { o = src.length; key.set(kk, o); src.push(i); emi.push(...emiOf(i, t)); }
          nidx[f + k] = o;
        }
      }
      split += src.length - n;
      if (process.env.DRY) continue;
      // 依新的頂點清單重排每個屬性（量化過的整數陣列照原型別複製）
      for (const s of p.listSemantics()) {
        const A = p.getAttribute(s);
        if (s === '_EMI') continue;
        const es = A.getElementSize(), arr = A.getArray(), out = new arr.constructor(src.length * es);
        for (let j = 0; j < src.length; j++) for (let c = 0; c < es; c++) out[j * es + c] = arr[src[j] * es + c];
        const B = A.clone().setArray(out); p.setAttribute(s, B);
        if (A.listParents().length <= 1) A.dispose();
      }
      const Ea = doc.createAccessor().setType('VEC4').setArray(new Float32Array(emi)).setBuffer(doc.getRoot().listBuffers()[0]);
      if (E) { p.setAttribute('_EMI', Ea); if (E.listParents().length <= 1) E.dispose(); } else p.setAttribute('_EMI', Ea);
      const Ia = doc.createAccessor().setType('SCALAR').setArray(src.length > 65535 ? nidx : new Uint16Array(nidx)).setBuffer(doc.getRoot().listBuffers()[0]);
      if (I) { p.setIndices(Ia); if (I.listParents().length <= 1) I.dispose(); } else p.setIndices(Ia);
    }
    console.log(`${id.padEnd(10)} 車身色 ${body.map((c) => c.toFixed(2)).join(',')}${redCar ? '（紅）' : ''}${lens ? '（燈罩）' : ''}  原有頭燈 ${h0}、尾燈 ${t0}${rev ? `、倒車燈 ${rev}（歸零）` : ''}  →  補頭燈 ${addH || fix.head ? nh : '-'} 面、尾燈 ${addT || fix.tail ? nt : '-'} 面${fix.head || fix.tail ? '（手量範圍）' : ''}（拆出 ${split} 個頂點）`);
    if (!process.env.DRY) await io.write(file, doc);
  }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
