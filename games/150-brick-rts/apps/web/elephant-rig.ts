// Brick war elephant (rendering only): a grey body on four pillar legs, fan ears, a jointed trunk and ivory tusks,
// a team caparison and a howdah whose floor is the rider's saddle. Mounted by the character rig like the horse.
import type {UnitPose} from './unit-rig.ts';
export function createElephantMount(T:any,player:number,box:(w:number,h:number,d:number)=>any,material:(color:string)=>any){
 const root=new T.Group();root.name='elephant-root';const team=player===0?'#45728c':'#b25441',grey='#8d8c86',ear='#9a988f',ivory='#efe8d2',gold='#c9a55a',wood='#6e5438';
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const legs:any[]=[];
 for(const x of [-.3,.3])for(const z of [-.45,.45]){const leg=new T.Group();leg.name=`elephant-leg-${legs.length}`;leg.position.set(x,.8,z);root.add(leg);legs.push(leg);part(leg,0,-.8,0,.3,.8,.32,grey);part(leg,0,-.8,.165,.26,.08,.03,'#d9d2c2');}
 const body=new T.Group();root.add(body);
 part(body,0,.72,0,1,.86,1.5,grey);part(body,0,1.02,0,1.04,.58,1.1,team);part(body,0,.98,0,1.05,.06,1.11,gold);
 // Head, brow, ears (behind the head's front face), eyes, tusks curving up at the tips, tail with a tuft.
 part(body,0,1.02,.8,.72,.7,.46,grey);part(body,0,1.72,.82,.5,.1,.34,grey);
 for(const sx of [-1,1]){part(body,sx*.42,1.02,.62,.1,.6,.46,ear);part(body,sx*.22,1.42,1.035,.06,.05,.02,'#2f3932');part(body,sx*.22,.9,1.12,.08,.08,.34,ivory);part(body,sx*.22,.95,1.32,.07,.12,.07,ivory);}
 part(body,0,.96,-.78,.06,.44,.06,ear);part(body,0,.9,-.78,.1,.1,.1,'#4a4640');
 const trunk=new T.Group();trunk.name='elephant-trunk';trunk.position.set(0,1.1,.96);body.add(trunk);
 part(trunk,0,-.34,.07,.22,.4,.2,grey);part(trunk,0,-.66,.12,.17,.34,.17,grey);part(trunk,0,-.86,.2,.14,.22,.14,grey);part(trunk,0,-.88,.3,.12,.1,.12,grey);
 // Howdah: a timber floor, team-coloured walls with a gold rim and corner posts.
 part(body,0,1.6,-.12,.9,.1,.96,wood);
 for(const z of [.3,-.54])part(body,0,1.7,z,.9,.3,.08,team);for(const x of [-.41,.41])part(body,x,1.7,-.12,.08,.3,.76,team);
 for(const z of [.3,-.54])part(body,0,2,z,.94,.05,.1,gold);
 for(const x of [-.41,.41])for(const z of [.3,-.54])part(body,x,2,z,.08,.3,.08,gold);
 const saddle=new T.Group();saddle.name='rider-saddle';saddle.position.set(0,1.7,-.12);body.add(saddle);
 // A swung leg lifts enough that its front edge and toenails clear the ground.
 function pose(kind:UnitPose,time:number){const t=Number.isFinite(time)?Math.max(0,time):0,phase=t*.008,walking=kind==='walk';
  legs.forEach((leg,i)=>{const swing=walking?Math.sin(phase+(i===0||i===3?0:Math.PI))*.18:0;leg.rotation.x=swing;leg.position.y=.8+Math.abs(Math.sin(swing))*.2;});
  body.position.y=walking?Math.abs(Math.sin(phase))*.03:0;
  // Attack: the trunk swings up and forward; idle: a slow sway.
  trunk.rotation.x=kind==='attack'?-(.5+.4*Math.sin(t*.01)):0;trunk.rotation.z=kind==='idle'?Math.sin(t*.002)*.12:0;}
 return {root,saddle,pose};
}
