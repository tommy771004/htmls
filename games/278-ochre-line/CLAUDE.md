# 赭線 OCHRE LINE（278）

Babylon.js 9 WebGPU 寫實 5v5 回合制戰術射擊。esbuild 打包成單檔 `../../web/278-ochre-line.html`，模型與貼圖留在 `../../assets/278/`（約 63 MB，不內嵌）。規格在 `SPEC.md`，`SPEC_Super.md` 是使用者原檔，不可修改；對原手冊的取捨列在 `SPEC.md` 文末。

## 指令

```bash
npm run build                    # 正式單檔，約 7 MB
node tools/build.mjs --dev       # 不壓縮，約 12.5 MB，截圖除錯用；交付前一定要跑回 npm run build
node tools/build.mjs --count     # 注入數學類別配置計數，給零 GC 驗收用
npm test                         # tools/accept.mjs；--only desk,env,lost,webkit,flow,guns,follow,draws,route,gc,snap 跑部分；--page=dist/x.html 驗自己的打包
node tools/bake-env.mjs           # 從 env.hdr 重烘 assets/278/sky/env.bin，要在閒置機器跑；--check 只比對
node tools/glitch.mjs             # 偶發畫面異常重現器；--env=1 記環境貼圖數值，--mode=resize|swap|delay
node tools/snap-cpu.mjs --ab=1    # 快照 CPU：同一頁 ABBA。不加 --ab 是兩頁各量（只用來看波動）
node tools/snap-phase.mjs         # 把 FAST 一幀拆段；--prof=1 印 V8 取樣（配 build --dev）
node tools/gun-check.mjs m7[,b90] [--page=dist/x.html]   # 新槍實機：開火、換彈、檢視、舞台，截圖 dist/shots/gun_<id>_*.png
node tools/gun-reel.mjs m7[,b90] [--page=dist/x.html] [--u=.1,.2] [--cell=720] [--cycle|--inspect|--part=bolt,cover] [--crop=x,y,w,h] [--js='v.CYCLE.s6[2]=30']   # 凍在換彈進度逐格截圖拼一張 dist/shots/reel_<id>_*.png，gun-check 的 reloadA／B 常錯過手接彈匣那幾格；--part 把活動零件通道釘在 u 看行程，--js 現場試數字
node tools/arm-check.mjs [p9,c7] [--page=dist/x.html] [--size=390x844] [--mode=reload|cycle|idle] [--step=.04]   # 逐格把手肘端的開口投影到畫面，進畫面就是手臂斷在半空。只看切口，不看手長，手有沒有壓扁、浮在中段還是要看 gun-reel 的圖
node tools/gun-sheet.mjs out.png cols w h 標籤=圖檔 ...   # 拼合輯，走無頭 Chrome，機器上沒有 ImageMagick
node tools/gun-measure.mjs       # 新槍對 draw、開機、下載量的影響（base／替身／全載入）
node tools/tp-check.mjs ar5,m7 --tag=x [--page=dist/x.html] [--clips=idle_rifle:.4,run_rifle:.2] [--mode=near,left,far,gsr,gsl,gfront,gunder] [--w=390 --h=844]   # 第三人稱持槍：走主選單舞台＋forceClip，截圖 dist/shots/tp_<tag>_<id>_<clip>_<mode>.png。g 開頭的鏡位用槍框架對準左手（gsr 右側、gsl 左側）；第一把槍要等舞台換好，清單前面放一把暖機
node tools/menu-check.mjs [--match] [--only desk,port,land,x320,still]   # 主選單：真實點過每個分頁與按鈕、量溢出與遮擋，截圖存 dist/shots/menu_*.png；--match 再加打完一場、回選單、第二場
node tools/color.mjs             # 校色：讀 dist/shots/key.png（node tools/shot.mjs --spot key --q clean=1 產生，不加會拍到主選單）對 ref/
node tools/radar.mjs             # 重算雷達底圖 assets/278/radar.webp；地圖或光線變動才要跑
node tools/check-layout.mjs dist/layout.mjs   # 先 cp src/map/layout.js dist/layout.mjs
blender -b -P tools/build-soldier.py -- --stage arms [--only ar5,ks] [--dump dir] [--report file]   # 重烘第一人稱手臂
node tools/sfx.mjs [--verify]     # 音效烘焙：tools/sfx-table.mjs 的來源 → assets/278/sfx/{guns,foley}.mp3、src/audio/sfx-list.js、credits/sfx.md；--verify 重新逐頁確認 CC0
node tools/sfx-report.mjs         # 走實際訊號路徑（含限幅）量測每把槍，寫 dist/sfx-report.md，WAV 在 dist/sfx/ 給人聽；單發在音量 1.0 的「限幅前」要 ≤ -3 dBFS 才不碰限幅器，調 gain 要看這欄（wet 也會加峰值）
node tools/sfx-check.mjs [--page=dist/audio.html]   # 實機冒煙：點開始鈕、逐把開火換彈，確認走錄音路徑
node tools/mp.mjs [--quick] [--page=dist/x.html] [--shots=dir]   # 連線對戰：兩、三個無頭分頁走完建房、加入、選邊、同步、互射、擊殺、購買、斷線接手、房主離開（npm run test:net 是房間邏輯）
node tools/balance.mjs --page=dist/x.html [--only=range,bots] [--trials=300] [--matches=3] [--modes=stand,fair] [--out=dist/balance.json]   # 武器與 Bot 實算：走真的 fire() 打骨架膠囊，整場比賽走 speed()
node tools/balance-report.mjs dist/balance.json dist/改動前.json dist/bots.json   # 出 dist/balance.md；第二參數沒有就填 -
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
- 設定頁（`menu.js` 的 `setHtml`）：子分頁 滑鼠／影像／音訊／準星／資料（`data-st`）。每一項都要接到遊戲裡真的會變的東西，`DEF` 是預設、`NUM` 是滑桿（存原單位，數字框顯示 ×k）、`CHOICE` 是下拉。改了立即生效並存檔；「放棄變更」回到進設定頁時的快照，「重設為預設」走頁內確認框（不要用 `window.confirm`，無頭測試會卡）。靈敏度存倍率 `look`，弧度是 `look × SENS0`（`input.js`，2026-11-08 由 0.0022 調低到 0.0015）；設定存 `v: 2`，v1 存的 `sens` 等於舊預設 0.0022 的視為沒調過。觸控轉向倍率依 `SENS0` 換算，轉速不變。渲染解析度走 `actions.res` → `setHardwareScalingLevel`，FAST 下中途切換實測正常；準星是 `#ui` 上的 `--xc／--xl／--xg／--xw`，比賽與預覽共用 `.xh`。不要加 FOV（袖口開口是照 90° 調的）、後製開關（快照錄好後改管線）、幀率上限（`getDeltaTime` 會錯）。`menu-check` 會逐一點過子分頁、打字進數字框、切下拉、放棄變更與重設確認。
- 開始鈕 `#m-go` 帶 `data-s`（目前選的邊），`accept.mjs` 用 `button[data-s=atk]` 找它，所以預設要是 `atk`。模式列用 `data-mode`。
- 回主選單不重載：`main.js` 的 `toMenu()` 呼叫 `leaveMatch()` 清比賽狀態，並把第一人稱槍收回開機時的隱藏狀態。主選單開著時 `input.menu` 為真，`input.js` 不攔 Tab、空白鍵、方向鍵，鍵盤才操作得了。
- `tools/arms_hd.py`：第一人稱手套與袖子的來源。原 GLB（`.cache/sketchfab/fps_benelli_m4_animations.glb`，不進 git，從 Sketchfab 重抓）的骨架帶不均勻縮放，Blender 匯入會拉成一條線，所以自己讀 glTF 算蒙皮，再逐骨對到 UBC 骨架的 rest。`ARM_SLIM` 控制袖子粗細。
- 新槍（c7 m7 b90 t4 x10 s6 n9）一把一組檔，互不改同一個檔：`src/game/guns/<id>.js`（數值、持握、音效參數）、`tools/guns/<id>.py`（模型模組，由 `build_guns_hd.py` 載入）、`assets/278/models/guns/<id>.glb`＋`<id>_arms.glb`、`assets/278/ui/<id>.webp`。`guns/index.json` 由 `tools/guns-manifest.mjs` 掃描產生，`build.mjs` 每次重掃；清單沒有的槍在 `src/game/guns/load.js` 走 `stand` 替身，不多 draw。製作規格在 `dist/GUN_SPEC.md`（本機，不進 git）。
- 新槍的貼圖微調寫在模組：`TINT = {'olive': (.3, .25, .3)}` 乘 albedo（第一人稱環境與自發光倍率高，橄欖會亮成黃綠、木色變橘；三通道壓綠才不會偏螢光）。世界模型照一般打光，壓過的貼圖會整把發黑，所以有 TINT 的槍 `stage_tex` 另存未壓暗的 `<id>_aw`（384、q45，約 8 KB），`stage_glb` 掛到 `<id>_w` 的 `<id>_pbr_w`，法線與 ORM 共用，第一人稱的三張圖位元組不變。不要用 `albedoColor` 或 `level` 整張補亮：鋼件的磨損與沙塵會變成迷彩斑、鋼色偏青（2026-11-07 試過）。TINT 是整個材質 id 全部染，改之前先 grep 那個 id 用在哪些零件（x10 的鋁機匣曾因此染成黃銅，彈殼底後來改用專屬的 `brass`）；`BREAKUP = {'oxide': .3}` 在大平面加低頻明暗；新槍的刻字壓低對比，亮刻字只留給舊槍。`NODUST = [(y0, y1, z0, z1)]` 是建模座標的免積沙範圍（彈匣蓋住的面 AO 全黑，抽走會露出一整片沙）。只改貼圖用 `--stage tex,glb`，不必重跑 model。
- 音效：`src/audio/sfx.js` 每把槍是錄音主體＋合成低頻＋合成機械聲，合成層開機算成 `AudioBuffer`，開火只多幾個 `BufferSource`。音色在 `tools/sfx-table.mjs`（來源、`sig` 八度音色線、`hold`／`tau` 尾長），音量與合成層在 `src/audio/sfx-tune.js`，換彈與栓動的時間軸在 `src/audio/cues.js`（由 `tickWeapon` 依 `reloadT` 進度觸發，換槍自然中斷）。錄音載入失敗走 legacy 合成，`__ol.sfx()` 看 `synth` 數字。素材只用 Freesound CC0，`BAD` 字樣命中就中止，新來源不要繞過；下載檔只放 `.cache/sfx/`。單發不可碰到限幅器，否則起音被壓平（Chromium 的 DynamicsCompressor 另有自動補償增益），改音量後要跑 `sfx-report`。尾長量的是相對這一發自己峰值的 -20 dB：共用空間的早期反射對低頻幾乎同相疊加（L40 wet 0→.8 峰值 +7.6 dB），低頻衝擊也只加峰值，兩者都會讓尾長變短，IR 的噪音尾只有 95 ms 補不回來，所以尾長不夠時要減 `wet` 和 `thump` 的量、再把 `gain` 拉回來，不是加 `wet`。同把變體的距離靠 `tight`（`tools/sfx.mjs` 的 `tighten`，1/3 倍頻帶拉向平均，音量對齊前 120 ms 能量）；要拉開兩把就改 `sig` 與 `thump` 頻率，低頻佔比高的槍量到的輪廓大半是 thump。`tools/lib/sfx-measure.mjs` 的起音點看前 5 ms，舊版只看單點，低頻槍會停在零交越，頻譜視窗晚 10–60 ms，報告兩種定義都列。
- `tools/build-soldier.py`：士兵與手臂。手臂的 `stage_arms` 是接觸式握持：`WEAPON_POSE` 給手掌起始位置與前臂方向，`fit_hand`／`seat_support` 量真實槍面貼上去，手指閉合到碰到槍面，拇指用目標點反解。

