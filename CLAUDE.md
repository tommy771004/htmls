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
npm start                 # 麻將＋鹽岬大逃殺（199）伺服器 + 靜態檔，http://127.0.0.1:8127（/ 會轉到 127）
npm run test:mahjong      # node:test，規則引擎 + 跨實例四人房整合測試
npm run test:saltcape     # 199 的規則層與 WebSocket 伺服器測試
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

## 有原始碼的作品（`games/NNN-*/`）

- 共通做法：每個資料夾有自己的 `package.json`（不少是 `node_modules` 連到 `201-coral-cove/`），`npm run build` 把程式與內嵌素材打包成單檔 `web/NNN-*.html`。**網站沒有 build step，commit 的是打包後的單檔**：改了 `src/`（或 `blender/out/` 等內嵌來源）要重新 build，把產出一起 commit。`npm test` 多半是規則測試＋兩種尺寸的無頭 Chrome 驗收（跑打包後的單檔）。Blender、VOICEVOX、Kokoro 等只是開發依賴，產出有 commit，build 不需要它們。
- 各作品的架構、指令、坑與測試 API 在**各自資料夾的 `CLAUDE.md`**（碰到那個資料夾的檔案時會自動載入），細節再看同資料夾的 `README.md`／`SPEC.md`／`HANDOFF.md`。程式不在 `games/` 底下的作品，動手前要自己先讀表中的檔案。
- 部署到 Cloudflare 一律要用使用者自己的帳號，不要自動執行（195、200）。同人作品頁面上的「與原作／車廠無關」聲明、`#fanNote`、作者與授權標示都要保留。

| 編號 | 作品 | 原始碼 | 先讀 |
| --- | --- | --- | --- |
| 127 | 青雀真人麻將（唯一的常駐後端） | `assets/jade-table/`、`server/jade-table/`、`api/jade.mjs`、`games/127-jade-table/` | `server/jade-table/CLAUDE.md`（規則引擎 `engine.mjs` 由瀏覽器與伺服器共用） |
| 131 | 野靈旅記 | `games/131-wildling-trail/`（TS + Vite + Phaser） | 同資料夾 `CLAUDE.md` |
| 194 | 雪峰滑降 | `games/194-powder-peak/` | 同上 |
| 195 | 響尾蛇越野 | `games/195-sidewinder/`（Rust WASM + Blender） | 同上 |
| 196 | 築嵐島 | `games/196-stormwright/` | 同上 |
| 197 | 湖畔求生 | `games/197-openworld/`（素材在 `assets/197/`，不內嵌） | 同上 |
| 198 | 氣鬥三路 | `games/198-ki-lanes/` | 同上 |
| 199 | 鹽岬大逃殺 | `games/199-saltcape/`、`server/saltcape/`、`api/saltcape.mjs` | `games/199-saltcape/CLAUDE.md`（`src/core/` 前後端共用，地圖生成禁用 `Math.sin`／`atan2`） |
| 200 | Roadster Stunt Arena | `games/200-roadster-arena/`、`server/roadster/`、`worker/` | `games/200-roadster-arena/CLAUDE.md` |
| 201 | 珊瑚灣垂釣 | `games/201-coral-cove/` | 同資料夾 `CLAUDE.md` |
| 260 | 霓虹夜城 | `games/260-neon-nightcity/`（`src/parts/*.js` 串成同一個模組） | 同資料夾 `CLAUDE.md`，以及它列出的 `CLAUDE-gta.md`、`CLAUDE-world.md` |
| 261 | 灣岸商業帝國 | `games/261-bayfront-empire/` | 同資料夾 `CLAUDE.md` |
| 266 | 雪夜五月廣場 | 單檔 `web/266-eternauta-plaza.html`（無 build）、工具在 `games/266-eternauta-plaza/` | 改頁面前先讀 `games/266-eternauta-plaza/CLAUDE.md` |
| 267 | Groundline | `games/267-groundline/` | 同資料夾 `CLAUDE.md` |
| 268 | TERRA | `games/268-terra-sandbox/` | 同上 |
| 269 | 靜水釣遊 | `games/269-stillwater/` | 同上 |
| 270 | 裝甲進化殿堂 | 單檔 `web/270-mark-assembly.html`（無 build）、工具在 `games/270-mark-assembly/` | 改頁面前先讀 `games/270-mark-assembly/CLAUDE.md` |
| 272 | iPhone Duo 鉸鏈逐件組裝 | `games/272-iphone-duo/`（零件函式、檢查引擎、esbuild） | 同資料夾 `CLAUDE.md`（改零件或修正後要依序 bake → geo → build） |

新增有原始碼的作品時，把專屬說明寫進該資料夾的 `CLAUDE.md`，這裡只加一列。
