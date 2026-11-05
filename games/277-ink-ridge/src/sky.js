// 天空（宣紙肌理＋朱砂水洗墨暈＋四疊奇峰遠山與山腰雲氣）、流雲雲海（勾雲法渦捲雲頭）、寒潭黑水與落雪
import * as THREE from 'three';
import { NOISE_GLSL, inkUniforms } from './ink.js';

/** o: { paper0, paper1, wash, washK }（線性 RGB 陣列）；不給就是第一關的宣紙與朱紅水洗 */
export function makeSky(o = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uP0: { value: new THREE.Vector3(...(o.paper0 || [0.905, 0.85, 0.74])) },
      uP1: { value: new THREE.Vector3(...(o.paper1 || [0.835, 0.755, 0.615])) },
      uW: { value: new THREE.Vector3(...(o.wash || [0.71, 0.34, 0.28])) },
      uWK: { value: o.washK ?? 0.86 },
    },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform float uTime, uWK; uniform vec3 uP0, uP1, uW;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        float e = d.y; float a = atan(d.z, d.x);
        // 宣紙暖色漸層＋微斑駁茶洗底紋
        float mottle = inkF(vec2(a * 3.4, e * 5.2) + 2.3);
        vec3 paper = mix(uP0, uP1, smoothstep(-0.02, 0.58, e));
        paper *= 0.96 + 0.075 * mottle;

        // 天頂朱砂水洗：雙層渲染雲氣＋水線沉積邊（參考影片石階與庭院幀上方紅霞墨韻）
        float wWarp = inkF(vec2(a * 2.8, e * 4.2) + uTime * 0.003);
        float wField = e + 0.24 * (inkF(vec2(a * 2.1 + wWarp * 0.6, e * 3.6) + uTime * 0.004) - 0.5) + 0.09 * cos(a - 0.85);
        float wash = smoothstep(0.065, 0.46, wField);
        float washRim = (smoothstep(0.055, 0.11, wField) - smoothstep(0.11, 0.20, wField)) * smoothstep(0.02, 0.12, e);
        vec3 col = mix(paper, uW, (wash * 0.92 + washRim * 0.34) * uWK);
        col = mix(col, col * 0.89, inkF(vec2(a * 6.5, e * 10.0)) * 0.24);

        // 四疊遠山與黃山式奇峰石筍：每層山腳融進留白雲氣，山體帶淡墨直皴與山脊勾線
        for (int k = 0; k < 4; k++) {
          float fk = float(k);
          float freq = 2.0 + fk * 1.55;
          float baseN = inkF(vec2(a * freq + fk * 8.7, fk * 3.1));
          float crag = pow(max(0.0, inkN(vec2(a * (7.5 + fk * 3.2) + fk * 4.1, fk + 2.0)) - 0.48) * 1.9, 1.8);
          float spire = pow(max(0.0, inkN(vec2(a * (15.0 + fk * 4.0) + fk * 11.3, fk * 2.7)) - 0.72) * 3.5, 2.2) * 0.038;
          float h = 0.052 + 0.115 * pow(baseN, 1.65) + 0.042 * crag + spire - fk * 0.024;

          float under = step(e, h);
          // 山腳留白雲霧漸消
          float footFade = smoothstep(h - 0.095 - fk * 0.018, h - 0.006, e);
          // 山脊濃墨壓頂與山體縱向皴紋
          float ridgeRim = smoothstep(h - 0.012, h - 0.001, e) * under;
          float mtnStreak = inkN(vec2(a * (42.0 + fk * 12.0), e * 22.0 + fk));
          float tone = (0.14 + 0.135 * fk) * (0.86 + 0.26 * mtnStreak);
          vec3 inkTint = mix(vec3(0.24, 0.26, 0.30), vec3(0.15, 0.16, 0.19), fk / 3.0);

          col = mix(col, mix(col, inkTint, clamp(tone + ridgeRim * 0.22, 0.0, 0.82)), under * footFade);
          // 層間飄渺雲帶
          float mistBand = smoothstep(h - 0.05, h - 0.11, e) * (1.0 - smoothstep(h - 0.11, h - 0.18, e)) * under;
          col = mix(col, mix(uP0, vec3(0.90, 0.88, 0.83), 0.5), mistBand * (0.32 - fk * 0.05));
        }

        // 地平線雲海留白霧氣
        col = mix(col, mix(uP0, vec3(0.89, 0.87, 0.82), 0.65), smoothstep(0.065, -0.065, e) * 0.88);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 28), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

