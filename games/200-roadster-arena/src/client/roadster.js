// 車輛模型：程序放樣的低趴雙門跑車（粉絲創作，造型原創，與任何車廠無關）。
// 鷗翼門、主動尾翼、前下擾流、冷氣推進噴口、LED 燈條、渦輪輪框。幾何全部共用，材質每台各一份（塗裝不同）。
import {
  Group, Mesh, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, BufferGeometry, Float32BufferAttribute,
  CylinderGeometry, BoxGeometry, LatheGeometry, TorusGeometry, Shape, ExtrudeGeometry, TubeGeometry, CatmullRomCurve3,
  Vector2, Vector3, Color, CanvasTexture, SRGBColorSpace, AdditiveBlending, DoubleSide, BackSide, ConeGeometry, SpotLight, Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loftGrid, buildParts, J } from './loft.js';
import { CAR } from '../core/const.js';

const flat = (g) => (g.index ? g.toNonIndexed() : g);   // mergeGeometries 要求全部同為有／無索引
const GROUND = -CAR.REST_Y;   // 模型以地面為 y=0 建立，放進車身座標時往下移

// 斷面表（z 由車頭到車尾）：hw 半寬、yb 底、ys 最寬處高、shx/ysh 肩線、fx/fy 上緣、yt 頂中心
const ST = [
  { z: 2.17, hw: 0.74, yb: 0.24, ys: 0.33, shx: 0.66, ysh: 0.41, fx: 0.38, fy: 0.445, yt: 0.45 },
  { z: 2.08, hw: 0.9, yb: 0.17, ys: 0.36, shx: 0.84, ysh: 0.52, fx: 0.52, fy: 0.55, yt: 0.555 },
  { z: 1.8, hw: 0.97, yb: 0.14, ys: 0.41, shx: 0.92, ysh: 0.7, fx: 0.6, fy: 0.665, yt: 0.635 },
  { z: 1.38, hw: 1.0, yb: 0.14, ys: 0.45, shx: 0.94, ysh: 0.8, fx: 0.6, fy: 0.73, yt: 0.68 },
  { z: 0.95, hw: 0.985, yb: 0.13, ys: 0.45, shx: 0.91, ysh: 0.735, fx: 0.6, fy: 0.74, yt: 0.73 },
  { z: 0.82, hw: 0.97, yb: 0.13, ys: 0.445, shx: 0.87, ysh: 0.75, fx: 0.62, fy: 0.79, yt: 0.785 },
  { z: 0.45, hw: 0.955, yb: 0.13, ys: 0.44, shx: 0.81, ysh: 0.775, fx: 0.67, fy: 0.95, yt: 0.975 },
  { z: 0.05, hw: 0.95, yb: 0.13, ys: 0.44, shx: 0.77, ysh: 0.795, fx: 0.63, fy: 1.06, yt: 1.11 },
  { z: -0.4, hw: 0.97, yb: 0.13, ys: 0.45, shx: 0.77, ysh: 0.815, fx: 0.62, fy: 1.05, yt: 1.1 },
  { z: -0.9, hw: 1.01, yb: 0.14, ys: 0.46, shx: 0.84, ysh: 0.84, fx: 0.62, fy: 0.935, yt: 0.95 },
  { z: -1.3, hw: 1.035, yb: 0.15, ys: 0.47, shx: 0.93, ysh: 0.87, fx: 0.62, fy: 0.85, yt: 0.83 },
  { z: -1.75, hw: 1.0, yb: 0.18, ys: 0.48, shx: 0.92, ysh: 0.83, fx: 0.6, fy: 0.78, yt: 0.76 },
  { z: -2.03, hw: 0.94, yb: 0.24, ys: 0.5, shx: 0.86, ysh: 0.77, fx: 0.56, fy: 0.715, yt: 0.7 },
  { z: -2.14, hw: 0.85, yb: 0.3, ys: 0.52, shx: 0.78, ysh: 0.69, fx: 0.5, fy: 0.65, yt: 0.64 },
];
const ARCHES = [{ z: 1.38, y: 0.355, r: 0.43 }, { z: -1.3, y: 0.37, r: 0.445 }];
const CABIN = [0.84, -1.0];       // 玻璃罩範圍
const DOOR = [0.8, -0.6];         // 鷗翼門範圍
const DOOR_J = 7;                 // 門的下緣（斷面點序）
export const HINGE = { y: 1.105 };

