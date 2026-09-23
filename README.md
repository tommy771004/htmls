# 100 HTML — 作品清單

**線上瀏覽：[htmls-ruddy.vercel.app](https://htmls-ruddy.vercel.app/)**（可搜尋、依分類篩選、直接預覽每件作品）

100 個獨立單檔 HTML（inline CSS/JS、無外部素材、只用系統字、聲音全部 WebAudio 即時合成），直接用瀏覽器開啟即可。
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
