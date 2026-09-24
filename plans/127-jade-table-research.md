# 青雀 127：台灣十六張規則研究

研究日期：2026-09-24。用途：替 `127-jade-table.html` 的本機／真人共用引擎建立明確桌規。只研究規則，未修改程式。

## 結論與來源優先序

採「青雀台灣十六張桌規」，主要對照神來也的官方完整台表及玩法說明；不稱為全台唯一正式標準。不同營運商與賽事確實採不同台數，不能把數字與互斥條件跨表拼接。神來也小桃教室與主站同項文字不同時，下方逐項標出，必要的產品裁定不能冒稱原文。

- [神來也現行完整台數表](https://www.gamesofa.com/mj/?op=rule_guide&topic=k)：完整表含半求人、花槓替代關係、地聽、花胡。
- [神來也小桃台數索引](https://www.godgame.com.tw/bigad/event_mj_teach/teach01.html)：已核對原始 HTML 的各台數欄，避免搜尋引擎把表格攤平造成錯位。
- [麻將大師主辦方賽事規則](https://mahjongmasters.com/zh/rules/)：只用於確認存在其他正式賽事口徑，不混入主要台表。其天胡、人胡、字一色及全求等與神來也不同；網頁英文的叫牌優先順序與中文衝突，該站要求以中文為準。
- [明星三缺一官方表](https://www.gametower.com.tw/Games/Freeplay/MJ/Star31/Data/i_ingame-count.aspx)：交叉核對十六張的五面子胡牌、暗刻與宣告聽牌；不採其特殊見花見字、天聽規格。

## 行牌、花牌與槓

144 張：34 種普通牌各四張，加春夏秋冬、梅蘭菊竹八張。莊家補花後有效手牌17張，其餘16張；一般胡型為五面子加一對，槓每組額外多一實體張。七對子、國士無雙並非這套16張桌規。來源：[神來也胡牌與攔胡](https://www.gamesofa.com/mj/?op=rule_guide&t=2g&topic=j)、[台灣大亨官方牌組介紹](https://twgame.net/rule.php)。

吃只限上家棄牌與同花色數牌順子；碰需手中兩枚同牌。明槓為手中三枚接別人棄牌，神來也另禁止槓上家的棄牌。暗槓四枚均自己持有；加槓用第四枚升級既有碰組。暗槓外觀全背面，他家不可知道牌種。棄牌可胡優先，再碰／槓，最後吃；多家胡採距離出銃者下家順序最近者單響。來源：[官方吃碰槓](https://www.gamesofa.com/mj/?op=rule_guide&t=2e&topic=j)、[官方攔胡](https://www.gamesofa.com/mj/?op=rule_guide&t=2g&topic=j)。

只加槓可被搶槓，加槓者承擔放銃；所以實作先公布待加槓牌與回應窗口，無人胡才真正升級及補牌。神來也小桃明文禁止明槓補牌立即自摸；暗槓、加槓、摸花補出的自摸可計槓上開花1台。這是平台規則，不是說所有台麻都必須如此。限制應記在該次補牌來源，不能永久禁止該玩家自摸。來源：[官方門清、槓開、搶槓教室](https://www.godgame.com.tw/bigad/event_mj_teach/teach03.html)。

保留16張牌，最後一張可摸牌之後流局；最後活牌若為花牌不能再補。補花由牌尾連續補到普通牌，花不占有效手牌／面子。來源：[官方海底教室](https://www.godgame.com.tw/bigad/event_mj_teach/teach05.html)。實作建議：用兩端指標，普通抽牌前進 head，補牌縮退 tail，剩餘 `tail-head+1` 不可低於16；UI應顯示可摸餘張，不把保留16張誤報成活牌。

跳過可以胡的牌或自摸後進入過水，連自摸也暫禁；須自己打出非胡牌才解除。過水碰則同巡不能再碰。来源：[過水](https://www.gamesofa.com/mj/?op=rule_guide&t=2j&topic=j)、[碰牌](https://www.gamesofa.com/mj/?op=rule_guide&t=2e&topic=j)。

## 主要台型對照

下表是可實作摘要，定義用重新整理的判定條件表達。值由官方台表／教室交叉核對。

| 台型 | 台 | 判定與排除 |
|---|---:|---|
| 屁胡 | 0 | 合法胡型，仍收底 |
| 門清 | 1 | 無吃、碰、明槓、加槓；允許暗槓 |
| 自摸 | 1 | 自己取得胡牌 |
| 門清自摸 | 3 | 合併值，不再疊門清1、自摸1 |
| 宣告聽牌 | 1 | 宣告後鎖手；單純UI提示聽牌不算宣告 |
| 地聽 | 4 | 自己首棄牌宣告，之前自己未吃碰槓；排除門清、一般聽牌；自摸另2 |
| 半求人 | 1 | 五組外露，剩單吊，自摸；不計單吊 |
| 全求人 | 2 | 五組外露，剩單吊，胡別家；不計單吊；暗槓不能算外露 |

來源：[門清與槓](https://www.godgame.com.tw/bigad/event_mj_teach/teach03.html)、[門清一摸三](https://www.godgame.com.tw/bigad/event_mj_teach/teach07.html)、[地聽](https://www.godgame.com.tw/bigad/event_mj_teach/teach09.html)、[宣告聽牌](https://www.gamesofa.com/mj/?op=rule_guide&t=2f&topic=j)、[官方台表的全求／半求](https://www.gamesofa.com/mj/?op=rule_guide&topic=k)。

| 台型 | 台 | 判定與排除 |
|---|---:|---|
| 圈風／門風 | 各1 | 對應風牌刻／槓；同種同時符合可得2 |
| 三元刻／槓 | 每組1 | 中發白；已計大小三元時不再列 |
| 正花 | 每張1 | 東春梅、南夏蘭、西秋菊、北冬竹 |
| 花槓 | 每組2 | 四季或四君子齊；替代該組正花，不是2加1 |
| 單吊／中洞／邊張 | 1 | 只聽單一牌種且胡張用途相符，只取一項 |
| 平胡 | 2 | 五順子、數牌將、無字無花、非自摸、真正兩面順子等待；可加門清 |
| 碰碰胡 | 4 | 五組刻／槓加將 |
| 三／四／五暗刻 | 2／5／8 | 只取最高一種；暗槓可算；放銃補成刻子不算暗刻 |

來源：[風、花、三元](https://www.godgame.com.tw/bigad/event_mj_teach/teach02.html)、[單吊中洞邊張](https://www.godgame.com.tw/bigad/event_mj_teach/teach04.html)、[平胡與三暗刻](https://www.godgame.com.tw/bigad/event_mj_teach/teach06.html)、[四暗刻](https://www.godgame.com.tw/bigad/event_mj_teach/teach10.html)、[五暗刻](https://www.godgame.com.tw/bigad/event_mj_teach/teach12.html)。花槓「替代」由完整台表明定；神來也花序是菊西、竹北，勿誤用明星的竹西菊北。

| 台型 | 台 | 判定與排除 |
|---|---:|---|
| 湊一色（混一色） | 4 | 恰一門數牌且有字牌 |
| 清一色 | 8 | 恰一門數牌且無字牌 |
| 字一色 | 8 | 全字；不加碰碰胡，風／龍台可另計 |
| 小三元／大三元 | 4／8 | 龍牌兩刻一將／三刻；排除龍刻台，不同時計大小 |
| 小四喜／大四喜 | 8／16 | 風牌三刻一將／四刻；大四喜不加門圈風，小四喜可加 |
| 人胡 | 8 | 第一輪他人首棄牌放銃，之前无人吃碰；不加地聽 |
| 地胡 | 16 | 閒家首次正常摸牌自摸；神來也允許他人先前吃碰 |
| 天胡 | 24 | 莊家配牌補花後、首棄前已胡；官方允許其他台累加 |

來源：[碰碰、小三元、湊一色](https://www.godgame.com.tw/bigad/event_mj_teach/teach08.html)、[大三元、人胡、清字一色](https://www.godgame.com.tw/bigad/event_mj_teach/teach11.html)、[小四喜](https://www.godgame.com.tw/bigad/event_mj_teach/teach12.html)、[地胡大四喜](https://www.godgame.com.tw/bigad/event_mj_teach/teach13.html)、[天胡](https://www.godgame.com.tw/bigad/event_mj_teach/teach14.html)。

槓開1、搶槓1、海底自摸1。各項可能與其他牌型並存，唯明槓補牌不能自摸。最後棄牌胡是否也算海底，神來也教室說可以，主站台表只寫自摸：建議青雀採主站「海底自摸1」，不要另捏造河底加台；規則說明明示即可。[教室](https://www.godgame.com.tw/bigad/event_mj_teach/teach05.html)、[主站台表](https://www.gamesofa.com/mj/?op=rule_guide&topic=k)。

## 花胡

八仙：八花齊，補完牌即可胡，不要求一般成牌；三家各付底加8台及涉莊加成，不再加一般花台或僅因花胡加自摸。若補牌同時成一般胡型，該胡型另加8花胡台。配牌階段即達花胡条件，等輪到本人首次摸牌，花胡額外4台。[八仙與七搶一教室](https://www.godgame.com.tw/bigad/event_mj_teach/teach12.html)、[配牌花胡](https://www.godgame.com.tw/bigad/event_mj_teach/teach09.html)。

七搶一有兩個不同付款分支，不能只寫「花>=7 自摸8台」：

1. A既有7花，B新摸最後花：A搶花並補牌，B按放銃付款8花胡台及涉莊台；若補成一般胡型，同一底上加牌型台，不計自摸。
2. A既有6花、B有1花，A新摸第8花：A取B的花後補牌；若未成一般胡型仍由B付花胡；若成一般胡型，三家先按自摸付牌型台，而花台只有B付七搶一8，另兩家按A本有7花的一般花台計。

来源：[官方花胡精確分支](https://www.gamesofa.com/mj/?op=rule_guide&topic=k)。產品如不支援第二付款分支，必須明示花胡與來源差異，不可聲稱完整複刻神來也。

## 莊家與分數

莊胡／流局續莊，其他玩家胡則下家接莊。神來也最多連九次；若青雀不設連莊上限須當作明示桌規差異。莊家與某人有該次付款關係時，該筆加 `1 + 2*連莊次數` 台。閒家自摸時，只有莊家那一筆有莊台；莊家自摸三筆都有；兩閒家放銃／胡牌時不加莊台。來源：[連莊輪替](https://www.gamesofa.com/mj/?op=rule_guide&t=2i&topic=j)、[連N拉N](https://www.godgame.com.tw/bigad/event_mj_teach/teach06.html)、[莊家](https://www.godgame.com.tw/bigad/event_mj_teach/teach05.html)。

每位付款者 `amount = base + unit * (牌型台 + 該筆涉莊台)`，記為一負一正的積分，總和0。放銃由一人付款；自摸三人各付款。不做現金或抽水。[神來也結算公式](https://www.gamesofa.com/mj/?op=rule_guide&t=2k&topic=j)。

## 必要實作判定與來源歧義

- **胡型拆解**：列舉合法五面子分解、逐一標注胡牌落在哪組，再取最優合法台數組合。單看總牌頻率不能判平胡或暗刻。此為實作建議，不是來源演算法。
- **獨聽**：從胡前手牌枚舉34牌種的合法等待，排除手牌／副露已占四枚的第五枚。別人的牌已出光不能把原本多面聽變成独聽。只看可见剩餘張數會誤算。此為將「只聽」轉成算法的裁定。
- **平胡原文筆誤**：神來也兩處寫四副順子，但同站一般胡型明寫五面子，且教室例圖共17張。實作五順子。其12345胡3、56789胡7、多面單吊仍排除平胡；不能用「等待數>1且全順」替代判定。
- **暗刻**：放銃牌若補成刻子，該組是明刻語義；若補成將或順子，其餘完整暗刻保留。四暗刻可加碰碰，五暗刻也可加碰碰；字一色例外排除碰碰。
- **天聽**：神來也這套完整主表未列，不新增別家的天聽8。地聽需要真實宣告與鎖手：記本人棄牌數、本人鳴牌史、宣告時等待、是否過水。只有聽牌提示不能收4台。
- **開門與風位**：神來也門風依擲骰開門方位，而不總是莊家東。若沒有擲骰開門機制，青雀可明示採莊家東、下家南、對家西、上家北；這是有意縮小的桌規差異，不能暗稱完全一致。
- **明槓後補花連鎖**：來源沒有精確交代明槓補到花再補的自摸例外，建議整次補牌链继承明槓起因，禁止該鏈即胡，避免繞過限制。
- **海底**：活牌耗尽不能再吃碰槓製造無限續局。建議最後棄牌只接受胡／過，無人胡即流局；這是把海底終止條件落實成狀態機的明示桌規。
- **身份投影**：真人狀態只傳本家暗手与本家暗槓牌種；其他暗槓也必须隱藏。回合、捨牌、花、副露、分数公开。结算後才揭示需要驗胡的內容。

## 驗收素材範圍

只需針對新增行為選少量主路徑／關鍵失敗驗證：吃只上家；明／暗／加槓後牌數守恆；搶槓先胡後不補；雙人同胡按座位單響；花補牌和保留16；一個固定胡型逐項台数与付款0和。若使用完整台表，分解、宣告狀態與付款分支不可用UI文字冒充實作。

## 真人部署決策

2026-09-24 核對 [Vercel WebSockets 官方文件](https://vercel.com/docs/functions/websockets)：目前所有方案提供 Beta WebSocket，可匯出 Node HTTP server 搭配 `ws`。連線會受 Function 時限限制，重連不保證回到同實例，因此房間不能只存記憶體。

採使用者既有 Neon PostgreSQL，依 [Neon 官方 serverless driver](https://github.com/neondatabase/serverless) 使用參數化 HTTPS SQL；每次動作以房間版本 compare-and-swap 重試，只有成功持久化的狀態才傳給玩家。每秒同步在線房間，客戶端30秒內重連。這是小型好友房的實作，並未加入配對、帳號排名、永久回放或現金交易。
