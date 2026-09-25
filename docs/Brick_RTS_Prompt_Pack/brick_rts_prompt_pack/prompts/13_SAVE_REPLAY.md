# 13｜存檔、讀檔、重播與恢復


設計版本化且可驗證的完整遊戲保存，不是只存玩家資源和單位位置。

- 保存 ruleset／content hash、schemaVersion、map seed 與變更、tick、PRNG、命令排序、外交、迷霧／最後情報、所有單位／建築／資源、工作佇列、交易貨物、人口保留、科技進度、projectiles、timers、AI state、勝利條件與 deterministic path jobs。
- Snapshot 在一致 tick barrier 產生。Worker 與 UI 保存不同步時不得混成一份。引用全以 stable ID 重建，不序列化 Three.js objects。
- IndexedDB local slots、明確 slot metadata、手動匯入／匯出、自動保存上限、配額不足、private-mode／storage denied、舊版本 migration 與損壞檔案提示。
- Replay 記錄初始 snapshot／seed＋有效命令＋必要事件；seek 採 checkpoint，保留玩家視角與 fog；比對 canonical hash。觀戰全圖只在該模式允許時啟用。
- 讀檔要重新建立 render mapping／audio／selection，釋放舊場景資源。存讀後不能多一隻兵、遺失乘員、重領交易金、重複研究或多建一棟房屋。
- 錯誤需可恢復：壞檔不覆蓋好檔，未知 ruleset 不悄悄套用另一套數值。

驗收：採集中、施工中、攻城器展開中、箭矢飛行中、多人轉化競爭中、登船中、遺跡攜帶中、特殊勝利倒數中保存並恢復；續跑相同 ticks 的 hash 對比、migration 失敗、quota failure。多人斷線續局在下一階段另驗收，不以單人讀檔替代。
