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
