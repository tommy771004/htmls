# 赭線 OCHRE LINE（278）

Babylon.js 9 WebGPU 寫實 5v5 回合制戰術射擊。esbuild 打包成單檔 `../../web/278-ochre-line.html`，模型與貼圖留在 `../../assets/278/`（約 63 MB，不內嵌）。規格在 `SPEC.md`，`SPEC_Super.md` 是使用者原檔，不可修改；對原手冊的取捨列在 `SPEC.md` 文末。

## 指令

```bash
npm run build                    # 正式單檔，約 7 MB
node tools/build.mjs --dev       # 不壓縮，約 12.5 MB，截圖除錯用；交付前一定要跑回 npm run build
node tools/build.mjs --count     # 注入數學類別配置計數，給零 GC 驗收用
npm test                         # tools/accept.mjs；--only desk,flow,guns,follow,draws,route,gc,snap 跑部分；--page=dist/x.html 驗自己的打包
node tools/gun-check.mjs m7[,b90] [--page=dist/x.html]   # 新槍實機：開火、換彈、檢視、舞台，截圖 dist/shots/gun_<id>_*.png
node tools/gun-reel.mjs m7[,b90] [--page=dist/x.html] [--u=.1,.2] [--cell=720] [--cycle|--inspect]   # 凍在換彈進度逐格截圖拼一張 dist/shots/reel_<id>_*.png，gun-check 的 reloadA／B 常錯過手接彈匣那幾格
node tools/gun-sheet.mjs out.png cols w h 標籤=圖檔 ...   # 拼合輯，走無頭 Chrome，機器上沒有 ImageMagick
node tools/gun-measure.mjs       # 新槍對 draw、開機、下載量的影響（base／替身／全載入）
node tools/menu-check.mjs [--match] [--only desk,port,land,x320,still]   # 主選單：真實點過每個分頁與按鈕、量溢出與遮擋，截圖存 dist/shots/menu_*.png；--match 再加打完一場、回選單、第二場
node tools/color.mjs             # 校色：讀 dist/shots/key.png（node tools/shot.mjs --spot key --q clean=1 產生，不加會拍到主選單）對 ref/
node tools/radar.mjs             # 重算雷達底圖 assets/278/radar.webp；地圖或光線變動才要跑
node tools/check-layout.mjs dist/layout.mjs   # 先 cp src/map/layout.js dist/layout.mjs
blender -b -P tools/build-soldier.py -- --stage arms [--only ar5,ks] [--dump dir] [--report file]   # 重烘第一人稱手臂
node tools/sfx.mjs [--verify]     # 音效烘焙：tools/sfx-table.mjs 的來源 → assets/278/sfx/{guns,foley}.mp3、src/audio/sfx-list.js、credits/sfx.md；--verify 重新逐頁確認 CC0
node tools/sfx-report.mjs         # 走實際訊號路徑（含限幅）量測每把槍，寫 dist/sfx-report.md，WAV 在 dist/sfx/ 給人聽；單發在音量 1.0 的「限幅前」要 ≤ -3 dBFS 才不碰限幅器，調 gain 要看這欄（wet 也會加峰值）
node tools/sfx-check.mjs [--page=dist/audio.html]   # 實機冒煙：點開始鈕、逐把開火換彈，確認走錄音路徑
blender -b -P tools/gun-icons.py # 武器剪影 assets/278/ui/<id>.webp（HUD、購買頁用 CSS mask）
```

無頭測試只能用 chrome-headless-shell，系統 Chrome 會搶滑鼠。`tools/lib/serve.mjs` 讀 `CHROME_PATH` 與 `PW_MODULES`，預設值指向某次 session 的 scratchpad，換機或換 session 後要自己設：

```bash
export CHROME_PATH=~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell
export PW_MODULES=$PWD/node_modules
```

## 架構

