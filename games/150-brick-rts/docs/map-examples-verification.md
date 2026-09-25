# C：海岸與手工驗收圖增量

2026-09-25。新增加 meadow／coast／acceptance 三種地格生成模式；實際遊戲沙盒仍使用 meadow，驗收頁可以選取三圖。C 不標完成，沒有新增海戰玩法或假生產控制。

## 已驗證

- `npm run build`、`npm run validate`、`npm test` 成功，42 項測試通過。
- `node --experimental-strip-types packages/content/export-maps.ts` 成功，三份可重現 JSON 位於 docs/maps/；後續可用 npm run maps:export。
- 海岸圖測試 0、1、7、42、260925、uint32 上限六個 seed：草地、沙岸、深水各自有通行資料；出生區連通，海域長距離路徑可達，樹／岩沒有生成在水上。
- 手工配置在不同 seed 下相同；陸地尋路經過淺灘，水域沿河道貫通。把淺灘改成深水並更新 blocked 後，陸地搜尋有限步數結束為 unreachable，地圖驗證明確報錯。
- 水域路徑保存 movement 類別，frontier 序列化續算結果相同。接觸岸邊的半徑判定拒絕越界，沒有用材質顏色決定可通行性。

Chromium 151.0.7922.34 的完整既有瀏覽器回歸亦通過：1440×900／390×844 移動與存讀、迷霧往返、Worker 故障恢復、WebGL 故障與首頁搜尋。模型檢視在 1200×900 切換 coast／acceptance 均產生不同畫面，返回 meadow 後 canvas 截圖與原圖逐位元相同；沒有 pageerror。`test-results/map-coast.png`、`map-acceptance.png` 保存實際截圖，手工圖已目視確認河道／淺灘與岸邊模型正常。本輪未另建乾淨目錄，未當成新的完整對局驗收。

預設草甸的資料與命令行為保持原樣，snapshot 仍為 v5；新 layout 尚未進入正式建立對局的命令。建模頁的切換方法只允許 assetPreview 模式使用。這是地圖驗收資料與檢視增量，沒有宣稱新的可玩對局里程碑；最近的完整乾淨目錄首次使用紀錄為 first-use-005.md。

尚待完成：高地／高度過渡、完整資源種類與分配公平、真正船隻／海運、C 資產矩陣及後續完整對局。原作淺灘規則仍 unverified，當前淺灘允許兩種 movement 是顯式 design_default。
