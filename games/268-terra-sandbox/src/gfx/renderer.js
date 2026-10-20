// 畫面層總管：場景、光線與陰影、天空／水面、圖磚網格串流（每幀建置預算＋LOD 換檔）、
// 紅綠燈與路燈、吊椅纜車、路人與車流、玩家角色與載具、第三人稱／第一人稱／自由相機，以及後製（泛光、景深）。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildChunk } from './chunks.js';
import { createWorldMaterial } from './atlas.js';
import { Sky } from './sky.js';
import { Water } from './water.js';
import { buildInterior } from './interior.js';
import { PlayerAvatar, Crowd, boardGeo } from './character.js';
import { TrafficRenderer, playerCar, bikeModel, planeModel, boatModel, chairGeo } from './vehicles.js';
import { signalState } from '../core/traffic.js';
import { raycastBuildings } from '../core/stream.js';
import { LIFT, RUNS, SKATE, liftPoint } from '../core/world.js';
import { clamp, lerp, wrapAngle, mulberry32 } from '../core/math.js';
import { seaState } from '../core/weather.js';
import { ShuttleView } from './shuttle.js';
import { Earth } from './earth.js';
import { EARTH_R } from '../core/shuttle.js';

export const QUALITY = {
  low: { label: '低', view: 420, shadow: 1024, ratio: 1, bloom: false, budget: 2, peds: 18 },
  mid: { label: '中', view: 620, shadow: 2048, ratio: 1.5, bloom: true, budget: 3, peds: 34 },
  high: { label: '高', view: 860, shadow: 2048, ratio: 2, bloom: true, budget: 4, peds: 48 },
};

const GROUND_FAR = { metro: 0x6f7378, canal: 0x7d7a6f, hills: 0x8a9a6c, town: 0x7f9a5e, beach: 0xcdbf9a, ski: 0xe9eef3, ocean: 0x0b3a52 };
const CAM = {
  walk: { h: 1.55, d: 4.4, p: 0.2 },
  board: { h: 1.4, d: 4.0, p: 0.24 },
  bike: { h: 1.6, d: 4.8, p: 0.22 },
  car: { h: 1.9, d: 7.6, p: 0.22 },
  plane: { h: 2.6, d: 17, p: 0.16 },
  boat: { h: 2.4, d: 11, p: 0.2 },
  shuttle: { h: 0, d: 95, p: 0.08 },
  orbiter: { h: 2, d: 52, p: 0.2 },
  glide: { h: 2, d: 46, p: 0.32 },
};

