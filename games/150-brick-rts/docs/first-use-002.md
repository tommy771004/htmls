# 首次使用修正迴圈 002：Worker 模擬 — 2026-09-25

依提示 19 執行現有移動里程碑的首次使用回歸；B 仍 in_progress。原作未知規則未改動。

## 環境與首次路徑

乾淨工作目錄：`/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/brick-rts-worker-first-use-elm_4ckl`。排除 node_modules，執行 npm ci --ignore-scripts → build → validate → test → test:browser。依賴重新安裝；瀏覽器使用既有 Playwright runtime。Node 22.23.1、darwin arm64、Chromium 151.0.7922.34；1440×900、390×844。seed 260925，ruleset hash b66067ad，起始 tick 0。

從首次進站等待 Worker → 村民 2 → 移動 → 單步 → 存讀 → 重播 → 開始／暫停 → 壞檔拒絕 → 新 seed → 地面指令 → 規則驗證／下載 → 原 seed 重建，兩種尺寸通過。頁面布局、縮圖與桌機截圖已檢視，沒有新破圖；本輪未聲稱任何碰撞或對局功能完成。

## 實作與修正

- `packages/sim/protocol.ts`：實際 sim service，帶版本／request ID 的操作與回應；錯誤含 tick、request、entity context。
- `apps/web/worker.ts`：Dedicated Worker 執行模擬；送出 transferable Int32Array 視圖。
- `apps/web/worker-client.ts`：請求追蹤、5 秒逾時、錯誤停用、已確認命令與 tick 的恢復紀錄。
- `apps/web/main.ts`：移動、步進、存讀、重播全部透過 Worker，主執行緒不執行權威 tick。模擬投影按確認步進更新，不按 render frame 複製完整世界。
- 載入／重新建立／重播先暫停；恢復只包含已確認狀態，不自動重送不確定指令。

## 問題表與原步驟重測

| ID | 嚴重度、根因與重現 | 修正／實測結果 |
|---|---|---|
| B-WORKER-START | P1：Worker constructor 丟錯若未進 fail handler，會停用但沒有重試入口。故障注入 1 次／run。 | constructor 納入錯誤處理；啟動失敗顯示重試，重試可啟動。正式瀏覽器回歸與乾淨目錄回歸均通過。 |
| B-WORKER-ERROR | P1：執行錯誤應停止並保留最後確認狀態，不能在 UI 偽裝繼續。tick 1 注入 ErrorEvent，實際 Worker 由 handler terminate。兩尺寸各一次／run。 | 所有 pending requests 拒絕，停用操作；重試建立新 Worker、恢復同 hash，重播一致。兩輪均通過。 |
| B-WORKER-TIMEOUT | P1：沒有回應的 advance 會卡住；且 reject callback 可能重新啟用 step。tick 0 在測試 transport 丟棄 advance。 | 5 秒 timeout、terminate、暫停與停用；step 同時檢查 connected。重試 hash 不變，下一次單步到 tick 1。兩輪均通過。 |
| B-ASYNC-TEST | 測試問題：舊測試在 click 後立即讀取同步 state，Worker 尚未確認，錯誤判成指令未排入。 | 改等待可見確認訊息／tick，沒有縮小狀態斷言；兩尺寸通過。 |
| RTS-COLLISION-001 | 沿用 001：裝飾地物尚未成為權威碰撞資料。 | 未修；後续建立真實地形與占地／路徑資料後優先驗收，不能宣稱完整戰場。 |
| RTS-LOOP-001 | 沿用 001：採集、建造、造兵、戰鬥、胜敗與再開對局尚未實作。 | 未修；無完整對局可驗收，保留 E 阻塞。 |

## 證據與限制

- 型別檢查／build、規則 validate 通過。
- 16 tests／16 pass，包括 10000 ticks、Worker service 錯誤原子性、ArrayBuffer transfer 及 replacement recovery。
- 桌機／手機原操作與 Worker 故障注入通過；正常流程無 pageerror、console.error、外部請求或水平溢出。
- 原始輸出：`docs/worker-verification.log`。清潔目錄截圖在 `/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/brick-rts-worker-first-use-elm_4ckl/games/150-brick-rts/test-results/`。
- 未驗證：真實 OS 強制殺 worker／瀏覽器 process crash、跨瀏覽器、目標內顯、大量單位、完整對局。故障測試為 transport／事件注入，未冒充上述情況。

B 尚欠 deterministic path 工作排程及後續資源／玩法的原子命令邊界。C–J 不因 Worker 通過而標完成；完整目標保持進行中。
