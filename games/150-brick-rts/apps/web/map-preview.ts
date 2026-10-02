// A generated map seen like the minimap (a diamond, one brick a tile with its stud), shared by the lobby and the codex's
// 地圖 pages: terrain, forests, mines, berries, any prebuilt building (team-tinted; town centres in the team colour),
// predators (wolves, jaguars), a nomad side's starting villagers, relics. Pure drawing on a 2D context: the caller sizes the canvas.
import {obstacleBounds} from '../../packages/content/footprints.ts';
import type {ObstacleKind} from '../../packages/content/footprints.ts';
import {buildingKinds} from '../../packages/sim/navigation.ts';
import type {MapData} from '../../packages/sim/navigation.ts';
export const terrainColor:Record<string,string>={ice:'#d9e6ea',snow:'#e9ece4',cliff:'#8a8065',stone:'#a1a28e',highland:'#879d69',water:'#4b8291',shallow:'#86b7b8',sand:'#d5c598',road:'#c4b18a'};
export const obstacleColor:Record<string,string>={tree:'#4c6b43',gold:'#e2c35e',rock:'#d9d6c6',berries:'#b85a66',hunt:'#9b7552',livestock:'#e7e2cc'};
export const grassColor='#b5c493';
const team={blue:'#5d93b6',red:'#d0664c',blueLight:'#8fb5cc',redLight:'#e09a87'};
const walls=new Set(['palisade-wall','stone-wall','palisade-gate','gate']);
const predators=new Set(['wolf','jaguar']);
const shade=(hex:string,f:number)=>{const n=parseInt(hex.slice(1),16);return `rgb(${Math.min(255,Math.round((n>>16&255)*f))},${Math.min(255,Math.round((n>>8&255)*f))},${Math.min(255,Math.round((n&255)*f))})`;};
// done: how many diagonals (x + y) are drawn so far (a sweep from the north corner); Infinity draws everything.
export function paintMap(ctx:CanvasRenderingContext2D,map:MapData,relics:readonly {x:number;y:number}[],w:number,h:number,done=Infinity){
 const N=map.size,s=Math.min(w/(2*N),h/N)*.96,ox=w/2,oy=(h-N*s)/2,P=(x:number,z:number):[number,number]=>[ox+(x-z)*s,oy+(x+z)*s/2];
 const quad=(x0:number,z0:number,x1:number,z1:number)=>{ctx.beginPath();for(const [i,[x,z]] of ([[x0,z0],[x1,z0],[x1,z1],[x0,z1]] as const).entries()){const [px,py]=P(x,z);if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.closePath();ctx.fill();};
 ctx.clearRect(0,0,w,h);
 map.tiles.forEach((t,i)=>{const x=i%N,z=Math.floor(i/N);if(x+z>done)return;const base=terrainColor[t.terrainType]??grassColor;
  ctx.fillStyle=shade(base,.9);quad(x,z,x+1,z+1);ctx.fillStyle=base;quad(x+.06,z+.06,x+.94,z+.94);
  if(s>=5){const [cx,cy]=P(x+.5,z+.5);ctx.fillStyle=shade(base,1.12);ctx.beginPath();ctx.ellipse(cx,cy-s*.08,s*.28,s*.14,0,0,Math.PI*2);ctx.fill();}});
 // Buildings after the resources, so a wall line reads over the woods it runs past.
 const ordered=[...map.obstacles].sort((a,b)=>Number(buildingKinds.has(a.kind))-Number(buildingKinds.has(b.kind)));
 for(const o of ordered){const [x0,z0,x1,z1]=obstacleBounds(o as {kind:ObstacleKind;x:number;y:number});if(x0/100+z0/100>done)continue;
  ctx.fillStyle=o.kind==='town-center'?(o.red?team.red:team.blue):buildingKinds.has(o.kind)?shade(o.red?team.redLight:team.blueLight,walls.has(o.kind)?.72:1):obstacleColor[o.kind]??'#c8c2a8';
  quad(x0/100,z0/100,x1/100,z1/100);}
 // A side without a town centre (a nomad start): its starting villagers in the team colour show where it begins.
 [0,1].forEach(p=>{if(map.obstacles.some(o=>o.kind==='town-center'&&!!o.red===(p===1)))return;
  for(const v of map.starts[p]??[]){if(v.x/100+v.y/100>done)continue;const [px,py]=P(v.x/100,v.y/100);ctx.fillStyle=p?team.red:team.blue;ctx.strokeStyle='#15201b';ctx.lineWidth=1;
   ctx.beginPath();ctx.arc(px,py,Math.max(2.2,s*.36),0,Math.PI*2);ctx.fill();ctx.stroke();}});
 for(const a of map.animals??[]){if(!predators.has(a.kind)||a.x/100+a.y/100>done)continue;const [px,py]=P(a.x/100,a.y/100);
  ctx.fillStyle='#5b3f36';ctx.beginPath();ctx.arc(px,py,Math.max(1.6,s*.24),0,Math.PI*2);ctx.fill();}
 for(const rel of relics){if(rel.x/100+rel.y/100>done)continue;const [px,py]=P(rel.x/100,rel.y/100);ctx.fillStyle='#f2d66b';ctx.strokeStyle='#15201b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,Math.max(2.5,s*.4),0,Math.PI*2);ctx.fill();ctx.stroke();}
}
