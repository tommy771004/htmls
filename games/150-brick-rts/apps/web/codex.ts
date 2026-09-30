// The in-game encyclopedia (「百科」), category 文明 only for now: a civilization list and a detail pane rendered into the
// page's #codex overlay. DOM only; every value comes from codex-model.ts (pure, node-tested). Styles are injected once
// and scoped under .cx-; they reuse the page's tokens (plate, tile, gold) so the book reads as one of the game's panels.
import {civList,civDetail,codexCivs,codexIntro,rangeText,secondsText,cooldownSeconds,tilesPerSecond,numberText,costEntries,ageName} from './codex-model.ts';
import type {CivDetail,CivListItem,StatSheet,UnitCard,TechCard,Cost} from './codex-model.ts';
export type CodexContext={civs:string[];icons:Record<string,string>;onClose:()=>void};
const resourceNames:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
const css=`
.cx-host{display:grid;place-items:center;padding:16px}.cx-host[hidden]{display:none}
.cx{--cx-well:var(--well,#26332d);--cx-tile:var(--tile,#415349);--cx-edge:var(--tile-edge,#27342e);--cx-gold:var(--gold,#d8b45a);--cx-muted:var(--muted,#a9b4a4);--cx-cream:var(--cream,#efe6cf);
 width:min(1100px,100%);height:min(820px,100%);display:grid;grid-template-rows:auto minmax(0,1fr);background:var(--plate,#2f3f38);border-bottom:6px solid var(--plate-edge,#1f2a25);border-radius:4px;overflow:hidden;color:var(--cx-cream);font-size:14px;line-height:1.55}
.cx *{box-sizing:border-box}
.cx-head{position:relative;display:flex;align-items:center;gap:10px 16px;padding:12px 16px 19px 20px;border-bottom:3px solid var(--plate-edge,#1f2a25)}
.cx-head::after{content:"";position:absolute;left:0;right:0;bottom:4px;height:6px;background:radial-gradient(circle at 8px 3px,var(--plate-stud,#3b4d45) 3.5px,transparent 4px) 0 0/16px 6px repeat-x;pointer-events:none}
.cx-head h2{margin:0;font-size:20px;line-height:1.2;color:var(--cx-gold);letter-spacing:.1em}
.cx-cat{margin:0;font-size:14px;font-weight:650;color:var(--cx-cream)}.cx-cat::before{content:"/";margin-right:12px;color:var(--cx-muted);font-weight:400}
.cx-close{margin-left:auto;height:34px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;background:var(--cx-tile);border:0;border-bottom:3px solid var(--cx-edge);border-radius:3px;font-weight:650;font-size:13px;color:var(--cx-cream)}
.cx-close:hover{background:var(--tile-hover,#4c6155)}.cx-close:active{border-bottom-width:1px;padding-top:2px}.cx-close kbd{font:600 11px/1 system-ui,sans-serif;color:var(--cx-muted)}
@media (pointer:coarse){.cx-close kbd{display:none}}
.cx-body{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:0}
.cx-list{min-height:0;overflow:auto;background:var(--cx-well);padding:10px 10px 18px}
.cx-group{margin:14px 4px 6px;font-size:12px;font-weight:600;color:var(--cx-muted)}.cx-grp:first-child .cx-group{margin-top:2px}
.cx-list ul{list-style:none;margin:0;padding:0;display:grid;gap:5px}
.cx-civ{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0 8px;padding:7px 10px 6px;background:var(--cx-tile);border:0;border-bottom:3px solid var(--cx-edge);border-radius:3px;text-align:left;color:var(--cx-cream)}
.cx-civ:hover{background:var(--tile-hover,#4c6155)}
.cx-civ[aria-current=true]{background:#6f6034;border-bottom-color:#4a3f20;border-bottom-width:1px;padding-top:9px}
.cx-civ b{font-size:15px;font-weight:650;white-space:nowrap}.cx-civ small{grid-column:1;font-size:12px;color:var(--cx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cx-civ[aria-current=true] small{color:#e6d9b2}
.cx-mark{grid-column:2;grid-row:1/3;font-size:11.5px;font-weight:650;white-space:nowrap}.cx-mark.self{color:#a8cbe0}.cx-mark.rival{color:#f2b4a4}.cx-mark.both{color:var(--cx-gold)}
.cx-detail{min-width:0;min-height:0;overflow:auto;padding:20px 26px 30px;overscroll-behavior:contain}
.cx-page{max-width:880px}
@media (prefers-reduced-motion:no-preference){.cx-page{animation:cx-in .2s cubic-bezier(.2,.7,.2,1)}}
@keyframes cx-in{from{transform:translateY(8px)}}
.cx-page h3{margin:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;font-size:28px;line-height:1.2;letter-spacing:.04em}
.cx-page h3 span{font-size:14px;font-weight:500;letter-spacing:0;color:var(--cx-muted)}
.cx-sub{margin:6px 0 0;font-size:13px;color:var(--cx-muted)}.cx-sub b{font-weight:650}.cx-sub .self{color:#a8cbe0}.cx-sub .rival{color:#f2b4a4}.cx-sub .both{color:var(--cx-gold)}
.cx-summary{margin:14px 0 0;font-size:15px;line-height:1.75;max-width:46em}
.cx-page h4{margin:28px 0 10px;font-size:15px;color:var(--cx-gold);letter-spacing:.08em}
.cx-page h4 small{margin-left:10px;font-size:12px;font-weight:500;letter-spacing:0;color:var(--cx-muted)}
.cx-page p{margin:0}.cx-prose{max-width:46em;line-height:1.75}
.cx-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0 32px}
.cx-bricks{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.cx-bricks li{display:flex;gap:10px;align-items:flex-start}
.cx-bricks li::before{content:"";flex:none;width:10px;height:7px;margin-top:8px;background:var(--cx-gold);border-radius:1.5px;box-shadow:inset 0 -2px 0 rgba(60,44,10,.45)}
.cx-bricks.off li::before{background:transparent;box-shadow:inset 0 0 0 1.5px var(--cx-muted)}
.cx-bricks small{display:block;font-size:12.5px;color:var(--cx-muted)}
.cx-note{font-size:12.5px;color:var(--cx-muted);margin:0 0 10px!important}
.cx-unit{display:grid;grid-template-columns:112px minmax(0,1fr);gap:4px 18px;padding:14px;background:var(--cx-well);border-radius:3px}.cx-unit+.cx-unit{margin-top:10px}.cx-unit.no-face{grid-template-columns:minmax(0,1fr)}
.cx-uhead,.cx-ubody{grid-column:2;min-width:0}.cx-unit.no-face>div{grid-column:1}
.cx-face{grid-row:1/3;width:112px;height:112px;display:grid;place-items:center;background:#384a41;border-bottom:4px solid var(--cx-edge);border-radius:3px;overflow:hidden}.cx-face img{width:100%;height:100%;object-fit:contain}
.cx-unit h5,.cx-tech h5{margin:0;font-size:17px;line-height:1.3;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px}.cx-unit h5 span,.cx-tech h5 span{font-size:12.5px;font-weight:500;color:var(--cx-muted)}
.cx-uhead p{margin:4px 0 0!important}
.cx-cost{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;margin:10px 0 0;font-variant-numeric:tabular-nums;font-weight:600}.cx-cost span{display:inline-flex;align-items:center;gap:4px}.cx-cost img{width:20px;height:20px;object-fit:contain}.cx-cost .t{font-weight:500;color:var(--cx-muted)}
.cx-stats{width:100%;max-width:560px;margin:12px 0 0;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.cx-stats th,.cx-stats td{padding:4px 10px 4px 0;text-align:left;vertical-align:top}.cx-stats thead th{font-size:12px;font-weight:600;color:var(--cx-gold)}
.cx-stats tbody th{width:6.5em;font-weight:500;color:var(--cx-muted);white-space:nowrap}.cx-stats tbody tr:nth-child(odd){background:rgba(0,0,0,.12)}.cx-stats tbody th{padding-left:8px}
.cx-stats td.up{color:#e7d59a}
.cx-elite{margin:12px 0 0;font-size:13px;color:var(--cx-muted)}.cx-elite .cx-cost{margin-top:4px}.cx-elite b{color:var(--cx-cream);font-weight:600}
.cx-techs{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px}
.cx-tech{padding:12px 14px 14px;background:var(--cx-well);border-radius:3px}.cx-tech.off{background:#222d28}
.cx-tech .cx-age{margin:2px 0 0;font-size:12.5px;color:var(--cx-muted)}.cx-tech .cx-bricks{margin-top:10px}.cx-tech .cx-cost{margin-top:8px}
.cx-flag{color:#f3b19f;font-weight:650}
.cx-tree{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:6px 16px;margin:0}.cx-tree dt{color:var(--cx-muted)}.cx-tree dd{margin:0}
.cx-later{margin-top:14px!important;font-size:13px;color:var(--cx-muted)}.cx-later b{font-weight:600;color:var(--cx-cream)}
.cx-foot{margin-top:34px;padding-top:14px;border-top:3px solid rgba(0,0,0,.18);font-size:12.5px;color:var(--cx-muted);max-width:52em}.cx-foot p+p{margin-top:6px}
@media (max-width:760px){
 .cx{width:100%;height:100%}
 .cx-head{padding:10px 16px 17px}.cx-head h2{font-size:18px}
 .cx-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
 .cx-list{display:flex;gap:5px;overflow-x:auto;overflow-y:hidden;padding:8px 16px 10px}
 .cx-grp,.cx-list ul,.cx-list li{display:contents}.cx-group{display:none}
 .cx-civ{flex:none;width:auto;padding:6px 12px 5px}.cx-civ[aria-current=true]{padding-top:8px}.cx-civ small{display:none}.cx-mark{grid-row:1}
 .cx-detail{padding:16px 16px 26px}.cx-page h3{font-size:24px}.cx-summary{font-size:14.5px}
 .cx-unit{grid-template-columns:72px minmax(0,1fr);gap:4px 12px;padding:12px}.cx-face{grid-row:1;width:72px;height:72px}.cx-ubody{grid-column:1/-1}
 .cx-stats{font-size:12.5px}.cx-stats th,.cx-stats td{padding-right:6px}.cx-stats tbody th{width:auto}
 .cx-cols{grid-template-columns:minmax(0,1fr)}.cx-techs{grid-template-columns:minmax(0,1fr)}
}`;
type Kid=Node|string|null|undefined|false;
function h<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,string>|null,...kids:Kid[]):HTMLElementTagNameMap[K]{
 const e=document.createElement(tag);if(attrs)for(const [k,v] of Object.entries(attrs))k==='class'?e.className=v:e.setAttribute(k,v);
 for(const k of kids)if(k!==null&&k!==undefined&&k!==false)e.append(k);return e;}
