// The in-game encyclopedia (「百科」): categories 文明, 單位, 科技, 建築, 遊戲元素 and 戰術技巧 (a switch in the header), each a list and a detail pane
// rendered into the page's #codex overlay. DOM only; every value comes from codex-model.ts (pure, node-tested). Styles
// are injected once and scoped under .cx-; they reuse the page's tokens (plate, tile, gold) so the book reads as one of
// the game's panels.
import {civList,civDetail,codexCivs,codexIntro,rangeText,secondsText,cooldownSeconds,tilesPerSecond,numberText,costEntries,ageName,
 codexSections,unitsNote,unitLines,pendingLines,unitGroups,unitsOverview,unitCategoryName,civName,tilesText,
 techsNote,techPages,uniqueTechPages,pendingTechs,techGroups,techsOverview,
 buildingsNote,buildingPages,pendingBuildings,buildingGroupsBy,buildingsOverview} from './codex-model.ts';
import {elementPage,elementGroups,elementsIntro,elementsNote} from './codex-elements.ts';
import type {ElementPage,ElementBlock} from './codex-elements.ts';
import {tacticPage,tacticGroups,tacticsIntro,tacticsNote,basicUpgradesText,basicUpgradeItems} from './codex-tactics.ts';
import type {TacticPage,TacticBlock} from './codex-tactics.ts';
import {civTree,treeIntro,treeNote,treeMark,treeMarkLabels} from './codex-tree.ts';
import type {CivTree,TreeBlock,TreeCell,TreeNode,TreeMatch,TreeMark} from './codex-tree.ts';
import type {CivDetail,CivListItem,StatSheet,UnitCard,TechCard,Cost,CodexSection,UnitLine,PendingLine,LineStep,TechPage,UniqueTechPage,PendingTech,TechItem,
 BuildingPage,BuildingSheet,PendingBuilding,BuildingItem} from './codex-model.ts';
