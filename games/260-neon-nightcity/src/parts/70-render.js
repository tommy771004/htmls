
// ═══ 渲染管線：路面倒影 → 主畫面 → 泛光 → 動態模糊、色調映射、暗角與顆粒 ═══
await bootStep(BOOT.render, '點亮霓虹…');
const camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, .2, 4200);   // 遠平面要到北面的山與對岸（21-coast.js）
camera.layers.enable(LY.NOREFL);
const reflCam = new T.PerspectiveCamera(); reflCam.layers.set(LY.MAIN);
for (const m of groundMeshes) m.layers.set(LY.NOREFL);
let DPR = Math.min(devicePixelRatio || 1, GT().dpr);   // 00-core.js 的畫質等級：解析度上限
R.setPixelRatio(DPR);
// 固定的內部解析度比例：'1080p' 是短邊 1080 px（螢幕本身不到 1080 就照螢幕的實際像素，不超取樣；觸控裝置不超過等級的 DPR 上限，手機照舊），數字照比例；'auto' 從 100% 開始
const resScale = () => { if (SET.res !== '1080p') return typeof SET.res === 'number' ? SET.res : 1; const s = Math.min(innerWidth, innerHeight), k = Math.min(1080, s * (devicePixelRatio || 1)) / (s * DPR); return isTouch ? Math.min(k, 1) : k; };
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
// 驅動重置後 three 會重建 GL 狀態並重新上傳材質與貼圖，渲染目標在這裡重做；沒恢復前遊戲照跑、畫面停在最後一幀
R.domElement.addEventListener('webglcontextlost', () => { GPU.lost++; toast('顯示卡重置中…'); }, false);
R.domElement.addEventListener('webglcontextrestored', () => { makeTargets(); firstFrame = true; toast('畫面已恢復'); }, false);

