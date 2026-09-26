# 實測紀錄 — 2026-09-25

本輪範圍：規則驗證與命令沙盒；不是首個完整 RTS 對局驗收。

| 檢查 | 實際結果 |
|---|---|
| `npm ci` / locked dependencies | npm install 建立 lockfile；npm ci 尚未另跑 |
| `npm run build` | PASS：TypeScript strict 型別檢查、manifest 匯出、靜態 JS／HTML 建置 |
| `npm run validate` | PASS：自訂規則資料有效；原作 coverage unknown |
| `npm test` | 9 tests、9 pass、0 fail；Node 22.23.1 |
| 10000 ticks | 同 seed／指令重播、分批更新及存讀續跑 hash 一致 |
| 錯誤資料 | 重複 ID、懸空前置、負成本、循環、禁用項、未知版本 exact check 均拒絕 |
| 錯誤命令 | 敵方控制、過期、重複、錯誤版本與無效座標拒絕且不改 state |
| Chromium 151.0.7922.34 / 1440×900 | PASS |
| Chromium 151.0.7922.34 / 390×844 | PASS |
| 首頁 | 「遊戲敘事」篩選＋Brick RTS 搜尋找到 150 |

瀏覽器腳本：`tests/browser.mjs`。實際操作選村民、輸入與地面移動、tick、暫停、存讀、破損存檔保留現況、重播、重建、JSON 驗證／還原／下載；兩種尺寸沒有水平溢出、pageerror、console.error 或外部網路請求。桌機與手機完整截圖已目視檢查。截圖留在本地 `test-results/desktop-1440.png`、`test-results/desktop-390.png`（gitignored）；作品縮圖為 repository `thumbs/150.jpg`。

執行：

```sh
PLAYWRIGHT_MODULE=/Users/tommy/Documents/Proj/OldBabyInfo/node_modules/playwright/index.mjs node games/150-brick-rts/tests/browser.mjs
```

第一次手機測試的 raw mouse click 因 canvas 已捲出視窗而未命中；測試腳本已改為 scrollIntoViewIfNeeded 後点击，同步重跑桌機與手機通過。未以此宣稱原作提示 19「首次進站到勝利」已完成。

未驗證：Firefox／Safari／Edge、原作精確數值、WebGL2 3D 場景、多人、完整遊戲存檔、實機內顯 FPS／frame time、正式 RTS 對局。沒有以自訂資料的驗證結果換算原作覆蓋率。

## 後續驗證

第二輪已在新工作目錄完成 npm ci、build、validate、13 項測試、headless 及兩尺寸瀏覽器測試。詳細首次使用路徑與仍阻塞完整對局的問題見 `first-use-001.md`；上一輪的 9 tests 為當時紀錄。

## Worker 里程碑

最新乾淨目錄驗證：16 tests／16 pass，桌機與手機流程、Worker 啟動失敗／中斷／timeout 的恢復均通過。詳細步驟與未完成項見 `first-use-002.md`，原始輸出見 `worker-verification.log`。

## Navigation milestone

Latest clean-directory run: 22 tests passed; desktop/mobile real house routing, blocked-target rejection, replay, Worker recovery and catalogue passed. See first-use-003.md for reproduction details and remaining gates.

## 3D 戰場基礎（最新）

乾淨目錄 npm ci、build、validate、28 項程式測試及兩尺寸瀏覽器流程通過。實際 WebGL2 場景、鏡頭控制、模型檢視、context loss 後儲存及 WebGL2 不可用的明確失敗狀態均已測試。詳見 [first-use-004.md](first-use-004.md)。此紀錄取代上文「3D 尚未驗證」的歷史狀態；C 的資源／迷霧與完整對局仍未完成。

## 地圖與資源資料 v4

目前工作目錄的 build、validate、33 項測試及完整既有瀏覽器回歸通過。新增地格、樹木／石塊容量與耗盡原語、局部導航更新；可玩採集及迷霧尚未接入。詳見 [terrain-verification.md](terrain-verification.md)。最新 state／snapshot 為 v4；歷史紀錄保留各輪當時版本。

## 三態視野 v5（最新）