## 除錯

`?snapAt=N`：第 N 幀才啟用快照（配 `glitch.mjs --mode=swap`）。`window.__ol`：`cpu(n)`、`cpuAB()`（同頁交錯量快照）、`startMatch({side})`、`tuneStage(shot, foot)`、`stageGun(id, side)`、`pool`（士兵池）、`ik`（`ik.on = false` 看烘焙原樣）、`benchSoldiers(n)`（`updateSoldiers` 每次毫秒數）、`giveWeapon(id)`、`forceClip(name,t)`、`teleport(x,y,z,yaw,pitch)`、`setClean(true)`、`spot(name)`、`speed(k)`、`sim(sec)`、`walk(sp,tag)`、`cpu(n)`、`orthoTop()`、`G`、`input`、`LAYOUT`。`window.__GAME_MCP__.poses` 是 `viewmodel.js` 的 `POSE`，可以在頁面上直接改數字比較持槍位置。`?clean=1` 隱藏 HUD，`?nosnap=1` 關快照。

## 坑

- **FAST 快照**：不可在 render loop 外手動 `scene.render()`。啟用後世界矩陣要 `computeWorldMatrix(true)` 加 `transferToEffect`，啟用前與 WebGL 不可呼叫（`snapshotActive.on` 把關）。快照啟用前換的槍要靠 `flushAll()` 補寫，否則那把會殘留在畫面上。
- **第一人稱隱藏**：holder 的 z 縮放是 -1。隱藏用 `HIDE`（負 z 的極小縮放），不能用 0：行列式不是負的，FAST 會把繞序記反，整組槍和手臂內外翻面，看起來像黑色空殼。士兵同理：`park()` 用 `1e-5`，縮成 0 時整隊士兵在快照裡內外翻面，從前面看到背心內側與後腦、從背後看到臉，`?nosnap=1` 正常是判斷依據。
- **繞序**：Babylon 左手系，幾何叉積與法線同向的繞序是背面。不要在呼叫端調點序，`Bucket.quad` 會自己處理。
- **ORM 的 R**：士兵與槍的貼圖在裝備區 R=0。當 AO 用會連日光一起乘掉（`ambientTextureImpactOnAnalyticalLights` 預設 1），背心和槍會全黑，所以這兩類關掉 `useAmbientOcclusionFromMetallicTextureRed`。
- **士兵外觀**：`BULK` 是兩隊的衣服厚度，`TEAM` 是色票，`solids()` 拼小零件（夜視鏡座、槍套），`hood_collar()` 是歹徒的帽子。底模是超級英雄體型，比例靠 `body_shape()`（`ARM_RAD` 手臂徑向、`SHOULDER_CAP` 壓肩頂、`HEAD_K` 頭部 xy）改，是位置函式，只動網格不動骨架，焊接點不裂，Pose／IK／socket 都不受影響，也只在 `team in BULK` 時作用，`arms.glb` 不受影響。眼睛網格要跟著 `body_shape`，`r.eyec`、護目鏡才對得上。上臂 .248＋前臂 .241 比人體短約 11 cm，所以操作地上裝置要用更低的跪姿，不要鎖直手臂或折腰（見士兵動畫）；改骨長會連 `arms` 階段一起受影響。胸腹硬裝備（`VEST_PARTS`：背心、肩帶、彈匣、無線電）不走最近頂點權重，走 `torso_field`（只看 rest 高度沿脊椎內插，肩頂帶鎖骨）；`bind_under_vest` 把背心 8 cm 內的身體也換成同一個場，兩者才會一起彎，身體不會穿出背心。這兩個都在 `assemble`，改了只要 `--stage all`。遊戲的色調會放大飽和度，色票要壓在中暗且低彩度：G 明顯高於 R 會變亮綠，R 明顯高於 G 會變卡其而融進沙牆，改完要進遊戲看，不要信 `--stage look`（靴子在 look 是黑的，遊戲裡金屬度強制為 0，是棕色）。`--stage geo` 只要 5 秒但身體未上色，`--stage bake` 加 `--stage all` 約 1 分鐘；只改動畫不用 bake，`--stage all` 5 秒。log 的 `clip` 行有腳底、頭頂高度、手臂伸展比（reach 接近 1 表示手被拉離目標）。
- **士兵動畫**：`dist/soldier-meta.json` 不會自動進 `src/`，要只取 `hitbox`／`socket`／`clips` 三欄寫回 `src/game/soldier-meta.json`。`leg_ik(off=...)` 擺跨步、跪姿、收腿，它保留來源膝向，腳收窄後會變 O 型腿，站姿要再用 `leg_to` 指定膝向。持槍都走 `Hold` 與 `apply_hold`：`LOW` 是低持貼胸，`cp` 鎖骨前收（肩關節到背心前緣有 29 cm，不收前臂一定穿背心），`po` 右肘外張量，`face` 頭的俯仰（手解完才用 `head_look` 定）。扭轉繞脊椎自身的軸，繞世界 UP 會把前傾轉成側傾。極向量朝地面，不要跟著槍框架。走路類 `calm()` 壓住來源的脊椎擺動，否則雙手鎖在槍上時肩擺全變成手臂伸縮；奔跑再加 `steady()`（彈跳、肩線）與 `holdc(damp=)`（槍錨定肩的循環平均）。站姿才用 `pin=True`，走路釘腳步態會斷。跪姿 `crouch_idle`、`plant`、`defuse` 不用來源動畫，是 `kneel_rest` 全身重建：`crouch_idle` 用 `kneel_legs`（右膝在後）；`plant`／`defuse` 用 `kneel_task`＋`kneel_low`（骨盆 .285、右膝在身前、坐在右腳跟上），彎腰大多在髖（tilt 26–28，脊椎只分 14 度），鎖骨沿軀幹軸前送 14 度再下沉，所以肩距 .459、雙肘 121–146 度。頭用 `head_look(pitch=…)` 定俯角，不要用 target 看地面，會把頸折到 80 度以上。`plant` 右手食指按三下鍵，`defuse` 左手提線、右手撥。`kneel` log 行有這些量測。左手拇指在步槍片段走 `Hands.thumb_lay`（`THUMB_FORE` 指定三節方向，沿護木左側朝槍口）：`finger_pose` 只往掌心彎，托護木時掌心朝上，拇指會豎起來。`plant`／`defuse` 前段是下跪，`LOOP_FROM` 寫進 meta 的 `clips.*.loopFrom`，`soldiers.js` 的 `wrap` 從那裡循環。裝藥位置 `DEVICE`（身前 .34，置中）要和 `round.js` 的 `showCharge` 一致，守方 bot 會走到裝藥前 .28–.46 m 才跪。`aim_rifle`／`aim_pistol` 在開火或 bot 有目標時播，平時低持。**第三人稱左手**：動畫把左手烘在槍框架 `(0, .075, .22)`（AR5 的護木），其他步槍類由 `soldiers.js` 的 `holdSupport` 執行時 IK 滑到各槍的 `support`（新槍 `guns/<id>.js`，舊槍 `SUPPORT`），手的世界朝向與手肘方向沿用動畫，手指不動；權重跟著 `HOLD` 片段混合。它在 `sk.prepare` 之前自算胸到雙手的 FK，改節點後只 prepare 一次（第二次 prepare 會多上傳一次骨架貼圖）。`support` 的 y 約是護木下緣（AR5 烘焙值比下緣低 .02，手偏低，新槍都貼齊下緣），用 `tp-check --mode=gsr,gsl` 看手指有沒有包到槍；z 太遠手臂會打直，S8 的護木滑套在 .34 以後，手只能停在 .29。手槍在 `crouch_*`、`back_rifle`、`strafe_*`、`jump`、`hit` 仍走步槍片段，左手懸空，還沒處理。`play` 第四參數是片段倍速，走路隨實際速度。第三人稱火光用 `gunMuzzle` 取真實槍口。`loop.js` 的 `frame()` 依序判斷 `task`（plant／defuse，`s.busy` 同時把世界裡的槍收起來）、`hitT`、跳躍、蹲、移動。驗圖用 `__ol.forceClip(名稱, 秒)`；自由視角不跑 `frame()`，要直接設 `clipA／clipB`。
- **第一人稱打光**：`adopt()` 給 environment、direct 倍率與弱 emissive，手臂要設 `metallic=0`（否則映天空，轉向時忽白忽黑），倍率也和槍分開（手臂 1.7／.9／.03；槍 2.4／1.8／.3）。手套有淺棕色，環境光開太高會過曝。調亮前先確認不是上面兩個問題。
- **換彈**：`build-soldier.py` 的 `RELOAD_POSE` 解出左手抓彈匣的姿勢，輸出 `arms_<id>_L`（持握）與 `arms_<id>_LR`（抓彈匣），兩者頂點順序相同。執行時 `poseReload` 用 CPU 內插後 `VertexBuffer.update`（FAST 快照下 buffer 不變，不必動 bundle），手與彈匣的位移走節點＋`flush`。彈匣由 `splitPart` 在開機時依 `MAG` 範圍從槍身拆出來，手槍的彈匣藏在握把裡，模型只有底板，匣身是 `MAG_BODY` 補的方塊，下端要對齊底板中心。`MAG` 的範圍要包住整個零件才會被拆走：V11 的彈匣從握把底一路伸進機匣（y 到 0.08），範圍太小時只會掉一片底板。S8 沒有彈匣動畫。手槍類左手平時停在畫面外。
- **逐把換彈動畫**：`vm.tilt` 是換彈時整把槍的傾斜（x10 翻到 -38 度才看得到機匣底部的裝彈口，正方向翻會露出頂面），`vm.reach` 是手與彈匣離開畫面的方向；`vm.arc` 是手在兩個姿勢之間繞路的偏移（`poseReload` 是頂點內插，朝向差太多時半路手會塌，b90 頂置彈匣用它把手先帶出畫面，手到畫面外才換姿勢，再從左側上來，手機直式 y 乘 2.2）；直式畫面又高又窄，`REACH_TALL` 把 `vm.reach` 的 y（往下時）、z 放大，手與彈匣才出得了畫面，不然整段換彈掛在中段（手臂長度不變，動的是位移）；`vm.inspect` 是檢視時往反方向翻的量（機匣寬或槍身短的槍預設值會讓袖口切面露出來，見 `INSPECT`）；`vm.slide` 是套筒後座距離，模型要有 `<id>_slide` 節點（`Gun.add(..., group='slide')`，多一個 draw），空槍鎖在後方，換彈 u .78–.84 放開。其他槍沒有分離的滑塊，後座是整把一起動。x10 的 `RELOAD` 是手掌朝上托裝彈口，`x10_mag` 是藏在裝彈口裡的一發彈殼：`poseReload` 的單發分支手先空手下去，回程才帶彈殼（`mag` 只在回程跟手），頓一下對齊 `weapons.js` 的每發進度；開火中斷時直接歸位。s6 的栓動是 `vm.cycle`：`fireKick` 起算，整把槍翻滾後拉，時間要短於 60/rpm、聲音在 `cues.js` 的 `AFTER_SHOT`；整把槍偏航露出右側，`vm.parts` 的栓柄先轉開（通道 `lift`）再後拉（`pull`），右手是 `arms_s6_RB`（`tools/guns/s6.py` 的 `CYCLE_HAND`、`build-soldier.py` 的 `pos_bolt`）內插出來的，`buildBoltHand`／`poseBoltHand` 讓手跟著 `vm.knob`，栓柄的軸與行程讀零件資料。n9 換彈時頂蓋掀開（通道 `cover`），進彈槽裡的彈鏈是模型的一部分。l40、s8 沒有手動上膛／泵動：手與全身在 `arms.glb` 同一網格（s8 左手就在 `arms_s8`），要手跟著得重烘舊手臂。
- **活動零件**：`vm.parts`（舊槍在 `viewmodel.js` 的 `PARTS`）用範圍選零件，不是獨立網格，不加 draw：`buildParts` 用 `box`／`skip` 配連通塊標出頂點，開機時把三角形重排到槍網格尾端，每幀 `VertexBuffer.updateDirectly` 只上傳那一段，旋轉的零件才更新 normal。座標是槍框架 glTF（`gltf = (-X, Z, Y)`），欄位見 `guns/index.js`。通道 `vm.ch = { bolt, pull, lift, cover }`，`vm.pin` 除錯固定。`bolt` 是開火往復（`vm.boltT` 秒，連發要短於 60/rpm）、空槍掛後方、換彈收尾拉一次。第一人稱實際看得到的是頂部與左側，所以 n9、x10 的拉機柄做在左側（`tools/guns/n9.py`、`x10.py`），只做在右側等於沒做。
- **新槍的 `arms_<id>_LR` 別留在 `__root__`**：`poseReload` 只拿它的頂點，用完要 `dispose`，否則世界原點多畫一隻手，每把多一個 draw（2026-11-07 修掉 6 個，WebGPU 570→564、WebGL 282→276）。
- **檢視**：袖子網格的開口在肘部附近，檢視前半段翻滾超過約 30 度就會把開口轉進畫面，變成一大片黑布（全部步槍類都會）。所以 `iR`、`iY` 比後半段小，再用 `iH` 壓低，不要加大。
- **手臂取景**：玩家幾乎沿槍管看，前臂要接近平行槍管（`fore` 約 `(-.25,.3,.92)`）才會從畫面下方進來；橫向的前臂會從左側切入，手也蓋不到護木。手貼得準不等於畫面好看，改完要看第一人稱圖。
- **手臂烘焙**：舊武器的手臂在 `arms.glb`，新槍一把一檔。`--stage arms` 不加 `--only` 重烘 `arms.glb`，只含舊武器，新槍會跳過；`--only ar5` 不加 `--arms-out` 只算報告，不寫檔（2026-11-07 實測，舊文件寫會覆寫是錯的）；新槍用 `--only m7 --arms-out $PWD/../../assets/278/models/guns/m7_arms.glb`，握持寫在 `tools/guns/<id>.py` 的 `POSE`／`RELOAD`，開機由 `load_new_poses()` 併進 `WEAPON_POSE`／`RELOAD_POSE`，不要再抄進 `build-soldier.py`。不加 `--only` 時 `arms.glb` 寫出後才判門檻，門檻未全過時退出碼非 0，但 glb 仍是新的。換成高模手套後門檻未全過是常態（2026-11 有 38 項），門檻是舊網格的尺度，看第一人稱圖判斷。
- **裝彈、拆彈姿勢**：`kneel_task` 的手肘極點要朝後、雙腳不能開太寬，左膝外開讓手臂從膝內側穿過。手腕離裝置太遠時手臂會打直下垂，正面看像猩猩。調姿勢用 `--stage pose --team def --preview <dir>/ --clips plant:30:f,plant:30:q`，幾秒就有圖；`--stage all` 寫回 glb 後還要把 meta 三欄寫回 `src/`。
- **快照送矩陣**：一律用 `core/tmp.js` 的 `sendWorld`，不要直接呼叫 `transferToEffect`。UBO 是環形緩衝，快照錄到第二個緩衝時，只寫第一個的網格會留在世界裡，而 CPU 端的矩陣和 `_bufferData` 全是對的，只有畫面看得出來。驗收有「第一人稱跟著鏡頭」，用藏槍前後的畫面差異比三個朝向的位置，含改尺寸重錄。`sendWorld` 讀 Babylon 私有欄位（`_buffers`、`_buffer`、`_bufferData`），升級 Babylon 要重驗。
- **視角跟畫面幀、移動跟 tick**：滑鼠位移由 `player.js` 的 `look()` 每幀消耗（在 `main.js` 的 tick 迴圈前呼叫），不要搬回 64 Hz 的 `tickPlayer`：120 Hz 螢幕會有近一半的幀視角不動（2026-11-08 實測 132／281 幀），橫移一頓一頓。死亡、暫停、自由視角時 `look` 直接丟掉位移。鏡頭後座 `kickP／kickY` 也用前一 tick 的值內插；`updateViewmodel` 的擺動把每幀轉角換算成 60 fps 一幀，擺幅不隨更新率變。
- **玩家命中**：`bindSoldiers` 不給玩家配士兵（第一人稱不畫自己），`shootOne` 對沒有 `soldier` 的目標改用 `bodyCaps` 的四段膠囊。別把 `!v.soldier` 的跳過加回去，否則子彈打不到玩家。驗收有「敵人子彈打得到玩家」。命中回饋在 `weapons.js` 的 `damage`：打頭且有頭盔回傳 true，`shootOne` 改噴 `particles.js` 的 `sparks`（火光池，不加網格），否則噴血；爆頭聲是 `sfx.js` 的合成音 `helmet`（金屬鏗聲）與 `head`，射手是玩家時不衰減。命中膠囊在開槍時才更新，測試要先打一發才讀得到頭部高度。
- **零 GC 驗收**：Babylon 的數學類別實作在 `Maths/math.vector.pure.js`、`math.color.pure.js`，計數要注入 pure 檔。驗收含正向對照，對照沒數到就是注入失敗。`onBeforeRender` 內不可 `new Vector3/Matrix/Quaternion`，`getAbsolutePosition` 也會配置。
- **射擊手感**（2026-11-08）：
  - 散布全部由 `weapons.js` 的 `spreadOf(a)` 計算，`fire()` 與動態準星共用。移動懲罰是連續曲線：最高速 30% 以下不加，之後依 t^1.5 長到跑步值，靜步約為跑步的 1/5。空中 +0.092。騰空超過 0.2 s 落地時 `landT` 加散布，玩家另外減速 ×0.8。下樓梯的短暫離地不算。
  - 射速餘數會帶到下一發（`fireT` 在一個 tick 內到期就累加），不然 64 Hz 會把 700 rpm 進位成 640。
  - 後座回復：`burst` 是小數，停火超過「射擊間隔 + 0.05 s」後每秒退 25 發，不再過 0.32 s 一次歸零。讀彈道表要 `|0`。畫面後座在相鄰兩發之間內插。`burstT` 仍代表「0.32 s 內開過槍」（Bot 聽覺、第三人稱姿勢）。Bot 連發到上限就設 `cool`，等索引退到 1.5 以下才繼續開火。
  - 中彈上抬 `G.punch`：鏡頭和子彈的仰角都要加上，有甲 ×0.55，在 `tickMe` 衰減。
  - 輸入：`input.firePress`／`jumpPress` 記錄按下的瞬間，tick 消耗，同一幀內按下又放開也不會漏。`look()` 在 `main.js` 的 tick 迴圈之前呼叫，開槍用的是這一幀最新的視角。
  - 動態準星：`hud.js` 把「目前散布 − 站定散布」加上連發量換算成像素，寫到 `#cross` 的 `--xd`。設定在準星分頁的「準星樣式」（`xs`，預設動態）。
