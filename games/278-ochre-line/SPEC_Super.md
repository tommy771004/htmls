Babylon.js + WebGPU 《反恐精英 2 (CS2)》風格 AI 開發完整提示詞手冊本手冊根據您的六階段視覺錨點驅動開發流（Visual-Anchor Driven Pipeline），全面對齊 Counter-Strike 2 (Source 2 引擎明亮寫實光影、Dust II / Mirage 建築美學、經典 AK-47/M4A4/AWP 軍火庫、CT/T 雙陣營與 CS2 Panorama HUD)，並將原本的 Roblox Studio MCP 完整轉換為 Babylon.js (WebGPU) + Havok Physics (Wasm) + Blender MCP + Browser MCP (Playwright) 工具鏈。0. 角色分工與工具鏈對照（Who Does What）角色 / 模組原生工作流Babylon.js + WebGPU (CS2 專版) 架構核心職責與技術產出你 (Director)概念圖、試玩、決策去留Midjourney / Flux + 瀏覽器實機試玩產出 5 張 CS2 風格黃金標準概念圖（Ground Truth）、在瀏覽器實機測試急停射擊（Counter-strafing）與彈道手感、決定視覺去留。Opus 5.5 (AI 總工程師)地圖、所有腳本、Blender 槍枝TypeScript (Babylon.js) + Blender MCP (bpy)撰寫 WebGPU Source 2 風格 PBR 管線、利用 ThinInstance 拼裝 Dust2/Mirage 城鎮模組、撰寫 Havok 物理與 CS2 彈道腳本、操控 Blender 建立導角寫實槍枝。Tripo3D (角色生成)雙陣營士兵 3D 模型Tripo3D (Multi-View Image-to-3D)接收正、側、背三視圖裁切圖，生成 CT（反恐菁英） 與 T（恐怖分子） 的 .glb 原始模型。環境執行與截圖 MCPRoblox Studio MCPBrowser MCP (Playwright) + Vite + Blender MCP自動在支援 WebGPU 的瀏覽器執行遊戲、將相機鎖定至 Key Art 視角截圖、提取像素色偏（$\Delta E$）與飽和度數據回傳給 Opus 進行校色。全域系統提示詞（System Prompt — 專案啟動時餵給 Opus）在開始 Step 1 之前，請先將以下 System Prompt 設定於您的 AI 編程代理（Claude Code / Cursor）：# Role: Lead Babylon.js WebGPU & Counter-Strike 2 Technical Artist Architect

你負責協助我開發一款基於瀏覽器原生執行、視覺與手感全面對齊《Counter-Strike 2 (CS2)》的 3D 戰術射擊遊戲。所有產出的程式碼與資產必須嚴格遵守以下黃金準則：

1. **CS2 (Source 2) 視覺與物理寫實標準**：
   - 嚴禁做成卡通或科幻風格。全面採用寫實 PBR 材質：陽光曝曬的淺米色砂岩/灰泥牆面、剝落磚牆細節、軍綠色/木質炸彈區掩體箱（含紅漆噴字 A / B 標示）、高可視度的人物輪廓對比。
   - 光照必須還原 CS2 的「高明度自然日光 + 柔和暖色漫反射（Bounce Light）+ 清晰冷灰藍色陰影」，確保陰暗角落依然具備極高的競技辨識度（High Player Visibility）。
2. **渲染引擎規範 (WebGPU First)**：
   - 強制使用 `BABYLON.WebGPUEngine` 初始化場景，啟用 `enableAllFeatures: true`。
   - 靜態場景（城鎮建築、地板、掩體箱）載入後，必須支援開啟 `engine.snapshotRendering = true` 及 `BABYLON.Constants.SNAPSHOTRENDERING_FAST`，將 CPU Draw Call 提交開銷降低 $80\%$ 以上。
3. **極致批次渲染 (Zero Scene-Graph Overhead)**：
   - 所有重複使用的城鎮組件（Town Kit：砂岩牆、拱門、窗框、木箱、石板地）嚴禁建立獨立 `Mesh` 實例，一律透過 `mesh.thinInstanceAdd(matrix)` 轉換為單一緩衝區批次渲染。
4. **物理與零垃圾回收控制 (Zero GC & Havok Wasm)**：
   - 物理層強制使用 `@babylonjs/havok` (`HavokPlugin`)。
   - 在 `scene.onBeforeRenderObservable` 遊戲主迴圈中，嚴禁使用 `new BABYLON.Vector3()`、`new BABYLON.Matrix()` 或 `new BABYLON.Quaternion()`，一律使用預先配置的靜態暫存變數（如 `TMP_VEC3_A`）搭配 `copyFromFloats` 或 `ToRef` 方法，確保 0 GC 掉幀。
5. **視覺對齊原則 (5 Concept Images as Ground Truth)**：
   - Step 1 建立的 5 張概念圖為絕對視覺基準。任何地圖結構、槍枝導角、色彩飽和度與 HUD 尺寸，皆須透過 Browser MCP 截圖與概念圖進行數值比對。
