# POWDER PEAK — 架構規格（實作契約）

瀏覽器第三人稱滑雪遊戲。Three.js（npm `three@0.186.0`，ES module），esbuild 打包成**單一 HTML 檔** `web/194-powder-peak.html`（three 一起打包，`file://` 可直接開；唯一的外部請求是可有可無的 Google Fonts）。

美術基準：`2101937240351834281.jpg`（低多邊形、色塊乾淨、遠景帶霧、晴天藍天白雲、木柵欄夾道、紅色旗幟、雪松）。
注意：本 session 沒有 Rodin MCP，所有 3D 模型在 `src/assets.js` 以程式碼建構（不可從網路抓模型）。

## 座標與單位

- Y 軸向上，單位公尺、秒、弧度。
- **下坡前進方向 = -Z**。起點 z = 0。`distance = -player.z`。
- 側向 = X。`heading`（ψ）：0 表示面向 -Z；**ψ 為正 = 轉向 +X（右）**。
  前進向量 `forward = (sin ψ, 0, -cos ψ)`；右向量 `right = (cos ψ, 0, sin ψ)`。
- 所有模型在 local space 面向 -Z，原點在底部中心（接地點）。

## 檔案與負責範圍

| 檔案 | 內容 |
|---|---|
| `src/config.js` | 所有可調參數，**唯一來源**（各模組直接參照 `config.xxx`，不再各自保留一份 LOCAL_DEFAULTS 數值；新增參數一律加在這裡，每個 key 都必須有程式讀取） |
| `src/shared.js` | 共用純函式：RNG、noise、ramp 剖面、數學工具（**已寫好**） |
| `src/assets.js` | 程式化低多邊形模型 + 共用材質 + 面數統計 |
| `src/terrain.js` | 無盡賽道：高度函數、chunk 管理、物件生成、碰撞/旗門查詢、遠景 |
| `src/player.js` | 滑雪者物理、狀態機、動作動畫 |
| `src/input.js` | 鍵盤 + 觸控輸入 |
| `src/bot.js` | 自動駕駛（測試用） |
| `src/camera.js` | 追尾鏡頭 |
| `src/effects.js` | 雪花噴濺粒子、飄雪 |
| `src/audio.js` | WebAudio 程式合成音效 |
| `src/hud.js` + `src/index.html` | DOM HUD、標題畫面、暫停、結算、CSS |
| `src/main.js` | 啟動、renderer、燈光、遊戲迴圈、計分、狀態機、測試 API |
| `tools/build.mjs` | 打包 → `web/194-powder-peak.html`；`--out=dist` 改輸出到 `dist/index.html`，`--artifact` 另出無 html/head/body 包裝的 `artifact.html` |
| `tools/shot.mjs` | puppeteer-core + 本機 Chrome 無頭截圖（`--eval` 可先執行 JS） |
| `tools/perf/bench.mjs` | 真實 GPU 效能基準（fps / 幀時間分位數 / GPU 時間 / 記憶體） |

## 模組介面（必須完全照這個簽名）

### shared.js（已存在）
```js
export function mulberry32(seed) -> () => float in [0,1)
export function hash2(i, j, seed) -> float in [0,1)
export function valueNoise2(x, z, seed) -> float in [-1,1]   // 平滑 value noise
export function fbm2(x, z, seed, octaves=3) -> float in ~[-1,1]
export function rampProfile(t) -> float in [0,1]  // t∈[0,1] 沿跳台長度，回傳高度比例
export function clamp(v, a, b), lerp(a, b, t), smoothstep(e0, e1, x), damp(current, target, lambda, dt)
export function angleDiff(a, b) -> 最短角差 (-π, π]
```

