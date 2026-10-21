// 車輛模型：Sketchfab 的同人模型「Tesla Roadtser 2026」（asiphy007，CC BY 4.0），tools/car.mjs 減面、切出四個輪子後內嵌在頁面裡。
// 非官方同人作品，與車廠無關。主動尾翼、推進火焰、頭燈條與車燈光束是程式加上的；尾燈用貼圖裡的紅色燈條發光。
// 幾何與貼圖全部共用，材質每台各一份（烤漆不同）。
import {
  Group, Mesh, BufferAttribute, Vector3, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, BoxGeometry, Shape, ExtrudeGeometry, ConeGeometry,
  Color, CanvasTexture, AdditiveBlending, DoubleSide, SpotLight, Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loftGrid, buildParts, J } from './loft.js';
import { CAR } from '../core/const.js';

const GROUND = -CAR.REST_Y;   // 模型以地面為 y=0 建立，放進車身座標時往下移
// 車尾四根噴管（x, y）與管口的 z
const NOZ = [[-0.36, 0.29], [-0.12, 0.29], [0.12, 0.29], [0.36, 0.29]], NOZ_Z = -1.96;

export const PAINTS = [
  { id: 'pearl', name: 'Arctic Pearl', color: '#e7e5e0', metal: 0.25, rough: 0.24 },
  { id: 'titanium', name: 'Titanium', color: '#8e9196', metal: 0.85, rough: 0.3 },
  { id: 'signal', name: 'Signal Red', color: '#a8141b', metal: 0.5, rough: 0.24 },
  { id: 'obsidian', name: 'Obsidian', color: '#101012', metal: 0.45, rough: 0.2 },
  { id: 'glacier', name: 'Glacier', color: '#7fa7c2', metal: 0.6, rough: 0.26 },
  { id: 'brass', name: 'Satin Brass', color: '#a7875a', metal: 0.9, rough: 0.38 },
];

let GLB = null, SHARED = null;

// 開場時呼叫一次（和 Rapier 一起）：解開頁面內嵌的 GLB（gzip＋base64，幾何是 meshopt 壓縮、貼圖是 WebP）
export async function loadRoadster() {
  const b64 = document.getElementById('roadster-glb').textContent.trim();
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buf, '');
  gltf.scene.updateMatrixWorld(true);
  const parts = {};
  // 量化過的位置與法線（Int16／Int8）先轉回浮點，再把節點矩陣烘進幾何；輪子以 extras.c（輪心）為原點
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    for (const k of ['position', 'normal']) {
      const a = g.attributes[k], f = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
      g.setAttribute(k, new BufferAttribute(f, 3));
    }
    g.applyMatrix4(o.matrixWorld);
    const c = new Vector3().fromArray(o.userData.c || [0, 0, 0]);
    g.translate(-c.x, -c.y, -c.z);
    parts[o.name] = { geo: g, pos: c, map: o.material.map };
  });
  const tex = parts.body.map;
  tex.anisotropy = 8;
  // 輪子順序和 CAR.WHEELS 一致：左前、右前、左後、右後（車身 +X 是左側）
  GLB = { body: parts.body.geo, tex, wheels: ['FL', 'FR', 'RL', 'RR'].map((n) => parts['wheel_' + n]) };
}

function buildShared() {
  if (!GLB) throw new Error('loadRoadster() 還沒完成');
  // 主動尾翼：翼型斷面擠出、兩側端板、天鵝頸支架（收起時整片藏在後甲板下）
  const foil = new Shape();
  const chord = 0.36, th = 0.04;
  foil.moveTo(0, 0);
  for (let k = 0; k <= 16; k++) { const t = k / 16; foil.lineTo(t * chord, th * 0.7 * Math.sqrt(t) * (1 - t)); }
  for (let k = 16; k >= 0; k--) { const t = k / 16; foil.lineTo(t * chord, -th * 2.4 * Math.sqrt(t) * (1 - t)); }
  const wingGeo = new ExtrudeGeometry(foil, { depth: 1.5, bevelEnabled: false, curveSegments: 1 });
  wingGeo.translate(-chord * 0.55, 0, -0.75); wingGeo.rotateY(Math.PI / 2); // 弦沿 Z（前緣朝 +Z）
  const plate = new BoxGeometry(0.012, 0.13, 0.4);
  const plates = mergeGeometries([plate.clone().translate(0.755, 0.01, 0).toNonIndexed(), plate.clone().translate(-0.755, 0.01, 0).toNonIndexed()]);
  const strut = new BoxGeometry(0.03, 0.42, 0.09); strut.translate(0, -0.21, 0);
  // 頭燈條：引擎蓋前緣下方的黑色燈縫
  const headGeo = new BoxGeometry(0.96, 0.016, 0.02); headGeo.translate(0, 0.445, 2.335);
  // 推進火焰（加性混色的錐）
  const plume = new ConeGeometry(0.1, 1, 12, 1, true); plume.translate(0, -0.5, 0); plume.rotateX(Math.PI / 2);
  const lift = new ConeGeometry(0.16, 1, 12, 1, true); lift.translate(0, -0.5, 0);

  // 推進火焰的漸層貼圖
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 128;
  const cx = cv.getContext('2d');
  const gr = cx.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(200,230,255,.85)'); gr.addColorStop(0.5, 'rgba(120,170,255,.3)'); gr.addColorStop(1, 'rgba(80,120,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 16, 128);
  const plumeTex = new CanvasTexture(cv);

  return { ...GLB, wingGeo, plates, strut, headGeo, plume, lift, plumeTex };
}

