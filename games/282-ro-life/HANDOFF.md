# 282 交接（2026-11-12）

換模型、換電腦、開新 session 接續用。架構與規則以同資料夾的 `CLAUDE.md` 為準，線上路線與每一階段的規格、測試、開啟步驟在 `PLAN-trade-party.md`。這裡只記「做到哪、下一步、使用者的習慣」。

## 狀態（到 `92073e0 20261112-6`，已 push）

- **已上線**：Google／LINE 登入＋雲端存檔、普隆德拉大廳（看得到其他玩家、社交）、素材搬到使用者的 `ro-assets` Worker。
- **線上角色（伺服器權威）**：已上線，正式站設了 `RO_ONLINE_ENFORCE=1`、`RO_ENDLESS=1`。
  - 線上角色另起一條線，從 Lv1 開始；原本的雲端存檔留作單機存檔。
  - 存檔、買賣、精煉、領信都在伺服器上算。違規的增加會被默默修正，記在 `ro_game_log`。
  - 無盡之塔走 HTTP；驗證程式 `tools/verify-endless.mjs` 在使用者電腦重跑，排行榜只列驗證過的。
- **自動打塔自測**：`tools/endless-bot.mjs`（預設獵人），只在本機起記憶體資料的伺服器，不碰 Neon 與正式排行榜。最近一次 3 分鐘 17/17。
- **交易（階段 4）**：已提交，**預設關閉**。
  - 開啟要 Vercel 設 `RO_TRADE=1`。
  - Worker 的 `wrangler.toml` `[vars]` 要加 `RO_TRADE_URL = "https://htmls-ruddy.vercel.app/api/ro/trade/settle"`，再由使用者自己 `npx wrangler deploy`。
- **市場＋信箱**：已提交，**預設關閉**。
  - 開啟要先套 `server/ro-life/schema.sql`（新增 `ro_game_mail`、`ro_market`），再在 Vercel 設 `RO_MARKET=1`。
  - 風險已告知使用者：物品數上限目前只記錄不擋，偽造的普通掉落可以在市場換成別人的 Kafra。
- **大廳 Worker**：第三、四階段（多頻道、留言、檢舉、禁言、管理頁、組隊、合作關卡）和交易撮合都在 `worker/`。是否已部署最新版未確認，部署一次就全部包含。部署步驟見 `worker/wrangler.toml` 檔頭；`RO_ADMIN_KEY` 要用 `wrangler secret put` 設。

## 這一輪（2026-11-12 晚，已 push `fcf57f3 20261112-7`）

- **安全與防作弊加固**：完成。補了十個洞（複製物品、沒有 uid 的物品可上架、假角色進塔、卡片換種類、`endless` 憑證沒有時間上限、跳過劇情不查資格…），清單、哪些直接擋、哪些先記錄、還沒補的，都在 `PLAN-trade-party.md`「安全與防作弊加固」。
  - 新開關 `RO_ONLINE_STRICT=1`：先記錄的那幾條規則改成真的擋。**還沒開**，要先看正式站紀錄。
  - 新工具 `tools/audit-saves.mjs`（正式站唯讀稽核）。要使用者當場明講同意才能跑。
  - 規則資料重新倒過（多了 `affix`）。
- **角色名審核**：完成（`server/ro-life/name-rules.mjs`）。名字全站唯一在第三輪補上了。
- **合作關卡獎勵**：三個階段都做完了（使用者選「階段 1＋2＋3」）。行程收據、結算收據、大廳擲骰，規格、驗收與**部署順序**在 `PLAN-trade-party.md`「合作關卡獎勵裁決：階段 1～3」。
  - 新開關 `RO_COOP_RECEIPT=1`（Vercel）：沒有行程收據的憑證當單人算。**還沒開，而且一定要在大廳 Worker 重新部署之後才能開**，不然合作關卡的經驗會被砍。
  - 頁面重新 build 過（引擎多 13 處 `must()`、頁首多一段 `coopScript`）。