### assets.js
```js
export function createAssets() -> Assets
Assets = {
  materials: { snow, wood, ... },            // 共用材質（MeshLambertMaterial, flatShading, vertexColors）
  geometries: {
    pine:  [BufferGeometry, BufferGeometry, BufferGeometry], // 3 種變體（大小/層數不同），高度約 6~11m，原點在樹幹底
    rock:  [BufferGeometry, BufferGeometry, BufferGeometry], // 3 種變體，約 1.2~2.2m 寬、0.8~1.4m 高，頂部帶積雪
    fencePost: BufferGeometry,  // 單根柱，高 1.3m，頂部積雪
    fenceRail: BufferGeometry,  // 單位長度 1m 的橫木（沿 -Z 方向延伸，從 z=0 到 z=-1），兩條橫木合併，含積雪
    gatePole:  BufferGeometry,  // 旗門單側：木柱 + 紅色直式旗幟（附圖那種帶三角圖騰的紅旗），高約 3.2m
    cloud: BufferGeometry,      // 低多邊形雲朵
    mountain: BufferGeometry,   // 遠景雪山（大，約 300m 高）
  },
  createRamp(width, length, height) -> Mesh,  // 跳台，頂面嚴格依 shared.rampProfile 取樣，前緣在 z=0、唇口在 z=-length
  createSkier() -> { root: Group, rig: SkierRig },
  triangleReport() -> { [name]: triangles }   // 面數統計（給測試與 debug overlay）
}
```
所有幾何都以 **vertex color** 上色（一個材質跑遍全部 → 可 instancing，少 draw call）；`flatShading: true`。
面數預算：skier ≤ 2500、pine ≤ 350、rock ≤ 160、fencePost ≤ 60、fenceRail ≤ 60、gatePole ≤ 200、ramp ≤ 400、cloud ≤ 300、mountain ≤ 800。

**SkierRig**（滑雪者 = 附圖那種維京風格角色：有角頭盔、橘色大鬍子、毛皮大衣、皮靴，但是**雙板滑雪**，拿兩根雪杖）：
```
root (Group, 原點=雪板底面中心)
 └ body (Group)                    ← player 用來做整體傾斜/翻滾
    ├ hips (Group, y=0.95)          ← 蹲低時下降
    │   ├ torso (Group) ← 上半身前傾；含頭、頭盔、鬍子
    │   │   ├ head (Group)
    │   │   ├ armL (Group, 肩膀樞紐 local (-0.26, 0.45, 0)) └ poleL
    │   │   └ armR (Group, 肩膀樞紐 local ( 0.26, 0.45, 0)) └ poleR
    │   ├ thighL (Group, 樞紐 local (-0.13, 0, 0), 長 0.45 向下) └ shinL (Group, 在 y=-0.45, 長 0.45 向下) └ bootL
    │   └ thighR ... └ shinR ... └ bootR
    ├ skiL (Group, x=-0.13, y=0)   長 1.7m 沿 Z，前端微翹
    └ skiR (Group, x= 0.13, y=0)
```
rig 物件鍵名：`{ body, hips, torso, head, armL, armR, poleL, poleR, thighL, shinL, thighR, shinR, skiL, skiR }`。
站立時 thigh/shin 旋轉皆 0（腿垂直），腳底恰好在 y≈0.05（雪板厚度上方）。

### terrain.js
```js
export class Terrain {
  constructor(scene, assets, config, seed)
  reset(seed)                         // 清空所有 chunk，重新生成
  update(playerZ, dt)                 // 依玩家位置生成前方 chunk、回收後方；遠景/雲跟隨
  heightAt(x, z) -> y                 // 含跳台
  normalAt(x, z, out?: Vector3) -> Vector3   // 數值微分
  centerX(z) -> x                     // 賽道中心線
  halfWidth(z) -> m                   // 賽道半寬（柵欄在 centerX ± halfWidth）
  difficulty(distance) -> 0..1
  queryObstacles(x, z, radius) -> [{ id, type:'tree'|'rock', x, z, r, top }]  // top = 障礙頂端世界 y
  gatesCrossed(zPrev, zNow) -> [{ id, z, xLeft, xRight }]   // zNow < zPrev；回傳這一步跨越的旗門
  rampsNear(z, range) -> [{ x, z0, z1, halfWidth, height }] // 給 bot 用
  upcomingPath(fromZ, length, step) -> [[x, z], ...]        // 給小地圖
  upcomingGates(fromZ, length) -> [{ id, z, xLeft, xRight }] // 給 bot / 小地圖
}
```
- 高度：`heightAt = baseY(z) + 側向剖面 + 起伏 noise + 跳台`；`baseY` 由 `shared`/config 的坡度曲線積分（坡度隨距離變陡）。賽道內輕微凹（往中心），賽道外（柵欄外）往上隆起成雪丘。
- 跳台：**沿當地賽道方向偏轉**（`yaw = atan(tn)`，`cy = cos`、`sy = sin`），頂面高度 `height * rampProfile(s/length)`，s 為沿跳台自身軸線的距離；唇口後高度回到地形 → 物理自然騰空。
  `rampsNear()` 回傳 `{ id, x, z0, z1, x1, d, len, halfWidth, height, yaw, cy, sy, land, dEnd, xEnd }`（`land` / `dEnd` / `xEnd` = 預估落地區，落地區內不放障礙；跳台前有引導門 `rampFunnelGate`）。跳台附近與落地區不放障礙。
