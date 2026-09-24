# 名古屋城地景切片 — 可重跑流程

已驗證：Python 3.11、Blender 5.2.2、macOS；以愛知県体育館為中心，半徑 1000 m。支援 Blender 4.5+ 的匯出介面，其他版本未實測。

## 執行

解壓縮 reproduce.zip 後，在此資料夾執行（需要 curl、Blender 與網路）：

    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    python run.py --place '愛知県体育館' --radius 1000

Windows 用 .venv\Scripts\activate；Blender 未在 PATH 時，加入 --blender "/path/to/blender"。自動尋找 macOS、Linux、Windows 的 CJK 字型，找不到時加入 --font "/path/to/font.ttc"。

下一次修改 --place 與 --radius 即可重新處理。腳本會嘗試 GSI 地名搜尋、GSI 行政區反查、PLATEAU 目錄與 CKAN CityGML 探索，並挑選涵蓋中心的日本平面直角座標系。範圍只支援日本、半徑 100–5000 m；地名有歧義、沒有 PLATEAU 或 GSI DEM 覆蓋時明確失敗，不生成假資料。跨城市圓盤目前不合併鄰市資料，應自行檢查覆蓋完整性。

可指定中心與資料：
    
    python run.py --place '自訂地點' --lat 35.1830861 --lon 136.9025611 --radius 750 --dataset plateau-23100-nagoya-shi-2022 --epsg 6675 --out ./another-place

run.py 使用獨立 Blender 背景程序，不會清除目前開啟的 Blender 工作。輸出檔名沿用 nagoya.blend / nagoya.glb；換地點時建議指定新的 --out，避免覆寫。--skip-prepare 可從已存在的 scene.json 重建 Blender 與渲染。

## 資料與座標

- 中心：名古屋城旁原愛知県体育館，35.1830861 N / 136.9025611 E。依空照與 PLATEAU 體育館輪廓視覺確認。
- 高程：[國土地理院 DEM](https://maps.gsi.go.jp/development/ichiran.html#dem)，DEM5A 原始 5 m 網格，z15 高程 PNG，EPSG:3857 XYZ；缺值以 DEM10B 原始 10 m、z14 補齊。24-bit 有號公分解碼，0x800000 為缺值；若替補資料仍缺值則停止。本次下載拼圖中 10,640 個 DEM5A 像素由 DEM10B 補齊（包含圓盤以外的拼圖範圍）。
- 空照：[seamlessphoto](https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto)，EPSG:3857 z17，中心地面像元約 0.97614 m。以反向投影雙線性重取樣成 2048 × 2048 貼圖；輸出像素約 0.97656 m。不是把墨卡托公尺直接當地面公尺。拍攝日期不單一，不宣稱與 2022 建物同年。
- 建物、道路：[PLATEAU 名古屋市 2022](https://www.geospatial.jp/ckan/dataset/plateau-23100-nagoya-shi-2022)，CityGML v4。HTTP Range 僅讀取需要的 ZIP 條目，不下载整個 2.8 GB ZIP。EPSG:6697 的位置軸序是緯度、經度、標高；水平 JGD2011（EPSG:6668）投影為 EPSG:6675。保留 LOD1 實體的多層高度，不隨機拉高 footprint；保留道路與庭院孔洞。LOD1 無精細屋頂／立面，LOD2、紋理與其他 CRS 格式未實作。
- 原點 EPSG:6675 的 E / N / 標高 = (-24053.511611128342, -90596.77796200642, 13.56) m。PROJ 一律 always_xy=True，避免地理 CRS 與日本平面系法定軸序混淆。資料解析先把 CityGML 緯度／經度調整成 lon / lat。
- Blender X 向東、Y 向北、Z 向上，公尺制。glTF 依標準轉為 Y 向上，單位仍為公尺。
- 高度倍率 = 1。所有圖層扣除同一個 13.56 m 地面原點，不混用橢球高。GSI 標高與 PLATEAU 標高沿用各自公開值，沒有進行不同測量年代的高程改正；不可當工程測量成果。
- 地形採 10 m 網格與 512 點圆周，用 Delaunay 三角化；模型圓周誤差為公分級。底座底面位於最低地形以下 70 m，是展示厚度，不是地質剖面。
- 建物表面裁切到近似圓柱，交界插值維持高度；Blender 合併重合點、補邊界切面。道路獨立抬高 0.25 m 避免顯示閃爍（僅顯示偏移）。

## 分層與輸出

- Terrain：帶 UV 的地形與獨立側壁／底面。
- Buildings：4,756 個來源建物的合併網格，與地形分離。
- Roads：1,127 個來源道路的合併面層，預設隱藏。
- Textures：說明物件；實際 aerial.jpg 打包在「GSI aerial」材質的 Image Texture 節點。更換貼圖需保持相同投影及範圍。
- Studio / Annotations：相機燈光／預留註記集合。成品圖的中文地名、中心座標、半徑、倍率與來源由 run.py 於 Blender 渲染後自動排版；Blender 單獨 F12 不會附上這些版面文字。
- nagoya.blend：公尺尺度分層場景，影像已內嵌。
- nagoya.glb：可攜模型。
- render.jpg：含來源註記的最終渲染。
- aerial.jpg / alignment.jpg：同範圍的空照及建物輪廓疊圖。
- sources.json：每個原始 URL、SHA-256、CRS、標高範圍與計數。
- scene.json：Blender 與驗證使用的中介幾何。cache/ 為下載快取，不納入版本控制。

## 檢核與限制

程式檢查 CRS、缺值、零建物、有限座標與有效參數。名古屋案例已檢查體育館中心、天守及本丸周邊屋頂輪廓與空照；護城河環繞城郭的方位及位置在渲染上吻合，未見整體偏移或旋轉。alignment.jpg 為不加人工平移／旋轉的檢核圖。這是視覺比對，不是控制點 RMSE 或測量認證。照片視差、樹冠和不同年代可造成局部差異。换地點後應重新檢查疊圖，不把本次檢核套用到其他地點。

未使用 OpenStreetMap：道路已由同一份 PLATEAU 資料提供。DEM5A 若整張磚不存在，下載會停止；目前只替補已下載磚內的 NoData，不能聲稱支援所有日本地點。部分 CityGML 版本、xlink 幾何或非 EPSG:6697 資料需另加轉換器。一般地名搜尋不一定包含景點，這時可明確提供 --lat / --lon。

## 授權

出典：国土地理院 DEM・空中写真（地理院タイル），依[國土地理院內容利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)使用。
出典：国土交通省 Project PLATEAU 名古屋市 2022，依[PLATEAU Site Policy](https://www.mlit.go.jp/plateau/site-policy/)（與 CC BY 4.0 相容）使用。
模型、影像及疊圖為上述資料加工成果。其他城市重跑時亦須核對其原始資料的來源、第三方權利與授權；腳本不替所有資料作授權判定。

