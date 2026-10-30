# 260 霓虹夜城：WebGPU 雙軌（分階段）

使用者在 2026-10-26 選擇「分階段雙軌」：底層支援 WebGPU，預設維持 WebGL，著色器逐檔改寫成 TSL；全部對齊並實測比 WebGL 快之後，才讓支援的瀏覽器自動使用 WebGPU。

## 為什麼不能直接換

three r186 的 `WebGPURenderer` 不支援 `ShaderMaterial`／`RawShaderMaterial`：`NodeLibrary.fromMaterial` 找不到對應的節點材質時會回傳 null，物件就畫不出來。260 的畫面幾乎全是自寫的 GLSL：

- 20 個檔、43 個 `ShaderMaterial`
- 約 66 個 shader 程式、1500 行以上的 GLSL
- 共用庫 `GL_LIB`（`00-core.js`，約 300 行）：路燈表、點光、日光陰影步進、樹冠、車人陰影、街谷遮蔽、`shade()`、環境反射、霧

所以每個材質都要有一份 TSL 版本。TSL 會編成 WGSL，也會編成 GLSL：`?gfx=webgpu-gl` 讓 WebGPURenderer 走它自己的 WebGL2 後端，可以比對兩種後端。

## 架構（第一階段已完成）

- **後端選擇**（`00-core.js`）：
  - `GFX` 有三個值：`webgl`（預設）、`webgpu`（網址加 `?gfx=webgpu`，且瀏覽器要有 `navigator.gpu`）、`webgpu-gl`。
  - 選 WebGPU 時建 `WebGPURenderer` 並 `await R.init()`；失敗就退回 WebGL。
  - 各 part 會用到的 WebGL 介面補了替身：`R.capabilities`（`maxSamples`、`maxTextureSize`、`getMaxAnisotropy`）與 `R.extensions.has`。
  - 顯示卡名稱照舊向一個臨時的 WebGL2 context 要。WebGPU 的 `adapter.info` 在 Apple 上只給 `metal-3`，拿不到型號，分級會失準。
- **轉接層**（`02-gfx.js`）：
  - 攔下 `R.library.fromMaterial`，依登錄表 `gfxPort(材質實例或 fragmentShader 字串, m => NodeMaterial)` 換成 TSL 版本，每個原本的材質只建一次。
  - 沒登錄的用替代材質：依 GLSL 雜湊上色加平面明暗；半透明與疊加混色的輸出 0，等於看不見。
  - `__nc.gfx.miss()` 列出畫面裡還沒改寫的材質。
  - 混色、深度、正反面等管線狀態，three 照舊讀原本的 ShaderMaterial。
- **uniform**：
  - `gfxU(o)` 每次 render 讀回 `o.value`。共用的 `U` 放在 `renderGroup`，材質自己的放在 `objectGroup`。
  - three 只在材質帶節點時才每次完整更新綁定；不完整更新的話，改 `uniforms.x.value` 不會生效，換渲染目標後還會綁到已經銷毀的貼圖。`02-gfx.js` 包 `NodeMaterialObserver.needsRefresh`：ShaderMaterial 每個 render（`renderId`）比一次自己的 uniform 值（`gfxUniVer`，共用的 `U` 不比；貼圖比物件、`version` 與 `R._textures` 的世代），有變才把版本加一，render object 記的版本不同就回 FULL。
- **貼圖**：
  - `gfxT(o)` 回傳一個取樣函式 `(uv, level?)`，背後是 `TextureNode` 的子類別。
  - 不能用 `onRenderUpdate` 蓋掉 `TextureNode.update()`：它負責設定翻轉與貼圖矩陣，蓋掉後畫面會上下顛倒。
- **座標慣例**：
  - three 的渲染目標貼圖一律以左上角為原點。全螢幕 pass 取樣時 v 要翻（`71-gfx-post.js` 的 `Q`），換到 NDC 時 y 也要反（`ndcOf`／`uvOf`）。
  - 深度範圍 WebGPU 是 0..1、WebGL 是 −1..1（`gfxZ`）。
  - WebGPU 的 MSAA 只有 1 或 4：`mid` 的 ×2 在 WebGPU 等於沒有抗鋸齒。