let open:{host:HTMLElement;ctx:CodexContext;prev:Element|null;list:HTMLElement;detail:HTMLElement}|null=null,chosen:string|null=null;
const roleText={self:'你的文明',rival:'對手',both:'雙方'} as const;
function costRow(icons:Record<string,string>,cost:Cost,seconds:number|null,extra?:string){
 const row=h('p',{class:'cx-cost'});
 for(const [r,v] of costEntries(cost)){const s=h('span',null);if(icons[r])s.append(h('img',{src:icons[r],alt:resourceNames[r]}));else s.append(`${resourceNames[r]} `);s.append(String(v));row.append(s);}
 if(!costEntries(cost).length)row.append(h('span',null,'免費'));
 if(seconds!==null)row.append(h('span',{class:'t'},secondsText(seconds)));if(extra)row.append(h('span',{class:'t'},extra));
 return row;}
const attackText=(s:StatSheet)=>s.attack==='none'?'無':`${s.damage}（${s.attack==='melee'?'近戰':'遠程'}）`;
const bonusText=(s:StatSheet)=>s.bonus.length?s.bonus.map(b=>`對${b.label} +${b.value}`).join('、'):'無';
function specialText(s:StatSheet){const out:string[]=[];
 if(s.regen)out.push(`每分鐘回復 ${s.regen} 生命`);if(s.extraShots)out.push(`每次多射 ${s.extraShots} 支箭（每支 ${s.extraDamage}）`);if(s.splash)out.push(`目標旁的敵兵受 ${s.splash} 點踐踏傷害`);
 return out.join('；');}
