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
- 規則層（`world.js` 的 `newMatch`／`stepWorld`，以及 `units.js`、`combat.js`、`ai.js`、`items.js`、`jungle.js`、`dragonballs.js`（龍珠獵人與神龍）、`vision.js`、`nav.js`、`map.js` 的資料部分）不碰 DOM，畫面（`main.js`）與 `node tools/sim.mjs 900` 共用同一份推進邏輯，可在 Node 跑整場 AI 對戰來調平衡。機制分析、角色技能與模組契約見 `SPEC.md`，指令與 `window.__ki` 測試 API 見 `README.md`。
- 角色模型有兩套：透過網站開啟時，13 名英雄（卡卡西以外）用 Sketchfab 的 CC BY 4.0 模型 `assets/198/<id>.glb`（約 8 MB，不內嵌；`src/boot.js` 先 `loadGlbHeroes()` 再載 `main.js`，`file:` 開啟時跳過）。原檔不進 repo（預設讀 `~/Downloads`），由 `blender -b --factory-startup --python blender/glb_heroes.py -- --only <id>` 換到遊戲骨架（`RIGS` 骨名對照；沒骨架的 `rig: 'auto'` 用量好的關節＋體素代理網格熱擴散自動刷權重）；換模型要同步 `glb.js` 的 `GLB_IDS`、`CREDITS.md`、頁面 `#fanNote` 的作者名。`npm test` 以檔案開啟（只測程式建模），`node tools/accept.mjs --http` 經網站伺服器測 GLB 版。
- 程式建模是備援：特效只能用程式建構，不要加入原作的貼圖、圖示或音效。六名英雄在 `blender/heroes.py`（悟空與共用工具）與 `blender/cast.py`（其他五名）以 Blender 腳本建模；身體（皮膚與緊身衣）與頭部改用 Quaternius 的 CC0 人體底模（和 268 同一套），由 `blender/realbody.py` 擬合到骨架、換掉標成 `realbody.skin()` 的部件與 `anime_head()` 的頭顱（頭對到動畫頭顱的顱骨橢球，頭髮與臉部貼花的位置不變），衣物、頭髮、臉部貼花與特效仍是腳本建模（作法見同資料夾 README）。改完跑 `npm run models`（`tools/rig-dump.mjs` 輸出骨架 → Blender 5.2 無頭建模、刷權重、算遮蔽 → 寫 `src/models-baked.js`）再 build。改了 `models.js` 的骨架或 `models-heroes.js` 的 PROPS 比例也要重跑。Blender 只是開發依賴，`models-baked.js` 有 commit，build 不需要 Blender。
- 音效在 `src/sfx-dsp.js` 以樣本級合成（開場預算多個變體）、`src/audio.js` 播放與配樂；角色日文語音由 `tools/voices/build_voices.py` 用 VOICEVOX 離線合成成 MP3 內嵌到 `src/voices.js`（有 commit，build 不需要 VOICEVOX）。改台詞或配音要重跑該腳本，並維持頁面 `#fanNote` 與 README 的「VOICEVOX:角色名」標示。

## 鹽岬大逃殺（199）