- chunk 長 `config.terrain.chunkLength`，每 chunk 只有自己的地形 mesh；物件（pine0-2 / rock0-2 / post / rail / gate）用**全域 InstancedMesh 池**：每種物件兩個池——`near`（玩家所在 chunk 往後 `shadowChunksBehind`、往前 `shadowChunksAhead` 範圍，投射陰影）與 `far`（其餘，不投射陰影）。chunk 增減或玩家跨 chunk 時 `_rebuildPools()` 重填矩陣（容量不足才重建，×1.4 餘量）→ 物件 draw call 固定 18 個，與視距無關。物件以 `hash(chunkIndex, seed)` 決定，保證同 seed 重現。
- 遠景：`bg` 群組（遠山 InstancedMesh、雲 InstancedMesh）跟著玩家平移、依坡度下沉；遠山 `fog:false`、頂點色預先往霧色混合；renderOrder 在地形之後、天空之前（early-Z 丟掉被擋住的像素）。
- 旗門：兩根 gatePole 夾出 `gateWidth` 寬的門，放在賽道內隨機偏移。門周圍不放障礙。
- 障礙密度與賽道彎曲程度隨 `difficulty` 上升。前 150m 為起跑區（直、無障礙、兩側柵欄如附圖）。

### player.js
```js
export class Player {
  constructor(scene, assets, terrain, config)
  reset(x, z)                                   // 站在 (x, heightAt, z)，面向 -Z，速度 0
  update(dt, input) -> events[]                 // 固定步長呼叫（config.sim.fixedDt）
  // 可讀狀態：
  position: Vector3, velocity: Vector3, heading: number,
  grounded: boolean, state: 'ready'|'riding'|'air'|'crashed',
  crouch: 0..1, boost: 0..1, airTime: number (本次滯空), skid: 0..1 (側滑程度), 
  speed (getter, m/s), invulnerable: number (秒)
  mesh: Group (= rig.root 的外層)
}
events: { type: 'jump' } | { type: 'takeoff' } | { type: 'land', airTime, quality: 'clean'|'wobble' }
      | { type: 'crash', reason: 'landing'|'impact'|'obstacle' } | { type: 'recovered' }
      | { type: 'hit', obstacle } | { type: 'fence' }
```
物理要點（參數全在 `config.player`）：
- 著地：重力投影到地表切平面產生加速度；雪地摩擦 μ；空氣阻力 k·v²（蹲低 k 變小）；速度永遠投影在切平面。
- 轉向有慣性：heading 角速度 ω 以 `turnResponse` 趨近 `steer * turnRate(speed)`；高速時轉向率下降。
- 側滑：速度分解成沿板方向與側向，側向分量以 `grip` 指數衰減；被吃掉的側向動量一部分轉成前進（carveEfficiency），其餘損失；急轉/高速時抓地力下降 → `skid` 升高（給音效與粒子用）。
- 蹲低（Shift）：阻力下降、有額外推力（消耗 boost）、轉向率下降。
- 跳躍（Space，著地時）：沿法線加速度。跳台唇口自然騰空：若依速度前進後的位置高於地面 `airborneEpsilon` → 進入 'air'。
- 空中：只有重力 + 小阻力；左右鍵旋轉 heading（空中自轉），無輸入時 heading 緩慢對齊速度方向。
- 落地判定：`misalign` = heading 與水平速度方向夾角；`impact` = 法向撞擊速度。超過 crash 門檻 → 摔倒（蹲低可提高衝擊容忍度）；介於 wobble 門檻 → 不穩（損失部分速度）。
- 摔倒：速度乘上 `crashSpeedKeep`，翻滾動畫 `crashDuration` 秒，然後在同一 z 的賽道中心重新站起、短暫無敵。
- 障礙：XZ 圓柱碰撞；若玩家 y 高於障礙 `top` 則可飛越。撞到 → 速度乘 `hitSpeedKeep` + 反彈；速度超過 `obstacleCrashSpeed` 且正面撞擊 → 算摔倒。空中擦撞時 heading 立刻往新速度方向轉 `airHitAlign`（否則落地側滑角過大必摔）。
- 落在跳台斜面上：撞擊速度以「原本雪坡（不含跳台）」的法線計算，速度仍投影到跳台面（跳台面迎著來車，用它的法線會把正常平地跳誤判成重摔）。
- 摔倒翻滾時用各 mesh 的凸包探測點量到地面切平面的最低距離，不夠就沿法線抬起 body（不穿地）。
- 柵欄：`|x - centerX| > halfWidth - 0.4` 時推回並吸收側向速度（軟牆）。
- 動畫：蹲低（hips 下降、大腿前轉、小腿後轉）、轉彎時 body 往內側傾（lean 依側向加速度）、雙手雪杖擺動、空中收腿、落地壓縮、摔倒翻滾。