Step 1：生成 5 張 CS2 風格核心概念基準圖（5 Concept Images）目標：先產出 5 張定義遊戲最終樣貌的基準圖（Key Art、HUD、Soldiers、Guns、Town Kit），後續所有建置都會拿來與這 5 張圖比對。
執行者：你（使用圖像生成模型如 Midjourney v6.1 / Flux.1 Dev）1.1 Key Art（CS2 風格主視覺與光影基準圖）用於決定地圖核心交火區（Site A 與主通道）的構圖、相機視角（$90^\circ$ 水平 FOV）、Source 2 陽光仰角與整體色彩飽和度。[Image Generation Prompt - 1. Key Art]
Counter-Strike 2 (CS2) Source 2 engine in-game screenshot style, iconic Dust2 and Mirage inspired Middle-Eastern sun-drenched sandstone town Bomb Site A, photorealistic PBR materials with clean competitive readability, bright warm afternoon sunlight casting crisp natural shadows with soft warm global illumination bounce light, olive-drab military ordnance crates and wooden pallets stacked in the bomb site center with red stenciled "A" markings on the wall, arched limestone corridor on the left, two-story weathered stucco building with wooden shutters and terracotta awning on the right, first-person eye-level camera at 1.7m height, 90-degree horizontal FOV, vibrant clean saturation, zero motion blur, crisp geometry --ar 16:9 --v 6.1
1.2 HUD（CS2 Panorama UI 風格介面排版與色彩基準圖）用於讓 AI 測量精確的像素尺寸、字體大小、色碼（CT 藍與 T 黃銅色）與佈局。[Image Generation Prompt - 2. HUD Concept]
Counter-Strike 2 (CS2) Panorama UI HUD layout sheet overlaid on a flat neutral 50% gray background (#808080) for exact pixel and color measurement, clean modern tactical esports HUD: 1) Top-left circular radar minimap with clean geometric map lines, 2) Top-center compact scoreboard showing round timer "1:55" in bold white font, Counter-Terrorist score in steel-blue (#5D79AE) on the left and Terrorist score in warm amber-gold (#DE9B35) on the right with 5 player alive indicator mini-cards on each side, 3) Bottom-left money counter "$4750" in crisp green/white, 4) Bottom-center-left large bold health number "100" with cross icon and armor "100" with shield-helmet icon over a sleek semi-transparent dark backdrop, 5) Bottom-right vertical weapon inventory stack (AK-47 silhouette, USP-S pistol, combat knife, HE grenade, flashbang, smoke grenade) above a large bold ammo counter "30 / 90", 6) Center classic static green tactical crosshair, sharp 1920x1080 vector UI --ar 16:9 --v 6.1
1.3 Soldiers（CS2 反恐菁英 CT 與恐怖分子 T 正側背三視圖）用於裁切正、側、背視圖並餵給 Tripo3D 生成兩個陣營的 3D 模型，關節分界清晰以便後續切分 Hitbox。[Image Generation Prompt - 3. Soldiers Concept Sheet]
Counter-Strike 2 (CS2) character model turnaround sheet for two opposing teams on a pure white background (#FFFFFF): Left half is a Counter-Terrorist (CT) SAS/SEAL operator wearing navy-blue and olive tactical combat uniform, ballistic helmet with tactical goggles, dark balaclava, chest rig vest, and knee pads; Right half is a Terrorist (T) Phoenix/Elite faction fighter wearing a desert tan keffiyeh headscarf and sunglasses, olive cargo pants, rolled-up sleeves, and leather AK chest harness. Strict orthographic front view, side view, and back view for each soldier, symmetrical A-pose with arms at 45 degrees and legs slightly apart, clearly defined joint seams at neck, shoulders, elbows, waist, hips, knees, and ankles for 3D hitbox segmentation, studio flat lighting, no cast shadows --ar 16:9 --v 6.1
1.4 Guns（CS2 經典槍枝三視圖與金屬導角基準圖）用於定義第一人稱武器（AK-47、M4A4、USP-S / Desert Eagle、AWP）的結構比例、硬邊導角（Bevels）高光與木紋/烤漆材質。[Image Generation Prompt - 4. Guns Concept Sheet]
Counter-Strike 2 (CS2) orthographic side-profile weapon concept sheet on pure white background (#FFFFFF), 4 iconic tactical firearms arranged vertically: 1) Classic AK-47 assault rifle with stamped steel receiver and warm varnished birch wood stock and handguard, 2) M4A4 tactical carbine in matte black and dark flat-earth finish with picatinny rails, 3) AWP bolt-action sniper rifle with olive-green polymer chassis and fluted scope, 4) Desert Eagle / USP-S tactical pistol. Crisp hard-surface industrial design, pronounced chamfered metallic bevels catching sharp specular highlights, ultra-sharp PBR textures, clean factory-new finish --ar 16:9 --v 6.1
1.5 Town Kit（CS2 模組化砂岩城鎮建築與掩體組件表）用於指導 AI 建立可重複拼接（Snap-to-Grid）的建築積木與標準掩體箱。[Image Generation Prompt - 5. Modular Town Kit]
Counter-Strike 2 (CS2) Dust2 and Mirage modular environment asset kit laid out on a neutral grid floor, isometric view, aligned to a 4-meter grid system: 1) Sun-bleached sandstone wall module with weathered plaster edge (4x4m), 2) Moorish/Mediterranean arched stone passageway wall, 3) Upper-floor wall with recessed wooden shutter window and AC unit, 4) Striped fabric market awning and terracotta roof trim, 5) Iconic CS2 olive-green military weapon crates and banded wooden bomb-site boxes (1.2x1.2m single stack and double stack), 6) Dusty limestone floor tiles and stone steps. Consistent texel density, bright realistic PBR albedo, crisp normal map bevels --ar 16:9 --v 6.1
Step 2：分階段建構地圖（Build the Map in Stages）目標：每次只透過一個提示詞建構一個區域（先做 A 通道與 A 點 $\rightarrow$ 再做 B 點 $\rightarrow$ 最後做中路與其餘部分），每階段都透過 Browser MCP 截圖驗證，避免 AI 一次寫完導致座標錯亂。
執行者：Opus 5.5（撰寫 Babylon.js 模組程式碼）+ Browser MCP（自動載入並截圖驗證）Stage 2A：建立 CS2 模組化 Town Kit 並搭建「A 主通道（A Long/Lane）與 A 炸彈區（Site A）」將 1_key_art.png 與 5_town_kit.png 附帶給 Opus，輸入以下提示詞：# Prompt 2A: Build CS2 Modular Town Kit, A-Lane, and Bomb Site A (Babylon.js WebGPU)