// speakTaunt: the page's own taunt voice (local voices only); without it the taunts table is text only.
// section: the category to open on (the page's 科技樹 key opens the book on its tree); match: the player's own state, which
// the tree marks (researched, owned, in progress, possible now).
export type CodexContext={civs:string[];icons:Record<string,string>;onClose:()=>void;speakTaunt?:(n:number)=>void;section?:CodexSection;match?:TreeMatch;treeCiv?:string};
const resourceNames:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
const css=`
.cx-host{display:grid;place-items:center;padding:16px}.cx-host[hidden]{display:none}
.cx{--cx-well:var(--well,#26332d);--cx-tile:var(--tile,#415349);--cx-edge:var(--tile-edge,#27342e);--cx-gold:var(--gold,#d8b45a);--cx-muted:var(--muted,#a9b4a4);--cx-cream:var(--cream,#efe6cf);
 width:min(1100px,100%);height:min(820px,100%);display:grid;grid-template-rows:auto minmax(0,1fr);grid-template-columns:minmax(0,1fr);background:var(--plate,#2f3f38);border-bottom:6px solid var(--plate-edge,#1f2a25);border-radius:4px;overflow:hidden;color:var(--cx-cream);font-size:14px;line-height:1.55}
.cx *{box-sizing:border-box}
.cx-head{position:relative;display:flex;align-items:center;gap:10px 16px;padding:12px 16px 19px 20px;border-bottom:3px solid var(--plate-edge,#1f2a25)}
.cx-head::after{content:"";position:absolute;left:0;right:0;bottom:4px;height:6px;background:radial-gradient(circle at 8px 3px,var(--plate-stud,#3b4d45) 3.5px,transparent 4px) 0 0/16px 6px repeat-x;pointer-events:none}
.cx-head h2{margin:0;font-size:20px;line-height:1.2;color:var(--cx-gold);letter-spacing:.1em}
.cx-tabs{display:flex;align-items:center;gap:4px}.cx-tabs::before{content:"/";margin-right:8px;color:var(--cx-muted)}
.cx-tab{height:32px;padding:0 14px;background:transparent;border:0;border-bottom:3px solid transparent;border-radius:3px;font-size:14px;font-weight:650;color:var(--cx-muted)}
.cx-tab:hover{color:var(--cx-cream);background:rgba(0,0,0,.14)}
.cx-tab[aria-selected=true]{background:var(--cx-tile);border-bottom-color:var(--cx-edge);color:var(--cx-cream)}
.cx-close{margin-left:auto;height:34px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;background:var(--cx-tile);border:0;border-bottom:3px solid var(--cx-edge);border-radius:3px;font-weight:650;font-size:13px;color:var(--cx-cream)}
.cx-close:hover{background:var(--tile-hover,#4c6155)}.cx-close:active{border-bottom-width:1px;padding-top:2px}.cx-close kbd{font:600 11px/1 system-ui,sans-serif;color:var(--cx-muted)}
@media (pointer:coarse){.cx-close kbd{display:none}}
.cx-body{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:0}
.cx-list{min-height:0;overflow:auto;background:var(--cx-well);padding:10px 10px 18px}
.cx-group{margin:14px 4px 6px;font-size:12px;font-weight:600;color:var(--cx-muted)}.cx-grp:first-child .cx-group{margin-top:2px}
.cx-list ul{list-style:none;margin:0;padding:0;display:grid;gap:5px}
.cx-civ,.cx-uitem{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:0 8px;padding:7px 10px 6px;background:var(--cx-tile);border:0;border-bottom:3px solid var(--cx-edge);border-radius:3px;text-align:left;color:var(--cx-cream)}
.cx-civ:hover,.cx-uitem:hover{background:var(--tile-hover,#4c6155)}
.cx-uitem.off{background:#36473e}.cx-uitem.off:hover{background:#3f5248}.cx-uitem.off b{font-weight:600;color:#d6d8ca}
.cx-civ[aria-current=true],.cx-uitem[aria-current=true],.cx-uitem.off[aria-current=true]{background:#6f6034;border-bottom-color:#4a3f20;border-bottom-width:1px;padding-top:9px}
.cx-civ b{font-size:15px;font-weight:650;white-space:nowrap}.cx-civ small,.cx-uitem small{grid-column:1;font-size:12px;color:var(--cx-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cx-civ[aria-current=true] small,.cx-uitem[aria-current=true] small{color:#e6d9b2}
.cx-uitem b{font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cx-uitem[aria-current=true] b{color:var(--cx-cream)}
.cx-mark{grid-column:2;grid-row:1/3;font-size:11.5px;font-weight:650;white-space:nowrap}.cx-mark.self{color:#a8cbe0}.cx-mark.rival{color:#f2b4a4}.cx-mark.both{color:var(--cx-gold)}.cx-mark.off{color:var(--cx-muted);font-weight:600}.cx-uitem[aria-current=true] .cx-mark.off{color:#e6d9b2}
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
.cx-side{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);background:var(--cx-well)}.cx-side .cx-list{padding-top:6px}
.cx-tools{display:flex;align-items:center;gap:6px;padding:10px 10px 4px}.cx-seg{display:flex;gap:3px}
.cx-tool{height:30px;padding:0 10px;display:inline-flex;align-items:center;gap:7px;background:var(--cx-tile);border:0;border-bottom:3px solid var(--cx-edge);border-radius:3px;font-size:12.5px;font-weight:600;color:var(--cx-cream);white-space:nowrap}
.cx-tool:hover{background:var(--tile-hover,#4c6155)}.cx-seg .cx-tool[aria-pressed=true]{background:#6f6034;border-bottom-color:#4a3f20;border-bottom-width:1px;padding-top:2px}
.cx-tool.pend{margin-left:auto;background:transparent;border-bottom-color:transparent;color:var(--cx-muted)}.cx-tool.pend:hover{background:rgba(0,0,0,.14);color:var(--cx-cream)}
.cx-tool.pend::before{content:"";flex:none;width:10px;height:7px;background:var(--cx-gold);border-radius:1.5px;box-shadow:inset 0 -2px 0 rgba(60,44,10,.45)}.cx-tool.pend[aria-pressed=false]::before{background:transparent;box-shadow:inset 0 0 0 1.5px var(--cx-muted)}
.cx-uhero{display:grid;grid-template-columns:112px minmax(0,1fr);gap:0 18px;align-items:end}.cx-uhero.no-face{grid-template-columns:minmax(0,1fr)}.cx-uhero .cx-face{grid-row:auto}
.cx-path{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.cx-path li{min-width:0;padding:12px 14px 14px;background:var(--cx-well);border-radius:3px}.cx-path b{font-size:16px;font-weight:650}
.cx-path .cx-age{margin:1px 0 0;font-size:12.5px;color:var(--cx-muted)}.cx-path .cx-cost{margin-top:8px;font-size:13px}.cx-path .cx-ref{margin-top:6px;font-size:12px;color:var(--cx-muted)}
.cx-path .cx-step{margin-top:8px;font-size:13px;line-height:1.65}
.cx-scroll{max-width:100%;overflow-x:auto}.cx-scroll .cx-stats{width:auto;min-width:min(100%,560px);max-width:none}.cx-stats thead th{white-space:nowrap}
.cx-ov{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}.cx-ov .cx-tech p{margin-top:6px;font-size:13px;line-height:1.65}
.cx-count{font-variant-numeric:tabular-nums}
.cx-tree dd .cx-cost{margin:0}.cx-tree dd small{display:block;margin-top:2px;font-size:12.5px;color:var(--cx-muted)}.cx-tree dd+dt{margin-top:4px}
.cx-chain{margin:10px 0 0!important;font-size:13px;color:var(--cx-muted)}.cx-chain b{font-weight:600;color:var(--cx-cream)}
.cx-ages{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 18px;align-items:center;margin:0}.cx-ages dt{color:var(--cx-muted)}.cx-ages dd{margin:0}.cx-ages .cx-cost{margin:0}
.cx-jump{margin-top:12px}
.cx-eq{list-style:none;margin:0;padding:12px 16px;display:grid;gap:4px;background:var(--cx-well);border-radius:3px;font-variant-numeric:tabular-nums;max-width:560px}.cx-eq li:last-child{margin-top:4px;padding-top:6px;border-top:2px solid rgba(0,0,0,.2);font-weight:650;color:var(--cx-gold)}
.cx-ex{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px 18px}.cx-ex h5{margin:0 0 6px;font-size:14px;font-weight:650}
.cx-phases{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}.cx-phases h5{margin:0 0 10px;font-size:14px;font-weight:650;color:var(--cx-cream)}
.cx-steps{gap:7px}.cx-steps li{font-size:13.5px;line-height:1.55}.cx-steps li.tip{color:var(--cx-muted)}.cx-steps li.tip::before{background:transparent;box-shadow:inset 0 0 0 1.5px var(--cx-muted)}
.cx-why{margin-top:12px;color:#f2b4a4}.cx-basic{margin-top:10px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.cx-stats td.n{white-space:nowrap;color:var(--cx-gold);font-weight:650}.cx-stats td.en{color:var(--cx-muted)}.cx-stats td.say{width:1%;padding-right:0}
.cx-say{height:28px;padding:0 10px;background:var(--cx-tile);border:0;border-bottom:3px solid var(--cx-edge);border-radius:3px;font-size:12.5px;font-weight:600;color:var(--cx-cream);white-space:nowrap}.cx-say:hover{background:var(--tile-hover,#4c6155)}.cx-say:active{border-bottom-width:1px;margin-top:2px}
.cx-wide td{min-width:7em}.cx-wide td:nth-child(4),.cx-wide td:nth-child(2){min-width:12em}
.cx-foot{margin-top:34px;padding-top:14px;border-top:3px solid rgba(0,0,0,.18);font-size:12.5px;color:var(--cx-muted);max-width:52em}.cx-foot p+p{margin-top:6px}
.cx-page.cx-wide-page{max-width:none}
.cx-tools.cx-tree-tools{flex-wrap:wrap;padding:0;margin:20px 0 0;gap:8px 14px}.cx-tree-tools .cx-tool.pend{margin-left:0}
.cx-legend{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--cx-muted)}.cx-legend li{display:inline-flex;align-items:center;gap:6px}
.cx-legend i{width:16px;height:12px;border-radius:2px;background:var(--cx-tile);box-shadow:inset 0 -3px 0 var(--cx-edge)}
.cx-tblocks{display:flex;flex-wrap:wrap;align-items:flex-start;gap:26px 30px;margin-top:22px}
.cx-tblock{min-width:0;max-width:100%}.cx-tblock h4{margin:0 0 10px;display:flex;align-items:center;gap:10px}
.cx-tblock h4 img{width:34px;height:34px;object-fit:contain}.cx-tblock h4 button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:10px;border-radius:3px}.cx-tblock h4 button:hover{color:var(--cx-cream)}.cx-tblock h4 button:focus-visible{outline:2px solid var(--cx-gold);outline-offset:3px}
.cx-tgrid{display:grid;grid-auto-rows:minmax(92px,auto);column-gap:8px;row-gap:16px;padding:2px 2px 6px}
.cx-tage{align-self:center;padding-right:6px;font-size:12px;font-weight:600;color:var(--cx-muted);white-space:nowrap}
.cx-tcell{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px}
.cx-tcell.down::after,.cx-tcell.pipe::after{content:"";position:absolute;left:50%;width:6px;margin-left:-3px;background:#22302a;border-radius:3px}
.cx-tcell.down::after{top:calc(100% - 4px);height:24px}.cx-tcell.pipe::after{top:-12px;bottom:-12px}
.cx-tnode{position:relative;width:92px;min-height:88px;padding:6px 4px 7px;display:flex;flex-direction:column;align-items:center;gap:3px;background:var(--cx-tile);border:0;border-bottom:3px solid var(--cx-edge);border-radius:3px;color:var(--cx-cream);font:inherit;text-align:center}
button.cx-tnode{cursor:pointer}button.cx-tnode:hover{background:var(--tile-hover,#4c6155)}button.cx-tnode:focus-visible{outline:2px solid var(--cx-gold);outline-offset:2px}
.cx-tcell .cx-tnode.linked::before{content:"";position:absolute;left:50%;top:-12px;width:6px;height:10px;margin-left:-3px;background:#22302a;border-radius:3px}
.cx-tnode img{width:42px;height:42px;object-fit:contain}.cx-tnode .nm{font-size:12.5px;font-weight:600;line-height:1.3}
.cx-tnode .mk{font-size:11px;font-weight:600;line-height:1.2;color:var(--cx-muted);font-variant-numeric:tabular-nums}
.cx-tnode .nd{font-size:10.5px;line-height:1.25;color:#c9b98a}
.cx-tnode.uniq{background:#4d4a33;border-bottom-color:#332f1d}button.cx-tnode.uniq:hover{background:#5a5639}
.cx-tnode.off{background:#2a3631;border-bottom-color:#1f2925;color:#8f9a8c}.cx-tnode.off img{filter:grayscale(1) brightness(.75);opacity:.55}
.cx-tnode.ref{background:transparent;border-bottom-color:transparent;box-shadow:inset 0 0 0 1.5px #4a5a51;color:var(--cx-muted)}button.cx-tnode.ref:hover{background:rgba(0,0,0,.14)}
.cx-tnode.ref .nm{font-weight:500}.cx-tnode.ref .noimg,.cx-tnode .noimg{width:42px;height:42px;display:grid;place-items:center;font-size:20px;color:#5f6f66}
.cx-tnode.s-done{background:#5d5330;border-bottom-color:#3c3520}.cx-tnode.s-done .mk{color:#e9d79c}
.cx-tnode.s-owned{background:#3f5a5f;border-bottom-color:#283b3e}.cx-tnode.s-owned .mk{color:#bfe0e6}
.cx-tnode.s-queued{box-shadow:inset 0 0 0 2px #b79b52}.cx-tnode.s-queued .mk{color:#e6cf8a}
.cx-tnode.s-ready .mk{color:var(--cx-cream)}.cx-tnode.s-ready{box-shadow:inset 0 0 0 1.5px #c9b679}
.cx-tnode.s-later{color:#b8c1b3}.cx-tnode.s-later img{opacity:.7}
.cx-legend .s-done{background:#5d5330;box-shadow:inset 0 -3px 0 #3c3520}.cx-legend .s-owned{background:#3f5a5f;box-shadow:inset 0 -3px 0 #283b3e}.cx-legend .s-queued{box-shadow:inset 0 0 0 2px #b79b52}.cx-legend .s-ready{box-shadow:inset 0 0 0 1.5px #c9b679}.cx-legend .s-off{background:#2a3631;box-shadow:inset 0 -3px 0 #1f2925}.cx-legend .s-ref{background:transparent;box-shadow:inset 0 0 0 1.5px #4a5a51}.cx-legend .s-uniq{background:#4d4a33;box-shadow:inset 0 -3px 0 #332f1d}
@media (max-width:760px){
 .cx{width:100%;height:100%}
 .cx-head{padding:10px 16px 17px}.cx-head h2{font-size:18px}
 .cx-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
 .cx-list{display:flex;gap:5px;overflow-x:auto;overflow-y:hidden;padding:8px 16px 10px}
 .cx-grp,.cx-list ul,.cx-list li{display:contents}.cx-group{display:none}
 .cx-civ,.cx-uitem{flex:none;width:auto;padding:6px 12px 5px}.cx-civ[aria-current=true],.cx-uitem[aria-current=true]{padding-top:8px}.cx-civ small,.cx-uitem small{display:none}.cx-mark{grid-row:1}
 .cx-head{gap:10px;flex-wrap:wrap}.cx-head h2,.cx-tab,.cx-close{white-space:nowrap}.cx-tabs::before{margin-right:4px}.cx-close kbd{display:none}
 .cx-tab{height:40px;padding:0 9px}
 /* Five categories: title and close share the first row, the tabs get the next row to themselves (scrolling if they ever outgrow it). */
 .cx-tabs{order:3;flex:1 0 100%;overflow-x:auto;scrollbar-width:none}.cx-tabs::before{display:none}.cx-tabs .cx-tab:first-child{margin-left:-9px}.cx-side{grid-template-rows:auto auto}.cx-tools{padding:8px 16px 0}.cx-tool{height:40px;padding:0 12px}
 .cx-side .cx-list{padding-top:8px}.cx-side .cx-group{display:block;flex:none;align-self:center;margin:0 2px 0 8px;white-space:nowrap}.cx-side .cx-grp:first-child .cx-group{margin-left:0}
 .cx-uhero{grid-template-columns:72px minmax(0,1fr);gap:0 12px}.cx-uhero .cx-face{width:72px;height:72px}.cx-path,.cx-ov{grid-template-columns:minmax(0,1fr)}
 .cx-detail{padding:16px 16px 26px}.cx-page h3{font-size:24px}.cx-summary{font-size:14.5px}
 .cx-unit{grid-template-columns:72px minmax(0,1fr);gap:4px 12px;padding:12px}.cx-face{grid-row:1;width:72px;height:72px}.cx-ubody{grid-column:1/-1}
 .cx-stats{font-size:12.5px}.cx-stats th,.cx-stats td{padding-right:6px}.cx-stats tbody th{width:auto}
 .cx-cols{grid-template-columns:minmax(0,1fr)}.cx-techs{grid-template-columns:minmax(0,1fr)}
 .cx-tblocks{display:grid;grid-template-columns:minmax(0,1fr)}.cx-tnode{width:84px}.cx-tblock .cx-scroll{overscroll-behavior-x:contain}
}`;
type Kid=Node|string|null|undefined|false;
function h<K extends keyof HTMLElementTagNameMap>(tag:K,attrs:Record<string,string>|null,...kids:Kid[]):HTMLElementTagNameMap[K]{
 const e=document.createElement(tag);if(attrs)for(const [k,v] of Object.entries(attrs))k==='class'?e.className=v:e.setAttribute(k,v);
 for(const k of kids)if(k!==null&&k!==undefined&&k!==false)e.append(k);return e;}
