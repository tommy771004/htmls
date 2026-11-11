# 282 · 仙境人生 RO LIFE

致敬《仙境傳說 Ragnarok Online》的非官方同人 2.5D 彈幕生存動作 RPG。單檔打包輸出至 `../../web/282-ro-life.html`，圖檔、3D 地圖網格、音效與精靈圖集放在 `../../assets/282/`。

## 指令

```bash
npm run build       # 以 esbuild 打包單檔 ../../web/282-ro-life.html（約 3.85 MB）
npm run build:dev   # 不壓縮開發打包
```

從作品集根目錄啟動靜態伺服器（`npx serve -l 8127`）後開啟 `http://127.0.0.1:8127/web/282-ro-life.html`。

## 架構與目錄

```
games/282-ro-life/
  tools/build.mjs               # 單檔打包腳本：內嵌 CSS 與 14 個引擎／PixiJS 模組，重寫素材路徑至 ../assets/282/，預設開啟繁體中文與單機全解鎖模式
  src/
    template.html               # HTML 介面骨架（開場登入畫面、各視窗）、手機轉向提示與檔尾的登入框腳本
    style.css                   # 第 1 行是壓縮的原始樣式；之後是深色玻璃主題（token、視窗、按鈕、卡片、HUD）與開場登入畫面版面
    engine/                     # 打包入口（main-DRFCcdKO.js、soul_linker-BDJ4Lgcc.js 與 PixiJS 8 WebGPU/WebGL/Canvas 渲染器）
    modules/                    # 分層整理的 10 大遊戲子系統原始碼：
      01-assets-and-audio.js    # PixiJS 8 圖集／調色盤載入、3D 地圖二進位格式、WebAudio 混音
      02-i18n-and-touch.js      # 斜角透視相機數學、多語系字典（繁中／英／西）與觸控虛擬搖桿
      03-world3d-renderer.js    # Three.js 3D 地圖渲染器（GND/RSW/RSM/GAT 解析、水面與地形著色器）
      04-fx-and-projectiles.js  # 8 向點陣精靈動畫、STR 粒子特效與 3D 投射物光束
      05-jobs-monsters-stages.js # 職業、魔物、關卡波次、裝備、卡片、掉落表與紙娃娃圖層合成
      06-stats-skills-talents.js # 六維屬性（STR/AGI/VIT/INT/DEX/LUK）公式、主動技能、神明祝福與天賦節點
      07-combat-and-boss-ai.js  # 60Hz 彈幕生存戰鬥主迴圈、劇情戰役、無盡之塔、Boss AI 狀態機與小地圖／DPS 統計
      08-equipment-refine-storage.js # 鐵匠霍爾格亨精煉系統、裝備評分、單機存檔管理、寵物與編年史成就
      09-lobby-websocket-party.js # 普隆德拉噴水池廣場大廳、表情與信箱系統
      10-ui-panels-and-wiki.js  # 創角預覽、角色面板、卡片鑲嵌、商店、造型師与普隆德拉大圖書館 Wiki
  gamedata/                     # 結構化匯出的 10 份 JSON 資料庫與 BOSS_AND_JOB_DEEP_DIVE.md 數值文件
```

## 除錯掛點

- **`window.__ro`**：引擎本身暴露的實例與資料表（`__ro.run`、`__ro.lobby`、`__ro.getAccount()`、`__ro.getChars()`、`__ro.items`、`__ro.monsters` 等），無頭測試用。
- **網址參數**：`?perf=1` 顯示左上角即時效能面板；`?diag` 開啟邊界框與碰撞除錯視圖。
- 原本的 F2 Debug 面板與 `window.RODebug` 已依使用者要求整個移除，不要再加回頁面上的除錯按鈕。
- **快捷列道具圖示**：原版給藥水／靈藥／祝福另畫了 `runitems/<id>.png`，但素材裡沒有這個資料夾（Safari 會顯示藍底問號的破圖），所以 `soul_linker` 不再設定 `img`，快捷列、天賦頁與撿到道具的提示都改用每個道具的 `icon`（RO 物品編號，圖在 `assets/282/items/`）。神祇格放普通攻擊（`atk_*` 沒有技能圖示）時，`Io()` 多傳遊戲實例，和技能列一樣顯示武器圖示。
- **正式站與本機走不同分支**：引擎用主機名稱（`localhost`、`127.*`、`staging.*`）判斷開發環境，只有正式站會執行像 `#dl-btn` 移除這類程式；拿掉 DOM 節點時要把引擎裡對應的 `getElementById(...)` 改成 `?.`。驗收不要只開 localhost，要用 `--host-resolver-rules=MAP ro.test 127.0.0.1` 以 `http://ro.test:8127/web/282-ro-life.html`（`npm start`）開一次，按「開始遊戲」進到選角畫面。

