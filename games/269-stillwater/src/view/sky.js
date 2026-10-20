// 早／午／黃昏三時段光影：太陽方向與顏色、天光、霧（早上有晨霧）、水色、焦散強度、黃昏點燈。
// 時鐘（分鐘）連續變化，時段交界前後各 25 分鐘平滑過渡。
import * as THREE from 'three';
import { U } from './shared.js';

const P = {
  am: {
    sunAz: 115, sunEl: 20, sun: '#ffd6a0', sunI: 2.1, sky: '#c6dae2', ground: '#5e6a48', hemiI: 1.05,
    fog: '#cbd9d8', fogD: 0.0105, bg: '#cbd9d8', caust: 0.6,
    shallow: '#9fd3b6', mid: '#58a197', deep: '#2f6c70', dusk: 0, mist: 1,
  },
  pm: {
    sunAz: 200, sunEl: 58, sun: '#fff1dc', sunI: 2.9, sky: '#d3e6ee', ground: '#6b7a4c', hemiI: 0.95,
    fog: '#c9dde2', fogD: 0.0045, bg: '#c9dde2', caust: 1.0,
    shallow: '#9ad9b4', mid: '#4ea596', deep: '#2a6a70', dusk: 0, mist: 0,
  },
  dusk: {
    sunAz: 285, sunEl: 10, sun: '#ff9f62', sunI: 2.2, sky: '#d6ae92', ground: '#5a4a3c', hemiI: 1.0,
    fog: '#d9a483', fogD: 0.0075, bg: '#d9a483', caust: 0.32,
    shallow: '#b8ad86', mid: '#5f8578', deep: '#30525a', dusk: 1, mist: 0.25,
  },
};
const KEYS = ['am', 'pm', 'dusk'];
const col = {}, num = {};
for (const k of KEYS) {
  col[k] = {}; num[k] = {};
  for (const [f, v] of Object.entries(P[k])) (typeof v === 'string' ? col[k] : num[k])[f] = typeof v === 'string' ? new THREE.Color(v) : v;
}

// 由時鐘算三時段的權重（am, pm, dusk）
export function weights(min) {
  const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const toPm = ss(635, 685, min), toDusk = ss(995, 1045, min), toAm = ss(1160, 1200, min) * 0;   // 20:00 直接換日
  return [1 - toPm, toPm * (1 - toDusk), toDusk * (1 - toAm)];
}

export function createSky(scene, renderer) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  const S = sun.shadow;
  S.mapSize.set(2048, 2048);
  S.camera.left = -34; S.camera.right = 34; S.camera.top = 34; S.camera.bottom = -34; S.camera.near = 1; S.camera.far = 160;
  S.bias = -0.0006; S.normalBias = 0.04;
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.FogExp2(0xffffff, 0.006);
  const bg = new THREE.Color();
  scene.background = bg;
  const tmp = new THREE.Color();
  const mixC = (w, f) => { tmp.setRGB(0, 0, 0); KEYS.forEach((k, i) => { tmp.r += col[k][f].r * w[i]; tmp.g += col[k][f].g * w[i]; tmp.b += col[k][f].b * w[i]; }); return tmp; };
  const mixN = (w, f) => KEYS.reduce((s, k, i) => s + num[k][f] * w[i], 0);
  const state = { mist: 0, dusk: 0, sunEl: 30 };
  return {
    sun, hemi, state,
    update(min, focus) {
      const w = weights(min);
      // 太陽方位角：用單位向量混合，避免 200° → 285° 繞遠路
      let vx = 0, vz = 0;
      KEYS.forEach((k, i) => { const a = THREE.MathUtils.degToRad(num[k].sunAz); vx += Math.sin(a) * w[i]; vz += -Math.cos(a) * w[i]; });
      const az = Math.atan2(vx, -vz), el = THREE.MathUtils.degToRad(mixN(w, 'sunEl'));
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
      U.uSunDir.value.copy(dir);
      sun.position.copy(focus).addScaledVector(dir, 80);
      sun.target.position.copy(focus);
      sun.color.copy(mixC(w, 'sun')); sun.intensity = mixN(w, 'sunI');
      U.uSunCol.value.copy(sun.color).multiplyScalar(Math.min(1.2, sun.intensity / 2.4));
      hemi.color.copy(mixC(w, 'sky')); hemi.groundColor.copy(mixC(w, 'ground')); hemi.intensity = mixN(w, 'hemiI');
      U.uSkyCol.value.copy(hemi.color);
      scene.fog.color.copy(mixC(w, 'fog')); scene.fog.density = mixN(w, 'fogD');
      bg.copy(mixC(w, 'bg'));
      U.uCaust.value = mixN(w, 'caust');
      U.uWaterShallow.value.copy(mixC(w, 'shallow'));
      U.uWaterMid.value.copy(mixC(w, 'mid'));
      U.uWaterDeep.value.copy(mixC(w, 'deep'));
      state.dusk = mixN(w, 'dusk'); state.mist = mixN(w, 'mist'); state.sunEl = mixN(w, 'sunEl');
      U.uDusk.value = state.dusk;
      renderer.toneMappingExposure = 1.12 + state.dusk * 0.12;
      return w;
    },
  };
}
