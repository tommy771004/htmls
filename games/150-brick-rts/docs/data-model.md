# 資料模型與權威邊界

目前權威 State／snapshot 為 v33（本頁寫到 v22、v27–v33；v23–v26 見 first-use-023～026），支援五種地圖、有限資源資料、三態視野、移動、存讀與重播，起始建築是有可通行入口的城鎮中心。下文保留各版本演進，不表示舊格式仍可載入。新增模型、LOD、除錯介面及幾何占地共用不增加玩法狀態。

## 初始資料模型（歷史 v1，後續演進見下文）

| 模型 | 唯一來源 | 欄位／限制 |
|---|---|---|
| Rules | packages/content/rules.ts | schemaVersion、穩定 id、reference、coverage、settings、entries、civilizations；runtime validator 接受 unknown 並拒絕錯誤 |
| Entry | 同上 | id、kind、四資源成本、time、population、requires、referenceVersion、sourceEvidence、verificationStatus、implementationStatus、testEvidence |
| State v1 | packages/sim/sim.ts | seed、rng、tick、玩家命令 sequence、units、queue、log；不含 Canvas、鏡頭、音訊與 wall-clock |
| Unit | 同上 | id、player、整數 x/y、target；只實作移動，不代表具備村民經濟行為 |
| Command | 同上 | protocolVersion、rulesetHash、playerId、sequence、targetTick、commandType=move、payload；非法命令不得改 state |
| Snapshot | 同上 | format、rulesetHash、state、checksum；重建一致才接受，失敗保留既有狀態 |
| Reference comparison | reference-comparison.json | 逐項 null／unverified、來源證據與阻塞對象；不補入猜測的原作數值 |
| Stage | stage-dependencies.json | ID、dependsOn、prompts、status、exitEvidence、firstUseReviewRequired、reviewStatus |

同 tick 以 targetTick → playerId → sequence 穩定排序。模擬使用 1/100 格整數座標、每 tick 各軸最多 5 單位；移動速度和未來 200 ticks 命令視窗都是工程自訂值，不是原作對照。模擬 20 Hz；所有權威資料必須能序列化。Profiler 只觀測耗時，不能改變模擬結果。

## 已實作 Worker 通訊（B 階段補充）

`packages/sim/protocol.ts` 定義 versioned Request／Response、Operation、View 與 Recovery。Worker 持有完整 State；主執行緒不呼叫 tick、submit 或重播。每次確認步進後只傳 tick／hash 及 Int32Array 單位投影，以 ArrayBuffer transfer 轉交，不逐 render frame 複製世界。完整 snapshot 只在使用者儲存時傳回。

request ID 單調递增且回應必須對應 pending request。錯誤帶 request ID、tick 與可用的 entity ID。UI 保存已確認的 seed／command journal／tick 作為恢復點；Worker 載入、解碼或 5 秒 timeout 失敗時暫停並拒絕所有 pending requests，重試從最後確認點重播。未確認的指令不自動重送，避免不明狀態下重複執行。重新連線才解鎖操作。

沙盒每次 advance 為 1–20 ticks，上限 100000 ticks／10000 指令；這些是工程容量，不是原作規則。wall-clock 只安排請求，不能更改 tick 內的規則。

## 後續模型（設計中，尚未實作）

| 階段 | 模型 | 需加入的契約 |
|---|---|---|
| B／D | path jobs | 可保存的 frontier 與固定工作預算；尚未實作尋路 |
| C | Terrain／resource／vision | 地格通行類別、有限資源、未探索／已探索／可見、最後已見快照 |
| D | Path／occupancy | 佔地與半徑、排程、到達／不可達／卡住恢復；不能讓繪圖形狀當碰撞真相 |
| E | Player／inventory／work | 四資源、攜帶與送返、原子扣款與人口預留 |
| E | Building／technology／combat | 施工、生產、前置、HP、護甲、冷卻、投射物與死亡 |
| E | Match／AI | 明確 playing/won/lost 狀態、結束後命令拒絕、AI 僅用合法視野 |
| G–I | Persistence／network／scenario | 遷移、重播 checkpoint、權威伺服器、迷霧過濾、trigger 與工具歷史 |

上述表格不是已存在的元件或可玩功能；不得僅建立空介面就把 ledger 標成 implemented。

## Navigation milestone update (2026-09-25)

The latest implementation supersedes earlier no-collision notes: `packages/sim/navigation.ts` supplies shared static house/tree/rock footprints and deterministic routing. State v2 includes map, pathJobs, frontier/parents/head, unit path and navigation status. All jobs share 32 node expansions per tick in stable order. Runtime defaults are recorded in `docs/runtime-manifest.json`; they are not reference-game values. Static obstacle clearance is implemented, but unit-to-unit avoidance, dynamic occupancy, formations, full resource economy and match completion remain pending.

Snapshots now use sandbox v2. Old v1 snapshots are explicitly rejected without changing the live state; no migration is claimed. Full RTS collision and match gates remain open. See `docs/first-use-003.md`.

## Economy boundary / snapshot v3

Account contains four-resource stock, populationUsed/Reserved/Cap and immutable-cost reservation records. Reservations transition once to cancelled or committed. reserve/cancelReservation commands execute at targetTick; rejection is recorded in State.transactions with player/sequence/tick, without a partial resource mutation. This is a funding API, not completed construction or unit training. commitReservation is a reusable transaction helper; only future producer systems may pair it atomically with actual entity creation.

LoggedCommand now records acceptedTick. Replay restores admission order at the actual simulation time before advancing to the final tick, rather than preloading every command into the initial state. Accounts, reservation statuses and rejected transaction outcomes participate in canonical state/hash.

State/snapshot v3 supersedes v2. v1/v2 snapshots are rejected explicitly and leave live state unchanged; migration is not implemented. Runtime default funds, population cap and refund policy appear in runtime-manifest.json and remain design_default.

## C：3D 呈現邊界

apps/web/scene.ts 使用本地 Three.js 建立 WebGL2 場景；固定地物位置取自共用 makeMap(seed)，單位位置取自 Worker View。鏡頭、幾何快取、材質、LOD 與行走動畫時間只存在 renderer，不進入權威 State 或 hash。Raycaster 只把點選投影成單位 ID／地面座標，命令仍由 Worker 驗證。GPU context 遺失會停止輸入，但不清除 Worker 狀態；使用者仍可儲存後重新載入。

## C：地圖 v4（歷史版本）

MapData 新增 tiles、resources、navigationRevision 與 generationAttempt。Tile 含地形、高度、通行類別、基礎可建造性與原點所在格的 entity refs；建造時仍須額外查占地。ResourceNode 為有限容量資源，記錄可採集性、障礙關聯及耗盡 tick。地圖生成驗證與上限重試在建立 State 前完成，失敗不取代現況。

樹木／石塊耗盡的內部原語會釋放原占地內的 blocked 節點；既有仍有效的路徑不需重算，工作系統接入時仍須處理因先前不可達而停止的命令。沒有提供偽採集命令。renderer 目前由 seed 重建靜態地物；資源動態投影須在採集工作接入前補齊。State／snapshot v4 取代 v3，舊版明確拒絕；詳見 terrain-verification.md。

## C：視野 v5（歷史版本）

State.vision 為每玩家的 explored、visible 與 known 靜態快照，快照含 obstacle 與 lastSeenTick。視野在固定 tick 末更新；失去視野保留歷史記憶，重訪才同步消失或變化。sharing policy 預設僅自己，分享／撤銷原語有測試，仍需日後外交／科技授權。

一般 Worker Response 新增 fog（0 未探索／1 舊視野／2 可見）與 known；positions 排除看不見的敵方單位。renderer 的遊戲模式不再從 seed 重建全部地物，只畫 known，舊視野使用灰色。建模檢視採明示 assetPreview 可顯示全部資產。視野計數是目前的輕量 debugger，沒有顯示隱藏單位列表。

State／snapshot v5 含探索與快照，v1–v4 明確拒絕。一般 View 過濾不等於多人保密：本機完整存檔及 journal 仍在客戶端。詳見 first-use-005.md。

## 地圖驗收模式

makeMap(seed, layout) 接受 meadow、coast、acceptance，預設仍為 meadow；coast 依 seed 產生海岸，acceptance 是固定手工圖。驗收 JSON 外層含 format、layout、seed、provenance 與 MapData；不是新存檔格式。水域 PathJob 可帶 movement=water，搜尋和線段碰撞依此查地格 walkClass；既有陸地 job 不新增欄位，草甸沙盒維持 v5 資料。模型檢視頁可切換 layout，正式 reset/recovery 尚未提供地圖選擇。

## 資源投影 v6（歷史版本）

ResourceKind 擴充七種類，resourceDefinitions 宣告產出、工作方法與所需通行類別。PlayerVision.resources 及一般 Worker View.resources 只含可見未耗盡資源；不保留動物的失去視野模型。地面資源占地使用 obstacleId 關聯，魚群沒有阻擋占地。資源模型讀取同一份地圖／可見投影，沒有第二套容量資料。新增節點與視野欄位進入 canonical state；snapshot v6 取代 v5，詳見 resources-verification.md。

## 起始配置 v7（歷史版本）

生成器在結構驗證後呼叫 validateStartingResources，回傳每玩家／種類的容量、最近路程、resource ID 與安全 approach 點；失敗在既有重試上限內換候選。報告是生成驗證證據，不加入每 tick 狀態。startingResourceRules 參與 ruleset hash，保證地物改變初始 state，snapshot 升為 v7。一般 validateMap 保持可接受已耗盡地圖；初始資源門檻不套用在正常耗盡後。詳見 starting-resources-verification.md。

## 高度通行 v8（歷史版本）

clearSegment 同時檢查 walkClass、障礙物與高度邊界；land 的相鄰最大高度差由 terrainRules.maxLandStep 決定，water 為零。超差邊界按單位半徑擴張，避免跨崖與切角。height 不另存到 Unit，從腳底 x/y 及 Tile.height 推導；renderer 的地柱與物件基座共用 groundHeight。手工圖提供離散階梯，未實作平滑坡面。snapshot 現為 v8。

## 多地形沙盒 v9