請檢視附件的 `1_key_art.png` 與 `5_town_kit.png`。我們現在進行地圖的第一階段建構：**只建立模組化 Town Kit 生成器，以及「A 主通道（A Lane）與 A 炸彈據點（Site A）」**。請勿在此階段生成 B 區或其他區域。

請執行以下步驟：
1. **定義 4 米網格座標系與 CS2 模組化 Town Kit (`TownKitBuilder.ts`)**：
   - 嚴格參照 `5_town_kit.png` 的比例與色調，在 Babylon.js 中建立基礎母體網格（Master Meshes，設為 `isVisible = false`）：
     - `Wall_Sandstone` ($4\text{m} \times 4\text{m} \times 0.4\text{m}$ 淺米色砂岩牆體，底部含防踢腳線細節)
     - `Wall_Archway` ($4\text{m} \times 4\text{m}$，中央含 $2.2\text{m}$ 寬拱門通道)
     - `Wall_Upper_Window` ($4\text{m} \times 4\text{m}$，含百葉窗與窗台)
     - `Crate_Military_Green` 與 `Crate_Wood_BombSite` ($1.25\text{m} \times 1.25\text{m} \times 1.25\text{m}$ 標準 CS2 掩體箱，高度設定能讓站立玩家露出頭部 $1.70\text{m}$、蹲下玩家 $1.15\text{m}$ 完全隱蔽)
     - `Floor_Limestone` ($4\text{m} \times 4\text{m}$ 砂石地磚)
   - 所有重複組件必須強制使用 `mesh.thinInstanceAdd(matrix)` 進行批次渲染，並同步建立對應的 `BABYLON.PhysicsAggregate` (使用 `HavokPlugin`，`PhysicsShapeType.BOX`，質量 `mass: 0` 靜態碰撞體)。
2. **搭建 A Lane 與 Site A (`MapStageA.ts`)**：
   - 100% 對齊 `1_key_art.png` 的構圖與幾何關係：
     - 建立從 T 陣營推進至 Site A 的「A 主通道（A Lane）」（寬度 $8\text{m}$，長度 $28\text{m}$，含一處長距離對槍轉角與左側拱門掩體）。
     - 建立「Site A 炸彈廣場」（$24\text{m} \times 24\text{m}$），中央配置與 `1_key_art.png` 完全一致的雙層軍綠/木質裝甲箱群（Default Plant Spot），牆面加上紅色 `[A]` 標誌貼花（Decal），右側配置雙層赤陶屋簷建築立面與斜坡平台（A-Ramp）。
3. **架設 Key Art 基準相機 (`KeyArtRefCam`)**：
   - 除了第一人稱測試相機外，請額外註冊一個固定的 `UniversalCamera` 命名為 `KeyArtRefCam`，將其座標、旋轉角與水平 FOV ($90^\circ$，眼睛高度 $1.70\text{m}$) 精確鎖定在 `1_key_art.png` 的取景角度。
4. **自動驗證**：
   - 啟動本地伺服器並透過 Browser MCP 切換至 `KeyArtRefCam` 擷取畫面，確認建築構圖與 `1_key_art.png` 完全一致。
Stage 2B：搭建「B 炸彈據點（Site B）與 B 通道（B Tunnels / B Main）」確認 Stage 2A 截圖無誤後，輸入以下提示詞：# Prompt 2B: Build Bomb Site B and B-Main Corridor

Stage 2A 的 A 區結構已確認通過。現在請在不修改 `TownKitBuilder.ts` 核心架構與 A 區座標的前提下，擴充第二階段地圖：**建立「B 炸彈據點（Site B）」與「B 主通道（B-Main / Tunnels）」** (`MapStageB.ts`)。

