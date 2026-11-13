
// ═══ 渲染管線：路面倒影 → 主畫面 → 泛光 → 動態模糊、色調映射、暗角與顆粒 ═══
await bootStep(BOOT.render, '點亮霓虹…');
const camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, .2, 4200);   // 遠平面要到北面的山與對岸（21-coast.js）
camera.layers.enable(LY.NOREFL);
const reflCam = new T.PerspectiveCamera(); reflCam.layers.set(LY.MAIN);
for (const m of groundMeshes) m.layers.set(LY.NOREFL);
let DPR = Math.min(devicePixelRatio || 1, GT().dpr);   // 00-core.js 的畫質等級：解析度上限
R.setPixelRatio(DPR);
// 固定的內部解析度比例：'1080p' 是短邊 1080 px（螢幕本身不到 1080 就照螢幕的實際像素，不超取樣；觸控裝置不超過等級的 DPR 上限，手機照舊），數字照比例；
// 'auto'（預設，2026-11-09）從 1080p 那一檔開始（原本從 100% 起：2560 寬的視窗是 1080p 的 1.5 倍像素，開場一定先卡一陣子才降），最低到 1080p 的七成（resMin）
const res1080 = () => { const s = Math.min(innerWidth, innerHeight), k = Math.min(1080, s * (devicePixelRatio || 1)) / (s * DPR); return isTouch ? Math.min(k, 1) : k; };
const resScale = () => SET.res === '1080p' ? res1080() : typeof SET.res === 'number' ? SET.res : Math.min(1, res1080());
const resMin = () => Math.min(.6, res1080() * .7);
// gray／vig／hurt：69-combat.js 的 WASTED／BUSTED 去色與暗角、受傷時畫面邊緣泛紅
// reflHalf：倒影隔幀畫（依幀時調整在 CPU 送不完時打開）；ceil：自動解析度往上升的上限（在 1 以上降過一次就停在那一檔下面）
const post = { reflHalf: false, ceil: 9, scale: resScale(), blur: .5 * SET.blur, exposure: 1.18, wobble: 0, ft: 16, vs: 16.7, cool: 0, slow: 0, fast: 0, gray: 0, vig: 0, hurt: 0, tint: new T.Vector4(1, 1, 1, 0) };   // tint：特殊能力的調色（rgb 乘在亮度上，w 是強度）
// 沒有浮點渲染目標的擴充（少數舊驅動、部分 Android）就退回 8 位元：畫得出來，只是霓虹的泛光與高光會被截在 1（00-core.js 的 GPU.hdr）
const rtOpts = { type: GPU.hdr ? T.HalfFloatType : T.UnsignedByteType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true };
// 環境光遮蔽要浮點的渲染目標（深度放在 g）：退回 8 位元的驅動不畫
// 眼睛適應（mEyeLum／mEyeAdapt）：畫面縮成 EYE_W×EYE_H 的 log 亮度，平均後存進 1×1 的兩張來回貼圖（r 快、g 慢）
const EYE_W = 32, EYE_H = 18;
const rtEye = [0, 1].map(() => new T.WebGLRenderTarget(1, 1, { type: GPU.hdr ? T.HalfFloatType : T.UnsignedByteType, minFilter: T.NearestFilter, magFilter: T.NearestFilter, depthBuffer: false }));
const AO_ON = !!GT().ao && GPU.hdr;
let rtScene, rtRefl, rtB = [], rtU = [], rtV = null, rtA = [], rtL = null;
// 讀場景深度的後製（螢幕空間倒影、體積光、環境光遮蔽、合成）：WGSL 的深度貼圖型別分多重取樣與否，在第一次建節點時就定了，
// 而 three 的快取鍵不看取樣數：Esc 選單換 MSAA 後照舊拿舊的程式，每幀十幾個 WebGPU 驗證錯誤（「Sample count (1) … doesn't match」）、那幾趟畫不出來。
// 取樣數寫進它們的 defines（02-gfx.js 把 defines 併進快取鍵），換了就重建（2026-11-01 觀測模型抓到）
let depthMats = null;
function depthMsaa() {
  if (depthMats) for (const m of depthMats) if (m.defines?.MSAA !== rtScene.samples) {
    m.uniforms.tDepth.value = rtScene.depthTexture; if (m.uniforms.tScene) m.uniforms.tScene.value = rtScene.texture;   // 重建時節點照這張決定型別（02-gfx.js 的 GfxTex.setup）
    m.defines = { ...m.defines, MSAA: rtScene.samples }; m.needsUpdate = true;
  }
}
function makeTargets() {
  const w = Math.max(2, Math.floor(innerWidth * DPR * post.scale)), h = Math.max(2, Math.floor(innerHeight * DPR * post.scale));
  rtScene?.dispose(); rtRefl?.dispose(); rtB.forEach(r => r.dispose()); rtU.forEach(r => r.dispose()); rtV?.dispose(); rtA.forEach(r => r.dispose()); rtL?.dispose();
  rtL = new T.WebGLRenderTarget(EYE_W, EYE_H, { ...rtOpts, depthBuffer: false });   // 眼睛適應：畫面亮度的縮圖（log 亮度）
  // 環境光遮蔽（半解析度）：r 是遮蔽、g 是相機空間的深度（給依深度的模糊用），要浮點；兩張來回模糊
  rtA = AO_ON ? [0, 1].map(() => new T.WebGLRenderTarget(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)), { ...rtOpts, depthBuffer: false })) : [];
  rtV = new T.WebGLRenderTarget(Math.max(1, Math.floor(w / 4)), Math.max(1, Math.floor(h / 4)), { ...rtOpts, depthBuffer: false });   // 體積光（四分之一解析度）
  rtScene = new T.WebGLRenderTarget(w, h, { ...rtOpts, samples: Math.min(SET.msaa, R.capabilities.maxSamples || 0) });   // 01-settings.js：Esc 選單的 MSAA
  rtScene.depthTexture = new T.DepthTexture(w, h); rtScene.depthTexture.type = T.UnsignedIntType;
  const rs = SET.refl === 1 ? .33 : .5;   // 倒影：低是三分之一解析度、高是一半（關掉時不畫，見 renderFrame）
  rtRefl = new T.WebGLRenderTarget(Math.floor(w * rs), Math.floor(h * rs), rtOpts);
  rtB = []; rtU = [];
  for (let i = 0; i < 5; i++) {
    const d = 2 << i;
    rtB.push(new T.WebGLRenderTarget(Math.max(1, Math.floor(w / d)), Math.max(1, Math.floor(h / d)), { ...rtOpts, depthBuffer: false }));
    rtU.push(new T.WebGLRenderTarget(Math.max(1, Math.floor(w / d)), Math.max(1, Math.floor(h / d)), { ...rtOpts, depthBuffer: false }));
  }
  reflU.tRefl.value = rtRefl.texture;
  gfxTargets.length = 0; gfxTargets.push(rtScene); if (SET.refl) gfxTargets.push(rtRefl);   // 02-gfx.js 的 gfxCompile 照這兩個目標預先編 pipeline
  depthMsaa();
}
function resize() {
  R.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  makeTargets();
}
resize();
addEventListener('resize', () => { post.scale = SET.res === 'auto' ? Math.min(post.scale, Math.max(1, resMax())) : resScale(); resize(); });
// 換畫質等級（01-settings.js 的 tierSet）：解析度上限跟著換
function tierDpr() { DPR = Math.min(devicePixelRatio || 1, GT().dpr); R.setPixelRatio(DPR); post.ceil = 9; post.scale = SET.res === 'auto' ? Math.min(post.scale, 1) : resScale(); resize(); }
// 顯示卡驅動重置（WebGPU 的 device lost、WebGL2 後端的 context lost）：WebGPURenderer 不會自己重建，遊戲照跑、畫面停在最後一幀，請玩家重新整理
R.onDeviceLost = info => { R._onDeviceLost(info); GPU.lost++; toast('顯示卡重置了，請重新整理頁面'); };

