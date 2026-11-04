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
  // 鏢局門前（院子是不可走區）：真實遊玩鏡頭（預設追尾相機，不覆寫 yaw）。鏡頭落在院子上空，門樓與正廳擋到的部分挖視線圓錐
  { name: 'courtyard', w: 1440, h: 900, setup: { map: 1001, x: 1.5, z: 19.8, rotY: Math.PI } },
  { name: 'courtyard-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: -1.2, z: 18.4, rotY: Math.PI } },
  { name: 'courtyard-landscape', w: 667, h: 375, touch: true, setup: { map: 1001, x: 2.0, z: 18.6, rotY: Math.PI } },
  // 鏢局門樓正面（街上朝北看）：匾額、大鏢旗、帳桌與正廳屋頂
  { name: 'gate-front', w: 1440, h: 900, setup: { map: 1001, x: 1.5, z: 12, rotY: 0, cam: { yaw: Math.PI, pitch: 0.34, dist: 13 } } },
  { name: 'wall-west', w: 1440, h: 900, setup: { map: 1001, x: -17.6, z: 0.5, rotY: Math.PI / 2, cam: { yaw: -Math.PI / 2, pitch: 0.45, dist: 14 } } },
  { name: 'boardwalk', w: 1440, h: 900, setup: { map: 1001, x: -8, z: -24.8, rotY: Math.PI / 2, cam: { yaw: 0.9, pitch: 0.3, dist: 9 } } },
  { name: 'canopy', w: 1440, h: 900, setup: { map: 1001, x: 13.8, z: 7.5, rotY: Math.PI } },
  { name: 'canopy-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: 13.8, z: 7.5, rotY: Math.PI } },
  { name: 'street-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: 0, z: 2, rotY: Math.PI } },
  // 市集攤位近景：魚攤、菜攤、藥舖上的匯入貨品
  { name: 'stalls-fish', w: 1440, h: 900, setup: { map: 1001, x: -4.6, z: -6.6, rotY: Math.PI, cam: { yaw: 0.35, pitch: 0.5, dist: 5.2, focus: { x: -5.5, y: 0.9, z: -8.2 } } } },
  { name: 'stalls-veg', w: 1440, h: 900, setup: { map: 1001, x: -12.6, z: -1.4, rotY: Math.PI, cam: { yaw: -0.3, pitch: 0.5, dist: 5.2, focus: { x: -13.6, y: 0.9, z: -3.0 } } } },
  { name: 'stalls-herb', w: 1440, h: 900, setup: { map: 1001, x: 10.4, z: -1.6, rotY: Math.PI, cam: { yaw: 0.3, pitch: 0.5, dist: 5.2, focus: { x: 9.5, y: 0.9, z: -3.2 } } } },
  { name: 'teahouse', w: 1440, h: 900, setup: { map: 1001, x: 17.5, z: -4, rotY: Math.PI / 2, cam: { yaw: -Math.PI / 2 - 0.35, pitch: 0.3, dist: 13 } } },
  { name: 'agency', w: 1440, h: 900, setup: { map: 1001, x: 0, z: 12, rotY: 0, cam: { yaw: Math.PI, pitch: 0.36, dist: 13 } } },
  { name: 'dock', w: 1440, h: 900, setup: { map: 1001, x: 2, z: -17, rotY: Math.PI, cam: { yaw: 0.35, pitch: 0.42, dist: 14 } } },
  { name: 'dock-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: 1, z: -17, rotY: Math.PI } },
  { name: 'dock-landscape', w: 667, h: 375, touch: true, setup: { map: 1001, x: 1, z: -17, rotY: Math.PI } },
  { name: 'chisha', w: 1440, h: 900, setup: { map: 1002, x: 0, z: -6, rotY: Math.PI, cam: { yaw: 0.2, pitch: 0.45, dist: 16 }, beaconLit: true } },
  { name: 'chisha-station', w: 1440, h: 900, setup: { map: 1002, x: -14, z: 14, rotY: -Math.PI / 2, cam: { yaw: Math.PI / 2 + 0.3, pitch: 0.4, dist: 15 } } },
  // 赤沙驛驛門外的歇腳處（火塘、胡餅條桌）與遺墟北牆（石獅、武士像、浮雕、盤龍石盤）、西崖石窟
  { name: 'chisha-camp', w: 1440, h: 900, setup: { map: 1002, x: -18.5, z: 17.5, rotY: -Math.PI / 2, cam: { yaw: Math.PI / 2 + 0.5, pitch: 0.36, dist: 9 } } },
  { name: 'ruins-gate', w: 1440, h: 900, setup: { map: 2001, x: 0, z: -14, rotY: Math.PI, cam: { yaw: 0.0, pitch: 0.3, dist: 15, focus: { x: 0, y: 3.2, z: -22 } } } },
  { name: 'ruins-grotto', w: 1440, h: 900, setup: { map: 2001, x: -12, z: 11, rotY: -Math.PI / 2, cam: { yaw: 1.57, pitch: 0.15, dist: 16, focus: { x: -24, y: 3.5, z: 11.3 } } } },
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
  // 直式：破罡跳字不壓右上的地圖旗／懸紅榜；怪多時名牌不疊成一長串
  { name: 'strike-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: 14.5, z: 10.3, rotY: Math.PI, cam: { yaw: 0.9, pitch: 0.28, dist: 7.5 }, cast: 101, castWait: 260 } },
  { name: 'mobs-qp-portrait', w: 390, h: 844, touch: true, setup: { map: 1001, x: 1, z: -11, rotY: Math.PI } },
  { name: 'ruins-mobs-portrait', w: 390, h: 844, touch: true, setup: { map: 2001, x: -2, z: 6, rotY: Math.PI } },
  // 匯入模型近景（BlenderKit）：鏢局兩側廂房、門前香爐、茶棚圈椅／蒸籠／鐵瓢、鍛爐鐵砧、吊腳樓、對岸塔與寺、遺墟石雕板、石案與太湖石
  { name: 'wings', w: 1440, h: 900, setup: { map: 1001, x: -6, z: 16, rotY: 0, cam: { yaw: 2.55, pitch: 0.5, dist: 13, focus: { x: -8.6, y: 2.5, z: 22.6 } } } },
  // 門前西角：預設追尾鏡頭從西廂房上空看過來時，整棟廂房溶掉（fadeGroups 的 boxes），鏡頭不被推高
  { name: 'wing-corner', w: 1440, h: 900, setup: { map: 1001, x: -10.5, z: 19.5, rotY: Math.PI } },
  { name: 'wing-corner-side', w: 1440, h: 900, setup: { map: 1001, x: -10.5, z: 19.5, rotY: Math.PI, cam: { yaw: -0.5, pitch: 0.46, dist: 12 } } },
  { name: 'gate-censer', w: 1440, h: 900, setup: { map: 1001, x: 1.6, z: 16.5, rotY: 0, cam: { yaw: Math.PI + 0.45, pitch: 0.3, dist: 5.5, focus: { x: 3.6, y: 0.8, z: 19.6 } } } },
  { name: 'tea-props', w: 1440, h: 900, setup: { map: 1001, x: 13.5, z: -2.5, rotY: Math.PI / 2, cam: { yaw: -Math.PI / 2 + 0.25, pitch: 0.28, dist: 4.2, focus: { x: 16.0, y: 0.9, z: -7.4 } } } },
  { name: 'forge-anvil', w: 1440, h: 900, setup: { map: 1001, x: 4.2, z: -5.6, rotY: Math.PI, cam: { yaw: 0.25, pitch: 0.45, dist: 3.6, focus: { x: 6.0, y: 0.9, z: -8.3 } } } },
  { name: 'stilthouse', w: 1440, h: 900, setup: { map: 1001, x: 22, z: -17, rotY: -Math.PI / 2, cam: { yaw: -Math.PI / 2 + 0.35, pitch: 0.3, dist: 12 } } },
  { name: 'far-bank', w: 1440, h: 900, setup: { map: 1001, x: 0, z: -20, rotY: Math.PI, cam: { yaw: 0.0, pitch: 0.1, dist: 9, focus: { x: -2, y: 5, z: -40 } } } },
  { name: 'ruins-relief', w: 1440, h: 900, setup: { map: 2001, x: -8, z: -18, rotY: Math.PI, cam: { yaw: 0.15, pitch: 0.12, dist: 8, focus: { x: -7.8, y: 2.9, z: -26.4 } } } },
  // 西崖石窟南側墊岩：鏡頭往西南轉時會穿過墊岩，相機防擋盒要包住它（鏡頭拉近／爬高，不鑽進岩塊）
  { name: 'ruins-grotto-rock', w: 1440, h: 900, setup: { map: 2001, x: -23, z: 0.5, rotY: Math.PI / 2, cam: { yaw: -1.35, pitch: 0.4, dist: 12 } } },
  { name: 'ruins-altar', w: 1440, h: 900, setup: { map: 2001, x: 0, z: 10.5, rotY: Math.PI, cam: { yaw: 0.0, pitch: 0.4, dist: 8.5, focus: { x: 0.4, y: 0.9, z: 6.6 } } } },
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