請執行以下規格：
1. **CS2 經典封閉式 B 區戰術佈局**：
   - 將 Site B 配置於地圖西側（以 $X = -32\text{m}$ 至 $-56\text{m}$ 區域為核心），與開放式的 Site A 形成鮮明對比，主打中近距離防禦與投擲物（煙霧彈/閃光彈）封鎖。
   - **B-Main 拱廊通道**：設計為帶有石拱頂與石柱的室內通道（寬度 $6\text{m}$），出口處收窄形成 Chokepoint（瓶頸口）。
   - **Site B 廣場**：尺寸為 $20\text{m} \times 24\text{m}$，裝設區（Plant Zone）配置經典的雙層堆疊木箱與一處可跳躍攀爬的「二樓狙擊窗 / 陽台（B-Window & Balcony，高度差 $\Delta Y = +1.8\text{m}$）」，牆面標示紅色 `[B]` 字樣。
2. **效能與物理整合**：
   - 所有新增的牆體、地板與木箱必須直接追加至 `TownKitBuilder` 現有的 `ThinInstance` 矩陣緩衝區中，並呼叫 `thinInstanceRefreshBoundingInfo(true)`，確保總 Draw Call 數量維持極低常數。
   - 為所有新增結構與階梯斜坡註冊靜態 Havok 碰撞體。
3. **視覺驗證**：
   - 新增一個 `SiteBOverviewCam` 並透過 Browser MCP 截圖，驗證 B 區視線遮蔽（Sightlines）、掩體高度與幾何接縫完全嚴密。
Stage 2C：搭建「中路（Mid）、CT/T 重生點與連通道（Connectors）」並開啟 WebGPU 快照確認 Stage 2B 後，輸入以下提示詞完成整張三線地圖：# Prompt 2C: Build Mid, Connectors, CT/T Spawns & Enable WebGPU Snapshot Rendering

現在進行地圖最後階段：**補齊「中路（Mid）」、「A/B 連通道（Catwalk / Short & Connector）」以及「CT / T 攻守雙方重生區（Spawns）」** (`MapStageC.ts`)，完成完整的 CS2 三線（Three-Lane）競技地圖架構。

請執行以下步驟：
1. **中路對狙線與連通道（Map Closure）**：
   - 建立中央走廊（Mid，$X = -8\text{m}$ 至 $+8\text{m}$），串聯南側的 **T Spawn（恐怖分子重生區，$Z = -44\text{m}$）** 與北側的 **CT Spawn（反恐菁英重生區，$Z = +44\text{m}$）**。
   - 在中路設置經典的「中門（Mid Double Doors，留有狙擊穿射縫隙）」與右側通往 Site A 的高架小道（Catwalk / A-Short），以及通往 Site B 的中路連通道（Mid-to-B Connector）。
   - 沿地圖外圍建立二層背景建築立面（Out-of-bounds Skybox Blockers），確保玩家在任何區域仰視或平視都不會看到地圖外的虛空。
2. **WebGPU 極致渲染最佳化**：
   - 全部地圖模組載入後，呼叫所有靜態母體網格的 `freezeWorldMatrix()` 與材質的 `freeze()`。
   - 實作並啟用 `enableWebGPUSnapshot()`，在靜態光照載入完畢後開啟 WebGPU RenderBundle 快照加速。
3. **全景俯視圖驗證（供後續製作 HUD 雷達底圖）**：
   - 透過 Browser MCP 從正上方正交相機（Orthographic Top-Down Camera）截取一張高解析度無透視地圖俯視圖 `radar_overview_raw.png`，驗證三線戰術動線完整封閉，並保留此俯視圖作為 Step 6 左上角雷達小地圖的底圖。
Step 3：測量與校準色彩（Measure & Match CS2 Saturation）目標：透過 Browser MCP 從 KeyArtRefCam 截圖，用程式測量實機畫面與 1_key_art.png 的飽和度（Saturation）、色溫與明度差距，自動調整 Babylon.js 的 PBR 光照與 ACES 色調映射，完美還原 Source 2 引擎的通透色彩。
執行者：Browser MCP（截圖）+ Opus 5.5（執行色彩統計腳本與調校 Babylon ImageProcessingConfiguration）# Prompt 3: Measure In-Game Colors & Match Saturation to Key Art Concept

現在我們進入 Step 3 色彩測量與校準階段。請將遊戲實機畫面與附件的 `1_key_art.png` 進行像素級色彩比對與校正：

1. **從 Key Art 角度擷取實機畫面**：
   - 使用 Browser MCP 啟動遊戲，呼叫 `window.__GAME_MCP__.switchToKeyArtCam()` 切換至我們在 Step 2A 建立的 `KeyArtRefCam`（隱藏所有 HUD 與準星），擷取一張 $1920 \times 1080$ 的無損截圖 `ingame_step3_raw.png`。
2. **量化色彩與飽和度測量（Colorimetric Script）**：
   - 撰寫並執行一段 Python 色彩分析腳本，將 `1_key_art.png` 與 `ingame_step3_raw.png` 轉換至 **HSV** 與 **CIELAB** 色彩空間，分別對以下 4 個區域取樣計算平均色相（Hue）、平均飽和度（Saturation $S$）與明度（Value $V$）：
     1. **向光面砂岩牆體 (Sunlit Sandstone Wall)**
     2. **地面與建築投射陰影區 (Cast Shadow Area)**
     3. **A 點掩體箱與木質結構 (Bomb Site Crates)**
     4. **天空背景 (Sky Dome)**
   - 輸出兩張圖在各區域的飽和度差值 $\Delta S = S_{\text{concept}} - S_{\text{ingame}}$、明度差值 $\Delta V$，以及色差 $\Delta E_{00}$。
