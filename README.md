# 100 HTML — 作品清單

**線上瀏覽：[htmls-ruddy.vercel.app](https://htmls-ruddy.vercel.app/)**（可搜尋、依分類篩選、直接預覽每件作品）

原始 100 個獨立單檔 HTML 加上後續的第 103–121 件互動作品，以及另外 100 個獨立手機 App 原型；101、102 為教學簡報。第 103 件的朗誦模式需讀者提供音檔與逐句時間戳。第 104、112、113、114、115、116、117、118、120 件為單檔 HTML，Three.js 從 CDN 載入。第 106、108、109、111 件使用本地 Three.js 模組，需透過網站伺服器開啟。
規劃與撞型自檢見 `DIRECTIONS.md`。

**驗收方式**：headless Chrome 自動檢查每件作品在 1440×900 與 390×844 兩種尺寸下的狀況，並模擬滑鼠移動、點擊、按鍵、滾輪。檢查項目包括 uncaught exception、console.error、外部網路請求、viewport meta、手機水平溢出。**最終結果 100/100 PASS。** 另外也逐件人工看過桌機與手機截圖。

標記說明：⚠ = 我認為做得比較弱的作品；△ = 整體 OK，但有具體的小缺點。未標記的是我認為水準穩定的作品。

| # | 檔案 | 風格方向 | 一句話說明 | 評 |
|---|---|---|---|---|
| 001 | [001-swiss.html](https://htmls-ruddy.vercel.app/001-swiss.html) | 瑞士國際主義 | RASTER 26 研討會海報首頁：非對稱 12 欄、群青巨字，G 鍵開關網格疊層 | |
| 002 | [002-beton-brut.html](https://htmls-ruddy.vercel.app/002-beton-brut.html) | 建築粗獷主義 | 混凝土建築檔案館：14 棟真實建築，可篩選排序，硬切動效 | △ 混凝土噪點偏雲霧感，篩選後結果少時留有空洞 |
| 003 | [003-vaporwave.html](https://htmls-ruddy.vercel.app/003-vaporwave.html) | 蒸汽波 | ＶＡＰＯＲ ＭＡＬＬ：無限透視網格、Win95 視窗切換天色、VHS 抖動、賣場音樂 | |
| 004 | [004-editorial-essay.html](https://htmls-ruddy.vercel.app/004-editorial-essay.html) | 極簡編輯長文 | 原創散文〈慢的練習〉：首字放大、側註、閱讀進度、慢讀模式 | |
| 005 | [005-crt-terminal.html](https://htmls-ruddy.vercel.app/005-crt-terminal.html) | 終端機 | 1983 天文台 CRT：虛擬檔案系統、約 25 個指令、Tab 補完、三種磷光色 | |
| 006 | [006-zine-collage.html](https://htmls-ruddy.vercel.app/006-zine-collage.html) | 雜誌拼貼 | 《噪音夏日》Zine：勒索信標題、可拖曳紙片（依速度傾斜、放下會晃動） | △ 手機上紙片佔版面大，捲動時容易誤觸拖曳 |
| 007 | [007-glassmorphism.html](https://htmls-ruddy.vercel.app/007-glassmorphism.html) | 玻璃擬態 | 智慧家居面板：溫控圓盤、情境切換會改背景色球 | ⚠ 做工完整，但玻璃擬態儀表板本身就是常見範本，辨識度最低的幾件之一 |
| 008 | [008-notebook-doodle.html](https://htmls-ruddy.vercel.app/008-notebook-doodle.html) | 手繪筆記 | 手沖咖啡筆記：抖動線逐筆描繪、豆水比計算器、沖煮碼錶 | △ 系統沒有中文手寫字，中文只能用標楷體撐 |
| 009 | [009-bauhaus.html](https://htmls-ruddy.vercel.app/009-bauhaus.html) | 包浩斯 | 幾何構成產生器：點擊重組、可鎖定形狀、Kandinsky 形色規則 | |
| 010 | [010-neumorphism.html](https://htmls-ruddy.vercel.app/010-neumorphism.html) | 新擬物 | 密碼產生器：凹陷字元磚、neumorphic 滑桿、強度與破解時間 | △ 桌機四周留白偏多 |
| 011 | [011-pico8-arcade.html](https://htmls-ruddy.vercel.app/011-pico8-arcade.html) | 8-bit 街機 | STAR DODGE：PICO-8 十六色、手刻像素字、chiptune，手機有 D-pad | |
| 012 | [012-art-deco.html](https://htmls-ruddy.vercel.app/012-art-deco.html) | 裝飾藝術 | 1926 跨年晚宴邀請函：扇形展開、金屬光澤掃過、RSVP 產生座位與徽章 | |
| 013 | [013-memphis.html](https://htmls-ruddy.vercel.app/013-memphis.html) | 孟菲斯 | 派對歌單產生器：每張卡片造型都不同、能量曲線、紙屑 | |
| 014 | [014-scrollytelling.html](https://htmls-ruddy.vercel.app/014-scrollytelling.html) | 資料新聞捲動敘事 | 〈一座城市如何變熱〉：sticky 圖表，7 個狀態補間轉場 | △ 手機上圖表文字約 10px |
| 015 | [015-cyberpunk-hud.html](https://htmls-ruddy.vercel.app/015-cyberpunk-hud.html) | 賽博龐克 HUD | Breach Protocol 矩陣解碼遊戲：保證有解、40 秒倒數 | |
| 016 | [016-muji-minimal.html](https://htmls-ruddy.vercel.app/016-muji-minimal.html) | 日系無印極簡 | 余白舍道具目錄：12 件純 CSS 器物（時鐘走真實時間）、購物清單 | △ 少數字缺字退到正黑體，粗細不一 |
| 017 | [017-risograph.html](https://htmls-ruddy.vercel.app/017-risograph.html) | 孔版印刷 | PULP 26 書展海報：雙色 multiply 疊印，拖曳造成錯版 | |
| 018 | [018-skeuo-radio.html](https://htmls-ruddy.vercel.app/018-skeuo-radio.html) | 擬物 | 1946 胡桃木收音機：旋鈕調頻、6 個合成電台、真空管暖機、調諧魔眼 | |
| 019 | [019-broadsheet.html](https://htmls-ruddy.vercel.app/019-broadsheet.html) | 維多利亞大報 | 《The Daily Algorithm》：6 欄細線、Stop the Presses 換版 | △ 多按幾次會看出內文句型重複 |
| 020 | [020-flowfield.html](https://htmls-ruddy.vercel.app/020-flowfield.html) | 生成藝術 | Perlin 流場墨線畫：版畫框、參數面板、可拖曳加墨線 | |
| 021 | [021-y2k-chrome.html](https://htmls-ruddy.vercel.app/021-y2k-chrome.html) | Y2K 液態金屬 | ChromAmp 2000：7 首合成曲、頻譜、可拖曳畫 EQ 曲線 | |
| 022 | [022-kinetic-type.html](https://htmls-ruddy.vercel.app/022-kinetic-type.html) | 動態字體 | TYPE IS A MUSCLE：游標附近的字變粗變寬、字重波浪 | ⚠ Chrome 對 Bahnschrift 可變軸無效，只能在具名樣式間跳格，不連續；內容也偏單薄 |
| 023 | [023-isometric.html](https://htmls-ruddy.vercel.app/023-isometric.html) | 等角視圖 | 薄荷鎮建造器：7 種工具、道路自動接線、小車、日夜切換 | △ 手機上地圖偏小 |
| 024 | [024-dev-saas-dark.html](https://htmls-ruddy.vercel.app/024-dev-saas-dark.html) | 暗色開發者產品頁 | Driftwood CLI 落地頁：bento、游標光暈、互動終端機 | ⚠ 這個方向本身就是標準 SaaS 版型，做得再好也像模板 |
| 025 | [025-nordic-shop.html](https://htmls-ruddy.vercel.app/025-nordic-shop.html) | 北歐家具店 | stilla 單品頁：CSS 畫的椅子，換木材與布料、購物車 | △ 椅子是正面平視，立體感有限 |
| 026 | [026-blueprint.html](https://htmls-ruddy.vercel.app/026-blueprint.html) | 工程藍圖 | 機械錶芯藍圖：以真實擺頻運轉、零件規格、滴答聲 | |
| 027 | [027-herbarium.html](https://htmls-ruddy.vercel.app/027-herbarium.html) | 標本館 | 想像植物標本：依 seed 生長四類植物、拉丁學名、可用網址重現 | |
| 028 | [028-system7.html](https://htmls-ruddy.vercel.app/028-system7.html) | 經典 Mac OS | 1-bit 桌面作品集：縮放框動畫、拖曳時只移動外框、15 格拼圖 | |
| 029 | [029-psychedelic.html](https://htmls-ruddy.vercel.app/029-psychedelic.html) | 60 年代迷幻 | 迷幻演唱會海報：feDisplacementMap 液態字、攪動融化 | ⚠ 辨識度夠，但字填滿形狀只是近似，規模也是全集最小的幾件之一 |
| 030 | [030-type-specimen.html](https://htmls-ruddy.vercel.app/030-type-specimen.html) | 字體樣本 | Bahnschrift × Georgia 樣本書：實測參考線、字符格、瀑布、試打 | |
| 031 | [031-constructivism.html](https://htmls-ruddy.vercel.app/031-constructivism.html) | 構成主義 | 人民圖書館：-13° 紅帶、換口號、借書蓋章、發借書證 | |
| 032 | [032-dark-academia.html](https://htmls-ruddy.vercel.app/032-dark-academia.html) | 暗黑學院 | 珍奇櫃：12 抽屜、手繪 SVG 藏品、燭光、上鎖抽屜謎題 | |
| 033 | [033-solarpunk.html](https://htmls-ruddy.vercel.app/033-solarpunk.html) | 太陽龐克 | 屋頂菜園規劃：日照時數計算、陰影時間滑桿、鄰作加成 | |
| 034 | [034-tamagotchi.html](https://htmls-ruddy.vercel.app/034-tamagotchi.html) | 電子雞 | 咕咕蛋：32×16 LCD 殘影、A/B/C 鍵、孵化、生病、長大 | △ 點陣寵物偏小（忠於原規格） |
| 035 | [035-isotype.html](https://htmls-ruddy.vercel.app/035-isotype.html) | Isotype 圖像統計 | 河口市的一天：60 個人形依 24 小時重新上色 | |
| 036 | [036-film-noir.html](https://htmls-ruddy.vercel.app/036-film-noir.html) | 黑色電影 | 《The Last Drop》偵探冒險：線索筆記本、指控需出示證據、多結局 | |
| 037 | [037-pop-comic.html](https://htmls-ruddy.vercel.app/037-pop-comic.html) | 普普漫畫 | True Peril Comics：每次選擇彈出新一格，4 個結局 | |
| 038 | [038-raygun-grunge.html](https://htmls-ruddy.vercel.app/038-raygun-grunge.html) | 90s 解構 grunge | CHLORINE PONY 專訪：字母錯置疊印、游標推開文字、Remix 重排 | △ 手機首屏比桌機保守 |
| 039 | [039-neo-brutal.html](https://htmls-ruddy.vercel.app/039-neo-brutal.html) | 新粗獷 | 趕稿看板 Kanban：硬陰影、拖曳、WIP 上限警示、完成蓋章 | △ 視覺偏穩，不夠大膽 |
| 040 | [040-aurora-breathe.html](https://htmls-ruddy.vercel.app/040-aurora-breathe.html) | 極光冥想 | 4-7-8 呼吸：極光 Canvas、有機光球、音量隨呼吸起伏 | |
| 041 | [041-typewriter-ascii.html](https://htmls-ruddy.vercel.app/041-typewriter-ascii.html) | 打字機 ASCII | 六張會自己「打」出來的 ASCII 圖：滑架、墨色不均、打字聲 | |
| 042 | [042-taiwan-maximal.html](https://htmls-ruddy.vercel.app/042-taiwan-maximal.html) | 台味極繁 | 好運來夜市：茄芷袋格紋、搖晃手寫招牌、食物拋進袋子、叫號 | |
| 043 | [043-ink-wash.html](https://htmls-ruddy.vercel.app/043-ink-wash.html) | 水墨 | 程序山水手卷：直排詩、墨暈、點紙滴墨、縮圖導覽 | |
| 044 | [044-lcars.html](https://htmls-ruddy.vercel.app/044-lcars.html) | LCARS 星艦介面 | MERIDIAN OPS：五個頁面、紅黃警報整體換色 | |
| 045 | [045-paper-layers.html](https://htmls-ruddy.vercel.app/045-paper-layers.html) | 紙雕層次 | 七層紙雕山谷：四季切換、24 節氣、太陽弧線、季節飄落物 | |
| 046 | [046-claymorphism.html](https://htmls-ruddy.vercel.app/046-claymorphism.html) | 黏土風 | 數字果凍島：兒童加減比大小、果凍彈跳、黏土碎片慶祝 | △ 版面單純，桌機右欄偏空 |
| 047 | [047-e-paper.html](https://htmls-ruddy.vercel.app/047-e-paper.html) | 電子紙 | 家用電子紙看板：16 階灰、局部更新殘影、全刷閃爍、FS 抖動插畫 | |
| 048 | [048-word-clock.html](https://htmls-ruddy.vercel.app/048-word-clock.html) | 文字時鐘 | 11×10 中文字格報時，精確到分，另會亮「該喝茶了」等提示 | △ 偏靜態，互動少 |
| 049 | [049-radial-year.html](https://htmls-ruddy.vercel.app/049-radial-year.html) | 放射狀年曆 | 365 天放射熱度圖：高亮同週與同星期幾、三組資料 | △ 桌機圓圖左側留白多 |
| 050 | [050-atomic-age.html](https://htmls-ruddy.vercel.app/050-atomic-age.html) | 50 年代原子時代 | Atomic Holidays 太空旅行社：航線圖、算票價、登機證、theremin 音效 | |
| 051 | [051-sport-bold.html](https://htmls-ruddy.vercel.app/051-sport-bold.html) | 運動品牌 | VELOX 配速計算器：速度線、三種計算模式、完賽預測 | |
| 052 | [052-tarot.html](https://htmls-ruddy.vercel.app/052-tarot.html) | 神秘塔羅 | The Hollow Moon：22 張自繪大阿爾克那、3D 翻牌、逆位 | |
| 053 | [053-temple.html](https://htmls-ruddy.vercel.app/053-temple.html) | 台灣廟宇 | 天恩宮擲筊求籤：聖筊、笑筊、陰筊照傳統規則，12 首原創籤詩 | |
| 054 | [054-geocities.html](https://htmls-ruddy.vercel.app/054-geocities.html) | 1996 個人首頁 | Dave's Cyber Corner：跑馬燈、計數器、WebRing、留言板 | |
| 055 | [055-holo-card.html](https://htmls-ruddy.vercel.app/055-holo-card.html) | 全息卡 | NEON FAUNA：6 種閃膜、3D 傾斜、可放大翻面 | |
| 056 | [056-topographic.html](https://htmls-ruddy.vercel.app/056-topographic.html) | 等高線 | 霧稜山區路線規劃：marching squares 等高線、即時海拔剖面 | |
| 057 | [057-bluenote.html](https://htmls-ruddy.vercel.app/057-bluenote.html) | 爵士唱片封面 | Blue Hour Records 封面產生器：5 種版型、7 組雙色調 | ⚠ 「照片」是向量剪影，側臉偏粗糙，少了真實攝影的質感 |
| 058 | [058-te-synth.html](https://htmls-ruddy.vercel.app/058-te-synth.html) | Teenage Engineering 風 | ku-16 十六步鼓機：6 種合成鼓聲、swing、4 組 pattern | |
| 059 | [059-oscilloscope.html](https://htmls-ruddy.vercel.app/059-oscilloscope.html) | 示波器 | Phosphor 59-L：李沙育圖形、磷光餘暉、立體聲 XY | |
| 060 | [060-wes-anderson.html](https://htmls-ruddy.vercel.app/060-wes-anderson.html) | 對稱粉彩 | Grand Hotel Alpenrose：中軸對稱立面、電梯開門顯示鑰匙牌 | |
| 061 | [061-letterpress.html](https://htmls-ruddy.vercel.app/061-letterpress.html) | 活版印刷 | 名片製作器：壓桿凹印動畫、盲壓、下方反向鉛字排字盤 | |
| 062 | [062-metro-wayfinding.html](https://htmls-ruddy.vercel.app/062-metro-wayfinding.html) | 捷運導視 | 潮汐捷運路網：Dijkstra 含轉乘懲罰、導視牌乘車步驟 | △ 手機上路網要在容器內左右滑 |
| 063 | [063-split-flap.html](https://htmls-ruddy.vercel.app/063-split-flap.html) | 翻牌看板 | 機場出境看板：真實上下半片翻轉、航班狀態推進、喀喀聲 | |
| 064 | [064-thermal-receipt.html](https://htmls-ruddy.vercel.app/064-thermal-receipt.html) | 熱感收據 | 人生便利商店：一天共 1,440 分鐘的電子發票證明聯，可撕下 | |
| 065 | [065-treasure-map.html](https://htmls-ruddy.vercel.app/065-treasure-map.html) | 藏寶圖 | The Isle of Mild Regret：照線索點地標、紅虛線路徑、開寶箱 | △ 手機上地名約 10px |
| 066 | [066-lava-lamp.html](https://htmls-ruddy.vercel.app/066-lava-lamp.html) | 熔岩燈 | Groovatron：metaball 加熱上升、胡桃木控制台、五種 mood | |
| 067 | [067-glitch.html](https://htmls-ruddy.vercel.app/067-glitch.html) | 故障藝術 | CORRUPT.EXE：hex 編輯器當控制台，位元組驅動 pixel sort、datamosh | |
| 068 | [068-braun.html](https://htmls-ruddy.vercel.app/068-braun.html) | Dieter Rams / Braun | WENIGER RT 66 可運算計算機，搭配設計十原則並標示對應部位 | |
| 069 | [069-nbody.html](https://htmls-ruddy.vercel.app/069-nbody.html) | 重力沙盒 | leapfrog 三體 8 字編舞、拖曳發射看預測軌跡、能量漂移遙測 | |
| 070 | [070-petri-dish.html](https://htmls-ruddy.vercel.app/070-petri-dish.html) | 培養皿生命遊戲 | H&E 染色顯微鏡：物鏡轉盤、對焦模糊、四種規則、期刊版面 | |
| 071 | [071-chalkboard.html](https://htmls-ruddy.vercel.app/071-chalkboard.html) | 黑板 | 畢氏定理五步驟證明：粉筆逐筆描繪、拖曳頂點、三角形重排 | |
| 072 | [072-stained-glass.html](https://htmls-ruddy.vercel.app/072-stained-glass.html) | 彩繪玻璃 | Voronoi 尖拱窗：點擊切出新玻璃、依時辰移動光斑 | |
| 073 | [073-low-poly.html](https://htmls-ruddy.vercel.app/073-low-poly.html) | 低多邊形 | Facets at Dusk：夕陽山谷持續飛行、六角控制鈕 | |
| 074 | [074-neon-sign.html](https://htmls-ruddy.vercel.app/074-neon-sign.html) | 霓虹招牌 | 中英霓虹招牌產生器：逐管閃爍點亮、故障燈管、電工盒面板 | |
| 075 | [075-kawaii.html](https://htmls-ruddy.vercel.app/075-kawaii.html) | 可愛貼紙 | 心情貼紙手帳：12 款模切貼紙可拖拉、拖出手帳即撕掉、喝水紀錄 | |
| 076 | [076-bloomberg.html](https://htmls-ruddy.vercel.app/076-bloomberg.html) | 金融終端 | KESTREL 終端機：K 線、五檔、新聞影響股價、指令列 <GO> | |
| 077 | [077-sheet-music.html](https://htmls-ruddy.vercel.app/077-sheet-music.html) | 樂譜 | 點五線譜寫曲、自動補休止符、播放游標 | △ 手繪高音譜號不夠精緻，手機上八分音符擠 |
| 078 | [078-girih.html](https://htmls-ruddy.vercel.app/078-girih.html) | 伊斯蘭幾何 | Hankin 多邊形接觸法即時算星紋：4 種鋪磚、接觸角量角器 | |
| 079 | [079-weather-poster.html](https://htmls-ruddy.vercel.app/079-weather-poster.html) | 天氣海報 | 高嶺市一週四季：巨大溫度滾動、雷雨、霧中數字變模糊、初雪 | |
| 080 | [080-fashion.html](https://htmls-ruddy.vercel.app/080-fashion.html) | 時尚大刊 | Maison Vérane 秋冬 lookbook：clip-path 時裝剪影、慢速橫移 | ⚠ 系統沒有 Didot / Bodoni，只能用 Georgia，時尚刊物最關鍵的高對比襯線字到不了位 |
| 081 | [081-saul-bass.html](https://htmls-ruddy.vercel.app/081-saul-bass.html) | 片頭設計 | 《The Man Who Misplaced Tuesday》剪紙片頭：8 張字卡、walking bass | |
| 082 | [082-periodic.html](https://htmls-ruddy.vercel.app/082-periodic.html) | 元素週期表 | 118 元素：魚眼放大、三種著色、Bohr 圖、約 60 則短評 | △ 𨧀、鿫 等擴充字可能在某些裝置顯示缺字 |
| 083 | [083-op-art.html](https://htmls-ruddy.vercel.app/083-op-art.html) | 歐普藝術 | OPTIKON 四幅：隆起棋盤、波流、摩爾紋、漩渦 | |
| 084 | [084-nasa-worm.html](https://htmls-ruddy.vercel.app/084-nasa-worm.html) | 70s NASA 手冊 | ORBITA 任務控制：T– 倒數、T–2:00 自動保留、8 席位 GO/NO-GO | |
| 085 | [085-circus.html](https://htmls-ruddy.vercel.app/085-circus.html) | 維多利亞馬戲 | 木活字海報售票亭：燈泡跑馬、£sd 計價、可撕票根 | |
| 086 | [086-deep-sea.html](https://htmls-ruddy.vercel.app/086-deep-sea.html) | 深海 | 捲動下潛 10,935 m：五個水層、15 種真實生物、探照燈 | ⚠ 深層刻意壓暗，要移動探照燈才看得到東西，大部分時間畫面偏空 |
| 087 | [087-star-chart.html](https://htmls-ruddy.vercel.app/087-star-chart.html) | 印刷星圖 | 約 170 顆真實亮星的星座盤：恆星時對齊、可切緯度 | △ 低緯度觀測窗小，部分標籤重疊 |
| 088 | [088-graffiti.html](https://htmls-ruddy.vercel.app/088-graffiti.html) | 街頭塗鴉 | WALLSPACE 噴漆牆：粒子噴霧、停留會滴流、模板字、Buff 蓋灰 | |
| 089 | [089-tiki.html](https://htmls-ruddy.vercel.app/089-tiki.html) | 提基酒吧 | The Leaky Coconut 調酒器：17 種材料分層、辨識 7 款經典酒譜 | |
| 090 | [090-ukiyoe.html](https://htmls-ruddy.vercel.app/090-ukiyoe.html) | 浮世繪 | 七十二候木版曆：自動定位今日的候、程序化浮世繪風景 | |
| 091 | [091-dither-3d.html](https://htmls-ruddy.vercel.app/091-dither-3d.html) | 1-bit 抖動渲染 | WebGL raymarch 五種 SDF、雙墨 Bayer 抖動，有 CPU 備援 | |
| 092 | [092-advent.html](https://htmls-ruddy.vercel.app/092-advent.html) | 降臨曆 | 24 扇 3D 開啟的門：門面拼成一整幅村莊、落雪隨開門變大 | |
| 093 | [093-perfume.html](https://htmls-ruddy.vercel.app/093-perfume.html) | 奢華香水 | Minuit Velours：點瓶身噴霧、香調金字塔、8 小時揮發圖 | |
| 094 | [094-fourier.html](https://htmls-ruddy.vercel.app/094-fourier.html) | 傅立葉周轉圓 | 隨手畫的線用 DFT 周轉圓重現、圓的數量可調 | |
| 095 | [095-nonogram.html](https://htmls-ruddy.vercel.app/095-nonogram.html) | 方格紙鉛筆 | 數織練習簿：4 題，都經 solver 驗證有唯一解，鉛筆塗黑 | △ 手機上 15×15 題的格子只有約 20px |
| 096 | [096-mediterranean.html](https://htmls-ruddy.vercel.app/096-mediterranean.html) | 地中海 | Levkí 四日行程：依真實太陽公式驅動天色、陰影、海面反光 | |
| 097 | [097-lofi-room.html](https://htmls-ruddy.vercel.app/097-lofi-room.html) | Lo-fi 房間 | 雨夜房間：點物件切換聲音，合成雨聲、lo-fi 和弦、貓呼嚕 | |
| 098 | [098-xeno-glyph.html](https://htmls-ruddy.vercel.app/098-xeno-glyph.html) | 外星語 | XENOLINGUA 解碼器：三種筆畫文法生成字形、直書、傳送音 | |
| 099 | [099-rubik.html](https://htmls-ruddy.vercel.app/099-rubik.html) | CSS 3D | 魔術方塊：整數旋轉矩陣驗證排列正確、拖曳旋轉視角、計時 | △ 只能用按鈕或按鍵轉面，不能直接拖貼紙轉 |
| 100 | [100-fireworks.html](https://htmls-ruddy.vercel.app/100-fireworks.html) | 煙火終章 | 河岸夜空：9 種煙火，「放一百發」每發標上一件作品的風格名，最後拼出「100」 | |
| 101 | [101-mattpocock-skills.html](https://htmls-ruddy.vercel.app/101-mattpocock-skills.html) | AI 學習 · 教學簡報 | mattpocock/skills 教學簡報：13 張投影片走完需求訪談、PRD、任務拆解、TDD、除錯與架構審查 | △ 後加收錄，使用 Google Fonts 外部字型，不符合前 100 件的零外部依賴規則 |
| 102 | [102-your-project-playbooks.html](https://htmls-ruddy.vercel.app/102-your-project-playbooks.html) | AI 學習 · 教學簡報 | 〈Starting on Your Own Project〉：在自己的專案啟動 Claude Code 的三套起手劇本（全新專案 / WebForms → Web / WinForms → Web），16 張投影片，版面沿用 101 | △ 同 101，使用 Google Fonts 外部字型 |
| 103 | [103-peach-blossom-spring.html](https://htmls-ruddy.vercel.app/103-peach-blossom-spring.html) | 生成藝術 · 互動閱讀 | 〈桃花源記〉全文直式閱讀、逐句白話與註解；匯入真人朗誦及逐句時間戳後隨聲推進六幕程序水墨 | 朗誦音檔與時間戳須由讀者提供；頁面不推估時間 |
| 104 | [104-laptop-studio.html](https://htmls-ruddy.vercel.app/104-laptop-studio.html) | 擬物器物 · 3D Mockup | FRAME：上傳、貼上或拖入截圖，置入程序生成的金屬筆電；可調相機、景深、打光與背景，匯出 PNG | Three.js 由 CDN 載入，需連線及 WebGL |
| 105 | [105-sales-crm.html](https://htmls-ruddy.vercel.app/105-sales-crm.html) | 專案範例 · 深色業務儀表板 | Northstar Sales CRM：高密度 Companies 表格、案件看板、加權預測、搜尋篩選、新增公司與 CSV 匯出 | 靜態 HTML 互動範例；資料為示意，沒有後端與帳務串接 |
| 106 | [106-courier-rush.html](https://htmls-ruddy.vercel.app/106-courier-rush.html) | 遊戲敘事 · 3D 跑酷 | Courier Rush：三線道換道與跳躍、三種障礙、金幣與強化、低多邊形城市；可匯入自己的 GLB 模型 | 使用本地 Three.js 模組，需透過網站伺服器開啟 |
| 107 | [107-arc-brokerage.html](https://htmls-ruddy.vercel.app/107-arc-brokerage.html) | 平面排版 · 可操作的券商概念站 | ARC 線上券商概念站：CSS 城市 Hero 與固定導覽列；交易台（走勢圖、市價與限價單、持倉與紀錄）、定期定額試算、產業熱力圖、可排序漲跌榜、帳戶比較與三步驟開戶 | 單檔離線可用；報價與帳戶皆為模擬，示範狀態只存在這個瀏覽器 |
| 108 | [108-last-train.html](https://htmls-ruddy.vercel.app/108-last-train.html) | 遊戲敘事 · 3D 波次生存射擊 | 末班車：程序化廢棄地鐵站 FPS，雙武器、雙入口波次、命中率結算與 WebAudio 聲響 | 使用本地 Three.js 模組，需透過網站伺服器開啟；桌機鍵鼠操作 |
| 109 | [109-windward-rail.html](https://htmls-ruddy.vercel.app/109-windward-rail.html) | 遊戲敘事 · 火車模擬 | 浮島列車：動力與煞車駕駛、乘客舒適度與小費、平穩連續倍率、機廠整備，以及日間與午夜兩條路線 | 使用本地 Three.js 模組，需透過網站伺服器開啟 |
| 110 | [110-embroidery-studio.html](https://htmls-ruddy.vercel.app/110-embroidery-studio.html) | 生成藝術 · 刺繡編輯器 | THREAD：逐像素布料光照、七種幾何針法與六道繡線渲染；針、橡皮擦、平移、復原重做、範本、JSON 與 PNG | 純 Canvas 2D，無外部依賴 |
| 111 | [111-jelly-dice.html](https://htmls-ruddy.vercel.app/111-jelly-dice.html) | 創意藝術 · 互動 3D | Jelly Dice：六種果凍口味、1–5 顆骰子、拋擲碰撞與回彈、戳壓及拖曳拉伸 | 使用本地 Three.js 模組，需透過網站伺服器開啟；支援觸控與減少動態效果 |
| 112 | [112-sunport-railway.html](https://htmls-ruddy.vercel.app/112-sunport-railway.html) | 遊戲敘事 · 桌上積木鐵道 | Sunport Railway：環線列車、調車場、轉車盤、工業區、港口、車站與小鎮；實體拉桿控制速度與時間，按鈕操作燈光、汽笛、調車 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL |
| 113 | [113-dustbound-frontier.html](https://htmls-ruddy.vercel.app/113-dustbound-frontier.html) | 遊戲敘事 · 體素開放世界 | Dustbound Frontier：程序化沙漠峽谷與西部小鎮、動態區塊、挖掘建造、28 位居民、晝夜光照與塵土粒子 | 單檔 HTML；僅 Three.js 由 CDN 載入，需連線及 WebGL |
| 114 | [114-promise-wall.html](https://htmls-ruddy.vercel.app/114-promise-wall.html) | 東方在地 · 3D 承諾牆 | 山中留話：山中咖啡館的承諾牆，四種便條材質、貼牆晃動、環繞縮放、點擊細讀及本機保存 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL；內容僅存在本機瀏覽器 |
| 115 | [115-windfield.html](https://htmls-ruddy.vercel.app/115-windfield.html) | 介面風格 · 沉浸式草原 | WIND：12 萬株獨立草葉的 shader 風浪、漸層與背光，平滑遠景、天空散射、可調日照風力與阻尼漫遊 | 單檔 HTML；僅 Three.js 由 CDN 載入，需連線及 WebGL2；60fps 為效能目標，依裝置而異 |
| 116 | [116-thockwork-keyboard.html](https://htmls-ruddy.vercel.app/116-thockwork-keyboard.html) | 生成藝術 · 客製化 3D 鍵盤 | Thockwork：程序生成每顆鍵帽、軸體與外殼；可選 60／65／75 配列、外殼、配色、鍵帽與軸體，旋轉試打並加入購物車 | 單檔 HTML；Three.js 與 GSAP 由 CDN 載入，需連線及 WebGL；購物車與結帳僅為本機示範，不會扣款或送出資料 |
| 117 | [117-taipei-diorama.html](https://htmls-ruddy.vercel.app/117-taipei-diorama.html) | 擬物器物 · 台北 3D 模型 | 掌心之城：台北 101、中正紀念堂、國父紀念館、夜間街廓與盆地山系；拖曳環繞、滾輪縮放與地標聚焦 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL |
| 118 | [118-lamplighter.html](https://htmls-ruddy.vercel.app/118-lamplighter.html) | 遊戲敘事 · 第三人稱 3D 動作平台 | 點燈人：先畫主角、場景、介面三張美術規格（art/118/）再實作；霧湖遺跡三區關卡、點亮三座燈台打開月門，影魅巡邏／察覺／蓄力撲擊 AI 與石燈守光彈，三段揮燈連擊、打擊停頓與鏡頭震動，GTAO＋bloom＋色彩分級，Web Audio 合成全部音效 | 單檔 HTML；Three.js 與官方 addons 由 CDN 載入，需連線及 WebGL；內顯自動降畫質 |
| 119 | [119-tetris.html](https://htmls-ruddy.vercel.app/119-tetris.html) | 遊戲敘事 · Canvas 俄羅斯方塊 | WELL：10×20 棋盤、七種經典配色方塊、Wall Kick 順時針旋轉、硬降與落點預覽；消 1／2／3／4 行得 100／300／500／800 分，每 10 行升級加速 | 單檔 HTML，不載入外部資源；最高分存在本機瀏覽器 |
| 120 | [120-qingming-scroll.html](https://htmls-ruddy.vercel.app/120-qingming-scroll.html) | 擬物器物 · 3D 清明上河圖 | 汴河長卷：沿汴河展卷橫移的立體長卷，郊野、漕運、虹橋、城郭四章與章節時間軸；絹本水墨後製、四時辰光影、合成市聲水聲風聲 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL；環境音為 WebAudio 即時合成，需點擊開啟 |
| 121 | [121-camera-blueprint.html](https://htmls-ruddy.vercel.app/121-camera-blueprint.html) | 生成藝術 · 程式渲染產品動畫 | R6 旁軸相機藍圖拆解：正視圖描邊 → 轉 3/4 視角 → 鏡頭、快門簾、捲片軸、觀景窗、底片室依序爆炸並標註 → 收回成尺寸標註正視圖；零件、標註與時間軸都是可編輯的 JSON | 純 Canvas 2D，不載入外部資源；同一幀號必得同一份顯示清單（畫面附雜湊）；以 WebCodecs 逐幀編碼合成 60fps MP4，或輸出 PNG 幀序列 ZIP，需新版 Chrome／Edge |

## 較弱的 7 件（誠實版）
- **⚠ 007 玻璃擬態、024 暗色 SaaS**：執行品質沒問題，弱在風格本身。這兩種是網路上最常見的樣式，再精緻也容易被看成模板。這是我規劃時選的方向，責任在規劃。
- **⚠ 022 動態字體**：原本的核心是可變字重連續變化。實測這台 Chrome 對 Bahnschrift 的 `font-variation-settings` 無效，只能在具名樣式間跳格，效果打了折扣。
- **⚠ 029 迷幻海報**：看得出風格，但真正的 60 年代迷幻字要手繪字形，SVG 濾鏡只能做到近似。
- **⚠ 057 爵士封面**：Reid Miles 風格很依賴攝影，向量剪影撐不起來。
- **⚠ 080 時尚大刊**：沒有 Didone 系統字，整個風格的靈魂少了一半。
- **⚠ 086 深海**：概念好，但暗部太多，第一印象偏空。

## 共通限制
- 只在 Windows + Chrome 上實測。macOS / iOS 會退到後備字型，字寬與截圖不同。
- 聲音依瀏覽器規定要點擊後才會啟動。驗收時 headless 瀏覽器是靜音的，**音效沒有經過人耳驗證**。
- 部分作品會把狀態存進 localStorage（例如 012、031、033、039、075、092、095），重開時會看到上次的狀態。


## 100 個手機 App 原型

每件都是 `app/` 下可單獨開啟的 HTML，使用 inline CSS/JS，圖像與聲音由程式生成；完整的風格、導覽、配色、字體與撞型規劃見 [APP-DIRECTIONS.md](APP-DIRECTIONS.md)。

**App 驗收**：100 件均在 macOS headless Chromium 的 375×667 與 1440×900 尺寸檢查過，沒有頁面例外、console error、外部請求或水平溢出；五件補完作品另驗證主要操作，QR 圖已用瀏覽器 QR 解碼器確認可掃描。聲音只檢查啟動與停止，未做真人聽感評估。

| # | 檔案 | App 類型與風格方向 | 核心功能 | 自評 |
|---|---|---|---|---|
| 001 | [001-glass-pedometer.html](app/001-glass-pedometer.html) | 步頻 Stride：健走計步器；iOS 液態玻璃：玻璃浮在一幅程式繪製的黃昏山徑畫上，玻璃會折射底圖 | 開始健走模擬即時步數、每日圓環、週長條、調整目標抽屜、路線卡片左右滑 |  |
| 002 | [002-material-ledger.html](app/002-material-ledger.html) | 小帳本 Ledger：智慧記帳本；Material You 3：以種子色即時產生整套色調，換桌布色就換主題 | 數字鍵盤新增收支、分類甜甜圈、篩選、刪除（左滑）、月份切換 |  |
| 003 | [003-film-camera.html](app/003-film-camera.html) | ASA 400：復古膠捲相機；擬物：皮革機身、拉絲鉻、過片扳手、快門速度轉盤 | 拍照（程序化風景＋漏光顆粒）、1–36 張計數、沖洗成印樣、刪除 |  |
| 004 | [004-brutal-player.html](app/004-brutal-player.html) | LOUD.：音樂播放器；粗獷主義：原生 HTML 感、巨大黑字、硬邊黃塊、零圓角 | WebAudio 程序化曲目播放、刮擦進度、拖曳排佇列、隨機／循環 |  |
| 005 | [005-eink-reader.html](app/005-eink-reader.html) | 墨頁：電子書閱讀器；電子紙：灰階、翻頁時黑白閃刷新、殘影 | 三章原創短篇、字級行距抽屜、劃線與筆記、閱讀進度 |  |
| 006 | [006-neon-home.html](app/006-neon-home.html) | 夜巢 NEST//07：智控家居儀表板；賽博朋克：斜切角面板、故障掃描、公寓等角平面圖 | 平面圖點房間開關燈、門鎖長按、溫控、場景模式 |  |
| 007 | [007-vapor-pomodoro.html](app/007-vapor-pomodoro.html) | ＦＯＣＵＳ．ＥＸＥ：專注蕃茄鐘；蒸汽波：Win98 對話框＋卡帶轉盤當進度 | 25/5 計時、暫停、任務清單、lofi 和弦 WebAudio、統計 |  |
| 008 | [008-doodle-habits.html](app/008-doodle-habits.html) | 小日課：習慣養成；手繪：鉛筆抖動線、蠟筆塗滿勾選框 | 新增／刪除習慣、每日打勾、連續天數、月曆塗色 |  |
| 009 | [009-htop-monitor.html](app/009-htop-monitor.html) | sysmon：系統監控器；黑客終端：htop 真實 ANSI 配色、tmux 窗格 | 每核 CPU、記憶體、行程排序／kill、網路 sparkline、指令列 |  |
| 010 | [010-editorial-closet.html](app/010-editorial-closet.html) | VESTE：穿搭選品；雜誌風：巨大期號、跨頁排版、SVG 畫的衣物 | 左右滑選單品、上衣／下身／鞋組合器、收藏、尺寸抽屜 |  |
| 011 | [011-metro-arrivals.html](app/011-metro-arrivals.html) | 捷運到站：交通即時到站；車站導引標誌：象形圖、路線色、站名雙語 | 即時倒數、切換路線、收藏車站、起訖規劃 |  |
| 012 | [012-gouache-weather.html](app/012-gouache-weather.html) | 天色：天氣；不透明水彩插畫天空，隨時間拖曳換天色 | 逐時拖曳、10 日預報、城市新增／刪除、單位切換 |  |
| 013 | [013-riso-plants.html](app/013-riso-plants.html) | 葉室：植物照護；孔版雙色植物圖鑑 | 植物清單、澆水紀錄、提醒、新增植物 |  |
| 014 | [014-drum-alarm.html](app/014-drum-alarm.html) | 眠：睡眠追蹤＋鬧鐘；深夜墨綠、iOS 滾筒選擇器 | 睡眠圖、智慧鬧鐘滾筒、白噪音混音器（WebAudio 雨聲／棕噪音） |  |
| 015 | [015-clay-water.html](app/015-clay-water.html) | 水水：喝水紀錄；黏土風：果凍按鈕、可晃動的水瓶 | 一鍵加水、自訂杯量、每日目標、歷史 |  |
| 016 | [016-textile-cycle.html](app/016-textile-cycle.html) | 月環：週期追蹤；北歐織品印花色塊 | 轉動選日、記錄症狀、預測、月曆 |  |
| 017 | [017-asphalt-run.html](app/017-asphalt-run.html) | PACE：跑步紀錄；運動雜誌：粗斜體、等高線地圖 | 模擬跑步、分段、路線回放、紀錄清單 |  |
| 018 | [018-sumi-yoga.html](app/018-sumi-yoga.html) | 伸展：瑜伽伸展引導；侘寂水墨線條人形 | 引導計時、呼吸圈、拖曳排序自訂序列 |  |
| 019 | [019-zen-garden.html](app/019-zen-garden.html) | 枯山水：冥想呼吸；枯山水耙沙 | 手指耙沙、方形呼吸引導、計時、紀錄 |  |
| 020 | [020-konbini-nutrition.html](app/020-konbini-nutrition.html) | 食記：飲食營養紀錄；日本超商包裝：粗色帶、大字 | 模擬掃描、搜尋食物、三大營養素環、刪除 |  |
| 021 | [021-salmon-stocks.html](app/021-salmon-stocks.html) | 盤後：股票看盤；財經報紙鮭魚粉紙 | K 線圖拖曳檢視、自選股新增刪除、下單抽屜 |  |
| 022 | [022-receipt-split.html](app/022-receipt-split.html) | 拆帳：分帳；感熱紙收據：鋸齒邊、虛線 | 新增人、品項拖給人、自動結算誰欠誰 |  |
| 023 | [023-envelope-budget.html](app/023-envelope-budget.html) | 信封：信封預算；文具牛皮信封 | 分配收入到信封、花費、月結轉 |  |
| 024 | [024-orbit-subs.html](app/024-orbit-subs.html) | 軌道：訂閱管理；瑞士極簡：單一信號紅 | 新增訂閱、軌道視覺、左滑取消、月總額 |  |
| 025 | [025-punch-clock.html](app/025-punch-clock.html) | 打卡鐘：工時計時；1950 年代工業打卡鐘：琺瑯、電木 | 專案計時、打卡、週報、匯出 |  |
| 026 | [026-splitflap-fx.html](app/026-splitflap-fx.html) | 匯率板：匯率換算；機場翻牌看板 | 幣別交換、數字鍵盤、常用幣別 |  |
| 027 | [027-gacha-savings.html](app/027-gacha-savings.html) | 存錢罐：存錢目標；日本扭蛋玩具：塑膠光澤 | 目標新增、存入（投幣）、進度、完成扭蛋 |  |
| 028 | [028-espresso-pos.html](app/028-espresso-pos.html) | 吧台：咖啡店點單 POS；1960 年代義式吧台：橄欖綠、橘 | 點單、客製選項、購物車、付款滑桿、收據 |  |
| 029 | [029-madori-mortgage.html](app/029-madori-mortgage.html) | 房貸格局：房貸試算；日式不動產格局圖（間取り） | 滑桿試算、攤還圖、方案比較 |  |
| 030 | [030-invoice-lottery.html](app/030-invoice-lottery.html) | 發票對獎：統一發票對獎；台灣電子發票：淺綠網紋紙 | 輸入末三碼即時對獎、發票夾、期別 |  |
| 031 | [031-hifi-podcast.html](app/031-hifi-podcast.html) | 聲道：Podcast；70 年代日系 Hi-Fi：拉絲鋁、琥珀 VU 表 | 播放、章節、倍速、睡眠計時、訂閱 |  |
| 032 | [032-crate-vinyl.html](app/032-crate-vinyl.html) | 唱片箱：黑膠收藏；70 年代唱片行：暖色印刷 | 翻找、播放（WebAudio）、收藏清單、新增 |  |
| 033 | [033-whitecube-photos.html](app/033-whitecube-photos.html) | 白廳：相簿；美術館白盒：大量留白 | 程序化照片、瀑布流、燈箱縮放、相簿、刪除 |  |
| 034 | [034-neon-ktv.html](app/034-neon-ktv.html) | 麥霸：KTV 歌詞；香港霓虹招牌：真實燈管 | 伴奏播放、逐字染色、點歌佇列、音準條 |  |
| 035 | [035-shorts-feed.html](app/035-shorts-feed.html) | 刷刷：短影音；沉浸全螢幕、粗白字 | 程序化「影片」、按讚、留言抽屜、靜音 |  |
| 036 | [036-step-808.html](app/036-step-808.html) | 808：節奏機；TR-808 經典配色 | 16 步編輯、速度旋鈕、樣式槽、WebAudio 鼓聲 |  |
| 037 | [037-penguin-audiobook.html](app/037-penguin-audiobook.html) | 聽書：有聲書；企鵝平裝三色帶書封 | 播放、章節、倍速、書籤、睡眠計時 |  |
| 038 | [038-darkroom-edit.html](app/038-darkroom-edit.html) | 暗房：照片調色；專業工具石墨暖黑、小黃點綴 | 曝光／對比／顆粒／分離色調、預設、比較 |  |
| 039 | [039-citypop-discover.html](app/039-citypop-discover.html) | 夏夜：音樂探索；80 年代日本 City Pop 平塗插畫 | 左右滑喜歡／略過、試聽合成音樂、收藏 |  |
| 040 | [040-criterion-tv.html](app/040-criterion-tv.html) | 放映表：串流節目表；典藏電影系列：黑白、編號書背 | 節目表、詳情抽屜、片單、提醒 |  |
| 041 | [041-papercut-chat.html](app/041-papercut-chat.html) | 紙訊：通訊；剪紙貼圖、柿橘與墨 | 傳訊、貼圖、語音波形錄製模擬、反應 |  |
| 042 | [042-polaroid-feed.html](app/042-polaroid-feed.html) | 拍立得：照片社群；拍立得相片散在深群青桌面 | 動態、限動、留言抽屜、發文 |  |
| 043 | [043-nouveau-match.html](app/043-nouveau-match.html) | 花窗：交友配對；新藝術運動裝飾框（慕夏） | 滑動配對、配對彈窗、聊天、個人檔案 |  |
| 044 | [044-ptt-bbs.html](app/044-ptt-bbs.html) | 批踢踢：BBS 論壇；ANSI BBS 藍底 | 推／噓、看板切換、發文、搜尋 |  |
| 045 | [045-letterpress-tickets.html](app/045-letterpress-tickets.html) | 票根：活動邀約；60 年代活版印刷票根 | 活動列表、座位選擇、撕票入場、RSVP |  |
| 046 | [046-kairanban.html](app/046-kairanban.html) | 回覽板：社區公告／二手交換；日本回覽板：印章、判子 | 公告、二手物品、蓋章已讀、手繪地圖 |  |
| 047 | [047-teletext-threads.html](app/047-teletext-threads.html) | P100：微網誌；電視文字廣播 Teletext：8 色馬賽克 | 頁碼跳轉、發文、按讚、字數環 |  |
| 048 | [048-aicher-poll.html](app/048-aicher-poll.html) | 投票：群組投票；1972 慕尼黑奧運：Aicher 象形與彩帶 | 建立投票、即時投票、匿名、結果 |  |
| 049 | [049-celadon-recipes.html](app/049-celadon-recipes.html) | 青瓷：食譜社群；韓式青瓷釉色 | 份量縮放、步驟計時、收藏、分享 |  |
| 050 | [050-felt-call.html](app/050-felt-call.html) | 圍爐：視訊通話；羊毛氈質感 | 靜音／鏡頭、反應、成員格、聊天抽屜 |  |
| 051 | [051-boba-merge.html](app/051-boba-merge.html) | 珍奶合成：2048 合成遊戲；黏土 3D 飲料杯 | 滑動合成、分數、最高分、撤銷 |  |
| 052 | [052-nokia-snake.html](app/052-nokia-snake.html) | 貪食蛇 3310：貪食蛇；Nokia 單色 LCD 殘影 | 方向鍵／滑動、速度、最高分 |  |
| 053 | [053-sonar-mines.html](app/053-sonar-mines.html) | 聲納：踩地雷；深海聲納掃描 | 點擊揭開、長按插旗、難度 |  |
| 054 | [054-paper-plane.html](app/054-paper-plane.html) | 紙飛機：一鍵飛行；剪紙多層城市 | 點擊上升、障礙、分數 |  |
| 055 | [055-klein-solitaire.html](app/055-klein-solitaire.html) | 接龍：接龍；克萊因藍絨布、純字卡 | 拖放、雙擊自動、復原、新局 |  |
| 056 | [056-taiko-rhythm.html](app/056-taiko-rhythm.html) | 祭太鼓：節奏遊戲；祭典太鼓：朱漆黑漆 | 雙軌打擊、判定、連擊、WebAudio 曲 |  |
| 057 | [057-movable-type-idiom.html](app/057-movable-type-idiom.html) | 活字成語：成語猜謎；鉛活字排版 | 猜四字成語、字位提示、每日題 |  |
| 058 | [058-ukiyo-fishing.html](app/058-ukiyo-fishing.html) | 浮世釣：釣魚；浮世繪平塗浪花 | 拋竿、收線張力、魚類圖鑑 |  |
| 059 | [059-rams-sudoku.html](app/059-rams-sudoku.html) | 數獨：數獨；Dieter Rams 計算機 | 鉛筆標記、錯誤提示、提示、難度 |  |
| 060 | [060-pixel-bakery.html](app/060-pixel-bakery.html) | 像素烘焙坊：放置類遊戲；16-bit JRPG 像素商店 | 點擊、升級、離線收益（localStorage） |  |
| 061 | [061-wood-maze.html](app/061-wood-maze.html) | 木迷宮：重力迷宮；擬物木盤鋼珠 | 傾斜滾珠、洞、關卡、計時 | △ 鋼珠物理與關卡皆可玩，但軌道配置仍偏簡單 |
| 062 | [062-nightmarket-memory.html](app/062-nightmarket-memory.html) | 夜市翻牌：記憶翻牌；台灣夜市紅白藍帆布、燈泡 | 翻牌配對、計時、步數 |  |
| 063 | [063-poster-golf.html](app/063-poster-golf.html) | 小白球：迷你高爾夫；60 年代旅遊海報平塗 | 拉線擊球、九洞、桿數 |  |
| 064 | [064-beech-stack.html](app/064-beech-stack.html) | 積木塔：堆疊遊戲；蒙特梭利山毛櫸木玩具 | 點擊放下、切邊、連擊 |  |
| 065 | [065-ev-companion.html](app/065-ev-companion.html) | 電車：電動車管理；汽車精品：暖石墨、拉絲鋁 | 上鎖（長按）、車門、空調、充電排程 |  |
| 066 | [066-pfd-drone.html](app/066-pfd-drone.html) | 天眼：無人機遙控；航空主飛行顯示器 PFD | 起降、雙搖桿、雲台、遙測 |  |
| 067 | [067-nature-aquarium.html](app/067-nature-aquarium.html) | 水景：水族箱控制；天野自然水景 | 光照排程環、水質、餵食、換水 |  |
| 068 | [068-hazard-printer.html](app/068-hazard-printer.html) | 3D 列印：3D 列印監控；工業安全黃黑 | 暫停／繼續、溫度、佇列排序 |  |
| 069 | [069-enamel-watchfaces.html](app/069-enamel-watchfaces.html) | 錶盤：手錶錶盤編輯；鐘錶琺瑯盤、機刻紋 | 錶盤切換、複雜功能配置、顏色 |  |
| 070 | [070-bakelite-energy.html](app/070-bakelite-energy.html) | 電能：家庭能源；蘇聯控制室電木儀表 | 太陽能→電池→家流向、電器開關、日圖 |  |
| 071 | [071-cctv-cams.html](app/071-cctv-cams.html) | 保全：監視器；CCTV：VHS 時間戳、單色 | 四格切換、事件時間軸、長按對講 |  |
| 072 | [072-enamel-kitchen.html](app/072-enamel-kitchen.html) | 廚房計時：多重計時器；50 年代粉彩琺瑯家電 | 多個同時計時、鈴聲、預設 |  |
| 073 | [073-mip-cycling.html](app/073-mip-cycling.html) | 碼錶：單車碼錶；反射式 LCD 高對比 | 速度、踏頻、心率區、圈數、爬坡 |  |
| 074 | [074-panam-flights.html](app/074-panam-flights.html) | 航跡：航班追蹤；60 年代航空公司 | 追蹤航班、大圓航線、延誤、登機證 |  |
| 075 | [075-ring-flashcards.html](app/075-ring-flashcards.html) | 單語卡：單字卡；日式單語帳：金屬環 | 翻面、會／不會（SM-2）、新增卡、統計 |  |
| 076 | [076-kaishu-practice.html](app/076-kaishu-practice.html) | 臨帖：寫字練習；米字格習字帖 | 描紅筆順、評分、清除、字表 |  |
| 077 | [077-badge-lingo.html](app/077-badge-lingo.html) | 徽章語：語言學習；童軍刺繡徽章 | 選擇題、點字造句、生命、經驗值 |  |
| 078 | [078-tearoff-almanac.html](app/078-tearoff-almanac.html) | 日日：每日簡報／黃曆；台灣撕日曆 | 撕頁換日、宜忌、今日簡報、收藏 |  |
| 079 | [079-planisphere.html](app/079-planisphere.html) | 星盤：星空圖；古星圖版畫＋夜間紅光模式 | 日期時間轉盤、星座資訊、紅光模式 |  |
| 080 | [080-museum-guide.html](app/080-museum-guide.html) | 館藏：博物館導覽；展品標籤排版 | 展品、語音導覽刮擦、樓層、收藏 |  |
| 081 | [081-casio-graph.html](app/081-casio-graph.html) | 函數機：繪圖計算機；卡西歐圖形計算機 | 輸入函數、描圖、平移縮放、表格 |  |
| 082 | [082-field-birds.html](app/082-field-birds.html) | 野鳥：鳥類圖鑑；奧杜邦圖鑑版畫 | 篩選、打勾、叫聲、觀察紀錄 |  |
| 083 | [083-hobonichi-diary.html](app/083-hobonichi-diary.html) | 一日一頁：日記；手帳：薄紙、緞帶書籤 | 寫日記、心情一年像素、提示 |  |
| 084 | [084-kanko-map.html](app/084-kanko-map.html) | 散步地圖：城市散步；日本手繪觀光地圖 | 景點抽屜、路線、搜尋、收藏 |  |
| 085 | [085-slide-rule.html](app/085-slide-rule.html) | 計算尺：單位換算；竹製計算尺 | 單位換算、滑尺、常用 |  |
| 086 | [086-stamp-qr.html](app/086-stamp-qr.html) | 印 QR：QR 產生器；橡皮章與印泥 | 產生真 QR、顏色、歷史、下載 PNG |  |
| 087 | [087-magnet-kanban.html](app/087-magnet-kanban.html) | 白板：看板待辦；白板＋便利貼＋磁鐵 | 新增、拖曳換欄、到期、篩選 |  |
| 088 | [088-vault-passwords.html](app/088-vault-passwords.html) | 金庫：密碼庫；銀行金庫鋼與黃銅 | 轉盤解鎖、項目、產生器、長按顯示 |  |
| 089 | [089-swiss-calendar.html](app/089-swiss-calendar.html) | 曆：行事曆；瑞士字體日曆：週日紅 | 拖曳建立事件、分類、刪除 | △ 日檢視以時間格為主，尚無事件拖放調整 |
| 090 | [090-fandeck-colors.html](app/090-fandeck-colors.html) | 色票：配色工具；色票扇形 | 和諧配色、對比檢查、存色盤 |  |
| 091 | [091-strobe-tuner.html](app/091-strobe-tuner.html) | 調音：樂器調音器；復古頻閃調音器 | 參考音、模擬偵測、指針、樂器 |  |
| 092 | [092-signal-lamp.html](app/092-signal-lamp.html) | 燈語：摩斯電碼；航海信號燈：黃銅、船海軍藍 | 文字轉摩斯、敲擊輸入、SOS、聲音 |  |
| 093 | [093-kippu-phrases.html](app/093-kippu-phrases.html) | 旅日會話：旅行會話卡；日本鐵道車票（切符）地紋 | 情境會話、朗讀、收藏、放大卡 |  |
| 094 | [094-luggage-packing.html](app/094-luggage-packing.html) | 行李：打包清單；復古行李貼紙 | 清單勾選、範本、新增、依天氣建議 | △ 天氣建議由使用者選情境，不連動即時預報 |
| 095 | [095-illuminated-dice.html](app/095-illuminated-dice.html) | 羊皮骰：TRPG 骰子；泥金手抄本 | d4–d20、優劣勢、歷史、角色卡 |  |
| 096 | [096-field-compass.html](app/096-field-compass.html) | 野戰羅盤：指南針／水平儀；軍用野戰裝備橄欖綠 | 方位、水平、座標、標記 |  |
| 097 | [097-bruna-baby.html](app/097-bruna-baby.html) | 寶寶日誌：育兒紀錄；米飛兔式粗黑線平塗 | 餵奶／尿布／睡眠計時、時間軸、統計 |  |
| 098 | [098-kusuri-meds.html](app/098-kusuri-meds.html) | 藥袋：用藥提醒；日本藥局藥袋印刷 | 服藥打勾、排程、補藥、提醒 |  |
| 099 | [099-picturebook-carbon.html](app/099-picturebook-carbon.html) | 小樹：碳足跡；童書水彩 | 每日選擇、減碳、樹成長、比較 |  |
| 100 | [100-linen-springboard.html](app/100-linen-springboard.html) | 主畫面：主畫面模擬器；iOS 6 擬物：亞麻布、光澤圖示 | 長按抖動、拖曳排序、刪除、資料夾 |  |

### App 相對較弱的作品
- **061 木迷宮**：鋼珠與碰撞能操作，但三關的牆體配置還偏簡單；可以加入更多特殊機關與細緻的木盤回饋。
- **089 曆**：月、週、日與新增刪除已完成；日視圖只有基本時間格，尚不能在時間軸直接拖動事件。
- **094 行李**：皮箱與打包互動完整，但天氣建議需手動選擇情境，沒有真實預報資料。

這些 App 的本機狀態保存在瀏覽器 localStorage；清除網站資料會清空紀錄。QR 產生器支援最多 106 UTF-8 bytes。
