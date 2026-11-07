// kit.glb：幾何烘成無父節點的 mesh，材質換成共用貼圖，全部以 thin instance 擺放。
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { Material } from '@babylonjs/core/Materials/material.js';
import { ASSET_BASE } from '../core/assets.js';

const TEX = new Map();
function tex(scene, file) {
  let t = TEX.get(file);
  if (!t) {
    t = new Texture(ASSET_BASE + 'tex/' + file, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
    t.anisotropicFilteringLevel = 16; TEX.set(file, t);
  }
  return t;
}

/** 依貼圖 id 建 PBR 材質。 */
export function pbr(scene, name, id, { tint, twoSided = false, vertexColors = false, mapsOnly = true, rough } = {}) {
  const m = new PBRMaterial(name, scene);
  if (id === 'palm') {
    m.albedoTexture = tex(scene, 'palm_a.webp'); m.albedoTexture.hasAlpha = true;
    m.useAlphaFromAlbedoTexture = true; m.transparencyMode = Material.MATERIAL_ALPHATEST; m.alphaCutOff = 0.45;
    m.metallic = 0; m.roughness = 0.75; m.backFaceCulling = false; m.twoSidedLighting = true;
  } else if (id) {
    m.albedoTexture = tex(scene, id + '_a.webp');
    m.bumpTexture = tex(scene, id + '_n.webp');
    m.metallicTexture = tex(scene, id + '_orm.webp');
    m.useRoughnessFromMetallicTextureGreen = true; m.useMetallnessFromMetallicTextureBlue = true;
    m.useAmbientOcclusionFromMetallicTextureRed = true; m.useRoughnessFromMetallicTextureAlpha = false;
    m.metallic = 1; m.roughness = 1;
    m.invertNormalMapX = true;
  } else { m.metallic = 0; m.roughness = rough ?? 0.25; }
  if (tint) m.albedoColor = new Color3(tint[0], tint[1], tint[2]);
  if (twoSided) { m.backFaceCulling = false; m.twoSidedLighting = true; }
  if (vertexColors) m.useVertexColors = true;
  m.environmentIntensity = 1;
  return m;
}

export class Kit {
  constructor(scene) { this.scene = scene; this.parts = new Map(); this.queue = new Map(); this.mats = new Map(); }

  async load(meta) {
    const c = await LoadAssetContainerAsync(ASSET_BASE + 'models/kit.glb', this.scene, { pluginExtension: '.glb' });
    c.addAllToScene();
    const old = new Set();
    for (const m of c.meshes) {
      if (!m.geometry || !m.getTotalVertices()) continue;
      const id = m.name.replace(/_primitive\d+$/, '');
      const w = m.computeWorldMatrix(true).clone();
      m.makeGeometryUnique(); m.setParent(null);
      m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1);
      m.bakeTransformIntoVertices(w);
      m.computeWorldMatrix(true);
      const name = m.material?.name || 'glass';
      if (m.material) old.add(m.material);
      m.material = this.mat(name, meta.materials[name]);
      m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.doNotSyncBoundingInfo = true;
      if (!this.parts.has(id)) this.parts.set(id, []);
      this.parts.get(id).push(m);
    }
    for (const m of c.meshes) if (!m.geometry) m.dispose(false, false);
    for (const t of c.transformNodes) t.dispose(false, false);
    for (const m of old) m.dispose(false, true);
  }

  mat(name, info) {
    let m = this.mats.get(name);
    if (m) return m;
    m = pbr(this.scene, 'k_' + name, info?.tex ?? (name === 'glass' ? null : name.split('@')[0]), { tint: info?.tint, twoSided: info?.twoSided, rough: 0.12 });
    if (info?.tex === 'wood') m.albedoTexture.level = 1.8; else if (info?.tex === 'military') m.albedoTexture.level = 1.5;
    this.mats.set(name, m);
    return m;
  }

  /** rot 度，sy 省略為等比。 */
  put(id, x, y, z, rot = 0, sx = 1, sy = sx, sz = sx) {
    if (!this.parts.has(id)) { console.warn('kit 缺件', id); return; }
    let q = this.queue.get(id);
    if (!q) this.queue.set(id, q = []);
    q.push(x, y, z, rot, sx, sy, sz);
  }

  commit(shadow) {
    const s = new Vector3(), t = new Vector3(), r = new Quaternion(), mat = new Matrix();
    let instances = 0;
    for (const [id, meshes] of this.parts) {
      const q = this.queue.get(id);
      if (!q) { for (const m of meshes) m.dispose(false, false); continue; }
      const n = q.length / 7, buf = new Float32Array(n * 16);
      for (let i = 0; i < n; i++) {
        const k = i * 7;
        t.set(q[k], q[k + 1], q[k + 2]); s.set(q[k + 4], q[k + 5], q[k + 6]);
        Quaternion.RotationYawPitchRollToRef(q[k + 3] * Math.PI / 180, 0, 0, r);
        Matrix.ComposeToRef(s, r, t, mat); mat.copyToArray(buf, i * 16);
      }
      for (const m of meshes) {
        m.thinInstanceSetBuffer('matrix', buf, 16, true);
        m.thinInstanceRefreshBoundingInfo?.(false);
        m.freezeWorldMatrix();
        m.receiveShadows = true;
        if (m.material.name !== 'k_glass') shadow?.addShadowCaster?.(m, false);
      }
      instances += n;
    }
    return instances;
  }
}