3. **精確調校 Babylon.js WebGPU Source 2 光影管線 (`Cs2LightingPipeline.ts`)**：
   - 根據測量數據修正以下參數，直到整體平均飽和度誤差 $|\Delta S| < 2.5\%$：
     - **DirectionalLight (主太陽光)**：設定精確的太陽方向向量以對齊 `1_key_art.png` 的陰影斜率，調整暖白日光色溫與 `intensity`，並配置 `CascadedShadowGenerator`（2048 解析度，開啟 PCF 柔邊陰影）。
     - **HemisphericLight + IBL 環境光 (模擬 Source 2 全局光照 Bounce Light)**：將 `direction` 設為朝上，`diffuse` 設為清爽天藍，`groundColor` 設為溫暖的砂岩反射米黃色（模擬陽光打在沙漠地面反彈至牆面暗部的暖光），徹底消除死黑陰影。
     - **ImageProcessingConfiguration (後處理校色)**：
       - 啟用 `TONEMAPPING_ACES` 或 `TONEMAPPING_KHR_PBR_NEUTRAL`。
       - 開啟 `colorCurvesEnabled = true`，依據腳本測出的 $\Delta S$ 精確調整 `globalSaturation`、`highlightsSaturation` 與 `shadowsSaturation`，並微調 `exposure` 與 `contrast`。
4. **閉環驗證**：
   - 重新透過 Browser MCP 截取 `ingame_step3_calibrated.png`，輸出校正前後的飽和度數據對照表，確認實機畫面的通透度與飽和度與 `1_key_art.png` 肉眼難辨真假。
Step 4：雙陣營士兵模型與身體部位切割（Soldiers & Hitbox Slicing）目標：從 3_soldiers_concept.png 裁切正、側、背視圖 $\rightarrow$ 交給 Tripo3D 為 CT 與 T 各生成一個 3D 模型 $\rightarrow$ 透過 Blender Python 自動將模型切割為遊戲的獨立身體部位（頭、胸、胃、左右手、左右腿），確保子彈命中判定（Hitgroups）100% 貼合視覺模型。
執行者：你（執行 Tripo3D）+ Opus 5.5（撰寫裁切腳本、Blender 自動切割綁定腳本、Babylon.js CS2 部位傷害與護甲扣血系統）Stage 4A：自動裁切 CT 與 T 正側背三視圖（供餵給 Tripo3D）# Prompt 4A: Cut Orthographic Front, Side, and Back Views for Tripo3D

請讀取附件的 `3_soldiers_concept.png`，撰寫並執行一個自動影像裁切與對齊腳本 (`scripts/slice_soldier_views.py`)：
1. 將左半邊的 **反恐菁英（CT Operator）** 與右半邊的 **恐怖分子（T Fighter）** 分離。
2. 針對每個陣營，自動偵測角色輪廓邊界框（Bounding Box），將正視圖（Front）、側視圖（Side）、背視圖（Back）分別裁切為三張 $1024 \times 1024$、纯白背景、且**頭頂與腳底基準線（Baseline）嚴格水平對齊**的 PNG 圖檔：
   - `ct_front.png`, `ct_side.png`, `ct_back.png`
   - `t_front.png`, `t_side.png`, `t_back.png`
3. 輸出這 6 張圖片，我將把它們放入 Tripo3D 的多視圖生成（Multi-View to 3D）功能，為兩隊各生成一個模型：`ct_raw.glb` 與 `t_raw.glb`。
Stage 4B：Blender 自動切割身體部位與 CS2 部位傷害判定系統將 Tripo3D 產出的 ct_raw.glb 與 t_raw.glb 放入 public/assets/models/ 後，輸入以下提示詞：# Prompt 4B: Cut Tripo3D Soldier Models into Body Parts & Implement CS2 Hitgroup Damage

我已將 Tripo3D 生成的雙陣營士兵模型存放在 `public/assets/models/ct_raw.glb` 與 `t_raw.glb`。
請透過 **Blender MCP / Python (`scripts/segment_soldiers.py`)** 將模型切分為獨立身體部位，並在 Babylon.js 中實作純正的 **CS2 部位命中與護甲穿透系統（Hitgroups & Kevlar/Helmet System）**：

