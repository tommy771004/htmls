// 程序生成賽博龐克夜城：6×6 大道網格、6 個命名行政區、68 棟多層退縮摩天大樓、霓虹招牌與全息廣告、
// 濕地面積水反射與雨滴漣漪 Shader，以及三棟可無縫步入的室內建築（PULSE 脈衝夜店、AFTERGLOW 餘燼酒吧、CHROME WORKS 改裝車庫）。
import * as THREE from 'three';
import { getStaticAsset, getCharacterInstance, findClip } from './assets.js';

export const ROADS = [-150, -90, -30, 30, 90, 150];
export const BLOCKS = [-120, -60, 0, 60, 120];
export const ROAD_WIDTH = 16;
export const CITY_HALF = 185;

export const DISTRICTS = [
  { id: 'neon_core', name: '霓虹中樞 · NEON CORE', sub: '中央商業與娛樂特區', x0: -45, x1: 45, z0: -45, z1: 45, color: '#00f2ff' },
  { id: 'ember_alley', name: '餘燼巷弄 · EMBER ALLEY', sub: '西側舊城夜市與地下酒吧街', x0: -185, x1: -45, z0: -60, z1: 60, color: '#ffaa00' },
  { id: 'chrome_hwy', name: '電馭車道 · CHROME SECTOR', sub: '東側高速環道與改裝工坊區', x0: 45, x1: 185, z0: -60, z1: 60, color: '#ff2bd6' },
  { id: 'corp_plaza', name: '財閥天際 · CORP PLAZA', sub: '北側巨型企業總部與全息塔群', x0: -185, x1: 185, z0: -185, z1: -45, color: '#38bdf8' },
  { id: 'rust_canal', name: '黑市船塢 · RUST CANAL', sub: '南側重工冷卻塔與貨櫃港區', x0: -185, x1: 45, z0: 45, z1: 185, color: '#00ff88' },
  { id: 'synth_heights', name: '合成住宅 · SYNTH HEIGHTS', sub: '東南高密度膠囊公寓城寨', x0: 45, x1: 185, z0: 45, z1: 185, color: '#a855f7' },
];

export const VENUES = [
  {
    id: 'nightclub',
    name: 'PULSE // 脈衝夜店',
    sub: '1F 電馭低音舞池 · DJ 舞台',
    district: '霓虹中樞 · NEON CORE',
    cx: 0,
    cz: 0,
    x0: -16,
    x1: 16,
    z0: -16,
    z1: 16,
    doorX: 0,
    doorZ: -17.5,
    doorYaw: 0,
    interactX: 0,
    interactZ: 9.0,
    interactRadius: 4.2,
    interactPrompt: '[E] 切換 DJ 舞台雷射與曲風 · [G] 加入舞池熱舞',
    color: '#ff2bd6',
    icon: '🎵',
  },
  {
    id: 'bar',
    name: 'AFTERGLOW // 餘燼酒吧',
    sub: '1F 琥珀吧台 · 街機沙龍',
    district: '餘燼巷弄 · EMBER ALLEY',
    cx: -60,
    cz: 0,
    x0: -75,
    x1: -45,
    z0: -15,
    z1: 15,
    doorX: -60,
    doorZ: -16.8,
    doorYaw: 0,
    interactX: -60,
    interactZ: 4.8,
    interactRadius: 4.0,
    interactPrompt: '[E] 向調酒師點一杯賽博特調 · [G] 隨音樂搖擺',
    color: '#ffaa00',
    icon: '🍸',
  },
  {
    id: 'garage',
    name: 'CHROME WORKS // 電馭改裝廠',
    sub: '1F 霓虹底盤與塗裝整備灣',
    district: '電馭車道 · CHROME SECTOR',
    cx: 60,
    cz: 0,
    x0: 46,
    x1: 74,
    z0: -15,
    z1: 15,
    doorX: 60,
    doorZ: -16.8,
    doorYaw: 0,
    interactX: 60,
    interactZ: 1.5,
    interactRadius: 5.0,
    interactPrompt: '[E] 切換座駕 V-TECH 霓虹光效與塗裝',
    color: '#00f2ff',
    icon: '🔧',
  },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 產生大樓玻璃帷幕與霓虹窗格貼圖
function createBuildingFacadeTexture(seed, accentHex) {
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#070a12';
  ctx.fillRect(0, 0, 256, 512);

  // 垂直金屬肋條與水平結構層
  ctx.fillStyle = '#101624';
  for (let x = 0; x < 256; x += 32) ctx.fillRect(x, 0, 4, 512);
  for (let y = 0; y < 512; y += 24) ctx.fillRect(0, y, 256, 4);

  const palettes = ['#00f2ff', '#ff2bd6', '#ffaa00', '#38bdf8', '#e0f2fe', accentHex];
  for (let row = 0; row < 20; row++) {
    const y = 8 + row * 25;
    const rowLitProb = 0.25 + rnd() * 0.45;
    for (let col = 0; col < 7; col++) {
      if (rnd() > rowLitProb) continue;
      const x = 8 + col * 35;
      const w = 22;
      const h = 14;
      const pick = rnd() < 0.55 ? '#8be9fd' : rnd() < 0.8 ? accentHex : palettes[Math.floor(rnd() * palettes.length)];
      ctx.fillStyle = pick;
      ctx.globalAlpha = 0.45 + rnd() * 0.55;
      ctx.fillRect(x, y, w, h);
      if (rnd() < 0.35) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.35;
        ctx.fillRect(x + 2, y + 2, w - 4, 4);
      }
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 產生全息廣告與巨型霓虹看板貼圖
function createBillboardTexture(title, sub, tag, bgHex, fgHex, accentHex) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, bgHex);
  grad.addColorStop(1, '#060812');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // 全息掃描線
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < 256; y += 6) ctx.fillRect(0, y, 512, 2);

  // 斜切霓虹邊框
  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 236);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 472, 216);

  // 幾何裝飾圓環
  ctx.beginPath();
  ctx.arc(420, 128, 64, 0, Math.PI * 2);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(420, 128, 42, 0.4, Math.PI * 1.7);
  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 4;
  ctx.stroke();

  // 標籤與主字體
  ctx.fillStyle = accentHex;
  ctx.font = 'bold 20px "SF Mono", Consolas, monospace';
  ctx.fillText(tag, 36, 56);

  ctx.shadowColor = fgHex;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 54px "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif';
  ctx.fillText(title, 34, 134);

  ctx.shadowColor = accentHex;
  ctx.shadowBlur = 12;
  ctx.fillStyle = fgHex;
  ctx.font = 'bold 28px "Segoe UI", "PingFang TC", sans-serif';
  ctx.fillText(sub, 36, 188);
  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 產生濕柏油路面與積水法線／粗糙度貼圖
function createWetRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0e17';
  ctx.fillRect(0, 0, 512, 512);

  const rnd = mulberry32(2088);
  // 柏油微粒與積水深色區塊
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const v = 10 + Math.floor(rnd() * 18);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
    ctx.fillRect(x, y, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 36);
  return tex;
}

export function buildCyberCity(scene) {
  const rnd = mulberry32(2592088);
  const cityGroup = new THREE.Group();
  cityGroup.name = 'cyber_city';
  scene.add(cityGroup);

  const colliders = []; // { x0, x1, z0, z1, h }
  const mapBuildings = []; // 小地圖顯示用 { x, z, w, d, color, isVenue }
  const holoSpinners = []; // 會旋轉的全息環與投影
  const danceTiles = []; // 夜店律動地磚
  const clubLasers = []; // 夜店雷射光束
  const npcMixers = []; // 人物骨架動畫 Mixer
  const shaderUniforms = { uTime: { value: 0 }, uClubTheme: { value: 0 } };

  // ==================== 1. 濕地面反射與道路網格 ====================
  const roadTex = createWetRoadTexture();
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x101522,
    map: roadTex,
    roughness: 0.16,
    metalness: 0.72,
  });
  groundMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderUniforms.uTime;
    shader.vertexShader =
      'varying vec3 vWorldPos;\n' +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader =
      'varying vec3 vWorldPos;\nuniform float uTime;\n' +
      shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float puddle = smoothstep(-0.15, 0.35, sin(vWorldPos.x * 0.17) * cos(vWorldPos.z * 0.19) + 0.5 * sin(vWorldPos.x * 0.43 + vWorldPos.z * 0.37));
        float ripple1 = sin(length(fract(vWorldPos.xz * 0.45) - 0.5) * 48.0 - uTime * 14.0);
        float ripple2 = sin(length(fract(vWorldPos.xz * 0.33 + 0.25) - 0.5) * 42.0 - uTime * 11.5);
        float ripple = (ripple1 + ripple2) * 0.5 * exp(-length(fract(vWorldPos.xz * 0.45) - 0.5) * 5.0) * puddle;
        roughnessFactor = mix(0.32, 0.045, puddle) + ripple * 0.03;
        `
      ).replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // 濕地面霓虹倒影光帶與車道標線
        float ax = abs(mod(vWorldPos.x + 30.0, 60.0) - 30.0);
        float az = abs(mod(vWorldPos.z + 30.0, 60.0) - 30.0);
        float onRoadX = step(ax, 8.0);
        float onRoadZ = step(az, 8.0);
        float centerLineX = smoothstep(0.18, 0.04, ax) * step(0.4, fract(vWorldPos.z * 0.12)) * (1.0 - onRoadZ);
        float centerLineZ = smoothstep(0.18, 0.04, az) * step(0.4, fract(vWorldPos.x * 0.12)) * (1.0 - onRoadX);
        float edgeLineX = smoothstep(0.22, 0.06, abs(ax - 7.4)) * (1.0 - onRoadZ);
        float edgeLineZ = smoothstep(0.22, 0.06, abs(az - 7.4)) * (1.0 - onRoadX);
        vec3 roadPaint = vec3(0.0, 0.85, 1.0) * (centerLineX + centerLineZ) * 0.75
                       + vec3(1.0, 0.18, 0.68) * (edgeLineX + edgeLineZ) * 0.55;
        // 積水倒影霓虹天光
        float neonStreak = pow(max(0.0, sin(vWorldPos.x * 0.08) * cos(vWorldPos.z * 0.08)), 2.0);
        vec3 wetReflect = mix(vec3(0.0, 0.42, 0.65), vec3(0.75, 0.08, 0.52), sin(vWorldPos.x * 0.03 + vWorldPos.z * 0.02) * 0.5 + 0.5);
        totalEmissiveRadiance += roadPaint + wetReflect * neonStreak * 0.36;
        `
      );
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  cityGroup.add(ground);

  // 人行道高台底座（每個街區 42m × 42m，高 0.16m，邊緣帶發光導角）
  const sidewalkGeo = new THREE.BoxGeometry(42, 0.16, 42);
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.45, metalness: 0.35 });
  const curbGlowGeo = new THREE.BoxGeometry(42.3, 0.06, 42.3);
  const curbGlowMat = new THREE.MeshBasicMaterial({ color: 0x00a8cc });
  const swCount = BLOCKS.length * BLOCKS.length;
  const swInst = new THREE.InstancedMesh(sidewalkGeo, sidewalkMat, swCount);
  const curbInst = new THREE.InstancedMesh(curbGlowGeo, curbGlowMat, swCount);
  const dummy = new THREE.Object3D();
  let swIdx = 0;
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      // 可進入場館所在的街區地面降低，避免門檻卡腳
      const isVenueBlock = (bx === 0 && bz === 0) || (bx === -60 && bz === 0) || (bx === 60 && bz === 0);
      dummy.position.set(bx, isVenueBlock ? 0.01 : 0.08, bz);
      dummy.scale.set(1, isVenueBlock ? 0.12 : 1, 1);
      dummy.updateMatrix();
      swInst.setMatrixAt(swIdx, dummy.matrix);
      dummy.position.set(bx, 0.03, bz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      curbInst.setMatrixAt(swIdx, dummy.matrix);
      swIdx++;
    }
  }
  cityGroup.add(swInst, curbInst);

  // ==================== 2. 預建四套大樓帷幕與六套全息看板材質 ====================
  const facadeMats = [
    '#00f2ff',
    '#ff2bd6',
    '#ffaa00',
    '#00ff88',
  ].map((col, i) => {
    const tex = createBuildingFacadeTexture(100 + i * 37, col);
    return new THREE.MeshStandardMaterial({
      color: 0x182032,
      map: tex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: tex,
      emissiveIntensity: 1.45,
      roughness: 0.25,
      metalness: 0.65,
    });
  });

  const billboardDefs = [
    ['夜城 // 2088', 'NEON NIGHT CITY', 'DISTRICT // 01', '#081c38', '#00f2ff', '#ff2bd6'],
    ['パルス夜店', 'CLUB PULSE // 124 BPM', 'LIVE DJ TONIGHT', '#29082e', '#ff2bd6', '#00f2ff'],
    ['餘燼酒吧', 'AFTERGLOW CYBER BAR', 'SYNTH COCKTAILS', '#2c1506', '#ffaa00', '#ff2bd6'],
    ['狐火生技', 'KITSUNE BIOTECH', 'NEURAL OPTICS V4', '#062624', '#00ff88', '#00f2ff'],
    ['荒坂重工', 'CORP SECURITY // AV-9', 'OBEY THE GRID', '#1f0b18', '#ff3366', '#ffaa00'],
    ['電脳コーラ', 'SYNTH-COLA ZERO', 'TASTE THE VOLTAGE', '#0c163b', '#38bdf8', '#facc15'],
  ];
  const billboardMats = billboardDefs.map(
    ([t, s, tag, bg, fg, ac]) =>
      new THREE.MeshBasicMaterial({
        map: createBillboardTexture(t, s, tag, bg, fg, ac),
        side: THREE.DoubleSide,
      })
  );

  const neonTrimMats = [
    new THREE.MeshBasicMaterial({ color: 0x00f2ff }),
    new THREE.MeshBasicMaterial({ color: 0xff2bd6 }),
    new THREE.MeshBasicMaterial({ color: 0xffaa00 }),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
    new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
  ];
  const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x0e131f, roughness: 0.4, metalness: 0.7 });

  // ==================== 3. 建造三座可無縫步入的室內建築 ====================
  buildPulseNightclub(cityGroup, colliders, mapBuildings, danceTiles, clubLasers, npcMixers, shaderUniforms, billboardMats[1]);
  buildAfterglowBar(cityGroup, colliders, mapBuildings, npcMixers, billboardMats[2]);
  buildChromeGarage(cityGroup, colliders, mapBuildings, holoSpinners, billboardMats[3]);

  // ==================== 4. 建造其餘街區的摩天大樓、全息天橋與巨型投影 ====================
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if ((bx === 0 && bz === 0) || (bx === -60 && bz === 0) || (bx === 60 && bz === 0)) {
        // 在三座可進入場館上方兩側加上高空懸挑塔樓（不阻擋 1F 室內，卻讓天際線高聳壯觀）
        buildUpperSkybridgeTowers(cityGroup, bx, bz, facadeMats, neonTrimMats, holoSpinners);
        continue;
      }

      // 每個街區依距離市中心決定高度，切分為 2～4 棟錯落的高樓
      const distCenter = Math.hypot(bx, bz);
      const baseH = distCenter < 90 ? 62 : 36;
      const subPlots = [
        [-9.5, -9.5, 16, 16],
        [9.5, -9.5, 16, 16],
        [-9.5, 9.5, 16, 16],
        [9.5, 9.5, 16, 16],
      ];

      for (let pi = 0; pi < subPlots.length; pi++) {
        const [ox, oz, pw, pd] = subPlots[pi];
        const tx = bx + ox;
        const tz = bz + oz;
        const h = Math.round(baseH + rnd() * 54);
        const fMat = facadeMats[(Math.abs(bx + bz) + pi) % facadeMats.length];
        const nMat = neonTrimMats[(Math.abs(bx * 3 + bz) + pi) % neonTrimMats.length];

        // 主塔身
        const tower = new THREE.Mesh(new THREE.BoxGeometry(pw, h, pd), fMat);
        tower.position.set(tx, h / 2, tz);
        cityGroup.add(tower);

        // 退縮上層塔冠
        const h2 = Math.round(h * (0.22 + rnd() * 0.16));
        const crown = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.72, h2, pd * 0.72), fMat);
        crown.position.set(tx, h + h2 / 2, tz);
        cityGroup.add(crown);

        // 塔頂發光霓虹框與通訊尖塔
        const rim = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.35, 0.55, pd + 0.35), nMat);
        rim.position.set(tx, h - 0.5, tz);
        cityGroup.add(rim);

        const rim2 = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.74, 0.45, pd * 0.74), nMat);
        rim2.position.set(tx, h + h2 - 0.3, tz);
        cityGroup.add(rim2);

        if (rnd() < 0.65) {
          const spireH = 8 + rnd() * 14;
          const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, spireH, 6), darkRoofMat);
          spire.position.set(tx, h + h2 + spireH / 2, tz);
          cityGroup.add(spire);
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), nMat);
          beacon.position.set(tx, h + h2 + spireH, tz);
          cityGroup.add(beacon);
        }

        // 外牆巨型全息廣告牌（面向鄰近道路）
        if (rnd() < 0.78) {
          const bMat = billboardMats[Math.floor(rnd() * billboardMats.length)];
          const bh = 6.5 + rnd() * 4.5;
          const bw = pw * 0.88;
          const by = 11 + rnd() * Math.max(8, h - 22);
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bMat);
          if (pi < 2) {
            sign.position.set(tx, by, tz - pd / 2 - 0.25);
            sign.rotation.y = Math.PI;
          } else {
            sign.position.set(tx, by, tz + pd / 2 + 0.25);
          }
          cityGroup.add(sign);
        }

        // Blender 直立漢字霓虹招牌（neon_sign_kanji）掛在街角
        if (rnd() < 0.55) {
          const kanji = getStaticAsset('street_props', 'neon_sign_kanji');
          const sideX = ox < 0 ? tx - pw / 2 - 0.6 : tx + pw / 2 + 0.6;
          kanji.position.set(sideX, 5.5 + rnd() * 6.0, tz);
          if (ox > 0) kanji.rotation.y = Math.PI;
          cityGroup.add(kanji);
        }

        colliders.push({ x0: tx - pw / 2, x1: tx + pw / 2, z0: tz - pd / 2, z1: tz + pd / 2, h });
        mapBuildings.push({
          x: tx,
          z: tz,
          w: pw,
          d: pd,
          color: ['#1e3a5f', '#3b1d4a', '#2d3748', '#1a3636'][(Math.abs(bx + bz) + pi) % 4],
          isVenue: false,
        });
      }

      // 街區轉角配置自動販賣機、蒸氣排氣井與防撞柱
      const vm = getStaticAsset('street_props', 'vending_machine');
      vm.position.set(bx - 18.2, 0.16, bz - 18.2);
      cityGroup.add(vm);

      const sv = getStaticAsset('street_props', 'steam_vent');
      sv.position.set(bx + 18.0, 0.16, bz - 18.5);
      cityGroup.add(sv);

      const bol = getStaticAsset('street_props', 'bollards_barrier');
      bol.position.set(bx, 0.16, bz - 19.8);
      cityGroup.add(bol);
    }
  }

  // ==================== 5. 跨街高空霓虹天橋與路燈體積光 ====================
  buildStreetLampsAndBridges(cityGroup, billboardMats, neonTrimMats, holoSpinners);

  return {
    cityGroup,
    colliders,
    mapBuildings,
    holoSpinners,
    danceTiles,
    clubLasers,
    npcMixers,
    shaderUniforms,
  };
}

