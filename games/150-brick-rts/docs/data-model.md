# 資料模型與權威邊界

## 已實作的模型

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
