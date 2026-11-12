# 282 交接（2026-11-11）

換電腦、開新 session 接續用。架構與規則以同資料夾的 `CLAUDE.md` 為準，這裡只記「做到哪、下一步、上一台電腦的習慣」。

## 狀態

- 已上線（Vercel 自動部署）：Google／LINE 登入＋雲端存檔（`RO_DATABASE_URL`）、快捷列圖示修正、新的 app icon／og 圖。
- **普隆德拉大廳第一階段（看得到其他玩家）**：已上線。Worker 在使用者的 `ro-lobby.<帳號>.workers.dev`，Vercel 設好 `RO_LOBBY_URL`／`RO_LOBBY_SECRET`，正式站兩人互相看得到（2026-11-11 驗證）。
- **第二階段（社交：查看資料、密語、好友）**：已上線（`a3233c8`，push 後正式站的 welcome 已帶 `social: 1`）。
  - 好友存在 Durable Object 內建的 SQLite，不在 Neon（不用手動建表、Cloudflare 不用放資料庫密碼、本機能完整測試）。
  - **還沒驗過**：真正的 Google／LINE 帳號在正式站使用社交功能。
- **第三階段（多頻道、離線留言、檢舉、禁言、管理頁）**：程式寫好、本機驗過，**要使用者部署 Worker 才會出現**（頁面先更新也沒關係：舊 Worker 不送 `report`／`mail`，檢舉與留言鈕不顯示）。
  - 本機已驗過：`npm run test:ro` 30 項；瀏覽器經 `wrangler dev`（`LOBBY_CHANNEL_CAP=2`）：自動分到頻道 2、頻道清單換頻道（重送 welcome、看到的人跟著換）、頻道聊天只到同頻道、「一般」跨頻道（在「一般」分頁）、選單檢舉（證據含對方發言）、選單密語帶 id、離線好友「留言」（桌機與 844×390 觸控）→ 對方上線收到、好友選單「前往頻道 N」（滿了顯示「該頻道已滿」、有空位就換過去）、管理頁錯誤密鑰被擋、沒設 `RO_ADMIN_KEY` 時 `/admin` 與 API 都 404、惡意聊天文字在管理頁只顯示成文字、禁言 1 小時 → 對方發言被擋 → 解除；舊 Worker（拿掉 `report`／`mail`）不顯示檢舉與留言鈕，同場的新版對照組會顯示。全程零錯誤。
  - 隱私：聊天紀錄（含密語）在 Durable Object 留 3 天；被檢舉時的證據快照留到管理頁處理為止（目前沒有刪除鈕，只能標為已處理）。

## 下一步

1. 使用者部署第三階段（不可由 Claude 執行）：commit＋push 後，在執行 wrangler 的電腦 `git pull`，`cd games/282-ro-life/worker`，`npx wrangler secret put RO_ADMIN_KEY`（至少 16 字的長亂數），再 `npx wrangler deploy`。管理頁在 `https://ro-lobby.<帳號>.workers.dev/admin`。
2. 部署後在正式站驗證：換頻道、檢舉、管理頁禁言／解除、離線留言。
3. ③ 交易、組隊：評估寫在 `PLAN-trade-party.md`，等使用者決定方向。
4. 其他待辦：角色名審核、檢舉證據的刪除鈕。

## 上一台電腦的習慣（memory 不會跟著換電腦）

- 一律用繁體中文回覆。
- 沒被要求就不 commit；commit 訊息格式 `YYYYMMDD-N`＋一行說明＋ attribution。使用者常同時開多個 session，commit 前看 `git status`。
- Cloudflare 一律用使用者自己的帳號、不自動部署；不要對使用者的 Neon 執行 DDL。
- 不要加回 F2 Debug 鈕；手機只做橫向；介面精簡、用圖示；保留同人聲明（`#fanNote`、`CREDITS.md`）。
- 不要把使用者的 email 或個資送到外部服務。
- 登錄檔（`index.html`、`README.md`、`llms.txt`、`sitemap.xml`）換行混用，`server/jade-table/server.mjs` 是 CRLF：用小範圍編輯，改完看 `git diff --stat`。
- 驗收用 Playwright（上一台的路徑 `/Users/xieyuanyou/Documents/TransitRail/node_modules/playwright/index.mjs` 是機器專屬；新電腦自己裝），`channel: 'chrome'`、`--use-angle=metal`，並加 `--host-resolver-rules=MAP ro.test 127.0.0.1` 走正式站分支。大廳驗收步驟寫在 `CLAUDE.md` 的大廳段落。