// 全螢幕三角形
const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new T.BufferGeometry();
fsGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
fsGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const fsMesh = new T.Mesh(fsGeo); fsMesh.frustumCulled = false;
const fsScene = new T.Scene(); fsScene.add(fsMesh);
const FS_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const pass = (name, fs, uniforms) => new T.ShaderMaterial({ name, vertexShader: FS_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
const mPre = pass('pre', `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; varying vec2 vUv;
  // MSAA 邊緣外插偶爾讓某個 shader 算出 NaN／inf，在這裡擋掉，免得被 bloom 擴散成白斑
  vec3 tap(vec2 o){ vec3 c = texture2D(tSrc, vUv + uTexel * o).rgb; return any(isnan(c)) ? vec3(0.) : min(c, vec3(60.)); }
  void main(){
    vec3 c = tap(vec2(-1., -1.)) + tap(vec2(1., -1.)) + tap(vec2(-1., 1.)) + tap(vec2(1., 1.));
    c *= .25;
    float br = max(c.r, max(c.g, c.b));
    float w = smoothstep(.7 * uThr, 1.7 * uThr, br);   // 白天門檻拉高（28-sky.js 的 atm.bloom），不然日照的牆整面發光
    gl_FragColor = vec4(min(c * w, vec3(30.)), 1.);
  }`, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThr: { value: 1 } });
const mDown = pass('down', `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  void main(){
    vec2 t = uTexel;
    vec3 a = texture2D(tSrc, vUv + t * vec2(-2., -2.)).rgb, b = texture2D(tSrc, vUv + t * vec2(0., -2.)).rgb, c = texture2D(tSrc, vUv + t * vec2(2., -2.)).rgb;
    vec3 d = texture2D(tSrc, vUv + t * vec2(-2., 0.)).rgb, e = texture2D(tSrc, vUv).rgb, f = texture2D(tSrc, vUv + t * vec2(2., 0.)).rgb;
    vec3 g = texture2D(tSrc, vUv + t * vec2(-2., 2.)).rgb, h = texture2D(tSrc, vUv + t * vec2(0., 2.)).rgb, i = texture2D(tSrc, vUv + t * vec2(2., 2.)).rgb;
    vec3 j = texture2D(tSrc, vUv + t * vec2(-1., -1.)).rgb, k = texture2D(tSrc, vUv + t * vec2(1., -1.)).rgb, l = texture2D(tSrc, vUv + t * vec2(-1., 1.)).rgb, m = texture2D(tSrc, vUv + t * vec2(1., 1.)).rgb;
    vec3 o = e * .125 + (a + c + g + i) * .03125 + (b + d + f + h) * .0625 + (j + k + l + m) * .125;
    gl_FragColor = vec4(o, 1.);
  }`, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
const mUp = pass('up', `uniform sampler2D tSrc, tAdd; uniform vec2 uTexel; uniform float uK; varying vec2 vUv;
  void main(){
    vec2 t = uTexel;
    vec3 s = texture2D(tSrc, vUv).rgb * 4.;
    s += (texture2D(tSrc, vUv + vec2(t.x, 0.)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0.)).rgb + texture2D(tSrc, vUv + vec2(0., t.y)).rgb + texture2D(tSrc, vUv - vec2(0., t.y)).rgb) * 2.;
    s += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
    gl_FragColor = vec4(texture2D(tAdd, vUv).rgb + s / 16. * uK, 1.);
  }`, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new T.Vector2() }, uK: { value: 1 } });
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
const mVol = VOL_N ? pass('vol', `${GL_LIB}
  uniform sampler2D tDepth; uniform mat4 uInvVP; uniform float uVolK; varying vec2 vUv;
  float vVis(vec3 r){
    float sl = max(length(uSun.xz), 1e-3); vec2 d = uSun.xz / sl; float k = uSun.y / sl, t = 1.2;
    for (int i = 0; i < 12; i++) {
      float ry = r.y + t * k; if (ry > uHM.w) break;
      vec2 uv = (r.xz + d * t - uHM.xy) * uHM.z;
      if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) break;
      if (textureLod(uHMap, uv, 0.).r > ry) return 0.;
      t = t * 1.4 + 1.2;
    }
    return leafVis(r, d, k);
  }
  void main(){
    float dp = texture2D(tDepth, vUv).r;
    vec4 wp = uInvVP * vec4(vUv * 2. - 1., ${R.coordinateSystem === T.WebGPUCoordinateSystem ? 'dp' : 'dp * 2. - 1.'}, 1.); wp /= wp.w;   // WebGPU 的深度本來就是 0..1
    vec3 rd = wp.xyz - uCam; float L = length(rd); rd /= max(L, 1e-3);
    if (dp >= 1.) L = 400.;
    L = min(L, 160.);
    float j = hw(gl_FragCoord.xy + fract(uTime * 7.31) * 97.), ds = L / float(VOL_N_T), acc = 0.;
    for (int i = 0; i < VOL_N_T; i++) {
      float s = (float(i) + j) * ds; vec3 r = uCam + rd * s;
      float den = .05 + uGI.z * 520. * exp(-max(r.y, 0.) / 7.);
      acc += vVis(r) * den * ds * exp(-s * .012);
    }
    float sd = max(dot(rd, uSun), 0.), ph = .05 + sd * sd * sd * .9 + pow(sd, 20.) * 1.6;
    gl_FragColor = vec4(uSunCol * ph * acc * uVolK, 1.);
  }`, { ...shared(ALLU), tDepth: { value: null }, uInvVP: { value: new T.Matrix4() }, uVolK: { value: 0 } }) : null;
