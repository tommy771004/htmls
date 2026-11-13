# 280 絕命免運費 · CANCEL ANYTIME

依使用者的 GDD（`~/Downloads/3_rpg_1_10.md`，美式搞怪 3D 回合制戰術 RPG、10 關）做的原創作品。Three.js r186 全程序建模＋esbuild 打包成單檔 `web/280-cancel-anytime.html`（commit 打包後的檔案）。

## 指令

```bash
npm run build            # src/ → ../../web/280-cancel-anytime.html（--dev 不壓縮）；平行開發用 `node tools/build.mjs --out ../../web/_wip280-X.html` 輸出到別的檔名，事後刪掉
npm test                 # node:test，規則引擎（test/rules.test.mjs）
node tools/sim.mjs 40 all standard   # 無頭機器人把 10 關各打 N 場：勝率、回合、救護車、例外
node tools/accept.mjs 1-10           # 無頭 Chrome 兩種尺寸 ?auto=1 打完各關；需先在 repo 根目錄 python3 -m http.server 8280（--page _wip280-X.html 測別的檔、--shots 目錄）
node tools/play.mjs                  # 手動模式驗收：真的用滑鼠／觸控點擊走完第 1 關（引導→評分→戰報圖→紀錄→每日挑戰），兩種尺寸
node tools/padtest.mjs               # 手把驗收（把 navigator.getGamepads 換成假的；實體手把沒測過）
node tools/audiotest.mjs             # 離線渲染每個音效與角色碎念量峰值／RMS、印出被吃掉的例外，並量配樂強度 0.3→1.0 的差距
node tools/shot.mjs <url> <png> [寬] [高] [等待毫秒] [截圖前執行的 JS]   # 單張截圖＋印出 console.error（寬 <500 當手機）
node tools/shots.mjs / film.mjs / sheet.mjs   # 各關批次截圖＋三角形數與 draw call／連拍／把多張圖拼成一張對照表
```

`tools/preview.html?set=units|props|scenery` 是模型預覽頁（經 HTTP 開）。頁面網址參數：`?lv=N` 直接進第 N 關（自動補齊前面的戰利品與晶片）、`&diff=story|standard|hard`、`&auto=1&speed=4` 機器人自動打、`&vdbg=1` 開 `window.__view`、`&nomerge=1` 關掉模型靜態合併（除錯）、`&q=high|med|low` 指定畫質、`?daily=1` 直接進每日挑戰。`accept.mjs`／`play.mjs`／`padtest.mjs` 都有 `--page _wip280-X.html`。

## 架構

