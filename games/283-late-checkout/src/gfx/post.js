// 後製：HDR 場景 → 體積霧（每盞燈的空氣散射用解析解積分）→ 泛光 → ACES 調色、暗角、顆粒。
import * as THREE from 'three';

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const MAXL = 10;

const FOG_FS = `
varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tDepth; uniform mat4 uInvProj; uniform mat4 uCamWorld;
uniform vec3 uLampPos[${MAXL}]; uniform vec3 uLampCol[${MAXL}]; uniform vec3 uFogCol; uniform float uDensity; uniform float uScatter; uniform float uTorch; uniform float uTime; uniform float uMoon; uniform float uRadius;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec4 sc = texture2D(tScene, vUv); float z = texture2D(tDepth, vUv).x;
  vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); v.xyz /= v.w;
  float D = min(length(v.xyz), 70.0); vec3 rd = normalize(mat3(uCamWorld) * v.xyz); vec3 ro = uCamWorld[3].xyz;
  vec3 air = vec3(0.0);
  for (int i = 0; i < ${MAXL}; i++) {
    // 只積分光線穿過燈周圍 R 公尺球內的那一段：光暈留在燈附近，也不會隔著牆把整個畫面染霧
    vec3 q = uLampPos[i] - ro; float t0 = dot(q, rd); float h2 = max(dot(q, q) - t0 * t0, 0.03); float hh = sqrt(h2);
    float s = sqrt(max(uRadius * uRadius - h2, 0.0)); float a = max(0.0, t0 - s); float b = min(D, t0 + s);
    float w = max(0.0, 1.0 - hh / uRadius);
    if (b > a) air += uLampCol[i] * (atan((b - t0) / hh) - atan((a - t0) / hh)) / hh * w * w;
  }
  float drift = 0.75 + 0.5 * n(vUv * vec2(3.0, 2.0) + rd.xz * 2.0 + vec2(uTime * 0.03, uTime * 0.017));
  float ext = exp(-D * uDensity);
  vec3 fogc = uFogCol * (1.0 + (uMoon - 1.0) * 0.35);
  vec3 col = sc.rgb * ext + fogc * (1.0 - ext) + air * uScatter * drift;
  // 手電筒在空氣中的散射：畫面中央的一團光暈
  vec2 c = (vUv - vec2(0.56, 0.44)) * vec2(1.6, 1.0); col += vec3(1.0, 0.93, 0.8) * uTorch * exp(-dot(c, c) * 9.0) * (1.0 - exp(-D * 0.12)) * drift;
  gl_FragColor = vec4(col, 1.0);
}`;
const PRE_FS = `varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uTexel; uniform float uThresh;
void main(){ vec3 c = vec3(0.0); float w = 0.0;
  for (int x = -1; x <= 1; x += 2) for (int y = -1; y <= 1; y += 2) { vec3 s = texture2D(tMap, vUv + vec2(float(x), float(y)) * uTexel).rgb; float k = 1.0 / (1.0 + max(s.r, max(s.g, s.b))); c += s * k; w += k; }
  c /= w; float br = max(c.r, max(c.g, c.b)); float soft = clamp(br - uThresh + 0.5, 0.0, 1.0); soft = soft * soft * 0.5; float k = max(soft, br - uThresh) / max(br, 1e-4);
  gl_FragColor = vec4(c * k, 1.0); }`;
const DOWN_FS = `varying vec2 vUv; uniform sampler2D tMap; uniform vec2 uTexel;
void main(){ vec3 c = texture2D(tMap, vUv).rgb * 4.0; c += texture2D(tMap, vUv + uTexel * vec2(1.0, 1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb; gl_FragColor = vec4(c / 8.0, 1.0); }`;
const UP_FS = `varying vec2 vUv; uniform sampler2D tMap; uniform sampler2D tAdd; uniform vec2 uTexel; uniform float uMix;
void main(){ vec3 c = vec3(0.0); c += texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c += 2.0 * (texture2D(tMap, vUv + uTexel * vec2(1.0, 0.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(-1.0, 0.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.0, 1.0)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.0, -1.0)).rgb);
  c += 4.0 * texture2D(tMap, vUv).rgb; gl_FragColor = vec4(c / 16.0 * uMix + texture2D(tAdd, vUv).rgb, 1.0); }`;
