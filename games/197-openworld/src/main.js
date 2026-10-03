import * as THREE from 'three';
import { Input } from './core/input.js';
import { AudioSystem } from './core/audio.js';
import { clamp } from './core/noise.js';
import { Pipeline, SkyProbe } from './core/pipeline.js';
import { buildTerrainSurface } from './world/surface.js';
import { Terrain, LAKES, WATER_LEVEL } from './world/terrain.js';
import { Colliders } from './world/colliders.js';
import { Environment, LAYER_NO_REFLECT, WEATHER } from './world/environment.js';
import { WaterSurface } from './world/water.js';
import { Grass } from './world/grass.js';
import { scatterWorld } from './world/scatter.js';
import { Campfire, buildCampProps, CAMP_LAYOUT } from './world/camp.js';
import { CampProps } from './world/props.js';
import { createNpcs } from './game/npc.js';
import { Wildlife } from './game/wildlife.js';
import { Assets } from './game/assets.js';
import { Player } from './game/player.js';
import { Car, Boat } from './game/vehicles.js';
import { Inventory, Pickups, ITEMS, HOTBAR } from './game/items.js';
import { Weapons } from './game/weapons.js';
import { Hud } from './ui/hud.js';

// 畫質預設：pixelRatio 是上限，實際解析度還會依 FPS 動態調整
const QUALITY = {
  low:    { label: '低', samples: 0, bloom: false, fxaa: false, pixelRatio: 0.85, shadow: 0,    reflection: 256,  reflectSkip: 2, grassRadius: 44, grassDensity: 4 },
  medium: { label: '中', samples: 0, bloom: true,  fxaa: true,  pixelRatio: 1.0,  shadow: 1024, reflection: 512,  reflectSkip: 1, grassRadius: 62, grassDensity: 8 },
  high:   { label: '高', samples: 4, bloom: true,  fxaa: false, pixelRatio: 1.5,  shadow: 2048, reflection: 1024, reflectSkip: 1, grassRadius: 84, grassDensity: 11 },
};
const QUALITY_ORDER = ['low', 'medium', 'high'];
const MIN_SCALE = 0.6;

class Game {
  constructor(canvas, hudRoot) {
    this.canvas = canvas;
    this.debug = new URLSearchParams(location.search).has('debug');
    // MSAA 由後製管線的 render target 負責，這裡不需要再開一次
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.5;
    this.renderer.shadowMap.enabled = true;
    this.renderer.info.autoReset = false; // 反射與陰影 pass 也要算進統計

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);
    this.camera.layers.enable(LAYER_NO_REFLECT);
    this.scene.add(this.camera);
    this.pipeline = new Pipeline(this.renderer, this.scene, this.camera);

    this.input = new Input(canvas);
    this.input.noLock = this.debug;
    this.audio = new AudioSystem();

    // 手電筒：跟車頭燈一樣常駐場景、只調 intensity
    this.torch = new THREE.SpotLight(new THREE.Color().setRGB(1, 0.96, 0.86, THREE.SRGBColorSpace), 0, 55, 0.5, 0.6, 1.5);
    this.torch.position.set(0.15, -0.12, 0);
    this.torch.target.position.set(0, 0, -1);
    this.camera.add(this.torch, this.torch.target);
    this.torchOn = false;
    this.inventory = new Inventory();
    this.hud = new Hud(hudRoot, this);
    this.assets = new Assets();
    this.vehicles = [];
    this.started = false;
    this.paused = true;
    this.sleepT = 0;

    this.qualityName = 'medium';
    this.scale = 1; // 動態解析度倍率
    this.stats = { fps: 0, ms: 0, calls: 0, triangles: 0, blades: 0, quality: '', scale: 1 };
    this.acc = { time: 0, frames: 0, slow: 0, fast: 0 };
    this.last = performance.now();

