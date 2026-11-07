# 赭線 · OCHRE LINE（作品 278）規格與模組合約

靈感來源：@0xKense1 的 AI 做遊戲影片（`ref/*.jpg`，色彩量測 `ref/targets.json`）。使用者要求：寫實 PBR、Babylon.js WebGPU、Havok、thin instance、零 GC。

## 原創界線（硬性）

這是**原創作品**，只借類型玩法（5v5 回合制爆破攻防、買槍經濟）與光影材質語言（曝曬砂岩、暖色反彈光、冷灰藍陰影、高人物對比）。
- 不用 Counter-Strike / CS2 / Valve 的名稱、地圖、武器造型名、角色、HUD 版面、音效、文案。
- 地圖動線從零設計，不得與 Dust / Dust2 / Mirage / Inferno / Nuke / Overpass / Ancient / Anubis 的動線或地標相似（例如「長廊＋中門＋雙門＋車位」組合不可出現）。
- HUD 不描 CS2 或參考影片的版面；只參考「資訊種類」與對比度。
- 武器一律用虛構型號（見下）。隊伍與頁面文字全部原創。頁面保留聲明：「受 @0xKense1 影片啟發的原創作品，與 Valve／Counter-Strike 無關。」

## 世界設定

- 地圖「日晷坊 Sundial Quarter」：地中海／北非風虛構舊城，中央有大型石造日晷廣場當地標。
- 攻方「赤沙 Redsand」，守方「海防 Tidewatch」。HUD 隊色：鏽紅 `#C4552D`、銅綠 `#5FA89A`。
- 炸彈叫「破門裝藥 Breach Charge」；炸點 A、B（紅漆噴字）。

## 單位與座標

公尺。Babylon 預設左手系，x 東、y 上、z 北。玩家身高 1.8、眼高 1.70、蹲高 1.25（蹲姿眼高 1.15）；跑速 5.4 m/s、靜步 2.9、蹲走 1.9、跳高 1.1、掉落傷害無。地圖約 120×120 m，攻方到炸點 18–24 s，守方到炸點 9–13 s。

## 回合規則

先贏 7 回合，每 6 回合換邊（玩家換隊）。買槍期 12 s、回合 105 s、裝藥倒數 40 s、安裝 3.2 s、拆除 10 s（拆彈鉗 5 s）。起始 $800，上限 $16000，勝利 $3250，敗 $1400 起每連敗 +$500 至 $3400，擊殺依武器 $300–900，安裝／拆除 +$300。

## 武器（虛構型號 → 素材）

| id | 名稱 | 模型來源 | 價 | 彈匣/備彈 | 射速 RPM | 傷害(身/頭) |
| knife | K2 戰鬥刀 | Blender 自建 | 0 | - | 左 150 右 60 | 35/55 |
| p9 | P9 手槍（起始） | usp | 0 | 12/36 | 400 半自動 | 30/110 |
| r50 | R50 重型手槍 | usp 換塗裝 | 700 | 7/35 | 240 半自動 | 55/190 |
| v11 | V11 衝鋒槍 | mac-11 | 1200 | 30/120 | 900 | 24/72 |
| s8 | S8 霰彈槍 | 870 | 1800 | 7/28 | 68 泵動 | 21×9/42 |
| ks | KS 短突擊步槍 | aksu | 2700 | 30/90 | 650 | 34/120 |
| ar5 | AR5 突擊步槍 | m4a1 | 3100 | 30/90 | 700 | 31/105 |
| l40 | L40 狙擊槍 | m40a5 | 4750 | 5/20 | 40 栓動 | 110/250 |
| c7 | C7 緊湊手槍 | 原創（`tools/guns/c7.py`） | 300 | 20/80 | 520 半自動 | 26/104 |
| m7 | M7 衝鋒槍 | 原創 | 1500 | 30/120 | 800 | 26/86 |
| b90 | B90 防衛武器 | 原創 | 2350 | 50/100 | 900 | 25/80 |
| t4 | T4 輕型步槍 | 原創 | 2000 | 35/90 | 680 | 27/96 |
| x10 | X10 半自動霰彈槍 | 原創 | 2300 | 7/32 | 240 單發裝填 | 17×6/36 |
| s6 | S6 輕型狙擊槍 | 原創 | 1700 | 10/90 | 54 栓動 | 74/215 |
| n9 | N9 輕機槍 | 原創 | 4700 | 100/200 | 800 | 30/100 |
| frag/smoke/flash | 破片／煙霧／閃光 | m67、smoke_grenade | 300/300/200 | | | |
| armor/helmet/kit | 防彈衣／頭盔／拆彈鉗 | | 650/+350/400 | | | |

