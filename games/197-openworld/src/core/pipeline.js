import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/**
 * bloom 之前先把異常值壓掉：MSAA 會在三角形邊緣外插 varying，偶爾算出爆掉的亮度（或 NaN），
 * 不處理的話單一個取樣點就會被 bloom 放大成一顆大光球。
 */
const SanitizeShader = {
  name: 'SanitizeShader',
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (!(c.r >= 0.0 && c.g >= 0.0 && c.b >= 0.0)) c = vec3(0.0);
      gl_FragColor = vec4(min(c, vec3(24.0)), 1.0);
    }`,
};

/** 最後一道：在顯示空間做對比／飽和度、暗角與極輕微的底片顆粒 */
const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.018 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uGrain;
    uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb * uTint;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(luma), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;
      vec2 d = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
      c += (hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 100.0) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

/**
 * 後製管線：場景先以線性 HDR 畫進 half-float buffer（可選 MSAA），
 * 再依序做 bloom → tone mapping／色彩空間轉換 → 調色。
 */
export class Pipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.samples = -1;
    this.bloomOn = true;
    this.fxaaOn = false;
    this.width = 1;
    this.height = 1;
    this.pixelRatio = 1;
    this.#build(4);
  }

  #build(samples) {
    if (samples === this.samples) return;
    this.samples = samples;
    this.composer?.dispose();
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // 場景是以曝光 0.5 為前提打的光，受光面的線性值常在 1～3；門檻要設在那之上，只讓太陽、火焰、燈這類真正的亮源溢光
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.5, 6.0);
    this.bloom.enabled = this.bloomOn;
    // bloom 本來就是模糊的光暈，用一半解析度算，成本約剩四分之一
    const bloomSetSize = this.bloom.setSize.bind(this.bloom);
    this.bloom.setSize = (w, h) => bloomSetSize(Math.ceil(w / 2), Math.ceil(h / 2));
    this.sanitize = new ShaderPass(SanitizeShader);
    this.sanitize.enabled = this.bloomOn;
    this.composer.addPass(this.sanitize);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // 沒開 MSAA 時用 FXAA 補抗鋸齒（在顯示空間做，便宜很多）
    this.fxaa = new ShaderPass(FXAAShader);
    this.fxaa.enabled = this.fxaaOn;
    this.composer.addPass(this.fxaa);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.setSize(this.width, this.height, this.pixelRatio);
  }

  setQuality({ samples, bloom, fxaa }) {
    this.bloomOn = bloom;
    this.fxaaOn = fxaa;
    this.#build(samples);
    this.bloom.enabled = bloom;
    // 爆亮點只在 MSAA 外插時出現，沒開 MSAA 就省掉這一道全螢幕 pass
    this.sanitize.enabled = bloom && samples > 0;
    this.fxaa.enabled = fxaa;
  }

  setSize(width, height, pixelRatio) {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.fxaa.material.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
  }

  render(dt) {
    this.grade.uniforms.uTime.value += dt;
    this.composer.render(dt);
  }
}

/**
 * 把天空烘成環境貼圖（IBL），讓 PBR 材質有天光漫射與反射。
 * 天空每幾秒才重烘一次：PMREM 要畫六個面再做模糊，每個 frame 做會太貴。
 */
export class SkyProbe {
  constructor(renderer, scene, sky) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.probeScene = new THREE.Scene();
    // 與主場景共用同一份天空材質，uniform 自動同步
    this.skyCopy = new THREE.Mesh(sky.geometry, sky.material);
    this.skyCopy.scale.setScalar(1000);
    this.probeScene.add(this.skyCopy);
    // 地平線以下補一片地面色，物體底部才不會反射到「地底的天空」
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(900, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x2c3320 }),
    );
    this.ground.position.y = -6;
    this.probeScene.add(this.ground);
    this.target = null;
    this.timer = 0;
    this.lastKey = '';
  }

  update(dt, env) {
    this.timer -= dt;
    if (this.timer > 0) return;
    // 太陽高度或天氣變了才重烘
    const key = `${env.sunDir.y.toFixed(2)}|${env.w.cloud.toFixed(1)}|${env.w.haze.toFixed(1)}`;
    if (key === this.lastKey) {
      this.timer = 1;
      return;
    }
    this.lastKey = key;
    this.timer = 6;
    this.ground.material.color.setRGB(0.1, 0.12, 0.07).multiplyScalar(0.15 + env.dayFactor * env.w.sun * 2.2);
    const old = this.target;
    this.target = this.pmrem.fromScene(this.probeScene, 0, 1, 2000);
    this.scene.environment = this.target.texture;
    old?.dispose();
  }
}
