# 築嵐島 · STORMWRIGHT — 架構規格（實作契約）

作品 196。瀏覽器第三人稱「建造大逃殺」：30 名玩家（你 + 29 個電腦對手）從飛艇跳下、滑翔降落在一座色彩飽和的卡通島嶼，搜刮槍枝、補血補盾、用十字鎬採集木／石／金屬，蓋牆、地板、斜坡，在紫色風暴不斷縮小的島上活到最後。

**原始需求（使用者提示詞，所有軌道都要對照）**：
> Create a playable Fortnite-style battle royale with a third-person camera, smooth movement, aiming, shooting and reloading. Add enemy bots, weapon pickups, health and shields, an inventory and a minimap. Include building with walls and ramps, plus a shrinking storm that forces players closer together. Create a colorful island with grassy hills, trees and small towns. Make the lighting, animations and UI feel as close to Fortnite as possible.

## 0. 硬性規則

- **手感像 Fortnite，但不能用它的智財**：不可出現 Fortnite / Epic / Battle Bus / Victory Royale / 任何官方角色、地名、logo、武器名。標題、地名、角色、文案全部原創（下面已給定）。
- **和站內作品 190（封頂 · LAST BEAM，PUBG 式寫實工地大逃殺）必須明顯不同**：190 是寫實、低飽和、黃黑工地配色、藍色電網、直升機＋降落傘、安全帽／防彈背心分級、DIN Condensed 字體。本作是**高飽和卡通風格化**、**紫色風暴**、**飛艇＋滑翔翼**、**護盾是獨立的藍條**、**有建造**、**有材料採集**、字體用 Anton。
- 單一 HTML：`npm run build` 用 esbuild 把 `src/main.js`（含 three@0.186.0）打包、內嵌進 `src/index.html` 的 `<!--BUNDLE-->`，輸出 `../../web/196-stormwright.html`。`file://` 直接開要能玩。
- **唯一允許的外部請求**是 Google Fonts（`fonts.googleapis.com`／`fonts.gstatic.com`，只載 `Anton`），且必須用 JS 動態插入 `<link>`（參考 games/194-powder-peak/src/index.html 的做法），載不到時退回系統字（`"Arial Narrow", "PingFang TC", "Heiti TC", sans-serif`，`font-weight: 900`）。不可載入任何其他網路資源（模型、貼圖、音效都以程式產生）。
- 所有文案繁體中文（可夾英文大標）。
- 程式碼註解用繁體中文，簡潔。
- 模型全部程式建構（BufferGeometry ＋ vertex color 為主），不得下載任何資產。

## 1. 座標、單位、尺度（固定數字，不得各自另訂）

- Y 軸向上；公尺、秒、弧度。
- `yaw`：0 表示面向 -Z；yaw 為正 = 向左轉（three.js 慣例：`forward = (-sin yaw, 0, -cos yaw)`，`right = (cos yaw, 0, -sin yaw)`）。`pitch`：正 = 抬頭，範圍 ±1.45。
- 所有模型在 local space 面向 -Z，原點在腳底／底部中心。
- **島嶼**：可玩區域 x、z ∈ [-400, 400]（800 m 見方），海平面 y = 0，島外是海。地形最高約 45 m 的丘陵，海岸是沙灘，島的輪廓不規則（不是正方形、不是正圓）。
- **玩家數**：30（玩家 1 ＋ bot 29）。
- **角色**：身高 1.8 m，碰撞膠囊半徑 0.38，眼高 1.6；頭部判定球半徑 0.24，球心在 y+1.62。
- **建造格**：水平格寬 `CELL = 4` m，層高 `LEVEL = 3.5` m，格線是全域絕對座標（格 (i,k) 範圍 x∈[4i,4i+4]、z∈[4k,4k+4]，層 L 底面 y = 3.5L）。
- **對戰長度**：飛艇＋跳傘約 60 s，風暴 6 階段，整場約 8–10 分鐘。

## 2. 檔案與負責範圍