- 原始碼在 `games/199-saltcape/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/199-saltcape.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 跑規則與伺服器測試（`tools/sim.test.mjs`、`tools/net.test.mjs`）再跑兩種尺寸的無頭 Chrome 驗收；`npm run mp` 開兩個瀏覽器分頁走完建房、分享網址加入、起飛、互射與換線接手；`npm run sim` 在 Node 跑整場 AI 對戰。
- `src/core/`（地圖、物理、規則、毒圈、`Match` 對局與 AI）不碰 DOM，**伺服器與瀏覽器共用同一份**：伺服器用它裁定，前端用它做移動預測與離線練習。地圖由固定種子生成，只能用整數雜湊與加減乘除（`rng.js` 的 `csin`／`ccos`），不要在地圖生成裡用 `Math.sin`／`atan2`，否則不同瀏覽器的碰撞會和伺服器對不上。地圖是美式海島（13 個城鎮、南北向河道與 4 座橋）；改了 `TOWNS` 或測試用的座標，`tools/sim.test.mjs`、`tools/accept.mjs`、`tools/mp.mjs` 裡寫死的位置也要跟著換。
- 伺服器 `server/saltcape/server.mjs`（`createSaltcape()` 掛在 `npm start` 的伺服器上，`createSaltServer()` 給 Vercel 的 `api/saltcape.mjs`；兩者都接受 `/api/saltcape` 與 `/saltcape`，前端一律連 `/api/saltcape`）；`server/jade-table/server.mjs` 的 `onUpgrade` 讓兩個遊戲共用 8127 埠。房間只存在單一行程的記憶體，Vercel 多實例時好友可能分到不同實例，前端會收到 `notfound`／`lost` 明確提示；前端每 200 秒換一條新連線接手（Vercel 連線 300 秒上限）。
- CC0 貼圖、天空 HDRI、車輛、道具與士兵模型放在 `assets/199/`（約 18 MB，不內嵌），頁面需透過網站伺服器開啟；以檔案開啟時退回程序貼圖與方塊人，不能報錯。`node tools/fetch-assets.mjs` 重抓（需要 curl、unzip、cwebp、sips），士兵與 IK 烘焙的步槍動畫用 `blender -b -P tools/build-soldier.py`（借 `games/197-openworld/.cache/` 的 Quaternius 素材包），外觀模組、槍、家具分別是 `build-kit.py`、`build-guns.py`、`build-furniture.py`（Blender 5.x，action 要指定 slot 才會套用）；家具尺寸要和 `map.js` 的 `FURN` 表一致。來源見 `CREDITS.md`。`npm start` 的靜態白名單要能送出 `.hdr`、`.gltf`。
- 協定、輸入位元與快照格式見 `SPEC.md`，操作與限制見 `README.md`；`window.__sc` 的 `solo()`、`place(x, z, mode)`、`give(w)`、`look(yaw, pitch)`、`bring(n)` 可在離線練習裡直接擺位置截圖。截圖與驗收工具用 `tools/lib.mjs` 的 `serve()` 在同一行程起網站伺服器；畫質預設「高」（級聯陰影＋泛光），`?q=low|mid|high|ultra` 或選單切換。

## Roadster Stunt Arena（200）

- 原始碼在 `games/200-roadster-arena/`（Three.js 0.186.0 + Rapier `@dimforge/rapier3d-compat` + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/200-roadster-arena.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 先跑 Node 測試（`tools/sim.test.mjs`：手感、任務、計時賽、聯賽規則與 AI、大廳／房間／排行榜、本機 WebSocket 兩人整合），再跑兩種尺寸的無頭 Chrome 驗收；`node tools/mp.mjs` 開兩個分頁走完快速配對、分享網址加入、球權與進球同步。舊的「車球碗」`web/200-carball.html` 已由它取代，`vercel.json` 308 轉址。非官方同人作品，頁面與 README 要維持「與車廠無關」的聲明，不要加入車廠標誌。車輛模型是 Sketchfab 上 asiphy007 的 CC BY 4.0 同人模型（原檔放 gitignore 的 `.cache/`），`npm run car`（`tools/car.mjs`）切輪、減面、濾法線後輸出 `assets/roadster.glb`（有 commit），打包時 gzip＋base64 內嵌；主選單 `#fan`、展示間與 `assets/CREDITS.md` 的作者與授權標示要保留。
- Rapier 內建的 base64 WASM 在打包時被換掉：`tools/build.mjs` 把 WASM 以 gzip＋base64 內嵌，頁面用 `DecompressionStream` 解開。升級 Rapier 版本後打包失敗，多半是那段 base64 的寫法變了。
- `src/core/`（車輛控制、特技場與聯賽球場、任務與計時賽、聯賽規則與 AI）與 `src/net/core.js`（`LobbyCore`／`RoomCore`／`BoardCore`）不碰 DOM。`net/core.js` 由本機 `server/roadster/server.mjs`（`createRoadster()`，經 jade 伺服器的 `onUpgrade` 掛在 8127 的 `/api/rsa`）與 `worker/index.js`（Cloudflare Durable Objects）共用；伺服器不跑物理，每人模擬自己的車、球由球權人模擬，伺服器裁定球權與進球。協定見 `SPEC.md`。
- 頁面找伺服器：`RSA_SERVER` 打包變數 → `?server=` → localhost／127.0.0.1 同網址 → 否則離線（Vercel 與以檔案開啟都是離線，不會發 WebSocket）。Cloudflare 部署要用使用者自己的帳號，不要自動執行。操作、`window.__rsa` 測試 API 與已知限制見同資料夾的 `README.md`。

## 珊瑚灣垂釣（201）

