// 產生展示頁縮圖（640×400）
// 用法：node tools/thumb.mjs [--html=單檔路徑] [--out=輸出 jpg]
//   預設讀 ../../web/274-sixfold-escort.html、寫 ../../thumbs/274.jpg；測試時請用 --out=dist/thumb-274.jpg
// 取景：青萍渡北街順安鏢局門前，鏢師抽出 +9 截江刀持刀架勢，鏡頭在斜後方，背上的六器匣與前方鏢局門樓同框（構圖由 sceneView.thumbPose 提供）。
// 縮圖模式（sceneView.setShowcase）不畫鎖定圈、亮刃圈、衝擊圈，碎片減半。
// 若場景提供 sceneView.thumbPose?.()（回傳 { map, x, z, rotY, yaw, pitch, dist }：map 是地圖 id，鏡頭三值是絕對值，交給 setCamera），以它為準；
// 否則用下面的預設構圖（鏡頭三值是相對預設視角的增量，交給 orbitBy／zoomBy）。
// 全尺寸原圖一律另寫到 dist/thumb-full.png（不論 --out 給什麼）。
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const html = arg('html') ? resolve(process.cwd(), arg('html')) : resolve(root, '../../web/274-sixfold-escort.html');
const out = arg('out') ? resolve(process.cwd(), arg('out')) : resolve(root, '../../thumbs/274.jpg');
const full = resolve(root, 'dist/thumb-full.png');
mkdirSync(resolve(root, 'dist'), { recursive: true });
mkdirSync(dirname(out), { recursive: true });

const { browser, page } = await open(html, { w: 1280, h: 800 });
try {
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const sf = window.__sf;
    sf.start();
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('worldLabels').style.display = 'none';
    document.getElementById('combatArcs').style.opacity = '0';
    sf.sceneView.setShowcase?.(true);
    const given = sf.sceneView.thumbPose?.();
    const pose = given || { x: -4.2, z: 1.2, rotY: -0.55, yaw: 0.62, pitch: -0.2, dist: -4.4 };
    const c = sf.world.char;
    if (given?.map && c.mapId !== given.map) sf.world.changeMap(given.map);
    c.x = pose.x;
    c.z = pose.z;
    c.rotY = pose.rotY;
    c.pkMode = true; // 亮刃才會抽出兵器；亮刃圈在縮圖模式下不畫
    const blade = sf.world.weapons.find((w) => w.uid === 'wpn-blade-01');
    if (blade) blade.upgrade = 9; // +9 鎏金流光
    c.activeWeaponUid = 'wpn-blade-01';
    if (given && sf.sceneView.setCamera) sf.sceneView.setCamera({ yaw: pose.yaw, pitch: pose.pitch, dist: pose.dist });
    else {
      sf.sceneView.orbitBy(pose.yaw, pose.pitch);
      sf.sceneView.zoomBy(pose.dist);
    }
    sf.advance(0.05);
    // 門前沒有怪，出招會 OUT_OF_RANGE：直接送一個出招特效事件，讓畫面抽刀、揮一刀再回到持刀架勢
    const r = sf.world.castLinkedSkill(101);
    if (!r?.ok) {
      c.inCombatSec = 6;
      sf.world.vfxQueue.push({ kind: 'MARTIAL', skillId: 101, weaponType: 'BLADE', color: '#e0b04a',
        fromX: c.x, fromZ: c.z, toX: c.x - Math.sin(c.rotY) * 2.0, toZ: c.z - Math.cos(c.rotY) * 2.0, radius: 2.4, isTrue: false });
    }
  });
  // 等揮刀動作收完、回到持刀架勢（出招動作中段每次姿勢不同，架勢才穩定）
  for (let i = 0; i < 45; i++) await page.evaluate(() => window.__sf.advance(0.03));
  await page.evaluate(() => { document.getElementById('breakStamp').classList.remove('on'); });
  await raf(page);
  await page.screenshot({ path: full });
} finally {
  await browser.close();
}

execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', '-z', '400', '640', full, '--out', out], { stdio: 'ignore' });
console.log(`已產生縮圖 ${out}（640×400）`);