| 檔案 | 內容 | 擁有者 |
|---|---|---|
| `package.json`、`tools/build.mjs`、`tools/shot.mjs`、`tools/accept.mjs` | 打包、截圖、驗收 | A（核心） |
| `src/index.html` | 外殼、CSS、HUD DOM 結構 | A 建立 → B5 |
| `src/main.js` | 啟動、建立 ctx、遊戲迴圈、固定步長、測試 API `window.__sw` | A（之後只有主模型可改） |
| `src/config.js` | 全域參數（尺度、畫質級距、玩家數、按鍵預設）。**各模組自己的可調參數放在該模組檔案頂端的 `const XXX = {...}`，不要塞進 config.js** | A |
| `src/shared.js` | RNG、noise、數學工具、`clamp/lerp/damp/angleDiff` | A |
| `src/render.js` | renderer、燈光、天空、霧、陰影、後製、畫質級距 | A → B3 |
| `src/terrain.js` | 島嶼高度場、地形網格、海面 | A → B3 |
| `src/world.js` | 城鎮、房屋、樹、岩石、金屬物件、可採集物、戰利品點位、箱子點位 | A（stub）→ B3 |
| `src/physics.js` | 碰撞世界（盒、斜坡）、空間雜湊、角色移動解算、射線 | A → B2 |
| `src/actor.js` | Actor 類別：玩家與 bot 共用的狀態、移動、空中狀態（飛艇／自由落體／滑翔）、傷害、治療、死亡 | A → B7 |
| `src/player.js` | 玩家控制器：input → intent；`src/camera.js` 第三人稱鏡頭 | A → B7 |
| `src/input.js` | 鍵盤、滑鼠（Pointer Lock）、觸控（自建 `#touch` DOM） | A → B7 |
| `src/character.js` | 角色模型、骨架（Group 階層）、程序動畫、外觀變化、淘汰特效、滑翔翼模型 | A（stub）→ B4 |
| `src/audio.js` | WebAudio 合成音效 | A（stub）→ B4 |
| `src/items.js` | 物品定義表（武器、消耗品、彈藥、稀有度） | A → B1 |
| `src/inventory.js` | 背包資料模型 | A（完整實作）→ B1 |
| `src/combat.js` | 開火、彈道（hitscan）、散布、換彈、十字鎬採集、傷害結算 | A → B1 |
| `src/loot.js` | 地上戰利品、寶箱、彈藥箱、死亡掉落、撿取 | A（stub）→ B1 |
| `src/fx.js` | 曳光、彈著、火花、採集碎屑、建造煙塵、傷害數字（3D→螢幕）以外的粒子 | A（stub）→ B1 |
| `src/build.js` | 建造：預覽、放置、材料扣除、建造中 HP 成長、受損、摧毀、結構支撐 | A（最小版）→ B2 |
| `src/storm.js` | 風暴階段、圓心、縮圈、紫色風暴牆、傷害、畫面色調 | A（最小版）→ B5 |
| `src/match.js` | 對戰流程：選單 → 飛艇 → 跳傘 → 對戰 → 淘汰／勝利 → 結算；剩餘人數、擊殺訊息 | A（最小版）→ B5 |
| `src/hud.js` | DOM HUD 全部（含傷害數字、命中標記、擊殺訊息、建造列） | A（最小版）→ B5 |
| `src/minimap.js` | 小地圖與大地圖（Canvas 2D） | A（stub）→ B5 |
| `src/bots.js` | 29 個 bot 的 AI（產生 intent） | A（最小版）→ C |

規則：**只能改自己擁有的檔案**。需要別的檔案改動時，寫進回報的 `requests` 欄位，由主模型整合。`main.js` 在 A 階段就把所有模組接好（建構、`update` 呼叫順序、測試 API），B／C 階段任何人都不改 `main.js`。

## 3. ctx（共用上下文）

`main.js` 建立一個 `ctx` 物件，依序建構所有模組並把自己放進 ctx，之後所有模組只透過 ctx 互相呼叫（不互相 import 實例；可以 import 純函式與常數）。

```js
ctx = {
  THREE, config, rng,               // rng = mulberry32(seed)
  renderer, scene, camera,          // camera = THREE.PerspectiveCamera
  render,      // Render 實例
  terrain, world, physics, build, combat, loot, fx, storm, match, hud, minimap, audio, input, bots,
  characters,  // character.js 匯出的工廠（見 §8）
  actors: [],  // 所有 Actor（含玩家），索引 = actor.id
  player,      // 玩家的 Actor
  playerCtl,   // PlayerController
  cam,         // ThirdPersonCamera
  time: { now, dt, frame },   // now = 遊戲秒數（暫停不走）
  quality: 'low'|'medium'|'high'|'epic',
  events,      // 簡單事件匯流排：on(name, fn) / off / emit(name, payload)
  paused: false,
}
```

每個模組類別都是 `new X(ctx)`，可以有 `init()`（全部建構完才呼叫）、`update(dt)`（每幀）、`fixedUpdate(dt)`（固定步長 1/60）、`reset()`（新對局）。