// 在三座場館上方建立懸挑雙子巨塔與旋轉全息環，不擋住一樓內部動線
function buildUpperSkybridgeTowers(cityGroup, bx, bz, facadeMats, neonTrimMats, holoSpinners) {
  const fMat = facadeMats[Math.abs(bx / 60) % facadeMats.length];
  const nMat = neonTrimMats[Math.abs(bx / 60) % neonTrimMats.length];
  // 高度 18m 以上的巨型懸空橋塔
  const overTower = new THREE.Mesh(new THREE.BoxGeometry(28, 56, 18), fMat);
  overTower.position.set(bx, 46, bz + 4);
  cityGroup.add(overTower);

  const rim = new THREE.Mesh(new THREE.BoxGeometry(28.6, 0.8, 18.6), nMat);
  rim.position.set(bx, 74, bz + 4);
  cityGroup.add(rim);

  // 屋頂懸浮全息雙環
  const ringGrp = new THREE.Group();
  ringGrp.position.set(bx, 82, bz + 4);
  const r1 = new THREE.Mesh(
    new THREE.TorusGeometry(7.5, 0.28, 8, 32),
    new THREE.MeshBasicMaterial({ color: bx === 0 ? 0xff2bd6 : bx < 0 ? 0xffaa00 : 0x00f2ff })
  );
  r1.rotation.x = Math.PI / 2;
  const r2 = new THREE.Mesh(
    new THREE.TorusGeometry(5.2, 0.22, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0x00f2ff })
  );
  r2.rotation.y = Math.PI / 3;
  ringGrp.add(r1, r2);
  cityGroup.add(ringGrp);
  holoSpinners.push(ringGrp);
}