State.layout 保存 meadow／coast／acceptance。createState、replay、reset、Recovery 與一般 Response 均攜帶地圖類型；WorkerClient 在每次確認回應更新 checkpoint.layout。View.terrain 只含地格類別、高度、通行與可建造性，不含隱藏資源／障礙參照。renderer 使用 Worker 確認的地形，地面 raycast 命中實際地柱表面；恢復後不會回到預設草甸。snapshot v9 取代 v8，詳見 first-use-006.md。

## 共用占地契約（v9 行為不變）

packages/content/footprints.ts 是目前七種障礙物物理矩形的唯一來源：原點偏移 x/y、width、depth 皆為整數模擬單位，100 單位對應 1 世界單位。obstacleBounds 可按單位半徑擴張矩形；導航、資源耗盡的局部更新、起始資源接近點均透過同一契約取得邊界。住宅模型地基也讀取同一份尺寸。屋頂高處的裝飾懸挑不表示增加地面障礙。

此表只是搬移既有自訂工程值，並非確認原作占地。九組前後比對證明 v9 hash 與阻擋格沒有改變，因此本輪不更換 snapshot 或 ruleset hash。未來若修改任何權威尺寸，必須同時更新 simulationVersion／ruleset 身份及舊存檔策略，不能只改表而繼續宣稱 v9 相容。

模型頁的新經濟／公共建築與騎兵尚未加入權威 obstacle kinds；其 art footprint、掛點與選取圈在 asset-manifest.json，不能拿來當已實作碰撞規則。迷霧除錯介面只讀 View.fog／known／tick，不新增權威資料。

## 城鎮中心入口與多矩形占地 v10

- `packages/content/footprints.ts` 的 `obstacleRects()` 是碰撞的唯一來源，每種障礙物回傳一組整數矩形。城鎮中心有 12 個阻擋矩形，其他種類仍各一個，數值和 v9 相同。
- `obstacleBounds()` 只提供整體範圍，用於地圖放置、耗盡清理和起始資源接近點。`walkablePlatforms` 記錄可行走地基的高度，只供渲染使用。
- `footprintContract` 併入 rulesetHash 與 runtime-manifest.json，simulationVersion、State.version 和 snapshot 格式都升為 10。v9 存檔會被明確拒絕，沒有做遷移。
- 生成地圖的兩方起始建築改為城鎮中心；住宅仍保留為障礙物種類，供測試與後續建造使用。
- 建築的「已見」改成任一占地格可見即成立，其他物件仍看錨點格。
- 驗證見 first-use-007.md。這些是 design_default 工程值，不是原作占地。

## 群體移動與單位占位 v11

- `packages/sim/movement.ts` 負責執行期移動。Unit 新增欄位：node（目前佔用的節點）、next（正在前往並已預約的節點）、path（節點序列）、goal（站位）、wait（距上次前進的 tick 數）、detours、order、partial、outcome。navigation 可能的值為 idle／searching／moving／waiting／unreachable／stuck。
- 命令改為 `move {unitIds,x,y}` 與 `stop {unitIds}`：一道命令對應一個序號，unitIds 需為 1–40 個遞增、不重複的己方 ID。State.pathJobs 改為群體搜尋與單位搜尋，並新增 nextJobId。
- 移動規則（design_default）：
  - 每個群體命令從目標點做一次 BFS，取前 N 個沒有被其他單位佔用的節點當站位。依單位與目標的距離排序，從遠離來向的一側開始分配。
  - 每 tick 共用 128 個節點的搜尋預算，依 32／64／128／256 的實測結果選定。
  - 單位持有目前節點並預約下一節點，不重疊、不互穿。
  - 受阻時依序處理：同組已到站且在 arrivalRadius 150 內 → 就地到站；閒置友方讓路；單行道內同組交換站位；正面相遇時同組交換剩餘路線；否則等待。
  - 每 waitLimit 8 tick 重新規劃一次（阻擋者仍在移動時乘上 queueWaitFactor 4）。規劃時排除其他靜止單位的節點，只有能抵達目標的結果才採用；每道命令最多 detourLimit 12 次。
  - 連續 stuckTicks 300 tick 沒有前進 → stuck。
  - 目標所在區域無法到達時，停在最近的可達點並標示 unreachable。
- 地圖生成驗證（validateMap、validateStartingResources）仍用單一單位的 createPathJob。兩者使用同一張 clearSegment 邊表，所以判定一致。
- simulationVersion、State.version 與 snapshot 格式升為 11，舊版明確拒絕，沒有做遷移。tick() 回傳只供觀察的搜尋節點數，不寫入 State。

## 採集與送返 v12

- State 新增 `works`（依單位 id 記錄工作：resourceId、phase 為 toSource／gathering／toDropoff、progress、retries）與 `cargo`（依單位 id 記錄 resource 與 amount）。Account 新增累計的 `ledger.extracted` 與 `ledger.deposited`。
- 新命令 `gather {unitIds, resourceId}`。資源必須已被該玩家探索過，否則回報與「不存在」相同的訊息，不洩漏迷霧後的資源；只接受 method 為 gather 的資源（樹木、石礦、金礦、野果）。執行時若資源已耗盡，單位改為停止。
- 規則（economyRules，design_default）：
  - 攜帶上限 10。每單位資源所需的採集 tick：食物 20、木材 20、黃金 25、石頭 25。
  - workReach 50：工作點是資源占地外 50 以內的可站節點。
  - dropoffReach 50：送返點是己方城鎮中心占地外圍一圈的節點，不進入大廳。
- 各段移動都走 movement.ts：新增 `routeTo`，前往一組目標中最近、可到達的一個節點。work.ts 在單位停下後推進狀態。處理順序：命令 → 移動 → 工作 → 視野。
- 移動或停止命令會結束工作，但保留貨物；對不同資源下採集命令時，會先送回身上的貨；資源耗盡時先送回貨物，再轉往 600 內最近的同類資源，沒有就閒置。
- Worker 投影：每名單位 11 個 int，新增工作階段、貨物種類與數量、工作資源種類；只投影己方單位的工作與貨物。另外投影己方帳戶的庫存與人口，不投影敵方庫存。採集中時，目標座標欄位改放資源中心，供畫面讓人偶轉身。
- simulationVersion、State.version 與 snapshot 格式升為 12，舊版明確拒絕，沒有做遷移。

## 建造與人口 v13

- State 新增 `buildings`（id、kind、player、x、y、work、required、complete、reservationId）、`nextBuildingId` 與 `navigationSeen`。開局時兩方的城鎮中心也登記為已完工建築。
- 新命令：
  - `build {unitIds, kind:'house'|'barracks', x, y}`：放置並指派施工。
  - `construct {unitIds, buildingId}`：協助施工。
  - `cancelBuild {buildingId}`：取消建造。
  - 提交時先檢查放置與資源；執行時再檢查一次，失敗寫進 transactions，施工者停下。
- 放置規則 `placementProblem` 由 Worker 與頁面共用（design_default）：
  - 位置對齊 50 格線，不超出地圖，占地格都已探索、可建造、高度一致。
  - 不與任何障礙物矩形重疊，也不能有單位身體（含正在進入的節點）在占地內。
- 金流：放置時預留（扣款），完工時結算，取消時全額退款並移除地基。
- 施工：需要的工作量為規則項目時間 × tick 率（住宅與兵營皆為 400）。每名施工者每 tick 加 1，站在地基外圍的節點。模型依階段 0／20／40／60／80／100 顯示；地圖上的障礙物帶 progress，所以迷霧記憶記得的是最後看到的施工階段。
- 人口上限 = min(40, 己方已完工建築的容量)：城鎮中心 5、住宅 5、兵營 0。
- 導航：放置與取消都會局部更新 blocked 並遞增 navigationRevision。movement.ts 在下個 tick 重算進行中的搜尋，並讓路線穿過新邊界的單位重新規劃。
- 城鎮中心視野半徑從 300 提高到 600（design_default）。原因是開局可建造的位置太少（草甸只有 9 處），見 first-use-010。
- simulationVersion、State.version 與 snapshot 格式升為 13，舊版明確拒絕，沒有做遷移。

## 生產、集結與升時代 v14

- 規則資料新增 `production`（單位或科技 → 生產建築，null 表示有定義但尚不能生產），驗證器會檢查缺漏與無效的生產建築。
- 單位新增 `kind`（villager、militia、archer）；只有村民能採集與建造。
- Building 新增 `queue`（每項有 id、entryId、reservationId、work、required）與 `rally`。State 新增 `ages[player]`（起始為 1）、`nextUnitId`、`nextQueueId`。Obstacle 新增 `age`，只用來決定建築的時代外觀。
- 新命令：`train {buildingId, entryId}`、`cancelTrain {buildingId, itemId}`、`rally {buildingId, x, y}`。
- 生產規則（design_default，`trainBlocker` 由 Worker 與頁面共用）：
  - 需要完工的己方建築，且該建築是這個項目的生產建築；文明可用；前置條件已滿足（建築要完工、時代要到）；同一種時代研究同時只能有一項；佇列最多 5 項；資源與人口足夠。
  - 加入佇列時預留費用與人口，出生或研究完成時結算，取消時全額退款。
- 每 tick 只推進佇列第一項。完成的單位在建築外圍、離集結點（或正門）最近的空節點出生；沒有空節點時停在 100% 等待。有集結點時，出生後自動移動過去。
- 時代研究完成後，`ages` 更新，己方建築的 obstacle.age 跟著更新（只影響外觀）。
- 處理順序：命令 → 生產 → 移動 → 工作 → 視野。Worker 投影的每名單位改為 12 個 int（新增兵種）；建築投影新增 queue 與 rally；帳戶投影新增時代與保留中的人口。
- simulationVersion、State.version 與 snapshot 格式升為 14，舊版明確拒絕，沒有做遷移。

## 戰鬥、摧毀與征服勝負 v15

- `packages/sim/stats.ts` 的 combatRules（design_default，已併入 rulesetHash 與 runtime-manifest.json）：
  - 村民：生命 25、傷害 1、射程 50、冷卻 30、不自動迎擊。
  - 近戰民兵：45／6／50／20／視距 350。
  - 弓手：30／4／250／30／視距 400。
  - 建築生命：城鎮中心 400、兵營 300、住宅 150。
  - 倒地畫面保留 40 tick。