### 主迴圈順序（main.js）
```
fixed 1/60 步（最多 5 步追趕）:
  input.poll() → playerCtl.fixedUpdate → bots.fixedUpdate → actors.forEach(a => a.fixedUpdate)（移動、物理）
  → combat.fixedUpdate → build.fixedUpdate → loot.fixedUpdate → storm.fixedUpdate → match.fixedUpdate
每幀 (dt):
  world.update, characters 動畫(每個 actor.view.update), cam.update, fx.update, render.update,
  hud.update, minimap.update, audio.update → render.render()
```

### 事件（events.emit 名稱與 payload，固定）
- `'damage'` `{ target, source, amount, shieldDamage, healthDamage, headshot, point, weapon }`
- `'eliminated'` `{ victim, killer, weapon, headshot }`（killer 可為 null = 風暴／摔死）
- `'shot'` `{ actor, weapon, from, to, hit }`（給 fx／audio／bots 聽槍聲）
- `'reload'` `{ actor, weapon, phase:'start'|'end' }`
- `'pickup'` `{ actor, item }`；`'chestOpen'` `{ actor, chest }`
- `'harvest'` `{ actor, material, amount, point, weakPoint }`
- `'buildPlaced'` `{ actor, piece }`；`'buildDestroyed'` `{ piece, by }`
- `'stormPhase'` `{ phase, state:'waiting'|'shrinking', endsAt }`
- `'matchState'` `{ state }`（`'menu'|'bus'|'playing'|'ended'`）
- `'heal'` `{ actor, kind:'health'|'shield', amount }`

## 4. Actor（actor.js）

玩家與 bot 共用同一個 Actor 類別；差別只在誰寫 `intent`。

```js
class Actor {
  id, name, isPlayer, alive, kills, place /*名次，淘汰時填入*/,
  pos: Vector3 /*腳底*/, vel: Vector3, yaw, pitch,
  state: 'bus'|'skydive'|'glide'|'ground'|'air'|'dead',
  grounded, crouching, sprinting,
  health /*0–100*/, shield /*0–100*/,
  inventory: Inventory,
  intent: Intent,          // 每個固定步由控制器寫入
  aim: { origin: Vector3, dir: Vector3 },   // 實際射擊射線（見 §6）
  view,                    // character.js 建立的 CharacterView（模型＋動畫）
  outfit,                  // 外觀參數（character.js 解讀）
  lastDamageAt, lastDamagedBy,
  action: null | { kind:'reload'|'consume'|'open'|'harvest', t, duration, data },  // 進行中的動作
  // 方法
  takeDamage(amount, info) -> { shieldDamage, healthDamage, killed }  // 先扣盾（storm/fall 只扣血：info.ignoreShield）
  heal(kind, amount, cap)
  eyePos(out) ; headCenter(out) ; forward(out)
  fixedUpdate(dt)          // 依 intent 移動、狀態轉換
  reset(spawn)
}

Intent = {
  moveX, moveZ,            // -1..1，本地座標（moveZ 正 = 前進）
  sprint, crouch, jump,    // jump 為該步的按下邊緣
  yaw, pitch,              // 絕對角度
  aimPoint: Vector3|null,  // 玩家：準心射線打到的點；bot：要瞄的點
  fire, ads, reload,       // fire、ads 為持續狀態；reload 為邊緣
  interact,                // 持續（按住開箱）
  slot: -1 | 0..5,         // 本步要切換到的欄位，-1 不切
  buildToggle,             // 邊緣：切換建造模式
  buildPiece: null|'wall'|'floor'|'ramp',   // 邊緣：直接選某建材並進入建造模式
  buildPlace,              // 持續：建造模式中按住＝連續放置
  buildCycleMaterial,      // 邊緣
  deploy,                  // 邊緣：飛艇上跳下／自由落體中提早開滑翔翼
}
```

### 移動（固定，實作在 actor.js ＋ physics.js）
- 走 4.6 m/s、跑（sprint，預設 Shift 切換或按住）6.4 m/s、蹲 2.6 m/s；地面加速度 50 m/s²、減速 40 m/s²，空中控制 25%。轉向即時（鏡頭驅動）。
- 跳躍初速 7.2 m/s、重力 22 m/s²（略重，Fortnite 感）。
- 可爬坡最大 50°（斜坡建材是 41°）；階高 0.55 m 自動跨上。
- 摔落傷害：落地垂直速度 > 16 m/s 才扣血，(v-16)*8，最多 100（建築頂摔下會痛但滑翔不會）。
- **飛艇**：`state='bus'` 時 pos 跟著飛艇（match.js 提供 `match.busPos(out)`），`deploy` → `skydive`。
- **自由落體**：終端速度 55 m/s（低頭俯衝 70 m/s），水平速度 18 m/s 隨鏡頭方向；離地 < 90 m 時可按 `deploy` 開滑翔翼；離地 < 45 m 自動開。
- **滑翔**：下落 6.5 m/s、水平 16 m/s，可轉向；落地 → `ground`。
- 島外（海）：水面 y=0 以下視為淺水，走速減半，不能建造（海裡不給進太遠：|x|或|z|>440 推回）。

