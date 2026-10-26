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
  - 原本的 ShaderMaterial 會掛上一個節點（`m.gfxRefresh`）。three 只在材質帶節點時才每次完整更新綁定；沒有這個節點的話，改 `uniforms.x.value` 不會生效，換渲染目標後還會綁到已經銷毀的貼圖。
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

## 接下來

1. **第二階段：GL_LIB 與城市主體**
   - 把 `GL_LIB` 寫成 TSL 的 `Fn` 函式庫：`shade()` 用一個 `Fn` 一次算出 `gSun`／`gAmb`／`gOccS`／`gSky`；有提前跳出的迴圈（`sunVis`、`lampGrid`）用 `Loop` 加 `Break`。
   - 接著改：`07-kitx.js` 的 `MAT.ux`、`10-city.js` 的 8 個材質、天空、`mVol`。
   - 先決定兩件事：
     - `uLampT` 是 Float32 的路燈表，用 `textureLoad` 讀，不需要過濾。
     - `uHMap` 是 HalfFloat，可以線性過濾。
   - 點光與地上陰影的陣列 uniform（`uLP`／`uLC`／`uLD`／`uOccA`／`uOccB`）在 2026-10-27 改成平的 `Float32Array`（`00-core.js` 的 `V4A`／`v4set`）。`gfxU` 目前用 `Array.isArray` 判斷陣列，typed array 會被當成單一 uniform，要加 `ArrayBuffer.isView` 的分支（`uniformArray` 照 vec4 讀）。
   - `70-render.js` 換掉了 three 的 `Object3D.updateMatrixWorld`（沒變的不重算）與 `Frustum.intersectsObject`（全進霧裡的不畫），WebGPURenderer 也走這兩個。
   - 倒影的 `reflCam` 投影是照 WebGL 的公式改遠平面，WebGPU 要改用 0..1 的版本。另外 `reflCam` 第一次 render 時，three 會因為座標系統改變而重算投影，要先設好 `coordinateSystem`。
2. **第三階段**：`20-props.js`（8 個）、`21-coast`／`21-isle`／`21-tron`、`26-glb.js` 的 uber（實車與 GLB 模型）、`27-props.js`。
3. **第四階段**：車輛、船、`40-people.js` 自己做的蒙皮（最後做），以及 `60-venues`、`64`、`66`、`68`、`69` 的室內。
4. **第五階段**：
   - 效能面板接 WebGPU 的 timestamp query：Mac 第一次量得到顯示卡時間，WebGL 的 Metal 後端沒有計時擴充。
   - MSAA ×2 改對應到 ×4 或關掉。
   - 量測 CPU 送出與幀時：機器負載要低，或在使用者自己的 Chrome 量。
   - 決定要不要讓支援的瀏覽器自動用 WebGPU；到時候在 Esc 選單加 `SET.gfx`。`00-core.js` 排在 `01-settings.js` 前面，要先讀 `localStorage`。

量測工具（`.cache/`，gitignore）：

- `gfxcheck.mjs`：錯誤、警告、`miss` 清單、截圖。
- `probe.mjs`：錯誤隨時間變化與 `post.scale`。
- `serve.mjs`：靜態伺服器。python 的 `http.server` 同時請求一多就會重設連線。