## 素材（全部放 `assets/278/`，網頁以相對路徑 `../assets/278/...` 載入；不內嵌）

- `tex/<name>_{a,n,orm}.webp`：albedo、normal（OpenGL Y+）、ORM（R=AO,G=rough,B=metal）。1024（大面積牆地）或 512。
- `sky/env.hdr`（IBL）、`sky/sky.webp`（天空背景，等距柱狀）。
- `models/kit.glb`：城鎮組件，節點名即組件 id（見下）。
- `models/guns.glb`：第一人稱與世界模型共用，節點 `<id>`（單一網格＋單材質或雙材質），以槍口朝 +Z、握把在原點附近、單位公尺。節點 `<id>_muzzle`、`<id>_mag` 為空節點標記。
- `models/arms.glb`：第一人稱手臂（手套＋袖子），每把武器一組靜態姿勢節點 `arms_<id>`。
- `models/soldier.glb`：單一骨架，動畫群組命名 `idle_rifle walk_rifle run_rifle crouch_idle crouch_walk jump hit death_a death_b plant idle_pistol run_pistol ...`，已剝除 uv2+/color，頂點緩衝 ≤ 6（WebGPU 限制 8）。
- 所有素材來源與授權寫入 `games/278-ochre-line/CREDITS.md`。

## 目錄與模組

```
src/main.js           入口：建 engine（WebGPU，失敗退回 WebGL2）→ 載入 → 開始選單
src/core/engine.js    engine/scene/camera/後處理/SnapshotRenderingHelper
src/core/assets.js    載入與進度條
src/core/tmp.js       全域預配置暫存（TMP_VEC3_A…）
src/core/input.js     鍵鼠、pointer lock
src/map/layout.js     地圖資料（純資料，node 可 import）
src/map/build.js      thin instance 建城、世界座標 UV 材質外掛
src/map/collide.js    Havok 靜態碰撞（PhysicsShapeContainer）
src/map/nav.js        導航圖、A*（零配置版）
src/game/player.js    移動（地面摩擦／空中加速）、PhysicsCharacterController
src/game/weapons.js   武器資料、後座力圖樣、彈道、換彈狀態機
src/game/viewmodel.js 第一人稱手槍（獨立 rendering group）、搖晃、後座、換彈
src/game/soldiers.js  士兵骨架實例、自製動畫混合器（烘焙關鍵影格到 Float32Array）
src/game/hitbox.js    骨頭膠囊射線判定（頭/胸/腹/臂/腿倍率）
src/game/bots.js      Bot AI
src/game/round.js     回合、經濟、勝負
src/game/grenades.js  投擲物（Havok 動態剛體池）
src/fx/*.js           彈孔、血霧、曳光、彈殼、煙、槍口火焰（全部固定大小 thin instance 池）
src/ui/*.js           HUD、買槍、計分板、主選單、觸控（DOM）
src/audio/sfx.js      CC0 錄音主體＋即時合成層，載入失敗退回純合成
tools/build.mjs       esbuild → ../../web/278-ochre-line.html（JS 與 Havok wasm 內嵌）
tools/accept.mjs      兩尺寸驗收、零 GC、顏色對照、截圖
```

## 引擎硬性規則

1. `new WebGPUEngine(canvas,{enableAllFeatures:true,setMaximumLimits:true})`；`IsSupportedAsync` 為否時退回 WebGL2 `Engine`，同一份場景碼。
2. 靜態場景完成後用 `SnapshotRenderingHelper`（`SNAPSHOTRENDERING_FAST`）。**FAST 模式後 mesh 集合、材質、實例數都凍結**：所有執行期會出現的東西都要開局就建好固定大小的池，用縮放為 0 的矩陣隱藏。移動單一 mesh 要 `computeWorldMatrix(true)` 後 `transferToEffect`；thin instance 改完呼叫 `thinInstanceBufferUpdated`。每個 mesh 都要有材質（沒 import StandardMaterial，預設材質會丟例外）。
3. 重複的城鎮組件一律 thin instance，禁止 `mesh.clone/createInstance`。
4. `scene.onBeforeRenderObservable` 內與它呼叫到的程式禁止 `new Vector3/Matrix/Quaternion/Color3`、`.add/.subtract/.scale/.clone/.normalizeToNew` 這類回傳新物件的方法、陣列 `map/filter`、閉包配置、物件字面值。用 `src/core/tmp.js` 與 `*ToRef`。DOM 更新走節流＋字串快取。
5. 打包坑：`bone.pure.js`、`skeleton.js` 要在 `main.js` 先 import 並實際引用（`Bone is not a constructor`）；`Physics/joinedPhysicsEngineComponent.js` 也要 import；esbuild 要 `--define:import.meta.url` 或用 esm。
6. 射線用 `plugin.raycast(from,to,result)` 與預配置 `PhysicsRaycastResult`，不用 `scene.pick`。

