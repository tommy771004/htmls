// 家具與燈具的程序建模。每個函式在局部座標裡組裝（原點在腳下中央、正面朝 +z），交給 Builder 併入靜態網格。
import * as THREE from 'three';

export const C = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const WOOD_D = C('#3a2216'), WOOD_M = C('#5e3a22'), WOOD_L = C('#9a7446'), BRASS = C('#b8913f'), STEEL = C('#7d8286'), BLACK = C('#161617'),
  RED = C('#6e1f25'), GREEN = C('#2c463c'), CREAM = C('#cdc3aa'), SHEET = C('#cfcabb'), BLUE = C('#2f4256'), LEATHER = C('#4a2a1e'), OX = C('#5c1c1c'), WHITE = C('#d9d5ca'), TAN = C('#8f744d');

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

const legs4 = (L, mat, w, d, h, t, col, inset = 0.04) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(mat, sx * (w / 2 - inset - t / 2), h / 2, sz * (d / 2 - inset - t / 2), t, h, t, { col }); };

export const ITEM = {
  bed(L, it) {
    const k = hash(it.id), duvet = k < 0.4 ? RED : k < 0.7 ? GREEN : BLUE;
    L.box('woodF', 0, 0.16, 0, 1.7, 0.32, 2.15, { col: WOOD_D });
    L.box('fabric', 0, 0.44, 0.04, 1.6, 0.26, 2.0, { r: 0.09, col: WHITE });
    L.box('fabric', 0.03, 0.57, 0.42, 1.66, 0.12, 1.2, { r: 0.06, col: duvet, ry: (k - 0.5) * 0.12 });
    L.box('fabric', -0.2 + k * 0.3, 0.62, 0.9, 1.2, 0.1, 0.5, { r: 0.05, col: mul(duvet, 0.8), ry: 0.3 * (k - 0.3) });
    L.box('fabric', -0.4, 0.63, -0.72, 0.62, 0.15, 0.4, { r: 0.07, col: WHITE, ry: 0.08 }); L.box('fabric', 0.42, 0.63, -0.7, 0.62, 0.15, 0.4, { r: 0.07, col: WHITE, ry: -0.2 * k });
    L.box('woodF', 0, 0.6, -1.04, 1.74, 1.2, 0.07, { col: WOOD_D }); L.box('fabric', 0, 0.82, -0.99, 1.5, 0.62, 0.06, { r: 0.03, col: mul(duvet, 0.7) });
  },
  nightstand(L) {
    L.box('woodF', 0, 0.3, 0, 0.5, 0.48, 0.45, { col: WOOD_M }); L.box('woodF', 0, 0.55, 0, 0.54, 0.03, 0.49, { col: WOOD_D });
    L.box('woodF', 0, 0.36, 0.228, 0.42, 0.16, 0.012, { col: WOOD_D }); L.sph('metal', 0, 0.36, 0.245, 0.016, { col: BRASS }); legs4(L, 'woodF', 0.5, 0.45, 0.07, 0.04, WOOD_D);
  },
  wardrobe(L) {
    L.box('woodF', 0, 1.05, -0.02, 1.3, 2.1, 0.58, { col: WOOD_D });
    for (const s of [-1, 1]) { L.box('woodF', s * 0.32, 1.08, 0.285, 0.6, 1.86, 0.03, { col: WOOD_M }); L.box('woodF', s * 0.32, 1.08, 0.302, 0.44, 1.6, 0.012, { col: WOOD_D }); L.cyl('metal', s * 0.05, 1.05, 0.32, 0.008, 0.008, 0.16, 6, { col: BRASS }); }
    L.box('woodF', 0, 2.12, 0, 1.38, 0.06, 0.66, { col: WOOD_D });
  },
  cabinet(L, it) {
    const c = C('#48554c');
    L.box('paint', 0, 0.95, 0, 1.3, 1.9, 0.62, { col: c });
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { L.box('paint', s * 0.325, 0.25 + i * 0.46, 0.312, 0.6, 0.42, 0.012, { col: mul(c, i === 2 && s > 0 ? 0.7 : 1.12) }); L.box('metal', s * 0.325, 0.33 + i * 0.46, 0.324, 0.16, 0.022, 0.016, { col: STEEL }); }
    if (hash(it.id) > 0.4) L.box('paint', 0.325, 1.17, 0.42, 0.56, 0.4, 0.3, { col: mul(c, 0.85) });
  },
  desk(L, it) {
    L.box('woodF', 0, 0.76, 0, 1.3, 0.045, 0.62, { col: WOOD_M });
    L.box('woodF', -0.6, 0.37, 0, 0.04, 0.74, 0.56, { col: WOOD_D }); L.box('woodF', 0.6, 0.37, 0, 0.04, 0.74, 0.56, { col: WOOD_D }); L.box('woodF', 0, 0.5, -0.27, 1.18, 0.44, 0.02, { col: WOOD_D });
    L.box('woodF', 0.36, 0.62, 0.02, 0.42, 0.2, 0.54, { col: WOOD_M }); L.sph('metal', 0.36, 0.62, 0.3, 0.015, { col: BRASS });
    L.box('paint', -0.2, 0.787, 0.02, 0.5, 0.008, 0.34, { col: C('#243a30') });
    if (hash(it.id) > 0.5) { L.box('paint', 0.42, 0.82, -0.1, 0.2, 0.07, 0.16, { col: BLACK, r: 0.02 }); L.box('paint', 0.42, 0.87, -0.1, 0.22, 0.035, 0.06, { col: BLACK, r: 0.015 }); }
  },
  chair(L, it) {
    const col = hash(it.id) > 0.5 ? RED : GREEN;
    L.box('fabric', 0, 0.47, 0, 0.44, 0.07, 0.44, { r: 0.03, col }); legs4(L, 'woodF', 0.46, 0.46, 0.44, 0.035, WOOD_D, 0);
    for (const s of [-1, 1]) L.box('woodF', s * 0.2, 0.7, -0.21, 0.035, 0.52, 0.035, { col: WOOD_D, rx: -0.08 });
    L.box('fabric', 0, 0.76, -0.225, 0.4, 0.28, 0.04, { r: 0.02, col, rx: -0.08 });
  },
  armchair(L, it) {
    const col = [RED, GREEN, LEATHER, BLUE][(hash(it.id) * 4) | 0], mat = col === LEATHER ? 'leather' : 'fabric';
    L.box(mat, 0, 0.26, 0, 0.88, 0.3, 0.86, { r: 0.07, col: mul(col, 0.85) }); L.box(mat, 0, 0.46, 0.06, 0.6, 0.14, 0.66, { r: 0.06, col });
    L.box(mat, 0, 0.62, -0.34, 0.86, 0.62, 0.2, { r: 0.08, col, rx: -0.1 });
    for (const s of [-1, 1]) L.box(mat, s * 0.37, 0.46, 0.02, 0.16, 0.36, 0.78, { r: 0.07, col });
    legs4(L, 'woodF', 0.86, 0.84, 0.1, 0.05, WOOD_D, 0.03);
  },
  sofa(L, it) {
    const col = hash(it.id) > 0.5 ? OX : GREEN, mat = col === OX ? 'leather' : 'fabric';
    L.box(mat, 0, 0.25, 0.02, 2.18, 0.3, 0.9, { r: 0.07, col: mul(col, 0.85) });
    for (let i = -1; i <= 1; i++) { L.box(mat, i * 0.62, 0.46, 0.08, 0.6, 0.14, 0.7, { r: 0.06, col }); L.box(mat, i * 0.62, 0.66, -0.3, 0.6, 0.44, 0.2, { r: 0.08, col, rx: -0.14 }); }
    L.box(mat, 0, 0.56, -0.39, 2.16, 0.6, 0.14, { r: 0.06, col: mul(col, 0.9) });
    for (const s of [-1, 1]) L.box(mat, s * 1.0, 0.47, 0.02, 0.18, 0.4, 0.88, { r: 0.08, col });
    legs4(L, 'woodF', 2.1, 0.86, 0.1, 0.05, WOOD_D, 0.02);
    if (hash(it.id + 9) > 0.4) L.box('fabric', 0.5, 0.62, 0.08, 0.42, 0.14, 0.4, { r: 0.07, col: CREAM, rx: -0.5, ry: 0.3 });
  },
  ctable(L) {
    L.box('woodF', 0, 0.42, 0, 1.1, 0.04, 0.6, { col: WOOD_D }); L.box('woodF', 0, 0.14, 0, 0.96, 0.025, 0.46, { col: WOOD_M }); legs4(L, 'woodF', 1.1, 0.6, 0.4, 0.05, WOOD_D, 0.02);
    L.box('paint', 0.2, 0.452, 0.05, 0.3, 0.02, 0.22, { col: C('#70543a'), ry: 0.4 }); L.cyl('metal', -0.3, 0.47, -0.08, 0.07, 0.05, 0.05, 12, { col: BRASS });
  },
  bath(L) {
    L.box('paperA', 0, 1.5, 0, 2.3, 3.0, 2.5, { col: [0.86, 0.84, 0.8], uvs: 1.2, tess: 0.6, skip: 'y' });
    L.box('door', 0.2, 1.05, 1.262, 0.9, 2.08, 0.03, { uvs: 1, col: [1, 1, 1], uvFit: 1 });
    L.box('woodF', 0.2, 2.13, 1.265, 1.06, 0.08, 0.04, { col: WOOD_D }); for (const s of [-1, 1]) L.box('woodF', 0.2 + s * 0.49, 1.05, 1.265, 0.08, 2.1, 0.04, { col: WOOD_D });
    L.sph('metal', 0.56, 1.02, 1.3, 0.028, { col: BRASS });
    L.box('woodF', 0, 0.065, 1.258, 2.3, 0.13, 0.02, { col: WOOD_D }); L.box('woodF', -1.158, 0.065, 0, 0.02, 0.13, 2.5, { col: WOOD_D }); L.box('woodF', 1.158, 0.065, 0, 0.02, 0.13, 2.5, { col: WOOD_D });
  },
  column(L) {
    L.box('panel', 0, 0.55, 0, 0.82, 1.1, 0.82, { uvs: 0.9, col: [1, 1, 1], uvV: 1.1 });
    L.box('woodF', 0, 0.07, 0, 0.9, 0.14, 0.9, { col: WOOD_D }); L.box('woodF', 0, 1.12, 0, 0.88, 0.06, 0.88, { col: WOOD_D });
    L.box('plaster', 0, 3.85, 0, 0.72, 5.4, 0.72, { uvs: 2.4, col: [1.0, 0.96, 0.88], tess: 0.7 });
    L.box('plaster', 0, 6.62, 0, 0.84, 0.16, 0.84, { uvs: 2.4 }); L.box('plaster', 0, 6.85, 0, 0.98, 0.3, 0.98, { uvs: 2.4 });
    L.box('metal', 0, 1.2, 0, 0.75, 0.04, 0.75, { col: BRASS });
  },
  frontdesk(L) {
    L.box('panel', 0, 0.55, 0, 8.4, 1.1, 0.82, { uvs: 0.9, uvV: 1.1 }); L.box('marble', 0, 1.125, 0.02, 8.56, 0.05, 0.98, { uvs: 1.8 });
    L.box('woodF', 0, 0.06, 0.44, 8.44, 0.12, 0.06, { col: WOOD_D });
    L.cyl('metal', 0, 0.2, 0.52, 0.018, 0.018, 8.2, 8, { col: BRASS, rz: Math.PI / 2 }); for (let x = -3.6; x <= 3.6; x += 1.8) L.box('metal', x, 0.16, 0.48, 0.03, 0.1, 0.1, { col: BRASS });
    // 服務鈴、登記簿、筆座
    L.lathe('metal', 0.5, 1.15, 0.12, [[0.0, 0.075], [0.03, 0.07], [0.055, 0.045], [0.065, 0.012], [0.07, 0]], 16, { col: BRASS }); L.cyl('metal', 0.5, 1.232, 0.12, 0.008, 0.008, 0.02, 6, { col: BRASS });
    L.box('leather', -0.6, 1.165, 0.1, 0.62, 0.03, 0.42, { r: 0.012, col: C('#3a1512'), ry: 0.12 }); L.box('paint', -0.6, 1.182, 0.1, 0.56, 0.006, 0.37, { col: C('#b9ad8c'), ry: 0.12 });
    L.box('paint', 1.5, 1.2, -0.1, 0.3, 0.1, 0.22, { col: BLACK, r: 0.02 }); L.box('paint', 1.5, 1.27, -0.1, 0.34, 0.04, 0.07, { col: BLACK, r: 0.02 });
    L.box('paint', -2.0, 1.16, 0.2, 0.24, 0.012, 0.32, { col: C('#b9ad8c'), ry: -0.5 });
  },
  barcounter(L) {
    L.box('panel', 0, 0.53, 0, 7.0, 1.06, 0.7, { uvs: 0.9, uvV: 1.06 }); L.box('woodF', 0, 1.09, 0.03, 7.2, 0.06, 0.9, { col: WOOD_D });
    L.cyl('metal', 0, 0.22, 0.46, 0.02, 0.02, 6.8, 8, { col: BRASS, rz: Math.PI / 2 }); for (let x = -3; x <= 3; x += 1.5) L.box('metal', x, 0.16, 0.42, 0.03, 0.14, 0.1, { col: BRASS });
    for (let i = 0; i < 9; i++) { const x = -3.1 + hash(i * 3.3) * 6.2, z = -0.15 + hash(i * 7.7) * 0.3, g = hash(i * 1.9); if (g < 0.5) L.cyl('paint', x, 1.12 + 0.07, z, 0.035, 0.03, 0.14, 8, { col: C('#9aa7a0') }); else bottle(L, x, 1.12, z, g); }
    L.cyl('metal', 2.2, 1.3, 0, 0.012, 0.012, 0.36, 6, { col: BRASS }); L.cyl('metal', 2.2, 1.46, 0.07, 0.012, 0.012, 0.16, 6, { col: BRASS, rx: Math.PI / 2 });
  },
  backbar(L) {
    L.box('woodF', 0, 0.48, 0, 7.0, 0.96, 0.5, { col: WOOD_D }); L.box('woodF', 0, 1.0, 0.01, 7.04, 0.05, 0.54, { col: WOOD_M });
    L.box('woodF', 0, 1.66, -0.21, 7.0, 1.3, 0.06, { col: WOOD_D }); L.box('mirror', 0, 1.62, -0.175, 6.3, 0.9, 0.01, { col: C('#6c7374') });
    for (const y of [1.42, 1.86]) L.box('woodF', 0, y, -0.05, 6.8, 0.03, 0.26, { col: WOOD_M });
    L.box('woodF', 0, 2.3, -0.04, 7.1, 0.1, 0.4, { col: WOOD_D });
    for (let i = 0; i < 38; i++) { const row = i % 3, x = -3.3 + hash(i * 2.13) * 6.6; if (hash(i * 5.1) < 0.25) continue; bottle(L, x, [1.025, 1.435, 1.875][row], -0.06 + hash(i) * 0.08, hash(i * 9.7)); }
  },
  stool(L, it) {
    const tilt = hash(it.id) > 0.75;
    L.cyl('leather', 0, 0.76, 0, 0.19, 0.19, 0.07, 14, { col: OX }); L.cyl('metal', 0, 0.4, 0, 0.022, 0.022, 0.72, 8, { col: STEEL }); L.cyl('metal', 0, 0.02, 0, 0.19, 0.2, 0.04, 14, { col: STEEL }); L.cyl('metal', 0, 0.3, 0, 0.15, 0.15, 0.015, 14, { col: BRASS, open: true });
    void tilt;
  },
  rtable(L, it) {
    const cloth = hash(it.id) > 0.35;
    L.cyl('woodF', 0, 0.74, 0, 0.55, 0.55, 0.04, 20, { col: WOOD_M }); L.cyl('woodF', 0, 0.38, 0, 0.05, 0.07, 0.7, 10, { col: WOOD_D }); L.cyl('woodF', 0, 0.03, 0, 0.3, 0.33, 0.06, 14, { col: WOOD_D });
    if (cloth) { L.cyl('fabric', 0, 0.765, 0, 0.57, 0.57, 0.012, 20, { col: CREAM }); L.cyl('fabric', 0, 0.63, 0, 0.57, 0.63, 0.27, 20, { col: mul(CREAM, 0.9), open: true }); }
    if (hash(it.id + 3) > 0.4) { L.cyl('paint', 0.18, 0.785, 0.1, 0.11, 0.07, 0.014, 14, { col: WHITE }); L.cyl('paint', -0.2, 0.84, -0.12, 0.03, 0.035, 0.12, 8, { col: C('#9fb0aa') }); }
    L.cyl('metal', 0, 0.86, 0, 0.012, 0.03, 0.16, 8, { col: BRASS });
  },
  piano(L) {
    const lac = C('#0c0c0d');
    L.box('lacquer', 0, 0.82, -0.1, 1.5, 0.3, 1.66, { r: 0.05, col: lac }); L.box('lacquer', 0, 0.8, 0.82, 1.5, 0.12, 0.26, { col: lac });
    L.box('paint', 0, 0.875, 0.84, 1.3, 0.02, 0.15, { col: C('#d8d2c2') });
    for (let i = 0; i < 26; i++) if (i % 7 !== 2 && i % 7 !== 6) L.box('paint', -0.62 + i * 0.05, 0.892, 0.8, 0.022, 0.016, 0.09, { col: BLACK });
    L.box('lacquer', 0.1, 1.2, -0.1, 1.46, 0.03, 1.6, { col: lac, rz: 0.42, rx: 0 }); L.cyl('metal', -0.3, 1.1, 0.3, 0.008, 0.008, 0.36, 6, { col: BRASS, rz: -0.2 });
    for (const [x, z] of [[-0.6, 0.6], [0.6, 0.6], [0, -0.75]]) { L.box('lacquer', x, 0.34, z, 0.1, 0.68, 0.1, { col: lac }); L.cyl('metal', x, 0.03, z, 0.035, 0.035, 0.05, 8, { col: BRASS, rz: Math.PI / 2 }); }
    L.box('lacquer', 0, 0.52, 0.86, 0.14, 0.4, 0.04, { col: lac });
  },
  cart(L, it) {
    L.box('woodF', 0, 0.2, 0, 1.2, 0.05, 0.6, { col: WOOD_D }); L.box('fabric', 0, 0.232, 0, 1.12, 0.016, 0.52, { col: RED });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { L.cyl('paint', sx * 0.5, 0.075, sz * 0.24, 0.075, 0.075, 0.04, 10, { col: BLACK, rx: Math.PI / 2 }); L.cyl('metal', sx * 0.56, 0.95, sz * 0.26, 0.016, 0.016, 1.46, 8, { col: BRASS }); }
    for (const sz of [-1, 1]) { const g = new THREE.TorusGeometry(0.56, 0.016, 6, 18, Math.PI); L.geo('metal', g, 0, 1.68, sz * 0.26, { col: BRASS, sy: 0.14 }); }
    L.cyl('metal', 0, 1.755, 0, 0.014, 0.014, 0.52, 6, { col: BRASS, rx: Math.PI / 2 });
    const k = hash(it.id);
    L.box('leather', -0.1, 0.42, 0, 0.78, 0.36, 0.46, { r: 0.04, col: LEATHER, ry: 0.06 }); L.box('leather', 0.06, 0.72, 0.02, 0.62, 0.22, 0.4, { r: 0.04, col: k > 0.5 ? GREEN : TAN, ry: -0.1 });
    if (k > 0.3) L.box('leather', -0.05, 0.94, 0, 0.42, 0.2, 0.3, { r: 0.04, col: OX, ry: 0.3 });
    L.box('metal', -0.1, 0.42, 0.236, 0.06, 0.04, 0.01, { col: BRASS }); L.box('metal', 0.06, 0.72, 0.224, 0.05, 0.03, 0.01, { col: BRASS });
  },
  hcart(L, it) {
    const c = C('#56646b');
    L.box('paint', -0.15, 0.6, 0, 0.74, 0.9, 0.56, { col: c }); L.box('paint', -0.15, 0.6, 0.283, 0.66, 0.78, 0.008, { col: mul(c, 0.8) });
    L.box('fabric', 0.4, 0.55, 0, 0.3, 0.8, 0.5, { r: 0.12, col: C('#b9b39c') }); L.box('metal', 0.4, 0.98, 0, 0.34, 0.02, 0.54, { col: STEEL });
    for (const sx of [-0.45, 0.48]) for (const sz of [-0.24, 0.24]) L.cyl('paint', sx, 0.07, sz, 0.07, 0.07, 0.035, 10, { col: BLACK, rx: Math.PI / 2 });
    L.box('paint', -0.15, 1.065, 0, 0.78, 0.03, 0.58, { col: mul(c, 1.1) });
    L.box('fabric', -0.34, 1.13, 0.05, 0.3, 0.1, 0.36, { r: 0.03, col: WHITE }); L.box('fabric', -0.34, 1.22, 0.04, 0.29, 0.08, 0.35, { r: 0.03, col: mul(WHITE, 0.9), ry: 0.1 });
    for (let i = 0; i < 3; i++) L.cyl('paint', 0.02 + i * 0.1, 1.16, -0.1 + hash(it.id + i) * 0.2, 0.03, 0.035, 0.16, 8, { col: [C('#3e6a8a'), C('#b0a13a'), C('#a04a3a')][i] });
  },
  sideboard(L, it) {
    L.box('woodF', 0, 0.52, 0, 1.5, 0.72, 0.46, { col: WOOD_M }); L.box('woodF', 0, 0.9, 0, 1.56, 0.04, 0.5, { col: WOOD_D }); legs4(L, 'woodF', 1.5, 0.46, 0.16, 0.05, WOOD_D, 0.03);
    for (const s of [-1, 1]) { L.box('woodF', s * 0.36, 0.52, 0.232, 0.66, 0.6, 0.012, { col: WOOD_D }); L.sph('metal', s * 0.06, 0.55, 0.25, 0.015, { col: BRASS }); }
    const k = hash(it.id);
    if (k < 0.45) L.lathe('paint', -0.4, 0.92, 0, [[0, 0.06], [0.02, 0.09], [0.12, 0.075], [0.2, 0.03], [0.26, 0.045]], 12, { col: C(k < 0.2 ? '#27433f' : '#7a5a34') });
    else { for (let i = 0; i < 4; i++) L.box('paint', -0.45 + i * 0.01, 0.935 + i * 0.03, 0.02, 0.26 - i * 0.02, 0.03, 0.19, { col: [RED, GREEN, TAN, BLUE][i], ry: (hash(i + it.id) - 0.5) * 0.5 }); }
    if (k > 0.3) L.box('metal', 0.42, 0.96, 0, 0.2, 0.08, 0.14, { col: BRASS, r: 0.01 });
  },
  crate(L, it) { crate(L, 0, 0, 0, 1.0, 0.9, 0.75, hash(it.id)); },
  crate2(L, it) { crate(L, 0, 0, 0, 1.0, 0.9, 0.75, hash(it.id)); crate(L, 0.03, 0.9, -0.02, 0.92, 0.8, 0.7, hash(it.id + 5), 0.07); },
  sheet(L, it) {
    const k = hash(it.id);
    L.box('fabric', 0, 0.5, 0, 1.7, 1.0, 0.95, { r: 0.2, col: SHEET, tess: 0.35 }); L.box('fabric', -0.3 + k * 0.5, 0.86, -0.1, 0.9, 0.6, 0.6, { r: 0.22, col: mul(SHEET, 0.96) });
    L.box('fabric', 0, 0.05, 0, 1.86, 0.1, 1.08, { r: 0.05, col: mul(SHEET, 0.9) });
    if (k > 0.5) L.box('fabric', 0.55, 0.7, 0.2, 0.5, 0.75, 0.5, { r: 0.2, col: mul(SHEET, 0.92) });
  },
  plant(L, it) {
    L.lathe('paint', 0, 0, 0, [[0.14, 0], [0.2, 0.05], [0.26, 0.4], [0.27, 0.46], [0.22, 0.46]], 14, { col: C('#70402c') }); L.cyl('paint', 0, 0.43, 0, 0.22, 0.22, 0.02, 12, { col: C('#241a12') });
    L.cyl('woodF', 0, 0.85, 0, 0.022, 0.035, 0.8, 6, { col: C('#4b3a22'), rz: 0.05 });
    for (let i = 0; i < 9; i++) { const a = i * 2.4 + hash(it.id + i), droop = 0.9 + hash(i * 3 + it.id) * 0.9, len = 0.5 + hash(i) * 0.3;
      L.box('paint', Math.cos(a) * len * 0.42, 1.25 - droop * 0.16, Math.sin(a) * len * 0.42, len, 0.012, 0.09, { col: C(i % 3 ? '#4a4424' : '#5a3d20'), ry: -a, rz: -droop * 0.75 }); }
  },
  pool(L) {
    L.box('woodF', 0, 0.62, 0, 2.5, 0.36, 1.35, { col: WOOD_D }); L.box('fabric', 0, 0.812, 0, 2.26, 0.02, 1.12, { col: C('#1f5a3c') });
    L.box('woodF', 0, 0.82, 0.62, 2.5, 0.06, 0.11, { col: WOOD_M }); L.box('woodF', 0, 0.82, -0.62, 2.5, 0.06, 0.11, { col: WOOD_M }); L.box('woodF', 1.195, 0.82, 0, 0.11, 0.06, 1.13, { col: WOOD_M }); L.box('woodF', -1.195, 0.82, 0, 0.11, 0.06, 1.13, { col: WOOD_M });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box('woodF', sx * 1.05, 0.22, sz * 0.5, 0.2, 0.44, 0.2, { col: WOOD_D });
    const cols = ['#d8d0b8', '#b02a22', '#c7a22a', '#1d3f8a', '#141414', '#2a6a3a', '#7a2a6a'];
    for (let i = 0; i < 7; i++) L.sph('lacquer', -0.8 + hash(i * 4.1) * 1.6, 0.85, -0.4 + hash(i * 9.3) * 0.8, 0.0286, { col: C(cols[i]), ws: 10, hs: 6 });
    L.cyl('woodF', 0.3, 0.85, 0.25, 0.007, 0.013, 1.45, 6, { col: WOOD_L, rz: Math.PI / 2, ry: 0.5 });
  },
  booth(L) {
    L.box('woodF', 0, 0.2, 0, 1.7, 0.4, 0.62, { col: WOOD_D }); L.box('leather', 0, 0.47, 0.03, 1.64, 0.16, 0.56, { r: 0.06, col: OX });
    L.box('leather', 0, 0.84, -0.24, 1.66, 0.62, 0.14, { r: 0.06, col: OX }); for (let i = -2; i <= 2; i++) L.sph('metal', i * 0.36, 0.9, -0.165, 0.014, { col: BRASS, ws: 6, hs: 4 });
    L.box('woodF', 0, 1.17, -0.26, 1.72, 0.05, 0.16, { col: WOOD_D });
  },
  barricade(L) {
    L.box('woodF', -0.7, 0.62, 0.05, 1.3, 0.05, 1.22, { col: WOOD_M, rx: Math.PI / 2 - 0.16 }); L.cyl('woodF', -0.7, 0.62, -0.25, 0.05, 0.07, 0.6, 8, { col: WOOD_D, rx: Math.PI / 2 - 0.16 });
    L.box('woodF', 0.75, 0.6, -0.02, 1.2, 0.05, 1.2, { col: WOOD_D, rx: Math.PI / 2 + 0.2, ry: 0.1 });
    L.box('woodF', 0, 1.25, 0.1, 2.9, 0.16, 0.035, { col: WOOD_L, rz: 0.13 }); L.box('woodF', 0.1, 0.85, 0.2, 2.8, 0.16, 0.035, { col: WOOD_L, rz: -0.1 }); L.box('woodF', -0.2, 0.4, 0.26, 2.6, 0.16, 0.035, { col: mul(WOOD_L, 0.8), rz: 0.04 });
    crate(L, 1.05, 0, 0.1, 0.7, 0.6, 0.55, 0.3); L.box('fabric', -1.2, 0.3, 0.1, 0.55, 0.6, 0.5, { r: 0.18, col: C('#8a7f62') }); L.box('fabric', -1.15, 0.78, 0.06, 0.5, 0.42, 0.46, { r: 0.18, col: C('#7c7257') });
    L.box('woodF', 0.3, 1.42, -0.1, 0.44, 0.44, 0.44, { col: WOOD_D, rz: 0.5, rx: 0.4 });
  },
  buffet(L, it) {
    L.box('woodF', 0, 0.46, 0, 2.4, 0.84, 0.58, { col: WOOD_M }); L.box('woodF', 0, 0.93, 0, 2.46, 0.04, 0.62, { col: WOOD_D });
    for (let i = -1; i <= 1; i++) { L.box('woodF', i * 0.78, 0.46, 0.292, 0.7, 0.66, 0.012, { col: WOOD_D }); L.sph('metal', i * 0.78, 0.6, 0.31, 0.015, { col: BRASS }); }
    for (const x of [-0.7, 0.2]) { L.box('metal', x, 1.0, 0, 0.5, 0.1, 0.34, { col: STEEL, r: 0.02 }); L.box('metal', x, 1.09, 0, 0.5, 0.08, 0.34, { col: STEEL, r: 0.04 }); L.sph('metal', x, 1.14, 0, 0.02, { col: BRASS }); }
    for (let i = 0; i < 6; i++) L.cyl('paint', 0.9, 0.955 + i * 0.012, 0.02 + hash(i + it.id) * 0.01, 0.12, 0.12, 0.01, 14, { col: WHITE });
  },
};
function bottle(L, x, y, z, k) {
  const col = C(['#23492c', '#5a3515', '#1a2c38', '#7a6a2a', '#4a1414'][(k * 5) | 0]), h = 0.2 + k * 0.08;
  L.cyl('glassy', x, y + h / 2, z, 0.034, 0.034, h, 8, { col }); L.cyl('glassy', x, y + h + 0.045, z, 0.012, 0.03, 0.09, 8, { col });
}
function crate(L, x, y, z, w, h, d, k, ry = 0) {
  const c = mul(WOOD_L, 0.75 + k * 0.4);
  L.box('woodF', x, y + h / 2, z, w - 0.04, h - 0.04, d - 0.04, { col: mul(c, 0.8), ry });
  for (const sy of [0.09, h - 0.09]) for (const sz of [-1, 1]) L.box('woodF', x + sz * Math.sin(ry) * (d / 2 - 0.01), y + sy, z + sz * Math.cos(ry) * (d / 2 - 0.01), w, 0.12, 0.03, { col: c, ry });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box('woodF', x + sx * Math.cos(ry) * (w / 2 - 0.05) + sz * Math.sin(ry) * (d / 2 - 0.02), y + h / 2, z - sx * Math.sin(ry) * (w / 2 - 0.05) + sz * Math.cos(ry) * (d / 2 - 0.02), 0.1, h, 0.04, { col: c, ry });
  L.box('woodF', x, y + h - 0.01, z, w, 0.03, d, { col: c, ry });
}

