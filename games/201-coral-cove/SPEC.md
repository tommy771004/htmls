# 珊瑚灣垂釣 · CORAL COVE（作品 201）規格與模組契約

俯視角的 3D 休閒釣魚。熱帶淺海清澈見底，玩家是戴斗笠的漁夫，在木棧橋上選魚餌（目前只有麵包）、甩竿、等魚上鉤、收線，釣到的魚放進魚簍，上方顯示「魚簍 2/8」。
**所有模型都用 Blender 腳本自己建模、綁骨與做動畫**（`blender/*.py`，Blender 5.2 無頭執行），不使用任何現成素材；匯出的 GLB 放在 `blender/out/` 並 commit，打包時以 gzip＋base64 內嵌成單檔 `web/201-coral-cove.html`，不載入外部資源。

## 指令

```bash
npm run assets         # 依序跑 blender/*.py，重建 blender/out/*.glb（需要 /Applications/Blender.app，可用 BLENDER 環境變數指定）
npm run build          # esbuild 打包 src/ + 內嵌 GLB → ../../web/201-coral-cove.html
npm test               # 桌機、直式與橫式手機的無頭 Chrome 驗收，另外檢查短直式／短橫式的魚卡（跑打包後的單檔；尺寸見 README）
node tools/view.mjs blender/out/fisher.glb --node fisher_rig --anim cast --times 0,0.3,0.55,0.9 --view side
node tools/glbinfo.mjs blender/out/fisher.glb --tree
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/fisher.py   # 單獨重建一個資產檔
```

- `tools/view.mjs`：用遊戲同版本 three 的 GLTFLoader 讀 GLB，在指定動畫時間點分格算圖到 `dist/view/`，印出根節點、動畫清單與包圍盒。**每做完一批資產都要用它看過**（Blender 的 Workbench 預覽對了不代表匯出後也對）。
- `blender/common.py` 的 `render()`／`sheet()`：Blender 內的 Workbench 預覽與動畫接觸表，輸出到 `dist/preview/`。
- `dist/` 在 gitignore 裡（`games/*/dist/`）。

## 座標與單位（所有模組共用）

- 1 單位 = 1 公尺。Blender 是 Z 朝上；glTF／three 是 Y 朝上。Blender 的 (x, y, z) 匯出後變成 three 的 (x, z, −y)。
- **面向**：角色、魚、船在 Blender 裡面向 **−Y**，匯出後面向 three 的 **+Z**。遊戲用 `rotation.y = yaw` 轉向，yaw = 0 時面向 +Z。
- 原點：會站在地上的東西（漁夫、木箱、魚簍、珊瑚、岩石、海草、椰子樹）原點在**底部中心**；船與浮標原點在**吃水線**；魚原點在**身體中心**。
- 根節點的位置與旋轉一律由遊戲重設，Blender 裡為了排版預覽而錯開的位置不影響遊戲。
- 低多邊形：平面著色（`flat()`）、少段數、頂點略為抖動（`jitter()`），不用貼圖，只用材質底色。單一資產檔 ≤ 400 KB。

## 調色盤（柔和、低彩度；各資產沿用，不要另起爐灶）

| 名稱 | 色 | 用途 |
|---|---|---|
| sand | `#f2dfb8` / 濕沙 `#e3c595` | 沙灘、海床 |
| lagoon | 淺水 `#8fe0d2`、中水 `#58c3c0`、深水 `#2f9aa8` | 水色（由遊戲著色器處理） |
| wood | `#c49a6c`、舊木 `#a5805c`、暗木 `#7d5f45` | 棧橋、船、木箱 |
| straw | `#e8c983`、暗 `#c9a35f` | 斗笠、魚簍竹編 |
| coral | 粉 `#f4a196`、杏 `#f7c08f`、丁香 `#c8a9d6`、奶油 `#f6e3a1` | 珊瑚 |
| kelp | `#7fb58a`、暗 `#5e9670` | 海草、椰葉 |
| fisher | 上衣 `#e9967a`（珊瑚橘）、褲 `#56717f`（石板藍灰）、膚 `#e7b58f`、腰帶 `#7d5f45` | 漁夫 |
| ink | `#3b3732` | 線條、眼睛、UI 墨線 |
| paper | `#fbf3e2` | UI 紙色 |

