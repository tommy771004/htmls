// 步槍：由零件設定（瞄具／槍管／彈匣）程序組出。第一人稱視角模型（含雙手、後座力、換彈、開鏡）與第三人稱簡模共用同一份零件。
import * as THREE from 'three';
import { Geo } from './geo.js';

const PI = Math.PI;
const M = [0.028, 0.029, 0.032], M2 = [0.06, 0.062, 0.068], DK = [0.006, 0.006, 0.007], ST = [0.1, 0.105, 0.11], TAN = [0.1, 0.077, 0.052], PD = [0.02, 0.02, 0.022];
const BY = 0.045, Z0 = -0.135; // 槍膛軸高度、護木起點

// 側面輪廓（[z, y]…，槍口朝 -z）沿 x 擠出、邊緣倒角：機匣、握把、槍托、彈匣這些不是方塊的零件都用它
function prof(G, pts, w, col, b = 0.004, x = 0) {
  const sh = new THREE.Shape(); pts.forEach((q, i) => i ? sh.lineTo(-q[0], q[1]) : sh.moveTo(-q[0], q[1]));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -(w - 2 * b) / 2); g.rotateY(PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 5, uv.getY(i) * 5);
  return G.add(g, x, 0, 0, col);
}
function zcyl(G, r1, r2, len, seg, x, y, z, col, spin = 0) { const g = new THREE.CylinderGeometry(r1, r2, len, seg); if (spin) g.rotateY(spin); g.rotateX(PI / 2); return G.add(g, x, y, z, col); }

