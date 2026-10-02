// 建材的幾何與材質：單一 InstancedMesh 每種外形一個，貼圖／全息／裂紋全在 shader 內處理。
import * as THREE from 'three';

export const CELL = 4, LEVEL = 3.5;
export const WALL_T = 0.3, FLOOR_T = 0.25;
export const RAMP_TH = Math.atan2(LEVEL, CELL), RAMP_LEN = Math.hypot(CELL, LEVEL), RAMP_T = 0.25 * Math.cos(RAMP_TH);
export const HALF = { wall: [CELL / 2, LEVEL / 2, WALL_T / 2], floor: [CELL / 2, FLOOR_T / 2, CELL / 2], ramp: [CELL / 2, RAMP_T / 2, RAMP_LEN / 2] };

// 盒幾何：uv 改成公尺（依法線主軸投影），並附加 aFill（0..1，全息填充方向）
export function pieceGeometry(kind) {
  const [hx, hy, hz] = HALF[kind];
  const g = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  const fill = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i));
    if (ax > 0.5) uv.setXY(i, z + hz, y + hy); else if (ay > 0.5) uv.setXY(i, x + hx, z + hz); else uv.setXY(i, x + hx, y + hy);
    fill[i] = kind === 'wall' ? (y + hy) / (hy * 2) : kind === 'floor' ? (x + z + hx + hz) / (hx * 2 + hz * 2) : (hz - z) / (hz * 2);
  }
  g.setAttribute('aFill', new THREE.BufferAttribute(fill, 1));
  return g;
}

const COMMON_FRAG = /* glsl */ `
uniform sampler2D uTexW, uTexS, uTexM; uniform float uTime, uClock; uniform vec3 uHalf;
varying vec4 vPiece; varying float vFill; varying vec3 vLoc; varying vec3 vNL; varying vec2 vUvM; varying float vSeed; varying float vVD;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 pieceTex(vec2 uv, float m){
  vec2 t = uv * 0.5;
  vec3 a = texture2D(uTexW, t).rgb, b = texture2D(uTexS, t).rgb, c = texture2D(uTexM, t).rgb;
  return mix(mix(a, b, step(0.5, m)), c, step(1.5, m));
}`;
const MAP_FRAG = /* glsl */ `
vec3 holoEm = vec3(0.0);
{
  vec3 an = abs(vNL);
  vec3 dd = uHalf - abs(vLoc);
  float ed = an.x > 0.5 ? min(dd.y, dd.z) : (an.y > 0.5 ? min(dd.x, dd.z) : min(dd.x, dd.y));
  float edge = 1.0 - smoothstep(0.0, 0.13, ed);
  vec3 tc = pieceTex(vUvM, vPiece.x);
  float prog = vPiece.y;
  #if PKIND == 2
  if (vNL.y > 0.5) {
    float t = fract(vUvM.y * 1.9);
    tc *= 0.62 + 0.38 * smoothstep(0.0, 0.1, t);
    tc *= 1.0 + 0.16 * (1.0 - smoothstep(0.1, 0.26, t));
    tc *= 1.0 - 0.18 * smoothstep(1.55, 1.8, abs(vUvM.x - 2.0));
  }
  #endif
  tc *= (1.0 - 0.36 * edge) * 1.12;
  float dmg = vPiece.z;
  if (dmg > 0.08) {
    vec2 p = vUvM * 2.1 + vSeed * 7.0 + (an.x > 0.5 ? 3.0 : (an.y > 0.5 ? 9.0 : 0.0));
    vec2 ip = floor(p), fp = fract(p);
    float d1 = 8.0, d2 = 8.0, ch = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(h21(ip + g), h21(ip + g + 17.3));
      float d = length(g + o - fp);
      if (d < d1) { d2 = d1; d1 = d; ch = h21(ip + g + 5.1); } else if (d < d2) d2 = d;
    }
    float cr = 1.0 - smoothstep(0.0, 0.075, d2 - d1);
    tc *= 1.0 - 0.75 * cr * step(ch, dmg * 1.2);
    tc *= 1.0 - 0.26 * dmg;
  }
  if (prog < 0.999) {
    float f = vFill, front = prog * 1.04;
    float solid = 1.0 - smoothstep(front - 0.012, front, f);
    vec2 gv = abs(fract(vUvM) - 0.5);
    float grid = smoothstep(0.45, 0.48, max(gv.x, gv.y));
    float rim = 1.0 - smoothstep(0.0, 0.07, ed);
    float scan = smoothstep(0.92, 1.0, sin(f * 38.0 - uClock * 5.0) * 0.5 + 0.5) * 0.5;
    float lineA = max(max(grid, rim), scan);
    float band = 1.0 - smoothstep(0.0, 0.04, abs(f - front));
    if (solid < 0.5 && lineA < 0.45 && band < 0.5) discard;
    // 施工全息用螢幕空間抖動做半透明：填色約 45%、線條約 85%；離鏡頭越近（擋在鏡頭與角色之間）越透明
    float near = smoothstep(1.5, 9.0, vVD);
    float opa = (solid > 0.5 && lineA < 0.45 && band < 0.5 ? 0.45 : 0.85) * mix(0.1, 1.0, near);
    if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) > opa) discard;
    vec3 holo = vec3(0.2, 0.7, 0.9);
    float sd = step(0.5, solid);
    tc = mix(holo, mix(tc, holo * 0.85, (1.0 - prog) * 0.5), sd);
    holoEm = holo * (sd * ((1.0 - prog) * 0.12 + rim * 0.08) + (1.0 - sd) * (0.3 + 0.4 * lineA)) + holo * band * 0.7;
  }
  diffuseColor.rgb *= tc;
}`;

