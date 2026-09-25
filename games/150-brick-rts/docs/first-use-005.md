# 首次使用修正迴圈 005：三態視野

2026-09-25。C 階段可移動探索里程碑，不是完整 RTS 對局。

## 環境與路徑

Node 22.23.1、darwin arm64、Chromium 151.0.7922.34；1440×900、390×844。seed 260925，ruleset `cf7d9525`，state/snapshot v5。各視野半徑、共享策略與保留靜態物件規則均為 design_default，原作規則仍 unverified。

首次進站 tick 0 → 看見藍方村民、未探索區 → 選村民 → 地面移動與繞屋 → 暫停 → 存讀與重播 → 更換 seed／重建。既有兩尺寸流程、Worker 故障恢復與 WebGL 故障操作均在一般工作目錄通過。

額外桌面視野流程：村民 1 從 (3.5, 7) 移到 (11, 9) → 敵方村民及房屋出現 → 回到 (3.5, 7) → 敵方村民不再出現在 Worker 一般投影，房屋保留灰色舊快照且 lastSeenTick 小於目前 tick → 存讀 → 重播一致。這一輪截圖 tick 415；自動執行的暫停時機可能差數個 tick，測試以到達座標與待命狀態為準。

主目錄 `test-results/fog-unexplored.png`、`fog-enemy-visible.png`、`fog-retreated.png` 為真實瀏覽器截圖；撤回截圖已目視檢查，敵方村民消失，房屋與地物變為舊視野顏色。下方視野計數來自 Worker 三態陣列，不提供全圖作弊切換。模型檢視頁使用獨立且明示的 assetPreview，不能切換遊戲的權威視野。

## 問題與修正

| 問題／嚴重度 | 根因、處理與原步驟重測 |
|---|---|
| 初次建置 ENOENT／啟動阻塞 | build.mjs 複製 HTML 時假設 web 已存在。乾淨目錄重現一次；新增 mkdir recursive 後，從同一目錄重跑 build、validate、38 項測試通過。 |
| 全圖敵人一直可見／玩法資訊洩漏 | 原本 Worker 傳所有單位，renderer 從 seed 畫全部地物。現在一般 View 僅含己方及目前可見敵方、已知靜態快照；未知模型根本不進入場景或 raycast 集合。桌面走近／撤回與單元投影測試通過。 |
| 離開視野後仍可能同步地物／資訊洩漏 | 每玩家保存帶 tick 的靜態快照；不可見格不重新讀取現在狀態。刪除物件後要重訪才清除記憶。測試涵蓋隱藏物件消失、共享視野撤銷與探索保留。 |
| RTS-LOOP-001／完整對局阻塞 | 採集、送返、建造、升級、造兵、戰鬥、勝敗未完成，prompt 19 在探索沙盒後仍中斷；沒有以假按鈕取代。 |

## 驗證範圍

一般目錄 build 與 38 項程式測試、完整瀏覽器回歸通過。新測試涵蓋三態變換、隱藏敵人移動不改玩家投影、最後已見快照、共享策略撤銷、Worker 過濾、存讀與命令重播。

乾淨目錄：`/var/folders/05/x61j217d49g9k0_kccntyzsr0000gn/T/brick-rts-fog-first-use-aglvxzmt`，排除 node_modules／test-results，保留本地 Three.js vendor。npm ci --ignore-scripts 成功；首次 build 失敗後已修正並重測 build、validate、38 tests 全過。該目錄以 PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs 執行 npm run test:browser，桌面／手機、視野往返、存讀／重播、Worker／WebGL 故障及首頁搜尋全部通過。正常兩尺寸流程無 pageerror、console.error、外部請求或水平溢出；截圖在該目錄 test-results/。

## 仍未完成

這是單人本機的畫面／一般 Worker 投影過濾。完整本機存檔、恢復 journal、seed 與偵錯 hash 仍可含全局資訊，不能宣稱反作弊；H 階段仍需權威伺服器限制隱藏資料。沒有多人、外交科技 UI、音效／反射系統的整體洩漏驗收。

目前視野是平面圓形地格判定，不含高地／遮擋的原作對照。動態建築與完整資源還沒接入。舊 v1–v4 存檔明確拒絕而不改現況，未實作遷移。C 尚缺完整資產矩陣、海域與高地生成、資源種類、公平規則、手工验收圖等；繼續按 BUILD_ORDER 完成 C 後才進入 D。
