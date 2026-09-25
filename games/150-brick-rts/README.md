# 150 · 磚築紀元 / Brick RTS

依 `docs/Brick_RTS_Prompt_Pack` 的 00、01 與部分 02 起步。分類為「遊戲敘事」。本次交付可操作的規則驗證與移動沙盒，尚未實作完整對戰。

## 啟動與建置

需要 Node.js 22.18+、npm；靜態 HTTP server 可用 Python 3。指令從本目錄執行：

```sh
npm ci
npm run validate
npm test
npm run build
# 選用：監看 TypeScript；HTML 修改需重跑 build
npm run dev
```

在 repository root 執行 `python3 -m http.server 8000`，開啟 `http://localhost:8000/web/150-brick-rts.html`。靜態產物已提交於 `web/`，普通瀏覽無須安裝依賴。未使用 CDN 或遠端素材。

瀏覽器回歸沿用 repository 的 Playwright 外部 runtime 方式：

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs npm run test:browser
```

執行環境需先安裝該 Playwright 對應 Chromium。測試自行啟動 loopback HTTP server、產生 `test-results/` 截圖及 `thumbs/150.jpg`。

## 操作

1. 選取村民 1–3，點地面或輸入 X／Y 格（0.5–15.5）後按移動。
2. 按「開始模擬」執行；也能暫停後逐 tick 推進。紅方不可控制，尚無 AI。
3. 儲存／讀取使用 `brick-rts:sandbox:1` localStorage key；重建不覆蓋手動存檔。
4. 「驗證指令重播」在當前 seed 下重跑指令並比較完整狀態 hash。
5. 下方展開規則 JSON 編輯器，可驗證／還原／匯出。編輯器不套用至沙盒。要求精確原作版本時，預設規則會被拒絕。

背景分頁、失焦或超過一秒的累積延遲會暫停，避免跳過 tick。模擬不依賴 DOM／Canvas；畫面採独立的種子 stream。移動採整數座標，不含尋路或碰撞。

## 檔案與追蹤

- `packages/content/rules.ts`：TypeScript schema、原創自訂資料及 unknown-input runtime validator。
- `packages/sim/sim.ts`：固定步進、命令、hash、序列化與重播。
- `apps/web/`：輸入、HUD、Canvas 程序插畫；與權威 state 分離。
- `docs/ruleset-manifest.json`：build 由規則來源匯出，不手動修改。
- `docs/scope-inventory.json`：原作全集獨立目錄與未知分母、首個完整切片目標。
- `docs/feature-ledger.csv`：保留完整提示包條目；只更新有實作的項目。
- `docs/asset-manifest.json`、`docs/completeness-matrix.md`、`docs/verification.md`：素材、缺口與實測證據。

參數全部為 `design_default`。未指定或核對原作版本，不宣稱最新版本、完整內容或精確移植。Canvas 插畫不是已完成的 3D 美術階段；完整功能清單與下一階段見 completeness matrix。