// ==================== 場館 1：PULSE // 脈衝夜店（0, 0） ====================
function buildPulseNightclub(cityGroup, colliders, mapBuildings, danceTiles, clubLasers, npcMixers, shaderUniforms, signMat) {
  const club = new THREE.Group();
  club.name = 'venue_nightclub';
  cityGroup.add(club);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d101c, roughness: 0.35, metalness: 0.7 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x090b14, roughness: 0.18, metalness: 0.8 });
  const neonMag = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
  const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f2ff });

  // 室內黑曜石鏡面地板（32m × 32m）
  const floor = new THREE.Mesh(new THREE.BoxGeometry(32, 0.1, 32), floorMat);
  floor.position.set(0, 0.05, 0);
  club.add(floor);

  // 天花板（高 8.5m）與外牆（北側 z=-16 留出 7m 寬大門 x ∈ [-3.5, 3.5]）
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(32, 0.6, 32), wallMat);
  ceiling.position.set(0, 8.8, 0);
  club.add(ceiling);

  const walls = [
    // 西牆 x = -16
    { x: -15.7, z: 0, w: 0.6, d: 32, h: 8.6 },
    // 東牆 x = +16
    { x: 15.7, z: 0, w: 0.6, d: 32, h: 8.6 },
    // 南牆（DJ 舞台背牆）z = +16
    { x: 0, z: 15.7, w: 32, d: 0.6, h: 8.6 },
    // 北牆左翼 x ∈ [-16, -3.5], z = -15.7
    { x: -9.75, z: -15.7, w: 12.5, d: 0.6, h: 8.6 },
    // 北牆右翼 x ∈ [3.5, 16], z = -15.7
    { x: 9.75, z: -15.7, w: 12.5, d: 0.6, h: 8.6 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
    m.position.set(w.x, w.h / 2, w.z);
    club.add(m);
    colliders.push({ x0: w.x - w.w / 2, x1: w.x + w.w / 2, z0: w.z - w.d / 2, z1: w.z + w.d / 2, h: w.h });
  }

  // 大門上方門楣與巨型「PULSE // 脈衝夜店」霓虹拱門
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.8, 0.7), wallMat);
  lintel.position.set(0, 6.7, -15.7);
  club.add(lintel);

  const archTop = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.35, 1.1), neonMag);
  archTop.position.set(0, 4.75, -16.0);
  const archL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.8, 1.1), neonCyan);
  archL.position.set(-3.8, 2.4, -16.0);
  const archR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.8, 1.1), neonCyan);
  archR.position.set(3.8, 2.4, -16.0);
  club.add(archTop, archL, archR);

  // 正門外巨型全息招牌
  const clubSign = new THREE.Mesh(new THREE.PlaneGeometry(14, 5.2), signMat);
  clubSign.position.set(0, 11.2, -16.25);
  clubSign.rotation.y = Math.PI;
  club.add(clubSign);

  // 8×8 音訊律動 LED 舞池地磚
  const tileGeo = new THREE.BoxGeometry(1.22, 0.08, 1.22);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const tMat = new THREE.MeshBasicMaterial({ color: (r + c) % 2 === 0 ? 0x00f2ff : 0xff2bd6 });
      const tile = new THREE.Mesh(tileGeo, tMat);
      tile.position.set(-4.55 + c * 1.3, 0.11, -3.5 + r * 1.3);
      club.add(tile);
      danceTiles.push({ mesh: tile, r, c });
    }
  }

  // Blender 資產：DJ 主控台、四座重低音音箱塔、頂部雷射燈架、四組 VIP 卡座
  const djBooth = getStaticAsset('interior_props', 'dj_booth');
  djBooth.position.set(0, 0.1, 11.2);
  djBooth.rotation.y = Math.PI; // 面向 -Z 舞池
  club.add(djBooth);
  colliders.push({ x0: -2.2, x1: 2.2, z0: 9.8, z1: 12.6, h: 2.0 });

  for (const sx of [-5.2, -3.4, 3.4, 5.2]) {
    const spk = getStaticAsset('interior_props', 'speaker_stack');
    spk.position.set(sx, 0.1, 11.8);
    spk.rotation.y = Math.PI;
    club.add(spk);
  }

  const laserRig = getStaticAsset('interior_props', 'laser_rig');
  laserRig.position.set(0, 6.8, 1.2);
  club.add(laserRig);

  // 8 道動態掃描體積雷射光束（AdditiveBlending）
  const beamGeo = new THREE.CylinderGeometry(0.03, 0.85, 8.2, 10, 1, true);
  beamGeo.translate(0, -4.1, 0);
  for (let i = 0; i < 8; i++) {
    const bMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0x00f2ff : 0xff2bd6,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, bMat);
    const a = (i / 8) * Math.PI * 2;
    beam.position.set(Math.cos(a) * 2.4, 6.7, 1.2 + Math.sin(a) * 2.4);
    club.add(beam);
    clubLasers.push({ mesh: beam, phase: i * 0.8 });
  }

  // VIP 霓虹卡座沙發
  for (const [vx, vz, vyaw] of [
    [-11.2, -3.5, Math.PI / 2],
    [-11.2, 4.5, Math.PI / 2],
    [11.2, -3.5, -Math.PI / 2],
    [11.2, 4.5, -Math.PI / 2],
  ]) {
    const vip = getStaticAsset('interior_props', 'club_table');
    vip.position.set(vx, 0.1, vz);
    vip.rotation.y = vyaw;
    club.add(vip);
  }

  // 夜店室內主點光源
  const clubLight1 = new THREE.PointLight(0xff2bd6, 35, 22, 1.5);
  clubLight1.position.set(0, 5.5, 1.5);
  const clubLight2 = new THREE.PointLight(0x00f2ff, 28, 18, 1.5);
  clubLight2.position.set(0, 4.2, 10.2);
  club.add(clubLight1, clubLight2);

  // 14 名舞池熱舞人群 + 1 名舞台 DJ（全部具備 Blender 骨架動畫）
  const dancerPositions = [
    [0.0, 11.4, Math.PI, 'dance_hype', '#00f2ff'], // DJ
    [-2.4, -1.2, 0.3, 'dance_groove', '#ff2bd6'],
    [2.3, -1.0, -0.4, 'dance_hype', '#00f2ff'],
    [-0.8, 0.8, 0.1, 'dance_groove', '#ffaa00'],
    [1.2, 1.4, -0.2, 'dance_hype', '#00ff88'],
    [-3.2, 2.2, 0.5, 'dance_hype', '#a855f7'],
    [3.1, 2.5, -0.5, 'dance_groove', '#ff2bd6'],
    [-1.6, 3.8, 0.2, 'dance_groove', '#00f2ff'],
    [1.8, 4.1, -0.3, 'dance_hype', '#ffaa00'],
    [0.0, -2.2, 0.0, 'dance_hype', '#00ff88'],
    [-3.8, -0.2, 0.8, 'dance_groove', '#00f2ff'],
    [3.8, 0.2, -0.8, 'dance_hype', '#ff2bd6'],
    [-8.5, -3.2, 1.4, 'dance_groove', '#ffaa00'],
    [8.5, 4.2, -1.4, 'dance_groove', '#a855f7'],
    [0.2, 5.6, 0.0, 'dance_hype', '#00f2ff'],
  ];

  dancerPositions.forEach(([dx, dz, dyaw, clipName, tint], idx) => {
    const { obj, clips } = getCharacterInstance(tint);
    obj.position.set(dx, idx === 0 ? 0.55 : 0.1, dz);
    obj.rotation.y = dyaw;
    club.add(obj);
    const clip = findClip(clips, clipName) || clips[0];
    if (clip) {
      const mixer = new THREE.AnimationMixer(obj);
      const act = mixer.clipAction(clip);
      act.time = (idx * 0.27) % clip.duration;
      act.timeScale = 0.95 + (idx % 3) * 0.06;
      act.play();
      npcMixers.push(mixer);
    }
  });

  mapBuildings.push({ x: 0, z: 0, w: 32, d: 32, color: '#ff2bd6', isVenue: true, name: 'PULSE 夜店' });
}

