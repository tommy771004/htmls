# 多地形移動沙盒

目前 State／snapshot 為 v9。可建立草甸、海岸、高地與淺灘三種移動沙盒，存讀及 Worker 恢復保留地圖類型。尚無完整對局或海戰。詳見 docs/first-use-006.md。以下紀錄保留當時版本。

# 高度通行增量

目前 State／snapshot 使用 v8。手工驗收圖有高地與階梯，共用高度資料驅動導航及模型基座；正式沙盒仍為草甸。詳見 docs/heights-verification.md。

# 起始資源配置增量

目前 State／snapshot 使用 v7。生成器驗證雙方可接近的基本資源容量與路程差上限；不代表完整競技平衡。詳見 docs/starting-resources-verification.md。

# 七種資源增量

目前 State／snapshot 使用 v6。七種有限資源與代表模型已加入；採集、狩獵、放牧及捕魚工作仍待實作。詳見 docs/resources-verification.md。以下紀錄保留各輪當時版本。

# 三態視野增量

目前 State／snapshot 使用 v5；一般畫面僅顯示可見敵方與最後已見地物。已探索區保留快照，存讀與重播包含探索紀錄。C 仍進行中，詳見 docs/first-use-005.md。以下各節保留先前里程碑版本。

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

## 後續階段契約

`AGENTS.md` 固定逐階段與首次使用修正流程。版本逐項對照見 `docs/reference-comparison.json`；資料模型見 `docs/data-model.md`；A–J 的機器可讀依賴和完成門檻見 `docs/stage-dependencies.json`。目前 B 階段仍在進行，不能跳成已完成 C／D／E。

`npm run sim:headless -- 260925 10000` 執行真實無畫面命令、tick、存讀續跑與重播一致性檢查，並輸出觀測到的 tick CPU 耗時。量測不參與權威狀態，不代表浏览器 FPS 或整合式 GPU 驗收。首次使用證據見 `docs/first-use-001.md`。

## Worker 里程碑

瀏覽器已使用真正的 Dedicated Worker 執行模擬。建置產物必須同時包含 `web/assets/150-brick-rts/main.js` 與 `worker.js`。Worker 故障會暫停並顯示「重試模擬連線」，恢復至最後確認 tick；未確認的指令不會自動重送。首次使用與故障注入記錄見 `docs/first-use-002.md`。

## Navigation milestone update (2026-09-25)

The latest implementation supersedes earlier no-collision notes: `packages/sim/navigation.ts` supplies shared static house/tree/rock footprints and deterministic routing. State v2 includes map, pathJobs, frontier/parents/head, unit path and navigation status. All jobs share 32 node expansions per tick in stable order. Runtime defaults are recorded in `docs/runtime-manifest.json`; they are not reference-game values. Static obstacle clearance is implemented, but unit-to-unit avoidance, dynamic occupancy, formations, full resource economy and match completion remain pending.

Snapshots now use sandbox v2. Old v1 snapshots are explicitly rejected without changing the live state; no migration is claimed. Full RTS collision and match gates remain open. See `docs/first-use-003.md`.

## Resource transaction foundation

`packages/sim/economy.ts` now backs authoritative accounts and queued reserve/cancelReservation commands. This API is tested headlessly; it does not add fake building/training controls. Snapshot v3 includes account history and command admission ticks; older sandbox snapshots are explicitly incompatible. See docs/economy-verification.md. The B foundation gate now has evidence for atomic resource handling; C is the next implementation stage.

## C: 3D scene milestone

The gameplay page now renders real WebGL2 geometry through the locally vendored Three.js 0.186.0. Serve the repository root so `/vendor/three-0.186.0/` remains available; no CDN is used. `web/150-brick-rts-models.html` is a separate asset viewer, not a game mode. It shares the same scene generator, rotation, near/far detail and live renderer counters.

Static obstacle footprints remain authoritative in navigation.ts. Camera controls and walk animation do not decide movement. WebGL failure pauses input; an existing Worker stays available for saving before reload. This is the first C rendering slice; resources, fog, full village/army assets and all later gameplay remain incomplete.
# 地格與資源資料增量

目前 State／snapshot 使用 v4。地格資料、樹木／石塊有限容量、耗盡原語與局部導航更新已接入並驗證；村民採集玩法尚未提供。舊版存檔會明確拒絕，尚無遷移。詳見 docs/terrain-verification.md；C 階段仍在進行。