- **後製**（`71-gfx-post.js`）：
  - 泛光（`mPre`／`mDown`／`mUp`）與合成（`mComp`）已逐行改寫：動態模糊、色散、高光肩部、ACES、調色、暗角、熱成像、毒氣、夜視鏡、去色、受傷紅邊。
  - 體積光（`mVol`）要用到 `GL_LIB`，改寫前先輸出 0。
- **打包大小**：three 的 WebGPU 與 TSL 模組一律打包進去，壓縮後程式從 2474 KB 增加到 3192 KB（+718 KB）。單檔建置做不到只在 `?gfx=webgpu` 時才載入。

## 第一階段驗收（2026-10-26，無頭 Chrome、Apple Metal）

- `?gfx=webgpu&gpu=mid` 與 `gpu=high`（MSAA ×4 加深度貼圖）：沒有 `console.error`，畫面方向正確。
  - 以下都正常：人物骨架蒙皮、InstancedMesh、泛光與合成、切換解析度（`__nc.menu.set('res', .8)`）。
- 預設的 WebGL 路徑：只是多打包了模組，行為不變（驗收結果和 HEAD 比對）。

## 2026-10-27：自動轉換（取代逐檔手寫的第二～四階段，暫定）

- 使用者要求「地面、道具、車、人等材質都補上 TSL 版本」，改成不逐檔手寫：`games/260-neon-nightcity/src/gfx/glsl-tsl.mjs` 在執行期把 GLSL 轉成 TSL，`02-gfx.js` 的 `gfxAuto` 接上節點（細節與 three 的兩個坑見 260 的 HANDOFF「WebGPU 自動轉換」）。`gfxPort` 手寫的照舊優先（後製 4 個；`mVol` 的佔位拿掉了，改走自動轉換）。
- 現況：68 個材質都轉得過、沒有 WGSL 與 console 錯誤，街景與俯瞰的立面、道路、車流、天空大致和 WebGL 一致；還沒對齊的：地上的方形暗斑（高度圖或陰影的方向）、少畫的物件（多半是 GLB 模型的材質：遠處塔樓、一層店面、行道樹、電話亭、路燈）、路人、樹穴鐵蓋。
- 之後使用者改要「底層全面改用 WebGPU、不要轉譯」，並選「先量效能再決定」。無頭 Chrome 量不出可信的比較（WebGL 鎖 60 Hz、WebGPU 少畫約 30% 三角形），要先對齊畫面、再在實機量。
- 量完的兩條路（執行期都不轉譯）：
  1. 在 Node 裡用 `glsl-tsl.mjs` 一次產生 TSL 原始碼（`src/tsl/*.js`）commit 進來，手工整理熱點（立面、地面、道具、車、人），最後刪掉轉譯器與全部 GLSL。
  2. 44 個材質全部手寫 TSL（工期約前者的 3–5 倍）。
- 2026-10-27 第二輪：顏色陣列（行人、樹葉）、GLB 底線名字、貼圖 generation、同結構材質共用節點都修好了；但查出**沒有 layout 的 void 函式呼叫會被 three 丟掉**——`texMat` 程序貼圖、`lampGrid` 路燈、`pointLights` 點光、`occlude` 遮蔽在 WebGPU 一直沒有作用，先前的 WebGPU 幀時間偏低、不能拿來比。直接補標會在每個呼叫處展開，著色器暴增、頁面隨機當掉；同一天把 GLSL 的四個函式改寫成回傳值（mat3／vec2）後補上了，WebGPU 畫面有了程序貼圖、路燈、點光與遮蔽，載入記憶體也沒有變多（細節在 260 的 HANDOFF）。所以第 1 條（用轉譯器產生原始碼）不再卡在這個缺口。
- 2026-10-27 實機量測（使用者的 Chrome、M3 Pro、解析度固定 100%，細節在 260 的 HANDOFF）：同鏡頭 WebGPU 34–46 fps、WebGL 20–30 fps，快 1.3–1.7 倍，三角形數相同；但 WebGPU 要 73–86 秒才就緒（WebGL 約 31 秒），多半是執行期轉譯與編譯著色器。第 1 條把轉譯搬到 Node 裡做一次，正好拿掉執行期轉譯這段。另外 WebGPU 的 `position` 是套過實例矩陣的座標，拿原始座標的著色器要寫 `GEOM_POS`／`GEOM_NRM`（只改了 07-kitx.js）。
- 兩條路的終點都是：只用 `WebGPURenderer`（不支援 WebGPU 的瀏覽器由 three 自動退回它自己的 WebGL2 後端，同一份 TSL），刪掉 `WebGLRenderer`、GLSL 與 `?gfx=` 開關；驗收工具的 SwiftShader 退回路徑（`tools/lib.mjs` 的 `SOFT_ARGS`）要確認 WebGPURenderer 的 WebGL2 後端跑得動。