let open:{host:HTMLElement;ctx:CodexContext;prev:Element|null;tabs:HTMLButtonElement[];body:HTMLElement;list:HTMLElement;detail:HTMLElement}|null=null,chosen:string|null=null;
// The book remembers its category and, in 單位, the page, grouping and whether unimplemented units are listed.
let section:CodexSection='civs',unitChosen='overview',unitBy:'category'|'building'='category',showPending=true;
// …and in 科技, the page, grouping and whether aoetw technologies the game lacks are listed.
let techChosen='overview',techBy:'building'|'age'='building',techPending=true;
// …and in 建築, the page, grouping and whether aoetw buildings the game lacks are listed.
let buildingChosen='overview',buildingBy:'group'|'age'='group',buildingPending=true;
let elementChosen='overview';
// …and in 戰術技巧, the page.
let tacticChosen='overview';
// …and in 科技樹, the civilization (null: the player's own, else the first) and whether reference items are drawn.
let treeChosen:string|null=null,treeRefs=true;
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
 if(s.minRange)out.push(`最短射程 ${tilesText(s.minRange)}`);if(s.blast)out.push(`落點 ${tilesText(s.blast)} 內的敵兵同受傷害`);if(s.passThrough)out.push(`弩箭穿過目標，再飛 ${tilesText(s.passThrough)}`);
 if(s.buildingsOnly)out.push('只能攻擊建築');if(s.setup)out.push(`架設與收起各 ${secondsText(cooldownSeconds(s.setup))}`);if(s.selfDestruct)out.push('攻擊後自身消耗');
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
// Brings the chosen item fully into the list's view (vertical list, or the phone's horizontal strip) with a 16px margin;
// scrollIntoView leaves a chip half-clipped at the strip's edge.
function reveal(list:HTMLElement,b:HTMLElement){const l=list.getBoundingClientRect(),r=b.getBoundingClientRect(),m=16;
 if(r.right>l.right-m)list.scrollLeft+=r.right-l.right+m;else if(r.left<l.left+m)list.scrollLeft-=l.left+m-r.left;
 if(r.bottom>l.bottom-m)list.scrollTop+=r.bottom-l.bottom+m;else if(r.top<l.top+m)list.scrollTop-=l.top+m-r.top;}
// Arrow keys, Home and End as an index move in a list of n (null: not a navigation key).
function step(key:string,i:number,n:number){
 return key==='ArrowDown'||key==='ArrowRight'?Math.min(n-1,i+1):key==='ArrowUp'||key==='ArrowLeft'?Math.max(0,i-1):key==='Home'?0:key==='End'?n-1:null;}
function select(id:string,focus=false){
 if(!open)return;chosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-civ'))){const on=b.dataset.civ===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 open.detail.replaceChildren(page(civDetail(id,open.ctx.civs),open.ctx.icons));open.detail.scrollTop=0;}
function renderCivs(focus:boolean){
 if(!open)return;
 const items=civList(open.ctx.civs),groups:{label:string;items:CivListItem[]}[]=[];
 for(const c of items){const g=groups.at(-1);if(g&&g.label===c.group)g.items.push(c);else groups.push({label:c.group,items:[c]});}
 const list=h('nav',{class:'cx-list','aria-label':'文明列表'},...groups.map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-g${i}`},g.label),h('ul',{'aria-labelledby':`cx-g${i}`},...g.items.map(listItem)))));
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-civ-name',tabindex:'-1'});
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-civ');if(b?.dataset.civ)select(b.dataset.civ);});
 // Arrow keys walk the list (roving focus: only the chosen civ is in the tab order).
 list.addEventListener('keydown',e=>{const ids=codexCivs().map(c=>c.id),next=step(e.key,ids.indexOf(chosen??ids[0]),ids.length);
  if(next===null)return;e.preventDefault();select(ids[next],true);});
 open.body.replaceChildren(list,detail);open.list=list;open.detail=detail;
 const first=chosen&&items.some(c=>c.id===chosen)?chosen:items.find(c=>c.role==='self'||c.role==='both')?.id??items[0].id;
 select(first,focus);}
// ── 單位 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The model is pure and the rules do not change while the page runs: built once, on first use.
let unitData:{lines:Map<string,UnitLine>;pending:Map<string,PendingLine>}|null=null;
const units=()=>unitData??=({lines:new Map(unitLines().map(l=>[l.id,l])),pending:new Map(pendingLines().map(l=>[l.id,l]))});
const stepRange=(s:StatSheet)=>s.attack==='none'?'—':rangeText(s.range).replace('射程 ','');
function lineTable(l:UnitLine){
 const rows:[string,(s:StatSheet)=>string,string?][]=[['生命',s=>String(s.hp)],['攻擊',attackText],['射程',stepRange],['護甲',s=>`${s.armor[0]}/${s.armor[1]}`,'近戰護甲／遠程護甲'],
  ['攻擊間隔',s=>s.attack==='none'?'—':secondsText(cooldownSeconds(s.cooldown))],['移動',s=>`${numberText(tilesPerSecond(s.speed))} 格／秒`],['額外傷害',bonusText]];
 if(l.steps.some(s=>specialText(s.stats)))rows.push(['特性',s=>specialText(s)||'無']);
 const many=l.steps.length>1;
 return h('table',{class:'cx-stats'},many?h('thead',null,h('tr',null,h('td',null),...l.steps.map(s=>h('th',{scope:'col'},s.name)))):null,
  h('tbody',null,...rows.map(([label,f,title])=>{const cells=l.steps.map(s=>f(s.stats));
   return h('tr',null,h('th',{scope:'row',...(title?{title}:{})},label),...cells.map((c,i)=>h('td',i&&c!==cells[i-1]?{class:'up'}:null,c)));})));}
function stepTile(s:LineStep,icons:Record<string,string>){
 return h('li',null,h('b',null,s.name),h('p',{class:'cx-age'},ageName(s.age)),
  // A research that upgrades several lines (War Galley) is named on the steps it reaches under another name.
  s.research?costRow(icons,s.research.cost,s.research.seconds,s.research.name===s.name?`於${s.research.at}研究`:`研究「${s.research.name}」・於${s.research.at}`):h('p',{class:'cx-cost'},h('span',{class:'t'},'起始單位')),
  s.refName?h('p',{class:'cx-ref'},`aoetw 譯名：${s.refName}`):null,s.text?h('p',{class:'cx-step'},s.text):null);}
function civRows(l:UnitLine){
 if(l.owner)return h('p',{class:'cx-prose'},`只有${civName(l.owner)}能在${l.at}訓練${l.steps.length>1?`與升級為${l.steps.at(-1)!.name}`:''}。`);
 if(l.steps.every(s=>!s.lacks.length))return h('p',{class:'cx-prose'},l.steps.length>1?'每個文明都能訓練與升級。':'每個文明都能訓練。');
 return h('dl',{class:'cx-tree'},...l.steps.flatMap(s=>[h('dt',null,s.name),h('dd',null,s.lacks.length?s.lacks.map(civName).join('、'):'每個文明都有')]));}
function heroHead(name:string,nameEn:string,face:string|undefined,sub:Kid[]){
 return h('div',{class:`cx-uhero${face?'':' no-face'}`},face?h('div',{class:'cx-face'},h('img',{src:face,alt:''})):null,
  h('div',null,h('h3',{id:'cx-unit-name'},name,h('span',{lang:'en'},nameEn)),h('p',{class:'cx-sub'},...sub)));}
function sourceFoot(sources:string[]){return h('footer',{class:'cx-foot'},h('p',null,unitsNote),sources.length?h('p',null,`資料來源：${sources.join('、')}`):null);}
function linePage(l:UnitLine,icons:Record<string,string>){
 const p=h('div',{class:'cx-page'}),cats=l.categories.map(unitCategoryName).join('・');
 p.append(heroHead(l.name,l.nameEn,icons[`${l.id}-face`],[`${cats}・${l.classes.join('・')}`,l.trash?'・垃圾兵':'',l.owner?'・':'',l.owner?h('b',null,`${civName(l.owner)}特殊單位`):null]),
  h('p',{class:'cx-summary'},l.text),
  h('div',{class:'cx-cols'},h('section',null,h('h4',null,'擅長對付'),h('p',{class:'cx-prose'},l.strong)),h('section',null,h('h4',null,'害怕'),h('p',{class:'cx-prose'},l.weak))),
  h('section',null,h('h4',null,'訓練'),costRow(icons,l.train.cost,l.train.seconds,`${ageName(l.train.age)}起於${l.at}・人口 ${l.train.population}`)));
 if(l.steps.length>1)p.append(h('section',null,h('h4',null,'升級路線',h('small',null,'升級後，場上與之後訓練的單位都換成新數值')),h('ol',{class:'cx-path'},...l.steps.map(s=>stepTile(s,icons)))));
 p.append(h('section',null,h('h4',null,'數值',h('small',null,'無文明加成、未研究鐵匠鋪科技；每欄是該時代完成此前升級後')),h('div',{class:'cx-scroll'},lineTable(l))));
 p.append(h('section',null,h('h4',null,l.owner?'文明':'缺少的文明'),civRows(l)));
 if(l.later.length)p.append(h('section',null,h('h4',null,'尚未實作的升級'),h('ul',{class:'cx-bricks off'},...l.later.map(x=>h('li',null,h('span',null,`${x.name}（${x.nameEn}）`,h('small',null,x.reason)))))));
 p.append(sourceFoot(l.sources));
 return p;}
function pendingPage(l:PendingLine){
 const p=h('div',{class:'cx-page'}),cats=l.categories.map(unitCategoryName).join('・');
 p.append(heroHead(l.name,l.nameEn,undefined,[`${cats}・原作於${l.at}訓練`,l.civ?`・${l.civ}特殊單位`:'',l.trash?'・垃圾兵':'']),
  h('p',{class:'cx-summary'},h('span',{class:'cx-flag'},'尚未實作'),`：${l.reason}。`),h('p',{class:'cx-summary',style:'margin-top:8px'},l.text));
 if(l.steps.length>1)p.append(h('section',null,h('h4',null,'原作升級路線'),h('ol',{class:'cx-path'},...l.steps.map((s,i)=>h('li',null,h('b',null,s.name),h('p',{class:'cx-age',lang:'en'},s.nameEn),i?h('p',{class:'cx-step'},s.text):null)))));
 p.append(sourceFoot(l.sources));
 return p;}
function overviewPage(){
 const o=unitsOverview(),p=h('div',{class:'cx-page'});
 p.append(h('h3',{id:'cx-unit-name'},'單位',h('span',{lang:'en'},'Units')),h('p',{class:'cx-summary'},o.intro),
  h('p',{class:'cx-sub cx-count'},`本作有 ${o.lines} 條兵種線、共 ${o.steps} 個單位與升級；aoetw 收錄、本作尚未實作的有 ${o.pending} 個。`),
  h('section',null,h('h4',null,'類型'),h('div',{class:'cx-ov'},...o.categories.map(c=>h('article',{class:'cx-tech'},h('h5',null,c.label,h('span',{class:'cx-count'},`本作 ${c.lines}・未實作 ${c.pending}`)),h('p',null,c.text))))),
  h('section',null,h('h4',null,'垃圾兵'),h('p',{class:'cx-prose'},o.trash)),
  h('footer',{class:'cx-foot'},h('p',null,`aoetw 另收錄 ${o.extras.animals} 種動物、${o.extras.heroes} 位英雄與 ${o.extras.editor} 種地圖編輯器單位，本百科不列出。`),h('p',null,'資料來源：aoetw.com/units')));
 return p;}
function unitItem(it:{id:string;name:string;pending:boolean}){
 const d=units(),l=d.lines.get(it.id),q=d.pending.get(it.id);
 const sub=l?l.owner?civName(l.owner):l.steps.length>1?`${l.steps.length} 階・${l.at}`:l.at:q?.civ??q?.at??'';
 return h('li',null,h('button',{type:'button',class:`cx-uitem${it.pending?' off':''}`,'data-unit':it.id,tabindex:'-1','aria-current':'false'},h('b',null,it.name),h('small',null,sub),it.pending?h('span',{class:'cx-mark off'},'未實作'):null));}
function fillUnitList(list:HTMLElement){
 const groups=unitGroups(unitBy).map(g=>({...g,items:g.items.filter(i=>showPending||!i.pending)})).filter(g=>g.items.length);
 list.replaceChildren(h('div',{class:'cx-grp'},h('ul',null,h('li',null,h('button',{type:'button',class:'cx-uitem',
   'data-unit':'overview',tabindex:'-1','aria-current':'false'},h('b',null,'總覽'),h('small',null,'類型與資料來源'))))),
  ...groups.map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-ug${i}`},g.label),h('ul',{'aria-labelledby':`cx-ug${i}`},...g.items.map(unitItem)))));}
