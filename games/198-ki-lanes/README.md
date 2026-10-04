# 氣鬥三路 · KI LANES（作品 198）

《七龍珠 FighterZ》的連段手感 × 三路推塔。從悟空、貝吉塔、特南克斯、比克、弗利沙、人造人18號選一名，和兩名 AI 隊友對上三名 AI 敵人，推倒敵方主堡就獲勝。機制分析、角色技能表、地圖座標與模組契約見 [SPEC.md](SPEC.md)。

非官方同人作品：角色與招式名稱版權屬原作者；模型、特效、地圖與音效全部以程式產生，不含原作的貼圖、模型、圖示、音效或文字素材。

- 成品：`web/198-ki-lanes.html`（單檔約 2.7 MB，Three.js 0.186.0 與烘焙好的角色網格一起打包，不載入任何外部資源）
- 一場約 10～20 分鐘（全 AI 模擬 4 場：8～23 分鐘結束，中位數約 15 分鐘）

## 指令

```bash
npm ci
npm run build          # 打包成 ../../web/198-ki-lanes.html（--dev 不壓縮）
npm test               # 驗收：1440×900 與 390×844（觸控），見 tools/accept.mjs
node tools/sim.mjs 900 # Node 無頭模擬 15 分鐘（不渲染），每 60 秒印一次兵數、營地、擊殺、倒塔與英雄等級／金幣
node tools/fight.mjs 1440 900 frieza   # 開發截圖：兵線與 QWER 特效
node tools/mobile.mjs  # 開發截圖：手機版選角與觸控介面
node tools/jungleshot.mjs # 開發截圖：野區營地、戰爭迷霧、大猿
node tools/bushshot.mjs   # 開發截圖：草叢、眼
node tools/perf.mjs    # 開打 4 分鐘後的實際幀率
node tools/thumb.mjs   # 重拍 ../../thumbs/198.jpg
npm run models         # 重建六名英雄的網格（需要 Blender 5.2；約 25 秒），寫入 src/models-baked.js，再 npm run build
npm run models -- --only goku,vegeta   # 只重建部分英雄（其他沿用快取或現有的 models-baked.js）
node tools/viewer.mjs name "ids=goku&anim=atk1&t=0.1&ang=30&zoom=3&focus=handR"   # 開發截圖：角色檢視頁（參數見 tools/viewer-entry.js）
sh tools/heads.sh 25   # 開發截圖：六名角色的頭部特寫拼成 dist/view/heads.png
```

改了 `src/` 要重新 build，並把 `web/198-ki-lanes.html` 一起 commit。驗收工具用 `PLAYWRIGHT_MODULE` 指定 Playwright（預設讀 `~/.npm/_npx/…/playwright`），先試 Metal GPU、失敗再退 SwiftShader。

## 操作

| 輸入 | 作用 |
| --- | --- |
| 右鍵／左鍵 | 點地面移動、點敵人普攻；按住持續移動 |
| Q W E R | 朝游標施放（Ctrl＋鍵升級） |
| C（按住） | 集氣 |
| D | 爆氣（悟空、貝吉塔、特南克斯變身超級賽亞人） |
| P／點金幣 | 商店（泉水附近或陣亡時才能買） |
| 1 | 吃仙豆 |
| 4 | 插眼 |
| 5 | 放真眼 |
| B | 回城 |
| S | 停止 |
| Y／空白鍵 | 自由鏡頭／回到角色；滾輪縮放 |
| 小地圖 | 左鍵移鏡頭、右鍵移動 |
| H、Esc | 說明（暫停） |
| M | 靜音 |
| 觸控 | 左下搖桿、右下攻擊鍵（自動選最近的敵人）、技能鍵自動瞄準射程內的敵方英雄 |

## 測試 API：`window.__ki`

`start(heroId, lane, diff)`（heroId：`goku`／`vegeta`／`trunks`／`piccolo`／`frieza`／`a18`）、`state()`、`fastForward(sec)`（跳過頓幀與慢動作，直接跑固定步長）、`teleport(x,z)`、`moveTo`、`attack(id)`、`cast(key,x,z)`、`levelUp(key)`、`setLevel(n)`、`learnAll()`、`give({ki,xp})`、`freezeAI(bool)`、`spawnEnemyHeroNear(d)`、`enemyHero()`、`killPlayer()`、`damageStructure(id, amt)`、`destroy(id)`、`win()`、`lose()`、`camera(x,z,zoom)`、`follow()`、`pick(id)`、`pause(bool)`、`setQuality(0..2)`、`buy(itemId)`、`senzu()`、`setGold(g)`、`visible(unitId)`、`fog(bool)`、`camps()`、`boss()`、`heroes()`、`sell(slot)`、`ward(x,z)`、`control(x,z)`、`laneBushes(lane,team)`、`lanePoint(lane,team,prog)`、`wards()`、`bushes()`、`obstacles()`、`visibleTo(team,id)`、`listen(event)`。建築 id：`t{隊}{路}{i|o}`（例 `t11o` 是赤隊中路外塔）、`core0`／`core1`。

## 結構

模擬是 60 Hz 固定步長；命中頓幀（hit-stop）與必殺技慢動作是「模擬時間倍率」，只影響畫面節奏，冷卻、復活等全部以模擬時間計算。規則層（`world.js`、`units.js`、`combat.js`、`ai.js`、`items.js`、`jungle.js`、`vision.js`、`nav.js`、`map.js` 的資料部分）不依賴 DOM，可以直接在 Node 跑（`tools/sim.mjs`）。

