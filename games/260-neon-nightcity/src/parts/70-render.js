
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
let rtScene, rtRefl, rtB = [], rtU = [], rtV = null;
function makeTargets() {
  const w = Math.max(2, Math.floor(innerWidth * DPR * post.scale)), h = Math.max(2, Math.floor(innerHeight * DPR * post.scale));
  rtScene?.dispose(); rtRefl?.dispose(); rtB.forEach(r => r.dispose()); rtU.forEach(r => r.dispose()); rtV?.dispose();
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
const mComp = pass('comp', `uniform sampler2D tScene, tDepth, tBloom, tVol; uniform float uVolOn; uniform vec2 uVolT; uniform mat4 uInvVP, uPrevVP; uniform float uBlur, uExp, uTime, uWob, uFlash, uBloomK, uGray, uVig, uHurt; uniform vec4 uTint, uFx7; uniform vec2 uRes, uFx, uHi;
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
    c += texture2D(tBloom, uv).rgb * uBloomK;
    // 體積光：四分之一解析度的四個點平均，蓋掉每幀抖動的雜訊
    if (uVolOn > 0.) c += (texture2D(tVol, uv + uVolT * vec2(.5, .5)).rgb + texture2D(tVol, uv + uVolT * vec2(-.5, .5)).rgb + texture2D(tVol, uv + uVolT * vec2(.5, -.5)).rgb + texture2D(tVol, uv - uVolT * .5).rgb) * .25;
    c *= uExp * (1. + uFlash * .5);
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
  }`, { tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null }, tVol: { value: null }, uVolOn: { value: 0 }, uVolT: { value: new T.Vector2() }, uInvVP: { value: new T.Matrix4() }, uPrevVP: { value: new T.Matrix4() },
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
function renderReflection() {
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
  const P = T.Object3D.prototype;
  P.updateMatrixWorld = function (force) {
    if (this.matrixAutoUpdate) {
      const p = this.position, q = this.quaternion, s = this.scale, c = this._trs || (this._trs = new Float64Array(10).fill(NaN));
      if (c[0] !== p.x || c[1] !== p.y || c[2] !== p.z || c[3] !== q._x || c[4] !== q._y || c[5] !== q._z || c[6] !== q._w || c[7] !== s.x || c[8] !== s.y || c[9] !== s.z || this._trsP !== this.parent || this.pivot !== null) {
        c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q._x; c[4] = q._y; c[5] = q._z; c[6] = q._w; c[7] = s.x; c[8] = s.y; c[9] = s.z; this._trsP = this.parent;
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
const fogCull = { en: true, on: false, x: 0, y: 0, z: 0, d: 0 }, fogMat = new WeakMap(), _fcS = new T.Sphere();
const fogFull = m => {
  if (Array.isArray(m)) return m.every(fogFull);
  let v = fogMat.get(m);
  if (v === undefined) { v = !!(m.isShaderMaterial && m.fragmentShader.replace(GL_LIB, '').includes('applyFog(') && !(m.defines && 'FAR' in m.defines)); fogMat.set(m, v); }
  return v;
};
function fogCullAt(p) { fogCull.on = fogCull.en && camera.position.y < 20; fogCull.x = p.x; fogCull.y = p.y; fogCull.z = p.z; fogCull.d = 12 / Math.max(U.uFogDen.value, 1e-4); }
T.Frustum.prototype.intersectsObject = function (o) {
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
  if (firstFrame || camState.snap) { prevVP.copy(curVP); firstFrame = false; camState.snap = false; }
  const u = mComp.uniforms;
  const volK = mVol && outdoors ? SET.vol * atm.sunK * sstep(.2, .6, U.uDay.value) : 0;
  u.uVolOn.value = volK > .01 ? 1 : 0;
  if (u.uVolOn.value) {
    const v = mVol.uniforms; v.tDepth.value = rtScene.depthTexture; v.uInvVP.value.copy(curVP).invert(); v.uVolK.value = .0035 * volK;
    blit(mVol, rtV); u.tVol.value = rtV.texture; u.uVolT.value.set(1 / rtV.width, 1 / rtV.height);
  }
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