function selectUnit(id:string,focus=false){
 if(!open)return;const d=units();if(id!=='overview'&&!d.lines.has(id)&&!(showPending&&d.pending.has(id)))id='overview';unitChosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-uitem'))){const on=b.dataset.unit===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 const l=d.lines.get(id),q=d.pending.get(id);
 open.detail.replaceChildren(l?linePage(l,open.ctx.icons):q?pendingPage(q):overviewPage());open.detail.scrollTop=0;}
function renderUnits(focus:boolean){
 if(!open)return;
 const seg=(by:'category'|'building',label:string)=>{const b=h('button',{type:'button',class:'cx-tool','aria-pressed':String(unitBy===by)},label);
  b.onclick=()=>{if(unitBy===by)return;unitBy=by;for(const x of Array.from(b.parentElement!.children))x.setAttribute('aria-pressed',String(x===b));fillUnitList(list);selectUnit(unitChosen);};return b;};
 const pend=h('button',{type:'button',class:'cx-tool pend','aria-pressed':String(showPending),title:'列出本作尚未實作的單位'},'未實作');
 pend.onclick=()=>{showPending=!showPending;pend.setAttribute('aria-pressed',String(showPending));fillUnitList(list);selectUnit(unitChosen);};
 const tools=h('div',{class:'cx-tools'},h('div',{class:'cx-seg',role:'group','aria-label':'分組方式'},seg('category','依類型'),seg('building','依建築')),pend);
 const list=h('nav',{class:'cx-list','aria-label':'單位列表'});
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-unit-name',tabindex:'-1'});
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-uitem');if(b?.dataset.unit)selectUnit(b.dataset.unit);});
 list.addEventListener('keydown',e=>{const ids=Array.from(list.querySelectorAll<HTMLButtonElement>('.cx-uitem')).map(b=>b.dataset.unit!),next=step(e.key,Math.max(0,ids.indexOf(unitChosen)),ids.length);
  if(next===null)return;e.preventDefault();selectUnit(ids[next],true);});
 fillUnitList(list);open.body.replaceChildren(h('div',{class:'cx-side'},tools,list),detail);open.list=list;open.detail=detail;
 selectUnit(unitChosen,focus);}
// ── 科技 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
let techData:{gen:Map<string,TechPage>;uni:Map<string,UniqueTechPage>;pend:Map<string,PendingTech>}|null=null;
const techs=()=>techData??=({gen:new Map(techPages().map(t=>[t.id,t])),uni:new Map(uniqueTechPages().map(t=>[t.id,t])),pend:new Map(pendingTechs().map(t=>[t.id,t]))});
const bricks=(lines:string[],off=false)=>h('ul',{class:`cx-bricks${off?' off':''}`},...lines.map(x=>h('li',null,h('span',null,x))));
function techHead(name:string,nameEn:string,sub:Kid[]){
 return [h('h3',{id:'cx-tech-name'},name,h('span',{lang:'en'},nameEn)),h('p',{class:'cx-sub'},...sub)];}
function techFoot(sources:string[]){return h('footer',{class:'cx-foot'},h('p',null,techsNote),sources.length?h('p',null,`資料來源：${sources.join('、')}`):null);}
function techPageView(t:TechPage,icons:Record<string,string>){
 const p=h('div',{class:'cx-page'});
 p.append(...techHead(t.name,t.nameEn,[`${t.at}・${ageName(t.age)}`,t.refName?`・aoetw 譯名：${t.refName}`:'']),h('p',{class:'cx-summary'},t.text),
  h('section',null,h('h4',null,'效果',h('small',null,'本作的數值')),bricks(t.effects),
   t.partial?h('ul',{class:'cx-bricks off',style:'margin-top:6px'},h('li',null,h('span',null,h('span',{class:'cx-flag'},'尚未實作'),`：${t.partial}`))):null));
 const research=h('section',null,h('h4',null,'研究'),costRow(icons,t.cost,t.seconds,`${ageName(t.age)}起於${t.at}研究`));
 if(t.requires.length)research.append(h('p',{class:'cx-chain'},'需要先完成：',h('b',null,t.requires.map(r=>r.name).join(' → '))));
 if(t.unlocks.length)research.append(h('p',{class:'cx-chain'},'完成後開放：',h('b',null,t.unlocks.map(r=>r.name).join('、'))));
 p.append(research);
 if(t.variants.length||t.grants.length||t.civEffects.length){
  const dl=h('dl',{class:'cx-tree'});
  for(const v of t.variants)dl.append(h('dt',null,civName(v.civ)),h('dd',null,costRow(icons,v.cost,v.seconds),h('small',null,v.texts.join('；'))));
  for(const g of t.grants)dl.append(h('dt',null,civName(g.civ)),h('dd',null,g.text));
  for(const e of t.civEffects)dl.append(h('dt',null,civName(e.civ)),h('dd',null,e.text));
  p.append(h('section',null,h('h4',null,'文明差異',h('small',null,'以可研究的最早時代計算')),dl));}
 p.append(h('section',null,h('h4',null,'缺少的文明'),h('p',{class:'cx-prose'},t.lacks.length?t.lacks.map(civName).join('、'):'每個文明都能研究。')),techFoot(t.sources));
 return p;}
function uniquePageView(t:UniqueTechPage,icons:Record<string,string>){
 const p=h('div',{class:'cx-page'});
 p.append(...techHead(t.name,t.nameEn,[h('b',null,`${civName(t.civ)}特殊科技`),`・${t.at||'城堡'}・${ageName(t.age)}`,t.refName?`・aoetw 譯名：${t.refName}`:'']),h('p',{class:'cx-summary'},t.text));
 if(t.implemented){p.append(h('section',null,h('h4',null,'效果',h('small',null,'本作的數值')),bricks(t.effects),
   t.partial.length?h('ul',{class:'cx-bricks off',style:'margin-top:6px'},...t.partial.map(o=>h('li',null,h('span',null,h('span',{class:'cx-flag'},'尚未實作'),`：${o.text}`,h('small',null,o.reason))))):null),
  h('section',null,h('h4',null,'研究',h('small',null,`價格已含${civName(t.civ)}的文明加成`)),costRow(icons,t.cost!,t.seconds,`於${t.at}研究`)));}
 else p.append(h('p',{class:'cx-summary'},h('span',{class:'cx-flag'},'尚未實作'),t.reason?`：${t.reason}`:''),h('p',{class:'cx-note',style:'margin-top:8px!important'},`原作效果：${t.reference}`));
 p.append(techFoot(t.sources));
 return p;}
function pendingTechView(t:PendingTech){
 const p=h('div',{class:'cx-page'});
 p.append(...techHead(t.name,t.nameEn,[`原作於${t.at}研究・${ageName(t.age)}`,t.civ?`・${t.civ}特殊科技`:'']),
  h('p',{class:'cx-summary'},h('span',{class:'cx-flag'},'尚未實作'),`：${t.reason}。`),h('p',{class:'cx-summary',style:'margin-top:8px'},t.text),techFoot(t.sources));
 return p;}