export const PAINTS = [
  { id: 'pearl', name: 'Arctic Pearl', color: '#e7e5e0', metal: 0.25, rough: 0.24 },
  { id: 'titanium', name: 'Titanium', color: '#8e9196', metal: 0.85, rough: 0.3 },
  { id: 'signal', name: 'Signal Red', color: '#a8141b', metal: 0.5, rough: 0.24 },
  { id: 'obsidian', name: 'Obsidian', color: '#101012', metal: 0.45, rough: 0.2 },
  { id: 'glacier', name: 'Glacier', color: '#7fa7c2', metal: 0.6, rough: 0.26 },
  { id: 'brass', name: 'Satin Brass', color: '#a7875a', metal: 0.9, rough: 0.38 },
];
export const LIVERIES = [
  { id: 'clean', name: 'Clean' },
  { id: 'stripe', name: 'Twin Stripe' },
  { id: 'stunt', name: 'Stunt' },
];

let SHARED = null;

function buildShared() {
  const { grid, params } = loftGrid(ST, 150);
  const R = grid.length;
  // 輪拱：圓周附近的側面頂點吸到圓上，圓內的面不畫；另外補一圈輪拱內襯
  for (let i = 0; i < R; i++) {
    for (let j = 0; j <= J.D; j++) {
      const p = grid[i][j];
      if (p[0] < 0.88 * params[i].hw) continue;
      for (const a of ARCHES) {
        const dz = p[2] - a.z, dy = p[1] - a.y, d = Math.hypot(dz, dy);
        if (d > a.r - 0.06 && d < a.r + 0.05) { p[2] = a.z + dz / d * a.r; p[1] = a.y + dy / d * a.r; }
      }
    }
  }
  const inArchFace = (i, j) => {
    if (j > J.D) return false;
    let z = 0, y = 0, x = 0;
    for (const [ii, jj] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) { z += grid[ii][jj][2]; y += grid[ii][jj][1]; x += grid[ii][jj][0]; }
    z /= 4; y /= 4; x /= 4;
    if (x < 0.45) return false;
    // 只挖側面（法線大致朝外），翼子板頂面不挖
    const a0 = grid[i][j], a1 = grid[i + 1][j], a2 = grid[i][j + 1];
    const ux = a1[0] - a0[0], uy = a1[1] - a0[1], uz = a1[2] - a0[2], vx = a2[0] - a0[0], vy = a2[1] - a0[1], vz = a2[2] - a0[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (Math.abs(nx) < 0.55 * Math.hypot(nx, ny, nz)) return false;
    return ARCHES.some((a) => Math.hypot(z - a.z, y - a.y) < a.r - 0.004);
  };
  const zMid = (i) => (grid[i][0][2] + grid[i + 1][0][2]) / 2;
  const classify = (i, j) => {
    if (inArchFace(i, j)) return null;
    const z = zMid(i);
    const door = z < DOOR[0] && z > DOOR[1] && j >= DOOR_J;
    const glass = z < CABIN[0] && z > CABIN[1] && j >= J.D;
    let mat = 'paint';
    if (glass) mat = 'glass';
    else if (j < J.B) mat = 'under';
    else if (j < J.B + 2) mat = 'trim';
    return { part: door ? 'door' : 'body', mat };
  };
  // 內襯：沿輪拱圓周，從車身側面往內 0.42 m
  const sideX = (z, y) => {
    let best = 0;
    for (let i = 0; i < R; i++) if (Math.abs(grid[i][0][2] - z) < Math.abs(grid[best][0][2] - z)) best = i;
    const row = grid[best];
    for (let j = 0; j < J.D; j++) if ((row[j][1] - y) * (row[j + 1][1] - y) <= 0) {
      const t = (y - row[j][1]) / ((row[j + 1][1] - row[j][1]) || 1);
      return row[j][0] + (row[j + 1][0] - row[j][0]) * t;
    }
    return row[J.C][0];
  };
  const liner = [];
  for (const a of ARCHES) {
    const tm = Math.acos(Math.max(-1, (0.16 - a.y) / a.r));
    const n = 28, pos = [], idx = [];
    for (let k = 0; k <= n; k++) {
      const th = -tm + 2 * tm * k / n;
      const z = a.z + Math.sin(th) * a.r, y = a.y + Math.cos(th) * a.r;
      const xo = sideX(z, y) - 0.004;
      pos.push(xo, y, z, 0.5, y, z);
    }
    for (let k = 0; k < n; k++) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    liner.push(g, g.clone().scale(-1, 1, 1));
  }
  const linerGeo = mergeGeometries(liner.map(flat));
  const parts = buildParts(grid, classify);
  // 門：左右分開（x>0 是左門），各自以鉸鏈軸為原點
  const doorG = parts.door.geometry;
  const splitDoor = (sgn) => {
    const g = doorG.clone();
    const pos = g.attributes.position;
    const idx = g.index.array;
    const groups = g.groups.map((gr) => ({ ...gr }));
    const newIdx = [];
    const newGroups = [];
    for (const gr of groups) {
      const start = newIdx.length;
      for (let k = gr.start; k < gr.start + gr.count; k += 3) {
        const a = idx[k], b = idx[k + 1], c = idx[k + 2];
        const cx = pos.getX(a) + pos.getX(b) + pos.getX(c);
        if (cx * sgn > 0) newIdx.push(a, b, c);
      }
      newGroups.push({ start, count: newIdx.length - start, materialIndex: gr.materialIndex });
    }
    g.setIndex(newIdx);
    g.clearGroups();
    for (const gr of newGroups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    // 門板往內縮 4 mm，留出門縫
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const nx = g.attributes.normal.getX(k), ny = g.attributes.normal.getY(k), nz = g.attributes.normal.getZ(k);
      pos.setXYZ(k, x - nx * 0.004, y - ny * 0.004 - HINGE.y, z - nz * 0.004);
    }
    pos.needsUpdate = true;
    return g;
  };
  const doorL = splitDoor(1), doorR = splitDoor(-1);

  // 車頭、車尾封面（車尾下半部是黑色擴散器面板）
  const capGeo = (i, zOff, split = -1) => {
    const row = grid[i];
    const up = [], lo = [];
    const cy = row.reduce((s, p) => s + p[1], 0) / row.length;
    const cz = row[0][2] + zOff;
    const ring = [...row.map((p) => [p[0], p[1], p[2]]), ...row.slice(0, -1).reverse().map((p) => [-p[0], p[1], p[2]])];
    for (let k = 0; k < ring.length - 1; k++) {
      const a = ring[k], b = ring[k + 1];
      const dst = (a[1] + b[1]) / 2 < split ? lo : up;
      if (zOff > 0) dst.push(0, cy, cz, ...a, ...b); else dst.push(0, cy, cz, ...b, ...a);
    }
    const mk = (pos) => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
    return [mk(up), mk(lo)];
  };
  const [noseCap] = capGeo(0, 0.012);
  const [tailCap, tailLow] = capGeo(R - 1, -0.006, 0.5);
  // 車內：桶型座椅、弧形儀表台、中央通道、方向盤（yoke）、中控螢幕；鷗翼門打開時看得到
  const interior = [];
  // 側面輪廓（z, y）沿 x 擠出，倒角讓邊緣圓潤
  const extrudeX = (pts, width, x0, bevel = 0.035) => {
    const sh = new Shape(pts.map(([z, y]) => new Vector2(z, y)));
    const g = new ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 });
    g.rotateY(-Math.PI / 2);
    g.translate(x0 + width / 2 - bevel, 0, 0);
    return g;
  };
  const seatProfile = [[0.08, 0.24], [0.1, 0.35], [-0.3, 0.33], [-0.44, 0.36], [-0.62, 0.86], [-0.66, 0.99], [-0.76, 1.0], [-0.78, 0.9], [-0.62, 0.42], [-0.52, 0.24]];
  for (const sx of [0.37, -0.37]) {
    interior.push(extrudeX(seatProfile, 0.44, sx));
    // 側翼：比座墊高一點的兩片
    const wing = [[-0.1, 0.32], [-0.1, 0.44], [-0.4, 0.42], [-0.56, 0.8], [-0.66, 0.84], [-0.6, 0.36]];
    for (const dx of [-0.2, 0.2]) interior.push(extrudeX(wing, 0.07, sx + dx));
  }
  interior.push(extrudeX([[0.98, 0.6], [0.98, 0.7], [0.62, 0.79], [0.42, 0.74], [0.4, 0.6], [0.6, 0.5]], 1.62, 0, 0.04));
  interior.push(extrudeX([[0.45, 0.62], [0.42, 0.7], [-0.4, 0.42], [-0.45, 0.2], [0.3, 0.2]], 0.2, 0, 0.03));
  const interiorGeo = mergeGeometries(interior.map(flat));
  const yoke = mergeGeometries([
    new TorusGeometry(0.16, 0.022, 8, 24, Math.PI * 1.2).rotateZ(-Math.PI * 0.1 + Math.PI).translate(0.37, 0.8, 0.34).toNonIndexed(),
    new CylinderGeometry(0.025, 0.03, 0.22, 10).rotateX(Math.PI / 2 - 0.35).translate(0.37, 0.76, 0.43).toNonIndexed(),
  ]);
  const screen = new BoxGeometry(0.3, 0.17, 0.012); screen.rotateX(-0.45); screen.translate(0, 0.86, 0.56);

  // 輪子：胎、輪框（10 片渦輪葉）、碟盤、卡鉗
  const wheel = (r, w) => {
    const prof = [[r - 0.1, -w / 2], [r - 0.025, -w / 2], [r, -w / 2 + 0.03], [r, w / 2 - 0.03], [r - 0.025, w / 2], [r - 0.1, w / 2]].map(([a, b]) => new Vector2(a, b));
    const tire = new LatheGeometry(prof, 40); tire.rotateZ(Math.PI / 2);
    const parts2 = [];
    const barrel = new CylinderGeometry(r - 0.105, r - 0.105, w * 0.92, 36, 1, true); barrel.rotateZ(Math.PI / 2);
    parts2.push(barrel);
    const lip = new TorusGeometry(r - 0.1, 0.012, 6, 40); lip.rotateY(Math.PI / 2); lip.translate(w / 2 - 0.01, 0, 0);
    parts2.push(lip);
    for (let k = 0; k < 10; k++) {
      const sp = new BoxGeometry(0.022, r - 0.16, 0.05);
      sp.translate(0, (r - 0.16) / 2 + 0.055, 0);
      sp.rotateY(0.45);
      sp.rotateX((k / 10) * Math.PI * 2);
      sp.translate(w / 2 - 0.04, 0, 0);
      parts2.push(sp);
    }
    const hub = new CylinderGeometry(0.07, 0.08, 0.06, 20); hub.rotateZ(Math.PI / 2); hub.translate(w / 2 - 0.04, 0, 0);
    parts2.push(hub);
    const rim = mergeGeometries(parts2.map(flat));
    const disc = new CylinderGeometry(r - 0.15, r - 0.15, 0.03, 32); disc.rotateZ(Math.PI / 2); disc.translate(w / 2 - 0.12, 0, 0);
    const caliper = new BoxGeometry(0.06, 0.14, 0.2); caliper.translate(w / 2 - 0.09, 0.13, -0.06);
    return { tire, rim, disc, caliper };
  };
  const wheelF = wheel(CAR.WHEELS[0].r, 0.27), wheelR = wheel(CAR.WHEELS[2].r, 0.32);

  // 主動尾翼：翼型斷面擠出、兩側端板、天鵝頸支架
  const foil = new Shape();
  const chord = 0.36, th = 0.04;
  foil.moveTo(0, 0);
  for (let k = 0; k <= 16; k++) { const t = k / 16; foil.lineTo(t * chord, th * 0.7 * Math.sqrt(t) * (1 - t)); }
  for (let k = 16; k >= 0; k--) { const t = k / 16; foil.lineTo(t * chord, -th * 2.4 * Math.sqrt(t) * (1 - t)); }
  const wingGeo = new ExtrudeGeometry(foil, { depth: 1.66, bevelEnabled: false, curveSegments: 1 });
  wingGeo.translate(-chord * 0.55, 0, -0.83); wingGeo.rotateY(Math.PI / 2); // 弦沿 Z（前緣朝 +Z）
  const plate = new BoxGeometry(0.012, 0.13, 0.4);
  const plates = mergeGeometries([plate.clone().translate(0.835, 0.01, 0).toNonIndexed(), plate.clone().translate(-0.835, 0.01, 0).toNonIndexed()]);
  const strut = new BoxGeometry(0.03, 0.42, 0.09); strut.translate(0, -0.21, 0);

  // 燈條：頭燈沿車頭兩角、尾燈橫貫車尾
  const ringAt = (z) => { let best = 0; for (let i = 0; i < R; i++) if (Math.abs(grid[i][0][2] - z) < Math.abs(grid[best][0][2] - z)) best = i; return grid[best]; };
  const head = [];
  {
    const row = ringAt(2.02);
    const pts = [];
    for (let j = J.C + 2; j <= J.D + 3; j++) pts.push(new Vector3(row[j][0] * 0.995, row[j][1] + 0.004, row[j][2] + 0.035));
    const c = new CatmullRomCurve3(pts);
    const t1 = new TubeGeometry(c, 20, 0.011, 5, false);
    head.push(t1, t1.clone().scale(-1, 1, 1));
  }
  const headGeo = mergeGeometries(head.map(flat));
  const tailPts = [];
  for (let k = 0; k <= 24; k++) {
    const x = -0.94 + 1.88 * k / 24, ax = Math.abs(x);
    tailPts.push(new Vector3(x, 0.69, -2.152 + (ax > 0.7 ? (ax - 0.7) * (ax - 0.7) * 2.6 : 0)));
  }
  const tailGeo = new TubeGeometry(new CatmullRomCurve3(tailPts), 48, 0.016, 5, false);

  // 噴口：車尾四根冷氣推進管、車側兩個側推口
  const nozzles = [];
  const NOZ = [[-0.4, 0.42], [-0.14, 0.4], [0.14, 0.4], [0.4, 0.42]];
  for (const [x, y] of NOZ) {
    const n = new CylinderGeometry(0.06, 0.07, 0.14, 20, 1, true); n.rotateX(Math.PI / 2); n.translate(x, y, -2.16);
    nozzles.push(n);
  }
  const nozGeo = mergeGeometries(nozzles.map(flat));
  const nozInner = [];
  for (const [x, y] of NOZ) { const d = new CylinderGeometry(0.05, 0.05, 0.01, 16); d.rotateX(Math.PI / 2); d.translate(x, y, -2.13); nozInner.push(d); }
  const nozInnerGeo = mergeGeometries(nozInner.map(flat));
  // 擴散器鰭片、前下擾流板
  const diff = [];
  for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) { const f = new BoxGeometry(0.02, 0.1, 0.42); f.translate(x, 0.27, -1.95); diff.push(f); }
  const dplate = new BoxGeometry(1.42, 0.02, 0.5); dplate.rotateX(-0.12); dplate.translate(0, 0.32, -1.93);
  diff.push(dplate);
  const lip = new BoxGeometry(1.7, 0.02, 0.22); lip.translate(0, 0.14, 2.06);
  diff.push(lip);
  const intake = new BoxGeometry(1.1, 0.12, 0.05); intake.translate(0, 0.28, 2.15);
  diff.push(intake);
  const darkGeo = mergeGeometries(diff.map(flat));
  // 前擾流的主動翼片（左右各一，下壓模式時翻下）
  const flap = new BoxGeometry(0.5, 0.012, 0.16); flap.translate(0, 0, 0.08);
  // 攝影機後視鏡（裝在門上）
  const mirror = mergeGeometries([
    new BoxGeometry(0.03, 0.03, 0.12).translate(0.06, 0, 0).toNonIndexed(),
    new BoxGeometry(0.09, 0.05, 0.07).translate(0.12, 0.0, -0.02).toNonIndexed(),
  ]);
  // 推進火焰（加性混色的錐）
  const plume = new ConeGeometry(0.16, 1, 12, 1, true); plume.translate(0, -0.5, 0); plume.rotateX(Math.PI / 2);
  const lift = new ConeGeometry(0.16, 1, 12, 1, true); lift.translate(0, -0.5, 0);

  // 推進火焰的漸層貼圖
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 128;
  const cx = cv.getContext('2d');
  const gr = cx.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(200,230,255,.85)'); gr.addColorStop(0.5, 'rgba(120,170,255,.3)'); gr.addColorStop(1, 'rgba(80,120,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 16, 128);
  const plumeTex = new CanvasTexture(cv);

  return {
    body: parts.body, linerGeo, doorL, doorR, doorMats: parts.door.mats, noseCap, tailCap, tailLow,
    interiorGeo, yoke, screen, wheelF, wheelR, wingGeo, plates, strut, headGeo, tailGeo, nozGeo, nozInnerGeo, darkGeo, flap, mirror, plume, lift, plumeTex,
    params, grid, NOZ,
  };
}