// 回傳各群組的幾何與幾個定位點。槍口朝 -z，原點在握把上緣。
export function rifleParts(lo) {
  const B = { metal: new Geo(), poly: new Geo() }, MAG = { metal: new Geo(), poly: new Geo() }, BOLT = new Geo(), glass = [], info = {};
  const HG = lo.barrel === 'sup' ? 0.24 : lo.barrel === 'long' ? 0.34 : 0.3, BL = lo.barrel === 'sup' ? 0.27 : lo.barrel === 'long' ? 0.47 : 0.37, mz = Z0 - BL;
  // 上機匣、下機匣（含彈匣井）
  prof(B.metal, [[-0.135, 0.018], [-0.135, 0.07], [-0.128, 0.076], [0.066, 0.076], [0.08, 0.062], [0.08, 0.03], [0.066, 0.018]], 0.046, M, 0.005);
  B.metal.box(0.022, 0.012, 0.21, 0, 0.08, -0.03, M2);
  for (let i = 0; i < 13; i++) B.metal.box(0.024, 0.007, 0.009, 0, 0.089, 0.066 - i * 0.016, M2);
  prof(B.metal, [[-0.123, 0.02], [-0.126, -0.08], [-0.12, -0.088], [-0.05, -0.092], [-0.046, -0.034], [0.022, -0.032], [0.046, -0.022], [0.08, -0.014], [0.082, 0.02]], 0.04, M, 0.004);
  // 扳機護弓、扳機、插銷、快慢機
  B.metal.box(0.01, 0.005, 0.078, 0, -0.064, -0.006, M, { r: 0.002 }); B.metal.box(0.01, 0.036, 0.005, 0, -0.048, 0.032, M); B.metal.box(0.006, 0.026, 0.007, 0, -0.045, -0.012, ST, { rx: -0.25 });
  for (const [y, z] of [[0.012, 0.064], [0.014, -0.104]]) B.metal.cyl(0.0045, 0.0045, 0.044, 8, 0, y, z, M2, { rz: PI / 2 });
  B.metal.cyl(0.006, 0.006, 0.006, 8, -0.021, -0.006, 0.03, M2, { rz: PI / 2 }); B.metal.box(0.003, 0.005, 0.018, -0.0225, -0.004, 0.022, M2, { rx: 0.5 });
  // 拋殼窗、防塵蓋、彈殼導板、輔助推機柄、彈匣卡榫
  B.metal.box(0.003, 0.022, 0.066, 0.0235, BY + 0.008, -0.04, DK); B.metal.box(0.003, 0.02, 0.062, 0.027, BY - 0.02, -0.04, M2, { rz: -0.45 });
  prof(B.metal, [[-0.004, 0.036], [0.012, 0.036], [0.012, 0.056], [0.004, 0.056]], 0.012, M2, 0.002, 0.026);
  zcyl(B.metal, 0.006, 0.006, 0.022, 8, 0.027, BY + 0.004, 0.05, M2); B.metal.box(0.004, 0.012, 0.02, 0.022, -0.01, -0.05, M2);
  // 左側（玩家看得到的那一面）：槍機釋放鈕、機匣刻線、彈匣井補強肋
  B.metal.box(0.003, 0.02, 0.011, -0.0215, 0.014, -0.036, M2, { r: 0.001 }); B.metal.box(0.004, 0.008, 0.016, -0.022, 0.026, -0.036, M2);
  B.metal.box(0.002, 0.0025, 0.19, -0.0232, 0.046, -0.03, DK); B.metal.box(0.002, 0.0025, 0.05, -0.0232, 0.03, 0.04, DK);
  for (const s of [-1, 1]) { B.metal.box(0.003, 0.066, 0.005, s * 0.0205, -0.05, -0.122, M2); B.metal.box(0.003, 0.004, 0.07, s * 0.0205, -0.084, -0.086, M2); }
  // 握把
  prof(B.poly, [[0.026, -0.03], [0.064, -0.03], [0.073, -0.052], [0.1, -0.138], [0.06, -0.147], [0.043, -0.078], [0.03, -0.05]], 0.03, TAN, 0.009);
  // 槍托
  zcyl(B.metal, 0.015, 0.015, 0.2, 12, 0, BY - 0.004, 0.165, M); zcyl(B.metal, 0.019, 0.019, 0.012, 12, 0, BY - 0.004, 0.084, M2);
  prof(B.poly, [[0.118, 0.066], [0.3, 0.066], [0.318, 0.058], [0.318, -0.084], [0.296, -0.09], [0.262, -0.04], [0.228, -0.004], [0.118, 0.014]], 0.04, TAN, 0.009);
  B.poly.box(0.046, 0.146, 0.02, 0, BY - 0.058, 0.327, PD, { r: 0.008 }); B.poly.box(0.044, 0.014, 0.1, 0, 0.073, 0.2, PD, { r: 0.005 });
  // 護木、槍管
  zcyl(B.metal, 0.029, 0.029, HG, 8, 0, BY, Z0 - HG / 2, M, PI / 8); B.metal.box(0.022, 0.01, HG, 0, 0.079, Z0 - HG / 2, M2);
  for (let i = 0; i < Math.floor(HG / 0.016) - 1; i++) B.metal.box(0.024, 0.007, 0.009, 0, 0.089, Z0 - 0.012 - i * 0.016, M2);
  for (const s of [-1, 1]) for (let k = 0; k < Math.floor(HG / 0.066); k++) { B.metal.box(0.004, 0.011, 0.042, s * 0.0275, BY, Z0 - 0.04 - k * 0.066, DK); B.metal.box(0.011, 0.004, 0.042, s * 0.0195, BY - 0.0195, Z0 - 0.04 - k * 0.066, DK, { rz: s * PI / 4 }); }
  zcyl(B.metal, 0.031, 0.031, 0.012, 8, 0, BY, Z0 - 0.004, M2, PI / 8);
  zcyl(B.metal, 0.0085, 0.0085, BL, 14, 0, BY, Z0 - BL / 2, ST);
  if (lo.barrel === 'std') { zcyl(B.metal, 0.0125, 0.0125, 0.05, 10, 0, BY, mz - 0.02, M2); for (let k = 0; k < 4; k++) B.metal.box(0.004, 0.027, 0.026, 0, BY, mz - 0.024, DK, { rz: k * PI / 4 }); info.muzzleZ = mz - 0.045; }
  else if (lo.barrel === 'long') { zcyl(B.metal, 0.0105, 0.0105, 0.1, 10, 0, BY, mz + 0.05, ST); B.metal.box(0.032, 0.026, 0.064, 0, BY, mz - 0.026, M2, { r: 0.004 }); for (const s of [-1, 1]) for (const dz of [-0.012, 0.012]) B.metal.box(0.004, 0.014, 0.012, s * 0.0155, BY, mz - 0.026 + dz, DK); zcyl(B.metal, 0.007, 0.007, 0.004, 8, 0, BY, mz - 0.058, DK); info.muzzleZ = mz - 0.058; }
  else { zcyl(B.metal, 0.021, 0.021, 0.19, 14, 0, BY, mz - 0.085, [0.04, 0.04, 0.043]); for (const dz of [0.008, -0.05, -0.108, -0.176]) zcyl(B.metal, 0.0225, 0.0225, 0.012, 14, 0, BY, mz + dz - 0.0, M2); zcyl(B.metal, 0.008, 0.008, 0.004, 8, 0, BY, mz - 0.181, DK); info.muzzleZ = mz - 0.182; }
  // 槍燈
  const lz = Z0 - HG + 0.07; zcyl(B.metal, 0.0135, 0.0135, 0.075, 10, -0.045, BY, lz, M); B.metal.box(0.016, 0.014, 0.03, -0.034, BY, lz + 0.01, M); info.light = new THREE.Vector3(-0.045, BY, lz - 0.04);
  // 拉柄
  BOLT.box(0.036, 0.01, 0.018, 0, BY + 0.027, 0.086, M2); BOLT.box(0.012, 0.01, 0.05, 0, BY + 0.027, 0.062, M2);
  // 彈匣
  if (lo.mag === 'drum') {
    MAG.poly.box(0.026, 0.075, 0.058, 0, -0.112, -0.089, PD, { r: 0.003 });
    MAG.metal.cyl(0.072, 0.072, 0.064, 20, 0, -0.205, -0.092, M2, { rz: PI / 2 }); MAG.metal.cyl(0.076, 0.076, 0.012, 20, 0.027, -0.205, -0.092, M, { rz: PI / 2 }); MAG.metal.cyl(0.076, 0.076, 0.012, 20, -0.027, -0.205, -0.092, M, { rz: PI / 2 });
    MAG.metal.cyl(0.02, 0.02, 0.078, 10, 0, -0.205, -0.092, ST, { rz: PI / 2 }); for (let k = 0; k < 6; k++) MAG.metal.box(0.068, 0.006, 0.05, 0, -0.205, -0.092, DK, { rx: k * PI / 6 + 0.2 });
  } else { // 彎曲的彈匣：輪廓擠出
    const ext = lo.mag === 'ext';
    prof(MAG.poly, ext ? [[-0.12, -0.07], [-0.058, -0.07], [-0.062, -0.15], [-0.08, -0.232], [-0.106, -0.298], [-0.168, -0.28], [-0.144, -0.218], [-0.128, -0.15]] : [[-0.12, -0.07], [-0.058, -0.07], [-0.062, -0.15], [-0.08, -0.232], [-0.142, -0.218], [-0.128, -0.15]], 0.026, TAN, 0.004);
    for (let k = 0; k < (ext ? 5 : 3); k++) MAG.poly.box(0.028, 0.004, 0.05, 0, -0.105 - k * 0.034, -0.091 - k * 0.005, [0.12, 0.09, 0.055], { rx: 0.1 + k * 0.04 });
    if (ext) MAG.poly.box(0.031, 0.012, 0.068, 0, -0.293, -0.136, PD, { rx: 0.34 }); else MAG.poly.box(0.031, 0.012, 0.068, 0, -0.228, -0.11, PD, { rx: 0.21 });
  }
  // 瞄具
  if (lo.optic === 'iron') {
    B.metal.box(0.026, 0.012, 0.03, 0, 0.098, 0.05, M); for (const s of [-1, 1]) B.metal.box(0.004, 0.028, 0.006, s * 0.0095, 0.117, 0.05, M); B.metal.box(0.023, 0.004, 0.006, 0, 0.133, 0.05, M);
    const fz = Z0 - HG + 0.03; B.metal.box(0.02, 0.012, 0.026, 0, 0.097, fz, M); B.metal.box(0.0028, 0.03, 0.003, 0, 0.113, fz, M2); for (const s of [-1, 1]) B.metal.box(0.003, 0.032, 0.014, s * 0.009, 0.115, fz, M, { rz: s * 0.2 });
    info.sightY = 0.1235; info.eye = 0.2;
  } else if (lo.optic === 'reflex') {
    B.metal.box(0.03, 0.012, 0.05, 0, 0.098, 0, M); B.metal.box(0.028, 0.016, 0.022, 0, 0.109, 0.016, M);
    for (const s of [-1, 1]) B.metal.box(0.003, 0.036, 0.012, s * 0.0165, 0.123, -0.018, M); B.metal.box(0.036, 0.003, 0.012, 0, 0.1415, -0.018, M);
    glass.push({ w: 0.03, h: 0.034, x: 0, y: 0.123, z: -0.018 }); info.ret = { type: 'dot', y: 0.123, z: -0.0185, s: 0.0012 }; info.sightY = 0.123; info.eye = 0.23;
  } else if (lo.optic === 'holo') {
    B.metal.box(0.036, 0.014, 0.076, 0, 0.099, 0, M); B.metal.box(0.03, 0.02, 0.022, 0, 0.113, 0.04, M);
    for (const s of [-1, 1]) B.metal.box(0.004, 0.044, 0.06, s * 0.02, 0.128, -0.006, M); B.metal.box(0.044, 0.004, 0.06, 0, 0.151, -0.006, M); B.metal.box(0.044, 0.006, 0.004, 0, 0.108, -0.034, M);
    glass.push({ w: 0.036, h: 0.04, x: 0, y: 0.128, z: -0.03 }); info.ret = { type: 'ring', y: 0.128, z: -0.0305, s: 0.0062 }; info.sightY = 0.128; info.eye = 0.24;
  } else {
    for (const z of [-0.075, 0.035]) { B.metal.box(0.03, 0.022, 0.018, 0, 0.104, z, M); zcyl(B.metal, 0.0185, 0.0185, 0.018, 12, 0, 0.133, z, M2); }
    zcyl(B.metal, 0.0155, 0.0155, 0.21, 14, 0, 0.133, -0.02, M); zcyl(B.metal, 0.021, 0.024, 0.06, 14, 0, 0.133, -0.152, M); zcyl(B.metal, 0.022, 0.0175, 0.05, 14, 0, 0.133, 0.105, M); zcyl(B.metal, 0.0235, 0.0235, 0.012, 14, 0, 0.133, 0.128, PD);
    B.metal.cyl(0.011, 0.011, 0.02, 10, 0, 0.158, -0.02, M2); B.metal.cyl(0.011, 0.011, 0.02, 10, 0.026, 0.133, -0.02, M2, { rz: PI / 2 });
    glass.push({ r: 0.0205, x: 0, y: 0.133, z: -0.18, tint: [0.25, 0.5, 0.35] }, { r: 0.0165, x: 0, y: 0.133, z: 0.129, tint: [0.2, 0.3, 0.3] }); info.sightY = 0.133; info.eye = 0.2;
  }
  info.eject = new THREE.Vector3(0.03, BY + 0.008, -0.04); info.magPivot = new THREE.Vector3(0, -0.08, -0.088); info.hg = HG;
  return { B, MAG, BOLT, glass, info };
}
// 第三人稱：整把槍併成一個幾何
export function rifleLow(lo) {
  const p = rifleParts(lo), G = new Geo();
  for (const g of [p.B.metal, p.B.poly, p.MAG.metal, p.MAG.poly, p.BOLT]) for (const q of g.list) G.list.push(q);
  return { geo: G.build(), info: p.info };
}