- Unit 新增 hp 與 hitTick；Building 新增 hp 與 maxHp（地基從 1 開始，隨施工進度按比例增加）；Obstacle 新增 damaged（生命低於一半時顯示破損外觀）。
- State 新增 `attacks`（依單位 id：目標、冷卻、是否自動、重新規劃倒數、最後出手 tick）、`corpses` 與 `outcome`。
- 新命令 `attack {unitIds, target:{kind:'unit',id}|{kind:'building',id}}`：目標必須是敵方，且目前在該玩家視野內。移動、停止、採集、建造命令都會取消攻擊。
- 每 tick 在移動之後處理戰鬥：
  1. 閒置的士兵自動攻擊視距內最近的敵方單位。
  2. 在射程內就停下，依冷卻造成固定傷害；不在射程內就前往射程內的空位（近戰會分散包圍），追移動目標時每 20 tick 重新規劃一次。
  3. 目標消失或看不見時，攻擊者在下一個節點停下。
- 死亡與摧毀：
  - 單位死亡：移除、人口減一、貨物記入 ledger.lost、留下倒地畫面。
  - 建築摧毀：移除並局部更新導航、重新計算人口上限；地基與佇列的費用沒收（forfeitReservation 只釋放保留中的人口）。
- 征服：沒有任何單位與建築的一方判負；最後剩下的一方獲勝。判定後所有命令都會被拒絕。
- 集結點不能設在障礙物上；集結點後來被建築蓋住時，出兵會略過移動而不報錯。
- Worker 投影：每名單位 15 個 int，新增生命、生命上限、動作狀態；另外投影看得見的倒地單位與勝負結果；己方建築投影新增生命值。
- simulationVersion、State.version 與 snapshot 格式升為 15，舊版明確拒絕，沒有做遷移。

## 電腦對手、農田與對稱地圖 v16

- **對手設定**：State 新增 `opponent: 'ai' | 'idle'`。
  - `createState(seed, layout, opponent='idle')`，預設仍是不行動，所以既有單元測試與除錯模式不受影響。
  - `'ai'` 時紅方和藍方一樣從 3 名村民開始（新增 id 5、6，位置與藍方左右對稱），帳戶人口 3。
  - `replay`、`deserialize`、Worker 的 `reset` 與 `recover` 都帶著對手設定。存檔與恢復點少了它會重建成另一場對局。
- **電腦的命令**（`packages/sim/ai.ts`，aiRules 為 design_default，已併入 rulesetHash）：
  - 每 20 tick 決策一次（第 7、27、47… tick），只讀紅方自己的視野（explored、visible、known）。
  - 每道命令都走和玩家相同的 `submit` 驗證，但以 `record=false` 接收：命令不寫入 log，因為重播會從相同狀態重新推導。仍會推進 `sequence[1]`。
  - 決策內容：
    - 補村民到 12 名；人口剩 2 以內蓋住宅。
    - 村民達 3 名時先蓋兵營：兵營占地較大，先放才不會被住宅占走。
    - 看得見的天然食物用完時，閒置村民改蓋農田，一塊田一人。
    - 村民 9 名且兵營完工後升第二時代，之後訓練弓手，否則訓練民兵。
    - 閒置村民依權重（食物 4、木材 3、黃金 2）補人手不足的資源。
  - 建築位置：
    - 只在自己半場，由近到遠掃描（20 單位一步）。
    - 與城鎮中心保持 50、與其他非農田建築保持 50 的間距，確保送返環與通道暢通。
    - 兵營整個離中線至少 100（剛出兵營的士兵不會一出生就看到對方村民）；住宅與農田最多可越過中線 100。
  - 軍隊：
    - 基地 700 內有敵人時一律防守。
    - `firstWaveTick` 4800（20 Hz 下 4 分鐘）之前，不主動追擊、不攻擊建築；遠離基地的士兵會先走回家。
    - 之後在家等滿 5 名才出發。第一波前往自己城鎮中心的鏡像位置（地圖左右對稱，這是明寫的假設）；之後前往記得的敵方建築，沒有記憶時前往未探索的格子。
    - 行進中的士兵會對 500 內看得見的敵人重新下攻擊令（行進中不會自動迎擊）。
- **農田**：
  - 新建築 `farm`：規則資料費用木材 60，占地 200×200。
  - 占地不阻擋移動（`obstacleRects` 為空），但完整範圍仍擋住其他建築。
  - 完工後產生只有擁有者能耕作的食物來源，資源 id 為 `resource-<建築 id>`，容量 250（`terrainRules.resourceCapacity.farm`）。
  - 農夫站在田上採集；耗盡時田連同建築一起移除。
  - 被摧毀時資源標為耗盡。
  - 自動換資源（`nextSource`）不會選到農田。
  - 生命 100。
- **建築格線**：從 50 改為 10 單位。舊的 50 格線加上占地偏移 −15，讓紅方永遠放不到藍方位置的鏡像。
- **地圖**：邊緣樹林只為西半部產生，再鏡像到東半部。西半部的亂數序列不變，所以藍方半場和舊版相同。各地圖類型與測試種子仍在第 1 次嘗試就通過驗證。
- **修正兩個由新格線暴露的規則錯誤**（皆有回歸測試，拿掉修正時會失敗）：
  - 放置時「有單位站在預定地上」改為包含邊界，和導航一致。原本外擴後的邊緣剛好落在行走中單位的下一個節點時會放行，導致移動不變量中斷（模擬例外）。
  - 對建築的射程改從單位身體邊緣起算（射程＋半徑 25）。原本某些占地偏移下，射程 50 的帶狀範圍內沒有任何可站節點，建築永遠打不到。
- **Worker**：單次 advance 上限從 20 提高到 80 tick（4× 下 1 秒）。畫面每幀可要求 `20×速度` 個 tick，較慢的畫面不會再讓 4× 落後超過 1 秒而自動暫停。
- simulationVersion、State.version 與 snapshot 格式升為 16，舊版明確拒絕，沒有做遷移。aiRules 之後若調整，rulesetHash 會跟著改變，舊存檔也會被拒絕，這是沿用的慣例。

## 放大地圖與隨機出生 v17

- **每張地圖自帶大小**：MapData 新增 `size`（每邊格數）與 `starts`（每位玩家的村民出生點，第一個是該玩家的基準點）。
  - 世界座標是 `size×100`；導航節點每 50 單位一個，每邊 `2×size−1` 個。
  - `position(map, id)`、`nodeAt(map, p)`、`tileAt(x, y, size)`、`makeUnit(map, …)` 都依地圖計算。
  - View 與 Response 帶 `size`，頁面不必自己猜。
- **地圖類型**：
  - 草甸、海岸、高地與淺灘仍是 16×16 的驗收圖。基地、資源與節點編號和舊版相同；State 多了 `size` 與 `starts` 兩個欄位，指紋因此改變。
  - 新的「曠野」是 32×32 的對戰圖（1024 格、63×63 = 3969 個節點）。一般進站預設曠野，`?debug=1` 預設草甸。
- **曠野的生成**（`openMapRules`，design_default；做法參考原作 `random_placement`／`circle_radius` 的概念，數值不是原作的，見 aoe2-rules-research.md）：
  - 兩座城鎮中心放在以地圖中心為圓心的圓上：
    - 半徑為地圖寬的 29%–34%；
    - 第一位玩家角度隨機，第二位在相對方向 ±22.5°；
    - 位置夾在「整套基地資源都能放進地圖」的範圍內。
  - 城鎮中心的大門固定朝南，村民出生在門前。門前的保留區（中心往左右各 320、往上 320、往下 620）不放任何物件。
  - 基地資源對每位玩家使用相同的相對位置：
    - 北方 6 棵樹、東西各一座金礦與石礦、東南野果、西南家畜、南方獵物；
    - 位置被擋住時，繞城鎮中心每次轉 15° 另找。
  - 中央附近放 2 座中立金礦與 2 座中立石礦。
  - 森林：
    - 10 叢，以種子隨機擴散，每叢 6–13 棵，離城鎮中心 1050 以上；
    - 地圖最外圈 45% 機率有樹，離城鎮中心 750 以上；
    - 另有 7 塊沙地（可走、可蓋）。
  - 仍經過 validateMap（出生點可走、雙方連通）與 validateStartingResources（最近資源路程差不超過 500）。實測 8 個種子的差距都不超過 100。
- **電腦的幾何規則改為以地圖中心為準**：
  - 「自己這一側」是點在「地圖中心 → 自己城鎮中心」方向上的投影。
  - 第一波的目標是自己城鎮中心相對地圖中心的點對稱位置。玩家大致被放在相對兩側，這仍是明寫的假設。
  - 找建築位置只掃描城鎮中心 900 內的範圍。
- **效能（衍生資料，不存檔）**：
  - `map.blocked` 仍是排序好的陣列（存檔與指紋用），另外快取成 Uint8Array 查表。
  - `clearSegment` 只檢查線段周圍的地格。
  - 採集站位、施工站位、攻擊站位與出口只掃描目標附近的節點（`nodesNear`，順序和全圖掃描相同）。
  - 導航邊表只重算 `refreshNavigation` 回報的變動範圍；沒有紀錄時整張重建。有測試比對兩者相同。
  - 無畫面量測：曠野對電腦平均每 tick 0.12 ms（p99 0.23 ms，最慢 63 ms，發生在電腦第一次找建築位置時）。
- simulationVersion、State.version 與 snapshot 格式升為 17；rulesetHash 納入 mapSizes 與 openMapRules。舊版明確拒絕，沒有做遷移。

## 斥候、投降與效能 v18

- **斥候**：
  - 新的單位種類 `scout`，附加在 unitKinds 最後，所以既有種類在 Worker Int32 投影中的索引不變。
  - 只在曠野出現，每方一名；對不行動的紅方時，紅方沒有斥候。編號接在村民之後，開局人口 4/5，和原作的標準開局相同（見 aoe2-rules-research.md）。
  - 規則資料有這個項目，但沒有生產建築（production 為 null），和攻城槌一樣不能訓練。
  - 數值（design_default）：生命 45、傷害 3、射程 50、冷卻 40。自動迎擊半徑為 0，只在命令下戰鬥。
  - 視野半徑 550（`visionRules.scoutRadius`，其他單位 400）。
