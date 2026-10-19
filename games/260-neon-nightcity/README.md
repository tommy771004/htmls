# 260 霓虹夜城 · NEON NIGHT CITY

單檔成品：[`web/260-neon-nightcity.html`](../../web/260-neon-nightcity.html)，縮圖 [`thumbs/260.jpg`](../../thumbs/260.jpg)。分類：遊戲敘事。

凌晨兩點的雨夜街區。可以開楔形跑車 Kestrel、騎 Hanzo 機車，或下車走路；LAZARUS 夜店今晚只放名單上的人，要先到 7 St 的 AFTERGLOW 酒吧找 Juno 拿火柴盒，再回去說服門口的 Marlo。

畫面方向參考 @Ainthropos 的 Three.js 雨夜城市影片：紅磚與石材立面、濕地上的霓虹倒影、霧與路燈光錐、亮著窗的店面、成排車流與撐傘行人，HUD 有地名、時鐘與小地圖。

## 指令

```bash
npm run build    # 打包成 ../../web/260-neon-nightcity.html（--dev 不壓縮）
npm test         # tools/accept.mjs：1440×900 走完整段任務、開車、地圖，390×844 觸控版；SHOT_DIR=… 會存截圖
npm run thumb    # tools/thumb.mjs → ../../thumbs/260.jpg；THUMB="車 dx,dz,車 yaw,相機 yaw,pitch,遠近" 可調構圖
npm run assets   # 用 Blender 重建 blender/out/*.glb（需要 Blender 5.x）
```

`node_modules` 連到 `../201-coral-cove/node_modules`（three 0.186.0、esbuild、playwright-core）。

## 操作

| 按鍵 | 開車 | 走路 |
| :-- | :-- | :-- |
| W A S D／方向鍵 | 油門、煞車倒車、轉向 | 移動 |
| Shift | 氮氣 | 跑步 |
| Space | 手煞車甩尾 | |
| F | 停穩後下車 | 靠近車輛時上車 |
| E | 停在 CHROME WORKS 門口時換塗裝 | 對話、進出場館、點酒 |
| G | | 跳舞（舞池上跳滿 5 秒完成任務） |
| V | | 把 Kestrel 叫到最近的車道 |
| C | 切換相機遠近 | 同左 |
| M／Esc | 大地圖與傳送 | 同左 |
| 1–4 | 傳送：LAZARUS 門口、舞池、AFTERGLOW、CHROME WORKS | 同左 |
| 滑鼠 | 點畫面鎖定游標環顧，沒鎖定時拖曳 | 同左 |

手機顯示左下搖桿與六顆按鈕，拖曳畫面環顧。

## 結構

原始碼在 `src/parts/`，打包時依檔名順序串成同一個模組（共用頂層變數）：

| 檔案 | 內容 |
| :-- | :-- |
| `00-core.js` | renderer、城市尺寸常數、共用 uniform `U`、GLSL 函式庫（路燈格、點光、霧、環境反射）、uber 材質、`Kit` 幾何合併 |
| `10-city.js` | 街區與地塊、立面 shader（磚、石、玻璃帷幕、窗內房間、店面、鐵捲門塗鴉）、道路與人行道 shader（標線、積水、漣漪、平面反射） |
| `20-props.js` | 路燈與光錐、紅綠燈、街道設施、行道樹、施工區、招牌字圖集（店招、立式招牌、廣告牌）、全息頭像、燈串、蒸氣、雨與天空 |
| `30-vehicles.js` | 程式建模的 Kestrel、計程車、房車、警車、貨車、Hanzo；車道圖、號誌停等、跟車與車輛物理 |
| `40-people.js` | 11 根骨頭在 vertex shader 裡程序動畫的人物（走、跑、三種舞、坐、調酒、撐傘、DJ…），行人、排隊人龍與玩家 |
| `50-assets.js` | 解開內嵌 GLB（`interior_props`、`street_props`），烘成 `Kit` 幾何 |
| `60-venues.js` | 三座場館門面、夜店與酒吧室內場景、任務、對話、進出場館 |
| `70-render.js` | 反射相機、MSAA 半浮點渲染目標、5 階泛光、動態模糊、色散、ACES、調色、顆粒、動態解析度 |
| `80-audio.js` | WebAudio：雨聲、城市低頻、引擎、甩尾、124 BPM 夜店鼓組（拍點驅動舞步與燈光）、酒吧 lo-fi、喇叭、警笛、雷聲 |
| `90-hud.js` | 羅盤與街名、時鐘、小地圖、大地圖與傳送、目標標記、時速表 |
| `99-main.js` | 輸入、相機（防穿牆、遮擋物抖動淡出）、每幀挑燈、天氣、主迴圈、`window.__nc` |

`blender/vehicles.py`、`blender/characters.py` 是舊版用的模型，現在車輛與人物都由程式建模，打包時不內嵌。

## 測試 API

`window.__nc`：`start()`、`tp(x, z, yaw)`、`drive('kestrel'|'hanzo')`、`walk()`、`enter('club'|'bar')`、`exit()`、`look(yaw, pitch, far)`、`setQuest(n)`、`talk.marlo()`／`talk.juno()`、`pick(n)`（選對話選項）、`ctx()`（目前的互動提示）、`spots`（Marlo、場館門口、Juno、舞池、改裝廠的座標）、`rain(v)`、`flash()`、`livery()`、`getStats()`。

## 已知限制

- 無頭 Chrome（Metal）約 120 fps、130 個 draw call、190 萬個三角形；低階手機會自動降低點光數量與解析度。
- 車流是固定車道圖上的跟車模型，不會變換車道；車輛之間只有簡單的圓形碰撞。
- 城市只有 5×5 個街區，邊緣是一圈遠景剪影。
