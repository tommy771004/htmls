# 277 墨嶺行 · Ink Ridge

水墨風第三人稱 3D 平台解謎。`npm run build` 把 `src/`（含 three 0.186.0）打包成單檔 `web/277-ink-ridge.html`；網站沒有 build step，改了 `src/` 要重新 build 並把產出一起 commit。

## 進度與規格

- 使用者的提示詞分成 A–F 步驟。`SPEC.md` 是從參考影片截圖量出來的美術與玩法規格（之後每一關都照它）。目前有兩關：第一關「試劍崖」、第二關「寒潭渡」（`?lv=2`，§7-2）。兩關都是原創佈局，**使用者給概念圖後要照圖重蓋**（每關最多 8 張）；後段才加敵人與戰鬥。
- 參考影片截圖在 `ref/`。影片只用來定畫風、世界觀與主角外觀；關卡與謎題是原創的，不要照抄影片的關卡。
- 數值（跑速、跳躍、抓邊範圍、鏡頭距離）以 `SPEC.md` §3、§5 為準；改了程式的 `P`（`src/player.js`）或鏡頭參數，要同步改 SPEC。

## 指令

```bash
npm run build        # 打包（minify）→ ../../web/277-ink-ridge.html
npm run dev          # 不 minify
npm test             # tools/accept.mjs（第一關）＋ tools/accept2.mjs（第二關，含失敗路徑與防繞過的回歸測試），都是兩種尺寸的無頭 Chrome 驗收
node tools/play.mjs  # 實時按鍵探測（抓邊、橫移、吊台壓人、拖曳鏡頭等），輸出 dist/play-*.png
node tools/shot.mjs  # 各區段截圖；node tools/thumb.mjs 拍縮圖候選
```

`node_modules` 連到 `../201-coral-cove/node_modules`（three、esbuild、playwright-core）。瀏覽器用 ms-playwright 快取或系統 Chrome（見 `tools/lib.mjs`）。

## 架構（`src/`）

| 檔案 | 內容 |
| --- | --- |
| `main.js` | 渲染器、燈光、固定步長迴圈（1/60，畫面幀 dt 會拆成多個子步）、HUD、檢查點／墜落／過關、素材插槽、測試 API |
| `kit.js` | 關卡共用：岩塊與石柱幾何（分段盒＋3D 向量雜訊，頂面保持平）、松、石燈籠、鐘架、鳥居，以及 `makeBuilder()`（碰撞＋幾何收集、墨流、霧團、靜態合併） |
| `levels/l1.js` | 第一關：岩體、岩縫、鐘、吊台與配重、山門、提示、區段 |
| `levels/l2.js` | 第二關：木筏、橫木、推石、機關板與閘門、會碎的冰縫、雪塔；`env` 決定霧、天空、燈光、落雪、水 |
| `physics.js` | 碰撞世界：軸對齊盒、直立圓柱、岩縫（a→b 邊＋朝外法線 n，`top` 代表可翻上去） |
| `player.js` | 角色控制器（ground／air／hang／hop／mantle／dead） |
| `hero.js` | 隱藏的程序骨架（巢狀 Group，面向本地 +Z，左手在 +X）與程序動畫、布料碰撞球；`useModel()` 把模型骨頭接上去，含手指、手腕、岩緣 IK（換手、翻上） |
| `cloth.js` | Verlet 布料（衣襬是 16×5 的筒、圍巾前後兩條 2×N），網格在世界座標 |
| `camera.js` | 第三人稱鏡頭；撞牆只對大碰撞盒做射線測試（不掃三角形） |
| `ink.js` | `inkMaterial()`：MeshToonMaterial＋onBeforeCompile 注入紙紋、垂直墨痕、墨斑、`aTop` 墨流、裂紋與石板縫；描線外殼；岩縫下的墨流貼圖 |
| `post.js` | 後製：深度邊緣描線（抖動）、紙紋、暗角、去飽和、墨暈轉場（`uFade`） |
| `sky.js` | 宣紙天空與水洗（色可調）、三層山稜；兩層雲海平面跟著鏡頭移動；黑水 `makeWater`、落雪 `makeSnow` |

## 坑

- `inkMaterial()`／`outlineMaterial()` 依參數快取、同參數共用同一個材質；**不要直接改回傳材質的屬性**（例如 `.side`），要改就用參數傳（`side: THREE.DoubleSide`）。帶 `map` 的不快取。
- 關卡的 `b.bake()` 會把這次加進場景的靜態網格依（材質、投影設定）合併成少數網格（draw call 從 ~730 降到 ~200）。會動、會換色或已經合併過的物件要設 `userData.noBake = true`（鐘的樞紐、門扇、吊台、燈籠窗、岩體）。新增會動的道具時記得標。
- 圍巾布料：碰撞球比衣襬大一圈（`scarfCol`），另有 `gScale`、`upDrag`、`maxRise`，防止跳躍頂點時整條豎起、穿過斗笠。風只給環境風，不要再加角色速度（Verlet 的慣性已經算了）。

