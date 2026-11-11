/**
 * ============================================================================
 * RO Life Source Module: 08-equipment-refine-storage.js
 * Description: Hollgrehenn Blacksmith Refine System (`at`/`uk`/`JE`/`QE`), Gearscore (`VE`/`KE`), Storage Sync Proxy (`as`), Pets (`Rt`), Stage Selector (`Se`), Account REST Client (`class Ks`), Achievements (`ts`), and Chronicle Perks (`si`)
 * ============================================================================
 */

const at= {
  phracon:1010,emveretarcon:1011,oridecon:984,elunium:985,enrichedOridecon:7620,enrichedElunium:7619
},xy= {
  [at.phracon]:15,[at.emveretarcon]:40,[at.oridecon]:350,[at.elunium]:250
},UE=[1,2,4,8,16],GE=new Set(["eddga","orc_hero","osiris","baphomet","golden_thief_bug","mastering","vocal","eclipse","angeling","deviling","ghostring","drake","vagabond_wolf","moonlight","skeleton_general","cat_o_nine_tail","hyegun"]);
function VE(a) {
  return!a||a.starter?0:(20+10*a.bonuses.length)*(a.rare?3:1)
}
function KE(a,e) {
  var t;
  return a?Math.round((a*UE[e.quality??0]+15*(((t=e.affixes)==null?void 0:t.length)??0)+10*e.cards.length)*(1+.25*(e.refine??0))):0
}
function WE(a) {
  return a&&GE.has(a)?250:25
}
const ma=10,uk=[100,100,100,100,90,80,60,40,30,20];
function YE(a) {
  return!a||a.starter||a.slot==="acc"||a.slot==="head_mid"||a.slot==="head_low"?null:a.slot==="weapon"?"weapon":"armor"
}
function My(a,e) {
  return e<=4?at.phracon:e<=7?at.emveretarcon:a==="weapon"?at.oridecon:at.elunium
}
function Li(a) {
  return uk[a-1]??0
}
function XE() {
  return uk.lastIndexOf(100)+1
}
const Wp= {
  [at.phracon]:"Refina cualquier pieza de +1 a +4",[at.emveretarcon]:"Refina cualquier pieza de +5 a +7",[at.oridecon]:"Refina armas de +8 a +10",[at.elunium]:"Refina armaduras, escudos, capas, calzado y cascos de +8 a +10",[at.enrichedOridecon]:"El herrero ya no lo usa",[at.enrichedElunium]:"El herrero ya no lo usa"
},JE=[.04,.04,.04,.04,.06,.06,.06,.12,.12,.12],QE= {
  단검:0,너클:.15,채찍:.15,악기:.2,책:.25,롯드:.3,클럽:.3,검:.35,창:.4,도끼:.45,활:.55,권총:.55,라이플:.7,카타르:.75,수리검:.75,샷건:.85,양손검:.9,양손창:.95,양손도끼:1
},ZE=new Set(["롯드","책"]),eT=.4,tT= {
  armor:4,shield:3,head_top:2,garment:2,shoes:2
};
function sT(a) {
  var r,l;
  const e=fe[a.itemId];
  if(!e||e.starter)return {
    atk:0,matk:0,def:0
  };
  const t=PM(Math.min(mg[mg.length-1].tier,mn(a)+(e.secret?1:0)));
  if(e.slot!=="weapon")return {
    atk:0,matk:0,def:(tT[e.slot]??0)*t.mult
  };
  const[s,n]=ko,o=QE[e.wtype??""]??(Ji(e)?.8:.15),i=(s+(n-s)*o)*t.weaponMult*(((r=Re[a.quality??0])==null?void 0:r.baseMult)??1);
  return ZE.has(e.wtype??"")? {
    atk:i*eT,matk:i,def:0
  }
  : {
    atk:i,matk:(l=e.base)!=null&&l.matk?i:0,def:0
  }
}
function wa(a,e=a.refine??0) {
  const t=sT(a),s=yr(e);
  return {
    atk:Math.round(t.atk*s),matk:Math.round(t.matk*s),def:Math.round(t.def*s*10)/10
  }
}
function tl(a) {
  return YE(a)
}
function yr(a) {
  return 1+JE.slice(0,Math.max(0,Math.min(ma,a??0))).reduce((e,t)=>e+t,0)
}
function Oo(a) {
  var t;
  const e=yr(a.refine);
  return[...((t=fe[a.itemId])==null?void 0:t.bonuses)??[],...wh(a.itemId,mn(a)),...Im(a.affixes)].map(s=>AM(s,e))
}
function ss(a) {
  const e=zo(a.itemId,qm(a.affixes));
  return a.refine?`+${a.refine} ${e}`:e
}
function aT(a) {
  const e=a.refine??0;
  if(!tl(fe[a.itemId])||e>=ma)return!1;
  const t=Math.random()*100<Li(e+1);
  return t&&(a.refine=e+1),t
}
const yl="ro-life.",pk="ro-life.dev.",tf=/^(characters\.v1|account\.v1|achievements\.v1|pets\.v1|run\.v1\.[\w-] {
  1,40
}
|stages-seen\.v1\.[\w-] {
  1,40
})$/;
let Lh=!1,Oi=null;
function Mt() {
  return Lh
}
function mk(a) {
  Lh=a
}
function Ah(a) {
  Oi=a===null?null:`${yl}acct.${a}.`
}
const _o=new Map;
let Mo=null;
function xu(a) {
  return Lh||!Oi||!a.startsWith(Oi)?null:a.slice(Oi.length)
}
const as= {
  getItem(a) {
    const e=xu(a);
    return e===null?localStorage.getItem(a):_o.get(e)??null
  },setItem(a,e) {
    const t=xu(a);
    if(t===null)return localStorage.setItem(a,e);
    _o.get(t)!==e&&(_o.set(t,e),Mo==null||Mo())
  },removeItem(a) {
    const e=xu(a);
    if(e===null)return localStorage.removeItem(a);
    _o.delete(e)&&(Mo==null||Mo())
  }
};
function sf() {
  return Object.fromEntries([..._o.entries()].filter(([a])=>tf.test(a)).sort(([a],[e])=>a<e?-1:1))
}
let fk=0;
function gk() {
  return fk
}
function _l(a) {
  _o.clear();
  for(const[e,t]of Object.entries(a))tf.test(e)&&_o.set(e,t);
  fk++,typeof window<"u"&&window.dispatchEvent(new Event("ro-save-replaced"))
}
function nT(a) {
  Mo=a
}
const Mu=a=>`${yl}acct.${a}.`;
function Lt(a) {
  return a.startsWith(yl)?Lh?pk+a.slice(yl.length):Oi?Oi+a.slice(yl.length):a:a
}
function oT() {
  try {
    const a=Object.keys(localStorage).filter(e=>e.startsWith(pk));
    for(const e of a)localStorage.removeItem(e)
  }
  catch{}
}
const af="ro-life.pets.v1",Rt=[];
function rt(a,e,t,s,n) {
  Rt.push( {
    id:a,egg:e,acc:t,bonuses:s,from:n
  })
}
rt("poring",9001,10013,[Rm(3),ur(.01)]);
rt("lunatic",9004,10007,[ur(.02),Bm(.02)]);
rt("drops",9002,10013,[Bm(.04)]);
rt("picky",9005,10012,[Nm(2),Bm(.02)]);
rt("savage_babe",9009,10015,[Om(2),Dm(40)]);
rt("baby_desert_wolf",9010,10003,[pr(2),jM(.02)]);
rt("rocker",9011,10014,[zb(.5),Dm(25)]);
rt("familiar",9138,10031,[pr(3)]);
rt("mastering",9069,void 0,[Rm(4),ur(.02),Hm(.02)],"poring");
rt("whisper",9045,10027,[Hm(.05)]);
rt("spore",9012,10017,[Fm(3)]);
rt("poison_spore",9013,10017,[Nm(2),pr(2)]);
rt("poporing",9003,10013,[Rm(2),Ub(.03)]);
rt("smokie",9015,10019,[_M(2),Hm(.02)]);
rt("dokebi",9019,10005,[pr(2),qM(.03)]);
rt("nine_tail",9095,10040,[ur(.02),Fm(2)]);
rt("willow",9103,10023,[pr(3)]);
rt("angeling",9088,void 0,[IM(.05),RM(.15)],"mastering");
rt("munak",9018,10008,[BM(2),pr(2)]);
rt("bon_gun",9025,10020,[Om(3),Dm(20)]);
rt("sohee",9020,10016,[Nm(2),Fm(2)]);
rt("hyegun",9093,void 0,[Om(4),Ub(.04)],"bon_gun");
rt("cat_o_nine_tail",9096,void 0,[ur(.04),zb(.6)],"nine_tail");
rt("moonlight",9112,void 0,[ur(.04),NM(.6),OM(.03)]);
const Ca=Object.fromEntries(Rt.map(a=>[a.id,a])),yk=Object.fromEntries(Rt.filter(a=>!a.from).map(a=>[a.egg,a.id]));
function $o(a) {
  return a?.001:1e-4
}
const Yp=1e3,vk=250,iT=5,Wo=[ {
  name:"Neutral",min:0,mult:.5
}, {
  name:"Cordial",min:750,mult:.75
}, {
  name:"Leal",min:910,mult:1
}
],nf=Wo[2].min,an=1.5,Ln=200,Xp=Wo[1].min,Di=5;
function bk(a) {
  return[...Wo].reverse().find(e=>a>=e.min)
}
function Ra() {
  try {
    const a=as.getItem(Lt(af)),e=a?JSON.parse(a):null;
    return {
      pets:(e==null?void 0:e.pets)??{}
    }
  }
  catch {
    return {
      pets:{}
    }
  }
}
function of(a) {
  try {
    as.setItem(Lt(af),JSON.stringify(a))
  }
  catch{}
}
function ar() {
  return Ra()
}
function rT() {
  try {
    as.removeItem(Lt(af))
  }
  catch{}
}
function rf(a,e=Ra()) {
  return Ca[a]?e.pets[a]:void 0
}
function wk(a) {
  return bk(a.intimacy).mult*(a.acc?an:1)
}
function kk(a,e=Ra()) {
  const t=Ca[a],s=rf(a,e);
  if(!t||!s)return[];
  const n=wk(s);
  return t.bonuses.map(o=>( {
    apply:(i,r)=>o.apply(i,n*r),text:i=>o.text(n*i)
  }))
}
function vl(a,e) {
  var t;
  return(((t=Ca[a])==null?void 0:t.bonuses)??[]).map(s=>s.text(e))
}
function lT(a,e,t) {
  const s=Ra();
  for(const o of t) {
    const i=yk[o];
    i&&!s.pets[i]&&(s.pets[i]= {
      intimacy:vk,at:Date.now()
    })
  }
  const n=a?s.pets[a]:void 0;
  n&&(n.intimacy=Math.min(Yp,n.intimacy+Math.floor(e/iT))),of(s)
}
function Jp(a,e=Ra()) {
  const t=Ca[a],s=e.pets[a];
  return t!=null&&t.acc?s?s.acc?c("Ya lo tiene."):s.intimacy<Xp?c("{pet} tiene que estar en Cordial ({n}/{min}).", {
    pet:Ht(a),n:s.intimacy,min:Xp
  }):"":c("Necesitas a {pet}.", {
    pet:Ht(a)
  }):c("No lleva accesorio.")
}
function cT(a) {
  const e=Ra();
  return Jp(a,e)?!1:(e.pets[a].acc=!0,of(e),!0)
}
function lf(a,e,t=Ra()) {
  const s=Ca[a];
  if(!(s!=null&&s.from))return c("No evoluciona.");
  if(t.pets[a])return c("Ya lo tienes.");
  const n=t.pets[s.from];
  return n?n.intimacy<nf?c("{pet} tiene que estar en Leal.", {
    pet:Ht(s.from)
  }):(e[a]??0)<Di?c("Vence a {m} {n} veces ({k}/{n}).", {
    m:Ht(a),n:Di,k:e[a]??0
  }):"":c("Necesitas a {pet}.", {
    pet:Ht(s.from)
  })
}
function dT(a,e) {
  const t=Ra();
  return lf(a,e,t)?!1:(t.pets[a]= {
    intimacy:vk,at:Date.now()
  },of(t),!0)
}
function Ht(a) {
  var e;
  return((e=Be[a])==null?void 0:e.name)??a
}
function ka(a) {
  return a.pet&&rf(a.pet)?a.pet:null
}
const xk=new Set(["poring","lunatic","drops","picky","savage_babe","baby_desert_wolf","rocker","whisper","spore","poison_spore","poporing","smokie","dokebi","munak","bon_gun","sohee"]);
function Yn(a,e=Ra()) {
  var t;
  return(t=e.pets[a])!=null&&t.acc&&xk.has(a)?`${a}_acc`:a
}
function Xn(a) {
  return a.endsWith("_acc")?a:`${a}_pet`
}
function cf(a) {
  const e=a.endsWith("_acc")?a.slice(0,-4):a;
  return Ca[e]&&(e===a||xk.has(e))?e:null
}
function hT(a=Ra()) {
  return Rt.filter(e=>a.pets[e.id]).map(e=>e.id)
}
const Mk= {
  damageMult:250,speedMult:120,areaMult:100,extraProjectiles:30,armor:4,damageReduction:250,maxHp:.25,maxHpPct:180,regen:12,regenStill:6,regenMoving:6,regen5:2,lifesteal:300,discovery:80,dotDmg:80,critChance:150,pierceChance:60,critMult:50,doubleChance:150,flee:220,expMult:60,zenyMult:30,potionMult:20,bossUndeadMult:70,bossEliteMult:70,lowHpDamage:40,lowHpBleed:50,endureReduction:60,endureReflect:40,berserk:20,bleedLifesteal:50,petrifyChance:80,stunChance:120,revives:60,castHaste:60,haste:250,atk:.3,matk:.3,str:1,agi:1.5,vit:1.5,int:1,dex:1.5,luk:1.5
},uT= {
  melee: {
    atk:1.2,str:3,dex:1.5,reachMult:80,critChance:180,castHaste:40
  },ranged: {
    atk:1.2,dex:3,str:1,projSpeedMult:40,extraProjectiles:50,critChance:180,pierceChance:150,castHaste:40
  },magic: {
    matk:1.2,int:3,dex:2.5,atk:.2,str:.3,castHaste:180,critChance:180,doubleChance:40
  }
},pT= {
  pickupRadius:40
},$y=20,mT=Mk.damageReduction*(Uo($y+1)-Uo($y)),Sy=new Map;
function $k(a) {
  let e=Sy.get(a);
  return e||Sy.set(a,e= {
    ...Mk,...uT[ge(a).scaling]
  }),e
}
const Ey=new WeakMap;
function df(a,e) {
  let t=Ey.get(a);
  t||Ey.set(a,t=new Map);
  let s=t.get(e);
  return s===void 0&&t.set(e,s=fT(a,e)),s
}
function fT(a,e) {
  const t=fs(ge(e)),s=fs(ge(e));
  a.apply(s,1);
  const n=$k(e);
  let o=0;
  for(const i of Object.keys(t)) {
    if(i==="ext")continue;
    const r=s[i]-t[i];
    if(!r)continue;
    const l=pT[i];
    l!==void 0?o+=l*(r/t[i]):o+=(n[i]??0)*r
  }
  return o
}
function gT(a,e) {
  const t=wa(a),s=$k(e);
  return(s.atk??0)*t.atk+(s.matk??0)*t.matk+mT*t.def
}
const yT=60;
function vT(a,e) {
  const t=DM(e);
  return Gb(a.affixes,yr(a.refine)).reduce((s,n)=>s+(t.includes(n.skill)?n.dmg*yT:0),0)
}
const hf=a=>Math.max(0,Math.round(a));
function $i(a,e) {
  const t=typeof a=="number"?ms[a]:a;
  return t?hf(t.bonuses.reduce((s,n)=>s+df(n,e),0)):0
}
const bT=3,wT=.25;
function kT(a) {
  const e=fe[a.itemId];
  return!e||e.starter?0:bT*mn(a)*(1+wT*(a.quality??0))
}
function xT(a,e) {
  const t=fe[a.itemId];
  if(!t)return 0;
  const s=[...t.bonuses,...wh(a.itemId,mn(a)),...Im(a.affixes)].reduce((n,o)=>n+df(o,e),0)*yr(a.refine);
  return hf(gT(a,e)+s+vT(a,e)+kT(a))
}
function MT(a,e) {
  const t=ka(a);
  return t?Sk(t,e):0
}
function Sk(a,e) {
  const t=rf(a);
  return t?hf(Ca[a].bonuses.reduce((s,n)=>s+df(n,e),0)*wk(t)):0
}
function nr(a,e) {
  return xT(a,e)+a.cards.reduce((t,s)=>t+(s?$i(s,e):0),0)
}
function Ek(a) {
  const e=fs(lr(a));
  return Ph(a).applyStats(e),zm(e,ge(a.promotion??a.job).rank),e.damageReduction=Math.min(.6,e.damageReduction),e.flee=Math.min(.5,e.flee),Wb(e),e.maxHp=Math.max(30,Math.round(e.maxHp)),e
}
function La(a) {
  const e=t=> {
    var n;
    const s=a.equipped[t];
    return s?(n=a.inventory.find(o=>o.uid===s))==null?void 0:n.itemId:void 0
  };
  return {
    headTop:e("head_top"),headMid:e("head_mid"),headLow:e("head_low"),weapon:e("weapon"),shield:Fd(a)?e("shield"):void 0,offhand:Fd(a)?void 0:e("shield"),cart:Vb.has(a.job)?Kb(a.level):void 0
  }
}
function Qp(a) {
  const e=FM[a.job];
  return e&&!a.equipped.weapon?e:null
}
function $T(a,e) {
  const t=a;
  for(const[s,n]of Object.entries(e))typeof n=="number"&&(t[s]=(t[s]??0)+n)
}
function Dn(a) {
  const e=[];
  for(const {
    id:t
  }
  of bs) {
    const s=a.equipped[t],n=s?a.inventory.find(i=>i.uid===s):void 0,o=n?fe[n.itemId]:void 0;
    n&&o&&e.push( {
      slot:t,inst:n,def:o
    })
  }
  return e
}
const ST= {
  archer:.85
},ET= {
  swordsman: {
    oneHand:.75,twoHand:1.25
  },merchant: {
    oneHand:.75,twoHand:1.25
  },thief: {
    oneHand:.35,twoHand:.5
  }
};
function Ph(a) {
  var w,m,f;
  const e={},t={},s=[],n=[],o=[],i=El(a.job);
  o.push(v=> {
    for(const {
      id:x
    }
    of _t)v[x]+=a.stats[x]-1
  });
  const r=i.reduce((v,x)=>v*(ST[x]??1),1);
  r!==1&&o.push(v=>v.ext.jobDmg=r);
  const l=(w=Dn(a).find(v=>v.slot==="weapon"))==null?void 0:w.def.wtype,d=Fd(a);
  for(const[v,x]of Object.entries(a.talents)) {
    const k=Ze[v];
    if(!(!k||x<=0||!i.includes(k.job))&&(k.learn&&n.push(k.learn),!!Yb(k,l,d))) {
      if(k.stat&&o.push(M=>k.stat(M,x)),(m=k.gearStat)!=null&&m.weapons.includes(l??"")&&o.push(M=>k.gearStat.stat(M,x)),k.mod)for(const M of[k.mod.skill,...k.mod.also??[]]) {
        const $=e[M]??(e[M]=hl());
        for(const[P,q]of Object.entries(k.mod.per)) {
          const R=$;
          P==="splashR"?R.splashR=Math.max(R.splashR,q):R[P]+=q*x
        }
        k.mod.hit&&$T($.hit,k.mod.hit(x)),(t[M]??(t[M]=[])).push( {
          name:k.name,text:k.desc(x)
        })
      }
      k.start&&s.push(k.start)
    }
  }
  const h=i.map(v=>ET[v]).find(Boolean);
  h&&!HM.has(l??"")&&((e[f=Sp]??(e[f]=hl())).dmg+=Ji(Lk(a,"weapon"))?h.twoHand:h.oneHand);
  for(const {
    inst:v
  }
  of Dn(a)) {
    const x=wa(v);
    (x.atk||x.matk||x.def)&&o.push(k=> {
      k.atk+=x.atk,k.matk+=x.matk,k.def+=x.def
    });
    for(const k of Oo(v))o.push(M=>k.apply(M,1));
    for(const {
      skill:k,dmg:M
    }
    of Gb(v.affixes,yr(v.refine)))(e[k]??(e[k]=hl())).dmg+=M,(t[k]??(t[k]=[])).push( {
      name:ss(v),text:c("+{p}% de daño", {
        p:Math.round(M*100)
      })
    });
    for(const k of v.cards) {
      const M=k?ms[k]:void 0;
      if(M)for(const $ of M.bonuses)o.push(P=>$.apply(P,1))
    }
  }
  const u=ka(a);
  if(u)for(const v of kk(u))o.push(x=>v.apply(x,1));
  const p=Dn(a).find(v=>v.slot==="weapon"),y=p? {
    itemId:p.inst.itemId,wtype:p.def.wtype
  }
  :null;
  return {
    applyStats:v=>o.forEach(x=>x(v)),mods:e,skillTalents:t,starts:s,learned:n,missingWeapon:Qp(a),weapon:y,shield:d,pet:u
  }
}
function En(a,e) {
  var t;
  return(!e.jobs||!!((t=zM(e))!=null&&t.includes(a.job)))&&(!e.gender||e.gender===a.look.gender)
}
function Tn(a,e) {
  return!e.owner||e.owner===a.id
}
const TT= {
  assassin:["단검","검"]
};
function Tk(a,e) {
  var t;
  return!!e&&e.slot==="weapon"&&!!((t=TT[a])!=null&&t.includes(e.wtype??""))
}
function Ck(a,e,t) {
  var s;
  return((s=bs.find(n=>n.id===t))==null?void 0:s.gear)===e.slot||t==="shield"&&Tk(a,e)
}
function Fd(a) {
  return Dn(a).some(e=>e.slot==="shield"&&e.def.slot==="shield")
}
function CT(a,e) {
  return bs.filter(t=>t.gear===a.slot||e&&t.id==="shield"&&Tk(e,a)).map(t=>t.id)
}
function Ty(a,e,t) {
  const s=a.inventory.find(r=>r.uid===e),n=s&&fe[s.itemId];
  if(!s||!n||!En(a,n)||!Tn(a,s)||Object.values(a.equipped).includes(e)||R1(a,e))return;
  const o=CT(n,a.job),i=t&&o.includes(t)?t:n.slot==="weapon"?"weapon":o.find(r=>!a.equipped[r])??o[0];
  a.equipped[i]=e,i==="weapon"&&Ji(n)?delete a.equipped.shield:i==="shield"&&Ji(Lk(a,"weapon"))&&delete a.equipped.weapon
}
function Lk(a,e) {
  const t=a.equipped[e],s=t?a.inventory.find(n=>n.uid===t):void 0;
  return s?fe[s.itemId]:void 0
}
function LT(a,e) {
  delete a.equipped[e]
}
function qo(a,e) {
  return Object.values(a.equipped).includes(e)
}
function AT(a,e,t,s) {
  const n=a.inventory.find(r=>r.uid===e),o=n&&fe[n.itemId],i=ms[s];
  return!n||!o||!i||t<0||t>=n.cards.length?c("Objeto no válido."):(a.cards[s]??0)<=0?c("No tienes esa carta."):i.compound!==Xb(o.slot)?c("Esta carta no encaja en ese tipo de equipo."):(uf(a,e,t),n.cards[t]=s,a.cards[s]--,a.cards[s]<=0&&delete a.cards[s],null)
}
function PT(a,e,t) {
  const s=a.inventory.find(i=>i.uid===e),n=a.inventory.find(i=>i.uid===t);
  if(!s||!n)return 0;
  let o=0;
  for(let i=0;i<s.cards.length;i++) {
    const r=s.cards[i],l=n.cards.indexOf(null);
    !r||l<0||(n.cards[l]=r,s.cards[i]=null,o++)
  }
  return o
}
function uf(a,e,t) {
  const s=a.inventory.find(o=>o.uid===e),n=s==null?void 0:s.cards[t];
  !s||!n||(s.cards[t]=null,a.cards[n]=(a.cards[n]??0)+1)
}
function Ak(a,e) {
  const t=a.inventory.find(s=>s.uid===e);
  if(!(!t||R1(a,e))) {
    for(let s=0;s<t.cards.length;s++)uf(a,e,s);
    for(const[s,n]of Object.entries(a.equipped))n===e&&delete a.equipped[s];
    a.inventory=a.inventory.filter(s=>s.uid!==e)
  }
}
function uo(a) {
  const e=et[a],t=e.bosses.map(s=>( {
    id:s.id,t:s.t
  }));
  return {
    monsters:[...new Set(e.waves.flatMap(s=>s.pool))],minis:t.slice(0,-1),mvp:t[t.length-1],map:e.map,storyOnly:e.storyOnly
  }
}
const Se=[ {
  id:"prontera",name:"Campos de Prontera",place:"Al sur de Prontera",levels:"1–8",tier:1,gsMin:0,...uo("prontera")
}, {
  id:"sewer",name:"Alcantarillas de Prontera",place:"Bajo las calles de Prontera",levels:"9–12",tier:1,gsMin:20,...uo("sewer")
}, {
  id:"sunken",name:"Barco hundido",place:"Costa de Alberta",levels:"13–15",tier:1,gsMin:40,story:"sunken_story",...uo("sunken")
}, {
  id:"byalan",name:"Isla de Byalan",place:"Mazmorra de Izlude",levels:"16–20",tier:2,gsMin:110,...uo("byalan")
}, {
  id:"payon",name:"Bosque de Payon",place:"Alrededores de Payon",levels:"21–25",tier:2,gsMin:135,...uo("payon")
}, {
  id:"payon_cave",name:"Cueva de Payon",place:"Bajo las montañas de Payon",levels:"26–30",tier:2,gsMin:165,...uo("payon_cave")
}, {
  id:"prt_castle",name:"Castillo de Prontera",place:"Sala del trono",levels:"31–35",tier:2,gsMin:185,jobLvMin:50,...uo("prt_castle")
}, {
  id:"orcs",name:"Aldea orca",place:"Campos de Geffen",levels:"31–40",tier:3,monsters:["goblin","kobold","wolf","orc_warrior"],minis:[ {
    id:"ghostring"
  }
  ],mvp: {
    id:"orc_hero"
  },gsMin:800
}, {
  id:"pyramid",name:"Pirámides de Morroc",place:"Desierto de Morroc",levels:"41–50",tier:3,monsters:["zombie","orc_skeleton"],minis:[ {
    id:"ghostring"
  }, {
    id:"deviling"
  }
  ],mvp: {
    id:"osiris"
  },gsMin:1200
}
];
for(const a of Se)Ob(a,["name","place"]);
function Cy(a) {
  if(!(ge(a).tier!=="extended"||I1(a)))return Se.find(e=> {
    var t;return((t=e.secret)==null?void 0:t.job)===a
  })??null
}
function vr(a) {
  return Dn(a).reduce((e,t)=>e+nr(t.inst,a.job),0)+MT(a,a.job)
}
const jT= {
  mastering:["golden_thief_bug"],kraken:["eddga","moonlight"]
};
function zd(a,e) {
  return a.includes(e)||(jT[e]??[]).some(t=>a.includes(t))
}
function Ud(a,e,t=vr(a)) {
  const s=Se[e],n=a.mvpsDefeated??[],o=e>0?Se[e-1]:null,i=!o||zd(n,o.mvp.id),r=t>=s.gsMin,l=!s.jobLvMin||a.jobLevel>=s.jobLvMin,d=!s.story||(a.stagesCleared??[]).includes(s.story),h=!!s.storyOnly&&(!!a.promotion||(a.stagesCleared??[]).includes(s.id));
  return {
    needMvp:o,mvpOk:i,gsOk:r,jobOk:l,unlocked:i&&r&&l,cleared:zd(n,s.mvp.id),storyOk:d,closed:h
  }
}
function ac(a) {
  var t,s;
  const e=((t=Se.find(n=>n.id===a||n.story===a))==null?void 0:t.levels)??"";
  return Number(((s=e.match(/\d+/g))==null?void 0:s.pop())??10)
}
function pf(a) {
  var e;
  return((e=Se.find(t=>t.id===a||t.story===a))==null?void 0:e.tier)??1
}
function mn(a) {
  var t;
  if(a.tier)return a.tier;
  const e=_T(a);
  return((t=Se.find(s=>ac(s.id)>=e))==null?void 0:t.tier)??Se[Se.length-1].tier
}
const $u=new Map;
function _T(a) {
  var e;
  if(a.ilvl)return a.ilvl;
  if(!$u.size)for(const t of[...Se].reverse()) {
    const s=[...t.monsters,...t.minis.map(o=>o.id),t.mvp.id].flatMap(o=>(Qi[o]??[]).map(i=>i.id)),n=(e=et[t.id])==null?void 0:e.reward;
    for(const o of n?[...s,n]:s)$u.set(o,ac(t.id))
  }
  return $u.get(a.itemId)??10
}
function qT(a) {
  return typeof a=="number"&&a>=1&&a<=99?Math.round(a):void 0
}
function mf(a="prontera") {
  if(a==="endless")return c("Endless Tower");
  const e=Se.find(s=>s.id===a);
  if(e)return e.name;
  const t=Se.find(s=>s.story===a);
  return t?c("{stage} (historia)", {
    stage:t.name
  }):a
}
const Ly=["nigger*","nigga*","niggas","negrata*","sudaca*","chink*","spic","spics","kike","kikes","wetback*","gook*","paki","pakis","raghead*","beaner*","coon","coons","faggot*","fag","fags","maricon*","maricones","bollera*","tranny*","trannies","travelo*","kys","kill yourself","go die","suicidate","suicidaos","matate","ojala te mueras","ojala mueras","heil hitler","sieg heil","hitler did nothing wrong","gas the jews","gora eta","gora eta militarra","viva eta","rape","rapist*","violador*","te voy a violar"],IT=["puta*","puto*","putas","hijoputa*","hijodeputa*","hdp","mierda*","joder","jodete","jodeos","jodido*","jodida*","coño","cabron*","cabrona*","gilipolla*","gilipoya*","imbecil*","idiota*","estupido*","estupida*","pendejo*","pendeja*","verga*","polla*","pollas","cojones","cojon","follar*","follando","follame","zorra*","perra","perras","marica","maricas","mamon*","mamona*","capullo*","culo","culos","chinga*","chingada*","subnormal*","retrasado*","retrasada*","mongolo*","mongola*","malparido*","malparida*","hijueputa*","ptm","ctm","csm","conchetumadre*","conchatumadre*","carajo","mamaguevo*","pinche","pinches","cagon*","me cago en","me cago en tus muertos","me cago en tu madre","me cago en tu puta madre","hijo de puta","hija de puta","hijos de puta","tu puta madre","muerete","la concha de tu madre","cerdo asqueroso","payaso de mierda","fuck*","fck","fcking","fuk","fuking","motherfuck*","shit*","bullshit*","bitch*","bastard*","asshole*","dumbass*","jackass*","dick","dicks","dickhead*","cock","cocks","cocksucker*","cunt*","pussy","pussies","whore*","slut*","wtf","stfu","retard*","idiot*","moron*","prick","pricks","twat*","wanker*","bollocks","piss off","pissed","douche*","son of a bitch","screw you"],RT= {
  0:"o",1:"i",3:"e",4:"a",5:"s",7:"t",8:"b","@":"a",$:"s","!":"i","|":"i"
};
function Pk(a) {
  return[...a.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"")].map(e=>RT[e]??e).join("").replace(/[^a-z]/g,"")
}
function Ay(a) {
  return a.map(e=> {
    const t=e.endsWith("*"),n=[...Pk(e.replace(/\*$/,""))].map(o=>`${o}+`).join("");return {
      re:new RegExp(`^${n}${t?"":"$"}`),words:e.replace(/\*$/,"").trim().split(/\s+/).length
    }
  })
}
const BT= {
  light:Ay(Ly),strict:Ay([...Ly,...IT])
};
function NT(a) {
  const e=[];
  for(const t of a.matchAll(/[\p {
    L
  }
  \p {
    N
  }
  @$!|]+/gu))e.push( {
    start:t.index,end:t.index+t[0].length,n:Pk(t[0])
  });
  return e.filter(t=>t.n)
}
function jk(a,e) {
  const t=BT[e],s=NT(a),n=[],o=t.filter(r=>r.words===1),i=t.filter(r=>r.words>1);
  for(let r=0;r<s.length;r++) {
    o.some(d=>d.re.test(s[r].n))&&n.push([s[r].start,s[r].end]);
    let l=s[r].n;
    for(let d=r+1;d<Math.min(s.length,r+6);d++)l+=s[d].n,i.some(h=>h.re.test(l))&&n.push([s[r].start,s[d].end]);
    if(s[r].n.length===1) {
      let d=r,h="";
      for(;d<s.length&&s[d].n.length===1;)h+=s[d++].n;
      d-r>=3&&t.some(u=>u.re.test(h))&&n.push([s[r].start,s[d-1].end])
    }
  }
  return n
}
function _k(a,e) {
  const t=jk(a,e);
  if(!t.length)return a;
  let s=a;
  for(const[n,o]of t)s=s.slice(0,n)+s.slice(n,o).replace(/[^\s]/g,"*")+s.slice(o);
  return s
}
function qk(a,e) {
  return jk(a,e).length>0
}
const OT=()=>/^(staging\.|localhost$|127\.|\[::1\]$)/.test(location.hostname),DT= {
  wiki:!0,talentsPage:!0,maintClock:!0
},HT=()=>typeof location<"u"&&/^(staging\.|localhost$|127\.|\[::1\]$)/.test(location.hostname),ff=a=>DT[a]||HT(),Py=a=>c(UM[a]??a),jy=[1,2,4];
// --- Dye Preview, Account REST API (`class Ks`), Achievements (`ts`) & Chronicle Perks (`si`) ---
:""
}
`}</div>
      ${f.length||u.length||w.length||y.length||x.length?`<ul class="dr-stats">$ {
  f.map(F=>`<li><b>${F}</b></li>`).join("")
}
$ {
  y.map(F=>`<li>${F}</li>`).join("")
}
$ {
  u.map(F=>`<li>${F.text(1)}</li>`).join("")
}
$ {
  w.map(F=>`<li>${F}</li>`).join("")
}
$ {
  x.map(F=>`<li class="dr-note">${F}</li>`).join("")
}
</ul>`:""}
      ${R}
    </div>`,t.classList.remove("hidden");
