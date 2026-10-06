// 渲染：renderer、燈光、天空、霧、陰影、後製（bloom + 色彩分級）、畫質級距、風暴色調、閃電。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { QUALITY, QUALITY_ORDER } from './config.js';
import { damp } from './shared.js';
import { TIME } from './geo.js';
import { SUN_DIR, SKY, makeSky, makeClouds } from './world-sky.js';

// 畫質額外參數（config.QUALITY 不是本軌道擁有，這裡補充）
// post: 0 = 不用後製（直接輸出）、1 = 分級＋bloom（半解析度）、2 = 分級＋bloom 全解析度＋MSAA
const TIER = {
  low: { post: 0, bloom: 0, msaa: 0, grass: 0, flowers: 0, far: 2000, clouds: true, shadowDist: 1 },
  medium: { post: 1, bloom: 0.5, msaa: 2, grass: 0.45, flowers: 0.5, far: 2100, clouds: true, shadowDist: 1 },
  high: { post: 2, bloom: 1, msaa: 4, grass: 1, flowers: 1, far: 2100, clouds: true, shadowDist: 1 },
  epic: { post: 2, bloom: 1, msaa: 4, grass: 1.6, flowers: 1.6, far: 2100, clouds: true, shadowDist: 1 },
};
const SUN_WARM = new THREE.Color('#ffe9c4'), SUN_STORM = new THREE.Color('#b9a0ff');
const HEMI_SKY = new THREE.Color('#9fd2ff'), HEMI_GND = new THREE.Color('#78cf55'), HEMI_SKY_S = new THREE.Color('#7a5fd0'), HEMI_GND_S = new THREE.Color('#4a3a88');

