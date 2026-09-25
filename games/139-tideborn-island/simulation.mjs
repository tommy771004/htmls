export const RESOURCE_NAMES={gold:'金幣',wood:'木材',food:'食物',fish:'魚',crops:'作物',rare:'稀有材料'};
export const JOBS=[{name:'阿禾',job:'農夫',type:'農田',resource:'crops',amount:5},{name:'小潮',job:'漁夫',type:'碼頭與棧橋',resource:'fish',amount:2},{name:'杉木',job:'木工',type:'工坊',resource:'wood',amount:4},{name:'綿綿',job:'牧羊人',type:'牧場',resource:'food',amount:3},{name:'阿栗',job:'商人',type:'穀倉',resource:'gold',amount:8}];
export const STATE_NAMES={rest:'在家休息',toWork:'前往工作',work:'工作中',toMarket:'搬貨去市集',trade:'等待交易',exchange:'正在交易',toHome:'回家',talk:'路上交談'};
export const QUESTS=[{id:'boards',title:'送 10 塊木板',target:10,gold:45,xp:25,rare:1},{id:'harvest',title:'收成 15 根紅蘿蔔',target:15,gold:35,xp:20,rare:1},{id:'catch',title:'釣 5 條魚',target:5,gold:40,xp:20,rare:1},{id:'dock',title:'升級碼頭',target:1,gold:80,xp:35,rare:2}];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
// Merge shared samples, not just edge endpoints, so branching roads are genuine intersections.
export function navigation(graph){
 const nodes=[],byKey=new Map(),adj=[];
 const add=p=>{const key=p.slice(0,2).map(v=>v.toFixed(4)).join(',');if(byKey.has(key))return byKey.get(key);const id=nodes.length;byKey.set(key,id);nodes.push([...p]);adj.push(new Map());return id;};
 for(const e of graph.edges)for(let i=1;i<e.points.length;i++){const a=add(e.points[i-1]),b=add(e.points[i]),d=distance(nodes[a],nodes[b]);if(d){adj[a].set(b,d);adj[b].set(a,d);}}
 const endpoints=new Map(graph.nodes.map(n=>[n.id,add([n.x,n.z,n.y]) ]));
 return {nodes,adj,endpoints};
}
export function route(nav,from,to){
 const start=nav.endpoints.get(from),end=nav.endpoints.get(to);if(start===undefined||end===undefined)throw Error('Missing navigation endpoint');
 const costs=new Map([[start,0]]),prev=new Map(),open=new Set([start]);
 while(open.size){let u;for(const n of open)if(u===undefined||costs.get(n)<costs.get(u))u=n;open.delete(u);if(u===end)break;for(const [v,d]of nav.adj[u]){const c=costs.get(u)+d;if(c<(costs.get(v)??Infinity)){costs.set(v,c);prev.set(v,u);open.add(v);}}}
 if(!costs.has(end))throw Error('Disconnected navigation route');const result=[end];while(result[0]!==start)result.unshift(prev.get(result[0]));return result.map(n=>[...nav.nodes[n]]);
}
export class IslandGame{
 constructor(graph,facilities,config,saved=null){
  this.nav=navigation(graph);this.facilities=facilities;this.config=config;this.scale=config.radius/120;this.market=facilities.find(f=>f.type==='市集').node;
  this.resources={gold:120,wood:0,food:8,fish:0,crops:0,rare:0};this.stats={boards:0,harvest:0,catch:0,dock:0,trades:0,chats:0,deliveries:0};this.upgrades={dock:false,garden:false,bakery:false};this.claimed=[];this.xp=0;this.time=0;this.speed=1;this.paused=false;this.log=['新的一天，居民準備出門。'];this.stock={};this.marketStock={};this.revision=0;
  const homes=facilities.filter(f=>f.type==='住家');
  this.agents=JOBS.map((j,i)=>{const home=homes[i].node,p=graph.nodes.find(n=>n.id===home);return {...j,id:i,home,work:facilities.find(f=>f.type===j.type).node,node:home,x:p.x,z:p.z,y:p.y,state:'rest',timer:2+i*1.5,cargo:null,path:[],index:0,destination:home,cooldown:0,partner:null,cycles:0};});
  if(saved)this.restore(saved);
 }
 get level(){return this.xp>=100?3:this.xp>=40?2:1;}
 message(text){this.log.unshift(text);this.log.length=Math.min(this.log.length,6);this.revision++;}
 go(a,node,state){a.path=route(this.nav,a.node,node);a.index=1;a.destination=node;a.state=state;}
 produce(a){const amount=a.amount+(this.upgrades.garden&&a.job==='農夫'?3:0)+(this.upgrades.dock&&a.job==='漁夫'?2:0);a.cargo={resource:a.resource,amount};this.stock[a.id]=0;this.go(a,this.market,'toMarket');}
 deposit(a){const {resource,amount}=a.cargo||{};if(resource){this.resources[resource]+=amount;this.marketStock[resource]=(this.marketStock[resource]||0)+amount;this.stats.deliveries++;if(resource==='crops')this.stats.harvest+=amount;if(resource==='fish')this.stats.catch+=amount;a.cargo=null;this.xp+=2;this.message(`${a.name} 交付 ${amount} ${RESOURCE_NAMES[resource]}。`);}this.stats.trades++;this.go(a,a.home,'toHome');}
 step(dt){if(this.paused)return;const seconds=Math.max(0,Math.min(dt,1))*this.speed;for(let left=seconds;left>0;left-=.1)this.tick(Math.min(.1,left));}
 tick(dt){this.time+=dt;for(const a of this.agents){a.cooldown=Math.max(0,a.cooldown-dt);if(['toWork','toMarket','toHome'].includes(a.state)){let travel=10*this.scale*dt;while(travel>0&&a.index<a.path.length){const p=a.path[a.index],d=Math.hypot(p[0]-a.x,p[1]-a.z);a.heading=Math.atan2(p[0]-a.x,p[1]-a.z);if(d<=travel){a.x=p[0];a.z=p[1];a.y=p[2];travel-=d;a.index++;}else {a.x+=(p[0]-a.x)*travel/d;a.z+=(p[1]-a.z)*travel/d;const previous=a.path[a.index-1];a.y=Number.isFinite(p[2])&&Number.isFinite(previous?.[2])?previous[2]+(p[2]-previous[2])*(distance(previous,[a.x,a.z])/distance(previous,p)):undefined;travel=0;}}
   if(a.index>=a.path.length){a.node=a.destination;if(a.state==='toWork'){a.state='work';a.timer=8;this.stock[a.id]=0;}else if(a.state==='toMarket'){a.state='trade';a.timer=12;}else {a.state='rest';a.timer=7;a.cycles++;}}continue;}
   if(a.state==='talk'){a.timer-=dt;if(a.timer<=0){a.state=a.resume;a.partner=null;}continue;}
   if(a.state==='exchange'){a.timer-=dt;if(a.timer<=0){this.deposit(a);a.partner=null;}continue;}
   a.timer-=dt;
   if(a.state==='work')this.stock[a.id]=Math.max(0,Math.min(a.amount,Math.floor((8-a.timer)/8*a.amount)));
   if(a.timer>0)continue;
   if(a.state==='rest')this.go(a,a.work,'toWork');else if(a.state==='work')this.produce(a);else if(a.state==='trade'){this.deposit(a);}
  }
  // Pair residents at the market; otherwise staffed stalls trade after a bounded wait.
  const waiting=this.agents.filter(a=>a.state==='trade');for(let i=0;i+1<waiting.length;i+=2){const a=waiting[i],b=waiting[i+1];for(const [u,v]of [[a,b],[b,a]]){u.state='exchange';u.timer=2.5;u.partner=v.id;}this.message(`${a.name} 與 ${b.name} 正在市集交換貨物。`);}
  for(let i=0;i<this.agents.length;i++)for(let j=i+1;j<this.agents.length;j++){const a=this.agents[i],b=this.agents[j];if(!a.cooldown&&!b.cooldown&&['toWork','toMarket','toHome'].includes(a.state)&&['toWork','toMarket','toHome'].includes(b.state)&&Math.hypot(a.x-b.x,a.z-b.z)<4*this.scale){for(const [u,v]of [[a,b],[b,a]]){u.resume=u.state;u.state='talk';u.timer=2;u.cooldown=22;u.partner=v.id;}this.stats.chats++;this.message(`${a.name} 和 ${b.name} 在路上聊了幾句。`);}}
 }
 afford(cost){return Object.entries(cost).every(([k,v])=>this.resources[k]>=v);}
 pay(cost){if(!this.afford(cost))return false;for(const[k,v]of Object.entries(cost))this.resources[k]-=v;return true;}
 action(id){
  const recipes={boards:{cost:{wood:4},run:()=>{this.stats.boards+=4;this.xp+=4;},text:'已送出 4 塊木板。'},cook:{cost:{crops:3},run:()=>{this.resources.food+=4;this.xp+=3;},text:'製作 4 份蔬菜餐。'},sellFish:{cost:{fish:2},run:()=>{this.resources.gold+=18;this.xp+=2;},text:'售出 2 條魚，獲得 18 金幣。'},buyWood:{cost:{gold:20},run:()=>this.resources.wood+=4,text:'購入 4 份木材。'},sellCrops:{cost:{crops:5},run:()=>this.resources.gold+=15,text:'售出 5 份作物。'}};
  if(recipes[id]){const r=recipes[id];if(!this.pay(r.cost))return this.fail('資源不足，等居民交貨或到市集補貨。');r.run();this.message(r.text);return true;}
  const buildings={dock:{level:1,cost:{gold:60,wood:8,fish:3},text:'碼頭升級完成，漁夫每趟多帶回 2 條魚。'},garden:{level:2,cost:{gold:50,wood:8,rare:1},text:'溫室建成，農夫每趟多收成 3 份作物。'},bakery:{level:3,cost:{gold:80,wood:12,rare:2},text:'麵包房建成，可把作物製成麵包。'}};
  if(buildings[id]){const b=buildings[id];if(this.upgrades[id])return this.fail('這項設施已完成。');if(this.level<b.level)return this.fail(`島嶼等級 ${b.level} 才能解鎖。`);if(!this.pay(b.cost))return this.fail('建造資源不足。');this.upgrades[id]=true;this.xp+=10;if(id==='dock')this.stats.dock=1;this.message(b.text);return true;}
  if(id==='bread'){if(!this.upgrades.bakery)return this.fail('先建造麵包房。');if(!this.pay({crops:4}))return this.fail('需要 4 份作物。');this.resources.food+=8;this.xp+=4;this.message('烘焙了 8 份麵包。');return true;}
  return false;
 }
 fail(message){this.message(message);return false;}
 claim(id){const q=QUESTS.find(q=>q.id===id);if(!q||this.claimed.includes(id)||this.stats[id]<q.target)return false;this.claimed.push(id);this.resources.gold+=q.gold;this.resources.rare+=q.rare;this.xp+=q.xp;this.message(`完成「${q.title}」！獲得 ${q.gold} 金幣、${q.xp} 經驗與 ${q.rare} 稀有材料。`);return true;}
 snapshot(){return JSON.parse(JSON.stringify({version:1,config:this.config,resources:this.resources,stats:this.stats,upgrades:this.upgrades,claimed:this.claimed,xp:this.xp,time:this.time,agents:this.agents,stock:this.stock,marketStock:this.marketStock,log:this.log}));}
 restore(s){if(s?.version!==1||s.config?.seed!==this.config.seed||s.config?.radius!==this.config.radius||s.config?.height!==this.config.height)return;
  const number=n=>Number.isFinite(n)&&n>=0&&n<1e9;
  if(!Object.keys(this.resources).every(k=>number(s.resources?.[k]))||!Object.keys(this.stats).every(k=>number(s.stats?.[k]))||!number(s.xp)||!number(s.time)||!Array.isArray(s.claimed))return;
  this.resources={...s.resources};this.stats={...s.stats};this.xp=s.xp;this.time=s.time;this.claimed=s.claimed.filter(id=>QUESTS.some(q=>q.id===id));for(const key of Object.keys(this.upgrades))this.upgrades[key]=s.upgrades?.[key]===true;
  if(Array.isArray(s.agents)&&s.agents.length===5&&s.agents.every((a,i)=>a.id===i&&a.home===this.agents[i].home&&a.work===this.agents[i].work&&a.resource===this.agents[i].resource&&a.amount===this.agents[i].amount&&STATE_NAMES[a.state]&&Number.isFinite(a.x)&&Number.isFinite(a.z)&&Number.isFinite(a.timer)&&number(a.cooldown)&&number(a.cycles)&&this.nav.endpoints.has(a.node)&&this.nav.endpoints.has(a.destination)&&Number.isInteger(a.index)&&a.index>=0&&(a.partner===null||Number.isInteger(a.partner)&&a.partner>=0&&a.partner<5)&&(!a.cargo||a.cargo.resource===a.resource&&number(a.cargo.amount))&&Array.isArray(a.path)&&a.index<=a.path.length&&a.path.every(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]))))this.agents=s.agents;
  this.stock=s.stock||{};this.marketStock=s.marketStock||{};this.message('已恢復島嶼存檔。');
 }
}
