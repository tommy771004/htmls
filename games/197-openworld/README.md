# OpenWorld 求生

Three.js 第一人稱開放世界求生場景，需求見 `Readme.txt`。作品集的第 197 件「湖畔求生 · OPENWORLD」，網址 <https://htmls-ruddy.vercel.app/web/197-openworld.html>。

## 執行

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # 打包成單檔 ../../web/197-openworld.html（模型與貼圖執行時從 ../assets/197/ 讀取）
npm run assets     # 下載可選的外部資產（鳥、照片貼圖、Poly Haven 掃描模型），來源與授權見 CREDITS.md
npm run models     # 重新產生 assets/197/models 下由程式建模的 GLB
npm run characters # 下載 Quaternius 素材包並重建 NPC 與馬（需要 Blender 與 Python 3）
```

模型與貼圖放在網站的 `assets/197/`（約 54 MB），開發時 Vite 把它當 publicDir，不另外複製一份。
打包後的頁面要透過網站伺服器開啟（例如 repo 根目錄的 `npm start`），直接用 file:// 開會讀不到素材。

## 操作

| 按鍵 | 功能 |
|---|---|
| W A S D／滑鼠 | 移動／視角 |
| Shift | 奔跑、快游（耗體力） |
| Space | 跳躍；水中上浮；車上為手煞車 |
| C | 水中下潛 |
| E | 互動：撿拾、上下車／船、睡覺、和 NPC 說話 |
| 1 – 5 | 快捷列：裝備武器／使用物品 |
| Tab | 背包（左鍵裝備／使用、右鍵丟棄、拖曳換位） |
| 滑鼠左鍵／R／G | 攻擊或射擊／換彈／丟下手上物品 |
| V | 載具第三人稱視角 |
| F／L | 手電筒／車頭燈 |
| M | 靜音 |
| T | 切換天氣（晴 → 陰 → 雨 → 霧） |
| [ ] | 時間 −／＋ 1 小時 |
| P | 畫質 低／中／高 |
| Esc／F1 | 暫停並顯示操作說明 |

## 結構

```
src/
  main.js              Game：初始化、主迴圈、互動、畫質與動態解析度
  core/   noise.js     seed 亂數、simplex noise、數學小工具
          input.js     鍵盤／滑鼠／pointer lock
          audio.js     Web Audio 即時合成音效（不需音檔）
          merge.js     合併同材質的靜態零件，降低 draw call
          pipeline.js  後製管線（HDR、bloom、FXAA／MSAA、調色）與天空環境光照（IBL）
  world/  terrain.js   heightmap 地形（島嶼＋湖盆＋營地）、高度查詢、地形射線
          colliders.js 圓柱／有向方盒碰撞（spatial hash）
          environment.js 物理天空、日夜、天氣狀態機、霧、星空、月亮、雨
          water.js     平面反射水面
          grass.js     instanced 草（風、LOD 抽稀、玩家推草）
          scatter.js   樹、石頭與林地的樹樁、倒木、蕨叢（分塊 InstancedMesh＋近遠 LOD）
          camp.js      營火（火焰、火星、煙）與原木座椅
          props.js     帳篷、木箱、木桶、柴堆、吊鍋、路牌、碼頭
          textures.js  程序生成貼圖（木紋、帆布、月面、柔邊光點）
          surface.js   地表與樹皮的 PBR 貼圖組（albedo＋法線；有照片就用照片）；tintToMean 把照片平均色對到目標色
          foliage.js   枝葉卡片樹：葉片貼圖與樹／灌木的幾何生成
  game/   assets.js    GLB 載入、自動縮放、錨點 ← 換模型改這裡
          player.js    走／跑／跳／游泳、生命／體力／飽食／氧氣
          vehicles.js  車（四輪貼地）與船（划槳）
          items.js     物品定義、背包、地上的可撿拾物
          weapons.js   第一人稱手部與武器、射擊／揮砍、標靶
          npc.js       人形骨架與三個 NPC（營地、碼頭釣客、繞湖健行）
          wildlife.js  鹿、兔子（可狩獵）的行為，鳥群、螢火蟲、魚躍漣漪
          fauna.js     動物造型（放樣曲面）與外部動物模型（飛鳥、野馬群）
  ui/     hud.js/.css  FPS、狀態、快捷列、背包、提示
