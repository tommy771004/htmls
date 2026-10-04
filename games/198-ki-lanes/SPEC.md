# 氣鬥三路 · KI LANES（作品 198）規格

把 2D 格鬥遊戲的「連段手感」放進俯視角三路推塔（MOBA）的瀏覽器遊戲。Three.js 0.186.0 + esbuild，打包成單檔 `web/198-ki-lanes.html`。角色、特效、地圖、音效全部原創、以程式產生，不使用任何原作素材或角色。

## 1. 機制分析（參考對象的核心機制 → 本作的對應）

### 格鬥遊戲（以《七龍珠 FighterZ》為參考）

| 原作機制 | 它在原作裡的作用 | 本作的對應 |
| --- | --- | --- |
| 自動連段（輕→中→重） | 同一按鍵連按就能接出連段，重攻擊把對手打飛結束連段 | 普攻三段鏈：L／M／H，1.6 秒內接續；第三段擊退並短暫硬直 |
| 連段數與命中停頓 | 每次命中畫面停一下（hit-stop），螢幕顯示「N HITS」 | 玩家參與的命中觸發全域時間停頓（輕 50ms、重 80ms、技能 110ms、必殺收尾 240ms）；連擊數 1.6 秒內累計 |
| 氣力條（Ki，7 格） | 打人、被打、集氣都會累積；花費於必殺技與瞬移 | 5 格氣力（每格 100）；造成傷害、受傷、普攻命中、按住 C 集氣都會增加；E 瞬移花 1 格、R 終極必殺花 3 格 |
| 氣功波（Ki Blast） | 遠距牽制 | Q：各角色的氣功波變體（直線彈、穿透槍、地波、連鎖雷） |
| 超衝刺（Super Dash） | 追蹤衝向對手、打破遠距對峙 | W：衝刺後接多段連打，命中最後一段把對手打飛 |
| 瞬間移動（Vanish） | 花 1 格氣，瞬移到對手背後一擊 | E：瞬移到游標處，游標附近有敵人時移到其背後，下一次普攻強化並打出硬直 |
| 超必殺技（Super / Meteor） | 花 1～3 格氣，演出鏡頭＋大傷害 | R：花 3 格氣，放招前 0.5 秒慢動作特寫、集中線、角色名字橫幅，再出招 |
| 爆氣（Sparking Blast） | 一場一次，強化並回血 | D：8 秒爆氣，傷害 +20%、移速 +25%、持續回血與回氣，冷卻 90 秒 |

### 推塔遊戲（以《英雄聯盟》為參考）

| 原作機制 | 本作的對應 |
| --- | --- |
| 俯視斜角鏡頭、右鍵移動／攻擊 | 約 55° 俯角，鏡頭跟隨玩家（Y 鍵切換自由鏡頭、空白鍵回到角色）；右鍵地面移動、右鍵敵人攻擊；QWER 朝游標施放 |
| 三路地圖、河道、野區、兩方主堡 | 180×180 的正方地圖，左下青隊、右上赤隊；上路、中路、下路，河道斜貫中央，野區是樹叢與岩石 |
| 兵線 | 每 25 秒每路每方出 3 近戰＋2 遠程小兵，沿路線前進並自動接戰；兵隨時間變強；第 10 波起每波多一台攻城兵，敵方該路內塔倒了再多一台（對建築傷害加倍，避免後期僵持） |
| 防禦塔 | 每路每方外塔、內塔各一；依序才能攻擊（外塔→內塔→主堡）；塔優先打小兵，敵方英雄在塔下攻擊己方英雄時改打該英雄；連續命中同一英雄傷害遞增 |
| 主堡 | 任一路內塔被破後主堡才會受傷；主堡被摧毀即勝負 |
| 等級與技能升級 | 附近小兵死亡、擊殺英雄、推塔得經驗；最高 12 級；每升一級得 1 技能點；Q/W/E 最多 5 級、R 在 4/8/12 級各可升 1 級；Ctrl+QWER 或點技能列的「＋」升級 |
| 復活與泉水 | 死亡後依等級等待復活；泉水快速回血回氣；B 鍵 4 秒回城 |

一場約 10～15 分鐘：塔血、兵量與經驗曲線都比原作快。

## 2. 角色（全部原創）

| id | 名稱 | 定位 | 元素色 | Q 氣功波 | W 衝刺連打 | E 瞬間移動 | R 終極必殺 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `homura` | 燎 HOMURA | 近戰鬥士 | 焰橘 `#ff7a1a` | 炎氣彈：直線彈，命中爆炸小範圍 | 燎原連打：衝刺，撞到敵人打 4 段＋打飛 | 殘影步 | 燎天烈波：22 單位長的巨大光束，持續 1.2 秒多段傷害 |
| `shimo` | 霜翎 SHIMO | 遠程 | 冰藍 `#7fd8ff` | 霜槍：長距穿透並減速 | 冰刃突進：穿過路徑上所有敵人，終點冰斬 | 霧隱步（距離較長） | 絕對零度：在游標處（14 內）落下冰隕，大範圍傷害＋冰凍 1.2 秒 |
| `iwao` | 磐岳 IWAO | 坦克 | 苔綠 `#9be03c` | 震地拳：扇形地波，擊飛 0.5 秒 | 山崩衝撞：衝撞，第一個英雄被頂著走並連打 | 縮地（附護盾） | 天崩：跳到游標處（10 內）砸地，大範圍擊飛 |
| `raiga` | 迅雷 RAIGA | 刺客 | 雷金 `#ffe14a` | 雷矢：快速彈，命中後連鎖 2 個附近敵人 | 迅雷百烈：衝刺接 6 段快打 | 閃：移到目標背後，重置普攻鏈 | 雷神千擊：在範圍內最多 5 個敵人之間來回瞬移斬擊 |

