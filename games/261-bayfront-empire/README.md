# 261 灣岸商業帝國 · BAYFRONT EMPIRE

等角視角經營大亨：先在海濱大道開城市商家，再透過「海灘改版」把生意做到沙灘、碼頭與海上，最後以「物流與海港改版」開港降低進貨成本、投標貨運合約。依一段用 AI 開發商業大亨遊戲海灘改版的影片與提示詞製作（玩法與畫面為原創實作，未使用原作素材）。

## 指令

```bash
npm run build      # 打包成 ../../web/261-bayfront-empire.html（改了 src/ 要重跑並一起 commit）
npm run dev        # 不壓縮的版本，方便除錯
npm run test:econ  # node:test：經濟系統、跨日結算、v1→v3 與 v2→v3 存檔遷移、海港補給船與合約、壞資料
npm test           # test:econ ＋ 兩種尺寸的無頭 Chrome 驗收（跑打包後的單檔，要先 build）
npm run sim        # 在 Node 跑經濟模擬（會開海港並投標），看節奏
npm run thumb      # 產生 ../../thumbs/261.jpg
node tools/shot.mjs out.png 390 844 '?auto=legacy' "__bf.setTime(20)"   # 開發用截圖
```

`node_modules` 是指向 `../201-coral-cove/node_modules` 的符號連結（three 0.186.0、esbuild、playwright-core）。

## 操作

拖曳移動地圖、滾輪或雙指縮放、點店面或標籤看詳情。鍵盤：WASD／方向鍵移動、Q／E 縮放、空白鍵暫停、1／2／3 切換 1×／2×／4×、Esc 關閉面板。

## 結構

| 檔案 | 內容 |
| --- | --- |
| `src/data.js` | 15 種商家（10 城市＋5 海灘）、每小時客流曲線、天氣與轉移機率、每日活動、任務鏈、帝國等級 |
| `src/port.js` | 純資料的物流與海港：庫存與補貨點、補給船下單、船期與天候延誤、泊位與岸橋卸貨、物流車運量、倉儲費與生鮮耗損、合約招標與逾期罰款、擴建 |
| `src/econ.js` | 純資料的經濟系統：`tick` 推進時間（整點扣工資、換天氣、跨日結算）、`arrivalPerMin` 來客率、`buyOrUpgrade`、`serve`／`turnAway`、任務、`migrate`／`serialize` 存檔 |
| `src/layout.js` | 地圖座標（街道、街區、店面、海灘商家、停泊位）、步行路網與最短路表、`groundY` |
| `src/world.js` | 靜態場景（合併成 5 個網格）：道路標線、建築、公園、會堂、步道護欄、沙灘、防波堤、碼頭、觀景棧橋 |
| `src/decor.js` | 隨等級重建的店面擺設：鐵捲門／雨棚招牌／外帶座位／屋頂看板、海灘小屋、傘位、衝浪板架 |
| `src/sea.js` | 海面 shader（濕沙、白浪、湧浪、反光）、航跡粒子、帆船、遊艇、貨輪、租船、水上摩托車、衝浪客、浮標、海鷗 |
| `src/people.js` | 顧客 AI 與路人、海灘遊客（InstancedMesh） |
| `src/traffic.js` | 棋盤路網隨機行駛的車流 |
| `src/portview.js` | 海港畫面：碼頭岸壁與堆場、倉庫／冷藏倉／港務大樓（隨等級）、岸橋與吊櫃動畫、堆場貨櫃（反映庫存）、貨櫃船（依船期移動並拖航跡）、物流車 |
| `src/ui.js`、`src/icons.js` | HUD、標籤（含港口與船隻）、飄字、面板（含物流面板的總覽／合約／船隊三分頁）、通知 |
| `src/audio.js` | WebAudio 合成音效 |
| `src/main.js` | 渲染器、等角鏡頭、日夜與天氣、輸入、存檔、主迴圈、`window.__bf` 測試 API |

規格、存檔格式與效能策略見 `SPEC.md`。

## 測試 API（`window.__bf`）

`setTime(時)`、`setWeather('sunny'|'partly'|'cloudy'|'rain'|'heat')`、`setSpeed(0|1|2|4)`、`look(x, z, 視野高)`、`give(金額)`、`buy(id)`、`buyAll(等級)`、`fast(秒, 倍速)`（不渲染直接推進模擬）、`buyPort(等級)`、`bid(報價id, 每櫃出價)`、`bidWin(報價id)`（必中）、`now()`（絕對遊戲分鐘）、`harbor.stats()`、`load(存檔)`、`exportSave()`、`stopSaving()`、`stats()`。網址加 `?auto=new`、`?auto=legacy`（v1 存檔）或 `?auto=v2`（v2 存檔）跳過開始畫面與公告。

## 已知限制

- 驗收用的無頭 Chrome 跑在桌機 GPU 上，手機 50fps 是以「CPU 4 倍降速＋390×844」模擬，沒有在實機量測；實機若掉到 47fps 以下，自動畫質會依序降低陰影更新頻率、解析度，最後關閉陰影。
- 車流不處理路口號誌與交會，偶爾會在路口重疊；行人直接穿過車道上的斑馬線。
- 存檔只在這台裝置的 localStorage，沒有離線收入。
- 物流車只是畫面上的示意（沿固定環線往返並在店門口停靠），實際配送量由每小時運量上限結算，不會因為塞車而變少。
- 貨櫃船進出港走直線插值，不避讓環境帆船與遊艇。
