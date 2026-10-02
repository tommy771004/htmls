// The 戰術技巧 round: shots fly (combat.ts projectiles). settle() holds every shooter's fire (building volleys and unit
// attack cooldowns), ticks until the shots already in the air have come down, then lets them fire again as before; a
// test that counted damage at the moment of firing counts it once the shots have landed.
import {tick} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
// each: what the test's own run() does before every tick (most give both sides full sight, see()).
export function settle(s:State,each:(s:State)=>void=()=>{},max=400){
 const volleys={...s.volleys},cooldowns=Object.fromEntries(Object.entries(s.attacks).map(([id,a])=>[id,a.cooldown]));
 for(const b of s.buildings)s.volleys[b.id]=1e9;for(const a of Object.values(s.attacks))a.cooldown=1e9;
 for(let i=0;i<max&&s.projectiles.length;i++){each(s);tick(s);for(const b of s.buildings)s.volleys[b.id]=1e9;for(const a of Object.values(s.attacks))if(a.cooldown<1e8)a.cooldown=1e9;}
 each(s);
 for(const b of s.buildings){if(b.id in volleys)s.volleys[b.id]=volleys[b.id];else delete s.volleys[b.id];}
 for(const [id,a] of Object.entries(s.attacks))a.cooldown=id in cooldowns?cooldowns[id]:0;
}
