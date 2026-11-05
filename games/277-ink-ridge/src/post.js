// 後製：場景畫進帶深度的 render target → 透視精確 1/z 輪廓與折角雙層水墨描線（筆鋒粗細收放）
// ＋凹角積墨環境光遮蔽（SSAO-lite）＋切向抗鋸齒＋宣紙簾紋纖維＋暗角＋墨暈轉場
import * as THREE from 'three';
import { NOISE_GLSL } from './ink.js';

export function makePost(renderer) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4, type: THREE.HalfFloatType });
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;
  rt.depthTexture = new THREE.DepthTexture(size.x, size.y);
  rt.depthTexture.type = THREE.UnsignedIntType;
  const mat = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uRes: { value: size.clone() },
      uNear: { value: 0.1 }, uFar: { value: 1200 }, uTime: { value: 0 }, uFade: { value: 0 }, uLine: { value: 1 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform sampler2D tColor, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime, uFade, uLine;
      ${NOISE_GLSL}
      float lin(vec2 uv){
        float z = texture2D(tDepth, clamp(uv, 0.0005, 0.9995)).x * 2.0 - 1.0;
        return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
      }
      float lumaOf(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
      void main(){
        vec2 px = 1.0 / uRes;
        float s = max(1.0, uRes.y / 900.0);

        // 1. 切向輕量抗鋸齒取樣（柔化屋簷、山稜與陰影斜邊鋸齒）
        vec3 cC = texture2D(tColor, vUv).rgb;
        vec3 cL = texture2D(tColor, vUv - vec2(px.x, 0.0)).rgb;
        vec3 cR = texture2D(tColor, vUv + vec2(px.x, 0.0)).rgb;
        vec3 cD = texture2D(tColor, vUv - vec2(0.0, px.y)).rgb;
        vec3 cU = texture2D(tColor, vUv + vec2(0.0, px.y)).rgb;
        vec2 lg = vec2(lumaOf(cR) - lumaOf(cL), lumaOf(cU) - lumaOf(cD));
        float lgLen = length(lg);
        vec3 col = cC;
        if (lgLen > 0.055) {
          vec2 tang = vec2(-lg.y, lg.x) / lgLen * px * 0.68;
          vec3 cT1 = texture2D(tColor, vUv + tang).rgb;
          vec3 cT2 = texture2D(tColor, vUv - tang).rgb;
          col = mix(cC, (cC * 2.0 + cT1 + cT2) * 0.25, smoothstep(0.055, 0.18, lgLen) * 0.72);
        }

        // 2. 透視精確 1/z 二階差分：平坦斜面恆為 0，外輪廓（粗濃墨）與內折角（細淡墨）分層描繪
        float brushNoise = inkF(vUv * vec2(46.0, 38.0));
        vec2 j = (vec2(inkN(vUv * 95.0), inkN(vUv * 95.0 + 7.3)) - 0.5) * px * 1.15 * s;
        vec2 uv = vUv + j;
        float w = 1.08 * s * (0.78 + 0.46 * brushNoise);
        vec2 ox = vec2(px.x * w, 0.0), oy = vec2(0.0, px.y * w);

        float dc  = lin(uv);
        float dL  = lin(uv - ox),      dR  = lin(uv + ox);
        float dD  = lin(uv - oy),      dU  = lin(uv + oy);
        float dDL = lin(uv - ox - oy), dUR = lin(uv + ox + oy);
        float dUL = lin(uv - ox + oy), dDR = lin(uv + ox - oy);

        float dMin = min(dc, min(min(dL, dR), min(dD, dU)));
        float izC = 1.0 / dc;
        float lh  = abs((1.0 / dR)  + (1.0 / dL)  - 2.0 * izC);
        float lv  = abs((1.0 / dU)  + (1.0 / dD)  - 2.0 * izC);
        float ld1 = abs((1.0 / dUR) + (1.0 / dDL) - 2.0 * izC) * 0.7071;
        float ld2 = abs((1.0 / dUL) + (1.0 / dDR) - 2.0 * izC) * 0.7071;

        float jump = length(vec2(max(lh, ld1), max(lv, ld2))) * dMin;
        float lapNorm = jump / max(px.y * w, 1e-5);

        float fadeSil = 1.0 - smoothstep(65.0, 265.0, dMin);
        float fadeCrease = 1.0 - smoothstep(26.0, 92.0, dMin);
        // 乾筆飛白調製：讓筆觸濃淡有呼吸感
        float dryMod = 0.80 + 0.28 * inkN(vUv * 180.0 + 3.1);
        float sil = smoothstep(0.036, 0.095, jump) * fadeSil;
        float crease = smoothstep(2.35, 6.4, lapNorm) * (1.0 - sil) * fadeCrease;
        float inkStroke = clamp((sil * 0.90 + crease * 0.44) * dryMod, 0.0, 0.92) * uLine;

        // 3. 凹角積墨（Screen-Space Crevice Ink AO）：石階根部、牆腳、岩縫下自然聚墨，平面絕不誤黑
        float dc0 = lin(vUv);
        float ao = 0.0;
        if (dc0 < 90.0) {
          float iz0 = 1.0 / dc0;
          float rAO = 7.5 * s * (0.85 + 0.3 * brushNoise);
          vec2 d1 = vec2(px.x, 0.0) * rAO, d2 = vec2(0.0, px.y) * rAO;
          vec2 d3 = vec2(px.x, px.y) * (rAO * 0.7071), d4 = vec2(-px.x, px.y) * (rAO * 0.7071);
          float a1p = lin(vUv + d1), a1m = lin(vUv - d1);
          float a2p = lin(vUv + d2), a2m = lin(vUv - d2);
          float a3p = lin(vUv + d3), a3m = lin(vUv - d3);
          float a4p = lin(vUv + d4), a4m = lin(vUv - d4);
          float w1 = (1.0 - smoothstep(0.55, 2.1, abs(a1p - dc0))) * (1.0 - smoothstep(0.55, 2.1, abs(a1m - dc0)));
          float w2 = (1.0 - smoothstep(0.55, 2.1, abs(a2p - dc0))) * (1.0 - smoothstep(0.55, 2.1, abs(a2m - dc0)));
          float w3 = (1.0 - smoothstep(0.55, 2.1, abs(a3p - dc0))) * (1.0 - smoothstep(0.55, 2.1, abs(a3m - dc0)));
          float w4 = (1.0 - smoothstep(0.55, 2.1, abs(a4p - dc0))) * (1.0 - smoothstep(0.55, 2.1, abs(a4m - dc0)));
          float c1 = max(0.0, (0.5 * (1.0 / a1p + 1.0 / a1m) - iz0) * dc0) * w1;
          float c2 = max(0.0, (0.5 * (1.0 / a2p + 1.0 / a2m) - iz0) * dc0) * w2;
          float c3 = max(0.0, (0.5 * (1.0 / a3p + 1.0 / a3m) - iz0) * dc0) * w3;
          float c4 = max(0.0, (0.5 * (1.0 / a4p + 1.0 / a4m) - iz0) * dc0) * w4;
          ao = clamp((c1 + c2 + c3 + c4) * 3.6, 0.0, 1.0) * (1.0 - smoothstep(28.0, 88.0, dc0));
        }

        float luma = lumaOf(col);
        col = mix(vec3(luma), col, 0.87);
        // 先疊加凹處淡墨暈染，再壓上手繪濃墨線條
        col = mix(col, col * vec3(0.54, 0.56, 0.62), ao * (0.46 + 0.14 * brushNoise));
        col = mix(col, vec3(0.075, 0.078, 0.098), inkStroke);

        // 4. 宣紙簾紋、檀皮長纖維與細微紙砂
        vec2 sp = vUv * uRes / s;
        float laid = sin(sp.y * 1.35 + inkN(sp * 0.04) * 2.2) * 0.5 + 0.5;
        float fib = inkF(vec2(sp.x * 0.014, sp.y * 0.055)) * 0.52 + inkN(sp * 0.48) * 0.34 + laid * 0.14;
        col *= 0.948 + 0.088 * fib;

        // 5. 四角古畫舊紙暗化
        vec2 q = vUv - 0.5;
        float vig = smoothstep(0.88, 0.24, length(q * vec2(1.0, 1.18)));
        col *= mix(vec3(0.70, 0.62, 0.53), vec3(1.0), vig);

        // 6. 墨暈轉場（墜落／過場）：從四周往中心潑墨暈開
        float f = uFade;
        float ink = smoothstep(f * 1.3 - 0.25, f * 1.3, 1.0 - length(q) * 1.25 + (inkF(vUv * 6.0 + uTime * 0.2) - 0.5) * 0.35);
        col = mix(col, vec3(0.07, 0.07, 0.09), (1.0 - ink) * step(0.001, f));

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const pScene = new THREE.Scene(); pScene.add(quad);
  const pCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    uniforms: mat.uniforms,
    setSize() {
      renderer.getDrawingBufferSize(size);
      rt.setSize(size.x, size.y);
      mat.uniforms.uRes.value.copy(size);
    },
    render(scene, camera, t) {
      mat.uniforms.uNear.value = camera.near; mat.uniforms.uFar.value = camera.far; mat.uniforms.uTime.value = t;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(pScene, pCam);
    },
  };
}
