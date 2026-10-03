import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeStatic } from '../core/merge.js';

/**
 * 外部 GLB 模型清單。換模型時只要覆蓋 public/models 下的同名檔，再視需要調這裡：
 *   size     — 縮放後「最長邊」的公尺數（不管原檔用什麼單位建模）
 *   anchor   — 原點落在 bounding box 的哪個比例位置 [x, y, z]（0..1）；
 *              地面物件用 [0.5, 0, 0.5]（底部中心），手持物件用握把位置；
 *              給 null 表示保留模型自己的原點（只縮放）
 *   rotation — 載入後先套用的旋轉（度），用來把模型轉成「前方 = -Z、上方 = +Y」
 *   fallback — 檔案載入失敗時的替代方塊尺寸 [x, y, z]（公尺）
 */
export const MODELS = {
  boat:  { url: 'models/boat.glb',  size: 4.4,  anchor: [0.5, 0, 0.5],       rotation: [0, 0, 0], fallback: [1.5, 0.6, 4.4] },
  bed:   { url: 'models/bed.glb',   size: 2.1,  anchor: [0.5, 0, 0.5],       rotation: [0, 0, 0], fallback: [1.0, 0.55, 2.1] },
  knife: { url: 'models/knife.glb', size: 0.3,  anchor: [0.5, 0.48, 0.77],    rotation: [0, 0, 0], fallback: [0.03, 0.05, 0.3] },
  gun:   { url: 'models/gun.glb',   size: 0.21, anchor: [0.5, 0.32, 0.78],    rotation: [0, 0, 0], fallback: [0.03, 0.14, 0.21] },
  hands: { url: 'models/hands.glb', size: 0.5,  anchor: null,                rotation: [0, 0, 0], fallback: [0.09, 0.09, 0.4] },

  // 以下是 npm run assets 下載的可選模型。optional 的模型缺檔時不放替代方塊，
  // 使用端會退回程序生成的版本；animated 的模型不做零件合併，動畫 clip 會存在 userData.animations。
  // 馬（Quaternius）與鳥（three.js 範例資產）原本朝 +Z，轉 180° 對齊「前方 = -Z」。
  // Quaternius 的 CC0 人物（tools/build-characters.py 組成）：原本朝 +Z；身高本來就是公尺，最長邊是身高
  npcCamper: { url: 'models/q/npc_camper.glb', size: 1.8,  anchor: [0.5, 0, 0.5],   rotation: [0, 180, 0],   optional: true, animated: true },
  npcFisher: { url: 'models/q/npc_fisher.glb', size: 1.76, anchor: [0.5, 0, 0.5],   rotation: [0, 180, 0],   optional: true, animated: true },
  npcHiker:  { url: 'models/q/npc_hiker.glb',  size: 1.7,  anchor: [0.5, 0, 0.5],   rotation: [0, 180, 0],   optional: true, animated: true },
  horse:    { url: 'models/q/horse.glb',  size: 2.4,  anchor: [0.5, 0, 0.5],   rotation: [0, 180, 0], optional: true, animated: true }, // Quaternius（CC0）
  stork:    { url: 'models/stork.glb',    size: 1.9,  anchor: [0.5, 0.5, 0.5], rotation: [0, 180, 0], optional: true, animated: true },
  parrot:   { url: 'models/parrot.glb',   size: 0.9,  anchor: [0.5, 0.5, 0.5], rotation: [0, 180, 0], optional: true, animated: true },
  flamingo: { url: 'models/flamingo.glb', size: 1.6,  anchor: [0.5, 0.5, 0.5], rotation: [0, 180, 0], optional: true, animated: true },
};

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const DEG = Math.PI / 180;

