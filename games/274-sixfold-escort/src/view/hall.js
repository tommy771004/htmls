// 六器鏢行 — 開場舞台：順安鏢局大堂（室內木柱、橫樑、掛鏢旗、兵器架、櫃台、燈籠暖光、匾額「順安鏢局」）
//
// 大堂放在遠離地圖的 HALL_ORIGIN，開場時隱藏地圖、鏡頭平視；主角站在畫面左中，右側留給介面的入局帖。
// 直式手機：主角改在畫面中上，下面讓給入局帖。
import * as THREE from 'three';
import { Kit, T, rng, textTexture, decalMaterial } from './kit.js';
import { hangingLantern, lattice, flipGeo, pennantMesh, crate } from './scenery.js';
import { makeWeapon } from './weapons.js';
import { roofGeo } from './kit.js';
import { Batch } from './assets.js';

export const HALL_ORIGIN = new THREE.Vector3(0, 0, 400);

export function buildIntroHall() {
  const group = new THREE.Group();
  group.position.copy(HALL_ORIGIN);
  const k = new Kit(201);
  const top = new Kit(202); // 天花、樑：不投影（當作天光從高窗進來）
  const R = rng(203);
  const mb = new Batch('hall-models'); // 匯入的家具與器物（assets.js）
  const W = 16, D = 12, H = 5.6;
  const Z0 = -5.2; // 後牆

  // 地面：方磚（略有高低與色差）
  for (let x = -W / 2; x < W / 2; x += 0.8) {
    for (let z = Z0; z < 7; z += 0.8) {
      const c = R() > 0.5 ? 0x5e5850 : 0x544e47;
      k.box('stone', c, 0.78, 0.1, 0.78, T(x + 0.4, -0.05 + R() * 0.008, z + 0.4), 0.06);
    }
  }
  // 後牆：木板壁＋兩扇高窗（窗紙透暖光）
  k.box('woodDark', 0x3a2618, W, H, 0.2, T(0, H / 2, Z0 - 0.1));
  for (let x = -W / 2 + 0.6; x < W / 2; x += 1.2) k.box('wood', 0x4a3020, 0.08, H, 0.06, T(x, H / 2, Z0 + 0.02));
  for (const sx of [-1, 1]) lattice(k, sx * 5.2, 1.4, Z0 + 0.06, 2.4, 2.4, 0x2a1a10, 6);
  k.box('paper', 0x8a6a3a, 2.4, 2.4, 0.01, T(-5.2, 2.6, Z0 + 0.0));
  k.box('paper', 0x8a6a3a, 2.4, 2.4, 0.01, T(5.2, 2.6, Z0 + 0.0));
  // 側牆
  for (const sx of [-1, 1]) {
    k.box('stone', 0xbfb39a, 0.2, H, D, T(sx * W / 2, H / 2, Z0 + D / 2));
    k.box('wood', 0x4a3020, 0.24, 0.9, D, T(sx * (W / 2 - 0.02), 0.45, Z0 + D / 2));
  }
  // 柱與橫樑
  for (const x of [-4.4, 4.4, -7.6, 7.6]) {
    for (const z of [Z0 + 0.6, 0.6, 5.0]) {
      if (Math.abs(x) > 7 && z > 4) continue;
      k.cyl('wood', 0x6e2418, 0.22, 0.24, H, 14, T(x, H / 2, z));
      k.cyl('stone', 0x7a746a, 0.34, 0.36, 0.22, 14, T(x, 0.11, z));
      top.box('wood', 0x3a2618, 0.6, 0.3, 0.6, T(x, H - 0.15, z));
    }
  }
  for (const z of [Z0 + 0.6, 0.6, 5.0]) {
    top.box('wood', 0x5a1e14, W, 0.5, 0.36, T(0, H + 0.1, z));
    top.box('wood', 0x2f4a46, W, 0.16, 0.38, T(0, H - 0.22, z));
  }
  for (let x = -W / 2 + 0.4; x < W / 2; x += 0.7) top.box('wood', 0x3a2618, 0.14, 0.14, D + 1, T(x, H + 0.45, Z0 + D / 2));
  top.box('woodDark', 0x2a1a10, W, 0.06, D + 1, T(0, H + 0.56, Z0 + D / 2));

  // 匾額「順安鏢局」：掛在後牆正中
  const plaqueTex = textTexture('順安鏢局', { w: 900, h: 240, bg: '#1d1814', fg: '#d9b35a', border: '#b08d48', size: 0.66 });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.22), decalMaterial(plaqueTex, { alphaTest: 0, emissive: 0.05 }));
  plaque.position.set(0, 4.25, Z0 + 0.2);
  group.add(plaque);
  k.box('wood', 0xb08d48, 4.9, 1.5, 0.08, T(0, 4.25, Z0 + 0.12));
  // 匾下：條案（翹頭案）上一只掐絲琺瑯香爐、一對青花瓶；案前一張方桌、兩把官帽椅；兩側對聯木牌、靠牆一對書櫃
  mb.add('hall_console_table', 0, 0, Z0 + 0.42, 0, 1.55);
  mb.add('censer_ding', 0, 1.02, Z0 + 0.42, 0, 0.62);
  for (const sx of [-1, 1]) mb.add('vase_blue', sx * 0.95, 1.02, Z0 + 0.42, 0, 1.1);
  // 香爐兩側一對鳳鳥石燭台（bk_candlestick）：爐、燭台、花瓶湊成案上五供
  for (const sx of [-1, 1]) mb.add('bk_candlestick', sx * 0.55, 1.02, Z0 + 0.42, 0, 1.0);
  mb.add('hall_tea_table', 0, 0, Z0 + 1.75, 0, 1.0);
  for (const sx of [-1, 1]) mb.add('hall_armchair', sx * 0.98, 0, Z0 + 1.75, sx * -0.12, 1.0);
  for (const sx of [-1, 1]) mb.add('hall_cabinet', sx * 3.75, 0, Z0 + 0.32, 0, 1.0);
  for (const sx of [-1, 1]) {
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 2.4), decalMaterial(textTexture(sx < 0 ? '鏢行萬里' : '一諾千金', { w: 120, h: 640, bg: '#6a1e14', fg: '#e3c070', border: '#b08d48', vertical: true, size: 0.7 }), { alphaTest: 0 }));
    cp.position.set(sx * 2.95, 3.0, Z0 + 0.16);
    group.add(cp);
  }

  // 左側：兵器架（真兵器，取自 weapons.js）＋ 一面大鏢旗
  {
    const rx = -6.6, rz = Z0 + 0.7;
    k.box('wood', 0x4a3020, 2.8, 0.12, 0.3, T(rx, 2.1, rz));
    k.box('wood', 0x4a3020, 2.8, 0.12, 0.3, T(rx, 0.5, rz));
    for (const sx of [-1, 1]) k.box('wood', 0x4a3020, 0.14, 2.6, 0.4, T(rx + sx * 1.4, 1.3, rz));
    k.box('wood', 0x3a2618, 3.0, 0.14, 0.5, T(rx, 0.07, rz));
    const types = ['SPEAR', 'BLADE', 'SWORD', 'SPEAR', 'BLADE'];
    types.forEach((t, i) => {
      const w = makeWeapon(t);
      // 長槍原點在握把（離鐏底 0.845 m），立在架座頂面 y=0.14
      w.position.set(rx - 1.0 + i * 0.5, t === 'SPEAR' ? 0.99 : 0.65, rz + 0.12);
      w.rotation.set(0, 0, (i - 2) * 0.03);
      w.scale.setScalar(t === 'SPEAR' ? 1.0 : 1.1);
      group.add(w);
    });
    const bow = makeWeapon('BOW');
    bow.position.set(rx + 1.1, 2.7, rz + 0.1);
    bow.rotation.set(0, 0, 0.2);
    group.add(bow);
    // 大鏢旗：斜插在旗座
    k.cyl('stone', 0x6e6a60, 0.32, 0.38, 0.4, 12, T(-4.6, 0.2, Z0 + 2.4));
    k.rod('wood', 0x3d2a1c, [-4.6, 0.2, Z0 + 2.4], [-4.45, 3.9, Z0 + 2.3], 0.06, 8);
    const p = pennantMesh('鏢', 1.6);
    p.position.set(-4.48, 3.25, Z0 + 2.32);
    p.rotation.y = 0.5;
    group.add(p);
  }
  // 左牆邊一張羅漢床、一對鼓凳
  mb.add('hall_sofa', -7.35, 0, 2.6, Math.PI / 2, 1.0);
  for (const z of [1.1, 4.1]) mb.add('stool_carved', -6.9, 0, z, 0.3, 1.1);

  // 掛在橫樑上的小鏢旗串（沿前樑）
  for (let i = 0; i < 6; i++) {
    const p = pennantMesh(['順', '安', '鏢', '局', '平', '安'][i], 0.7, { bg: i % 2 ? '#2c3e57' : '#b23a24' });
    p.position.set(-5.5 + i * 2.2, H - 0.75, 0.75);
    p.rotation.z = -Math.PI / 2;
    group.add(p);
  }

  // 右側：櫃台（算盤、帳冊、秤、茶具）＋ 鏢箱
  {
    const cx = 5.2, cz = -1.6;
    k.box('woodDark', 0x2e1c12, 3.6, 1.05, 0.9, T(cx, 0.525, cz));
    k.box('wood', 0x5a3a24, 3.8, 0.08, 1.05, T(cx, 1.09, cz));
    for (let i = 0; i < 5; i++) k.box('wood', 0x4a2e1c, 0.62, 0.8, 0.02, T(cx - 1.45 + i * 0.72, 0.5, cz + 0.46));
    k.box('woodDark', 0x1d1410, 0.5, 0.06, 0.24, T(cx - 1.0, 1.16, cz));
    for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) k.sphere('wood', 0x8a5a34, 0.02, 6, 4, T(cx - 1.2 + i * 0.065, 1.21, cz - 0.07 + r * 0.07));
    for (let i = 0; i < 3; i++) k.box('cloth', [0xe8dcc2, 0xd8cbb0, 0x2c3e57][i], 0.36, 0.05, 0.26, T(cx + 0.1, 1.16 + i * 0.05, cz + 0.05, 0, i * 0.1, 0));
    k.lathe('stone', 0xd8d2c0, [[0, 0], [0.09, 0], [0.11, 0.1], [0.06, 0.16], [0, 0.16]], 12, T(cx + 1.1, 1.13, cz));
    for (let c = 0; c < 3; c++) k.cyl('stone', 0xe8e2d0, 0.04, 0.035, 0.05, 8, T(cx + 0.85 + c * 0.13, 1.155, cz + 0.22));
    // 櫃台後的藥櫃／帳櫃
    k.box('woodDark', 0x3a2418, 3.6, 2.6, 0.5, T(cx, 1.3, cz - 1.6));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) k.box('wood', 0x5a3a24, 0.5, 0.5, 0.02, T(cx - 1.4 + c * 0.56, 0.4 + r * 0.6, cz - 1.34));
    // 鏢箱：紅封條
    // 鏢箱：樟木雕花箱疊兩層，貼一道紅封條
    for (const [x, z, y, s] of [[2.5, 2.3, 0, 1.0], [3.55, 2.55, 0, 0.95], [3.0, 2.4, 0.5, 0.9], [6.4, 1.8, 0, 1.05]]) {
      const ry = 0.2 * (x - 3);
      mb.add('camphor_chest', x, y, z, ry, s);
      k.box('paper', 0xa8301c, 0.1, 0.5 * s + 0.01, 0.48 * s + 0.02, T(x, y + 0.25 * s, z, 0, ry, 0));
    }
    mb.add('lacquer_box', cx + 1.45, 1.13, cz + 0.05, 0.4, 0.55);
  }
  // 案前方桌（頂面 y 0.405、寬 0.68 m）上一只綠釉瓷獅（bk_lion）、一盞銅蓮花油燈（bk_lotus_lamp）。
  // 原本放在右側櫃台上，橫式開場被入局帖蓋住、蓮燈在畫面外；方桌在入局帖左邊、主角右後方，三種尺寸都看得到
  mb.add('bk_lion', -0.17, 0.405, Z0 + 1.78, 0.5, 1.0);
  mb.add('bk_lotus_lamp', 0.18, 0.405, Z0 + 1.7, 0, 1.0);
  // 吊燈籠（暖光）
  const lanterns = [];
  // 宮燈（匯入的六角宮燈）：從橫樑吊下來
  for (const [x, z] of [[-2.2, 0.6], [2.2, 0.6], [-6, 0.6], [6, 0.6], [0, 3.2]]) {
    mb.add('hall_chandelier', x, H - 2.0, z, 0, 1.1, { shadow: false });
    top.cyl('wood', 0x2a1c14, 0.015, 0.015, 1.25, 4, T(x, H - 0.55, z));
  }
  const lights = [];
  for (const [x, z, i] of [[-2.2, 1.2, 9], [2.2, 1.2, 7], [6, 0.8, 6]]) {
    const L = new THREE.PointLight(0xffa860, i, 9, 1.5);
    L.position.set(x, H - 1.6, z);
    group.add(L);
    lights.push(L);
  }
  // 主角背後打一盞輪廓光（從後上方）
  const rimL = new THREE.SpotLight(0xffd0a0, 30, 14, 0.5, 0.6, 1.2);
  rimL.position.set(-4.5, 4.5, -3.5);
  rimL.target.position.set(-1.8, 1.2, 0.5);
  group.add(rimL, rimL.target);

  group.add(k.build({ name: 'hall' }));
  group.add(mb.build());
  group.add(top.build({ name: 'hall-top', shadow: false }));
  void roofGeo; void flipGeo; void lanterns;

  const heroSpot = new THREE.Vector3(-1.8, 0, 1.2);
  return {
    group,
    heroSpot,
    heroRotY: Math.PI - 0.35, // 面向鏡頭，略朝右（朝向入局帖）
    sunDir: new THREE.Vector3(-0.45, 0.85, 0.5).normalize(),
    look: {
      background: 0x140f0b,
      hemiSky: 0xffe2b8, hemiGround: 0x5a4030, hemiI: 0.9,
      sun: 0xffd2a0, sunI: 2.2,
      exposure: 1.15,
      rim: 0xffb070,
      env: { top: 0x2a1e14, horizon: 0x9a6a3a, ground: 0x1d1610, sunDir: new THREE.Vector3(0, 1, 0.3).normalize(), sunColor: 0xffc080 },
    },
    env: null,
    camera(aspect) {
      const o = HALL_ORIGIN;
      const h = this.heroSpot;
      if (aspect < 0.85) {
        // 直式：入局帖蓋住下方六成，主角放在上方那一段的中間
        return { pos: o.clone().add(new THREE.Vector3(h.x + 0.35, 1.25, h.z + 5.0)), look: o.clone().add(new THREE.Vector3(h.x + 0.25, -0.35, h.z)), fov: 54 };
      }
      // 橫式：主角在畫面左側三成處，鏡頭平視
      const off = 1.45 * (aspect / 1.6);
      return { pos: o.clone().add(new THREE.Vector3(h.x + off, 1.45, h.z + 6.4)), look: o.clone().add(new THREE.Vector3(h.x + off, 1.2, h.z - 1)), fov: 38 };
    },
    update(dt, t) {
      for (let i = 0; i < lights.length; i++) lights[i].intensity = [9, 7, 6][i] * (1 + Math.sin(t * 7 + i * 2) * 0.03 + Math.sin(t * 13 + i) * 0.02);
    },
  };
}
