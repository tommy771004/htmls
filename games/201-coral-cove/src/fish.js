// 魚群：五種可釣魚在礁區游蕩（平滑轉向、避開木樁、淺灘與礁石珊瑚），小沙丁魚以 boids 成群；
// 每條魚一個 AnimationMixer 播 <id>_swim，timeScale 隨速度。
import * as THREE from 'three';
import { getFish, findClip, shadowify } from './assets.js';
import { fishPH, SPECIES } from './placeholders.js';
import { floorY, REEFS, rng, pierFoot } from './terrain.js';
import { REEF_OBST } from './world.js';

// 礁石與珊瑚（world.js 擺放時記下的 {x, z, r, top, y}）依 2 m 格子分桶，查詢只看附近幾個
const OG = 2;
let obstGrid = null;
function obstNear(x, z) {
  if (!obstGrid) {
    obstGrid = new Map();
    for (const o of REEF_OBST) {
      const m = o.r + 1.2;
      for (let i = Math.floor((o.x - m) / OG); i <= Math.floor((o.x + m) / OG); i++) for (let j = Math.floor((o.z - m) / OG); j <= Math.floor((o.z + m) / OG); j++) {
        const k = i + ',' + j; if (!obstGrid.has(k)) obstGrid.set(k, []); obstGrid.get(k).push(o);
      }
    }
  }
  return obstGrid.get(Math.floor(x / OG) + ',' + Math.floor(z / OG)) || [];
}
// (x, z) 處魚身中心的最低高度：海床＋margin，礁石／珊瑚範圍內再抬到「頂高＋margin」。
// hl＝魚身半長（頭尾也不能插進去）；邊緣往外平滑降回海床，魚是被輕輕抬過去，不會跳。
export function floorUnder(x, z, hl = 0, margin = 0.22) {
  let lo = floorY(x, z) + margin;
  for (const o of obstNear(x, z)) {
    const u = (Math.hypot(x - o.x, z - o.z) - hl) / o.r;
    if (u >= 1) continue;
    const k = u <= 0 ? 1 : 1 - u * u * u * u;
    lo = Math.max(lo, o.y + (o.top + margin * 0.6 - o.y) * k);
  }
  return lo;
}