/** 可選的照片貼圖（npm run assets 下載）；缺任何一張都會退回程序生成 */
export const TEXTURES = {
  grass: 'textures/grass.jpg',
  waternormals: 'textures/waternormals.jpg',
  moon: 'textures/moon.jpg',
  smoke: 'textures/smoke.png',
  caustics: 'textures/caustics.jpg',
  wood: 'textures/wood.jpg',
  woodBump: 'textures/wood_bump.jpg',
  // ambientCG 的掃描貼圖（CC0）。有這些就優先使用，地表／樹皮／葉片不再用程序生成的圖樣
  ground: 'textures/acg/ground.jpg',
  groundN: 'textures/acg/ground_n.jpg',
  rock: 'textures/acg/rock.jpg',
  rockN: 'textures/acg/rock_n.jpg',
  sand: 'textures/acg/sand.jpg',
  sandN: 'textures/acg/sand_n.jpg',
  dirt: 'textures/acg/dirt.jpg',
  dirtN: 'textures/acg/dirt_n.jpg',
  barkOak: 'textures/acg/bark_oak.jpg',
  barkOakN: 'textures/acg/bark_oak_n.jpg',
  barkFir: 'textures/acg/bark_fir.jpg',
  barkFirN: 'textures/acg/bark_fir_n.jpg',
  leaves: 'textures/acg/leaves.jpg',
  leavesA: 'textures/acg/leaves_a.jpg',
  conifer: 'textures/acg/conifer.jpg',
  coniferA: 'textures/acg/conifer_a.jpg',
  planks: 'textures/acg/planks.jpg',
  planksN: 'textures/acg/planks_n.jpg',
  fabric: 'textures/acg/fabric.jpg',
  fabricN: 'textures/acg/fabric_n.jpg',
};

/**
 * Poly Haven 的 CC0 掃描模型（npm run assets 下載並減面，見 tools/fetch-polyhaven.mjs）。
 * near 帶顏色與法線貼圖，far 只有幾何、沿用 near 的材質；缺檔時 scatter.js 改用程序生成的石頭。
 */
export const SCANS = {
  rockSmall: { id: 'rock_07', far: true }, // 約 32 cm 的風化石塊
  rockLarge: { id: 'rock_face_02', far: true }, // 約 4.9 × 3.5 × 4.7 m 的岩塊
  stump: { id: 'tree_stump_01', far: true },
  trunk: { id: 'dead_tree_trunk', far: true }, // 倒在地上的枯木
  fern: { id: 'fern_02', far: false }, // 四株不同大小的蕨類
};

/** 把 glTF 場景裡每個 mesh 的節點變換烘進幾何（instancing 只吃單一幾何＋材質） */
function bakeParts(root) {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
    geometry.computeBoundingBox();
    parts.push({ name: o.name, geometry, material: o.material });
  });
  return parts;
}

/**
 * 把任意單位／任意原點的模型正規化：統一最長邊尺寸、把 anchor 移到原點。
 * 回傳的 wrapper.userData.size 是縮放後的實際包圍盒尺寸，碰撞盒直接用它。
 */
export function normalizeModel(inner, cfg) {
  inner.rotation.set(cfg.rotation[0] * DEG, cfg.rotation[1] * DEG, cfg.rotation[2] * DEG);
  inner.position.set(0, 0, 0);
  inner.scale.setScalar(1);
  inner.updateMatrixWorld(true);
  _box.setFromObject(inner, true).getSize(_size);
  const longest = Math.max(_size.x, _size.y, _size.z) || 1;
  inner.scale.setScalar(cfg.size / longest);
  inner.updateMatrixWorld(true);
  _box.setFromObject(inner, true).getSize(_size);
  if (cfg.anchor) {
    inner.position.set(
      -(_box.min.x + _size.x * cfg.anchor[0]),
      -(_box.min.y + _size.y * cfg.anchor[1]),
      -(_box.min.z + _size.z * cfg.anchor[2]),
    );
  }

  // 由很多小零件組成的靜態模型合併成每種材質一個 mesh；有骨架／morph 動畫的不能動
  if (!cfg.animated) mergeStatic(inner);
  const wrapper = new THREE.Group();
  wrapper.add(inner);
  wrapper.userData.size = _size.clone();
  wrapper.userData.scale = cfg.size / longest;

  inner.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return wrapper;
}

function fallbackModel(name, cfg) {
  const [x, y, z] = cfg.fallback;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(x, y, z),
    new THREE.MeshStandardMaterial({ color: 0xb04a9a, roughness: 0.8 }),
  );
  mesh.name = name + '-fallback';
  return mesh;
}