// ==================== 場館 2：AFTERGLOW // 餘燼酒吧（-60, 0） ====================
function buildAfterglowBar(cityGroup, colliders, mapBuildings, npcMixers, signMat) {
  const bar = new THREE.Group();
  bar.name = 'venue_bar';
  cityGroup.add(bar);

  const cx = -60;
  const cz = 0;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1215, roughness: 0.42, metalness: 0.55 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x241612, roughness: 0.28, metalness: 0.45 });
  const neonAmber = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const neonMag = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 30), floorMat);
  floor.position.set(cx, 0.05, cz);
  bar.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 30), wallMat);
  ceiling.position.set(cx, 7.6, cz);
  bar.add(ceiling);

  // 北牆 z = -15 開設 7m 寬迎賓門（x ∈ [-63.5, -56.5]）
  const walls = [
    { x: cx - 14.7, z: cz, w: 0.6, d: 30, h: 7.4 },
    { x: cx + 14.7, z: cz, w: 0.6, d: 30, h: 7.4 },
    { x: cx, z: cz + 14.7, w: 30, d: 0.6, h: 7.4 },
    { x: cx - 9.25, z: cz - 14.7, w: 11.5, d: 0.6, h: 7.4 },
    { x: cx + 9.25, z: cz - 14.7, w: 11.5, d: 0.6, h: 7.4 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
    m.position.set(w.x, w.h / 2, w.z);
    bar.add(m);
    colliders.push({ x0: w.x - w.w / 2, x1: w.x + w.w / 2, z0: w.z - w.d / 2, z1: w.z + w.d / 2, h: w.h });
  }

  // 琥珀霓虹雨棚與酒吧招牌
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.35, 1.6), neonAmber);
  canopy.position.set(cx, 4.4, cz - 15.4);
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.4, 0.9), neonMag);
  frameL.position.set(cx - 3.7, 2.2, cz - 15.0);
  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.4, 0.9), neonMag);
  frameR.position.set(cx + 3.7, 2.2, cz - 15.0);
  bar.add(canopy, frameL, frameR);

  const barSign = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.8), signMat);
  barSign.position.set(cx, 9.8, cz - 15.2);
  barSign.rotation.y = Math.PI;
  bar.add(barSign);

  // Blender 資產：發光長吧台、酒架牆、6 張高腳椅、3 台街機、全息點唱機、卡座
  const counter = getStaticAsset('interior_props', 'bar_counter');
  counter.position.set(cx, 0.1, cz + 7.5);
  counter.rotation.y = Math.PI;
  bar.add(counter);
  colliders.push({ x0: cx - 2.8, x1: cx + 2.8, z0: cz + 6.8, z1: cz + 8.3, h: 1.4 });

  const rack = getStaticAsset('interior_props', 'bottle_rack');
  rack.position.set(cx, 0.1, cz + 11.8);
  rack.rotation.y = Math.PI;
  bar.add(rack);

  for (let i = 0; i < 5; i++) {
    const stool = getStaticAsset('interior_props', 'bar_stool');
    stool.position.set(cx - 2.0 + i * 1.0, 0.1, cz + 5.7);
    bar.add(stool);
  }

  for (let i = 0; i < 3; i++) {
    const cab = getStaticAsset('interior_props', 'arcade_cab');
    cab.position.set(cx - 12.6, 0.1, cz - 5.0 + i * 2.4);
    cab.rotation.y = -Math.PI / 2;
    bar.add(cab);
  }

  const juke = getStaticAsset('interior_props', 'jukebox');
  juke.position.set(cx + 12.4, 0.1, cz - 4.0);
  juke.rotation.y = Math.PI / 2;
  bar.add(juke);

  for (const vz of [-3.5, 3.5]) {
    const booth = getStaticAsset('interior_props', 'club_table');
    booth.position.set(cx + 9.8, 0.1, cz + vz);
    booth.rotation.y = -Math.PI / 2;
    bar.add(booth);
  }

  // 溫暖琥珀與洋紅室內光源
  const barLight = new THREE.PointLight(0xff9922, 32, 22, 1.5);
  barLight.position.set(cx, 4.8, cz + 4.0);
  bar.add(barLight);

  // 調酒師（bartend 動作）與 5 名酒客
  const barCast = [
    [cx, cz + 9.2, Math.PI, 'bartend', '#ffaa00'], // 調酒師
    [cx - 1.0, cz + 5.1, 0.0, 'idle', '#00f2ff'],
    [cx + 1.0, cz + 5.1, 0.0, 'idle', '#ff2bd6'],
    [cx - 11.2, cz - 2.6, -Math.PI / 2, 'idle', '#00ff88'],
    [cx + 7.2, cz - 3.2, 0.6, 'dance_groove', '#ffaa00'],
    [cx + 10.6, cz - 4.0, -1.2, 'idle', '#a855f7'],
  ];
  barCast.forEach(([px, pz, pyaw, clipName, tint], idx) => {
    const { obj, clips } = getCharacterInstance(tint);
    obj.position.set(px, 0.1, pz);
    obj.rotation.y = pyaw;
    bar.add(obj);
    const clip = findClip(clips, clipName) || clips[0];
    if (clip) {
      const mixer = new THREE.AnimationMixer(obj);
      const act = mixer.clipAction(clip);
      act.time = idx * 0.4;
      act.play();
      npcMixers.push(mixer);
    }
  });

  mapBuildings.push({ x: cx, z: cz, w: 30, d: 30, color: '#ffaa00', isVenue: true, name: 'AFTERGLOW 酒吧' });
}