function techOverview(icons:Record<string,string>){
 const o=techsOverview(),p=h('div',{class:'cx-page'});
 const jump=h('button',{type:'button',class:'cx-tool cx-jump'},`兵種升級 ${o.lineUpgrades} 項：看「單位」分類`);jump.onclick=()=>show('units',true);
 p.append(h('h3',{id:'cx-tech-name'},'科技',h('span',{lang:'en'},'Technologies')),h('p',{class:'cx-summary'},o.intro),
  h('p',{class:'cx-sub cx-count'},`本作有 ${o.generic} 項通用科技、${o.unique} 項文明特殊科技；aoetw 收錄、本作尚未實作的有 ${o.pending+o.deferred} 項。`),
  h('section',null,h('h4',null,'本作沒有的科技'),h('p',{class:'cx-prose'},o.missing)),
  h('section',null,h('h4',null,'時代',h('small',null,'在城鎮中心研究，無文明加成')),h('dl',{class:'cx-ages'},...o.ages.flatMap(a=>[h('dt',null,a.name),h('dd',null,costRow(icons,a.cost,a.seconds))]))),
  h('section',null,h('h4',null,'研究建築'),h('div',{class:'cx-ov'},...o.buildings.map(b=>h('article',{class:`cx-tech${b.techs?'':' off'}`},
   h('h5',null,b.label,h('span',{class:'cx-count'},b.techs?`本作 ${b.techs}・未實作 ${b.pending}`:`尚未實作 ${b.pending}`)),h('p',null,b.text))))),
  h('section',null,h('h4',null,'兵種升級'),h('p',{class:'cx-prose'},'兵營、靶場、馬廄、攻城器工坊與城堡的兵種升級（例如長劍士、精銳長弓兵）改變的是單位本身的數值，列在各兵種線的升級路線上。'),jump),
  h('footer',{class:'cx-foot'},h('p',null,techsNote),h('p',null,'資料來源：aoetw.com/techs')));
 return p;}
function techItem(it:TechItem){
 return h('li',null,h('button',{type:'button',class:`cx-uitem${it.pending?' off':''}`,'data-tech':it.id,tabindex:'-1','aria-current':'false'},h('b',null,it.name),h('small',null,it.sub),it.pending?h('span',{class:'cx-mark off'},'未實作'):null));}
function fillTechList(list:HTMLElement){
 const groups=techGroups(techBy).map(g=>({...g,items:g.items.filter(i=>techPending||!i.pending)})).filter(g=>g.items.length);
 list.replaceChildren(h('div',{class:'cx-grp'},h('ul',null,h('li',null,h('button',{type:'button',class:'cx-uitem','data-tech':'overview',tabindex:'-1','aria-current':'false'},h('b',null,'總覽'),h('small',null,'時代、研究建築與資料來源'))))),
  ...groups.map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-tg${i}`},g.label),h('ul',{'aria-labelledby':`cx-tg${i}`},...g.items.map(techItem)))));}
function selectTech(id:string,focus=false){
 if(!open)return;const d=techs(),pending=d.pend.has(id)||d.uni.get(id)?.implemented===false;
 if(id!=='overview'&&!(d.gen.has(id)||d.uni.has(id)||d.pend.has(id))||pending&&!techPending)id='overview';techChosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-uitem'))){const on=b.dataset.tech===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 const g=d.gen.get(id),u=d.uni.get(id),q=d.pend.get(id),icons=open.ctx.icons;
 open.detail.replaceChildren(g?techPageView(g,icons):u?uniquePageView(u,icons):q?pendingTechView(q):techOverview(icons));open.detail.scrollTop=0;}
function renderTechs(focus:boolean){
 if(!open)return;
 const seg=(by:'building'|'age',label:string)=>{const b=h('button',{type:'button',class:'cx-tool','aria-pressed':String(techBy===by)},label);
  b.onclick=()=>{if(techBy===by)return;techBy=by;for(const x of Array.from(b.parentElement!.children))x.setAttribute('aria-pressed',String(x===b));fillTechList(list);selectTech(techChosen);};return b;};
 const pend=h('button',{type:'button',class:'cx-tool pend','aria-pressed':String(techPending),title:'列出 aoetw 收錄、本作尚未實作的科技'},'未實作');
 pend.onclick=()=>{techPending=!techPending;pend.setAttribute('aria-pressed',String(techPending));fillTechList(list);selectTech(techChosen);};
 const tools=h('div',{class:'cx-tools'},h('div',{class:'cx-seg',role:'group','aria-label':'分組方式'},seg('building','依建築'),seg('age','依時代')),pend);
 const list=h('nav',{class:'cx-list','aria-label':'科技列表'});
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-tech-name',tabindex:'-1'});
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-uitem');if(b?.dataset.tech)selectTech(b.dataset.tech);});
 list.addEventListener('keydown',e=>{const ids=Array.from(list.querySelectorAll<HTMLButtonElement>('.cx-uitem')).map(b=>b.dataset.tech!),next=step(e.key,Math.max(0,ids.indexOf(techChosen)),ids.length);
  if(next===null)return;e.preventDefault();selectTech(ids[next],true);});
 fillTechList(list);open.body.replaceChildren(h('div',{class:'cx-side'},tools,list),detail);open.list=list;open.detail=detail;
 selectTech(techChosen,focus);}
// ── 建築 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
let buildingData:{pages:Map<string,BuildingPage>;pend:Map<string,PendingBuilding>}|null=null;
const buildings=()=>buildingData??=({pages:new Map(buildingPages().map(b=>[b.id,b])),pend:new Map(pendingBuildings().map(b=>[b.id,b]))});
const arrowBonusText=(s:BuildingSheet)=>s.arrows?.bonus.length?s.arrows.bonus.map(b=>`對${b.label} +${b.value}`).join('、'):'無';
// The rows a building has: hit points and armor always, housing, garrison and arrows only where some column has them.
function buildingRows(sheets:BuildingSheet[]):[string,(s:BuildingSheet)=>string,string?][]{
 const rows:[string,(s:BuildingSheet)=>string,string?][]=[['生命',s=>String(s.hp)],['護甲',s=>`${s.armor[0]}/${s.armor[1]}`,'近戰護甲／遠程護甲']];
 if(sheets.some(s=>s.housing))rows.push(['人口',s=>`+${s.housing}`]);
 if(sheets.some(s=>s.garrison))rows.push(['駐軍',s=>`${s.garrison} 名`]);
 if(sheets.some(s=>s.arrows))rows.push(['每輪箭數',s=>s.arrows?`${s.arrows.count} 支`:'—'],['每支攻擊',s=>s.arrows?`${s.arrows.damage}（遠程）`:'—'],
  ['射程',s=>s.arrows?tilesText(s.arrows.range):'—'],['射擊間隔',s=>s.arrows?secondsText(cooldownSeconds(s.arrows.cooldown)):'—'],['額外傷害',arrowBonusText]);
 return rows;}
function buildingTable(b:BuildingPage){
 const cols=[{name:b.name,sheet:b.sheet},...b.steps.map(s=>({name:s.name,sheet:s.sheet}))],rows=buildingRows(cols.map(c=>c.sheet));
 return h('table',{class:'cx-stats'},cols.length>1?h('thead',null,h('tr',null,h('td',null),...cols.map(c=>h('th',{scope:'col'},c.name)))):null,
  h('tbody',null,...rows.map(([label,f,title])=>{const cells=cols.map(c=>f(c.sheet));
   return h('tr',null,h('th',{scope:'row',...(title?{title}:{})},label),...cells.map((c,i)=>h('td',i&&c!==cells[i-1]?{class:'up'}:null,c)));})));}
// A civilization's numbers where they differ from the plain building's.
function sheetDiff(base:BuildingSheet,s:BuildingSheet){const out:string[]=[];
 if(s.hp!==base.hp)out.push(`生命 ${s.hp}`);if(s.housing!==base.housing)out.push(`人口 +${s.housing}`);if(s.garrison!==base.garrison)out.push(`駐軍 ${s.garrison} 名`);
 if(s.arrows&&base.arrows){if(s.arrows.count!==base.arrows.count)out.push(`每輪 ${s.arrows.count} 支箭`);if(s.arrows.damage!==base.arrows.damage)out.push(`每支攻擊 ${s.arrows.damage}`);
  if(s.arrows.range!==base.arrows.range)out.push(`射程 ${tilesText(s.arrows.range)}`);if(s.arrows.cooldown!==base.arrows.cooldown)out.push(`射擊間隔 ${secondsText(cooldownSeconds(s.arrows.cooldown))}`);}
 return out.join('・');}
function buildingHead(name:string,nameEn:string,sub:Kid[]){return [h('h3',{id:'cx-building-name'},name,h('span',{lang:'en'},nameEn)),h('p',{class:'cx-sub'},...sub)];}
function buildingFoot(sources:string[]){return h('footer',{class:'cx-foot'},h('p',null,buildingsNote),sources.length?h('p',null,`資料來源：${sources.join('、')}`):null);}
function buildingPageView(b:BuildingPage,icons:Record<string,string>){
 const p=h('div',{class:'cx-page'});
 p.append(...buildingHead(b.name,b.nameEn,[`${b.groupLabel}・${ageName(b.age)}起`,b.refName?`・aoetw 譯名：${b.refName}`:'']),h('p',{class:'cx-summary'},b.text));
 const build=h('section',null,h('h4',null,'建造'),costRow(icons,b.cost,b.seconds,`${b.perSegment?'每一格・':''}一名${b.builders}的建造時間`));
 if(b.requires.length)build.append(h('p',{class:'cx-chain'},'需要先完成：',h('b',null,b.requires.map(r=>r.name).join(' → '))));
 build.append(h('p',{class:'cx-chain'},'占地：',h('b',null,`${numberText(b.footprint.width)} × ${numberText(b.footprint.depth)} 格`),b.perSegment?'（拖出一段牆時每格各算一節）':''));
 p.append(build);
 if(b.steps.length)p.append(h('section',null,h('h4',null,'升級路線',h('small',null,'研究後，場上與之後蓋的都換成新數值')),
  h('ol',{class:'cx-path'},h('li',null,h('b',null,b.name),h('p',{class:'cx-age'},ageName(b.age)),h('p',{class:'cx-cost'},h('span',{class:'t'},'起始建築'))),
   ...b.steps.map(s=>h('li',null,h('b',null,s.name),h('p',{class:'cx-age'},ageName(s.age)),costRow(icons,s.cost,s.seconds,`於${s.at}研究`),
    s.refName?h('p',{class:'cx-ref'},`aoetw 譯名：${s.refName}`):null,s.text?h('p',{class:'cx-step'},s.text):null)))));
 p.append(h('section',null,h('h4',null,'數值',h('small',null,b.steps.length?'無文明加成；每欄是完成此前升級後':'無文明加成、未研究任何科技')),h('div',{class:'cx-scroll'},buildingTable(b)),
  b.partial?h('ul',{class:'cx-bricks off',style:'margin-top:10px'},h('li',null,h('span',null,h('span',{class:'cx-flag'},'尚未實作'),`：${b.partial}`))):null));
 if(b.trains.length||b.researches.length||b.uniqueHere){const dl=h('dl',{class:'cx-tree'});
  if(b.trains.length)dl.append(h('dt',null,'訓練'),h('dd',null,b.trains.map(x=>x.name).join('、')));
  if(b.researches.length)dl.append(h('dt',null,'研究'),h('dd',null,b.researches.map(x=>x.name).join('、')));
  // A few civilizations: named here; the Castle's thirteen are on each civilization's page.
  if(b.unique.length>2)dl.append(h('dt',null,'文明專屬'),h('dd',null,'各文明的特殊單位與特殊科技，見「文明」分類'));
  else for(const u of b.unique)dl.append(h('dt',null,`${civName(u.civ)}專屬`),h('dd',null,u.names.join('、')));
  p.append(h('section',null,h('h4',null,'生產與研究'),dl));}
 if(b.techs.length)p.append(h('section',null,h('h4',null,'相關科技',h('small',null,'在其他建築研究、會改變這座建築的通用科技')),bricks(b.techs.map(t=>`${t.name}：${t.texts.join('；')}`))));
 if(b.variants.length||b.civEffects.length){const dl=h('dl',{class:'cx-tree'});
  for(const v of b.variants){const diff=sheetDiff(b.sheet,v.sheet);dl.append(h('dt',null,civName(v.civ)),h('dd',null,costRow(icons,v.cost,null,diff),h('small',null,v.texts.join('；'))));}
  for(const e of b.civEffects)dl.append(h('dt',null,civName(e.civ)),h('dd',null,e.text));
  p.append(h('section',null,h('h4',null,'文明差異',h('small',null,`價格與數值以${ageName(b.age)}計算`)),dl));}
 p.append(h('section',null,h('h4',null,'缺少的文明'),h('p',{class:'cx-prose'},b.lacks.length?b.lacks.map(civName).join('、'):'每個文明都能建造。')),buildingFoot(b.sources));
 return p;}
function pendingBuildingView(b:PendingBuilding){
 const p=h('div',{class:'cx-page'});
 p.append(...buildingHead(b.name,b.nameEn,[`原作・${ageName(b.age)}`,b.civ?`・${b.civ}特殊建築`:'']),
  h('p',{class:'cx-summary'},h('span',{class:'cx-flag'},'尚未實作'),`：${b.reason}。`),h('p',{class:'cx-summary',style:'margin-top:8px'},b.text),buildingFoot(b.sources));
 return p;}
function buildingOverview(){
 const o=buildingsOverview(),p=h('div',{class:'cx-page'});
 p.append(h('h3',{id:'cx-building-name'},'建築',h('span',{lang:'en'},'Buildings')),h('p',{class:'cx-summary'},o.intro),
  h('p',{class:'cx-sub cx-count'},`本作有 ${o.buildings} 種建築與 ${o.upgrades} 項建築升級；aoetw 收錄、本作沒有的有 ${o.pending} 座。`),
  h('section',null,h('h4',null,'類型'),h('div',{class:'cx-ov'},...o.groups.map(g=>h('article',{class:'cx-tech'},h('h5',null,g.label,h('span',{class:'cx-count'},`本作 ${g.buildings}・未實作 ${g.pending}`)),h('p',null,g.text))))),
  h('section',null,h('h4',null,'本作沒有的建築'),h('p',{class:'cx-prose'},o.missing)),
  h('footer',{class:'cx-foot'},h('p',null,buildingsNote),h('p',null,'資料來源：aoetw.com/building')));
 return p;}
function buildingItem(it:BuildingItem){
 return h('li',null,h('button',{type:'button',class:`cx-uitem${it.pending?' off':''}`,'data-building':it.id,tabindex:'-1','aria-current':'false'},h('b',null,it.name),h('small',null,it.sub),it.pending?h('span',{class:'cx-mark off'},'未實作'):null));}
function fillBuildingList(list:HTMLElement){
 const groups=buildingGroupsBy(buildingBy).map(g=>({...g,items:g.items.filter(i=>buildingPending||!i.pending)})).filter(g=>g.items.length);
 list.replaceChildren(h('div',{class:'cx-grp'},h('ul',null,h('li',null,h('button',{type:'button',class:'cx-uitem','data-building':'overview',tabindex:'-1','aria-current':'false'},h('b',null,'總覽'),h('small',null,'類型與資料來源'))))),
  ...groups.map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-bg${i}`},g.label),h('ul',{'aria-labelledby':`cx-bg${i}`},...g.items.map(buildingItem)))));}