### input.js
```js
export class Input {
  constructor(domElement)  // 監聽 window keydown/keyup；觸控按鈕由 HUD 建立後呼叫 bindTouch
  bindTouch(elements: { left, right, jump, boost })
  update(dt)               // 數位按鍵 → 類比 steer（以 config.input.steerRamp 爬升，放開回中更快）
  steer: -1..1, crouch: bool, jumpPressed: bool (單幀 edge，被讀取後由 consumeJump() 清除),
  consumeJump() -> bool, pausePressed edge (Esc / P), consumePause() -> bool
  setOverride(obj|null)    // bot 用：{steer, crouch, jump}
}
```
鍵位：A/← 左、D/→ 右、Space 跳、Shift 或 S/↓ 蹲低加速、Esc/P 暫停、M 靜音。

### bot.js
```js
export class Bot { constructor(terrain, config); reset(); update(dt, player) -> { steer, crouch, jump } }
```
**取樣式路線規劃**：每 `planEvery` 個物理步列舉「目標航向 × 保持時間」候選，用與 player 相同的轉向率 / 慣性 / 抓地延遲的簡化模型往前推演 `planHorizon` 秒，依撞障礙 / 出柵欄 / 漏旗門 / 歪上跳台計成本取最低者。只用 terrain 公開查詢（`upcomingGates` / `rampsNear` / `queryObstacles` / `centerX` / `halfWidth`）。空中不轉向。
預設 bot 接近完美（simulate(180)：約 4.8 km、0 摔、100% 過門）；評估平衡用弱化 bot：`config.bot.reactionTime = 0.45`、`aimNoise = 0.15`（約 4.1 km、0–2 摔、87–92% 過門）。bot 與 player 在 `reset()` 時重讀 config，所以執行中改 `__game.config.bot` / `config.player` 會在下一局或下一次 `simulate()` 生效。`npm test`（`tools/playtest.mjs`）用這兩組 bot 驗證上述基準。

### camera.js
```js
export class ChaseCamera { constructor(camera, config); reset(player); update(dt, player, terrain); shake(amount) }
```
追在行進方向後方（速度方向與 heading 混合後平滑），滯空時距離/高度拉遠（`config.camera.airPullback`），FOV 隨速度增加，不可鑽進地面。

