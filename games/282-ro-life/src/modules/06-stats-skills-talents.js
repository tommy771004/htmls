/**
 * ============================================================================
 * RO Life Source Module: 06-stats-skills-talents.js
 * Description: Stat Formulas (`JA`/`$W`/`Fi`), Rarities (`Ep`), 199 Active Skills & Basic Attacks (`va`), 14 Deities (`Lm`), 1,492 Talent Tree Nodes (`nl`), and EXP Curves (`Y9`/`J9`/`Q9`)
 * ============================================================================
 */

const JA=[ {
  id:"str",name:"STR",desc:"Fuerza: +3 ATK por punto en jobs cuerpo a cuerpo, +1 ATK en jobs a distancia."
}, {
  id:"agi",name:"AGI",desc:"Agilidad: +0,67 de Celeridad por punto (con 99, un 40% menos de enfriamiento en todas las skills), y +0,2% de Flee por punto (cuenta también la AGI del equipo)."
}, {
  id:"vit",name:"VIT",desc:"Vitalidad: +2% de HP máximo, +0,1 HP/s de regeneración y +2% de curación de pociones por punto."
}, {
  id:"int",name:"INT",desc:"Inteligencia: +3 MATK por punto (daño y curación de los jobs mágicos)."
}, {
  id:"dex",name:"DEX",desc:"Destreza: casteos más cortos (instantáneos a 100 DEX a un objetivo, 150 DEX zonales). +0,1% de doble casteo por punto; en jobs a distancia, además +3 ATK por punto."
}, {
  id:"luk",name:"LUK",desc:"Suerte: +0,3% de crítico, +0,1% de Flee y +0,05% de doble casteo por punto."
}
];
for(const a of JA)Do(a,["desc"]);
const oH=1,rH=99,iH=48;
function OW() {
  return {
    str:1,agi:1,vit:1,int:1,dex:1,luk:1
  }
}
function QA(a) {
  return Math.floor((a-1)/10)+2
}
function lH(a) {
  let e=0;
  for(let t=oH;t<a;t++)e+=QA(t);
  return e
}
function dH(a) {
  let e=iH;
  for(let t=1;t<a;t++)e+=Math.floor(t/5)+3;
  return e
}
function cH(a,e) {
  return dH(a)-JA.reduce((t, {
    id:n
  })=>t+lH(e[n]),0)
}
function jW(a,e,t) {
  return e[t]<rH&&cH(a,e)>=QA(e[t])
}
const uH=15.46,hH= {
  1:.045,2:.0075,3:1
},mH= {
  1:2,2:3,3:2
},pH=1.5;
function Fi(a,e=1) {
  const t=Math.max(0,a)/uH,n=1+il(t,mH[e])*hH[e];
  return e>1?Math.max(n,pH*Fi(a,e-1)):n
}
const fH=80;
function GW(a) {
  return a>0?a/(a+fH):0
}
const VW=.03,WW=.005,gH= {
  1:0,2:.15,3:.15
},yH=.02,vH=.1,_H=.02;
function $W(a,e=1) {
  a.atkRanged=a.atk+a.str+3*a.dex,a.atk+=3*a.str,a.matk+=3*a.int,a.doubleChance+=KA*a.dex,a.powerMelee*=Fi(a.atk,e),a.powerRanged*=Fi(a.atkRanged,e),a.powerMagic*=Fi(a.matk,e),a.powerHybrid*=Fi(a.atkRanged+a.matk,e);
  const t=n=>Fi(n,e)/Fi(n,1);
  a.jumpMelee=t(a.atk),a.jumpRanged=t(a.atkRanged),a.jumpMagic=t(a.matk),a.jumpHybrid=t(a.atkRanged+a.matk),a.basicExpBonus+=gH[e],a.haste+=tH*a.agi,a.flee+=XA*a.agi,a.maxHp*=1+yH*a.vit+a.maxHpPct,a.regen+=vH*a.vit,a.potionMult+=_H*a.vit,a.critChance+=aH*a.luk,a.flee+=nH*a.luk,a.doubleChance+=sH*a.luk,a.berserk>0&&(a.maxHp*=.4)
}
const ZA= {
  single:2,area:5
},bH= {
  single:100,area:150
};
function ek(a,e,t) {
  return a<=0?0:a*Math.max(0,1-t.dex/bH[e])*ep(t.castHaste)
}
const xH=2,f0=a=> {
  const e=a-1;
  return e>0?1+e/(1+e/xH):a
};
function YW(a) {
  a.areaMult=f0(a.areaMult),a.reachMult=f0(a.reachMult),a.speedMult=f0(a.speedMult)
}
function wH() {
  return {
    rng:GA(),locals:new Map
  }
}
let cd=wH();
function XW() {
  return cd
}
function KW(a) {
  a!==cd&&(cd.rng=GA(),cd=a,fq(a.rng))
}
function tk(a,e) {
  return()=> {
    let t=cd.locals.get(a);
    return t===void 0&&(t=e(),cd.locals.set(a,t)),t
  }
}
const Ep=[ {
  name:"Común",nameF:"Común",cls:"r0",color:15921906,mult:1,baseMult:1,weight:55
}, {
  name:"Poco común",nameF:"Poco común",cls:"r1",color:4054106,mult:1.25,baseMult:1.05,weight:25
}, {
  name:"Raro",nameF:"Rara",cls:"r2",color:3111935,mult:1.5,baseMult:1.1,weight:13
}, {
  name:"Épico",nameF:"Épica",cls:"r3",color:10502399,mult:2,baseMult:1.15,weight:6.6
}, {
  name:"Legendario",nameF:"Legendaria",cls:"r4",color:16751150,mult:3,baseMult:1.2,weight:1.5
}
].map(a=>Do(a,["name","nameF"])),MH=0,JW=1,SH=2,AH=3,Wi=4,ak=tk("quality",()=>( {
  discovery:0
}));
function QW(a) {
  const e=Math.max(0,a);
  ak().discovery=e/(1+e)
}
function kH(a) {
  return Ep.map((e,t)=>t>=a?e.weight*il(1+ak().discovery,t):0)
}
function Py(a=0) {
  const e=kH(a);
  let t=Wt()*e.reduce((n,s)=>n+s,0);
  for(let n=0;n<e.length;n++)if(t-=e[n],t<0)return n;
  return a
}
function ZW(a) {
  return"#"+Ep[a].color.toString(16).padStart(6,"0")
}
const xx=4;
function e9(a=1) {
  return a>=2?xx+1:xx
}
const nk=Ep.map(a=>Do( {
  name:nA(a,"nameF"),cls:a.cls,mult:a.mult,weight:a.weight
},["name"]));
function sk(a) {
  return a>=4?3:a>=3?2:1
}
const wx= {
  dmg: {
    base:.2,max:1/0
  },cd: {
    base:.06,max:1/0
  },area: {
    base:.12,max:2
  },reach: {
    base:.12,max:2
  },count: {
    base:1,max:10,int:!0
  },targets: {
    base:1,max:6,int:!0
  },pierce: {
    base:.02,max:1
  },speed: {
    base:.15,max:2
  },duration: {
    base:.25,max:4
  },effect: {
    base:1,max:1/0
  }
};
function EH() {
  return {
    dmg:0,cd:0,area:0,reach:0,count:0,targets:0,pierce:0,speed:0,duration:0,effect:0
  }
}
function ok() {
  return Py()
}
function CH(a,e,t=ok()) {
  const n=a.filter(i=>e[i]<wx[i].max);
  if(!n.length)return null;
  const s=n[Math.floor(Wt()*n.length)],o=wx[s],r=o.int?sk(t):s==="pierce"?o.base*(t+1):o.base*nk[t].mult;
  return {
    aspect:s,rarity:t,amount:Math.min(r,o.max-e[s])
  }
}
function TH(a) {
  const e=[];
  for(const t of a) {
    const n=e.findIndex(s=>s.aspect===t.aspect&&s.effect===t.effect);
    n<0?e.push(t):e[n]= {
      ...t,amount:e[n].amount+t.amount
    }
  }
  return e
}
function Ry(a,e,t="projSpeed",n="") {
  return a.parts?TH(a.parts).map(s=>Ry(s,e,t,n)).join(" + "):a.aspect==="effect"?a.text??bt("Efecto más fuerte"):a.aspect==="duration"&&n?Pt(`${Kt("duration",a.amount)} ${n}`):Nc(a.aspect==="speed"?t:a.aspect,a.amount,e)
}
const Mx= {
  damageMult:["de daño",!0],haste:["de Celeridad",!1],speedMult:["de velocidad",!0],areaMult:["de área",!0],projSpeedMult:["de velocidad de proyectiles",!0],extraProjectiles:["proyectiles",!1],armor:["de armadura",!1],damageReduction:["de reducción de daño",!0],maxHp:["de HP máximo",!1],regen:["HP/s",!1],regenStill:["HP/s quieto",!1],pickupRadius:["de radio de recogida",!1],critChance:["de crítico",!0],critMult:["de daño crítico",!0],doubleChance:["de doble casteo",!0],flee:["de Flee",!0],expMult:["de EXP",!0],potionMult:["de curación de la carne",!0],potionDropMult:["de carne",!0],bossUndeadMult:["de daño a jefes y no-muertos",!0],bossEliteMult:["de daño a jefes y élites",!0],lowHpDamage:["de daño con poca vida",!0],petrifyChance:["de petrificar",!0],extraGemChance:["de gema extra",!0],zenyMult:["de zeny",!0],stunChance:["de aturdir",!0],revives:["revivir",!1],chestDiscount:["de descuento en cofres",!0]
};
function t9(a,e,t,n) {
  const s= {
    ...a
  },o= {
    ...a
  };
  t>0&&e(s,t),e(o,n);
  for(const i of[s,o])i.extraProjectiles=Math.floor(i.extraProjectiles+1e-6),i.revives=Math.floor(i.revives+1e-6);
  const r=[];
  for(const i of Object.keys(Mx)) {
    const l=o[i]-s[i];
    if(Math.abs(l)<1e-6)continue;
    const[d,c]=Mx[i],u=i==="haste"?Qr(Math.abs(l)*100,1):c?`${Math.round(Math.abs(l)*100)}%`:Qr(Math.abs(l),1);
    r.push(`${l>0?"+":"-"}${u} ${bt(d)}`)
  }
  return r.join(", ")
}
const PH= {
  count:0,targets:0,pierce:0
},RH=new Set(["zeny_rain"]);
function zH(a,e) {
  const t=[...a],n=Math.min(e,t.length);
  for(let s=0;s<n;s++) {
    const o=s+Math.floor(Wt()*(t.length-s));
    [t[s],t[o]]=[t[o],t[s]]
  }
  return t.slice(0,n)
}
const LH= {
  single: {
    label:"Un objetivo",aspects:["dmg","cd","count","reach"]
  },multi: {
    label:"Varios objetivos",aspects:["dmg","cd","count"]
  },projectile: {
    label:"Proyectil",aspects:["dmg","cd","count","targets","pierce","speed","area"]
  },aoe: {
    label:"Área",aspects:["dmg","cd","area","count"]
  },control: {
    label:"Control",aspects:["cd","area"]
  },zone: {
    label:"Zona",aspects:["dmg","cd","count","area","duration"]
  },orbit: {
    label:"Orbital",aspects:["dmg","cd","count","area","speed","duration"]
  },buff: {
    label:"Buff",aspects:["cd","duration"]
  }
},DH=3,FH=["atk_bow","atk_gun","atk_shuriken","atk_rod","atk_instrument","arrow_repel"],IH=["atk_infused"];
function Sx(a,e) {
  return a.fmt==="pct"?`${Math.round(e*100)}%`:a.fmt==="s"?`${Qr(e,1)} s`:Qr(e,1)
}
const a9= {
  melee:"Cuerpo a cuerpo",projectile:"Proyectil",ranged_strike:"Golpe a distancia",aura:"Aura",ground:"Zona en el suelo",orbit:"Orbital",buff:"Buff",single:"Un objetivo",multi:"Varios objetivos",area:"Área",pierce:"Penetrante",return:"Retorno",burst:"Ráfaga",cast:"Casteo",persistent:"Persistente",basic:"Ataque básico",physical:"Física",magic:"Mágica",hybrid:"Escala con ATK e INT",neutral:"Neutro",fire:"Fuego",water:"Agua",wind:"Viento",earth:"Tierra",holy:"Sagrado",ghost:"Fantasma"
},ee=(a,e)=>t=>a*(1+e*(t-1)),xu=(a,e)=>t=>a+Math.floor((t-1)/e),I=a=>()=>a;
function ri(a,e) {
  return a.lift=e,a
}
class ds {
  constructor(e,t,n) {
    x(this,"view");
    x(this,"anchor");
    x(this,"lift");
    x(this,"upright");
    x(this,"t",0);
    x(this,"duration");
    x(this,"animate");
    this.view=e,this.duration=t,this.animate=n,n(0,e)
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.duration);
    return this.animate(t,this.view),t>=1
  }
}
function rs(a,e) {
  const t= {
    ...a
  };
  for(const[n,s]of Object.entries(e))typeof s=="number"?t[n]=(t[n]??0)+s:t[n]===void 0&&n!=="tags"&&(t[n]=s);
  if(e.tags) {
    const n= {
      ...a.tags
    };
    for(const[s,o]of Object.entries(e.tags))a[s]||(n[s]=o);
    t.tags=n
  }
  return t
}
const BH=new Set(["firebolt","coldbolt","lightning"]),NH=1.6;
class po {
  constructor(e) {
    x(this,"id");
    x(this,"effects",[]);
    x(this,"effUp",{});
    x(this,"level",1);
    x(this,"rank",1);
    x(this,"type","single");
    x(this,"tags",[]);
    x(this,"basicExp",.5);
    x(this,"noRepeat",!1);
    x(this,"cdBase",null);
    x(this,"dmgScale",1);
    x(this,"timer",.4);
    x(this,"up",EH());
    x(this,"history",[]);
    x(this,"isBolt");
    x(this,"castTime",0);
    x(this,"countStep",1);
    x(this,"castByLevel",null);
    x(this,"castKind","single");
    x(this,"element","neutral");
    x(this,"casting",null);
    x(this,"durNote","");
    x(this,"cdTotal",0);
    x(this,"waiting",!0);
    x(this,"casts",0);
    x(this,"cdExtra",0);
    x(this,"echo",null);
    x(this,"shot");
    x(this,"mirrorMult",1);
    this.id=e,this.isBolt=BH.has(e)
  }
  has(e) {
    return this.tags.includes(e)
  }
  power(e) {
    const t=this.has("hybrid")?e.stats.powerHybrid*(1+e.stats.hybridDmg):this.has("magic")?e.stats.powerMagic:this.has("physical")?this.has("melee")?e.stats.powerMelee:e.stats.powerRanged:1;
    if(this.has("basic")) {
      const n=e.stats,s=this.has("hybrid")?n.jumpHybrid:this.has("magic")?n.jumpMagic:this.has("physical")?this.has("melee")?n.jumpMelee:n.jumpRanged:1;
      return il(t/s,Math.min(1,this.basicExp+n.basicExpBonus))*s
    }
    return this.has("area")?t*(1+e.stats.areaSkillDmg):t
  }
  piercesAll() {
    return!1
  }
  claimHold() {
    return 0
  }
  aim(e) {
    return {
      kind:"self",r:0
    }
  }
  finalCastTime(e) {
    const n=(this.castTime>0?this.mod(e).cast:0)+e.buffValue("castHaste");
    return ek(this.castByLevel?this.castByLevel(this.level):this.castTime,this.castKind,n? {
      ...e.stats,castHaste:e.stats.castHaste+n
    }
    :e.stats)
  }
  isCasting() {
    return!!this.casting
  }
  aspects() {
    return["dmg","cd"]
  }
  speedKey() {
    return"projSpeed"
  }
  countUnit() {
    return"proyectil"
  }
  areaIsReach() {
    return!1
  }
  eff(e) {
    const t=this.effects.find(s=>s.key===e);
    if(!t)return 0;
    const n=t.base+t.step*(this.effUp[e]??0);
    return t.max===void 0?n:Math.min(t.max,n)
  }
  upgradeAspects() {
    const e=LH[this.type].aspects;
    return this.aspects().filter(t=>e.includes(t))
  }
  rollUpgrade() {
    const e=ok();
    if(e<Wi)return this.rollPart(e);
    const t=this.rollPart(AH,void 0,!0);
    if(!t)return null;
    const n=this.rollPart(SH,t,!0);
    return n? {
      ...t,rarity:Wi,parts:[t,n]
    }
    : {
      ...t,rarity:Wi
    }
  }
  rollTower(e) {
    return this.rollPart(e)
  }
  countLeft() {
    return IH.includes(this.id)?0:FH.includes(this.id)?DH-this.up.count/this.countStep:1/0
  }
  rollPart(e,t,n=!1) {
    var c;
    const s=this.effects.filter(u=>u.max===void 0||this.eff(u.key)<u.max-1e-9),o=this.countLeft(),r=o<=0||n&&o<1/0,i=this.upgradeAspects().filter(u=>!(r&&u==="count")),l=i.length+s.length;
    if(!l)return null;
    if(Wt()*l<s.length) {
      const u=s[Math.floor(Wt()*s.length)],h=((c=u.byRarity)==null?void 0:c[e])??(u.int?sk(e):nk[e].mult),m=(t==null?void 0:t.aspect)==="effect"&&t.effect===u.key?u.step*t.amount:0,p=f=>u.max===void 0?f:Math.min(u.max,f),g=p(this.eff(u.key)+m),y=p(g+u.step*h);
      return {
        aspect:"effect",effect:u.key,rarity:e,amount:h,text:`${bt(u.label)}: ${Sx(u,y)}`
      }
    }
    const d=CH(i,this.up,e);
    return d?d.aspect==="count"&&o<1/0? {
      ...d,rarity:MH,amount:this.countStep
    }
    :d.aspect==="count"&&this.countStep!==1? {
      ...d,amount:d.amount*this.countStep
    }
    :d:null
  }
  applyUpgrade(e) {
    this.rank++;
    for(const t of e.parts??[e])t.aspect==="effect"&&t.effect?this.effUp[t.effect]=(this.effUp[t.effect]??0)+t.amount:this.up[t.aspect]+=t.amount,this.history.push( {
      text:Ry(t,this.countUnit(),this.speedKey(),this.durNote),rarity:e.rarity,aspect:t.aspect,effect:t.effect
    })
  }
  upgradeSummary(e,t=!0) {
    const n=new Map;
    for(const r of this.history) {
      if(!t&&r.aspect==="effect")continue;
      const i=r.aspect==="effect"?`effect:${r.effect}`:r.aspect;
      n.set(i,Math.max(n.get(i)??0,r.rarity))
    }
    const s=[...n.keys()],o= {
      dmg:e.dmg,cd:e.cd,count:e.count,area:e.area,pierce:e.pierce,speed:e.speed,duration:e.duration
    };
    for(const[r,i]of Object.entries(o))i&&!n.has(r)&&s.push(r);
    return s.map(r=> {
      if(r.startsWith("effect:")) {
        const c=this.effects.find(u=>u.key===r.slice(7));return {
          text:c?`${bt(c.label)}: +${Sx(c,this.eff(c.key)-c.base)}`:bt("Efecto más fuerte"),rarity:n.get(r)??-1
        }
      }
      const i=r,d=(o[i]??0)+this.up[i];return {
        text:Ry( {
          aspect:i,amount:d
        },this.countUnit(),this.speedKey(),this.durNote),rarity:n.get(r)??-1
      }
    })
  }
  usesTargetCharge() {
    return!this.has("basic")&&this.type!=="buff"&&this.type!=="orbit"&&!RH.has(this.id)
  }
  towerExtra(e) {
    const t=e.stats.ext,n=t.towerTargets??0,s=t.towerProj??0,o=t.towerRepeat??0,r=t.towerPierce??0;
    if(!n&&!s&&!o&&!r)return PH;
    const i=this.aspects(),l=this.countUnit(),d=l==="objetivo"?n:l==="carga"?0:l==="proyectil"||l==="flecha"?s:o;
    return {
      count:i.includes("count")?d:0,targets:i.includes("targets")?n:0,pierce:i.includes("pierce")?r:0
    }
  }
  mod(e) {
    const t=e.skillMod(this.id),n=e.sharedUpgrades(this).up,s=this.usesTargetCharge()&&e.buffValue("targets")>0,o=this.has("basic")&&this.mirrorMult===1&&e.buffValue("shadowBasic")||1,r=(1+t.dmg+n.dmg)*this.power(e)*this.dmgScale*(s?1+e.chargeDmg:1)*this.mirrorMult*o-1,i=this.towerExtra(e);
    return {
      dmg:r,cd:t.cd+n.cd,count:t.count+n.count+(s?1:0)+i.count,cast:t.cast,double:t.double,bolts:t.bolts,targets:t.targets+i.targets,area:t.area+n.area,reach:t.reach+n.reach,pierce:t.pierce+n.pierce+i.pierce,speed:t.speed+n.speed,duration:t.duration+n.duration,splash:t.splash,splashR:t.splashR,cone:Math.min(1,t.cone),hit: {
        ...t.hit,src:this.id
      }
    }
  }
  finalCooldown(e) {
    var n;
    const t=dr.skills.includes(this.id)?e.buffValue("adrenaline")/100:0;
    return(this.cdBase??this.cooldown())*ep(e.stats.haste+this.mod(e).cd+e.buffValue("haste")/100+t)*(((n=e.endless)==null?void 0:n.cdMult)??1)
  }
  cdFraction() {
    return this.waiting||this.cdTotal<=0?0:Math.max(0,Math.min(1,this.timer/this.cdTotal))
  }
  startCooldown(e) {
    this.usesTargetCharge()&&e.spendBuff("targets")&&e.chargeDmg>0&&ea(e,e.player,80,16738858,380),this.timer=this.cdTotal=this.finalCooldown(e)+this.cdExtra,this.cdExtra=0,this.waiting=!1,this.casts++
  }
  update(e,t) {
    if(this.echo&&(this.echo.left-=e)<=0&&this.fireEcho(t),!(!this.casting&&(this.timer-=e,this.timer>0))) {
      t.aimer=ei(this)?null:this;
      try {
        if(this.casting)return this.tickCast(e,t);
        if(this.finalCastTime(t)>0)return this.beginCast(t);
        this.release(t)?(t.aimer&&t.claim(this,this.shot,this.claimHold()),this.startCooldown(t)):this.idle()
      }
      finally {
        t.aimer=null
      }
    }
  }
  release(e,t) {
    if(this.shot=t,!this.fire(e,t))return!1;
    for(const o of Ct.cast)o(e,this);
    e.stats.sonicBlow>0&&dr.skills.includes(this.id)&&e.addBuff("adrenaline",dr.haste,dr.seconds,"bs_adrenaline");
    const n=this.type!=="buff"&&this.type!=="orbit"&&!this.noRepeat,s=n&&!ei(this)&&e.spendBuff("windWalk");
    return n&&(s||Wt()<e.stats.doubleChance+this.mod(e).double)&&(this.echo= {
      left:UH,aim:this.shot
    }),e.onSkillCast(this),e.stats.fireMirror>0&&this.type!=="buff"&&this.type!=="orbit"&&e.isFire(this)&&this.fireMirror(e),!0
  }
  fireBoosted(e,t,n) {
    const s=this.shot;
    this.mirrorMult=n;
    try {
      this.fire(e,t)
    }
    finally {
      this.mirrorMult=1,this.shot=s
    }
  }
  fireMirror(e) {
    const t=this.shot;
    let n=null;
    if((t==null?void 0:t.kind)==="enemy") {
      const s=Wr(t),o=e.nearestEnemies(s.length+16,700).filter(r=>!r.dead&&!s.includes(r)).slice(0,s.length);
      o.length&&(n= {
        kind:"enemy",e:o[0],all:o,only:!0
      })
    }
    else if((t==null?void 0:t.kind)==="ground") {
      const s=e.randomVisibleEnemies(24).find(o=>Qt(o.x-t.x,o.y-t.y)>160);
      s&&(n= {
        kind:"ground",x:s.x,y:s.y,r:t.r
      })
    }
    if(n) {
      this.mirrorMult=e.stats.fireMirror;
      try {
        this.fire(e,n)
      }
      finally {
        this.mirrorMult=1,this.shot=t
      }
    }
  }
  fireEcho(e) {
    const t=this.echo.aim;
    if(this.echo=null,(t==null?void 0:t.kind)!=="enemy")return void this.fire(e,t);
    const n=Wr(t).filter(s=>!s.dead);
    n.length&&this.fire(e, {
      kind:"enemy",e:n[0],all:n,only:!0
    })
  }
  idle() {
    this.timer=.15,this.waiting=!0
  }
  beginCast(e) {
    const t=this.aim(e);
    if(!t)return this.idle();
    const n=this.finalCastTime(e);
    e.aimer&&e.claim(this,t,n);
    const s= {
      aim:t,progress:0,done:!1
    };
    this.casting= {
      st:s,left:n,total:n
    },e.casts.push(s),t.kind==="enemy"&&Gn(e,t.e.x,t.e.y),e.player.cast(),ce.play("ef_beginspell",.3,2),gN(e,s,n*1e3,this.element)
  }
  tickCast(e,t) {
    const n=this.casting;
    if(n.left-=e,n.st.progress=Math.min(1,1-n.left/n.total),n.st.aim.kind==="enemy"&&Wr(n.st.aim).some(s=>s.dead)) {
      const s=Wr(n.st.aim).filter(r=>!r.dead),o=s.length? {
        kind:"enemy",e:s[0],all:s
      }
      :this.aim(t);
      if(!o)return this.endCast(t,!1);
      n.st.aim=o
    }
    n.left<=0&&this.endCast(t,!0)
  }
  clearScene(e) {
    this.echo=null,this.casting&&this.endCast(e,!1)
  }
  endCast(e,t) {
    const n=this.casting;
    n.st.done=!0,this.casting=null,e.casts.splice(e.casts.indexOf(n.st),1),t&&this.release(e,n.st.aim)?(e.aimer&&e.claim(this,this.shot,this.claimHold()),this.startCooldown(e)):this.idle()
  }
  saveState() {
    return {
      id:this.id,level:this.level,rank:this.rank,up: {
        ...this.up
      },effUp: {
        ...this.effUp
      },history:[...this.history]
    }
  }
  loadState(e) {
    this.level=e.level,this.rank=e.rank,this.up= {
      ...this.up,...e.up
    },this.effUp= {
      ...e.effUp
    },this.history=[...e.history]
  }
  onPlayerHit(e,t){}onLowHp(e) {
    return!1
  }
  destroy(e){}
}
const UH=.2;
function Cp(a,e,t) {
  const n=e?Wr(e).filter(s=>!s.dead):[];
  return(e==null?void 0:e.kind)==="enemy"&&e.only?n:n.length?[...n,...a.filter(s=>!n.includes(s))].slice(0,Math.max(1,t)):a
}
function ho(a) {
  return a.length? {
    kind:"enemy",e:a[0],all:a
  }
  :null
}
function ei(a) {
  return a.id.startsWith("atk_")
}
function zo(a,e,t,n) {
  return ei(e)?a.nearestEnemies(t,n):a.priorityEnemies(t,n)
}
function zy(a,e,t) {
  return e*a.stats.reachMult*(1+t.reach)+30
}
function Vv(a,e) {
  return e.splash>0&&e.splashR>0?e.splashR*uo*a.stats.areaMult*(1+e.area):0
}
function rk(a,e,t,n,s={}) {
  if(n<=0||t<=0)return;
  ea(a, {
    x:e.x,y:e.y
  },n,16765562,300);
  const o= {
    ...s,fromX:e.x,fromY:e.y,part:"Salpicadura"
  };
  for(const r of a.enemiesInRadius(e.x,e.y,n))r!==e&&a.damageEnemy(r,t,o)
}
const qH=8*Math.PI/180,dr= {
  skills:["fan_of_knives","throw_stone","sand_attack"],haste:40,dmg:.35,seconds:5
},HH=90,ik=22;
function Ly(a,e,t,n,s,o,r) {
  if(n<=0)return;
  const i=a.player,l=Nn(e.y-i.y,e.x-i.x),d=((r==null?void 0:r.angle)??HH)/2*(Math.PI/180),c=r?r.fx(a,i.x,i.y,l,t,d):hu(a,i.x,i.y,l,t,d);
  c&&a.addFx(c);
  const u= {
    ...s,fromX:i.x,fromY:i.y,part:r?void 0:"Cono"
  };
  for(const h of a.enemiesInRadius(i.x,i.y,t)) {
    if(o.has(h)||h.dead)continue;
    let m=Nn(h.y-i.y,h.x-i.x)-l;
    m=Nn(Sa(m),ln(m)),!(Math.abs(m)>d+Math.min(.6,ik/Math.max(1,Qt(h.x-i.x,h.y-i.y))))&&(o.add(h),a.damageEnemy(h,n,u))
  }
}
function Nd(a,e) {
  ei(e)?a.player.attack():a.player.cast()
}
function Gn(a,e,t) {
  const n=a.player;
  n.facingX=e-n.x,n.facingY=t-n.y,n.sprite.dir=tl(n.facingX,n.facingY)
}
function OH(a,e,t,n) {
  const s=zo(a,e,1,n);
  if(!s.length||t<=1)return s;
  const o=a.player,r=a.nearestEnemies(40,n).filter(c=>c!==s[0]),i=[s[0]],l=c=>Nn(c.y-o.y,c.x-o.x),d=(c,u)=>Math.abs(Nn(Sa(c-u),ln(c-u)));
  for(;i.length<t&&r.length;) {
    let c=0,u=-1;
    r.forEach((h,m)=> {
      const p=Math.min(...i.map(g=>d(l(h),l(g))));p>u&&([c,u]=[m,p])
    }),i.push(r.splice(c,1)[0])
  }
  return i
}
const lk=99,jH=8,GH=.75,VH=.2;
function WH(a,e) {
  if(a>=lk)return a;
  const t=a>0?1:0;
  let n=t;
  const s=Math.min(GH,e);
  for(;n<t+jH&&Wt()<s;)n++;
  return n
}
function $H(a) {
  var e;
  return(a.classDef.base??a.classDef.id)==="archer"&&((e=a.loadout.weapon)==null?void 0:e.wtype)==="활"?VH:0
}
class Ua extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n
  }
  aspects() {
    return this.cfg.aspects?this.cfg.aspects:["dmg","cd","count",...this.cfg.aim==="ring"?[]:["targets"],...this.piercesAll()?[]:["pierce"],"speed",...this.has("pierce")?["area"]:[]]
  }
  piercesAll() {
    var t,n;
    return(((n=(t=this.cfg).pierce)==null?void 0:n.call(t,1))??0)>=lk
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  count(t) {
    return Math.max(1,Math.round(this.cfg.count(this.level)))+t.stats.extraProjectiles+this.mod(t).count
  }
  targets(t) {
    return 1+this.up.targets+this.mod(t).targets
  }
  aim(t) {
    const n=this.cfg.range??600;
    return this.cfg.aim==="ring"?t.nearestEnemy(n)? {
      kind:"self",r:0
    }
    :null:ho(zo(t,this,this.targets(t),n))
  }
  fire(t,n) {
    var g;
    const s=this.cfg,o=this.level,r=this.mod(t),i=this.count(t),l=s.range??600,d=t.player,c=[];
    if(s.aim==="ring") {
      if(!t.nearestEnemy(l))return!1;
      const y=Wt()*Math.PI*2;
      for(let f=0;f<i;f++)c.push( {
        a:y+f/i*Math.PI*2,k:f
      })
    }
    else {
      const y=this.targets(t),f=Cp(s.cover?OH(t,this,y,l):zo(t,this,y,l),n,y);
      if(!f.length)return!1;
      this.shot=ho(f)??void 0,Gn(t,f[0].x,f[0].y),!n&&!ei(this)&&uu(t,f);
      const v=s.spread??.12;
      for(const b of f) {
        const _=Math.max(40,Qt(b.x-d.x,b.y-d.y));
        let S=i>1?s.cover?v:Math.min(v,WA(24/(i-1)/_)):0;
        i>1&&ei(this)&&(S=Math.max(S,qH));
        for(let M=0;M<i;M++)c.push( {
          x:b.x,y:b.y-30,a:(M-(i-1)/2)*S,k:M
        })
      }
    }
    if(Nd(t,this),s.sound&&!s.windup&&ce.play(s.sound,.35,3),s.castFx) {
      const y=s.castFx(t,d.x,d.y);
      y&&t.addFx(y)
    }
    const u=s.dmg(o)*(1+r.dmg),h=rs(((g=s.hit)==null?void 0:g.call(s,o,this))??{},r.hit),m=s.speed*t.stats.projSpeedMult*(1+r.speed),p=this.has("pierce")?t.stats.areaMult*(1+r.area):1;
    return c.forEach(y=> {
      const f=s.windup&&s.model?this.formModel(t,s,y,p):null,v=()=> {
        var A,w,T;const _=f?f.x:t.player.x,S=f?f.y-30:t.player.y-35;f&&((w=(A=f.model).form)==null||w.call(A,1),s.sound&&ce.play(s.sound,.35,3));const M=y.x===void 0?y.a:Nn(y.y-S,y.x-_)+y.a,k=y.x===void 0?0:Qt(y.x-_,y.y-S),C=s.view(M);C.scale.set(C.scale.x*p,C.scale.y*p),t.addProjectile(new Qq(C,_,S,ln(M)*m,Sa(M)*m,u, {
          aimDist:k,aimX:y.x===void 0?void 0:_+ln(M)*k,aimY:y.x===void 0?void 0:S+Sa(M)*k,pierce:WH(s.pierce?Math.round(s.pierce(o)):0,r.pierce+t.buffValue("trueSightPierce")+$H(t)+t.stats.pierceChance),splash:r.splash>0? {
            pct:r.splash,r:Vv(t,r)
          }
          :void 0,life:(s.life??1.6)*(s.reach?(1+r.reach)*s.speed/m:1),surge:!!s.surge,drag:h.drag??0,vortex:h.vortex??0,holy:h.holyTrail??0,model:f?f.model:(T=s.model)==null?void 0:T.call(s,t,p),radius:(s.radius??12)*p,spin:s.spin??0,orient:s.orient===void 0?0:s.orient,returns:!!s.returns,sound:s.hitSound??"",hitOpts:h,hitFx:s.hitFx
        }))
      },b=(s.windup??0)+(s.stagger&&y.k>0?y.k*s.stagger:0);b>0?t.schedule(b,v):v()
    }),!0
  }
  formModel(t,n,s,o) {
    const r=n.model(t,o),i= {
      model:r,x:t.player.x,y:t.player.y
    },l=(n.windup??0)*1e3,d=n.formAt??34;
    let c=0,u=!1;
    const h=m=> {
      var b;
      const p=t.player,g=s.x===void 0?s.a:Nn(s.y+5-p.y,s.x-p.x)+s.a,y=Math.min(1,c/l),f=Math.max(0,(y-$r)/(1-$r)),v=12*(1-(1-f)*(1-f));
      i.x=p.x+ln(g)*(d-v),i.y=p.y+Sa(g)*(d-v),(b=r.form)==null||b.call(r,y),r.update(i.x,i.y,g,m/1e3,Math.min(1,y*4)),!u&&y>=$r&&(u=!0,r.hidden||t.addFx(vr(t,i.x,i.y,55)))
    };
    return h(0),r.hidden||t.addFx(wN(t,i,l*$r)),t.addFx( {
      view:new ue,update(m) {
        return c+=m,c>=l?!0:(h(m),!1)
      }
    }),i
  }
}
class dn extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n
  }
  aspects() {
    return this.cfg.cone?["dmg","cd","area"]:["dmg","cd","reach","count"]
  }
  countUnit() {
    return"objetivo"
  }
  areaIsReach() {
    return!0
  }
  hitDamage(t) {
    return this.cfg.dmg(this.level)*(1+this.mod(t).dmg)
  }
  hitOpts(t) {
    var n,s;
    return {
      ...rs(((s=(n=this.cfg).hit)==null?void 0:s.call(n,this.level,this))??{},this.mod(t).hit),power:this.power(t)
    }
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  reach(t) {
    const n=this.mod(t);
    return zy(t,this.cfg.range(this.level),this.cfg.cone? {
      ...n,reach:n.reach+n.area
    }
    :n)
  }
  targets(t) {
    const n=this.mod(t);
    return 1+n.count+n.targets
  }
  pick(t,n) {
    const s=this.cfg,o=this.mod(t),r=this.reach(t);
    if(!(n>1&&o.cone>0&&s.slam))return zo(t,this,n,r);
    const i=zo(t,this,1,r)[0];
    if(!i)return[];
    const l=s.slam.r*t.stats.areaMult*(1+o.area);
    return YH(t,i,n,r,l)
  }
  aim(t) {
    return ho(this.pick(t,this.targets(t)))
  }
  fire(t,n) {
    var m,p;
    const s=this.cfg,o=this.level,r=this.mod(t),i=this.targets(t),l=Cp(this.pick(t,i),n,i);
    if(!l.length)return!1;
    this.shot=ho(l)??void 0;
    const d=t.player;
    Gn(t,l[0].x,l[0].y),Nd(t,this),!n&&!ei(this)&&uu(t,l);
    const c=s.dmg(o)*(1+r.dmg),u= {
      ...rs(((m=s.hit)==null?void 0:m.call(s,o,this))??{},r.hit),power:this.power(t)
    };
    s.sound&&ce.play(s.sound,.45,3);
    const h=new Set(l);
    for(const g of l) {
      if(g.dead)continue;
      const y=(p=s.fx)==null?void 0:p.call(s,t,g);
      y&&t.addFx(y),t.damageEnemy(g,c, {
        knock:40,fromX:d.x,fromY:d.y,...u
      }),s.cone?Ly(t,g,this.reach(t),c*Math.max(s.cone.pct,r.cone), {
        knock:40,...u
      },h,s.cone):r.cone>0&&s.slam?XH(t,g,s.slam.r*t.stats.areaMult*(1+r.area),c*r.cone, {
        knock:40,...u
      },h,s.slam.fx):r.cone>0&&Ly(t,g,this.reach(t),c*r.cone, {
        knock:40,...u
      },h),rk(t,g,c*r.splash,Vv(t,r),u)
    }
    return!0
  }
}
function YH(a,e,t,n,s) {
  const o=a.player,r=a.enemiesInRadius(o.x,o.y,n).filter(c=>!c.dead),i=new Map(r.map(c=>[c,a.enemiesInRadius(c.x,c.y,s).filter(u=>!u.dead)])),l=[e],d=new Set(i.get(e)??a.enemiesInRadius(e.x,e.y,s));
  for(d.add(e);l.length<t;) {
    let c=null,u=-1,h=-1;
    for(const m of r) {
      if(l.includes(m))continue;
      const p=(i.get(m)??[]).reduce((y,f)=>y+(d.has(f)?0:1),0),g=Math.min(...l.map(y=>Qt(y.x-m.x,y.y-m.y)));
      (p>u||p===u&&g>h)&&(c=m,u=p,h=g)
    }
    if(!c)break;
    l.push(c);
    for(const m of i.get(c)??[])d.add(m)
  }
  return l
}
function XH(a,e,t,n,s,o,r) {
  const i=r(a,e.x,e.y,t);
  if(i&&a.addFx(i),n<=0)return;
  const l= {
    ...s,fromX:e.x,fromY:e.y
  };
  for(const d of a.enemiesInRadius(e.x,e.y,t))o.has(d)||d.dead||(o.add(d),a.damageEnemy(d,n,l))
}
function dk(a,e,t,n,s,o) {
  return a.enemiesInRadius(e,t,s).filter(r=> {
    if(r.dead)return!1;let i=Nn(r.y-t,r.x-e)-n;return i=Nn(Sa(i),ln(i)),Math.abs(i)<=o+Math.min(.6,ik/Math.max(1,Qt(r.x-e,r.y-t)))
  })
}
const KH=120;
class JH extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n
  }
  aspects() {
    return["dmg","cd","area","count"]
  }
  countUnit() {
    return"andanada"
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  reach(t) {
    return this.cfg.range(this.level)*t.stats.areaMult*(1+this.mod(t).area)
  }
  half(t) {
    const n=1+(t.stats.areaMult*(1+this.mod(t).area)-1)*.5;
    return Math.min(KH,this.cfg.angle*n)/2*(Math.PI/180)
  }
  inCone(t,n,s,o,r) {
    return dk(t,n,s,o,r,this.half(t))
  }
  bestAngle(t) {
    const n=t.player,s=this.reach(t),o=t.enemiesInRadius(n.x,n.y,s).filter(c=>!c.dead);
    if(!o.length)return null;
    const r=o.length>16?zH(o,16):o,i=c=>c.def.boss?6:c.elite?3:1;
    let l=null,d=-1;
    for(const c of r) {
      const u=Nn(c.y-n.y,c.x-n.x),h=this.inCone(t,n.x,n.y,u,s),m=h.reduce((p,g)=>p+i(g),0);
      m>d&&(d=m,l= {
        ang:u,ts:h
      })
    }
    return l
  }
  aim(t) {
    const n=this.bestAngle(t);
    return n?ho(n.ts):null
  }
  fire(t,n) {
    var f;
    const s=this.cfg,o=this.level,r=this.mod(t),i=t.player;
    let l;
    const d=n?Wr(n).filter(v=>!v.dead):[];
    if(d.length)l=Nn(d[0].y-i.y,d[0].x-i.x);
    else {
      const v=this.bestAngle(t);
      if(!v)return!1;
      l=v.ang
    }
    const c=this.reach(t),u=this.inCone(t,i.x,i.y,l,c);
    this.shot=ho(u)??void 0,Gn(t,i.x+ln(l),i.y+Sa(l)),Nd(t,this),!n&&u.length&&uu(t,u);
    const h=s.dmg(o)*(1+r.dmg),m= {
      ...rs(((f=s.hit)==null?void 0:f.call(s,o,this))??{},r.hit),power:this.power(t)
    },p=Math.max(1,Math.round(s.volleys(o))+r.count),g=i.x,y=i.y;
    for(let v=0;v<p;v++)t.schedule(v*s.gap,()=> {
      var _;s.sound&&ce.play(s.sound,.4,3);const b=s.fx(t,g,y,l,c,this.half(t),v);b&&t.addFx(b);for(const S of this.inCone(t,g,y,l,c))t.damageEnemy(S,h, {
        fromX:g,fromY:y,...m
      });v===p-1&&((_=s.onLast)==null||_.call(s,t,g,y,l,c,this.half(t),h,m))
    });
    return!0
  }
}
class QH extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n
  }
  aspects() {
    return this.cfg.fixedCount?["dmg","cd","targets"]:["dmg","cd","count","targets"]
  }
  countUnit() {
    return this.cfg.fixedCount?"objetivo":"flecha"
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  count(t) {
    const n=Math.max(1,Math.round(this.cfg.count(this.level)));
    return this.cfg.fixedCount?n:n+t.stats.extraProjectiles+this.mod(t).count
  }
  targets(t) {
    return 1+this.up.targets+this.mod(t).targets
  }
  aim(t) {
    return ho(zo(t,this,this.targets(t),this.cfg.range))
  }
  sharpShot(t,n,s,o,r,i,l) {
    const d=Nn(s.y-n.y,s.x-n.x),c=Qt(s.x-n.x,s.y-n.y)+i.beyond,u=ln(d),h=Sa(d),m=i.fx(t,n, {
      x:n.x+u*c,y:n.y+h*c
    },c/i.speed*1e3);
    m&&t.addFx(m);
    for(const p of t.enemiesInRadius(n.x+u*c/2,n.y+h*c/2,c/2+i.width)) {
      const g=(p.x-n.x)*u+(p.y-n.y)*h,y=Math.abs(-(p.x-n.x)*h+(p.y-n.y)*u);
      g<0||g>c||y>i.width||t.schedule(g/i.speed,()=> {
        p.dead||t.damageEnemy(p,o*i.mult, {
          ...r,critBonus:(r.critBonus??0)+i.crit,part:"Sharp Shooting",knock:60,fromX:n.x,fromY:n.y,combo:p===s?l:void 0
        })
      })
    }
  }
  fire(t,n) {
    var g,y;
    const s=this.cfg,o=this.level,r=this.mod(t),i=this.targets(t),l=Cp(zo(t,this,i,s.range),n,i);
    if(!l.length)return!1;
    this.shot=ho(l)??void 0,Gn(t,l[0].x,l[0].y),Nd(t,this),n||uu(t,l);
    const d=this.count(t),c=s.dmg(o)*(1+r.dmg),u= {
      ...rs(((g=s.hit)==null?void 0:g.call(s,o,this))??{},r.hit),power:this.power(t)
    },h=s.flight/(t.stats.projSpeedMult*(1+r.speed)),m=((y=s.sharp)==null?void 0:y.call(s,t))??null,p=s.combo?l.map(()=>( {
      total:0,last:0,crit:!1
    })):null;
    for(let f=0;f<d;f++)t.schedule(f*s.gap,()=> {
      s.sound&&ce.play(s.sound,.3,4);const v=t.player;if(m&&f===d-1) {
        l.forEach((b,_)=>this.sharpShot(t, {
          x:v.x,y:v.y
        },b,c,u,m,p==null?void 0:p[_]));return
      }
      l.forEach((b,_)=> {
        const S=b.dead&&!p?t.nearestEnemies(1,s.range).find(A=>!A.dead):b;if(!S)return;const M= {
          x:S.x,y:S.y
        },k=(f+_)%2===0?1:-1,C=s.fx(t, {
          x:v.x,y:v.y
        },M,k,h*1e3,f);C&&t.addFx(C),t.schedule(h,()=> {
          if(S.dead&&p)return t.comboEcho(S,p[_], {
            sound:s.hitSound,...u
          });S.dead||Qt(S.x-M.x,S.y-M.y)>60||t.damageEnemy(S,c, {
            fromX:v.x,fromY:v.y,sound:s.hitSound,...u,combo:p==null?void 0:p[_]
          })
        })
      })
    });
    return!0
  }
}
class ZH extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n,this.noRepeat=!0
  }
  aspects() {
    return["dmg","cd"]
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  aim(t) {
    return ho(t.nearestEnemies(1,this.cfg.range))
  }
  fire(t,n) {
    var f;
    const s=this.cfg,o=t.player,i=(n?Wr(n).filter(v=>!v.dead):[])[0]??t.nearestEnemies(1,s.range)[0];
    if(!i)return!1;
    this.shot=ho([i])??void 0;
    const l=this.mod(t),d=s.dmg(this.level)*(1+l.dmg),c= {
      ...rs(((f=s.hit)==null?void 0:f.call(s,this.level,this))??{},l.hit),power:this.power(t)
    },u=Qt(o.x-i.x,o.y-i.y)||1,h= {
      x:o.x,y:o.y
    };
    let[m,p]=[o.x+(o.x-i.x)/u*s.dash,o.y+(o.y-i.y)/u*s.dash];
    t.walk&&([m,p]=t.walk.nearestWalkable(m,p));
    const g= {
      x:m,y:p
    };
    s.sound&&ce.play(s.sound,.45,2),s.dashFx(t,h,g),Gn(t,i.x,i.y),t.addBuff("immune",1,Math.max(s.dashTime+.1,s.immune??0),this.id);
    const y=6;
    for(let v=1;v<=y;v++)t.schedule(s.dashTime*v/y,()=> {
      const b=1-(1-v/y)*(1-v/y);o.x=h.x+(g.x-h.x)*b,o.y=h.y+(g.y-h.y)*b
    });
    return t.schedule(s.dashTime,()=> {
      var A;Nd(t,this),(A=s.onLand)==null||A.call(s,t,g.x,g.y);const v=i.dead?h.x:i.x,b=i.dead?h.y:i.y,_=Nn(b-g.y,v-g.x);Gn(t,v,b);const S=ln(_),M=Sa(_),k= {
        x:g.x+S*s.shot,y:g.y+M*s.shot
      },C=s.shotFx(t,g,k,s.shot/s.speed*1e3);C&&t.addFx(C);for(const w of t.enemiesInRadius(g.x+S*s.shot/2,g.y+M*s.shot/2,s.shot/2+s.width)) {
        const T=(w.x-g.x)*S+(w.y-g.y)*M,z=Math.abs(-(w.x-g.x)*M+(w.y-g.y)*S);T<0||T>s.shot||z>s.width||t.schedule(T/s.speed,()=> {
          w.dead||t.damageEnemy(w,d, {
            knock:80,fromX:g.x,fromY:g.y,...c
          })
        })
      }
    }),!0
  }
}
class Aa extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    x(this,"hold",0);
    this.cfg=n,this.countStep=n.targetStep??1
  }
  targetCount(t) {
    var l;
    const n=this.cfg,s=this.mod(t),o=n.targetStep??1,r=Math.round(n.count(1)),i=t.sharedUpgrades(this).up.count;
    return r+(Math.round(n.count(this.level))-r+s.count-i+s.targets)*o+i+(((l=n.bonusTargets)==null?void 0:l.call(n,t,!1))??0)
  }
  aspects() {
    const t=["cd"];
    return this.cfg.dmg(1)>0&&t.unshift("dmg"),(this.type!=="single"||this.cfg.moreTargets)&&t.push("count"),this.cfg.splash&&t.push("area"),this.cfg.melee&&t.push("reach"),t
  }
  countUnit() {
    return"objetivo"
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  claimHold() {
    return this.hold
  }
  pick(t,n) {
    var o;
    const s=this.cfg;
    if(s.target==="nearest") {
      const r=s.melee?zy(t,s.range??120,this.mod(t)):s.range??160;
      if(this.isBolt) {
        const d=zo(t,this,n,r);
        return!t.aimer||!d.some(c=>t.claimed(c))?d:zo(t,this,n,r*NH)
      }
      if(!s.apart||n<=1)return zo(t,this,n,r);
      const i=zo(t,this,Math.max(20,n*6),r),l=[];
      for(const d of i)l.length<n&&l.every(c=>Qt(c.x-d.x,c.y-d.y)>=s.apart)&&l.push(d);
      for(const d of i)l.length<n&&!l.includes(d)&&l.push(d);
      return l
    }
    if(s.target==="strongest")return t.strongestVisibleEnemies(n);
    if(s.target==="cluster") {
      const r=((o=s.clusterR)==null?void 0:o.call(s,t,this))??90;
      if(!s.bossFirst)return t.clusterTargets(n,r);
      const i=t.strongestVisibleEnemies(1/0).filter(l=>l.def.boss);
      return[...i,...t.clusterTargets(n+i.length,r).filter(l=>!l.def.boss)].slice(0,n)
    }
    return t.randomVisibleEnemies(n,!0)
  }
  aim(t) {
    return ho(this.pick(t,this.targetCount(t)))
  }
  fire(t,n) {
    var _,S,M,k;
    const s=this.cfg,o=this.level,r=this.mod(t),i=this.targetCount(t);
    (_=s.bonusTargets)==null||_.call(s,t,!0);
    const l=Cp(this.pick(t,i),n,i);
    if(!l.length)return!1;
    this.shot=ho(l)??void 0,!n&&!ei(this)&&uu(t,l),s.cast!==!1&&(Gn(t,l[0].x,l[0].y),Nd(t,this)),s.sound&&ce.play(s.sound,.4,3);
    const d=((S=s.boost)==null?void 0:S.call(s,t,this))??null,c=s.dmg(o)*(1+r.dmg)*(1+((d==null?void 0:d.dmg)??0)),u=((M=s.splash)==null?void 0:M.call(s,o))??0,h=u>0?u*t.stats.areaMult*(1+r.area):0,m=d? {
      ...r,splash:r.splash+d.splash,splashR:Math.max(r.splashR,d.splashM)
    }
    :r,p=Vv(t,m),g=rs(((k=s.hit)==null?void 0:k.call(s,o,this))??{},r.hit),y=s.burst?Math.max(1,Math.round(s.burst(t.sharedUpgrades(this).rank))+r.bolts):1,f=s.burstGap??.1;
    this.hold=(s.delay??0)+(y-1)*f;
    const v=s.melee&&r.cone>0?zy(t,s.range??120,r):0,b=new Set(l);
    for(let C=0;C<l.length*y;C++) {
      const A=C%y,w=l[Math.floor(C/y)],T=()=> {
        if(w.dead&&A>0)return;
        const L=s.fx(t,w.x,w.y,h);
        L&&t.addFx(L),s.castSounds&&ce.play(s.castSounds[Math.floor($s()*s.castSounds.length)],.35,4);
        const U=w.x,q=w.y,N=()=> {
          const H= {
            fromX:U,fromY:q,...g
          };
          if(h>0)for(const V of t.enemiesInRadius(U,q,h))t.damageEnemy(V,V===w?c:c*(s.splashPct??.7),H);
          else w.dead||t.damageEnemy(w,c, {
            ...H,fromX:t.player.x,fromY:t.player.y
          });
          v>0&&A===0&&Ly(t,w,v,c*r.cone,g,b),rk(t,w,c*m.splash,p,g)
        };
        s.delay?t.schedule(s.delay,N):N()
      },z=A*f;
      z>0?t.schedule(z,T):T()
    }
    return!0
  }
}
class fo extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n
  }
  aspects() {
    return["dmg","cd","count","area"]
  }
  countUnit() {
    return"impacto"
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  radii(t) {
    const n=this.mod(t);
    return {
      area:this.cfg.area(this.level)*t.stats.areaMult*(1+n.area),tr:this.cfg.tickRadius*t.stats.areaMult*(1+n.area*.5)
    }
  }
  spot(t) {
    const {
      area:n,tr:s
    }
    =this.radii(t),o=t.clusterSpot(n+s*.5,!0);
    if(!o)return null;
    const r=t.leadPoint(o.e,this.finalCastTime(t)+(this.cfg.delay??0));
    return {
      x:o.x+r.x-o.e.x,y:o.y+r.y-o.e.y
    }
  }
  aim(t) {
    const n=this.spot(t);
    if(!n)return null;
    const {
      area:s,tr:o
    }
    =this.radii(t);
    return {
      kind:"ground",x:n.x,y:n.y,r:s+o
    }
  }
  fire(t,n) {
    var y;
    const s=this.cfg,o=this.level,r=(n==null?void 0:n.kind)==="ground"?n:this.spot(t);
    if(!r)return!1;
    this.shot= {
      kind:"ground",x:r.x,y:r.y,r:0
    };
    const i=r.x,l=r.y,d=this.mod(t), {
      area:c,tr:u
    }
    =this.radii(t),h=s.dmg(o)*(1+d.dmg),m=rs(((y=s.hit)==null?void 0:y.call(s,o,this))??{},d.hit);
    Gn(t,i,l),t.player.cast(),s.sound&&ce.play(s.sound,.45,2);
    const p=s.delay??0;
    if(s.fxStart) {
      const f=s.fxStart(t,t.player.x,t.player.y,i,l,p,c);
      f&&t.addFx(f)
    }
    const g=Math.round(s.ticks(o))+d.count;
    for(let f=0;f<g;f++)t.schedule(p+f*s.interval,()=> {
      let v=i,b=l;if(s.scatter!==!1) {
        const S=Wt()*Math.PI*2,M=Math.sqrt(Wt())*c;v+=ln(S)*M,b+=Sa(S)*M*.7
      }
      const _=s.fxTick(t,v,b,u);_&&t.addFx(_),s.tickSound&&ce.play(s.tickSound,.3,3);for(const S of t.enemiesInRadius(v,b,u))t.damageEnemy(S,h, {
        fromX:v,fromY:b,...m
      })
    });
    return s.onEnd&&t.schedule(p+g*s.interval,()=>s.onEnd(t,i,l,c,h,m)),!0
  }
}
class xn extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n
  }
  aspects() {
    const t=this.cfg,n=["cd","area"];
    return t.dmg(1)>0&&n.push("dmg"),t.ticks&&n.push("count"),n
  }
  countUnit() {
    return"pulso"
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  aim(t) {
    const n=this.cfg.radius(this.level)*t.stats.areaMult*(1+this.mod(t).area);
    return this.cfg.needEnemies!==!1&&!this.inRing(t,n+30).length?null: {
      kind:"self",r:n
    }
  }
  inRing(t,n) {
    const s=t.player,o=(this.cfg.inner??0)*n,r=t.enemiesInRadius(s.x,s.y,n);
    return o>0?r.filter(i=>Qt(i.x-s.x,i.y-s.y)>=o):r
  }
  fire(t) {
    var h,m;
    const n=this.cfg,s=this.level,o=this.mod(t),r=n.radius(s)*t.stats.areaMult*(1+o.area),i=t.player;
    if(n.needEnemies!==!1&&!this.inRing(t,r+30).length)return!1;
    i.cast(),n.sound&&ce.play(n.sound,.45,2);
    const l=n.dmg(s)*(1+o.dmg),d=(n.ticks?Math.round(n.ticks(s)):1)+(n.ticks?o.count:0),c=n.grow!==void 0?d>1?n.grow/(d-1):0:n.interval??.15;
    (h=n.cast)==null||h.call(n,t,r,d,c,l);
    const u=rs(((m=n.hit)==null?void 0:m.call(n,s,this))??{},o.hit);
    for(let p=0;p<d;p++) {
      const g=n.grow!==void 0?r*(p+1)/d:r;
      t.schedule(p*c,()=> {
        n.cast?n.grow!==void 0&&ea(t,i,g,n.halo,300):n.inner?Iv(t,i,g,n.inner,n.halo):ea(t,i,g,n.halo);const y=n.fx(t,i.x,i.y,g);y&&t.addFx(y);let f=0;for(const v of this.inRing(t,g))if(l>0)t.damageEnemy(v,l, {
          fromX:i.x,fromY:i.y,...u
        });else if(t.applyStatus(v, {
          fromX:i.x,fromY:i.y,...u
        }),u.hitFx&&f++<8) {
          const b=u.hitFx(v.x,v.y);b&&t.addFx(b)
        }
      })
    }
    return!0
  }
}
class Wv extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    x(this,"orbs",[]);
    x(this,"orbScale",[]);
    x(this,"orbBack",[]);
    x(this,"angle",Wt()*Math.PI*2);
    x(this,"holder",new ue);
    x(this,"added",!1);
    x(this,"activeLeft",0);
    this.cfg=n
  }
  aspects() {
    return["dmg","cd","count","area","speed","duration"]
  }
  countUnit() {
    return"orbe"
  }
  speedKey() {
    return"orbitSpeed"
  }
  cooldown() {
    return 10
  }
  fire() {
    return!0
  }
  update(t,n) {
    var c;
    const s=this.cfg;
    this.added||(n.fxLayer.addChild(this.holder),this.added=!0);
    const o=this.mod(n);
    if(this.activeLeft<=0) {
      if(this.holder.visible=!1,this.timer-=t,this.timer>0)return;
      if(!n.nearestEnemy(350)) {
        this.timer=.15,this.waiting=!0;
        return
      }
      this.waiting=!1,this.activeLeft=s.uptime*(1+o.duration),n.player.cast(),s.sound&&ce.play(s.sound,.35,2)
    }
    if(this.holder.visible=!0,this.activeLeft-=t,this.activeLeft<=0) {
      if(s.onEnd) {
        const u=n.player,h=this.orbs.length,m=s.radius*n.stats.areaMult*(1+o.area),p=this.orbs.map((g,y)=>( {
          x:u.x+ln(this.angle+y/h*Math.PI*2)*m,y:u.y+Sa(this.angle+y/h*Math.PI*2)*m
        }));
        s.onEnd(n,p,u.x,u.y,s.dmg(this.level)*(1+o.dmg),rs(((c=s.hit)==null?void 0:c.call(s,this.level,this))??{},o.hit))
      }
      this.startCooldown(n);
      return
    }
    const r=Math.round(s.count(this.level))+o.count;
    for(;this.orbs.length<r;) {
      const u=s.view();
      this.holder.addChild(u),this.orbs.push(u),this.orbScale.push(u.scale.x)
    }
    this.angle+=t*s.speed*(1+o.speed);
    const i=n.player,l=s.radius*n.stats.areaMult*(1+o.area),d=s.dmg(this.level)*(1+o.dmg);
    this.orbs.forEach((u,h)=> {
      var f,v,b,_;const m=this.angle+h/r*Math.PI*2,p=i.x+ln(m)*l,g=i.y+Sa(m)*l,y=n.screenPos(p,g,25);if(u.position.set(y.x,y.y),u.scale.set(n.pixelScale(p,g)*this.orbScale[h]),"update"in u&&typeof u.update=="function"&&u.update(t*1e3),s.onOrb&&!(this.orbBack[h]>0)&&s.onOrb(n,p,g),s.pop) {
        const S=this.orbBack[h]=Math.max(0,(this.orbBack[h]??0)-t);if(u.visible=S<=0,S>0||!n.enemiesInRadius(p,g,24).some(C=>!C.dead))return;const M=s.pop.radius*n.stats.areaMult*(1+o.area),k=rs(((f=s.hit)==null?void 0:f.call(s,this.level,this))??{},o.hit);for(const C of n.enemiesInRadius(p,g,M))n.damageEnemy(C,d, {
          knock:70,fromX:p,fromY:g,...k
        });(b=(v=s.pop).fx)==null||b.call(v,n,p,g,M),s.sound&&ce.play(s.sound,.25,3),this.orbBack[h]=s.pop.respawn*ep(o.cd);return
      }
      for(const S of n.enemiesInRadius(p,g,22))(S.hitBy.get(this)??0)>0||(S.hitBy.set(this,s.hitCd*ep(o.cd)),n.damageEnemy(S,d, {
        knock:50,fromX:i.x,fromY:i.y,...rs(((_=s.hit)==null?void 0:_.call(s,this.level,this))??{},o.hit)
      }),s.sound&&ce.play(s.sound,.2,2))
    })
  }
  clearScene(t) {
    super.clearScene(t),this.holder.visible=!1
  }
  destroy() {
    this.holder.destroy( {
      children:!0
    })
  }
}
class Tp extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    x(this,"zones",[]);
    this.cfg=n
  }
  aspects() {
    return this.cfg.single?["dmg","cd","area","duration"]:["dmg","cd","count","area","duration"]
  }
  countUnit() {
    return"celda"
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  spot(t) {
    if(this.cfg.at)return this.cfg.at(t,this);
    if(this.cfg.on)return this.cfg.on(t,this);
    const n=t.priorityEnemies(1,420)[0];
    if(!n)return null;
    const s=t.player,o=t.leadPoint(n,this.finalCastTime(t)),r=Nn(o.y-s.y,o.x-s.x),i=Qt(o.x-s.x,o.y-s.y),l=this.cfg.near,d=l!==void 0?Math.max(l,i-this.cfg.cellRadius*.6):Math.min(110,Math.max(40,i*.6));
    return {
      x:s.x+ln(r)*d,y:s.y+Sa(r)*d
    }
  }
  aim(t) {
    const n=this.spot(t);
    if(!n)return null;
    if(this.cfg.at)return {
      kind:"self",r:this.cfg.cellRadius*t.stats.areaMult*(1+this.mod(t).area)
    };
    const s=Math.round(this.cfg.cells(this.level))+(this.cfg.single?0:this.mod(t).count);
    return {
      kind:"ground",x:n.x,y:n.y,r:(s*(this.cfg.gap??34)/2+this.cfg.cellRadius)*t.stats.areaMult
    }
  }
  fire(t,n) {
    const s=this.cfg,o=this.cfg.at?this.cfg.at(t,this):(n==null?void 0:n.kind)==="ground"?n:this.spot(t);
    if(!o)return!1;
    this.shot= {
      kind:"ground",x:o.x,y:o.y,r:0
    };
    const r=t.player;
    return Gn(t,o.x,o.y),r.cast(),s.sound&&ce.play(s.sound,.45,2),this.place(t,o.x,o.y),!0
  }
  place(t,n,s) {
    var h;
    const o=this.cfg,r=t.player,i=Nn(s-r.y,n-r.x),l=Math.round(o.cells(this.level))+(o.single?0:this.mod(t).count),d=-Sa(i),c=ln(i),u=t.time+o.duration(this.level)*(1+this.mod(t).duration);
    for(let m=0;m<l;m++) {
      const p=(m-(l-1)/2)*(o.gap??34)*t.stats.areaMult,g=n+d*p,y=s+c*p*.75;
      let f=null;
      o.view&&(f=o.view(),f.position.set(g,y),f.zIndex=y,t.entityLayer.addChild(f));
      const v=(h=o.fx)==null?void 0:h.call(o,t,g,y,(u-t.time)*1e3);
      v&&t.addFx(v),this.zones.push( {
        x:g,y,until:u,tick:0,view:f
      })
    }
  }
  update(t,n) {
    super.update(t,n),this.tickZones(t,n)
  }
  tickZones(t,n) {
    var l,d,c,u,h;
    const s=this.cfg,o=this.mod(n),r=s.dmg(this.level)*(1+o.dmg);
    for(const m of this.zones) {
      if(m.view&&"update"in m.view&&m.view.update(t*1e3),m.tick-=t,m.tick<=0) {
        m.tick=s.tick;
        const g=s.cellRadius*n.stats.areaMult*(1+o.area);
        for(const y of n.enemiesInRadius(m.x,m.y,g))n.damageEnemy(y,r, {
          fromX:m.x,fromY:m.y,...rs(((l=s.hit)==null?void 0:l.call(s,this.level,this))??{},o.hit)
        });
        (d=s.onTick)==null||d.call(s,n,m.x,m.y,g,this)
      }
      const p=m.until-n.time;
      p<.4&&m.view&&(m.view.alpha=Math.max(0,p/.4))
    }
    const i=this.zones.filter(m=>m.until>n.time);
    for(const m of this.zones)m.until>n.time||((c=m.view)==null||c.destroy( {
      children:!0
    }),(h=s.onEnd)==null||h.call(s,n,m.x,m.y,r,rs(((u=s.hit)==null?void 0:u.call(s,this.level,this))??{},o.hit)));
    this.zones=i
  }
  clearScene(t) {
    super.clearScene(t),this.destroy()
  }
  destroy() {
    var t;
    for(const n of this.zones)(t=n.view)==null||t.destroy( {
      children:!0
    });
    this.zones=[]
  }
}
class pt extends po {
  constructor(t,n,s,o=["cd","duration"]) {
    super(t);
    x(this,"cd");
    x(this,"onFire");
    x(this,"caps");
    x(this,"lowHp",0);
    this.cd=n,this.onFire=s,this.caps=o
  }
  aspects() {
    return this.caps
  }
  countUnit() {
    return"carga"
  }
  dur(t) {
    return 1+this.mod(t).duration
  }
  cooldown() {
    return this.cd(this.level)
  }
  fire(t) {
    return this.lowHp>0&&t.hp>t.stats.maxHp*this.lowHp?!1:this.onFire(t,this.level,this)
  }
  onLowHp(t) {
    return this.lowHp<=0||this.timer>0&&!this.waiting||this.isCasting()||!this.onFire(t,this.level,this)?!1:(this.startCooldown(t),!0)
  }
}
class ck extends po {
  constructor(t,n) {
    super(t);
    x(this,"cfg");
    this.cfg=n
  }
  aspects() {
    return["dmg","cd","area"]
  }
  cooldown() {
    return this.cfg.cd(this.level)
  }
  fire() {
    return!1
  }
  update(t) {
    this.timer-=t,this.timer<=0&&(this.waiting=!0)
  }
  onPlayerHit(t,n) {
    var l,d;
    if(this.timer>0)return;
    this.startCooldown(t);
    const s=this.mod(t),o=t.player;
    Gn(t,n.x,n.y),o.cast(),this.cfg.sound&&ce.play(this.cfg.sound,.5);
    const r=this.cfg.radius(this.level)*t.stats.areaMult*(1+s.area);
    ea(t,o,r,16765562),this.cfg.fx?this.cfg.fx(t,o.x,o.y,r):t.addFx(ri(Yv(o.x,o.y-25,r,16765562),25));
    const i=this.cfg.dmg(this.level)*(1+s.dmg);
    t.damageEnemy(n,i*1.5, {
      knock:260,fromX:o.x,fromY:o.y,src:this.id,...(d=(l=this.cfg).hit)==null?void 0:d.call(l,this.level,this)
    });
    for(const c of t.enemiesInRadius(o.x,o.y,r))c!==n&&t.damageEnemy(c,i, {
      knock:180,fromX:o.x,fromY:o.y,src:this.id
    })
  }
}
function $v(a,e,t,n={}) {
  const s=new Fn(xt.sheet(a),n.action??"a0");
  s.loop=(n.loops??1)>1,n.scale&&s.scale.set(n.scale),n.tint!==void 0&&(s.tint=n.tint),n.add!==!1&&(s.blendMode="add");
  const o=new ue;
  o.position.set(e,t),o.addChild(s);
  const r=n.speed??1,i=n.ms??s.duration*(n.loops??1)/r,l=new ds(o,i,d=> {
    s.update(16*r),d>.8&&(s.alpha=(1-d)/.2)
  });
  return l.upright=!n.ground,l
}
function Pp(a,e=1,t=!0,n="a0") {
  const s=new Fn(xt.sheet(a),n);
  return s.scale.set(e),t&&(s.blendMode="add"),s
}
function n9(a,e,t,n,s,o,r=300) {
  const i=new et;
  i.position.set(a,e-20),t+=Ha.yaw;
  const l=Array.from( {
    length:26
  },()=>( {
    a:t+($s()*2-1)*s,d:.3+$s()*.7,s:1.5+$s()*2
  }));
  return ri(new ds(i,r,(d,c)=> {
    const u=c;u.clear();for(const h of l)u.circle(ln(h.a)*n*h.d*(.3+.7*d),Sa(h.a)*n*h.d*(.3+.7*d),h.s).fill( {
      color:o,alpha:1-d
    })
  }),20)
}
function s9(a,e,t,n,s) {
  const o=new et;
  return o.position.set(a,e),o.blendMode="add",new ds(o,s,(r,i)=> {
    const l=i;l.clear();const d=t*(.3+.7*Math.sqrt(r));l.circle(0,0,d).fill( {
      color:n,alpha:.25*(1-r)
    }),l.circle(0,0,d).stroke( {
      width:6,color:n,alpha:.9*(1-r)
    })
  })
}
function Yv(a,e,t,n=15135999) {
  const s=new et;
  return s.position.set(a,e),s.blendMode="add",new ds(s,320,(o,r)=> {
    const i=r;i.clear();for(let l=0;l<3;l++) {
      const d=o*Math.PI*4+l*Math.PI*2/3;i.arc(0,0,t*(.6+.4*o),d,d+1.4).stroke( {
        width:6*(1-o)+1,color:n,alpha:1-o
      })
    }
  })
}
function o9(a,e,t=16773808) {
  const n=new et;
  n.position.set(a,e),n.blendMode="add";
  const s=$s()*Math.PI;
  return new ds(n,140,(o,r)=> {
    const i=r;i.clear();const l=6+14*o;for(let d=0;d<4;d++) {
      const c=s+d*Math.PI/2;i.moveTo(0,0).lineTo(ln(c)*l,Sa(c)*l)
    }
    i.stroke( {
      width:3,color:t,alpha:1-o
    })
  })
}
function Rp(a,e) {
  const t=new ue;
  t.position.set(a,e);
  const n=Array.from( {
    length:7
  },()=> {
    const s=new Fn(xt.sheet("fx_coin"),"a0");return s.scale.set(1.6),t.addChild(s), {
      s,vx:($s()-.5)*160,vy:-120-$s()*120
    }
  });
  return new ds(t,650,s=> {
    for(const o of n)o.s.update(16),o.s.position.set(o.vx*s,o.vy*s+380*s*s),o.s.alpha=1-s*s
  })
}
function uk(a,e,t,n,s,o) {
  const r=new ue;
  r.addChild(a);
  const i= {
    x:e,y:t
  },l=new ds(r,o,d=> {
    i.x=e+(n-e)*d,i.y=t+(s-t)*d,a.position.set(0,-35+5*d-Sa(d*Math.PI)*90),a.rotation=d*10
  });
  return l.anchor=i,l
}
function Xv(a) {
  const e=new et;
  return e.moveTo(-10,0).lineTo(4,0).stroke( {
    width:2,color:16769674,alpha:.6
  }),e.circle(4,0,2).fill(16774856),e.blendMode="add",e.rotation=a,e
}
function zp(a,e=16777215,t=9) {
  const n=new et;
  return n.circle(0,0,t).fill( {
    color:a,alpha:.5
  }).circle(0,0,t*.55).fill( {
    color:e,alpha:.95
  }),n.blendMode="add",n
}
const ga=ra/2;
function $t(a) {
  return xt.fxTextures.get(a)
}
function hk(a,e=.4,t=3) {
  ce.play(a[Math.floor(Math.random()*a.length)],e,t)
}
const eO=["hit_fist1","hit_fist2","hit_fist3","hit_fist4"];
function kt(a,e,t,n=1,s=0,o=0) {
  const r=qN(a,e,t,n,o);
  return r&&(r.lift=s),r
}
function xa(a,e) {
  return a&&(a.anchor= {
    get x() {
      return e.x
    },get y() {
      return e.y
    }
  }),a
}
function Lp(a,e,t,n=1,s=0) {
  return kt(a[Math.floor(Math.random()*a.length)],e,t,n,s)
}
function Yo(a,e=!0) {
  const t=new Ra(a);
  return t.anchor.set(.5),e&&(t.blendMode="add"),t
}
function r9(a=1) {
  const e=Array.from( {
    length:13
  },(r,i)=>$t(`tex_torch${i+1}`)).filter(r=>!!r);
  if(!e.length)return null;
  const t=new ue,n=[0,6].map((r,i)=> {
    const l=Yo(e[r]);return l.anchor.set(.5,.84),l.scale.set(a*(i?.8:1),a*(i?.9:1)),l.alpha=i?.7:1,t.addChild(l), {
      s:l,k:r
    }
  });
  let s=Math.random()*2e3;
  const o= {
    view:t,upright:!0,off:!1,update(r) {
      if(o.off)return!0;
      s+=r;
      for(const i of n)i.s.texture=e[(Math.floor(s/65)+i.k)%e.length];
      return n[0].s.alpha=.88+.12*Math.sin(s/95),!1
    }
  };
  return o
}
function Da(a,e,t=30,n=1) {
  const s=new ue;
  s.position.set(a,e-t);
  const o=[];
  [[0,35],[50,85],[100,135],[150,185],[200,235],[255,290],[300,335],[340,360]].forEach(([l,d],c)=> {
    const u=Yo($t(c%2?"tex_lens2":"tex_lens1"));u.anchor.set(.5,1);const h=(l+Math.random()*(d-l))*Math.PI/180;u.rotation=h,s.addChild(u),o.push( {
      s:u,a:h,len:(250+Math.random()*50)/300,dur:200+Math.random()*150
    })
  }),s.scale.set(n);
  const i=new ds(s,350,l=> {
    const d=l*350;for(const c of o) {
      const u=Math.min(1,d/c.dur);c.s.width=30*(1-u)+2,c.s.height=10+60*c.len*u;const h=6+10*u;c.s.position.set(Math.sin(c.a)*h,-Math.cos(c.a)*h),c.s.alpha=1-u
    }
  });
  return i.upright=!0,ri(i,t)
}
function vs(a,e,t=40) {
  const n=new ue;
  n.position.set(a,e-t);
  const s=Yo($t("tex_alpha_down"));
  n.addChild(s);
  const o=[];
  for(let i=0;i<18;i++) {
    const l=Yo($t("tex_alpha_center"));
    l.anchor.set(.5,1),l.rotation=Math.random()*Math.PI*2,n.addChild(l),o.push( {
      s:l,max:i<10?2.5:4
    })
  }
  const r=new ds(n,600,i=> {
    const l=.6*(i<.2?i/.2:1-(i-.2)/.8),d=(.1+1.9*Math.min(1,i*1.6))*ga;s.width=s.height=d*2,s.alpha=l;for(const c of o)c.s.width=10,c.s.height=c.max*ga*Math.min(1,i*1.6),c.s.alpha=l
  });
  return r.upright=!0,ri(r,t)
}
function su(a,e,t,n=500,s=1) {
  const o=new ue;
  o.position.set(a,e);
  const r=Yo(t[0]);
  o.addChild(r);
  const i=2.2*ga*(Math.random()<.5?-1:1),l=new ds(o,n,d=> {
    const c=d*d;r.position.set(i*(1-c),-640*(1-c)-30),r.rotation=Math.atan2(20*ga,-i);const u=t[Math.floor(d*n/30)%t.length];u&&r.texture!==u&&(r.texture=u),r.scale.set(s),r.alpha=d>.92?(1-d)/.08:1
  });
  return l.upright=!0,l
}
function Vn(a,e,t,n=10,s=16777215,o=1e3,r=5*ga,i=.35) {
  const l=new ue;
  l.position.set(a,e);
  const d=Array.from( {
    length:n
  },()=> {
    const u=Yo(t);return u.tint=s,l.addChild(u), {
      s:u,x:(Math.random()-.5)*2*ga,z:Math.random()*ga,v:.5+Math.random()*.8,d:Math.random()*.4,sz:i*(.7+Math.random()*.6)
    }
  }),c=new ds(l,o,u=> {
    for(const h of d) {
      const m=Math.max(0,Math.min(1,(u-h.d)/(1-h.d)));h.s.position.set(h.x,-h.z-r*h.v*m),h.s.scale.set(h.sz),h.s.alpha=m<=0?0:m<.2?m/.2:1-(m-.2)/.8
    }
  });
  return c.upright=!0,c
}
function tO(a,e,t) {
  const n=new ue;
  n.position.set(a,e);
  const s=Yo($t(t?"tex_agi_up":"tex_slow"));
  n.addChild(s);
  const o=Array.from( {
    length:t?12:16
  },()=> {
    const i=Yo($t("tex_ac_center2"));return i.width=2.5*2,n.addChild(i), {
      s:i,x:(Math.random()-.5)*3*ga,h:15+Math.random()*45,d:Math.random()*.5
    }
  }),r=new ds(n,1e3,i=> {
    const l=i<.15?i/.15:1-(i-.15)/.85,d=t?.4+2.6*i:2.8-2.4*i;s.position.set(0,-d*ga*1.6),s.alpha=l;for(const c of o) {
      const u=Math.max(0,Math.min(1,(i-c.d)/(1-c.d))),h=t?u*6:6-u*6;c.s.position.set(c.x,-h*ga*.6),c.s.height=c.h,c.s.alpha=u<=0?0:1-u
    }
  });
  return r.upright=!0,r
}
function Ud(a,e,t,n={}) {
  const s=new Fn(xt.sheet(a),"a0");
  n.scale&&s.scale.set(n.scale),n.add&&(s.blendMode="add");
  const o=new ue;
  o.position.set(e,t-(n.lift??0)),o.addChild(s);
  const r=new ds(o,n.ms??s.duration,()=>s.update(16));
  return r.upright=!0,ri(r,n.lift??0)
}
function aO(a,e,t,n,s=900) {
  const o=new Fn(xt.sheet("fx_emotion"),"a"+a);
  o.loop=!1;
  const r=new ue;
  r.position.set(e,t-n),r.addChild(o);
  const i=new ds(r,s,l=> {
    o.update(16),r.alpha=l<.75?1:(1-l)/.25
  });
  return i.upright=!0,ri(i,n)
}
function wu(a,e,t,n) {
  const s=$t("tex_ring_white");
  s&&(a.cylinder(e,t, {
    texture:s,bottom:.95*ga,top:.95*ga,height:8*ga,duration:1500,alpha:.35,color:[.7,1,.7],animation:1,rotate:!0,fade:!0,follow:n
  }),a.cylinder(e,t, {
    texture:s,bottom:1*ga,top:1*ga,height:8*ga,duration:1500,alpha:.35,color:[.7,1,.7],animation:1,rotate:!0,fade:!0,follow:n
  }));
  const o=Vn(e,t,$t("tex_pok3"),15,16777215,1300,6*ga,.3);
  a.addFx(n?xa(o,n()):o)
}
function nO(a,e,t) {
  const n=$t("tex_ring_yellow"),s=$t("tex_bigbang");
  n&&a.cylinder(e,t, {
    texture:n,bottom:4*ga,top:6*ga,height:1*ga,duration:300,alpha:.7,animation:4,rotate:!0,fade:!0
  }),s&&a.cylinder(e,t, {
    texture:s,bottom:4*ga,top:1*ga,height:4*ga,duration:300,alpha:.6,animation:4,rotate:!0,fade:!0
  }),a.shake(.3,6)
}
function Mu(a,e,t) {
  const n=$t("tex_ring_blue");
  n&&a.cylinder(e,t, {
    texture:n,bottom:2*ga,top:3.2*ga,height:.1*ga,duration:1e3,delay:500,alpha:.7,animation:4,rotate:!0,fade:!0
  })
}
function sO(a,e,t,n) {
  const s=$t("tex_stormkick");
  s&&a.cylinder(e,t, {
    texture:s,bottom:n*.9,top:n,height:1.2*ga,duration:450,alpha:.8,animation:2,rotate:!0,fade:!0
  })
}
const g0=250,oO=5,rO=20,iO=.3;
let Ax=-1/0;
function lO(a,e,t,n,s=1,o=!0) {
  const r=e.x,i=e.y,l=t.x-r,d=t.y-i,c=Math.hypot(l,d)||1,u=l/c,h=d/c,m=n%5*72*Math.PI/180,p=4*ga*(1+n%5*.1),g=3*ga,y=_=> {
    const S=Math.sin(Math.PI*_),M=p*S*Math.cos(m);
    return {
      x:r+l*_-u*g*S-h*M,y:i+d*_-h*g*S+u*M,h:45*(1-_)+30*_+Math.max(-30,p*S*Math.sin(m)*.8)
    }
  },f=Yo($t("tex_pok3")),v=new ue;
  v.addChild(f);
  const b=new ds(v,450,_=> {
    const S=Math.max(0,(_*450-250)/200);f.width=f.height=50,f.position.set(0,-(5.5-4.5*S)*ga),f.alpha=S<=0?0:Math.sin(Math.PI*S)
  });
  b.upright=!0,o&&Math.abs(a.time-Ax)>=iO&&(Ax=a.time,a.addFx(xa(b,a.player)));
  for(let _=0;_<oO;_++) {
    const S=Yo(xt.sheet("fx_particle1").action("a0").dirs[0][0]);
    S.tint=14674431,_===0&&(S.blendMode="normal");
    const M=new ue;
    M.addChild(S);
    const k= {
      x:r,y:i
    },C=_*rO;
    let A=null;
    const w=new ds(M,g0+C,T=> {
      const z=Math.max(0,Math.min(1,(T*(g0+C)-C)/g0)),L=y(z);k.x=L.x,k.y=L.y,A&&(A.lift=L.h),S.width=S.height=64*(1+3*z)*(1-_*.12)*s,S.alpha=(z<=0?0:1)*(1-_*.17)
    });
    A=w,w.lift=y(0).h,w.anchor=k,w.upright=!0,a.addFx(w)
  }
}
const ou= {
  str: {
    bonus:Id,suffix:"of Strength"
  },agi: {
    bonus:_u,suffix:"of Agility"
  },vit: {
    bonus:Hv,suffix:"of Vitality"
  },int: {
    bonus:Mp,suffix:"of Intelligence"
  },dex: {
    bonus:Ov,suffix:"of Dexterity"
  },luk: {
    bonus:BA,suffix:"of Luck"
  }
},dO=1,Kv= {
  crit: {
    bonus:Ee,base:.01
  },pierce: {
    bonus:FU,base:.01
  },cd: {
    bonus:tt,base:.01
  },area: {
    bonus:Ut,base:.01
  },hp: {
    bonus:Ge,base:5
  },armor: {
    bonus:lt,base:.4
  },spd: {
    bonus:gt,base:.01
  },flee: {
    bonus:ut,base:.01
  }
},kx=["crit","cd","area"];
function cO(a) {
  const e=gs[a];
  return!!e&&(e.slot==="armor"||e.slot==="weapon"&&UU.has(e.wtype??""))?[...kx,"pierce"]:kx
}
const uO=["hp","armor","spd","flee"],hO= {
  dmg:X,cast:Ys,regen:ma,pickup:rl,exp:Io,zeny:mo,dodge:ut
},Dy=[[],[1],[1,3],[1,2,3,4],[1,2,3,4]];
function i9(a) {
  return Dy[Math.max(0,Math.min(Dy.length-1,a))].length
}
const y0=[.1,.2];
let Wo=null;
function mO(a) {
  Wo=a
}
const mk=a=>a[Math.floor(Math.random()*a.length)];
function pk(a,e) {
  const t=gs[a],n=t?WU(t)??t.jobs:void 0,s=e?al(e):[];
  if(!n)return s.length?s:[...wp,...gu].map(i=>i.id);
  const o=s.filter(i=>n.includes(i));
  if(o.length)return o;
  const r=n.filter(i=>!nu(i).base);
  return e&&!nu(e).base&&r.length?r:n
}
function l9(a) {
  return(Wo==null?void 0:Wo.damaging(pk(0,a)))??[]
}
function pO(a,e) {
  const t=(Wo==null?void 0:Wo.damaging(pk(a,e)))??[];
  return t.length? {
    stat:"skill",value:Math.round((y0[0]+(y0[1]-y0[0])*Math.random())*100)/100,skill:mk(t)
  }
  :null
}
function d9(a,e=1,t=0,n) {
  const s=Math.max(0,Math.min(Ep.length-1,a)),o=DA(e).mult,r=[],i=Object.keys(ou);
  for(const l of Dy[s])if(l===1||l===2) {
    const d=i.splice(Math.floor(Math.random()*i.length),1)[0];
    r.push( {
      stat:d,value:dO*o
    })
  }
  else {
    const d=mk(l===3?cO(t):uO);
    r.push( {
      stat:d,value:Number((Kv[d].base*o).toFixed(3))
    })
  }
  if(s===Wi) {
    const l=pO(t,n);
    l&&r.push(l)
  }
  return r
}
function fO(a,e) {
  const t=(Wo==null?void 0:Wo.name(a.skill??""))??a.skill??"";
  return bt("+{p}% de daño de {skill}", {
    p:Qr(a.value*e*100,1),skill:t
  })
}
function gO(a) {
  if(a.stat==="skill")return a.skill? {
    apply:()=>{},text:s=>fO(a,s)
  }
  :null;
  const e=ou[a.stat];
  if(e)return e.bonus(a.value);
  const t=Kv[a.stat];
  if(t)return t.bonus(a.value);
  const n=hO[a.stat];
  return n?n(a.value):null
}
function c9(a) {
  return(a??[]).map(gO).filter(e=>!!e)
}
function u9(a,e=1) {
  return(a??[]).filter(t=>t.stat==="skill"&&t.skill).map(t=>( {
    skill:t.skill,dmg:t.value*e
  }))
}
function h9(a) {
  return(a??[]).every(e=>e.stat==="skill"||e.stat in ou||e.stat in Kv)
}
function m9(a) {
  let e=null;
  for(const t of a??[])t.stat in ou&&(!e||t.value>e.value)&&(e=t);
  return e?ou[e.stat].suffix:""
}
const fk=`
  uniform float time;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    // el embudo se ondula al girar: la silueta no queda como un cono recto
    vec3 p = position;
    float wob = 1.0 + 0.2 * sin(atan(p.z, p.x) * 3.0 + p.y * 0.09 - time * 7.0) + 0.1 * sin(p.y * 0.21 + time * 5.0);
    p.xz *= wob;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`,gk=`
  uniform float time;
  uniform float alpha;
  uniform float seed;
  uniform float hot;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  ${Ks}
  void main() {
    float v = vUv.y; // 0 abajo, 1 arriba
    // espiral: las llamas giran alrededor del embudo y suben
    // (en ángulo, para que el ruido dé la vuelta sin costura donde se cierra el embudo)
    float ang = 6.2831 * (vUv.x + v * 1.6 - time * 1.8);
    float n = fbm(vec2(cos(ang) * 1.8 + seed, sin(ang) * 1.8 + v * 4.0 - time * 5.0));
    float bands = 0.5 + 0.5 * sin(ang * 3.0);
    // los bordes de la silueta (vistos de lado) pesan más que lo que mira de frente
    float rim = 1.0 - abs(dot(normalize(vN), normalize(vView)));
    float heat = (n * 0.85 + bands * 0.3) * mix(1.05, 0.5, v) * (0.55 + 0.55 * rim) + hot;
    vec3 col = fireRamp(clamp(heat, 0.0, 1.0));
    // los bordes de la silueta se difuminan (si no, el cono deja una línea dura)
    float a = smoothstep(0.32, 0.7, heat) * smoothstep(0.0, 0.1, v) * (1.0 - smoothstep(0.7, 1.0, v)) * (1.0 - smoothstep(0.8, 1.0, rim));
    gl_FragColor = vec4(col, a * alpha);
  }`,Ms=(a,e)=>a+Math.random()*(e-a);
class yO {
  constructor(e,t,n,s,o,r,i) {
    x(this,"view",new ue);
    x(this,"group",new on);
    x(this,"mats",[]);
    x(this,"layers",[]);
    x(this,"embers");
    x(this,"glow");
    x(this,"t",0);
    this.g=e,this.cx=t,this.cy=n,this.area=s,this.life=o,this.phase=r,this.size=i;
    const l=(d,c,u,h)=> {
      const m=new Fo(d,c,u,28,14,!0);
      m.translate(0,u/2,0);
      const p=new Ze( {
        vertexShader:fk,fragmentShader:gk,uniforms: {
          time: {
            value:Math.random()*10
          },alpha: {
            value:0
          },seed: {
            value:Math.random()*40
          },hot: {
            value:h
          }
        },transparent:!0,depthWrite:!1,blending:Rt,side:rt
      }),g=new Ie(m,p);
      g.frustumCulled=!1,g.renderOrder=7,this.mats.push(p),this.layers.push(g),this.group.add(g)
    };
    l(38*i,9*i,150*i,0),l(22*i,5*i,130*i,.12),e.world3d.scene.add(this.group),this.embers=new Ot(e,160),e.addFx(this.embers),this.glow=e.groundSprite(zd(),!0),this.glow.tint=16738842,this.glow.size=90*i,this.glow.alpha=0
  }
  update(e) {
    const t=e/1e3;
    if(this.t+=t,this.t/this.life>=1)return this.dispose(),!0;
    const s=Math.min(1,this.t/.18,(this.life-this.t)/.4),o=this.phase+this.t*1.6,r=this.area*(.6+.2*Math.sin(this.t*3+this.phase)),i=this.cx+Math.cos(o)*r,l=this.cy+Math.sin(o)*r*.7,d=this.g.world3d.heightAt(i,l);
    this.group.position.set(i,d,l),this.group.rotation.z=Math.sin(this.t*4+this.phase)*.08,this.layers[0].rotation.y+=t*7,this.layers[1].rotation.y-=t*11;
    for(const c of this.mats)c.uniforms.time.value+=t,c.uniforms.alpha.value=s;
    if(this.glow.x=i,this.glow.y=l,this.glow.alpha=.45*s,s>.3) {
      const c=Math.floor(90*t+Math.random());
      for(let u=0;u<c;u++) {
        const h=Math.random()*Math.PI*2,m=Ms(0,40)*this.size,p=(9+m*.25)*this.size,g=Ms(60,130);
        this.embers.emit( {
          x:i+Math.cos(h)*p,y:d+m,z:l+Math.sin(h)*p,vx:-Math.sin(h)*g+Math.cos(h)*20,vy:Ms(80,150),vz:Math.cos(h)*g+Math.sin(h)*20,life:Ms(500,850),s0:Ms(3.5,5.5),s1:1.5,c0:[1,.85,.45],c1:[.85,.2,.03],a0:1,drag:1.2
        })
      }
      if(Math.random()<.5) {
        const u=Math.random()*Math.PI*2;
        this.embers.emit( {
          x:i+Math.cos(u)*12,y:d+4,z:l+Math.sin(u)*12,vx:Math.cos(u)*40,vy:Ms(20,50),vz:Math.sin(u)*40,life:Ms(220,340),s0:Ms(18,24)*this.size,s1:8,c0:[1,.75,.3],c1:[.7,.12,.02],a0:.7,drag:3
        })
      }
    }
    return!1
  }
  dispose() {
    this.embers.stop(),this.glow.dispose(),this.g.world3d.scene.remove(this.group);
    for(const e of this.layers)e.geometry.dispose();
    for(const e of this.mats)e.dispose()
  }
}
function vO(a,e,t,n,s) {
  const r=Math.random()*Math.PI*2,i=1.9*Math.max(.8,Math.min(1.4,n/110));
  for(let l=0;l<3;l++)a.addFx(new yO(a,e,t,n,s+.5+l*.08,r+l/3*Math.PI*2,i));
  return null
}
class _O {
  constructor(e,t,n,s) {
    x(this,"view",new ue);
    x(this,"group",new on);
    x(this,"mats",[]);
    x(this,"meshes",[]);
    x(this,"embers");
    x(this,"glow");
    x(this,"t",0);
    x(this,"LIFE",.75);
    this.g=e;
    const o=s*2.6;
    for(const[i,l]of[[s*.55,0],[s*.32,.15]]) {
      const d=new Fo(i,i*.8,o,24,10,!0);
      d.translate(0,o/2,0);
      const c=new Ze( {
        vertexShader:fk,fragmentShader:gk,uniforms: {
          time: {
            value:Math.random()*10
          },alpha: {
            value:0
          },seed: {
            value:Math.random()*40
          },hot: {
            value:l
          }
        },transparent:!0,depthWrite:!1,blending:Rt,side:rt
      }),u=new Ie(d,c);
      u.frustumCulled=!1,u.renderOrder=7,this.mats.push(c),this.meshes.push(u),this.group.add(u)
    }
    this.group.position.set(t,e.world3d.heightAt(t,n),n),this.group.scale.y=.01,e.world3d.scene.add(this.group),this.embers=new Ot(e,70),e.addFx(this.embers);
    const r=e.world3d.heightAt(t,n);
    for(let i=0;i<40;i++) {
      const l=Math.random()*Math.PI*2,d=Math.random()*s*.5;
      this.embers.emit( {
        x:t+Math.cos(l)*d,y:r+Ms(0,o*.6),z:n+Math.sin(l)*d,vx:Math.cos(l)*Ms(20,70),vy:Ms(120,260),vz:Math.sin(l)*Ms(20,70),life:Ms(500,900),s0:Ms(3.5,5.5),s1:1.5,c0:[1,.85,.45],c1:[.85,.2,.03],a0:1,drag:1.5
      })
    }
    this.embers.stop(),this.glow=e.groundSprite(zd(),!0),this.glow.tint=16738842,this.glow.size=s*2.6,this.glow.x=t,this.glow.y=n
  }
  update(e) {
    const t=e/1e3;
    this.t+=t;
    const n=this.t/this.LIFE;
    if(n>=1) {
      this.glow.dispose(),this.g.world3d.scene.remove(this.group);
      for(const o of this.meshes)o.geometry.dispose();
      for(const o of this.mats)o.dispose();
      return!0
    }
    this.group.scale.y=Math.min(1,this.t/.12);
    const s=Math.min(1,(1-n)/.5);
    this.meshes[0].rotation.y+=t*6,this.meshes[1].rotation.y-=t*9;
    for(const o of this.mats)o.uniforms.time.value+=t,o.uniforms.alpha.value=s;
    return this.glow.alpha=.55*s,!1
  }
}
function Fy(a,e,t,n) {
  a.addFx(new _O(a,e,t,n))
}
const Ex=[10853002,9208178,11773584,8023906],bO=new F(.45,.85,.3).normalize(),xO=new F(0,1,0);
function wO(a) {
  const e=new fp(1,1,5,2).toNonIndexed();
  e.translate(0,.5,0);
  const t=e.attributes.position,n=new Map;
  for(let l=0;l<t.count;l++) {
    const d=`${t.getX(l).toFixed(3)},${t.getY(l).toFixed(3)},${t.getZ(l).toFixed(3)}`;
    let c=n.get(d);
    c||n.set(d,c=[(Math.random()-.5)*.45,t.getY(l)>.99?0:(Math.random()-.5)*.18,(Math.random()-.5)*.45]),t.setXYZ(l,t.getX(l)+c[0],t.getY(l)+c[1],t.getZ(l)+c[2])
  }
  e.computeVertexNormals();
  const s=new St(a),o=new Float32Array(t.count*3),r=e.attributes.normal,i=new F;
  for(let l=0;l<t.count;l++) {
    i.set(r.getX(l),r.getY(l),r.getZ(l));
    const d=.45+.75*Math.max(0,i.dot(bO));
    o[l*3]=s.r*d,o[l*3+1]=s.g*d,o[l*3+2]=s.b*d
  }
  return e.setAttribute("color",new fs(o,3)),e
}
const uc=80,v0=280,Fh=240,_0=170,Cx=15;
function MO(a,e,t,n) {
  a.shake(.3,5);
  const s=a.player,o=Math.atan2(t-s.y,e-s.x),r=Math.cos(o),i=Math.sin(o),l=22,d=Math.hypot(e-s.x,t-s.y)+n*.75,c=(M,k)=>( {
    x:s.x+r*M-i*k,y:s.y+i*M+r*k
  }),u=new on;
  a.world3d.scene.add(u);
  const h=new $o( {
    vertexColors:!0
  }),m=[];
  for(let M=0;M<Cx;M++) {
    const k=Math.min(1,(M+Math.random()*.8)/(Cx-1)),C=10+n*.85*k,A=c(l+(d-l)*k,(Math.random()*2-1)*C),w=24+34*k+Math.random()*14,T=w*(.42+Math.random()*.14),z=new Ie(wO(Ex[M%Ex.length]),h);
    z.frustumCulled=!1,z.scale.set(T,w,T);
    const L=.35+Math.random()*.35,U=o+(Math.random()-.5)*.5;
    z.quaternion.setFromUnitVectors(xO,new F(Math.cos(U)*Math.sin(L),Math.cos(L),Math.sin(U)*Math.sin(L)).normalize()),z.rotateY(Math.random()*Math.PI*2),z.visible=!1,u.add(z),m.push( {
      mesh:z,x:A.x,y:A.y,h:w,delay:k*_0
    })
  }
  const p=new PA(a);
  a.addFx(p);
  const g=new Set;
  let y=!1;
  const f=(Math.hypot(e-s.x,t-s.y)-l)/(d-l)*_0,v=a.groundSprite(ol(),!1);
  v.tint=0,v.alpha=0,v.x=e,v.y=t,v.size=n*1.1;
  const b=[0,90,190].map((M,k)=> {
    const C=a.groundSprite(yr(.7+k*.06));return C.tint=k===0?16774368:15127476,C.alpha=0,C.x=e,C.y=t, {
      s:C,delay:f+M,peak:.9-k*.2
    }
  }),_=Math.max(_0+uc+v0+Fh,f+190+420);
  let S=0;
  return {
    view:new ue,update(M) {
      S+=M;
      for(const C of m) {
        const A=S-C.delay;
        A>0&&!g.has(C)&&(g.add(C),p.burst(C.x,C.y,6,5,o,.5));
        let w;
        if(A<=0)w=0;
        else if(A<uc) {
          const T=A/uc;
          w=1+.15*Math.sin(T*Math.PI)-(1-T)**2
        }
        else A<uc+v0?w=1:w=Math.max(0,1-(A-uc-v0)/Fh)**1.5;
        C.mesh.visible=w>0,C.mesh.position.set(C.x,a.world3d.heightAt(C.x,C.y)-C.h*(1-w)-3,C.y)
      }
      !y&&S>=f&&(y=!0,p.burst(e,t,n*.4,22,o,.7));
      const k=Math.max(0,1-Math.max(0,S-(_-Fh))/Fh);
      v.alpha=S<f?0:.38*Math.min(1,(S-f)/60)*k;
      for(const C of b) {
        const A=Math.min(1,Math.max(0,(S-C.delay)/420));
        C.s.size=2*n*(.2+.95*(1-(1-A)**3)),C.s.alpha=A<=0?0:C.peak*(1-A)**1.5
      }
      if(S<_)return!1;
      p.stop(),v.dispose();
      for(const C of b)C.s.dispose();
      a.world3d.scene.remove(u);
      for(const C of m)C.mesh.geometry.dispose();
      return h.dispose(),!0
    }
  }
}
const yk=[ {
  id:"potion",name:"Poción"
}, {
  id:"elixir",name:"Elixir"
}, {
  id:"blessing",name:"Bendición"
}, {
  id:"dish",name:"Plato"
}, {
  id:"deity",name:"Deity"
}
];
for(const a of yk)Do(a,["name"]);
const Su= {
  low:[1,5],mid:[15,30]
},cn= {
  low:[.01,.05],mid:[.1,.2],high:[.18,.4]
},vk= {
  potion:[.06,.15],blessing:[.04,.1]
},Jv= {
  potion:[.06,.15],blessing:[.04,.1]
},SO=[.001,.005];
function Tx(a,e,t) {
  const n=a[0]+(a[1]-a[0])*e/Wi;
  return t?Math.round(n):n
}
const _k=(a,e)=>String(Math.round(a*10**e)/10**e).replace(".",","),Qe=a=>`${_k(a*100,a<.1?1:0)}%`,AO=32,kO=a=>`${_k(a*100,2)}%`,ws={};
function ha(a) {
  const e=a.text;
  ws[a.id]= {
    ...a,text:t=>Pt(e(t))
  }
}
ha( {
  id:"p_regen",slot:"potion",name:"Poción de regeneración",icon:501,range:Su.low,unit:!0,apply:(a,e)=>a.regen5+=e,text:a=>`+${a} HP cada 5 s`
});
ha( {
  id:"p_cd",slot:"potion",name:"Poción de enfriamiento",icon:656,range:vk.potion,unit:!1,apply:(a,e)=>a.haste+=e,text:a=>Kt("cd",a)
});
ha( {
  id:"p_hp",slot:"potion",name:"Poción de vida",icon:504,range:cn.mid,unit:!1,late:!0,apply:(a,e)=>a.maxHp*=1+e,text:a=>`+${Qe(a)} HP máximo`
});
ha( {
  id:"p_armor",slot:"potion",name:"Poción de armadura",icon:502,range:Su.low,unit:!0,apply:(a,e)=>a.armor+=e,text:a=>`+${a} de armadura`
});
ha( {
  id:"p_area",slot:"potion",name:"Poción de área",icon:505,range:cn.high,unit:!1,apply:(a,e)=>a.areaMult+=e,text:a=>Kt("area",a)
});
ha( {
  id:"p_pickup",slot:"potion",name:"Poción de recolección",icon:545,range:Su.low,unit:!0,apply:(a,e)=>a.pickupRadius+=e*AO,text:a=>`+${a} m de radio de recogida`
});
ha( {
  id:"p_greed",slot:"potion",name:"Poción de la avaricia",icon:546,range:cn.mid,unit:!1,apply:(a,e)=>a.zenyMult+=e,text:a=>`+${Qe(a)} de zeny`
});
ha( {
  id:"p_speed",slot:"potion",name:"Poción de velocidad",icon:12016,range:cn.mid,unit:!1,apply:(a,e)=>a.speedMult+=e,text:a=>Kt("moveSpeed",a)
});
ha( {
  id:"p_cast",slot:"potion",name:"Poción de casteo",icon:547,range:Jv.potion,unit:!1,apply:(a,e)=>a.castHaste+=e,text:a=>Kt("cast",a)
});
ha( {
  id:"p_reach",slot:"potion",name:"Poción de alcance",icon:503,range:cn.mid,unit:!1,apply:(a,e)=>a.reachMult+=e,text:a=>Kt("reach",a)
});
ha( {
  id:"p_dmg",slot:"potion",name:"Poción de daño",icon:657,range:cn.high,unit:!1,apply:(a,e)=>a.damageMult+=e,text:a=>Kt("dmg",a)
});
ha( {
  id:"e_crit",slot:"elixir",name:"Elixir de crítico",icon:645,range:cn.low,unit:!1,apply:(a,e)=>a.critChance+=e,text:a=>`+${Qe(a)} de crítico`
});
ha( {
  id:"e_dmg",slot:"elixir",name:"Elixir de daño",icon:7308,range:cn.mid,unit:!1,apply:(a,e)=>a.damageMult+=e,text:a=>Kt("dmg",a)
});
ha( {
  id:"e_hp",slot:"elixir",name:"Elixir de vida",icon:607,range:Su.mid,unit:!0,apply:(a,e)=>a.maxHp+=e,text:a=>`+${a} HP máximo`
});
ha( {
  id:"e_critdmg",slot:"elixir",name:"Elixir de daño crítico",icon:522,range:cn.high,unit:!1,apply:(a,e)=>a.critMult+=e,text:a=>`+${Qe(a)} de daño crítico`
});
ha( {
  id:"e_surprise",slot:"elixir",name:"Elixir de sorpresa",icon:12259,range:cn.mid,unit:!1,apply:(a,e)=>a.discovery+=e,text:a=>`+${Qe(a)} de descubrimiento`
});
ha( {
  id:"e_dot",slot:"elixir",name:"Elixir de daño en el tiempo",icon:506,range:cn.mid,unit:!1,apply:(a,e)=>a.dotDmg+=e,text:a=>`+${Qe(a)} de daño de venenos, quemaduras y sangrados`
});
ha( {
  id:"e_dodge",slot:"elixir",name:"Elixir de Flee",icon:525,range:cn.low,unit:!1,apply:(a,e)=>a.flee+=e,text:a=>`+${Qe(a)} de Flee`
});
ha( {
  id:"e_cast",slot:"elixir",name:"Elixir de casteo",icon:12299,range:Jv.potion,unit:!1,apply:(a,e)=>a.castHaste+=e,text:a=>Kt("cast",a)
});
ha( {
  id:"e_area",slot:"elixir",name:"Elixir de área",icon:12114,range:cn.mid,unit:!1,apply:(a,e)=>a.areaMult+=e,text:a=>Kt("area",a)
});
ha( {
  id:"e_armor",slot:"elixir",name:"Elixir de armadura",icon:526,range:cn.low,unit:!1,apply:(a,e)=>a.damageReduction+=e,text:a=>`-${Qe(a)} de daño recibido`
});
ha( {
  id:"b_dmg",slot:"blessing",name:"Bendición de daño",icon:12215,range:cn.high,unit:!1,apply:(a,e)=>a.damageMult+=e,text:a=>Kt("dmg",a)
});
ha( {
  id:"b_regen",slot:"blessing",name:"Bendición de regeneración",icon:12303,range:cn.low,unit:!1,apply:(a,e)=>a.regenPct5+=e,text:a=>`+${Qe(a)} de la vida máxima cada 5 s`
});
ha( {
  id:"b_cd",slot:"blessing",name:"Bendición de enfriamiento",icon:12220,range:vk.blessing,unit:!1,apply:(a,e)=>a.haste+=e,text:a=>Kt("cd",a)
});
ha( {
  id:"b_lifesteal",slot:"blessing",name:"Bendición vampírica",icon:12279,range:SO,unit:!1,apply:(a,e)=>a.lifesteal+=e,text:a=>`+${kO(a)} de robo de vida`
});
ha( {
  id:"b_double",slot:"blessing",name:"Bendición de doble casteo",icon:12219,range:cn.low,unit:!1,apply:(a,e)=>a.doubleChance+=e,text:a=>`+${Qe(a)} de doble casteo`
});
ha( {
  id:"b_plenty",slot:"blessing",name:"Bendición de la abundancia",icon:12315,range:cn.mid,unit:!1,apply:(a,e)=> {
    a.zenyMult+=e,a.discovery+=e
  },text:a=>`+${Qe(a)} de zeny y +${Qe(a)} de descubrimiento`
});
ha( {
  id:"b_cast",slot:"blessing",name:"Bendición de casteo",icon:717,range:Jv.blessing,unit:!1,apply:(a,e)=>a.castHaste+=e,text:a=>Kt("cast",a)
});
ha( {
  id:"b_area",slot:"blessing",name:"Bendición de área",icon:715,range:cn.mid,unit:!1,apply:(a,e)=>a.areaMult+=e,text:a=>`+${Qe(a)} de área`
});
ha( {
  id:"b_reach",slot:"blessing",name:"Bendición de alcance",icon:686,range:cn.mid,unit:!1,apply:(a,e)=>a.reachMult+=e,text:a=>Kt("reach",a)
});
ha( {
  id:"b_wisdom",slot:"blessing",name:"Bendición de la sabiduría",icon:7433,range:cn.mid,unit:!1,apply:(a,e)=>a.expMult+=e,text:a=>`+${Qe(a)} de EXP`
});
const qd=(a,e)=>ha( {
  id:`d_${a}`,slot:"dish",name:`Plato de ${a.toUpperCase()}`,icon:e,range:Su.low,unit:!0,apply:(t,n)=>t[a]+=n,text:t=>`+${t} ${a.toUpperCase()}`
});
qd("str",12202);
qd("agi",12203);
qd("vit",12207);
qd("int",12204);
qd("dex",12205);
qd("luk",12206);
const EO=.25,Ca= {
  dmg: {
    apply:(a,e)=>a.damageMult+=e/100,text:a=>`+${a}% de daño`
  },crit: {
    apply:(a,e)=>a.critChance+=e/100,text:a=>`+${a}% de crítico`,low:!0
  },critDmg: {
    apply:(a,e)=>a.critMult+=e/100,text:a=>`+${a}% de daño crítico`
  },dot: {
    apply:(a,e)=>a.dotDmg+=e/100,text:a=>`+${a}% de daño de venenos, quemaduras y sangrados`
  },area: {
    apply:(a,e)=>a.areaMult+=e/100,text:a=>`+${a}% de área`
  },zeny: {
    apply:(a,e)=>a.zenyMult+=e/100,text:a=>`+${a}% de zeny`
  },discovery: {
    apply:(a,e)=>a.discovery+=e/100,text:a=>`+${a}% de descubrimiento`
  },exp: {
    apply:(a,e)=>a.expMult+=e/100,text:a=>`+${a}% de EXP`
  },speed: {
    apply:(a,e)=>a.speedMult+=e/100,text:a=>`+${a}% de velocidad`
  },flee: {
    apply:(a,e)=>a.flee+=e/100,text:a=>`+${a}% de Flee`,low:!0
  },armor: {
    apply:(a,e)=>a.armor+=e,text:a=>`+${a} de armadura`,low:!0
  },hpPct: {
    apply:(a,e)=>a.maxHp*=1+e/100,text:a=>`+${a}% HP máximo`
  },regen: {
    apply:(a,e)=>a.regen5+=e,text:a=>`+${a} HP cada 5 s`,share:.5
  },str: {
    apply:(a,e)=>a.str+=e,text:a=>`+${a} STR`,low:!0
  },int: {
    apply:(a,e)=>a.int+=e,text:a=>`+${a} INT`,low:!0
  },dex: {
    apply:(a,e)=>a.dex+=e,text:a=>`+${a} DEX`,low:!0
  },cast: {
    apply:(a,e)=>a.castHaste+=e/100,text:a=>Kt("cast",a/100),low:!0
  }
},Ih=(a,e)=>a.share?Math.round(e*a.share):a.low?Math.round(e*EO):e;
function Qs(a,e,t,n,s,o=!1) {
  ws[a]= {
    id:a,slot:"deity",name:e,icon:t,range:[10,20],unit:!0,late:o,apply:(r,i)=> {
      n.apply(r,Ih(n,i)),s.apply(r,Ih(s,i))
    },text:r=>`${Pt(n.text(Ih(n,r)))} · ${Pt(s.text(Ih(s,r)))}`
  }
}
Qs("g_avarice","Deity de la avaricia",2630,Ca.zeny,Ca.discovery);
Qs("g_war","Deity de la guerra",1530,Ca.dmg,Ca.crit);
Qs("g_executioner","Deity del verdugo",1413,Ca.crit,Ca.critDmg);
Qs("g_might","Deity de la fuerza",2629,Ca.str,Ca.dmg);
Qs("g_thought","Deity del pensamiento",6599,Ca.int,Ca.dmg);
Qs("g_memory","Deity de la memoria",6600,Ca.dex,Ca.cast);
Qs("g_bulwark","Deity del baluarte",2357,Ca.armor,Ca.hpPct,!0);
Qs("g_wind","Deity del viento",2410,Ca.speed,Ca.flee);
Qs("g_life","Deity de la vida",2353,Ca.regen,Ca.hpPct,!0);
Qs("g_wisdom","Deity de la sabiduría",7019,Ca.exp,Ca.discovery);
Qs("g_binding","Deity de la atadura",7058,Ca.area,Ca.dmg);
Qs("g_trickery","Deity del engaño",1262,Ca.flee,Ca.crit);
Qs("g_torment","Deity del tormento",2678,Ca.dot,Ca.dmg);
for(const a of Object.values(ws))Do(a,["name"]);
for(const a of Object.values(ws))(a.slot==="potion"||a.slot==="elixir"||a.slot==="blessing")&&(a.img=`runitems/${a.id}.png`);
[...new Set(Object.values(ws).map(a=>a.icon))];
const Px=a=>Math.ceil(a/2),aa=a=>( {
  text:e=>Kt("dmg",a*e),mod:(e,t)=>e.dmg+=a*t
}),tp=(a,e,t="sangran")=>( {
  text:n=>`Los objetivos ${t} un ${Qe(a+e*n)} del golpe en 3 s`,mod:(n,s)=>n.hit.bleed=(n.hit.bleed??0)+a+e*s
}),Rx=(a,e,t)=>( {
  text:n=>zA(a+e*n,t/uo),mod:(n,s)=> {
    n.splash+=a+e*s,n.splashR=Math.max(n.splashR,t/uo)
  }
}),$i=a=>( {
  text:e=>Kt("count",Px(e),a),mod:(e,t)=>e.count+=Px(t)
}),nn=(a,e)=>( {
  text:t=>Kt("area",a+e*t),mod:(t,n)=>t.area+=a+e*n
}),Ho=(a,e)=>( {
  text:t=>Kt("duration",a+e*t),mod:(t,n)=>t.duration+=a+e*n
}),Hs=a=>( {
  text:e=>Kt("cd",a*e),mod:(e,t)=>e.cd+=a*t
}),zx=.1,CO= {
  text:()=>Kt("pierce",zx),mod:a=>a.pierce+=zx
},TO=a=>( {
  text:e=>Kt("orbitSpeed",a*e),mod:(e,t)=>e.speed+=a*t
});
function Rl(a) {
  switch(a) {
    case"fire":return tp(.25,.03,"arden con");
    case"water":return {
      text:e=>`${Qe(.1+.01*e)} de congelar 1,5 s`,mod:(e,t)=> {
        e.hit.freezeChance=(e.hit.freezeChance??0)+.1+.01*t,e.hit.freeze=Math.max(e.hit.freeze??0,1.5)
      }
    };
    case"wind":return {
      text:e=>`${Qe(.1+.01*e)} de aturdir 1 s`,mod:(e,t)=> {
        e.hit.stunChance=(e.hit.stunChance??0)+.1+.01*t,e.hit.stun=Math.max(e.hit.stun??0,1)
      }
    };
    case"ghost":case"holy":return {
      text:e=>`Los objetivos reciben un ${Qe(.15+.02*e)} más de daño durante 4 s`,mod:(e,t)=> {
        e.hit.mark=Math.max(e.hit.mark??0,.15+.02*t),e.hit.markTime=4
      }
    };
    default:return tp(.2,.02)
  }
}
const PO=a=>1+.1*(a-1),bk=5,RO=4,zO=.2,LO=.02,DO=6,FO=a=>.2+.02*(a-1),Lx=.1,IO=3,BO=.15,NO=.02,UO=a=>.2+.05*(a-1),p9=150,f9=.1,g9=110,qO=.15,xk=.4,Dx=100,wk=2,Mk=.6,HO=240,Sk=.6,Fx=110,Ak=3,OO=.5,kk=.3,Ix=55,jO=.35,Ek=a=>.15+.03*(a-1),Ck=a=>.15+.02*(a-1),GO=a=>.2+.05*(a-1),VO=3,Iy=4,WO=.6,Bx=a=>4+(a-1),By=3,$O=1.5,Tk=a=>1+.05*(a-1),Pk=.25,Rk=6,YO=34,XO=2600,Ny=4,Uy=.4,zk=a=>.5+.05*(a-1),KO=.6,Lk=.1,Dk=a=>.5+.05*(a-1),Fk=5,Ik=4,Bk=a=>.3+.03*(a-1),Nk=a=>.2+.02*(a-1),Uk=4,JO=a=>.12+.01*(a-1),y9=1.6,v9=1,qy=3,Hy=.3,qk=a=>.25+.03*(a-1),QO=.6,ZO=45,Hk=10,_9=Hk*60,b9=70,x9=150,Nx=a=>1.5+.1*(a-1),Ok=2,jk=.7,e8=200,Ux=160,Gk=2,b0=120,Vk=a=>40+5*(a-1),Wk=2,$k=.3,Yk=a=>.5+.05*(a-1),Oy=2,jy=.5,Xk=a=>.25+.03*(a-1),Kk=2,t8=.5,a8=3,Jk=a=>.15+.02*(a-1),Qk=.1,n8=70,Zk=a=>1.5+.15*(a-1),eE=5,s8=.5,tE=3,aE=a=>.8+.08*(a-1),qx=a=>1.5+.25*(a-1),nE=2,sE=a=>.6+.05*(a-1),oE= {
  heal:[aa(.15), {
    text:a=>`Coluceo: el pulso de Heal se repite ${Wk} veces más, una por segundo, con un ${Qe($k)} de su curación y un ${Qe(Yk(a))} de su daño`,mod:()=>{}
  }
  ],holy_light:[aa(.15),nn(.1,.02), {
    text:a=>`Judex: la columna se queda ${Oy} s en el suelo y cada ${String(jy).replace(".",",")} s golpea a todos los de su área con un ${Qe(Xk(a))} del golpe`,mod:()=>{}
  }
  ],ruwach:[aa(.15),$i("orbe"), {
    text:()=>`Adoramus: cada estallido ciega ${Kk} s a los que alcanza y te cura un poco por cada uno`,mod:()=>{}
  }
  ],decrease_agi:[Hs(.1),nn(.15,.03), {
    text:a=>`Silentium: mientras están ralentizados, los enemigos hacen un ${Qe(Jk(a))} menos de daño`,mod:()=>{}
  }
  ],signum_crucis:[aa(.15),Ho(.2,.05), {
    text:a=>`Oratio: la marca da un ${Qe(Qk)} más, y el enemigo que muere marcado estalla en luz: hace ${String(Math.round(Zk(a)*100)/100).replace(".",",")} veces el daño de un tic a los de alrededor y los marca`,mod:()=>{}
  }
  ],aqua_benedicta:[aa(.15),nn(.1,.02), {
    text:a=>`Epiclesis: al secarse el charco brota un árbol de luz ${eE} s (más con la duración del charco) que te cura un poco si estás cerca y cada segundo lanza rayos a ${tE} enemigos (más con los objetivos extra) con un ${Qe(aE(a))} del daño de un tic`,mod:()=>{}
  }
  ],blessing:[Hs(.12),Ho(.25,.25), {
    text:()=>"Clementia: mientras dura Blessing, regeneras vida poco a poco",mod:()=>{}
  }
  ],holy_smite:[aa(.2), {
    text:a=>`Duple Light: ${nE} golpes bendecidos más, y en cada uno cae además una luz sagrada sobre el objetivo con un ${Qe(sE(a))} del golpe`,mod:()=>{}
  }
  ],envenom:[aa(.2), {
    text:a=>`Toxina virulenta: cada puñalada de Envenom sobre un enemigo que ya tiene su veneno lo hace un ${Qe(GO(a))} más fuerte, hasta ${VO} veces`,mod:()=>{}
  }
  ],poison_bomb:[aa(.15),nn(.1,.02), {
    text:()=>`Nube tóxica: donde revienta el frasco queda una nube ${Iy} s que envenena y ralentiza a los que la cruzan`,mod:()=>{}
  }
  ],caltrops:[Ho(.2,.05),nn(.1,.02), {
    text:a=>`Abrojos envenenados: los que los pisan quedan envenenados (${Bx(a)} de daño por segundo)`,mod:(a,e)=>a.hit.poison=(a.hit.poison??0)+Bx(e)
  }
  ],sand_attack:[aa(.15),nn(.1,.02), {
    text:()=>`Tormenta de arena: la arena se queda flotando ${By} s delante de ti y ciega a los que la cruzan`,mod:()=>{}
  }
  ],double_strafe:[aa(.15), {
    text:a=>`Sharp Shooting: la última flecha de cada salva sale recta, con un ${Qe(Tk(a))} del daño de una flecha y un ${Qe(Pk)} más de crítico, y atraviesa a todos los que hay en línea hasta ${Rk} m detrás del objetivo`,mod:()=>{}
  }
  ],arrow_repel:[aa(.15),nn(.1,.02), {
    text:a=>`Vórtice: el disparo ya no empuja: arrastra consigo a los monstruos que pilla cerca (salvo jefes) durante ${Hk} m y al final estalla en un remolino que hace un ${Qe(Nx(a))} de su daño a todos los de alrededor`,mod:(a,e)=>a.hit.vortex=Nx(e)
  }
  ],retreat:[aa(.15), {
    text:a=>`Wind Walk: al aterrizar, tus ${Fk} siguientes skills salen dos veces (doble casteo seguro) y vas un ${Qe(Bk(a))} más rápido durante ${Ik} s`,mod:()=>{}
  }
  ],concentration:[Hs(.12), {
    text:a=>`True Sight: mientras dura Improve Concentration, tus disparos tienen un ${Qe(Lk)} más de probabilidad de perforar y tus críticos hacen un ${Qe(Dk(a))} más de daño`,mod:()=>{}
  }
  ],arcane_shot:[aa(.15), {
    text:a=>`Marca arcana: los monstruos que arrastra el pulso quedan marcados ${Uk} s y reciben un ${Qe(Nk(a))} más de daño de todo`,mod:()=>{}
  }
  ],fire_arrow:[aa(.15),nn(.1,.02), {
    text:a=>`Contagio: el monstruo que muere ardiendo estalla en llamas con un ${Qe(JO(a))} de su vida máxima y prende a los que tiene alrededor; si alguno muere ardiendo, vuelve a estallar`,mod:()=>{}
  }
  ],arrow_rain:[aa(.15),nn(.1,.02), {
    text:a=>`Campo de flechas: al acabar la lluvia, las flechas se quedan clavadas ${Ny} s; lo que cruce el área se ralentiza y recibe un ${Qe(zk(a))} del daño de un impacto cada ${String(Uy).replace(".",",")} s`,mod:()=>{}
  }
  ],arrow_shower:[aa(.15),nn(.1,.02), {
    text:a=>`Galerna: la última andanada deja una corriente de viento en el cono durante ${qy} s que ralentiza, sigue empujando y hace un ${Qe(qk(a))} del daño de una andanada cada ${String(Hy).replace(".",",")} s a lo que entre`,mod:()=>{}
  }
  ],throw_stone:[aa(.15), {
    text:()=>`Rebote: la piedra rebota a ${Ok} enemigos cercanos más con un ${Qe(jk)} de su daño y también los aturde`,mod:()=>{}
  }
  ],fan_of_knives:[aa(.15),$i("pulso"),tp(.2,.02)],hiding:[Hs(.12), {
    ...Ho(.25,.25),text:a=>`${Kt("duration",.25+.25*a)} del daño al salir`
  }, {
    text:()=>`Bomba de humo: al ocultarte sueltas una nube de humo que ciega ${Gk} s a los enemigos de alrededor y los aparta`,mod:()=>{}
  }
  ],shadowstep:[Hs(.1),Ho(.2,.05), {
    text:a=>`Danza de sombras: al aparecer estalla una onda de sombra que hace ${Vk(a)} de daño y aturde a todos los de alrededor`,mod:()=>{}
  }
  ],mammonite:[aa(.2), {
    text:()=>`Golpe de fortuna: contra un enemigo marcado por Zeny Rain, el golpe revienta en monedas que hacen un ${Qe(xk)} de su daño a los de alrededor`,mod:()=>{}
  }
  ],cart_revolution:[aa(.15),nn(.12,.03), {
    text:()=>`Carro de rebote: al caer, el carro rebota a ${wk} enemigos cercanos más y hace un ${Qe(Mk)} de su daño en cada bote`,mod:()=>{}
  }
  ],zeny_rain:[$i("pulso"), {
    text:()=>`Pago por adelantado: la marca da un ${Qe(.15)} más a Mammonite y los marcados que mueren sueltan zeny y le quitan 1 s de enfriamiento`,mod:()=>{}
  }
  ],cart_rush:[aa(.15), {
    text:()=>Kt("reach",.2),mod:a=>a.reach+=.2
  }, {
    text:()=>`Estampida: al frenar, el carro choca y suelta una onda con un ${Qe(Sk)} de su daño; deja un rastro de polvo ${Ak} s que ralentiza un ${Qe(OO)} a quien lo pise`,mod:()=>{}
  }
  ],vending:[aa(.15),Ho(.15,.05), {
    text:()=>`Cápsulas: cada golpe que recibe la máquina le hace escupir una cápsula que cae sobre un enemigo cercano y explota con un ${Qe(kk)} del daño del reventón`,mod:()=>{}
  }
  ],crazy_uproar:[Hs(.12), {
    text:a=>`Grito de mercado: una carga más y las skills que gastan carga hacen un ${Qe(Ek(a))} más de daño`,mod:()=>{}
  }
  ],enlarge_weight:[Hs(.12), {
    text:()=>Kt("duration",.25),mod:a=>a.duration+=.25
  }, {
    text:a=>`Carro acorazado: al saltar te cura un ${Qe(Ck(a))} de tu vida máxima y, mientras dura, los que te golpean salen despedidos`,mod:()=>{}
  }
  ],provoke:[Hs(.1),nn(.12,.03), {
    text:()=>`Cadenas del campeón: Provoke arrastra hacia ti a los provocados (salvo jefes); los que mueren provocados te curan un ${Qe(NO)} de tu vida máxima`,mod:()=>{}
  }
  ],endure:[Hs(.12), {
    text:a=>`Bastión: mientras dura Endure, una cúpula absorbe daño por un ${Qe(UO(a))} de tu vida máxima; al romperse o acabarse estalla y devuelve lo absorbido a los enemigos cercanos`,mod:()=>{}
  }
  ],hp_recovery:[Hs(.12),Ho(.25,.25), {
    text:()=>`Raíz de Yggdrasil: planta un círculo de vida donde la lanzas; dentro te curas el doble y recibes un ${Qe(qO)} menos de daño`,mod:()=>{}
  }
  ],magnum:[aa(.2),nn(.12,.03), {
    text:()=>`Tierra en llamas: la explosión deja un anillo de fuego en su borde durante ${IO} s que quema un ${Qe(BO)} de su daño por segundo a quien lo pise`,mod:()=>{}
  }
  ],shield_bash:[ {
    text:a=>Kt("dmg",.4+.15*(a-1)),mod:(a,e)=>a.dmg+=.4+.15*(e-1)
  }, {
    text:()=>Kt("projSpeed",1),mod:a=>a.speed+=1
  }, {
    text:()=>`Deja un rastro sagrado por donde pasa durante 5 s: hace un ${Qe(Lx)} de su daño por segundo a quien lo pise. Es más largo cuanto más lejos llega y más ancho cuanto más grande es el escudo`,mod:a=>a.hit.holyTrail=(a.hit.holyTrail??0)+Lx
  }
  ],demoralizing_shout:[nn(.12,.03),Hs(.1), {
    text:a=>`Robo de moral: cada enemigo desmoralizado te da +${Qe(LO)} de daño durante ${DO} s (hasta +${Qe(FO(a))})`,mod:()=>{}
  }
  ],sword_dance:[aa(.15),nn(.15,.03), {
    text:a=>`Al acabar el baile, el arma se carga de rayo ${bk} s: los ataques básicos hacen un ${Qe(PO(a))} más de daño eléctrico, que salta a ${RO} enemigos más perdiendo un ${Qe(zO)} en cada salto`,mod:()=>{}
  }
  ]
},o8=5,r8=2,Hx=a=>.35+.01*(a-1),w9=6,rE=a=>.6+.05*(a-1),iE=a=>1.5+.1*(a-1),i8=1,lE=a=>1.5+.1*(a-1),l8=2,Ox=a=>.5+.03*(a-1),jx=a=>.3+.02*(a-1),Gx=a=>.15+.01*(a-1);
Object.assign(oE, {
  firebolt:[aa(.15), {
    text:a=>`Fire Ball: cada bolt revienta en una bola de fuego que hace un ${Qe(jx(a))} de su daño a los de alrededor (1,5 m, crece con el área)`,mod:(a,e)=> {
      a.splash+=jx(e),a.splashR=Math.max(a.splashR,1.5),a.hit.blast=1.5
    }
  }
  ],coldbolt:[aa(.15), {
    text:()=>`Escarcha acumulada: cada bolt deja una carga de escarcha en el enemigo; con ${o8} cargas se congela ${r8} s`,mod:a=>a.hit.frostStack=1
  }
  ],lightning:[aa(.15), {
    text:a=>`Chain Lightning: cada rayo salta a ${l8} enemigos cercanos con un ${Qe(Ox(a))} de su daño`,mod:(a,e)=>a.hit.chain=Ox(e)
  }
  ],soul_strike:[aa(.15), {
    text:()=>"Soul Drain: cada monstruo que matas con Soul Strike te da una carga; al volver a lanzarlo, +1 objetivo por carga (las gasta todas)",mod:a=>a.hit.soulCharge=1
  }
  ],napalm:[nn(.1,.02), {
    text:a=>`Napalm Vulcan: el golpe se repite 2 veces más y maldice: los golpeados reciben un ${Qe(Gx(a))} más de daño durante 4 s`,mod:(a,e)=> {
      a.bolts+=2,a.hit.mark=Math.max(a.hit.mark??0,Gx(e)),a.hit.markTime=4,a.hit.vulcan=1
    }
  }
  ],fire_wall:[Ho(.2,.05), {
    text:a=>`Fire Pillar: al apagarse el muro, cada llama estalla en una columna de fuego que hace un ${Qe(rE(a))} de su daño a su alrededor`,mod:()=>{}
  }
  ],frost_diver:[ {
    text:()=>"+5 s de congelación",mod:a=>a.hit.freeze=(a.hit.freeze??0)+5
  }, {
    text:a=>`Estallido helado: si su objetivo muere congelado, revienta y hace un ${Qe(Hx(a))} de su vida máxima a todos los de alrededor (con Deep Freeze, ×4 a los congelados)`,mod:(a,e)=>a.hit.frostShatter=Hx(e)
  }
  ],sight:[$i("llama"), {
    text:a=>`Sightrasher: al acabarse, las llamas salen disparadas hacia fuera y estallan al chocar con un ${Qe(iE(a))} de su daño`,mod:()=>{}
  }
  ],thunderstorm:[nn(.1,.02), {
    text:a=>`Lord of Vermilion: la tormenta acaba con una gran descarga sobre toda el área que hace un ${Qe(lE(a))} de su daño a todos`,mod:()=>{}
  }
  ]
});
function Vx(a) {
  const e=oE[a.id];
  if(e)return e;
  switch(a.type) {
    case"single":return[aa(.2),a.element==="neutral"?tp(.2,.02):Rl(a.element),Rx(.2,.01,160)];
    case"multi":return[aa(.15),$i(a.countUnit()),Rl(a.element)];
    case"projectile":return[aa(.15),$i(a.countUnit()),a.piercesAll()?nn(.1,.02):CO,Rx(.15,.01,110)];
    case"aoe":return[aa(.15),nn(.15,.03),Rl(a.element)];
    case"zone":return[aa(.15),Ho(.2,.05),nn(.1,.02),Rl(a.element)];
    case"orbit":return[aa(.15),$i(a.countUnit()),TO(.1),Rl(a.element)];
    case"control":return[Hs(.1),nn(.2,.05),Rl("ghost")];
    default:return[Hs(.12),Ho(.25,.25)]
  }
}
function M9(a) {
  var e;
  return((e=va[a])==null?void 0:e.kind)==="weapon"&&!a.startsWith("atk_")
}
const S9= {
  melee:["p_reach","b_reach"],dot:["e_dot","g_torment"],cast:["p_cast","e_cast","b_cast"],str:["d_str","g_might"],int:["d_int","g_thought"]
},A9=new Set(["potion_pitcher","chemical_protection","enchant_poison","auto_guard"]),k9=new Set(["blessing","kaupe","kaahi","hindsight"]),Bh=3;
function Wx(a,e) {
  let t=Wt()*a.reduce((s,o)=>s+e(o),0),n=0;
  for(;n<a.length-1&&(t-=e(a[n]))>=0;)n++;
  return n
}
const $x=.12;
class Tm {
  constructor() {
    x(this,"slots",new Map)
  }
  static total(e,t) {
    return e.stack?1-t.reduce((n,s)=>n*(1-s),1):t.reduce((n,s)=>n+s,0)
  }
  apply(e) {
    const t=[...this.slots.values()].flatMap(n=>ws[n.item]?[ {
      def:ws[n.item],o:n
    }
    ]:[]);
    for(const n of[!1,!0])for(const {
      def:s,o
    }
    of t)!!s.late===n&&s.apply(e,Tm.total(s,o.vals))
  }
  deityMod(e) {
    const t=this.slots.get("deity");
    if(!t||t.item!==e.id)return null;
    const n= {
      dmg:0,cd:0,count:0,cast:0,double:0,bolts:0,targets:0,area:0,reach:0,pierce:0,speed:0,duration:0,splash:0,splashR:0,cone:0,hit:{}
    };
    for(const s of Vx(e))s.mod(n,t.vals.length);
    return n
  }
  deityLevel(e) {
    const t=this.slots.get("deity");
    return t&&t.item===e?t.vals.length:0
  }
  static deityTexts(e,t) {
    return Vx(e).map(n=>Pt(n.text(t)))
  }
  roll(e,t={},n=3,s=[]) {
    const o=yk.map(i=>i.id).filter(i=>!s.includes(i)),r=[];
    for(;r.length<n&&o.length;) {
      const i=c=>this.slotItems(c,e,t).some(u=> {
        var h;return(h=t.focused)==null?void 0:h.has(u)
      })?Bh:1,l=o.splice(Wx(o,i),1)[0],d=this.rollSlot(l,e,t);
      d&&r.push(d)
    }
    return r
  }
  slotItems(e,t,n) {
    const s=this.slots.get(e),o=i=> {
      var l;
      return!((l=n.banished)!=null&&l.has(i))
    };
    if(s) {
      const i=o(s.item)?[s.item]:[];
      return e==="deity"&&n.swap&&i.push(...t.filter(l=>l!==s.item&&o(l))),i
    }
    return[...Object.values(ws).filter(i=> {
      var l;return i.slot===e&&!((l=n.useless)!=null&&l.has(i.id))
    }).map(i=>i.id),...e==="deity"?t:[]].filter(o)
  }
  rollSlot(e,t,n={}) {
    const s=this.slots.get(e),o=h=> {
      var m;
      return!((m=n.banished)!=null&&m.has(h))
    },r=h=>h[Wx(h,m=> {
      var p;return(p=n.focused)!=null&&p.has(m)?Bh:1
    })],i=h=>( {
      slot:e,item:h,quality:Wi,value:1,refine:(s==null?void 0:s.item)===h?s.vals.length:0
    });
    if(e==="deity") {
      const h=t.filter(o);
      if(s&&!ws[s.item]) {
        const p=n.swap?h.filter(y=>y!==s.item):[],g=p.some(y=> {
          var f;return(f=n.focused)==null?void 0:f.has(y)
        });
        return p.length&&(!o(s.item)||Wt()<$x*(g?Bh:1))?i(r(p)):o(s.item)?i(s.item):null
      }
      const m=h.some(p=> {
        var g;return(g=n.focused)==null?void 0:g.has(p)
      });
      if(h.length&&(!s||n.swap)&&Wt()<$x*(m?Bh:1))return i(r(h))
    }
    const l=s&&ws[s.item]?[s.item].filter(o):Object.values(ws).filter(h=> {
      var m;return h.slot===e&&o(h.id)&&!((m=n.useless)!=null&&m.has(h.id))
    }).map(h=>h.id);
    if(!l.length)return null;
    const d=r(l),c=ws[d],u=Py();
    return {
      slot:e,item:d,quality:u,value:Tx(c.range,u,c.unit),refine:(s==null?void 0:s.item)===d?s.vals.length:0
    }
  }
  choose(e) {
    const t=this.slots.get(e.slot);
    t&&t.item===e.item?(t.vals.push(e.value),t.quality=Math.max(t.quality,e.quality)):this.slots.set(e.slot, {
      item:e.item,vals:[e.value],quality:e.quality
    })
  }
  static pool(e,t) {
    const n=Object.values(ws).filter(s=>s.slot===e).map(s=>s.id);
    return e==="deity"?[...n,...t]:n
  }
  static rollLeveled(e,t,n) {
    const s=Tm.pool(e,t),o=s[Math.floor(Wt()*s.length)],r=ws[o];
    if(!r)return {
      slot:e,item:o,vals:Array(n).fill(1),quality:Wi
    };
    const i=Array.from( {
      length:n
    },()=>Py());
    return {
      slot:e,item:o,vals:i.map(l=>Tx(r.range,l,r.unit)),quality:Math.max(...i)
    }
  }
  grant(e) {
    this.slots.set(e.slot, {
      item:e.item,vals:[...e.vals],quality:e.quality
    })
  }
  refine(e) {
    var t;
    return(((t=this.slots.get(e))==null?void 0:t.vals.length)??1)-1
  }
  static itemText(e,t,n) {
    return e.text(Tm.total(e,n===void 0?t:[...t,n]))
  }
}
const Gi=(a,e)=>a+Math.random()*(e-a);
function ti(a,e,t,n,s,o,r,i,l,d,c=.85,u=0) {
  const h=new Ot(a,s+4),m=a.world3d.heightAt(e,t)+n;
  for(let p=0;p<s;p++) {
    const g=Math.random()*Math.PI*2,y=Math.random()*Math.PI-Math.PI/2,f=Gi(o[0],o[1]);
    h.emit( {
      x:e,y:m,z:t,vx:Math.cos(g)*Math.cos(y)*f,vy:Math.sin(y)*f*.6+20,vz:Math.sin(g)*Math.cos(y)*f,life:Gi(r[0],r[1]),s0:i[0],s1:i[1],c0:l,c1:d,a0:c,grav:u,drag:3
    })
  }
  h.stop(),a.addFx(h)
}
function Qv(a,e,t,n) {
  ea(a, {
    x:e,y:t
  },n,16742954,320),ti(a,e,t,14,26,[n*1.2,n*2.4],[220,380],[20,8],[1,.82,.4],[.7,.1,.02],.85),ti(a,e,t,14,12,[80,200],[450,750],[4,1.5],[1,.85,.5],[.9,.25,.05],1,-150);
  const s=kt("str_firehit1",e,t,.9,0);
  s&&a.addFx(s)
}
function E9(a,e,t,n) {
  if(n) {
    Mu(a,e,t),a.addFx(new Uv(a,e,t,1.4)),ea(a, {
      x:e,y:t
    },50,10477823,360);
    return
  }
  ti(a,e,t,24,6,[30,70],[260,420],[5,1.5],[1,1,1],[.55,.8,1],1,-60)
}
function d8(a,e,t,n) {
  ea(a, {
    x:e,y:t
  },Math.max(30,n),13150463,300),ti(a,e,t,20,10,[n*.8,n*1.6],[240,380],[14,4],[.9,.8,1],[.45,.25,.8],.75)
}
function C9(a,e,t) {
  ea(a, {
    x:e,y:t
  },46,11832575,260),ti(a,e,t,22,14,[60,140],[260,420],[16,4],[.85,.7,1],[.35,.15,.7],.7)
}
function T9(a,e,t,n) {
  Mu(a,e,t),ea(a, {
    x:e,y:t
  },n,12577535,420),a.addFx(new Uv(a,e,t,2.4)),ti(a,e,t,20,30,[n*.5,n],[380,620],[7,2],[1,1,1],[.5,.78,1],1,-360),ti(a,e,t,10,10,[30,70],[500,800],[22,46],[.8,.92,1],[.5,.75,1],.35),a.shake(.15,3)
}
function c8(a,e,t,n) {
  Fy(a,e,t,n),ea(a, {
    x:e,y:t
  },n,16747066,360)
}
class u8 {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"orb",Pp("fx_sight",.9));
    x(this,"t",0);
    x(this,"done",!1);
    this.g=e,this.x=t,this.y=n,this.ang=s,this.boom=o,this.orb.loop=!0,e.fxLayer.addChild(this.orb)
  }
  update(e) {
    this.t+=e/1e3;
    const s=Math.min(1,this.t/.42),o=200/.42*(e/1e3)*(1-.5*s);
    this.x+=Math.cos(this.ang)*o,this.y+=Math.sin(this.ang)*o,this.orb.update(e);
    const r=this.g.screenPos(this.x,this.y,25);
    return this.orb.position.set(r.x,r.y),this.orb.scale.set(this.g.pixelScale(this.x,this.y)*.9*(1+.4*s)),(this.g.enemiesInRadius(this.x,this.y,34).some(l=>!l.dead)||s>=1)&&!this.done?(this.done=!0,this.boom(this.x,this.y),this.orb.destroy(),!0):!1
  }
}
function h8(a,e,t,n,s) {
  if(a.shake(.3,5),s) {
    Fy(a,e,t,n*.6);
    for(let r=0;r<5;r++) {
      const i=r/5*Math.PI*2+Math.random(),l=n*Gi(.4,.8);
      Fy(a,e+Math.cos(i)*l,t+Math.sin(i)*l*.7,n*.35)
    }
    Qv(a,e,t,n);
    return
  }
  ea(a, {
    x:e,y:t
  },n,14214399,480);
  const o=kt("str_lightning",e,t,1.8,0);
  o&&a.addFx(o);
  for(let r=0;r<8;r++) {
    const i=Math.random()*Math.PI*2,l=n*Math.sqrt(Math.random()),d=e+Math.cos(i)*l,c=t+Math.sin(i)*l*.7;
    a.schedule(r*.04,()=> {
      const u=kt("str_lightning",d,c,.9,0);u&&a.addFx(u),a.addFx(bN(a, {
        x:e,y:t
      }, {
        x:d,y:c
      },.8))
    })
  }
  ti(a,e,t,30,34,[n*1.5,n*3],[180,340],[4,1],[1,1,.9],[.45,.6,1],1,-260),a.addFx(new m8(a,e,t,n))
}
class m8 {
  constructor(e,t,n,s) {
    x(this,"view",new ue);
    x(this,"gr",new et);
    x(this,"t",0);
    this.g=e,this.x=t,this.y=n,this.r=s,this.gr.blendMode="add",e.fxLayer.addChild(this.gr)
  }
  update(e) {
    this.t+=e/1e3;
    const t=this.t/.25;
    if(this.gr.clear(),t>=1)return this.gr.destroy(),!0;
    const n=this.g.screenPos(this.x,this.y,20),s=this.g.pixelScale(this.x,this.y);
    return this.gr.ellipse(n.x,n.y,this.r*s*(.6+.6*t),this.r*s*.5*(.6+.6*t)).fill( {
      color:15660287,alpha:.55*(1-t)
    }),!1
  }
}
class p8 {
  constructor(e,t,n,s,o,r) {
    x(this,"view",new ue);
    x(this,"group",new on);
    x(this,"mats",[]);
    x(this,"crystals",[]);
    x(this,"t",0);
    x(this,"STAY",520);
    x(this,"SINK",260);
    this.g=e;
    const i=Math.hypot(s-t,o-n),l=Math.max(4,Math.round(i/15)),d=Math.atan2(o-n,s-t);
    for(let c=0;c<l;c++) {
      const u=(c+1)/l,h=1+Math.floor(Math.random()*3);
      for(let m=0;m<h;m++) {
        const p=(Math.random()-.5)*22,g=t+(s-t)*u-Math.sin(d)*p,y=n+(o-n)*u+Math.cos(d)*p,f=Gi(24,40)*(.75+.5*u)*(m?.65:1),v=f,b=new Ze( {
          vertexShader:kA,fragmentShader:EA,uniforms: {
            time: {
              value:Math.random()*10
            },alpha: {
              value:1
            },len: {
              value:v*1.6
            },deep: {
              value:new F(.1,.38,.85)
            },pale: {
              value:new F(.85,.97,1)
            }
          },transparent:!0,depthWrite:!1,side:rt
        });
        this.mats.push(b);
        const _=new Ie(Ey(v,v*.25,Gi(6,9.5)*(.75+.4*u)),b);
        _.rotation.set(Gi(-.35,.35),Math.random()*Math.PI*2,Math.PI/2+Gi(-.3,.3),"YXZ"),_.position.set(g,e.world3d.heightAt(g,y),y),_.scale.setScalar(.01),_.frustumCulled=!1,_.renderOrder=6,this.group.add(_),this.crystals.push( {
          m:_,born:u*r,h:f
        })
      }
    }
    e.world3d.scene.add(this.group)
  }
  update(e) {
    this.t+=e;
    let t=!1;
    for(const n of this.crystals) {
      const s=this.t-n.born;
      if(s<0) {
        t=!0;
        continue
      }
      const o=Math.min(1,s/110),r=Math.max(0,(s-this.STAY)/this.SINK);
      r<1&&(t=!0);
      const i=o<1?o*(1.15-.15*o):1;
      n.m.scale.setScalar(Math.max(.01,i*(1-r))),n.m.material.uniforms.alpha.value=1-r*.6
    }
    for(const n of this.mats)n.uniforms.time.value+=e/1e3;
    if(t)return!1;
    this.g.world3d.scene.remove(this.group);
    for(const n of this.crystals)n.m.geometry.dispose();
    for(const n of this.mats)n.dispose();
    return!0
  }
}
const dE=38,Yx=14,Xs=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,f8=`
  uniform float time;
  uniform float prog;
  uniform float alpha;
  uniform float seed;
  varying vec2 vUv;
  ${Ks}
  void main() {
    float u = vUv.x; // 0..1 de un lado del cono al otro
    float v = vUv.y; // 0 en el arco, 1 en el borde del cono
    // bordes laterales y final suaves
    float side = 1.0 - smoothstep(0.36, 0.5, abs(u - 0.5));
    float tip = 1.0 - smoothstep(0.86, 1.0, v);
    // frente de la onda: una banda brillante que avanza hacia fuera
    float d = v - prog;
    float front = exp(-d * d * 260.0);
    // detrás del frente, estelas de viento: rayas a lo largo del cono que corren hacia fuera
    float behind = smoothstep(0.02, -0.08, d) * smoothstep(-0.75, -0.1, d);
    float streak = fbm(vec2(u * 34.0 + seed, v * 3.0 - time * 9.0));
    streak = smoothstep(0.45, 0.85, streak);
    float lines = pow(0.5 + 0.5 * sin(u * 120.0 + seed * 3.0 + fbm(vec2(u * 8.0, seed)) * 6.0), 6.0);
    float wind = behind * (streak * 0.75 + lines * 0.35) * (0.4 + 0.6 * v);
    float core = front * (0.6 + 0.4 * fbm(vec2(u * 18.0 + time * 3.0, seed)));
    // un velo cálido rellena el cono por donde ya pasó la onda
    float veil = behind * 0.4 * (1.0 - v * 0.5);
    float a = (core * 2.6 + wind * 1.6 + veil) * side * tip;
    vec3 warm = vec3(1.0, 0.86, 0.5);
    vec3 white = vec3(1.0, 0.98, 0.9);
    vec3 col = mix(warm, white, clamp(core * 1.4, 0.0, 1.0));
    gl_FragColor = vec4(col * (0.8 + core), a * alpha);
  }`,cE=`
  attribute float aFade;
  varying vec2 vUv;
  varying float vFade;
  void main() {
    vUv = uv;
    vFade = aFade;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`,uE=`
  varying vec2 vUv;
  varying float vFade;
  void main() {
    float along = vUv.x; // 0 cola, 1 punta
    float across = abs(vUv.y - 0.5) * 2.0;
    // trazo: muy fino y brillante en el eje, con un halo que se abre hacia la cola
    float width = mix(0.9, 0.25, along);
    float shaft = 1.0 - smoothstep(0.0, width, across);
    float body = pow(along, 1.6) * shaft;
    // punta: un destello blanco
    float head = smoothstep(0.82, 1.0, along) * (1.0 - smoothstep(0.0, 0.7, across));
    vec3 col = mix(vec3(1.0, 0.78, 0.38), vec3(1.0, 1.0, 0.95), clamp(along * along + head, 0.0, 1.0));
    float a = (body * 0.9 + head * 1.2) * vFade;
    gl_FragColor = vec4(col * (1.0 + head), a);
  }`,st=(a,e)=>a+Math.random()*(e-a);
function hE(a,e,t,n,s,o) {
  const l=[],d=[],c=[];
  for(let h=0;h<=14;h++) {
    const m=h/14,p=Yx+(s-Yx)*m;
    for(let g=0;g<=28;g++) {
      const y=g/28,f=n+(y*2-1)*o*1.12,v=e+Math.cos(f)*p,b=t+Math.sin(f)*p;
      l.push(v,a.world3d.heightAt(v,b)+3,b),d.push(y,m)
    }
  }
  for(let h=0;h<14;h++)for(let m=0;m<28;m++) {
    const p=h*29+m,g=p+28+1;
    c.push(p,g,p+1,g,g+1,p+1)
  }
  const u=new Jt;
  return u.setAttribute("position",new Ce(l,3)),u.setAttribute("uv",new Ce(d,2)),u.setIndex(c),u
}
let x0=null;
function ai() {
  if(x0)return x0;
  const a=.5,e=[-1,0,-a,0,0,-a,0,0,a,-1,0,a,-1,-a,0,0,-a,0,0,a,0,-1,a,0],t=[0,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1],n=[0,1,2,0,2,3,4,5,6,4,6,7],s=new Jt;
  return s.setAttribute("position",new Ce(e,3)),s.setAttribute("uv",new Ce(t,2)),s.setIndex(n),x0=oi(s),s
}
class g8 {
  constructor(e,t,n,s,o,r,i=1) {
    x(this,"view",new ue);
    x(this,"fan");
    x(this,"fanMat");
    x(this,"arrows",[]);
    x(this,"inst");
    x(this,"instMat");
    x(this,"fade");
    x(this,"sparks");
    x(this,"t",0);
    x(this,"life");
    x(this,"m",new ya);
    x(this,"q",new si);
    x(this,"v",new F);
    x(this,"s",new F);
    x(this,"dir",new F);
    x(this,"bow");
    this.g=e,this.x=t,this.y=n;
    const l=e.world3d;
    this.bow=new F(t+Math.cos(s)*10,l.heightAt(t,n)+dE,n+Math.sin(s)*10),this.fanMat=new Ze( {
      vertexShader:Xs,fragmentShader:f8,uniforms: {
        time: {
          value:0
        },prog: {
          value:0
        },alpha: {
          value:1
        },seed: {
          value:Math.random()*50
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.fan=new Ie(hE(e,t,n,s,o,r),this.fanMat),this.fan.frustumCulled=!1,this.fan.renderOrder=6,l.scene.add(this.fan);
    const d=Math.round(16*Math.min(2,i));
    for(let u=0;u<d;u++) {
      const h=(Math.random()+Math.random()-1)*r;
      this.arrows.push( {
        a:s+h,d:o*st(.55,1.02),delay:st(0,.07),dur:st(.16,.24),arc:st(6,22),len:st(34,52),landed:!1
      })
    }
    this.instMat=new Ze( {
      vertexShader:cE,fragmentShader:uE,transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.inst=new Av(ai(),this.instMat,d),this.fade=new io(new Float32Array(d),1),this.inst.geometry=ai().clone(),this.inst.geometry.setAttribute("aFade",this.fade),this.inst.frustumCulled=!1,this.inst.renderOrder=8,l.scene.add(this.inst),this.sparks=new Ot(e,420+d*14),e.addFx(this.sparks);
    const c=this.bow;
    this.sparks.emit( {
      x:c.x,y:c.y,z:c.z,life:160,s0:70*Math.min(1.5,i),s1:20,c0:[1,.95,.8],c1:[1,.7,.3],a0:.9
    }),this.sparks.emit( {
      x:c.x,y:c.y,z:c.z,life:260,s0:30,s1:90,c0:[1,.85,.5],c1:[.9,.5,.2],a0:.35
    });
    for(let u=0;u<18;u++) {
      const h=s+st(-r,r)*.8,m=st(160,420);
      this.sparks.emit( {
        x:c.x,y:c.y,z:c.z,vx:Math.cos(h)*m,vy:st(-30,50),vz:Math.sin(h)*m,life:st(140,260),s0:st(5,9),s1:1.5,c0:[1,1,.9],c1:[1,.6,.2],drag:6
      })
    }
    this.life=.75
  }
  at(e,t,n) {
    const s=10+(e.d-10)*t,o=this.x+Math.cos(e.a)*s,r=this.y+Math.sin(e.a)*s,i=this.g.world3d.heightAt(o,r),l=this.bow.y+(i+4-this.bow.y)*t*t+e.arc*Math.sin(Math.PI*t);
    return n.set(o,l,r)
  }
  update(e) {
    const t=e/1e3;
    this.t+=t;
    const n=this.t;
    this.fanMat.uniforms.time.value=n,this.fanMat.uniforms.prog.value=Math.min(1.15,n/.24),this.fanMat.uniforms.alpha.value=Math.min(1,n/.04)*Math.max(0,1-Math.max(0,n-.25)/.4);
    const s=new F;
    return this.arrows.forEach((o,r)=> {
      const i=(n-o.delay)/o.dur;if(i<=0) {
        this.fade.setX(r,0),this.m.makeScale(0,0,0),this.inst.setMatrixAt(r,this.m);return
      }
      const l=Math.min(1,i),d=this.at(o,l,this.v);this.at(o,Math.max(0,l-.06),s),this.dir.subVectors(d,s),this.dir.lengthSq()<1e-4&&this.dir.set(Math.cos(o.a),0,Math.sin(o.a)),this.dir.normalize(),this.q.setFromUnitVectors(new F(1,0,0),this.dir);const c=Math.max(0,i-1)/.6,u=o.len*(i<1?Math.min(1,i*3):Math.max(0,1-c));if(this.s.set(Math.max(.01,u),9,9),this.m.compose(d,this.q,this.s),this.inst.setMatrixAt(r,this.m),this.fade.setX(r,i<1?1:Math.max(0,1-c)),i<1&&(this.sparks.emit( {
        x:d.x,y:d.y,z:d.z,life:60,s0:16,s1:10,c0:[1,1,.92],c1:[1,.8,.5],a0:.8
      }),Math.random()<.8&&this.sparks.emit( {
        x:d.x,y:d.y,z:d.z,life:st(140,240),s0:st(7,11),s1:1,c0:[1,.85,.55],c1:[.8,.45,.15],a0:.6
      })),i>=1&&!o.landed) {
        o.landed=!0;for(let h=0;h<5;h++) {
          const m=Math.random()*Math.PI*2,p=st(60,160);this.sparks.emit( {
            x:d.x,y:d.y+2,z:d.z,vx:Math.cos(m)*p,vy:st(60,160),vz:Math.sin(m)*p,life:st(180,320),s0:st(4,7),s1:1,c0:[1,.95,.75],c1:[1,.55,.15],grav:-520,drag:2
          })
        }
        this.sparks.emit( {
          x:d.x,y:d.y+4,z:d.z,vx:Math.cos(o.a)*30,vy:18,vz:Math.sin(o.a)*30,life:st(420,620),s0:14,s1:34,c0:[.85,.75,.6],c1:[.6,.52,.42],a0:.3,drag:1.5
        })
      }
    }),this.inst.instanceMatrix.needsUpdate=!0,this.fade.needsUpdate=!0,n<this.life?!1:(this.dispose(),!0)
  }
  dispose() {
    this.g.world3d.scene.remove(this.fan,this.inst),this.fan.geometry.dispose(),this.fanMat.dispose(),this.inst.geometry.dispose(),this.instMat.dispose(),this.sparks.stop()
  }
}
const y8=`
  uniform float time;
  uniform float alpha;
  uniform float seed;
  varying vec2 vUv;
  ${Ks}
  void main() {
    float u = vUv.x;
    float v = vUv.y;
    float side = 1.0 - smoothstep(0.34, 0.5, abs(u - 0.5));
    float tip = 1.0 - smoothstep(0.8, 1.0, v);
    float root = smoothstep(0.0, 0.12, v);
    // el viento se ondula al avanzar: las rayas no son rectas
    float bend = 0.06 * sin(v * 9.0 - time * 4.0 + seed) + 0.04 * sin(v * 17.0 + time * 2.5);
    float uu = u + bend;
    // rachas: rayas largas que corren hacia fuera a distinta velocidad
    float fast = fbm(vec2(uu * 26.0 + seed, v * 2.2 - time * 3.4));
    float slow = fbm(vec2(uu * 11.0 - seed, v * 1.4 - time * 1.6));
    float streak = smoothstep(0.55, 0.85, fast) + 0.6 * smoothstep(0.6, 0.9, slow);
    // bruma de aire que se arremolina
    float haze = fbm(vec2(uu * 4.0 + time * 0.4, v * 3.0 - time * 1.2)) * 0.35;
    float a = (streak * 0.9 + haze) * side * tip * root;
    vec3 col = mix(vec3(0.78, 0.95, 1.0), vec3(1.0, 1.0, 0.94), clamp(streak, 0.0, 1.0));
    gl_FragColor = vec4(col, a * alpha);
  }`;
class v8 {
  constructor(e,t,n,s,o,r,i) {
    x(this,"view",new ue);
    x(this,"fan");
    x(this,"mat");
    x(this,"motes");
    x(this,"t",0);
    this.g=e,this.x=t,this.y=n,this.ang=s,this.r=o,this.half=r,this.secs=i,this.mat=new Ze( {
      vertexShader:Xs,fragmentShader:y8,uniforms: {
        time: {
          value:0
        },alpha: {
          value:0
        },seed: {
          value:Math.random()*50
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.fan=new Ie(hE(e,t,n,s,o,r),this.mat),this.fan.frustumCulled=!1,this.fan.renderOrder=6,e.world3d.scene.add(this.fan),this.motes=new Ot(e,260,!1),e.addFx(this.motes)
  }
  update(e) {
    const t=e/1e3;
    this.t+=t;
    const n=this.t,s=Math.min(1,n/.25,(this.secs-n)/.5);
    if(this.mat.uniforms.time.value=n,this.mat.uniforms.alpha.value=Math.max(0,s)*.85,s>.2) {
      const o=Math.floor(45*t+Math.random());
      for(let r=0;r<o;r++) {
        const i=this.ang+(Math.random()*2-1)*this.half*.85,l=this.r*Math.random()*.5,d=this.x+Math.cos(i)*l,c=this.y+Math.sin(i)*l,u=st(150,260),h=Math.random()<.45;
        this.motes.emit( {
          x:d,y:this.g.world3d.heightAt(d,c)+st(6,26),z:c,vx:Math.cos(i)*u,vy:st(-10,25),vz:Math.sin(i)*u,life:st(500,850),s0:h?st(6,9):st(9,15),s1:h?st(5,8):st(16,24),c0:h?[.55,.78,.35]:[.9,.86,.74],c1:h?[.42,.6,.25]:[.8,.76,.66],a0:h?.9:.3,twinkle:h?.02:0
        })
      }
    }
    return n<this.secs?!1:(this.g.world3d.scene.remove(this.fan),this.fan.geometry.dispose(),this.mat.dispose(),this.motes.stop(),!0)
  }
}
const _8=32,mE=`
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`,b8=`
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  ${Ks}
  void main() {
    float back = 1.0 - vUv.y; // 0 en la punta, 1 al final
    float ang = vUv.x * 6.2831;
    float n = fbm(vec2(cos(ang) * 2.0 + sin(ang) * 1.3, back * 3.0 - time * 9.0));
    float streak = smoothstep(0.45, 0.85, n);
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.0);
    float a = (streak * 0.6 + rim * 0.2 * n) * smoothstep(0.0, 0.08, back) * (1.0 - smoothstep(0.15, 0.85, back));
    vec3 col = mix(vec3(1.0, 0.97, 0.88), vec3(0.72, 0.92, 1.0), back);
    gl_FragColor = vec4(col, a * alpha);
  }`,x8=`
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float back = 1.0 - vUv.y;
    float h = fract(vUv.x + back * 1.8 - time * 4.5);
    float band = exp(-pow((h - 0.5) * 7.0, 2.0));
    float a = band * 0.55 * smoothstep(0.0, 0.1, back) * (1.0 - smoothstep(0.2, 0.9, back));
    gl_FragColor = vec4(vec3(0.85, 0.97, 1.0), a * alpha);
  }`,w8=`
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  void main() {
    float along = vUv.x;
    float across = abs(vUv.y - 0.5) * 2.0;
    float w = mix(0.15, 1.0, smoothstep(0.0, 0.75, along)) * (1.0 - smoothstep(0.88, 1.0, along) * 0.7);
    float core = 1.0 - smoothstep(0.0, w * (0.55 + 0.1 * sin(time * 60.0 + along * 20.0)), across);
    float glow = (1.0 - smoothstep(0.0, w, across)) * 0.6;
    float head = exp(-pow((along - 0.9) * 9.0, 2.0));
    vec3 col = mix(vec3(1.0, 0.75, 0.3), vec3(1.0, 1.0, 0.96), clamp(core + head, 0.0, 1.0));
    float a = (core + glow * along + head) * smoothstep(0.0, 0.25, along);
    gl_FragColor = vec4(col * (1.0 + head * 0.8), clamp(a, 0.0, 1.0) * alpha);
  }`,Dp=`
  uniform float alpha;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float ring = exp(-pow((r - 0.85) * 9.0, 2.0)) + exp(-pow((r - 0.6) * 14.0, 2.0)) * 0.35;
    gl_FragColor = vec4(vec3(0.88, 0.97, 1.0), ring * alpha);
  }`;
class pE {
  constructor(e) {
    x(this,"view",new ue);
    x(this,"rings",[]);
    x(this,"dust");
    x(this,"sparks");
    x(this,"done",!1);
    x(this,"ringGeo",new cs(1,1));
    this.g=e,this.dust=new Ot(e,320,!1),this.sparks=new Ot(e,520),e.addFx(this.dust),e.addFx(this.sparks)
  }
  ring(e,t,n,s,o,r=1) {
    const i=new Ze( {
      vertexShader:Xs,fragmentShader:Dp,uniforms: {
        alpha: {
          value:r
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),l=new Ie(this.ringGeo,i);
    l.position.copy(e),l.quaternion.setFromUnitVectors(new F(0,0,1),t),l.scale.setScalar(2*n),l.renderOrder=8,l.frustumCulled=!1,this.g.world3d.scene.add(l),this.rings.push( {
      mesh:l,mat:i,t:0,life:o,r0:n,r1:s,a0:r
    })
  }
  update(e) {
    const t=e/1e3;
    return this.rings=this.rings.filter(n=> {
      n.t+=t;const s=Math.min(1,n.t/n.life),o=1-(1-s)**3;return n.mesh.scale.setScalar(2*(n.r0+(n.r1-n.r0)*o)),n.mat.uniforms.alpha.value=n.a0*(1-s)**1.5,s<1?!0:(this.g.world3d.scene.remove(n.mesh),n.mat.dispose(),!1)
    }),!this.done||this.rings.length?!1:(this.ringGeo.dispose(),this.dust.stop(),this.sparks.stop(),!0)
  }
}
const M8=.6;
class S8 {
  constructor(e,t=1) {
    x(this,"group",new on);
    x(this,"geos",[]);
    x(this,"mats",[]);
    x(this,"spirals",[]);
    x(this,"wake");
    x(this,"light");
    x(this,"t",0);
    x(this,"lastRing",0);
    x(this,"started",!1);
    x(this,"last",null);
    x(this,"dir",new F(1,0,0));
    x(this,"side",new F(0,0,1));
    x(this,"size");
    this.g=e,this.size=t*M8;
    const n=r=> {
      const i=new Ze( {
        vertexShader:mE,fragmentShader:r,uniforms: {
          time: {
            value:0
          },alpha: {
            value:0
          }
        },transparent:!0,depthWrite:!1,blending:Rt,side:rt
      });
      return this.mats.push(i),i
    },s=(r,i,l,d)=> {
      const c=new Fo(r,i,l,32,1,!0);
      return c.translate(0,-l/2,0),c.rotateZ(Math.PI/2),c.translate(d,0,0),this.geos.push(c),c
    };
    this.group.add(new Ie(s(3,30,120,26),n(b8)));
    for(const[r,i]of[[13,110]]) {
      const l=new Ie(s(r*.4,r,i,20),n(x8));
      this.spirals.push(l),this.group.add(l)
    }
    const o=new Ie(ai(),n(w8));
    o.scale.set(84,13,13),o.position.x=40,this.group.add(o);
    for(const r of this.group.children)r.renderOrder=8,r.frustumCulled=!1;
    this.group.scale.setScalar(this.size),e.world3d.scene.add(this.group),this.wake=new pE(e),e.addFx(this.wake),this.light=e.groundSprite(zd(),!0),this.light.tint=13627391,this.light.size=150*this.size,this.light.alpha=0
  }
  update(e,t,n,s,o) {
    this.t+=s;
    const r=this.g.world3d,i=new F(e,r.heightAt(e,t)+_8,t);
    this.group.position.copy(i),this.group.rotation.set(0,-n,0),this.dir.set(Math.cos(n),0,Math.sin(n)),this.side.set(-this.dir.z,0,this.dir.x),this.spirals[0].rotation.x+=s*14;
    for(const h of this.mats)h.uniforms.time.value=this.t,h.uniforms.alpha.value=o;
    this.light.x=e+Math.cos(n)*30,this.light.y=t+Math.sin(n)*30,this.light.alpha=.35*o;
    const l=this.size,d=this.wake;
    if(!this.started) {
      this.started=!0,d.ring(i.clone().addScaledVector(this.dir,20),this.dir,10*l,70*l,.45),d.ring(i.clone().addScaledVector(this.dir,40),this.dir,6*l,46*l,.35),d.sparks.emit( {
        x:i.x,y:i.y,z:i.z,life:180,s0:80*l,s1:24,c0:[1,1,.92],c1:[.7,.9,1],a0:.6
      });
      for(let h=0;h<16;h++) {
        const m=Math.random()*Math.PI*2,p=st(120,320),g=this.side.clone().multiplyScalar(Math.cos(m)*p).add(new F(0,Math.sin(m)*p,0)).addScaledVector(this.dir,st(-60,120));
        d.sparks.emit( {
          x:i.x,y:i.y,z:i.z,vx:g.x,vy:g.y,vz:g.z,life:st(200,380),s0:st(5,9),s1:1,c0:[1,1,.95],c1:[.6,.85,1],drag:5
        })
      }
    }
    o>.3&&this.t-this.lastRing>.035&&(this.lastRing=this.t,d.ring(i.clone().addScaledVector(this.dir,-6*l),this.dir,14*l,46*l,.4,.9));
    const c=i.clone().addScaledVector(this.dir,40*l);
    o>.2&&(d.sparks.emit( {
      x:c.x,y:c.y,z:c.z,life:70,s0:75*l,s1:55*l,c0:[1,1,.95],c1:[.8,.95,1],a0:.7*o
    }),d.sparks.emit( {
      x:c.x,y:c.y,z:c.z,life:90,s0:150*l,s1:110*l,c0:[.55,.85,1],c1:[.4,.7,1],a0:.22*o
    }));
    const u=this.last??i;
    if(o>.2) {
      const h=Math.floor(120*s+Math.random());
      for(let g=0;g<h;g++) {
        const y=u.clone().lerp(i,Math.random()).addScaledVector(this.dir,20*l);
        d.sparks.emit( {
          x:y.x,y:y.y,z:y.z,life:st(320,480),s0:st(40,56)*l,s1:8,c0:[.8,.94,1],c1:[.3,.55,1],a0:.4
        })
      }
      const m=Math.floor(160*s+Math.random());
      for(let g=0;g<m;g++) {
        const y=u.clone().lerp(i,Math.random());
        d.sparks.emit( {
          x:y.x+st(-8,8)*l,y:y.y+st(-8,8)*l,z:y.z+st(-8,8)*l,vx:-this.dir.x*40,vy:st(-10,10),vz:-this.dir.z*40,life:st(160,320),s0:st(7,12)*l,s1:1,c0:[.95,.98,1],c1:[.55,.8,1],a0:.7
        })
      }
      const p=Math.floor(40*s+Math.random());
      for(let g=0;g<p;g++) {
        const y=u.clone().lerp(i,Math.random()),f=Math.random()<.5?-1:1,v=y.x+this.side.x*10*f,b=y.z+this.side.z*10*f,_=st(90,200)*f;
        d.dust.emit( {
          x:v,y:r.heightAt(v,b)+4,z:b,vx:this.side.x*_,vy:st(20,60),vz:this.side.z*_,life:st(450,750),s0:st(12,18)*l,s1:st(28,40)*l,c0:[.86,.8,.68],c1:[.74,.68,.58],a0:.35,drag:2.5
        })
      }
    }
    this.last=i
  }
  dispose() {
    this.g.world3d.scene.remove(this.group);
    for(const e of this.geos)e.dispose();
    for(const e of this.mats)e.dispose();
    this.light.dispose(),this.wake.done=!0
  }
}
function A8(a,e,t,n,s) {
  const o=new Ot(a,60),r=a.world3d.heightAt(e,t)+26,i=Math.atan2(t-s,e-n);
  o.emit( {
    x:e,y:r,z:t,life:140,s0:38,s1:14,c0:[1,1,.95],c1:[.6,.85,1],a0:.7
  });
  for(let l=0;l<14;l++) {
    const d=i+st(-.9,.9),c=st(160,380);
    o.emit( {
      x:e,y:r,z:t,vx:Math.cos(d)*c,vy:st(-40,120),vz:Math.sin(d)*c,life:st(180,340),s0:st(4,8),s1:1,c0:[1,1,.9],c1:[.55,.8,1],drag:4,grav:-300
    })
  }
  o.stop(),a.addFx(o)
}
const k8=`
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  ${Ks}
  void main() {
    float v = vUv.y; // 0 abajo, 1 arriba
    float h = fract(vUv.x * 3.0 + v * 1.4 - time * 3.2);
    float band = exp(-pow((h - 0.5) * 5.0, 2.0));
    float n = fbm(vec2(vUv.x * 9.0 + time, v * 4.0 - time * 4.0));
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
    float a = (band * 0.8 + n * 0.3) * (0.4 + 0.6 * rim) * smoothstep(0.0, 0.12, v) * (1.0 - smoothstep(0.55, 1.0, v));
    vec3 col = mix(vec3(1.0, 1.0, 0.95), vec3(0.6, 0.85, 1.0), v);
    gl_FragColor = vec4(col, a * alpha);
  }`;
class E8 {
  constructor(e,t,n,s) {
    x(this,"view",new ue);
    x(this,"twister");
    x(this,"tMat");
    x(this,"rings",[]);
    x(this,"ringGeo",new cs(1,1));
    x(this,"ps");
    x(this,"dust");
    x(this,"light");
    x(this,"t",0);
    x(this,"life",.75);
    this.g=e,this.r=s;
    const o=e.world3d,r=o.heightAt(t,n),i=new Fo(s*.55,s*.18,s*1.3,36,10,!0);
    i.translate(0,s*.65,0),this.tMat=new Ze( {
      vertexShader:mE,fragmentShader:k8,uniforms: {
        time: {
          value:0
        },alpha: {
          value:0
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.twister=new Ie(i,this.tMat),this.twister.position.set(t,r,n),this.twister.renderOrder=8,this.twister.frustumCulled=!1,o.scene.add(this.twister);
    for(const d of[0,.08]) {
      const c=new Ze( {
        vertexShader:Xs,fragmentShader:Dp,uniforms: {
          alpha: {
            value:0
          }
        },transparent:!0,depthWrite:!1,blending:Rt,side:rt
      }),u=new Ie(this.ringGeo,c);
      u.rotation.x=-Math.PI/2,u.position.set(t,r+6,n),u.renderOrder=8,u.frustumCulled=!1,o.scene.add(u),this.rings.push( {
        mesh:u,mat:c,delay:d
      })
    }
    this.light=e.groundSprite(zd(),!0),this.light.tint=14217983,this.light.x=t,this.light.y=n,this.light.size=s*2.4,this.ps=new Ot(e,200),this.dust=new Ot(e,80,!1),e.addFx(this.ps),e.addFx(this.dust);
    const l=r+30;
    this.ps.emit( {
      x:t,y:l,z:n,life:220,s0:s*1.4,s1:s*.5,c0:[1,1,.95],c1:[.6,.85,1],a0:.9
    });
    for(let d=0;d<60;d++) {
      const c=Math.random()*Math.PI*2,u=st(s*1.5,s*3.2);
      this.ps.emit( {
        x:t,y:l,z:n,vx:Math.cos(c)*u,vy:st(-20,160),vz:Math.sin(c)*u,life:st(260,480),s0:st(5,10),s1:1,c0:[1,1,.92],c1:[.55,.8,1],drag:3.5,grav:-200
      })
    }
    for(let d=0;d<26;d++) {
      const c=Math.random()*Math.PI*2,u=st(.2,.9)*s,h=st(90,180),m=t+Math.cos(c)*u,p=n+Math.sin(c)*u;
      this.dust.emit( {
        x:m,y:o.heightAt(m,p)+6,z:p,vx:Math.cos(c)*h,vy:st(30,90),vz:Math.sin(c)*h,life:st(500,800),s0:st(18,26),s1:st(40,56),c0:[.86,.8,.68],c1:[.74,.68,.58],a0:.4,drag:2
      })
    }
    this.ps.stop(),this.dust.stop()
  }
  update(e) {
    const t=e/1e3;
    this.t+=t;
    const n=this.t,s=n/this.life;
    this.tMat.uniforms.time.value=n,this.tMat.uniforms.alpha.value=Math.min(1,n/.06)*Math.max(0,1-Math.max(0,s-.35)/.65);
    const o=1-(1-Math.min(1,n/.25))**3;
    this.twister.scale.set(.5+.5*o,.3+.9*o,.5+.5*o),this.twister.rotation.y-=t*9;
    for(const i of this.rings) {
      const l=Math.max(0,Math.min(1,(n-i.delay)/.45)),d=1-(1-l)**3;
      i.mesh.scale.setScalar(2*this.r*(.2+.95*d)),i.mat.uniforms.alpha.value=l>0?(1-l)**1.4:0
    }
    if(this.light.alpha=.6*Math.max(0,1-s),s<1)return!1;
    const r=this.g.world3d.scene;
    r.remove(this.twister),this.twister.geometry.dispose(),this.tMat.dispose();
    for(const i of this.rings)r.remove(i.mesh),i.mat.dispose();
    return this.ringGeo.dispose(),this.light.dispose(),!0
  }
}
function P9(a,e,t,n) {
  a.addFx(new E8(a,e,t,n))
}
const So=18,C8=`
  attribute float along;
  attribute float across;
  varying float vAlong;
  varying float vAcross;
  void main() {
    vAlong = along;
    vAcross = across;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,T8=`
  uniform float alpha;
  uniform vec3 tint;
  varying float vAlong;
  varying float vAcross;
  void main() {
    float edge = 1.0 - smoothstep(0.0, 1.0, abs(vAcross));
    float core = 1.0 - smoothstep(0.0, 0.35, abs(vAcross));
    float a = pow(vAlong, 1.4) * (edge * 0.75 + core * 0.6);
    vec3 col = mix(tint, vec3(1.0, 1.0, 0.96), clamp(core * vAlong * 1.2, 0.0, 1.0));
    gl_FragColor = vec4(col, a * alpha);
  }`;
class Zv {
  constructor(e,t,n,s,o,r=7,i={}) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"pos");
    x(this,"pts",[]);
    x(this,"sparks");
    x(this,"t",0);
    x(this,"p0");
    x(this,"p1");
    x(this,"p2");
    x(this,"landed",!1);
    x(this,"fadeMs",140);
    this.g=e,this.ms=o,this.width=r,this.look=i;
    const l=e.world3d,d=n.x-t.x,c=n.y-t.y,u=Math.hypot(d,c)||1,h=-c/u,m=d/u;
    this.p0=new F(t.x+d/u*12,l.heightAt(t.x,t.y)+38,t.y+c/u*12),this.p2=new F(n.x,l.heightAt(n.x,n.y)+26,n.y);
    const p=s*Math.min(85,20+u*.18)*(.8+Math.random()*.4)*(i.bend??1),g=t.x+d*.45+h*p,y=t.y+c*.45+m*p;
    this.p1=new F(g,(this.p0.y+this.p2.y)/2+(i.lift??14)+Math.random()*12,y);
    const f=So*4,v=new Jt;
    this.pos=new fs(new Float32Array(f*3),3);
    const b=new Float32Array(f),_=new Float32Array(f),S=[];
    for(let M=0;M<2;M++)for(let k=0;k<So;k++) {
      const C=(M*So+k)*2;
      b[C]=b[C+1]=k/(So-1),_[C]=-1,_[C+1]=1,k<So-1&&S.push(C,C+1,C+2,C+1,C+3,C+2)
    }
    v.setAttribute("position",this.pos),v.setAttribute("along",new fs(b,1)),v.setAttribute("across",new fs(_,1)),v.setIndex(S),this.mat=new Ze( {
      vertexShader:C8,fragmentShader:T8,uniforms: {
        alpha: {
          value:1
        },tint: {
          value:new St(...i.tint??[1,.72,.32])
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.mesh=new Ie(v,this.mat),this.mesh.frustumCulled=!1,this.mesh.renderOrder=8,l.scene.add(this.mesh),this.sparks=new Ot(e,90),e.addFx(this.sparks),i.muzzle!==!1&&e.addFx(new Fp(e,this.p0,this.p1.clone().sub(this.p0)))
  }
  at(e,t=new F) {
    const n=1-e;
    return t.set(n*n*this.p0.x+2*n*e*this.p1.x+e*e*this.p2.x,n*n*this.p0.y+2*n*e*this.p1.y+e*e*this.p2.y,n*n*this.p0.z+2*n*e*this.p1.z+e*e*this.p2.z)
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms),n=this.at(t*(.85+.15*t));
    if(this.pts.push(n),this.pts.length>So&&this.pts.shift(),t>=1&&!this.landed) {
      this.landed=!0;
      const o=this.p2,[r,i]=this.look.spark??[[1,1,.9],[1,.55,.15]];
      this.sparks.emit( {
        x:o.x,y:o.y,z:o.z,life:130,s0:46,s1:14,c0:[1,1,.95],c1:r,a0:.9
      });
      for(let l=0;l<9;l++) {
        const d=Math.random()*Math.PI*2,c=90+Math.random()*180;
        this.sparks.emit( {
          x:o.x,y:o.y,z:o.z,vx:Math.cos(d)*c,vy:40+Math.random()*140,vz:Math.sin(d)*c,life:180+Math.random()*160,s0:4+Math.random()*4,s1:1,c0:r,c1:i,grav:-500,drag:2
        })
      }
    }
    if(t>=1&&this.pts.shift(),t<1&&Math.random()<.6) {
      const[o,r]=this.look.spark??[[1,.9,.6],[1,.5,.15]];
      this.sparks.emit( {
        x:n.x,y:n.y,z:n.z,life:160,s0:6,s1:1,c0:o,c1:r,a0:.6
      })
    }
    this.build();
    const s=Math.max(0,this.t-this.ms);
    return this.mat.uniforms.alpha.value=Math.max(0,1-s/this.fadeMs),t<1||s<this.fadeMs&&this.pts.length>1?!1:(this.g.world3d.scene.remove(this.mesh),this.mesh.geometry.dispose(),this.mat.dispose(),this.sparks.stop(),!0)
  }
  build() {
    const e=this.pos.array,t=this.pts.length,n=this.g.world3d.perspective.position,s=new F,o=new F,r=new F;
    for(let i=0;i<So;i++) {
      const l=this.pts[Math.max(0,Math.min(t-1,t-So+i))]??this.p0,d=this.pts[Math.max(0,Math.min(t-1,t-So+i+1))]??l;
      s.subVectors(d,l),s.lengthSq()<1e-6&&s.set(1,0,0),s.normalize(),o.subVectors(n,l).cross(s).normalize(),r.crossVectors(s,o).normalize();
      const c=this.width*(.25+.75*(i/(So-1))),u=i*2,h=(So+i)*2;
      e.set([l.x-o.x*c,l.y-o.y*c,l.z-o.z*c,l.x+o.x*c,l.y+o.y*c,l.z+o.z*c],u*3),e.set([l.x-r.x*c,l.y-r.y*c,l.z-r.z*c,l.x+r.x*c,l.y+r.y*c,l.z+r.z*c],h*3)
    }
    this.pos.needsUpdate=!0
  }
}
const P8=`
  uniform float alpha;
  uniform float seed;
  varying vec2 vUv;
  ${Ks}
  void main() {
    float along = 1.0 - vUv.x; // 0 en el arco, 1 en la punta de la llamarada (la geometría va girada)
    float across = abs(vUv.y - 0.5) * 2.0;
    // silueta de llama: ancha cerca del arco y en punta, con bordes dentados que cambian en cada disparo
    float jag = 0.75 + 0.5 * fNoise(vec2(along * 9.0 + seed, seed * 1.7));
    float w = (1.0 - along) * jag * (0.35 + 0.65 * smoothstep(0.0, 0.25, along));
    float body = 1.0 - smoothstep(w * 0.55, w, across);
    float core = 1.0 - smoothstep(0.0, w * 0.4, across);
    vec3 col = mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 1.0, 0.94), clamp(core + (1.0 - along) * 0.4, 0.0, 1.0));
    gl_FragColor = vec4(col * (1.0 + core * 0.6), (body * 0.85 + core * 0.6) * alpha);
  }`;
class Fp {
  constructor(e,t,n,s=1.7) {
    x(this,"view",new ue);
    x(this,"group",new on);
    x(this,"mats",[]);
    x(this,"petals",[]);
    x(this,"flame");
    x(this,"ring");
    x(this,"ringMat");
    x(this,"ps");
    x(this,"t",0);
    x(this,"life",.13);
    this.g=e,this.size=s;
    const o=n.clone().normalize(),r=Math.random()*30,i=()=> {
      const u=new Ze( {
        vertexShader:Xs,fragmentShader:P8,uniforms: {
          alpha: {
            value:1
          },seed: {
            value:r+this.mats.length*3.1
          }
        },transparent:!0,depthWrite:!1,blending:Rt,side:rt
      });
      return this.mats.push(u),u
    },l=ai().clone();
    l.scale(-1,1,1),this.flame=new Ie(l,i()),this.group.add(this.flame);
    for(const u of[.9,-.9,2,-2]) {
      const h=new Ie(l,i());
      h.rotation.set(Math.random()*Math.PI,u,0),this.petals.push(h),this.group.add(h)
    }
    this.group.position.copy(t),this.group.quaternion.setFromUnitVectors(new F(1,0,0),o);
    for(const u of this.group.children)u.renderOrder=9,u.frustumCulled=!1;
    e.world3d.scene.add(this.group),this.ringMat=new Ze( {
      vertexShader:Xs,fragmentShader:Dp,uniforms: {
        alpha: {
          value:1
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.ring=new Ie(new cs(1,1),this.ringMat),this.ring.position.copy(t).addScaledVector(o,8*s),this.ring.quaternion.setFromUnitVectors(new F(0,0,1),o),this.ring.renderOrder=9,this.ring.frustumCulled=!1,e.world3d.scene.add(this.ring),this.ps=new Ot(e,40),e.addFx(this.ps),this.ps.emit( {
      x:t.x,y:t.y,z:t.z,life:70,s0:46*s,s1:20*s,c0:[1,1,.92],c1:[1,.7,.3],a0:1
    });
    const d=new F(-o.z,0,o.x);
    for(let u=0;u<8;u++) {
      const h=300+Math.random()*300,m=o.clone().multiplyScalar(h).addScaledVector(d,(Math.random()-.5)*h*.9).add(new F(0,(Math.random()-.3)*h*.5,0));
      this.ps.emit( {
        x:t.x,y:t.y,z:t.z,vx:m.x,vy:m.y,vz:m.z,life:90+Math.random()*90,s0:4+Math.random()*3,s1:1,c0:[1,1,.85],c1:[1,.5,.15],drag:6
      })
    }
    this.ps.stop();
    const c=new Ot(e,4,!1);
    e.addFx(c),c.emit( {
      x:t.x+o.x*10,y:t.y,z:t.z+o.z*10,vx:o.x*40,vy:25,vz:o.z*40,life:380,s0:12*s,s1:30*s,c0:[.92,.9,.85],c1:[.8,.78,.74],a0:.3,drag:2
    }),c.stop()
  }
  update(e) {
    this.t+=e/1e3;
    const t=Math.min(1,this.t/this.life),n=this.size,o=(34+10*Math.min(1,t/.25))*(1-t*.6)*n;
    this.flame.scale.set(o,22*n*(1-t*.4),22*n*(1-t*.4));
    for(const i of this.petals)i.scale.set(o*.55,12*n,12*n);
    for(const i of this.mats)i.uniforms.alpha.value=(1-t)**1.2;
    if(this.ring.scale.setScalar((10+34*(1-(1-t)**2))*n),this.ringMat.uniforms.alpha.value=(1-t)**1.5,t<1)return!1;
    this.g.world3d.scene.remove(this.group,this.ring);
    for(const i of this.mats)i.dispose();
    return this.ringMat.dispose(),this.ring.geometry.dispose(),this.flame.geometry.dispose(),!0
  }
}
const R8=`
  uniform float alpha;
  varying vec2 vUv;
  void main() {
    float along = vUv.x; // 0 cola, 1 punta
    float across = abs(vUv.y - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.22, across);
    float body = 1.0 - smoothstep(0.2, 1.0, across);
    float head = smoothstep(0.86, 1.0, along);
    vec3 edge = mix(vec3(1.0, 0.72, 0.3), vec3(0.6, 0.88, 1.0), across);
    vec3 col = mix(edge, vec3(1.0, 1.0, 0.97), clamp(core + head * 0.6, 0.0, 1.0));
    float a = (core * 1.1 + body * 0.55) * pow(along, 1.3) + head * (1.0 - smoothstep(0.0, 0.8, across));
    gl_FragColor = vec4(col * (1.0 + head), clamp(a, 0.0, 1.0) * alpha);
  }`;
class fE {
  constructor(e,t,n,s) {
    x(this,"view",new ue);
    x(this,"beam");
    x(this,"mat");
    x(this,"wake");
    x(this,"t",0);
    x(this,"from");
    x(this,"dir");
    x(this,"len");
    x(this,"lastRing",0);
    x(this,"ended",!1);
    x(this,"tailMs",160);
    this.g=e,this.ms=s;
    const o=e.world3d,r=o.heightAt(t.x,t.y)+36;
    this.from=new F(t.x,r,t.y);
    const i=new F(n.x,r-6,n.y);
    this.len=i.distanceTo(this.from),this.dir=i.sub(this.from).normalize(),this.mat=new Ze( {
      vertexShader:Xs,fragmentShader:R8,uniforms: {
        alpha: {
          value:1
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.beam=new Ie(ai(),this.mat),this.beam.quaternion.setFromUnitVectors(new F(1,0,0),this.dir),this.beam.renderOrder=9,this.beam.frustumCulled=!1,o.scene.add(this.beam),this.wake=new pE(e),e.addFx(this.wake),e.addFx(new Fp(e,this.from.clone().addScaledVector(this.dir,12),this.dir,3)),this.wake.ring(this.from.clone().addScaledVector(this.dir,24),this.dir,8,52,.3),e.shake(.08,2)
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms),n=this.len*t,s=Math.max(0,this.t-this.ms)/this.tailMs,o=Math.min(n,260)*(1-Math.min(1,s)),r=this.from.clone().addScaledVector(this.dir,n);
    this.beam.position.copy(r),this.beam.scale.set(Math.max(.01,o),16,16),this.mat.uniforms.alpha.value=1-Math.min(1,s)*.6;
    const i=this.wake;
    if(t<1) {
      i.sparks.emit( {
        x:r.x,y:r.y,z:r.z,life:60,s0:48,s1:30,c0:[1,1,.95],c1:[.7,.9,1],a0:.9
      });
      for(let l=0;l<3;l++) {
        const d=r.clone().addScaledVector(this.dir,-Math.random()*60);
        i.sparks.emit( {
          x:d.x,y:d.y+(Math.random()-.5)*8,z:d.z,life:200+Math.random()*160,s0:7,s1:1,c0:[1,.95,.75],c1:[.6,.8,1],a0:.7
        })
      }
      n-this.lastRing>46&&(this.lastRing=n,i.ring(r.clone(),this.dir,10,30,.28,.8))
    }
    else if(!this.ended) {
      this.ended=!0,i.sparks.emit( {
        x:r.x,y:r.y,z:r.z,life:160,s0:70,s1:20,c0:[1,1,.95],c1:[1,.75,.3],a0:1
      });
      for(let l=0;l<14;l++) {
        const d=Math.random()*Math.PI*2,c=140+Math.random()*220;
        i.sparks.emit( {
          x:r.x,y:r.y,z:r.z,vx:this.dir.x*160+Math.cos(d)*c,vy:40+Math.random()*140,vz:this.dir.z*160+Math.sin(d)*c,life:200+Math.random()*200,s0:5,s1:1,c0:[1,1,.9],c1:[1,.55,.15],grav:-400,drag:2
        })
      }
    }
    return s<1?!1:(this.g.world3d.scene.remove(this.beam),this.mat.dispose(),i.done=!0,!0)
  }
}
const gE=`
  uniform float alpha;
  varying vec2 vUv;
  void main() {
    float along = vUv.x; // 0 cola, 1 punta
    float across = abs(vUv.y - 0.5) * 2.0;
    float width = mix(0.9, 0.3, along);
    float shaft = 1.0 - smoothstep(0.0, width, across);
    float body = pow(along, 1.5) * shaft;
    float head = smoothstep(0.8, 1.0, along) * (1.0 - smoothstep(0.0, 0.7, across));
    vec3 col = mix(vec3(1.0, 0.76, 0.34), vec3(1.0, 1.0, 0.95), clamp(along * along + head, 0.0, 1.0));
    gl_FragColor = vec4(col * (1.0 + head), (body * 0.95 + head * 1.2) * alpha);
  }`,z8=new F;
class e1 {
  constructor(e,t,n,s,o,r,i,l=!0) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"dir");
    x(this,"ps");
    x(this,"t",0);
    x(this,"landed",!1);
    x(this,"fadeMs",120);
    this.g=e,this.a=t,this.b=n,this.ms=s,this.len=o,this.width=r,this.impact=i,this.dir=n.clone().sub(t).normalize(),this.mat=new Ze( {
      vertexShader:Xs,fragmentShader:gE,uniforms: {
        alpha: {
          value:1
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.mesh=new Ie(ai(),this.mat),this.mesh.quaternion.setFromUnitVectors(new F(1,0,0),this.dir),this.mesh.renderOrder=8,this.mesh.frustumCulled=!1,this.mesh.scale.set(.01,r,r),e.world3d.scene.add(this.mesh),this.ps=l?new Ot(e,40):null,this.ps&&e.addFx(this.ps)
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms),n=z8.copy(this.a).lerp(this.b,t),s=Math.max(0,this.t-this.ms)/this.fadeMs,o=this.a.distanceTo(n);
    this.mesh.position.copy(n),this.mesh.scale.set(Math.max(.01,Math.min(this.len,o)*(1-Math.min(1,s))),this.width,this.width),this.mat.uniforms.alpha.value=1-Math.min(1,s);
    const r=this.ps;
    if(r&&t<1&&Math.random()<.5&&r.emit( {
      x:n.x,y:n.y,z:n.z,life:140,s0:6,s1:1,c0:[1,.92,.65],c1:[1,.55,.15],a0:.6
    }),t>=1&&!this.landed&&(this.landed=!0,this.impact&&r)) {
      const i=this.b;
      r.emit( {
        x:i.x,y:i.y+4,z:i.z,life:120,s0:40,s1:14,c0:[1,1,.95],c1:[1,.72,.3],a0:.9
      });
      for(let l=0;l<6;l++) {
        const d=Math.random()*Math.PI*2,c=70+Math.random()*130;
        r.emit( {
          x:i.x,y:i.y+3,z:i.z,vx:Math.cos(d)*c,vy:60+Math.random()*120,vz:Math.sin(d)*c,life:180+Math.random()*160,s0:4+Math.random()*3,s1:1,c0:[1,1,.88],c1:[1,.55,.15],grav:-500,drag:2
        })
      }
      r.emit( {
        x:i.x,y:i.y+6,z:i.z,vy:20,life:450,s0:12,s1:30,c0:[.86,.8,.68],c1:[.74,.68,.58],a0:.25
      })
    }
    return s<1?!1:(this.g.world3d.scene.remove(this.mesh),this.mat.dispose(),r==null||r.stop(),!0)
  }
}
const t1=110;
class L8 {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"s");
    x(this,"t",0);
    this.r=s,this.secs=o;
    const r=$t("tex_magic_target");
    this.s=r?e.groundSprite(r):null,this.s&&(this.s.x=t,this.s.y=n)
  }
  update(e) {
    this.t+=e;
    const t=this.s;
    if(!t)return!0;
    t.rotation+=e*.0012;
    const n=Math.min(1,this.t/200);
    t.size=this.r*2*(.6+.4*n);
    const s=this.secs*1e3-this.t;
    return t.alpha=n*Math.max(0,Math.min(1,s/250))*.9,s>0?!1:(t.dispose(),!0)
  }
}
function D8(a,e,t,n,s,o,r,i) {
  const l=a.world3d;
  a.addFx(new L8(a,n,s,o,i));
  const d=Math.atan2(s-t,n-e),c=new F(e+Math.cos(d)*10,l.heightAt(e,t)+40,t+Math.sin(d)*10),u=xd()<.5,h=u?2:6;
  for(let g=0;g<h;g++)a.schedule(g*.045,()=> {
    const y=d+(g-(h-1)/2)*.18,f=new F(Math.cos(y)*.35,1,Math.sin(y)*.35).normalize(),v=c.clone().addScaledVector(f,460);a.addFx(new e1(a,c.clone(),v,230,80,10,!1,!u)),a.addFx(new Fp(a,c.clone(),f,1.4))
  });
  const m=Math.max(8,Math.min(150,50*(o/t1)**2)*xd()),p=Math.round((i-r-.35)*m);
  for(let g=0;g<p;g++)a.schedule(r+g/m+Math.random()*.02,()=> {
    const y=Math.random()*Math.PI*2,f=Math.sqrt(Math.random())*o*.95;a.addFx(yE(a,n+Math.cos(y)*f,s+Math.sin(y)*f*.85,Math.random()<.35))
  })
}
function yE(a,e,t,n) {
  const s=a.world3d.heightAt(e,t),o=Math.random()*Math.PI*2,r=new F(e+Math.cos(o)*40,s+240,t+Math.sin(o)*40);
  return new e1(a,r,new F(e,s+4,t),120+Math.random()*40,150+Math.random()*40,11+Math.random()*3,n,xd()>=.5)
}
function F8(a,e,t) {
  return yE(a,e,t,!0)
}
const I8=`
  varying vec2 vP;
  void main() {
    vP = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,B8=`
  uniform float time;
  uniform float alpha;
  uniform float seed;
  uniform float grow;
  varying vec2 vP;
  ${Ks}
  void main() {
    float r = length(vP);
    // se extiende desde el centro al aparecer
    float reach = smoothstep(grow, grow - 0.25, r);
    float edge = 1.0 - smoothstep(0.75, 1.0, r);
    vec2 q = vP * 5.0 + seed;
    float n = fbm(q);
    // vetas: líneas finas donde el ruido cruza un valor
    float vein = 1.0 - smoothstep(0.0, 0.06, abs(fbm(q * 1.7 + 3.0) - 0.5));
    // destellos que parpadean
    float sp = fHash(floor(vP * 40.0) + seed);
    float glint = step(0.965, sp) * (0.5 + 0.5 * sin(time * 7.0 + sp * 60.0));
    vec3 gold = mix(vec3(0.72, 0.5, 0.16), vec3(1.0, 0.86, 0.45), n);
    vec3 col = mix(gold, vec3(1.0, 0.97, 0.8), clamp(vein * 0.7 + glint, 0.0, 1.0));
    float a = (0.32 + 0.25 * n + vein * 0.35 + glint * 0.6) * edge * reach * alpha;
    gl_FragColor = vec4(col, a);
  }`;
function Hd(a,e,t,n) {
  const r=[e,a.world3d.heightAt(e,t)+2,t],i=[.5,.5],l=[];
  for(let u=1;u<=12;u++) {
    const h=u/12*n;
    for(let m=0;m<36;m++) {
      const p=m/36*Math.PI*2,g=e+Math.cos(p)*h,y=t+Math.sin(p)*h;
      r.push(g,a.world3d.heightAt(g,y)+2,y),i.push(.5+Math.cos(p)*h/(2*n),.5+Math.sin(p)*h/(2*n))
    }
  }
  const d=(u,h)=>u===0?0:1+(u-1)*36+h%36;
  for(let u=0;u<36;u++)l.push(0,d(1,u),d(1,u+1));
  for(let u=1;u<12;u++)for(let h=0;h<36;h++)l.push(d(u,h),d(u+1,h),d(u,h+1),d(u+1,h),d(u+1,h+1),d(u,h+1));
  const c=new Jt;
  return c.setAttribute("position",new Ce(r,3)),c.setAttribute("uv",new Ce(i,2)),c.setIndex(l),c
}
const N8=`
  varying float vH;
  varying vec3 vN;
  void main() {
    vH = uv.y;
    vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`,U8=`
  uniform float alpha;
  varying float vH;
  varying vec3 vN;
  void main() {
    float lit = 0.55 + 0.45 * max(0.0, dot(normalize(vN), normalize(vec3(0.3, 1.0, 0.4))));
    vec3 col = mix(vec3(0.62, 0.42, 0.12), vec3(1.0, 0.92, 0.6), vH) * lit + vec3(1.0, 0.95, 0.75) * smoothstep(0.75, 1.0, vH) * 0.6;
    gl_FragColor = vec4(col, alpha);
  }`;
class q8 {
  constructor(e,t,n,s) {
    x(this,"disc");
    x(this,"discMat");
    x(this,"spikes");
    x(this,"spikeMat");
    x(this,"base",[]);
    x(this,"m",new ya);
    x(this,"s",new F);
    this.g=e;
    const o=e.world3d;
    this.discMat=new Ze( {
      vertexShader:I8,fragmentShader:B8,uniforms: {
        time: {
          value:0
        },alpha: {
          value:0
        },seed: {
          value:Math.random()*30
        },grow: {
          value:0
        }
      },transparent:!0,depthWrite:!1,side:rt
    }),this.disc=new Ie(Hd(e,t,n,s),this.discMat),this.disc.renderOrder=5,this.disc.frustumCulled=!1,o.scene.add(this.disc);
    const r=Math.round(Math.min(600,Math.max(90,160*(s/t1)**2))),i=new fp(2.6,1,5,1);
    i.translate(0,.5,0),this.spikeMat=new Ze( {
      vertexShader:N8,fragmentShader:U8,uniforms: {
        alpha: {
          value:1
        }
      },transparent:!0
    }),this.spikes=new Av(i,this.spikeMat,r);
    const l=new F(0,1,0);
    for(let d=0;d<r;d++) {
      const c=Math.random()*Math.PI*2,u=Math.sqrt(Math.random())*s*.92,h=t+Math.cos(c)*u,m=n+Math.sin(c)*u,p=new F(Math.cos(c)*.35+(Math.random()-.5)*.3,1,Math.sin(c)*.35+(Math.random()-.5)*.3).normalize();
      this.base.push( {
        pos:new F(h,o.heightAt(h,m),m),q:new si().setFromUnitVectors(l,p),h:6+Math.random()*9,delay:u/s*.25+Math.random()*.08
      })
    }
    this.spikes.frustumCulled=!1,this.spikes.renderOrder=6,o.scene.add(this.spikes),this.update(0,0,1)
  }
  update(e,t,n) {
    this.discMat.uniforms.time.value=e,this.discMat.uniforms.alpha.value=t,this.discMat.uniforms.grow.value=Math.min(1.25,e/.3*1.25),this.base.forEach((s,o)=> {
      const r=Math.max(0,Math.min(1,(e-s.delay)/.18)),i=r<1?r*(1+.25*Math.sin(r*Math.PI)):1;this.s.set(1,Math.max(.001,s.h*i*n),1),this.m.compose(s.pos,s.q,this.s),this.spikes.setMatrixAt(o,this.m)
    }),this.spikes.instanceMatrix.needsUpdate=!0
  }
  dispose() {
    this.g.world3d.scene.remove(this.disc,this.spikes),this.disc.geometry.dispose(),this.discMat.dispose(),this.spikes.geometry.dispose(),this.spikeMat.dispose()
  }
}
class H8 {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"inst");
    x(this,"mat");
    x(this,"fade");
    x(this,"phase",[]);
    x(this,"tips",[]);
    x(this,"ps");
    x(this,"light");
    x(this,"gilded");
    x(this,"t",0);
    this.g=e,this.secs=o;
    const r=e.world3d;
    this.gilded=new q8(e,t,n,s);
    const i=Math.round(Math.min(180,Math.max(26,45*(s/t1)**2)));
    this.mat=new Ze( {
      vertexShader:cE,fragmentShader:uE,transparent:!0,depthWrite:!1,blending:Rt,side:rt
    });
    const l=ai().clone();
    this.fade=new io(new Float32Array(i),1),l.setAttribute("aFade",this.fade),this.inst=new Av(l,this.mat,i);
    const d=new ya,c=new si;
    for(let u=0;u<i;u++) {
      const h=Math.random()*Math.PI*2,m=Math.sqrt(Math.random())*s*.95,p=t+Math.cos(h)*m,g=n+Math.sin(h)*m,y=new F(p,r.heightAt(p,g)+2,g),f=.9+Math.random()*.45,v=new F(Math.cos(h+(Math.random()-.5))*Math.cos(f),-Math.sin(f),Math.sin(h+(Math.random()-.5))*Math.cos(f)).normalize();
      c.setFromUnitVectors(new F(1,0,0),v),d.compose(y,c,new F(30+Math.random()*12,7,7)),this.inst.setMatrixAt(u,d),this.phase.push(Math.random()*Math.PI*2),this.tips.push(y.clone().addScaledVector(v,-24))
    }
    this.inst.instanceMatrix.needsUpdate=!0,this.inst.frustumCulled=!1,this.inst.renderOrder=7,r.scene.add(this.inst),this.ps=new Ot(e,120),e.addFx(this.ps),this.light=e.groundSprite(zd(),!0),this.light.tint=16767120,this.light.x=t,this.light.y=n,this.light.size=s*2.2,this.light.alpha=0
  }
  update(e) {
    this.t+=e/1e3;
    const t=this.t,n=Math.min(1,t/.15,Math.max(0,(this.secs-t)/.6));
    for(let s=0;s<this.phase.length;s++)this.fade.setX(s,n*(.55+.45*Math.sin(t*6+this.phase[s])));
    if(this.fade.needsUpdate=!0,this.light.alpha=.22*n,this.gilded.update(t,n,Math.max(0,Math.min(1,(this.secs-t)/.45))),n>.3&&Math.random()<.5) {
      const s=this.tips[Math.floor(Math.random()*this.tips.length)];
      this.ps.emit( {
        x:s.x,y:s.y,z:s.z,vy:40+Math.random()*50,life:400+Math.random()*300,s0:5,s1:1,c0:[1,.95,.7],c1:[1,.55,.15],a0:.8,twinkle:.02
      })
    }
    return t<this.secs?!1:(this.g.world3d.scene.remove(this.inst),this.inst.geometry.dispose(),this.mat.dispose(),this.light.dispose(),this.gilded.dispose(),this.ps.stop(),!0)
  }
}
class O8 {
  constructor(e,t,n) {
    x(this,"view",new ue);
    x(this,"ring");
    x(this,"mat");
    x(this,"ps");
    x(this,"t",0);
    this.g=e,this.who=t,this.secs=n;
    const s=new cs(1,1);
    s.rotateX(-Math.PI/2),this.mat=new Ze( {
      vertexShader:Xs,fragmentShader:Dp,uniforms: {
        alpha: {
          value:0
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.ring=new Ie(s,this.mat),this.ring.renderOrder=6,this.ring.frustumCulled=!1,e.world3d.scene.add(this.ring),this.ps=new Ot(e,140),e.addFx(this.ps);
    const o=e.world3d.heightAt(t.x,t.y);
    this.ps.emit( {
      x:t.x,y:o+40,z:t.y,life:260,s0:90,s1:30,c0:[1,1,.9],c1:[1,.8,.4],a0:.9
    });
    for(let r=0;r<20;r++) {
      const i=r/20*Math.PI*2;
      this.ps.emit( {
        x:t.x,y:o+10,z:t.y,vx:Math.cos(i)*200,vy:60,vz:Math.sin(i)*200,life:350,s0:6,s1:1,c0:[1,.95,.7],c1:[1,.6,.2],drag:4
      })
    }
  }
  update(e) {
    this.t+=e/1e3;
    const t=this.t, {
      x:n,y:s
    }
    =this.who,o=this.g.world3d,r=o.heightAt(n,s),i=Math.min(1,t/.2,Math.max(0,(this.secs-t)/.5));
    if(this.ring.position.set(n,r+3,s),this.ring.rotation.y+=e*8e-4,this.ring.scale.setScalar(78*(1+.5*Math.max(0,1-t/.3))*(1+.04*Math.sin(t*5))),this.mat.uniforms.alpha.value=.75*i,i>.2&&Math.random()<.45) {
      const l=Math.random()*Math.PI*2;
      this.ps.emit( {
        x:n+Math.cos(l)*26,y:r+6,z:s+Math.sin(l)*26,vx:-Math.sin(l)*30,vy:70+Math.random()*50,vz:Math.cos(l)*30,life:500,s0:5,s1:1,c0:[1,.95,.75],c1:[1,.65,.2],a0:.85,twinkle:.02
      })
    }
    return t<this.secs?!1:(o.scene.remove(this.ring),this.ring.geometry.dispose(),this.mat.dispose(),this.ps.stop(),!0)
  }
}
function j8(a,e,t,n) {
  const s=a.world3d,o=s.heightAt(e.x,e.y),r=s.heightAt(t.x,t.y),i=Math.hypot(t.x-e.x,t.y-e.y)||1,l=-(t.y-e.y)/i,d=(t.x-e.x)/i;
  for(const[m,p]of[[-12,14],[0,30],[12,20]]) {
    const g=new F(e.x+l*m,o+p,e.y+d*m),y=new F(t.x+l*m,r+p,t.y+d*m);
    a.addFx(new e1(a,g,y,n,i*.9,10,!1))
  }
  const c=new Ot(a,70,!1),u=(m,p,g)=> {
    for(let y=0;y<9;y++) {
      const f=Math.random()*Math.PI*2,v=50+Math.random()*90;
      c.emit( {
        x:m,y:g+4,z:p,vx:Math.cos(f)*v,vy:20+Math.random()*40,vz:Math.sin(f)*v,life:450+Math.random()*250,s0:12,s1:30,c0:[.86,.8,.68],c1:[.74,.68,.58],a0:.35,drag:2.5
      })
    }
  };
  u(e.x,e.y,o),a.schedule(n/1e3,()=>u(t.x,t.y,r)),c.stop(),a.addFx(c);
  const h=new Ot(a,40);
  for(let m=0;m<16;m++) {
    const p=Math.random(),g=e.x+(t.x-e.x)*p,y=e.y+(t.y-e.y)*p;
    h.emit( {
      x:g,y:s.heightAt(g,y)+10+Math.random()*25,z:y,vy:30+Math.random()*40,life:300+Math.random()*200,s0:5,s1:1,c0:[1,.95,.7],c1:[1,.6,.2],a0:.8
    })
  }
  h.stop(),a.addFx(h)
}
class G8 {
  constructor(e,t,n) {
    x(this,"view",new ue);
    x(this,"ps");
    x(this,"t",0);
    x(this,"shown");
    this.g=e,this.who=t,this.charges=n,this.ps=new Ot(e,260),e.addFx(this.ps),this.shown=Math.round(n())
  }
  update(e) {
    this.t+=e/1e3;
    const t=Math.round(this.charges()), {
      x:n,y:s
    }
    =this.who,o=this.g.world3d.heightAt(n,s)+30,r=(i,l)=> {
      const d=this.t*3+i/l*Math.PI*2;
      return {
        ox:n+Math.cos(d)*30,oy:o+Math.sin(this.t*4+i)*6,oz:s+Math.sin(d)*22
      }
    };
    if(t<this.shown) {
      const i=r(this.shown-1,Math.max(1,this.shown));
      for(let l=0;l<10;l++) {
        const d=Math.random()*Math.PI*2;
        this.ps.emit( {
          x:i.ox,y:i.oy,z:i.oz,vx:Math.cos(d)*120,vy:40+Math.random()*80,vz:Math.sin(d)*120,life:260,s0:6,s1:1,c0:[1,1,.9],c1:[.6,.85,1],drag:3
        })
      }
      this.shown=t
    }
    for(let i=0;i<t;i++) {
      const l=r(i,t);
      this.ps.emit( {
        x:l.ox,y:l.oy,z:l.oz,life:60,s0:16,s1:12,c0:[1,1,.95],c1:[.75,.92,1],a0:.9
      }),this.ps.emit( {
        x:l.ox,y:l.oy,z:l.oz,life:220,s0:8,s1:1,c0:[.85,.95,1],c1:[1,.8,.4],a0:.5
      })
    }
    return t>0?!1:(this.ps.stop(),!0)
  }
}
function V8(a,e,t,n) {
  const s=a.player;
  a.addFx(new Zv(a, {
    x:s.x,y:s.y
  }, {
    x:e,y:t
  },Math.random()<.5?1:-1,n,13, {
    tint:[.68,.4,1],spark:[[.85,.7,1],[.5,.25,1]],bend:.25
  }))
}
const vE=150;
let Xx=-1e9;
function W8(a,e,t,n,s,o=n) {
  const r=a.player,i=performance.now(),l=i-Xx>150;
  l&&(Xx=i),a.addFx(new Zv(a, {
    x:r.x,y:r.y
  }, {
    x:e,y:t
  },0,s,14, {
    tint:[.92,.38,.07],spark:[[1,.75,.3],[.8,.18,.02]],lift:vE,muzzle:l
  })),a.addFx(new $8(a, {
    x:r.x,y:r.y
  }, {
    x:e,y:t
  },s)),a.schedule(s/1e3,()=>Y8(a,e,t,n,o))
}
class $8 {
  constructor(e,t,n,s) {
    x(this,"view",new ue);
    x(this,"fire");
    x(this,"smoke");
    x(this,"t",0);
    x(this,"p0");
    x(this,"p1");
    x(this,"p2");
    x(this,"last");
    this.ms=s;
    const o=e.world3d,r=n.x-t.x,i=n.y-t.y,l=Math.hypot(r,i)||1;
    this.p0=new F(t.x+r/l*12,o.heightAt(t.x,t.y)+dE,t.y+i/l*12),this.p2=new F(n.x,o.heightAt(n.x,n.y)+26,n.y),this.p1=new F(t.x+r*.45,(this.p0.y+this.p2.y)/2+vE+6,t.y+i*.45),this.last=this.p0.clone(),this.fire=new Ot(e,220),this.smoke=new Ot(e,80,!1),e.addFx(this.fire),e.addFx(this.smoke)
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms),n=t*(.85+.15*t),s=1-n,o=new F(s*s*this.p0.x+2*s*n*this.p1.x+n*n*this.p2.x,s*s*this.p0.y+2*s*n*this.p1.y+n*n*this.p2.y,s*s*this.p0.z+2*s*n*this.p1.z+n*n*this.p2.z),r=Math.max(1,Math.ceil(o.distanceTo(this.last)/9));
    for(let i=1;i<=r;i++) {
      const l=this.last.clone().lerp(o,i/r),d=()=>(Math.random()-.5)*8;
      this.fire.emit( {
        x:l.x+d(),y:l.y+d(),z:l.z+d(),vy:30+Math.random()*30,life:220+Math.random()*120,s0:20,s1:5,c0:[1,.7,.28],c1:[.85,.16,.02],a0:.6,drag:2
      }),Math.random()<.35&&this.fire.emit( {
        x:l.x,y:l.y,z:l.z,vx:(Math.random()-.5)*90,vy:20+Math.random()*60,vz:(Math.random()-.5)*90,life:500,s0:6,s1:1,c0:[1,.9,.5],c1:[1,.35,.05],a0:1,grav:160,twinkle:.03
      }),Math.random()<.25&&this.smoke.emit( {
        x:l.x,y:l.y+6,z:l.z,vy:40,life:600,s0:14,s1:34,c0:[.32,.26,.22],c1:[.2,.18,.17],a0:.3,drag:1.5
      })
    }
    return this.fire.emit( {
      x:o.x,y:o.y,z:o.z,life:50,s0:30+Math.sin(this.t*.05)*4,s1:24,c0:[1,.88,.6],c1:[1,.6,.25],a0:.85
    }),this.last=o,t<1?!1:(this.fire.stop(),this.smoke.stop(),!0)
  }
}
const hc=[];
function Y8(a,e,t,n,s) {
  const o=performance.now();
  for(;hc.length&&o-hc[0]>1100;)hc.shift();
  const r=hc.length;
  if(hc.push(o),a.addFx(new Gy(a,e,t,n,s)),r>6&&Math.random()>4/r)return;
  const i=r>2,l=a.world3d.heightAt(e,t),d=new Ot(a,40);
  d.emit( {
    x:e,y:l+18,z:t,life:140,s0:44,s1:80,c0:[1,.85,.5],c1:[1,.4,.08],a0:i?.5:.8
  });
  for(let u=0,h=i?8:18;u<h;u++) {
    const m=Math.random()*Math.PI*2,p=30+Math.random()*n*.9;
    d.emit( {
      x:e,y:l+10,z:t,vx:Math.cos(m)*p,vy:120+Math.random()*180,vz:Math.sin(m)*p,life:500+Math.random()*300,s0:5,s1:1,c0:[1,.8,.4],c1:[.9,.25,.04],a0:.9,grav:300,twinkle:.03
    })
  }
  if(d.stop(),a.addFx(d),i)return;
  const c=new Ot(a,12,!1);
  for(let u=0;u<6;u++) {
    const h=Math.random()*Math.PI*2,m=Math.random()*n*.5;
    c.emit( {
      x:e+Math.cos(h)*m,y:l+16,z:t+Math.sin(h)*m,vy:40+Math.random()*30,life:800+Math.random()*300,s0:22,s1:56,c0:[.28,.22,.19],c1:[.17,.15,.14],a0:.3,drag:1.2
    })
  }
  c.stop(),a.addFx(c)
}
const Kx=`
  uniform float prog;   // 0..1: el aro de fuego va del centro al borde
  uniform float alpha;
  uniform float inner;  // radio del impacto respecto al de la salpicadura
  uniform float seed;
  uniform float glow;   // 1 = capa que suma luz encima de la quemadura
  varying vec2 vUv;
  ${Ks}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float edge = 1.0 - smoothstep(0.9, 1.0, r);
    float n = fbm(p * 3.2 + vec2(seed));
    // suelo chamuscado: oscuro y moteado, más fuerte dentro del impacto, por donde ya pasó el aro
    float burnt = smoothstep(prog + 0.05, prog - 0.1, r) * (0.55 + 0.45 * smoothstep(inner + 0.15, inner - 0.1, r));
    float soot = burnt * (0.18 + 0.22 * n);
    // grietas de brasa dentro del impacto, que se apagan
    float crack = smoothstep(0.035, 0.0, abs(fbm(p * 5.0 + vec2(seed * 1.7)) - 0.5)) * smoothstep(inner + 0.05, inner - 0.2, r);
    float ember = crack * (1.0 - prog * 0.5);
    // aro fino que se abre, roto por el ruido para que no sea un círculo perfecto
    float d = r - prog;
    float ring = exp(-d * d * 900.0) * (0.55 + 0.45 * n) * (1.0 - prog * 0.6);
    if (glow > 0.5) {
      // brillo: calor dentro del impacto, halo ancho alrededor del aro y las brasas encendidas
      float heat = smoothstep(inner + 0.1, 0.0, r) * (1.0 - prog * 0.55) * (0.6 + 0.4 * n) * 0.45;
      float halo = exp(-d * d * 90.0) * (1.0 - prog * 0.5) * 0.5;
      float g = (ring * 1.4 + halo + ember * 1.3 + heat) * edge * alpha;
      gl_FragColor = vec4(mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.82, 0.45), clamp(ring + ember * 0.6, 0.0, 1.0)), g);
      return;
    }
    vec3 col = mix(vec3(0.16, 0.07, 0.03), vec3(1.0, 0.58, 0.18), clamp(ring * 1.5 + ember, 0.0, 1.0));
    float a = max(soot, max(ring, ember * 0.9)) * edge * alpha;
    gl_FragColor = vec4(col, a);
  }`,rr=class rr {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"glowMesh");
    x(this,"glowMat");
    x(this,"t",0);
    this.g=e;
    const r=Math.max(s,o);
    this.mat=new Ze( {
      vertexShader:Xs,fragmentShader:Kx,uniforms: {
        prog: {
          value:0
        },alpha: {
          value:1
        },inner: {
          value:s/r
        },seed: {
          value:Math.random()*50
        },glow: {
          value:0
        }
      },transparent:!0,depthWrite:!1,side:rt
    }),this.mesh=new Ie(Hd(e,t,n,r),this.mat),this.mesh.renderOrder=4,this.mesh.frustumCulled=!1,e.world3d.scene.add(this.mesh),this.glowMat=new Ze( {
      vertexShader:Xs,fragmentShader:Kx,uniforms: {
        ...this.mat.uniforms,glow: {
          value:1
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.glowMesh=new Ie(this.mesh.geometry,this.glowMat),this.glowMesh.renderOrder=5,this.glowMesh.frustumCulled=!1,e.world3d.scene.add(this.glowMesh)
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/rr.OPEN);
    this.mat.uniforms.prog.value=1-(1-t)*(1-t);
    const n=Math.max(0,this.t-rr.OPEN)/(rr.LIFE-rr.OPEN);
    return this.mat.uniforms.alpha.value=1-n*n,this.t<rr.LIFE?!1:(this.g.world3d.scene.remove(this.mesh,this.glowMesh),this.mesh.geometry.dispose(),this.mat.dispose(),this.glowMat.dispose(),!0)
  }
};
x(rr,"OPEN",260),x(rr,"LIFE",1100);
let Gy=rr;
const X8=`
  uniform float prog;  // 0 = el aro está en el borde, 1 = ha llegado al centro
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float at = 1.0 - prog;
    // aro que se cierra, con estela hacia fuera (por donde ya ha pasado)
    float ring = exp(-pow((r - at) * 18.0, 2.0));
    float wake = smoothstep(at, at + 0.35, r) * (1.0 - smoothstep(at + 0.35, at + 0.6, r)) * 0.35;
    float runes = step(0.55, fract(a * 10.0 / 6.2831 + time * 2.0)) * exp(-pow((r - at - 0.08) * 26.0, 2.0)) * 0.8;
    float edge = 1.0 - smoothstep(0.92, 1.0, r);
    float al = (ring * 1.2 + wake + runes) * edge * alpha;
    vec3 col = mix(vec3(0.55, 0.28, 1.0), vec3(0.97, 0.9, 1.0), clamp(ring, 0.0, 1.0));
    gl_FragColor = vec4(col, al);
  }`;
class K8 {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"ps");
    x(this,"t",0);
    x(this,"snapped",!1);
    x(this,"cy");
    this.g=e,this.x=t,this.y=n,this.ms=o;
    const r=e.world3d;
    this.cy=r.heightAt(t,n),this.mat=new Ze( {
      vertexShader:Xs,fragmentShader:X8,uniforms: {
        prog: {
          value:0
        },time: {
          value:0
        },alpha: {
          value:1
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.mesh=new Ie(Hd(e,t,n,s),this.mat),this.mesh.renderOrder=7,this.mesh.frustumCulled=!1,r.scene.add(this.mesh),this.ps=new Ot(e,160),e.addFx(this.ps),this.ps.emit( {
      x:t,y:this.cy+28,z:n,life:160,s0:70,s1:20,c0:[1,.95,1],c1:[.6,.35,1],a0:.95
    });
    for(let i=0;i<40;i++) {
      const l=Math.random()*Math.PI*2,d=s*(.85+Math.random()*.2),c=o*(.8+Math.random()*.3),u=d/c*1e3;
      this.ps.emit( {
        x:t+Math.cos(l)*d,y:this.cy+8+Math.random()*30,z:n+Math.sin(l)*d,vx:-Math.cos(l)*u,vy:0,vz:-Math.sin(l)*u,life:c,s0:4,s1:8,c0:[.7,.5,1],c1:[1,.95,1],a0:.85
      })
    }
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms);
    if(this.mat.uniforms.prog.value=t*t,this.mat.uniforms.time.value=this.t/1e3,t>=1&&!this.snapped) {
      this.snapped=!0,this.ps.emit( {
        x:this.x,y:this.cy+26,z:this.y,life:200,s0:20,s1:90,c0:[1,.95,1],c1:[.5,.25,1],a0:.9
      });
      for(let s=0;s<18;s++) {
        const o=Math.random()*Math.PI*2,r=120+Math.random()*160;
        this.ps.emit( {
          x:this.x,y:this.cy+22,z:this.y,vx:Math.cos(o)*r,vy:40+Math.random()*120,vz:Math.sin(o)*r,life:260+Math.random()*200,s0:5,s1:1,c0:[.95,.85,1],c1:[.5,.25,1],drag:3
        })
      }
      this.ps.stop()
    }
    const n=Math.max(0,this.t-this.ms)/150;
    return this.mat.uniforms.alpha.value=1-Math.min(1,n),n<1?!1:(this.g.world3d.scene.remove(this.mesh),this.mesh.geometry.dispose(),this.mat.dispose(),!0)
  }
}
class J8 {
  constructor(e,t=1) {
    x(this,"mesh");
    x(this,"mat");
    x(this,"ps");
    x(this,"started",!1);
    x(this,"last",null);
    x(this,"dir",new F);
    this.g=e,this.size=t,this.mat=new Ze( {
      vertexShader:Xs,fragmentShader:gE,uniforms: {
        alpha: {
          value:0
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.mesh=new Ie(ai(),this.mat),this.mesh.scale.set(46*t,9*t,9*t),this.mesh.renderOrder=8,this.mesh.frustumCulled=!1,e.world3d.scene.add(this.mesh),this.ps=new Ot(e,80),e.addFx(this.ps)
  }
  update(e,t,n,s,o) {
    const r=new F(e,this.g.world3d.heightAt(e,t)+32,t);
    if(this.dir.set(Math.cos(n),0,Math.sin(n)),this.mesh.position.copy(r).addScaledVector(this.dir,20*this.size),this.mesh.quaternion.setFromUnitVectors(new F(1,0,0),this.dir),this.mat.uniforms.alpha.value=o,this.started||(this.started=!0,this.g.addFx(new Fp(this.g,r.clone(),this.dir.clone(),.9))),this.last&&o>.3)for(let i=0;i<2;i++) {
      const l=this.last.clone().lerp(r,Math.random());
      this.ps.emit( {
        x:l.x,y:l.y+(Math.random()-.5)*4,z:l.z,life:140+Math.random()*80,s0:6,s1:1,c0:[1,.92,.65],c1:[1,.55,.15],a0:.6
      })
    }
    this.last=r
  }
  dispose() {
    this.g.world3d.scene.remove(this.mesh),this.mat.dispose(),this.ps.stop()
  }
}
const Q8=a=>[(a>>16&255)/255,(a>>8&255)/255,(a&255)/255],a1=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,Jx=new WeakMap;
function ll(a) {
  let e=Jx.get(a);
  return e||(e=new Ot(a,2400),Jx.set(a,e),a.addFx(e)),e
}
function Ip(a,e,t,n) {
  const s=new Ie(e,t);
  return s.renderOrder=n,s.frustumCulled=!1,a.world3d.scene.add(s),s
}
function ru(a,e,t=!1) {
  a.world3d.scene.remove(e),t||e.geometry.dispose(),e.material.dispose()
}
let w0=null;
function Z8() {
  if(w0)return w0;
  const a=new Fo(1,1.15,1,28,1,!0);
  return a.translate(0,.5,0),w0=oi(a),a
}
const ej=`
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`,tj=`
  uniform float alpha;
  uniform float time;
  uniform vec3 col;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    // el centro (lo que mira a la cámara) brilla blanco; los bordes, del color
    float f = abs(dot(normalize(vN), normalize(vV)));
    float core = pow(f, 2.2);
    float h = vUv.y;
    float fade = (1.0 - smoothstep(0.45, 1.0, h)) * smoothstep(0.0, 0.04, h);
    float stripes = 0.72 + 0.28 * sin(h * 38.0 - time * 14.0 + vUv.x * 6.2831 * 3.0);
    vec3 c = mix(col, vec3(1.0), core);
    gl_FragColor = vec4(c, (0.2 + core) * fade * stripes * alpha);
  }`;
class aj {
  constructor(e,t,n,s) {
    x(this,"view",new ue);
    x(this,"inner");
    x(this,"outer");
    x(this,"t",0);
    x(this,"ms");
    x(this,"h");
    this.g=e,this.x=t,this.y=n,this.look=s,this.ms=s.ms??520;
    const o=this.h=s.h??260,r=e.world3d.heightAt(t,n),i=new St(s.color??16767351),l=(h,m)=> {
      const p=new Ze( {
        vertexShader:ej,fragmentShader:tj,uniforms: {
          alpha: {
            value:m
          },time: {
            value:0
          },col: {
            value:i
          }
        },transparent:!0,depthWrite:!1,blending:Rt,side:rt
      }),g=Ip(e,Z8(),p,8);
      return g.position.set(t,r,n),g.userData.r=h,g
    };
    this.inner=l(s.r*.45,1),this.outer=l(s.r,.55);
    const d=xd(),c=Math.round((s.sparks??24)*d),u=Math.round(16*d);
    if((s.sparks??24)>0) {
      const[h,m,p]=Q8(s.color??16767351),g=new Ot(e,c+u+1);
      g.emit( {
        x:t,y:r+14,z:n,life:220,s0:s.r*3,s1:s.r*4.5,c0:[1,1,.95],c1:[h,m,p],a0:.9
      });
      for(let y=0;y<c;y++) {
        const f=Math.random()*Math.PI*2,v=s.r*(2.5+Math.random()*4);
        g.emit( {
          x:t,y:r+8,z:n,vx:Math.cos(f)*v,vy:60+Math.random()*220,vz:Math.sin(f)*v,life:450+Math.random()*400,s0:6,s1:1,c0:[1,.98,.85],c1:[h,m,p],a0:1,grav:-40,drag:2.5,twinkle:.03
        })
      }
      for(let y=0;y<u;y++) {
        const f=Math.random()*Math.PI*2,v=Math.random()*s.r*.8;
        g.emit( {
          x:t+Math.cos(f)*v,y:r+o*(.3+Math.random()*.6),z:n+Math.sin(f)*v,vy:-320-Math.random()*200,life:400,s0:5,s1:2,c0:[1,1,.95],c1:[h,m,p],a0:.9
        })
      }
      g.stop(),e.addFx(g)
    }
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms),n=Math.min(1,t/.12),s=this.look.hold?.8:.55,o=n*(t<s?1+.08*Math.sin(this.t*(this.look.hold?.008:.04)):1-(t-s)/(1-s)),r=Math.min(1,t/.1),i=this.g.world3d.heightAt(this.x,this.y);
    for(let l=0;l<2;l++) {
      const d=l?this.outer:this.inner,c=d.userData.r;
      d.scale.set(c*Math.max(.001,o),this.h*r,c*Math.max(.001,o)),d.position.y=i+(1-r)*this.h,d.material.uniforms.time.value=this.t/1e3
    }
    return t<1?!1:(ru(this.g,this.inner,!0),ru(this.g,this.outer,!0),!0)
  }
}
function ys(a,e,t,n) {
  return new aj(a,e,t,n)
}
const nj=`
  uniform float prog;
  uniform float alpha;
  uniform vec3 col;
  uniform vec3 col2;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ring = exp(-pow((r - prog) * 13.0, 2.0));
    float fill = (1.0 - smoothstep(0.0, max(0.01, prog), r)) * 0.3 * (1.0 - prog);
    float edge = 1.0 - smoothstep(0.96, 1.0, r);
    vec3 c = mix(col2, col, clamp(ring, 0.0, 1.0));
    gl_FragColor = vec4(c, (ring * 1.3 + fill) * edge * alpha);
  }`;
class sj {
  constructor(e,t,n,s,o,r,i) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"t",0);
    this.g=e,this.ms=i,this.mat=new Ze( {
      vertexShader:a1,fragmentShader:nj,uniforms: {
        prog: {
          value:0
        },alpha: {
          value:1
        },col: {
          value:new St(o)
        },col2: {
          value:new St(r)
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.mesh=Ip(e,Hd(e,t,n,s),this.mat,6)
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms);
    return this.mat.uniforms.prog.value=1-(1-t)*(1-t),this.mat.uniforms.alpha.value=t<.7?1:1-(t-.7)/.3,t<1?!1:(ru(this.g,this.mesh),!0)
  }
}
function Ds(a,e,t,n,s=16773816,o=16765802,r=420) {
  return new sj(a,e,t,n,s,o,r)
}
function Qx(a,e,t,n) {
  a.addFx(Ds(a,e,t,n,15925232,10354608,460)),a.addFx(ys(a,e,t, {
    r:26,h:170,color:11075516,ms:520,sparks:0
  }));
  const s=a.world3d.heightAt(e,t),o=new Ot(a,80);
  for(let r=0;r<60;r++) {
    const i=Math.random()*Math.PI*2,l=Math.random()*45;
    o.emit( {
      x:e+Math.cos(i)*l,y:s+6,z:t+Math.sin(i)*l,vx:Math.cos(i)*20,vy:90+Math.random()*120,vz:Math.sin(i)*20,life:700+Math.random()*300,s0:7,s1:2,c0:[.9,1,.92],c1:[.6,1,.7],a0:.9,twinkle:.025
    })
  }
  o.stop(),a.addFx(o)
}
function oj(a,e,t,n) {
  a.addFx(ys(a,e,t, {
    r:34,h:300,color:16764762,ms:560,sparks:30
  })),a.addFx(Ds(a,e,t,n,16774856,16758842,520))
}
const rj=`
  uniform float alpha;
  uniform float grow;
  uniform float time;
  varying vec2 vUv;
  const float TAU = 6.2831853;
  // aro de ancho w centrado en c
  float band(float r, float c, float w) { return 1.0 - smoothstep(w * 0.55, w, abs(r - c)); }
  // n tramos por vuelta girados rot (vueltas), con un hueco de gap (fracción de cada tramo) entre ellos
  float arcs(float a, float n, float rot, float gap) {
    float f = fract(a / TAU * n + rot * n);
    return smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(1.0 - gap - 0.03, 1.0 - gap, f));
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float t = time;
    // aro exterior doble y fino
    float rim = band(r, 0.975, 0.007) + band(r, 0.945, 0.005) * 0.6;
    // aro de tres tramos, en el sentido del reloj
    float outer = band(r, 0.885, 0.01) * arcs(a, 3.0, t * 0.08, 0.1);
    // marcas finas entre los aros, al revés
    float ticks = band(r, 0.83, 0.014) * arcs(a, 48.0, -t * 0.05, 0.8);
    // aro de cuatro tramos, al revés
    float inner = band(r, 0.66, 0.007) * arcs(a, 4.0, -t * 0.12, 0.16);
    // cruz patada de brazos iguales (simétrica en los dos ejes): los brazos se abren hacia las puntas y acaban en
    // el aro de tres tramos. Se pliega el plano para dibujar un solo brazo: a lo largo y de través
    vec2 q = abs(p);
    vec2 arm = q.x > q.y ? q : q.yx;
    float half_ = 0.035 + 0.2 * pow(arm.x / 0.86, 2.0);
    float f = max(arm.y - half_, r - 0.86);
    float crossLine = 1.0 - smoothstep(0.003, 0.008, abs(f));
    float crossFill = (1.0 - smoothstep(-0.01, 0.0, f)) * (0.34 + 0.16 * smoothstep(0.1, 0.86, r));
    // eje de luz por el centro de cada brazo
    float spine = (1.0 - smoothstep(0.002, 0.005, arm.y)) * (1.0 - smoothstep(0.8, 0.86, r)) * 0.55;
    // centro: aro pequeño y punto que brilla
    float core = band(r, 0.13, 0.005) + exp(-r * r * 160.0) * 0.8;
    float glow = (1.0 - smoothstep(0.0, 1.0, r)) * 0.08;
    float lines = rim + outer + ticks * 0.7 + inner + crossLine + crossFill + spine + core;
    // se abre desde el centro: el borde que avanza va más brillante
    float show = 1.0 - smoothstep(grow - 0.04, grow, r);
    float edge = exp(-pow((r - grow) * 30.0, 2.0)) * step(grow, 1.02) * 0.8;
    float hot = clamp(rim + crossLine + spine + core + edge, 0.0, 1.0);
    vec3 c = mix(vec3(1.0, 0.76, 0.3), vec3(1.0, 0.98, 0.88), hot);
    gl_FragColor = vec4(c, ((lines + glow) * show + edge) * alpha);
  }`,M0=380;
class ij {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"ps");
    x(this,"t",0);
    x(this,"h");
    this.g=e,this.x=t,this.y=n,this.r=s,this.ms=o,this.mat=new Ze( {
      vertexShader:a1,fragmentShader:rj,uniforms: {
        alpha: {
          value:1
        },grow: {
          value:0
        },time: {
          value:0
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.mesh=Ip(e,Hd(e,t,n,s),this.mat,6),this.h=e.world3d.heightAt(t,n),this.ps=new Ot(e,160),e.addFx(this.ps)
  }
  spark(e,t=[.66,.885,.975][Math.floor(Math.random()*3)]) {
    const n=Math.random()*Math.PI*2;
    this.ps.emit( {
      x:this.x+Math.cos(n)*this.r*t,y:this.h+4,z:this.y+Math.sin(n)*this.r*t,vy:70+Math.random()*120,life:600+Math.random()*400,s0:6,s1:1,c0:[1,.97,.8],c1:[1,.7,.2],a0:.95*e,twinkle:.03,drag:1
    })
  }
  update(e) {
    const t=this.t;
    this.t+=e;
    const n=this.t,s=Math.min(1,n/M0),o=1-(1-s)**3;
    if(this.mat.uniforms.grow.value=s>=1?1.1:o,this.mat.uniforms.time.value=n/1e3,t<M0)for(let l=0;l<6;l++)this.spark(1,o);
    const r=n<M0+200?1:.78+.12*Math.sin(n*.006),i=Math.min(1,Math.max(0,(this.ms-n)/400));
    return this.mat.uniforms.alpha.value=r*i,i>.3&&Math.random()<.35&&this.spark(.7),n<this.ms?!1:(this.ps.stop(),ru(this.g,this.mesh),!0)
  }
}
function lj(a,e,t,n,s=900) {
  return new ij(a,e,t,n,s)
}
function dj(a,e,t) {
  const n=ll(a),s=a.world3d.heightAt(e,t);
  n.emit( {
    x:e,y:s+30,z:t,life:150,s0:26,s1:34,c0:[1,.95,.75],c1:[1,.7,.2],a0:.6
  });
  for(let o=0;o<4;o++)n.emit( {
    x:e+(Math.random()-.5)*20,y:s+6,z:t+(Math.random()-.5)*20,vy:90+Math.random()*80,life:500,s0:5,s1:1,c0:[1,.97,.8],c1:[1,.7,.2],a0:.95,twinkle:.03
  })
}
function cj(a,e,t) {
  const n=ll(a),s=a.world3d.heightAt(e,t);
  n.emit( {
    x:e,y:s+12,z:t,life:160,s0:24,s1:34,c0:[1,1,.92],c1:[1,.75,.3],a0:.6
  });
  for(let o=0;o<5;o++) {
    const r=Math.random()*Math.PI*2;
    n.emit( {
      x:e,y:s+6,z:t,vx:Math.cos(r)*60,vy:120+Math.random()*80,vz:Math.sin(r)*60,life:450,s0:5,s1:2,c0:[1,.97,.85],c1:[1,.7,.25],a0:.9,grav:-500
    })
  }
}
function _E(a,e,t) {
  const n=ll(a),s=a.world3d.heightAt(e,t)+28;
  n.emit( {
    x:e,y:s,z:t,life:34,s0:40,s1:38,c0:[1,1,1],c1:[.9,.95,1],a0:1
  }),n.emit( {
    x:e,y:s,z:t,life:34,s0:100,s1:96,c0:[.6,.8,1],c1:[.5,.7,1],a0:.5
  }),n.emit( {
    x:e,y:s,z:t,life:380,s0:26,s1:3,c0:[.88,.95,1],c1:[.45,.65,1],a0:.6
  }),Math.random()<.3&&n.emit( {
    x:e,y:s,z:t,vx:(Math.random()-.5)*60,vy:30+Math.random()*40,vz:(Math.random()-.5)*60,life:450,s0:4,s1:1,c0:[1,.97,.85],c1:[1,.8,.4],a0:.9,twinkle:.03
  })
}
function uj(a,e,t,n) {
  a.addFx(Ds(a,e,t,n,14216447,6990079,520));
  const s=a.world3d.heightAt(e,t),o=new Ot(a,50);
  for(let r=0;r<40;r++) {
    const i=Math.random()*Math.PI*2,l=Math.sqrt(Math.random())*n;
    o.emit( {
      x:e+Math.cos(i)*l,y:s+60+Math.random()*40,z:t+Math.sin(i)*l,vy:-60,life:700,s0:6,s1:2,c0:[.85,.93,1],c1:[.4,.6,1],a0:.8,grav:-200
    })
  }
  o.stop(),a.addFx(o)
}
function bE(a,e,t,n) {
  a.addFx(Ds(a,e,t,n*1.2,15398655,9422079,340)),a.addFx(ys(a,e,t, {
    r:16,h:130,color:10473727,ms:300,sparks:0
  }));
  const s=a.world3d.heightAt(e,t),o=new Ot(a,40);
  o.emit( {
    x:e,y:s+25,z:t,life:220,s0:n*1.6,s1:n*2.4,c0:[1,1,1],c1:[.55,.75,1],a0:1
  });
  for(let r=0;r<22;r++) {
    const i=Math.random()*Math.PI*2,l=n*(2+Math.random()*3);
    o.emit( {
      x:e,y:s+25,z:t,vx:Math.cos(i)*l,vy:40+Math.random()*120,vz:Math.sin(i)*l,life:350+Math.random()*200,s0:5,s1:1,c0:[.95,.98,1],c1:[.5,.7,1],drag:3,twinkle:.03
    })
  }
  o.stop(),a.addFx(o)
}
const hj=`
  uniform float time;
  uniform float alpha;
  uniform float grow;
  varying vec2 vUv;
  ${Ks}
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    // charco redondo: se extiende al caer y el borde es un círculo limpio
    float bound = 0.94 * grow;
    float inside = 1.0 - smoothstep(bound - 0.025, bound, r);
    float k = clamp(r / max(bound, 0.001), 0.0, 1.0);
    // más claro en el centro y más hondo hacia el borde, con reflejos suaves que se mueven despacio
    vec3 deep = vec3(1.0, 0.8, 0.38);
    vec3 light = vec3(1.0, 0.99, 0.94);
    float caust = fbm(p * 3.0 + vec2(time * 0.12, -time * 0.09));
    vec3 c = mix(light, deep, smoothstep(0.25, 1.0, k) * 0.8) + vec3(0.1, 0.09, 0.05) * (caust - 0.5);
    // brillo del cielo en la superficie, arriba a la izquierda
    float spec = exp(-pow(length(p - vec2(-0.32, 0.3) * bound) / (0.28 * bound + 0.001), 2.0));
    // filo blanco dorado
    float rim = exp(-pow((r - bound + 0.03) * 34.0, 2.0));
    c += vec3(1.0) * spec * 0.3 + vec3(1.0, 0.9, 0.55) * rim * 0.6;
    // agua fina y transparente: casi se ve el suelo en el centro, algo más tupida hacia el borde, y los reflejos
    // la mueven un poco
    float body = mix(0.18, 0.34, smoothstep(0.3, 1.0, k)) + (caust - 0.5) * 0.12;
    gl_FragColor = vec4(c, (body + spec * 0.12 + rim * 0.45) * inside * alpha);
  }`;
class mj {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"ps");
    x(this,"t",0);
    x(this,"h");
    this.g=e,this.x=t,this.y=n,this.r=s,this.ms=o,this.mat=new Ze( {
      vertexShader:a1,fragmentShader:hj,uniforms: {
        time: {
          value:Math.random()*10
        },alpha: {
          value:1
        },grow: {
          value:0
        }
      },transparent:!0,depthWrite:!1,side:rt
    }),this.mesh=Ip(e,Hd(e,t,n,s),this.mat,5),this.h=e.world3d.heightAt(t,n),this.ps=new Ot(e,140),e.addFx(this.ps);
    for(let r=0;r<30;r++) {
      const i=Math.random()*Math.PI*2,l=60+Math.random()*140;
      this.ps.emit( {
        x:t,y:this.h+10,z:n,vx:Math.cos(i)*l,vy:120+Math.random()*160,vz:Math.sin(i)*l,life:500,s0:6,s1:2,c0:[1,1,.95],c1:[1,.78,.3],grav:-500,a0:.9
      })
    }
  }
  update(e) {
    this.t+=e;
    const t=Math.min(1,this.t/this.ms);
    if(this.mat.uniforms.time.value+=e/1e3,this.mat.uniforms.grow.value=Math.min(1,this.t/250),this.mat.uniforms.alpha.value=Math.min(1,(this.ms-this.t)/400),t<1&&Math.random()<.25) {
      const n=Math.random()*Math.PI*2,s=Math.sqrt(Math.random())*this.r*.8,o=Math.random()<.3;
      this.ps.emit( {
        x:this.x+Math.cos(n)*s,y:this.h+4,z:this.y+Math.sin(n)*s,vy:50+Math.random()*60,life:700,s0:5,s1:1,c0:o?[1,.95,.75]:[1,1,.96],c1:o?[1,.7,.25]:[1,.85,.5],a0:.9,twinkle:.03
      })
    }
    return t<1?!1:(this.ps.stop(),ru(this.g,this.mesh),!0)
  }
}
function pj(a,e,t,n,s) {
  return new mj(a,e,t,n,s)
}
function xE(a,e,t) {
  a.addFx(xa(Ud("fx_blessing",e,t, {
    lift:110
  }),a.player)),a.addFx(xa(Vn(e,t,$t("tex_pok2"),10,1753087,1200,128,.2),a.player)),a.addFx(ys(a,e,t, {
    r:44,h:400,color:16769162,ms:800,sparks:0
  })),a.addFx(Ds(a,e,t,110,16774864,16764762,520)),a.addFx(Ds(a,e,t,60,16777215,16769162,320));
  const n=a.world3d.heightAt(e,t),s=new Ot(a,120);
  for(let o=0;o<36;o++) {
    const r=o/36*Math.PI*6,i=34;
    s.emit( {
      x:e+Math.cos(r)*i,y:n+4+o*3,z:t+Math.sin(r)*i,vx:-Math.sin(r)*50,vy:150,vz:Math.cos(r)*50,life:650,s0:9,s1:2,c0:[1,1,.92],c1:[1,.78,.3],a0:1,drag:.5
    })
  }
  s.emit( {
    x:e,y:n+90,z:t,life:400,s0:120,s1:60,c0:[1,1,.92],c1:[1,.8,.4],a0:.6
  });
  for(let o=0;o<40;o++) {
    const r=Math.random()*Math.PI*2,i=20+Math.random()*50;
    s.emit( {
      x:e+Math.cos(r)*i,y:n+120+Math.random()*100,z:t+Math.sin(r)*i,vx:(Math.random()-.5)*30,vy:-60-Math.random()*40,vz:(Math.random()-.5)*30,life:1300+Math.random()*500,s0:9,s1:4,c0:[1,1,.95],c1:[1,.85,.45],a0:.95,twinkle:.02
    })
  }
  s.stop(),a.addFx(s)
}
function fj(a,e,t) {
  a.addFx(ys(a,e,t, {
    r:34,h:260,color:16763210,ms:420,sparks:40
  })),a.addFx(Ds(a,e,t,60,16777215,16765802,200)),a.addFx(Ds(a,e,t,120,16773824,16754730,420)),a.shake(.15,4);
  const n=a.world3d.heightAt(e,t),s=new Ot(a,120);
  s.emit( {
    x:e,y:n+30,z:t,life:140,s0:110,s1:160,c0:[1,1,.95],c1:[1,.75,.3],a0:1
  });
  for(let r=0;r<30;r++) {
    const i=Math.random()*Math.PI*2,l=160+Math.random()*220;
    s.emit( {
      x:e,y:n+10,z:t,vx:Math.cos(i)*l,vy:80+Math.random()*160,vz:Math.sin(i)*l,life:420+Math.random()*200,s0:6,s1:1,c0:[1,.95,.7],c1:[1,.55,.1],a0:1,grav:-700,drag:1.5
    })
  }
  s.stop(),a.addFx(s);
  const o=new Ot(a,20,!1);
  for(let r=0;r<14;r++) {
    const i=r/14*Math.PI*2;
    o.emit( {
      x:e+Math.cos(i)*14,y:n+4,z:t+Math.sin(i)*14,vx:Math.cos(i)*140,vy:20,vz:Math.sin(i)*140,life:600,s0:14,s1:34,c0:[.82,.76,.64],c1:[.7,.64,.55],a0:.4,drag:3
    })
  }
  o.stop(),a.addFx(o)
}
function gj(a,e,t) {
  a.addFx(ys(a,e,t, {
    r:16,h:120,color:16763210,ms:260,sparks:0
  }));
  const n=ll(a),s=a.world3d.heightAt(e,t);
  n.emit( {
    x:e,y:s+30,z:t,life:180,s0:70,s1:100,c0:[1,.97,.8],c1:[1,.7,.2],a0:.9
  });
  for(let o=0;o<16;o++) {
    const r=Math.random()*Math.PI*2,i=120+Math.random()*120;
    n.emit( {
      x:e,y:s+30,z:t,vx:Math.cos(r)*i,vy:60+Math.random()*120,vz:Math.sin(r)*i,life:350,s0:6,s1:1,c0:[1,.95,.7],c1:[1,.6,.15],drag:3
    })
  }
}
function yj(a,e,t,n,s) {
  a.addFx(ys(a,e,t, {
    r:Math.max(30,n*.6),h:360,color:16767351,ms:s,sparks:0,hold:!0
  }))
}
function vj(a,e,t,n) {
  a.addFx(Ds(a,e,t,n,16774344,16760906,300));
  const s=ll(a),o=a.world3d.heightAt(e,t);
  for(let r=0;r<8;r++) {
    const i=Math.random()*Math.PI*2,l=Math.random()*n*.8;
    s.emit( {
      x:e+Math.cos(i)*l,y:o+4,z:t+Math.sin(i)*l,vy:120+Math.random()*120,life:500,s0:6,s1:1,c0:[1,.97,.8],c1:[1,.7,.2],a0:.95,twinkle:.03
    })
  }
}
function _j(a,e,t,n) {
  a.addFx(Ds(a,e,t,n,16774856,16758842,320)),a.addFx(ys(a,e,t, {
    r:16,h:140,color:16764762,ms:300,sparks:12
  }))
}
function n1(a,e,t) {
  const n=ll(a),s=a.world3d.heightAt(e,t);
  for(let o=0;o<5;o++) {
    const r=Math.random()*Math.PI*2;
    n.emit( {
      x:e+Math.cos(r)*18,y:s+10,z:t+Math.sin(r)*18,vy:90+Math.random()*60,life:600,s0:6,s1:2,c0:[.9,1,.92],c1:[.55,1,.65],a0:.9,twinkle:.03
    })
  }
}
function bj(a,e,t) {
  a.addFx(ys(a,e,t, {
    r:20,h:220,color:16773296,ms:320,sparks:14
  }))
}
class xj {
  constructor(e,t,n,s,o) {
    x(this,"view",new ue);
    x(this,"ps");
    x(this,"t",0);
    x(this,"h");
    this.x=t,this.y=n,this.ms=o,this.h=e.world3d.heightAt(t,n),e.addFx(ys(e,t,n, {
      r:30,h:mc+40,color:13172656,ms:o,sparks:24,hold:!0
    })),e.addFx(Ds(e,t,n,s,15794144,12124058,500)),this.ps=new Ot(e,260),e.addFx(this.ps)
  }
  top() {
    return new F(this.x,this.h+mc,this.y)
  }
  update(e) {
    this.t+=e;
    const t=this.t<this.ms, {
      x:n,y:s,h:o,ps:r
    }
    =this;
    if(t) {
      for(let i=0;i<5;i++) {
        const l=Math.random()*Math.PI*2,d=Math.random()*70;
        r.emit( {
          x:n+Math.cos(l)*d,y:o+mc+(Math.random()-.3)*50,z:s+Math.sin(l)*d,life:140,s0:110,s1:90,c0:[1,1,.85],c1:[.75,1,.6],a0:.3+.1*Math.sin(this.t*.006)
        })
      }
      if(Math.random()<.6) {
        const i=Math.random()*Math.PI*2,l=Math.random()*60;
        r.emit( {
          x:n+Math.cos(i)*l,y:o+mc,z:s+Math.sin(i)*l,vx:(Math.random()-.5)*30,vy:-50-Math.random()*30,vz:(Math.random()-.5)*30,life:2200,s0:7,s1:4,c0:[1,.95,.6],c1:[.7,1,.5],a0:.95,twinkle:.015
        })
      }
      return!1
    }
    for(let i=0;i<40;i++) {
      const l=Math.random()*Math.PI*2;
      r.emit( {
        x:n+Math.cos(l)*20,y:o+Math.random()*mc,z:s+Math.sin(l)*20,vx:Math.cos(l)*80,vy:60+Math.random()*80,vz:Math.sin(l)*80,life:700,s0:6,s1:1,c0:[1,1,.85],c1:[.6,1,.5],drag:2
      })
    }
    return r.stop(),!0
  }
}
const mc=230;
function wj(a,e,t,n,s) {
  const o=new xj(a,e,t,n,s);
  return a.addFx(o),o
}
function Mj(a,e,t,n,s=160) {
  const o=ll(a),r=new F(t,a.world3d.heightAt(t,n)+24,n),i=14;
  for(let l=0;l<=i;l++) {
    const d=e.clone().lerp(r,l/i);
    o.emit( {
      x:d.x,y:d.y,z:d.z,life:140+l/i*s,s0:24,s1:6,c0:[1,1,.9],c1:[.7,1,.55],a0:.9
    })
  }
  a.schedule(s/1e3,()=>o.emit( {
    x:r.x,y:r.y,z:r.z,life:180,s0:40,s1:60,c0:[1,1,.9],c1:[.7,1,.5],a0:.9
  }))
}
const iu=new WeakMap;
function wE(a,e,t,n,s=0) {
  const o=iu.get(e),r=o&&o.until>a.time?o:null;
  iu.set(e, {
    value:Math.max((r==null?void 0:r.value)??0,t),until:a.time+n,burst:Math.max((r==null?void 0:r.burst)??0,s)
  })
}
const ME=.3,Sj=["holy_light","ruwach"],Zx=1,SE=.5,ew= {
  m:1.5,pct:.6
},AE=[];
let Vy=null;
Ct.damageMult.push((a,e,t)=> {
  var i;let n=1;const s=t.src;if(!s)return n;const o=iu.get(e),r=!!o&&o.until>a.time;return r&&((i=a.weapons.find(l=>l.id===s))==null?void 0:i.element)==="holy"&&(n*=1+o.value),r&&s==="holy_light"&&(n*=1+oe(a,"lexAeterna")),Sj.includes(s)&&e.slowUntil>a.time&&(n*=1+ME+oe(a,"purify")),s===a.basicAttack&&!t.part&&a.buffValue("fervor")>0&&a.spendBuff("fervor")&&(n*=1+SE,Vy=e,gj(a,e.x,e.y)),n
});
Ct.hit.push((a,e,t)=> {
  if(Vy!==e)return;Vy=null;const n=ew.m*uo*a.stats.areaMult;a.addFx(Ds(a,e.x,e.y,n,16773824,16758858,300));for(const i of a.enemiesInRadius(e.x,e.y,n))i!==e&&a.damageEnemy(i,t*ew.pct, {
    src:a.basicAttack,part:"Onda sagrada",knock:60,fromX:e.x,fromY:e.y
  });for(const i of AE)i(a,e,t);const s=a.runItems.deityLevel("holy_smite");if(!s)return;const o=e.x,r=e.y;a.schedule(.08,()=> {
    bj(a,o,r),e.dead||a.damageEnemy(e,t*sE(s), {
      src:"holy_smite",part:"Duple Light",fromX:o,fromY:r
    })
  })
});
Ct.kill.push((a,e)=> {
  const t=iu.get(e);if(!t||t.until<=a.time||t.burst<=0)return;iu.delete(e);const n=n8*a.stats.areaMult,s=e.x,o=e.y;a.schedule(.12,()=> {
    _j(a,s,o,n);for(const r of a.enemiesInRadius(s,o,n))r===e||r.dead||r.hp<=0||(wE(a,r,t.value,2,t.burst),a.damageEnemy(r,t.burst, {
      src:"signum_crucis",part:"Oratio",fromX:s,fromY:o,knock:60
    }))
  })
});
const kE= {
  bash:[ {
    key:"stun",label:"Probabilidad de aturdir",base:0,step:.1,max:.8,fmt:"pct"
  }
  ],provoke:[ {
    key:"mark",label:"Daño extra que reciben",base:.2,step:.05,fmt:"pct"
  }
  ],demoralizing_shout:[ {
    key:"weaken",label:"Daño que pierden",base:.2,step:.02,max:.4,fmt:"pct"
  }
  ],endure:[ {
    key:"reduction",label:"Reducción de daño del buff",base:.24,step:.04,max:.6,fmt:"pct"
  }
  ],hp_recovery:[ {
    key:"heal",label:"HP regenerados",base:10,step:3,fmt:"n"
  }
  ],coldbolt:[ {
    key:"slow",label:"Ralentización",base:1.7,step:.3,fmt:"s"
  }, {
    key:"freeze",label:"Probabilidad de congelar",base:0,step:.08,max:.8,fmt:"pct"
  }
  ],frost_diver:[ {
    key:"freeze",label:"Congelación",base:2.25,step:.3,fmt:"s"
  }
  ],concentration:[ {
    key:"agiDex",label:"AGI y DEX del buff",base:.12,step:.02,byRarity:[1,2,3,4,5],fmt:"pct"
  }
  ],heal:[ {
    key:"heal",label:"Curación",base:13,step:4,fmt:"n"
  }
  ],decrease_agi:[ {
    key:"slow",label:"Ralentización",base:2.4,step:.4,fmt:"s"
  }
  ],signum_crucis:[ {
    key:"holy",label:"Daño sagrado extra que reciben",base:.2,step:.04,fmt:"pct"
  }
  ],aqua_benedicta:[ {
    key:"heal",label:"Curación por segundo",base:6,step:1.5,fmt:"n"
  }
  ],blessing:[ {
    key:"dmg",label:"Daño del buff",base:.12,step:.02,fmt:"pct"
  }, {
    key:"cast",label:"Rapidez de casteo del buff",base:.2,step:.04,fmt:"pct"
  }
  ],holy_smite:[ {
    key:"fervor",label:"Ataques básicos bendecidos",base:3,step:1,max:8,fmt:"n",int:!0
  }
  ],envenom:[ {
    key:"poison",label:"Daño del veneno",base:1,step:.2,fmt:"pct"
  }
  ],sand_attack:[ {
    key:"blind",label:"Ceguera",base:2.3,step:.3,fmt:"s"
  }
  ],poison_bomb:[ {
    key:"poison",label:"Daño del veneno",base:1,step:.2,fmt:"pct"
  }
  ],shadowstep:[ {
    key:"stun",label:"Aturdimiento",base:1.5,step:.2,fmt:"s"
  }, {
    key:"flee",label:"Flee del buff",base:.15,step:.01,byRarity:[1,2,3,4,5],max:.6,fmt:"pct"
  }
  ],throw_stone:[ {
    key:"stun",label:"Aturdimiento",base:1.15,step:.2,fmt:"s"
  }
  ],hiding:[ {
    key:"dmg",label:"Daño al salir",base:.1,step:.02,fmt:"pct"
  }
  ],heel_drop:[ {
    key:"stun",label:"Aturdimiento",base:1.15,step:.2,fmt:"s"
  }
  ],sprint:[ {
    key:"speed",label:"Velocidad del buff",base:.35,step:.05,fmt:"pct"
  }
  ]
},EE= {
  bash:5,sword_dance:13,magnum:10,provoke:15,demoralizing_shout:20,shield_bash:10,endure:25,hp_recovery:20,firebolt:6,coldbolt:6,lightning:7,soul_strike:3.5,napalm:6,frost_diver:7,fire_wall:14,thunderstorm:12,sight:14,double_strafe:3,arrow_shower:10,arrow_rain:10,retreat:9,arcane_shot:6,fire_arrow:8,arrow_repel:8,concentration:25,heal:10,holy_light:6,ruwach:14,decrease_agi:14,signum_crucis:15,aqua_benedicta:14,blessing:25,holy_smite:5,envenom:2.5,sand_attack:7,poison_bomb:11.5,shadowstep:16,fan_of_knives:9,caltrops:9,throw_stone:6,hiding:20,mammonite:4.5,cart_revolution:11,zeny_rain:9,cart_rush:9,vending:18,crazy_uproar:25,enlarge_weight:50,tornado_kick:8,heel_drop:6,roundhouse:8,counter_kick:6,sprint:18,shuriken:4,kunai:5,huuma:8,flaming_petals:10,lightning_strike:12,triple_action:4,rapid_shower:6,spread_attack:8,desperado:12,ground_drift:10,tracking:10
},CE= {
  bash:["melee","single","physical","neutral"],magnum:["aura","area","physical","fire"],sword_dance:["aura","area","physical","neutral"],provoke:["aura","area","neutral"],demoralizing_shout:["aura","area","physical","neutral"],shield_bash:["melee","projectile","pierce","physical","neutral"],endure:["buff"],hp_recovery:["buff"],firebolt:["ranged_strike","multi","burst","magic","fire"],coldbolt:["ranged_strike","multi","burst","magic","water"],lightning:["ranged_strike","multi","burst","magic","wind"],soul_strike:["ranged_strike","multi","burst","magic","ghost"],napalm:["ranged_strike","area","magic","ghost"],frost_diver:["ranged_strike","single","magic","water"],fire_wall:["ground","area","persistent","magic","fire"],sight:["orbit","magic","fire"],thunderstorm:["ground","area","magic","wind"],double_strafe:["projectile","single","physical","neutral"],arrow_shower:["ranged_strike","area","physical","neutral"],arrow_rain:["ground","area","physical","neutral"],retreat:["projectile","single","pierce","physical","neutral"],arcane_shot:["ranged_strike","single","physical","hybrid","ghost"],fire_arrow:["ranged_strike","area","physical","hybrid","fire"],arrow_repel:["projectile","pierce","physical","neutral"],concentration:["buff"],heal:["aura","area","magic","holy"],holy_light:["ranged_strike","multi","magic","holy"],ruwach:["orbit","magic","holy"],decrease_agi:["aura","area","magic","holy"],signum_crucis:["ground","area","persistent","magic","holy"],aqua_benedicta:["ground","area","persistent","magic","holy"],blessing:["buff"],holy_smite:["melee","single","physical","holy"],envenom:["melee","single","physical","neutral"],sand_attack:["melee","area","physical","earth"],poison_bomb:["melee","area","physical","neutral"],shadowstep:["buff","melee","physical"],fan_of_knives:["melee","aura","area","physical","neutral"],caltrops:["melee","ground","area","persistent","physical","neutral"],throw_stone:["melee","projectile","single","physical","neutral"],hiding:["buff"],mammonite:["melee","single","physical","neutral"],cart_revolution:["melee","area","physical","neutral"],zeny_rain:["melee","ground","area","physical","neutral"],cart_rush:["melee","area","physical","neutral"],vending:["melee","ground","area","physical","neutral"],crazy_uproar:["buff"],enlarge_weight:["buff"],tornado_kick:["aura","area","physical","neutral"],heel_drop:["melee","single","physical","neutral"],roundhouse:["aura","area","physical","neutral"],counter_kick:["aura","area","physical","neutral"],sprint:["buff"],shuriken:["projectile","single","physical","neutral"],kunai:["projectile","single","physical","neutral"],huuma:["projectile","pierce","return","physical","neutral"],flaming_petals:["ground","area","magic","fire"],lightning_strike:["aura","area","magic","wind"],triple_action:["projectile","single","physical","neutral"],rapid_shower:["projectile","single","physical","neutral"],spread_attack:["aura","area","physical","neutral"],desperado:["aura","area","physical","neutral"],ground_drift:["ground","area","physical","neutral"],tracking:["ranged_strike","single","physical","neutral"],atk_bow:["projectile","single","physical","neutral"],atk_gun:["projectile","single","physical","neutral"],atk_shuriken:["projectile","single","physical","neutral"],atk_rod:["projectile","single","magic","neutral"],atk_infused:["projectile","single","magic","neutral"],atk_infused_melee:["melee","single","magic","neutral"],atk_sword:["melee","single","physical","neutral"],atk_twohand:["melee","single","physical","neutral"],atk_axe2:["melee","single","physical","neutral"],atk_axe:["melee","single","physical","neutral"],atk_spear:["melee","single","physical","neutral"],atk_lance:["melee","single","physical","neutral"],atk_dagger:["melee","single","physical","neutral"],atk_blunt:["melee","single","physical","neutral"],atk_fist:["melee","single","physical","neutral"],atk_katar:["melee","single","physical","neutral"],atk_knuckle:["melee","single","physical","neutral"],atk_book:["melee","single","physical","neutral"],atk_instrument:["projectile","single","physical","neutral"],atk_whip:["ranged_strike","single","physical","neutral"]
};
function ap(a) {
  const e=CE[a];
  if(!e)throw new Error(`Skill sin etiquetas: ${a}`);
  return[...e,...Up[a]?["cast"]:[],...a.startsWith("atk_")?["basic"]:[]]
}
function s1(a) {
  return a.find(e=>["neutral","fire","water","wind","earth","holy","ghost"].includes(e))??"neutral"
}
const Bp=1.5,TE= {
  bash:"single",sword_dance:"aoe",magnum:"aoe",provoke:"control",demoralizing_shout:"control",shield_bash:"projectile",endure:"buff",hp_recovery:"buff",firebolt:"multi",coldbolt:"multi",lightning:"multi",soul_strike:"multi",napalm:"aoe",fire_wall:"zone",frost_diver:"single",sight:"orbit",thunderstorm:"aoe",double_strafe:"projectile",arrow_shower:"aoe",arrow_rain:"aoe",retreat:"single",arcane_shot:"single",fire_arrow:"aoe",arrow_repel:"projectile",concentration:"buff",heal:"aoe",holy_light:"multi",ruwach:"orbit",decrease_agi:"control",signum_crucis:"zone",aqua_benedicta:"zone",blessing:"buff",holy_smite:"single",envenom:"single",sand_attack:"aoe",poison_bomb:"aoe",shadowstep:"buff",fan_of_knives:"aoe",caltrops:"zone",hiding:"buff",throw_stone:"single",mammonite:"single",cart_revolution:"aoe",zeny_rain:"aoe",cart_rush:"aoe",vending:"zone",crazy_uproar:"buff",enlarge_weight:"buff",tornado_kick:"aoe",heel_drop:"single",roundhouse:"aoe",counter_kick:"aoe",sprint:"buff",shuriken:"projectile",kunai:"projectile",huuma:"projectile",flaming_petals:"aoe",lightning_strike:"aoe",triple_action:"projectile",rapid_shower:"projectile",spread_attack:"aoe",desperado:"aoe",ground_drift:"aoe",tracking:"single",atk_bow:"projectile",atk_gun:"projectile",atk_shuriken:"projectile",atk_rod:"projectile",atk_infused:"projectile",atk_infused_melee:"single",atk_sword:"single",atk_twohand:"single",atk_spear:"single",atk_lance:"single",atk_axe2:"single",atk_axe:"single",atk_dagger:"single",atk_blunt:"single",atk_fist:"single",atk_katar:"single",atk_knuckle:"single",atk_book:"single",atk_instrument:"projectile",atk_whip:"single"
};
function np(a) {
  const e=TE[a];
  if(!e)throw new Error(`Skill sin tipo: ${a}`);
  return e
}
const va={},o1=(a=1)=> {
  const e=new Fn(xt.sheet("fx_arrow"),"a2");
  return e.scale.set(a),e
},wr=(a,e=1,t=!1,n=16777215)=> {
  const s=new Ra($t(a));
  return s.anchor.set(.5),s.scale.set(e),s.tint=n,t&&(s.blendMode="add"),s
},PE=()=>[1,2,3,4,5,6].map(a=>$t("tex_firebolt"+a)),ii= {
  hitFx:(a,e)=>Da(a,e),sound:"ef_hit2"
},Fs= {
  hitFx:(a,e)=>Da(a,e)
},Od= {
  hitFx:(a,e)=>Da(a,e),sounds:eO
},li= {
  hitFx:(a,e)=>Lp(["str_firehit1","str_firehit2","str_firehit3"],a,e,.55,0),sound:"ef_firehit"
},Au= {
  hitFx:(a,e)=>Lp(["str_windhit1","str_windhit2","str_windhit3"],a,e,.55,0),sounds:["hit_fist1","hit_fist2","hit_fist3"]
};
function Np(a) {
  const e=a.desc;
  a.desc=(t,n)=>Pt(e(t,n)),va[a.id]=Do(a,["name"])
}
const Wy=8;
function $e(a,e,t,n,s,o=Wy) {
  Np( {
    id:a,name:e,icon:t,kind:"weapon",maxLevel:o,desc:n,type:np(a),tags:ap(a),create:(r=a)=> {
      const i=s(r);i.type=np(a),i.tags=ap(a),i.element=s1(i.tags),i.effects=kE[a]??[];const l=EE[a];if(l===void 0)throw new Error(`Skill sin enfriamiento: ${a}`);const d=i.cooldown();i.type!=="buff"&&i.type!=="control"&&i.type!=="orbit"&&d>0&&l>d&&(i.dmgScale=Math.min(Bp,Math.sqrt(l/d))),i.cdBase=l;const c=Up[a];return c&&(i.castKind=c[0],i.castTime=ZA[i.castKind],i.castByLevel=Pm[a]??null),i
    }
  })
}
const Pm= {
  thunderstorm:a=>1+4*(a-1)/(Wy-1),fire_wall:a=>2-(a-1)/(Wy-1),soul_strike:()=>1,aqua_benedicta:()=>1
},Up= {
  firebolt:["single","fire"],coldbolt:["single","water"],lightning:["single","wind"],soul_strike:["single","ghost"],napalm:["single","ghost"],frost_diver:["single","water"],fire_wall:["area","fire"],thunderstorm:["area","wind"],holy_light:["single","holy"],decrease_agi:["area","holy"],signum_crucis:["area","holy"],aqua_benedicta:["area","holy"],arrow_repel:["single","neutral"],huuma:["single","neutral"],flaming_petals:["area","fire"],lightning_strike:["area","wind"],tracking:["single","neutral"],ground_drift:["area","neutral"]
};
function wa(a,e,t,n,s,o) {
  Np( {
    id:a,name:e,icon:t,kind:"passive",maxLevel:n,desc:s,passive:o
  })
}
const Aj=70;
$e("bash","Bash","sm_bash",a=>a===1?"Golpe potente al enemigo más cercano. Puede aprender a aturdir.":"+3% daño y +10% alcance.",a=>new dn(a, {
  cd:I(.9),dmg:ee(300/Bp,.03),range:ee(100,.1),hit:(e,t)=>( {
    ...ii,...t.eff("stun")>0? {
      stun:1.2,stunChance:t.eff("stun")
    }
    :{}
  }),sound:"ef_bash",fx:e=>vs(e.player.x,e.player.y),slam: {
    r:Aj,fx:MO
  }
}));
const tw= {
  secs:10,stacks:2
},Nh= {
  secs:30,dmg:.35,cd:90
},aw=new WeakMap;
function nw(a,e) {
  const t=a.player;
  e?(a.addFx(ys(a,t.x,t.y, {
    r:46,h:360,color:16769658,ms:900,sparks:40
  })),a.addFx($v("fx_angel",t.x,t.y, {
    ms:1200
  })),ea(a,t,140,16766810,700),a.addFx(xa(Vn(t.x,t.y,$t("tex_pok3"),18,16773280,1200,160,.5),t)),ce.play("ef_angelus",.6)):(a.addFx(ys(a,t.x,t.y, {
    r:30,h:220,color:13217914,ms:700,sparks:14
  })),ea(a,t,120,14204794,800),a.addFx(xa(Vn(t.x,t.y,$t("tex_pok3"),22,14207120,1100,128,.4),t)),ce.play("ef_endure",.35))
}
const kj= {
  secs:3
},sw=new WeakMap;
Ct.hurt.push((a,e)=> {
  if(e<=0)return e;const t=oe(a,"guardUp"),n=a.time-(sw.get(a)??-1/0)>=kj.secs;return sw.set(a,a.time),t<=0||!n?e:(ea(a,a.player,46,14674175,280),Math.max(1,Math.round(e*(1-Math.min(.9,t)))))
});
Ct.hurt.push((a,e)=> {
  if(e<=0)return e;if(a.hp-e<=0&&oe(a,"lastBreath")&&a.time>=(aw.get(a)??0))return aw.set(a,a.time+Nh.cd),a.healPlayer(a.stats.maxHp),a.addBuff("lastBreath",Nh.dmg,Nh.secs,"endure"),nw(a,!0),a.events.onAnnounce(bt("¡Último aliento!")),a.schedule(Nh.secs,()=> {
    a.player.dead||nw(a,!1)
  }),0;const t=oe(a,"wallRage");if(t>0) {
    const n=Math.min(tw.stacks,Math.round(a.buffValue("wallRage")/t)+1);a.addBuff("wallRage",t*n,tw.secs,"provoke",n)
  }
  return e
});
Ct.damageMult.push(a=>(1+a.buffValue("wallRage"))*(1+a.buffValue("lastBreath")));
const ow= {
  jobs:["swordsman","thief","merchant"],mult:1.4
},rw=new WeakMap;
Ct.damageMult.push((a,e,t)=> {
  var s,o;if(!e.def.boss||!t.src||!((o=(s=va[t.src])==null?void 0:s.tags)!=null&&o.includes("area")))return 1;let n=rw.get(a);return n===void 0&&rw.set(a,n=al(a.classDef.id).some(r=>ow.jobs.includes(r))),n?ow.mult:1
});
Ct.damageMult.push((a,e,t)=> {
  var s,o;const n=oe(a,"areaSkillDmg");return n>0&&t.src&&((o=(s=va[t.src])==null?void 0:s.tags)!=null&&o.includes("area"))?1+n:1
});
const $y= {
  dmg:.15,burn:2.75
};
Ct.damageMult.push((a,e,t)=>t.src==="magnum"&&oe(a,"magnumInferno")>0?$y.dmg:1);
Ct.hit.push((a,e,t,n)=> {
  t<=0||e.dead||n.src!=="magnum"||oe(a,"magnumInferno")<=0||a.ignite(e,t/$y.dmg*$y.burn,"magnum")
});
$e("magnum","Magnum Break","sm_magnum",a=>a===1?"Explosión de fuego a tu alrededor que repele enemigos.":"+20% daño y +12% área.",a=>new xn(a, {
  halo:16752704,cd:I(4),dmg:ee(28*1.3,.2),radius:ee(115*1.25,.12),hit:()=>( {
    knock:260
  }),sound:"ef_magnumbreak",fx:(e,t,n)=>(nO(e,t,n),null),cast:(e,t,n,s,o)=> {
    ea(e,e.player,t,16752704),e.runItems.deityLevel("magnum")&&(ea(e,e.player,t*1.15,16738848,520),e.igniteRing(e.player.x,e.player.y,t,o))
  }
}));
const iw=.44;
$e("sword_dance","Sword Dance","kn_brandishspear",()=>"Danza de espadas: crece desde ti y se abre en tres pulsos de tajos, cada uno más lejos. Lo que tienes cerca recibe todos.",a=>new xn(a, {
  halo:14674175,cd:I(9),dmg:ee(14*Math.sqrt(9/3),.2),radius:ee(185,.08),ticks:I(3),grow:iw,hit:()=>Fs,sound:"hit_sword",fx:()=>null,cast:(e,t,n,s)=> {
    const o=(n-1)*s*1e3+700,r=e.runItems.deityLevel("sword_dance");e.addFx(_N(e,e.player,t,0,o,r>0,5,iw*1e3)),r&&e.schedule((n-1)*s,()=>e.chargeWeapon(r,bk))
  }
}));
$e("provoke","Provoke","sm_provoke",a=>`Provoca a los enemigos cercanos: reciben +${15+5*a}% de daño durante 5 s.`,a=>new xn(a, {
  halo:16734790,cd:I(6),dmg:I(0),radius:ee(170,.08),hit:(e,t)=>( {
    mark:t.eff("mark"),markTime:5,hitFx:(n,s)=>kt("str_provoke",n,s,.8,0)
  }),sound:"swordman_provoke",fx:()=>null,cast:(e,t)=> {
    ea(e,e.player,t,16734790),e.runItems.deityLevel("provoke")&&e.chainProvoked(t,5)
  }
}),6);
$e("demoralizing_shout","Demoralizing Shout","dc_scream",a=>`Grito que desmoraliza a los enemigos cercanos: hacen un ${18+2*a}% menos de daño durante 6 s. También les hace un poco de daño.`,a=>new xn(a, {
  halo:12166120,cd:I(6),dmg:ee(8,.15),radius:ee(170,.08),hit:(e,t)=>( {
    weaken:t.eff("weaken"),weakenTime:6,knock:18,hitFx:(n,s)=>bp(n,s)
  }),sound:"ef_rageburst",fx:()=>null,cast:(e,t)=> {
    const n=e.runItems.deityLevel("demoralizing_shout");e.addFx(fA(e,e.player,t,n>0)),n&&e.stealMorale(t,n),e.addFx(xa(aO(27,e.player.x,e.player.y,175),e.player))
  }
}),6);
$e("shield_bash","Shield Bash","sm_shieldbash",a=>a===1?"Proyectas un escudo de luz hacia el enemigo más cercano: golpea a todo lo que atraviesa. Requiere escudo.":"+25% daño.",a=>new Ua(a, {
  cd:I(10),dmg:ee(52,.25),count:I(1),speed:434,aim:"spread",spread:.3,pierce:I(99),radius:34,life:.57,windup:.5,formAt:60,surge:!0,reach:!0,cover:!0,aspects:["dmg","cd","count","targets","area","reach"],view:()=>new ue,model:(e,t)=>new bU(e,t),orient:null,sound:"ef_shieldpress",hit:()=>( {
    knock:70,hitFx:(e,t)=>xp(e,t)
  })
}));
va.shield_bash.needsShield=!0;
wa("sword_mastery","Sword Mastery","sm_sword",5,()=>"+8% de daño.",(a,e)=>a.damageMult+=.08*e);
wa("two_hand","Two-Hand Mastery","sm_twohand",5,()=>"+8% de área y alcance.",(a,e)=>a.areaMult+=.08*e);
$e("endure","Endure","sm_endure",a=>`Aguantas los golpes: recibes -${20+4*a}% de daño durante 8 s.`,a=>new pt(a,I(18),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,200).length)return!1;ce.play("ef_endure",.5),e.player.cast(),e.addFx(xa(vs(e.player.x,e.player.y),e.player));const s=(8+oe(e,"endureSecs"))*n.dur(e);e.addBuff("reduction",n.eff("reduction")+e.stats.endureReduction,s,n.id);const o=oe(e,"endureHeal");o>0&&e.hp<e.stats.maxHp&&e.healPlayer((e.stats.maxHp-e.hp)*o);const r=e.runItems.deityLevel("endure");return r&&e.raiseBastion(r,s),!0
}),6);
$e("hp_recovery","Increase HP Recovery","sm_recovery",a=>`Regeneras ${String((10+3*(a-1))/10).replace(".",",")} HP por segundo durante 10 s (${10+3*(a-1)} HP en total).`,a=>new pt(a,I(15),(e,t,n)=>e.hp>=e.stats.maxHp?!1:(ce.play("heal",.4),e.addFx(xa(Vn(e.player.x,e.player.y,$t("tex_pok3"),10,12124088,1100,128,.3),e.player)),e.addBuff("regen",n.eff("heal")/10,10*n.dur(e),n.id),e.runItems.deityLevel("hp_recovery")&&e.plantYggdrasil(10*n.dur(e)),!0)),6);
wa("auto_berserk","Auto Berserk","sm_autoberserk",3,a=>`Con menos del 40% de vida haces +${20*a}% de daño.`,(a,e)=>a.lowHpDamage+=.2*e);
const Ej=1.8,RE=1.4,di=(a,e=Ej)=>t=>a(t)*e,qp=2;
$e("firebolt","Fire Bolt","mg_firebolt",a=>a===1?"Bolas de fuego que caen del cielo sobre el enemigo más cercano. Cada nivel añade un bolt más.":a%2===1?"+2 bolas.":"+25% daño.",a=>new Aa(a, {
  cd:I(1.3),dmg:di(e=>19*(1+.25*Math.floor(e/2))),count:xu(1,2),targetStep:qp,target:"nearest",range:420,delay:.45,castSounds:["ef_firearrow","ef_firearrow2","ef_firearrow3"],hit:()=>li,burst:e=>e,fx:(e,t,n)=>su(t,n,PE(),450,.55)
}));
$e("coldbolt","Cold Bolt","mg_coldbolt",a=>a===1?"Saetas de hielo que caen del cielo y ralentizan (pueden aprender a congelar). Cada nivel añade un bolt más.":a%2===1?"+2 saetas.":"+25% daño.",a=>new Aa(a, {
  cd:I(1.6),dmg:di(e=>13*(1+.25*Math.floor(e/2))),count:xu(2,2),targetStep:qp,target:"nearest",range:420,delay:.45,castSounds:["ef_icearrow1","ef_icearrow2","ef_icearrow3"],burst:e=>e,hit:(e,t)=>( {
    slow:t.eff("slow"),...t.eff("freeze")>0? {
      freeze:1.5,freezeChance:t.eff("freeze")
    }
    :{},sounds:["hit_fist3","hit_fist4"]
  }),fx:(e,t,n)=>(Mu(e,t,n),su(t,n,[$t("tex_icearrow")],450,.55))
}));
$e("lightning","Lightning Bolt","mg_lightningbolt",a=>a===1?"Rayos sobre enemigos aleatorios. Cada nivel añade un bolt más.":a%2===0?"+2 rayos.":"+25% daño.",a=>new Aa(a, {
  cd:I(2.2),dmg:di(e=>27*(1+.25*Math.floor((e-1)/2))),count:e=>1+Math.floor(e/2),targetStep:qp,target:"random",sound:"ef_lightbolt",hit:()=>Au,burst:e=>e,fx:(e,t,n)=>kt("str_lightning",t,n,.75,0),cast:!0
}));
$e("soul_strike","Soul Strike","mg_soulstrike",a=>a===1?"Almas que vuelan curvadas hacia el enemigo (x2 a no-muertos). Cada nivel añade un alma más.":"+1 alma y +10% daño.",a=>(()=> {
  let e=0;return new Aa(a, {
    cd:I(1.7),dmg:di(ee(10.35,.1)),count:I(1),targetStep:qp,bonusTargets:(t,n)=> {
      const s=t.buffValue("soulCharge");return n&&t.clearBuff("soulCharge"),s
    },burst:t=>2+t,burstGap:.15,target:"nearest",range:420,delay:.25,sound:"ef_soulstrike",hit:()=>( {
      undeadMult:2,...ii
    }),fx:(t,n,s)=>(lO(t,t.player, {
      x:n,y:s
    },e++),null)
  })
})());
$e("napalm","Napalm Beat","mg_napalmbeat",a=>a===1?"Golpe fantasma sobre el enemigo cercano y los de alrededor.":"+20% daño y +10% área.",a=>new Aa(a, {
  cd:I(1.2),dmg:di(ee(20,.2)),count:I(1),target:"nearest",range:380,splash:ee(55,.1),burst:()=>1,burstGap:.15,sound:"ef_napalmbeat",hit:()=>ii,fx:(e,t,n,s)=>(d8(e,t,n,s),null)
}));
const Vi=1.2;
$e("fire_wall","Fire Wall","mg_firewall",a=>a===1?"Levanta un muro de fuego entre tú y los enemigos.":"+1 llama, +15% daño, más duración y menos casteo.",a=>new Tp(a, {
  cd:I(5),dmg:di(ee(10.35,.15),RE),cells:e=>3+Math.floor(e/2),duration:e=>3+.4*e,tick:.35,cellRadius:26*Vi,gap:34*Vi,near:uo,fx:(e,t,n,s)=>kt($s()<.5?"str_firewall1":"str_firewall2",t,n,.7*Vi,0,s),hit:()=>( {
    knock:120,...li
  }),sound:"ef_firewall",onEnd:(e,t,n,s,o)=> {
    const r=e.runItems.deityLevel("fire_wall");if(!r)return;const i=26*Vi*1.8*e.stats.areaMult*(1+e.skillMod("fire_wall").area);c8(e,t,n,i),ce.play("ef_firehit",.35,4);for(const l of e.enemiesInRadius(t,n,i))e.damageEnemy(l,s*rE(r), {
      ...o,knock:160,fromX:t,fromY:n,part:"Fire Pillar"
    })
  }
}));
const Cj=.3;
$e("frost_diver","Frost Diver","mg_frostdiver",a=>a===1?"Estela de hielo por el suelo que congela al enemigo. No hace daño: solo control.":"+0,3 s de congelación.",a=>new Aa(a, {
  cd:I(2.4),dmg:I(0),count:I(1),target:"nearest",range:420,delay:.55,sound:"ef_frostdiver",hit:(e,t)=>( {
    freeze:t.eff("freeze")+Cj*(e-1),freezeChance:1,hitFx:(n,s)=>kt("str_freeze",n,s,.9,0),sound:"ef_frostdiver2"
  }),fx:(e,t,n)=>new p8(e,e.player.x,e.player.y,t,n,550)
}));
$e("sight","Sight","mg_sight",a=>a===1?"Dos llamas que orbitan a tu alrededor.":"+1 llama y +15% daño.",a=>new Wv(a, {
  uptime:8,count:e=>e+1,radius:88,speed:3.2,dmg:di(ee(12.65,.15),RE),hitCd:.6,view:()=> {
    const e=Pp("fx_sight",.9);return e.loop=!0,e
  },sound:"ef_firehit",onEnd:(e,t,n,s,o,r)=> {
    const i=e.runItems.deityLevel("sight");if(!i)return;const l=i8*uo*e.stats.areaMult;ce.play("ef_firewall",.35,2);for(const d of t)e.addFx(new u8(e,d.x,d.y,Nn(d.y-s,d.x-n),(c,u)=> {
      Qv(e,c,u,l);for(const h of e.enemiesInRadius(c,u,l))e.damageEnemy(h,o*iE(i), {
        ...r,...li,knock:140,fromX:c,fromY:u,part:"Sightrasher"
      })
    }))
  }
}),6);
$e("thunderstorm","Thunderstorm","mg_thunderstorm",a=>a===1?"Tormenta eléctrica sobre un grupo de enemigos.":"+20% daño, +10% área y más casteo.",a=>new fo(a, {
  cd:I(5),dmg:di(ee(20.7,.2)),ticks:I(7),interval:.16,area:ee(95*Vi,.1),tickRadius:45*Vi,hit:(e,t)=>t.element==="fire"?li:Au,fxStart:(e,t,n,s,o,r,i)=>(e.stats.stormVortex&&e.vortexPull(s,o,i,uG),e.stats.firestorm?(ce.play("ef_firewall",.45,2),vO(e,s,o,i,7*.16)):(ce.play("magician_thunderstorm",.45,2),kt("str_thunderstorm",s,o,.7*Vi,0))),fxTick:()=>null,onEnd:(e,t,n,s,o,r)=> {
    const i=e.runItems.deityLevel("thunderstorm");if(!i)return;const l=!!e.stats.firestorm;h8(e,t,n,s,l),ce.play(l?"ef_firewall":"magician_thunderstorm",.6,2);for(const d of e.enemiesInRadius(t,n,s))e.damageEnemy(d,o*lE(i), {
      ...r,knock:180,fromX:t,fromY:n,part:"Lord of Vermilion"
    })
  }
}));
wa("sp_recovery","Increase SP Recovery","mg_srecovery",5,()=>"+6 de Celeridad.",(a,e)=>a.haste+=.06*e);
wa("energy_coat","Energy Coat","mg_energycoat",5,()=>"-6% de daño recibido.",(a,e)=>a.damageReduction+=.06*e);
wa("stone_curse","Stone Curse","mg_stonecurse",5,()=>"+2% de probabilidad de petrificar al golpear.",(a,e)=>a.petrifyChance+=.02*e);
const Rm= {
  dmg:.08,secs:3
};
Ct.hit.push((a,e,t,n)=> {
  n.src==="double_strafe"&&!e.dead&&oe(a,"preyMark")>0&&(e.preyUntil=a.time+Rm.secs)
});
Ct.damageMult.push((a,e,t)=>t.src===a.basicAttack&&e.preyUntil>a.time?1+oe(a,"preyMark"):1);
$e("double_strafe","Double Strafe","ac_double",a=>a===1?"Salva muy rápida de flechas que vuelan curvadas hacia el enemigo más cercano, alternando de lado.":"+20% daño.",a=>new QH(a, {
  cd:I(.9),dmg:e=>56/Bp*(1+.2*(e-1)),count:I(2),fixedCount:!0,combo:!0,range:600,gap:.05,flight:.13,hitSound:"hit_arrow",hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  }),fx:(e,t,n,s,o)=>new Zv(e,t,n,s,o),sharp:e=> {
    const t=e.runItems.deityLevel("double_strafe");return t? {
      mult:Tk(t),crit:Pk,beyond:Rk*uo,width:YO,speed:XO,fx:(n,s,o,r)=>new fE(n,s,o,r)
    }
    :null
  }
}));
$e("arrow_shower","Arrow Shower","ac_shower",a=>a===1?"Abanico de flechas hacia el grupo: golpea a todos los que pilla delante y los empuja. Dispara 2 andanadas.":a%2===1?"+1 andanada y +15% daño.":"+15% daño.",a=>new JH(a, {
  cd:I(3.2),dmg:ee(22,.15),range:I(300),angle:60,volleys:e=>2+Math.floor((e-1)/2),gap:.16,sound:"arrowstorm",hit:()=>( {
    knock:90,hitFx:(e,t)=>Da(e,t),sound:"hit_arrow"
  }),fx:(e,t,n,s,o,r,i)=>new g8(e,t,n,s,o,r,i===0?1.2:1),onLast:(e,t,n,s,o,r,i,l)=> {
    const d=e.runItems.deityLevel("arrow_shower");d&&Ij(e,t,n,s,o,r,i*qk(d),l)
  }
}));
const Tj=.55;
$e("arrow_rain","Arrow Rain","ac_arrowrain",a=>a===1?"Disparas una andanada de flechas al cielo que poco después cae sobre el grupo marcado.":"+2 flechas y +15% daño.",a=>new fo(a, {
  cd:I(3.2),dmg:ee(12.5,.15),ticks:e=>10+2*e,interval:.06,area:ee(92,.06),tickRadius:34,delay:Tj,sound:"arrowstorm",tickSound:"hit_arrow",hit:()=>( {
    knock:40
  }),fxStart:(e,t,n,s,o,r,i)=>(D8(e,t,n,s,o,i+34,r,r+1.4),null),fxTick:(e,t,n)=>F8(e,t,n),onEnd:(e,t,n,s,o,r)=> {
    const i=e.runItems.deityLevel("arrow_rain");if(!i)return;const l=s+34;e.addFx(new H8(e,t,n,l,Ny));for(let d=1;d*Uy<=Ny;d++)e.schedule(d*Uy,()=> {
      for(const c of e.enemiesInRadius(t,n,l))e.damageEnemy(c,o*zk(i), {
        ...r,src:"arrow_rain",part:"Campo de flechas",slow:KO,knock:0,fromX:t,fromY:n,hitFx:void 0,sound:void 0
      })
    })
  }
}));
const lw=.2,dw=1.5;
$e("retreat","Retirada","ac_retreat",a=>a===1?`Saltas hacia atrás, lejos del enemigo más cercano, y al aterrizar le disparas una flecha potente que atraviesa a todos los que hay en línea. Eres inmune al daño durante ${String(dw).replace(".",",")} s.`:"+20% daño.",a=>new ZH(a, {
  cd:I(3),dmg:ee(20,.2),range:260,dash:2.6*uo,dashTime:lw,immune:dw,shot:9*uo,width:34,speed:2600,sound:"ef_hiding",hit:()=>( {
    hitFx:(e,t)=>Da(e,t),sound:"hit_arrow"
  }),dashFx:(e,t,n)=>j8(e,t,n,lw*1e3),shotFx:(e,t,n,s)=>new fE(e,t,n,s),onLand:e=> {
    const t=e.runItems.deityLevel("retreat");t&&(e.addChargeBuff("windWalk",Fk,"retreat"),e.addBuff("speed",Bk(t),Ik,"retreat"),e.addFx(new G8(e,e.player,()=>e.buffValue("windWalk"))))
  }
}));
const cw=.18,uw=140,S0=.26,hw=22,Pj=.5;
$e("arcane_shot","Arcane Shot","ac_arcaneshot",a=>a===1?"Disparo arcano al centro del grupo más grande que tengas a tiro: al impactar suelta un pulso que atrae de golpe hacia él a los monstruos de alrededor (salvo jefes).":"+20% daño.",a=> {
  let e=-1;return new Aa(a, {
    cd:I(2.6),dmg:ee(19.8,.2),count:I(1),target:"cluster",clusterR:(t,n)=>uw*t.stats.areaMult*(1+n.mod(t).area),range:520,splash:I(45),splashPct:.6,delay:cw,sound:"ef_soulstrike",hit:(t,n)=>( {
      hitFx:(s,o)=>Da(s,o),afterHit:(s,o)=> {
        s.time-e<.1||(e=s.time,Dj(s,o.x,o.y,uw*s.stats.areaMult*(1+n.mod(s).area),n.power(s)))
      }
    }),fx:(t,n,s)=>(V8(t,n,s,cw*1e3),null)
  })
});
const Rj=3,zj=45,Lj=1.5;
function Dj(a,e,t,n,s=1) {
  a.addFx(new K8(a,e,t,n,S0*1e3));
  const o=a.enemiesInRadius(e,t,n).filter(d=>!d.dead&&!d.def.boss).map(d=>( {
    e:d,x0:d.x,y0:d.y
  })),r=a.runItems.deityLevel("arcane_shot"),i=1/30,l=Math.ceil(S0/i);
  for(let d=1;d<=l;d++) {
    const c=d/l,u=c*c;
    a.schedule(c*S0,()=> {
      for(const h of o) {
        if(h.e.dead)continue;const m=Qt(h.x0-e,h.y0-t)||1,p=Math.min(m,hw+(m-hw)*(1-u));h.e.x=e+(h.x0-e)/m*p,h.e.y=t+(h.y0-t)/m*p,h.e.kx=0,h.e.ky=0,!(c<1)&&(h.e.stunUntil=Math.max(h.e.stunUntil,a.time+Pj),r&&(a.applyStatus(h.e, {
          mark:Nk(r),markTime:Uk
        }),ea(a,h.e,30,11832575,320)))
      }
      c>=1&&a.stats.elemConverge>0&&o.some(h=>!h.e.dead&&h.e.burnUntil>a.time)&&Fj(a,e,t,s)
    })
  }
}
function Fj(a,e,t,n) {
  const s=Rj*uo*a.stats.areaMult;
  Qv(a,e,t,s),a.shake(.18,5),ce.play("ef_firehit",.45,3);
  const o=zj*n;
  for(const r of a.enemiesInRadius(e,t,s))a.damageEnemy(r,o, {
    src:"arcane_shot",part:"Convergencia elemental",burn:Lj,knock:120,fromX:e,fromY:t,...li
  })
}
const mw=.38,pw=1.5,fw=1.8;
$e("fire_arrow","Flecha ígnea","ac_firearrow",a=>a===1?"Flecha de fuego en parábola sobre el enemigo más cercano: revienta como una bola de fuego que daña y quema a los del impacto, y salpica fuego más lejos que quema a los de alrededor.":"+20% daño y +6% área.",a=> {
  let e=-1,t=0;return new Aa(a, {
    cd:I(2.8),dmg:ee(12.1,.2),count:I(1),target:"nearest",range:480,splash:ee(70,.06),splashPct:1,delay:mw,sound:"ef_firearrow",hit:(n,s)=>( {
      burn:pw,afterHit:(o,r,i)=> {
        if(o.time-e<.1||t<=0)return;e=o.time;const l=i*(pw+(s.mod(o).hit.burn??0));for(const d of o.enemiesInRadius(r.x,r.y,t*fw))d.dead||Qt(d.x-r.x,d.y-r.y)<=t||o.ignite(d,l,a)
      }
    }),fx:(n,s,o,r)=>(t=r,W8(n,s,o,r,mw*1e3,r*fw),null)
  })
});
function Ij(a,e,t,n,s,o,r,i) {
  a.addFx(new v8(a,e,t,n,s,o,qy));
  for(let l=1;l*Hy<=qy;l++)a.schedule(l*Hy,()=> {
    for(const d of dk(a,e,t,n,s,o))a.damageEnemy(d,r, {
      ...i,src:"arrow_shower",part:"Galerna",slow:QO,knock:ZO,fromX:e,fromY:t,hitFx:void 0,sound:void 0
    })
  })
}
$e("arrow_repel","Arrow Repel","ac_chargearrow",a=>a===1?"Flecha enorme que atraviesa a todos y los empuja lejos.":"+25% daño.",a=>new Ua(a, {
  cd:I(3),dmg:ee(60,.25),count:I(1),speed:720,aim:"spread",pierce:I(99),radius:18,life:1.2,view:()=>new ue,model:(e,t)=>new S8(e,t),orient:null,hit:()=>( {
    knock:380,hitFx:(e,t)=>Da(e,t),afterHit:(e,t)=>A8(e,t.x,t.y,e.player.x,e.player.y)
  }),hitSound:"hit_arrow"
}));
wa("owls_eye","Owl's Eye","ac_owl",5,()=>"+4% de probabilidad de crítico.",(a,e)=>a.critChance+=.04*e);
wa("vultures_eye","Vulture's Eye","ac_vulture",5,()=>"+10% velocidad de proyectiles y +6% de área.",(a,e)=> {
  a.projSpeedMult+=.1*e,a.areaMult+=.06*e
});
$e("concentration","Improve Concentration","ac_concentration",()=>"Durante 10 s: +12% de AGI y de DEX.",a=>new pt(a,I(20),(e,t,n)=> {
  if(!e.nearestEnemy(500))return!1;ce.play("ac_concentration",.5),e.player.cast(),e.addFx(xa(kt("str_concentration",e.player.x,e.player.y,1,0),e.player)),e.addBuff("agiDex",n.eff("agiDex"),10*n.dur(e),n.id),e.recomputeStats(),e.schedule(10*n.dur(e)+.01,()=>e.recomputeStats());const s=e.runItems.deityLevel("concentration");return s&&(e.addBuff("trueSight",Dk(s),10*n.dur(e),n.id),e.addBuff("trueSightPierce",Lk,10*n.dur(e),n.id),e.addFx(new O8(e,e.player,10*n.dur(e)))),!0
}),6);
wa("making_arrow","Arrow Crafting","ac_makingarrow",2,()=>"+1 proyectil en todas tus habilidades de disparo.",(a,e)=>a.extraProjectiles+=e);
const Bj=12.6,Nj=140,zE=400,gw=4,Uh=new WeakMap;
function Uj(a) {
  const e=oe(a,"basilicaHp");
  if(!e)return;
  const t=Uh.get(a);
  !!t&&t.stats===a.stats?a.stats.maxHp-=t.hp:a.hp+=e,a.stats.maxHp+=e;
  const s=a.time+gw;
  Uh.set(a, {
    stats:a.stats,hp:e,until:s
  }),a.schedule(gw,()=> {
    const o=Uh.get(a);!o||o.until>s||(Uh.delete(a),o.stats===a.stats&&(a.stats.maxHp-=o.hp,a.hp=Math.min(a.hp,a.stats.maxHp)))
  })
}
function qj(a,e) {
  const t=a.player;
  let n=null,s=0;
  for(const o of a.enemiesInRadius(t.x,t.y,zE).slice(0,40)) {
    if(o.dead)continue;
    const r=a.enemiesInRadius(o.x,o.y,e).length;
    r>s&&([n,s]=[o,r])
  }
  return n
}
function Hj(a,e,t) {
  const n=a.player,s=a.enemiesInRadius(n.x,n.y,zE).slice(0,40).filter(r=>!r.dead).map(r=>( {
    e:r,n:a.enemiesInRadius(r.x,r.y,e).length
  }));
  s.sort((r,i)=>i.n-r.n);
  const o=[];
  for(const r of s)o.length<t&&o.every(i=>Qt(i.x-r.e.x,i.y-r.e.y)>e)&&o.push(r.e);
  return o
}
const Ps=tk("skilldefs",()=>( {
  fountainRun:!1,judgeTick:!1,spareAqua:null,blessingBase:null,smiteAt:-1,looseFan:null
}));
Ct.start.push(a=>Ps().fountainRun=oe(a,"fountain")>0);
class Oj extends pt {
  aspects() {
    return Ps().fountainRun?[...super.aspects(),"count"]:super.aspects()
  }
  countUnit() {
    return"objetivo"
  }
}
$e("heal","Heal","al_heal",a=>a===1?`Pulso de luz: te cura y daña a los enemigos de alrededor (x2 a no-muertos). Lo que cura de más con la vida llena se guarda como Gracia: tu siguiente Heal lo suelta como daño extra (hasta +${Zx*100}%).`:"+curación, +daño y +área.",a=>new Oj(a,I(5.5),(e,t,n)=> {
  const s=e.player,o=n.mod(e),r=Nj*(1+.08*(t-1))*e.stats.areaMult*(1+o.area),i=e.hp>=e.stats.maxHp,l=oe(e,"fountain")>0,d=1+(l?Math.round(o.count):0),c=l?Hj(e,r,i?d:d-1):[],u=[...i?[]:[ {
    x:s.x,y:s.y,on:!1
  }
  ],...c.map(v=>( {
    x:v.x,y:v.y,on:!0
  }))];if(!c.length&&!e.enemiesInRadius(s.x,s.y,r+30).length&&i)return!1;u.length||u.push( {
    x:s.x,y:s.y,on:!1
  });const h=e.buffValue("grace"),m=Zx*(1+oe(e,"graceDmg")),p=Bj*(1+.25*(t-1))*(1+o.dmg)*(1+h*m);s.cast(),ce.play("heal",.5);const g=n.eff("heal")*(1+e.stats.matk/150),y=Math.max(0,g-(e.stats.maxHp-e.hp));e.healPlayer(g),e.shareParty( {
    src:"heal",heal:g
  }),Uj(e);for(const {
    x:v,y:b,on:_
  }
  of u) {
    _?e.addFx(ys(e,v,b, {
      r:30,h:300,color:12577023,ms:450,sparks:16
    })):wu(e,s.x,s.y,()=>e.player),Qx(e,v,b,r),h>0&&oj(e,v,b,r*1.1);for(const S of e.enemiesInRadius(v,b,r))e.damageEnemy(S,p, {
      knock:60,fromX:v,fromY:b,undeadMult:2,src:n.id
    });l&&$j(e,v,b)
  }
  h>0&&(e.clearBuff("grace"),ce.play("ef_angelus",.45)),y>0&&e.addBuff("grace",Math.min(1,y/g),60,n.id);const f=e.runItems.deityLevel("heal");if(f) {
    const v=p/(1+h*m)*Yk(f);for(let b=1;b<=Wk;b++)e.schedule(b,()=> {
      const _=e.player;e.healPlayer(g*$k),Qx(e,_.x,_.y,r);for(const S of e.enemiesInRadius(_.x,_.y,r))e.damageEnemy(S,v, {
        knock:30,fromX:_.x,fromY:_.y,undeadMult:2,src:n.id,part:"Coluceo"
      })
    })
  }
  return!0
},["dmg","cd","area"]));
const yw=ee(105,.35),vw=ee(105,.25),zm=80,Tc=.1;
$e("holy_light","Holy Light","al_holylight",a=>a===1?"Columna de luz sagrada sobre los jefes a la vista y, si no hay, sobre el grupo de enemigos más grande: golpe muy potente que también alcanza a los de alrededor (x2 a no-muertos).":a%3===0?"+1 objetivo.":"+35% daño.",a=> {
  const e=new Aa(a, {
    cd:I(2.5),dmg:yw,count:xu(1,3),target:"cluster",bossFirst:!0,clusterR:(t,n)=>zm*t.stats.areaMult*(1+n.mod(t).area),range:480,splash:I(zm),splashPct:.6,delay:Tc,hit:()=>( {
      undeadMult:2,hitFx:(t,n)=>Da(t,n)
    }),fx:(t,n,s,o)=> {
      const r=zm;t.addFx(ys(t,n,s, {
        r:r*.8,h:380,color:16767351,ms:600,sparks:34
      })),t.schedule(Tc,()=>t.addFx(Ds(t,n,s,r*1.3,16774344,16760906,380)));const i=t.runItems.deityLevel("holy_light");if(i) {
        const l=yw(e.level)*(1+e.mod(t).dmg)*Xk(i),d=Math.max(60,o);t.schedule(Tc,()=>yj(t,n,s,d,Oy*1e3));for(let c=1;c*jy<=Oy;c++)t.schedule(Tc+c*jy,()=> {
          vj(t,n,s,d);for(const u of t.enemiesInRadius(n,s,d))t.damageEnemy(u,l, {
            src:a,part:"Judex",undeadMult:2,fromX:n,fromY:s
          })
        })
      }
      return null
    }
  });return e
});
const LE=58,jj=1.2;
class Gj extends Wv {
  power(e) {
    return Math.max(e.stats.powerMelee,e.stats.powerMagic)
  }
}
$e("ruwach","Ruwach","al_ruwach",a=>a===1?"Orbes de luz que giran a tu alrededor: al tocar a un enemigo estallan y dañan a todos los de alrededor, y al poco vuelven a salir (x2 a no-muertos). Escala con tu ATK o tu MATK, el mayor.":"+1 orbe y +35% daño.",a=>new Gj(a, {
  uptime:8,count:e=>1+Math.ceil(e/2),radius:84,speed:2.4,dmg:Yy,hitCd:.5,sound:"ef_ruwach",view:()=>new ue,onOrb:(e,t,n)=>_E(e,t,n),hit:()=>( {
    undeadMult:2
  }),pop: {
    radius:LE,respawn:jj,fx:(e,t,n,s)=> {
      if(bE(e,t,n,s),!e.runItems.deityLevel("ruwach"))return;let o=0;for(const r of e.enemiesInRadius(t,n,s))r.dead||(e.applyStatus(r, {
        blind:Kk
      }),o++);o&&(e.trickleHeal(Math.min(a8,o*t8)*(1+e.stats.matk/150)),n1(e,e.player.x,e.player.y))
    }
  }
}),6);
$e("decrease_agi","Decrease AGI","al_decagi",()=>`Onda que ralentiza a los enemigos de alrededor y les hace un poco de daño sagrado. Holy Light y Ruwach hacen +${ME*100}% de daño a los ralentizados.`,a=> {
  let e=0;return new xn(a, {
    halo:11061503,cd:I(5),dmg:ee(12.6,.15),radius:ee(170,.08),sound:"ef_decagility",fx:()=>null,hit:(t,n)=>( {
      slow:n.eff("slow"),hitFx:(s,o)=>e?bp(s,o):tO(s,o,!1),...e? {
        weaken:Jk(e),weakenTime:n.eff("slow")
      }
      :{}
    }),cast:(t,n)=> {
      e=t.runItems.deityLevel("decrease_agi"),uj(t,t.player.x,t.player.y,n)
    }
  })
},6);
function Vj(a,e) {
  const t=a.player;
  return a.enemiesInRadius(t.x,t.y,e+30).length? {
    x:t.x,y:t.y
  }
  :null
}
function Wj(a,e,t,n) {
  const s=a.weapons.find(h=>h.id==="holy_light"),o=s==null?void 0:s.mod(a),r=s?Math.max(1,s.targetCount(a)):1,i=h=>(h.def.boss?2e9:h.elite?1e9:0)+h.hp,l=a.enemiesInRadius(e,t,n).filter(h=>!h.dead).sort((h,m)=>i(m)-i(h)).slice(0,r);
  if(!l.length)return;
  const d=s&&o?vw(s.level)*(1+o.dmg):vw(1)*a.stats.powerMagic,c=s&&o?zm*a.stats.areaMult*(1+o.area):50*a.stats.areaMult,u=rs( {
    undeadMult:2,hitFx:(h,m)=>Da(h,m)
  },(o==null?void 0:o.hit)??{});
  for(const h of l) {
    const m=h.x,p=h.y;
    a.addFx(ys(a,m,p, {
      r:32,h:340,color:16767351,ms:520
    })),a.schedule(Tc,()=> {
      for(const g of a.enemiesInRadius(m,p,c))a.damageEnemy(g,g===h?d:d*.6, {
        ...u,src:"signum_crucis",part:"Juicio divino",fromX:m,fromY:p
      })
    })
  }
}
const zl= {
  r:170,secs:6,mark:2
};
$e("signum_crucis","Signum Crucis","al_crucis",a=>a===1?`Consagras el suelo a tu alrededor con un círculo sagrado durante ${zl.secs} s: cada segundo daña a los enemigos que están dentro y los marca. Los marcados reciben más daño de todas tus skills sagradas (x3 a no-muertos).`:"+15% daño y más duración.",a=> {
  let e=null;const t=new Tp(a, {
    cd:I(15),dmg:ee(9,.15),cells:I(1),duration:ee(zl.secs,.06),tick:1,cellRadius:zl.r,single:!0,sound:"ef_signum",at:n=>Vj(e=n,zl.r*n.stats.areaMult*(1+t.mod(n).area)),hit:(n,s)=>( {
      undeadMult:3,hitFx:(o,r)=>(e&&dj(e,o,r),null),afterHit:(o,r,i)=> {
        const l=o.runItems.deityLevel("signum_crucis");wE(o,r,s.eff("holy")+(l?Qk:0),zl.mark,l?i*Zk(l):0)
      }
    }),fx:(n,s,o,r)=>lj(n,s,o,zl.r*n.stats.areaMult*(1+t.mod(n).area),r),onTick:(n,s,o,r)=> {
      n.addFx(Ds(n,s,o,r,16773296,16760906,420)),oe(n,"divineJudgement")&&(Ps().judgeTick=!Ps().judgeTick)&&Wj(n,s,o,r)
    }
  });return t
});
Ct.start.push(()=> {
  var a;(a=Ps().spareAqua)==null||a.w.destroy(),Ps().spareAqua=null
});
Ct.tick.push((a,e)=> {
  const t=Ps().spareAqua;(t==null?void 0:t.g)===a&&t.w.tickZones(e,a)
});
function $j(a,e,t) {
  var s;
  let n=a.weapons.find(o=>o.id==="aqua_benedicta");
  n||(((s=Ps().spareAqua)==null?void 0:s.g)!==a&&(Ps().spareAqua= {
    g:a,w:va.aqua_benedicta.create()
  }),n=Ps().spareAqua.w),n.place(a,e,t)
}
const Lr= {
  r:110,tick:1,secs:6
};
$e("aqua_benedicta","Aqua Benedicta","al_holywater",a=>a===1?`Derramas agua bendita sobre el grupo de enemigos más cercano: el charco dura ${Lr.secs} s, cada segundo daña a los enemigos que lo pisan y te cura mientras estés dentro.`:"+15% daño y más duración.",a=> {
  let e=null;const t=new Tp(a, {
    cd:I(14),dmg:ee(8.1,.15),cells:I(1),duration:ee(Lr.secs,.06),tick:Lr.tick,cellRadius:Lr.r,single:!0,sound:"water_spray",on:n=> {
      e=n;const s=qj(n,Lr.r*n.stats.areaMult*(1+t.mod(n).area));return s?n.leadPoint(s,t.finalCastTime(n)):null
    },hit:()=>( {
      hitFx:(n,s)=>(e&&cj(e,n,s),null)
    }),fx:(n,s,o,r)=>pj(e=n,s,o,Lr.r*n.stats.areaMult*(1+t.mod(n).area),r),onTick:(n,s,o,r)=> {
      const i=n.player,l=t.eff("heal")*Lr.tick*(1+n.stats.matk/150)*(1+oe(n,"aquaHeal"));Qt(i.x-s,i.y-o)<=r&&n.healPlayer(l),n.shareParty( {
        src:"aqua_benedicta",heal:l,area:[Math.round(s),Math.round(o),Math.round(r)]
      })
    },onEnd:(n,s,o,r,i)=> {
      const l=n.runItems.deityLevel("aqua_benedicta");if(!l)return;const d=t.mod(n),c=Lr.r*n.stats.areaMult*(1+d.area),u=eE*(1+d.duration),h=tE+Math.max(0,Math.round(d.targets)),m=wj(n,s,o,c,u*1e3);for(let p=1;p<=u;p++)n.schedule(p,()=> {
        const g=n.player,y=t.eff("heal")*s8*(1+n.stats.matk/150);Qt(g.x-s,g.y-o)<=c*1.3&&(n.trickleHeal(y),n1(n,g.x,g.y)),n.shareParty( {
          src:"aqua_benedicta",heal:y,area:[Math.round(s),Math.round(o),Math.round(c*1.3)]
        });const f=n.enemiesInRadius(s,o,c*1.6).filter(v=>!v.dead).sort((v,b)=>Qt(v.x-s,v.y-o)-Qt(b.x-s,b.y-o)).slice(0,h);for(const v of f)Mj(n,m.top(),v.x,v.y),n.schedule(.16,()=>n.damageEnemy(v,r*aE(l), {
          ...i,src:a,part:"Epiclesis",fromX:s,fromY:o,hitFx:void 0
        }))
      })
    }
  });return t
});
const Jl=12;
function DE(a,e) {
  ce.play("ef_blessing",.5),xE(a,a.player.x,a.player.y),a.addBuff("blessing",e.eff("dmg"),Jl*e.dur(a),e.id),a.addBuff("castHaste",e.eff("cast"),Jl*e.dur(a),e.id),oe(a,"blessHaste")&&a.addBuff("haste",oe(a,"blessHaste"),Jl*e.dur(a),e.id);
  const t=a.runItems.deityLevel("blessing");
  t&&a.addBuff("regen",qx(t)*(1+a.stats.matk/150),Jl*e.dur(a),e.id);
  const n=Jl*e.dur(a),s=[["blessing",e.eff("dmg"),n],["castHaste",e.eff("cast"),n]];
  oe(a,"blessHaste")&&s.push(["haste",oe(a,"blessHaste"),n]),t&&s.push(["regen",qx(t)*(1+a.stats.matk/150),n]),a.shareParty( {
    src:"blessing",buffs:s
  })
}
qv.blessing=(a,e,t)=> {
  ce.play("ef_blessing",.35),xE(a,e,t)
};
qv.aqua_benedicta=(a,e,t)=>n1(a,e,t);
qv.heal=(a,e,t)=> {
  ce.play("heal",.35),wu(a,e,t,()=>a.player)
};
$e("blessing","Blessing","al_blessing",()=>`Te bendices durante ${Jl} s: más daño y castes más rápido.`,a=>new pt(a,I(20),(e,t,n)=>(e.player.cast(),DE(e,n),!0)),6);
Ct.hit.push((a,e,t,n)=> {
  var s;n.src!==a.basicAttack||n.part||Wt()>=oe(a,"blessProc")||DE(a,a.weapons.find(o=>o.id==="blessing")??(s=Ps()).blessingBase??(s.blessingBase=va.blessing.create()))
});
$e("holy_smite","Golpe sagrado","pr_macemastery",()=>`Mazazo bendito al enemigo más cercano: un golpe físico brutal que lo aturde un instante. Bendice tu arma por cada enemigo que golpea: tus siguientes ataques básicos hacen +${SE*100}% de daño y sueltan una onda sagrada que alcanza a los de alrededor. Requiere maza, nudillos o libro.`,a=> {
  const e=new Aa(a, {
    cd:I(5),dmg:ee(340,.3),count:I(1),target:"nearest",range:110,melee:!0,moreTargets:!0,hit:()=>( {
      knock:150,stun:.4,...Fs
    }),fx:(t,n,s)=> {
      ce.play("ef_hit2",.6,8),fj(t,n,s);const o=Math.round(e.eff("fervor")+oe(t,"fervorCharges"))+(t.runItems.deityLevel(a)?nE:0),r=Ps().smiteAt===t.time;return Ps().smiteAt=t.time,t.addChargeBuff("fervor",(r?t.buffValue("fervor"):0)+o,a),null
    }
  });return e
});
va.holy_smite.weapons=["클럽","너클","책"];
const Yy=ee(22,.35);
function Yj(a,e,t) {
  const n=a.weapons.find(l=>l.id==="ruwach"),s=n?Yy(n.level)*(1+n.mod(a).dmg):Yy(1)*Math.max(a.stats.powerMagic,a.stats.powerMelee),o=LE*a.stats.areaMult*(1+((n==null?void 0:n.mod(a).area)??0)),r=e.x,i=e.y;
  _E(a,r,i),bE(a,r,i,o);
  for(const l of a.enemiesInRadius(r,i,o))a.damageEnemy(l,s, {
    src:"holy_smite",part:t,undeadMult:2,knock:50,fromX:r,fromY:i
  })
}
AE.push((a,e)=> {
  oe(a,"lightStrike")&&Yj(a,e,"Golpe de luz")
});
wa("increase_agi","Increase AGI","al_incagi",5,()=>"+8% velocidad y +4 de Celeridad.",(a,e)=> {
  a.speedMult+=.08*e,a.haste+=.04*e
});
wa("angelus","Angelus","al_angelus",5,()=>"+2 de armadura.",(a,e)=>a.armor+=2*e);
wa("divine_protection","Divine Protection","al_dp",5,()=>"-5% de daño recibido y +20 de HP máximo.",(a,e)=> {
  a.damageReduction+=.05*e,a.maxHp+=20*e
});
wa("demon_bane","Demon Bane","al_demonbane",5,()=>"+12% de daño a jefes y no-muertos.",(a,e)=>a.bossUndeadMult+=.12*e);
$e("envenom","Envenom","tf_poison",a=>a===1?"Puñalada rápida que envenena (daño continuo).":"+20% daño y veneno.",a=>new dn(a, {
  cd:I(.5),dmg:ee(80/Bp,.2),range:I(85),hit:(e,t)=>( {
    poison:30*t.eff("poison"),hitFx:(n,s)=>Vn(n,s,$t("tex_pok1"),10,16757759,1e3,128,.5)
  }),sound:"ef_poisonattack"
}));
function Xj(a,e,t,n) {
  a.addFx(mu(a,e,t,n,By*1e3,[14270606,12884570,15259824],.35));
  for(let s=1;s*.4<=By;s++)a.schedule(s*.4,()=> {
    for(const o of a.enemiesInRadius(e,t,n))a.applyStatus(o, {
      blind:$O
    })
  })
}
const Kj=100;
$e("sand_attack","Sand Attack","tf_sprinklesand",a=>`Lanzas un puñado de arena en abanico: daña a todos los enemigos que tienes delante y los ciega ${String(Math.round((2+.3*a)*10)/10).replace(".",",")} s (deambulan sin atacar).`,a=>new dn(a, {
  cd:I(2.4),dmg:ee(14,.2),range:ee(150,.06),sound:"nj_throw",hit:(e,t)=>( {
    blind:t.eff("blind"),knock:30,sound:"ef_hit2"
  }),cone: {
    pct:1,angle:Kj,fx:(e,t,n,s,o,r)=>(e.runItems.deityLevel("sand_attack")&&Xj(e,t+ln(s)*o*.6,n+Sa(s)*o*.6,o*.5),PN(e,t,n,s,o,r))
  }
}));
$e("throw_stone","Throw Stone","tf_throwstone",a=>a===1?"Tira una piedra al enemigo más cercano: un buen golpe que lo aturde.":"+25% daño y aturdimiento más largo.",a=>new Ua(a, {
  cd:I(2.5),dmg:ee(24,.25),count:I(1),speed:560,aim:"spread",radius:11,life:1.1,spin:10,view:()=>wr("tex_stone",.8),sound:"nj_throw",hit:(e,t)=>( {
    stun:t.eff("stun"),stunChance:1,...ii,afterHit:(n,s,o)=> {
      Qj(n,s,o),n.runItems.deityLevel("throw_stone")&&FE(n,s,o,Ok,new Set([s]))
    }
  })
}));
const Jj=80;
function Qj(a,e,t) {
  const n=oe(a,"stoneShatter");
  if(n<=0)return;
  const s=Jj*a.stats.areaMult;
  ea(a,e,s,14207144,320),a.addFx(Vn(e.x,e.y,$t("tex_pok3"),10,13351064,500,s,.2));
  for(const o of a.enemiesInRadius(e.x,e.y,s))o!==e&&!o.dead&&a.damageEnemy(o,t*n, {
    src:"throw_stone",part:"Esquirlas",knock:70,fromX:e.x,fromY:e.y,...ii
  })
}
function FE(a,e,t,n,s) {
  if(n<=0)return;
  const o=a.enemiesInRadius(e.x,e.y,e8).filter(l=>!s.has(l)&&!l.dead).sort((l,d)=>Qt(l.x-e.x,l.y-e.y)-Qt(d.x-e.x,d.y-e.y))[0];
  if(!o)return;
  s.add(o);
  const[r,i]=[e.x,e.y];
  a.addFx(uk(wr("tex_stone",.8),r,i,o.x,o.y,260)),a.schedule(.26,()=> {
    if(o.dead)return;const l=t*jk;a.damageEnemy(o,l, {
      src:"throw_stone",part:"Rebote",stun:1,stunChance:1,knock:60,fromX:r,fromY:i,...ii
    }),FE(a,o,l,n-1,s)
  })
}
const qh= {
  secs:1.8,ambush:4
};
Ct.damageMult.push(a=>a.stats.ext.jobDmg??1);
Ct.damageMult.push((a,e,t)=>t.src&&dr.skills.includes(t.src)&&a.buffValue("adrenaline")>0?1+dr.dmg:1);
Ct.damageMult.push(a=>1+a.buffValue("ambush"));
const Zj="del daño al salir";
$e("hiding","Hiding","tf_hiding",()=>`Cada cierto tiempo te ocultas ${String(qh.secs).replace(".",",")} s: los enemigos no te tocan y vas más rápido. Al salir haces un 10% más de daño durante ${qh.ambush} s.`,a=> {
  const e=new pt(a,I(12),(t,n,s)=> {
    if(!t.enemiesInRadius(t.player.x,t.player.y,90).length)return!1;ce.play("ef_hiding",.5);const o=qh.secs;if(t.hidePlayer(o),t.schedule(o,()=>t.addBuff("ambush",s.eff("dmg"),qh.ambush*s.dur(t),s.id)),t.stats.hideFan>0&&t.schedule(o,()=>nG(t,t.stats.hideFan)),t.runItems.deityLevel("hiding")) {
      const r=t.player;t.addFx(mu(t,r.x,r.y,Ux*.8,1200,[10132132,13158608,6974068],.45));for(const i of t.enemiesInRadius(r.x,r.y,Ux))t.applyStatus(i, {
        blind:Gk,knock:160,fromX:r.x,fromY:r.y
      })
    }
    return!0
  });return e.durNote=Zj,e
},6);
const _w=.45,bw=10,xw=6;
function eG(a,e,t,n,s) {
  a.addFx(mu(a,e,t,n,Iy*1e3,[13147376,10514648,8015024],.32));
  for(let o=1;o*.5<=Iy;o++)a.schedule(o*.5,()=> {
    for(const r of a.enemiesInRadius(e,t,n))a.applyStatus(r, {
      src:"poison_bomb",poison:s,slow:WO,tags: {
        poison:"Nube tóxica"
      }
    })
  })
}
$e("poison_bomb","Poison Bomb","tf_poisonbomb",a=>a===1?`Lanzas un frasco de veneno contra un grupo de enemigos: al reventar los daña a todos y los envenena con fuerza durante ${xw} s.`:"+20% daño y +8% área.",a=> {
  const e=new Aa(a, {
    cd:I(11.5),dmg:ee(10,.2),count:I(1),target:"nearest",range:300,splash:ee(110,.08),splashPct:1,apart:170,delay:_w,sound:"nj_throw",hit:(t,n)=>( {
      poison:bw*n.eff("poison"),poisonTime:xw-3,knock:60
    }),fx:(t,n,s,o)=>wA(t,t.player, {
      x:n,y:s
    },_w*1e3,()=> {
      t.addFx(zN(t,n,s,o)),ce.play("ef_venomsplasher",.5,2),t.runItems.deityLevel("poison_bomb")&&eG(t,n,s,o,bw*e.eff("poison"))
    },$t("tex_poisonbottle"))
  });return e
});
const ww=420,Mw=2,Sw=.5,Aw=.5,kw=10,Ew=5,tG=.18,aG=3;
$e("shadowstep","Shadowstep","tf_shadowstep",()=>`Apareces a la espalda del enemigo más fuerte que tengas cerca y lo aturdes; durante ${Mw} s tienes un 15% más de Flee y vas un ${Sw*100}% más rápido. Tras cada salto eres inmune al daño ${String(Aw).replace(".",",")} s.`,a=>new pt(a,I(14),(e,t,n)=> {
  const s=e.player,o=e.enemiesInRadius(s.x,s.y,ww).filter(p=>!p.dead);if(!o.length)return!1;const r=o.sort((p,g)=>+!!g.def.boss-+!!p.def.boss||g.hp-p.hp)[0],i=p=> {
    const g=Qt(p.x-s.x,p.y-s.y)||1,y=34;let[f,v]=[p.x+(p.x-s.x)/g*y,p.y+(p.y-s.y)/g*y];e.walk&&([f,v]=e.walk.nearestWalkable(f,v));const b= {
      x:s.x,y:s.y
    };return[s.x,s.y]=[f,v],Gn(e,p.x,p.y),e.addFx(MA(e,b, {
      x:f,y:v
    })),ce.play("ef_hiding",.5),p.stunUntil=Math.max(p.stunUntil,e.time+n.eff("stun")*(p.def.boss?.5:1)),e.addBuff("immune",1,Aw,n.id), {
      x:f,y:v
    }
  },l=e.runItems.deityLevel("shadowstep"),d=(p,g)=> {
    if(!l)return;ea(e, {
      x:p,y:g
    },b0,9071288,450),e.addFx(mu(e,p,g,b0*.7,700,[2759226,4863080,9071288],.4));const y=Vk(l)*(1+n.mod(e).dmg);for(const f of e.enemiesInRadius(p,g,b0))e.damageEnemy(f,y, {
      src:n.id,part:"Danza de sombras",stun:1,stunChance:1,knock:90,fromX:p,fromY:g,numColor:13150463
    })
  }, {
    x:c,y:u
  }
  =i(r),h=Mw*n.dur(e);e.addBuff("flee",n.eff("flee"),h,n.id),e.addBuff("speed",Sw,h,n.id),e.stats.stepDmg>0&&e.addBuff("damage",e.stats.stepDmg,h,n.id),e.stats.stepPickup>0&&e.addBuff("pickup",e.stats.stepPickup,h,n.id),oe(e,"stepLifesteal")>0&&e.addBuff("lifesteal",oe(e,"stepLifesteal"),1,n.id),d(c,u);const m=e.stats.stepChain;if(m>0) {
    const p=e.weapons.find(v=>ku(v.id)),g=(v,b)=> {
      p&&!v.dead&&p.fireBoosted(e, {
        kind:"enemy",e:v,all:[v],only:!0
      },kw+Ew*b),p&&b===m&&e.addBuff("shadowBasic",kw+Ew*b,aG,n.id)
    };g(r,0);const y=new Set([r]);let f=r;for(let v=1;v<=m;v++)e.schedule(v*tG,()=> {
      if(s.dead)return;const _=e.enemiesInRadius(s.x,s.y,ww).filter(M=>!M.dead&&!y.has(M)).sort((M,k)=>+!!k.def.boss-+!!M.def.boss||k.hp-M.hp)[0]??(f.dead?void 0:f);if(!_)return;y.add(_),f=_;const S=i(_);g(_,v),d(S.x,S.y)
    })
  }
  return!0
}),6);
function IE(a,e,t,n,s) {
  const o=kt("str_dkb1",e,t,n/110,0);
  return o instanceof Bv&&a.addFx(o.only([8])),DN(a,e,t,n,s)
}
const BE=2,NE=.3;
$e("fan_of_knives","Fan of Knives","tf_fanofknives",a=>a===1?"Lanzas dos abanicos de cuchillos seguidos a tu alrededor que golpean a todos los enemigos cercanos.":"+20% daño y +10% área.",a=>new xn(a, {
  halo:14674175,cd:I(5),dmg:ee(20,.2),radius:ee(140,.1),ticks:I(BE),interval:NE,sound:"ef_dancingknife",hit:()=>( {
    knock:70,sound:"hit_sword",hitFx:(e,t)=>kt("str_dkhit",e,t,.35,0)
  }),fx:(e,t,n,s)=>IE(e,t,n,s,12)
}));
function nG(a,e) {
  var l;
  const t=a.player;
  if(t.dead)return;
  const n=a.weapons.find(d=>d.id==="fan_of_knives")??(l=Ps()).looseFan??(l.looseFan=va.fan_of_knives.create()),s=n.mod(a),o=ee(140,.1)(n.level)*a.stats.areaMult*(1+s.area),r=ee(20,.2)(n.level)*(1+s.dmg)*e,i=BE+Math.max(0,Math.round(s.count));
  ce.play("ef_dancingknife",.5,2);
  for(let d=0;d<i;d++)a.schedule(d*NE,()=> {
    if(!t.dead) {
      ea(a,t,o,14674175),a.addFx(IE(a,t.x,t.y,o,20));for(const c of a.enemiesInRadius(t.x,t.y,o))a.damageEnemy(c,r, {
        ...s.hit,src:"fan_of_knives",part:"Salida de las sombras",knock:90,fromX:t.x,fromY:t.y,sound:"hit_sword"
      })
    }
  })
}
$e("caltrops","Caltrops","tf_caltrops",a=>a===1?"Siembras una hilera de abrojos entre tú y los enemigos: los que la pisan reciben daño y van más lentos.":"+1 abrojo, +15% daño y más duración.",a=>new Tp(a, {
  cd:I(9),dmg:ee(6,.15),cells:e=>4+Math.floor(e/2),duration:e=>4+.3*e,tick:.5,cellRadius:28,fx:(e,t,n,s)=>IN(e,t,n,s),hit:()=>( {
    slow:.6,knock:0
  }),sound:"ef_trapon"
}));
wa("double_attack","Double Attack","tf_double",5,()=>"+5% de doble casteo.",(a,e)=>a.doubleChance+=.05*e);
wa("improve_dodge","Improve Dodge","tf_miss",5,()=>"+4% de Flee y +3% de velocidad.",(a,e)=> {
  a.flee+=.04*e,a.speedMult+=.03*e
});
wa("steal","Steal","tf_steal",5,()=>"+6% de probabilidad de que un monstruo suelte EXP extra.",(a,e)=>a.extraGemChance+=.06*e);
const A0= {
  dmg:.35,splash:.5,meters:3
};
function sG(a,e,t) {
  if(!(e.zenyMarkUntil<=a.time||!a.runItems.deityLevel("mammonite"))) {
    for(const n of a.enemiesInRadius(e.x,e.y,Dx))n!==e&&a.damageEnemy(n,t*xk, {
      src:"mammonite",part:"Golpe de fortuna",knock:120,fromX:e.x,fromY:e.y,numColor:16765802
    });
    a.addFx(_A(a,e.x,e.y,Dx)),ce.play("ef_coin",.5,3)
  }
}
$e("mammonite","Mammonite","mc_mammonite",a=>a===1?"Golpe de zeny muy potente al enemigo cercano.":"+15% daño.",a=>new Aa(a, {
  cd:I(4.5),dmg:ee(150,.15),count:I(1),target:"nearest",range:120,melee:!0,fx:(e,t,n)=>(ce.play("ef_hit2",.6,8),e.schedule(.03,()=>ce.play("ef_coin2",.7,8)),kt("str_maemor",t,n,.9,0)),hit:()=>( {
    knock:140,afterHit:sG
  }),boost:(e,t)=> {
    const n=t.mod(e).hit.zenyCost??0;if(n<=0)return null;if(!e.endless) {
      if(e.zeny<n)return null;e.zeny-=n
    }
    return e.addFx(Rp(e.player.x,e.player.y)), {
      dmg:A0.dmg,splash:A0.splash,splashM:A0.meters
    }
  }
}));
const Cw=.4;
$e("cart_revolution","Cart Revolution","mc_cartrevolution",a=>a===1?"Estrellas el carro contra un enemigo: golpea y lanza lejos a todos los que tiene alrededor.":"+20% daño y +8% área.",a=> {
  const e=new Aa(a, {
    cd:I(11),dmg:ee(42,.2),count:I(1),target:"nearest",range:260,splash:ee(75,.08),splashPct:1,apart:170,delay:Cw,hit:()=>( {
      knock:340
    }),fx:(t,n,s,o)=>gA(t,t.player, {
      x:n,y:s
    },Cw*1e3,()=> {
      const r=kt("str_cartrevolution",n,s,1,0);r&&t.addFx(r),t.addFx(vr(t,n,s,o)),t.shake(.14,4),ce.play("ef_magnumbreak",.45,2),t.runItems.deityLevel("cart_revolution")&&UE(t,e,n,s,o,wk,new Set(t.enemiesInRadius(n,s,o)))
    })
  });return e
});
function UE(a,e,t,n,s,o,r) {
  if(o<=0)return;
  const i=a.enemiesInRadius(t,n,HO).filter(d=>!r.has(d)).sort((d,c)=>Qt(d.x-t,d.y-n)-Qt(c.x-t,c.y-n))[0];
  if(!i)return;
  const l= {
    x:i.x,y:i.y
  };
  a.addFx(gA(a, {
    x:t,y:n
  },l,300,()=> {
    const d=s*.75,c=ee(60,.2)(e.level)*(1+e.mod(a).dmg)*Mk;for(const h of a.enemiesInRadius(l.x,l.y,d))r.add(h),a.damageEnemy(h,c, {
      src:"cart_revolution",part:"Rebote",knock:260,fromX:l.x,fromY:l.y
    });const u=kt("str_cartrevolution",l.x,l.y,.8,0);u&&a.addFx(u),a.addFx(vr(a,l.x,l.y,d)),a.addFx(_A(a,l.x,l.y,d*.8,6)),ce.play("ef_magnumbreak",.35,2),UE(a,e,l.x,l.y,s,o-1,r)
  },!0,60))
}
const Tw=3;
$e("crazy_uproar","Crazy Uproar","mc_loud",(a,e)=>`Grito de guerra: tus ${Tw+((e==null?void 0:e.count)??0)} siguientes skills alcanzan a 1 enemigo más.`,a=>new pt(a,I(14),(e,t,n)=> {
  if(!e.nearestEnemy(400))return!1;ce.play("mc_loud",.5),e.player.cast();const s=xa(kt("str_loud",e.player.x,e.player.y,1,0),e.player);s&&e.addFx(s);const o=e.runItems.deityLevel("crazy_uproar");return e.addChargeBuff("targets",Tw+n.mod(e).count+(o?1:0),n.id),e.chargeDmg=o?Ek(o):0,o&&(fA(e,e.player,170,!0),e.addFx(xA(e,16734762,6e4,()=>e.buffValue("targets")>0))),!0
},["cd"]),5);
wa("overcharge","Overcharge","mc_overcharge",5,()=>"+8% de EXP.",(a,e)=>a.expMult+=.08*e);
wa("discount","Discount","mc_discount",5,()=>"+25% curación de la carne y +30% de carne.",(a,e)=> {
  a.potionMult+=.25*e,a.potionDropMult+=.3*e
});
const Ll= {
  reduction:.8,slow:.8,seconds:4,radius:190,knock:420
},oG=30,rG=650;
$e("enlarge_weight","Enlarge Weight Limit","mc_inccarry",()=>"Al bajar del 20% de vida plantas el carro: empujas a los de alrededor y recibes -80% de daño durante 4 s, pero te mueves un 80% más lento.",a=> {
  const e=new pt(a,I(50),(t,n,s)=> {
    const o=t.player,r=Ll.seconds*s.dur(t);ce.play("ef_magnumbreak",.5,2),ce.play("ef_beginspell",.4),o.cast(),t.shake(.2,6);const i=t.enemiesInRadius(o.x,o.y,Ll.radius);for(const c of i)t.applyStatus(c, {
      knock:Ll.knock,fromX:o.x,fromY:o.y
    });t.addFx(MN(t,o,Ll.radius,i));const l=xa(UN("str_guardstance",o.x,o.y,oG,r*1e3-rG),o);l&&t.addFx(l),t.addBuff("brace",Ll.reduction,r,s.id),t.addBuff("slow",Ll.slow,r,s.id);const d=t.runItems.deityLevel("enlarge_weight");return d&&(t.healPlayer(t.stats.maxHp*Ck(d)),t.addFx(xA(t,16762960,r*1e3)),wu(t,o.x,o.y,()=>o)),!0
  });return e.lowHp=.2,e
},6);
const iG=10,Dr= {
  radius:110,pulses:3,interval:.55,delay:.3
};
$e("zeny_rain","Zeny Rain","mc_zenyrain",a=>a===1?`Haces llover zeny sobre una zona: ${Dr.pulses} pulsos que aturden 1,2 s y, durante 10 s, hacen que Mammonite pegue +50% a los tocados. A los jefes no los aturde: durante ese tiempo reciben un 30% más de daño de todo.`:"+20% daño.",a=> {
  const e=n=>Dr.radius*n.stats.areaMult*(1+t.mod(n).area*.5),t=new fo(a, {
    cd:I(9),dmg:ee(8,.2),ticks:I(Dr.pulses),interval:Dr.interval,area:I(0),tickRadius:Dr.radius,scatter:!1,delay:Dr.delay,hit:()=>( {
      stun:1.2,zenyMark:iG
    }),sound:"ef_coin2",tickSound:"ef_coin",fxStart:(n,s,o,r,i,l)=> {
      const d=Dr.pulses+t.mod(n).count;return EN(n,r,i,e(n),(l+d*Dr.interval)*1e3,n.runItems.deityLevel("zeny_rain")>0)
    },fxTick:(n,s,o,r)=>CN(n,s,o,r,n.runItems.deityLevel("zeny_rain")>0)
  });return t.countUnit=()=>"pulso",t
});
const Si= {
  dmg:30,dist:230,ms:260,width:40,knock:300,range:260
};
$e("cart_rush","Cart Rush","mc_cartrush",a=>a===1?"Cargas con el carro hacia donde vas: arrollas a los que pillas y los apartas a los lados para abrirte paso.":"+20% daño.",a=>new pt(a,I(9),(e,t,n)=> {
  const s=e.player;if(!e.nearestEnemy(Si.range))return!1;const o=Qt(s.facingX,s.facingY)||1,r= {
    x:s.facingX/o,y:s.facingY/o
  },i=n.mod(e),l=ee(Si.dmg,.2)(t)*(1+i.dmg),d=Si.dist*(1+i.reach),c=e.bounds,u=new Set;let h=0;const m=e.runItems.deityLevel("cart_rush")>0,p=[];return s.rush(Si.ms),ce.play("ef_magnumbreak",.35,2),e.addFx(SN(e,r,Si.ms,g=> {
    const y=d*(1-(1-g)*(1-g)),f=y-h;h=y;const v=Math.min(c.x1,Math.max(c.x0,s.x+r.x*f)),b=Math.min(c.y1,Math.max(c.y0,s.y+r.y*f));[s.x,s.y]=e.walk?e.walk.resolve(s.x,s.y,v,b):[v,b],s.facingX=r.x,s.facingY=r.y;const _=[];for(const S of e.enemiesInRadius(s.x+r.x*20,s.y+r.y*20,Si.width)) {
      if(u.has(S))continue;u.add(S);const M=Math.sign(r.x*(S.y-s.y)-r.y*(S.x-s.x))||(Wt()<.5?-1:1),k=-r.y*M,C=r.x*M;e.damageEnemy(S,l, {
        ...i.hit,knock:Si.knock+(i.hit.knock??0),fromX:S.x-k*10,fromY:S.y-C*10
      }),_.push( {
        e:S,ux:k,uy:C
      })
    }
    if(_.length&&ce.play("ef_hit2",.4,3),m) {
      const S=p[p.length-1];(!S||Qt(S.x-s.x,S.y-s.y)>22)&&p.push( {
        x:s.x,y:s.y
      }),g>=1&&lG(e,l,r,p)
    }
    return _
  },m)),!0
},["dmg","cd","reach"]));
function lG(a,e,t,n) {
  const s=a.player,o=s.x+t.x*34,r=s.y+t.y*34;
  for(const d of a.enemiesInRadius(o,r,Fx))a.damageEnemy(d,e*Sk, {
    src:"cart_rush",part:"Estampida",knock:280,fromX:o,fromY:r
  });
  const i=kt("str_cartrevolution",o,r,.9,0);
  i&&a.addFx(i),a.addFx(vr(a,o,r,Fx)),a.shake(.16,5),ce.play("ef_magnumbreak",.45,2);
  const l=[...n];
  a.addFx(bA(a,l,Ak*1e3,()=> {
    for(const d of l)for(const c of a.enemiesInRadius(d.x,d.y,34))c.def.boss||(c.slowUntil=Math.max(c.slowUntil,a.time+.25))
  }))
}
const Fr= {
  dmg:85,seconds:2,lure:280,radius:130,knock:260
},dG=90;
$e("vending","Vending","mc_vending",a=>a===1?"Plantas una máquina expendedora: los enemigos cercanos van a por ella durante 2 s y luego revienta en una lluvia de zeny que daña a los de alrededor.":"+20% daño y +8% área.",a=>new pt(a,I(18),(e,t,n)=> {
  const s=e.player;if(!e.enemiesInRadius(s.x,s.y,Fr.lure*(1+n.mod(e).area)).length)return!1;const o=s.x,r=s.y;s.cast(),ce.play("ef_coin2",.5,2);let i=0;const l=e.runItems.deityLevel("vending")? {
    onHit:()=> {
      if(e.time<i)return;i=e.time+jO;const d=e.enemiesInRadius(o,r,220),c=d[Math.floor(Wt()*d.length)];if(!c)return;const u=Nn(c.y-r,c.x-o)+(Wt()-.5)*.6,h=Math.max(dG+Wt()*50,Qt(c.x-o,c.y-r)),m= {
        x:o+ln(u)*h,y:r+Sa(u)*h
      };ce.play("ef_coin",.3,3),e.addFx(kN(e, {
        x:o,y:r
      },m,()=> {
        const p=n.mod(e),g=ee(Fr.dmg,.2)(t)*(1+p.dmg)*kk;for(const y of e.enemiesInRadius(m.x,m.y,Ix))e.damageEnemy(y,g, {
          src:"vending",part:"Cápsula",knock:120,fromX:m.x,fromY:m.y
        });e.addFx(vr(e,m.x,m.y,Ix)),ce.play("ef_hit2",.3,3)
      },()=>ce.play("ef_coin",.15,4)))
    }
  }
  :void 0;return n.cdExtra=Fr.seconds*n.dur(e),e.addFx(AN(e,o,r,Fr.lure*(1+n.mod(e).area),Fr.seconds*1e3*n.dur(e),()=> {
    const d=n.mod(e),c=ee(Fr.radius,.08)(t)*e.stats.areaMult*(1+d.area),u=ee(Fr.dmg,.2)(t)*(1+d.dmg);for(const m of e.enemiesInRadius(o,r,c))e.damageEnemy(m,u, {
      ...d.hit,knock:Fr.knock,fromX:o,fromY:r
    });const h=kt("str_cartrevolution",o,r,1.2,0);h&&e.addFx(h),e.addFx(vr(e,o,r,c));for(let m=0;m<4;m++)e.addFx(Rp(o+($s()-.5)*50,r+($s()-.5)*30));e.shake(.18,5),ce.play("ef_magnumbreak",.5,2),ce.play("ef_coin2",.6,2)
  },l)),!0
},["dmg","cd","area","duration"]));
wa("pushcart","Pushcart","mc_pushcart",5,()=>"+5% de daño y +15 de HP máximo.",(a,e)=> {
  a.damageMult+=.05*e,a.maxHp+=15*e
});
$e("tornado_kick","Tornado Kick","tk_stormkick",a=>a===1?"Patada giratoria que golpea y repele a tu alrededor.":"+20% daño y +10% área.",a=>new xn(a, {
  halo:14741759,cd:I(2.2),dmg:ee(24,.2),radius:ee(105,.1),hit:()=>( {
    knock:220,...Od
  }),fx:(e,t,n,s)=>(sO(e,t,n,s),null)
}));
$e("heel_drop","Heel Drop","tk_downkick",a=>`Talonazo al enemigo cercano que lo aturde ${(1+.15*a).toFixed(1).replace(".",",")} s.`,a=>new Aa(a, {
  cd:I(2.6),dmg:ee(30,.2),count:I(1),target:"nearest",range:140,melee:!0,hit:(e,t)=>( {
    stun:t.eff("stun"),stunChance:1,...Od
  }),fx:()=>null
}));
$e("roundhouse","Roundhouse","tk_turnkick",a=>a===1?"Patada circular que golpea y lanza a los de alrededor.":"+20% daño y +10% área.",a=>new xn(a, {
  halo:16773328,cd:I(1.8),dmg:ee(22,.2),radius:ee(95,.1),hit:()=>( {
    knock:280,...Od
  }),fx:()=>null
}));
$e("counter_kick","Counter Kick","tk_counter",a=>`Al recibir un golpe contraatacas (cada ${Math.max(1,4-.4*a).toFixed(1).replace(".",",")} s) con daño en área.`,a=>new ck(a, {
  cd:e=>Math.max(1,4-.4*e),dmg:ee(35,.25),radius:ee(90,.08),sound:"hit_fist2",fx:(e,t,n)=> {
    for(const s of["str_counter_bottom","str_counter"]) {
      const o=kt(s,t,n,1,0);o&&e.addFx(o)
    }
  }
}),6);
$e("sprint","Sprint","tk_run",a=>`Echas a correr: +${30+5*a}% de velocidad durante 5 s.`,a=>new pt(a,I(12),(e,t,n)=>e.nearestEnemy(400)?(ce.play("ef_incagility",.45),e.addFx(xa(kt("str_dust",e.player.x,e.player.y,.8,0),e.player)),e.addBuff("speed",n.eff("speed"),5*n.dur(e),n.id),!0):!1),6);
wa("peaceful_break","Peaceful Break","tk_hptime",5,()=>"+2 HP por segundo mientras estás quieto.",(a,e)=>a.regenStill+=2*e);
wa("kihop","Kihop","tk_power",5,()=>"+6% de daño.",(a,e)=>a.damageMult+=.06*e);
wa("mild_wind","Mild Wind","tk_sevenwind",5,()=>"+7% de área y +2% de crítico.",(a,e)=> {
  a.areaMult+=.07*e,a.critChance+=.02*e
});
$e("shuriken","Throw Shuriken","nj_syuriken",a=>a===1?"Shurikens que perforan.":a%2===1?"+1 shuriken.":"+25% daño.",a=>new Ua(a, {
  cd:I(.8),dmg:e=>13*(1+.25*Math.floor(e/2)),count:xu(1,2),speed:540,aim:"each",stagger:.06,pierce:e=>1+Math.floor(e/4),spin:18,radius:12,view:()=>wr("tex_shuriken",1),sound:"nj_throw",hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  })
}));
$e("kunai","Throw Kunai","nj_kunai",a=>a===1?"Abanico de kunais muy rápidos.":a%2===0?"+1 kunai.":"+20% daño.",a=>new Ua(a, {
  cd:I(1.2),dmg:e=>11*(1+.2*Math.ceil((e-1)/2)),count:e=>3+Math.floor(e/2),speed:760,aim:"spread",spread:.13,radius:10,life:.9,view:()=>wr("tex_kunai",1),orient:Math.PI/4,sound:"nj_throw",hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  })
}));
$e("huuma","Throw Huuma Shuriken","nj_huuma",a=>a===1?"Shuriken gigante que va y vuelve atravesándolo todo.":"+20% daño.",a=>new Ua(a, {
  cd:I(3),dmg:ee(26,.2),count:I(1),speed:380,aim:"spread",pierce:I(99),returns:!0,spin:14,radius:28,life:1.8,view:()=>wr("tex_huuma",2.4),sound:"nj_throw",hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  })
}));
$e("flaming_petals","Flaming Petals","nj_kouenka",a=>a===1?"Pétalos de fuego que caen sobre un grupo.":"+1 pétalo y +15% daño.",a=>new fo(a, {
  cd:I(2.8),dmg:ee(16,.15),ticks:e=>3+e,interval:.1,area:ee(80,.06),tickRadius:34,fxTick:(e,t,n)=>(hk(["ef_firearrow","ef_firearrow2","ef_firearrow3"],.3),kt("str_firehit",t,n,.8,0))
}));
$e("lightning_strike","Lightning Strike","nj_raigekisai",a=>a===1?"Descarga eléctrica a tu alrededor.":"+20% daño y +10% área.",a=>new xn(a, {
  halo:11065599,cd:I(4),dmg:ee(26,.2),radius:ee(130,.1),sound:"ef_thunderstorm",fx:(e,t,n,s)=>kt("str_setsudan",t,n,s/130,0)
}));
wa("dagger_throwing","Dagger Throwing Practice","nj_tobidougu",5,()=>"+8% de daño y +6% velocidad de proyectiles.",(a,e)=> {
  a.damageMult+=.08*e,a.projSpeedMult+=.06*e
});
wa("cicada","Cicada Skin Shed","nj_utsusemi",5,()=>"+5% de Flee.",(a,e)=>a.flee+=.05*e);
wa("ninja_soul","Soul","nj_nen",5,()=>"+10% de daño, -5 HP máximo.",(a,e)=> {
  a.damageMult+=.1*e,a.maxHp-=5*e
});
$e("triple_action","Triple Action","gs_tripleaction",a=>a===1?"Tres disparos en abanico.":a%2===1?"+1 bala.":"+25% daño.",a=>new Ua(a, {
  cd:I(1),dmg:e=>12*(1+.25*Math.floor(e/2)),count:xu(3,2),speed:800,aim:"spread",spread:.14,radius:9,life:.9,view:e=>Xv(e),sound:"gs_tripleaction",castFx:(e,t,n)=>Ud("fx_tripleaction",t,n)
}));
$e("rapid_shower","Rapid Shower","gs_rapidshower",a=>a===1?"Ráfaga de balas contra el enemigo más cercano.":"+1 bala y +10% daño.",a=>new Ua(a, {
  cd:I(1.6),dmg:ee(10,.1),count:e=>4+e,speed:850,aim:"spread",spread:.03,stagger:.05,radius:9,life:.9,view:e=>Xv(e),sound:"gs_rapidshower",castFx:(e,t,n)=>Ud("fx_rapidshower",t,n)
}));
$e("spread_attack","Spread Attack","gs_spreadattack",a=>a===1?"Escopetazo que alcanza a todos a tu alrededor.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:16770728,cd:I(1.8),dmg:ee(26,.2),radius:ee(120,.08),hit:()=>( {
    knock:200
  }),sound:"gunfire",fx:(e,t,n)=>Ud("fx_spread",t,n)
}));
$e("desperado","Desperado","gs_desperado",a=>a===1?"Disparas en todas direcciones a tu alrededor.":"+1 ráfaga y +15% daño.",a=>new xn(a, {
  halo:16770728,cd:I(4.5),dmg:ee(9,.15),radius:ee(140,.06),ticks:e=>3+Math.ceil(e/2),interval:.14,sound:"gs_desperado",fx:(e,t,n)=>Ud("fx_desperado",t,n)
}));
$e("ground_drift","Ground Drift","gs_grounddrift",a=>a===1?"Granada que explota sobre un grupo.":"+20% daño y +10% área.",a=>new fo(a, {
  cd:I(3.2),dmg:ee(34,.2),ticks:I(1),interval:0,area:I(0),tickRadius:75,delay:.5,scatter:!1,hit:()=>( {
    knock:220,...ii
  }),sound:"gunfire",fxStart:(e,t,n,s,o,r)=>uk(Pp("fx_grounddrift",1.4,!1),t,n,s,o,r*1e3),fxTick:()=>null
}));
$e("tracking","Tracking","gs_tracking",a=>a===1?"Disparo certero al enemigo más fuerte a la vista.":"+25% daño.",a=>new Aa(a, {
  cd:I(3.5),dmg:ee(70,.25),count:I(1),target:"strongest",sound:"gunfire",hit:()=>( {
    hitFx:(e,t)=>Ud("fx_tracking",e,t, {
      lift:30
    })
  }),fx:e=>xa(kt("str_tracking",e.player.x,e.player.y,1,0),e.player)
}));
wa("single_action","Single Action","gs_singleaction",5,()=>"+6% de daño y +3% de crítico.",(a,e)=> {
  a.damageMult+=.06*e,a.critChance+=.03*e
});
wa("snake_eye","Snake Eye","gs_snakeeye",5,()=>"+10% velocidad de proyectiles y +6% de área.",(a,e)=> {
  a.projSpeedMult+=.1*e,a.areaMult+=.06*e
});
wa("chain_action","Chain Action","gs_chainaction",5,()=>"+5% de doble casteo.",(a,e)=>a.doubleChance+=.05*e);
wa("madness_canceller","Madness Canceller","gs_madnesscancel",5,()=>"+6 de Celeridad.",(a,e)=>a.haste+=.06*e);
function wn(a,e,t,n) {
  Np( {
    id:a,name:e,icon:"",kind:"weapon",maxLevel:10,desc:()=>t,type:np(a),tags:ap(a),create:()=> {
      const s=n(a);return s.type=np(a),s.tags=ap(a),s.element=s1(s.tags),s
    }
  })
}
const cG=1;
wn("atk_bow","Ataque: Arco","Dispara una flecha al enemigo más cercano.",a=> {
  const e=new Ua(a, {
    cd:I(.75),dmg:I(13),count:I(1),speed:700,aim:"spread",radius:10,life:1.1,view:()=>new ue,model:(t,n)=>new J8(t,n),orient:null,hitSound:"hit_arrow",hit:()=>( {
      hitFx:(t,n)=>Da(t,n)
    })
  });return e.basicExp=cG,e
});
wn("atk_gun","Ataque: Arma de fuego","Dispara una bala al enemigo más cercano.",a=>new Ua(a, {
  cd:I(.6),dmg:I(10),count:I(1),speed:850,aim:"spread",radius:9,life:.9,view:e=>Xv(e),sound:"gunfire"
}));
wn("atk_shuriken","Ataque: Huuma","Lanza un shuriken que atraviesa a un enemigo.",a=>new Ua(a, {
  cd:I(.85),dmg:I(12),count:I(1),speed:560,aim:"spread",pierce:I(1),spin:18,radius:12,view:()=>wr("tex_shuriken",1.2),sound:"nj_throw",hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  })
}));
wn("atk_rod","Ataque: Báculo","Proyectil mágico hacia el enemigo más cercano.",a=>new Ua(a, {
  cd:I(.85),dmg:I(12),count:I(1),speed:520,aim:"each",radius:10,life:1.4,view:()=>zp(10473727,16777215,6),orient:null,hitSound:"ef_firehit"
}));
const uG=2,Pw= {
  fire:"firebolt",water:"coldbolt",wind:"lightning"
},qE=.75,hG=.2,mG=2,pG="atk_infused",fG= {
  fire:"so_fire_insignia",water:"so_water_insignia",wind:"so_wind_insignia"
};
function gG(a,e) {
  const t=e.includes("fire")?li:e.includes("wind")?Au: {
    sound:"ef_frostdiver2"
  };
  return {
    ...t,hitFx:(n,s)=>(a.addFx(nU(a,e,n,s)),"hitFx"in t&&t.hitFx?t.hitFx(n,s):r1())
  }
}
function yG(a,e) {
  const t=e.includes("fire")?li:e.includes("wind")?Au: {
    sound:"ef_frostdiver2"
  };
  return {
    ..."sound"in t? {
      sound:t.sound
    }
    : {
      sounds:t.sounds
    },hitFx:(n,s)=>(dU(a,e,n,s),r1())
  }
}
const r1=()=>( {
  view:new ue,update:()=>!0
});
class vG extends Ua {
  constructor() {
    super(...arguments);
    x(this,"game",null);
    x(this,"els",["fire"])
  }
  fire(t,n) {
    this.game=t;
    const s=Zm(t.stats);
    return s.length&&(this.els=s),this.element=this.els[0],super.fire(t,n)
  }
  mod(t) {
    const n=super.mod(t),s=Zm(t.stats),o=1+qE*s.length;
    return {
      ...n,dmg:(1+n.dmg)*o-1,targets:n.targets+(s.includes("fire")?1:0),pierce:n.pierce+(s.includes("water")?hG:0),count:n.count+(s.includes("wind")?mG:0)
    }
  }
}
wn("atk_infused","Ataque: Infusión elemental","Proyectil mágico del elemento infusionado (+75% de daño; fuego +1 objetivo, hielo +20% de perforación, rayo +2 proyectiles); con varias infusiones, las combina en un solo disparo con todo y más daño (+150% con dos, +225% con tres).",a=> {
  const e=new vG(a, {
    cd:I(.85),dmg:I(12),count:I(1),speed:560,aim:"each",radius:10,life:1.4,orient:null,view:()=>new ue,model:t=>aU(t,e.els),hitFx:r1,hit:()=>e.game?gG(e.game,e.els):{}
  });return e
});
const HE="atk_infused_melee",R9=a=>a===pG||a===HE,Rw= {
  atk_dagger: {
    cd:.45,dmg:9,range:75,sound:"attack_dagger"
  },atk_fist: {
    cd:.55,dmg:11,range:70
  },atk_blunt: {
    cd:1,dmg:18.8,range:85,sound:"ef_hit2"
  }
},zw= {
  angle:90,pct:1
},_G=.25,bG=.1;
class OE extends dn {
  constructor() {
    super(...arguments);
    x(this,"game",null);
    x(this,"els",["fire"]);
    x(this,"base","atk_dagger")
  }
  fire(t,n) {
    this.game=t;
    const s=Zm(t.stats);
    return s.length&&(this.els=s),this.element=this.els[0],super.fire(t,n)
  }
  mod(t) {
    const n=super.mod(t),s=Zm(t.stats),o=1+qE*s.length;
    return {
      ...n,dmg:(1+n.dmg)*o-1,targets:n.targets+(s.includes("fire")?1:0),reach:n.reach+(s.includes("water")?_G:0),double:n.double+(s.includes("wind")?bG:0)
    }
  }
}
wn(HE,"Ataque: Infusión elemental (cuerpo a cuerpo)","Tajo mágico del elemento infusionado que barre en cono a los que tienes delante (+75% de daño; fuego +1 objetivo, hielo +25% de alcance, rayo +10% de doble casteo); con varias infusiones, las combina con más daño (+150% con dos, +225% con tres).",a=> {
  const e=()=>Rw[t.base]??Rw.atk_dagger,t=new OE(a, {
    cd:()=>e().cd,dmg:()=>e().dmg,range:()=>e().range,hit:()=>t.game?yG(t.game,t.els):{},cone: {
      pct:zw.pct,angle:zw.angle,fx:(n,s,o,r,i,l)=>lU(n,t.els,s,o,r,i,l)
    }
  });return t
});
function z9(a,e) {
  a instanceof OE&&(a.base=e)
}
wn("atk_sword","Ataque: Espada","Tajo al enemigo más cercano.",a=>new dn(a, {
  cd:I(.98),dmg:I(18.4),range:I(90),sound:"hit_sword",hit:()=>Fs
}));
wn("atk_twohand","Ataque: Espada a dos manos","Tajo lento y muy potente.",a=>new dn(a, {
  cd:I(1.6),dmg:I(37.6),range:I(110),hit:()=>Fs,sound:"hit_sword"
}));
wn("atk_axe","Ataque: Hacha","Hachazo pesado que empuja al enemigo.",a=>new dn(a, {
  cd:I(1.27),dmg:I(25),range:I(90),hit:()=>( {
    knock:100,...Fs
  }),sound:"ef_hit2"
}));
wn("atk_axe2","Ataque: Hacha a dos manos","Hachazo lento y brutal que empuja al enemigo.",a=>new dn(a, {
  cd:I(1.9),dmg:I(46.8),range:I(115),hit:()=>( {
    knock:140,...Fs
  }),sound:"hit_sword"
}));
wn("atk_spear","Ataque: Lanza","Estocada larga al enemigo más cercano.",a=>new dn(a, {
  cd:I(1.12),dmg:I(19.6),range:I(130),sound:"hit_sword",hit:()=>Fs
}));
wn("atk_lance","Ataque: Lanza a dos manos","Estocada larga y muy potente.",a=>new dn(a, {
  cd:I(1.75),dmg:I(38.3),range:I(145),hit:()=>Fs,sound:"hit_sword"
}));
wn("atk_dagger","Ataque: Daga","Puñaladas muy rápidas al enemigo más cercano.",a=>new dn(a, {
  cd:I(.45),dmg:I(9),range:I(75),sound:"attack_dagger",hit:()=>Fs
}));
wn("atk_blunt","Ataque: Maza","Golpe contundente que empuja.",a=>new dn(a, {
  cd:I(1),dmg:I(18.8),range:I(85),hit:()=>( {
    knock:90,...Fs
  }),sound:"ef_hit2"
}));
wn("atk_fist","Ataque: Puños","Golpes y patadas rápidos a corta distancia.",a=>new dn(a, {
  cd:I(.55),dmg:I(11),range:I(70),hit:()=>Od
}));
wn("atk_katar","Ataque: Katar","Dos cuchillas a la vez: golpes rápidos al enemigo más cercano.",a=>new dn(a, {
  cd:I(.62),dmg:I(13.2),range:I(80),sound:"attack_dagger",hit:()=>Fs
}));
wn("atk_knuckle","Ataque: Nudillos","Puñetazos muy rápidos al enemigo más cercano.",a=>new dn(a, {
  cd:I(.5),dmg:I(10.8),range:I(72),hit:()=>Od
}));
wn("atk_book","Ataque: Libro","Golpe con el libro que empuja al enemigo.",a=>new dn(a, {
  cd:I(.95),dmg:I(17.6),range:I(85),hit:()=>( {
    knock:70,...Fs
  }),sound:"ef_hit2"
}));
wn("atk_instrument","Ataque: Instrumento","Una nota que vuela hasta el enemigo más cercano.",a=>new Ua(a, {
  cd:I(.8),dmg:I(13.6),count:I(1),speed:520,aim:"spread",radius:11,life:1,view:()=>wr("tex_pok1",.55,!0,16769696),orient:null,hitSound:"hit_fist2"
}));
wn("atk_whip","Ataque: Látigo","Latigazo largo al enemigo más cercano.",a=>new dn(a, {
  cd:I(.9),dmg:I(15.5),range:I(150),sound:"hit_sword",hit:()=>Fs
}));
const xG= {
  활:"atk_bow",권총:"atk_gun",라이플:"atk_gun",샷건:"atk_gun",수리검:"atk_shuriken",롯드:"atk_rod",검:"atk_sword",양손검:"atk_twohand",창:"atk_spear",양손창:"atk_lance",양손도끼:"atk_axe2",단검:"atk_dagger",클럽:"atk_blunt",도끼:"atk_axe",카타르:"atk_katar",너클:"atk_knuckle",책:"atk_book",악기:"atk_instrument",채찍:"atk_whip"
};
function L9(a) {
  return a&&xG[a]||"atk_fist"
}
function D9(a) {
  var e;
  return s1(((e=va[a])==null?void 0:e.tags)??[])
}
function ku(a) {
  return a.startsWith("atk_")
}
function ke(a,e,t,n,s,o,r=8) {
  if(va[a])throw new Error(`Skill repetida: ${a}`);
  EE[a]=n.cd,TE[a]=n.type,CE[a]=n.tags,n.cast&&(Up[a]=n.cast),n.effects&&(kE[a]=n.effects),$e(a,e,t,s,o,r)
}
function jE(a,e,t,n="") {
  Np( {
    id:a,name:e,icon:t,kind:"passive",maxLevel:1,desc:()=>n
  })
}
const Ft= {
  LENS:ii,LENS_ONLY:Fs,FIST:Od,FIREHIT:li,WINDHIT:Au
},GE= {
  swordsman:["bash","magnum","sword_dance","shield_bash","provoke","demoralizing_shout","endure","hp_recovery"],mage:["firebolt","coldbolt","lightning","soul_strike","napalm","fire_wall","frost_diver","sight","thunderstorm"],archer:["double_strafe","arrow_shower","arrow_rain","arrow_repel","retreat","arcane_shot","fire_arrow","concentration"],acolyte:["heal","holy_light","ruwach","decrease_agi","signum_crucis","aqua_benedicta","blessing","holy_smite"],thief:["envenom","sand_attack","hiding","throw_stone","poison_bomb","shadowstep","fan_of_knives","caltrops"],merchant:["mammonite","cart_revolution","zeny_rain","cart_rush","vending","crazy_uproar","enlarge_weight"],taekwon:["tornado_kick","heel_drop","roundhouse","counter_kick","sprint"],ninja:["shuriken","kunai","huuma","flaming_petals","lightning_strike"],gunslinger:["triple_action","rapid_shower","spread_attack","desperado","ground_drift","tracking"]
};
function F9(a,e,t=1) {
  var o;
  const n=Up[a];
  if(!n)return"";
  const s=ek(((o=Pm[a])==null?void 0:o.call(Pm,t))??ZA[n[0]],n[0],e);
  return s>0?bt("Casteo")+" "+Qr(s,1)+" s":bt("Casteo instantáneo")
}
function I9(a,e=[]) {
  const t=[...al(a).flatMap(n=>GE[n]??[]),...e.filter(n=> {
    var s;return(s=va[n])==null?void 0:s.create
  })];
  return[...new Set(t)].map(n=>( {
    id:n,max:va[n].maxLevel
  }))
}
const Lm={},wG=a=> {
  var t;
  const e=va[a];
  return!!(e!=null&&e.create)&&e.type!=="buff"&&e.type!=="control"&&!!((t=e.tags)!=null&&t.some(n=>n==="physical"||n==="magic"||n==="hybrid"))
};
mO( {
  name:a=> {
    var e;return((e=va[a])==null?void 0:e.name)??a
  },damaging:a=>[...new Set(a.flatMap(e=>[...GE[e]??[],...Lm[e]??[]]))].filter(wG)
});
function B9() {
  return {
    dmg:0,cd:0,count:0,cast:0,double:0,bolts:0,targets:0,area:0,reach:0,pierce:0,speed:0,duration:0,splash:0,splashR:0,cone:0,hit:{}
  }
}
function N9(a,e) {
  return {
    dmg:a.dmg+e.dmg,cd:a.cd+e.cd,count:a.count+e.count,cast:a.cast+e.cast,double:a.double+e.double,bolts:a.bolts+e.bolts,targets:a.targets+e.targets,area:a.area+e.area,reach:a.reach+e.reach,pierce:a.pierce+e.pierce,speed:a.speed+e.speed,duration:a.duration+e.duration,splash:a.splash+e.splash,splashR:Math.max(a.splashR,e.splashR),cone:a.cone+e.cone,hit:rs(a.hit,e.hit)
  }
}
const Dm=a=>`elem:${a}`,MG={},nl={},VE=5,SG=4,U9=99,sa="basic",ci=a=> {
  var e;
  return a===sa?bt("los ataques básicos"):((e=va[a])==null?void 0:e.name)??a
},ui=a=> {
  var e;
  return((e=va[a])==null?void 0:e.icon)??"sm_sword"
},is=a=>String(Math.round(a*10)/10).replace(".",","),ot=(a,e,t,n=3)=>( {
  name:a,icon:ui(e),maxRank:n,mod: {
    skill:e,per: {
      dmg:t
    }
  },desc:s=>fu("dmg",t*Math.max(1,s),ci(e))
}),Nt=(a,e,t,n=3)=>( {
  name:a,icon:ui(e),maxRank:n,mod: {
    skill:e,per: {
      cd:t
    }
  },desc:s=>fu("cd",t*Math.max(1,s),ci(e))
}),Na=(a,e,t,n=2,s)=>( {
  name:a,icon:ui(e),maxRank:n,mod: {
    skill:e,per: {
      count:t
    }
  },desc:o=>fu("count",t*Math.max(1,o)*CG(e),ci(e),s??EG(e))
}),AG=(a,e,t,n,s=2)=>( {
  name:a,icon:ui(e),maxRank:s,mod: {
    skill:e,per: {
      splash:t,splashR:n
    }
  },desc:o=>bt("{skill}: {splash} (crece con el área).", {
    splash:LA(t*Math.max(1,o),n),skill:ci(e)
  })
}),Lw=a=> {
  var e,t;
  return!!((t=(e=va[a])==null?void 0:e.create)!=null&&t.call(e).areaIsReach())
},Xa=(a,e,t,n=3)=>( {
  name:a,icon:ui(e),maxRank:n,mod: {
    skill:e,per:Lw(e)? {
      reach:t
    }
    : {
      area:t
    }
  },desc:s=>fu(Lw(e)?"reach":"area",t*Math.max(1,s),ci(e))
}),Dw=.2,sp=(a,e,t=2)=>( {
  name:a,icon:ui(e),maxRank:t,mod: {
    skill:e,per: {
      pierce:Dw/t
    }
  },desc:n=>fu("pierce",Dw/t*Math.max(1,n),ci(e))
}),da=(a,e,t,n,s=3)=>( {
  name:a,icon:ui(e),maxRank:s,mod: {
    skill:e,per:{},hit:t
  },desc:n
}),Fw= {
  fire:"fuego",water:"hielo",wind:"rayo"
},Hh=(a,e,t,n,s,o=3)=>( {
  name:a,icon:t,maxRank:o,mod: {
    skill:Dm(e),per:{},hit:n
  },desc:s
}),kG= {
  fire:"alcanza a 1 enemigo más a la vez",water:"tiene un 20% de probabilidad de atravesar a otro enemigo",wind:"dispara 2 proyectiles más"
},k0=(a,e)=>( {
  name:a,icon:fG[e],maxRank:1,stat:t=> {
    eH(t,e)
  },desc:()=>`Tu ataque básico, sea cual sea tu arma, pasa a ser un proyectil mágico de ${Fw[e]} que escala con MATK, hace un 75% más de daño que el del báculo, ${kG[e]} y gana los efectos que den tus talentos a los hechizos de ${Fw[e]}. Con varias infusiones, el disparo las combina, se lleva los efectos y extras de todas y hace aún más daño: +150% con dos y +225% con tres.`
}),E0=(a,e,t)=> {
  const n=Pw[e],s=()=>Qm.filter(o=>o!==e).map(o=>va[Pw[o]].name);
  return {
    name:a,icon:t,maxRank:1,start: {
      skill:n,level:1
    },stat:o=> {
      o.boltConduit|=1<<Qm.indexOf(e)
    },desc:()=>`Empiezas la partida con ${va[n].name}. ${va[n].name} se lleva también las mejoras de ${s().join(" y ")}: las que ganen en la partida (daño, objetivos, bolts, enfriamiento...), sus talentos y su Deity.`
  }
},C0=(a,e,t)=>( {
  name:a,icon:t,maxRank:2,mod: {
    skill:e,per: {
      bolts:1
    }
  },desc:n=>`+${Math.max(1,n)} ${Math.max(1,n)===1?"bolt":"bolts"} de ${va[e].name} sobre cada objetivo.`
}),Z=(a,e,t,n=3)=>( {
  name:a,icon:e,maxRank:n,stat:(s,o)=>t.apply(s,o),desc:s=>`${t.text(Math.max(1,s))}.`
}),co=(a,e,t,n)=>( {
  name:a,icon:ui(e),maxRank:1,mod: {
    skill:e,per:t
  },desc:()=>TG(e,t)
});
function EG(a) {
  var e,t;
  return((t=(e=va[a])==null?void 0:e.create)==null?void 0:t.call(e).countUnit())??"proyectil"
}
function CG(a) {
  var e,t;
  return((t=(e=va[a])==null?void 0:e.create)==null?void 0:t.call(e).countStep)??1
}
function TG(a,e) {
  var o,r;
  const t=(r=(o=va[a])==null?void 0:o.create)==null?void 0:r.call(o),n=(t==null?void 0:t.countUnit())??"proyectil",s=[];
  for(const[i,l]of Object.entries(e))!l||i==="splashR"||(i==="splash"?s.push(LA(l,e.splashR??0)):i==="speed"?s.push(Nc((t==null?void 0:t.speedKey())??"projSpeed",l)):i==="count"?s.push(Nc("count",l,n)):s.push(Nc(i,l)));
  return bt("{skill}: {mods}.", {
    skill:ci(a),mods:s.join(", ")
  })
}
const i1=(a,e,t)=>( {
  name:a,icon:e,maxRank:1,stat:n=>t.forEach(s=>s.apply(n,1)),desc:()=>t.map(n=>n.text(1)).join(", ")+"."
}),na=(a,e,t,n=3)=>( {
  name:a,icon:e,maxRank:n,stat:(s,o)=>t.forEach(r=>r.apply(s,o)),desc:s=>t.map(o=>o.text(Math.max(1,s))).join(", ")+"."
}),kn=(a,e,t,n,s,o=3)=>( {
  name:a,icon:e,maxRank:o,mod: {
    skill:t,per:n
  },desc:r=>s(Math.max(1,r))
}),ts=(a,e)=>( {
  ...a,weapons:e
}),WE=1,$E=.6,YE=()=>bt("Tus ataques básicos cuerpo a cuerpo golpean en cono: todos los enemigos que tienes delante, a su alcance, reciben el golpe completo."),Hp=(a,e)=>( {
  name:a,icon:e,maxRank:1,mod: {
    skill:sa,per: {
      cone:WE
    }
  },desc:YE
}),XE=a=>( {
  ...a,mod: {
    skill:sa,per: {
      cone:WE
    }
  },desc:e=>`${a.desc(e)} ${YE()}`
}),Ql=a=>( {
  ...a,needsShield:!0
});
function q9(a,e,t) {
  return(!a.weapons||a.weapons.includes(e??""))&&(!a.needsShield||t)
}
function H9(a) {
  return bt(PG[a]??"otra arma")
}
const PG= {
  검:"espada de una mano",양손검:"espada a dos manos",단검:"daga",창:"lanza de una mano",양손창:"lanza a dos manos",도끼:"hacha de una mano",양손도끼:"hacha a dos manos",클럽:"maza",롯드:"vara",활:"arco",카타르:"katar",너클:"nudillos",책:"libro",악기:"instrumento",채찍:"látigo",수리검:"huuma shuriken",권총:"pistola",라이플:"rifle",샷건:"escopeta",개틀링건:"ametralladora",그레네이드건:"lanzagranadas"
},W=(a,e)=>( {
  ...a,icon:e
}),Xy=a=>( {
  apply:(e,t)=>e.powerMelee+=a*t,text:e=>Pt(`+${is(a*e*100)}% de ATK cuerpo a cuerpo`)
}),E=(a,e,t,n,s,o)=>( {
  key:t,row:a,col:e,spec:n,req:s,req2:o
}),RG=(a,e)=>( {
  ...e,path:a
});
function Ko(a,e) {
  MG[a]=e.map(( {
    name:t,icon:n,desc:s,paths:o
  })=>Do( {
    name:t,icon:n,desc:s,...o? {
      paths:Object.fromEntries(Object.entries(o).map(([r,i])=>[r,Do( {
        ...i
      },["name","desc"])]))
    }
    :{}
  },["name","desc"])),e.forEach((t,n)=> {
    for(const s of t.talents) {
      const o=`${a}.${n}.${s.key}`;if(nl[o])throw new Error(`Talento repetido: ${o}`);nl[o]=zG( {
        ...s.spec,id:o,job:a,branch:n,row:s.row,col:s.col,req:s.req&&`${a}.${n}.${s.req}`,req2:s.req2&&`${a}.${n}.${s.req2}`
      })
    }
  })
}
function zG(a) {
  const e=a.desc;
  return a.desc=t=>Pt(e(t)),Do(a,["name"])
}
const hi=a=>e=>( {
  stun:1,stunChance:a*e
});
Ko("swordsman",[ {
  name:"Armas",icon:"sm_bash",desc:"Bash, Magnum Break y el dominio de la espada.",talents:[E(0,0,"sword_mastery",ts(Z("Sword Mastery","sm_sword",X(.03),5),["검"])),E(1,0,"tempered",Z("Filo templado","kn_onehand",Ee(.01))),E(0,1,"bash_dmg",ot("Bash mejorado","bash",.06,5)),E(2,0,"deep_cut",Z("Tajo profundo","lk_headcrush",zt(.1),2),"tempered"),E(2,1,"fatal_blow",W(da("Fatal Blow","bash",hi(.05),a=>`Bash tiene un ${5*Math.max(1,a)}% de aturdir.`),"sm_fatalblow"),"bash_dmg"),E(2,3,"magnum_dmg",W(ot("Magnum potenciado","magnum",.06,5),"rk_ignitionbreak")),E(2,2,"two_hand",ts(Z("Two-Hand Mastery","sm_twohand",Ut(.04),5),["양손검","양손창"])),E(4,0,"weapon_mastery",Z("Maestría del arma","kn_pierce",Xy(.03))),E(3,2,"giant_slayer",Z("Matagigantes","rk_giantgrowth",ls(.04))),E(3,3,"magnum_cd",W(Nt("Magnum rápido","magnum",.06),"rk_windcutter"),"magnum_dmg"),E(4,1,"coup",W(Na("Golpe de gracia","bash",1,1,"objetivo"),"lk_jointbeat"),"fatal_blow"),E(4,3,"magnum_mark",W(da("Llamas de Magnum","magnum",a=>( {
    mark:.05*a,markTime:4
  }),a=>`Los enemigos que alcanza Magnum Break reciben un +${5*Math.max(1,a)}% de daño durante 4 s.`,2),"rk_enchantblade"),"magnum_cd"),E(5,0,"lethal",na("Precisión letal","lk_concentration",[Ee(.01),zt(.05)])),E(4,2,"warrior_reach",na("Alcance del guerrero","kn_spearstab",[id(.1),X(.02)],2),"giant_slayer"),E(5,2,"magnum_inferno", {
    name:"Magnum infernal",icon:"mh_magma_flow",maxRank:1,mod: {
      skill:"magnum",per: {
        area:.5
      }
    },stat:a=>a.ext.magnumInferno=1,desc:()=>Pt("Magnum Break hace un 85% menos de daño al golpear, pero quema un 275% de su daño normal en 10 s y tiene un 50% más de área.")
  }),E(0,3,"shout_weaken",W(da("Voz de mando","demoralizing_shout",a=>( {
    weaken:.02*a
  }),a=>`Demoralizing Shout quita un ${2*Math.max(1,a)}% más de daño a los enemigos.`,5),"gd_battleorder")),E(1,3,"shout_dread",W(da("Pavor","demoralizing_shout",a=>( {
    slow:1.5*a
  }),a=>`Demoralizing Shout ralentiza a los enemigos ${is(1.5*Math.max(1,a))} s.`,2),"sc_chaospanic"),"shout_weaken"),E(6,1,"bowling_bash",W( {
    ...co("Bash demoledor","bash", {
      dmg:.3,reach:.3,cone:$E
    }),desc:()=>Pt("Bash hace +30% de daño y llega un 30% más lejos. Es un mazazo contra el suelo: los enemigos de alrededor del objetivo reciben el 60% del daño.")
  },"kn_bowlingbash"),"coup")]
}, {
  name:"Furia",icon:"sm_autoberserk",desc:"Ataques básicos rápidos, críticos y más peligro con poca vida.",talents:[E(0,1,"brutality",Z("Brutalidad","rk_fightingspirit",X(.02),5)),E(1,0,"charge",Z("Carga","cr_spearquicken",gt(.03),2)),E(1,1,"double_slash",Z("Doble tajo","rk_hundredspear",za(.02),5)),E(2,0,"frenzy",Z("Frenesí","lg_rageburst",Xy(.025),5)),E(2,1,"auto_berserk", {
    ...Z("Auto Berserk","sm_autoberserk",Zr(.08)),gearStat: {
      weapons:["양손검"],stat:(a,e)=> {
        Zr(.08).apply(a,e),id(.5).apply(a,1)
      }
    },desc:a=>Pt(`+${8*Math.max(1,a)}% de daño con poca vida. Con espada a dos manos, otro +${8*Math.max(1,a)}% y +50% de alcance cuerpo a cuerpo.`)
  }),E(2,3,"quicken",ts(W(Nt("Two-Hand Quicken",sa,.1),"kn_twohandquicken"),["양손검","양손창"])),E(3,1,"bloodthirst",Z("Sed de sangre","rk_deathbound",IU(.3),2),"auto_berserk"),E(0,2,"relentless",W(ot("Filo implacable",sa,.08,5),"lg_moonslasher")),E(3,3,"cleave",Hp("Tajos encadenados","lg_cannonspear")),E(4,0,"adrenaline",Z("Adrenalina","rk_vitalityactivation",bu("areaSkillDmg",a=>Pt(`Tus skills de área hacen un ${Math.round(a*100)}% más de daño`))(.15),2)),E(5,0,"roar",na("Rugido","rk_dragonhowling",[X(.02),gt(.02)],2)),E(5,3,"steel_fury",kn("Furia de acero","lk_aurablade",sa, {
    dmg:.05,cd:.04
  },a=>`+${5*a}% de daño y +${4*a} de Celeridad de los ataques básicos.`,2),"cleave"),E(6,1,"berserk", {
    ...i1("Berserk","lk_berserk",[BU(1),X(.4),NU(.01),id(.2)]),mod: {
      skill:sa,per: {
        cd:.1
      }
    },desc:()=>"+40% de daño, +20% de alcance cuerpo a cuerpo y +10 de Celeridad en los ataques básicos. Tu vida máxima baja al 40% y cuentas siempre como con poca vida. Te curas un 1% del daño que hace el sangrado."
  },"bloodthirst"),E(1,2,"dance_dmg",ot("Paso de baile","sword_dance",.06,5)),E(3,2,"dance_cd",W(Nt("Danza veloz","sword_dance",.06),"rk_sonicwave"),"dance_dmg"),E(5,2,"dance_area",W(Xa("Torbellino","sword_dance",.1,2),"rk_stormblast")),E(6,2,"dance_finale",W(co("Danza de la muerte","sword_dance", {
    count:1,dmg:.15
  }),"lk_spiralpierce"),"dance_area")]
}, {
  name:"Protección",icon:"sm_endure",desc:"Vida, armadura y recuperación. Provoke y Endure.",talents:[E(0,0,"hard_skin",Z("Piel dura","rk_stonehardskin",Ls(.03),5)),E(0,1,"stance",Z("Postura firme","cr_autoguard",lt(.4),5)),E(1,0,"recovery",Z("Recuperación","sm_recovery",ma(.24)),"hard_skin"),E(1,1,"shield_mastery",Ql(Z("Maestría con escudo","cr_shieldcharge",ct(.02)))),E(1,2,"provoke_area",Xa("Grito de guerra","provoke",.12)),E(0,3,"endure_cd", {
    name:"Resistencia",icon:"sm_endure",maxRank:3,stat:(a,e)=>a.ext.endureSecs=(a.ext.endureSecs??0)+e,desc:a=>`Endure dura ${Math.max(1,a)} s más.`
  }),E(2,0,"moving_recovery",Z("Moving HP Recovery","sm_movingrecovery",vu(.36),2),"recovery"),E(2,1,"guard_up", {
    name:"Guardia alzada",icon:"cr_defender",maxRank:3,stat:(a,e)=>a.ext.guardUp=(a.ext.guardUp??0)+.15*e,desc:a=>`Si llevas 3 s sin recibir golpes, el siguiente golpe se reduce un ${15*Math.max(1,a)}%.`
  }),E(2,2,"taunt",W(da("Provocación brutal","provoke",a=>( {
    mark:.06*a
  }),a=>`Provoke aumenta un +${6*Math.max(1,a)}% más el daño recibido.`,2),"pa_pressure"),"provoke_area"),E(3,1,"faith",ts(Z("Convicción","cr_trust",X(.05),5),["검","창"])),E(1,3,"endure_heal", {
    name:"Tesón",icon:"lk_tensionrelax",maxRank:2,stat:(a,e)=>a.ext.endureHeal=(a.ext.endureHeal??0)+.05*e,desc:a=>`Al activar Endure recuperas un ${5*Math.max(1,a)}% de la vida que te falta.`
  },"endure_cd"),E(2,3,"shield_bash_dmg",Ql(W(ot("Golpe de escudo","shield_bash",.06,5),"lg_shieldspell"))),E(4,3,"shield_bash_reach",Ql(kn("Vanguardia","lg_forceofvanguard","shield_bash", {
    reach:.15,area:.1
  },a=>`Shield Bash llega un +${15*a}% más lejos y su escudo es un +${10*a}% más grande.`,2)),"shield_bash_dmg"),E(5,3,"bulldozer",Ql(W(da("Apisonadora","shield_bash",()=>( {
    drag:.15
  }),()=>"Shield Bash arrastra a los enemigos que atraviesa (salvo jefes) hasta el final de su recorrido y allí los aplasta: un 40% de su daño, +15% por cada enemigo arrastrado.",1),"pa_shieldchain")),"shield_bash_reach"),E(4,0,"parry",Ql(Z("Shield Mastery","lk_parrying",X(.05)))),E(4,2,"presence",Z("Presencia","lg_prestige",Js(.05),2)),E(5,0,"immovable",Z("Inamovible","rk_refresh",Ld(.6),2)),E(5,1,"wall", {
    name:"Muro",icon:"lg_shieldpress",maxRank:2,stat:(a,e)=>a.ext.wallRage=(a.ext.wallRage??0)+.05*e,desc:a=>`Cada golpe que recibes te da +${5*Math.max(1,a)}% de daño durante 10 s (se acumula hasta 2 veces).`
  }),E(6,1,"last_breath", {
    name:"Último aliento",icon:"lg_kings_grace",maxRank:1,stat:a=>a.ext.lastBreath=1,desc:()=>"El golpe que te mataría no entra: te curas toda la vida y haces un +35% de daño durante 30 s. Puede volver a saltar a los 90 s."
  },"wall")]
}
]);
const LG= {
  apply:a=>a.petrifyVuln=1,text:()=>Pt("los petrificados reciben un +100% de daño de cualquier fuente")
},DG=a=>( {
  apply:(e,t)=>e.petrifyChance+=a*t,text:e=>Pt(`+${Math.round(a*e*100)}% de petrificar al golpear`)
});
Ko("mage",[ {
  name:"Fuego",icon:"mg_firebolt",desc:"Fire Bolt, Fire Wall y llamas orbitales.",talents:[E(0,0,"firebolt_dmg",ot("Llama viva","firebolt",.04,5)),E(1,1,"firewall_dmg",ot("Muro abrasador","fire_wall",.04,5)),E(0,2,"inner_heat",Z("Calor interior","sa_elementfire",Ee(.01),5)),E(0,3,"firebolt_bolts",C0("Ráfaga ígnea","firebolt","wl_summonfb")),E(1,0,"fire_infusion",k0("Infusión de fuego","fire"),"firebolt_dmg"),E(2,3,"firebolt_count", {
    name:"Fuego múltiple",icon:"sa_flamelauncher",maxRank:1,mod: {
      skill:Dm("fire"),per: {
        targets:1
      }
    },desc:()=>"Tus hechizos de fuego que eligen objetivo (Fire Bolt, el ataque infusionado de fuego...) alcanzan a 1 enemigo más a la vez (Fire Bolt, a 2)."
  },"combustion"),E(2,1,"firewall_cd",W(Nt("Muro rápido","fire_wall",.06),"wz_firepillar"),"firewall_dmg"),E(1,3,"combustion",Hh("Combustión","fire","mg_fireball",a=>( {
    burn:.1*a
  }),a=>`Tus hechizos de fuego queman al objetivo: sufre un ${10*Math.max(1,a)}% del daño del golpe como fuego durante 10 s (se suma si ya ardía).`)),E(2,2,"sight_count",W(Na("Más llamas","sight",1,3,"llama"),"wz_sightrasher")),E(1,2,"pyro",Z("Pirotecnia","wz_sightblaster",zt(.1),2),"inner_heat"),E(3,3,"warmth",Z("Calor reconfortante","so_warmer",ma(.2),5)),E(4,1,"eternal_fire", {
    name:"Fuego eterno",icon:"am_flamecontrol",maxRank:5,mod: {
      skill:Dm("fire"),per: {
        cd:.05
      }
    },desc:a=>`+${5*Math.max(1,a)} de Celeridad en tus hechizos de fuego (también el ataque infusionado de fuego).`
  }),E(3,0,"fire_conduit",E0("Conducto ígneo","fire","sa_autospell"),"fire_infusion"),E(5,3,"heat_wave",Z("Ola de calor","wz_heaven",Ut(.03))),E(4,2,"orbit_flames",kn("Llamas orbitales","hw_magicpower","sight", {
    dmg:.07,speed:.1
  },a=>`Sight hace +${7*a}% de daño y gira un ${10*a}% más rápido.`,2),"sight_count"),E(5,0,"pyromaniac", {
    name:"Pirómano",icon:"wl_hellinferno",maxRank:1,stat:a=>a.burnCrit=1,desc:()=>"La quemadura de Combustión también puede ser crítica: cada tic tira su propio crítico."
  }),E(4,3,"firestorm", {
    name:"Firestorm",icon:"wz_meteorstorm",maxRank:1,stat:a=>a.firestorm=1,desc:()=>"Thunderstorm pasa a ser una tormenta de fuego: tornados de llamas en vez de rayos. Es un hechizo de fuego: se lleva los talentos de fuego (Combustión, Fuego múltiple, Fuego eterno...) en vez de los de rayo."
  }),E(6,1,"meteor", {
    name:"Fuego gemelo",icon:"wz_meteor",maxRank:1,stat:a=>a.fireMirror=.2,desc:()=>"Cada hechizo de fuego que lanzas se repite al momento sobre otro objetivo (o, si es de área, sobre otro grupo) con un 20% de su daño: los mismos bolts y efectos. Si no hay otro enemigo, se pierde."
  },"eternal_fire")]
}, {
  name:"Hielo",icon:"mg_frostdiver",desc:"Congela y controla a la horda.",talents:[E(0,0,"coldbolt_dmg",ot("Frío penetrante","coldbolt",.08,5)),E(0,3,"coldbolt_bolts",C0("Ráfaga gélida","coldbolt","wl_summonwb")),E(0,2,"frost_dmg",Z("Increase SP Recovery","mg_srecovery",tt(.04),5)),E(1,1,"energy_coat",Z("Energy Coat","mg_energycoat",ct(.015),5)),E(1,0,"water_infusion",k0("Infusión de hielo","water"),"coldbolt_dmg"),E(1,3,"freeze",Hh("Congelación","water","wz_frostnova",a=>( {
    freezeChance:.06*a
  }),a=>`Tus hechizos de hielo congelan con un +${6*Math.max(1,a)}% de probabilidad.`,5)),E(2,3,"shatter",Hh("Fragmentación","water","wz_icewall",a=>( {
    mark:.05*a,markTime:3
  }),a=>`Los enemigos que alcanzan tus hechizos de hielo reciben un +${5*Math.max(1,a)}% de daño durante 3 s.`,2),"freeze"),E(2,2,"glaciation",W(da("Glaciación","frost_diver",a=>( {
    freeze:.3*a
  }),a=>`Frost Diver congela ${is(.3*Math.max(1,a))} s más.`,5),"sa_elementwater")),E(1,2,"frost_armor",Z("Armadura de escarcha","sa_deluge",lt(.5),3)),E(4,1,"ice_rain", {
    name:"Lluvia de hielo",icon:"wz_waterball",maxRank:5,mod: {
      skill:Dm("water"),per: {
        double:.01
      }
    },desc:a=>`+${Math.max(1,a)}% de doble casteo en tus hechizos de hielo (también el ataque infusionado de hielo).`
  }),E(3,2,"frost_chain",W(Na("Escarcha en cadena","frost_diver",1,2,"objetivo"),"wz_stormgust"),"glaciation"),E(3,0,"water_conduit",E0("Conducto gélido","water","so_spellfist"),"water_infusion"),E(3,3,"winter_skin",Z("Piel de invierno","sa_landprotector",Ge(8),5)),E(5,0,"slow", {
    name:"Escarcha persistente",icon:"wz_quagmire",maxRank:1,stat:a=>a.allColdBolt=1,desc:()=>"Fire Bolt y Lightning Bolt se convierten en Cold Bolt: siguen siendo habilidades aparte, pero los tres comparten las mejoras de la partida (cada uno lanza los bolts de todos), los talentos y el Deity de Cold Bolt."
  },"water_conduit"),E(5,2,"frost_area", {
    name:"Ventisca",icon:"sa_violentgale",maxRank:1,mod: {
      skill:"frost_diver",per:{},hit:()=>( {
        freezeNova:2
      })
    },desc:()=>"Frost Diver suelta una nova de hielo al impactar que congela a todos los enemigos a 2 m (crece con el área)."
  },"frost_chain"),E(6,1,"eternal_winter",Hh("Deep Freeze","water","wl_jackfrost",()=>( {
    frozenBonus:3
  }),()=>"Tus hechizos de hielo hacen un 400% de daño a los enemigos que ya estaban congelados.",1),"ice_rain")]
}, {
  name:"Arcano",icon:"mg_soulstrike",desc:"Almas, rayos y tormentas. Enfriamiento y casteo.",talents:[E(0,3,"soul_dmg",ot("Alma poderosa","soul_strike",.04,5)),E(0,0,"lightning_dmg",ot("Alto voltaje","lightning",.04,5)),E(0,2,"lightning_bolts",C0("Ráfaga voltaica","lightning","wl_summonbl")),E(1,2,"quick_cast",Z("Conjuro veloz","sa_freecast",Ys(.05),5)),E(1,0,"wind_infusion",k0("Infusión de rayo","wind"),"lightning_dmg"),E(2,2,"stone_curse",na("Stone Curse","mg_stonecurse",[DG(.01),LG])),E(1,3,"soul_count", {
    name:"Legión de almas",icon:"hw_souldrain",maxRank:2,mod: {
      skill:"soul_strike",per: {
        bolts:1
      }
    },desc:a=>`+${Math.max(1,a)} ${Math.max(1,a)===1?"alma":"almas"} de Soul Strike sobre cada objetivo.`
  },"soul_dmg"),E(1,1,"storm_dmg",ot("Tormenta furiosa","thunderstorm",.05)),E(2,1,"storm_area",W(Xa("Frente tormentoso","thunderstorm",.1,2),"wz_heavendrive"),"storm_dmg"),E(3,1,"storm_cd",kn("Tormenta rápida","sa_lightningloader","thunderstorm", {
    cast:.05
  },a=>`+${5*a} de rapidez de casteo en Thunderstorm.`),"storm_area"),E(3,2,"napalm_area",kn("Napalm potenciado","hw_napalmvulcan","napalm", {
    dmg:.04,area:.04
  },a=>`Napalm Beat hace +${4*a}% de daño y tiene +${4*a}% de área.`,5)),E(3,0,"wind_conduit",E0("Conducto voltaico","wind","wl_release"),"wind_infusion"),E(5,0,"double_cast",W(Z("Double Casting","pf_doublecasting",za(.02)),"pf_doublecasting")),E(5,2,"arcane_power",na("Poder arcano","hw_magiccrasher",[X(.02),tt(.01)])),E(4,2,"clearcast", {
    name:"Clearcast",icon:"pf_memorize",maxRank:2,stat:(a,e)=>a.clearcast+=.1*e,desc:a=>`Al lanzar Soul Strike, ${10*Math.max(1,a)}% de probabilidad de reiniciar el enfriamiento de Napalm Beat.`
  },"napalm_area"),E(3,3,"soul_split", {
    name:"Alma dividida",icon:"wl_soulexpansion",maxRank:5,start: {
      skill:"soul_strike",level:1
    },mod: {
      skill:"soul_strike",per:{},hit:a=>( {
        soulSplit:.2*a
      })
    },desc:a=>`Empiezas la partida con Soul Strike. Cada alma de Soul Strike que golpea suelta otra alma hacia otro monstruo cercano, con el ${20*Math.max(1,a)}% de su daño.`
  },"soul_count"),E(6,3,"soul_ward", {
    name:"Escudo de almas",icon:"so_elemental_shield",maxRank:1,mod: {
      skill:"soul_strike",per:{},hit:()=>( {
        soulWard:.02
      })
    },desc:()=>"Cada monstruo que matas con Soul Strike te da un 2% de reducción de daño durante 6 s, acumulable hasta un 20%."
  },"soul_split"),E(6,1,"lord_of_storms", {
    name:"Electrical Mayhem",icon:"wz_vermilion",maxRank:1,mod: {
      skill:"thunderstorm",per: {
        area:.4
      }
    },stat:a=>a.stormVortex=1,desc:()=>"Thunderstorm tiene +40% de área, arrastra a los monstruos hacia su centro y los ralentiza 2 s."
  },"storm_cd")]
}
]);
Ko("archer",[ {
  name:"Tirador",icon:"ac_double",desc:"Ataque básico, críticos, Double Strafe y Retirada.",talents:[E(0,0,"owls_eye",Z("Owl's Eye","ac_owl",Ee(.01),5)),E(0,1,"ds_dmg",W(ot("Flechas afiladas","double_strafe",.06,5),"ma_double")),E(0,2,"bow_mastery",W(ot("Maestría con el arco",sa,.06),"ht_beastbane")),E(1,0,"kiting",Z("Paso de arquero","st_preserve",gt(.02),5)),E(1,1,"ds_cd",W(Nt("Tensado rápido","double_strafe",.05),"dc_throwarrow"),"ds_dmg"),E(2,1,"ds_count",W(kn("Salva prolongada","cg_arrowvulcan","double_strafe", {
    targets:1
  },()=>"Double Strafe dispara a 1 enemigo más a la vez.",1),"cg_arrowvulcan"),"ds_cd"),E(2,2,"piercing",W(sp("Flecha penetrante",sa,1),"ht_steelcrow"),"bow_mastery"),E(2,3,"retreat_cd",W(Nt("Retirada rápida","retreat",.06),"st_chasewalk")),E(3,0,"hunter",Z("Instinto de cazador","ht_detecting",ls(.04))),E(3,3,"covering_fire",W(ot("Disparo de cobertura","retreat",.08),"ra_camouflage"),"retreat_cd"),E(3,2,"serrated",W(da("Puntas dentadas",sa,a=>( {
    critBonus:.03*a
  }),a=>`Tus ataques básicos tienen un +${3*Math.max(1,a)}% de probabilidad de crítico.`),"ra_toothofwug"),"piercing"),E(4,1,"ds_ramp", {
    name:"Presa marcada",icon:"sn_sight",maxRank:2,stat:(a,e)=>a.ext.preyMark=Rm.dmg*e,desc:a=>`Los enemigos alcanzados por Double Strafe quedan marcados ${Rm.secs} s: tus ataques básicos les hacen un ${Math.round(Rm.dmg*100)*Math.max(1,a)}% más de daño.`
  }),E(4,2,"twin_arrows",kn("Flechas gemelas","ma_chargearrow",sa, {
    targets:1
  },()=>"Tus ataques básicos disparan a 1 enemigo más a la vez.",1),"serrated"),E(5,0,"vultures_eye",Z("Vulture's Eye","ac_vulture",rn(.05),2)),E(5,3,"weak_point",Z("Punto débil","sn_sharpshooting",zt(.08),5)),E(6,1,"strafe_storm", {
    name:"Tormenta de salvas",icon:"sn_falconassault",maxRank:1,start: {
      skill:"double_strafe",level:1
    },stat:a=>a.strafeOnCrit=1,desc:()=>Pt(`Empiezas la partida con Double Strafe. Cada crítico de tu ataque básico tiene un ${Math.round(Bw.chance*100)}% de probabilidad de disparar gratis una salva de Double Strafe sobre ese enemigo con un ${Math.round(Bw.dmg*100)}% de su daño, sin gastar su enfriamiento.`)
  },"ds_ramp")]
}, {
  name:"Arcano",icon:"ac_arcaneshot",desc:"Celeridad, área, Arcane Shot y Flecha ígnea.",talents:[E(0,0,"haste",Z("Mente ágil","wm_song_of_mana",tt(.02),5)),E(0,1,"arcane_dmg",W(ot("Disparo arcano","arcane_shot",.06,5),"wm_dominion_impulse")),E(1,1,"pulse_area",W(Xa("Pulso amplio","arcane_shot",.08),"wm_voiceofsiren"),"arcane_dmg"),E(1,2,"live_flame",W(da("Llama viva","fire_arrow",a=>( {
    burn:.3*a
  }),a=>`La quemadura de la Flecha ígnea hace un +${30*Math.max(1,a)}% del daño del golpe (sin talentos, un 150%).`,5),"ra_firingtrap")),E(3,2,"fire_area",W(Xa("Fuego extendido","fire_arrow",.08),"ra_clusterbomb"),"live_flame"),E(2,3,"insight",Z("Intuición","ab_praefatio",Mp(2),5)),E(5,0,"fire_targets",W(Na("Flechas ígneas","fire_arrow",1,2),"ra_detonator"),"embers"),E(2,0,"arcane_surge", {
    name:"Ráfaga arcana",icon:"ra_unlimit",maxRank:3,stat:(a,e)=>a.arcaneSurge+=.4*e,desc:a=>`Cada Arcane Shot o Flecha ígnea que lanzas quita ${String(Math.round(4*Math.max(1,a))/10).replace(".",",")} s al enfriamiento de la otra.`
  }),E(4,1,"gravity",W(da("Gravedad","arcane_shot",a=>( {
    slow:a
  }),a=>`Arcane Shot ralentiza ${Math.max(1,a)} s a los que golpea.`,2),"ra_verduretrap")),E(3,3,"elemental_focus", {
    name:"Foco elemental",icon:"ab_canto",maxRank:5,stat:(a,e)=>a.hybridDmg+=.02*e,desc:a=>`+${2*Math.max(1,a)}% de daño de tus flechas elementales (Arcane Shot y Flecha ígnea).`
  }),E(3,0,"embers",W(Nt("Ascuas","fire_arrow",.06),"ra_researchtrap")),E(3,1,"arcane_twin",W(Na("Disparo doble","arcane_shot",1,1),"wm_metalicsound"),"pulse_area"),E(4,2,"reach",Z("Alcance arcano","wm_great_echo",Ut(.03))),E(5,3,"flow",Z("Flujo arcano","wm_lerads_dew",za(.02),5)),E(6,1,"convergence", {
    name:"Convergencia elemental",icon:"wz_meteorstorm",maxRank:1,stat:a=>a.elemConverge=1,desc:()=>"Si el pulso de Arcane Shot arrastra a algún monstruo que esté ardiendo, al cerrarse estalla una explosión de fuego de 3 m que hace daño según tu ATK e INT y deja ardiendo a todos los que alcanza."
  })]
}, {
  name:"Asedio",icon:"ac_shower",desc:"Arrow Shower, Arrow Rain y Arrow Repel: aguanta la posición y cubre el campo de flechas.",talents:[E(5,0,"field",Z("Campo de tiro","ht_power",Ut(.02),5)),E(1,0,"improve_concentration",W(kn("Concentración prolongada","ac_concentration","concentration", {
    duration:.15,cd:.05
  },a=>`Improve Concentration dura un ${15*a}% más y tiene un ${5*a}% menos de enfriamiento.`),"ba_poembragi")),E(2,0,"siege_stance", {
    name:"Posición de asedio",icon:"dc_dontforgetme",maxRank:5,stat:(a,e)=>a.stillDmg+=.03*e,desc:a=>`Mientras estás quieto, haces un +${3*Math.max(1,a)}% de daño.`
  }),E(3,0,"camouflage",Z("Camuflaje","ht_phantasmic",ct(.02))),E(0,1,"shower_dmg",W(ot("Abanico letal","arrow_shower",.06,5),"ba_musicalstrike")),E(4,1,"shower_volley",W(Na("Andanada extra","arrow_shower",1,1),"ba_frostjoker"),"mark_prey"),E(2,1,"mark_prey",W(da("Marcar presa","arrow_shower",a=>( {
    mark:.05*a,markTime:3
  }),a=>`Los que alcanza Arrow Shower reciben un ${5*Math.max(1,a)}% más de daño de todo durante 3 s.`,3),"ht_flasher"),"shower_dmg"),E(0,2,"rain_dmg",W(ot("Lluvia letal","arrow_rain",.06,5),"ba_dissonance")),E(3,2,"more_arrows",W(Na("Más flechas","arrow_rain",2,2),"ba_pangvoice"),"weighted"),E(1,2,"weighted",W(da("Flechas lastradas","arrow_rain",a=>( {
    slow:.5*a
  }),a=>`Arrow Rain ralentiza ${String(.5*Math.max(1,a)).replace(".",",")} s a los que alcanza.`,2),"ht_anklesnare"),"rain_dmg"),E(1,3,"repel_dmg",W(ot("Flecha cargada","arrow_repel",.06,5),"ht_shockwave")),E(2,3,"repel_cd",W(Nt("Recarga rápida","arrow_repel",.06),"ht_springtrap"),"repel_dmg"),E(4,3,"repel_wide", {
    name:"Saeta aturdidora",icon:"ht_sandman",maxRank:3,mod: {
      skill:"arrow_repel",per: {
        area:.08
      },hit:hi(.06)
    },desc:a=>`Arrow Repel tiene un +${8*Math.max(1,a)}% de área y aturde con un ${6*Math.max(1,a)}% de probabilidad.`
  },"repel_cd"),E(5,3,"arrow_crafting", {
    name:"Arrow Crafting",icon:"ac_makingarrow",maxRank:1,stat:a=>a.areaSkillDmg+=.1,desc:()=>"+10% de daño con las skills de área."
  }),E(6,1,"siege_rain", {
    name:"Asedio total",icon:"ra_arrowstorm",maxRank:1,stat:a=>a.siegeRain=1,desc:()=>"Al lanzar Arrow Shower, Arrow Rain o Arrow Repel, lanzas gratis otra de las tres, al azar, sobre otro objetivo (sin gastar su enfriamiento, aunque no la lleves)."
  })]
}
]);
const Ao=["클럽","너클","책"],Ir=(a,e,t,n,s,o=3)=>Z(a,e,bu(t,s)(n),o);
Ko("acolyte",[ {
  name:"Sagrado",icon:"al_heal",desc:"Heal, Aqua Benedicta y Blessing: aguantar curándote en medio de la horda.",talents:[E(0,0,"angelus",Z("Angelus","al_angelus",lt(.3),5)),E(0,1,"heal_dmg",W(ot("Sanación divina","heal",.06,5),"cd_dilectio_heal")),E(0,2,"aqua_dmg",W(ot("Agua bendita","aqua_benedicta",.06,5),"iq_oleum_sanctum")),E(1,0,"divine_protection",na("Divine Protection","al_dp",[Ge(4),ct(.005)],5)),E(1,1,"heal_area",W(Xa("Pulso amplio","heal",.08),"cd_mediale_votum"),"heal_dmg"),E(1,3,"bless_dur",kn("Bendición duradera","cd_benedictum","blessing", {
    duration:.15
  },a=>`Blessing dura un ${15*a}% más.`)),E(3,1,"grace_dmg",Ir("Gracia desbordante","cd_divinus_flos","graceDmg",.25,a=>Pt(`La Gracia de Heal hace un ${Math.round(a*100)}% más de daño`),2)),E(2,2,"aqua_area",W(Xa("Charco extenso","aqua_benedicta",.08),"cd_religio"),"aqua_dmg"),E(3,0,"meditatio",Z("Meditatio","hp_meditatio",ma(.3))),E(2,1,"heal_cd",W(Nt("Heal rápido","heal",.06),"al_cure"),"heal_area"),E(3,2,"aqua_heal",Ir("Agua viva","cd_reparatio","aquaHeal",.05,a=>Pt(`Aqua Benedicta cura un ${Math.round(a*100)}% más`))),E(3,3,"bless_haste",Ir("Bendición compartida","pr_gloria","blessHaste",15,a=>Pt(`Blessing da además +${Math.round(a)} de Celeridad mientras dura`),1),"bless_dur"),E(4,0,"assumptio",Z("Assumptio","hp_assumptio",ct(.02))),E(4,2,"aqua_slow",W(da("Charco sagrado","aqua_benedicta",a=>( {
    slow:.5*a
  }),a=>`Aqua Benedicta ralentiza ${is(.5*Math.max(1,a))} s a los que lo pisan.`,2),"pr_slowpoison")),E(5,1,"basilica",Ir("Basilica","hp_basilica","basilicaHp",4,a=>Pt(`Cada Heal que te cura te da +${Math.round(a)} de vida máxima durante 4 s`))),E(4,3,"mana_recharge",Z("Mana Recharge","hp_manarecharge",tt(.02),5)),E(6,1,"fountain", {
    name:"Fuente de vida",icon:"ab_convenio",maxRank:1,start: {
      skill:"heal",level:1
    },stat:a=>a.ext.fountain=1,desc:()=>"Empiezas la partida con Heal. Con la vida llena, Heal cae sobre el grupo de enemigos más grande a tiro en vez de sobre ti, y gana mejoras de +objetivo: cada una es un pulso más sobre otro grupo. Cada Heal deja donde cae un charco de Aqua Benedicta, igual que el tuyo (con sus talentos y sus mejoras de la partida), aunque no la lleves."
  })]
}, {
  name:"Exorcismo",icon:"al_holylight",desc:"Holy Light, Signum Crucis y Decrease AGI: la luz que purga, marca y frena.",talents:[E(0,0,"demon_bane",Z("Demon Bane","al_demonbane",La(.03),5)),E(0,1,"holy_dmg",W(ot("Luz cegadora","holy_light",.06,5),"cd_arbitrium")),E(0,2,"crucis_dmg",W(ot("Cruz ardiente","signum_crucis",.06,5),"iq_first_brand")),E(1,1,"holy_cd",W(Nt("Plegaria rápida","holy_light",.05),"cd_presens_acies"),"holy_dmg"),E(1,2,"crucis_area",W(Xa("Cruz extendida","signum_crucis",.08),"iq_third_consecration"),"crucis_dmg"),E(1,3,"decagi_area",W(Xa("Lentitud divina","decrease_agi",.1,2),"iq_second_judgement")),E(2,0,"lex_divina", {
    name:"Lex Divina",icon:"pr_lexdivina",maxRank:2,mod: {
      skill:"holy_light",per:{},hit:hi(.1)
    },desc:a=>`Holy Light aturde 1 s con un ${10*Math.max(1,a)}% de probabilidad.`
  }),E(2,1,"holy_count",W(Na("Doble luz","holy_light",1,2),"cd_argutus_telum"),"holy_cd"),E(2,3,"sin",W(da("Peso del pecado","decrease_agi",a=>( {
    slow:.5*a
  }),a=>`Decrease AGI ralentiza ${is(.5*Math.max(1,a))} s más.`,2),"iq_third_punish")),E(4,1,"lex_aeterna",Ir("Lex Aeterna","pr_lexaeterna","lexAeterna",.08,a=>Pt(`Holy Light hace un ${Math.round(a*100)}% más de daño a los marcados por Signum Crucis`)),"holy_count"),E(3,2,"condemn",W(da("Condena","signum_crucis",a=>( {
    mark:.04*a,markTime:2
  }),a=>`Los que alcanza Signum Crucis reciben además un ${4*Math.max(1,a)}% más de daño de todo durante 2 s.`),"cd_effligo"),"crucis_area"),E(5,3,"judgement",Z("Juicio","iq_judge",zt(.1),2)),E(4,0,"faith",Z("Fe","iq_firm_faith",Ee(.01),5)),E(5,2,"crucis_dur", {
    name:"Suelo consagrado",icon:"pr_aspersio",maxRank:3,mod: {
      skill:"signum_crucis",also:["aqua_benedicta"],per: {
        duration:.15
      }
    },stat:(a,e)=>a.ext.groundDur=(a.ext.groundDur??0)+.15*e,desc:a=>`Todo tu suelo sagrado (Signum Crucis, Aqua Benedicta y los charcos de Fuente de vida) dura un ${15*Math.max(1,a)}% más.`
  }),E(4,3,"suffragium",Z("Suffragium","pr_suffragium",Ys(.05))),E(3,0,"purify",Ir("Purificación","pr_turnundead","purify",.1,a=>Pt(`Holy Light y Ruwach hacen un ${Math.round(a*100)}% más de daño a los ralentizados`))),E(3,3,"zeal",na("Celo","iq_powerful_faith",[X(.02),tt(.04)],2)),E(6,1,"divine_judgement", {
    name:"Juicio divino",icon:"cd_pneumaticus_procella",maxRank:1,start: {
      skill:"signum_crucis",level:1
    },stat:a=>a.ext.divineJudgement=1,desc:()=>"Empiezas la partida con Signum Crucis. Mientras dura el suelo de Signum Crucis, cada 2 s cae un Holy Light sin casteo sobre el enemigo más fuerte que hay dentro del círculo (aunque no lleves Holy Light). Si la llevas, con su daño, sus objetivos, su área y sus efectos."
  })]
}, {
  name:"Retribution",icon:"pr_macemastery",desc:"Golpe sagrado, ataques con maza, nudillos o libro y Ruwach: la build de cara al Monk.",talents:[E(0,0,"mace_mastery",ts(W(ot("Mace Mastery",sa,.06,5),"cd_mace_book_m"),Ao)),E(0,1,"smite_dmg",ts(W(ot("Mazazo","holy_smite",.06,5),"iq_exposion_blaster"),Ao)),E(0,2,"ruwach_dmg",W(ot("Orbes ardientes","ruwach",.05,5),"cd_argutus_vita")),E(1,3,"increase_agi",na("Increase AGI","al_incagi",[gt(.015),tt(.01)],5)),E(2,1,"fervor",ts(Ir("Fervor","iq_sincere_faith","fervorCharges",1,a=>Pt(`Golpe sagrado bendice ${Math.round(a)} ${Math.round(a)===1?"ataque básico":"ataques básicos"} más`),2),Ao),"smite_dmg"),E(1,2,"ruwach_count",W(Na("Más orbes","ruwach",1,1,"orbe"),"cd_fidus_animus"),"ruwach_dmg"),E(2,3,"iron_hand",ts(Z("Iron Hand","mo_ironhand",Ee(.01),5),Ao)),E(4,0,"smite_cd", {
    name:"Castigo certero",icon:"ch_palmstrike",maxRank:3,weapons:Ao,mod: {
      skill:sa,also:["holy_smite"],per:{},hit:a=>( {
        critDmg:.1*a
      })
    },desc:a=>`+${10*Math.max(1,a)}% de daño crítico en los ataques básicos y en Golpe sagrado.`
  },"holy_sweep"),E(3,3,"triple_attack",ts(Z("Triple Attack","mo_tripleattack",za(.01),5),Ao)),E(3,2,"ruwach_cd",kn("Orbes veloces","iq_will_of_faith","ruwach", {
    cd:.15
  },a=>`Ruwach tiene un ${15*a}% menos de enfriamiento y sus orbes vuelven antes tras estallar.`,1),"ruwach_count"),E(4,1,"blessed_hand",ts(W(da("Mano bendita","holy_smite",a=>( {
    stun:1*a
  }),a=>`Golpe sagrado aturde ${is(1*Math.max(1,a))} s más.`,1),"mo_balkyoung"),Ao)),E(4,2,"investigate",Z("Investigate","mo_investigate",ls(.04))),E(5,0,"holy_rhythm", {
    name:"Ritmo sagrado",icon:"iq_second_flame",maxRank:3,weapons:Ao,mod: {
      skill:sa,also:["holy_smite"],per: {
        cd:.06
      }
    },desc:a=>`+${6*Math.max(1,a)} de Celeridad en los ataques básicos y en Golpe sagrado.`
  },"smite_cd"),E(2,0,"holy_sweep",ts(Hp("Barrido sagrado","iq_massive_f_blaster"),Ao),"bless_proc","fervor"),E(5,2,"faith_power",ts(Z("Fuerza de la fe","iq_first_faith_power",Xy(.06),2),Ao)),E(1,0,"bless_proc",ts(Ir("Bendición fugaz","iq_third_exor_flame","blessProc",.02,a=>Pt(`Tus ataques básicos tienen un ${Math.round(a*100)}% de probabilidad de lanzarte Blessing (aunque no la hayas aprendido)`)),Ao),"mace_mastery"),E(6,1,"light_strike", {
    name:"Golpe de luz",icon:"cd_framen",maxRank:1,start: {
      skill:"holy_smite",level:1
    },stat:a=>a.ext.lightStrike=1,desc:()=>"Empiezas la partida con Golpe sagrado. Cada ataque básico bendecido suelta además un orbe de Ruwach que estalla sobre el objetivo (aunque no lleves Ruwach)."
  },"blessed_hand")]
}
]);
const FG=a=>( {
  apply:(e,t)=>e.chestDiscount+=a*t,text:e=>Pt(`Los cofres cuestan un ${Math.round(a*e*100)}% menos`)
}),IG=a=>( {
  apply:(e,t)=>e.poisonDmg+=a*t,text:e=>Pt(`+${Math.round(a*e*100)}% de daño de todos tus venenos`)
}),BG= {
  name:"Venom Splasher",icon:"as_splasher",maxRank:1,stat:a=>a.poisonSpread+=1,desc:()=>bt("Al golpear con daño físico a un enemigo envenenado, sus venenos saltan a otro enemigo a 2 m o menos, con su duración completa.")
},NG=a=>( {
  apply:(e,t)=>e.poisonFast+=a*t,text:e=>Pt(`Tus venenos duran un ${Math.round(a*e*100)}% menos y hacen el mismo daño total en ese tiempo`)
}),UG= {
  name:"Adrenaline Rush",icon:"bs_adrenaline",maxRank:1,stat:a=>a.sonicBlow+=1,desc:()=>Pt(`Al lanzar Fan of Knives, Throw Stone o Sand Attack, esas tres skills ganan +${dr.haste} de Celeridad y +${Math.round(dr.dmg*100)}% de daño durante ${dr.seconds} s.`)
},Iw=3,qG= {
  name:"Salida de las sombras",icon:"gc_counterslash",maxRank:1,stat:a=>a.hideFan=Math.max(a.hideFan,Iw),desc:()=>Pt(`Al salir de Hiding lanzas un Fan of Knives con un ${Iw*100}% de su daño, aunque no tengas la skill.`)
},T0= {
  value:.001,secs:1
},HG= {
  name:"Dimension Door",icon:"sc_dimensiondoor",maxRank:3,stat:(a,e)=> {
    a.stepDmg+=.01*e,a.stepPickup=Math.max(a.stepPickup,2*uo),a.ext.stepLifesteal=T0.value
  },desc:a=>Pt(`Mientras dura el buff de Shadowstep: +${Math.max(1,a)}% de daño y 2 m más de radio de recogida. Durante ${T0.secs} s tras usarlo, un ${String(T0.value*100).replace(".",",")}% de robo de vida.`)
},P0= {
  pct:.3,m:2
},Bw= {
  chance:.4,dmg:.3
},OG= {
  name:"Emboscada",icon:"rg_closeconfine",maxRank:1,stat:a=>a.ext.critSplash=P0.pct,desc:()=>Pt(`Tus golpes críticos salpican: los enemigos a ${P0.m} m o menos se llevan un ${Math.round(P0.pct*100)}% del golpe.`)
},jG= {
  name:"Sombra errante",icon:"gc_cloakingexceed",maxRank:1,stat:a=>a.stepChain=Math.max(a.stepChain,2),desc:()=>Pt("Shadowstep salta a 2 enemigos más (si no hay más, repite sobre el mismo). Cada salto lanza un ataque básico con todas sus bonificaciones: el 1000%, el 1500% y el 2000% de su daño. Tras el último salto, tus ataques básicos siguen haciendo el 2000% durante 3 s.")
},GG=a=>( {
  apply:(e,t)=>e.poisonVuln+=a*t,text:e=>Pt(`Los enemigos envenenados reciben un ${Math.round(a*e*100)}% más de daño de todo`)
}),VG=a=>( {
  apply:(e,t)=>e.poisonSlow+=a*t,text:e=>Pt(`Los enemigos envenenados van un ${Math.round(a*e*100)}% más lentos`)
}),WG=a=>( {
  apply:(e,t)=>e.poisonTime+=a*t,text:e=>Pt(`Todos tus venenos duran ${is(a*e)} s más`)
}),$G= {
  name:"Venenos combinados",icon:"gc_venomimpress",maxRank:1,stat:a=>a.poisonStack+=1,desc:()=>bt("Los venenos de skills distintas se suman sobre el mismo enemigo. Sin este talento, solo hace daño el más fuerte.")
},Nw=.05,Uw=W(ot("Maestría con la hoja",sa,.04,5),"rg_backstap"),YG= {
  ...Uw,gearStat: {
    weapons:["단검","카타르"],stat:(a,e)=>a.basicExpBonus+=Nw*e
  },desc:a=>`${Uw.desc(a)} ${Pt(`Con daga o katar, tu ataque básico escala un $ {
    Math.round(Nw/.5*100*Math.max(1,a))
  }
  % mejor con el ATK.`)}`
},XG=a=>( {
  poisonTime:a
});
Ko("thief",[ {
  name:"Asesinato",icon:"tf_poison",desc:"Envenom, Poison Bomb y venenos que pudren a la horda.",talents:[E(0,0,"toxicology",Z("Toxicología","asc_cdp",IG(.04),5)),E(2,0,"edp",Z("Enchant Deadly Poison","asc_edp",WG(1),5)),E(4,0,"venom_mix",$G,"edp"),E(0,1,"poison",W(da("Veneno concentrado","envenom",a=>( {
    poisonMult:.05*a
  }),a=>`El veneno de Envenom hace un +${5*Math.max(1,a)}% de daño.`,5),"as_enchantpoison")),E(1,1,"envenom_cd",W(Nt("Puñaladas rápidas","envenom",.05),"as_right")),E(2,1,"fan",W(Na("Puñales en abanico","envenom",1,1,"objetivo"),"as_grimtooth"),"envenom_cd"),E(5,1,"poison_react",Z("Reacción tóxica","as_poisonreact",GG(.01))),E(6,1,"venom_splasher",BG,"poison_react"),E(1,2,"bomb_area",W(Xa("Salpicadura tóxica","poison_bomb",.05,5),"am_demonstration")),E(3,2,"bomb_cd",W(Nt("Frascos a mano","poison_bomb",.05),"gc_poisoningweapon"),"bomb_area"),E(4,2,"toxin",W(da("Toxina lenta","poison_bomb",XG,a=>`El veneno de Poison Bomb dura ${Math.max(1,a)} s más.`,2),"gc_researchnewpoison")),E(5,2,"bomb_count",W(Na("Lluvia de frascos","poison_bomb",1,1,"objetivo"),"so_poison_buster"),"toxin"),E(0,3,"envenom_dmg",Z("Hoja tóxica","tf_poison",VG(.02))),E(3,3,"potent",Z("Venenos potentes","gc_venompressure",NG(.1))),E(1,3,"fumes",Z("Vapores tóxicos","as_venomdust",Ut(.02),5))]
}, {
  name:"Combate",icon:"tf_double",desc:"Golpes dobles, cuchillos, arena, piedras y botín.",talents:[E(0,0,"double_attack",Z("Double Attack","tf_double",za(.02),5)),E(0,3,"dagger",YG),E(1,3,"quick_hands",W(Nt("Manos rápidas",sa,.02,5),"gc_phantommenace")),E(1,0,"fan_dmg",W(ot("Cuchillas afiladas","fan_of_knives",.08),"sc_triangleshot")),E(2,2,"blind",W(da("Ceguera","sand_attack",a=>( {
    blind:.5*a
  }),a=>`Sand Attack ciega ${is(.5*Math.max(1,a))} s más.`),"sc_bodypaint"),"sand_cd"),E(2,0,"fan_area",W(Xa("Abanico abierto","fan_of_knives",.08,2),"sc_maelstrom"),"fan_dmg"),E(2,1,"stone_dmg",ot("Pedrada","throw_stone",.06,5)),E(0,2,"sand_cd",W(Nt("Arena a mano","sand_attack",.06),"rg_graffiti")),E(2,3,"strip",W(da("Strip Armor",sa,a=>( {
    mark:.1*a,markTime:2
  }),a=>`Tus ataques básicos hacen que el enemigo reciba un +${10*Math.max(1,a)}% de daño durante 2 s.`),"rg_striparmor"),"quick_hands"),E(1,1,"thief_eye",Z("Ojo de ladrón","rg_intimidate",Ee(.01),5)),E(4,1,"stone_stun", {
    name:"Piedra certera",icon:"tf_pickstone",maxRank:2,mod: {
      skill:"throw_stone",per: {
        dmg:.75
      }
    },stat:(a,e)=>a.ext.stoneShatter=(a.ext.stoneShatter??0)+.3*e,desc:a=>`Throw Stone hace un +${75*Math.max(1,a)}% de daño y la piedra revienta en esquirlas: los enemigos de alrededor se llevan un ${30*Math.max(1,a)}% del golpe.`
  },"stone_dmg"),E(3,2,"sand_area",W(Xa("Arena a distancia","sand_attack",.1,2),"rg_tunneldrive"),"blind"),E(3,3,"raid",ts(Hp("Barrido traicionero","rg_raid"),["단검","카타르"]),"strip"),E(5,1,"stone_count",W(kn("Lluvia de piedras","rg_flaggraffiti","throw_stone", {
    count:2
  },()=>"Throw Stone lanza 2 piedras más.",1),"rg_flaggraffiti"),"stone_stun"),E(4,0,"reflexes",Z("Reflejos","as_sonicaccel",ut(.01))),E(5,0,"crit_blow",Z("Filo certero","as_sonicblow",zt(.1),2)),E(5,2,"gangster",Z("Gangster Paradise","rg_gangster",X(.03),2)),E(6,2,"sonic_blow",UG,"gangster")]
}, {
  name:"Sombras",icon:"tf_hiding",desc:"Hiding, Shadowstep y Caltrops: escapar y no caer nunca.",talents:[E(0,0,"improve_dodge",Z("Improve Dodge","tf_miss",ut(.01),5)),E(0,1,"stealth",Z("Sigilo","st_chasewalk",gt(.015),5)),E(0,2,"hiding_cd",Nt("Ocultación rápida","hiding",.06)),E(1,0,"breath",Z("Respiro","tf_detoxify",ma(.4),2)),E(1,2,"hiding_dur",kn("Ocultación larga","as_cloaking","hiding", {
    duration:.15
  },a=>`El daño de más al salir de Hiding dura un +${15*a}%.`,3),"hiding_cd"),E(3,2,"shadow_fan",qG,"hiding_dur"),E(2,0,"backslide",Z("Paso atrás","tf_backsliding",vu(.2))),E(5,0,"reject",Z("Reject Sword","st_rejectsword",ct(.02),2)),E(4,3,"step_cd",W(Nt("Paso fugaz","shadowstep",.09,2),"sc_escape"),"step_dur"),E(2,3,"tough",na("Piel curtida","gc_weaponblocking",[lt(.4),X(.01)])),E(3,0,"preserve",Z("Preserve","st_preserve",Ge(8))),E(1,3,"opportunist",Z("Oportunista","sc_autoshadowspell",tt(.02))),E(3,3,"step_dur",kn("Sombra persistente","sc_shadowform","shadowstep", {
    duration:.05
  },a=>`El Flee y la velocidad de Shadowstep duran un +${5*a}%.`,5)),E(1,1,"caltrop_count",W(Na("Más abrojos","caltrops",1,2,"abrojo"),"rg_compulsion")),E(4,1,"instinct",Z("Instinto","gc_hallucinationwalk",Ee(.02))),E(2,1,"caltrop_dur",kn("Abrojos oxidados","sc_feintbomb","caltrops", {
    duration:.15
  },a=>`Caltrops dura un +${15*a}%.`,2),"caltrop_count"),E(5,1,"ambush",OG,"instinct"),E(5,3,"dimension_door",HG,"step_cd"),E(6,3,"cloaking",jG,"dimension_door")]
}
]);
const KG=a=>( {
  apply:(e,t)=>e.freeChest+=a*t,text:e=>Pt(`${Math.round(a*e*100)}% de que abrir un cofre salga gratis`)
}),JG= {
  name:"Maximize Power",icon:"bs_maximize",maxRank:1,mod: {
    skill:"mammonite",per:{},hit:()=>( {
      zenyCost:5
    })
  },desc:()=>bt("Mammonite gasta 5 zeny al usarse (si los tienes) y entonces hace +35% de daño y un 50% de su daño a los enemigos a 3 m de su objetivo (crece con el área). En la Endless Tower, donde no hay zeny, lo hace siempre sin gastar nada.")
},QG= {
  name:"Arrollar",icon:"mt_rush_quake",maxRank:5,mod: {
    skill:"cart_rush",per: {
      reach:.05
    },hit:hi(.05)
  },desc:a=>`Cart Rush aturde 1 s con un ${5*Math.max(1,a)}% de probabilidad y llega un +${5*Math.max(1,a)}% más lejos.`
},ZG= {
  name:"Gran comerciante",icon:"bs_making_scrolls",maxRank:1,mod: {
    skill:"vending",per:{},hit:()=>( {
      stun:1.2,zenyMark:10
    })
  },desc:()=>bt("El reventón de Vending aturde 1,2 s y marca para Mammonite a todos los que alcanza, como Zeny Rain.")
};
Ko("merchant",[ {
  name:"Comercio",icon:"mc_overcharge",desc:"Zeny Rain, Vending y zeny: el dinero como arma.",talents:[E(0,0,"overcharge",Z("Overcharge","mc_overcharge",Io(.02),5)),E(1,0,"haggle",Z("Regateo","bs_unfairlytrick",mo(.04),5)),E(0,3,"discount",Z("Discount","mc_discount",Dd(.08),5)),E(0,1,"zeny_count",W(Na("Lluvia densa","zeny_rain",1),"gn_slingitem")),E(1,2,"vend_cd",Z("Reposición","nc_repair",tt(.02))),E(1,3,"good_eye",Z("Buen ojo","mc_identify",FG(.04))),E(2,3,"zeny_slow",Z("Calderilla","ws_createcoin",KG(.01),1),"good_eye"),E(2,1,"zeny_mark",W(da("Marca duradera","zeny_rain",a=>( {
    zenyMark:2*a
  }),a=>`La marca de Zeny Rain dura ${2*Math.max(1,a)} s más.`,3),"nc_infraredscan"),"zeny_count"),E(5,2,"vend_lure",W(Xa("Reclamo","vending",.08),"nc_magicdecoy"),"vend_dur"),E(4,0,"efficient",Z("Carga eficiente","bs_greed",rl(.08))),E(3,2,"vend_dur",kn("Liquidación","nc_mainframe","vending", {
    duration:.05
  },a=>`Vending dura un +${5*Math.max(1,a)}%.`,5)),E(3,3,"zeny_cd",na("Bolsa amplia","ws_createnugget",[Ge(10),X(.02)])),E(3,1,"zeny_pierce", {
    name:"Saldo",icon:"nc_axeboomerang",maxRank:1,mod: {
      skill:"cart_revolution",per:{},hit:()=>( {
        zenyVuln:1
      })
    },desc:()=>"Los marcados por Zeny Rain también reciben más daño de Cart Revolution, como de Mammonite."
  },"zeny_mark"),E(2,2,"investment",Z("Inversión","ws_systemcreate",X(.04))),E(6,2,"vending",ZG,"vend_lure")]
}, {
  name:"Carro",icon:"mc_cartrevolution",desc:"Cart Revolution y Cart Rush: el carro como arma y escudo.",talents:[E(0,0,"pushcart",Z("Pushcart","mc_pushcart",gt(.015),5)),E(0,1,"cart_dmg",W(ot("Carro pesado","cart_revolution",.06,5),"gn_cartcannon")),E(0,2,"rush_dmg",W(ot("Embestida","cart_rush",.08),"mt_rush_strike")),E(1,0,"reinforced",Z("Carro reforzado","bs_orideocon",lt(.4))),E(2,1,"cart_cd",W(Nt("Ruedas engrasadas","cart_revolution",.05),"ws_cartboost"),"cart_dmg"),E(5,3,"cart_area",W(Xa("Carro de largo alcance","cart_revolution",.06),"gn_cart_tornado"),"momentum"),E(2,2,"rush_cd",W(Nt("Ruedas nuevas","cart_rush",.06),"nc_hovering"),"rush_dmg"),E(5,2,"brute",Z("Fuerza bruta","bs_steel",Ge(10))),E(2,3,"enlarge_cd",W(Nt("Carga aligerada","enlarge_weight",.06),"nc_neutralbarrier"),"enlarge_dur"),E(3,2,"rush_stun",QG,"rush_cd"),E(4,2,"cart_count",W(Na("Doble vuelta","cart_revolution",1,1,"objetivo"),"gn_remodeling_cart"),"rush_knock"),E(0,3,"enlarge_dur",kn("Carga máxima","am_cp_armor","enlarge_weight", {
    duration:.15
  },a=>`Enlarge Weight Limit dura un +${15*a}%.`,2)),E(4,1,"rush_knock",Z("Golpe certero","mt_twoaxedef",Ee(.01),3)),E(3,0,"axe_mastery",ts(Z("Maestría con hacha","am_axemastery",X(.05),2),["양손도끼"])),E(3,3,"momentum",Z("Momento","nc_powerswing",Ut(.03),3)),E(6,1,"cart_termination",W(co("Cart Termination","cart_revolution", {
    dmg:.35,area:.2
  }),"ws_carttermination"),"rush_knock")]
}, {
  name:"Herrería",icon:"mc_mammonite",desc:"Mammonite, gritos y el golpe del arma.",talents:[E(0,0,"strength",Z("Fuerza","bs_axe",X(.02),5)),E(0,1,"mammo_dmg",W(ot("Zeny pesado","mammonite",.06,5),"mt_mighty_smash")),E(1,0,"weapon_research",W(ot("Weapon Research",sa,.06),"bs_weaponresearch")),E(1,1,"mammo_cd",W(Nt("Golpe rápido","mammonite",.05),"mt_powerful_swing")),E(0,2,"uproar_cd",W(Nt("Grito frecuente","crazy_uproar",.06),"bs_adrenaline2")),E(2,1,"mammo_area",W(da("Impacto","mammonite",a=>( {
    zenyBonus:.1*a
  }),a=>`Mammonite hace un +${10*Math.max(1,a)}% más a los marcados por Zeny Rain.`,2),"mt_axe_stomp")),E(2,2,"uproar_dur",kn("Grito potente","mc_loud_on","crazy_uproar", {
    count:1
  },a=>`Crazy Uproar da ${Math.max(1,a)} carga${a>1?"s":""} más.`,2),"uproar_cd"),E(2,3,"aim",Z("Puntería","bs_weaponperfect",Ee(.01),5)),E(3,0,"hilt",XE(Z("Hilt Binding","bs_hiltbinding",id(.05),2)),"weapon_research"),E(3,1,"hammerfall",W(da("Hammer Fall","mammonite",hi(.05),a=>`Mammonite aturde con un ${5*Math.max(1,a)}% de probabilidad.`,5),"bs_hammerfall")),E(3,2,"armor_break",Z("Rompecorazas","bs_findingore",La(.04))),E(4,3,"crit_hit",Z("Golpe crítico","ws_overthrustmax",zt(.1),2)),E(4,0,"adrenaline",W(Nt("Adrenaline Rush",sa,.05),"bs_adrenaline")),E(4,2,"overthrust",Z("Over Thrust","bs_overthrust",za(.02))),E(1,3,"melt",Z("Meltdown","ws_meltdown",Ut(.02),2)),E(6,1,"maximize",JG,"hammerfall")]
}
]);
const qw=a=>( {
  apply:(e,t)=>e.regenStill+=a*t,text:e=>Pt(`+${is(a*e)} HP/s estando quieto`)
});
Ko("taekwon",[ {
  name:"Tormenta",icon:"tk_stormkick",desc:"Tornado Kick y Roundhouse: patadas que barren todo.",talents:[E(0,0,"mild_wind",na("Mild Wind","tk_sevenwind",[Ut(.015),Ee(.005)],5)),E(0,1,"tornado_dmg",ot("Patada huracanada","tornado_kick",.06,5)),E(1,0,"wind",Z("Viento","sg_sun_warm",Ut(.02))),E(1,1,"tornado_cd",W(Nt("Giro rápido","tornado_kick",.05),"tk_readystorm")),E(1,2,"round_dmg",ot("Patada circular","roundhouse",.08)),E(2,1,"dizzy",W(da("Mareo","tornado_kick",hi(.04),a=>`Tornado Kick aturde con un ${4*Math.max(1,a)}% de probabilidad.`),"sg_moon_warm"),"tornado_cd"),E(2,2,"round_area",W(Xa("Gran barrido","roundhouse",.1,2),"tk_readyturn"),"round_dmg"),E(2,3,"lightness",Z("Ligereza","tk_run",gt(.015))),E(3,0,"whirl",W(Xa("Remolino","tornado_kick",.08),"sg_star_warm")),E(3,2,"round_cd",W(Nt("Ritmo circular","roundhouse",.06),"sg_moon_comfort")),E(4,1,"storm_eye",na("Ojo del huracán","sg_sun_anger",[X(.02),Ee(.01)]),"dizzy"),E(4,3,"gale",Z("Vendaval","sl_swoo",zt(.08),2)),E(5,0,"warm",na("Warm Wind","sg_star_comfort",[Ut(.02),X(.02)],2)),E(5,1,"cyclone",W(ot("Ciclón","tornado_kick",.1,2),"sg_fusion"),"storm_eye"),E(6,1,"typhoon",W(co("Tifón","tornado_kick", {
    dmg:.3,area:.2
  }),"tk_stormkick"),"cyclone")]
}, {
  name:"Combate",icon:"tk_downkick",desc:"Heel Drop y Counter Kick: golpes que aturden.",talents:[E(0,0,"kihop",Z("Kihop","tk_power",X(.02),5)),E(0,1,"heel_dmg",ot("Talonazo","heel_drop",.06,5)),E(0,2,"fist",W(ot("Puños de acero",sa,.06),"tk_jumpkick")),E(1,1,"heel_cd",W(Nt("Ritmo","heel_drop",.05),"tk_readydown")),E(1,2,"counter_dmg",ot("Contragolpe","counter_kick",.08)),E(1,3,"precision",Z("Precisión","sg_hate",Ee(.01))),E(2,1,"concussion",W(da("Conmoción","heel_drop",a=>( {
    stun:.3*a
  }),a=>`Heel Drop aturde ${is(.3*Math.max(1,a))} s más.`),"sg_moon_anger"),"heel_cd"),E(2,2,"counter_cd",W(Nt("Reflejos","counter_kick",.06),"tk_readycounter"),"counter_dmg"),E(3,0,"vital",Z("Golpe vital","sg_star_anger",zt(.1),2)),E(3,2,"counter_area",W(Xa("Contraataque amplio","counter_kick",.1,2),"tk_counter"),"counter_cd"),E(3,3,"flying",W(Nt("Patada voladora",sa,.05),"tk_highjump")),E(4,1,"heel_area",W(Xa("Hacha de talón","heel_drop",.1,2),"tk_downkick"),"concussion"),E(4,3,"combo",Z("Combo","sl_stun",za(.02))),E(5,0,"feeling",na("Feeling","sg_feel",[La(.04),X(.01)],2)),E(5,1,"devil",na("Devil","sg_devil",[Ee(.01),zt(.05)],2),"heel_area"),E(6,1,"celestial",W(co("Hacha celeste","heel_drop", {
    dmg:.35,count:1
  }),"sg_star_bless"),"devil")]
}, {
  name:"Disciplina",icon:"tk_hptime",desc:"Sprint, meditación y aguante.",talents:[E(0,0,"peaceful_break",Z("Peaceful Break","tk_hptime",qw(.6),5)),E(0,1,"tempered",Z("Cuerpo templado","tk_sptime",Ge(6),5)),E(1,0,"breathing",Z("Respiración","sl_kaupe",ma(.2))),E(1,1,"sprint_cd",W(Nt("Carrerilla","sprint",.06),"tk_run")),E(1,2,"guard",Z("Guardia","tk_dodge",lt(.4))),E(2,1,"sprint_dur",kn("Fondo","sl_kaite","sprint", {
    duration:.15
  },a=>`Sprint dura un +${15*a}%.`,2),"sprint_cd"),E(2,2,"temper",Z("Temple","sl_kaizel",ct(.015)),"guard"),E(2,3,"dodge",Z("Flee","tk_dodge",ut(.01))),E(3,0,"meditation",Z("Meditación","tk_mission",qw(1),2)),E(3,3,"mission",Z("Taekwon Mission","tk_mission",Io(.03),2)),E(4,1,"stride",Z("Zancada","sl_kaahi",gt(.02),2),"sprint_dur"),E(4,2,"iron_body",na("Cuerpo de hierro","sl_kaina",[lt(.5),Ge(5)],2)),E(5,0,"comfort",na("Comfort","sg_sun_comfort",[ct(.02),ma(.2)],2)),E(5,1,"knowledge",na("Knowledge","sg_knowledge",[gt(.02),ut(.01)],2),"stride"),E(6,1,"soul_link",W(i1("Soul Link","sl_soullinker",[NA(1)]),"sl_soullinker"),"knowledge")]
}
]);
Ko("ninja",[ {
  name:"Arrojadizas",icon:"nj_syuriken",desc:"Shuriken y Huuma: lluvia de acero.",talents:[E(0,0,"dagger_throwing",na("Dagger Throwing Practice","nj_tobidougu",[X(.015),rn(.02)],5)),E(0,1,"shuriken_dmg",ot("Filo de shuriken","shuriken",.06,5)),E(1,0,"wrist",Z("Muñeca firme","nj_tobidougu",rn(.03))),E(1,1,"shuriken_cd",W(Nt("Lanzamiento rápido","shuriken",.05),"ko_muchanage")),E(1,2,"huuma_dmg",ot("Huuma afilado","huuma",.08)),E(2,1,"shuriken_count",W(Na("Más shurikens","shuriken",1,2,"shuriken"),"ko_happokunai"),"shuriken_cd"),E(2,2,"huuma_cd",W(Nt("Huuma rápido","huuma",.06),"ko_huumaranka"),"huuma_dmg"),E(2,3,"zeny_throw",Z("Zeny Nage","nj_zenynage",mo(.06))),E(3,0,"pierce",W(sp("Shuriken perforante","shuriken",2),"nj_kirikage")),E(3,2,"huuma_pierce",W(sp("Huuma perforante","huuma",2),"ko_setsudan")),E(4,1,"barrage",na("Andanada","ko_jyumonjikiri",[X(.02),rn(.02)]),"shuriken_count"),E(4,3,"huuma_basic",W(ot("Huuma al cuerpo",sa,.08,2),"nj_huuma")),E(5,0,"kunai_rain",W(Na("Lluvia de kunais",sa,1,1,"proyectil"),"ko_makibishi")),E(5,1,"giant_wheel",W(ot("Rueda gigante","huuma",.12,2),"ko_huumaranka"),"barrage"),E(6,1,"blaze_shuriken",W(co("Blaze Shuriken","shuriken", {
    dmg:.3,count:1
  }),"ko_happokunai"),"giant_wheel")]
}, {
  name:"Ninjutsu",icon:"nj_kouenka",desc:"Flaming Petals y Lightning Strike: fuego y rayo ninja.",talents:[E(0,0,"ninja_soul",Z("Soul","nj_nen",X(.025),5)),E(0,1,"petals_dmg",ot("Pétalos ardientes","flaming_petals",.06,5)),E(0,2,"strike_dmg",ot("Descarga","lightning_strike",.06,5)),E(1,0,"chakra",Z("Chakra","nj_ninpou",tt(.02))),E(1,1,"petals_count",W(Na("Más pétalos","flaming_petals",1,2,"pétalo"),"nj_kaensin")),E(1,2,"strike_area",W(Xa("Campo eléctrico","lightning_strike",.08),"nj_huujin")),E(2,1,"petals_cd",W(Nt("Sellos rápidos","flaming_petals",.06),"nj_bakuenryu"),"petals_count"),E(2,2,"strike_cd",W(Nt("Trueno veloz","lightning_strike",.06),"nj_kamaitachi"),"strike_area"),E(2,3,"expansion",Z("Expansión","nj_suiton",Ut(.03))),E(3,0,"casting",Z("Sellos de mano","nj_ninpou",Ys(.05))),E(3,2,"ice",W(da("Hyousensou","lightning_strike",a=>( {
    slow:.5*a
  }),a=>`Lightning Strike ralentiza ${is(.5*Math.max(1,a))} s.`,2),"nj_hyousensou")),E(4,1,"fire_dragon",W(ot("Dragón de fuego","flaming_petals",.1,2),"nj_bakuenryu"),"petals_cd"),E(4,3,"exorcism",Z("Exorcismo ninja","ko_kaihou",La(.04))),E(5,0,"izayoi",na("Izayoi","ko_izayoi",[Ys(.04),tt(.01)],2)),E(5,1,"elements",na("Dominio elemental","ko_zenkai",[X(.02),Ut(.02)],2),"fire_dragon"),E(6,1,"raigeki",W(co("Raigeki","lightning_strike", {
    dmg:.3,area:.25
  }),"nj_raigekisai"),"elements")]
}, {
  name:"Sigilo",icon:"nj_utsusemi",desc:"Kunais, Flee y críticos.",talents:[E(0,0,"cicada",Z("Cicada Skin Shed","nj_utsusemi",ut(.01),5)),E(0,1,"kunai_dmg",ot("Kunai envenenado","kunai",.06,5)),E(1,0,"wind_feet",Z("Pies de viento","nj_shadowjump",gt(.015))),E(1,1,"kunai_cd",W(Nt("Mano rápida","kunai",.05),"ko_left")),E(1,2,"vital_point",Z("Punto vital","ko_right",Ee(.01))),E(2,1,"kunai_count",W(Na("Más kunais","kunai",1,2,"kunai"),"ko_happokunai"),"kunai_cd"),E(2,2,"lethal",Z("Golpe letal","ko_jyusatsu",zt(.1),2),"vital_point"),E(2,3,"illusion",Z("Ilusión","nj_bunsinjyutsu",za(.015))),E(3,0,"shadow",Z("Sombra","ko_zanzou",ut(.015),2)),E(3,2,"mist",W(da("Kasumikiri","kunai",a=>( {
    blind:.5*a
  }),a=>`Throw Kunai ciega ${is(.5*Math.max(1,a))} s.`,2),"nj_kasumikiri")),E(4,1,"kunai_poison",W(da("Veneno ninja","kunai",a=>( {
    poison:1.5*a
  }),a=>`Throw Kunai envenena +${is(1.5*Math.max(1,a))} de daño por segundo.`),"ko_jyusatsu"),"kunai_count"),E(4,3,"tatami",Z("Tatami Gaeshi","nj_tatamigaeshi",ct(.02))),E(5,0,"issen",na("Final Strike","nj_issen",[zt(.1),X(.02)],2)),E(5,1,"yamikumo",na("Yamikumo","ko_yamikumo",[Ee(.01),gt(.02)],2),"kunai_poison"),E(6,1,"kunai_storm",W(co("Tormenta de kunais","kunai", {
    count:2,dmg:.2
  }),"ko_genwaku"),"yamikumo")]
}
]);
Ko("gunslinger",[ {
  name:"Pistolero",icon:"gs_tripleaction",desc:"Triple Action y Rapid Shower: ráfagas de revólver.",talents:[E(0,0,"chain_action",Z("Chain Action","gs_chainaction",za(.02),5)),E(0,1,"triple_dmg",ot("Balas de punta hueca","triple_action",.06,5)),E(0,2,"rapid_dmg",ot("Gatillo fácil","rapid_shower",.06,3)),E(1,1,"triple_cd",W(Nt("Recarga rápida","triple_action",.05),"gs_increasing")),E(1,2,"rapid_count",W(Na("Ráfaga larga","rapid_shower",1,2,"bala"),"gs_gatlingfever")),E(1,3,"gun_mastery",W(ot("Gatillo rápido",sa,.06),"rl_qd_shot")),E(2,1,"triple_count",W(Na("Cargador ampliado","triple_action",1,2,"bala"),"gs_fullbuster"),"triple_cd"),E(2,2,"rapid_cd",W(Nt("Fuego continuo","rapid_shower",.06),"rl_firedance"),"rapid_count"),E(3,0,"fling",W(da("Fling","triple_action",a=>( {
    mark:.04*a,markTime:3
  }),a=>`Los enemigos que alcanza Triple Action reciben un +${4*Math.max(1,a)}% de daño durante 3 s.`,2),"gs_fling")),E(3,3,"basic_count",W(Na("Disparo doble",sa,1,1,"bala"),"rl_e_chain")),E(4,1,"gatling",na("Gatling Fever","gs_gatlingfever",[za(.015),X(.02)]),"triple_count"),E(4,2,"adjustment",Z("Adjustment","gs_adjustment",ut(.015),2)),E(5,0,"heat_barrel",na("Heat Barrel","rl_heat_barrel",[tt(.02),X(.01)],2)),E(5,1,"fire_dance",W(ot("Fire Dance","rapid_shower",.1,2),"rl_firedance"),"gatling"),E(6,1,"full_buster",W(co("Full Buster","triple_action", {
    count:2,dmg:.2
  }),"gs_fullbuster"),"fire_dance")]
}, {
  name:"Escopeta",icon:"gs_spreadattack",desc:"Spread Attack y Desperado: destrucción a corta distancia.",talents:[E(0,0,"madness",Z("Madness Canceller","gs_madnesscancel",tt(.015),5)),E(0,1,"spread_dmg",ot("Perdigones","spread_attack",.06,5)),E(0,2,"desperado_dmg",ot("Desperado letal","desperado",.06,3)),E(1,0,"vest",Z("Chaleco","rl_p_alter",lt(.4))),E(1,1,"spread_area",W(Xa("Cono amplio","spread_attack",.06),"rl_s_storm")),E(1,2,"desperado_count",W(Na("Más ráfagas","desperado",1,2,"ráfaga"),"gs_desperado")),E(2,1,"spread_cd",W(Nt("Bombeo rápido","spread_attack",.06),"rl_slugshot"),"spread_area"),E(2,2,"desperado_cd",W(Nt("Desenfunde","desperado",.06),"rl_flicker"),"desperado_count"),E(2,3,"tough",Z("Duro","rl_d_tail",Ge(8))),E(3,0,"knockback",W(da("Postas","spread_attack",a=>( {
    slow:.4*a
  }),a=>`Spread Attack ralentiza ${is(.4*Math.max(1,a))} s.`,2),"gs_cracker")),E(3,2,"dust",W(da("Dust","desperado",a=>( {
    blind:.5*a
  }),a=>`Desperado ciega ${is(.5*Math.max(1,a))} s.`,2),"gs_dust")),E(4,1,"slug",W(ot("Slug Shot","spread_attack",.1,2),"rl_slugshot"),"spread_cd"),E(4,3,"p_alter",na("Platinum Alter","rl_p_alter",[ct(.02),Ge(5)],2)),E(5,0,"mass_spiral",na("Mass Spiral","rl_mass_spiral",[zt(.1),X(.01)],2)),E(5,1,"banishing",na("Banishing Buster","rl_banishing_buster",[Ut(.03),X(.02)],2),"slug"),E(6,1,"last_stand",W(co("Desperado infinito","desperado", {
    dmg:.3,count:1
  }),"rl_fire_rain"),"banishing")]
}, {
  name:"Francotirador",icon:"gs_tracking",desc:"Tracking y Ground Drift: disparos certeros y granadas.",talents:[E(0,0,"single_action",na("Single Action","gs_singleaction",[X(.015),Ee(.005)],5)),E(0,1,"tracking_dmg",ot("Bala perforante","tracking",.06,5)),E(0,2,"snake_eye",na("Snake Eye","gs_snakeeye",[rn(.02),Ut(.012)],5)),E(1,1,"tracking_cd",W(Nt("Cerrojo","tracking",.05),"gs_bullseye")),E(1,2,"drift_dmg",ot("Granada potente","ground_drift",.08)),E(1,3,"sight",Z("Mira","gs_glittering",Ee(.01))),E(2,1,"headshot",Z("Disparo en la cabeza","gs_piercingshot",zt(.1),2),"tracking_cd"),E(2,2,"drift_area",W(Xa("Metralla","ground_drift",.1,2),"rl_h_mine"),"drift_dmg"),E(3,0,"calm",Z("Calma","gs_glittering",X(.02))),E(3,2,"drift_cd",W(Nt("Granadas en serie","ground_drift",.06),"rl_b_trap")),E(3,3,"tracking_count",W(Na("Doble objetivo","tracking",1,1,"objetivo"),"rl_c_marker")),E(4,1,"bullseye",Z("Bull's Eye","gs_bullseye",La(.05)),"headshot"),E(4,2,"drift_stun",W(da("Onda expansiva","ground_drift",hi(.05),a=>`Ground Drift aturde con un ${5*Math.max(1,a)}% de probabilidad.`,2),"rl_am_blast")),E(5,0,"magical_bullet",na("Magical Bullet","gs_magicalbullet",[X(.02),tt(.01)],2)),E(5,1,"fallen_angel",na("Fallen Angel","rl_fallen_angel",[Ee(.01),zt(.05)],2),"bullseye"),E(6,1,"hammer_of_god",W(co("Hammer of God","tracking", {
    count:1,dmg:.3
  }),"rl_hammer_of_god"),"fallen_angel")]
}
]);
const ua= {
  sd:ot,sc:Nt,sn:Na,ssp:AG,sa:Xa,sp,sh:da,st:Z,sts:na,sm:kn,capMod:co,capStat:i1,wpn:ts,ic:W,at:E,onPath:RG,trees:Ko,withShield:Ql,basicCone:Hp,withBasicCone:XE,stunHit:hi,dec:is,sk:ci,CONE_SKILL:$E
};
function Eu(a) {
  return Object.values(nl).filter(e=>e.job===a)
}
function KE(a,e,t) {
  return Eu(a).filter(n=>n.branch===e).reduce((n,s)=>n+(t[s.id]??0),0)
}
function JE(a,e) {
  return Object.entries(a).reduce((t,[n,s])=> {
    var o;return t+(!e||((o=nl[n])==null?void 0:o.job)===e?s:0)
  },0)
}
function O9(a) {
  return a
}
function QE(a,e,t=a) {
  return t===a?e:al(a).includes(t)?r7[nu(t).rank??1]:0
}
function e7(a,e,t,n=a) {
  return Math.max(0,QE(a,e,n)-JE(t,n))
}
function j9(a,e,t) {
  return Object.keys(t).some(n=> {
    var s;return!al(a).includes((s=nl[n])==null?void 0:s.job)
  })||al(a).some(n=>JE(t,n)>QE(a,e,n))
}
function ZE(a,e) {
  return KE(a.job,a.branch,e)-tC(a,e)>=a.row*VE
}
function t7(a) {
  return[a.req,a.req2].filter(e=>!!e)
}
function l1(a,e) {
  return t7(a).every(t=> {
    var n;return(e[t]??0)>=(((n=nl[t])==null?void 0:n.maxRank)??0)
  })
}
function a7(a,e) {
  return(nu(a.job).rank??1)<2||e===void 0||e===a.branch
}
function G9(a) {
  return Math.max(SG,...Eu(a).map(e=>Math.ceil(e.col)+1))
}
function n7(a,e) {
  if(!a.path)return null;
  const t=a.path.slice(0,a.path.lastIndexOf("."));
  for(const n of Eu(a.job))if(!(n.branch!==a.branch||!n.path||n.path===a.path||(e[n.id]??0)<=0)&&n.path.slice(0,n.path.lastIndexOf("."))===t)return n.path;
  return null
}
function eC(a,e) {
  return n7(a,e)===null
}
function V9(a,e,t,n,s) {
  return a7(a,s)&&eC(a,n)&&(n[a.id]??0)<a.maxRank&&e7(e,t,n,a.job)>0&&ZE(a,n)&&l1(a,n)
}
function W9(a,e) {
  if((e[a.id]??0)<=0)return!1;
  const t= {
    ...e,[a.id]:e[a.id]-1
  };
  return Eu(a.job).filter(n=>n.branch===a.branch&&(t[n.id]??0)>0).every(n=>KE(a.job,a.branch,t)-tC(n,t)>=n.row*VE&&l1(n,t))
}
function $9(a) {
  return Object.keys(a).every(e=> {
    const t=nl[e];return!!t&&ZE(t,a)&&l1(t,a)&&eC(t,a)
  })
}
function tC(a,e) {
  return Eu(a.job).filter(t=>t.branch===a.branch&&t.row>=a.row).reduce((t,n)=>t+(e[n.id]??0),0)
}
function Y9(a) {
  return Math.round(30*a*a*il(1.07,a))
}
function X9(a,e) {
  const t=a-e;
  return t<=0?1:Math.max(o7,il(s7,t))
}
const s7=.5,o7=.01,r7= {
  1:50,2:50,3:70
},aC=.75,K9=aC*1.7;
function J9(a) {
  const e=Hw*a;
  return Math.max(10,Math.round(aC*Hw*30*e*e*il(1.07,e)))
}
const Hw=.47;
function Q9(a) {
  return Math.round(20*a*a*il(1.06,a))
}
function Z9(a) {
  return Math.floor((a-1)/2)
}
function e$(a,e) {
  if(e<2)return 80+45*(a-1);
  const t=34.375+11.25*(a-1);
  return Math.round(e<3?t:4*t)
}
function t$(a) {
  const e=a-1;
  return Math.round(60+40*e+2*e*e)
}
function At(a,e) {
  const t=va[e];
  if(!t)throw new Error(`Skill sin definir: ${e}`);
  return(Lm[a]??(Lm[a]=[])).push(e), {
    name:nA(t,"name"),icon:t.icon,maxRank:1,learn:e,desc:()=>`${bt("Aprendes la skill {skill}",{skill:t.name})}: ${t.desc(1)}`
  }
}
function Le(a,e,t,n,s,o=3) {
  return ua.st(a,e,bu(t,s)(n),o)
}
function jd(a,e) {
  return t=>( {
    apply:(n,s)=>a(n,t*s),text:n=>Pt(e(t*n))
  })
}
const nt=a=>`${String(Math.round(a*1e3)/10).replace(".",",")}%`,ss=a=>String(Math.round(a*10)/10).replace(".",",");
function Tn(a,e,t) {
  return t*(1+e.mod(a).dmg)
}
function Un(a,e,t={}) {
  const n=e.mod(a).hit,s= {
    ...n,...t,src:e.id,power:e.power(a)
  };
  for(const[o,r]of Object.entries(n))typeof r=="number"&&typeof t[o]=="number"&&(s[o]=r+t[o]);
  return s
}
function i7(a,e) {
  const t=a.player;
  return a.enemiesInRadius(t.x,t.y,e).filter(n=>!n.dead).sort((n,s)=>+!!s.def.boss-+!!n.def.boss||+!!s.elite-+!!n.elite||s.hp-n.hp)[0]??null
}
function Mr(a,e,t,n,s,o,r,i,l=.3) {
  const d=s*1e3;
  a.addFx(mu(a,e,t,n,d,r,l)),Iv(a, {
    x:e,y:t
  },n,.92,r[0],d,.5);
  for(let c=1;c*o<=s+1e-6;c++)a.schedule(c*o,()=> {
    const u=a.player;i(a.enemiesInRadius(e,t,n),Qt(u.x-e,u.y-t)<=n)
  })
}
function nC(a,e) {
  const t=new Fn(xt.sheet(e.sheet),"idle");
  t.anchor.set(.5,1),t.scale.set(e.scale??1);
  const n=new ue;
  n.addChild(t);
  const s= {
    x:e.x,y:e.y,alive:!0
  };
  let o=0,r=.4,i=0,l=null;
  const d= {
    view:n,anchor:s,upright:!0,update(c) {
      const u=c/1e3;
      o+=u,t.update(c);
      const h=a.player;
      if(l&&(i-=u)>0)s.x+=(l.x-s.x)*Math.min(1,u*14),s.y+=(l.y-s.y)*Math.min(1,u*14);
      else if(e.follow) {
        l=null;
        const m=h.x-40,p=h.y+18;
        Qt(m-s.x,p-s.y)>4?(s.x+=(m-s.x)*Math.min(1,u*4),s.y+=(p-s.y)*Math.min(1,u*4),t.play("walk"),t.dir=tl(m-s.x,p-s.y)):t.play("idle")
      }
      if((r-=u)<=0&&!h.dead) {
        const m=a.enemiesInRadius(s.x,s.y,e.range).filter(p=>!p.dead).sort((p,g)=>Qt(p.x-s.x,p.y-s.y)-Qt(g.x-s.x,g.y-s.y))[0];
        m?(r=e.every,t.dir=tl(m.x-s.x,m.y-s.y),t.play("attack",!1,!0),e.dash&&(l= {
          x:m.x,y:m.y
        },i=.25),a.schedule(e.dash?.12:.2,()=>!m.dead&&e.hit(m,s))):r=.2
      }
      return t.finished&&t.play("idle"),o>e.life-.4&&(t.alpha=Math.max(0,(e.life-o)/.4)),o<e.life?!1:(s.alive=!1,!0)
    }
  };
  return a.addFx(d),a.addFx(Vn(e.x,e.y,$t("tex_pok3"),8,14221264,600,64,.4)),s
}
const Ow=.35,l7=46,sC=1.2,as= {
  ride:"pecoRide",trample:"pecoTrample",trampleKnock:"pecoTrampleKnock",trampleMark:"pecoTrampleMark",gallop:"pecoGallop",war:"pecoWar",riposte:"riposte"
},jw=.3;
function oC(a,e) {
  return {
    name:a,icon:e,maxRank:1,stat:t=> {
      t.ext[as.ride]=1,t.speedMult+=jw
    },desc:()=>`Montas tu Peco Peco: vas un ${nt(jw)} más rápido y se activan los talentos de tu montura (pisotón, galope...).`
  }
}
jE("peco","Peco Peco","kn_riding","Tu montura: pisotea a los enemigos al cabalgar entre ellos.");
const rC=a=>`Al cabalgar, tu Peco pisotea a los enemigos que tienes debajo: ${ss(a)} de daño por segundo (crece con el ATK cuerpo a cuerpo)`,d7=a=>`Los enemigos pisoteados reciben un ${nt(a)} más de daño durante 3 s`,iC=a=>`Tras ${ss(sC)} s cabalgando sin parar, +${nt(a)} de daño`,c7=a=>`Al recibir un golpe, tus ataques básicos hacen +${nt(a)} de daño durante 3 s`;
Ct.tick.push((a,e)=> {
  const t=a.player;a.ext.rideT=t.moving?(a.ext.rideT??0)+e:0;const n=oe(a,as.trample);if(!n||!t.moving||!oe(a,as.ride)||(a.ext.trampleT=(a.ext.trampleT??0)-e,a.ext.trampleT>0))return;a.ext.trampleT=Ow;const s=n*Ow*(1+oe(a,as.war))*a.stats.powerMelee,o=oe(a,as.trampleKnock),r=oe(a,as.trampleMark);for(const i of a.enemiesInRadius(t.x,t.y,l7))a.damageEnemy(i,s, {
    src:"peco",part:"Pisotón",knock:o,fromX:t.x,fromY:t.y,...r? {
      mark:r,markTime:3
    }
    :{},hitFx:(l,d)=>Da(l,d,10,.6),sounds:["hit_fist1","hit_fist2"]
  })
});
Ct.damageMult.push((a,e,t)=> {
  let n=1;const s=oe(a,as.gallop);s&&oe(a,as.ride)&&(a.ext.rideT??0)>=sC&&(n*=1+s);const o=oe(a,as.riposte);return o&&t.src&&ku(t.src)&&(a.ext.riposteUntil??0)>a.time&&(n*=1+o),n
});
Ct.hurt.push((a,e)=>(oe(a,as.riposte)&&(a.ext.riposteUntil=a.time+3),e));
const {
  onPath:Ii,sm:pc,sh:qr
}
=ua,Us=a=> {
  var e;
  return((e=va[a])==null?void 0:e.name)??a
},Qn=a=>`${Qr(a*100,1)}%`,ud=a=>Qr(a,1),lC= {
  damage:"de daño",crit:"de crítico",speed:"de velocidad"
},Gw=(a,e)=>a.weapons.find(t=>t.id===e),Ss=(a,e)=>`fin.${a}.${e}`;
function Ai(a,e,t,n,s) {
  return Ii(a, {
    name:e,icon:t,maxRank:1,stat:(o,r)=>bu(n,()=>"")(1).apply(o,r),desc:()=>`${s()}.`
  })
}
function u7(a,e,t) {
  const n=e.aim(a);
  n!==null&&e.fireBoosted(a,n,t)
}
const dC=[],cC=[],uC=new Set,hC=[],mC=new Set,pC=[],fC=[],Vw=new WeakMap;
function R0(a,e,t) {
  let n=Vw.get(a);
  return n||Vw.set(a,n=new Map),a.time-(n.get(e)??-99)<t?!1:(n.set(e,a.time),!0)
}
Ct.hit.push((a,e,t,n)=> {
  const s=n.src;if(!(!s||n.part)) {
    if(ku(s))for(const o of dC) {
      if(!oe(a,Ss("auto",o.skill))||Wt()>=o.chance||!R0(a,`auto.${o.skill}`,.4))continue;const r=Gw(a,o.skill);r&&u7(a,r,o.mult)
    }
    for(const o of cC) {
      if(o.skill!==s||!oe(a,Ss("field",s))||!R0(a,`field.${s}`,.6))continue;const r=t*o.pctPerSec;Mr(a,e.x,e.y,80*a.stats.areaMult,o.secs,1,[16770984,16774872],i=> {
        for(const l of i)a.damageEnemy(l,r, {
          src:s,part:"Zona"
        })
      })
    }
    if(uC.has(s)&&oe(a,Ss("chain",s))) {
      const o=a.enemiesInRadius(e.x,e.y,220).find(r=>r!==e&&!r.dead);o&&a.schedule(.12,()=>!o.dead&&a.damageEnemy(o,t*.5, {
        src:s,part:"Rebote"
      }))
    }
    for(const o of hC)o.skill===s&&oe(a,Ss("execute",s))&&!e.dead&&!e.def.boss&&e.hp>0&&e.hp<e.maxHp*o.hp&&a.damageEnemy(e,e.maxHp*3, {
      src:s,part:"Remate"
    });if(mC.has(s)&&oe(a,Ss("refresh",s))&&e.hp<=0&&R0(a,`refresh.${s}`,1)) {
      const o=Gw(a,s);o&&(o.timer=Math.min(o.timer,.3))
    }
    for(const o of pC)o.skill===s&&oe(a,Ss("leech",s))&&a.healPlayer(t*o.v)
  }
});
Ct.cast.push((a,e)=> {
  for(const t of fC)t.skill===e.id&&oe(a,Ss("empower",e.id))&&a.addBuff(t.buff,t.v,t.secs,e.id)
});
const se= {
  auto(a,e,t,n,s=.12,o=.6) {
    return dC.push( {
      skill:e,chance:s,mult:o
    }),Ai(a,t,n,Ss("auto",e),()=>bt("Tus ataques básicos tienen un {a} de probabilidad de lanzar {skill} gratis, con un {b} de su daño", {
      a:Qn(s),b:Qn(o),skill:Us(e)
    }))
  },heavy(a,e,t,n,s=1.5,o=.5) {
    return Ii(a,pc(t,n,e, {
      dmg:s,area:o
    },()=>bt("{skill} hace un {a} más de daño en un {b} más de área.", {
      a:Qn(s),b:Qn(o),skill:Us(e)
    }),1))
  },echo(a,e,t,n) {
    return Ii(a,pc(t,n,e, {
      double:1
    },()=>bt("{skill} sale siempre dos veces seguidas.", {
      skill:Us(e)
    }),1))
  },field(a,e,t,n,s=.15,o=4) {
    return cC.push( {
      skill:e,pctPerSec:s,secs:o
    }),Ai(a,t,n,Ss("field",e),()=>bt("Donde golpea {skill} queda una zona {a} s que hace cada segundo un {b} de su golpe a los que están dentro", {
      a:ud(o),b:Qn(s),skill:Us(e)
    }))
  },chain(a,e,t,n) {
    return uC.add(e),Ai(a,t,n,Ss("chain",e),()=>bt("Cada golpe de {skill} rebota a otro enemigo cercano con la mitad del daño", {
      skill:Us(e)
    }))
  },execute(a,e,t,n,s=.2) {
    return hC.push( {
      skill:e,hp:s
    }),Ai(a,t,n,Ss("execute",e),()=>bt("{skill} remata a los enemigos que no son jefes y se quedan por debajo del {a} de vida", {
      a:Qn(s),skill:Us(e)
    }))
  },refresh(a,e,t,n) {
    return mC.add(e),Ai(a,t,n,Ss("refresh",e),()=>bt("Si {skill} mata a un enemigo, se recarga al momento (como mucho una vez por segundo)", {
      skill:Us(e)
    }))
  },leech(a,e,t,n,s=.1) {
    return pC.push( {
      skill:e,v:s
    }),Ai(a,t,n,Ss("leech",e),()=>bt("{skill} te cura un {a} del daño que hace", {
      a:Qn(s),skill:Us(e)
    }))
  },empower(a,e,t,n,s,o,r=5) {
    return fC.push( {
      skill:e,buff:s,v:o,secs:r
    }),Ai(a,t,n,Ss("empower",e),()=>bt("Lanzar {skill} te da un {a} más {what} durante {b} s", {
      a:Qn(o),b:ud(r),what:bt(lC[s]),skill:Us(e)
    }))
  },long(a,e,t,n,s=1) {
    return Ii(a,pc(t,n,e, {
      duration:s
    },()=>bt("{skill} dura un {a} más.", {
      a:Qn(s),skill:Us(e)
    }),1))
  },quick(a,e,t,n,s=.6) {
    return Ii(a,pc(t,n,e, {
      cd:s
    },()=>bt("{skill} se recarga un {a} más rápido.", {
      a:Qn(1-1/(1+s)),skill:Us(e)
    }),1))
  },more(a,e,t,n,s=3) {
    return Ii(a,pc(t,n,e, {
      count:s
    },()=>bt("{skill} llega a {a} objetivos más.", {
      a:s,skill:Us(e)
    }),1))
  },control(a,e,t,n,s,o=1) {
    const r=s==="freeze"? {
      freeze:o,freezeChance:1
    }
    : {
      stun:o,stunChance:1
    };
    return Ii(a, {
      ...qr(t,e,()=>r,()=>bt(s==="freeze"?"{skill} congela {a} s a todos los que golpea.":"{skill} aturde {a} s a todos los que golpea.", {
        a:ud(o),skill:Us(e)
      }),1),icon:n
    })
  }
},h7=[[1,3,6],[4,6,7]],m7=[0,1,2,4,5,7,8];
function Ht(a,e,t) {
  const {
    at:n
  }
  =ua,s=[n(0,0,"s1",t(a,e.skills[0])),n(3,3,"s2",t(a,e.skills[1])),...e.passives.map((r,i)=>n(m7[i],2,`p${i}`,r))],o={};
  return e.paths.forEach((r,i)=> {
    const l=i<2?0:1,d=i%2===0?"a":"b",c=`${e.skills[l]}.${d}`,u=l*3+i%2,h=`s${l+1}`;o[c]= {
      name:r.name,desc:r.desc
    },r.steps.forEach((m,p)=>s.push(n(h7[l][p],u,`s${l+1}${d}${p+1}`, {
      ...m,path:c
    },p===0?h:void 0))),s.push(n(9,u,`s${l+1}${d}f`, {
      ...r.final,path:c
    }))
  }), {
    name:e.name,icon:e.icon,desc:e.desc,paths:o,talents:s
  }
}
const gC=[];
Ct.cast.push((a,e)=> {
  for(const t of gC) {
    const n=t.skill===e.id?oe(a,t.k):0;n&&a.addBuff(t.buff,n,t.secs,e.id)
  }
});
const Br=a=>ua.sk(a),Nr=(a,e)=>a*Math.max(1,e),Y= {
  bleed:(a,e,t,n=3)=>ua.ic(qr(a,e,s=>( {
    bleed:.15*s
  }),s=>bt("{skill} hace sangrar un {a} de su daño en 3 s.", {
    a:Qn(Nr(.15,s)),skill:Br(e)
  }),n),t),mark:(a,e,t,n=3)=>ua.ic(qr(a,e,s=>( {
    mark:.05*s,markTime:4
  }),s=>bt("Los que golpea {skill} reciben un +{a} de daño durante 4 s.", {
    a:Qn(Nr(.05,s)),skill:Br(e)
  }),n),t),stun:(a,e,t,n=.08,s=3)=>ua.ic(qr(a,e,ua.stunHit(n),o=>bt("{skill} aturde con un {a} de probabilidad.", {
    a:Qn(Nr(n,o)),skill:Br(e)
  }),s),t),weaken:(a,e,t,n=3)=>ua.ic(qr(a,e,s=>( {
    weaken:.08*s,weakenTime:5
  }),s=>bt("Los que golpea {skill} hacen un {a} menos de daño durante 5 s.", {
    a:Qn(Nr(.08,s)),skill:Br(e)
  }),n),t),slow:(a,e,t,n=3)=>ua.ic(qr(a,e,s=>( {
    slow:.5*s
  }),s=>bt("{skill} ralentiza {a} s a los que golpea.", {
    a:ud(Nr(.5,s)),skill:Br(e)
  }),n),t),blind:(a,e,t,n=3)=>ua.ic(qr(a,e,s=>( {
    blind:.6*s
  }),s=>bt("{skill} ciega {a} s a los que golpea.", {
    a:ud(Nr(.6,s)),skill:Br(e)
  }),n),t),crit:(a,e,t,n=3)=>ua.ic(qr(a,e,s=>( {
    critDmg:.1*s
  }),s=>bt("Los críticos de {skill} hacen un +{a} de daño.", {
    a:Qn(Nr(.1,s)),skill:Br(e)
  }),n),t),castBuff(a,e,t,n,s,o=6,r=3) {
    const i=`step.${n}.${e}`;
    return gC.push( {
      k:i,skill:e,buff:n,secs:o
    }), {
      name:a,icon:t,maxRank:r,stat:(l,d)=>bu(i,()=>"")(s).apply(l,d),desc:l=>bt("Lanzar {skill} te da un {a} más {what} durante {b} s.", {
        a:Qn(Nr(s,l)),b:ud(o),what:bt(lC[n]),skill:Br(e)
      })
    }
  }
}, {
  trees:p7,sd:ki,sc:Dl,sn:Ww,sa:$w,sh:jr,st:Hn,sm:z0,ic:Ta,wpn:L0,dec:f7
}
=ua,Oh="knight";
ke("brandish_spear","Brandish Spear","pr_brandishspear", {
  cd:8,type:"aoe",tags:["melee","area","physical","neutral"]
},a=>a===1?"Barres con el arma todo lo que tienes delante desde el Peco: daña y aparta a los enemigos del abanico.":"+20% daño y +8% área.",a=>new dn(a, {
  cd:I(8),dmg:ee(46,.2),range:ee(165,.08),sound:"hit_sword",hit:()=>( {
    knock:150,...Ft.LENS_ONLY
  }),cone: {
    pct:1,angle:130,fx:(e,t,n,s,o,r)=>hu(e,t,n,s,o,r,14674175)
  }
}));
const Yw=380,D0=6,yC=.4;
ke("charge_attack","Charge Attack","kn_chargeatk", {
  cd:9,type:"single",tags:["melee","single","physical","neutral"],effects:[ {
    key:"stun",label:"Aturdimiento",base:.8,step:.15,fmt:"s"
  }
  ]
},()=>`El Peco carga contra el enemigo más fuerte a ${Math.round(Yw/60)} m: lo golpea con más fuerza cuanto más lejos estaba (hasta el doble) y lo aturde.`,a=>new pt(a,I(9),(e,t,n)=> {
  const s=e.player,o=n.mod(e),r=Yw*e.stats.reachMult*(1+o.reach),i=i7(e,r);if(!i)return!1;const l= {
    x:s.x,y:s.y
  },d=Qt(i.x-s.x,i.y-s.y)||1,c= {
    x:i.x-(i.x-s.x)/d*30,y:i.y-(i.y-s.y)/d*30
  };e.walk&&([c.x,c.y]=e.walk.nearestWalkable(c.x,c.y)),Gn(e,i.x,i.y),s.cast(),ce.play("ef_bash",.5);const u=oe(e,"chargePath"),h=[],m=[];for(let p=1;p<=D0;p++)e.schedule(p*.18/D0,()=> {
    const g=p/D0;if([s.x,s.y]=[l.x+(c.x-l.x)*g,l.y+(c.y-l.y)*g],m.push( {
      x:s.x,y:s.y
    }),u)for(const y of e.enemiesInRadius(s.x,s.y,40))y!==i&&!h.includes(y)&&(h.push(y),e.damageEnemy(y,Tn(e,n,60)*yC*u,Un(e,n, {
      part:"Arrollar",knock:160,fromX:s.x,fromY:s.y
    })))
  });return e.schedule(.2,()=> {
    if(e.addFx(bA(e,m,600,()=>{})),i.dead)return;const p=Math.min(1,d/r);e.addFx(vs(i.x,i.y)),e.damageEnemy(i,Tn(e,n,60)*(1+p),Un(e,n, {
      stun:n.eff("stun"),stunChance:1,knock:120,fromX:s.x,fromY:s.y,...Ft.LENS
    }))
  }),!0
},["dmg","cd"]));
ke("pierce","Pierce","kn_pierce", {
  cd:4.5,type:"single",tags:["melee","single","burst","physical","neutral"]
},a=>a===1?"Tres estocadas seguidas al enemigo más cercano.":"+20% daño.",a=>new Aa(a, {
  cd:I(4.5),dmg:ee(17,.2),count:I(1),target:"nearest",range:140,melee:!0,burst:()=>3,burstGap:.09,hit:()=>( {
    knock:20,...Ft.LENS
  }),fx:()=>null,sound:"hit_sword"
}));
ke("spear_boomerang","Spear Boomerang","kn_spearboomerang", {
  cd:7,type:"projectile",tags:["melee","projectile","pierce","return","physical","neutral"]
},a=>a===1?"Lanzas tu lanza: atraviesa a todos los enemigos y vuelve a tus manos.":"+20% daño.",a=>new Ua(a, {
  cd:I(7),dmg:ee(30,.2),count:I(1),speed:520,aim:"spread",pierce:I(99),returns:!0,radius:22,life:1.2,spin:0,view:()=>Pp("fx_spear",1.1,!1),orient:0,sound:"spear_boomerang",hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  })
}));
ke("auto_counter","Counter Attack","kn_autocounter", {
  cd:5,type:"aoe",tags:["melee","area","physical","neutral"]
},a=>a===1?"Cuando un enemigo te golpea, le devuelves un contraataque muy fuerte (y uno menor a los de alrededor).":"+20% daño y +10% área.",a=>new ck(a, {
  cd:I(5),dmg:ee(48,.2),radius:ee(90,.1),sound:"autocounter",hit:()=>Ft.LENS
}));
const g7=150,y7=220,Xw=.6;
ke("bowling_bash","Bowling Bash","kn_bowlingbash", {
  cd:6,type:"single",tags:["melee","single","burst","physical","neutral"]
},a=>a===1?`Dos golpes de espadón al enemigo más cercano que lo lanzan por los aires: los que están detrás reciben un ${nt(Xw)} del golpe y salen despedidos.`:"+20% daño.",a=>new pt(a,I(6),(e,t,n)=> {
  const s=e.player,o=n.mod(e);let r=null,i=g7*e.stats.reachMult*(1+o.reach);for(const y of e.enemiesInRadius(s.x,s.y,i)) {
    const f=Qt(y.x-s.x,y.y-s.y);!y.dead&&f<=i&&([r,i]=[y,f])
  }
  if(!r)return!1;const l=r;Gn(e,l.x,l.y),s.cast();const d=Qt(l.x-s.x,l.y-s.y)||1,[c,u]=[(l.x-s.x)/d,(l.y-s.y)/d],[h,m]=[l.x,l.y],p=Tn(e,n,32),g=y7*(1+o.area);for(let y=0;y<2;y++)e.schedule(y*.1,()=> {
    l.dead||(ce.play("ef_bash",.5),e.addFx(vs(l.x,l.y)),e.damageEnemy(l,p,Un(e,n, {
      knock:y?g:0,fromX:s.x,fromY:s.y,...Ft.LENS
    })))
  });return e.schedule(.22,()=> {
    const[y,f]=[h+c*g*.5,m+u*g*.5];for(const v of e.enemiesInRadius(y,f,g*.5+40)) {
      if(v===l||v.dead)continue;const b=(v.x-h)*c+(v.y-m)*u,_=Math.abs((v.x-h)*u-(v.y-m)*c);b<0||b>g||_>40||e.damageEnemy(v,p*2*Xw,Un(e,n, {
        part:"Bolos",knock:140,fromX:h,fromY:m,hitFx:(S,M)=>Da(S,M)
      }))
    }
  }),!0
},["dmg","cd"]));
const v7=a=>Le("Pisotón","lg_trample",as.trample,a,rC,5),jh=(a,e,t,n=3)=>Ta(jr(a,e,s=>( {
  bleed:.15*s
}),s=>`${ua.sk(e)} hace sangrar un ${15*Math.max(1,s)}% de su daño en 3 s.`,n),t),F0=(a,e,t,n=3)=>Ta(jr(a,e,s=>( {
  mark:.05*s,markTime:4
}),s=>`Los que golpea ${ua.sk(e)} reciben un +${5*Math.max(1,s)}% de daño durante 4 s.`,n),t),Gh=(a,e,t,n,s=3)=>Ta(jr(a,e,ua.stunHit(n),o=>`${ua.sk(e)} aturde con un ${Math.round(n*100)*Math.max(1,o)}% de probabilidad.`,s),t);
p7(Oh,[Ht(Oh, {
  name:"Caballería",icon:"kn_riding",desc:"Riding te monta en el Peco Peco: pisotón, galope, Brandish Spear y Charge Attack.",skills:["brandish_spear","charge_attack"],paths:[ {
    name:"Barrido montado",desc:"Brandish Spear barre más, frena y aparta a la horda, hasta aturdirla entera.",steps:[Ta($w("Barrido amplio","brandish_spear",.1,3),"lg_overbrand"),Ta(jr("Barrido aplastante","brandish_spear",a=>( {
      slow:.6*a
    }),a=>`Brandish Spear ralentiza ${f7(.6*Math.max(1,a))} s.`,3),"lg_earthdrive"),Ta(jr("Empuje de lanza","brandish_spear",a=>( {
      knock:60*a
    }),a=>`Brandish Spear empuja ${60*Math.max(1,a)} px más.`,2),"ms_bash")],final:se.control("brandish_spear.a","brandish_spear","Barrido demoledor","ms_berserk","stun",1)
  }, {
    name:"Lanza feroz",desc:"Brandish Spear pega más y más a menudo, y acaba siendo un tajo devastador.",steps:[Ta(ki("Brandish Spear mejorado","brandish_spear",.08,3),"lg_pinpointattack"),Ta(Dl("Barrido rápido","brandish_spear",.06,3),"ms_bowlingbash"),jh("Corte profundo","brandish_spear","ms_magnum",2)],final:se.heavy("brandish_spear.b","brandish_spear","Brandish de guerra","ms_parrying")
  }, {
    name:"Arrollar",desc:"Charge Attack llega más lejos, aturde y atropella a todos los del camino.",steps:[Ta(Dl("Espuelas","charge_attack",.08,3),"ra_wugrider"),z0("Galope tendido","lg_banishingpoint","charge_attack", {
      reach:.15,dmg:.05
    },a=>`Charge Attack llega un ${15*a}% más lejos y hace +${5*a}% de daño.`,3),Gh("Carga aturdidora","charge_attack","ms_reflectshield",.1,2)],final:Le("Arrollar","lg_exeedbreak","chargePath",1,()=>`Charge Attack atropella a los enemigos del camino: reciben un ${nt(yC)} de su golpe y salen despedidos`,1)
  }, {
    name:"Carga sin fin",desc:"Charge Attack pega más, debilita y marca, y si mata vuelve a estar lista.",steps:[Ta(ki("Embestida de lanza","charge_attack",.08,3),"gd_extension"),Ta(jr("Carga intimidante","charge_attack",a=>( {
      weaken:.1*a,weakenTime:5
    }),a=>`Charge Attack hace que el enemigo haga un ${10*Math.max(1,a)}% menos de daño durante 5 s.`,3),"gd_gloryguild"),F0("Lanza marcada","charge_attack","gd_glorywounds",2)],final:se.refresh("charge_attack.b","charge_attack","Carga incansable","gd_guardresearch")
  }
  ],passives:[oC("Riding","kn_riding"),v7(4),Le("Galope","rk_dragontraining",as.gallop,.03,iC,5),Hn("Cavalier Mastery","kn_cavaliermastery",gt(.02),5),Hn("Silla de guerra","rk_abundance",lt(.4),5),Hn("Peco acorazado","rk_millenniumshield",ct(.015),5),Hn("Brío","lg_piety",Ls(.02),5)]
},At),Ht(Oh, {
  name:"Lanza",icon:"kn_spearmastery",desc:"Pierce y Spear Boomerang: estocadas y lanzas que vuelven.",skills:["pierce","spear_boomerang"],paths:[ {
    name:"Estocada múltiple",desc:"Pierce alcanza a más enemigos, más a menudo, y cada estocada salta a otro.",steps:[Ta(Ww("Estocada doble","pierce",1,2,"objetivo"),"lg_rayofgenesis"),Ta(Dl("Estocadas veloces","pierce",.06,3),"gd_guardup"),jh("Herida abierta","pierce","dk_hackandslasher",3)],final:se.chain("pierce.a","pierce","Estocada en cadena","gd_guild_storage")
  }, {
    name:"Perforación",desc:"Pierce rompe la armadura, pega críticos más fuertes y remata a los heridos.",steps:[Ta(ki("Pierce mejorado","pierce",.06,3),"rk_runemastery"),F0("Romper armadura","pierce","rk_crushstrike",3),Ta(jr("Punta certera","pierce",a=>( {
      critDmg:.1*a
    }),a=>`Los críticos de Pierce hacen un +${10*Math.max(1,a)}% de daño.`,2),"gd_hawkeyes")],final:se.execute("pierce.b","pierce","Estocada final","gd_kafracontract")
  }, {
    name:"Lanza que vuelve",desc:"Más lanzas, más rápidas, hasta que tus golpes las lanzan solos.",steps:[Ta(Ww("Dos lanzas","spear_boomerang",1,2,"lanza"),"dk_chargingpierce"),z0("Vuelo raso","dk_stormslash","spear_boomerang", {
      speed:.15,area:.1
    },a=>`Spear Boomerang vuela un ${15*a}% más rápido y es un ${10*a}% más grande.`,3),Ta(Dl("Lanzamiento rápido","spear_boomerang",.06,3),"gd_leadership")],final:se.auto("spear_boomerang.a","spear_boomerang","Lanza refleja","gd_regeneration")
  }, {
    name:"Lanza del dragón",desc:"Una lanza más pesada que aturde y desgarra, hasta un golpe enorme.",steps:[Ta(ki("Lanza arrojadiza","spear_boomerang",.08,3),"dk_dragonic_pierce"),Gh("Lanza aturdidora","spear_boomerang","gd_restore",.08,3),jh("Lanza sangrante","spear_boomerang","gd_soulcold",2)],final:se.heavy("spear_boomerang.b","spear_boomerang","Lanza dracónica","hn_doublebowlingbash")
  }
  ],passives:[L0(Hn("Spear Mastery","kn_spearmastery",X(.03),5),["창","양손창"]),Hn("Punta templada","lk_fury",Ee(.01),5),Hn("Alcance de lanza","lg_hesperuslit",id(.04),5),Hn("Ímpetu","dk_vigor",tt(.02),5),Hn("Golpe certero","ig_overslash",zt(.08),5),L0(Ta(ki("Lanza pesada",sa,.05,5),"dk_madness_crusher"),["창","양손창"]),Hn("Lancero","hn_mega_sonic_blow",ls(.03),5)]
},At),Ht(Oh, {
  name:"Espadón",icon:"kn_twohandquicken",desc:"Counter Attack y Bowling Bash: la espada a dos manos, para aguantar el golpe y devolverlo.",skills:["auto_counter","bowling_bash"],paths:[ {
    name:"Contragolpe",desc:"Counter Attack salta más a menudo, más amplio, desarma y te cura.",steps:[Ta(Dl("Reflejos de duelista","auto_counter",.08,3),"lmn_se_book_s"),Ta($w("Contraataque amplio","auto_counter",.12,3),"ig_imperial_pressure"),Ta(jr("Desarme","auto_counter",a=>( {
      weaken:.1*a,weakenTime:5
    }),a=>`Counter Attack desarma: el atacante hace un ${10*Math.max(1,a)}% menos de daño durante 5 s.`,2),"gc_weaponblocking")],final:se.leech("auto_counter.a","auto_counter","Sangre por sangre","hn_napalm_vulcan_strike",.15)
  }, {
    name:"Riposta",desc:"Counter Attack pega más fuerte, aturde y te deja los básicos cargados.",steps:[Ta(ki("Contraataque mejorado","auto_counter",.08,3),"gc_counterslash"),Le("Riposta","gc_crossimpact",as.riposte,.1,c7,3),Gh("Contra aturdidor","auto_counter","hn_rulebreak",.08,2)],final:se.heavy("auto_counter.b","auto_counter","Contraataque devastador","hn_selfstudy_socery")
  }, {
    name:"Bolos",desc:"Bowling Bash lanza más lejos, aturde y rebota de enemigo en enemigo.",steps:[z0("Lanzamiento","cr_shrink","bowling_bash", {
      area:.15
    },a=>`Bowling Bash lanza al enemigo un ${15*a}% más lejos y pilla a más por el camino.`,3),Gh("Golpe aturdidor","bowling_bash","dk_servant_w_phantom",.08,3),Ta(Dl("Bowling Bash rápido","bowling_bash",.06,2),"hn_selfstudy_tatics")],final:se.chain("bowling_bash.a","bowling_bash","Pleno","dk_dragonic_breath")
  }, {
    name:"Espadón brutal",desc:"Bowling Bash pega más, desgarra y rompe, y remata a los heridos.",steps:[Ta(ki("Bowling Bash mejorado","bowling_bash",.08,3),"dk_servantweapon"),jh("Golpe sangrante","bowling_bash","kr_chop_chop",3),F0("Rompehuesos","bowling_bash","kr_claw_wave",2)],final:se.execute("bowling_bash.b","bowling_bash","Remate de espadón","kr_double_slash")
  }
  ],passives:[L0(Hn("Filo de espadón","dk_twohanddef",X(.03),5),["양손검"]),Hn("Guardia alta","ml_autoguard",lt(.5),5),Hn("Sangre fría","lg_reflectdamage",ma(.15),5),Hn("Al límite","hn_overcoming_crisis",Zr(.05),5),Hn("Postura de duelo","ig_guard_stance",ut(.01),5),Hn("Duelista","hn_breakinglimit",ls(.03),5),Hn("Templanza","kr_earth_bud",Ls(.02),5)]
},At)]);
const {
  trees:_7,sd:fc,sc:Fl,sn:Kw,sa:Jw,st:hs,sm:I0,capMod:b7,ic:Xn,wpn:x7,withShield:xs
}
=ua,Vh="crusader";
ke("spear_quicken","Spear Quicken","cr_spearquicken", {
  cd:24,type:"buff",tags:["buff"],effects:[ {
    key:"haste",label:"Celeridad",base:25,step:4,max:60,fmt:"n"
  }
  ]
},a=>`Durante 10 s: +${21+4*a} de Celeridad y +4% de crítico.`,a=>new pt(a,I(24),(e,t,n)=> {
  if(!e.nearestEnemy(450))return!1;const s=e.player,o=10*n.dur(e);return ce.play("ac_concentration",.5),s.cast(),e.addFx(xa(vs(s.x,s.y),s)),e.addBuff("haste",n.eff("haste"),o,n.id),e.addBuff("crit",.04+oe(e,"quickenCrit"),o,n.id),e.ext.quickenUntil=e.time+o,!0
}));
const w7=170,M7=48;
ke("shield_charge","Shield Charge","cr_shieldcharge", {
  cd:9,type:"aoe",tags:["melee","area","physical","neutral"],effects:[ {
    key:"stun",label:"Probabilidad de aturdir",base:.3,step:.1,max:.9,fmt:"pct"
  }
  ]
},()=>"Embistes con el escudo hacia el enemigo más cercano: el Peco avanza y golpea, aparta y puede aturdir a todos los de la línea. Requiere escudo.",a=>new pt(a,I(9),(e,t,n)=> {
  const s=e.player,o=e.nearestEnemy(360);if(!o)return!1;const r=n.mod(e),i=w7*e.stats.reachMult*(1+r.reach),l=M7*e.stats.areaMult*(1+r.area),d=Nn(o.y-s.y,o.x-s.x),c= {
    x:s.x,y:s.y
  };let u= {
    x:s.x+ln(d)*i,y:s.y+Sa(d)*i
  };if(e.walk) {
    const[m,p]=e.walk.resolve(s.x,s.y,u.x,u.y);u= {
      x:m,y:p
    }
  }
  Gn(e,o.x,o.y),s.cast(),ce.play("ef_shieldpress",.5),e.addFx(hu(e,s.x,s.y,d,i,.25,16773824));const h=new Set;for(let m=1;m<=5;m++)e.schedule(m*.03,()=> {
    const p=m/5;[s.x,s.y]=[c.x+(u.x-c.x)*p,c.y+(u.y-c.y)*p];for(const g of e.enemiesInRadius(s.x,s.y,l)) {
      if(h.has(g))continue;h.add(g),e.addFx(xp(g.x,g.y));const y=Wt()<n.eff("stun")? {
        stun:1,stunChance:1
      }
      :{};e.damageEnemy(g,Tn(e,n,40),Un(e,n, {
        knock:220,fromX:s.x,fromY:s.y,...y
      }))
    }
  });return!0
},["dmg","cd","area"]));
va.shield_charge.needsShield=!0;
ke("holy_cross","Holy Cross","cr_holycross", {
  cd:5,type:"single",tags:["melee","single","burst","physical","holy"]
},a=>a===1?"Dos tajos en cruz de luz sagrada al enemigo más cercano (x2 a no-muertos).":"+20% daño.",a=>new Aa(a, {
  cd:I(5),dmg:ee(26,.2),count:I(1),target:"nearest",range:130,melee:!0,burst:()=>2,burstGap:.12,sound:"hit_sword",hit:()=>( {
    undeadMult:2,knock:40,...Ft.LENS
  }),fx:(e,t,n)=>kt("str_cross",t,n,.55,0)
}));
const Qw=.08;
ke("grand_cross","Grand Cross","cr_grandcross", {
  cd:12,type:"aoe",tags:["aura","area","melee","physical","holy"],cast:["area","holy"]
},a=>a===1?`Gran cruz de luz a tu alrededor: mucho daño sagrado (x2 a no-muertos), pero te cuesta un ${Qw*100}% de tu vida actual.`:"+20% daño y +8% área.",a=>new xn(a, {
  halo:16770442,cd:I(12),dmg:ee(70,.2),radius:ee(160,.08),sound:"ef_signum",hit:()=>( {
    undeadMult:2,knock:90,...Ft.LENS_ONLY
  }),fx:()=>null,cast:(e,t)=> {
    ea(e,e.player,t,16770442),e.addFx(kt("str_cross",e.player.x,e.player.y,t/110,0));const n=e.hp*Qw*(1-oe(e,"gcCost"));e.hp=Math.max(1,e.hp-n),e.healPlayer(n*oe(e,"gcHeal"))
  }
}));
ke("shield_boomerang","Shield Boomerang","cr_shieldboomerang", {
  cd:6,type:"projectile",tags:["melee","projectile","pierce","return","physical","neutral"]
},a=>a===1?"Lanzas tu escudo: golpea a todo lo que atraviesa y vuelve a tu brazo. Requiere escudo.":"+20% daño.",a=>new Ua(a, {
  cd:I(6),dmg:ee(28,.2),count:I(1),speed:480,aim:"spread",pierce:I(99),returns:!0,radius:24,life:1.1,spin:16,view:()=> {
    const e=new Ra(xt.itemTextures.get(2103));return e.anchor.set(.5),e.scale.set(1.3),e
  },orient:null,sound:"ef_shieldpress",hit:()=>( {
    knock:80,hitFx:(e,t)=>xp(e,t)
  })
}));
va.shield_boomerang.needsShield=!0;
ke("auto_guard","Auto Guard","cr_autoguard", {
  cd:26,type:"buff",tags:["buff"],effects:[ {
    key:"block",label:"Probabilidad de bloquear",base:.25,step:.03,max:.55,fmt:"pct"
  }
  ]
},()=>"Durante 12 s tu escudo bloquea un 25% de los golpes que recibes (no te hacen nada). Requiere escudo.",a=>new pt(a,I(26),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,260).length)return!1;const s=e.player;return ce.play("ef_endure",.5),s.cast(),e.addFx(xa(kt("str_guardstance",s.x,s.y,.9,0),s)),e.addBuff("autoguard",n.eff("block")+oe(e,"guardCap"),12*n.dur(e),n.id),!0
}));
va.auto_guard.needsShield=!0;
Ct.hurt.push((a,e,t)=> {
  const n=a.player,s=a.buffValue("autoguard");if(s>0&&Wt()<s) {
    a.addFx(xp(n.x,n.y-30)),ce.play("ef_shieldpress",.35,2);const r=oe(a,"guardBurst");if(r) {
      ea(a,n,90,16770442,300);for(const l of a.enemiesInRadius(n.x,n.y,90))a.damageEnemy(l,r*a.stats.powerMelee, {
        src:"auto_guard",part:"Luz del escudo",knock:120,fromX:n.x,fromY:n.y,undeadMult:2
      })
    }
    const i=oe(a,"guardHeal");return i&&a.healPlayer(a.stats.maxHp*i),0
  }
  const o=oe(a,"reflect");return o&&t&&!t.dead&&a.damageEnemy(t,e*o*3, {
    src:"auto_guard",part:"Reflect Shield",numColor:16765562
  }),e
});
Ct.damageMult.push((a,e,t)=> {
  const n=oe(a,"crusade");return!n||(a.ext.quickenUntil??0)<=a.time?1:t.src==="peco"?2:1+.15*n
});
_7(Vh,[Ht(Vh, {
  name:"Caballería sagrada",icon:"sl_crusader",desc:"Grand Peco te monta en tu Peco: pisotón sagrado, Spear Quicken y Shield Charge.",skills:["spear_quicken","shield_charge"],paths:[ {
    name:"Celeridad sagrada",desc:"Spear Quicken dura más, se recarga antes y da crítico, hasta no apagarse nunca.",steps:[I0("Ritmo de batalla","iq_will_of_faith","spear_quicken", {
      duration:.15
    },a=>`Spear Quicken dura un ${15*a}% más.`,3),Xn(Fl("Fe incansable","spear_quicken",.08,3),"iq_sincere_faith"),Le("Filo veloz","iq_powerful_faith","quickenCrit",.02,a=>`Spear Quicken da un ${nt(a)} más de crítico`,2)],final:se.long("spear_quicken.a","spear_quicken","Quicken eterno","mer_autoberserk")
  }, {
    name:"Cruzada",desc:"Lanzar Spear Quicken te da daño, velocidad y crítico, y con él activo tu Peco pisotea el doble.",steps:[Y.castBuff("Furia santa","spear_quicken","mer_benediction","damage",.03,8,3),Y.castBuff("Paso del cruzado","spear_quicken","mer_blessing","speed",.04,8,3),Y.castBuff("Ojo del cruzado","spear_quicken","mer_compress","crit",.02,8,2)],final: {
      name:"Cruzada",icon:"ig_attack_stance",maxRank:1,stat:a=>a.ext.crusade=(a.ext.crusade??0)+1,desc:()=>"Con Spear Quicken activo haces +15% de daño y el pisotón de tu Peco hace el doble."
    }
  }, {
    name:"Embestida",desc:"Shield Charge pega más, en más área y aturde, hasta ser una carga demoledora.",steps:[xs(Xn(fc("Embestida feroz","shield_charge",.08,3),"ig_shield_shooting")),xs(Xn(Jw("Carga arrolladora","shield_charge",.12,3),"ig_imperial_cross")),xs(Y.stun("Escudo aturdidor","shield_charge","ig_rebound_shield",.1,2))],final:se.heavy("shield_charge.a","shield_charge","Carga del bastión","mer_crash")
  }, {
    name:"Carga incesante",desc:"Shield Charge se recarga antes, debilita y marca, y si mata vuelve a estar lista.",steps:[xs(Xn(Fl("Escudo rápido","shield_charge",.06,3),"mer_decagi")),xs(Y.weaken("Escudo intimidante","shield_charge","mer_estimation",3)),xs(Y.mark("Marca sagrada","shield_charge","mer_incagi",2))],final:se.refresh("shield_charge.b","shield_charge","Carga sin tregua","mer_invincibleoff2")
  }
  ],passives:[oC("Grand Peco","dk_dragonic_aura"),Le("Pezuñas sagradas","iq_first_brand",as.trample,3,rC,5),Le("Pisotón sagrado","iq_judge",as.trampleMark,.04,d7,5),Le("Galope santo","iq_firm_faith",as.gallop,.03,iC,5),x7(hs("Lanza bendita","ig_radiant_spear",X(.03),5),["창","양손창"]),hs("Barda sagrada","ig_guardian_shield",lt(.4),5),hs("Brío del cruzado","cd_fidus_animus",Ls(.02),5)]
},At),Ht(Vh, {
  name:"Fe",icon:"cr_holycross",desc:"Holy Cross y Grand Cross: la luz como arma, a costa de tu vida.",skills:["holy_cross","grand_cross"],paths:[ {
    name:"Cruz múltiple",desc:"Holy Cross alcanza a más, más a menudo y marca, hasta salir sola con tus golpes.",steps:[Xn(Kw("Doble cruz","holy_cross",1,2,"objetivo"),"iq_second_judgement"),Xn(Fl("Cruz rápida","holy_cross",.06,3),"mer_kyrie"),Y.mark("Estigma","holy_cross","iq_third_consecration",3)],final:se.auto("holy_cross.a","holy_cross","Cruz refleja","mer_lexdivina")
  }, {
    name:"Cruz de juicio",desc:"Holy Cross pega más, con críticos más fuertes y aturde, hasta un golpe enorme.",steps:[Xn(fc("Cruz de luz","holy_cross",.08,3),"ig_grand_judgement"),Y.crit("Juicio","holy_cross","mer_magnificat",3),Y.stun("Cruz aturdidora","holy_cross","mer_mentalcure",.08,2)],final:se.heavy("holy_cross.b","holy_cross","Cruz del juicio","mer_provoke")
  }, {
    name:"Gran cruz",desc:"Grand Cross más grande, ciega y te cuesta menos, y consagra el suelo.",steps:[Xn(Jw("Cruz extendida","grand_cross",.1,3),"iq_exposion_blaster"),Y.blind("Luz cegadora","grand_cross","iq_blazing_flame_blast",3),Le("Sacrificio","pa_sacrifice","gcCost",.2,a=>`Grand Cross te cuesta un ${nt(a)} menos de vida`,2)],final:se.field("grand_cross.a","grand_cross","Suelo consagrado","mer_quicken")
  }, {
    name:"Gospel",desc:"Grand Cross pega más, más a menudo y con críticos, y te devuelve la vida que cuesta.",steps:[Xn(fc("Cruz mayor","grand_cross",.08,3),"iq_massive_f_blaster"),Xn(Fl("Plegaria rápida","grand_cross",.06,3),"mer_recuperate"),Y.crit("Fervor sagrado","grand_cross","mer_regain",2)],final: {
      ...Xn(b7("Gospel","grand_cross", {
        dmg:.3,area:.15
      }),"pa_gospel"),stat:a=>a.ext.gcHeal=(a.ext.gcHeal??0)+1,desc:()=>"Grand Cross: +30% de daño y +15% de área, y te devuelve la vida que te cuesta."
    }
  }
  ],passives:[hs("Faith","iq_oleum_sanctum",Ge(8),5),hs("Juramento","iq_third_punish",La(.03),5),hs("Gracia","cd_reparatio",ma(.15),5),Xn(fc("Brazo de la fe",sa,.05,5),"cd_effligo"),hs("Celo","cd_competentia",tt(.02),5),hs("Fervor","cd_presens_acies",zt(.08),5),hs("Coraza de fe","mer_scapegoat",ct(.01),5)]
},At),Ht(Vh, {
  name:"Escudo",icon:"cr_shieldboomerang",desc:"Shield Boomerang y Auto Guard: el escudo para golpear y para no caer.",skills:["shield_boomerang","auto_guard"],paths:[ {
    name:"Escudos voladores",desc:"Más escudos, más rápidos y más a menudo, que acaban rebotando de enemigo en enemigo.",steps:[xs(Xn(Kw("Dos escudos","shield_boomerang",1,2,"escudo"),"ig_holy_shield")),xs(I0("Escudo veloz","lg_banding","shield_boomerang", {
      speed:.12,area:.08
    },a=>`Shield Boomerang vuela un ${12*a}% más rápido y es un ${8*a}% más grande.`,3)),xs(Xn(Fl("Lanzamiento de escudo","shield_boomerang",.06,3),"mer_sight"))],final:se.chain("shield_boomerang.a","shield_boomerang","Escudo rebotador","mer_tender")
  }, {
    name:"Escudo pesado",desc:"Shield Boomerang pega más, aturde y humilla, hasta un golpe enorme.",steps:[xs(Xn(fc("Escudo pesado","shield_boomerang",.08,3),"hn_shield_chain_rush")),xs(Y.stun("Golpe de canto","shield_boomerang","dk_servant_w_demol",.08,3)),xs(Y.weaken("Escudo humillante","shield_boomerang","gd_approval",2))],final:se.heavy("shield_boomerang.b","shield_boomerang","Escudo del bastión","gd_chargeshout_beating")
  }, {
    name:"Guardia sagrada",desc:"Auto Guard dura más, bloquea más y suelta luz al bloquear, hasta no bajarse nunca.",steps:[xs(I0("Guardia firme","cd_benedictum","auto_guard", {
      duration:.15
    },a=>`Auto Guard dura un ${15*a}% más.`,3)),Le("Luz del escudo","iq_second_flame","guardBurst",12,a=>`Al bloquear con Auto Guard, una luz sagrada hace ${Math.round(a)} de daño (crece con el ATK) a los enemigos cercanos`,3),Le("Escudo inquebrantable","ig_judgement_cross","guardCap",.05,a=>`Auto Guard bloquea un ${nt(a)} más de golpes`,2)],final:se.long("auto_guard.a","auto_guard","Guardia eterna","gd_chargeshout_flag")
  }, {
    name:"Escudo bendito",desc:"Auto Guard te cura al bloquear, se recarga antes y te da daño, hasta estar siempre listo.",steps:[Le("Escudo bendito","cd_dilectio_heal","guardHeal",.01,a=>`Al bloquear con Auto Guard te curas un ${nt(a)} de tu vida máxima`,3),Xn(Fl("Guardia rápida","auto_guard",.08,3),"gd_charisma"),Y.castBuff("Contraataque sagrado","auto_guard","gd_development","damage",.04,6,2)],final:se.quick("auto_guard.b","auto_guard","Guardia constante","gd_emergency_move")
  }
  ],passives:[xs(hs("Escudo templado","ig_shield_mastery",ct(.01),5)),hs("Defender","ml_defender",lt(.5),5),Le("Reflect Shield","em_elemental_veil","reflect",.06,a=>`Devuelves al atacante el ${nt(a*3)} del daño que te hace`,5),hs("Providence","cr_providence",Ls(.02),5),hs("Baluarte","cd_mediale_votum",Ld(.3),5),hs("Devotion","cr_devotion",ut(.01),5),hs("Muro de fe","gd_emergencycall",ls(.03),5)]
},At)]);
const {
  trees:S7,sd:Il,sc:Bl,sn:Wh,sa:$h,sp:A7,sh:B0,st:Ka,ic:Ia,dec:Zw
}
=ua,Yh="wizard";
ke("meteor_storm","Meteor Storm","wz_meteor", {
  cd:14,type:"aoe",tags:["ground","area","magic","fire"],cast:["area","fire"],effects:[ {
    key:"stun",label:"Probabilidad de aturdir",base:.1,step:.05,max:.6,fmt:"pct"
  }
  ]
},a=>a===1?"Meteoros que caen al azar sobre un grupo de enemigos: cada uno revienta en área y puede aturdir.":"+1 meteoro y +15% daño.",a=>new fo(a, {
  cd:I(14),dmg:ee(34,.15),ticks:e=>4+Math.floor(e/2),interval:.32,area:ee(130,.06),tickRadius:62,delay:.3,sound:"meteor",hit:(e,t)=>( {
    stun:1.2,stunChance:t.eff("stun"),knock:90,...Ft.FIREHIT
  }),fxTick:(e,t,n,s)=>Lp(["str_meteor1","str_meteor2","str_meteor3","str_meteor4"],t,n,s/70,0)
}));
ke("fire_pillar","Fire Pillar","wz_firepillar", {
  cd:9,type:"aoe",tags:["ground","area","magic","fire"],cast:["area","fire"]
},a=>a===1?"Una columna de fuego brota bajo un grupo de enemigos y los quema cuatro veces seguidas.":"+20% daño y +8% área.",a=>new fo(a, {
  cd:I(9),dmg:ee(17,.2),ticks:I(4),interval:.18,area:I(0),tickRadius:58,delay:.35,scatter:!1,sound:"fire_pillar",hit:()=>( {
    knock:30,...Ft.FIREHIT
  }),fxStart:(e,t,n,s,o)=>$v("fx_firepillar",s,o, {
    ms:1100,ground:!0
  }),fxTick:(e,t,n)=>kt("str_firehit",t,n,.8,0)
}));
ke("frost_nova","Frost Nova","wz_frostnova", {
  cd:12,type:"aoe",tags:["aura","area","magic","water"],cast:["single","water"],effects:[ {
    key:"freeze",label:"Probabilidad de congelar",base:.6,step:.06,max:1,fmt:"pct"
  }
  ]
},a=>a===1?"Estallido de hielo a tu alrededor: daña y congela a los enemigos cercanos 2 s.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:12576511,cd:I(12),dmg:ee(20,.2),radius:ee(150,.08),sound:"ef_frostdiver",hit:(e,t)=>( {
    freeze:2,freezeChance:t.eff("freeze"),sounds:["hit_fist3","hit_fist4"]
  }),fx:(e,t,n)=>(Mu(e,t,n),Vn(t,n,$t("tex_ice"),14,14217471,900,96,.5))
}));
ke("storm_gust","Storm Gust","wz_stormgust", {
  cd:16,type:"aoe",tags:["ground","area","magic","water"],cast:["area","water"],effects:[ {
    key:"freeze",label:"Probabilidad de congelar",base:.12,step:.03,max:.45,fmt:"pct"
  }
  ]
},a=>a===1?"Ventisca enorme sobre un grupo: muchos golpes de hielo que empujan y pueden congelar.":"+2 golpes y +15% daño.",a=>new fo(a, {
  cd:I(16),dmg:ee(12,.15),ticks:e=>10+2*Math.floor(e/2),interval:.22,area:ee(150,.06),tickRadius:70,sound:"ef_frostdiver",hit:(e,t)=>( {
    freeze:1.5,freezeChance:t.eff("freeze"),slow:1,knock:60,sounds:["hit_fist3","hit_fist4"]
  }),fxTick:(e,t,n,s)=>Vn(t,n,$t("tex_ice"),6,13625599,700,64,s/140)
}));
ke("jupitel_thunder","Jupitel Thunder","wz_jupitel", {
  cd:6,type:"projectile",tags:["projectile","single","magic","wind"],cast:["single","wind"]
},a=>a===1?"Esfera de rayo hacia el enemigo más cercano: mucho daño y lo manda lejos. Atraviesa a un enemigo.":"+20% daño.",a=>new Ua(a, {
  cd:I(6),dmg:ee(52,.2),count:I(1),speed:460,aim:"spread",pierce:I(1),radius:16,life:1.4,view:()=>zp(9425151,16777215,14),orient:null,sound:"ef_lightbolt",hit:()=>( {
    knock:320,hitFx:(e,t)=>kt("str_lightning",e,t,.5,0),sounds:["hit_fist1","hit_fist2"]
  })
}));
ke("lord_of_vermilion","Lord of Vermilion","wz_vermilion", {
  cd:18,type:"aoe",tags:["ground","area","magic","wind"],cast:["area","wind"],effects:[ {
    key:"blind",label:"Probabilidad de cegar",base:.15,step:.05,max:.6,fmt:"pct"
  }
  ]
},a=>a===1?"Rayos sin parar sobre una zona enorme: golpean muchas veces y pueden cegar a los enemigos.":"+2 rayos y +15% daño.",a=>new fo(a, {
  cd:I(18),dmg:ee(18,.15),ticks:e=>12+2*Math.floor(e/2),interval:.16,area:ee(185,.06),tickRadius:55,sound:"magician_thunderstorm",hit:(e,t)=>( {
    ...Wt()<t.eff("blind")? {
      blind:2
    }
    :{},...Ft.WINDHIT
  }),fxTick:(e,t,n)=>(hk(["ef_lightbolt"],.2,2),kt("str_lightning",t,n,.6,0))
}));
Ct.damageMult.push((a,e)=> {
  const t=oe(a,"shatter");return t&&e.freezeUntil>a.time?1+t:1
});
S7(Yh,[Ht(Yh, {
  name:"Fuego",icon:"so_summon_agni",desc:"Meteor Storm y Fire Pillar: el cielo y el suelo arden.",skills:["meteor_storm","fire_pillar"],paths:[ {
    name:"Lluvia de meteoros",desc:"Más meteoros, en más área y más a menudo, hasta cubrir el cielo.",steps:[Ia(Wh("Lluvia de meteoros","meteor_storm",1,2,"meteoro"),"wl_crimsonrock"),Ia($h("Cráter","meteor_storm",.1,3),"ag_climax"),Ia(Bl("Cielo ardiente","meteor_storm",.06,3),"star_of_masterarcher")],final:se.more("meteor_storm.a","meteor_storm","Lluvia de fuego","wl_comet",3)
  }, {
    name:"Meteoro colosal",desc:"Meteor Storm pega más, aturde y quema, hasta caer como una sola roca enorme.",steps:[Ia(Il("Meteoros ardientes","meteor_storm",.08,3),"hn_meteor_storm_buster"),Y.stun("Impacto","meteor_storm","ag_crimson_arrow",.05,3),Ia(B0("Brasas","meteor_storm",a=>( {
      poison:3*a
    }),a=>`Meteor Storm deja ardiendo a los enemigos: +${3*Math.max(1,a)} de daño por segundo durante 3 s.`,2),"em_conflagration")],final:se.heavy("meteor_storm.b","meteor_storm","Roca del cielo","star_of_mettle")
  }, {
    name:"Columnas",desc:"Más llamaradas, más a menudo y que marcan, hasta dejar el suelo ardiendo.",steps:[Ia(Wh("Más llamaradas","fire_pillar",1,2,"llamarada"),"gn_fire_expansion"),Ia(Bl("Fuego rápido","fire_pillar",.06,3),"star_of_sharp"),Y.mark("Marca de fuego","fire_pillar","gn_demonic_fire",3)],final:se.field("fire_pillar.a","fire_pillar","Suelo en llamas","star_of_speed")
  }, {
    name:"Pilar abrasador",desc:"Fire Pillar pega más, con críticos y sofocando, hasta salir solo con tus golpes.",steps:[Ia(Il("Columna abrasadora","fire_pillar",.08,3),"star_of_spell"),Y.crit("Llama voraz","fire_pillar","star_of_spirit",3),Y.weaken("Calor sofocante","fire_pillar","star_of_vital",2)],final:se.auto("fire_pillar.b","fire_pillar","Pilar reflejo","star_robe_of_spl")
  }
  ],passives:[Ka("Fuego del averno","star_robe_of_wis",X(.02),5),Ka("Piel ígnea","star_suit_of_con",ct(.01),5),Ka("Furia volcánica","so_firewalk",zt(.08),5),Ka("Sobrecalentamiento","em_activity_burn",tt(.02),5),Ka("Piromante","em_summon_elemental_ardor",Ut(.02),5),Ka("Llama interior","star_suit_of_crt",Ge(6),5),Ka("Ascuas","lmn_abc_c_bow",Ee(.01),5)]
},At),Ht(Yh, {
  name:"Hielo",icon:"wl_jackfrost",desc:"Frost Nova y Storm Gust: congela a la horda entera.",skills:["frost_nova","storm_gust"],paths:[ {
    name:"Onda gélida",desc:"Frost Nova más amplia, más a menudo y que frena, hasta salir con tus golpes.",steps:[Ia($h("Onda gélida","frost_nova",.1,3),"wl_frostmisty"),Ia(Bl("Frío constante","frost_nova",.08,3),"wl_freeze_sp"),Y.slow("Escarcha","frost_nova","lmn_abc_dagger",2)],final:se.auto("frost_nova.a","frost_nova","Nova refleja","lmn_ag_staff")
  }, {
    name:"Hielo quebradizo",desc:"Frost Nova pega más, congela más y los congelados reciben más daño.",steps:[Ia(Il("Nova helada","frost_nova",.08,3),"hn_jack_frost_nova"),Ia(B0("Hielo perpetuo","frost_nova",a=>( {
      freeze:.3*a
    }),a=>`Frost Nova congela ${Zw(.3*Math.max(1,a))} s más.`,3),"ag_frozen_slash"),Le("Hielo quebradizo","ag_crystal_impact","shatter",.06,a=>`Los enemigos congelados reciben un ${nt(a)} más de daño`,2)],final:se.heavy("frost_nova.b","frost_nova","Nova devastadora","lmn_ag_wand")
  }, {
    name:"Cero absoluto",desc:"Storm Gust dura más, frena y cubre más, hasta congelar a todos.",steps:[Ia(Wh("Ventisca larga","storm_gust",2,2),"wl_whiteimprison"),Ia(B0("Viento helado","storm_gust",a=>( {
      slow:.6*a
    }),a=>`Storm Gust ralentiza ${Zw(.6*Math.max(1,a))} s más.`,3),"em_diamond_storm"),Ia($h("Ventisca amplia","storm_gust",.1,3),"lmn_bo_hall")],final:se.control("storm_gust.a","storm_gust","Cero absoluto","wl_stasis","freeze",1)
  }, {
    name:"Tormenta de hielo",desc:"Storm Gust pega más, más a menudo y con críticos, hasta salir dos veces.",steps:[Ia(Il("Ventisca feroz","storm_gust",.08,3),"so_diamonddust"),Ia(Bl("Ventisca rápida","storm_gust",.06,3),"lmn_bo_sword"),Y.crit("Esquirlas","storm_gust","lmn_cd_book",2)],final:se.echo("storm_gust.b","storm_gust","Doble ventisca","lmn_cd_wand")
  }
  ],passives:[Ka("Corazón de hielo","lmn_dk_lance",Ge(6),5),Ka("Escarcha protectora","em_summon_elemental_diluvio",lt(.4),5),Ka("Mente glacial","wl_spellfrozen",Ys(.03),5),Ka("Cristales","ag_rain_of_crystal",Ee(.01),5),Ka("Escudo de escarcha","lmn_dk_sword",ct(.01),5),Ka("Invierno","lmn_em_book",tt(.02),5),Ka("Frío interior","lmn_em_s_book",ut(.01),5)]
},At),Ht(Yh, {
  name:"Tormenta",icon:"wz_yupitel",desc:"Jupitel Thunder y Lord of Vermilion: rayos que no paran.",skills:["jupitel_thunder","lord_of_vermilion"],paths:[ {
    name:"Cadena de rayos",desc:"Más esferas, que atraviesan y salen más a menudo, hasta saltar de enemigo en enemigo.",steps:[Ia(Wh("Esferas gemelas","jupitel_thunder",1,2,"esfera"),"wl_chainlightning"),Ia(A7("Rayo penetrante","jupitel_thunder",3),"ag_storm_cannon"),Ia(Bl("Trueno rápido","jupitel_thunder",.06,3),"lmn_hn_sword")],final:se.chain("jupitel_thunder.a","jupitel_thunder","Rayo en cadena","lmn_hn_wand")
  }, {
    name:"Descarga",desc:"Jupitel Thunder pega más, aturde e ioniza, hasta un solo trueno enorme.",steps:[Ia(Il("Trueno potente","jupitel_thunder",.08,3),"hn_jupitel_thunder_storm"),Y.stun("Descarga","jupitel_thunder","wl_chainlightning_atk",.06,3),Y.mark("Ionización","jupitel_thunder","em_lightning_land",2)],final:se.heavy("jupitel_thunder.b","jupitel_thunder","Ira de Júpiter","lmn_ig_spear")
  }, {
    name:"Cielo abierto",desc:"Lord of Vermilion cubre más, ciega y sale más a menudo, hasta llenar el cielo de rayos.",steps:[Ia($h("Cielo abierto","lord_of_vermilion",.1,3),"ag_destructive_hurricane"),Y.blind("Fogonazo","lord_of_vermilion","em_psychic_stream",3),Ia(Bl("Relámpago veloz","lord_of_vermilion",.06,2),"lmn_ig_sword")],final:se.more("lord_of_vermilion.a","lord_of_vermilion","Ira del cielo","em_elemental_buster",4)
  }, {
    name:"Señor del trueno",desc:"Lord of Vermilion pega más, con críticos y electrocutando, y deja el suelo cargado.",steps:[Ia(Il("Señor del trueno","lord_of_vermilion",.08,3),"wz_lord"),Y.crit("Sobrecarga eléctrica","lord_of_vermilion","lmn_iq_claw",3),Y.weaken("Electrocución","lord_of_vermilion","lmn_iq_knuckle",2)],final:se.field("lord_of_vermilion.b","lord_of_vermilion","Campo eléctrico","lmn_mt_axe")
  }
  ],passives:[Ka("Carga estática","em_increasing_activity",tt(.02),5),Ka("Pararrayos","lmn_nw_gatling",ut(.01),5),Ka("Palabras rápidas","wz_estimation",Ys(.03),5),Ka("Sobrecarga","so_varetyr_spear",zt(.08),5),Ka("Tormenta perpetua","ag_tornado_storm",za(.02),5),Ka("Voltaje","lmn_nw_pistol",X(.02),5),Ka("Aislante","lmn_se_book_n",ct(.01),5)]
},At)]);
const {
  trees:k7,sd:Xh,sc:Nl,sn:eM,sa:N0,sh:tM,st:Ja,sm:aM,capMod:nM,ic:Mn,wpn:E7,dec:sM
}
=ua,Kh="sage";
function vC(a,e,t,n,s) {
  const o=e.mod(a),r=t*a.stats.areaMult*(1+o.area),i=n*(1+o.duration),l=a.player;
  s(l.x,l.y,r,i);
  for(let d=0;d<o.count;d++) {
    const c=Wt()*Math.PI*2;
    s(l.x+ln(c)*r*1.6,l.y+Sa(c)*r*1.6,r,i)
  }
}
const oM=.1;
ke("volcano","Volcano","sa_volcano", {
  cd:18,type:"zone",tags:["ground","area","persistent","magic","fire"],cast:["area","fire"]
},a=>a===1?`Levantas un campo de fuego a tus pies durante 8 s: quema a los enemigos que hay dentro y, mientras estés en él, haces +${oM*100}% de daño.`:"+15% daño y +8% área.",a=>new pt(a,I(18),(e,t,n)=> {
  if(!e.nearestEnemy(300))return!1;e.player.cast(),ce.play("ef_firewall",.5);const s=Tn(e,n,9),o=Un(e,n,Ft.FIREHIT);return vC(e,n,140,8,(r,i,l,d)=>Mr(e,r,i,l,d,.5,[16742960,16756800,13122074],(c,u)=> {
    for(const h of c)e.damageEnemy(h,s,o);u&&e.addBuff("damage",oM+oe(e,"volcanoBuff"),.6,n.id)
  })),!0
},["dmg","cd","count","area","duration"]));
ke("deluge","Deluge","sa_deluge", {
  cd:20,type:"zone",tags:["ground","area","persistent","magic","water"],cast:["area","water"]
},a=>a===1?"Inundas el suelo a tus pies durante 8 s: mientras estés dentro te curas un 2% de la vida por segundo, y los enemigos que lo pisan se empapan (van más lentos y reciben algo de daño).":"+15% daño y +8% área.",a=>new pt(a,I(20),(e,t,n)=> {
  if(!e.nearestEnemy(300)&&e.hp>=e.stats.maxHp)return!1;e.player.cast(),ce.play("water_spray",.5);const s=Tn(e,n,5),o=Un(e,n, {
    slow:.6
  });return vC(e,n,140,8,(r,i,l,d)=>Mr(e,r,i,l,d,.5,[6994175,10147071,3832536],(c,u)=> {
    for(const h of c)e.damageEnemy(h,s,o);u&&e.healPlayer(e.stats.maxHp*(.01+oe(e,"delugeHeal")/2))
  })),!0
},["dmg","cd","count","area","duration"]));
ke("earth_spike","Earth Spike","wz_earthspike", {
  cd:6,type:"multi",tags:["ranged_strike","multi","burst","magic","earth"],cast:["single","earth"]
},a=>a===1?"Púas de roca brotan bajo el enemigo más cercano y lo lanzan por los aires. Cada nivel añade una púa.":a%2===1?"+1 púa.":"+25% daño.",a=>new Aa(a, {
  cd:I(6),dmg:e=>22*(1+.25*Math.floor(e/2)),count:I(1),target:"nearest",range:420,delay:.2,burst:e=>e,burstGap:.12,sound:"ef_hit4",hit:()=>( {
    knock:40,...Ft.LENS
  }),fx:(e,t,n)=>kt("str_dust",t,n,.8,0)
}));
ke("heavens_drive","Heaven's Drive","wz_heavendrive", {
  cd:11,type:"aoe",tags:["ground","area","magic","earth"],cast:["area","earth"]
},a=>a===1?"La tierra estalla en púas sobre un grupo de enemigos: cinco impactos que los apartan.":"+1 impacto y +15% daño.",a=>new fo(a, {
  cd:I(11),dmg:ee(24,.15),ticks:e=>5+Math.floor(e/2),interval:.12,area:ee(110,.06),tickRadius:55,sound:"ef_hit4",hit:()=>( {
    knock:110,...Ft.LENS_ONLY
  }),fxTick:(e,t,n,s)=>kt("str_dust",t,n,s/55,0)
}));
const _C=.3,C7=24;
ke("hindsight","Hindsight","sa_autospell", {
  cd:22,type:"buff",tags:["buff"],effects:[ {
    key:"time",label:"Duración",base:10,step:1.5,fmt:"s"
  }
  ]
},()=>`Durante 10 s, cada ataque básico tiene un ${_C*100}% de lanzar un Fire Bolt, Cold Bolt o Lightning Bolt sobre su objetivo (escala con el MATK).`,a=>new pt(a,I(22),(e,t,n)=> {
  if(!e.nearestEnemy(400))return!1;const s=e.player;return s.cast(),ce.play("ef_beginspell",.5),e.addFx(xa(vs(s.x,s.y),s)),e.addBuff("hindsight",1,n.eff("time")*n.dur(e),n.id),!0
}));
function T7(a,e) {
  const t=Math.floor(Wt()*3);
  return t===0?(ce.play("ef_firearrow",.3,3), {
    fx:su(a,e,PE(),400,.5),hit:Ft.FIREHIT
  }):t===1?(ce.play("ef_icearrow1",.3,3), {
    fx:su(a,e,[$t("tex_icearrow")],400,.5),hit: {
      slow:1,sounds:["hit_fist3"]
    }
  }):(ce.play("ef_lightbolt",.3,3), {
    fx:kt("str_lightning",a,e,.55,0),hit:Ft.WINDHIT
  })
}
Ct.hit.push((a,e,t,n)=> {
  if(!n.src||!ku(n.src)||n.part||a.buffValue("hindsight")<=0&&!oe(a,"hindAlways")||Wt()>=_C+oe(a,"hindChance"))return;const s=a.weapons.find(i=>i.id==="hindsight"),o=C7*(1+oe(a,"hindDmg"))*(s?1+s.mod(a).dmg:a.stats.powerMagic),r=oe(a,"hindTwice")?2:1;for(let i=0;i<r;i++)a.schedule(.15+i*.15,()=> {
    if(e.dead)return;const l=T7(e.x,e.y);l.fx&&a.addFx(l.fx),a.damageEnemy(e,o, {
      src:"hindsight",part:"Bolt",power:a.stats.powerMagic,...l.hit
    })
  })
});
ke("abracadabra","Abracadabra","sa_abracadabra", {
  cd:14,type:"aoe",tags:["aura","area","magic","neutral"]
},()=>"Un conjuro al azar: lluvia de meteoros, estallido de hielo, rayos sobre la horda, curación, gravedad que junta y aturde a los enemigos o un golpe de suerte (+30% de daño 6 s).",a=>new pt(a,I(14),(e,t,n)=> {
  const s=e.player,o=e.enemiesInRadius(s.x,s.y,420).filter(h=>!h.dead);if(!o.length)return!1;s.cast(),ce.play("ef_beginspell",.5);const r=h=>Tn(e,n,h),i=Un(e,n),l=oe(e,"abraLuck"),d=[0,1,2,3,4,5,...Array.from( {
    length:Math.round(l*4)
  },(h,m)=>m%2?3:5)],c=d[Math.floor(Wt()*d.length)],u=o[Math.floor(Wt()*o.length)];if(c===0)for(let h=0;h<4;h++)e.schedule(.2+h*.25,()=> {
    const m=u.x+(Wt()-.5)*160,p=u.y+(Wt()-.5)*110,g=Lp(["str_meteor1","str_meteor2","str_meteor3"],m,p,.9,0);g&&e.addFx(g);for(const y of e.enemiesInRadius(m,p,65))e.damageEnemy(y,r(36), {
      ...i,part:"Meteoros",knock:90,fromX:m,fromY:p
    })
  });else if(c===1) {
    Mu(e,s.x,s.y),ea(e,s,180,12576511);for(const h of e.enemiesInRadius(s.x,s.y,180))e.damageEnemy(h,r(22), {
      ...i,part:"Hielo",freeze:2.5,freezeChance:1
    })
  }
  else if(c===2)for(const h of e.randomVisibleEnemies(6,!0))e.addFx(kt("str_lightning",h.x,h.y,.7,0)),e.damageEnemy(h,r(48), {
    ...i,part:"Rayos",...Ft.WINDHIT
  });else if(c===3)e.healPlayer(e.stats.maxHp*.25),ea(e,s,90,10354589);else if(c===4) {
    ea(e,u,160,12166120);for(const h of e.enemiesInRadius(u.x,u.y,220))h.def.boss||e.applyStatus(h, {
      knock:-140,fromX:u.x,fromY:u.y,stun:1,stunChance:1
    })
  }
  else e.addBuff("damage",.3,6,n.id),ea(e,s,90,16765802);return!0
},["dmg","cd"]));
k7(Kh,[Ht(Kh, {
  name:"Campos",icon:"so_warmer",desc:"Volcano y Deluge: campos en el suelo que te refuerzan mientras estás dentro.",skills:["volcano","deluge"],paths:[ {
    name:"Volcán",desc:"Volcano más grande, que dura más y te da más daño, hasta no apagarse.",steps:[Mn(N0("Campo amplio","volcano",.08,3),"pf_fogwall"),aM("Erupción larga","em_spell_enchanting","volcano", {
      duration:.15
    },a=>`Volcano dura un ${15*a}% más.`,3),Le("Corazón del volcán","em_venom_swamp","volcanoBuff",.03,a=>`Dentro de Volcano haces un ${nt(a)} más de daño`,2)],final:se.long("volcano.a","volcano","Volcán eterno","so_arrullo")
  }, {
    name:"Lava",desc:"Volcano pega más, te enciende al lanzarlo y sale más a menudo, hasta abrir dos a la vez.",steps:[Mn(Xh("Lava","volcano",.08,3),"ag_floral_flare_road"),Y.castBuff("Calor de la lava","volcano","so_cloud_kill","damage",.03,6,3),Mn(Nl("Erupción rápida","volcano",.06,2),"so_el_action")],final:Mn(nM("Fusión de campos","volcano", {
      count:1,dmg:.2
    }),"so_el_control")
  }, {
    name:"Diluvio",desc:"Deluge cura más, cubre más y sale más a menudo, hasta no secarse.",steps:[Le("Aguas sanadoras","so_el_cure","delugeHeal",.004,a=>`Deluge te cura un ${nt(a/2)} más de tu vida por segundo`,3),Mn(N0("Marea","deluge",.1,3),"em_summon_elemental_serpens"),Mn(Nl("Lluvia constante","deluge",.06,2),"so_el_analysis")],final:se.long("deluge.a","deluge","Diluvio eterno","so_el_sympathy")
  }, {
    name:"Lodazal",desc:"Deluge frena, debilita y te acelera, hasta atrapar a todos en el barro.",steps:[Mn(tM("Lodazal","deluge",a=>( {
      slow:.4*a
    }),a=>`Deluge ralentiza ${sM(.4*Math.max(1,a))} s más.`,3),"pf_spiderweb"),Y.weaken("Agua pesada","deluge","so_electricwalk",3),Y.castBuff("Corriente","deluge","so_psychic_wave","speed",.04,6,2)],final:se.control("deluge.b","deluge","Arenas movedizas","so_striking","stun",1)
  }
  ],passives:[E7(Ja("Advanced Book","sa_advancedbook",X(.03),5),["책"]),Ja("Tierra firme","sa_elementground",lt(.4),5),Ja("Sabiduría","sa_castcancel",Ys(.03),5),Ja("Estudioso","sj_document",tt(.02),5),Ja("Dragonology","sa_dragonology",La(.03),5),Ja("Elementalista","sa_elementwind",Ut(.02),5),Ja("Bibliotecario","so_summon_aqua",Ge(6),5)]
},At),Ht(Kh, {
  name:"Tierra",icon:"sa_seismicweapon",desc:"Earth Spike y Heaven's Drive: la tierra se levanta contra la horda.",skills:["earth_spike","heavens_drive"],paths:[ {
    name:"Campo de púas",desc:"Earth Spike alcanza a más, más a menudo y agrieta, hasta salir con tus golpes.",steps:[Mn(eM("Campo de púas","earth_spike",1,2,"objetivo"),"em_terra_drive"),Mn(Nl("Púas rápidas","earth_spike",.08,3),"ag_violent_quake"),Y.mark("Grietas","earth_spike","wl_earthstrain",3)],final:se.auto("earth_spike.a","earth_spike","Púas reflejas","so_summon_ventus")
  }, {
    name:"Púa gigante",desc:"Earth Spike pega más, aturde y con críticos, hasta ser un pico enorme.",steps:[Mn(Xh("Púas afiladas","earth_spike",.08,3),"so_earthgrave"),Y.stun("Sacudida","earth_spike","ag_rock_down",.06,3),Y.crit("Roca afilada","earth_spike","so_vacuum_extreme",2)],final:se.heavy("earth_spike.b","earth_spike","Pico de la montaña","wl_drainlife")
  }, {
    name:"Falla",desc:"Heaven's Drive cubre más, frena y se repite, hasta dejar el suelo roto.",steps:[Mn(N0("Falla","heavens_drive",.1,3),"so_summon_tera"),Mn(tM("Gravedad","heavens_drive",a=>( {
      slow:.5*a
    }),a=>`Heaven's Drive ralentiza ${sM(.5*Math.max(1,a))} s.`,3),"hn_ground_gravitation"),Mn(eM("Réplicas","heavens_drive",1,2),"wl_summonstone")],final:se.field("heavens_drive.a","heavens_drive","Suelo roto","wl_eathstrain")
  }, {
    name:"Terremoto",desc:"Heaven's Drive pega más, más a menudo y derrumba, hasta un terremoto.",steps:[Mn(Xh("Tierra furiosa","heavens_drive",.08,3),"hn_hells_drive"),Mn(Nl("Temblor rápido","heavens_drive",.06,3),"wl_marshofabyss"),Y.weaken("Derrumbe","heavens_drive","wl_radius",2)],final:Mn(nM("Terremoto","heavens_drive", {
      dmg:.3,area:.2
    }),"kr_earth_drill")
  }
  ],passives:[Ja("Tierra madre","so_earth_insignia",Ge(6),5),Ja("Piel de piedra","kr_earth_stamp",ct(.01),5),Ja("Fuerza tectónica","ag_strantum_tremor",zt(.08),5),Ja("Roca viva","em_summon_elemental_terremotus",ma(.12),5),Ja("Geología","wl_recognizespell",Ee(.01),5),Ja("Paciencia de piedra","wl_siennaexecrate",ls(.03),5),Ja("Corteza","wl_summon_atk_fire",lt(.4),5)]
},At),Ht(Kh, {
  name:"Erudito",icon:"sa_autospell",desc:"Hindsight y Abracadabra: conjuros que salen solos y magia caprichosa.",skills:["hindsight","abracadabra"],paths:[ {
    name:"Autoconjuro",desc:"Hindsight lanza bolts más a menudo y durante más tiempo, hasta estar siempre activo.",steps:[Le("Memoria de conjuros","wl_recognizedspell","hindChance",.03,a=>`Hindsight lanza bolts con un ${nt(a)} más de probabilidad`,3),aM("Lectura atenta","wl_reading_sb","hindsight", {
      duration:.15
    },a=>`Hindsight dura un ${15*a}% más.`,3),Le("Doble conjuro","pf_soulchange","hindTwice",1,()=>"Cada vez que Hindsight se activa lanza dos bolts",1)],final:Le("Gran grimorio","em_magic_book_m","hindAlways",1,()=>"Hindsight está siempre activo: tus ataques básicos lanzan bolts sin tener que usar la skill",1)
  }, {
    name:"Bolts potenciados",desc:"Los bolts de Hindsight pegan más y lo lanzas más a menudo, hasta no dejar de lanzarlo.",steps:[Le("Bolts potenciados","wl_summon_atk_ground","hindDmg",.1,a=>`Los bolts de Hindsight hacen un ${nt(a)} más de daño`,3),Mn(Nl("Releer","hindsight",.06,3),"wl_summon_atk_water"),Y.castBuff("Mente brillante","hindsight","wl_summon_atk_wind","damage",.03,6,2)],final:se.quick("hindsight.b","hindsight","Conjuro incesante","wl_telekinesis_intense")
  }, {
    name:"Truco aprendido",desc:"Abracadabra sale más a menudo, con más suerte y críticos, hasta salir dos veces.",steps:[Mn(Nl("Truco aprendido","abracadabra",.08,3),"wm_randomizespell"),Le("Buena suerte","sj_bookofdimension","abraLuck",.5,()=>"Abracadabra cura y da suerte más a menudo",2),Y.castBuff("Golpe de suerte","abracadabra","wl_tetravortex","crit",.02,6,3)],final:se.echo("abracadabra.a","abracadabra","Doble truco","wl_tetravortex_fire")
  }, {
    name:"Magia caprichosa",desc:"Abracadabra pega más y te acelera, hasta salir sola con tus golpes.",steps:[Mn(Xh("Magia caprichosa","abracadabra",.1,3),"sj_bookofcreatingstar"),Y.castBuff("Truco veloz","abracadabra","wl_tetravortex_ground","speed",.04,6,3),Y.castBuff("Arcano desatado","abracadabra","wl_tetravortex_water","damage",.03,6,2)],final:se.auto("abracadabra.b","abracadabra","Magia refleja","wl_tetravortex_wind")
  }
  ],passives:[Ja("Paso del erudito","sa_createcon",gt(.02),5),Ja("Spell Breaker","sa_spellbreaker",Ee(.01),5),Ja("Soul Burn","pf_soulburn",zt(.08),5),Ja("Mente abierta","pf_hpconversion",tt(.02),5),Ja("Concentración arcana","em_elemental_spirit_m",za(.02),5),Ja("Erudición","ske_war_book_mastery",ls(.03),5),Ja("Sabio","su_basic_skill",Ge(6),5)]
},At)]);
const {
  at:Te,onPath:jt,trees:P7,sd:gc,sc:Ul,sn:Jh,sa:U0,sp:R7,sh:Ei,st:mn,sm:q0,ic:Ea,wpn:z7
}
=ua,Ci="hunter",bC=(a,e)=>a.weapons.find(t=>t.id===e),L7=3,D7=480,F7=50,xC=4.5,I7=2,wC=.15;
function Ky(a,e,t,n,s,o,r) {
  if(!t.dead) {
    a.addFx(Vn(t.x,t.y-20,$t("tex_pok2"),o?14:6,16773840,500,64,o?.6:.3)),ce.play("hit_arrow",o?.6:.35);
    for(const i of a.enemiesInRadius(t.x,t.y,s)) {
      const l=Un(a,e, {
        part:r,knock:o?140:30,fromX:t.x,fromY:t.y,...o? {
          stun:.6,stunChance:1
        }
        :{},...Ft.LENS
      });
      a.damageEnemy(i,i===t?n:n*.7,l)
    }
  }
}
const MC=(a,e)=>F7*a.stats.areaMult*(1+e.mod(a).area);
ke("blitz_beat","Blitz Beat","ht_blitzbeat", {
  cd:6,type:"multi",tags:["ranged_strike","multi","burst","physical","neutral"]
},a=>a===1?"Tu halcón cae en picado tres veces sobre un enemigo al azar y daña también a los que tiene alrededor.":"+20% daño.",a=>new pt(a,I(6),(e,t,n)=> {
  const s=e.player,o=oe(e,"deadlyDive")>0,r=MC(e,n)*(o?I7:1),i=Tn(e,n,15);if(o) {
    const d=e.clusterTarget(!0);return d?(e.schedule(.2,()=>Ky(e,n,d,i*xC,r,!0,"Picado mortal")),!0):!1
  }
  const l=e.enemiesInRadius(s.x,s.y,D7).filter(d=>!d.dead);if(!l.length)return!1;for(let d=0;d<1+n.mod(e).count;d++) {
    const c=l[Math.floor(Wt()*l.length)];for(let u=0;u<L7;u++)e.schedule(.15+d*.05+u*.14,()=>Ky(e,n,c,i,r,!1))
  }
  return!0
},["dmg","cd","count","area"]));
const hd=6;
ke("detecting","Detecting","ht_detecting", {
  cd:15,type:"control",tags:["aura","area","physical","neutral"],effects:[ {
    key:"mark",label:"Daño extra que reciben",base:.2,step:.04,max:.5,fmt:"pct"
  }
  ]
},()=>`Tu halcón señala a los 3 enemigos más fuertes a la vista: reciben un 20% más de daño durante ${hd} s.`,a=>new pt(a,I(15),(e,t,n)=> {
  const s=e.strongestVisibleEnemies(3+n.mod(e).count);if(!s.length)return!1;ce.play("ef_beginspell",.4),e.player.cast();for(const o of s)ea(e,o,36,16765562,500),e.applyStatus(o, {
    mark:n.eff("mark")+oe(e,"detectMark"),markTime:hd
  });for(const[o,r]of[["detectDamage","damage"],["detectCrit","crit"],["detectSpeed","speed"]]) {
    const i=oe(e,o);i&&e.addBuff(r,i,hd,"detecting")
  }
  return!0
},["cd","count"]));
const rM=12,B7=32,N7=42,SC=3,AC=1.6;
ke("claymore_trap","Claymore Trap","ht_claymoretrap", {
  cd:10,type:"zone",tags:["ground","area","persistent","physical","neutral"]
},a=>a===1?`Dejas 2 trampas cerca de los enemigos: la primera que pisan revienta y daña a todos los de alrededor. Duran ${rM} s.`:"+20% daño y +8% área.",a=>new pt(a,I(10),(e,t,n)=> {
  const s=e.nearestEnemies(6,380);if(!s.length)return!1;const o=n.mod(e),r=oe(e,"bigCharge")>0,i=85*e.stats.areaMult*(1+o.area)*(r?AC:1),l=rM*(1+o.duration),d=r?1:2+o.count,c=!r&&oe(e,"trapRearm")?2:1;ce.play("ef_trapon",.5),e.player.cast();for(let u=0;u<d;u++) {
    const h=s[u%s.length],m=e.player,p=m.x+(h.x-m.x)*.55+(Wt()-.5)*40,g=m.y+(h.y-m.y)*.55+(Wt()-.5)*30;Iv(e, {
      x:p,y:g
    },r?26:16,.45,16756832,l*1e3,.9);let y=c,f=0;for(let v=.2;v<=l;v+=.2)e.schedule(v,()=> {
      if(y<=0||e.time<f||!e.enemiesInRadius(p,g,B7).length)return;y--,f=e.time+.8,e.addFx($v("fx_blast",p,g, {
        scale:i/80
      })),ce.play("ef_firehit",.5,3);const b=Tn(e,n,N7)*(r?SC:1);for(const _ of e.enemiesInRadius(p,g,i))e.damageEnemy(_,b,Un(e,n, {
        knock:r?260:160,fromX:p,fromY:g
      }))
    })
  }
  return!0
},["dmg","cd","count","area","duration"]));
const kC=5;
ke("sandman","Sandman","ht_sandman", {
  cd:14,type:"control",tags:["ground","area","physical","neutral"],effects:[ {
    key:"sleep",label:"Sueño",base:2.5,step:.3,fmt:"s"
  }
  ]
},()=>"Lanzas arena mágica sobre un grupo de enemigos: se quedan dormidos 2,5 s (los jefes, la mitad).",a=>new pt(a,I(14),(e,t,n)=> {
  const s=e.clusterTarget(!0);if(!s)return!1;const o=110*e.stats.areaMult*(1+n.mod(e).area),r=n.eff("sleep")+oe(e,"sleepExtra"),i=oe(e,"sandWeaken"),l=oe(e,"sandSlow");ce.play("sandman",.5),e.player.cast(),e.addFx(Vn(s.x,s.y,$t("tex_pok1"),18,15786160,1e3,64,.5)),ea(e,s,o,15259824);const[d,c]=[s.x,s.y];for(const u of e.enemiesInRadius(d,c,o)) {
    const h=r*(u.def.boss?.5:1);u.stunUntil=Math.max(u.stunUntil,e.time+h),(i||l)&&e.applyStatus(u, {
      ...i? {
        weaken:i,weakenTime:h+4
      }
      :{},...l? {
        slow:h+l
      }
      :{}
    })
  }
  return oe(e,"sandField")&&Mr(e,d,c,o,kC,1,[15259824,16181968],u=> {
    for(const h of u)e.applyStatus(h, {
      slow:1.2,weaken:Math.max(.1,i),weakenTime:1.5
    })
  }),!0
},["cd","area"]));
const op=.5;
ke("beast_strafing","Beast Strafing","ht_beastbane", {
  cd:5,type:"projectile",tags:["projectile","single","physical","neutral"]
},a=>a===1?`Dos flechas pesadas al enemigo más fuerte a tu alcance: +${op*100}% de daño a jefes y élites.`:"+20% daño.",a=>new Ua(a, {
  cd:I(5),dmg:ee(30,.2),count:I(2),speed:700,aim:"spread",spread:.05,stagger:.1,radius:12,life:1.2,view:()=>o1(1.25),orient:Math.PI,hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  }),hitSound:"hit_arrow"
}));
ke("phantasmic_arrow","Phantasmic Arrow","ht_phantasmic", {
  cd:9,type:"projectile",tags:["projectile","pierce","physical","ghost"]
},a=>a===1?"Flecha fantasma enorme: atraviesa a todos los enemigos y los manda muy lejos.":"+20% daño.",a=>new Ua(a, {
  cd:I(9),dmg:ee(46,.2),count:I(1),speed:620,aim:"spread",pierce:I(99),radius:22,life:1.3,view:()=> {
    const e=o1(2.3);return e.tint=13152511,e.alpha=.85,e
  },orient:Math.PI,hit:()=>( {
    knock:450,hitFx:(e,t)=>Da(e,t)
  }),hitSound:"hit_arrow"
}));
const EC=.3,CC=1,TC=.5,PC=2,RC=.25,zC=1.5,U7=90;
Ct.damageMult.push((a,e,t)=> {
  let n=1;t.src==="beast_strafing"&&(e.elite||e.def.boss)&&(n*=1+op+(oe(a,"heavyShot")?CC:0));const s=oe(a,"sleepVuln");s&&e.stunUntil>a.time&&(n*=1+s);const o=oe(a,"executeLow");return o&&e.hp<e.maxHp*EC&&(n*=1+o),n
});
Ct.hit.push((a,e,t,n)=> {
  if(oe(a,"autoBlitz")&&n.src&&ku(n.src)&&!n.part&&Wt()<wC) {
    const s=bC(a,"blitz_beat");s&&a.schedule(.12,()=>Ky(a,s,e,Tn(a,s,15),MC(a,s),!1,"Halcón libre"))
  }
  if(!(n.src!=="phantasmic_arrow"||n.part)) {
    if(oe(a,"ghostTrail"))for(let s=1;s<=4;s++)a.schedule(s*PC/4,()=>!e.dead&&a.damageEnemy(e,t*TC/4, {
      src:"phantasmic_arrow",part:"Estela fantasma"
    }));oe(a,"coupDeGrace")&&!e.dead&&!e.def.boss&&e.hp<e.maxHp*RC&&a.damageEnemy(e,e.maxHp*3, {
      src:"phantasmic_arrow",part:"Disparo de gracia"
    })
  }
});
Ct.kill.push((a,e)=> {
  const t=e.markUntil>a.time;if(t&&oe(a,"preyChain")) {
    const n=a.enemiesInRadius(e.x,e.y,300).find(s=>!s.dead&&s!==e);n&&(ea(a,n,36,16765562,400),a.applyStatus(n, {
      mark:e.mark,markTime:Math.max(1,e.markUntil-a.time)
    }))
  }
  if(t&&oe(a,"killOrder")) {
    const n=bC(a,"detecting");n&&(n.timer=Math.min(n.timer,.3))
  }
  if(oe(a,"sleepSpread")&&e.stunUntil>a.time)for(const n of a.enemiesInRadius(e.x,e.y,U7))n!==e&&!n.dead&&(n.stunUntil=Math.max(n.stunUntil,a.time+zC*(n.def.boss?.5:1)))
});
const ko=(a,e,t,n,s)=>jt(a,Le(e,t,n,1,()=>s,1));
P7(Ci,[ {
  name:"Halcón",icon:"ht_falcon",desc:"Blitz Beat y Detecting: tu halcón caza contigo y señala a las presas.",paths: {
    "blitz_beat.a": {
      name:"Halcón libre",desc:"Picados más a menudo y sobre más enemigos, hasta que el halcón ataca solo con tus disparos."
    },"blitz_beat.b": {
      name:"Picado mortal",desc:"Menos picados, pero uno solo que revienta un grupo entero y lo aturde."
    },"detecting.a": {
      name:"Ojo del cazador",desc:"Más presas señaladas, que reciben más daño, y la señal salta de una a otra."
    },"detecting.b": {
      name:"Señal de caza",desc:"Detecting también te refuerza a ti: daño, crítico y velocidad, y matar a un señalado lo recarga."
    }
  },talents:[Te(0,0,"blitz",At(Ci,"blitz_beat")),Te(1,0,"blitz_cd",jt("blitz_beat.a",Ea(Ul("Vuelo rápido","blitz_beat",.06,3),"dr_shooting_feather")),"blitz"),Te(3,0,"blitz_count",jt("blitz_beat.a",Ea(Jh("Bandada","blitz_beat",1,2,"objetivo"),"wh_hawkrush"))),Te(6,0,"steel_crow",jt("blitz_beat.a",Ea(Ei("Garras de acero","blitz_beat",a=>( {
    bleed:.15*a
  }),a=>`Blitz Beat hace sangrar un ${15*Math.max(1,a)}% de su daño en 3 s.`,3),"wh_hawkboomerang"))),Te(9,0,"auto_blitz",ko("blitz_beat.a","Halcón libre","wh_calamitygale","autoBlitz",`Cada ataque básico tiene un ${nt(wC)} de probabilidad de que tu halcón haga un picado gratis sobre su objetivo`)),Te(1,1,"blitz_dmg",jt("blitz_beat.b",Ea(gc("Picado potente","blitz_beat",.08,3),"wh_hawk_m")),"blitz"),Te(3,1,"blitz_area",jt("blitz_beat.b",Ea(U0("Picado amplio","blitz_beat",.1,3),"ht_blizbeat"))),Te(6,1,"dive",jt("blitz_beat.b",Ea(Ei("Picado","blitz_beat",ua.stunHit(.06),a=>`Blitz Beat aturde con un ${6*Math.max(1,a)}% de probabilidad.`,2),"dr_low_flight"))),Te(9,1,"deadly_dive",ko("blitz_beat.b","Picado mortal","wh_galestorm","deadlyDive",`Blitz Beat es un solo picado sobre el grupo más grande: hace ${ss(xC)} veces el daño de un picado, en el doble de área, y aturde a todos 0,6 s`)),Te(0,2,"hawk_eye",mn("Ojo de halcón","ra_aimedbolt",Ee(.01),5)),Te(1,2,"plumage",mn("Plumaje","dr_preening",ut(.01),5)),Te(2,2,"keen_eye",mn("Vista aguda","ra_sensitivekeen",rn(.04),5)),Te(4,2,"raptor",mn("Instinto rapaz","dr_enrage_raptor",zt(.08),5)),Te(5,2,"patient",mn("Cazador paciente","wh_naturefriendly",ls(.03),5)),Te(7,2,"wind_sign",mn("Señal del viento","wh_wind_sign",tt(.02),5)),Te(8,2,"wingbeat",mn("Aleteo","dr_truth_of_wind",za(.02),5)),Te(3,3,"detecting",At(Ci,"detecting")),Te(4,3,"detect_count",jt("detecting.a",Ea(Jh("Ojo de águila","detecting",1,2,"objetivo"),"dr_beasty_nose")),"detecting"),Te(6,3,"detect_mark",jt("detecting.a",Le("Presa señalada","dr_sharpe_eyes","detectMark",.04,a=>`Los señalados por Detecting reciben un ${nt(a)} más de daño`,3))),Te(7,3,"detect_cd",jt("detecting.a",Ea(Ul("Vigía","detecting",.06,3),"ra_fearbreeze"))),Te(9,3,"prey_chain",ko("detecting.a","Cacería en cadena","ra_rangermain","preyChain","Al morir un enemigo señalado, su señal salta al enemigo más cercano con el tiempo que le quedaba")),Te(4,4,"hunt_focus",jt("detecting.b",Le("Concentración de caza","su_stoop","detectDamage",.04,a=>`Detecting te da un ${nt(a)} más de daño durante ${hd} s`,3)),"detecting"),Te(6,4,"hunt_crit",jt("detecting.b",Le("Instinto de caza","su_hiss","detectCrit",.03,a=>`Detecting te da un ${nt(a)} más de crítico durante ${hd} s`,2))),Te(7,4,"hunt_speed",jt("detecting.b",Le("Paso de caza","su_lope","detectSpeed",.05,a=>`Detecting te hace un ${nt(a)} más rápido durante ${hd} s`,3))),Te(9,4,"kill_order",ko("detecting.b","Orden de caza","su_arclousedash","killOrder","Matar a un enemigo señalado deja Detecting listo para lanzarse otra vez"))]
}, {
  name:"Trampas",icon:"ht_claymoretrap",desc:"Claymore Trap y Sandman: el suelo que pisan es tuyo.",paths: {
    "claymore_trap.a": {
      name:"Campo minado",desc:"Muchas trampas que duran más y se rearman."
    },"claymore_trap.b": {
      name:"Gran carga",desc:"Una sola trampa enorme que lo revienta todo."
    },"sandman.a": {
      name:"Sueño profundo",desc:"Duermen más, reciben más daño dormidos y el sueño se contagia."
    },"sandman.b": {
      name:"Arena cegadora",desc:"Al despertar están débiles y lentos, y la arena se queda en el suelo."
    }
  },talents:[Te(0,0,"claymore",At(Ci,"claymore_trap")),Te(1,0,"trap_count",jt("claymore_trap.a",Ea(Jh("Más trampas","claymore_trap",1,2,"trampa"),"ma_landmine")),"claymore"),Te(3,0,"trap_dur",jt("claymore_trap.a",q0("Trampas duraderas","wh_solidtrap","claymore_trap", {
    duration:.1
  },a=>`Las trampas de Claymore Trap duran un ${10*a}% más.`,3))),Te(6,0,"trap_cd",jt("claymore_trap.a",Ea(Ul("Detonador","claymore_trap",.06,3),"wh_swifttrap"))),Te(9,0,"rearm",ko("claymore_trap.a","Rearme","ht_skidtrap","trapRearm","Cada trampa de Claymore Trap se vuelve a armar después de reventar: explota dos veces")),Te(1,1,"trap_research",jt("claymore_trap.b",Ea(gc("Trap Research","claymore_trap",.08,3),"wh_advanced_trap")),"claymore"),Te(3,1,"trap_area",jt("claymore_trap.b",Ea(U0("Carga explosiva","claymore_trap",.1,3),"ht_blastmine"))),Te(6,1,"fire_trap",jt("claymore_trap.b",Ea(Ei("Trampa de fuego","claymore_trap",a=>( {
    poison:3*a
  }),a=>`Claymore Trap deja ardiendo: +${3*Math.max(1,a)} de daño por segundo durante 3 s.`,2),"wh_flametrap"))),Te(9,1,"big_charge",ko("claymore_trap.b","Blast Mine","ht_landmine","bigCharge",`Claymore Trap deja una sola trampa: hace ${SC} veces el daño, en un ${nt(AC-1)} más de área, y lanza lejos a todos`)),Te(0,2,"camouflage",mn("Mimetismo","ra_maizetrap",ct(.01),5)),Te(1,2,"silent_step",mn("Paso silencioso","wh_wild_walk",gt(.015),5)),Te(2,2,"trapper",mn("Maestro trampero","ra_cobalttrap",Ut(.02),5)),Te(4,2,"ambush",mn("Al acecho","ht_talkiebox",Ld(.5),5)),Te(5,2,"survival",mn("Instinto de supervivencia","dr_nature_shield",Ls(.02),5)),Te(7,2,"ambusher",mn("Emboscada","su_hide",zt(.06),5)),Te(8,2,"steady_hand",mn("Mano firme","dr_nature_logic",Ee(.01),5)),Te(3,3,"sandman",At(Ci,"sandman")),Te(4,3,"sleep_extra",jt("sandman.a",Le("Sueño pesado","ht_removetrap","sleepExtra",.3,a=>`Sandman duerme ${ss(a)} s más`,3)),"sandman"),Te(6,3,"nightmare",jt("sandman.a",Le("Pesadilla","ht_poisonslow","sleepVuln",.05,a=>`Los enemigos aturdidos o dormidos reciben un ${nt(a)} más de daño`,3))),Te(7,3,"sand_cd",jt("sandman.a",Ea(Ul("Arena rápida","sandman",.06,2),"wh_deepblindtrap"))),Te(9,3,"sleep_spread",ko("sandman.a","Sueño contagioso","dr_truth_of_ice","sleepSpread",`Al matar a un enemigo dormido, los de alrededor se duermen ${ss(zC)} s`)),Te(4,4,"sand_area",jt("sandman.b",Ea(U0("Tormenta de arena","sandman",.1,3),"ma_sandman")),"sandman"),Te(6,4,"sand_weaken",jt("sandman.b",Le("Arena en los ojos","dr_earth_flower","sandWeaken",.06,a=>`Los que duerme Sandman hacen un ${nt(a)} menos de daño durante 4 s al despertar`,3))),Te(7,4,"sand_slow",jt("sandman.b",Le("Arena pesada","dr_around_flower","sandSlow",.6,a=>`Los que duerme Sandman van lentos ${ss(a)} s al despertar`,3))),Te(9,4,"sand_field",ko("sandman.b","Arena en el suelo","dr_truth_of_earth","sandField",`Sandman deja la arena en el suelo ${kC} s: los que la pisan van lentos y hacen menos daño`))]
}, {
  name:"Caza mayor",icon:"ra_wugmastery",desc:"Beast Strafing y Phantasmic Arrow: flechas para las presas grandes.",paths: {
    "beast_strafing.a": {
      name:"Ráfaga",desc:"Más flechas, más a menudo, hasta que cada disparo sale dos veces."
    },"beast_strafing.b": {
      name:"Disparo pesado",desc:"Flechas que lo atraviesan todo y hacen mucho más a jefes y élites."
    },"phantasmic_arrow.a": {
      name:"Lanza espectral",desc:"Una flecha más grande que aturde y deja una estela que sigue haciendo daño."
    },"phantasmic_arrow.b": {
      name:"Tiro de gracia",desc:"Más daño y críticos, y remata a los que deja con poca vida."
    }
  },talents:[Te(0,0,"beast_strafing",At(Ci,"beast_strafing")),Te(1,0,"strafe_count",jt("beast_strafing.a",Ea(Jh("Tercera flecha","beast_strafing",1,2,"flecha"),"ma_shower")),"beast_strafing"),Te(3,0,"strafe_cd",jt("beast_strafing.a",Ea(Ul("Recarga de cazador","beast_strafing",.06,3),"dr_wind_bomb"))),Te(6,0,"blood_trail",jt("beast_strafing.a",Ea(Ei("Rastro de sangre","beast_strafing",a=>( {
    bleed:.15*a
  }),a=>`Beast Strafing hace sangrar un ${15*Math.max(1,a)}% de su daño en 3 s.`,3),"dr_cruel_bite"))),Te(9,0,"double_volley",jt("beast_strafing.a",q0("Dos andanadas","su_scratch","beast_strafing", {
    double:1
  },()=>"Beast Strafing sale siempre dos veces seguidas.",1))),Te(1,1,"strafe_dmg",jt("beast_strafing.b",Ea(gc("Flechas de caza","beast_strafing",.08,3),"ma_sharpshooting")),"beast_strafing"),Te(3,1,"strafe_pierce",jt("beast_strafing.b",Ea(R7("Puntas perforantes","beast_strafing",2),"wh_crescive_bolt"))),Te(6,1,"steel_tip",jt("beast_strafing.b",Ea(Ei("Punta de acero","beast_strafing",a=>( {
    mark:.04*a,markTime:4
  }),a=>`Los que alcanza Beast Strafing reciben un +${4*Math.max(1,a)}% de daño durante 4 s.`,3),"dr_nomercy_claw"))),Te(9,1,"heavy_shot",ko("beast_strafing.b","Flecha de caza mayor","dr_enrage_wolf","heavyShot",`El daño extra de Beast Strafing a jefes y élites pasa de ${nt(op)} a ${nt(op+CC)}`)),Te(0,2,"beast_bane",mn("Beast Bane","ra_wugstrike",La(.03),5)),Te(1,2,"bite",mn("Mordisco","ra_wugbite",zt(.08),5)),Te(2,2,"longbow",z7(Ea(gc("Arco largo",sa,.05,5),"rs_b_bow"),["활"])),Te(4,2,"tailwind",mn("Viento a favor","dr_cutting_wind",rn(.04),5)),Te(5,2,"tension",mn("Tensión","dr_hunger",tt(.02),5)),Te(7,2,"instinct",mn("Instinto","dr_wereraptor",Ee(.01),5)),Te(8,2,"beast_hunter",mn("Cazador de bestias","ra_magentatrap",za(.02),5)),Te(3,3,"phantasmic",At(Ci,"phantasmic_arrow")),Te(4,3,"phantasm_size",jt("phantasmic_arrow.a",q0("Flecha gigante","ra_iceboundtrap","phantasmic_arrow", {
    area:.12
  },a=>`Phantasmic Arrow es un ${12*a}% más grande.`,3)),"phantasmic"),Te(6,3,"phantasm_stun",jt("phantasmic_arrow.a",Ea(Ei("Impacto fantasma","phantasmic_arrow",ua.stunHit(.08),a=>`Phantasmic Arrow aturde con un ${8*Math.max(1,a)}% de probabilidad.`,3),"ra_erectricshork"))),Te(7,3,"phantasm_cd",jt("phantasmic_arrow.a",Ea(Ul("Recarga espectral","phantasmic_arrow",.06,2),"dr_ice_cloud"))),Te(9,3,"ghost_trail",ko("phantasmic_arrow.a","Estela fantasma","dr_ice_totem","ghostTrail",`Los que atraviesa Phantasmic Arrow vuelven a recibir un ${nt(TC)} del golpe en ${PC} s`)),Te(4,4,"phantasm_dmg",jt("phantasmic_arrow.b",Ea(gc("Flecha espectral","phantasmic_arrow",.08,3),"dr_flicking_tonado")),"phantasmic"),Te(6,4,"execute",jt("phantasmic_arrow.b",Le("Remate","dr_blood_howling","executeLow",.05,a=>`Haces un ${nt(a)} más de daño a los enemigos por debajo del ${nt(EC)} de vida`,3))),Te(7,4,"mortal_aim",jt("phantasmic_arrow.b",Ea(Ei("Puntería mortal","phantasmic_arrow",a=>( {
    critDmg:.1*a
  }),a=>`Los críticos de Phantasmic Arrow hacen un +${10*Math.max(1,a)}% de daño.`,3),"ma_skidtrap"))),Te(9,4,"coup_de_grace",ko("phantasmic_arrow.b","Disparo de gracia","ra_wugdash","coupDeGrace",`Phantasmic Arrow remata a los enemigos que no son jefes y se quedan por debajo del ${nt(RC)} de vida`))]
}
]);
const {
  trees:q7,sd:iM,sc:ql,sn:H7,sa:H0,sp:O7,sh:j7,st:Qa,sm:O0,capMod:lM,ic:Kn,wpn:G7
}
=ua,Qh="bard",Op=(a,e,t=16769696)=>Vn(a,e,$t("tex_pok1"),8,t,900,96,.35);
ke("arrow_vulcan","Arrow Vulcan","cg_arrowvulcan", {
  cd:6,type:"projectile",tags:["projectile","single","physical","neutral"]
},a=>a===1?"Ráfaga de cinco flechas muy rápidas al enemigo más cercano.":"+20% daño.",a=>new Ua(a, {
  cd:I(6),dmg:ee(11,.2),count:I(5),speed:760,aim:"spread",spread:.05,stagger:.06,radius:10,life:1.1,view:()=>o1(),orient:Math.PI,hit:()=>( {
    hitFx:(e,t)=>Da(e,t)
  }),hitSound:"hit_arrow"
}));
ke("dissonance","Dissonance","ba_dissonance", {
  cd:9,type:"aoe",tags:["aura","area","physical","neutral"]
},a=>a===1?"Tocas (o bailas) algo horrible: cuatro pulsos de notas disonantes dañan a los enemigos cercanos.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:16769696,cd:I(9),dmg:ee(13,.2),radius:ee(150,.08),ticks:I(4),interval:.45,sound:"ef_hit4",hit:()=>( {
    knock:25,sounds:["hit_fist1","hit_fist2"]
  }),fx:(e,t,n)=>Op(t,n)
}));
const dM=2.5;
ke("lullaby","Lullaby","bd_lullaby", {
  cd:16,type:"control",tags:["aura","area","neutral"]
},()=>`Una nana que duerme ${ss(dM)} s a los enemigos cercanos (los jefes, la mitad).`,a=>new pt(a,I(16),(e,t,n)=> {
  const s=e.player,o=160*e.stats.areaMult*(1+n.mod(e).area),r=e.enemiesInRadius(s.x,s.y,o);if(!r.length)return!1;ce.play("sandman",.4),s.cast(),ea(e,s,o,13154559),e.addFx(Op(s.x,s.y,14207231));const i=dM+oe(e,"lullabyTime");for(const l of r)l.stunUntil=Math.max(l.stunUntil,e.time+i*(l.def.boss?.5:1));return!0
},["cd","area"]));
ke("lokis_veil","Loki's Veil","bd_rokisweil", {
  cd:22,type:"control",tags:["ground","area","persistent","neutral"]
},()=>"Extiendes un velo de 8 s a tus pies: los enemigos que están dentro van ciegos y hacen la mitad de daño.",a=>new pt(a,I(22),(e,t,n)=> {
  const s=e.player;if(!e.enemiesInRadius(s.x,s.y,260).length)return!1;const o=n.mod(e),r=150*e.stats.areaMult*(1+o.area);ce.play("ef_hiding",.5),s.cast();const i=oe(e,"veilDmg");return Mr(e,s.x,s.y,r,8*(1+o.duration),.5,[10123992,6965936,13150463],l=> {
    for(const d of l)e.applyStatus(d, {
      blind:.7,weaken:.5,weakenTime:.7
    }),i&&e.damageEnemy(d,i*.5*e.stats.powerRanged, {
      src:n.id,part:"Velo",hitFx:(c,u)=>bp(c,u)
    })
  }),!0
},["cd","area"]));
ke("drum_battlefield","A Drum on the Battlefield","bd_drumbattlefield", {
  cd:24,type:"buff",tags:["buff"]
},()=>"Durante 12 s: +12% de daño y +1 de armadura.",a=>new pt(a,I(24),(e,t,n)=> {
  if(!e.nearestEnemy(450))return!1;const s=e.player,o=12*n.dur(e);return ce.play("ef_rageburst",.4),s.cast(),e.addFx(xa(vs(s.x,s.y),s)),e.addFx(Op(s.x,s.y,16756848)),e.addBuff("damage",.12+oe(e,"drumPower"),o,n.id),e.addBuff("armor",1+oe(e,"drumArmor"),o,n.id),e.ext.drumUntil=e.time+o,!0
}));
ke("siegfried","Invulnerable Siegfried","bd_siegfried", {
  cd:26,type:"buff",tags:["buff"]
},()=>"Durante 10 s recibes un 15% menos de daño.",a=>new pt(a,I(26),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,300).length)return!1;const s=e.player,o=10*n.dur(e);ce.play("ef_angelus",.4),s.cast(),e.addFx(Op(s.x,s.y,11067647)),e.addBuff("reduction",.15+oe(e,"siegPower"),o,n.id);const r=oe(e,"siegHeal");return r&&e.healPlayer(e.stats.maxHp*r),e.ext.siegUntil=e.time+o,!0
}));
Ct.tick.push((a,e)=> {
  const t=oe(a,"dontForget");if(t&&(a.ext.dfmT=(a.ext.dfmT??0)-e,!(a.ext.dfmT>0))) {
    a.ext.dfmT=1;for(const n of a.enemiesInRadius(a.player.x,a.player.y,150))a.applyStatus(n, {
      slow:t
    })
  }
});
Ct.damageMult.push(a=>oe(a,"encore")&&(a.ext.drumUntil??0)>a.time&&(a.ext.siegUntil??0)>a.time?1.15:1);
q7(Qh,[Ht(Qh, {
  name:"Actuación",icon:"tr_rhythmshooting",desc:"Arrow Vulcan y Dissonance: flechas y notas contra la horda.",skills:["arrow_vulcan","dissonance"],paths:[ {
    name:"Lluvia de notas",desc:"Más flechas, que atraviesan y salen más a menudo, hasta sonar con tus golpes.",steps:[Kn(H7("Estribillo","arrow_vulcan",1,2,"flecha"),"tr_metalic_fury"),Kn(O7("Notas que atraviesan","arrow_vulcan",3),"mi_rush_windmill"),Kn(ql("Compás rápido","arrow_vulcan",.08,3),"tr_soundblend")],final:se.auto("arrow_vulcan.a","arrow_vulcan","Arpegio","wm_dance_with_wug")
  }, {
    name:"Flecha solista",desc:"Arrow Vulcan pega más, con críticos y marcando, hasta un gran final.",steps:[Kn(iM("Flechas cantoras","arrow_vulcan",.08,3),"tr_kvasir_sonata"),Y.crit("Nota alta","arrow_vulcan","wm_lesson",3),Y.mark("Nota marcada","arrow_vulcan","wm_melodyofsink",2)],final:se.heavy("arrow_vulcan.b","arrow_vulcan","Gran final","wm_poemofnetherworld")
  }, {
    name:"Eco",desc:"Dissonance llega más lejos, desafina y suena más a menudo, hasta llenar el escenario.",steps:[Kn(H0("Eco","dissonance",.1,3),"wm_reverberation"),Kn(j7("Desafinar","dissonance",a=>( {
      weaken:.06*a,weakenTime:3
    }),a=>`Dissonance desmoraliza: los enemigos hacen un ${6*Math.max(1,a)}% menos de daño durante 3 s.`,3),"wm_gloomyday"),Kn(ql("Ruido constante","dissonance",.06,2),"wm_saturday_night_fever")],final:se.field("dissonance.a","dissonance","Gran escenario","wm_severe_rainstorm")
  }, {
    name:"Sinfonía",desc:"Dissonance pega más, aturde y con críticos, hasta una sinfonía completa.",steps:[Kn(iM("Ruido atronador","dissonance",.08,3),"wm_sound_of_destruction"),Y.stun("Golpe de platillo","dissonance","wm_sircleofnature",.06,3),Y.crit("Clímax","dissonance","wm_unlimited_humming_voice",2)],final:Kn(lM("Sinfonía","dissonance", {
      dmg:.3,count:2
    }),"tr_mystic_symphony")
  }
  ],passives:[G7(Qa("Musical Lesson","ba_musicallesson",X(.03),5),["악기","채찍"]),Qa("Ritmo","tr_rhythmical_wave",tt(.02),5),Qa("Nota aguda","tr_ain_rhapsody",Ee(.01),5),Qa("Ensayo","tr_stage_manner",rn(.04),5),Qa("Público entregado","tr_retrospection",zt(.08),5),Qa("Bis","bd_encore",za(.02),5),Qa("Escenario firme","tr_jawaii_serenade",ct(.01),5)]
},At),Ht(Qh, {
  name:"Conjunto",icon:"bd_adaptation",desc:"Lullaby y Loki's Veil: la horda duerme o no acierta.",skills:["lullaby","lokis_veil"],paths:[ {
    name:"Nana",desc:"Lullaby duerme más, llega más lejos y suena más a menudo, hasta el Ragnarok.",steps:[Le("Nana larga","wm_lullaby_deepsleep","lullabyTime",.3,a=>`Lullaby duerme ${ss(a)} s más`,3),Kn(H0("Voz que llega lejos","lullaby",.1,3),"tr_gef_nocturn"),Kn(ql("Canto de sirena","lullaby",.08,2),"tr_musical_interlude")],final:Kn(lM("Ragnarok","lullaby", {
      area:.3,cd:.15
    }),"bd_ragnarok")
  }, {
    name:"Sueño profundo",desc:"Los dormidos reciben más daño, los cercanos van lentos y Lullaby no deja de sonar.",steps:[Le("Sueño profundo","wm_deadhillhere","sleepVuln",.06,a=>`Los enemigos aturdidos o dormidos reciben un ${nt(a)} más de daño`,3),Le("Please Don't Forget Me","tr_roseblossom","dontForget",.25,a=>`Los enemigos a menos de 2,5 m de ti van siempre más lentos (${ss(a)} s de ralentización cada segundo)`,3),Y.castBuff("Dulces sueños","lullaby","cg_hermode","damage",.03,6,2)],final:se.quick("lullaby.b","lullaby","Nana incesante","cg_longingfreedom")
  }, {
    name:"Velo amplio",desc:"Loki's Veil dura más, cubre más y sale más a menudo, hasta no levantarse nunca.",steps:[O0("Capricho de Loki","tr_roki_capriccio","lokis_veil", {
      duration:.15
    },a=>`Loki's Veil dura un ${15*a}% más.`,3),Kn(H0("Velo amplio","lokis_veil",.1,3),"bd_intoabyss"),Kn(ql("Velo rápido","lokis_veil",.06,2),"cg_marionette")],final:se.long("lokis_veil.a","lokis_veil","Velo eterno","cg_moonlit")
  }, {
    name:"Velo cortante",desc:"Loki's Veil daña a los de dentro y te da crítico y velocidad, hasta volverte una danza mortal.",steps:[Le("Velo cortante","tr_nipelheim_requiem","veilDmg",10,a=>`Loki's Veil hace ${Math.round(a)} de daño por segundo (crece con el ATK a distancia) a los que están dentro`,3),Y.castBuff("Engaño","lokis_veil","cg_tarotcard","crit",.02,6,3),Y.castBuff("Paso de baile","lokis_veil","dc_fortunekiss2","speed",.04,6,2)],final:se.empower("lokis_veil.b","lokis_veil","Danza de Loki","dc_uglydance","damage",.15,6)
  }
  ],passives:[Qa("Dancing Lesson","dc_dancinglesson",ut(.01),5),Qa("Wink of Charm","dc_winkcharm",ct(.01),5),Qa("Fortune's Kiss","dc_fortunekiss",Ee(.01),5),Qa("Service for You","dc_serviceforyou",tt(.02),5),Qa("Eternal Chaos","bd_eternalchaos",ma(.15),5),Qa("Gracia escénica","at_aero_crash",gt(.015),5),Qa("Aplauso","at_aero_sync",zt(.08),5)]
},At),Ht(Qh, {
  name:"Himnos",icon:"ba_poembragi",desc:"A Drum on the Battlefield e Invulnerable Siegfried: canciones que te hacen más fuerte.",skills:["drum_battlefield","siegfried"],paths:[ {
    name:"Marcha",desc:"A Drum on the Battlefield dura más, suena más a menudo y te acoraza, hasta no parar.",steps:[O0("Marcha larga","wm_beyond_of_warcry","drum_battlefield", {
      duration:.15
    },a=>`A Drum on the Battlefield dura un ${15*a}% más.`,3),Kn(ql("Marcha de Prontera","drum_battlefield",.08,3),"tr_pron_march"),Le("Tambor de guerra","at_alpha_claw","drumArmor",.5,a=>`A Drum on the Battlefield da ${ss(a)} más de armadura`,2)],final:se.long("drum_battlefield.a","drum_battlefield","Marcha eterna","at_alpha_phase")
  }, {
    name:"Redoble",desc:"A Drum on the Battlefield da más daño, crítico y velocidad, hasta un toque de guerra.",steps:[Le("Redoble","bd_ringnibelungen","drumPower",.03,a=>`A Drum on the Battlefield da un ${nt(a)} más de daño`,3),Y.castBuff("Tambor afilado","drum_battlefield","at_apex_phase","crit",.02,8,3),Y.castBuff("Paso marcial","drum_battlefield","at_chilling_blast","speed",.04,8,2)],final:se.empower("drum_battlefield.b","drum_battlefield","Toque de guerra","at_feral_claw","damage",.15,8)
  }, {
    name:"Coraza",desc:"Invulnerable Siegfried dura más, protege más y suena más a menudo, hasta hacerte invulnerable.",steps:[O0("Canto largo","wm_frigg_song","siegfried", {
      duration:.15
    },a=>`Invulnerable Siegfried dura un ${15*a}% más.`,3),Le("Coraza de Siegfried","at_flip_flap","siegPower",.03,a=>`Invulnerable Siegfried quita un ${nt(a)} más de daño`,3),Kn(ql("Canto rápido","siegfried",.06,2),"at_frenzy_fang")],final:se.long("siegfried.a","siegfried","Invulnerable","at_furios_storm")
  }, {
    name:"Canción de maná",desc:"Invulnerable Siegfried te cura, te da daño y velocidad, y con el tambor activo haces más daño.",steps:[Le("Canción de maná","at_glacier_monolith","siegHeal",.08,a=>`Al cantar Invulnerable Siegfried te curas un ${nt(a)} de tu vida máxima`,3),Y.castBuff("Himno de batalla","siegfried","at_glacier_nova","damage",.03,8,3),Y.castBuff("Himno ligero","siegfried","at_glacier_shard","speed",.04,8,2)],final:Le("Encore","cg_specialsinger","encore",1,()=>"Con A Drum on the Battlefield e Invulnerable Siegfried activos a la vez haces +15% de daño",1)
  }
  ],passives:[Qa("A Poem of Bragi","ba_poembragi2",tt(.02),5),Qa("Apple of Idun","ba_appleidun",ma(.15),5),Qa("Assassin Cross of Sunset","ba_assassincross",gt(.015),5),Qa("A Whistle","wa_swing_dance",Ge(6),5),Qa("Mr. Kim A Rich Man","bd_richmankim",Io(.03),5),Qa("Frost Joke","ba_frostjoke",Js(.02),5),Qa("Coro","at_glacier_stomp",ct(.01),5)]
},At)]);
const {
  trees:V7,sd:Zh,sc:yc,sn:W7,sa:j0,sh:cM,st:Sn,sm:G0,capMod:uM,ic:On,wpn:$7
}
=ua,em="priest",hM=.015;
ke("sanctuary","Sanctuary","pr_sanctuary", {
  cd:20,type:"zone",tags:["ground","area","persistent","magic","holy"]
},a=>a===1?`Consagras el suelo a tus pies durante 8 s: mientras estés dentro te curas un ${String(Math.round(hM*1e3)/10).replace(".",",")}% de la vida por segundo, y los enemigos que lo pisan se queman (x2 a no-muertos).`:"+15% daño y +8% área.",a=>new pt(a,I(20),(e,t,n)=> {
  const s=e.player;if(!e.enemiesInRadius(s.x,s.y,300).length&&e.hp>=e.stats.maxHp)return!1;const o=n.mod(e),r=130*e.stats.areaMult*(1+o.area);ce.play("heal",.5),s.cast();const i=Tn(e,n,8),l=Un(e,n, {
    undeadMult:2
  });return Mr(e,s.x,s.y,r,8*(1+o.duration),.5,[16773808,16777215,14221264],(d,c)=> {
    for(const u of d)e.damageEnemy(u,i,l);c&&e.healPlayer(e.stats.maxHp*(hM+oe(e,"sanctHeal"))*.5)
  },.25),!0
},["dmg","cd","area","duration"]));
ke("safety_wall","Safety Wall","pr_safetywall", {
  cd:18,type:"buff",tags:["buff"]
},()=>"Una barrera de luz te rodea y se come los 3 próximos golpes que recibas.",a=>new pt(a,I(18),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,220).length)return!1;const s=e.player;return ce.play("ef_angelus",.5),s.cast(),e.addFx(xa(kt("str_angelus",s.x,s.y,.8,0),s)),e.addChargeBuff("safetywall",3+oe(e,"wallHits"),n.id),!0
}));
ke("benedictio","Benedictio","pr_benedictio", {
  cd:8,type:"aoe",tags:["aura","area","magic","holy"],cast:["single","holy"]
},a=>a===1?"Bendices el suelo a tu alrededor: daña a los enemigos cercanos (x2 a no-muertos) y les hace recibir un 15% más de daño durante 5 s.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:16770442,cd:I(8),dmg:ee(28,.2),radius:ee(140,.08),sound:"ef_signum",hit:()=>( {
    undeadMult:2,mark:.15,markTime:5
  }),fx:(e,t,n,s)=>kt("str_cross",t,n,s/140,0)
}));
ke("magnus_exorcismus","Magnus Exorcismus","pr_magnus", {
  cd:16,type:"aoe",tags:["ground","area","magic","holy"],cast:["area","holy"]
},a=>a===1?"Cruces sagradas caen seis veces sobre una zona: mucho daño a todo lo que hay dentro (x2 a no-muertos).":"+1 cruz y +15% daño.",a=>new fo(a, {
  cd:I(16),dmg:ee(20,.15),ticks:e=>6+Math.floor(e/2),interval:.42,area:I(0),tickRadius:120,scatter:!1,sound:"magnus",hit:()=>( {
    undeadMult:2,...Ft.LENS_ONLY
  }),fxTick:(e,t,n,s)=>kt("str_cross",t,n,s/120,0)
}));
ke("impositio","Impositio Manus","pr_impositio", {
  cd:24,type:"buff",tags:["buff"]
},()=>"Durante 15 s haces un 10% más de daño.",a=>new pt(a,I(24),(e,t,n)=> {
  if(!e.nearestEnemy(450))return!1;const s=e.player,o=15*n.dur(e);return ce.play("ef_blessing",.5),s.cast(),e.addFx(xa(vs(s.x,s.y),s)),e.addBuff("damage",.1+oe(e,"impoPower"),o,n.id),e.ext.impoUntil=e.time+o,!0
}));
ke("magnificat","Magnificat","pr_magnificat", {
  cd:28,type:"buff",tags:["buff"],effects:[ {
    key:"haste",label:"Celeridad",base:30,step:4,max:70,fmt:"n"
  }
  ]
},a=>`Durante 12 s: +${26+4*a} de Celeridad.`,a=>new pt(a,I(28),(e,t,n)=> {
  if(!e.nearestEnemy(450))return!1;const s=e.player,o=12*n.dur(e);ce.play("ef_angelus",.5),s.cast(),wu(e,s.x,s.y,()=>e.player),e.addBuff("haste",n.eff("haste")+oe(e,"magniPower"),o,n.id);const r=oe(e,"magniRegen");return r&&e.addBuff("regen",e.stats.maxHp*r,o,n.id),e.ext.magniUntil=e.time+o,!0
}));
Ct.hurt.push((a,e)=> {
  if(a.buffValue("safetywall")<=0||!a.spendBuff("safetywall"))return e;const t=a.player;a.addFx(Vn(t.x,t.y-30,$t("tex_pok3"),6,16773808,500,32,.3));const n=oe(a,"wallHeal");return n&&a.healPlayer(a.stats.maxHp*n),0
});
Ct.damageMult.push(a=>oe(a,"liturgy")&&(a.ext.impoUntil??0)>a.time&&(a.ext.magniUntil??0)>a.time?1.12:1);
V7(em,[Ht(em, {
  name:"Santuario",icon:"pr_sanctuary",desc:"Sanctuary y Safety Wall: suelo sagrado y barreras para no caer.",skills:["sanctuary","safety_wall"],paths:[ {
    name:"Tierra santa",desc:"Sanctuary más grande, que dura más y cura más, hasta ser tierra santa.",steps:[On(j0("Santuario amplio","sanctuary",.1,3),"ab_epiclesis"),G0("Consagración","ab_renovatio","sanctuary", {
      duration:.15
    },a=>`Sanctuary dura un ${15*a}% más.`,3),Le("Suelo bendito","ab_cheal","sanctHeal",.003,a=>`Sanctuary te cura un ${nt(a)} más de la vida por segundo`,2)],final: {
      ...On(uM("Tierra santa","sanctuary", {
        duration:.3,area:.15
      }),"ab_laudaramus"),stat:a=>a.ext.sanctHeal=(a.ext.sanctHeal??0)+.01,desc:()=>"Sanctuary dura un 30% más, es un 15% más grande y te cura un 1% más de la vida por segundo."
    }
  }, {
    name:"Suelo ardiente",desc:"Sanctuary quema más a la horda, la frena y la marca, hasta no dejar de arder.",steps:[On(Zh("Suelo ardiente","sanctuary",.08,3),"ab_judex"),Y.slow("Suelo pesado","sanctuary","sh_blessing_of_mystical_creatures",3),Y.mark("Juicio del suelo","sanctuary","sh_chul_ho_battering",2)],final:se.quick("sanctuary.b","sanctuary","Santuario incesante","sh_chul_ho_sonic_claw")
  }, {
    name:"Muro reforzado",desc:"Safety Wall aguanta más golpes, se recarga antes y te deja correr, hasta no caer nunca.",steps:[Le("Muro reforzado","ab_ancilla","wallHits",1,a=>`Safety Wall aguanta ${Math.round(a)} golpe${a>1?"s":""} más`,3),On(yc("Barrera rápida","safety_wall",.08,3),"sh_colors_of_hyun_rok"),Y.castBuff("Refugio","safety_wall","sh_commune_with_chul_ho","speed",.04,6,2)],final:se.long("safety_wall.a","safety_wall","Muro eterno","sh_commune_with_hyun_rok")
  }, {
    name:"Muro sanador",desc:"Cada golpe que para Safety Wall te cura, y levantarlo te da daño y crítico.",steps:[Le("Muro sanador","ab_secrament","wallHeal",.02,a=>`Cada golpe que se come Safety Wall te cura un ${nt(a)} de tu vida máxima`,3),Y.castBuff("Contraataque divino","safety_wall","sh_commune_with_ki_sul","damage",.03,6,3),Y.castBuff("Fe cortante","safety_wall","sh_hogogong_strike","crit",.02,6,2)],final:se.quick("safety_wall.b","safety_wall","Muro constante","sh_howling_of_chul_ho")
  }
  ],passives:[Sn("Gracia divina","ab_highnessheal",Ls(.02),5),Sn("Oratio","ab_oratio",ct(.01),5),Sn("Eucharistica","ab_eucharistica",lt(.4),5),Sn("Canto","ab_canto",ma(.15),5),Sn("Clementia","ab_clementia",Dd(.1),5),Sn("Silentium","ab_silentium",ut(.01),5),Sn("Devoción","sh_hyun_rok_cannon",Ge(6),5)]
},At),Ht(em, {
  name:"Exorcismo",icon:"pr_magnus",desc:"Benedictio y Magnus Exorcismus: la luz que purga a la horda.",skills:["benedictio","magnus_exorcismus"],paths:[ {
    name:"Bendición amplia",desc:"Benedictio cubre más, marca más y se recarga antes, hasta salir con tus golpes.",steps:[On(j0("Bendición amplia","benedictio",.1,3),"lmn_sh_f_foxtail"),On(cM("Anatema","benedictio",a=>( {
      mark:.04*a
    }),a=>`Benedictio marca un ${4*Math.max(1,a)}% más.`,3),"lmn_sh_foxtail"),On(yc("Liturgia rápida","benedictio",.08,2),"lmn_shc_cakram")],final:se.auto("benedictio.a","benedictio","Bendición refleja","sh_hyun_rok_spirit_power")
  }, {
    name:"Bendición ardiente",desc:"Benedictio pega más, con críticos y aturdiendo, hasta un juicio enorme.",steps:[On(Zh("Bendición ardiente","benedictio",.08,3),"lmn_shc_katar"),Y.crit("Fuego sagrado","benedictio","sh_hyun_roks_breeze",3),Y.stun("Golpe divino","benedictio","sh_ki_sul_rampage",.06,2)],final:se.heavy("benedictio.b","benedictio","Juicio ardiente","sh_ki_sul_water_spraying")
  }, {
    name:"Más cruces",desc:"Magnus Exorcismus con más cruces, más grandes y que ciegan, hasta el Judex.",steps:[On(W7("Más cruces","magnus_exorcismus",1,2,"cruz"),"ab_expiatio"),On(j0("Cruz inmensa","magnus_exorcismus",.1,3),"ab_laudaagnus"),Y.blind("Luz purgadora","magnus_exorcismus","sh_marine_festival_of_ki_sul",3)],final:On(uM("Judex","magnus_exorcismus", {
      dmg:.3,count:2
    }),"ab_vituperatum")
  }, {
    name:"Exorcismo mayor",desc:"Magnus Exorcismus pega más, más a menudo y debilita, y purifica el suelo.",steps:[On(Zh("Exorcismo mayor","magnus_exorcismus",.08,3),"ab_adoramus"),On(yc("Exorcismo rápido","magnus_exorcismus",.06,3),"sh_mystical_creature_mastery"),Y.weaken("Expiación","magnus_exorcismus","sh_sandy_festival_of_ki_sul",2)],final:se.field("magnus_exorcismus.b","magnus_exorcismus","Tierra purificada","sh_temporary_communion")
  }
  ],passives:[Sn("Purgador","lmn_soa_stick",La(.03),5),Sn("Sello sagrado","cd_petitio",Ee(.01),5),$7(On(Zh("Maza bendita",sa,.05,5),"lmn_soa_wand"),["클럽"]),Sn("Plegaria veloz","lmn_ss_m_humma",Ys(.03),5),Sn("Sentencia","ab_duplelight",zt(.08),5),Sn("Fervor sagrado","ab_offertorium",za(.02),5),Sn("Coraza santa","ag_all_bloom",ct(.01),5)]
},At),Ht(em, {
  name:"Liturgia",icon:"pr_impositio",desc:"Impositio Manus y Magnificat: bendiciones que te hacen más fuerte y más rápido.",skills:["impositio","magnificat"],paths:[ {
    name:"Manos sagradas",desc:"Impositio Manus da más daño, dura más y se renueva antes, hasta no apagarse.",steps:[Le("Manos sagradas","lmn_ss_p_humma","impoPower",.03,a=>`Impositio Manus da un ${nt(a)} más de daño`,3),G0("Imposición larga","lmn_tr_harp","impositio", {
      duration:.15
    },a=>`Impositio Manus dura un ${15*a}% más.`,3),On(yc("Bendición constante","impositio",.08,2),"lmn_tr_ribbon")],final:se.long("impositio.a","impositio","Imposición eterna","ag_astral_strike")
  }, {
    name:"Gloria",desc:"Impositio Manus te da crítico, velocidad y daño al lanzarlo, y lo lanzas sin parar.",steps:[Y.castBuff("Gloria afilada","impositio","ag_deadly_projection","crit",.02,8,3),Y.castBuff("Paso bendito","impositio","ag_energy_conversion","speed",.04,8,3),Y.castBuff("Favor de Gloria","impositio","ag_mystery_illusion","damage",.03,8,2)],final:se.quick("impositio.b","impositio","Imposición rápida","ag_soul_vc_strike")
  }, {
    name:"Magnificencia",desc:"Magnificat da más Celeridad, dura más y se recarga antes, hasta no apagarse.",steps:[Le("Magnificencia","lmn_tr_rope","magniPower",5,a=>`Magnificat da ${Math.round(a)} más de Celeridad`,3),G0("Canto eterno","lmn_tr_violin","magnificat", {
      duration:.15
    },a=>`Magnificat dura un ${15*a}% más.`,3),On(yc("Magnificat rápido","magnificat",.06,2),"ag_twohandstaff")],final:se.long("magnificat.a","magnificat","Magnificat eterno","kr_thundering_call")
  }, {
    name:"Gracia renovada",desc:"Magnificat te cura y te da daño y crítico, y con Impositio activo haces más daño.",steps:[Le("Gracia renovada","lmn_wh_bow","magniRegen",.005,a=>`Mientras dura Magnificat te curas un ${nt(a)} de tu vida máxima por segundo`,3),Y.castBuff("Himno sagrado","magnificat","kr_thundering_focus","damage",.03,8,3),Y.castBuff("Kyrie","magnificat","kr_thundering_orb","crit",.02,8,2)],final:Le("Liturgia perfecta","lmn_wh_c_bow","liturgy",1,()=>"Con Impositio Manus y Magnificat activos a la vez haces +12% de daño",1)
  }
  ],passives:[Sn("Gloria","pty_bless",X(.02),5),Sn("Increase AGI+","pty_inc_agi",gt(.015),5),Sn("Súplica","iq_second_faith",Ys(.03),5),On(cM("Aspersio",sa,a=>( {
    undeadMult:1+.15*a
  }),a=>`Tus ataques básicos hacen un +${15*Math.max(1,a)}% de daño a no-muertos.`,5),"pty_assumptio"),Sn("Silencio sagrado","sins_axe",Js(.02),5),Sn("Escudo de fe","pty_blessbox",ct(.01),5),Sn("Fe firme","sins_blade_one",Ge(6),5)]
},At)]);
const {
  trees:Y7,sd:Hl,sc:vc,sn:V0,sa:X7,sp:K7,ssp:J7,st:pn,sm:W0,capMod:$0,ic:fn,wpn:Q7
}
=ua,tm="monk";
ke("call_spirits","Call Spirits","mo_callspirits", {
  cd:14,type:"orbit",tags:["orbit","melee","physical","neutral"]
},a=>a===1?"Invocas esferas espirituales que giran a tu alrededor 8 s y golpean a los enemigos que tocan.":"+1 esfera y +15% daño.",a=>new Wv(a, {
  uptime:8,count:e=>2+Math.ceil(e/2),radius:72,speed:3.4,dmg:ee(12,.15),hitCd:.5,view:()=>zp(11065599,16777215,8),hit:()=>( {
    knock:40,...Ft.FIST
  }),sound:"ef_ruwach"
}),6);
ke("finger_offensive","Finger Offensive","mo_fingeroffensive", {
  cd:6,type:"projectile",tags:["melee","projectile","single","physical","neutral"]
},a=>a===1?"Disparas tres esferas espirituales seguidas contra el enemigo más cercano.":"+20% daño.",a=>new Ua(a, {
  cd:I(6),dmg:ee(22,.2),count:I(3),speed:640,aim:"spread",spread:.04,stagger:.08,radius:12,life:1,view:()=>zp(11065599,16777215,7),orient:null,hit:()=>( {
    knock:60,hitFx:(e,t)=>Da(e,t)
  }),sound:"ef_ruwach"
}));
ke("chain_combo","Chain Combo","mo_chaincombo", {
  cd:5,type:"single",tags:["melee","single","burst","physical","neutral"]
},a=>a===1?"Cuatro golpes seguidísimos al enemigo más cercano.":"+20% daño.",a=>new Aa(a, {
  cd:I(5),dmg:ee(12,.2),count:I(1),target:"nearest",range:110,melee:!0,burst:()=>4,burstGap:.07,hit:()=>( {
    knock:15,...Ft.FIST
  }),fx:()=>null
}));
ke("combo_finish","Combo Finish","mo_combofinish", {
  cd:9,type:"aoe",tags:["melee","area","physical","neutral"]
},a=>a===1?"Golpe final devastador al enemigo más cercano: revienta y daña a todos los de alrededor.":"+20% daño y +8% área.",a=>new Aa(a, {
  cd:I(9),dmg:ee(46,.2),count:I(1),target:"nearest",range:120,melee:!0,splash:ee(85,.08),splashPct:1,hit:()=>( {
    knock:180,...Ft.LENS
  }),fx:(e,t,n)=>(e.shake(.15,4),vs(t,n,20)),sound:"ef_bash"
}));
ke("fury","Fury","mo_explosionspirits", {
  cd:24,type:"buff",tags:["buff"]
},()=>"Liberas tu espíritu: durante 12 s, +10% de crítico y +10 de Celeridad.",a=>new pt(a,I(24),(e,t,n)=> {
  if(!e.nearestEnemy(400))return!1;const s=e.player,o=12*n.dur(e);return ce.play("ef_rageburst",.5),s.cast(),e.addFx(xa(vs(s.x,s.y),s)),e.addBuff("crit",.1+oe(e,"furyCrit"),o,n.id),e.addBuff("haste",10+oe(e,"furyHaste"),o,n.id),!0
}));
ke("asura_strike","Asura Strike","mo_extremityfist", {
  cd:22,type:"single",tags:["melee","single","physical","neutral"],cast:["single","neutral"]
},a=>a===1?"Concentras todo tu ki en un solo puñetazo brutal contra el enemigo más fuerte a tu alcance.":"+20% daño.",a=>new Aa(a, {
  cd:I(22),dmg:ee(170,.2),count:I(1),target:"strongest",range:170,melee:!0,sound:"ef_bash",hit:()=>( {
    knock:320,...Ft.LENS
  }),fx:(e,t,n)=>(e.shake(.3,8),ce.play("ef_rageburst",.6),kt("str_maemor",t,n,1.2,0))
}));
Ct.cast.push((a,e)=> {
  const t=oe(a,"comboLink");if(!t||e.id!=="chain_combo")return;const n=a.weapons.find(s=>s.id==="combo_finish");n&&n.timer>0&&(n.timer*=1-t)
});
Y7(tm,[Ht(tm, {
  name:"Esferas",icon:"mo_callspirits",desc:"Call Spirits y Finger Offensive: tu ki, en esferas que giran y que disparas.",skills:["call_spirits","finger_offensive"],paths:[ {
    name:"Órbita",desc:"Más esferas, que giran más rápido y más tiempo, hasta no apagarse nunca.",steps:[fn(V0("Más esferas","call_spirits",1,2,"esfera"),"ch_soulcollect"),W0("Órbita veloz","sr_lightningwalk","call_spirits", {
      speed:.12,area:.08
    },a=>`Call Spirits gira un ${12*a}% más rápido y un ${8*a}% más lejos.`,3),W0("Ki sostenido","mo_absorbspirits","call_spirits", {
      duration:.15
    },a=>`Call Spirits dura un ${15*a}% más.`,3)],final:fn($0("Esferas eternas","call_spirits", {
      count:2,dmg:.2
    }),"ch_tigerfist")
  }, {
    name:"Esferas densas",desc:"Esferas que pegan más, aturden y pesan, hasta curarte con cada golpe.",steps:[fn(Hl("Esferas densas","call_spirits",.08,3),"mo_spiritsrecovery"),Y.stun("Esfera aturdidora","call_spirits","at_gravity_hole",.05,3),Y.weaken("Esfera pesada","call_spirits","at_nature_aid",2)],final:se.leech("call_spirits.b","call_spirits","Ki vital","at_nature_harmony")
  }, {
    name:"Ráfaga",desc:"Más esferas, que atraviesan y salen más a menudo, hasta dispararlas con tus golpes.",steps:[fn(V0("Ráfaga de esferas","finger_offensive",1,2,"esfera"),"sr_rampageblaster"),fn(K7("Esferas perforantes","finger_offensive",3),"sr_tigercannon"),fn(vc("Dedo rápido","finger_offensive",.06,3),"at_pinion_shot")],final:se.auto("finger_offensive.a","finger_offensive","Dedo reflejo","at_primal_claw")
  }, {
    name:"Dedo del ki",desc:"Finger Offensive pega más, con críticos y marcando, hasta un dedo de la muerte.",steps:[fn(Hl("Dedo del ki","finger_offensive",.08,3),"sr_knucklearrow"),Y.crit("Punto vital","finger_offensive","at_pulse_of_madness",3),Y.mark("Marca del ki","finger_offensive","at_quill_spear",2)],final:se.heavy("finger_offensive.b","finger_offensive","Dedo de la muerte","at_roaring_charge")
  }
  ],passives:[Q7(pn("Puño de hierro","sr_rideinlightning",X(.03),5),["너클"]),pn("Mente serena","sr_gentletouch_revitalize",ma(.15),5),pn("Ki","sr_gentletouch_energygain",Ee(.01),5),pn("Dodge","mo_dodge",ut(.01),5),pn("Concentración del ki","sr_assimilatepower",zt(.08),5),pn("Absorción","sr_gentletouch_cure",Ge(6),5),pn("Paso ligero","at_roaring_piercer",gt(.015),5)]
},At),Ht(tm, {
  name:"Combo",icon:"ch_chaincrush",desc:"Chain Combo y Combo Finish: golpes encadenados que acaban en un remate.",skills:["chain_combo","combo_finish"],paths:[ {
    name:"Combo doble",desc:"Chain Combo alcanza a más, aturde y sale más a menudo, hasta saltar de enemigo en enemigo.",steps:[fn(V0("Combo doble","chain_combo",1,2,"objetivo"),"sr_windmill"),Y.stun("Codazo","chain_combo","sr_crescentelbow",.05,3),fn(vc("Combo rápido","chain_combo",.06,3),"at_savage_lunge")],final:se.chain("chain_combo.a","chain_combo","Cadena de golpes","at_six_sense")
  }, {
    name:"Golpes encadenados",desc:"Chain Combo pega más, acerca el remate y hace sangrar, hasta salir dos veces.",steps:[fn(Hl("Golpes encadenados","chain_combo",.08,3),"sr_flashcombo"),Le("Enlace","sr_skynetblow","comboLink",.25,a=>`Lanzar Chain Combo quita un ${nt(a)} del enfriamiento que le quede a Combo Finish`,3),Y.bleed("Golpe interno","chain_combo","at_sixth_sense",2)],final:se.echo("chain_combo.b","chain_combo","Combo infinito","at_solid_stomp")
  }, {
    name:"Onda de choque",desc:"Combo Finish cubre más, rompe y frena, hasta abrir las puertas del infierno.",steps:[fn(X7("Onda de choque","combo_finish",.1,3),"sr_fallenempire"),Y.mark("Rompehuesos","combo_finish","sr_cursedcircle",3),Y.slow("Onda pesada","combo_finish","at_tempest_flap",2)],final:fn($0("Gate of Hell","combo_finish", {
      dmg:.4,area:.15
    }),"sr_gateofhell")
  }, {
    name:"Remate",desc:"Combo Finish pega más, más a menudo y con críticos, y remata a los heridos.",steps:[fn(Hl("Remate","combo_finish",.08,3),"sr_earthshaker"),fn(vc("Remate rápido","combo_finish",.06,3),"at_terra_harvest"),Y.crit("Golpe certero del monje","combo_finish","at_terra_wave",2)],final:se.execute("combo_finish.b","combo_finish","Último golpe","kr_feather_sprinkle")
  }
  ],passives:[pn("Golpe triple","sr_dragoncombo",za(.02),5),pn("Steel Body","mo_steelbody",ct(.01),5),pn("Body Relocation","mo_bodyrelocation",gt(.015),5),pn("Blade Stop","mo_bladestop",lt(.4),5),fn(Hl("Puño implacable",sa,.05,5),"sr_raisingdragon"),pn("Ki Translation","mo_kitranslation",tt(.02),5),pn("Guardia del monje","kr_ground_bloom",Ls(.02),5)]
},At),Ht(tm, {
  name:"Asura",icon:"mo_extremityfist",desc:"Fury y Asura Strike: todo tu ki en un solo golpe.",skills:["fury","asura_strike"],paths:[ {
    name:"Furia larga",desc:"Fury dura más, se recarga antes y da más Celeridad, hasta no apagarse.",steps:[W0("Furia larga","sr_gentletouch_change","fury", {
      duration:.15
    },a=>`Fury dura un ${15*a}% más.`,3),fn(vc("Despertar","fury",.08,3),"sp_soulcollect"),Le("Ki veloz","sr_gentletouch_quiet","furyHaste",5,a=>`Fury da ${ss(a)} más de Celeridad`,2)],final:se.long("fury.a","fury","Furia eterna","kr_ice_pillar")
  }, {
    name:"Espíritu desatado",desc:"Fury da más crítico, daño y velocidad al lanzarla, y la lanzas sin parar.",steps:[Le("Espíritu desatado","sr_powervelocity","furyCrit",.02,a=>`Fury da un ${nt(a)} más de crítico`,3),Y.castBuff("Rabia","fury","kr_ice_splash","damage",.03,8,3),Y.castBuff("Pies del asura","fury","kr_iron_howling","speed",.04,8,2)],final:se.quick("fury.b","fury","Furia constante","kr_nasty_slash")
  }, {
    name:"Onda del asura",desc:"Asura Strike salpica, aturde y se recupera antes, y deja un cráter.",steps:[fn(J7("Onda del asura","asura_strike",.5,2,2),"sp_soulrevolve"),Y.stun("Golpe aturdidor del asura","asura_strike","kr_nature_protection",.08,3),fn(vc("Ki recuperado","asura_strike",.06,3),"sp_souldivision")],final:se.field("asura_strike.a","asura_strike","Cráter del asura","kr_nature_vigour")
  }, {
    name:"Asura definitivo",desc:"Asura Strike pega más, con críticos y marcando, hasta el golpe definitivo.",steps:[fn(Hl("Golpe del asura","asura_strike",.1,3),"sp_soulexplosion"),Y.crit("Punto de presión","asura_strike","kr_raptorial_instinct",3),Y.mark("Ki destructor","asura_strike","kr_sharpen_gust",2)],final:fn($0("Asura definitivo","asura_strike", {
      dmg:.5
    }),"sp_soulunity")
  }
  ],passives:[pn("Furia contenida","sr_howlingoflion",Zr(.05),5),pn("Cuerpo de hierro","sp_soulenergy",Ls(.02),5),pn("Golpe oculto","sp_soulshadow",La(.03),5),pn("Respiración","sp_spa",Ld(.3),5),pn("Instinto asesino","sp_soulreaper",ls(.03),5),pn("Umbral","sp_soulcurse",zt(.08),5),pn("Calma","kr_sharpen_hail",ut(.01),5)]
},At)]);
const {
  trees:Z7,sd:_c,sc:Ol,sn:mM,sa:eV,sh:pM,st:gn,sm:am,capMod:Y0,ic:An,wpn:tV
}
=ua,nm="assassin",aV=jd((a,e)=>a.poisonDmg+=e,a=>`+${nt(a)} de daño de todos tus venenos`),nV=jd((a,e)=>a.poisonVuln+=e,a=>`Los enemigos envenenados reciben un ${nt(a)} más de daño de todo`),sV=jd((a,e)=>a.poisonSlow+=e,a=>`Los enemigos envenenados van un ${nt(a)} más lentos`),oV=jd((a,e)=>a.poisonTime+=e,a=>`Tus venenos duran ${ss(a)} s más`),LC=(a,e)=>Vn(a,e,$t("tex_pok1"),8,13147376,800,96,.4);
ke("sonic_blow","Sonic Blow","as_sonicblow", {
  cd:7,type:"single",tags:["melee","single","burst","physical","neutral"]
},a=>a===1?"Ocho cuchilladas en un instante al enemigo más cercano.":"+20% daño.",a=>new Aa(a, {
  cd:I(7),dmg:ee(9,.2),count:I(1),target:"nearest",range:100,melee:!0,burst:()=>8,burstGap:.045,sound:"sonicblow",hit:()=>( {
    knock:8,sound:"attack_dagger",hitFx:(e,t)=>Da(e,t,30,.7)
  }),fx:()=>null
}));
ke("grimtooth","Grimtooth","as_grimtooth", {
  cd:6,type:"aoe",tags:["melee","area","physical","neutral"]
},a=>a===1?"Cuchillas de sombra brotan del suelo en línea recta delante de ti: dañan a toda la fila de enemigos.":"+20% daño y +8% de alcance.",a=>new dn(a, {
  cd:I(6),dmg:ee(32,.2),range:ee(250,.08),sound:"attack_dagger",hit:()=>( {
    knock:60,...Ft.LENS_ONLY
  }),cone: {
    pct:1,angle:20,fx:(e,t,n,s,o)=>hu(e,t,n,s,o,.17,9071288)
  }
}));
const DC=5;
ke("enchant_poison","Enchant Poison","as_enchantpoison", {
  cd:20,type:"buff",tags:["buff"]
},()=>`Durante 12 s todos tus golpes físicos envenenan (${DC} de daño por segundo durante 3 s, crece con el ATK).`,a=>new pt(a,I(20),(e,t,n)=> {
  if(!e.nearestEnemy(400))return!1;const s=e.player;return ce.play("ef_poisonattack",.5),s.cast(),e.addFx(xa(LC(s.x,s.y),s)),e.addBuff("enchant_poison",1,12*n.dur(e),n.id),!0
}));
ke("venom_dust","Venom Dust","as_venomdust", {
  cd:12,type:"zone",tags:["ground","area","persistent","physical","neutral"]
},a=>a===1?"Esparces polvo venenoso sobre un grupo de enemigos: la nube dura 6 s y envenena con fuerza a todos los que pasan por ella.":"+15% daño y +8% área.",a=>new pt(a,I(12),(e,t,n)=> {
  const s=e.clusterTarget(!0);if(!s)return!1;const o=n.mod(e),r=100*e.stats.areaMult*(1+o.area);ce.play("ef_venomsplasher",.5),e.player.cast();const i=Tn(e,n,7)/e.stats.powerMelee;return Mr(e,s.x,s.y,r,6*(1+o.duration),.5,[13147376,10514648,8015024],l=> {
    for(const d of l)e.applyStatus(d, {
      src:n.id,poison:i,power:e.stats.powerMelee,tags: {
        poison:"Venom Dust"
      }
    })
  }),!0
},["dmg","cd","area","duration"]));
const fM=4,gM=.2;
ke("cloaking","Cloaking","as_cloaking", {
  cd:18,type:"buff",tags:["buff"]
},()=>`Te vuelves invisible ${fM} s: los enemigos no te tocan, vas un 20% más rápido y haces un ${gM*100}% más de daño.`,a=>new pt(a,I(18),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,160).length)return!1;const s=fM*n.dur(e);ce.play("cloaking",.5),e.hidePlayer(s),e.addBuff("speed",.2,s,n.id),e.addBuff("damage",gM+oe(e,"cloakDmg"),s,n.id);const o=oe(e,"cloakCrit");return o&&e.schedule(s,()=>e.addBuff("crit",o,2,n.id)),!0
}));
ke("venom_knife","Venom Knife","as_venomknife", {
  cd:5,type:"projectile",tags:["melee","projectile","single","physical","neutral"]
},a=>a===1?"Lanzas un cuchillo envenenado al enemigo más cercano: atraviesa a uno y envenena con fuerza.":"+20% daño.",a=>new Ua(a, {
  cd:I(5),dmg:ee(24,.2),count:I(1),speed:640,aim:"spread",pierce:I(1),radius:11,life:1,view:()=>wr("tex_kunai",1),orient:0,sound:"nj_throw",hit:()=>( {
    poison:8,tags: {
      poison:"Venom Knife"
    },hitFx:(e,t)=>LC(e,t)
  })
}));
Ct.hit.push((a,e,t,n)=> {
  if(a.buffValue("enchant_poison")<=0||!n.src||n.part||e.dead)return;const s=a.weapons.find(o=>o.id===n.src);!s||!s.has("physical")||a.applyStatus(e, {
    src:"enchant_poison",poison:DC*(1+oe(a,"epPoison")),power:a.stats.powerMelee,tags: {
      poison:"Enchant Poison"
    }
  })
});
Z7(nm,[Ht(nm, {
  name:"Katar",icon:"as_katar",desc:"Sonic Blow y Grimtooth: cuchilladas que no se ven venir.",skills:["sonic_blow","grimtooth"],paths:[ {
    name:"Sonic Acceleration",desc:"Sonic Blow alcanza a más, sale más a menudo y desgarra, hasta salir con tus golpes.",steps:[An(mM("Doble Sonic Blow","sonic_blow",1,2,"objetivo"),"shc_cross_slash"),An(Ol("Sonic Acceleration","sonic_blow",.08,3),"shc_fatal_shadow_crow"),Y.bleed("Cuchillada","sonic_blow","ko_bakuretsu",3)],final:se.auto("sonic_blow.a","sonic_blow","Sonic reflejo","ko_dohu_koukai")
  }, {
    name:"Filo sónico",desc:"Sonic Blow pega más, aturde y con críticos, y remata a los heridos.",steps:[An(_c("Filo sónico","sonic_blow",.08,3),"shc_eternal_slash"),Y.stun("Aturdimiento sónico","sonic_blow","shc_savage_impact",.06,3),Y.crit("Punto débil","sonic_blow","ko_hyouhu_hubuki",2)],final:se.execute("sonic_blow.b","sonic_blow","Golpe letal","ko_kahu_enten")
  }, {
    name:"Fila larga",desc:"Grimtooth llega más lejos, desgarra y sale más a menudo, hasta saltar de uno a otro.",steps:[am("Fila larga","gc_crossripperslasher","grimtooth", {
      reach:.15
    },a=>`Grimtooth llega un ${15*a}% más lejos.`,3),An(pM("Desgarro","grimtooth",a=>( {
      bleed:.2*a
    }),a=>`Grimtooth hace sangrar un ${20*Math.max(1,a)}% de su daño en 3 s.`,3),"gc_darkcrow"),An(Ol("Colmillo rápido","grimtooth",.06,2),"ko_kazehu_seiran")],final:se.chain("grimtooth.a","grimtooth","Colmillos en cadena","ko_kyougaku")
  }, {
    name:"Meteor Assault",desc:"Grimtooth pega más, marca y debilita, hasta un asalto de meteoros.",steps:[An(_c("Colmillos de sombra","grimtooth",.08,3),"shc_impact_crater"),Y.mark("Marca de sombra","grimtooth","ko_meikyousisui",3),Y.weaken("Herida debilitante","grimtooth","ss_akumukesu",2)],final:An(Y0("Meteor Assault","grimtooth", {
      dmg:.3,count:1
    }),"asc_meteorassault")
  }
  ],passives:[tV(gn("Katar Mastery","asc_katar",X(.03),5),["카타르"]),gn("Mano izquierda","as_left",Ee(.01),5),An(_c("Doble filo",sa,.05,5),"shc_shadow_stab"),gn("Agilidad felina","shc_shadow_sense",ut(.01),5),gn("Golpe mortal","asc_breaker",zt(.08),5),gn("Asesino","gc_weaponcrush",ls(.03),5),gn("Sangre fría del asesino","ss_antenpou",Ge(6),5)]
},At),Ht(nm, {
  name:"Venenos",icon:"as_venomdust",desc:"Enchant Poison y Venom Dust: todo lo que tocas se envenena.",skills:["enchant_poison","venom_dust"],paths:[ {
    name:"Hoja impregnada",desc:"Enchant Poison dura más, envenena más y se renueva antes, hasta no secarse.",steps:[am("Hoja impregnada","gc_createnewpoison","enchant_poison", {
      duration:.15
    },a=>`Enchant Poison dura un ${15*a}% más.`,3),Le("Veneno destilado","asc_enchantpoison","epPoison",.2,a=>`El veneno de Enchant Poison hace un ${nt(a)} más de daño`,3),An(Ol("Impregnar rápido","enchant_poison",.06,2),"ss_b_book")],final:se.long("enchant_poison.a","enchant_poison","Veneno eterno","ss_charm")
  }, {
    name:"Veneno ágil",desc:"Impregnar la hoja te da velocidad, crítico y daño, y lo haces sin parar.",steps:[Y.castBuff("Paso tóxico","enchant_poison","ss_charm_box","speed",.04,8,3),Y.castBuff("Filo envenenado","enchant_poison","ss_charm_f","crit",.02,8,3),Y.castBuff("Toxina","enchant_poison","ss_charm_f_box","damage",.03,8,2)],final:se.quick("enchant_poison.b","enchant_poison","Impregnación constante","ss_charm_g")
  }, {
    name:"Nube extensa",desc:"Venom Dust más grande, más duradero y que frena, hasta no disiparse.",steps:[An(eV("Nube extensa","venom_dust",.1,3),"ob_oborogensou"),am("Nube persistente","ob_akaitsuki","venom_dust", {
      duration:.2
    },a=>`Venom Dust dura un ${20*a}% más.`,3),Y.slow("Nube pesada","venom_dust","ss_charm_g_box",2)],final:se.long("venom_dust.a","venom_dust","Niebla eterna","ss_charm_l")
  }, {
    name:"Polvo letal",desc:"Venom Dust pega más, debilita y sale más a menudo, hasta una nube letal.",steps:[An(_c("Polvo letal","venom_dust",.08,3),"as_poisonzone"),Y.weaken("Polvo debilitante","venom_dust","ss_charm_l_box",3),An(Ol("Polvo rápido","venom_dust",.06,2),"ss_charm_w")],final:An(Y0("Nube letal","venom_dust", {
      dmg:.4,area:.2
    }),"kg_kagehumi")
  }
  ],passives:[gn("Toxinas","shc_potent_venom",aV(.04),5),gn("Poison React","as_refpoison",nV(.03),5),gn("Antídoto","gc_antidote",ct(.01),5),gn("Parálisis","gc_poisonsmoke",sV(.05),5),gn("Veneno duradero","shc_enchanting_shadow",oV(.5),5),gn("Inmunidad","kg_kyomu",Ge(6),5),gn("Golpe tóxico","ob_zangetsu",tt(.02),5)]
},At),Ht(nm, {
  name:"Sombras",icon:"as_cloaking",desc:"Cloaking y Venom Knife: desapareces y atacas desde donde no te ven.",skills:["cloaking","venom_knife"],paths:[ {
    name:"Sombra larga",desc:"Cloaking dura más, se recarga antes y sales con críticos, hasta no dejarte ver nunca.",steps:[am("Sombra larga","gc_darkillusion","cloaking", {
      duration:.15
    },a=>`Cloaking dura un ${15*a}% más.`,3),An(Ol("Fundirse","cloaking",.08,3),"shc_dancing_knife"),Le("Emboscada letal","ss_kagenomai","cloakCrit",.3,a=>`Al salir de Cloaking, +${nt(a)} de crítico durante 2 s`,1)],final:se.long("cloaking.a","cloaking","Sombra eterna","ss_charm_w_box")
  }, {
    name:"Golpe invisible",desc:"Desde Cloaking pegas más, y esconderte te da velocidad, crítico y daño.",steps:[Le("Golpe invisible","asc_hallucination","cloakDmg",.05,a=>`Durante Cloaking haces un ${nt(a)} más de daño`,3),Y.castBuff("Paso en la sombra","cloaking","ss_four_charm","speed",.04,6,3),Y.castBuff("Ojo oculto","cloaking","ss_fuumakouchiku","crit",.02,6,2)],final:se.empower("cloaking.b","cloaking","Asalto desde la sombra","ss_fuumashouaku","damage",.2,6)
  }, {
    name:"Abanico",desc:"Más cuchillos, más a menudo y más venenosos, hasta lanzarlos con tus golpes.",steps:[An(mM("Lluvia de cuchillos","venom_knife",1,2,"cuchillo"),"ss_kunaikussetsu"),An(Ol("Cuchillo rápido","venom_knife",.06,3),"ss_kinryuuhou"),An(pM("Veneno de la hoja","venom_knife",a=>( {
      poison:4*a
    }),a=>`Venom Knife envenena ${4*Math.max(1,a)} de daño por segundo más.`,3),"ss_hitouakumu")],final:se.auto("venom_knife.a","venom_knife","Cuchillo reflejo","ss_raidenpou")
  }, {
    name:"Soul Destroyer",desc:"Venom Knife pega más, con críticos y marcando, hasta destrozar almas.",steps:[An(_c("Cuchillo afilado","venom_knife",.08,3),"ss_kunaiwaikyoku"),Y.crit("Corte preciso","venom_knife","ss_reiketsuhou",3),Y.mark("Marca del cazador","venom_knife","ss_scroll_tw",2)],final:An(Y0("Soul Destroyer","venom_knife", {
      dmg:.4,pierce:.2
    }),"ss_ankokuryuuakumu")
  }
  ],passives:[gn("Paso de sombra","shc_shadow_exceed",gt(.015),5),gn("Sombra reparadora","ss_kagegari",vu(.25),5),gn("Ojo en la sombra","ss_kageakumu",zt(.08),5),gn("Silencio","ss_shimiru",ct(.01),5),gn("Cuchillas finas","ss_kunaikaiten",rn(.04),5),gn("Depredador","ss_kagegissen",La(.03),5),gn("Acecho","ss_sekienhou",ut(.01),5)]
},At)]);
const {
  trees:rV,sd:bc,sc:xc,sn:X0,sa:yM,sh:sm,st:Za,sm:iV,capMod:K0,ic:Wa,wpn:lV
}
=ua,om="rogue",dV=jd((a,e)=>a.chestDiscount+=e,a=>`Los cofres cuestan un ${nt(a)} menos`);
ke("back_stab","Back Stab","rg_backstap", {
  cd:6,type:"single",tags:["melee","single","physical","neutral"]
},a=>a===1?"Apareces a la espalda del enemigo más cercano y le das una puñalada muy fuerte.":"+20% daño.",a=>new pt(a,I(6),(e,t,n)=> {
  const s=e.player,o=e.nearestEnemy(300);if(!o)return!1;const r=Qt(o.x-s.x,o.y-s.y)||1;let[i,l]=[o.x+(o.x-s.x)/r*30,o.y+(o.y-s.y)/r*30];return e.walk&&([i,l]=e.walk.nearestWalkable(i,l)),e.addFx(MA(e, {
    x:s.x,y:s.y
  }, {
    x:i,y:l
  })),[s.x,s.y]=[i,l],Gn(e,o.x,o.y),s.attack(),ce.play("attack_dagger",.6),e.damageEnemy(o,Tn(e,n,62),Un(e,n, {
    knock:60,fromX:i,fromY:l,...Ft.LENS
  })),!0
},["dmg","cd"]));
ke("raid","Raid","rg_raid", {
  cd:9,type:"aoe",tags:["aura","area","physical","neutral"]
},a=>a===1?"Tajos a tu alrededor: dañan a los enemigos cercanos, los ciegan 1,5 s y reciben un 10% más de daño durante 4 s.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:14207231,cd:I(9),dmg:ee(34,.2),radius:ee(130,.08),sound:"hit_sword",hit:()=>( {
    blind:1.5,mark:.1,markTime:4,knock:60,...Ft.LENS_ONLY
  }),fx:(e,t,n,s)=>kt("str_dkb1",t,n,s/110,0)
}));
const vM=.35,_M=8;
ke("divest_weapon","Divest Weapon","rg_stripweapon", {
  cd:13,type:"control",tags:["aura","single","neutral"]
},()=>`Desarmas a los 2 enemigos más fuertes a tu alcance: hacen un ${vM*100}% menos de daño durante ${_M} s.`,a=>new pt(a,I(13),(e,t,n)=> {
  const s=e.player,o=e.enemiesInRadius(s.x,s.y,260).filter(r=>!r.dead).sort((r,i)=>+!!i.def.boss-+!!r.def.boss||i.hp-r.hp).slice(0,2+n.mod(e).count);if(!o.length)return!1;ce.play("ef_steal",.5),s.cast();for(const r of o)e.addFx(bp(r.x,r.y)),e.applyStatus(r, {
    weaken:vM+oe(e,"divestWeak"),weakenTime:_M+oe(e,"divestTime")
  });return!0
},["cd","count"]));
ke("intimidate","Intimidate","rg_intimidate", {
  cd:8,type:"single",tags:["melee","single","physical","neutral"]
},a=>a===1?"Agarras al enemigo más cercano y lo lanzas muy lejos: daño y aturdimiento de 1 s.":"+20% daño.",a=>new Aa(a, {
  cd:I(8),dmg:ee(38,.2),count:I(1),target:"nearest",range:120,melee:!0,sound:"ef_bash",hit:()=>( {
    knock:600,stun:1,stunChance:1,...Ft.LENS
  }),fx:()=>null
}));
const bM=3;
ke("steal_coin","Steal Coin","rg_stealcoin", {
  cd:5,type:"single",tags:["melee","single","physical","neutral"]
},a=>a===1?`Golpe rápido al enemigo más cercano que le roba zeny (${bM} o más según el monstruo).`:"+20% daño.",a=>new dn(a, {
  cd:I(5),dmg:ee(30,.2),range:I(95),sound:"ef_steal",hit:()=>( {
    ...Ft.LENS_ONLY,afterHit:(e,t)=> {
      e.zeny+=Math.round((bM+t.def.exp/4)*(1+oe(e,"coinZeny"))*e.stats.zenyMult),e.addFx(Rp(t.x,t.y)),ce.play("ef_coin",.35,3)
    }
  })
}));
ke("graffiti","Graffiti","rg_graffiti", {
  cd:14,type:"zone",tags:["ground","area","persistent","physical","neutral"]
},a=>a===1?"Pintas el suelo bajo un grupo de enemigos durante 7 s: los que lo pisan van más lentos, reciben algo de daño y un 10% más de todo.":"+15% daño y +8% área.",a=>new pt(a,I(14),(e,t,n)=> {
  const s=e.clusterTarget(!0);if(!s)return!1;const o=n.mod(e),r=110*e.stats.areaMult*(1+o.area);ce.play("water_spray",.4),e.player.cast();const i=Tn(e,n,6),l=Un(e,n, {
    slow:.6,mark:.1,markTime:1
  });return Mr(e,s.x,s.y,r,7*(1+o.duration),.5,[16738992,7002367,16769130],d=> {
    for(const c of d)e.damageEnemy(c,i,l)
  },.35),!0
},["dmg","cd","area","duration"]));
Ct.damageMult.push((a,e)=> {
  const t=oe(a,"divestVuln");return t&&e.weakUntil>a.time?1+t:1
});
rV(om,[Ht(om, {
  name:"Asalto",icon:"rg_backstap",desc:"Back Stab y Raid: siempre por la espalda.",skills:["back_stab","raid"],paths:[ {
    name:"Siempre detrás",desc:"Back Stab sale más a menudo, hace sangrar y aturde, y si mata vuelve a estar lista.",steps:[Wa(xc("Siempre detrás","back_stab",.08,3),"abc_chasing_break"),Wa(sm("Herida traicionera","back_stab",a=>( {
      bleed:.15*a
    }),a=>`Back Stab hace sangrar un ${15*Math.max(1,a)}% de su daño en 3 s.`,3),"abc_abyss_slayer"),Y.stun("Golpe en la nuca","back_stab","abc_unlucky_rush",.08,2)],final:se.refresh("back_stab.a","back_stab","Puñalada sin fin","nw_auto_firing_launcher")
  }, {
    name:"Puñalada certera",desc:"Back Stab pega más, con críticos y por el punto ciego, hasta una puñalada mortal.",steps:[Wa(bc("Puñalada certera","back_stab",.08,3),"abc_deft_stab"),Y.crit("Traición","back_stab","nw_basic_grenade",3),Y.mark("Punto ciego","back_stab","nw_grenade",2)],final:se.heavy("back_stab.b","back_stab","Puñalada mortal","nw_grenade_box")
  }, {
    name:"Asalto amplio",desc:"Raid cubre más, ciega y sale más a menudo, hasta el asalto final.",steps:[Wa(yM("Asalto amplio","raid",.1,3),"abc_from_the_abyss"),Wa(sm("Arena en los ojos","raid",a=>( {
      blind:.5*a
    }),a=>`Raid ciega ${ss(.5*Math.max(1,a))} s más.`,3),"sc_ignorance"),Wa(xc("Asalto rápido","raid",.06,2),"nw_grenade_fragment")],final:Wa(K0("Asalto final","raid", {
      dmg:.35,area:.15
    }),"sc_bloodylust")
  }, {
    name:"Saqueo",desc:"Raid pega más, amedrenta y hace sangrar, y te cura con lo que saquea.",steps:[Wa(bc("Saqueo","raid",.08,3),"abc_abyss_square"),Y.weaken("Amedrentar","raid","nw_grenade_mastery",3),Y.bleed("Asalto sangriento","raid","nw_grenades_dropping",2)],final:se.leech("raid.b","raid","Botín de sangre","nw_hasty_fire_in_the_hole")
  }
  ],passives:[lV(Za("Filo de pícaro","abc_abyss_dagger",X(.03),5),["단검","검"]),Za("Pies ligeros","abc_hit_and_sliding",gt(.015),5),Za("Traicionero","sc_fatalmenace",zt(.08),5),Za("Gangster","abc_abyss_strike",Ee(.01),5),Za("Snatcher","rg_snatcher",rl(.06),5),Za("Saqueador","abc_abyss_flame",ls(.03),5),Za("Callejero","nw_intensive_aim",Ge(6),5)]
},At),Ht(om, {
  name:"Despojo",icon:"rg_stripweapon",desc:"Divest Weapon e Intimidate: deja a la horda sin armas ni ganas de pelear.",skills:["divest_weapon","intimidate"],paths:[ {
    name:"Manos largas",desc:"Divest Weapon alcanza a más, dura más y sale más a menudo, hasta el Full Strip.",steps:[Wa(X0("Manos largas","divest_weapon",1,2,"objetivo"),"rg_stripshield"),Le("Bien escondido","st_fullstrip","divestTime",1,a=>`Divest Weapon dura ${ss(a)} s más`,3),Wa(xc("Ladrón profesional","divest_weapon",.08,3),"abc_strip_shadow")],final:Wa(K0("Full Strip","divest_weapon", {
      count:2
    }),"st_stealbackpack")
  }, {
    name:"Despojo total",desc:"Los desarmados hacen menos daño y reciben más, y desarmar te da daño, hasta hacerlo con tus golpes.",steps:[Le("Despojo total","rg_striphelm","divestWeak",.05,a=>`Divest Weapon quita un ${nt(a)} más de daño`,3),Le("Indefensos","sc_weakness","divestVuln",.06,a=>`Los enemigos desarmados o desmoralizados reciben un ${nt(a)} más de daño`,3),Y.castBuff("Botín","divest_weapon","nw_magazine_for_one","damage",.03,6,2)],final:se.auto("divest_weapon.b","divest_weapon","Despojo reflejo","nw_mission_bombard")
  }, {
    name:"Dos a la vez",desc:"Intimidate alcanza a más, más a menudo y aturde, hasta lanzarlos unos contra otros.",steps:[Wa(X0("Dos a la vez","intimidate",1,2,"objetivo"),"sc_groomy"),Wa(xc("Amenaza rápida","intimidate",.06,3),"nw_only_one_bullet"),Y.stun("Golpe bajo","intimidate","ss_shinkirou",.08,3)],final:se.chain("intimidate.a","intimidate","Lanzamiento en cadena","ss_tokedasu")
  }, {
    name:"Humillación",desc:"Intimidate pega más, humilla y se burla, y remata a los caídos.",steps:[Wa(bc("Lanzamiento brutal","intimidate",.08,3),"sc_laziness"),Wa(sm("Humillación","intimidate",a=>( {
      mark:.08*a,markTime:5
    }),a=>`Los enemigos que lanza Intimidate reciben un +${8*Math.max(1,a)}% de daño durante 5 s.`,3),"sc_unlucky"),Y.weaken("Burla","intimidate","kr_typhoon_wing",2)],final:se.execute("intimidate.b","intimidate","Rematar al caído","kr_wind_veil")
  }
  ],passives:[Za("Uñas largas","rg_cleaner",tt(.02),5),Za("Armadura robada","sc_stripaccessary",lt(.4),5),Za("Plagiarism","rg_plagiarism",za(.02),5),Za("Amenaza","sc_enervation",ct(.01),5),Za("Duro de pelar","sc_reproduce",Ge(6),5),Za("Ladrón ágil","kr_wolf_instinct",ut(.01),5),Za("Vista de ladrón","mh_pyroclastic",Ee(.01),5)]
},At),Ht(om, {
  name:"Picardía",icon:"rg_stealcoin",desc:"Steal Coin y Graffiti: zeny ajeno y trucos sucios.",skills:["steal_coin","graffiti"],paths:[ {
    name:"Carterista",desc:"Steal Coin alcanza a más, más a menudo y roba más, hasta robar con tus golpes.",steps:[Wa(X0("Carterista","steal_coin",1,2,"objetivo"),"abc_chasing_shot"),Wa(xc("Dedos ágiles","steal_coin",.08,3),"sc_deadlyinfect"),Le("Mano de oro","sc_manhole","coinZeny",.5,a=>`Steal Coin roba un ${nt(a)} más de zeny`,3)],final:se.auto("steal_coin.a","steal_coin","Robo reflejo","mh_silent_breeze")
  }, {
    name:"Golpe interesado",desc:"Steal Coin pega más, con críticos y aturdiendo, hasta un gran golpe.",steps:[Wa(bc("Golpe interesado","steal_coin",.08,3),"abc_frenzy_shot"),Y.crit("Golpe sucio","steal_coin","mh_silvervein_rush",3),Y.stun("Moneda en la cara","steal_coin","mh_sonic_claw",.06,2)],final:se.heavy("steal_coin.b","steal_coin","Gran golpe","mh_sonic_craw")
  }, {
    name:"Mural",desc:"Graffiti más grande, más duradero y pegajoso, hasta una obra maestra.",steps:[Wa(yM("Mural","graffiti",.1,3),"nw_spiral_shooting"),iV("Pintura duradera","mh_stahl_horn","graffiti", {
      duration:.15
    },a=>`Graffiti dura un ${15*a}% más.`,3),Y.slow("Pintura pegajosa","graffiti","mh_steinwand",2)],final:Wa(K0("Obra maestra","graffiti", {
      duration:.4,dmg:.25
    }),"nw_wild_fire")
  }, {
    name:"Pintura corrosiva",desc:"Graffiti pega más, firma y debilita, y lo pintas sin parar.",steps:[Wa(bc("Pintura corrosiva","graffiti",.08,3),"nw_p_f_i"),Wa(sm("Firma","graffiti",a=>( {
      mark:.05*a,markTime:1
    }),a=>`Graffiti hace que los enemigos reciban un ${5*Math.max(1,a)}% más de daño.`,3),"nw_the_vigilante_at_night"),Y.weaken("Pintura tóxica","graffiti","mh_style_change",2)],final:se.quick("graffiti.b","graffiti","Pinta y repinta","mh_summon_legion")
  }
  ],passives:[Za("Bolsillos hondos","abc_dagger_and_bow_m",mo(.05),5),Za("Suerte del pícaro","sc_invisibility",ut(.01),5),Za("Regateo","rl_richs_coin",dV(.03),5),Za("Tunnel Drive","nw_hidden_card",gt(.015),5),Za("Pinta y corre","nw_wild_shot",vu(.25),5),Za("Rufián","nw_midnight_fallen",La(.03),5),Za("Truco sucio","mh_tempering",zt(.08),5)]
},At)]);
const {
  trees:cV,sd:jl,sc:Gl,sn:J0,sa:rm,sh:xM,st:yn,sm:wM,capMod:Q0,ic:Ba,wpn:uV
}
=ua,im="blacksmith",hV=jd((a,e)=>a.chestDiscount+=e,a=>`Los cofres cuestan un ${nt(a)} menos`),mV=(a=1.3)=>()=> {
  const e=new Ra(xt.itemTextures.get(1301));
  return e.anchor.set(.5),e.scale.set(a),e
};
ke("axe_tornado","Axe Tornado","nc_axetornado", {
  cd:8,type:"aoe",tags:["aura","area","melee","physical","neutral"]
},a=>a===1?"Giras con el arma tres veces: cada vuelta daña y aparta a los enemigos de tu alrededor.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:16767136,cd:I(8),dmg:ee(17,.2),radius:ee(125,.08),ticks:I(3),interval:.25,sound:"hit_sword",hit:()=>( {
    knock:80,...Ft.LENS_ONLY
  }),fx:(e,t,n,s)=>ri(Yv(t,n-25,s,16767136),25)
}));
ke("axe_boomerang","Axe Boomerang","nc_axeboomerang", {
  cd:7,type:"projectile",tags:["melee","projectile","pierce","return","physical","neutral"]
},a=>a===1?"Lanzas un hacha que gira, atraviesa a todos los enemigos y vuelve.":"+20% daño.",a=>new Ua(a, {
  cd:I(7),dmg:ee(32,.2),count:I(1),speed:470,aim:"spread",pierce:I(99),returns:!0,radius:24,life:1.2,spin:16,view:mV(),orient:null,sound:"nj_throw",hit:()=>( {
    knock:90,...Ft.LENS
  })
}));
const MM=.12,FC=.2;
ke("weapon_perfection","Weapon Perfection","bs_weaponperfect", {
  cd:24,type:"buff",tags:["buff"]
},()=>`Durante 14 s haces un ${MM*100}% más de daño, y un ${FC*100}% más a jefes y élites.`,a=>new pt(a,I(24),(e,t,n)=> {
  if(!e.nearestEnemy(450))return!1;const s=e.player,o=14*n.dur(e);ce.play("bs_refinesuccess",.5),s.cast(),e.addFx(xa(vs(s.x,s.y),s)),e.addBuff("damage",MM,o,n.id);const r=oe(e,"wpHaste");return r&&e.addBuff("haste",r,o,n.id),e.ext.wpUntil=e.time+o,!0
}));
ke("rush_quake","Rush Quake","mt_rush_quake", {
  cd:12,type:"aoe",tags:["aura","area","melee","physical","earth"],effects:[ {
    key:"stun",label:"Probabilidad de aturdir",base:.4,step:.08,max:1,fmt:"pct"
  }
  ]
},a=>a===1?"Golpeas el suelo con todas tus fuerzas: la onda daña y puede aturdir a todos los enemigos de alrededor.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:16756832,cd:I(12),dmg:ee(40,.2),radius:ee(150,.08),sound:"hammerfall",hit:(e,t)=>( {
    stun:1.2,stunChance:t.eff("stun"),knock:120,...Ft.LENS_ONLY
  }),fx:(e,t,n,s)=>(vr(e,t,n,s),e.shake(.25,6),kt("str_dust",t,n,s/90,0))
}));
ke("greed","Greed","bs_greed", {
  cd:16,type:"aoe",tags:["aura","area","melee","physical","neutral"]
},a=>a===1?"Recoges de golpe todo el botín de alrededor y tu codicia golpea a los enemigos cercanos (te dan algo de zeny).":"+20% daño y +8% área.",a=>new xn(a, {
  halo:16769130,cd:I(16),dmg:ee(24,.2),radius:ee(150,.08),sound:"ef_coin",hit:()=>( {
    knock:60,afterHit:(e,t)=> {
      e.zeny+=Math.round((1+oe(e,"greedZeny"))*e.stats.zenyMult),e.addFx(Rp(t.x,t.y))
    }
  }),fx:()=>null,cast:(e,t)=> {
    e.addBuff("pickup",600,.6,"greed"),e.addFx(ri(Yv(e.player.x,e.player.y-20,t,16769130),20))
  }
}));
ke("ore_discovery","Ore Discovery","bs_findingore", {
  cd:11,type:"aoe",tags:["ground","area","melee","physical","earth"]
},a=>a===1?"Una lluvia de mineral cae sobre un grupo de enemigos: seis rocas que golpean y apartan.":"+1 roca y +15% daño.",a=>new fo(a, {
  cd:I(11),dmg:ee(22,.15),ticks:e=>6+Math.floor(e/2),interval:.12,area:ee(115,.06),tickRadius:50,sound:"ef_hit4",hit:()=>( {
    knock:100,...Ft.LENS_ONLY
  }),fxTick:(e,t,n,s)=>kt("str_dust",t,n,s/60,0)
}));
Ct.damageMult.push((a,e)=>(a.ext.wpUntil??0)>a.time&&(e.elite||e.def.boss)?1+FC+oe(a,"wpBoss"):1);
cV(im,[Ht(im, {
  name:"Furia",icon:"nc_axetornado",desc:"Axe Tornado y Axe Boomerang: el hacha que gira y que vuela.",skills:["axe_tornado","axe_boomerang"],paths:[ {
    name:"Torbellino",desc:"Axe Tornado más amplio, con más vueltas y más a menudo, hasta girar con tus golpes.",steps:[Ba(rm("Giro amplio","axe_tornado",.1,3),"hs_bs_giant_axe"),Ba(J0("Otra vuelta","axe_tornado",1,2,"vuelta"),"nc_vulcanarm"),Ba(Gl("Inercia","axe_tornado",.08,3),"nc_boostknuckle")],final:se.auto("axe_tornado.a","axe_tornado","Tornado reflejo","nc_analyze")
  }, {
    name:"Tornado de acero",desc:"Axe Tornado pega más, desgarra y aturde, hasta un tornado de acero.",steps:[Ba(jl("Torbellino de acero","axe_tornado",.08,3),"axe_furious"),Y.bleed("Hacha dentada","axe_tornado","nc_armscannon",3),Y.stun("Golpe giratorio","axe_tornado","nc_b_sideslide",.06,2)],final:Ba(Q0("Tornado de acero","axe_tornado", {
      dmg:.3,count:1,area:.15
    }),"nc_selfdestruction")
  }, {
    name:"Lluvia de hachas",desc:"Más hachas, más rápidas y más a menudo, que rebotan de enemigo en enemigo.",steps:[Ba(J0("Dos hachas","axe_boomerang",1,2,"hacha"),"itm_tomahawk"),Ba(Gl("Lanzamiento ligero","axe_boomerang",.06,3),"nc_coldslower"),wM("Vuelo de hacha","nc_disjoint","axe_boomerang", {
      speed:.12,area:.08
    },a=>`Axe Boomerang vuela un ${12*a}% más rápido y es un ${8*a}% más grande.`,3)],final:se.chain("axe_boomerang.a","axe_boomerang","Hacha rebotadora","nc_f_sideslide")
  }, {
    name:"Hacha arrojadiza",desc:"Axe Boomerang pega más, desgarra y con críticos, hasta un hacha de gigante.",steps:[Ba(jl("Hacha arrojadiza","axe_boomerang",.08,3),"hs_bs_axe"),Ba(xM("Filo dentado","axe_boomerang",a=>( {
      bleed:.15*a
    }),a=>`Axe Boomerang hace sangrar un ${15*Math.max(1,a)}% de su daño en 3 s.`,3),"war_axe_il"),Y.crit("Golpe certero de hacha","axe_boomerang","nc_flamelauncher",2)],final:se.heavy("axe_boomerang.b","axe_boomerang","Hacha del gigante","nc_madolicence")
  }
  ],passives:[uV(yn("Hachas pesadas","nc_trainingaxe",X(.03),5),["도끼","양손도끼"]),yn("Skin Tempering","bs_skintemper",ct(.01),5),Ba(jl("Brazo fuerte",sa,.05,5),"bs_twohandsword"),yn("Herrero robusto","bs_iron",Ls(.02),5),yn("Impulso","nc_acceleration",tt(.02),5),yn("Golpe demoledor","nc_pilebunker",zt(.08),5),yn("Músculo","nc_magma_eruption",Ee(.01),5)]
},At),Ht(im, {
  name:"Forja",icon:"bs_weaponperfect",desc:"Weapon Perfection y Rush Quake: un arma perfecta y un martillazo que sacude el suelo.",skills:["weapon_perfection","rush_quake"],paths:[ {
    name:"Temple duradero",desc:"Weapon Perfection dura más, se afila antes y da Celeridad, hasta no perder el filo.",steps:[wM("Temple duradero","bs_dagger","weapon_perfection", {
      duration:.15
    },a=>`Weapon Perfection dura un ${15*a}% más.`,3),Ba(Gl("Afilado rápido","weapon_perfection",.08,3),"bs_mace"),Le("Temple","bs_enchantedstone","wpHaste",6,a=>`Weapon Perfection da además ${Math.round(a)} de Celeridad`,2)],final:se.long("weapon_perfection.a","weapon_perfection","Filo eterno","nc_researchfe")
  }, {
    name:"Filo para gigantes",desc:"Weapon Perfection pega más a los grandes y afilar te da crítico, velocidad y daño.",steps:[Le("Filo para gigantes","bs_spear","wpBoss",.05,a=>`Weapon Perfection hace un ${nt(a)} más de daño a jefes y élites`,3),Y.castBuff("Acero afilado","weapon_perfection","nc_shapeshift","crit",.02,8,3),Y.castBuff("Ligereza","weapon_perfection","nc_silversniper","speed",.04,8,2)],final:se.empower("weapon_perfection.b","weapon_perfection","Forja de guerra","nc_stealthfield","damage",.15,8)
  }, {
    name:"Onda sísmica",desc:"Rush Quake más amplio, que rompe el suelo y frena, hasta dejar una grieta.",steps:[Ba(rm("Onda sísmica","rush_quake",.1,3),"nc_magneticfield"),Ba(xM("Suelo roto","rush_quake",a=>( {
      mark:.06*a,markTime:4
    }),a=>`Los enemigos que alcanza Rush Quake reciben un +${6*Math.max(1,a)}% de daño durante 4 s.`,3),"mt_d_machine"),Y.slow("Temblor","rush_quake","nc_trainigaxe",2)],final:se.field("rush_quake.a","rush_quake","Grieta","mt_a_machine")
  }, {
    name:"Martillo divino",desc:"Rush Quake pega más, más a menudo y aturde, hasta el martillo divino.",steps:[Ba(jl("Golpe sísmico","rush_quake",.08,3),"mt_energy_cannonade"),Ba(Gl("Martillazo rápido","rush_quake",.06,3),"mt_abr_m"),Y.stun("Golpe de yunque","rush_quake","mt_m_machine",.08,2)],final:Ba(Q0("Martillo divino","rush_quake", {
      dmg:.35,area:.2
    }),"mt_spark_blaster")
  }
  ],passives:[yn("Forja maestra","bs_sword",Ee(.01),5),yn("Yunque","bs_knuckle",lt(.4),5),yn("Weapon Repair","bs_repairweapon",ma(.15),5),yn("Refinado","ws_weaponrefine",X(.02),5),yn("Peso del martillo","lmn_mt_mace",Js(.02),5),yn("Fuego de fragua","nc_emergencycool",Zr(.05),5),yn("Mandil","mt_summon_abr_battle_warior",Ge(6),5)]
},At),Ht(im, {
  name:"Mena",icon:"bs_findingore",desc:"Greed y Ore Discovery: botín, zeny y lluvias de mineral.",skills:["greed","ore_discovery"],paths:[ {
    name:"Brazos largos",desc:"Greed llega más lejos, sale más a menudo y agarra, hasta salir con tus golpes.",steps:[Ba(rm("Brazos largos","greed",.1,3),"acc_ore_3"),Ba(Gl("Siempre más","greed",.08,3),"acc_ore_4"),Y.slow("Agarrón","greed","mt_summon_abr_dual_cannon",2)],final:se.auto("greed.a","greed","Codicia refleja","mt_summon_abr_infinity")
  }, {
    name:"Bolsa llena",desc:"Greed pega más, saca más zeny y debilita, y te cura con lo que se lleva.",steps:[Ba(jl("Codicia afilada","greed",.08,3),"acc_ore_2"),Le("Bolsa llena","acc_stone_2","greedZeny",1,a=>`Greed saca ${ss(a)} zeny más de cada enemigo que golpea`,3),Y.weaken("Golpe de avaro","greed","mt_summon_abr_mother_net",2)],final:se.leech("greed.b","greed","Avaricia vital","mt_triple_laser")
  }, {
    name:"Derrumbe",desc:"Más rocas, en más área y más a menudo, hasta una lluvia de oricalco.",steps:[Ba(J0("Derrumbe","ore_discovery",2,2,"roca"),"con_meteor_extract"),Ba(rm("Lluvia amplia","ore_discovery",.1,3),"gn_cartboost"),Ba(Gl("Vetas rápidas","ore_discovery",.06,3),"gn_hells_plant")],final:Ba(Q0("Lluvia de oricalco","ore_discovery", {
      dmg:.3,area:.2
    }),"spl_meteorite_fragment")
  }, {
    name:"Mineral pesado",desc:"Ore Discovery pega más, aturde y marca, hasta un meteorito.",steps:[Ba(jl("Mineral pesado","ore_discovery",.08,3),"con_meteorite_fragment"),Y.stun("Pedrada","ore_discovery","con_meteorite_dust",.08,3),Y.mark("Mineral marcado","ore_discovery","gn_training_sword",2)],final:se.heavy("ore_discovery.b","ore_discovery","Meteorito","gn_wallofthorn")
  }
  ],passives:[yn("Avaricia","acc_ore_1",mo(.05),5),yn("Minero","acc_stone_1",rl(.06),5),yn("Callos","acc_stone_3",Ge(6),5),yn("Vetas","acc_stone_4",Io(.02),5),yn("Pico afilado","pow_orb",zt(.08),5),yn("Oro puro","spl_orb",hV(.03),5),yn("Espalda de minero","mh_polishing_needle",ct(.01),5)]
},At)]);
const {
  trees:pV,sd:lm,sc:dm,sn:Z0,sa:fV,ssp:gV,sh:SM,st:en,sm:cm,capMod:eg,ic:Rn
}
=ua,um="alchemist";
ke("acid_terror","Acid Terror","am_acidterror", {
  cd:6,type:"projectile",tags:["melee","projectile","single","physical","neutral"]
},a=>a===1?"Lanzas un frasco de ácido al enemigo más cercano: mucho daño y le corroe la armadura (recibe un 15% más de daño durante 5 s).":"+20% daño.",a=>new Ua(a, {
  cd:I(6),dmg:ee(36,.2),count:I(1),speed:480,aim:"spread",radius:13,life:1.1,spin:10,view:()=>wr("tex_poisonbottle",.8,!1,12124042),sound:"nj_throw",hit:()=>( {
    mark:.15,markTime:5,hitFx:(e,t)=>kt("str_venomsplasher",e,t,.5,0)
  })
}));
ke("demonstration","Demonstration","am_demonstration", {
  cd:12,type:"zone",tags:["ground","area","persistent","physical","fire"]
},a=>a===1?"Lanzas una botella incendiaria sobre un grupo: el suelo arde 6 s y quema a los que lo pisan.":"+15% daño y +8% área.",a=>new pt(a,I(12),(e,t,n)=> {
  const s=e.clusterTarget(!0);if(!s)return!1;const o=n.mod(e),r=95*e.stats.areaMult*(1+o.area),i=6*(1+o.duration),l=Tn(e,n,10),d=Un(e,n,Ft.FIREHIT);e.player.cast(),ce.play("nj_throw",.4);const[c,u]=[s.x,s.y];return e.addFx(wA(e,e.player, {
    x:c,y:u
  },450,()=> {
    ce.play("ef_firewall",.5),Mr(e,c,u,r,i,.5,[16742960,16756800,13122074],h=> {
      for(const m of h)e.damageEnemy(m,l,d)
    })
  },$t("tex_poisonbottle"))),!0
},["dmg","cd","area","duration"]));
const AM=18;
jE("homunculus","Vanilmirth","am_callhomun");
ke("call_homunculus","Call Homunculus","am_callhomun", {
  cd:26,type:"orbit",tags:["orbit","melee","physical","neutral"]
},a=>a===1?`Llamas a tu homúnculo durante ${AM} s: te sigue y salta sobre el enemigo más cercano una vez por segundo.`:"+15% daño.",a=>new pt(a,I(26),(e,t,n)=> {
  if(!e.nearestEnemy(400))return!1;const s=n.mod(e),o=e.player;ce.play("ef_beginspell",.4),o.cast();const r=1/(1+oe(e,"homunHaste"));for(let i=0;i<=s.count;i++)nC(e, {
    sheet:"homun_vanilmirth",scale:.9,x:o.x-40-i*30,y:o.y+18,follow:!0,life:AM*(1+s.duration),every:r,range:230,dash:!0,hit:(l,d)=> {
      e.addFx(Da(l.x,l.y)),e.damageEnemy(l,Tn(e,n,20),Un(e,n, {
        knock:50,fromX:d.x,fromY:d.y,sounds:["hit_fist1","hit_fist2"]
      }))
    }
  });return!0
},["dmg","cd","count","duration"]),6);
const kM=14;
ke("summon_flora","Summon Flora","am_cannibalize", {
  cd:16,type:"zone",tags:["ground","area","persistent","physical","neutral"]
},a=>a===1?`Plantas una Mandrágora a tu lado durante ${kM} s: muerde a los enemigos que se le acercan.`:"+15% daño y +8% área.",a=>new pt(a,I(16),(e,t,n)=> {
  if(!e.nearestEnemy(350))return!1;const s=n.mod(e),o=e.player,r=170*e.stats.areaMult*(1+s.area);ce.play("ef_beginspell",.4),o.cast();for(let i=0;i<=s.count;i++) {
    const l=Wt()*Math.PI*2;nC(e, {
      sheet:"summon_mandragora",scale:.85,x:o.x+ln(l)*60,y:o.y+Sa(l)*45,life:kM*(1+s.duration),every:.9,range:r,hit:d=> {
        e.addFx(Da(d.x,d.y)),e.damageEnemy(d,Tn(e,n,14),Un(e,n, {
          knock:30,sounds:["hit_fist3"]
        }))
      }
    })
  }
  return!0
},["dmg","cd","count","area","duration"]));
const EM=.18;
ke("potion_pitcher","Potion Pitcher","am_potionpitcher", {
  cd:14,type:"buff",tags:["buff"]
},()=>`Cuando te han herido, te lanzas una poción que te cura un ${EM*100}% de la vida máxima.`,a=>new pt(a,I(14),e=> {
  if(e.hp>e.stats.maxHp*.8)return!1;const t=e.player;ce.play("heal",.5),t.cast(),wu(e,t.x,t.y,()=>e.player),e.healPlayer(e.stats.maxHp*(EM+oe(e,"pitcherHeal"))*e.stats.potionMult);const n=oe(e,"pitcherRegen");n&&e.addBuff("regen",e.stats.maxHp*n,5,"potion_pitcher");const s=oe(e,"pitcherBurst");if(s) {
    ea(e,t,100,10354589);for(const o of e.enemiesInRadius(t.x,t.y,100))e.damageEnemy(o,s*e.stats.powerMelee, {
      src:"potion_pitcher",part:"Salpicadura",knock:120,fromX:t.x,fromY:t.y
    })
  }
  return!0
}));
ke("chemical_protection","Chemical Protection","am_cp_armor", {
  cd:26,type:"buff",tags:["buff"]
},()=>"Durante 15 s recibes un 12% menos de daño y tienes +1 de armadura.",a=>new pt(a,I(26),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,300).length)return!1;const s=e.player,o=15*n.dur(e);return ce.play("ef_angelus",.4),s.cast(),e.addFx(xa(vs(s.x,s.y),s)),e.addBuff("reduction",.12+oe(e,"cpPower"),o,n.id),e.addBuff("armor",1,o,n.id),e.ext.cpUntil=e.time+o,!0
}));
Ct.hurt.push((a,e,t)=> {
  const n=oe(a,"cpThorns");return n&&t&&!t.dead&&(a.ext.cpUntil??0)>a.time&&a.damageEnemy(t,n*a.stats.powerMelee, {
    src:"chemical_protection",part:"Espinas",numColor:12124042
  }),e
});
pV(um,[Ht(um, {
  name:"Química",icon:"am_acidterror",desc:"Acid Terror y Demonstration: ácidos que corroen y botellas que arden.",skills:["acid_terror","demonstration"],paths:[ {
    name:"Dos frascos",desc:"Más frascos, que salpican y salen más a menudo, hasta una reacción en cadena.",steps:[Rn(Z0("Dos frascos","acid_terror",1,2,"frasco"),"gn_makebomb"),Rn(gV("Salpicadura ácida","acid_terror",.4,1.5,3),"bo_acidified_zone_ground"),Rn(dm("Frasco rápido","acid_terror",.06,3),"mh_absolute_zephyr")],final:se.chain("acid_terror.a","acid_terror","Reacción en cadena","mh_angriffs_modus")
  }, {
    name:"Ácido concentrado",desc:"Acid Terror pega más, corroe y quema, hasta una bomba ácida.",steps:[Rn(lm("Ácido concentrado","acid_terror",.08,3),"cr_aciddemonstration"),Rn(SM("Corrosión","acid_terror",a=>( {
      mark:.04*a
    }),a=>`Acid Terror corroe un ${4*Math.max(1,a)}% más.`,3),"bo_acidified_zone_water"),Y.weaken("Quemadura química","acid_terror","mh_blast_forge",2)],final:Rn(eg("Bomba ácida","acid_terror", {
      dmg:.35,count:1
    }),"gn_spore_explosion")
  }, {
    name:"Charco ardiente",desc:"Demonstration más grande, más duradera y pegajosa, hasta no apagarse.",steps:[Rn(fV("Charco ardiente","demonstration",.1,3),"bo_dust_explosion"),cm("Combustión lenta","gn_demonic_fire","demonstration", {
      duration:.2
    },a=>`Demonstration arde un ${20*a}% más.`,3),Y.slow("Brea","demonstration","mh_blazing_and_furious",2)],final:se.long("demonstration.a","demonstration","Fuego eterno","mh_blazing_lava")
  }, {
    name:"Fuego químico",desc:"Demonstration pega más, más a menudo y con críticos, hasta lanzarla con tus golpes.",steps:[Rn(lm("Fuego químico","demonstration",.08,3),"bo_acidified_zone_fire"),Rn(dm("Botella rápida","demonstration",.06,3),"mh_brushup_claw"),Y.crit("Llamarada química","demonstration","mh_cbc",2)],final:se.auto("demonstration.b","demonstration","Botella refleja","mh_classy_flutter")
  }
  ],passives:[en("Laboratorio","gn_mix_cooking",tt(.02),5),en("Guantes de goma","cr_slimpitcher",ct(.01),5),en("Fórmula","cr_synthesispotion",zt(.08),5),en("Alchemy","cr_alchemy",Ee(.01),5),en("Explosivos","bo_explosive_powder",Ut(.02),5),en("Mezcla volátil","bo_mystery_powder",za(.02),5),en("Bata","mh_eqc",Ge(6),5)]
},At),Ht(um, {
  name:"Bioética",icon:"am_bioethics",desc:"Call Homunculus y Summon Flora: criaturas que pelean a tu lado.",skills:["call_homunculus","summon_flora"],paths:[ {
    name:"Lazo duradero",desc:"Tu homúnculo dura más, ataca más rápido y tienes otro, hasta no separarse de ti.",steps:[cm("Lazo duradero","am_rest","call_homunculus", {
      duration:.15
    },a=>`Call Homunculus dura un ${15*a}% más.`,3),Le("Instrucción","am_drillmaster","homunHaste",.1,a=>`Tu homúnculo ataca un ${nt(a)} más deprisa`,3),Rn(Z0("Segundo homúnculo","call_homunculus",1,1,"homúnculo"),"am_resurrecthomun")],final:se.long("call_homunculus.a","call_homunculus","Lazo eterno","mh_eraser_cutter")
  }, {
    name:"Homúnculo feroz",desc:"Tu homúnculo pega más, desgarra y aturde, hasta evolucionar.",steps:[Rn(lm("Homúnculo feroz","call_homunculus",.08,3),"am_healhomun"),Y.bleed("Garras del homúnculo","call_homunculus","mh_glanzen_spies",3),Y.stun("Embestida del homúnculo","call_homunculus","mh_goldene_ferse",.06,2)],final:se.heavy("call_homunculus.b","call_homunculus","Homúnculo S","mh_goldene_tone")
  }, {
    name:"Huerto",desc:"Más plantas, que enredan y duran más, hasta un jardín carnívoro.",steps:[Rn(Z0("Huerto","summon_flora",1,2,"planta"),"bo_wooden_fairy"),Rn(SM("Enredaderas","summon_flora",a=>( {
      slow:.5*a
    }),a=>`Summon Flora ralentiza ${ss(.5*Math.max(1,a))} s a los que muerde.`,3),"gn_thorns_trap"),cm("Raíces largas","mh_granitic_armor","summon_flora", {
      duration:.15
    },a=>`Summon Flora dura un ${15*a}% más.`,3)],final:Rn(eg("Jardín carnívoro","summon_flora", {
      dmg:.3,duration:.3
    }),"bo_helltree")
  }, {
    name:"Raíces voraces",desc:"Tus plantas pegan más, debilitan y marcan, y te curan con lo que muerden.",steps:[Rn(lm("Raíces voraces","summon_flora",.08,3),"gn_mandragora"),Y.weaken("Polen","summon_flora","mh_heilige_pferd",3),Y.mark("Savia ácida","summon_flora","mh_heilige_stange",2)],final:se.leech("summon_flora.b","summon_flora","Raíces vitales","mh_lava_slide")
  }
  ],passives:[en("Biotechnology","am_biotechnology",Ge(6),5),en("Creación","am_createcreature",ma(.15),5),en("Vínculo","bo_bionics_m",ls(.03),5),en("Cultivation","am_cultivation",Ld(.3),5),en("Investigación","bo_researchreport",Ls(.02),5),en("Raíces firmes","bo_woodenwarrior",lt(.4),5),en("Genética","mh_licht_gehorn",tt(.02),5)]
},At),Ht(um, {
  name:"Farmacia",icon:"am_potionpitcher",desc:"Potion Pitcher y Chemical Protection: pociones y protecciones para no caer.",skills:["potion_pitcher","chemical_protection"],paths:[ {
    name:"Poción concentrada",desc:"Potion Pitcher cura más, más a menudo y durante más tiempo, hasta un botiquín sin fondo.",steps:[Le("Poción concentrada","am_learningpotion","pitcherHeal",.02,a=>`Potion Pitcher cura un ${nt(a)} más de tu vida máxima`,3),Rn(dm("Pulso firme","potion_pitcher",.08,3),"am_berserkpitcher"),Le("Efecto prolongado","cr_cultivation","pitcherRegen",.005,a=>`Tras Potion Pitcher te curas un ${nt(a)} de tu vida por segundo durante 5 s`,2)],final:se.quick("potion_pitcher.a","potion_pitcher","Botiquín","mh_light_of_regene")
  }, {
    name:"Frasco que estalla",desc:"Potion Pitcher salpica a los enemigos y te da daño y velocidad, hasta una poción de berserk.",steps:[Le("Frasco que estalla","gn_crazyweed","pitcherBurst",20,a=>`Potion Pitcher salpica: ${Math.round(a)} de daño (crece con el ATK) a los enemigos cercanos`,3),Y.castBuff("Poción de furia","potion_pitcher","mh_midnight_frenzy","damage",.03,6,3),Y.castBuff("Poción de agilidad","potion_pitcher","mh_needle_of_paralyze","speed",.04,6,2)],final:se.empower("potion_pitcher.b","potion_pitcher","Poción de berserk","mh_needle_stinger","crit",.1,6)
  }, {
    name:"Capa gruesa",desc:"Chemical Protection dura más, protege más y se renueva antes, hasta cubrirte entero.",steps:[cm("Capa gruesa","am_cp_helm","chemical_protection", {
      duration:.15
    },a=>`Chemical Protection dura un ${15*a}% más.`,3),Le("Capa reforzada","am_cp_shield","cpPower",.03,a=>`Chemical Protection quita un ${nt(a)} más de daño`,3),Rn(dm("Capa rápida","chemical_protection",.06,2),"mh_overed_boost")],final: {
      ...Rn(eg("Full Chemical Protection","chemical_protection", {
        duration:.5
      }),"cr_fullprotection"),stat:a=>a.ext.cpPower=(a.ext.cpPower??0)+.08,desc:()=>"Chemical Protection dura un 50% más y quita un 8% más de daño."
    }
  }, {
    name:"Capa espinosa",desc:"Chemical Protection hiere al que te golpea y te da daño y velocidad, hasta no quitártela.",steps:[Le("Capa espinosa","am_cp_weapon","cpThorns",15,a=>`Con Chemical Protection, el que te golpea recibe ${Math.round(a)} de daño (crece con el ATK)`,3),Y.castBuff("Capa ofensiva","chemical_protection","mh_p89_ad","damage",.03,8,3),Y.castBuff("Capa ligera","chemical_protection","mh_p89_os","speed",.04,8,2)],final:se.quick("chemical_protection.b","chemical_protection","Protección constante","mh_pain_killer")
  }
  ],passives:[en("Pharmacy","gn_s_pharmacy",Dd(.1),5),en("Tolerancia","gn_illusiondoping",Ge(6),5),en("Elixir","gn_blood_sucker",gt(.015),5),en("Destilado","gn_changematerial",tt(.02),5),en("Resistencia","am_twilight1",ut(.01),5),en("Twilight Alchemy","am_twilight2",Io(.03),5),en("Antídoto universal","mh_poison_mist",ct(.01),5)]
},At)]);
const {
  trees:yV,sd:Vl,sc:Wl,sn:vV,sa:wc,sh:CM,st:vn,sm:TM,capMod:tg,ic:qa
}
=ua,hm="star_gladiator";
ke("warmth_sun","Warmth of the Sun","sg_sun_warm", {
  cd:16,type:"zone",tags:["aura","area","persistent","melee","physical","fire"]
},a=>a===1?"El calor del sol te rodea 8 s: quema y aparta a los enemigos que se te acercan.":"+15% daño y +8% área.",a=>new pt(a,I(16),(e,t,n)=> {
  if(!e.nearestEnemy(300))return!1;const s=n.mod(e),o=e.player,r=95*e.stats.areaMult*(1+s.area),i=8*(1+s.duration);ce.play("ef_firewall",.4),o.cast(),e.addFx(xa(vs(o.x,o.y),o));for(let l=1;l*.5<=i;l++)e.schedule(l*.5,()=> {
    if(!o.dead) {
      l%2&&ea(e,o,r,16756800,300);for(const d of e.enemiesInRadius(o.x,o.y,r))e.damageEnemy(d,Tn(e,n,9),Un(e,n, {
        knock:70,fromX:o.x,fromY:o.y,...Ft.FIREHIT
      }))
    }
  });return!0
},["dmg","cd","area","duration"]));
ke("solar_burst","Solar Burst","sj_solarburst", {
  cd:9,type:"aoe",tags:["melee","area","physical","fire"]
},a=>a===1?"Una llamarada solar en abanico delante de ti: mucho daño de fuego a todos los enemigos que alcanza.":"+20% daño y +8% área.",a=>new dn(a, {
  cd:I(9),dmg:ee(50,.2),range:ee(170,.08),sound:"ef_firehit",hit:()=>( {
    knock:110,...Ft.FIREHIT
  }),cone: {
    pct:1,angle:100,fx:(e,t,n,s,o,r)=>hu(e,t,n,s,o,r,16752704)
  }
}));
ke("full_moon_kick","Full Moon Kick","sj_fullmoonkick", {
  cd:9,type:"aoe",tags:["aura","area","melee","physical","neutral"]
},a=>a===1?"Patada giratoria como una luna llena: daña y aparta a todos los enemigos de tu alrededor.":"+20% daño y +8% área.",a=>new xn(a, {
  halo:14213375,cd:I(9),dmg:ee(42,.2),radius:ee(140,.08),sound:"hit_fist4",hit:()=>( {
    knock:160,...Ft.FIST
  }),fx:(e,t,n,s)=>Vn(t,n,$t("tex_pok3"),12,14213375,700,64,s/300)
}));
ke("new_moon_kick","New Moon Kick","sj_newmoonkick", {
  cd:8,type:"single",tags:["melee","single","physical","neutral"]
},()=>"Saltas sobre el enemigo más fuerte a tu alcance y caes con una patada brutal; un instante después de caer eres inmune al daño.",a=>new pt(a,I(8),(e,t,n)=> {
  const s=e.player,o=e.enemiesInRadius(s.x,s.y,320).filter(d=>!d.dead).sort((d,c)=>+!!c.def.boss-+!!d.def.boss||c.hp-d.hp)[0];if(!o)return!1;const r=Qt(o.x-s.x,o.y-s.y)||1;let[i,l]=[o.x-(o.x-s.x)/r*28,o.y-(o.y-s.y)/r*28];return e.walk&&([i,l]=e.walk.nearestWalkable(i,l)),[s.x,s.y]=[i,l],Gn(e,o.x,o.y),s.attack(),ce.play("hit_fist4",.6),e.addFx(vs(o.x,o.y)),e.addBuff("immune",1,.5,n.id),e.damageEnemy(o,Tn(e,n,58),Un(e,n, {
    knock:200,fromX:i,fromY:l,...Ft.FIST
  })),!0
},["dmg","cd"]));
ke("falling_star","Falling Star","sj_fallingstar", {
  cd:8,type:"multi",tags:["melee","multi","physical","neutral"]
},a=>a===1?"Cuatro estrellas caen sobre enemigos al azar y revientan alrededor.":"+1 estrella y +15% daño.",a=>new Aa(a, {
  cd:I(8),dmg:ee(24,.15),count:e=>4+Math.floor(e/2),target:"random",range:480,delay:.4,splash:I(45),sound:"meteor",hit:()=>( {
    knock:60,...Ft.LENS
  }),fx:(e,t,n)=>su(t,n,[$t("tex_pok3")],400,.9)
}));
ke("union","Union of the Sun, Moon and Stars","sg_fusion", {
  cd:40,type:"buff",tags:["buff"]
},()=>"Durante 15 s: +20% de daño, +20 de Celeridad y +15% de velocidad. Cuesta un 10% de tu vida actual.",a=>new pt(a,I(40),(e,t,n)=> {
  if(!e.nearestEnemy(400))return!1;const s=e.player,o=15*n.dur(e);return ce.play("ef_angelus",.5),s.cast(),e.addFx(xa(kt("str_angelus",s.x,s.y,1,0),s)),e.hp=Math.max(1,e.hp*.9),e.addBuff("damage",.2+oe(e,"unionPower"),o,n.id),e.addBuff("haste",20,o,n.id),e.addBuff("speed",.15,o,n.id),!0
}));
yV(hm,[Ht(hm, {
  name:"Sol",icon:"sj_sunstance",desc:"Warmth of the Sun y Solar Burst: el sol que quema a la horda.",skills:["warmth_sun","solar_burst"],paths:[ {
    name:"Halo solar",desc:"Warmth of the Sun más grande, que dura más y vuelve antes, hasta no ponerse nunca.",steps:[qa(wc("Halo solar","warmth_sun",.1,3),"ske_sky_sun"),TM("Día largo","sj_lightofsun","warmth_sun", {
      duration:.15
    },a=>`Warmth of the Sun dura un ${15*a}% más.`,3),qa(Wl("Amanecer","warmth_sun",.06,2),"mh_the_one_fighter_rises")],final:se.long("warmth_sun.a","warmth_sun","Sol eterno","mh_tinder_breaker")
  }, {
    name:"Sol ardiente",desc:"Warmth of the Sun quema más, deja ardiendo y deslumbra, hasta una corona de fuego.",steps:[qa(Vl("Sol ardiente","warmth_sun",.08,3),"ske_rising_sun"),qa(CM("Quemadura","warmth_sun",a=>( {
      poison:3*a
    }),a=>`Warmth of the Sun deja ardiendo: +${3*Math.max(1,a)} de daño por segundo durante 3 s.`,3),"ske_noon_blast"),Y.blind("Destello","warmth_sun","mh_toxin_of_mandara",2)],final:se.heavy("warmth_sun.b","warmth_sun","Corona solar","mh_twister_cutter")
  }, {
    name:"Abanico solar",desc:"Solar Burst cubre más, sale más a menudo y deslumbra, hasta salir con tus golpes.",steps:[qa(wc("Abanico solar","solar_burst",.1,3),"ske_enchanting_sky"),qa(Wl("Ráfaga solar","solar_burst",.06,3),"mh_volcanic_ash"),Y.stun("Deslumbrar","solar_burst","ske_all_in_the_sky",.08,2)],final:se.auto("solar_burst.a","solar_burst","Sol reflejo","mh_xeno_slasher")
  }, {
    name:"Sol del mediodía",desc:"Solar Burst pega más, con críticos y marcando, hasta un sol abrasador.",steps:[qa(Vl("Sol del mediodía","solar_burst",.08,3),"sj_purify"),Y.crit("Mediodía","solar_burst","bo_acidified_zone_wind",3),Y.mark("Marca del sol","solar_burst","bo_advance_protection",2)],final:qa(tg("Sol abrasador","solar_burst", {
      dmg:.35,area:.2
    }),"sj_staremperor")
  }
  ],passives:[vn("Bendición del sol","sg_sun_bless",X(.02),5),vn("Piel solar","ske_dawn_break",ct(.01),5),vn("Calor","ske_sunset_blast",ma(.15),5),vn("Postura solar","sj_prominencekick",Ee(.01),5),vn("Llamarada","sj_novaexplosing",zt(.08),5),vn("Cénit","ske_sky_mastery",ls(.03),5),vn("Fuego interior","bo_bionic_pharmacy",Ge(6),5)]
},At),Ht(hm, {
  name:"Luna",icon:"sj_lunarstance",desc:"Full Moon Kick y New Moon Kick: patadas que barren y que caen del cielo.",skills:["full_moon_kick","new_moon_kick"],paths:[ {
    name:"Órbita lunar",desc:"Full Moon Kick barre más, más a menudo y desmoraliza, hasta saltar de uno a otro.",steps:[qa(wc("Órbita lunar","full_moon_kick",.1,3),"ske_sky_moon"),qa(Wl("Fases rápidas","full_moon_kick",.08,3),"sj_lightofmoon"),qa(CM("Eclipse","full_moon_kick",a=>( {
      weaken:.06*a,weakenTime:3
    }),a=>`Full Moon Kick desmoraliza: los enemigos hacen un ${6*Math.max(1,a)}% menos de daño durante 3 s.`,2),"sj_flashkick")],final:se.chain("full_moon_kick.a","full_moon_kick","Luna en cadena","bo_creeper")
  }, {
    name:"Luna llena",desc:"Full Moon Kick pega más, aturde y con críticos, hasta la luna nueva.",steps:[qa(Vl("Luna llena","full_moon_kick",.08,3),"ske_rising_moon"),Y.stun("Golpe de luna","full_moon_kick","bo_mayhemic_thorns",.06,3),Y.crit("Luz de luna","full_moon_kick","bo_the_whole_protection",2)],final:qa(tg("Luna nueva","full_moon_kick", {
      dmg:.3,count:1
    }),"soa_soul_of_heaven_and_earth")
  }, {
    name:"Luna creciente",desc:"New Moon Kick sale más a menudo, aturde y frena, y si mata vuelve a estar lista.",steps:[qa(Wl("Luna creciente","new_moon_kick",.08,3),"soa_talisman_of_red_phoenix"),Y.stun("Impacto lunar","new_moon_kick","soa_talisman_of_four_bearing_god",.1,3),Y.slow("Gravedad lunar","new_moon_kick","star_armor_of_pow",2)],final:se.refresh("new_moon_kick.a","new_moon_kick","Caída sin fin","star_armor_of_sta")
  }, {
    name:"Caída lunar",desc:"New Moon Kick pega más, marca y cubre más, hasta caer como una luna negra.",steps:[qa(Vl("Caída lunar","new_moon_kick",.08,3),"soa_talisman_of_blue_dragon"),Y.mark("Cráter lunar","new_moon_kick","star_cluster_of_con",3),qa(wc("Onda lunar","new_moon_kick",.1,2),"star_cluster_of_crt")],final:se.heavy("new_moon_kick.b","new_moon_kick","Luna negra","star_cluster_of_int")
  }
  ],passives:[vn("Bendición de la luna","sg_moon_bless",ut(.01),5),vn("Paso lunar","ske_midnight_kick",gt(.015),5),qa(Vl("Patada de luna",sa,.05,5),"ske_rsing_moon"),vn("Marea","soa_talisman_of_black_tortoise",Ge(6),5),vn("Noche cerrada","soa_talisman_of_white_tiger",tt(.02),5),vn("Guardia lunar","soa_talisman_of_protection",lt(.4),5),vn("Luz nocturna","star_cluster_of_luk",zt(.08),5)]
},At),Ht(hm, {
  name:"Estrellas",icon:"sj_starstance",desc:"Falling Star y Union: estrellas que caen y el poder de los tres astros.",skills:["falling_star","union"],paths:[ {
    name:"Más estrellas",desc:"Más estrellas, en más área y más a menudo, hasta que cae el cielo.",steps:[qa(vV("Más estrellas","falling_star",1,2,"estrella"),"ske_twinkling_galaxy"),qa(wc("Cráter estelar","falling_star",.1,3),"ske_star_cannon"),qa(Wl("Estrella fugaz","falling_star",.08,3),"ske_star_light_kick")],final:qa(tg("Cielo que cae","falling_star", {
      count:2,dmg:.25
    }),"soa_talisman_mastery")
  }, {
    name:"Estrellas pesadas",desc:"Falling Star pega más, aturde y brilla, hasta una supernova.",steps:[qa(Vl("Estrellas pesadas","falling_star",.08,3),"ske_star_burst"),Y.stun("Impacto estelar","falling_star","star_cluster_of_pow",.06,3),Y.crit("Brillo","falling_star","star_cluster_of_res",2)],final:se.heavy("falling_star.b","falling_star","Supernova","star_cluster_of_spl")
  }, {
    name:"Unión larga",desc:"Union dura más, se alinea antes y da más daño, hasta no romperse nunca.",steps:[TM("Unión larga","soa_totem_of_tutelary","union", {
      duration:.15
    },a=>`Union dura un ${15*a}% más.`,3),qa(Wl("Alineación","union",.06,3),"soa_exorcism_of_malicious_soul"),Le("Tres astros","soa_talisman_of_five_elements","unionPower",.04,a=>`Union da un ${nt(a)} más de daño`,2)],final:se.long("union.a","union","Unión eterna","star_cluster_of_sta")
  }, {
    name:"Conjunción",desc:"Lanzar Union te da crítico, velocidad y daño, y lo lanzas sin parar.",steps:[Y.castBuff("Conjunción","union","star_cluster_of_str","crit",.02,8,3),Y.castBuff("Paso celeste","union","star_cluster_of_wis","speed",.04,8,3),Y.castBuff("Fuerza astral","union","star_effect_j","damage",.03,8,2)],final:se.quick("union.b","union","Unión constante","star_force_ring_lt")
  }
  ],passives:[vn("Bendición de las estrellas","sj_universestance",za(.02),5),vn("Polvo de estrellas","sj_lightofstar",zt(.08),5),vn("Constelación","soa_circle_of_directions_and_elementals",Ut(.02),5),vn("Knowledge of the Stars","soa_soul_mastery",Io(.03),5),vn("Cuerpo celeste","soa_soul_gathering",Ls(.02),5),vn("Cometa","soa_talisman_of_magician",gt(.015),5),vn("Gravedad estelar","star_force_ring_tw",ct(.01),5)]
},At)]);
const {
  trees:_V,sd:ag,sc:$l,sn:PM,sa:bV,sh:ng,st:tn,sm:xV,capMod:wV,capStat:MV,ic:Jn
}
=ua,mm="soul_linker",jp=(a,e,t=13150463)=>Vn(a,e,$t("tex_pok3"),8,t,700,64,.4);
ke("esma","Esma","sl_sma", {
  cd:5,type:"multi",tags:["ranged_strike","multi","burst","magic","ghost"],cast:["single","ghost"]
},a=>a===1?"Rayos de espíritu sobre el enemigo más cercano. Cada nivel añade un rayo más.":a%2===1?"+1 rayo.":"+25% daño.",a=>new Aa(a, {
  cd:I(5),dmg:e=>18*(1+.25*Math.floor(e/2)),count:I(1),target:"nearest",range:420,delay:.25,burst:e=>e,burstGap:.12,sound:"ef_soulstrike",hit:()=>Ft.LENS,fx:(e,t,n)=>jp(t,n)
}));
ke("estin","Estin","sl_stin", {
  cd:6,type:"aoe",tags:["ranged_strike","area","magic","wind"],cast:["single","wind"]
},a=>a===1?"Ráfaga de viento espiritual sobre el enemigo más cercano: daña y aparta a los que tiene alrededor.":"+20% daño y +8% área.",a=>new Aa(a, {
  cd:I(6),dmg:ee(26,.2),count:I(1),target:"nearest",range:380,splash:ee(75,.08),splashPct:1,sound:"ef_thunderstorm",hit:()=>( {
    knock:260,...Ft.WINDHIT
  }),fx:(e,t,n)=>kt("str_windhit1",t,n,.9,0)
}));
ke("estun","Estun","sl_stun", {
  cd:6,type:"single",tags:["ranged_strike","single","magic","neutral"],cast:["single","neutral"],effects:[ {
    key:"stun",label:"Aturdimiento",base:1.4,step:.2,fmt:"s"
  }
  ]
},a=>a===1?"Golpe de espíritu al enemigo más fuerte a la vista: lo aturde.":"+20% daño.",a=>new Aa(a, {
  cd:I(6),dmg:ee(28,.2),count:I(1),target:"strongest",sound:"ef_soulstrike",hit:(e,t)=>( {
    stun:t.eff("stun"),stunChance:1,...Ft.LENS
  }),fx:(e,t,n)=>jp(t,n,16769184)
}));
ke("kaizel","Kaizel","sl_kaizel", {
  cd:60,type:"buff",tags:["buff"]
},()=>"Durante 30 s, si un golpe fuese a matarte, te levantas con la mitad de la vida (una vez).",a=>new pt(a,I(60),(e,t,n)=> {
  if(!e.nearestEnemy(400))return!1;const s=e.player;return ce.play("ef_angelus",.4),s.cast(),e.addFx(xa(kt("str_angelus",s.x,s.y,.8,0),s)),e.addBuff("kaizel",1,30*n.dur(e),n.id),!0
}));
ke("kaahi","Kaahi","sl_kaahi", {
  cd:24,type:"buff",tags:["buff"]
},()=>"Durante 15 s, cada golpe que recibes te cura un 2% de tu vida máxima.",a=>new pt(a,I(24),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,300).length)return!1;const s=e.player;return ce.play("heal",.4),s.cast(),e.addFx(xa(vs(s.x,s.y),s)),e.addBuff("kaahi",1,15*n.dur(e),n.id),e.ext.kaahiUntil=e.time+15*n.dur(e),!0
}));
ke("kaupe","Kaupe","sl_kaupe", {
  cd:20,type:"buff",tags:["buff"]
},()=>"Un espíritu te aparta de los 3 próximos golpes que recibas (no te hacen nada).",a=>new pt(a,I(20),(e,t,n)=> {
  if(!e.enemiesInRadius(e.player.x,e.player.y,220).length)return!1;const s=e.player;return ce.play("ef_hiding",.4),s.cast(),e.addFx(xa(jp(s.x,s.y,11067647),s)),e.addChargeBuff("kaupe",3+oe(e,"kaupeCharges"),n.id),!0
}));
Ct.hurt.push((a,e,t)=> {
  const n=a.player;if(a.buffValue("kaupe")>0&&a.spendBuff("kaupe")) {
    a.addFx(jp(n.x,n.y-30,11067647));const s=oe(a,"kaupeCounter");return s&&t&&!t.dead&&a.damageEnemy(t,s*a.stats.powerMagic, {
      src:"kaupe",part:"Contraataque",knock:160,fromX:n.x,fromY:n.y,...Ft.LENS
    }),0
  }
  if(a.buffValue("kaahi")>0) {
    a.healPlayer(a.stats.maxHp*(.02+oe(a,"kaahiHeal")));const s=oe(a,"kaahiThorn");s&&t&&!t.dead&&a.damageEnemy(t,s*a.stats.powerMagic, {
      src:"kaahi",part:"Espinas",numColor:13150463
    })
  }
  return e>=a.hp&&a.buffValue("kaizel")>0?(a.addBuff("kaizel",0,0),a.hp=a.stats.maxHp*(.5+oe(a,"kaizelHeal")),ea(a,n,140,16773808,600),a.addFx(kt("str_angelus",n.x,n.y,1,0)),ce.play("ef_angelus",.6),0):e
});
Ct.damageMult.push(a=>oe(a,"kaFull")&&a.buffValue("kaahi")>0&&a.buffValue("kaupe")>0?1.1:1);
_V(mm,[Ht(mm, {
  name:"Conjuro",icon:"sl_sma",desc:"Esma y Estin: el espíritu como arma.",skills:["esma","estin"],paths:[ {
    name:"Esma doble",desc:"Esma alcanza a más, fluye más rápido y marca, hasta salir con tus golpes.",steps:[Jn(PM("Esma doble","esma",1,2,"objetivo"),"sl_high"),Jn($l("Conjuro fluido","esma",.08,3),"soa_talisman_of_warrior"),Jn(ng("Alma marcada","esma",a=>( {
      mark:.04*a,markTime:4
    }),a=>`Los enemigos que alcanza Esma reciben un +${4*Math.max(1,a)}% de daño durante 4 s.`,3),"sp_soulfalcon")],final:se.auto("esma.a","esma","Esma refleja","su_bite")
  }, {
    name:"Esma potenciada",desc:"Esma pega más, con críticos y aturdiendo, hasta la Esma definitiva.",steps:[Jn(ag("Esma potenciada","esma",.08,3),"sl_ske"),Y.crit("Alma afilada","esma","su_bunchofshrimp",3),Y.stun("Golpe espiritual","esma","su_chattering",.06,2)],final:Jn(wV("Esma definitiva","esma", {
      dmg:.35,count:1
    }),"sp_cor_core")
  }, {
    name:"Espiral de viento",desc:"Estin cubre más, frena y sale más a menudo, y deja un remolino.",steps:[Jn(bV("Espiral de viento","estin",.1,3),"sp_curseexplosion"),Jn(ng("Viento pesado","estin",a=>( {
      slow:.6*a
    }),a=>`Estin ralentiza ${String(.6*Math.max(1,a)).replace(".",",")} s.`,3),"sp_amethyst_fragment"),Jn($l("Viento rápido","estin",.06,2),"su_cn_meteor")],final:se.field("estin.a","estin","Remolino del alma","su_cn_powdering")
  }, {
    name:"Viento cortante",desc:"Estin pega más, corta y hiela, y salta de enemigo en enemigo.",steps:[Jn(ag("Viento cortante","estin",.08,3),"sp_swhoo"),Y.bleed("Corte del viento","estin","su_freshshrimp",3),Y.weaken("Viento helador","estin","su_grooming",2)],final:se.chain("estin.b","estin","Viento en cadena","su_lunaticcarrotbeat")
  }
  ],passives:[tn("Alma enfocada","sl_ska",Ys(.03),5),tn("Mente clara","sp_soulfairy",tt(.02),5),tn("Resonancia","sp_soulgolem",zt(.08),5),tn("Vínculo","sp_kaute",X(.02),5),tn("Canalizar","sp_sha",Ee(.01),5),tn("Eco del alma","soa_talisman_of_soul_stealing",za(.02),5),tn("Alma serena","su_meowmeow",Ge(6),5)]
},At),Ht(mm, {
  name:"Espíritus",icon:"sl_soullinker",desc:"Estun, Kaizel y el espíritu de cada job: un poco de todos.",skills:["estun","kaizel"],paths:[ {
    name:"Estun prolongado",desc:"Estun aturde más, a más enemigos y más a menudo, hasta paralizar el alma.",steps:[Jn(ng("Estun prolongado","estun",a=>( {
      stun:.3*a
    }),a=>`Estun aturde ${String(.3*Math.max(1,a)).replace(".",",")} s más.`,3),"sl_supernovice"),Jn(PM("Spirit of the Star","estun",1,2,"objetivo"),"sl_star"),Jn($l("Estun rápido","estun",.06,3),"su_nyanggrass")],final:se.control("estun.a","estun","Parálisis del alma","su_pickypeck","stun",2)
  }, {
    name:"Spirit of the Priest",desc:"Estun pega más, deja vulnerable y con críticos, hasta un golpe de los espíritus.",steps:[Jn(ag("Spirit of the Priest","estun",.08,3),"sl_priest"),Y.mark("Alma vulnerable","estun","su_powerofflock",3),Y.crit("Golpe del alma","estun","su_powerofland",2)],final:se.heavy("estun.b","estun","Golpe de los espíritus","su_poweroflife")
  }, {
    name:"Spirit of the Sage",desc:"Kaizel te levanta con más vida, se recarga antes y te acelera, hasta estar siempre listo.",steps:[Le("Spirit of the Sage","sl_sage","kaizelHeal",.1,a=>`Kaizel te levanta con un ${nt(a)} más de vida`,3),Jn($l("Spirit of the Alchemist","kaizel",.06,3),"sl_alchemist"),Y.castBuff("Espíritu protector","kaizel","su_powerofsea","speed",.04,6,2)],final:se.quick("kaizel.a","kaizel","Kaizel constante","su_purring")
  }, {
    name:"Spirit of the Soul Linker",desc:"Lanzar Kaizel te da daño y crítico, hasta tener el espíritu del propio Soul Linker.",steps:[Y.castBuff("Espíritu guerrero","kaizel","su_scaroftarou","damage",.03,8,3),Y.castBuff("Espíritu cazador","kaizel","su_shrimparty","crit",.02,8,3),Y.castBuff("Espíritu veloz","kaizel","su_soulattack","speed",.03,8,2)],final:MV("Spirit of the Soul Linker","sl_rogue",[X(.05),Ge(20),tt(.05)])
  }
  ],passives:[tn("Spirit of the Knight","sl_knight",lt(.4),5),tn("Spirit of the Wizard","sl_wizard",Ut(.02),5),tn("Spirit of the Hunter","sl_hunter",rn(.04),5),tn("Spirit of the Monk","sl_monk",Ee(.01),5),tn("Spirit of the Crusader","sl_crusader",Ge(8),5),tn("Spirit of the Assassin","sl_assasin",zt(.08),5),tn("Spirit of the Blacksmith","sl_blacksmith",X(.02),5)]
},At),Ht(mm, {
  name:"Ka",icon:"sl_kaahi",desc:"Kaahi y Kaupe: curarte con cada golpe y esquivar los que importan.",skills:["kaahi","kaupe"],paths:[ {
    name:"Kaahi profundo",desc:"Kaahi cura más, dura más y se renueva antes, hasta no apagarse.",steps:[Le("Kaahi profundo","soa_charm","kaahiHeal",.005,a=>`Kaahi te cura un ${nt(a)} más de tu vida con cada golpe`,3),xV("Kaahi largo","soa_charm_bundle","kaahi", {
      duration:.15
    },a=>`Kaahi dura un ${15*a}% más.`,3),Jn($l("Espíritu atento","kaahi",.08,2),"sp_soulrevolve")],final:se.long("kaahi.a","kaahi","Kaahi eterno","su_spiritofland")
  }, {
    name:"Espinas del alma",desc:"Con Kaahi el que te golpea sufre, y lanzarlo te da daño y velocidad; con Kaupe, más daño.",steps:[Le("Espinas del alma","sp_souldivision","kaahiThorn",12,a=>`Con Kaahi activo, el que te golpea recibe ${Math.round(a)} de daño (crece con el MATK)`,3),Y.castBuff("Alma hiriente","kaahi","su_spiritoflife","damage",.03,8,3),Y.castBuff("Alma ligera","kaahi","su_spiritofsea","speed",.04,8,2)],final:Le("Ka completo","sp_soulenergy","kaFull",1,()=>"Con Kaahi activo y cargas de Kaupe haces +10% de daño",1)
  }, {
    name:"Kaupe triple",desc:"Kaupe esquiva más golpes, se recarga antes y te acelera, hasta estar siempre listo.",steps:[Le("Kaupe triple","sp_soulreaper","kaupeCharges",1,a=>`Kaupe esquiva ${Math.round(a)} golpe${a>1?"s":""} más`,3),Jn($l("Espíritu ágil","kaupe",.08,3),"sp_soulcurse"),Y.castBuff("Esquiva veloz","kaupe","su_spritemable","speed",.04,6,2)],final:se.quick("kaupe.a","kaupe","Kaupe constante","su_sv_roottwist")
  }, {
    name:"Contraataque del alma",desc:"Al esquivar con Kaupe el atacante sufre, y lanzarlo te da crítico, daño y velocidad.",steps:[Le("Contraataque del alma","sp_soulunity","kaupeCounter",20,a=>`Cuando Kaupe esquiva un golpe, el atacante recibe ${Math.round(a)} de daño (crece con el MATK)`,3),Y.castBuff("Alma certera","kaupe","su_sv_stemspear","crit",.02,6,3),Y.castBuff("Alma vengativa","kaupe","su_svg_spirit","damage",.03,6,2)],final:se.empower("kaupe.b","kaupe","Danza del alma","su_tunabelly","speed",.15,6)
  }
  ],passives:[tn("Kaina","soa_talisman_of_protection",ma(.15),5),tn("Kaite","soa_talisman_of_five_elements",ct(.01),5),tn("Cuerpo Ka","sp_soulcollect",Ls(.02),5),tn("Paso espiritual","sp_soulexplosion",ut(.01),5),tn("Espíritu firme","sp_soulshadow",Ld(.3),5),tn("Armadura Ka","sp_spa",lt(.4),5),tn("Alma vigilante","su_tunaparty",tt(.02),5)]
},At)]);
export {
  $M as $,qt as A,Lo as B,pr as C,Bn as D,_r as E,pm as F,lp as G,Dn as H,pd as I,wp as J,_3 as K,Lm as L,LP as M,Wc as N,As as O,VE as P,Ya as Q,sn as R,av as S,JM as T,Zt as U,mR as V,lu as W,Xl as X,Ac as Y,S_ as Z,fm as _,x2 as a,Ks as a$,dt as a0,et as a1,up as a2,A5 as a3,F5 as a4,o2 as a5,mg as a6,In as a7,Iu as a8,dg as a9,YM as aA,jR as aB,jP as aC,IP as aD,T3 as aE,sT as aF,l5 as aG,c5 as aH,y5 as aI,f5 as aJ,v5 as aK,Jy as aL,Zn as aM,J1 as aN,QM as aO,dT as aP,Fn as aQ,xt as aR,$t as aS,ra as aT,ce as aU,kt as aV,Qt as aW,Do as aX,on as aY,Ze as aZ,rt as a_,ns as aa,MT as ab,ue as ac,PP as ad,cp as ae,K1 as af,gm as ag,ip as ah,Bm as ai,Es as aj,_2 as ak,i5 as al,d5 as am,g5 as an,m5 as ao,lT as ap,_5 as aq,Rs as ar,VM as as,R1 as at,Ra as au,WT as av,L1 as aw,af as ax,F1 as ay,YT as az,f2 as b,$W as b$,LS as b0,BS as b1,Fo as b2,Ie as b3,cs as b4,Rt as b5,Ae as b6,vp as b7,Vo as b8,Jt as b9,BA as bA,Ee as bB,X as bC,Id as bD,Hv as bE,Ge as bF,Mp as bG,tt as bH,ma as bI,ut as bJ,Ov as bK,ct as bL,_u as bM,Ys as bN,Ls as bO,Dd as bP,lt as bQ,vu as bR,gt as bS,qA as bT,l9 as bU,u9 as bV,HW as bW,GW as bX,kW as bY,EW as bZ,qU as b_,Ce as ba,Qi as bb,Jc as bc,oi as bd,pp as be,Nn as bf,ln as bg,Sa as bh,$v as bi,wU as bj,Wt as bk,n9 as bl,s9 as bm,$s as bn,ea as bo,CV as bp,m9 as bq,gs as br,MW as bs,c9 as bt,fW as bu,DA as bv,Ty as bw,yW as bx,Ep as by,hW as bz,gu as c,cH as c$,YW as c0,al as c1,q9 as c2,B9 as c3,UU as c4,sa as c5,bW as c6,WU as c7,gW as c8,JA as c9,ws as cA,Py as cB,R9 as cC,fG as cD,Zm as cE,Ry as cF,t9 as cG,a9 as cH,Ua as cI,tW as cJ,ao as cK,Vv as cL,uo as cM,HH as cN,Sx as cO,U9 as cP,Y9 as cQ,J9 as cR,UV as cS,xU as cT,vW as cU,e$ as cV,Z9 as cW,t$ as cX,Q9 as cY,j9 as cZ,$9 as c_,cW as ca,HA as cb,ZW as cc,dW as cd,Qr as ce,ku as cf,$V as cg,EV as ch,zs as ci,zV as cj,TV as ck,RV as cl,i9 as cm,PV as cn,RW as co,M9 as cp,yk as cq,F9 as cr,HV as cs,LH as ct,nk as cu,WW as cv,VW as cw,LW as cx,ld as cy,Tm as cz,nl as d,A9 as d$,OW as d0,_W as d1,Wi as d2,h9 as d3,d9 as d4,oH as d5,rH as d6,r7 as d7,$U as d8,SH as d9,wu as dA,Vn as dB,Da as dC,o1 as dD,xa as dE,vs as dF,hk as dG,hu as dH,xp as dI,Lp as dJ,HB as dK,e9 as dL,uW as dM,WV as dN,L9 as dO,HE as dP,pG as dQ,z9 as dR,Ct as dS,jV as dT,QW as dU,D9 as dV,Dm as dW,Qm as dX,Pw as dY,EH as dZ,N9 as d_,aW as da,O9 as db,dH as dc,X9 as dd,K9 as de,tk as df,Km as dg,il as dh,Sy as di,fs as dj,Om as dk,yv as dl,gv as dm,el as dn,tl as dp,pW as dq,Ha as dr,UB as ds,qB as dt,KS as du,aO as dv,NW as dw,Xc as dx,IW as dy,o9 as dz,Tt as e,rk as e$,k9 as e0,ok as e1,I9 as e2,XW as e3,KW as e4,BV as e5,AU as e6,rW as e7,Kq as e8,tO as e9,w9 as eA,T9 as eB,lO as eC,g0 as eD,UO as eE,f9 as eF,p9 as eG,vr as eH,ZV as eI,g9 as eJ,YV as eK,PO as eL,oo as eM,RO as eN,zO as eO,VO as eP,GO as eQ,qv as eR,ol as eS,eW as eT,NO as eU,xW as eV,AH as eW,JW as eX,SW as eY,AW as eZ,ri as e_,Ud as ea,Oq as eb,IV as ec,iW as ed,oW as ee,lW as ef,BW as eg,Mu as eh,P0 as ei,FO as ej,LO as ek,XV as el,DO as em,KV as en,QV as eo,Qv as ep,C9 as eq,o8 as er,r8 as es,E9 as et,l8 as eu,bN as ev,Bw as ew,y9 as ex,JO as ey,v9 as ez,GE as f,fH as f$,JV as f0,b9 as f1,_9 as f2,x9 as f3,P9 as f4,IO as f5,BO as f6,UW as f7,wW as f8,qO as f9,n7 as fA,ZE as fB,l1 as fC,V9 as fD,ek as fE,ZA as fF,e7 as fG,R_ as fH,JE as fI,QE as fJ,W9 as fK,SG as fL,mW as fM,Wr as fN,wH as fO,DW as fP,qV as fQ,xx as fR,lH as fS,iH as fT,Fi as fU,mH as fV,hH as fW,bH as fX,DH as fY,ZU as fZ,s7 as f_,r9 as fa,qN as fb,qW as fc,S9 as fd,Pt as fe,dr as ff,Zx as fg,SE as fh,Lk as fi,FV as fj,NV as fk,LV as fl,zW as fm,jA as fn,m0 as fo,PW as fp,lq as fq,CW as fr,Gv as fs,TW as ft,jW as fu,QA as fv,_x as fw,ep as fx,Eu as fy,KE as fz,va as g,tH as g0,OV as g1,A6 as g2,GV as g3,VV as g4,FW as g5,DV as g6,sW as h,MG as i,nu as j,G9 as k,ba as l,NT as m,la as n,pv as o,nW as p,Pa as q,t7 as r,tS as s,bt as t,_1 as u,cl as v,H9 as w,Fm as x,Zy as y,es as z
};