- **槍械擬真**（2026-11-08）：
  - 換彈：閉鎖式槍機（`chamber()`：非單發裝填、非 n9）沒打空就換彈，是戰術換彈：時間 ×`TAC_K` 0.85，跳過拉機柄／放滑套的聲音（`BOLT_CUE`）與第一人稱拉柄動作（`vm.tac`），裝完膛內多一發（30+1）。打空的換彈照原表時間。換彈進度用 `a.reloadDur`，不要再用 `w.reload`。
  - 拔槍：`drawTime(w)` 寫進 `fireT`，拔出前不能開火、開鏡、丟投擲物（玩家 `setCur`、買槍、Bot `equip`）。第一人稱舉槍動畫是拔槍時間 ×0.85。
  - 開鏡：`m.scopeT` 在 `SCOPE_IN` 0.3 s 內從 0 到 1，`spreadOf` 從腰射散布平滑收到開鏡散布。視角縮放約 0.1 s（`fovNow`）。開鏡移動速度 ×0.55。開鏡晃動 `G.swayY/swayP`：蹲下減半，移動與落地時變大，鏡頭與子彈都加。栓動槍（`AFTER_SHOT` 有項目）開槍後退出瞄準鏡，拉完栓自動回鏡（`rezoom`），拉栓中按右鍵取消回鏡。
  - 彈著材質：`collide.js` 建碰撞網格時替每個三角形標材質（`ctx.surf`，0 石 1 灰泥 2 木 3 金屬 4 沙），射線的 `triangleIndex` 直接查表。`particles.js` 的 `impact(..., mat)` 依材質換彈孔、碎屑、火星與聲音（`imp_*`，目前是合成音）。改碰撞形狀時，每個形狀之後都要 `tag()`。
  - 彈殼會在地面彈跳（`floorAt`），第一下有 `brass` 聲，三四下後躺平，存在 2.2 s。槍管熱度 `heat`：停火後熱度 >3 就從槍口冒煙。`__ol.fx` 可讀粒子池狀態。
