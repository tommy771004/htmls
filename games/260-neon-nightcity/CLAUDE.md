# 霓虹夜城（260）

**文件只更新一份：`README.md`。** 功能、各檔分工、`cars.json` 等規格欄位、`window.__nc` 測試 API、已知限制都寫在 README（各系統的完整做法在 README「實作細節」）。這份只放改程式前一定要知道的規則，有新的規則或坑才改。`HANDOFF.md` 是 2026-11-03 以前的紀錄，不再新增；`SPEC.md` 是城市尺寸、場館、任務與渲染流程。

## 建置與測試

- `npm run build` 把 `src/parts/*.js` 依檔名順序串成**同一個模組**，再打包成單檔 `web/260-neon-nightcity.html`。改了 `src/` 或 `assets/260/cars.json`（會打包進頁面）都要 build，產出一起 commit。
- 頂層程式只能用排在前面的 part 宣告的東西（後面 part 的 `const` 還在 TDZ）；函式裡面可以。例如 69 開頭的檔案頂層不能用 `post`、`camState`、`keys`、`bigmap`、`ctxHooks`、`W`。`68-xdoor.js` 用到 `gtaApi`，要排在 `68-gta.js` 之後。
- `npm test` 是兩種尺寸的無頭 Chrome 驗收，`npm run test:glb` 驗實車；驗收工具固定 `gpu=high`。動到座標的改動要跑 `NC_QUERY='?zrot=25' npm test` 與 `test:glb`。只改幾台車的車門或方向盤時，跑 `node tools/door-check.mjs <id>` 就夠了。

## 座標（不規則城市）

- 城市在方格的「邏輯座標」生成，`05-zones.js` 的 `ZONES` 是每片的剛體變換加片內彎曲。玩家、車流、地圖、碰撞、存檔（第 5 版起）都是世界座標。
- 新程式碰到位置，先想清楚是邏輯還是世界座標（`toW`／`toL`、`spotW`）。世界座標的圓柱與光源標 `w: 1`，實例標 `zn: null`。驗收腳本用 `__nc.tpL`／`W`／`L`／`Ws`，不要寫死世界座標。
- `04-layout.js` 由 `tools/check-zones.mjs` 產生，不要手改。`52-air-int-data.js`（第一、第二航廈室內的擺放、碰撞、步行面）也一樣，是 `blender/airint.py` 產生的。
- 地面高度先問 `deckAt`（疊在一起的橋面看 `deckOn`），生成載具用 `spawnY`。
- 碰撞盒是切段的平行四邊形（`boxSplitW`、`frameA`）；圓對盒走 `quadPush`。
- 改 `DIAG` 的起點要避開特殊地塊、實體建築和安全屋的門。跳台與斷橋不能飛越片與片之間的縫。

## 繪圖（WebGPU／TSL）

- 只有 `WebGPURenderer`；瀏覽器沒有 WebGPU 時走它的 WebGL2 後端。
- `ShaderMaterial` 只帶 `name`、`uniforms`、`defines` 與管線狀態，著色器在 `src/tsl/m-<名字>.mjs`，照「名字＋defines 的形狀」取用；找不到會 `console.error('沒有 TSL：…')`。
  - 每個 ShaderMaterial 都要設 `name`。新增材質就是改 `src/tsl/` 的鍵，並登錄進 `index.mjs`。
  - 改了材質名字、defines 或鍵之後，跑 `node tools/tsl-check.mjs`。
- 開場時沒掛到物件上的材質要 `gfxLate.push(m)`。預先編 pipeline 一律走 `gfxCompile(物件, 相機, all)`。之後才出現的東西開場就建好、藏在場景裡；材質要共用，不要每次新建再 `dispose`。
- TSL 的寫法：
  - uniform 用 `gfxU`，貼圖用 `gfxTN`／`gfxT`，深度轉 NDC 用 `gfxZ`，依畫質等級的數字用 `GL_TIER` 的名字。
  - 分支用傳進來的 `TSL.If`，不要另外 import。函式不要寫成 out／inout 式，多個結果包成 vec／mat 回傳。長的同值比對串寫成並列的 `If`（WGSL 巢狀上限 127 層）。
  - 實例化網格要原始座標用 `pGeom_`／`nGeom_`。`instanceMatrix` 照舊寫並設 `needsUpdate`，不要換成新的 attribute 物件。