### effects.js
```js
export class Effects { constructor(scene, config, terrain?); setTerrain(terrain); update(dt, player, camera); burst(kind:'land'|'landHard'|'crash'|'hit'|'gate', position) ; reset() }
```
雪板噴雪粒子（依 skid 與速度）、落地/摔倒雪塵、攝影機周圍飄雪（輕量）。單一 `THREE.Points` 池（+ 飄雪一個），固定上限。
有 terrain 時粒子用 `heightAt` 停在雪面上（`groundOffset`）、著地後摩擦淡出。`gate`：main 在兩根旗桿頂各呼叫一次，小顆硬邊金色菱形（shader 以 `aTint` 分支做硬邊），不繼承玩家速度，留在旗門原地。

### audio.js
```js
export class AudioEngine {
  init()                  // 必須在使用者手勢內呼叫（LET'S RIDE 按鈕）
  setMuted(bool), muted
  update(dt, { speed, grounded, skid, crouch, state })   // 持續音：滑雪沙沙聲（濾波白噪音，音量與中心頻率隨速度）、側滑刮雪聲、高速風聲；空中雪聲淡出、風聲保留
  play(name)              // 'jump'|'land'|'landHard'|'crash'|'gate'|'hit'|'fence'|'click'|'gameover'|'boost'
}
```
全部 WebAudio 程式合成，不載入任何音檔。

### hud.js + index.html
版面照附圖：
- 左上：TIME（大號黃色斜體數字 `00:00.00`）、SCORE 面板。
- 上方置中：小標題字樣。
- 右上：小地圖（前方賽道路線 + 玩家箭頭 + 旗門點），下方音效/暫停小圓鈕。
- 左下：按鍵提示 A / D / Space / Shift（圖示 + LEFT/RIGHT/JUMP/BOOST 標籤）。
- 右下：速度錶（彩虹弧形刻度 + 指針 + 大數字 km/h）、BOOST 分段條。
- 生命：3 顆（摔倒次數剩餘），放在 SCORE 面板下或旁。
- 中央：標題畫面（大標 POWDER**PEAK**、副標、LET'S RIDE 黃色按鈕、操作說明）；暫停；結算（距離、最高速度、最長滯空、時間、分數、旗門數，RIDE AGAIN 按鈕，本機最佳紀錄）。
- 事件浮字：`+GATE ×combo`、`CLEAN LANDING`、`WOBBLE`、`CRASH!`、`BIG AIR 1.8s`。
- 觸控裝置：螢幕左右下角顯示觸控按鈕（左、右、跳、加速），並呼叫 `input.bindTouch`。
```js
export class HUD {
  constructor(root: HTMLElement)
  on(event: 'start'|'restart'|'pause'|'resume'|'mute', fn)
  setScreen('title'|'playing'|'paused'|'results')
  update({ time, score, speedKmh, boost, livesLeft, distance, combo, minimap: { path:[[x,z]], gates:[{x,z}], player:{x,z,heading} } })
  popup(text, kind: 'good'|'bad'|'info')
  showResults({ distance, maxSpeedKmh, longestAir, time, score, gates, gatesTotal, best })
  setMuted(bool)
  touchElements -> { left, right, jump, boost }
}
```
視覺：晴天單一主題（不做深色模式），body 明確設定背景色。字體：Google Fonts `Titan One`（標題、按鈕）、`Chakra Petch` 700 italic（計時/數字，tabular-nums）、`Barlow Condensed` 600（標籤，大寫加字距）；每個都有系統字 fallback（企業內網可能擋 Google Fonts）。面板：半透明冰藍灰玻璃（`rgba` + `backdrop-filter`），圓角適中。`prefers-reduced-motion` 時關閉浮字動畫。所有 UI 元素 `pointer-events` 設計正確（HUD 不擋遊戲操作）。