// ==================== 場館 3：CHROME WORKS // 電馭改裝廠（+60, 0） ====================
function buildChromeGarage(cityGroup, colliders, mapBuildings, holoSpinners, signMat) {
  const gar = new THREE.Group();
  gar.name = 'venue_garage';
  cityGroup.add(gar);

  const cx = 60;
  const cz = 0;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x101824, roughness: 0.35, metalness: 0.78 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x141d2b, roughness: 0.22, metalness: 0.68 });
  const neonCyan = new THREE.MeshBasicMaterial({ color: 0x00f2ff });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 0.1, 30), floorMat);
  floor.position.set(cx, 0.05, cz);
  gar.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(28, 0.6, 30), wallMat);
  ceiling.position.set(cx, 7.8, cz);
  gar.add(ceiling);

  // 北側留出 9m 寬車道門（可直接把車開進去或走進去！）
  const walls = [
    { x: cx - 13.7, z: cz, w: 0.6, d: 30, h: 7.6 },
    { x: cx + 13.7, z: cz, w: 0.6, d: 30, h: 7.6 },
    { x: cx, z: cz + 14.7, w: 28, d: 0.6, h: 7.6 },
    { x: cx - 9.25, z: cz - 14.7, w: 9.5, d: 0.6, h: 7.6 },
    { x: cx + 9.25, z: cz - 14.7, w: 9.5, d: 0.6, h: 7.6 },
  ];
  for (const w of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
    m.position.set(w.x, w.h / 2, w.z);
    gar.add(m);
    colliders.push({ x0: w.x - w.w / 2, x1: w.x + w.w / 2, z0: w.z - w.d / 2, z1: w.z + w.d / 2, h: w.h });
  }

  const arch = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.4, 1.2), neonCyan);
  arch.position.set(cx, 4.8, cz - 15.0);
  gar.add(arch);

  const garSign = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.8), signMat);
  garSign.position.set(cx, 9.8, cz - 15.2);
  garSign.rotation.y = Math.PI;
  gar.add(garSign);

  // 整備灣全息掃描環與投影機
  const holo = getStaticAsset('street_props', 'holo_projector');
  holo.position.set(cx, 0.1, cz + 6.5);
  gar.add(holo);

  const scanRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.1, 8, 28), neonCyan);
  scanRing.rotation.x = Math.PI / 2;
  scanRing.position.set(cx, 2.2, cz + 1.5);
  gar.add(scanRing);
  holoSpinners.push(scanRing);

  const garLight = new THREE.PointLight(0x00f2ff, 30, 22, 1.5);
  garLight.position.set(cx, 5.2, cz);
  gar.add(garLight);

  mapBuildings.push({ x: cx, z: cz, w: 28, d: 30, color: '#00f2ff', isVenue: true, name: 'CHROME 改裝廠' });
}

