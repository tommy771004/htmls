# C：七種資源資料與模型

2026-09-25。本輪補齊 tree、stone、gold、berries、hunt、livestock、fish 的資料與代表模型；沒有完成村民採集、狩獵、放牧或漁船工作。

## 權威資料與畫面

每節點具有 ID、位置、有限 capacity／remaining、collectible、status、obstacleId、depletedAt。resourceDefinitions 明確列出產出 wood／stone／gold／food、所需工作方法 gather／hunt／herd／fish 與 land／water 通行類別。數值均為 design_default，不是原作數值。collectible 表示資源仍可供工作系統使用；工作方法的完整授權與動作仍待 E 階段，不能直接等同村民已會狩獵。

金礦、野果、獵物與家畜採固定成對位置；魚群只出現在海岸或手工河道。固定配置不代表已通過起始資源公平檢查，隨機森林與石礦的數量／距離仍可能不均。資源配置是否合法會檢查地格通行類別。

地面資源含碰撞占地，耗盡會釋放局部導航；魚群採非阻擋水域資源。動物目前不自主移動。renderer 有金色礦塊、果叢、兩種動物與魚群的原創幾何；僅代表模型，無工作／死亡動畫。靜態地物保持最後已見快照，動物離開視野便移除；一般 Worker resources 投影只含目前可見且未耗盡節點，不傳送隱藏容量。

## 檢查與修正

`npm run build`、`npm test`、`npm run maps:export` 通過，46 項測試。新增七種類容量／耗盡一次、動物占地釋放、魚群不阻擋航線、錯誤地形拒絕，以及隱藏資源容量變化不改可見投影的測試。既有 10000 ticks、Worker 恢復、存讀與重播測試通過。

首輪有四個既有測試失敗：預設目的地 (12,9) 新增家畜占地後不可通行。已把通用重播與 headless runner 的目的地改為空地 (11.5,9)，保留碰撞限制，另加資源占地回歸。沒有放寬碰撞檢查來讓測試通過。

Chromium 151.0.7922.34 瀏覽器回歸通過：1440×900／390×844、地物繞行、存讀／重播、視野往返、Worker 故障恢復、WebGL 故障、三圖切換及首頁搜尋。正常兩尺寸流程無 pageerror、console.error、外部請求或水平溢出。`test-results/map-coast.png` 已目視檢查，金礦、果叢、動物與海域魚群顯示正常。這是現有工作目錄回歸，沒有另宣稱乾淨安裝或完整採集驗收。

State／snapshot 升為 v6，ruleset `7eb03f8e`；v1–v5 明確拒絕且保留現況，沒有存檔遷移。這次資料／模型增量沒有新增可工作的採集操作；C 與完整對局仍未完成，最近的乾淨目錄首次使用里程碑見 first-use-005.md。