1. **Blender Python 自動骨架建立與網格切分 (`scripts/segment_soldiers.py`)**：
   - 載入 `ct_raw.glb` 與 `t_raw.glb`，將總高度標準化為 $1.80\text{m}$（蹲姿高度 $1.25\text{m}$），腳底置於 $(0, 0, 0)$。
   - 建立標準人形骨架（Armature），並使用空間切割平面（`bpy.ops.mesh.bisect` 搭配切面封口 `use_fill=True`）沿著頸部、雙肩、手肘、腰部、髖關節與膝蓋，將原本單一的網格**實體切割並分離為 11 個獨立命名的身體部位子網格（Body Part Sub-Meshes）**，直接將各部位子網格 Parent 綁定至對應骨骼：
     - `HitGroup_Head`（頭部）
     - `HitGroup_Chest`（胸部）與 `HitGroup_Stomach`（腹部/骨盆）
     - `HitGroup_UpperArm_L`, `HitGroup_Forearm_L`, `HitGroup_UpperArm_R`, `HitGroup_Forearm_R`（左右上肢）
     - `HitGroup_Thigh_L`, `HitGroup_Calf_L`, `HitGroup_Thigh_R`, `HitGroup_Calf_R`（左右下肢）
   - 這樣當角色播放移動、蹲下或持槍動畫時，切割後的身體部位會完美跟隨骨骼運動，且 Babylon.js 的射線檢測能直接命中真實網格部位！最後導出為 `ct_segmented.glb` 與 `t_segmented.glb`。

2. **Babylon.js CS2 精確部位傷害與受擊回饋 (`Cs2HitboxSystem.ts`)**：
   - 為每個士兵的 11 個部位子網格開啟 `isPickable = true`，並在 `mesh.metadata` 寫入 CS2 標準傷害倍率與護甲保護屬性：
     - **Head (`HitGroup_Head`)**：基礎傷害倍率 $4.0\times$（檢查是否擁有頭盔 `hasHelmet`）。
     - **Chest & Arms (`HitGroup_Chest`, `UpperArm`, `Forearm`)**：基礎傷害倍率 $1.0\times$（受防彈衣 `hasKevlar` 保護）。
     - **Stomach (`HitGroup_Stomach`)**：基礎傷害倍率 $1.25\times$（受防彈衣保護）。
     - **Legs (`HitGroup_Thigh`, `Calf`)**：基礎傷害倍率 $0.75\times$（**不受護甲保護**，且命中時觸發 CS2 經典的受擊減速 Tagging 效果）。
   - 實作 `fireHitscanRay()`：使用 `scene.pickWithRay(ray, predicate, false)` 精確檢測切割後的部位網格，命中時根據武器的 `armorPenetration`（護甲穿透率，如 AK-47 為 $77.5\%$、M4A4 為 $70\%$）計算最終扣血，並在命中的具體部位網格上觸發血液/頭盔火花粒子與爆頭音效（Headshot Dink Sound）。
Step 5：CS2 槍枝雙階段開發（Guns: Fast Blockout $\rightarrow$ Real Bevels & Sharp Textures）目標：第一版先求快（迅速建立 AK-47、M4A4、AWP、USP-S 的方塊原型，調好 CS2 的急停精準度、固定彈道圖 T-pattern 與切換手感）；第二版透過 Blender MCP 重建每一把槍，加入真實硬邊導角（Real Bevels）與高銳利度金屬/木紋 PBR 貼圖。
執行者：Opus 5.5（Babylon.js CS2 彈道與 ViewModel 腳本 + Blender Python 高精度硬表面槍枝建模）Stage 5A：第一版極速原型與 CS2 急停/彈道系統（First Version Fast）# Prompt 5A (Pass 1): Fast Blockout CS2 Guns & Counter-Strafing / Spray Pattern Mechanics

請參照附件 `4_guns_concept.png` 中的四把經典武器（**AK-47, M4A4, AWP, USP-S**），先以**最快速度在 Babylon.js 中建立第一版幾何原型（Fast Blockout）**，並實作 CS2 核心射擊機制 (`Cs2WeaponSystem.ts`)：

1. **獨立的 ViewModel 渲染群組與 CS2 持槍視角**：
   - 建立第一人稱武器專用的 `TransformNode` 綁定於相機右下側（模擬 CS2 經典指令 `viewmodel_fov 68; viewmodel_offset_x 2.5; viewmodel_offset_y 0; viewmodel_offset_z -1.5` 的持槍位置）。
   - 將所有武器網格的 `renderingGroupId` 設為 `1`，確保靠近牆壁時槍管絕不穿模。
2. **第一版快速幾何組裝（Fast Blockout）**：
   - 使用基礎幾何體快速拼出 AK-47（彎月彈匣、木托色塊）、M4A4、AWP（長槍管與狙擊鏡筒）與 USP-S（含消音管）的正確尺寸比例。
3. **純正 CS2 射擊與移動精準度邏輯（0 GC 實作）**：
   - **移動散射與急停（Movement Inaccuracy & Counter-Strafing）**：即時讀取玩家的水平移動速度 $\|\vec{v}_{xz}\|$，當速度低於最大速度的 $34\%$ 時判定為完全精準（落點完全集中於準星中央）；移動射擊則產生大幅度隨機散射。
   - **固定後座力彈道圖（Deterministic Recoil Pattern + Aim Punch）**：為 AK-47 與 M4A4 定義前 30 發子彈的 2D 固定上揚與左右擺動座標陣列（經典 `7` 字型 / `T` 字型壓槍軌跡），並同步驅動槍枝模型的後座力回推（Z-kick）、槍口上跳與拋殼窗彈殼拋出特效。
Stage 5B：第二版 Blender 重建——真實導角與銳利貼圖（Rebuild with Real Bevels & Sharper Textures）試玩第一版確認壓槍手感與切槍節奏無誤後，輸入以下提示詞：# Prompt 5B (Pass 2): Rebuild Every CS2 Gun in Blender with Real Bevels and Sharp PBR Textures