    window.addEventListener('resize', () => this.#resize());
    this.input.onLockChange = (locked) => this.#onLock(locked);
    this.hud.startBtn.addEventListener('click', () => this.input.lock());
    canvas.addEventListener('click', () => {
      if (this.started && !this.input.locked && !this.hud.bagOpen) this.input.lock();
    });
    this.inventory.onChange = () => this.hud.refreshInventory();
  }

  /** 玩家是否正在操作（滑鼠已鎖定）。背包開著時世界照常運作但不吃移動輸入 */
  get active() {
    return (this.input.locked || this.debug) && !this.hud.bagOpen && this.sleepT <= 0;
  }

  async init() {
    const { scene, hud } = this;
    hud.setLoading('載入模型與貼圖…');
    await Promise.all([
      this.assets.loadAll((p) => hud.setLoading(`載入模型與貼圖… ${Math.round(p * 100)}%`)),
      this.assets.loadTextures(),
      this.assets.loadScans(),
      this.assets.loadNpcClips(),
    ]);
    console.table(this.assets.report);

    hud.setLoading('產生地形…');
    await nextFrame();
    this.terrain = new Terrain(buildTerrainSurface(this.assets.textures));
    scene.add(this.terrain.mesh);
    this.terrain.mesh.updateMatrix();
    this.colliders = new Colliders();

    this.env = new Environment(scene, this.camera, this.assets.textures);
    this.skyProbe = new SkyProbe(this.renderer, scene, this.env.sky);
    scene.environmentIntensity = 0.45;
    this.water = new WaterSurface(scene, this.terrain, this.assets.textures);
    this.grass = new Grass(scene, this.terrain);

    hud.setLoading('種樹、放石頭…');
    await nextFrame();
    this.worldInfo = scatterWorld(scene, this.terrain, this.colliders, this.assets.textures, this.assets.scans);


    // ---- 營地 ----
    const L = CAMP_LAYOUT;
    this.campfire = new Campfire(scene, this.terrain, this.colliders, L.fire.x, L.fire.z, this.assets.textures);
    buildCampProps(scene, this.terrain, this.colliders, this.campfire);
    this.props = new CampProps(scene, this.terrain, this.colliders, L, this.assets.textures);
    const lake = LAKES[0];
    this.dock = this.props.buildDock(lake, L.fire);

    const bed = this.assets.instance('bed');
    const bedY = this.terrain.getHeight(L.bed.x, L.bed.z);
    bed.position.set(L.bed.x, bedY, L.bed.z);
    bed.rotation.y = L.bed.yaw;
    scene.add(bed);
    const bs = bed.userData.size;
    // 碰撞盒直接取正規化後的包圍盒；高度只算到床墊，才站得上去
    this.colliders.addBox(L.bed.x, L.bed.z, bs.x / 2, bs.z / 2, L.bed.yaw, bedY + bs.y * 0.55);
    this.bed = bed;

    // ---- 玩家與載具 ----
    this.player = new Player(this.camera, this.terrain, this.colliders);
    this.player.teleport(L.spawn.x, L.spawn.z, Math.atan2(-(lake.x - L.spawn.x), -(lake.z - L.spawn.z)));
    this.player.onDeath = () => this.#respawn();

    this.car = new Car(this, L.car.x, L.car.z, L.car.yaw);
    const spot = this.dock.boat; // 船繫在碼頭邊
    this.boat = new Boat(this, this.assets.instance('boat'), spot.x, spot.z, spot.yaw);
    this.vehicles.push(this.car, this.boat);

    this.pickups = new Pickups(this);
    this.pickups.populate();
    this.weapons = new Weapons(this);
    this.weapons.buildTargets();
    this.npcs = createNpcs(this, L, lake, this.dock);
    this.wildlife = new Wildlife(this, lake);
    this.env.onThunder = (delay) => setTimeout(() => this.audio.thunder(), delay * 1000);

    this.applyQuality(this.qualityName);
    this.#resize();
    this.player.updateCamera(0);
    this.env.update(0, this.player.pos);
    this.grass.update(0, this.camera.position, this.player.pos, this.env, Infinity);
    this.hud.refreshInventory();

    this.renderer.compile(scene, this.camera);
    this.started = true;
    hud.setLoading(`就緒 — ${this.worldInfo.trees} 棵樹、${this.worldInfo.bushes} 叢灌木、${this.worldInfo.rocks} 顆石頭`, true);
    if (this.debug) {
      this.paused = false;
      hud.showStart(false);
    }
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }

  applyQuality(name) {
    const q = QUALITY[name];
    this.qualityName = name;
    this.env.setShadowQuality(q.shadow);
    this.pipeline.setQuality({ samples: q.samples, bloom: q.bloom, fxaa: q.fxaa });
    this.water.setQuality(q.reflection, q.reflectSkip);
    this.grass.setQuality(q.grassRadius, q.grassDensity);
    this.grass.lastCell = null;
    this.scale = 1;
    this.adaptAfter = performance.now() + 4000;
    this.#resize();
  }

  #resize() {
    const q = QUALITY[this.qualityName];
    const cap = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
    this.renderer.setPixelRatio(cap * this.scale);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.pipeline.setSize(window.innerWidth, window.innerHeight, cap * this.scale);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    // 以 gl_PointSize 畫的東西（星星、螢火蟲、煙）要跟著實際渲染高度縮放
    this.pointScale = cap * this.scale * (window.innerHeight / 900);
    if (this.env) this.env.starUniforms.uScale.value = Math.max(1, this.pointScale);
    if (this.campfire) this.campfire.smokeUniforms.uScale.value = 620 * this.pointScale;
  }

  #onLock(locked) {
    if (!this.started) return;
    if (locked) {
      this.audio.start();
      this.paused = false;
      this.hud.showStart(false);
      this.hud.toggleBag(false);
    } else if (!this.hud.bagOpen && !this.debug) {
      this.paused = true;
      this.audio.suspend();
      this.hud.showStart(true, true);
    }
  }

  // ---------------------------------------------------------------- 互動

  #interaction() {
    const p = this.player;
    if (p.vehicle) {
      const v = p.vehicle;
      return {
        // 行進中不顯示，免得提示一直擋在畫面中央
        text: Math.abs(v.speed) < 1.5 ? `<kbd>E</kbd>離開${v.name}` : '',
        run: () => {
          if (Math.abs(v.speed) >= 6) return this.hud.toast('速度太快，先減速');
          const landed = v.exit();
          if (v === this.boat && !landed) {
            this.hud.toast('附近沒有岸，跳進水裡了');
            this.audio.splash(1);
          }
        },
      };
    }
    const item = this.pickups.nearest(p.pos, 2.3);
    if (item) {
      const def = ITEMS[item.id];
      return {
        text: `<kbd>E</kbd>撿起 ${def.name}${item.count > 1 ? ' ×' + item.count : ''}`,
        run: () => {
          const got = this.inventory.add(item.id, item.count);
          if (!got) return this.hud.toast('背包滿了');
          this.hud.toast(`獲得 ${def.name}${got > 1 ? ' ×' + got : ''}`);
          this.audio.pickup();
          item.count -= got;
          if (item.count <= 0) this.pickups.remove(item);
        },
      };
    }
    for (const npc of this.npcs) {
      if (npc.distanceTo(p.pos) < 2.4 && Math.abs(npc.pos.y - p.pos.y) < 2) {
        return { text: `<kbd>E</kbd>和${npc.name}說話`, run: () => this.hud.say(npc.talk()) };
      }
    }
    for (const v of this.vehicles) {
      if (v.distanceTo(p.pos) < 3.6 && Math.abs(v.position.y - p.pos.y) < 3) {
        return { text: `<kbd>E</kbd>${v === this.boat ? '上船' : '上車'}`, run: () => v.enter(p) };
      }
    }
    const L = CAMP_LAYOUT.bed;
    if (Math.hypot(p.pos.x - L.x, p.pos.z - L.z) < 2.6) {
      const night = this.env.isNight;
      return {
        text: night ? '<kbd>E</kbd>睡覺（跳到早上）' : '床（天黑後才能睡）',
        run: () => (night ? this.#sleep() : this.hud.toast('天還亮著，19:30 以後再來睡')),
      };
    }
    return null;
  }

  #sleep() {
    if (this.sleepT > 0) return;
    this.sleepT = 2.2;
    this.sleepDone = false;
    this.hud.setFade(1);
  }

  #respawn() {
    const p = this.player;
    p.vehicle?.exit();
    p.teleport(CAMP_LAYOUT.spawn.x, CAMP_LAYOUT.spawn.z);
    p.health = 100;
    p.hunger = Math.max(p.hunger, 50);
    p.oxygen = 100;
    p.stamina = 100;
    this.hud.toast('你倒下了…在營地醒來');
  }

  useSlot(i) {
    const id = this.inventory.activate(i);
    const def = id ? ITEMS[id] : null;
    if (def?.kind === 'food') {
      this.inventory.remove(id, 1);
      this.player.hunger = Math.min(100, this.player.hunger + def.hunger);
      this.player.health = Math.min(100, this.player.health + def.health);
      this.hud.toast(`吃了${def.name}，飽食 +${def.hunger}`);
      this.audio.eat();
    } else if (id === 'ammo') {
      this.hud.toast('子彈會在換彈時自動使用');
    }
  }

  dropSlot(i) {
    const s = this.inventory.take(i);
    if (!s) return;
    const p = this.player;
    const x = p.pos.x - Math.sin(p.yaw) * 1.3;
    const z = p.pos.z - Math.cos(p.yaw) * 1.3;
    this.pickups.spawn(s.id, x, z, s.count, Math.max(this.terrain.getHeight(x, z), WATER_LEVEL - 0.3));
    this.hud.toast(`丟下 ${ITEMS[s.id].name}`);
  }

  #hotkeys() {
    const { input, hud, env } = this;
    if (input.hit('Tab') && (this.input.locked || hud.bagOpen || this.debug)) {
      const open = !hud.bagOpen;
      hud.toggleBag(open);
      if (open) input.unlock();
      else input.lock();
    }
    if (input.hit('F1') && input.locked) input.unlock();
    if (!this.active) return;

    for (let i = 0; i < HOTBAR; i++) if (input.hit('Digit' + (i + 1))) this.useSlot(i);
    if (input.hit('KeyG') && this.inventory.equipped >= 0 && !this.player.vehicle) this.dropSlot(this.inventory.equipped);
    if (input.hit('KeyF') && !this.player.vehicle) this.torchOn = !this.torchOn;
    if (input.hit('KeyM')) hud.toast(this.audio.toggleMute() ? '靜音' : '聲音開啟');
    if (input.hit('KeyT')) {
      env.cycleWeather();
      hud.toast('天氣：' + WEATHER[env.weatherName].label);
    }
    if (input.hit('BracketRight')) env.time = (env.time + 1) % 24;
    if (input.hit('BracketLeft')) env.time = (env.time + 23) % 24;
    if (input.hit('KeyP')) {
      const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(this.qualityName) + 1) % QUALITY_ORDER.length];
      this.applyQuality(next);
      hud.toast('畫質：' + QUALITY[next].label);
    }
  }

  // ---------------------------------------------------------------- 主迴圈

  frame(now) {
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(rawDt, 0.05);
    const { input, player, env } = this;
    this.#hotkeys();

    if (this.sleepT > 0) {
      this.sleepT -= dt;
      if (!this.sleepDone && this.sleepT < 1.2) {
        this.sleepDone = true;
        env.time = 6.5;
        env.setWeather('clear');
        player.health = 100;
        player.stamina = 100;
        this.hud.setFade(0);
        this.hud.toast('早安，體力已恢復');
      }
    }

    if (!this.paused) {
      const active = this.active;
      const action = this.#interaction();
      this.hud.setPrompt(action && active ? action.text : '');
      if (active && action && input.hit('KeyE')) action.run();

      player.update(dt, input, active);
      for (const v of this.vehicles) v.update(dt, input, env);
      if (player.vehicle) {
        player.pos.copy(player.vehicle.position);
        player.vehicle.updateCamera(dt, active ? input : IDLE_INPUT, this.camera);
      } else {
        player.updateCamera(dt);
      }
      this.weapons.update(dt, input, active);
      this.pickups.update(dt);
      this.audio.update(dt, this);
      for (const npc of this.npcs) npc.update(dt);
      this.wildlife.update(dt, this.pointScale);
    }
    this.worldInfo.update(dt, env, this.camera.position);
    this.props.update(env);
    this.#spotLights();

    this.camera.updateMatrixWorld();
    env.update(this.paused ? dt * 0.25 : dt, player.pos);
    this.campfire.update(dt, env);
    this.campfire.lightGrass(this.grass);
    this.water.update(dt, env);
    this.grass.update(dt, this.camera.position, player.pos, env);

    this.skyProbe.update(dt, env);
    this.terrain.uniforms.uTime.value += dt;
    this.terrain.uniforms.uCaustic.value = env.dayFactor * env.w.sun;
    this.renderer.info.reset();
    this.pipeline.render(dt);
    this.#measure(rawDt);
    this.hud.update(dt, this.statsDirty ? this.stats : null);
    this.statsDirty = false;
    input.endFrame();
  }

  /** 手電筒，以及把目前亮著的聚光燈（手電筒或車頭燈）餵給草的 shader */
  #spotLights() {
    const { player, car, torch } = this;
    torch.intensity = this.torchOn && !player.vehicle ? 110 : 0;
    const u = this.grass.uniforms;
    const light = torch.intensity > 0 ? torch : player.vehicle === car && car.headlight.intensity > 1 ? car.headlight : null;
    if (!light) {
      u.uSpotColor.value.setScalar(0);
      return;
    }
    light.getWorldPosition(u.uSpotPos.value);
    light.target.getWorldPosition(u.uSpotDir.value).sub(u.uSpotPos.value).normalize();
    u.uSpotColor.value.copy(light.color).multiplyScalar((light.intensity / Math.PI) * 0.7);
    u.uSpotCos.value.set(Math.cos(light.angle), Math.cos(light.angle * (1 - light.penumbra)));
  }

  /** FPS 統計與動態解析度：掉幀就降渲染解析度，有餘裕再慢慢升回來 */
  #measure(rawDt) {
    const a = this.acc;
    a.time += rawDt;
    a.frames++;
    if (a.time < 0.5) return;
    const fps = a.frames / a.time;
    const info = this.renderer.info.render;
    const q = QUALITY[this.qualityName];
    Object.assign(this.stats, {
      fps: Math.round(fps),
      ms: (a.time / a.frames) * 1000,
      calls: info.calls,
      triangles: info.triangles,
      blades: this.grass.bladeCount,
      quality: q.label,
      scale: Math.min(window.devicePixelRatio || 1, q.pixelRatio) * this.scale,
    });
    this.statsDirty = true;
    a.time = 0;
    a.frames = 0;

    // 剛啟動或剛換畫質時 shader 還在編譯，這段時間的掉幀不算數
    if (document.hidden || performance.now() < this.adaptAfter) return;
    a.slow = fps < 48 ? a.slow + 1 : 0;
    a.fast = fps > 56 ? a.fast + 1 : 0;
    let scale = this.scale;
    if (a.slow >= 2) scale = clamp(scale - 0.1, MIN_SCALE, 1);
    else if (a.fast >= 6) scale = clamp(scale + 0.05, MIN_SCALE, 1);
    if (scale !== this.scale) {
      this.scale = scale;
      a.slow = a.fast = 0;
      this.#resize();
    }
  }
}

const IDLE_INPUT = { mouseDX: 0, mouseDY: 0, hit: () => false };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const game = new Game(document.getElementById('game'), document.getElementById('hud'));
window.__game = game;
game.init().catch((err) => {
  console.error(err);
  game.hud.setLoading('初始化失敗：' + err.message);
});