function statTable(u:UnitCard){
 const rows:[string,(s:StatSheet)=>string,string?][]=[['生命',s=>String(s.hp)],['攻擊',attackText],['射程',s=>rangeText(s.range).replace('射程 ','')],['護甲',s=>`${s.armor[0]}/${s.armor[1]}`,'近戰護甲／遠程護甲'],
  ['攻擊間隔',s=>secondsText(cooldownSeconds(s.cooldown))],['移動',s=>`${numberText(tilesPerSecond(s.speed))} 格／秒`],['額外傷害',bonusText]];
 if(specialText(u.stats)||u.elite&&specialText(u.elite.stats))rows.push(['特性',s=>specialText(s)||'無']);
 const elite=u.elite?.stats;
 return h('table',{class:'cx-stats'},h('thead',null,h('tr',null,h('td',null),h('th',{scope:'col'},'第三時代'),elite?h('th',{scope:'col'},'精銳・第四時代'):null)),
  h('tbody',null,...rows.map(([label,f,title])=>{const a=f(u.stats),b=elite?f(elite):null;
   return h('tr',null,h('th',{scope:'row',...(title?{title}:{})},label),h('td',null,a),b!==null?h('td',b!==a?{class:'up'}:null,b):null);})));}
function unitCard(u:UnitCard,icons:Record<string,string>){
 const face=icons[`${u.id}-face`];
 return h('article',{class:`cx-unit${face?'':' no-face'}`},face?h('div',{class:'cx-face'},h('img',{src:face,alt:''})):null,
  h('div',{class:'cx-uhead'},h('h5',null,u.name,h('span',null,u.classes.join('・'))),h('p',null,u.text)),
  h('div',{class:'cx-ubody'},costRow(icons,u.cost,u.seconds,u.at?`於${u.at}訓練`:''),statTable(u),
   u.elite?h('div',{class:'cx-elite'},'精銳升級 ',h('b',null,u.elite.name),'：',costRow(icons,u.elite.cost,u.elite.seconds,`${ageName(u.elite.age)}${u.elite.at?`於${u.elite.at}`:''}研究`)):null));}
