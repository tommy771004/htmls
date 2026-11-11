# 282 交接（2026-11-11）

換電腦、開新 session 接續用。架構與規則以同資料夾的 `CLAUDE.md` 為準，這裡只記「做到哪、下一步、上一台電腦的習慣」。

## 狀態

- 已上線（Vercel 自動部署）：Google／LINE 登入＋雲端存檔（`RO_DATABASE_URL`）、快捷列圖示修正、新的 app icon／og 圖。
- **普隆德拉大廳第一階段（看得到其他玩家）**：程式已 commit，**Cloudflare Worker 還沒部署**，所以正式站目前不開 WebSocket，維持單機（已驗證零錯誤）。
  - 能做：彼此看得到、走動／外觀／表情同步、公開聊天（要登入）、訪客只能看，名字是「冒險者 NNNN」、進出關卡會離開／重新加入大廳。
  - 本機已驗過：兩個瀏覽器經 `wrangler dev`（本機 Worker）互通；config 沒有 lobby／config 500／大廳連不上（照常可玩，重試指數退避上限 30 秒）；登入玩家由頁面自己換票、hello 帶 `rt`。`npm run test:ro` 14 項通過。
  - **還沒驗過**：真正的 Google／LINE 登入接大廳、部署後的 Worker。

## 下一步

1. **使用者自己部署 Worker**（不可由 Claude 執行 `wrangler login`／`deploy`）：
   ```bash
   cd games/282-ro-life/worker
   npx wrangler login
   npx wrangler secret put RO_LOBBY_SECRET   # 長亂數
   npx wrangler deploy
   ```
   然後 Vercel 設 `RO_LOBBY_URL=wss://ro-lobby.<帳號>.workers.dev/api/ro/lobby`、`RO_LOBBY_SECRET`（同值），重新部署。
2. 部署後在正式站驗證：`/api/ro/config` 有回 `lobby`；兩台裝置（一台登入、一台訪客）互相看得到；登入的能聊天；`https://ro-lobby.<帳號>.workers.dev/health` 回 ok。若用 Vercel 預覽網址或自訂網域，要加進 `worker/wrangler.toml` 的 `ALLOWED_ORIGINS` 再 deploy。
3. 之後可選的擴充（使用者還沒決定）：
   - ② 社交：密語、好友、檢視他人資料（好友名單存 Neon，`ro_` 前綴新表，DDL 由使用者自己套用）。
   - ③ 交易、組隊打關卡：要把遊戲規則搬到伺服器，工作量大，等 ①② 穩定再評估。
   - 其他待辦：多頻道（現在每個大廳只有頻道 1、上限 80 人）、檢舉、角色名審核。

## 上一台電腦的習慣（memory 不會跟著換電腦）

- 一律用繁體中文回覆。
- 沒被要求就不 commit；commit 訊息格式 `YYYYMMDD-N`＋一行說明＋ attribution。使用者常同時開多個 session，commit 前看 `git status`。
- Cloudflare 一律用使用者自己的帳號、不自動部署；不要對使用者的 Neon 執行 DDL。
- 不要加回 F2 Debug 鈕；手機只做橫向；介面精簡、用圖示；保留同人聲明（`#fanNote`、`CREDITS.md`）。
- 不要把使用者的 email 或個資送到外部服務。
- 登錄檔（`index.html`、`README.md`、`llms.txt`、`sitemap.xml`）換行混用，`server/jade-table/server.mjs` 是 CRLF：用小範圍編輯，改完看 `git diff --stat`。
- 驗收用 Playwright（上一台的路徑 `/Users/xieyuanyou/Documents/TransitRail/node_modules/playwright/index.mjs` 是機器專屬；新電腦自己裝），`channel: 'chrome'`、`--use-angle=metal`，並加 `--host-resolver-rules=MAP ro.test 127.0.0.1` 走正式站分支。大廳驗收步驟寫在 `CLAUDE.md` 的大廳段落。