export const CATCHABLE = ['clown', 'tang', 'snapper', 'puffer', 'parrot'];
// shadowify() 把蒙皮網格設成不剔除；改給一個涵蓋游動與甩動的固定包圍球（bind pose 的球放大 k 倍），
// 畫面外、陰影範圍外的魚就不畫（手機直式畫面窄，省最多）。
const _sph = new THREE.Sphere();
function cullable(obj, k) {
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.computeBoundingSphere(); _sph.copy(o.boundingSphere); _sph.radius = _sph.radius * k + 0.02;
    o.boundingSphere = _sph.clone(); o.frustumCulled = true;
  });
}
export const FISH_INFO = {
  // 行為參數（fishing.js 讀取）：bread＝對麵包的興趣（被吸引的機率倍數）、reef＝只在礁區附近才有興趣、nibble＝咬鉤前輕咬次數範圍、
  // gap＝輕咬間隔倍數、biteWin＝咬鉤後能提竿的秒數、ring／spin＝在餌旁繞圈的半徑（m）與角速度、hover＝靠近前先停在 2 m 外觀察的秒數、
  // shy＝每次輕咬後退開再回來、puff＝釣起時鼓成圓球。habit 是魚卡與圖鑑上的習性說明，必須和這些參數一致。
  clown: { name: '小丑魚', body: 0.30, len: [24, 34], power: 0.45, speed: 0.55, bread: 1.0, nibble: [1, 2], gap: 0.8, biteWin: 1.0, ring: 0.45, spin: 1.3, hover: 0, habit: '最貪吃：一看到麵包就靠過來，輕啄一兩下就咬，提竿時間也最寬裕。', notes: ['在珊瑚邊探頭探腦的小傢伙。', '橘白條紋，一眼就認得。', '個子小，一下子就咬上來了。'] },
  tang: { name: '藍倒吊', body: 0.40, len: [34, 46], power: 0.6, speed: 0.7, bread: 0.8, nibble: [2, 3], gap: 1.35, biteWin: 0.9, ring: 0.9, spin: 0.7, hover: 0, habit: '繞著麵包兜大圈，要繞上好一陣子、啄個兩三下才肯咬。', notes: ['藍得像午後的淺灘。', '尾巴那抹黃很漂亮。', '兜了好幾圈才肯下口。'] },
  snapper: { name: '紅笛鯛', body: 0.55, len: [45, 62], power: 0.85, speed: 0.85, bread: 0.55, nibble: [1, 1], gap: 1.0, biteWin: 1.15, ring: 0.6, spin: 0.9, hover: 2.4, habit: '很謹慎：先停在兩公尺外觀察，一旦靠近只試一口就狠狠咬住；拉力很強。', notes: ['拉起來很有勁！', '觀察了半天，一口就咬住。', '今晚可以加菜了。'] },
  puffer: { name: '河豚', body: 0.36, len: [28, 40], power: 0.5, speed: 0.4, bread: 0.9, nibble: [3, 5], gap: 0.9, biteWin: 0.6, ring: 0.5, spin: 0.9, hover: 0, shy: true, puff: true, habit: '很會躲：偷咬好幾口就退開，真的咬鉤時只給你一眨眼的時間提竿。', notes: ['一臉無辜地鼓起來了。', '圓滾滾的，放生比較好。', '慢吞吞但很會躲。'] },
  parrot: { name: '鸚哥魚', body: 0.62, len: [52, 72], power: 1.0, speed: 0.75, bread: 0.5, reef: true, nibble: [2, 3], gap: 1.1, biteWin: 0.8, ring: 0.7, spin: 0.8, hover: 1.2, habit: '愛在珊瑚礁邊覓食：餌甩在礁旁才容易引來牠；力氣最大。', notes: ['嘴巴像鳥喙，總在礁邊打轉。', '薄荷綠配粉紅，好時髦。', '這條可是大傢伙！'] },
};
// 尺寸標準（水裡、手上、魚卡、結算卡同一套）：
//   body＝模型長（m）；每條魚有個體大小 size∈[0,1]，顯示縮放 = (SIZE0 + SIZE1·size) × VIS，
//   卡片長度 = len[0] + (len[1] − len[0]) × size —— 畫面上越大的魚，卡片寫得越長。
//   俯視距離約 17 m，照實際長度太小看不清，所以顯示比卡片長度放大：小魚約 1.5～1.8 倍，大魚約 1.1～1.3 倍。
const VIS = { clown: 1.25, tang: 1.05, puffer: 1.1, snapper: 0.95, parrot: 0.9 };
const SIZE0 = 1.15, SIZE1 = 0.25;
export const lenOf = (f) => { const L = FISH_INFO[f.id].len; return Math.round(L[0] + (L[1] - L[0]) * (f.size ?? 0.5)); };
// 測試與結算用：某魚種第 k 個樣本的長度（落在同一範圍）
export const sampleLen = (id, k) => { const L = FISH_INFO[id].len; return Math.round(L[0] + (L[1] - L[0]) * ((k * 0.37 + 0.2) % 1)); };
const WEIGHT = { clown: 5, tang: 4, snapper: 3, puffer: 3, parrot: 2 };
const up = new THREE.Vector3(0, 1, 0);

const FB = {};
function makeAnim(obj, clips, id) {
  const mixer = new THREE.AnimationMixer(obj);
  const fb = FB[id] || (FB[id] = fishPH(id).clips);
  const sw = findClip(clips, id + '_swim') || findClip(fb, id + '_swim');
  const fl = findClip(clips, id + '_flop') || findClip(fb, id + '_flop');
  const swim = sw ? mixer.clipAction(sw) : null;
  const flop = fl ? mixer.clipAction(fl) : null;
  if (swim) swim.play();
  return { mixer, swim, flop };
}