// ==================== 街道雙懸臂路燈、體積光錐與跨街全息門廊 ====================
function buildStreetLampsAndBridges(cityGroup, billboardMats, neonTrimMats, holoSpinners) {
  const lampConeGeo = new THREE.ConeGeometry(3.8, 6.2, 14, 1, true);
  lampConeGeo.translate(0, -3.1, 0);
  const lampConeMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.085,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // 沿主要大道擺設 Blender 建模路燈與體積光錐
  for (const rx of [-90, -30, 30, 90]) {
    for (const rz of [-120, -60, 0, 60, 120]) {
      for (const side of [-1, 1]) {
        const lamp = getStaticAsset('street_props', 'street_lamp');
        lamp.position.set(rx + side * 9.2, 0.0, rz);
        lamp.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
        cityGroup.add(lamp);

        const cone = new THREE.Mesh(lampConeGeo, lampConeMat);
        cone.position.set(rx + side * 7.6, 5.95, rz);
        cityGroup.add(cone);
      }
    }
  }

  // 橫跨大道的全息拱門（Gantry Bridges）
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x151c2c, roughness: 0.35, metalness: 0.8 });
  const gantryCoords = [
    [0, -30, 0],
    [-60, -30, 0],
    [60, -30, 0],
    [-30, 0, Math.PI / 2],
    [30, 0, Math.PI / 2],
  ];
  gantryCoords.forEach(([gx, gz, gyaw], i) => {
    const g = new THREE.Group();
    g.position.set(gx, 0, gz);
    g.rotation.y = gyaw;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 20), gantryMat);
    beam.position.set(0, 11.5, 0);
    const pL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 11.5, 0.9), gantryMat);
    pL.position.set(0, 5.75, -9.5);
    const pR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 11.5, 0.9), gantryMat);
    pR.position.set(0, 5.75, 9.5);
    const neonBar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.25, 19.6), neonTrimMats[i % neonTrimMats.length]);
    neonBar.position.set(0, 10.7, 0);
    const holoBanner = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.6), billboardMats[i % billboardMats.length]);
    holoBanner.position.set(0.75, 13.8, 0);
    holoBanner.rotation.y = Math.PI / 2;
    g.add(beam, pL, pR, neonBar, holoBanner);
    cityGroup.add(g);
  });
}