// 環境光遮蔽（SSAO）：半解析度，從主畫面的深度還原相機空間的位置，法線取左右、上下兩側深度比較接近的那一邊（邊緣不糊），
// 沿螺旋取 AO_N 個點（McGuire 的 SAO：半徑 uRad 公尺內、在法線前方的點越近越暗）。沒有 TAA，雜訊固定在畫面上（逐幀換會閃），
// 再橫直兩趟依深度的模糊抹掉；60–140 m 淡掉（再遠在霧裡）。合成時乘在泛光之前，亮到會泛光的地方（霓虹、招牌、窗燈）不壓暗
const AO_N = 12;
const mAO = AO_ON ? pass('ao', `uniform sampler2D tDepth; uniform mat4 uInvProj; uniform vec2 uDT; uniform float uPy, uRad, uK, uFogD, uDayK; varying vec2 vUv;
  vec3 vpos(vec2 q){ float d = texture2D(tDepth, q).r; vec4 v = uInvProj * vec4(q * 2. - 1., ${R.coordinateSystem === T.WebGPUCoordinateSystem ? 'd' : 'd * 2. - 1.'}, 1.); return v.xyz / v.w; }
  void main(){
    vec2 q = (floor(vUv / uDT) + .5) * uDT;   // 半解析度的像素中心剛好落在兩個全解析度深度像素的交界：對齊到其中一個的中心，不然左右取到同一個像素，法線壞掉成一條條紋
    if (texture2D(tDepth, q).r >= 1.) { gl_FragColor = vec4(1., 1e4, 0., 1.); return; }
    vec3 P = vpos(q);
    vec3 l = vpos(q - vec2(uDT.x, 0.)), r = vpos(q + vec2(uDT.x, 0.)), b = vpos(q - vec2(0., uDT.y)), t = vpos(q + vec2(0., uDT.y));
    vec3 dx = abs(r.z - P.z) < abs(P.z - l.z) ? r - P : P - l, dy = abs(t.z - P.z) < abs(P.z - b.z) ? t - P : P - b;
    vec3 n = normalize(cross(dx, dy)); n *= sign(dot(n, -P));
    float z = -P.z, ssR = min(uRad * uPy * .5 / (z * uDT.y), .12 / uDT.y);   // 半徑換成全解析度的像素，近處不超過畫面高的 12%
    float A = 1.;
    if (ssR > 1.5) {
      float a0 = 6.2832 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))), sum = 0., r2 = uRad * uRad, bias = .02 + .002 * z;
      for (int i = 0; i < ${AO_N}; i++) {
        float a = (float(i) + .5) / ${AO_N}., th = a * 43.98 + a0;   // 7 圈
        vec3 v = vpos(q + vec2(cos(th), sin(th)) * a * ssR * uDT) - P;
        float vv = dot(v, v), f = max(r2 - vv, 0.);
        sum += f * f * f * max((dot(v, n) - bias - .2 * sqrt(vv)) / (vv + .01), 0.);   // .2：仰角不到 12° 的點不算（人、樹幹這種曲面與還原的法線雜訊不會自己遮自己）
      }
      A = max(0., 1. - sum * uK * 5. / (r2 * r2 * r2 * ${AO_N}.));
    }
    // 霧裡的不壓暗：照 00-core.js applyFog 地面附近的霧量（夜裡指數、白天平方指數）淡掉，140 m 外全部不算
    float x = z * uFogD * .75, fog = mix(1. - exp(-x), 1. - exp(-x * x), uDayK);
    gl_FragColor = vec4(mix(A, 1., max(fog, smoothstep(90., 140., z))), z, 0., 1.);
  }`, { tDepth: { value: null }, uInvProj: { value: new T.Matrix4() }, uDT: { value: new T.Vector2() }, uPy: { value: 1 }, uRad: { value: 1.1 }, uK: { value: 1 }, uFogD: { value: .01 }, uDayK: { value: 0 } }) : null;
// 依深度的模糊：七個點、離中心越遠權重越低，深度差超過 6%（加 5 cm）的點不算（前景的柱子不會把遮蔽抹到後面的牆上）
const mAOBlur = AO_ON ? pass('aoblur', `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
  void main(){
    vec2 c = texture2D(tSrc, vUv).rg; float s = c.r, w = 1., tol = c.g * .06 + .05;
    for (int i = 1; i <= 3; i++) {
      float k = 1. - float(i) * .25;
      vec2 p = texture2D(tSrc, vUv + uDir * float(i)).rg, q = texture2D(tSrc, vUv - uDir * float(i)).rg;
      float kp = k * max(0., 1. - abs(p.g - c.g) / tol), kq = k * max(0., 1. - abs(q.g - c.g) / tol);
      s += p.r * kp + q.r * kq; w += kp + kq;
    }
    gl_FragColor = vec4(s / w, c.g, 0., 1.);
  }`, { tSrc: { value: null }, uDir: { value: new T.Vector2() } }) : null;
