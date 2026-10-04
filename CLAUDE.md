# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概觀

「100 Creative HTML Works」：部署在 Vercel（https://htmls-ruddy.vercel.app/）的靜態作品集，**沒有 build step**。內容分兩個集合：

- `web/NNN-keyword.html`：網頁作品（001–100 為原始百件，101、102 為 AI 教學簡報，103 起為後續作品）。
- `app/NNN-keyword.html`：100 個手機 App 原型（001–100）。

根目錄的 `index.html` 是展示頁（搜尋、分類、預覽 iframe、收藏、自評）。唯一的後端是第 127 件「青雀真人麻將」的 WebSocket 服務（見下方）。網站內容與文件一律使用繁體中文。

## 指令

需要 Node.js 22 以上。

```bash
npm ci
npm start                 # 麻將伺服器 + 靜態檔，http://127.0.0.1:8127（/ 會轉到 127）
npm run test:mahjong      # node:test，規則引擎 + 跨實例四人房整合測試
node --test --test-name-pattern="行牌" server/jade-table/game.test.mjs   # 只跑單一測試
node --env-file=.env.local --test server/jade-table/game.test.mjs        # 對真實 Neon 驗證（需 DATABASE_URL）
```

沒有 lint、formatter 或作品頁的自動測試。大多數作品直接用瀏覽器開檔即可；透過 importmap 載入 `../vendor/three-0.186.0/` 的作品（106、108、109、111）必須經 HTTP 伺服器開啟。`npm start` 只開放白名單路徑（`index.html`、`favicon.svg`、`web/`、`assets/`、`thumbs/`、`vendor/`、`app/`），**不含 `art/`**，所以 118 的插圖在這個伺服器下會 404。

## 作品的硬性規則

原始需求見 `Prompt.md`，規劃表見 `DIRECTIONS.md`（網頁）與 `APP-DIRECTIONS.md`（App）。

- **單一檔案**：inline CSS/JS。原始 100 件與全部 App **不載入任何外部資源**：只用系統字，圖像用 CSS / SVG / Canvas 繪製，聲音用 WebAudio 即時合成。
- 已知例外：101、102 使用 Google Fonts；部分 103 以後的作品從 jsdelivr 載入 `three@0.186.0`，有些會退回 `../vendor/three-0.186.0/`。新作品要用 Three.js 時沿用同一版本。
- **設計零重複**：版面、配色、字體、動效語彙與題材都不能和既有作品雷同。開新方向前先對照 `DIRECTIONS.md` / `APP-DIRECTIONS.md`。`APP-DIRECTIONS.md` 開頭列有 App 全面禁用的樣式（藍紫漸層、Inter / Space Grotesk、發光膠囊按鈕等）。
- **驗收標準**（README 記載的方式）：以 headless Chrome 在 1440×900 與 390×844（App 為 375×667）兩種尺寸下檢查，不得有 uncaught exception、`console.error`、外部網路請求（受限作品）、缺少 viewport meta 或手機水平溢出，並另外人工看截圖。
- 作品放在 `web/` 或 `app/` 子目錄，引用共用檔案時要加 `../`（`../vendor/...`、`../assets/NNN/...`、`../art/NNN/...`）。`vercel.json` 會把舊的根目錄網址 308 轉到 `/web/`。

## 展示頁 `index.html` 的資料流

- **作品資料的唯一來源**是 `#catalog` 裡的兩個 `<ol>`（web、app）。每件作品是一個 `<li>`：`<a href="web/NNN-slug.html">標題</a>｜<span class="g">風格</span>｜<span class="c">分類</span><p class="d">說明</p>`。執行時 JS 會解析成 `works` 陣列，然後移除 `#catalog`（保留給沒有 JS 的讀者與爬蟲）。
- `.c` 必須是 `CATS.web` 或 `CATS.app` 其中之一。App 的 id 會加上前綴 `A`（`A001`），避免收藏、`#hash` 與自評撞號。
- `thumbFile()` 裡**寫死**了哪些網頁作品的縮圖是 `.svg`（其他為 `.jpg`）。App 縮圖是 `thumbs/app/NNN.jpg`（390×844），網頁作品為 640×400。
- `WEAK` 物件是「弱點自評」對話框的內容（依作品 id 對應 reason / fix），和 README 的 ⚠ 標記要一致。
- 計數在執行時重算（`#nCore` 是全部網頁作品數，含「AI 學習」簡報；`#nExtra` 是其中的簡報數），但 meta description、og:description、JSON-LD 與 FAQ 裡的靜態數字要手動更新。
- 動畫使用 `:root` 的 token（`--ease-out`、`--dur-hover` / `--dur-press` / `--dur-enter` / `--dur-exit`），並有選擇性的 `prefers-reduced-motion` 區塊。背景與「刻意不做的動畫」見 `plans/README.md`。

