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

## 放牧、狩獵與捕魚（2026-09-29）

羊、鹿、野豬是模擬中的單位（歸屬、逃跑、反擊、屍體、腐壞），岸邊魚可由村民採集，電腦會用；有單元測試與 `test:economy` 瀏覽器流程。缺口：漁船、碼頭、魚梁與海軍；經濟科技；市場；城牆、塔、駐軍；鐵匠鋪、兵種相剋與升級；攻城器；陣型與姿態。原作數值多數未查證（見 aoe2-rules-research.md）。

## 經濟科技與自動補種（2026-09-29）

13 項經濟科技（採集速度、攜帶量、農田食物、村民生命）與自動補種已接入模擬、頁面與電腦，有單元測試。缺口：村民移動速度加成；鐵匠鋪與軍事科技；市場；原作數值多數未查證。

## 鐵匠鋪、護甲與兵種相剋（2026-09-29）

近戰／遠程護甲與類別加成、長槍兵／散兵／騎士、6 項兵種升級、鐵匠鋪 15 項科技已接入模擬、頁面與電腦，有單元測試。缺口：攻城器、城堡與特殊兵種、騎射手、駱駝、火藥、海軍；城牆與塔；市場；姿態與攻擊移動。

## 城鎮中心射箭、駐軍、箭塔與攻城槌（2026-09-29）

城鎮中心與箭塔自動射箭、駐軍（加箭、回血、放出、倒塌時彈出）、鐘聲與回去工作、攻城器工坊與攻城槌已接入模擬、頁面與電腦，有單元測試。缺口：城牆與城門、城堡、投石車與其他攻城器、攻城槌載兵、市場、姿態與攻擊移動。