| 檔案 | 內容 |
| --- | --- |
| `config.js` | 數值：英雄、技能、小兵、塔、經驗曲線 |
| `map.js` | 路線、塔位、障礙物、手繪地面貼圖、河水、植被 |
| `units.js` | 單位、移動與繞障、傷害、經驗、小兵與塔的 AI |
| `combat.js` | 普攻三段鏈、六名角色的 QWER、投射物、區域效果 |
| `ai.js` | 英雄 AI（守線補兵、換血連招、撤退回城買裝、遊走包抄、插眼拆眼、打野、集合打大猿） |
| `models.js` | 角色骨架與程式動畫、卡通材質與臉部貼圖，小兵、塔、主堡、野怪 |
| `models-heroes.js`、`models-baked.js` | 角色比例（PROPS）、英雄網格解碼、卡通材質（支援蒙皮）與臉部貼圖；`models-baked.js` 由 `blender/build_heroes.py` 產生 |
| `fx.js` | 粒子、命中火花、光束、死亡球、魔空包圍彈、圓頂爆炸、變身等特效 |
| `hud.js`、`icons.js` | HUD、技能圖示、選角與結算 |
| `input.js`、`minimap.js` | 滑鼠鍵盤、觸控、小地圖 |
| `audio.js` | WebAudio 合成音效 |
| `world.js` | 建立對戰、固定步長推進（畫面與 Node 模擬共用） |
| `nav.js` | A* 尋路 |
| `vision.js`、`fog.js` | 戰爭迷霧的可見格與畫面變暗 |
| `items.js`、`jungle.js` | 商店與道具、野怪與大猿 |
| `map-props.js` | 地圖裝飾（樹、岩石、懸崖、河道、基地） |
| `main.js` | 迴圈、場景同步、頭像算圖、測試 API |

## 角色模型（Blender）

六名英雄在 Blender 以 Python 腳本建模，產物 `src/models-baked.js` 有 commit，所以 build 不需要 Blender；只有改造型時才要（開發機用 Blender 5.2 LTS）。

- `npm run models` = `node tools/rig-dump.mjs`（從 `models.js` 的骨架算出 A 字綁定姿勢的骨頭位置，寫 `blender/rig.json`）＋ `blender -b --factory-startup --python blender/build_heroes.py`。改了 `models.js` 的骨架或 `models-heroes.js` 的 PROPS 也要重跑。
- `blender/kit.py`：斷面放樣（含前開口的弧形斷面，用來做 V 領與敞開的外套）、細分、布料加厚、等值線切割上色、骨熱權重、遮蔽、輸出。`blender/heroes.py` 是悟空與共用部件（軀幹、手臂、握拳、靴、動畫臉、髮束），`blender/cast.py` 是其他五名。
- 身體是一張蒙皮網格（11 根骨頭＋垂帶／尾巴的擺動鏈），頭顱與各型態的髮型是掛在頭骨的剛體網格；JS 端把骨架擺成同樣的 A 字姿勢後綁定，再交給原本的程式動畫。
- 每頂點存調色盤索引、材質碼（0 一般、1 頭髮、2 亮面、3 發光、4 皮膚、5 隊伍色）、遮蔽、外框粗細倍率與平滑法線；以欄位式串流差分後 zlib＋base64，六名約 1.8 MB。

建模時踩過的坑：骨熱權重在原尺寸常解不出來，要放大 10 倍算；開口的衣服殼會讓骨熱亂掉，所以權重改在封閉的替身（軀幹、骨盆、四肢）上算再轉移；上色交界先沿等值線切開網格再分島，邊界才會又平又銳利；一條管子硬折會在內側自我穿插，手指改成每節一顆膠囊。

## 視野、草叢與眼

- 樹叢與岩石擋視線（2 公尺格的視線檢查），草叢裡只有同一叢或貼身的敵人看得到；從暗處出手會現形 1.2 秒。
- 真眼（商店 75 金，最多帶 2 顆，按 5 放下）：敵我都看得到、不會消失，照出 9 公尺內的敵方眼讓人拆掉；每人場上只能有一顆。
- 每名英雄都有眼（按 4），插在 7 公尺內、持續 90 秒、冷卻 70 秒、同時最多 2 顆；敵方要帶戰鬥力探測器、氣力增幅器或波塔拉耳環，在 9 公尺內才看得到眼，普攻三下拆掉。

## 道具合成

基礎（負重護腕、修行道服、氣功護腕、武道鞋、戰鬥力探測器）→ 進階（界王拳腰帶、賽亞人戰甲、筋斗雲、氣力增幅器、再生細胞）→ 終極（超神水、波塔拉耳環）。購買時自動吃掉身上的材料、只付差額；商店點自己的道具可賣出（60% 總價）。AI 依定位逐步合成。

## AI 的遊走、包抄與埋伏

- 遊走包抄：自己那一路沒人時，支援正在交手的隊友或切壓到我方塔下的敵人後路，先繞到敵人與它家之間再出手。
- 草叢埋伏：鎖定一名落單、正沿路往我方推進的敵方英雄，兩到三名隊友先躲進它前方路邊的草叢（避開敵塔射程），不集氣以免暴露；敵人走近、或有人被它打到時一起出手。
- 插眼、放真眼、看到敵方眼就拆。

## 已知限制

- 角色比原本的 SDF 版多約 1 萬面（每名身體約 2.5 萬面），桌機實測幀率約 110（原本頂到 120 的垂直同步）。

- 埋伏只針對單一落單的敵人，不會針對大猿或推塔的時機設伏。
