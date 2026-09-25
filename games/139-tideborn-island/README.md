# 潮生島

入口：`web/139-tideborn-island.html`，以本機 HTTP 伺服器開啟。

居民自動循環：家 → 工作地點 → 搬運到市集 → 交易 → 家。路網的共享取樣點合併為節點，以 Dijkstra 尋路；有限狀態機管理作息、路上交談與成對市集交易。無對手時，市集攤位在等待 12 秒後接收貨物。來源貨堆、角色貨箱與目的地箱子會顯示貨物流向；到站交付後才計入庫存。

操作：上方可暫停或切換 1×／3×／8×；居民面板可近看角色；下方提供居民、建造、農場、製作、市集、任務。先等待居民交貨，製作並送出木板、領取任務獎勵，再升級碼頭。Lv.2 解鎖溫室，Lv.3 解鎖麵包房。島嶼目前最高 Lv.3，四項任務完成後可繼續經營。

自動存檔每五秒執行，保存資源、任務、建築與居民當前狀態及貨物；沒有離線收益。地形面板修改後需按「套用並開新島」，會提醒此動作取代既有存檔。

- `simulation.mjs`：不依賴繪圖的尋路、行為、經濟與存檔。
- `game.js` / `game.css`：遊戲介面、glTF 動畫、貨物流向和儲存。
- `village.js`：程序化村莊、地基與入口道路、升級建築。
- `generate-villager.py`：原創骨架角色與三段動畫的 glTF 產生器。

測試：`node --test tests/tideborn-simulation.test.mjs`；瀏覽器回歸為 `tests/tideborn-game-regression.mjs` 與 `tests/tideborn-island-regression.mjs`。可透過 PLAYWRIGHT_MODULE、BROWSER_EXECUTABLE 指定 runtime。