function techCard(t:TechCard,icons:Record<string,string>){
 const card=h('article',{class:`cx-tech${t.implemented?'':' off'}`},h('h5',null,t.name,h('span',{lang:'en'},t.nameEn)),h('p',{class:'cx-age'},t.at?`${ageName(t.age)}・${t.at}`:ageName(t.age)));
 if(t.implemented){card.append(costRow(icons,t.cost!,t.seconds),h('ul',{class:'cx-bricks'},...t.effects.map(x=>h('li',null,h('span',null,x)))));
  if(t.partial.length)card.append(h('ul',{class:'cx-bricks off'},...t.partial.map(o=>h('li',null,h('span',null,h('span',{class:'cx-flag'},'尚未實作'),`：${o.text}`,h('small',null,o.reason))))));}
 else card.append(h('p',{style:'margin-top:10px'},h('span',{class:'cx-flag'},'尚未實作'),t.reason?`：${t.reason}`:''),h('p',{class:'cx-note',style:'margin:6px 0 0!important'},`原作效果：${t.reference}`));
 return card;}
function page(d:CivDetail,icons:Record<string,string>){
 const p=h('div',{class:'cx-page'});
 p.append(h('h3',{id:'cx-civ-name'},d.name,h('span',{lang:'en'},d.nameEn)),
  h('p',{class:'cx-sub'},`${d.type}・${d.group}${d.architecture==='neutral'?'':'建築'}`,d.role?'・':'',d.role?h('b',{class:d.role},roleText[d.role]):null),
  h('p',{class:'cx-summary'},d.summary),h('h4',null,'戰術'),h('p',{class:'cx-prose'},d.strategy));
 if(d.bonuses.length||d.team.length){const cols=h('div',{class:'cx-cols'});
  if(d.bonuses.length)cols.append(h('section',null,h('h4',null,'文明加成'),h('ul',{class:'cx-bricks'},...d.bonuses.map(x=>h('li',null,h('span',null,x))))));
  if(d.team.length)cols.append(h('section',null,h('h4',null,'團隊加成',h('small',null,'一對一時只作用在自己')),h('ul',{class:'cx-bricks'},...d.team.map(x=>h('li',null,h('span',null,x))))));
  p.append(cols);}
 if(d.omitted.length)p.append(h('section',null,h('h4',null,'尚未實作',h('small',null,'原作有、本作還做不到的加成')),
  h('ul',{class:'cx-bricks off'},...d.omitted.map(o=>h('li',null,h('span',null,o.text,h('small',null,o.reason)))))));
 if(d.units.length)p.append(h('section',null,h('h4',null,'特殊單位'),h('p',{class:'cx-note'},'價格與數值已含文明加成：第三時代、尚未研究任何科技；精銳欄為第四時代完成精銳升級後。'),...d.units.map(u=>unitCard(u,icons))));
 if(d.techs.length)p.append(h('section',null,h('h4',null,'特殊科技'),h('div',{class:'cx-techs'},...d.techs.map(t=>techCard(t,icons)))));
 if(d.tree.length||d.later.length){const s=h('section',null,h('h4',null,'科技樹差異',h('small',null,d.architecture==='neutral'?'本作的通用科技樹，只少了城堡':'和拓荒者的完整科技樹相比')));
  if(d.tree.length)s.append(h('dl',{class:'cx-tree'},...d.tree.flatMap(g=>[h('dt',null,g.name),h('dd',null,g.entries.map(e=>e.name).join('、'))])));
  else s.append(h('p',null,'本作現有的通用項目都能使用。'));
  if(d.later.length)s.append(h('p',{class:'cx-later'},h('b',null,'原作也缺少（本作尚無此項）：'),d.later.map(e=>e.name).join('、')));
  p.append(s);}
 p.append(h('footer',{class:'cx-foot'},h('p',null,codexIntro),d.sources.length?h('p',null,`資料來源：${d.sources.join('、')}`):null));
 return p;}