乾淨目錄 npm ci、build、validate、38 項測試、兩尺寸完整瀏覽器回歸及實際走近／撤回視野測試通過。首次 build 缺少 web 輸出資料夾的問題已修正並從原失敗目錄重測。state／snapshot 現為 v5。詳見 [first-use-005.md](first-use-005.md)；仍不代表完整 C、完整對局或多人反作弊通過。

## 海岸與手工圖增量

42 項測試、建置、規則驗證、地圖 JSON 匯出與完整瀏覽器回歸通過。另確認驗收頁三圖切換及返回草甸的畫面一致。詳見 [map-examples-verification.md](map-examples-verification.md)。正式沙盒仍僅使用草甸；沒有以地圖檢視宣稱海戰已完成。

## 七種資源 v6（最新）

46 項測試、建置、地圖匯出與完整瀏覽器回歸通過；新增有限資源、動物占地、魚群地形與可見資源投影驗證。snapshot 現為 v6。詳見 [resources-verification.md](resources-verification.md)，仍未完成採集工作或完整對局。

## 起始資源門檻 v7（最新）

50 項測試、build、validate、maps:export 與完整瀏覽器回歸通過。生成器檢查容量下限、安全鄰近位置與最近路程差上限；不等同完整競技平衡。snapshot 現為 v7。詳見 [starting-resources-verification.md](starting-resources-verification.md)。

## 高度通行 v8（最新）

54 項測試、build、validate、地圖匯出與完整瀏覽器回歸通過；手工圖地台／階梯已目視檢查。詳見 [heights-verification.md](heights-verification.md)。snapshot 現為 v8；尚無高地正式對局與原作高度效果。

## 多地形移動 v9（最新）

乾淨目錄 npm ci、build、validate、57 項测试及 browser 首次使用流程通過。實測直接點選高地後登階到達、海岸深水拒絕、跨地圖讀檔及 Worker 恢復；草甸兩尺寸與故障流程亦通過。snapshot 現為 v9，詳見 [first-use-006.md](first-use-006.md)。完整採集、戰鬥與勝敗尚未完成。

## 人偶資產增量

59 項測試、build、完整瀏覽器回歸與專用聚焦姿態測試通過。工具 sockets、剛體關節及七種姿態可在模型頁檢查，遊戲仍僅接入待命／行走。詳見 [unit-rig-verification.md](unit-rig-verification.md)。不改模擬，snapshot 維持 v9。

## 建築外觀增量

63 項測試、build、完整瀏覽器回歸與模型專用操作測試通過。代表房屋新增四種時代輪廓、五段實體施工、受損與有限殘骸，恢復完整狀態後截圖一致。詳見 [building-visuals-verification.md](building-visuals-verification.md)。僅為模型驗收，尚未接入建造／修理玩法；C 維持 in_progress，snapshot 維持 v9。

## 代表步兵輪廓增量

64 項測試、build 與完整瀏覽器回歸通過。模型頁新增劍盾、長矛與弓兵裝備切換，修正展示位置遮擋，詳見 [infantry-visuals-verification.md](infantry-visuals-verification.md)。僅為資產驗收，尚無戰鬥操作；C 仍在進行。

## 模型頁故障處理

新增 context loss 與每幀例外的停止／重新載入流程，以及失敗截圖與事件紀錄。故障注入實測見 [model-failure-verification.md](model-failure-verification.md)；先前偶發空白根因仍未確認，不將診斷改進當成根因修復。

## 經濟建築資產增量

新增伐木場、採礦場、磨坊與農田模型及驗收切換。66 項程式測試與完整沙盒回歸通過，修正旗幟遮擋及磨坊輪廓；詳見 [economic-assets-verification.md](economic-assets-verification.md)。未接入派工與生產，完整村落仍未完成。

## 三段渲染細節增量

67 項程式測試及模型頁近／中／遠切換與近景還原通過，選取保留详细幾何。實際三角形觀測值與限制見 [lod-verification.md](lod-verification.md)。未宣稱目標硬體效能或完整 LOD 資產矩陣完成。

## 村落公共建築增量

