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

## 後續模型（設計中，尚未實作）

| 階段 | 模型 | 需加入的契約 |
|---|---|---|
| B | Worker protocol／path jobs | 帶 request ID 的命令／結果／錯誤；可保存的 frontier 與固定工作預算 |
| C | Terrain／resource／vision | 地格通行類別、有限資源、未探索／已探索／可見、最後已見快照 |
| D | Path／occupancy | 佔地與半徑、排程、到達／不可達／卡住恢復；不能讓繪圖形狀當碰撞真相 |
| E | Player／inventory／work | 四資源、攜帶與送返、原子扣款與人口預留 |
| E | Building／technology／combat | 施工、生產、前置、HP、護甲、冷卻、投射物與死亡 |
| E | Match／AI | 明確 playing/won/lost 狀態、結束後命令拒絕、AI 僅用合法視野 |
| G–I | Persistence／network／scenario | 遷移、重播 checkpoint、權威伺服器、迷霧過濾、trigger 與工具歷史 |

上述表格不是已存在的元件或可玩功能；不得僅建立空介面就把 ledger 標成 implemented。
