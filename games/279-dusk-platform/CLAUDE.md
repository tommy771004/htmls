# 279 黃昏月台 · DUSK PLATFORM

傍晚無人的日本 JR 式島式月台，Blender 5.2 全程序建模，Cycles 渲染 12.5 秒推軌短片＋製作縮時花絮。
網站頁面是**無 build 的單檔** `web/279-dusk-platform.html`，只引用 `assets/279/` 的影片與截圖。
這個資料夾是產生那些素材的工具鏈；Blender 只是開發依賴。

## 產物

| 檔案 | 來源 |
| --- | --- |
| `assets/279/platform.mp4`、`poster.jpg` | `out/frames/*.png`（tools/render.py）→ ffmpeg |
| `assets/279/making.mp4`、`making.jpg` | `out/shots/*.png` + `manifest.json`（tools/build_mcp.py）→ tools/timelapse.mjs |
| `assets/279/stage-*.jpg` | `out/shots` 裡的鏡頭視角截圖裁切 |
| `thumbs/279.jpg`（640×400） | 正片中段一格 |

`out/` 不進 git（scene.blend、1 GB 截圖與畫格）。

## 結構

- `parts/common.py`：佈局常數（月台邊 x=±4.60、柱 y=12,24…、鏡頭 `CAM`、太陽 `SUN`、材質鍵 `MATS`）與共用工具
  （`C.coll`、`C.mat` 佔位材質、`C.Builder`、`C.instance`、`setup_camera`）。權威數值都在這裡。
- `parts/<模組>.py`：`platform`、`canopy`、`tracks`、`signs`、`city`（幾何）、`materials`（把佔位材質原地換成程序化節點）、
  `lighting`（天空、太陽、補光、空氣透視、渲染設定、合成、鏡頭動畫）。每個模組是 `STEPS = [(標籤, fn), …]`，
  第一步 `C.coll(name, fresh=True)`，所以可重跑。花絮的一步就是一個 step。
- `tools/tex.mjs`：日文字標示的貼圖（方向牌、LED 看板、站名標、廣告）用 HTML 排版，chrome-headless-shell 截圖到 `tex/`。
- `tools/preview.py`：無頭預覽（`--parts` 依序載入模組、`--view shot|left|right|…`、`--engine cycles|workbench`）。
- `tools/start_gui.py` + `tools/bl.py`：在 GUI Blender 裡啟動官方 MCP 外掛的 socket bridge（:9876），用自己的 client 送程式碼。
- `tools/build_mcp.py`：經 MCP 逐步建模、每步截 Blender 視窗；中文字幕對照表 `MOD_ZH` / `STEP_ZH` 在檔案開頭。
- `tools/render.py`：背景 Blender 從 `out/scene.blend` 渲染正片，已存在的格會跳過（可中斷續跑）。
- `BRIEF.md`：給模組作者（含平行代理）的場景規格。

## 指令

```bash
cd games/279-dusk-platform
node tools/tex.mjs                                    # 先產生日文貼圖
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b --factory-startup -P tools/preview.py -- --parts platform,canopy,tracks,signs,city,materials,lighting \
   --engine cycles --samples 48 --res 1280x720 --out $PWD/out/prev/x.png     # 全場景預覽，約 15 s

$B out/empty.blend --python tools/start_gui.py &      # GUI Blender + MCP bridge（開 empty.blend 才不會有啟動畫面）
python3 tools/build_mcp.py                            # 全部重建＋65 張截圖＋存 out/scene.blend，約 6 分鐘
#   --only materials,lighting 只重跑某些階段（不清場景）；--noshots 不截圖

$B -b out/scene.blend -P tools/render.py -- --frames 1-300   # 正片，每格約 40 s（M 系列 Metal，96 spp）
node tools/timelapse.mjs                              # 花絮 → ../../assets/279/making.mp4，章節時間寫到 out/chapters.json
```

正片編碼：`ffmpeg -framerate 24 -i out/frames/f%04d.png -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart`。
花絮章節時間要手動抄進頁面 `CHAPTERS`。

## 坑

- GUI 是繁中介面：預設資料塊與節點名稱會被翻譯（「Principled BSDF」不存在），一律用 `bl_idname` 找節點；工作區是「配置」「著色」。
- MCP 外掛用 addon_utils 偵測不到、`server_start` 要求線上存取：`start_gui.py` 直接 import `blender_mcp_addon` 的模組啟動 server，
  並註冊 `execute_interactive.run` 計時器。
- 模組要用檔案路徑載入（`importlib.util.spec_from_file_location`），因為 `parts/platform.py` 和標準庫 `platform` 撞名。
- 天空貼圖 MULTIPLE_SCATTERING：`sun_rotation` 0 指向 +Y、+90° 指向 +X，傳 `radians(azimuth)`。
  `disc=False` 關掉天空自帶的太陽盤，否則它和太陽燈重複照明，調太陽燈能量幾乎沒效果。
- 天空只在鏡頭光線上降飽和與偏藍灰（`SKY.cam_tint`）；照明用的天空光維持原色。白平衡 7800 K 再把整體拉暖。
- 太陽在左後方（方位 −115°、仰角 6°），照亮柱子正面與右側擋土牆；舊文件寫的 −52° 已廢棄。
- 棚頂靠兩片朝上、鏡頭看不到的面光（`BOUNCE`）補地板反光，否則燈具外殼擋光、折板屋面一片黑。
- 鏡頭 y 0.5→3.5（28 mm、眼高 1.55）。方向牌在 y=10、頂 z=3.60，鏡頭推過 y≈5 會被畫面上緣切掉。
- 截圖前 `view3d.view_center_camera()` 讓鏡頭框填滿視窗；節點編輯器的 `view_all` 要在換樹後另一個請求再呼叫。
  材質預覽剛切換時 EEVEE 還在編譯著色器，要多等幾秒。
- 場景約 2,400 物件、21.9M 三角形（樹葉卡片多）；預覽 1280×720 48 spp 約 13 s。
- 沒有使用 Tripo 或任何下載模型；站名「汐見台」與廣告品牌都是虛構的，不放真實鐵道公司標誌。
