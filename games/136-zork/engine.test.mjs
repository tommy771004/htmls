import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame} from './engine.mjs';
import {fullWalk} from './walkthrough.mjs';
const world=JSON.parse(fs.readFileSync(new URL('./world.json',import.meta.url)));
const make=()=>createGame(world);
function carry(g,...ids){for(const id of ids){g.s.locations[id]='inventory';g.s.inventory.push(id)}}
test('1977 map is closed, 80 rooms, 11 treasures, complete 285-point route',()=>{
 assert.equal(Object.keys(world.rooms).length,80);
 for(const r of Object.values(world.rooms))for(const e of Object.values(r.exits))assert(world.rooms[e.to]);
 const {final,score,steps}=fullWalk();assert.equal(score,285);assert.equal(final.deposited.length,11);assert(final.won);assert(steps.length>300);
});
test('window, trap and chimney retain gate and load conditions',()=>{
 const g=make();g.enter('EHOUS');assert.equal(g.move('WEST'),false);g.act('open','WINDO');assert(g.move('WEST'));g.enter('CELLA');assert.equal(g.flag('TRAP-DOOR'),false);
 g.enter('STUDI');carry(g,'LAMP','KNIFE','ROPE');g.s.lights.LAMP=true;assert.equal(g.move('UP'),false);g.drop('ROPE');assert(g.move('UP'));assert.equal(g.s.room,'KITCH');
});
test('capacity rejects tenth item and water participates in bottle pickup',()=>{
 const g=make();g.enter('KITCH');carry(g,'LAMP','KNIFE','ROPE','KEYS','BELL','BOOK','MATCH','WRENC');g.s.lights.LAMP=true;g.take('BOTTL');assert(!g.has('BOTTL'));g.drop('MATCH');g.take('BOTTL');assert(g.has('BOTTL'));g.take('FOOD');assert.equal(g.s.inventory.length,9);g.s.locations.PUTTY='KITCH';g.take('PUTTY');assert(!g.has('PUTTY'));
});
test('coffin blocks narrow exits, glacier relocates torch, reservoir needs both controls',()=>{
 const g=make();carry(g,'LAMP','COFFI','TORCH','WRENC');g.s.lights.LAMP=true;g.enter('EGYPT');assert.equal(g.move('EAST'),false);g.enter('ICY');assert.equal(g.move('WEST'),false);g.act('throw','ICE');assert(g.flag('GLACIER-FLAG'));assert.equal(g.s.locations.TORCH,'STREA');
 g.enter('DAM-R');g.act('turn','DAM');assert(!g.flag('LOW-TIDE'));g.enter('MAINT');g.act('button','BUTTO','yellow');g.enter('DAM-R');g.act('turn','DAM');assert(g.flag('LOW-TIDE'));
});
test('riddle, echo, cyclops and exorcism reject incomplete or later-edition solutions',()=>{
 const g=make();carry(g,'LAMP');g.s.lights.LAMP=true;g.enter('RIDDL');g.act('say','RIDDLE','river');assert(!g.flag('RIDDLE-FLAG'));g.act('say','RIDDLE','well');assert(g.flag('RIDDLE-FLAG'));
 g.enter('ECHO');g.take('BAR');assert(!g.has('BAR'));g.act('say','VOICE','echo');g.take('BAR');assert(g.has('BAR'));
 g.enter('CYCLO-R');g.act('say','CYCLO','odysseus');assert(!g.flag('MAGIC-FLAG'));g.act('say','CYCLO','sinbad');assert(g.flag('MAGIC-FLAG'));
 g.enter('LLD1');carry(g,'BELL','BOOK','CANDL');g.s.lights.CANDL=false;g.act('exorcise','GHOST');assert(!g.flag('LLD-FLAG'));g.s.lights.CANDL=true;g.act('exorcise','GHOST');assert(g.flag('LLD-FLAG'));
});
test('alternate cyclops food then water solution opens stairs but not broken wall',()=>{
 const g=make();carry(g,'LAMP','FOOD','BOTTL');g.s.lights.LAMP=true;g.enter('CYCLO-R');g.act('give','CYCLO','WATER');assert(!g.flag('CYCLOPS-FLAG'));g.act('give','CYCLO','FOOD');g.act('give','CYCLO','WATER');assert(g.flag('CYCLOPS-FLAG'));assert(!g.flag('MAGIC-FLAG'));
});
test('death restores a complete safe snapshot; save roundtrip and corruption recover',()=>{
 const g=make();g.enter('LROOM');g.take('LAMP');g.act('light','LAMP');g.checkpoint();g.enter('CELLA');g.s.flags.test=true;g.drop('LAMP');g.damage(100);assert.equal(g.s.room,'LROOM');assert(g.has('LAMP'));assert(g.s.lights.LAMP);assert(!g.s.flags.test);assert.equal(g.s.hp,100);
 const restored=createGame(world,JSON.parse(g.serialize()));assert.deepEqual(restored.s,g.s);assert.equal(createGame(world,{version:1,room:'missing'}).s.room,'WHOUS');
});
test('flood timeout restores state and putty prevents further flooding',()=>{
 const g=make();g.enter('LOBBY');carry(g,'LAMP','PUTTY');g.s.lights.LAMP=true;g.checkpoint();g.enter('MAINT');g.act('button','BUTTO','blue');const old=g.s;g.tick(46);assert.notEqual(g.s,old);assert.equal(g.s.room,'LOBBY');g.enter('MAINT');g.act('button','BUTTO','blue');g.act('plug','LEAK');g.tick(100);assert.equal(g.s.room,'MAINT');assert.equal(g.s.drown,-1);
});
test('mirror exchanges room contents; stolen treasure can be recovered',()=>{
 const g=make();carry(g,'LAMP','RUBY');g.s.lights.LAMP=true;g.enter('MIRR1');g.drop('RUBY');g.act('rub','REFLE');assert.equal(g.s.room,'MIRR2');assert.equal(g.s.locations.RUBY,'MIRR2');g.take('RUBY');g.steal();assert.equal(g.s.locations.RUBY,'THIEF');g.enter('TREAS-R');assert.equal(g.s.locations.RUBY,'TREAS-R');g.take('RUBY');assert(g.has('RUBY'));
});