每隊 3 名英雄（玩家＋2 名 AI 隊友 vs 3 名 AI 敵人），每路一人；敵隊可以和我方重複角色，用隊伍色區分（青隊玉綠 `#24a38f`、赤隊朱紅 `#d9472b`）。

## 3. 座標與地圖

- 世界單位 = 公尺，`x` 向右、`z` 向下（朝鏡頭），`y` 向上。地圖 `x,z ∈ [-90, 90]`。
- 青隊主堡 `(-72, 72)`，泉水 `(-82, 82)`；赤隊為點對稱 `(x,z) → (-x,-z)`。
- 路線（青隊→赤隊方向的路點），赤隊的路線是同一條反向：
  - 上路：`(-66,56) (-72,10) (-72,-50) (-62,-64) (-50,-72) (10,-72) (56,-66)`
  - 中路：`(-58,58) (58,-58)`
  - 下路：上路的點對稱反向。
- 河道：`(-90,-90)` 到 `(90,90)` 的反斜線附近帶狀（中心線 `x = z`），寬約 10。
- 塔：每路沿路線距己方端點約 16～20%（內塔）與 37～39%（外塔）處（`map.js` 的 `STRUCTURES` 計算）。
- 障礙物是圓（樹叢、岩石），彼此不重疊，間隙 ≥ 2.6，避開路線、河道與基地；移動時推出圓外並沿切線滑動。

## 4. 模組（`src/`）

| 檔案 | 責任 |
| --- | --- |
| `main.js` | 啟動、固定步長迴圈（60 Hz 模擬，accumulator，hit-stop 是模擬時間倍率）、狀態機（select → play → end）、`window.__ki` 測試 API |
| `config.js` | 常數、色票、英雄數值、技能數值、經驗曲線 |
| `map.js` | 路線、塔位、障礙物、地面貼圖繪製、地形與植被網格 |
| `render.js` | renderer、場景、光、陰影、後製（bloom）、鏡頭跟隨與震動、畫質 |
| `models.js` | 英雄／小兵／塔／主堡的程式建模與動畫（見下方介面） |
| `units.js` | Unit 基底、Hero、Minion、Structure，移動、碰撞、傷害、死亡、經驗 |
| `combat.js` | 普攻鏈、技能、投射物、狀態（硬直、減速、擊飛、冰凍、護盾） |
| `ai.js` | 英雄 AI |
| `fx.js` | 粒子、光束、衝擊環、地面標記、浮動數字 |
| `hud.js` | DOM HUD、選角畫面、結算 |
| `input.js` | 滑鼠鍵盤、觸控 |
| `audio.js` | WebAudio 合成音效（見下方介面） |
| `minimap.js` | 小地圖 canvas |

### `models.js` 介面

```js
import * as THREE from 'three';
export function buildHero(id, team) // → HeroRig
// HeroRig = { root: THREE.Group, height: number, update(dt, anim) , setAura(level 0..1, color), dispose() }
// anim = { name, t, k }  name ∈ 'idle'|'run'|'atk1'|'atk2'|'atk3'|'cast'|'beam'|'dash'|'rush'|'vanish'|'charge'|'stun'|'air'|'dead'|'win'|'leap'
//   t：此動作已進行秒數；k：0..1 進度（若適用）。root 朝 +z 為正面，呼叫端設定 root.rotation.y 與位置。
export function buildMinion(team, kind)   // kind 'melee'|'ranged' → { root, update(dt, anim) }，anim.name ∈ 'walk'|'idle'|'atk'|'dead'
export function buildTower(team)          // → { root, update(dt, {charge:0..1, hp:0..1, dead}) , muzzle: THREE.Object3D }
export function buildCore(team)           // → { root, update(dt, {hp:0..1, dead, vulnerable}) }
export const HERO_IDS = ['homura','shimo','iwao','raiga'];
```

材質用 `MeshToonMaterial`（共用 3 階 gradientMap），外框用反向殼（BackSide、深墨色），全部 `castShadow`。尺寸：英雄約 1.9 高、小兵 1.1、塔 7、主堡 8。

### `audio.js` 介面

```js
export const audio = { init(), resume(), play(name, opts), setMaster(v), music(on) };
// name: 'hitL','hitM','hitH','blast','beamCharge','beam','dash','vanish','explode','freeze','thunder','slam','tower','towerHit','towerDown','minionDie','heroDie','levelUp','ki','kiFull','spark','recall','respawn','select','victory','defeat','ui'
```

## 5. 測試 API（`window.__ki`）

完整清單見 README.md。`state()` 回傳 `{phase, time, winner, kills, player:{hp,maxHp,ki,level,xp,sp,pos,alive,ranks,cds,action}, structures, heroes, minions, combo}`。
