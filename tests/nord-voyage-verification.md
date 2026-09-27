# 北境航記 · NORÐ 驗證

日期：2026-09-27。頁面：`web/173-nord-voyage.html`；分類：遊戲敘事。

## 執行

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node tests/nord-voyage-regression.mjs
```

測試啟動獨立、唯讀的本機靜態伺服器，完成後關閉。測試伺服器只在回傳的 HTML 中加入 simulation hooks，供靠岸、章節及終點驗證；正式檔案僅暴露唯讀診斷。遠端航程狀態以測試注入定位驗證，未以人工連續航行方式跑完整段 1.6 公里。

## 結果

- Chrome / WebGL 實際渲染，1440×900、390×844 截圖人工檢查；另驗證 320×568、844×390 無水平溢出、操控按鈕可見。
- 十二支船槳隨槳速運動，乾轉濕接觸觸發世界座標泡沫、漣漪與粒子；未啟航時不生成划槳水花。
- 啟航、WASD 掌舵調速、滑桿、停泊後減速至零、終點與重新啟航通過；失焦清除輸入，實際觸控按住及放開掌舵通過。
- 靠近河岸時限制船位並減速、四段章節與進度通過。
- 晨霧、暮金、月夜確實改變場景與選取狀態；說明對話框開啟時停止模擬並阻止航行快捷鍵。
- 反射與折射 render targets、深度貼圖、木石法線及粗糙度貼圖正常；shader 與 console error 均為零。
- 正常載入僅外連固定版本 Three.js 0.186.0 的 module/core 兩個模組；無失敗資源。阻擋 CDN 時以站內 vendor 模組成功啟動。
- WebGL context loss 顯示恢復提示與重新載入按鈕。
- 展示頁實際點選「遊戲敘事」、搜尋 173、開啟 iframe 預覽通過；640×400 JPEG 縮圖 HTTP 200。
- README、llms.txt、sitemap.xml 登錄與作品總數檢查通過；`git diff --check` 通過。

## 實作範圍

CSS、場景程式、模型與程序化材質皆在單檔 HTML；Three.js 使用 CDN，經 HTTP 開啟時可退回現有站內 vendor。水面為平面鏡像反射、螢幕空間折射及以深度差計算的透光衰減，不是流體模擬。未在 Safari、Firefox 或實體手機 GPU 上驗證。