function selectBuilding(id:string,focus=false){
 if(!open)return;const d=buildings();if(id!=='overview'&&!d.pages.has(id)&&!(buildingPending&&d.pend.has(id)))id='overview';buildingChosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-uitem'))){const on=b.dataset.building===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 const g=d.pages.get(id),q=d.pend.get(id);
 open.detail.replaceChildren(g?buildingPageView(g,open.ctx.icons):q?pendingBuildingView(q):buildingOverview());open.detail.scrollTop=0;}
function renderBuildings(focus:boolean){
 if(!open)return;
 const seg=(by:'group'|'age',label:string)=>{const b=h('button',{type:'button',class:'cx-tool','aria-pressed':String(buildingBy===by)},label);
  b.onclick=()=>{if(buildingBy===by)return;buildingBy=by;for(const x of Array.from(b.parentElement!.children))x.setAttribute('aria-pressed',String(x===b));fillBuildingList(list);selectBuilding(buildingChosen);};return b;};
 const pend=h('button',{type:'button',class:'cx-tool pend','aria-pressed':String(buildingPending),title:'列出 aoetw 收錄、本作沒有的建築'},'未實作');
 pend.onclick=()=>{buildingPending=!buildingPending;pend.setAttribute('aria-pressed',String(buildingPending));fillBuildingList(list);selectBuilding(buildingChosen);};
 const tools=h('div',{class:'cx-tools'},h('div',{class:'cx-seg',role:'group','aria-label':'分組方式'},seg('group','依類型'),seg('age','依時代')),pend);
 const list=h('nav',{class:'cx-list','aria-label':'建築列表'});
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-building-name',tabindex:'-1'});
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-uitem');if(b?.dataset.building)selectBuilding(b.dataset.building);});
 list.addEventListener('keydown',e=>{const ids=Array.from(list.querySelectorAll<HTMLButtonElement>('.cx-uitem')).map(b=>b.dataset.building!),next=step(e.key,Math.max(0,ids.indexOf(buildingChosen)),ids.length);
  if(next===null)return;e.preventDefault();selectBuilding(ids[next],true);});
 fillBuildingList(list);open.body.replaceChildren(h('div',{class:'cx-side'},tools,list),detail);open.list=list;open.detail=detail;
 selectBuilding(buildingChosen,focus);}
// ── Category 遊戲元素 ─────────────────────────────────────────────────────────────────────────────────────────────
const elementCache=new Map<string,ElementPage>();
const element=(id:string)=>{let p=elementCache.get(id);if(!p){const q=elementPage(id);if(q){p=q;elementCache.set(id,p);}}return p??null;};
function elementBlock(b:ElementBlock,speak:((n:number)=>void)|undefined):HTMLElement{
 const head=h('h4',null,b.title,b.note?h('small',null,b.note):null);
 if(b.kind==='table')return h('section',null,head,h('div',{class:'cx-scroll'},h('table',{class:`cx-stats${b.head.length>3?' cx-wide':''}`},
  h('thead',null,h('tr',null,...b.head.map(c=>h('th',{scope:'col'},c)))),h('tbody',null,...b.rows.map(r=>h('tr',null,h('th',{scope:'row'},r[0]),...r.slice(1).map(c=>h('td',null,c))))))));
 if(b.kind==='facts'){const dl=h('dl',{class:'cx-tree'});for(const i of b.items)dl.append(h('dt',null,i.label),h('dd',null,i.value));return h('section',null,head,dl);}
 if(b.kind==='list')return h('section',null,head,bricks(b.items));
 if(b.kind==='example')return h('article',null,h('h5',null,b.title),h('ol',{class:'cx-eq'},...b.lines.map(l=>h('li',null,l))));
 // The taunts: number, the site's Chinese line, the English original; a voice button only when the page lends one.
 return h('section',null,head,h('div',{class:'cx-scroll'},h('table',{class:'cx-stats'},h('thead',null,h('tr',null,h('th',{scope:'col'},'編號'),h('th',{scope:'col'},'中文'),h('th',{scope:'col'},'英文'),speak?h('td',null):null)),
  h('tbody',null,...b.rows.map(t=>{const row=h('tr',null,h('td',{class:'n'},String(t.n)),h('td',null,t.zh),h('td',{class:'en',lang:'en'},t.en));
   if(speak){const cell=h('td',{class:'say'});if(t.spoken){const btn=h('button',{type:'button',class:'cx-say','aria-label':`朗讀第 ${t.n} 句：${t.zh}`},'朗讀');btn.onclick=()=>speak(t.n);cell.append(btn);}row.append(cell);}
   return row;})))));}