## 5. Inventory（inventory.js）— A 階段完整實作

```js
class Inventory {
  slots: [Item|null × 5],     // 欄位 1–5；欄位 0 是固定的十字鎬（不在 slots 裡）
  selected: 0..5,             // 0 = 十字鎬
  ammo: { light, medium, heavy, shells },
  mats: { wood, stone, metal },   // 上限各 999
  buildMat: 'wood'|'stone'|'metal',
  current() -> Item|null      // selected 0 時回傳 PICKAXE 物件
  add(item) -> { added:bool, swapped:Item|null }   // 有空格放空格；滿了換掉目前手上那格（選十字鎬時不換，回傳 added:false）
  remove(slotIndex) -> Item
  addAmmo(type, n) ; addMat(mat, n) -> 實際加入量 ; spendMat(mat, n) -> bool
  dropAll() -> Item[]         // 死亡時：所有欄位＋彈藥與材料（打包成 ammo/mats 物品）
}
Item = { uid, defId, kind:'weapon'|'consumable'|'ammo'|'mats', rarity:0..4, mag /*彈匣剩餘*/, count /*堆疊數*/ }
```

## 6. 射擊、武器（items.js、combat.js）

稀有度 0–4：普通（灰 `#a8b0b8`）、優良（綠 `#5fc12f`）、稀有（藍 `#3aa0f2`）、史詩（紫 `#b04be6`）、傳說（金 `#f2a33a`）。每升一級傷害 ×1.05、換彈時間 ×0.95。

| defId | 名稱 | 彈藥 | 彈匣 | 射速 (發/秒) | 基礎傷害 | 爆頭倍率 | 換彈 s | 射程衰減 | 備註 |
|---|---|---|---|---|---|---|---|---|---|
| `ar` | 突擊步槍 | medium | 30 | 5.5 | 30 | 1.5 | 2.3 | 50 m 後線性降到 70% | 連射散布（bloom）累積，ADS 準 |
| `pump` | 泵動霰彈槍 | shells | 5 | 0.75 | 10 顆 × 9 | 2.0 | 每發 0.5（可中斷） | 10 m 後快速衰減，25 m 剩 20% | 十字準心是圓 |
| `smg` | 衝鋒槍 | light | 30 | 11 | 16 | 1.5 | 2.2 | 30 m 後降到 60% | |
| `sniper` | 栓動狙擊槍 | heavy | 1 | 0.4 | 105 | 2.5 | 2.6 | 無 | ADS 4 倍鏡（HUD 畫鏡框），子彈有 0.7 s 內的拋物線下墜可略 |
| `pistol` | 手槍 | light | 16 | 6.5 | 24 | 1.5 | 1.3 | 30 m 後降到 70% | |
| `bandage` | 繃帶 | – | 堆疊 15 | – | 回血 15（上限 75） | | 使用 3.5 s | | |
| `medkit` | 醫療包 | – | 堆疊 3 | – | 回血 100 | | 使用 10 s | | |
| `minishield` | 小護盾瓶 | – | 堆疊 6 | – | 盾 25（上限 50） | | 使用 2 s | | |
| `shield` | 護盾藥水 | – | 堆疊 3 | – | 盾 50 | | 使用 5 s | | |

- 每把槍的稀有度：ar 0–4、pump 0–4、smg 0–3、sniper 2–4、pistol 0–2。
- 十字鎬（slot 0）：近戰 2.2 m，每秒 1.6 下；打角色 20；打可採集物／建材造成 50（建材）或依物件給材料（見 §9）。
- **射擊射線**（第三人稱關鍵）：玩家準心射線從**鏡頭**出發取得 `aimPoint`（打到的第一個東西，或 400 m 處）；實際子彈射線從**角色眼睛（肩槍口附近）指向 aimPoint**，所以躲在牆後不能靠鏡頭偷打，鏡頭穿牆也不會打穿。bot 直接用眼睛 → 目標。
- 散布：每把槍有 `spreadHip`、`spreadAds`、`bloomPerShot`、`bloomRecover`；移動中 ×1.6、跳躍中 ×2.5、蹲下 ×0.8。
- 命中判定：先 `physics.raycast`（地形、建材、房屋、樹石），再測所有存活 actor 的頭球與身體膠囊，取最近。打到可受損物件呼叫其 `takeDamage(amount, info)`。
- 子彈不是瞬間看不見：fx 畫曳光（從槍口模型位置到命中點）。
- 換彈：彈匣空自動換；R 手動；換彈中切槍會中斷。
- 消耗品：選到該欄位、按住開火使用（走動速度減半，被打不會中斷，切欄位會中斷），進度條。