- `src/data.js` 純資料（英雄、敵人、道具、地表、關卡、戰利品）。數值照 GDD 轉錄，不要改；難度用 `rules.js` 的 `DIFFS` 縮放敵人。
- `src/rules.js` 純規則引擎（無 DOM / Three，node 可直接跑）。所有狀態立即改在 state，演出事件推進 `state.fx`，畫面層依序播放。對外 API 與 fx 事件種類被 view/ui/main/bot 依賴，改名要一起改。
- `src/bot.js` 期望傷害貪婪機器人，sim 與 `?auto=1` 共用。
- `src/view.js` 棋盤（InstancedMesh 地塊）、單位、道具、地表、高亮、鏡頭、粒子、事件演出；`src/ui.js` DOM 介面；`src/main.js` 流程與輸入。
- `src/post.js` 後製管線（HDR 緩衝、bloom、景深、色調映射；畫質 `high`／`med`／`low`，`V.setQuality`）。場景畫在**線性** HDR 緩衝上：自訂 `ShaderMaterial` 沒有 colorspace include 的要過 `rawOut()`，要發光進 bloom 的用 `glowify()` 或 `rawOut(m, true)`。
- `src/meta.js` 評分、成就、每日挑戰、戰報圖、第 1 關引導、手把輪詢。只讀狀態與演出事件（`M.observe(evs, s)`），不改規則與擲骰；紀錄存 `cancel-anytime-meta`，戰役存檔 `cancel-anytime-v1` 的格式不要動。自動模式（`?auto=1`）不寫紀錄、不解鎖成就。
- **演出鏡頭**：`view.js` 的 `setShot()`／`endShot()`／`cancelShot()`，`shotOK()` 決定要不要啟動（玩家動過鏡頭、速度 ≥3、reduced-motion、設定關閉時不啟動）。新演出要用 `setShot`，不要直接寫 camera。
- 美術：`src/kit.js`（三階 toon 材質＋法線外擴描邊）、`src/models/{heroes,foes1,foes2}.js`、`src/props.js`（道具與地表貼片）、`src/scenery.js`（各關佈景與配色）；`src/audio.js` WebAudio 合成（`SFX.play`／`music`／`intensity`／`duck`／`voice`；`tools/build.mjs` 的 audio stub 要跟著 API 一起改）。
- **材質規則**：toon 材質一律經 `toonify()`（`toon()`／`part()` 已內建；自己 new 的 `MeshToonMaterial` 要包一層），外觀參數走共用 uniform `LOOK`，每關在 `scenery.js` 的 `themeStyle` 給 `shade/rim/rimK/spec/ink/bloom/vig`，由 `view.loadLevel` 套 `setLook()`。`Material.clone()` 不會帶 `onBeforeCompile`，要用 `cloneMat()`。圓柱、球、圓角的分段數用 `seg(n)`（跟著 `setDetail()` 縮放，觸控裝置較低）。
- **模型契約**（`buildUnit(key)`）：腳底 y=0、面向 +Z、`userData.height` 頭頂高度；`userData.parts` 可有 `body, head, armL/R, forearmL/R, legL/R, wingL/R, tail`（樞紐在關節）、`weapon`（在出手那隻手臂底下）、`eyes[]`（以眼球中心縮放 y 眨眼）、`mouth`、`extra[]`（擺動件，樞紐在根部）。view 存下靜止姿勢、每幀以偏移量寫入這些部位的 rotation/position（body 與 eyes/mouth 的 scale、extra 的 rotation x/z），模型自己的 `userData.anim(t, dt)` 在之後呼叫，只能動契約以外的子物件、不可改共用材質。事件程式不可直接寫 model 的 transform，改設 view 的單位紀錄（`rec.sc`、`rec.sq` 等）。
- **合併與效能**：英雄與第 1–5 關敵人在 `models.js` 的 `autoBake` 把同一骨架群組內不會動的網格併成頂點色網格＋一個描邊（先擾動契約部位並掃過 anim 找出會動的物件，不併）；第 6–10 關在 `foes2.js` 自己合併。view 只讓夠大的不透明網格投影。新增會動的小零件時，要嘛放進 parts，要嘛讓 anim 在掃描時就會改到它。佈景、道具、地表的 `userData.anim` 由 view 走訪收集後每幀呼叫。
- `THREE` 是全域（template 先 import three 再跑 bundle），各模組**不可在頂層使用 THREE**。

## 規則

- 原創 IP：標題、關卡、角色名都已去掉 GDD 裡指向《博德之門 3》、TMNT、真實人物的名稱與「致敬原版」標註，不要加回去；不要畫真實品牌標誌。頁面上的「原創作品，與任何遊戲、品牌、餐廳或真實人物無關」要保留。
- 改了 `src/` 一定要 `npm run build`，再跑 `npm test`、`sim.mjs`、`accept.mjs`；動到介面流程、引導、評分或觸控時加跑 `play.mjs`，動到聲音加跑 `audiotest.mjs`，動到手把加跑 `padtest.mjs`。`accept.mjs` 的自動模式不會開聲音、不會走到引導與評分的互動，那些只有後面三支測得到。
- 介面保持簡潔：一個元件一層框（`template.html` 樣式最後的「介面減量」區塊），不要加回框中框、裝飾性標語或和別處重複的說明文字；細節放提示卡或操作說明。
- 聲音全部即時合成、不載入音檔（目錄文案 `index.html`／`README.md`／`llms.txt` 這樣寫）；角色「語音」是合成音節，不要改口說成真的語音。
- 網站內容是繁體中文；英文版（中英切換）還沒做，要做之前先問使用者。
