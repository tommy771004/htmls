// 六器鏢行 — renderer 建立與 TSL 材質：三張地圖的地面、河面、天穹、環境反射、朱砂引路線、刃風弧光

import * as THREE from 'three';
import { WebGPURenderer, MeshStandardNodeMaterial, MeshBasicNodeMaterial, PMREMGenerator } from 'three/webgpu';
import {
  Fn, uniform, time, color, vec2, vec3, float,
  sin, cos, dot, max, min, pow, mix, smoothstep, fract, floor, abs, clamp, hash, normalize,
  positionLocal, positionWorld, normalView, positionViewDirection, mx_noise_float, mx_worley_noise_float,
  transformNormalToView, uv, cameraPosition,
} from 'three/tsl';

/**
 * 啟動 WebGPURenderer；沒有原生 WebGPU（舊瀏覽器、無頭 SwiftShader）時自動退回 WebGL2 後端
 */
export async function createEscortRenderer(canvas, forceWebGL = false) {
  let renderer = null;
  let backendName = 'WebGPU';
  const tryConfigs = forceWebGL ? [true] : [false, true];
  for (const useGL of tryConfigs) {
    try {
      const r = new WebGPURenderer({ canvas, antialias: true, powerPreference: 'high-performance', forceWebGL: useGL });
      await r.init();
      renderer = r;
      backendName = r.backend?.isWebGPUBackend ? 'WebGPU (TSL)' : 'WebGL2 (TSL Fallback)';
      break;
    } catch {
      try { renderer?.dispose?.(); } catch { /* ignore */ }
      renderer = null;
    }
  }
  if (!renderer) throw new Error('無法初始化 Three.js WebGPU / WebGL2 渲染器');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap 在 r0.186 已移除（兩個後端都會印 warning 再退回 PCF）
  return { renderer, backendName };
}

/**
 * 一般表面材質（舊名的描黑邊已拿掉）：PBR ＋ 一點天光色的邊緣光
 */
export function makeSurfaceMaterial({ hex = 0x8e2424, roughness = 0.62, metalness = 0.15, rimPower = 3, rimStrength = 0.25, rimHex = 0xbfd0d4, glowHex = null, glowIntensity = 0 } = {}) {
  const mat = new MeshStandardNodeMaterial({ roughness, metalness });
  const baseCol = uniform(new THREE.Color(hex));
  const rimCol = uniform(new THREE.Color(rimHex));
  mat.colorNode = baseCol;
  const ndv = max(float(0.0), dot(normalView, positionViewDirection));
  let em = rimCol.mul(pow(float(1).sub(ndv), float(rimPower)).mul(rimStrength));
  if (glowHex !== null && glowIntensity > 0) {
    const gCol = uniform(new THREE.Color(glowHex));
    const gInt = uniform(glowIntensity);
    em = em.add(gCol.mul(gInt));
    mat.userData.uGlowColor = gCol;
    mat.userData.uGlowIntensity = gInt;
  }
  mat.emissiveNode = em;
  mat.userData.uBaseColor = baseCol;
  mat.userData.uRimColor = rimCol;
  return mat;
}

// ── 地面 ──
// 錯縫石板：回傳 { grout, id }（grout＝縫的濃度 0..1，id＝每塊石板的亂數）
function flagstones(wx, wz, sx, sz) {
  const v = wz.mul(sz);
  const row = floor(v);
  const u = wx.mul(sx).add(hash(row.mul(7.13)).mul(0.9));
  const col = floor(u);
  const fu = fract(u), fv = fract(v);
  // 有些縫不畫，兩格併成一塊長石，石板大小就不會整齊得像格線
  const big = float(9.0);
  const keepL = smoothstep(float(0.3), float(0.36), hash(col.mul(3.7).add(row.mul(57.1))));
  const keepR = smoothstep(float(0.3), float(0.36), hash(col.add(1).mul(3.7).add(row.mul(57.1))));
  const duL = mix(big, fu.div(sx), keepL);
  const duR = mix(big, float(1).sub(fu).div(sx), keepR);
  const dv = min(fv, float(1).sub(fv)).div(sz);
  const d = min(min(duL, duR), dv);
  // 縫寬沿線有起伏（石邊磨損）
  const wob = mx_noise_float(vec3(wx.mul(3.0), float(2.2), wz.mul(3.0))).mul(0.012);
  const grout = float(1).sub(smoothstep(float(0.014), float(0.04), d.add(wob)));
  const id = hash(col.mul(17.31).add(row.mul(131.7)));
  // 每塊石板邊緣略暗、中間略亮（有厚度的感覺）
  const bevel = smoothstep(float(0.02), float(0.16), d);
  return { grout, id, d, bevel };
}