function listItem(c:CivListItem){
 return h('li',null,h('button',{type:'button',class:'cx-civ','data-civ':c.id,tabindex:'-1','aria-current':'false'},h('b',null,c.name),h('small',null,c.type),c.role?h('span',{class:`cx-mark ${c.role}`},roleText[c.role]):null));}
// Brings the chosen civ fully into the list's view (vertical list, or the phone's horizontal strip) with a 16px margin;
// scrollIntoView leaves a chip half-clipped at the strip's edge.
function reveal(list:HTMLElement,b:HTMLElement){const l=list.getBoundingClientRect(),r=b.getBoundingClientRect(),m=16;
 if(r.right>l.right-m)list.scrollLeft+=r.right-l.right+m;else if(r.left<l.left+m)list.scrollLeft-=l.left+m-r.left;
 if(r.bottom>l.bottom-m)list.scrollTop+=r.bottom-l.bottom+m;else if(r.top<l.top+m)list.scrollTop-=l.top+m-r.top;}
function select(id:string,focus=false){
 if(!open)return;chosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-civ'))){const on=b.dataset.civ===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 open.detail.replaceChildren(page(civDetail(id,open.ctx.civs),open.ctx.icons));open.detail.scrollTop=0;}
function injectStyle(){if(document.getElementById('cx-style'))return;const s=document.createElement('style');s.id='cx-style';s.textContent=css;document.head.append(s);}
export function openCodex(host:HTMLElement,ctx:{civs:string[];icons:Record<string,string>;onClose:()=>void}){
 injectStyle();const prev=open?.prev??document.activeElement;open=null;
 const items=civList(ctx.civs),groups:{label:string;items:CivListItem[]}[]=[];
 for(const c of items){const g=groups.at(-1);if(g&&g.label===c.group)g.items.push(c);else groups.push({label:c.group,items:[c]});}
 const list=h('nav',{class:'cx-list','aria-label':'文明列表'},...groups.map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-g${i}`},g.label),h('ul',{'aria-labelledby':`cx-g${i}`},...g.items.map(listItem)))));
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-civ-name',tabindex:'-1'});
 const close=h('button',{type:'button',class:'cx-close'},'關閉',h('kbd',null,'Esc'));close.onclick=()=>closeCodex();
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-civ');if(b?.dataset.civ)select(b.dataset.civ);});
 // Arrow keys walk the list (roving focus: only the chosen civ is in the tab order).
 list.addEventListener('keydown',e=>{const ids=codexCivs().map(c=>c.id),i=ids.indexOf(chosen??ids[0]);
  const next=e.key==='ArrowDown'||e.key==='ArrowRight'?Math.min(ids.length-1,i+1):e.key==='ArrowUp'||e.key==='ArrowLeft'?Math.max(0,i-1):e.key==='Home'?0:e.key==='End'?ids.length-1:null;
  if(next===null)return;e.preventDefault();select(ids[next],true);});
 host.classList.add('cx-host');if(!host.hasAttribute('role'))host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-labelledby','cx-title');
 host.replaceChildren(h('div',{class:'cx'},h('header',{class:'cx-head'},h('h2',{id:'cx-title'},'百科'),h('p',{class:'cx-cat'},'文明'),close),h('div',{class:'cx-body'},list,detail)));
 host.hidden=false;open={host,ctx,prev,list,detail};
 const first=chosen&&items.some(c=>c.id===chosen)?chosen:items.find(c=>c.role==='self'||c.role==='both')?.id??items[0].id;
 select(first,true);}
// Closes the book (its button, or the page on Esc): clears the overlay, returns focus, then tells the page once.
export function closeCodex(){
 if(!open)return;const {host,ctx,prev}=open;open=null;host.replaceChildren();host.hidden=true;
 if(prev instanceof HTMLElement&&prev.isConnected)prev.focus();ctx.onClose();}
export const codexOpen=()=>!!open;