export function makePieceMaterial(kind, texs, U) {
  const m = new THREE.MeshStandardMaterial({ roughness: kind === 'metal' ? 0.5 : 0.8, metalness: 0 });
  const k = { wall: 0, floor: 1, ramp: 2 }[kind];
  m.defines = { PKIND: k };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uClock = U.clock;
    sh.uniforms.uTexW = { value: texs[0] }; sh.uniforms.uTexS = { value: texs[1] }; sh.uniforms.uTexM = { value: texs[2] };
    sh.uniforms.uHalf = { value: new THREE.Vector3(...HALF[kind]) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aPiece; attribute vec4 aPiece2; attribute float aFill;
varying vec4 vPiece; varying float vFill; varying vec3 vLoc; varying vec3 vNL; varying vec2 vUvM; varying float vSeed; varying float vVD;
uniform float uTime;`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvVD = -mvPosition.z;')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
float hk = max(0.0, 1.0 - (uTime - aPiece.w) / 0.45);
transformed += normal * sin((uTime - aPiece.w) * 55.0) * 0.032 * hk * hk;
float ps = clamp((uTime - aPiece2.x) / 0.2, 0.0, 1.0);
transformed *= 1.0 + 0.05 * (1.0 - ps) * (1.0 - ps);
vPiece = aPiece; vFill = aFill; vLoc = position; vNL = normal; vUvM = uv; vSeed = aPiece2.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON_FRAG}`)
      .replace('#include <map_fragment>', MAP_FRAG)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += holoEm;');
  };
  m.customProgramCacheKey = () => 'sw-piece-' + kind;
  return m;
}

// 預覽全息幽靈
export function makeGhostMaterial(kind, U) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(0x4aa8ff) }, uClock: U.clock, uHalf: { value: new THREE.Vector3(...HALF[kind]) }, uPulse: { value: 0 } },
    vertexShader: `varying vec3 vL; varying vec3 vN; varying vec2 vUv2; varying vec3 vV;
void main(){ vL = position; vN = normal; vUv2 = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol, uHalf; uniform float uClock, uPulse; varying vec3 vL; varying vec3 vN; varying vec2 vUv2; varying vec3 vV;
void main(){
  vec3 an = abs(vN), dd = uHalf - abs(vL);
  float ed = an.x > 0.5 ? min(dd.y, dd.z) : (an.y > 0.5 ? min(dd.x, dd.z) : min(dd.x, dd.y));
  float rim = 1.0 - smoothstep(0.0, 0.08, ed);
  vec2 gv = abs(fract(vUv2) - 0.5);
  float grid = smoothstep(0.455, 0.485, max(gv.x, gv.y));
  float scan = smoothstep(0.93, 1.0, sin((vL.x + vL.y * 1.3 + vL.z) * 2.2 - uClock * 3.0) * 0.5 + 0.5);
  float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  float a = 0.12 + 0.12 * uPulse + 0.55 * grid + 0.85 * rim + 0.3 * scan + 0.2 * fr;
  vec3 c = uCol * (0.85 + 0.5 * rim + 0.25 * uPulse);
  gl_FragColor = vec4(c, clamp(a, 0.0, 0.92));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  return m;
}
