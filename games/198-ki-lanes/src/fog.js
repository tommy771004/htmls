// 戰爭迷霧的畫面面：把玩家隊伍的可見格平滑後上傳成貼圖，材質以 patchFog() 注入「看不到就變暗」。
import * as THREE from 'three';
import { VGRID, VHALF } from './vision.js';

const data = new Uint8Array(VGRID * VGRID).fill(255);
const smooth = new Float32Array(VGRID * VGRID).fill(1);
const tex = new THREE.DataTexture(data, VGRID, VGRID, THREE.RedFormat);
tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
export const fogUniforms = { uFog: { value: tex }, uFogOn: { value: 0 } };

// 材質注入：可與既有 onBeforeCompile 串接；InstancedMesh 也適用
export function patchFog(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev && prev(sh, r);
    sh.uniforms.uFog = fogUniforms.uFog; sh.uniforms.uFogOn = fogUniforms.uFogOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vFogW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 fw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n fw = instanceMatrix * fw;\n#endif\n vFogW = (modelMatrix * fw).xz; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D uFog; uniform float uFogOn; varying vec2 vFogW;`)
      .replace('#include <tonemapping_fragment>', `{ float vis = texture2D(uFog, (vFogW + ${VHALF.toFixed(1)}) / ${(VHALF * 2).toFixed(1)}).r;
  vis = mix(1.0, vis, uFogOn);
  float l = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
  vec3 dim = mix(vec3(l), gl_FragColor.rgb, 0.45) * vec3(0.46, 0.5, 0.6);
  gl_FragColor.rgb = mix(dim, gl_FragColor.rgb, smoothstep(0.05, 0.95, vis)); }
#include <tonemapping_fragment>`);
  };
  material.customProgramCacheKey = () => 'fog' + (material.type || '');
  material.needsUpdate = true;
  return material;
}

// 每幀：以玩家隊伍的可見格淡入淡出
export function updateFog(grid, dt, on = true) {
  fogUniforms.uFogOn.value = on ? 1 : 0;
  if (!grid) return;
  const k = Math.min(1, dt * 6);
  for (let i = 0; i < smooth.length; i++) { smooth[i] += (grid[i] - smooth[i]) * k; data[i] = smooth[i] * 255; }
  tex.needsUpdate = true;
}
export function resetFog() { smooth.fill(1); data.fill(255); tex.needsUpdate = true; }