- uniform 照舊寫 `uniforms.x.value`：綁定只在值變了的那幀更新。頂點緩衝最多 8 個（人物用 `charPack`，讀原始陣列用 `charRaw`），單分量屬性只能 32 位元。
- glb 貼圖上傳後，`ImageBitmap` 會被關掉。不要自己讀 `source.data`，要讀像素就另外解碼（`?bmp=0` 可關掉這個機制）。
- `70-render.js` 換掉了 three 的兩個方法：
  - `Object3D.updateMatrixWorld` 只在有變動時才重算，所以不要直接寫 `matrixWorld`。
  - `Frustum.intersectsObject` 在低空時剔掉整顆在霧裡的物件；霧外還要看得到的東西要用 `FAR`。
  - `Object3D.updateMatrixWorld` 每幀那一次整棵更新（`mwSkip`）跳過藏起來的物件，重新出現時才重算：藏著的物件要讀 `matrixWorld` 前先自己 `updateMatrixWorld(true)` 或用 `getWorldPosition`。
  - InstancedMesh 另外照實例分格測（`instAny`，實例全在視錐外就不畫）：實例的頂點在著色器裡位移超過幾何包圍球 2 m（`INST_PAD`）的要加大它，改實例矩陣後要 `needsUpdate`。
- 關了視錐剔除（`frustumCulled = false`）的 InstancedMesh 沒東西畫時把 `count` 設 0（`70-render.js` 走訪時就跳過），不要用縮成 0 或移到地底的實例藏起來，那樣每趟照樣送一次 draw。
- 路面倒影預設是螢幕空間（`SET.ssr`，`70-render.js` 的 `mSSR` 用上一幀的畫面填 `rtRefl`）；`R.render(scene, reflCam)` 只在選平面、第一幀與切鏡頭時畫，`reflCull`／`reflOcc` 也只在那時有作用，量倒影效能前先確認是哪一種。
- 效能：`node tools/observe.mjs` 跑七個情境出瓶頸報告（`.cache/observe/<雜湊>/report.md`），改完用 `ON='…' OFF='…' node tools/lossless.mjs` 驗六個視角像素不變並量凍結整幀；凍結量測要連畫多幀（一幀一幀等做完，顯示卡會降頻、數字偏）。做法與結論在 HANDOFF「觀測模型」。
- 點光與地上陰影的陣列 uniform 用 `v4set` 寫。
- TSL 裡不能寫 JS 數字＋節點（`.008 + x.mul(2)`），要寫 `x.mul(2).add(.008)`，不然編譯時是 `this.bNode.getNodeType is not a function`。
- 模組層建的節點（`lib.mjs` 的 `const gX = float(1.)`）在 `Fn` 裡 `assign`、再到巢狀 `If` 裡讀，TSL 可能在那個分支裡重新初始化它，讀到的是初值（2026-11-13：車人日光陰影 `gOccS` 因此從來沒生效）。函式內的結果用 `Fn` 裡自己的 `.toVar()`，懷疑時把材質的 WGSL 印出來看。
- Metal 的著色器編譯器（AGX）在很大的材質上會當掉：console 是 `Async render pipeline creation failed (renderPipeline_facade_25) … XPC_ERROR_CONNECTION_INTERRUPTED`，`~/Library/Logs/DiagnosticReports/MTLCompilerService-*.ips` 是 LLVM 的 SIGSEGV，那個管線就畫不出來。每次失敗的管線名字一樣，就是那個材質超過門檻（2026-11-13 是 `m-facade`）。改 `lib.mjs` 的 `shade`／`occlude` 這類被到處內嵌的函式後，要開頁看有沒有 XPC 錯誤。`m-facade` 在 `occlude` 改大之後，就算改成在 `main_` 開頭只算一次（`shadeO(…, oc)`）還是當掉，只有傳常數 `vec2(1.)`（整段編掉）才好；`m-water` 用 `shadeO` 共用一次。
- 白天的調色集中在 `28-sky.js` 的 `DAYG`（`__nc.dayG`，`en = false` 是 2026-11-13 前的樣子）：天光亮度與飽和度、地面暖色反彈、日光倍率、白天曝光，後製的 `uDayG`（暗部偏青、對比、飽和度，權重是 `atm.sunK`）。陰天、雨天往原本的值靠，夜裡不受影響（`lossless` 的五個夜景 0 px）。調整用多組參數一次截圖比對，不要改一次建一次。
- 開車的追車鏡頭參數在 `99-main.js` 的 `CHASE`（`__nc.chase`，`en = false` 是 2026-11-13 前的樣子）：只管汽車（不含直升機、機車、船），低機位、地平線接近畫面中間、高速時視角加寬、路面細震、跟著車身側傾、動態模糊加重（`70-render.js` 讀 `camState.spd`）。
- 植被的顏色在 `27-props.js` 的 `leafTint`（`__nc.leafTint`，`?leaf=0` 是 2026-11-14 前的樣子）：下載後依「組 → 原檔材質名」乘頂點色，比例寫成 sRGB，套用前換成線性。只改材質，不在後製做色相鍵，否則霓虹和紅綠燈會一起變色。第三格是 1 的材質會把貼圖透明處填成葉子的平均色（`leafBleed`）：楓葉 `sugar_maple_leaf` 和玉簪 `hosta1` 透明處的 RGB 是淺灰，mipmap 把它混進葉緣，遠一點整棵就變銀白（原本最常見的「白樹」就是楓樹）。新增樹木或灌木的 GLB 時，先量貼圖不透明處的平均色，以及透明處的 RGB（`ffmpeg -pix_fmt rgba` 讀原始像素；canvas 會預乘 alpha，透明處讀出來是 0）。乘法只能壓暗，加不出顏色：田園槭樹的貼圖幾乎沒有藍 (63,72,5)，只能壓暗、偏綠，拉不到參考的 (103,94,65)。`20-props.js` 程式建模的樹（http 下是 `TREE_R` 外的遠景樹）同一天一起壓暗，樹冠的上亮係數也一起收：樹頂朝天，天空環境光吃滿，只改反照率幾乎看不出差別。山林的 `nat_forest` 楓樹是刻意的紅葉，不要動。截圖時用 `__nc.trees`（`park` 是公園）和 `__nc.hillForest` 找樹多的地方。公園樹下的林下層在 `20-props.js` 的 `rng(2631)` 那段（同一天加的）：長草叢併進 `weeds.grass`，野花是 `weeds.flower`（`flower_patch`，40 m 內），另外多擺一些灌木。全部擺在樹自己 claim 的 2.4 m 內，所以不用 `free()`。不要加進 `trees`：它同時管碰撞圈、`22-hmap.js` 的樹冠圖和 `treePick`。`grass_patch` 原件是 4 × 3.5 m，壓得太窄太矮（x、z 縮到 0.1）會變成一塊塊深色方塊，公園的草叢要用接近等比的 0.3～0.45。同頁交錯 A/B 量過（4 個公園，各 3 個方向）：幀時中位數 8.88 → 8.80 ms，draw call 388 → 392
- 市區的電線桿與架空電線在 `20-wires.js`（`__nc.poles`，`?poles=0` 關掉，2026-11-14 加）：只擺在舊城、住宅、工業區（district 名稱的正規式 `RE`），每個街區的北緣與西緣，所以每條街只有一側有桿。同一條街線上的桿照順序連線，跨過路口繼續拉，相鄰兩根超過 55 m 就斷開；沒拉到線的桿不立。電線是一根 1 m 的方塊做實例，每條線照下垂的拋物線切三截，整個城市只多三個 InstancedMesh（兩款桿、一種線）。街樹的 claim（2.2～2.4 m）沿路緣一棵接一棵，用 `free()` 幾乎每根都會被擋掉，所以 `freeP` 把樹只算成 0.7 m 的樹幹。沿 x 的那排轉了 90°，桿的本地 +x 落在 −z，掛線的偏移要跟著反號。從頁面把 `POLES.list` 回傳給 Node 前要先挑出純欄位：`instanced()` 會在清單項目上掛 `_inst`（InstancedMesh），整個序列化會把分頁弄當（Target crashed）。同頁交錯 A/B（同一建置，一頁 `?poles=0`，4 條街各 3 個方向）量不出差別：draw call 432 → 433
- 車漆映街景（2026-11-14）：`lib.mjs` 的 `envCity(p, r, coat)` 在 coat > 0.3、白天（uDay > 0.15）時沿反射方向在建築高度圖（`hmAt`）上走 12 步、打到再二分 4 次，畫一面立面（牆色、軟邊窗格映天），35～95 m 淡回 `envMapS`；夜裡整面淡回城市光帶，不畫亮燈窗（使用者嫌過一格一格的跳色）。m-glb 與 m-uberTraf（車流車身）都用。車流低模一開始在車身上碎成黑斑：`tools/traffic.mjs` 減面後用相鄰面法線平均（40° 內平滑），4000 面的車身一面一面的；改成法線轉移（減面只留原檔頂點，取焊進該頂點、和這個面夾角 60° 內的原檔法線平均，`TRAFFIC_NORM=0` 用舊做法）後車身是連續的漸層，頂點數還少約 10～18%。重烘時 gunship 的來源 `.cache/raw/ah64d_split.glb` 不在，只能帶車名重烘街上的車（`node tools/traffic.mjs e34 evo190 …`，沒列的沿用舊檔）。遠處（12～40 m）的窗格淡掉，不然在車身上是一圈圈疊紋。很多 Sketchfab 車沒有 `KHR_materials_clearcoat`（m4csl、ae86、police、chall、camry、ghost… coat 全 0，`pbrq` 量過），車身只有金屬色調的反射、看起來是霧面；`26-glb.js` 的 `glbInstance` 把 `uPaint.w` 預設成 0.25 當「這是車」的旗標（0.5 以上才是換色／烤漆，道具與建築是 0），m-glb 據此給 coat < 0.3、沒選烤漆的部位補 `smoothstep(.5, .3, rough)` 的 coat，反射另外加一層不帶底色的 `max(F, .06)·coat·0.8`（清漆）。除錯：把命中分支改成回傳洋紅，看得到落點。同頁交錯 A/B（5 個路口 × m4csl／f8／ae86，各 3 個貼近車身的鏡頭）只有 GLB 車時 16.35 → 16.36 ms（扣掉一次載入卡頓）；連車流一起開 19.82 → 19.82 ms（p90 24.2 → 22.9），draw call 不變；low／mid 檔沒有編譯錯誤
- 時間抗鋸齒（2026-11-14，`SET.taa`，Esc 選單「進階影像」，軟體繪圖等級預設關、其他開；`__nc.taa`）：`70-render.js` 只在主畫面那一趟 `R.render` 前後把 `camera.projectionMatrix` 的 [8]／[9] 加上 Halton(2,3) 八點的次像素偏移（倒影那一趟複製主鏡頭的投影，要在偏移之前畫；`curVP` 在還原後才算，給反推與動態模糊用），`mTAA`（`71-gfx-post.js`）在泛光之前的線性 HDR 上解：3×3 依離沒偏移的中心的距離加權重建這一幀（`uJit`，像素，左上原點：投影 [8] 加 δ，畫面內容往 −δ/2 移；正負號量過，反了閃爍多三倍），兩個歷史候選（深度反推的 Catmull-Rom 與同一個畫面位置的，取離這幀近的：追車鏡頭的玩家車跟著鏡頭走，只用反推的會被裁成 3×3 平均、車牌糊掉），YCoCg 平均 ± kσ 的盒子裁切（不動時 k = 3、每幀超過 4 px 收到 1：盒子太緊時夜景比沒開還閃 5 倍），裁得多、動得快、下雨時加大這一幀的權重。泛光、眼睛適應、合成與下一幀的螢幕空間倒影都讀它的輸出；合成另外加一點只在畫面上的銳化（`uSharp`，不回寫歷史）。歷史兩張只在開著時建，`makeTargets`、切鏡頭、換場館時重設；`tools/lossless.mjs` 會關掉它（每幀偏移，同一幀畫兩次不會逐像素相同）。驗證要用凍結畫面（Esc 選單開著藏起來、`menu.st.redraw` 連畫）連拍：沒開是 0，開著每幀平均變化 0.3～0.6 灰階；`dbg = 1` 只偏移不疊（畫面應該抖，證明偏移進到每個材質），`dbg = 2` 重設的那幀標紅。同頁交錯 A/B 18.19 → 18.14 ms。低等級（沒有 MSAA）差最多
- 車人地上陰影（`occlude`）：`uOccA`／`uOccB` 是 `GL_TIER.NOCC_T` 格，最後一格放這幀車人底面高度的範圍，著色器在範圍外整段跳過；`__nc.occ.en = false` 全關（量效能用）。`NOCC_T` 這類常數在 TSL 裡是 int 節點，要寫 `NOCC_T.sub(1)`，寫 `NOCC_T - 1` 會變成 WGSL 的 `NaN`。
- 帶 layout 的 `Fn`（`{ p: 'vec3', return: 'vec3' }`）會變成獨立的 WGSL 函式，裡面讀不到 varying（`vW` 之類會是 `unresolved value 'gv_vW'`），要當參數傳進去。
- 所有材質共用的貼圖 uniform（例如 `U.uAHMap`）要在材質編譯前就掛上真的貼圖（沒有資料也先掛 1×1）；晚掛的話先編好的管線綁的是別的貼圖，WebGPU 報 `Binding doesn't exist`／型別不符。
- 直接寫 `NodeMaterial`（`97-summit.js`）時，會變的 uniform 要 `setGroup(renderGroup)`：`02-gfx.js` 的 uniform 版本檢查只管 ShaderMaterial，物件沒變時 objectGroup 的值不會重寫。
- three r186 的 `new Color(hex)` 已經是線性值，不要再 `convertSRGBToLinear()`。
- `m-uber.mjs` 的材質編號鏈裡有範圍分支（12–14 是亮窗），新增編號前先找 `greaterThanEqual`／`lessThanEqual`，不要只看有沒有同號的 `equal`。
- 霧只在遠處淡出。`uFogDen` 不要調小，剔除是照它算的。夜裡的環境反射一律用 `envMapS(r, 1)`，不要傳 0。
- `MAT.ux`（`m-uberX.mjs`）的程式紋理用幾何自己的座標：`cityAdd` 烘成世界座標、離原點幾千公尺的網格，雜訊會失真成一片平色。遠處的物件把幾何留在局部座標、用網格的 position／rotation 擺過去（`21-rig.js`）。
- 程式立面（`MAT_FACADE`，`m-facade.mjs`）的樓層線、一樓店面、牆腳髒污照世界高度 y = 0 起算；地面不在 0 的樓用 `YB` 鍵（uv.y 給離地高度，`27-props.js` 的 `facYMat`，遠景另加 `FAR`），defines 照 `FAR`、`YB` 的順序寫。改了立面的窗格（一樓高、層高、開間）要一起改 `tools/props.mjs` 的 `facadeKit`，重跑 `node tools/props.mjs isle_tron`（光格島的冷氣、逃生梯、店招是照窗格算好寫進 `props.json` 的）。
- 招牌字圖集是 2048×3072（`20-props.js` 的 `ATLAS_H`），新增格子前先算會不會超出。

