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
 // Warwolf: a trebuchet (frame, counterweight, arm with its stone) and the stone landing among scattered enemy helmets
 // (the shot hits everyone around the impact).
 warwolf:[{x:.08,y:0,z:.3,w:.08,d:.3,h:.55,color:wood},{x:.3,y:0,z:.3,w:.08,d:.3,h:.55,color:wood},{x:.04,y:.55,z:.3,w:.38,d:.3,h:.07,color:wood},
  ...[[0,.4],[.09,.5],[.18,.6],[.27,.7],[.36,.8]].map(([x,y])=>({x,y,z:.42,w:.1,d:.08,h:.1,color:'#8a6a45'})),{x:-.06,y:.22,z:.36,w:.16,d:.2,h:.18,color:dark},{x:.42,y:.9,z:.4,w:.1,d:.1,h:.1,color:stone},
  {x:.66,y:0,z:.35,w:.22,d:.22,h:.2,color:'#a19f86'},...[[.54,.2],[.96,.25],[.64,.68],[.9,.66]].map(([x,z])=>({x:x-.05,y:0,z,w:.12,d:.12,h:.1,color:metal2})),{x:.6,y:0,z:.6,w:.34,d:.04,h:.04,color:red}],
 // Kataparuto: a packed trebuchet on its wagon with speed streaks (it packs, unpacks and fires faster).
 kataparuto:[{x:.05,y:.14,z:.3,w:.8,d:.36,h:.1,color:wood},...[.12,.64].map(x=>({x,y:0,z:.25,w:.16,d:.46,h:.16,color:'#5c4a36'})),{x:.1,y:.24,z:.42,w:.75,d:.1,h:.1,color:'#8a6a45'},{x:.55,y:.24,z:.32,w:.24,d:.3,h:.22,color:team},{x:.6,y:.46,z:.37,w:.14,d:.2,h:.06,color:metal2},...streaks(.14,.5)],
 // Sipahi: a horse archer (dark horse, team-clad rider, bow raised) with a green plus (cavalry archers gain hit points).
 sipahi:[{x:.1,y:.3,z:.3,w:.5,d:.26,h:.24,color:'#4a413a'},{x:.56,y:.42,z:.33,w:.12,d:.2,h:.28,color:'#4a413a'},{x:.58,y:.66,z:.32,w:.26,d:.22,h:.12,color:'#574a3f'},{x:.02,y:.36,z:.4,w:.08,d:.06,h:.2,color:'#1f1b18'},
  ...[.12,.48].flatMap(x=>[.3,.48].map(z=>({x,y:0,z,w:.08,d:.08,h:.3,color:'#3d3631'}))),{x:.22,y:.54,z:.31,w:.22,d:.3,h:.05,color:'#6b5238'},
  {x:.25,y:.59,z:.34,w:.16,d:.2,h:.24,color:team},{x:.26,y:.83,z:.36,w:.14,d:.16,h:.14,color:'#dfbb7e'},{x:.25,y:.97,z:.35,w:.16,d:.18,h:.06,color:'#6b5238'},
  ...[[0,0],[.04,.12],[.06,.24],[.04,.36],[0,.48]].map(([dx,y])=>({x:.44+dx,y:.52+y*.8,z:.5,w:.05,d:.05,h:.1,color:'#997447'})),{x:.43,y:.52,z:.52,w:.02,d:.02,h:.48,color:'#d9cba4'},...plus(.78,.04)],
} as Record<string,Part[]>);
// The 科技 round's generic technologies (University, barracks, archery range, stable, town centre, monastery and castle)
// and the Turks' Artillery: again the thing changed plus a sign of the effect (a green plus for hit points, streaks for
// speed, an arrow for range or attack).
const skin='#dfbb7e',flame='#e0a040',spark='#f5dc7a',glass='#bcd3cf',leaf='#6f8a55',hay='#d9c26a',iron='#5b5e5c';
const bar=(x:number,y:number,w:number,h:number,color:string,z=.4,d=.1):Part=>({x,y,z,w,d,h,color});
// An arrow pointing toward -x (shot backwards).
const backShaft=(x:number,y:number,len:number):Part[]=>[{x:x+.08,y,z:.45,w:len,d:.04,h:.04,color:wood},{x,y:y-.02,z:.44,w:.08,d:.06,h:.08,color:metal2}];
const eye=(y:number):Part[]=>[bar(.2,y,.5,.08,'#efe9da'),bar(.08,y+.08,.74,.16,'#efe9da'),bar(.2,y+.24,.5,.08,'#efe9da'),bar(.34,y+.06,.22,.22,team,.45,.06),bar(.41,y+.13,.08,.08,'#1f1d1b',.5,.02)];
Object.assign(techIcons,{
 // Masonry: three courses of bonded bricks with a trowel on top (building hit points and armour).
 masonry:[bar(.05,0,.42,.2,stone),bar(.48,0,.42,.2,stone),bar(.05,.2,.2,.2,stone),bar(.26,.2,.42,.2,stone),bar(.69,.2,.21,.2,stone),bar(.05,.4,.42,.2,stone),bar(.48,.4,.42,.2,stone),
  bar(.3,.6,.34,.04,metal2,.35,.3),bar(.64,.6,.06,.1,wood),bar(.7,.68,.2,.05,wood)],
 // Architecture: two columns under a lintel with a gilt keystone (buildings stronger again).
 architecture:[bar(.02,0,.86,.08,stone),...[.1,.62].flatMap(x=>[bar(x,.08,.18,.06,stone),bar(x+.03,.14,.12,.5,'#e6dcc3'),bar(x-.02,.64,.22,.08,stone)]),bar(0,.72,.9,.12,stone),bar(.37,.72,.16,.2,gold,.38,.14)],
 // Chemistry: a flask of green liquid over a small flame (gunpowder; missiles +1).
 chemistry:[bar(.34,0,.22,.1,flame),bar(.4,.1,.1,.08,spark),bar(.15,.18,.6,.12,glass),bar(.1,.3,.7,.22,glass),bar(.13,.32,.64,.14,green,.45,.06),bar(.2,.52,.5,.1,glass),bar(.38,.62,.14,.22,glass),bar(.36,.84,.18,.08,wood)],
 // Siege Engineers: a pair of dividers standing open with a long range arrow (siege range and building damage).
 'siege-engineers':[bar(.08,0,.08,.1,metal2),bar(.12,.1,.08,.2,metal2),bar(.16,.3,.08,.2,metal2),bar(.48,0,.08,.1,metal2),bar(.44,.1,.08,.2,metal2),bar(.4,.3,.08,.2,metal2),bar(.2,.5,.24,.1,metal2),bar(.27,.6,.1,.1,gold),...shaft(.05,.82,.8)],
 // Guard Tower: a stone tower with a merloned lookout and a green plus (stronger towers).
 'guard-tower':[bar(.08,0,.36,.7,stone,.3,.36),bar(.02,.7,.48,.1,stone,.24,.48),...merlons(.02,.8,2,.12),bar(.22,.2,.08,.02,dark,.66,.02),...plus(.62,.3)],
 // Keep: a taller, wider tower on corbels under a team spire (towers stronger again).
 keep:[bar(.22,0,.46,.66,stone,.28,.4),...[.18,.62].map(x=>bar(x,.66,.1,.08,'#9d9a88',.26,.44)),bar(.14,.74,.62,.12,stone,.22,.52),bar(.2,.86,.5,.1,team,.26,.44),bar(.3,.96,.3,.1,team,.33,.3),bar(.4,1.06,.1,.12,gold,.38,.1),bar(.4,.3,.08,.2,dark,.68,.02)],
 // Treadmill Crane: an octagonal treadwheel under a jib lifting a stone (villagers build faster).
 'treadmill-crane':[bar(.18,0,.3,.08,wood),bar(.08,.06,.12,.14,wood),bar(.46,.06,.12,.14,wood),bar(.02,.18,.1,.3,wood),bar(.56,.18,.1,.3,wood),bar(.08,.46,.12,.14,wood),bar(.46,.46,.12,.14,wood),bar(.18,.56,.3,.08,wood),bar(.3,.08,.06,.48,dark,.42,.06),
  bar(.7,0,.08,.9,'#6e5438'),bar(.4,.9,.62,.07,'#6e5438'),bar(.94,.6,.02,.3,'#d8c48a'),bar(.86,.42,.18,.18,'#b5b29e')],
 // Arrowslits: a stretch of wall pierced by two cross-shaped slits, an arrow leaving one (tower attack).
 arrowslits:[bar(0,0,.6,.8,stone,.3,.3),...[.14,.38].flatMap(x=>[bar(x,.18,.06,.44,dark,.6,.02),bar(x-.06,.36,.18,.06,dark,.6,.02)]),...shaft(.5,.39,.42)],
 // Supplies: a grain sack beside a militia helmet (cheaper militia line).
 supplies:[bar(.05,0,.46,.5,hay,.3,.36),bar(.12,.5,.32,.1,hay,.34,.28),bar(.18,.6,.2,.06,'#7a5c40',.38,.2),bar(.14,.66,.28,.12,hay,.36,.24),bar(.58,0,.36,.16,metal2,.32,.32),bar(.62,.16,.28,.14,metal2,.34,.28),bar(.72,.3,.08,.06,metal2,.42,.1)],
 // Squires: a marching boot with speed streaks (infantry move faster).
 squires:[bar(.32,0,.5,.12,'#5a4632',.32,.3),bar(.32,.12,.2,.5,'#5a4632',.32,.3),bar(.3,.62,.24,.08,'#8b6746',.3,.34),bar(.52,.12,.16,.1,'#5a4632',.32,.3),...streaks(.12,.2)],
 // Arson: a lit torch leaning on a burning house corner (infantry against buildings).
 arson:[bar(.4,0,.5,.45,stone,.3,.4),bar(.36,.45,.58,.12,'#b8a074',.26,.48),bar(.5,.57,.3,.12,'#b8a074',.34,.32),bar(.6,.6,.16,.2,flame,.36,.16),bar(.64,.8,.08,.12,spark,.4,.08),
  bar(.12,0,.08,.6,wood,.5,.08),bar(.08,.6,.16,.14,flame,.48,.12),bar(.11,.74,.1,.12,spark,.5,.08)],
 // Thumb Ring: a gilt ring on a drawing thumb with speed streaks (archers shoot faster).
 'thumb-ring':[bar(.42,0,.26,.24,skin,.3,.3),bar(.46,.24,.18,.5,skin,.36,.18),bar(.42,.42,.26,.04,gold,.32,.26),bar(.42,.52,.26,.04,gold,.32,.26),bar(.42,.42,.04,.14,gold,.32,.26),bar(.64,.42,.04,.14,gold,.32,.26),...streaks(.16,.3)],
 // Parthian Tactics: a horse archer riding right and loosing an arrow back over the tail (cavalry archer armour and bonus).
 'parthian-tactics':[bar(.4,.3,.48,.24,'#957350',.3,.26),bar(.84,.42,.12,.3,'#957350',.33,.2),bar(.86,.72,.22,.1,'#957350',.32,.2),...[.44,.78].map(x=>bar(x,0,.08,.3,'#7d5f42',.4,.08)),
  bar(.54,.54,.2,.22,team,.34,.2),bar(.56,.76,.16,.14,skin,.36,.16),bar(.48,.6,.06,.26,'#997447',.5,.05),...backShaft(.0,.72,.44)],
 // Bloodlines: a horse's head and neck with a green plus (mounted units gain hit points).
 bloodlines:[bar(.18,0,.26,.5,'#957350',.3,.24),bar(.18,.5,.46,.2,'#957350',.3,.24),bar(.5,.42,.2,.14,'#957350',.32,.2),bar(.2,.7,.08,.12,'#7d5f42',.36,.08),bar(.12,.2,.08,.5,'#4a3b2a',.3,.24),bar(.5,.6,.04,.04,'#1f1d1b',.55,.02),...plus(.66,.6)],
 // Husbandry: a tied hay bale and a pitchfork (mounted units move faster).
 husbandry:[bar(.05,0,.5,.36,hay,.3,.36),...[.15,.39].map(x=>bar(x,0,.06,.37,'#7a5c40',.29,.38)),bar(.06,.36,.48,.04,hay,.32,.32),bar(.7,0,.06,.8,wood,.45,.06),bar(.62,.8,.22,.05,metal2,.45,.06),...[.62,.7,.79].map(x=>bar(x,.85,.04,.14,metal2,.45,.06))],
 // Town Watch: an open eye (buildings see farther); Town Patrol: the eye over a patrol's footprints (farther again).
 'town-watch':[...eye(.25),bar(.38,0,.14,.25,stone,.4,.14)],
 'town-patrol':[...eye(.35),...[[.12,0],[.3,.12],[.5,0],[.68,.12]].map(([x,z])=>bar(x,0,.16,.06,'#5a4632',.25+z,.26))],
 // Fervor: a hooded monk striding with speed streaks (monks move faster).
 fervor:[bar(.4,0,.36,.5,habit,.3,.3),bar(.44,.5,.28,.22,skin,.33,.24),bar(.4,.68,.36,.14,habit,.3,.3),bar(.36,.4,.08,.1,'#d8c48a',.38,.14),...streaks(.18,.15)],
 // Herbal Medicine: a stone mortar with a pestle and green leaves (garrisoned units heal faster).
 'herbal-medicine':[bar(.15,0,.4,.1,stone,.3,.36),bar(.08,.1,.54,.24,stone,.26,.44),bar(.14,.34,.42,.04,leaf,.3,.32),bar(.3,.36,.08,.44,wood,.42,.08),bar(.66,0,.14,.3,leaf,.4,.1),bar(.78,.24,.16,.1,leaf,.4,.1),bar(.6,.28,.12,.14,leaf,.4,.1)],
 // Hoardings: a curtain wall with a timber gallery cantilevered over its top and a green plus (stronger castles).
 hoardings:[bar(.08,0,.5,.62,stone,.3,.36),bar(0,.62,.66,.2,wood,.24,.48),bar(.02,.82,.62,.08,team,.26,.44),...[.1,.3,.5].map(x=>bar(x,.68,.06,.1,dark,.72,.02)),...plus(.7,.25)],
 // Sappers: a pick biting into a cracked wall (villagers against buildings).
 sappers:[bar(.4,0,.5,.7,stone,.3,.3),bar(.6,.2,.04,.3,dark,.6,.02),bar(.64,.38,.12,.04,dark,.6,.02),bar(.5,.48,.12,.04,dark,.6,.02),bar(.18,.2,.08,.6,wood,.45,.08),bar(.04,.76,.4,.06,metal2,.44,.1),bar(.44,.7,.06,.08,metal2,.44,.1)],
 // Conscription: an hourglass between wooden plates, the sand mostly run (units train faster).
 conscription:[bar(.15,0,.6,.08,wood,.3,.36),bar(.15,.86,.6,.08,wood,.3,.36),...[.18,.66].map(x=>bar(x,.08,.06,.78,wood,.4,.06)),bar(.28,.08,.34,.14,glass,.36,.24),bar(.3,.08,.3,.12,gold,.38,.2),bar(.36,.22,.18,.14,glass,.4,.16),bar(.41,.36,.08,.14,glass,.42,.08),bar(.43,.36,.04,.14,gold,.44,.04),bar(.36,.5,.18,.14,glass,.4,.16),bar(.28,.64,.34,.22,glass,.36,.24),bar(.38,.72,.14,.08,gold,.42,.08)],
 // Artillery: a hooped bombard on its wheel with a long arrow (bombard cannon range).
 artillery:[bar(.12,0,.12,.5,'#5c4a36',.24,.5),bar(.04,.22,.64,.1,dark,.36,.2),bar(.2,.32,.5,.28,iron,.35,.28),...[.3,.46,.62].map(x=>bar(x,.3,.04,.32,'#3f4240',.33,.32)),bar(.68,.36,.04,.2,'#1f1d1b',.4,.2),...shaft(.3,.8,.66)],
} as Record<string,Part[]>);
// The 建築 round: the dock's, the market's and the university's remaining technologies, and Greek Fire. (The ship line
// upgrades, War Galley to Elite Longboat, use their unit's portrait like the other line upgrades.)
const hull=(y:number,color:string,w=.84):Part[]=>[bar(.08,y,w,.18,color,.3,.4),bar(.02,y+.08,.08,.12,color,.32,.36),bar(.08+w,y+.08,.08,.14,color,.32,.36),bar(.16,y-.08,w-.16,.08,'#5c4a36',.36,.28)];
const water=(y:number):Part[]=>[bar(0,y,1,.04,'#6fa2ae',.3,.44),bar(.12,y+.04,.3,.03,'#9cc8d0',.4,.1),bar(.6,y+.04,.26,.03,'#9cc8d0',.4,.1)];
Object.assign(techIcons,{
 // Gillnets: a net hung between two floats with a fish caught in it (fishing ships work faster).
 gillnets:[...[.14,.36,.58,.8].map(x=>bar(x,.12,.03,.62,'#7c8a78',.42,.03)),...[.2,.42,.64].map(y=>bar(.12,y,.74,.03,'#7c8a78',.42,.03)),bar(.06,.72,.16,.12,team,.4,.12),bar(.72,.72,.16,.12,'#ece2c4',.4,.12),bar(.34,.3,.28,.1,'#d5e7de',.46,.06),bar(.62,.28,.08,.14,'#a9c2c0',.46,.06),...water(0)],
 // Careening: a hull hauled onto its side, an iron plate on its flank (ships take less from arrows).
 careening:[...hull(.2,wood),bar(.3,.24,.34,.26,iron,.72,.04),bar(.36,.3,.22,.04,metal2,.76,.02),bar(.42,.26,.1,.2,metal2,.76,.02),...water(0)],
 // Dry Dock: a hull in a stone basin with speed streaks (ships faster, transports carry more).
 'dry-dock':[bar(0,0,.12,.5,stone,.3,.4),bar(.88,0,.12,.5,stone,.3,.4),bar(.12,0,.76,.08,stone,.3,.4),...hull(.22,team,.6).map(p=>({...p,x:p.x+.1})),...streaks(.3,.6)],
 // Shipwright: the ribs of a hull on the slip and a mallet (ships cheaper and quicker to build).
 shipwright:[bar(.06,0,.8,.08,'#5c4a36',.3,.4),...[.12,.32,.52,.72].map(x=>bar(x,.08,.08,.42-Math.abs(x-.42)*.4,wood,.32,.36)),bar(.08,.3,.76,.05,wood,.3,.06),bar(.66,.56,.06,.34,wood,.45,.06),bar(.58,.82,.24,.14,'#7c5a3a',.42,.14)],
 // Caravan: a loaded cart wheel and bale with speed streaks (trade carts and cogs faster).
 caravan:[bar(.3,.2,.5,.12,wood,.3,.4),bar(.36,.32,.38,.3,'#d8c9a6',.32,.34),bar(.34,.62,.42,.06,team,.3,.38),bar(.44,0,.1,.32,'#5c4a36',.72,.08),bar(.46,.12,.06,.08,iron,.8,.02),...streaks(.18,.25)],
 // Guilds: a balance with a gold coin on one pan and a bale on the other, level (a lower market fee).
 guilds:[bar(.42,0,.16,.08,wood,.4,.2),bar(.47,.08,.06,.64,wood,.45,.06),bar(.08,.72,.84,.05,metal2,.45,.06),...[.1,.84].map(x=>bar(x,.4,.03,.32,metal2,.46,.03)),bar(.02,.36,.2,.04,metal2,.4,.16),bar(.76,.36,.2,.04,metal2,.4,.16),bar(.06,.4,.12,.06,gold,.42,.12),bar(.8,.4,.12,.1,'#d8c9a6',.42,.12)],
 // Heated Shot: a red-hot ball in tongs over a brazier (towers hit ships harder).
 'heated-shot':[bar(.26,0,.48,.1,dark,.3,.4),bar(.3,.1,.4,.18,iron,.32,.36),bar(.32,.28,.36,.1,flame,.34,.32),bar(.4,.38,.2,.2,'#d0603a',.4,.2),bar(.44,.42,.12,.12,spark,.44,.14),bar(.12,.48,.32,.04,metal2,.48,.04),bar(.56,.48,.32,.04,metal2,.48,.04)],
 // Fortified Wall: a thick stone wall with merlons and a green plus (stronger walls and gates).
 'fortified-wall':[bar(.02,0,.66,.5,stone,.3,.36),bar(.02,.46,.66,.06,'#9d9a88',.28,.4),...merlons(.02,.52,3,.12),...plus(.68,.24)],
 // Bombard Tower: a squat banded tower with a cannon run out of it (the tower itself).
 'bombard-tower-tech':[bar(.18,0,.6,.66,stone,.3,.36),bar(.14,.3,.68,.06,iron,.28,.4),bar(.14,.66,.68,.08,'#9d9a88',.28,.4),...merlons(.14,.74,3,.12),bar(.4,.4,.16,.12,iron,.66,.3),bar(.38,.38,.2,.16,'#3f4240',.94,.03)],
 // Greek Fire: a bronze siphon nozzle shooting a long jet of flame (fire ships reach farther).
 'greek-fire':[bar(0,.2,.22,.24,'#b8964a',.36,.28),bar(.22,.26,.16,.12,'#b8964a',.4,.12),bar(.38,.24,.2,.16,flame,.4,.16),bar(.58,.26,.22,.12,flame,.4,.14),bar(.8,.28,.2,.08,spark,.42,.1),bar(.06,0,.1,.2,wood,.4,.1),...shaft(.3,.62,.5)],
} as Record<string,Part[]>);
