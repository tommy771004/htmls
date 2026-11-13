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