- `inkMaterial({ drip })` 需要幾何帶 `aTop` 屬性（該岩塊頂面的世界高度）；`rockGeo`、`cylGeo` 會自動加。合併網格時所有幾何的屬性要一致（`rockGeo` 刪了 uv）。
- MeshBasicMaterial 的頂點著色器沒有 `objectNormal`，描線外殼要用 `normal`。
- three r186 沒有 `PCFSoftShadowMap`，用 `PCFShadowMap`。
- `renderer.info.autoReset = false`，在 `render()` 開頭手動 reset，否則後製那一次 render 會把計數蓋掉。
- 移動平台：`World.moveBox()` 會記錄 `delta`，站在上面的角色在 `groundAir()` 開頭加上這個位移。吊台下降時若下方有人會停住（`levels/l1.js` 的 `update()`）。起跳與走下平台時會繼承平台的水平速度。
- 岩縫判定：`tryGrab()` 要手的高度（岩縫 y − 腳底）落在 1.2～2.15 m、離壁 0.75 m 內、沒有正在遠離壁面，而且掛的位置不能卡進其他碰撞體（`hangFree`）。新增岩縫時注意掛點不要和隔壁石板重疊。
- 關卡介面：`buildLevel(scene)` 回傳 `world, update(dt,t,pp,ps), strike, reset, lanterns, hints, section, finish, start, kill(p,cp), debug()`，選用 `push(hit,dt)`（`c.block` 非空的碰撞體）、`onRespawn(cp)`、`env`、`meta`（開場與過關文字）。`level.sfx` 由 `main.js` 塞入，關卡只能在執行時用。
- 檢查點：`lantern()` 回傳的物件設 `line = true` 後，走過它的 z 就算點亮；`spawn` 可改。提示 `sticky` 不會逾時、`urgent` 會插隊。
- `#include` 要獨立一行，和程式寫同一行會編譯失敗，而且只有 console.error（`accept` 會抓）。
- 隱藏碰撞體時（`col.on=false`）若物件還會動，碰撞盒也要一起 `moveBox`，否則之後用相對位移回原位會差一段（石塊掉落踩過這個坑）。
- 測試若用 `__ink.manual(true)` 大量步進，實時的 `frameMs` 會被拉高，量效能要在實時模式下量。

## 測試 API：`window.__ink`

`start()`、`state()`（mode、pos、vel、ledge 名稱、section、falls、checkpoint、frameMs、draws、tris、clothOK、cam，加上關卡的 `debug()`：第一關 lift、gate、bells，第二關 raft、gateOpen、blocks、ice）、`manual(on)`、`input({mx,my,jump,jumpHeld,strike})`＋`step(n)`（確定性步進）、`teleport(x,y,z,yaw)`、`setCamYaw(y)`（0＝朝 −z）、`reset()`、`lanterns()`。

## 主角模型

- 來源 `assets/_hero-src.glb`（Sketchfab：wuxia chinese swordman，xiamilisite，CC BY 4.0；底線開頭 build 會略過），`node tools/rig_hero.mjs` 產出 `assets/hero.glb`：烘變換、1.75 m、依網格切片量關節、算權重、連通區分出手指（拇指＋三指，每指三節）、放大斗笠、貼圖轉 JPEG。40 根骨頭，靜止旋轉全是單位旋轉。改了工具要重跑再 `npm run build`。
- 頁面開場卡片與 README 的作者標示要保留（CC BY）。
- 隱藏的程序骨架比例會在 `useModel()` 改成模型的，布料、刀、葫蘆都掛在它上面。手勢數值表在 `SPEC.md` §2。
- 手臂 IK 的目標是手腕；`edgePt()` 決定手腕放在岩緣的哪裡。`node tools/hand-shots.mjs [html]` 輸出手勢特寫，`node tools/hero-compare.mjs <html> <前綴>` 輸出比較圖。`__ink.heroDbg()` 回傳 IK 誤差、指節座標、衣襬最高點。
- `__ink.step(n)` 一次只 render 一次，鏡頭方向在 render 才更新：測移動方向要逐格 `step(1)`，否則會走歪。

## 素材插槽

- `assets/scene.glb`（Blender 重建場景，使用者還沒提供）：加進場景並換成水墨材質；`col_*` 物件當碰撞盒（隱藏），`ledge_*` 當岩縫（名稱含 `top` 代表可翻上去，法線取物件本地 +Z）。目前是「疊加」在程式自建的關卡上，真的要換場景時要把 `levels/` 對應段落拿掉。**這段程式還沒用真檔案測過。**