function handGeo(R, sleeve, side) { // 握住沿 z 軸、半徑 R 的圓柱；掌心在下，四指從 +x*side 側包上來
  const G = new Geo(), gl = [0.022, 0.022, 0.024], kn = [0.05, 0.05, 0.055], cap = (a, rr, z, c, r = 0.0105, len = 0.017) => G.add(new THREE.CapsuleGeometry(r, len, 3, 8), side * Math.cos(a) * rr, Math.sin(a) * rr, z, c, { rz: side * a });
  G.box(0.09, 0.034, 0.1, 0, -R - 0.017, 0, gl, { r: 0.015 });
  for (let i = 0; i < 4; i++) { const z = -0.036 + i * 0.024, k = i === 0 || i === 3 ? 0.92 : 1; for (const a of [-0.8, -0.2, 0.42, 1.04, 1.6]) cap(a, R + 0.011, z, gl, 0.0108 * k, 0.016); G.add(new THREE.SphereGeometry(0.0125, 8, 6), side * Math.cos(0.1) * (R + 0.019), Math.sin(0.1) * (R + 0.019), z, kn, { sz: 0.9 }); }
  for (const a of [PI + 0.7, PI + 0.15, PI - 0.42]) cap(a, R + 0.012, 0.036, gl, 0.012, 0.018); // 拇指
  G.box(0.03, 0.012, 0.085, side * (R + 0.02), -0.012, -0.002, kn, { r: 0.005, rz: side * 0.25 });        // 手背護片
  // 前臂：往鏡頭外；袖口與幾道皺褶
  const dir = new THREE.Vector3(side * -0.28, -0.42, 0.86).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  const w = new THREE.Vector3(side * -0.012, -R - 0.03, 0.05), at = (g, d, c) => G.add(g, w.x + dir.x * d, w.y + dir.y * d, w.z + dir.z * d, c, { rx: e.x, ry: e.y, rz: e.z });
  at(new THREE.CylinderGeometry(0.05, 0.037, 0.42, 14), 0.25, sleeve); at(new THREE.CylinderGeometry(0.041, 0.041, 0.032, 14), 0.04, gl);
  for (const [d, r] of [[0.085, 0.041], [0.15, 0.0445], [0.23, 0.0475]]) at(new THREE.TorusGeometry(r, 0.0045, 5, 14).rotateX(PI / 2), d, [sleeve[0] * 0.8, sleeve[1] * 0.8, sleeve[2] * 0.8]);
  return G.build();
}
const kf = (p, keys) => { if (p <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) { const t = (p - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]), s = t * t * (3 - 2 * t); return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * s; } return keys[keys.length - 1][1]; };