- **每種單位各自的移動速度**：`combatRules.speed` 為村民、民兵、弓手每 tick 5，斥候 10。每個值都能整除節點間距 50，單位永遠剛好停在節點上。
- **投降**：
  - 新命令 `resign`（payload 為空）：執行時立刻由另一方獲勝。
  - `Outcome` 新增 `reason: 'resign'`；征服結束時不寫這個欄位。
  - 電腦在沒有城鎮中心、也沒有民兵或弓手時投降。斥候不算在內，它無法重建城鎮中心。
- **電腦的其他調整**：
  - 斥候閒置時騎往最近的未探索格；第一波優先攻擊已知建築，點對稱位置只是後備。
  - 住宅與兵營和金礦、石礦、野果、動物至少保持 100 的間距。
  - 食物只採城鎮中心 900 以內的來源，更遠就蓋農田。
- **尋路預算**依節點數放大：`searchBudget = expansionsPerTick × 節點數 / 961`。驗收圖仍是 128，曠野約 528。
- **頁面端（不影響模擬與存檔）**：
  - 靜態物件依 8×8 格分塊批次繪製，畫面外的區塊會被剔除。
  - 卡頓超過一秒時丟棄積欠的時間，不再自動暫停。
- simulationVersion、State.version 與 snapshot 格式升為 18，舊版明確拒絕。

## 移動目標與頁面設定（v18，State 不變）

- 移動命令不再拒絕落在障礙物內的目標（例如迷霧中看不見的樹）。
  - 單位改為前往最近、能直線到達目標的節點；找不到時前往最近的空節點（`nearestOpen`）。
  - 原本的拒絕訊息會暴露迷霧中的地形。
  - 集結點仍拒絕落在障礙物上（FU12-1 的防護），頁面會先把點擊位置移到最近的已知空地。
  - 舊存檔的命令記錄都是當時接受的命令，重播結果不受影響，所以沒有提升版本。
- 畫質與音量是頁面設定，存在 localStorage 的 `brick-rts:settings:1`，不屬於模擬，也不進入存檔與指紋。

## 送返建築與馬廄 v19

- **新的建築種類**：`BuildKind` 加上 `lumber-camp`、`mining-camp`、`mill`、`stable`。
  - 占地都是 300×300（`footprints.ts`），不可行走。
  - 規則資料（design_default，未對照原作）：伐木場、採礦場、磨坊各木材 100，馬廄木材 175 並需要 `age-2`；時間都是 20 秒。
  - 生命值（`combatRules.buildings`）：三種送返建築 200，馬廄 300。
- **送返規則** `dropoffRules.accepts`（design_default）：
  - 城鎮中心收全部四種資源；伐木場收木材；採礦場收黃金與石頭；磨坊收食物。
  - 只有自己完工的建築算數。`dropoffNodes(map, player, resource?)` 回傳所有收這種資源的建築外圈節點（升冪、去重），攜帶者走到最近的一個。
  - 攜帶者抵達時，如果那個節點已經不收貨（例如營地在途中被摧毀），就改找下一個，重試 3 次仍失敗才停工。這個情況沒有專門的測試。
- **建築的時代要求**：`buildRequirement(age, kind)` 讀規則資料的 `requires` 中的 `age-N`，不足時回傳「需要第二時代」。
  - 伺服端的 `placeBuilding` 與頁面的指令格共用這個函式，所以按鈕的原因和命令被拒絕的原因相同。
- **斥候可以訓練**：`production.scout` 從 null 改為 `stable`，食物 80、人口 1。
- **電腦**：`aiRules` 新增 `campDistance 350`、`campWorkers 2`。
  - 兩名以上村民從離最近收貨建築超過 350 的來源採木材（或黃金、石頭）時，在那個來源旁蓋伐木場（或採礦場）。
  - 同種營地還沒完工時不再蓋第二座。電腦不蓋磨坊與馬廄。
- rulesetHash 加入 `dropoffRules`。simulationVersion、State.version 與 snapshot 格式升為 19，舊版明確拒絕。

## 靶場與建築前置條件 v20

- **新的建築種類** `archery-range`（靶場）：
  - 木材 175（和查到的原作數值相同，來源可信度中），時間 20 秒，300×300，生命值 300；建造時間與生命值是 design_default。
  - 需要 `age-2` 與完工的兵營。
- **弓手改由靶場訓練**：`production.archer` 從 `barracks` 改為 `archery-range`，和原作相同。兵營只剩近戰民兵。
- **建築的前置條件**：`buildRequirement(age, kind, own)` 同時檢查規則資料 `requires` 裡的時代與建築。
  - 缺時代時回傳「需要第二時代」，缺建築時回傳「需要完工的兵營」（和 `trainBlocker` 的用語一致）。
  - 只算自己完工的建築；兵營之後被摧毀，已經蓋好的靶場與馬廄不受影響。
  - 馬廄也改為需要兵營，和原作相同（見 aoe2-rules-research.md）。
  - Worker 的 `placeBuilding`、命令驗證與頁面的指令格都呼叫同一個函式。
- **電腦**：
  - 第二時代、兵營完工、木材足夠 175 時，在自己的半場蓋一座靶場，與兵營一樣和中線保持 `halfMargin`。
  - 兵營訓練民兵（存升時代的食物時暫停），靶場訓練弓手。
- 頁面：指令格新增 Z 靶場。
- rulesetHash 隨規則資料改變。simulationVersion、State.version 與 snapshot 格式升為 20，舊版明確拒絕。

## 修道院與僧侶 v21

- **修道院** `monastery`：
  - 木材 175，需要 `age-3`；和原作相同（來源見 aoe2-rules-research.md，可信度中）。
  - 300×300，時間 20 秒；生命值 350 是 design_default（原作 2100；本作建築的生命值都比原作低）。
- **僧侶** `monk`：
  - 黃金 100、人口 1、生命值 30，和原作相同。
  - 在修道院訓練；附加在 unitKinds 最後，所以 Worker 投影的索引不變。
  - 不能攻擊：攻擊命令會被拒絕，並提示改用轉化。
  - 移動速度仍為每 tick 5，和村民相同（速度必須整除節點間距 50；原作僧侶是 0.7，村民的值沒有查證）。
- **新模組** `packages/sim/religion.ts`（`religionRules` 納入 rulesetHash）：
  - `convert` 命令（`{unitIds, targetId}`）：
    - 只有僧侶能下，目標必須是看得見的敵方單位，而且不能是僧侶。
    - 僧侶走到 350 以內，第一次進入範圍時，用對局的種子亂數（`State.rng`）抽出 100–300 tick（原作 5–15 秒）。
    - 只有在範圍內的 tick 會累積進度。完成後，單位連同生命值換邊，人口從原主人移到新主人，可以超過上限（本作的設計，原作在這個情況的行為沒有查證）。
    - 單位攜帶的資源算原主人的損失；它原本的工作、攻擊與移動都取消。
  - **信仰**：`State.faith[monkId]` 記錄上次轉化的 tick，1240 tick（62 秒，和原作相同）後恢復滿格。新訓練的僧侶是滿的；未滿時，轉化命令被拒絕：「信仰尚未恢復」。
  - `heal` 命令：只能治療己方、非僧侶、受傷的單位，範圍 150，每 20 tick 回復 1 點，滿血後停止。閒置的僧侶會自動治療 400 以內最近的受傷單位（id 小者優先）。治療範圍與速度都是 design_default。
  - 不能轉化建築：原作需要研究「救贖」，本作沒有這項科技。
  - 移動、停止、採集、建造命令會取消僧侶的轉化或治療。
- **換邊單位的命令**：佇列中已接受、但還沒執行的命令，只作用在發令玩家執行當下仍擁有的單位上；如果一個都沒有，整條命令略過。
- **Worker 投影**：`UNIT_STRIDE` 從 15 改為 17，新增兩欄：
  - `rite`：0 無、1 轉化、2 治療，所有看得見的僧侶都投影；
  - `faith`：0–100，只投影己方僧侶，其他為 -1。
  - 轉化或治療中，目標欄位帶被作用單位的位置，讓畫面把僧侶轉向它。
- **修正**（v21 之前就存在）：`combat.ts` 的 `resolve()` 用 `ty*16+tx` 算建築所在的格子，在 32×32 地圖上會算錯。建築能不能被攻擊、攻擊會不會中斷，都取決於一個不相干的格子是否可見。現在改為依地圖大小計算，並有迴歸測試。
- **攻擊迷霧中記得的建築**：上一項修正之後，攻擊看不見的建築一律被拒絕。原作允許攻擊看過、現在在迷霧中的建築，所以改為：
  - `targetProblem` 對建築的判斷：目前看得見，或者玩家的記憶（`vision.known`）裡有這棟敵方建築，就接受。
  - 如果建築其實已經不在了，命令照樣接受，不能洩漏迷霧中發生的事；攻擊會轉成「走到記憶中的位置」。單位看見那裡之後，記憶自然清除。
  - 單位目標仍然必須看得見。
- simulationVersion、State.version 與 snapshot 格式升為 21，舊版明確拒絕。

## 轉化判定、修道院科技與聖物 v22

- **轉化判定**（取代 v21 的「5–15 秒均勻抽樣」）：
  - 僧侶在範圍內每 24 tick（1.2 秒）判定一次：第 1–3 次必定失敗，第 4 次起每次用種子亂數抽 28%，第 10 次必定成功。
  - 目標的主人研究「信仰」時，改為第 6 次起、第 14 次必定成功。
  - 判定間隔的來源互相矛盾（1.2 秒或 1 秒），本作採 1.2 秒。