export function makeClouds() {
  const g = new THREE.Group();
  const mk = (y, op, scale, speed, wispy = 0) => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`
        varying vec3 vW; uniform float uTime; uniform vec3 uCam;
        ${NOISE_GLSL}
        void main(){
          vec2 p = vW.xz * ${scale.toFixed(4)} + vec2(uTime * ${speed.toFixed(4)}, uTime * ${(speed * 0.38).toFixed(4)});
          // 渦捲域扭曲（Domain Warping）：畫出國畫「雲頭皴」翻湧團塊與水墨勾雲邊
          vec2 q = vec2(inkF(p * 0.85 + vec2(1.7, 9.2)), inkF(p * 0.85 + vec2(8.3, 2.8)));
          float c = inkF(p + 1.25 * q) * 0.66 + inkF(p * 2.6 + 1.8 * q + 5.0) * 0.34;
          float puff = smoothstep(${wispy ? '0.48' : '0.36'}, 0.75, c);
          // 雙道淡墨勾雲線：外緣與內摺線
          float rim1 = smoothstep(0.35, 0.405, c) - smoothstep(0.405, 0.49, c);
          float rim2 = smoothstep(0.53, 0.565, c) - smoothstep(0.565, 0.63, c);
          vec3 belly = vec3(0.76, 0.76, 0.75);
          vec3 crest = vec3(0.97, 0.95, 0.90);
          vec3 col = mix(belly, crest, puff);
          col = mix(col, vec3(0.34, 0.35, 0.39), (rim1 * 0.42 + rim2 * 0.24));

          float dist = length(vW.xz - uCam.xz);
          float fade = 1.0 - smoothstep(250.0, 820.0, dist);
          col = mix(vec3(0.87, 0.85, 0.80), col, fade);
          float alpha = ${op.toFixed(3)} * mix(${wispy ? '0.0' : '0.52'}, 1.0, puff) * (1.0 - ${wispy ? '0.25' : '0.0'} * (1.0 - fade));
          gl_FragColor = vec4(col, alpha);
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mat);
    m.rotation.x = -Math.PI / 2; m.position.y = y; m.frustumCulled = false;
    g.add(m);
    return m;
  };
  const low = mk(-30, 1.0, 0.0115, 0.85, 0);
  const mid = mk(-19, 0.58, 0.0195, 1.45, 0);
  const high = mk(-11.5, 0.26, 0.028, 2.0, 1);
  g.userData.layers = [low, mid, high];
  return g;
}

/** 黑水：濃墨寒潭底＋多層水紋勾線＋岸際拍浪白線＋冷天光斜射倒影，遠處自然融霧 */
export function makeWater(y, fog = [0.8, 0.81, 0.8]) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: inkUniforms.uTime, uFog: { value: new THREE.Vector3(...fog) } },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vW; uniform float uTime; uniform vec3 uFog;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vW.xz;
        // 雙層流淌水墨漣漪等值線
        float warp = inkN(p * 0.25 + vec2(0.0, uTime * 0.04));
        float r = inkF(p * vec2(0.32, 0.13) + vec2(uTime * 0.018 + warp * 0.3, uTime * 0.048));
        float v = abs(fract(r * 9.5) - 0.5);
        float line = (1.0 - smoothstep(0.0, 0.032, v)) * smoothstep(0.38, 0.58, inkF(p * 0.22 + 4.0));
        float r2 = inkN(p * vec2(0.85, 0.42) - vec2(uTime * 0.025, uTime * 0.03));
        float line2 = (1.0 - smoothstep(0.0, 0.025, abs(r2 - 0.52))) * 0.45;

        // 峽谷雪岸（|x|≈6.3）與渡口碼頭附近的細密岸際水紋
        float bankDist = abs(abs(p.x) - 6.35) + (inkN(p * 0.8) - 0.5) * 0.45;
        float bankRip = (1.0 - smoothstep(0.0, 1.4, bankDist)) * (0.5 + 0.5 * sin(bankDist * 13.0 - uTime * 2.1));
        bankRip = smoothstep(0.55, 0.92, bankRip) * step(-63.0, p.y) * step(p.y, -21.0);

        // 深墨潭底＋掠射冷天光微反光（Fresnel）
        vec3 viewDir = normalize(cameraPosition - vW);
        float fres = pow(1.0 - clamp(viewDir.y, 0.0, 1.0), 4.2);
        float sheen = inkF(vec2(p.x * 0.55, p.y * 0.045 + uTime * 0.028));
        vec3 col = vec3(0.018, 0.021, 0.027) + vec3(0.042, 0.048, 0.058) * sheen * sheen;
        col += vec3(0.075, 0.085, 0.098) * fres * (0.55 + 0.45 * sheen);
        col = mix(col, vec3(0.32, 0.35, 0.39), clamp(line * 0.62 + line2 * 0.32 + bankRip * 0.55, 0.0, 0.78));

        float d = length(vW.xz - cameraPosition.xz);
        col = mix(col, uFog, smoothstep(88.0, 260.0, d));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.userData.noBake = true; m.frustumCulled = false;
  return m;
}

/** 落雪：以鏡頭為中心的循環方塊，全在頂點著色器算（遠近大小與飄擺層次分明） */
export function makeSnow(n = 1800, box = 42) {
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) a[i] = Math.random();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uPx: { value: 1 } },
    vertexShader: /* glsl */`
      uniform float uT, uBox, uPx; uniform vec3 uCam; varying float vA;
      void main(){
        vec3 q = position;
        float sway = sin(uT * (0.65 + q.y * 0.5) + q.x * 42.0) * 0.015;
        float swayZ = cos(uT * 0.55 + q.z * 37.0) * 0.011;
        q += vec3(uT * 0.015 + sway, -uT * (0.045 + q.z * 0.042), uT * 0.008 + swayZ);
        vec3 w = (fract(q - uCam / uBox) - 0.5) * uBox + uCam;
        vec4 mv = viewMatrix * vec4(w, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (26.0 + position.y * 32.0) / max(1.0, -mv.z);
        vA = smoothstep(uBox * 0.5, uBox * 0.28, length(w - uCam)) * (0.62 + 0.32 * position.y);
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.18, 0.98, d);
        gl_FragColor = vec4(0.95, 0.965, 0.98, core * vA);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, mat);
  p.frustumCulled = false; p.renderOrder = 5;
  p.update = (t, cam) => { mat.uniforms.uT.value = t; mat.uniforms.uCam.value.copy(cam); };
  return p;
}
