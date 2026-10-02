// The 科技樹 category's data model (pure, node-tested): a civilization's tree laid out like aoetw.com's civ tree pages
// (packages/content/tree-layout.ts: a block per building, rows Dark → Imperial, a column per line with its upgrades
// below it, the site's arrows), and the marks a match puts on it. Availability, costs and prerequisites come from
// rules.ts and civ.ts; the layout only says where things sit.
import {civDefs,neutralCiv,uniqueUnitOwner,civById} from '../../packages/content/civs.ts';
import {rules,resources} from '../../packages/content/rules.ts';
import type {Resource} from '../../packages/content/rules.ts';
import {lineUpgrades} from '../../packages/sim/stats.ts';
import {costOf,civAvailable} from '../../packages/sim/civ.ts';
import {treeIntro,treeNote,aoetwUnits,aoetwTechs} from '../../packages/content/codex.ts';
import {treeLayout,treeBuildBlock,treeLeads} from '../../packages/content/tree-layout.ts';
import type {TreeLayoutBlock,TreeLayoutItem} from '../../packages/content/tree-layout.ts';
import {civDetail,pendingLines,pendingTechs,ageName,lineStepIds} from './codex-model.ts';
import type {CodexSection,Cost} from './codex-model.ts';
export {treeIntro,treeNote};
const entryOf=(id:string)=>rules.entries.find(e=>e.id===id);
const nameOf=(id:string)=>entryOf(id)?.name??id;
const ageOf=(id:string)=>{const m=/^age-(\d)$/.exec(id);return m?Number(m[1]):0;};
// The site's blocks in page order, with the villagers' build block after the town centre.
const blocks:readonly TreeLayoutBlock[]=treeLayout.flatMap(b=>b.id==='town-center'?[b,treeBuildBlock]:[b]);
export const treeBlockOrder=blocks.map(b=>b.id);
export type TreeNodeKind='unit'|'technology'|'building'|'age'|'ref';
// key: unique within the tree; id: the rules entry (or the reference item's id); alias: a step another column
// already shows as an entry (War Galley makes fire ships and demolition ships too); needs: prerequisites researched in
// another block (Chemistry for the gunpowder units); leads: what upgrades it in another block; link: the codex page it
// opens (null: none).
export type TreeNode={key:string;id:string;name:string;kind:TreeNodeKind;age:number;icons:string[];available:boolean;alias:boolean;unique:boolean;
 reason:string|null;needs:string[];leads:string[];link:{section:CodexSection;id:string}|null};
// One grid cell: the nodes of one column in one age, stacked (links[i]: node i leads to node i+1); down: the column
// goes on below this cell; up: it came from above; pipe: an empty cell the connector passes through.
export type TreeCell={nodes:TreeNode[];links:boolean[];down:boolean;up:boolean;pipe:boolean};
export type TreeBlock={id:string;name:string;head:TreeNode|null;ages:number[];columns:TreeCell[][]};
export type CivTree={civ:string;name:string;type:string;bonuses:string[];team:string[];blocks:TreeBlock[]};
const unitIcon=(id:string)=>[`${id}-face`];
const buildingIcons=(id:string,age:number)=>id==='farm'?['farm']:[`${id}-${age}`,`${id}-${Math.max(age,2)}`,`${id}-3`,`${id}-4`,`${id}-2`,`${id}-1`];
// The age an entry first becomes possible, for entries the layout does not place (the block heads).
function entryAge(id:string,path:readonly string[]=[]):number{
 const e=entryOf(id);if(!e||path.includes(id))return 1;let age=1;
 for(const r of e.requires)age=Math.max(age,ageOf(r)||entryAge(r,[...path,id]));return age;}
// Prerequisites researched in another block than this one (Chemistry for the hand cannoneer).
function needsOf(id:string,block:string):string[]{
 return (entryOf(id)?.requires??[]).filter(r=>!ageOf(r)&&entryOf(r)?.kind==='technology'&&rules.production[r]!==block).map(nameOf);}
