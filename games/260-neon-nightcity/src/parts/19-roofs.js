// ═══ 斜屋頂：低層的程式立面地塊哪些換成斜屋頂、哪一種（畫面在 20-roof.js），以及屋頂面的高度（22-hmap.js 寫進高度圖） ═══
// 牆和樓板照舊是 10-city.js 的方塊，斜屋頂蓋在平頂上面（女兒牆不擺）。排在 20-props 前面：屋頂上的水塔與空調箱（20-props）看到斜屋頂就不擺，
// 被選去掛屋頂廣告的地塊改回平頂（20-props 的 billboards 設 L.rk = null）。不抽 rnd()：只看地塊自己的 seed，亂數序列和以前一樣。
// 種類（L.rk.kind）：
//   gable   山牆朝街的雙坡：屋脊和街垂直，正面與背面是三角山牆（海濱的灰泥屋、工廠區的鋼板屋頂、各區零星的老磚房）
//   hip     四坡：海濱的別墅式小樓
//   mansard 復折式：下半段陡的石板瓦（一層閣樓，開老虎窗）、上面平台（楓林、雲杉的磚造公寓，各區零星）
// 高度圖（日光陰影、直升機與跳傘落地的 roofH）取屋頂面的高度：站上去不會陷進屋頂裡。
const ROOF_H0 = .05;   // 屋頂從立面頂（L.h）往上多少開始（蓋住平頂）
const roofHash = (L, k) => { const x = Math.sin(L.seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
function roofKind(L) {
  if (L.rk !== undefined) return L.rk;
  L.rk = null;
  if (L.glb || L.ghost || L.special || L.roof || L.style === 3 || L.style === 5 || L.style === 8 || !L.b || L.b.outer || L.h > 26) return null;
  const d = district((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2), r = roofHash(L, 1);
  const beach = d.startsWith('珊瑚'), works = d.startsWith('琥珀') || d.startsWith('錨灣'), homey = d.startsWith('楓林') || d.startsWith('公園') || d.startsWith('雲杉');
  // 寬（沿街）與深：屋脊和街垂直時跨的是寬
  const w = L.axis === 'z' ? L.x1 - L.x0 : L.z1 - L.z0, dp = L.axis === 'z' ? L.z1 - L.z0 : L.x1 - L.x0;
  let kind = null;
  if (beach) kind = r < .62 ? 'gable' : 'hip';
  else if (works) kind = r < .8 ? 'gable' : null;
  else if (homey) kind = r < .6 ? 'mansard' : r < .72 ? 'gable' : null;
  else if (L.h < 21) kind = r < .22 ? 'mansard' : r < .3 ? 'gable' : null;
  if (!kind) return null;
  if (kind === 'gable' && w > 22) kind = beach ? 'hip' : 'mansard';   // 太寬的雙坡屋脊會比樓還高
  if (kind === 'mansard' && (w < 7 || dp < 7)) kind = 'gable';
  // 坡度：雙坡 34–42°（屋脊最高 5.5 m）、四坡 28°、復折式下段 3 m 高、往內 1.2 m；鋪面照區：海濱筒瓦、工廠立邊鋼板、其他石板瓦
  const pitch = kind === 'hip' ? 28 : 34 + roofHash(L, 2) * 8, half = w / 2;
  const H = kind === 'mansard' ? 3 : Math.min(5.5, half * Math.tan(pitch * Math.PI / 180));
  const mat = beach ? TX.tile : works ? TX.seam : TX.slate;
  const col = beach ? [0xa4532f, 0x9a4a2c, 0xb0623a, 0x8c4a32][Math.floor(roofHash(L, 3) * 4)]
    : works ? [0x5d6468, 0x6b4a3c, 0x4e5a52, 0x707478][Math.floor(roofHash(L, 3) * 4)]
    : [0x3c4048, 0x45434a, 0x34393f][Math.floor(roofHash(L, 3) * 3)];
  return L.rk = { kind, w, dp, H, mat, col, y0: L.h + ROOF_H0, chim: roofHash(L, 4) < (works ? .25 : .55), oh: kind === 'mansard' ? .22 : .38 };
}
// 屋頂面在邏輯座標 (x, z) 的高度（地塊外加出簷的範圍，外面回傳 -Infinity）
function roofTop(L, x, z) {
  const R = L.rk; if (!R) return -Infinity;
  const oh = R.oh, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
  // a：沿街（寬）離中線多遠，b：沿深離中線多遠
  const a = Math.abs(L.axis === 'z' ? x - cx : z - cz), b = Math.abs(L.axis === 'z' ? z - cz : x - cx), hw = R.w / 2, hd = R.dp / 2;
  if (a > hw + .01 || b > hd + oh) return -Infinity;
  if (R.kind === 'gable') return R.y0 + R.H * (1 - a / hw);
  const s = R.kind === 'hip' ? R.H / hw : R.H / 1.2;
  return R.y0 + Math.min(R.H, s * Math.max(0, Math.min(hw - a, hd - b)));
}
