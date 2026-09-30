// Brick emblems for the monastery and economic technologies (portraits for their command tiles). Visual only; each is a distinct
// silhouette so the tiles can be told apart without hovering. Parts in tiles, standing on y = 0.
type Part={x:number;y:number;z:number;w:number;d:number;h:number;color:string};
const gold='#d9bf6f',wood='#8a6a45',stone='#cfc7ae',habit='#7a5c40',team='#456e87';
export const techIcons:Record<string,Part[]>={
 // Redemption: a small house wearing a halo (buildings can change sides).
 redemption:[{x:0,y:0,z:0,w:.8,d:.7,h:.5,color:stone},{x:-.05,y:.5,z:-.05,w:.9,d:.8,h:.14,color:team},{x:.2,y:.64,z:.15,w:.5,d:.5,h:.12,color:team},{x:.3,y:.92,z:.25,w:.3,d:.3,h:.05,color:gold},{x:.3,y:0,z:.62,w:.2,d:.1,h:.3,color:wood}],
 // Atonement: a hooded figure under a halo (monks can be converted).
 atonement:[{x:.2,y:0,z:.2,w:.4,d:.34,h:.5,color:habit},{x:.25,y:.5,z:.24,w:.3,d:.26,h:.24,color:'#dfbb7e'},{x:.2,y:.72,z:.2,w:.4,d:.34,h:.12,color:habit},{x:.22,y:.95,z:.22,w:.36,d:.3,h:.05,color:gold}],
 // Sanctity: a shield with a green plus (more hit points).
 sanctity:[{x:.1,y:0,z:.3,w:.7,d:.12,h:.8,color:'#9d885b'},{x:.4,y:.15,z:.42,w:.1,d:.04,h:.5,color:'#5f9a6a'},{x:.22,y:.35,z:.42,w:.46,d:.04,h:.1,color:'#5f9a6a'}],
 // Heresy: a staff broken in two (a converted unit is lost instead).
 heresy:[{x:.1,y:0,z:.3,w:.1,d:.1,h:.55,color:wood},{x:.1,y:.55,z:.3,w:.12,d:.12,h:.1,color:gold},{x:.45,y:0,z:.3,w:.55,d:.1,h:.1,color:wood},{x:.35,y:0,z:.28,w:.12,d:.14,h:.06,color:'#6e5438'}],
 // Illumination: a lantern (faith returns faster).
 illumination:[{x:.25,y:0,z:.25,w:.4,d:.4,h:.08,color:wood},{x:.3,y:.08,z:.3,w:.3,d:.3,h:.4,color:'#f5dc7a'},{x:.25,y:.48,z:.25,w:.4,d:.4,h:.08,color:wood},{x:.4,y:.56,z:.4,w:.1,d:.1,h:.16,color:wood}],
 // Block Printing: a stack of printed pages (a longer reach).
 'block-printing':[{x:0,y:0,z:.1,w:.8,d:.6,h:.1,color:'#6e5438'},{x:.05,y:.1,z:.12,w:.7,d:.55,h:.16,color:'#efe6cc'},{x:.05,y:.26,z:.12,w:.7,d:.55,h:.06,color:'#6e5438'},{x:.15,y:.32,z:.2,w:.5,d:.4,h:.12,color:'#efe6cc'}],
 // Theocracy: a stepped tower (one monk rests for the group).
 theocracy:[{x:.1,y:0,z:.1,w:.6,d:.6,h:.35,color:stone},{x:.2,y:.35,z:.2,w:.4,d:.4,h:.3,color:stone},{x:.28,y:.65,z:.28,w:.24,d:.24,h:.25,color:team},{x:.35,y:.9,z:.35,w:.1,d:.1,h:.14,color:gold}],
 // Faith: a bell (one's own units hold firm).
 faith:[{x:.1,y:.86,z:.3,w:.6,d:.1,h:.1,color:wood},{x:.2,y:.2,z:.2,w:.4,d:.3,h:.5,color:'#b8964a'},{x:.12,y:.1,z:.15,w:.56,d:.4,h:.12,color:'#b8964a'},{x:.35,y:.7,z:.3,w:.1,d:.1,h:.16,color:wood},{x:.36,y:0,z:.3,w:.08,d:.08,h:.1,color:'#6e5438'}],
 // Economic technologies (town centre, lumber camp, mining camp, mill).
 // Loom: a frame with coloured threads (villagers +15 hit points).
 loom:[{x:.05,y:0,z:.3,w:.1,d:.1,h:.8,color:wood},{x:.75,y:0,z:.3,w:.1,d:.1,h:.8,color:wood},{x:.05,y:.72,z:.3,w:.8,d:.1,h:.08,color:wood},{x:.15,y:.15,z:.32,w:.6,d:.06,h:.5,color:'#c9b27a'},{x:.2,y:.25,z:.36,w:.5,d:.04,h:.08,color:team},{x:.2,y:.45,z:.36,w:.5,d:.04,h:.08,color:'#b25441'}],
 // Wheelbarrow: a tray on one wheel with two handles (villagers carry more).
 wheelbarrow:[{x:.2,y:.25,z:.2,w:.5,d:.45,h:.25,color:wood},{x:.05,y:.1,z:.3,w:.14,d:.25,h:.14,color:'#5c4a36'},{x:.7,y:.3,z:.25,w:.25,d:.06,h:.06,color:wood},{x:.7,y:.3,z:.55,w:.25,d:.06,h:.06,color:wood},{x:.3,y:.5,z:.25,w:.3,d:.35,h:.08,color:'#c9b27a'}],
 // Hand Cart: a bigger box on two wheels.
 'hand-cart':[{x:.1,y:.25,z:.15,w:.7,d:.6,h:.3,color:wood},{x:.2,y:0,z:.05,w:.25,d:.1,h:.25,color:'#5c4a36'},{x:.2,y:0,z:.7,w:.25,d:.1,h:.25,color:'#5c4a36'},{x:.2,y:.55,z:.25,w:.5,d:.4,h:.12,color:'#c9b27a'},{x:.8,y:.35,z:.4,w:.2,d:.1,h:.06,color:wood}],
 // Double-Bit Axe: a handle with a blade on both sides.
 'double-bit-axe':[{x:.4,y:0,z:.4,w:.08,d:.08,h:.85,color:wood},{x:.15,y:.6,z:.38,w:.25,d:.12,h:.22,color:'#aab0a3'},{x:.48,y:.6,z:.38,w:.25,d:.12,h:.22,color:'#aab0a3'}],
 // Bow Saw: a curved frame with a blade.
 'bow-saw':[{x:.05,y:.1,z:.4,w:.8,d:.08,h:.05,color:'#c6cfca'},{x:.05,y:.1,z:.4,w:.08,d:.08,h:.45,color:wood},{x:.77,y:.1,z:.4,w:.08,d:.08,h:.45,color:wood},{x:.1,y:.52,z:.4,w:.7,d:.08,h:.08,color:wood}],
 // Two-Man Saw: a long blade with a handle at each end.
 'two-man-saw':[{x:.12,y:.3,z:.4,w:.76,d:.06,h:.12,color:'#c6cfca'},{x:0,y:.2,z:.38,w:.12,d:.1,h:.35,color:wood},{x:.88,y:.2,z:.38,w:.12,d:.1,h:.35,color:wood}],
 // Gold Mining: a pick over a gold nugget; Gold Shaft Mining: a shaft frame over it.
 'gold-mining':[{x:.2,y:0,z:.25,w:.5,d:.45,h:.25,color:'#dec36f'},{x:.42,y:.25,z:.42,w:.07,d:.07,h:.6,color:wood},{x:.2,y:.8,z:.42,w:.5,d:.07,h:.07,color:'#aab0a3'}],
 'gold-shaft-mining':[{x:.2,y:0,z:.25,w:.5,d:.45,h:.25,color:'#dec36f'},{x:.1,y:0,z:.15,w:.08,d:.08,h:.85,color:wood},{x:.72,y:0,z:.15,w:.08,d:.08,h:.85,color:wood},{x:.1,y:.85,z:.15,w:.7,d:.08,h:.08,color:wood},{x:.42,y:.4,z:.18,w:.04,d:.04,h:.45,color:'#80674f'}],
 // Stone Mining and Stone Shaft Mining: the same with a stone block.
 'stone-mining':[{x:.2,y:0,z:.25,w:.5,d:.45,h:.25,color:stone},{x:.42,y:.25,z:.42,w:.07,d:.07,h:.6,color:wood},{x:.2,y:.8,z:.42,w:.5,d:.07,h:.07,color:'#aab0a3'}],
 'stone-shaft-mining':[{x:.2,y:0,z:.25,w:.5,d:.45,h:.25,color:stone},{x:.1,y:0,z:.15,w:.08,d:.08,h:.85,color:wood},{x:.72,y:0,z:.15,w:.08,d:.08,h:.85,color:wood},{x:.1,y:.85,z:.15,w:.7,d:.08,h:.08,color:wood},{x:.42,y:.4,z:.18,w:.04,d:.04,h:.45,color:'#80674f'}],
 // Horse Collar: a padded U; Heavy Plow: a plough blade on a beam; Crop Rotation: three fields of different crops.
 'horse-collar':[{x:.15,y:0,z:.4,w:.14,d:.14,h:.7,color:'#7a5c40'},{x:.61,y:0,z:.4,w:.14,d:.14,h:.7,color:'#7a5c40'},{x:.15,y:.6,z:.4,w:.6,d:.14,h:.16,color:'#7a5c40'},{x:.25,y:.1,z:.42,w:.4,d:.1,h:.08,color:gold}],
 'heavy-plow':[{x:.05,y:.35,z:.4,w:.8,d:.1,h:.1,color:wood},{x:.6,y:0,z:.35,w:.25,d:.2,h:.35,color:'#aab0a3'},{x:.05,y:.45,z:.4,w:.08,d:.1,h:.3,color:wood}],
 'crop-rotation':[{x:0,y:0,z:.05,w:.9,d:.25,h:.12,color:'#9bb65a'},{x:0,y:0,z:.33,w:.9,d:.25,h:.12,color:'#d9c26a'},{x:0,y:0,z:.61,w:.9,d:.25,h:.12,color:'#806b49'},{x:.1,y:.12,z:.1,w:.7,d:.15,h:.1,color:'#7e985f'}],
};
// Blacksmith lines: one silhouette per line, and the level (1-3) shown by the metal and by gold bands at the base.
const metal=['#9a8c78','#aab0a3','#d8dcd6'],band=(level:number):Part[]=>Array.from({length:level},(_,i)=>({x:.15+i*.25,y:0,z:.75,w:.18,d:.1,h:.08,color:gold}));
const hammer=(l:number):Part[]=>[{x:.42,y:.1,z:.4,w:.08,d:.08,h:.75,color:wood},{x:.25,y:.7,z:.34,w:.42,d:.2,h:.18,color:metal[l-1]},...band(l)];
const mail=(l:number):Part[]=>[{x:.2,y:.1,z:.35,w:.5,d:.2,h:.55,color:metal[l-1]},{x:.1,y:.5,z:.35,w:.7,d:.2,h:.15,color:metal[l-1]},{x:.35,y:.65,z:.35,w:.2,d:.2,h:.1,color:'#6e5438'},...band(l)];
const barding=(l:number):Part[]=>[{x:.1,y:.15,z:.35,w:.7,d:.3,h:.3,color:metal[l-1]},{x:.65,y:.35,z:.35,w:.2,d:.3,h:.35,color:metal[l-1]},{x:.12,y:.45,z:.38,w:.5,d:.24,h:.08,color:team},...band(l)];
const arrows=(l:number):Part[]=>[...[0,1,2].map(i=>({x:.2+i*.2,y:.1,z:.4,w:.05,d:.05,h:.65,color:wood})),...[0,1,2].map(i=>({x:.17+i*.2,y:.75,z:.37,w:.11,d:.11,h:.12,color:metal[l-1]})),...band(l)];
const vest=(l:number):Part[]=>[{x:.2,y:.1,z:.35,w:.5,d:.2,h:.5,color:['#b89a6a','#8a6a45','#aab0a3'][l-1]},{x:.25,y:.2,z:.33,w:.4,d:.04,h:.06,color:'#6e5438'},{x:.25,y:.4,z:.33,w:.4,d:.04,h:.06,color:'#6e5438'},...band(l)];
for(const [line,make] of [[['forging','iron-casting','blast-furnace'],hammer],[['scale-mail-armor','chain-mail-armor','plate-mail-armor'],mail],[['scale-barding-armor','chain-barding-armor','plate-barding-armor'],barding],[['fletching','bodkin-arrow','bracer'],arrows],[['padded-archer-armor','leather-archer-armor','ring-archer-armor'],vest]] as const)
 line.forEach((id,i)=>{techIcons[id]=make(i+1);});