export class ViewModel {
  constructor(Tx, sleeveCol) {
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(52, 1, 0.01, 8);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.key = new THREE.DirectionalLight(0xffffff, 1); this.key.position.set(0.4, 1, 0.5);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 1.2, 2); this.scene.add(this.hemi, this.key, this.flashLight);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.matMetal = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(2.3, 2.3, 2.45), metalness: 0.74, roughness: 0.36, normalMap: Tx.fabric.normalMap, normalScale: new THREE.Vector2(0.12, 0.12) });
    this.matPoly = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.78, 0.78, 0.78), metalness: 0, roughness: 0.58, normalMap: Tx.fabric.normalMap, normalScale: new THREE.Vector2(0.35, 0.35) });
    this.matCloth = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.62, 0.62, 0.62), metalness: 0, roughness: 0.9, normalMap: Tx.fabric.normalMap, normalScale: new THREE.Vector2(0.8, 0.8) });
    this.matGlass = new THREE.MeshStandardMaterial({ color: 0x223028, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
    this.matRet = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 0.4, 0.2), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.matFlash = new THREE.MeshBasicMaterial({ map: Tx.flash, color: new THREE.Color(3.2, 2.4, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.matLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.4, 4.2) });
    this.gun = new THREE.Group(); this.root.add(this.gun);
    this.handL = new THREE.Mesh(handGeo(0.031, sleeveCol, 1), this.matCloth); this.handR = new THREE.Mesh(handGeo(0.02, sleeveCol, -1), this.matCloth);
    this.root.add(this.handL, this.handR);
    this.flash = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), this.matFlash); m.rotation.y = i === 2 ? 0 : PI / 2; m.rotation.z = i * PI / 2; if (i === 2) m.scale.setScalar(0.8); this.flash.add(m); } this.flash.visible = false;
    this.k = { z: 0, vz: 0, r: 0, vr: 0, y: 0, vy: 0, ro: 0, vro: 0 }; this.sway = new THREE.Vector2(); this.bob = 0; this.flashT = 0; this.land = 0; this.inspect = 0; this.spin = 0.6; this.scopeMix = 0; this.torch = true;
    this.pos = new THREE.Vector3(); this.rot = new THREE.Euler(); this.fovK = 1; // 直式螢幕把垂直視野放大，槍才不會塞滿畫面
  }
  setLoadout(lo) {
    for (const c of [...this.gun.children]) { this.gun.remove(c); if (c.geometry) c.geometry.dispose(); }
    const p = rifleParts(lo); this.info = p.info; this.lo = { ...lo };
    const add = (G, mat, parent) => { if (G.empty) return null; const m = new THREE.Mesh(G.build(), mat); parent.add(m); return m; };
    add(p.B.metal, this.matMetal, this.gun); add(p.B.poly, this.matPoly, this.gun);
    this.mag = new THREE.Group(); this.gun.add(this.mag); add(p.MAG.metal, this.matMetal, this.mag); add(p.MAG.poly, this.matPoly, this.mag);
    this.bolt = add(p.BOLT, this.matMetal, this.gun);
    for (const g of p.glass) { const m = new THREE.Mesh(g.r ? new THREE.CircleGeometry(g.r, 20) : new THREE.PlaneGeometry(g.w, g.h), g.tint ? Object.assign(this.matGlass.clone(), { color: new THREE.Color(g.tint[0], g.tint[1], g.tint[2]), opacity: 0.75 }) : this.matGlass); m.position.set(g.x, g.y, g.z); this.gun.add(m); }
    if (p.info.ret) { const r = p.info.ret, grp = new THREE.Group(); grp.position.set(0, r.y, r.z);
      if (r.type === 'dot') grp.add(new THREE.Mesh(new THREE.CircleGeometry(r.s, 12), this.matRet));
      else { grp.add(new THREE.Mesh(new THREE.RingGeometry(r.s * 0.86, r.s, 28), this.matRet), new THREE.Mesh(new THREE.CircleGeometry(r.s * 0.13, 10), this.matRet)); for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(r.s * 0.1, r.s * 0.3), this.matRet); t.position.set(Math.sin(i * PI / 2) * r.s * 1.1, Math.cos(i * PI / 2) * r.s * 1.1, 0); t.rotation.z = -i * PI / 2; grp.add(t); } }
      grp.renderOrder = 5; this.gun.add(grp); this.ret = grp; } else this.ret = null;
    this.lamp = new THREE.Mesh(new THREE.CircleGeometry(0.0115, 12), this.matLamp); this.lamp.position.copy(p.info.light); this.lamp.rotation.y = PI; this.gun.add(this.lamp);
    this.flash.position.set(0, BY, p.info.muzzleZ - 0.06); this.gun.add(this.flash);
    this.handL.position.set(0, BY, Z0 - Math.min(0.2, p.info.hg * 0.62)); this.handLBase = this.handL.position.clone();
  }
  kick(rec, ads) { const k = this.k, a = 1 - ads * 0.55; k.vz += 1.5 * rec * a; k.vr += 2.4 * rec * a; k.vy += (Math.random() - 0.5) * 1.4 * rec * a; k.vro += (Math.random() - 0.5) * 2.4 * rec; if (this.info && this.lo.barrel !== 'sup') { this.flashT = 0.055; this.flash.rotation.z = Math.random() * 6.28; this.flash.scale.setScalar((1.15 + Math.random() * 0.8) * (this.lo.barrel === 'long' ? 1.25 : 1)); } }
  setProbe(c, flashOn) {
    const l = Math.max(0.04, c.r * 0.3 + c.g * 0.55 + c.b * 0.15);
    this.hemi.color.copy(c).multiplyScalar(3.4); this.hemi.groundColor.copy(c).multiplyScalar(1.2); this.key.color.copy(c).multiplyScalar(2.6); this.scene.environmentIntensity = Math.min(1.7, l * 2.6 + 0.45);
    if (flashOn) { this.hemi.color.addScalar(0.16); this.key.color.addScalar(0.12); }
  }
  // s：{ ads, sprint, crouch, speed, reload(0..1 或 -1), stepAcc, ground, dx, dy（滑鼠位移）, gunsmith }
  update(dt, s) {
    const k = this.k, I = this.info; if (!I) return;
    // 後座力彈簧
    for (const [x, v, st, dm] of [['z', 'vz', 260, 24], ['r', 'vr', 230, 22], ['y', 'vy', 200, 20], ['ro', 'vro', 200, 18]]) { k[v] += (-st * k[x] - dm * k[v]) * dt; k[x] += k[v] * dt; }
    this.sway.x += (-s.dx * 0.00028 - this.sway.x) * Math.min(1, dt * 9); this.sway.y += (s.dy * 0.00028 - this.sway.y) * Math.min(1, dt * 9);
    this.sway.x = Math.max(-0.03, Math.min(0.03, this.sway.x)); this.sway.y = Math.max(-0.03, Math.min(0.03, this.sway.y));
    const mv = Math.min(1, s.speed / 4.3) * (s.ground ? 1 : 0); this.bob += dt * (4.6 + s.speed * 1.5) * (mv > 0.05 ? 1 : 0);
    this.land += (0 - this.land) * Math.min(1, dt * 8);
    const a = s.ads, sp = s.sprint * (1 - a), bobA = mv * (1 - a * 0.85) * (1 + sp * 1.4);
    const ins = this.inspect += ((s.gunsmith ? 1 : 0) - this.inspect) * Math.min(1, dt * 7);
    // 位置：腰射 ↔ 開鏡 ↔ 衝刺
    const hx = 0.088, hy = -0.118, hz = -0.3;
    let px = hx + (0 - hx) * a, py = hy + (-I.sightY - hy) * a, pz = hz + (-I.eye - hz) * a, rx = 0, ry = 0.035 * (1 - a), rz = -0.03 * (1 - a);
    px += sp * -0.035; py += sp * -0.05; pz += sp * 0.05; ry += sp * 0.72; rx += sp * -0.2; rz += sp * 0.24;
    py -= s.crouch * 0.012 * (1 - a); rz += s.crouch * 0.05 * (1 - a);
    px += Math.sin(this.bob) * 0.0055 * bobA + this.sway.x; py += -Math.abs(Math.cos(this.bob)) * 0.006 * bobA + this.sway.y - this.land * 0.03; rz += Math.sin(this.bob) * 0.012 * bobA - this.sway.x * 1.4; ry += this.sway.x * 0.8; rx += this.sway.y * 0.8;
    // 換彈
    let magY = 0, magA = 0, boltZ = 0, lhx = 0, lhy = 0, lhz = 0, lhShow = 1;
    if (s.reload >= 0) {
      const p = s.reload, tilt = kf(p, [[0, 0], [0.1, 1], [0.78, 1], [0.92, 0.3], [1, 0]]);
      rz += -0.5 * tilt; rx += 0.24 * tilt; px += -0.02 * tilt; py += -0.03 * tilt + kf(p, [[0.46, 0], [0.5, 0.012], [0.56, 0]]);
      magY = kf(p, [[0.1, 0], [0.24, -0.34], [0.3, -0.34], [0.5, 0]]); magA = kf(p, [[0.1, 0], [0.24, 0.5], [0.3, -0.25], [0.5, 0]]);
      boltZ = kf(p, [[0.7, 0], [0.8, 0.04], [0.84, 0]]);
      const toMag = kf(p, [[0.02, 0], [0.12, 1], [0.52, 1], [0.64, 0]]), toBolt = kf(p, [[0.6, 0], [0.72, 1], [0.84, 1], [0.96, 0]]);
      lhx = 0; lhy = toMag * (-0.2 + magY * 0.9) + toBolt * 0.05; lhz = toMag * (this.handLBase.z * -1 - 0.09) + toBolt * (this.handLBase.z * -1 + 0.06); lhShow = 1;
    }
    this.mag.position.set(0, magY, magY * 0.12); this.mag.rotation.x = magA * 0.5; this.mag.visible = magY > -0.33;
    if (this.bolt) this.bolt.position.z = boltZ + Math.max(0, k.z) * 0.6;
    this.handL.position.set(this.handLBase.x + lhx, this.handLBase.y + lhy, this.handLBase.z + lhz); this.handL.visible = lhShow > 0 && ins < 0.5;
    this.handR.position.set(0.004, -0.085, 0.05); this.handR.rotation.set(-1.25, 0, 0.0); this.handR.visible = ins < 0.5;
    // 後座力
    pz += k.z; rx += k.r * 0.06; ry += k.y * 0.03; rz += k.ro * 0.03; py += k.r * 0.004;
    // 槍匠檢視：槍橫在畫面中央慢慢轉
    if (ins > 0.001) { this.spin += dt * 0.25; const t = ins; px += ((s.gx ?? 0.02) - px) * t; py += ((s.gy ?? -0.035) - py) * t; pz += ((s.gz ?? -0.62) - pz) * t; rx += (0.1 - rx) * t; ry += (PI / 2 + Math.sin(this.spin) * 0.5 - ry) * t; rz += (0 - rz) * t; }
    this.root.position.set(px, py, pz); this.root.rotation.set(rx, ry, rz, 'YXZ');
    this.root.children.forEach(c => { if (c === this.handL || c === this.handR) return; });
    // 手跟著槍一起動（handL / handR 是 root 的子物件，gun 也是）
    this.flashT -= dt; this.flash.visible = this.flashT > 0; this.flashLight.intensity = this.flashT > 0 ? 1.6 : 0; this.flashLight.position.set(px, py + BY, pz + I.muzzleZ);
    this.lamp.visible = this.torch;
    if (this.ret) this.ret.visible = ins < 0.5;
    // 4× 鏡：開鏡後改用全螢幕遮罩
    const sc = this.lo.optic === 'scope' ? Math.max(0, (a - 0.8) / 0.2) : 0; this.scopeMix = sc; this.root.visible = sc < 0.95;
    const fv = 52 - a * 12; this.camera.fov = this.fovK > 1 ? 2 * Math.atan(Math.tan(fv * PI / 360) * this.fovK) * 180 / PI : fv; this.camera.updateProjectionMatrix();
  }
  // 視角模型空間的點 → 世界座標（兩台相機 FOV 不同，x / y 依比例換算）
  toWorld(local, mainCam, out) {
    out.copy(local); this.gun.localToWorld(out); // vm 場景裡的「世界」＝相機空間
    const k = Math.tan(mainCam.fov * PI / 360) / Math.tan(this.camera.fov * PI / 360); out.x *= k; out.y *= k;
    return out.applyMatrix4(mainCam.matrixWorld);
  }
}
