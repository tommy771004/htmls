// 繪圖：WebGL 渲染器、後製（泛光＋暗角顆粒）、環境反射貼圖、畫質切換。
import {
  WebGLRenderer, ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap, PMREMGenerator, Scene, Mesh, MeshBasicMaterial,
  BoxGeometry, PlaneGeometry, SphereGeometry, BackSide, Color, Vector2, HalfFloatType, WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// 暗角＋細顆粒＋一點色散（在 tone mapping 之前、線性空間）
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.9 }, grain: { value: 0.035 }, ca: { value: 0.0012 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vig, grain, ca; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 7.0) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + d * ca * r2 * 8.0).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - d * ca * r2 * 8.0).b;
      c *= mix(1.0, smoothstep(0.95, 0.15, r2 * 2.2), vig);
      c += (h(vUv * 913.0) - 0.5) * grain * (0.35 + c);
      gl_FragColor = vec4(max(c, 0.0), 1.0);
    }`,
};

export const QUALITY = {
  low: { ratio: 1, bloom: false, shadows: false, samples: 0, smoke: 400 },
  mid: { ratio: 1.25, bloom: true, shadows: true, samples: 0, smoke: 900 },
  high: { ratio: 1.75, bloom: true, shadows: true, samples: 4, smoke: 1600 },
};

export class Gfx {
  constructor(canvas, quality = 'high') {
    const r = this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.toneMapping = ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = SRGBColorSpace;
    r.shadowMap.type = PCFShadowMap;
    this.size = new Vector2();
    this.setQuality(quality, true);
    addEventListener('resize', () => this.resize());
  }

  setQuality(q, init = false) {
    this.q = QUALITY[q] ? q : 'high';
    const Q = QUALITY[this.q];
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, Q.ratio));
    r.shadowMap.enabled = Q.shadows;
    if (this.composer) this.composer.dispose?.();
    const w = innerWidth, h = innerHeight;
    const rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: Q.samples });
    const c = this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new Scene(), null);
    c.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new Vector2(w, h), 0.85, 0.55, 0.82);
    this.bloom.enabled = Q.bloom;
    c.addPass(this.bloom);
    this.finish = new ShaderPass(FinishShader);
    c.addPass(this.finish);
    c.addPass(new OutputPass());
    this.resize();
    if (!init) for (const m of this.materialsToRefresh || []) m.needsUpdate = true;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.size.set(w, h);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  }

  render(scene, camera, dt) {
    if (this.camera !== camera) { this.camera = camera; camera.aspect = this.size.x / this.size.y; camera.updateProjectionMatrix(); }
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    const b = scene.userData.bloom || [0.85, 0.55, 0.82];
    this.bloom.strength = b[0]; this.bloom.radius = b[1]; this.bloom.threshold = b[2];
    this.finish.uniforms.time.value += dt;
    this.composer.render(dt);
  }

  // 環境反射：一個黑盒子裡掛幾片發光面板，PMREM 預先模糊。night＝特技場（紅霓虹＋泛光燈），studio＝展示間
  envMap(kind) {
    this.envs = this.envs || {};
    if (this.envs[kind]) return this.envs[kind];
    const pm = new PMREMGenerator(this.renderer);
    const s = new Scene();
    const box = new Mesh(new SphereGeometry(50, 32, 16), new MeshBasicMaterial({ color: kind === 'studio' ? '#0d0d0e' : '#050506', side: BackSide }));
    s.add(box);
    const panel = (w, h, x, y, z, c, k) => {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(c).multiplyScalar(k), side: 2 }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); return m;
    };
    if (kind === 'studio') {
      // 汽車攝影棚：頂上三條長燈箱、兩側直立燈箱、地平線一條紅光
      for (const z of [-12, 0, 12]) panel(46, 4, 0, 34, z, '#ffffff', 3.2);
      panel(5, 22, 38, 8, 10, '#fff3e6', 2.6);
      panel(5, 22, -38, 8, -10, '#e9f0ff', 2.0);
      panel(40, 8, 0, 10, -40, '#ffffff', 0.7);
      panel(80, 1.2, 0, 0.5, 42, '#ff2a1e', 1.2);
    } else {
      // 低角度的紅色地平線、幾盞泛光燈、天頂一點冷光
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; panel(26, 0.8, Math.cos(a) * 44, 1, Math.sin(a) * 44, '#ff2016', 1.6); }
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + 0.4; panel(3, 2, Math.cos(a) * 40, 16, Math.sin(a) * 40, '#fff6ea', 6); }
      panel(40, 40, 0, 45, 0, '#202634', 0.6);
      panel(80, 6, 0, -6, 0, '#1a1a1c', 0.4);
    }
    const rt = pm.fromScene(s, 0.035);
    pm.dispose();
    this.envs[kind] = rt.texture;
    return rt.texture;
  }
}
