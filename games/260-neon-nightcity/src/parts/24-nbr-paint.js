// ═══ 紐柏林維修車間室內的烘焙貼圖（24-nbr-pit.js 用；使用者：「賽場車間的精細度跟貼圖需真實，太像玩具場景」）═══
// 車間的地坪、隔間牆、後牆、天花板與螢幕畫面都是 canvas 畫的「已經打好光」的貼圖（頂燈的光帶、亮面地坪映出的燈管、牆角與天花板邊的陰影、
// 壓克力面板的接縫、輪胎痕與油漬），頁面把它們當 glb 材質的自發光貼圖（不吃太陽：一樓車間在雨棚與樓板下面，原本整片被照成白的）。
// 座標一律用公尺：牆面是「站在車間裡面對它」的左到右、地板到天花板；地坪是從車間裡往門口看的左到右、後牆（0）到門口；
// 每個 draw* 函式只畫一格（一支車隊或一種畫面），24-nbr-pit.js 分幀呼叫。車隊與贊助商都是虛構的 ═══
const NBR_SPONSORS = ['HEXAWERK', 'LUMORA', 'OSTRAX', 'VELTRANO', 'VOLMARK', 'BRENNWALD', 'AURELIN', 'ORVANTA', 'HELMBACH', 'STERNHOF'];
function nbrRng(seed) { let a = seed >>> 0; return () => { a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const nbrHex = (c, k = 1, mix = 0, to = 0) => {   // 0xrrggbb → css，k 倍亮度、mix 往 to 色混
  const ch = s => Math.round(Math.min(255, ((c >> s & 255) * (1 - mix) + (to >> s & 255) * mix) * k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
// 一格的公尺座標框：(x0, y0) 是格子左上角的像素、w×h 像素對 wm×hm 公尺；y 從地面往上（牆）或從後牆往門口（地坪）
function nbrCell(cx, x0, y0, w, h, wm, hm, up = true) {
  const sx = w / wm, sy = h / hm;
  return { cx, x0, y0, w, h, wm, hm, sx, sy, X: m => x0 + m * sx, Y: m => up ? y0 + h - m * sy : y0 + m * sy,
    rect(a, b, c, d, fill) { const ya = this.Y(b), yb = this.Y(d); cx.fillStyle = fill; cx.fillRect(this.X(a), Math.min(ya, yb), (c - a) * sx, Math.abs(yb - ya)); },
    clip() { cx.save(); cx.beginPath(); cx.rect(x0, y0, w, h); cx.clip(); } };
}
function nbrNoise(C, r, n, a, lo = 0, hi = 255) {   // 細的雜點（環氧地坪的色片、噴漆面的顆粒）
  const { cx, x0, y0, w, h } = C;
  for (let i = 0; i < n; i++) { const v = lo + (hi - lo) * r() | 0; cx.fillStyle = `rgba(${v},${v},${v},${a * (.4 + .6 * r())})`; cx.fillRect(x0 + r() * w, y0 + r() * h, 1 + (r() < .2), 1 + (r() < .2)); }
}
function nbrAO(C, side, size, a) {   // 邊緣的陰影：side 是 'l' 'r' 't' 'b'，size 公尺
  const { cx, x0, y0, w, h } = C, sx = C.sx, sy = C.sy, px = side === 'l' || side === 'r' ? size * sx : size * sy;
  const g = side === 'l' ? cx.createLinearGradient(x0, 0, x0 + px, 0) : side === 'r' ? cx.createLinearGradient(x0 + w, 0, x0 + w - px, 0)
    : side === 't' ? cx.createLinearGradient(0, y0, 0, y0 + px) : cx.createLinearGradient(0, y0 + h, 0, y0 + h - px);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = g; cx.fillRect(x0, y0, w, h);
}
function nbrFitText(cx, s, maxW, px, weight = 800, italic = true) {
  let f = px; do { cx.font = `${italic ? 'italic ' : ''}${weight} ${f}px "Helvetica Neue",Arial,system-ui,sans-serif`; f -= 1; } while (cx.measureText(s).width > maxW && f > 6);
}
// 虛構贊助商的標誌：方框或斜切底板＋字（白底黑字、黑底白字、隊色底）
function nbrLogo(C, name, xm, ym, wm, hm, style, tcol) {
  const { cx } = C, x = C.X(xm - wm / 2), y = C.Y(ym + hm / 2), w = wm * C.sx, h = hm * C.sy, k = name.length;
  const bg = ['#f1f2f0', '#141517', nbrHex(tcol, .55)][style % 3], fg = ['#141517', '#f1f2f0', '#f1f2f0'][style % 3];
  cx.fillStyle = bg;
  cx.beginPath(); const sk = style >= 3 ? h * .35 : 0; cx.moveTo(x + sk, y); cx.lineTo(x + w, y); cx.lineTo(x + w - sk, y + h); cx.lineTo(x, y + h); cx.closePath(); cx.fill();
  cx.fillStyle = fg; nbrFitText(cx, name, w * .84, h * .62, 900, style % 2 === 0); cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(name, x + w / 2, y + h / 2 + h * .03);
  if (k % 3 === 0) { cx.fillStyle = nbrHex(tcol); cx.fillRect(x + w * .06, y + h * .78, w * .2, h * .08); }   // 一部分標誌加一道隊色細條
  cx.textAlign = 'left';
}
// 壓克力牆板：skirt 踢腳、kick 深灰下段、livery 隊色段（斜切色塊、隊名、贊助商）、trim 白飾條、upper 淺灰上段；1.2 m 一片的接縫
function nbrPaintWall(C, team, tcol, j, back) {
  const { cx } = C, L = C.wm, H = C.hm, r = nbrRng(j * 977 + (back ? 31 : 7));
  C.clip();
  // 上段（淺灰面板，往天花板變暗）
  const gu = cx.createLinearGradient(0, C.Y(H), 0, C.Y(3.3)); gu.addColorStop(0, '#7d8186'); gu.addColorStop(.35, '#b4b8bc'); gu.addColorStop(1, '#c9ccd0');
  cx.fillStyle = gu; cx.fillRect(C.x0, C.Y(H), C.w, C.Y(3.3) - C.Y(H));
  // 隊色段：底色＋往兩端暗下去的漸層＋斜切的亮暗色塊（左右對稱，兩面隔間牆共用同一張圖）
  const yL0 = 1, yL1 = 3.2, g = cx.createLinearGradient(C.X(0), 0, C.X(L), 0);
  g.addColorStop(0, nbrHex(tcol, .62)); g.addColorStop(.5, nbrHex(tcol, 1.04)); g.addColorStop(1, nbrHex(tcol, .62));
  cx.fillStyle = g; cx.fillRect(C.X(0), C.Y(yL1), C.w, C.Y(yL0) - C.Y(yL1));
  const shard = (pts, fill) => { cx.fillStyle = fill; cx.beginPath(); pts.forEach(([a, b], q) => q ? cx.lineTo(C.X(a), C.Y(b)) : cx.moveTo(C.X(a), C.Y(b))); cx.closePath(); cx.fill(); };
  for (const s of [-1, 1]) {
    const m = x => L / 2 + s * x;
    shard([[m(L * .22), yL0], [m(L * .3), yL0], [m(L * .42), yL1], [m(L * .34), yL1]], nbrHex(tcol, 1.18, .12, 0xffffff));   // 正中留給隊名
    shard([[m(L * .31), yL0], [m(L * .34), yL0], [m(L * .46), yL1], [m(L * .43), yL1]], 'rgba(255,255,255,.55)');
    shard([[m(L * .36), yL0], [m(L * .5), yL0], [m(L * .5), yL1], [m(L * .48), yL1]], nbrHex(tcol, .42));
  }
  // 細飾條與白色飾帶
  C.rect(0, yL1, L, yL1 + .15, '#e3e5e6'); C.rect(0, yL1 - .03, L, yL1, 'rgba(0,0,0,.35)'); C.rect(0, yL1 + .15, L, yL1 + .17, 'rgba(0,0,0,.25)');
  C.rect(0, yL0, L, yL0 + .05, '#d4d6d8');
  // 隊名（正中、白字斜體）與兩側的贊助商
  { cx.fillStyle = '#f4f4f2'; const hm = back ? .62 : .7; nbrFitText(cx, team, (back ? .8 : .42) * L * C.sx, hm * C.sy); cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 4; cx.fillText(team, C.X(L / 2), C.Y(back ? 1.75 : 2.1)); cx.shadowBlur = 0; cx.textAlign = 'left'; }
  if (back) {   // 後牆：隊徽（圓形、隊名縮寫）在隊名上面，上段一排贊助商
    const ini = team.split(' ').map(w => w[0]).join('').slice(0, 2), R = .42 * C.sy;
    cx.fillStyle = '#f4f4f2'; cx.beginPath(); cx.arc(C.X(L / 2), C.Y(2.7), R, 0, 7); cx.fill();
    cx.fillStyle = nbrHex(tcol, .8); cx.beginPath(); cx.arc(C.X(L / 2), C.Y(2.7), R * .82, 0, 7); cx.fill();
    cx.fillStyle = '#f4f4f2'; nbrFitText(cx, ini, R * 1.3, R * .9, 900, true); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(ini, C.X(L / 2), C.Y(2.7)); cx.textAlign = 'left';
    for (let q = 0; q < 4; q++) nbrLogo(C, NBR_SPONSORS[(j * 3 + q) % NBR_SPONSORS.length], L * (.17 + q * .22), 3.95, 2.1, .5, q + j, tcol);
  } else {
    for (const [q, xm] of [[0, .14], [1, .86]]) nbrLogo(C, NBR_SPONSORS[(j * 2 + q) % NBR_SPONSORS.length], L * xm, 2.15, 2.3, .55, q + j, tcol);
    for (const [q, xm] of [[0, .2], [1, .5], [2, .8]]) nbrLogo(C, NBR_SPONSORS[(j * 5 + q + 3) % NBR_SPONSORS.length], L * xm, 3.9, 1.7, .42, q * 2 + j + 1, tcol);
  }
  // 下段：深灰踢腳板＋踢腳＋插座盒（灰盒、黃藍紅的工業插座蓋）
  const gk = cx.createLinearGradient(0, C.Y(1), 0, C.Y(0)); gk.addColorStop(0, '#34373c'); gk.addColorStop(1, '#25272b');
  cx.fillStyle = gk; cx.fillRect(C.x0, C.Y(1), C.w, C.Y(0) - C.Y(1));
  C.rect(0, 0, L, .12, '#121315'); C.rect(0, .12, L, .135, 'rgba(255,255,255,.18)');
  for (let xm = 2.4; xm < L - 1; xm += back ? 3.6 : 4.8) {
    C.rect(xm, .48, xm + .42, .82, '#7a7e83'); C.rect(xm + .02, .5, xm + .4, .52, 'rgba(255,255,255,.3)');
    [['#d9a21b', .05], ['#2b5fa8', .17], ['#b8312b', .29]].forEach(([c, dx]) => C.rect(xm + dx, .56, xm + dx + .09, .7, c));
  }
  // 接縫（1.2 m 一片，暗線＋亮邊）、上下兩道橫縫
  for (let xm = 1.2; xm < L; xm += 1.2) { C.rect(xm - .012, .12, xm + .012, H, 'rgba(0,0,0,.42)'); C.rect(xm + .012, .12, xm + .026, H, 'rgba(255,255,255,.13)'); }
  for (const ym of [1, 3.35, 4.55]) { C.rect(0, ym - .012, L, ym + .012, 'rgba(0,0,0,.35)'); C.rect(0, ym - .026, L, ym - .012, 'rgba(255,255,255,.12)'); }
  // 牆頂的電纜線槽（鍍鋅、帶陰影）
  C.rect(0, H - .62, L, H - .5, '#8f9499'); C.rect(0, H - .66, L, H - .62, 'rgba(0,0,0,.4)'); C.rect(0, H - .5, L, H - .49, 'rgba(255,255,255,.35)');
  // 光：頂燈照下來，牆的中段最亮、往地面與天花板暗；兩端的牆角、地腳、天花板邊的陰影
  const gl = cx.createLinearGradient(0, C.Y(H), 0, C.Y(0)); gl.addColorStop(0, 'rgba(0,0,0,.28)'); gl.addColorStop(.3, 'rgba(255,248,235,.07)'); gl.addColorStop(.65, 'rgba(0,0,0,0)'); gl.addColorStop(1, 'rgba(0,0,0,.18)');
  cx.fillStyle = gl; cx.fillRect(C.x0, C.y0, C.w, C.h);
  nbrAO(C, 'l', .7, .45); nbrAO(C, 'r', .7, .45); nbrAO(C, 'b', .4, .5); nbrAO(C, 't', .5, .45);
  nbrNoise(C, r, C.w * C.h / 40, .05);
  cx.restore();
}
// 地坪：深灰的拼接地板（40 cm 一塊），亮面映出三條頂燈、牆邊暗、輪子停的黃線、門口的排水溝、輪胎痕與油漬
function nbrPaintFloor(C) {
  const { cx } = C, Wm = C.wm, Lm = C.hm, r = nbrRng(4242);
  C.clip();
  C.rect(0, 0, Wm, Lm, '#4b4f54');
  for (let i = 0; i < 70; i++) {   // 大片的明暗斑（地板顏色不均）
    const x = C.X(r() * Wm), y = C.Y(r() * Lm), R = (.8 + r() * 2.5) * C.sx, g = cx.createRadialGradient(x, y, 0, x, y, R), lt = r() < .5;
    g.addColorStop(0, lt ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(x - R, y - R, 2 * R, 2 * R);
  }
  nbrNoise(C, r, C.w * C.h / 6, .22, 20, 200);
  for (let x = .4; x < Wm; x += .4) C.rect(x - .006, 0, x + .006, Lm, 'rgba(0,0,0,.16)');   // 拼接地板的縫
  for (let y = .4; y < Lm; y += .4) C.rect(0, y - .006, Wm, y + .006, 'rgba(0,0,0,.16)');
  // 頂燈在亮面地板上的倒影：寬的光暈＋窄的燈管影（模糊）
  cx.save(); cx.filter = `blur(${Math.max(2, C.sx * .22) | 0}px)`;
  for (const x of [Wm / 2 - 3.6, Wm / 2, Wm / 2 + 3.6]) {
    C.rect(x - 1.5, 2.2, x + 1.5, Lm - 2.2, 'rgba(255,246,228,.07)');
    C.rect(x - .16, 2.6, x + .16, Lm - 2.6, 'rgba(255,248,236,.2)');
  }
  cx.restore();
  // 車停的位置：兩條黃線、前輪停止線（白）、門口的排水溝（格柵）
  for (const s of [-1, 1]) C.rect(Wm / 2 + s * 1.05 - .05, 3.5, Wm / 2 + s * 1.05 + .05, Lm - 1, '#c79a22');
  C.rect(Wm / 2 - 1.5, 6.2, Wm / 2 + 1.5, 6.3, '#d9d9d2');
  C.rect(.4, Lm - .48, Wm - .4, Lm - .24, '#1d1f21');
  for (let x = .45; x < Wm - .4; x += .06) C.rect(x, Lm - .46, x + .025, Lm - .26, '#5e6267');
  // 輪胎痕（沿著黃線開進來的淡黑痕）、幾道打滑的弧、油漬
  cx.save(); cx.filter = `blur(${Math.max(1, C.sx * .05) | 0}px)`;
  for (const s of [-1, 1]) for (const e of [-.15, .15]) C.rect(Wm / 2 + s * 1.05 + e - .1, 4, Wm / 2 + s * 1.05 + e + .1, Lm - .6, 'rgba(10,10,10,.09)');
  cx.lineWidth = .2 * C.sx; cx.strokeStyle = 'rgba(12,12,12,.08)';
  for (let i = 0; i < 5; i++) { cx.beginPath(); const x = Wm / 2 + (r() - .5) * 5, y = 8 + r() * 8; cx.arc(C.X(x), C.Y(y), (3 + r() * 5) * C.sx, r() * 6, r() * 6 + 1.2); cx.stroke(); }
  for (let i = 0; i < 9; i++) { const x = C.X(Wm / 2 + (r() - .5) * 4), y = C.Y(5 + r() * 9), R = (.15 + r() * .45) * C.sx; cx.fillStyle = 'rgba(8,8,6,.16)'; cx.beginPath(); cx.ellipse(x, y, R, R * (.5 + r() * .6), r() * 3, 0, 7); cx.fill(); }
  cx.restore();
  // 牆邊與後牆的陰影、門口亮一點（外面的天光）
  nbrAO(C, 'l', .8, .5); nbrAO(C, 'r', .8, .5); nbrAO(C, 't', 1, .45);
  const gd = cx.createLinearGradient(0, C.Y(Lm), 0, C.Y(Lm - 4)); gd.addColorStop(0, 'rgba(235,240,245,.1)'); gd.addColorStop(1, 'rgba(235,240,245,0)'); cx.fillStyle = gd; cx.fillRect(C.x0, C.y0, C.w, C.h);
  cx.restore();
}
// 天花板：烤漆的浪板樓承板（沿長邊的條紋）、兩道鋼樑的陰影、三條燈帶的光暈、四邊的陰影
function nbrPaintCeil(C) {
  const { cx } = C, Wm = C.wm, Lm = C.hm, r = nbrRng(99);
  C.clip();
  C.rect(0, 0, Wm, Lm, '#8e9297');
  for (let x = 0; x < Wm; x += .3) C.rect(x, 0, x + .15, Lm, 'rgba(0,0,0,.07)');
  for (const y of [6, 12]) { C.rect(0, y - .5, Wm, y + .5, 'rgba(0,0,0,.18)'); C.rect(0, y - .15, Wm, y + .15, 'rgba(0,0,0,.25)'); }
  cx.save(); cx.filter = `blur(${Math.max(2, C.sx * .5) | 0}px)`;
  for (const x of [Wm / 2 - 3.6, Wm / 2, Wm / 2 + 3.6]) C.rect(x - .9, 1.2, x + .9, Lm - 1.2, 'rgba(255,248,232,.28)');
  cx.restore();
  for (const x of [Wm / 2 - 3.6, Wm / 2, Wm / 2 + 3.6]) C.rect(x - .2, 1.5, x + .2, Lm - 1.5, '#f6f2ea');
  nbrNoise(C, r, C.w * C.h / 30, .05);
  nbrAO(C, 'l', 1, .5); nbrAO(C, 'r', 1, .5); nbrAO(C, 't', 1, .45); nbrAO(C, 'b', .6, .3);
  cx.restore();
}
// 螢幕畫面：0 計時排名、1 賽道圖（GP 中心線＋車的位置點）、2 遙測曲線、3 胎溫、4 場次時鐘、5 分段時間
function nbrPaintScreen(C, kind, gp) {
  const { cx, x0, y0, w, h } = C, r = nbrRng(kind * 131 + 5), mono = px => { cx.font = `600 ${px}px Menlo,Consolas,monospace`; };
  cx.save(); cx.beginPath(); cx.rect(x0, y0, w, h); cx.clip();
  const bg = cx.createLinearGradient(0, y0, 0, y0 + h); bg.addColorStop(0, '#16233a'); bg.addColorStop(1, '#0b1220'); cx.fillStyle = bg; cx.fillRect(x0, y0, w, h);
  const codes = ['NOR', 'HAL', 'VIE', 'OST', 'AHR', 'GRA', 'SIL', 'EIF', 'KES', 'WEH', 'MOS', 'ROT'], col = ['#b36bff', '#38d26b', '#f0c419', '#e8e8e8'];
  cx.textBaseline = 'middle';
  if (kind === 0 || kind === 5) {
    const n = 10, rh = (h - 16) / n; cx.fillStyle = '#c8202a'; cx.fillRect(x0, y0, w, 14); cx.fillStyle = '#fff'; mono(10); cx.fillText(kind ? 'SECTORS  S1     S2     S3' : 'POS  CAR   GAP      LAST LAP', x0 + 6, y0 + 7.5);
    for (let i = 0; i < n; i++) {
      const y = y0 + 16 + i * rh + rh / 2; if (i % 2) { cx.fillStyle = 'rgba(255,255,255,.05)'; cx.fillRect(x0, y - rh / 2, w, rh); }
      mono(Math.min(12, rh * .72)); cx.fillStyle = '#9aa4b2'; cx.fillText(String(i + 1).padStart(2, ' '), x0 + 6, y); cx.fillStyle = '#fff'; cx.fillText(codes[(i * 5 + kind) % 12], x0 + 34, y);
      if (kind) for (let q = 0; q < 3; q++) { cx.fillStyle = col[(r() * 4) | 0]; cx.fillText((28 + r() * 9).toFixed(3), x0 + 80 + q * 56, y); }
      else { cx.fillStyle = '#9aa4b2'; cx.fillText(i ? '+' + (i * 1.7 + r() * 2).toFixed(3) : 'LEADER', x0 + 80, y); cx.fillStyle = col[(r() * 4) | 0]; cx.fillText(`1:${(53 + r() * 4).toFixed(3)}`, x0 + 170, y); }
    }
  } else if (kind === 1 && gp && gp.length) {
    let ax = 1e9, bx = -1e9, az = 1e9, bz = -1e9; for (const [x, z] of gp) { ax = Math.min(ax, x); bx = Math.max(bx, x); az = Math.min(az, z); bz = Math.max(bz, z); }
    const s = Math.min((w - 30) / (bx - ax), (h - 30) / (bz - az)), P = ([x, z]) => [x0 + w / 2 + (x - (ax + bx) / 2) * s, y0 + h / 2 + (z - (az + bz) / 2) * s];
    cx.lineJoin = 'round'; for (const [lw, c] of [[7, '#1c2633'], [3, '#d8dee6']]) { cx.lineWidth = lw; cx.strokeStyle = c; cx.beginPath(); gp.forEach((p, q) => { const [x, y] = P(p); q ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.closePath(); cx.stroke(); }
    for (let i = 0; i < 12; i++) { const [x, y] = P(gp[(r() * gp.length) | 0]); cx.fillStyle = i ? '#f0c419' : '#ff3b3b'; cx.beginPath(); cx.arc(x, y, 3.2, 0, 7); cx.fill(); }
    cx.fillStyle = '#9aa4b2'; mono(10); cx.fillText('GP-STRECKE  5.148 km', x0 + 8, y0 + 10);
  } else if (kind === 2) {
    for (let q = 0; q < 4; q++) { cx.strokeStyle = 'rgba(255,255,255,.08)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x0, y0 + h * q / 4); cx.lineTo(x0 + w, y0 + h * q / 4); cx.stroke(); }
    const tr = (yb, amp, c, f) => { cx.strokeStyle = c; cx.lineWidth = 1.5; cx.beginPath(); for (let x = 0; x <= w; x += 2) { const v = f(x / w); x ? cx.lineTo(x0 + x, yb - v * amp) : cx.moveTo(x0 + x, yb - v * amp); } cx.stroke(); };
    const ph = r() * 9;
    tr(y0 + h * .48, h * .4, '#38d26b', u => .55 + .4 * Math.sin(u * 17 + ph) * Math.sin(u * 5.3 + 1));
    tr(y0 + h * .74, h * .2, '#f0c419', u => Math.max(0, Math.sin(u * 17 + ph + .4)));
    tr(y0 + h * .97, h * .2, '#ff4a4a', u => Math.max(0, -Math.sin(u * 17 + ph + .4)) ** 3);
    mono(10); cx.fillStyle = '#9aa4b2'; cx.fillText('SPEED  THR  BRK', x0 + 6, y0 + 9);
  } else if (kind === 3) {
    const tw = w * .16, th = h * .32;
    for (const [i, cxm, cym] of [[0, .3, .3], [1, .7, .3], [2, .3, .72], [3, .7, .72]]) {
      const t = 82 + r() * 24, x = x0 + w * cxm - tw / 2, y = y0 + h * cym - th / 2, g = cx.createLinearGradient(x, 0, x + tw, 0);
      for (let q = 0; q < 3; q++) g.addColorStop(q / 2, `hsl(${Math.max(0, 140 - (t - 70 + q * 6 - 6) * 3.4)},80%,48%)`);
      cx.fillStyle = g; cx.fillRect(x, y, tw, th); cx.fillStyle = '#fff'; mono(12); cx.textAlign = 'center'; cx.fillText(t.toFixed(0) + '°', x + tw / 2, y + th + 9); cx.textAlign = 'left';
      mono(9); cx.fillStyle = '#9aa4b2'; cx.fillText(['FL', 'FR', 'RL', 'RR'][i], x - 18, y + 6);
    }
  } else {
    mono(13); cx.fillStyle = '#9aa4b2'; cx.fillText('SESSION 2 · RACE', x0 + 10, y0 + 16);
    cx.font = `700 ${h * .32 | 0}px Menlo,Consolas,monospace`; cx.fillStyle = '#f2f2f2'; cx.fillText(`0${1 + (r() * 2 | 0)}:${String(10 + r() * 49 | 0)}:${String(10 + r() * 49 | 0)}`, x0 + 10, y0 + h * .5);
    mono(11); cx.fillStyle = '#38d26b'; cx.fillText(`TRACK ${(24 + r() * 14).toFixed(1)}°C   AIR ${(14 + r() * 8).toFixed(1)}°C`, x0 + 10, y0 + h * .78);
    cx.fillStyle = '#f0c419'; cx.fillText(`LAP ${20 + (r() * 30 | 0)}/58   PIT WINDOW OPEN`, x0 + 10, y0 + h * .92);
  }
  const gl = cx.createLinearGradient(x0, y0, x0 + w, y0 + h); gl.addColorStop(0, 'rgba(255,255,255,.06)'); gl.addColorStop(.5, 'rgba(255,255,255,0)'); cx.fillStyle = gl; cx.fillRect(x0, y0, w, h);   // 螢幕玻璃的反光
  cx.restore();
}