// 0..1 的方框遮罩（柔邊 f）
function rectMask(wx, wz, x0, x1, z0, z1, f = 0.6) {
  const a = smoothstep(float(x0 - f), float(x0 + f), wx).mul(float(1).sub(smoothstep(float(x1 - f), float(x1 + f), wx)));
  const b = smoothstep(float(z0 - f), float(z0 + f), wz).mul(float(1).sub(smoothstep(float(z1 - f), float(z1 + f), wz)));
  return a.mul(b);
}

/**
 * 地面材質：mapId 1001 青萍渡（石板街＋泥土＋河灘）、1002 赤沙驛（黃沙＋夯土路）、2001 偃師遺墟（岩層＋巨石鋪地＋冷綠地脈縫）
 */
export function makeGroundMaterial(mapId) {
  const mat = new MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0.0 });
  const wx = positionWorld.x, wz = positionWorld.z, wy = positionWorld.y;
  const nL = mx_noise_float(vec3(wx.mul(0.11), float(0.3), wz.mul(0.11)));
  const nM = mx_noise_float(vec3(wx.mul(0.6), float(1.7), wz.mul(0.6)));
  const nF = mx_noise_float(vec3(wx.mul(3.1), float(4.1), wz.mul(3.1)));

  if (mapId === 1001) {
    // 鋪面：市集廣場、南北主街、往東門的路、往鏢局的西巷、碼頭前的河岸街
    const plaza = rectMask(wx, wz, -13.2, 13.2, -11.8, 8.5, 1.1);
    const street = rectMask(wx, wz, -2.7, 2.7, -22.6, 30, 0.7);
    const east = rectMask(wx, wz, 12, 40, -2.4, 2.4, 0.7);
    const west = rectMask(wx, wz, -24, -12, 1.2, 7.8, 0.7);
    const paveRaw = max(max(plaza, street), max(east, west));
    const fs = flagstones(wx, wz, 0.82, 1.3);
    // 鋪面邊緣以「整塊石板」為單位缺角：交界帶裡每塊石板各自決定在不在，邊線沿石縫鋸齒，不是一刀切的直線
    const pave = smoothstep(float(0.46), float(0.54), paveRaw.add(fs.id.sub(0.5).mul(0.75)).add(nM.mul(0.18)));
    const stoneA = color(0x817b6e), stoneB = color(0x948c7c), stoneC = color(0x6e6b62);
    let stone = mix(stoneA, stoneB, fs.id.mul(0.6).add(nM.mul(0.3)).add(0.2));
    stone = mix(stone, stoneC, smoothstep(float(0.82), float(1.0), fs.id).mul(0.5));
    stone = stone.mul(float(0.88).add(nF.mul(0.09)).add(fs.bevel.mul(0.1))).mul(float(1).sub(fs.grout.mul(0.55)));
    // 縫裡的青苔與泥
    stone = mix(stone, color(0x4c5236), fs.grout.mul(smoothstep(float(-0.1), float(0.5), nM)).mul(0.6));
    // 泥土／草地／河灘
    const grass = mix(color(0x55613a), color(0x6f6e45), nL.mul(0.5).add(0.5)).mul(float(0.9).add(nF.mul(0.12)));
    const dirt = mix(color(0x6e5c42), color(0x86735a), nM.mul(0.5).add(0.5));
    const soil = mix(dirt, grass, smoothstep(float(-0.15), float(0.45), nL).mul(smoothstep(float(-9), float(-4), wz)));
    // 河灘：z < −12 起變成沙泥，越靠水越濕越暗
    const bank = smoothstep(float(-10.5), float(-14), wz);
    const sand = mix(color(0x8f7f62), color(0x9f8f6f), nM.mul(0.5).add(0.5));
    const wet = smoothstep(float(-20.5), float(-24.5), wz);
    const mud = mix(sand, color(0x4a4031), wet);
    let ground = mix(soil, mud, bank);
    // 鋪面外緣一圈碎石與踩實的泥（約 0.6～1 m 寬），把石板和泥地的交界打散
    const band = smoothstep(float(0.04), float(0.4), paveRaw).mul(float(1).sub(pave));
    const nG = mx_noise_float(vec3(wx.mul(8.5), float(5.3), wz.mul(8.5)));
    const gravel = mix(color(0x595245), color(0x958c79), smoothstep(float(-0.05), float(0.45), nG));
    ground = mix(ground, mix(color(0x5c4e3a), gravel, smoothstep(float(-0.4), float(0.3), nM)), band.mul(0.75));
    const c = mix(ground, stone, pave);
    // 水線以下（地形下沉處）
    const under = smoothstep(float(-0.05), float(-0.5), wy);
    mat.colorNode = mix(c, color(0x2e2a22), under);
    mat.roughnessNode = mix(mix(float(0.95), float(0.82), pave), float(0.55), wet.mul(float(1).sub(pave)));
  } else if (mapId === 1002) {
    const road = rectMask(wx, wz, -30, -14, 13.2, 18.8, 0.8);
    const roadN = rectMask(wx, wz, -3.2, 3.2, -26, 30, 1.2).mul(smoothstep(float(0.6), float(-0.4), nM.mul(0.5)));
    const ripple = sin(wx.mul(1.9).add(wz.mul(0.7)).add(nL.mul(6.0))).mul(0.5).add(0.5);
    const ripple2 = sin(wx.mul(4.3).sub(wz.mul(1.4)).add(nM.mul(3.0))).mul(0.5).add(0.5);
    const sandLo = color(0xb07a45), sandHi = color(0xd5a46a);
    let sand = mix(sandLo, sandHi, ripple.mul(0.55).add(ripple2.mul(0.2)).add(nF.mul(0.15)));
    sand = mix(sand, color(0x9a6a3e), smoothstep(float(0.2), float(0.7), nL).mul(0.45));
    // 碎石帶
    const grav = smoothstep(float(0.55), float(0.75), mx_noise_float(vec3(wx.mul(1.2), float(9), wz.mul(1.2))));
    sand = mix(sand, color(0x7c5a3a).mul(float(0.8).add(nF.mul(0.3))), grav.mul(0.6));
    const packed = mix(color(0x8f6a45), color(0xa27a50), nF.mul(0.5).add(0.5));
    const rut = max(road, roadN);
    mat.colorNode = mix(sand, packed, rut.mul(0.8));
    mat.roughnessNode = float(0.96);
  } else {
    // 偃師遺墟：大塊殘石鋪地（中央）＋ 黑岩 ＋ 地脈裂縫冷綠光
    const fs = flagstones(wx.add(wz.mul(0.1)), wz, 0.42, 0.42);
    const plazaM = smoothstep(float(19), float(14), max(abs(wx), abs(wz.add(2))).add(nM.mul(3)));
    const broken = smoothstep(float(0.15), float(0.4), mx_noise_float(vec3(wx.mul(0.35), float(5), wz.mul(0.35))));
    const slab = mix(color(0x4a4f4c), color(0x5f625b), fs.id).mul(float(0.9).add(nF.mul(0.12))).mul(float(1).sub(fs.grout.mul(0.6)));
    const rock = mix(color(0x23262a), color(0x343632), nL.mul(0.5).add(0.5)).mul(float(0.85).add(nF.mul(0.2)));
    const moss = color(0x2d3a2c);
    let c = mix(rock, slab, plazaM.mul(float(1).sub(broken.mul(0.75))));
    c = mix(c, moss, smoothstep(float(0.3), float(0.7), nM).mul(0.35));
    // 地脈裂縫：雜訊的零交界線（細長、會分岔），只在部分區域出現
    const crackN = mx_noise_float(vec3(wx.mul(0.13), float(4.4), wz.mul(0.13))).add(mx_noise_float(vec3(wx.mul(0.5), float(1.1), wz.mul(0.5))).mul(0.18));
    const vein = float(1).sub(smoothstep(float(0.0), float(0.018), abs(crackN)));
    const halo = float(1).sub(smoothstep(float(0.0), float(0.09), abs(crackN)));
    const veinMask = smoothstep(float(-0.05), float(0.35), mx_noise_float(vec3(wx.mul(0.05), float(2), wz.mul(0.05))));
    const pulse = sin(time.mul(1.4).sub(wx.mul(0.15)).sub(wz.mul(0.11))).mul(0.3).add(0.7);
    mat.colorNode = mix(mix(c, color(0x0a100d), vein.mul(veinMask)), c.mul(0.8).add(color(0x0c3022).mul(0.5)), halo.mul(veinMask).mul(0.4));
    mat.emissiveNode = color(0x3cf0a4).mul(vein.mul(veinMask).mul(pulse).mul(0.75)).add(color(0x1a8a5c).mul(halo.mul(veinMask).mul(0.12)));
    mat.roughnessNode = mix(float(0.95), float(0.7), plazaM);
  }
  return mat;
}

