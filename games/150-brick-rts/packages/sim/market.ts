// The 建築 round's economy buildings (design_default after aoetw.com's market, trade and wonder pages, 2026-10-01; see
// docs/aoe2-rules-research.md): the market's exchange, trade carts and cogs, and the wonder's countdown.
import {obstacleBounds} from '../content/footprints.ts';
import type {Resource} from '../content/rules.ts';
import {nodesNear,position,blockedFor,navigationRules} from './navigation.ts';
import {routeTo,cancelMovement,layerOf} from './movement.ts';
import type {Unit} from './movement.ts';
import {reach} from './combat.ts';
import type {CombatState} from './combat.ts';
import type {Building} from './buildings.ts';
import {ownerOf,marketFeeOf} from './civ.ts';
import {religionRules} from './religion.ts';
// Fair prices of 100 units, shared by both players (the reference's market): each sale lowers that resource's price by
// step, each purchase raises it, within [min, max]. A sale pays the price less the fee, a purchase costs the price plus
// the fee (30%; Guilds 15%, Saracens 5%: civ.ts marketFeeOf), rounded to whole gold. Selling 4000 food from the start
// yields 1708 gold, as the site's example. Trade: gold per round trip after the AoE II formula 0.46·D·(D/S+0.3) (D: tiles between the two
// buildings, S: the map's side in tiles), scaled x3 (1.4 instead of 0.46) so a trip pays on this small map; cogs
// bring 75% of a cart's (aoetw: about 25% less at the same distance).
export const marketRules={provenance:'design_default',start:{food:100,wood:100,stone:130},lot:100,step:2,min:20,max:9999,fee:30,
 trade:{factor:1.4,base:0.3,cog:0.75,reach:100,retries:3}} as const;
export type MarketResource='food'|'wood'|'stone';
export const marketResources:readonly MarketResource[]=['food','wood','stone'];
export type Prices=Record<MarketResource,number>;
// home: the trade unit's own market or dock (where gold is paid); target: the other player's; leg: where it is heading.
export type TradeRoute={home:string;target:string;leg:'out'|'back';retries:number};
// wonders: when each finished wonder wins (by building id); wonderVictory: the one that wins first.
export type WonderVictory={player:number;building:string;endsTick:number};
export type MarketState=CombatState&{relicVictory?:unknown;market:Prices;trades:Record<number,TradeRoute>;wonders:Record<string,number>;wonderVictory:WonderVictory|null};
export const startPrices=():Prices=>({...marketRules.start});
const names:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
// What 100 units sell for and cost this owner now.
export function marketQuote(prices:Prices,o:Parameters<typeof marketFeeOf>[0],resource:MarketResource){
 const fee=marketFeeOf(o,marketRules.fee),p=prices[resource];return {sell:Math.floor((p*(100-fee)+50)/100),buy:Math.floor((p*(100+fee)+50)/100),fee};}
const hasMarket=(s:MarketState,player:number)=>s.buildings.some(b=>b.player===player&&b.kind==='market'&&b.complete);
export function marketProblem(s:MarketState,player:number,action:unknown,resource:unknown):string|null{
 if(action!=='buy'&&action!=='sell')return '無效的交易';if(!marketResources.includes(resource as MarketResource))return '市集只買賣食物、木材與石頭';
 if(!hasMarket(s,player))return '需要一座完工的市集';
 const q=marketQuote(s.market,ownerOf(s,player),resource as MarketResource),stock=s.accounts[player].stock;
 if(action==='sell'&&stock[resource as Resource]<marketRules.lot)return `${names[resource as string]}不足：需要 ${marketRules.lot}，目前 ${stock[resource as Resource]}`;
 if(action==='buy'&&stock.gold<q.buy)return `黃金不足：需要 ${q.buy}，目前 ${stock.gold}`;
 return null;}
// One transaction of 100 units at the current price; then the shared price moves.
export function marketTrade(s:MarketState,player:number,action:'buy'|'sell',resource:MarketResource){
 const problem=marketProblem(s,player,action,resource);if(problem)throw Error(problem);
 const a=s.accounts[player],q=marketQuote(s.market,ownerOf(s,player),resource),lot=marketRules.lot,R=marketRules;
 if(action==='sell'){a.stock[resource]-=lot;a.stock.gold+=q.sell;a.ledger.market[resource]-=lot;a.ledger.market.gold+=q.sell;s.market[resource]=Math.max(R.min,s.market[resource]-R.step);}
 else{a.stock.gold-=q.buy;a.stock[resource]+=lot;a.ledger.market.gold-=q.buy;a.ledger.market[resource]+=lot;s.market[resource]=Math.min(R.max,s.market[resource]+R.step);}
}
// Trade: a cart goes between markets, a cog between docks (its own and the other player's).
export const tradeHome:Record<string,string>={'trade-cart':'market','trade-cog':'dock'};
const boxOf=(s:MarketState,id:string)=>{const o=s.map.obstacles.find(o=>o.id===id);return o?obstacleBounds(o):null;};
const centre=(b:number[])=>({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2});
// The unit's nearest finished building of its home kind (lowest id on ties).
function homeOf(s:MarketState,u:Unit):Building|null{
 const kind=tradeHome[u.kind];let best:Building|null=null,dist=Infinity;
 for(const b of s.buildings){if(b.player!==u.player||b.kind!==kind||!b.complete)continue;const box=boxOf(s,b.id);if(!box)continue;const d=reach(u,box);if(d<dist||d===dist&&best&&b.id<best.id){best=b;dist=d;}}
 return best;}