// 全螢幕三角形
const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new T.BufferGeometry();
fsGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
fsGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const fsMesh = new T.Mesh(fsGeo); fsMesh.frustumCulled = false;
const fsScene = new T.Scene(); fsScene.add(fsMesh);
const pass = (name, uniforms) => new T.ShaderMaterial({ name, uniforms, depthTest: false, depthWrite: false });
const mPre = pass('pre', { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThr: { value: 1 } });
const mDown = pass('down', { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
const mUp = pass('up', { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new T.Vector2() }, uK: { value: 1 } });
// 熱成像（69-v7-bunker.js）：熱源投影到畫面上（uv、半徑、強度），HEAT_N 個以內，近的先
const HEAT_N = 20, _heat = new Float32Array(160 * 5), _hv = new T.Vector3();
function heatUniforms(u) {
  const H = u.uHeat.value, F = V7FX;
  u.uFx7.value.set(F.therm, F.gas, F.blur, F.nv);
  for (const q of H) q.w = 0;
  if (!(F.therm > 0)) return;
  const n = heatPts(camera.position.x, camera.position.z, _heat, 160), list = [];
  for (let i = 0; i < n; i++) {
    const o = i * 5; _hv.set(_heat[o], _heat[o + 1], _heat[o + 2]);
    const d = _hv.distanceTo(camera.position); _hv.project(camera);
    if (_hv.z > 1 || Math.abs(_hv.x) > 1.2 || Math.abs(_hv.y) > 1.2) continue;
    list.push([d, _hv.x * .5 + .5, _hv.y * .5 + .5, Math.min(.5, _heat[o + 3] / (2 * d * Math.tan(camera.fov * Math.PI / 360))), _heat[o + 4]]);
  }
  list.sort((a, b) => a[0] - b[0]);
  list.slice(0, HEAT_N).forEach((q, i) => H[i].set(q[1], q[2], q[3], q[4]));
}
// 體積光：四分之一解析度，沿視線取 VOL_N 個點（每幀抖動），每一點朝太陽在建築高度圖上步進（被樓擋住就是暗的），再穿過樹冠圖（葉子的疏密），
// 累積霧裡散射的日光：樓縫與樹冠之間照出一道道光束。空氣本身的密度很低，清晨的貼地薄霧（uGI.z）讓光束濃起來；
// 散射偏向太陽那一側（相位函數）。只畫 160 m 內，往外衰減；合成時加在曝光前
const VOL_N = GT().vol;
// 螢幕空間倒影（SET.ssr）：不再從路面下方把整個場景畫一次，而是用上一幀的畫面與深度填 rtRefl（路面、積水、海面的材質照舊讀它，不用改）。
// rtRefl 的每個像素：鏡射相機的視線先打到 y=0 的路面點 P0，再從 P0 沿同一方向往上走（就是真實鏡頭的視線在路面的反射），投影到上一幀的畫面
// 比深度，走到牆或車後面就取那一點的顏色；走出畫面、碰不到東西的照「這個方向的天空」：天空在畫面裡就取畫面上的天空，不在就用天空的漸層。
// 2026-11-01 使用者看過前後對照後選了預設螢幕空間（戰鬥觀戰同頁 A/B：fps 中位數 +37%、draw −38%、送出 −31%；高處招牌、被樹擋住的天際線倒影會少）。
// uPrm：x 起步長、y 每步倍率（56 步約走到 1.6 km）、z 最遠距離、w 開關（0 時整片天空漸層，量測用）
const SSR_N = 56;
const mSSR = pass('ssr', { tScene: { value: null }, tDepth: { value: null }, uVP: { value: new T.Matrix4() }, uInvVP: { value: new T.Matrix4() }, uInvRVP: { value: new T.Matrix4() }, uRP: { value: V3() },
  uSkyTop: U.uSkyTop, uSkyHor: U.uSkyHor, uFogCol: U.uFogCol, uPrm: { value: new T.Vector4(.12, 1.16, 2500, 1) } });
const _ssrM = new T.Matrix4();
const mVol = VOL_N ? pass('vol', { ...shared(ALLU), tDepth: { value: null }, uInvVP: { value: new T.Matrix4() }, uVolK: { value: 0 } }) : null;
// 環境光遮蔽（SSAO）：半解析度，從主畫面的深度還原相機空間的位置，法線取左右、上下兩側深度比較接近的那一邊（邊緣不糊），
// 沿螺旋取 AO_N 個點（McGuire 的 SAO：半徑 uRad 公尺內、在法線前方的點越近越暗）。沒有 TAA，雜訊固定在畫面上（逐幀換會閃），
// 再橫直兩趟依深度的模糊抹掉；60–140 m 淡掉（再遠在霧裡）。合成時乘在泛光之前，亮到會泛光的地方（霓虹、招牌、窗燈）不壓暗
const AO_N = 12;
const mAO = AO_ON ? pass('ao', { tDepth: { value: null }, uInvProj: { value: new T.Matrix4() }, uDT: { value: new T.Vector2() }, uPy: { value: 1 }, uRad: { value: 1.1 }, uK: { value: 1 }, uFogD: { value: .01 }, uDayK: { value: 0 } }) : null;
// 依深度的模糊：七個點、離中心越遠權重越低，深度差超過 6%（加 5 cm）的點不算（前景的柱子不會把遮蔽抹到後面的牆上）
const mAOBlur = AO_ON ? pass('aoblur', { tSrc: { value: null }, uDir: { value: new T.Vector2() } }) : null;
// 眼睛適應：曝光本身照舊由 28-sky.js 的 atm.exp 與場館的 ENV.post.exp 決定（穩定時倍率是 1，調好的畫面不變），
// 只在亮度突然變了的那幾秒補上眼睛的反應：從暗處出到大太陽下先過曝、進隧道或暗巷先一片黑，再慢慢適應回來。
// 快的跟著畫面（0.15 s）、慢的是眼睛（約 2.5 s），倍率 =（快／慢）^0.5，夾在 0.55–1.8 倍；換鏡頭（camState.snap）時兩個一起重設
const mEyeLum = pass('eyelum', { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
const mEyeAdapt = pass('eyeadapt', { tSrc: { value: null }, tPrev: { value: null }, uK: { value: new T.Vector2() }, uReset: { value: 1 } });
let eyeI = 0, eyeReset = true;
const mComp = pass('comp', { tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null }, tVol: { value: null }, tAO: { value: null }, tEye: { value: null }, uVolOn: { value: 0 }, uAOOn: { value: 0 }, uAOThr: { value: 1 }, uEyeOn: { value: 0 }, uVolT: { value: new T.Vector2() }, uInvVP: { value: new T.Matrix4() }, uPrevVP: { value: new T.Matrix4() },
  uBlur: { value: .5 }, uExp: { value: 1.2 }, uTime: { value: 0 }, uWob: { value: 0 }, uFlash: { value: 0 }, uBloomK: { value: .9 }, uGray: { value: 0 }, uVig: { value: 0 }, uHurt: { value: 0 }, uTint: { value: new T.Vector4() }, uFx7: { value: new T.Vector4() }, uHeat: { value: Array.from({ length: HEAT_N }, () => new T.Vector4()) }, uRes: { value: new T.Vector2() }, uFx: { value: new T.Vector2(1, 1) }, uHi: { value: new T.Vector2() } });
depthMats = [mSSR, mVol, mAO, mComp].filter(Boolean); depthMsaa();
function blit(mat, target) { fsMesh.material = mat; R.setRenderTarget(target); R.render(fsScene, fsCam); }

const prevVP = new T.Matrix4(), curVP = new T.Matrix4();
let firstFrame = true;
const _rp = V3(), _rt = V3(), _ru = V3(), _fw = V3();
const reflBias = new T.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
// 倒影的遠平面（00-core.js 畫質等級的 rf）：倒影那一趟要把整個場景再畫一次，中低階只畫到霧差不多蓋滿的距離
// （夜裡指數霧剩 8%、白天平方指數霧剩 8% 的地方，鏡頭越高霧越淡、畫越遠），再遠的建築在倒影裡換成天空。
// high 不縮（對岸與遠景在海面上的倒影照舊）；__nc.reflFar(m) 可以固定成 m 公尺量測
let reflFarT = null;
function reflFar() {
  if (reflFarT) return reflFarT;
  const k = GT().rf; if (!k) return camera.far;
  const D = U.uFogDen.value * .6, d = lerp(2.5 / D, 1.58 / D, U.uDay.value);
  return clamp(d * k + Math.max(0, camera.position.y) * 3, 160, camera.far);
}
// 遠景樹進不進倒影：外緣山林的遠景樹 forestLo（50-assets.js，6.4 萬棵、860 萬個三角形）在倒影裡要再畫一次，但在市區被大樓擋住時倒影裡也看不到
// （雨夜光環廣場 31 → 25 ms）。主畫面畫一份樹林的包圍盒（300 m 一格，不寫顏色與深度，排在不透明的最後）做遮擋查詢：連續 2 次整份被擋住，
// forestLo 就換到 NOREFL 圖層（主鏡頭照畫、倒影不畫），看得到就放回來（結果晚 1～3 幀）。只在主畫面查：倒影鏡頭在地面下往上看，山坡與建築的背面被剔掉，
// 擋不住後面的樹（在倒影那一趟查永遠看得到）；直接看過去被擋住的，從地面積水往上反射的光線起點更低，也被同一批建築擋住。
// 城外空地、海面上朝山看時看得到，照畫（拿掉的話雨夜、黃昏、陰天的積水與海面少一道稜線）。查詢用 three 的 occlusionTest
const reflOcc = { en: true, occ: 0, hold: 0, skip: false, n: 0 };
function reflOccSet(vis) { if (reflOcc.hold > 0) return; reflOcc.n++; reflOcc.occ = vis ? 0 : reflOcc.occ + 1; }
const reflOccMesh = (() => {
  const L = Object.values(forestLo), C = 300, cells = new Map();
  for (const m of L) {
    const S = m.userData.stream; if (!S) continue;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox, hw = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z), t = S.mtx;
    for (let k = 0; k < S.n; k++) {
      const x = S.xs[k], z = S.zs[k], y = t[k * 16 + 13], sy = Math.hypot(t[k * 16 + 4], t[k * 16 + 5], t[k * 16 + 6]), r = hw * Math.hypot(t[k * 16], t[k * 16 + 1], t[k * 16 + 2]);
      if (!sy) continue;
      const key = Math.floor(x / C) * 65536 + Math.floor(z / C), b = cells.get(key) || [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
      b[0] = Math.min(b[0], x - r); b[1] = Math.min(b[1], y + bb.min.y * sy); b[2] = Math.min(b[2], z - r);
      b[3] = Math.max(b[3], x + r); b[4] = Math.max(b[4], y + bb.max.y * sy); b[5] = Math.max(b[5], z + r); cells.set(key, b);
    }
  }
  if (!cells.size) return null;
  const pos = [], idx = [];
  for (const b of cells.values()) {
    const o = pos.length / 3;
    for (let i = 0; i < 8; i++) pos.push(i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]);
    for (const f of [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]) idx.push(o + f[0], o + f[1], o + f[2], o + f[0], o + f[2], o + f[3]);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ name: 'reflOcc', colorWrite: false, depthWrite: false, side: T.DoubleSide }));   // 雙面：鏡頭在盒子裡也算看得到
  m.name = 'reflOcc'; m.frustumCulled = false; m.renderOrder = 1e9; m.layers.set(LY.NOREFL);   // 1 號圖層只有主鏡頭看得到
  m.occlusionTest = true; m.onBeforeRender = r => reflOccSet(!r.isOccluded(m));   // 讀到的是前幾幀解出來的結果
  scene.add(m);
  return m;
})();
// 每幀在倒影之前：決定 forestLo 進不進倒影。切鏡頭（camState.snap）後先照畫，之前送出的查詢結果丟掉 4 幀
function reflOccPoll() {
  if (!reflOccMesh) return;
  if (reflOcc.hold > 0) reflOcc.hold--;
  if (camState.snap) { reflOcc.hold = 4; reflOcc.occ = 0; }
  const skip = reflOcc.en && reflOcc.occ >= 2;
  if (skip !== reflOcc.skip) { reflOcc.skip = skip; for (const m of Object.values(forestLo)) for (const o of [m, m.userData.far]) if (o) o.layers.set(skip ? LY.NOREFL : LY.MAIN); }
}
function renderReflection() {
  reflOccPoll();
  // 虛擬相機：位置、注視點與上方向都對 y=0 平面鏡射
  camera.getWorldDirection(_fw);
  _rp.copy(camera.position); _rp.y = -_rp.y;
  _rt.copy(camera.position).add(_fw); _rt.y = -_rt.y;
  _ru.set(0, 1, 0).applyQuaternion(camera.quaternion); _ru.y = -_ru.y;
  reflCam.position.copy(_rp); reflCam.up.copy(_ru); reflCam.lookAt(_rt);
  reflCam.projectionMatrix.copy(camera.projectionMatrix);
  { const e = reflCam.projectionMatrix.elements, n = camera.near, f = reflFar(), gpu = R.coordinateSystem === T.WebGPUCoordinateSystem; e[10] = gpu ? -f / (f - n) : -(f + n) / (f - n); e[14] = (gpu ? -1 : -2) * f * n / (f - n); }   // 只改遠平面：xy 的投影不變，倒影貼圖的座標照舊（WebGPU 的深度是 0..1）
  reflCam.projectionMatrixInverse.copy(reflCam.projectionMatrix).invert();
  reflCam.updateMatrixWorld();
  reflU.uReflMat.value.multiplyMatrices(reflBias, reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  U.uClipY.value = 0; U.uCam.value.copy(_rp); const fw = U.uFocus.value.w; U.uFocus.value.w = 0;
  R.setRenderTarget(rtRefl); R.setClearColor(0x000000, 1); R.clear();
  fogCullAt(_rp);
  reflCull.t = reflCull.px ?? SET.reflMin; reflCull.on = reflCull.t > 0; reflCull.x = _rp.x; reflCull.y = _rp.y; reflCull.z = _rp.z; reflCull.k = rtRefl.height / 2 * reflCam.projectionMatrix.elements[5];
  if (SET.ssr && !firstFrame && !camState.snap) {   // 螢幕空間：rtScene 這時還是上一幀的畫面與深度，curVP 也還是上一幀的（切鏡頭那一幀上一幀是別的鏡頭，照平面畫）
    reflCull.on = false; fogCull.on = false;
    const s = mSSR.uniforms; s.tScene.value = rtScene.texture; s.tDepth.value = rtScene.depthTexture;
    s.uVP.value.copy(curVP); s.uInvVP.value.copy(curVP).invert(); s.uRP.value.copy(_rp);
    s.uInvRVP.value.copy(_ssrM.multiplyMatrices(reflCam.projectionMatrix, reflCam.matrixWorldInverse).invert());
    blit(mSSR, rtRefl);
  } else R.render(scene, reflCam);
  fogCull.on = false; reflCull.on = false;
  U.uClipY.value = -1e9; U.uCam.value.copy(camera.position); U.uFocus.value.w = fw;
}
R.info.autoReset = false;   // 一幀有很多次 render，統計要整幀累計
// 96-perf.js 的計時掛點：f 是 99-main 的 loop 開頭、a／b 是 renderFrame 的頭尾（沒開 ?perf 時是空的）
const perfHook = { f: null, a: null, b: null };
// 99-main.js 的 loop 開頭：記這一幀 CPU 從哪裡開始算，renderFrame 結束時得到整幀的 CPU 時間（邏輯＋送出指令，cpu 是平滑過的），
// 依幀時調整用它分辨是 CPU 送不完還是顯示卡畫不完：前者降解析度沒有用
const frameClk = { t0: 0, cpu: 8 };
function frameBegin(now) { frameClk.t0 = performance.now(); perfHook.f?.(now); }
// 自動解析度往上的上限：等級的 ss（high 1.25、ultra 1.5）再受內部像素數 px 限制（DPR 2 的 4K 螢幕本來就夠細，不再加）
const resMax = () => Math.min(GT().ss || 1, Math.sqrt((GT().px || 4.2e6) / Math.max(1, innerWidth * innerHeight * DPR * DPR)), R.capabilities.maxTextureSize / Math.max(innerWidth, innerHeight) / DPR);
// 世界矩陣只重算有變的：three 原本每幀對每個 matrixAutoUpdate 的物件 compose 再乘上父矩陣（場景約四千個物件，兩千多個不會動）。
// 位置、旋轉、縮放（matrixAutoUpdate 關掉的看 matrix 本身）與父物件都和上次一樣、父矩陣也沒重算時跳過
// mwSkip：renderFrame 每幀那一次整棵更新（on）跳過藏起來的子物件與它底下整串（場景約兩千個藏著的網格，多半是 distCull 收起的遠處街區），
// 重新出現時強制重算一次。只限那一次：程式裡自己呼叫的 updateMatrixWorld（例如先 updateMatrixWorld(true) 再讀子物件的 matrixWorld）照舊整棵算，
// getWorldPosition 之類走 updateWorldMatrix 也照舊。代價：藏著時直接讀 matrixWorld、沒先更新的，讀到的是藏起來那一刻的值（2026-11-13 查過全部讀 matrixWorld 的地方，
// 都是先更新過、載入時、或只讀看得到的物件）。en = false 關掉做 A/B
const mwSkip = { en: true, on: false };
{
  const P = T.Object3D.prototype, um = P.updateMatrix;
  // 「上次」的值放在每個物件一份固定形狀的記錄（_mw）裡：場景五千個物件有十幾種類別，直接讀 position／quaternion／scale 與後加的欄位，
  // 每個存取點都是多型（megamorphic）查表，比對一個物件約 300 ns；記錄先拿好三個向量的參照，每物件少五次這種查表（2026-11-13 同頁交錯：整棵 1.52 → 1.28 ms）。
  // position／quaternion／scale 在 three 是唯讀屬性（defineProperties 沒有 writable），參照不會換
  class MwRec { constructor(o) { this.p = o.position; this.q = o.quaternion; this.s = o.scale; this.trs = new Float64Array(10).fill(NaN); this.mtx = null; this.par = undefined; this.sk = false; } }
  // 「上次」記在 updateMatrix 裡：lookAt 與 getWorldDirection 會經 updateWorldMatrix 直接 compose（lookAt 用的是改轉向前的那組），
  // 只在這裡記的話，相機一幀內被設兩次（camState.over、地鐵的固定鏡頭）又回到上一幀的值時會跳過，矩陣停在中途那組
  P.updateMatrix = function () {
    um.call(this);
    const u = this._mw || (this._mw = new MwRec(this)), p = u.p, q = u.q, s = u.s, c = u.trs;
    c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q._x; c[4] = q._y; c[5] = q._z; c[6] = q._w; c[7] = s.x; c[8] = s.y; c[9] = s.z;
  };
  P.updateMatrixWorld = function (force) {
    const u = this._mw || (this._mw = new MwRec(this)), par = this.parent;
    if (this.matrixAutoUpdate) {
      const p = u.p, q = u.q, s = u.s, c = u.trs;
      if (c[0] !== p.x || c[1] !== p.y || c[2] !== p.z || c[3] !== q._x || c[4] !== q._y || c[5] !== q._z || c[6] !== q._w || c[7] !== s.x || c[8] !== s.y || c[9] !== s.z || u.par !== par || this.pivot !== null) {
        u.par = par;
        this.updateMatrix();
      }
    } else {   // 手動寫的 matrix：16 個數字比上次（比相乘便宜）
      const e = this.matrix.elements, c = u.mtx || (u.mtx = new Float64Array(16).fill(NaN));
      let k = 0; while (k < 16 && c[k] === e[k]) k++;
      if (k < 16 || u.par !== par) { c.set(e); u.par = par; this.matrixWorldNeedsUpdate = true; }
    }
    if (u.sk) { u.sk = false; force = true; }   // 上次整棵更新時藏著、被跳過：父矩陣可能已經變了，重算一次
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) { if (par === null) this.matrixWorld.copy(this.matrix); else this.matrixWorld.multiplyMatrices(par.matrixWorld, this.matrix); }
      this.matrixWorldNeedsUpdate = false; force = true;
    }
    const ch = this.children;
    if (mwSkip.on) for (let i = 0, l = ch.length; i < l; i++) { const k = ch[i]; if (k.visible === false) { (k._mw || (k._mw = new MwRec(k))).sk = true; continue; } k.updateMatrixWorld(force); }
    else for (let i = 0, l = ch.length; i < l; i++) ch[i].updateMatrixWorld(force);
  };
}
// 全進霧裡的不畫：00-core.js 的 applyFog 在鏡頭低於 20 m 時 D ≥ .5，視線距離 × uFogDen × .5 超過 6 就剩不到 0.25%（夜裡的指數霧與白天的平方指數霧都是），
// 包圍球整顆在那之外的物件在視錐測試就剔掉（海上 1～3 km 的船與乘客、對岸的小東西，每幀一百多個 draw call）。
// 只對整段霧都算的材質：片段著色器有呼叫 applyFog（src/tsl/ 產生時記下的 fog，02-gfx.js 的 gfxMeta）、沒有 FAR（遠景只算一部分距離的霧，剪影要看得到）；鏡頭在高處時霧變淡，不剔
const fogCull = { en: true, on: false, x: 0, y: 0, z: 0, d: 0, empty: true }, fogMat = new WeakMap(), _fcS = new T.Sphere();
const fogFull = m => {
  if (Array.isArray(m)) return m.every(fogFull);
  let v = fogMat.get(m);
  if (v === undefined) { const g = m.isShaderMaterial && gfxMeta(m); v = !!(g && g.fog && !(m.defines && 'FAR' in m.defines)); fogMat.set(m, v); }
  return v;
};
function fogCullAt(p) { fogCull.on = fogCull.en && camera.position.y < 20; fogCull.x = p.x; fogCull.y = p.y; fogCull.z = p.z; fogCull.d = 12 / Math.max(U.uFogDen.value, 1e-4); }
// 沒東西可畫的也在這裡剔掉：three 不跳過 count 0 的 InstancedMesh 與沒有頂點的幾何（照樣切程式、更新 uniform、送一次空的 draw），
// 串流實例（20-props.js 的 instUpdate）的球跟著相機、永遠在視錐裡，附近沒有實例時每幀白送（光環廣場 980 個 draw 裡 460 個）
// 倒影的螢幕大小剔除（Unreal 平面倒影的做法：倒影那一趟不畫投影半徑小於 px 個倒影貼圖像素的物件）：倒影是半解析度、還被濕路面的粗糙度抹開，
// 遠處的小東西在倒影裡看不出來，卻佔倒影那一趟三成的 draw call（2026-11-01 戰鬥觀戰量測；門檻是 01-settings.js 的 SET.reflMin，預設 2 px，使用者看過前後對照同意）。半透明與加法混色的（燈、招牌光暈、車燈）照畫：路面上的燈影是夜景的重點
const reflCull = { px: null, t: 0, on: false, x: 0, y: 0, z: 0, k: 1, n: 0, log: null }, reflKeepM = new WeakMap();
// 主畫面的遠處小物剔除（SET.farMin，0 關閉）：同一套做法用在主畫面，門檻是 rtScene 像素；包圍球整顆投影半徑小於門檻的不透明物件不畫。
// 2026-11-01 觀測模型：中距離視角約 1080 個 draw 裡約 90 個是 2 km 外不到半像素的建築與設施模型（glb）。InstancedMesh 的球是全部實例合起來的，不適用。
// 0.5 px（預設）與 1 px 在 tools/lossless.mjs 的六個視角都和關閉時逐像素相同（差異在暫停畫面本身的雜訊內）；中距離視角 draw −91（1 px 是 −149），CPU 送出只少 0.1～0.3 ms。
// 2026-11-09 預設改 2 px：和 0.5 px 比，六個視角最多差 12 個像素、每個差 ≤ 4/255（多在霧裡）；中距離視角 draw 916 → 701、平面倒影視角 1310 → 1013（整幀 −0.4／−1.5 ms）
const farCull = { px: null, t: 0, on: false, x: 0, y: 0, z: 0, k: 1, n: 0, log: null };   // px：量測用的覆寫（null 照 SET.farMin）
const reflKeep = m => {
  if (Array.isArray(m)) return m.some(reflKeep);
  let v = reflKeepM.get(m);
  if (v === undefined) { v = !!(m.transparent || (m.blending !== undefined && m.blending !== T.NormalBlending)); reflKeepM.set(m, v); }
  return v;
};
// 手上的槍（69-combat.js 的 wModel 標 userData.reflKeep）照畫：小，但槍口火光照在它旁邊，戰鬥時濕路面上的那幾點火光要留著
const reflPin = o => { for (let q = o, i = 0; q && i < 5; q = q.parent, i++) if (q.userData.reflKeep) return true; return false; };
T.Frustum.prototype.intersectsObject = function (o) {
  if (gfxCompiling.all) return true;   // 02-gfx.js 的 gfxCompile：畫面外的也編
  if (fogCull.empty) {   // 99-main.js 開場 compileAsync 時關掉
    if (o.isInstancedMesh && o.count === 0) return false;
    const g = o.geometry; if (g && (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 1) === 0) return false;
  }
  const s = _fcS;
  if (o.boundingSphere !== undefined) { if (o.boundingSphere === null) o.computeBoundingSphere(); s.copy(o.boundingSphere).applyMatrix4(o.matrixWorld); }
  else { const g = o.geometry; if (g.boundingSphere === null) g.computeBoundingSphere(); s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); }
  if (fogCull.on) { const c = s.center, dx = c.x - fogCull.x, dy = c.y - fogCull.y, dz = c.z - fogCull.z, L = fogCull.d + s.radius; if (dx * dx + dy * dy + dz * dz > L * L && fogFull(o.material)) return false; }
  if (reflCull.on) { const c = s.center, d = Math.hypot(c.x - reflCull.x, c.y - reflCull.y, c.z - reflCull.z); if (d > s.radius && s.radius / d * reflCull.k < reflCull.t && !reflKeep(o.material) && !reflPin(o)) { reflCull.n++; if (reflCull.log) reflCull.log.push(o); return false; } }
  if (farCull.on && !o.isInstancedMesh) { const c = s.center, d = Math.hypot(c.x - farCull.x, c.y - farCull.y, c.z - farCull.z); if (d > s.radius && s.radius / d * farCull.k < farCull.t && !reflKeep(o.material) && !reflPin(o) && this.intersectsSphere(s)) { farCull.n++; if (farCull.log) farCull.log.push(o); return false; } }
  if (!this.intersectsSphere(s)) return false;
  return !o.isInstancedMesh || !instCl.en || instAny(this, o);
};
// 實例全在視錐外的整個不畫：three 拿全部實例合起來的一顆球測，散在全城的實例（遠景樹 forestFar 的球半徑 10 萬 m、路邊道具、車庫的車）幾乎永遠「在裡面」，
// 高處俯瞰時每幀白送五百多萬個三角形（2026-11-01 觀測模型：凍結畫面藏起這些 −2 ms）。實例照所在格子（實例本身座標，格寬照分布範圍取 8×8 左右）分群，
// 每群一顆包住「實例中心＋幾何球半徑×縮放」的球，多留 INST_PAD；任一群碰到視錐就照舊整個畫（不重排、不改緩衝，畫出來的東西一樣）。
// 實例矩陣改了（instanceMatrix.version）或 count 變了才重算；每幀都在改的（車流這類）連續 4 次就不分群，照舊。instCl.en = false 關掉比對，log = [] 記下剔掉的
const INST_EACH = 64, INST_EACH_CHURN = 128, INST_PAD = 2, instCl = { en: true, each: true, n: 0, f: 0, log: null }, _icS = new T.Sphere();
function instClusters(o) {
  let C = o.userData.icl;
  const v = o.instanceMatrix.version, n = o.count;
  if (C && C.v === v && C.n === n) { if (C.s || C.churn < 4 || instCl.f - C.f <= 30) return C; }   // 每幀在改的停了 30 幀，再試著分群
  else if (C && C.churn >= 4 && (n > INST_EACH_CHURN || !instCl.each)) { C.v = v; C.n = n; C.f = instCl.f; return C; }
  const churn = C && instCl.f - C.f <= 1 ? C.churn + 1 : 0;   // 連續幾幀都在改
  C = o.userData.icl = { v, n, churn, f: instCl.f, s: null };
  if (churn >= 4 && (n > INST_EACH_CHURN || !instCl.each) || !instCl.each && n < 8) return C;
  const g = o.geometry; if (g.boundingSphere === null) g.computeBoundingSphere();
  const gc = g.boundingSphere.center, gr = g.boundingSphere.radius, A = o.instanceMatrix.array;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), Rr = new Float32Array(n);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const b = i * 16;
    X[i] = A[b] * gc.x + A[b + 4] * gc.y + A[b + 8] * gc.z + A[b + 12]; Y[i] = A[b + 1] * gc.x + A[b + 5] * gc.y + A[b + 9] * gc.z + A[b + 13]; Z[i] = A[b + 2] * gc.x + A[b + 6] * gc.y + A[b + 10] * gc.z + A[b + 14];
    Rr[i] = gr * Math.sqrt(Math.max(A[b] * A[b] + A[b + 1] * A[b + 1] + A[b + 2] * A[b + 2], A[b + 4] * A[b + 4] + A[b + 5] * A[b + 5] + A[b + 6] * A[b + 6], A[b + 8] * A[b + 8] + A[b + 9] * A[b + 9] + A[b + 10] * A[b + 10]));
    if (X[i] < x0) x0 = X[i]; if (X[i] > x1) x1 = X[i]; if (Z[i] < z0) z0 = Z[i]; if (Z[i] > z1) z1 = Z[i];
  }
  if (!(x1 >= x0 && z1 >= z0)) return C;   // NaN：照舊
  if (instCl.each && (n <= INST_EACH || churn >= 4)) {   // 實例不多（或每幀在改、但不多）：每個實例一顆球；縮成 0 或藏到地底的不算（全都是就整個不畫）
    const S = [];
    for (let i = 0; i < n; i++) if (Rr[i] > 1e-6 && Y[i] > -1000) S.push(X[i], Y[i], Z[i], Rr[i] + INST_PAD);
    for (const q of S) if (!Number.isFinite(q)) return C;
    C.s = new Float32Array(S);
    return C;
  }
  const cw = Math.max(16, (x1 - x0) / 8, (z1 - z0) / 8), nx = Math.floor((x1 - x0) / cw) + 1, nz = Math.floor((z1 - z0) / cw) + 1;
  const B = new Float32Array(nx * nz * 7).fill(NaN);   // 每格：x0 y0 z0 x1 y1 z1 最大半徑
  for (let i = 0; i < n; i++) {
    const k = (Math.min(nx - 1, Math.floor((X[i] - x0) / cw)) * nz + Math.min(nz - 1, Math.floor((Z[i] - z0) / cw))) * 7;
    if (!(B[k] <= X[i])) B[k] = X[i]; if (!(B[k + 1] <= Y[i])) B[k + 1] = Y[i]; if (!(B[k + 2] <= Z[i])) B[k + 2] = Z[i];
    if (!(B[k + 3] >= X[i])) B[k + 3] = X[i]; if (!(B[k + 4] >= Y[i])) B[k + 4] = Y[i]; if (!(B[k + 5] >= Z[i])) B[k + 5] = Z[i];
    if (!(B[k + 6] >= Rr[i])) B[k + 6] = Rr[i];
  }
  const S = [];
  for (let k = 0; k < B.length; k += 7) if (B[k] === B[k]) S.push((B[k] + B[k + 3]) / 2, (B[k + 1] + B[k + 4]) / 2, (B[k + 2] + B[k + 5]) / 2, Math.hypot(B[k + 3] - B[k], B[k + 4] - B[k + 1], B[k + 5] - B[k + 2]) / 2 + B[k + 6] + INST_PAD);
  for (const q of S) if (!Number.isFinite(q)) return C;
  C.s = new Float32Array(S);
  return C;
}
function instAny(fr, o) {
  const C = instClusters(o);
  if (!C || !C.s) return true;
  const S = C.s, M = o.matrixWorld;
  for (let k = 0; k < S.length; k += 4) { _icS.center.set(S[k], S[k + 1], S[k + 2]); _icS.radius = S[k + 3]; _icS.applyMatrix4(M); if (fr.intersectsSphere(_icS)) return true; }
  instCl.n++; if (instCl.log) { const rt = R.getRenderTarget(); instCl.log.push([o.name || o.parent?.name || '', o.material.name || o.material.type, o.count, rt ? `${rt.width}x${rt.height}` : 'canvas']); }
  return false;
}
// 關掉視錐剔除的空實例：車流、路邊停車（uberTraf／uberPal）、uberTint、蒸氣、車底陰影與頭燈照地的 InstancedMesh 都設了 frustumCulled = false，
// three 不會呼叫上面的 intersectsObject，count 0 時照樣送一次空的 draw（2026-11-01 戰鬥觀戰：每趟約 70 個，倒影與主畫面合計約一成二的 draw）。
// 在走訪時先擋掉；開場預編（gfxCompiling.all、fogCull.empty 關掉）照舊放行。fogCull.emptyFc = false 可以關掉做 A/B
fogCull.emptyFc = true; fogCull.instFc = true;
const INST_FC_MAT = new Set(['uberTraf', 'uberPal']);
{
  const po = R._projectObject;
  const fr = new T.Frustum(), pm = new T.Matrix4(), frVi = new T.Matrix4(), frPr = new T.Matrix4(); let frCam = null;
  R._projectObject = function (o, cam, go, rl, cc) {
    if (o.count === 0 && o.isInstancedMesh && fogCull.empty && fogCull.emptyFc && !gfxCompiling.all && o.children.length === 0) return;
    // 車流（uberTraf）與路邊停車（uberPal）：實例每幀換位置，three 那顆合起來的球不會更新，所以關了視錐剔除；這裡照每台車的位置測（instClusters 的每實例球），
    // 一台都不在視錐裡就整個不畫（2026-11-09 觀測：跟車時主畫面每幀約三十個這種白畫的 draw）。fogCull.instFc = false 關掉做 A/B
    if (o.isInstancedMesh && !o.frustumCulled && o.count > 0 && fogCull.instFc && fogCull.empty && instCl.en && !gfxCompiling.all && o.visible && INST_FC_MAT.has(o.material.name) && o.layers.test(cam.layers)) {
      if (frCam !== cam || !frVi.equals(cam.matrixWorldInverse) || !frPr.equals(cam.projectionMatrix)) { frCam = cam; frVi.copy(cam.matrixWorldInverse); frPr.copy(cam.projectionMatrix); pm.multiplyMatrices(frPr, frVi); fr.setFromProjectionMatrix(pm, cam.coordinateSystem, cam.reversedDepth); }
      if (!instAny(fr, o)) { if (o.children.length === 0) return; }
    }
    return po.call(this, o, cam, go, rl, cc);
  };
}
let reflOdd = 0;
function renderFrame(dt, t) {
  perfHook.a?.(); instCl.f++;
  R.info.reset();
  // 整個場景的矩陣一幀只算一次：倒影與主畫面兩趟 R.render 原本各算一次（場景有三千多個物件）
  curScene.matrixWorldAutoUpdate = false; mwSkip.on = mwSkip.en; try { curScene.updateMatrixWorld(); } finally { mwSkip.on = false; }
  camera.updateMatrixWorld();
  sky.position.copy(camera.position); sky.updateMatrixWorld();   // 天空球跟著相機（城市東西兩端離原點超過半徑）
  U.uCam.value.copy(camera.position);
  { const a = 1 + Math.round(sstep(60, 220, camera.position.y) * 6) / 10; if (a !== detail.alt) { detail.alt = a; detail.v++; } U.uCullR.value = INST_R * detailK(); }   // 高處看得更遠（01-settings.js 的 detail.alt）
  { const cx = camera.position.x, cz = camera.position.z, zc = zoneAtW(cx, cz); if (zc) { const f = localZone(zc, ...zoneLocal(zc, cx, cz)); U.uZone.value.set(f.ox, f.oz, f.c, f.s); } }   // 相機那一點的剛體框（彎曲的片）
  const outdoors = curScene === scene;
  const vp = outdoors ? null : (ENV[player.where] || {}).post;   // 場館自己的曝光、泛光門檻與高光肩部（60-venues.js 的 ENV）
  reflU.uReflOn.value = outdoors && SET.refl ? 1 : 0;
  // 倒影隔幀畫：沒畫的那一幀沿用上一張倒影與它的投影矩陣（uReflMat），靜止的東西位置照樣對；剛切換鏡頭時一定畫
  if (outdoors && SET.refl && (!post.reflHalf || (reflOdd ^= 1) || firstFrame || camState.snap)) renderReflection();
  R.setRenderTarget(rtScene); R.setClearColor(0x000000, 1); R.clear();
  if (outdoors) fogCullAt(camera.position);
  farCull.t = farCull.px ?? SET.farMin; farCull.on = farCull.t > 0 && !gfxCompiling.all; farCull.x = camera.position.x; farCull.y = camera.position.y; farCull.z = camera.position.z; farCull.k = rtScene.height / 2 * camera.projectionMatrix.elements[5];
  R.render(curScene, camera); fogCull.on = false; farCull.on = false;
  // 泛光
  const w = rtScene.width, h = rtScene.height;
  mPre.uniforms.tSrc.value = rtScene.texture; mPre.uniforms.uTexel.value.set(1 / w, 1 / h); mPre.uniforms.uThr.value = outdoors ? atm.bloom : vp?.thr ?? 1; blit(mPre, rtB[0]);
  for (let i = 1; i < rtB.length; i++) { mDown.uniforms.tSrc.value = rtB[i - 1].texture; mDown.uniforms.uTexel.value.set(1 / rtB[i - 1].width, 1 / rtB[i - 1].height); blit(mDown, rtB[i]); }
  const last = rtB.length - 1;
  for (let i = last - 1; i >= 0; i--) {
    mUp.uniforms.tSrc.value = (i === last - 1 ? rtB[last] : rtU[i + 1]).texture;
    mUp.uniforms.tAdd.value = rtB[i].texture;
    mUp.uniforms.uTexel.value.set(1 / rtB[i].width, 1 / rtB[i].height); mUp.uniforms.uK.value = 1;
    blit(mUp, rtU[i]);
  }
  // 合成
  curVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  if (firstFrame || camState.snap) { prevVP.copy(curVP); firstFrame = false; camState.snap = false; eyeReset = true; }
  const u = mComp.uniforms;
  const volK = mVol && outdoors ? SET.vol * atm.sunK * sstep(.2, .6, U.uDay.value) : 0;
  u.uVolOn.value = volK > .01 ? 1 : 0;
  if (u.uVolOn.value) {
    const v = mVol.uniforms; v.tDepth.value = rtScene.depthTexture; v.uInvVP.value.copy(curVP).invert(); v.uVolK.value = .0035 * volK;
    blit(mVol, rtV); u.tVol.value = rtV.texture; u.uVolT.value.set(1 / rtV.width, 1 / rtV.height);
  }
  const aoK = mAO ? SET.ao : 0;
  u.uAOOn.value = aoK > .01 ? (post.aoDbg ? 2 : 1) : 0;
  if (u.uAOOn.value) {
    const a = mAO.uniforms, b = mAOBlur.uniforms, A0 = rtA[0], A1 = rtA[1];
    a.tDepth.value = rtScene.depthTexture; a.uInvProj.value.copy(camera.projectionMatrixInverse); a.uDT.value.set(1 / w, 1 / h); a.uPy.value = camera.projectionMatrix.elements[5]; a.uK.value = aoK; a.uFogD.value = outdoors ? U.uFogDen.value : 0; a.uDayK.value = U.uDay.value;
    blit(mAO, A0);
    b.tSrc.value = A0.texture; b.uDir.value.set(1 / A0.width, 0); blit(mAOBlur, A1);
    b.tSrc.value = A1.texture; b.uDir.value.set(0, 1 / A0.height); blit(mAOBlur, A0);
    u.tAO.value = A0.texture; u.uAOThr.value = mPre.uniforms.uThr.value;
  }
  u.uEyeOn.value = SET.eye && GPU.hdr ? 1 : 0;
  if (u.uEyeOn.value) {
    const e = mEyeLum.uniforms, f = mEyeAdapt.uniforms, rd = Math.min(slowmo.raw, .1);
    e.tSrc.value = rtScene.texture; e.uTexel.value.set(.25 / EYE_W, .25 / EYE_H); blit(mEyeLum, rtL);
    f.tSrc.value = rtL.texture; f.tPrev.value = rtEye[eyeI].texture; f.uK.value.set(1 - Math.exp(-rd / .15), 1 - Math.exp(-rd / 2.5)); f.uReset.value = eyeReset ? 1 : 0;
    eyeI ^= 1; blit(mEyeAdapt, rtEye[eyeI]); eyeReset = false;
    u.tEye.value = rtEye[eyeI].texture;
  } else eyeReset = true;
  u.tScene.value = rtScene.texture; u.tDepth.value = rtScene.depthTexture; u.tBloom.value = rtU[0].texture;
  u.uInvVP.value.copy(curVP).invert(); u.uPrevVP.value.copy(prevVP);
  u.uBlur.value = post.blur; u.uExp.value = post.exposure * SET.bright * (outdoors ? atm.exp : vp?.exp ?? 1); u.uTime.value = t; u.uWob.value = post.wobble; u.uFlash.value = U.uFlash.value;
  u.uBloomK.value = (outdoors ? .85 : vp?.bloom ?? 1) * SET.bloom; u.uHi.value.set(vp?.knee ?? 0, vp?.range ?? 1);
  u.uFx.value.set(SET.ca ? 1 : 0, SET.grain ? 1 : 0);
  u.uGray.value = post.gray; u.uVig.value = post.vig; u.uHurt.value = post.hurt; u.uTint.value.copy(post.tint);
  heatUniforms(u);
  u.uRes.value.set(w, h);
  blit(mComp, null);
  prevVP.copy(curVP);
  // 依幀時調整內部解析度
  // 子彈時間時 dt 是放慢後的遊戲時間，幀時要用真實時間量
  // 目標幀時：螢幕更新間隔（取最近最短的幀間隔，慢慢往上漂）與幀率上限取長的。60 Hz 螢幕的幀時不會低於 16.7 ms，
  // 所以「夠快」是貼著更新間隔；30 fps 上限時不能拿 19 ms 當太慢（不然一直降）。降過一次 15 秒內不升，免得在兩檔之間來回重建渲染目標
  const ms = slowmo.raw * 1000, rd = slowmo.raw;
  post.ft = lerp(post.ft, Math.min(ms, 50), .05);   // 單幀上限 50 ms：開場與瞬移時載入的一兩百 ms 尖峰原本會把平滑幀時推高，讓自動模式一開場就把倒影與細節距離降下去，之後回不來 post.vs = Math.min(post.vs + .01, Math.max(ms, 4)); post.cool = Math.max(0, post.cool - rd);
  const tgt = Math.max(post.vs, SET.fps ? 1000 / SET.fps : 0);
  if (post.ft > Math.max(19, tgt * 1.15)) { post.slow += rd; post.fast = 0; } else if (post.ft < Math.max(13, tgt * 1.04)) { post.fast += rd; post.slow = 0; } else { post.slow = post.fast = 0; }
  if (SET.res !== 'auto' || post.cool > 0) post.fast = 0;
  if (SET.res !== 'auto') post.slow = 0;   // 固定解析度比例時不自動調整
  // 太慢時的順序：CPU 送不完（整幀 CPU 超過目標的八成）先讓戶外的倒影隔幀畫，再縮短細節距離；顯示卡畫不完先降內部解析度（到 60%），
  // 都到底了才動另一邊。變快時倒著放回來：距離 → 倒影（CPU 留得出倒影那一趟的餘裕才放）→ 解析度（可以超過 100%，到 resMax 為止）
  frameClk.cpu = lerp(frameClk.cpu, performance.now() - frameClk.t0, .05);
  // CPU 忙不忙照「至少 60 fps」算：144 Hz 螢幕的 tgt 只有 6.9 ms，原本拿它的八成（5.5 ms）比，幾乎每幀都算 CPU 忙，山路顯示卡畫不完時不降解析度、先去縮細節距離
  const cpuB = frameClk.cpu > Math.max(tgt, 1000 / 60) * .8, reflOn = outdoors && SET.refl, rMin = resMin();
  if (post.slow > 1.2) {
    const s0 = post.scale;
    if (reflOn && !post.reflHalf && (cpuB || post.scale <= rMin)) post.reflHalf = true;
    else if (post.scale > rMin && (!cpuB || detail.k <= .6)) { post.scale = Math.max(rMin, post.scale - .1); makeTargets(); }
    else if (detail.k > .6) { detail.k = Math.max(.6, detail.k - .1); detail.v++; }   // 縮短建築與街道設施的細節距離（01-settings.js）
    if (s0 > 1 && post.scale < s0) post.ceil = Math.min(post.ceil, s0 - .05);   // 超過 100% 降過一次就不再升回那一檔
    post.slow = 0; post.cool = 15;
  }
  if (post.fast > 4) {
    post.fast = 0;
    if (detail.k < 1) { detail.k = Math.min(1, detail.k + .05); detail.v++; }
    else if (post.reflHalf && (!reflOn || frameClk.cpu < tgt * .55)) post.reflHalf = false;
    else {
      const top = post.scale < 1 ? 1 : frameClk.cpu < tgt * .6 ? Math.min(resMax(), post.ceil) : 1;   // 100% 以上要 CPU 也有餘裕
      if (post.scale < top - .001) { post.scale = Math.min(top, post.scale + .05); makeTargets(); }
    }
  }
  if (post.wobble > 0) post.wobble = Math.max(0, post.wobble - dt * .08);
  perfHook.b?.();
}