// 地形高度（視覺網格用；玩法本身沒有高度，可走範圍 ±25.5 內保持 0）
export function groundHeight(mapId, x, z) {
  const n = (a, b) => Math.sin(a * 0.37 + b * 0.21) * 0.5 + Math.sin(a * 0.11 - b * 0.29 + 1.7) * 0.8 + Math.sin(a * 0.71 + b * 0.53) * 0.2;
  if (mapId === 1001) {
    // 南側是河：z < −24.5 下沉成河床，對岸 z < −62 再升起
    let h = 0;
    if (z < -24.2) h = -Math.min(1.4, (-24.2 - z) * 0.55);
    if (z < -60) h = -1.4 + Math.min(2.4, (-60 - z) * 0.25) + Math.max(0, n(x, z)) * 0.8;
    const out = Math.max(Math.abs(x) - 30, z - 30, 0);
    if (z > -24 && out > 0) h += Math.min(3, out * 0.12) * (0.6 + 0.4 * Math.sin(x * 0.2));
    return h;
  }
  if (mapId === 1002) {
    const out = Math.max(Math.abs(x) - 27, Math.abs(z) - 27, 0);
    const dune = (Math.sin(x * 0.14 + z * 0.05) * 0.5 + 0.5) * 2.5 + n(x, z) * 0.9;
    return out > 0 ? Math.min(out * 0.45, 7) * (0.6 + 0.4 * dune / 3) + Math.max(0, dune) * Math.min(1, out / 6) : 0;
  }
  const out = Math.max(Math.abs(x) - 26.5, Math.abs(z) - 26.5, 0);
  return out > 0 ? Math.min(out * 0.8, 9) + n(x, z) * Math.min(1, out / 4) : 0;
}

