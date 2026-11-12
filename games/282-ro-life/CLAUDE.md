# 282 · 仙境人生 RO LIFE

致敬《仙境傳說 Ragnarok Online》的非官方同人 2.5D 彈幕生存動作 RPG。單檔打包輸出至 `../../web/282-ro-life.html`，圖檔、3D 地圖網格、音效與精靈圖集放在 `../../assets/282/`。

目前進度與下一步（大廳 Worker 待部署）見 `HANDOFF.md`。

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

- **素材根目錄 `window.__RA`**：`tools/build.mjs` 在 `<head>` 第一行設定它，`soul_linker` 的 `js`／`tq` 與 main 裡所有 `assets/` 字串都改接它（樣板字串用 `${window.__RA}`，一般字串用 `window.__RA+"…"`；漏改會讓 build 失敗）。正式站（`htmls-ruddy.vercel.app`）指到 Cloudflare 的 `ASSET_CDN`（`https://ro-assets.tommy771004.workers.dev/`），其他網址指到 `../assets/282/` 的絕對網址。登入畫面的背景、logo、app icon 與 `og.jpg` 仍走 Vercel（約 10 個檔）。`npm run build -- --no-cdn` 可全部改回 Vercel；測試時可用 `addInitScript` 預先設定 `window.__RA`。
- **素材放在 Cloudflare**：一次進到廣場就有約 2,900 個素材請求（技能圖示 1,500、物品 342、精靈圖 280、地圖 340），所以正式站改從 `assets-worker/`（只有靜態素材、沒有程式的 Worker，請求免費不限量）讀。CORS 與快取標頭寫在 `assets/282/_headers`：全部 7 天，`manifest.json` 5 分鐘。**新增或換掉素材後，要在 `assets-worker/` 再執行一次 `npx wrangler deploy`**（使用者自己的帳號，不要自動執行），否則正式站讀不到新檔；換同名檔，玩家最多要 7 天才看得到，要立刻生效就改檔名並更新 manifest。Vercel 上的 `/assets/282/*` 保留，供本機與 `--no-cdn` 使用（`vercel.json` 的快取標頭不變）。**跨網域的圖要畫到 canvas 再輸出（`toDataURL`／`getImageData`）時，那張 `Image` 要先設 `crossOrigin="anonymous"`**，否則 canvas 受污染、輸出丟錯；引擎的怪物頭像 `Ge()` 會吞掉錯誤變成空圖，而且本機（同網域）重現不了。驗收這類畫面要把素材放到另一個來源：`addInitScript` 設 `window.__RA` 指到另一個埠、該埠回 `Access-Control-Allow-Origin: *`。
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
- **其他面板沿用角色面板的版面**（`style.css` 最後的「面板共用版面」段落）：設定、商店、鐵匠、遠征、塔、造型師、Wiki、寵物管理員、事蹟記錄者、信箱、好友、檢視他人的 overlay 加 `dock-panel`，分頁列或 `.shop-top` 加 `dock-rail`。沒有視窗外框；標題是左上白字；內容是深色毛玻璃卡片；`.dock-rail` 絕對定位成右側直立欄（點數卡片在上、膠囊分頁在下），底部 `.btn-row.pad` 直排在右下、關閉鈕最後。寬度用各面板的 `--dk-w`，直立欄寬 `--dk-rail`（同 `--cp-rail`）。`.ro-body` 與 `.shop-top` 不能加 `position`／`transform`／`filter`／`backdrop-filter`，否則直立欄會跟著跑進內容欄。暫停、NPC 對話、結算、鑲卡、登入／選角／創角、升級選卡、交易（已拿掉）維持原本的視窗。
- **地圖參考資料**：`gamedata/ref-maps-dvg.json` 是使用者提供的 ro.dvg.cn 地圖資料庫，共 1225 張地圖，內容包括地圖 id、簡體中文名稱、魔物表（id、名稱、數量、重生時間）與 NPC 座標。只作參考，遊戲不載入。
- **Google／LINE 登入與雲端存檔**（後端 `../../server/ro-life/`、Vercel 函式 `../../api/ro.mjs`，`vercel.json` 把 `/api/ro/*` 改寫到它；本機 `npm start` 也掛著同一套）：
  - 單機模式（預設，`Lh = true`、`nt()` 假函式）：登入只做帳號與雲端存檔，`template.html` 檔尾的雲端腳本把 localStorage `ro-life.dev.<存檔 key>`（key 規則同引擎的 `tf`）整包 PUT 到 `/api/ro/save`，用 `rev` 做樂觀鎖。
  - **線上角色**（第一步：伺服器只記錄不擋，後端 `../../server/ro-life/game.mjs`）：登入後登入框出現「單機／線上」切換（`/api/ro/config` 回 `online` 才顯示，正式站要套 `schema.sql` 的 `ro_game_*` 表並設 `RO_ONLINE=1`）。選線上記在 localStorage `ro-life.mode`，重新載入後由頁首的 `window.__roOnline`（`tools/build.mjs` 的 `onlineScript`）把頁面的登入權杖寫成引擎認得的 `ro-life-session`，引擎用原本的線上模式（`Lh = false`，角色從 Lv1、非 dev，職業照一般規則解鎖），`nt()` 打到 `/api/ro/game/`（`h1()` 改寫，權杖放 `x-session`）。存檔在 `ro_game_save`，和單機的 `ro_save` 分開；每次存檔與上一版比對，把等級、經驗、物品變化與疑點（`gain-no-claim`、`new-high`、`big-jump`、`dev`、`item-edit`、`kafra-no-sale`、`claim-reused`／`claim-unknown`…）寫進 `ro_game_log`，領憑證時另記關卡、`mult` 與開打到結算的秒數；新角色的新手裝備（`owner`＝新角色）不算獲得。`/api/ro/config` 的 `online` 要 `RO_ONLINE=1` 而且三張表都在（每分鐘查一次）。開打時 `POST run` 發關卡憑證，結算存檔時帶回來領取。
    - 刻意關閉的部分（build.mjs 的線上段落）：關卡中的在線連線（`e3`）不開。大廳 hello 不帶 `token`（資料庫權杖不能送到 Cloudflare），只用入場票 `rt`。
    - 無盡之塔（`../../server/ro-life/endless.mjs`）：`/api/ro/config` 回 `endless`（正式站要套用 schema.sql 的 `ro_endless_*` 表＋設 `RO_ENDLESS=1`）頁面才設 `window.__roEndless`，引擎的 `f_()` 與開局權杖照它開；單機角色一律進不去。Vercel 沒有 WebSocket：`Pn.socket` 換成 `__RoHttpSocket`，每次 send 變成 `POST game/endless/io {run, msgs}`（`in`／`end`／`suspend` 沒帶權杖，shim 自己帶 `x-session` 與 run；`ping` 不送；失敗一律當斷線，讓引擎自己 `resume`）。伺服器只「記下來」：開局用伺服器存檔裡的角色（只帶身上的裝備）＋塔的進度當快照、伺服器發種子，操作與每 30 格的狀態雜湊分段存 `ro_endless_chunk`（`at`／`from` 要接得上，否則回 `resumed` 要引擎重送；格式錯或比牆鐘快就結束這場），結束回 `pending`。塔的點數、強化、技能在 `ro_endless_progress`，只有伺服器能改（`endless/upgrade`、`endless/skills`、`op:"towerReset"` 扣 500 Kafra）。
    - 驗證：`tools/verify-endless.mjs`（擁有者電腦上跑，`node --env-file=.env.local …`，要 `RO_DATABASE_URL`、`PLAYWRIGHT_MODULE`）依場次的 build 編號（`tools/build.mjs` 把打包結果的雜湊蓋進 `h_`／`i_` 的 `commit`）從工作目錄或 git 歷史找回同一版頁面，用引擎內建重播（`window.__roReplayEndless`）重跑並比對雜湊；分數、樓層、點數一律用重跑的結果。`verified` 才加點、上排行榜；對不上、帶不合法技能（`window.__roEndlessSkillsOk`，可能只是換了裝備）、比牆鐘快 4 倍以上（已通過的樓層可以 ×2／×4 快轉）都是 `unranked`（不算作弊）。要先開 `RO_ONLINE_ENFORCE=1` 才能開塔（開局快照取自伺服器存檔）。素材（地圖碰撞）不在 build 編號裡：改素材要重新 build。
    - 自動打塔＋自我測試：`PLAYWRIGHT_MODULE=… node games/282-ro-life/tools/endless-bot.mjs [--job hunter] [--minutes 8] [--min-floor 2] [--suspend 秒] [--strong] [--headed]`。只在本機（自己起一份記憶體資料的伺服器，旗標同正式站），不碰 Neon 與正式排行榜。建一轉角色後直接改伺服器存檔成 70 級二轉、在守護者處選塔用技能（`SKILLS` 表，沒有的職業取前四個）、機器人自己走位與選卡，最後跑驗證程式並檢查 verified、分數／樓層一致、點數、排行榜、帳號沒變、存檔沒被修正、頁面沒錯誤，失敗 exit 1。選卡視窗出現時引擎狀態仍是 `playing`，隱藏時卡片還在 DOM 裡，要用 `elementFromPoint` 判斷。
    - 退回單機：伺服器沒開放、`/api/ro/me` 或引擎收到 401、登出（頁面或引擎的 `hn()`）都呼叫 `window.__roOffline()`，把模式改回單機並重新載入；不會去建訪客帳號（`hm()` 已擋）。
    - 請求數：關卡中只有開打時 1 個 `POST run`；存檔是引擎原本的節奏（每 3 秒檢查，有變才 PUT；只有關卡進度變動時至少隔 2 分鐘），廣場閒置不發請求。
    - 查紀錄：`SELECT at, kind, flags, detail FROM ro_game_log WHERE account_id = … ORDER BY at DESC`；只看有疑點的：`WHERE flags <> '{}'`。
    - 伺服器裁決：買賣、精煉、信箱走引擎原本的 `nc()` → `POST game/op`（`Hl()` 照原作為真），由 `../../server/ro-life/game-ops.mjs` 在伺服器存檔上算（精煉亂數在伺服器，失敗時裝備壞掉並卸下），回 `{rev, doc}` 讓引擎 `ei()` 載入。存檔驗證是 `../../server/ro-life/game-rules.mjs` 的 `checkSave()`，拿這一版和伺服器上的上一版比（舊進度一律承認）：經驗、新物品、卡片只能跟著關卡憑證來（合作關卡、接續、跳過劇情都會發憑證；沒憑證一律不給），經驗上限 `runExpCap()` 逐秒累加該關出怪 × 3 人隊 × 等級差係數＋大群、菁英、已出場的魔王；Kafra、材料、精煉值在存檔裡只能變少；新角色 Lv1、打倒的 MVP／通過的關卡只能跟著該關憑證（該關 `bossAt` 裡的才算）、轉職只能在 `prt_castle` 的憑證下且同一條職業線、能力點與天賦點（天賦依職業線各自計點，引擎 `QE`；二轉樹只能點專精分支 `spec`，引擎 `r5`）、品質／詞綴數（`affixMax`，傳說多一條）／ilvl／tier、同一件物品不能換內容。預設影子模式（照存用戶端版本，記 `would-fix` 與 `detail.fix`，有經驗的存檔記 `detail.cap`）；`RO_ONLINE_ENFORCE=1` 才存修正版並回 `{rev, doc}`。
    - 防作弊規則分兩種（清單與理由在 `PLAN-trade-party.md`「安全與防作弊加固」，測試在 `anticheat.test.mjs`）：引擎不可能產生的狀態（重複或沒有 uid 的物品、沒有 id 的角色、卡片換種類、材料變多、換職業、卡槽變多）一律修正，但上一版就有的不追溯；跟時間、數量有關的（`mvp-early`、`stage-early`、`card-stage`、`item-affix`、`item-count`、`equip-dup`、發憑證時的 `stage-locked`）平常只記錄（issue 帶 `fixed:false`），`RO_ONLINE_STRICT=1` 才擋。**新增規則時先想正式站一 push 就生效**：不確定正常玩家會不會中的，一律先做成只記錄。驗證本身丟例外時把關模式回 400、不收存檔。
    - `POST game/run` 只發給規則資料裡的關卡（`endless` 不發）；跳過劇情要「自己沒通關、帳號裡別的角色通關過」，憑證的經驗與卡片都是 0。
    - 角色名審核在 `../../server/ro-life/name-rules.mjs`（純函式，大廳 Worker 也 import）：`POST game/name` 不能用就回 `offensive`；存檔裡硬塞的新名字換成「冒險者NNNN」並加引擎的 `rename` 旗標；大廳 hello 只查冒充官方與不雅、不查格式。額外禁用字用 `RO_NAME_BLOCK`（Vercel）、`NAME_BLOCK`（Worker `[vars]`）。
    - 正式站唯讀稽核：`node --env-file=.env.local games/282-ro-life/tools/audit-saves.mjs`（只有 SELECT；要使用者同意才跑）。改存檔規則後、push 之前請使用者跑一次，「原封不動重存會出現的 issue」要是空的。
    - 規則數值在 `../../server/ro-life/rules-data.mjs`，由 `tools/dump-rules.mjs` 從打包後的頁面（`window.__ro.rules`）倒出來，**不要手改**。改了引擎的經驗、價格、精煉、掉落或關卡後，先 build 再跑 `PLAYWRIGHT_MODULE=… node games/282-ro-life/tools/dump-rules.mjs`，然後跑 `npm run test:ro`（`game-rules.test.mjs` 會核對賣價公式樣本）。
  - 同步規則：開頁或剛登入時比對雲端與本機。雲端空的就上傳本機；本機沒有角色或上次同步後沒改過就套用雲端（寫回 localStorage 後重新載入）；兩邊都有角色且不同時跳出 `#ro-cloud-pick` 讓玩家選，**不可默默覆蓋任何一邊**。遊戲中每 45 秒與切到背景時上傳，`409`（別台裝置先存）就停止自動上傳，等下次開頁再處理。
  - 「有設定才顯示」：頁面問 `/api/ro/config`，`GOOGLE_CLIENT_ID`＋`GOOGLE_CLIENT_SECRET`、`LINE_CHANNEL_ID`＋`LINE_CHANNEL_SECRET` 各自兩個都有、而且有資料庫（`RO_DATABASE_URL`，刻意不讀共用的 `DATABASE_URL`；Vercel 上沒有就全部關閉，本機沒有就用記憶體）才回 true。靜態託管（`npx serve`）沒有 `/api`，所以 localhost 只有網址帶 `?api`（記在 sessionStorage）才會去問，避免 404 與 console.error；其他網域一律會問。
  - 登入流程：authorization code＋PKCE＋nonce，`state` 同時存在 `ro_auth_state` 與 HttpOnly cookie；Google 的 id_token 直接從 token 端點拿，只驗 iss／aud／exp／nonce，LINE 交給官方 `/oauth2/v2.1/verify`。只要 `openid profile`，不拿 email。回呼帶一次性代碼（2 分鐘）回 `#ro-login=`，頁面再用 `POST /api/ro/auth/exchange` 換 60 天的 Bearer 權杖（資料庫只存 SHA-256）。
  - 回呼網址（要在 Google Cloud Console／LINE Developers 登記）：`https://<網域>/api/ro/auth/google/callback`、`https://<網域>/api/ro/auth/line/callback`；網域可用 `RO_PUBLIC_ORIGIN` 固定，否則取請求的 host。
  - 資料表：`../../server/ro-life/schema.sql`（全部 `ro_` 前綴，參考 rAthena `main.sql` 的 login／char／inventory 改成 PostgreSQL，沒有密碼欄位），要手動套用一次：`psql "$RO_DATABASE_URL" -f server/ro-life/schema.sql`。`ro_save.doc` 是存檔本體；`ro_char`、`ro_inventory` 是每次存檔一起改寫的投影，只供查詢。rAthena 的 `item_db`／`mob_db` 沒有匯入。
  - 測試：`npm run test:ro`（根目錄；Google／LINE 用假 fetch、資料在記憶體；線上角色在 `game.test.mjs`，防作弊 `anticheat.test.mjs`，合作關卡的收據與擲骰 `lobby-party.test.mjs`，交易 `trade.test.mjs`，市場＋信箱 `market.test.mjs`）。真正的 Google／LINE 登入要有憑證才能試。