// 燈具：wd = 指向牆的方向（壁燈）。shade 用 unlit 材質，顏色 > 1 會被 bloom 吃到。
export function fixture(L, l, wd, ceilY) {
  const shade = 'shade', glow = 'glow';
  const sc = mul(l.col, 1.5), gc = mul(l.col, 7);
  if (l.kind === 'sconce') {
    const ax = wd[0], az = wd[1], ry = Math.atan2(-ax, -az); // 局部 +z 朝外
    L.box('metal', ax * 0.125, -0.12, az * 0.125, 0.09, 0.24, 0.02, { col: BRASS, ry }); L.cyl('metal', ax * 0.07, -0.16, az * 0.07, 0.01, 0.01, 0.12, 6, { col: BRASS, rx: Math.PI / 2, ry });
    L.cyl('metal', 0, -0.13, 0, 0.012, 0.02, 0.08, 8, { col: BRASS });
    L.cyl(shade, 0, 0.0, 0, 0.065, 0.115, 0.17, 14, { col: sc, open: true }); L.sph(glow, 0, -0.02, 0, 0.035, { col: gc, ws: 8, hs: 6 });
  } else if (l.kind === 'table') {
    L.lathe('paint', 0, -0.42, 0, [[0.07, 0], [0.075, 0.02], [0.03, 0.06], [0.055, 0.16], [0.02, 0.26], [0.012, 0.34]], 12, { col: C('#27433f') });
    L.cyl(shade, 0, 0.02, 0, 0.1, 0.17, 0.2, 16, { col: sc, open: true }); L.sph(glow, 0, -0.02, 0, 0.035, { col: gc, ws: 8, hs: 6 });
  } else if (l.kind === 'floor') {
    L.cyl('metal', 0, -l.y + 0.02, 0, 0.15, 0.17, 0.04, 14, { col: BRASS }); L.cyl('metal', 0, -l.y / 2, 0, 0.014, 0.014, l.y - 0.1, 8, { col: BRASS });
    L.cyl(shade, 0, 0.02, 0, 0.14, 0.24, 0.28, 16, { col: sc, open: true }); L.sph(glow, 0, -0.03, 0, 0.04, { col: gc, ws: 8, hs: 6 });
  } else if (l.kind === 'ceil') {
    const dy = ceilY - l.y;
    L.cyl('metal', 0, dy - 0.02, 0, 0.2, 0.22, 0.04, 16, { col: BRASS }); L.sph(shade, 0, dy - 0.04, 0, 0.17, { col: mul(l.col, 2.4), ws: 14, hs: 8, t0: Math.PI / 2, tl: Math.PI / 2 });
  } else if (l.kind === 'pendant') {
    const dy = ceilY - l.y;
    L.cyl('paint', 0, dy / 2 + 0.1, 0, 0.006, 0.006, dy - 0.2, 5, { col: BLACK }); L.cyl('metal', 0, 0.09, 0, 0.03, 0.2, 0.16, 16, { col: C('#1f3a30'), open: true }); L.cyl('metal', 0, 0.19, 0, 0.03, 0.03, 0.06, 8, { col: BRASS });
    L.sph(glow, 0, 0.02, 0, 0.045, { col: gc, ws: 8, hs: 6 }); L.cyl(shade, 0, 0.085, 0, 0.028, 0.19, 0.15, 16, { col: mul(l.col, 0.9), open: true, sx: 0.98, sz: 0.98 });
  } else if (l.kind === 'desk') {
    L.cyl('metal', 0, -0.33, 0, 0.09, 0.1, 0.02, 12, { col: BRASS }); L.cyl('metal', 0, -0.2, -0.06, 0.008, 0.008, 0.26, 6, { col: BRASS, rx: 0.3 });
    L.cyl(shade, 0, -0.03, 0, 0.055, 0.055, 0.3, 10, { col: mul(l.col, 1.3), rz: Math.PI / 2, open: true }); L.cyl(glow, 0, -0.06, 0, 0.012, 0.012, 0.24, 6, { col: mul([1, 0.9, 0.7], 6), rz: Math.PI / 2 });
  }
}
export function chandelier(L, d) {
  const r = d.r, small = !!d.small, tiers = small ? 1 : 3;
  L.cyl('metal', 0, small ? 0.3 : 1.2, 0, 0.012, 0.012, small ? 0.6 : 1.6, 6, { col: BRASS });
  for (let t = 0; t < tiers; t++) {
    const rr = r * (1 - t * 0.28), y = t * 0.42, n = small ? 8 : 16 - t * 4;
    L.geo('metal', new THREE.TorusGeometry(rr, 0.02, 6, 32), 0, y, 0, { col: BRASS, rx: Math.PI / 2 });
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.2832 + t * 0.3, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      L.cyl('metal', x, y + 0.05, z, 0.008, 0.014, 0.1, 6, { col: BRASS });
      if (d.lamp !== undefined) L.tag(d.lamp + 0.06 + 0.88 * hash(i * 7.3 + t * 31.1)); // 吊燈被打中時燈泡一顆顆熄
      L.sph('glow', x, y + 0.14, z, small ? 0.03 : 0.04, { col: [7, 4.6, 2.2], ws: 6, hs: 5 });
      L.cyl('glassy', x * 1.04, y - 0.1, z * 1.04, 0.012, 0.003, 0.14, 5, { col: [0.9, 0.85, 0.75] });
    }
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.2832 + 0.4; L.cyl('metal', Math.cos(a) * rr / 2, y + (small ? 0.3 : 0.6 - t * 0.1), Math.sin(a) * rr / 2, 0.006, 0.006, Math.hypot(rr, 0.8), 4, { col: BRASS, rz: Math.cos(a) * 0.9, rx: -Math.sin(a) * 0.9 }); }
  }
  if (!small) L.sph('glassy', 0, -0.35, 0, 0.12, { col: [0.9, 0.85, 0.75], ws: 10, hs: 8 });
}
