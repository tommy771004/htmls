// 場景截圖（world）：用 window.__sf 擺場景，輸出 dist/world-<鏡頭>-<後端>.png，並印出 draw call 與 console 錯誤。
//   node tools/build.mjs --out=dist/world.html && node tools/shot.mjs            # Metal GPU（失敗退回 SwiftShader）
//   node tools/shot.mjs --soft                # SwiftShader／WebGL2
//   node tools/shot.mjs --only=intro,dock     # 只拍部分鏡頭
//   node tools/shot.mjs --file=../../web/274-sixfold-escort.html   # 拍正式產出（路徑相對於本資料夾）
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, process.argv.find((a) => a.startsWith('--file='))?.slice(7) || 'dist/world.html');
const soft = process.argv.includes('--soft');
const only = (process.argv.find((a) => a.startsWith('--only='))?.slice(7) || '').split(',').filter(Boolean);
const tag = soft ? 'soft' : 'gpu';
if (!existsSync(file)) {
  console.error(`找不到 ${file}：先跑 node tools/build.mjs --out=dist/world.html（或 npm run shot），或用 --file= 指定單檔`);
  process.exit(1);
}

const SHOTS = [
  { name: 'intro', w: 1440, h: 900, intro: true },
  { name: 'intro-portrait', w: 390, h: 844, touch: true, intro: true },
  { name: 'intro-landscape', w: 667, h: 375, touch: true, intro: true },
  { name: 'street', w: 1440, h: 900, setup: { map: 1001, x: 0, z: 4, rotY: Math.PI } },
  { name: 'street-landscape', w: 667, h: 375, touch: true, setup: { map: 1001, x: 0, z: 4, rotY: Math.PI } },
  { name: 'chisha-portrait', w: 390, h: 844, touch: true, setup: { map: 1002, x: 0, z: 12, rotY: Math.PI, beaconLit: true } },
  { name: 'chisha-landscape', w: 667, h: 375, touch: true, setup: { map: 1002, x: 0, z: 12, rotY: Math.PI, beaconLit: true } },
  { name: 'ruins-portrait', w: 390, h: 844, touch: true, setup: { map: 2001, x: 0, z: 11, rotY: Math.PI } },
  { name: 'ruins-landscape', w: 667, h: 375, touch: true, setup: { map: 2001, x: 0, z: 11, rotY: Math.PI, mech: true } },
  // 鏢局門前（院子是不可走區）：鏡頭在街上朝北，門樓、匾額、兩根大鏢旗和帳桌同框
  { name: 'courtyard', w: 1440, h: 900, setup: { map: 1001, x: 1.5, z: 19.8, rotY: 0, cam: { yaw: Math.PI, pitch: 0.4, dist: 11 } } },
  { name: 'wall-west', w: 1440, h: 900, setup: { map: 1001, x: -17.6, z: 0.5, rotY: Math.PI / 2, cam: { yaw: -Math.PI / 2, pitch: 0.45, dist: 14 } } },
  { name: 'boardwalk', w: 1440, h: 900, setup: { map: 1001, x: -8, z: -24.8, rotY: Math.PI / 2, cam: { yaw: 0.9, pitch: 0.3, dist: 9 } } },
  { name: 'canopy', w: 1440, h: 900, setup: { map: 1001, x: 13.8, z: 7.5, rotY: Math.PI } },
  { name: 'canopy-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: 13.8, z: 7.5, rotY: Math.PI } },
  { name: 'street-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: 0, z: 2, rotY: Math.PI } },
  { name: 'agency', w: 1440, h: 900, setup: { map: 1001, x: 0, z: 12, rotY: 0, cam: { yaw: Math.PI, pitch: 0.36, dist: 13 } } },
  { name: 'dock', w: 1440, h: 900, setup: { map: 1001, x: 2, z: -17, rotY: Math.PI, cam: { yaw: 0.35, pitch: 0.42, dist: 14 } } },
  { name: 'chisha', w: 1440, h: 900, setup: { map: 1002, x: 0, z: -6, rotY: Math.PI, cam: { yaw: 0.2, pitch: 0.45, dist: 16 }, beaconLit: true } },
  { name: 'chisha-station', w: 1440, h: 900, setup: { map: 1002, x: -14, z: 14, rotY: -Math.PI / 2, cam: { yaw: Math.PI / 2 + 0.3, pitch: 0.4, dist: 15 } } },
  { name: 'ruins-mech', w: 1440, h: 900, setup: { map: 2001, x: 0, z: 4, rotY: Math.PI, mech: true, cam: { yaw: 0.25, pitch: 0.4, dist: 16 } } },
  { name: 'ruins-mobs', w: 1440, h: 900, setup: { map: 2001, x: -2, z: 6, rotY: Math.PI, cam: { yaw: -0.3, pitch: 0.5, dist: 15 } } },
  { name: 'strike', w: 1440, h: 900, setup: { map: 1001, x: 14.5, z: 10.3, rotY: Math.PI, cam: { yaw: 0.9, pitch: 0.28, dist: 7.5 }, cast: 101, castWait: 260 } },
  { name: 'beast-qp', w: 1440, h: 900, setup: { map: 1001, x: 0, z: 4, rotY: Math.PI, cam: { yaw: 0.0, pitch: 0.3, dist: 9.5, focus: { x: 1.5, y: 0.6, z: -17.6 } } } },
  { name: 'beast-wolf', w: 1440, h: 900, setup: { map: 1002, x: 0, z: 24, rotY: Math.PI, cam: { yaw: 0.7, pitch: 0.25, dist: 4.5, focus: { x: -9, y: 0.8, z: 6 } } } },
  { name: 'beast-lizard', w: 1440, h: 900, setup: { map: 1002, x: 0, z: 24, rotY: Math.PI, cam: { yaw: -0.6, pitch: 0.35, dist: 4.5, focus: { x: 8.5, y: 0.5, z: 5 } } } },
  { name: 'beast-golem', w: 1440, h: 900, setup: { map: 1002, x: 0, z: 24, rotY: Math.PI, cam: { yaw: 0.3, pitch: 0.2, dist: 6.5, focus: { x: -6, y: 1.5, z: -3 } } } },
  { name: 'beast-puppets', w: 1440, h: 900, setup: { map: 2001, x: 0, z: 24, rotY: Math.PI, cam: { yaw: 0.0, pitch: 0.22, dist: 10, focus: { x: -2, y: 1.6, z: -3 } } } },
  { name: 'beast-caster', w: 1440, h: 900, setup: { map: 2001, x: 0, z: 24, rotY: Math.PI, cam: { yaw: -0.4, pitch: 0.2, dist: 5, focus: { x: 9, y: 1.3, z: 4 } } } },
  { name: 'mobs-qp', w: 1440, h: 900, setup: { map: 1001, x: 1, z: -11, rotY: Math.PI, cam: { yaw: 0.0, pitch: 0.42, dist: 11 } } },
  { name: 'mobs-cs', w: 1440, h: 900, setup: { map: 1002, x: 0, z: 9, rotY: Math.PI, cam: { yaw: 0.0, pitch: 0.42, dist: 12 } } },
];

let failed = false;
for (const s of SHOTS) {
  if (only.length && !only.includes(s.name)) continue;
  const { browser, page, log } = await open(file, { w: s.w, h: s.h, touch: !!s.touch, soft });
  try {
    if (s.intro) {
      await page.evaluate(() => {
        const sv = window.__sf.sceneView;
        sv.setIntro?.(true);
        sv.setHeroLook?.({ preset: 'escort', gender: 'Male', hair: 0, palette: 'indigo', weapon: 'SPEAR' });
      });
    } else {
      await page.evaluate((st) => {
        const S = window.__sf;
        S.start();
        const w = S.world;
        if (w.char.mapId !== st.map) w.changeMap(st.map);
        w.char.x = st.x; w.char.z = st.z; w.char.rotY = st.rotY;
        if (st.cam) S.sceneView.setCamera?.(st.cam);
        if (st.beaconLit) { const b = w.beacons.find((x) => x.isTrue); b.revealed = true; b.owner = w.char.name; const f = w.beacons.find((x) => !x.isTrue); f.revealed = true; }
        if (st.mech) w.toggleMechSummon({ instantForTest: true });
      }, s.setup);
    }
    await page.waitForTimeout(1500);
    if (s.setup?.cast) {
      await page.evaluate((st) => {
        const w = window.__sf.world;
        w.char.lockedTargetId = 'dummy-1';
        w.castLinkedSkill(st.cast, { targetId: 'dummy-1' });
      }, s.setup);
      await page.waitForTimeout(s.setup.castWait);
    }
    await raf(page);
    const info = await page.evaluate(() => window.__sf.info());
    const out = resolve(root, `dist/world-${s.name}-${tag}.png`);
    await page.screenshot({ path: out });
    const errs = [...log.pageerrors, ...log.errors];
    console.log(`${s.name} ${s.w}x${s.h} [${log.gpu}] calls=${info.calls} tris=${info.triangles} ${errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'ok'}${log.external.length ? ' EXT ' + log.external.length : ''}`);
    if (errs.length || log.external.length) failed = true;
  } catch (e) {
    console.log(`${s.name} FAILED ${e.message}`);
    failed = true;
  } finally {
    await browser.close();
  }
}
process.exit(failed ? 1 : 0);