let L=()=>{};
if(d) {
  const F=t.querySelector(".dye-av"),Y=F.getContext("2d");
  Y.imageSmoothingEnabled=!1;
  let Q=null;
  It(d.job,d.look,d.equip).then(pe=>Q=pe).catch(()=>{});
  let Z=!0;
  const ke=performance.now(),xe=pe=> {
    if(!Z||!F.isConnected)return;
    const ye=pe-ke;
    Y.clearRect(0,0,F.width,F.height),Y.fillStyle="rgba(0,0,0,0.25)",Y.beginPath(),Y.ellipse(F.width/2,F.height-26,34,11,0,0,Math.PI*2),Y.fill(),Q&&oi(Y,Q,"idle",Math.floor(ye/1500)%8,Math.floor(ye/120),F.width/2,F.height-26,2),requestAnimationFrame(xe)
  };
  requestAnimationFrame(xe),L=()=>Z=!1
}
let j=!1;
const A=()=> {
  var F;
  j||(j=!0,L(),clearTimeout(U),clearInterval(D),window.removeEventListener("keydown",_),t.onclick=null,(F=s.closed)==null||F.call(s),e.done(),this.nextReveal())
},E=performance.now(),C=()=>performance.now()-E<600,_=F=> {
  !n&&!C()&&(F.key===" "||F.key==="Enter"||F.key==="Escape")&&A()
};
window.addEventListener("keydown",_);
let U=0,D=0;
if(n) {
  t.onclick=Z=> {
    var xe;
    const ke=(xe=Z.target.closest("[data-c]"))==null?void 0:xe.dataset.c;
    !ke||C()||(n.choose(ke),A())
  };
  const F=t.querySelector(".dr-roll .lr-time span"),Y=n.until-E,Q=()=>F.style.width=`${Math.max(0,(n.until-performance.now())/Y)*100}%`;
  Q(),D=window.setInterval(Q,200),U=window.setTimeout(A,Y)
}
else t.onclick=()=> {
  C()||A()
},U=window.setTimeout(A,P?6e3:d?8e3:4200)
}
announce(e) {
  const t=ve("announce");
  t.textContent=e,t.classList.add("show"),clearTimeout(t._t),t._t=window.setTimeout(()=>t.classList.remove("show"),2800)
}
toast(e,t) {
  var o;
  const s=ve("toasts"),n=document.createElement("div");
  for(n.className=t!==void 0&&t>=0?`toast q ${Re[t].cls}`:"toast",n.textContent=e,s.appendChild(n);s.children.length>4;)(o=s.firstElementChild)==null||o.remove();
  setTimeout(()=>n.remove(),2700)
}
destroy() {
  this.dps.destroy(),this.reveals=[],this.revealing=!1,de("drop-reveal"),de("skill-tip"),de("hud"),de("boss-bar")
}
}
function Vk(a,e) {
  a.width=a.height=96;
  const t=a.getContext("2d");
  t.clearRect(0,0,a.width,a.height),t.imageSmoothingEnabled=!1;
  const s=2.2,n=Jb(e,"idle",0,0,0).layers.find(l=>l.role==="head"),o=n&&n.sheet.frames[n.frame],i=o?n.x-o.ox+o.w/2:0,r=o?n.y-o.oy+o.h/2:-70;
  oi(t,e,"idle",0,0,a.width/2-i*s,a.height*.44-r*s,s)
}
function Kd(a,e) {
  var t;
  if(pl(e)&&a.stats.infuse)return se.icons.get(YM[cd(a.stats)[0]])??"";
  if(Ao(e)) {
    const s=(t=a.loadout)==null?void 0:t.weapon;
    return s?Me(s.itemId):se.icons.get(ce[a.classDef.start].icon)??""
  }
  return se.icons.get(a.skillDef(e).icon)??""
}
function Hy(a,e,t="") {
  const s=ce[e],n=a.weapons.find(r=>r.id===e),o=(s.kind==="passive"?" passive":"")+t,i=n?'<div class="cd"></div><span class="cdt"></span>':"";
  return`<div class="skill-slot${o}" data-skill="${e}"><img src="${Kd(a,e)}">${i}<span class="lvl">${a.skillLevel(e)}</span></div>`
}
const gn=a=>`${a<0?"−":"+"}${Math.round(Math.abs(a)*100)}%`,ui=(a,e=2)=>Ee(a,e);
function EC(a,e) {
  const s=window.innerWidth,n=window.innerHeight;
  a.style.width="",a.style.zoom="";
  let o=Jn();
  const i=(m,f)=> {
    a.style.left=`${m/o}px`,a.style.top=`${f/o}px`
  };
  let {
    width:r,height:l
  }
  =a.getBoundingClientRect();
  const d=()=>Math.max(8,Math.min(s-r-8,e.left+e.width/2-r/2));
  if(e.top-l-10>=8)return i(d(),e.top-l-10);
  if(e.bottom+10+l<=n-8)return i(d(),e.bottom+10);
  const h=Math.min(r*2,s-16);
  if(h>r) {
    if(a.style.width=`${h/o}px`, {
      width:r,height:l
    }
    =a.getBoundingClientRect(),e.top-l-10>=8)return i(d(),e.top-l-10);
    if(e.bottom+10+l<=n-8)return i(d(),e.bottom+10)
  }
  if(l>n-16) {
    const m=(n-16)/l;
    o*=m,a.style.zoom=`${o}`,r*=m,l*=m
  }
  const u=s-e.right-10,p=e.left-10,y=u>=r+8||u>=p?Math.min(s-r-8,e.right+10):Math.max(8,e.left-10-r),w=Math.max(8,Math.min(n-l-8,e.top+e.height/2-l/2));
  i(Math.max(8,y),w)
}
function TC(a) {
  const e=ve("skill-tip");
  let t=0;
  for(const s of[ve("skillbar"),ve("lu-sockets"),ve("runitems"),ve("buffs")])s.onmouseover=n=> {
    const o=n.target.closest("[data-skill], [data-item], [data-buff]");
    if(!o)return e.classList.add("hidden");
    const i=o.dataset.skill?AC(a,o.dataset.skill):o.dataset.item?LC(a,o.dataset.item):CC(a,o.dataset.buff);
    if(!i)return e.classList.add("hidden");
    e.innerHTML=i,e.classList.toggle("st-short",!o.dataset.skill),e.classList.remove("hidden"),EC(e,o.getBoundingClientRect())
  },s.onmouseleave=()=>e.classList.add("hidden");
  ve("buffs").onclick=s=> {
    Qe&&(ve("buffs").onmouseover(s),clearTimeout(t),t=window.setTimeout(()=>e.classList.add("hidden"),3e3))
  }
}
function CC(a,e) {
  const t=a.activeBuffs().find(l=>l.key===e);
  if(!t)return"";
  const s=ce[t.skill],n=`#${t.color.toString(16).padStart(6,"0")}`,o=Math.ceil(t.left),i=[c("Buff"),t.charges?c("quedan {n} cargas", {
    n:o
  }):c("quedan {n} s", {
    n:o
  }),t.stacks>1?c("×{n} acumulado", {
    n:t.stacks
  }):""],r=t.text.split(" · ").map(l=>`<li>${l}</li>`).join("");
  return`<div class="st-head"><img src="${se.icons.get((s==null?void 0:s.icon)??t.skill)??""}" style="border-color:${n}"><div><b>${(s==null?void 0:s.name)??t.skill}</b><small>${i.filter(Boolean).join(" · ")}</small></div></div><ul class="st-hist st-item">${r}</ul>`
}
function Io(a,e) {
  var s;
  if(a==="deity"&&!on[e])return se.icons.get(((s=ce[e])==null?void 0:s.icon)??"")??"";
  const t=on[e];
  return t!=null&&t.img?`assets/${t.img}`:Me((t==null?void 0:t.icon)??0)
}
function kf(a,e,t,s,n) {
  if(e==="deity"&&!on[t]) {
    const i=a.weapons.find(r=>r.id===t);
    return i?nn.deityTexts(i,s.length+(n===void 0?0:1)):[]
  }
  const o=on[t];
  return o?[nn.itemText(o,s,n)]:[]
}
function LC(a,e) {
  var o;
  const t=a.runItems.slots.get(e);
  if(!t)return"";
  const s=((o=Vn.find(i=>i.id===e))==null?void 0:o.name)??e,n=kf(a,e,t.item,t.vals).map(i=>`<li>${i}</li>`).join("");
  return`<div class="st-head"><img src="${Io(e,t.item)}"><div><b style="color:${Ps(t.quality)}">${a.runItemName(e,t.item)} +${t.vals.length-1}</b><small>${c("{slot} · solo esta partida",{slot:s})}</small></div></div><ul class="st-hist st-item">${n}</ul>`
}
function AC(a,e) {
  var A,E,C;
  const t=a.skillDef(e),s=t.type?c(Tl[t.type].label):"",n=Ao(e)?`${c("Ataque básico")}${s?` · $ {
    s
  }
  `:""}`:t.kind==="passive"?c("Pasiva"):s||c("Activa"),o=`<div class="st-head"><img src="${Kd(a,e)}"><div><b>${t.name}${Kn(t.name)?` <span class="ro-orig">($ {
    Kn(t.name)
  })</span>`:""}</b><small>${n} · ${c("Nv {n}",{n:a.skillLevel(e)})}</small></div></div>`,i=(A=t.tags)!=null&&A.length?`<div class="st-tags">${t.tags.map(_=>`<span>$ {
    c(tw[_])
  }
  </span>`).join("")}</div>`:"",r=a.weapons.find(_=>_.id===e);
  if(!r) {
    const _=a.passives.get(e)??1,U=t.passive?ew(fs(a.classDef),t.passive,0,_):"";
    return`${o}${i}<div class="st-desc">${t.desc(_)}</div>${U?`<div class="st-rows"><span>$ {
      c("En total")
    }
    </span><b>$ {
      U
    }
    </b></div>`:""}`
  }
  const l=a.stats,d=r.mod(a),h=a.skillMod(e),u=r.aspects(),p=[],y=((C=(E=r.cfg)==null?void 0:E.dmg)==null?void 0:C.call(E,r.level))??0,w=(1+d.dmg)*l.damageMult;
  y>0&&p.push(["Daño por golpe",`~${Math.round(y*w).toLocaleString(c("es-ES"))}`]),p.push(["Daño total",gn(w-1)]);
  const m=r.finalCooldown(a),f=1-m/(r.cdBase??r.cooldown());
  p.push(["Enfriamiento",`${ui(m)} s${f>.005?` ($ {
    gn(-f)
  })`:""}`]);
  const v=kh(e,l,r.level);
  v&&p.push(["Casteo",v.replace(c("Casteo")+" ","")]);
  const x=d.count+(r instanceof fg?l.extraProjectiles:0);
  x>0&&p.push([oa.count,Zb( {
    aspect:"count",amount:x
  },r.countUnit())]);
  const k=(1+d.area)*l.areaMult-1;
  u.includes("area")&&Math.abs(k)>.005&&p.push([oa.area,gn(k)]);
  const M=(1+d.reach)*l.reachMult-1;
  u.includes("reach")&&Math.abs(M)>.005&&p.push([oa.reach,gn(M)]),r.up.targets>0&&p.push([oa.targets,c("{n} a la vez", {
    n:1+r.up.targets
  })]),d.splash>0&&p.push([oa.splash,`${tu(d.splash)} · ${ui(XM(a,d)/Os,1)} m`]),d.cone>0&&p.push([oa.cone,`${tu(d.cone)} · ${JM}°`]),d.pierce>0&&p.push([oa.pierce,tu(Math.min(1,d.pierce))]);
  const $=(1+d.speed)*(r instanceof fg?l.projSpeedMult:1)-1;
  u.includes("speed")&&Math.abs($)>.005&&p.push([oa[r.speedKey()],gn($)]),d.duration>0&&p.push([r.durNote?`${oa.duration} ${r.durNote}`:oa.duration,gn(d.duration)]);
  for(const _ of r.effects)p.push([_.label,QM(_,r.eff(_.key))]);
  l.critChance>0&&p.push(["Crítico",`${ui(l.critChance*100,1)}%`]),l.doubleChance>0&&r.type!=="buff"&&r.type!=="orbit"&&p.push(["Doble casteo",`${ui(l.doubleChance*100,1)}%`]);
  const P=a.runItems.slots.get("deity");
  if((P==null?void 0:P.item)===r.id)for(const _ of nn.deityTexts(r,P.vals.length))p.push([`Deity +${P.vals.length-1}`,_]);
  const q=r.has("magic")?"MATK":r.has("melee")?c("ATK cuerpo a cuerpo"):c("ATK a distancia"),R=[r.up.dmg?`${c("mejoras")} ${gn(r.up.dmg)}`:"",h.dmg?`${c("talentos")} ${gn(h.dmg)}`:"",`${q} ×${ui(r.power(a))}`,l.damageMult!==1?`${c("general")} ×${ui(l.damageMult)}`:""].filter(Boolean),L=r.upgradeSummary(a.skillMod(e,!1)),j=L.length?`<div class="st-sub">${c("Mejoras")}</div><ul class="st-hist">${L.map(_=>`<li class="${_.rarity>=0?Ii[_.rarity].cls:"from-talent"}">$ {
    _.text
  }
  </li>`).join("")}</ul>`:"";
  return`${o}${i}<div class="st-desc">${t.desc(r.level,h)}</div><div class="st-rows">${p.map(([_,U])=>`<span>$ {
    c(_)
  }
  </span><b>$ {
    U
  }
  </b>`).join("")}</div><div class="st-note">${c("Daño")}: ${R.join(" · ")}</div>${j}${jC(a,e)}${PC(a,r)}`
}
function PC(a,e) {
  return a.conduitOthers(e.id).map(t=> {
    var o,i;const s=a.weapons.find(r=>r.id===t),n=[];if(s) {
      s.rank>1&&n.push(`<li>${c(s.rank===2?"+{n} bolt por nivel":"+{n} bolts por nivel",{n:s.rank-1})}</li>`);for(const l of s.upgradeSummary(hl(),!1))n.push(`<li class="${Ii[Math.max(0,l.rarity)].cls}">${l.text}</li>`);const r=a.runItems.slots.get("deity");if((r==null?void 0:r.item)===t)for(const l of nn.deityTexts(s,r.vals.length))n.push(`<li>Deity +${r.vals.length-1}: ${l}</li>`)
    }
    for(const r of((i=(o=a.loadout)==null?void 0:o.skillTalents)==null?void 0:i[t])??[])n.push(`<li class="from-talent"><b>${r.name}</b>: ${r.text}</li>`);return n.length?`<div class="st-sub">${c("Del Conducto: {skill}",{skill:ce[t].name})}</div><ul class="st-hist">${n.join("")}</ul>`:""
  }).join("")
}
function jC(a,e) {
  const t=a.skillTalents(e,!1);
  return t.length?`<div class="st-sub">${c("Talentos")}</div><ul class="st-hist">${t.map(s=>`<li class="from-talent"><b>$ {
    s.name
  }
  </b>: $ {
    s.text
  }
  </li>`).join("")}</ul>`:""
}
function Wd(a) {
  return Vn.map(( {
    id:e,name:t
  })=> {
    const s=a.runItems.slots.get(e);return s?`<div class="run-slot ${Re[s.quality].cls}" data-item="${e}"><img src="${Io(e,s.item)}"><span class="lvl">+${s.vals.length-1}</span></div>`:`<div class="run-slot empty" title="${t}"><span>+</span></div>`
  }).join("")
}
function Kk(a) {
  let e=a.basicAttack?Hy(a,a.basicAttack," basic")+'<div class="slot-sep"></div>':"";
  for(let t=0;t<a.maxSkills;t++) {
    const s=a.slots[t];
    e+=s?Hy(a,s):`<div class="skill-slot empty" title="${c("Hueco libre")}"><span>+</span></div>`
  }
  return e
}
function _C(a,e) {
  const t=a.skillDef(e.id);
  if(e.isNew) {
    const n=kh(e.id,a.stats),o=t.type?c(Tl[t.type].label)+" · ":"",i=t.desc(1,a.skillMod(e.id));
    return o+(n?i+" ("+n+")":i)
  }
  if(e.upgrade) {
    const n=a.weapons.find(o=>o.id===e.id);
    return Zb(e.upgrade,n.countUnit(),n.speedKey(),n.durNote)
  }
  const s=a.passives.get(e.id)??0;
  return ew(fs(a.classDef),t.passive,s,s+(e.power??1))
}
function qC(a,e) {
  const t=[...new Set(a.skillTalents(e).map(s=>s.name))];
  return t.length?[`<span class="pk-talent">★ ${t.join(" · ")}</span>`]:[]
}
function Fy(a,e) {
  return a.focused.has(e.id)? {
    mark:`★ ${c("Focus")}`
  }
  :{}
}
const IC="#7fb2ff",Yd=a=>a<=0?"#9aa6c4":Ps(a);
function RC(a,e,t) {
  const s=(l,d)=> {
    B.ui("ef_steal",.4),xf(a,l,t, {
      fresh:d
    })
  },n=a.perksLeft,o=l=>(a.perksMax[l]??0)>0;
  return {
    bar:o("reroll")?[ {
      label:c("Reroll deck"),title:c("Cambia todas las cartas por otras nuevas."),left:n.reroll,disabled:n.reroll<=0,run:()=> {
        const l=a.rerollDeck();l&&s(l,l.map((d,h)=>h))
      }
    }
    ]:[],cardActions:(l,d)=> {
      if(l.id==="potion")return[];
      const h=[];
      return o("reroll_card")&&a.canRerollCard(l)&&h.push( {
        label:c("Reroll"),title:c("Reroll card: la misma habilidad con otra mejora."),left:n.reroll_card,disabled:n.reroll_card<=0,run:()=> {
          const u=a.rerollCard(l);u&&(e[d]=u,s(e,[d]))
        }
      }),o("focus")&&h.push( {
        label:c("Focus"),title:a.focused.has(l.id)?c("Ya sale con prioridad."):c("Focus: esta habilidad saldrá con prioridad el resto de la partida."),left:n.focus,disabled:n.focus<=0||a.focused.has(l.id),run:()=> {
          a.focusCard(l)&&s(e,[])
        }
      }),o("banish")&&h.push( {
        label:c("Banish"),title:c(l.isNew?"Banish: esta habilidad no volverá a salir en la partida.":"Banish: esta habilidad dejará de salir para mejorarla en la partida."),left:n.banish,disabled:n.banish<=0,run:()=> {
          const u=a.banishCard(l,e);u?e[d]=u:e.splice(d,1),e.length||e.push( {
            id:"potion",rank:0,isNew:!1,rarity:0
          }),s(e,u||e[0].id==="potion"?[d]:[])
        }
      }),h
    }
  }
}
function Wk(a) {
  return ji*(a.difficulty.pick??1)
}
function Yk(a,e) {
  if(a.coop)return e||(a.pickDeadline=performance.now()+Wk(a)*1e3),a.pickDeadline
}
function xf(a,e,t,s) {
  const n=RC(a,e,t),o=a.slots.length;
  ve("lu-sockets").innerHTML=`<span>${c("Habilidades")} ${o}/${a.maxSkills}</span><div class="sockets">${Kk(a)}</div>${o>=a.maxSkills?`<small>$ {
    c("Huecos llenos: ya solo puedes mejorar estas.")
  }
  </small>`:""}`;
  const i=e.map(r=> {
    if(r.id==="potion")return {
      color:Yd(0),icon:se.icons.get("meat")??"",badge:"",name:c("Carne"),sub:"",lines:[c("Recupera 50 HP.")]
    };const l=a.skillDef(r.id),d=a.coldClone(r.id)?ce[r.id].name:"",h=d?[`<span class="pk-talent">❄ ${c("Es tu {skill} (Escarcha persistente)",{skill:d})}</span>`]:[];if(r.isNew) {
      const u=kh(r.id,a.stats),p=[Kn(l.name)&&`(${Kn(l.name)})`,d,l.type?c(Tl[l.type].label):c(l.kind==="passive"?"Pasiva":"Activa"),u].filter(Boolean).join(" · ");return {
        color:IC,icon:Kd(a,r.id),badge:c("Habilidad"),fresh:c("¡NUEVA!"),name:l.name,sub:p,lines:[...h,l.desc(1,a.skillMod(r.id)),...qC(a,r.id)],...Fy(a,r)
      }
    }
    return {
      ...Fy(a,r),color:Yd(r.rarity),icon:Kd(a,r.id),badge:Ii[r.rarity].name,name:l.name,sub:[d,c("Nv {n}", {
        n:r.rank
      })].filter(Boolean).join(" · "),lines:[...h,..._C(a,r).split(" + ")]
    }
  });
  i.forEach((r,l)=>r.actions=n.cardActions(e[l],l)),br( {
    again:s,bar:n.bar,deadline:Yk(a,s),title:c("¡Level Up!"),gain:c("Nv {n}: +{d}% de daño · +{h}% de vida", {
      n:a.level-a.pendingLevelUps+1,d:Ee(xh*100,1),h:Ee(Um*100,1)
    }),subtitle:c(o<a.maxSkills?"Elige una habilidad":"Mejora una habilidad"),extra:"sockets",cards:i,onPick:r=> {
      de("skill-tip"),t(e[r])
    }
  })
}
function BC(a,e,t,s) {
  const n=(d,h)=> {
    B.ui("ef_steal",.4),Xk(a,d,t,s, {
      fresh:h
    })
  },o=a.perksLeft,i=d=>(a.perksMax[d]??0)>0;
  return {
    bar:i("reroll")?[ {
      label:c("Reroll deck"),title:c("Cambia todas las cartas por otras nuevas."),left:o.reroll,disabled:o.reroll<=0,run:()=> {
        const d=a.rerollChest();d!=null&&d.length&&n(d,d.map((h,u)=>u))
      }
    }
    ]:[],cardActions:(d,h)=> {
      const u=[];
      return i("reroll_card")&&a.canRerollChestCard(d)&&u.push( {
        label:c("Reroll"),title:c("Reroll card: el mismo hueco con otra tirada."),left:o.reroll_card,disabled:o.reroll_card<=0,run:()=> {
          const p=a.rerollChestCard(d);p&&(e[h]=p,n(e,[h]))
        }
      }),i("focus")&&u.push( {
        label:c("Focus"),title:a.focusedItems.has(d.item)?c("Ya sale con prioridad."):c("Focus: saldrá con prioridad en los cofres el resto de la partida."),left:o.focus,disabled:o.focus<=0||a.focusedItems.has(d.item),run:()=> {
          a.focusChestCard(d)&&n(e,[])
        }
      }),i("banish")&&u.push( {
        label:c("Banish"),title:c("Banish: no volverá a salir en los cofres de la partida."),left:o.banish,disabled:o.banish<=0,run:()=> {
          const p=a.banishChestCard(d,e);if(p?e[h]=p:e.splice(h,1),!e.length)return Uk(),s(null);n(e,p?[h]:[])
        }
      }),u
    }
  }
}
function Xk(a,e,t,s,n) {
  const o=BC(a,e,t,s),i=e.map((r,l)=> {
    var v;const d=Re[r.quality],h=a.runItems.slots.get(r.slot),u=((v=Vn.find(x=>x.id===r.slot))==null?void 0:v.name)??r.slot,p=(h==null?void 0:h.item)===r.item,y=kf(a,r.slot,r.item,p?h.vals:[],r.value),w=h&&!p? {
      icon:Io(r.slot,h.item),text:c("Sustituye a {name}", {
        name:a.runItemName(r.slot,h.item)
      })
    }
    :void 0,m=h&&!p?`${a.runItemName(r.slot,h.item)}${h.vals.length>1?` +$ {
      h.vals.length-1
    }
    `:""}`:"",f=h&&!p? {
      from:Io(r.slot,h.item),to:Io(r.slot,r.item),question:c("¿Cambiar {old} por {new}?", {
        old:a.runItemName(r.slot,h.item),new:a.runItemName(r.slot,r.item)
      }),note:c("Perderás {old}.", {
        old:m
      })
    }
    :void 0;return {
      swap:w,confirm:f,color:Yd(r.quality),icon:Io(r.slot,r.item),badge:d.name,fresh:r.refine>0?void 0:c("¡NUEVO!"),name:`${a.runItemName(r.slot,r.item)}${r.refine>0?` +$ {
        r.refine
      }
      `:""}`,sub:u,lines:y,actions:o.cardActions(r,l),...a.focusedItems.has(r.item)? {
        mark:`★ ${c("Focus")}`
      }
      :{}
    }
  });
  ve("lu-sockets").innerHTML=`<span>${c("Objetos")} ${a.runItems.slots.size}/${Vn.length}</span><div class="sockets">${Wd(a)}</div>`,br( {
    again:n,bar:o.bar,deadline:Yk(a,n),title:c("Cofre del tesoro"),subtitle:c("Elige una pieza · −{cost} zeny", {
      cost:t
    }),extra:"sockets",cards:i,onPick:r=> {
      de("skill-tip"),s(e[r])
    }
  })
}
function zy(a,e) {
  var s;
  const t=((s=Vn.find(n=>n.id===e.slot))==null?void 0:s.name)??e.slot;
  return {
    color:Yd(e.quality),icon:Io(e.slot,e.item),badge:Re[e.quality].name,name:`${a.runItemName(e.slot,e.item)} +${e.vals.length-1}`,sub:c("{slot} · Nv {n}", {
      slot:t,n:e.vals.length
    }),lines:kf(a,e.slot,e.item,e.vals)
  }
}
function qc(a,e,t) {
  a.style.setProperty("--q",e.color),a.querySelector(".pk-badge").textContent=e.badge,a.querySelector(".pk-art img").src=e.icon,a.querySelector(".pk-name").textContent=e.name,a.querySelector(".pk-sub").textContent=e.sub;
  const s=a.querySelector(".pk-lines");
  s.innerHTML=e.lines.map(n=>`<li>${n}</li>`).join(""),s.style.visibility=t?"":"hidden"
}
function NC(a,e,t) {
  const s=e.map(y=>zy(a,y)),n=a.slots.filter(ul),o=y=> {
    const w=nn.pool(y.slot,n),m=w[Math.floor(Math.random()*w.length)],f=on[m]?Qb():Re.length-1;
    return zy(a, {
      slot:y.slot,item:m,vals:y.vals,quality:f
    })
  };
  ve("lu-sockets").innerHTML=`<span>${c("Objetos")} ${a.runItems.slots.size}/${Vn.length}</span><div class="sockets">${Wd(a)}</div>`,ve("lu-sockets").style.visibility="hidden";
  const i=br( {
    title:c("¡Objetos de la historia!"),subtitle:c("Tu equipo para esta aventura"),extra:"sockets",cards:e.map(o),locked:!0,all:!0,hint:" ",deadline:a.coop?performance.now()+(Wk(a)+4)*1e3:void 0,onPick:()=> {
      ve("lu-sockets").style.visibility="",de("skill-tip"),t()
    }
  });
  let r=0;
  e.forEach((y,w)=> {
    for(const m of[s[w],...Array.from( {
      length:16
    },()=>o(y))])qc(i.slots[w],m,!0),r=Math.max(r,i.cards[w].offsetHeight);qc(i.slots[w],o(y),!1)
  });
  for(const y of i.cards)y.style.minHeight=`${r}px`;
  for(const y of i.slots)y.querySelector(".pk-lines").style.visibility="hidden";
  const l=performance.now(),d=e.map((y,w)=>1700+w*750),h=e.map(()=>0),u=e.map(()=>!1),p=y=> {
    const w=y-l;
    if(e.forEach((m,f)=> {
      if(u[f])return;if(w>=d[f]) {
        u[f]=!0,qc(i.slots[f],s[f],!0),i.slots[f].classList.add("pk-landed"),B.play(m.quality>=Re.length-1?"ef_blessing":"ef_coin",.5);return
      }
      if(w<h[f])return;const v=w/d[f];h[f]=w+55+270*v*v,qc(i.slots[f],o(m),!1),B.play("ef_coin",.12)
    }),u.every(Boolean)) {
      window.setTimeout(()=> {
        ve("lu-sockets").innerHTML=`<span>${c("Objetos")} ${a.runItems.slots.size}/${Vn.length}</span><div class="sockets">${Wd(a)}</div>`,ve("lu-sockets").style.visibility="",ve("pk-hint").textContent=c("Clic o Espacio para continuar"),i.unlock()
      },450);
      return
    }
    requestAnimationFrame(p)
  };
  requestAnimationFrame(p)
}
function Jk(a,e,t,s,n) {
  ve("go-title").textContent=c(e?"¡Has sobrevivido!":"Has muerto");
  const o=Math.floor(a.time),i=a.runLoot.map(p=>`<img class="q${p.quality}" src="${Me(p.id)}" title="${zo(p.id,qm(p.affixes))} (${Re[p.quality].name})">`).join(""),r=a.runCards.map(p=>`<img class="cardimg" src="${Fs(p)}" title="${qt(p)}">`).join(""),l=(p,y,w,m=!1)=>`<div class="bar exp${m?" job":""}" style="margin:4px 0"><div style="width:${w?100:p/y*100}%"></div></div>`,d=t?`${c("EXP base")}: <b>+${t.exp}</b> · Base Lv <b>${s.level}</b><br>${t.levelsGained>0?`<span class="levelup-msg">$ {
    c("¡Subes a Base Lv {lv}!", {
      lv:t.newLevel
    })
  }
   $ {
    c("+{n} puntos de estado", {
      n:t.statPoints
    })
  }
  </span><br>`:""}${l(s.exp,Go(s.level),s.level>=Jl)}${c("EXP de job")}: <b>+${t.jobExp}</b> · Job Lv <b>${Nh(s)}</b><br>${t.jobLevelsGained>0?`<span class="levelup-msg">$ {
    c("¡Subes a Job Lv {lv}!", {
      lv:t.newJobLevel
    })
  }
   $ {
    c(t.talentPoints>1?"+{n} puntos de talento":"+{n} punto de talento", {
      n:t.talentPoints
    })
  }
  </span><br>`:""}${s.promotion?l(0,1,!1,!0):l(s.jobExp,Ql(s.jobLevel),s.jobLevel>=Zn(s.job),!0)}`:"",h=(p,y,w="")=>`<section class="go-box"><div class="go-box-title"><span>${p}</span>${w}</div>${y}</section>`,u=(p,y)=>`<div class="go-chip"><span>${p}</span><b>${y}</b></div>`;
  ve("go-stats").innerHTML=h(c("Partida"),`<div class="go-chips">${u("Job",a.jobLabel||a.classDef.name)}${u(c("Tiempo"),`$ {
    Math.floor(o/60)
  }
  :$ {
    String(o%60).padStart(2,"0")
  }
  `)}${u(c("Nv en partida"),a.level)}${u(c("Monstruos"),a.kills)}${u(c("Jefes"),a.bossKills)}</div>`)+(d?h(c("Experiencia"),`<div class="go-exp">${d}</div>`):"")+(i||r?`<div class="go-loot">${i?h(c("Botín obtenido"),`<div class="go-items">$ {
    i
  }
  </div>`):""}${r?h(c("Cartas obtenidas"),`<div class="go-cards">$ {
    r
  }
  </div>`):""}</div>`:"")+h(c("Daño de la partida"),`<div class="dps-list go-dps">${Bk(a,!0)}</div>`,`<b>${sC(a)}</b>`),ve("btn-restart").onclick=()=> {
    de("gameover"),n()
  },Ue("gameover")
}
const Qk=matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches||navigator.standalone===!0,OC=/iP(hone|ad|od)/.test(navigator.userAgent)||/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1;
let om=Promise.resolve(),$d=null;
const Do= {
  state:"idle",progress:0
};
function Xd(a,e=Do.progress) {
  Do.state=a,Do.progress=e,window.dispatchEvent(new Event("ro-update"))
}
let Jd=null,Qd= {
  quiet:()=>!1,playing:()=>!0
},Zk=!1;
function DC(a) {
  Qd=a
}
function qh() {
  return!Jd||Qd.playing()||!(Qd.quiet()||Zk)?!1:(Jd.postMessage("skip-waiting"),!0)
}
async function Zd() {
  await($d==null?void 0:$d.update().catch(()=>{}))
}
function HC() {
  Zk=!0,Zd().then(()=>qh())
}
function FC() {
  if(XC(),!("serviceWorker"in navigator))return;
  const a=navigator.serviceWorker,e=Promise.race([JC(),Nl(UC).then(()=>Promise.reject(new Error("sin respuesta")))]);
  e.catch(t=>console.warn("service worker:",t)),a.controller?(Do.state="checking",a.addEventListener("message",t=> {
    var s;((s=t.data)==null?void 0:s.t)==="sw-progress"&&Do.state==="updating"&&Xd("updating",Math.max(Do.progress,t.data.p))
  }),a.startMessages(),om=Promise.race([e.then(GC,()=>{}),Nl(zC)]).then(()=>Xd("idle"))):om=new Promise(t=> {
    a.addEventListener("controllerchange",()=>t(), {
      once:!0
    }),setTimeout(t,4e3)
  })
}
const Nl=a=>new Promise(e=>setTimeout(e,a)),zC=3e4,UC=8e3,Uy="ro-life.sw-repair";
async function im(a=!1) {
  if(!("serviceWorker"in navigator)||!navigator.serviceWorker.controller)return!1;
  try {
    if(!a&&Date.now()-(Number(sessionStorage.getItem(Uy))||0)<6e4)return!1;
    sessionStorage.setItem(Uy,String(Date.now()))
  }
  catch {
    return!1
  }
  const e=(async()=> {
    for(const t of await navigator.serviceWorker.getRegistrations())await t.unregister().catch(()=>!1);if("caches"in window)for(const t of await caches.keys())t.startsWith("ro-")&&await caches.delete(t).catch(()=>!1)
  })().catch(()=>{});
  return await Promise.race([e,Nl(3e3)]),location.reload(),!0
}
async function GC(a) {
  !a.installing&&!a.waiting&&await Promise.race([a.update().catch(()=>{}),Nl(2500)]);
  const e=a.installing??a.waiting;
  e&&(Xd("updating",0),await new Promise(t=> {
    const s=()=> {
      e.state==="installed"&&(Xd("updating",1),Jd=e,qh()),e.state==="installed"||e.state==="activating"||e.state==="activated"?Nl(5e3).then(t):e.state==="redundant"&&t()
    };e.addEventListener("statechange",s),s(),setTimeout(t,2e4)
  }))
}
let Hn=null,Xo=Qk;
const e1=()=>!Xo&&(!!Hn||OC),VC=()=>!Xo&&!!Hn,KC=()=>Xo;
async function WC() {
  const a=Hn;
  return a?(Hn=null,await a.prompt(),(await a.userChoice).outcome==="accepted"&&(Xo=!0),window.dispatchEvent(new Event("ro-install")),Xo):!1
}
async function YC() {
  if(Hn) {
    const a=Hn;
    Hn=null,await a.prompt(),(await a.userChoice).outcome==="accepted"&&(Xo=!0),window.dispatchEvent(new Event("ro-install"));
    return
  }
  Ae(c("Instalar RO Life"),c("En Safari, toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>. El juego se abrirá a pantalla completa, como una app."),[ {
    label:c("Entendido"),primary:!0
  }
  ])
}
function XC() {
  Qk||(window.addEventListener("beforeinstallprompt",a=> {
    a.preventDefault(),Hn=a,window.dispatchEvent(new Event("ro-install"))
  }),window.addEventListener("appinstalled",()=> {
    Xo=!0,window.dispatchEvent(new Event("ro-install"))
  }))
}
async function JC() {
  const a=navigator.serviceWorker,e=!!a.controller,t=await a.register("sw.js");
  $d=t,t.waiting&&e&&Gy(t.waiting),t.addEventListener("updatefound",()=> {
    const n=t.installing;n==null||n.addEventListener("statechange",()=> {
      n.state==="installed"&&a.controller&&Gy(n)
    })
  });
  let s=!1;
  return a.addEventListener("controllerchange",()=> {
    !e||s||(s=!0,location.reload())
  }),document.addEventListener("visibilitychange",()=> {
    document.visibilityState==="visible"&&t.update().catch(()=>{})
  }),setInterval(()=>t.update().catch(()=>{}),15*6e4),t
}
function Gy(a) {
  Jd=a,!qh()&&rm()
}
let Su=0;
function rm() {
  var a;
  if(clearTimeout(Su),Qd.playing()||!((a=document.getElementById("npc-dialog"))!=null&&a.classList.contains("hidden"))) {
    Su=window.setTimeout(rm,5e3);
    return
  }
  Ae(c("Versión nueva"),c("Hay una versión nueva del juego. Recarga la página para ponerla: se descarga en la portada y vuelves a entrar."),[ {
    label:c("Más tarde"),run:()=>Su=window.setTimeout(rm,10*6e4)
  }, {
    label:c("Recargar"),primary:!0,run:()=>location.reload()
  }
  ])
}
const QC=6e4,ZC=[5,1];
let Et= {
  state:"ok"
};
const t1=[],s1=[];
let Eu=[],Da=null,Vy=0;
function Ky() {
  return Et
}
const Tu="ro-life-maint-key";
let Mf="";
function eL() {
  try {
    const a=new URL(location.href),e=a.searchParams.get("acceso");
    e!==null&&(e&&e!=="off"?localStorage.setItem(Tu,e):localStorage.removeItem(Tu),a.searchParams.delete("acceso"),history.replaceState(null,"",a.href)),Mf=localStorage.getItem(Tu)??""
  }
  catch{}
}
eL();
const or=()=>Mf,lm=()=>Et.state==="maintenance"&&!Mf;
function a1(a) {
  t1.push(a)
}
function tL(a) {
  s1.push(a)
}
function n1(a=Et) {
  return a.at?new Date(a.at).toLocaleTimeString(Ia(), {
    hour:"2-digit",minute:"2-digit",timeZoneName:"short"
  }):""
}
function o1(a=Et) {
  const e=Math.max(0,(a.at??0)-Date.now());
  return`${Math.floor(e/6e4)}:${String(Math.floor(e%6e4/1e3)).padStart(2,"0")}`
}
function Ai(a=Et) {
  const[e,t]=(a.message??"").split("||");
  return(Te.lang!=="es"&&t?t:e??"").trim()
}
function Ol(a=Et) {
  if(a.state==="maintenance")return Ai(a)||c("Estamos actualizando el servidor. Volvemos en unos minutos.");
  if(a.state==="info")return Ai(a);
  if(a.state!=="warn"||!a.at)return"";
  const e=Math.max(0,a.at-Date.now()),t=Math.floor(e/6e4),s=Math.floor(e%6e4/1e3);
  return c("Mantenimiento a las {time} (en {left}): el servidor se actualizará.", {
    time:n1(a),left:`${t}:${String(s).padStart(2,"0")}`
  })+(Ai(a)?` ${Ai(a)}`:"")
}
function Jo(a) {
  const e=Et.state;
  if(JSON.stringify(a)!==JSON.stringify(Et)) {
    Et=a;
    for(const t of Eu)clearTimeout(t);
    if(Eu=[],Et.state==="warn"&&Et.at)for(const t of ZC) {
      const s=Et.at-t*6e4-Date.now();
      s>0&&Eu.push(window.setTimeout(()=>s1.forEach(n=>n(t)),s))
    }
    r1();
    for(const t of t1)t(Et);
    e==="maintenance"&&Et.state==="ok"&&Zd()
  }
}
const sL='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 11v6M12 7.2v.1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',i1='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
let Wy=0;
function r1() {
  if(Et.state!=="warn"&&Et.state!=="info") {
    Da==null||Da.remove(),Da=null,clearInterval(Vy);
    return
  }
  if(!Da) {
    const a=Da=document.createElement("div");
    a.id="maint-banner",a.innerHTML=`<span class="mb-ico">${i1}</span><span class="mb-left"></span><span class="mb-text"></span>`;
    for(const e of["pointerdown","touchstart","mousedown"])a.addEventListener(e,t=>t.stopPropagation());
    a.addEventListener("click",e=> {
      e.stopPropagation(),clearTimeout(Wy),a.classList.toggle("open")&&(Wy=window.setTimeout(()=>a.classList.remove("open"),8e3)),l1(a)
    }),document.body.appendChild(a),Vy=window.setInterval(()=> {
      Da&&Yy(Da)
    },1e3)
  }
  Yy(Da)
}
function Yy(a) {
  const e=Et.state==="info";
  a.classList.contains("info")!==e&&(a.classList.toggle("info",e),a.querySelector(".mb-ico").innerHTML=e?sL:i1),a.querySelector(".mb-left").textContent=e?"":o1(),a.querySelector(".mb-text").textContent=Ol(),a.title=Ol(),a.classList.toggle("compact",ff("maintClock")&&(document.documentElement.classList.contains("touch")||innerWidth<=700)),l1(a)
}
const aL=["#lobby-place","#timer-box","#boss-bar","#endless-hud"],nL=["#lobby-actions","#basic-info","#minimap","#timer-box"],Ic=a=> {
  const e=document.querySelector(a);
  return e!=null&&e.getClientRects().length?e.getBoundingClientRect():null
};
function l1(a) {
  let e=0;
  for(const i of aL) {
    const r=Ic(i);
    r!=null&&r.height&&r.top<innerHeight/3&&r.left<innerWidth/2&&r.right>innerWidth/2&&(e=Math.max(e,r.bottom))
  }
  let t=null;
  const s=e?null:Ic("#charcreate .create-window"),n=e||s?null:Ic("#profile-bar");
  s&&s.left-28>=200?t=[14,14,Math.min(400,s.left-28)]:n&&(t=[n.bottom+8,n.left,n.width]);
  let o=innerWidth/2-12;
  if(!t)for(const i of nL) {
    const r=Ic(i);
    !(r!=null&&r.height)||r.top>(e||12)+60||(r.right<innerWidth/2?o=Math.min(o,innerWidth/2-r.right-8):r.left>innerWidth/2&&(o=Math.min(o,r.left-innerWidth/2-8)))
  }
  a.style.maxWidth=t?"":`${Math.round(Math.min(420,o*2))}px`,a.classList.toggle("side",!!t),a.style.top=t?`${Math.round(t[0])}px`:e?`${Math.round(e+8)}px`:"",a.style.left=t?`${Math.round(t[1])}px`:"",a.style.width=t?`${Math.round(t[2])}px`:""
}
async function Sd() {
  try {
    const a=await fetch("status.json", {
      cache:"no-store"
    });
    if(!a.ok)return;
    const e=await a.json(),t=e.state==="warn"||e.state==="maintenance"||e.state==="info"&&!!e.message;
    Jo(t? {
      state:e.state,...Number.isFinite(e.at)? {
        at:Number(e.at)
      }
      :{},...e.message? {
        message:String(e.message)
      }
      :{}
    }
    : {
      state:"ok"
    })
  }
  catch{}
}
async function oL() {
  return await Sd(),Et
}
function iL() {
  return window.setInterval(()=>void Sd(),QC),document.addEventListener("visibilitychange",()=> {
    document.visibilityState==="visible"&&Sd()
  }),window.addEventListener("ro-lang",r1),Sd()
}
var Xy= {
  commit:"7967a1a",date:"2026-11-11T01:47:09.000Z"
};
const $f="ro-life-session",Ih="ro-life-guest-session",cm=a=>`ro-life-sync.${a}`,eh="ro-life.",th="ro-life-guest",c1=3e3,rL=3e4;
let d1=()=>!1,dm=0;
function lL(a) {
  d1=a
}
let ee=null,wr=null,Qn=null;
function h1() {
  return new URL("api/",document.baseURI).href
}
class Ks extends Error {
  constructor(t,s) {
    super(String(s.error??t));
    g(this,"code");
    g(this,"status");
    g(this,"body");
    this.status=t,this.code=String(s.error??""),this.body=s
  }
}
async function nt(a,e,t,s=!1) {
  const n={};
  t!==void 0&&(n["content-type"]="application/json"),ee&&(n["x-session"]=ee.token),or()&&(n["x-maint-key"]=or());
  const o=await fetch(h1()+e, {
    method:a,headers:n,body:t===void 0?void 0:JSON.stringify(t),keepalive:s
  }),i=await o.json().catch(()=>({}));
  if(!o.ok)throw new Ks(o.status,i);
  return i
}
function cL(a) {
  nt("POST","crash", {
    ...a,build:`${Xy.date.slice(0,10)} ${Xy.commit}`
  },!0).catch(()=>{})
}
function kr(a) {
  const e=Number(a.until),t=e?new Date(e).toLocaleString(Ia(), {
    dateStyle:"medium",timeStyle:"short"
  }):"";
  return e?c("Tu cuenta está bloqueada hasta el {date}.", {
    date:t
  }):c("Tu cuenta está bloqueada para siempre.")
}
const Qo=a=>a instanceof Ks&&a.status===403&&a.code==="banned";
function Aa(a) {
  return a instanceof Ks?Qo(a)?kr(a.body): {
    taken:c("Ese usuario ya existe."),offensive:c("Ese nombre no está permitido."),maintenance:c("El servidor está en mantenimiento por una actualización. Vuelve en unos minutos."),wrong:c("Usuario o contraseña incorrectos."),wrongAnswers:Number(a.body.left)>1?c("Usuario o respuestas incorrectos. Te quedan {n} intentos esta semana.", {
      n:Number(a.body.left)
    }):Number(a.body.left)===1?c("Usuario o respuestas incorrectos. Te queda 1 intento esta semana."):c("Usuario o respuestas incorrectos. No te quedan intentos esta semana."),recoverLimit:c("Has gastado los 3 intentos de la semana. Vuelve a probar a partir del {date}.", {
      date:new Date(Number(a.body.until)).toLocaleString(Ia(), {
        dateStyle:"medium",timeStyle:"short"
      })
    }),session:c("La sesión ha caducado. Vuelve a entrar con tu cuenta."),declined:c("Rechazaste las preguntas de seguridad: esta cuenta no las puede tener."),ticket:c("Ha pasado demasiado tiempo. Vuelve a contestar las preguntas."),slow:c("Demasiados intentos. Espera unos minutos."),regDay:c("Desde esta conexión ya se han creado varias cuentas hoy. Vuelve a probar mañana."),tor:c("No se pueden crear cuentas desde Tor."),bad:c("El usuario lleva de 3 a 16 letras, números o _."),tooBig:c("El guardado es demasiado grande para subirlo.")
  }
  [a.code]??c("No se pudo conectar con el servidor."):c("No se pudo conectar con el servidor.")
}
function Sf(a) {
  try {
    const e=localStorage.getItem(a);
    return e?JSON.parse(e):null
  }
  catch {
    return null
  }
}
function dL(a) {
  try {
    return localStorage.getItem(a)
  }
  catch {
    return null
  }
}
function Zo(a,e) {
  try {
    return e===null?localStorage.removeItem(a):localStorage.setItem(a,e),localStorage.getItem(a)===e
  }
  catch {
    return!1
  }
}
function sh(a) {
  const e={};
  try {
    for(const t of Object.keys(localStorage).sort()) {
      if(!t.startsWith(a))continue;
      const s=t.slice(a.length);
      if(!tf.test(s))continue;
      const n=localStorage.getItem(t);
      n!==null&&(e[s]=n)
    }
  }
  catch{}return e
}
function ei(a,e,t) {
  return(ee==null?void 0:ee.id)!==a?!1:(_l(t),xa(a, {
    ...dn(),rev:e,sent:JSON.stringify(sf()),wipe:void 0
  }),!0)
}
let ti= {
  rev:0,sent:""
};
const dn=a=>ti;
function xa(a,e) {
  return ti=e,p1(),!0
}
const Jy=a=>btoa(String.fromCharCode(...a)),Qy=a=>Uint8Array.from(atob(a),e=>e.charCodeAt(0));
async function u1(a) {
  const e=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`ro-life-vault:${a}`));
  return crypto.subtle.importKey("raw",e,"AES-GCM",!1,["encrypt","decrypt"])
}
let Cu=0;
function p1() {
  Cu||!ee||Mt()||(Cu=window.setTimeout(()=> {
    Cu=0,m1()
  },250))
}
async function m1() {
  const a=ee;
  if(!(!a||!crypto.subtle))try {
    const e=crypto.getRandomValues(new Uint8Array(12)),t=new TextEncoder().encode(JSON.stringify( {
      meta:ti,doc:sf()
    })),s=new Uint8Array(await crypto.subtle.encrypt( {
      name:"AES-GCM",iv:e
    },await u1(a.token),t));
    ee===a&&Zo(cm(a.id),`${Jy(e)}.${Jy(s)}`)
  }
  catch{}
}
async function f1(a) {
  let e=null,t=null;
  const s=dL(cm(a.id));
  if(s!=null&&s.startsWith("{"))t=Sf(cm(a.id)),e=sh(Mu(a.id));
  else if(s&&crypto.subtle)try {
    const[n,o]=s.split("."),i=await crypto.subtle.decrypt( {
      name:"AES-GCM",iv:Qy(n)
    },await u1(a.token),Qy(o));
    ( {
      meta:t,doc:e
    }
    =JSON.parse(new TextDecoder().decode(i)))
  }
  catch{}for(const n of Object.keys(sh(Mu(a.id))))Zo(Mu(a.id)+n,null);
  ee===a&&(t&&e&&Number.isInteger(t.rev)&&typeof t.sent=="string"?(_l(e),ti=t):(_l({}),ti= {
    rev:0,sent:""
  }),await m1())
}
function hL() {
  !ee||Mt()||xa(ee.id, {
    ...dn(ee.id),wipe:!0
  })
}
function Dl(a) {
  (ee==null?void 0:ee.id)!==a.id&&(Qn=null,_l({}),ti= {
    rev:0,sent:""
  }),ee=a,wr=null,Zo(a.guest?Ih:$f,JSON.stringify(a)),Ah(a.id),window.dispatchEvent(new Event("ro-account"))
}
function hn() {
  const a=ee;
  ee=null,wr=null,_l({}),ti= {
    rev:0,sent:""
  },Zo(a!=null&&a.guest?Ih:$f,null),Ah(null),window.dispatchEvent(new Event("ro-account")),a&&!a.guest&&(ah=g1())
}
let Zy=0;
function g1() {
  if(Mt()||ee)return Promise.resolve();
  const a=Sf(Ih);
  if(a!=null&&a.token&&Number.isInteger(a.id)) {
    const e= {
      ...a,guest:!0
    };
    return ee=e,Ah(e.id),f1(e).then(xr).catch(t=> {
      if(ee===e&&t instanceof Ks&&(t.status===401||Qo(t)))if(hn(),Qo(t))alert(kr(t.body));else return hm()
    })
  }
  return hm()
}
async function hm() {
  if(Mt()||ee)return;
  const a=sh(eh),e=Rh(!1);
  let t;
  try {
    t=await nt("POST","guest", {
      ...Object.keys(a).length? {
        doc:a
      }
      :{},...e? {
        guest:e
      }
      :{}
    })
  }
  catch(s) {
    if(Qo(s))return void alert(kr(s.body));
    ++Zy<=3&&window.setTimeout(()=>void hm(),2e4*Zy);
    return
  }
  if(!ee) {
    for(const s of[...Object.keys(a).map(n=>eh+n),th])Zo(s,null);
    Dl( {
      token:t.token,id:t.id,name:"",guest:!0
    }),ei(t.id,t.rev,t.doc),window.dispatchEvent(new Event("ro-account"))
  }
}
function uL() {
  try {
    if(sessionStorage.getItem("ro-life.visit"))return;
    sessionStorage.setItem("ro-life.visit","1")
  }
  catch{}let a=!1;
  try {
    a=!localStorage.getItem("ro-life.visited"),localStorage.setItem("ro-life.visited","1")
  }
  catch{}const e=new URLSearchParams(location.search);
  let t="";
  try {
    document.referrer&&new URL(document.referrer).host!==location.host&&(t=document.referrer)
  }
  catch{}const n=matchMedia("(display-mode: standalone)").matches?"app":matchMedia("(pointer: coarse)").matches?"mobile":"desktop",o= {
    referrer:t,ref:e.get("ref")??e.get("utm_source")??"",campaign:e.get("utm_campaign")??"",lang:navigator.language,device:n,first:a
  };
  nt("POST","visit",o,!0).catch(()=>{})
}
function Pa() {
  return ee&&!ee.guest? {
    id:ee.id,name:ee.name
  }
  :null
}
function Hl() {
  return!!ee&&!Mt()
}
function ir() {
  return ee&&!ee.guest?ee.token:void 0
}
async function xr() {
  if(!ee)return;
  const a=ee,e=await nt("GET","save");
  ee===a&&(wr=e.trade,e.recovery!==void 0&&(Qn=e.recovery),e.name!==a.name&&!a.guest&&Dl( {
    ...a,name:e.name
  }),e.rev!==dn(a.id).rev&&ei(a.id,e.rev,e.doc))
}
let jr=null,Ef=!1,_r=[];
const pL=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),a=>a.toString(16).padStart(2,"0")).join(""),mL=/^(run|stages-seen)\.v1\./,fL=12e4;
let ev="",Rc={};
function gL(a,e) {
  if(e!==ev) {
    ev=e;
    try {
      Rc=e?JSON.parse(e):{}
    }
    catch {
      Rc={}
    }
  }
  for(const t of new Set([...Object.keys(a),...Object.keys(Rc)]))if(a[t]!==Rc[t]&&!mL.test(t))return!1;
  return!0
}
let Lu=0,Au=0;
function Ma(a=!1,e=!1) {
  if(!ee||Mt()||Ef)return Promise.resolve();
  if(jr)return jr;
  if(zs!=null&&zs.ended&&!a||e&&Date.now()<Au)return Promise.resolve();
  const t=ee,s=sf(),n=JSON.stringify(s),o=dn(t.id);
  if(n===o.sent)return o.claim&&xa(t.id, {
    ...o,claim:void 0
  }),Promise.resolve();
  if(e&&!o.claim&&!o.wipe&&Date.now()-dm<fL&&gL(s,o.sent))return Promise.resolve();
  const i=o.claim,r=o.wipe;
  dm=Date.now();
  const l=pL(),d=_r.slice();
  _r=[..._r,l].slice(-8);
  const h= {
    rev:o.rev,doc:s,wid:l,lite:!0,...d.length? {
      mine:d
    }
    :{},...i? {
      run:i
    }
    :{},...r? {
      wipe:r
    }
    :{}
  };
  return jr=nt("PUT","save",h,a&&n.length<6e4).then(u=> {
    if(ee!==t)return;_r=[],Lu=0,Au=0,u.trade&&(wr=u.trade);const p=dn(t.id);xa(t.id, {
      ...p,rev:u.rev,sent:n,claim:p.claim===i?void 0:p.claim,wipe:void 0
    }),u.doc&&ei(t.id,u.rev,u.doc)
  }).catch(u=> {
    if(ee===t&&(!(u instanceof Ks)||u.status>=500)&&(Lu++,Au=Date.now()+Math.min(6e4,c1*2**(Lu-1))*(.75+Math.random()*.5)),!(!(u instanceof Ks)||ee!==t))if(u.status===409&&(_r=[]),u.status===409) {
      if(!ei(t.id,Number(u.body.rev),u.body.doc))return;bl(u.code==="lost"?c("A la partida de este dispositivo le faltaba parte de tu cuenta, así que no se ha subido. Se ha cargado la del servidor."):c("Tu cuenta se ha usado en otro dispositivo. Se ha cargado su partida más reciente."))
    }
    else u.status===401?(hn(),bl(c("La sesión ha caducado. Vuelve a entrar con tu cuenta."))):Qo(u)&&(hn(),bl(kr(u.body)))
  }).finally(()=>jr=null),jr
}
function bl(a) {
  Ef=!0,alert(a),location.reload()
}
function yL() {
  return Ma()
}
function y1() {
  return xr()
}
let Pu=!1;
function Tf() {
  const a=ee;
  !a||Pu||(Pu=!0,xr().then(()=> {
    ee===a&&(Ef=!0,alert(c("Tu cuenta se ha abierto en otra pestaña. En esta ya no se guarda nada: recárgala si quieres seguir jugando aquí.")))
  }).catch(e=> {
    ee===a&&(e instanceof Ks&&e.status===401?(hn(),bl(c("Has entrado con tu cuenta en otro dispositivo. Vuelve a entrar si quieres jugar aquí."))):Pu=!1)
  }))
}
function vL() {
  const a=ee;
  a&&xr().catch(e=> {
    ee!==a||!Qo(e)||(hn(),bl(kr(e.body)))
  })
}
function Rh(a) {
  try {
    let e=localStorage.getItem(th);
    return!e&&a&&(e=Array.from(crypto.getRandomValues(new Uint8Array(16)),t=>t.toString(16).padStart(2,"0")).join(""),localStorage.setItem(th,e)),e&&/^[0-9a-f] {
      32,64
    }
    $/.test(e)?e:null
  }
  catch {
    return null
  }
}
async function v1(a,e) {
  if(Mt())return;
  const t=ee?null:Rh(!0);
  if(!(!ee&&!t))try {
    ee?await nt("POST","name", {
      char:a,name:e
    }):await nt("POST","guest-name", {
      guest:t,char:a,name:e
    })
  }
  catch(s) {
    if(s instanceof Ks&&s.code==="nameTaken")throw new Error(c("Ese nombre ya lo usa otro jugador."));
    if(ee||s instanceof Ks&&s.code==="offensive")throw new Error(Aa(s))
  }
}
function bL(a) {
  if(ee||Mt())return;
  const e=a.filter(s=>!s.dev).map(s=>( {
    id:s.id,name:s.name
  })),t=Rh(e.length>0);
  t&&nt("POST","guest-names", {
    guest:t,chars:e
  }).catch(()=>{})
}
function b1() {
  return ee&&!ee.guest?wr:null
}
function wL(a,e=!1,t=1,s=0) {
  if(!ee||Mt())return;
  const n=dn(ee.id);
  if(e&&n.run&&(n.runStage??a)===a)return;
  const o=Date.now(),i=ee;
  xa(i.id, {
    ...n,run:void 0,runStage:a
  });
  const r= {
    stage:a,ended:!1
  };
  zs=r;
  const l=d=>nt("POST","run",e&&s>0? {
    stage:a,mult:t,played:Math.round(s+(Date.now()-o)/1e3)
  }
  : {
    stage:a,mult:t
  }).then(h=> {
    if(zs!==r||(zs=null,ee!==i))return;const u=dn(i.id);r.ended?(xa(i.id, {
      ...u,run:void 0,claim:h.run
    }),Ma()):xa(i.id, {
      ...u,run:h.run,runStage:a
    })
  }).catch(()=> {
    zs===r&&(d<8&&ee===i?window.setTimeout(()=>l(d+1),Math.min(6e4,5e3*2**(d-1))):(zs=null,r.ended&&Ma()))
  });
  l(1)
}
async function kL(a,e) {
  if(!ee||Mt())return!0;
  const t=ee;
  try {
    await Ma();
    const s=await nt("POST","run", {
      stage:a,skip:!0,char:e
    });
    return ee!==t?!1:(zs=null,xa(t.id, {
      ...dn(t.id),run:s.run,runStage:a
    }),!0)
  }
  catch {
    return!1
  }
}
let zs=null;
function w1(a) {
  return nt("GET",`endless?char=${encodeURIComponent(a)}`)
}
function xL(a,e) {
  return nt("POST","endless/upgrade", {
    char:a,id:e
  })
}
function ML(a,e) {
  return nt("POST","endless/skills", {
    char:a,skills:e
  })
}
function $L(a,e) {
  return nt("GET",`ladder?season=${encodeURIComponent(a)}&job=${encodeURIComponent(e)}`)
}
function SL(a) {
  if(!ee||Mt())return;
  if(zs&&(!a||zs.stage===a)) {
    zs.ended=!0;
    return
  }
  const e=dn(ee.id);
  e.run&&(!a||!e.runStage||e.runStage===a)?xa(ee.id, {
    ...e,run:void 0,runStage:void 0,claim:e.run
  }):e.run&&xa(ee.id, {
    ...e,run:void 0,runStage:void 0
  })
}
async function nc(a) {
  if(!ee)throw new Error(c("No se pudo conectar con el servidor."));
  const e=ee;
  await Ma();
  try {
    const t=await nt("POST","op",a);
    return ee===e&&(ei(e.id,t.rev,t.doc),wr=t.trade),t
  }
  catch(t) {
    throw t instanceof Ks&&t.code==="nothing"?new Error(c("No hay mejoras que resetear.")):new Error(t instanceof Ks&&t.code==="missing"?c("Ya no tienes lo necesario para hacerlo."):Aa(t))
  }
}
async function EL(a,e) {
  return(await nc( {
    op:"sell",uids:a,cards:e
  })).gained
}
async function TL(a,e) {
  await nc( {
    op:"buy",ore:a,count:e
  })
}
async function CL(a) {
  return(await nc( {
    op:"towerReset",char:a
  })).progress
}
async function LL(a) {
  return(await nc( {
    op:"refine",uid:a
  })).ok
}
async function k1() {
  if(!Hl())return null;
  try {
    return await nt("GET","mail")
  }
  catch {
    return null
  }
}
function AL() {
  Hl()&&nt("POST","mail/read",{}).catch(()=>{})
}
async function PL(a) {
  try {
    return await nt("POST","mail/delete", {
      id:a
    })
  }
  catch(e) {
    throw new Error(Aa(e))
  }
}
async function jL(a) {
  try {
    await nc( {
      op:"mail",id:a
    })
  }
  catch(e) {
    throw e instanceof Error&&e.message===c("Ya no tienes lo necesario para hacerlo.")?new Error(c("Esta carta ya no tiene nada que recoger.")):e
  }
}
let ah=Promise.resolve();
function _L() {
  const a=Sf($f);
  a!=null&&a.token&&Number.isInteger(a.id)&&a.name?(ee=a,Ah(a.id),ah=f1(a).then(xr).catch(e=> {
    e instanceof Ks&&e.status===401?hn():Qo(e)&&(hn(),alert(kr(e.body)))
  })):ah=g1(),window.setInterval(()=> {
    d1()&&Date.now()-dm<rL||Ma(!1,!0)
  },c1),window.addEventListener("pagehide",()=>void Ma(!0)),document.addEventListener("visibilitychange",()=> {
    document.hidden&&Ma(!0)
  })
}
function ju() {
  return ah
}
nT(p1);
async function qL(a,e) {
  await x1("login", {
    name:a,password:e
  })
}
async function x1(a,e) {
  let t;
  try {
    t=await nt("POST",a,e)
  }
  catch(s) {
    throw new Error(Aa(s))
  }
  Dl( {
    token:t.token,id:t.id,name:t.name
  }),Qn=t.recovery??null;
  try {
    await xr()
  }
  catch(s) {
    throw hn(),new Error(Aa(s))
  }
}
async function IL(a,e,t,s) {
  if(ee!=null&&ee.guest&&t) {
    const i=ee;
    await Ma().catch(()=>{});
    let r;
    try {
      r=await nt("POST","register", {
        name:a,password:e,...s? {
          answers:s
        }
        : {
          declined:!0
        }
      })
    }
    catch(l) {
      throw new Error(Aa(l))
    }
    ee===i&&(ee=null),Zo(Ih,null),Dl( {
      token:r.token,id:r.id,name:r.name
    }),ei(r.id,r.rev,r.doc),Qn=r.recovery??null;
    return
  }
  const n=t?sh(eh):{};
  let o;
  try {
    const i=t?Rh(!1):null;
    o=await nt("POST","register", {
      name:a,password:e,doc:n,...i? {
        guest:i
      }
      :{},...s? {
        answers:s
      }
      : {
        declined:!0
      }
    })
  }
  catch(i) {
    throw new Error(Aa(i))
  }
  if(t)for(const i of[...Object.keys(n).map(r=>eh+r),th])Zo(i,null);
  Dl( {
    token:o.token,id:o.id,name:o.name
  }),ei(o.id,o.rev,o.doc),Qn=o.recovery??null
}
async function RL(a,e) {
  try {
    return(await nt("POST","recover/check", {
      name:a,answers:e
    })).ticket
  }
  catch(t) {
    throw new Error(Aa(t))
  }
}
function BL(a,e) {
  return x1("recover", {
    ticket:a,password:e
  })
}
function NL() {
  return ee&&!ee.guest?Qn:null
}
async function OL() {
  try {
    await nt("POST","questions/decline",{})
  }
  catch(a) {
    throw new Error(Aa(a))
  }
  Qn="declined"
}
async function DL(a) {
  try {
    await nt("POST","questions", {
      answers:a
    })
  }
  catch(e) {
    throw new Error(Aa(e))
  }
  Qn="set"
}
async function tv() {
  ee&&(await Ma().catch(()=>{}),nt("POST","logout").catch(()=>{}),hn())
}
const Cf="ro-life.run.v1.";
function HL(a,e) {
  try {
    as.setItem(Lt(Cf+a),JSON.stringify(e))
  }
  catch{}
}
function oc(a) {
  try {
    const e=as.getItem(Lt(Cf+a)),t=e?JSON.parse(e):null;
    return(t==null?void 0:t.v)===1?t:null
  }
  catch {
    return null
  }
}
function Bh(a) {
  try {
    as.removeItem(Lt(Cf+a))
  }
  catch{}
}
function M1(a) {
  return {
    time:a.time,level:a.level,kills:a.kills,bossKills:a.bossKills,mvps:a.mvpsKilled??[],stage:a.stage??"prontera",win:!1,loot:a.runLoot,cards:a.runCards,eggs:a.runEggs??[],baseExp:a.charExp.base,jobExp:a.charExp.job,killsBy:Object.fromEntries(a.killsBy??[])
  }
}
const Lf="ro-life.achievements.v1";
function $1() {
  try {
    const a=as.getItem(Lt(Lf));
    return a?JSON.parse(a):null
  }
  catch {
    return null
  }
}
function ic(a) {
  try {
    as.setItem(Lt(Lf),JSON.stringify(a))
  }
  catch{}
}
const wl=(a,e)=>[...new Set([...a,...e])];
function es() {
  const a=$a().filter(s=>s.id!=="dev"),e=$1(),t= {
    kills:(e==null?void 0:e.kills)??{},totalKills:(e==null?void 0:e.totalKills)??a.reduce((s,n)=>s+n.record.totalKills,0),runs:(e==null?void 0:e.runs)??a.reduce((s,n)=>s+n.record.runs,0),wins:(e==null?void 0:e.wins)??a.reduce((s,n)=>s+n.record.wins,0),stages:(e==null?void 0:e.stages)??[],promotions:(e==null?void 0:e.promotions)??[],jobs:(e==null?void 0:e.jobs)??[],maxLevel:(e==null?void 0:e.maxLevel)??0,maxJobLevel:(e==null?void 0:e.maxJobLevel)??0,perks:(e==null?void 0:e.perks)??{},seen:(e==null?void 0:e.seen)??[],dyes:(e==null?void 0:e.dyes)??[]
  };
  t.stages=wl(t.stages,a.flatMap(s=>s.stagesCleared??[])),t.promotions=wl(t.promotions,a.flatMap(s=>s.promotion?[s.promotion]:[])),t.jobs=wl(t.jobs,a.filter(s=>s.record.runs>0).map(s=>s.job)),t.maxLevel=Math.max(t.maxLevel,...a.map(s=>s.level)),t.maxJobLevel=Math.max(t.maxJobLevel,...a.map(s=>s.jobLevel));
  for(const s of a)for(const n of s.mvpsDefeated??[])t.kills[n]=Math.max(t.kills[n]??0,1);
  return e||ic(t),t
}
function FL(a,e) {
  var s;
  if(a.id==="dev")return;
  const t=es();
  for(const[n,o]of Object.entries(e.killsBy??{}))t.kills[n]=(t.kills[n]??0)+o;
  for(const n of e.mvps??[])(s=e.killsBy)!=null&&s[n]||(t.kills[n]=(t.kills[n]??0)+1);
  t.totalKills+=e.kills,t.runs++,e.win&&t.wins++,t.jobs.includes(a.job)||t.jobs.push(a.job),ic(t)
}
function S1() {
  var a;
  return((a=$1())==null?void 0:a.dyes)??[]
}
function zL(a) {
  const e=es();
  e.dyes=wl(e.dyes??[],[a]),ic(e)
}
function UL() {
  try {
    as.removeItem(Lt(Lf))
  }
  catch{}
}
const E1=[ {
  id:"stages",name:"Stages"
}, {
  id:"jobs",name:"Jobs y niveles"
}, {
  id:"bosses",name:"Jefes"
}, {
  id:"hunt",name:"Caza"
}, {
  id:"pets",name:"Pets"
}, {
  id:"feats",name:"Hazañas"
}
],ts=[];
function ot(a,e,t,s,n,o,i,r) {
  ts.push( {
    id:e,cat:a,name:t,desc:s,vars:r,points:n,goal:o,progress:i
  })
}
const nh=a=> {
  var e;
  return((e=Be[a])==null?void 0:e.name)??a
},um=(...a)=>e=>a.reduce((t,s)=>t+(e.kills[s]??0),0),GL=a=>e=>a.filter(t=>(e.kills[t]??0)>0).length,VL=a=>et[a].bosses.slice(0,-1).map(e=>e.id);
for(const[a,e,t]of[["prontera","Campos de Prontera",2],["sewer","Alcantarillas de Prontera",2],["sunken_story","Historia del Barco hundido",2],["sunken","Barco hundido",3],["byalan","Isla de Byalan",3],["payon","Bosque de Payon",3],["payon_cave","Cueva de Payon",4],["prt_castle","Castillo de Prontera",3]])ot("stages",`clear_${a}`,"{s}","Supera {s} por primera vez.",t,1,s=>Number(s.stages.includes(a)), {
  s:e
});
for(const[a,e]of[["prontera","Campos de Prontera"],["sewer","Alcantarillas de Prontera"],["byalan","Isla de Byalan"],["payon","Bosque de Payon"],["payon_cave","Cueva de Payon"]]) {
  const t=VL(a);
  ot("stages",`minis_${a}`,"Cazajefes: {s}","Vence a todos los mini-jefes de {s} ({list}).",2,t.length,GL(t), {
    s:e,list:t.map(nh).join(", ")
  })
}
const sv=Tt.filter(a=>a.tier==="first").length;
ot("jobs","second_job","Segundo job","Sube a un 2nd job con algún personaje.",3,1,a=>a.promotions.length);
ot("jobs","second_jobs_3","Versátil","Consigue {n} 2nd jobs distintos.",3,3,a=>a.promotions.length, {
  n:3
});
ot("jobs","second_jobs_6","Polivalente","Consigue {n} 2nd jobs distintos.",4,6,a=>a.promotions.length, {
  n:6
});
ot("jobs","second_jobs_all","Maestro de oficios","Consigue los {n} 2nd jobs.",6,As.length,a=>a.promotions.length, {
  n:As.length
});
ot("jobs","first_jobs_3","Curioso","Juega partidas con {n} 1st jobs distintos.",2,3,a=>a.jobs.length, {
  n:3
});
ot("jobs","first_jobs_all","Aprendiz de todo","Juega partidas con los {n} 1st jobs clásicos.",3,sv,a=>a.jobs.filter(e=> {
  var t;return((t=ZM.find(s=>s.id===e))==null?void 0:t.tier)==="first"
}).length, {
  n:sv
});
ot("jobs","job_50","Job al máximo","Llega a Job Lv {n} con algún personaje.",2,50,a=>a.maxJobLevel, {
  n:50
});
ot("jobs","base_30","Aventurero","Llega a Base Lv {n} con algún personaje.",1,30,a=>a.maxLevel, {
  n:30
});
ot("jobs","base_60","Veterano","Llega a Base Lv {n} con algún personaje.",2,60,a=>a.maxLevel, {
  n:60
});
ot("jobs","base_99","Leyenda","Llega a Base Lv {n} con algún personaje.",4,99,a=>a.maxLevel, {
  n:99
});
for(const[a,e]of[["mastering",[[1,1],[10,2],[30,3]]],["golden_thief_bug",[[1,1],[19,3],[50,3]]],["drake",[[1,1],[10,2],[30,3]]],["kraken",[[1,1],[10,2],[30,3]]],["eddga",[[1,1],[10,2],[30,3]]],["moonlight",[[1,1],[10,2],[30,3]]],["high_orc",[[1,1],[5,2]]]])for(const[t,s]of e)t===1?ot("bosses",`mvp_${a}_1`,"Vence a {m}","Vence a {m} por primera vez.",s,1,um(a), {
  m:nh(a)
}):ot("bosses",`mvp_${a}_${t}`,"{m} ×{n}","Vence a {m} {n} veces.",s,t,um(a), {
  m:nh(a),n:t
});
for(const[a,e,t]of[["poring",1e3,1],["thief_bug",500,1],["tarou",1e3,1],["whisper",1e3,1],["hydra",1e3,1],["merman",1e3,1],["smokie",1e3,1],["wolf",1e3,2],["skeleton",1e3,2],["sohee",500,2],["orc_warrior",500,2]])ot("hunt",`hunt_${a}`,"Cazador de {m}","Mata {n} {m}.",t,e,um(a), {
  m:nh(a),n:e
});
const Af=()=>Object.keys(ar().pets).filter(a=>Rt.some(e=>e.id===a)),Ed=Rt.filter(a=>a.from).map(a=>a.id);
for(const[a,e,t,s]of[["1",1,1,"Primer compañero"],["5",5,2,"Criador"],["12",12,3,"Domador"],["all",Rt.length,5,"Zoológico de Rune-Midgard"]])ot("pets",`pets_${a}`,s,e===1?"Consigue un pet.":"Consigue {n} pets distintos.",t,e,()=>Af().length, {
  n:e
});
ot("pets","pets_evolve","Evolución","Evoluciona un pet.",2,1,()=>Af().filter(a=>Ed.includes(a)).length);
ot("pets","pets_evolve_all","Linaje completo","Consigue los {n} pets evolucionados.",3,Ed.length,()=>Af().filter(a=>Ed.includes(a)).length, {
  n:Ed.length
});
ot("pets","pets_loyal","Amigo fiel","Sube un pet a Leal.",1,1,()=>Object.values(ar().pets).filter(a=>a.intimacy>=nf).length);
ot("pets","pets_loyal_5","Manada leal","Ten {n} pets en Leal.",2,5,()=>Object.values(ar().pets).filter(a=>a.intimacy>=nf).length, {
  n:5
});
for(const[a,e,t]of[[1e3,1,"Primera sangre"],[1e4,2,"Exterminador"],[5e4,3,"Azote de monstruos"],[25e4,5,"Plaga de Rune-Midgard"],[1e6,6,"Fin de los tiempos"]])ot("feats",`kills_${a}`,t,"Mata {n} monstruos en total.",e,a,s=>s.totalKills, {
  n:a
});
ot("feats","wins_10","Superviviente","Gana {n} partidas.",1,10,a=>a.wins, {
  n:10
});
ot("feats","wins_50","Invicto","Gana {n} partidas.",3,50,a=>a.wins, {
  n:50
});
ot("feats","runs_100","Incansable","Juega {n} partidas.",2,100,a=>a.runs, {
  n:100
});
ot("feats","runs_500","Obsesión","Juega {n} partidas.",4,500,a=>a.runs, {
  n:500
});
function pm(a) {
  return Math.floor(a).toLocaleString(Ia())
}
function KL(a) {
  const e=Object.fromEntries(Object.entries(a.vars??{}).map(([t,s])=>[t,typeof s=="number"?pm(s):c(s)]));
  return {
    name:c(a.name,e),desc:c(a.desc,e)
  }
}
function rr(a,e) {
  return a.progress(e)>=a.goal
}
function T1(a) {
  return ts.reduce((e,t)=>e+(rr(t,a)?t.points:0),0)
}
function WL(a=es()) {
  return ts.filter(e=>rr(e,a)&&!a.seen.includes(e.id))
}
function YL() {
  const a=es();
  a.seen=wl(a.seen,ts.filter(e=>rr(e,a)).map(e=>e.id)),ic(a)
}
const si=[ {
  id:"reroll",name:"Reroll deck",icon:"reroll",desc:"Cambia las cartas de una subida de nivel o de un cofre por otras nuevas.",cost:[3,4,5,6,7]
}, {
  id:"reroll_card",name:"Reroll card",icon:"reroll_card",desc:"Vuelve a tirar una carta: la misma habilidad con otra mejora, o el mismo hueco del cofre con otra pieza.",cost:[2,3,3,4,4,5,5,6,6,7]
}, {
  id:"banish",name:"Banish",icon:"banish",desc:"Saca una habilidad u objeto de los rolls para el resto de la partida; si ya lo tienes, deja de salir para mejorarlo.",cost:[3,4,6,8]
}, {
  id:"focus",name:"Focus",icon:"focus",desc:"Una habilidad u objeto sale con prioridad en los rolls (×3) el resto de la partida.",cost:[4,7]
}, {
  id:"deity",name:"Deity cambiante",icon:"deity",desc:"Siguen saliendo Deity de otras habilidades después de coger la primera: puedes cambiar de Deity a media partida (se pierden sus refinados).",cost:[8]
}
];
function Fl(a,e) {
  return Math.min(a.perks[e]??0,si.find(t=>t.id===e).cost.length)
}
function XL(a) {
  return si.reduce((e,t)=>e+t.cost.slice(0,Fl(a,t.id)).reduce((s,n)=>s+n,0),0)
}
function mm(a) {
  return T1(a)-XL(a)
}
function JL(a) {
  const e=es(),t=si.find(n=>n.id===a),s=Fl(e,a);
  return s>=t.cost.length||mm(e)<t.cost[s]?!1:(e.perks[a]=s+1,ic(e),!0)
}
function QL() {
  const a=es();
  return Object.fromEntries(si.map(e=>[e.id,Fl(a,e.id)]))
}
const C1=15,Pf="ro-life.characters.v1",Pi="ro-life.account.v1";
function ZL() {
  return {
    bestTime:0,bestLevel:0,bestKills:0,totalKills:0,runs:0,wins:0
  }
}
function e5(a,e) {
  const t={};
  for(const[s,n]of Object.entries(a??{})) {
    const o=Ze[s];
    o&&El(e).includes(o.job)&&n>0&&(t[s]=Math.min(n,o.maxRank))
  }
  return t
}
function t5(a) {
  const e= {
    ...a,job:a.job==="novice"?"swordsman":a.job,level:a.level??1,exp:a.exp??0,jobLevel:a.jobLevel??1,jobExp:a.jobExp??0,talents:e5(a.talents,a.job),stats:s5(a.stats),equipped:a.equipped??{}
  };
  r5(e);
  const t=e.look.cloth;
  t>=4&&t<17&&(e.look= {
    ...e.look,cloth: {
      4:1,5:2,6:3,7:1,8:2
    }
    [t]??0
  });
  const s=e.levelRules??1;
  if(s<2&&e.level>1) {
    const n=e.exp/su(e.level,1);
    e.level=Math.min(Jl,2*e.level-1),e.exp=n*su(e.level,2)
  }
  if(s<3&&(e.jobLevel=Math.max(1,Math.min(Zn(e.job),e$(e.level))),e.jobExp=0),s<4&&(e.exp=Math.floor(e.exp/su(e.level,Math.max(2,s))*Go(e.level)),s===3&&(e.jobExp=Math.floor(e.jobExp/t$(e.jobLevel)*gg(e.jobLevel))),e.levelRules=4),(e.levelRules??1)<5) {
    let n=e.jobExp;
    for(let o=1;o<e.jobLevel;o++)n+=gg(o);
    [e.jobLevel,e.jobExp]=Gl(1,0,n,Ql,Zn(e.job)),e.jobExp=Math.floor(e.jobExp),e.levelRules=5
  }
  return(s$(e.job,e.jobLevel,e.talents)||!a$(e.talents))&&(e.talents={}),e.promotion&&!no(e.job).some(n=>n.id===e.promotion)&&delete e.promotion,Ti(e.level,e.stats)<0&&(e.stats=Wn()),e
}
function s5(a) {
  const e=Wn();
  for(const t of Object.keys(e)) {
    const s=Math.floor(Number(a==null?void 0:a[t]));
    Number.isFinite(s)&&(e[t]=Math.max(Zi,Math.min(mr,s)))
  }
  return e
}
function L1(a) {
  for(const e of Cl[a.job]??Cl[ge(a.job).base??""]??[]) {
    const t=fe[e];
    if(!t)continue;
    const s= {
      ...Hh(e,t.cardSlots),owner:a.id
    };
    a.inventory.push(s);
    const n=bs.find(o=>o.gear===t.slot&&!a.equipped[o.id]);
    n&&(a.equipped[n.id]=s.uid)
  }
  a.starterGiven=!0
}
function A1(a,e) {
  var n;
  if(a.storyWeapon||(n=a.storyWeaponIds)!=null&&n.length)return[];
  const t=ac(e),s=pf(e);
  return(sw[ge(a.job).base??a.job]??[]).map(o=>( {
    id:o,quality:Ll,affixes:Zl(Ll,s,o,a.job),ilvl:t,tier:s
  }))
}
function jf(a,e) {
  (sw[ge(a.job).base??a.job]??[]).includes(e)&&(a.storyWeapon=!0,a.storyWeaponIds=[e])
}
function a5(a,e) {
  const t=A1(a,e)[0];
  return t?(jf(a,t.id),[t]):[]
}
function n5(a,e=!1,t=Wn()) {
  const s= {
    id:"",job:a,inventory:[],equipped:{}
  };
  return e&&L1(s), {
    level:1,exp:0,jobLevel:1,jobExp:0,talents:{},stats: {
      ...t
    },inventory:s.inventory,cards:{},equipped:s.equipped,starterGiven:e,levelRules:5
  }
}
function _f(a,e) {
  return e&&!no(a.job).some(t=>t.id===e)?!1:(e?a.promotion=e:delete a.promotion,ja(a),!0)
}
function lr(a) {
  const e=ge(a.job);
  if(!a.promotion)return e;
  const t=ge(a.promotion);
  return {
    ...e,hp:t.hp,speed:t.speed
  }
}
function o5(a) {
  return ge(a.promotion??a.job)
}
function zl(a) {
  return Ct(o5(a),a.look.gender)
}
function P1(a) {
  return ge(a.job).mount==="peco"&&(a.talents[o$(a.job)]??0)>0
}
function ri(a) {
  const e=a.promotion??a.job;
  return P1(a)?`${e}_peco`:e
}
function i5(a) {
  return new Set(Object.keys(a.talents).filter(e=> {
    var t;return((t=Ze[e])==null?void 0:t.job)===a.job
  }).map(e=>Ze[e].branch))
}
function r5(a) {
  var t;
  if((ge(a.job).rank??1)<2)return void delete a.spec;
  const e=i5(a);
  if(a.spec===void 0&&e.size===1&&(a.spec=[...e][0]),[...e].some(s=>s!==a.spec))for(const s of Object.keys(a.talents))((t=Ze[s])==null?void 0:t.job)===a.job&&Ze[s].branch!==a.spec&&delete a.talents[s]
}
const j1=300;
function l5(a) {
  var e;
  for(const t of Object.keys(a.talents))((e=Ze[t])==null?void 0:e.job)===a.job&&delete a.talents[t];
  delete a.spec,ja(a)
}
function Nh(a) {
  return a.promotion?0:a.jobLevel
}
function Zn(a) {
  return fa[ge(a).rank??1]
}
const _1=new WeakMap;
function q1(a) {
  try {
    const e=as.getItem(a);
    return e?JSON.parse(e):null
  }
  catch {
    return null
  }
}
function qf(a,e) {
  try {
    as.setItem(a,JSON.stringify(e))
  }
  catch{}
}
function un() {
  const a=q1(Lt(Pf));
  return Array.isArray(a)?a.filter(e=>e&&e.id&&e.look):[]
}
function xt() {
  var t;
  const a=q1(Lt(Pi));
  if(a)return {
    inventory:a.inventory??[],cards:a.cards??{},kafra:a.kafra??0,materials:a.materials??{},unlocks:a.unlocks??[]
  };
  const e= {
    inventory:[],cards:{},kafra:0,materials:{},unlocks:[]
  };
  if(Lt(Pi)!==Pi)return e;
  for(const s of un()) {
    for(const n of s.inventory??[])e.inventory.push((t=fe[n.itemId])!=null&&t.starter? {
      ...n,owner:s.id
    }
    :n);
    for(const[n,o]of Object.entries(s.cards??{}))e.cards[Number(n)]=(e.cards[Number(n)]??0)+o
  }
  return qf(Lt(Pi),e),Oh(un()),e
}
function eo(a) {
  qf(Lt(Pi),a)
}
function Ho() {
  return xt().kafra
}
function I1(a) {
  return xt().unlocks.includes(a)
}
function If(a) {
  const e=xt();
  e.kafra=Math.max(0,Math.round(e.kafra+a)),eo(e)
}
function Ul() {
  const a=new Map;
  for(const e of un())for(const t of Object.values(e.equipped??{}))t&&a.set(t,e.name);
  return a
}
function nl(a) {
  const e=new Map;
  for(const t of un())if(t.id!==a.id)for(const s of Object.values(t.equipped??{}))s&&e.set(s,t.name);
  return e
}
function R1(a,e) {
  var t;
  return((t=un().find(s=>s.id!==a.id&&Object.values(s.equipped??{}).includes(e)))==null?void 0:t.name)??null
}
function $a() {
  const a=xt(),e=un().map(t5),t=new Set(a.inventory.map(n=>n.uid));
  let s=!1;
  for(const n of e) {
    if(n.inventory=a.inventory,n.cards=a.cards,_1.set(n,gk()),!n.starterGiven) {
      L1(n);
      for(const r of n.inventory)t.add(r.uid);
      s=!0
    }
    const o=Object.keys(et).find(r=> {
      var l;return et[r].jobWeapon&&((l=n.stagesCleared)==null?void 0:l.includes(r))
    });
    for(const r of o?a5(n,o):[])n.inventory.push( {
      ...Hh(r.id,Mh(r.id,r.quality)),quality:r.quality,affixes:r.affixes,ilvl:r.ilvl,tier:r.tier,isNew:!0
    }),s=!0;
    for(const[r,l]of Object.entries(n.equipped))l&&!t.has(l)&&(delete n.equipped[r],s=!0);
    const i=n.inventory.find(r=>r.uid===n.equipped.weapon);
    n.equipped.shield&&Ji(i&&fe[i.itemId])&&(delete n.equipped.shield,s=!0)
  }
  return c5(a.inventory,e)&&(s=!0),d5(a)&&(s=!0),s&&(eo(a),Oh(e)),e
}
function c5(a,e) {
  var s;
  let t=!1;
  for(const n of a) {
    const o=fe[n.itemId],i=n.quality!==dd||!!((s=n.affixes)!=null&&s.some(d=>d.stat==="skill"));
    if(!o||o.starter||n.tier&&n$(n.affixes)&&i)continue;
    const r=mn(n),l=e.find(d=>Object.values(d.equipped).includes(n.uid))??e[0];
    n.tier=r,n.affixes=Zl(n.quality??0,r,n.itemId,l==null?void 0:l.job),t=!0
  }
  return t
}
function d5(a) {
  let e=!1;
  for(const t of a.inventory) {
    const s=Mh(t.itemId,t.quality??0);
    if(t.cards.length===s)continue;
    const n=t.cards.filter(o=>!!o);
    for(const o of n.splice(s))a.cards[o]=(a.cards[o]??0)+1;
    t.cards=Array.from( {
      length:s
    },(o,i)=>n[i]??null),e=!0
  }
  return e
}
function ze(a) {
  return $a().find(e=>e.id===a)
}
function Oh(a) {
  qf(Lt(Pf),a.map(( {
    inventory:e,cards:t,...s
  })=>s))
}
function ja(a) {
  const e=_1.get(a);
  e===gk()?eo( {
    ...xt(),inventory:a.inventory,cards:a.cards
  }):e!==void 0&&console.warn("upsertCharacter: inventario de antes del último guardado del servidor, no se escribe");
  const t=un().filter(s=>s.id!==a.id);
  t.push(a),Oh(t)
}
function h5(a) {
  const e=xt();
  e.inventory=e.inventory.filter(t=>t.owner!==a),eo(e),Oh(un().filter(t=>t.id!==a))
}
function u5() {
  hL(),UL(),rT();
  for(const a of un())Bh(a.id);
  try {
    as.removeItem(Lt(Pf)),as.removeItem(Lt(Pi))
  }
  catch{}
}
function Gl(a,e,t,s,n) {
  for(e+=t;a<n&&e>=s(a);)e-=s(a),a++;
  return[a,a>=n?0:e]
}