export class Renderer {
  constructor(canvas, quality = 'mid') {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.info.autoReset = false;
    this.r = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.12, 14000);
    this.camera.rotation.order = 'YXZ';
    this.scene.fog = new THREE.Fog(0xb9d7f1, 300, 900);
    this.worldMat = createWorldMaterial();
    this.U = this.worldMat.userData.uniforms;
    // 室內用另一份同樣的材質（不受剖面切割）
    this.interiorMat = createWorldMaterial();
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: false });
    this.lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0xbfe0ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false });

    // 光線
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b6052, 0.9);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -95;
    sc.right = 95;
    sc.top = 95;
    sc.bottom = -95;
    sc.near = 1;
    sc.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.pointLights = [];
    for (let k = 0; k < 4; k++) {
      const pl = new THREE.PointLight(0xffc98a, 0, 26, 1.6);
      this.scene.add(pl);
      this.pointLights.push(pl);
    }
    this.flashLight = new THREE.DirectionalLight(0xdfe6ff, 0);
    this.scene.add(this.flashLight);

    this.sky = new Sky(this.scene);
    this.water = new Water(this.scene);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envT = -99;
    this.farGround = new THREE.Mesh(new THREE.CircleGeometry(30000, 64).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x777777 }));
    this.farGround.renderOrder = -1;
    this.scene.add(this.farGround);

    // 動態物件
    this.chunkRoot = new THREE.Group();
    this.scene.add(this.chunkRoot);
    this.chunks = new Map();
    this.traffic = new TrafficRenderer(this.lampMat, 48);
    this.scene.add(this.traffic.group);
    this.crowd = new Crowd(96);
    this.scene.add(this.crowd.group);
    this.lens = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), 600);
    this.lens.count = 0;
    this.lens.frustumCulled = false;
    this.lens.setColorAt(0, new THREE.Color());
    this.scene.add(this.lens);
    this.chairs = null;
    this.cables = null;

    // 玩家
    this.avatar = new PlayerAvatar();
    this.scene.add(this.avatar.root);
    const boardMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    this.boardPivot = new THREE.Group();
    this.board = { skate: new THREE.Mesh(boardGeo('skate'), boardMat), snow: new THREE.Mesh(boardGeo('snow'), boardMat) };
    for (const m of Object.values(this.board)) {
      m.castShadow = true;
      this.boardPivot.add(m);
    }
    this.scene.add(this.boardPivot);
    this.vehicles = { car: null, carKey: '', bike: bikeModel(), plane: planeModel(), boat: boatModel() };
    for (const k of ['bike', 'plane', 'boat']) this.scene.add(this.vehicles[k].group);
    this.interior = null;
    this.shuttle = new ShuttleView(this.scene);
    this.earth = new Earth(this.scene);

    // 相機狀態
    this.cam = { yaw: 0, pitch: 0.2, zoom: 1, mode: 'follow', idle: 0, dist: 5, free: { x: 0, y: 30, z: 0, yaw: 0, pitch: 0.2 }, shake: 0, fov: 60 };
    this.camVel = { x: 0, z: 0 };
    this._prevCam = new THREE.Vector3();

    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.92);
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 12, aperture: 0.002, maxblur: 0.012 });
    this.bokeh.enabled = false;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bokeh);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.flash = 0;
    this.stats = { builtThisFrame: 0, chunkMeshes: 0, tris: 0, calls: 0 };
    this.setQuality(quality);
  }

  setQuality(q) {
    this.q = QUALITY[q] ? q : 'mid';
    const Q = QUALITY[this.q];
    this.Q = Q;
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.ratio));
    this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
    this.bloom.enabled = Q.bloom;
    this.resize();
  }

  resize() {
    const w = this.r.domElement.clientWidth || window.innerWidth;
    const h = this.r.domElement.clientHeight || window.innerHeight;
    this.r.setSize(w, h, false);
    this.composer.setPixelRatio(this.r.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  // 換地點：清掉所有圖磚網格與纜車
  setWorld(world, streamer) {
    this.W = world;
    this.streamer = streamer;
    for (const e of this.chunks.values()) disposeEntry(e);
    this.chunks.clear();
    this.chunkRoot.clear();
    if (this.chairs) {
      this.scene.remove(this.chairs, this.cables);
      this.chairs = null;
    }
    if (world.kind === 'ski') this.buildLift();
    this.farGround.material.color.setHex(GROUND_FAR[world.kind] ?? 0x777777);
    this.farGround.visible = world.kind !== 'ocean';
    this.setInterior(null);
    this.shuttle.hide();
    this.shuttle.smoke.clear();
    this.npcSeed = mulberry32(world.seed);
  }

  buildLift() {
    const W = this.W;
    const len = LIFT.zBase - LIFT.zTop;
    this.liftN = Math.floor((2 * len) / LIFT.spacing);
    this.chairs = new THREE.InstancedMesh(chairGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), this.liftN);
    this.chairs.castShadow = true;
    this.chairs.frustumCulled = false;
    const pts = [[], []];
    for (let k = 0; k <= 400; k++) {
      const u = k / 400;
      const a = liftPoint(W, u * 0.5);
      const b = liftPoint(W, 0.5 + u * 0.5);
      pts[0].push(new THREE.Vector3(a.x, a.y + 0.02, a.z));
      pts[1].push(new THREE.Vector3(b.x, b.y + 0.02, b.z));
    }
    this.cables = new THREE.Group();
    for (const p of pts) this.cables.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), new THREE.LineBasicMaterial({ color: 0x2a2e33 })));
    this.scene.add(this.chairs, this.cables);
  }

  setInterior(layout, b) {
    if (this.interior) {
      this.scene.remove(this.interior.group);
      this.interior.group.traverse((o) => o.geometry && o.geometry.dispose());
      this.interior = null;
    }
    if (!layout) {
      this.U.uCutY.value = 1e6;
      this.U.uCutBox.value.set(1e6, 1e6, -1e6, -1e6);
      return;
    }
    const parts = buildInterior(layout);
    const g = new THREE.Group();
    const solid = new THREE.Mesh(parts.solid.build(), this.interiorMat);
    solid.castShadow = solid.receiveShadow = true;
    g.add(solid);
    if (!parts.glass.empty) g.add(new THREE.Mesh(parts.glass.build(), this.glassMat));
    if (!parts.glow.empty) g.add(new THREE.Mesh(parts.glow.build(), this.lampMat));
    const lights = new THREE.Group();
    layout.lights.slice(0, 3).forEach((l) => {
      const pl = new THREE.PointLight(0xffe7c4, 6, 14, 1.4);
      pl.position.set(l.x, layout.y + Math.min(layout.height, 3.2) - 0.4, l.z);
      lights.add(pl);
    });
    g.add(lights);
    this.scene.add(g);
    this.interior = { group: g, key: `${layout.building}:${layout.floor}`, layout };
    // 娃娃屋剖面：本棟與左右鄰棟在這層地板以上全部切掉，攝影機從斜上方看進房間
    this.U.uCutY.value = layout.y + 0.05;
    this.U.uCutBox.value.set(b.x0 - 7, b.z0 - 7, b.x1 + 7, b.z1 + 7);
  }

  // ── 圖磚網格：只把已經串流進來的圖磚轉成網格，每幀最多建 budget 個 ──
  updateChunks(visible, warm) {
    const want = new Set();
    let budget = warm ? 60 : this.Q.budget;
    let built = 0;
    for (const v of visible) {
      const c = v.chunk;
      want.add(c.key);
      const e = this.chunks.get(c.key);
      if (e && e.lod === v.lod) continue;
      if (budget <= 0) continue;
      budget--;
      built++;
      const ne = this.makeEntry(c, v.lod);
      if (e) disposeEntry(e, this.chunkRoot);
      this.chunks.set(c.key, ne);
      this.chunkRoot.add(ne.group);
    }
    for (const [k, e] of this.chunks) {
      if (!want.has(k)) {
        disposeEntry(e, this.chunkRoot);
        this.chunks.delete(k);
      }
    }
    this.stats.builtThisFrame = built;
    this.stats.chunkMeshes = this.chunks.size;
  }

  makeEntry(c, lod) {
    const out = buildChunk(this.W, c, lod);
    const g = new THREE.Group();
    const add = (B, material, cast, recv) => {
      if (B.empty) return;
      const m = new THREE.Mesh(B.build(), material);
      m.castShadow = cast;
      m.receiveShadow = recv;
      g.add(m);
    };
    add(out.ground, this.worldMat, false, true);
    add(out.build, this.worldMat, lod <= 1, true);
    add(out.props, this.worldMat, lod === 0, true);
    add(out.glow, this.glowMat, false, false);
    return { key: c.key, lod, group: g, pools: out.pools, lens: out.lens };
  }

  // ── 每幀 ──
  // s：{ player, local（天氣取樣）, sun, moon, t, dt, lat, traffic, weather, photo, input }
  frame(s) {
    const { player: p, dt, t } = s;
    const W = this.W;
    // 太空梭高度：決定天空轉黑、地球球面與地面圖層的隱藏
    const alt = p.mode === 'shuttle' && p.shuttle.phase !== 'glide' ? Math.max(0, p.shuttle.alt) : 0;
    const space = clamp((alt - 12000) / 50000, 0, 1);
    const above = clamp((alt - 1500) / 2500, 0, 1); // 高過雲層
    const local = above > 0 ? { ...s.local, cover: s.local.cover * (1 - above), rain: s.local.rain * (1 - above), thunder: 0, fog: s.local.fog * (1 - above), snow: above < 1 && s.local.snow } : s.local;
    this.updateChunks(s.visible || [], s.warm);

    // 天色與光線
    const sunEl = s.sun.elevation;
    const sunAz = s.sun.azimuth;
    const sunDir = new THREE.Vector3(Math.sin(sunAz) * Math.cos(sunEl), Math.sin(sunEl), -Math.cos(sunAz) * Math.cos(sunEl));
    if (s.newFlash) this.flash = 1;
    this.flash = Math.max(0, this.flash - dt * 5);
    const flick = this.flash > 0 ? this.flash * (0.6 + 0.4 * Math.sin(t * 60)) : 0;
    const groundAt = (x, z) => W.groundAt(x, z);
    const sc = this.sky.update({
      sunEl, sunAz, moonEl: s.moon.elevation, moonAz: s.moon.azimuth, local, lat: s.lat, t, camera: this.camera, flash: flick,
      cloudBase: (W.kind === 'ski' ? 520 : 380) + (local.rain > 0.5 ? -60 : 0), timeScaleVis: Math.min(s.timeScale || 1, 40), indoor: !!p.inside,
      camVel: this.camVel, newFlash: s.newFlash, flashPos: s.flashPos, groundAt,
      alt, space, dip: Math.acos(EARTH_R / (EARTH_R + alt)),
    }, dt);
    const day = sc.day;
    const night = clamp(1 - day * 1.8, 0, 1);
    const cover = local.cover;
    const dim = 1 - Math.pow(cover, 1.6) * 0.88;
    this.sun.color.copy(sc.sun);
    this.sun.intensity = 2.3 * dim * clamp(sunEl * 6 + 0.15, 0, 1);
    const moonEl = s.moon.elevation;
    if (this.sun.intensity < 0.05 && moonEl > 0) {
      // 夜裡改由月光投影
      this.sun.color.setHex(0x9fb4e0);
      this.sun.intensity = 0.25 * (1 - cover * 0.8);
      sunDir.set(Math.sin(s.moon.azimuth) * Math.cos(moonEl), Math.sin(moonEl), -Math.cos(s.moon.azimuth) * Math.cos(moonEl));
    }
    this.hemi.color.copy(sc.zenith).lerp(new THREE.Color(0xfff4e6), 0.62);
    this.hemi.groundColor.setHex(W.kind === 'ski' ? 0xc9d2dc : 0x6b6052).lerp(new THREE.Color(0x5d86b8), space).multiplyScalar(0.3 + day * 0.7);
    this.hemi.intensity = (0.25 + day * 0.85 + (night > 0.5 ? 0.15 : 0)) * (1 - space * 0.75);
    this.flashLight.intensity = flick * 3;
    this.flashLight.position.set(0, 1, 0);

    // 霧
    const fog = this.scene.fog;
    fog.color.copy(sc.horizon).lerp(new THREE.Color(0x9aa3ab).multiplyScalar(0.2 + day * 0.8), local.fog * 0.7);
    const view = this.Q.view;
    const high = Math.max(0, this.camera.position.y - (W.groundAt(this.camera.position.x, this.camera.position.z) || 0));
    fog.far = lerp(view * 1.05 + high * 3, 110, local.fog) * (p.inside ? 3 : 1);
    fog.near = lerp(Math.min(view * 0.35, 260), 8, local.fog);
    if (alt > 1500) {
      fog.near = Math.max(fog.near, alt * 0.5);
      fog.far = Math.max(fog.far, alt * 4 + 2000);
    }
    this.chunkRoot.visible = alt < 7000;
    this.farGround.visible = W.kind !== 'ocean' && alt < 3500;
    this.farGround.position.set(this.camera.position.x, W.kind === 'ski' ? -40 : W.kind === 'metro' || W.kind === 'town' ? -0.3 : -9, this.camera.position.z);
    this.farGround.material.color.setHex(GROUND_FAR[W.kind] ?? 0x777777).multiplyScalar(0.25 + day * 0.75);

    // 世界材質
    const U = this.U;
    U.uNight.value = night;
    U.uWet.value = lerp(U.uWet.value, local.snow ? 0 : clamp(local.rain * 1.4, 0, 1), Math.min(1, dt * 0.3));
    U.uSnow.value = lerp(U.uSnow.value, W.kind === 'ski' ? 0.9 : local.snow ? 0.75 : 0, Math.min(1, dt * 0.15));
    this.glowMat.color.setScalar(lerp(0.55, 2.6, night));
    this.lampMat.color.setScalar(lerp(1, 2.2, night));

    // 環境貼圖（每 6 秒或天色大變時重算）
    const envKey = Math.round(sunEl * 30) + Math.round(cover * 10) * 100;
    if (t - this.envT > 6 && envKey !== this.envKey) {
      this.envT = t;
      this.envKey = envKey;
      this.sky.groundDisc.material.color.copy(this.farGround.material.color);
      const rt = this.pmrem.fromScene(this.sky.envScene, 0, 0.5, 300);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt;
      this.scene.environment = rt.texture;
      this.scene.environmentIntensity = (0.3 + day * 0.4) * (1 - space * 0.7);
    }

    // 水面
    const amp = seaState(W.kind, local.wind);
    this.water.update({
      dry: W.kind === 'beach' ? W.blockRect(SKATE.cell[0], SKATE.cell[1]) : null,
      level: alt > 3500 ? -1000 : W.waterY, amp, t, cam: this.camera.position, sky: sc, sunDir, sunCol: sc.sun, fogCol: fog.color, fogNear: fog.near, fogFar: fog.far * 1.6, night, kind: W.kind,
    });
    // 地球（高空）與太空梭
    const sunW = new THREE.Vector3(Math.sin(sunAz) * Math.cos(sunEl), Math.sin(sunEl), -Math.cos(sunAz) * Math.cos(sunEl));
    const cam0 = this.camera.position;
    this.earth.update({ alt: alt > 0 ? Math.max(alt, cam0.y - p.shuttle.padY) : 0, lat: s.lat, lon: s.lon ?? 0, cam: cam0, center: new THREE.Vector3(cam0.x, (p.shuttle.padY || 0) - EARTH_R, cam0.z), sunDir: sunW, weather: s.weather, t });
    const lit = sc.sun.clone().multiplyScalar(0.25 + day * 0.85);
    const shade = this.hemi.color.clone().multiplyScalar(0.15 + day * 0.5);
    this.shuttle.update(p, t, dt, lit, shade, space);

    // 路燈光暈（最近的 4 盞）
    const pools = [];
    for (const e of this.chunks.values()) if (e.lod === 0) for (const q of e.pools) pools.push(q);
    const px = p.x;
    const pz = p.z;
    pools.sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
    this.pointLights.forEach((pl, k) => {
      const q = pools[k];
      if (!q || night < 0.2) {
        pl.intensity = 0;
        return;
      }
      pl.position.set(q.x, q.y - 0.4, q.z);
      pl.intensity = night * 7;
    });

    // 紅綠燈
    this.updateLens(s.trafficT ?? t);

    // 車流與路人
    if (s.traffic) this.traffic.update(s.traffic.cars);
    else this.traffic.update([]);
    const people = [];
    if (s.traffic) {
      for (const q of s.traffic.peds) {
        if (people.length >= this.Q.peds) break;
        people.push({ x: q.x, y: q.y, z: q.z, yaw: q.yaw, anim: q.stopped ? 'idle' : 'walk', phase: q.phase, look: q.look });
      }
    }
    this.npcs(people, t);
    this.crowd.update(people);

    // 纜車吊椅
    if (this.chairs) this.updateLift(t);

    // 玩家
    this.updatePlayer(p, s);
    if (s.interiorLayout !== (this.interior && this.interior.layout)) this.setInterior(s.interiorLayout, p.inside && p.inside.b);

    // 相機
    this.updateCamera(p, s, dt);
    this.camVel.x = (this.camera.position.x - this._prevCam.x) / Math.max(dt, 1e-3);
    this.camVel.z = (this.camera.position.z - this._prevCam.z) / Math.max(dt, 1e-3);
    this._prevCam.copy(this.camera.position);

    // 陰影跟著玩家，對齊陰影貼圖像素避免閃爍
    const tgt = new THREE.Vector3(p.x, p.y, p.z);
    const texel = 190 / this.Q.shadow;
    tgt.x = Math.round(tgt.x / texel) * texel;
    tgt.z = Math.round(tgt.z / texel) * texel;
    this.sun.target.position.copy(tgt);
    this.sun.position.copy(tgt).addScaledVector(sunDir, 300);
    this.sun.castShadow = this.sun.intensity > 0.05;

    // 後製
    this.bloom.strength = 0.16 + night * 0.32 + (W.kind === 'ski' ? -0.08 : 0);
    this.bloom.threshold = night > 0.5 ? 0.86 : 0.97;
    if (s.photo && s.photo.active) {
      this.bokeh.enabled = s.photo.aperture < 15;
      this.bokeh.uniforms.focus.value = s.photo.focus;
      this.bokeh.uniforms.aperture.value = 0.0006 / Math.max(1, s.photo.aperture) * 10;
      this.bokeh.uniforms.maxblur.value = 0.014;
    } else this.bokeh.enabled = false;
    this.r.toneMappingExposure = s.photo && s.photo.active ? s.photo.exposure * 0.92 : 0.92;
    this.r.info.reset();
    this.composer.render(dt);
    const info = this.r.info.render;
    this.stats.tris = info.triangles;
    this.stats.calls = info.calls;
    return sc;
  }

  updateLens(t) {
    let i = 0;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const on = { red: [3.2, 0.25, 0.18], yellow: [3.2, 2.2, 0.2], green: [0.25, 3, 1.4] };
    const off = [0.08, 0.08, 0.08];
    for (const e of this.chunks.values()) {
      if (e.lod !== 0) continue;
      for (const L of e.lens) {
        const st = signalState(L.axis, t);
        const rows = [['red', 0.34], ['yellow', 0], ['green', -0.34]];
        for (const [col, dy] of rows) {
          if (i >= 600) break;
          m.makeTranslation(L.x + L.fx * 0.07, L.y + dy, L.z + L.fz * 0.07);
          this.lens.setMatrixAt(i, m);
          const v = st === col ? on[col] : off;
          this.lens.setColorAt(i, c.setRGB(v[0], v[1], v[2]));
          i++;
        }
      }
    }
    this.lens.count = i;
    this.lens.instanceMatrix.needsUpdate = true;
    if (this.lens.instanceColor) this.lens.instanceColor.needsUpdate = true;
  }

  updateLift(t) {
    const W = this.W;
    const len = LIFT.zBase - LIFT.zTop;
    const base = ((t * LIFT.speed) / (2 * len)) % 1;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    this.liftRiders = [];
    for (let k = 0; k < this.liftN; k++) {
      const u = (base + k / this.liftN) % 1;
      const pt = liftPoint(W, u);
      q.setFromAxisAngle(up, pt.up ? 0 : Math.PI);
      m.compose(new THREE.Vector3(pt.x, pt.y - 2.52, pt.z), q, one);
      this.chairs.setMatrixAt(k, m);
      if (pt.up && k % 3 === 1) this.liftRiders.push({ x: pt.x - 0.45, y: pt.y - 2.35, z: pt.z + 0.3, yaw: 0, anim: 'sit', phase: 0, look: k });
    }
    this.chairs.instanceMatrix.needsUpdate = true;
  }

  // 雪場與滑板公園的 NPC（程序路徑，不需要模擬）
  npcs(list, t) {
    const W = this.W;
    if (W.kind === 'ski') {
      for (const r of this.liftRiders || []) list.push(r);
      for (let k = 0; k < 10; k++) {
        const run = RUNS[k % 2];
        const sp = 9 + (k % 4) * 1.8;
        const span = 900;
        const z = -720 + ((t * sp + k * 173) % span);
        const sw = Math.sin(t * 0.9 + k) * run.half * 0.55;
        const x = run.cx(z) + sw;
        const dx = Math.cos(t * 0.9 + k) * run.half * 0.55 * 0.9;
        list.push({ x, y: W.terrain(x, z), z, yaw: Math.atan2(dx, -sp), anim: 'ride', phase: t, look: k + 2, board: 'snow', lean: clamp(-dx / 12, -0.4, 0.4) });
      }
    } else if (W.kind === 'beach') {
      const B0 = SKATE.bowls[0];
      const B1 = SKATE.bowls[1];
      for (let k = 0; k < 3; k++) {
        const a = t * (0.55 + k * 0.08) + k * 2.1;
        const b = k < 2 ? B0 : B1;
        const rx = (b.kind === 'rect' ? b.hx : b.r) - 1.4 - k * 0.6;
        const rz = (b.kind === 'rect' ? b.hz : b.r) - 1.6;
        const x = b.cx + Math.cos(a) * rx;
        const z = b.cz + Math.sin(a) * rz;
        const yaw = Math.atan2(-Math.sin(a) * rx, -Math.cos(a) * rz);
        list.push({ x, y: W.groundAt(x, z), z, yaw, anim: 'ride', phase: a, look: k + 1, board: 'skate', lean: 0.25 });
      }
      // 在碗邊休息的人
      list.push({ x: B0.cx - B0.hx - 1.2, y: W.groundAt(B0.cx - B0.hx - 1.2, B0.cz + 3), z: B0.cz + 3, yaw: Math.PI / 2, anim: 'idle', phase: t, look: 5 });
    }
  }

  updatePlayer(p, s) {
    const A = this.avatar;
    const V = this.vehicles;
    const mode = p.mode;
    const onBoard = mode === 'board' && !p.inside && !p.lift;
    const snow = this.W.kind === 'ski';
    V.bike.group.visible = mode === 'bike' && !p.inside;
    V.plane.group.visible = mode === 'plane';
    V.boat.group.visible = mode === 'boat';
    if (mode === 'car') {
      const key = `${p.car.model}:${p.car.color}`;
      if (key !== V.carKey) {
        if (V.car) this.scene.remove(V.car.group);
        V.car = playerCar(p.car.model, p.car.color, this.lampMat);
        V.carKey = key;
        this.scene.add(V.car.group);
      }
    }
    if (V.car) V.car.group.visible = mode === 'car';
    A.root.visible = mode !== 'car' && mode !== 'plane' && mode !== 'shuttle';
    A.setBackItem(onBoard || mode === 'plane' || mode === 'shuttle' ? 'none' : snow ? 'snow' : 'skate');
    this.boardPivot.visible = onBoard;
    this.board.skate.visible = !snow;
    this.board.snow.visible = snow;

    let rootYaw = -p.yaw;
    let y = p.y;
    if (mode === 'car') {
      const g = V.car.group;
      g.position.set(p.x, p.y, p.z);
      g.rotation.set(p.car.pitch, -p.yaw, -p.car.roll, 'YXZ');
      for (const w of V.car.wheels) {
        w.pivot.rotation.y = w.front ? -p.car.steer * 0.5 : 0;
        w.mesh.rotation.x = (w.left ? -1 : 1) * p.car.wheel;
      }
    } else if (mode === 'bike') {
      const g = V.bike.group;
      g.position.set(p.x, p.y, p.z);
      g.rotation.set(p.car.pitch || 0, -p.yaw, -(p.car.roll || 0), 'YXZ');
      for (const w of V.bike.wheels) w.rotation.x = -(p.car.wheel || 0);
      y = p.y + 0.0;
    } else if (mode === 'plane') {
      const g = V.plane.group;
      g.position.set(p.x, p.y, p.z);
      g.rotation.set(p.plane.pitch, -p.yaw, -p.plane.roll, 'YXZ');
      V.plane.prop.rotation.z = p.plane.prop;
      V.plane.disc.material.opacity = 0.04 + p.plane.throttle * 0.1;
    } else if (mode === 'boat') {
      const g = V.boat.group;
      g.position.set(p.x, p.y, p.z);
      g.rotation.set(p.boat.pitch, -p.yaw, -p.boat.roll, 'YXZ');
      y = p.y + 0.55;
    }
    if (onBoard) {
      // 側站：身體轉 90°，板子沿行進方向；翻板繞長軸、轉板繞垂直軸
      rootYaw = -p.yaw + (s.stance === 'goofy' ? Math.PI / 2 : -Math.PI / 2);
      const B = p.board;
      this.boardPivot.position.set(p.x, p.y + (B.flip ? 0.25 : 0), p.z);
      this.boardPivot.rotation.set(0, -p.yaw + (B.spin || 0), B.flip || 0, 'YXZ');
      y = p.y + 0.13;
    }
    A.root.position.set(p.x, y, p.z);
    if (mode === 'boat') {
      A.root.position.set(p.x - Math.sin(p.yaw) * 0.5, y + 0.15, p.z + Math.cos(p.yaw) * 0.5);
    }
    A.root.rotation.set(0, rootYaw, 0);
    A.update({ anim: mode === 'bike' && !p.inside ? 'bike' : p.anim, phase: p.phase, lean: p.lean || 0 });
  }

  rotateCam(dx, dy) {
    const C = this.cam;
    if (C.mode === 'free') {
      C.free.yaw += dx;
      C.free.pitch = clamp(C.free.pitch + dy, -1.4, 1.4);
    } else {
      C.yaw += dx;
      C.pitch = clamp(C.pitch + dy, -0.5, 1.35);
    }
    C.idle = 0;
  }

  zoomCam(f) {
    this.cam.zoom = clamp(this.cam.zoom * f, 0.45, 3.5);
  }

  // 自由相機（拍照模式）的移動
  moveFree(mx, my, up, dt, fast) {
    const F = this.cam.free;
    const sp = (fast ? 40 : 12) * dt;
    const cy = Math.cos(F.yaw);
    const sy = Math.sin(F.yaw);
    F.x += (sy * my + cy * mx) * sp;
    F.z += (-cy * my + sy * mx) * sp;
    F.y += up * sp;
    if (this.W) F.y = Math.max(F.y, this.W.groundAt(F.x, F.z) + 0.3);
  }

  enterFree() {
    const c = this.camera;
    this.cam.free = { x: c.position.x, y: c.position.y, z: c.position.z, yaw: -c.rotation.y, pitch: -c.rotation.x };
  }

  updateCamera(p, s, dt) {
    const C = this.cam;
    const cam = this.camera;
    const fovT = s.photo && s.photo.active ? s.photo.fov : p.mode === 'plane' || p.mode === 'shuttle' ? 68 : p.mode === 'car' && Math.abs(p.sp) > 20 ? 66 : 60;
    C.fov = lerp(C.fov, fovT, Math.min(1, dt * 4));
    if (Math.abs(cam.fov - C.fov) > 0.01) {
      cam.fov = C.fov;
      cam.updateProjectionMatrix();
    }
    if (C.mode === 'free') {
      const F = C.free;
      cam.position.set(F.x, F.y, F.z);
      cam.rotation.set(-F.pitch, -F.yaw, 0, 'YXZ');
      return;
    }
    const SH = p.shuttle;
    const stack = p.mode === 'shuttle' && (SH.phase === 'pad' || SH.phase === 'count' || SH.phase === 'ascent');
    const conf = p.inside ? { h: 1.3, d: 9, p: 0.95 } : p.mode === 'shuttle' ? (stack ? CAM.shuttle : SH.phase === 'glide' ? CAM.glide : CAM.orbiter) : CAM[p.mode] || CAM.walk;
    // 載具：滑鼠閒置一下就自動回到車尾
    C.idle += dt;
    const vehicle = p.mode !== 'walk' || p.lift;
    if ((vehicle && C.idle > 1.2) || (p.mode === 'walk' && C.idle > 2.5 && Math.abs(p.sp) > 2.5)) {
      const k = Math.min(1, dt * (p.mode === 'plane' ? 3 : 1.8));
      C.yaw += wrapAngle(p.yaw - C.yaw) * k;
      if (p.mode === 'plane') C.pitch += (conf.p - p.plane.pitch * 0.4 - C.pitch) * k;
      else C.pitch += (conf.p - C.pitch) * k * 0.5;
    }
    if (p.inside && C.pitch < 0.7) C.pitch = lerp(C.pitch, 0.95, Math.min(1, dt * 3));
    const fp = C.mode === 'first';
    let tx = p.x;
    let ty = p.y + (fp ? (p.mode === 'car' ? 1.35 : p.mode === 'plane' ? 2.2 : 1.62) : conf.h);
    let tz = p.z;
    if (p.mode === 'shuttle') {
      // 箭體：看著箭體中段；第一人稱放在座艙
      if (fp) {
        const o = stack ? new THREE.Vector3(0, 2.2, -13.6).applyMatrix4(this.shuttle.mount).applyEuler(this.shuttle.stack.rotation).add(this.shuttle.stack.position) : this.shuttle.cockpit.getWorldPosition(new THREE.Vector3());
        cam.position.copy(o);
        cam.rotation.set(-C.pitch, -C.yaw, 0, 'YXZ');
        return;
      }
      if (stack) {
        const st = Math.sin(SH.tilt);
        tx += st * Math.sin(SH.heading) * 24;
        ty += Math.cos(SH.tilt) * 24;
        tz -= st * Math.cos(SH.heading) * 24;
      }
    }
    const fwdX = Math.sin(C.yaw);
    const fwdZ = -Math.cos(C.yaw);
    if (fp) {
      cam.position.set(tx + fwdX * (p.mode === 'car' ? -0.3 : 0.15), ty, tz + fwdZ * (p.mode === 'car' ? -0.3 : 0.15));
      cam.rotation.set(-C.pitch, -C.yaw, p.mode === 'plane' ? -p.plane.roll * 0.6 : 0, 'YXZ');
      this.avatar.root.visible = false;
      return;
    }
    let dist = conf.d * C.zoom * (p.mode === 'car' ? 1 + clamp(p.sp / 40, 0, 0.35) : 1);
    const cp = Math.cos(C.pitch);
    const dx = -fwdX * cp;
    const dy = Math.sin(C.pitch);
    const dz = -fwdZ * cp;
    // 相機避讓：沿 目標→相機 的射線碰到建物就拉近
    if (this.streamer && !p.inside) {
      const hit = raycastBuildings(this.streamer, tx, ty, tz, dx, dy, dz, dist);
      if (hit < dist) dist = Math.max(0.8, hit - 0.35);
    }
    C.dist = lerp(C.dist, dist, Math.min(1, dt * (dist < C.dist ? 14 : 3)));
    let x = tx + dx * C.dist;
    let y = ty + dy * C.dist;
    let z = tz + dz * C.dist;
    const W = this.W;
    if (W) {
      const g = Math.max(W.groundAt(x, z), W.waterY > -900 ? W.waterY + 0.4 : -1e9) + 0.35;
      if (y < g) y = g;
    }
    // 輕微晃動（高速、閃電）
    const shake = (p.mode === 'car' || p.mode === 'board' ? clamp(Math.abs(p.sp) / 50, 0, 0.05) : 0) + (p.mode === 'plane' ? 0.02 : 0)
      + (p.mode === 'shuttle' ? (SH.phase === 'ascent' ? (SH.srb ? 0.5 : 0.12) * clamp(1 - SH.alt / 40000, 0.1, 1) : SH.phase === 'count' ? SH.thrust * 0.3 : 0) + (SH.heat || 0) * 0.4 : 0);
    x += (Math.random() - 0.5) * shake;
    y += (Math.random() - 0.5) * shake;
    cam.position.set(x, y, z);
    cam.lookAt(tx, ty + (p.inside ? -0.6 : 0), tz);
    if (p.mode === 'plane') cam.rotation.z += -p.plane.roll * 0.25;
  }
}

function disposeEntry(e, parent) {
  if (parent) parent.remove(e.group);
  e.group.traverse((o) => o.geometry && o.geometry.dispose());
}
