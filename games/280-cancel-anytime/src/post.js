// 後製管線（不用 three 的 addons，單檔自帶）：
//   場景 → HDR 半浮點緩衝（MSAA、含深度）→ 1/2 降採樣 → bloom（只吃超過門檻的發光體，逐級降採樣再疊回）
//   → 景深用的 1/2 模糊 → 合成（景深、bloom、色調映射、飽和／對比、暗角、抖色）→ 畫面。
// 畫質檔：high（全開）、med（bloom＋色調映射，不做景深，MSAA 2×）、low（不經後製，直接畫到畫面）。
// 色調映射只壓 0.8 以上的亮部，原本的卡通配色不變。
/* global THREE */

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const DOWN = `uniform sampler2D tMap; uniform vec2 uPx; uniform float uThr; varying vec2 vUv;
void main(){
  vec3 c = (texture2D(tMap, vUv + uPx * vec2(-1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., -1.)).rgb
          + texture2D(tMap, vUv + uPx * vec2(-1., 1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., 1.)).rgb) * 0.25;
  if (uThr > 0.0) { float l = max(c.r, max(c.g, c.b)); c *= clamp((l - uThr) / max(l, 1e-4), 0.0, 1.0); c = min(c, vec3(6.0)); }
  gl_FragColor = vec4(c, 1.0);
}`;
const UP = `uniform sampler2D tMap; uniform vec2 uPx; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tMap, vUv).rgb * 4.0;
  c += (texture2D(tMap, vUv + uPx * vec2(-1., 0.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., 0.)).rgb + texture2D(tMap, vUv + uPx * vec2(0., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(0., 1.)).rgb) * 2.0;
  c += texture2D(tMap, vUv + uPx * vec2(-1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., -1.)).rgb + texture2D(tMap, vUv + uPx * vec2(-1., 1.)).rgb + texture2D(tMap, vUv + uPx * vec2(1., 1.)).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}`;
const BLUR = `uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 c = texture2D(tMap, vUv).rgb * 0.227;
  c += (texture2D(tMap, vUv + uDir * 1.385).rgb + texture2D(tMap, vUv - uDir * 1.385).rgb) * 0.316;
  c += (texture2D(tMap, vUv + uDir * 3.231).rgb + texture2D(tMap, vUv - uDir * 3.231).rgb) * 0.0703;
  gl_FragColor = vec4(c, 1.0);
}`;
const COMP = `uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBlur; uniform sampler2D tDepth;
uniform float uBloom; uniform float uDof; uniform float uFocus; uniform float uNear; uniform float uFar;
uniform float uVig; uniform float uSat; uniform float uCon; uniform float uT; uniform vec3 uTint;
varying vec2 vUv;
vec3 tone(vec3 c){
  float peak = max(c.r, max(c.g, c.b));
  if (peak < 0.8) return c;
  float np = 1.0 - 0.04 / (peak - 0.6);
  c *= np / peak;
  return mix(c, vec3(np), 1.0 - 1.0 / (0.15 * (peak - np) + 1.0));
}
void main(){
  vec3 c = texture2D(tScene, vUv).rgb;
  #ifdef DOF
    float z = texture2D(tDepth, vUv).x;
    float d = uNear * uFar / (uFar - z * (uFar - uNear));
    float k = d > uFocus ? (d - uFocus * 1.22 - 1.5) / (uFocus * 0.9 + 5.0) : (uFocus * 0.72 - 1.0 - d) / (uFocus * 0.5 + 2.0) * 0.7;
    k = clamp(k, 0.0, 1.0); k = k * k * (3.0 - 2.0 * k) * uDof;
    c = mix(c, texture2D(tBlur, vUv).rgb, k);
  #endif
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c = tone(max(c, vec3(0.0)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = mix(c, c * c * (3.0 - 2.0 * c), uCon);
  c *= mix(vec3(1.0), uTint, 1.0 - l);
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.86);
  c *= 1.0 - uVig * smoothstep(0.38, 0.95, length(q) * 1.45);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  gl_FragColor.rgb += (fract(sin(dot(gl_FragCoord.xy + uT, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}`;

