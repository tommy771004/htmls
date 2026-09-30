// 無盡雪坡：高度函數、chunk 管理、物件生成、碰撞/旗門查詢、遠景。
// 座標：下坡 = -Z，distance d = -z。
import * as THREE from 'three';
import { config as defaultConfig } from './config.js';
import { mulberry32, hash2, valueNoise2, fbm2, rampProfile, clamp, lerp, smoothstep } from './shared.js';

const TAU = Math.PI * 2;

const LOCAL_DEFAULTS = defaultConfig.terrain; // 預設值唯一來源是 config.js（這裡不再重複寫數值）

const POOLS = ['pine0', 'pine1', 'pine2', 'rock0', 'rock1', 'rock2', 'post', 'rail', 'gate'];

// 暫存物件（避免熱路徑配置）
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c0 = new THREE.Color();

function seedOf(a, b, seed) {
  return (hash2(a, b, seed) * 4294967296) >>> 0;
}

function srgb(hex) {
  return new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
}

export class Terrain {
  constructor(scene, assets, config, seed = 1) {
    this.scene = scene;
    this.assets = assets;
    this.config = config || defaultConfig;
    this.C = { ...LOCAL_DEFAULTS, ...(this.config.terrain || {}) };
    const sd = (this.config.render && this.config.render.sunDirection) || [0.45, 1, 0.55];
    this._sun = new THREE.Vector3().fromArray(sd).normalize();
    this._fogColor = srgb((this.config.render && this.config.render.fogColor) || 0xcfe3f5);

    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);

    this.chunks = new Map();
    this._layouts = new Map();
    this._poolPi = NaN;
    this._playerZ = 0;
    this._time = 0;

