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

## 青雀真人麻將（127）架構

- `assets/jade-table/engine.mjs`：台灣十六張規則引擎（`MahjongGame`、`scoreHand`、台表），**瀏覽器單人模式與伺服器共用同一份**。改規則時兩邊會一起受影響。
- `server/jade-table/server.mjs`：`createJadeServer()` 同時提供靜態檔白名單與 WebSocket（本機為 `/mahjong`，Vercel 為 `/api/jade`）。伺服器負責裁定房號、身份、洗牌、出牌、搶牌與計台，**只傳送各玩家看得到的牌**。
- `api/jade.mjs`：Vercel function 入口，包裝 `createJadeServer` 並限制 origin。
- `server/jade-table/store.mjs`：`RoomStore`。有 `DATABASE_URL` 時用 Neon Postgres（`schema.sql` 建立 `jade_mahjong_rooms`），以版本條件更新避免多實例同時改牌局；沒有時改用行程內記憶體。房間在最後活動兩小時後失效。
- 部署、重連與斷線接手規則見 `server/jade-table/README.md`；規則來源與本桌差異見 `plans/127-jade-table-research.md`。