## 測試介面 `window.__ol`

`ready`、`state()`、`teleport(x,y,z,yawDeg,pitchDeg)`、`setClean(bool)`、`startMatch(opts)`、`fire(n)`、`giveWeapon(id)`、`killBots()`、`setRound(phase)`、`skip(sec)`、`stats()`（fps、drawCalls、alloc 計數）。網址 `?clean=1`、`?gfx=webgl`、`?seed=N`、`?bots=N`、`?spot=<name>` 直接到指定鏡位。

## SPEC_Super.md 對照（使用者手冊，2026-11-05）

`SPEC_Super.md` 是使用者提供的六階段手冊。它的工程流程照做，但手冊要求對齊特定商業遊戲的部分不做，一律改成原創，理由見上方「原創界線」。

| 手冊項目 | 處理 |
| --- | --- |
| 六階段視覺錨點流程、每階段截圖驗證 | 照做 |
| 4 m 網格、Wall_Sandstone／Wall_Archway（2.2 m 拱）／Wall_Upper_Window／Floor_Limestone、1.25 m 掩體箱（站姿露頭、蹲姿全隱蔽） | 照做 |
| thin instance + Havok 靜態碰撞、freezeWorldMatrix、材質 freeze、快照 | 照做，80% 由 `accept --only snap` 以同頁 ABBA 判定 |
| KeyArtRefCam、SiteBOverviewCam、俯視正交雷達相機、`radar_overview_raw.png`、`window.__GAME_MCP__`（switchToKeyArtCam、switchToFpsCam、teleportFpsCam、setHudState、getPerformanceStats） | 照做，另保留 `__ol` 給驗收 |
| 水平 FOV 90°、眼高 1.70、站高 1.80、蹲高 1.25 | 照做 |
| HSV／CIELAB 取樣、ΔS／ΔV／ΔE00、\|ΔS\| < 2.5% 閉環校色、ACES、colorCurves、CascadedShadowGenerator 2048 PCF、暖色 groundColor | 照做（基準圖用 `ref/key.jpg`） |
| 11 個命中部位、頭 4× 胸臂 1× 腹 1.25× 腿 0.75×、防彈衣／頭盔、護甲穿透率、腿部受擊減速 | 照做，用骨頭膠囊實作 |
| 速度低於 34% 完全精準（急停）、30 發固定彈道、槍身回推、拋殼 | 照做，彈道圖樣自己設計 |
| Blender 真實導角（Bevel 0.002/3/0.7、Weighted Normal）、2K PBR、Anisotropic 16、槍鐵／握把材質數值 | 照做，用在原創型號 |
| 事件驅動 DOM HUD、Canvas 旋轉雷達、1920×1080 等比縮放、靜態準星 | 照做，版面原創 |
| 三線、攻守重生 Z=±44、開放 A（24×24）、封閉 B（20×24、6 m 拱廊瓶頸、ΔY 1.8 陽台）、地圖外圍背景建築 | 照做，動線自己設計 |
| Dust II／Mirage 建築與報點（A Long、中門、Catwalk、B Tunnels、A-Ramp）、CT／T 陣營與頭巾造型、AK-47／M4A4／AWP／USP-S／Desert Eagle、Panorama HUD 1:1、CT 藍／T 金色票、`Cs2*` 命名、手冊的 Step 1 生圖提示詞 | 不做，改原創 |
| 5 張生圖、Tripo3D | 需要使用者操作；沒有圖時以 `ref/` 畫格與本機 CC0 素材取代，使用者日後提供可換 |
| `renderingGroupId = 1` 的武器層 | 實測與 FAST 快照衝突（render bundle 失效），改用 `src/core/depthHack.js` |
| `scene.pickWithRay` 命中判定 | 與零 GC 衝突，改骨頭膠囊解析解 |
| TypeScript、Vite | 沿用 repo 的 esbuild 單檔流程，寫 JS |
| 雙手持 V11 | 模型太短，兩隻手擠不下；改單手，依使用者「小槍單手拿」的回饋 |
| Panorama 版 HUD 與購買頁 | 依參考影片的資訊架構重做：底部赭線數值條、右側武器剪影欄、左下事件紀錄、五欄購買頁；造型與配色原創 |
| 手指級的換彈與檢視動作 | 手臂是烘好的靜態姿勢，換彈與檢視只動整組槍與手，彈匣和手指不會動 |

本節數值優先於上方舊值：眼高 1.70、站高 1.80、蹲高 1.25、水平 FOV 90°。