- **Bot AI**（`bots.js`，2026-11-08 補齊）：
  - 懷疑點 `sx/sy/sz/sT/sKind`：1 被打（`weapons.js` 的 `hurt()` 寫入）、2 聽到（敵人開槍 45 m、跑步 16 m，跑步門檻和腳步聲同一個 3.6 m/s）、3 跟丟時最後看到的位置。沒目標時轉過去看；掃描只看正前方，轉過去下一次就看得到。聽到或跟丟時放慢到 3.3 m/s 靜步。跟丟時血量 >40 才用暫時目標 `tmp` 追過去。
  - 攻方路線分流：`assignGoal` 從卡口與攻方架點挑經過點 `via`，總長 ≤ 直走 ×1.35+4 m，同一條節點序列只留一個，依角色分配。經過攻方架點時停 1.6–4 s，看向炸點。改了導航圖要重看分流結果（node 跑 `buildNav` 列出每個炸點節點的選項）。
  - 投擲物：`botBuy` 在有長槍和甲之後才買，最多兩種。`tryNade` 每 0.8 s 判斷一次：破片丟聽到或跟丟的位置；守方回防時把閃光丟到裝藥上空；攻方離目標 32 m 內時，煙霧封守方回防路線，閃光丟進前方看得到的最遠節點。仰角由 `lob()` 依 `throwNade` 的初速 15、上拋 2.5、重力 15 解低拋物線。丟閃光時附近隊友 `away` 轉頭。
  - 交火：每次交火擲一次 `head`（瞄頭 1.64／蹲 1.15）與 `duck`（自動武器 12 m 外蹲射）。血量低於 35 時邊打邊退。卡住時隨機跳一下。Bot 蹲下時 `eye` 降到 1.15。
  - 裝藥後攻方去 `postPool`（炸點節點加 22 m 內的守方架點），看守方回防的路。
  - 掉包：攜帶者陣亡會把裝藥丟在腳邊（`round.js` 的 `dropCharge`），按 G 也能丟。狀態在 `G.drop`，畫面用 `chargePos`，雷達只畫給攻方。攻方任何人在 1.2 m 內就撿起（`pickCharge`），最近的攻方 Bot 會去撿。`botObjectives` 收裝藥時要保留 `G.drop.on`。
  - 難度：設定頁的「遊戲」分頁寫 `OPT.diff`，`setupMatch` 依 `BOT_SKILL` 取技術值範圍（簡單 .22–.5、普通 .42–.82、困難 .7–.95），下一場比賽生效。