### main.js
- renderer：antialias，`pixelRatio = min(devicePixelRatio, config.render.maxPixelRatio)`，SRGB，shadowMap PCF（three r0.180 起 PCFShadowMap 即柔邊，PCFSoftShadowMap 已棄用），1 盞方向光（陰影跟隨玩家，frustum ±`config.render.shadowRange`）+ HemisphereLight。`scene.fog = Fog(天空淡藍, near, far)`。天空：跟隨相機的漸層 sky dome（不受霧影響）。
- 固定步長物理（`config.sim.fixedDt`，accumulator，單幀最多 `maxSubSteps`），渲染在 rAF。
- 算繪像素預算：`pixelRatio = min(DPR, maxPixelRatio, √(maxRenderPixels / CSS 像素))`；MSAA 只在建 context 時的算繪像素 ≤ `antialiasMaxPixels` 才開。
- 霧：`fogRange` 時把 three 的 fog_vertex 由視深（-mvPosition.z）改成到鏡頭的距離 → 寬畫面左右邊緣新生成的 chunk / 樹不會在霧未滿時冒出來。
- 自動畫質（`_updateQuality`，每 `qualityWindow` 秒一窗，開局 `qualityWarmup` 秒不量）：
  - 降：連續 `qualityDownWindows` 個窗 < `qualityLowFps` → 依「成本 ∝ 像素數」估算目標 pr，一步最多降到 × `qualityMinScale`，下限 `minPixelRatio`。
  - 升：連續 upHold 秒 ≥ `qualityHighFps` 小步 +`qualityUpStep`；標題畫面只要 `qualityTitleUpHold` 秒且一步回到上限。升上去後 `qualityUpFailWindow` 秒內又降 → upHold 加倍，累積 `qualityMaxUpFails` 次鎖住（防震盪）。
  - 套用時機（iGPU 上改畫布尺寸會卡 0.2～1.8 s）：非滑行（標題 / 暫停 / 結算）或摔倒翻滾中立刻套用；滑行中只記下（pending），除非連續 `qualityEmergencyWindows` 窗 < `qualityEmergencyFps`，或記下的降級之後仍持續偏低 `qualityRideApplyAfter` 秒；記下降級後又出現達標窗 → 取消。
- 標題畫面：展示鏡頭（`score.attract*`）在角色後方繞行，角色在畫面下半部；標題文字區塊在上半部（橫式手機只留大標 + 按鈕）。
- 計分：`score = floor(distance * pointsPerMeter) + gateBonus*combo + airBonus`；計時從 LET'S RIDE 開始。
- 狀態：title → playing ⇄ paused → results（摔 3 次後 1.5 秒進結算）。
- 測試 API：`window.__game = { state, config, player, terrain, game, start(), restart(), pause(), resume(), setBot(bool), simulate(seconds, dt?, opts?) -> stats, stats(), rendererInfo(), triangleReport() }`。
  `rendererInfo()` 另含 `pixelRatio / antialias / buffer / qualityLog / qualityPending / qualityLastFps` 等自動畫質狀態。
  URL 參數：`?bot=1` 自動駕駛並自動開始、`?seed=N`、`?debug=1` 顯示 fps/drawcalls/triangles 覆蓋層、`?mute=1`；
  效能除錯：`?pr=` 固定 pixelRatio（停用自動畫質）、`?aa=0|1`、`?shadow=off|basic|pcf|soft`、`?smap=`、`?mp=`（像素預算覆寫）、`?orphan=0`。
  `simulate(seconds)`：不渲染，直接以固定步長跑 bot 物理，回傳 `{ distance, maxSpeedKmh, longestAir, crashes, gatesPassed, gatesMissed, hits, fenceHits, avgSpeedKmh, time, landings: {clean, wobble, crash} }`。
- 暫停：Esc/P 或失焦（visibilitychange / blur）自動暫停。
- 最佳紀錄存 localStorage（try/catch 包起來）。

## 效能目標
筆電 60 fps：draw calls < 150、場景三角形 < 250k、陰影貼圖 2048、粒子 ≤ 1500。
實測（Intel UHD 630，1920x1080@DPR1.5 → 像素預算限制成 1977x1112、MSAA on）：draw calls 50–52、三角形 147k–180k；每幀 CPU 約 2.8 ms、GPU 約 9.8 ms（p95 11.7–13.2 ms），60 Hz 預算 16.7 ms 內。
量測工具：`tools/perf/bench.mjs`（`--vsync` 為接近真人的量法；headless rAF 是 100 Hz，>10 ms 的幀會被量成 20 ms）。
