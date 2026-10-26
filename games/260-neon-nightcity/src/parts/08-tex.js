// ═══ 照片材質：程式立面（10-city.js 的 MAT_FACADE）的牆與平屋頂、斜屋頂（07-kitx.js 的筒瓦與石板瓦）改用 ambientCG 的 CC0 照片材質 ═══
// tools/tex.mjs 把七種材質疊成兩張長條 JPG（assets/260/tex/fac_c.jpg 底色×AO、fac_n.jpg 法線 xy＋粗糙度），這裡下載後拆成
// texture2D 陣列 U.uFacA／uFacN（每層 1024²，有 mipmap 與各向異性過濾）。只在 http(s) 下載；以檔案開啟、下載前、或設定關掉（SET.tex）時
// 著色器照舊畫程式紋理（U.uFac.x = 0）。層的順序與每層代表幾公尺（著色器裡的貼圖座標 = 公尺 / m）和 tools/tex.mjs 的 IDS 一致。
// 陣列的第 0 列是圖的最上面，所以貼圖的 v 往下：著色器取法線時 y 要反號（facN）。
const FAC_LAYERS = [
  { id: 'Bricks097', m: 1.4 },          // 0 舊紅磚（風格 0、6、其他）
  { id: 'Bricks094', m: 1.3 },          // 1 褐磚（風格 1）
  { id: 'Concrete035', m: 2.5 },        // 2 舊混凝土（風格 2）
  { id: 'Plaster003', m: 2 },           // 3 粗灰泥（風格 4 翻新樓，著色器再上粉彩色）
  { id: 'Asphalt026C', m: 3 },          // 4 平屋頂的瀝青防水層
  { id: 'RoofingTiles014B', m: 2.9 },   // 5 陶筒瓦（海濱斜屋頂）
  { id: 'RoofingTiles003', m: 2 },      // 6 石板瓦（復折式與老磚房）
];
const FAC_ON = /^https?:$/.test(location.protocol);
const facTex = { st: 0, a: null, n: null };   // st：0 還沒開始、1 下載中、2 好了、-1 失敗
// 下載後的處理照 27-props.js 的 warmSlice 分幀：解碼在背景（createImageBitmap），一層一層讀回像素，最後 initTexture 在切片裡上傳，
// 不會在第一次畫到時整批擠在同一幀（facLoad 只在畫面跑起來後由 facApply 呼叫，27 的 warmSlice 已經宣告）
async function facLoad(withN) {
  const S = 1024, nL = FAC_LAYERS.length;
  const get = async (name) => {
    const bmp = await createImageBitmap(await (await fetch(new URL(`../assets/260/tex/${name}.jpg`, location.href))).blob());
    await warmSlice();
    const cv = new OffscreenCanvas(S, S * nL), cx = cv.getContext('2d', { willReadFrequently: true }), data = new Uint8Array(S * S * 4 * nL);
    cx.drawImage(bmp, 0, 0); bmp.close();
    for (let k = 0; k < nL; k++) { await warmSlice(); data.set(cx.getImageData(0, k * S, S, S).data, k * S * S * 4); }
    const t = new T.DataArrayTexture(data, S, S, nL);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy()); t.needsUpdate = true;
    await warmSlice(); R.initTexture(t);
    return t;
  };
  await warmJob(async () => {
    if (!facTex.a) facTex.a = await get('fac_c');
    if (withN) facTex.n = await get('fac_n');
  });
}
// 每幀（28-sky.js 的 atmApply）：設定打開就開始下載；著色器開關跟著設定與下載狀態走，換設定不用重新整理
function facApply() {
  const k = SET.tex | 0;
  if (FAC_ON && k > 0 && (facTex.st === 0 || (k > 1 && facTex.st === 2 && !facTex.n))) {
    facTex.st = 1;
    facLoad(k > 1).then(() => { facTex.st = 2; U.uFacA.value = facTex.a; U.uFacN.value = facTex.n; })
      .catch(e => { facTex.st = -1; console.warn('照片材質載入失敗，照舊用程式紋理', e); });
  }
  U.uFac.value.set(facTex.st === 2 && k > 0 ? 1 : 0, facTex.st === 2 && k > 1 && facTex.n ? 1 : 0, 0, 0);
}