- **連線對戰**（2026-11-08，細節與協定在 `NET.md`）：開房者的瀏覽器是主機，照單機規則跑整場；伺服器（`src/net/core.js`，本機 `server/ochre/`、Cloudflare `worker/`）只管名單與轉送。`world.net` 是 `sync.js` 掛上的掛鉤，單機是 null：`weapons.js` 的 `shootOne`／`fire`／`hurt`、`round.js` 的 `onKill`／`endRound`／`plantDone`／`pickCharge`／`buy`／`startRound`、`grenades.js` 的 `throwNadeAt` 都會呼叫它，改這些函式時要保留。
  - 主機上的遠端真人是 `a.remote`（pid），客戶端上自己以外的人是 `a.puppet`，兩者都沒有 `bot`，位置由 `sync.js` 的內插緩衝 `nb` 每個 tick 寫入。`frame()` 的動畫用 `a.netTask`、`a.aim` 代替 Bot 的狀態。
  - 客戶端不跑 `tickRound`、Bot、`botObjectives`、`pickCharge`；安裝、拆除、丟裝藥、購買走 `netAct` 請主機做。命中在客戶端判定、`world.net.hit` 回報，主機用 `damage()` 扣血；客戶端的 `detonate` 不算破片傷害。
  - 回合重置看快照的回合序號 `rs`（`startRoundClient`），不是收事件；換邊也走這條。
  - 連線時 `G.paused` 不停 tick（`main.js` 與 `loop.js` 的 `tick` 都有判斷），暫停畫面只是放開游標。主機分頁在背景時改用 Worker 計時器呼叫 `advance()`（不要叫 `step`，會蓋掉 mover 的 `step`）。
  - 部署 Cloudflare 要用使用者自己的帳號，不要自動執行；打包時 `OL_SERVER=wss://… npm run build` 帶入網址。改了房間邏輯跑 `npm run test:net`，改了同步跑 `node tools/mp.mjs`。
