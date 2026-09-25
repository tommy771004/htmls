# 02｜權威模擬、命令與可重現性


依 Master 建立能在無畫面環境執行的純 TypeScript RTS 模擬核心。

- 使用穩定 entity ID 與可序列化 component／state。資料包含玩家、外交、資源、人口、位置、路徑、命令佇列、工作、戰鬥、建築、科技、視野與勝利條件。
- 定義 CommandEnvelope：protocolVersion、rulesetHash、playerId、sequence、targetTick、commandType、payload。命令先驗證所有權、目標、科技、資源、人口、地形與模式合法性，再原子提交。
- 同 tick 的命令與系統更新有明確穩定排序。跨瀏覽器一致性敏感值用固定點／整數和指定算術規則；避免依賴不穩定集合順序或超越函數。PRNG 演算法與所有 state／stream IDs 可保存。
- 固定模擬 tick 與可控制的遊戲速度。暫停、失焦、背景分頁 timer throttling、Worker lag、超載均有明確策略；單人可暫停，多人由伺服器持續決定，不能自行跳 tick。
- Path jobs 必須按 deterministic tick budget 推進，不可讓 wall-clock 完成先後改變結果。視覺資產非同步載入不得改變 entity 或 RNG。
- Web Worker 使用明確訊息協定與 transferable buffers；尚未有 cross-origin isolation 時不依賴 SharedArrayBuffer。主執行緒不得每 frame 複製整個世界。
- 跨執行個體比較 canonical state hash，排除鏡頭、動畫、粒子與插值；包含待執行事件、路徑 frontier、RNG、命令與所有權威狀態。
- 例外要帶 tick／command ID／entity ID；不得 catch 後吞掉錯誤並繼續偽裝正常。

交付：sim API、命令 schema、headless runner、tick profiler、state serializer。測試相同 seed＋命令得相同 hash、不同更新頻率不改結果、重複／過期命令、非法控制敵方、資源扣除原子性、10000 ticks 重播一致性。跨瀏覽器測試未執行需明示。