- `src/core/`：引擎、光照、輸入、素材路徑；`depthHack.js` 是第一人稱深度層（`renderingGroupId` 會打破 FAST 快照）。`tmp.js` 的 `snapshotActive` 管世界矩陣寫入。
- `src/map/`：`layout.js` 由 `tools/gen-layout.mjs` 產生，不要手改；`geo.js` 的 `Bucket.quad` 依法線自動定繞序；`build.js` 組牆面、組件。
- `src/game/`：`state.js` 是全遊戲共用狀態 `G`；`loop.js` 主迴圈；`round.js` 回合、經濟、事件紀錄；`weapons.js`、`bots.js`、`mover.js`（自製角色移動，Havok 只做 raycast）、`viewmodel.js`、`soldiers.js`。
- `src/ui/`：DOM HUD。觸控按鈕的圖示是 `touch.js` 的 inline SVG，位置與大小在 `style.js` 的 `.k-*`（`--s`，透明命中區靠 `::after` 外擴）。UI 每幀讀 `G`、只寫改變的節點，要動作走 `actions`。`--u` 是 1920×1080 設計稿的 1px。
- 主選單：`src/ui/menu.js` 是分頁（開戰、隊伍〔只在直式〕、軍械、簡報、操作、設定、署名），樣式在 `style.js` 的 `.m-*`，版面斷點是 `max-aspect-ratio:1/1`（直式）與 `max-height:520px`（橫式手機）。背景不是圖：`src/game/stage.js` 借士兵池 `pool[side][0]` 掛一個假 agent 站在日晷前，走 `updateSoldiers`，所以 FAST 快照、零配置都和遊戲中 bot 相同；開賽時 `bindSoldiers` 全部停放，`?clean=1`（校色、雷達、快照量測）不開舞台。鏡位在 `SHOT`（wide／tall／short），`__ol.tuneStage({ az, d, h, f, mx, my }, { x, z, face })` 現場調；`d` 拉太遠鏡頭會穿到近景物件。軍裝外觀直接來自 `soldier.glb`，換模型不用改選單。
- 主選單的資料都是實算的：名單用 `state.js` 的 `NAMES`（索引 1–4 隊友、5–9 對手），戰績與設定在 `src/game/record.js` 的 localStorage（`ochre-line.record.v1`、`ochre-line.settings.v1`），比賽打完才記、中途離開不算。數值來自 `WEAPONS`、`RULES`，軍械頁的表與 `buy.js` 共用 `COLS／DESC／SPEC／statRows`。不要加積分、好友、ping 這類單機沒有的東西。
- 開始鈕 `#m-go` 帶 `data-s`（目前選的邊），`accept.mjs` 用 `button[data-s=atk]` 找它，所以預設要是 `atk`。模式列用 `data-mode`。
- 回主選單不重載：`main.js` 的 `toMenu()` 呼叫 `leaveMatch()` 清比賽狀態，並把第一人稱槍收回開機時的隱藏狀態。主選單開著時 `input.menu` 為真，`input.js` 不攔 Tab、空白鍵、方向鍵，鍵盤才操作得了。
- `tools/arms_hd.py`：第一人稱手套與袖子的來源。原 GLB（`.cache/sketchfab/fps_benelli_m4_animations.glb`，不進 git，從 Sketchfab 重抓）的骨架帶不均勻縮放，Blender 匯入會拉成一條線，所以自己讀 glTF 算蒙皮，再逐骨對到 UBC 骨架的 rest。`ARM_SLIM` 控制袖子粗細。
- 新槍（c7 m7 b90 t4 x10 s6 n9）一把一組檔，互不改同一個檔：`src/game/guns/<id>.js`（數值、持握、音效參數）、`tools/guns/<id>.py`（模型模組，由 `build_guns_hd.py` 載入）、`assets/278/models/guns/<id>.glb`＋`<id>_arms.glb`、`assets/278/ui/<id>.webp`。`guns/index.json` 由 `tools/guns-manifest.mjs` 掃描產生，`build.mjs` 每次重掃；清單沒有的槍在 `src/game/guns/load.js` 走 `stand` 替身，不多 draw。製作規格在 `dist/GUN_SPEC.md`（本機，不進 git）。
- 新槍的貼圖微調寫在模組：`TINT = {'olive': (.3, .25, .3)}` 乘 albedo（第一人稱環境與自發光倍率高，橄欖會亮成黃綠、木色變橘；三通道壓綠才不會偏螢光），TINT 是整個材質 id 全部染，改之前先 grep 那個 id 用在哪些零件（x10 的鋁機匣曾因此染成黃銅，彈殼底後來改用專屬的 `brass`）；`BREAKUP = {'oxide': .3}` 在大平面加低頻明暗；新槍的刻字壓低對比，亮刻字只留給舊槍。`NODUST = [(y0, y1, z0, z1)]` 是建模座標的免積沙範圍（彈匣蓋住的面 AO 全黑，抽走會露出一整片沙）。只改貼圖用 `--stage tex,glb`，不必重跑 model。
- 音效：`src/audio/sfx.js` 每把槍是錄音主體＋合成低頻＋合成機械聲，合成層開機算成 `AudioBuffer`，開火只多幾個 `BufferSource`。音色在 `tools/sfx-table.mjs`（來源、`sig` 八度音色線、`hold`／`tau` 尾長），音量與合成層在 `src/audio/sfx-tune.js`，換彈與栓動的時間軸在 `src/audio/cues.js`（由 `tickWeapon` 依 `reloadT` 進度觸發，換槍自然中斷）。錄音載入失敗走 legacy 合成，`__ol.sfx()` 看 `synth` 數字。素材只用 Freesound CC0，`BAD` 字樣命中就中止，新來源不要繞過；下載檔只放 `.cache/sfx/`。單發不可碰到限幅器，否則起音被壓平（Chromium 的 DynamicsCompressor 另有自動補償增益），改音量後要跑 `sfx-report`。
- `tools/build-soldier.py`：士兵與手臂。手臂的 `stage_arms` 是接觸式握持：`WEAPON_POSE` 給手掌起始位置與前臂方向，`fit_hand`／`seat_support` 量真實槍面貼上去，手指閉合到碰到槍面，拇指用目標點反解。

