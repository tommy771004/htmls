# 194 雪峰滑降 · POWDER PEAK

第三人稱無盡滑雪。原本是獨立專案 `snow`，整合進作品集後編號 194，網址 `https://htmls-ruddy.vercel.app/web/194-powder-peak.html`。

- 原始碼：`src/`（Three.js + 原生 ES module，沒有框架）。
- 網站沒有 build step：`npm run build` 用 esbuild 把 `src/main.js`（連同 three）打包並內嵌進 `src/index.html`，輸出單檔 `../../web/194-powder-peak.html`。**改了 `src/` 之後要重新 build，並把產出一起 commit。**
- 架構、模組介面、座標慣例與效能目標見 [`SPEC.md`](SPEC.md)；所有可調參數集中在 `src/config.js`。

## 指令

需要 Node.js 22 以上，在本資料夾執行：

```bash
npm ci
npm run build                              # → web/194-powder-peak.html
npm test                                   # 模擬測試（先 build）：4 個 seed × 完美 / 弱化 bot、摔三次結束、重開歸零
node tools/build.mjs --out=dist --dev      # 不壓縮，輸出到 dist/index.html（已 gitignore）
node tools/shot.mjs ../../web/194-powder-peak.html shot.png 4000 1280 720 --eval "__game.simulate(30)"
node tools/perf/bench.mjs ../../web/194-powder-peak.html --scen=fps
```

`shot.mjs` 與 `bench.mjs` 用 puppeteer-core 開本機 Chrome，路徑依平台預設（見 `tools/shot.mjs`），可用環境變數 `CHROME` 覆寫。`bench.mjs` 的「等機器安靜」與 CPU 取樣用的是 Windows 的 PowerShell / wmic，其他平台會略過這一步，量測本身照常。

## 除錯參數

`?bot=1` 自動駕駛並自動開始、`?seed=N`、`?debug=1`（fps / draw calls / 三角形覆蓋層）、`?mute=1`；效能用 `?pr=`、`?aa=0|1`、`?shadow=off|basic|pcf|soft`、`?smap=`、`?mp=`、`?orphan=0`。
主控台有 `window.__game`：`start()`、`restart()`、`setBot(true)`、`simulate(秒)`（不渲染、直接跑 bot 物理並回傳距離、最高速度、最長滯空、旗門與落地統計）、`rendererInfo()`、`triangleReport()`。

## 整合進作品集時的調整

- Three.js 由 0.169.0 升到專案統一的 0.186.0（仍打包進單檔，不走 CDN 或 `vendor/`）。`PCFSoftShadowMap` 在 r0.186 已棄用，改用 `PCFShadowMap`；把霧改成「到鏡頭距離」的 `fog_vertex` 替換在 0.186 仍適用。
- 介面全部改成繁體中文（`lang="zh-Hant"`），西文展示字體沒有中文字形，另外宣告粗黑體替身 `PP CJK`（蘋方／思源黑體／微軟正黑體）；加上網站共用的 favicon。
- 建置輸出由 `dist/` 改到 `web/`；`tools/` 的 Chrome 路徑原本寫死 Windows，改成依平台。
- 修正模擬測試：bot 與 player 原本在建構時複製一份 config，之後改 `__game.config.bot`（SPEC 記載的弱化 bot 做法）或 `config.player` 完全不生效，弱化 bot 跑出來和完美 bot 一模一樣，也測不到「摔三次結束」。改成每次 `reset()`（新局與每次 `simulate()`）重讀 config。原本 `package.json` 的 `test` 指向不存在的 `tools/playtest.mjs`，現在補上這支測試。
- Google Fonts（Titan One、Chakra Petch、Barlow Condensed）以 JS 動態插入，被擋時退回系統字，不影響遊戲。這是作品唯一的外部請求。

## 驗收（2026-09-30，Apple GPU 無頭 Chrome）

1440×900 與 390×844 兩種尺寸：沒有 uncaught exception、`console.error` 或 warning，有 viewport meta，手機沒有水平溢出；滑行中約 72 draw calls、18.6 萬三角形。`simulate(90)`（seed 7）：2,335 m、最高 117 km/h、最長滯空 1.77 s、旗門 22/22、0 次摔倒。

`npm test` 56/56 通過（seed 1、7、42、2026，各 `simulate(180)`）：完美 bot 4.77–4.85 km、0 摔、過門 100%；弱化 bot（`reactionTime 0.45`、`aimNoise 0.15`）4.12–4.18 km、0–2 摔、過門 89–92%，與 SPEC 的平衡基準一致；同 seed 重跑結果完全相同；很差的 bot 在非 endless 模式摔滿 3 次後進結算畫面。

## 原始需求

> 用附圖當美術基準，做一款在瀏覽器就能玩的第三人稱滑雪遊戲，Three.js 實作，3D 素材透過 Rodin MCP 生成，不要去網路上抓現成模型。
>
> 一、地形：程式生成的無盡雪坡，沿路隨機長出松樹、岩石、跳台與旗門。難度隨距離拉高：坡度變陡、障礙變密。
>
> 二、操作：左右轉向、蹲低加速、跳躍。轉向要有慣性與側滑感，不要像在格子上平移；落地沒站穩會摔倒並損失速度。
>
> 三、素材：用 Rodin MCP 生出滑雪者、松樹、岩石、跳台這幾種模型，風格照附圖（低多邊形、色塊乾淨、遠景帶霧）。生成後自己檢查面數，太重的要簡化，目標是筆電上穩定 60 fps。
>
> 四、玩法迴圈：計時 + 距離分數，穿過旗門加分、撞到障礙扣速度，摔三次結束。結算畫面顯示距離、最高速度與最長滯空。
>
> 五、音效與鏡頭：滑行的雪聲隨速度變化，跳躍滯空時鏡頭稍微拉遠。

實際製作時沒有 Rodin MCP 可用，所有模型（維京滑雪者、松樹、岩石、跳台、柵欄、旗門、雲、遠山）都在 `src/assets.js` 以程式碼建構成低多邊形 vertex color 幾何，面數預算與統計見 `SPEC.md` 與 `triangleReport()`。`SPEC.md` 提到的美術參考圖 `2101937240351834281.jpg` 不在原專案裡，也沒有一起搬過來。