## 接下來（2026-10-27 定案：產生一次 TSL 再整理）

使用者選了「在 Node 裡產生一次 TSL 原始碼再整理」。整理時只改寫法與效能，不動面數、貼圖、公式與畫質；切換時一起清掉沒用的程式碼與檔案，並改善非 GLB、程式建模物件的玩具感與不真實感（這一項是美術改動，和移植分開驗收）。WebGL 在最後一步之前都是預設，每一步結束都要：建置、固定鏡頭的 WebGL 像素比對不變、WebGPU 對照、兩套驗收全過。

0. ✅ **基準**（2026-10-27）：固定鏡頭 28 張（3 個地塊 × 街上／高處 × 白天／夜晚／雨夜，加 10 個室內）拍 WebGL 基準圖，WebGPU 逐張比對（差超過 24 的像素比例）。載入（WebGPU、high）到可玩 64 s：建節點加產生 WGSL 45.7 s（71%）、GC 6.8 s、轉譯只有 0.5 s、建管線 0.2 s（851 個 shader module、516 條管線＋229 條非同步）；所以「產生一次 TSL」本身只省 0.5 s，第 4 步要先把 `GL_LIB` 改成有 layout 的 `Fn`、減少重建。
   比對抓到三個自動轉換的錯，已修（`02-gfx.js`、`70-render.js`）：
   - three 判斷兩個材質能不能共用節點（`RenderObject.getMaterialCacheKey`）時，`defines` 這種物件屬性只記成 `{}`：GLSL 相同、defines 不同、幾何 attribute 也相同的材質拿到同一份節點。賭場吊燈沒有貼圖的燈罩拿到 `USE_MAP` 版，取樣空貼圖變黑（賭場 6.3% → 1.3%，酒吧、閣樓、地鐵也一起降）。`ShaderMaterial.customProgramCacheKey` 併進 defines。
   - 渲染目標與深度貼圖在 WGSL 是左上角原點，three 只在 GLSL 後端替 `TextureNode` 翻 v：自動轉換的貼圖節點（`gfxTN` 的 `_gl`）照當下綁的是不是渲染目標在執行期翻。路面倒影原本取到倒影上半的天空、整片一個顏色（雨夜街上 4.7% → 0.4%）；體積光讀的深度原本是上下顛倒的。
   - 倒影相機的遠平面與體積光由深度還原位置都照 WebGL 的 −1..1：依 `R.coordinateSystem` 改用 0..1。
   修完後戶外 18 張都在 1.3% 以下；室內的差主要是人物待機動作的時間不同（同一後端連拍兩次也有 2～3%），不是著色器。