export function createPost(renderer) {
  const canHDR = renderer.capabilities.isWebGL2 !== false && (renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'));
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  tri.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const quad = new THREE.Mesh(tri, null); quad.frustumCulled = false;
  const pscene = new THREE.Scene(); pscene.add(quad);
  const pcam = new THREE.Camera();
  const mk = (frag, uniforms, o = {}) => new THREE.ShaderMaterial(Object.assign({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }, o));
  const mDown = mk(DOWN, { tMap: { value: null }, uPx: { value: new THREE.Vector2() }, uThr: { value: 0 } });
  const mUp = mk(UP, { tMap: { value: null }, uPx: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });
  const mBlur = mk(BLUR, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });
  const U = {
    tScene: { value: null }, tBloom: { value: null }, tBlur: { value: null }, tDepth: { value: null },
    uBloom: { value: 0.85 }, uDof: { value: 1 }, uFocus: { value: 27 }, uNear: { value: 0.5 }, uFar: { value: 400 },
    uVig: { value: 0.3 }, uSat: { value: 1.06 }, uCon: { value: 0.18 }, uT: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
  };
  const mComp = { dof: mk(COMP, U, { defines: { DOF: 1 } }), plain: mk(COMP, U) };

  const P = { tier: canHDR ? 'high' : 'low', canHDR, U, thr: 1.32, w: 0, h: 0 };
  let sceneRT = null, half = null, halfB = null, mips = [];
  const rt = (w, h, o = {}) => new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), Object.assign({ type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false }, o));
  function free() {
    for (const t of [sceneRT, half, halfB, ...mips]) if (t) { if (t.depthTexture) t.depthTexture.dispose(); t.dispose(); }
    sceneRT = half = halfB = null; mips = [];
  }
  function alloc() {
    free();
    if (P.tier === 'low' || !P.w) return;
    const w = P.w, h = P.h, high = P.tier === 'high';
    const o = { depthBuffer: true, samples: high ? 4 : 2 };
    if (high) { o.depthTexture = new THREE.DepthTexture(w, h); o.depthTexture.type = THREE.UnsignedIntType; }
    sceneRT = rt(w, h, o);
    half = rt(w >> 1, h >> 1);
    if (high) halfB = rt(w >> 1, h >> 1);
    const n = high ? 5 : 4;
    for (let i = 0, mw = w >> 2, mh = h >> 2; i < n && mw > 4 && mh > 4; i++, mw >>= 1, mh >>= 1) mips.push(rt(mw, mh));
  }
  P.setTier = (t) => { if (t !== 'low' && !canHDR) t = 'low'; if (t === P.tier) return; P.tier = t; alloc(); };
  P.resize = () => {
    const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (v.x === P.w && v.y === P.h) return;
    P.w = v.x; P.h = v.y; alloc();
  };
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(pscene, pcam); };

  // o = { focus: 對焦距離, time }
  P.render = (scene, camera, o = {}) => {
    if (P.tier === 'low' || !sceneRT) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera);
    // 1/2 降採樣（景深與 bloom 共用）
    mDown.uniforms.tMap.value = sceneRT.texture; mDown.uniforms.uPx.value.set(0.5 / P.w, 0.5 / P.h); mDown.uniforms.uThr.value = 0;
    pass(mDown, half);
    // bloom：門檻 → 逐級縮小 → 逐級疊回
    let src = half;
    mips.forEach((m, i) => {
      mDown.uniforms.tMap.value = src.texture; mDown.uniforms.uPx.value.set(0.5 / src.width, 0.5 / src.height); mDown.uniforms.uThr.value = i === 0 ? P.thr : 0;
      pass(mDown, m); src = m;
    });
    const ac = renderer.autoClear; renderer.autoClear = false;
    for (let i = mips.length - 1; i > 0; i--) {
      mUp.uniforms.tMap.value = mips[i].texture; mUp.uniforms.uPx.value.set(1 / mips[i].width, 1 / mips[i].height);
      pass(mUp, mips[i - 1]);
    }
    renderer.autoClear = ac;
    const dof = P.tier === 'high' && halfB && U.uDof.value > 0.01;
    if (dof) {
      mBlur.uniforms.tMap.value = half.texture; mBlur.uniforms.uDir.value.set(1.6 / half.width, 0); pass(mBlur, halfB);
      mBlur.uniforms.tMap.value = halfB.texture; mBlur.uniforms.uDir.value.set(0, 1.6 / half.height); pass(mBlur, half);
      U.tBlur.value = half.texture; U.tDepth.value = sceneRT.depthTexture;
      U.uNear.value = camera.near; U.uFar.value = camera.far;
      if (o.focus) U.uFocus.value = o.focus;
    }
    U.tScene.value = sceneRT.texture; U.tBloom.value = mips[0].texture; U.uT.value = (o.time || 0) % 97;
    pass(dof ? mComp.dof : mComp.plain, null);
  };
  return P;
}