// 眼睛適應：曝光本身照舊由 28-sky.js 的 atm.exp 與場館的 ENV.post.exp 決定（穩定時倍率是 1，調好的畫面不變），
// 只在亮度突然變了的那幾秒補上眼睛的反應：從暗處出到大太陽下先過曝、進隧道或暗巷先一片黑，再慢慢適應回來。
// 快的跟著畫面（0.15 s）、慢的是眼睛（約 2.5 s），倍率 =（快／慢）^0.5，夾在 0.55–1.8 倍；換鏡頭（camState.snap）時兩個一起重設
const mEyeLum = pass('eyelum', `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  float lg(vec2 o){ vec3 c = texture2D(tSrc, vUv + uTexel * o).rgb; return log(max(dot(min(c, vec3(60.)), vec3(.2126, .7152, .0722)), 1e-4)); }
  void main(){ gl_FragColor = vec4((lg(vec2(-1., -1.)) + lg(vec2(1., -1.)) + lg(vec2(-1., 1.)) + lg(vec2(1., 1.))) * .25, 0., 0., 1.); }`,
  { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
const mEyeAdapt = pass('eyeadapt', `uniform sampler2D tSrc, tPrev; uniform vec2 uK; uniform float uReset; varying vec2 vUv;
  void main(){
    float s = 0.;
    for (int j = 0; j < ${EYE_H}; j++) for (int i = 0; i < ${EYE_W}; i++) s += texture2D(tSrc, (vec2(float(i), float(j)) + .5) / vec2(${EYE_W}., ${EYE_H}.)).r;
    float L = s / ${EYE_W * EYE_H}.;
    vec2 p = texture2D(tPrev, vec2(.5)).rg;
    gl_FragColor = vec4(uReset > .5 ? vec2(L) : vec2(mix(p.x, L, uK.x), mix(p.y, L, uK.y)), 0., 1.);
  }`, { tSrc: { value: null }, tPrev: { value: null }, uK: { value: new T.Vector2() }, uReset: { value: 1 } });
let eyeI = 0, eyeReset = true;
const mComp = pass('comp', `uniform sampler2D tScene, tDepth, tBloom, tVol, tAO, tEye; uniform float uVolOn, uAOOn, uAOThr, uEyeOn; uniform vec2 uVolT; uniform mat4 uInvVP, uPrevVP; uniform float uBlur, uExp, uTime, uWob, uFlash, uBloomK, uGray, uVig, uHurt; uniform vec4 uTint, uFx7; uniform vec2 uRes, uFx, uHi;
  uniform vec4 uHeat[${HEAT_N}];   // 69-v7-bunker.js 的熱源（畫面 uv、半徑、強度），uFx7：x 熱成像、y 神經毒氣、z 宿醉模糊、w 夜視鏡
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main(){
    vec2 uv = vUv;
    if (uWob > 0.) uv += vec2(sin(uv.y * 8. + uTime * 1.7), cos(uv.x * 6. + uTime * 1.3)) * .006 * uWob;
    if (uFx7.y > 0.) uv += vec2(sin(uv.y * 14. + uTime * 3.1), cos(uv.x * 11. + uTime * 2.3)) * .005 * uFx7.y;
    float d = texture2D(tDepth, uv).r;
    vec4 wp = uInvVP * vec4(uv * 2. - 1., d * 2. - 1., 1.); wp /= wp.w;
    vec4 pc = uPrevVP * wp; vec2 puv = pc.xy / pc.w * .5 + .5;
    vec2 vel = (uv - puv) * uBlur;
    float vl = length(vel); if (vl > .045) vel *= .045 / vl;
    vec3 c = vec3(0.); float wsum = 0.;
    float j = h(uv * uRes + uTime) - .5;
    for (int i = 0; i < 9; i++) {
      float t = (float(i) + j) / 8. - .5;
      float w = 1. - abs(t) * .8;
      c += texture2D(tScene, uv + vel * t).rgb * w; wsum += w;
    }
    c /= wsum;
    if (any(isnan(c))) c = vec3(0.);
    // 邊緣的色散
    vec2 cc = uv - .5; float edge = dot(cc, cc);
    c.r = mix(c.r, texture2D(tScene, uv - cc * edge * .012).r, .6 * uFx.x);   // uFx：Esc 選單的色散、底片顆粒開關
    c.b = mix(c.b, texture2D(tScene, uv + cc * edge * .012).b, .6 * uFx.x);
    if (uWob > 0.) c = mix(c, texture2D(tScene, uv + vec2(.012, 0.) * uWob).rgb, .35 * uWob);
    if (uFx7.z > 0.) { vec2 o = vec2(.007, .005) * uFx7.z; c = mix(c, (texture2D(tScene, uv + o).rgb + texture2D(tScene, uv - o).rgb + texture2D(tScene, uv + vec2(-o.y, o.x)).rgb + texture2D(tScene, uv + vec2(o.y, -o.x)).rgb) * .25, .75 * min(1., uFx7.z)); }
    // 環境光遮蔽：亮到會泛光的地方（和 mPre 同一個門檻）不壓暗
    if (uAOOn > 0.) { float em = smoothstep(.7 * uAOThr, 1.7 * uAOThr, max(c.r, max(c.g, c.b))); c *= mix(texture2D(tAO, uv).r, 1., em); if (uAOOn > 1.5) {   /* __nc.post.aoDbg：只看遮蔽（除錯，WebGPU 沒有） */ gl_FragColor = vec4(vec3(texture2D(tAO, uv).r), 1.); return; } }
    c += texture2D(tBloom, uv).rgb * uBloomK;
    // 體積光：四分之一解析度的四個點平均，蓋掉每幀抖動的雜訊
    if (uVolOn > 0.) c += (texture2D(tVol, uv + uVolT * vec2(.5, .5)).rgb + texture2D(tVol, uv + uVolT * vec2(-.5, .5)).rgb + texture2D(tVol, uv + uVolT * vec2(.5, -.5)).rgb + texture2D(tVol, uv - uVolT * .5).rgb) * .25;
    c *= uExp * (1. + uFlash * .5);
    if (uEyeOn > 0.) { vec2 e = texture2D(tEye, vec2(.5)).rg; c *= clamp(exp((e.x - e.y) * .5), .55, 1.8); }   // 眼睛適應（mEyeAdapt 存的是 log 亮度）
    // 高光肩部（場館的 ENV.post.knee／range）：最亮的色版超過 knee 後漸近 knee+range，燈泡與反光不會燒成整片白；用最大色版縮放，不偏色
    if (uHi.x > 0.) { float L = max(max(c.r, c.g), c.b); if (L > uHi.x) { float e = L - uHi.x; c *= (uHi.x + e / (1. + e / uHi.y)) / L; } }
    c = aces(c);
    // 調色：暗部偏青、亮部偏暖
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(c, c * vec3(.86, 1.02, 1.08), (1. - l) * .35);
    c = mix(c, c * vec3(1.06, 1., .9), l * .25);
    c *= 1. - edge * .9;
    if (uTint.w > 0.) c = mix(c, vec3(dot(c, vec3(.2126, .7152, .0722))) * uTint.rgb + c * .25, uTint.w);
    // 熱成像：深藍紫的冷背景，人與引擎發橘白光（熱源不看深度：穿過牆、煙與樹葉）
    if (uFx7.x > 0.) {
      float lt = dot(c, vec3(.2126, .7152, .0722)), ht = 0.;
      vec3 th = mix(vec3(.04, .02, .14), vec3(.3, .14, .46), smoothstep(0., .9, lt));
      for (int i = 0; i < ${HEAT_N}; i++) { vec4 q = uHeat[i]; if (q.w <= 0.) continue; vec2 dd = (uv - q.xy) * vec2(uRes.x / uRes.y, 1.); dd.y *= .55; ht = max(ht, (1. - smoothstep(q.z * .35, q.z, length(dd))) * q.w); }
      th = mix(th, mix(vec3(1., .3, .08), vec3(1., .96, .82), smoothstep(.55, 1., ht)) * 1.3, smoothstep(.0, .4, ht));
      c = mix(c, th, uFx7.x);
    }
    // 神經毒氣：發綠；夜視鏡：綠色單色、放大亮度、加雜訊
    if (uFx7.y > 0.) c = mix(c, c * vec3(.5, 1.2, .45) + vec3(.03, .09, 0.), .8 * uFx7.y);
    if (uFx7.w > 0.) { float ln = dot(c, vec3(.2126, .7152, .0722)); vec3 nv = vec3(.3, 1., .4) * pow(clamp(ln * 4., 0., 1.), .7) + (h(uv * uRes + fract(uTime * 5.)) - .5) * .14; c = mix(c, nv, uFx7.w); }
    if (uGray + uVig + uHurt > 0.) {
      float r = length(cc * vec2(uRes.x / uRes.y, 1.)) * 1.25;
      c = mix(c, vec3(dot(c, vec3(.2126, .7152, .0722))) * vec3(1.02, 1., .97), uGray);
      c *= 1. - uVig * smoothstep(.25, 1.05, r) * .92;
      c = mix(c, vec3(.42, .02, .03), uHurt * smoothstep(.45, 1.15, r) * .85);
    }
    c = pow(c, vec3(1. / 2.2));
    c += (h(uv * uRes + fract(uTime * 7.)) - .5) * .035 * uFx.y;
    gl_FragColor = vec4(c, 1.);
  }`, { tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null }, tVol: { value: null }, tAO: { value: null }, tEye: { value: null }, uVolOn: { value: 0 }, uAOOn: { value: 0 }, uAOThr: { value: 1 }, uEyeOn: { value: 0 }, uVolT: { value: new T.Vector2() }, uInvVP: { value: new T.Matrix4() }, uPrevVP: { value: new T.Matrix4() },
  uBlur: { value: .5 }, uExp: { value: 1.2 }, uTime: { value: 0 }, uWob: { value: 0 }, uFlash: { value: 0 }, uBloomK: { value: .9 }, uGray: { value: 0 }, uVig: { value: 0 }, uHurt: { value: 0 }, uTint: { value: new T.Vector4() }, uFx7: { value: new T.Vector4() }, uHeat: { value: Array.from({ length: HEAT_N }, () => new T.Vector4()) }, uRes: { value: new T.Vector2() }, uFx: { value: new T.Vector2(1, 1) }, uHi: { value: new T.Vector2() } });
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
// 城外空地、海面上朝山看時看得到，照畫（拿掉的話雨夜、黃昏、陰天的積水與海面少一道稜線）。WebGL 自己包 GL query，WebGPU 用 three 的 occlusionTest
const reflOcc = { en: true, occ: 0, hold: 0, skip: false, q: [], n: 0 };
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
  if (R.isWebGPURenderer) { m.occlusionTest = true; m.onBeforeRender = r => reflOccSet(!r.isOccluded(m)); }   // 讀到的是前幾幀解出來的結果
  else {
    const gl = R.getContext(), Q = gl.ANY_SAMPLES_PASSED_CONSERVATIVE;
    m.onBeforeRender = () => { m.userData.q = null; if (reflOcc.q.length > 3) return; const q = gl.createQuery(); gl.beginQuery(Q, q); m.userData.q = q; };
    m.onAfterRender = () => { const q = m.userData.q; if (q) { gl.endQuery(Q); reflOcc.q.push(q); } };
  }
  scene.add(m);
  return m;
})();
// 每幀在倒影之前：收 WebGL 的查詢結果、決定 forestLo 進不進倒影。切鏡頭（camState.snap）後先照畫，之前送出的查詢結果丟掉 4 幀
function reflOccPoll() {
  if (!reflOccMesh) return;
  if (reflOcc.hold > 0) reflOcc.hold--;
  if (camState.snap) { reflOcc.hold = 4; reflOcc.occ = 0; }
  if (!R.isWebGPURenderer) {
    const gl = R.getContext();
    while (reflOcc.q.length && gl.getQueryParameter(reflOcc.q[0], gl.QUERY_RESULT_AVAILABLE)) { const q = reflOcc.q.shift(); reflOccSet(!!gl.getQueryParameter(q, gl.QUERY_RESULT)); gl.deleteQuery(q); }
  }
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
  fogCullAt(_rp); R.render(scene, reflCam); fogCull.on = false;
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
{
  const P = T.Object3D.prototype, um = P.updateMatrix;
  // 「上次」記在 updateMatrix 裡：lookAt 與 getWorldDirection 會經 updateWorldMatrix 直接 compose（lookAt 用的是改轉向前的那組），
  // 只在這裡記的話，相機一幀內被設兩次（camState.over、地鐵的固定鏡頭）又回到上一幀的值時會跳過，矩陣停在中途那組
  P.updateMatrix = function () {
    um.call(this);
    const p = this.position, q = this.quaternion, s = this.scale, c = this._trs || (this._trs = new Float64Array(10));
    c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q._x; c[4] = q._y; c[5] = q._z; c[6] = q._w; c[7] = s.x; c[8] = s.y; c[9] = s.z;
  };
  P.updateMatrixWorld = function (force) {
    if (this.matrixAutoUpdate) {
      const p = this.position, q = this.quaternion, s = this.scale, c = this._trs;
      if (!c || c[0] !== p.x || c[1] !== p.y || c[2] !== p.z || c[3] !== q._x || c[4] !== q._y || c[5] !== q._z || c[6] !== q._w || c[7] !== s.x || c[8] !== s.y || c[9] !== s.z || this._trsP !== this.parent || this.pivot !== null) {
        this._trsP = this.parent;
        this.updateMatrix();
      }
    } else {   // 手動寫的 matrix：16 個數字比上次（比相乘便宜）
      const e = this.matrix.elements, c = this._mtx || (this._mtx = new Float64Array(16).fill(NaN));
      let k = 0; while (k < 16 && c[k] === e[k]) k++;
      if (k < 16 || this._trsP !== this.parent) { c.set(e); this._trsP = this.parent; this.matrixWorldNeedsUpdate = true; }
    }
    if (this.matrixWorldNeedsUpdate || force) {
      if (this.matrixWorldAutoUpdate === true) { if (this.parent === null) this.matrixWorld.copy(this.matrix); else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix); }
      this.matrixWorldNeedsUpdate = false; force = true;
    }
    const ch = this.children; for (let i = 0, l = ch.length; i < l; i++) ch[i].updateMatrixWorld(force);
  };
}
// 全進霧裡的不畫：00-core.js 的 applyFog 在鏡頭低於 20 m 時 D ≥ .5，視線距離 × uFogDen × .5 超過 6 就剩不到 0.25%（夜裡的指數霧與白天的平方指數霧都是），
// 包圍球整顆在那之外的物件在視錐測試就剔掉（海上 1～3 km 的船與乘客、對岸的小東西，每幀一百多個 draw call）。
// 只對整段霧都算的材質：GLSL 有呼叫 applyFog、沒有 FAR（遠景只算一部分距離的霧，剪影要看得到）；鏡頭在高處時霧變淡，不剔
const fogCull = { en: true, on: false, x: 0, y: 0, z: 0, d: 0, empty: true }, fogMat = new WeakMap(), _fcS = new T.Sphere();
const fogFull = m => {
  if (Array.isArray(m)) return m.every(fogFull);
  let v = fogMat.get(m);
  if (v === undefined) { v = !!(m.isShaderMaterial && m.fragmentShader.replace(GL_LIB, '').includes('applyFog(') && !(m.defines && 'FAR' in m.defines)); fogMat.set(m, v); }
  return v;
};
function fogCullAt(p) { fogCull.on = fogCull.en && camera.position.y < 20; fogCull.x = p.x; fogCull.y = p.y; fogCull.z = p.z; fogCull.d = 12 / Math.max(U.uFogDen.value, 1e-4); }
// 沒東西可畫的也在這裡剔掉：three 不跳過 count 0 的 InstancedMesh 與沒有頂點的幾何（照樣切程式、更新 uniform、送一次空的 draw），
// 串流實例（20-props.js 的 instUpdate）的球跟著相機、永遠在視錐裡，附近沒有實例時每幀白送（光環廣場 980 個 draw 裡 460 個）
T.Frustum.prototype.intersectsObject = function (o) {
  if (fogCull.empty) {   // 99-main.js 開場 compileAsync 時關掉
    if (o.isInstancedMesh && o.count === 0) return false;
    const g = o.geometry; if (g && (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 1) === 0) return false;
  }
  const s = _fcS;
  if (o.boundingSphere !== undefined) { if (o.boundingSphere === null) o.computeBoundingSphere(); s.copy(o.boundingSphere).applyMatrix4(o.matrixWorld); }
  else { const g = o.geometry; if (g.boundingSphere === null) g.computeBoundingSphere(); s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); }
  if (fogCull.on) { const c = s.center, dx = c.x - fogCull.x, dy = c.y - fogCull.y, dz = c.z - fogCull.z, L = fogCull.d + s.radius; if (dx * dx + dy * dy + dz * dz > L * L && fogFull(o.material)) return false; }
  return this.intersectsSphere(s);
};
let reflOdd = 0;
function renderFrame(dt, t) {
  perfHook.a?.();
  R.info.reset();
  // 整個場景的矩陣一幀只算一次：倒影與主畫面兩趟 R.render 原本各算一次（場景有三千多個物件）
  curScene.matrixWorldAutoUpdate = false; curScene.updateMatrixWorld();
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
  R.render(curScene, camera); fogCull.on = false;
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
  post.ft = lerp(post.ft, ms, .05); post.vs = Math.min(post.vs + .01, Math.max(ms, 4)); post.cool = Math.max(0, post.cool - rd);
  const tgt = Math.max(post.vs, SET.fps ? 1000 / SET.fps : 0);
  if (post.ft > Math.max(19, tgt * 1.15)) { post.slow += rd; post.fast = 0; } else if (post.ft < Math.max(13, tgt * 1.04)) { post.fast += rd; post.slow = 0; } else { post.slow = post.fast = 0; }
  if (SET.res !== 'auto' || post.cool > 0) post.fast = 0;
  if (SET.res !== 'auto') post.slow = 0;   // 固定解析度比例時不自動調整
  // 太慢時的順序：CPU 送不完（整幀 CPU 超過目標的八成）先讓戶外的倒影隔幀畫，再縮短細節距離；顯示卡畫不完先降內部解析度（到 60%），
  // 都到底了才動另一邊。變快時倒著放回來：距離 → 倒影（CPU 留得出倒影那一趟的餘裕才放）→ 解析度（可以超過 100%，到 resMax 為止）
  frameClk.cpu = lerp(frameClk.cpu, performance.now() - frameClk.t0, .05);
  const cpuB = frameClk.cpu > tgt * .8, reflOn = outdoors && SET.refl;
  if (post.slow > 1.2) {
    const s0 = post.scale;
    if (reflOn && !post.reflHalf && (cpuB || post.scale <= .6)) post.reflHalf = true;
    else if (post.scale > .6 && (!cpuB || detail.k <= .6)) { post.scale = Math.max(.6, post.scale - .1); makeTargets(); }
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