// A rules entry as a node for this civilization, in the row of the given age.
function entryNode(id:string,civ:string,age:number,block:string):TreeNode{
 const e=entryOf(id)!,up=lineUpgrades.find(u=>u.id===id),available=civAvailable(civ,id),unique=!!uniqueUnitOwner[id];
 const base={key:id,id,age,available,alias:false,unique,reason:null,needs:needsOf(id,block),leads:(treeLeads[id]??[]).map(nameOf)};
 if(ageOf(id))return {...base,name:e.name,kind:'age',icons:[`town-center-${ageOf(id)}`],link:null};
 if(up)return {...base,name:up.name,kind:'unit',icons:unitIcon(up.kind),link:{section:'units',id:up.kind}};
 if(e.kind==='unit')return {...base,name:e.name,kind:'unit',icons:unitIcon(id),link:{section:'units',id}};
 if(e.kind==='building')return {...base,name:e.name,kind:'building',icons:buildingIcons(id,age),link:{section:'buildings',id}};
 return {...base,name:e.name,kind:'technology',icons:[`tech-${id}`],link:{section:'techs',id}};}
// A reference item (a site cell this game lacks): its codex page when the book lists it (units and technologies the
// game lacks), with the reason.
function refNode(it:TreeLayoutItem,age:number,key:string):TreeNode{
 const u=aoetwUnits.find(x=>`/units/${x.slug}`===it.path),line=u?pendingLines().find(l=>l.steps.some(s=>s.id===u.id)):undefined;
 const t=aoetwTechs.find(x=>`/${x.page}`===it.path),tech=t?pendingTechs().find(p=>p.id===t.id):undefined;
 return {key,id:u?.id??t?.id??it.path!,name:it.ref!,kind:'ref',age,icons:[],available:false,alias:false,unique:false,needs:[],leads:[],
  reason:line?.reason??tech?.reason??'本作沒有這個項目',link:line?{section:'units',id:line.id}:tech?{section:'techs',id:tech.id}:null};}
// Is b the step after a in a unit line (lines: the line each unit node belongs to)?
const nextStep=(lines:Map<TreeNode,string>,a:TreeNode,b:TreeNode)=>{const k=lines.get(a);if(!k||lines.get(b)!==k)return false;const ids=lineStepIds(k),i=ids.indexOf(a.id);return i>=0&&ids[i+1]===b.id;};
// A site arrow is drawn only where it holds here: both ends reference items, or b requires a, or b is a's next step.
const realArrow=(lines:Map<TreeNode,string>,a:TreeNode,b:TreeNode)=>a.kind==='ref'||b.kind==='ref'?a.kind==='ref'&&b.kind==='ref':
 (entryOf(b.id)?.requires.includes(a.id)??false)||nextStep(lines,a,b);
