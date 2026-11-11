# 282 交接（2026-11-11）

換電腦、開新 session 接續用。架構與規則以同資料夾的 `CLAUDE.md` 為準，這裡只記「做到哪、下一步、上一台電腦的習慣」。

## 狀態

- 已上線（Vercel 自動部署）：Google／LINE 登入＋雲端存檔（`RO_DATABASE_URL`）、快捷列圖示修正、新的 app icon／og 圖。
- **普隆德拉大廳第一階段（看得到其他玩家）**：已上線。Worker 在使用者的 `ro-lobby.<帳號>.workers.dev`，Vercel 設好 `RO_LOBBY_URL`／`RO_LOBBY_SECRET`，正式站兩人互相看得到（2026-11-11 驗證）。
- **第二階段（社交：查看資料、密語、好友）**：程式寫好、本機驗過，**要使用者再執行一次 `npx wrangler deploy` 才會在正式站出現**（頁面先更新也沒關係：舊 Worker 不送 `social`，社交按鈕不會顯示）。
  - 好友存在 Durable Object 內建的 SQLite，不在 Neon（原本規劃存 Neon，改掉的原因：不用手動建表、Cloudflare 不用放資料庫密碼、本機能完整測試）。
  - 本機已驗過：`npm run test:ro` 20 項（含 node:sqlite 跑同一份 SQL、惡意檢視資料、重名）；瀏覽器經 `wrangler dev`：真的點選玩家（桌機與 844×390 觸控）、查看（惡意資料沒有執行；真實格式的天賦、卡片、詞綴都顯示）、密語與 `/r` 回覆、加好友→對方接受→清單上線／離線、兩個同名玩家加對人、重啟 Worker 好友還在、舊 Worker 不顯示社交按鈕，零錯誤。
  - **還沒驗過**：真正的 Google／LINE 帳號在正式站使用社交功能（正式站兩個登入都已開啟）。

## 下一步

1. 使用者部署第二階段（不可由 Claude 執行）：先 commit＋push，在要執行 wrangler 的那台電腦 `git pull`，再 `cd games/282-ro-life/worker && npx wrangler deploy`。不用新的密鑰或環境變數。部署後可請 Claude 檢查正式站的 welcome 有沒有 `social`。
2. 部署後在正式站驗證：兩台裝置各用 Google／LINE 登入，互相查看、密語、加好友；訪客點別人只有「查看」。
3. 之後可選的擴充（使用者還沒決定）：
   - ③ 交易、組隊打關卡：要把遊戲規則搬到伺服器，工作量大。
   - 其他待辦：檢舉、多頻道（現在只有頻道 1、總上限 80 人）、角色名審核、離線好友留言。
   - 已知小限制：密語是打名字送出，如果線上的好友和陌生人同名，會送給好友。

## 上一台電腦的習慣（memory 不會跟著換電腦）

- 一律用繁體中文回覆。
- 沒被要求就不 commit；commit 訊息格式 `YYYYMMDD-N`＋一行說明＋ attribution。使用者常同時開多個 session，commit 前看 `git status`。
- Cloudflare 一律用使用者自己的帳號、不自動部署；不要對使用者的 Neon 執行 DDL。
- 不要加回 F2 Debug 鈕；手機只做橫向；介面精簡、用圖示；保留同人聲明（`#fanNote`、`CREDITS.md`）。
- 不要把使用者的 email 或個資送到外部服務。
- 登錄檔（`index.html`、`README.md`、`llms.txt`、`sitemap.xml`）換行混用，`server/jade-table/server.mjs` 是 CRLF：用小範圍編輯，改完看 `git diff --stat`。
- 驗收用 Playwright（上一台的路徑 `/Users/xieyuanyou/Documents/TransitRail/node_modules/playwright/index.mjs` 是機器專屬；新電腦自己裝），`channel: 'chrome'`、`--use-angle=metal`，並加 `--host-resolver-rules=MAP ro.test 127.0.0.1` 走正式站分支。大廳驗收步驟寫在 `CLAUDE.md` 的大廳段落。
