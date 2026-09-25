# 資料模型與權威邊界

目前權威 State／snapshot 為 v9，支援三種地圖、有限資源資料、三態視野、移動、存讀與重播。下文保留各版本演進，不表示舊格式仍可載入。新增模型、LOD、除錯介面及幾何占地共用不增加玩法狀態。

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

## 多地形沙盒 v9（目前版本）

State.layout 保存 meadow／coast／acceptance。createState、replay、reset、Recovery 與一般 Response 均攜帶地圖類型；WorkerClient 在每次確認回應更新 checkpoint.layout。View.terrain 只含地格類別、高度、通行與可建造性，不含隱藏資源／障礙參照。renderer 使用 Worker 確認的地形，地面 raycast 命中實際地柱表面；恢復後不會回到預設草甸。snapshot v9 取代 v8，詳見 first-use-006.md。

## 共用占地契約（v9 行為不變）

packages/content/footprints.ts 是目前七種障礙物物理矩形的唯一來源：原點偏移 x/y、width、depth 皆為整數模擬單位，100 單位對應 1 世界單位。obstacleBounds 可按單位半徑擴張矩形；導航、資源耗盡的局部更新、起始資源接近點均透過同一契約取得邊界。住宅模型地基也讀取同一份尺寸。屋頂高處的裝飾懸挑不表示增加地面障礙。

此表只是搬移既有自訂工程值，並非確認原作占地。九組前後比對證明 v9 hash 與阻擋格沒有改變，因此本輪不更換 snapshot 或 ruleset hash。未來若修改任何權威尺寸，必須同時更新 simulationVersion／ruleset 身份及舊存檔策略，不能只改表而繼續宣稱 v9 相容。

模型頁的新經濟／公共建築與騎兵尚未加入權威 obstacle kinds；其 art footprint、掛點與選取圈在 asset-manifest.json，不能拿來當已實作碰撞規則。迷霧除錯介面只讀 View.fog／known／tick，不新增權威資料。
