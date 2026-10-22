
// ═══ 渲染管線：路面倒影 → 主畫面 → 泛光 → 動態模糊、色調映射、暗角與顆粒 ═══
await bootStep(BOOT.render, '點亮霓虹…');
const camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, .2, 4200);   // 遠平面要到北面的山與對岸（21-coast.js）
camera.layers.enable(LY.NOREFL);
const reflCam = new T.PerspectiveCamera(); reflCam.layers.set(LY.MAIN);
for (const m of groundMeshes) m.layers.set(LY.NOREFL);
const DPR = Math.min(devicePixelRatio || 1, LOW ? 1.25 : 1.5);
R.setPixelRatio(DPR);
// gray／vig／hurt：69-combat.js 的 WASTED／BUSTED 去色與暗角、受傷時畫面邊緣泛紅
const post = { scale: typeof SET.res === 'number' ? SET.res : 1, blur: .5 * SET.blur, exposure: 1.18, wobble: 0, ft: 16, slow: 0, fast: 0, gray: 0, vig: 0, hurt: 0, tint: new T.Vector4(1, 1, 1, 0) };   // tint：特殊能力的調色（rgb 乘在亮度上，w 是強度）
const rtOpts = { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true };
let rtScene, rtRefl, rtB = [], rtU = [];
function makeTargets() {
  const w = Math.max(2, Math.floor(innerWidth * DPR * post.scale)), h = Math.max(2, Math.floor(innerHeight * DPR * post.scale));
  rtScene?.dispose(); rtRefl?.dispose(); rtB.forEach(r => r.dispose()); rtU.forEach(r => r.dispose());
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
addEventListener('resize', resize);

// 全螢幕三角形
const fsCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fsGeo = new T.BufferGeometry();
fsGeo.setAttribute('position', new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
fsGeo.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const fsMesh = new T.Mesh(fsGeo); fsMesh.frustumCulled = false;
const fsScene = new T.Scene(); fsScene.add(fsMesh);
const FS_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const pass = (fs, uniforms) => new T.ShaderMaterial({ vertexShader: FS_VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
const mPre = pass(`uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThr; varying vec2 vUv;
  // MSAA 邊緣外插偶爾讓某個 shader 算出 NaN／inf，在這裡擋掉，免得被 bloom 擴散成白斑
  vec3 tap(vec2 o){ vec3 c = texture2D(tSrc, vUv + uTexel * o).rgb; return any(isnan(c)) ? vec3(0.) : min(c, vec3(60.)); }
  void main(){
    vec3 c = tap(vec2(-1., -1.)) + tap(vec2(1., -1.)) + tap(vec2(-1., 1.)) + tap(vec2(1., 1.));
    c *= .25;
    float br = max(c.r, max(c.g, c.b));
    float w = smoothstep(.7 * uThr, 1.7 * uThr, br);   // 白天門檻拉高（28-sky.js 的 atm.bloom），不然日照的牆整面發光
    gl_FragColor = vec4(min(c * w, vec3(30.)), 1.);
  }`, { tSrc: { value: null }, uTexel: { value: new T.Vector2() }, uThr: { value: 1 } });
const mDown = pass(`uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
  void main(){
    vec2 t = uTexel;
    vec3 a = texture2D(tSrc, vUv + t * vec2(-2., -2.)).rgb, b = texture2D(tSrc, vUv + t * vec2(0., -2.)).rgb, c = texture2D(tSrc, vUv + t * vec2(2., -2.)).rgb;
    vec3 d = texture2D(tSrc, vUv + t * vec2(-2., 0.)).rgb, e = texture2D(tSrc, vUv).rgb, f = texture2D(tSrc, vUv + t * vec2(2., 0.)).rgb;
    vec3 g = texture2D(tSrc, vUv + t * vec2(-2., 2.)).rgb, h = texture2D(tSrc, vUv + t * vec2(0., 2.)).rgb, i = texture2D(tSrc, vUv + t * vec2(2., 2.)).rgb;
    vec3 j = texture2D(tSrc, vUv + t * vec2(-1., -1.)).rgb, k = texture2D(tSrc, vUv + t * vec2(1., -1.)).rgb, l = texture2D(tSrc, vUv + t * vec2(-1., 1.)).rgb, m = texture2D(tSrc, vUv + t * vec2(1., 1.)).rgb;
    vec3 o = e * .125 + (a + c + g + i) * .03125 + (b + d + f + h) * .0625 + (j + k + l + m) * .125;
    gl_FragColor = vec4(o, 1.);
  }`, { tSrc: { value: null }, uTexel: { value: new T.Vector2() } });
const mUp = pass(`uniform sampler2D tSrc, tAdd; uniform vec2 uTexel; uniform float uK; varying vec2 vUv;
  void main(){
    vec2 t = uTexel;
    vec3 s = texture2D(tSrc, vUv).rgb * 4.;
    s += (texture2D(tSrc, vUv + vec2(t.x, 0.)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0.)).rgb + texture2D(tSrc, vUv + vec2(0., t.y)).rgb + texture2D(tSrc, vUv - vec2(0., t.y)).rgb) * 2.;
    s += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb;
    gl_FragColor = vec4(texture2D(tAdd, vUv).rgb + s / 16. * uK, 1.);
  }`, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new T.Vector2() }, uK: { value: 1 } });
const mComp = pass(`uniform sampler2D tScene, tDepth, tBloom; uniform mat4 uInvVP, uPrevVP; uniform float uBlur, uExp, uTime, uWob, uFlash, uBloomK, uGray, uVig, uHurt; uniform vec4 uTint; uniform vec2 uRes, uFx;
  varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main(){
    vec2 uv = vUv;
    if (uWob > 0.) uv += vec2(sin(uv.y * 8. + uTime * 1.7), cos(uv.x * 6. + uTime * 1.3)) * .006 * uWob;
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
    c += texture2D(tBloom, uv).rgb * uBloomK;
    c *= uExp * (1. + uFlash * .5);
    c = aces(c);
    // 調色：暗部偏青、亮部偏暖
    float l = dot(c, vec3(.2126, .7152, .0722));
    c = mix(c, c * vec3(.86, 1.02, 1.08), (1. - l) * .35);
    c = mix(c, c * vec3(1.06, 1., .9), l * .25);
    c *= 1. - edge * .9;
    if (uTint.w > 0.) c = mix(c, vec3(dot(c, vec3(.2126, .7152, .0722))) * uTint.rgb + c * .25, uTint.w);
    if (uGray + uVig + uHurt > 0.) {
      float r = length(cc * vec2(uRes.x / uRes.y, 1.)) * 1.25;
      c = mix(c, vec3(dot(c, vec3(.2126, .7152, .0722))) * vec3(1.02, 1., .97), uGray);
      c *= 1. - uVig * smoothstep(.25, 1.05, r) * .92;
      c = mix(c, vec3(.42, .02, .03), uHurt * smoothstep(.45, 1.15, r) * .85);
    }
    c = pow(c, vec3(1. / 2.2));
    c += (h(uv * uRes + fract(uTime * 7.)) - .5) * .035 * uFx.y;
    gl_FragColor = vec4(c, 1.);
  }`, { tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null }, uInvVP: { value: new T.Matrix4() }, uPrevVP: { value: new T.Matrix4() },
  uBlur: { value: .5 }, uExp: { value: 1.2 }, uTime: { value: 0 }, uWob: { value: 0 }, uFlash: { value: 0 }, uBloomK: { value: .9 }, uGray: { value: 0 }, uVig: { value: 0 }, uHurt: { value: 0 }, uTint: { value: new T.Vector4() }, uRes: { value: new T.Vector2() }, uFx: { value: new T.Vector2(1, 1) } });
function blit(mat, target) { fsMesh.material = mat; R.setRenderTarget(target); R.render(fsScene, fsCam); }

const prevVP = new T.Matrix4(), curVP = new T.Matrix4();
let firstFrame = true;
const _rp = V3(), _rt = V3(), _ru = V3(), _fw = V3();
const reflBias = new T.Matrix4().set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
function renderReflection() {
  // 虛擬相機：位置、注視點與上方向都對 y=0 平面鏡射
  camera.getWorldDirection(_fw);
  _rp.copy(camera.position); _rp.y = -_rp.y;
  _rt.copy(camera.position).add(_fw); _rt.y = -_rt.y;
  _ru.set(0, 1, 0).applyQuaternion(camera.quaternion); _ru.y = -_ru.y;
  reflCam.position.copy(_rp); reflCam.up.copy(_ru); reflCam.lookAt(_rt);
  reflCam.projectionMatrix.copy(camera.projectionMatrix); reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  reflCam.updateMatrixWorld();
  reflU.uReflMat.value.multiplyMatrices(reflBias, reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
  U.uClipY.value = 0; U.uCam.value.copy(_rp); const fw = U.uFocus.value.w; U.uFocus.value.w = 0;
  R.setRenderTarget(rtRefl); R.setClearColor(0x000000, 1); R.clear();
  R.render(scene, reflCam);
  U.uClipY.value = -1e9; U.uCam.value.copy(camera.position); U.uFocus.value.w = fw;
}
R.info.autoReset = false;   // 一幀有很多次 render，統計要整幀累計
function renderFrame(dt, t) {
  R.info.reset();
  camera.updateMatrixWorld();
  sky.position.copy(camera.position); sky.updateMatrixWorld();   // 天空球跟著相機（城市東西兩端離原點超過半徑）
  U.uCam.value.copy(camera.position);
  { const zc = zoneAtW(camera.position.x, camera.position.z); if (zc) U.uZone.value.set(zc.ox, zc.oz, zc.c, zc.s); }
  const outdoors = curScene === scene;
  reflU.uReflOn.value = outdoors && SET.refl ? 1 : 0;
  if (outdoors && SET.refl) renderReflection();
  R.setRenderTarget(rtScene); R.setClearColor(0x000000, 1); R.clear();
  R.render(curScene, camera);
  // 泛光
  const w = rtScene.width, h = rtScene.height;
  mPre.uniforms.tSrc.value = rtScene.texture; mPre.uniforms.uTexel.value.set(1 / w, 1 / h); mPre.uniforms.uThr.value = outdoors ? atm.bloom : 1; blit(mPre, rtB[0]);
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
  u.tScene.value = rtScene.texture; u.tDepth.value = rtScene.depthTexture; u.tBloom.value = rtU[0].texture;
  u.uInvVP.value.copy(curVP).invert(); u.uPrevVP.value.copy(prevVP);
  u.uBlur.value = post.blur; u.uExp.value = post.exposure * SET.bright * (outdoors ? atm.exp : 1); u.uTime.value = t; u.uWob.value = post.wobble; u.uFlash.value = U.uFlash.value;
  u.uBloomK.value = (outdoors ? .85 : 1.0) * SET.bloom;
  u.uFx.value.set(SET.ca ? 1 : 0, SET.grain ? 1 : 0);
  u.uGray.value = post.gray; u.uVig.value = post.vig; u.uHurt.value = post.hurt; u.uTint.value.copy(post.tint);
  u.uRes.value.set(w, h);
  blit(mComp, null);
  prevVP.copy(curVP);
  // 依幀時調整內部解析度
  // 子彈時間時 dt 是放慢後的遊戲時間，幀時要用真實時間量
  post.ft = lerp(post.ft, slowmo.raw * 1000, .05);
  if (post.ft > 19) { post.slow += dt; post.fast = 0; } else if (post.ft < 13) { post.fast += dt; post.slow = 0; } else { post.slow = post.fast = 0; }
  if (SET.res !== 'auto') post.slow = post.fast = 0;   // 固定解析度比例時不自動調整
  if (post.slow > 1.2 && post.scale > .6) { post.scale = Math.max(.6, post.scale - .1); post.slow = 0; makeTargets(); }
  else if (post.slow > 1.2 && detail.k > .6) { detail.k = Math.max(.6, detail.k - .1); detail.v++; post.slow = 0; }   // 解析度降到底還是慢：縮短建築與街道設施的細節距離（01-settings.js）
  if (post.fast > 4 && detail.k < 1) { detail.k = Math.min(1, detail.k + .05); detail.v++; post.fast = 0; }   // 變快了先把距離放回來，再升解析度
  else if (post.fast > 4 && post.scale < 1) { post.scale = Math.min(1, post.scale + .05); post.fast = 0; makeTargets(); }
  if (post.wobble > 0) post.wobble = Math.max(0, post.wobble - dt * .08);
}