- **科技**：`State.techs[player]` 記錄已研究的科技。規則資料新增 8 項，都在修道院研究：
  - 第三時代：救贖 475 金、贖罪 325 金、聖潔 175 金、異端 1000 金。
  - 第四時代：啟蒙 120 金、活字印刷 200 金、神權政治 200 金、信仰 550 食 750 金。
  - 研究時間仍是 design_default 的 20 秒。
  - `trainBlocker` 把已研究或研究中的科技擋下，和時代相同；`TrainInput` 新增 `techs`。
  - 效果：
    - 救贖：可轉化敵方完工建築（城鎮中心、修道院、農田除外）。僧侶必須站在旁邊（50＋半徑），需時 360–600 tick（18–30 秒）。建築換邊時，原主人的佇列全額退回，集結點清除，兩邊的人口上限重算。
    - 贖罪：可轉化僧侶。
    - 聖潔：僧侶生命 +15，已在場上的也一起增加（`maxHpOf`）。
    - 異端：被敵方轉化的己方單位改為死亡。
    - 啟蒙：信仰恢復 620 tick。
    - 活字印刷：轉化射程 +117（原作 +3 格；本作 350 對應原作的 9 格）。
    - 神權政治：一群僧侶轉化成功後，只有成功的那名要休息；沒有這項時，同一目標的己方僧侶全部休息。
    - 信仰：見上方的判定次數。
  - **沒有做的兩項**：
    - 熱忱（速度 +15%）：單位每 tick 的移動量必須整除節點間距 50，+15% 無法表示。
    - 草藥學：本作沒有駐守。
- **聖物** `State.relics`（`{id, x, y, carrier, monastery}`）：
  - 只有曠野地圖放 5 個（16×16 地圖沒有），由種子決定位置：離兩座城鎮中心都至少 900，兩邊距離差不超過 400，彼此間隔 600（放不下時每次放寬 100）。
  - 新命令：
    - `relic`（`{unitIds, relicId}`）：僧侶走到旁邊撿起；
    - `deposit`（`{unitIds, buildingId}`）：送進自己完工的修道院，每座最多 10 個。
  - 攜帶者不能轉化；陣亡時聖物掉在原地。修道院被摧毀時，聖物留在原地（本作設計）。
  - 每 40 tick，每個放在修道院的聖物給擁有者 1 黃金（每秒 0.5），記在新的 `ledger.relic`。
  - `State.relicMemory[player]`：各方記得的地上聖物。看到那個位置空了才忘記。
    - 可以對記得的聖物下令，僧侶走到記憶中的位置，不會透露迷霧中的事。
    - 地上的聖物所在位置不能蓋建築（「聖物所在的位置不能建造」）；電腦找建築位置時也避開聖物。
  - 聖物勝利 `State.relicVictory`：一方的修道院放著全部聖物時開始倒數 20000 tick（16:40）。有一個離開就取消；到時 `Outcome.reason` 為 `'relic'`。
- **Worker 投影**：
  - `UNIT_STRIDE` 改為 18，新增「攜帶聖物」；`maxHp` 依科技計算。
  - `EconomyView.techs`；己方 `BuildingView.relics`。
  - View 新增 `relicSpots`（記得的地上聖物）、`relicsHeld`（雙方修道院中的數量，和原作計分列一樣是公開資訊）、`relicTotal`、`relicVictory`。
- **電腦**：
  - 村民滿 12 名、靶場完工後研究第三時代，存錢期間暫停造兵。
  - 接著蓋修道院（自己的半場），訓練最多 2 名僧侶。
  - 僧侶的行為：攜帶聖物就送回修道院；信仰滿時，轉化城鎮中心 700 以內最近的敵方單位；其餘時間去撿記得的聖物，一個聖物只派一名。
  - 電腦不研究修道院科技。
- **頁面（不影響模擬）**：Worker 請求的逾時保護，對讀檔（restore）、恢復（recover）與重播驗證（replay）改為 60 秒，其他仍是 5 秒。這三種請求要依指令紀錄重新推導整局，長對局會超過 5 秒。
- simulationVersion、State.version 與 snapshot 格式升為 22，舊版明確拒絕。

## 文明、城堡與特殊單位 v27

本頁在 v22 之後沒有更新；v23–v26（放牧與狩獵、經濟科技、鐵匠鋪與相剋、駐軍與攻城槌）只記在 first-use-023～026，這裡直接接 v27。

- **State**：
  - `civs: string[]`：兩名玩家的文明 id（`packages/content/civs.ts` 的 `civDefs`，含中立的 `settlers`）。
  - `keptHousing: number[]`：被摧毀的建築留下的人口容量（蒙古研究游牧後的民居）；人口上限 = 完工建築的容量 ＋ 這個數，上限仍是 40（哥德第四時代 +10）。
  - `Account.ledger.refund`：死亡返還的資源（薩拉森研究穆斯林學墊後，僧侶陣亡返還 33 黃金）。
- **建立與重播**：
  - `createState(seed, layout, opponent, civs=[settlers, settlers])`；文明不是兩個已知 id 時丟出「未知的文明」。開局依文明調整資源（`startStock`）與村民數（`startVillagers`，中國多 3 名）。
  - `replay(seed, commands, ticks, layout, opponent, civs)` 多一個參數；少了它會重播成中立文明的對局，狀態指紋不同。
  - snapshot 格式 `brick-sandbox-27`；`deserialize` 檢查 `civs`，再用存檔裡的 `civs` 重播比對。
- **Worker**：
  - `Operation.reset` 與 `Recovery` 多了選填的 `civs`；`recover` 與 `replay` 都帶著文明重建。
  - `View.civs`／`Response.civs`：雙方的文明（公開資訊）。
  - 單位的 `maxHp` 依擁有者的文明、時代與科技計算（`ownerOf`）；`BuildingView.capacity` 改由 `garrisonCapacity` 計算（條頓箭塔 10、城鎮中心 25）。
- **規則資料**：
  - `rules.civilizations`：每個文明的 `{id, available, unavailable}`，由 `civDefs` 推導：`missing` 裡的項目、其他文明的特殊內容，以及沒有特殊單位的文明（拓荒者）的城堡都不可用。`submit` 與頁面的建造、生產檢查都讀這份表。
  - `rules.entries` 新增城堡（第三時代、石頭 300、60 秒）、13 個特殊單位、13 項精銳升級與 21 項特殊科技；它們的 `sourceEvidence` 是 aoetw.com，`verificationStatus` 仍是 design_default。`entry()` 可以指定時間，其他項目仍是 20 秒。`rules.production` 讓這些項目都在城堡生產。
  - 暫緩的 5 項特殊科技（`deferredTechs`）不在 `rules.entries`，城堡不提供。
- **文明效果**（`civs.ts` 的 `Effect`，對應提示包 11 的欄位）：
  - `id`、`kind`（效果種類，例如 `hp`、`range`、`cooldown`、`bonus`、`gather`、`cost`、`costShift`、`time`、`producer`、`grant`、`workRate`、`buildingHp`、`garrison`、`arrows`、`popCap`、`keepHousing`、`deathRefund`、`conversionResist` 等）。
  - `select`（selector）：單位的 `kinds`／`classes`（`exclude` 優先）、項目的 `entries`／`allUnits`／`allTechs`、建築的 `buildings`、經濟的 `resources`（產出）或 `sources`（來源種類）、`prey`。
  - `op`（operation）：`add` 或 `mul`；`value`：一個數，或四個時代各一個數（同一效果的時代數值互相取代，不累加）。另有 `vs`（加成對象類別）、`resource`／`to`（成本轉換）。
  - `trigger`：`age`（從該時代起）與／或 `tech`（研究後）。
  - `stacking`：`sum`（加法效果相加）或 `product`（乘法效果相乘）；`priority`：0 為加法、1 為乘法，乘法在後。
  - `scope`：`self` 或 `team`（團隊加成；每邊只有一名玩家，所以只作用在自己）。
  - `appliesToExisting`：單位與建築的數值效果立刻作用在場上已有的單位與建築（單位的生命加上最大生命的差值，建築依原本的損傷比例換算）；費用、時間、工作速度、開局資源、授予科技只影響之後排入的項目。
  - `text`：給頁面與百科的說明。`omitted` 另列目標不存在、無法表達的加成與原因。
- **計算**（`packages/sim/civ.ts`，模擬、電腦與頁面共用，不依文明名稱分支）：
  - `Owner = {civ, age, techs}`；`ownerOf(state, player)` 從 State 取出。`statsOf`、`maxHpOf`、`speedOf`（乘上倍率後取整到整數步長，至少 1）、`buildingHpOf` 都改收 `Owner`。
  - `costOf(entry, owner)`：每種資源先乘上所有 `cost` 倍率並四捨五入，再做 `costShift`（波斯弓兵把弓手的黃金移到木材）。
  - `timeTicks(entry, owner, building) = round(time × 20 × 時間倍率 × 100 / (100 + 工作速度加成))`，在排入佇列時決定。
  - `producersOf`／`producedAt`：`producer` 效果增加生產建築（哥德研究無政府狀態後，兵營也訓練哥德衛隊）。
  - `grant`：升時代時免費得到的科技（維京的手推車、手拉車），寫進 `State.techs`。
  - 時代或科技改變時，`refreshOwner` 更新場上單位與建築的生命，並重算人口上限（v27 修正：之前只在建築完工、失去或換邊時重算）。
- **城堡**：4×4 占地、生命 800、提供人口 10、駐軍 20、基本 4 支箭、射程 400、視野同箭塔。特殊單位與精銳升級的數值在 `combatRules.units` 與 `lineUpgrades`。
- **rulesetHash** 另外納入 `civs: civDefs` 與 `unitLines: {lineUpgrades, blacksmith, religionBonus}`，所以兵種升級與鐵匠鋪的數值改變也會換掉指紋。
- **電腦**：用 `costOf(…, ownerOf(s, 1))` 算費用，不蓋文明沒有的建築；第三時代、有特殊單位的文明蓋一座城堡並訓練最多 5 名特殊單位（見 first-use-027）。
- 拓荒者沒有任何效果：每條規則的回答都和不指定文明時相同（`tests/civilizations.test.ts`），電腦在拓荒者對局中的行為也和加入文明之前相同。
- simulationVersion、State.version 與 snapshot 格式升為 27，v26 存檔明確拒絕（沒有遷移）。

## 單位：攻城器、駱駝與馬弓騎兵 v28