export class Assets {
  constructor() {
    // 外部 GLB 若有 Draco / meshopt 壓縮也能直接載入（r186 的 DRACOLoader 內建解碼器路徑）
    this.loader = new GLTFLoader();
    this.loader.setDRACOLoader(new DRACOLoader());
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.models = {};
    this.textures = {};
    this.scans = {};
    this.npcClips = [];
    this.report = [];
  }

  /** 載入 GLB；網路偶爾掉一個請求時重試一次，免得可選模型因此被當成缺檔而退回替代品 */
  async #load(url) {
    try {
      return await this.loader.loadAsync(url);
    } catch {
      return this.loader.loadAsync(url);
    }
  }

  async loadAll(onProgress) {
    const names = Object.keys(MODELS);
    let done = 0;
    await Promise.all(
      names.map(async (name) => {
        const cfg = MODELS[name];
        let inner;
        let ok = true;
        let animations = [];
        try {
          const gltf = await this.#load(import.meta.env.BASE_URL + cfg.url);
          inner = gltf.scene;
          animations = gltf.animations;
        } catch (err) {
          ok = false;
          if (cfg.optional) {
            // 可選模型缺檔是正常情況（沒跑 npm run assets），使用端會改用程序生成的版本
            this.report.push({ name, ok, scale: 0, size: [0, 0, 0] });
            onProgress?.(++done / names.length);
            return;
          }
          console.warn(`[assets] ${cfg.url} 載入失敗，改用替代方塊`, err);
          inner = fallbackModel(name, cfg);
        }
        const model = normalizeModel(inner, cfg);
        model.name = name;
        model.userData.animations = animations;
        this.models[name] = model;
        const s = model.userData.size;
        this.report.push({ name, ok, scale: model.userData.scale, size: [s.x, s.y, s.z] });
        onProgress?.(++done / names.length);
      }),
    );
    return this.models;
  }

  /** NPC 共用的動畫（Universal Animation Library 挑出來的幾段，見 tools/build-anims.mjs）；缺檔時 NPC 改用程序人形 */
  async loadNpcClips() {
    try {
      this.npcClips = (await this.#load(`${import.meta.env.BASE_URL}models/q/npc_anims.glb`)).animations;
    } catch {
      this.npcClips = [];
    }
    return this.npcClips;
  }

  /** 載入掃描模型：{ parts: [{ name, geometry, material }], far: [geometry] | null }；缺檔就略過 */
  async loadScans() {
    await Promise.all(
      Object.entries(SCANS).map(async ([name, cfg]) => {
        try {
          const url = `${import.meta.env.BASE_URL}models/ph/${cfg.id}`;
          const [near, far] = await Promise.all([
            this.#load(url + '.glb'),
            cfg.far ? this.#load(url + '_far.glb').catch(() => null) : null,
          ]);
          this.scans[name] = { parts: bakeParts(near.scene), far: far ? bakeParts(far.scene).map((p) => p.geometry) : null };
        } catch {
          // 沒跑 npm run assets 是預期中的情況
        }
      }),
    );
    return this.scans;
  }

  /** 載入可選貼圖：檔案不存在（或被擋成一頁 HTML）就略過 */
  async loadTextures() {
    const loader = new THREE.TextureLoader();
    await Promise.all(
      Object.entries(TEXTURES).map(async ([name, url]) => {
        try {
          const res = await fetch(import.meta.env.BASE_URL + url);
          if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return;
          const objectUrl = URL.createObjectURL(await res.blob());
          this.textures[name] = await loader.loadAsync(objectUrl);
          URL.revokeObjectURL(objectUrl);
        } catch {
          // 缺檔是預期中的情況，不用回報
        }
      }),
    );
    return this.textures;
  }

  /** 取得一份可獨立擺放的副本（共用 geometry / material） */
  instance(name) {
    const src = this.models[name];
    const copy = cloneSkinned(src);
    copy.userData.size = src.userData.size.clone();
    copy.userData.scale = src.userData.scale;
    copy.userData.animations = src.userData.animations;
    return copy;
  }

  has(name) {
    return !!this.models[name];
  }
}