type Placed={node:TreeNode;down:boolean};
const emptyCell=():TreeCell=>({nodes:[],links:[],down:false,up:false,pipe:false});
// One block from the layout: cells resolved for this civilization (the castle's unique unit and technologies; another
// civilization's unique item the site shows in a common block, the dock's longboat, greyed as the site does), then the
// connectors.
function block(b:TreeLayoutBlock,civ:string,refs:boolean,placed:Set<string>):TreeBlock{
 const c=civById(civ)!,ages=b.rows.map(r=>r.age),cols=Math.max(...b.rows.map(r=>r.cells.length));
 const unit=c.uniqueUnits.find(u=>rules.production[u]==='castle')??null,elite=unit?lineUpgrades.find(l=>l.kind===unit)?.id??null:null;
 const grid:Placed[][][]=Array.from({length:cols},()=>ages.map(()=>[]));
 b.rows.forEach((row,r)=>row.cells.forEach((items,col)=>{for(const [i,it] of items.entries()){
  if(it.ref){if(refs)grid[col][r].push({node:refNode(it,row.age,`ref:${b.id}:${r}:${col}:${i}`),down:!!it.down});continue;}
  const ids=it.id==='@unique-unit'?[row.age<4?unit:elite]:it.id==='@unique-tech'?c.uniqueTechs.filter(t=>t.age===row.age&&entryOf(t.id)).map(t=>t.id):[it.id!];
  for(const id of ids)if(id&&entryOf(id))grid[col][r].push({node:entryNode(id,civ,row.age,b.id),down:it.id==='@unique-unit'?row.age<4:!!it.down});}}));
 // The line each unit node belongs to: a unit its own; a line upgrade the nearest unit above it in the column whose line
 // has it (the fire galley above War Galley's cell). A line upgrade the site shows in several columns (War Galley) is
 // the entry in its own line's column and an alias elsewhere, named for what it makes of that line.
 const lines=new Map<TreeNode,string>();
 grid.forEach(colCells=>{const seen:TreeNode[]=[];for(const cell of colCells)for(const p of cell){const n=p.node;if(n.kind==='ref'){seen.push(n);continue;}
  if(entryOf(n.id)?.kind==='unit')lines.set(n,n.id);
  else if(lineUpgrades.some(l=>l.id===n.id)){const above=[...seen].reverse().find(m=>lines.has(m)&&lineUpgrades.some(l=>l.id===n.id&&l.kind===lines.get(m)));
   lines.set(n,above?lines.get(above)!:lineUpgrades.find(l=>l.id===n.id)!.kind);}
  seen.push(n);}});
 for(const [n,kind] of lines){if(n.id===kind)continue;const mine=lineUpgrades.find(l=>l.id===n.id&&l.kind===kind)!,first=lineUpgrades.find(l=>l.id===n.id)!;
  if(first.kind!==kind)Object.assign(n,{key:`${kind}:${n.id}`,name:mine.name,alias:true,icons:unitIcon(kind),link:{section:'units',id:kind},available:civAvailable(civ,n.id)&&civAvailable(civ,kind)});
  // A line's later steps exist only where the civilization has the line's first unit (no fast fire ships without fire galleys).
  else n.available=n.available&&civAvailable(civ,kind);}
 for(const colCells of grid)for(const cell of colCells)for(const p of cell)if(p.node.kind!=='ref'&&!p.node.alias)placed.add(p.node.id);
 // Connectors: within a cell from one stacked node to the next, and down the column to the next filled cell.
 const columns:TreeCell[][]=grid.map(colCells=>colCells.map(cell=>({...emptyCell(),nodes:cell.map(p=>p.node),links:cell.slice(1).map(()=>false)})));
 grid.forEach((colCells,col)=>{
  colCells.forEach((cell,r)=>cell.forEach((p,i)=>{if(!p.down)return;
   if(i<cell.length-1){if(realArrow(lines,p.node,cell[i+1].node))columns[col][r].links[i]=true;return;}
   const below=colCells.findIndex((x,rr)=>rr>r&&x.length>0);if(below<0||!realArrow(lines,p.node,colCells[below][0].node))return;
   columns[col][r].down=true;columns[col][below].up=true;for(let rr=r+1;rr<below;rr++)columns[col][rr].pipe=true;}));});
 const head=b.id==='build'?null:entryNode(b.id,civ,entryAge(b.id),b.id);if(head)placed.add(b.id);
 return {id:b.id,name:head?.name??'村民建造',head,ages,columns:columns.filter(col=>col.some(cell=>cell.nodes.length))};}
// Entries the site's grid has no cell for (none at present; kept so a new entry still shows up): appended to their
// producer's block, or the build block for a building, each in its own column.
function appendRest(t:TreeBlock[],civ:string,placed:Set<string>){
 for(const e of rules.entries){if(placed.has(e.id)||uniqueUnitOwner[e.id]&&uniqueUnitOwner[e.id]!==civ)continue;
  const b=t.find(x=>x.id===rules.production[e.id])??t.find(x=>x.id==='build')!,age=entryAge(e.id);
  if(!b.ages.includes(age)){const i=b.ages.findIndex(a=>a>age),at=i<0?b.ages.length:i;b.ages.splice(at,0,age);for(const col of b.columns)col.splice(at,0,emptyCell());}
  const r=b.ages.indexOf(age);b.columns.push(b.ages.map((_,rr)=>rr===r?{...emptyCell(),nodes:[entryNode(e.id,civ,age,b.id)]}:emptyCell()));placed.add(e.id);}}