新增城鎮中心、市場與鐵匠舖的代表外觀，67 項程式測試及模型切換／狀態還原／故障測試通過。詳見 [civic-assets-verification.md](civic-assets-verification.md)。不包含生產、交易、研究或權威建築占地。

## 隱藏配件選取修正

修正遞迴 raycast 命中不可見配件的問題，69 項測試通過。實際長矛在三段 LOD 卸下後不再擴大命中範圍；見 [picking-verification.md](picking-verification.md)。C 尚缺門檻整理在 [c-stage-open-gates.md](c-stage-open-gates.md)，未變更完成條件。

## 迷霧除錯面板

新增只讀目前玩家投影的三態格網與最後已見住宅時間查詢。70 項測試通過；詳見 [fog-debug-verification.md](fog-debug-verification.md)。不讀全域隱藏狀態、不提供假視野／外交操作。

## 騎乘模型增量

新增四腿馬匹、鞍座掛點與坐姿騎手，71 項測試通過。未支援的騎乘姿態明確停用；詳見 [mounted-verification.md](mounted-verification.md)。仍未接入騎兵玩法或權威碰撞。

## 沙盒繪圖例外保護

正式沙盒新增場景更新與每幀繪圖的例外處理，停止輸入並保留存檔通道。重現步驟與驗證範圍見 [sandbox-render-verification.md](sandbox-render-verification.md)。

## 共用物理占地

住宅地基與導航改讀同一份既有占地資料；九組修改前後地圖阻擋格與 240 ticks 狀態指紋一致。詳見 [footprints-verification.md](footprints-verification.md)。v9 相容性保留，沒有開放新通行或建造功能。

## 軍事建築代表資產

新增兵營、靶場與馬廄模型；74 項程式測試通過，模型切換、施工／殘骸與住宅還原已驗證。詳見 [military-assets-verification.md](military-assets-verification.md)。未加入造兵或權威建築占地。

## 拱件幾何增量

住宅高時代門框與城鎮中心改用有開口的拱件；射線及 LOD 保留開口的驗證見 [arch-verification.md](arch-verification.md)。未改權威碰撞或開放入口通行。

## C：軍事建築時代輪廓

兵營／靶場／馬廄的四種結構外觀、支撐與狀態還原驗證見 [military-ages-verification.md](military-ages-verification.md)。76 項單元測試與模型瀏覽器檢查通過；仍為檢視頁外觀，C in_progress。

## C：建築凸點接合

建築凸點改依當前零件遮擋與邊界生成，驗證見 [building-studs-verification.md](building-studs-verification.md)。78 項測試、模型與正式沙盒瀏覽器回歸通過；不構成新可玩里程碑或完整 C 驗收。

## C：經濟／城鎮建築時代輪廓與承托

七類經濟／城鎮建築的四時代結構，以及全建築零件連回地基的測試，驗證見 [economic-ages-verification.md](economic-ages-verification.md)。80 項測試、模型與正式沙盒瀏覽器回歸都通過。模型測試第一次執行時發生一次非注入的 context loss，已保留診斷，根因不明。這一輪仍然只改檢視頁外觀，不構成新的可玩里程碑。

## C：城鎮中心入口與多矩形占地（v10）

正式沙盒的起始建築改成城鎮中心，拱門與大廳真的可以通行，碰撞與模型一致有測試鎖定；prompt 19 已從乾淨目錄重跑，見 [first-use-007.md](first-use-007.md)。84 項單元測試、test:browser 11 組和首次使用流程都通過。C 仍是 in_progress。

## D：群體移動、單位占位與選取操作（v11）

框選、編組、右鍵群體移動、停止、觸控移動，以及單位互不重疊的排隊、讓路與受阻回報，驗證見 [first-use-008.md](first-use-008.md)。負載紀錄在 test-results/movement-benchmark*.json。D 仍是 in_progress。

## E：採集、攜帶與送返（v12）

樹木、石礦、金礦、野果的採集循環、資源流量帳、HUD 真實庫存、依狀態驅動的人偶姿態，以及鏡頭平移，驗證見 [first-use-009.md](first-use-009.md)。E 仍是 in_progress：建造、人口、升時代、造兵、戰鬥、AI 與勝敗尚未實作。

