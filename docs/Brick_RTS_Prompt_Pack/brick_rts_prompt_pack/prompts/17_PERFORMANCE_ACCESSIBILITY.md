# 17｜內顯效能、相容性與可及性


效能是測試結果，不是加上 LOD 後的口號。暫定目標裝置：中階筆電、16GB RAM、整合式 GPU。

## 場景與目標（提議，尚未實測）
- Smoke：2 玩家、200 個單位、100 棟建築、1000 個資源／障礙實體。
- Main：4 玩家、800 個單位、300 棟建築、3000 個資源／障礙實體，包含同時採集、群體移動、攻城、迷霧與 HUD。
- Stress：8 玩家、1600 個單位、600 棟建築、5000 個資源／障礙實體，用來確認全範圍瓶頸與上限。
上述「單位」是實體數，不等於人口值；每場記錄 idle／moving／fighting 分布與可見數。鏡頭近景／正常遊玩／全圖最大縮放都需測試。

以 1280×720、低品質為第一個量測基線。Main 的初始驗收目標：中位 FPS ≥30、frame-time p95 ≤50ms；20Hz 模擬的 p95 tick <50ms、無持續 backlog。這些是擬定門檻，不是承諾或成果；必要時以實測與使用者同意修訂，但不得無聲縮小範圍。Stress 未達標前，不宣稱完整八人規模已可流暢執行。

## 實作與量測
- 分別量 sim、pathfinding、AI、fog、render、UI、network；記錄 draw calls、triangles、textures／buffers、可取得的記憶體指標與估算方法，不能將 renderer.info 當作完整顯存量。
- 用 LOD／instancing／合併 static geometry、共用材質、骨骼／VAT 或簡化動畫策略、texture atlas、視野／距離剔除、事件節流、資源池、分批資產載入減負載。
- 降級只能改畫面細節、陰影、粒子、裝飾動畫與解像度；不可跳過碰撞／AI／戰鬥、刪單位、修改人口或改亂模擬 tick 語意。
- 先完整載入可玩所需資產，漸進載入高階美術；有 progress、cancel、retry、失敗定位。WebGL context loss、resize／DPR、storage denied、Worker crash、離線／網路中斷可恢復或給明確錯誤。
- 測試桌面 Chrome、Edge、Firefox、Safari；記錄實際版本與 OS。未測瀏覽器標未驗證，不以同引擎推定全部相容。
- 字級、對比、非顏色識別、快捷鍵重設、音量分類、降低動態、關閉邊緣捲動、鍵盤 focus 清楚可見。手機操作不在首版承諾內，不列為已支援。

交付可重跑 benchmark seeds／命令、10 分鐘與長局測試記錄、hard reload 與多次重新開局洩漏檢查、瓶頸排序和實際前後數據。測試環境無 WebGL 或目標機時，保留可執行腳本並明確列出未量測項，不捏造 FPS。
