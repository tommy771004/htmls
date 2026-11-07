// 地圖視覺：地面、建築量體、牆、階梯是合併的程式幾何（世界座標 UV），組件全部 thin instance。
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { Kit, pbr } from './kit.js';
import { Bucket, box, ramp, wall, dome, hipRoof, WHITE } from './geo.js';
import { coverBase, wallPieces, COVER_DIMS, SLAB } from './query.js';
import kitMeta from './kit-meta.json' with { type: 'json' };

// 貼圖實際尺寸（公尺），見 credits/textures.md
const SIZE = { sandstone: 3, plaster: 2.6, whitewash: 3.6, ashlar: 2, brick: 2, flag: 2, cobble: 1.6, sand: 1.8, wood: 1.6, tile: 2 };

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const GROUND_TINT = {};
const STYLE_TINT = {
  sandstone: [1.0, 1.0, 1.02], ashlar: [0.98, 0.95, 0.9], plaster: [1.05, 1.0, 0.92],
  whitewash: [1.0, 0.97, 0.9], brick: [0.95, 0.9, 0.86],
};

export async function buildMap(ctx, L, seed = 278) {
  const { scene } = ctx, shadow = new URLSearchParams(location.search).has('noshadow') ? null : ctx.shadow, R = rng(seed);
  const kit = new Kit(scene);
  await kit.load(kitMeta);

  const B = {}; const bucket = (id, tex = id) => B[id] ??= new Bucket(id, SIZE[tex] ?? 2);
  const tintOf = (style, k = 0.12) => { const c = STYLE_TINT[style] ?? STYLE_TINT.sandstone, v = 1 - k / 2 + R() * k; return [c[0] * v, c[1] * v, c[2] * v * (0.98 + R() * 0.04)]; };

  // 地面板
  const STYLE = s => s === 'brick' ? (R() < 0.3 ? 'plaster' : 'sandstone') : s === 'plaster' && R() < 0.65 ? 'sandstone' : s === 'whitewash' && R() < 0.5 ? 'sandstone' : s;
  const under = bucket('ashlar');
  for (const g of L.ground) {
    const mat = g.mat === 'plank' ? 'wood' : g.mat === 'cobble' ? 'flag' : g.mat;
    box(under, g.x0, g.y - SLAB, g.z0, g.x1, g.y, g.z1, WHITE, 'tbewns', bucket(mat));
  }
  // 階梯與斜坡
  for (const r of L.ramps) ramp(bucket(r.kind === 'stairs' ? 'ashlar' : 'flag'), bucket('ashlar'), r);

  // 建築量體
  const tiles = bucket('roof', 'tile');
  for (const b of L.blocks) {
    const st = STYLE(b.style), s = bucket(st), t = tintOf(st), e = 0.002 + R() * 0.008;
    const x0 = b.x0 + e, x1 = b.x1 - e, z0 = b.z0 + e, z1 = b.z1 - e, dx = x1 - x0, dz = z1 - z0;
    if (b.plinth) { box(s, x0, b.y0, z0, x1, b.y1, z1, t, 'ewns'); continue; }
    box(s, x0, b.y0, z0, x1, b.y1, z1, t, 'tewns');
    const y = b.y1;
    if (b.roof === 'parapet') {
      const th = 0.32, h = 0.85;
      box(s, x0, y, z0, x1, y + h, z0 + th, t); box(s, x0, y, z1 - th, x1, y + h, z1, t);
      box(s, x0, y, z0 + th, x0 + th, y + h, z1 - th, t); box(s, x1 - th, y, z0 + th, x1, y + h, z1 - th, t);
    } else if (b.roof === 'dome') {
      dome(bucket('whitewash'), (x0 + x1) / 2, y, (z0 + z1) / 2, dx * 0.44, dz * 0.44, Math.min(dx, dz) * 0.42, tintOf('whitewash', 0.06));
    } else if (b.roof === 'tile') {
      hipRoof(tiles, x0 - 0.25, y, z0 - 0.25, x1 + 0.25, z1 + 0.25, Math.min(dx, dz) * 0.2, [0.78 + R() * 0.1, 0.40, 0.27]);
    }
    decorate(kit, b, R, L.blocks);
  }

  // 牆
  for (const w of L.walls) {
    const st = STYLE(w.style); wall(bucket(st), w, wallPieces(w), tintOf(st, 0.05));
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az), ux = (w.bx - w.ax) / len, uz = (w.bz - w.az) / len;
    for (const o of w.openings ?? []) {
      if (o.kind !== 'arch' && o.kind !== 'gate') continue;
      const cx = w.ax + ux * o.at, cz = w.az + uz * o.at, rot = Math.atan2(uz, ux) * -180 / Math.PI, k = o.w / 2.4 * 0.985;
      const ny = Math.min(1, o.h / (3.3 * k));
      for (const side of [-1, 1]) kit.put('arch_frame', cx + uz * side * (w.t / 2 + 0.02), w.y0 + (o.sill || 0), cz - ux * side * (w.t / 2 + 0.02), rot + (side > 0 ? 180 : 0), k, k * Math.max(ny, 0.9), 1);
    }
  }

  // 掩體
  const COVER_KIT = { crate1: ['crate1', 0.8], crate125: ['crate_wood', 1], crate2: ['crate2', 1], mil: ['mil', 0.92], barrel: ['barrel', 1], cart: ['cart', 1], well: ['well', 1], stone: ['stone', 1], planter: ['planter', 1], sandbag: ['sandbag', 0.96] };
  for (const c of L.cover) {
    const y = coverBase(L, c), d = COVER_DIMS[c.kind];
    if (c.kind === 'sundial') { kit.put('sundial', c.x, y, c.z, c.rot, 6 / 7, 6 / 7 * 1.25, 6 / 7); continue; }
    if (c.kind === 'gnomon') continue;
    const [id, k] = COVER_KIT[c.kind] ?? [];
    if (!id) continue;
    for (let i = 0; i < (c.stack || 1); i++) {
      const alt = id === 'crate1' && R() < 0.35 ? 'crate_wood' : id === 'crate_wood' && R() < 0.4 ? 'crate_mil' : id;
      kit.put(alt, c.x, y + i * d.h, c.z, c.rot + (i ? (R() - 0.5) * 8 : 0), alt === 'crate_wood' && id === 'crate1' ? 0.8 : k);
    }
  }

  // 陳設
  const DECO = { palm: 'palm', lantern: 'lantern', awning: 'awning_striped', banner: 'banner', pot: 'pot', bench: 'bench', shutter: 'shutter', door: 'door_a' };
  for (const d of L.deco) {
    if (d.kind === 'wire') { const ex = d.rot === 90 ? 3 : 0.015, ez = d.rot === 90 ? 0.015 : 3; box(bucket('metal', 'wood'), d.x - ex, d.y - 0.015, d.z - ez, d.x + ex, d.y + 0.015, d.z + ez); continue; }
    if (d.kind === 'rack') {
      const ca = bucket('wood');
      box(ca, d.x - 1.5, d.y, d.z - 0.04, d.x - 1.42, d.y + 2.2, d.z + 0.04); box(ca, d.x + 1.42, d.y, d.z - 0.04, d.x + 1.5, d.y + 2.2, d.z + 0.04);
      box(ca, d.x - 1.5, d.y + 2.16, d.z - 0.03, d.x + 1.5, d.y + 2.22, d.z + 0.03);
      kit.put('banner', d.x - 0.6, d.y + 0.15, d.z, d.rot, 1, 0.82, 1); kit.put('banner', d.x + 0.65, d.y + 0.2, d.z, d.rot, 1.1, 0.8, 1);
      continue;
    }
    const id = DECO[d.kind];
    const push = d.kind === 'door' ? 0.13 : 0, ra = (d.rot ?? 0) * Math.PI / 180;
    if (id) kit.put(id, d.x + Math.sin(ra) * push, d.y, d.z + Math.cos(ra) * push, d.rot, d.kind === 'palm' ? d.scale * 0.72 : d.scale);
  }

  // 紅漆 A / B：地面貼花用兩條盒子拼字太假，先用 kit 的旗幟與地面色塊標位，貼花在 fx 階段補
  for (const n of ['A', 'B']) paint(ctx, n, L.sites[n]);
  // 程式幾何轉 mesh
  const matFor = (id) => {
    const tex = id === 'metal' ? 'metal' : id === 'roof' ? 'tile' : id;
    const m = pbr(scene, 'g_' + id, tex, { vertexColors: true, tint: id === 'roof' ? [1, 0.72, 0.6] : GROUND_TINT[id] });
    if (id === 'flag') m.albedoTexture.level = 1.12;
    
    return m;
  };
  const made = [];
  for (const [id, b] of Object.entries(B)) {
    const m = new Mesh('map_' + id, scene), v = new VertexData();
    v.positions = new Float32Array(b.p); v.normals = new Float32Array(b.n); v.uvs = new Float32Array(b.uv);
    v.colors = new Float32Array(b.c); v.indices = b.p.length / 3 > 65535 ? new Uint32Array(b.i) : new Uint16Array(b.i);
    v.applyToMesh(m, false);
    m.material = matFor(id); m.receiveShadows = true; m.isPickable = false;
    m.alwaysSelectAsActiveMesh = true; m.doNotSyncBoundingInfo = true; m.freezeWorldMatrix();
    shadow?.addShadowCaster?.(m, false);
    made.push(m);
  }
  const instances = kit.commit(shadow);
  await scene.whenReadyAsync();
  if (!new URLSearchParams(location.search).has('nofreeze')) for (const m of scene.materials) if (m.freeze && m.name !== 'sky') m.freeze();
  return { kit, instances, tris: made.reduce((n, m) => n + m.getTotalIndices() / 3, 0) };
}