## 7. Physics（physics.js）

```js
class Physics {
  addBox({ cx, cy, cz, hx, hy, hz, yaw=0, owner, solid=true, kind }) -> id   // 有向盒（只繞 Y 旋轉）
  addRamp({ cx, cz, y0, size, rise, dir /*0..3：上坡方向 = -Z,+X,+Z,-X 的索引*/, thickness=0.25, owner }) -> id
  remove(id) ; update(id, props)
  groundHeight(x, z, feetY, radius) -> { y, normal, colliderId|null }   // 腳下可站的最高面（≤ feetY + 0.55），含地形
  moveCapsule(pos, vel, dt, radius, height) -> { pos, vel, grounded, groundNormal, hitWall, ceiling }  // 水平擋牆（滑牆）、上下（踩頂、撞頭）
  raycast(origin, dir, maxDist, { ignoreOwner, skipTerrain }) -> null | { point, normal, dist, colliderId, owner, kind }
  queryBox(min, max) -> colliderId[]       // 建造檢查佔位、bot 感知用
  overlapsCapsule(x, y, z, r, h) -> bool
}
```
- 空間雜湊格 8 m；碰撞只查附近格子。地形以 `terrain.heightAt` 解析處理（不是網格碰撞）。
- 斜坡：站在斜坡面上平順上下（不會抖、不會卡在斜坡底）；斜坡**下方可以走過去**（斜坡只是一塊有厚度的斜板）；從斜坡側面走過去被板子擋住的地方由高度差決定（≤ 0.55 跨上，否則擋住）。
- 射線要能打到斜板、盒、地形；`owner` 是建立 collider 時傳入的物件（建材、房屋板、樹…），讓 combat 呼叫 `owner.takeDamage`。

## 8. 角色（character.js）

```js
export function createCharacterFactory(ctx) -> {
  makeOutfit(rng) -> Outfit,                // 隨機外觀（膚色、髮型髮色、上衣褲子配色、帽子／頭巾／面罩等配件）
  create(actor) -> CharacterView,           // 建立並加進 scene
  playerOutfit: Outfit,                     // 玩家固定外觀（原創角色「阿嵐 RAN」：橘色連帽外套＋青綠圍巾＋護目鏡）
  glider(): Object3D,  pickaxe(): Object3D,  weaponModel(defId, rarity): Object3D,
}
CharacterView = {
  root: Group,
  update(dt, actor),          // 依 actor 狀態挑動作、混合、手持物、俯仰
  muzzleWorld(out) -> Vector3,// 槍口世界座標（曳光起點）
  handWorld(out),
  setVisible(bool),
  playOneShot(name),          // 'pickaxe'|'reload'|'build'|'hit'|'emote'|'consume'|'open'
  eliminate(),                // Fortnite 式淘汰：角色化成往上飄散的小方塊後消失
  dispose(),
}
```
- 比例：卡通英雄比例（約 6.5 頭身，手腳略粗，大手），不寫實；面部有眼睛、眉毛、嘴。高飽和配色。
- 骨架：Group 階層（hips → spine → chest → neck → head；chest → shoulderL/R → upperArm → foreArm → hand；hips → thighL/R → shin → foot）。不用蒙皮。
- 動作（程序式、平滑混合、跟速度同步）：idle 呼吸、走、跑、衝刺（身體前傾）、蹲走、跳起／落下／落地壓縮、自由落體（大字形，俯衝時頭朝下）、滑翔（雙手抓滑翔翼把手、身體擺盪）、持槍（上半身隨 pitch 俯仰、槍跟著準心）、ADS、換彈、使用消耗品、十字鎬揮擊、建造手勢、受擊抖動、勝利跳舞（emote）。
- 遠處 actor（> 120 m）降低動畫頻率；> 260 m 不更新骨架。

## 9. 世界（terrain.js、world.js）

- 地形：程序生成，固定種子；`terrain.heightAt(x,z)`、`terrain.normalAt(x,z,out)`、`terrain.isWater(x,z)`、`terrain.surfaceType(x,z) -> 'grass'|'sand'|'rock'|'path'|'water'`。高飽和草綠（多種綠、花叢色點）、暖色沙灘、陡坡露出岩石、城鎮之間有土路。海面是自訂著色器（淺藍綠、岸邊白色浪花、輕微波動）。
- 城鎮（原創名稱，5 個 POI ＋ 零散房屋）：
  - **蜂蜜鎮 Honeywick**：中心城鎮，十多棟兩層彩色房屋、小廣場、噴水池。
  - **風車農場 Pinwheel Farm**：穀倉、筒倉、大風車、圍欄、乾草堆。
  - **錫罐港 Tincan Harbor**：海邊碼頭、倉庫、貨櫃（金屬）、燈塔。
  - **菇菇林 Toadstool Grove**：巨型蘑菇與密林中的木屋。
  - **鵝卵石採場 Pebblepit**：採石坑、岩塊、工具棚。