// Unique technologies (researched at the castle; one per civilization and age). Each shows what it changes, not the
// civilization: the unit or building it touches plus a sign of the effect (arrows for range and fire rate, a green plus
// for hit points, streaks for speed, coins for a refund).
const metal2='#aab0a3',dark='#4a4740',green='#5f9a6a',grey='#8d8c86',felt='#ece6d6',sand='#d8c9a6',red='#b25441';
const plus=(x:number,y:number):Part[]=>[{x:x+.09,y,z:.42,w:.08,d:.04,h:.26,color:green},{x,y:y+.09,z:.42,w:.26,d:.04,h:.08,color:green}];
const streaks=(x:number,y:number):Part[]=>[0,1,2].map(i=>({x:x-i*.04,y:y+i*.14,z:.45,w:.18+i*.06,d:.04,h:.05,color:'#efe6cc'}));
const shaft=(x:number,y:number,len:number):Part[]=>[{x,y,z:.45,w:len,d:.04,h:.04,color:wood},{x:x+len,y:y-.02,z:.44,w:.08,d:.06,h:.08,color:metal2}];
const merlons=(x:number,y:number,n:number,w=.14):Part[]=>Array.from({length:n},(_,i)=>({x:x+i*w*2,y,z:.3,w,d:.36,h:.12,color:stone}));
Object.assign(techIcons,{
 // Yeomen: a tall longbow beside a tower top (archer range and tower attack).
 yeomen:[{x:0,y:0,z:.3,w:.45,d:.4,h:.6,color:stone},...merlons(0,.6,2,.12),...[[0,0],[.06,.18],[.09,.36],[.06,.54],[0,.72]].map(([dx,y])=>({x:.7+dx,y,z:.4,w:.06,d:.06,h:.2,color:wood})),{x:.66,y:0,z:.42,w:.02,d:.02,h:.92,color:'#d9cba4'}],
 // Stronghold: a castle tower loosing arrows in quick succession.
 stronghold:[{x:0,y:0,z:.25,w:.5,d:.5,h:.75,color:stone},...merlons(0,.75,2),{x:.18,y:.35,z:.74,w:.12,d:.02,h:.2,color:dark},...shaft(.55,.62,.3),...shaft(.55,.42,.3),...shaft(.55,.22,.3)],
 // Furor Celtica: a ram on its wheels under a green plus (siege hit points).
 'furor-celtica':[{x:0,y:.12,z:.3,w:.9,d:.3,h:.18,color:wood},{x:.1,y:0,z:.25,w:.18,d:.4,h:.18,color:'#5c4a36'},{x:.62,y:0,z:.25,w:.18,d:.4,h:.18,color:'#5c4a36'},{x:.85,y:.12,z:.32,w:.12,d:.26,h:.18,color:metal2},...plus(.32,.45)],
 // Chivalry: a horseshoe with gold nails and speed streaks (faster stable).
 chivalry:[{x:.1,y:0,z:.1,w:.16,d:.7,h:.14,color:metal2},{x:.64,y:0,z:.1,w:.16,d:.7,h:.14,color:metal2},{x:.1,y:0,z:.1,w:.7,d:.16,h:.14,color:metal2},...[.14,.68].flatMap(x=>[.35,.6].map(z=>({x:x+.04,y:.14,z,w:.06,d:.06,h:.04,color:gold}))),...streaks(.2,.3).map(p=>({...p,y:0,z:.85+(p.y-.3)/.7,h:.04}))],
 // Bearded Axe: the francisca in flight, its path drawn out behind it (longer throw).
 'bearded-axe':[{x:.52,y:0,z:.42,w:.08,d:.08,h:.8,color:wood},{x:.6,y:.56,z:.41,w:.3,d:.1,h:.2,color:metal2},{x:.74,y:.38,z:.41,w:.16,d:.1,h:.2,color:metal2},{x:.44,y:.64,z:.41,w:.08,d:.1,h:.1,color:metal2},...[0,1,2].map(i=>({x:.02+i*.14,y:.3+i*.12,z:.44,w:.1,d:.04,h:.05,color:'#efe6cc'}))],
 // Anarchy: a barracks arch with a Huskarl's round shield in the doorway.
 anarchy:[{x:0,y:0,z:.2,w:.18,d:.4,h:.7,color:stone},{x:.72,y:0,z:.2,w:.18,d:.4,h:.7,color:stone},{x:0,y:.7,z:.2,w:.9,d:.4,h:.16,color:red},{x:.27,y:.08,z:.52,w:.36,d:.05,h:.5,color:team},{x:.2,y:.15,z:.52,w:.5,d:.05,h:.36,color:team},{x:.4,y:.28,z:.57,w:.1,d:.03,h:.1,color:gold}],
 // Perfusion: two helmets side by side (twice the training speed).
 perfusion:[0,.46].flatMap(x=>[{x:x+.06,y:0,z:.35,w:.26,d:.2,h:.2,color:'#44514b'},{x:x+.02,y:.2,z:.33,w:.34,d:.24,h:.3,color:team},{x:x+.07,y:.5,z:.35,w:.24,d:.2,h:.2,color:'#dfbb7e'},{x:x+.04,y:.7,z:.33,w:.3,d:.24,h:.08,color:metal2},{x:x+.36,y:.1,z:.42,w:.04,d:.04,h:.66,color:wood}]),
 // Ironclad: a ram under riveted iron plates (siege melee armour).
 ironclad:[{x:0,y:0,z:.3,w:.9,d:.3,h:.2,color:wood},{x:.05,y:.2,z:.25,w:.8,d:.4,h:.14,color:metal2},{x:.15,y:.34,z:.3,w:.6,d:.3,h:.14,color:'#8f9896'},...[.15,.4,.65].map(x=>({x,y:.24,z:.65,w:.06,d:.02,h:.06,color:gold}))],
 // Crenellations: a crenellated wall with a helmeted defender between the merlons.
 crenellations:[{x:0,y:0,z:.3,w:.9,d:.36,h:.45,color:stone},{x:0,y:.45,z:.3,w:.16,d:.36,h:.2,color:stone},{x:.74,y:.45,z:.3,w:.16,d:.36,h:.2,color:stone},{x:.34,y:.45,z:.38,w:.22,d:.2,h:.16,color:'#dfbb7e'},{x:.32,y:.61,z:.36,w:.26,d:.24,h:.1,color:metal2},...shaft(.55,.72,.3)],
 // Chieftains: a helmet crowned with a gold circlet over a spear (infantry against horsemen).
 chieftains:[{x:.1,y:.05,z:.44,w:.8,d:.04,h:.04,color:wood},{x:.86,y:.03,z:.43,w:.12,d:.06,h:.08,color:metal2},{x:.25,y:.2,z:.3,w:.4,d:.38,h:.3,color:metal2},{x:.23,y:.42,z:.28,w:.44,d:.42,h:.06,color:gold},...[.25,.43,.61].map(x=>({x,y:.48,z:.45,w:.04,d:.04,h:.12,color:gold}))],
 // Berserkergang: a wolf-pelt hood with a green plus (faster regeneration).
 berserkergang:[{x:.1,y:0,z:.3,w:.5,d:.4,h:.45,color:'#8a8272'},{x:.2,y:.2,z:.7,w:.3,d:.1,h:.15,color:'#8a8272'},{x:.12,y:.45,z:.35,w:.1,d:.1,h:.14,color:'#8a8272'},{x:.48,y:.45,z:.35,w:.1,d:.1,h:.14,color:'#8a8272'},{x:.22,y:.3,z:.7,w:.06,d:.02,h:.04,color:dark},{x:.42,y:.3,z:.7,w:.06,d:.02,h:.04,color:dark},...plus(.64,.5)],
 // Logistica: a hoof over scattered bricks (trample damage around the target).
 logistica:[{x:.3,y:.18,z:.3,w:.3,d:.3,h:.5,color:'#6f5a44'},{x:.26,y:.1,z:.26,w:.38,d:.38,h:.1,color:metal2},...[[0,0],[.75,.05],[.05,.6],[.72,.62]].map(([x,z])=>({x,y:0,z,w:.16,d:.14,h:.1,color:stone}))],
 // Kamandaran: a bow over a stack of logs (archers paid in wood).
 kamandaran:[...[0,1,2].map(i=>({x:.05,y:i*.14,z:.3+(i%2)*.04,w:.8,d:.14,h:.14,color:i===1?'#6e5438':wood})),...[[0,0],[.05,.14],[.07,.28],[.05,.42],[0,.56]].map(([dx,y])=>({x:.4+dx,y:.42+y*.6,z:.5,w:.06,d:.06,h:.14,color:'#997447'})),{x:.38,y:.42,z:.52,w:.02,d:.02,h:.46,color:'#d9cba4'}],
 // Mahouts: an elephant's head with tusks and speed streaks.
 mahouts:[{x:.25,y:.3,z:.25,w:.5,d:.45,h:.5,color:grey},{x:.05,y:.35,z:.35,w:.2,d:.08,h:.45,color:'#9a988f'},{x:.75,y:.35,z:.35,w:.2,d:.08,h:.45,color:'#9a988f'},{x:.28,y:.8,z:.3,w:.44,d:.36,h:.08,color:gold},{x:.42,y:.12,z:.7,w:.16,d:.14,h:.4,color:grey},{x:.43,y:0,z:.78,w:.14,d:.18,h:.12,color:grey},{x:.28,y:.3,z:.7,w:.07,d:.24,h:.07,color:'#efe8d2'},{x:.65,y:.3,z:.7,w:.07,d:.24,h:.07,color:'#efe8d2'},...streaks(.08,.4).map(p=>({...p,z:.05}))],
 // Madrasah: a domed hall over a gold coin (gold back when a monk falls).
 madrasah:[{x:.05,y:0,z:.25,w:.6,d:.5,h:.35,color:sand},{x:.1,y:.35,z:.3,w:.5,d:.4,h:.12,color:felt},{x:.18,y:.47,z:.36,w:.34,d:.28,h:.1,color:felt},{x:.28,y:.57,z:.42,w:.14,d:.14,h:.08,color:felt},{x:.33,y:.65,z:.47,w:.04,d:.04,h:.12,color:gold},{x:.68,y:0,z:.4,w:.26,d:.26,h:.08,color:gold},{x:.72,y:.08,z:.44,w:.18,d:.18,h:.06,color:'#dec36f'}],
 // Zealotry: a camel with a green plus (camel and Mameluke hit points).
 zealotry:[{x:.1,y:.3,z:.35,w:.6,d:.3,h:.25,color:sand},{x:.3,y:.55,z:.38,w:.2,d:.24,h:.14,color:sand},{x:.66,y:.4,z:.4,w:.1,d:.2,h:.4,color:sand},{x:.66,y:.8,z:.38,w:.22,d:.24,h:.1,color:sand},...[.14,.56].map(x=>({x,y:0,z:.4,w:.08,d:.12,h:.3,color:'#b8a074'})),{x:.14,y:.52,z:.33,w:.52,d:.34,h:.04,color:team},...plus(0,.62)],
 // Great Wall: a long crenellated wall climbing to a watch tower (tougher walls and towers).
 'great-wall':[{x:0,y:0,z:.35,w:.62,d:.28,h:.3,color:stone},...merlons(0,.3,3,.11),{x:.62,y:0,z:.28,w:.34,d:.42,h:.7,color:stone},{x:.58,y:.7,z:.24,w:.42,d:.5,h:.1,color:'#3f4a4c'},{x:.7,y:.8,z:.36,w:.18,d:.26,h:.1,color:'#3f4a4c'}],
 // Rocketry: a bolt carrying a red powder tube with flame at its tail.
 rocketry:[{x:.05,y:.4,z:.45,w:.8,d:.05,h:.05,color:wood},{x:.85,y:.38,z:.43,w:.1,d:.09,h:.09,color:metal2},{x:.3,y:.36,z:.41,w:.3,d:.13,h:.13,color:red},{x:.1,y:.37,z:.42,w:.2,d:.11,h:.11,color:'#e0a040'},{x:0,y:.39,z:.44,w:.1,d:.07,h:.07,color:'#f5dc7a'}],
 // Yasama: a watch tower with three arrows fanning out (extra arrows).
 yasama:[{x:0,y:0,z:.3,w:.4,d:.4,h:.7,color:stone},{x:-.04,y:.7,z:.26,w:.48,d:.48,h:.1,color:'#3f4a4c'},...shaft(.45,.75,.35),...shaft(.45,.5,.35),...shaft(.45,.25,.35)],
 // Nomads: a round felt yurt with a team band (houses keep their population room).
 nomads:[{x:.1,y:0,z:.2,w:.7,d:.6,h:.35,color:felt},{x:.05,y:.25,z:.15,w:.8,d:.7,h:.06,color:team},{x:.18,y:.35,z:.28,w:.54,d:.44,h:.12,color:felt},{x:.32,y:.47,z:.4,w:.26,d:.2,h:.08,color:felt},{x:.38,y:0,z:.8,w:.14,d:.02,h:.22,color:'#6e5438'}],
 // Drill: a siege wheel with speed streaks (faster siege).
 drill:[{x:.2,y:0,z:.4,w:.5,d:.12,h:.5,color:'#6e5438'},{x:.35,y:.15,z:.52,w:.2,d:.04,h:.2,color:gold},{x:.12,y:.5,z:.35,w:.66,d:.2,h:.1,color:wood},...streaks(.84,.05)],
} as Record<string,Part[]>);