function liveryTexture(paint, livery) {
  if (livery === 'clean') return null;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = paint.color; x.fillRect(0, 0, 1024, 512);
  // u：車頭→車尾（0..4.31 m）；v：從車頂中線沿斷面往下量的弧長，左右正負（中線在 256）
  const V = (m) => 256 + m * 512 / 4.2, U = (m) => m * 1024 / 4.31;
  const light = new Color(paint.color).getHSL({}).l > 0.45;
  const ink = light ? '#141416' : '#ece9e3';
  if (livery === 'stripe') {
    x.fillStyle = ink;
    for (const s of [1, -1]) { const a = V(s * 0.05), b = V(s * 0.25); x.fillRect(0, Math.min(a, b), 1024, Math.abs(b - a)); }
  } else if (livery === 'stunt') {
    for (const s of [-1, 1]) {
      x.fillStyle = ink;
      x.beginPath();
      x.moveTo(U(0.9), V(s * 1.45)); x.lineTo(U(3.25), V(s * 1.12)); x.lineTo(U(3.6), V(s * 1.26)); x.lineTo(U(1.3), V(s * 1.62)); x.closePath(); x.fill();
      x.save(); x.translate(U(2.05), V(s * 0.98)); x.scale(1, s > 0 ? 1 : -1);
      x.font = 'italic 900 118px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('27', 0, 0); x.restore();
      x.fillStyle = '#b0181e';
      x.beginPath(); x.moveTo(U(1.05), V(s * 1.62)); x.lineTo(U(3.5), V(s * 1.31)); x.lineTo(U(3.62), V(s * 1.36)); x.lineTo(U(1.15), V(s * 1.68)); x.closePath(); x.fill();
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(1 / 4.31, 1 / 4.2); t.offset.set(0, 0.5);
  return t;
}

export class Roadster {
  constructor({ lights = false, paint = 'pearl', livery = 'clean', ghost = false } = {}) {
    if (!SHARED) SHARED = buildShared();
    const S = SHARED;
    this.group = new Group();
    const root = this.root = new Group();
    root.position.y = GROUND;
    this.group.add(root);
    this.mats = {
      paint: new MeshPhysicalMaterial({ color: '#e7e5e0', metalness: 0.3, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 1.2 }),
      glass: new MeshPhysicalMaterial({ color: '#08090b', metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.72, envMapIntensity: 1.6 }),
      well: new MeshStandardMaterial({ color: '#060606', roughness: 0.9, side: DoubleSide }),
      under: new MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.8 }),
      trim: new MeshStandardMaterial({ color: '#151517', roughness: 0.45, metalness: 0.3 }),
      inside: new MeshStandardMaterial({ color: '#141312', roughness: 0.85, side: BackSide }),
      seat: new MeshStandardMaterial({ color: '#2a2725', roughness: 0.7 }),
      tire: new MeshStandardMaterial({ color: '#121212', roughness: 0.92 }),
      rim: new MeshStandardMaterial({ color: '#b9bcc0', metalness: 0.9, roughness: 0.28 }),
      disc: new MeshStandardMaterial({ color: '#3b3b3e', metalness: 0.8, roughness: 0.4 }),
      caliper: new MeshStandardMaterial({ color: '#b3151c', roughness: 0.4 }),
      head: new MeshBasicMaterial({ color: new Color(2.4, 2.4, 2.4) }),
      tail: new MeshBasicMaterial({ color: new Color(2.4, 0.08, 0.06) }),
      noz: new MeshStandardMaterial({ color: '#9a9ea3', metalness: 0.95, roughness: 0.2, side: DoubleSide }),
      nozIn: new MeshBasicMaterial({ color: '#000000' }),
      dark: new MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.5, metalness: 0.2 }),
      screen: new MeshBasicMaterial({ color: new Color(0.16, 0.24, 0.34) }),
      plume: new MeshBasicMaterial({ map: S.plumeTex, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, color: new Color(1.6, 1.8, 2.4) }),
    };
    const M = this.mats;
    const mat = (names) => names.map((n) => M[n]);
    const shadow = (m) => { m.castShadow = true; return m; };
    root.add(shadow(new Mesh(S.body.geometry, mat(S.body.mats))));
    root.add(new Mesh(S.body.geometry, M.inside), new Mesh(S.linerGeo, M.well));
    root.add(new Mesh(S.noseCap, M.paint), new Mesh(S.tailCap, M.paint), new Mesh(S.tailLow, M.dark));
    root.add(new Mesh(S.interiorGeo, M.seat), new Mesh(S.yoke, M.dark), new Mesh(S.screen, M.screen));
    root.add(new Mesh(S.headGeo, M.head), new Mesh(S.tailGeo, M.tail));
    root.add(new Mesh(S.nozGeo, M.noz), new Mesh(S.nozInnerGeo, M.nozIn), new Mesh(S.darkGeo, M.dark));
    // 鷗翼門：鉸鏈沿車頂中線
    this.doors = [];
    for (const [g, sgn] of [[S.doorL, 1], [S.doorR, -1]]) {
      const pivot = new Group();
      pivot.position.set(0, HINGE.y, 0);
      const dm = shadow(new Mesh(g, mat(S.doorMats)));
      pivot.add(dm, new Mesh(g, M.inside));
      const mir = new Mesh(S.mirror, M.dark);
      mir.position.set(sgn * 0.84, 0.82 - HINGE.y, 0.62); mir.scale.x = sgn;
      pivot.add(mir);
      root.add(pivot);
      this.doors.push({ pivot, sgn });
    }
    this.doorT = 0;
    // 尾翼
    this.wing = new Group();
    this.wing.position.set(0, 0.79, -1.82);
    const foil = new Group();
    foil.add(shadow(new Mesh(S.wingGeo, M.paint)), new Mesh(S.plates, M.dark));
    this.foil = foil;
    this.wing.add(foil);
    this.struts = [];
    for (const x of [-0.45, 0.45]) { const s = new Mesh(S.strut, M.dark); s.position.set(x, 0, 0.02); this.wing.add(s); this.struts.push(s); }
    root.add(this.wing);
    // 前擾流翼片
    this.flaps = [];
    for (const x of [-0.5, 0.5]) { const f = new Mesh(S.flap, M.dark); f.position.set(x, 0.16, 1.98); root.add(f); this.flaps.push(f); }
    // 輪子
    this.wheels = CAR.WHEELS.map((wd) => {
      const W = wd.front ? S.wheelF : S.wheelR;
      const hub = new Group();
      hub.position.set(wd.x, wd.r, wd.z);
      const spin = new Group();
      const side = wd.x > 0 ? 1 : -1;
      const tire = shadow(new Mesh(W.tire, M.tire)), rim = new Mesh(W.rim, M.rim);
      spin.add(tire, rim);
      spin.scale.x = side;
      const disc = new Mesh(W.disc, M.disc), cal = new Mesh(W.caliper, M.caliper);
      disc.scale.x = side; cal.scale.x = side;
      hub.add(spin, disc, cal);
      root.add(hub);
      return { hub, spin, front: wd.front, r: wd.r, baseY: wd.r, wd };
    });
    // 推進火焰
    this.plumes = S.NOZ.map(([x, y]) => { const m = new Mesh(S.plume, M.plume); m.position.set(x, y, -2.2); m.visible = false; root.add(m); return m; });
    this.lifts = [[0.6, 1.1], [-0.6, 1.1], [0.6, -1.0], [-0.6, -1.0]].map(([x, z]) => { const m = new Mesh(S.lift, M.plume); m.position.set(x, 0.18, z); m.visible = false; root.add(m); return m; });
    if (lights) {
      this.spots = [];
      for (const x of [-0.6, 0.6]) {
        const sp = new SpotLight('#fff3e2', 0, 140, 0.42, 0.55, 2);
        sp.position.set(x, 0.6, 2.0);
        const tgt = new Object3D(); tgt.position.set(x * 1.6, -0.6, 22);
        root.add(sp, tgt); sp.target = tgt;
        this.spots.push(sp);
      }
    }
    this.lightMode = 1;
    this.setPaint(paint, livery);
    if (ghost) this.makeGhost();
  }

  setPaint(id, livery = this.liveryId || 'clean') {
    const p = PAINTS.find((q) => q.id === id) || PAINTS[0];
    this.paintId = p.id; this.liveryId = livery;
    const m = this.mats.paint;
    if (m.map) { m.map.dispose(); m.map = null; }
    const tex = liveryTexture(p, livery);
    if (tex) { m.map = tex; m.color.set('#ffffff'); } else m.color.set(p.color);
    m.metalness = p.metal; m.roughness = p.rough;
    m.needsUpdate = true;
  }

  // 幽靈車：整台換成半透明的單色材質
  makeGhost() {
    const g = new MeshBasicMaterial({ color: new Color(0.55, 0.85, 1.3), transparent: true, opacity: 0.22, depthWrite: false, blending: AdditiveBlending });
    this.group.traverse((o) => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(() => g) : g; o.castShadow = false; } });
    for (const p of [...this.plumes, ...this.lifts]) p.visible = false;
    this.ghostMat = g;
  }

  setDoors(t) {
    this.doorT = t;
    const e = t * t * (3 - 2 * t);
    for (const d of this.doors) d.pivot.rotation.z = d.sgn * e * 1.25;
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
    for (const f of this.flaps) f.rotation.x = st.aero === 'HIGH' ? 0.35 : (st.braking ? 0.25 : 0);
    const brake = st.braking || (st.input && st.input.throttle < 0 && st.vf > 1);
    this.mats.tail.color.setRGB(brake ? 5 : 2.2, brake ? 0.18 : 0.07, brake ? 0.12 : 0.05);
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