- 房屋：彩色牆面（薄荷、珊瑚、奶油黃、天藍）、斜屋頂、門洞、窗、室內一樓二樓地板與樓梯、可進入。牆板、地板、屋頂由**可破壞的板塊**組成（用 InstancedMesh，被打掉就把該 instance 縮成 0 並移除 collider），十字鎬打牆給木或石。
- 樹（圓蓬卡通闊葉樹、松樹、灌木）給木；岩石給石；車子殘骸、貨櫃、金屬圍欄給金屬。被十字鎬打時會晃動，有 HP，打完消失並噴碎屑。弱點：每次揮擊在物件表面出現藍色圓點，下一擊打中弱點 ×2 傷害與材料（可簡化成「連續命中加倍」）。
- 採集量：每擊 木 +7 / 石 +6 / 金屬 +5（弱點 ×2）。
- `world.lootSpots` → `[{ x, y, z, inside:bool, poi }]`（約 160 個，室內較多）；`world.chestSpots` → `[{ x, y, z, yaw, poi }]`（約 45 個，多在房屋內）；`world.pois` → `[{ name, en, x, z, r }]`（給地圖標示與 bot 選落點）。
- 效能預算（1440×900、high）：draw calls ≤ 350、三角形 ≤ 1.2 M；InstancedMesh 用到極致。

## 10. 建造（build.js）

- 建材：`wall`（立在格邊）、`floor`（鋪在格面，層底）、`ramp`（佔一格一層，從層底升到層頂）。成本每件 10 材料。
- 材料特性：木 最大 HP 150，建造 2.8 s 長到滿血、初始 HP 10% ；石 300、6 s；金屬 500、11 s。建造中可立刻站上去、擋子彈（HP 隨時間成長）。外觀：木＝暖色木板、石＝灰藍石磚、金屬＝波浪鐵皮；建造中有半透明＋網格線的「搭建中」效果。
- 放置邏輯（全部用 actor 的 pos/yaw/pitch，玩家與 bot 共用）：
  - 目標格：角色前方 ≈ 2.6 m 的點所在格（4 m 格），層 = `floor((feetY + 0.4)/3.5)`；抬頭 > 25° 時 floor 往上一層、牆往上一層；低頭 < -35° 時 floor／ramp 放在腳下的格。
  - wall：放在角色所在格最接近面向方向的那一條邊；ramp：在前方格，上坡方向為角色面向的 4 向量化方向；floor：前方格。
  - 已有相同位置的建材 → 無效；與地形太深嵌入（建材 90% 在地下）→ 無效；與房屋／岩石大物件重疊可以（Fortnite 也可以）。
  - 預覽：藍色半透明全息線框（可放）／紅色（不可放或材料不足）。
  - 連續放置：按住放置鍵移動，目標改變時自動放下一件（衝刺建斜坡＝「ramp rush」必須可行：邊跑邊按住放 ramp 能一路往上蓋）。
- 結構支撐：每件建材必須經由相連建材接到地面（底部貼地形或嵌入地形 0.1 m 以上）。某件被摧毀時，BFS 找出不再連到地面的建材，0.3 s 後依序崩落（碎片＋聲音）。
- `build.takeDamage(piece, amount, info)`；建材 owner 物件實作 `takeDamage`。十字鎬打建材 50。
- `build.previewFor(actor) -> { piece, i, k, level, edge, dir, valid, reason }`，`build.place(actor) -> piece|null`，`build.pieces`（Map），`build.mode(actor) -> bool`，`build.selectedPiece(actor)`。
- 不能在離角色 > 7 m、或海裡蓋；對局 state 不是 `playing` 不能蓋。

## 11. 風暴（storm.js）

- 6 階段（秒、公尺、每秒傷害）：
  | 階段 | 等待 | 縮圈 | 結束半徑 | 傷害/s |
  |---|---|---|---|---|
  | 0 起始 | — | — | 600（蓋住全島） | 1 |
  | 1 | 70 | 55 | 300 | 1 |
  | 2 | 50 | 50 | 170 | 2 |
  | 3 | 45 | 45 | 95 | 5 |
  | 4 | 30 | 30 | 50 | 8 |
  | 5 | 25 | 25 | 22 | 10 |
  | 6 | 15 | 40 | 0 | 15 |
