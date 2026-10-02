// Taunts (嘲諷語音): the 42 numbered chat lines of the reference. Text as aoetw.com's elements/Taunts page gives it
// (2026-10-02, github.com/webrsb/aoetw; the site's Traditional Chinese wording and the English original). No recorded
// voices: the page speaks the Chinese line with a local text-to-speech voice when one exists (design_default).
export type Taunt={n:number;zh:string;en:string};
export const taunts:readonly Taunt[]=[
 {n:1,zh:'好。',en:'Yes.'},{n:2,zh:'不。',en:'No.'},{n:3,zh:'請給我食物。',en:'Food please.'},{n:4,zh:'請給我木材。',en:'Wood please.'},
 {n:5,zh:'請給我黃金。',en:'Gold please.'},{n:6,zh:'請給我石頭。',en:'Stone please.'},{n:7,zh:'唉~~欸......',en:'Ahh!'},
 {n:8,zh:'嗨~肉腳你們好啊',en:'All hail, king of the losers!'},{n:9,zh:'嗚~~耶',en:'Ooh!'},{n:10,zh:'看我把你打回世紀帝國一代去',en:'I\'ll beat you back to Age of Empires.'},
 {n:11,zh:'（奸笑）',en:'(Herb laugh)'},{n:12,zh:'我快招架不住了......',en:'Ah! Being rushed.'},{n:13,zh:'去怪你的網路公司吧！',en:'Sure, blame it on your ISP.'},
 {n:14,zh:'欸！遊戲已經開始囉！',en:'Start the game already!'},{n:15,zh:'拜託！不要用那個東西指著我好嗎？',en:'Don\'t point that thing at me!'},
 {n:16,zh:'發現敵人。',en:'Enemy sighted!'},{n:17,zh:'坐上王位的感覺真好。',en:'It is good to be the king.'},{n:18,zh:'我還少個僧侶。',en:'Monk! I need a monk!'},
 {n:19,zh:'有一陣子沒交手囉？',en:'Long time, no siege.'},{n:20,zh:'欸你也幫幫忙，連我阿嬤都比你行。',en:'My granny could scrap better than that.'},
 {n:21,zh:'好地方，我要定了！',en:'Nice town, I\'ll take it.'},{n:22,zh:'別再打我了啦！',en:'Quit touching me!'},{n:23,zh:'大伙進攻囉！',en:'Raiding party!'},
 {n:24,zh:'厚！真雖！',en:'Dadgum.'},{n:25,zh:'你敢就來啊？',en:'Eh, smite me.'},{n:26,zh:'糟了！是世界奇觀！',en:'The wonder, the wonder, the... no!'},
 {n:27,zh:'欸，你玩這麼久才玩這樣喔？',en:'You played two hours to die like this?'},{n:28,zh:'還有人比你更慘勒。',en:'Yeah, well, you should see the other guy.'},
 {n:29,zh:'肉腳。',en:'Roggan.'},{n:30,zh:'嗚~~呼~~~',en:'Wololo.'},{n:31,zh:'攻擊敵人，衝啊！',en:'Attack an enemy now.'},
 {n:32,zh:'停止生產額外的村民。',en:'Cease creating extra villagers.'},{n:33,zh:'生產額外村民。',en:'Create extra villagers.'},{n:34,zh:'建立海軍。',en:'Build a navy.'},
 {n:35,zh:'停止建立海軍。',en:'Stop building a navy.'},{n:36,zh:'等我下令攻擊',en:'Wait for my signal to attack.'},{n:37,zh:'建造世界奇觀。',en:'Build a wonder.'},
 {n:38,zh:'請你把多的資源給我。',en:'Give me your extra resources.'},{n:39,zh:'（同盟聲音）',en:'(Ally sound)'},{n:40,zh:'（敵人聲音）',en:'(Enemy sound)'},
 {n:41,zh:'（中立聲音）',en:'(Neutral sound)'},{n:42,zh:'你在哪一個時代啊？',en:'What age are you in?'},
];
// The chat keeps the last `keep` lines; a player may send one every `everyTicks` (one second at 20 ticks a second).
export const tauntRules={provenance:'design_default',keep:20,everyTicks:20} as const;
export const tauntOf=(n:number)=>taunts.find(t=>t.n===n);
// The site's rule: the number comes first, anything after it is ignored ("11 哈" sends 11). null: not a taunt.
export function parseTaunt(text:string):number|null{const m=/^\s*(\d{1,2})(?!\d)/.exec(text);if(!m)return null;const n=Number(m[1]);return tauntOf(n)?n:null;}
