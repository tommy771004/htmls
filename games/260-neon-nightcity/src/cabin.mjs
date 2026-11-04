// 車內重新上色（cars.json 的 cab）：Sketchfab 原檔的車內常是一整片單色（ghost 整片紫、supra 奶油白、f40 全黑），
// 載入時照「原本的底色＋位置在座艙裡」換成接近原車的配色，零件之間的顏色差就是看得出來的分界線。
// 26-glb.js 在切車門之前呼叫（門板跟著帶走新顏色）；tools/door-view.mjs、tools/wheel-view.mjs 用同一份檢查。
// 頂點屬性（tools/cars.mjs 烘的）：color 是線性底色＋不透明度，_pbr 是粗糙／金屬／清漆／車漆旗標，_emi 是自發光（螢幕、按鍵燈）。
// 規則 cab: [{ f, t, T, x, y, z, r, tol }…]，照順序第一條符合的生效：
//   f：原本的底色（sRGB hex，例如 '#7a0074'，可以是陣列；'*' 是任何顏色），tol：容差（0–255 的每個分量，預設 4）
//   t：新的底色（sRGB hex）；T：true 只改有貼圖的零件、這時 t 是乘上去的顏色（貼圖本身不動），沒給 T 只改沒貼圖的零件
//   x、y、z：再限縮範圍（車身座標，x 取絕對值），r：粗糙度（皮革、毛氈約 .75，順便關掉清漆與金屬）
// 一律跳過車漆、半透明（玻璃）與會發光的頂點；範圍是 cabBox 的座艙（車寬內縮 12 cm、地板到窗線上 45 cm、門往後 1.6 m（長車的後座）、往前 0.6 m）。
export const s2l = (c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
export const l2s = (c) => c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055;
export const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const linHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, l2s(v))) * 255).toString(16).padStart(2, '0')).join('');

export function cabBox(spec) {
  const d = spec.door || {}, P = d.ps ? d.ps.flat() : d.p || [[1, .5], [-.5, .5]], zs = P.map((p) => p[0]);
  const belt = Array.isArray(d.belt) ? Math.max(...d.belt.map((p) => p[1])) : d.belt || 1;   // 斜的窗線是 [[z, y]…]
  return { x: spec.w / 2 - .12, y0: .05, y1: belt + .45, z0: Math.min(...zs) - 1.6, z1: Math.max(...zs) + .6 };
}

const inR = (v, r) => !r || v >= r[0] && v <= r[1];
// geo：BufferGeometry（就地改 color、_pbr），rel：網格到車身座標，tex：材質有貼圖，blend：半透明材質。回傳改了幾個頂點
export function cabTint(geo, rel, rules, box, tex, blend) {
  const col = geo.attributes.color, pos = geo.attributes.position, pbr = geo.attributes._pbr, emi = geo.attributes._emi;
  if (!col || !pos || blend || !rules || !rules.length || geo.userData.cab) return 0;
  geo.userData.cab = true;   // 同一份幾何掛在好幾個網格上時只改一次（T 是乘上去的）
  const R = rules.map((q) => ({ ...q, fc: q.f && q.f !== '*' ? [q.f].flat().map((h) => hexRGB(h).map((v) => v * 255)) : null, tc: hexRGB(q.t || '#ffffff').map(s2l), tol: q.tol ?? 4 })).filter((q) => !!q.T === !!tex);
  if (!R.length) return 0;
  const e = rel.elements; let n = 0;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const x = Math.abs(e[0] * px + e[4] * py + e[8] * pz + e[12]), y = e[1] * px + e[5] * py + e[9] * pz + e[13], z = e[2] * px + e[6] * py + e[10] * pz + e[14];
    if (x > box.x || y < box.y0 || y > box.y1 || z < box.z0 || z > box.z1) continue;
    if (pbr && pbr.getW(i) > .5) continue;   // 車漆
    if (emi && emi.getX(i) + emi.getY(i) + emi.getZ(i) > .01) continue;   // 螢幕、按鍵燈
    const r = col.getX(i), g = col.getY(i), b = col.getZ(i), s = [r, g, b].map((v) => l2s(Math.max(0, v)) * 255);
    const q = R.find((q) => inR(x, q.x) && inR(y, q.y) && inR(z, q.z) && (!q.fc || q.fc.some((c) => Math.abs(s[0] - c[0]) <= q.tol && Math.abs(s[1] - c[1]) <= q.tol && Math.abs(s[2] - c[2]) <= q.tol)));
    if (!q) continue;
    if (q.T) col.setXYZ(i, r * q.tc[0], g * q.tc[1], b * q.tc[2]); else col.setXYZ(i, q.tc[0], q.tc[1], q.tc[2]);
    if (q.r != null && pbr) pbr.setXYZ(i, q.r, 0, 0);
    n++;
  }
  if (n) { col.needsUpdate = true; if (pbr) pbr.needsUpdate = true; }
  return n;
}