1. ✅ **替每個材質取名字**（2026-10-27 完成：44 處都有 `name`，改寫 shader 的變體另取名字：`uberPal`、`uberTraf`、`uberTint`、`uberX`、`glbLM`、GLB 實例版加 `I`；`gfxAuto` 先用 `gfxName` 檢查，`__nc.gfx.clash()`。WebGPU 巡過戶外日夜雨與可直接進入的室內：72 個鍵、0 撞名、0 沒名字；快取還是用 GLSL 原文當鍵，第 3 步改成讀檔時一起換）：44 處 `ShaderMaterial` 與各種變體（`uber`／`uberI`／`ux`／`uxI`／`TRAF_MAT`、GLB 的實例版、後製的 `pass`…）都設 `name`；`gfxAuto` 的快取改用名字當鍵，同名的 GLSL 與 defines 必須一樣（抓出變體撞名）。
2. ✅ **依畫質等級代換的常數取名**（2026-10-27 完成）：`00-core.js` 的 `GL_TIER`（`NL_T`、`NOCC_T`、`SH_N_T`、`VOL_N_T`）在 `GL_LIB` 開頭寫成 `#define`，GLSL 裡改用名字；`glsl-tsl.mjs` 的前處理不代換這幾個（`keep`），uniform 陣列的大小可以是名字，`gfxAuto` 的 E 給值，轉出來的是 `Loop( NL_T, … )`。`LAMP_C`／`LAMP_K` 是固定的 16，不分等級，照舊寫數字。WebGL 的 GLSL 展開後數字一樣；WebGPU 76 個材質轉得過、0 錯誤、0 替代材質、0 撞名。
3. ✅ **產生器 `tools/gen-tsl.mjs`**（2026-10-27 完成）：無頭開 `?gfx=webgpu&tslgen=1`（一律執行期轉譯），走戶外白天／夜裡／雨夜、光格島（走近才下載的近景）與每個場館，每個場景用 `__nc.gfx.warm()` 把看不到的物件的材質也轉一次（開場沒掛上物件的 `gfxLate`：結局 B 的通緝海報），`dump()` 寫成 `src/tsl/`：`lib.mjs`（`GL_LIB` 依它用到的 defines 的 2 個變體，`make(TSL, E)` 每個材質各呼叫一次）、`m-<名字>.mjs`（各 defines 形狀，帶產生時 GLSL 的雜湊）、`index.mjs`。44 個名字、99 個鍵。執行期照「名字＋defines 的形狀」取用，雜湊對不上（改了 GLSL 沒重跑）或沒產生到的照舊轉譯並記進 `__nc.gfx.gen()`；巡過所有場景是 0 個、執行期轉譯 0 次。為了讓鍵少、內容不重複，先做了兩件事：有值的 defines（`FAR`、`FARD`、`CUT`、`MASK_CUT`）和第 2 步一樣留名字、由 E 給值（管線照樣依值分開）；以 `GL_LIB` 開頭的著色器拆成函式庫＋本體（不拆的話 1.4 MB 裡九成五是重複的函式庫，拆完本體 0.3 MB）。結果：當時記的「載入就緒 63.5 s、NodeBuilder 仍是 46 s」是拿舊的 `--dev` 建置量的（量測頁沒有重建），不算數；第 4 步重量見下；打包後程式 3.26 → 3.89 MB（多出的大多是 `glb`、`uber` 每個 defines 形狀各一份本體，第 4 步合併成一份、執行期依 defines 分支）。
4. **整理熱點**（直接改 `src/tsl/` 產生出來的程式碼，之後那幾個檔案不再由產生器覆寫）：載入的 46 s 幾乎都在 three 的 NodeBuilder，優先順序是① 同一個材質名字的各 defines 形狀合併成一份本體（JS 依 defines 分支，`glb` 有 14 個形狀、`uber` 好幾個），程式量與建節點的量一起降；② `GL_LIB` 的函式改成跨材質共用的有 layout `Fn`（現在每個材質各建一份，`gfxOwn` 讓每個 builder 再各編一次），全域變數 `gAmb` 之類改成參數或回傳值；③ uber 系列、`07-kitx` 程序貼圖、地面與立面。等級常數第 2 步已經是名字。每整理一個檔案就比對一次（固定鏡頭、兩套驗收），整理過的鍵在產生器裡標成手寫、不再覆寫。
   - ✅ ⓪ `inlineLocal` 把函式自己的區域變數（`sunVis` 的 `uv`）當成內建的 `uv`，`sunVis` 與呼叫它的 `shade` 被當成不能有 layout、展開進每個材質；修好後兩個都有 layout。重量（2026-10-27，`?gfx=webgpu&gpu=high`、無頭 M3 Pro，量測頁先 `node tools/build.mjs --dev` 重建）：就緒 23.9 s，NodeBuilder 建了 933 次、14.6 s。
   - ✅ ⓐ **實例化網格共用節點**：933 次裡 777 次（10.1 s）是 InstancedMesh：three 的 `getMaterialCacheKey` 對每個 InstancedMesh 加 `object.uuid`（它的 InstanceNode 把物件自己的 instanceMatrix 綁進節點，少的是依 count 定大小的 uniform 陣列），`glbI` 一個道具建一次（425 次）、`uberTraf` 一台車流建一次（252 次），WGSL 只差函式與緩衝的編號。`02-gfx.js` 讓自動轉換的材質從頂點屬性 `gfxIM0`～`3` 讀實例矩陣（render object 從自己的物件拿，交錯緩衝直接用 instanceMatrix 的陣列與版本），鍵裡的 uuid 換成固定字串。結果：建置 933 → 244 次、14.6 → 5.2 s，就緒 23.9 → 14.0 s（WebGL 8.8 s）；固定路線（`__nc.perf.route`）光環廣場 49.5 → 58.6 fps、送出 18.3 → 13.0 ms、卡頓 84 → 10 次、平靜 12.2 → 3.5 s，機場 48.7 → 56.0 fps、卡頓 72 → 1；固定鏡頭 28 張和 WebGL 的差都在雜訊內（室內 ≤3%，人物待機動作與燈閃）。
   - ✅ ⓑ **巢狀 If 的分支每層多跑一倍**（three r186）：ConditionalNode 在 setup 時經 IsolateNode（另一份快取）建分支，之後又在外層快取從同一個呼叫節點 `getOutputNode` 一次；沒有回傳值的分支 `call()` 結果是 null，`once` 也存不住，所以分支函式每次都重跑、裡面的分支又是新節點，每多一層巢狀就多一倍（立面 `facade` 最深的分支一次建置跑 512 次，20.7 萬個節點）。`02-gfx.js` 的 `GFX_TSL.If`（`gfxIf`）替轉出來的分支做記號，`ShaderCallNodeInternal.getOutputNode` 對有記號的每個 builder 只建一次、輸出共用。245 次建置的 WGSL（編號正規化後）和改之前逐份相同；`facade` 每次 20.7 萬 → 7348 個節點、1.88 → 0.14 s，`glb` 3.9K → 2.8K；建置合計 5.0 → 3.2 s，就緒 13.6 → 11.3 s（WebGL 8.8 s）。
   - ✅ ⓒ **同一個材質前後兩個鍵**：`gfxRefresh`（讓 three 每次 render 完整更新材質的節點）原本在第一次 `fromMaterial` 才掛到材質上，比第一個 render object 算鍵晚，同一個材質前後兩個鍵、多建一次（`glb` 72 次裡 28 次是這樣）。改放在 `ShaderMaterial.prototype`（`for…in` 看得到，`getMaterialCacheKey` 只取自己的屬性與原型上的 getter，看不到）。WGSL 逐份相同；建置 245 → 182 次、3.2 → 2.25 s，就緒 11.3 → 10.7 s。剩下的重複只差 render context（倒影等另一個 pass）。
   - ✅ ⓓ **每幀不必要的完整更新**：ⓒ 的 `gfxRefresh` 讓每個 ShaderMaterial 的 render object 每幀都 FULL 更新。改成 ⓒ 之後拿掉 `gfxRefresh`，`needsRefresh` 只在 uniform 值變了才 FULL（見上面 uniform 一項）：無頭的送出光環廣場 11.8 → 9.3–9.5 ms、機場 8.9 → 6.3 ms，截圖在雜訊內。
   - 剩下的：建置 2.25 s 幾乎就是和 WebGL 的差距。`glb` 72 次（1.45 s，42 種 WGSL，defines 形狀與幾何版面，①）、`glbI` 49 次（25 種）；每次建置都要把整份 `GL_LIB`（`shade` 等）各建一份（`gfxOwn`），② 讓純函式走 three 跨 builder 的函式快取可以再省：量到 `gfxOwn` 的函式（含 `room`、`brick` 這類本體自己的）建置合計 1.65 s／2826 次，函式庫的上限更小；要先確定 WGSL 的 uniform 名稱能不能跨 builder 固定（能的話函式庫的函式拿掉 `gfxOwn` 就好），不能的話得把函式改成純函式（uniform、貼圖當參數，`gAmb` 之類改成回傳值），風險高、先不做。
   - 無頭的每幀「送出」WebGPU 比 WebGL 高（光環廣場 12.3 vs 4.1 ms），但實機（HANDOFF「實機幀時間」）是 WebGL 送出時阻塞 24–37 ms、WebGPU 17–21 ms，無頭的數字不能比；剖析穩態一幀：倒影 pass 31%、three 每個物件的固定成本（`_renderObjectDirect`、節點與綁定更新）是大宗。
   - **CPU 用量**（2026-10-30，M3 Pro、關 vsync，`node tools/perf-mem.mjs` 的行程 CPU）：雨夜光環廣場 WebGPU 27.6 ms、renderer 行程 76% 顆核心、GPU 行程 127%；WebGL 31.4 ms、38%／40%：WebGPU 顯示卡端較快，但 CPU 用量是兩倍以上，晴夜（遠景樹霧外剔除後顯示卡變輕）WebGPU 20.8 ms 反而比 WebGL 19.4 ms 慢、renderer 105–118%，是 CPU 瓶頸。CDP 剖析：`writeBuffer` 23%（每幀約 1120 次，其中約 690 次是每個物件的 uniform 綁定 `updateSharedForRender`）、`_projectObject` 10%、`_renderObjectDirect` 7%、`updateMatrixWorld` 4.7%；成本跟 render object 數成正比，倒影 pass 讓它加倍。`instPush`（`20-props.js`：每幀重寫的實例緩衝只上傳前 k 個、k 為 0 不上傳）把 writeBuffer 降到每幀約 990 次，幀時與 CPU 用量量不出差別（緩衝層級的修補到此為止；要省得減少 render object）。
   - 之後（同日）：`70-render.js` 在視錐測試剔掉 count 0 的實例與空幾何（光環廣場主畫面 980 個 draw 裡 460 個是空的）：WebGPU 晴夜光環廣場 19.8／20.1 → 17.6／17.9 ms（WebGL 20.0 ms）、雨夜 renderer 73–76% → 63–64%、writeBuffer 每幀約 990 → 925。遮擋查詢讓遠景樹在被擋住時不進倒影（`reflOcc`）：雨夜光環廣場朝塔樓 WebGPU 27.4 → 22.3 ms。
   - 之後（同日）：`20-props.js` 的 `instWeld` 把 Kit 實例幾何精確焊接加索引（73.6 萬 → 38.7 萬個頂點，0 像素）：雨夜光環廣場朝山 WebGL 31.0 → 28.3、WebGPU 31.1 → 28.3 ms。800 m 外的遠景樹換成合併頂點的版本（面數不變、0 像素）：再降到 WebGL 24.3、WebGPU 24.4 ms；meshopt 減面量過、沒做（改稜線剪影，見 HANDOFF）。遠景樹只送鏡頭看得到的方向（`viewCull`，不剔看得到的）：雨夜街道 23.9 → 19.0 ms。
   - **切換關卡加一項**：晴夜光環廣場（`--disable-gpu-vsync`）WebGPU 的幀時不超過 WebGL，而且 renderer 行程低於 100% 顆核心。現況：幀時這一半已過（17.7 vs 20.0 ms），CPU 這一半還沒（約 103%）。