- 風暴總長 480 s（8 分鐘），加上飛艇＋跳傘約 50 s，整場約 8.8–9.5 分鐘。
- 下一圈圓心：在目前圈內隨機，且新圈完全落在目前圈內，盡量在陸地上。圓心與半徑在縮圈時線性插值移動。
- 風暴外每秒扣血（不扣盾），HUD 出現紫色暈影；鏡頭在風暴內時整個畫面偏紫、加霧、有低頻嗡鳴與閃電。
- 風暴牆：從海面到天空的半透明紫色圓柱牆（自訂著色器：流動的條紋、雲霧噪聲、邊緣發光），從外面看得到、從內往外看是紫色霧氣。
- `storm.center`、`storm.radius`、`storm.next { center, radius }`、`storm.phase`、`storm.state`、`storm.timeLeft`、`storm.isOutside(x,z)`、`storm.distToSafe(x,z)`。
- 測試 API：`__sw.storm.skip()` 跳到下一階段狀態。

## 12. 對戰流程（match.js）

- `menu`：標題畫面（原創 logo 字「築嵐島 STORMWRIGHT」），「開始對戰」按鈕、操作說明、畫質選項。背景是島嶼慢慢環繞的鏡頭。
- `bus`：一艘原創造型的**彩繪飛艇**（長圓氣囊＋吊籃＋螺旋槳，彩色條紋），以隨機直線航線 150 m 高、20 m/s 飛越全島；所有 actor 在飛艇上（隱藏角色、鏡頭跟飛艇）；HUD 顯示「按 空白鍵 跳下」與航線；飛艇開門前 5 s 不能跳；航線末端強制全部跳下。bot 依各自目標點跳。
- `playing`：剩餘人數、擊殺訊息、風暴；玩家淘汰後切換到觀戰擊殺者（可按鈕「回到大廳／再來一局」），玩家最後存活 → 勝利。
- 勝利畫面：「#1 風暴之冠 STORM CROWN」大字、角色跳舞 emote、慢動作鏡頭環繞；淘汰畫面：「你的名次 #N」、擊殺數、存活時間、造成傷害、建造件數。
- `match.busPos(out)`、`match.busDir`、`match.alive()`（存活數）、`match.start()`、`match.state`。

## 13. HUD（hud.js、index.html）— Fortnite 式配置

- 右上：小地圖（圓角方形，旋轉跟著玩家朝向或固定北方，畫風暴圈、下一圈白圈、POI 名、玩家箭頭），下方一列：風暴圖示＋倒數、剩餘人數圖示＋數字、擊殺數。
- 左下：護盾條（藍，上）與血條（綠，下），數字在條上；Anton 粗斜體白字＋深色描邊。
- 右下：6 格物品列（十字鎬＋5 格），格子背景依稀有度漸層，選中格放大＋白框，槍格顯示彈匣/備彈；上方材料欄（木／石／金屬圖示＋數量，目前建材高亮）。
- 中下：建造模式時顯示建材列（牆／地板／斜坡＋鍵位＋成本），取代武器列的焦點。
- 中央：準心（依武器：步槍十字會隨散布張開、霰彈槍圓圈、狙擊鏡框）；命中標記（白、爆頭黃）；浮動傷害數字（打到盾藍色、血白色、爆頭黃色），從命中點投影到螢幕往上飄。
- 左側中段：擊殺訊息（「A 用 突擊步槍 淘汰了 B」），右側中段：撿取通知。
- 頂部中央：風暴階段提示橫幅（「風暴眼正在形成」「風暴正在縮小！」）。
- 互動提示：靠近物品顯示「[E] 撿起 史詩 突擊步槍」卡片（稀有度色條）；寶箱「按住 [E] 開啟」環形進度。
- 受擊方向指示（紅色弧），風暴中紫色暈影，低血時紅色暈影。
- 大地圖（M）：全島地圖、POI、風暴圈、飛艇航線、玩家位置。
- 暫停（Esc，Pointer Lock 解除時）：繼續、設定（滑鼠靈敏度、畫質、音量、反轉 Y）、重新開始、回大廳。
- 手機（≤ 820 px 寬或觸控）：左下虛擬搖桿、右側拖曳轉鏡頭、按鈕（開火、瞄準、跳、蹲、換彈、建造、牆／地板／斜坡、互動、物品格可點）。390×844 不得水平溢出。
- 視覺語彙：深藍半透明面板、白色粗斜體 Anton 字、黃色重點色 `#ffe14d`、稀有度色、明亮天空。字體 fallback 見 §0。

## 14. 渲染（render.js）