## 注意事項

- `tools/build.mjs` 將 `soul_linker` 內的 `js` 與 `tq` 素材基底路徑設為 `new URL("../assets/282/", document.baseURI).href`，確保 PixiJS 8 `Assets.load` 在 `/web/282-ro-life.html` 下以絕對 URL 載入 `assets/282/` 內的所有圖集、地圖與音訊，不會因相對路徑 `../` 解析差異而失敗。
- 單檔版預設啟用單機全解鎖模式（`Lh = true`）並停用遠端 `/api/`、`status.json`、`sw.js` 與 WebSocket 連線，離線或靜態託管時零 404 與零 `console.error`。
- **開場登入畫面**：背景 `assets/282/splash/login-plaza.jpg`（1024×572）是使用者給的設計圖，原圖畫死的 logo、登入框、伺服器列與版本字已用插值補掉。桌機以 cover 置中，`style.css` 的 `--s` 換算圖上座標，四個元件照圖上位置蓋回補過的區域（座標寫在該段註解）；改版面時元件不能縮得比那些區域小，否則會露出補過的模糊塊。直式手機背景改靠左、橫式手機背景放大靠左。
- **Logo**：app icon（`assets/282/app-icons/`，金框天使波利，使用者提供的 328px 原圖放大，512 版略軟）與開場登入頁的 `assets/282/splash/logo-ro-icon.png` 是同一張圖，後者只去掉金框外的深色底；登入頁以高度定尺寸（`style.css` 檔尾）。選角畫面的 `.brand-logo` 仍用舊的橫幅 `logo-ro-life.png`。
- **登入框**：引擎（`yq`／`bq`）會直接取用 `[data-sp-tab]`、`[data-sp-pane]`、四個表單、`#sp-forgot`、`#sp-recover-back`、`.sp-logo`、`.sp-soon`、`#sp-version`、`#sp-maint`、`#sp-leave` 等節點，沒有判斷 null，改 HTML 時都要留著（可以用 CSS 隱藏或搬位置）。單檔版沒有帳號後端（`nt()` 是永遠回 ok 的假函式），所以檔尾腳本 `NO_BACKEND = true` 讓帳號欄位與記住帳號一律停用，「開始遊戲」一律以訪客進入；「註冊帳號」切到原本的註冊分頁但表單鎖住並顯示「帳號功能即將推出」，選角畫面的「建立帳號」隱藏，「離開遊戲」回作品集首頁，伺服器下拉只有一個選項。
- **深色主題**：`style.css` 第 1 行裡原本寫死的淺色背景、邊框、亮色陰影與深色文字，已用一次性腳本 `tools/dark-theme/darken-line1.mjs` 轉成深色對應色（漸層字、開場、色票不動；不可重跑，會再調暗一次），轉換前的整份樣式留在 `tools/dark-theme/style-before-darken.css`、原本的藍白玻璃層在 `light-glass-layer.css`；新增樣式請寫在後面的深色主題段落，用 `--ro-*`、`--dg-*` token，不要再加淺色表面。
- **戰鬥 HUD**：照使用者給的 UI 元件拆解設計稿（方形頭像資訊卡＋紅 HP、[MVP] 紅字血條、圓形小地圖、任務標題列、資料夾式分頁），寫在 `style.css` 最後一段。狀態卡（`#basic-info`）在下方中間、技能欄（`#skillbar`）在右側中間直立、狀態效果／任務／隊伍框在左上；道具列（`#runitems`）以 `--st-h` 疊在狀態卡上面。橫式手機右邊有小地圖欄，技能欄排在它左邊。
- **手機只做橫向**：使用者要求手機只考慮橫向版面。觸控裝置直拿（`(orientation: portrait) and (pointer: coarse) and (max-width: 900px)`）時 `#rotate-hint` 蓋滿畫面，戰鬥中轉直向會送一次 Esc 打開暫停選單。新的版面只需要調桌機與橫式手機（`max-height: 500px`）；舊的直式樣式留著但不再維護。
- **引擎插入點**：`tools/build.mjs` 把打包後的引擎腳本插在 template 的 `<!-- ENGINE: ... -->` 標記，找不到標記就報錯。要被引擎翻譯（`bt()`）的靜態 HTML 必須放在這個標記之前。
- **武器／盾牌精靈圖**：`assets/282/parts/equip/wpn_*`、`sh_*` 由 `tools/grf/convert-equip.mjs <data.grf>` 從 iRO 客戶端轉出（`grf.mjs` 讀 GRF 0x200／0x300、`sprite.mjs` 解析 SPR／ACT 並把每格圖層合成成本作的 json＋索引圖＋調色盤，`png.mjs` 編解碼）。轉檔流程已用身體圖驗證：同一份 GRF 轉出的 `body_*.json` 與原檔逐格相同（奇數寬高以 `floor(x - w/2)` 對齊）。腳本讀 `tools/equip-missing.json`（manifest 原本的武器／盾牌對照）轉檔後只把轉出的項目接回 `manifest.json`（可重跑，結果相同）；`soul_linker` 的 `RW()` 對缺的圖層一律略過，所以沒有圖的組合不會卡住載入。對照：轉生職的武器沿用一轉職業資料夾，騎鳥職業的盾牌沿用沒騎鳥的資料夾，女詩人是 `무희`、騎鳥十字軍是 `신페코크루세이더`。官方客戶端沒有圖的 18 個盾牌組合（忍者、槍手、拳聖、跆拳、靈媒的護盾／圓盾，詩人與舞孃的圓盾）維持不顯示。RO 原版的武器與盾牌只在備戰（`ready`）與攻擊動作出現，站立、走路不顯示是正常的。
- **關卡橫幅**：遠征視窗載入 `assets/282/stages/<關卡 id>.jpg`（1200×450）。前七張是遊戲內低角度截圖（藏起主角、暫停後裁切），`orcs`、`pyramid` 由 GRF 小地圖 `gef_fild10.bmp`、`moc_fild01.bmp` 放大調暗而成。
- **角色面板**（`#charpanel`，`style.css` 最後的「角色面板」段落，只用 CSS 重排，沒改 DOM）：照使用者給的手遊「角色／背包」畫面。面板懸浮在遊戲畫面上：沒有視窗外框與滿版底色，各區塊是深色毛玻璃卡片。右側是直立膠囊分頁欄，裝備分數在上、返回鈕在最下。裝備頁用 grid（`.eq-work` 設 `display: contents`）排成「人物＋兩排方形裝備格｜此欄位清單」與「目前裝備｜比較」兩列。裝備格只顯示圖示、左下 GS 徽章與卡槽，名稱交給滑鼠提示，空欄位才顯示欄位名稱。格子大小由 `#charpanel` 的 `--cp-tile`／`--cp-rail` 控制，矮螢幕（`max-height: 560px`）會縮小。
- **地圖參考資料**：`gamedata/ref-maps-dvg.json` 是使用者提供的 ro.dvg.cn 地圖資料庫，共 1225 張地圖，內容包括地圖 id、簡體中文名稱、魔物表（id、名稱、數量、重生時間）與 NPC 座標。只作參考，遊戲不載入。
- **Google／LINE 登入與雲端存檔**（後端 `../../server/ro-life/`、Vercel 函式 `../../api/ro.mjs`，`vercel.json` 把 `/api/ro/*` 改寫到它；本機 `npm start` 也掛著同一套）：
  - 遊戲照舊是單機模式（`Lh = true`、`nt()` 假函式），**沒有**切到引擎原本的線上模式。原因是線上模式由伺服器裁決（`op` 買賣／精煉、`run` 領獎、無盡之塔、排行榜），要把遊戲規則搬到伺服器才能用。登入只做帳號與雲端存檔：`template.html` 檔尾的雲端腳本把 localStorage `ro-life.dev.<存檔 key>`（key 規則同引擎的 `tf`）整包 PUT 到 `/api/ro/save`，用 `rev` 做樂觀鎖。
  - 同步規則：開頁或剛登入時比對雲端與本機。雲端空的就上傳本機；本機沒有角色或上次同步後沒改過就套用雲端（寫回 localStorage 後重新載入）；兩邊都有角色且不同時跳出 `#ro-cloud-pick` 讓玩家選，**不可默默覆蓋任何一邊**。遊戲中每 45 秒與切到背景時上傳，`409`（別台裝置先存）就停止自動上傳，等下次開頁再處理。
  - 「有設定才顯示」：頁面問 `/api/ro/config`，`GOOGLE_CLIENT_ID`＋`GOOGLE_CLIENT_SECRET`、`LINE_CHANNEL_ID`＋`LINE_CHANNEL_SECRET` 各自兩個都有、而且有資料庫（`RO_DATABASE_URL`，刻意不讀共用的 `DATABASE_URL`；Vercel 上沒有就全部關閉，本機沒有就用記憶體）才回 true。靜態託管（`npx serve`）沒有 `/api`，所以 localhost 只有網址帶 `?api`（記在 sessionStorage）才會去問，避免 404 與 console.error；其他網域一律會問。
  - 登入流程：authorization code＋PKCE＋nonce，`state` 同時存在 `ro_auth_state` 與 HttpOnly cookie；Google 的 id_token 直接從 token 端點拿，只驗 iss／aud／exp／nonce，LINE 交給官方 `/oauth2/v2.1/verify`。只要 `openid profile`，不拿 email。回呼帶一次性代碼（2 分鐘）回 `#ro-login=`，頁面再用 `POST /api/ro/auth/exchange` 換 60 天的 Bearer 權杖（資料庫只存 SHA-256）。
  - 回呼網址（要在 Google Cloud Console／LINE Developers 登記）：`https://<網域>/api/ro/auth/google/callback`、`https://<網域>/api/ro/auth/line/callback`；網域可用 `RO_PUBLIC_ORIGIN` 固定，否則取請求的 host。
  - 資料表：`../../server/ro-life/schema.sql`（全部 `ro_` 前綴，參考 rAthena `main.sql` 的 login／char／inventory 改成 PostgreSQL，沒有密碼欄位），要手動套用一次：`psql "$RO_DATABASE_URL" -f server/ro-life/schema.sql`。`ro_save.doc` 是存檔本體；`ro_char`、`ro_inventory` 是每次存檔一起改寫的投影，只供查詢。rAthena 的 `item_db`／`mob_db` 沒有匯入。
  - 測試：`npm run test:ro`（根目錄；Google／LINE 用假 fetch、資料在記憶體）。真正的 Google／LINE 登入要有憑證才能試。
- **精簡化（使用者要求「簡潔為主」）**：寫在 `style.css` 最後的「精簡化」段落，圖示是 `:root` 的 `--ic-*` SVG 遮罩（顏色跟文字色）。登入只留 Google／LINE 圓形 logo 鈕（`aria-label` 是品牌名），有第三方登入時藏起單機版本來就停用的帳密欄位；登入畫面右上角的最新消息（鈴鐺，未讀紅點保留）與語系（地球）、大廳右上角 `#lobby-actions` 四顆鈕都改成圖示，原本的文字與快捷鍵由檔尾腳本寫進 `title`／`aria-label`；遠征的關卡狀態改圖示（可挑戰不顯示、鎖、時鐘、金色勾），「新！」改小紅點，裝備分數改 `GS` 標籤。新文字一律短句，不要加說明句。