/**
 * 河面：低粗糙度、以噪聲擾動法線，反射環境（天空）。不用 Reflector，便宜
 */
export function makeWaterMaterial({ deep = 0x1d3b3a, shallow = 0x3e5f55 } = {}) {
  const mat = new MeshStandardNodeMaterial({ roughness: 0.06, metalness: 0.0, transparent: true });
  const wx = positionWorld.x, wz = positionWorld.z;
  const t = time.mul(0.35);
  const e = 0.25;
  const h = (x, z) => mx_noise_float(vec3(x.mul(0.45).add(t), t.mul(0.6), z.mul(0.9))).mul(0.6)
    .add(mx_noise_float(vec3(x.mul(1.7).sub(t.mul(1.3)), float(3), z.mul(2.3).add(t))).mul(0.25));
  const h0 = h(wx, wz);
  const dx = h(wx.add(e), wz).sub(h0);
  const dz = h(wx, wz.add(e)).sub(h0);
  mat.normalNode = transformNormalToView(normalize(vec3(dx.mul(-1.6), float(1), dz.mul(-1.6))));
  const shore = smoothstep(float(-30), float(-24.5), wz);
  mat.colorNode = mix(color(deep), color(shallow), shore.mul(0.7));
  mat.opacityNode = mix(float(0.94), float(0.7), shore);
  return mat;
}

/**
 * 天穹：大球內面，頂色→地平線色漸層＋太陽暈。不吃霧
 */
export function makeSkyMaterial() {
  const mat = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const uTop = uniform(new THREE.Color(0x23394d));
  const uHor = uniform(new THREE.Color(0x8da69b));
  const uGround = uniform(new THREE.Color(0x4a4438));
  const uSun = uniform(new THREE.Vector3(0.4, 0.5, -0.7));
  const uSunCol = uniform(new THREE.Color(0xffd8a0));
  mat.colorNode = Fn(() => {
    const d = normalize(positionWorld.sub(cameraPosition));
    const y = d.y;
    const up = smoothstep(float(-0.02), float(0.55), y);
    const sky = mix(uHor, uTop, pow(up, float(0.7)));
    const below = smoothstep(float(0.0), float(-0.15), y);
    const s = max(dot(d, normalize(uSun)), float(0.0));
    const glow = pow(s, float(14.0)).mul(0.5).add(pow(s, float(400.0)).mul(2.5));
    const haze = mx_noise_float(d.mul(vec3(3, 9, 3))).mul(0.03);
    return mix(sky, uGround, below).add(uSunCol.mul(glow)).add(haze);
  })();
  mat.userData = { uTop, uHor, uGround, uSun, uSunCol };
  return mat;
}