## E：建造與人口（v13）

住宅與兵營的放置預覽與合法性、放置扣款、多人施工、分段模型、完工增加人口上限、取消全額退款、新地基的導航更新，驗證見 [first-use-010.md](first-use-010.md)。E 仍是 in_progress：造兵、升時代、戰鬥、AI 與勝敗尚未實作。

## E：生產、集結與升時代（v14）

城鎮中心生產村民與研究時代、兵營生產近戰民兵與弓手、人口保留與上限、佇列取消退款、出口受阻等待、集結點、混合選取只派村民，驗證見 [first-use-011.md](first-use-011.md)。E 仍是 in_progress：戰鬥、AI 與勝敗尚未實作。

## E：戰鬥與征服勝負（v15）

攻擊命令、自動迎擊、包圍站位、死亡與倒地畫面、建築受損與摧毀、費用沒收、征服勝負與再開一局，以及遊戲速度，驗證見 [first-use-012.md](first-use-012.md)。E 仍是 in_progress：紅方還沒有 AI。

## 全畫面遊戲畫面（v15，模擬未變）

整頁改成遊戲畫面：資源列、戰場、指令格、選取資訊、小地圖、選單，開發工具移到 `?debug=1` 的除錯抽屜。一般模式的首次進站流程是 `npm run test:hud`，驗證見 [first-use-013.md](first-use-013.md)。E 仍是 in_progress：紅方還沒有 AI。

## E：電腦對手、農田與第一場完整對局（v16）

紅方由電腦操控：經濟、蓋房、兵營、農田、升第二時代、造兵、防守與分波進攻。玩家可以從首次進站一路打到勝利並再開一局（`npm run test:match`）。本輪還修正了兩個規則錯誤，並把地圖改為左右對稱，驗證見 [first-use-014.md](first-use-014.md)。E 仍是 in_progress：完整對局流程裡玩家還沒有升時代，撤退與治療也尚未實作。

## 放大地圖與隨機出生（v17）

新的 32×32「曠野」對戰圖、以地圖中心為圓心的隨機出生、每位玩家相同的基地資源、依地圖大小調整的電腦與畫面，以及大地圖所需的效能修正，驗證見 [first-use-016.md](first-use-016.md)；原作規則查核見 [aoe2-rules-research.md](aoe2-rules-research.md)。E 仍是 in_progress。

## 投降、斥候與大地圖效能（v18）

投降與電腦認輸、曠野開局的斥候（開局人口 4/5）、電腦用斥候探索、電腦經濟在大地圖上的兩個停擺修正、騎乘人偶的姿勢安全，以及大地圖效能的量測，驗證見 [first-use-017.md](first-use-017.md)。E 仍是 in_progress。

## prompt 19 完整路徑與 E 階段結案（v18）

設定畫質與音量、合成音效、「,」選取全部軍隊、移動到看不見的障礙物時改走最近空地，以及 prompt 19 完整路徑（`npm run test:full`），驗證見 [first-use-018.md](first-use-018.md)。E 階段以垂直切片結案，F 為進行中。

## 送返建築與馬廄（v19）

伐木場、採礦場、磨坊的送返規則、電腦在遠處資源旁蓋營地、第二時代的馬廄與斥候訓練（`npm run test:stable`），驗證見 [first-use-019.md](first-use-019.md)。F 為進行中。

## 靶場與建築前置條件（v20）

靶場（弓手改由靶場訓練）、馬廄與靶場需要兵營、電腦的靶場，以及 `npm run test:feudal`（原 `test:stable`），驗證見 [first-use-020.md](first-use-020.md)。`test:full` 曾有一次無法收尾（FU20-6），根因未知。F 為進行中。

## 修道院與僧侶（v21）

修道院、僧侶的轉化與治療、信仰恢復、換邊單位的佇列命令，以及 32×32 地圖上攻擊建築的可見性修正；`npm run test:monastery` 從實際打到第三時代的存檔操作。驗證見 [first-use-021.md](first-use-021.md)。F 為進行中。