- **State**：
  - `setups: Record<unitId, {unpacked, progress}>`：架好或正在架設、收起的巨型投石機。`unpacked: false` 時 `progress` 是架設的 tick 數，`true` 時是收起的 tick 數；收起完成、架設途中收到移動命令或單位死亡時刪除。留在射程內射擊時 `progress` 歸零（FU28-1）。
  - `version: 28`；snapshot 格式 `brick-sandbox-28`。v27 存檔明確拒絕（沒有遷移）。
- **單位種類**：`unitKinds` 依序附加 `cavalry-archer`、`camel`、`mangonel`、`scorpion`、`trebuchet`、`petard`（Worker 用索引投影種類，只能附加）。升級沿用原本的種類（裝甲衝撞車是 `ram`、中型投石車是 `mangonel`），名稱由 `lineName` 依已研究的升級決定。
- **`UnitStats` 新增的選填欄位**（`packages/sim/stats.ts`）：
  - `minRange`：比這更近的目標打不到；自動接戰不選、自動戰鬥的目標走進來就放棄，下令攻擊時 `approach(s, u, shape, range, min)` 只找距離在 `min` 到 `range` 之間的節點。
  - `blast`：落點周圍這個距離內的敵方單位一起受擊（目標中心或建築占地邊緣，Chebyshev 距離）；不含己方與動物。
  - `passThrough`：從射手到單位目標後方這個距離、離彈道 25 以內的敵方單位受一半攻擊。
  - `buildingsOnly`：只能攻擊建築（攻城槌、巨型投石機）；`submit` 拒絕對單位的攻擊命令，自動接戰與電腦都跳過。取代原本寫死的 `kind === 'ram'`。
  - `selfDestruct`：出手後 `killUnit`（炸藥桶）。
  - `setup`：架設與收起的 tick 數（巨型投石機 150）；`combat.ts` 在射程內先架設，`movement.ts` 在第一步前先收起。
- **文明效果**：`EffectKind` 多了 `blast`（加）與 `setup`（乘，在 `mulKinds`）；`statsOf` 把 `setup` 的倍率乘上後四捨五入，至少 1。
- **規則資料**：
  - `rules.entries` 新增 6 種單位、14 項兵種升級（`requires` 是第四時代與前一階），以及戰狼號、彈射器、采邑騎兵；`rules.production` 讓升級在訓練該單位的建築研究，巨型投石機、炸藥桶與這 3 項特殊科技在城堡。`deferredTechs` 只剩 `greek-fire`、`artillery`。
  - `civilizationsOf` 反覆排除「生產建築或前置項目不可用」的項目直到沒有變化（拓荒者沒有城堡，也就沒有巨型投石機與炸藥桶）；`unavailable` 依 `rules.entries` 的順序。
  - 鐵匠鋪的近戰攻擊與馬鎧多選 `camel` 類別。
- **Worker**：
  - `UNIT_STRIDE` 18 → 19：索引 18 是 `unpacked`（`setups[id].unpacked` 為 true 時 1）；`UnitView.unpacked: boolean`。`tests/browser.mjs` 寫死步長，`tests/worker.test.ts` 會提醒同步。
  - `createService(initial?: State)`：給測試讀入夾具狀態（例如已架好的巨型投石機）；Worker 不傳，仍從 `createState(260925)` 開始。
- simulationVersion、State.version 與 snapshot 格式升為 28；`rulesetHash` 因規則資料改變而換掉。

## 科技：學院、通用科技與火藥單位 v29

- **State**：
  - `version: 29`；snapshot 格式 `brick-sandbox-29`。v28 存檔明確拒絕（沒有遷移）。
  - `Unit.stride?: number`：上一 tick 沒走完、帶到下一 tick 的距離（百分之一）。速度有小數，或走到節點後這一步還有剩、而且還要繼續走時才有；單位停下或剩餘為 0 時刪除。速度整除 50 的單位不會出現這個欄位，所以舊的對局內容不變。
  - `Building.boost?: number`：磨坊水車的建造加成累積（百分點）；每名村民每 tick 加上 `buildRate`，滿 100 多算一次工作（不超過完工前一格）。沒有研究時不出現。
  - `State.techs[player]` 照舊記錄已研究的科技；這一輪的通用科技、砲兵都寫在這裡，沒有新的科技狀態。
- **種類**：
  - `unitKinds` 依序附加 `hand-cannoneer`、`bombard-cannon`（Worker 用索引投影種類，只能附加）。
  - `BuildKind`／`buildKinds` 附加 `university`；`buildingRules.capacity.university = 0`（不提供人口）；`footprints.university` 3×3（300×300）；`combatRules.buildings.university = 350`。
- **效果資料**（`packages/content/civs.ts`、`packages/content/techs.ts`、`packages/sim/civ.ts`）：
  - `techs.ts` 的 `techEffects`：通用科技的 `Effect` 紀錄（`trigger.tech` 是科技 id），和文明加成同一種資料；`fx`、`Opts` 從 `civs.ts` 匯出給它用。
  - `activeEffects(owner, kind)` 對每個文明都加上 `techEffects`（`withTechs` 依文明快取），所以通用科技和文明加成一樣疊加：加法相加、倍率相乘、時代分級互相取代。
  - 新的 `EffectKind`：`buildingMeleeArmor`、`buildingPierceArmor`（加，`buildingArmorBonus`）、`buildRate`（加，百分點，`buildRateBonus`）、`garrisonHeal`（乘，`garrisonHealScale`）、`bonusScale`（乘，對 `vs` 類別的加成，`bonusScales`）。`garrisonHeal` 與 `bonusScale` 在 `mulKinds`。
  - `Selector.allUnits` 在 `workRate` 上的意思是只加快單位的訓練（`timeTicks` 檢查項目是單位），不加快研究（徵兵技術）。
  - `los` 的建築加成擴大到城鎮中心、住宅、兵營、箭塔與城堡（`vision.ts` 的 `extra`），未完工的住宅與兵營不加。
  - `rulesetHash` 加入 `techEffects`。
- **數值**（`packages/sim/stats.ts`）：
  - `speedOf` 算到百分之一（之前四捨五入到整數）；`movement.ts` 每 tick 走 `floor(stride + speed)`（以百分之一計算），剩下的存回 `stride`。
  - `buildingTargetOf(kind, owner)`：建築的護甲加上磚瓦技術、建築學；`combat.ts` 的 `damageOn` 打建築時用它（之前是固定的 `buildingTarget`）。
  - `statsOf` 在類別加成之後套用 `bonusScale`（四捨五入）。
  - `defense.ts`：進駐回血第 n tick 回 `floor(n×scale/40) − floor((n−1)×scale/40)` 點。
  - 新單位的 `UnitStats`：火槍兵（類別 `archer`、`gunpowder`）、火砲（`siege`、`gunpowder`，`minRange` 250、`blast` 50）。
- **規則資料**：
  - `rules.entries` 新增學院（建築）、22 項通用科技、火槍兵與火砲（`requires` 是第四時代與化學）、砲兵；`rules.production` 讓學院的 8 項在學院，其他在兵營、靶場、馬廄、城鎮中心、修道院、城堡，火槍兵在靶場、火砲在攻城器工坊、砲兵在城堡。`deferredTechs` 只剩 `greek-fire`。
  - 各文明的 `missing` 補上這一輪的項目（科技樹頁）；拜占庭例外，見 first-use-029 的 FU29-7。
- **Worker**：投影不變，`UNIT_STRIDE` 仍是 19；`stride`、`boost` 不投影。頁面的護甲與箭塔名稱由頁面依自己的科技計算（`buildingTargetOf`、`economy.techs`）。
- simulationVersion、State.version 與 snapshot 格式升為 29；`rulesetHash` 因規則資料與科技效果改變而換掉。

## 建築：碼頭、船、市集、城牆與奇觀 v30

- **State**：
  - `version: 30`；snapshot 格式 `brick-sandbox-30`。v29 存檔明確拒絕（沒有遷移）。
  - `market: {food, wood, stone}`：市集的公平價（每 100 單位的黃金），兩位玩家共用；開局 100／100／130，每次賣出降 2、買入升 2，介於 20～9999（`market.ts` 的 `marketRules`）。
  - `trades: Record<unitId, {home, target, leg: 'out'|'back', retries}>`：貿易車隊與貿易商船的路線。`home` 是下令時最近的自己完工的市集或碼頭，`target` 是對方的市集或碼頭；回到 `home` 時入帳一趟的黃金。任何其他命令、任一端消失、單位換邊或連續走不到（`retries` > 3）時刪除。
  - `wonders: Record<buildingId, endsTick>`：每座完工的奇觀的獲勝時間（完工 tick + 聖物勝利的 20000）；奇觀倒塌就刪除。`wonderVictory: {player, building, endsTick} | null`：最早到的那一座；到時 `Outcome.reason` 為 `'wonder'`。
  - `transports: Record<unitId, Unit[]>`：運輸船裡的單位（不在 `units` 裡，和進駐建築一樣）；運輸船沉沒時逐一 `killUnit`。征服判定把船上的單位也算成活著。
  - `boarding: Record<unitId, {transportId, repath}>`：走向運輸船、準備上船的單位；`unloading: Record<transportId, {x, y}>`：開往卸載點的運輸船。之後對這些單位或運輸船下任何命令都會取消。
  - `Account.ledger` 多了 `market`（市集買賣，含黃金，有正負）與 `trade`（貿易帶回的黃金）。