export class Fishes {
  constructor(scene, { mobile, piles }) {
    this.scene = scene; this.piles = piles;
    this.r = rng(77);
    this.list = [];
    this.schools = [];
    const n = mobile ? 15 : 19;
    const pool = [];
    for (const k of CATCHABLE) for (let i = 0; i < WEIGHT[k]; i++) pool.push(k);
    for (let i = 0; i < n; i++) this.list.push(this.spawn(i < CATCHABLE.length ? CATCHABLE[i] : pool[Math.floor(this.r() * pool.length)]));
    const ns = mobile ? 2 : 3, per = mobile ? 10 : 13;
    const centers = [[-9, -21], [10, -20], [-16, -8]];
    for (let s = 0; s < ns; s++) {
      const sc = { c: new THREE.Vector3(centers[s][0], -1.2, centers[s][1]), goal: new THREE.Vector3(), fish: [], t: 0 };
      this.pickSchoolGoal(sc);
      for (let i = 0; i < per; i++) {
        const { obj, clips } = getFish('sardine');
        shadowify(obj, false, false);   // 本體不投影；影子由下面的 InstancedMesh 代理一次畫完
        obj.scale.setScalar(1.5 + this.r() * 0.3);
        obj.rotation.order = 'YXZ';
        scene.add(obj);
        cullable(obj, 1.5);
        const a = makeAnim(obj, clips, 'sardine');
        const f = { id: 'sardine', obj, ...a, pos: sc.c.clone().add(new THREE.Vector3((this.r() - 0.5) * 2, (this.r() - 0.5) * 0.5, (this.r() - 0.5) * 2)), vel: new THREE.Vector3(this.r() - 0.5, 0, this.r() - 0.5).multiplyScalar(0.6) };
        if (a.swim) { a.swim.time = this.r() * 0.8; }
        sc.fish.push(f);
      }
      this.schools.push(sc);
    }
    this.buildSchoolShadow(scene);
  }
  // 沙丁魚群的影子：所有沙丁魚共用一個 InstancedMesh（bind pose 的沙丁魚網格），材質不寫顏色也不寫深度，
  // 主畫面看不到；只用來投影，陰影 pass 與主畫面各一個 draw call（不是每條魚各一個）。每幀把各條沙丁魚的矩陣抄過去。
  // （three 的陰影 pass 用主鏡頭的 layers 判斷可見，所以不能靠圖層把它藏起來。）
  buildSchoolShadow(scene) {
    const all = this.schools.flatMap((sc) => sc.fish);
    if (!all.length) return;
    const src = getFish('sardine').obj;
    src.updateMatrixWorld(true);
    let geo = null;
    src.traverse((o) => {
      if (geo || !o.isMesh) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', o.geometry.attributes.position.clone());
      if (o.geometry.index) g.setIndex(o.geometry.index.clone());
      g.applyMatrix4(o.matrixWorld);
      geo = g;
    });
    if (!geo) return;
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const im = new THREE.InstancedMesh(geo, mat, all.length);
    im.name = 'sardine_shadow';
    im.castShadow = true; im.receiveShadow = false; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(im);
    this.schoolShadow = { im, all };
  }
  spawn(id, far = false) {
    const { obj, clips } = getFish(id);
    shadowify(obj, true, false);
    obj.rotation.order = 'YXZ';
    this.scene.add(obj);
    cullable(obj, 1.7);
    const a = makeAnim(obj, clips, id);
    const info = FISH_INFO[id];
    const f = {
      id, obj, ...a, info, state: 'roam',
      pos: new THREE.Vector3(), yaw: this.r() * 6.28, pitch: 0, speed: info.speed * 0.6, target: new THREE.Vector3(),
      size: 0, scale: 1, wobble: this.r() * 10, home: Math.floor(this.r() * REEFS.length), timer: 0,
    };
    this.resize(f);
    if (a.swim) a.swim.time = this.r() * 0.8;
    this.placeRandom(f, far);
    this.pickTarget(f);
    return f;
  }
  // 個體大小（重生時重抽，換一條魚）
  resize(f) {
    f.size = this.r();
    f.scale = (SIZE0 + SIZE1 * f.size) * (VIS[f.id] || 1);
    f.obj.scale.setScalar(f.scale);
  }
  placeRandom(f, far) {
    for (let k = 0; k < 40; k++) {
      const rf = REEFS[Math.floor(this.r() * REEFS.length)];
      const a = this.r() * 6.28, d = rf.r * (0.6 + this.r() * 1.4);
      const x = rf.x + Math.cos(a) * d, z = rf.z + Math.sin(a) * d;
      if (far && z > -14) continue;
      if (!this.okSpot(x, z)) continue;
      f.pos.set(x, this.depthFor(x, z, 0.5), z); f.home = REEFS.indexOf(rf); return;
    }
    f.pos.set(-6, -1.2, -15);
  }
  okSpot(x, z) {
    if (floorY(x, z) >= -0.9 || pierFoot(x, z, 0.2)) return false;
    for (const o of obstNear(x, z)) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.35) return false;
    return true;
  }
  depthFor(x, z, u) {
    const fy = floorY(x, z);
    const lo = fy + 0.3, hi = -0.28;
    return hi < lo ? (lo + hi) / 2 : lo + (hi - lo) * u;
  }
  pickTarget(f) {
    const r = this.r;
    for (let k = 0; k < 30; k++) {
      if (r() < 0.25) f.home = Math.floor(r() * REEFS.length);
      const rf = REEFS[f.home];
      const a = r() * 6.28, d = rf.r * (0.4 + r() * 1.3);
      const x = rf.x + Math.cos(a) * d, z = rf.z + Math.sin(a) * d;
      if (!this.okSpot(x, z)) continue;
      f.target.set(x, this.depthFor(x, z, 0.25 + r() * 0.7), z);
      return;
    }
    f.target.set(-4, -1.3, -14);
  }
  pickSchoolGoal(sc) {
    for (let k = 0; k < 30; k++) {
      const x = (this.r() - 0.5) * 44, z = -26 + this.r() * 22;
      if (floorY(x, z) < -2 && !pierFoot(x, z, 3)) { sc.goal.set(x, -1.0 - this.r() * 0.6, z); return; }
    }
    sc.goal.set(-8, -1.2, -22);
  }
  // 平滑朝向 desired 方向前進；回傳實際速度
  steer(f, dir, speed, dt, turn = 2.2) {
    const tyaw = Math.atan2(dir.x, dir.z);
    let d = tyaw - f.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    f.yaw += THREE.MathUtils.clamp(d, -turn * dt, turn * dt);
    const h = Math.hypot(dir.x, dir.z);
    const tp = -Math.atan2(dir.y, Math.max(h, 1e-3)) * 0.8;
    f.pitch += (THREE.MathUtils.clamp(tp, -0.5, 0.5) - f.pitch) * Math.min(1, dt * 3);
    f.speed += (speed * (1 - Math.min(0.6, Math.abs(d) * 0.4)) - f.speed) * Math.min(1, dt * 2);
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    const nx = f.pos.x + fx * f.speed * dt, nz = f.pos.z + fz * f.speed * dt;
    f.pos.x = nx; f.pos.z = nz;
    f.pos.y += (dir.y * f.speed) * dt;
    this.clampY(f);
  }
  clampY(f) {
    const lo = floorUnder(f.pos.x, f.pos.z, (f.info.body * f.scale) / 2), hi = -0.25;
    f.pos.y = hi < lo ? Math.max((lo + hi) / 2, lo - 0.06) : THREE.MathUtils.clamp(f.pos.y, lo, hi);
  }
  avoid(f, dir) {
    for (const [px, pz] of this.piles) {
      const dx = f.pos.x - px, dz = f.pos.z - pz, d = Math.hypot(dx, dz);
      if (d < 1.0) { const k = (1.0 - d) * 2.2 / Math.max(d, 0.05); dir.x += dx * k; dir.z += dz * k; }
    }
    // 礁石與珊瑚：比魚身高的就從旁邊繞（水平排斥，半徑加上魚身半長）；看前方 1 m 的點，提早轉向
    const hl = (f.info.body * f.scale) / 2;
    const ax = f.pos.x + Math.sin(f.yaw) * 0.6, az = f.pos.z + Math.cos(f.yaw) * 0.6;
    for (const o of obstNear(f.pos.x, f.pos.z)) {
      if (f.pos.y > o.top + 0.3) continue;
      const R = o.r + hl + 0.35;
      for (const [px, pz, w] of [[f.pos.x, f.pos.z, 1], [ax, az, 0.6]]) {
        const dx = px - o.x, dz = pz - o.z, d = Math.hypot(dx, dz);
        if (d >= R) continue;
        const k = ((R - d) / R) * 3.2 * w / Math.max(d, 0.05);
        dir.x += dx * k; dir.z += dz * k;
      }
    }
    // 前方太淺就往深處轉
    const lx = f.pos.x + Math.sin(f.yaw) * 1.4, lz = f.pos.z + Math.cos(f.yaw) * 1.4;
    if (floorY(lx, lz) > -0.8) { const ax = f.pos.x, az = f.pos.z - 20; const gx = -ax * 0.02, gz = (az - f.pos.z) * 0.05 - 0.6; dir.x += gx; dir.z += gz; }
    return dir;
  }
  update(dt, t) {
    const dir = new THREE.Vector3();
    for (const f of this.list) {
      if (f.state === 'gone') { f.timer -= dt; if (f.timer <= 0) this.respawn(f); continue; }
      if (f.state === 'roam' || f.state === 'flee') {
        dir.subVectors(f.target, f.pos);
        const d = dir.length();
        if (d < 0.7) { this.pickTarget(f); if (f.state === 'flee') f.state = 'roam'; }
        dir.normalize();
        this.avoid(f, dir); dir.normalize();
        const sp = f.state === 'flee' ? f.info.speed * 2.6 : f.info.speed * (0.55 + 0.35 * Math.sin(t * 0.6 + f.wobble));
        this.steer(f, dir, sp, dt, f.state === 'flee' ? 4 : 1.8);
      } else if (f.state === 'interest') {
        // 被麵包吸引：游到餌旁邊繞圈（目標由 fishing.js 設定）
        dir.subVectors(f.target, f.pos);
        const d = dir.length(); dir.normalize(); this.avoid(f, dir); dir.normalize();
        this.steer(f, dir, Math.min(f.info.speed * 1.1, 0.25 + d * 0.8), dt, 3);
      }
      // hooked / caught / held：位置由 fishing.js 控制
      this.apply(f, dt);
    }
    // 沙丁魚群
    const sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3(), tmp = new THREE.Vector3();
    for (const sc of this.schools) {
      sc.t -= dt;
      tmp.subVectors(sc.goal, sc.c);
      if (tmp.length() < 2 || sc.t < -18) { this.pickSchoolGoal(sc); sc.t = 0; }
      sc.c.addScaledVector(tmp.normalize(), dt * 0.9);
      for (const f of sc.fish) {
        sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0); let n = 0;
        for (const o of sc.fish) {
          if (o === f) continue;
          tmp.subVectors(f.pos, o.pos); const d = tmp.length();
          if (d < 1.4) { n++; ali.add(o.vel); coh.add(o.pos); if (d < 0.32) sep.addScaledVector(tmp, (0.32 - d) / Math.max(d, 0.02) * 4); }
        }
        const acc = tmp.set(0, 0, 0);
        if (n) { ali.divideScalar(n).sub(f.vel).multiplyScalar(1.2); coh.divideScalar(n).sub(f.pos).multiplyScalar(0.8); acc.add(ali).add(coh); }
        acc.add(sep);
        const toC = new THREE.Vector3().subVectors(sc.c, f.pos); acc.addScaledVector(toC, 0.9);
        f.vel.addScaledVector(acc, dt);
        const s = f.vel.length(), max = 1.35, min = 0.55;
        if (s > max) f.vel.multiplyScalar(max / s); else if (s < min) f.vel.multiplyScalar(min / Math.max(s, 1e-3));
        f.vel.y *= 0.9;
        f.pos.addScaledVector(f.vel, dt);
        const lo = floorUnder(f.pos.x, f.pos.z, 0.13, 0.25);
        f.pos.y = lo > -0.35 ? lo : THREE.MathUtils.clamp(f.pos.y, lo, -0.35);
        f.obj.position.copy(f.pos);
        const ty = Math.atan2(f.vel.x, f.vel.z);
        let dy = ty - f.obj.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        f.obj.rotation.y += dy * Math.min(1, dt * 6);
        if (f.swim) f.swim.timeScale = 0.8 + f.vel.length() * 1.2;
        f.mixer.update(dt);
      }
    }
    if (this.schoolShadow) {
      const { im, all } = this.schoolShadow;
      all.forEach((f, i) => { f.obj.updateMatrix(); im.setMatrixAt(i, f.obj.matrix); });
      im.instanceMatrix.needsUpdate = true;
    }
  }
  apply(f, dt) {
    f.obj.position.copy(f.pos);
    if (f.state !== 'held') f.obj.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
    if (f.swim && f.state !== 'hooked' && f.state !== 'held') f.swim.timeScale = 0.6 + f.speed / Math.max(0.2, f.info.speed) * 0.9;
    f.mixer.update(dt);
  }
  setFlop(f, on) {
    if (!f.flop || !f.swim) return;
    if (on) { f.flop.reset().play(); f.swim.stop(); } else { f.flop.stop(); f.swim.reset().play(); }
  }
  nearest(p, maxD = Infinity, filter = () => true) {
    let best = null, bd = maxD;
    for (const f of this.list) {
      if (f.state !== 'roam' || !filter(f)) continue;
      const d = Math.hypot(f.pos.x - p.x, f.pos.z - p.z);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  flee(f, from) {
    f.state = 'flee';
    const dx = f.pos.x - from.x, dz = f.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    let x = f.pos.x + (dx / d) * 7, z = f.pos.z + (dz / d) * 7 - 2;
    if (!this.okSpot(x, z)) { x = f.pos.x + (this.r() - 0.5) * 6; z = f.pos.z - 8; }
    f.target.set(x, this.depthFor(x, z, 0.3), z);
  }
  remove(f) {
    f.state = 'gone'; f.timer = 6 + this.r() * 6; f.obj.visible = false;
  }
  respawn(f) {
    f.obj.visible = true; f.state = 'roam';
    this.setFlop(f, false);
    this.placeRandom(f, true); this.pickTarget(f);
    this.resize(f);
  }
}
export { SPECIES };