- 原始碼在 `games/201-coral-cove/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`；`npm run build` 輸出單檔 `web/201-coral-cove.html`，改了 `src/` 或 `blender/out/` 要重新 build 並把產出一起 commit。`npm test` 是兩種尺寸的無頭 Chrome 驗收（跑打包後的單檔）。
- 所有模型（漁夫、棧橋、船、木箱、魚簍、珊瑚、海草、魚）都由 `blender/*.py` 以 Blender 5.2 無頭腳本建模、綁骨與做動畫（共用工具在 `blender/common.py`，action 要指定 slot、以 NLA 軌匯出），`npm run assets` 重建 `blender/out/*.glb`（有 commit，build 不需要 Blender），打包時以 gzip＋base64 內嵌。節點、骨頭與動作名稱是遊戲取用的契約，見 `SPEC.md`；改資產後用 `node tools/view.mjs <glb> --node … --anim …` 在 three 裡截圖檢查。
- 操作、`window.__cc` 測試 API 與已知限制見同資料夾的 `README.md`。

## 霓虹夜城（260）

- 原始碼在 `games/260-neon-nightcity/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 把 `src/parts/*.js` 依檔名順序串成**同一個模組**（共用頂層變數，後面的檔案直接用前面宣告的東西）再打包成單檔 `web/260-neon-nightcity.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 是兩種尺寸的無頭 Chrome 驗收（走完整段任務），`npm run thumb` 產生縮圖。
- 不規則城市（`plans/260-irregular-city.md`）：生成全部在方格的「邏輯座標」跑，`05-zones.js` 的三區 `ZONES` 各有剛體變換（A 不動、B 轉 8°、C 轉 4°），網格掛在區的 `Group`、碰撞盒帶區的框 `f`，開場 `cityWorld()` 把碰撞、光源與錨點換成世界座標；玩家、車流、地圖都是世界座標。區之間的縫 `SEAM`、`06-roads.js` 的連接道路與 `10-city.js` 的岬角 `CAPES` 是世界座標。新程式碰到位置先想清楚是邏輯還是世界（`toW`／`toL`、`spotW`，世界座標的圓柱與光源標 `w: 1`、實例標 `zn: null`），改完要跑 `NC_QUERY='?zrot=25' npm test` 與 `test:glb`（整座城再轉 25°，單位變換驗不出漏掉的換算）；驗收腳本用 `__nc.tpL`／`W`／`L`／`Ws`，不寫死世界座標。存檔第 5 版起位置是世界座標。
- 內嵌 `blender/out/` 的 `interior_props`、`street_props`、`people`、`traffic` 四個 GLB；車流（計程車、警車、房車、貨車共 16 型）是 `tools/traffic.mjs`（`npm run traffic`）從 `assets/260` 實車與 DanielZhabotinsky 的虛構廠牌車烘成的近遠兩級模型；後者原檔在 gitignore 的 `.cache/cars/`，先由 `cars.mjs` 裡標 `traffic: true` 的項目（`TRAFFIC=1 node tools/cars.mjs`）整理到 `.cache/traffic/`，程式建模的車只在 `traffic.glb` 載入失敗時頂替。人物是 Quaternius CC0 底模（`blender/people.py` → `npm run people` 壓縮），`40-people.js` 每人一個 SkinnedMesh，骨架不在場景圖裡、只在畫面內才擺姿勢；動畫庫沒有的動作在播放後用 `aim()` 覆寫骨頭方向，`node tools/pose-gallery.mjs` 截圖檢查。
- 實體建築與道具：`npm run props`（`tools/props.mjs`）把 `.cache/props/` 的 Sketchfab 原檔（DanielZhabotinsky 四套建築組、拉麵攤、點唱機、街機、升降機、工具推車）處理成 `assets/260/props/*.glb` 與 `props.json`（有 commit）；建築組的窗戶遮罩改寫成「R＝玻璃、G＝窗戶編號」的無損貼圖，`26-glb.js` 的 `USE_WINMAP` 依編號點亮每扇窗。`10-city.js` 挑出換成模型的連續地塊（`bldPlace`、`L.glb`，不建程式立面），`27-props.js` 下載後依材質合併擺放，失敗用 `lotFallback()` 補回立面；只在 http(s) 下載，開始畫面會等建築與拉麵攤，室內道具走進酒吧／車庫才下載（`propSwap`／`propWake`）。
- GTA 式擴充：`68-gta.js`（第一階段：搶車、車損、路人倒地、`castRay`／`rayHooks`）→ `69-combat.js`（武器表 `ARMS`、轉盤與子彈時間 `slowmo`、投射物與 `blast`、生命護甲、WASTED／BUSTED、路人 FSM）→ `69-crew.js`（第三階段三主角、特殊能力倍率 `abil`、高空切換、噴漆消星）→ `69-events.js`（第四階段運鈔車）→ `69-gps.js`（導航路線）→ `69-heist.js`（搶銀行流程 `heist.st`，換人一律走 `heistFade`，`transition()` 淡出中會直接 return）→ `69-market.js`（股市 `STOCKS`、資產 `ESTATES`、電訊箱）→ `69-phone.js`（NeonPhone、空投、證交所與置業畫面、快速存檔）→ `69-police.js`（熱度與星級、視線錐（`coverClear`／`heliSees` 看樹、貨車與屋頂）、警車／SWAT／戰車、直升機、路障）→ `69-squads.js`（第四階段小隊：共用戰鬥人員池 `SQ.f` 的幫派／傭兵／搶劫隊友、小隊車照警察路網開、幫派追殺 `gangChase`、資產防守 `defStep`、傭兵 `mercCall`、搶劫撤離的隊友 `squadHeist`；`fAlly` 只有 merc／crew，第五階段的搶包賊 `thief` 不開槍；`calm` 的人站著聊天、`grp` 是所屬活動、`onDown` 倒下時呼叫）→ `69-street.js`（第五階段街頭事件：搶包賊、幫派交易、懸賞逃犯車，和運鈔車共用 69-events 的排程，一次一件 `ev.cur`）→ `69-stunt.js`（20 座跳台的飛行與翻滾，`99-main.js` 在 `v.air` 時用 `stuntFly(v, inp, dt)` 代替 `driveVehicle`）→ `69-survival.js`／`69-tale.js`／`69-turf.js`（第五階段生存模式、支線委託、幫派地盤）；第五階段的活動都掛在 `69-side.js`（排在 69-squads 之前）的 `side.act` 上（同一時間一項，`sideBusy()`、`sideStart`／`sideEnd`、`sideDone` 結算、`fRoom(n)` 先收倒地的戰鬥員騰出空位；`crime()` 會問 `evBountyNear` 與 `side.act.noCrime`），街頭賽在 `69-race.js`；名稱都要原創。持槍姿勢是 `40-people.js` 的 `gunPose`（`GUN_HOLD` 握點，兩手 IK，`held().ik` 驗收）；存檔 `nc260.motors` 第 6 版（第 3 版多了 `game`、`stunts`、`stk`、`props`，第 4 版加上離線補算用的 `ts` 與停業時間 `props.pause`，第 5 版位置改成世界座標，第 6 版加上第五階段的 `side`；快速存檔的 `game` 帶座駕 `veh` 與安全屋 `where`），改欄位要同步 65 的讀檔檢查與 69-market 的 `stkInit`／`estInit`；數值照使用者提供的 `neon_nightcity_gta_v_2.md`，`window.__nc.gta`（含 `.wanted`）可直接設星級、生成單位截圖。69 開頭的檔案排在 70 之前，頂層不能用 `post`、`camState`、`keys`、`bigmap`、`ctxHooks`、`W` 等後面才宣告的東西（函式裡可以）；武器模型 `assets/260/props/arms.glb` 由 `tools/props.mjs` 產生，直升機、戰車、路障在 `traffic.glb`。開始畫面 `#fanNote` 的「與 Rockstar Games 無關」聲明與模型授權說明要保留。
- 城區與安全屋（使用者給的 `~/Downloads/World`，原檔複製到 gitignore 的 `.cache/world/`；使用者要求全部檔案都用上，Sketchfab Standard 授權的也用，每個檔案的授權與拿掉的部分記在 `assets/260/CREDITS.md`）：城市是 20×15（`NX`／`NZ`，原本 5×5 在西北角、第一輪 8×7 在外圍，`X0`／`Z0` 沒變；街區依 0／1／2 三階段產生，舊地塊亂數序列不變，第二輪的區域在 `DISTRICTS` 表）；整個街區換模型寫死在 `10-city.js` 的 `wholeBlocks()` `PLAN`（冠石的 `bld_fin`、光環的 `bld_cyber` 14 群加 `bld_fin` 三群、灰石的 `grey_18`／`grey_30`／`grey_31`、楓林里與公園大道的 `nbh_01`），雲杉坡混入 `bld_res`（abhayexe 公寓）。城市變大後靠 `distCull`、`instUpdate`、`bldUpdate`（520 m 內才下載建築組）與碰撞空間索引（`boxesNear`／`circlesNear`；增刪碰撞物後要 `colDirty()`）撐住效能，車流與路人在玩家附近重生。`tools/props.mjs` 的 `winAuto`（照片立面自動找窗）／`winRects`／`winBlue`／`curtain`（帷幕牆格狀窗）／`winWhole`（整棟一個窗燈亂數）是給這些沒有窗戶遮罩的模型用的，`tint` 壓掉鏡面、`heavy` 單獨減高面數小零件、`lightPath` 記下原檔路燈（頁面在 20-props 補點光）、`texEdit`（真實品牌廣告換成原創、招牌模糊）／`dropBox`／`clip`／`groundY`／`far`（遠景）。海岸在 `21-coast.js`（地形矩形 `BEACH`／`QUAY`／`BRIDGE`／`ISLE`／`PIERS` 與擋牆在 `10-city.js`）：島上 `ISLE_SITES` 與遠景 `FAR_SITES` 的模型由 27 的 `COAST_MODELS` 下載，擺好後替身要 `removeFromParent()`（`distCull` 每幀重設 `visible`，只設 `visible = false` 會被打開）；島上兩個基地的碰撞是 `tools/foot.mjs` 量模型寫進 `props.json` 的 `foot`（換了 `isle_*` 模型要重跑，`props.mjs` 重做那組會把 `foot` 洗掉）；遠景材質 `FAR` 不算積水反射。遊艇在 `31-boats.js`（`vehicles` 裡 `boat: true` 的載具，`99-main.js` 換成 `driveBoat`，下船走 `boatExit`；船只能留在 `LANDS` 之外），擋牆上的梯子是 `10-city.js` 的 `LADDERS`（擋牆在梯子處斷開成 `swim`）；對岸走得上去的只有 `10-city.js` 的 `BANK_WALKS`／`FERRY`（`FAR_BANK_X`／`EAST_BANK_X` 也定義在那裡，`back` 那一邊是高牆），`21-coast.js` 的 `farClamp` 擋住其他堤岸；城北的北嶺公園：`10-city.js` 的 `NPARK`（範圍對齊 21-coast 第一層山脊的格線、`parkH()` 坡面高度、`groundHL` 在範圍裡回傳它）、畫面在 `21-park.js`；樓牆開門切到的地塊原件標 `ghost`（立面迴圈與 20-props 的窗台設施照原寬度抽 `rnd()` 不蓋東西）、切剩的 `piece` 用自己的亂數，改到 `rnd()` 的序列會讓 BODEGA 等依亂數擺的東西跑位，動到地塊時要沿用這個做法；步行 NPC 在坡上的高度用 `footY()`；會動的碰撞（岸橋腳、集卡）每幀重建到 `30-vehicles.js` 的 `dynCircles`（世界座標，不進空間索引）；貨櫃船以 `harbor.root` 為船心轉向開走，模型要掛在 root 底下。安全屋在 `69-safehouse.js`：`APT_IDS` 六間（`loft`／`villa`／`office`／`mini`／`l16`／`i14`）是 dasy444 的室內（`apt_<id>`，保留原檔座標，碰撞框照原檔量；以檔案開啟用程式建模房間），天際置業 `ESTATES` 裡 `home: true` 的六筆（島上 `office` 另有收入）；`quickSave(at)` 帶門口位置就能在室內存檔。`__nc.tp` 會先回到戶外，室內擺位置要直接改 `player.x`／`z`。
- 車行與車庫：車型目錄 `CARS` 與 `carKit()` 在 `25-cars.js`（程式建模的車只取經典車款的剪影比例，車名虛構、不放廠牌字樣或標誌；現在只用於車流與替身）；門面在 `55-motor-front.js`（要在 60 把 `signLights` 複製成 `outLights`、合併 `signMesh` 之前）；展示廳、車庫、買車／試駕／出庫／賣車與甩尾打賞在 `65-motors.js`。室內場館都登錄在 60 的 `VENUES`，互動提示可以掛進 `ctxHooks`；玩家座駕只有一個物件（沿用 `kestrel` 變數），換車一律走 `applyCar(v, id, paint)`；搶來或打壞的車流車是 `68-gta.js` 的 `detachCar()` 建的臨時載具（`kind: 'jack'`，不進存檔、不走 applyCar），GTA 式擴充的範圍與未做的階段見同資料夾 README；存檔在 `localStorage` 的 `nc260.motors`。
- 實車模型：車行與車庫只賣 29 台 Sketchfab 的同人實車模型（日系、BMW、Porsche、Ferrari 等與 4 台機車；CC BY 與 CC BY-NC-SA，保留原廠名稱與彩繪，看車對話標作者與授權，來源見 `assets/260/CREDITS.md`），開場座駕是 `STARTER`（AE86）、路邊機車是 `STREET_BIKE`（ZX-6R）；程式建模的車只留給車流與沒下載到模型時的替身。`npm run cars`（`tools/cars.mjs`，借 197 的 gltf-transform、meshoptimizer、sharp）把 gitignore 的 `.cache/cars/` 原檔處理成 `assets/260/<id>.glb`（約 51 MB，有 commit）與 `cars.json`（打包進頁面）；目錄與貼圖版 uber 材質在 `26-glb.js`。頁面只在 http(s) 下、走進車行／車庫、走近車行門口或換成那台車時才下載（座駕與路邊機車開場就下載），以檔案開啟用 `proxy` 程式建模替身。`npm run test:glb` 以本機 HTTP 驗收實車，`node tools/car-view.mjs <id>` 四視角檢查方向與輪子拆分。車窗射擊的座椅高度與前後位置由 `node tools/seats.mjs` 量車頂輪廓寫進 `cars.json` 的 `db`。
- three r186 的 `new Color(hex)` 已經是線性值，不要再 `convertSRGBToLinear()`（重複轉換會讓整個畫面變暗變髒）。招牌字圖集是 2048×2048，新增招牌格子前先算會不會超出（超出會 `console.warn`）。各檔分工、`window.__nc` 測試 API 見同資料夾的 `README.md`，城市尺寸、場館、任務與渲染流程見 `SPEC.md`，限制與未做的項目見 `HANDOFF.md`。

## 灣岸商業帝國（261）

- 原始碼在 `games/261-bayfront-empire/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 輸出單檔 `web/261-bayfront-empire.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 先跑 `tools/econ.test.mjs`（經濟、海港、v1／v2→v3 存檔遷移）再跑兩種尺寸的無頭 Chrome 驗收；`npm run sim` 在 Node 跑經濟模擬看節奏。
- `src/data.js`／`src/econ.js`／`src/port.js` 不碰 DOM 與 three，海灘商家與城市商家共用同一份 `BIZ` 格式與 `arrivalPerMin` → `serve` 流程；物流與海港（供應成本、補給船、岸橋、合約）在 `port.js`，由 `econ.js` 的 `serve`／`tick` 呼叫，`src/portview.js` 只讀狀態畫出來。改存檔欄位要同步 `migrate()`／`sanitizePort()` 與測試；v1 是海灘改版前、v2 是物流改版前的格式，開始畫面的兩個「試玩」按鈕各載入一份舊存檔。
- 規格、存檔格式與效能策略見同資料夾的 `SPEC.md`，指令與 `window.__bf` 測試 API 見 `README.md`。

## 雪夜五月廣場（266）

- 單檔 `web/266-eternauta-plaza.html`，沒有 build。場景 splat、玩家 FBX 與動畫從上游 santisiri/eternauta-online 的 GitHub 固定版本即時下載（Spark 2.3.1 + Three.js 0.186.0 由 CDN 載入）。
- 延伸玩法（任務、喪屍、武器、裝備）用到的 `.spz` 在 `assets/266/`：網路上沒有授權清楚的喪屍／武器 splat，所以由 `games/266-eternauta-plaza/tools/bake.mjs` 把 Quaternius 與 Poly Haven 的 CC0 模型在無頭 Chrome 裡烘焙成 SPZ v2；喪屍另有 `.skin`（Spark `SplatSkinning` 權重）與 `manifest.json` 裡的骨架和動畫。改了烘焙參數要重跑並 commit `assets/266/`。`npm start` 的伺服器已能送出 `.spz`、`.skin`。
- 格式、來源與指令見 `games/266-eternauta-plaza/README.md`；`window.__eter` 的 `spawn`／`give`／`mission(i)`／`god`／`clear(x, z)` 可直接擺場景測試。

## Groundline 機場停機坪即時調度（267）

- 原始碼在 `games/267-groundline/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 輸出單檔 `web/267-groundline.html`，改了 `src/` 或 `blender/out/` 要重新 build 並把產出一起 commit。`npm test` 先跑 `tools/sim.test.mjs`（過站六步驟、車輛指派、優先順序與連鎖延誤傳遞），再跑兩種尺寸的無頭 Chrome 驗收。
- 所有 3D 資產（`Terminal` 弧形玻璃屋頂航廈、`Jetbridge_1..5`／`JetbridgeRotunda`／`JetbridgeArm` 空橋、`Aircraft_A320`／`B738`／`A321`／`E190` 客機、`FuelTruck`、`BaggageTug`、`CateringTruck`、`CleaningVan`、`PushbackTug`、`FuelTankFarm` 油槽）由 `blender/build_apron.py` 以 Blender 無頭模式建模並匯出 `blender/out/groundline.glb`（有 commit，build 不需要 Blender），打包時以 gzip＋base64 內嵌。
- 規格與 `window.__gl` 測試 API 見同資料夾的 `SPEC.md` 與 `README.md`。

## TERRA 地球尺度開放世界沙盒（268）

- 原始碼在 `games/268-terra-sandbox/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 輸出單檔 `web/268-terra-sandbox.html`，改了 `src/` 要重新 build 並把產出一起 commit。`npm test` 先跑 `tools/engine.test.mjs`（`src/core/selftest.js` 的 31 項自我測試：圖磚串流與 LRU、建物與室內、窗燈、天氣與縮時、七種載具與纜車、攝影與日誌、OSM 真實街道），再跑兩種尺寸的無頭 Chrome 驗收（截圖在 gitignore 的 `dist/`，並輸出 `thumbs/268.jpg`）；`node tools/shot.mjs out.png "<js>;;wait 500"` 可擺好場景截一張除錯圖。六個地點的真實街道是 `data/osm/*.json`（`npm run osm` 由 `tools/fetch-osm.mjs` 從 OpenStreetMap 與 Terrarium 高程烘焙，有 commit，build 時 gzip＋base64 內嵌，頁面不連網；`?map=proc` 或設定切回程序街道），人物模型由 `npm run people`（Blender，素材借 197 的 `.cache/`）產生 `blender/out/people.glb`。
- `src/core/`（世界生成、圖磚串流、室內、天氣、車流、玩家）不碰 DOM 與 three，供瀏覽器與 Node 測試共用；`src/gfx/` 是畫面層（合併幾何 `Builder` 帶頂點色與 `atl` 圖集矩形，所有世界網格共用 `atlas.js` 的一個材質）。朝向 `yaw` 0 = 北（-z），three 的 `rotation.y = -yaw`。建地是 `blockRect`（路緣到路緣）再往內退 `K.walk`。`OsmWorld`（`osm.js`）沿用 `World` 介面，矩形建物有自己的局部座標（`localView`／`toWorldDir`）；夜間窗燈的房間規則在 `lights.js`（`roomLightP`），著色器的 `roomP` 要和它一致。改了 `world.js` 的建物或地點座標，`selftest.js` 與 `tools/accept.mjs` 寫死的位置要一起檢查。各檔分工與 `window.__terra` 測試 API 見同資料夾的 `SPEC.md` 與 `README.md`。

## 靜水釣遊（269）

- 原始碼在 `games/269-stillwater/`（Three.js 0.186.0 + esbuild），有自己的 `package.json`（`node_modules` 連到 201 的）；`npm run build` 輸出單檔 `web/269-stillwater.html`，改了 `src/` 或 `blender/out/` 要重新 build 並把產出一起 commit。`npm test` 先跑 `tools/core.test.mjs`（魚種表、品質判定、收線可釣性、地圖、出魚、主線、存檔）再跑三種尺寸的無頭 Chrome 驗收（實際划船、拋竿、提竿、收線到釣起），`npm run thumb` 產生縮圖。
- 船、漁夫（`sit`／`row`／`row_L`／`row_R`／`cast`／`wait`／`hook`／`reel`／`cheer` 動作）、環境物件與 55 種魚都由 `blender/*.py` 建模（Blender 5.2，共用工具在 `common.py`／`meshkit.py`），`npm run assets` 重建 `blender/out/*.glb`（有 commit，build 不需要 Blender）。節點名、契約材質（`hull_paint`／`hat_ribbon`／`lamp_glow`／`win_glow`）與划槳公式見 `SPEC.md`；槳的角度由 `src/core/boat.js` 的 `oarPose()` 計算，必須和 `blender/rowing.py` 一致。
- `src/core/`（魚種表、品質、收線、地圖、船的物理、主線與委託、存檔）不碰 DOM 與 three；`src/view/` 是畫面，`src/game.js` 串起迴圈、面板動作與 `window.__st` 測試 API（`toSpot(k)`、`toCp(k)`、`setTime(min)`、`unlockAll()`、`fillBook(n)`、`give(id, tier)`、`act(type, down)`），`src/ui/` 是 HUD 與面板。座標：北方 −Z、船頭 = (sin yaw, cos yaw)，漁夫面向船尾坐，釣魚時整艘船轉成船尾朝釣點。存檔在 `localStorage` 的 `st269.save`。
- 指令、操作與已知限制見同資料夾的 `README.md`。

## 裝甲進化殿堂（270）

- 單檔 `web/270-mark-assembly.html`（本地 Three.js 0.186.0，介面沿用 182），沒有 build；裝甲網格是 `assets/270/{bruno,mk3,mk7,mk1,mk38,mk44,mk46,mk47,mk85}.glb`（meshopt 壓縮，解碼器在 `vendor/three-0.186.0/addons/libs/`），要透過網站伺服器開啟。
- GLB 由 `games/270-mark-assembly/tools/bake.py`（Blender 無頭）從 Blend Swap 的三個 `.blend` 與 Sketchfab 的六個 GLB（`MODELS` 裡 `glb=` 的項目，不必先開 .blend）拆成十九個部位、材質換成 `role_p／s／t／k／g` 塗裝角色（85 的寶石是 `role_g_<色碼>`，保留原色）；來源檔在 gitignore 的 `.cache/`。Mark 46／47 是 T 字站姿，依骨架權重分部位並把手臂放下。three 會把節點名的「.」拿掉，頁面用 `PART_RE` 還原。Mark 1、3、7、38、44、46、47、85 是實體模型；Mark 16、17、25、33、39、41、49、50 由 `tools/derive.py` 從實體模型改造（先照 bake.py 拆件、不匯出，再改比例、包外殼、加零件，輸出 `assets/270/mk{16,17,25,33,39,41,49,50}.glb`，頁面標 `kit: true`）；其他型號換色近似，頁面要維持「實體模型／改造／近似」標示、授權面板與「非官方同人作品」聲明；`bruno.glb` 是 CC-BY-SA 3.0、`mk1.glb` 是 CC BY-NC-SA 4.0 衍生作品，要維持同樣授權。
- 型號資料 `MARKS`、部位與自組裝幀區間 `PART`、`window.__mk` 測試 API 與重新烘焙指令見 `games/270-mark-assembly/README.md`，授權見同資料夾的 `CREDITS.md`，進度、待辦與改造做法的取捨見 `HANDOFF.md`。

## 青雀真人麻將（127）架構

- `assets/jade-table/engine.mjs`：台灣十六張規則引擎（`MahjongGame`、`scoreHand`、台表），**瀏覽器單人模式與伺服器共用同一份**。改規則時兩邊會一起受影響。
- `assets/jade-table/art.mjs`：原創角色與大廳背景（參數化 SVG 字串）。`bust()` 座位頭像、`figure()` 大廳／結算立繪、`scene()` 月下庭園背景；座位頭像依伺服器座位號對應 `SEAT_CAST`，各客戶端一致。繪製依部位拆在 `art/face.mjs`、`art/hair.mjs`、`art/garment.mjs`（共用 `art/common.mjs`），各模組新 id 以 `${u}-f-`／`-h-`／`-g-` 分區；光源統一在右上。
- `server/jade-table/server.mjs`：`createJadeServer()` 同時提供靜態檔白名單與 WebSocket（本機為 `/mahjong`，Vercel 為 `/api/jade`）。伺服器負責裁定房號、身份、洗牌、出牌、搶牌與計台，**只傳送各玩家看得到的牌**。
- `api/jade.mjs`：Vercel function 入口，包裝 `createJadeServer` 並限制 origin。
- `server/jade-table/store.mjs`：`RoomStore`。有 `DATABASE_URL` 時用 Neon Postgres（`schema.sql` 建立 `jade_mahjong_rooms`），以版本條件更新避免多實例同時改牌局；沒有時改用行程內記憶體。房間在最後活動兩小時後失效。
- 部署、重連與斷線接手規則見 `server/jade-table/README.md`；規則來源與本桌差異見 `plans/127-jade-table-research.md`。
- 大廳與胡牌結算的 3D 立繪：`assets/jade-table/figure3d.mjs` 載入 `assets/jade-table/figures/<角色>.glb`（只在 http(s) 下載入，失敗時保留插畫）。GLB 由 `games/127-jade-table/tools/figures.mjs` 從 Sketchfab 原檔產生，骨頭對照寫在場景 extras 的 `rig`；遠山的原檔沒有骨架，先跑 `blender/rig_katya.py`。青雀與遠山是遊戲角色的非官方同人模型，規則帖的作者標示與 `assets/jade-table/CREDITS.md` 要保留。細節見 `games/127-jade-table/README.md`。