- `WebGLRenderer({ antialias: true })`，`ACESFilmicToneMapping`、exposure ≈ 1.05、sRGB 輸出。
- 太陽 DirectionalLight（暖白，偏低角度下午陽光）＋陰影（跟隨玩家的陰影相機，2048，PCFSoft），HemisphereLight（天藍／草綠反光），少量環境光。
- 天空：漸層著色器（地平線淡、頂部飽和藍）＋太陽光暈＋卡通積雲（程序產生的蓬鬆雲團 billboard 或低多邊形）。
- 霧：淡藍色指數霧，遠山遠海柔化。
- 後製：輕微 bloom（UnrealBloomPass，閾值高、只讓太陽、風暴邊緣、傳說光柱發光）；`epic` 級加 SMAA 或 FXAA 可省略。
- 畫質級距 `low|medium|high|epic`：像素比、陰影大小與範圍、bloom 開關、草叢密度、視距。幀率過低自動降一級。
- 材質以 `MeshStandardMaterial`（roughness 0.75–0.9，metalness 0）＋ vertex color 為主，顏色高飽和；金屬物件 metalness 0.3。

## 15. 音效（audio.js）

`audio.play(name, { pos?, volume?, pitch? })`，有 pos 時依距離衰減與左右聲道。必備：每把槍的槍聲（遠近不同）、換彈、空彈匣、十字鎬敲木／石／金屬、建造放下（依材料）、建材破壞、腳步、跳／落地、命中標記叮聲、爆頭叮聲、淘汰音效、撿取、寶箱開啟（閃亮和弦）、寶箱附近持續閃亮聲、喝盾／繃帶、滑翔翼風聲、飛艇引擎、風暴嗡鳴、UI 點擊、勝利音樂短句。第一次使用者手勢才建立 AudioContext。

## 16. Bots（bots.js）

- 29 個，原創暱稱（俏皮中英混合，例如「布丁隊長」「SnackAttack」「鹹酥雞戰神」）。技能值 0.2–0.9 分佈。
- 行為：依各自目標 POI 從飛艇跳下 → 滑翔到落點 → 搜刮（地上物、寶箱）→ 往安全區移動（風暴倒數時提早）→ 遇敵交戰（視線檢查、反應時間 0.25–0.8 s、瞄準誤差隨技能與距離、側移、蹲、跳）→ 被打時有材料就蓋牆＋斜坡掩護（技能高的會蓋「箱子」：四面牆）→ 安全時補血補盾 → 偶爾採集材料。bot 之間也會互打，比賽要能在 8–10 分鐘內自然收斂到最後一人。
- 遠處 bot 用低頻 AI（> 150 m 每 0.25 s 一次）；遠處 bot 對 bot 的戰鬥可以用簡化機率結算，但距離玩家 < 150 m 必須真的開槍。
- 卡住偵測：繞路、跳、蓋斜坡越過障礙。

## 17. 測試 API 與驗收

`window.__sw`（main.js 建立，各模組可往上掛子物件）：
```js
__sw = {
  ctx, state(), start(), restart(),
  skipToGround(x?, z?),        // 立刻讓玩家在指定點（預設蜂蜜鎮）落地、進入 playing
  teleport(x, z),
  give(defId, rarity=2),       // 給武器或消耗品
  giveMats(n=999), giveAmmo(n=999),
  killBots(n), spawnBotNear(dist=12), freezeBots(bool),
  storm: { skip(), setPhase(n) },
  fastForward(seconds),        // 以固定步長快速模擬（不渲染）
  stats(),                     // { fps, drawCalls, triangles, alive, phase, ... }
  setQuality(q),
}
```
`tools/accept.mjs <html> [--out dir]`：Playwright（`process.env.PLAYWRIGHT_MODULE`，預設 `~/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`），Chromium 參數 `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`（失敗才退 swiftshader）。在 1440×900 與 390×844 兩種尺寸：開頁 → 等 `__sw` → `start()` → `skipToGround()` → 跑一段腳本（射擊、蓋牆／地板／斜坡、使用消耗品、風暴跳階段、`fastForward(60)`）→ 截圖（選單、飛艇、地面、建造、戰鬥、地圖）。檢查：無 uncaught exception、無 `console.error`、除 Google Fonts 外無外部請求、有 viewport meta、390 寬時 `document.documentElement.scrollWidth <= 390`。結果印 JSON，失敗時 exit code 1。
每個軌道各自打包到 `dist/<軌道名>/index.html`（`node tools/build.mjs --out=dist/<軌道名>`），驗收也跑那份，避免互相覆蓋。**只有主模型會打包到 `web/196-stormwright.html`。**
