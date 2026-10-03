import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { makeWoodTexture, makeCanvasTexture } from './textures.js';
import { mergeStatic } from '../core/merge.js';
import { tintToMean } from './surface.js';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

/** 把 local (lx, lz) 依 yaw 轉到世界座標（與 colliders 的方盒同一套慣例） */
export function toWorld(origin, yaw, lx, lz) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return { x: origin.x + lx * cos + lz * sin, z: origin.z - lx * sin + lz * cos };
}

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export class CampProps {
  /** @param photos Assets.textures（有木紋照片就用，沒有才用程序生成的） */
  constructor(scene, terrain, colliders, layout, photos = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.colliders = colliders;
    let wood = makeWoodTexture();
    let bump = null;
    if (photos.wood) {
      wood = photos.wood;
      wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
      wood.colorSpace = THREE.SRGBColorSpace;
      wood.anisotropy = 8;
      if (photos.woodBump) {
        bump = photos.woodBump;
        bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
      }
    }
    // 有掃描的舊木板就用它（含法線），比木地板照片更像戶外的粗木料
    let woodNormal = null;
    if (photos.planks) {
      wood = photos.planks;
      wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
      wood.colorSpace = THREE.SRGBColorSpace;
      wood.anisotropy = 8;
      bump = null;
      if (photos.planksN) {
        woodNormal = photos.planksN;
        woodNormal.wrapS = woodNormal.wrapT = THREE.RepeatWrapping;
      }
    }
    let cloth = makeCanvasTexture();
    let clothNormal = null;
    let clothColor = srgb(1, 1, 1);
    if (photos.fabric) {
      cloth = photos.fabric;
      cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
      cloth.colorSpace = THREE.SRGBColorSpace;
      cloth.repeat.set(3, 3);
      clothColor = tintToMean(photos.fabric.image, [150, 134, 100]); // 中性灰的布料照片染成米黃帆布
      if (photos.fabricN) {
        clothNormal = photos.fabricN;
        clothNormal.wrapS = clothNormal.wrapT = THREE.RepeatWrapping;
        clothNormal.repeat.set(3, 3);
      }
    }
    // PBR 材質：會吃天空的環境光照，木頭、帆布、金屬的質感才分得出來
    const std = (opts) => new THREE.MeshStandardMaterial(opts);
    // 舊木板照片是灰褐色，乘上暖色才像風吹日曬的原木
    const planks = (target) => tintToMean(photos.planks.image, target);
    this.planksTint = photos.planks ? planks : null;
    this.wood = std({ map: wood, bumpMap: bump, bumpScale: 1.5, normalMap: woodNormal, roughness: 0.82, color: photos.planks ? planks([104, 78, 54]) : srgb(0.62, 0.5, 0.38) });
    this.darkWood = std({ map: wood, bumpMap: bump, bumpScale: 1.5, normalMap: woodNormal, roughness: 0.88, color: photos.planks ? planks([70, 53, 39]) : srgb(0.36, 0.28, 0.22) });
    this.canvas = std({ map: cloth, normalMap: clothNormal, color: clothColor, side: THREE.DoubleSide, roughness: 0.95 });
    this.metal = std({ color: srgb(0.3, 0.31, 0.33), roughness: 0.42, metalness: 0.85 });
    this.rope = std({ color: srgb(0.62, 0.52, 0.36), roughness: 1 });
    this.glow = new THREE.MeshBasicMaterial({ color: srgb(1, 0.78, 0.4), fog: false });

    this.#tent(layout.tent);
    this.#supplies(layout.fire);
    this.#tripod(layout.fire);
    this.#signpost(layout.fire.x + 6.5, layout.fire.z + 8.5, -0.5);
  }

  #ground(x, z) {
    return this.terrain.getHeight(x, z);
  }

  /** A 字帳：兩片斜頂、後牆、兩片前簾（中間留門），裡面放床 */
  #tent({ x, z, yaw }) {
    const W = 2.1; // 半寬
    const L = 2.1; // 半長
    const H = 2.7;
    const g = new THREE.Group();
    g.position.set(x, this.#ground(x, z), z);
    g.rotation.y = yaw;

    const tri = (pts, uvs) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
      geo.computeVertexNormals();
      return geo;
    };
    const quad = (a, b, c, d) =>
      tri([a, b, c, a, c, d], [[0, 0], [2, 0], [2, 2], [0, 0], [2, 2], [0, 2]]);
    // 斜頂略為內凹，看起來像被拉緊的布而不是硬板
    for (const s of [-1, 1]) {
      const roof = quad([s * W, 0, -L], [s * W, 0, L], [0, H, L], [0, H, -L]);
      g.add(mesh(roof, this.canvas));
    }
    g.add(mesh(tri([[-W, 0, -L], [W, 0, -L], [0, H, -L]], [[0, 0], [2, 0], [1, 2]]), this.canvas));
    for (const s of [-1, 1]) {
      const flap = tri([[s * W, 0, L], [s * 0.6, 0, L + 0.25], [0, H, L]], [[0, 0], [1, 0], [0.5, 2]]);
      g.add(mesh(flap, this.canvas));
    }
    const floor = mesh(new THREE.PlaneGeometry(W * 1.9, L * 1.95), new THREE.MeshLambertMaterial({ color: srgb(0.3, 0.33, 0.27) }), 0, 0.03, 0, false);
    floor.rotation.x = -Math.PI / 2;
    g.add(floor);

    const pole = new THREE.CylinderGeometry(0.035, 0.035, H + 0.15, 6);
    g.add(mesh(pole, this.darkWood, 0, (H + 0.15) / 2, -L), mesh(pole, this.darkWood, 0, (H + 0.15) / 2, L));
    const ridge = mesh(new THREE.CylinderGeometry(0.03, 0.03, L * 2 + 0.3, 6), this.darkWood, 0, H, 0);
    ridge.rotation.x = Math.PI / 2;
    g.add(ridge);
    // 營繩與營釘
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const from = new THREE.Vector3(sx * W * 0.5, H * 0.5, sz * L);
        const to = new THREE.Vector3(sx * (W + 1.0), 0, sz * (L + 0.5));
        const len = from.distanceTo(to);
        const rope = mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 4), this.rope, 0, 0, 0, false);
        rope.position.copy(from).lerp(to, 0.5);
        rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        g.add(rope, mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.3, 5), this.darkWood, to.x, 0.1, to.z));
      }
    }
    // 掛在帳內的提燈
    const lantern = this.#lantern();
    lantern.position.set(0, H - 0.55, -0.6);
    g.add(lantern);
    this.scene.add(mergeStatic(g));

    // 兩側斜頂下方不夠高，用方盒把人留在中間走道；後牆整面擋住
    const origin = { x, z };
    for (const s of [-1, 1]) {
      const c = toWorld(origin, yaw, s * 1.55, 0);
      this.colliders.addBox(c.x, c.z, 0.55, L, yaw);
    }
    const back = toWorld(origin, yaw, 0, -L - 0.1);
    this.colliders.addBox(back.x, back.z, W, 0.15, yaw);
  }

  #lantern() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.04, 8), this.metal, 0, 0, 0, false));
    g.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 8), this.glow, 0, 0.1, 0, false));
    g.add(mesh(new THREE.ConeGeometry(0.085, 0.07, 8), this.metal, 0, 0.215, 0, false));
    const ring = mesh(new THREE.TorusGeometry(0.05, 0.006, 4, 10), this.metal, 0, 0.3, 0, false);
    g.add(ring);
    return g;
  }

  #crate(x, y, z, size, yaw) {
    const g = new THREE.Group();
    g.position.set(x, y + size / 2, z);
    g.rotation.y = yaw;
    g.add(mesh(new THREE.BoxGeometry(size, size, size), this.wood));
    // 邊框木條
    const t = size * 0.09;
    const bar = new THREE.BoxGeometry(size + 0.02, t, t);
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        g.add(mesh(bar, this.darkWood, 0, (sy * (size - t)) / 2, (sz * (size - t)) / 2 + sz * 0.012));
        const side = mesh(bar, this.darkWood, (sz * (size - t)) / 2 + sz * 0.012, (sy * (size - t)) / 2, 0);
        side.rotation.y = Math.PI / 2;
        g.add(side);
      }
    }
    this.scene.add(mergeStatic(g));
    return g;
  }

  #supplies(fire) {
    const bx = fire.x + 4.2;
    const bz = fire.z - 4.4;
    const y = this.#ground(bx, bz);
    this.#crate(bx, y, bz, 0.8, 0.3);
    this.#crate(bx + 0.95, y, bz + 0.25, 0.7, -0.2);
    this.#crate(bx + 0.3, y + 0.8, bz + 0.05, 0.6, 0.7);
    this.colliders.addBox(bx + 0.45, bz + 0.1, 0.95, 0.5, 0.1, y + 0.8);
    const lamp = this.#lantern();
    lamp.position.set(bx + 1.0, y + 0.72, bz + 0.3);
    this.scene.add(lamp);

    // 木桶
    const barrelX = bx - 1.3;
    const barrelZ = bz + 0.5;
    const by = this.#ground(barrelX, barrelZ);
    const body = new THREE.CylinderGeometry(0.34, 0.34, 0.95, 14, 4);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 1 + 0.16 * (1 - Math.pow(p.getY(i) / 0.475, 2));
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    body.computeVertexNormals();
    const barrel = mesh(body, this.wood, barrelX, by + 0.475, barrelZ);
    this.scene.add(barrel);
    for (const hy of [0.2, 0.75]) {
      const hoop = mesh(new THREE.TorusGeometry(0.375, 0.015, 4, 16), this.metal, barrelX, by + hy, barrelZ, false);
      hoop.rotation.x = Math.PI / 2;
      this.scene.add(hoop);
    }
    this.colliders.addCircle(barrelX, barrelZ, 0.4, by + 0.95);

    // 柴堆：三層交疊的圓木
    const wx = fire.x + 2.6;
    const wz = fire.z + 5.2;
    const wy = this.#ground(wx, wz);
    const rand = mulberry32(17);
    const log = new THREE.CylinderGeometry(0.1, 0.1, 1.3, 7);
    log.rotateZ(Math.PI / 2);
    const pile = new THREE.Group();
    pile.position.set(wx, wy, wz);
    pile.rotation.y = 0.5;
    let row = 0;
    for (const count of [5, 4, 3]) {
      for (let i = 0; i < count; i++) {
        const m = mesh(log, rand() < 0.5 ? this.wood : this.darkWood, (rand() - 0.5) * 0.08, 0.1 + row * 0.18, (i - (count - 1) / 2) * 0.21);
        m.rotation.x = rand() * 6;
        pile.add(m);
      }
      row++;
    }
    this.scene.add(mergeStatic(pile));
    this.colliders.addBox(wx, wz, 0.7, 0.55, 0.5, wy + 0.55);
  }

  /** 營火上的三腳架與吊鍋 */
  #tripod(fire) {
    const y = this.#ground(fire.x, fire.z);
    const g = new THREE.Group();
    g.position.set(fire.x, y, fire.z);
    const top = new THREE.Vector3(0, 1.9, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const foot = new THREE.Vector3(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05);
      const len = foot.distanceTo(top) + 0.15;
      const leg = mesh(new THREE.CylinderGeometry(0.022, 0.03, len, 6), this.darkWood);
      leg.position.copy(foot).lerp(top, 0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
      g.add(leg);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.75, 4), this.metal, 0, 1.52, 0, false));
    const pot = new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68);
    const potMat = new THREE.MeshLambertMaterial({ color: srgb(0.1, 0.1, 0.11), side: THREE.DoubleSide });
    g.add(mesh(pot, potMat, 0, 1.12, 0));
    const handle = mesh(new THREE.TorusGeometry(0.15, 0.008, 4, 12, Math.PI), this.metal, 0, 1.2, 0, false);
    g.add(handle);
    this.scene.add(mergeStatic(g));
  }

  #signpost(x, z, yaw) {
    const y = this.#ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 7), this.darkWood, 0, 1.0, 0));
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const board = (text, yy, tilt, dir) => {
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#2a1c10';
      ctx.font = 'bold 34px "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 34);
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 64;
      cv.getContext('2d').drawImage(c, 0, 0);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = mesh(new THREE.BoxGeometry(0.95, 0.24, 0.04), [this.darkWood, this.darkWood, this.darkWood, this.darkWood, new THREE.MeshLambertMaterial({ map: tex }), this.darkWood], dir * 0.3, yy, 0.05);
      m.rotation.z = tilt;
      g.add(m);
    };
    board('湖畔碼頭 →', 1.75, 0.04, 1);
    board('← 靶場', 1.42, -0.03, -1);
    this.scene.add(g);
    this.colliders.addCircle(x, z, 0.12, y + 2);
  }

  /**
   * 從岸邊往湖心搭一座碼頭。
   * @returns {{end: {x, z}, yaw: number, deck: number, boat: {x, z, yaw}}}
   */
  buildDock(lake, toward) {
    const terrain = this.terrain;
    const dx = toward.x - lake.x;
    const dz = toward.z - lake.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    // 沿「湖心 → 營地」找到地面高過甲板的那一點當碼頭起點
    const deck = 0.5;
    let t = 0;
    for (; t < lake.r * 1.7; t += 0.5) {
      if (terrain.getHeight(lake.x + ux * t, lake.z + uz * t) > deck + 0.08) break;
    }
    const start = { x: lake.x + ux * t, z: lake.z + uz * t };
    const length = 12;
    const dir = { x: -ux, z: -uz }; // 往湖心
    const yaw = Math.atan2(dir.x, dir.z); // local +Z = 往湖心
    const mid = { x: start.x + dir.x * (length / 2 - 0.6), z: start.z + dir.z * (length / 2 - 0.6) };

    const g = new THREE.Group();
    g.position.set(mid.x, 0, mid.z);
    g.rotation.y = yaw;
    const plankTex = this.wood.map.clone();
    plankTex.repeat.set(1, 5);
    plankTex.rotation = Math.PI / 2;
    plankTex.needsUpdate = true;
    const deckMat = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85, color: this.planksTint ? this.planksTint([104, 82, 58]) : srgb(0.55, 0.47, 0.38) }); // 風化的灰褐色木板
    g.add(mesh(new THREE.BoxGeometry(1.9, 0.08, length), deckMat, 0, deck - 0.04, 0));
    for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.12, 0.16, length), this.darkWood, s * 0.85, deck - 0.16, 0));
    const post = new THREE.CylinderGeometry(0.09, 0.1, 1, 7);
    for (let z = -length / 2 + 0.6; z <= length / 2; z += 2.3) {
      for (const s of [-1, 1]) {
        const w = toWorld(mid, yaw, s * 0.95, z);
        const bottom = Math.min(terrain.getHeight(w.x, w.z) - 0.3, deck - 0.4);
        const top = deck + (Math.abs(z - (length / 2 - 0.25)) < 1.2 ? 0.55 : 0.12);
        const m = mesh(post, this.darkWood, s * 0.95, (top + bottom) / 2, z);
        m.scale.y = top - bottom;
        g.add(m);
      }
    }
    this.scene.add(mergeStatic(g));
    this.colliders.addBox(mid.x, mid.z, 0.95, length / 2, yaw, deck);

    const end = { x: mid.x + dir.x * (length / 2 - 0.9), z: mid.z + dir.z * (length / 2 - 0.9) };
    const boat = toWorld(mid, yaw, 2.3, length / 2 - 2.6);
    return { start, end, yaw, deck, boat: { x: boat.x, z: boat.z, yaw: yaw + Math.PI } };
  }

  update(env) {
    // 提燈：白天只是玻璃色，天黑才亮
    this.glow.color.setRGB(1, 0.78, 0.4, THREE.SRGBColorSpace).multiplyScalar(0.35 + 1.4 * (1 - env.dayFactor));
  }
}