- **正式站稽核**（使用者同意後跑了 `tools/audit-saves.mjs`，只有 SELECT）：線上存檔、紀錄、憑證、塔場次都是 **0 筆**，還沒有人用線上模式玩過。所以沒有資料可以訂上限的數字；這一輪只收緊了從引擎推得出來的（單人／合作分開算、每小時憑證 120 → 60、strict 時剛發的憑證不給物品與卡片）。
- **Firefox 重跑驗證**：使用者說不測，從待辦拿掉。
- **launchd 排程**：使用者說先不設。範本在 `tools/launchd/com.htmls.ro-verify-endless.plist`，沒有安裝、沒有載入。
- **要提醒使用者的**：`worker/wrangler.toml` 的 `[vars]` 已經有 `RO_TRADE_URL`，重新部署 Worker 大廳就會顯示「交易」；Vercel 沒設 `RO_TRADE=1` 的話結算會失敗。
- 這一輪的實測腳本在暫存資料夾（沒進 repo）：`coop/coop-e2e.mjs`（兩個瀏覽器的合作關卡）、`coop/coop-e2e-oldlobby.mjs`（同一支換成上一版的大廳）、`market/market-e2e-strict.mjs`、`stage/stage-e2e.mjs`、`affix-check.mjs`，路徑 `/private/tmp/claude-501/-Users-xieyuanyou-Documents-htmls/54451823-5807-4370-bd80-6f21cdb0144e/scratchpad/`。

## 第三輪（2026-11-12 深夜）

已 push 到 `bdc1e4a 20261112-9`：怪物頭像在正式站是空的（素材跨網域，改用 CORS 載入）、面板大小跟著內容、建立角色與選擇角色照使用者給的手遊參考圖重排。規則都寫在 282 `CLAUDE.md`。

之後這一批已 push 到 `0b70f81 20261112-10`（清單與每項的結果在 `PLAN-trade-party.md`「第三輪」）：

- 角色名全站唯一（新表 `ro_game_name`，**使用者要自己套 `schema.sql`**，表在才啟用）。
- 物品與卡片上限照引擎的掉落規則收緊；穿戴限制、寵物、成就的存檔檢查（都是先記錄）。
- 每個帳號每分鐘 240 個請求的流量上限；282 頁面完整的 CSP（`vercel.json`）。
- 創角的髮型縮圖格與頭飾試戴；選角的更換頭像鈕、點空欄位直接進創角。
- 做不到的：單人關卡「掛著不打、時間到再領」（一般關卡沒有可重播的操作紀錄）。
- 之後（`20261112-11`）：創角左側面板在 1440×900 不用捲、矮視窗時性別分頁釘在最上面；`endless-bot.mjs` 多 `--pet`。查證後「寵物進塔會對不上」是誤判，引擎開塔時本來就不帶寵物，沒有改引擎與伺服器。
- 規則資料重新倒過兩次（`affix`、`equipSlots`、`dual`、`pets`、`drops`，每件裝備多 `jobsAll`／`gender`／`wtype`），頁面重新 build。

## 下一步（使用者說「依序實作」）

1. **合作關卡獎勵改由伺服器裁決**：完成（見上）。剩下的是部署後的確認：Worker 部署 → 自己組隊打一場看紀錄 → 開 `RO_COOP_RECEIPT=1`。下面是當初的調查範圍。
   - 現況：合作關卡的獎勵由各自的用戶端結算。使用者選了「發給獎勵、只記錄」。
   - 要看的地方：大廳的 `ws-run` 轉送（`server/ro-life/lobby-party.mjs`）、單人關卡的 `POST run` 憑證與 `PUT save` 驗證（`server/ro-life/game.mjs`、`game-rules.mjs`）、無盡之塔的重跑驗證（`endless.mjs`、`tools/verify-endless.mjs`）。
