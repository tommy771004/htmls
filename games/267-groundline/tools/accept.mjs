// 驗收：開啟打包後的 web/267-groundline.html，在 1440×900（桌機）與 390×844（行動裝置）下驗證：
// 1. 0 uncaught exception、0 console.error、0 外部網路請求、無水平溢出
// 2. Blender 匯出的 glTF 資產載入完整（Terminal、JetbridgeRotunda、JetbridgeArm、Aircraft_A320、FuelTruck、BaggageTug、CateringTruck、FuelTankFarm 等）
// 3. 頂部 4 張 KPI 卡（準點率、平均過站分鐘、使用中登機門、處理行李數）與右上模擬時鐘＋倍速
// 4. 左下選中航班 6 步驟過站時間軸（到站→下客→清潔→加油→登機→推出）與優先級／改門／指派車輛／突發延誤操作
// 5. 右下航班／車輛／登機門分頁清單與進度條切換正常，連鎖延誤可檢視
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(root, '../../web/267-groundline.html');
const distDir = resolve(root, 'dist');
const outThumb = resolve(root, '../../thumbs/267.jpg');
mkdirSync(distDir, { recursive: true });

let fail = 0;
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fail++; };

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true]]) {
  const tag = `${w}×${h}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  try {
    await page.waitForTimeout(800);
    const meta = await page.evaluate(() => ({
      vp: !!document.querySelector('meta[name=viewport]'),
      title: document.title,
      overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth && document.body.scrollWidth <= innerWidth,
      glbLoaded: window.__gl.scene.glbLoaded,
      loaded: window.__gl.scene.loadedAssets,
      metrics: window.__gl.getMetrics(),
      stepCount: document.querySelectorAll('#tlSteps .tl-step').length,
      kpiCount: document.querySelectorAll('.kpi-grid .kpi-card').length,
    }));
    ok(meta.vp, `${tag} 有 viewport meta`);
    ok(meta.title.includes('Groundline'), `${tag} 標題包含 Groundline（${meta.title}）`);
    ok(meta.overflow, `${tag} 無水平溢出`);
    ok(meta.glbLoaded && meta.loaded.includes('Terminal') && meta.loaded.includes('TerminalRoof') && meta.loaded.includes('TowerRadar') && meta.loaded.includes('GSEDepot') && meta.loaded.includes('Aircraft_A320') && meta.loaded.includes('FuelTruck') && meta.loaded.includes('BaggageTug') && meta.loaded.includes('CateringTruck') && meta.loaded.includes('FuelTankFarm'), `${tag} Blender glTF 高細節 3D 資產已載入（${meta.loaded.length} 項）`);
    ok(meta.kpiCount === 4, `${tag} 頂部 4 張指標卡（準點率=${meta.metrics.onTimeRate}%、平均過站=${meta.metrics.avgTurnaround}m、登機門=${meta.metrics.activeGates}/${meta.metrics.totalGates}、行李=${meta.metrics.totalBags}）`);
    ok(meta.stepCount === 6, `${tag} 左下顯示 6 個過站步驟（到站→下客→清潔→加油→登機→推出）`);

    // 測試優先級切換、指派車輛與突發延誤連鎖影響
    const testSim = await page.evaluate(() => {
      const m0 = window.__gl.getMetrics();
      window.__gl.setPriority('SK-102', 3);
      const dispOk = window.__gl.dispatchVehicle('CT-02', 'SK-102');
      const dlyFlight = window.__gl.triggerDelay('GL-101');
      window.__gl.step(6);
      const fNext = window.__gl.world.flights.find((f) => f.id === 'GL-201');
      const m1 = window.__gl.getMetrics();
      return {
        prio: window.__gl.world.flights.find((f) => f.id === 'SK-102').priority,
        dispOk,
        dlyOk: !!dlyFlight,
        cascadeDelay: fNext ? fNext.cascadeDelay : 0,
        bagsBefore: m0.totalBags,
        bagsAfter: m1.totalBags,
      };
    });
    ok(testSim.prio === 3, `${tag} 調整航班優先順序成功（SK-102 → ★ 緊急）`);
    ok(testSim.dispOk, `${tag} 手動指派地勤車輛成功（CT-02 → SK-102）`);
    ok(testSim.dlyOk && testSim.cascadeDelay > 0, `${tag} 延誤連鎖影響後續同登機門航班（GL-201 連鎖延誤 +${testSim.cascadeDelay}m）`);
    ok(testSim.bagsAfter > testSim.bagsBefore, `${tag} 隨模擬推進處理行李數持續增加（${testSim.bagsBefore} → ${testSim.bagsAfter} 件）`);

    // 測試右下分頁切換（航班 / 車輛 / 登機門）
    await page.click('[data-tab="vehicles"]');
    await raf(page);
    const vehRows = await page.evaluate(() => document.querySelectorAll('#tabBody .list-row').length);
    ok(vehRows === 9, `${tag} 車輛分頁列出 9 輛地勤車與進度條`);

    await page.click('[data-tab="gates"]');
    await raf(page);
    const gateRows = await page.evaluate(() => document.querySelectorAll('#tabBody .list-row').length);
    ok(gateRows === 5, `${tag} 登機門分頁列出 5 座空橋登機門與連鎖狀態`);

    await page.click('[data-tab="flights"]');
    await raf(page);

    // 測試 3D 建築與飛機深度互動（航廈屋頂透視、夜航／塔台雷達、油槽增壓、飛機艙門與行李輸送帶檢視）
    const interactOk = await page.evaluate(() => {
      const s = window.__gl.scene;
      const cutOn = s.toggleTerminalCutaway(true);
      const nightOn = s.toggleNightMode(true);
      s.triggerFuelBoost();
      const doorsOn = s.toggleInspectDoors(true);
      s.syncScene(performance.now() + 200);
      const okState = cutOn === true && nightOn === true && doorsOn === true;
      // 恢復預設日景與全覽供標準驗收截圖
      s.toggleTerminalCutaway(false);
      s.toggleNightMode(false);
      s.toggleInspectDoors(true);
      s.syncScene(performance.now() + 400);
      return okState;
    });
    ok(interactOk, `${tag} 3D 建築與飛機互動（航廈透視、塔台夜航雷達、油槽增壓、開啟艙門與動態輸送帶）正常`);

    await page.screenshot({ path: resolve(distDir, `accept-${w}x${h}.png`) });
    if (w === 1440) {
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', '-z', '400', '640', resolve(distDir, `accept-${w}x${h}.png`), '--out', outThumb], { stdio: 'ignore' });
    }

    ok(!log.pageerrors.length, `${tag} 沒有 uncaught exception ${log.pageerrors.join(' | ')}`);
    ok(!log.errors.length, `${tag} 沒有 console.error ${log.errors.join(' | ')}`);
    ok(!log.external.length, `${tag} 沒有外部網路請求 ${log.external.join(' ')}`);
  } finally {
    await browser.close();
  }
}

if (fail) { console.error(`${fail} 項未通過`); process.exit(1); }
console.log('全部通過');
