# 完整性與缺口

本次為 A 階段規則驗證與 B 階段部分命令基礎；不是最終完整切片。判斷「功能等價」需實際互動測試；「精確原作對照」另需指定原作版本、build、來源與參數逐項比較，兩者不能互相替代。

| 面向 | 已交付 | 缺口 |
|---|---|---|
| 規則 | typed schema、runtime validator、10 個自訂內容 entry、版本 manifest、完整 feature ledger | 原作 build、內容包、平台差異與完整內容目錄仍未知；原作分母 unknown |
| 模擬 | 純 TypeScript、20 Hz、整數座標、xorshift32、所有權與序列驗證、canonical hash、Worker 所有權與錯誤恢復 | 資源原子交易、科技、戰鬥、視野、路徑工作與完整系統 profiler |
| 視覺 | Canvas 2D 原創積木示意、種子地物、村民移動 | 非 WebGL2 生產渲染；真實 3D、LOD、instancing、動作與損壞狀態尚未實作 |
| 操作 | 村民按鈕／滑鼠單選、地面／座標移動、暫停、單步、重建 | 框選、編組、鏡頭、碰撞與尋路；裝飾樹木／建築可穿越 |
| 存讀 | 本機沙盒存檔、壞檔保留現況、checksum 與重播重建核對 | 僅適用 sandbox v1；完整遊戲、IndexedDB、遷移未做；讀取上限 100000 ticks / 10000 命令 |
| 遊戲閉環 | 尚未實作 | 採集、攜帶送返、建造、人口、四時代、造兵、AI、戰鬥、勝敗 |
| 內容／模式 | 自訂雙方資料定義 | 文明差異、海軍、貿易、宗教、多人、戰役與情境編輯器 |
| 品質 | Node 核心測試與 Chromium 桌機／手機操作測試 | Firefox、Safari、Edge、目標內顯硬體與效能數據未驗證 |

依賴：A（原作資料待補；自訂規則可用）→ B 完整模擬 → C 3D／地形／迷霧 → D 尋路與操作 → E 首個完整對局 → F 系統內容 → G 完整存讀 → H 多人 → I 模式 → J 品質。每個可玩里程碑再執行提示 19 首次使用修正循環。

本輪已新增無畫面執行器及四單位 tick profiler；Worker 協定與恢復已實際接入瀏覽器；下一步補 deterministic path job 與資源原子交易的模擬邊界，再開始 C。不可將本頁 Canvas 示意、資料中的兵種或時代，標記為已實作 RTS 玩法。

## Navigation milestone update (2026-09-25)

The latest implementation supersedes earlier no-collision notes: `packages/sim/navigation.ts` supplies shared static house/tree/rock footprints and deterministic routing. State v2 includes map, pathJobs, frontier/parents/head, unit path and navigation status. All jobs share 32 node expansions per tick in stable order. Runtime defaults are recorded in `docs/runtime-manifest.json`; they are not reference-game values. Static obstacle clearance is implemented, but unit-to-unit avoidance, dynamic occupancy, formations, full resource economy and match completion remain pending.

Snapshots now use sandbox v2. Old v1 snapshots are explicitly rejected without changing the live state; no migration is claimed. Full RTS collision and match gates remain open. See `docs/first-use-003.md`.