### 新增一件網頁作品時要同步的地方

1. `index.html`：在 web `<ol>` 加 `<li>`；若縮圖是 SVG，把編號加進 `thumbFile()` 的清單；更新上述靜態計數。
2. `README.md`：作品表格加一列（連結格式 `https://htmls-ruddy.vercel.app/web/NNN-slug.html`），並視情況更新開頭段落的編號範圍與「Three.js 從 CDN 載入」清單。
3. `llms.txt`：在對應分類的 `###` 小節下加一行。
4. `sitemap.xml`：加一個含縮圖的 `<url>` 區塊。
5. `thumbs/NNN.svg`（或 `.jpg`）。

使用者常同時開好幾個 session 各自新增作品。取號前要先查 `web/` 與 `thumbs/` 目前的最大編號（編號可能有空號）。不要重新命名不是自己寫的檔案。共用的登錄檔要用小範圍的局部編輯，不要整檔覆寫。

## 野靈旅記（131）

- 原始碼在 `games/131-wildling-trail/`（TypeScript + Vite + Phaser，Vitest 與 Playwright），有自己的 `package.json`。
- 網站仍然沒有 build step：`npm run build` 會把所有程式、樣式與程序化素材內嵌成單檔 `web/131-wildling-trail.html`，commit 的就是這個檔案。改了 `src/` 之後要重新 build，並把產出一起 commit。
- 分層：`src/core`（規則）與 `src/app`（狀態機）不能依賴 Phaser 或 DOM；畫面、輸入與音效只放在 `src/view`。
- 指令、自訂規則、測試結果與已知限制見 `games/131-wildling-trail/README.md`，需求規格見 `docs/pokemon.md`。

## 雪峰滑降（194）

