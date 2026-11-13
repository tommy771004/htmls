# 283 午夜退房 · LATE CHECKOUT

夜間廢棄飯店的 5v5 回合制第一人稱射擊。**不載入任何外部模型、貼圖、動畫或音檔**：幾何、材質貼圖、光照烘焙、角色動畫、音效全部在瀏覽器裡用程式生成。Three.js 0.186.0 由 esbuild 打包進單檔 `web/283-late-checkout.html`（網站沒有 build step，改了 `src/` 要重新 build 並把產出一起 commit）。細節與調校紀錄在 `README.md`。

## 指令

```bash
npm run build      # src/entry.js + src/template.html → ../../web/283-late-checkout.html（minify）
npm run dev        # 同上但不 minify
npm test           # node:test：地圖連通、門、射線、零件數值、整場 bot 對戰、家具／燈的破壞與復原
npm run accept     # 無頭 Chrome 驗收打包後的單檔（1440×900 實際操作、390×844 觀戰，量 FPS 的 6 秒內會打滅一盞燈、打壞一件家具、打倒一個人並檢查下一回合復原；另查四種視窗的版面與 Retina 效能；自帶靜態伺服器）
node tools/sim.mjs 6 normal      # 跑 N 場全 bot 對戰看回合長度／勝率
node tools/ascii.mjs             # 印出導航格
node tools/shot.mjs "?seed=7" out.png 1440 900 2500 --pre "js" --seq "js;;js"   # 截圖（需先在 repo 根目錄開 python3 -m http.server 8283）
```

`node_modules` 是連到 `../201-coral-cove/node_modules` 的符號連結（esbuild、playwright-core、three）。

## 架構

- `src/sim/`：**純邏輯，不依賴 THREE／DOM**，node 可直接跑。`map.js`（X 軸鏡射的飯店：區域、牆、門窗、家具、燈、出生點、路線）、`world.js`（AABB 射線、碰撞、0.5 m 導航格與 A*、掩體點）、`game.js`（規則、武器、`PARTS` 槍匠零件、bot AI、`game.fx` 演出事件佇列）。
- `src/gfx/`：`textures.js`（Canvas 程式貼圖）、`builder.js`（合併幾何＋逐頂點烘焙光 `Lights`／`BAKE_U`，每盞燈可獨立開關）、`props.js`／`hotel.js`（家具與整棟飯店）、`post.js`（HDR：燈暈體積霧 → 泛光 → ACES／調色／暗角／顆粒／瞄準鏡遮罩）、`weapon.js`（第一人稱槍模與低模槍）、`soldier.js`（13 根骨頭的 SkinnedMesh 角色：兩節 IK 程序動畫＋倒地的 Verlet 布娃娃）、`destroy.js`（`Wreck`：藏起被打壞的家具、分幀重烘陰影、回合開始復原；`Debris`：碎片）、`fx.js`（彈孔、粒子、曳光、彈殼、槍口火光）。
- `src/audio.js`：Web Audio 合成全部音效。`src/ui.js`：DOM 介面。`src/main.js`：主迴圈、輸入、鏡頭、把 `game.fx` 接到特效／音效／介面。

## 規則與坑