tools/make-models.mjs  產生佔位 GLB
tools/fetch-polyhaven.mjs  下載 Poly Haven 掃描模型並減面（近景＋遠景兩個 GLB）
tools/fetch-quaternius.py  下載 Quaternius 素材包到 .cache/
tools/build-characters.py  （Blender）組成三個 NPC
tools/build-anims.mjs      挑出 NPC 用的動畫
tools/build-animals.py     （Blender）動物 FBX 轉 GLB
../../assets/197/models/*.glb    船、床、刀、槍、手、鳥
../../assets/197/models/q/*.glb  NPC、NPC 動畫、馬（Quaternius，CC0）
../../assets/197/models/ph/*.glb 岩石、樹樁、倒木、蕨類（Poly Haven，CC0）
```

## 更換 GLB 模型

用同檔名覆蓋 `assets/197/models/` 下的檔案即可（支援 meshopt 壓縮；Draco 只在開發伺服器可用，網頁版沒有附解碼器）。
原檔用什麼單位建模都沒關係，載入時會依 `src/game/assets.js` 的 `MODELS` 正規化：

- `size`：縮放後最長邊的公尺數
- `anchor`：原點落在包圍盒的比例位置；地面物件用底部中心 `[0.5, 0, 0.5]`，手持物件用握把位置
- `rotation`：把模型轉成「前方 = −Z、上方 = +Y」所需的角度

船與床的碰撞盒直接取正規化後的包圍盒尺寸。檔案載入失敗時會以洋紅色方塊代替並在 console 警告。
啟動時 console 會印出每個模型的縮放倍率與最終尺寸。

目前附的 GLB 全部是 `tools/make-models.mjs` 以程式建模產生的（沒有外部美術資產），並刻意用不同單位（公分、公釐…）建模以驗證自動縮放。

## 畫面

- **管線**：場景以線性 HDR 畫進 half-float buffer，再做 bloom → ACES tone mapping → 調色／暗角／顆粒。
- **光照**：太陽／月亮方向光＋半球光；天空每隔數秒烘成環境貼圖給 PBR 材質用。
- **地形**：草地（照片）、岩石、沙、泥土依權重混合，各有法線貼圖；岩石用多平面投影避免陡坡拉伸；水線以下變濕、淺水有焦散。
- **植被**：樹是真實樹幹＋葉片卡，陰影依葉形鏤空；草會受樹的陰影、逆光透亮。
- **人物與動物**：NPC 是 Quaternius 的 CC0 卡通人物（頭＋服裝＋髮型組成，同一副骨架直接播動畫庫的待機／說話／走／跑／坐），釣魚的手勢在待機之上擺骨頭；馬是 Quaternius 的低多邊形模型，鳥是 three.js 範例模型，鹿與兔是程式放樣；缺檔時退回程序生成的版本。

外部資產都是**可選的**：沒跑 `npm run assets` 專案仍可執行，只是上述項目會退回程序版本。

## 效能

- 草：單一 shader 的 instanced 葉片，依距離抽稀並加寬；只在玩家周圍分格產生（每 frame 最多 2 格）。
- 樹石：依 150 m 區塊切成多個 InstancedMesh，才能被 frustum culling；185 m 外的區塊改用低面數版本（實測樹是最大的效能開銷）。
- 車、道具、NPC、動物與 GLB 模型的靜態零件會依材質合併（`core/merge.js`）。
- 水面反射會把場景再畫一次：草、灌木、石頭、NPC、動物、雨、星星、手部放在獨立 layer，不進反射；低畫質改為隔幀更新。
- 畫質分級：低 = 無抗鋸齒、無 bloom；中 = FXAA＋半解析度 bloom；高 = 4× MSAA＋bloom。
- 實測（Intel UHD 630 內顯、1280×720）：低畫質約 88 FPS、中畫質約 50–55 FPS（全解析度）、高畫質需降到 0.6× 解析度才有約 44 FPS，高畫質是給獨立顯卡用的。
- 動態解析度：FPS 低於 48 時逐步降低渲染解析度（最低 0.6×），有餘裕再升回。
- 左上角顯示 FPS、frame time、draw call、三角形數、草葉數與目前解析度倍率。

## 開發用

網址加 `?debug` 會略過開始畫面與 pointer lock（自動化測試用），`window.__game` 可在 console 直接操作，例如
`__game.env.time = 22`、`__game.env.setWeather('rain')`、`__game.player.teleport(x, z)`。