5. **切換前的關卡**：WebGPU 的 `camAt` 鏡頭卡牆（同樣程式碼結果不同，切換後就是遊戲裡的問題）、載入記憶體峰值、`NC_QUERY='?zrot=25&gfx=webgpu' npm test` 158 項與 `test:glb` 49 項全過、`tools/lib.mjs` 的 `SOFT_ARGS`（SwiftShader）在 WebGPURenderer 退回的 WebGL2 後端跑得動、手機。
6. **切換**（先請使用者 commit，GLSL 刪掉後 WebGL 原版只留在歷史裡）：所有材質改由一個工廠建 `NodeMaterial`，`material.uniforms.X.value` 照舊可寫；刪掉 `WebGLRenderer` 分支、GLSL、`?gfx=`、執行期轉譯器（產生器要用的話留在 `tools/`）。接著清沒用的程式碼與檔案：沒有被引用、有 git 紀錄的直接刪並列出；沒進 git 或判斷不確定的列證據問使用者；其他 session 的區域先問。
7. **非 GLB 物件的質感**：程式建模的建築立面、道具、地面、路燈等改善玩具感與不真實感（材質細節、比例、舊化、邊角），只往提高品質的方向，和移植分開截圖驗收。
   - ✅ 人行道（`10-city.js` 的 `WALK_FS`）：照片混凝土（`uFacA`／`uFacN` 第 2 層 Concrete035）的細節比例與法線、每塊板的色調與冷暖、一成較新的補板、6 mm 鋸縫＋2 cm 倒角與縫裡的髒污、四分之一的板有斜裂縫、口香糖斑（靠路緣較多）、路緣邊的污垢；細節依 `fwidth` 隨距離淡出。以檔案開啟沒有照片時退回 fbm。
   - ✅ 玻璃帷幕（`FACADE_FS` 的 `st == 3`）：照樓選鍍膜（藍綠反射、灰色低輻射、古銅反射：R0 0.22／0.11／0.32 與透過色）、Fresnel 從 R0 起算、每片玻璃枕狀鼓起讓倒影在板間錯開、七成的樓有天花板以上的背漆拱肩板、鋁框照樓選陽極鋁／黑／古銅並帶天空倒影（`facMul`）。以 http 開啟時 258 棟玻璃樓裡 219 棟換成建築組 GLB，程式立面的剩 37 棟（以檔案開啟全部）。
   - ✅ 室內（正常遊玩時仍是程式建模外殼的場館）：GARAGE 07、銀行大廳、展示廳從 `MAT.uber`（平的頂點色）換成 `MAT.ux`，大面積改用程式紋理：車庫的混凝土磚牆、環氧樹脂地坪、混凝土天花板、烤漆鋼樑、鍍鋅捲門、木工作台與洞洞板；銀行與展示廳新增的拋光大理石地磚（`aMat` 40，62.5 cm 對齊展示廳 2.5 m 的黃銅線）、漆面灰泥牆（41），胡桃木照木紋方向。環氧地坪的環境反射 0.12 → 0.03（在 CHROME WORKS 與車庫斜看會映出一格格霓虹）。頂樓公寓等安全屋進門會下載模型；`__nc.enter` 直接傳送不觸發下載，截圖看到的是替身。夜店幾乎全黑，沒改。
   - 建築組 GLB（`26-glb.js` 的 `glb` 材質，以 http 開啟時約一半的地塊）的亮窗（使用者同意後改）：原本整片純色方塊，改成室內映射的房間（與立面共用 `ROOM_GL`）＋Fresnel 反射；落地窗與帷幕牆判成辦公室（整層亮、暖白／冷白），一樓店面依 6 m 開間一起亮。模型幾何沒動。
   - 銀行大廳補上 Kit 陳設（家具、提款機、櫃台設備、後台、保險箱牆），金庫門借 `cs_vault`；櫃台玻璃改成半透明的 `MeshBasicMaterial`（反射玻璃會映出城市霓虹色塊、也擋住行員區）。