## 除錯

`window.__ol`：`startMatch({side})`、`tuneStage(shot, foot)`、`giveWeapon(id)`、`forceClip(name,t)`、`teleport(x,y,z,yaw,pitch)`、`setClean(true)`、`spot(name)`、`speed(k)`、`sim(sec)`、`walk(sp,tag)`、`cpu(n)`、`orthoTop()`、`G`、`input`、`LAYOUT`。`window.__GAME_MCP__.poses` 是 `viewmodel.js` 的 `POSE`，可以在頁面上直接改數字比較持槍位置。`?clean=1` 隱藏 HUD，`?nosnap=1` 關快照。

## 坑

- **FAST 快照**：不可在 render loop 外手動 `scene.render()`。啟用後世界矩陣要 `computeWorldMatrix(true)` 加 `transferToEffect`，啟用前與 WebGL 不可呼叫（`snapshotActive.on` 把關）。快照啟用前換的槍要靠 `flushAll()` 補寫，否則那把會殘留在畫面上。
- **第一人稱隱藏**：holder 的 z 縮放是 -1。隱藏用 `HIDE`（負 z 的極小縮放），不能用 0：行列式不是負的，FAST 會把繞序記反，整組槍和手臂內外翻面，看起來像黑色空殼。士兵同理：`park()` 用 `1e-5`，縮成 0 時整隊士兵在快照裡內外翻面，從前面看到背心內側與後腦、從背後看到臉，`?nosnap=1` 正常是判斷依據。
- **繞序**：Babylon 左手系，幾何叉積與法線同向的繞序是背面。不要在呼叫端調點序，`Bucket.quad` 會自己處理。
- **ORM 的 R**：士兵與槍的貼圖在裝備區 R=0。當 AO 用會連日光一起乘掉（`ambientTextureImpactOnAnalyticalLights` 預設 1），背心和槍會全黑，所以這兩類關掉 `useAmbientOcclusionFromMetallicTextureRed`。
- **士兵外觀**：`BULK` 是兩隊的衣服厚度，`TEAM` 是色票，`solids()` 拼小零件（夜視鏡座、槍套），`hood_collar()` 是歹徒的帽子。底模是超級英雄體型，比例靠 `body_shape()`（`ARM_RAD` 手臂徑向、`SHOULDER_CAP` 壓肩頂、`HEAD_K` 頭部 xy）改，是位置函式，只動網格不動骨架，焊接點不裂，Pose／IK／socket 都不受影響，也只在 `team in BULK` 時作用，`arms.glb` 不受影響。眼睛網格要跟著 `body_shape`，`r.eyec`、護目鏡才對得上。上臂 .248＋前臂 .241 比人體短約 11 cm，所以操作地上裝置要用更低的跪姿，不要鎖直手臂或折腰（見士兵動畫）；改骨長會連 `arms` 階段一起受影響。胸腹硬裝備（`VEST_PARTS`：背心、肩帶、彈匣、無線電）不走最近頂點權重，走 `torso_field`（只看 rest 高度沿脊椎內插，肩頂帶鎖骨）；`bind_under_vest` 把背心 8 cm 內的身體也換成同一個場，兩者才會一起彎，身體不會穿出背心。這兩個都在 `assemble`，改了只要 `--stage all`。遊戲的色調會放大飽和度，色票要壓在中暗且低彩度：G 明顯高於 R 會變亮綠，R 明顯高於 G 會變卡其而融進沙牆，改完要進遊戲看，不要信 `--stage look`（靴子在 look 是黑的，遊戲裡金屬度強制為 0，是棕色）。`--stage geo` 只要 5 秒但身體未上色，`--stage bake` 加 `--stage all` 約 1 分鐘；只改動畫不用 bake，`--stage all` 5 秒。log 的 `clip` 行有腳底、頭頂高度、手臂伸展比（reach 接近 1 表示手被拉離目標）。
- **士兵動畫**：`dist/soldier-meta.json` 不會自動進 `src/`，要只取 `hitbox`／`socket`／`clips` 三欄寫回 `src/game/soldier-meta.json`。`leg_ik(off=...)` 擺跨步、跪姿、收腿，它保留來源膝向，腳收窄後會變 O 型腿，站姿要再用 `leg_to` 指定膝向。持槍都走 `Hold` 與 `apply_hold`：`LOW` 是低持貼胸，`cp` 鎖骨前收（肩關節到背心前緣有 29 cm，不收前臂一定穿背心），`po` 右肘外張量，`face` 頭的俯仰（手解完才用 `head_look` 定）。扭轉繞脊椎自身的軸，繞世界 UP 會把前傾轉成側傾。極向量朝地面，不要跟著槍框架。走路類 `calm()` 壓住來源的脊椎擺動，否則雙手鎖在槍上時肩擺全變成手臂伸縮；奔跑再加 `steady()`（彈跳、肩線）與 `holdc(damp=)`（槍錨定肩的循環平均）。站姿才用 `pin=True`，走路釘腳步態會斷。跪姿 `crouch_idle`、`plant`、`defuse` 不用來源動畫，是 `kneel_rest` 全身重建：`crouch_idle` 用 `kneel_legs`（右膝在後）；`plant`／`defuse` 用 `kneel_task`＋`kneel_low`（骨盆 .285、右膝在身前、坐在右腳跟上），彎腰大多在髖（tilt 26–28，脊椎只分 14 度），鎖骨沿軀幹軸前送 14 度再下沉，所以肩距 .459、雙肘 121–146 度。頭用 `head_look(pitch=…)` 定俯角，不要用 target 看地面，會把頸折到 80 度以上。`plant` 右手食指按三下鍵，`defuse` 左手提線、右手撥。`kneel` log 行有這些量測。左手拇指在步槍片段走 `Hands.thumb_lay`（`THUMB_FORE` 指定三節方向，沿護木左側朝槍口）：`finger_pose` 只往掌心彎，托護木時掌心朝上，拇指會豎起來。`plant`／`defuse` 前段是下跪，`LOOP_FROM` 寫進 meta 的 `clips.*.loopFrom`，`soldiers.js` 的 `wrap` 從那裡循環。裝藥位置 `DEVICE`（身前 .34，置中）要和 `round.js` 的 `showCharge` 一致，守方 bot 會走到裝藥前 .28–.46 m 才跪。`aim_rifle`／`aim_pistol` 在開火或 bot 有目標時播，平時低持。`play` 第四參數是片段倍速，走路隨實際速度。第三人稱火光用 `gunMuzzle` 取真實槍口。`loop.js` 的 `frame()` 依序判斷 `task`（plant／defuse，`s.busy` 同時把世界裡的槍收起來）、`hitT`、跳躍、蹲、移動。驗圖用 `__ol.forceClip(名稱, 秒)`；自由視角不跑 `frame()`，要直接設 `clipA／clipB`。
- **第一人稱打光**：`adopt()` 給 environment、direct 倍率與弱 emissive，手臂要設 `metallic=0`（否則映天空，轉向時忽白忽黑），倍率也和槍分開（手臂 1.7／.9／.03；槍 2.4／1.8／.3）。手套有淺棕色，環境光開太高會過曝。調亮前先確認不是上面兩個問題。
- **換彈**：`build-soldier.py` 的 `RELOAD_POSE` 解出左手抓彈匣的姿勢，輸出 `arms_<id>_L`（持握）與 `arms_<id>_LR`（抓彈匣），兩者頂點順序相同。執行時 `poseReload` 用 CPU 內插後 `VertexBuffer.update`（FAST 快照下 buffer 不變，不必動 bundle），手與彈匣的位移走節點＋`flush`。彈匣由 `splitPart` 在開機時依 `MAG` 範圍從槍身拆出來，手槍的彈匣藏在握把裡，模型只有底板，匣身是 `MAG_BODY` 補的方塊，下端要對齊底板中心。`MAG` 的範圍要包住整個零件才會被拆走：V11 的彈匣從握把底一路伸進機匣（y 到 0.08），範圍太小時只會掉一片底板。S8 沒有彈匣動畫。手槍類左手平時停在畫面外。
- **逐把換彈動畫**：`vm.tilt` 是換彈時整把槍的傾斜（x10 翻到 -38 度才看得到機匣底部的裝彈口，正方向翻會露出頂面），`vm.reach` 是手與彈匣離開畫面的方向；`vm.arc` 是手在兩個姿勢之間繞路的偏移（`poseReload` 是頂點內插，朝向差太多時半路手會塌，b90 頂置彈匣用它把手先帶出畫面再從左側上來，手機直式 y 乘 2.2）；`vm.inspect` 是檢視時往反方向翻的量（機匣寬或槍身短的槍預設值會讓袖口切面露出來，見 `INSPECT`）；`vm.slide` 是套筒後座距離，模型要有 `<id>_slide` 節點（`Gun.add(..., group='slide')`，多一個 draw），空槍鎖在後方，換彈 u .78–.84 放開。其他槍沒有分離的滑塊，後座是整把一起動。x10 的 `RELOAD` 是手掌朝上托裝彈口，`x10_mag` 是藏在裝彈口裡的一發彈殼：`poseReload` 的單發分支手先空手下去，回程才帶彈殼（`mag` 只在回程跟手），頓一下對齊 `weapons.js` 的每發進度；開火中斷時直接歸位。s6 的栓動是 `vm.cycle`：`fireKick` 起算，整把槍翻滾後拉，時間要短於 60/rpm、聲音在 `cues.js` 的 `AFTER_SHOT`；槍機沒有獨立網格，也沒有手在拉（槍機在右側看不到）。n9 的頂蓋同樣不動，只有聲音。l40、s8 沒有這套動作，維持舊樣。
- **檢視**：袖子網格的開口在肘部附近，檢視前半段翻滾超過約 30 度就會把開口轉進畫面，變成一大片黑布（全部步槍類都會）。所以 `iR`、`iY` 比後半段小，再用 `iH` 壓低，不要加大。
- **手臂取景**：玩家幾乎沿槍管看，前臂要接近平行槍管（`fore` 約 `(-.25,.3,.92)`）才會從畫面下方進來；橫向的前臂會從左側切入，手也蓋不到護木。手貼得準不等於畫面好看，改完要看第一人稱圖。
- **手臂烘焙**：舊武器的手臂在 `arms.glb`，新槍一把一檔。`--stage arms` 不加 `--only` 重烘 `arms.glb`，只含舊武器，新槍會跳過；`--only ar5` 不加 `--arms-out` 只算報告，不寫檔（2026-11-07 實測，舊文件寫會覆寫是錯的）；新槍用 `--only m7 --arms-out $PWD/../../assets/278/models/guns/m7_arms.glb`，握持寫在 `tools/guns/<id>.py` 的 `POSE`／`RELOAD`，開機由 `load_new_poses()` 併進 `WEAPON_POSE`／`RELOAD_POSE`，不要再抄進 `build-soldier.py`。不加 `--only` 時 `arms.glb` 寫出後才判門檻，門檻未全過時退出碼非 0，但 glb 仍是新的。換成高模手套後門檻未全過是常態（2026-11 有 38 項），門檻是舊網格的尺度，看第一人稱圖判斷。
- **裝彈、拆彈姿勢**：`kneel_task` 的手肘極點要朝後、雙腳不能開太寬，左膝外開讓手臂從膝內側穿過。手腕離裝置太遠時手臂會打直下垂，正面看像猩猩。調姿勢用 `--stage pose --team def --preview <dir>/ --clips plant:30:f,plant:30:q`，幾秒就有圖；`--stage all` 寫回 glb 後還要把 meta 三欄寫回 `src/`。
- **快照送矩陣**：一律用 `core/tmp.js` 的 `sendWorld`，不要直接呼叫 `transferToEffect`。UBO 是環形緩衝，快照錄到第二個緩衝時，只寫第一個的網格會留在世界裡，而 CPU 端的矩陣和 `_bufferData` 全是對的，只有畫面看得出來。驗收有「第一人稱跟著鏡頭」，用藏槍前後的畫面差異比三個朝向的位置，含改尺寸重錄。`sendWorld` 讀 Babylon 私有欄位（`_buffers`、`_buffer`、`_bufferData`），升級 Babylon 要重驗。
- **玩家命中**：`bindSoldiers` 不給玩家配士兵（第一人稱不畫自己），`shootOne` 對沒有 `soldier` 的目標改用 `bodyCaps` 的四段膠囊。別把 `!v.soldier` 的跳過加回去，否則子彈打不到玩家。驗收有「敵人子彈打得到玩家」。
- **零 GC 驗收**：Babylon 的數學類別實作在 `Maths/math.vector.pure.js`、`math.color.pure.js`，計數要注入 pure 檔。驗收含正向對照，對照沒數到就是注入失敗。`onBeforeRender` 內不可 `new Vector3/Matrix/Quaternion`，`getAbsolutePosition` 也會配置。
- **倍速測試要過渲染**：骨架與命中膠囊靠 render 更新，同步 `sim` 打不到人。整場比賽用 `speed(k)`。
- **校色**：`color.mjs` 的 sunFloor 分類受 v>.45 門檻影響，只比 ΔS 與 ΔE 的趨勢。
- **單檔**：`npm start` 的白名單含 `assets/`。素材路徑用 `ASSET_BASE`（`../assets/278/`）。
