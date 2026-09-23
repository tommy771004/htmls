# 100 個設計方向（開工前規劃）

原則：每一列在「風格 / 版面 / 配色 / 字體 / 動效語彙 / 題材」六個維度上都要和其他 99 列有明顯區隔。
字體只能用系統字（不得載入外部字型）；圖像一律用 CSS / SVG / Canvas 自己畫；聲音一律 WebAudio 合成。

| # | 檔名關鍵字 | 風格 | 題材 / 互動 | 版面骨架 | 配色 | 字體 | 動效語彙 | 語言 |
|---|---|---|---|---|---|---|---|---|
| 001 | swiss | 瑞士國際主義 | 虛構設計研討會「RASTER 26」海報式首頁，可開關網格疊層 | 非對稱 12 欄網格、巨大數字、左齊 | 白 / 黑 / 群青 #0033FF | Arial / Helvetica Bold，緊字距 | 機械式直線描繪、網格開關 | EN |
| 002 | beton-brut | 建築粗獷主義 | 「混凝土建築檔案館」可篩選建物清單 | 巨大水泥量體堆疊 | 混凝土灰 + 一點鏽橘 | Arial Black 巨字 + Courier 標註 | 無緩動硬切、板塊滑動 | EN |
| 003 | vaporwave | 蒸汽波 | 「ＶＡＰＯＲ ＭＡＬＬ」3D 透視網格地板，滑桿改變天色 | 全螢幕中央舞台 | 洋紅 / 青 / 紫 | 全形字 + Times 斜體 | 無限網格、VHS 抖動 | EN/JP |
| 004 | editorial-essay | 極簡編輯長文 | 散文〈慢的練習〉，首字放大、側註、閱讀進度 | 單欄 + 右側 sidenote | 米白紙 / 墨黑 / 朱紅點綴 | Georgia / Palatino、小型大寫 | 進度條、註腳高亮 | ZH |
| 005 | crt-terminal | 終端機 | 可互動假 shell（help / ls / cat / fortune …） | 全螢幕 CRT 曲面暗角 | 綠磷光 on 黑 | Consolas / Lucida Console | 掃描線、閃爍、打字游標 | EN |
| 006 | zine-collage | 雜誌拼貼 | Zine《噪音夏日》第 7 期，可拖曳剪貼碎片 | 散亂拼貼、旋轉紙片 | 牛皮紙 / 螢光黃 / 黑 / 紅 | 勒索信混排 Impact / Times / Courier | 拖曳、紙張晃動 | ZH/EN |
| 007 | glassmorphism | 玻璃擬態 | 智慧家居控制面板 | 卡片格浮在模糊漸層球上 | 夜藍紫漸層 + 半透明白 | Segoe UI Light | 漸層球漂移、彈性開關 | ZH |
| 008 | notebook-doodle | 手繪筆記 | 手沖咖啡學習筆記塗鴉圖解 | 橫線筆記本頁 + 紅邊線 | 紙白 / 藍原子筆 / 螢光黃 | Ink Free / Segoe Print | JS 抖動線逐筆描繪 | ZH |
| 009 | bauhaus | 包浩斯 | 幾何構成產生器，點擊重組 | 正方形舞台 + 側欄 | 紅 / 黃 / 藍 / 黑 / 米白 | Century Gothic | 形狀旋轉彈跳重組 | EN |
| 010 | neumorphism | 新擬物 Soft UI | 密碼產生器工具 | 置中單卡 | 單色淺灰 #e0e5ec | Segoe UI Semibold | 按壓凹陷、柔和陰影 | ZH |
| 011 | pico8-arcade | 8-bit 街機 | 「星際閃避」小遊戲 + chiptune 音效 | 置中像素畫布 + 觸控鍵 | PICO-8 16 色 | Canvas 手刻像素字 | 格狀移動、畫面震動 | EN |
| 012 | art-deco | 裝飾藝術 | 1920 年代晚宴邀請函 + RSVP | 嚴格對稱、扇形階梯框 | 黑 / 金 / 象牙 | Georgia 全大寫寬字距 | 金屬光澤掃過、扇形展開 | EN |
| 013 | memphis | 孟菲斯 | 派對歌單產生器 | 不規則浮動卡片 | 粉彩撞色 + 黑色圖紋 | Trebuchet / Arial Black | 彈跳、搖擺、紙屑 | EN |
| 014 | scrollytelling | 資料新聞捲動敘事 | 「一座城市如何變熱」捲動驅動折線圖 | 左文右 sticky 圖 | 米色報紙 + 冷藍→熱紅 | Cambria 標題 + Calibri 標籤 | 捲動觸發圖表轉場 | ZH |
| 015 | cyberpunk-hud | 賽博龐克 HUD | 駭入協議矩陣解碼小遊戲 | 斜切角面板、HUD 框線 | 螢光黃 / 青 / 黑 | Bahnschrift Condensed + Consolas | 故障字、掃描 | EN |
| 016 | muji-minimal | 日系無印極簡 | 生活道具目錄（物件用 CSS 畫），可加入清單 | 大量留白規則格 | 原色 / 麻 / 淺灰 / 墨 | Yu Gothic Light | 極慢淡入 | ZH/JP |
| 017 | risograph | 孔版印刷 | 獨立書展海報，滑鼠造成錯版 | 大字海報、雙色疊印 | 螢光粉 + 藍 multiply | Arial Black / Impact | 版錯位、顆粒雜訊 | EN |
| 018 | skeuo-radio | 擬物 | 可調頻復古收音機（WebAudio 合成電台） | 單一實物置中 | 胡桃木 / 黃銅 / 奶油 | Georgia + Arial Narrow 刻度 | 旋鈕拖曳、真空管發光 | EN |
| 019 | broadsheet | 維多利亞大報 | 《The Daily Algorithm》頭條隨機產生 | 6 欄窄欄 + 細線 | 泛黃紙 + 墨 | Times / Georgia 壓縮粗體 | 油墨暈染、換版 | EN |
| 020 | flowfield | 生成藝術 | Perlin 流場繪圖 + 參數 | 全畫布 + 角落迷你控制 | 奶油紙 + 墨線 | Palatino Italic 小字 | 粒子慢描 | EN |
| 021 | y2k-chrome | Y2K 液態金屬 | Winamp 風播放器（合成 loop + 頻譜） | 異形 skin 視窗 | 銀鉻 / 冰藍 / 螢光綠 | Tahoma + Trebuchet Italic | 虹彩、鉻反光 | EN |
| 022 | kinetic-type | 動態字體 | 字母隨游標改變字重與寬度 | 全螢幕巨字 | 酸性綠 on 黑 | Bahnschrift 可變字重 | 字重波浪 | EN |
| 023 | isometric | 等角視圖 | 等角小鎮建造器 | 菱形地塊 + 工具列 | 粉彩薄荷 / 桃 | Segoe UI Semibold | 建物升起彈跳 | ZH |
| 024 | dev-saas-dark | 暗色開發者產品頁 | CLI 工具「Driftwood」落地頁 + 互動 code demo | 中軸 hero + bento | 近黑 + 紫藍細光邊 | Segoe UI + Consolas | 游標光暈、漸層邊框 | EN |
| 025 | nordic-shop | 北歐家具店 | CSS 畫的椅子單品頁，換材質、加入購物車 | 左大圖右資訊 | 橡木 / 鼠尾草綠 / 燕麥白 | Corbel / Candara | 平滑材質切換 | ZH |
| 026 | blueprint | 工程藍圖 | 機械錶芯藍圖，懸停零件看規格 | 圖紙 + 標題欄 | 藍圖藍 + 白線 | Courier New + Arial Narrow | 齒輪轉動、尺寸線描繪 | EN |
| 027 | herbarium | 標本館 | 程序化植物標本產生器 | 標本卡 + 標籤 | 泛黃紙 / 乾燥綠 / 棕 | Palatino Italic 學名 | 葉片生長 | EN |
| 028 | system7 | 經典 Mac OS | 桌面式作品集，可拖曳視窗 | 桌面隱喻 | 1-bit 黑白 + 抖動灰 | Tahoma / 像素感 | 視窗縮放框 | EN |
| 029 | psychedelic | 60 年代迷幻 | 演唱會海報，SVG 位移濾鏡流動字 | 中央扭曲大字 | 橙 / 紫 / 綠高震動 | Arial Black + feDisplacement | 液態光流動 | EN |
| 030 | type-specimen | 字體樣本 | Bahnschrift / Georgia 樣本：字符格、瀑布、試打 | 樣本書頁 | 奶油 + 深森林綠 | 被展示字體本身 | 字重滑桿 | EN |
| 031 | constructivism | 構成主義 | 「人民圖書館」宣傳首頁 | 對角斜線構圖 | 紅 / 黑 / 米 | Arial Black 斜排 | 斜向滑入 | ZH |
| 032 | dark-academia | 暗黑學院 | 珍奇櫃目錄，抽屜開啟 | 抽屜櫃格 | 墨綠 / 胡桃棕 / 燭光金 | Palatino / Constantia | 燭光閃爍、抽屜滑出 | EN |
| 033 | solarpunk | 太陽龐克 | 社區菜園規劃器（放作物、算日照用水） | 地塊格 + 側欄 | 葉綠 / 蜂蜜黃 / 天空 | Candara | 有機曲線、葉片搖曳 | ZH |
| 034 | tamagotchi | 電子雞 | 蛋型掌機寵物（餵食 / 玩 / 睡） | 蛋型機殼置中 | 粉彩塑膠 + LCD 灰綠 | Canvas 像素 | LCD 殘影 | ZH |
| 035 | isotype | Isotype 圖像統計 | 「一座城市的一天」圖像符號統計 | 報表式列 | 暖灰 + 5 色平塗 | Calibri / Trebuchet | 符號逐一排入 | ZH |
| 036 | film-noir | 黑色電影 | 文字冒險偵探謎案 | 寬螢幕電影框 | 黑白 + 單一血紅 | Courier New | 百葉窗光影、底片顆粒 | EN |
| 037 | pop-comic | 普普漫畫 | 選擇式互動漫畫 | 分格漫畫 | 原色 + Ben-Day 網點 | Comic Sans Bold + Impact | 分格彈出 | EN |
| 038 | raygun-grunge | 90s 解構 grunge | 虛構樂團專訪，文字重疊扭曲 | 解構失序排版 | 髒黃 / 黑 / 鏽 | Times + Courier + Arial Narrow 混排 | 滑鼠推擠文字 | EN |
| 039 | neo-brutal | 新粗獷 | 看板 Kanban 工具，可拖曳卡片 | 三欄看板 | 黃 / 粉 / 藍平塗 + 黑框硬陰影 | Arial Black / Verdana | 按下位移陰影 | ZH |
| 040 | aurora-breathe | 極光冥想 | 4-7-8 呼吸引導 | 置中呼吸形體 | 深夜藍 + 極光綠紫 | Segoe UI Light | 極光緩流 | ZH |
| 041 | typewriter-ascii | 打字機 ASCII 藝術 | 會「打」出來的 ASCII 圖畫集 | 打字紙 + 滑架 | 奶油紙 / 黑墨 / 紅色色帶 | Courier New | 滑架移動、墨色不均 | EN |
| 042 | taiwan-maximal | 台味極繁 | 夜市攤位點餐（茄芷袋紋 + 手寫招牌） | 擁擠攤位格 | 紅白藍茄芷袋 + 招牌黃 | 微軟正黑 Bold + 標楷體 | 招牌搖晃、點餐飛入 | ZH |
| 043 | ink-wash | 水墨 | 程序化山水 + 直排詩 | 橫幅捲軸 | 宣紙 / 墨 / 印章紅 | 標楷體直排 | 墨暈擴散 | ZH |
| 044 | lcars | LCARS 星艦介面 | 星艦系統狀態主控台 | 肘形彩條框 | 橙 / 薰衣草 / 桃 on 黑 | Arial Narrow 全大寫 | 數據跳動、嗶聲 | EN |
| 045 | paper-layers | 紙雕層次 | 四季切換的紙雕風景視差 | 疊層剪影 | 季節配色 | Georgia | 視差、紙片陰影 | ZH |
| 046 | claymorphism | 黏土風 | 兒童數學遊戲 | 膨脹大圓角按鈕 | 天藍 / 橘 / 檸檬 | Segoe UI Black | 果凍彈跳 | ZH |
| 047 | e-paper | 電子紙 | 家用電子紙看板（行程 / 待辦 / 金句） | 電子紙面板機身 | 16 階灰 | Sitka / Georgia | 全刷閃黑白 | ZH |
| 048 | word-clock | 文字時鐘 | 中文字格報時 | 方形字格 | 黑 + 暖白光 | 微軟正黑 Light | 字格淡入淡出 | ZH |
| 049 | radial-year | 放射狀年曆 | 365 天放射熱度圖 | 圓形資料視覺化 | 白底 + 單色色階 | Segoe UI + Consolas 數字 | 懸停放射高亮 | ZH |
| 050 | atomic-age | 50 年代原子時代 | 太空旅行社訂票 | 迴力鏢、星芒 | 薄荷 / 芥末 / 橘 / 奶油 | Trebuchet Bold Italic + Segoe Script | 星芒旋轉 | EN |
| 051 | sport-bold | 運動品牌 | 跑步配速計算器 | 斜切大字 | 白 / 黑 / 電光橘 | Impact / Arial Black Italic | 速度線 | ZH/EN |
| 052 | tarot | 神秘塔羅 | 三張牌抽牌翻牌 | 牌陣 | 深紫 / 金 / 星空 | Palatino Small Caps + Gabriola | 3D 翻牌、星塵 | EN |
| 053 | temple | 台灣廟宇 | 擲筊求籤 | 廟門門楣框 | 朱紅 / 金 / 墨綠 | 標楷體 | 筊杯拋物落下 | ZH |
| 054 | geocities | 1996 個人首頁 | 訪客留言板 + 計數器 | 置中 table 版面 | 星空磚紋 + 彩虹字 | Comic Sans / Times | 跑馬燈、閃爍 | EN |
| 055 | holo-card | 全息卡 | 收藏卡牌 3D 傾斜與閃膜 | 卡片畫廊 | 暗底 + 虹彩箔 | Segoe UI Black | 視角傾斜、光澤 | EN |
| 056 | topographic | 等高線 | 登山路線海拔剖面工具 | 地圖 + 剖面 | 森林綠 / 橘 / 米 | Bahnschrift | 等高線生成 | ZH |
| 057 | bluenote | 爵士唱片封面 | 爵士封面產生器 | 方形封面網格 | 雙色調 + 黑 | Franklin Gothic + Arial Narrow | 色塊滑動 | EN |
| 058 | te-synth | Teenage Engineering 風 | 16 步鼓機 | 硬體面板 | 米白 + 橘 / 藍 / 灰 | Consolas 小字 | 步進燈 | EN |
| 059 | oscilloscope | 示波器 | 李沙育圖形產生器（含聲音） | 圓形示波器螢幕 + 旋鈕 | 青藍磷光 | Arial Narrow 刻度 | 餘暉軌跡 | EN |
| 060 | wes-anderson | 對稱粉彩 | 大飯店門房訂房 | 嚴格中軸對稱 | 粉紅 / 酒紅 / 薄荷 | Century Gothic | 電梯門開合 | EN |
| 061 | letterpress | 活版印刷 | 名片製作器（凹印效果） | 棉紙 + 卡片 | 棉白 + 深藍墨 | Constantia / Georgia | 壓印凹陷 | ZH/EN |
| 062 | metro-wayfinding | 捷運導視 | 虛構地鐵路網圖 + 路線規劃 | SVG 路網 | 白 + 路線色 | Bahnschrift + 微軟正黑 | 路線描繪 | ZH |
| 063 | split-flap | 翻牌看板 | 機場出境看板 | 看板列 | 黑 / 黃 / 白 | Consolas Bold | 翻牌動畫 + 喀喀聲 | EN |
| 064 | thermal-receipt | 熱感收據 | 「你的一天」收據產生器 | 窄收據置中 | 熱感紙白 + 灰黑 | Lucida Console | 列印吐紙 | ZH |
| 065 | treasure-map | 藏寶圖 | 可點地點的古地圖 | 羊皮紙地圖 | 羊皮 / 棕墨 / 紅 X | Papyrus + Palatino | 虛線路徑描繪 | EN |
| 066 | lava-lamp | 熔岩燈 | metaball 熔岩燈 + 調色 | 產品舞台 | 70s 橘紫 | Trebuchet | 流體團塊 | EN |
| 067 | glitch | 故障藝術 | 生成圖像的像素排序 / RGB 位移 | 畫布 + 控制 | RGB 分離 | Consolas | 資料崩壞 | EN |
| 068 | braun | Dieter Rams / Braun | ET66 計算機 + 設計十原則 | 工業產品頁 | 暖灰 / 黑 / 橘黃 | Arial / Segoe UI | 精確按鍵 | ZH/EN |
| 069 | nbody | 重力沙盒 | 點擊加入天體 | 全畫布 + 科學 HUD | 深空 + 熱色譜軌跡 | Consolas | 軌跡殘留 | EN |
| 070 | petri-dish | 培養皿生命遊戲 | Game of Life 顯微鏡 | 圓形培養皿 | H&E 染色粉紫 | Cambria | 細胞生滅 | EN |
| 071 | chalkboard | 黑板 | 畢氏定理互動證明 | 黑板 + 木框 | 墨綠黑板 + 粉筆 | Segoe Print | 粉筆描繪 | ZH |
| 072 | stained-glass | 彩繪玻璃 | Voronoi 彩繪玻璃產生器 | 尖拱窗 | 寶石色 + 鉛線 | Palatino | 光線穿透移動 | EN |
| 073 | low-poly | 低多邊形 | 低多邊形地形產生器 | 全畫布 | 日落暖色 | Segoe UI Semilight | 地形起伏 | EN |
| 074 | neon-sign | 霓虹招牌 | 霓虹招牌產生器（中英） | 磚牆 | 霓虹多色 | Segoe Script / 微軟正黑 | 啟動閃爍 | ZH/EN |
| 075 | kawaii | 可愛貼紙 | 心情貼紙手帳 | 手帳格 | 粉 / 薄荷 / 薰衣草 | MV Boli / Comic Sans | 貼紙彈跳 | ZH |
| 076 | bloomberg | 金融終端 | 虛構市場即時看盤 | 多窗格密集 | 黑 + 琥珀 | Consolas | 即時跳動 | EN |
| 077 | sheet-music | 樂譜 | 點擊五線譜作曲並播放 | 樂譜頁 | 象牙 + 黑 | Palatino / Times | 播放光標 | EN |
| 078 | girih | 伊斯蘭幾何 | 星形紋樣產生器 | 對稱紋樣 + 側欄 | 靛藍 / 赭 / 金 | Constantia | 紋樣繪出 | EN |
| 079 | weather-poster | 天氣海報 | 虛構城市一週天氣 + 動態天候 | 巨大溫度字 | 依天氣變色 | Segoe UI Light / Black | 雨雪畫布 | ZH |
| 080 | fashion | 時尚大刊 | 秋冬時裝 lookbook（CSS 色塊造型） | 極大襯線 | 黑白 + 單一駝色 | Didot → Bodoni → Georgia | 慢速橫移 | EN |
| 081 | saul-bass | 片頭設計 | 動態片頭序列 | 電影畫面 | 芥末黃 / 黑 / 米白 | Impact 手切感 | 剪紙切換 | EN |
| 082 | periodic | 元素週期表 | 互動週期表 | 18 欄表 | 分類色 | Segoe UI | 懸停放大 | ZH |
| 083 | op-art | 歐普藝術 | 錯視圖案參數 | 全畫面 | 黑白 | Arial | 摩爾紋 | EN |
| 084 | nasa-worm | 70s NASA 標準手冊 | 任務控制時間軸 + 倒數 | 手冊式 | NASA 紅 / 白 / 黑 | Arial / Helvetica | 倒數 | EN |
| 085 | circus | 維多利亞馬戲 | 售票亭 | 木活字海報 | 紅 / 奶油 / 黑 | Impact + Georgia | 燈泡跑馬 | EN |
| 086 | deep-sea | 深海 | 捲動下潛看生物 | 垂直深度長捲 | 藍→黑 + 生物光 | Segoe UI Light | 生物發光 | ZH |
| 087 | star-chart | 印刷星圖 | 可旋轉的星座盤（依時間） | 圓盤 + 地圖註記 | 白紙 / 黑星 / 一點紅 | Georgia Italic + Arial Narrow | 星空旋轉 | EN |
| 088 | graffiti | 街頭塗鴉 | 噴漆牆面畫布 | 磚牆全畫面 | 噴漆色 | Impact / Arial Black | 噴霧與滴流 | EN |
| 089 | tiki | 提基酒吧 | 調酒製作器 | 竹框菜單 | 熱帶橘 / 綠 / 木 | Juice ITC / Papyrus | 搖杯 | EN |
| 090 | ukiyoe | 浮世繪 | 七十二候日曆 | 木刻版 | 靛藍 / 米 / 朱 | 明體（PMingLiU / serif） | 青海波流動 | ZH |
| 091 | dither-3d | 1-bit 抖動渲染 | 光線步進物體 Bayer 抖動 | 全畫布 | 深褐 + 米雙色 | Lucida Console | 旋轉 | EN |
| 092 | advent | 降臨曆 | 24 扇門開啟 | 門格 | 深紅 / 綠 / 金 | Georgia + Segoe Script | 開門、落雪 | EN |
| 093 | perfume | 奢華香水 | 香調金字塔 | 天鵝絨 | 酒紅 / 香檳 | Constantia Light | 慢速顯影 | EN |
| 094 | fourier | 傅立葉周轉圓 | 手繪 → 周轉圓重現 | 全畫布 | 深藍 + 黃 / 青 | Cambria | 周轉圓 | EN |
| 095 | nonogram | 方格紙鉛筆 | 數織 Nonogram 解謎 | 方格紙 | 方格淡藍 + 鉛筆灰 | Consolas + Ink Free | 鉛筆塗黑 | ZH |
| 096 | mediterranean | 地中海 | 希臘小島行程 + 日照 | 灰泥拱門 | 灰泥白 / 愛琴藍 / 赤陶 | Sitka / Georgia | 陽光移動 | EN |
| 097 | lofi-room | Lo-fi 房間 | 雨夜書桌 + 環境音產生器 | 側視插畫 | 黃昏紫 / 暖燈 | Segoe UI + MV Boli | 雨滴、燈光 | EN |
| 098 | xeno-glyph | 外星語 | 文字轉外星字形翻譯器 | 解碼器 | 深青 + 骨白 | Consolas | 字形生成 | EN |
| 099 | rubik | CSS 3D | 可旋轉魔術方塊 | 工作室舞台 | 白 / 純色 | Segoe UI | 3D 旋轉 | EN |
| 100 | fireworks | 煙火終章 | 點擊發射煙火 + 「100」 | 夜空全畫面 | 夜空 + 金 | Georgia | 粒子 | ZH |

## 分散度自檢（開工前做過的調整）
- 001 瑞士 vs 031 構成主義 原本都是紅黑 → 001 改群青。
- 019 大報 vs 095 原本都是報紙填字 → 095 改方格紙鉛筆 Nonogram。
- 010 番茄鐘 vs 040 呼吸 都是置中圓環計時 → 010 改密碼產生器。
- 004 長文 vs 047 閱讀器 功能重疊 → 047 改家用電子紙看板。
- 042 夜市 vs 074 霓虹 都是霓虹 → 042 改茄芷袋 + 手寫招牌，不用霓虹。
- 052 塔羅 vs 087 星座盤 都是深紫金星空 → 087 改白紙黑星印刷星圖。
- 081 片頭 vs 031 構成主義 vs 051 運動 都是紅/橘黑 → 081 芥末黃、051 電光橘白底。
- 041 ASCII 原本也是黑底等寬，和 005 / 076 / 063 撞 → 041 改奶油紙打字機。