2. 角色名審核與名字全站唯一：完成。使用者要自己套 `schema.sql` 的 `ro_game_name`，表在才啟用。
3. ~~Firefox 重跑驗證~~：使用者決定不測（2026-11-12）。
4. 驗證程式的 launchd 排程：使用者說先不設，只留範本（見上）。之後要設也要先問。
5. 使用者自己做：開啟交易、市場（見上）；部署大廳 Worker；commit。
6. 收緊經驗與物品上限：能從引擎推的已經做了；正式站目前 0 筆資料。有玩家之後再跑稽核（要使用者明講同意，或請使用者自己跑 `tools/audit-saves.mjs`），看過資料再決定開 `RO_ONLINE_STRICT=1` 與物品、卡片的數字。

## 測試

- `npm run test:ro`：111 項，含 `anticheat.test.mjs`、`lobby-party.test.mjs`（收據與擲骰）、`trade.test.mjs`、`market.test.mjs`。
- 下面這些腳本放在上一個 session 的暫存資料夾，**沒有進 repo**，重開機可能就不見了，需要時照 `PLAN-trade-party.md` 的描述重寫：
  - PGlite 真 PostgreSQL 測試（`pg/pg-trade.mjs`、`pg/pg-market.mjs`、`pg/pg-schema2.mjs`）。
  - 兩個瀏覽器實測（`trade/trade-e2e.mjs`、`market/market-e2e.mjs`）。
  - 單機／靜態主機檢查（`market/static-check.mjs`）。
  - 暫存資料夾：`/private/tmp/claude-501/-Users-xieyuanyou-Documents-htmls/1e10ce14-1705-4c1d-8d91-a21a81fedeb0/scratchpad/`。
- PGlite 只有一條連線，「兩人同時買」這類情境實際上是依序跑的；真的同時發生時，靠的是 UPDATE 的列鎖與重新檢查條件。

## 使用者的習慣（memory 不會跟著換電腦或模型）

- 一律用繁體中文回覆。
- 沒被要求就不 commit；使用者自己會在 session 中途 commit／push，結束時回報還沒提交的檔案。
  - commit 格式是 `YYYYMMDD-N`，結尾加 attribution。
  - 使用者常同時開多個 session，commit 前看 `git status`。
- Cloudflare 一律用使用者自己的帳號，**不執行** `wrangler login`／`wrangler deploy`。
- 不要對使用者的 Neon 執行 DDL：新表寫進 `schema.sql` 讓使用者自己套。正式資料只做唯讀查詢。
- 介面規則：
  - 不要加回 F2 Debug 鈕。
  - 手機只做橫向。
  - 介面精簡、用圖示（大廳鈕是 `#lobby-actions` 的 SVG 遮罩圖示）。
  - 新面板沿用 `dock-panel` 版面。
  - 保留同人聲明（`#fanNote`、`CREDITS.md`）。
- 不要把使用者的 email 或個資送到外部服務；瀏覽器裡不輸入密碼、不讀或外洩 token。
- 換行與編輯：
  - 登錄檔（`index.html`、`README.md`、`llms.txt`、`sitemap.xml`）換行混用，`server/jade-table/server.mjs` 是 CRLF，用位元組層級的小範圍編輯，改完看 `git diff --stat`。
  - `src/style.css` 開頭是一行壓縮過的 CSS，新的規則加在檔尾。
- 引擎改動一律寫在 `tools/build.mjs` 的 `must()` 替換裡（找不到原字串就讓 build 失敗）。改了 `src/` 要 `node games/282-ro-life/tools/build.mjs`，連同 `web/282-ro-life.html` 一起交付。
- 本機的工具限制：
  - context-mode 的 hook 會擋 curl、WebFetch 與指令裡直接寫的 `fetch(`；檔案裡改用 `globalThis['fe'+'tch']`。
  - macOS 沒有 `timeout` 指令。
- 驗收用 Playwright：
  - 模組路徑 `/Users/xieyuanyou/Documents/TransitRail/node_modules/playwright/index.mjs`（機器專屬），啟動時用 `channel: 'chrome'`、`--use-angle=metal`；WebKit 已安裝。
  - 檢查兩種尺寸：1440×900 與手機橫向 844×390。