## 載入、車、人

- 下載素材的網址一律接在 `A260`（`00-core.js`）後面，不要寫 `../assets/260/`：正式站可能指到 Cloudflare（README「素材放在 Cloudflare」）。`assets-worker/` 的部署由使用者用自己的帳號執行，不要自動跑。
- 下載後的處理要分幀做（`warmClock`／`warmSlice`，每幀共用 6 ms），放進場景前先 `glbWarm`。新增大量載入的工作也照這樣切片。
- `loadProps` 回傳的 `it.parts` 已經把同一物件裡共用材質的不透明零件併成一個（`propMerge`，建築組除外）：零件數與順序不等於原檔網格，不要用 `parts[i]` 指某個原檔網格；要分開動的零件（門扇、會轉的輪子）在 `tools/props.mjs` 拆成不同物件或不同材質。
- 換車一律走 `applyCar(v, id, paint)`（玩家座駕只有一個物件，沿用 `kestrel`）。搶來或打壞的車流車是 `detachCar()` 建的臨時載具（`kind: 'jack'`），不走 `applyCar`，也不進存檔。
- 玩家座駕的轉向手感在 `30-vehicles.js` 的 `HANDLE`（`__nc.handle`，`en = false` 是 2026-11-14 前的樣子；README「操控手感」）：只管 `player.veh`，車流、警車、AI 走原本的 `v.steer` 幾何轉向。玩家的轉向率讀 `v.stN`（抹平過的方向量），`v.steer` 只剩前輪與方向盤的顯示和手煞車甩尾；破胎、歪軸的偏移（`flatYr`／`axleYr`）在對著極限的夾限之外另外加。量手感用跑道上的無頭腳本（設定初速、按住／輕點方向、逐遊戲幀記錄 yr／stN／push），每次要先清 `axle`／`axleYr`／`flatYr`：低速打圈偶爾會撞歪輪軸，之後每一輪都會自己偏轉。
- 重跑 `npm run cars`（`tools/cars.mjs`）會保留 `cars.json` 裡新規格沒有的欄位（`db`、`kit`、`door`、`sw`）。
- 換過車內或修過的實車（換車內：viper、r8、svj、f40、sf90，glb 的 `asset.extras.cab`；只修：lc200、ramtrx、m3c、gt3rs，`asset.extras.fix`）：改車內是改 `blender/cab_<id>.py`、修正是改 `tools/cab-swap.mjs` 的 `FIX`，再跑 `tools/cab-swap.mjs <id>`（從 `.cache/cab-src/` 的原檔備份重做）；直接重跑 `cars.mjs` 會把這些換回原模型。
- 人物的骨架不在場景圖裡。動畫庫沒有的動作，在播放後用 `aim()` 覆寫骨頭方向。
- 互動提示掛進 `ctxHooks`；要排在固定提示之後的掛 `ctxLate`。室內場館登錄在 `60-venues.js` 的 `VENUES`。場館可以帶 `enter()`／`leave()`（`setWhere` 換場館時呼叫，例如 `summit` 換相機遠平面與聲音）、`walk(ox, oz, nx, nz)`（40-people 的移動先過它，曲面牆用可走區域而不是碰撞盒）與 `floorAt(x, z)`（有它時人物與相機的地面高度照它算，不看 `lvY`）。展示廳換樓層一律走 `showLevel(k)`。
- Blender 腳本裡開放的面（帷幕、屋頂帶、單片玻璃）不要用 `common.py` 的 `MB.build`：它的 `recalc_face_normals` 會把這種面隔一片翻一片，背面在遊戲裡看不到（`airbld.py` 有自己的 `build`，面照寫的方向朝外）。
- 機場的 Blender 腳本（`airkit.py` 的 `finish` 會 `remove_doubles`）不要用「正反各畫一次」做雙面：兩面頂點相同會被併成一面，只剩先畫的繞向，另一側整片看不到。貼在板面上的圖形用 `airkit.py` 的 `ow(b, pts, m, 法線)` 畫單面；真的要兩面就把背面錯開幾 mm。
- `bmesh.ops.bevel` 新長出來的倒角面都是第 0 號材質（細管、輪胎溝會變成那個顏色）；要照相鄰原面改回來（`airgse.py` 的 `finish`）。
- 服裝的 `blender/wear*.py` 都 `exec` 進同一個命名空間，新函式不要和別的檔案撞名。裙子的線條與開衩要對齊放樣的環與欄（`rows_d`／`cols`）。改鞋子先用 Blender 單獨出圖看。

## 音效與設定

- 不要用原作（GTA V）的音效；只有引擎聲可以用 CC BY，而且要標作者。
- 每個音都要有結束點：單發音的長度寫在清單裡，循環音歸零 0.4 s 後要停掉來源。
- 新的畫質或操作常數優先接到 `01-settings.js` 的 `SET`（畫質預設值跟著 `GPU_TIERS`）。新按鍵要加進 `KEY_ACTS` 才能重新綁定。

## 參考檔（需要時再讀）

- `CLAUDE-gta.md`：GTA 式擴充各 part 的分工與掛點（68／69 開頭、第三～九部曲、主線《一手爛牌》、CHROME WORKS、夜店／賭場／地堡）、存檔版本沿革。改 `68-*`、`69-*`、`66-chrome.js` 或存檔欄位前先讀。
- `CLAUDE-world.md`：城區、距離串流與碰撞空間索引、`tools/props.mjs`、海岸與島嶼、公園與鐵道橋、雲梯城寨、山坡別墅、安全屋、榛嶺。改 `10-city.js`、`2x-*`、`27-*`、`69-safehouse.js`、`09-akina*.js` 或 `tools/props.mjs` 前先讀。
