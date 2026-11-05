// 截圖與驗收腳本：產生整體配置參考對照截圖、各分區截圖、兩種尺寸驗收（1440×900、390×844）與 640×400 縮圖
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openCity, settleFrames } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlFile = resolve(root, '../../web/275-tramway-plaza.html');
const distDir = resolve(root, 'dist');
const thumbFile = resolve(root, '../../thumbs/275.jpg');
mkdirSync(distDir, { recursive: true });

// 1. 桌機 1440×900 驗收 + 整體配置截圖（含介面與純淨對照版）
{
  const { browser, page, log } = await openCity(htmlFile, { w: 1440, h: 900 });
  try {
    await settleFrames(page);
    const info = await page.evaluate(() => window.__city.info());
    console.log('[desktop 1440x900]', JSON.stringify({ ...info, gpu: log.gpu }));

    // 帶 UI 正式畫面
    await page.screenshot({ path: resolve(distDir, 'desktop-1440x900.png') });

    // 純淨無 UI 全景配置對照圖（1400×720 接近參考圖橫幅比例）
    await page.setViewportSize({ width: 1400, height: 720 });
    await page.evaluate(() => {
      window.__city.setClean(true, true);
      window.__city.preset('overview', true);
      window.__city.setTrainU(0.342);
    });
    await settleFrames(page);
    await page.screenshot({ path: resolve(distDir, 'overview-clean.png') });

    // 測試列車推進與各分區視角
    for (const p of ['plaza', 'station', 'park', 'apartments']) {
      await page.evaluate((k) => window.__city.preset(k, true), p);
      await settleFrames(page);
      await page.screenshot({ path: resolve(distDir, `zone-${p}.png`) });
    }

    // 產生網站目錄縮圖 640×400 (.jpg)
    await page.setViewportSize({ width: 640, height: 400 });
    await page.evaluate(() => {
      window.__city.setClean(true, true);
      window.__city.preset('overview', true);
      window.__city.setTrainU(0.342);
    });
    await settleFrames(page);
    await page.screenshot({ path: thumbFile, type: 'jpeg', quality: 88 });
    console.log('[thumb]', thumbFile);

    if (log.pageerrors.length || log.errors.length || log.external.length) {
      throw new Error(`Desktop 驗收失敗: ${JSON.stringify(log)}`);
    }
    if (log.warns.length) {
      console.warn('[desktop warnings]', log.warns);
    }
  } finally {
    await browser.close();
  }
}

// 2. 手機 390×844 驗收（檢查水平溢出、錯誤與互動按鈕）
{
  const { browser, page, log } = await openCity(htmlFile, { w: 390, h: 844, touch: true });
  try {
    await settleFrames(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const hasViewport = await page.evaluate(() => Boolean(document.querySelector('meta[name="viewport"]')));
    await page.screenshot({ path: resolve(distDir, 'mobile-390x844.png') });
    const info = await page.evaluate(() => window.__city.info());
    console.log('[mobile 390x844]', JSON.stringify({ ...info, overflow, hasViewport }));

    if (overflow || !hasViewport || log.pageerrors.length || log.errors.length || log.external.length) {
      throw new Error(`Mobile 驗收失敗: overflow=${overflow}, log=${JSON.stringify(log)}`);
    }
  } finally {
    await browser.close();
  }
}