- 朝向慣例：`forward = (-sin yaw, 0, -cos yaw)`；隊伍 0＝Vanguard（西側酒吧出生）、1＝Ember（東側餐廳）。
- **場景燈全部是烘焙的，但每盞燈可以獨立變暗**：頂點屬性 `bake`（固定底光）＋`bakeI`／`bakeW`（影響最大的 4 盞燈與權重），亮度在 shader 查 `BAKE_U.uLamp[]`（顏色×狀態×閃爍，`Lights.update` 每幀寫入）；燈罩／燈泡用 `lampPatch` 讀 `uLampS[]`。燈的狀態只有一個來源 `map.lamps[i].s`（0–1），新增任何會發光的東西（自發光、霧、探針、霓虹）都要讀 `lights.S`，不要另存一份。即時光源只有槍燈 SpotLight、餘光 PointLight 與 3 盞共用的槍口閃光 PointLight。**不要切換燈的 `visible` 或在對戰中增減燈**：燈數一變所有材質都要重編 shader，會卡一大幀；關燈用 `intensity = 0`，槍燈關掉時另把 `renderer.shadowMap.autoUpdate` 設成 false。
- **破壞**：規則在 `sim/game.js`（`_itemHit`／`_lampHit`，狀態記在 `map.items[i].dead`、`map.lamps[i].s`、`world.dead[]`，`startRound` 的 `resetScene()` 全部復原——`map`／`world` 是每一場共用的，狀態不能留到下一回合）。畫面在 `main.js` 收 `fx` 的 `'break'`／`'lamp'` 事件：`wreck.breakItem()` 的隱藏與重烘**快轉（`fast`）時也要做**，碎片與聲音才可以省。家具要能被打壞，建模時必須包在 `B.owner = 'i' + id` 裡（`hotel.js`），`Wreck.hide` 才找得到它的索引範圍。
- **角色**：骨頭順序固定（`BN`），`Soldier` 建構時先 `updateMatrixWorld` 再建 `Skeleton`。活著時每幀由程序動畫直接寫骨頭；`e.alive` 變 false 的那一幀 `_ragStart()` 從當下骨頭位置取 13 個點，之後 `group` 歸零、骨頭直接寫世界座標，槍改掛到 `group` 自己掉落；復活時 `_ragEnd()` 把槍掛回胸腔。布娃娃與碎片只用 `Math.random`、不碰 `game.rng`，不影響模擬的可重現性。
- 槍的零件改形狀時，`rifleParts().info` 的錨點（`sightY`、`eye`、`muzzleZ`、`eject`、`light`、`hg`、`ret`）要跟著對，瞄具中心線維持在 x = 0，否則開鏡會歪。第三人稱的 `rifleLow` 用同一份零件併成一個幾何。
- 槍模畫在另一個 scene／camera（`ViewModel`），在同一個 HDR render target 上 `clearDepth()` 後疊上去；它的光由 `setProbe()` 依相機位置的探針顏色決定。
- 體積霧是後製的解析解：每盞燈只積分視線穿過燈周圍 `uRadius` 公尺球內的那一段。把 `uScatter` 調大或拿掉半徑限制，走廊會糊成一片。
- three 0.186：`onBeforeCompile` 裡的 `vColor` 是 vec4；沒有 `PCFSoftShadowMap`；自己做後製時 `renderer.info.autoReset = false` 並手動 `reset()`；`renderer.autoClear = false`（`Post.render` 會自己清）。
- 暫停走 `pointerlockchange`；`requestPointerLock()` 可能 reject（按 ESC 後約一秒內），`lock()` 會自動重試一次。蹲下是 C（不用 Ctrl，避免 Ctrl+W 關分頁）。
- `window.__lc` 是測試掛點：`ready`、`info()`、`start({auto})`、`openPause()`、`resume()`、`panel(name)`、`setPart(slot,id)`、`step(秒)`（快轉模擬）、`cam=[x,y,z,yaw°,pitch°]`（自由鏡頭）、`dbg`（renderer、post、fx、vm、輸入狀態 `K`／`M`、`map`、`world`、`lights`、`wreck`、`game`、`soldiers`）。網址參數：`?auto=1`（觀戰）、`seed`、`team`、`diff`、`quality`、`fps=1`、`cam`。
- 介面原則（使用者要求）：**不加外框、不放非必要的字、所有版面自適應**。HUD 只有數字、細線與隊色；選單是純文字；尺寸一律用 `template.html` 開頭的 `--u`（字級單位，隨視窗短邊縮放）與 `--pad`（貼邊距離）推出，直式螢幕靠 `@media (max-aspect-ratio:1/1)` 改成上下堆疊。新增介面元素時不要寫死 px、不要加邊框卡片、不要加說明文字；`npm run accept` 會在六種視窗尺寸檢查元素都在畫面內且互不重疊。隊色青綠／橘，不要加紫色。
