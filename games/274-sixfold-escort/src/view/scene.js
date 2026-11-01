// 六器鏢行 — 3D 場景調度：骨架主角與 NPC、怪物、偃甲、三張地圖、鏢局大堂開場、刃風粒子、朱砂引路線、名牌錨點與螢幕投影
//
// 對外介面（hud.js／main.js 使用）：updateVisuals、render、resize、projectToScreen、pickGroundOrEntity、orbitBy、zoomBy、
// getCameraAngles、info，以及第二輪契約 setIntro(on)、setHeroLook(look)、anchors()。

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  createEscortRenderer, makeGroundMaterial, groundHeight, makeSkyMaterial, makeEnvironment,
  makeGuideTrailMaterial, makeSlashArcMaterial, makeWeaponAuraMaterial,
} from './shaders.js';
import { buildMapScenery, buildCreature, buildMechRig, updateMechAppearance, buildIntroHall, HALL_ORIGIN, MAP_LOOK } from './models.js';
import { loadActors, createActor } from './chars.js';
import { uRim, uRimK, uSeeCam, uSeeFocus, uSeeOn } from './kit.js';
import { MAPS, SKILLS } from '../core/data.js';
import { getWeaponAuraTier } from '../core/combat.js';

const HUMAN_KINDS = new Set(['reedthief', 'chieftain', 'blade_pk', 'dart_pk']);
const ANIM_FOR = { BLADE: 'slash', SWORD: 'slash', SPEAR: 'slash', FIST: 'punch', BOW: 'cast', THROWN: 'cast' };

// world.char.gender 是 'MALE'／'FEMALE'，chars.js 用 'Male'／'Female'
function normGender(g) {
  const s = String(g || '').toLowerCase();
  return s.startsWith('f') ? 'Female' : 'Male';
}

