// 程式化幾何組裝工具 GeoKit（依材質分桶合併成單一 BufferGeometry，極小化 Draw Calls）
// 以及接觸陰影貼片池 ContactDecals（InstancedMesh）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();

/**
 * 將幾何統一為非索引或乾淨的 position + normal + uv，確保不同基礎幾何能安全 mergeGeometries
 */
export function normalizeGeo(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  // 移除多餘屬性（如 tangent），避免合併衝突
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') {
      g.deleteAttribute(key);
    }
  }
  return g;
}

export class GeoKit {
  constructor() {
    this.buckets = new Map();
    this._unitBox = normalizeGeo(new THREE.BoxGeometry(1, 1, 1));
    this._cylCache = new Map();
  }

  _getCyl(rt, rb, seg) {
    const k = `${rt}_${rb}_${seg}`;
    let g = this._cylCache.get(k);
    if (!g) {
      g = normalizeGeo(new THREE.CylinderGeometry(rt, rb, 1, seg));
      this._cylCache.set(k, g);
    }
    return g;
  }

  addGeo(matKey, srcGeo, matrix) {
    const g = normalizeGeo(srcGeo);
    if (matrix) g.applyMatrix4(matrix);
    let list = this.buckets.get(matKey);
    if (!list) {
      list = [];
      this.buckets.set(matKey, list);
    }
    list.push(g);
  }

  box(matKey, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    _pos.set(x, y, z);
    _euler.set(rx, ry, rz);
    _quat.setFromEuler(_euler);
    _scl.set(sx, sy, sz);
    _m4.compose(_pos, _quat, _scl);
    const g = this._unitBox.clone();
    g.applyMatrix4(_m4);
    let list = this.buckets.get(matKey);
    if (!list) {
      list = [];
      this.buckets.set(matKey, list);
    }
    list.push(g);
  }

  /** 以底部中心 y0 放置方塊 */
  boxBase(matKey, x, y0, z, sx, sy, sz, ry = 0) {
    this.box(matKey, x, y0 + sy * 0.5, z, sx, sy, sz, 0, ry, 0);
  }

  cyl(matKey, x, y, z, rt, rb, h, seg = 16, rx = 0, ry = 0, rz = 0) {
    _pos.set(x, y, z);
    _euler.set(rx, ry, rz);
    _quat.setFromEuler(_euler);
    _scl.set(1, h, 1);
    _m4.compose(_pos, _quat, _scl);
    const g = this._getCyl(rt, rb, seg).clone();
    g.applyMatrix4(_m4);
    let list = this.buckets.get(matKey);
    if (!list) {
      list = [];
      this.buckets.set(matKey, list);
    }
    list.push(g);
  }

  /** 以底部中心 y0 放置圓柱 */
  cylBase(matKey, x, y0, z, rt, rb, h, seg = 16, ry = 0) {
    this.cyl(matKey, x, y0 + h * 0.5, z, rt, rb, h, seg, 0, ry, 0);
  }

  /**
   * 輸出合併後的 Mesh 群組，每種材質僅 1 個 Mesh（1 Draw Call）
   */
  build(materials, { castShadow = true, receiveShadow = true, shadowMapByKey = {} } = {}) {
    const group = new THREE.Group();
    for (const [matKey, list] of this.buckets.entries()) {
      if (!list.length) continue;
      const mat = materials[matKey];
      if (!mat) {
        console.warn(`[GeoKit] 找不到材質: ${matKey}`);
        continue;
      }
      const merged = mergeGeometries(list, false);
      for (const item of list) item.dispose();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.name = `batch_${matKey}`;
      const cfg = shadowMapByKey[matKey] || {};
      mesh.castShadow = cfg.castShadow !== undefined ? cfg.castShadow : castShadow;
      mesh.receiveShadow = cfg.receiveShadow !== undefined ? cfg.receiveShadow : receiveShadow;
      group.add(mesh);
    }
    this.buckets.clear();
    return group;
  }
}

/**
 * 接觸陰影貼片池（Contact Shadow Decals）：
 * 在建築基座、高架橋墩、噴泉、涼亭、行道樹穴、露天傘座與長椅下方鋪設柔和橢圓／矩形接觸遮蔽，
 * 與螢幕空間 GTAO 互補，低畫質關閉全螢幕 GTAO 時仍保有紮實的接地立體感。
 */
export class ContactDecals {
  constructor() {
    this.items = [];
  }

  add(x, y, z, sx, sz, opacity = 0.36, ry = 0) {
    this.items.push({ x, y, z, sx, sz, opacity, ry });
  }

  build(material) {
    const count = this.items.length;
    if (!count) return new THREE.Group();
    const plane = new THREE.PlaneGeometry(1, 1);
    plane.rotateX(-Math.PI * 0.5);
    const mesh = new THREE.InstancedMesh(plane, material, count);
    mesh.name = 'contact_ao_decals';
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = 1;

    const strengths = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const it = this.items[i];
      _pos.set(it.x, it.y, it.z);
      _euler.set(0, it.ry, 0);
      _quat.setFromEuler(_euler);
      _scl.set(it.sx, 1, it.sz);
      _m4.compose(_pos, _quat, _scl);
      mesh.setMatrixAt(i, _m4);
      strengths[i] = it.opacity;
    }
    plane.setAttribute('aStrength', new THREE.InstancedBufferAttribute(strengths, 1));
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
}