    this._initDerived();
    this._initMaterials();
    this._initPools();
    this._initBackground();
    this._rowOff = new Float64Array(this._nCols);
    this.reset(seed);
  }

  // ───────────────────────── 初始化 ─────────────────────────
  _initDerived() {
    const C = this.C;
    // 蜿蜒：w(d) = (sin(k1 d+p1) + 0.35 sin(k2 d+p2)) / 1.35，k2 = 0.47 k1
    // 最大曲率 ≈ A * k1² * (1 + 0.35*0.47²)/1.35 ≈ 0.8 A k1²；加 15% 安全係數
    const aMax = Math.max(C.curveAmpStart, C.curveAmpEnd);
    const kMax = Math.sqrt(1 / (C.minCurveRadius * 1.15 * 0.8 * Math.max(aMax, 1e-3)));
    const lambda = Math.max(C.curveWavelength, TAU / kMax);
    this._k1 = TAU / lambda;
    this._k2 = this._k1 * 0.47;
    this._nCols = 2 * C.outerCols + 2 * C.marginCols + C.courseCols + 1;
    this._taper = C.rampSideTaper;
    this._bankRise = C.bankRise * C.bankRiseScale;
    this._rampLenMax = Math.max(C.rampLength[0], C.rampLength[1]);
    const vMax = Math.max(...(C.expectSpeed || [30, 38]));
    this._rampSpanMax = this._rampLenMax + vMax * (C.rampLandingTime || 2) + (C.rampLandingClear || 0) + 10;
  }

  _initMaterials() {
    this.matTerrain = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const em = this.C.terrainEmissive;
    this.matTerrain.emissive.setRGB(em * 0.92, em * 0.96, em);
    const M = (this.assets && this.assets.materials) || {};
    this.matObjects =
      M.vc || M.vertex || M.vertexColor || M.objects || M.main || M.snow ||
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.matMountain = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false, fog: false }); // 遠丘用平滑法線（圓潤）
    this.matCloud = new THREE.MeshLambertMaterial({
      vertexColors: true, flatShading: true, fog: false, emissive: srgb(0x9aa8ba),
    });
    this.colSnowCourse = srgb(0xfbfcff);
    this.colSnowOff = srgb(0xf3f7fd);
    this.colCool = srgb(0xa9b9ec); // 背光 / 凹處的冷色（附圖是淡紫藍，不是灰）
    this.colRampTop = srgb(0xe4ecf8);
    this.colRampSide = srgb(0xa9bddc);
    this.colRampBack = srgb(0x9fb4d6);
    this.colRampLip = srgb(0xd8452f);
  }

  _initPools() {
    const G = this.assets.geometries;
    const geos = {
      pine0: G.pine[0], pine1: G.pine[1], pine2: G.pine[2],
      rock0: G.rock[0], rock1: G.rock[1], rock2: G.rock[2],
      post: G.fencePost, rail: G.fenceRail, gate: G.gatePole,
    };
    this.pools = {};
    for (const name of POOLS) {
      const geo = geos[name];
      if (!geo.boundingBox) geo.computeBoundingBox();
      // near：玩家附近 chunk（投射陰影）；far：其餘（不投射陰影）
      this.pools[name] = {
        near: { name: name + '-near', geo, mesh: null, cap: 0, shadow: true },
        far: { name: name + '-far', geo, mesh: null, cap: 0, shadow: false },
      };
    }
    const bb = (g) => g.boundingBox;
    this._pineH = [0, 1, 2].map((k) => bb(G.pine[k]).max.y);
    this._rockInfo = [0, 1, 2].map((k) => {
      const b = bb(G.rock[k]);
      return { h: b.max.y, r: 0.5 * Math.max(b.max.x - b.min.x, b.max.z - b.min.z) };
    });
  }

  _ensurePool(pool, n) {
    if (pool.mesh && pool.cap >= n) return;
    if (pool.mesh) {
      this.group.remove(pool.mesh);
      pool.mesh.dispose();
    }
    pool.cap = Math.max(32, Math.ceil(n * 1.4));
    const mesh = new THREE.InstancedMesh(pool.geo, this.matObjects, pool.cap);
    mesh.name = 'terrain-' + pool.name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; // 單一全域池，永遠在視野內
    mesh.castShadow = pool.shadow;
    mesh.receiveShadow = true;
    mesh.count = 0;
    pool.mesh = mesh;
    this.group.add(mesh);
  }

  _initBackground() {
    const C = this.C;
    const G = this.assets.geometries;
    this.bg = new THREE.Group();
    this.bg.name = 'terrain-background';
    this.scene.add(this.bg);

    // 遠山：頂點色往霧色混，下半部更淡 → 霧中遠景感
    const mg = G.mountain.clone();
    mg.computeBoundingBox();
    const mb = mg.boundingBox;
    const pos = mg.attributes.position;
    let col = mg.attributes.color;
    if (!col) {
      col = new THREE.BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3);
      mg.setAttribute('color', col);
    }
    const hy = Math.max(mb.max.y - mb.min.y, 1);
    for (let k = 0; k < pos.count; k++) {
      const t = (pos.getY(k) - mb.min.y) / hy;
      const haze = lerp(C.mountainHaze[0], C.mountainHaze[1], t);
      _c0.setRGB(col.getX(k), col.getY(k), col.getZ(k)).lerp(this._fogColor, haze);
      col.setXYZ(k, _c0.r, _c0.g, _c0.b);
    }
    this._mountainGeo = mg;
    this.mountains = new THREE.InstancedMesh(mg, this.matMountain, C.mountainCount);
    this.mountains.frustumCulled = false;
    // 畫在地形 / 物件之後（天空之前）：被近處雪丘擋住的遠山像素由 early-Z 直接丟掉（perf 量到 GPU −0.2 ms）
    this.mountains.renderOrder = 5e5;
    this.bg.add(this.mountains);

    this.clouds = new THREE.InstancedMesh(G.cloud, this.matCloud, C.cloudCount);
    this.clouds.frustumCulled = false;
    this.bg.add(this.clouds);
    this._cloudData = [];
    this._bgSink = 0;
  }

  _layoutBackground() {
    const C = this.C;
    const rng = mulberry32(seedOf(77, 3, this.seed));
    const n = C.mountainCount;
    const nFront = Math.ceil(n * 0.65); // 前方（-Z）放多一點
    for (let k = 0; k < n; k++) {
      const ang = k < nFront
        ? lerp(-1.45, 1.45, (k + 0.2 + rng() * 0.6) / nFront)
        : Math.PI + lerp(-1.5, 1.5, (k - nFront + rng()) / (n - nFront));
      const r = lerp(C.mountainRadius[0], C.mountainRadius[1], rng());
      const sc = lerp(C.mountainScale[0], C.mountainScale[1], rng());
      const sy = lerp(C.mountainHeightScale[0], C.mountainHeightScale[1], rng());
      _p.set(Math.sin(ang) * r, -rng() * 30, -Math.cos(ang) * r);
      _q.setFromAxisAngle(_up, rng() * TAU);
      _s.set(sc * lerp(0.9, 1.3, rng()), sy, sc * lerp(0.9, 1.3, rng()));
      this.mountains.setMatrixAt(k, _m4.compose(_p, _q, _s));
    }
    this.mountains.instanceMatrix.needsUpdate = true;
    this._cloudData.length = 0;
    for (let k = 0; k < C.cloudCount; k++) {
      this._cloudData.push({
        ang: -Math.PI * 0.55 + (k / C.cloudCount) * Math.PI * 1.1 + rng() * 0.2 + (k % 3 === 2 ? Math.PI : 0),
        r: lerp(C.cloudRadius[0], C.cloudRadius[1], rng()),
        y: lerp(C.cloudHeight[0], C.cloudHeight[1], rng()),
        s: lerp(C.cloudScale[0], C.cloudScale[1], rng()),
        yaw: (rng() - 0.5) * 0.6, // 相對「長邊朝向玩家」的偏轉；隨機 yaw 會出現側面看的窄小雲團
        speed: lerp(0.0015, 0.004, rng()),
      });
    }
    this._updateClouds(0);
  }

  _updateClouds(dt) {
    for (let k = 0; k < this._cloudData.length; k++) {
      const c = this._cloudData[k];
      c.ang += c.speed * dt;
      _p.set(Math.sin(c.ang) * c.r, this._bgSink + c.y, -Math.cos(c.ang) * c.r);
      _q.setFromAxisAngle(_up, c.yaw - c.ang);
      _s.set(c.s, c.s * 0.7, c.s * 0.8);
      this.clouds.setMatrixAt(k, _m4.compose(_p, _q, _s));
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  // ───────────────────────── 生命週期 ─────────────────────────
  reset(seed) {
    if (seed !== undefined && seed !== null) this.seed = seed | 0;
    if (this.seed === undefined) this.seed = 1;
    for (const ch of this.chunks.values()) this._disposeChunk(ch);
    this.chunks.clear();
    this._layouts.clear();

    const s = this.seed;
    this._p1 = hash2(11, 3, s) * TAU;
    this._p2 = hash2(12, 5, s) * TAU;
    this._bumpSeed = seedOf(21, 1, s) & 0xffff;
    this._hillSeed = seedOf(22, 1, s) & 0xffff;
    this._bandSeed = seedOf(23, 1, s) & 0xffff;

    // 旗門 / 跳台序列（依距離順序產生，只依 seed）
    this.gates = [];
    this.ramps = [];
    this._rampByChunk = new Map();
    this._line = [{ d: -1e6, x: 0 }, { d: this.C.startStraight, x: 0 }]; // 理想路線節點（旗門 / 跳台），兩側保證淨空
    this._gateSeq = 0;
    this._rampSeq = 0;
    this._pendingRamp = null;
    this._frng = mulberry32(seedOf(31, 7, s));
    this._nextGateD = this.C.firstGate;
    this._nextRampD = this.C.firstRamp;
    this._featDone = 0;
    this._ensureFeatures(this.C.viewAhead + 400);

    this._layoutBackground();
    this._playerZ = 0;
    this._time = 0;
    this._syncChunks(0, Infinity);
    this._followBackground(0);
  }

  update(playerZ, dt = 0) {
    this._playerZ = playerZ;
    this._prune(-playerZ);
    this._time += dt;
    this._syncChunks(playerZ, this.C.buildPerUpdate);
    this._followBackground(dt);
  }

  _chunkRange(playerZ) {
    const L = this.C.chunkLength;
    return [Math.floor(-(playerZ + this.C.keepBehind) / L), Math.floor(-(playerZ - this.C.viewAhead) / L)];
  }

  _syncChunks(playerZ, maxBuild) {
    const [i0, i1] = this._chunkRange(playerZ);
    let changed = false;
    for (const [i, ch] of this.chunks) {
      if (i < i0 || i > i1 + 3) {
        this._disposeChunk(ch);
        this.chunks.delete(i);
        changed = true;
      }
    }
    // 依距離玩家由近到遠建
    const pi = clamp(Math.floor(-playerZ / this.C.chunkLength), i0, i1);
    let built = 0;
    for (let k = 0; k <= i1 - i0 && built < maxBuild; k++) {
      for (const i of k === 0 ? [pi] : [pi + k, pi - k]) {
        if (i < i0 || i > i1 || this.chunks.has(i) || built >= maxBuild) continue;
        this.chunks.set(i, this._buildChunk(i));
        built++;
        changed = true;
      }
    }
    if (changed || pi !== this._poolPi) {
      this._poolPi = pi;
      this._rebuildPools(pi);
    }
    // 修剪過舊的 layout 快取（純函數，需要時可重算）
    if (this._layouts.size > 64) {
      for (const i of this._layouts.keys()) if (i < i0 - 4 || i > i1 + 8) this._layouts.delete(i);
    }
  }

  _followBackground(dt) {
    const d = -this._playerZ;
    const sink = this.C.mountainSink + this.C.mountainSlopeSink * this.slopeAt(d);
    this._bgSink = sink;
    this.bg.position.set(this.centerX(this._playerZ), this.baseY(d) - sink, this._playerZ);
    this._updateClouds(dt);
  }

  dispose() {
    for (const ch of this.chunks.values()) this._disposeChunk(ch);
    this.chunks.clear();
    for (const name of POOLS) {
      for (const p of [this.pools[name].near, this.pools[name].far]) {
        if (p.mesh) {
          this.group.remove(p.mesh);
          p.mesh.dispose();
        }
      }
    }
    this.scene.remove(this.group);
    this.scene.remove(this.bg);
    this.mountains.dispose();
    this.clouds.dispose();
    this._mountainGeo.dispose();
    this.matTerrain.dispose();
    this.matMountain.dispose();
    this.matCloud.dispose();
  }

  // ───────────────────────── 高度函數 ─────────────────────────
  difficulty(distance) {
    return clamp(distance / this.C.difficultyDistance, 0, 1);
  }

  // 下坡基準高度（坡度 tan 由 slopeStart 以 smoothstep 緩升到 slopeEnd，解析積分）
  baseY(d) {
    const C = this.C;
    const s0 = C.slopeStart;
    const s1 = C.slopeEnd;
    const D = C.difficultyDistance;
    if (d <= 0) return -s0 * d;
    if (d >= D) return -(s0 * D + (s1 - s0) * D * 0.5 + s1 * (d - D));
    const t = d / D;
    const t3 = t * t * t;
    return -(s0 * d + (s1 - s0) * D * (t3 - t3 * t * 0.5));
  }

  slopeAt(d) {
    const C = this.C;
    return C.slopeStart + (C.slopeEnd - C.slopeStart) * smoothstep(0, C.difficultyDistance, d);
  }

  centerX(z) {
    const d = -z;
    const C = this.C;
    const S = C.startStraight;
    if (d <= S) return 0;
    const e = smoothstep(S, S + C.curveEaseLength, d);
    const a = lerp(C.curveAmpStart, C.curveAmpEnd, smoothstep(0, 1, this.difficulty(d)));
    const w = (Math.sin(this._k1 * d + this._p1) + 0.35 * Math.sin(this._k2 * d + this._p2)) / 1.35;
    return e * a * w;
  }

  halfWidth(z) {
    const C = this.C;
    const d = -z;
    const hw = lerp(C.halfWidthStart, C.halfWidthEnd, this.difficulty(d));
    // 起跑滑道：較窄，柵欄往遠方收斂（附圖構圖），之後放寬到正常寬度
    if (d >= C.startChuteEnd) return hw;
    return lerp(C.startChuteHalfWidth, hw, smoothstep(C.startChuteHold, C.startChuteEnd, d));
  }

  // 側向剖面：賽道內微凹，柵欄外 C1 連續隆起並以 bankMax 軟性封頂
  _lateral(au, hw) {
    const C = this.C;
    if (au <= hw) return C.bowl * au * au;
    const e = au - hw;
    const q = e > C.bankShoulder ? e - C.bankShoulder : 0;
    const f = 2 * C.bowl * hw * e + this._bankRise * q * q;
    return C.bowl * hw * hw + C.bankMax * (1 - Math.exp(-f / C.bankMax));
  }

  // 不含跳台的地面高度（地形 mesh 用這個）
  groundHeight(x, z) {
    const C = this.C;
    const d = -z;
    const hw = this.halfWidth(z);
    const au = Math.abs(x - this.centerX(z));
    let y = this.baseY(d) + this._lateral(au, hw);
    const iw = 1 / C.bumpWavelength;
    y += C.bumpAmp * fbm2(x * iw, z * iw, this._bumpSeed, 2);
    if (au > hw + 3) {
      const w = smoothstep(hw + 3, hw + 30, au);
      const hwl = 1 / C.hillWavelength;
      y += C.hillAmp * w * (0.5 + 0.5 * fbm2(x * hwl, z * hwl, this._hillSeed, 2));
    }
    return y;
  }

  _rampAdd(x, z) {
    const L = this.C.chunkLength;
    const d = -z;
    if (d > this._featDone - 1) this._ensureFeatures(d + 400);
    const i = Math.floor(d / L);
    let add = 0;
    for (let k = i - 1; k <= i + 1; k++) {
      const list = this._rampByChunk.get(k);
      if (!list) continue;
      for (let j = 0; j < list.length; j++) {
        const r = list[j];
        // 跳台沿自身軸線（yaw 對齊當地賽道方向）：s = 沿軸距離，l = 側向
        const dx = x - r.x;
        const dz = z - r.z0;
        const s = dx * r.sy - dz * r.cy;
        if (s < 0 || s > r.len) continue;
        const ax = Math.abs(dx * r.cy + dz * r.sy);
        if (ax >= r.halfWidth + this._taper) continue;
        let p = r.height * rampProfile(s / r.len);
        if (ax > r.halfWidth) p *= 1 - (ax - r.halfWidth) / this._taper;
        if (p > add) add = p;
      }
    }
    return add;
  }

  heightAt(x, z) {
    return this.groundHeight(x, z) + this._rampAdd(x, z);
  }

  normalAt(x, z, out) {
    const o = out || new THREE.Vector3();
    const e = 0.3;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return o.set(-dx / (2 * e), 1, -dz / (2 * e)).normalize();
  }

  // ───────────────────────── 旗門 / 跳台序列 ─────────────────────────
  // 預期車速（m/s）：估算跳台飛行距離、旗門可達性
  _expSpeed(d) {
    const v = this.C.expectSpeed || [30, 38];
    return lerp(v[0], v[1], this.difficulty(d));
  }

  // 距離 D 內以「舒適轉彎半徑」做 S 形兩段圓弧能達到的最大側移
  _maxShift(D, d) {
    const P = this.config.player || {};
    const v = this._expSpeed(d);
    const w = lerp(P.turnRateLow || 2.1, P.turnRateHigh || 1.05, clamp(v / (P.turnSpeedRef || 32), 0, 1));
    const R = (this.C.gateTurnRadiusFactor || 2.5) * v / w;
    const sn = D / (2 * R);
    if (sn >= 1) return D;
    return 2 * R * (1 - Math.sqrt(1 - sn * sn));
  }

  // 預期車速下的最小轉彎半徑 v / ω(v)
  _turnRadius(d) {
    const P = this.config.player || {};
    const v = this._expSpeed(d);
    return v / lerp(P.turnRateLow || 2.1, P.turnRateHigh || 1.05, clamp(v / (P.turnSpeedRef || 32), 0, 1));
  }

  // 三點（x, d 平面）外接圓半徑
  _circR(a, b, x, d) {
    const ab = Math.hypot(b.x - a.x, b.d - a.d);
    const bc = Math.hypot(x - b.x, d - b.d);
    const ca = Math.hypot(a.x - x, a.d - d);
    const cr = Math.abs((b.x - a.x) * (d - a.d) - (b.d - a.d) * (x - a.x));
    return cr < 1e-9 ? 1e9 : (ab * bc * ca) / (2 * cr);
  }

  _pushLine(d, x, kind) {
    const L = this._line;
    let k = L.length;
    while (k > 0 && L[k - 1].d > d) k--;
    L.splice(k, 0, { d, x, kind });
  }

  // 理想路線在距離 d 的 x（旗門中心 / 跳台軸線之間線性內插）；還沒產生到的地方回傳 null
  _lineX(d) {
    const L = this._line;
    let lo = 0;
    let hi = L.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (L[mid].d <= d) lo = mid + 1;
      else hi = mid;
    }
    if (lo <= 0 || lo >= L.length) return null;
    const a = L[lo - 1];
    const b = L[lo];
    return a.x + (b.x - a.x) * ((d - a.d) / Math.max(b.d - a.d, 1e-6));
  }

  _addGate(dG, ramp, funnel) {
    const C = this.C;
    const rng = this._frng;
    const diff = this.difficulty(dG);
    const gw = lerp(C.gateWidth[0], C.gateWidth[1], diff);
    const z = -dG;
    const cx = this.centerX(z);
    let x;
    if (funnel) {
      // 跳台前的引導門：放在跳台軸線往回延伸的線上（過門 = 對正跳台）
      const k = (ramp.d - dG) / ramp.cy;
      x = ramp.x - k * ramp.sy;
    } else {
      const hw = this.halfWidth(z);
      const maxOff = Math.max(0, hw - gw / 2 - 2.5) * 0.85;
      // 可達性：相對賽道中心的側移量受「上一個節點 → 這個旗門」以及「這個旗門 → 下一個跳台」
      // 距離內以舒適轉彎半徑能轉過去的量限制
      const last = this._line[this._line.length - 1];
      const uP = last.x - this.centerX(-last.d);
      const sh = this._maxShift(Math.max(1, dG - last.d), dG);
      let lo = Math.max(-maxOff, uP - sh);
      let hi = Math.min(maxOff, uP + sh);
      if (ramp) {
        const uR = ramp.x - this.centerX(ramp.z0);
        const shR = this._maxShift(Math.max(1, ramp.d - dG), dG);
        lo = Math.max(lo, uR - shR);
        hi = Math.min(hi, uR + shR);
      }
      if (lo > hi) lo = hi = clamp(0.5 * (lo + hi), -maxOff, maxOff);
      // 再檢查「前兩個節點 + 這個旗門」的外接圓半徑（含賽道本身的彎）≥ gateMinRadiusFactor × 最小轉彎半徑；
      // 隨機取幾個候選，取第一個合格的，都不合格取半徑最大的
      const Lp = this._line;
      const a0 = Lp.length >= 2 ? Lp[Lp.length - 2] : null;
      const rNeed = (C.gateMinRadiusFactor || 0) * this._turnRadius(dG);
      // 下一個是跳台：這個門之後還有引導門 + 跳台起點（共線），也要一起檢查
      let fA = null;
      let fB = null;
      if (ramp && ramp.d - dG < 2.5 * lerp(C.gateSpacing[0], C.gateSpacing[1], diff)) {
        const dF = ramp.d - C.rampFunnelGate;
        fB = { d: ramp.d - 2, x: ramp.x - 2 * ramp.sy };
        if (dF - dG >= C.gateMinGap) fA = { d: dF, x: ramp.x - (C.rampFunnelGate / ramp.cy) * ramp.sy };
      }
      const score = (xt) => {
        let R = a0 ? this._circR(a0, last, xt, dG) : 1e9;
        const p = { d: dG, x: xt };
        if (fA) R = Math.min(R, this._circR(last, p, fA.x, fA.d), this._circR(p, fA, fB.x, fB.d));
        else if (fB) R = Math.min(R, this._circR(last, p, fB.x, fB.d));
        return R;
      };
      let bestX = cx + lo + (hi - lo) * rng();
      if (rNeed > 0) {
        let bestR = score(bestX);
        for (let t = 0; t < 12 && bestR < rNeed; t++) {
          const xt = cx + lo + (hi - lo) * (t < 2 ? t : rng());
          const Rt = score(xt);
          if (Rt > bestR) { bestR = Rt; bestX = xt; }
        }
      }
      x = bestX;
    }
    this.gates.push({ id: this._gateSeq++, z, d: dG, x, width: gw, xLeft: x - gw / 2, xRight: x + gw / 2 });
    this._pushLine(dG, x, funnel ? 'funnel' : 'gate');
    this._nextGateD = dG + lerp(C.gateSpacing[0], C.gateSpacing[1], diff) * (0.85 + 0.3 * rng());
  }

  // 跳台：軸線對齊「跳台 → 預估落地點」這段賽道的弦方向，並確保整條飛行線落在柵欄內；
  // 彎太急放不下就往前挪（rampSearchStep），都不行回傳 null。
  _planRamp(dStart) {
    const C = this.C;
    const last = this._line[this._line.length - 1];
    for (let t = 0; t < C.rampSearchTries; t++) {
      const dR = dStart + t * C.rampSearchStep;
      const diff = this.difficulty(dR);
      const len = lerp(C.rampLength[0], C.rampLength[1], diff);
      const land = this._expSpeed(dR) * C.rampLandingTime + C.rampLandingClear;
      const dE = dR + len + land;
      const cx0 = this.centerX(-dR);
      // 弦方向含跳台前的引導段（approach），讓「引導門 → 跳台 → 落地」整段是直線且貼著賽道走向
      const A = C.rampApproachLine || 0;
      const tn = (this.centerX(-dE) - this.centerX(-(dR - A))) / (dE - dR + A);
      const cy = 1 / Math.sqrt(1 + tn * tn);
      const sy = tn * cy;
      let lo = -Infinity;
      let hi = Infinity;
      for (let s = -A; s <= len + land + 0.01; s += 4) {
        const z = -(dR + s * cy);
        const off = cx0 + s * sy - this.centerX(z);
        const half = s < 0 ? 3.5 : s <= len + 2 ? C.rampHalfWidth + this._taper + 1.5 : C.rampLandingHalfWidth;
        const lim = this.halfWidth(z) - half;
        lo = Math.max(lo, -lim - off);
        hi = Math.min(hi, lim - off);
      }
      const uP = last.x - this.centerX(-last.d);
      const sh = this._maxShift(Math.max(1, dR - last.d), dR);
      lo = Math.max(lo, uP - sh);
      hi = Math.min(hi, uP + sh);
      if (lo > hi) continue;
      const rng = this._frng;
      const c = clamp(0, lo, hi);
      const span = Math.min(3, 0.5 * (hi - lo));
      const u = clamp(c + (rng() * 2 - 1) * span, lo, hi);
      const x = cx0 + u;
      const L = len + land;
      return {
        id: this._rampSeq++, x, z0: -dR, z1: -(dR + len * cy), x1: x + len * sy, d: dR, len,
        halfWidth: C.rampHalfWidth, height: lerp(C.rampHeight[0], C.rampHeight[1], diff),
        yaw: Math.atan(tn), cy, sy, land, dEnd: dR + L * cy, xEnd: x + L * sy,
      };
    }
    return null;
  }

  _ensureFeatures(target) {
    const C = this.C;
    const rng = this._frng;
    let guard = 0;
    while (guard++ < 100000) {
      if (!this._pendingRamp) {
        const r = this._planRamp(this._nextRampD);
        if (!r) {
          // 彎太急放不下：整段跳過
          this._nextRampD += C.rampSearchStep * C.rampSearchTries;
          continue;
        }
        this._pendingRamp = r;
      }
      const R = this._pendingRamp;
      if (Math.min(this._nextGateD, R.d) >= target) break;
      if (this._nextGateD < R.d - C.rampApproachClear) {
        this._addGate(this._nextGateD, R, false);
        continue;
      }
      // 跳台前的引導門（和上一個旗門距離夠才放）
      const dF = R.d - C.rampFunnelGate;
      const lg = this.gates[this.gates.length - 1];
      if (dF > C.startStraight && (!lg || dF - lg.d >= C.gateMinGap)) this._addGate(dF, R, true);
      // 放跳台
      this.ramps.push(R);
      for (let k = Math.floor((R.d - 6) / C.chunkLength); k <= Math.floor((R.d + R.len + 6) / C.chunkLength); k++) {
        // 查詢用：跳台可能跨 chunk；mesh 只在 R.d 所在 chunk 建
        const list = this._rampByChunk.get(k);
        if (list) list.push(R);
        else this._rampByChunk.set(k, [R]);
      }
      this._pushLine(R.d - 2, R.x - 2 * R.sy, 'ramp');
      this._pushLine(R.dEnd, R.xEnd, 'land');
      this._nextGateD = R.dEnd + C.gateAfterLanding + rng() * 12;
      const diff = this.difficulty(R.d);
      this._nextRampD = R.d + lerp(C.rampSpacing[0], C.rampSpacing[1], diff) * (0.8 + 0.4 * rng());
      this._pendingRamp = null;
    }
    this._featDone = Math.min(this._nextGateD, this._pendingRamp ? this._pendingRamp.d : this._nextRampD);
  }

  // 無盡：丟掉玩家後方很遠的旗門 / 跳台 / 路線節點，陣列大小有上限
  _prune(dPlayer) {
    const cut = dPlayer - 400;
    const drop = (list, key) => {
      let n = 0;
      while (n < list.length - 2 && list[n][key] < cut) n++;
      if (n > 32) list.splice(0, n);
    };
    drop(this.gates, 'd');
    drop(this.ramps, 'dEnd');
    drop(this._line, 'd');
    const kCut = Math.floor(cut / this.C.chunkLength) - 2;
    if (this._rampByChunk.size > 48) {
      for (const k of this._rampByChunk.keys()) if (k < kCut) this._rampByChunk.delete(k);
    }
  }

  // 第一個 d > dMin 的索引（list 依 d 遞增）
  _lowerBound(list, dMin) {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].d <= dMin) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  gatesCrossed(zPrev, zNow) {
    const out = [];
    if (!(zNow < zPrev)) return out;
    const d0 = -zPrev;
    const d1 = -zNow;
    if (d1 > this._featDone - 1) this._ensureFeatures(d1 + 400);
    for (let k = this._lowerBound(this.gates, d0); k < this.gates.length; k++) {
      const g = this.gates[k];
      if (g.d > d1) break;
      out.push(g);
    }
    return out;
  }

  upcomingGates(fromZ, length) {
    const out = [];
    const d0 = -fromZ;
    const d1 = d0 + length;
    if (d1 > this._featDone - 1) this._ensureFeatures(d1 + 400);
    for (let k = this._lowerBound(this.gates, d0 - 1e-9); k < this.gates.length; k++) {
      const g = this.gates[k];
      if (g.d > d1) break;
      out.push(g);
    }
    return out;
  }

  rampsNear(z, range) {
    const out = [];
    const d = -z;
    if (d + range > this._featDone - 1) this._ensureFeatures(d + range + 400);
    for (let k = this._lowerBound(this.ramps, d - range - this._rampLenMax); k < this.ramps.length; k++) {
      const r = this.ramps[k];
      if (r.d > d + range) break;
      if (r.d + r.len < d - range) continue;
      out.push(r);
    }
    return out;
  }

  upcomingPath(fromZ, length, step = 10) {
    const out = [];
    const n = Math.max(1, Math.ceil(length / step));
    for (let k = 0; k <= n; k++) {
      const z = fromZ - Math.min(k * step, length);
      out.push([this.centerX(z), z]);
    }
    return out;
  }

  // ───────────────────────── 物件配置（純函數 of (i, seed)） ─────────────────────────
  _blocked(x, d) {
    const C = this.C;
    const cr = C.clearRadius;
    const gs = this.gates;
    for (let k = this._lowerBound(gs, d - cr); k < gs.length; k++) {
      const g = gs[k];
      if (g.d > d + cr) break;
      if (x > g.xLeft - cr && x < g.xRight + cr) return true;
    }
    // 跳台本體周圍 + 落地走廊（沿跳台軸線，越遠越寬；長度 = 預期車速 × rampLandingTime）
    const rs = this.ramps;
    const z = -d;
    for (let k = this._lowerBound(rs, d - this._rampSpanMax); k < rs.length; k++) {
      const r = rs[k];
      if (r.d > d + cr) break;
      const dx = x - r.x;
      const dz = z - r.z0;
      const s = dx * r.sy - dz * r.cy;
      const l = Math.abs(dx * r.cy + dz * r.sy);
      if (s > -cr && s < r.len + 6 && l < r.halfWidth + this._taper + cr) return true;
      if (s >= r.len && s < r.len + r.land && l < C.rampLandingHalfWidth + C.rampLandingSpread * (s - r.len) + 1.2) return true;
    }
    // 理想路線（旗門中心 / 跳台軸線連線）兩側保證淨空 → 任何難度都有一條可通過的線
    const lx = this._lineX(d);
    if (lx !== null) {
      const lh = C.lineClearHalfWidth || [3.2, 2.4];
      if (Math.abs(x - lx) < lerp(lh[0], lh[1], this.difficulty(d)) + 1.1) return true;
    }
    return false;
  }

  _layout(i) {
    let lay = this._layouts.get(i);
    if (lay) return lay;
    const C = this.C;
    const L = C.chunkLength;
    const dA = i * L;
    this._ensureFeatures(dA + L + 400);
    const rng = mulberry32(seedOf(i, 7919, this.seed));
    const obs = [];

    const tooClose = (x, z, minD) => {
      for (let k = 0; k < obs.length; k++) {
        const o = obs[k];
        const dx = o.x - x;
        const dz = o.z - z;
        if (dx * dx + dz * dz < minD * minD) return true;
      }
      return false;
    };
    const addTree = (x, z, s, sy) => {
      const v = Math.floor(rng() * 3);
      const y = this.groundHeight(x, z) - 0.25;
      obs.push({
        id: 0, type: 'tree', x, z, r: 0.85 * s, top: y + this._pineH[v] * sy,
        v, y, yaw: rng() * TAU, s, sy,
      });
    };
    const addRock = (x, z, s) => {
      const v = Math.floor(rng() * 3);
      const ri = this._rockInfo[v];
      const sy = s * lerp(0.8, 1.15, rng());
      const y = this.groundHeight(x, z) - 0.15;
      obs.push({
        id: 0, type: 'rock', x, z, r: ri.r * s * 0.85, top: y + ri.h * sy,
        v, y, yaw: rng() * TAU, s, sy,
      });
    };

    // 柵欄外：緊貼柵欄的松樹（附圖那種）
    for (let side = -1; side <= 1; side += 2) {
      const n = Math.floor(C.nearFenceTrees * (0.5 + rng()));
      for (let k = 0; k < n; k++) {
        const d = dA + rng() * L;
        const z = -d;
        const x = this.centerX(z) + side * (this.halfWidth(z) + lerp(2.4, 5.5, rng()));
        if (tooClose(x, z, 3)) continue;
        const s = lerp(0.75, 1.15, rng());
        addTree(x, z, s, s * lerp(0.9, 1.15, rng()));
      }
    }
    // 柵欄外：森林帶（低頻 noise 決定疏密）
    const nCand = Math.round(C.treesOutside * 1.7);
    for (let k = 0; k < nCand; k++) {
      const d = dA + rng() * L;
      const z = -d;
      const side = rng() < 0.5 ? -1 : 1;
      const r0 = rng();
      const e = r0 < 0.7 ? lerp(4, 45, r0 / 0.7) : lerp(45, 150, (r0 - 0.7) / 0.3);
      const band = 0.5 + 0.5 * valueNoise2(d / 70, side * 5.3 + e / 60, this._bandSeed);
      if (rng() > 0.15 + 0.85 * band * band * 1.6) continue;
      const x = this.centerX(z) + side * (this.halfWidth(z) + e);
      if (tooClose(x, z, 2.8)) continue;
      const s = lerp(0.7, 1.35, rng());
      addTree(x, z, s, s * lerp(0.85, 1.2, rng()));
    }
    // 柵欄外岩石
    for (let k = 0; k < C.rocksOutside; k++) {
      const d = dA + rng() * L;
      const z = -d;
      const side = rng() < 0.5 ? -1 : 1;
      const x = this.centerX(z) + side * (this.halfWidth(z) + lerp(3.2, 50, rng() * rng()));
      if (tooClose(x, z, 3)) continue;
      addRock(x, z, lerp(0.8, 1.8, rng()));
    }
    // 賽道內：隨難度增加
    const dMid = dA + L * 0.5;
    // 障礙密度：difficultyDistance 之後仍緩慢加密（overDensityPerKm，上限 overDensityMax），理想路線淨空保證仍可通過
    const over = Math.min(C.overDensityMax || 0, Math.max(0, dMid - C.difficultyDistance) * 0.001 * (C.overDensityPerKm || 0));
    const diff = this.difficulty(dMid) + over;
    const poisson = (mean) => {
      const lim = Math.exp(-mean);
      let n = 0;
      let p = rng();
      while (p > lim && n < 20) {
        n++;
        p *= rng();
      }
      return n;
    };
    const place = (count, kind) => {
      for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 8; tries++) {
          const d = dA + rng() * L;
          if (d < C.startStraight + 10) continue;
          const z = -d;
          const hw = this.halfWidth(z);
          const x = this.centerX(z) + (rng() * 2 - 1) * (hw - 2);
          if (this._blocked(x, d) || tooClose(x, z, 5)) continue;
          if (kind === 'tree') {
            const s = lerp(0.75, 1.1, rng());
            addTree(x, z, s, s * lerp(0.9, 1.1, rng()));
          } else {
            addRock(x, z, lerp(0.7, 1.2, rng()));
          }
          break;
        }
      }
    };
    if (dA + L > C.startStraight) {
      place(poisson(lerp(C.treesInsideCourse[0], C.treesInsideCourse[1], diff)), 'tree');
      place(poisson(lerp(C.rocksInsideCourse[0], C.rocksInsideCourse[1], diff)), 'rock');
    }

    obs.sort((a, b) => b.z - a.z);
    let maxR = 0;
    for (let k = 0; k < obs.length; k++) {
      obs[k].id = i * 1000 + k;
      if (obs[k].r > maxR) maxR = obs[k].r;
    }
    lay = { i, obstacles: obs, maxR };
    this._layouts.set(i, lay);
    return lay;
  }

  queryObstacles(x, z, radius) {
    const out = [];
    const L = this.C.chunkLength;
    const reach = radius + 2;
    const iA = Math.floor((-z - reach) / L);
    const iB = Math.floor((-z + reach) / L);
    for (let i = iA; i <= iB; i++) {
      const lay = this._layout(i);
      const obs = lay.obstacles; // 依 z 遞減排序
      const zHi = z + radius + lay.maxR;
      const zLo = z - radius - lay.maxR;
      let lo = 0;
      let hi = obs.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (obs[mid].z > zHi) lo = mid + 1;
        else hi = mid;
      }
      for (let k = lo; k < obs.length; k++) {
        const o = obs[k];
        if (o.z < zLo) break;
        const dx = o.x - x;
        const dz = o.z - z;
        const rr = radius + o.r;
        if (dx * dx + dz * dz <= rr * rr) out.push(o);
      }
    }
    return out;
  }

  // ───────────────────────── Chunk 建構 ─────────────────────────
  _rowOffsets(hw, out) {
    const C = this.C;
    const a = hw + C.meshMargin;
    const W = C.chunkWidth / 2;
    let j = 0;
    for (let k = C.outerCols; k >= 1; k--) out[j++] = -(a + (W - a) * Math.pow(k / C.outerCols, 1.6));
    for (let k = 0; k < C.marginCols; k++) out[j++] = -a + ((a - hw) * k) / C.marginCols;
    for (let k = 0; k <= C.courseCols; k++) out[j++] = -hw + (2 * hw * k) / C.courseCols;
    for (let k = 1; k <= C.marginCols; k++) out[j++] = hw + ((a - hw) * k) / C.marginCols;
    for (let k = 1; k <= C.outerCols; k++) out[j++] = a + (W - a) * Math.pow(k / C.outerCols, 1.6);
    return out;
  }

  _buildChunk(i) {
    const lay = this._layout(i);
    const ch = { i, mesh: null, ramps: [], inst: {} };
    ch.mesh = this._buildTerrainMesh(i);
    this.group.add(ch.mesh);

    const acc = {};
    for (const n of POOLS) acc[n] = [];
    const pushM = (name) => {
      const a = acc[name];
      const e = _m4.elements;
      for (let k = 0; k < 16; k++) a.push(e[k]);
    };

    for (const o of lay.obstacles) {
      _p.set(o.x, o.y, o.z);
      _q.setFromAxisAngle(_up, o.yaw);
      _s.set(o.s, o.sy, o.s);
      _m4.compose(_p, _q, _s);
      pushM((o.type === 'tree' ? 'pine' : 'rock') + o.v);
    }

    // 柵欄：柱子在 d = k*spacing，橫木接到下一根
    const C = this.C;
    const L = C.chunkLength;
    const sp = C.fenceSpacing;
    const kA = Math.ceil((i * L) / sp - 1e-9);
    const kB = Math.ceil(((i + 1) * L) / sp - 1e-9);
    for (let side = -1; side <= 1; side += 2) {
      for (let k = kA; k < kB; k++) {
        const za = -k * sp;
        const zb = -(k + 1) * sp;
        const xa = this.centerX(za) + side * this.halfWidth(za);
        const xb = this.centerX(zb) + side * this.halfWidth(zb);
        const ya = this.groundHeight(xa, za) - 0.08;
        const yb = this.groundHeight(xb, zb) - 0.08;
        const fx = xb - xa;
        const fy = yb - ya;
        const fz = zb - za;
        const hl = Math.hypot(fx, fz);
        const hx = fx / hl;
        const hz = fz / hl;
        // 柱：沿賽道方向 yaw
        _q.setFromAxisAngle(_up, Math.atan2(-hx, -hz));
        _p.set(xa, ya, za);
        _s.set(1, 1, 1);
        _m4.compose(_p, _q, _s);
        pushM('post');
        // 橫木：local -Z → 兩柱連線（含高低差），local Y 保持垂直（剪切），local X 水平
        _m4.set(
          -hz, 0, -fx, xa,
          0, 1, -fy, ya,
          hx, 0, -fz, za,
          0, 0, 0, 1,
        );
        pushM('rail');
      }
    }

    // 旗門
    const gates = this.gates;
    for (let k = this._lowerBound(gates, i * L - 1e-9); k < gates.length; k++) {
      const g = gates[k];
      if (g.d >= (i + 1) * L) break;
      for (let side = -1; side <= 1; side += 2) {
        const gx = side < 0 ? g.xLeft : g.xRight;
        _p.set(gx, this.groundHeight(gx, g.z) - 0.1, g.z);
        // 旗幟在 local +X 側；右桿轉 π 讓旗子朝賽道內
        _q.setFromAxisAngle(_up, side < 0 ? 0 : Math.PI);
        _s.set(1, 1, 1);
        _m4.compose(_p, _q, _s);
        pushM('gate');
      }
    }
    // 起跑區裝飾旗幟（不計入旗門）
    const bd = C.startBannerDistance;
    if (bd >= i * L && bd < (i + 1) * L) {
      const z = -bd;
      for (let side = -1; side <= 1; side += 2) {
        const gx = this.centerX(z) + side * (this.halfWidth(z) - 1.2);
        _p.set(gx, this.groundHeight(gx, z) - 0.1, z);
        _q.setFromAxisAngle(_up, side < 0 ? 0.25 : Math.PI - 0.25);
        _s.set(1.1, 1.1, 1.1);
        _m4.compose(_p, _q, _s);
        pushM('gate');
      }
    }

    for (const n of POOLS) ch.inst[n] = new Float32Array(acc[n]);

    // 跳台
    const list = this._rampByChunk.get(i);
    if (list && i >= 0) {
      for (const r of list) {
        if (Math.floor(r.d / L) !== i) continue; // 跨 chunk 的跳台只由起點所在 chunk 建 mesh
        const m = this._buildRampMesh(r);
        ch.ramps.push(m);
        this.group.add(m);
      }
    }
    return ch;
  }

  _disposeChunk(ch) {
    if (ch.mesh) {
      this.group.remove(ch.mesh);
      ch.mesh.geometry.dispose();
    }
    for (const m of ch.ramps) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    ch.ramps.length = 0;
  }

  _rebuildPools(pi) {
    const C = this.C;
    const nA = pi - C.shadowChunksBehind;
    const nB = pi + C.shadowChunksAhead;
    const keys = [...this.chunks.keys()].sort((a, b) => a - b);
    for (const name of POOLS) {
      for (const near of [true, false]) {
        const pool = near ? this.pools[name].near : this.pools[name].far;
        let total = 0;
        for (const i of keys) if ((i >= nA && i <= nB) === near) total += this.chunks.get(i).inst[name].length;
        const n = total / 16;
        this._ensurePool(pool, n);
        const arr = pool.mesh.instanceMatrix.array;
        let off = 0;
        for (const i of keys) {
          if ((i >= nA && i <= nB) !== near) continue;
          const a = this.chunks.get(i).inst[name];
          arr.set(a, off);
          off += a.length;
        }
        pool.mesh.count = n;
        pool.mesh.visible = n > 0;
        pool.mesh.instanceMatrix.clearUpdateRanges();
        pool.mesh.instanceMatrix.addUpdateRange(0, Math.max(off, 16));
        pool.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  _faceColor(ax, ay, az, bx, by, bz, cx, cy, cz, d, course, hollow, jitter, out, o) {
    // 面法線
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const sun = this._sun;
    const sd = nx * sun.x + ny * sun.y + nz * sun.z;
    const s = this.slopeAt(d);
    const refDot = (sun.y - s * sun.z) / Math.sqrt(1 + s * s);
    const away = clamp((refDot - sd) * 3.2, 0, 1);
    // 賽道內：背光 / 凹處權重 0.3 / 0.2 → 0.45 / 0.4、亂數 0.03 → 0.06（verifier：近景雪面 223 對附圖 187，太平太亮）
    let t = course ? 0.02 + 0.45 * away + 0.4 * hollow : 0.05 + 0.3 * away + 0.24 * hollow;
    t = clamp(t + jitter, 0, 1);
    const base = course ? this.colSnowCourse : this.colSnowOff;
    const cc = this.colCool;
    const r = base.r + (cc.r - base.r) * t;
    const g = base.g + (cc.g - base.g) * t;
    const b = base.b + (cc.b - base.b) * t;
    for (let k = 0; k < 3; k++) {
      out[o + k * 3] = r;
      out[o + k * 3 + 1] = g;
      out[o + k * 3 + 2] = b;
    }
  }

  _buildTerrainMesh(i) {
    const C = this.C;
    const L = C.chunkLength;
    const rows = C.segmentsZ + 1;
    const cols = this._nCols;
    const dz = L / C.segmentsZ;
    const gp = new Float64Array(rows * cols * 3);
    const off = this._rowOff;
    for (let r = 0; r < rows; r++) {
      const z = -(i * L + r * dz);
      const cx = this.centerX(z);
      this._rowOffsets(this.halfWidth(z), off);
      for (let c = 0; c < cols; c++) {
        const x = cx + off[c];
        const o = (r * cols + c) * 3;
        gp[o] = x;
        gp[o + 1] = this.groundHeight(x, z);
        gp[o + 2] = z;
      }
    }
    const nq = (rows - 1) * (cols - 1);
    const pos = new Float32Array(nq * 18);
    const col = new Float32Array(nq * 18);
    const courseC0 = C.outerCols + C.marginCols;
    const courseC1 = courseC0 + C.courseCols;
    const iw = 1 / C.bumpWavelength;
    let w = 0;
    const tri = (a, b, c, course, hollow, jitter, d) => {
      pos[w] = gp[a]; pos[w + 1] = gp[a + 1]; pos[w + 2] = gp[a + 2];
      pos[w + 3] = gp[b]; pos[w + 4] = gp[b + 1]; pos[w + 5] = gp[b + 2];
      pos[w + 6] = gp[c]; pos[w + 7] = gp[c + 1]; pos[w + 8] = gp[c + 2];
      this._faceColor(
        gp[a], gp[a + 1], gp[a + 2], gp[b], gp[b + 1], gp[b + 2], gp[c], gp[c + 1], gp[c + 2],
        d, course, hollow, jitter, col, w,
      );
      w += 9;
    };
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const A = (r * cols + c) * 3;
        const B = A + 3;
        const Cc = ((r + 1) * cols + c) * 3;
        const D = Cc + 3;
        const mx = 0.25 * (gp[A] + gp[B] + gp[Cc] + gp[D]);
        const mz = 0.25 * (gp[A + 2] + gp[B + 2] + gp[Cc + 2] + gp[D + 2]);
        const hTrue = this.groundHeight(mx, mz);
        const diagAD = 0.5 * (gp[A + 1] + gp[D + 1]);
        const diagBC = 0.5 * (gp[B + 1] + gp[Cc + 1]);
        const course = c >= courseC0 && c < courseC1;
        const n = fbm2(mx * iw, mz * iw, this._bumpSeed, 2);
        const hollow = clamp(-n * 1.6, 0, 1);
        const j1 = (hash2(r * 131 + c, i, this.seed) - 0.5) * 0.06;
        const j2 = (hash2(r * 131 + c, i + 7777, this.seed) - 0.5) * 0.06;
        const d = -mz;
        if (Math.abs(diagAD - hTrue) <= Math.abs(diagBC - hTrue)) {
          tri(A, B, D, course, hollow, j1, d);
          tri(A, D, Cc, course, hollow, j2, d);
        } else {
          tri(A, B, Cc, course, hollow, j1, d);
          tri(B, D, Cc, course, hollow, j2, d);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, this.matTerrain);
    mesh.name = 'terrain-chunk-' + i;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  // 跳台 mesh：直接取樣 heightAt，頂面與物理高度一致
  _buildRampMesh(r) {
    const tp = this._taper;
    const hw = r.halfWidth;
    const xs = [-hw - tp, -hw, -hw * 0.5, 0, hw * 0.5, hw, hw + tp];
    const ss = [];
    const nS = 10;
    for (let k = 0; k <= nS; k++) ss.push((r.len - 0.6) * (k / nS));
    ss.push(r.len);
    const nx = xs.length;
    const ns = ss.length;
    const grid = new Float32Array(nx * ns * 3);
    for (let a = 0; a < ns; a++) {
      for (let b = 0; b < nx; b++) {
        // 沿跳台軸線（yaw）旋轉：前進 = (sy, -cy)，右 = (cy, sy)
        const x = r.x + xs[b] * r.cy + ss[a] * r.sy;
        const z = r.z0 + xs[b] * r.sy - ss[a] * r.cy;
        const edge = b === 0 || b === nx - 1 || a === 0;
        const y = edge ? this.groundHeight(x, z) - 0.04 : this.heightAt(x, z) + 0.015;
        const o = (a * nx + b) * 3;
        grid[o] = x;
        grid[o + 1] = y;
        grid[o + 2] = z;
      }
    }
    const pos = [];
    const col = [];
    const put = (x, y, z, c) => {
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
    };
    const P = (a, b) => (a * nx + b) * 3;
    const triG = (i0, i1, i2, c) => {
      put(grid[i0], grid[i0 + 1], grid[i0 + 2], c);
      put(grid[i1], grid[i1 + 1], grid[i1 + 2], c);
      put(grid[i2], grid[i2 + 1], grid[i2 + 2], c);
    };
    for (let a = 0; a < ns - 1; a++) {
      const lip = a === ns - 2;
      for (let b = 0; b < nx - 1; b++) {
        const side = b === 0 || b === nx - 2;
        const c = lip ? this.colRampLip : side ? this.colRampSide : this.colRampTop;
        // a 行在較大 z；A=(a,b) B=(a,b+1) C=(a+1,b) D=(a+1,b+1)
        triG(P(a, b), P(a, b + 1), P(a + 1, b + 1), c);
        triG(P(a, b), P(a + 1, b + 1), P(a + 1, b), c);
      }
    }
    // 唇口後方垂直面（面向 -Z）
    const a = ns - 1;
    for (let b = 0; b < nx - 1; b++) {
      const t0 = P(a, b);
      const t1 = P(a, b + 1);
      const x0 = grid[t0];
      const x1 = grid[t1];
      const z0 = grid[t0 + 2];
      const z1 = grid[t1 + 2];
      const y0 = this.groundHeight(x0, z0) - 0.3;
      const y1 = this.groundHeight(x1, z1) - 0.3;
      const c = this.colRampBack;
      put(x0, grid[t0 + 1], z0, c);
      put(x0, y0, z0, c);
      put(x1, y1, z1, c);
      put(x0, grid[t0 + 1], z0, c);
      put(x1, y1, z1, c);
      put(x1, grid[t1 + 1], z1, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.matTerrain);
    mesh.name = 'ramp-' + r.id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  // debug / 測試用
  stats() {
    const inst = {};
    let tris = 0;
    let shadowTris = 0;
    for (const n of POOLS) {
      const { near, far } = this.pools[n];
      const cN = near.mesh ? near.mesh.count : 0;
      const cF = far.mesh ? far.mesh.count : 0;
      inst[n] = cN + cF;
      const g = near.geo;
      const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += (cN + cF) * t;
      shadowTris += cN * t;
    }
    for (const ch of this.chunks.values()) {
      tris += ch.mesh.geometry.attributes.position.count / 3;
      for (const m of ch.ramps) tris += m.geometry.attributes.position.count / 3;
    }
    return { chunks: this.chunks.size, instances: inst, triangles: Math.round(tris), shadowCasterTriangles: Math.round(shadowTris) };
  }
}