// 取得座標所在的行政區與室內場館資訊
export function queryLocation(x, z) {
  for (const v of VENUES) {
    if (x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1) {
      return {
        district: v.district,
        venue: v,
        title: v.name,
        sub: v.sub,
        color: v.color,
        inside: true,
      };
    }
  }
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) {
      return {
        district: d.name,
        venue: null,
        title: d.name,
        sub: d.sub,
        color: d.color,
        inside: false,
      };
    }
  }
  return {
    district: '夜城外環 · OUTER RING',
    venue: null,
    title: '夜城外環 · OUTER RING',
    sub: '環城高速幹道',
    color: '#00f2ff',
    inside: false,
  };
}

export function buildCity(scene) {
  const built = buildCyberCity(scene);
  return {
    ...built,
    districts: DISTRICTS,
    venues: VENUES,
    getDistrictAt(x, z) {
      for (const d of DISTRICTS) {
        if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
      }
      return DISTRICTS[0];
    },
    getVenueAt(x, z) {
      for (const v of VENUES) {
        if (x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1) return v;
      }
      return null;
    },
    getNearbyVenue(x, z, maxDist = 14) {
      let best = null;
      let bestD = maxDist;
      for (const v of VENUES) {
        const d = Math.hypot(x - v.doorX, z - v.doorZ);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      return best;
    },
  };
}