const OUT_FS = `varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uBloom; uniform float uExposure; uniform float uTime; uniform float uDamage; uniform float uLow; uniform float uFade; uniform float uGrain; uniform float uScope; uniform float uAspect; uniform float uDim;
vec3 aces(vec3 x){ x *= 0.6; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 d = vUv - 0.5; float r2 = dot(d, d);
  vec2 ca = d * r2 * 0.012;
  vec3 col = vec3(texture2D(tScene, vUv + ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - ca).b);
  vec3 bl = texture2D(tBloom, vUv).rgb; col += bl * uBloom;
  col *= uExposure;
  // 低血量：去飽和；受擊：紅色暗角
  float l = dot(col, vec3(0.3, 0.55, 0.15)); col = mix(col, vec3(l) * vec3(1.05, 0.95, 0.9), uLow * 0.7);
  col = aces(col);
  // 調色：暗部偏青、亮部偏暖
  float lum = dot(col, vec3(0.3, 0.55, 0.15)); col = mix(col * vec3(0.94, 1.0, 1.06), col * vec3(1.05, 1.0, 0.93), smoothstep(0.08, 0.6, lum));
  col = pow(col, vec3(1.04));
  float vig = smoothstep(0.95, 0.25, sqrt(r2) * 1.25); col *= mix(0.42, 1.0, vig);
  col = mix(col, vec3(0.5, 0.02, 0.0), uDamage * smoothstep(0.12, 0.5, r2) * 0.75);
  // 瞄準鏡遮罩
  if (uScope > 0.0) { vec2 s = d * vec2(uAspect, 1.0); float rr = length(s); float m = smoothstep(0.415, 0.40, rr); col *= mix(1.0, m, uScope); col *= 1.0 - uScope * 0.35 * smoothstep(0.2, 0.41, rr) * m; }
  col += (h(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 91.0) - 0.5) * uGrain;
  col *= uFade * uDim;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer; this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false;
    const sm = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.fog = sm(FOG_FS, { tScene: { value: null }, tDepth: { value: null }, uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uLampPos: { value: Array.from({ length: MAXL }, () => new THREE.Vector3()) }, uLampCol: { value: Array.from({ length: MAXL }, () => new THREE.Vector3()) },
      uFogCol: { value: new THREE.Color(0.016, 0.014, 0.016) }, uDensity: { value: 0.022 }, uScatter: { value: 0.0042 }, uRadius: { value: 3.0 }, uTorch: { value: 0 }, uTime: { value: 0 }, uMoon: { value: 1 } });
    this.pre = sm(PRE_FS, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1.0 } });
    this.down = sm(DOWN_FS, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = sm(UP_FS, { tMap: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } });
    this.out = sm(OUT_FS, { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.55 }, uExposure: { value: 1.32 }, uTime: { value: 0 }, uDamage: { value: 0 }, uLow: { value: 0 }, uFade: { value: 1 }, uGrain: { value: 0.016 }, uScope: { value: 0 }, uAspect: { value: 1 }, uDim: { value: 1 } });
    this.samples = 4; this.bloomOn = true; this.fogOn = true; this.w = 0; this.h = 0;
  }
  setSize(w, h, samples = this.samples) {
    w = Math.max(2, w | 0); h = Math.max(2, h | 0);
    if (w === this.w && h === this.h && samples === this.samples && this.rtScene) return;
    this.w = w; this.h = h; this.samples = samples;
    for (const k of ['rtScene', 'rtFog']) if (this[k]) this[k].dispose();
    if (this.mips) for (const m of this.mips) { m.a.dispose(); m.b.dispose(); }
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.rtScene = new THREE.WebGLRenderTarget(w, h, { ...opt, depthBuffer: true, samples });
    this.rtScene.depthTexture = new THREE.DepthTexture(w, h); this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.rtFog = new THREE.WebGLRenderTarget(w, h, opt);
    this.mips = []; let mw = w >> 1, mh = h >> 1;
    for (let i = 0; i < 5 && mw > 8 && mh > 8; i++) { this.mips.push({ a: new THREE.WebGLRenderTarget(mw, mh, opt), b: new THREE.WebGLRenderTarget(mw, mh, opt), w: mw, h: mh }); mw >>= 1; mh >>= 1; }
    this.out.uniforms.uAspect.value = w / h;
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.quad, this.cam); }
  // draw(renderer)：由呼叫端把場景畫進目前的 render target
  render(camera, draw, time) {
    const r = this.r;
    r.setRenderTarget(this.rtScene); r.setClearColor(0x000000, 1); r.clear();
    draw(r);
    const f = this.fog.uniforms; let src = this.rtScene.texture;
    if (this.fogOn) {
      f.tScene.value = this.rtScene.texture; f.tDepth.value = this.rtScene.depthTexture; f.uInvProj.value.copy(camera.projectionMatrixInverse); f.uCamWorld.value.copy(camera.matrixWorld); f.uTime.value = time;
      this.pass(this.fog, this.rtFog); src = this.rtFog.texture;
    }
    const o = this.out.uniforms;
    if (this.bloomOn && this.mips.length) {
      const M = this.mips;
      this.pre.uniforms.tMap.value = src; this.pre.uniforms.uTexel.value.set(0.5 / M[0].w, 0.5 / M[0].h); this.pass(this.pre, M[0].a);
      for (let i = 1; i < M.length; i++) { this.down.uniforms.tMap.value = M[i - 1].a.texture; this.down.uniforms.uTexel.value.set(1 / M[i - 1].w, 1 / M[i - 1].h); this.pass(this.down, M[i].a); }
      let prev = M[M.length - 1].a;
      for (let i = M.length - 2; i >= 0; i--) { this.up.uniforms.tMap.value = prev.texture; this.up.uniforms.tAdd.value = M[i].a.texture; this.up.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height); this.pass(this.up, M[i].b); prev = M[i].b; }
      o.tBloom.value = prev.texture;
    } else o.tBloom.value = null;
    o.tScene.value = src; o.uTime.value = time;
    this.pass(this.out, null);
  }
}
