import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createGame} from './engine.mjs';
const world=JSON.parse(fs.readFileSync(new URL('./world.json',import.meta.url)));
export function fullWalk(){
 const g=createGame(world),steps=[];
 function action(verb,id,arg=''){const room=g.s.room;g.act(verb,id,arg);steps.push({kind:'act',verb,id,arg,room,to:g.s.room});}
 function take(id){action('take',id);assert(g.has(id),'failed take '+id+': '+g.message);}
 function path(dest){const q=[[g.s.room,[]]],seen=new Set();while(q.length){const [r,p]=q.shift();if(r===dest)return p;if(seen.has(r))continue;seen.add(r);for(const [dir,e] of Object.entries(world.rooms[r].exits)){if(e.flag&&!g.flag(e.flag))continue;q.push([e.to,[...p,dir]]);}}throw Error('No route '+g.s.room+' -> '+dest);}
 function go(dest){for(let n=0;g.s.room!==dest;n++){assert(n<300,'route cycle');const dir=path(dest)[0],room=g.s.room;assert(g.move(dir),'blocked '+dir+': '+g.message);steps.push({kind:'move',dir,room,to:g.s.room});}}
 const deposit=()=>{go('LROOM');action('deposit','TROPH');};
 go('EHOUS');action('open','WINDO');go('LROOM');take('LAMP');action('light','LAMP');go('ATTIC');take('KNIFE');take('ROPE');go('LROOM');action('move','RUG');action('open','DOOR');go('MTROL');
 while(!g.flag('TROLL-FLAG')){g.hurtEnemy('TROLL',40,true);steps.push({kind:'throw',id:'TROLL',room:g.s.room});take('KNIFE');}
 go('MAZE5');take('KEYS');take('BAGCO');go('CYCLO-R');action('say','CYCLO','sinbad');go('TREAS-R');take('CHALI');go('BLROO');deposit();
 // Unlock the original alternate surface route; no invented return passage.
 go('BLROO');go('MAZ11');action('open','GRATE');go('CLEAR');go('EHOUS');go('LROOM');
 go('GALLE');take('PAINT');deposit();
 go('PASS1');go('DOME');action('tie','RAIL');go('MTORC');take('TORCH');
 go('MAINT');take('WRENC');action('button','BUTTO','yellow');go('DAM-R');action('turn','DAM');go('RESES');take('TRUNK');
 go('ICY');action('throw','ICE');go('RUBYR');take('RUBY');go('STREA');take('TORCH');
 // Deposit before hauling the coffin through the drained reservoir.
 deposit();go('LROOM');action('drop','WRENC');
 go('EGYPT');take('COFFI');go('ATLAN');take('TRIDE');deposit();
 go('RIDDL');action('say','RIDDLE','well');go('MPEAR');take('PEARL');go('ECHO');action('say','VOICE','echo');take('BAR');deposit();
 go('MGRAI');take('GRAIL');go('TEMP1');take('BELL');go('TEMP2');take('BOOK');take('CANDL');go('LLD1');
 if(!g.s.lights.CANDL)action('light','CANDL');action('exorcise','GHOST');go('LLD2');go('TEMP2');action('pray','ALTAR');deposit();
 assert.equal(g.score(),285);assert.equal(g.s.deposited.length,11);assert(g.s.won);
 return {steps,final:g.s,score:g.score()};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const result=fullWalk();fs.writeFileSync(new URL('./walkthrough.json',import.meta.url),JSON.stringify(result.steps,null,2));console.log('PASS',result.score,'points;',result.steps.length,'actions;',result.final.visited.length,'rooms visited;',result.final.deposited.length,'treasures');}
