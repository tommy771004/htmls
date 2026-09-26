# 100 HTML — 作品清單

**線上瀏覽：[htmls-ruddy.vercel.app](https://htmls-ruddy.vercel.app/)**（可搜尋、依分類篩選、直接預覽每件作品）

原始 100 個獨立單檔 HTML 加上第 103 件起的後續作品（最新編號為 162，皆放在 `web/`），以及另外 103 個獨立手機 App 原型（放在 `app/`）；101、102 為教學簡報。第 103 件的朗誦模式需讀者提供音檔與逐句時間戳。第 104、112、113、114、115、116、117、118、120、124、126、151、153、158、159、161、162 件為單檔 HTML，Three.js 從 CDN 載入。第 106、108、109、111、132、133、135、136、140、142 件使用本地 Three.js 模組，需透過網站伺服器開啟。第 131 件的原始碼在 `games/131-wildling-trail/`（TypeScript + Vite + Phaser），`npm run build` 後內嵌成單檔 `web/131-wildling-trail.html`。第 155 件的原始碼在 `games/155-tally-crm/`（無相依套件），`node games/155-tally-crm/build.mjs` 內嵌成單檔 `web/155-tally-crm.html`。
規劃與撞型自檢見 `DIRECTIONS.md`。

**驗收方式**：headless Chrome 自動檢查每件作品在 1440×900 與 390×844 兩種尺寸下的狀況，並模擬滑鼠移動、點擊、按鍵、滾輪。檢查項目包括 uncaught exception、console.error、外部網路請求、viewport meta、手機水平溢出。**最終結果 100/100 PASS。** 另外也逐件人工看過桌機與手機截圖。

標記說明：⚠ = 我認為做得比較弱的作品；△ = 整體 OK，但有具體的小缺點。未標記的是我認為水準穩定的作品。

| # | 檔案 | 風格方向 | 一句話說明 | 評 |
|---|---|---|---|---|
| 001 | [001-swiss.html](https://htmls-ruddy.vercel.app/web/001-swiss.html) | 瑞士國際主義 | RASTER 26 研討會海報首頁：非對稱 12 欄、群青巨字，G 鍵開關網格疊層 | |
| 002 | [002-beton-brut.html](https://htmls-ruddy.vercel.app/web/002-beton-brut.html) | 建築粗獷主義 | 混凝土建築檔案館：14 棟真實建築，可篩選排序，硬切動效；板片牆逐列排版，篩選後由相鄰板片加寬補滿，另有清單索引檢視，指向一列即在側邊看到該建築的混凝土板；表面為木模板留下的橫向板痕 | |
| 003 | [003-vaporwave.html](https://htmls-ruddy.vercel.app/web/003-vaporwave.html) | 蒸汽波 | ＶＡＰＯＲ ＭＡＬＬ：無限透視網格、Win95 視窗切換天色、VHS 抖動、賣場音樂 | |
| 004 | [004-editorial-essay.html](https://htmls-ruddy.vercel.app/web/004-editorial-essay.html) | 極簡編輯長文 | 原創散文〈慢的練習〉：首字放大、側註、閱讀進度、慢讀模式 | |
| 005 | [005-crt-terminal.html](https://htmls-ruddy.vercel.app/web/005-crt-terminal.html) | 終端機 | 1983 天文台 CRT：虛擬檔案系統、約 25 個指令、Tab 補完、三種磷光色 | |
| 006 | [006-zine-collage.html](https://htmls-ruddy.vercel.app/web/006-zine-collage.html) | 雜誌拼貼 | 《噪音夏日》Zine：勒索信標題、可拖曳紙片（依速度傾斜、放下會晃動） | △ 手機上紙片佔版面大，捲動時容易誤觸拖曳 |
| 007 | [007-glassmorphism.html](https://htmls-ruddy.vercel.app/web/007-glassmorphism.html) | 玻璃擬態 | 雨夜窗前的家居面板：玻璃溫控透鏡即時折射窗外失焦的城市燈火，滑動玻璃珠標示房間，燈光與四種情境改變窗上倒影、天色與雨 | △ 透鏡折射依賴 Chrome 的 SVG 濾鏡，Safari 可能只看到沒有彎折的窗景 |
| 008 | [008-notebook-doodle.html](https://htmls-ruddy.vercel.app/web/008-notebook-doodle.html) | 手繪筆記 | 手沖咖啡筆記：抖動線逐筆描繪、豆水比計算器、沖煮碼錶 | △ 系統沒有中文手寫字，中文只能用標楷體撐 |
| 009 | [009-bauhaus.html](https://htmls-ruddy.vercel.app/web/009-bauhaus.html) | 包浩斯 | 幾何構成產生器：點擊重組、可鎖定形狀、Kandinsky 形色規則 | |
| 010 | [010-neumorphism.html](https://htmls-ruddy.vercel.app/web/010-neumorphism.html) | 新擬物 | 密碼產生器：每個字元一塊凹陷字元磚，撐滿首屏的寬托盤；neumorphic 滑桿、隨機或好記詞組、強度與破解時間 | |
| 011 | [011-pico8-arcade.html](https://htmls-ruddy.vercel.app/web/011-pico8-arcade.html) | 8-bit 街機 | STAR DODGE：PICO-8 十六色、手刻像素字、chiptune，手機有 D-pad | |
| 012 | [012-art-deco.html](https://htmls-ruddy.vercel.app/web/012-art-deco.html) | 裝飾藝術 | 1926 跨年晚宴邀請函：扇形展開、金屬光澤掃過、RSVP 產生座位與徽章 | |
| 013 | [013-memphis.html](https://htmls-ruddy.vercel.app/web/013-memphis.html) | 孟菲斯 | 派對歌單產生器：每張卡片造型都不同、能量曲線、紙屑 | |
| 014 | [014-scrollytelling.html](https://htmls-ruddy.vercel.app/web/014-scrollytelling.html) | 資料新聞捲動敘事 | 〈一座城市如何變熱〉：sticky 圖表，7 個狀態補間轉場 | △ 手機上圖表文字約 10px |
| 015 | [015-cyberpunk-hud.html](https://htmls-ruddy.vercel.app/web/015-cyberpunk-hud.html) | 賽博龐克 HUD | Breach Protocol 矩陣解碼遊戲：保證有解、40 秒倒數 | |
| 016 | [016-muji-minimal.html](https://htmls-ruddy.vercel.app/web/016-muji-minimal.html) | 日系無印極簡 | 余白舍道具目錄：12 件純 CSS 器物（時鐘走真實時間）、購物清單 | △ 少數字缺字退到正黑體，粗細不一 |
| 017 | [017-risograph.html](https://htmls-ruddy.vercel.app/web/017-risograph.html) | 孔版印刷 | PULP 26 書展海報：雙色 multiply 疊印，拖曳造成錯版 | |
| 018 | [018-skeuo-radio.html](https://htmls-ruddy.vercel.app/web/018-skeuo-radio.html) | 擬物 | 1946 胡桃木收音機：旋鈕調頻、6 個合成電台、真空管暖機、調諧魔眼 | |
| 019 | [019-broadsheet.html](https://htmls-ruddy.vercel.app/web/019-broadsheet.html) | 維多利亞大報 | 《The Daily Algorithm》：6 欄細線、Stop the Presses 換版 | △ 多按幾次會看出內文句型重複 |
| 020 | [020-flowfield.html](https://htmls-ruddy.vercel.app/web/020-flowfield.html) | 生成藝術 | Perlin 流場墨線畫：版畫框、參數面板、可拖曳加墨線 | |
| 021 | [021-y2k-chrome.html](https://htmls-ruddy.vercel.app/web/021-y2k-chrome.html) | Y2K 液態金屬 | ChromAmp 2000：7 首合成曲、頻譜、可拖曳畫 EQ 曲線 | |
| 022 | [022-kinetic-type.html](https://htmls-ruddy.vercel.app/web/022-kinetic-type.html) | 動態字體 | TYPE IS A MUSCLE：自繪 SVG 骨架字：字重、字寬、斜度連續變化，游標附近的字母變粗變寬，可多行打字與手動三軸調整 |  |
| 023 | [023-isometric.html](https://htmls-ruddy.vercel.app/web/023-isometric.html) | 等角視圖 | 薄荷鎮建造器：7 種工具、道路自動接線、小車、日夜切換 | △ 手機上地圖偏小 |
| 024 | [024-dev-saas-dark.html](https://htmls-ruddy.vercel.app/web/024-dev-saas-dark.html) | 暗色開發者產品頁 | Driftwood CLI 落地頁：整頁是一段終端 session；`drift plan` 列出修正步驟，逐步核可或略過後執行，狀態即時更新 |  |
| 025 | [025-nordic-shop.html](https://htmls-ruddy.vercel.app/web/025-nordic-shop.html) | 北歐家具店 | stilla 材質研究：寬幅商品展示、木作與織品聚焦、木材布料搭配、設計筆記與購物車；支援減少動態效果 | △ 椅子是正面平視，立體感有限 |
| 026 | [026-blueprint.html](https://htmls-ruddy.vercel.app/web/026-blueprint.html) | 工程藍圖 | 機械錶芯藍圖：以真實擺頻運轉、零件規格、滴答聲 | |
| 027 | [027-herbarium.html](https://htmls-ruddy.vercel.app/web/027-herbarium.html) | 標本館 | 想像植物標本：依 seed 生長四類植物、拉丁學名、可用網址重現 | |
| 028 | [028-system7.html](https://htmls-ruddy.vercel.app/web/028-system7.html) | 經典 Mac OS | 1-bit 桌面作品集：縮放框動畫、拖曳時只移動外框、15 格拼圖 | |
| 029 | [029-psychedelic.html](https://htmls-ruddy.vercel.app/web/029-psychedelic.html) | 60 年代迷幻 | 迷幻演唱會海報：自繪字形經網格變形填滿燈泡輪廓，慢速融化、游標攪動，可切換互補色 |  |
| 030 | [030-type-specimen.html](https://htmls-ruddy.vercel.app/web/030-type-specimen.html) | 字體樣本 | Bahnschrift × Georgia 樣本書：實測參考線、字符格、瀑布、試打 | |
| 031 | [031-constructivism.html](https://htmls-ruddy.vercel.app/web/031-constructivism.html) | 構成主義 | 人民圖書館：-13° 紅帶、換口號、借書蓋章、發借書證 | |
| 032 | [032-dark-academia.html](https://htmls-ruddy.vercel.app/web/032-dark-academia.html) | 暗黑學院 | 珍奇櫃：12 抽屜、手繪 SVG 藏品、燭光、上鎖抽屜謎題 | |
| 033 | [033-solarpunk.html](https://htmls-ruddy.vercel.app/web/033-solarpunk.html) | 太陽龐克 | 屋頂菜園規劃：日照時數計算、陰影時間滑桿、鄰作加成 | |
| 034 | [034-tamagotchi.html](https://htmls-ruddy.vercel.app/web/034-tamagotchi.html) | 電子雞 | 咕咕蛋：32×16 LCD 殘影、A/B/C 鍵、孵化、生病、長大 | △ 點陣寵物偏小（忠於原規格） |
| 035 | [035-isotype.html](https://htmls-ruddy.vercel.app/web/035-isotype.html) | Isotype 圖像統計 | 河口市的一天：60 個人形依 24 小時重新上色 | |
| 036 | [036-film-noir.html](https://htmls-ruddy.vercel.app/web/036-film-noir.html) | 黑色電影 | 《The Last Drop》偵探冒險：線索筆記本、指控需出示證據、多結局 | |
| 037 | [037-pop-comic.html](https://htmls-ruddy.vercel.app/web/037-pop-comic.html) | 普普漫畫 | True Peril Comics：每次選擇彈出新一格，4 個結局 | |
| 038 | [038-raygun-grunge.html](https://htmls-ruddy.vercel.app/web/038-raygun-grunge.html) | 90s 解構 grunge | CHLORINE PONY 專訪：字母錯置疊印、游標推開文字、Remix 重排 | △ 手機首屏比桌機保守 |
| 039 | [039-neo-brutal.html](https://htmls-ruddy.vercel.app/web/039-neo-brutal.html) | 新粗獷 | 趕稿看板 Kanban：「趕稿看板 26」放大成佔滿首屏的巨字海報，三欄看板滿寬排開；硬陰影、拖曳換欄、WIP 上限警示、完成蓋章 | |
| 040 | [040-aurora-breathe.html](https://htmls-ruddy.vercel.app/web/040-aurora-breathe.html) | 極光冥想 | 4-7-8 呼吸：極光 Canvas、有機光球、音量隨呼吸起伏 | |
| 041 | [041-typewriter-ascii.html](https://htmls-ruddy.vercel.app/web/041-typewriter-ascii.html) | 打字機 ASCII | 六張會自己「打」出來的 ASCII 圖：滑架、墨色不均、打字聲 | |
| 042 | [042-taiwan-maximal.html](https://htmls-ruddy.vercel.app/web/042-taiwan-maximal.html) | 台味極繁 | 好運來夜市：茄芷袋格紋、搖晃手寫招牌、食物拋進袋子、叫號 | |
| 043 | [043-ink-wash.html](https://htmls-ruddy.vercel.app/web/043-ink-wash.html) | 水墨 | 程序山水手卷：直排詩、墨暈、點紙滴墨、縮圖導覽 | |
| 044 | [044-lcars.html](https://htmls-ruddy.vercel.app/web/044-lcars.html) | LCARS 星艦介面 | MERIDIAN OPS：五個頁面、紅黃警報整體換色 | |
| 045 | [045-paper-layers.html](https://htmls-ruddy.vercel.app/web/045-paper-layers.html) | 紙雕層次 | 七層紙雕山谷：四季切換、24 節氣、太陽弧線、季節飄落物 | |
| 046 | [046-claymorphism.html](https://htmls-ruddy.vercel.app/web/046-claymorphism.html) | 黏土風 | 數字果凍島：兒童加減比大小、果凍彈跳、黏土碎片慶祝；右欄的「這一回合」逐題記下算式與是否一次答對 | |
| 047 | [047-e-paper.html](https://htmls-ruddy.vercel.app/web/047-e-paper.html) | 電子紙 | 家用電子紙看板：16 階灰、局部更新殘影、全刷閃爍、FS 抖動插畫 | |
| 048 | [048-word-clock.html](https://htmls-ruddy.vercel.app/web/048-word-clock.html) | 文字時鐘 | 11×10 中文字格報時，精確到分，另會亮「該喝茶了」等提示 | △ 偏靜態，互動少 |
| 049 | [049-radial-year.html](https://htmls-ruddy.vercel.app/web/049-radial-year.html) | 放射狀年曆 | 365 天放射熱度圖：圓圖置中成為唯一主角，標題、資料切換、統計與星期平均收在四角邊註；高亮同週與同星期幾、三組資料 | |
| 050 | [050-atomic-age.html](https://htmls-ruddy.vercel.app/web/050-atomic-age.html) | 50 年代原子時代 | Atomic Holidays 太空旅行社：航線圖、算票價、登機證、theremin 音效 | |
| 051 | [051-sport-bold.html](https://htmls-ruddy.vercel.app/web/051-sport-bold.html) | 運動品牌 | VELOX 配速計算器：速度線、三種計算模式、完賽預測 | |
| 052 | [052-tarot.html](https://htmls-ruddy.vercel.app/web/052-tarot.html) | 神秘塔羅 | The Hollow Moon：22 張自繪大阿爾克那、3D 翻牌、逆位 | |
| 053 | [053-temple.html](https://htmls-ruddy.vercel.app/web/053-temple.html) | 台灣廟宇 | 天恩宮擲筊求籤：聖筊、笑筊、陰筊照傳統規則，12 首原創籤詩 | |
| 054 | [054-geocities.html](https://htmls-ruddy.vercel.app/web/054-geocities.html) | 1996 個人首頁 | Dave's Cyber Corner：跑馬燈、計數器、WebRing、留言板 | |
| 055 | [055-holo-card.html](https://htmls-ruddy.vercel.app/web/055-holo-card.html) | 全息卡 | NEON FAUNA：6 種閃膜、3D 傾斜、可放大翻面 | |
| 056 | [056-topographic.html](https://htmls-ruddy.vercel.app/web/056-topographic.html) | 等高線 | 霧稜山區路線規劃：marching squares 等高線、即時海拔剖面 | |
| 057 | [057-bluenote.html](https://htmls-ruddy.vercel.app/web/057-bluenote.html) | 爵士唱片封面 | Blue Hour Records 爵士字體封面工房：巨大數字與字母就是影像，5 種版型、7 組雙色調、黑膠滑出、自訂文字與 SVG 匯出 |  |
| 058 | [058-te-synth.html](https://htmls-ruddy.vercel.app/web/058-te-synth.html) | Teenage Engineering 風 | ku-16 十六步鼓機：6 種合成鼓聲、swing、4 組 pattern | |
| 059 | [059-oscilloscope.html](https://htmls-ruddy.vercel.app/web/059-oscilloscope.html) | 示波器 | Phosphor 59-L：李沙育圖形、磷光餘暉、立體聲 XY | |
| 060 | [060-wes-anderson.html](https://htmls-ruddy.vercel.app/web/060-wes-anderson.html) | 對稱粉彩 | Grand Hotel Alpenrose：中軸對稱立面、電梯開門顯示鑰匙牌 | |
| 061 | [061-letterpress.html](https://htmls-ruddy.vercel.app/web/061-letterpress.html) | 活版印刷 | 名片製作器：壓桿凹印動畫、盲壓、下方反向鉛字排字盤 | |
| 062 | [062-metro-wayfinding.html](https://htmls-ruddy.vercel.app/web/062-metro-wayfinding.html) | 捷運導視 | 潮汐捷運路網：Dijkstra 含轉乘懲罰、導視牌乘車步驟 | △ 手機上路網要在容器內左右滑 |
| 063 | [063-split-flap.html](https://htmls-ruddy.vercel.app/web/063-split-flap.html) | 翻牌看板 | 機場出境看板：真實上下半片翻轉、航班狀態推進、喀喀聲 | |
| 064 | [064-thermal-receipt.html](https://htmls-ruddy.vercel.app/web/064-thermal-receipt.html) | 熱感收據 | 人生便利商店：一天共 1,440 分鐘的電子發票證明聯，可撕下 | |
| 065 | [065-treasure-map.html](https://htmls-ruddy.vercel.app/web/065-treasure-map.html) | 藏寶圖 | The Isle of Mild Regret：照線索點地標、紅虛線路徑、開寶箱 | △ 手機上地名約 10px |
| 066 | [066-lava-lamp.html](https://htmls-ruddy.vercel.app/web/066-lava-lamp.html) | 熔岩燈 | Groovatron：metaball 加熱上升、胡桃木控制台、五種 mood | |
| 067 | [067-glitch.html](https://htmls-ruddy.vercel.app/web/067-glitch.html) | 故障藝術 | CORRUPT.EXE：hex 編輯器當控制台，位元組驅動 pixel sort、datamosh | |
| 068 | [068-braun.html](https://htmls-ruddy.vercel.app/web/068-braun.html) | Dieter Rams / Braun | WENIGER RT 66 可運算計算機，搭配設計十原則並標示對應部位 | |
| 069 | [069-nbody.html](https://htmls-ruddy.vercel.app/web/069-nbody.html) | 重力沙盒 | leapfrog 三體 8 字編舞、拖曳發射看預測軌跡、能量漂移遙測 | |
| 070 | [070-petri-dish.html](https://htmls-ruddy.vercel.app/web/070-petri-dish.html) | 培養皿生命遊戲 | H&E 染色顯微鏡：物鏡轉盤、對焦模糊、四種規則、期刊版面 | |
| 071 | [071-chalkboard.html](https://htmls-ruddy.vercel.app/web/071-chalkboard.html) | 黑板 | 畢氏定理五步驟證明：粉筆逐筆描繪、拖曳頂點、三角形重排 | |
| 072 | [072-stained-glass.html](https://htmls-ruddy.vercel.app/web/072-stained-glass.html) | 彩繪玻璃 | Voronoi 尖拱窗：點擊切出新玻璃、依時辰移動光斑 | |
| 073 | [073-low-poly.html](https://htmls-ruddy.vercel.app/web/073-low-poly.html) | 低多邊形 | Facets at Dusk：夕陽山谷持續飛行、六角控制鈕 | |
| 074 | [074-neon-sign.html](https://htmls-ruddy.vercel.app/web/074-neon-sign.html) | 霓虹招牌 | 中英霓虹招牌產生器：逐管閃爍點亮、故障燈管、電工盒面板 | |
| 075 | [075-kawaii.html](https://htmls-ruddy.vercel.app/web/075-kawaii.html) | 可愛貼紙 | 心情貼紙手帳：12 款模切貼紙可拖拉、拖出手帳即撕掉、喝水紀錄 | |
| 076 | [076-bloomberg.html](https://htmls-ruddy.vercel.app/web/076-bloomberg.html) | 金融終端 | KESTREL 終端機：K 線、五檔、新聞影響股價、指令列 <GO> | |
| 077 | [077-sheet-music.html](https://htmls-ruddy.vercel.app/web/077-sheet-music.html) | 樂譜 | 點五線譜寫曲、自動補休止符、播放游標 | △ 手繪高音譜號不夠精緻，手機上八分音符擠 |
| 078 | [078-girih.html](https://htmls-ruddy.vercel.app/web/078-girih.html) | 伊斯蘭幾何 | Hankin 多邊形接觸法即時算星紋：4 種鋪磚、接觸角量角器 | |
| 079 | [079-weather-poster.html](https://htmls-ruddy.vercel.app/web/079-weather-poster.html) | 天氣海報 | 高嶺市一週四季：巨大溫度滾動、雷雨、霧中數字變模糊、初雪 | |
| 080 | [080-fashion.html](https://htmls-ruddy.vercel.app/web/080-fashion.html) | 時尚大刊 | Maison Vérane 秋冬 lookbook：自繪 Didone 刊頭與大標，帶布料摺痕與縫線的時裝剪影 lookbook，慢速橫移，點選拉出工作室註解 |  |
| 081 | [081-saul-bass.html](https://htmls-ruddy.vercel.app/web/081-saul-bass.html) | 片頭設計 | 《The Man Who Misplaced Tuesday》剪紙片頭：8 張字卡、walking bass | |
| 082 | [082-periodic.html](https://htmls-ruddy.vercel.app/web/082-periodic.html) | 元素週期表 | 118 元素：魚眼放大、三種著色、Bohr 圖、約 60 則短評 | △ 𨧀、鿫 等擴充字可能在某些裝置顯示缺字 |
| 083 | [083-op-art.html](https://htmls-ruddy.vercel.app/web/083-op-art.html) | 歐普藝術 | OPTIKON 四幅：隆起棋盤、波流、摩爾紋、漩渦 | |
| 084 | [084-nasa-worm.html](https://htmls-ruddy.vercel.app/web/084-nasa-worm.html) | 70s NASA 手冊 | ORBITA 任務控制：T– 倒數、T–2:00 自動保留、8 席位 GO/NO-GO | |
| 085 | [085-circus.html](https://htmls-ruddy.vercel.app/web/085-circus.html) | 維多利亞馬戲 | 木活字海報售票亭：燈泡跑馬、£sd 計價、可撕票根 | |
| 086 | [086-deep-sea.html](https://htmls-ruddy.vercel.app/web/086-deep-sea.html) | 深海 | 從海面捲動下潛到 10,935 m：五個水層、15 種真實生物，探照燈自動掃描、側邊水層導覽 | △ 手機上右側水層導覽會蓋住部分生物學名 |
| 087 | [087-star-chart.html](https://htmls-ruddy.vercel.app/web/087-star-chart.html) | 印刷星圖 | 約 170 顆真實亮星的星座盤：恆星時對齊、可切緯度 | △ 低緯度觀測窗小，部分標籤重疊 |
| 088 | [088-graffiti.html](https://htmls-ruddy.vercel.app/web/088-graffiti.html) | 街頭塗鴉 | WALLSPACE 噴漆牆：粒子噴霧、停留會滴流、模板字、Buff 蓋灰 | |
| 089 | [089-tiki.html](https://htmls-ruddy.vercel.app/web/089-tiki.html) | 提基酒吧 | The Leaky Coconut 調酒器：17 種材料分層、辨識 7 款經典酒譜 | |
| 090 | [090-ukiyoe.html](https://htmls-ruddy.vercel.app/web/090-ukiyoe.html) | 浮世繪 | 七十二候木版曆：自動定位今日的候、程序化浮世繪風景 | |
| 091 | [091-dither-3d.html](https://htmls-ruddy.vercel.app/web/091-dither-3d.html) | 1-bit 抖動渲染 | WebGL raymarch 五種 SDF、雙墨 Bayer 抖動，有 CPU 備援 | |
| 092 | [092-advent.html](https://htmls-ruddy.vercel.app/web/092-advent.html) | 降臨曆 | 24 扇 3D 開啟的門：門面拼成一整幅村莊、落雪隨開門變大 | |
| 093 | [093-perfume.html](https://htmls-ruddy.vercel.app/web/093-perfume.html) | 奢華香水 | Minuit Velours：點瓶身噴霧、香調金字塔、8 小時揮發圖 | |
| 094 | [094-fourier.html](https://htmls-ruddy.vercel.app/web/094-fourier.html) | 傅立葉周轉圓 | 隨手畫的線用 DFT 周轉圓重現、圓的數量可調 | |
| 095 | [095-nonogram.html](https://htmls-ruddy.vercel.app/web/095-nonogram.html) | 方格紙鉛筆 | 數織練習簿：4 題，都經 solver 驗證有唯一解，鉛筆塗黑 | △ 手機上 15×15 題的格子只有約 20px |
| 096 | [096-mediterranean.html](https://htmls-ruddy.vercel.app/web/096-mediterranean.html) | 地中海 | Levkí 旅行手記：桌機固定風景與四日行程並排，選取時刻聯動真實太陽公式的光影與地點標記；日照播放、月份切換與減少動態效果 | |
| 097 | [097-lofi-room.html](https://htmls-ruddy.vercel.app/web/097-lofi-room.html) | Lo-fi 房間 | 雨夜房間：點物件切換聲音，合成雨聲、lo-fi 和弦、貓呼嚕 | |
| 098 | [098-xeno-glyph.html](https://htmls-ruddy.vercel.app/web/098-xeno-glyph.html) | 外星語 | XENOLINGUA 解碼器：三種筆畫文法生成字形、直書、傳送音 | |
| 099 | [099-rubik.html](https://htmls-ruddy.vercel.app/web/099-rubik.html) | CSS 3D | 魔術方塊：整數旋轉矩陣驗證排列正確、拖曳旋轉視角、計時 | △ 只能用按鈕或按鍵轉面，不能直接拖貼紙轉 |
| 100 | [100-fireworks.html](https://htmls-ruddy.vercel.app/web/100-fireworks.html) | 煙火終章 | 河岸夜空：9 種煙火，「放一百發」每發標上一件作品的風格名，最後拼出「100」 | |
| 101 | [101-mattpocock-skills.html](https://htmls-ruddy.vercel.app/web/101-mattpocock-skills.html) | AI 學習 · 教學簡報 | mattpocock/skills 教學簡報：13 張投影片走完需求訪談、PRD、任務拆解、TDD、除錯與架構審查 | △ 後加收錄，使用 Google Fonts 外部字型，不符合前 100 件的零外部依賴規則 |
| 102 | [102-your-project-playbooks.html](https://htmls-ruddy.vercel.app/web/102-your-project-playbooks.html) | AI 學習 · 教學簡報 | 〈Starting on Your Own Project〉：在自己的專案啟動 Claude Code 的三套起手劇本（全新專案 / WebForms → Web / WinForms → Web），16 張投影片，版面沿用 101 | △ 同 101，使用 Google Fonts 外部字型 |
| 103 | [103-peach-blossom-spring.html](https://htmls-ruddy.vercel.app/web/103-peach-blossom-spring.html) | 生成藝術 · 互動閱讀 | 〈桃花源記〉全文直式閱讀、逐句白話與註解；匯入真人朗誦及逐句時間戳後隨聲推進六幕程序水墨 | 朗誦音檔與時間戳須由讀者提供；頁面不推估時間 |
| 104 | [104-laptop-studio.html](https://htmls-ruddy.vercel.app/web/104-laptop-studio.html) | 擬物器物 · 3D Mockup | FRAME：上傳、貼上或拖入截圖，置入程序生成的金屬筆電；可調相機、景深、打光與背景，匯出 PNG | Three.js 由 CDN 載入，需連線及 WebGL |
| 105 | [105-sales-crm.html](https://htmls-ruddy.vercel.app/web/105-sales-crm.html) | 專案範例 · 深色業務儀表板 | Northstar Sales CRM：高密度 Companies 表格、案件看板、加權預測、搜尋篩選、新增公司與 CSV 匯出 | 靜態 HTML 互動範例；資料為示意，沒有後端與帳務串接 |
| 106 | [106-courier-rush.html](https://htmls-ruddy.vercel.app/web/106-courier-rush.html) | 遊戲敘事 · 3D 跑酷 | Courier Rush：三線道換道與跳躍、三種障礙、金幣與強化、低多邊形城市；可匯入自己的 GLB 模型 | 使用本地 Three.js 模組，需透過網站伺服器開啟 |
| 107 | [107-arc-brokerage.html](https://htmls-ruddy.vercel.app/web/107-arc-brokerage.html) | 平面排版 · 可操作的券商概念站 | ARC 線上券商概念站：CSS 城市 Hero 與固定導覽列；交易台（走勢圖、市價與限價單、持倉與紀錄）、定期定額試算、產業熱力圖、可排序漲跌榜、帳戶比較與三步驟開戶 | 單檔離線可用；報價與帳戶皆為模擬，示範狀態只存在這個瀏覽器 |
| 108 | [108-last-train.html](https://htmls-ruddy.vercel.app/web/108-last-train.html) | 遊戲敘事 · 3D 波次生存射擊 | 末班車：程序化廢棄地鐵站 FPS，雙武器、雙入口波次、命中率結算與 WebAudio 聲響 | 使用本地 Three.js 模組，需透過網站伺服器開啟；桌機鍵鼠操作 |
| 109 | [109-windward-rail.html](https://htmls-ruddy.vercel.app/web/109-windward-rail.html) | 遊戲敘事 · 火車模擬 | 浮島列車：動力與煞車駕駛、乘客舒適度與小費、平穩連續倍率、機廠整備，以及日間與午夜兩條路線 | 使用本地 Three.js 模組，需透過網站伺服器開啟 |
| 110 | [110-embroidery-studio.html](https://htmls-ruddy.vercel.app/web/110-embroidery-studio.html) | 生成藝術 · 刺繡編輯器 | THREAD：逐像素布料光照、七種幾何針法與六道繡線渲染；針、橡皮擦、平移、復原重做、範本、JSON 與 PNG | 純 Canvas 2D，無外部依賴 |
| 111 | [111-jelly-dice.html](https://htmls-ruddy.vercel.app/web/111-jelly-dice.html) | 創意藝術 · 互動 3D | Jelly Dice：六種果凍口味、1–5 顆骰子、拋擲碰撞與回彈、戳壓及拖曳拉伸 | 使用本地 Three.js 模組，需透過網站伺服器開啟；支援觸控與減少動態效果 |
| 112 | [112-sunport-railway.html](https://htmls-ruddy.vercel.app/web/112-sunport-railway.html) | 遊戲敘事 · 桌上積木鐵道 | Sunport Railway：環線列車、調車場、轉車盤、工業區、港口、車站與小鎮；實體拉桿控制速度與時間，按鈕操作燈光、汽笛、調車 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL |
| 113 | [113-dustbound-frontier.html](https://htmls-ruddy.vercel.app/web/113-dustbound-frontier.html) | 遊戲敘事 · 體素開放世界 | Dustbound Frontier：程序化沙漠峽谷與西部小鎮、動態區塊、挖掘建造、28 位居民、晝夜光照與塵土粒子 | 單檔 HTML；僅 Three.js 由 CDN 載入，需連線及 WebGL |
| 114 | [114-promise-wall.html](https://htmls-ruddy.vercel.app/web/114-promise-wall.html) | 東方在地 · 3D 承諾牆 | 山中留話：山中咖啡館的承諾牆，四種便條材質、貼牆晃動、環繞縮放、點擊細讀及本機保存 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL；內容僅存在本機瀏覽器 |
| 115 | [115-windfield.html](https://htmls-ruddy.vercel.app/web/115-windfield.html) | 介面風格 · 沉浸式草原 | WIND：12 萬株獨立草葉的 shader 風浪、漸層與背光，平滑遠景、天空散射、可調日照風力與阻尼漫遊 | 單檔 HTML；僅 Three.js 由 CDN 載入，需連線及 WebGL2；60fps 為效能目標，依裝置而異 |
| 116 | [116-thockwork-keyboard.html](https://htmls-ruddy.vercel.app/web/116-thockwork-keyboard.html) | 生成藝術 · 客製化 3D 鍵盤 | Thockwork：程序生成每顆鍵帽、軸體與外殼；可選 60／65／75 配列、外殼、配色、鍵帽與軸體，旋轉試打並加入購物車 | 單檔 HTML；Three.js 與 GSAP 由 CDN 載入，需連線及 WebGL；購物車與結帳僅為本機示範，不會扣款或送出資料 |
| 117 | [117-taipei-diorama.html](https://htmls-ruddy.vercel.app/web/117-taipei-diorama.html) | 擬物器物 · 台北 3D 模型 | 掌心之城：台北 101、中正紀念堂、國父紀念館、夜間街廓與盆地山系；拖曳環繞、滾輪縮放與地標聚焦 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL |
| 118 | [118-lamplighter.html](https://htmls-ruddy.vercel.app/web/118-lamplighter.html) | 遊戲敘事 · 第三人稱 3D 動作平台 | 點燈人：先畫主角、場景、介面三張美術規格（art/118/）再實作；霧湖遺跡三區關卡、點亮三座燈台打開月門，影魅巡邏／察覺／蓄力撲擊 AI 與石燈守光彈，三段揮燈連擊、打擊停頓與鏡頭震動，GTAO＋bloom＋色彩分級，Web Audio 合成全部音效 | 單檔 HTML；Three.js 與官方 addons 由 CDN 載入，需連線及 WebGL；內顯自動降畫質 |
| 119 | [119-tetris.html](https://htmls-ruddy.vercel.app/web/119-tetris.html) | 遊戲敘事 · Canvas 俄羅斯方塊 | WELL：10×20 棋盤、七種經典配色方塊、SRS 雙向旋轉與 Wall Kick、Hold 暫存、五格 Next 預覽、硬降與落點預覽；依官方指引計分（消行 100／300／500／800、T-Spin、Back-to-Back、連消），每 10 行升級加速 | 單檔 HTML，不載入外部資源；最高分存在本機瀏覽器 |
| 120 | [120-qingming-scroll.html](https://htmls-ruddy.vercel.app/web/120-qingming-scroll.html) | 擬物器物 · 3D 清明上河圖 | 汴河長卷：沿汴河展卷橫移的立體長卷，郊野、漕運、虹橋、城郭四章與章節時間軸；絹本水墨後製、四時辰光影、合成市聲水聲風聲 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL；環境音為 WebAudio 即時合成，需點擊開啟 |
| 121 | [121-camera-blueprint.html](https://htmls-ruddy.vercel.app/web/121-camera-blueprint.html) | 生成藝術 · 程式渲染產品動畫 | R6 旁軸相機藍圖拆解：正視圖描邊 → 轉 3/4 視角 → 鏡頭、快門簾、捲片軸、觀景窗、底片室依序爆炸並標註 → 收回成尺寸標註正視圖；零件、標註與時間軸都是可編輯的 JSON | 純 Canvas 2D，不載入外部資源；同一幀號必得同一份顯示清單（畫面附雜湊）；以 WebCodecs 逐幀編碼合成 60fps MP4，或輸出 PNG 幀序列 ZIP，需新版 Chrome／Edge |
| 124 | [124-ashwing.html](https://htmls-ruddy.vercel.app/web/124-ashwing.html) | 遊戲敘事 · 3D 軌道射擊 | 灰燼之翼 ASHWING：致敬《鐵甲飛龍》的第一關，騎龍沿固定航道從赤砂峽谷穿過沉沒神殿；前右後左 360 度視角切換、按住掃過多重鎖定追蹤雷射、畫面內閃避彈幕，敵人依 100 BPM 小節與地形起伏編排，終點是翼核 → 脊核 → 眼三階段的頭目骸天鯨；D Hijaz 民族風管弦樂與音效皆為 WebAudio 即時合成 | 單檔 HTML；Three.js 由 CDN 載入（失敗時改用站內 vendor），需 WebGL；桌機鍵鼠或手機觸控 |
| 125 | [125-spacewalk.html](https://htmls-ruddy.vercel.app/web/125-spacewalk.html) | 介面風格 · AI 科普個人品牌 | 太空漫步：人物主視覺與大字宣言、AI Agent／Vibe Coding／AI Tools 白話名詞索引、四階段學習路線、個人介紹與可複製的第一個提問 | 單頁 HTML 搭配兩張站內原創插畫；不需外部程式庫 |
| 126 | [126-star-vault.html](https://htmls-ruddy.vercel.app/web/126-star-vault.html) | 遊戲敘事 · 3D 轉蛋抽卡 | 星匣 STAR VAULT：程序化星匣與角色，球體滾落、稀有光芒預告、蓄力停頓與破殼揭曉；單抽十連、漸進保底與角色圖鑑 | 需 WebGL；Three.js 從 CDN 載入，失敗時改用站內 `vendor/`；抽卡進度存在本機瀏覽器 |
| 127 | [127-jade-table.html](https://htmls-ruddy.vercel.app/web/127-jade-table.html) | 遊戲敘事 · 3D 十六張麻將 | 青雀 JADE TABLE：真人好友房或三位 AI；144 張吃碰槓胡、補花、宣告聽牌、逐項計台、30 秒重連與 Web Audio 音效 | 需 HTTP 與 WebGL；共用規則引擎；真人房由 Vercel WebSocket＋Neon 管理，詳見 [後端部署說明](server/jade-table/README.md) |
| 128 | [128-fold-2048.html](https://htmls-ruddy.vercel.app/web/128-fold-2048.html) | 遊戲敘事 · 極簡數字益智 | FOLD 2048：滑動或方向鍵合併數字；五種棋盤模式、單步撤銷、自動儲存、最佳分數與勝負結算，手機直向也能遊玩 | 單檔 HTML，不載入外部資源；進度與最佳分數存在本機瀏覽器 |
| 129 | [129-orbit-os.html](https://htmls-ruddy.vercel.app/web/129-orbit-os.html) | 介面風格 · macOS 風格桌面系統 | ORBIT OS：可拖曳、縮放與最小化視窗；共用檔案資料的 Finder 和終端機、離線瀏覽器、可換主題、Web Audio 合成音樂，以及可挖掘建造的體素遊戲 | 單檔 HTML，無外部資源；檔案與遊戲進度保存在本機瀏覽器 |
| 130 | [130-snake-aware.html](https://htmls-ruddy.vercel.app/web/130-snake-aware.html) | 遊戲敘事 · 自覺貪食蛇 | THE SNAKE KNOWS：方向鍵、WASD、觸控滑動或螢幕按鍵操作；蛇會評論玩家，分數提高後畫面故障、穿牆、反向操作、點心移位，並與玩家談判規則 | 單檔 HTML，不載入外部資源；最佳分數存在本機瀏覽器 |
| 131 | [131-wildling-trail.html](https://htmls-ruddy.vercel.app/web/131-wildling-trail.html) | 遊戲敘事 · 原創怪獸收集 RPG | 野靈旅記 WILDLING TRAIL：四張相連的格子地圖、8 種原創怪獸、12 個招式與三屬性相剋；三選一初始夥伴，遭遇、戰鬥、捕捉、升級學招與兩階段進化，擊敗守林人取得資格後挑戰場主，通關後可以自由探索 | 由 `games/131-wildling-trail/` 建置成單檔 HTML，不載入外部資源；存檔在本機瀏覽器 |
| 132 | [132-reusable-rocket-factory.html](https://htmls-ruddy.vercel.app/web/132-reusable-rocket-factory.html) | 遊戲敘事 · 3D 火箭製造與回收模擬 | 回航工廠：四座有限產能工站、獨立工人與三台 AGV；火箭總裝、出廠、發射、級間分離、回收與整備串成可重複循環；自由／跟隨鏡頭與 1／4／16 倍速 | 需 WebGL；網站透過本地 Three.js 模組載入；以 HTTP 開啟，直接開啟 HTML 檔時改用 CDN |
| 133 | [133-halion.html](https://htmls-ruddy.vercel.app/web/133-halion.html) | 品牌頁面 · Three.js 腦機晶片發表頁 | HALION：冷藍玻璃封裝與中央線圈；六段捲動區間依序拆解三層主結構和內部件，零件到位後顯示說明，結尾重新合攏 | 需 WebGL；手機降低幾何細節與解析度；不支援 WebGL 時顯示靜態晶片，本站透過本地 Three.js 模組載入 |
| 134 | [134-golden-retriever.html](https://htmls-ruddy.vercel.app/web/134-golden-retriever.html) | 擬物器物 · Blender 黃金獵犬建模紀錄 | 由空場景建構站立犬隻，依序展示大塊造型、融合細分、材質與三點光；提供 1500×1250 渲染圖與 Blender 原始檔 | BlenderMCP 建模；體素融合、細分曲面與互動模式 Sculpt 平滑修順接縫 |
| 135 | [135-nagoya-terrain.html](https://htmls-ruddy.vercel.app/web/135-nagoya-terrain.html) | 資料科學 · 真實地理資料地形標本 | 名古屋，一公里：國土地理院 DEM、空照與 PLATEAU 建物／道路，圓盤地景分層檢視、輪廓比對與含來源存圖 | 附 Blender、GLB 與重跑腳本；LOD1 建物、真實公尺尺度，需 HTTP / WebGL |
| 136 | [136-zork.html](https://htmls-ruddy.vercel.app/web/136-zork.html) | 遊戲敘事 · 第一人稱 3D 動作冒險 | Zork：帝國的餘燼。1977 年 285 分版本的 80 房間、11 寶物與原始謎題，程序化森林／地下城、即時戰鬥、視線 AI、提燈及安全點 | 本地 Three.js；HTTP／WebGL；localStorage 存檔；[原始碼、驗證與改編差異](games/136-zork/README.md) |
| 137 | [137-notion-workspace.html](https://htmls-ruddy.vercel.app/web/137-notion-workspace.html) | Notion 風格工作區 | 留白工作室：巢狀頁面樹與區塊編輯、slash 指令、拖曳／鍵盤排序、表格／看板資料庫、本機保存、復原與 Markdown 匯出 | |
| 138 | [138-bloom-desktop.html](https://htmls-ruddy.vercel.app/web/138-bloom-desktop.html) | Windows 11 風格 Web 桌面 | Bloom：拖曳縮放視窗、共用檔案系統與終端機、離線瀏覽器、主題、合成音樂、可挖掘建造的 WebGL 體素遊戲；單檔零外部資源 | |
| 139 | [139-tideborn-island.html](web/139-tideborn-island.html) | 程序化 3D 海島 | 潮生島：中央高地、環島沙灘、礁島、放射狀路網；大小／高度／種子可調；五種職業的骨架 glTF 村民、尋路作息、交談搬貨交易、資源任務、製作市集、等級建築與本機存檔；使用本地 Three.js，需 HTTP 伺服器 | |
| 140 | [140-cumulus-line.html](https://htmls-ruddy.vercel.app/web/140-cumulus-line.html) | 遊戲敘事 · 水彩浮島電車模擬 | 浮雲鐵道：駕駛室視角開電車跨越浮島與海上拱橋；P5～B7／EB 一桿式主控制器、馬達響應與坡度、以急動度與側向加速度換算舒適度並換成小費、茶杯液面即時傾斜、平穩連續倍率與中斷後的平衡提示、定點停車；雲梯線與星汐線兩條路線、晴日／午夜光照（車窗暖光、島上燈火、螢火與燈塔）、機廠小鎮整備馬達／懸吊／加掛客車與塗裝；水彩後製著色器 | 使用本地 Three.js 模組，需透過網站伺服器開啟（直接開檔改由 CDN 載入）；需 WebGL |
| 141 | [141-between-worlds.html](web/141-between-worlds.html) | 生成藝術 · 光點變形 | 萬物之間：12,000 粒光在星系、遞迴樹、蝴蝶與自訂文字之間平滑變形；指尖擾動、合成和弦、暫停、PNG 明信片與減少動態效果支援；純 Canvas，無外部依賴 | |
| 142 | [142-aurielle-castle.html](https://htmls-ruddy.vercel.app/web/142-aurielle-castle.html) | 創意藝術 · 童話建築 | 曦光城堡：完整程序化 3D 城堡、對稱塔群、藍色尖頂、拱窗與陽台；建築典藏版面、可中斷的四視角鏡頭、自由環繞、日夜漸變與 glTF 材質模型下載 | 本地 Three.js；需 HTTP 伺服器與 WebGL |
| 144 | [144-finance-passbook.html](https://htmls-ruddy.vercel.app/web/144-finance-passbook.html) | 專案範例 · 存摺帳頁 · 財務總覽 | 存摺：個人財務、企業、新創三本帳：現金餘額、收入、支出、利潤與淨現金流量，每月收支、預算對比實際、支出明細與附結餘的交易明細；期間與分類篩選，CSV 範本下載、匯入替換與匯出 | CSV 匯入替換為自己的帳；匯入的帳只存在瀏覽器本機 |
| 145 | [145-pnl-bridge.html](https://htmls-ruddy.vercel.app/web/145-pnl-bridge.html) | 專案範例 · 損益瀑布 · 側置損益表 | 損益橋：咖啡連鎖、SaaS、家具製造三種業務：從營收一路扣到淨利的損益橋，每根柱子正下方對齊損益表數字；本月對上月、實際對預算的正負差異，毛利率、淨利率與可點選換月的 12 個月走勢 | 靜態 HTML 互動範例；資料為示意 |
| 146 | [146-cashflow-reservoir.html](https://htmls-ruddy.vercel.app/web/146-cashflow-reservoir.html) | 專案範例 · 水庫剖面 · 現金流預測 | 水位：企業與個人兩種現金流：期初、流入、營運、債務、投資、稅費、其它流出到期末的水位圖與流向圖；3 個月預測、最大現金消耗項，預測跌破可拖曳的最低現金水位線時即時預警 | 靜態 HTML 互動範例；資料為示意 |
| 147 | [147-budget-envelopes.html](https://htmls-ruddy.vercel.app/web/147-budget-envelopes.html) | 專案範例 · 信封理財 · 郵戳狀態 | 信封：家庭、行銷部門、民宿三組分類，一類一只信封：預算、實際、差異金額與百分比、剩餘預算，郵戳標示正常／注意／超支；拖曳日期看月末預測、點金額改預算，總使用率、超支排行與每月趨勢 | 靜態 HTML 互動範例；預算調整只存在瀏覽器本機 |
| 148 | [148-cfo-runway.html](https://htmls-ruddy.vercel.app/web/148-cfo-runway.html) | 專案範例 · 機場跑道 · 高階主管月報 | 跑道：三家公司的單頁經營月報：可支撐月數畫成跑道與現金耗盡停止線，營運費用情境滑桿即時移動；十項指標對比上月、上季與目標，CFO 總結依數據自動列出變好、變差與需要關注 | 靜態 HTML 互動範例；資料為示意 |
| 149 | [149-powers-of-ten.html](https://htmls-ruddy.vercel.app/web/149-powers-of-ten.html) | 資料科學 · 62 個數量級連續縮放 | 一指之間：從大安森林公園花布上孩子的掌心出發，往外經臺北盆地、臺灣、地球、今日真實行星位置、歐特雲、銀河、本星系群、拉尼亞凱亞到可觀測宇宙邊緣；往裡經掌紋、角質層、細胞、染色質、DNA、G·C 鹼基對、碳原子電子雲、原子核與夸克，直到普朗克長度。視野與光穿越時間即時換算、自動旅程、尺規拖曳、WebAudio 刻度聲；全部即時繪製，零外部資源 | |
| 150 | [150-brick-rts.html](web/150-brick-rts.html) | 積木即時戰略 · 開發中 | 磚築紀元：積木版世紀帝國式全畫面遊戲，在隨機出生的 32×32 地圖上採集、建造、耕田、生產、升時代，與電腦對手打完整一局。原始碼與操作見 [README](games/150-brick-rts/README.md) | |
| 151 | [151-bike-configurator.html](https://htmls-ruddy.vercel.app/web/151-bike-configurator.html) | 品牌頁面 · 3D 客製化電商 | Crosswind R：程序化生成、依真實比例的公路車（每根輻條、每節鏈條）：即時換配色、輪組、輪胎、傳動、把手與坐墊，踩踏帶動齒盤、鏈條與後輪，含即時報價與購物車結帳 | 單檔 HTML；Three.js 與 GSAP 由 CDN 載入，需連線及 WebGL；購物車與結帳僅為本機示範，不會送出資料 |
| 152 | [152-tideline-board.html](https://htmls-ruddy.vercel.app/web/152-tideline-board.html) | 介面風格 · 產品微互動元件板 | 潮班 TIDELINE：虛構澎湖渡輪公司的五格元件板。行程膠囊在船班卡、取消確認與退款收據之間變形；航線圖描繪航跡、港口輪播與票根；港口側欄旗標滑動；延誤通知堆疊展開與關閉；同行分票扇形寄出。每格自動示範，碰到就交給使用者 | 版面與動態參考 Inspora 的 Product 分類；班表與票價為示意 |
| 153 | [153-slipstream-gp.html](https://htmls-ruddy.vercel.app/web/153-slipstream-gp.html) | 遊戲敘事 · Q 版 3D 卡丁車 | 尾流大獎賽：四條賽道、大獎賽／計時賽／氣球大戰三種模式、八位原創車手，跳躍甩尾迷你加速、七種道具、尾流吸附與依賽道即時合成的配樂 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL；模型、貼圖、音樂與音效全部由程式生成；計時紀錄與幽靈車存在本機 |
| 154 | [154-fixer-editor.html](https://htmls-ruddy.vercel.app/web/154-fixer-editor.html) | 工具產生器 · 點陣影像編輯器 | 定影：Photoshop 式介面的瀏覽器修圖軟體。圖層、群組、遮色片與五種調整圖層，21 種混合模式在 WebGL2 以 16 位元浮點即時合成；選取、壓力筆刷、仿製印章、修復筆刷、漸層、文字、裁切、濾鏡與歷史紀錄；PSD 讀寫、PNG／JPG／WebP 匯出；頁面附零依賴的 Node MCP 橋接程式，Claude Code／Codex 可用自然語言操作開著的文件 | △ 單檔 HTML，需要 WebGL2；PSD 只支援 8 位元 RGB／灰階，寫入時文字與調整圖層烘焙成像素圖層；尚無自由變形與剪裁遮色片；MCP 需在本機執行頁面提供的橋接程式 |
| 155 | [155-tally-crm.html](https://htmls-ruddy.vercel.app/web/155-tally-crm.html) | 專案範例 · 概念稿風格 · 完整 CRM | 劃記 TALLY CRM：虛構感測器公司的業務 CRM，儀表板、聯絡人、公司（表格／卡片、組織圖）、交易 pipeline（七階段看板拖曳、報價品項、成交入帳動畫）、任務（自然語言快速新增、週曆拖曳改期）、活動紀錄（熱度格、排行）六頁共用一份種子固定、日期相對今天的示範資料；往來次數以正字劃記呈現，⌘K 命令面板、快捷鍵、可復原的操作、深淺色與手機版 | 靜態 HTML 互動範例；資料為示意，修改存在瀏覽器 localStorage；原始碼在 `games/155-tally-crm/`，`node games/155-tally-crm/build.mjs` 內嵌成單檔 |
| 156 | [156-one-shape.html](https://htmls-ruddy.vercel.app/web/156-one-shape.html) | 介面風格 · 單一形狀 UI 動態短片 | 一形 ONE SHAPE：120 BPM、7 小節 28 拍的無縫循環，同一個形狀依序變成按鈕、載入、動態島、播放器（播放／暫停變形、拖曳進度）、會被拉長的音量滑桿、開關、前後緣各走一條彈簧的液態分頁、自己畫出的圖表與 tooltip、可篩選的 ⌘K 命令面板與通知，再回到按鈕。所有畫面由 seek(t) 以閉式彈簧解計算，可逐拍拖曳時間軸 | 字型 Geist 從 Google Fonts 載入；聲音為 WebAudio 合成，需點「聲音」才會播放 |
| 157 | [157-lucid-ledger.html](https://htmls-ruddy.vercel.app/web/157-lucid-ledger.html) | 專案範例 · AI 理財工作台 | 澄帳：九個畫面（總覽、洞察、助理、現金流、交易、帳戶、固定支出、投資、目標）全部從同一份種子固定的虛構帳本推導。帳戶間轉帳、暫停訂閱、改分類、拆帳、模擬再平衡、調整目標提撥後，淨資產、現金預測、洞察與目標進度一起重算；助理以本機規則回答「負擔得起嗎」「餐飲為何變多」等問題並列出算式，答案可直接建立目標；⌘K 搜尋、⌘J 提問，全覽模式把九個畫面縮成九宮格並從格子放大回去 | 單檔 HTML，零外部資源；帳本、股價與機構名稱皆為虛構，不是投資建議 |
| 158 | [158-lens-lab.html](https://htmls-ruddy.vercel.app/web/158-lens-lab.html) | 資料科學 · 3D 光學實驗台 | 鏡頭實驗室 The Plane of Focus：暗色實驗室裡的光學滑軌，一支剖開的 24–70mm 變焦鏡頭（七片玻璃、兩群組、七葉光圈）以近軸光線追跡畫出前景、主體、背景三束光的折射，光點沿光路流動；拖控制環或直接拖 3D 鏡頭上的對焦環，前群沿光軸移動。右側 1:16 玻璃箱微縮場景（燈籠、小木屋、樹林、遠山）立著清晰平面與景深範圍，從鏡頭位置即時渲染的照片依景深公式逐像素做圓盤模糊，可開對焦峰值；牆上三張卡片即時顯示每束光匯聚在感光元件前後，快照膠卷可套回設定。下方有精確 2D 剖面、模糊圓 V 形圖與即時驗算（薄透鏡公式、牛頓式、景深近遠界、公式對追跡） | |
| 159 | [159-antikythera.html](https://htmls-ruddy.vercel.app/web/159-antikythera.html) | 遊戲敘事 · 3D 潛水打撈與齒輪復原 | 沉星機：以 1900 年安提基特拉沉船的發現為靈感。從採海綿船旁穿 1900 年代銅頭盔潛水服，以第三人稱潛入 45 公尺深的沉船（海面波浪、焦散、光束、海草、紅柳珊瑚與魚群），在底時內撥開沙子撈起鏽塊；回到工作台刷掉鏽層讀出齒數，依板上孔距刻的齒數和與目標齒輪比把五組齒輪（依 Freeth 等人的復原齒數）裝回去，誘餌組合會頂死或讓指針對不上天空。每裝對一組就能轉曲柄預測：夏至時的太陽、新月、滿月（銷槽機構造成的月亮快慢）、默冬週期與奧林匹克四年盤、沙羅盤上的日食；天空以現代天文公式推算對照；組好的機械是油燈下的立體木盒，正面刻度盤、背面兩個螺旋盤與側面曲柄都能轉 | 單檔 HTML；Three.js 由 CDN 載入，需 WebGL 2，載入失敗時退回平面版；島嶼、海面、潛水夫、青銅材質、金屬聲與豎琴配樂全部即時程序生成 |
| 160 | [160-next-token.html](https://htmls-ruddy.vercel.app/web/160-next-token.html) | 生成藝術 · 一句話譜成的即時影音 demo | 下一個字：輸入的句子就是樂譜，每個字依字碼與位置得到一個音、落在重拍優先的八分音符格位，雜湊決定和聲進行、鏡頭路徑與碎形參數。2 分 30 秒、120 BPM 的 demoscene 式短片：黑色珍珠上隨鐘聲擴散的光環、節點與連桿組成的晶格隨琶音逐格點亮、哥德式中殿的體積光與踩在大鼓上的地面光脈衝、黃昏海面上旋律唱到哪個字就升起一盞燈、Apollonian 碎形在鼓點上呼吸，最後收回一個光點。可拖曳時間軸、暫停、換一句話重譜 | 單檔 HTML，零外部資源；WebGL2 光線步進（片段著色器 + 泛光後製），配樂以 Web Worker 逐樣本合成（PolyBLEP 鋸齒波、狀態變數濾波、Freeverb、乒乓延遲、側鏈壓縮）；需要 WebGL2 |
| 161 | [161-jaipur-varanasi.html](https://htmls-ruddy.vercel.app/web/161-jaipur-varanasi.html) | 東方在地 · 第一人稱 3D 城市漫步 | 兩城漫步：用 WASD 或觸控搖桿走進兩座印度城市。齋浦爾是午後的粉紅舊城：拱廊市集、五層蜂巢立面的風之宮、階梯可以爬到頂的簡塔曼塔巨型日晷、桑加內里城門，廣場鴿群會被走近的人驚飛，嘟嘟車被擋住會按喇叭，天上有風箏。瓦拉納西是黃昏的恆河河階：五位祭司在木台上舉燈晚禱、觀眾坐滿台階、河燈順流漂走，曼瑪迪爾宮屋頂的天文台和齋浦爾那座出自同一位國王；河階後面是窄巷，藏著金頂神廟與茶攤。建築、人群、船與天空全由程式生成，鈴聲、坦布拉琴、海螺、喇叭與鴿子拍翅由 WebAudio 即時合成；走訪地標會記在本機 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL |
| 162 | [162-last-train-atlas.html](https://htmls-ruddy.vercel.app/web/162-last-train-atlas.html) | 資料科學 · 末班時刻 3D 路網 | 終電地圖：東京 97 條鐵路、1,127 個車站的末班車 3D 地圖，構想來自 X 上 @MatoToushi 的「東京終電マップ」影片，版面與互動重新設計。「時刻高度」模式裡每站的高度就是它最後一班車離站的時刻，拖動 21:30–01:30 的時間軸，一片時間水位跟著上升，被淹過的站就熄燈，路線上最亮最粗的一截是正在跑的末班車；另有「業者樓層」與「平面」兩種排法、晝夜配色、平日／週末假日切換（時間軸上方是每 5 分鐘收班路線數的分布）。側欄可依業者、最早或最晚收班排序，搜尋站名會列出經過該站各線的末班；點路線看整條線逐站熄燈的時刻。路線、座標與時刻表取自 Mini Tokyo 3D（MIT，原始來源為 ODPT），每站末班由時刻表推算，是某一版公開資料的摘要而非官方時刻，可能已改點 | 單檔 HTML；Three.js 由 CDN 載入，需連線及 WebGL；站點資料內嵌約 118 KB |

## 較弱的作品（誠實版）
- 網頁作品目前沒有標 ⚠ 的。原本的 7 件都已照改進方向重做：007 改成雨夜窗景，玻璃溫控透鏡真實折射窗外燈火（Safari 可能看不到折射，標為 △）；024 改成整頁終端 session 加上可核可的修正計畫；022 改用自繪 SVG 骨架字，粗細、寬窄、斜度真正連續變化；029 改用自繪字形網格變形填滿燈泡輪廓；057 改走純字體封面，字本身就是影像；080 自繪 Didone 刊頭與大標；086 加入探照燈自動掃描與水層導覽（手機上導覽會遮到部分學名，標為 △）。

## 共通限制
- 只在 Windows + Chrome 上實測。macOS / iOS 會退到後備字型，字寬與截圖不同。
- 聲音依瀏覽器規定要點擊後才會啟動。驗收時 headless 瀏覽器是靜音的，**音效沒有經過人耳驗證**。
- 部分作品會把狀態存進 localStorage（例如 012、031、033、039、075、092、095），重開時會看到上次的狀態。


## 103 個手機 App 原型

每件都是 `app/` 下可單獨開啟的 HTML，使用 inline CSS/JS，圖像與聲音由程式生成；完整的風格、導覽、配色、字體與撞型規劃見 [APP-DIRECTIONS.md](APP-DIRECTIONS.md)。

**App 驗收**：103 件均在 macOS headless Chromium 的 375×667 與 1440×900 尺寸檢查過，沒有頁面例外、console error、外部請求或水平溢出；五件補完作品另驗證主要操作，QR 圖已用瀏覽器 QR 解碼器確認可掃描。聲音只檢查啟動與停止，未做真人聽感評估。

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
| 014 | [014-drum-alarm.html](app/014-drum-alarm.html) | 眠：睡眠追蹤＋鬧鐘；深夜墨綠、iOS 滾筒選擇器 | 睡眠圖、恢復預報（睡眠債與建議就寢時間）、智慧鬧鐘滾筒、白噪音混音器（WebAudio 雨聲／棕噪音） |  |
| 015 | [015-clay-water.html](app/015-clay-water.html) | 水水：喝水紀錄；黏土風：果凍按鈕、可晃動的水瓶 | 一鍵加水、自訂杯量、每日目標、歷史 |  |
| 016 | [016-textile-cycle.html](app/016-textile-cycle.html) | 月環：週期追蹤；北歐織品印花色塊 | 轉動選日、記錄症狀、預測、月曆 |  |
| 017 | [017-asphalt-run.html](app/017-asphalt-run.html) | PACE：跑步紀錄；運動雜誌：粗斜體、等高線地圖 | 模擬跑步、分段、路線回放、紀錄清單 |  |
| 018 | [018-sumi-yoga.html](app/018-sumi-yoga.html) | 伸展：瑜伽伸展引導；侘寂水墨線條人形 | 引導計時、呼吸圈、拖曳排序自訂序列 |  |
| 019 | [019-zen-garden.html](app/019-zen-garden.html) | 枯山水：冥想呼吸；枯山水耙沙 | 手指耙沙、方形呼吸引導、計時、紀錄 |  |
| 020 | [020-konbini-nutrition.html](app/020-konbini-nutrition.html) | 食記：飲食營養紀錄；日本超商包裝：粗色帶、大字 | 模擬掃描、搜尋食物、三大營養素環、刪除 |  |
| 021 | [021-salmon-stocks.html](app/021-salmon-stocks.html) | 盤後：股票看盤；財經報紙鮭魚粉紙 | K 線圖拖曳檢視、自選股新增刪除、下單抽屜 |  |
| 022 | [022-receipt-split.html](app/022-receipt-split.html) | 拆帳：分帳；感熱紙收據：鋸齒邊、虛線 | 新增人、品項拖給人、自動結算誰欠誰、收款訊息一鍵複製或分享並蓋「已傳」 |  |
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
| 041 | [041-papercut-chat.html](app/041-papercut-chat.html) | 紙訊：通訊；剪紙貼圖、柿橘與墨 | 傳訊、貼圖、語音波形錄製模擬、反應、引用回覆紙條、悄悄送 |  |
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
| 061 | [061-wood-maze.html](app/061-wood-maze.html) | 木迷宮：重力迷宮；擬物木盤鋼珠 | 傾斜木盤滾鋼珠，三關逐步教會毛氈減速、蠟面滑行、移動閘門與彈簧反彈，計時 | △ 機關完整，但只有三關，玩完就沒有新內容 |
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
| 073 | [073-mip-cycling.html](app/073-mip-cycling.html) | 碼錶：單車碼錶；反射式 LCD 高對比 | 速度、踏頻、心率區、圈數、爬坡、訓練負荷點陣（TRIMP、能量、標準化功率、恢復時間） |  |
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
| 089 | [089-swiss-calendar.html](app/089-swiss-calendar.html) | 曆：行事曆；瑞士字體日曆：週日紅 | 月週日從選取日縮放轉場、只展開目前檢視的切換鈕、拖曳建立事件、時間軸拖曳與改長度、分類、刪除 |  |
| 090 | [090-fandeck-colors.html](app/090-fandeck-colors.html) | 色票：配色工具；色票扇形 | 和諧配色、對比檢查、存色盤 |  |
| 091 | [091-strobe-tuner.html](app/091-strobe-tuner.html) | 調音：樂器調音器；復古頻閃調音器 | 參考音、模擬偵測、指針、樂器 |  |
| 092 | [092-signal-lamp.html](app/092-signal-lamp.html) | 燈語：摩斯電碼；航海信號燈：黃銅、船海軍藍 | 文字轉摩斯、敲擊輸入、SOS、聲音 |  |
| 093 | [093-kippu-phrases.html](app/093-kippu-phrases.html) | 旅日會話：旅行會話卡；日本鐵道車票（切符）地紋 | 情境會話、朗讀、收藏、放大卡 |  |
| 094 | [094-luggage-packing.html](app/094-luggage-packing.html) | 行李：打包清單；復古行李貼紙 | 行李吊牌往上拖進皮箱、清單勾選、範本、新增、依目的地天氣快照建議 | △ 天氣是固定日期的離線快照，過期後只能手動選情境 |
| 095 | [095-illuminated-dice.html](app/095-illuminated-dice.html) | 羊皮骰：TRPG 骰子；泥金手抄本 | d4–d20、優劣勢、歷史、角色卡 |  |
| 096 | [096-field-compass.html](app/096-field-compass.html) | 野戰羅盤：指南針／水平儀；軍用野戰裝備橄欖綠 | 方位、水平、座標、標記 |  |
| 097 | [097-bruna-baby.html](app/097-bruna-baby.html) | 寶寶日誌：育兒紀錄；米飛兔式粗黑線平塗 | 餵奶／尿布／睡眠計時、時間軸、統計 |  |
| 098 | [098-kusuri-meds.html](app/098-kusuri-meds.html) | 藥袋：用藥提醒；日本藥局藥袋印刷 | 服藥打勾、排程、補藥、提醒 |  |
| 099 | [099-picturebook-carbon.html](app/099-picturebook-carbon.html) | 小樹：碳足跡；童書水彩 | 每日選擇、減碳、樹成長、比較 |  |
| 100 | [100-linen-springboard.html](app/100-linen-springboard.html) | 主畫面：主畫面模擬器；iOS 6 擬物：亞麻布、光澤圖示 | 長按抖動、拖曳排序、刪除、資料夾 |  |
| 101 | [101-sift-digest.html](app/101-sift-digest.html) | 篩 Sift：晨間訊息摘要；陶土粉紙、Athelas 數字、可甩出的摘要卡 | 拖曳甩出（右讀完、左稍後）、狀態膠囊與復原、原文抽屜、稍後重看、結算 |  |
| 102 | [102-tarry-settings.html](app/102-tarry-settings.html) | 等價 Tarry：AI 代買助理的帳戶設定；菸草棕摘要卡、Superclarendon 數字、石灰泥底 | 七頁共用一張會縮放的摘要卡、每筆上限與 Face ID 門檻滑桿、讓它忘記、預設卡與地址、下載與刪除資料、客服聊天 |  |
| 103 | [103-shunlu-market.html](app/103-shunlu-market.html) | 順路 Shunlu：早市代買的五種不順狀態；牛皮紙價牌、Rockwell 價格、掛牌分頁 | 載入骨架、離線看存下的價格並排隊、空收藏直接加、找不到時四條別的路與盯價、取消訂單說明退款並可復原 |  |

### App 相對較弱的作品
- **061 木迷宮**：毛氈、蠟面、移動閘門與彈簧都已加入並逐關教學，但只有三關，玩完就沒有新內容。
- **094 行李**：皮箱與打包互動完整，但天氣建議來自固定日期的離線快照（09/24–09/26），過期或換成其他目的地後只能手動選情境。

這些 App 的本機狀態保存在瀏覽器 localStorage；清除網站資料會清空紀錄。QR 產生器支援最多 106 UTF-8 bytes。