- 原始碼在 `games/194-powder-peak/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/194-powder-peak.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 是無頭 Chrome 的模擬測試（跑打包後的單檔，要先 build）。
- 規格見 `games/194-powder-peak/SPEC.md`，指令、除錯參數與 `window.__game` 測試 API 見同資料夾的 `README.md`。

## 響尾蛇越野（195）

- 原始碼在 `games/195-sidewinder/`，有自己的 `package.json`：`core/` 是 Rust crate（編成 `wasm32-unknown-unknown`，純 C ABI，不用 wasm-bindgen），`blender/` 是產生賽道與模型的 Blender 腳本（`npm run assets`，輸出 `blender/out/` 要 commit），`src/` 是前端（esbuild）。
- `npm run build` 會先 `cargo build`，再把 WASM、模型、賽道與貼圖 gzip＋base64 內嵌成單檔 `web/195-sidewinder.html`；改了 `core/`、`blender/out/` 或 `src/` 要重新 build 並把產出一起 commit。`npm test` 是無頭 Chrome 驗收（跑打包後的單檔），`npm run test:core` 是 `cargo test`。
- 模組契約（SWTK／SWMS 檔案格式、WASM ABI、狀態陣列、事件）見同資料夾的 `SPEC.md`；指令、`window.__sw` 測試 API、音效掛點與 Cloudflare Pages 部署見 `README.md`。部署到 Cloudflare 需要使用者自己的帳號，不要自動執行。

## 築嵐島（196）

- 原始碼在 `games/196-stormwright/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/196-stormwright.html`，改了 `src/` 要重新 build 並把產出一起 commit。
- 模組契約（ctx、事件、Actor／Intent、建造格、風暴階段、檔案分工）見同資料夾的 `SPEC.md`；指令、`window.__sw` 測試 API 與 `tools/accept.mjs`、`tools/check-*.mjs` 驗收腳本見 `README.md`（Playwright 路徑讀 `PLAYWRIGHT_MODULE`）。

## 湖畔求生（197）

- 原始碼在 `games/197-openworld/`（Three.js 0.186.0；Vite 開發、esbuild 打包），有自己的 `package.json`；`npm run build` 輸出單檔 `web/197-openworld.html`，改了 `src/` 要重新 build 並把產出一起 commit。
- 模型與貼圖（約 55 MB）不內嵌，放在 `assets/197/`：`npm run dev` 把它當 publicDir，打包時 `import.meta.env.BASE_URL` 定義成 `../assets/197/`。`npm run assets`（含 `tools/fetch-polyhaven.mjs` 的 Poly Haven 掃描模型）／`npm run models`／`npm run characters`（Quaternius 人物與馬，需要 Blender；素材包快取在 gitignore 的 `.cache/`）也寫到那裡。
- 操作、結構與換模型的方法見同資料夾的 `README.md`，未完成的色調調整見 `HANDOFF.md`，第三方素材授權見 `CREDITS.md`；`?debug` 不請求 pointer lock，`window.__game` 可直接操作。

## 氣鬥三路（198）

- 原始碼在 `games/198-ki-lanes/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/198-ki-lanes.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 是兩種尺寸的無頭 Chrome 驗收（跑打包後的單檔）。
- 規則層（`world.js` 的 `newMatch`／`stepWorld`，以及 `units.js`、`combat.js`、`ai.js`、`items.js`、`jungle.js`、`vision.js`、`nav.js`、`map.js` 的資料部分）不碰 DOM，畫面（`main.js`）與 `node tools/sim.mjs 900` 共用同一份推進邏輯，可在 Node 跑整場 AI 對戰來調平衡。機制分析、角色技能與模組契約見 `SPEC.md`，指令與 `window.__ki` 測試 API 見 `README.md`。
- 角色是七龍珠 FighterZ 的同人致敬：模型與特效只能用程式建構，不要加入原作的貼圖、模型、圖示或音效。六名英雄在 `blender/heroes.py`（悟空與共用工具）與 `blender/cast.py`（其他五名）以 Blender 腳本建模；改完跑 `npm run models`（`tools/rig-dump.mjs` 輸出骨架 → Blender 5.2 無頭建模、刷權重、算遮蔽 → 寫 `src/models-baked.js`）再 build。改了 `models.js` 的骨架或 `models-heroes.js` 的 PROPS 比例也要重跑。Blender 只是開發依賴，`models-baked.js` 有 commit，build 不需要 Blender。

## 青雀真人麻將（127）架構

- `assets/jade-table/engine.mjs`：台灣十六張規則引擎（`MahjongGame`、`scoreHand`、台表），**瀏覽器單人模式與伺服器共用同一份**。改規則時兩邊會一起受影響。
- `assets/jade-table/art.mjs`：原創角色與大廳背景（參數化 SVG 字串）。`bust()` 座位頭像、`figure()` 大廳／結算立繪、`scene()` 月下庭園背景；座位頭像依伺服器座位號對應 `SEAT_CAST`，各客戶端一致。繪製依部位拆在 `art/face.mjs`、`art/hair.mjs`、`art/garment.mjs`（共用 `art/common.mjs`），各模組新 id 以 `${u}-f-`／`-h-`／`-g-` 分區；光源統一在右上。
- `server/jade-table/server.mjs`：`createJadeServer()` 同時提供靜態檔白名單與 WebSocket（本機為 `/mahjong`，Vercel 為 `/api/jade`）。伺服器負責裁定房號、身份、洗牌、出牌、搶牌與計台，**只傳送各玩家看得到的牌**。
- `api/jade.mjs`：Vercel function 入口，包裝 `createJadeServer` 並限制 origin。
- `server/jade-table/store.mjs`：`RoomStore`。有 `DATABASE_URL` 時用 Neon Postgres（`schema.sql` 建立 `jade_mahjong_rooms`），以版本條件更新避免多實例同時改牌局；沒有時改用行程內記憶體。房間在最後活動兩小時後失效。
- 部署、重連與斷線接手規則見 `server/jade-table/README.md`；規則來源與本桌差異見 `plans/127-jade-table-research.md`。
