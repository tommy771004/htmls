export const SAVE_KEY='zork-1977-136-v1';
export const DIRS={NORTH:'北',SOUTH:'南',EAST:'東',WEST:'西',NE:'東北',NW:'西北',SE:'東南',SW:'西南',UP:'上',DOWN:'下',ENTER:'進入',EXIT:'離開',OUT:'離開',CLIMB:'攀下',CROSS:'渡過'};
export const NAMES={WINDO:'半開的窗',FOOD:'午餐',BOTTL:'水瓶',TROPH:'寶物櫃',ROPE:'麻繩',KNIFE:'獵刀',DOOR:'地板活門',LAMP:'黃銅提燈',RUG:'東方地毯',PILE:'枯葉堆',TROLL:'巨魔',BONES:'探險者的骸骨',KEYS:'骷髏鑰匙',BAGCO:'古錢袋',BAR:'白金條',PEARL:'珍珠項鍊',GRATE:'鐵柵門',TRUNK:'珠寶箱',COFFI:'黃金棺',ICE:'大冰川',REFLE:'古鏡',GHOST:'亡魂之門',RUBY:'紅寶石',TRIDE:'鑽石三叉戟',TORCH:'象牙火炬',GRAIL:'聖杯',BELL:'黃銅鐘',BOOK:'黑色祈禱書',CANDL:'一對蠟燭',DAM:'水壩閘栓',MATCH:'火柴',GUIDE:'水壩指南',BUTTO:'控制面板',LEAK:'破裂管線',SCREW:'螺絲起子',WRENC:'扳手',PUTTY:'補漏膠',CYCLO:'獨眼巨人',CHALI:'銀酒杯',PAINT:'名畫',THIEF:'盜賊',RAIL:'穹頂欄杆',RIDDLE:'石門上的謎語',VOICE:'回音',ALTAR:'祭壇',INSCRIPTION:'神殿銘文'};
export const FIXED=new Set(['WINDO','TROPH','DOOR','RUG','PILE','TROLL','BONES','GRATE','ICE','REFLE','GHOST','DAM','BOLT','BUBBL','BUTTO','LEAK','CYCLO','THIEF','WATER']);
export const SAFE=new Set(['WHOUS','KITCH','LROOM','TEMP1','TEMP2','LOBBY']);
const clone=o=>JSON.parse(JSON.stringify(o));
export function createGame(world,saved){
 const rooms=world.rooms,objects=world.objects,treasures=Object.keys(objects).filter(k=>objects[k].deposit>0);
 function fresh(){return {version:1,room:'WHOUS',pos:[0,0],yaw:0,pitch:0,hp:100,stamina:100,inventory:[],locations:Object.fromEntries(Object.entries(objects).map(([k,v])=>[k,v.initial])),lights:Object.fromEntries(Object.entries(objects).filter(([,v])=>v.light).map(([k,v])=>[k,v.light>0])),flags:{'NOT-DROWNED':true},found:[],visited:['WHOUS'],deposited:[],enemyHP:{TROLL:100,THIEF:72},dead:[],moves:0,seed:19770614,water:true,drown:0,won:false};}
 function valid(s){return s&&s.version===1&&rooms[s.room]&&Array.isArray(s.pos)&&s.pos.length===2&&s.pos.every(v=>Number.isFinite(v)&&Math.abs(v)<=22)&&Number.isFinite(s.yaw)&&Number.isFinite(s.pitch)&&Number.isFinite(s.hp)&&s.hp>0&&s.hp<=100&&Number.isFinite(s.stamina)&&s.stamina>=0&&s.stamina<=100&&['inventory','found','deposited','dead'].every(k=>Array.isArray(s[k])&&new Set(s[k]).size===s[k].length&&s[k].every(id=>objects[id]))&&s.inventory.length<=9&&Array.isArray(s.visited)&&s.visited.every(r=>rooms[r])&&s.locations&&Object.keys(objects).every(k=>typeof s.locations[k]==='string'&&(rooms[s.locations[k]]||['inventory','case','gone','BOTTL','THIEF'].includes(s.locations[k])))&&s.inventory.every(k=>s.locations[k]==='inventory')&&s.deposited.every(k=>s.locations[k]==='case')&&s.flags&&typeof s.flags==='object'&&s.lights&&typeof s.lights==='object'&&s.enemyHP&&Object.values(s.enemyHP).every(Number.isFinite)&&Number.isFinite(s.seed)&&Number.isFinite(s.moves)&&Number.isFinite(s.drown);}
 let state=valid(saved)?clone(saved):fresh();if(!state.checkpoint||!valid(state.checkpoint))checkpoint();
 let message='',revision=0;
 function say(s){message=s;revision++;return s}
 function rng(){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296}
 function has(id){return state.inventory.includes(id)}
 function checkpoint(){const snap=clone(state);delete snap.checkpoint;snap.hp=100;snap.stamina=100;state.checkpoint=snap;state.hp=100;}
 function lit(){if(rooms[state.room].lit||(state.room==='MAINT'&&state.flags.red))return true;return Object.entries(state.lights).some(([id,on])=>on&&(has(id)||state.locations[id]===state.room));}
 function flag(f){if(f==='LIGHT-LOAD')return has('LAMP')&&state.inventory.length<=2;if(f==='EGYPT-FLAG')return !has('COFFI');return !!state.flags[f]}
 function score(){return state.visited.reduce((n,k)=>n+rooms[k].points,0)+state.found.reduce((n,k)=>n+objects[k].find,0)+state.deposited.reduce((n,k)=>n+objects[k].deposit,0)}
 function win(){state.won=score()===285&&state.deposited.length===treasures.length;}
 function enter(room){state.room=room;state.pos=[0,0];state.pitch=0;state.moves++;if(!state.visited.includes(room))state.visited.push(room);
  if(room==='CELLA')state.flags['TRAP-DOOR']=false;
  if(room==='TREAS-R'&&!state.dead.includes('THIEF')){state.dead.push('THIEF');state.locations.THIEF='gone';for(const id of Object.keys(objects))if(state.locations[id]==='THIEF')state.locations[id]=room;}
  if(room==='CAVE2'&&has('CANDL')&&state.lights.CANDL&&rng()<.5)state.lights.CANDL=false;
  if(SAFE.has(room))checkpoint();win();revision++;return true;
 }
 function move(dir){let exit=rooms[state.room].exits[dir];if(!exit){say('石壁無言。這裡沒有那個方向的通路。');return false;}
  if(state.room==='CAROU'){const dirs=['NORTH','SOUTH','EAST','WEST','NW','NE','SE','SW'];exit=rooms.CAROU.exits[dirs[Math.floor(rng()*8)]];}
  if(exit.flag&&!flag(exit.flag)){say(exit.blocked||({'KITCHEN-WINDOW':'窗還沒有推開。','TRAP-DOOR':'地毯下的活門尚未打開。','GLACIER-FLAG':'冰川封住了西方。'}[exit.flag])||'道路尚未打開。');return false;}
  if(!lit()){say('前方沒有任何光。黑暗中的落差把你吞没。');damage(100);return false;}
  const old=state.room;enter(exit.to);say(old==='CAROU'?'羅盤失去方向。轉盤把你送進另一條通道。':rooms[state.room].text||rooms[state.room].name);return true;
 }
 function available(){const r=state.room;let ids=Object.keys(objects).filter(k=>state.locations[k]===r&&!['BOLT','BUBBL','WATER','THIEF'].includes(k));
  ids=ids.filter(k=>!(k==='TRUNK'&&!flag('LOW-TIDE'))&&!(k==='DOOR'&&!flag('rug'))&&!(k==='GRATE'&&!flag('leaves'))&&!(k==='ICE'&&flag('GLACIER-FLAG'))&&!(k==='GHOST'&&flag('LLD-FLAG'))&&!(k==='TROLL'&&flag('TROLL-FLAG'))&&!(k==='CYCLO'&&flag('MAGIC-FLAG')));
  if(r==='MAZ11'&&!ids.includes('GRATE'))ids.push('GRATE');if(['MIRR1','MIRR2'].includes(r)&&!ids.includes('REFLE'))ids.push('REFLE');
  const extras={DOME:'RAIL',RIDDL:'RIDDLE',ECHO:'VOICE',TEMP2:'ALTAR',TEMP1:'INSCRIPTION'};if(extras[r])ids.push(extras[r]);
  if(!state.dead.includes('THIEF')&&['CAROU','PASS3','MAZE7'].includes(r))ids.push('THIEF');return ids;
 }
 function take(id){if(!available().includes(id)||FIXED.has(id)){return say('這件東西無法帶走。');}if(!lit())return say('伸手不見五指。你需要光。');
  if(state.room==='ECHO'&&!flag('echo'))return say('你的話語不斷反彈：'+(NAMES[id]||id)+'……回音吞掉了動作。');
  if(id==='ROPE'&&flag('DOME-FLAG')&&state.room==='DOME')return say('麻繩仍繫在欄杆上。');
  // Preserve June TAKE's capacity check, including the bottle's nested water.
  if(state.inventory.length+(id==='BOTTL'&&state.water?1:0)>8)return say('行囊太重。先放下一件東西；物品會留在原地。');
  state.inventory.push(id);state.locations[id]='inventory';if(!state.found.includes(id))state.found.push(id);win();return say('已取得 '+NAMES[id]+'。');
 }
 function relocate(id,where){state.inventory=state.inventory.filter(v=>v!==id);state.locations[id]=where;}
 function drop(id){if(!has(id))return say('你沒有帶著它。');if(state.room==='LROOM'&&treasures.includes(id)){relocate(id,'case');if(!state.deposited.includes(id))state.deposited.push(id);win();checkpoint();return say('寶物櫃接受了 '+NAMES[id]+'。');}relocate(id,state.room);return say('放下 '+NAMES[id]+'。它會留在這個房間。');}
 function act(verb,id,arg=''){
  if(verb==='drop')return drop(id);
  if(verb==='light'){
   if(!has(id)||!(id in state.lights))return say('你没有帶著這個光源。');
   if(id==='CANDL'&&!state.lights.CANDL&&has('TORCH'))return say('火炬的熱度會毀掉蠟燭；先放下火炬再點火。');
   state.lights[id]=!state.lights[id];return say(NAMES[id]+(state.lights[id]?'亮了起來。':'熄滅了。'));
  }
  if(!available().includes(id))return say('你必須先靠近這件物品。');
  if(!lit()&&id!=='VOICE')return say('黑暗遮住了一切。先點亮隨身光源。');
  if(verb==='take')return take(id);
  if(verb==='read')return say(objects[id]?.read||rooms[state.room].text||'字跡已隨年月磨損。');
  if(verb==='deposit'&&id==='TROPH'){for(const k of [...state.inventory])if(treasures.includes(k))drop(k);win();checkpoint();return say(state.won?'285 / 285。大帝國的寶藏終於重見天日。':'寶物櫃：'+state.deposited.length+' / 11 件。');}
  if(verb==='open'&&id==='WINDO'){state.flags['KITCHEN-WINDOW']=true;return say('After great effort, the window opens enough for you to enter.');}
  if(verb==='move'&&id==='RUG'){state.flags.rug=true;return say('地毯滑到一旁，露出通往黑暗的活門。');}
  if(verb==='open'&&id==='DOOR'){state.flags['TRAP-DOOR']=true;return say('活門艱難地打開。腐朽的階梯伸向地窖。');}
  if(verb==='move'&&id==='PILE'){state.flags.leaves=true;return say('枯葉底下，鐵柵門終於露出輪廓。');}
  if(verb==='open'&&id==='GRATE'){if(!has('KEYS'))return say('骷髏形的鎖孔需要一把鑰匙。');state.flags['KEY-FLAG']=true;return say('鎖舌退開；森林的光從頭頂灑下。');}
  if(verb==='tie'&&id==='RAIL'){if(!has('ROPE'))return say('欄杆下是六公尺的落差。你需要一條繩。');relocate('ROPE','DOME');state.flags['DOME-FLAG']=true;return say('繩結收緊。麻繩落向穹頂下的房間。');}
  if(verb==='untie'&&id==='RAIL'){state.flags['DOME-FLAG']=false;return say('麻繩已解開，可以拿走。');}
  if(verb==='rub'&&id==='REFLE'){const a=state.room,b=a==='MIRR1'?'MIRR2':'MIRR1';for(const k of Object.keys(objects)){if(state.locations[k]===a)state.locations[k]=b;else if(state.locations[k]===b)state.locations[k]=a;}enter(b);return say('地底傳來轟鳴。鏡中的房間與現實交換了位置。');}
  if(verb==='throw'&&id==='ICE'){if(!has('TORCH'))return say('冰川對這個嘗試無動於衷。');relocate('TORCH','STREA');state.flags['GLACIER-FLAG']=true;return say('火炬撞上冰川，烈焰吞沒冰壁。水流把火炬帶往溪流。');}
  if(verb==='turn'&&id==='DAM'){if(!has('WRENC'))return say(has('SCREW')?'螺絲起子轉不動這枚巨大的閘栓。':'閘栓緊得無法徒手轉動。');if(!flag('GATE-FLAG'))return say('即使有扳手，鎖死的閘栓仍紋絲不動。');state.flags['LOW-TIDE']=!flag('LOW-TIDE');return say(flag('LOW-TIDE')?'閘門敞開。水庫漸漸露出泥濘的底部。':'閘門關閉，水位開始回升。');}
  if(verb==='button'&&id==='BUTTO'){if(arg==='yellow')state.flags['GATE-FLAG']=true;if(arg==='brown')state.flags['GATE-FLAG']=false;if(arg==='red')state.flags.red=!state.flags.red;if(arg==='blue'&&!state.drown)state.drown=1;return say(arg==='blue'?'管線震動。冰冷的水開始湧進房間。':'喀。機械深處傳來一聲回應。');}
  if(verb==='plug'&&id==='LEAK'){if(!has('PUTTY'))return say('只靠雙手無法堵住漏水。');state.drown=-1;state.flags['NOT-DROWNED']=true;return say('補漏膠封住裂縫，水聲終於止息。');}
  if(verb==='exorcise'&&id==='GHOST'){if(!['BELL','BOOK','CANDL'].every(has)||!state.lights.CANDL)return say('鐘、書，與燃燒的蠟燭。你還沒有備齊驅魔所需之物。');state.flags['LLD-FLAG']=true;return say('雷聲迴盪。亡魂感到更高的力量，穿過石壁逃散。');}
  if(verb==='pray'&&id==='ALTAR'){enter('FORE1');return say('祈禱聲消失時，你已站在森林之中。');}
  if(verb==='give'&&id==='CYCLO'){if(arg==='FOOD'&&has('FOOD')){relocate('FOOD','gone');state.flags.fed=true;return say('巨人吞下辣椒午餐，喘著氣尋找飲水。');}if(arg==='WATER'&&has('BOTTL')&&state.water&&flag('fed')){state.water=false;state.flags['CYCLOPS-FLAG']=true;return say('喝過水後，巨人倒在階梯旁熟睡。');}return say('巨人拒絕了。他要的不是這個，或還不是此刻。');}
  if(verb==='say'){
   const word=arg.trim().toLowerCase();if(id==='RIDDLE'&&['well','井','水井'].includes(word)){state.flags['RIDDLE-FLAG']=true;return say('雷聲驟起，東方的石門打開了。');}
   if(id==='VOICE'&&word==='echo'){state.flags.echo=true;return say('The acoustics of the room change subtly.');}
   if(id==='CYCLO'&&word==='sinbad'){state.flags['MAGIC-FLAG']=true;state.flags['CYCLOPS-FLAG']=true;state.locations.CYCLO='gone';return say('聽見死敵辛巴達的名字，巨人撞碎北牆逃走。');}
   if(id==='INSCRIPTION'&&word==='treasure'){enter('TREAS-R');return say('花崗岩似乎不曾存在。你已置身寶物室。');}
   return say('你的聲音在石壁間漸漸散去。');
  }
  return say('Nothing happens.');
 }
 function hurtEnemy(id,amount,thrown=false){if(state.dead.includes(id))return;if(id==='CYCLO'){return say('巨人聳聳肩。刀刃無法解決這件事。');}if(!['TROLL','THIEF'].includes(id)||!has('KNIFE'))return say('你需要先取得獵刀。');
  if(thrown){relocate('KNIFE',state.room);if(id==='TROLL'&&(flag('trollTried')||rng()<.8))amount=1000;else if(id==='TROLL'){amount=0;state.flags.trollTried=true;}}
  state.enemyHP[id]-=amount;
  if(state.enemyHP[id]<=0){state.dead.push(id);state.locations[id]='gone';if(id==='TROLL')state.flags['TROLL-FLAG']=true;for(const k of Object.keys(objects))if(state.locations[k]==='THIEF')state.locations[k]=state.room;say(thrown&&id==='TROLL'?'巨魔吞下獵刀，隨即倒地消失。染血的刀仍在地上。':NAMES[id]+'倒下了。通路重歸寂靜。');}else say(thrown?'刀落在地上；你還可以拾回它。':'刀鋒命中。');revision++;
 }
 function damage(amount){state.hp=Math.max(0,state.hp-amount);if(state.hp<=0){const snap=clone(state.checkpoint);state={...snap,checkpoint:clone(snap)};state.hp=100;state.stamina=100;say('你在黑暗中倒下。回到上一個安全點；安全點之後的進度已回復。');return true;}return false;}
 function tick(dt){if(state.drown>0){state.drown+=dt;if(state.drown>45){state.flags['NOT-DROWNED']=false;if(state.room==='MAINT')damage(100);}}}
 function steal(){const k=state.inventory.find(x=>treasures.includes(x)&&x!=='TORCH');if(k){relocate(k,'THIEF');say('一隻手掠過行囊。'+NAMES[k]+'被盜賊帶走；他的藏身處在寶物室。');}}
 return {get s(){return state},get message(){return message},get revision(){return revision},rooms,objects,treasures,has,lit,flag,score,move,enter,available,take,drop,act,hurtEnemy,damage,tick,steal,checkpoint,say,rng,serialize:()=>JSON.stringify(state),reset(){state=fresh();checkpoint();revision++;}};
}