不用藍紫漸層、霓虹、發光。

## 資產檔與節點名稱（遊戲以名稱取用，不能改）

### `fisher.glb`（`blender/fisher.py`）

- 根節點：骨架 `fisher_rig`；蒙皮網格 `fisher`（身體、衣服、手腳合成一個網格，以 `bind_rigid` 綁定）。
- 身高約 1.6 m（不含斗笠），頭略大（Q 版 1:5 左右比例），俯視時斗笠是辨識重點：圓錐斗笠直徑約 0.9 m、高 0.3 m，掛在 `head` 骨上，有頂尖與下巴繫繩。
- 骨頭（名稱固定）：`root`（腳底，整體位移用）、`hips`、`spine`、`chest`、`neck`、`head`、`upperarm_L`、`forearm_L`、`hand_L`、`upperarm_R`、`forearm_R`、`hand_R`、`thigh_L`、`shin_L`、`foot_L`、`thigh_R`、`shin_R`、`foot_R`；釣竿四節 `rod_0`～`rod_3`（`rod_0` 掛在 `hand_R`，竿長約 2.2 m，竿身是同一個蒙皮網格的一部分或另一個綁在這些骨頭上的網格），竿尖骨 `rod_tip`（**head 在竿尖**，遊戲拿它的世界座標接釣線），捲線器把手骨 `reel_crank`（`rod_0` 的子骨，head 在捲線器中心、沿竿的左右軸，只繞自己的長軸轉）。左右以角色自身為準（`_L` 在角色左手邊 = Blender +X）。
- 竿上有捲線器（掛在 `rod_0`，靠近握把）：本體與線軸綁 `rod_0`，軸、把手臂與把手球綁 `reel_crank`。`reel` 動作裡 `reel_crank` 每個循環轉一圈、左手握著把手球跟著轉（拳心離把手球 < 1.5 cm）；其他動作 `reel_crank` 停在 0（把手球朝下）。
- 動作（名稱固定，30 fps）：

| 名稱 | 長度 | 循環 | 內容 |
|---|---|---|---|
| `idle` | 2.0 s | 是 | 竿扛在右肩、竿尖朝後上方，輕微呼吸 |
| `walk` | 0.9 s | 是 | 兩步一循環，步幅約 0.7 m（遊戲以 1.6 m/s 播放，速度不同時調 timeScale），竿仍扛在肩上、隨步伐晃 |
| `cast` | 1.0 s | 否 | 甩竿：0～0.45 s 竿往後上方舉起蓄力，0.45～0.65 s 往前甩，**0.55 s 出線**，結束時停在 `wait` 的起始姿勢 |
| `wait` | 2.4 s | 是 | 雙手持竿朝正前方、竿尖約高於水平 25°，輕微晃動 |
| `hook` | 0.4 s | 否 | 提竿：竿往上猛抬到接近垂直，結束時回到 `reel` 起始姿勢 |
| `reel` | 0.6 s | 是 | 收線：竿斜舉、竿身往前彎（`rod_1`～`rod_3` 前彎），左手握著把手球轉捲線器把手（`reel_crank` 一循環轉一圈），身體後仰用力；站位與 `wait` 相同（交叉淡入不滑步） |
| `stow` | 0.8 s | 否 | 收竿：從 `wait`／`reel` 姿勢把竿收回扛到肩上，結束時等於 `idle` 的起始姿勢 |
| `cheer` | 1.2 s | 否 | 釣到魚：左手高舉（遊戲把魚掛在 `hand_L`），右手持竿，身體跳一下 |

### `fish.glb`（`blender/fish.py`）

每個魚種一副骨架，根節點名＝`<魚種>_rig`，蒙皮網格名＝`<魚種>`，骨頭 `<魚種>_b0`（頭）→`<魚種>_b1`→`<魚種>_b2`→`<魚種>_b3`（尾鰭），以自動權重或手動漸層權重讓身體平順彎曲。原點在身體中心，面向 +Z（glTF）。