- **地圖**：`MapLayout` 多了 `'lakes'`（32×32，`generateOpen(seed, true)`）：地圖中央半徑 720 內、不在雙方基地範圍的格子變成水，先標記為占用；湖岸外兩格保留為空地（不放礦與樹，繞湖的路不會只剩一格寬）；湖裡放 8 群深水魚（周圍八格都是水，村民從岸上碰不到），中立礦改放在離中心 1000～1250 的環上；沒有小池塘（`openMapRules.lake`）。`'open'` 的生成完全不變（湖的部分不消耗亂數）。
- **種類**：
  - `unitKinds` 依序附加 `fishing-ship`、`transport-ship`、`trade-cog`、`trade-cart`、`galley`、`fire-galley`、`demolition-raft`、`cannon-galleon`、`longboat`（Worker 用索引投影種類，只能附加）。升級沿用原本的種類：弩砲戰船一次把 `galley`、`fire-galley`、`demolition-raft` 三條線都升一階（`lineUpgrades` 裡同一個 id 有三筆）。
  - 類別 `ship` 讓單位走水面圖層（`movement.ts` 的 `layerOf`）；`warship`（戰船系與維京大戰船）吃羽箭、錐形箭、護腕與化學；`trade` 吃商隊；`fishing`、`transport` 給文明效果選用。
  - `BuildKind`／`buildKinds` 附加 `town-center`、`market`、`dock`、`fish-trap`、`outpost`、`bombard-tower`、`wonder`、`palisade-wall`、`palisade-gate`、`stone-wall`、`gate`；`navigation.ts` 的 `buildingKinds` 改成由 `rules.entries` 的建築條目產生（之前寫死，少了城堡與學院）。
  - 資源種類多了 `fish-trap`（食物、走水面，容量 1000）：完工的魚網開出的食物，只有擁有者的漁船能採，採完就消失。
- **占地**（`packages/content/footprints.ts`）：碼頭與市集 3×3、奇觀 5×5、魚網 2×2，哨站、火砲塔、每一格城牆與城門 1×1。魚網與城門沒有擋路矩形（和農田一樣）：船可以開過魚網；城門由 `movement.ts` 的每位玩家通行表對敵方關閉（`landFor`）。沒有擋路矩形的建築，放置時仍以整個占地判斷重疊，所以不能蓋在城門、魚網或農田上。
- **放置**（`buildings.ts` 的 `placementProblem`，頁面與 Worker 共用）：碼頭的每一格都要是水或淺灘，而且至少一格緊鄰可建造的陸地；魚網的每一格都要是水；其他建築照舊只能蓋在可建造的地面。城門可以蓋在自己同材質的城牆上，取代那一格（不退費）。`buildRequirement` 多了 `techs` 參數：前置是一般科技時（火砲塔要火砲塔技術）檢查是否已研究。
- **命令**：
  - `build` 多了選填的 `to: {x, y}`（只限木牆、石牆）：從起點格到終點格的直線（Bresenham），最多 24 格，每格各自檢查、各自付費；放不下的格子跳過，一格都放不下才失敗。村民蓋完一格後找 300 內最近的自己未完工城牆或城門。漁船只能蓋魚網，村民不能蓋魚網。
  - `market {action: 'buy'|'sell', resource: 'food'|'wood'|'stone'}`：要有自己完工的市集；執行時才結算並記成交易結果。
  - `trade {unitIds, buildingId}`：貿易車隊對對方的市集、貿易商船對對方的碼頭（要在自己記得的建築裡）。
  - `load {unitIds, transportId}`、`unload {transportId, x, y}`：陸上單位走到運輸船 150 內上船；運輸船開到點附近的水面，把單位放到 150 內的空地（`naval.ts` 的 `navalRules`）。
  - `attack` 拒絕攻擊類型為 `'none'` 的單位（漁船、運輸船、貿易單位）。
- **效果資料**：新的 `EffectKind`：`marketFee`（加，百分點，`marketFeeOf`）、`transportCapacity`（加，`transportCapacityOf`）、`arrowBonus`（加，建築的箭對 `vs` 類別，`arrowsOf().bonus`）。`gatherBonus(owner, yield, source, kind)` 多了採集者種類：選擇器寫了 `kinds` 的效果（流刺網、日本漁船）只作用在那些種類。
- **規則常數**：`marketRules`（`market.ts`）、`navalRules`（`naval.ts`）、`dropoffRules.ships`（碼頭只收漁船的食物）、`defenseRules` 的火砲塔與箭的 `bonus`（對船）、`visionRules` 的哨站、城牆與奇觀視野、`aiRules` 的碼頭、漁船、魚網、戰船、市集與貿易車隊常數，都在 `rulesetHash` 裡。
- **Worker**：快照多了 `NavalView`（市集價格與自己的交易費、自己的運輸船與乘客、自己的貿易路線與每趟黃金、雙方完工的奇觀與倒數）；`Operation` 多了 `load`、`unload`、`market`、`trade`，`build` 多了 `to`。
- simulationVersion、State.version 與 snapshot 格式升為 30；`rulesetHash` 因規則資料改變而換掉。

## 遊戲元素：防禦類型、駐軍、修理與嘲諷 v31

- **State**：
  - `version: 31`；snapshot 格式 `brick-sandbox-31`。v30 存檔明確拒絕（沒有遷移）。
  - `reveals: {player, tile, until}[]`：被看不見的攻擊者打到時，受害方可以看到攻擊者所在的格子到 `until`（命中 tick + `revealTicks` 40）。同一位玩家、同一格再被打到時延長；過期的在 `updateVision` 前刪除，`updateVision` 多了這個參數。
  - `repairs: Record<'b:<buildingId>'|'u:<unitId>', {pool, owed}>`：每個修理目標累計的百分之一生命（`pool`）與各資源欠款（以 1／(2 × 最大生命) 為單位，湊滿整數才扣），讓修滿的總價恰好是原價一半。
  - `chat: {player, taunt, tick}[]`：嘲諷紀錄，只保留最後 20 則（`tauntRules.keep`）。
  - `Attack.windup?`：開火間隔的倒數（tick）；有值時單位還不能開第一發，移動就重設。
  - `Building.rally` 多了選填的 `inside: true`：生產建築的集結點設在建築本身，新訓練的單位直接進駐。改設到建築外會清掉。
  - `transports` 也存衝撞車裡的步兵與徒步弓兵（key 是衝撞車的單位 id）；衝撞車被毀時乘客下到附近的空地，沒有空地的才陣亡（運輸船沉沒仍全滅）。
  - `Account.ledger` 多了 `repair`（修理花掉的資源）。
- **單位資料**（`stats.ts` 的 `UnitStats`）：`classArmor`（類型護甲，例：拜占庭聖騎兵 `{cavalry: 10}`）、`frameDelay`（開火間隔 tick）、`friendlyFire`（範圍傷害也打自己的單位：投石車系、火砲）、`trample`（相鄰敵方單位受到的比例：戰象 0.5）、`buildingSplash`（附近敵方建築也受同一擊的半徑：裝甲衝撞車 75、重型 100）、`alsoSiege`（只打建築的單位也能被下令打攻城器：攻城槌系）。類別新增 `ram`（攻城槌系、巨型投石機）、`mameluke`、`fishing-ship`（取代漁船原本的 `ship`／`fishing`；`layerOf` 也接受它）。
- **建築的類型**：`buildingClassesOf(kind)`：都有 `building`，奇觀以外有 `standard-building`，石牆、城門、箭塔、火砲塔有 `stone-defense`，城牆與城門有 `wall-gate`，城堡有 `castle`。`buildingTargetOf` 回傳類別與建築類護甲。
- **傷害公式**：`hitDamage = max(1, max(0, 攻擊 − 護甲) + Σ max(0, 加成_c − 類型護甲_c))`，只算攻擊者有加成、目標也有的類別 c。
- **效果資料**：新的 `EffectKind` `buildingClassArmor`（加，建築對 `building` 加成的類型護甲；磚瓦技術、建築學各 +1，垛牆讓石牆 +3）。化學與攻城工程師的選擇器改成明確的單位種類。
- **規則常數**：`defenseRules` 多了 `ejectPercent` 20（生命 ≤20% 時撤出、不能進駐）、`healRate` `{castle: 2}`、`rallyGarrison`（兵營、靶場、馬廄、攻城器工坊、修道院、碼頭各 10）；`carrierRules`（`garrison.ts`：衝撞車載量 4／5／6、每名步兵速度 +10%、對建築 +3、上限 13／16／19）；`repairRules`（`repair.ts`：建築每 tick 0.26、攻城器與船 0.16、之後每名村民一半、費用一半、攻城器 75 內、船 100 內、農田與魚網不能修）；`tauntRules`（`taunts.ts`：保留 20 則、每 20 tick 一則）；`revealTicks` 40；`aiRules` 的修理與嘲諷常數。都在 `rulesetHash` 裡。
- **命令**：
  - `taunt {number}`：1～42；同一位玩家每 20 tick 最多一則（已排隊未執行的也算）。
  - `repair {unitIds, target: {kind: 'building', id} | {kind: 'unit', id}}`：只限村民；目標是自己完工的建築（農田、魚網除外）、攻城器或船。資源不夠就停工。
  - `ungarrison` 接受 `{buildingId}` 或 `{unitId}`：`unitId` 讓衝撞車（或靠岸的運輸船）放出乘客。
  - `load {unitIds, transportId}` 的 `transportId` 可以是自己的衝撞車（只收步兵與徒步弓兵，載量依升級）。
  - `rally` 的點在自己的生產建築本身時設成 `inside`；手動對這些建築下 `garrison` 會被拒。
  - `attack`：攻城槌系可以對攻城器下令（`alsoSiege`）。
- **Worker**：快照多了 `chat`、`BuildingView.rally.inside` 與 `BuildingView.inside`（裡面單位的種類與生命，給頭像用），`transports` 也列出衝撞車；`Operation` 多了 `taunt`、`repair`，`ungarrison` 多了 `unitId`。`Attack.windup` 與 `reveals` 不進快照（視野直接反映在可見格子裡）。
- simulationVersion、State.version 與 snapshot 格式升為 31；`rulesetHash` 因規則資料改變而換掉。

## 戰術技巧：投射物、姿態、巡邏與開局 v32

- **State**：
  - `version: 32`；snapshot 格式 `brick-sandbox-32`。v31 存檔明確拒絕（沒有遷移）。
  - `projectiles: Projectile[]`、`nextProjectileId`：飛行中的投射物。`Projectile` 有 `id`、`player`、`attacker`（開火的單位 id，建築的箭是 -1）、`kind`（開火者的單位或建築種類）、`from`、目前位置 `x`/`y`、落點 `to`、每 tick 的 `speed`、`target`、`sure`（開火時的命中判定）、開火當下的 `stats`（傷害、加成、範圍等）、`extra?`（連發的額外箭）與發射 `tick`。依 id 順序推進；開火者死掉後仍會落地。
  - `stances: Record<unitId, Stance>`：`Stance` 是 `'aggressive' | 'defensive' | 'stand' | 'passive'`；只存非預設的（預設攻擊）。
  - `patrols: Record<unitId, {from, to, leg: 'out' | 'back', wait}>`：巡邏的兩端、目前的方向與重試倒數。
  - `aiOpening: string`：電腦的開局，`'standard'`（之前的電腦）或 `openings.ts` 的開局 id；建立時傳 `'random'` 會依種子與紅方文明解析成實際的 id 才存。不認得的 id 會被拒絕（「未知的電腦開局」）；`deserialize` 也檢查並用它重播。
  - `Attack.anchor?`：防禦姿態自動開打時站的位置，離開超過 `defensiveLeash` 就走回去。