- **普隆德拉大廳（多人）**：沿用引擎原本的大廳協定（`Xj` 類別），不碰遊戲規則。第一階段轉送加入／離開、走動、外觀、表情與公開聊天；第二階段（社交）加上檢視資料、密語、好友；第三階段加上多頻道、離線留言、檢舉與禁言；第四階段加上組隊與合作關卡。大廳編號 1–9 全部進同一個廣場（Durable Object `lobby-1`），好友上線狀態與密語才在同一處。
  - 程式：核心 `../../server/ro-life/lobby-core.mjs`（訊息格式與清理規則寫在檔頭）；本機版 `../../server/ro-life/lobby.mjs` 掛在 `npm start` 的 `/api/ro/lobby?l=<1–9>`；正式站是 Cloudflare Worker＋Durable Object（`worker/`，WebSocket 休眠 API，每條連線的狀態放在 attachment）。三者共用同一份核心，測試在 `lobby.test.mjs`、`lobby-social.test.mjs`、`lobby-mod.test.mjs`、`lobby-party.test.mjs`、`trade.test.mjs`。
  - 開關：`/api/ro/config` 回 `lobby` 網址才連線。正式站要在 Vercel 設 `RO_LOBBY_URL`（`wss://…/api/ro/lobby`）與 `RO_LOBBY_SECRET`，Worker 也用 `wrangler secret put RO_LOBBY_SECRET` 設同一個值；本機 `npm start` 自己產生密鑰、網址用同一台。沒設定時頁面完全不開 WebSocket（靜態託管零錯誤）。
  - 身分：登入的玩家由頁面向 `/api/ro/lobby-ticket` 換 15 分鐘的 HMAC 入場票（每 5 分鐘、切回前景與每次連線時更新），放在 hello 的 `rt`；60 天的登入權杖不會送到大廳。沒有票是訪客：看得到、會被看到，不能聊天，別人看到的名字是伺服器給的「冒險者 NNNN」（訪客沒有帳號可停權，所以不用自填名）。登入玩家顯示角色名（玩家自填，伺服器只清理不驗證）。
  - 社交資料（`../../server/ro-life/lobby-store.mjs`）：好友、好友邀請、帳號最後用的角色名、檢視資料存在 Durable Object 內建的 SQLite（`ctx.storage.sql`，跟著 Worker 永久保存，**不在 Neon**、不用手動建表）；本機 `npm start` 放記憶體。測試用 `node:sqlite` 跑同一份 SQL。檢視資料不放 attachment（上限 16384 bytes，且每次走動都會重寫）。
  - 社交規則：只認入場票的帳號 `a`（票裡的 `n` 是 Google／LINE 名字，不顯示）。用名字找人只找廣場上登入的玩家（不分大小寫），找不到或好幾個帳號同名就失敗，不會送給多人；加好友從選單會帶 `id`，選單判斷「已是好友」也用 id（引擎原本用名字）。密語用名字送；從選單、好友清單或回覆時另帶對方的連線 `id`，名字相符就以 id 為準，只打名字時線上好友和陌生人同名會送給好友。好友清單裡重名的依帳號排序加「 #2」，用戶端拿這個名字回覆、刪除、密語都對得到人。同帳號開多個分頁，密語與通知都送到每一頁。好友上限 40、待回邀請上限 20。別人的檢視視窗用 innerHTML 畫，所以 `cleanProfile()` 只留數字與代號。
  - 新舊版本：welcome 帶 `social: 1` 才顯示社交按鈕（`body.ro-social`）。頁面比 Worker 先更新時，舊 Worker 不送它，好友鈕隱藏、選單只有名字。
  - 引擎改動都在 `tools/build.mjs` 的大廳段落（找不到原字串就讓 build 失敗）：`connect()` 改連 `window.__roLobby.url()`；hello 加 `rt`；進大廳時等 `window.__roLobbyReady`，本機模式的 dev 角色在有大廳時也上線；點別人只留名字、查看、密語、加好友、交易、檢舉（訪客只看得到查看；交易要 welcome 帶 `trade` 而且自己是線上模式；檢舉、邀請組隊只給登入者、不能對訪客；跟著角色的選單在 `style.css` 設 `z-index` 蓋過地點標題）；`Pa()`（單機版永遠是訪客）的判斷改成「有入場票」；訪客的聊天框鎖住；不跳「中文頻道」提示（伺服器不分流）。
  - 驗收：`wrangler dev --local --port 8788 --var RO_LOBBY_SECRET:<值> --var ALLOWED_ORIGINS:http://ro.test:8127 --var LOBBY_CHANNEL_CAP:2 --var RO_ADMIN_KEY:<16 字以上>`，再用 `RO_LOBBY_SECRET=<同值> RO_LOBBY_URL=ws://127.0.0.1:8788/api/ro/lobby npm start` 開兩個瀏覽器分頁（ro.test）；登入身分可在頁面上把 `window.__roLobby.ticket` 換成用同一個密鑰 `signTicket()` 簽的票。進大廳點「與隊長交談」開遠征面板；在大廳按 Esc 會開選項視窗。測完刪掉 `worker/.wrangler/`。
  - 頻道：廣場分 4 個頻道、每頻道 25 人（引擎的 `sp`），總上限 100。新連線先把現有頻道填到八成再開下一個，全滿以 1013 關閉（不用引擎的 4001，那會讓頁面換大廳）。走動、外觀、表情與「頻道」聊天只送同頻道；「一般／交易／中文」聊天、密語、好友通知跨頻道。點地點標題下的人數（`#lobby-online`）開頻道清單換頻道（每 3 秒一次，伺服器重送 `welcome`）。`LOBBY_CHANNEL_CAP`（Worker 變數）或 `io.cap` 可把上限調小做測試。Worker 另有總連線 400、同一個 IP 16 條的上限（`LOBBY_IP_CAP` 可調；用休眠 API 的 tag 計數）。引擎的聊天框有分頁，「一般」訊息只出現在「一般」分頁。
  - 離線留言：對離線好友密語會存起來（每人最多 50 則、同一寄件人 10 則），對方下次進廣場時以「（離線留言）」開頭的密語送達；刪好友時一起刪。好友清單的離線列有「留言」鈕（預填 `/w "名字" `）。
  - 檢舉與禁言：登入玩家才能檢舉（10 分鐘 5 次、同一人 1 小時 1 次），伺服器把對方最近 15 則公開發言與雙方 15 則密語存成證據（檢舉不過期，要在管理頁處理）。聊天紀錄（含密語）只留 3 天、每天最多寫 20000 筆（Cloudflare 免費方案每天 10 萬列寫入）。禁言以帳號計，被禁言的人聊天與密語收到 `chatErr muted`。
  - 管理頁：`../../server/ro-life/lobby-admin.mjs`，只有 Worker 掛 `/admin`（頁面）與 `/admin/api/*`（JSON），要 `wrangler secret put RO_ADMIN_KEY`（至少 16 字，沒設整個 404）；密鑰放 `Authorization: Bearer`，Worker 驗過才用內部網址轉給 Durable Object。頁面上玩家寫的字一律 `textContent`。本機 `npm start` 沒有管理頁。
  - 新舊版本：welcome 另帶 `report: 1`、`mail: 1`、`party: 1`、`trade: 1`（`body.ro-report`、`body.ro-mail`、`body.ro-party`、`body.ro-trade`）才顯示檢舉、留言、「邀請組隊」與「交易」。
  - 組隊（`../../server/ro-life/lobby-party.mjs`，協定寫在檔頭）：用引擎原本的隊伍框、邀請、出發確認與隊伍頻道。最多 3 人（引擎 `$0`），只限登入玩家，以帳號計（`mid` 是隊伍內編號）。隊伍存在 DO 的 SQLite（只在組隊、離隊、出發等事件時寫），所有人離線 10 分鐘才解散；邀請放在被邀請者連線的 attachment；邀請與出發確認 30 秒期限靠 `io.wake()`（DO 的 `alarm()`、Node 的 setTimeout）。隊伍頻道會記進聊天紀錄（檢舉證據）。引擎的跨大廳組隊（`*Far`）不處理，全部大廳本來就是同一個廣場。
  - 合作關卡：全員按好後送 `partyStart`，引擎開第二條連線（原本連 `/web/ws-run`，`build.mjs` 改成大廳同一個網址，hello 帶 `run:true` 與入場票 `rt`），伺服器靠入場票的帳號對到「已出發」的隊伍，不看引擎的分頁 key。房主（預設隊長）跑模擬，伺服器只轉送 `run{d}`（每連線每秒最多 60 則、單則 64 KB，大廳連線仍是 16 KB）；伺服器關本局連線一律用 4000（引擎 `t3` 唯一不會自動重連的代碼，其他代碼會無限重試）；被踢或離隊時一併關掉本局連線；房主離開換人（`runHost`），隊長 15 秒沒連進來就讓先到的人當。全部離開這一趟就結束，隊伍留著。轉送前把封包裡的 `<` 換成 `‹`（隊友的頁面照內容畫介面）。實測（wrangler dev）：房主每秒約 20 則、2.4 KB，隊員每秒約 10 則。獎勵裁決（`../../server/ro-life/coop.mjs`，規格在 `PLAN-trade-party.md`「合作關卡獎勵裁決」）：大廳在出發時簽行程收據（頁面換憑證時帶上，伺服器把人數記在憑證 id 的前綴 `p2.<tid>.`，經驗上限照人數算）、稀有掉落由大廳擲骰（房主的頁面 hello 帶 `sr:1` 才啟用，結果用 `from:0` 送）、結束時簽結算收據（連線秒數、房主宣布打倒過的怪、擲骰拿到的東西；頁面在結算存檔帶上，伺服器核對，先只記錄 `coop-secs`／`coop-mvp`／`coop-loot`）。`RO_COOP_RECEIPT=1`（Vercel）＝沒有行程收據的憑證當單人算，**要在 Worker 部署之後才能開**；`LOBBY_REQUIRE_SR=1`（Worker）＝舊頁面進不了本局（沒開時房主用舊頁面，掉落就不核對）。引擎的掛點在 `tools/build.mjs`「合作關卡獎勵裁決」段落與頁首的 `coopScript`；每一個都要在「大廳是舊版」時退回原本的行為（`window.__roSrvRoll`、`__roRunRc` 是 false）。
  - 交易（只限線上角色，伺服器權威）：引擎原本的交易視窗與協定。大廳（`../../server/ro-life/lobby-trade.mjs`，協定寫在檔頭）只撮合：邀請 30 秒、同帳號同時一筆、改出價會取消雙方的 OK、兩邊 OK 才能確認；狀態放在連線的 attachment。雙方都確認後大廳呼叫 `io.settle`，打 `POST /api/ro/trade/settle`（`../../server/ro-life/trade.mjs`，用 `RO_LOBBY_SECRET` 簽 `trade:` 前綴的 HMAC、60 秒時效、交易 id 冪等），伺服器在兩邊的 `ro_game_save` 上搬東西，一個 SQL 交易寫完兩邊（`store.tradeGameSaves`，任一邊 rev 不符整筆回滾），兩邊各記一筆 `ro_game_log` kind `trade`。出價裡的裝備逐件和伺服器上的那件比對（精煉、品質、詞綴、卡片），不符就 `missing`。可交易：沒裝在身上、沒上鎖、不是新手裝備的物品，卡片、礦石、Kafra；清單 `tradeLedger()` 隨 GET／PUT save 與 op 回應的 `trade` 給引擎（`b1()`），交易視窗只能放這裡面的東西。用戶端收到 `tradeDone` 只重抓存檔。hello 帶 `on:1`（線上模式）才能交易，單機玩家收到 `offline`（頁面補的中文）。
    - 開關：Worker 設 `RO_TRADE_URL`（`[vars]`）才有 `io.settle`、welcome 才帶 `trade`；Vercel 要 `RO_TRADE=1`（還要線上模式開著）結算端點才開；本機 `npm start` 用記憶體資料，大廳直接打同一台的端點，預設開放。
    - 已知限制：結算後到用戶端重抓存檔之間，如果那一頁剛好有沒存的本機變更送出 PUT，會拿到 409（引擎跳「帳號在別處使用」並重新載入）；開交易視窗時引擎會先存一次，實測沒遇到。
  - 市場＋信箱（只限線上角色，伺服器權威，`../../server/ro-life/market.mjs`；規格與開啟步驟在 `PLAN-trade-party.md`「市場＋信箱」）：上架／購買／下架都是 `POST game/op`（`marketList`／`marketBuy`／`marketCancel`），賣出的 Kafra（扣 3%）與到期退回的物品寄到信箱（郵差 NPC），領附件是 `op:'mail'`。每個動作是 `store.mjs` 裡一句 SQL，存檔照 rev 改寫，整句成功或整句不做。
    - 開關：Vercel `RO_MARKET=1`＋`ro_market`、`ro_game_mail` 兩張表在（`/api/ro/config` 回 `market`）；本機記憶體資料預設開（`RO_MARKET=0` 關）。沒開時信箱回空、頁面不出現市場鈕。
    - 頁面：`#lobby-market` 鈕與 `#market` 面板在 `src/template.html`（面板下方的 `<script>`），用的引擎函式由 `tools/build.mjs` 掛在 `window.__ro.mkt`（`op` 會先送出存檔、套用伺服器回的 `{rev, doc}`，錯誤碼原樣丟出）。玩家字串（賣家名）一律 `textContent`。
  - 尚未做：角色名全站唯一（要新表）。無盡之塔驗證程式的 launchd 排程只有範本（`tools/launchd/`），沒有安裝。部署 Worker 一律由使用者用自己的 Cloudflare 帳號執行（見 `worker/wrangler.toml` 檔頭）。
- **精簡化（使用者要求「簡潔為主」）**：寫在 `style.css` 最後的「精簡化」段落，圖示是 `:root` 的 `--ic-*` SVG 遮罩（顏色跟文字色）。登入只留 Google／LINE 圓形 logo 鈕（`aria-label` 是品牌名），有第三方登入時藏起單機版本來就停用的帳密欄位；登入畫面右上角的最新消息（鈴鐺，未讀紅點保留）與語系（地球）、大廳右上角 `#lobby-actions` 四顆鈕都改成圖示，原本的文字與快捷鍵由檔尾腳本寫進 `title`／`aria-label`；遠征的關卡狀態改圖示（可挑戰不顯示、鎖、時鐘、金色勾），「新！」改小紅點，裝備分數改 `GS` 標籤。新文字一律短句，不要加說明句。
