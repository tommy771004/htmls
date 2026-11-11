/**
 * ============================================================================
 * RO Life Source Module: 05-jobs-monsters-stages.js
 * Description: Jobs (`wp`/`gu`), Monsters (`wU`), Stages (`cW`), Equipment (`gs`), Cards (`qA`), Drops (`HA`), Layered Character Renderer (`ld`/`LW`), xoshiro128** PRNG (`DW`/`Wt`), and IEEE-754 Soft-Float Math (`Sa`/`ln`/`Nn`/`Oq`/`Kq`/`il`)
 * ============================================================================
 */

const wp=[ {
  id:"swordsman",name:"Swordsman",desc:"Mucha vida y armadura. Golpes potentes cuerpo a cuerpo.",hp:130,speed:150,armor:1,start:"bash",castAction:"attack2",tier:"first",scaling:"melee"
}, {
  id:"mage",name:"Mage",desc:"Frágil pero letal a distancia.",hp:80,speed:145,armor:0,start:"firebolt",castAction:"cast",tier:"first",scaling:"magic"
}, {
  id:"archer",name:"Archer",desc:"Rápido, dispara flechas que perforan.",hp:95,speed:165,armor:0,start:"double_strafe",castAction:"attack",tier:"first",scaling:"ranged"
}, {
  id:"acolyte",name:"Acolyte",desc:"Se cura y castiga a los no-muertos.",hp:105,speed:150,armor:1,start:"heal",castAction:"cast",tier:"first",scaling:"magic"
}, {
  id:"thief",name:"Thief",desc:"Muy rápido. Puñaladas que envenenan.",hp:90,speed:175,armor:0,start:"envenom",castAction:"attack",tier:"first",scaling:"melee"
}, {
  id:"merchant",name:"Merchant",desc:"Golpes de zeny devastadores, pero lentos.",hp:130,speed:145,armor:1,start:"mammonite",castAction:"attack",tier:"first",scaling:"melee"
}, {
  id:"taekwon",name:"Taekwon",desc:"Patadas giratorias que barren a la horda.",hp:110,speed:160,armor:0,start:"tornado_kick",castAction:"attack",tier:"extended",scaling:"melee"
}, {
  id:"ninja",name:"Ninja",desc:"Lluvia de shurikens.",hp:90,speed:165,armor:0,start:"shuriken",castAction:"attack",tier:"extended",scaling:"ranged"
}, {
  id:"gunslinger",name:"Gunslinger",desc:"Ráfagas de balas en abanico.",hp:95,speed:155,armor:0,start:"triple_action",castAction:"attack",tier:"extended",scaling:"ranged"
}
],gu=[ {
  id:"knight",base:"swordsman",name:"Knight",desc:"Caballero montado en Peco Peco: lanzas y espadones con mucho alcance.",hp:360,speed:150,armor:1,start:"bash",castAction:"attack2",tier:"first",scaling:"melee",rank:2,mount:"peco"
}, {
  id:"crusader",base:"swordsman",name:"Crusader",desc:"Guerrero sagrado sobre su Peco: escudo, fe y golpes de luz.",hp:380,speed:150,armor:1,start:"bash",castAction:"attack2",tier:"first",scaling:"melee",rank:2,mount:"peco"
}, {
  id:"wizard",base:"mage",name:"Wizard",desc:"Magia de destrucción masiva: meteoros, ventiscas y tormentas.",hp:205,speed:145,armor:0,start:"firebolt",castAction:"cast",tier:"first",scaling:"magic",rank:2
}, {
  id:"sage",base:"mage",name:"Sage",desc:"Erudito de los elementos: campos mágicos, tierra y conjuros automáticos.",hp:240,speed:145,armor:0,start:"firebolt",castAction:"cast",tier:"first",scaling:"magic",rank:2
}, {
  id:"hunter",base:"archer",name:"Hunter",desc:"Cazador con halcón y trampas.",hp:230,speed:165,armor:0,start:"double_strafe",castAction:"attack",tier:"first",scaling:"ranged",rank:2
}, {
  id:"bard",base:"archer",name:"Bard",nameF:"Dancer",desc:"Canciones y danzas que te refuerzan y desconciertan a la horda.",hp:220,speed:165,armor:0,start:"double_strafe",castAction:"attack",tier:"first",scaling:"ranged",rank:2
}, {
  id:"priest",base:"acolyte",name:"Priest",desc:"Sanación, bendiciones y exorcismo.",hp:270,speed:150,armor:1,start:"heal",castAction:"cast",tier:"first",scaling:"magic",rank:2
}, {
  id:"monk",base:"acolyte",name:"Monk",desc:"Puños, esferas espirituales y combos hasta el Asura Strike.",hp:300,speed:150,armor:1,start:"heal",castAction:"attack",tier:"first",scaling:"melee",rank:2
}, {
  id:"assassin",base:"thief",name:"Assassin",desc:"Katares, venenos y golpes desde las sombras.",hp:250,speed:175,armor:0,start:"envenom",castAction:"attack",tier:"first",scaling:"melee",rank:2
}, {
  id:"rogue",base:"thief",name:"Rogue",desc:"Pícaro: puñaladas por la espalda, despojos y trucos sucios.",hp:205,speed:175,armor:0,start:"envenom",castAction:"attack",tier:"first",scaling:"melee",rank:2
}, {
  id:"blacksmith",base:"merchant",name:"Blacksmith",desc:"Herrero: martillazos que aturden y fuerza bruta forjada.",hp:370,speed:145,armor:1,start:"mammonite",castAction:"attack",tier:"first",scaling:"melee",rank:2
}, {
  id:"alchemist",base:"merchant",name:"Alchemist",desc:"Ácidos, botellas de fuego, plantas y su homúnculo.",hp:370,speed:145,armor:1,start:"mammonite",castAction:"attack",tier:"first",scaling:"melee",rank:2
}, {
  id:"star_gladiator",base:"taekwon",name:"Star Gladiator",desc:"El poder del sol, la luna y las estrellas en cada patada.",hp:240,speed:160,armor:0,start:"tornado_kick",castAction:"attack",tier:"extended",scaling:"melee",rank:2
}, {
  id:"soul_linker",base:"taekwon",name:"Soul Linker",desc:"Conjuros de espíritu y protecciones Ka.",hp:220,speed:160,armor:0,start:"tornado_kick",castAction:"cast",tier:"extended",scaling:"magic",rank:2
}
];
for(const a of[...wp,...gu])Do(a,["name","nameF","desc"]);
const xU=[...wp,...gu],aW=a=>`${a}.0.riding`;
function nu(a) {
  return xU.find(e=>e.id===a)??wp[0]
}
function al(a) {
  const e=nu(a);
  return e.base?[...al(e.base),e.id]:[e.id]
}
function nW(a) {
  return gu.filter(e=>e.base===a)
}
function sW(a,e) {
  return e==="f"&&a.nameF?a.nameF:a.name
}
const wU={},oW= {
  tarou:"Tarou rabiosos"
};
function _e(a) {
  wU[a.id]=a
}
_e( {
  id:"poring",name:"Poring",level:1,hp:30,speed:70,damage:3,exp:1,radius:14
});
_e( {
  id:"lunatic",name:"Lunatic",level:1,hp:25,speed:85,damage:3,exp:1,radius:12
});
_e( {
  id:"fabre",name:"Fabre",level:2,hp:35,speed:60,damage:4,exp:1,radius:13
});
_e( {
  id:"pupa",name:"Pupa",level:2,hp:60,speed:0,damage:0,exp:2,radius:14
});
_e( {
  id:"drops",name:"Drops",level:2,hp:45,speed:72,damage:5,exp:2,radius:14
});
_e( {
  id:"picky",name:"Picky",level:3,hp:40,speed:90,damage:4,exp:2,radius:12
});
_e( {
  id:"roda_frog",name:"Roda Frog",level:3,hp:55,speed:78,damage:5,exp:2,radius:15
});
_e( {
  id:"peco_egg",name:"Peco Peco Egg",level:3,hp:90,speed:0,damage:0,exp:3,radius:15
});
_e( {
  id:"condor",name:"Condor",level:4,hp:65,speed:108,damage:6,exp:3,radius:16
});
_e( {
  id:"savage_babe",name:"Savage Babe",level:4,hp:75,speed:80,damage:7,exp:3,radius:14
});
_e( {
  id:"creamy",name:"Creamy",level:5,hp:80,speed:100,damage:7,exp:3,radius:14
});
_e( {
  id:"hornet",name:"Hornet",level:5,hp:70,speed:120,damage:7,exp:3,radius:12
});
_e( {
  id:"mandragora",name:"Mandragora",level:6,hp:160,speed:0,damage:10,exp:4,radius:16,sprout: {
    min:220,max:340,cap:6
  },ranged: {
    range:380,cd:3,warn:1.2,windup:.15,radius:40,fx:"fx_mandragora_atk"
  }
});
_e( {
  id:"baby_desert_wolf",name:"Baby Desert Wolf",level:7,hp:150,speed:118,damage:11,exp:5,radius:15
});
_e( {
  id:"rocker",name:"Rocker",level:8,hp:200,speed:90,damage:13,exp:6,radius:16
});
_e( {
  id:"eclipse",name:"Eclipse",level:3,hp:3400,speed:92,damage:18,exp:110,radius:20,boss:"mini",scale:1.35
});
_e( {
  id:"toad",name:"Toad",level:4,hp:4600,speed:80,damage:20,exp:135,radius:22,boss:"mini",scale:1.35
});
_e( {
  id:"dragon_fly",name:"Dragon Fly",level:5,hp:5600,speed:115,damage:22,exp:150,radius:18,boss:"mini",scale:1.35
});
_e( {
  id:"vocal",name:"Vocal",level:7,hp:7500,speed:88,damage:25,exp:180,radius:20,boss:"mini",scale:1.35
});
_e( {
  id:"mastering",name:"Mastering",level:8,hp:52e3,speed:82,damage:44,exp:700,radius:41,boss:"mvp",scale:1.5
});
_e( {
  id:"thief_bug_egg",name:"Thief Bug Egg",level:9,hp:195,speed:0,damage:0,exp:5,radius:15,hatch: {
    id:"thief_bug",secs:15
  }
});
_e( {
  id:"familiar",name:"Familiar",level:9,hp:225,speed:95,damage:9,exp:4,radius:15
});
_e( {
  id:"thief_bug",name:"Thief Bug",level:9,hp:255,speed:90,damage:10,exp:4,radius:15
});
_e( {
  id:"tarou",name:"Tarou",level:10,hp:285,speed:85,damage:10,exp:5,radius:13
});
_e( {
  id:"plankton",name:"Plankton",level:10,hp:330,speed:60,damage:11,exp:5,radius:16
});
_e( {
  id:"drainliar",name:"Drainliar",level:11,hp:300,speed:110,damage:11,exp:6,radius:14
});
_e( {
  id:"thief_bug_female",name:"Thief Bug Female",level:11,hp:345,speed:90,damage:12,exp:6,radius:16
});
_e( {
  id:"cramp",name:"Cramp",level:12,hp:390,speed:92,damage:13,exp:7,radius:14
});
_e( {
  id:"tarou_bite",name:"Biting Tarou",level:10,hp:5500,speed:110,damage:23,exp:120,radius:24,boss:"mini",scale:2.8,group:"tarou",aura:16730682
});
_e( {
  id:"tarou_plague",name:"Plague Tarou",level:10,hp:5500,speed:95,damage:21,exp:120,radius:24,boss:"mini",scale:2.8,group:"tarou",aura:8050762
});
_e( {
  id:"tarou_burrow",name:"Burrowing Tarou",level:10,hp:5500,speed:100,damage:23,exp:120,radius:24,boss:"mini",scale:2.8,group:"tarou",aura:14197322
});
_e( {
  id:"golden_thief_bug",name:"Golden Thief Bug",level:12,hp:58e3,speed:100,damage:47,exp:750,radius:41,boss:"mvp",scale:1.5
});
_e( {
  id:"chonchon",name:"Chonchon",level:1,hp:30,speed:115,damage:4,exp:2,radius:12
});
_e( {
  id:"goblin",name:"Goblin",level:1,hp:160,speed:96,damage:11,exp:5,radius:16
});
_e( {
  id:"kobold",name:"Kobold",level:1,hp:180,speed:92,damage:12,exp:5,radius:17
});
_e( {
  id:"orc_skeleton",name:"Orc Skeleton",level:1,hp:300,speed:78,damage:18,exp:9,radius:18,undead:!0
});
_e( {
  id:"ghostring",name:"Ghostring",level:13,hp:28e3,speed:92,damage:24,exp:180,radius:20,boss:"mini",undead:!0,scale:1.35
});
_e( {
  id:"orc_hero",name:"Orc Hero",level:1,hp:22500,speed:92,damage:50,exp:450,radius:41,boss:"mvp",scale:1.5
});
_e( {
  id:"osiris",name:"Osiris",level:1,hp:33e3,speed:86,damage:60,exp:550,radius:41,boss:"mvp",undead:!0,scale:1.5
});
_e( {
  id:"baphomet",name:"Baphomet",level:1,hp:6e4,speed:96,damage:80,exp:1e3,radius:40,boss:"mvp",scale:1.5
});
_e( {
  id:"kukre",name:"Kukre",level:13,hp:560,speed:75,damage:9,exp:4,radius:13
});
_e( {
  id:"marina",name:"Marina",level:13,hp:620,speed:60,damage:10,exp:4,radius:14
});
_e( {
  id:"hydra",name:"Hydra",level:14,hp:680,speed:40,damage:12,exp:5,radius:15,ranged: {
    range:320,cd:2.6,warn:1.5,windup:.12,radius:38,fx:"fx_hydra_atk"
  }
});
_e( {
  id:"whisper",name:"Whisper",level:14,hp:590,speed:105,damage:13,exp:6,radius:15,undead:!0
});
_e( {
  id:"penomena",name:"Penomena",level:15,hp:28e3,speed:60,damage:29,exp:240,radius:20,boss:"mini",scale:1.35,ranged: {
    range:360,cd:2.4,warn:1.3,windup:.12,radius:54,fx:"fx_hydra_atk"
  }
});
_e( {
  id:"sword_fish",name:"Sword Fish",level:14,hp:740,speed:110,damage:18,exp:8,radius:17
});
_e( {
  id:"pirate_skel",name:"Pirate Skeleton",level:14,hp:800,speed:95,damage:20,exp:9,radius:16,undead:!0
});
_e( {
  id:"drake",name:"Drake",level:15,hp:18e4,speed:100,damage:49,exp:800,radius:41,boss:"mvp",undead:!0,scale:1.5
});
_e( {
  id:"vadon",name:"Vadon",level:16,hp:820,speed:70,damage:12,exp:6,radius:15
});
_e( {
  id:"cornutus",name:"Cornutus",level:16,hp:900,speed:60,damage:12,exp:6,radius:15
});
_e( {
  id:"marse",name:"Marse",level:17,hp:860,speed:95,damage:13,exp:6,radius:14
});
_e( {
  id:"phen",name:"Phen",level:18,hp:1100,speed:125,damage:15,exp:7,radius:16
});
_e( {
  id:"obeaune",name:"Obeaune",level:18,hp:1200,speed:100,damage:15,exp:7,radius:16
});
_e( {
  id:"marine_sphere",name:"Marine Sphere",level:19,hp:950,speed:0,damage:16,exp:7,radius:15,fuse: {
    secs:10,m:2,mult:3
  }
});
_e( {
  id:"merman",name:"Merman",level:20,hp:1400,speed:105,damage:18,exp:9,radius:17
});
_e( {
  id:"kraken_leg",name:"Kraken Leg",level:20,hp:9e3,speed:0,damage:22,exp:20,radius:22,ranged: {
    range:420,cd:2.8,warn:1.3,windup:.12,radius:46,fx:"fx_hydra_atk"
  }
});
_e( {
  id:"deviace",name:"Deviace",level:17,hp:3e4,speed:110,damage:30,exp:210,radius:22,boss:"mini",scale:1.35
});
_e( {
  id:"strouf",name:"Strouf",level:19,hp:5e4,speed:95,damage:35,exp:280,radius:24,boss:"mini",scale:1.35
});
_e( {
  id:"king_dramoh",name:"King Dramoh",level:20,hp:8e4,speed:80,damage:40,exp:400,radius:28,boss:"mini",scale:1.25
});
_e( {
  id:"kraken",name:"Kraken",level:20,hp:28e4,speed:45,damage:62,exp:1e3,radius:41,boss:"mvp",scale:1.5
});
_e( {
  id:"spore",name:"Spore",level:21,hp:830,speed:65,damage:12,exp:6,radius:15
});
_e( {
  id:"willow",name:"Willow",level:21,hp:860,speed:55,damage:12,exp:6,radius:18
});
_e( {
  id:"poporing",name:"Poporing",level:21,hp:840,speed:78,damage:13,exp:6,radius:14
});
_e( {
  id:"snake",name:"Boa",level:22,hp:1200,speed:95,damage:15,exp:7,radius:15
});
_e( {
  id:"worm_tail",name:"Wormtail",level:22,hp:1250,speed:80,damage:15,exp:7,radius:16
});
_e( {
  id:"poison_spore",name:"Poison Spore",level:22,hp:1300,speed:68,damage:16,exp:8,radius:15
});
_e( {
  id:"smokie",name:"Smokie",level:23,hp:1350,speed:100,damage:17,exp:8,radius:15
});
_e( {
  id:"wolf",name:"Wolf",level:23,hp:1400,speed:128,damage:18,exp:9,radius:18
});
_e( {
  id:"elder_willow",name:"Elder Willow",level:23,hp:1650,speed:55,damage:20,exp:10,radius:20
});
_e( {
  id:"dragon_tail",name:"Dragon Tail",level:24,hp:1450,speed:125,damage:21,exp:10,radius:15
});
_e( {
  id:"bigfoot",name:"Bigfoot",level:24,hp:2e3,speed:80,damage:24,exp:12,radius:22
});
_e( {
  id:"greatest_general",name:"Greatest General",level:24,hp:2200,speed:0,damage:22,exp:12,radius:18
});
_e( {
  id:"dokebi",name:"Dokebi",level:25,hp:1900,speed:115,damage:25,exp:13,radius:16
});
_e( {
  id:"nine_tail",name:"Nine Tail",level:25,hp:2100,speed:125,damage:27,exp:14,radius:18
});
_e( {
  id:"angeling",name:"Angeling",level:22,hp:35100,speed:82,damage:30,exp:220,radius:20,boss:"mini",scale:1.35
});
_e( {
  id:"deviling",name:"Deviling",level:23,hp:58500,speed:96,damage:36,exp:300,radius:20,boss:"mini",scale:1.35
});
_e( {
  id:"vagabond_wolf",name:"Vagabond Wolf",level:24,hp:93600,speed:125,damage:42,exp:430,radius:29,boss:"mini",scale:1.35
});
_e( {
  id:"eddga",name:"Eddga",level:25,hp:338e3,speed:100,damage:72,exp:1100,radius:41,boss:"mvp",scale:1.5
});
_e( {
  id:"zombie",name:"Zombie",level:26,hp:2875,speed:55,damage:28,exp:15,radius:18,undead:!0
});
_e( {
  id:"skeleton",name:"Skeleton",level:26,hp:2760,speed:95,damage:28,exp:15,radius:16,undead:!0
});
_e( {
  id:"skel_archer",name:"Archer Skeleton",level:27,hp:2640,speed:60,damage:26,exp:16,radius:16,undead:!0,ranged: {
    range:380,cd:2.6,warn:0,windup:.3,radius:0,fx:"fx_arrow",arrow:560
  }
});
_e( {
  id:"skel_soldier",name:"Soldier Skeleton",level:27,hp:3385,speed:100,damage:31,exp:17,radius:17,undead:!0
});
_e( {
  id:"munak",name:"Munak",level:28,hp:3540,speed:85,damage:32,exp:18,radius:16,undead:!0
});
_e( {
  id:"bon_gun",name:"Bongun",level:28,hp:3265,speed:115,damage:33,exp:18,radius:16,undead:!0
});
_e( {
  id:"sohee",name:"Sohee",level:29,hp:3775,speed:95,damage:34,exp:19,radius:16
});
_e( {
  id:"horong",name:"Horong",level:30,hp:1890,speed:140,damage:30,exp:16,radius:13
});
_e( {
  id:"skeleton_general",name:"Skeleton General",level:27,hp:71250,speed:100,damage:46,exp:480,radius:26,boss:"mini",undead:!0,scale:1.35
});
_e( {
  id:"cat_o_nine_tail",name:"Cat O' Nine Tails",level:28,hp:112500,speed:120,damage:52,exp:600,radius:26,boss:"mini",scale:1.35
});
_e( {
  id:"hyegun",name:"Hyegun",level:29,hp:15e4,speed:105,damage:58,exp:700,radius:26,boss:"mini",undead:!0,scale:1.35
});
_e( {
  id:"moonlight",name:"Moonlight Flower",level:30,hp:1e6,speed:110,damage:80,exp:1400,radius:41,boss:"mvp",scale:1.5
});
_e( {
  id:"orc_warrior",name:"Orc Warrior",level:31,hp:3900,speed:86,damage:36,exp:20,radius:20
});
_e( {
  id:"orc_lady",name:"Orc Lady",level:32,hp:3500,speed:108,damage:34,exp:20,radius:17
});
_e( {
  id:"high_orc",name:"High Orc",level:35,hp:19e4,speed:95,damage:62,exp:800,radius:26,boss:"mini",scale:1.35
});
const MU=[ {
  from:0,to:90,pool:["poring","lunatic","fabre"],perSecond:1.2,maxAlive:40
}, {
  from:90,to:180,pool:["poring","lunatic","drops","picky","roda_frog"],perSecond:2,maxAlive:70
}, {
  from:180,to:300,pool:["drops","picky","roda_frog","condor","savage_babe"],perSecond:2.8,maxAlive:100
}, {
  from:300,to:420,pool:["condor","savage_babe","creamy","hornet","mandragora"],perSecond:3.5,maxAlive:140
}, {
  from:420,to:600,pool:["creamy","hornet","mandragora","baby_desert_wolf","rocker"],perSecond:4.5,maxAlive:180
}, {
  from:600,to:720,pool:["hornet","creamy","baby_desert_wolf","rocker"],perSecond:5.5,maxAlive:220
}, {
  from:720,to:900,pool:["creamy","baby_desert_wolf","rocker","hornet","mandragora"],perSecond:7,maxAlive:260
}
],SU=[ {
  t:150,id:"eclipse"
}, {
  t:300,id:"toad"
}, {
  t:450,id:"dragon_fly"
}, {
  t:600,id:"vocal"
}, {
  t:720,id:"mastering"
}
],AU=1.3,kU=900,rW=15,iW=120;
function lW(a,e) {
  const t=a.ramp;
  if(!t)return {
    hp:1,damage:1,gems:1
  };
  const n=Math.min(1,Math.max(0,e/t.full)),s=t.early,o=s?s.hp+(1-s.hp)*Math.min(1,Math.max(0,e/s.until)):1;
  return {
    hp:(t.hp+(1-t.hp)*n)*o,damage:t.damage+(1-t.damage)*n,gems:t.gems+(1-t.gems)*n
  }
}
const px=[ {
  from:0,to:60,pool:["kukre","marina"],perSecond:1.2,maxAlive:45
}, {
  from:60,to:150,pool:["kukre","marina","hydra","whisper"],perSecond:1.8,maxAlive:68
}, {
  from:150,to:240,pool:["marina","hydra","whisper","sword_fish"],perSecond:2.4,maxAlive:90
}, {
  from:240,to:330,pool:["whisper","sword_fish","pirate_skel"],perSecond:3,maxAlive:113
}, {
  from:330,to:780,pool:["whisper","sword_fish","pirate_skel","hydra"],perSecond:3.6,maxAlive:135
}
],EU=[ {
  from:0,to:60,pool:["thief_bug","familiar","tarou"],perSecond:1.2,maxAlive:45
}, {
  from:60,to:150,pool:["thief_bug","familiar","tarou","thief_bug_egg"],perSecond:1.9,maxAlive:70
}, {
  from:150,to:270,pool:["tarou","plankton","drainliar","thief_bug"],perSecond:2.6,maxAlive:95
}, {
  from:270,to:390,pool:["drainliar","thief_bug_female","plankton","tarou"],perSecond:3.3,maxAlive:120
}, {
  from:390,to:660,pool:["thief_bug_female","cramp","drainliar","plankton"],perSecond:4,maxAlive:145
}
],CU=[ {
  from:0,to:60,pool:["vadon","cornutus"],perSecond:1.2,maxAlive:50
}, {
  from:60,to:150,pool:["vadon","cornutus","marse"],perSecond:2,maxAlive:85
}, {
  from:150,to:270,pool:["cornutus","marse","obeaune","marine_sphere"],perSecond:2.8,maxAlive:120
}, {
  from:270,to:420,pool:["marse","obeaune","phen","marine_sphere"],perSecond:3.5,maxAlive:165
}, {
  from:420,to:600,pool:["obeaune","phen","merman","marine_sphere"],perSecond:4.5,maxAlive:210
}, {
  from:600,to:900,pool:["phen","merman","obeaune","marse"],perSecond:5.5,maxAlive:255
}
],TU=[ {
  from:0,to:85,pool:["spore","willow","poporing"],perSecond:1.2,maxAlive:50
}, {
  from:85,to:170,pool:["spore","willow","poporing","snake","worm_tail"],perSecond:2,maxAlive:88
}, {
  from:170,to:285,pool:["poporing","snake","worm_tail","poison_spore","smokie"],perSecond:2.8,maxAlive:125
}, {
  from:285,to:395,pool:["worm_tail","poison_spore","smokie","wolf","elder_willow"],perSecond:3.5,maxAlive:175
}, {
  from:395,to:565,pool:["smokie","wolf","elder_willow","dragon_tail","bigfoot"],perSecond:4.5,maxAlive:225
}, {
  from:565,to:735,pool:["wolf","dragon_tail","bigfoot","greatest_general","dokebi"],perSecond:5.5,maxAlive:275
}, {
  from:735,to:1020,pool:["dragon_tail","bigfoot","greatest_general","dokebi","nine_tail"],perSecond:7,maxAlive:325
}
],PU=[ {
  from:0,to:90,pool:["zombie","skeleton","poporing"],perSecond:1.2,maxAlive:55
}, {
  from:90,to:180,pool:["zombie","skeleton","poporing","skel_archer"],perSecond:2,maxAlive:97
}, {
  from:180,to:330,pool:["skeleton","skel_archer","zombie","skel_soldier"],perSecond:2.8,maxAlive:138
}, {
  from:330,to:540,pool:["skel_soldier","skel_archer","munak","bon_gun"],perSecond:3.6,maxAlive:193
}, {
  from:540,to:720,pool:["munak","bon_gun","sohee","horong"],perSecond:4.6,maxAlive:248
}, {
  from:720,to:1020,pool:["sohee","horong","nine_tail","bon_gun","munak"],perSecond:7.7,maxAlive:358
}
],RU=[ {
  from:0,to:30,pool:["orc_warrior"],perSecond:4.4,maxAlive:100
}, {
  from:30,to:60,pool:["orc_warrior","orc_lady"],perSecond:6.8,maxAlive:150
}, {
  from:60,to:90,pool:["orc_warrior","orc_lady"],perSecond:9.6,maxAlive:200
}
],dW= {
  prt_fild08:"Campos de Prontera",sunken_deck:"Cubierta del barco hundido",sunken:"Barco hundido",prt_sewer:"Alcantarillas de Prontera",byalan:"Templo de Byalan",pay_fild08:"Bosque de Payon",payon_cave:"Cueva de Payon",prt_throne:"Sala del trono"
},cW= {
  prontera: {
    map:"prt_fild08",bgm:"field",waves:MU,bosses:SU,runLength:kU,jobCap:12,jobExp:.25
  },sewer: {
    map:"prt_sewer",bgm:"sewer",waves:EU,runLength:660,jobCap:20,jobExp:1,mood:"sewer",bosses:[ {
      t:180,id:"tarou_bite"
    }, {
      t:180,id:"tarou_plague"
    }, {
      t:180,id:"tarou_burrow"
    }, {
      t:480,id:"golden_thief_bug"
    }
    ],ramp: {
      hp:.25,damage:.5,gems:.4,full:240,early: {
        hp:.8,until:60
      }
    }
  },sunken: {
    map:"sunken_deck",bgm:"sunken",waves:px,bosses:[ {
      t:180,id:"ghostring"
    }, {
      t:360,id:"penomena"
    }, {
      t:600,id:"drake"
    }
    ],runLength:780,jobCap:25,jobExp:2,mood:"gloom",ramp: {
      hp:.15,damage:.4,gems:.3,full:300,early: {
        hp:.33,until:60
      }
    }
  },sunken_story: {
    map:"sunken",bgm:"sunken",waves:px,bosses:[ {
      t:180,id:"ghostring"
    }, {
      t:420,id:"drake"
    }
    ],runLength:600,jobCap:25,jobExp:2,mood:"gloom",gate: {
      down:"H-H'",up:"H'-H",boss:"ghostring"
    },mvpAt:[302,47],story:"sunken",jobWeapon:!0,ramp: {
      hp:.1,damage:.35,gems:.5,full:480
    },hpGrowth:600,mobHp:.5,bossHp: {
      ghostring:1700,drake:8e3
    },areas:[ {
      name:"Barco hundido 1F",x0:0,y0:0,x1:200,y1:200
    }, {
      name:"Barco hundido 2F",x0:200,y0:0,x1:400,y1:200
    }, {
      name:"Isla del barco hundido",x0:400,y0:0,x1:540,y1:140
    }
    ]
  },byalan: {
    map:"byalan",bgm:"byalan",waves:CU,runLength:900,jobCap:31,jobExp:1.8,mood:"sea",bosses:[ {
      t:180,id:"deviace"
    }, {
      t:360,id:"strouf"
    }, {
      t:540,id:"king_dramoh"
    }, {
      t:720,id:"kraken"
    }
    ],ramp: {
      hp:.27,damage:.3,gems:.25,full:450,early: {
        hp:.25,until:60
      }
    },gemExp:.4
  },payon: {
    map:"pay_fild08",bgm:"payon",waves:TU,runLength:1020,start:[144,244],jobCap:38,jobExp:2.2,bosses:[ {
      t:180,id:"angeling"
    }, {
      t:360,id:"deviling"
    }, {
      t:600,id:"vagabond_wolf"
    }, {
      t:840,id:"eddga"
    }
    ],ramp: {
      hp:.27,damage:.3,gems:.25,full:450,early: {
        hp:.25,until:60
      }
    },gemExp:.4
  },payon_cave: {
    map:"payon_cave",bgm:"payon_cave",waves:PU,runLength:1020,jobCap:49,jobExp:3,mood:"cave",bosses:[ {
      t:180,id:"skeleton_general"
    }, {
      t:360,id:"cat_o_nine_tail"
    }, {
      t:600,id:"hyegun"
    }, {
      t:840,id:"moonlight"
    }
    ],ramp: {
      hp:.104,damage:.3,gems:.25,full:450,early: {
        hp:.24,until:60
      }
    },mobHpBy: {
      poporing:2.4
    },mobDmg:.75,gemExp:.42
  },prt_castle: {
    map:"prt_throne",bgm:"prontera",waves:RU,bosses:[ {
      t:90,id:"high_orc"
    }
    ],runLength:90,jobCap:49,story:"castle",storyOnly:!0,start:[248,92],reward:22847,mood:"hall",spawnAt:[[69.5,97]],ramp: {
      hp:.28,damage:.45,gems:.4,full:300
    }
  },endless: {
    map:"endless",bgm:"endless",waves:[ {
      from:0,to:1e9,pool:["poring"],perSecond:0,maxAlive:0
    }
    ],bosses:[],runLength:1e9
  }
};
function uW(a) {
  const e=6+a*7+a*a*.8,t=Math.min(1,.35+.65*(a-1)/24);
  return Math.max(4,Math.ceil(e*t))
}
const hW=[25,45],zU=1.1,h0=a=>( {
  tier:a,mult:a,weaponMult:zU**(a-1)
}),Ty=[h0(1),h0(2),h0(3)];
function DA(a) {
  return Ty.find(e=>e.tier===a)??Ty[0]
}
function mW(a) {
  return typeof a=="number"&&Ty.some(e=>e.tier===a)?a:void 0
}
let LU=0;
const DU=(a,e)=>a+e;
function pW(a) {
  const e=[],t=new Map;
  for(const n of a) {
    if(!n.group) {
      e.push(n.text(1));
      continue
    }
    const s=t.get(n.group.id);
    if(s)s.v=n.group.add(s.v,n.group.value);
    else {
      const o= {
        g:n.group,v:n.group.value
      };
      t.set(n.group.id,o),e.push(o)
    }
  }
  return e.map(n=>typeof n=="string"?n:n.g.text(n.v))
}
function fW(a,e) {
  if(e===1)return a;
  const t=a.group;
  return {
    apply:(n,s)=>a.apply(n,e*s),text:n=>a.text(e*n),group:t&& {
      ...t,value:t.value*e
    }
  }
}
const bn=a=>`${String(Math.round(a*1e3)/10).replace(".",",")}%`,yu=a=>String(Math.round(a*100)/100).replace(".",","),Yt=(a,e)=> {
  const t=++LU;
  return n=>( {
    apply:(s,o)=>a(s,n*o),text:s=>Pt(e(n*s)),group: {
      id:t,value:n,add:DU,text:s=>Pt(e(s))
    }
  })
},X=Yt((a,e)=>a.damageMult+=e,a=>Kt("dmg",a)),tt=Yt((a,e)=>a.haste+=e,a=>Kt("cd",a)),gt=Yt((a,e)=>a.speedMult+=e,a=>Kt("moveSpeed",a)),Ge=Yt((a,e)=>a.maxHp+=e,a=>`+${yu(a)} HP máximo`),lt=Yt((a,e)=>a.armor+=e,a=>`+${yu(a)} de armadura`),ct=Yt((a,e)=>a.damageReduction+=e,a=>a<0?`+${bn(-a)} de daño recibido`:`-${bn(a)} de daño recibido`),Ee=Yt((a,e)=>a.critChance+=e,a=>`+${bn(a)} de crítico`),FU=Yt((a,e)=>a.pierceChance+=e,a=>Kt("pierce",a)),zt=Yt((a,e)=>a.critMult+=e,a=>`+${bn(a)} de daño crítico`),ut=Yt((a,e)=>a.flee+=e,a=>`+${bn(a)} de Flee`),Ut=Yt((a,e)=>a.areaMult+=e,a=>Kt("area",a)),id=Yt((a,e)=>a.reachMult+=e,a=>Kt("reach",a)),rn=Yt((a,e)=>a.projSpeedMult+=e,a=>Kt("projSpeed",a)),Io=Yt((a,e)=>a.expMult+=e,a=>`+${bn(a)} de EXP`),rl=Yt((a,e)=>a.pickupRadius*=1+e,a=>`+${bn(a)} de radio de recogida`),ma=Yt((a,e)=>a.regen+=e,a=>`+${yu(a)} HP/s`),vu=Yt((a,e)=>a.regenMoving+=e,a=>`+${yu(a)} HP/s al moverte`),La=Yt((a,e)=>a.bossUndeadMult+=e,a=>`+${bn(a)} de daño a jefes y no-muertos`),ls=Yt((a,e)=>a.bossEliteMult+=e,a=>`+${bn(a)} de daño a jefes y élites`),za=Yt((a,e)=>a.doubleChance+=e,a=>`+${bn(a)} de doble casteo`),mo=Yt((a,e)=>a.zenyMult+=e,a=>`+${bn(a)} de zeny`),Js=Yt((a,e)=>a.stunChance+=e,a=>`+${bn(a)} de aturdir al golpear`),IU=Yt((a,e)=>a.lowHpBleed+=e,a=>`Con poca vida, tus golpes hacen sangrar un ${bn(a)} de su daño en 3 s`),BU=Yt((a,e)=>a.berserk+=e,()=>"Tu vida máxima baja al 40% y cuentas siempre como con poca vida"),NU=Yt((a,e)=>a.bleedLifesteal+=e,a=>`Te curas un ${bn(a)} del daño que hace el sangrado`),Ls=Yt((a,e)=>a.maxHpPct+=e,a=>`+${bn(a)} de HP máximo`),Ld=Yt((a,e)=>a.regenStill+=e,a=>`+${yu(a)} HP/s estando quieto`);
Yt((a,e)=>a.endureReduction+=e,a=>`Endure reduce un ${bn(a)} más el daño`);
Yt((a,e)=>a.endureReflect+=e,a=>`Con Endure activo, devuelves al atacante el ${bn(a)} del golpe recibido (sin reducir)`);
const Zr=Yt((a,e)=>a.lowHpDamage+=e,a=>`+${bn(a)} de daño con poca vida`),FA=Yt((a,e)=>a.dotDmg+=e,a=>`+${bn(a)} de daño de venenos, quemaduras y sangrados`),Dd=Yt((a,e)=>a.potionMult+=e,a=>`+${bn(a)} curación de la carne`),IA=Yt((a,e)=>a.extraProjectiles+=Math.round(e),a=>Kt("count",Math.round(a),"proyectil")),Fd=a=>Yt((e,t)=>e[a]+=Math.round(t),e=>`+${Math.round(e)} ${a.toUpperCase()}`),Id=Fd("str"),_u=Fd("agi"),Hv=Fd("vit"),Mp=Fd("int"),Ov=Fd("dex"),BA=Fd("luk"),Ys=Yt((a,e)=>a.castHaste+=e,a=>Kt("cast",a));
function bu(a,e) {
  return Yt((t,n)=>t.ext[a]=(t.ext[a]??0)+n,e)
}
const NA=Yt((a,e)=>a.revives+=Math.round(e),()=>"Revives una vez por partida con toda la vida"),UU=new Set(["활","권총","라이플","샷건","수리검","롯드","악기"]),qU=[ {
  id:"head_top",name:"Cabeza (arriba)",gear:"head_top"
}, {
  id:"head_mid",name:"Cabeza (medio)",gear:"head_mid"
}, {
  id:"head_low",name:"Cabeza (abajo)",gear:"head_low"
}, {
  id:"armor",name:"Armadura",gear:"armor"
}, {
  id:"weapon",name:"Arma",gear:"weapon"
}, {
  id:"shield",name:"Escudo",gear:"shield"
}, {
  id:"garment",name:"Capa",gear:"garment"
}, {
  id:"shoes",name:"Calzado",gear:"shoes"
}, {
  id:"acc1",name:"Accesorio",gear:"acc"
}, {
  id:"acc2",name:"Accesorio",gear:"acc"
}
];
for(const a of qU)Do(a,["name"]);
function gW(a) {
  return a.startsWith("head")?"headgear":a==="acc"?"accessory":a
}
const gs={},HU=new Set(["양손검","양손창","양손도끼","활","권총","라이플","샷건","수리검","카타르"]);
function yW(a) {
  return!!a&&a.slot==="weapon"&&HU.has(a.wtype??"")
}
const OU=[0,1,2,3,4],jU=[0,0,1,1,2];
function vW(a,e=0) {
  const t=gs[a];
  return!t||t.starter?(t==null?void 0:t.cardSlots)??0:(t.slot==="weapon"?OU:jU)[e]??0
}
function Q(a,e,t,n,s={}) {
  gs[a]= {
    id:a,slot:e,cardSlots:t,bonuses:n,...s
  }
}
Q(2254,"head_top",0,[Ge(40),lt(1),ma(.4)], {
  rare:!0
});
Q(2282,"head_top",0,[tt(.06),X(.04)], {
  rare:!0
});
Q(5038,"head_top",0,[X(.08),Ee(.03)], {
  rare:!0
});
Q(2255,"head_top",0,[X(.12),Ge(-15)], {
  rare:!0
});
Q(2274,"head_top",0,[ut(.05),gt(.04)]);
Q(5017,"head_top",1,[lt(2),La(.06)]);
Q(2299,"head_top",0,[lt(2),Ge(30)]);
Q(2256,"head_top",0,[X(.1),La(.08)], {
  rare:!0
});
Q(5013,"head_top",0,[Ut(.1),X(.06)], {
  rare:!0
});
Q(5035,"head_top",0,[Io(.08),mo(.1)]);
Q(2252,"head_top",0,[tt(.05),Ut(.05)]);
Q(2251,"head_top",0,[ma(.5),Dd(.2)]);
Q(2235,"head_top",0,[Io(.06),X(.04)]);
Q(2234,"head_top",0,[tt(.04),Ee(.02)]);
Q(2246,"head_top",0,[rn(.1),X(.04)]);
Q(2285,"head_top",0,[Ee(.04),rn(.08)]);
Q(2280,"head_top",1,[lt(1),ut(.03)]);
Q(5012,"head_top",0,[Io(.1)]);
Q(2214,"head_top",0,[gt(.05),rl(.1)]);
Q(2213,"head_top",0,[Ee(.03),ut(.02)]);
Q(2287,"head_top",1,[mo(.15),X(.03)]);
Q(2201,"head_mid",0,[Ee(.03)]);
Q(2260,"head_mid",0,[rn(.08)]);
Q(2286,"head_mid",0,[ut(.03),gt(.02)]);
Q(2291,"head_mid",0,[Zr(.15)]);
Q(2296,"head_mid",0,[Ut(.06)]);
Q(2212,"head_mid",0,[X(.04)]);
Q(2297,"head_low",0,[Ge(25),lt(1)]);
Q(2288,"head_low",0,[Js(.03)]);
Q(2292,"head_low",0,[ct(.04)]);
Q(2311,"armor",1,[Ge(60),ct(.04)], {
  rare:!0
});
Q(2320,"armor",1,[mo(.1),Io(.05),Ge(20)]);
Q(2353,"armor",1,[Ge(50),ma(.6),lt(1)], {
  rare:!0
});
Q(2321,"armor",1,[tt(.05),Ge(20)]);
Q(2335,"armor",1,[ut(.04),gt(.03)]);
Q(2330,"armor",1,[Ee(.03),rn(.05)]);
Q(2314,"armor",1,[lt(2),Ge(30)]);
Q(2316,"armor",1,[lt(4),gt(-.03)]);
Q(2367,"armor",1,[Ee(.05),X(.03)], {
  rare:!0
});
Q(2307,"armor",1,[lt(1),Ge(40)]);
Q(2503,"garment",1,[ct(.03)]);
Q(2505,"garment",1,[lt(1),ut(.02)]);
Q(2511,"garment",0,[ut(.05),La(.04)]);
Q(2515,"garment",1,[gt(.05),ut(.03)], {
  rare:!0
});
Q(2507,"garment",0,[X(.06),Ee(.02)], {
  rare:!0
});
Q(2509,"garment",0,[Ge(40),ma(.3)]);
Q(2405,"shoes",1,[gt(.04),Ge(15)]);
Q(2411,"shoes",1,[lt(1),Ge(25)]);
Q(2418,"shoes",0,[Ge(70),gt(.03)], {
  rare:!0
});
Q(2419,"shoes",0,[lt(2),gt(.05)], {
  rare:!0
});
Q(2424,"shoes",1,[ma(.5),gt(.03)]);
Q(2103,"shield",1,[lt(1)]);
Q(2107,"shield",1,[ct(.06)], {
  rare:!0
});
Q(2115,"shield",1,[lt(2),ct(.04)], {
  rare:!0
});
Q(2124,"shield",1,[lt(1),X(.04)]);
Q(2114,"shield",1,[lt(2),gt(-.02)]);
Q(2110,"shield",0,[La(.08),lt(1)]);
Q(2607,"acc",1,[tt(.03)]);
Q(2608,"acc",0,[ma(.4),ut(.02)]);
Q(2605,"acc",0,[gt(.04)]);
Q(2616,"acc",0,[Ee(.05)]);
Q(2615,"acc",0,[ct(.05)]);
Q(2614,"acc",0,[Ge(40),Ee(.03),X(.04)], {
  rare:!0
});
Q(2678,"acc",0,[X(.08),Ut(.05)], {
  rare:!0
});
Q(2679,"acc",0,[Ge(50),tt(.04)], {
  rare:!0
});
Q(2627,"acc",1,[Ge(20),lt(1)]);
Q(2619,"acc",0,[rn(.1),Ee(.02)]);
Q(2617,"acc",0,[tt(.04),Dd(.15)]);
Q(2620,"acc",0,[mo(.15),ut(.02)]);
Q(2603,"acc",0,[FA(.15)]);
Q(22847,"acc",0,[Ls(.08),lt(3),ct(.05),X(.05)]);
const br=["swordsman"],jv=["mage","acolyte"],Sp=["archer"],Ap=["acolyte","merchant"],UA=["thief","ninja"],kp=["merchant"];
Q(1107,"weapon",2,[X(.08)], {
  jobs:br,wtype:"검"
});
Q(1126,"weapon",2,[X(.06),Ee(.02)], {
  jobs:br,wtype:"검"
});
Q(1163,"weapon",1,[X(.12),Ut(.06)], {
  jobs:br,wtype:"양손검"
});
Q(1124,"weapon",0,[X(.1),Ge(30)], {
  jobs:br,rare:!0,wtype:"검"
});
Q(1133,"weapon",0,[X(.12),La(.05)], {
  jobs:br,rare:!0,wtype:"검"
});
Q(1131,"weapon",0,[X(.1),tt(.05)], {
  jobs:br,rare:!0,wtype:"검"
});
Q(1138,"weapon",0,[X(.15),La(.1)], {
  jobs:br,rare:!0,wtype:"검"
});
Q(1466,"weapon",0,[X(.16),Ut(.1)], {
  jobs:br,rare:!0,wtype:"양손창"
});
Q(1408,"weapon",2,[X(.07),Ut(.08)], {
  jobs:br,wtype:"창"
});
Q(1604,"weapon",2,[tt(.06)], {
  jobs:jv,wtype:"롯드"
});
Q(1610,"weapon",1,[tt(.05),X(.06)], {
  jobs:jv,wtype:"롯드"
});
Q(1613,"weapon",0,[X(.14),tt(.04)], {
  jobs:jv,rare:!0,wtype:"롯드"
});
Q(1704,"weapon",2,[X(.07),Ee(.02)], {
  jobs:Sp,wtype:"활"
});
Q(1718,"weapon",1,[X(.1),rn(.06)], {
  jobs:Sp,wtype:"활"
});
Q(1722,"weapon",0,[X(.14),IA(1)], {
  jobs:Sp,rare:!0,wtype:"활"
});
Q(1734,"weapon",0,[X(.12),Ee(.04)], {
  jobs:Sp,rare:!0,wtype:"활"
});
Q(1504,"weapon",2,[X(.06),Js(.02)], {
  jobs:Ap,wtype:"클럽"
});
Q(1513,"weapon",1,[X(.08),Ee(.03)], {
  jobs:Ap,wtype:"클럽"
});
Q(1519,"weapon",2,[X(.07),Js(.03)], {
  jobs:Ap,wtype:"클럽"
});
Q(1528,"weapon",0,[X(.1),La(.12)], {
  jobs:Ap,rare:!0,wtype:"클럽"
});
Q(1207,"weapon",2,[X(.05),za(.03)], {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
Q(1216,"weapon",2,[X(.04),Ee(.03)], {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
Q(1219,"weapon",2,[X(.06),ut(.02)], {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
Q(1222,"weapon",1,[X(.08),Ee(.04)], {
  jobs:UA,rare:!0,wtype:"단검"
});
Q(1228,"weapon",0,[X(.1),La(.08)], {
  jobs:UA,wtype:"단검"
});
Q(1250,"weapon",2,[X(.07),Ee(.05)], {
  jobs:["thief"],wtype:"단검"
});
Q(1253,"weapon",2,[X(.08),Ee(.06)], {
  jobs:["thief"],wtype:"단검"
});
Q(1261,"weapon",0,[X(.12),za(.05)], {
  jobs:["thief"],rare:!0,wtype:"단검"
});
Q(1265,"weapon",0,[X(.16),Ee(.05)], {
  jobs:["thief"],rare:!0,wtype:"단검"
});
Q(1351,"weapon",2,[X(.08),Ut(.04)], {
  jobs:kp,wtype:"양손도끼"
});
Q(1304,"weapon",0,[X(.11),Ge(25)], {
  jobs:kp,rare:!0,wtype:"도끼"
});
Q(1370,"weapon",0,[X(.16),gt(-.04)], {
  jobs:kp,rare:!0,wtype:"양손도끼"
});
Q(1377,"weapon",1,[X(.1),Ut(.08)], {
  jobs:kp,wtype:"양손도끼"
});
Q(1801,"weapon",2,[X(.07),Ee(.03)], {
  jobs:["taekwon"]
});
Q(13301,"weapon",2,[X(.08),Ut(.06)], {
  jobs:["ninja"],wtype:"수리검"
});
Q(13303,"weapon",0,[X(.13),rn(.08)], {
  jobs:["ninja"],rare:!0,wtype:"수리검"
});
Q(13001,"weapon",0,[X(.1),La(.08)], {
  jobs:["ninja"],rare:!0,wtype:"단검"
});
Q(13104,"weapon",1,[X(.08),Ee(.03)], {
  jobs:["gunslinger"],wtype:"권총"
});
Q(13151,"weapon",1,[X(.1),rn(.1)], {
  jobs:["gunslinger"],wtype:"라이플"
});
Q(13156,"weapon",0,[X(.12),Ut(.08)], {
  jobs:["gunslinger"],rare:!0,wtype:"샷건"
});
Q(13160,"weapon",0,[X(.16),IA(1)], {
  jobs:["gunslinger"],rare:!0,wtype:"샷건"
});
Q(1252,"weapon",3,[X(.08),Ee(.04)], {
  jobs:["assassin"],wtype:"카타르"
});
Q(1254,"weapon",2,[X(.1),za(.03)], {
  jobs:["assassin"],wtype:"카타르"
});
Q(1256,"weapon",1,[X(.1),tt(.04)], {
  jobs:["assassin"],wtype:"카타르"
});
Q(1258,"weapon",1,[X(.12),Ut(.05)], {
  jobs:["assassin"],wtype:"카타르"
});
Q(1262,"weapon",0,[X(.15),Ee(.06)], {
  jobs:["assassin"],rare:!0,wtype:"카타르"
});
Q(1803,"weapon",2,[X(.07),tt(.03)], {
  jobs:["monk"],wtype:"너클"
});
Q(1805,"weapon",2,[X(.08),Ee(.03)], {
  jobs:["monk"],wtype:"너클"
});
Q(1809,"weapon",1,[X(.1),za(.03)], {
  jobs:["monk"],wtype:"너클"
});
Q(1812,"weapon",0,[X(.13),La(.08)], {
  jobs:["monk"],rare:!0,wtype:"너클"
});
Q(1813,"weapon",0,[X(.16),Zr(.1)], {
  jobs:["monk"],rare:!0,wtype:"너클"
});
Q(1550,"weapon",3,[X(.06),tt(.04)], {
  jobs:["sage","priest"],wtype:"책"
});
Q(1553,"weapon",2,[X(.08),Ys(.05)], {
  jobs:["sage","priest"],wtype:"책"
});
Q(1555,"weapon",2,[X(.08),Ut(.06)], {
  jobs:["sage","priest"],wtype:"책"
});
Q(1557,"weapon",0,[X(.14),tt(.05)], {
  jobs:["sage","priest"],rare:!0,wtype:"책"
});
Q(1558,"weapon",0,[X(.1),ma(.6)], {
  jobs:["sage","priest"],rare:!0,wtype:"책"
});
Q(1901,"weapon",3,[X(.06),tt(.04)], {
  jobs:["bard"],wtype:"악기",gender:"m"
});
Q(1905,"weapon",2,[X(.08),Ut(.05)], {
  jobs:["bard"],wtype:"악기",gender:"m"
});
Q(1909,"weapon",1,[X(.1),tt(.05)], {
  jobs:["bard"],wtype:"악기",gender:"m"
});
Q(1913,"weapon",0,[X(.14),Ee(.04)], {
  jobs:["bard"],rare:!0,wtype:"악기",gender:"m"
});
Q(1950,"weapon",3,[X(.06),gt(.03)], {
  jobs:["bard"],wtype:"채찍",gender:"f"
});
Q(1954,"weapon",2,[X(.08),Ee(.03)], {
  jobs:["bard"],wtype:"채찍",gender:"f"
});
Q(1958,"weapon",1,[X(.1),Ut(.05)], {
  jobs:["bard"],wtype:"채찍",gender:"f"
});
Q(1964,"weapon",0,[X(.14),tt(.05)], {
  jobs:["bard"],rare:!0,wtype:"채찍",gender:"f"
});
const GU= {
  활:["rogue"],롯드:["soul_linker"],책:["priest"]
},VU= {
  활:["assassin"]
};
function WU(a) {
  if(!a.jobs)return;
  const e=new Set(a.jobs);
  for(const t of gu)t.base&&a.jobs.includes(t.base)&&e.add(t.id);
  for(const t of GU[a.wtype??""]??[])e.add(t);
  for(const t of VU[a.wtype??""]??[])e.delete(t);
  return[...e]
}
const xr=(a,e,t={})=>Q(a,e,0,[], {
  starter:!0,...t
});
xr(1101,"weapon", {
  jobs:["swordsman"],wtype:"검"
});
xr(1601,"weapon", {
  jobs:["mage","acolyte"],wtype:"롯드"
});
xr(1701,"weapon", {
  jobs:["archer"],wtype:"활"
});
xr(1501,"weapon", {
  jobs:["acolyte","merchant"],wtype:"클럽"
});
xr(1201,"weapon", {
  jobs:["thief","ninja"],wtype:"단검"
});
xr(1301,"weapon", {
  jobs:["merchant"],wtype:"도끼"
});
xr(13101,"weapon", {
  jobs:["gunslinger"],wtype:"권총"
});
xr(2101,"shield");
xr(2301,"armor");
function re(a,e,t,n,s={}) {
  gs[a]?Object.assign(gs[a], {
    base:n,bonuses:[]
  }):Q(a,e,t,[], {
    base:n,...s
  })
}
re(1105,"weapon",4, {
  atk:39,matk:0,def:0,wlv:1,elv:2
}, {
  jobs:["merchant","swordsman","thief"],wtype:"검"
});
re(1108,"weapon",4, {
  atk:53,matk:0,def:0,wlv:1,elv:2
}, {
  jobs:["merchant","swordsman","thief"],wtype:"검"
});
re(1202,"weapon",4, {
  atk:17,matk:0,def:0,wlv:1,elv:1
}, {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
re(1208,"weapon",4, {
  atk:43,matk:0,def:0,wlv:1,elv:1
}, {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
re(1302,"weapon",4, {
  atk:38,matk:0,def:0,wlv:1,elv:3
}, {
  jobs:["merchant","swordsman"],wtype:"도끼"
});
re(1402,"weapon",4, {
  atk:28,matk:0,def:0,wlv:1,elv:4
}, {
  jobs:["swordsman"],wtype:"창"
});
re(1502,"weapon",4, {
  atk:23,matk:0,def:0,wlv:1,elv:2
}, {
  jobs:["acolyte","merchant","swordsman"],wtype:"클럽"
});
re(1524,"weapon",1, {
  atk:110,matk:0,def:0,wlv:4,elv:40
}, {
  jobs:["acolyte"],wtype:"클럽"
});
re(1602,"weapon",4, {
  atk:15,matk:30,def:0,wlv:1,elv:1
}, {
  jobs:["acolyte","mage"],wtype:"롯드"
});
re(1702,"weapon",4, {
  atk:15,matk:0,def:0,wlv:1,elv:4
}, {
  jobs:["archer","thief"],wtype:"활"
});
re(13011,"weapon",3, {
  atk:50,matk:50,def:0,wlv:1,elv:12
}, {
  jobs:["ninja"],wtype:"단검"
});
re(1104,"weapon",3, {
  atk:39,matk:0,def:0,wlv:1,elv:2
}, {
  jobs:["merchant","swordsman","thief"],wtype:"검"
});
re(1117,"weapon",4, {
  atk:60,matk:0,def:0,wlv:1,elv:4
}, {
  jobs:["swordsman"],wtype:"양손검"
});
re(1125,"weapon",3, {
  atk:100,matk:0,def:0,wlv:2,elv:14
}, {
  jobs:["merchant","swordsman","thief"],wtype:"검"
});
re(1127,"weapon",3, {
  atk:115,matk:0,def:0,wlv:3,elv:27
}, {
  jobs:["merchant","swordsman","thief"],wtype:"검"
});
re(1128,"weapon",2, {
  atk:120,matk:0,def:0,wlv:3,elv:27
}, {
  jobs:["merchant","swordsman","thief"],wtype:"검"
});
re(1135,"weapon",0, {
  atk:150,matk:0,def:0,wlv:4,elv:40
}, {
  jobs:["merchant","swordsman","thief"],wtype:"검"
});
re(1189,"weapon",3, {
  atk:200,matk:0,def:0,wlv:2,elv:50
}, {
  jobs:["swordsman"],wtype:"양손검"
});
re(1258,"weapon",0, {
  atk:105,matk:0,def:0,wlv:3,elv:55
}, {
  jobs:["thief"],wtype:"단검"
});
re(1207,"weapon",2, {
  atk:43,matk:0,def:0,wlv:1,elv:1
});
re(1408,"weapon",2, {
  atk:60,matk:0,def:0,wlv:1,elv:4
});
re(1613,"weapon",0, {
  atk:130,matk:100,def:0,wlv:3,elv:24
});
re(1133,"weapon",0, {
  atk:100,matk:0,def:0,wlv:4,elv:40
});
re(1517,"weapon",1, {
  atk:130,matk:0,def:0,wlv:3,elv:27
}, {
  jobs:["acolyte","merchant"],wtype:"클럽"
});
re(13046,"weapon",3, {
  atk:110,matk:0,def:0,wlv:2,elv:50
}, {
  jobs:["thief"],wtype:"단검"
});
re(1477,"weapon",0, {
  atk:170,matk:0,def:0,wlv:4,elv:75
}, {
  jobs:["swordsman"],wtype:"양손창"
});
re(1234,"weapon",0, {
  atk:50,matk:0,def:0,wlv:4,elv:36
}, {
  jobs:["thief","ninja"],wtype:"단검"
});
re(1525,"weapon",0, {
  atk:135,matk:0,def:0,wlv:4,elv:40
}, {
  jobs:["acolyte"],wtype:"클럽"
});
re(1648,"weapon",0, {
  atk:30,matk:170,def:0,wlv:4,elv:50
}, {
  jobs:["mage"],wtype:"롯드"
});
re(2213,"head_top",0, {
  atk:0,matk:0,def:2
});
re(2220,"head_top",0, {
  atk:0,matk:0,def:2
});
re(2221,"head_top",1, {
  atk:0,matk:0,def:2
});
re(2226,"head_top",0, {
  atk:0,matk:0,def:4
});
re(2207,"head_top",0, {
  atk:0,matk:0,def:0
});
re(2272,"head_top",0, {
  atk:0,matk:0,def:1
});
re(2289,"head_top",0, {
  atk:0,matk:0,def:0
});
re(2254,"head_top",0, {
  atk:0,matk:0,def:2
});
re(2255,"head_top",0, {
  atk:0,matk:0,def:3
});
re(2282,"head_top",0, {
  atk:0,matk:0,def:0
});
re(2268,"head_low",0, {
  atk:0,matk:0,def:0
});
re(2248,"head_top",0, {
  atk:0,matk:0,def:3
});
re(2308,"armor",1, {
  atk:0,matk:0,def:4
});
re(2329,"armor",1, {
  atk:0,matk:0,def:4
}, {
  jobs:["swordsman","merchant"]
});
re(2324,"armor",1, {
  atk:0,matk:0,def:4
}, {
  jobs:["acolyte"]
});
re(2211,"head_top",0, {
  atk:0,matk:0,def:1
});
re(5019,"head_top",0, {
  atk:0,matk:0,def:5
});
re(2333,"armor",1, {
  atk:0,matk:0,def:4
}, {
  jobs:["mage"]
});
re(2336,"armor",1, {
  atk:0,matk:0,def:6
}, {
  jobs:["thief","ninja"]
});
re(2102,"shield",1, {
  atk:0,matk:0,def:3
});
re(2116,"shield",1, {
  atk:0,matk:0,def:3,elv:20
});
re(2209,"head_top",1, {
  atk:0,matk:0,def:1
});
re(2246,"head_top",0, {
  atk:0,matk:0,def:5,elv:40
});
re(2247,"head_top",0, {
  atk:0,matk:0,def:3
});
re(2250,"head_top",0, {
  atk:0,matk:0,def:1
});
re(2257,"head_top",0, {
  atk:0,matk:0,def:2
});
re(2298,"head_top",0, {
  atk:0,matk:0,def:2
});
re(2262,"head_low",0, {
  atk:0,matk:0,def:0
});
re(2303,"armor",0, {
  atk:0,matk:0,def:2
});
re(2304,"armor",1, {
  atk:0,matk:0,def:2
});
re(2302,"armor",1, {
  atk:0,matk:0,def:1
});
re(2306,"armor",1, {
  atk:0,matk:0,def:3
});
re(2355,"armor",1, {
  atk:0,matk:0,def:4,elv:40
});
re(2420,"shoes",1, {
  atk:0,matk:0,def:2,elv:25
});
re(2610,"acc",0, {
  atk:0,matk:0,def:0
});
re(2244,"head_top",0, {
  atk:0,matk:0,def:1
});
re(2245,"head_top",0, {
  atk:0,matk:0,def:3
});
re(1405,"weapon",3, {
  atk:44,matk:0,def:0,wlv:1,elv:4
}, {
  jobs:["swordsman"],wtype:"창"
});
re(1460,"weapon",2, {
  atk:150,matk:0,def:0,wlv:3,elv:33
}, {
  jobs:["swordsman"],wtype:"양손창"
});
re(2205,"head_mid",0, {
  atk:0,matk:0,def:1
});
re(1505,"weapon",4, {
  atk:37,matk:0,def:0,wlv:1,elv:2
}, {
  jobs:["acolyte","merchant","swordsman"],wtype:"클럽"
});
re(1708,"weapon",3, {
  atk:50,matk:0,def:0,wlv:2,elv:18
}, {
  jobs:["archer","thief"],wtype:"활"
});
re(1214,"weapon",3, {
  atk:73,matk:0,def:0,wlv:2,elv:12
}, {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
re(1216,"weapon",2, {
  atk:87,matk:0,def:0,wlv:2,elv:12
});
re(1217,"weapon",3, {
  atk:87,matk:0,def:0,wlv:2,elv:12
}, {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
re(1219,"weapon",2, {
  atk:105,matk:0,def:0,wlv:3,elv:24
});
re(1220,"weapon",3, {
  atk:105,matk:0,def:0,wlv:3,elv:24
}, {
  jobs:["archer","mage","merchant","ninja","swordsman","thief"],wtype:"단검"
});
re(2264,"head_top",0, {
  atk:0,matk:0,def:5
});
re(5046,"head_top",0, {
  atk:0,matk:0,def:5
});
re(2277,"head_top",0, {
  atk:0,matk:0,def:2
}, {
  jobs:["acolyte"]
});
re(5008,"head_top",0, {
  atk:0,matk:0,def:1
});
re(2274,"head_top",0, {
  atk:0,matk:0,def:0
});
re(2305,"armor",0, {
  atk:0,matk:0,def:3
});
re(2337,"armor",0, {
  atk:0,matk:0,def:7,elv:50
}, {
  jobs:["thief","ninja"]
});
re(2504,"garment",1, {
  atk:0,matk:0,def:2
});
re(2404,"shoes",1, {
  atk:0,matk:0,def:2
});
re(2406,"shoes",1, {
  atk:0,matk:0,def:4
}, {
  jobs:["swordsman","archer","thief","merchant","taekwon","gunslinger"]
});
re(2609,"acc",0, {
  atk:0,matk:0,def:0
});
re(2503,"garment",1, {
  atk:0,matk:0,def:1
});
re(2405,"shoes",1, {
  atk:0,matk:0,def:4
});
re(1604,"weapon",2, {
  atk:25,matk:15,def:0,wlv:1,elv:1
});
re(2607,"acc",1, {
  atk:0,matk:0,def:0
});
re(1704,"weapon",2, {
  atk:29,matk:0,def:0,wlv:1,elv:4
});
re(13104,"weapon",1, {
  atk:50,matk:0,def:0,wlv:1,elv:1
});
re(2201,"head_mid",0, {
  atk:0,matk:0,def:0
});
re(1610,"weapon",1, {
  atk:35,matk:45,def:0,wlv:3,elv:24
});
re(2103,"shield",1, {
  atk:0,matk:0,def:2
});
re(2505,"garment",1, {
  atk:0,matk:0,def:4
});
re(2605,"acc",0, {
  atk:0,matk:0,def:0
});
re(1304,"weapon",0, {
  atk:75,matk:0,def:0,wlv:3,elv:24
});
re(2212,"head_mid",0, {
  atk:0,matk:0,def:0
});
re(2608,"acc",0, {
  atk:0,matk:0,def:0
});
re(1351,"weapon",2, {
  atk:80,matk:0,def:0,wlv:2,elv:14
});
re(13151,"weapon",1, {
  atk:40,matk:0,def:0,wlv:2,elv:1
});
re(2107,"shield",1, {
  atk:0,matk:0,def:4
});
re(1110,"weapon",2, {
  atk:70,matk:0,def:0,wlv:2,elv:14
}, {
  jobs:["swordsman","thief"],wtype:"검"
});
re(1152,"weapon",3, {
  atk:90,matk:0,def:0,wlv:2,elv:18
}, {
  jobs:["swordsman"],wtype:"양손검"
});
re(1407,"weapon",3, {
  atk:60,matk:0,def:0,wlv:1,elv:4
}, {
  jobs:["swordsman"],wtype:"창"
});
re(1309,"weapon",4, {
  atk:75,matk:0,def:0,wlv:3,elv:3
}, {
  jobs:["merchant","swordsman"],wtype:"도끼"
});
re(1355,"weapon",3, {
  atk:120,matk:0,def:0,wlv:2,elv:16
}, {
  jobs:["merchant"],wtype:"양손도끼"
});
re(2104,"shield",1, {
  atk:0,matk:0,def:4
});
re(1511,"weapon",3, {
  atk:69,matk:0,def:0,wlv:2,elv:14
}, {
  jobs:["acolyte","merchant"],wtype:"클럽"
});
re(1210,"weapon",2, {
  atk:59,matk:0,def:0,wlv:2,elv:12
}, {
  jobs:["thief"],wtype:"단검"
});
re(1607,"weapon",2, {
  atk:40,matk:70,def:0,wlv:2,elv:12
}, {
  jobs:["mage","acolyte"],wtype:"롯드"
});
re(1711,"weapon",3, {
  atk:65,matk:0,def:0,wlv:2,elv:18
}, {
  jobs:["archer"],wtype:"활"
});
re(13007,"weapon",0, {
  atk:70,matk:0,def:0,wlv:2,elv:35
}, {
  jobs:["ninja"],wtype:"단검"
});
re(13150,"weapon",3, {
  atk:50,matk:0,def:0,wlv:1,elv:1
}, {
  jobs:["gunslinger"],wtype:"라이플"
});
re(1806,"weapon",3, {
  atk:65,matk:0,def:0,wlv:2,elv:12
}, {
  jobs:["taekwon"]
});
const $U= {
  swordsman:[1110,1152,1407,2104],merchant:[1309,1355,2104],thief:[1210,1110],mage:[1607],acolyte:[1607,1511],archer:[1711],ninja:[13007],gunslinger:[13150],taekwon:[1806]
},_W= {
  swordsman:[1101,2101,2301],mage:[1601,2301],archer:[1701,2301],acolyte:[1501,2301],thief:[1201,2301],merchant:[1301,2301],taekwon:[2301],ninja:[1201,2301],gunslinger:[13101,2301]
},bW= {
  archer:"arco",hunter:"arco",gunslinger:"arma de fuego"
},qA={};
function Me(a,e,t,n) {
  qA[a]= {
    id:a,monster:e,compound:t,bonuses:n
  }
}
Me(4001,"poring","armor",[ut(.03),Ee(.02)]);
Me(4006,"lunatic","garment",[Ee(.03),ut(.02)]);
Me(4002,"fabre","armor",[Ge(30)]);
Me(4004,"drops","accessory",[rn(.06),X(.03)]);
Me(4009,"chonchon","garment",[gt(.05)]);
Me(4021,"rocker","accessory",[X(.04)]);
Me(4010,"willow","headgear",[tt(.05)]);
Me(4015,"condor","accessory",[ut(.05)]);
Me(4022,"spore","armor",[lt(2)]);
Me(4033,"poporing","headgear",[ma(.5)]);
Me(4017,"savage_babe","weapon",[Js(.05)]);
Me(4044,"smokie","accessory",[rl(.12),gt(.03)]);
Me(4029,"wolf","weapon",[X(.06),Ee(.02)]);
Me(4066,"orc_warrior","shield",[ct(.08)]);
Me(4060,"goblin","weapon",[X(.08)]);
Me(4091,"kobold","weapon",[Ee(.05)]);
Me(4038,"zombie","armor",[ma(1)]);
Me(4085,"orc_skeleton","weapon",[La(.12)]);
Me(4054,"angeling","armor",[Ge(60),lt(2)]);
Me(4174,"deviling","garment",[ct(.12)]);
Me(4047,"ghostring","armor",[ut(.12),ma(-.5)]);
Me(4123,"eddga","shoes",[gt(.12),lt(2)]);
Me(4143,"orc_hero","headgear",[lt(3),Ge(40)]);
Me(4144,"osiris","accessory",[NA(1)]);
Me(4147,"baphomet","weapon",[Ut(.2),X(.1)]);
Me(4003,"pupa","armor",[Ge(40)]);
Me(4008,"picky","armor",[X(.03),Ge(10)]);
Me(4007,"peco_egg","armor",[ct(.03)]);
Me(4012,"thief_bug_egg","armor",[Ge(25),lt(1)]);
Me(4019,"hornet","weapon",[X(.03),Ee(.01)]);
Me(4020,"familiar","weapon",[Js(.03)]);
Me(4023,"baby_desert_wolf","weapon",[tt(.03)]);
Me(4024,"plankton","weapon",[Js(.04)]);
Me(4266,"eclipse","garment",[Ge(50),lt(1)]);
Me(4211,"vocal","headgear",[gt(.06),ut(.03)]);
Me(4197,"mastering","accessory",[ut(.06),Ee(.03)]);
Me(4128,"golden_thief_bug","shield",[ct(.15)]);
Me(4016,"thief_bug","armor",[ut(.03)]);
Me(4026,"thief_bug_female","weapon",[Ee(.02),X(.02)]);
Me(4014,"roda_frog","armor",[Ge(40)]);
Me(4040,"creamy","accessory",[gt(.04),ut(.02)]);
Me(4030,"mandragora","weapon",[X(.05)]);
Me(4306,"toad","garment",[ut(.05)]);
Me(4179,"dragon_fly","garment",[_u(1),ut(.02)]);
Me(4028,"tarou","accessory",[Id(2)]);
Me(4069,"drainliar","weapon",[X(.05)]);
Me(4296,"cramp","headgear",[mo(.12)]);
Me(4027,"kukre","accessory",[_u(2)]);
Me(4055,"marina","weapon",[Js(.05),X(.02)]);
Me(4035,"hydra","weapon",[X(.05)]);
Me(4102,"whisper","garment",[ut(.08),ct(-.04)]);
Me(4314,"penomena","shield",[ct(.06)]);
Me(4089,"sword_fish","armor",[lt(1),ct(.03)]);
Me(4073,"pirate_skel","accessory",[mo(.15)]);
Me(4137,"drake","weapon",[ls(.15),X(.05)]);
Me(4049,"vadon","weapon",[X(.05)]);
Me(4061,"cornutus","armor",[lt(1),ct(.03)]);
Me(4095,"marse","garment",[ut(.05)]);
Me(4077,"phen","accessory",[tt(.04)]);
Me(4093,"obeaune","accessory",[Ge(25)]);
Me(4084,"marine_sphere","accessory",[Ut(.05)]);
Me(4199,"merman","accessory",[ma(.6)]);
Me(4125,"deviace","weapon",[X(.06)]);
Me(4111,"strouf","weapon",[ls(.08)]);
Me(4524,"king_dramoh","headgear",[Id(2)]);
Me(4525,"kraken","garment",[ut(.08),Ee(.03)]);
Me(4037,"snake","weapon",[Ee(.03),X(.02)]);
Me(4034,"worm_tail","accessory",[Ov(2)]);
Me(4048,"poison_spore","accessory",[Id(2)]);
Me(4052,"elder_willow","headgear",[Mp(2)]);
Me(4074,"bigfoot","shield",[ct(.05)]);
Me(4098,"dokebi","armor",[ut(.04),gt(.02)]);
Me(4159,"nine_tail","garment",[_u(2),ut(.05)]);
Me(4283,"greatest_general","accessory",[Ge(30),lt(1)]);
Me(4178,"dragon_tail","garment",[gt(.04)]);
Me(4183,"vagabond_wolf","garment",[Id(1),X(.04)]);
Me(4131,"moonlight","shoes",[gt(.08),vu(.6)]);
Me(4025,"skeleton","weapon",[X(.04),Js(.02)]);
Me(4094,"skel_archer","weapon",[rn(.08),X(.02)]);
Me(4086,"skel_soldier","weapon",[Ee(.05)]);
Me(4090,"munak","shield",[lt(2)]);
Me(4212,"bon_gun","accessory",[Hv(2)]);
Me(4100,"sohee","shoes",[tt(.04),Ge(15)]);
Me(4103,"horong","accessory",[Ut(.04)]);
Me(4221,"skeleton_general","shoes",[gt(.06),La(.05)]);
Me(4290,"cat_o_nine_tail","shoes",[Ge(50),ma(.5)]);
Me(4328,"hyegun","garment",[ct(.06),ut(.03)]);
const xW=Object.fromEntries(Object.values(qA).map(a=>[a.monster,a.id])),HA= {
  poring:[ {
    id:1202,rate:100
  }, {
    id:2102,rate:2
  }
  ],lunatic:[ {
    id:2262,rate:4
  }
  ],fabre:[ {
    id:1502,rate:80
  }
  ],pupa:[ {
    id:2102,rate:2
  }
  ],drops:[ {
    id:1602,rate:80
  }
  ],picky:[ {
    id:2302,rate:150
  }
  ],peco_egg:[ {
    id:2102,rate:2
  }
  ],condor:[ {
    id:1702,rate:150
  }
  ],savage_babe:[ {
    id:1302,rate:100
  }
  ],hornet:[ {
    id:1208,rate:15
  }
  ],thief_bug_egg:[ {
    id:2102,rate:2
  }
  ],baby_desert_wolf:[ {
    id:2306,rate:80
  }, {
    id:13011,rate:5
  }
  ],rocker:[ {
    id:2298,rate:4
  }, {
    id:1402,rate:80
  }
  ],familiar:[ {
    id:1105,rate:20
  }, {
    id:2209,rate:15
  }
  ],eclipse:[ {
    id:2250,rate:200
  }, {
    id:2355,rate:1e3
  }
  ],vocal:[ {
    id:2247,rate:50
  }, {
    id:2420,rate:1e3
  }
  ],mastering:[ {
    id:5035,rate:500
  }, {
    id:2257,rate:200
  }, {
    id:2116,rate:1e3
  }
  ],creamy:[ {
    id:2321,rate:10
  }, {
    id:2207,rate:2
  }
  ],mandragora:[ {
    id:1405,rate:30
  }
  ],roda_frog:[ {
    id:2424,rate:15
  }
  ],toad:[ {
    id:2244,rate:50
  }, {
    id:2424,rate:30
  }
  ],dragon_fly:[ {
    id:2245,rate:200
  }, {
    id:2607,rate:3e3
  }
  ],tarou:[ {
    id:2288,rate:20
  }
  ],drainliar:[ {
    id:2286,rate:15
  }
  ],cramp:[ {
    id:2616,rate:10
  }
  ],plankton:[ {
    id:2615,rate:10
  }
  ],tarou_bite:[ {
    id:2292,rate:150
  }, {
    id:2627,rate:100
  }, {
    id:2620,rate:50
  }
  ],tarou_plague:[ {
    id:2292,rate:150
  }, {
    id:2627,rate:100
  }, {
    id:2620,rate:50
  }
  ],tarou_burrow:[ {
    id:2292,rate:150
  }, {
    id:2627,rate:100
  }, {
    id:2620,rate:50
  }
  ],thief_bug:[ {
    id:2303,rate:120
  }, {
    id:2304,rate:80
  }
  ],thief_bug_female:[ {
    id:1108,rate:15
  }
  ],golden_thief_bug:[ {
    id:1524,rate:150
  }, {
    id:2246,rate:250
  }, {
    id:2610,rate:2e3
  }
  ],kukre:[ {
    id:2503,rate:80
  }, {
    id:2405,rate:40
  }
  ],marina:[ {
    id:1604,rate:60
  }, {
    id:2607,rate:30
  }
  ],hydra:[ {
    id:1704,rate:50
  }, {
    id:13104,rate:30
  }, {
    id:2201,rate:30
  }
  ],whisper:[ {
    id:2333,rate:10
  }
  ],penomena:[ {
    id:2308,rate:150
  }, {
    id:2505,rate:150
  }, {
    id:2406,rate:100
  }
  ],sword_fish:[ {
    id:1117,rate:25
  }, {
    id:2257,rate:2
  }
  ],pirate_skel:[ {
    id:2211,rate:250
  }, {
    id:1104,rate:250
  }, {
    id:2287,rate:15
  }
  ],ghostring:[ {
    id:2274,rate:100
  }, {
    id:2336,rate:50
  }
  ],drake:[ {
    id:1125,rate:950
  }, {
    id:1127,rate:600
  }, {
    id:1128,rate:400
  }, {
    id:5019,rate:350
  }, {
    id:1135,rate:150
  }, {
    id:1189,rate:100
  }
  ],vadon:[ {
    id:2104,rate:10
  }
  ],cornutus:[ {
    id:2102,rate:15
  }
  ],marse:[ {
    id:2205,rate:20
  }
  ],obeaune:[ {
    id:2607,rate:20
  }
  ],phen:[ {
    id:2424,rate:15
  }
  ],marine_sphere:[ {
    id:2605,rate:5
  }
  ],merman:[ {
    id:1460,rate:20
  }, {
    id:2205,rate:10
  }
  ],deviace:[ {
    id:2205,rate:300
  }, {
    id:2424,rate:150
  }, {
    id:2505,rate:100
  }
  ],strouf:[ {
    id:1460,rate:200
  }, {
    id:2424,rate:150
  }, {
    id:2603,rate:100
  }
  ],king_dramoh:[ {
    id:2235,rate:150
  }, {
    id:2104,rate:300
  }, {
    id:2603,rate:100
  }
  ],kraken:[ {
    id:2205,rate:500
  }, {
    id:2509,rate:250
  }, {
    id:1460,rate:200
  }, {
    id:2235,rate:100
  }
  ],willow:[ {
    id:1610,rate:50
  }, {
    id:2103,rate:60
  }
  ],nine_tail:[ {
    id:2505,rate:50
  }, {
    id:2605,rate:30
  }, {
    id:1711,rate:40
  }
  ],spore:[ {
    id:2220,rate:40
  }
  ],poporing:[ {
    id:1207,rate:5
  }
  ],snake:[ {
    id:1117,rate:15
  }
  ],worm_tail:[ {
    id:1408,rate:30
  }
  ],poison_spore:[ {
    id:2221,rate:20
  }
  ],wolf:[ {
    id:2308,rate:10
  }
  ],smokie:[ {
    id:2213,rate:1
  }
  ],elder_willow:[ {
    id:2329,rate:30
  }
  ],bigfoot:[ {
    id:2289,rate:5
  }
  ],greatest_general:[ {
    id:2272,rate:1
  }
  ],dokebi:[ {
    id:1517,rate:2
  }, {
    id:1613,rate:1
  }
  ],dragon_tail:[ {
    id:2207,rate:8
  }, {
    id:2226,rate:2
  }
  ],angeling:[ {
    id:2254,rate:100
  }, {
    id:2324,rate:60
  }, {
    id:2282,rate:1
  }
  ],deviling:[ {
    id:2255,rate:100
  }
  ],vagabond_wolf:[ {
    id:2248,rate:200
  }
  ],moonlight:[ {
    id:1525,rate:150
  }, {
    id:1234,rate:100
  }, {
    id:1648,rate:100
  }, {
    id:1477,rate:50
  }
  ],eddga:[ {
    id:2268,rate:250
  }, {
    id:1258,rate:500
  }, {
    id:1133,rate:150
  }, {
    id:13046,rate:100
  }
  ],zombie:[ {
    id:2212,rate:30
  }, {
    id:2608,rate:30
  }
  ],horong:[ {
    id:1351,rate:40
  }, {
    id:13151,rate:30
  }, {
    id:2107,rate:20
  }
  ],skeleton:[ {
    id:1505,rate:80
  }, {
    id:2609,rate:30
  }
  ],skel_archer:[ {
    id:1708,rate:35
  }, {
    id:2285,rate:3
  }
  ],skel_soldier:[ {
    id:1216,rate:50
  }, {
    id:1214,rate:12
  }
  ],munak:[ {
    id:2305,rate:100
  }, {
    id:2404,rate:15
  }, {
    id:2264,rate:2
  }, {
    id:2337,rate:1
  }
  ],bon_gun:[ {
    id:5046,rate:1
  }
  ],sohee:[ {
    id:2504,rate:5
  }, {
    id:1217,rate:5
  }, {
    id:2277,rate:1
  }
  ],skeleton_general:[ {
    id:1219,rate:80
  }, {
    id:1220,rate:35
  }, {
    id:2274,rate:1
  }
  ],cat_o_nine_tail:[ {
    id:1234,rate:150
  }, {
    id:5008,rate:1
  }, {
    id:2603,rate:100
  }
  ],hyegun:[ {
    id:2406,rate:1
  }
  ]
};
for(const {
  id:a
}
of Object.values(HA).flat())gs[a]&&(gs[a].bonuses=[]);
const YU= {
  apply:()=>{},text:()=>Pt("★ Secreto")
},Bd=(a,e,t,n={})=>Q(a,e,0,[YU], {
  base:t,secret:!0,rare:!0,...n
});
Bd(1413,"weapon", {
  atk:200,matk:0,def:0,wlv:4,elv:1
}, {
  jobs:["swordsman"],wtype:"창"
});
Bd(1530,"weapon", {
  atk:250,matk:0,def:0,wlv:4,elv:1
}, {
  jobs:["acolyte","merchant","swordsman"],wtype:"클럽"
});
Bd(2357,"armor", {
  atk:0,matk:0,def:9,elv:1
});
Bd(2410,"shoes", {
  atk:0,matk:0,def:4,elv:1
});
Bd(2629,"acc", {
  atk:0,matk:0,def:0,elv:1
});
Bd(2630,"acc", {
  atk:0,matk:0,def:0,elv:1
});
var LM;
for(const {
  id:a
}
of Object.values(HA).flat())if((LM=gs[a])!=null&&LM.secret)throw new Error(`pieza secreta ${a} en el botín de un monstruo`);
var DM;
for(const a of Object.values($U).flat())if((DM=gs[a])!=null&&DM.secret)throw new Error(`pieza secreta ${a} en las armas de historia`);
const wW=a=> {
  var e;
  return!!((e=gs[a])!=null&&e.secret)
},XU= {
  str:[Id,1],agi:[_u,1],vit:[Hv,1],int:[Mp,1],dex:[Ov,1],luk:[BA,1],crit:[Ee,.01],flee:[ut,.01],cd:[tt,.01],spd:[gt,.01],area:[Ut,.01],cast:[Ys,.01],hp:[Ge,5],armor:[lt,.4],dr:[ct,.01],regen:[ma,.1],critDmg:[zt,.03],stun:[Js,.01],boss:[La,.03],dot:[FA,.03],reach:[id,.02],proj:[rn,.03],zeny:[mo,.03],pickup:[rl,.03],potion:[Dd,.05],lowHp:[Zr,.03]
},KU= {
  1202:["cd"],1207:["flee"],1208:["flee"],1214:["crit"],1216:["crit"],1217:["crit"],1219:["critDmg"],1220:["critDmg"],1234:["cd"],13011:["int"],13046:["dot"],1104:["area"],1105:["area"],1108:["armor"],1117:["crit"],1125:["cd"],1127:["spd"],1128:["int"],1133:["dot"],1135:["str","armor"],1189:["str"],1258:["dot"],1302:["str"],1351:["area"],1402:["proj"],1408:["reach"],1477:["boss"],1502:["stun"],1505:["critDmg"],1517:["str"],1524:["boss"],1525:["reach"],1602:["cast"],1604:["int"],1610:["int"],1613:["str"],1648:["int","dex"],1702:["proj"],1704:["cd"],1708:["critDmg"],1711:["dex"],13104:["critDmg"],13151:["crit"],2102:["armor"],2103:["hp"],2107:["dr"],2116:["regen"],2201:["flee"],2207:["dr"],2209:["dr"],2211:["hp"],2212:["crit"],2213:["spd"],2220:["hp"],2221:["hp"],2226:["armor"],2246:["armor","zeny"],2247:["luk"],2248:["dex"],2250:["cd"],2254:["agi","luk"],2255:["str"],2257:["regen"],2262:["luk"],2264:["dr"],2268:["dr"],2272:["stun"],2274:["agi"],2277:["potion"],2282:["dr"],2285:["dex"],2287:["str"],2289:["dr"],2298:["pickup"],5008:["regen"],5019:["vit"],5046:["vit"],2302:["hp"],2303:["armor"],2304:["armor"],2305:["spd"],2306:["spd"],2308:["flee"],2324:["regen"],2329:["armor"],2333:["cast"],2336:["agi"],2337:["agi"],2355:["dr"],2404:["spd"],2405:["armor"],2406:["armor"],2420:["hp"],2503:["regen"],2504:["regen"],2505:["dr"],2603:["vit"],2605:["agi"],2607:["cd"],2608:["luk"],2609:["lowHp"],2610:["zeny"],1405:["reach"],1460:["area"],2104:["hp"],2205:["armor"],2235:["int"],2244:["dr"],2245:["luk"],2286:["dex"],2288:["stun"],2292:["dr"],2321:["dr"],2424:["regen"],2509:["vit"],2615:["armor"],2616:["crit"],2620:["flee"],2627:["hp"],5035:["luk"]
},fx=new Map;
function MW(a,e) {
  const t=KU[a];
  if(!t)return[];
  const n=DA(e).mult,s=`${a}:${n}`;
  let o=fx.get(s);
  return o||(o=t.map(r=> {
    const[i,l]=XU[r],d=i(l*n);return {
      apply:d.apply,text:c=>`★ ${d.text(c)}`
    }
  }),fx.set(s,o)),o
}
const gx=Math.log(2),JU=Math.log(2e3),QU=.05,ZU=4,SW=a=>Math.floor(ZU*a+1e-6);
function AW(a,e,t) {
  var o;
  const n=(o=gs[a])==null?void 0:o.base;
  if(t&&n&&(n.atk||n.matk))return QU;
  const s=Math.min(1,Math.max(0,(Math.log(e)-gx)/(JU-gx)));
  return t?.1+.05*s:15e-5+15e-5*s
}
async function eq(a) {
  if(typeof DecompressionStream>"u")return null;
  const e=new Uint8Array(a),t=new DataView(a);
  if(e.length<33||t.getUint32(0)!==2303741511)return null;
  let n=0,s=0;
  const o=[];
  let r=8;
  for(;r+8<=e.length;) {
    const h=t.getUint32(r),m=String.fromCharCode(e[r+4],e[r+5],e[r+6],e[r+7]),p=e.subarray(r+8,r+8+h);
    if(m==="IHDR") {
      if(n=t.getUint32(r+8),s=t.getUint32(r+12),p[8]!==8||p[9]!==6||p[12]!==0)return null
    }
    else if(m==="IDAT")o.push(p);
    else if(m==="IEND")break;
    r+=12+h
  }
  if(!n||!s||!o.length)return null;
  const i=new Blob(o).stream().pipeThrough(new DecompressionStream("deflate")),l=new Uint8Array(await new Response(i).arrayBuffer()),d=n*4;
  if(l.length<(d+1)*s)return null;
  const c=new Uint8ClampedArray(d*s);
  let u=new Uint8Array(d);
  for(let h=0;h<s;h++) {
    const m=l[h*(d+1)],p=l.subarray(h*(d+1)+1,(h+1)*(d+1)),g=new Uint8Array(d);
    for(let y=0;y<d;y++) {
      const f=y>=4?g[y-4]:0,v=u[y],b=y>=4?u[y-4]:0;
      let _=p[y];
      switch(m) {
        case 1:_+=f;
        break;
        case 2:_+=v;
        break;
        case 3:_+=f+v>>1;
        break;
        case 4: {
          const S=f+v-b,M=Math.abs(S-f),k=Math.abs(S-v),C=Math.abs(S-b);
          _+=M<=k&&M<=C?f:k<=C?v:b;
          break
        }
      }
      g[y]=_
    }
    c.set(g,h*d),u=g
  }
  return new ImageData(c,n,s)
}
const tq="assets/";
class aq {
  constructor(e,t) {
    x(this,"canvas");
    x(this,"frames");
    x(this,"textures");
    x(this,"actions");
    this.canvas=e,this.frames=t.frames.map(([s,o,r,i,l,d])=>( {
      x:s,y:o,w:r,h:i,ox:l,oy:d
    }));
    const n=qt.from(e,!0);
    n.source.scaleMode="nearest",this.textures=this.frames.map(s=>new qt( {
      source:n.source,frame:new sn(s.x,s.y,s.w,s.h),defaultAnchor: {
        x:s.ox/s.w,y:s.oy/s.h
      }
    })),this.actions={};
    for(const[s,o]of Object.entries(t.actions))this.actions[s]= {
      delay:Math.max(30,o.delay),dirs:o.dirs
    }
  }
  action(e) {
    return this.actions[e]??this.actions.idle
  }
}
const dc=new Map,nq=5e3,Lh=new Map,sq=Z2(2);
async function yx(a) {
  try {
    const e=await fetch(a);
    if(e.ok) {
      const t=await eq(await e.arrayBuffer());
      if(t)return t
    }
  }
  catch{}return oq(a)
}
function oq(a) {
  return new Promise((e,t)=> {
    const n=new Image;n.onload=()=> {
      const s=document.createElement("canvas");s.width=n.width,s.height=n.height;const o=s.getContext("2d", {
        willReadFrequently:!0
      });o.drawImage(n,0,0);const r=o.getImageData(0,0,n.width,n.height);s.width=s.height=0,n.onload=n.onerror=null,n.src="",e(r)
    },n.onerror=()=>t(new Error(`No se pudo cargar ${a}`)),n.src=a
  })
}
function rq(a) {
  let e=dc.get(a);
  if(e!=null&&e.timer&&clearTimeout(e.timer),!e) {
    const n=(async()=> {
      const s=tq+a,o=s.slice(0,s.lastIndexOf("/")+1),r=await(await fetch(s)).json(),[i,l]=await Promise.all([yx(o+r.image),yx(o+r.palette)]);return {
        json:r,indices:i,palettes:l
      }
    })();
    e= {
      p:n,timer:null
    },dc.set(a,e),n.catch(()=>dc.delete(a))
  }
  const t=e;
  return t.timer=setTimeout(()=>dc.get(a)===t&&dc.delete(a),nq),t.p
}
function m0(a,e) {
  const t=`${a}#${e}`,n=Lh.get(t);
  if(n instanceof Promise)return n;
  const s=n==null?void 0:n.deref();
  if(s)return Promise.resolve(s);
   {
    const o=sq(()=>rq(a).then(( {
      json:r,indices:i,palettes:l
    })=> {
      const d=Math.min(Math.max(0,e),l.height-1)*256*4,c=l.data,u=i.data,h=new ImageData(i.width,i.height),m=h.data;for(let y=0;y<u.length;y+=4) {
        if(u[y+3]===0)continue;const f=d+u[y]*4;m[y]=c[f],m[y+1]=c[f+1],m[y+2]=c[f+2],m[y+3]=255
      }
      const p=document.createElement("canvas");p.width=h.width,p.height=h.height,p.getContext("2d").putImageData(h,0,0);const g=new aq(p,r);return Lh.set(t,new WeakRef(g)),g
    }));
    return Lh.set(t,o),o.catch(()=>Lh.delete(t)),o
  }
}
const iq=new Set(["창","양손창"]);
function vx(a,e) {
  var t;
  return!!((t=a.actions[e])!=null&&t.dirs.some(n=>n.some(([s])=> {
    var o,r;return s>=0&&(((o=a.frames[s])==null?void 0:o.w)??0)*(((r=a.frames[s])==null?void 0:r.h)??0)>16
  })))
}
function _x(a) {
  if(!a.weapon)return"attack";
  const[e,t]=iq.has(a.weaponType??"")?["attack3","attack2"]:["attack2","attack3"];
  return vx(a.weapon,e)||!vx(a.weapon,t)?e:t
}
const kW=new Set(["merchant","blacksmith","alchemist"]);
function OA(a) {
  return a.endsWith("_peco")&&!xt.manifest.characters.bodies[a]?a.slice(0,-5):a
}
function EW(a) {
  return Math.min(4,Math.max(0,Math.floor((a-1)/20)))
}
function Gv(a,e) {
  var t;
  return(t=xt.manifest.characters.bodies[OA(a)])==null?void 0:t[e]
}
function jA() {
  return xt.manifest.characters.dyes??[]
}
function CW(a,e) {
  var n;
  const t=((n=Gv(a,e))==null?void 0:n.palettes)??1;
  return[...Array(t).keys(),...jA().filter(s=>s.creation).map(s=>s.row)]
}
function TW(a,e,t) {
  var n;
  return t<(((n=Gv(a,e))==null?void 0:n.palettes)??1)||jA().some(s=>s.row===t)
}
function lq(a,e) {
  var t;
  return(t=xt.manifest.characters.heads[a])==null?void 0:t[String(e)]
}
function PW(a) {
  return Object.keys(xt.manifest.characters.heads[a]??{}).map(Number).sort((e,t)=>e-t)
}
const bx=["단검","검","도끼"];
function dq(a,e,t,n) {
  var l,d,c,u,h,m;
  const s=(l=gs[t])==null?void 0:l.wtype,o=n?(d=gs[n])==null?void 0:d.wtype:void 0;
  if(!s||!o)return;
  const[r,i]=[s,o].sort((p,g)=>bx.indexOf(p)-bx.indexOf(g));
  return(m=(h=(u=(c=xt.manifest.equipment)==null?void 0:c.dual)==null?void 0:u[a])==null?void 0:h[e])==null?void 0:m[`${r}_${i}`]
}
async function RW(a,e,t={}) {
  var y,f,v,b,_;
  const n=Gv(a,e.gender),s=lq(e.gender,e.hair);
  if(!n||!s)throw new Error(`Apariencia no disponible: ${a} ${e.gender} pelo ${e.hair}`);
  const o=xt.manifest.equipment,r=e.gender;
  a=OA(a);
  const i=S=>S?m0(S,0):Promise.resolve(void 0),l=[t.headLow,t.headMid,t.headTop],d=xt.manifest.carts??[],[c,u,h,m,p,...g]=await Promise.all([m0(n.json,e.cloth),m0(s.json,e.hairColor),i(t.weapon?dq(a,r,t.weapon,t.offhand)??((f=(y=o==null?void 0:o.weapons[a])==null?void 0:y[r])==null?void 0:f[t.weapon]):void 0),i(t.shield?(b=(v=o==null?void 0:o.shields[a])==null?void 0:v[r])==null?void 0:b[t.shield]:void 0),i(t.cart!==void 0?d[Math.min(t.cart,d.length-1)]:void 0),...l.map(S=> {
    var M;return i(S?(M=o==null?void 0:o.headgear[S])==null?void 0:M[r]:void 0)
  })]);
  return {
    body:c,head:u,weapon:h,shield:m,cart:p,weaponType:t.weapon?(_=gs[t.weapon])==null?void 0:_.wtype:void 0,headgear:g.filter(S=>!!S)
  }
}
const cq=new Set([2,3,4,5]),uq=[[0,-16],[20,-10],[28,0],[20,10],[0,16],[-20,10],[-28,0],[-20,-10]],hq=new Set([3,4,5]);
function ld(a,e,t,n,s,o=!1) {
  n=Math.max(0,Math.floor(n));
  const r=e==="idle"||e==="sit",i=a.body.action(e),l=i.dirs[t%i.dirs.length],d=r?Math.min(s,l.length-1):n%l.length,[c,u,h]=l[d],m=(b,_)=> {
    const S=b.actions[e]??b.actions.idle;
    if(!S)return null;
    const M=S.dirs[t%S.dirs.length];
    if(!(M!=null&&M.length))return null;
    const k=r?Math.min(_?s:d,M.length-1):n%M.length,[C,A,w]=M[k];
    return _? {
      frame:C,x:u-A,y:h-w
    }
    : {
      frame:C,x:0,y:0
    }
  },p=[],g=(b,_,S)=> {
    if(!_)return;
    const M=m(_,S);
    M&&M.frame>=0&&p.push( {
      role:b,sheet:_,...M
    })
  },y=t%8;
  let f=null;
  if(a.cart) {
    const b=a.cart.action("walk").dirs[o?(y+4)%8:y],[_]=b[e==="walk"?n%b.length:0];
    if(_>=0) {
      const[S,M]=uq[y],k=hq.has(y)!==o,C=o?-1.5:1;
      f= {
        role:k?"cartFront":"cartBack",sheet:a.cart,frame:_,x:S*C,y:M*C
      }
    }
  }
  (f==null?void 0:f.role)==="cartBack"&&p.push(f);
  const v=cq.has(y);
  return v&&g("shieldBack",a.shield,!1),p.push( {
    role:"body",sheet:a.body,frame:c,x:0,y:0
  }),g("head",a.head,!0),a.headgear.forEach((b,_)=>g(`hg${_}`,b,!0)),g("weapon",a.weapon,!1),v||g("shieldFront",a.shield,!1),(f==null?void 0:f.role)==="cartFront"&&p.push(f), {
    layers:p,count:r?1:l.length,delay:i.delay
  }
}
function zW(a,e,t) {
  const n= {
    x0:1/0,y0:1/0,x1:-1/0,y1:-1/0
  };
  for(const s of e) {
    const o=ld(a,s,t,0,0).count;
    for(let r=0;r<o;r++)for(const i of ld(a,s,t,r,0).layers) {
      const l=i.sheet.frames[i.frame];
      l&&(n.x0=Math.min(n.x0,i.x-l.ox),n.y0=Math.min(n.y0,i.y-l.oy),n.x1=Math.max(n.x1,i.x-l.ox+l.w),n.y1=Math.max(n.y1,i.y-l.oy+l.h))
    }
  }
  return Number.isFinite(n.x0)?n: {
    x0:-20,y0:-90,x1:20,y1:0
  }
}
function LW(a,e,t,n,s,o,r,i=1) {
  const l=ld(e,t,n,s,0);
  for(const d of l.layers) {
    const c=d.sheet.frames[d.frame];
    c&&a.drawImage(d.sheet.canvas,c.x,c.y,c.w,c.h,Math.round(o+(d.x-c.ox)*i),Math.round(r+(d.y-c.oy)*i),c.w*i,c.h*i)
  }
  return l
}
const mq=["cartBack","shieldBack","body","head","hg0","hg1","hg2","weapon","shieldFront","cartFront"];
class pq extends ue {
  constructor(t) {
    super();
    x(this,"sheets");
    x(this,"sprites",new Map);
    x(this,"actionName","idle");
    x(this,"dir",0);
    x(this,"headDir",0);
    x(this,"time",0);
    x(this,"loop",!0);
    x(this,"speed",1);
    x(this,"finished",!1);
    x(this,"cartAhead",!1);
    this.sheets=t;
    for(const n of mq) {
      const s=new Ra;
      s.visible=!1,this.sprites.set(n,s),this.addChild(s)
    }
    this.refresh()
  }
  setSheets(t) {
    this.sheets=t,this.refresh()
  }
  play(t,n=!0,s=!1) {
    if(t===this.actionName&&!s) {
      this.loop=n;
      return
    }
    this.actionName=t,this.loop=n,this.time=0,this.finished=!1,this.refresh()
  }
  get duration() {
    const t=ld(this.sheets,this.actionName,this.dir,0,this.headDir);
    return t.count*t.delay
  }
  update(t) {
    this.time+=t*this.speed,this.refresh()
  }
  refresh() {
    const t=ld(this.sheets,this.actionName,this.dir,0,this.headDir);
    let n=Math.floor(this.time/t.delay);
    n>=t.count&&(this.loop?n%=t.count:(n=t.count-1,this.finished=!0));
    const {
      layers:s
    }
    =ld(this.sheets,this.actionName,this.dir,n,this.headDir,this.cartAhead);
    for(const o of this.sprites.values())o.visible=!1;
    for(const o of s) {
      const r=this.sprites.get(o.role),i=o.sheet.textures[o.frame];
      i&&(r.texture!==i&&(r.texture=i,r.anchor.copyFrom(i.defaultAnchor)),r.position.set(o.x,o.y),r.visible=!0)
    }
  }
}
let dd=2654435769,Hr=608135816,Eo=3084996962,Oi=1;
function DW(a) {
  dd=2654435769,Hr=608135816,Eo=3084996962^a>>>0,Oi=1;
  for(let e=0;e<15;e++)Wt()
}
function Wt() {
  dd>>>=0,Hr>>>=0,Eo>>>=0,Oi>>>=0;
  const a=dd+Hr|0;
  dd=Hr^Hr>>>9,Hr=Eo+(Eo<<3)|0,Eo=Eo<<21|Eo>>>11,Oi=Oi+1|0;
  const e=a+Oi|0;
  return Eo=Eo+e|0,(e>>>0)/4294967296
}
function GA() {
  return[dd>>>0,Hr>>>0,Eo>>>0,Oi>>>0]
}
function fq(a) {
  [dd,Hr,Eo,Oi]=a
}
function FW() {
  return Math.floor(Math.random()*4294967296)
}
function $s() {
  return Math.random()
}
const gq=.6366197723675814,yq=1.5707963267341256,vq=6077100506303966e-26,_q=20222662487111665e-37,bq=-.16666666666666632,xq=.00833333333332249,wq=-.0001984126982985795,Mq=27557313707070068e-22,Sq=-25050760253406863e-24,Aq=158969099521155e-24,kq=.0416666666666666,Eq=-.001388888888887411,Cq=2480158728947673e-20,Tq=-27557314351390663e-23,Pq=2087572321298175e-24,Rq=-11359647557788195e-27;
function Uc(a) {
  const e=a*a,t=e*a,n=xq+e*(wq+e*(Mq+e*(Sq+e*Aq)));
  return a+t*(bq+e*n)
}
function qc(a) {
  const e=a*a,t=e*(kq+e*(Eq+e*(Cq+e*(Tq+e*(Pq+e*Rq))))),n=.5*e,s=1-n;
  return s+(1-s-n+e*t)
}
function VA(a) {
  const e=Math.round(a*gq),t=a-e*yq-e*vq-e*_q;
  return[e,t]
}
function Sa(a) {
  if(!Number.isFinite(a))return NaN;
  if(a>-.7853981633974483&&a<.7853981633974483)return Uc(a);
  const[e,t]=VA(a);
  switch(e&3) {
    case 0:return Uc(t);
    case 1:return qc(t);
    case 2:return-Uc(t);
    default:return-qc(t)
  }
}
function ln(a) {
  if(!Number.isFinite(a))return NaN;
  if(a>-.7853981633974483&&a<.7853981633974483)return qc(a);
  const[e,t]=VA(a);
  switch(e&3) {
    case 0:return qc(t);
    case 1:return-Uc(t);
    case 2:return-qc(t);
    default:return Uc(t)
  }
}
const zq=[.4636476090008061,.7853981633974483,.982793723247329,1.5707963267948966],Lq=[22698777452961687e-33,3061616997868383e-32,13903311031230998e-33,6123233995736766e-32],Mo=[.3333333333333293,-.19999999999876483,.14285714272503466,-.11111110405462356,.09090887133436507,-.0769187620504483,.06661073137387531,-.058335701337905735,.049768779946159324,-.036531572744216916,.016285820115365782];
function WA(a) {
  if(Number.isNaN(a))return NaN;
  const e=a<0;
  let t=e?-a:a;
  if(t>=7378697629483821e4)return e?-1.5707963267948966:1.5707963267948966;
  let n;
  if(t<.4375) {
    if(t<7450580596923828e-24)return a;
    n=-1
  }
  else t<1.1875?t<.6875?(n=0,t=(2*t-1)/(2+t)):(n=1,t=(t-1)/(t+1)):t<2.4375?(n=2,t=(t-1.5)/(1+1.5*t)):(n=3,t=-1/t);
  const s=t*t,o=s*s,r=s*(Mo[0]+o*(Mo[2]+o*(Mo[4]+o*(Mo[6]+o*(Mo[8]+o*Mo[10]))))),i=o*(Mo[1]+o*(Mo[3]+o*(Mo[5]+o*(Mo[7]+o*Mo[9]))));
  if(n<0)return a-a*(r+i);
  const l=zq[n]-(t*(r+i)-Lq[n]-t);
  return e?-l:l
}
const Dh=3.141592653589793,Dq=12246467991473532e-32;
function Nn(a,e) {
  if(Number.isNaN(e)||Number.isNaN(a))return NaN;
  if(e===0)return a>0?Dh/2:a<0?-Dh/2:0;
  if(a===0)return e>0?0:Dh;
  const t=WA(Math.abs(a/e));
  if(e>0)return a<0?-t:t;
  const n=Dh-(t-Dq);
  return a<0?-n:n
}
const ji=new DataView(new ArrayBuffer(8));
function Fq(a,e) {
  for(;e>1023;)a*=898846567431158e293,e-=1023;
  for(;e<-1022;)a*=22250738585072014e-324,e+=1022;
  return ji.setUint32(0,e+1023<<20),ji.setUint32(4,0),a*ji.getFloat64(0)
}
const $A=.6931471803691238,YA=19082149292705877e-26,Iq=1.4426950408889634,Bq=.16666666666666602,Nq=-.0027777777777015593,Uq=6613756321437934e-20,qq=-16533902205465252e-22,Hq=41381367970572385e-24;
function Oq(a) {
  if(Number.isNaN(a))return NaN;
  if(a>709.782712893384)return 1/0;
  if(a<-745.1332191019411)return 0;
  if(a>-3725290298461914e-24&&a<3725290298461914e-24)return 1+a;
  const e=Math.round(a*Iq),t=a-e*$A,n=e*YA,s=t-n,o=s*s,r=s-o*(Bq+o*(Nq+o*(Uq+o*(qq+o*Hq)))),i=1-(n-s*r/(2-r)-t);
  return e===0?i:Fq(i,e)
}
const jq=.6666666666666735,Gq=.3999999999940942,Vq=.2857142874366239,Wq=.22222198432149784,$q=.1818357216161805,Yq=.15313837699209373,Xq=.14798198605116586;
function Kq(a) {
  if(Number.isNaN(a)||a<0)return NaN;
  if(a===0)return-1/0;
  if(a===1/0)return 1/0;
  let e=0;
  a<22250738585072014e-324&&(a*=0x40000000000000,e-=54),ji.setFloat64(0,a);
  let t=ji.getUint32(0);
  e+=(t>>>20)-1023,t&=1048575;
  const n=t+614244&1048576;
  ji.setUint32(0,t|n^1072693248),e+=n>>>20;
  const s=ji.getFloat64(0)-1,o=s/(2+s),r=o*o,i=r*r,l=i*(Gq+i*(Wq+i*Yq)),c=r*(jq+i*(Vq+i*($q+i*Xq)))+l,u=.5*s*s;
  return e*$A-(u-(o*(u+c)+e*YA)-s)
}
function il(a,e) {
  if(e===0)return 1;
  if(Number.isInteger(e)&&Math.abs(e)<=1024) {
    let t=Math.abs(e),n=a,s=1;
    for(;t>0;)t&1&&(s*=n),n*=n,t>>>=1;
    return e<0?1/s:s
  }
  return a>0?Oq(e*Kq(a)):a===0?e>0?0:1/0:NaN
}
function Qt(a,e) {
  return Math.sqrt(a*a+e*e)
}
const Jm=700/AU,Jq=450,p0=700;
function Or(a,e) {
  const t=a.duration;
  a.speed=t>0?t/e:1
}
class IW {
  constructor(e,t) {
    x(this,"view",new ue);
    x(this,"sprite");
    x(this,"shadow");
    x(this,"x",0);
    x(this,"y",0);
    x(this,"facingX",0);
    x(this,"facingY",1);
    x(this,"moving",!1);
    x(this,"castLock",0);
    x(this,"hurtFlash",0);
    x(this,"dead",!1);
    x(this,"sitting",!1);
    x(this,"def");
    x(this,"idleAction");
    x(this,"castAction");
    x(this,"attackAction");
    x(this,"rushLeft",0);
    this.def=e,this.shadow=el(new et().ellipse(0,0,16,6).fill( {
      color:0,alpha:.35
    }),"shadow",0,.4),this.sprite=new pq(t);
    const n=!!(t.weapon||t.shield);
    this.idleAction=n?"ready":"idle",this.castAction=(e.castAction==="attack"||e.castAction==="attack2")&&t.weapon?_x(t):e.castAction,this.attackAction=_x(t),this.view.addChild(this.shadow,this.sprite)
  }
  cast() {
    this.pose(this.castAction)
  }
  rush(e) {
    this.dead||(this.sprite.play("walk",!0,!0),Or(this.sprite,Jm*.35),this.sprite.cartAhead=!0,this.castLock=e,this.rushLeft=e)
  }
  attack() {
    this.pose(this.attackAction)
  }
  pose(e) {
    this.dead||(this.sprite.play(e,!1,!0),Or(this.sprite,350),this.castLock=350)
  }
  update(e,t,n) {
    const s=e*1e3;
    if(this.dead) {
      this.sprite.update(s);
      return
    }
    this.moving=t!==0||n!==0,this.moving&&(this.sitting=!1,this.facingX=t,this.facingY=n),this.sprite.dir=tl(this.facingX,this.facingY),this.rushLeft>0&&(this.rushLeft-=s,this.rushLeft<=0&&(this.sprite.cartAhead=!1)),this.castLock>0?this.castLock-=s:this.moving?this.sprite.actionName!=="walk"&&(this.sprite.play("walk"),Or(this.sprite,Jm*.85)):this.sprite.actionName!==(this.sitting?"sit":this.idleAction)&&(this.sprite.play(this.sitting?"sit":this.idleAction),this.sprite.speed=1),this.sprite.update(s),this.hurtFlash>0&&(this.hurtFlash-=s,this.sprite.tint=this.hurtFlash>0?16744576:16777215),this.view.position.set(this.x,this.y),this.view.zIndex=this.y
  }
  die() {
    this.dead=!0,this.sprite.play("dead",!1,!0),this.sprite.tint=16777215
  }
  revive() {
    this.dead=!1,this.castLock=0,this.sprite.play(this.idleAction),this.sprite.speed=1
  }
}
const BW=1.5;
class NW {
  constructor(e,t,n,s,o=!1) {
    x(this,"view",new ue);
    x(this,"sprite");
    x(this,"def");
    x(this,"x");
    x(this,"y");
    x(this,"_hp",0);
    x(this,"hpFloor",0);
    x(this,"maxHp");
    x(this,"damage");
    x(this,"attackCd",0);
    x(this,"nid",0);
    x(this,"netX",0);
    x(this,"netY",0);
    x(this,"netVx",0);
    x(this,"netVy",0);
    x(this,"netAge",0);
    x(this,"netHp",0);
    x(this,"netPaid",!1);
    x(this,"killed",!1);
    x(this,"netDeadSent",!1);
    x(this,"netTo",0);
    x(this,"netMine",!0);
    x(this,"netCC",[0,0,0,0]);
    x(this,"state","move");
    x(this,"stateTime",0);
    x(this,"flinchAt",0);
    x(this,"slowUntil",0);
    x(this,"speedMult",1);
    x(this,"frostStacks",0);
    x(this,"shatterPct",0);
    x(this,"poisonUntil",0);
    x(this,"poisonDps",0);
    x(this,"poisonTick",0);
    x(this,"poisons",new Map);
    x(this,"bleedDps",0);
    x(this,"bleedUntil",0);
    x(this,"bleedTick",0);
    x(this,"bleedSrc", {
      part:"Sangrado"
    });
    x(this,"burnDps",0);
    x(this,"burnUntil",0);
    x(this,"burnTick",0);
    x(this,"burnAcc",0);
    x(this,"burnSrc");
    x(this,"freezeUntil",0);
    x(this,"petrified",!1);
    x(this,"stunUntil",0);
    x(this,"blindUntil",0);
    x(this,"blindDir",0);
    x(this,"markUntil",0);
    x(this,"mark",0);
    x(this,"zenyMarkUntil",0);
    x(this,"preyUntil",0);
    x(this,"chainedUntil",0);
    x(this,"weakUntil",0);
    x(this,"weak",0);
    x(this,"overlays",new Map);
    x(this,"kx",0);
    x(this,"ky",0);
    x(this,"flash",0);
    x(this,"removed",!1);
    x(this,"hitBy",new Map);
    x(this,"busyUntil",0);
    x(this,"guard",0);
    x(this,"guardUntil",0);
    x(this,"onGuardHit",null);
    x(this,"hiddenUntil",0);
    x(this,"bornAt",0);
    x(this,"fusePhase",0);
    x(this,"fused",!1);
    x(this,"gemMult",1);
    x(this,"los",!1);
    x(this,"losAt",0);
    x(this,"elite");
    x(this,"aura",null);
    x(this,"faceX",0);
    x(this,"faceY",1);
    this.def=e,this.elite=o,this.x=t,this.y=n,this.maxHp=this.hp=Math.round(e.hp*s*(o?6:1)),this.damage=Math.round(e.damage*(o?1.5:1));
    const r=el(new et().ellipse(0,0,e.radius,e.radius*.4).fill( {
      color:0,alpha:.3
    }),"shadow",0,.35);
    if(o||e.aura!==void 0) {
      const i=e.aura??16762940,l=o?1:1.3;
      this.aura=el(new et().ellipse(0,0,e.radius*1.8*l,e.radius*.75*l).fill( {
        color:i,alpha:.5
      }),"additive",i,1),this.aura.blendMode="add",this.view.addChild(this.aura)
    }
    this.sprite=new Fn(xt.sheet(e.id),"walk"),this.sprite.playSounds=!!e.boss,this.sprite.scale.set((e.scale??1)*(o?1.35:1)),Or(this.sprite,Jm),this.sprite.time=$s()*1e3,this.view.addChild(r,this.sprite),this.view.position.set(t,n)
  }
  get hp() {
    return this._hp
  }
  set hp(e) {
    this._hp=this.hpFloor>0?Math.max(this.hpFloor,e):e
  }
  get dead() {
    return this.state==="dead"
  }
  setState(e) {
    switch(this.state=e,this.stateTime=0,e) {
      case"move":this.sprite.play("walk"),Or(this.sprite,Jm);
      break;
      case"attack":this.sprite.play("attack",!1,!0),Or(this.sprite,Jq);
      break;
      case"hurt":this.sprite.play("hurt",!1,!0),Or(this.sprite,220);
      break;
      case"dead":this.sprite.play("die",!1,!0),Or(this.sprite,p0);
      break
    }
  }
  face(e,t) {
    this.faceX=e,this.faceY=t,Km||(this.sprite.dir=tl(e,t))
  }
  stopped(e) {
    return this.freezeUntil>e||this.stunUntil>e
  }
  updateView(e,t) {
    if(this.stateTime+=e,Km) {
      this.flash>0&&(this.flash-=e),this.state==="dead"&&this.stateTime/p0>1.2&&(this.removed=!0);
      return
    }
    this.sprite.dir=tl(this.faceX,this.faceY);
    const n=this.freezeUntil>t;
    if(!n&&this.stunUntil<=t&&this.sprite.update(e),this.flash>0&&(this.flash-=e),this.state==="dead") {
      const s=this.stateTime/p0;
      s>.6&&(this.view.alpha=Math.max(0,1-(s-.6)/.6)),s>1.2&&(this.removed=!0),this.sprite.tint=16777215,this.setOverlay("ice",!1,t),this.setOverlay("stun",!1,t),this.setOverlay("poison",!1,t),this.setOverlay("zeny",!1,t)
    }
    else {
      let s=16777215;
      this.markUntil>t&&(s=16756912),this.weakUntil>t&&(s=13153520),this.poisonUntil>t&&(s=13933823),this.slowUntil>t&&(s=11590911),n&&(s=this.petrified?9211020:10475775),this.flash>0&&(s=16740464);
      const o=this.def.fuse;
      if(o) {
        const r=Math.min(1,(t-this.bornAt)/o.secs);
        this.fusePhase+=e/1e3*(1+9*r*r),this.fusePhase%1<.5&&(s=16734780)
      }
      this.sprite.tint=s,this.setOverlay("ice",n&&!this.petrified,t),this.setOverlay("stun",this.stunUntil>t,t),this.setOverlay("poison",this.poisonUntil>t,t),this.setOverlay("zeny",this.zenyMarkUntil>t,t)
    }
    for(const s of this.overlays.values())s.visible&&s.update(e);
    if(this.aura) {
      const s=this.def.aura!==void 0&&!this.elite;
      this.aura.alpha=this.dead?0:s?.7+.25*Sa(this.stateTime/180):.35+.25*Sa(this.stateTime/180),!this.dead&&this.flash<=0&&this.sprite.tint===16777215&&(this.sprite.tint=s?Zq(this.def.aura,.45):16771488)
    }
    this.view.position.set(this.x,this.y),this.view.zIndex=this.y
  }
  setOverlay(e,t,n) {
    let s=this.overlays.get(e);
    if(!t) {
      s&&(s.visible=!1);
      return
    }
    if(!s) {
      const o=this.def.scale??1,r=-(this.sprite.height||60)*.9;
      e==="ice"?(s=new Fn(xt.sheet("fx_freeze"),"a0"),s.scale.set(.45*o*(this.def.radius/16)),s.alpha=.85):e==="stun"?(s=new Fn(xt.sheet("fx_stun"),"a0"),s.y=r):e==="zeny"?(s=new Fn(xt.sheet("fx_coin"),"a0"),s.y=r-14,s.scale.set(2)):(s=new Fn(xt.sheet("fx_poison"),"a0"),s.tint=13933823,s.y=r*.6,s.alpha=.8),s.loop=!0,this.view.addChild(s),this.overlays.set(e,s)
    }
    s.visible=!0
  }
}
class Qq {
  constructor(e,t,n,s,o,r,i={}) {
    x(this,"view");
    x(this,"x");
    x(this,"y");
    x(this,"vx");
    x(this,"vy");
    x(this,"damage");
    x(this,"pierce");
    x(this,"life");
    x(this,"radius");
    x(this,"aimX");
    x(this,"aimY");
    x(this,"aimDist",0);
    x(this,"splash");
    x(this,"h0",NaN);
    x(this,"hSlope",0);
    x(this,"travel",0);
    x(this,"sound","");
    x(this,"hitOpts",{});
    x(this,"hitFx");
    x(this,"returns",!1);
    x(this,"returning",!1);
    x(this,"ghost",!1);
    x(this,"orient",0);
    x(this,"maxLife",2);
    x(this,"drag",0);
    x(this,"carried",[]);
    x(this,"vortex",0);
    x(this,"model");
    x(this,"surge",!1);
    x(this,"holy",0);
    x(this,"trail");
    x(this,"hit",new Set);
    x(this,"dead",!1);
    x(this,"spin",0);
    x(this,"baseScale",1);
    this.view=e,this.x=t,this.y=n,this.vx=s,this.vy=o,this.damage=r,this.pierce=i.pierce??0,this.life=i.life??2,this.radius=i.radius??12,Object.assign(this,i),this.maxLife=this.life,this.baseScale=e.scale.x,e.position.set(t,n)
  }
}
class UW {
  constructor(e,t,n,s,o,r) {
    x(this,"view",new ue);
    x(this,"sprite");
    x(this,"x");
    x(this,"y");
    x(this,"value");
    x(this,"kind");
    x(this,"ref",0);
    x(this,"src","");
    x(this,"quality",-1);
    x(this,"beam",null);
    x(this,"magnet",!1);
    x(this,"vacuum",!1);
    x(this,"nid",0);
    x(this,"dead",!1);
    x(this,"bob",$s()*Math.PI*2);
    x(this,"glow",null);
    this.kind=e,this.x=t,this.y=n,this.value=s,this.view.addChild(el(new et().ellipse(0,0,9,3.5).fill( {
      color:0,alpha:.3
    }),"shadow",0,.3)),r!==void 0&&(this.glow=el(new et().ellipse(0,0,18,7).fill( {
      color:r,alpha:.6
    }),"additive",r,1),this.glow.blendMode="add",this.view.addChild(this.glow)),this.sprite=new Ra(o),this.sprite.anchor.set(.5,.8),this.view.addChild(this.sprite),this.view.position.set(t,n)
  }
  update(e) {
    this.bob+=e*4,this.view.position.set(this.x,this.y),this.sprite.y=-6+Sa(this.bob)*3,this.glow&&(this.glow.alpha=.4+.3*Sa(this.bob*1.5))
  }
}
const cc= {
  ms:1500,rise:140,fall:290,right:260,size:2.125
};
class qW {
  constructor(e,t,n,s,o,r=1.6,i=!1) {
    x(this,"view",new ue);
    x(this,"x");
    x(this,"y");
    x(this,"lift");
    x(this,"offX",0);
    x(this,"scale");
    x(this,"life",0);
    x(this,"duration");
    x(this,"dead",!1);
    x(this,"vx",($s()-.5)*40);
    x(this,"straight",Tt.straightNumbers);
    x(this,"lift0");
    x(this,"size",1);
    x(this,"bump",1);
    this.x=t,this.y=n,this.lift=this.lift0=s,this.scale=r,this.duration=this.straight?900:cc.ms,this.draw(e,o,i)
  }
  setValue(e,t,n) {
    for(const s of this.view.removeChildren())s.destroy();
    this.draw(e,t,n),this.life=Math.min(this.life,150),this.bump=1.35
  }
  draw(e,t,n) {
    const s=xt.sheet("fx_numbers").action("a0").dirs[0],o=String(Math.max(0,Math.round(e)));
    let r=0;
    const i=[];
    for(const d of o) {
      const c=s[Number(d)],u=new Ra(c);
      u.anchor.set(0,.5),u.x=r,u.tint=t,r+=c.frame.width-1,i.push(u)
    }
    for(const d of i)d.x-=r/2;
    const l=n?xt.iconTextures.get("crit_burst"):void 0;
    if(l) {
      const d=new Ra(l);
      d.anchor.set(.5),d.scale.set(Math.max(.55,(r+14)/l.width)),this.view.addChild(d)
    }
    this.view.addChild(...i)
  }
  update(e) {
    this.life+=e;
    const t=Math.min(1,this.life/this.duration);
    this.bump=Math.max(1,this.bump-e*.0025),this.straight?(this.lift+=e*.06,this.offX+=this.vx*e/1e3,this.view.alpha=t<.6?1:Math.max(0,1-(t-.6)/.4)):(this.lift=this.lift0+cc.rise*Sa(1.5*Math.PI*t)-cc.fall*t,this.offX=cc.right*t,this.size=cc.size*(1-t),this.view.alpha=1-t),this.life>=this.duration&&(this.dead=!0)
  }
}
function Zq(a,e) {
  const t=n=>Math.round((a>>n&255)*(1-e)+255*e);
  return t(16)<<16|t(8)<<8|t(0)
}
const Qm=["fire","water","wind"];
function Zm(a) {
  return Qm.filter((e,t)=>a.infuse&1<<t)
}
function eH(a,e) {
  a.infuse|=1<<Qm.indexOf(e)
}
const tH=(1/.6-1)/99,XA=.002,aH=.003,nH=XA/2,KA=.001,sH=KA/2;
function ep(a) {
  return 1/(1+Math.max(0,a))
}
function HW(a) {
  return {
    damageMult:1,haste:0,speedMult:1,areaMult:1,reachMult:1,projSpeedMult:1,extraProjectiles:0,armor:a.armor,def:0,damageReduction:0,maxHp:a.hp,regen:0,regenStill:0,regenMoving:0,regen5:0,regenPct5:0,lifesteal:0,discovery:0,levelUpHeal:.3,pickupRadius:130,critChance:.03,pierceChance:0,critMult:1.6,doubleChance:0,flee:0,expMult:1,potionMult:1,potionDropMult:1,bossUndeadMult:1,bossEliteMult:1,lowHpDamage:0,lowHpBleed:0,poisonDmg:0,dotDmg:0,poisonStack:0,poisonTime:0,poisonSlow:0,poisonVuln:0,poisonSpread:0,poisonFast:0,sonicBlow:0,hideFan:0,stepDmg:0,critStun:0,stepChain:0,stepPickup:0,maxHpPct:0,endureReduction:0,endureReflect:0,berserk:0,bleedLifesteal:0,petrifyChance:0,infuse:0,boltConduit:0,allColdBolt:0,firestorm:0,burnCrit:0,strafeOnCrit:0,fireMirror:0,stormVortex:0,clearcast:0,petrifyVuln:0,extraGemChance:0,zenyMult:1,stunChance:0,revives:0,chestDiscount:0,freeChest:0,str:1,agi:1,vit:1,int:1,dex:1,luk:1,castHaste:0,atk:0,matk:0,atkRanged:0,powerMelee:1,powerRanged:1,powerMagic:1,powerHybrid:1,jumpMelee:1,jumpRanged:1,jumpMagic:1,jumpHybrid:1,basicExpBonus:0,hybridDmg:0,elemConverge:0,arcaneSurge:0,stillDmg:0,areaSkillDmg:0,siegeRain:0,ext:{}
  }
}