- **倍速測試要過渲染**：骨架與命中膠囊靠 render 更新，同步 `sim` 打不到人。整場比賽用 `speed(k)`。
- **平衡量測**：`__ol.shoot(yaw, pitch)` 直接扣扳機，`G.paused` 時 tick 停但士兵還在更新。目標 `e.hp = 1e6`、看扣掉的血就不會觸發回合結束。全地圖最長的直線空巷只有 48 m，超過的距離量不到。連發類不補償後座時 10 m 外幾乎打不死，表上的擊殺時間是「完全壓住後座」，另有不壓槍的表。比賽的 `history[].winner` 是隊伍索引，換邊後 `a.team` 會跟著翻，所以 0 永遠是攻方。玩家站樁時比賽是 4 對 5，攻守勝率要用 `--modes=fair`（玩家當觀眾、對面少一隻，要避開持裝藥的那隻）。同一半場的回合受經濟連動，不是獨立樣本。
- **校色**：`color.mjs` 的 sunFloor 分類受 v>.45 門檻影響，只比 ΔS 與 ΔE 的趨勢。
- **單檔**：`npm start` 的白名單含 `assets/`。素材路徑用 `ASSET_BASE`（`../assets/278/`）。
- **環境貼圖一律用烘好的 `env.bin`**，不要改回 `HDRCubeTexture` 的 `prefilterOnLoad`。開機在 GPU 上濾 48 個 draw、約 300 ms，碰到 macOS GPU 重啟時那批指令被殺，cube 留下隨機位元，整局金屬面彩虹或所有 PBR 面全白，console 沒有任何錯誤。`baseTexture.polynomial.js` 是副作用 import，少了它 IBL 漫射無聲消失。上傳要用 `_uploadArrayBufferViewToTexture`：`_uploadDataToTextureDirectly` 在 WebGL 不綁貼圖，cube 是空的，天空變灰、金屬反射全黑，也不報錯（`accept --only env` 兩個後端都讀回數值）。查 GPU 重啟看 `/usr/bin/log show --predicate 'process == "WindowServer" AND eventMessage CONTAINS "GPU restart"'`（zsh 的 `log` 是內建指令；不限 process 會比對到 log 自己的啟動參數）。`/Library/Logs/DiagnosticReports/gpuEvent-*.ips` 不完整。
- **裝置遺失**：`doNotHandleContextLost: true`，遺失就重載頁面（`main.js` 的 `onGpuLost`），連續 3 次改走 `?gfx=webgl`。Babylon 自己的還原與 FAST 快照不相容，會凍結畫面並丟 TypeError。
- **FAST 每幀的工作**：`engine.js` 拿掉了 `SnapshotRenderingHelper` 的 `onBeforeRender` 觀察者（10 副骨架 `prepare(true)` 要 0.8 ms），只留天空罩跟鏡頭。之後若用粒子、精靈、變形目標，或新增 `infiniteDistance` 網格，要在那裡補回對應處理。
- **GPU 是頂點量**（2026-11-08 量測）：快照不剔除，每一層（主畫面＋每層陰影）都畫全部約 480 萬三角形；2880×1800 每幀 GPU 約 27 ms，DPR 1 只少 5 ms、陰影圖 2048→1024 不變，所以瓶頸是三角形數不是像素。已改成陰影 3 層、`shadowMaxZ` 90、世界槍不投影（約 −25%）。剩下的大頭：世界槍 16 種 × 11 格約 133 萬（沒用到的格子矩陣是 0，頂點照跑；舊 9 把的世界模型沒減面，KS 2.4 萬、刀 1.3 萬）、`roof_trim` 75 萬、`window_a` 69 萬，要再省得改模型（`build-kit.py`、世界槍 LOD）。小細節從最遠一層陰影拿掉可再省約 1 ms，但遠處簷口與窗框的影子會不見，沒採用。
  - 量 GPU 用「停 render loop、自己 render、`await device.queue.onSubmittedWorkDone()`」，同頁交錯切設定（切完要關快照重錄）；無頭的 rAF 間隔帶 15–20 ms 的額外延遲，不能當幀率。比賽畫面右上角的 fps／ms／CPU（設定 `perf`，預設開）才是實機判斷。
  - 解析度設定 `res` 是 720／1080／1440（預設 1080），以畫布短邊計、不超過裝置像素（DPR 上限 2），`main.js` 的 `fitRes` 在視窗改大小時重算縮放。
- **無頭同一個瀏覽器開第二個 WebGPU 分頁會卡在建引擎之後**（HEAD 版也一樣），多分頁測試每頁各 `launch()` 一個瀏覽器（`mp.mjs`）。
- **量 CPU 不要比兩個頁面**：macOS 把主執行緒放效能核或節能核，同一支程式換一頁差到 3 倍。`cpuAB` 比同頁相鄰區塊；降幅門檻 80% 在 `accept --only snap`。