// 紅漆字：地面一大塊，邊緣粗糙像噴漆。
function paint(ctx, letter, s) {
  const { scene } = ctx, S = 512, t = new DynamicTexture('paint' + letter, S, scene, true), c = t.getContext();
  c.clearRect(0, 0, S, S); c.font = '900 430px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#7d2115'; c.fillText(letter, S / 2, S / 2 + 20);
  c.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2600; i++) { c.beginPath(); c.arc(Math.random() * S, Math.random() * S, Math.random() * 4.5, 0, 6.3); c.fill(); }
  t.update(false); t.hasAlpha = true;
  const m = MeshBuilder.CreateGround('paint' + letter, { width: 5, height: 5 }, scene), mat = pbr(scene, 'paint' + letter + 'M', null, { rough: 0.8 });
  mat.albedoTexture = t; mat.useAlphaFromAlbedoTexture = true; mat.transparencyMode = 2; mat.zOffset = -3; mat.albedoTexture.level = 1;
  m.material = mat; m.position.set((s.x0 + s.x1) / 2, s.y + 0.03, (s.z0 + s.z1) / 2); m.receiveShadows = true; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.freezeWorldMatrix();
}

// 每棟建築在 4 m 網格上放窗、門、簷、空調。
function decorate(kit, b, R, blocks) {
  const covered = (x, y, z) => { for (const o of blocks) if (o !== b && x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && y > o.y0 - 0.5 && y < o.y1 + 0.5) return true; return false; };
  const sides = [
    { n: 'n', x0: b.x0, x1: b.x1, z: b.z1, rot: 0, dx: 1, dz: 0 }, { n: 's', x0: b.x0, x1: b.x1, z: b.z0, rot: 180, dx: 1, dz: 0 },
    { n: 'e', z0: b.z0, z1: b.z1, x: b.x1, rot: 90, dx: 0, dz: 1 }, { n: 'w', z0: b.z0, z1: b.z1, x: b.x0, rot: 270, dx: 0, dz: 1 },
  ];
  for (const s of sides) {
    const len = s.dx ? s.x1 - s.x0 : s.z1 - s.z0, n = Math.floor(len / 4), ox = s.dx ? s.x0 : s.x, oz = s.dz ? s.z0 : s.z;
    const P = (u) => [ox + s.dx * u, oz + s.dz * u], ox2 = s.n === 'e' ? 0.5 : s.n === 'w' ? -0.5 : 0, oz2 = s.n === 'n' ? 0.5 : s.n === 's' ? -0.5 : 0;
    for (let i = 0; i < n; i++) {
      const u = (len - n * 4) / 2 + 2 + i * 4, [x, z] = P(u);
      if (!covered(x + ox2, b.y1 - 0.3, z + oz2)) kit.put(b.roof === 'tile' ? 'roof_trim' : 'ledge_2m', x, b.y1 - (b.roof === 'tile' ? 0.3 : 0.25), z, s.rot, b.roof === 'tile' ? 0.98 : 2);
      for (let y = Math.max(b.y0 + 4.6, 3.2 + Math.round(b.y0)); y < b.y1 - 2.4; y += 4) {
        if (covered(x + ox2, y + 0.9, z + oz2)) continue;
        const r = R();
        const wx = x + ox2 * 0.22, wz = z + oz2 * 0.22;   // 模型以中心對齊，推出牆面才看得到框與玻璃
        if (r < 0.22) kit.put('window_a', wx, y, wz, s.rot);
        else if (r < 0.36) kit.put('window_b', wx, y, wz, s.rot);
        else if (r < 0.46) kit.put('window_c', wx, y + 0.7, wz, s.rot);
        else if (r < 0.52) kit.put('ac_unit', x + 0.2, y + 0.4, z, s.rot);
      }
    }
  }
}
