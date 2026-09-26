# 資料模型與權威邊界

目前權威 State／snapshot 為 v15，支援三種地圖、有限資源資料、三態視野、移動、存讀與重播，起始建築是有可通行入口的城鎮中心。下文保留各版本演進，不表示舊格式仍可載入。新增模型、LOD、除錯介面及幾何占地共用不增加玩法狀態。

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

## 送返建築與馬廄 v19（目前版本）

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