function elementView(p:ElementPage,speak:((n:number)=>void)|undefined){
 const page=h('div',{class:'cx-page'});
 page.append(h('h3',{id:'cx-element-name'},p.name,h('span',{lang:'en'},p.nameEn)),h('p',{class:'cx-sub'},p.menu?'aoetw 遊戲元素選單':'aoetw 遊戲元素（選單以外的條目）',p.refName&&p.refName!==p.name?`・aoetw 譯名：${p.refName}`:''),
  h('p',{class:'cx-summary'},p.text));
 // Worked examples sit side by side under one heading.
 const examples=p.blocks.filter(b=>b.kind==='example');
 for(const b of p.blocks)if(b.kind!=='example')page.append(elementBlock(b,speak));
 if(examples.length)page.append(h('section',null,h('h4',null,'算一次傷害',h('small',null,'取自模擬的實際數字')),h('div',{class:'cx-ex'},...examples.map(b=>elementBlock(b,speak)))));
 page.append(h('section',null,h('h4',null,'本作沒有的部分'),p.lacks.length?h('ul',{class:'cx-bricks off'},...p.lacks.map(l=>h('li',null,h('span',null,l.name,h('small',null,l.reason))))):h('p',{class:'cx-prose'},'沒有：網站這一頁說的本作都有。')),
  h('footer',{class:'cx-foot'},h('p',null,elementsNote),h('p',null,`資料來源：${p.source}`)));
 return page;}
function elementOverview(){
 const p=h('div',{class:'cx-page'});
 p.append(h('h3',{id:'cx-element-name'},'遊戲元素',h('span',{lang:'en'},'Game elements')),h('p',{class:'cx-summary'},elementsIntro),
  ...elementGroups().map(g=>h('section',null,h('h4',null,g.label),h('div',{class:'cx-ov'},...g.items.map(e=>h('article',{class:'cx-tech'},h('h5',null,e.name,h('span',{lang:'en'},e.nameEn)),h('p',null,e.summary)))))),
  h('footer',{class:'cx-foot'},h('p',null,elementsNote),h('p',null,'資料來源：aoetw.com 遊戲元素選單、elements/Conversion、elements/Line_of_Sight')));
 return p;}
function fillElementList(list:HTMLElement){
 list.replaceChildren(h('div',{class:'cx-grp'},h('ul',null,h('li',null,h('button',{type:'button',class:'cx-uitem','data-element':'overview',tabindex:'-1','aria-current':'false'},h('b',null,'總覽'),h('small',null,'條目與資料來源'))))),
  ...elementGroups().map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-eg${i}`},g.label),h('ul',{'aria-labelledby':`cx-eg${i}`},
   ...g.items.map(e=>h('li',null,h('button',{type:'button',class:'cx-uitem','data-element':e.id,tabindex:'-1','aria-current':'false'},h('b',null,e.name),h('small',null,e.nameEn))))))));}
function selectElement(id:string,focus=false){
 if(!open)return;const p=id==='overview'?null:element(id);if(!p)id='overview';elementChosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-uitem'))){const on=b.dataset.element===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 open.detail.replaceChildren(p?elementView(p,open.ctx.speakTaunt):elementOverview());open.detail.scrollTop=0;}
function renderElements(focus:boolean){
 if(!open)return;
 const list=h('nav',{class:'cx-list','aria-label':'遊戲元素列表'});
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-element-name',tabindex:'-1'});
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-uitem');if(b?.dataset.element)selectElement(b.dataset.element);});
 list.addEventListener('keydown',e=>{const ids=Array.from(list.querySelectorAll<HTMLButtonElement>('.cx-uitem')).map(b=>b.dataset.element!),next=step(e.key,Math.max(0,ids.indexOf(elementChosen)),ids.length);
  if(next===null)return;e.preventDefault();selectElement(ids[next],true);});
 fillElementList(list);open.body.replaceChildren(list,detail);open.list=list;open.detail=detail;
 selectElement(elementChosen,focus);}
// ── Category 戰術技巧 ─────────────────────────────────────────────────────────────────────────────────────────────
const tacticCache=new Map<string,TacticPage>();
const tactic=(id:string)=>{let p=tacticCache.get(id);if(!p){const q=tacticPage(id);if(q){p=q;tacticCache.set(id,p);}}return p??null;};
// An opening's build order: one well per phase; a filled brick is a step the coach checks, an outlined one advice.
function tacticBlock(b:TacticBlock):HTMLElement{
 if(b.kind!=='steps')return elementBlock(b,undefined);
 return h('section',null,h('h4',null,b.title,b.note?h('small',null,b.note):null),h('div',{class:'cx-phases'},
  ...b.phases.map(g=>h('article',{class:'cx-tech'},h('h5',null,g.label),h('ol',{class:'cx-bricks cx-steps'},...g.steps.map(st=>h('li',st.check?null:{class:'tip'},h('span',null,st.label))))))));}
function tacticView(p:TacticPage){
 const page=h('div',{class:'cx-page'});
 page.append(h('h3',{id:'cx-tactic-name'},p.name,h('span',{lang:'en'},p.nameEn)),
  h('p',{class:'cx-sub'},p.group==='opening'?'aoetw 戰術技巧・主流打法（阿拉伯）':'aoetw 戰術技巧・控兵技巧',p.available?'':h('b',null,'・未實作')),
  h('p',{class:'cx-summary'},p.text));
 if(p.reason)page.append(h('p',{class:'cx-prose cx-why'},`本作不能玩：${p.reason}。`));
 if(p.how)page.append(h('section',null,h('h4',null,'在本作怎麼做'),h('p',{class:'cx-prose'},p.how)));
 for(const b of p.blocks)page.append(tacticBlock(b));
 page.append(h('section',null,h('h4',null,'本作沒有的部分'),p.lacks.length?h('ul',{class:'cx-bricks off'},...p.lacks.map(l=>h('li',null,h('span',null,l.name,h('small',null,l.reason))))):h('p',{class:'cx-prose'},'沒有：網站這一頁說的本作都做得到。')),
  h('footer',{class:'cx-foot'},h('p',null,tacticsNote),h('p',null,`資料來源：${p.source}`)));
 return page;}
function tacticOverview(){
 const p=h('div',{class:'cx-page'});
 p.append(h('h3',{id:'cx-tactic-name'},'戰術技巧',h('span',{lang:'en'},'Tactics')),h('p',{class:'cx-summary'},tacticsIntro),
  h('section',null,h('h4',null,'基礎升級'),h('p',{class:'cx-prose'},basicUpgradesText),h('ul',{class:'cx-bricks off cx-basic'},...basicUpgradeItems.map(i=>h('li',null,h('span',null,i))))),
  ...tacticGroups().map(g=>h('section',null,h('h4',null,g.label),h('div',{class:'cx-ov'},...g.items.map(e=>h('article',{class:`cx-tech${e.available?'':' off'}`},h('h5',null,e.name,h('span',{lang:'en'},e.nameEn)),h('p',null,e.available?e.summary:`${e.summary}（未實作）`)))))),
  h('footer',{class:'cx-foot'},h('p',null,tacticsNote),h('p',null,'資料來源：aoetw.com/ar 與各打法頁')));
 return p;}
function fillTacticList(list:HTMLElement){
 list.replaceChildren(h('div',{class:'cx-grp'},h('ul',null,h('li',null,h('button',{type:'button',class:'cx-uitem','data-tactic':'overview',tabindex:'-1','aria-current':'false'},h('b',null,'總覽'),h('small',null,'基礎升級與目錄'))))),
  ...tacticGroups().map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-tg${i}`},g.label),h('ul',{'aria-labelledby':`cx-tg${i}`},
   ...g.items.map(e=>h('li',null,h('button',{type:'button',class:`cx-uitem${e.available?'':' off'}`,'data-tactic':e.id,tabindex:'-1','aria-current':'false'},h('b',null,e.name),h('small',null,e.available?e.nameEn:'未實作'))))))));}