// 站立高度：模擬層沒有高度，地面網格在可走範圍內是平的（0）；唯一墊高的是青萍渡沿岸木棧道（板面 0.12 m，
// z −22.8～−25.9，可走範圍到 −25.5），站上去要抬腳，不然腳會陷進木板
function standY(mapId, x, z) {
  if (mapId === 1001 && z < -22.75 && Math.abs(x) <= 26) return 0.12;
  return 0;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// 彎月弧帶幾何：uv.x 沿弧 0..1、uv.y 跨寬 0..1
function arcGeometry(r0, r1, theta, seg = 28) {
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = -theta / 2 + t * theta;
    // 弧中間最寬、兩端收尖
    const w = Math.sin(t * Math.PI) * 0.85 + 0.15;
    const ri = r1 - (r1 - r0) * w;
    for (const [r, v] of [[ri, 0], [r1, 1]]) {
      pos.push(Math.sin(a) * r, 0, Math.cos(a) * r);
      uvs.push(t, v);
    }
    if (i < seg) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export async function createEscortScene(canvas, world, { forceWebGL = false } = {}) {
  const { renderer, backendName } = await createEscortRenderer(canvas, forceWebGL);
  await loadActors();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x23394d);
  scene.fog = new THREE.Fog(0x7a8c89, 30, 120);

  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.2, 260);
  let camYaw = 0;
  let camDist = 14;
  let camPitch = 0.46;
  let camDistEff = camDist;
  let camPitchEff = camPitch; // 實際俯角：被牆擋住時會暫時往上爬
  let shakeTimer = 0;
  let viewW = 1440, viewH = 900;
  let camFocus = null; // 截圖／除錯用：鏡頭改看這個點
  const THUMB = { x: 0.6, z: 11.8, rotY: 3.3, yaw: 3.4, pitch: 0.2, dist: 8.0 };
  let showcase = false; // 縮圖構圖（tools/thumb.mjs）：不畫鎖定圈、亮刃圈、衝擊圈，碎片減半
  let camLead = 2.0; // 鏡頭焦點在主角前方幾公尺（resize 依直式／橫式調整）

  // ── 天穹與光 ──
  const skyMat = makeSkyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x574c3f, 1.0);
  scene.add(hemiLight);
  const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const SH = 26;
  Object.assign(sunLight.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 120 });
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.03;
  scene.add(sunLight, sunLight.target);
  const sunDir = new THREE.Vector3(0.5, 0.75, 0.4).normalize();

  // 主角身邊一盞暖色補光（夜裡的燈籠光感，也讓臉不至於全黑）
  const heroGlow = new THREE.PointLight(0xffc27a, 0, 9, 1.6);
  scene.add(heroGlow);

  // ── 地面：視覺網格（地圖外圍有起伏）＋ 平的拾取平面 ──
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new MeshBasicNodeMaterial());
  pickPlane.visible = false;
  scene.add(pickPlane);
  let ground = null;
  const groundMats = {};
  const envCache = {};

  function buildGround(mapId) {
    if (ground) { scene.remove(ground); ground.geometry.dispose(); }
    const size = 180, seg = 150;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(mapId, p.getX(i), p.getZ(i)));
    geo.computeVertexNormals();
    if (!groundMats[mapId]) groundMats[mapId] = makeGroundMaterial(mapId);
    ground = new THREE.Mesh(geo, groundMats[mapId]);
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // ── 主角 ──
  const ch0 = world.char;
  let heroLook = { preset: 'escort', gender: normGender(ch0.gender), hair: ch0.hairStyle | 0, palette: 'indigo', height: 1, build: 1, ...(ch0.look || {}) };
  heroLook.gender = normGender(heroLook.gender);
  const hero = createActor(heroLook);
  hero.play('idle', { fade: 0 });
  scene.add(hero.root);
  let introWeapon = null;
  const heroState = { px: ch0.x, pz: ch0.z, speed: 0, rot: ch0.rotY + Math.PI, drawn: null, hitHold: 0 };

  // 兵器流光殼（鍛器 +7 以上）：套在手上兵器外面，略放大
  const auraMat = makeWeaponAuraMaterial();
  const auraShells = new Map();
  function syncAura(type, tier) {
    for (const [t, m] of auraShells) m.visible = t === type && tier > 0;
    if (!type || tier <= 0) return;
    let shell = auraShells.get(type);
    const held = hero.held.get(type);
    if (!shell && held) {
      shell = new THREE.Group();
      held.traverse((o) => {
        if (o.isMesh && o.geometry) {
          const m = new THREE.Mesh(o.geometry, auraMat);
          m.scale.setScalar(1.06);
          m.frustumCulled = false;
          shell.add(m);
        }
      });
      held.add(shell);
      auraShells.set(type, shell);
    }
    if (shell) shell.visible = true;
    auraMat.userData.uTier.value = tier;
  }

  // 亮刃：腳下一圈朱砂細環（不做發光大圈）
  const pkRing = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.7, 48).rotateX(-Math.PI / 2),
    new MeshBasicNodeMaterial({ color: 0xc23a22, transparent: true, opacity: 0.85, depthWrite: false }),
  );
  pkRing.visible = false;
  scene.add(pkRing);

  // ── 偃甲 ──
  const mech = buildMechRig();
  mech.visible = false;
  scene.add(mech);
  let mechSwing = 0;

  // ── 鎖定目標：黃銅刻度環 ──
  const targetRing = new THREE.Group();
  {
    const mat = new MeshBasicNodeMaterial({ color: 0xd9b25a, transparent: true, opacity: 0.9, depthWrite: false });
    targetRing.add(new THREE.Mesh(new THREE.RingGeometry(0.98, 1.04, 64).rotateX(-Math.PI / 2), mat));
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.3).rotateX(-Math.PI / 2), mat);
      const a = (i / 4) * Math.PI * 2;
      tick.position.set(Math.sin(a) * 1.12, 0, Math.cos(a) * 1.12);
      tick.rotation.y = a;
      targetRing.add(tick);
    }
  }
  targetRing.visible = false;
  scene.add(targetRing);

  // ── 朱砂引路線（Instanced 地面虛線） ──
  const TRAIL_SEGMENTS = 28;
  const trailInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.9).rotateX(-Math.PI / 2), makeGuideTrailMaterial(), TRAIL_SEGMENTS);
  trailInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trailInst.visible = false;
  trailInst.frustumCulled = false;
  scene.add(trailInst);

  // ── 刃風粒子池（Instanced 細長火星） ──
  const MAX_PARTICLES = 480;
  const particleMesh = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.07, 0).scale(0.6, 0.6, 2.4),
    new MeshBasicNodeMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    MAX_PARTICLES,
  );
  particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particleMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
  particleMesh.frustumCulled = false;
  scene.add(particleMesh);
  const particles = Array.from({ length: MAX_PARTICLES }, () => ({ active: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, age: 0, ttl: 0.8, scale: 1, r: 1, g: 1, b: 1 }));
  let pCursor = 0;

  // 地面衝擊環（細）
  const shockRings = [];
  for (let i = 0; i < 8; i++) {
    const rm = new MeshBasicNodeMaterial({ color: 0xffd166, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48).rotateX(-Math.PI / 2), rm);
    mesh.visible = false;
    scene.add(mesh);
    shockRings.push({ mesh, mat: rm, active: false, age: 0, ttl: 0.55, maxR: 3.5 });
  }

  // 刃風弧光（出招時一道彎月）
  const slashArcs = [];
  for (let i = 0; i < 4; i++) {
    const mat = makeSlashArcMaterial();
    const mesh = new THREE.Mesh(arcGeometry(1.0, 1.9, 2.6), mat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    slashArcs.push({ mesh, mat, age: 0, ttl: 0.32, active: false });
  }

  // ── 地圖與實體 ──
  let currentMapId = null;
  let mapData = null;
  let lastPlayerStallFlag = false;
  const entityViews = new Map();
  const npcViews = [];
  const colliders = [];

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.isMesh && !o.isSkinnedMesh && o.geometry && !o.userData.sharedGeo) o.geometry.dispose();
    });
  }

  function clearMap() {
    if (mapData) {
      scene.remove(mapData.group);
      disposeTree(mapData.group);
    }
    for (const v of entityViews.values()) {
      if (v.actor) v.actor.dispose();
      else { scene.remove(v.root); disposeTree(v.root); }
      scene.remove(v.proxy);
    }
    entityViews.clear();
    for (const n of npcViews) n.actor.dispose();
    npcViews.length = 0;
    colliders.length = 0;
  }

  function makeProxy(h, r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8).translate(0, h / 2, 0), new MeshBasicNodeMaterial());
    m.visible = false;
    scene.add(m);
    return m;
  }

  function applyMapLook(mapId) {
    const L = MAP_LOOK[mapId] || MAP_LOOK[1001];
    const cfg = MAPS[mapId] || MAPS[1001];
    scene.background.set(L.horizon);
    scene.fog.color.set(L.fog);
    scene.fog.near = L.fogNear;
    scene.fog.far = L.fogFar;
    skyMat.userData.uTop.value.set(L.top);
    skyMat.userData.uHor.value.set(L.horizon);
    skyMat.userData.uGround.value.set(L.fog);
    sunDir.set(...L.sunDir).normalize();
    skyMat.userData.uSun.value.copy(sunDir);
    skyMat.userData.uSunCol.value.set(L.sunGlow);
    sunLight.color.set(L.sun);
    sunLight.intensity = L.sunI;
    hemiLight.color.set(L.hemiSky);
    hemiLight.groundColor.set(L.hemiGround);
    hemiLight.intensity = L.hemiI;
    heroGlow.intensity = L.heroGlow;
    renderer.toneMappingExposure = L.exposure;
    uRim.value.set(L.rim);
    uRimK.value = L.rimK;
    if (!(mapId in envCache)) {
      envCache[mapId] = makeEnvironment(renderer, { top: L.envTop ?? L.top, horizon: L.envHorizon ?? L.horizon, ground: L.envGround, sunDir, sunColor: L.sunGlow });
    }
    scene.environment = envCache[mapId];
    scene.environmentIntensity = L.envI;
    void cfg;
  }

  function rebuildMapIfNeeded() {
    const hasHeroStall = !!world.getPlayerStall();
    if (currentMapId === world.char.mapId && lastPlayerStallFlag === hasHeroStall) return;
    const mapChanged = currentMapId !== world.char.mapId;
    currentMapId = world.char.mapId;
    lastPlayerStallFlag = hasHeroStall;
    clearMap();
    applyMapLook(currentMapId);
    if (mapChanged || !ground) buildGround(currentMapId);

    mapData = buildMapScenery(currentMapId, { stalls: world.stalls, playerStall: world.getPlayerStall(), beacons: world.beacons, heroName: world.char.name });
    scene.add(mapData.group);
    for (const b of mapData.colliders || []) colliders.push(b);

    // NPC（攤主、鏢局的人）
    for (const n of mapData.npcs) {
      const actor = createActor(n.look);
      actor.root.position.set(n.x, n.y || 0, n.z);
      actor.root.rotation.y = n.rotY;
      actor.drawWeapon(n.weapon || null);
      actor.play(n.anim || 'idle', { fade: 0, at: (n.x * 7.31 + n.z * 3.7) % 2 });
      scene.add(actor.root);
      npcViews.push({ ...n, actor, anchor: new THREE.Vector3() });
    }

    // 怪物、頭目、劫鏢匪
    for (const ent of world.entities) {
      if (ent.mapId !== currentMapId) continue;
      const v = { ent, prevX: ent.x, prevZ: ent.z, prevAtkCd: ent.atkCd, speed: 0, attackT: 0, rot: ent.rotY, anchor: new THREE.Vector3() };
      if (HUMAN_KINDS.has(ent.subKind)) {
        const boss = ent.kind === 'BOSS';
        const look = ent.subKind === 'reedthief'
          ? { preset: 'vendor', gender: 'Male', hair: 1, palette: 'pine', height: 0.96 }
          : { preset: boss ? 'chieftain' : 'bandit', gender: 'Male', hair: boss ? 1 : 0, height: boss ? 1.1 : 1.0, build: boss ? 1.12 : 1.0 };
        v.actor = createActor(look);
        v.weapon = ent.subKind === 'dart_pk' ? 'THROWN' : 'BLADE';
        v.actor.drawWeapon(v.weapon);
        v.actor.play('ready', { fade: 0, at: Math.random() });
        v.root = v.actor.root;
        v.headY = boss ? 2.25 : 2.05;
        v.proxy = makeProxy(boss ? 2.2 : 1.9, 0.5);
      } else {
        const c = buildCreature(ent);
        v.creature = c;
        v.root = c.root;
        v.headY = c.headY;
        v.proxy = makeProxy(c.headY, c.radius || 0.8);
      }
      v.proxy.userData.entityId = ent.id;
      scene.add(v.root);
      entityViews.set(ent.id, v);
    }
  }

  // ── 特效 ──
  function spawnParticleBurst({ x, y = 1.1, z, count = 36, colorHex = '#ffd166', radius = 2.8, isTrue = false }) {
    const c = new THREE.Color(colorHex);
    if (showcase) count = Math.round(count / 2);
    const dark = new THREE.Color(0x3a2a20);
    for (let i = 0; i < count; i++) {
      const p = particles[pCursor];
      pCursor = (pCursor + 1) % MAX_PARTICLES;
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const spd = (2.2 + Math.random() * 4.5) * (radius / 2.6);
      p.active = true;
      p.x = x + Math.cos(ang) * 0.35;
      p.y = y + Math.random() * 0.7;
      p.z = z + Math.sin(ang) * 0.35;
      p.vx = Math.cos(ang) * spd;
      p.vy = 1.0 + Math.random() * 2.6;
      p.vz = Math.sin(ang) * spd;
      p.age = 0;
      p.ttl = isTrue ? 0.8 : 0.5;
      p.scale = isTrue ? 1.5 : 1.0;
      const chosen = isTrue && i % 4 === 0 ? dark : c; // 通玄：夾雜殘影
      p.r = chosen.r; p.g = chosen.g; p.b = chosen.b;
    }
    if (showcase) return; // 縮圖構圖：不畫地上的衝擊圈
    const ring = shockRings.find((r) => !r.active) || shockRings[0];
    ring.active = true;
    ring.age = 0;
    ring.ttl = isTrue ? 0.6 : 0.42;
    ring.maxR = Math.max(1.8, radius * (isTrue ? 1.3 : 1.0));
    ring.mat.color.set(colorHex);
    ring.mesh.position.set(x, 0.06, z);
    ring.mesh.scale.setScalar(0.3);
    ring.mesh.visible = true;
  }

  function spawnSlash(weaponType, colorHex, x, z, rotY, big = false) {
    const s = slashArcs.find((a) => !a.active) || slashArcs[0];
    s.active = true;
    s.age = 0;
    s.ttl = big ? 0.42 : 0.3;
    s.mat.userData.uCol.value.set(colorHex);
    const m = s.mesh;
    m.position.set(x, 1.15, z);
    m.rotation.set(0, rotY, 0);
    const sc = weaponType === 'SPEAR' ? 1.6 : (big ? 1.4 : 1.0);
    m.scale.setScalar(sc);
    // 縱劈的兵器（刀、拳）把弧立起來；劍斜劃；槍水平橫掃
    if (weaponType === 'BLADE') m.rotateZ(1.2);
    else if (weaponType === 'SWORD') m.rotateZ(0.5);
    else if (weaponType === 'FIST') { m.rotateZ(1.45); m.scale.setScalar(0.7); }
    m.visible = true;
  }

  function consumeVfxQueue(sfx) {
    const ch = world.char;
    while (world.vfxQueue.length > 0) {
      const ev = world.vfxQueue.shift();
      if (ev.kind === 'MARTIAL' || ev.kind === 'TRUE_MARTIAL' || ev.kind === 'MECH_SKILL') {
        const isMech = ev.kind === 'MECH_SKILL';
        const big = ev.isTrue || isMech;
        spawnParticleBurst({ x: ev.toX, y: isMech ? 1.8 : 1.1, z: ev.toZ, count: big ? 64 : 36, colorHex: ev.color || '#ffd166', radius: ev.radius || 2.6, isTrue: big });
        if (big) shakeTimer = 0.22;
        if (isMech) {
          mechSwing = 0.6;
        } else if (!introOn) {
          const sk = SKILLS[ev.skillId];
          const inner = sk && sk.category === 'INNER_FIVE';
          const wt = ev.weaponType || null;
          if (wt && !inner) {
            hero.drawWeapon(wt);
            heroState.drawn = wt;
          }
          const anim = inner ? 'cast' : (ANIM_FOR[wt] || 'cast');
          hero.play(anim, { fade: 0.06 });
          const yaw = ch.rotY;
          if (anim === 'slash' || anim === 'punch') spawnSlash(wt, ev.color || '#ffd166', ch.x, ch.z, yaw, ev.isTrue);
        }
        sfx?.playSkill(ev.weaponType, ev.isTrue, isMech);
      } else if (ev.kind === 'SHIELD_BREAK' || ev.kind === 'HERO_SHIELD_BREAK') {
        const heroHit = ev.kind === 'HERO_SHIELD_BREAK';
        spawnParticleBurst({ x: ev.toX, y: 1.2, z: ev.toZ, count: 48, colorHex: heroHit ? '#e04a2c' : '#d9b25a', radius: 3.0, isTrue: true });
        shakeTimer = heroHit ? 0.38 : 0.2;
        if (heroHit && !introOn && ch.mechPhase !== 'ACTIVE_MERGED') {
          hero.play('hit', { fade: 0.05 });
          heroState.hitHold = 0.5;
        }
        sfx?.playShieldBreak(heroHit);
      } else if (ev.kind === 'QINGGONG') {
        spawnParticleBurst({ x: ev.fromX, y: 0.4, z: ev.fromZ, count: 20, colorHex: '#d9cbb0', radius: 1.6 });
        if (!introOn && ch.mechPhase !== 'ACTIVE_MERGED') hero.play('roll', { fade: 0.05, speed: 1.35 });
        sfx?.playDash();
      } else if (ev.kind === 'MECH_AWAKEN') {
        spawnParticleBurst({ x: ev.toX, y: 1.6, z: ev.toZ, count: 72, colorHex: '#d9b25a', radius: 4.5, isTrue: true });
        shakeTimer = 0.32;
        sfx?.playMechAwaken();
      }
    }
  }

  // ── 開場大堂 ──
  const hall = buildIntroHall();
  hall.group.visible = false;
  scene.add(hall.group);
  let introOn = false;
  let introExplicit = false;

  function setIntro(on) {
    introExplicit = true;
    applyIntro(!!on);
  }

  function applyIntro(on) {
    if (on === introOn) return;
    introOn = on;
    hall.group.visible = on;
    if (on) {
      hero.root.position.copy(HALL_ORIGIN).add(hall.heroSpot);
      hero.root.rotation.y = hall.heroRotY;
      // 開場一律自然站姿；兵器用展示握法（飛針收在匣裡）
      hero.setIntroHold(true);
      hero.drawWeapon(introWeapon === 'THROWN' ? null : introWeapon);
      hero.play('idle', { fade: 0.2 });
      scene.environment = hall.env ?? scene.environment;
    } else {
      hero.setIntroHold(false);
      hero.drawWeapon(null);
      heroState.drawn = null;
      hero.play('idle', { fade: 0.2 });
      if (currentMapId != null) applyMapLook(currentMapId);
      heroState.px = world.char.x;
      heroState.pz = world.char.z;
    }
    if (mapData) mapData.group.visible = !on;
    if (ground) ground.visible = !on;
    sky.visible = !on;
    for (const v of entityViews.values()) v.root.visible = !on;
    for (const n of npcViews) n.actor.root.visible = !on;
    if (on) {
      scene.background.set(hall.look.background);
      scene.fog.color.set(hall.look.background);
      scene.fog.near = 12;
      scene.fog.far = 40;
      hemiLight.color.set(hall.look.hemiSky);
      hemiLight.groundColor.set(hall.look.hemiGround);
      hemiLight.intensity = hall.look.hemiI;
      sunLight.color.set(hall.look.sun);
      sunLight.intensity = hall.look.sunI;
      heroGlow.intensity = 0;
      renderer.toneMappingExposure = hall.look.exposure;
      uRim.value.set(hall.look.rim);
      uRimK.value = 0.12;
      if (!hall.env) hall.env = makeEnvironment(renderer, hall.look.env);
      scene.environment = hall.env;
      scene.environmentIntensity = 0.6;
    }
  }

  function setHeroLook(look = {}) {
    const L = { ...look };
    if ('gender' in L) L.gender = normGender(L.gender);
    if ('hair' in L) L.hair = Number(L.hair) | 0;
    for (const k of ['height', 'build']) if (k in L) L[k] = Math.max(0.9, Math.min(1.1, Number(L[k]) || 1));
    const weapon = 'weapon' in L ? (L.weapon || null) : introWeapon;
    delete L.weapon;
    if (!L.preset) L.preset = 'escort';
    heroLook = { ...heroLook, ...L };
    hero.setLook(heroLook);
    introWeapon = weapon;
    // auraShells 掛在舊兵器底下；換性別會重建骨架，重新來
    for (const [, s] of auraShells) s.parent && s.parent.remove(s);
    auraShells.clear();
    if (introOn) {
      hero.setIntroHold(true);
      hero.drawWeapon(weapon === 'THROWN' ? null : weapon);
      hero.play('idle', { fade: 0.2 });
    }
  }

  // ── 名牌錨點 ──
  const anchorList = [];
  const anchorPool = new Map();
  const tmpV = new THREE.Vector3();
  function anchorRec(id) {
    let r = anchorPool.get(id);
    if (!r) { r = { id, name: '', sub: '', kind: 'npc', pos: new THREE.Vector3() }; anchorPool.set(id, r); }
    return r;
  }
  function anchors() {
    anchorList.length = 0;
    if (introOn) return anchorList;
    const ch = world.char;
    const hr = anchorRec('hero');
    hr.name = ch.name;
    hr.sub = '';
    hr.kind = 'hero';
    if (ch.mechPhase === 'ACTIVE_MERGED') hr.pos.copy(mech.userData.headAnchor.getWorldPosition(tmpV));
    else hero.headAnchor.getWorldPosition(hr.pos);
    anchorList.push(hr);
    for (const n of npcViews) {
      const r = anchorRec(n.id);
      r.name = n.name;
      r.sub = n.sub || '';
      r.kind = n.kind;
      n.actor.headAnchor.getWorldPosition(r.pos);
      anchorList.push(r);
    }
    for (const v of entityViews.values()) {
      const e = v.ent;
      if (!v.root.visible) continue;
      const r = anchorRec(e.id);
      r.name = e.name;
      r.sub = e.kind === 'BANDIT' ? `凶名 ${e.karma || 0}` : `Lv.${e.lv}`;
      r.kind = e.kind === 'BOSS' ? 'boss' : e.kind === 'BANDIT' ? 'bandit' : 'mob';
      if (v.actor) v.actor.headAnchor.getWorldPosition(r.pos);
      else r.pos.set(v.root.position.x, v.headY + 0.35, v.root.position.z);
      anchorList.push(r);
    }
    if (mapData) {
      for (const b of mapData.beaconViews || []) {
        const r = anchorRec(b.id);
        r.name = b.name;
        r.sub = b.state || '';
        r.kind = 'beacon';
        r.pos.set(b.x, b.top + 0.6, b.z);
        anchorList.push(r);
      }
      (mapData.portals || []).forEach((p, i) => {
        const r = anchorRec(`portal-${currentMapId}-${i}`);
        r.name = p.label;
        r.sub = '';
        r.kind = 'portal';
        r.pos.set(p.x, p.top || 1.5, p.z); // 低一點，別蓋到牌坊匾額
        anchorList.push(r);
      });
    }
    return anchorList;
  }

  // ── 每幀更新 ──
  const dummyObj = new THREE.Object3D();
  const camTarget = new THREE.Vector3();
  const ray = new THREE.Ray();
  const hitP = new THREE.Vector3();

  function updateHero(dt, elapsed) {
    const ch = world.char;
    const merged = ch.mechPhase === 'ACTIVE_MERGED';
    const dx = ch.x - heroState.px, dz = ch.z - heroState.pz;
    const moved = Math.hypot(dx, dz);
    heroState.px = ch.x;
    heroState.pz = ch.z;
    const inst = moved / Math.max(dt, 1e-3);
    // 一次移很遠（瞬步、傳送、advance 大步）不算跑速
    if (inst < 14) heroState.speed += (inst - heroState.speed) * Math.min(1, dt * 10);
    else heroState.speed *= 0.5;

    hero.root.position.set(ch.x, standY(currentMapId, ch.x, ch.z), ch.z);
    const want = ch.rotY + Math.PI;
    heroState.rot += wrapAngle(want - heroState.rot) * Math.min(1, dt * 14);
    hero.root.rotation.y = heroState.rot;
    hero.root.visible = !merged;
    mech.visible = merged;

    if (heroState.hitHold > 0) heroState.hitHold -= dt;
    const drawn = heroState.drawn;
    let loop;
    if (heroState.speed > 3.4) loop = 'run';
    else if (heroState.speed > 0.35) loop = 'walk';
    else loop = drawn ? 'ready' : 'idle';
    if (hero.curOnce) {
      hero.loopName = loop;
    } else if (hero.curName !== loop) {
      hero.play(loop, { fade: 0.22 });
    }
    if (hero.cur && (loop === 'run' || loop === 'walk') && !hero.curOnce) {
      hero.cur.timeScale = loop === 'run' ? Math.max(0.8, Math.min(1.4, heroState.speed / 5.2)) : Math.max(0.7, heroState.speed / 1.6);
    }
    // 收招：戰鬥狀態結束、且不在出招動作中 → 收回匣中
    if (drawn && ch.inCombatSec <= 0 && !hero.curOnce) {
      hero.drawWeapon(null);
      heroState.drawn = null;
    }
    const tier = drawn ? getWeaponAuraTier(world.getActiveWeapon()?.upgrade || 0) : 0;
    syncAura(drawn, tier);
    hero.update(dt);

    pkRing.visible = !merged && !showcase && (!!ch.pkMode || ch.karma > 0);
    pkRing.position.set(ch.x, 0.03, ch.z);

    // 偃甲
    if (merged) {
      updateMechAppearance(mech, ch.mechTier);
      mech.position.set(ch.x, standY(currentMapId, ch.x, ch.z), ch.z);
      mech.rotation.y = heroState.rot - Math.PI;
      if (mechSwing > 0) mechSwing = Math.max(0, mechSwing - dt);
      mech.userData.animate(dt, elapsed, heroState.speed, mechSwing / 0.6);
    }
    heroGlow.position.set(ch.x, 2.6, ch.z + 0.6);
  }

  function updateEntities(dt, elapsed) {
    const ch = world.char;
    let locked = null;
    for (const v of entityViews.values()) {
      const e = v.ent;
      const alive = e.curHp > 0 && e.respawnRem <= 0;
      v.root.visible = alive;
      v.proxy.position.set(e.x, 0, e.z);
      v.proxy.scale.setScalar(alive ? 1 : 0.0001);
      if (!alive) continue;
      const moved = Math.hypot(e.x - v.prevX, e.z - v.prevZ);
      const inst = moved / Math.max(dt, 1e-3);
      if (inst < 14) v.speed += (inst - v.speed) * Math.min(1, dt * 8); else v.speed = 0;
      v.prevX = e.x; v.prevZ = e.z;
      const attacked = e.atkCd > v.prevAtkCd + 0.3;
      v.prevAtkCd = e.atkCd;
      if (attacked) v.attackT = 0.001;
      if (v.attackT > 0) { v.attackT += dt; if (v.attackT > 0.7) v.attackT = 0; }
      const stag = e.staggerSec > 0;
      v.root.position.set(e.x + (stag ? Math.sin(elapsed * 48) * 0.05 : 0), standY(currentMapId, e.x, e.z), e.z);
      if (v.actor) {
        const want = e.rotY + Math.PI;
        v.rot += wrapAngle(want - v.rot) * Math.min(1, dt * 8);
        v.root.rotation.y = v.rot;
        const loop = v.speed > 2.4 ? 'run' : v.speed > 0.3 ? 'walk' : 'ready';
        if (attacked) v.actor.play(v.weapon === 'THROWN' ? 'cast' : 'slash', { fade: 0.08 });
        else if (stag && v.actor.curName !== 'hit') v.actor.play('hit', { fade: 0.05 });
        if (v.actor.curOnce) v.actor.loopName = loop;
        else if (v.actor.curName !== loop) v.actor.play(loop, { fade: 0.25 });
        v.actor.update(dt);
      } else {
        v.rot += wrapAngle(e.rotY - v.rot) * Math.min(1, dt * 6);
        v.root.rotation.y = v.rot;
        v.creature.update(dt, elapsed, { speed: v.speed, attack: v.attackT > 0 ? v.attackT / 0.7 : 0, stagger: stag, hp: e.curHp / e.maxHp, shield: e.curShield / Math.max(1, e.maxShield) });
      }
      if (e.id === ch.lockedTargetId) locked = { x: e.x, z: e.z, r: v.creature?.radius || 0.8 };
    }
    if (locked && !showcase) {
      targetRing.visible = true;
      targetRing.position.set(locked.x, 0.05, locked.z);
      targetRing.scale.setScalar(Math.max(0.9, locked.r * 1.1));
      targetRing.rotation.y = elapsed * 0.8;
    } else targetRing.visible = false;

    // NPC：視距外隱藏（省 draw call）
    for (const n of npcViews) {
      const far = Math.hypot(n.x - ch.x, n.z - ch.z) > 46;
      n.actor.root.visible = !far;
      if (!far) n.actor.update(dt);
    }
  }

  function updateFx(dt, elapsed) {
    const ch = world.char;
    // 朱砂引路線
    const nav = world.getNavTarget();
    if (nav) {
      trailInst.visible = true;
      const dx = nav.x - ch.x, dz = nav.z - ch.z;
      const len = Math.hypot(dx, dz);
      const yaw = Math.atan2(dx, dz);
      const n = Math.min(TRAIL_SEGMENTS, Math.max(2, Math.floor(len / 1.1)));
      for (let i = 0; i < TRAIL_SEGMENTS; i++) {
        const t = (i + 0.5) / n;
        dummyObj.position.set(ch.x + dx * t, 0.04, ch.z + dz * t);
        dummyObj.rotation.set(0, yaw, 0);
        dummyObj.scale.setScalar(i < n ? 1 : 0.0001);
        dummyObj.updateMatrix();
        trailInst.setMatrixAt(i, dummyObj.matrix);
      }
      trailInst.instanceMatrix.needsUpdate = true;
    } else trailInst.visible = false;

    let anyP = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (!p.active) {
        if (p.y !== -999) {
          p.y = -999;
          dummyObj.position.set(0, -999, 0);
          dummyObj.scale.setScalar(0.0001);
          dummyObj.updateMatrix();
          particleMesh.setMatrixAt(i, dummyObj.matrix);
          anyP = true;
        }
        continue;
      }
      anyP = true;
      p.age += dt;
      if (p.age >= p.ttl) { p.active = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= 6.5 * dt;
      p.vx *= 1 - dt * 2.2; p.vz *= 1 - dt * 2.2;
      const life = 1 - p.age / p.ttl;
      dummyObj.position.set(p.x, Math.max(0.05, p.y), p.z);
      dummyObj.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      dummyObj.scale.setScalar(p.scale * life);
      dummyObj.updateMatrix();
      particleMesh.setMatrixAt(i, dummyObj.matrix);
      particleMesh.instanceColor.setXYZ(i, p.r * life * 1.4, p.g * life * 1.4, p.b * life * 1.4);
    }
    if (anyP) {
      particleMesh.instanceMatrix.needsUpdate = true;
      particleMesh.instanceColor.needsUpdate = true;
    }
    for (const r of shockRings) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.ttl) { r.active = false; r.mesh.visible = false; continue; }
      const k = r.age / r.ttl;
      r.mesh.scale.setScalar(0.4 + k * r.maxR);
      r.mat.opacity = (1 - k) * 0.75;
    }
    for (const s of slashArcs) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.ttl) { s.active = false; s.mesh.visible = false; continue; }
      const k = s.age / s.ttl;
      s.mat.userData.uHead.value = Math.min(1.05, k * 2.4);
      s.mat.userData.uFade.value = 1 - Math.max(0, (k - 0.45) / 0.55);
    }
    void elapsed;
  }

  function cameraBlocked(from, to) {
    // 鏡頭跟主角之間有建築：回傳最近的遮擋距離
    const d = to.clone().sub(from);
    const len = d.length();
    ray.set(from, d.normalize());
    let best = len;
    for (const b of colliders) {
      // 焦點在主角前方 camLead 公尺：主角貼著門樓、院牆站時焦點會落進那棟的盒子裡。射線從盒內出發會在原點就「撞到」，
      // 鏡頭被拉到 3.5 m、俯角爬到頂（只看得到屋瓦）；焦點所在的盒子不算遮擋，鏡頭在主角身後、本來就在盒子外
      if (b.containsPoint(from)) continue;
      if (ray.intersectBox(b, hitP)) {
        const t = hitP.distanceTo(from);
        if (t < best) best = t;
      }
    }
    return best;
  }

  function updateCamera(dt) {
    const ch = world.char;
    const merged = ch.mechPhase === 'ACTIVE_MERGED';
    let sx = 0, sy = 0;
    if (shakeTimer > 0) {
      shakeTimer = Math.max(0, shakeTimer - dt);
      sx = (Math.random() - 0.5) * 0.3;
      sy = (Math.random() - 0.5) * 0.24;
    }
    if (introOn) {
      const c = hall.camera(viewW / Math.max(1, viewH));
      camera.position.copy(c.pos);
      camera.lookAt(c.look);
      camera.fov = c.fov;
      camera.updateProjectionMatrix();
      uSeeOn.value = 0;
      return;
    }
    if (camera.fov !== baseFov) { camera.fov = baseFov; camera.updateProjectionMatrix(); }
    const want = camDist + (merged ? 4.2 : 0);
    if (camFocus) camTarget.set(camFocus.x, camFocus.y ?? 1.0, camFocus.z);
    else {
      // 焦點往主角前方（鏡頭看的方向）推一點：主角落在畫面下三分之一，前方留給街景
      camTarget.set(ch.x - Math.sin(camYaw) * camLead, merged ? 2.4 : 1.35, ch.z - Math.cos(camYaw) * camLead);
    }
    const dirAt = (p) => new THREE.Vector3(Math.sin(camYaw) * Math.cos(p), Math.sin(p), Math.cos(camYaw) * Math.cos(p));
    // 鏡頭被建築擋住、拉近到 3.5 m 也還在牆裡時：往上爬（加大俯角）直到越過屋頂；爬升立刻生效，放開時慢慢降回
    let pitchWant = camPitch;
    let block = colliders.length ? cameraBlocked(camTarget, camTarget.clone().addScaledVector(dirAt(camPitch), want)) : want;
    if (block - 0.6 < 4.2) {
      // 找第一個看得夠遠的俯角；都不夠就取看得最遠的那個
      for (let p = camPitch + 0.08; p <= 1.42; p += 0.08) {
        const b = cameraBlocked(camTarget, camTarget.clone().addScaledVector(dirAt(p), want));
        if (b > block + 0.01) { pitchWant = p; block = b; }
        if (b - 0.6 >= Math.min(want, 7)) break;
      }
      // 擋鏡頭的盒子只包到牆身，屋簷還會再伸出一點：多爬一格才看得到屋簷下的主角
      if (pitchWant > camPitch) pitchWant = Math.min(1.45, pitchWant + 0.14);
    }
    // 只有「爬升後放開」才慢慢降回；玩家自己往下拖視角時直接跟上，不要延遲
    if (pitchWant > camPitch) camPitchEff = Math.max(camPitchEff, pitchWant);
    else if (camPitchEff > camPitch + 0.005) camPitchEff += (camPitch - camPitchEff) * Math.min(1, dt * 2);
    else camPitchEff = camPitch;
    const dir = dirAt(camPitchEff);
    if (camPitchEff > pitchWant + 0.01) block = colliders.length ? cameraBlocked(camTarget, camTarget.clone().addScaledVector(dir, want)) : want;
    const lim = Math.max(3.5, Math.min(want, block - 0.6));
    camDistEff = lim < camDistEff ? lim : camDistEff + (lim - camDistEff) * Math.min(1, dt * 2.5);
    camera.position.copy(camTarget).addScaledVector(dir, camDistEff);
    camera.position.x += sx;
    camera.position.y += sy;
    camera.lookAt(camTarget.x, camTarget.y - 0.1, camTarget.z);
    // 樹冠透視管道：鏡頭 → 主角胸口（截圖改看別處時就對準那個點）
    uSeeOn.value = 1;
    uSeeCam.value.copy(camera.position);
    if (camFocus) uSeeFocus.value.copy(camTarget);
    else uSeeFocus.value.set(ch.x, merged ? 2.4 : 1.1, ch.z);
  }

  function updateSun() {
    // 陰影相機跟著主角走，對齊陰影貼圖像素避免閃爍
    const ch = world.char;
    const c = introOn ? HALL_ORIGIN.clone().add(hall.heroSpot) : new THREE.Vector3(ch.x, 0, ch.z);
    const texel = (SH * 2) / sunLight.shadow.mapSize.x;
    c.x = Math.round(c.x / texel) * texel;
    c.z = Math.round(c.z / texel) * texel;
    const d = introOn ? hall.sunDir : sunDir;
    sunLight.target.position.copy(c);
    sunLight.position.copy(c).addScaledVector(d, 50);
    sky.position.copy(camera.position);
  }

  function updateVisuals(dt, elapsed, isMoving, sfx) {
    // hud 尚未呼叫 setIntro 前，跟著入局帖的顯示狀態走
    if (!introExplicit) {
      const el = document.getElementById('intro');
      applyIntro(!!el && !el.classList.contains('hidden') && el.offsetParent !== null);
    }
    rebuildMapIfNeeded();
    consumeVfxQueue(sfx);
    if (introOn) {
      hero.update(dt);
      hall.update(dt, elapsed);
    } else {
      updateHero(dt, elapsed);
      updateEntities(dt, elapsed);
      mapData?.update?.(dt, elapsed, world);
      if (mapData?.beaconViews) for (const b of mapData.beaconViews) b.sync(world);
    }
    updateFx(dt, elapsed);
    updateCamera(dt);
    updateSun();
    void isMoving;
  }

  let baseFov = 46;
  function resize(w, h) {
    viewW = w; viewH = h;
    camera.aspect = Math.max(0.2, w / Math.max(1, h));
    // 直式手機：拉遠一點、視角放寬，角色兩側的量表與場景都看得到
    camDist = w < h ? 16.5 : 14.0;
    baseFov = w < h ? 58 : 46;
    camLead = w < h ? 0.8 : 2.0;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function projectToScreen(x, y, z, width, height) {
    tmpV.set(x, y, z).project(camera);
    if (tmpV.z > 1) return null;
    return { x: (tmpV.x * 0.5 + 0.5) * width, y: (-tmpV.y * 0.5 + 0.5) * height };
  }

  // 點擊 3D 地面尋路或點選怪物（以不可見的代理圓柱拾取，不對蒙皮網格做射線）
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  function pickGroundOrEntity(clientX, clientY, rect) {
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    let best = null;
    for (const [id, v] of entityViews) {
      if (!v.root.visible) continue;
      const hits = raycaster.intersectObject(v.proxy, false);
      if (hits.length && (!best || hits[0].distance < best.d)) best = { d: hits[0].distance, id };
    }
    if (best) return { type: 'ENTITY', entityId: best.id };
    const gHits = raycaster.intersectObject(pickPlane, false);
    if (gHits.length > 0) return { type: 'GROUND', x: gHits[0].point.x, z: gHits[0].point.z };
    return null;
  }

  rebuildMapIfNeeded();

  return {
    renderer,
    backendName,
    scene,
    camera,
    hero,
    get heroActor() { return hero; },
    mech,
    updateVisuals,
    render: () => renderer.render(scene, camera),
    resize,
    projectToScreen,
    pickGroundOrEntity,
    setIntro,
    setHeroLook,
    anchors,
    isIntro: () => introOn,
    orbitBy: (dYaw, dPitch = 0) => {
      camYaw += dYaw;
      camPitch = Math.max(0.32, Math.min(1.08, camPitch + dPitch));
    },
    zoomBy: (delta) => {
      camDist = Math.max(8.5, Math.min(24.0, camDist + delta));
    },
    setCamera: ({ yaw, pitch, dist, focus } = {}) => {
      if (focus !== undefined) camFocus = focus;
      if (yaw != null) camYaw = yaw;
      if (pitch != null) { camPitch = pitch; camPitchEff = pitch; }
      if (dist != null) { camDist = dist; camDistEff = dist; }
    },
    getCameraAngles: () => ({ camYaw, camPitch, camDist }),
    setShowcase: (on) => { showcase = !!on; },
    // 展示頁縮圖構圖（tools/thumb.mjs）：青萍渡北街，鏡頭在鏢師斜後方，背上的六器匣、出鞘的刀和前方順安鏢局門樓、大鏢旗同框；
    // map 是地圖 id，yaw／pitch／dist 是絕對值，給 setCamera
    thumbPose: () => ({ map: 1001, x: THUMB.x, z: THUMB.z, rotY: THUMB.rotY, yaw: THUMB.yaw, pitch: THUMB.pitch, dist: THUMB.dist }),
    info: () => ({
      backend: backendName,
      calls: renderer.info?.render?.drawCalls ?? 0, // 每幀 draw call（含陰影 pass）
      drawCalls: renderer.info?.render?.drawCalls ?? 0,
      triangles: renderer.info?.render?.triangles ?? 0,
    }),
  };
}