第一版槍枝的尺寸與彈道手感已驗證完畢。現在進入 **Step 5 第二階段**：請透過 **Blender MCP / Python (`scripts/build_cs2_guns_hd.py`)**，嚴格對照 `4_guns_concept.png`，將四把槍（AK-47, M4A4, AWP, USP-S）全面重建為具備**真實幾何導角（Real Bevels）與高銳利度 PBR 貼圖**的精細模型：

1. **真實幾何導角建模（Real Bevel Geometry in Blender）**：
   - 嚴禁使用沒有導角的死硬方塊。請在 Blender Python 中使用 `bmesh` 精細刻畫每把槍的標誌性機械細節：
     - **AK-47**：沖壓機匣凹槽、拉機柄、氣孔護木、弧形鋼製彈匣肋條、準星護圈與實木槍托。
     - **M4A4**：四面魚骨戰術護木（Picatinny Rails 每格凹槽分明）、提把/摺疊照門、伸縮槍托與斜角消焰器。
     - **AWP**：雙腳架、大型精密狙擊鏡、旋轉後拉式槍機握把與拇指孔槍托。
     - **USP-S**：多邊形戰術滑套切角、防滑刻痕（Slide Serrations）與圓柱形消音器。
   - **關鍵導角工序**：對所有硬表面零件套用 `Bevel Modifier`（`width = 0.002m`, `segments = 3`, `profile = 0.7`, `harden_normals = True`）並加上 `Weighted Normal Modifier`。這能讓槍枝在第一人稱視角轉動時，金屬稜線捕捉到極度銳利、平滑的 Source 2 陽光高光（Specular Edge Highlights）。
2. **高銳利度程序化烘焙貼圖（Sharper 2K Textures）**：
   - 建立並烘焙 $2048 \times 2048$ 的高銳利度 PBR 貼圖（開啟 `Sampling.TRILINEAR_SAMPLINGMODE` 與最大各向異性過濾 `anisotropicFilteringLevel = 16`）：
     - **鋼鐵與陽極氧化鋁（Stamped Steel & Anodized Aluminum）**：深槍鐵色（`#1E2226`），金屬度 `Metallic = 0.92`，粗糙度 `Roughness = 0.28`，導角邊緣帶有極細微的銀白金屬高光邊（Edge Wear）。
     - **AK-47 樺木實木烤漆（Varnished Birch Wood）**：高清晰度的深淺琥珀色木紋條理，搭配清漆反射層（`Roughness = 0.22`）。
     - **戰術防滑握把（Tactical Polymer Grip）**：透過高頻率 Normal Map 呈現銳利的菱格防滑咬花顆粒（`Roughness = 0.65`）。
3. **導出與實機比對驗證**：
   - 將四把槍導出為 `.glb` 並載入遊戲替換第一版模型。透過 Browser MCP 分別擷取四把槍在陽光下的第一人稱持槍畫面，與 `4_guns_concept.png` 比對導角反光與材質銳利度。
Step 6：測量並 1:1 複製 CS2 HUD（Measure Colours & Sizes on Concept Picture）目標：先用電腦視覺腳本精確測量 2_hud_concept.png 上每個色塊的 Hex 色碼、字體像素高度與長寬座標，再 1:1 完美複製到遊戲畫面上。
執行者：Opus 5.5（撰寫像素與色彩測量腳本 + CS2 Panorama HUD 實作）+ Browser MCP（截圖疊合驗證）# Prompt 6: Measure Exact Colors & Pixel Sizes on HUD Concept and Replicate 1:1

請檢視附件的 `2_hud_concept.png`（基準解析度 $1920 \times 1080$）。我們現在執行最後一步：**严禁憑空猜測尺寸與顏色，必須先用程式測量概念圖上的顏色與像素尺寸，再 1:1 複製進遊戲中**：

1. **第一階段：執行電腦視覺測量腳本 (`scripts/measure_cs2_hud.py`)**：
   - 撰寫並執行一段 Python 腳本讀取 `2_hud_concept.png`，自動測量並輸出 `cs2_hud_metrics.json`，包含：
     - **精確座標與長寬尺寸 $(x, y, width, height)$**：
       1. 左上角圓形雷達小地圖（Radar Minimap）的外框直徑與邊距。
       2. 頂部中央計分板（回合時間框、左方 CT 分數框、右方 T 分數框、兩側存活人數頭像列）的精確像素長寬與間距。
       3. 左下角金錢數字（`$4750`）的位置與字高。
       4. 中下偏左（或左下）的 **HP 血量 (`100`) 與 Armor 護甲 (`100`)** 面板尺寸、圖示大小與進度條厚度。
       5. 右下角 **彈藥計數器 (`30 / 90`)** 與上方垂直排列的 **五格武器欄剪影（主武器、副武器、刀、投擲物）** 的尺寸與邊距。
       6. 畫面正中央靜態戰術準星（Crosshair）的線長（Length）、線寬（Thickness）、中心間隙（Gap）與外框黑邊（Outline）。
     - **精確色碼提取（Exact Hex & RGBA Sampling）**：
       - 提取 CT 代表藍（如 `#5D79AE`）、T 代表黃銅金（如 `#DE9B35`）、準星亮綠色、金錢綠色、滿血白色、殘血警告紅色（$< 25\text{ HP}$），以及毛玻璃底板的背景色與 Alpha 透明度。