function selectTactic(id:string,focus=false){
 if(!open)return;const p=id==='overview'?null:tactic(id);if(!p)id='overview';tacticChosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-uitem'))){const on=b.dataset.tactic===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 open.detail.replaceChildren(p?tacticView(p):tacticOverview());open.detail.scrollTop=0;}
function renderTactics(focus:boolean){
 if(!open)return;
 const list=h('nav',{class:'cx-list','aria-label':'戰術技巧列表'});
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-tactic-name',tabindex:'-1'});
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-uitem');if(b?.dataset.tactic)selectTactic(b.dataset.tactic);});
 list.addEventListener('keydown',e=>{const ids=Array.from(list.querySelectorAll<HTMLButtonElement>('.cx-uitem')).map(b=>b.dataset.tactic!),next=step(e.key,Math.max(0,ids.indexOf(tacticChosen)),ids.length);
  if(next===null)return;e.preventDefault();selectTactic(ids[next],true);});
 fillTacticList(list);open.body.replaceChildren(list,detail);open.list=list;open.detail=detail;
 selectTactic(tacticChosen,focus);}
// ── Category 科技樹 ───────────────────────────────────────────────────────────────────────────────────────────────
// The tree of one civilization, like aoetw.com's civ tree pages: a block per building (its own picture opens its page),
// ages down, a column per line; in a match, the player's own tree is marked with what they have done and can do now.
const treeCache=new Map<string,CivTree>();
const treeOf=(civ:string)=>{const k=`${civ}:${treeRefs}`;let t=treeCache.get(k);if(!t){t=civTree(civ,treeRefs);treeCache.set(k,t);}return t;};
const iconOf=(icons:Record<string,string>,keys:readonly string[])=>keys.map(k=>icons[k]).find(Boolean)??null;
function treeNode(n:TreeNode,icons:Record<string,string>,mark:TreeMark|null,linked=false):HTMLElement{
 const src=iconOf(icons,n.icons),cls=['cx-tnode',linked?'linked':'',n.kind==='ref'?'ref':n.available?'':'off',n.unique&&n.available?'uniq':'',mark&&n.available&&n.kind!=='ref'?`s-${mark.state}`:''].filter(Boolean).join(' ');
 const status=n.kind==='ref'?'本作沒有':!n.available?'沒有':mark?mark.state==='owned'?`擁有 ${mark.count}`:treeMarkLabels[mark.state]:n.alias?'同一項研究':'';
 // Prerequisites from another block (Chemistry) and upgrades elsewhere (the University's towers) as a short note.
 const note=[n.needs.length?`需${n.needs.join('、')}`:'',n.leads.length?`升級：${n.leads.join('、')}`:''].filter(Boolean).join('；');
 const label=[n.name,status,note,n.reason].filter(Boolean).join('：');
 const kids=[src?h('img',{src,alt:''}):h('span',{class:'noimg','aria-hidden':'true'},'·'),h('span',{class:'nm'},n.name),note?h('span',{class:'nd'},note):null,status?h('span',{class:'mk'},status):null];
 return n.link?h('button',{type:'button',class:cls,'data-section':n.link.section,'data-page':n.link.id,'aria-label':label,title:label},...kids):h('div',{class:cls,role:'img','aria-label':label,title:label},...kids);}
function treeBlockView(b:TreeBlock,icons:Record<string,string>,marks:(n:TreeNode)=>TreeMark|null):HTMLElement{
 const head=b.head?(()=>{const src=iconOf(icons,b.head.icons),m=marks(b.head),st=!b.head.available?'（此文明沒有）':m&&(m.state==='owned'||m.state==='queued')?`（${m.state==='owned'?`擁有 ${m.count}`:'建造中'}）`:'';
  return h('button',{type:'button','data-section':'buildings','data-page':b.head.id,...(m?{'data-state':m.state}:{})},src?h('img',{src,alt:''}):null,h('span',null,b.name),st?h('small',null,st):null);})():h('span',null,b.name);
 const grid=h('div',{class:'cx-tgrid',style:`grid-template-columns:auto repeat(${b.columns.length},max-content)`});
 b.ages.forEach((age,r)=>{grid.append(h('div',{class:'cx-tage'},ageName(age)));
  for(const col of b.columns){const c:TreeCell=col[r];grid.append(h('div',{class:['cx-tcell',c.down?'down':'',c.pipe?'pipe':''].filter(Boolean).join(' ')},...c.nodes.map((n,i)=>treeNode(n,icons,marks(n),i>0&&c.links[i-1]))));}});
 return h('section',{class:'cx-tblock','aria-label':b.name},h('h4',null,head),h('div',{class:'cx-scroll'},grid));}
function treeView(civ:string){
 if(!open)return h('div',null);const t=treeOf(civ),icons=open.ctx.icons,m=open.ctx.match&&open.ctx.match.civ===civ?open.ctx.match:null;
 const marks=(n:TreeNode)=>m?treeMark(n,m):null,page=h('div',{class:'cx-page cx-wide-page'});
 page.append(h('h3',{id:'cx-tree-name'},`${t.name}・科技樹`,h('span',{lang:'en'},'Technology tree')),
  h('p',{class:'cx-sub'},t.type,m?h('b',null,`・目前對局：${ageName(m.age)}`):open.ctx.match?'・不是你這局的文明（不標對局進度）':''),
  h('p',{class:'cx-summary'},treeIntro));
 if(t.bonuses.length||t.team.length)page.append(h('section',null,h('h4',null,'文明加成'),h('div',{class:'cx-cols'},
  t.bonuses.length?h('ul',{class:'cx-bricks'},...t.bonuses.map(x=>h('li',null,h('span',null,x)))):null,
  t.team.length?h('div',null,h('p',{class:'cx-note'},'團隊加成'),h('ul',{class:'cx-bricks'},...t.team.map(x=>h('li',null,h('span',null,x))))):null)));
 const refBtn=h('button',{type:'button',class:'cx-tool pend','aria-pressed':String(treeRefs)},'顯示本作沒有的項目');
 refBtn.onclick=()=>{treeRefs=!treeRefs;const y=open?.detail.scrollTop??0;selectTree(civ);if(open)open.detail.scrollTop=y;};
 const states:TreeMark['state'][]=m?['done','owned','queued','ready','short','later','off','ref']:['off','ref'];
 page.append(h('div',{class:'cx-tools cx-tree-tools'},refBtn,h('ul',{class:'cx-legend','aria-label':'圖例'},h('li',null,h('i',{class:'s-uniq'}),'特殊單位與科技'),
  ...states.filter(s=>s!=='ref'||treeRefs).map(s=>h('li',null,h('i',{class:`s-${s}`}),treeMarkLabels[s])))));
 page.append(h('div',{class:'cx-tblocks'},...t.blocks.map(b=>treeBlockView(b,icons,marks))),
  h('footer',{class:'cx-foot'},h('p',null,treeNote),h('p',null,'資料來源：aoetw.com/tree')));
 return page;}
function selectTree(id:string,focus=false){
 if(!open)return;treeChosen=id;
 for(const b of Array.from(open.list.querySelectorAll<HTMLButtonElement>('.cx-civ'))){const on=b.dataset.civ===id;b.setAttribute('aria-current',String(on));b.tabIndex=on?0:-1;
  if(on){if(focus)b.focus({preventScroll:true});reveal(open.list,b);}}
 open.detail.replaceChildren(treeView(id));open.detail.scrollTop=0;}
function renderTree(focus:boolean){
 if(!open)return;
 const items=civList(open.ctx.civs),groups:{label:string;items:CivListItem[]}[]=[];
 for(const c of items){const g=groups.at(-1);if(g&&g.label===c.group)g.items.push(c);else groups.push({label:c.group,items:[c]});}
 const list=h('nav',{class:'cx-list','aria-label':'科技樹文明列表'},...groups.map((g,i)=>h('div',{class:'cx-grp'},h('p',{class:'cx-group',id:`cx-tr${i}`},g.label),h('ul',{'aria-labelledby':`cx-tr${i}`},...g.items.map(listItem)))));
 const detail=h('div',{class:'cx-detail',role:'region','aria-labelledby':'cx-tree-name',tabindex:'-1'});
 list.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('.cx-civ');if(b?.dataset.civ)selectTree(b.dataset.civ);});
 list.addEventListener('keydown',e=>{const ids=items.map(c=>c.id),next=step(e.key,Math.max(0,ids.indexOf(treeChosen??ids[0])),ids.length);
  if(next===null)return;e.preventDefault();selectTree(ids[next],true);});
 // An item opens its own page in its category (a unit's line, a technology, a building, a reference item).
 detail.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLElement>('[data-page]');if(b?.dataset.section&&b.dataset.page)go(b.dataset.section as CodexSection,b.dataset.page);});
 open.body.replaceChildren(list,detail);open.list=list;open.detail=detail;
 selectTree(treeChosen??open.ctx.match?.civ??items[0].id,focus);}
// Opens a page in another category (from the tree): reference items need that category's 未實作 list switched on.
function go(id:CodexSection,page:string){
 if(id==='units'){unitChosen=page;showPending=true;}else if(id==='techs'){techChosen=page;techPending=true;}else if(id==='buildings'){buildingChosen=page;buildingPending=true;}
 show(id,false);open?.detail.focus({preventScroll:true});}
// ── The book ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function show(id:CodexSection,focus:boolean){
 if(!open)return;section=id;
 // The chosen tab stays in view (on a phone the tab row scrolls: 科技樹 opened by F4 sits past its edge).
 for(const t of open.tabs){const on=t.dataset.section===id;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;if(on&&t.parentElement)reveal(t.parentElement,t);}
 open.body.setAttribute('aria-labelledby',`cx-tab-${id}`);
 if(id==='units')renderUnits(focus);else if(id==='techs')renderTechs(focus);else if(id==='buildings')renderBuildings(focus);else if(id==='elements')renderElements(focus);else if(id==='tactics')renderTactics(focus);else if(id==='tree')renderTree(focus);else renderCivs(focus);}
function injectStyle(){if(document.getElementById('cx-style'))return;const s=document.createElement('style');s.id='cx-style';s.textContent=css;document.head.append(s);}
export function openCodex(host:HTMLElement,ctx:CodexContext){
 injectStyle();const prev=open?.prev??document.activeElement;open=null;
 const close=h('button',{type:'button',class:'cx-close'},'關閉',h('kbd',null,'Esc'));close.onclick=()=>closeCodex();
 // The category switch: tabs with roving focus; arrow keys, Home and End move and show, as do clicks.
 const tabs=codexSections.map(s=>h('button',{type:'button',role:'tab',class:'cx-tab',id:`cx-tab-${s.id}`,'data-section':s.id,'aria-controls':'cx-panel','aria-selected':'false',tabindex:'-1'},s.label));
 const tablist=h('div',{class:'cx-tabs',role:'tablist','aria-label':'百科分類'},...tabs);
 tablist.addEventListener('click',e=>{const t=(e.target as Element).closest<HTMLButtonElement>('.cx-tab');if(t&&t.dataset.section!==section)show(t.dataset.section as CodexSection,false);});
 tablist.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown')return;const i=tabs.findIndex(t=>t.dataset.section===section),next=step(e.key,i,tabs.length);
  if(next===null)return;e.preventDefault();tabs[next].focus();if(next!==i)show(codexSections[next].id,false);});
 const body=h('div',{class:'cx-body',id:'cx-panel',role:'tabpanel'});
 host.classList.add('cx-host');if(!host.hasAttribute('role'))host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-labelledby','cx-title');
 host.replaceChildren(h('div',{class:'cx'},h('header',{class:'cx-head'},h('h2',{id:'cx-title'},'百科'),tablist,close),body));
 host.hidden=false;open={host,ctx,prev,tabs,body,list:body,detail:body};
 // Opened on the tree in a match: the player's own civilization.
 if(ctx.section){section=ctx.section;if(ctx.section==='tree'&&(ctx.match||ctx.treeCiv))treeChosen=ctx.match?.civ??ctx.treeCiv!;}
 show(section,true);}
// Closes the book (its button, or the page on Esc): clears the overlay, returns focus, then tells the page once.
export function closeCodex(){
 if(!open)return;const {host,ctx,prev}=open;open=null;host.replaceChildren();host.hidden=true;
 if(prev instanceof HTMLElement&&prev.isConnected)prev.focus();ctx.onClose();}
export const codexOpen=()=>!!open;
