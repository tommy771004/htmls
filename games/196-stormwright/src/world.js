// 世界物件總管：城鎮（可破壞板塊房屋）、自然物件、道具、戰利品與寶箱點位。
// 公開：lootSpots、chestSpots、pois、houses、treeRefs、update(dt)、reset()；新增：debris、panels、blocked()。
import * as THREE from 'three';
import { mulberry32 } from './shared.js';
import { BoxBatch, vcMat } from './geo.js';
import { POI_SITES, FLAT_Y } from './terrain.js';
import { Panels, Debris } from './world-panels.js';
import { Props } from './world-props.js';
import { buildTowns, inTest } from './world-town.js';
import { Nature, scatterNature, scatterRocks, scatterMushrooms } from './world-nature.js';

export class World {
  constructor(ctx) {
    this.ctx = ctx;
    this.rng = mulberry32(1960);
    this.lootSpots = []; this.chestSpots = []; this.houses = []; this.blockers = []; this.spinners = []; this.clusters = {}; this.stat = {}; this.landmarks = {};
    this.pois = POI_SITES.map((p) => ({ name: p.name, en: p.en, x: p.x, z: p.z, r: p.r }));
    this.group = new THREE.Group(); ctx.scene.add(this.group);
    this.vcMat = vcMat(0.85);
    this.debris = new Debris(ctx);
    this.props = new Props(this);
    this.addBlocker(18, 28, 24); // accept 測試區（落地與建造）保持淨空
    this.natureItems = [];
    buildTowns(this);
    this.nature = new Nature(this);
    this.natureItems.push(...scatterNature(this));
    scatterMushrooms(this, this.natureItems);
    scatterRocks(this, this.natureItems);
    this.nature.build(this.natureItems);
    this.treeRefs = this.nature.refs.filter((r) => r.kind === 'tree');
    this.rockRefs = this.nature.refs.filter((r) => r.kind === 'rock');
    for (const k in this.clusters) this.finishCluster(this.clusters[k]);
    this.scatterLoot();
    ctx.terrain.uploadMask();
  }
  // ---- 叢集：板塊 + 靜態裝飾 + 發光裝飾 ----
  cluster(name) {
    return (this.clusters[name] ||= { name, panels: new Panels(this, name), deco: new BoxBatch(), glow: new BoxBatch(), parent: this.group });
  }
  finishCluster(cl) {
    cl.panels.build(this.group);
    if (cl.deco.n) { const m = new THREE.Mesh(cl.deco.geometry(), this.vcMat); m.castShadow = m.receiveShadow = true; this.group.add(m); }
    if (cl.glow.n) { const m = new THREE.Mesh(cl.glow.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true })); this.group.add(m); }
    cl.deco = null; cl.glow = null;
  }
  // ---- 佔位 ----
  addBlocker(x, z, r) { this.blockers.push([x, z, r]); }
  blocked(x, z, m = 0) { for (const b of this.blockers) { const dx = x - b[0], dz = z - b[1], rr = b[2] + m; if (dx * dx + dz * dz < rr * rr) return true; } return false; }
  poiAt(x, z) { let b = null, bd = 1e9; for (const p of this.pois) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; b = p.name; } } return b; }
  nearPoi(x, z, k = 1) { return POI_SITES.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * k); }
  housesNear(x, z, r) { for (const h of this.houses) if (Math.hypot(h.x - x, h.z - z) < h.radius + r) return true; return false; }
  // ---- 戶外戰利品 ----
  scatterLoot() {
    const rng = this.rng, T = this.ctx.terrain;
    for (const p of this.pois) for (let i = 0, n = 0; i < 80 && n < 6; i++) {
      const a = rng() * 6.28, d = rng.range(6, p.r * 0.75), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d, h = T.heightAt(x, z);
      if (h < 1.5 || this.blocked(x, z, 0.8) || inTest(x, z, 0)) continue;
      this.lootSpots.push({ x, y: h + 0.05, z, inside: false, poi: p.name }); n++;
    }
    for (let i = 0, n = 0; i < 400 && n < 14; i++) {
      const x = rng.range(-330, 330), z = rng.range(-330, 330), h = T.heightAt(x, z);
      if (h < 2.2 || this.blocked(x, z, 0.8)) continue;
      this.lootSpots.push({ x, y: h + 0.05, z, inside: false, poi: null }); n++;
    }
    let guard = 0;
    while (this.chestSpots.length < 45 && guard++ < 600) {
      const x = rng.range(-320, 320), z = rng.range(-320, 320), h = T.heightAt(x, z);
      if (h > 2.5 && !this.blocked(x, z, 1.5)) this.chestSpots.push({ x, y: h, z, yaw: rng() * 6.28, poi: this.poiAt(x, z) });
    }
  }
  update(dt) {
    for (const k in this.clusters) this.clusters[k].panels.update(dt);
    this.nature.update(dt); this.debris.update(dt);
    for (const s of this.spinners) s.obj.rotation.z += s.speed * dt;
  }
  reset() {
    for (const k in this.clusters) this.clusters[k].panels.reset();
    this.nature.reset(); this.debris.clear();
  }
}