export function tradeProblem(s:MarketState,player:number,unitIds:number[],buildingId:unknown):string|null{
 const units=unitIds.map(id=>s.units.find(u=>u.id===id));if(units.some(u=>!u||!(u.kind in tradeHome)))return '只有貿易車隊與貿易商船能貿易';
 const b=typeof buildingId==='string'?s.buildings.find(b=>b.id===buildingId):undefined,known=b&&s.vision[player].known.some(k=>k.obstacle.id===b.id);
 if(!b)return '找不到這棟建築';if(b.player===player)return '只能與對手的市集或碼頭貿易';if(!known)return '找不到這棟建築';if(!b.complete)return '對方的建築尚未完工';
 for(const u of units as Unit[]){if(b.kind!==tradeHome[u.kind])return u.kind==='trade-cart'?'貿易車隊只能前往對手的市集':'貿易商船只能前往對手的碼頭';
  if(!homeOf(s,u))return u.kind==='trade-cart'?'需要一座己方完工的市集':'需要一座己方完工的碼頭';}
 return null;}
export function commandTrade(s:MarketState,unitIds:number[],buildingId:string){
 for(const id of unitIds){const u=s.units.find(u=>u.id===id),home=u&&homeOf(s,u);if(!u||!home)continue;cancelMovement(s,id);delete s.works[id];delete s.attacks[id];
  s.trades[id]={home:home.id,target:buildingId,leg:'out',retries:0};}}
export function clearTrades(s:MarketState,unitIds:number[]){for(const id of unitIds)delete s.trades[id];}
// Gold for one round trip between two buildings (whole gold).
export function tradeGold(s:{map:{size:number}},kind:string,home:number[],target:number[]){
 const a=centre(home),b=centre(target),T=marketRules.trade,d=Math.hypot(a.x-b.x,a.y-b.y)/100;
 return Math.round(d*(d/s.map.size+T.base)*T.factor*(kind==='trade-cog'?T.cog:1));}
// The free nodes round a building on the unit's layer (land for carts, water for cogs).
function dockNodes(s:MarketState,u:Unit,box:number[]){const closed=blockedFor(s.map,layerOf(u.kind)),r=navigationRules.radius,R=marketRules.trade.reach;
 return nodesNear(s.map,box,R+r).filter(n=>{if(closed[n])return false;const d=reach(position(s.map,n),box);return d>r&&d<=r+R;});}
export function stepTrade(s:MarketState){
 const busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const id of Object.keys(s.trades).map(Number).sort((a,b)=>a-b)){const t=s.trades[id],u=s.units.find(u=>u.id===id);
  const home=s.buildings.find(b=>b.id===t.home),target=s.buildings.find(b=>b.id===t.target),hb=home&&boxOf(s,home.id),tb=target&&boxOf(s,target.id);
  // Either end gone (or the unit changed sides): the route ends where the unit is.
  if(!u||!home||!target||!hb||!tb||!home.complete||home.player!==u.player||target.player===u.player){delete s.trades[id];if(u&&!u.path.length&&u.next===null)u.navigation='idle';continue;}
  if(u.next!==null||u.path.length||busy.has(u.id))continue;
  const box=t.leg==='out'?tb:hb;
  if(reach(u,box)<=navigationRules.radius+marketRules.trade.reach){
   // At the far end it turns back; at home it is paid for the round trip and sets out again.
   if(t.leg==='back'){const gold=tradeGold(s,u.kind,hb,tb),a=s.accounts[u.player];if(Number.isSafeInteger(a.stock.gold+gold)){a.stock.gold+=gold;a.ledger.trade.gold+=gold;}}
   t.leg=t.leg==='out'?'back':'out';t.retries=0;}
  else if(++t.retries>marketRules.trade.retries){delete s.trades[id];u.navigation='unreachable';continue;}
  const nodes=dockNodes(s,u,t.leg==='out'?tb:hb);if(!nodes.length){delete s.trades[id];continue;}routeTo(s,u,nodes);}
}
// The wonder: a finished one wins for its owner after the relic victory's time (religionRules) unless it falls first;
// each wonder keeps its own clock (from its completion), the earliest decides.
export function stepWonders(s:MarketState){
 const T=religionRules.relics.victoryTicks;
 for(const id of Object.keys(s.wonders))if(!s.buildings.some(b=>b.id===id&&b.kind==='wonder'&&b.complete))delete s.wonders[id];
 for(const b of [...s.buildings].sort((a,b)=>a.id<b.id?-1:1))if(b.kind==='wonder'&&b.complete&&!(b.id in s.wonders))s.wonders[b.id]=s.tick+T;
 let best:WonderVictory|null=null;
 for(const [id,endsTick] of Object.entries(s.wonders).sort(([a],[b])=>a<b?-1:1)){const b=s.buildings.find(b=>b.id===id)!;if(!best||endsTick<best.endsTick)best={player:b.player,building:id,endsTick};}
 s.wonderVictory=best;
 if(best&&!s.outcome&&s.tick>=best.endsTick)s.outcome={winner:best.player,defeated:[1-best.player],tick:s.tick,reason:'wonder'};
}