// 色彩分級：飽和度、對比、暗角、風暴紫、閃電
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.12 }, uContrast: { value: 1.08 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color(1, 1, 1) }, uVig: { value: 0.22 }, uWarm: { value: new THREE.Vector3(1.03, 1.0, 0.95) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat,uContrast,uStorm,uFlash,uVig; uniform vec3 uFlashCol,uWarm; varying vec2 vUv;
void main(){
  vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(l), c, uSat + uStorm*0.05);
  c = pow(max(c/0.18, 0.0), vec3(uContrast)) * 0.18;
  c *= uWarm;
  vec3 pur = vec3(0.62,0.38,1.0);
  c = mix(c, c*pur*1.25 + pur*0.02, uStorm*0.45);
  vec2 q = vUv - 0.5; float v = smoothstep(0.35, 0.95, length(q*vec2(1.0,0.9)));
  c *= 1.0 - v * (uVig + uStorm*0.25);
  c += uFlashCol * uFlash;
  gl_FragColor = vec4(c, t.a);
}`,
};

export class Render {
  constructor(ctx) {
    this.ctx = ctx;
    const host = document.getElementById('game') || document.body;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap; // r0.180 起 PCFShadowMap 即柔邊；PCFSoftShadowMap 已移除，用了只會印警告再退回 PCF
    r.info.autoReset = false; // 後製會多次呼叫 render，手動歸零才能得到整幀的 draw call 數
    host.appendChild(r.domElement);
    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.FogExp2(SKY.fog.getHex(), 0.0009);
    const cam = (this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 2200));
    cam.position.set(0, 60, 200);
    scene.add(cam);

    // 燈光：暖白低角度太陽 + 天藍/草綠半球光
    this.hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GND, 1.45);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(SUN_WARM, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 2.2;
    scene.add(this.sun, this.sun.target);
    this.sunDir = SUN_DIR;

    const sky = makeSky(); this.sky = sky.mesh; this.skyMat = sky.mat; scene.add(this.sky);
    this.clouds = makeClouds(scene);

    ctx.renderer = r; ctx.scene = scene; ctx.camera = cam;
    this.stormTint = 0; this._k = 0; this._flash = 0; this._flashCol = new THREE.Color(1, 1, 1);
    this.slow = 0; this.cool = 0; this.avgFps = 60;
    this.composer = null;
    this._onResize = () => this.resize();
    addEventListener('resize', this._onResize);
    this.setQuality(ctx.quality || 'high');
    this.resize();
  }
  // 閃電／爆炸白光：colorHex、strength 0..1
  flash(colorHex = 0xffffff, strength = 0.5) { this._flashCol.set(colorHex); this._flash = Math.max(this._flash, strength); }
  setQuality(q) {
    if (!QUALITY[q]) return;
    const Q = (this.Q = { ...QUALITY[q], ...TIER[q] });
    this.ctx.quality = q;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pr));
    this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    const s = Q.range, c = this.sun.shadow.camera;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 1; c.far = 420; c.updateProjectionMatrix();
    this.scene.fog.density = Q.fog;
    this.camera.far = Q.far; this.camera.updateProjectionMatrix();
    this.clouds.group.visible = Q.clouds;
    this._buildPost();
    this.resize();
    this.ctx.events?.emit('quality', { quality: q });
  }
  _buildPost() {
    const Q = this.Q;
    // EffectComposer.dispose() 只釋放自己的兩張 render target，各個 pass（bloom 的 mip target 與材質）要自己 dispose
    if (this.composer) { for (const p of this.composer.passes) p.dispose?.(); this.composer.dispose?.(); this.composer = null; this.bloom = null; }
    if (!Q.post) return;
    const pr = this.renderer.getPixelRatio(), w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: Q.msaa });
    const comp = (this.composer = new EffectComposer(this.renderer, rt));
    comp.setPixelRatio(pr); comp.setSize(w, h);
    comp.addPass(new RenderPass(this.scene, this.camera));
    // bloom 只讓 HDR 亮度 > 閾值的東西（太陽盤、發光窗、風暴邊緣、傳說光柱、閃電）發光
    const bs = Q.bloom >= 1 ? 1 : 0.5;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w * bs, h * bs), 0.5, 0.55, 1.35);
    comp.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    comp.addPass(this.grade);
    comp.addPass(new OutputPass());
  }
  resize() {
    const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h);
      if (this.bloom) { const bs = this.Q.bloom >= 1 ? 1 : 0.5; this.bloom.setSize(w * bs, h * bs); }
    }
  }
  update(dt) {
    const c = this.ctx, p = this.camera.position, Q = this.Q;
    TIME.value = performance.now() / 1000;
    // 風暴色調平滑
    this._k = damp(this._k, Math.min(1, Math.max(0, this.stormTint || 0)), 4, dt);
    const k = this._k;
    this._flash *= Math.exp(-9 * dt); if (this._flash < 0.002) this._flash = 0;
    // 天空與霧
    const u = this.skyMat.uniforms;
    u.uTop.value.copy(SKY.top).lerp(SKY.sTop, k); u.uMid.value.copy(SKY.mid).lerp(SKY.sMid, k); u.uHor.value.copy(SKY.hor).lerp(SKY.sHor, k); u.uK.value = k;
    this.scene.fog.color.copy(SKY.fog).lerp(SKY.sFog, k);
    this.scene.fog.density = Q.fog * (1 + k * 0.6);
    this.hemi.color.copy(HEMI_SKY).lerp(HEMI_SKY_S, k); this.hemi.groundColor.copy(HEMI_GND).lerp(HEMI_GND_S, k);
    this.hemi.intensity = 1.45 * (1 - k * 0.2) + this._flash * 2.5;
    this.sun.color.copy(SUN_WARM).lerp(SUN_STORM, k); this.sun.intensity = 2.7 * (1 - k * 0.35);
    if (this.grade) {
      const g = this.grade.uniforms; g.uStorm.value = k; g.uFlash.value = this._flash * 0.55; g.uFlashCol.value.copy(this._flashCol);
    }
    // 天空球與雲跟隨鏡頭
    this.sky.position.copy(p);
    if (Q.clouds) { this.clouds.group.position.set(p.x, 0, p.z); this.clouds.group.rotation.y += dt * 0.004; this.clouds.group.updateMatrixWorld(true); }
    // 陰影相機跟隨玩家（對齊 texel 避免閃爍）
    const f = c.player && c.match && c.match.state !== 'menu' ? c.player.pos : p;
    const q = Q.range * 2 / Q.shadow;
    const tx = Math.round(f.x / q) * q, ty = Math.round(f.y / q) * q, tz = Math.round(f.z / q) * q;
    this.sun.target.position.set(tx, ty, tz);
    this.sun.position.set(tx + SUN_DIR.x * 160, ty + SUN_DIR.y * 160, tz + SUN_DIR.z * 160);
    this.sun.target.updateMatrixWorld();
    // 自動降畫質：fps < 45 連續 3 秒
    if (c.match && c.match.state !== 'menu' && !c.noAutoQuality && dt < 0.25) {
      this.avgFps += (1 / Math.max(dt, 1e-4) - this.avgFps) * 0.08;
      this.cool = Math.max(0, this.cool - dt);
      if (this.avgFps < 45 && this.cool <= 0) {
        this.slow += dt;
        if (this.slow > 3) {
          const i = QUALITY_ORDER.indexOf(c.quality); if (i > 0) { this.setQuality(QUALITY_ORDER[i - 1]); this.avgFps = 60; }
          this.slow = 0; this.cool = 4;
        }
      } else this.slow = 0;
    }
  }
  render() {
    this.renderer.info.reset();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
}