| 魚種 id | 中文 | 長度 | 外觀 | 可釣 |
|---|---|---|---|---|
| `clown` | 小丑魚 | 0.30 m | 杏橘底、三道白帶、黑邊鰭 | 是 |
| `tang` | 藍倒吊 | 0.40 m | 柔藍色扁身、黑紋、黃尾 | 是 |
| `snapper` | 紅笛鯛 | 0.55 m | 珊瑚粉、白腹、大尾叉 | 是 |
| `puffer` | 河豚 | 0.36 m | 奶油黃圓身、褐斑、小鰭 | 是 |
| `parrot` | 鸚哥魚 | 0.62 m | 薄荷綠＋粉紅鱗紋、鳥喙嘴 | 是 |
| `sardine` | 小沙丁魚 | 0.16 m | 銀藍背白腹，成群游 | 否 |

動作：`<魚種>_swim`（0.8 s 循環，尾巴左右擺，頭部小幅反向擺）、`<魚種>_flop`（0.4 s 循環，被釣起時大幅扭動）。俯視角下魚的背面輪廓與背色要好辨認。

### `reef.glb`（`blender/reef.py`）

靜態網格（根節點名稱固定，原點在底部中心）：`coral_branch`（鹿角珊瑚，高 0.7 m）、`coral_brain`（腦珊瑚，直徑 0.8 m）、`coral_fan`（扇珊瑚，高 0.9 m）、`coral_tube`（管珊瑚叢，高 0.5 m）、`coral_plate`（桌珊瑚，直徑 1.0 m）、`rock_a`／`rock_b`／`rock_c`（礁石 0.6～1.4 m）、`shell`（貝殼 0.15 m）、`starfish`（海星 0.25 m）、`palm`（椰子樹，高約 5 m，樹幹略彎、6～7 片葉）、`grass`（沙灘草叢 0.4 m）。
骨架：`seaweed_rig` + 蒙皮網格 `seaweed`（高約 1.2 m，3～4 片葉），骨頭 `seaweed_0`～`seaweed_3`，動作 `seaweed_sway`（3.0 s 循環，隨水流擺動）。

### `props.glb`（`blender/props.py`）

- `pier`：木棧橋。原點在**岸端中心、橋面頂**（local y = 0 是橋面）。走道沿 −Z 延伸：走道 x∈[−1.2, 1.2]、z∈[−13, 0]；盡頭平台 x∈[−3, 3]、z∈[−18, −13]。木板橫鋪（板間細縫、少數板略翹或缺角）、兩側有矮護欄只在走道段、平台四角有繫船柱、平台邊緣一側有下水梯；木樁每 2 m 一對，從橋面往下延伸到 local y = −4。遊戲把棧橋放在 world (0, 0.8, 6)。
- `boat`：小木船，長 3.2 m、寬 1.3 m，面向 +Z，原點在吃水線中心（船底約 −0.3 m），內有兩支槳、一個座板、船頭一圈繩。
- `crate`：木箱 0.6 m，原點底部中心。
- `creel`：魚簍（竹編，0.45 m 高、口徑 0.35 m，有背帶與蓋子掀開），原點底部中心。
- `bobber`：浮標，總高 0.14 m，上半珊瑚紅、下半白，頂端細天線；原點在吃水線（浮標中段）。
- `bread`：掛在魚鉤上的麵包丁 0.05 m；`bread_loaf`：一條小吐司 0.3 m（擺在木箱上當裝飾，原點底部中心）。
- `hook`：小魚鉤 0.04 m（原點在線結處）。

## 世界佈局（遊戲端，three 座標）

- 水面 y = 0。海床高度 `floorY(x, z)` 是 `src/world.js` 的解析函數：島嶼沙灘在 +Z 側（z > 8 附近露出水面），棧橋下約 −1.4 m，平台下約 −2.4 m，往外到 −3.5 m；珊瑚礁群集中在棧橋兩側與盡頭外。
- 棧橋 world (0, 0.8, 6)：走道 world z ∈ [−7, 6]、盡頭平台 z ∈ [−12, −7]。船繫在平台東側。
- 可行走區：棧橋橋面與沙灘。站在棧橋上面向水面才能甩竿。