// The whole tree of one civilization (the neutral one included). refs: also the reference items the game lacks.
export function civTree(civ:string,refs=true):CivTree{
 const c=civById(civ)??civById(neutralCiv)!,d=civDetail(c.id),placed=new Set<string>();
 const t=blocks.map(b=>block(b,c.id,refs,placed));appendRest(t,c.id,placed);
 return {civ:c.id,name:c.name,type:c.type,bonuses:d.bonuses,team:d.team,blocks:t};}
export const treeCivs=()=>[...civDefs.filter(c=>c.id!==neutralCiv),...civDefs.filter(c=>c.id===neutralCiv)].map(c=>({id:c.id,name:c.name,type:c.type}));
// Every node of a tree, in block order.
export const treeNodes=(t:CivTree)=>t.blocks.flatMap(b=>[...(b.head?[b.head]:[]),...b.columns.flat().flatMap(c=>c.nodes)]);
// ── Match marks ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The page's own state for player 0 (its snapshot): civilization, age, research, stock, own buildings with their
// queues and the count of own units by kind.
export type TreeMatch={civ:string;age:number;techs:readonly string[];stock:Readonly<Record<Resource,number>>;
 buildings:readonly {kind:string;complete:boolean;queue:readonly {entryId:string}[]}[];units:Readonly<Record<string,number>>};
// done: researched or reached; owned: on the field (count); queued: in a queue or a foundation; ready: can be started
// now (requirements met, a producer standing, affordable); short: requirements met but not the resources; later:
// requirements not met yet; off: not in this civilization's tree; ref: not in this game.
export type TreeMark={state:'done'|'owned'|'queued'|'ready'|'short'|'later'|'off'|'ref';count:number;cost:Cost|null};
export const treeMarkLabels:Record<TreeMark['state'],string>={done:'已完成',owned:'已擁有',queued:'進行中',ready:'現在可做',short:'資源不足',later:'條件未到',off:'此文明沒有',ref:'本作沒有'};
export function treeMark(n:TreeNode,m:TreeMatch):TreeMark{
 if(n.kind==='ref')return {state:'ref',count:0,cost:null};
 if(!n.available)return {state:'off',count:0,cost:null};
 const id=n.id,e=entryOf(id)!,o={civ:m.civ,age:m.age,techs:[...m.techs]},cost=costOf(id,o);
 const own=(kind:string)=>m.buildings.some(b=>b.kind===kind&&b.complete);
 const queued=m.buildings.some(b=>b.queue.some(q=>q.entryId===id))||e.kind==='building'&&m.buildings.some(b=>b.kind===id&&!b.complete);
 const count=e.kind==='building'?m.buildings.filter(b=>b.kind===id&&b.complete).length:e.kind==='unit'?m.units[id]??0:0;
 if(ageOf(id)?m.age>=ageOf(id):e.kind==='technology'&&m.techs.includes(id))return {state:'done',count,cost};
 if(queued)return {state:'queued',count,cost};
 const met=e.requires.every(r=>{const a=ageOf(r);if(a)return m.age>=a;const q=entryOf(r);return q?.kind==='technology'?m.techs.includes(r):q?.kind==='building'?own(r):true;})&&(e.kind==='building'||own(rules.production[id]??''));
 if(count>0)return {state:'owned',count,cost};
 if(!met)return {state:'later',count,cost};
 return {state:resources.every(r=>m.stock[r]>=cost[r])?'ready':'short',count,cost};}
export {ageName};
