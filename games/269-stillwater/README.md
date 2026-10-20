# 靜水釣遊 · Stillwater Row & Cast（作品 269）

俯視角划船探索與生態收集釣魚。從木屋碼頭出發往北（上游）划，沿途點亮 6 座燈樁，在 15 個釣點拋竿，把 55 種魚記進圖鑑。依使用者提供的《靜水釣遊》企劃書 v2.0（原為 Unity 工作流、18 個階段驗收）改成 Three.js 單檔，全部階段做進同一份頁面。

線上版：https://htmls-ruddy.vercel.app/web/269-stillwater.html

## 指令

```bash
npm run build      # esbuild 打包 src/ + 內嵌 blender/out/*.glb → ../../web/269-stillwater.html
npm run dev        # 同上但不壓縮
npm test           # tools/core.test.mjs（規則層）＋ tools/accept.mjs（1440×900、390×844、667×375 無頭 Chrome 驗收）
npm run assets     # 用 Blender 5.2 重建 blender/out/*.glb（boat、fisher、env、fish）
npm run thumb      # 產生 ../../thumbs/269.jpg（640×400，用 sips 縮圖）
node tools/mapimg.mjs                        # 河道、釣點、燈樁與巨石的除錯地圖 → dist/map.png
node tools/view.mjs blender/out/boat.glb --node boat --view top
```

`node_modules` 連到 `../201-coral-cove/node_modules`（three 0.186.0、esbuild、playwright-core）。驗收與縮圖用 `~/Library/Caches/ms-playwright` 裡快取的 Chrome for Testing（`CHROME_PATH` 可指定），先試 Metal，失敗退 SwiftShader。截圖輸出在 gitignore 的 `dist/`。

## 操作

| 動作 | 鍵盤 | 觸控 |
|---|---|---|
| 划船 | W／S 前進與倒划，A／D 轉向（單邊划槳） | 左下搖桿 |
| 拋竿 | 靠近釣點、船速放慢後按空白鍵 | 右下圓鈕 |
| 提竿 | 浮標沉下去時再按一次（0.35 秒內是完美提竿；有提燈時黃昏 +0.08 秒） | 同上 |
| 收線 | 按住空白鍵收線、張力進紅區就放開 | 按住圓鈕 |
| 收竿 | 等魚時按 W／S／A／D 或 Esc | 推搖桿 |
| 停泊 | E（點亮的燈樁 7.5 m 內、木屋碼頭附近） | 「停泊」／「碼頭」鈕 |
| 休息到下個時段 | T（只在燈樁或碼頭） | 面板裡的「休息」 |
| 圖鑑／暫停／靜音 | Tab 或 B／P／M | 右上三個鈕 |

## 規則摘要

- **時鐘**：06:00–11:00 早上、11:00–17:00 下午、17:00–20:00 黃昏，現實 1 秒約 1.43 遊戲分鐘；20:00 之後進入隔天清晨。開面板時時間停止。
- **燈樁**：划到 6 m 內自動點亮（鈴聲、旗子升起，黃昏點燈）。點亮後可停泊：休息到下個時段、快速移動到其他燈樁、順流返航到碼頭、放生魚簍裡的魚。
- **釣點**：每區 3 個，其中 1 個是深水魚王釣點（帶保底）；部分釣點依時段換位置。同一釣點連釣 3 條會休息 2 遊戲小時。
- **收線**：`src/core/reel.js`。進度 30% 起跳（完美提竿 +12%），張力 ≥ 80% 是紅區，在紅區停太久會斷線；平靜／暴衝輪替，特殊魚有躍出水面、深潛退線、鑽石縫鎖死、假動作、魚王連續猛扯。
- **品質**：`src/core/quality.js`。基礎分（0–60）＋完美提竿 20＋釣點加成 0–15＋收線加分（全程張力 < 80% 是無傷 25，進紅區 1 次 14、3 次內 6），45／65／82／95 分分別是良質／銀星／金星／王冠，再依門檻限制：銀星以上要最佳時段或完美提竿，王冠要最佳時段＋完美提竿＋無傷收線。
- **主線 5 章**（`src/core/quests.js`）：解鎖圖鑑與委託板 → 蠶絲釣線 → 船頭提燈 → 竹製名竿 → 金羽徽章。圖鑑 10／25／40／55 種解鎖船漆與帽帶。
- **魚簍** 8 格，滿了不能拋竿；回碼頭卸貨換積分（主線要交的魚會留下）。

## 結構

```
src/core/     規則層（不碰 DOM／three）：fishdb 魚種表、quality 品質、reel 收線、map 河道與釣點、grid 地形格、
              boat 划船物理與划槳公式、quests 時鐘／主線／委託／出魚、save 存檔
src/view/     畫面：terrain 地形、water 水面（深度貼圖、流向、漣漪、岸邊白沫、提燈倒影）、sky 三時段光影、
              scatter 環境物件與碰撞、boatview 船與漁夫動作、fishview 魚群 InstancedMesh、shoals 魚群行為、
              fishing 釣魚流程、fx 粒子、portrait 圖鑑肖像、assets 解開內嵌 GLB、placeholders 缺檔時的佔位幾何
src/ui/       HUD、面板、吊牌、自繪圖示與品質徽章
src/game.js   主迴圈、鏡頭、燈樁與釣點偵測、面板動作、window.__st
blender/      boat.py、fisher.py、env.py、fish.py（共用 common.py、meshkit.py、fishgen.py、rowing.py）
```

## 測試 API（`window.__st`）

| 呼叫 | 說明 |
|---|---|
| `state()` | 模式、釣魚階段、船位、區、附近釣點／燈樁、時鐘、魚簍、圖鑑數、張力、收線進度 |
| `report()` | 載入的 GLB、缺檔與用了佔位幾何的節點 |
| `start()` | 關掉開場招牌開始遊戲（網址加 `?play` 也會直接開始） |
| `toSpot(k, off)`／`toCp(k)`／`place(x, z, yaw)` | 把船移到釣點 k 南方 off 公尺、燈樁 k 的停泊點、任意位置 |
| `setTime(min)`／`timeScale(s)`／`zoom(d)` | 設時鐘（分鐘）、時間倍率、鏡頭距離（16–40） |
| `act(type, down)` | 送輸入事件：`act`（空白鍵）、`interact`、`book`、`pause`、`esc`、`mute`、`time` |
| `unlockAll()`／`fillBook(n, tier)`／`give(id, tier, n)`／`reset()` | 解鎖全部燈樁與升級、填圖鑑、塞魚進魚簍、清空存檔 |
| `hud(on)` | 隱藏 HUD（截圖用） |

網址加 `?touch` 會強制顯示觸控介面。

## 已知限制

- 俯視角沒有天空，三時段主要靠光的方向、顏色、霧與水色區分。
- 魚在水面下只畫成游動的剪影與水底軟陰影，沒有真正的折射。
- 船的碰撞只檢查船身 5 個點的水深與圓形障礙物，貼著岸邊轉向時槳會穿過岸上的物件。
- 存檔只在這台瀏覽器的 `localStorage`（`st269.save`）；無痕模式下關頁就消失。