// 車殼材質：原檔貼圖當底色。亮而不飽和的像素是車漆（乘上烤漆色、保留烘焙的明暗），
// 其餘（玻璃、輪拱、格柵）維持原色且不上金屬感；偏紅的像素是尾燈，依 uTail 自發光（踩煞車變亮）。
function shellMaterial(tex) {
  const m = new MeshPhysicalMaterial({ map: tex, metalness: 0.3, roughness: 0.35, clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 1.1 });
  const u = { uPaint: { value: new Color('#e7e5e0') }, uTail: { value: 6 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = 'uniform vec3 uPaint;\nuniform float uTail;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `
        vec4 texel = texture2D( map, vMapUv );
        float lum = dot( texel.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
        float sat = max( texel.r, max( texel.g, texel.b ) ) - min( texel.r, min( texel.g, texel.b ) );
        float paintK = smoothstep( 0.08, 0.25, lum ) * ( 1.0 - smoothstep( 0.05, 0.14, sat ) );
        float redK = smoothstep( 0.04, 0.14, texel.r - max( texel.g, texel.b ) );
        diffuseColor.rgb *= mix( texel.rgb, uPaint * min( lum / 0.55, 1.25 ), paintK );`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix( 0.5, max( roughness, 0.35 ), paintK );')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * paintK;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += texel.rgb * redK * uTail;');
  };
  m.customProgramCacheKey = () => 'rsa-shell';
  return m;
}

export class Roadster {
  constructor({ lights = false, paint = 'pearl', ghost = false } = {}) {
    if (!SHARED) SHARED = buildShared();
    const S = SHARED;
    this.group = new Group();
    const root = this.root = new Group();
    root.position.y = GROUND;
    this.group.add(root);
    this.mats = {
      shell: shellMaterial(S.tex),
      paint: new MeshPhysicalMaterial({ color: '#e7e5e0', metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 1.2 }),
      wheel: new MeshStandardMaterial({ map: S.tex, roughness: 0.55, metalness: 0.25 }),
      dark: new MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.5, metalness: 0.2 }),
      head: new MeshBasicMaterial({ color: new Color(2.4, 2.4, 2.4) }),
      plume: new MeshBasicMaterial({ map: S.plumeTex, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, color: new Color(1.6, 1.8, 2.4) }),
    };
    const M = this.mats;
    const shadow = (m) => { m.castShadow = true; return m; };
    root.add(shadow(new Mesh(S.body, M.shell)), new Mesh(S.headGeo, M.head));
    // 尾翼：收起時藏在後甲板（y≈0.85）下
    this.wing = new Group();
    this.wing.position.set(0, 0.79, -1.8);
    const foil = new Group();
    foil.add(shadow(new Mesh(S.wingGeo, M.paint)), new Mesh(S.plates, M.dark));
    this.foil = foil;
    this.wing.add(foil);
    this.struts = [];
    for (const x of [-0.42, 0.42]) { const s = new Mesh(S.strut, M.dark); s.position.set(x, 0, 0.02); this.wing.add(s); this.struts.push(s); }
    root.add(this.wing);
    // 輪子：hub 管轉向與懸吊，spin 管滾動
    this.wheels = CAR.WHEELS.map((wd, i) => {
      const W = S.wheels[i];
      const hub = new Group();
      hub.position.copy(W.pos);
      const spin = new Group();
      spin.add(shadow(new Mesh(W.geo, M.wheel)));
      hub.add(spin);
      root.add(hub);
      return { hub, spin, front: wd.front, baseY: W.pos.y, wd };
    });
    // 推進火焰：車尾四根噴管、車底四個懸停噴口
    this.plumes = NOZ.map(([x, y]) => { const m = new Mesh(S.plume, M.plume); m.position.set(x, y, NOZ_Z); m.visible = false; root.add(m); return m; });
    this.lifts = [[0.6, 1.1], [-0.6, 1.1], [0.6, -1.0], [-0.6, -1.0]].map(([x, z]) => { const m = new Mesh(S.lift, M.plume); m.position.set(x, 0.18, z); m.visible = false; root.add(m); return m; });
    if (lights) {
      this.spots = [];
      for (const x of [-0.6, 0.6]) {
        const sp = new SpotLight('#fff3e2', 0, 140, 0.42, 0.55, 2);
        sp.position.set(x, 0.5, 2.05);   // 藏在車頭殼內：放在殼外會把近在咫尺的保險桿照爆
        const tgt = new Object3D(); tgt.position.set(x * 1.6, -0.6, 22);
        root.add(sp, tgt); sp.target = tgt;
        this.spots.push(sp);
      }
    }
    this.lightMode = 1;
    this.setPaint(paint);
    if (ghost) this.makeGhost();
  }

  setPaint(id) {
    const p = PAINTS.find((q) => q.id === id) || PAINTS[0];
    this.paintId = p.id;
    const { shell, paint } = this.mats;
    shell.userData.u.uPaint.value.set(p.color);
    paint.color.set(p.color);
    for (const m of [shell, paint]) { m.metalness = p.metal; m.roughness = p.rough; }
  }

  // 幽靈車：整台換成半透明的單色材質
  makeGhost() {
    const g = new MeshBasicMaterial({ color: new Color(0.55, 0.85, 1.3), transparent: true, opacity: 0.22, depthWrite: false, blending: AdditiveBlending });
    this.group.traverse((o) => { if (o.isMesh) { o.material = g; o.castShadow = false; } });
    for (const p of [...this.plumes, ...this.lifts]) p.visible = false;
    this.ghostMat = g;
  }

  setLights(mode) {
    this.lightMode = mode;
    const k = mode === 0 ? 0.15 : mode === 1 ? 0.6 : 1.1;
    this.mats.head.color.setScalar(2.4 * k);
    if (this.spots) for (const s of this.spots) { s.intensity = mode === 0 ? 0 : mode === 1 ? 160 : 420; s.angle = mode === 2 ? 0.5 : 0.4; }
  }

  // 每幀：由車輛狀態更新輪子、尾翼、燈與噴焰
  update(st, dt, time = 0) {
    for (const w of this.wheels) {
      w.spin.rotation.x = st.spin || 0;
      if (w.front) w.hub.rotation.y = -(st.steerVis || 0);
      const comp = st.wheels ? (st.wheels[CAR.WHEELS.indexOf(w.wd)]?.comp ?? 0.1) : 0.1;
      w.hub.position.y = w.baseY + (st.wheels ? Math.min(0.12, comp - 0.1) : 0);
    }
    const wh = st.wingH ?? 0, wa = st.wingA ?? 0;
    this.foil.position.y = -0.035 + wh * 0.42;
    this.foil.rotation.x = wa * 0.95;
    for (const s of this.struts) { s.position.y = this.foil.position.y; s.scale.y = Math.max(0.05, wh); s.visible = wh > 0.04; }
    const brake = st.braking || (st.input && st.input.throttle < 0 && st.vf > 1);
    this.mats.shell.userData.u.uTail.value = brake ? 16 : 6;
    if (!this.ghostMat) {
      const flick = 0.85 + Math.sin(time * 61) * 0.08 + Math.sin(time * 37) * 0.07;
      for (const p of this.plumes) { p.visible = !!st.boosting; p.scale.set(1, 1, (1.1 + Math.random() * 0.5) * flick); }
      for (const p of this.lifts) { p.visible = !!st.hovering; p.scale.set(1, (0.9 + Math.random() * 0.5) * flick, 1); }
    }
  }
}

// 停放的車（一排車）：同樣放樣，車頂方一點的轎跑，不分門
const SEDAN = [
  { z: 2.3, hw: 0.8, yb: 0.25, ys: 0.45, shx: 0.75, ysh: 0.68, fx: 0.4, fy: 0.72, yt: 0.73 },
  { z: 1.9, hw: 0.92, yb: 0.2, ys: 0.55, shx: 0.88, ysh: 0.85, fx: 0.55, fy: 0.9, yt: 0.9 },
  { z: 1.0, hw: 0.94, yb: 0.2, ys: 0.56, shx: 0.88, ysh: 0.92, fx: 0.6, fy: 0.97, yt: 0.98 },
  { z: 0.4, hw: 0.94, yb: 0.2, ys: 0.56, shx: 0.8, ysh: 0.98, fx: 0.7, fy: 1.35, yt: 1.42 },
  { z: -0.8, hw: 0.94, yb: 0.2, ys: 0.56, shx: 0.8, ysh: 1.0, fx: 0.7, fy: 1.36, yt: 1.42 },
  { z: -1.6, hw: 0.93, yb: 0.22, ys: 0.58, shx: 0.86, ysh: 0.98, fx: 0.55, fy: 1.04, yt: 1.05 },
  { z: -2.3, hw: 0.85, yb: 0.3, ys: 0.6, shx: 0.8, ysh: 0.92, fx: 0.45, fy: 0.95, yt: 0.95 },
];
let SEDAN_GEO = null;
export function sedanGeometry() {
  if (SEDAN_GEO) return SEDAN_GEO;
  const { grid } = loftGrid(SEDAN, 48);
  const parts = buildParts(grid, (i, j) => {
    const z = grid[i][0][2];
    return { part: 'b', mat: z < 0.9 && z > -1.5 && j >= J.D ? 'glass' : 'paint' };
  });
  SEDAN_GEO = parts.b;
  return SEDAN_GEO;
}
