// ═══ 多層的步行面：同一個 x、z 有兩個高度的地方（北嶺鐵道橋的橋面與橋下、隧道與上面的山頭，21-rail.js）═══
// groundH 只有一個高度（地形）。WALKS 的每一項是 { zn, bb: [x0, x1, z0, z1]（zn 的邏輯座標）, y(x, z, y0, cam), ceil? }：
//   y 回傳數字＝站在這個高度；null＝擋住（走不進去）；undefined＝不管（照地形）。y0 是現在的高度，用來分辨在橋上還是橋下。
//   cam 為真時是相機在問：只要地板高度，不要擋（護欄、洞壁也回傳地板）。
//   ceil(x, z, y0)：相機的天花板（隧道裡），沒有就回傳 undefined；clampCam(x, z, y0)：相機要待在裡面的話回傳拉回來的 [x, z]（隧道的洞壁）。
// 40-people.js 走路時先用 walkStep 擋住、再用 walkY 取站的高度；99-main.js 的相機用 walkCam 取地板與天花板。都是世界座標進出
const WALKS = [];
function walkAt(X, Z, y0, cam) {
  for (const w of WALKS) {
    const [x, z] = toL(X, Z, w.zn);
    if (x < w.bb[0] || x > w.bb[1] || z < w.bb[2] || z > w.bb[3]) continue;
    const y = w.y(x, z, y0, cam);
    if (y !== undefined) return y;
  }
  return undefined;
}
// 從 (ox, oz) 走到 (x, z)：被擋就沿著兩個軸各試一次（貼著護欄滑過去），都不行就留在原地
function walkStep(ox, oz, x, z, y0) {
  if (!WALKS.length || walkAt(x, z, y0) !== null) return [x, z];
  if (walkAt(x, oz, y0) !== null) return [x, oz];
  if (walkAt(ox, z, y0) !== null) return [ox, z];
  return [ox, oz];
}
const walkY = (X, Z, y0, h) => { if (!WALKS.length) return h; const y = walkAt(X, Z, y0); return y == null ? h : y; };
// 相機：[地板, 天花板, X, Z]（h 是地形的地板；X、Z 是拉回洞裡之後的相機位置）
function walkCam(X, Z, y0, h) {
  if (!WALKS.length) return [h, 999, X, Z];
  let c = 999;
  for (const w of WALKS) {
    let [x, z] = toL(X, Z, w.zn);
    if (x < w.bb[0] || x > w.bb[1] || z < w.bb[2] || z > w.bb[3]) continue;
    const q = w.clampCam && w.clampCam(x, z, y0);
    if (q) { [X, Z] = toW(q[0], q[1], w.zn); [x, z] = q; }
    const v = w.ceil && w.ceil(x, z, y0); if (v !== undefined) c = Math.min(c, v);
  }
  const y = walkAt(X, Z, y0, 1);
  return [y == null ? h : y, c, X, Z];
}