2. **第二階段：零渲染開銷的 CS2 Panorama HUD 1:1 實作 (`Cs2HudOverlay.ts`)**：
   - 直接讀取 `cs2_hud_metrics.json` 的測量數值，使用硬體加速的 HTML/CSS Overlay（固定於 `1920x1080` 等比縮放容器 `aspect-ratio: 16/9`）加上左上角獨立 Canvas 繪製即時旋轉雷達（載入 Step 2C 截取的 `radar_overview_raw.png` 作為雷達底圖，即時標示玩家位置與視野扇形）。
   - 所有色碼、字體像素高度、圓角與邊距必須 $100\%$ 複製測量數據。
   - **效能要求**：採用事件驅動（Event-driven）更新，只有當開火消耗子彈、受到傷害、切換武器或秒數跳動時才修改對應的 DOM 節點，確保 0 CPU 額外負擔。

3. **第三階段：實機截圖與概念圖像素級比對**：
   - 透過 `window.__GAME_MCP__.setHudState()` 將遊戲狀態設為與 `2_hud_concept.png` 完全一致的數值（`100 HP`, `100 Armor`, `30 / 90 Ammo`, `1:55 Timer`, `$4750`）。
   - 使用 Browser MCP 擷取 $1920 \times 1080$ 畫面，並與 `2_hud_concept.png` 進行疊圖比對，確認每個區塊的大小、位置與顏色分毫不差。
附錄：取代 Roblox Studio MCP 的「Babylon.js + Browser MCP」自動化橋接腳本在原本的影片流程中，作者使用 Roblox Studio MCP 自動執行腳本並從特定角度截圖回傳給 Claude Opus。在我們的 Babylon.js + WebGPU 網頁架構中，請在主程式 src/main.ts 加上以下全域橋接器，即可讓 Playwright MCP / Chrome DevTools MCP 達到完全相同（甚至更快速精準）的自動化能力：// src/mcpBridge.ts - 供 Claude Opus 透過 Browser MCP 自動呼叫的除錯與截圖介面
import * as BABYLON from "@babylonjs/core";

export function registerMcpBridge(
  engine: BABYLON.WebGPUEngine,
  scene: BABYLON.Scene,
  cameras: {
    fpsCam: BABYLON.UniversalCamera;
    keyArtRefCam: BABYLON.UniversalCamera;
    siteBCam: BABYLON.UniversalCamera;
    topDownRadarCam: BABYLON.UniversalCamera;
  },
  hudController: any,
  weaponController: any
) {
  (window as any).__GAME_MCP__ = {
    // 1. 瞬間切換至 Key Art 基準相機（供 Step 2A 與 Step 3 比對色彩與構圖）
    switchToKeyArtCam: (hideHud = true) => {
      scene.activeCamera = cameras.keyArtRefCam;
      hudController.setVisible(!hideHud);
      weaponController.setViewModelVisible(!hideHud);
      scene.render();
      return "Switched to KeyArtRefCam";
    },

    // 2. 切換回第一人稱持槍視角（供 Step 5 檢視 Blender 槍枝導角與 Step 6 檢視 HUD）
    switchToFpsCam: (weaponId: "ak47" | "m4a4" | "awp" | "usps" = "ak47") => {
      scene.activeCamera = cameras.fpsCam;
      hudController.setVisible(true);
      weaponController.setViewModelVisible(true);
      weaponController.equipWeapon(weaponId);
      scene.render();
      return `Switched to FPS Cam with ${weaponId}`;
    },

    // 3. 瞬間移動第一人稱相機至地圖任意座標與角度（供巡檢 A 點、B 點、中路）
    teleportFpsCam: (pos: [number, number, number], rotYDeg: number, rotXDeg = 0) => {
      scene.activeCamera = cameras.fpsCam;
      cameras.fpsCam.position.set(pos[0], pos[1], pos[2]);
      cameras.fpsCam.rotation.set(
        BABYLON.Tools.ToRadians(rotXDeg),
        BABYLON.Tools.ToRadians(rotYDeg),
        0
      );
      scene.render();
    },

    // 4. 設定 HUD 測試數值（供 Step 6 與 HUD 概念圖進行 1:1 疊圖驗證）
    setHudState: (state: {
      hp: number;
      armor: number;
      hasHelmet: boolean;
      money: number;
      ammoClip: number;
      ammoReserve: number;
      timerText: string;
      ctScore: number;
      tScore: number;
    }) => {
      hudController.updateState(state);
    },

    // 5. 輸出 WebGPU 當前效能與 Draw Call 統計（確保 ThinInstance 與 Snapshot 生效）
    getPerformanceStats: () => {
      return {
        fps: Math.round(engine.getFps()),
        activeMeshes: scene.getActiveMeshes().length,
        totalVertices: scene.getTotalVertices(),
        snapshotRenderingEnabled: engine.snapshotRendering,
      };
    }
  };
}