## 玩法與輸入

- 狀態：`explore` →（按住甩竿蓄力）`charge` →（放開）`cast` → `wait`（浮標在水上，魚會被餌吸引、輕咬讓浮標抖動）→ `bite`（浮標被拉下去，約 0.9 秒內要提竿）→ `fight`（收線拔河）→ `catch`（舉魚、卡片顯示魚種與長度）→ 回 `explore`。任何時候按 E 都會收竿（`stow`）。
- 收線：按住收線鍵收線，魚拉的時候張力上升；張力滿太久斷線，鬆太久脫鉤。距離收到 1.2 m 內就釣起。
- 麵包餌被魚吃掉（沒提到竿）要重新甩竿；麵包無限供應。其他魚餌（蝦、沙蠶、亮片）顯示為上鎖格「之後開放」。
- 魚簍容量 8：上方顯示「魚簍 n/8」；滿了顯示結算（本簍的魚與長度），可以「放回大海，再釣一簍」。
- 鍵盤：WASD／方向鍵走路；空白鍵或滑鼠左鍵＝按住蓄力、放開甩竿／咬鉤時提竿／拔河時按住收線／舉魚時關魚卡；E＝收竿；B 或點魚餌圖示＝選魚餌（只有走動時）；C 或點上方魚簍＝魚簍與圖鑑；P＝暫停／繼續（沒有面板開著時 Esc 也會暫停）；M＝靜音／開聲音；Esc＝關閉面板。
- 開場卡按空白或 Enter 開始；結算卡開著時空白、Enter、Esc 都等於「放回大海」。焦點在大圓鈕上時按住 Enter 等於按住大圓鈕，在「E 收竿」上按 Enter 收竿。
- 觸控：左下虛擬搖桿；右下大圓鈕（甩竿／提竿／收線／繼續）、小圓鈕「E 收竿」；點魚餌圖示選餌、點上方魚簍看魚簍與圖鑑；右上「‖」圓鈕暫停、喇叭圓鈕靜音。
- 暫停（P、右上圓鈕，或分頁切到背景時自動）時世界停住；舉魚時暫停會先藏起魚卡，繼續後再顯示，魚卡自動關閉的計時也一起停。

## 介面

- 手繪風圓形圖示：紙色 `#fbf3e2` 圓底、墨色 `#3b3732` 不規則筆觸（SVG 路徑本身就畫成略歪的手繪線，可再加 feTurbulence 位移濾鏡），略微旋轉。
- 上方中央：魚簍圖示＋「魚簍 2/8」。左下（桌機）／左上（手機）：目前魚餌的圓形圖示（麵包）。右下：按鍵提示圓鈕（「空白 甩竿」「E 收竿」），依狀態切換文字。
- 字型只用系統字，圓體優先：`"Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Yu Gothic UI", system-ui, sans-serif`。

## 測試 API `window.__cc`

`ready`（模型載入完成後為 true）、`start()`（關掉開場卡）、`state()` → `{ phase, creel, creelMax, bait, pos:{x,z}, yaw, deck, tension, dist, power, bob:{x,y,z}, anim, fish:[{id,state,x,y,z}] }`（`deck` 是否在棧橋上、`power` 蓄力／出竿力道、`bob` 浮標位置、`anim` 漁夫目前的動作名）、`place(x, z, yaw)`、`cast(power 0..1)`、`bite()`（讓最近的魚立刻咬鉤）、`hook()`、`land(species?)`（直接釣起）、`setCreel(n)`、`stow()`、`timeScale(s)`、`hud(bool)`（截圖用，隱藏介面）、`cam(mode)`（`follow`／`overview`／`close`／`hero`）、`pose(action, t)`（漁夫停在某動作的某時間點，`pose(null)` 恢復）、`info()`（上一幀的 draw call 與三角形數）、`report()`（載入了哪些 GLB、哪些退回佔位幾何）、`game`（遊戲物件）。各呼叫的說明見 `README.md` 的表。