- **函式簽名**：`createState(seed, layout, opponent, civs, aiOpening = 'standard')` 與 `replay(…, aiOpening = 'standard')`；舊的呼叫照樣可用。
- **投射物規則**（`stats.ts` 的 `projectileRules`）：`hitRadius` 30、`missSpread` [40, 100]、`meleeReach` 75，各單位與建築的命中率與彈速，以及改變命中率的兵種升級（弩手 85、強弩兵 90、精銳長弓兵 80）。`shotOf(kind, owner)` 與 `buildingShotOf(kind, owner)` 回傳 `{accuracy, speed, steady, lead}`：`steady` 是射擊靜止目標時被效果提高的命中率（拇指環、戰狼號），`lead` 是彈道學。
- **效果資料**：新的 `EffectKind` `lead`（預判移動中的目標：單位用 classes、建築用 buildings）與 `accuracy`（射擊靜止目標的命中率）。`techs.ts` 多了 `ageEffects`（依時代自動生效、不屬於任何科技的效果，目前只有追蹤：第二時代起步兵視野 +200），由 `civ.ts` 的 `activeEffects` 一起評估。新的科技項目 `ballistics`（學院、第三時代、木材 300 黃金 175、60 秒）。
- **戰術規則**（`combat.ts` 的 `tacticsRules`）：`defensiveLeash` 300、`patrolTurn` 100、`patrolRetry` 20。
- **開局資料**（`packages/content/openings.ts`）：
  - `openings`：9 種可玩的開局，每種有 `id`（網站頁面的代號）、中英文名稱、網站頁面、時代、威力、難度、優缺點、`civs`（13 個文明都可以）、`best`（網站點名的文明）、反制、本作與網站的升級前配置、`steps`、`plan` 與 `notes`。
  - `unavailableOpenings`：老鷹開局與原因。
  - `steps`：`{label, phase: 'dark' | 'up' | 'feudal' | 'castle', done: Need | null}`；`null` 是建議，沒有勾選框。`Need` 欄位：`villagers`、`gather`（羊、打獵、果樹、木材、黃金、石頭、農田的人數）、`buildings`、`forward`（村民或某種建築在對方半邊）、`units`、`techs`、`age`、`clicked`（已點升級）、`raiding`（出擊中的兵數）。`needMet(need, view)` 是純函式。
  - `plan`：村民目標與點升級的村民數、`clickOnFood`、織布機、兵營時機（`dark` 幾名村民時、`up`、`none`）、`forwardBarracks`、各階段的採集權重、各階段要維持的兵數（含開局斥候）、封建時代的額外建築與研究、`raid`（兵種、幾隻出發、是否補兵）、`towers`（前線村民數、座數、偏好的資源、離開時機）、`castle` 與 `until`（tick 與時代）。
  - 輔助：`openingChoices`（`standard`、`random` 與 9 種 id）、`pickOpening(seed, civ)`、`openingById`、`gatherKinds`、`gatherNames`。
  - `ai.ts` 匯出 `openingView(s, player)`（從 State 算出 `needMet` 要的觀測）與 `openingRules`（`towerGap` 600）。
- **規則常數與 hash**：`rulesetHash` 加入 `projectileRules`、`tacticsRules` 與 `openings`。
- **命令**：
  - `stance {unitIds, stance}`：只限戰鬥單位（「只有戰鬥單位有戰鬥姿態」）；不認得的姿態「未知的戰鬥姿態」。只改姿態，不影響其他命令；改成不還擊或堅守時放下自己開打的戰鬥。
  - `patrol {unitIds, x, y}`：之後的任何命令都會結束巡邏。
  - `move` 多了選填的 `spread: true`。
- **Worker**：
  - `Operation` 多了 `stance`、`patrol`；`reset`、`Recovery`（還原檢查點）多了 `aiOpening`，`recover` 與 `replay` 照傳。
  - 每個回應多了 `aiOpening`（存的 id）與 `coach`（`openingView(state, 0)`，頁面自己跑 `needMet`）。
  - `View` 多了選填的 `projectiles`（藍方發射的或目前看得到的：`{id, from, x, y, to, player, kind}`）、`stances`（藍方單位的非預設姿態）與 `patrols`（藍方巡邏中的單位 id）。只有沒有 `projectiles` 的舊快照才畫建築箭的直線。
  - 單位投影的 stride 仍是 19。
- simulationVersion、State.version 與 snapshot 格式升為 32；`rulesetHash` 因規則資料改變而換掉。

## 科技樹與對局設定 v33（目前版本）

- **State**：
  - `version: 33`；snapshot 格式 `brick-sandbox-33`。v32 存檔明確拒絕（沒有遷移）。
  - `settings: MatchSettings`（`packages/sim/settings.ts`）：`{difficulty: 'easy' | 'standard' | 'hard' | 'hardest', resources: 'low' | 'standard' | 'medium' | 'high', popCap: 25 | 40 | 75 | 100, reveal: 'normal' | 'explored' | 'all', startAge: 1 | 2 | 3 | 4, victory: 'standard' | 'conquest', allTechs: boolean}`。預設 `defaultSettings` 就是之前的對局（標準、200／200／100／100、40、戰爭迷霧、黑暗時代、標準勝利、不開所有科技）。`settingsOf(s)` 讓沒有這個欄位的舊測試資料照預設跑。
- **函式簽名**：
  - `createState(seed, options)`：`options` 是 `MatchOptions`（`Partial<MatchSettings>` 加上 `layout`、`opponent`、`civs`、`aiOpening`）。舊的位置參數照樣可用：`createState(seed, layout, opponent, civs, aiOpening, settings?)`，第六個參數是選填的設定。
  - `replay(seed, commands, ticks, layoutOrOptions, …)` 同樣接受 options 物件或舊的位置參數。
  - `matchSettings(value)` 補上預設並拒絕不認得的值（「無效的對局設定」「未知的難易度」「未知的資源設定」「未知的人口上限」「未知的地圖顯示設定」「未知的開始時代」「未知的勝利條件」「所有科技設定無效」）；`deserialize` 用它檢查存檔（無效的給「無效存檔狀態」）並用存的設定重播。
- **設定生效的地方**：
  - 資源：`createState` 用 `settingRules.resources` 當起始存量，再加文明的開局加成。
  - 人口：`buildings.ts` 的 `recomputeCapacity` 用 `settings.popCap` 取代 `rules.settings.populationCap`；電腦也讀它。
  - 顯示地圖：`explored` 在建立時把兩方的 `vision.explored` 設成整張地圖；`all` 讓 `updateVision` 的新參數 `everything` 每個 tick 都給兩方全部可見。
  - 開始時代：`ages` 設成那個時代，`grantTechs` 給該時代的免費科技，城鎮中心的 `age` 外觀跟著改。
  - 勝利：`conquest` 時 `religion.ts` 不啟動聖物倒數、`market.ts` 清掉奇觀倒數。
  - 所有科技：`Owner.allTechs`（`ownerOf` 從 `settings` 帶入）、`civAvailable(civ, id, allTechs)` 改查 `rules.ts` 的 `allTechCivilizations`（每個文明都可用全部共通項目，特殊單位與特殊科技仍依文明）；`TrainInput.allTechs`、`buildRequirement(…, allTechs)` 與電腦都照這個查。
  - 難易度：`ai.ts` 用 `aiTuning(state)` 讀 `settingRules.difficulty` 的 `thinkTicks`、`villagerTarget`、`waveSize`、`firstWaveTick`；`standard` 與之前的 `aiRules` 完全相同。
- **可用性資料**：`civs.ts` 中沒有火砲塔的 10 個文明的 `missing` 加上 `bombard-tower-tech`（科技樹稽核的修正）。
- **科技樹版面**：`packages/content/tree-layout.ts` 的 `treeLayout: TreeLayoutBlock[]`，每塊 `{id, rows: {age, cells: TreeLayoutItem[][]}[]}`，`TreeLayoutItem` 是 `{id?}`（本作的項目）或 `{ref, path}`（本作沒有的網站項目）加上 `down?`（網站的往下箭頭）；城堡的特殊單位與特殊科技格用 `'@unique-unit'`、`'@unique-tech'` 代表。只有排列，可用性一律讀 `rules.ts`。頁面的模型在 `apps/web/codex-tree.ts`（村民建造區塊、弩砲戰船的別名、需化學與需火砲塔技術的註記、只畫真的前置的箭頭）。
- **百科的介面**：`CodexContext` 多了 `section`（`'tree'` 直接開在科技樹）、`match?: TreeMatch`（對局中的文明、時代、研究、存量、己方建築與佇列、單位數，用來標記）與 `treeCiv?`（設定畫面開科技樹時預選的文明）；`codexSections` 多了 `{id: 'tree', label: '科技樹'}`。
- **Worker**：`reset` 多了 `settings`；`Recovery`（還原檢查點）、每個 `Response` 與 `View` 都帶 `settings`；`worker-client` 把它存進檢查點，`recover` 與 `replay` 照傳。單位投影的 stride 仍是 19。
- **頁面**：設定畫面在 `apps/web/lobby.ts`；上次的選擇與玩家名稱存在 localStorage；「記錄遊戲」勾選時每一遊戲分鐘存一次 `brick-rts:autosave:1`。這些都只在頁面，不進 State。
- simulationVersion、State.version 與 snapshot 格式升為 33；`rulesetHash` 加入 `settingRules`（難易度表、資源預設與人口上限的數值改了，舊存檔與命令就不再相符），也因規則資料改變而換掉。
