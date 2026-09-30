// The encyclopedia's prose (「百科」): text only, no imports and no numbers that packages/content/rules.ts or
// packages/sim/stats.ts already hold (the page computes those). Civilization texts are paraphrased from aoetw.com's
// civ and unit pages (HD / UserPatch-era encyclopedia, github.com/webrsb/aoetw, read 2026-09-30) and trimmed to what
// this game has; the Settlers are this game's own. History years are prose, not rules.
export type CivProse={summary:string;strategy:string;sources:readonly string[]};
export const codexIntro='文明資料整理自 aoetw.com（世紀帝國 II 的繁體中文百科，內容以 HD／UserPatch 時代為準），數值已換算成本作的比例。本作是一對一對戰，團隊加成只作用在擁有者自己身上。標示「尚未實作」的項目目前不在遊戲裡。';
// Architecture groups of the reference's civilization list (they also order the list).
export const architectureLabel:Readonly<Record<string,string>>={west:'西歐',central:'中歐',mideast:'中東',eastasia:'東亞',neutral:'本作原創'};
export const civProse:Readonly<Record<string,CivProse>>={
 settlers:{summary:'拓荒者是本作原創的基準文明：沒有文明加成、特殊單位，也不能建造城堡，科技樹就是本作完整的通用版本。',
  strategy:'適合熟悉基本操作，或當作對照組比較各文明加成的效果。雙方都是拓荒者時，勝負只取決於運營與操作。',sources:[]},
 britons:{summary:'不列顛是西歐的弓兵文明，代表中世紀的英格蘭人與盎格魯－諾曼人。相傳英格蘭一度只准百姓練習射箭，弓術因而冠絕一時，牧羊也是他們的專長。長弓兵射得比其他弓兵都遠，但馬廄與修道院的科技有缺口。',
  strategy:'前期以靶場的弓手搭配長槍兵施壓，靶場的效率加成讓弓兵補得快。射程加成要到第三時代才生效，長弓兵要站在近戰部隊後方輸出，別讓陣型被衝散。對手用騎兵繞後時，以長槍兵與箭塔護住弓兵。',sources:['civs/Britons','units/Longbowman']},
 celts:{summary:'塞爾特是西歐的步兵與攻城器文明，以蘇格蘭、愛爾蘭與威爾士人為原型。他們以木工與冶金見長，伐木快、攻城器精良；菘藍武士取材自臉塗藍漆、來去如風的戰士。弓兵與騎兵的科技缺口大，是典型、也容易被針對的步兵文明。',
  strategy:'步兵從第二時代起就跑得比別人快，適合早早用民兵系與長槍兵騷擾。攻城器攻擊更快，第四時代的塞爾特狂熱再讓它更耐打，攻城槌配步兵是主要的推進方式。菘藍武士適合繞後拆建築、追殺攻城器，但護甲薄，別正面撞上成群弓兵或已布好的防線。',sources:['civs/Celts','units/Woad_Raider']},
 franks:{summary:'法蘭克源自古稱高盧的地區，歷經墨洛溫與卡洛林王朝，是日後法蘭西王國與神聖羅馬帝國的前身。遊戲中是西歐的騎兵文明：馬廄單位更耐打，城堡也蓋得便宜。步兵科技完整，弓兵則是整個科技樹最弱的一環。',
  strategy:'採漿果快、磨坊的農田科技免費，前期經濟穩，適合第二時代用斥候騷擾、第三時代轉出騎士。便宜的城堡可以提早蓋在前線控制地圖，大量出騎士時再研究騎士精神。遇上長槍兵海就改用擲斧兵與步兵應對，不要硬走弓兵路線。',sources:['civs/Franks','units/Throwing_Axeman']},
 goths:{summary:'哥德泛指東日耳曼諸部族，以西元 476 年終結西羅馬帝國聞名；東哥德後來落腳義大利，西哥德則在伊比利半島立國。遊戲中是中歐的步兵文明，步兵便宜又量產得快，防禦設施卻是全文明最弱的。進攻時兇猛，一旦轉為守勢就相當吃力。',
  strategy:'步兵隨時代越來越便宜，第二時代就能用民兵系與長槍兵大量施壓。第三時代以哥德衛隊專打弓兵與建築，長槍兵負責擋騎兵；研究無政府狀態後兵營也能訓練哥德衛隊。缺步兵板甲，怕條頓武士、日本武士這類強力近戰步兵，最好的防守就是持續進攻。',sources:['civs/Goths','units/Huskarl']},
 teutons:{summary:'條頓源自日耳曼的一支，民族大遷徙後定居今日德國一帶，遊戲中代表神聖羅馬帝國；條頓武士取材自歷史上的條頓騎士團。他們在防禦、經濟與進攻上都有加成，箭塔與城鎮中心能進駐更多人、農田便宜，配上砲門垛口的城堡殺傷力居各文明之冠。',
  strategy:'箭塔能進駐加倍的單位，第二時代的塔攻很有威脅；便宜的農田替前期省下木材。步兵與騎兵在第三、第四時代近戰護甲逐步提高，適合打正面消耗戰。條頓武士又慢又怕遠程單位，要有騎士或攻城槌掩護才接近得了目標；沒有輕騎兵，後期欠缺快速騷擾的手段。',sources:['civs/Teutons','units/Teutonic_Knight']},
 vikings:{summary:'維京人在八至十一世紀劫掠並殖民歐洲沿岸與不列顛群島，遊戲中是步兵與海軍文明。陸戰以狂戰士為核心，步兵生命隨時代成長；升時代時免費得到手推車與手拉車，前中期經濟特別順。騎兵與僧侶的科技殘缺，後期相對吃虧。',
  strategy:'省下的經濟科技可以換成更早的兵力，第二到第三時代是施壓的好時機。狂戰士會自己回血、對付長槍兵與輕騎兵很有效，適合來回騷擾；研究酋長後全體步兵也能反制騎兵。本作還沒有海戰，維京的戰船加成與維京大戰船暫時派不上用場。',sources:['civs/Vikings','units/Berserk']},
 byzantines:{summary:'拜占庭即東羅馬帝國，以君士坦丁堡為中心，靠著雙重城牆守住歐亞交界上千年；遊戲中建築隨時代越來越堅固，升第四時代也比較便宜。以便宜的長槍兵、散兵這類「垃圾兵」為骨幹，科技樹幾乎完整，路線多變；拜占庭聖騎兵是專剋步兵的重騎兵。',
  strategy:'長槍兵與散兵的折扣讓第二時代就能以低成本大量反制騎兵與弓兵。便宜的第四時代適合穩守之後快速升級，僧侶的治療也更快。拜占庭聖騎兵與它的升級都昂貴，等資源充足再大量生產，對以步兵為主的對手有毀滅性。',sources:['civs/Byzantines','units/Cataphract']},
 persians:{summary:'波斯是歷史悠久的古國，到了中世紀仍深刻影響著中亞。遊戲中是中東的騎兵文明：經濟強、騎兵科技完整，戰象近乎無敵。代價是步兵在全文明中最弱，而且非常依賴黃金。',
  strategy:'城鎮中心的工作速度隨時代加快，開局資源也較多，村民補得快。騎士與戰象是主力；戰象又慢又怕長槍兵與僧侶轉化，需要弓兵或騎兵掩護。步兵後期明顯落後，別把太多資源投進步兵打長期戰。',sources:['civs/Persians','units/War_Elephant']},
 saracens:{summary:'「薩拉森」是歐洲人對穆斯林的泛稱，歷史上並沒有這個名字的帝國；遊戲中綜合了阿拉伯哈里發、倭馬亞、阿拔斯與阿尤布等勢力。定位為駱駝與海軍文明，科技樹相當完整，阿拉伯奴隸兵擅長剋制騎兵。',
  strategy:'弓兵對建築有額外攻擊，適合以弓手壓制並拆掉對手的前線建築。阿拉伯奴隸兵機動性高、對騎兵有加成，能應付多數騎兵與步兵，但怕長槍兵系與條頓武士。修道院科技幾乎齊全，穆斯林學墊讓陣亡的僧侶退回部分黃金，僧侶戰術值得一試。',sources:['civs/Saracens','units/Mameluke']},
 turks:{summary:'土耳其源自突厥烏古斯人建立的塞爾柱，其後的鄂圖曼帝國滅亡了東羅馬，並把君士坦丁堡改名伊斯坦堡。遊戲中是中東的火藥文明，火藥單位更耐打、採金更快；土耳其火槍兵在第三時代就能訓練，這在火藥單位中相當少見。',
  strategy:'常見打法是第二時代用斥候騷擾，進入第三時代時免費升級輕騎兵立刻轉強，接著以土耳其火槍兵為主力。缺長矛兵與精銳散兵，反制騎兵與弓兵的兵種都不完整，一旦陷入被動就會損失慘重，最好主動出擊。火槍兵很吃黃金，後期要靠採金加成撐住經濟。',sources:['civs/Turks','units/Janissary']},
 chinese:{summary:'中國是遊戲中最古老的文明之一，擅長弓、弩與火器。作為東亞的弓兵文明，開局多幾名村民卻少了食物與木材，起步不易；各時代研究科技都有折扣，完整發揮後後期非常強。步兵與弓兵的科技齊全，樣樣能做、樣樣不專精。',
  strategy:'開局食物吃緊，先研究織布機並引野豬回城鎮中心，讓城鎮中心一直生產村民。前期怕快攻，要及早用箭塔與建築圍好基地。連弩兵一次射出多支箭，成群時能迅速拆掉攻城槌，但射程短，適合防守；第四時代的火箭技術再提高它的攻擊。',sources:['civs/Chinese','units/Chu_Ko_Nu']},
 japanese:{summary:'日本的封建制度約在十一世紀才成形，軍隊歷來以步兵為主，是東亞的步兵文明。步兵的攻擊速度隨時代加快，經濟建築便宜，箭塔火力出眾；代價是騎兵孱弱。',
  strategy:'伐木場、採礦場與磨坊便宜，前期經濟起得快，適合第二時代以步兵快攻、盡量在前期取勝。第三時代研究射箭孔後，箭塔是可靠的守家手段。日本武士專剋特殊單位，對手依賴特殊單位時才值得大量生產；平時長劍士、弩手與長矛兵的組合更實用。',sources:['civs/Japanese','units/Samurai']},
 mongols:{summary:'蒙古帝國由鐵木真（成吉思汗）在 1206 年建立，鼎盛時是歷史上連續版圖最遼闊的國家。遊戲中以馬弓騎兵與攻城器見長，擅長游擊與快速破壞，輕騎兵也更耐打。弱點在防守，箭塔的升級有限。',
  strategy:'打獵特別快，靠獵物迅速進入第二時代，再用斥候騷擾對手的村民。蒙古突騎射速快、對攻城器有加成，適合襲擊村民與僧侶，也能在中距離擊毀攻城槌。游牧讓基地被偷襲時保住人口上限，鑿岩機讓攻城槌推進得更快；避開長槍兵系與成群的輕騎兵。',sources:['civs/Mongols','units/Mangudai']},
};
// One line per unique unit (the entry id is the unit kind).
export const uniqueUnitText:Readonly<Record<string,string>>={
 longbowman:'射程最遠的徒步弓兵，成群時火力致命，但生命低，怕騎兵與攻城器近身。',
 'woad-raider':'跑得最快的步兵之一，對建築有加成，擅長游擊與追殺攻城器，但護甲薄。',
 'throwing-axeman':'從遠處擲出斧頭的步兵，傷害算近戰，對建築有加成；能壓制長槍兵與攻城槌，怕重騎兵與打帶跑的弓兵。',
 huskarl:'遠程護甲極高、幾乎不怕箭矢的步兵，專打弓兵與建築；缺近戰護甲，怕騎士與強力近戰步兵。',
 'teutonic-knight':'又慢又硬的重步兵，攻擊與近戰護甲都高，對建築有加成；怕遠程單位打帶跑與僧侶轉化。',
 berserk:'會自己回血的步兵，擅長對付長槍兵與輕騎兵，適合騷擾；怕弓兵與對步兵有加成的單位。',
 cataphract:'對步兵有大量加成傷害的重騎兵，研究後勤後還會踐踏目標周圍的敵兵；遠程護甲偏低，造價昂貴。',
 'war-elephant':'笨重緩慢卻近乎無敵的騎兵，對建築有加成；怕長槍兵系與僧侶轉化。',
 mameluke:'騎著駱駝、從短距離擲出彎刀的近戰單位，對騎兵有加成，機動性高但昂貴。',
 janissary:'第三時代就能訓練的火藥步兵，攻擊高、射程遠，但生命偏低；怕弓兵與騎兵。',
 'chu-ko-nu':'一次射出多支箭的連弩手，只有第一支是完整傷害；成群時能迅速拆掉攻城槌，但射程短。',
 samurai:'攻擊速度極快的步兵，對所有特殊單位有額外傷害；怕弓兵與騎士。',
 mangudai:'射速極快、對攻城器有加成的馬弓騎兵，適合襲擊村民與僧侶；怕長槍兵系與成群的輕騎兵。',
};
// Reference items a civilization also lacks there but this game does not have at all (civDefs missingLater), named
// as aoetw.com names them.
export const referenceOnlyNames:Readonly<Record<string,string>>={
 hussar:'匈牙利輕騎兵',paladin:'遊俠',cavalier:'重裝騎士','siege-ram':'重型衝撞車','thumb-ring':'拇指環','parthian-tactics':'安息人戰術',bloodlines:'品種',
 camel:'駱駝騎兵','heavy-scorpion':'重型弩砲','bombard-cannon':'火砲','elite-cannon-galleon':'精銳火砲戰船',missionary:'傳教士',arbalest:'強弩兵',
 architecture:'建築學',keep:'大型箭塔','guard-tower':'防禦箭塔','bombard-tower':'火砲塔','heated-shot':'火箭（燒熱彈）',shipwright:'造船員',
 halberdier:'戟兵','herbal-medicine':'草藥治療','fire-ship':'火戰船','two-handed-swordsman':'雙手劍兵',champion:'劍兵勇士',
};
// Unit and bonus classes as the panels name them.
export const classLabel:Readonly<Record<string,string>>={infantry:'步兵',cavalry:'騎兵',archer:'弓兵',spear:'長槍兵',skirmisher:'散兵',building:'建築',siege:'攻城器',
 unique:'特殊單位',gunpowder:'火藥單位','cavalry-archer':'馬弓騎兵',elephant:'戰象',monk:'僧侶',villager:'村民',animal:'動物'};
