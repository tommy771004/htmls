/**
 * ============================================================================
 * RO Life Source Module: 01-assets-and-audio.js
 * Description: Asset Manager (`JR`/`xt`), SpriteSheet Parser (`P_`), Settings (`Tt`), and WebAudio Engine (`ez`/`ce`)
 * ============================================================================
 */

var T_= {
  commit:"7967a1a"
};
const js="assets/",VR=/^(ui|npc|chest)_/,WR=/^fx_/,Cg=new Es( {
  width:1,height:1,label:"sheet-pending"
}),$R=a=>a===Cg,Yc=Object.assign(document.createElement("canvas"), {
  width:1,height:1
}),hp=new WeakMap,hr=new Set,vm=new Map,_m=a=>hp.has(a),Xc=a=>hr.has(a),YR=()=>[...hr];
function Q2(a) {
  if(!hp.has(a)||hr.has(a)||vm.has(a))return;
  const e=a.resource;
  a.resource=Yc,hr.add(a),typeof ImageBitmap<"u"&&e instanceof ImageBitmap&&e.close()
}
function XR(a) {
  const e=hp.get(a);
  if(!e||!hr.has(a))return Promise.resolve();
  let t=vm.get(a);
  return t||(t=fetch(e).then(n=>n.blob()).then(n=>createImageBitmap(n)).then(n=> {
    if(!hr.has(a)||a.destroyed)return n.close();a.resource=n,hr.delete(a)
  }).finally(()=>vm.delete(a)),vm.set(a,t)),t
}
function Tg(a) {
  const e=Vs.cache.has(a)?Vs.get(a):null;
  e&&hr.delete(e.source);
  const t=e==null?void 0:e.source.resource,n=Vs.unload(a).then(()=> {
    typeof ImageBitmap<"u"&&t instanceof ImageBitmap&&t.close(),bm.get(a)===n&&bm.delete(a)
  });
  bm.set(a,n)
}
const bm=new Map;
let xm=null;
function EV(a) {
  xm=a
}
function Z2(a) {
  let e=0;
  const t=[];
  return n=>new Promise(s=> {
    e<a?(e++,s()):t.push(s)
  }).then(n).finally(()=> {
    const s=t.shift();s?s():e--
  })
}
const KR=Z2(4);
function Ur(a,e=!1) {
  const t=bm.get(a),n=t?t.then(()=>Vs.load(a)):Vs.load(a);
  return e?n.then(s=>(hp.set(s.source,a),s)):n
}
class P_ {
  constructor(e,t,n) {
    x(this,"id");
    x(this,"actions",{});
    x(this,"url");
    x(this,"frames");
    x(this,"loading",null);
    x(this,"loaded");
    this.id=e;
    let s=Cg;
    typeof t=="string"?this.url=t:(t.source.scaleMode="nearest",s=t.source),this.loaded=!this.url;
    const o=this.frames=n.frames.map(([r,i,l,d,c,u,h=1,m=0])=>new qt( {
      source:s,frame:new sn(r,i,l,d),orig:new sn(0,0,l*h,d*h),rotate:m?ba.MIRROR_HORIZONTAL:0,defaultAnchor: {
        x:c/l,y:u/d
      }
    }));
    for(const[r,i]of Object.entries(n.actions)) {
      const l={};
      for(const[d,c]of Object.entries(i.sounds))l[Number(d)]=c;
      this.actions[r]= {
        delay:Math.max(30,i.delay),dirs:i.dirs.map(d=>d.map(c=>o[c])),sounds:l
      }
    }
  }
  load() {
    if(this.loaded||!this.url)return Promise.resolve();
    const e=this.url;
    return this.loading||xm==null||xm(this.id),this.loading??(this.loading=KR(()=>Ur(e,!WR.test(this.id))).then(t=> {
      t.source.scaleMode="nearest";for(const n of this.frames)n.source=t.source,n.updateUvs();this.loaded=!0
    },t=> {
      this.loading=null,console.warn(t)
    })),this.loading
  }
  get lazySource() {
    var e;
    return this.url&&this.loaded?((e=this.frames[0])==null?void 0:e.source)??null:null
  }
  get pixels() {
    var t;
    if(this.url&&!this.loaded)return 0;
    const e=(t=this.frames[0])==null?void 0:t.source;
    return e&&!hr.has(e)?e.pixelWidth*e.pixelHeight:0
  }
  unload() {
    if(!(!this.url||!this.loaded)) {
      for(const e of this.frames)e.source=Cg,e.updateUvs();
      this.loaded=!1,this.loading=null,Tg(this.url)
    }
  }
  action(e) {
    return this.actions[e]??this.actions.idle??Object.values(this.actions)[0]
  }
}
class JR {
  constructor() {
    x(this,"manifest");
    x(this,"sheets",new Map);
    x(this,"icons",new Map);
    x(this,"iconTextures",new Map);
    x(this,"itemTextures",new Map);
    x(this,"sounds",new Map);
    x(this,"bgm",new Map);
    x(this,"maps",new Map);
    x(this,"strs",new Map);
    x(this,"fxTextures",new Map);
    x(this,"mapLoads",new Map);
    x(this,"mapUrls",new Map)
  }
  str(e) {
    const t=this.strs.get(e);
    if(t) {
      if(!t.data.ready&&!t.loading) {
        const n=t.urls;
        t.loading=Promise.all(n.map(s=>Promise.all(s.map(o=>Ur(o))))).then(s=> {
          s.forEach((o,r)=>t.data.layers[r].tex=o),t.data.ready=!0
        }).catch(s=>console.warn(s)).finally(()=> {
          t.data.ready||(t.loading=null)
        })
      }
      return t.data
    }
  }
  async load(e) {
    const t=typeof T_>"u"?"":`?v=${T_.commit}`;
    this.manifest=await(await fetch(`${js}manifest.json${t}`)).json();
    const n=this.manifest;
    for(const[u,h]of Object.entries(n.icons))this.icons.set(u,js+h);
    for(const[u,h]of Object.entries(n.sounds))this.sounds.set(u,js+h);
    for(const[u,h]of Object.entries(n.bgm))this.bgm.set(u,js+h);
    const s=Object.entries(n.items??{}),o=Object.entries(n.str??{}),r=Object.entries(n.fxTextures??{}),i=Object.keys(n.sprites),l=this.icons.size+s.length+o.length+r.length+i.length;
    let d=0;
    const c=()=>e==null?void 0:e(Math.min(1,++d/l));
    await Promise.all([...[...this.icons].map(async([u,h])=> {
      const m=await Vs.load(h);m.source.scaleMode="nearest",this.iconTextures.set(u,m),c()
    }),...s.map(async([u,h])=> {
      const m=await Vs.load(js+h.icon);m.source.scaleMode="nearest",this.itemTextures.set(Number(u),m),c()
    }),...o.map(async([u,h])=> {
      const m=js+h,p=m.slice(0,m.lastIndexOf("/")+1),g=await(await fetch(m)).json(),y=g.layers.map(f=>( {
        keys:f.keys,frames:f.tex.length,tex:[]
      }));this.strs.set(u, {
        data: {
          fps:g.fps,layers:y,ready:!1
        },urls:g.layers.map(f=>f.tex.map(v=>p+v)),loading:null
      }),c()
    }),...r.map(async([u,h])=> {
      this.fxTextures.set(u,await Vs.load(js+h)),c()
    }),...i.map(async u=> {
      const h=js+n.sprites[u],m=await(await fetch(h)).json(),p=h.slice(0,h.lastIndexOf("/")+1);VR.test(u)?this.sheets.set(u,new P_(u,await Vs.load(p+m.image),m)):this.sheets.set(u,new P_(u,p+m.image,m)),c()
    })])
  }
  loadMap(e) {
    let t=this.mapLoads.get(e);
    return t||(t=this.fetchMap(e),this.mapLoads.set(e,t),t.catch(()=>this.mapLoads.delete(e)),t)
  }
  async mapFiles(e,t) {
    var d,c,u;
    const n=this.manifest.maps[e];
    if(!n||this.mapLoads.has(e))return[];
    const s=new URL(js+n,location.href).href,o=s.slice(0,s.lastIndexOf("/")+1),r=h=>fetch(h, {
      signal:t,priority:"low"
    }),i=await(await r(s)).json(),l=[i.atlas,i.shadow,i.light,i.cells,i.heights,i.walls,i.minimap,(d=i.collision)==null?void 0:d.file,(c=i.altitude)==null?void 0:c.file];
    for(const h of i.themes??[])l.push(h.cells);
    if(i.models) {
      const h=await(await r(o+i.models)).json();
      l.push("models.bin",...h.textures,...Array.from( {
        length:((u=h.water)==null?void 0:u.frames)??0
      },(m,p)=>`water/w${p}.jpg`));
      for(const[m,p]of Object.entries(h.themeWater??{}))l.push(...Array.from( {
        length:p.frames
      },(g,y)=>`water_${m}/w${y}.jpg`))
    }
    return i.ambient&&l.push(...(await(await r(o+i.ambient)).json()).files),l.filter(h=>!!h).map(h=>o+h)
  }
  async warmMap(e,t) {
    for(const n of await this.mapFiles(e,t))await(await fetch(n, {
      signal:t,priority:"low"
    })).arrayBuffer()
  }
  async fetchMap(e) {
    var n;
    const t=this.manifest.maps[e];
    if(!t)throw new Error(`Mapa no extraído: ${e}`);
     {
      const s=js+t,o=s.slice(0,s.lastIndexOf("/")+1),r=await(await fetch(s)).json(),[i,l,d,c,u,h]=await Promise.all([Ur(o+r.atlas,!0),Ur(o+r.shadow,!0),Ur(o+r.light,!0),fetch(o+r.cells).then(f=>f.arrayBuffer()),fetch(o+r.heights).then(f=>f.arrayBuffer()),fetch(o+r.walls).then(f=>f.arrayBuffer())]),m=[o+r.atlas,o+r.shadow,o+r.light];
      let p=null;
      if(r.models) {
        const f=await(await fetch(o+r.models)).json(),[v,b]=await Promise.all([fetch(o+"models.bin").then(k=>k.arrayBuffer()),Promise.all(f.textures.map(k=>Ur(o+k,!0)))]),_=((n=f.water)==null?void 0:n.frames)??0,S=await Promise.all(Array.from( {
          length:_
        },(k,C)=>Ur(`${o}water/w${C}.jpg`,!0)));
        let M;
        if(f.themeWater) {
          M={};
          for(const[k,C]of Object.entries(f.themeWater)) {
            const A=Array.from( {
              length:C.frames
            },(w,T)=>`${o}water_${k}/w${T}.jpg`);
            M[k]= {
              ...C,frames:await Promise.all(A.map(w=>Ur(w,!0)))
            },m.push(...A)
          }
        }
        p= {
          ...f,textures:b,waterTextures:S,themeWater:M,data:new Float32Array(v)
        },m.push(...f.textures.map(k=>o+k),...Array.from( {
          length:_
        },(k,C)=>`${o}water/w${C}.jpg`))
      }
      let g=null;
      if(r.ambient) {
        const f=await(await fetch(o+r.ambient)).json();
        g= {
          ids:f.files.map((b,_)=> {
            const S=`amb_${e}_${_}`;return this.sounds.set(S,o+b),S
          }),emitters:f.emitters
        }
      }
      const y=await Promise.all((r.themes??[]).map(async f=>( {
        id:f.id,cells:new Float32Array(await(await fetch(o+f.cells)).arrayBuffer())
      })));
      return this.maps.set(e, {
        themes:y,ambient:g,minimap:r.minimap?o+r.minimap:null,walk:r.collision? {
          w:r.collision.w,h:r.collision.h,mask:new Uint8Array(await(await fetch(o+r.collision.file)).arrayBuffer())
        }
        :null,altitude:r.altitude? {
          w:r.altitude.w,h:r.altitude.h,heights:new Float32Array(await(await fetch(o+r.altitude.file)).arrayBuffer())
        }
        :null,warps:r.warps??[],start:r.start??null,fires:r.fires??[],models:p,name:e,width:r.width,height:r.height,lightmapCell:r.lightmapCell,atlas:i,shadow:l,light:d,cells:new Float32Array(c),heights:new Float32Array(u),walls:new Float32Array(h),zoom:r.zoom??10,effects:r.effects??[]
      }),this.mapUrls.set(e,m),this.maps.get(e)
    }
  }
  sheet(e) {
    const t=this.sheets.get(e);
    if(!t)throw new Error(`Sprite no extraído: ${e}`);
    return t.loaded||t.load(),t
  }
  sheetInfo(e) {
    return this.sheets.get(e)
  }
  loadSheets(e) {
    const t=[];
    for(const n of e) {
      const s=this.sheets.get(n);
      s&&!s.loaded&&t.push(s.load())
    }
    return Promise.all(t).then(()=>{})
  }
  parkMap(e) {
    var s,o,r;
    const t=this.maps.get(e);
    if(!t)return;
    const n=[t.atlas,t.shadow,t.light,...((s=t.models)==null?void 0:s.textures)??[],...((o=t.models)==null?void 0:o.waterTextures)??[]];
    for(const i of Object.values(((r=t.models)==null?void 0:r.themeWater)??{}))n.push(...i.frames);
    for(const i of n)Q2(i.source)
  }
  releaseScene(e) {
    for(const t of this.sheets.values())t.unload();
    for(const t of this.strs.values())if(t.data.ready) {
      t.data.ready=!1,t.loading=null;
      for(const n of t.data.layers)n.tex=[];
      for(const n of t.urls.flat())Tg(n)
    }
    for(const[t,n]of this.mapUrls)if(!e.includes(t)&&this.maps.has(t)) {
      for(const s of n)Tg(s);
      this.maps.delete(t),this.mapLoads.delete(t),this.mapUrls.delete(t)
    }
  }
}
const xt=new JR;
function R_(a) {
  var e,t;
  return((t=(e=xt.manifest.items)==null?void 0:e[a])==null?void 0:t.name)??"#"+a
}
function CV(a,e) {
  return e?`${R_(a)} ${e}`:R_(a)
}
function TV(a) {
  var e,t;
  return js+(((t=(e=xt.manifest.items)==null?void 0:e[a])==null?void 0:t.icon)??"")
}
function PV(a) {
  var t,n;
  const e=(n=(t=xt.manifest.items)==null?void 0:t[a])==null?void 0:n.art;
  return e?js+e:null
}
function RV(a) {
  var e,t;
  return((t=(e=xt.manifest.cards)==null?void 0:e[a])==null?void 0:t.name)??"#"+a
}
function zV(a) {
  var e,t;
  return js+(((t=(e=xt.manifest.cards)==null?void 0:e[a])==null?void 0:t.image)??"")
}
const eS="ro-life:settings";
var RM,zM;
const Pg= {
  master:1,music:1,sfx:1,ambient:1,ui:1,muted:!1,muteHidden:!0,lang:(RM=navigator.language)!=null&&RM.toLowerCase().startsWith("es")?"es":(zM=navigator.language)!=null&&zM.toLowerCase().startsWith("zh")?"zh-TW":"en",uiScale:0,damageNumbers:!0,straightNumbers:!1,screenShake:!0,autoPause:!0,fxOpacity:1,fxQuality:"high",resolution:"high",profanityFilter:!0,chatLocal:!0,chatGeneral:!0,chatTrade:!0,chatCn:!1
};
function QR() {
  try {
    const a=localStorage.getItem(eS);
    if(a)return {
      ...Pg,...JSON.parse(a)
    }
  }
  catch{}return {
    ...Pg
  }
}
const Tt=QR(),Hm=new Set;
let Gs=null;
function LV(a) {
  return Gs&&(a==="fxQuality"||a==="resolution")?Gs[a]:Tt[a]
}
function DV(a) {
  if(a!==!!Gs) {
    if(a) {
      if(Gs= {
        fxQuality:Tt.fxQuality,resolution:Tt.resolution
      },Gs.fxQuality==="low"&&Gs.resolution==="low")return;
      Object.assign(Tt, {
        fxQuality:"low",resolution:"low"
      })
    }
    else {
      const e=Gs;
      if(Gs=null,Tt.fxQuality===e.fxQuality&&Tt.resolution===e.resolution)return;
      Object.assign(Tt,e)
    }
    for(const e of Hm)e(Tt)
  }
}
function tS(a) {
  Object.assign(Tt,a),Gs&&(a.fxQuality&&(Gs.fxQuality=a.fxQuality),a.resolution&&(Gs.resolution=a.resolution));
  try {
    localStorage.setItem(eS,JSON.stringify(Gs? {
      ...Tt,...Gs
    }
    :Tt))
  }
  catch{}for(const e of Hm)e(Tt)
}
function pv(a) {
  return Hm.add(a),a(Tt),()=>Hm.delete(a)
}
function FV(a) {
  const e={};
  for(const t of a)e[t]=Pg[t];
  tS(e)
}
const z_= {
  sfx:.6,ambient:.6,ui:.6,music:.35
},ZR=22050;
class ez {
  constructor() {
    x(this,"ctx",null);
    x(this,"buffers",new Map);
    x(this,"loading",new Map);
    x(this,"voices",new Map);
    x(this,"bgmEl",null);
    x(this,"master",null);
    x(this,"channels",new Map);
    x(this,"hiddenMute",!1);
    x(this,"urlMute",!1);
    x(this,"hush",!1);
    pv(()=>this.applyVolumes()),document.addEventListener("visibilitychange",()=> {
      this.hiddenMute=document.hidden&&Tt.muteHidden,this.applyVolumes()
    })
  }
  get muted() {
    return Tt.muted
  }
  silent() {
    return Tt.muted||this.hiddenMute||this.urlMute||this.hush
  }
  applyVolumes() {
    this.master&&this.ctx&&this.master.gain.setTargetAtTime(this.silent()?0:Tt.master,this.ctx.currentTime,.03);
    for(const[e,t]of this.channels)t.gain.value=z_[e]*Tt[e];
    this.bgmEl&&(this.bgmEl.volume=this.silent()?0:Math.min(1,z_.music*Tt.music*Tt.master))
  }
  unlock() {
    if(!this.ctx) {
      try {
        this.ctx=new AudioContext( {
          sampleRate:ZR
        })
      }
      catch {
        this.ctx=new AudioContext
      }
      this.master=this.ctx.createGain(),this.master.connect(this.ctx.destination);
      for(const n of["sfx","ambient","ui"]) {
        const s=this.ctx.createGain();
        s.connect(this.master),this.channels.set(n,s)
      }
      this.applyVolumes();
      const e=[...xt.sounds.keys()],t=()=> {
        const n=e.shift();
        return n===void 0?Promise.resolve():this.loadBuffer(n).then(t)
      };
      t(),t()
    }
    this.ctx.state==="suspended"&&this.ctx.resume()
  }
  memory() {
    let e=0;
    for(const n of this.buffers.values())e+=n.length*n.numberOfChannels*4;
    let t=0;
    for(const n of this.voices.values())t+=n;
    return {
      mb:Math.round(e/1e6),playing:t
    }
  }
  loadBuffer(e) {
    const t=this.loading.get(e);
    if(t)return t;
    const n=xt.sounds.get(e);
    if(!n||!this.ctx)return Promise.resolve(null);
    const s=this.ctx,o=fetch(n).then(r=>r.arrayBuffer()).then(r=>s.decodeAudioData(r)).then(r=>(this.buffers.set(e,r),r)).catch(()=>null);
    return this.loading.set(e,o),o
  }
  play(e,t=1,n=4,s="sfx") {
    this.playAt(e,t,0,n,s)
  }
  ui(e,t=1) {
    this.playAt(e,t,0,2,"ui")
  }
  tick() {
    const e=this.channels.get("ui");
    if(this.silent()||!this.ctx||!e||Tt.ui<=0)return;
    const t=this.ctx.currentTime,n=this.ctx.createOscillator();
    n.type="sine",n.frequency.setValueAtTime(820,t),n.frequency.exponentialRampToValueAtTime(520,t+.04);
    const s=this.ctx.createGain();
    s.gain.setValueAtTime(1e-4,t),s.gain.exponentialRampToValueAtTime(.12,t+.002),s.gain.exponentialRampToValueAtTime(1e-4,t+.045),n.connect(s),s.connect(e),n.start(t),n.stop(t+.06)
  }
  playAt(e,t=1,n=0,s=4,o="sfx") {
    const r=this.channels.get(o);
    if(this.silent()||!this.ctx||!r||Tt[o]<=0)return;
    const i=this.buffers.get(e);
    if(!i) {
      this.loadBuffer(e);
      return
    }
    const l=this.voices.get(e)??0;
    if(l>=s)return;
    this.voices.set(e,l+1);
    const d=this.ctx.createBufferSource();
    d.buffer=i;
    const c=this.ctx.createGain();
    if(c.gain.value=t,n!==0&&this.ctx.createStereoPanner) {
      const u=this.ctx.createStereoPanner();
      u.pan.value=n,d.connect(c).connect(u).connect(r)
    }
    else d.connect(c).connect(r);
    d.onended=()=>this.voices.set(e,(this.voices.get(e)??1)-1),d.start()
  }
  loop(e) {
    const t=this.channels.get("ambient");
    if(!this.ctx||!t)return null;
    const n=this.buffers.get(e);
    if(!n)return this.loadBuffer(e),null;
    const s=this.ctx.createBufferSource();
    s.buffer=n,s.loop=!0;
    const o=this.ctx.createGain();
    o.gain.value=0,s.connect(o).connect(t),s.start();
    const r=this.ctx;
    return {
      setVolume:i=>o.gain.setTargetAtTime(i,r.currentTime,.3),stop:()=> {
        try {
          s.stop()
        }
        catch{}o.disconnect()
      }
    }
  }
  music(e) {
    var s;
    const t=xt.bgm.get(e);
    if(!t)return;
    if(this.bgmEl&&this.bgmEl.dataset.id===e) {
      this.bgmEl.paused&&this.bgmEl.play().catch(()=>{});
      return
    }
    (s=this.bgmEl)==null||s.pause();
    const n=new Audio(t);
    n.dataset.id=e,n.loop=!0,this.bgmEl=n,this.applyVolumes(),n.play().catch(()=>{})
  }
  toggleMute() {
    if(this.urlMute) {
      this.urlMute=!1,this.applyVolumes();
      return
    }
    tS( {
      muted:!Tt.muted
    })
  }
}
const ce=new ez,tz='button, .ro-btn, [role="tab"], input[type="checkbox"], input[type="radio"], select',az="#touch-ui, #skillbar, [data-nosound]";
document.addEventListener("click",a=> {
  var t,n;const e=(n=(t=a.target)==null?void 0:t.closest)==null?void 0:n.call(t,tz);!e||e.closest(az)||e.disabled||ce.tick()
},!0);
const ra=64;
