# 286 · 天堂人生 1.63 獨立運作平台（Lineage 1.63 Web Platform）

致敬經典《天堂 Lineage 1.63 — 說話之島（Build #656 / GI-0.5）》的完整網頁獨立運作平台。單檔打包輸出至 `../../web/286-lineage-web.html`，美術圖集、335 包二進位分包（`.bin`）、地圖區塊（`.json.gz`）與 Service Worker／Web Worker 放在 `../../assets/286/`，後端服務位於 `../../server/lineage-web/` 與 `../../api/lineage.mjs`。

## 功能與 9 大視圖

1. **遊戲大廳（`#/`）**：
   - **4:3 經典認證舞台**：28 格開場背景動畫、快速免帳密體驗、帳號註冊与登入。
   - **8 槽位角色選擇**：支援第 1–4 與第 5–8 雙頁切換、角色六維與血盟／正義值／AC 面板、匯入／匯出 JSON 存檔、輸入角色名確認刪除。
   - **8 職業創角室**：王族、騎士、妖精、法師、黑暗妖精、龍騎士、幻術師、戰士（含男女外觀預覽、單項上限 18 點數分配、經典模式開關）。
   - **說話之島遊戲舞台**：即時解壓縮 `/lineage163/maps/0/7ff88000.json.gz` 地圖地磚並繪製於 Canvas，提供道具欄、1.63 重繪 HUD 圖示、Web Worker（`auto-worker465.js`、`scenery-worker289.js`）狀態探針與 WebSocket 閘道器 Ticket／Frame Ping 測試。
2. **官方入口（`#/official`）**：版本 `GI-0.5` 首發範圍、開放區域、656 建置資訊與快速跳轉。
3. **首發攻略圖鑑（`#/guide`）**：內建完整 243 筆攻略條目（職業、技能、怪物、裝備、道具、地圖、NPC、套裝）、分類篩選、即時關鍵字搜尋與說話之島 NPC 對話腳本檢索。
4. **冒險者論壇（`#/form`）**：支援發表新主題、分類檢索、留言回覆與按讚互動。
5. **能力骰子模擬器（`#/rice`）**：依五大經典職業獎勵點數池與單項 18 上限規則進行單次擲骰與 500 次蒙地卡羅分佈統計。
6. **蛋幣儲值與憑證中心（`#/topup`）**：Origin Pay HMAC-SHA256 訂單簽章、模擬金流 Webhook 驗簽入帳，以及 Google Play Billing `purchaseToken` 冪等防重放驗證。
7. **GM 管理與稽核控制台（`#/gm`）**：受 `GM_ADMIN_TOKEN` 保護之維護模式切換、玩家帳號凍結／解凍、補償蛋幣發放、稽核日誌與客戶端異常回報檢視。
8. **隱私權政策（`#/privacy`、`#/privacy2`）**：完整版與精簡內嵌版隱私權聲明。

## 指令

```bash
# 1. 打包單檔 ../../web/286-lineage-web.html
node games/286-lineage-web/tools/build.mjs

# 2. 執行後端 8 大領域模組單元測試 + 18 個 API 端點與 .bin 分包切片整合測試
npm run test:lineage

# 3. 執行 Playwright 無頭 Chrome 多視窗（1440x900 ~ 390x844）全視圖驗收並產生 thumbs/286.jpg
node games/286-lineage-web/tools/accept.mjs
```

## 架構與目錄

```text
games/286-lineage-web/
  src/
    app.js                      # 全站 9 大視圖、4:3 舞台狀態機、API 與離線雙模引擎
    styles/
      globals.css               # 深色羊皮紙金框主題與響應式排版（防止手機水平溢位）
      lineage-auth.css          # 4:3 登入、8 槽位選角、8 職業創角與說話之島舞台樣式
    data/captured/              # 擷取自原版之完整資料集（243 筆 guide、names、dialogues、forum-topics、release-scope）
  tools/
    build.mjs                   # 內嵌 CSS、擷取資料集與腳本，輸出單檔 ../../web/286-lineage-web.html
    accept.mjs                  # Playwright 5 視窗尺寸與 9 視圖端到端驗收腳本 + 縮圖產生器
  worker/                       # Cloudflare Edge Worker（R2_ASSETS + RealmGatewayDO Durable Object）
    wrangler.toml
    src/index.ts
    src/realmGateway.ts

server/lineage-web/
  core.mjs                      # 密碼雜湊、HMAC 票券、Origin 防護、訂單簽章、冪等憑證與 8 槽位遊戲規則
  repository.mjs                # Neon PostgreSQL / 記憶體雙模式儲存庫 + art-assets.json 二進位 .bin 分包切片器
  server.mjs                    # 18 個 /api/lineage/* 路由與 /assets/286/* 靜態／分包服務
  schema.sql                    # PostgreSQL 資料表結構（10 張表）
  lineage.test.mjs              # 單元測試與 HTTP API 整合測試

api/lineage.mjs                 # Vercel Serverless Function 入口
assets/286/                     # 1.63 美術圖集、335 個 .bin 分包、地圖 .json.gz、SW 與 Web Workers
```

## 環境變數與資料庫（選填）

未設定資料庫時，本機 `npm start` 與單檔頁面皆會自動使用記憶體儲存庫（`InMemoryRealmRepository`）與前端內建後援，開箱即用。若需連接 Neon PostgreSQL：

```bash
psql "$LINEAGE_DATABASE_URL" -f server/lineage-web/schema.sql
```

可用環境變數：
- `LINEAGE_DATABASE_URL`（或 `DATABASE_URL`）：PostgreSQL 連線字串
- `REALM_WS_SECRET`：WebSocket 入場票 HMAC 密鑰
- `ORIGIN_PAY_SECRET`：Origin Pay 儲值訂單與 Webhook 簽章密鑰
- `GM_ADMIN_TOKEN`：GM 控制台管理權杖（預設開發值：`dev-gm-secret-token`）
- `ALLOWED_ORIGINS`：允許的跨來源清單（逗號分隔）

## Cloudflare Edge Worker 手動部署說明

若需部署 R2 分包快取與 `RealmGatewayDO` 即時閘道器，請由使用者於自己的 Cloudflare 帳號手動執行：

```bash
cd games/286-lineage-web/worker
npx wrangler deploy
```