/**
 * 環境反射：小場景（同一套天穹漸層）→ PMREM，金屬與河面反射天色。失敗（舊後端）就回傳 null
 */
export function makeEnvironment(renderer, { top, horizon, ground, sunDir, sunColor }) {
  try {
    const envScene = new THREE.Scene();
    const sm = makeSkyMaterial();
    sm.userData.uTop.value.set(top);
    sm.userData.uHor.value.set(horizon);
    sm.userData.uGround.value.set(ground);
    sm.userData.uSun.value.copy(sunDir);
    sm.userData.uSunCol.value.set(sunColor);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), sm);
    envScene.add(dome);
    const pmrem = new PMREMGenerator(renderer);
    const rt = pmrem.fromScene(envScene, 0.04, 0.1, 100);
    pmrem.dispose();
    dome.geometry.dispose();
    sm.dispose();
    return rt.texture;
  } catch {
    return null;
  }
}

/**
 * 引路線材質（渡口行會檢索攤位後的朱砂引路線）：朱紅虛線，沿前進方向流動
 */
export function makeGuideTrailMaterial() {
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const u = uv();
  const dash = smoothstep(float(0.15), float(0.3), u.y).mul(float(1).sub(smoothstep(float(0.7), float(0.85), u.y)));
  const side = smoothstep(float(0.0), float(0.25), u.x).mul(float(1).sub(smoothstep(float(0.75), float(1.0), u.x)));
  const wave = sin(positionWorld.x.add(positionWorld.z).mul(2.2).sub(time.mul(5.0))).mul(0.5).add(0.5);
  mat.colorNode = mix(color(0x8f2316), color(0xe0553a), wave);
  mat.opacityNode = dash.mul(side).mul(0.85);
  return mat;
}

/**
 * 刃風弧光：出招時在兵器揮動的方向劃一道彎月形光帶（uv.x 沿弧、uv.y 跨寬），uFade 由外部遞減
 */
export function makeSlashArcMaterial() {
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const uCol = uniform(new THREE.Color(0xffd166));
  const uFade = uniform(0);
  const uHead = uniform(1);
  const u = uv();
  const tail = smoothstep(uHead.sub(0.9), uHead, u.x).mul(float(1).sub(smoothstep(uHead, uHead.add(0.04), u.x)));
  const across = pow(float(1).sub(abs(u.y.sub(0.5)).mul(2)), float(1.6));
  const streak = mx_noise_float(vec3(u.x.mul(14), u.y.mul(3), time.mul(2))).mul(0.25).add(0.85);
  mat.colorNode = uCol.mul(1.6);
  mat.opacityNode = tail.mul(across).mul(streak).mul(uFade);
  mat.userData = { uCol, uFade, uHead };
  return mat;
}

/**
 * 兵器流光等級（鍛器 +7／+9／+12）：給手上兵器外圍加一層加色光暈殼
 */
export function makeWeaponAuraMaterial() {
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide });
  const uTier = uniform(0);
  const flow = sin(positionLocal.y.mul(18.0).sub(time.mul(7.0))).mul(0.5).add(0.5);
  const silver = color(0xcfe6ff);
  const gold = mix(color(0xff7a2a), color(0xffd86a), flow);
  const violet = mix(color(0x8a5cff), color(0x5ce0ff), flow);
  const c1 = smoothstep(float(0.5), float(1.0), uTier);
  const c2 = smoothstep(float(1.5), float(2.0), uTier);
  const c3 = smoothstep(float(2.5), float(3.0), uTier);
  mat.colorNode = mix(mix(silver, gold, c2), violet, c3);
  mat.opacityNode = c1.mul(flow.mul(0.35).add(0.2));
  mat.userData.uTier = uTier;
  return mat;
}

export { clamp, cos, abs };