技術注意事項（之前留下的，仍然有效）：
- `uLampT` 是 Float32 的路燈表，用 `textureLoad` 讀，不需要過濾；`uHMap` 是 HalfFloat，可以線性過濾。
- 點光與地上陰影的陣列 uniform 是平的 `Float32Array`（`00-core.js` 的 `V4A`／`v4set`），手寫時照 vec4 陣列讀。
- `70-render.js` 換掉了 three 的 `Object3D.updateMatrixWorld` 與 `Frustum.intersectsObject`，WebGPURenderer 也走這兩個。
- ✅ 倒影的 `reflCam` 遠平面已依 `R.coordinateSystem` 用 0..1 的公式（2026-10-27）。
- 人物（`40-people.js` 的 CHAR_VS）的頂點屬性加上服裝後有 14 個，超過 WebGPU 一條管線 8 個頂點緩衝的上限：`charPack` 把 Float32 的 `aSlot`／`aUnp`／`aUnn`／`aPat`／`aWP` 與 Uint8 的 `aWA`／`aWB`／`aWC` 各交錯成一個 `InterleavedBuffer`（原始陣列留在 `userData.raw`，`charRaw` 讀）。WebGPU 沒有 3 個分量的 8／16 位元格式，這幾個屬性一律是 4 分量。新增人物屬性要放進這兩組。
- 待辦：服裝的圖案（CHAR_FS 的 `wearTile`）在 WebGPU 下沒畫出來（底色與左右拼色正常，格線與花樣全沒有）；把 `aWP` 換到交錯緩衝的第一個沒有差別，懷疑是自動轉換在 `wearTile` 的整數 `pt` 分支或 `fract`／`floor` 上和 GLSL 不一致，要對照 `src/tsl/m-char.mjs` 查。
- ✅ 建築組 GLB 的 `_win` 是 Uint16 單分量（unorm16 x1），WebGPU 建管線報錯：已由 `02-gfx.js` 的 `gfxVF` 在第一次用到時換成 float32（不用改 `tools/props.mjs`）。
- 效能面板要接 WebGPU 的 timestamp query（現在 WebGPU 沒有顯示卡計時），draw call 計數在 WebGPU 會累加。
- MSAA ×2 在 WebGPU 要對應到 ×4 或關掉。

量測工具（`.cache/`，gitignore）：

- `gfxcheck.mjs`：錯誤、警告、`miss` 清單、截圖。
- `probe.mjs`：錯誤隨時間變化與 `post.scale`。
- `serve.mjs`：靜態伺服器。python 的 `http.server` 同時請求一多就會重設連線。
