import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { SEED, WORLD_SIZE } from '../world/terrain.js';
import { CAMP_LAYOUT } from '../world/camp.js';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

export const ITEMS = {
  knife: { name: '獵刀', icon: '🔪', kind: 'weapon', model: 'knife', stack: 1 },
  gun: { name: '手槍', icon: '🔫', kind: 'weapon', model: 'gun', stack: 1 },
  ammo: { name: '子彈', icon: '⁍', kind: 'ammo', stack: 120 },
  food: { name: '罐頭', icon: '🥫', kind: 'food', stack: 10, hunger: 40, health: 10 },
  meat: { name: '生肉', icon: '🥩', kind: 'food', stack: 10, hunger: 28, health: 4 },
};

// ---------------------------------------------------------------- 背包

export const HOTBAR = 5;
export const SLOTS = 10;

export class Inventory {
  constructor() {
    this.slots = new Array(SLOTS).fill(null);
    this.equipped = -1; // 目前拿在手上的 slot index
    this.onChange = null;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  /** @returns 實際放進去的數量 */
  add(id, count = 1) {
    const def = ITEMS[id];
    let left = count;
    for (const s of this.slots) {
      if (!left) break;
      if (s && s.id === id && s.count < def.stack) {
        const n = Math.min(left, def.stack - s.count);
        s.count += n;
        left -= n;
      }
    }
    for (let i = 0; i < SLOTS && left; i++) {
      if (this.slots[i]) continue;
      const n = Math.min(left, def.stack);
      this.slots[i] = { id, count: n };
      left -= n;
    }
    if (left !== count) this.onChange?.();
    return count - left;
  }

  remove(id, count = 1) {
    let left = count;
    for (let i = SLOTS - 1; i >= 0 && left; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const n = Math.min(left, s.count);
      s.count -= n;
      left -= n;
      if (!s.count) this.#clear(i);
    }
    if (left !== count) this.onChange?.();
    return count - left;
  }

  /** 整格取出（丟棄用） */
  take(i) {
    const s = this.slots[i];
    if (!s) return null;
    this.#clear(i);
    this.onChange?.();
    return s;
  }

  #clear(i) {
    this.slots[i] = null;
    if (this.equipped === i) this.equipped = -1;
  }

  get equippedId() {
    return this.equipped >= 0 ? this.slots[this.equipped]?.id ?? null : null;
  }

  /** 武器：裝備／收起；回傳被「使用」的非武器物品 id（由呼叫端處理效果） */
  activate(i) {
    const s = this.slots[i];
    if (!s) return null;
    if (ITEMS[s.id].kind === 'weapon') {
      this.equipped = this.equipped === i ? -1 : i;
      this.onChange?.();
      return null;
    }
    return s.id;
  }

  swap(a, b) {
    if (a === b) return;
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    if (this.equipped === a) this.equipped = b;
    else if (this.equipped === b) this.equipped = a;
    this.onChange?.();
  }
}

// ---------------------------------------------------------------- 地上的可撿拾物

function simpleMesh(id) {
  if (id === 'meat') {
    const g = new THREE.Group();
    const steak = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshLambertMaterial({ color: srgb(0.66, 0.16, 0.14) }));
    steak.scale.set(1.25, 0.42, 0.9);
    const fat = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshLambertMaterial({ color: srgb(0.93, 0.86, 0.78) }));
    fat.scale.set(1.3, 0.5, 0.7);
    fat.position.set(0.06, 0.012, 0.03);
    g.add(steak, fat);
    return g;
  }
  if (id === 'ammo') {
    const g = new THREE.Group();
    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.11, 0.13),
      new THREE.MeshLambertMaterial({ color: srgb(0.32, 0.36, 0.2) }),
    );
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.205, 0.03, 0.135),
      new THREE.MeshLambertMaterial({ color: srgb(0.8, 0.65, 0.2) }),
    );
    g.add(boxMesh, band);
    return g;
  }
  const g = new THREE.Group();
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.15, 12),
    new THREE.MeshLambertMaterial({ color: srgb(0.7, 0.72, 0.75) }),
  );
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.085, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: srgb(0.75, 0.2, 0.15) }),
  );
  g.add(can, label);
  return g;
}

export class Pickups {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.t = 0;
    // 草叢裡也找得到：每個物品下方一圈淡淡的光環
    this.ringGeo = new THREE.RingGeometry(0.26, 0.34, 20);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: srgb(1, 0.92, 0.55),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
  }

  spawn(id, x, z, count = 1, y = null) {
    const { terrain, assets, scene } = this.game;
    const def = ITEMS[id];
    const group = new THREE.Group();
    const model = def.model ? assets.instance(def.model) : simpleMesh(id);
    if (def.model) {
      // 握把是原點，轉成橫放並整體放大一點比較好認
      model.scale.setScalar(1.25);
      model.rotation.set(0, 0, id === 'knife' ? Math.PI / 2 : 0);
    }
    model.traverse((o) => (o.castShadow = !!o.isMesh));
    group.add(model);
    const ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    group.add(ring);
    const ground = y ?? terrain.getHeight(x, z);
    group.position.set(x, ground, z);
    ring.position.y = 0.06;
    scene.add(group);
    const p = { id, count, group, model, ring, baseY: ground, phase: this.list.length * 1.7 };
    this.list.push(p);
    return p;
  }

  remove(p) {
    this.game.scene.remove(p.group);
    this.list.splice(this.list.indexOf(p), 1);
  }

  nearest(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.list) {
      const d = Math.hypot(p.group.position.x - pos.x, p.group.position.z - pos.z);
      if (d < bestD && Math.abs(p.baseY - pos.y) < 2.5) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  update(dt) {
    this.t += dt;
    for (const p of this.list) {
      p.model.position.y = 0.42 + Math.sin(this.t * 2 + p.phase) * 0.06;
      p.model.rotation.y = this.t * 0.9 + p.phase;
    }
    this.ringMat.opacity = 0.4 + 0.2 * Math.sin(this.t * 3);
  }

  /** 開局物資：營地附近一定有刀、槍、子彈，其餘散落全島 */
  populate() {
    const { terrain } = this.game;
    const f = CAMP_LAYOUT.fire;
    this.spawn('knife', f.x + 2.6, f.z - 1.6);
    this.spawn('gun', f.x - 1.2, f.z - 3.4);
    this.spawn('ammo', f.x - 2.2, f.z - 3.9, 24);
    this.spawn('ammo', f.x + 5.5, f.z + 4.5, 24);
    this.spawn('food', f.x + 3.4, f.z + 2.2, 2);
    this.spawn('food', f.x - 4.0, f.z - 1.0, 1);

    const rand = mulberry32(SEED + 300);
    const half = WORLD_SIZE / 2;
    let placed = 0;
    for (let i = 0; i < 400 && placed < 46; i++) {
      const x = (rand() * 2 - 1) * half * 0.8;
      const z = (rand() * 2 - 1) * half * 0.8;
      const kind = rand();
      if (terrain.fertility(x, z) < 0.5) continue;
      if (kind < 0.6) this.spawn('food', x, z, 1 + Math.floor(rand() * 2));
      else this.spawn('ammo', x, z, 12);
      placed++;
    }
  }
}
