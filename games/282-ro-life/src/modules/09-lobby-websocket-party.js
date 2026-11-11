/**
 * ============================================================================
 * RO Life Source Module: 09-lobby-websocket-party.js
 * Description: Prontera Online Plaza (`class C3`), WebSocket Protocol v15 Client (`class Xj`), Party Co-op (`class e3`/`t3`/`a3`/`e_`), Chat (`class h3`), Friends (`class u3`), Trading (`class v3`), Replays (`class c_`), and Mailbox
 * ============================================================================
 */

function Hj(a) {
  const e=es(),t=new Set(ts.filter(y=>rr(y,e)&&!e.seen.includes(y.id)).map(y=>y.id));
  YL();
  let s="perks",n="all",o="";
  const i=()=> {
    const y=es();
    za("chr-points").innerHTML=`${c("Puntos de hazaña")}: <b>${mm(y)}</b> <small>/ ${T1(y)}</small>`
  },r=(y,w,m)=> {
    const f=Fl(w,y.id),v=y.cost.length,x=f<v?y.cost[f]:0,k=Array.from( {
      length:v
    },(P,q)=>`<i class="${q<f?"on":""}"></i>`).join(""),M=f>=v?`<span class="chr-maxed">${c("Completa")}</span>`:`<button class="ro-btn small${m>=x?" primary":""}" data-perk="${y.id}"${m>=x?"":" disabled"}>${c("Mejorar")} · ${x}</button>`,$=v>1?c("{n}/{max} usos por partida", {
      n:f,max:v
    }):c(f?"Desbloqueada":"Sin desbloquear");
    return`<div class="chr-perk"><div class="chr-info"><b>${c(y.name)}</b><small>${c(y.desc)}</small><div class="chr-pips">${k}<span>${$}</span></div></div>${M}</div>`
  },l=()=> {
    const y=es(),w=mm(y);
    za("chr-perks").innerHTML=`<div class="chr-list">${si.map(m=>r(m,y,w)).join("")}</div><div class="info-panel">${o||`<span class="muted">$ {
      c("Cada rango es un uso más por partida. Los usos se ven como botones en las cartas al subir de nivel.")
    }
    </span>`}</div>`,za("chr-perks").querySelectorAll("[data-perk]").forEach(m=> {
      m.onclick=()=> {
        const f=si.find(v=>v.id===m.dataset.perk);JL(f.id)&&(B.ui("ef_blessing",.5),o=c("¡{name} mejorada! Ahora tienes {r}/{max}.", {
          name:`<b>${c(f.name)}</b>`,r:Fl(es(),f.id),max:f.cost.length
        }),i(),l())
      }
    })
  },d=()=> {
    const y=es(),w=ts.filter(M=>n==="all"||M.cat===n),m=new Set(ts.filter(M=>rr(M,y)).map(M=>M.id)),f=M=>ts.filter($=>(M==="all"||$.cat===M)&&m.has($.id)).length,v=M=>ts.filter($=>M==="all"||$.cat===M).length;
    za("chr-filters").innerHTML=[ {
      id:"all",name:"Todos"
    },...E1].map(M=>`<button class="inv-chip${M.id===n?" active":""}" data-cat="${M.id}">${c(M.name)} <small>${f(M.id)}/${v(M.id)}</small></button>`).join(""),za("chr-filters").querySelectorAll("[data-cat]").forEach(M=> {
      M.onclick=()=> {
        n=M.dataset.cat,d()
      }
    });
    const x=(M,$)=>t.has(M)?0:$?2:1,k=w.map(M=>( {
      a:M,p:Math.min(M.goal,M.progress(y)),done:m.has(M.id)
    })).sort((M,$)=>x(M.a.id,M.done)-x($.a.id,$.done)||(M.done?0:$.p/$.a.goal-M.p/M.a.goal)).map(( {
      a:M,p:$,done:P
    })=> {
      const {
        name:q,desc:R
      }
      =KL(M),L=Math.round($/M.goal*100),j=M.goal>1?`<div class="chr-bar"><span style="width:${L}%"></span><em>${pm($)} / ${pm(M.goal)}</em></div>`:"";return`<div class="chr-ach${P?" done":""}">
          <span class="chr-check">${P?"✓":""}</span>
          <div class="chr-info"><b>${q}${t.has(M.id)?` <span class="chr-new">$ {
        c("¡Nuevo!")
      }
      </span>`:""}</b><small>${R}</small>${j}</div>
          <span class="chr-pts">+${M.points}</span>
        </div>`
    }).join("");
    za("chr-log").innerHTML=k
  },h=y=> {
    s=y,document.querySelectorAll("#chronicle .tab-btn").forEach(w=>w.classList.toggle("active",w.dataset.chr===s)),za("chr-perks").classList.toggle("hidden",s!=="perks"),za("chr-log-tab").classList.toggle("hidden",s!=="log"),s==="perks"?l():d()
  };
  document.querySelectorAll("#chronicle .tab-btn").forEach(y=>y.onclick=()=>h(y.dataset.chr));
  const u=()=> {
    window.removeEventListener("keydown",p),de("chronicle"),a()
  },p=y=> {
    y.key==="Escape"&&u()
  };
  window.addEventListener("keydown",p),za("chr-close").onclick=u,i(),h(t.size?"log":"perks"),Ue("chronicle")
}
new Set(As.map(a=>a.id));
const Df=15,Fj=10,zj=5,Uj=400,ph=["Asgard","Midgard","Alfheim","Vanaheim","Jotunheim","Nidavellir","Svartalfheim","Niflheim","Muspelheim"],sp=25,ux=120,Gj=40,Vj=98,px=256,Hf=4e3,Kj=4001,Ff=4003,mx=4004,zf=4005,$0=3,S0=10,fx="ro-life.lobby";
let Uf=0;
function E0() {
  try {
    return Math.max(0,Math.floor(Number(localStorage.getItem(fx))))||0
  }
  catch {
    return 0
  }
}
const Ld=()=>Uf,Gf=()=>Uf||1,Ua=(a=Gf())=>ph[a-1]?c(ph[a-1]):`Lobby ${a}`;
function Wj(a) {
  Uf=a;
  try {
    localStorage.setItem(fx,String(a))
  }
  catch{}
}
let gx=0;
const T0=()=>gx;
function ed(a) {
  gx=a
}
let Vr=null;
async function C0(a=5e3) {
  if(Vr&&Date.now()-Vr.at<a)return Vr.list;
  const e=new AbortController,t=window.setTimeout(()=>e.abort(),4e3);
  try {
    const s=await fetch(`${h1()}lobbies`, {
      signal:e.signal,cache:"no-store"
    });
    if(!s.ok)return null;
    const n=await s.json();
    return Array.isArray(n.lobbies)?(Vr= {
      at:Date.now(),list:n.lobbies
    },Vr.list):null
  }
  catch {
    return null
  }
  finally {
    clearTimeout(t)
  }
}
function Ui(a=Gf()) {
  const e=new URL("ws",document.baseURI);
  return e.searchParams.set("l",String(a)),e.href.replace(/^http/,"ws")
}
function Yj(a=Gf()) {
  const e=new URL("ws-run",document.baseURI);
  return e.searchParams.set("l",String(a)),e.href.replace(/^http/,"ws")
}
function yx() {
  const a="ro-life.lobby-key";
  try {
    let e=sessionStorage.getItem(a);
    return e||(e=[...crypto.getRandomValues(new Uint8Array(18))].map(s=>"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[s%62]).join(""),sessionStorage.setItem(a,e)),e
  }
  catch {
    return""
  }
}
const Mm=(a,e,t=!1)=>Math.round(Math.atan2(e,a)/(Math.PI*2)*256)&255|(t?px:0),L0=a=>[Math.cos((a&255)/256*Math.PI*2),Math.sin((a&255)/256*Math.PI*2)];
class Xj {
  constructor(e,t,s=Ld()) {
    g(this,"ws",null);
    g(this,"retryMs",1e3);
    g(this,"timer",0);
    g(this,"closed",!1);
    g(this,"url","");
    g(this,"lobbyId");
    g(this,"ended",!1);
    g(this,"hello");
    g(this,"on");
    g(this,"joined",!1);
    this.lobbyId=s;
    const n=yx();
    this.hello=()=> {
      const o=ir(),i=or();
      return {
        t:"hello",v:Df,...e(),cn:Te.chatCn,tf:!0,q:!0,lb:!0,lang:Te.lang,...n? {
          key:n
        }
        :{},...o? {
          token:o
        }
        :{},...i? {
          mkey:i
        }
        :{}
      }
    },this.on=t,this.lobbyId&&this.connect()
  }
  get online() {
    var e;
    return this.joined&&((e=this.ws)==null?void 0:e.readyState)===WebSocket.OPEN
  }
  get lobby() {
    return this.lobbyId
  }
  switchLobby(e) {
    if(this.ended||e===this.lobbyId&&!this.closed&&this.ws)return;
    this.closed=!1,this.lobbyId=e;
    const t=this.ws;
    this.ws=null,this.joined=!1,t==null||t.close(1e3,"lobby"),clearTimeout(this.timer),this.retryMs=1e3,this.connect()
  }
  connect() {
    if(this.closed)return;
    this.on.status("connecting"),this.url=Ui(this.lobbyId);
    let e;
    try {
      e=new WebSocket(this.url)
    }
    catch {
      return this.retry()
    }
    this.ws=e,e.onopen=()=> {
      e.send(JSON.stringify(this.hello()))
    },e.onmessage=t=> {
      var n,o;
      let s;
      try {
        s=JSON.parse(t.data)
      }
      catch {
        return
      }
      if(s.t==="status")return Jo(s.s);
      switch(s.t) {
        case"welcome":this.retryMs=1e3,this.joined=!0,Wj(this.lobbyId),this.on.welcome(s.id,s.players,!!s.gm),this.on.status("online",s.channel);
        break;
        case"join":this.on.join(s.p);
        break;
        case"leave":this.on.leave(s.id);
        break;
        case"moves":this.on.moves(s.m);
        break;
        case"look":this.on.look(s.id,s.look);
        break;
        case"chat":this.on.chat(s);
        break;
        case"whisper":this.on.whisper(s);
        break;
        case"whisperErr":this.on.whisperErr(s.name);
        break;
        case"friends":this.on.friends(s.list,s.asks);
        break;
        case"friendAsk":this.on.friendAsk(s.name);
        break;
        case"friendNote":this.on.friendNote(s.what,s.name);
        break;
        case"chatErr":this.on.chatErr(s.e,s.until);
        break;
        case"reported":this.on.reported(s.ok);
        break;
        case"notice":this.on.notice(s.n);
        break;
        case"mail":this.on.mail();
        break;
        case"announce":this.on.announce(s);
        break;
        case"tradeAsk":case"tradeOpen":case"tradeOffer":case"tradeState":case"tradeDone":case"tradeEnd":case"tradeChat":this.on.trade(s);
        break;
        case"profile":this.on.profile(s.id,s.p,s.name,s.look);
        break;
        case"emote":this.on.emote(s.id,s.e);
        break;
        case"party":this.on.party(s.p);
        break;
        case"partyAsk":this.on.partyAsk(s.id,s.name);
        break;
        case"partyAskFar":(o=(n=this.on).partyAskFar)==null||o.call(n,s.name,s.lb);
        break;
        case"partyErr":this.on.partyErr(s.why,s.name);
        break;
        case"partyCheck":this.on.partyCheck(s.trip,s.ready);
        break;
        case"partyCheckEnd":this.on.partyCheckEnd(s.why,s.name);
        break;
        case"partyStart":this.on.partyStart(s.trip);
        break;
        case"channels":this.on.channels(s.c,s.me);
        break;
        case"hopErr":this.on.hopErr(s.e);
        break;
        case"queue":this.retryMs=1e3,this.on.status("queue"),this.on.queue(s.pos,s.total);
        break
      }
    },e.onclose=t=> {
      this.ws===e&&(this.ws=null,this.joined=!1,this.on.status("offline"),t.code===Hf?HC():t.code===Ff?Jo( {
        state:"maintenance",at:Date.now()
      }):t.code===mx?vL():t.code===zf?Tf():t.code===Kj&&this.on.full?(this.closed=!0,this.on.full(this.lobbyId)):this.retry())
    }
  }
  retry() {
    this.closed||(this.on.status("offline"),clearTimeout(this.timer),this.timer=window.setTimeout(()=>this.connect(),this.retryMs),this.retryMs=Math.min(3e4,this.retryMs*2))
  }
  send(e) {
    return this.online?(this.ws.send(JSON.stringify(e)),!0):!1
  }
  close() {
    this.closed=this.ended=!0,clearTimeout(this.timer);
    const e=this.ws;
    this.ws=null,e==null||e.close(1e3)
  }
}
const Jj=200,Co=new Set,Qj=Qe?1:2,A0=Qe?120:0;
let ki=0,Ad=null,yo= {
  n:0,t0:0
};
function P0(a) {
  Ad=a
}
function Zj(a) {
  Co.add(a),vx()
}
function vx() {
  for(;ki<Qj&&Co.size;) {
    const a=Ad==null?void 0:Ad();
    let e=null,t=1/0;
    for(const s of Co) {
      if(!a) {
        e=s;
        break
      }
      const n=Math.hypot(s.x-a.x,s.y-a.y);
      n<t&&([t,e]=[n,s])
    }
    Co.delete(e),!yo.n&&!ki&&(yo= {
      n:0,t0:performance.now()
    }),ki++,e.loadLook().finally(()=> {
      yo.n++;const s=()=> {
        ki--,!ki&&!Co.size&&yo.n>=3&&cn(`avatares ×${yo.n} en ${((performance.now()-yo.t0)/1e3).toFixed(1)} s`),!ki&&!Co.size&&(yo.n=0),vx()
      };A0?setTimeout(s,A0):s()
    })
  }
}
class bx {
  constructor(e,t,s,n=Jj) {
    g(this,"id");
    g(this,"name");
    g(this,"look");
    g(this,"label");
    g(this,"x");
    g(this,"y");
    g(this,"player",null);
    g(this,"layer");
    g(this,"samples",[]);
    g(this,"loadSeq",0);
    g(this,"gone",!1);
    g(this,"pet",null);
    g(this,"petId",null);
    g(this,"delay");
    this.id=e.id,this.name=e.name,this.look=e.look,this.x=e.x,this.y=e.y,this.layer=t,this.label=s,this.delay=n,this.samples.push( {
      t:performance.now()-n,x:e.x,y:e.y,f:e.f
    }),this.setLook(e.look)
  }
  setLook(e) {
    this.look=e,Zj(this)
  }
  async loadLook() {
    if(this.gone)return;
    const e=this.look,t=++this.loadSeq;
    let s;
    try {
      const i=e.promotion??e.job;
      s=await It(e.peco?`${i}_peco`:i,e,e.equip)
    }
    catch {
      s=null
    }
    if(t!==this.loadSeq||this.gone||(this.setPet(e.pet&&cf(e.pet)?e.pet:null),!s))return;
    const n=this.player,o=new Al(ge(e.job),s);
    o.x=this.x,o.y=this.y,n?(o.facingX=n.facingX,o.facingY=n.facingY,this.layer.removeChild(n.view),n.view.destroy( {
      children:!0
    })):[o.facingX,o.facingY]=L0(this.samples[this.samples.length-1].f),this.player=o,this.layer.addChild(o.view)
  }
  setPet(e) {
    e!==this.petId&&(this.petId=e,this.pet&&(this.layer.removeChild(this.pet.view),this.pet.destroy(),this.pet=null),!(!e||this.gone)&&(this.pet=new Bf(e,this.x,this.y),this.layer.addChild(this.pet.view)))
  }
  push(e,t,s) {
    this.samples.push( {
      t:performance.now(),x:e,y:t,f:s
    }),this.samples.length>20&&this.samples.splice(0,this.samples.length-20)
  }
  update(e) {
    var y;
    const t=performance.now()-this.delay,s=this.samples;
    for(;s.length>2&&s[1].t<=t;)s.shift();
    const n=s[0],o=s[1]??n,i=o.t>n.t?Math.max(0,Math.min(1,(t-n.t)/(o.t-n.t))):1,r=n.x+(o.x-n.x)*i,l=n.y+(o.y-n.y)*i,d=r-this.x,h=l-this.y;
    this.x=r,this.y=l,(y=this.pet)==null||y.update(e,r,l);
    const u=this.player;
    if(!u)return;
    u.x=r,u.y=l;
    const p=Math.hypot(d,h)>20*e;
    if(!p) {
      const w=(i<1?n:o).f;
      [u.facingX,u.facingY]=L0(w),u.sitting=(w&px)!==0
    }
    u.update(e,p?d:0,p?h:0)
  }
  destroy() {
    this.gone=!0,Co.delete(this),this.label.remove(),this.setPet(null),this.player&&(this.layer.removeChild(this.player.view),this.player.view.destroy( {
      children:!0
    }))
  }
}
class e3 {
  constructor(e,t) {
    g(this,"ws",null);
    g(this,"retryMs",2e3);
    g(this,"timer",0);
    g(this,"closed",!1);
    this.url=e,this.hello=t,this.connect()
  }
  connect() {
    const e=ir();
    if(this.closed||!e)return;
    let t;
    try {
      t=new WebSocket(this.url)
    }
    catch {
      return this.retry()
    }
    this.ws=t,t.onopen=()=> {
      this.retryMs=2e3;
      const {
        name:s,look:n,stage:o,secs:i
      }
      =this.hello(),r=or();
      t.send(JSON.stringify( {
        t:"hello",v:Df,name:s,look:n,x:0,y:0,f:0,token:e,away: {
          stage:o,secs:Math.round(i)
        },...r? {
          mkey:r
        }
        :{}
      }))
    },t.onmessage=s=> {
      try {
        const n=JSON.parse(s.data);
        n.t==="status"&&Jo(n.s)
      }
      catch{}
    },t.onclose=s=> {
      this.ws===t&&(this.ws=null,s.code===Ff?Jo( {
        state:"maintenance",at:Date.now()
      }):s.code===zf?Tf():s.code!==Hf&&s.code!==mx&&this.retry())
    }
  }
  retry() {
    this.closed||(clearTimeout(this.timer),this.timer=window.setTimeout(()=>this.connect(),this.retryMs),this.retryMs=Math.min(3e4,this.retryMs*2))
  }
  close() {
    this.closed=!0,clearTimeout(this.timer);
    const e=this.ws;
    this.ws=null,e==null||e.close(1e3)
  }
}
class t3 {
  constructor(e,t,s) {
    g(this,"ws",null);
    g(this,"retryMs",1e3);
    g(this,"timer",0);
    g(this,"closed",!1);
    g(this,"opened",!1);
    this.url=e,this.hello=t,this.on=s,this.connect()
  }
  get online() {
    var e;
    return((e=this.ws)==null?void 0:e.readyState)===WebSocket.OPEN
  }
  connect() {
    if(this.closed)return;
    this.on.status("connecting");
    let e;
    try {
      e=new WebSocket(this.url)
    }
    catch {
      return this.retry()
    }
    this.ws=e,e.onopen=()=> {
      this.retryMs=1e3,this.opened=!0;
      const t=yx(),s=ir();
      e.send(JSON.stringify( {
        t:"hello",v:Df,...this.hello(),x:0,y:0,f:0,key:t,run:!0,hm:!0,...s? {
          token:s
        }
        :{},...or()? {
          mkey:or()
        }
        :{}
      }))
    },e.onmessage=t=> {
      let s;
      try {
        s=JSON.parse(t.data)
      }
      catch {
        return
      }
      if(s.t==="status")return Jo(s.s);
      s.t==="runWelcome"?(this.on.welcome(s.me,s.host,s.mates),this.on.status("online")):s.t==="runJoin"?this.on.join(s.m):s.t==="runLeave"?this.on.leave(s.mid):s.t==="runHost"?this.on.host(s.mid):s.t==="run"?this.on.data(s.from,s.d):s.t==="chat"?this.on.chat(s):s.t==="chatErr"&&this.on.chatErr(s.e,s.until)
    },e.onclose=t=> {
      this.ws===e&&(this.ws=null,this.on.status("offline"),!this.opened&&this.url!==Ui()&&(this.url=Ui()),t.code===Ff?Jo( {
        state:"maintenance",at:Date.now()
      }):t.code===zf?Tf():t.code!==Hf&&this.retry())
    }
  }
  retry() {
    this.closed||(clearTimeout(this.timer),this.timer=window.setTimeout(()=>this.connect(),this.retryMs),this.retryMs=Math.min(1e4,this.retryMs*2))
  }
  send(e) {
    return this.online?(this.ws.send(JSON.stringify( {
      t:"run",d:e
    })),!0):!1
  }
  say(e) {
    return this.online?(this.ws.send(JSON.stringify( {
      t:"chat",ch:"party",text:e
    })),!0):!1
  }
  close() {
    this.closed=!0,clearTimeout(this.timer);
    const e=this.ws;
    this.ws=null,e==null||e.close(1e3)
  }
}
const s3=a=>a.replace(/[&<>"]/g,e=>`&#${e.charCodeAt(0)};`);class a3{constructor(e){g(this,"el",document.getElementById("party-frame"));g(this,"view",null);g(this,"open",0);g(this,"ready",null);this.actions=e,this.el.onclick=t=>this.onClick(t)}set(e){this.view=e,e!=null&&e.members.some(t=>t.mid===this.open)||(this.open=0),this.render()}setCheck(e){this.ready=e,this.render()}get leader(){var e;return((e=this.view)==null?void 0:e.members.find(t=>t.mid===this.view.leader))??null}get members(){var e;return((e=this.view)==null?void 0:e.members)??[]}get inParty(){return!!this.view}get isLeader(){return!!this.view&&this.view.leader===this.view.me}get canInvite(){return!this.view||this.isLeader&&this.view.members.length<$0}get leaderElsewhere(){const e=this.view,t=this.leader,s=e==null?void 0:e.members.find(n=>n.mid===e.me);return t&&s&&t!==s&&t.online&&t.channel!==s.channel?t.channel:0}has(e){var t;return!!((t=this.view)!=null&&t.members.some(s=>s.id===e))}row(e,t){var h;const s=Ct(ge(e.promotion??e.job),e.gender),n=e.mid===t.me,o=((h=t.members.find(u=>u.mid===t.me))==null?void 0:h.channel)??0,i=e.online?!n&&e.channel!==o?`${c("Canal  {
  c
}
",{c:e.channel})} <button class="pf-hop" data-hop="$ {
  e.channel
}
">${c("Ir")}</button>`:c("Canal  {
  c
}
",{c:e.channel}):e.inRun?c("En la partida del grupo"):c("Fuera de la plaza"),r=["pf-row",n?"me":"",e.online?"":"off",this.open===e.mid?"open":""].filter(Boolean).join(" "),l=this.open===e.mid&&this.isLeader&&!n?`<div class="pf-acts"><button class="ro-btn small" data-lead="$ {
  e.mid
}
">${c("Hacer líder")}</button><button class="ro-btn small" data-kick="$ {
  e.mid
}
">${c("Expulsar")}</button></div>`:"",d=this.isLeader&&!n?' tabindex="0"':"";return`<div class="$ {
  r
}
" data-mid="$ {
  e.mid
}
"${d}>
      <div class="pf-name"><b>${s3(e.name)}</b>${e.mid===t.leader?`<span class="pf-lead">${c("Líder")}</span>`:""}${this.ready?this.ready.includes(e.mid)?`<span class="pf-ready">${c("Listo")}</span>`:`<span class="pf-wait">${c("Esperando…")}</span>`:""}</div>
      <div class="pf-info"><span>${s} · ${c("Nv  {
  n
}
",{n:e.level})}</span><span class="pf-gs">GS ${e.gs}</span></div>
      <small class="pf-where">${i}</small>${l}
    </div>`}render(){const e=this.view;if(this.el.classList.toggle("hidden",!e),this.el.classList.toggle("leader",this.isLeader),!e){this.el.innerHTML="";return}this.el.innerHTML=`<div class="pf-head"><b>${c("Grupo")}</b><span>${e.members.length}/${$0}</span></div>
      ${e.members.map(t=>this.row(t,e)).join("")}
      ${this.ready&&this.isLeader?`<button class="ro-btn small pf-leave" data-cancel="1">${c("Cancelar salida")}</button>`:`<button class="ro-btn small pf-leave" data-leave="1">${c("Salir del grupo")}</button>`}`}onClick(e){var n;const t=e.target.closest("button, .pf-row");if(!t)return;if(t.dataset.leave)return this.actions.leave();if(t.dataset.cancel)return this.actions.cancelTrip();if(t.dataset.kick)return this.actions.kick(Number(t.dataset.kick));if(t.dataset.lead)return this.actions.lead(Number(t.dataset.lead));if(t.dataset.hop)return this.actions.hop(Number(t.dataset.hop));const s=Number(t.dataset.mid);!this.isLeader||s===((n=this.view)==null?void 0:n.me)||(this.open=this.open===s?0:s,this.render())}destroy(){this.el.onclick=null,this.el.classList.add("hidden"),this.el.innerHTML=""}}const mh={"/!":0,"/?":1,"/ho":2,"/lv":3,"/lv2":4,"/swt":5,"/ic":6,"/an":7,"/ag":8,"/$":9,"/...":10,"/bawi":11,"/rock":11,"/gawi":12,"/scissors":12,"/bo":13,"/paper":13,"/thx":15,"/wah":16,"/sry":17,"/heh":18,"/swt2":19,"/hmm":20,"/no1":21,"/??":22,"/omg":23,"/oh":24,"/x":25,"/hlp":26,"/go":27,"/sob":28,"/gg":29,"/kis":30,"/kis2":31,"/pif":32,"/ok":33,"/bzz":35,"/rice":36,"/awsm":37,"/meh":38,"/shy":39,"/pat":40,"/mp":41,"/slur":42,"/com":43,"/yawn":44,"/grat":45,"/hp":46,"/fsh":51,"/spin":52,"/sigh":53,"/dum":54,"/crwd":55,"/desp":56},Vf=57,j0=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,35,36,37,38,39,40,41,42,43,44,45,46,51,52,53,54,55,56,Vf,73,74,75,76,77,78,79,64,67,68];function _0(a){return a===Vf?"/dice":Object.keys(mh).find(e=>mh[e]===a)??`/e${a}`}function q0(a){const e=a.trim().toLowerCase();if(e==="/dice")return Vf+Math.floor(Math.random()*6);if(e in mh)return mh[e];const t=/^\/e(\d{1,2})$/.exec(e);return t&&Number(t[1])<Vj?Number(t[1]):null}let ap=null;function wx(){return ap??(ap=fetch("assets/sprites/fx_emotion.json").then(a=>a.json()).catch(()=>ap=null)),ap}async function I0(a,e=34){var d;const t=await wx();if(!t)return null;const s=((d=t.actions["a"+a])==null?void 0:d.dirs[0])??[],[n,o,i,r]=t.frames[s[Math.floor(s.length*.6)]]??[0,0,0,0],l=document.createElement("span");return l.className="emote-icon",l.style.cssText=`background-image:url(assets/sprites/${t.image});width:${i}px;height:${r}px;background-position:-${n}px -${o}px;--s:${Math.min(1,e/Math.max(i,r))}`,l}async function n3(a,e=600){const t=await wx(),s=t==null?void 0:t.actions["a"+a];if(!t||!s)return null;const o=s.dirs[0].map(m=>t.frames[m]),i=Math.max(...o.map(([,,m,,f])=>2*Math.max(f,m-f))),r=Math.max(...o.map(([,,,,,m])=>m)),l=document.createElement("span");l.className="emote-loop",l.style.cssText=`width:${i}px;height:${r}px`;const d=document.createElement("span");d.style.cssText=`position:absolute;background-image:url(assets/sprites/${t.image});background-repeat:no-repeat;image-rendering:pixelated`,l.append(d);const h=m=>{if(d.hidden=!m,!m)return;const[f,v,x,k,M,$]=m;Object.assign(d.style,{width:`${x}px`,height:`${k}px`,left:`${i/2-M}px`,top:`${r-$}px`,backgroundPosition:`-${f}px -${v}px`})},u=o.length*s.delay+e,p=performance.now();let y=!1;const w=()=>{if(l.isConnected)y=!0;else if(y||performance.now()-p>5e3)return;const m=Math.floor((performance.now()-p)%u/s.delay);h(o[m]),requestAnimationFrame(w)};return w(),l}const o3=["¡Hola!","¿Grupo?","¿Comerciamos?","¡Gracias!","¡Vamos!","Un momento","¡Buena partida!","¡Adiós!"],i3=["local","party","general","trade","cn"],np={local:"Canal",general:"General",trade:"Comercio",party:"Grupo",cn:"中文"},R0=80,B0=(a,e)=>a.ch===e||a.all||a.ch==="whisper"||a.ch==="system"||a.ch==="announce",N0="ro-life:cnInvite",r3=["Asia/Taipei","Asia/Shanghai","Asia/Chongqing","Asia/Harbin","Asia/Urumqi","Asia/Hong_Kong","Asia/Macau"];function l3(){var a;if(Te.lang==="zh-TW"||(a=navigator.language)!=null&&a.toLowerCase().startsWith("zh"))return!0;try{return r3.includes(Intl.DateTimeFormat().resolvedOptions().timeZone)}catch{return!1}}const c3={local:"chatLocal",general:"chatGeneral",trade:"chatTrade",cn:"chatCn"};function $m(a){const e=c3[a];return!e||Te[e]}const Kr=[];let gt="local",op="";function d3(a){const e=/^\/(?:w|whisper)\s+(?:"([^"]+)"|(\S+))\s*(.*)$/i.exec(a);return e?[(e[1]??e[2]).trim(),e[3].trim()]:null
}
const td=a=>`/w "${a}" `;class h3 {
  constructor(e) {
    g(this,"root",document.getElementById("lobby-chat"));g(this,"log",document.getElementById("chat-log"));g(this,"tabs",document.getElementById("chat-tabs"));g(this,"fresh",new Set);g(this,"form",document.getElementById("chat-form"));g(this,"input",document.getElementById("chat-input"));g(this,"chBtn",document.getElementById("chat-channel"));g(this,"emoteBtn",document.getElementById("chat-emote"));g(this,"panel",document.getElementById("emote-panel"));g(this,"actions");g(this,"cleanup",[]);g(this,"reading",!1);g(this,"toggle",document.getElementById("chat-toggle"));g(this,"unreadEl",document.getElementById("chat-unread"));g(this,"collapsed",Qe);g(this,"unread",0);g(this,"inParty",!1);g(this,"shownTab",null);this.actions=e;const t=()=>e.onFocus();this.input.maxLength=ux,Qe&&(this.input.placeholder=c("Toca para escribir")),this.input.disabled=!Pa(),this.chBtn.disabled=this.input.disabled,this.input.disabled?this.input.placeholder=c("Crea una cuenta para escribir en el chat"):Qe||(this.input.placeholder=c("Pulsa Enter para escribir")),this.root.classList.remove("hidden"),Qe&&(this.toggle.classList.remove("hidden"),this.toggle.onclick=()=>this.setCollapsed(!this.collapsed),this.setCollapsed(this.collapsed)),gt==="party"&&(gt="local");let s=Te.chatCn;this.cleanup.push(fr(p=> {
      p.chatCn!==s&&e.setCn(s=p.chatCn),this.fixChannel()
    })),this.fixChannel();const n=setTimeout(()=>this.firstCnVisit(),1500);this.cleanup.push(()=>clearTimeout(n)),this.form.onsubmit=p=> {
      var v;p.preventDefault();const y=this.input.value.trim();if(!y)return this.input.blur();this.input.value="";const w=/^\/r(?:\s+(.*))?$/i.exec(y),m=w?op?[op,((v=w[1])==null?void 0:v.trim())??""]:null:d3(y);if(w&&!m)return this.system(c("Nadie te ha susurrado todavía."));if(m) {
        const[x,k]=m;if(!k)return void(this.input.value=td(x));if(!this.actions.whisper(x,k))return this.system(c("Sin conexión: el mensaje no se ha enviado."));this.input.value=td(x);return
      }
      const f=q0(y);if(f!==null)return this.actions.emote(f);if(!(y.startsWith("/")&&this.actions.command(y))) {
        if(/^\/\S+$/.test(y))return this.system(c("Comando desconocido: {c}", {
          c:y
        }));this.actions.send(gt,y)||this.system(c("Sin conexión: el mensaje no se ha enviado."))
      }
    },this.chBtn.onpointerdown=p=>this.typing&&p.preventDefault(),this.chBtn.onclick=()=> {
      this.cycle(),this.input.focus()
    };const o=p=> {
      p.key==="Tab"?(p.preventDefault(),this.cycle(p.shiftKey?-1:1)):p.key==="Escape"&&(p.stopPropagation(),this.togglePanel(!1),this.input.blur())
    },i=()=> {
      this.root.classList.add("typing"),this.expand(),t()
    },r=()=> {
      /^\/w "[^"]+" $/.test(this.input.value)&&(this.input.value=""),this.root.classList.remove("typing"),this.expand()};this.log.onclick=()=>{Qe||this.typing||(this.reading=!this.reading,this.expand())},this.emoteBtn.onpointerdown=p=>this.typing&&p.preventDefault(),this.emoteBtn.onclick=()=>this.togglePanel(),this.buildPanel();const l=p=>{this.root.contains(p.target)||this.togglePanel(!1),this.reading&&!this.root.contains(p.target)&&(this.reading=!1,this.expand())},d=window.visualViewport,h=()=>{const p=d?Math.max(0,window.innerHeight-d.height-d.offsetTop):0;this.root.style.setProperty("--kb",`${Math.round(p)}px`)};this.input.addEventListener("keydown",o),this.input.addEventListener("focus",i),this.input.addEventListener("blur",r),window.addEventListener("pointerdown",l);const u=()=>Qe&&!this.collapsed&&this.placeBelowSign();window.addEventListener("resize",u),d==null||d.addEventListener("resize",h),d==null||d.addEventListener("scroll",h),this.cleanup.push(()=>{this.input.removeEventListener("keydown",o),this.input.removeEventListener("focus",i),this.input.removeEventListener("blur",r),window.removeEventListener("pointerdown",l),window.removeEventListener("resize",u),d==null||d.removeEventListener("resize",h),d==null||d.removeEventListener("scroll",h)})}async buildPanel(){this.panel.replaceChildren();const e=await Promise.all(j0.map(s=>I0(s)));if(e.some(s=>!s))return;if(j0.forEach((s,n)=>{const o=document.createElement("button");o.type="button",o.className="emote-cell",o.title=_0(s),o.append(e[n]),o.onpointerdown=i=>this.typing&&i.preventDefault(),o.onclick=()=>{this.togglePanel(!1),this.actions.emote(q0(_0(s))??s)},this.panel.append(o)}),!this.input.disabled){const s=document.createElement("div");s.className="emote-phrases";for(const n of o3){const o=document.createElement("button");o.type="button",o.className="ro-btn small",o.textContent=c(n),o.onpointerdown=i=>this.typing&&i.preventDefault(),o.onclick=()=>{this.togglePanel(!1),this.actions.send(gt,c(n))||this.system(c("Sin conexión: el mensaje no se ha enviado."))},s.append(o)}this.panel.append(s)}rn("emote-panel",s=>s.kind!=="B"?!1:(this.togglePanel(!1),!0));const t=await I0(18);t&&this.emoteBtn.replaceChildren(t)}setCollapsed(e){this.collapsed=e,this.root.classList.toggle("collapsed",e),this.toggle.classList.toggle("on",!e),e?(this.input.blur(),this.togglePanel(!1)):(this.unread=0,this.placeBelowSign(),this.log.scrollTop=this.log.scrollHeight),this.unreadEl.textContent=this.unread>9?"9+":String(this.unread),this.unreadEl.classList.toggle("hidden",!this.unread)}placeBelowSign(){var t;const e=(t=document.getElementById("lobby-place"))==null?void 0:t.getBoundingClientRect();e!=null&&e.height&&(this.root.style.top=`${Math.round(e.bottom+8)}px`)}togglePanel(e=this.panel.classList.contains("hidden")){this.panel.classList.toggle("hidden",!e),this.emoteBtn.classList.toggle("on",e)}expand(){this.root.classList.toggle("open",this.typing||this.reading),this.log.scrollTop=this.log.scrollHeight}get typing(){return document.activeElement===this.input}focus(){this.input.focus()}whisperTo(e){this.input.disabled||(this.collapsed&&this.setCollapsed(!1),this.input.value=td(e),this.input.focus(),this.input.setSelectionRange(this.input.value.length,this.input.value.length))}whisper(e,t,s,n,o,i){e||(op=t),this.push({ch:"whisper",name:t,text:s,self:e,out:e,id:n,c:o,gm:i})}whisperFailed(e){this.input.value===td(e)&&(this.input.value=""),this.system(c(" {
        name
      }
       no está en la plaza: el susurro no ha llegado.",{name:e}))}add(e,t,s,n,o,i,r){if(e==="cn"&&n&&!Te.chatCn)return this.push({ch:e,name:t,text:s,self:n,id:o,c:i,gm:r,all:!0}),this.inviteCn(!0);$m(e)&&this.push({ch:e,name:t,text:s,self:n,id:o,c:i,gm:r})}inviteCn(e=!1){Ae(c("Canal 中文"),c(e?"Tu mensaje ha ido al canal 中文, pero no lo tienes activado: no verás lo que te contesten. Actívalo para hablar allí.":"Los mensajes en chino van al canal 中文. Actívalo para ver lo que escriben los demás jugadores y hablar con ellos."),[{label:c("Ahora no")},{label:c("Activar"),primary:!0,run:()=>{$n({chatCn:!0}),gt="cn",this.showChannel(),this.system(c("Canal 中文 activado. Puedes quitarlo en Opciones › Idioma."))}}])}firstCnVisit(){if(l3()){try{if(localStorage.getItem(N0))return;localStorage.setItem(N0,"1")}catch{return}if(!Te.chatCn)return this.inviteCn();gt="cn",this.showChannel(),this.system(c("Los mensajes en chino van al canal 中文: escribe ahí para hablar con otros jugadores en chino."))}}system(e){this.push({ch:"system",text:e})}announce(e){this.push({ch:"announce",text:e})}push(e){if(Kr.push(e),Kr.filter(t=>t.ch===e.ch).length>R0&&Kr.splice(Kr.findIndex(t=>t.ch===e.ch),1),B0(e,gt))for(this.render(e);this.log.childElementCount>R0*2;)this.log.firstElementChild.remove();else!e.self&&e.ch!=="system"&&e.ch!=="announce"&&e.ch!=="whisper"&&(this.fresh.add(e.ch),this.showTabs());this.collapsed&&!e.self&&e.ch!=="system"&&(this.unread++,this.unreadEl.textContent=this.unread>9?"9+":String(this.unread),this.unreadEl.classList.remove("hidden"))}render(e){const t=this.log.scrollTop+this.log.clientHeight>=this.log.scrollHeight-4,s=document.createElement("div");if(s.className=`chat-line ${e.ch}${e.self?" self":""}${e.gm?" gm":""}`,e.ch==="whisper"||e.ch==="announce"||e.all){const n=document.createElement("span");n.className="chat-tag",n.textContent=e.ch==="announce"?c("Aviso"):e.ch==="whisper"?c("Susurro"):c(np[e.ch]),s.append(n)}if(e.gm){const n=document.createElement("span");n.className="chat-tag gm",n.textContent="GM",s.append(n)}if(e.name){const n=document.createElement("b");if(n.textContent=e.out?c("Para  {
        name
      }
      : ",{name:e.name}):`${e.name}: `,(!e.self||e.out)&&e.id!==void 0){const{id:o,c:i}=e,r=e.name;n.className="chat-name",n.onclick=l=>this.actions.pick(o,r,i??0,l.clientX,l.clientY)}s.append(n)}s.append(e.text),this.log.append(s),t&&(this.log.scrollTop=this.log.scrollHeight)}cycle(e=1){const t=this.writable();gt=t[(t.indexOf(gt)+e+t.length)%t.length],this.showChannel()}setParty(e){e!==this.inParty&&(this.inParty=e,e&&(gt="party"),this.fixChannel())}writable(){const e=i3.filter(t=>(t!=="party"||this.inParty)&&$m(t));return e.length?e:["local"]}fixChannel(){const e=this.writable();e.includes(gt)||(gt=e[0]),this.showChannel()}showChannel(){if(this.chBtn.textContent=c(np[gt]),this.chBtn.className=`chat-ch ${gt}`,this.shownTab!==gt){this.shownTab=gt,this.log.replaceChildren();for(const e of Kr)B0(e,gt)&&this.render(e);this.log.scrollTop=this.log.scrollHeight}this.fresh.delete(gt),this.showTabs()}showTabs(){const e=this.writable();this.tabs.replaceChildren(...e.map(t=>{const s=document.createElement("button");return s.type="button",s.className=`chat-tab ${t}${t===gt?" on":""}${this.fresh.has(t)?" new":""}`,s.textContent=c(np[t]),s.onpointerdown=n=>this.typing&&n.preventDefault(),s.onclick=()=>{gt=t,this.showChannel()},s}))}destroy(){this.cleanup.forEach(e=>e()),this.input.blur(),this.input.value="",this.reading=!1,this.togglePanel(!1),this.root.classList.remove("open","typing"),this.root.classList.add("hidden"),this.toggle.classList.add("hidden"),this.toggle.onclick=this.form.onsubmit=this.log.onclick=this.chBtn.onclick=this.emoteBtn.onclick=null,this.chBtn.onpointerdown=this.emoteBtn.onpointerdown=null,this.log.replaceChildren(),this.tabs.replaceChildren(),this.panel.replaceChildren(),Fp("emote-panel")}}function O0(a){const e=Math.max(0,Math.floor(a)),t=String(Math.floor(e%3600/60)).padStart(e>=3600?2:1,"0");return`${e>=3600?`${Math.floor(e/3600)}:`:""}${t}:${String(e%60).padStart(2,"0")}`}const wn=a=>a.replace(/[&<>"]/g,"");
      class u3 {
        constructor(e,t) {
          g(this,"list",[]);
          g(this,"asks",[]);
          g(this,"btn",document.getElementById("lobby-friends"));
          g(this,"onBadge",document.getElementById("lobby-friends-on"));
          g(this,"badge",document.getElementById("lobby-friends-n"));
          g(this,"body",document.getElementById("fr-body"));
          g(this,"input",document.getElementById("fr-name"));
          g(this,"msg",document.getElementById("fr-msg"));
          g(this,"overlay",document.getElementById("friends"));
          g(this,"got",0);
          g(this,"tick",0);
          this.actions=e,this.channel=t,this.btn.onclick=()=>this.open(),document.getElementById("fr-close").onclick=()=>this.close(),this.overlay.onpointerdown=s=> {
            s.target.closest(".player-menu")||(this.actions.closeMenu(),s.target===s.currentTarget&&this.close())
          },this.tick=window.setInterval(()=> {
            this.overlay.classList.contains("hidden")||this.paintTimes()
          },1e3),document.getElementById("fr-form").onsubmit=s=> {
            s.preventDefault();
            const n=this.input.value.trim();
            n&&(this.actions.add(n),this.input.value="")
          },this.body.onclick=s=> {
            const n=s.target.closest("[data-act]");
            if(!n)return;
            const o=n.dataset.name;
            n.dataset.act==="yes"||n.dataset.act==="no"?this.actions.reply(o,n.dataset.act==="yes"):n.dataset.act==="menu"?this.actions.menu(Number(n.dataset.id),o,Number(n.dataset.ch),s.clientX,s.clientY,this.overlay):n.dataset.act==="remove"?this.actions.remove(o):n.dataset.act==="invite"&&this.actions.inviteFar(o)
          },this.paint()
        }
        has(e) {
          const t=e.toLowerCase();
          return this.list.some(s=>s.name.toLowerCase()===t)
        }
        set(e,t) {
          this.list=e,this.asks=t,this.got=performance.now(),this.paint()
        }
        note(e) {
          this.msg.textContent=e
        }
        close() {
          this.actions.closeMenu(),de("friends")
        }
        paintTimes() {
          const e=(performance.now()-this.got)/1e3;
          this.body.querySelectorAll("[data-secs]").forEach(t=>t.textContent=O0(Number(t.dataset.secs)+e))
        }
        open() {
          this.actions.closeMenu(),this.msg.textContent="",this.paint(),Ue("friends"),Pa()&&this.input.focus()
        }
        paint() {
          this.badge.textContent=String(this.asks.length),this.badge.classList.toggle("hidden",!this.asks.length);
          const e=this.list.filter(r=>r.on>0).length;
          this.onBadge.textContent=String(e),this.onBadge.classList.toggle("hidden",!e),this.btn.title=e?c(e===1?"{n} amigo en la plaza":"{n} amigos en la plaza", {
            n:e
          }):"";
          const t=!Pa();
          if(document.getElementById("fr-form").classList.toggle("hidden",t),document.getElementById("fr-count").textContent=t?"":`${this.list.length}/${Gj}`,t) {
            this.body.innerHTML=`<p class="fr-empty">${c("Crea una cuenta para tener amigos: créala desde la selección de personaje.")}</p>`;
            return
          }
          const s=this.asks.length?`<div class="fr-head">${c("Peticiones")}</div>${this.asks.map(r=>`<div class="fr-row ask"><b>$ {
            wn(r)
          }
          </b><span class="fr-where">$ {
            c("Quiere ser tu amigo")
          }
          </span>
              <span class="fr-acts"><button class="ro-btn small primary" data-act="yes" data-name="${wn(r)}">$ {
            c("Aceptar")
          }
          </button><button class="ro-btn small" data-act="no" data-name="${wn(r)}">$ {
            c("Rechazar")
          }
          </button></span></div>`).join("")}`:"",n=r=>r.on===this.channel()&&!r.lb?0:r.on>0?1:r.on<0?2:3,o=[...this.list].sort((r,l)=>n(r)-n(l)||r.name.localeCompare(l.name)),i=o.length?o.map(r=> {
            const l=r.on<0?[c("En partida"),r.stage?mf(r.stage):"",r.secs!==void 0?`<span data-secs="${r.secs}">${O0(r.secs)}</span>`:""].filter(Boolean).join(" · "):"",h=(r.lb&&r.on?`${ph[r.lb-1]?c(ph[r.lb-1]):r.lb} · `:"")+(r.on>0?c("Canal {c}", {
              c:r.on
            }):r.on<0?l:c("Desconectado"))+(r.party?` <em class="fr-party">${c("En grupo")}</em>`:""),u=r.id&&r.on>0?`<button class="fr-name" data-act="menu" data-id="${r.id}" data-ch="${r.on}" data-name="${wn(r.name)}" title="${c("Opciones")}">${wn(r.name)} <i>▾</i></button>`:`<b>${wn(r.name)}</b>`,p=`<button class="ro-btn small fr-remove" data-act="remove" data-name="${wn(r.name)}" title="${c("Quitar de amigos")}" aria-label="${c("Quitar de amigos")}">✕</button>`,y=r.lb&&r.on>0&&!r.party?`<button class="ro-btn small" data-act="invite" data-name="${wn(r.name)}" title="${c("Invitar al grupo")}">${c("Invitar")}</button>`:"";return`<div class="fr-row${r.on?" on":""}"><i class="fr-dot"></i>${u}<span class="fr-where">${h}</span><span class="fr-acts">${y}${p}</span></div>`
          }).join(""):`<p class="fr-empty">${c("Aún no tienes amigos. Añade a alguien por el nombre de su personaje o desde su menú en la plaza.")}</p>`;
          this.body.innerHTML=s+`<div class="fr-head">${c("Amigos")}</div>`+i,this.paintTimes()
        }
        destroy() {
          this.close(),clearInterval(this.tick),this.btn.onclick=null,this.overlay.onpointerdown=this.body.onclick=null,document.getElementById("fr-close").onclick=null,document.getElementById("fr-form").onsubmit=null,this.body.replaceChildren()
        }
      }
      const Ts=a=>document.getElementById(a),ip=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]);function kx(a){var e;return{level:a.level,jobLevel:a.jobLevel,stats:{...a.stats},talents:{...a.talents},gear:Dn(a).map(({slot:t,inst:s})=>({slot:t,itemId:s.itemId,cards:s.cards,quality:s.quality,refine:s.refine,affixes:s.affixes,ilvl:s.ilvl,tier:s.tier})),record:{stage:p3(a),bestLevel:a.record.bestLevel,wins:a.record.wins,runs:a.record.runs,totalKills:a.record.totalKills,mvps:((e=a.mvpsDefeated)==null?void 0:e.length)??0},gs:Math.round(vr(a))}}function p3(a){const e=a.mvpsDefeated??[];let t=0;for(;t<Se.length&&zd(e,Se[t].mvp.id);)t++;return t}function m3(a,e,t){const s=[],n={};for(const u of t.gear){const p=bs.find(m=>m.id===u.slot),y=fe[u.itemId];if(!p||!y||!Ck(e.job,y,p.id)||n[p.id])continue;const w=`ins${s.length}`;s.push({uid:w,itemId:u.itemId,cards:u.cards.map(m=>m&&ms[m]?m:null),quality:u.quality&&u.quality<Re.length?u.quality:void 0,refine:u.refine?Math.min(10,u.refine):void 0,affixes:u.affixes,ilvl:qT(u.ilvl),tier:NS(u.tier)}),n[p.id]=w}const o=Wn();for(const{id:u}of _t)t.stats[u]&&(o[u]=Math.max(Zi,Math.min(mr,t.stats[u])));const i={};for(const[u,p]of Object.entries(t.talents)){const y=Ze[u];y&&y.job===e.job&&p>0&&(i[u]=Math.min(p,y.maxRank))}const{gender:r,hair:l,hairColor:d,cloth:h}=e;return{id:"inspect",slot:-1,name:a,job:e.job,...e.promotion?{promotion:e.promotion}:{},look:{gender:r,hair:l,hairColor:d,cloth:h},createdAt:0,record:{bestTime:0,bestLevel:t.record.bestLevel,bestKills:0,totalKills:t.record.totalKills,runs:t.record.runs,wins:t.record.wins},level:t.level,exp:0,jobLevel:t.jobLevel,jobExp:0,talents:i,stats:o,inventory:s,cards:{},equipped:n}}let Sm=()=>{};function f3(a,e,t){Ml();const s=m3(a,e,t),n=Dn(s),o=L=>{var j;return(j=n.find(A=>A.slot===L))==null?void 0:j.inst};Ts("ins-title").textContent=`${s.name} · ${zl(s)}`;const i=t.gs??n.reduce((L,j)=>L+nr(j.inst,s.job),0);Ts("ins-head").innerHTML=`<b class="cp-lv">Base Lv ${s.level}</b><b class="cp-lv">Job Lv ${Nh(s)}</b><span class="gs-total"><span>${c("Gearscore")}</span><b>${i}</b></span>`;const r=L=>{document.querySelectorAll("#inspect .tab-btn").forEach(j=>j.classList.toggle("active",j.dataset.tab===L));for(const j of["equip","stats","job"])Ts(`ins-tab-${j}`).classList.toggle("off",j!==L);lc()};document.querySelectorAll("#inspect .tab-btn").forEach(L=>L.onclick=()=>r(L.dataset.tab)),r("equip");const l=L=>{const j=bs.find(C=>C.id===L),A=o(L),E=A?A.cards.filter(Boolean).length:0;return`<div class="equip-slot${A!=null&&A.quality?` q${A.quality}`:""}" data-slot="${L}" data-uid="${(A==null?void 0:A.uid)??""}">
      <div class="ico">${A?`<img src="${Me(A.itemId)}">`:""}</div>
      <div><span class="lbl">${j.name}</span><span class="nm">${A?ip(ss(A)):"—"}</span></div>
      ${A?`<span class="slot-side">${A.cards.length?`<span class="cards">${"◆".repeat(E)}${"◇".repeat(A.cards.length-E)}</span>`:""}<span class="slot-gs">${nr(A,s.job)}</span></span>`:""}
    </div>`},d=["head_top","head_mid","armor","garment","acc1"],h=["head_low","weapon","shield","shoes","acc2"];Ts("ins-slots-left").innerHTML=d.map(l).join(""),Ts("ins-slots-right").innerHTML=h.map(l).join("");const u=L=>{const j=o(L.dataset.slot);if(!j)return"";const A=j.cards.filter(E=>!!E);return rc(j,A.length?`<div class="ins-cards">${A.map(E=>`<img src="${Fs(E)}" title="${ip(qt(E))}">`).join("")}</div>`:"")},p=Ts("ins-equip");to(p,".equip-slot",u);const y=Ts("ins-detail"),w=L=>{p.querySelectorAll(".equip-slot.sel").forEach(j=>j.classList.remove("sel")),L.classList.add("sel"),y.innerHTML=u(L)||`<div class="muted">${c("Ranura vacía.")}</div>`};p.querySelectorAll(".equip-slot").forEach(L=>L.onclick=()=>w(L));const m=p.querySelector('.equip-slot[data-slot="weapon"]:not([data-uid=""])')??p.querySelector('.equip-slot:not([data-uid=""])');m?w(m):y.innerHTML=`<div class="muted">${c("No lleva nada equipado.")}</div>`;const f=Ts("ins-trees"),v=Ts("ins-job-detail");let x=0;const k=()=>{f.innerHTML=dx(s,x,!0),f.querySelectorAll(".tree-tab").forEach(L=>{L.onclick=()=>{x=Number(L.dataset.b),k()}}),f.querySelectorAll(".talent").forEach(L=>L.onclick=()=>v.innerHTML=uh(s,Ze[L.dataset.t]))};k(),to(f,".talent",L=>uh(s,Ze[L.dataset.t])),v.classList.toggle("hidden",!Qe),v.innerHTML=`<div class="muted">${c("Toca un talento para ver lo que hace.")}</div>`;const M=Ek(s);Ts("ins-prim").innerHTML=_t.map(({id:L,name:j,desc:A})=>{const E=s.stats[L],C=M[L]-E;return`<div class="prim-row ins-prim" title="${ip(A)}"><b class="prim-name">${j}</b><span class="prim-val">${E}${C?`<span class="prim-bonus"> +${C}</span>`:""}</span></div>`}).join(""),Ts("ins-derived").innerHTML=hx(M).map(([L,j])=>`<span>${c(L)}</span><b>${j}</b>`).join("");const $=t.record,P=Se[Math.min($.stage,Se.length)-1],q=[[c("Stage superado"),P?P.name:c("Ninguno")],[c("Nv récord en partida"),String(Math.round($.bestLevel))],[c("Partidas"),`${Math.round($.runs)} (${c("{n} victorias",{n:Math.round($.wins)})})`],[c("Monstruos"),String(Math.round($.totalKills))],[c("MVPs vencidos"),String(Math.round($.mvps))]];Ts("ins-record").innerHTML=q.map(([L,j])=>`<span>${L}</span><b>${j}</b>`).join("");const R=L=>L.key==="Escape"&&Ml();window.addEventListener("keydown",R),Sm=()=>window.removeEventListener("keydown",R),Ts("ins-close").onclick=Ml,Ue("inspect")}function Ml(){Sm(),Sm=()=>{},lc(),de("inspect")}const Ve=a=>document.getElementById(a),sd=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),Em=a=>a.toLocaleString(),g3=Object.values(at),D0=()=>({gear:[],cards:[],ores:[],kafra:0});function xx(a,e){return!!fe[a.itemId]&&!fe[a.itemId].starter&&!a.owner&&!e.has(a.uid)}function y3(a,e=xt()){const t=Ul(),s=[];for(const n of a.gear){const o=e.inventory.find(i=>i.uid===n.uid);(!o||!xx(o,t))&&s.push(ss(n))}for(const[n,o]of a.cards)(e.cards[n]??0)<o&&s.push(qt(n));for(const[n,o]of a.ores)(e.materials[n]??0)<o&&s.push(Ft(n));return e.kafra<a.kafra&&s.push(c("Puntos Kafra")),s}const H0={account:F0,missing:a=>y3(a,F0()),settled:()=>void y1()};function F0(){const a=xt(),e=b1();if(!e)return{...a,inventory:[],cards:{},materials:{},kafra:0};const t=new Set(e.uids),s=(n,o)=>Object.fromEntries(Object.entries(n).map(([i,r])=>[i,Math.min(r,o[Number(i)]??0)]).filter(([,i])=>Number(i)>0));return{...a,inventory:a.inventory.filter(n=>t.has(n.uid)),cards:s(a.cards,e.cards),materials:s(a.materials,e.ores),kafra:Math.min(a.kafra,e.kafra)}}function z0(a){const e=[...a.gear.map(t=>ss(t)),...a.cards.map(([t,s])=>`${qt(t)}${s>1?` ×${s}`:""}`),...a.ores.map(([t,s])=>`${Ft(t)} ×${s}`),a.kafra?`${Em(a.kafra)} ${c("Puntos Kafra")}`:""].filter(Boolean);return e.length?e.join(", "):c("nada")}class v3{constructor(e,t,s){g(this,"actions");g(this,"ledger");g(this,"mine",D0());g(this,"theirs",D0());g(this,"me",{lock:!1,ok:!1});g(this,"them",{lock:!1,ok:!1});g(this,"filter","gear");g(this,"note","");this.ledger=t,this.actions=s,Ve("tr-title").textContent=c("Comercio con  {
        name
      }
      ",{name:e}),Ve("tr-their-title").textContent=c(" {
        name
      }
       ofrece",{name:e}),Ve("tr-log").innerHTML="",Ve("tr-input").value="";const n=Ve("tr-form");n.onsubmit=i=>{i.preventDefault();const r=Ve("tr-input"),l=r.value.trim();l&&this.actions.chat(l),r.value=""};const o=Ve("tr-kafra");o.value="0",o.onchange=()=>{const i=Math.max(0,Math.min(this.ledger.account().kafra,Math.floor(Number(o.value)||0)));o.value=String(i),i!==this.mine.kafra&&this.change(()=>this.mine.kafra=i)},Ve("tr-lock").onclick=()=>{const i=this.ledger.missing(this.mine);if(i.length)return this.setNote(c("Ya no tienes:  {
        list
      }
      .",{list:i.join(", ")}));this.actions.lock()},Ve("tr-confirm").onclick=()=>{if(this.ledger.missing(this.mine).length)return this.setNote(c("Ya no tienes todo lo que ofreces: cancela el comercio."));this.actions.confirm()},Ve("tr-cancel").onclick=()=>this.actions.cancel(),this.render(),Ue("trade")}theirOffer(e){this.theirs=e,this.render()}state(e,t){this.me=e,this.them=t,this.render()}chat(e,t,s){const n=Ve("tr-log"),o=document.createElement("div");o.className=`chat-line${s?" self":""}`;const i=document.createElement("b");i.textContent=`${e}: `,o.append(i,t),n.append(o),n.scrollTop=n.scrollHeight}close(){lc(),de("trade")}change(e){this.me.lock||(e(),this.note="",this.actions.offer(this.mine),this.render())}setNote(e){this.note=e,this.render()}render(){const e=this.ledger.account(),t=Ul(),s=this.me.lock,n=new Set(this.mine.gear.map(m=>m.uid)),o=(m,f)=>{var v;return((v=m.find(([x])=>x===f))==null?void 0:v[1])??0},i=(m,f)=>[...m.gear.map(v=>`<div class="item-cell$ {
        v.quality?` q${v.quality}`:""
      }
      " data-uid="$ {
        sd(v.uid)
      }
      " data-side="$ {
        f?"m":"t"
      }
      "><img src="$ {
        Me(v.itemId)
      }
      ">${v.refine?`<span class="qty">+${v.refine}</span>`:""}</div>`),...m.cards.map(([v,x])=>`<div class="item-cell" data-card="$ {
        v
      }
      " data-uid="c$ {
        v
      }
      " data-side="$ {
        f?"m":"t"
      }
      "><img src="$ {
        se.icons.get("card")
      }
      "><span class="qty">${x}</span></div>`),...m.ores.map(([v,x])=>`<div class="item-cell" data-ore="$ {
        v
      }
      " data-uid="o$ {
        v
      }
      " data-side="$ {
        f?"m":"t"
      }
      "><img src="$ {
        Me(v)
      }
      "><span class="qty">${x}</span></div>`)].join("")||`<div class="empty-note">${c("Nada todavía.")}</div>`;Ve("tr-mine-items").innerHTML=i(this.mine,!0),Ve("tr-theirs-items").innerHTML=i(this.theirs,!1),Ve("tr-their-kafra").innerHTML=`${c("Puntos Kafra")}: <b>${Em(this.theirs.kafra)}</b>`;const r=Ve("tr-kafra");r.disabled=s,r.max=String(e.kafra),Ve("tr-kafra-have").textContent=`/ ${Em(e.kafra)}`;const l=m=>m.ok?`<span class="tr-badge ok">${c("Confirmado")}</span>`:m.lock?'<span class="tr-badge lock">OK</span>':"";Ve("tr-my-state").innerHTML=l(this.me),Ve("tr-their-state").innerHTML=l(this.them),Ve("trade").classList.toggle("tr-locked",s);const d=e.inventory.filter(m=>xx(m,t)&&!n.has(m.uid)),h=Object.entries(e.cards).map(([m,f])=>[Number(m),f-o(this.mine.cards,Number(m))]).filter(([,m])=>m>0),u=g3.map(m=>[m,(e.materials[m]??0)-o(this.mine.ores,m)]).filter(([,m])=>m>0),p=[["gear",c("Equipo"),d.length],["cards",c("Cartas"),h.length],["ores",c("Minerales"),u.length]];Ve("tr-filters").innerHTML=p.map(([m,f,v])=>`<button class="inv-chip$ {
        m===this.filter?" active":""
      }
      " data-f="$ {
        m
      }
      ">${f} <small>${v}</small></button>`).join(""),Ve("tr-filters").querySelectorAll(".inv-chip").forEach(m=>{m.onclick=()=>{this.filter=m.dataset.f,this.render()}});const y=this.filter==="gear"?d.map(m=>`<div class="item-cell$ {
        m.quality?` q${m.quality}`:""
      }
      " data-uid="$ {
        sd(m.uid)
      }
      " data-side="i"><img src="$ {
        Me(m.itemId)
      }
      ">${m.refine?`<span class="qty">+${m.refine}</span>`:""}</div>`):this.filter==="cards"?h.map(([m,f])=>`<div class="item-cell" data-card="$ {
        m
      }
      " data-uid="c$ {
        m
      }
      " data-side="i"><img src="$ {
        se.icons.get("card")
      }
      "><span class="qty">${f}</span></div>`):u.map(([m,f])=>`<div class="item-cell" data-ore="$ {
        m
      }
      " data-uid="o$ {
        m
      }
      " data-side="i"><img src="$ {
        Me(m)
      }
      "><span class="qty">${f}</span></div>`);Ve("tr-inv").innerHTML=y.join("")||`<div class="empty-note">${c("No tienes nada de esto que puedas dar.")}</div>`,Ve("tr-lock").disabled=s,Ve("tr-confirm").disabled=!(this.me.lock&&this.them.lock)||this.me.ok,Ve("tr-note").innerHTML=this.note?sd(this.note):this.me.ok?c("Esperando a que el otro confirme…"):this.me.lock&&this.them.lock?c("Los dos habéis dado el OK: pulsa Comerciar para hacer el intercambio."):this.me.lock?c("Esperando el OK del otro…"):c("Añade lo que quieras dar y pulsa OK. Si algo cambia, hay que volver a dar el OK.");const w=m=>{const f=m.dataset.side,v=f==="t"?this.theirs:this.mine;if(m.dataset.card)return Fh(Number(m.dataset.card));if(m.dataset.ore)return`<div class="tip-item"><img class="tip-icon" src="$ {
        Me(Number(m.dataset.ore))
      }
      "><div><b>${sd(Ft(Number(m.dataset.ore)))}</b><div class="muted">${c("Mineral de refine")}</div></div></div>`;const x=f==="i"?e.inventory.find(k=>k.uid===m.dataset.uid):v.gear.find(k=>k.uid===m.dataset.uid);return x?rc(x):""};for(const m of["tr-mine-items","tr-theirs-items","tr-inv"])to(Ve(m),".item-cell",w);Ve("tr-inv").querySelectorAll(".item-cell").forEach(m=>{m.onclick=()=>this.change(()=>{if(m.dataset.card)this.addStack(this.mine.cards,Number(m.dataset.card),1);else if(m.dataset.ore)this.addStack(this.mine.ores,Number(m.dataset.ore),1);else{const f=e.inventory.find(v=>v.uid===m.dataset.uid);if(!f)return;if(this.mine.gear.length>=S0)return void(this.note=c("Como mucho  {
        n
      }
       piezas por comercio.",{n:S0}));this.mine.gear.push({uid:f.uid,itemId:f.itemId,cards:f.cards,quality:f.quality,refine:f.refine,affixes:f.affixes,ilvl:f.ilvl,tier:f.tier})}})}),Ve("tr-mine-items").querySelectorAll(".item-cell").forEach(m=>{m.onclick=()=>this.change(()=>{m.dataset.card?this.addStack(this.mine.cards,Number(m.dataset.card),-1):m.dataset.ore?this.addStack(this.mine.ores,Number(m.dataset.ore),-1):this.mine.gear=this.mine.gear.filter(f=>f.uid!==m.dataset.uid)})})}addStack(e,t,s){const n=e.findIndex(([o])=>o===t);if(n<0){s>0&&e.push([t,s]);return}e[n][1]+=s,e[n][1]<=0&&e.splice(n,1)}}const b3=a=>a.replace(/[&<>"]/g,e=>( {
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
      })[e]),w3=a=>new Date(a).toLocaleString(Ia(), {
        dateStyle:"medium",timeStyle:"short"
      });
      function k3(a) {
        return a.kind==="warn"?c("Advertencia del equipo de RO Life: {reason}", {
          reason:a.reason
        }):a.kind==="mute"?a.until?c("Te hemos silenciado en el chat hasta el {date}. Motivo: {reason}", {
          date:w3(a.until),reason:a.reason
        }):c("Te hemos silenciado en el chat para siempre. Motivo: {reason}", {
          reason:a.reason
        }):a.kind==="strip"?a.pieces===1?c("Hemos quitado 1 pieza de tu cuenta. Motivo: {reason}", {
          reason:a.reason
        }):c("Hemos quitado {n} piezas de tu cuenta. Motivo: {reason}", {
          n:a.pieces,reason:a.reason
        }):a.what==="mute"?c("Se ha levantado tu silencio: ya puedes volver a escribir en el chat."):c("Se ha levantado el bloqueo de tu cuenta.")
      }
      function x3(a,e) {
        const t=k3(a);
        e==null||e.system(t);
        const s=a.kind==="strip"?y1().catch(()=>{}):null;
        Ae(c("Aviso del equipo de RO Life"),b3(t),[ {
          label:c("Entendido"),primary:!0,run:s?()=>void s.then(()=>location.reload()):void 0
        }
        ])
      }
      const U0= {
        abuse:"insultos o acoso",spam:"spam",rmt:"venta por dinero real",cheat:"trampas",other:"saltarse las normas"
      };
      function M3(a) {
        const e=a.days===null?c("para siempre"):a.days===1?c("durante 1 día"):c("durante {n} días", {
          n:a.days
        }),t=c(U0[a.why]??U0.other);
        return a.kind==="ban"?c("Sanción a {name}: cuenta bloqueada {time} por {why}.", {
          name:a.name,time:e,why:t
        }):c("Sanción a {name}: silencio en el chat {time} por {why}.", {
          name:a.name,time:e,why:t
        })
      }
      const rp=a=>Te.profanityFilter?_k(a,"strict"):a;
      function $3(a,e) {
        switch(a) {
          case"sent":return c("Petición de amistad enviada a {name}. Saldrá en tu lista cuando la acepte.", {
            name:e
          });
          case"added":return c("{name} y tú ya sois amigos.", {
            name:e
          });
          case"removed":return c("{name} ya no está en tu lista de amigos.", {
            name:e
          });
          case"notFound":return c("No hay ningún personaje con cuenta que se llame {name}.", {
            name:e
          });
          case"self":return c("Ese personaje es tuyo.");
          case"already":return c("{name} ya es tu amigo.", {
            name:e
          });
          case"full":return c("Tu lista de amigos está llena.");
          case"fullThem":return c("La lista de amigos de {name} está llena.", {
            name:e
          });
          case"pending":return c("{name} tiene demasiadas peticiones sin contestar. Prueba más tarde.", {
            name:e
          });
          default:return c("Para tener amigos necesitas una cuenta: créala desde la selección de personaje.")
        }
      }
      const G0=a=> {
        a.classList.add("guest"),a.dataset.guest=c("Invitado")
      },V0= {
        roX:0,roZ:40
      },K0=1024,S3=1152,lp=170,W0=480,E3=-100,Y0=88,T3=92;
      class C3 {
        constructor(e,t,s,n,o) {
          g(this,"world3d");
          g(this,"map");
          g(this,"entityLayer",new Je);
          g(this,"player");
          g(this,"walk");
          g(this,"ambient");
          g(this,"npcs",[]);
          g(this,"center");
          g(this,"keys",new Set);
          g(this,"touchMove", {
            x:0,y:0
          });
          g(this,"ui",document.getElementById("lobby-ui"));
          g(this,"prompt",document.getElementById("lobby-prompt"));
          g(this,"nameLabel");
          g(this,"near",null);
          g(this,"lastFrame",performance.now());
          g(this,"cleanup",[]);
          g(this,"classDef");
          g(this,"mouse",null);
          g(this,"isRotating",()=>!1);
          g(this,"movePath",null);
          g(this,"talkTo",null);
          g(this,"net",null);
          g(this,"others",new Map);
          g(this,"sendIn",0);
          g(this,"lastSent","");
          g(this,"look",null);
          g(this,"profile",null);
          g(this,"menu",null);
          g(this,"inspecting",null);
          g(this,"guests",new Set);
          g(this,"trade",null);
          g(this,"tradeAsk",null);
          g(this,"party",null);
          g(this,"partyAsk",!1);
          g(this,"tripAsk",!1);
          g(this,"mailHook",null);
          g(this,"partyHooks",null);
          g(this,"channel",0);
          g(this,"onlineEl",document.getElementById("lobby-online"));
          g(this,"channelList",null);
          g(this,"channelsIn",0);
          g(this,"status","offline");
          g(this,"myId",-1);
          g(this,"chat",null);
          g(this,"friends",null);
          g(this,"bubbles",new Map);
          g(this,"emotes",[]);
          g(this,"pet",null);
          g(this,"petId",null);
          g(this,"picking",!1);
          g(this,"fullTimer",0);
          g(this,"farJoin","");
          g(this,"farWaiting",!1);
          g(this,"labelSize",new Map);
          this.map=e,this.classDef=t,this.world3d=new iw(e,document.getElementById("stage")),gC("plaza",t.id,this.world3d),this.ambient=new tk(e),this.walk=e.walk?new sk(e.walk.w,e.walk.h,e.walk.mask):null;
          const i=De/e.zoom;
          this.center= {
            x:(e.width*e.zoom/2+V0.roX)*i,y:(e.height*e.zoom/2-V0.roZ)*i
          },this.entityLayer.sortableChildren=!0,this.player=new Al(t,s),[this.player.x,this.player.y]=this.spot(0,330),this.player.facingY=-1,this.entityLayer.addChild(this.player.view),P0(()=>this.player),this.nameLabel=this.addLabel(n,"lobby-name self"),Pa()||G0(this.nameLabel),this.ui.classList.remove("hidden"),this.bindInput(),this.bindPad(),Qe||(this.mouse=new ek(o.canvas,this.world3d,o.stage, {
            moveTo:(r,l)=>this.moveTo(r,l),pick:(r,l)=>this.pickPlayer(r,l),rotating:()=>this.isRotating()
          })),qe.targetZoom=Math.max(qe.targetZoom,.3),B.music("prontera"),this.warpFx(this.player.x,this.player.y)
        }
        spot(e,t) {
          const s=this.center.x+e,n=this.center.y+t;
          return this.walk?this.walk.nearestWalkable(s,n):[s,n]
        }
        addLabel(e,t) {
          const s=document.createElement("div");
          return s.className=t,s.textContent=e,document.getElementById("lobby-labels").appendChild(s),s
        }
        addNpc(e,t,s,n,o,i,r,l) {
          if(!se.sheetInfo(t)) {
            console.warn(`Sprite no extraído: ${t}`);
            return
          }
          const[d,h]=this.spot(o,i),u=new Je,p=Gm(new Vo().ellipse(0,0,16,6).fill( {
            color:0,alpha:.35
          }),"shadow",0,.4),y=new sn(se.sheet(t),"idle");
          y.dir=r,u.addChild(p,y),u.position.set(d,h),u.zIndex=h,this.entityLayer.addChild(u);
          const w=y.sheet.action("idle").dirs,m=w[r%w.length].map(v=>v.defaultAnchor.y*v.frame.height).sort((v,x)=>v-x),f=m[m.length>>1];
          this.npcs.push( {
            id:e,name:s,action:n,x:d,y:h,view:u,label:this.addLabel(s,"lobby-name npc"),top:f,onTalk:l
          })
        }
        setNpcAlert(e,t) {
          var o,i;
          const s=(o=this.npcs.find(r=>r.id===e))==null?void 0:o.label;
          if(!s||((i=s.querySelector(".npc-alert"))==null||i.remove(),!t))return;
          const n=document.createElement("span");
          n.className="npc-alert",s.append(n),n3(0).then(r=>r&&n.append(r))
        }
        setPet(e) {
          e&&!cf(e)&&(e=null),e!==this.petId&&(this.petId=e,this.pet&&(this.entityLayer.removeChild(this.pet.view),this.pet.destroy(),this.pet=null),e&&(this.pet=new Bf(e,this.player.x,this.player.y),this.entityLayer.addChild(this.pet.view)))
        }
        setAvatar(e,t,s) {
          var i,r;
          const n=this.player,o=new Al(this.classDef,e);
          o.x=n.x,o.y=n.y,o.facingX=n.facingX,o.facingY=n.facingY,this.entityLayer.removeChild(n.view),n.view.destroy( {
            children:!0
          }),this.player=o,this.entityLayer.addChild(o.view),t&&(this.look=t,(i=this.net)==null||i.send( {
            t:"look",look:t
          })),s&&(this.profile=s,(r=this.net)==null||r.send( {
            t:"profile",p:s
          }))
        }
        goOnline(e,t,s) {
          this.look=t,this.profile=s;
          const n=()=>this.player;
          this.net=new Xj(()=>( {
            name:e,look:this.look,x:n().x,y:n().y,f:Mm(n().facingX,n().facingY,n().sitting)
          }), {
            status:(o,i)=>this.showStatus(o,i),welcome:(o,i,r)=> {
              var l,d,h;this.myId=o,(l=this.nameLabel)==null||l.classList.toggle("gm",r),this.clearOthers();for(const u of i)this.addOther(u);this.lastSent="",this.profile&&((d=this.net)==null||d.send( {
                t:"profile",p:this.profile
              })),this.farJoin&&((h=this.net)==null||h.send( {
                t:"partyJoinFar",name:this.farJoin
              }),this.farJoin="",this.farWaiting=!0)
            },join:o=> {
              var i;(i=this.others.get(o.id))==null||i.destroy(),this.addOther(o),this.warpFx(o.x,o.y),this.showStatus("online")
            },leave:o=> {
              var r;((r=this.menu)==null?void 0:r.id)===o&&this.closeMenu();const i=this.others.get(o);i&&this.warpFx(i.x,i.y),i==null||i.destroy(),this.others.delete(o),this.showStatus("online")
            },moves:o=> {
              var i;for(const[r,l,d,h]of o)(i=this.others.get(r))==null||i.push(l,d,h)
            },look:(o,i)=> {
              var r;return void((r=this.others.get(o))==null?void 0:r.setLook(i))
            },chat:o=> {
              var r;const i=rp(o.text);(r=this.chat)==null||r.add(o.ch,o.name,i,o.id===this.myId,o.id,o.c,o.gm),(o.ch==="local"&&$m("local")||o.ch==="party")&&this.bubble(o.id,i,o.ch==="party")
            },whisper:o=> {
              var i;return(i=this.chat)==null?void 0:i.whisper(o.out,o.name,rp(o.text),o.id,o.c,o.gm)
            },whisperErr:o=> {
              var i;return(i=this.chat)==null?void 0:i.whisperFailed(o)
            },friends:(o,i)=> {
              var r;return(r=this.friends)==null?void 0:r.set(o,i)
            },friendAsk:o=> {
              var r;const i=o.replace(/[&<>"]/g,"");(r=this.chat)==null||r.system(c(" {
                name
              }
               quiere ser tu amigo.",{name:i})),Ae(c("Amigos"),c("<b> {
                name
              }
              </b> quiere ser tu amigo.",{name:i}),[{label:c("Rechazar"),run:()=>{var l;return(l=this.net)==null?void 0:l.send({t:"friendReply",name:o,ok:!1})}},{label:c("Aceptar"),primary:!0,run:()=>{var l;return(l=this.net)==null?void 0:l.send({t:"friendReply",name:o,ok:!0})}}])},friendNote:(o,i)=>{var l,d;const r=$3(o,i??"");(l=this.chat)==null||l.system(r),(d=this.friends)==null||d.note(r)},reported:o=>{var i;return(i=this.chat)==null?void 0:i.system(o?c("Denuncia enviada. La revisaremos, gracias por avisar."):c("Ya has denunciado a este jugador hace poco."))},chatErr:(o,i)=>{var r;return(r=this.chat)==null?void 0:r.system(o==="guest"?c("Para escribir en el chat necesitas una cuenta: créala desde la selección de personaje."):o==="muted"?i?c("Estás silenciado en el chat hasta el  {
                date
              }
              .",{date:new Date(i).toLocaleString(Ia(),{dateStyle:"medium",timeStyle:"short"})}):c("Estás silenciado en el chat."):c("Escribes demasiado rápido. Espera un momento."))},notice:o=>x3(o,this.chat),mail:()=>{var o,i;(o=this.chat)==null||o.system(c("Te ha llegado una carta: pásate por el Cartero de la plaza.")),(i=this.mailHook)==null||i.call(this)},announce:o=>{var i;return(i=this.chat)==null?void 0:i.announce(M3(o))},emote:(o,i)=>this.showEmote(o,i),trade:o=>this.onTrade(o),party:o=>{var r,l,d,h,u;const i=(r=this.party)==null?void 0:r.inParty;if((l=this.party)==null||l.set(o),(d=this.chat)==null||d.setParty(!!o),this.tagParty(),o?this.farWaiting=!1:i&&this.offerHome(),o&&!i){(h=this.chat)==null||h.system(c("Estás en un grupo. Escribe en el canal Grupo para hablar con él."));const p=(u=this.party)==null?void 0:u.leaderElsewhere;p&&Ae(c("Grupo"),c("El líder del grupo está en el canal  {
                c
              }
              . ¿Vas con él?",{c:p}),[{label:c("Quedarme"),run:()=>{}},{label:c("Ir al canal  {
                c
              }
              ",{c:p}),primary:!0,run:()=>this.hop(p)}])}},partyAsk:(o,i)=>{this.partyAsk=!0,Ae(c("Grupo"),c("<b> {
                name
              }
              </b> te invita a su grupo.",{name:i.replace(/[&<>"]/g,"")
            }),[ {
              label:c("Rechazar"),run:()=>this.replyParty(!1)
            }, {
              label:c("Aceptar"),primary:!0,run:()=>this.replyParty(!0)
            }
            ])
          },partyAskFar:(o,i)=> {
            const r=o.replace(/[&<>"]/g,"");Ae(c("Grupo"),c("<b> {
              name
            }
            </b> te invita a su grupo en <b> {
              l
            }
            </b>. Si aceptas, te cambias a  {
              l
            }; al salir del grupo podrás volver.",{name:r,l:Ua(i)}),[{label:c("Rechazar"),run:()=>{var l;return(l=this.net)==null?void 0:l.send({t:"partyReplyFar",name:o,ok:!1})}},{label:c("Aceptar"),primary:!0,run:()=>this.acceptFar(o,i)}])},partyErr:(o,i)=>{if(this.farWaiting&&(o==="timeout"||o==="gone"||o==="full"))return this.farWaiting=!1,this.onPartyErr(o,i),this.offerHome();this.onPartyErr(o,i)},partyCheck:(o,i)=>this.onPartyCheck(o,i),partyCheckEnd:(o,i)=>this.onPartyCheckEnd(o,i),partyStart:o=>{var i,r;(i=this.party)==null||i.setCheck(null),this.closeTripAsk(),(r=this.partyHooks)==null||r.start(o)},profile:(o,i,r,l)=>{var u;if(o!==this.inspecting)return;this.inspecting=null;const d=this.others.get(o),h=d?{name:d.name,look:d.look}:r&&l?{name:r,look:l}:null;i&&h?f3(h.name,h.look,i):(u=this.chat)==null||u.system(c("No se puede inspeccionar a ese jugador ahora."))},channels:(o,i)=>this.renderChannels(o,i),hopErr:o=>{var i;return(i=this.chat)==null?void 0:i.system(o==="full"?c("Ese canal está lleno."):c("Espera un momento antes de cambiar otra vez de canal."))},queue:(o,i)=>{this.onlineEl.textContent=c("Plaza llena · en la cola:  {
              p
            }
             de  {
              n
            }
            ",{p:o,n:i})},full:o=>{var i;(i=this.chat)==null||i.system(c(" {
              l
            }
             está lleno: elige otro lobby.",{l:Ua(o)})),this.pickLobby()}}),Ld()||this.pickLobby(),this.party=new a3({leave:()=>sa(c("Grupo"),c("¿Salir del grupo?"),c("Salir"),()=>{var o;return(o=this.net)==null?void 0:o.send({t:"partyLeave"})}),kick:o=>{var i;return(i=this.net)==null?void 0:i.send({t:"partyKick",mid:o})},lead:o=>{var i;return(i=this.net)==null?void 0:i.send({t:"partyLead",mid:o})},cancelTrip:()=>{var o;return(o=this.net)==null?void 0:o.send({t:"partyReady",ok:!1})},hop:o=>this.hop(o)}),this.chat=new h3({send:(o,i)=>{var r;return!!((r=this.net)!=null&&r.send({t:"chat",ch:o,text:i}))},whisper:(o,i)=>{var r;return!!((r=this.net)!=null&&r.send({t:"whisper",to:o,text:i}))},emote:o=>{var i;return((i=this.net)==null?void 0:i.send({t:"emote",e:o}))||this.showEmote(this.myId,o)},command:o=>this.command(o),onFocus:()=>this.keys.clear(),pick:(o,i,r,l,d)=>this.openMenu({id:o,name:i,channel:r},{x:l,y:d}),setCn:o=>{var i;return(i=this.net)==null?void 0:i.send({t:"chatCn",on:o})}}),this.friends=new u3({add:o=>{var i,r;(i=this.net)!=null&&i.send({t:"friendAdd",name:o})||(r=this.friends)==null||r.note(c("Sin conexión."))},reply:(o,i)=>{var r;return(r=this.net)==null?void 0:r.send({t:"friendReply",name:o,ok:i})},inviteFar:o=>{var i,r,l;if(!((i=this.net)!=null&&i.send({t:"partyInviteFar",name:o})))return(r=this.friends)==null?void 0:r.note(c("Sin conexión."));(l=this.chat)==null||l.system(c("Has invitado a  {
              name
            }
             al grupo. Esperando respuesta…",{name:o}))},remove:o=>sa(c("Amigos"),c("¿Quitar a <b> {
              name
            }
            </b> de tus amigos?",{name:o.replace(/[&<>"]/g,"")
          }),c("Quitar de amigos"),()=> {
            var i;
            return(i=this.net)==null?void 0:i.send( {
              t:"friendRemove",name:o
            })
          }),menu:(o,i,r,l,d,h)=>this.openMenu( {
            id:o,name:i,channel:r
          }, {
            x:l,y:d
          },h),closeMenu:()=>this.closeMenu()
        },()=>this.channel),this.onlineEl.onclick=()=>this.status==="online"?this.toggleChannels():this.status!=="connecting"&&this.status!=="queue"?void this.pickLobby():void 0
      }
      async pickLobby() {
        if(this.picking||!this.net)return;
        this.picking=!0,clearTimeout(this.fullTimer);
        const e=await C0(0);
        this.picking=!1;
        const t=this.net;
        if(!t)return;
        if(!(e!=null&&e.length))return t.switchLobby(Ld()||E0()||1);
        const s=e.filter(i=>i.up&&i.state!=="full");
        if(!s.length)return this.allFull();
        if(e.length===1)return t.switchLobby(s[0].id);
        const n=Ld()||E0(),o=e.map(i=> {
          const r=i.up?i.state:"full",l=i.up?r==="full"?c("Lleno"):r==="crowded"?c("Concurrido"):c("Normal"):c("Sin respuesta");return`<button class="${["ch-row","lb",r==="full"?"full":"",i.id===n?"me":""].filter(Boolean).join(" ")}" data-lb="${i.id}"${r==="full"?" disabled":""}><b>${Ua(i.id)}</b><small class="${r}">${l}</small>${i.id===n?`<em>$ {
            c("La última vez")
          }
          </em>`:""}</button>`
        }).join("");
        Ae(c("Elige un lobby"),`<p>${c("Cada lobby tiene su plaza, sus canales y su chat. Tus amigos y la Endless Tower son los mismos en todos.")}</p><div class="lb-pick">${o}</div>`,[ {
          label:c("Jugar sin conexión"),run:()=>this.showStatus("offline")
        }
        ]);
        for(const i of document.querySelectorAll("#npc-text [data-lb]"))i.onclick=()=> {
          var r;
          de("npc-dialog"),(r=this.net)==null||r.switchLobby(Number(i.dataset.lb))
        }
      }
      acceptFar(e,t) {
        var n;
        const s=this.net;
        s&&((n=this.party)!=null&&n.inParty&&s.send( {
          t:"partyLeave"
        }),!T0()&&s.lobby!==t&&ed(s.lobby),this.farJoin=e,s.lobby===t?(s.send( {
          t:"partyJoinFar",name:e
        }),this.farJoin="",this.farWaiting=!0):s.switchLobby(t))
      }
      offerHome() {
        if(this.farJoin||this.farWaiting)return;
        const e=T0();
        if(!e||!this.net||e===this.net.lobby)return ed(0);
        Ae(c("Grupo"),c("Ya no estás en el grupo. ¿Vuelves a <b>{l}</b>, tu lobby de antes?", {
          l:Ua(e)
        }),[ {
          label:c("Quedarme aquí"),run:()=>ed(0)
        }, {
          label:c("Volver a {l}", {
            l:Ua(e)
          }),primary:!0,run:()=> {
            var t;ed(0),(t=this.net)==null||t.switchLobby(e)
          }
        }
        ])
      }
      allFull() {
        this.showStatus("full"),clearTimeout(this.fullTimer),this.fullTimer=window.setTimeout(()=>void this.pickLobby(),6e4)
      }
      hop(e) {
        var t,s;
        this.closeChannels(),e!==this.channel&&((t=this.net)!=null&&t.send( {
          t:"hop",n:e
        })||(s=this.chat)==null||s.system(c("Sin conexión.")))
      }
      toggleChannels() {
        var t;
        if(this.channelList)return this.closeChannels();
        if(!((t=this.net)!=null&&t.send( {
          t:"channels"
        })))return;
        const e=document.createElement("div");
        e.id="channel-list",e.innerHTML=`<div class="ch-head">${c("Lobbies")}</div><div class="ch-lobbies"></div><div class="ch-head">${c("Canales")}</div><div class="ch-rows"><small>${c("Cargando…")}</small></div>`,e.onclick=s=> {
          s.stopPropagation();
          const n=s.target.closest("[data-lb]");
          if(n&&!n.classList.contains("full")&&!n.classList.contains("me"))return this.switchLobby(Number(n.dataset.lb));
          const o=s.target.closest("[data-ch]");
          o&&!o.classList.contains("full")&&this.hop(Number(o.dataset.ch))
        },document.getElementById("lobby-place").append(e),this.channelList=e,this.channelsIn=3,C0(0).then(s=>this.renderLobbies(e,s??[]))
      }
      renderLobbies(e,t) {
        var o,i;
        const s=e.querySelector(".ch-lobbies");
        if(!s||this.channelList!==e)return;
        if(t.length<2)return(o=s.previousElementSibling)==null||o.remove(),s.remove();
        const n=(i=this.net)==null?void 0:i.lobby;
        s.innerHTML=t.map(r=> {
          const l=r.up?r.state:"full",d=r.id===n?c("Estás aquí"):r.up?l==="full"?c("Lleno"):l==="crowded"?c("Concurrido"):c("Normal"):c("Sin respuesta");return`<button class="${["ch-row","lb",r.id===n?"me":"",l==="full"&&r.id!==n?"full":""].filter(Boolean).join(" ")}" data-lb="${r.id}"><b>${Ua(r.id)}</b><small class="${l}">${d}</small></button>`
        }).join("")
      }
      switchLobby(e) {
        var s;
        this.closeChannels();
        const t=()=> {
          var n,o,i;
          (n=this.party)!=null&&n.inParty&&((o=this.net)==null||o.send( {
            t:"partyLeave"
          })),(i=this.net)==null||i.switchLobby(e)
        };
        if(!((s=this.party)!=null&&s.inParty))return t();
        sa(c("Cambiar de lobby"),c("Tu grupo es de este lobby: si te vas a <b>{l}</b>, sales del grupo.", {
          l:Ua(e)
        }),c("Cambiar de lobby"),t)
      }
      closeChannels() {
        var e;
        (e=this.channelList)==null||e.remove(),this.channelList=null
      }
      renderChannels(e,t) {
        var o,i;
        const s=(o=this.channelList)==null?void 0:o.querySelector(".ch-rows");
        if(!s)return;
        const n=new Set(((i=this.party)==null?void 0:i.members.filter(r=>r.online).map(r=>r.channel))??[]);
        s.innerHTML=e.map(([r,l])=> {
          const d=l>=sp&&!n.has(r),h=["ch-row",r===t?"me":"",d?"full":""].filter(Boolean).join(" "),u=Math.min(100,Math.round(l/sp*100)),p=r===t?c("Estás aquí"):n.has(r)?c("Tu grupo"):l?"":c("Vacío");return`<button class="${h}" data-ch="${r}"><b>${c("Canal {c}",{c:r})}</b><span class="ch-bar"><i style="width:${u}%"></i></span><small>${l}/${sp}</small>${p?`<em>$ {
            p
          }
          </em>`:""}</button>`
        }).join("")
      }
      warpFx(e,t) {
        const s=Za("tex_ring_blue"),n=De/2;
        if(s) {
          const i= {
            texture:s,duration:1400,animation:1,rotate:!0,fade:!0
          };
          this.world3d.addCylinder(e,t, {
            ...i,bottom:1.2*n,top:1.3*n,height:4.2*n,alpha:1,color:[.45,.65,1]
          }),this.world3d.addCylinder(e,t, {
            ...i,bottom:.8*n,top:1*n,height:5*n,delay:150,alpha:1,color:[.6,.8,1]
          }),this.world3d.addCylinder(e,t, {
            ...i,bottom:.45*n,top:.6*n,height:5.6*n,delay:300,alpha:.9,color:[.85,.95,1]
          })
        }
        const o=.6*Math.max(0,1-Math.hypot(e-this.player.x,t-this.player.y)/1400);
        o>.05&&B.play("ef_teleportation",o,3)
      }
      showEmote(e,t) {
        var o;
        const s=e===this.myId?this.player:(o=this.others.get(e))==null?void 0:o.player;
        if(!s)return;
        for(const i of this.emotes)i.parent===s.view&&i.destroy();
        const n=new sn(se.sheet("fx_emotion"),"a"+t);
        n.loop=!1,n.y=E3,s.view.addChild(n),this.emotes.push(n)
      }
      bubble(e,t,s=!1) {
        let n=this.bubbles.get(e);
        n||this.bubbles.set(e,n= {
          el:this.addLabel("","chat-bubble"),until:0
        }),n.el.classList.toggle("party",s),n.el.textContent=t,n.until=performance.now()+5e3+t.length*60
      }
      playerAt(e,t) {
        let s=null,n=-1/0;
        for(const o of this.others.values()) {
          if(!o.player)continue;
          const i=this.world3d.project(o.x,o.y),r=this.world3d.project(o.x,o.y,this.world3d.spriteLift(Y0)),l=i.y-r.y;
          l<=0||Math.abs(e-i.x)<l*.32&&t>r.y&&t<i.y+l*.08&&i.y>n&&(s=o,n=i.y)
        }
        return s
      }
      pickPlayer(e,t) {
        if(this.menuOpen())return!1;
        this.closeChannels();
        const s=this.playerAt(e,t);
        return s?(this.openMenu( {
          id:s.id,name:s.name,channel:this.channel
        }),!0):(this.closeMenu(),!1)
      }
      openMenu(e,t,s) {
        var y,w,m;
        this.closeMenu(),this.closeChannels();
        const n=document.createElement("div");
        n.className="player-menu",n.id="player-menu";
        const o=document.createElement("b");
        o.textContent=e.name;
        const i=document.createElement("button");
        i.className="ro-btn small",i.textContent=c("Inspeccionar"),i.onclick=()=> {
          var f,v;
          if(this.closeMenu(),!((f=this.net)!=null&&f.online))return(v=this.chat)==null?void 0:v.system(c("Sin conexión."));
          this.inspecting=e.id,this.net.send( {
            t:"inspect",id:e.id
          })
        };
        const r=document.createElement("button");
        r.className="ro-btn small",r.textContent=c("Comerciar"),r.onclick=()=> {
          var f,v,x;
          if(this.closeMenu(),!((f=this.net)!=null&&f.online))return(v=this.chat)==null?void 0:v.system(c("Sin conexión."));
          this.trade||(this.net.send( {
            t:"tradeReq",id:e.id
          }),(x=this.chat)==null||x.system(c("Has pedido comerciar a {name}. Esperando respuesta…", {
            name:e.name
          })))
        };
        const l=document.createElement("button");
        l.className="ro-btn small",l.textContent=c("Denunciar"),l.onclick=()=> {
          this.closeMenu(),this.askReport(e.id,e.name)
        };
        const d=document.createElement("button");
        d.className="ro-btn small",d.textContent=c("Susurrar"),d.onclick=()=> {
          var f;
          this.closeMenu(),de("friends"),(f=this.chat)==null||f.whisperTo(e.name)
        };
        const h=!Pa(),u=this.guests.has(e.id);
        d.disabled=h,r.disabled=h||u;
        const p=document.createElement("button");
        if(p.className="ro-btn small",p.textContent=c("Añadir amigo"),p.disabled=h||u,p.onclick=()=> {
          var f,v;this.closeMenu(),(f=this.net)!=null&&f.send( {
            t:"friendAdd",name:e.name
          })||(v=this.chat)==null||v.system(c("Sin conexión."))
        },n.append(o,i,d,...(y=this.friends)!=null&&y.has(e.name)?[]:[p],r,l),e.channel&&e.channel!==this.channel) {
          const f=document.createElement("button");
          f.className="ro-btn small",f.textContent=c("Ir al canal {c}", {
            c:e.channel
          }),f.onclick=()=> {
            this.closeMenu(),this.hop(e.channel)
          },n.append(f)
        }
        if(!((w=this.party)!=null&&w.has(e.id))&&((m=this.party)!=null&&m.canInvite)) {
          const f=document.createElement("button");
          f.className="ro-btn small",f.textContent=c("Invitar al grupo"),f.disabled=h||u,f.onclick=()=> {
            var v,x,k;
            if(this.closeMenu(),!((v=this.net)!=null&&v.online))return(x=this.chat)==null?void 0:x.system(c("Sin conexión."));
            this.net.send( {
              t:"partyInvite",id:e.id
            }),(k=this.chat)==null||k.system(c("Has invitado a {name} al grupo. Esperando respuesta…", {
              name:e.name
            }))
          },n.append(f)
        }
        if(h||u) {
          const f=document.createElement("small");
          f.className="menu-note",f.textContent=h?c("Crea una cuenta para susurrar, comerciar, tener amigos y jugar en grupo."):c("Juega como invitado: no puede comerciar, tener amigos ni jugar en grupo."),n.append(f)
        }
        if(t&&n.classList.add("at"),(s??document.getElementById(t?"lobby-ui":"lobby-labels")).appendChild(n),t) {
          const f=Jn(),v=n.getBoundingClientRect(),x=Math.max(8,Math.min(innerWidth-v.width-8,t.x-v.width/2)),k=t.y-v.height-8,M=Math.max(8,Math.min(innerHeight-v.height-8,k>=8?k:t.y+16));
          n.style.transform=`translate(${Math.round(x/f)}px, ${Math.round(M/f)}px)`
        }
        this.menu= {
          id:e.id,el:n,follow:!t
        }
      }
      askReport(e,t) {
        const s=[["abuse",c("Insultos o acoso")],["cheat",c("Trampas")],["rmt",c("Venta por dinero real (RMT)")],["spam",c("Spam")],["other",c("Otro motivo")]],n=document.createElement("b");
        n.textContent=t;
        const o=s.map(([i,r],l)=>`<label class="report-why"><input type="radio" name="report-why" value="${i}"${l?"":" checked"}> ${r}</label>`).join("");
        Ae(c("Denunciar"),`<p>${c("¿Por qué denuncias a {who}? Guardaremos sus últimos mensajes para revisarlo.",{who:n.outerHTML})}</p><div class="report-list">${o}</div>`,[ {
          label:c("Cancelar")
        }, {
          label:c("Denunciar"),primary:!0,run:()=> {
            var r,l,d;const i=(r=document.querySelector('input[name="report-why"]:checked'))==null?void 0:r.value;if(!((l=this.net)!=null&&l.online))return(d=this.chat)==null?void 0:d.system(c("Sin conexión."));this.net.send( {
              t:"report",id:e,why:i??"other"
            })
          }
        }
        ])
      }
      onTrade(e) {
        var s,n,o,i,r,l,d,h,u;
        const t=this.net;
        switch(e.t) {
          case"tradeAsk":this.tradeAsk=e.id,Ae(c("Comercio"),c("<b>{name}</b> quiere comerciar contigo.", {
            name:e.name.replace(/[&<>"]/g,"")}),[{label:c("Rechazar"),run:()=>this.replyTrade(e.id,!1)},{label:c("Aceptar"),primary:!0,run:()=>this.replyTrade(e.id,!0)}]);break;case"tradeOpen":yL(),this.closeMenu(),Ml(),(s=this.trade)==null||s.win.close(),this.trade=null,this.trade={name:e.name,win:new v3(e.name,H0,{offer:p=>t.send({t:"tradeOffer",o:p}),lock:()=>t.send({t:"tradeLock"}),confirm:()=>t.send({t:"tradeConfirm"}),cancel:()=>t.send({t:"tradeCancel"}),chat:p=>t.send({t:"tradeChat",text:p})})};break;case"tradeOffer":(n=this.trade)==null||n.win.theirOffer(e.o);break;case"tradeState":(o=this.trade)==null||o.win.state(e.me,e.them);break;case"tradeChat":(i=this.trade)==null||i.win.chat(e.name,rp(e.text),e.id===this.myId);break;case"tradeDone":{H0.settled(e.give,e.get);const p=((r=this.trade)==null?void 0:r.name)??"";(l=this.trade)==null||l.win.close(),this.trade=null,(d=this.chat)==null||d.system(c("Comercio con  {
              name
            }
             hecho. Has dado:  {
              give
            }
            . Has recibido:  {
              get
            }
            .",{name:p,give:z0(e.give),get:z0(e.get)}));break}case"tradeEnd":{this.tradeAsk!==null&&!this.trade&&(this.tradeAsk=null,de("npc-dialog")),(h=this.trade)==null||h.win.close(),this.trade=null;const p={cancel:c("Se ha cancelado el comercio."),declined:c("Ha rechazado comerciar contigo."),busy:c("Ese jugador está ocupado comerciando con otro."),gone:c("El otro jugador se ha ido."),timeout:c("La petición de comercio ha caducado."),guest:c("Para comerciar necesitas una cuenta: créala desde la selección de personaje."),guestThem:c("Ese jugador juega como invitado y no puede comerciar."),same:c("No puedes comerciar con tu propia cuenta."),missing:c("No se ha hecho el comercio: a alguien ya le faltaba algo de lo que ofrecía.")};(u=this.chat)==null||u.system(p[e.why]);break}}}notice(e){var t;(t=this.chat)==null||t.system(e)}inParty(){var e;return!!((e=this.party)!=null&&e.inParty)}isPartyLeader(){var e;return!!((e=this.party)!=null&&e.isLeader)}partyMembers(){var e;return((e=this.party)==null?void 0:e.members)??[]}proposeTrip(e){var t,s;(t=this.net)!=null&&t.send({t:"partyGo",trip:e})||(s=this.chat)==null||s.system(c("Sin conexión."))}onPartyCheck(e,t){var i,r,l,d,h,u;(i=this.party)==null||i.setCheck(t);const s=(r=this.party)==null?void 0:r.members.find(p=>p.id===this.myId);if(!s||t.includes(s.mid)){this.isPartyLeader()&&t.length===1&&((l=this.chat)==null||l.system(c("Esperando a que el grupo esté listo…")));return}if(this.tripAsk)return;this.tripAsk=!0;const n=this.party.leader,o=(d=this.partyHooks)==null?void 0:d.blocked(e);if(o){this.replyTrip(!1),(h=this.net)==null||h.send({t:"chat",ch:"party",text:c("No puedo entrar en ese stage:  {
              why
            }
            ",{why:o})}),Ae(c("Grupo"),`${c("No puedes ir a ese stage con el grupo:")} ${o}`,[{label:c("Vale"),primary:!0}]);return}Ae(c("Grupo"),c("<b> {
              name
            }
            </b> quiere salir con el grupo:  {
              trip
            }
            ",{name:((n==null?void 0:n.name)??"").replace(/[&<>"]/g,""),trip:((u=this.partyHooks)==null?void 0:u.describe(e))??e.stage
          }),[ {
            label:c("No"),run:()=>this.replyTrip(!1)
          }, {
            label:c("¡Listo!"),primary:!0,run:()=>this.replyTrip(!0)
          }
          ])
        }
        replyTrip(e) {
          var t;
          this.tripAsk&&(this.tripAsk=!1,(t=this.net)==null||t.send( {
            t:"partyReady",ok:e
          }))
        }
        closeTripAsk() {
          this.tripAsk&&(this.tripAsk=!1,de("npc-dialog"))
        }
        onPartyCheckEnd(e,t="") {
          var n,o;
          (n=this.party)==null||n.setCheck(null),this.closeTripAsk();
          const s= {
            declined:c("{name} no está listo: no se sale.", {
              name:t
            }),timeout:c("No todos han dicho que están listos a tiempo: no se sale."),gone:c("{name} se ha ido: no se sale.", {
              name:t
            }),away:c("{name} no está en la plaza: para salir juntos tenéis que estar todos aquí.", {
              name:t
            }),cancel:c("Se ha cancelado la salida del grupo."),full:c("Ahora mismo hay demasiadas partidas en grupo en el servidor: probad a salir dentro de un rato.")
          };
          (o=this.chat)==null||o.system(s[e])
        }
        replyParty(e) {
          var t;
          this.partyAsk&&(this.partyAsk=!1,(t=this.net)==null||t.send( {
            t:"partyReply",ok:e
          }))
        }
        onPartyErr(e,t="") {
          var n,o;
          if(this.partyAsk&&(e==="timeout"||e==="gone"))return this.partyAsk=!1,de("npc-dialog"),(n=this.chat)==null?void 0:n.system(c("La invitación al grupo ha caducado."));
          const s= {
            declined:c("{name} ha rechazado unirse al grupo.", {
              name:t
            }),busy:c("{name} ya está en un grupo o tiene una invitación pendiente.", {
              name:t
            }),full:c("El grupo está completo."),timeout:t?c("{name} no ha respondido a la invitación.", {
              name:t
            }):c("La invitación al grupo ha caducado."),notLeader:c("Solo el líder puede invitar al grupo."),kicked:c("Te han expulsado del grupo."),gone:t?c("{name} ha dejado el grupo.", {
              name:t
            }):c("Ese grupo ya no existe."),offline:c("Ese jugador ya no está en la plaza."),guest:c("Para jugar en grupo necesitas una cuenta: créala desde la selección de personaje."),guestThem:c("{name} juega como invitado y no puede unirse a un grupo.", {
              name:t
            })
          };
          (o=this.chat)==null||o.system(s[e])
        }
        replyTrade(e,t) {
          var s;
          this.tradeAsk===e&&(this.tradeAsk=null,(s=this.net)==null||s.send( {
            t:"tradeReply",id:e,ok:t
          }))
        }
        closeMenu() {
          var e;
          (e=this.menu)==null||e.el.remove(),this.menu=null
        }
        addOther(e) {
          const t=this.addLabel(e.name,"lobby-name other");
          e.guest&&(G0(t),this.guests.add(e.id)),e.gm&&t.classList.add("gm"),this.others.set(e.id,new bx(e,this.entityLayer,t,Uj)),this.tagParty()
        }
        tagParty() {
          var e;
          for(const[t,s]of this.others)s.label.classList.toggle("party",!!((e=this.party)!=null&&e.has(t))),s.label.dataset.tag=c("Grupo")
        }
        clearOthers() {
          for(const e of this.others.values())e.destroy();
          this.others.clear()
        }
        showStatus(e,t) {
          var o,i,r,l,d,h,u;
          const s=e==="online"&&this.status==="online"&&!!t&&t!==this.channel;
          t&&(this.channel=t),s?(this.closeMenu(),this.warpFx(this.player.x,this.player.y),(o=this.chat)==null||o.system(c("Has cambiado al canal {c}.", {
            c:t
          }))):e==="online"&&t?(r=this.chat)==null||r.system(c("Conectado a {l}, canal {c}.", {
            l:Ua((i=this.net)==null?void 0:i.lobby),c:t
          })):e==="offline"&&this.status==="online"?(l=this.chat)==null||l.system(c("Se ha perdido la conexión. Reconectando…")):e==="queue"&&this.status!=="queue"?(d=this.chat)==null||d.system(c("La plaza está llena: estás en la cola y entrarás solo en cuanto haya sitio.")):e==="full"&&this.status!=="full"&&((h=this.chat)==null||h.system(c("Todos los lobbies están llenos: juegas sin conexión y se volverá a probar cada minuto."))),e!=="online"&&this.closeChannels(),this.onlineEl.classList.toggle("pick",e==="online"||e==="offline"||e==="full"),this.status=e,e!=="online"&&this.clearOthers();
          const n=this.others.size+1;
          this.onlineEl.classList.toggle("online",e==="online"),this.onlineEl.textContent=e==="online"?`${Ua((u=this.net)==null?void 0:u.lobby)} · ${c("Canal {c} · {n}",{c:this.channel,n:n===1?c("1 jugador"):c("{n} jugadores",{n})})}`:e==="connecting"?c("Conectando…"):e==="queue"?c("Plaza llena · en la cola"):e==="full"?c("Lobbies llenos · sin conexión"):c("Sin conexión")
        }
        command(e) {
          return e.trim().toLowerCase()!=="/sit"?!1:(this.player.sitting=!this.player.sitting,!0)
        }
        sendPosition(e) {
          var r;
          if(!((r=this.net)!=null&&r.online)||(this.sendIn-=e,this.sendIn>0))return;
          this.sendIn=1/zj;
          const t=this.player,s=Math.round(t.x),n=Math.round(t.y),o=Mm(t.facingX,t.facingY,t.sitting),i=`${s},${n},${o}`;
          i!==this.lastSent&&(this.lastSent=i,this.net.send( {
            t:"move",x:s,y:n,f:o
          }))
        }
        bindPad() {
          let e=null;
          const t=i=>Math.hypot(i.x-this.player.x,i.y-this.player.y),s=()=>[...this.others.values()].filter(i=>t(i)<W0).sort((i,r)=>t(i)-t(r)),n=()=> {
            e=null,uy(null)
          },o=()=> {
            const i=e!==null?this.others.get(e):void 0;
            return i&&t(i)<W0?i:(e!==null&&n(),null)
          };
          rn("town",i=> {
            if(this.menuOpen())return!1;if(i.kind==="move") {
              const l=s();if(!l.length)return n(),!0;const d=l.findIndex(u=>u.id===e),h=l[d<0?i.dx>0?0:l.length-1:(d+i.dx+l.length)%l.length];return e=h.id,uy(h.label),!0
            }
            const r=o();return r?i.kind==="A"?(this.openMenu( {
              id:r.id,name:r.name,channel:this.channel
            }),!0):i.kind==="B"?(n(),!0):!1:!1
          },()=> {
            const i=o(),r=[];return i&&r.push(["A",c("Jugador: {name}", {
              name:i.name
            })],["B","Soltar"]),s().length&&r.push(["←/→","Jugadores"]),r
          }),rn("player-menu",i=>i.kind!=="B"?!1:(this.closeMenu(),!0))
        }
        bindInput() {
          const e=v=> {
            var x;
            return((x=v.target)==null?void 0:x.tagName)==="INPUT"||this.menuOpen()
          },t=v=> {
            if(v.key==="Escape"&&this.channelList)return this.closeChannels();
            if(v.key==="Escape"&&this.menu)return this.closeMenu();
            if(e(v))return;
            const x=v.key.toLowerCase();
            if(x==="enter"&&this.chat) {
              v.preventDefault(),this.keys.clear(),this.chat.focus();
              return
            }
            if((x===" "||x==="enter")&&this.near) {
              v.preventDefault(),this.keys.clear(),this.near.onTalk();
              return
            }
            if(x==="insert") {
              v.preventDefault(),this.player.sitting=!this.player.sitting;
              return
            }
            this.keys.add(x)
          },s=v=>this.keys.delete(v.key.toLowerCase()),n=()=>this.keys.clear();
          window.addEventListener("keydown",t),window.addEventListener("keyup",s),window.addEventListener("blur",n);
          const o=document.querySelector("#stage canvas:last-child")??document.getElementById("stage");
          let i=null;
          this.isRotating=()=>i!==null;
          const r=v=> {
            v.button===2&&(i=v.clientX)
          },l=v=> {
            i!==null&&(qe.targetYaw-=(v.clientX-i)*.005,i=v.clientX)
          },d=v=> {
            v.button===2&&(i=null)
          },h=v=>v.preventDefault(),u=v=> {
            v.preventDefault(),this.zoomBy(Math.exp(-v.deltaY*.001))
          },p=document.getElementById("stage");
          p.addEventListener("pointerdown",r);
          let y=null;
          const w=v=> {
            y=v.pointerType==="mouse"?null: {
              x:v.clientX,y:v.clientY,t:performance.now()
            }
          },m=v=> {
            if(y&&performance.now()-y.t<300&&Math.hypot(v.clientX-y.x,v.clientY-y.y)<12&&!this.pickPlayer(v.clientX,v.clientY)&&!this.menuOpen()) {
              const x=o.getBoundingClientRect(),k=this.world3d.pickGround(v.clientX-x.left,v.clientY-x.top);
              k&&this.moveTo(k.x,k.y)
            }
            y=null
          };
          p.addEventListener("pointerdown",w,!0),window.addEventListener("pointerup",m),window.addEventListener("pointermove",l),window.addEventListener("pointerup",d),p.addEventListener("contextmenu",h),p.addEventListener("wheel",u, {
            passive:!1
          });
          const f=Qe?new rw(o, {
            move:this.touchMove,rotateBy:v=>qe.targetYaw+=v,zoomBy:v=>this.zoomBy(v),holdKey:(v,x)=>x?this.keys.add(v):this.keys.delete(v)
          }):null;
          this.prompt.onclick=()=> {
            var v;
            return(v=this.near)==null?void 0:v.onTalk()
          },this.cleanup.push(()=> {
            window.removeEventListener("keydown",t),window.removeEventListener("keyup",s),window.removeEventListener("blur",n),p.removeEventListener("pointerdown",r),p.removeEventListener("pointerdown",w,!0),window.removeEventListener("pointerup",m),window.removeEventListener("pointermove",l),window.removeEventListener("pointerup",d),p.removeEventListener("contextmenu",h),p.removeEventListener("wheel",u),f==null||f.destroy()
          })
        }
        moveTo(e,t) {
          if(this.menuOpen())return;
          const s=this.player;
          if(this.talkTo=this.npcs.find(n=>Math.hypot(n.x-e,n.y-t)<60)??null,this.talkTo) {
            const n=Math.hypot(s.x-this.talkTo.x,s.y-this.talkTo.y)||1,o=Math.min(n,lp*.6);
            e=this.talkTo.x+(s.x-this.talkTo.x)/n*o,t=this.talkTo.y+(s.y-this.talkTo.y)/n*o
          }
          [e,t]=this.inPlaza(e,t),this.walk?([e,t]=this.walk.nearestWalkable(e,t),this.movePath=this.walk.pathTo(s.x,s.y,e,t)):this.movePath=[ {
            x:e,y:t
          }
          ]
        }
        inPlaza(e,t) {
          let s=Math.min(Math.abs(e-this.center.x),K0),n=Math.min(Math.abs(t-this.center.y),K0);
          const o=(s+n-S3)/2;
          return o>0&&(s-=o,n-=o),[this.center.x+Math.sign(e-this.center.x)*s,this.center.y+Math.sign(t-this.center.y)*n]
        }
        zoomBy(e) {
          qe.targetZoom=Math.max(0,Math.min(1,qe.targetZoom+Math.log(e)*1.1))
        }
        menuOpen() {
          return!!document.querySelector(".overlay:not(.hidden)")
        }
        tick(e) {
          var h;
          e=Math.min(e,.05);
          let t=0,s=0;
          if(!this.menuOpen()) {
            (this.keys.has("a")||this.keys.has("arrowleft"))&&(t-=1),(this.keys.has("d")||this.keys.has("arrowright"))&&(t+=1),(this.keys.has("w")||this.keys.has("arrowup"))&&(s-=1),(this.keys.has("s")||this.keys.has("arrowdown"))&&(s+=1);
            const u=Math.hypot(t,s),p=this.touchMove.x||this.touchMove.y?this.touchMove:it.move,y=Math.hypot(p.x,p.y);
            if(u>0)[t,s]=Rd(t/u,s/u);
            else if(y>0) {
              const w=Math.min(1,y*1.3)/y;
              [t,s]=Rd(p.x*w,p.y*w)
            }
            else[t,s]=[0,0];
            if(u>0||y>0)this.movePath=null,this.talkTo=null;
            else if(this.movePath) {
              const w=this.player;
              let m=this.movePath[0];
              for(;m&&Math.hypot(m.x-w.x,m.y-w.y)<6;)this.movePath.shift(),m=this.movePath[0];
              if(!m)this.movePath=null;
              else {
                const f=Math.hypot(m.x-w.x,m.y-w.y);
                [t,s]=[(m.x-w.x)/f,(m.y-w.y)/f]
              }
            }
          }
          const n=this.player,o=this.classDef.speed*ud;
          let i=n.x+t*o*e,r=n.y+s*o*e;
          [i,r]=this.inPlaza(i,r),[n.x,n.y]=this.walk?this.walk.resolve(n.x,n.y,i,r):[i,r],n.update(e,t,s),(h=this.pet)==null||h.update(e,n.x,n.y,this.walk?(u,p,y,w)=>this.walk.resolve(u,p,...this.inPlaza(y,w)):void 0),this.sendPosition(e),this.emotes=this.emotes.filter(u=>(!u.destroyed&&!u.finished&&u.update(e*1e3),u.destroyed||u.finished?(u.destroyed||u.destroy(),!1):!0));
          for(const u of this.others.values())u.update(e);
          for(const u of this.npcs)for(const p of u.view.children)p instanceof sn&&p.update(e*1e3);
          this.ambient.update(e,n.x,n.y,(u,p)=>this.world3d.project(u,p).x,window.innerWidth);
          let l=null,d=lp;
          for(const u of this.npcs) {
            const p=Math.hypot(u.x-n.x,u.y-n.y);
            p<d&&(d=p,l=u)
          }
          if(this.talkTo&&!this.movePath) {
            const u=this.talkTo;
            this.talkTo=null,Math.hypot(u.x-n.x,u.y-n.y)<lp&&(n.facingX=u.x-n.x,n.facingY=u.y-n.y,this.keys.clear(),u.onTalk())
          }
          l!==this.near&&(this.near=l,this.prompt.classList.toggle("hidden",!l),l&&(this.prompt.innerHTML=Qe?l.action:`${l.action} <kbd>${c("Espacio")}</kbd>`))
        }
        render() {
          var n,o,i,r;
          const e=performance.now(),t=Math.min(.1,(e-this.lastFrame)/1e3);
          this.lastFrame=e;
          const s=this.menuOpen()?0:(this.keys.has("q")?1:0)-(this.keys.has("e")?1:0)-it.look.x;
          s&&(qe.targetYaw+=s*t*1.3),it.look.y&&!this.menuOpen()&&this.zoomBy(Math.exp(-it.look.y*t*1.6)),dw(t),(n=this.mouse)==null||n.update(t,!this.menuOpen()),this.world3d.setView(this.player.x,this.player.y),this.world3d.render(this.entityLayer),this.place(this.nameLabel,this.player.x,this.player.y,-6);
          for(const l of this.others.values())l.label.hidden=!l.player,l.player&&this.place(l.label,l.x,l.y,-6);
          for(const[l,d]of this.bubbles) {
            const h=l===this.myId?this.player:(o=this.others.get(l))==null?void 0:o.player;
            !h||e>d.until?(d.el.remove(),this.bubbles.delete(l)):this.placeAbove(d.el,h.x,h.y,T3)
          }
          if(this.placeNpcLabels(),(i=this.menu)!=null&&i.follow) {
            const l=this.others.get(this.menu.id);
            l?this.placeAbove(this.menu.el,l.x,l.y,Y0+8):this.closeMenu()
          }
          this.channelList&&(this.channelsIn-=t)<=0&&(this.channelsIn=3,(r=this.net)==null||r.send( {
            t:"channels"
          }))
        }
        placeNpcLabels() {
          const e=[],t=this.npcs.map(s=> {
            let n=this.labelSize.get(s.label);return n!=null&&n.w||this.labelSize.set(s.label,n= {
              w:s.label.offsetWidth,h:s.label.offsetHeight
            }), {
              n:s,s:this.world3d.project(s.x,s.y,this.world3d.spriteLift(s.top+6)),size:n
            }
          });
          t.sort((s,n)=>n.s.y-s.s.y);
          for(const {
            n:s,s:n,size:o
          }
          of t) {
            const i=n.x-o.w/2,r=n.x+o.w/2;
            let l=n.y;
            for(let d=!0;d;) {
              d=!1;
              for(const h of e)i<h.r&&r>h.l&&l>h.t&&l-o.h<h.b&&(l=h.t-2,d=!0)
            }
            e.push( {
              l:i,r,t:l-o.h,b:l
            }),s.label.style.transform=`translate(${Math.round(n.x)}px, ${Math.round(l)}px) translate(-50%, -100%)`
          }
        }
        placeAbove(e,t,s,n) {
          const o=this.world3d.project(t,s,this.world3d.spriteLift(n));
          e.style.transform=`translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, -100%)`
        }
        place(e,t,s,n) {
          const o=this.world3d.project(t,s,n);
          e.style.transform=`translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, ${n<0?"0":"-100%"})`
        }
        destroy() {
          var e,t,s,n,o;
          yC(),P0(null),clearTimeout(this.fullTimer),(e=this.net)==null||e.close(),this.net=null,(t=this.chat)==null||t.destroy(),(s=this.friends)==null||s.destroy(),(n=this.party)==null||n.destroy(),this.closeMenu(),this.closeChannels(),this.onlineEl.onclick=null,this.onlineEl.classList.remove("pick"),Ml(),this.bubbles.clear(),this.clearOthers(),this.onlineEl.textContent="",this.cleanup.forEach(i=>i()),Fp("town"),Fp("player-menu"),this.prompt.onclick=null,(o=this.mouse)==null||o.destroy(),this.ui.classList.add("hidden"),this.prompt.classList.add("hidden"),document.getElementById("lobby-labels").innerHTML="",this.entityLayer.destroy( {
            children:!0
          }),this.world3d.dispose()
        }
      }
      const L3=new Set(["damageEnemy","applyStatus","ignite","igniteRing","vortexPull","raiseBastion","plantYggdrasil","summon","stealMorale","chainProvoked","vanishEnemy","fadeMobs","chargeWeapon","moveTo","addBuff","addChargeBuff","clearBuff","healPlayer","trickleHeal","hurtPlayer","hidePlayer","onSkillCast","shake","gainExp","killEnemy","revivePlayer","recomputeStats","storySpawn","spawnBoss","shareParty"]),A3=new Set(["orbit","buff"]),P3=()=>{};
      function j3(a) {
        return a?a.kind==="enemy"? {
          e:OS(a).map(e=>e.nid).filter(e=>e>0).slice(0,12)
        }
        :a.kind==="ground"? {
          x:Math.round(a.x),y:Math.round(a.y),r:Math.round(a.r)
        }
        : {
          r:Math.round(a.r)
        }
        :null
      }
      function _3(a,e) {
        if(!(!a||typeof a!="object")) {
          if("e"in a) {
            const t=(Array.isArray(a.e)?a.e:[]).map(s=>e.get(s)).filter(s=>!!s&&!s.dead);
            return t.length? {
              kind:"enemy",e:t[0],all:t,only:!0
            }
            :void 0
          }
          return"x"in a? {
            kind:"ground",x:a.x,y:a.y,r:a.r
          }
          : {
            kind:"self",r:a.r
          }
        }
      }
      class q3 {
        constructor(e,t) {
          g(this,"weapons",new Map);
          g(this,"view");
          g(this,"failed",new Set);
          this.avatar=t,this.view=new Proxy(e, {
            get:(s,n,o)=>n==="player"?this.avatar()??s.player:typeof n=="string"&&L3.has(n)?P3:n==="spendBuff"?()=>!1:n==="addProjectile"?i=> {
              i.ghost=!0,s.addProjectile(i)
            }
            :Reflect.get(s,n,o)
          })
        }
        play([e,t,s],n) {
          var r,l;
          const o=this.avatar();
          if(!o||o.dead||typeof e!="string"||this.failed.has(e))return;
          let i=this.weapons.get(e);
          if(!i) {
            const d=(l=(r=ce[e])==null?void 0:r.create)==null?void 0:l.call(r);
            if(!d)return void this.failed.add(e);
            this.weapons.set(e,i=d)
          }
          if(i.level=Math.max(1,Math.min(20,Math.round(Number(t))||1)),A3.has(i.type))return o.cast();
          try {
            i.fire(this.view,_3(s,n))
          }
          catch(d) {
            this.failed.add(e),console.warn("ghost",e,d)
          }
        }
      }
      const I3=30,R3=12e3;
      class B3 {
        constructor(e,t) {
          g(this,"root",document.createElement("div"));
          g(this,"log",document.createElement("div"));
          g(this,"form",document.createElement("form"));
          g(this,"input",document.createElement("input"));
          g(this,"cleanup",[]);
          this.send=e,this.root.id="run-chat",this.log.className="rc-log",this.form.className="rc-form",this.form.autocomplete="off",this.input.type="text",this.input.maxLength=ux,this.input.enterKeyHint="send",this.input.placeholder=Qe?c("Toca para escribir al grupo"):c("Pulsa Enter para escribir al grupo");
          const s=document.createElement("span");
          s.className="chat-ch party",s.textContent=c("Grupo"),this.form.append(s,this.input),this.root.append(this.log,this.form),document.getElementById("hud").append(this.root),this.form.onsubmit=o=> {
            o.preventDefault();
            const i=this.input.value.trim();
            this.input.value="",i&&!this.send(i)&&this.system(c("Sin conexión: el mensaje no se ha enviado.")),this.close()
          },this.input.addEventListener("focus",()=> {
            this.root.classList.add("open"),this.log.scrollTop=this.log.scrollHeight,t()
          }),this.input.addEventListener("blur",()=>this.close()),this.input.addEventListener("keydown",o=> {
            o.key==="Escape"&&(o.stopPropagation(),this.close())
          });
          const n=o=> {
            var i;
            o.key!=="Enter"||this.typing||((i=o.target)==null?void 0:i.tagName)==="INPUT"||document.querySelector(".overlay:not(.hidden)")||(o.preventDefault(),this.open())
          };
          window.addEventListener("keydown",n),this.cleanup.push(()=>window.removeEventListener("keydown",n))
        }
        get typing() {
          return document.activeElement===this.input
        }
        open() {
          this.input.focus()
        }
        close() {
          this.root.classList.remove("open"),this.typing&&this.input.blur(),this.log.scrollTop=this.log.scrollHeight
        }
        add(e,t,s) {
          const n=document.createElement("div");
          n.className=`chat-line party${s?" self":""}`;
          const o=document.createElement("b");
          o.textContent=`${e}: `,n.append(o,Te.profanityFilter?_k(t,"strict"):t),this.push(n)
        }
        system(e) {
          const t=document.createElement("div");
          t.className="chat-line system",t.textContent=e,this.push(t)
        }
        push(e) {
          for(this.log.append(e);this.log.childElementCount>I3;)this.log.firstElementChild.remove();
          this.log.scrollTop=this.log.scrollHeight,window.setTimeout(()=>e.classList.add("old"),R3)
        }
        destroy() {
          this.cleanup.forEach(e=>e()),this.root.remove()
        }
      }
      const X0=10,N3=10,O3=200,D3=1e3,J0=8,H3=20,F3=1,Q0=[1,1,.8,.6],Z0=[ {
        count:1,hp:1,boss:1
      }, {
        count:1,hp:1,boss:1
      }, {
        count:2.5,hp:1.25,boss:1.75
      }, {
        count:3.85,hp:2.25,boss:4
      }
      ],eb=10,z3=3,U3=1.5,G3=6,tb=5,V3=45,K3=80,cp=3,W3=.3,Y3=1.5,X3=88,sb=.12,J3=.22,Q3=.14,Z3=2,ab=30;
      class e_ {
        constructor(e,t,s,n=[]) {
          g(this,"me",0);
          g(this,"host",0);
          g(this,"alone",!1);
          g(this,"waited",0);
          g(this,"known",new Map);
          g(this,"prevPos",new Map);
          g(this,"knownPk",new Set);
          g(this,"nextNid",1);
          g(this,"mobsIn",0);
          g(this,"resyncAt",0);
          g(this,"over",!1);
          g(this,"hostGone",0);
          g(this,"hostWarned",!1);
          g(this,"myPicks",new Map);
          g(this,"status","connecting");
          g(this,"link");
          g(this,"mates",new Map);
          g(this,"labels",document.getElementById("run-labels"));
          g(this,"frame",document.createElement("div"));
          g(this,"waitEl",document.getElementById("party-wait"));
          g(this,"sendIn",0);
          g(this,"sentBusy",!1);
          g(this,"revive",0);
          g(this,"selfLabel",null);
          g(this,"allDown",0);
          g(this,"rolls",new Map);
          g(this,"rollItems",new Map);
          g(this,"nextRoll",1);
          g(this,"rollUi",new MC);
          g(this,"choosing",new Set);
          g(this,"viewing",new Set);
          g(this,"dmgOf",new Map);
          g(this,"skillsOf",new Map);
          g(this,"skillsIn",0);
          g(this,"acts",[]);
          g(this,"takes",[]);
          g(this,"chat");
          g(this,"started",!1);
          g(this,"startIn",-1);
          g(this,"holding",0);
          g(this,"leaderLeft",!1);
          this.game=e,this.myName=t,this.expected=n;
          const o=t;
          this.link=new t3(Yj(),()=>( {
            name:o,look:s
          }), {
            status:i=> {
              const r=this.status;this.status=i,i==="offline"&&r==="online"&&e.events.onLoot(c("Se ha perdido la conexión con el grupo. Reconectando…"))
            },welcome:(i,r,l)=> {
              this.me=i,this.host=r,this.clear();for(const d of l)this.add(d);this.known.clear(),this.knownPk.clear()
            },join:i=> {
              i.mid===this.host&&(this.hostGone=0);const r=this.mates.get(i.mid);r==null||r.avatar.destroy(),r==null||r.row.remove(),this.add(i),this.known.clear(),this.knownPk.clear(),e.events.onLoot(c("{name} se une a la partida.", {
                name:i.name
              })),this.isHost&&(this.started||this.startIn>=0)&&this.link.send( {
                k:"go",secs:this.started?0:this.startIn
              })
            },leave:i=> {
              const r=this.mates.get(i);r&&(e.events.onLoot(c("{name} ha dejado la partida.", {
                name:r.avatar.name
              })),r.avatar.destroy(),r.row.remove(),this.mates.delete(i),i===this.host&&!this.over&&e.state!=="over"&&this.hostGone<=0&&(this.hostGone=eb,this.hostWarned=!1))
            },host:i=>this.hostChanged(i),data:(i,r)=>this.onData(i,r),chat:i=>this.chat.add(i.name,i.text,i.name===t),chatErr:(i,r)=>this.chat.system(i==="guest"?c("Para escribir en el chat necesitas una cuenta: créala desde la selección de personaje."):i==="muted"?r?c("Estás silenciado en el chat hasta el {date}.", {
              date:new Date(r).toLocaleString(Ia(), {
                dateStyle:"medium",timeStyle:"short"
              })
            }):c("Estás silenciado en el chat."):c("Escribes demasiado rápido. Espera un momento."))
          }),this.chat=new B3(i=>this.link.say(i),()=>e.releaseKeys()),e.coop=this
        }
        get isHost() {
          return this.me!==0&&this.me===this.host
        }
        get replica() {
          return!this.alone&&!this.isHost
        }
        allies() {
          return[...this.mates.values()].filter(e=>e.avatar.player&&!e.down&&e.hp>0).map(e=>e.avatar)
        }
        players() {
          return 1+[...this.mates.values()].filter(e=>e.avatar.player).length
        }
        partyScale() {
          return Z0[Math.min(this.players(),Z0.length-1)]
        }
        gain() {
          return Q0[Math.min(this.players(),Q0.length-1)]
        }
        expMult(e) {
          const t=[e,...[...this.mates.values()].filter(s=>s.avatar.player).map(s=>s.em)];
          return(1+t.reduce((s,n)=>s+(n-1),0)/t.length)*this.gain()
        }
        take(e) {
          e.nid&&this.takes.push(e.nid)
        }
        shareParty(e) {
          if(!this.mates.size)return;
          const t=this.game.player;
          this.link.send( {
            k:"help",x:Math.round(t.x),y:Math.round(t.y),h:e
          })
        }
        skillCast(e) {
          if(!this.mates.size||this.acts.length>=24)return;
          const t=pl(e.id)&&this.game.weaponBasic?this.game.weaponBasic:e.id;
          this.acts.push([t,e.level,j3(e.shot)])
        }
        midOf(e) {
          if(e===this.game.player)return this.me;
          for(const[t,s]of this.mates)if(s.avatar===e)return t;
          return this.me
        }
        lootRoll(e,t,s,n="") {
          const o=[this.me,...[...this.mates].filter(([,r])=>r.avatar.player).map(([r])=>r)];
          if(!this.isHost||o.length<2)return this.game.netGot(e,0,t,s,void 0,n);
          const i=this.nextRoll++;
          this.rolls.set(i, {
            kind:e,ref:t,quality:s,who:o,picks:new Map,until:performance.now()+Pr*1e3
          }),this.link.send( {
            k:"roll",id:i,kind:e,ref:t,quality:s,secs:Pr,...n? {
              src:n
            }
            :{}
          }),this.openRoll(i,e,t,s,Pr,n)
        }
        openRoll(e,t,s,n,o,i="") {
          e>=this.nextRoll&&(this.nextRoll=e+1),this.rollItems.set(e, {
            kind:t,ref:s,quality:n,src:i
          }),this.rollUi.open(e,t,s,n,o);
          const r=this.game;
          this.choosing.add(e),(r.state==="playing"||r.state==="partywait")&&(r.state="reveal"),r.events.onDrop( {
            kind:t==="loot"?"gear":t==="card"?"card":"egg",id:s,quality:Math.max(0,n),affixes:[],tier:r.itemTier(),roll: {
              until:performance.now()+o*1e3,choose:l=>this.pickRoll(e,l)
            }
          })
        }
        pickRoll(e,t) {
          this.choosing.delete(e)&&(this.myPicks.set(e,t),this.rollUi.picked(e,t),this.isHost?this.rollPicked(this.me,e,t):this.link.send( {
            k:"rollPick",id:e,c:t
          }))
        }
        rollPicked(e,t,s) {
          const n=this.rolls.get(t);
          !n||!n.who.includes(e)||n.picks.has(e)||!wf.includes(s)||(n.picks.set(e,s),this.rollReady(n)&&this.resolveRoll(t))
        }
        rollReady(e) {
          return performance.now()>=e.until||e.who.every(t=>e.picks.has(t)||t!==this.me&&!this.mates.has(t))
        }
        resolveRoll(e) {
          var l;
          const t=this.rolls.get(e);
          if(!t)return;
          this.rolls.delete(e);
          const s=()=>1+Math.floor(Math.random()*100),n=t.who.map(d=> {
            const h=t.picks.get(d)??"pass";return[d,h,h==="pass"?0:s()]
          }),o=n.filter(d=>d[1]==="need");
          let i=o.length?o:n.filter(d=>d[1]==="greed");
          for(;i.length>1;) {
            const d=Math.max(...i.map(h=>h[2]));
            if(i=i.filter(h=>h[2]===d),i.length>1)for(const h of i)h[2]=s()
          }
          const r=((l=i[0])==null?void 0:l[0])??0;
          this.link.send( {
            k:"rolled",id:e,r:n,win:r
          }),this.rollDone(e,n,r)
        }
        rollDone(e,t,s) {
          const n=this.rollItems.get(e);
          if(!n)return;
          this.rollItems.delete(e),this.myPicks.delete(e),this.choosing.delete(e);
          const o=h=> {
            var u;
            return h===this.me?this.myName:((u=this.mates.get(h))==null?void 0:u.avatar.name)??"?"
          },i=t.map(([h,u,p])=>[o(h),u,p]);
          this.rollUi.result(e,i,s?o(s):null);
          const r=Gk(n.kind,n.ref);
          this.game.events.onLoot(s?c("{name} se lleva {item}", {
            name:o(s),item:r
          }):c("Nadie se lleva {item}", {
            item:r
          }));
          const l=this.game;
          if(l.state==="over")return;
          this.viewing.add(e);
          const d= {
            result: {
              winner:s?o(s):null,mine:!!s&&s===this.me,rolls:i
            },closed:()=>this.viewing.delete(e)
          };
          s&&s===this.me?l.netGot(n.kind,0,n.ref,n.quality,d,n.src):((l.state==="playing"||l.state==="partywait")&&(l.state="reveal"),l.events.onDrop( {
            kind:n.kind==="loot"?"gear":n.kind==="card"?"card":"egg",id:n.ref,quality:Math.max(0,n.quality),affixes:[],tier:l.itemTier(),...d
          }))
        }
        chestOpened(e) {
          this.isHost&&this.link.send( {
            k:"chest",cost:e
          })
        }
        posOf(e) {
          if(e===this.me||!e)return()=>this.game.player;
          const t=this.mates.get(e);
          return t?()=>t.avatar:null
        }
        bossTarget(e) {
          const t=this.game.player;
          let s=t.dead?null: {
            mid:this.me,pos:()=>t
          },n=t.dead?1/0:Math.hypot(t.x-e.x,t.y-e.y);
          for(const[o,i]of this.mates) {
            if(!i.avatar.player||i.down||i.hp<=0)continue;
            const r=Math.hypot(i.avatar.x-e.x,i.avatar.y-e.y);
            r<n&&(n=r,s= {
              mid:o,pos:()=>i.avatar
            })
          }
          return s
        }
        victory(e) {
          this.isHost&&this.link.send( {
            k:"win",secs:e
          })
        }
        bossCast(e,t,s,n) {
          this.isHost&&(e.nid||(e.nid=this.nextNid++),this.link.send( {
            k:"cast",nid:e.nid,i:t,seed:s,to:n
          }))
        }
        gameOver(e) {
          if(!this.over) {
            if(this.isHost)for(const t of[...this.rolls.keys()])this.resolveRoll(t);
            this.over=!0,this.isHost&&this.link.send( {
              k:"over",win:e
            })
          }
        }
        hostChanged(e) {
          var n;
          const t=this.game;
          if(e===this.host||this.over||t.state==="over")return;
          if(this.host=e,this.hostGone=0,this.hostWarned=!1,this.leaderLeft=!1,this.isHost)return this.takeOver();
          const s=((n=this.mates.get(e))==null?void 0:n.avatar.name)??"?";
          t.events.onAnnounce(c("El líder se ha ido: ahora lleva la partida {name}.", {
            name:s
          }));
          for(const[o,i]of this.myPicks)this.rollItems.has(o)&&this.link.send( {
            k:"rollPick",id:o,c:i
          })
        }
        takeOver() {
          const e=this.game;
          e.takeHost();
          let t=0;
          for(const n of e.enemies)n.nid>t&&(t=n.nid);
          for(const n of e.pickups)n.nid&&n.nid>t&&(t=n.nid);
          this.nextNid=Math.max(this.nextNid,t+1),this.known.clear(),this.prevPos.clear(),this.knownPk.clear(),this.resyncAt=0;
          const s=[this.me,...[...this.mates].filter(([,n])=>n.avatar.player).map(([n])=>n)];
          for(const[n,o]of this.rollItems) {
            if(this.rolls.has(n))continue;
            const i=new Map,r=this.myPicks.get(n);
            r&&i.set(this.me,r),this.rolls.set(n, {
              kind:o.kind,ref:o.ref,quality:o.quality,who:s,picks:i,until:performance.now()+Pr*1e3/2
            })
          }
          e.events.onAnnounce(c("El líder se ha ido: ahora llevas tú la partida."))
        }
        abandon() {
          this.isHost&&!this.over&&this.link.send( {
            k:"bye"
          }),this.over=!0,this.link.close()
        }
        end(e,t) {
          const s=this.game;
          this.over||s.state==="over"||(t&&s.events.onAnnounce(t),s.state="over",s.events.onGameOver(e))
        }
        add(e) {
          const t=document.createElement("div");
          t.className="run-mate";
          const s=document.createElement("b");
          s.textContent=e.name;
          const n=document.createElement("i");
          n.append(document.createElement("span"));
          const o=document.createElement("em");
          o.className="rm-arrow",o.textContent="➤",t.append(s,n,o),this.labels.append(t);
          const i=document.createElement("div");
          i.className="rp-row",i.innerHTML='<div class="rp-portrait"><canvas></canvas></div><div class="rp-bars"><div class="rp-name"><span></span> <small></small><em></em></div><div class="bar hp"><div></div><span></span></div></div>',i.querySelector(".rp-name span").textContent=e.name,i.querySelector(".rp-name small").textContent=Ct(ge(e.look.promotion??e.look.job),e.look.gender),this.frame.isConnected||(this.frame.id="run-party",document.getElementById("hud").append(this.frame)),this.frame.append(i);
          const r=new bx( {
            id:e.mid,name:e.name,look:e.look,x:this.game.player.x,y:this.game.player.y,f:0
          },this.game.entityLayer,t);
          this.mates.set(e.mid, {
            avatar:r,hp:1,mhp:1,bar:n,em:1,busy:!1,down:!1,rv:0,name:s,row:i,portrait:null,ghost:new q3(this.game,()=>r.player)
          })
        }
        onData(e,t) {
          var o,i;
          const s=this.mates.get(e),n=this.game;
          if(!(!s||!t||typeof t!="object"))if(t.k==="me") {
            s.avatar.push(t.x,t.y,t.f),s.hp=t.hp,s.mhp=t.mhp,s.em=typeof t.em=="number"&&Number.isFinite(t.em)?Math.max(0,Math.min(10,t.em)):1,s.busy=!!t.busy;
            const r=!!t.down;
            r!==s.down&&(s.down=r,r?(o=s.avatar.player)==null||o.die():(i=s.avatar.player)==null||i.revive(),n.events.onLoot(r?c("{name} ha caído. Quédate a su lado para levantarle.", {
              name:s.avatar.name
            }):c("{name} se ha levantado.", {
              name:s.avatar.name
            }))),s.rv=typeof t.rv=="number"?Math.max(0,Math.min(1,t.rv)):0,typeof t.dmg=="number"&&Number.isFinite(t.dmg)&&this.dmgOf.set(e, {
              name:s.avatar.name,total:Math.max(0,t.dmg)
            })
          }
          else if(t.k==="skills"&&Array.isArray(t.s)) {
            const r=l=>Array.isArray(l)&&typeof l[0]=="string"&&l[0].length<=40&&typeof l[1]=="string"&&l[1].length<=60&&typeof l[2]=="number"&&Number.isFinite(l[2]);
            this.skillsOf.set(e,t.s.filter(r).slice(0,ab).map(([l,d,h])=>[l,d,Math.max(0,h)]))
          }
          else if(t.k==="mobs"&&e===this.host&&this.replica)this.applyMobs(t);
          else if(t.k==="hits"&&this.isHost) {
            const r=this.byNid(),l=(...d)=>d.every(h=>typeof h=="number"&&Number.isFinite(h));
            for(const[d,h,u,p,y,w,m]of t.c??[]) {
              const f=r.get(d);
              f&&l(h,u,p,y,w,m)&&n.netCC(f,h,u,p,y,w,m)
            }
            for(const[d,h]of t.h) {
              const u=r.get(d);
              u&&l(h)&&n.netHit(u,h)
            }
            for(const d of Array.isArray(t.x)?t.x.slice(0,200):[]) {
              const h=r.get(d);
              h&&n.netKilled(h)
            }
          }
          else if(t.k==="cast"&&e===this.host&&this.replica) {
            const r=this.byNid().get(t.nid);
            r&&typeof t.i=="number"&&typeof t.seed=="number"&&n.netBossCast(r,t.i,t.seed,t.to)
          }
          else if(t.k==="take"&&this.isHost) {
            const r=new Set([t.nid,...Array.isArray(t.more)?t.more.slice(0,D3):[]]);
            for(const l of n.pickups.filter(d=>d.nid&&r.has(d.nid)))n.netTake(l,(d,h,u,p)=>this.link.send( {
              k:"got",to:e,kind:d,value:h,ref:u,quality:p
            }))
          }
          else if(t.k==="got"&&e===this.host&&t.to===this.me)n.netGot(t.kind,t.value,t.ref,t.quality);
          else if(t.k==="help"&&t.h&&typeof t.h.src=="string"&&typeof t.x=="number"&&typeof t.y=="number")n.receiveParty(t.h,t.x,t.y);
          else if(t.k==="chest"&&e===this.host&&this.replica)n.openPartyChest(t.cost);
          else if(t.k==="win"&&e===this.host&&this.replica)n.netVictory(t.secs);
          else if(t.k==="go"&&e===this.host&&this.replica&&!this.started&&typeof t.secs=="number")this.countFrom(t.secs);
          else if(t.k==="roll"&&e===this.host&&this.replica)typeof t.id=="number"&&typeof t.ref=="number"&&this.openRoll(t.id,t.kind,t.ref,t.quality,Math.min(Pr,Math.max(1,t.secs)),typeof t.src=="string"?t.src.slice(0,40):"");
          else if(t.k==="rollPick"&&this.isHost)this.rollPicked(e,t.id,t.c);
          else if(t.k==="rolled"&&e===this.host&&this.replica&&Array.isArray(t.r))this.rollDone(t.id,t.r,t.win);
          else if(t.k==="acts"&&Array.isArray(t.a)) {
            const r=this.byNid();
            for(const l of t.a.slice(0,24))Array.isArray(l)&&s.ghost.play(l,r)
          }
          else t.k==="over"&&e===this.host?this.end(!!t.win):t.k==="bye"&&e===this.host&&!this.over&&n.state!=="over"&&(this.hostGone=z3,this.hostWarned=!0)
        }
        byNid() {
          const e=new Map;
          for(const t of this.game.enemies)t.nid&&e.set(t.nid,t);
          return e
        }
        applyMobs(e) {
          const t=this.game;
          let s=this.byNid(),n=!1;
          for(const[i,r,l,d,h,u,p]of e.n)s.has(i)||(t.netSpawn(i,r,l===1,d,h,u,p),n=!0);
          n&&(s=this.byNid());
          const o=i=>typeof i=="number"&&Number.isFinite(i)?Math.max(-2e3,Math.min(2e3,i)):0;
          for(const[i,r,l,d,h,u,p,y]of e.u) {
            const w=s.get(i);
            w&&t.netUpdate(w,r,l,d,h,u??0,!u||u===this.me,o(p),o(y))
          }
          for(const i of e.d) {
            const r=s.get(i);
            r&&t.netKill(r)
          }
          for(const i of e.g) {
            const r=s.get(i);
            r&&!r.dead&&t.vanishEnemy(r)
          }
          for(const[i,r,l,d,h,u,p]of e.pn??[])t.netPickup(i,r,l,d,h,u,p);
          for(const i of e.pg??[])t.netPickupGone(i);
          e.e&&t.netEcon(...e.e),typeof e.t=="number"&&Number.isFinite(e.t)&&(t.mvpUntil=t.time+Math.max(0,e.t))
        }
        sendMobs() {
          const e=this.game,t=[],s=[],n=[],o=[],i=new Set,r=e.enemies.length,l=Math.ceil(r/(N3*X0)),d=r?this.resyncAt%r:0;
          this.resyncAt=d+l;
          const h=e.time;
          let u=-1;
          for(const v of e.enemies) {
            u++,v.nid||(v.nid=this.nextNid++),i.add(v.nid);
            const x=Math.round(v.x),k=Math.round(v.y),M=Math.max(0,Math.round(v.hp)),$=v.state==="attack"?1:0,P=v.netTo||this.me,q=this.known.get(v.nid),R=this.prevPos.get(v.nid);
            let L=0,j=0,A=0,E=0;
            if(R&&h>R[2]&&(A=((x-R[0])/(h-R[2])+R[3])/2,E=((k-R[1])/(h-R[2])+R[4])/2,Math.hypot(A,E)>=H3&&(L=Math.round(A),j=Math.round(E))),this.prevPos.set(v.nid,[x,k,h,A,E]),v.dead)this.prevPos.delete(v.nid),this.known.delete(v.nid)&&(v.netPaid?n:o).push(v.nid);
            else if((!q||u>=d&&u<d+l||d+l>r&&u<d+l-r)&&t.length<O3)this.known.set(v.nid,[x,k,M,$,P,L,j,h]),t.push([v.nid,v.def.id,v.elite?1:0,Math.round(v.maxHp),x,k,M]),s.push([v.nid,x,k,M,$,P,L,j]);
            else if(q) {
              const C=Math.min(h-q[7],Pp),_=q[0]+q[5]*C,U=q[1]+q[6]*C,D=L!==0||j!==0||q[5]!==0||q[6]!==0;
              (Math.abs(x-_)>=J0||Math.abs(k-U)>=J0||M!==q[2]||$!==q[3]||P!==q[4]||D&&h-q[7]>=F3)&&(this.known.set(v.nid,[x,k,M,$,P,L,j,h]),s.push([v.nid,x,k,M,$,P,L,j]))
            }
          }
          for(const v of this.known.keys())i.has(v)||(this.known.delete(v),this.prevPos.delete(v),o.push(v));
          const p=[],y=[],w=new Set;
          for(const v of e.pickups)v.nid||(v.nid=this.nextNid++),!v.dead&&(w.add(v.nid),this.knownPk.has(v.nid)||(this.knownPk.add(v.nid),p.push([v.nid,v.kind,Math.round(v.x),Math.round(v.y),v.value,v.ref,v.quality])));
          for(const v of this.knownPk)w.has(v)||(this.knownPk.delete(v),y.push(v));
          const m=[e.level,Math.round(e.exp*10)/10,e.expNext,e.zeny,e.chestsOpened],f=e.mvpUntil>=0?Math.round((e.mvpUntil-e.time)*10)/10:void 0;
          this.link.send( {
            k:"mobs",n:t,u:s,d:n,g:o,pn:p,pg:y,e:m,...f!==void 0? {
              t:f
            }
            :{}
          })
        }
        sendHits() {
          const e=[],t=[],s=[];
          for(const n of this.game.enemies) {
            if(!n.nid)continue;
            const o=this.game.takeDealt(n);
            o>0&&e.push([n.nid,Math.round(o)]);
            const i=n.dead?null:this.game.takeCC(n);
            i&&t.push([n.nid,...i]),n.dead&&!n.netDeadSent&&(n.netDeadSent=!0,s.push(n.nid))
          }
          (e.length||t.length||s.length)&&this.link.send( {
            k:"hits",h:e,...t.length? {
              c:t
            }
            :{},...s.length? {
              x:s
            }
            :{}
          })
        }
        get busy() {
          const e=this.game;
          return e.state==="levelup"||this.choosing.size>0||this.viewing.size>0||e.pendingLevelUps>0&&!e.player.dead
        }
        sendMe() {
          const e=this.game,t=e.player;
          this.sentBusy=this.busy,this.link.send( {
            k:"me",x:Math.round(t.x),y:Math.round(t.y),f:Mm(t.facingX,t.facingY),hp:Math.round(e.hp),mhp:Math.round(e.stats.maxHp),em:e.stats.expMult,busy:this.sentBusy,...t.dead? {
              down:!0,rv:Math.round(this.revive/cp*100)/100
            }
            :{},dmg:Math.round(this.myDamage())
          })
        }
        myDamage() {
          let e=0;
          for(const t of this.game.dmgLog.values())for(const s of t.values())e+=s;
          return e
        }
        skillRows() {
          return ZT(this.game)
        }
        skillTable() {
          const e=[ {
            mid:this.me,name:this.myName,me:!0,skills:this.skillRows()
          }
          ];
          for(const[t,s]of this.dmgOf)e.push( {
            mid:t,name:s.name,me:!1,skills:this.skillsOf.get(t)??[]
          });
          return e
        }
        damageTable() {
          const e=[ {
            mid:this.me,name:this.myName,total:this.myDamage(),me:!0
          }
          ];
          for(const[t,s]of this.dmgOf)e.push( {
            mid:t,name:s.name,total:s.total,me:!1
          });
          return e
        }
        syncPause() {
          const e=this.game;
          if(e.state==="over"||e.state==="cutscene")return this.waitEl.classList.add("hidden");
          e.pendingLevelUps>0&&e.state!=="levelup"&&e.openLevelUp(),(this.choosing.size||this.viewing.size)&&(e.state==="playing"||e.state==="partywait")&&(e.state="reveal");
          const t=this.busy,s=[...this.mates.values()].filter(o=>o.busy&&o.avatar.player);
          t||(s.length&&e.state==="playing"?e.state="partywait":!s.length&&e.state==="partywait"&&(e.state="playing")),this.waitEl.classList.toggle("hidden",!s.length),this.waitEl.classList.toggle("big",!t);
          const n=s.map(o=>o.avatar.name).join(", ");
          if(s.length&&this.waitEl.dataset.names!==n) {
            this.waitEl.dataset.names=n;
            const o=document.createElement("small");
            o.textContent=c("Eligiendo carta");
            const i=document.createElement("b");
            i.textContent=n,this.waitEl.replaceChildren(o,i)
          }
        }
        holdStart(e) {
          const t=this.game;
          if(this.alone||!this.expected.length||t.state==="over")return this.begin();
          t.state==="playing"&&(t.state="partywait"),this.holding+=e;
          const s=l=>l===this.me||this.mates.has(l);
          if(this.isHost&&this.startIn<0&&(this.expected.every(l=>s(l.mid))||this.holding>=V3)&&(this.link.send( {
            k:"go",secs:tb
          }),this.countFrom(tb)),this.startIn>=0&&(this.startIn-=e)<=0)return this.begin();
          const n=this.waitEl;
          n.classList.remove("hidden"),n.classList.add("big","start"),delete n.dataset.names;
          const o=document.createElement("small");
          o.textContent=this.startIn>=0?c("Empieza en"):c("Esperando al grupo");
          const i=[o];
          if(this.startIn>=0) {
            const l=document.createElement("b");
            l.className="ps-count",l.textContent=String(Math.ceil(this.startIn)),i.push(l)
          }
          const r=document.createElement("ul");
          for(const l of this.expected) {
            const d=document.createElement("li"),h=this.me?s(l.mid):l.name===this.myName;
            d.className=h?"in":"";
            const u=document.createElement("span");
            u.textContent=l.name;
            const p=document.createElement("em");
            p.textContent=h?c("En partida"):c("Cargando…"),d.append(u,p),r.append(d)
          }
          i.push(r),n.replaceChildren(...i)
        }
        countFrom(e) {
          if(e<=0)return this.begin();
          this.startIn=e
        }
        begin() {
          if(this.started)return;
          this.started=!0,this.startIn=-1;
          const e=this.game;
          e.state==="partywait"&&(e.state="playing"),this.waitEl.classList.add("hidden"),this.waitEl.classList.remove("start"),this.waitEl.replaceChildren()
        }
        update(e) {
          const t=this.game;
          if(!this.me&&!this.alone&&(this.waited+=e)>G3&&(this.alone=!0,t.events.onLoot(c("No se puede conectar con el grupo: juegas solo."))),this.hostGone>0&&(this.hostGone-=e,!this.hostWarned&&this.hostGone<=eb-U3&&(this.hostWarned=!0,t.events.onAnnounce(c("El líder se ha desconectado: si no vuelve en {n} s, la partida termina.", {
            n:Math.ceil(this.hostGone)
          }))),this.hostGone<=0&&(this.leaderLeft=!0,this.end(!1,c("El líder ha dejado la partida.")))),this.isHost)for(const[s,n]of this.rolls)this.rollReady(n)&&this.resolveRoll(s);
          if(this.rollUi.update(),this.me&&(this.mobsIn-=e)<=0) {
            if(this.mobsIn=1/X0,this.acts.length&&(this.link.send( {
              k:"acts",a:this.acts
            }),this.acts=[]),this.takes.length) {
              const[s,...n]=this.takes;
              this.link.send( {
                k:"take",nid:s,...n.length? {
                  more:n
                }
                :{}
              }),this.takes=[]
            }
            this.isHost?this.sendMobs():this.sendHits()
          }
          if((this.skillsIn-=e)<=0) {
            this.skillsIn=Z3;
            const s=this.skillRows().slice(0,ab);
            s.length&&this.link.send( {
              k:"skills",s
            })
          }
          ((this.sendIn-=e)<=0||this.busy!==this.sentBusy)&&(this.sendIn=1/Fj,this.sendMe()),this.started?this.me&&(this.syncPause(),this.updateDown(e)):this.holdStart(e);
          for(const s of this.mates.values()) {
            s.avatar.update(e),this.place(s.avatar.label,s.avatar.x,s.avatar.y,s.down),s.avatar.label.hidden=!s.avatar.player,s.avatar.label.classList.toggle("down",s.down),s.name.textContent=s.down?c("{name} (caído)", {
              name:s.avatar.name
            }):s.avatar.name;
            const n=`${Math.max(0,Math.min(100,(s.down?s.rv:s.hp/Math.max(1,s.mhp))*100))}%`;
            s.bar.firstElementChild.style.width=n,this.updateRow(s,n)
          }
        }
        updateRow(e,t) {
          var d;
          const s=e.row;
          s.hidden=!e.avatar.player;
          const n=((d=e.avatar.player)==null?void 0:d.sprite.sheets)??null;
          n&&n!==e.portrait&&(e.portrait=n,Vk(s.querySelector("canvas"),n)),s.classList.toggle("down",e.down),s.classList.toggle("busy",e.busy&&!e.down);
          const o=e.down?c("Caído"):e.busy?c("Eligiendo…"):"",i=s.querySelector(".rp-name em");
          i.textContent!==o&&(i.textContent=o);
          const r=s.querySelector(".bar");
          r.firstElementChild.style.width=t,r.classList.toggle("low",!e.down&&e.hp<e.mhp*.3);
          const l=e.down?c("Levantándose {p}%", {
            p:Math.round(e.rv*100)
          }):`${Math.max(0,Math.round(e.hp))} / ${Math.round(e.mhp)}`;
          r.lastElementChild.textContent!==l&&(r.lastElementChild.textContent=l)
        }
        place(e,t,s,n=!1) {
          const o=this.game,i=o.world3d.project(t,s,o.world3d.spriteLift(X3));
          let r=i.x,l=i.y;
          if(n) {
            const d=window.innerWidth,h=window.innerHeight,u=Math.min(d*(1-sb),Math.max(d*sb,r)),p=Math.min(h*(1-Q3),Math.max(h*J3,l)),y=u!==r||p!==l;
            y&&e.style.setProperty("--a",`${Math.atan2(l-p,r-u).toFixed(2)}rad`),e.classList.toggle("edge",y),r=u,l=p
          }
          else e.classList.remove("edge");
          e.style.transform=`translate(${Math.round(r)}px, ${Math.round(l)}px) translate(-50%, -100%)`
        }
        updateDown(e) {
          const t=this.game,s=t.player;
          if(s.dead) {
            const n=[...this.mates.values()].some(o=>o.avatar.player&&!o.down&&o.hp>0&&Math.hypot(o.avatar.x-s.x,o.avatar.y-s.y)<K3);
            this.revive=n?this.revive+e:0,this.revive>=cp&&(this.revive=0,t.revivePlayer(W3))
          }
          else this.revive=0;
          if(s.dead&&t.state!=="over") {
            if(!this.selfLabel) {
              const n=document.createElement("div");
              n.className="run-mate down";
              const o=document.createElement("b");
              o.textContent=c("Caído: un compañero puede levantarte");
              const i=document.createElement("i");
              i.append(document.createElement("span")),n.append(o,i),this.labels.append(n),this.selfLabel=n
            }
            this.place(this.selfLabel,s.x,s.y),this.selfLabel.lastElementChild.firstElementChild.style.width=`${Math.min(100,this.revive/cp*100)}%`
          }
          else this.selfLabel&&(this.selfLabel.remove(),this.selfLabel=null);
          if(this.isHost&&t.state!=="over") {
            const n=s.dead&&[...this.mates.values()].every(o=>o.down||!o.avatar.player);
            this.allDown=n?this.allDown+e:0,this.allDown>=Y3&&this.end(!1,c("Ha caído todo el grupo"))
          }
        }
        clear() {
          for(const e of this.mates.values())e.avatar.destroy();
          this.mates.clear(),this.frame.replaceChildren()
        }
        destroy() {
          this.game.coop=null,this.link.close(),this.clear(),this.labels.innerHTML="",this.frame.remove(),this.selfLabel=null,this.waitEl.classList.add("hidden"),this.rollUi.destroy(),this.choosing.clear(),this.viewing.clear(),this.chat.destroy()
        }
      }
      const ht=a=>document.getElementById(a),da=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),cs=a=>a.toLocaleString(c("es-ES"));function Wr(a){return KE(VE(fe[a.itemId]),a)}const t_=[at.phracon,at.emveretarcon,at.oridecon,at.elunium];function Yr(a){var e;return WE((e=ms[a])==null?void 0:e.monster)}const nb=[{id:"all",name:"Todo",slots:null},{id:"weapon",name:"Armas",slots:["weapon"]},{id:"head",name:"Cabeza",slots:["head_top","head_mid","head_low"]},{id:"armor",name:"Armadura",slots:["armor"]},{id:"shield",name:"Escudo",slots:["shield"]},{id:"garment",name:"Capa",slots:["garment"]},{id:"shoes",name:"Calzado",slots:["shoes"]},{id:"acc",name:"Accesorios",slots:["acc"]},{id:"cards",name:"Cartas",slots:[]}];function s_(a){let e="all",t="";const s=new Set,n=new Map,o=()=>{const f=xt();let v=0;for(const x of f.inventory)s.has(x.uid)&&(v+=Wr(x));for(const[x,k]of n)v+=Yr(x)*k;return v},i=()=>s.size+[...n.values()].reduce((f,v)=>f+v,0),r=()=>{const f=xt(),v=Ul();ht("shop-kafra").textContent=`${cs(f.kafra)} ${c("Puntos Kafra")}`;const x=f.inventory.filter(E=>fe[E.itemId]),k=Object.entries(f.cards).filter(([,E])=>E>0).map(([E,C])=>[Number(E),C]),M=(E,C)=>{const _=nb.find(U=>U.id===E);return!_.slots||_.slots.includes(fe[C.itemId].slot)};ht("shop-filters").innerHTML=nb.map(E=>{const C=E.id==="cards"?k.length:x.filter(_=>M(E.id,_)).length+(E.id==="all"?k.length:0);return`<button class="inv-chip${E.id===e?" active":""}" data-f="${E.id}"${C||E.id==="all"?"":" disabled"}>${c(E.name)} <small>${C}</small></button>`}).join(""),ht("shop-filters").querySelectorAll(".inv-chip").forEach(E=>{E.onclick=()=>{e=E.dataset.f,r()}});const $=[0,0,0,0,0],P=[0,0,0,0,0];if(e!=="cards")for(const E of x){if(v.has(E.uid)||E.safe||!M(e,E))continue;const C=E.quality??0;$[C]++,s.has(E.uid)&&P[C]++}const q=i();ht("shop-quality").innerHTML=`<span class="muted">${c("Marcar por calidad:")}</span>${Re.map((E,C)=>`<button class="inv-chip q-chip${$[C]&&P[C]===$[C]?" active":""}" data-q="${C}" style="--q:${Ps(C)}"${$[C]?"":" disabled"}>${E.name} <small>${$[C]}</small></button>`).join("")}${q?`<button class="inv-chip" data-q="none">${c("Desmarcar todo")}</button>`:""}`,ht("shop-quality").querySelectorAll("[data-q]").forEach(E=>{E.onclick=()=>{if(E.dataset.q==="none"){s.clear(),n.clear(),t="",r();return}const C=Number(E.dataset.q),_=P[C]===$[C];for(const I of x)(I.quality??0)!==C||v.has(I.uid)||I.safe||!M(e,I)||(_?s.delete(I.uid):s.add(I.uid));const U=$[C],D=`<b style="color:${C?Ps(C):"inherit"}">${Re[C].name}</b>`;t=_?c(U===1?"Desmarcado {n} objeto de calidad {q}.":"Desmarcados {n} objetos de calidad {q}.",{n:U,q:D}):c(U===1?"Marcado {n} objeto de calidad {q}.":"Marcados {n} objetos de calidad {q}.",{n:U,q:D}),r()}});const R=e==="cards"?[]:x.filter(E=>M(e,E)).map(E=>{const C=v.get(E.uid),_=["item-cell","shop-cell"];return E.quality&&_.push(`q${E.quality}`),s.has(E.uid)&&_.push("picked"),C?_.push("worn"):E.safe&&_.push("safe"),`<div class="${_.join(" ")}" data-uid="${E.uid}"><img src="${Me(E.itemId)}">${E.safe?nx:""}<span class="price">${cs(Wr(E))}</span></div>`}),L=e==="all"||e==="cards"?k.map(([E,C])=>{const _=n.get(E)??0;return`<div class="item-cell shop-cell${_?" picked":""}" data-card="${E}"><img src="${se.icons.get("card")}"><span class="qty">${_?`${_}/${C}`:C}</span><span class="price">${cs(Yr(E))}</span></div>`}):[],j=[...R,...L];ht("shop-items").innerHTML=j.length?j.join(""):`<div class="empty-note">${c("No tienes nada de este tipo para vender.")}</div>`,to(ht("shop-items"),"[data-uid], [data-card]",E=>{if(E.dataset.card){const U=Number(E.dataset.card);return Fh(U,`<div class="tip-price">${c("{n} Puntos Kafra cada una",{n:cs(Yr(U))})}</div>`)}const C=f.inventory.find(U=>U.uid===E.dataset.uid);if(!C)return"";const _=v.get(C.uid);return rc(C,_?`<div class="worn-note">${c("lo lleva {who}. Quítaselo para poder venderlo.",{who:da(_)})}</div>`:C.safe?`<div class="safe-note">${c("Protegido. Quítale la protección en el inventario para venderlo.")}</div>`:`<div class="tip-price">${cs(Wr(C))} ${c("Puntos Kafra")}</div>`)}),ht("shop-items").querySelectorAll("[data-uid]").forEach(E=>{E.onclick=()=>{const C=E.dataset.uid,_=f.inventory.find(D=>D.uid===C),U=v.get(C);if(U)t=`<b>${da(ss(_))}</b>: ${c("lo lleva {who}. Quítaselo para poder venderlo.",{who:da(U)})}`;else if(_.safe)s.delete(C),t=`<b>${da(ss(_))}</b>: ${c("Protegido. Quítale la protección en el inventario para venderlo.")}`;else{s.has(C)?s.delete(C):s.add(C);const D=_.quality??0;t=`<b style="color:${D?Ps(D):"inherit"}">${da(ss(_))}</b> · ${Re[D].name} · ${cs(Wr(_))} ${c("Puntos Kafra")}${_.cards.some(Boolean)?`<br><span class="muted">${c("Las cartas encajadas vuelven a tu álbum al venderla.")}</span>`:""}`}r()}}),ht("shop-items").querySelectorAll("[data-card]").forEach(E=>{E.onclick=()=>{const C=Number(E.dataset.card),_=f.cards[C]??0,U=((n.get(C)??0)+1)%(_+1);U?n.set(C,U):n.delete(C),t=`<b>${da(qt(C))}</b> · ${c("{n} Puntos Kafra cada una",{n:cs(Yr(C))})} · ${c("vendes {k} de {have}",{k:U,have:_})}`,r()}}),ht("shop-info").innerHTML=t||`<span class="muted">${c("Haz clic en lo que quieras vender para marcarlo. En las cartas, cada clic marca una copia más. Lo que lleva puesto algún personaje o está protegido no se puede vender.")}</span>`;const A=i();ht("shop-total").innerHTML=A?`${c(A===1?"{n} seleccionado":"{n} seleccionados",{n:A})} · <b>${cs(o())}</b> ${c("Puntos Kafra")}`:"",ht("shop-sell-btn").disabled=A===0},l=()=>{const f=i();if(!f)return;let v=0;for(const k of xt().inventory)s.has(k.uid)&&(k.quality??0)>=3&&v++;const x=v?`<br><span class="warn-note">${c(v===1?"Incluye {n} pieza épica o legendaria.":"Incluye {n} piezas épicas o legendarias.",{n:v})}</span>`:"";sa(c("Vendedor de minerales"),c(f===1?"¿Me vendes {n} objeto por {price}?":"¿Me vendes {n} objetos por {price}?",{n:f,price:`<b>${cs(o())} ${c("Puntos Kafra")}</b>`})+x,c("Vender"),()=>h(f))},d=(f,v)=>{B.ui("ef_coin",.5),s.clear(),n.clear(),t=c(f===1?"Has vendido {n} objeto: {gain}.":"Has vendido {n} objetos: {gain}.",{n:f,gain:`<b>+${cs(v)} ${c("Puntos Kafra")}</b>`}),r()},h=f=>{if(Hl()){EL([...s],[...n]).then(M=>d(f,M)).catch(M=>{t=da(M.message),r()});return}const v=xt(),x=Ul();let k=0;v.inventory=v.inventory.filter(M=>{if(!s.has(M.uid)||x.has(M.uid)||M.safe)return!0;k+=Wr(M);for(const $ of M.cards)$&&(v.cards[$]=(v.cards[$]??0)+1);return!1});for(const[M,$]of n){const P=Math.min($,v.cards[M]??0);k+=Yr(M)*P,v.cards[M]-=P,v.cards[M]<=0&&delete v.cards[M]}v.kafra+=k,eo(v),d(f,k)};let u="";const p=()=>{const f=xt();ht("shop-kafra").textContent=`${cs(f.kafra)} ${c("Puntos Kafra")}`;const v=t_.map(x=>{const k=xy[x],M=f.materials[x]??0,$=P=>`<button class="ro-btn small" data-ore="${x}" data-n="${P}"${f.kafra>=k*P?"":" disabled"}>×${P} · ${cs(k*P)}</button>`;return`<div class="ore-row"><img src="${Me(x)}"><div class="cand-info"><b>${da(Ft(x))}</b><small>${c(Wp[x])}</small></div><span class="qty-tag">${c("tienes {n}",{n:cs(M)})}</span><div class="ore-buy">${$(1)}${$(10)}</div></div>`}).join("");ht("shop-buy").innerHTML=`<div class="ore-list">${v}</div><div class="info-panel">${u||`<span class="muted">${c("Minerales para refinar el equipo. Para refinar, habla con el herrero Hollgrehenn en la plaza.")}</span>`}</div>`,ht("shop-buy").querySelectorAll("[data-ore]").forEach(x=>{x.onclick=()=>{const k=Number(x.dataset.ore),M=Number(x.dataset.n),$=xt(),P=xy[k]*M;if($.kafra<P)return;const q=()=>{B.ui("ef_coin",.5),u=c("Has comprado {n} {what} por {price}.",{n:M,what:`<b>${da(Ft(k))}</b>`,price:`<b>${cs(P)} ${c("Puntos Kafra")}</b>`}),p()};if(Hl()){x.disabled=!0,TL(k,M).then(q).catch(R=>{u=da(R.message),p()});return}$.kafra-=P,$.materials[k]=($.materials[k]??0)+M,eo($),q()}})},y=f=>{f==="buy"?p():r(),document.querySelectorAll("#shop .tab-btn").forEach(v=>v.classList.toggle("active",v.dataset.shop===f)),ht("shop-sell").classList.toggle("hidden",f!=="sell"),ht("shop-buy").classList.toggle("hidden",f!=="buy"),ht("shop-sell-btn").classList.toggle("hidden",f!=="sell"),ht("shop-total").classList.toggle("hidden",f!=="sell")};document.querySelectorAll("#shop .tab-btn").forEach(f=>f.onclick=()=>y(f.dataset.shop));const w=()=>{window.removeEventListener("keydown",m),lc(),de("shop")},m=f=>{f.key==="Escape"&&document.getElementById("npc-dialog").classList.contains("hidden")&&w()};window.addEventListener("keydown",m),ht("shop-close").onclick=w,ht("shop-sell-btn").onclick=l,y("sell"),Ue("shop")}const Ga=a=>document.getElementById(a),Rs=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),dp=[{id:"all",name:"Todo",weapon:null},{id:"weapon",name:"Armas",weapon:!0},{id:"armor",name:"Armaduras",weapon:!1}];let ob="all",xi=!1,Va=null;function a_(a,e){let t=ze(a),s=null,n="",o=!1,i=!0;const r=$=>$?t.inventory.find(P=>P.uid===$):void 0,l=$=>$.quality?Ps($.quality):"inherit",d=$=>nr($,t.job),h=$=>{const P=$.cards.length;if(!P)return"";const q=$.cards.filter(Boolean).length;return`<span class="card-gems$ {
        q?" has":""
      }
      ">${"◆".repeat(q)}${"◇".repeat(P-q)}</span>`},u=()=>{const $=nl(t);return t.inventory.filter(P=>Tn(t,P)&&tl(fe[P.itemId])&&!$.has(P.uid)).sort((P,q)=>Number(qo(t,q.uid))-Number(qo(t,P.uid))||d(q)-d(P))},p=()=>{const $=u(),P=j=>fe[j.itemId].slot==="weapon",q=(j,A)=>j.weapon===null||P(A)===j.weapon,R=dp.find(j=>j.id===ob)??dp[0];Ga("smith-filters").innerHTML=dp.map(j=>{const A=$.filter(E=>q(j,E)).length;return`<button class="inv-chip$ {
        j.id===R.id?" active":""
      }
      " data-f="$ {
        j.id
      }
      "${A||j.id==="all"?"":" disabled"}>${c(j.name)} <small>${A}</small></button>`}).join(""),Ga("smith-filters").querySelectorAll(".inv-chip").forEach(j=>{j.onclick=()=>{ob=j.dataset.f,p()}});const L=$.filter(j=>q(R,j));Ga("smith-list").innerHTML=L.length?L.map(j=>{const A=bs.find(C=>C.gear===fe[j.itemId].slot).name,E=qo(t,j.uid)?c("Equipado"):A;return`<div class="cand$ {
        j.quality?` q${j.quality}`:""
      }
      $ {
        j.uid===s?" sel":""
      }
      " data-uid="$ {
        j.uid
      }
      ">
              <div class="ico"><img src="$ {
        Me(j.itemId)
      }
      "></div>
              <div class="cand-info"><b style="color:$ {
        l(j)
      }
      ">${Rs(ss(j))}</b><small>${Rs(E)}</small></div>
              <div class="cand-side">${h(j)}<span class="gs">GS <b>${d(j)}</b></span></div>
            </div>`}).join(""):`<div class="empty-note">${c("No tienes nada que se pueda refinar.")}</div>`,Ga("smith-list").querySelectorAll(".cand").forEach(j=>{j.onclick=()=>{s=j.dataset.uid,n="",o=!1,w()}})},y=()=>{const $=Ga("smith-detail"),P=Ga("smith-go"),q=r(s),R=q&&fe[q.itemId],L=R&&tl(R);if(!q||!R||!L){$.innerHTML=o?`<div class="ref-result fail">${n}</div>`:`<div class="empty-note">${c("Elige la pieza que quieres refinar.")}</div>`,P.disabled=!0,P.textContent=c("Refinar");return}const j=q.refine??0,A=j>=ma,E=xt().materials,C=My(L,Math.min(ma,j+1)),_=XE(),U=E[C]??0,D=`<div class="ref-ore sel"><img src="$ {
        Me(C)
      }
      "><span class="cand-info"><b>${Rs(Ft(C))}</b><small>${c("tienes  {
        n
      }
      ",{n:U})}</small></span>${A?"":`<span class="pct">${Li(j+1)}%</span>`}</div>`,I=Array.from({length:ma},(ke,xe)=>{const pe=xe+1,ye=Li(pe);return`<span class="$ {
        [pe<=j?"done":"",pe===j+1?"next":"",ye<100?"risk":""].filter(Boolean).join(" ")
      }
      ">+${pe}<b>${ye}%</b></span>`}).join(""),N=wa(q,j);let V="";if(!A){const ke=wa(q,j+1),xe=wa(q,ma),pe=[],ye=(ks,xs,Ba,aa)=>{xs!==aa&&pe.push({k:ks,x:xs,y:Ba,same:xs===Ba})};ye("ATK",`${N.atk}`,`${ke.atk}`,`${xe.atk}`),ye("MATK",`${N.matk}`,`${ke.matk}`,`${xe.matk}`),ye("DEF",Ee(N.def,1),Ee(ke.def,1),Ee(xe.def,1));const dt=On(Oo(q)),os=On(Oo({...q,refine:j+1})),ws=On(Oo({...q,refine:ma}));dt.forEach((ks,xs)=>ye("",Rs(ks),Rs(os[xs]),Rs(ws[xs]))),V=pe.length?`<div class="box-title">${c("Al subir a + {
        n
      }
      ",{n:j+1})}</div><div class="ref-gain">${pe.map(({k:ks,x:xs,y:Ba,same:aa})=>`<span${aa?' class="same"':""}>${ks?`<b>${ks}</b> `:""}${xs}</span><span${aa?' class="same"':""}>▶</span><i${aa?' class="same"':""}>${Ba}</i>`).join("")}</div>`:""}const F=A?0:Li(j+1),Y=A?`<div class="ref-safe">${c("Ya está al máximo (+ {
        n
      }).",{n:ma})}</div>`:F>=100?`<div class="ref-safe">${c("Seguro hasta + {
        n
      }
      : no puede fallar.",{n:_})}</div>`:`<div class="ref-warn">${c(" {
        p
      }
      % de éxito. Si falla, la pieza se rompe y se pierde junto con sus cartas.",{p:F})}</div>`,Q=[N.atk?`+${N.atk} ATK`:"",N.matk?`+${N.matk} MATK`:"",N.def?`DEF ${Ee(N.def,1)}`:""].filter(Boolean).join(" · "),Z=`${L==="armor"?c("Armadura"):c("Arma")} · Tier ${mn(q)}`;$.innerHTML=`<div class="eq-item"><img class="big" src="$ {
        Me(q.itemId)
      }
      "><div class="eq-info">
        <div class="eq-name"><b style="color:$ {
        l(q)
      }
      ">${Rs(ss(q))}</b>${h(q)}<span class="gs">GS <b>${d(q)}</b></span></div>
        <span class="muted">${q.quality?`${Re[q.quality].name} · `:""}${Z} · ${c("Seguro hasta + {
        n
      }
      ",{n:_})}</span>
        ${Q?`<div class="base-stats">${Q}</div>`:""}</div></div>
      <div class="ref-ores">${D}</div>
      <div class="ref-ladder">${I}</div>
      ${Y}${V}
      <div class="ref-result ok">${n}</div>`,P.disabled=A||!(U>0)||xi,P.textContent=A?c("Refinar"):c("Refinar a + {
        n
      }
      ",{n:j+1})},w=()=>{i&&(p(),y())},m=($,P,q)=>{if(!i){Va==null||Va();return}B.ui($?"bs_refinesuccess":"bs_refinefailed",.6),$?n=c("+ {
        n
      }
      : ¡refine con éxito!",{n:q}):(o=!0,n=c("El refine ha fallado:  {
        what
      }
       se ha roto.",{what:`<b>${Rs(P)}</b>`})),t=ze(a),w()},f=$=>{if(!i||xi||$!==s)return;const P=r($),q=P&&tl(fe[P.itemId]);if(!P||!q||(P.refine??0)>=ma)return;const R=My(q,(P.refine??0)+1),L=xt();if(!(L.materials[R]>0))return;const j=ss(P);if(Hl()){xi=!0,Ga("smith-go").disabled=!0,LL(P.uid).then(A=>{xi=!1,m(A,j,A?(P.refine??0)+1:0)}).catch(A=>{if(xi=!1,!i)return Va==null?void 0:Va();n=Rs(A.message),w()});return}L.materials[R]--,L.materials[R]<=0&&delete L.materials[R],eo(L),aT(P)?(B.ui("bs_refinesuccess",.6),n=c("+ {
        n
      }
      : ¡refine con éxito!",{n:P.refine??0})):(B.ui("bs_refinefailed",.6),P.cards=P.cards.map(()=>null),Ak(t,P.uid),o=!0,n=c("El refine ha fallado:  {
        what
      }
       se ha roto.",{what:`<b>${Rs(j)}</b>`})),ja(t),t=ze(a),w()};Ga("smith-go").onclick=()=>{const $=r(s),P=$&&tl(fe[$.itemId]);if(!$||!P||xi)return;const q=$.uid,R=Li(($.refine??0)+1);if(R>=100)return f(q);const L=`<b style="color:$ {
        l($)
      }
      ">${Rs(ss($))}</b>${$.quality?` (${Rs(Re[$.quality].name)})`:""}`,j=`<div class="confirm-piece"><div class="item-cell$ {
        $.quality?` q${$.quality}`:""
      }
      "><img src="$ {
        Me($.itemId)
      }
      "></div><span>${L}${h($)}</span></div>`;sa(c("Refinar"),`${j}${c(" {
        p
      }
      % de éxito. Si falla,  {
        what
      }
       se rompe y se pierde con sus cartas. ¿Seguro?",{p:R,what:L})}`,c("Refinar"),()=>f(q))};const v=()=>{i=!1,Va===k&&(Va=null),window.removeEventListener("keydown",x),de("smith"),e()},x=$=>{$.key==="Escape"&&document.getElementById("npc-dialog").classList.contains("hidden")&&v()};window.addEventListener("keydown",x),Ga("smith-close").onclick=v;const k=()=>{t=ze(a),w()};Va=k;const M=u()[0];M&&(s=M.uid),w(),Ue("smith")}const n_=28;function Mx(){return structuredClone(cr())}function Kf(a){const e=[];for(let t=0;t<a.length;t+=3)for(let s=0;s<a[t+2];s++)e.push(a[t],a[t+1]);return e}function o_(a,e,t,s,n){const o=s.char;cw(DS()),s.tune&&Object.assign(cr(),structuredClone(s.tune)),yw(s.seed);const i=new Gs(a,lr(o),e,Ph({...o,pet:void 0}),t,"endless");i.seed=s.seed;const r=et.endless;i.charExp=new Rf(o,{jobCap:r.jobCap,jobExp:r.jobExp,count:1}),i.look={look:o.look,equip:La(o),promotion:o.promotion},i.setDifficulty({...Ta}),i.deterministic=!0;const l=ga(o);i.endlessUps=l.ups,i.recomputeStats(),i.grantSkills(l.skills);const d=Math.max(1,rh(o));return i.endless=new D5(i,Math.min(Math.max(1,s.wave),d),d,n),i}var i_={commit:"7967a1a"};const r_=[.5,1,2,4,8,16],l_=48;function $x(a){let e=0;for(let t=2;t<a.length;t+=3)e+=a[t];return e}const ad=a=>{const e=Math.floor(a*Gs.STEP);return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`};class c_{constructor(e,t,s,n){g(this,"playing",!1);g(this,"speed",1);g(this,"total");g(this,"acc",0);g(this,"el");g(this,"desync",-1);g(this,"checked",0);g(this,"ended",!1);g(this,"onKey",e=>{var t,s;e.key===" "?(e.preventDefault(),this.toggle()):e.key==="ArrowRight"?this.seek((((t=this.game())==null?void 0:t.ticks)??0)+600*this.speed):e.key==="ArrowLeft"&&this.seek((((s=this.game())==null?void 0:s.ticks)??0)-600*this.speed)});g(this,"shown","");this.data=e,this.game=t,this.restart=s,this.fastForward=n,this.total=$x(e.runs),this.el=document.createElement("div"),this.el.id="demo-bar";const o=new Date(e.started).toLocaleString();this.el.innerHTML=`
      <div class="demo-info">
        <b>${c("Demo")} #${e.id}</b>
        <span>${Ns(e.name??e.char.name??"?")}${e.job?` · ${Ns(e.job)}`:""}${e.account?` · ${Ns(e.account)}`:""}</span>
        <span class="muted">${Ns(o)}${e.score!=null?` · ${c("Puntuación")} ${e.score.toLocaleString()}`:""}${e.build?` · ${Ns(e.build)}`:""}</span>
        <span class="demo-warn hidden"></span>
      </div>
      <div class="demo-ctrl">
        <button class="demo-play" title="$ {
        c("Reproducir o pausar (Espacio)")
      }
      ">▶</button>
        <span class="demo-time">0:00 / ${ad(this.total)}</span>
        <div class="demo-track" title="$ {
        c("Ir a este momento")
      }
      "><i></i></div>
        <span class="demo-speeds">${r_.map(d=>`<button data-speed="$ {
        d
      }
      "${d===1?' class="on"':""}>×${d}</button>`).join("")}</span>
        <button class="demo-build-btn" title="$ {
        c("Equipo, stats, talentos y skills con los que entró")
      }
      ">${c("Build")}</button>
      </div>
      <div class="demo-build hidden">${d_(e.char)}</div>`,document.body.appendChild(this.el),document.body.classList.add("demo-on"),this.el.querySelector(".demo-play").onclick=()=>this.toggle();const i=this.el.querySelector(".demo-build"),r=this.el.querySelector(".demo-build-btn");r.onclick=()=>r.classList.toggle("on",!i.classList.toggle("hidden")),this.el.querySelectorAll("[data-speed]").forEach(d=>{d.onclick=()=>this.setSpeed(Number(d.dataset.speed))});const l=this.el.querySelector(".demo-track");l.onclick=d=>{const h=l.getBoundingClientRect();this.seek(Math.round((d.clientX-h.left)/h.width*this.total))},window.addEventListener("keydown",this.onKey),e.build?e.build!==i_.commit&&this.warn(c("Este run se jugó con otra versión del juego ( {
        build
      }) y su página no está guardada: se ve con la de ahora y puede no ser igual.",{build:e.build})):this.warn(c("Este run es de antes de las demos: se ve con el código de ahora y puede no ser igual."))}setSpeed(e){this.speed=e,this.el.querySelectorAll("[data-speed]").forEach(t=>t.classList.toggle("on",Number(t.dataset.speed)===e))}toggle(){if(this.game()){if(this.ended)return void this.seek(0,!0);this.playing=!this.playing,this.paint()}}async seek(e,t=this.playing){var s,n,o;e=Math.max(0,Math.min(this.total,e)),this.playing=!1,e<(((s=this.game())==null?void 0:s.ticks)??0)&&(await this.restart(),this.checked=0),e>(((n=this.game())==null?void 0:n.ticks)??0)&&await this.fastForward(e),this.ended=(((o=this.game())==null?void 0:o.ticks)??0)>=this.total,this.playing=t&&!this.ended,this.acc=0,this.verify(),this.paint()}frame(e){const t=this.game();if(t){if(this.playing){for(this.acc=Math.min(this.acc+e*this.speed,Gs.STEP*l_);this.acc>=Gs.STEP*.999&&t.ticks<this.total;)this.acc-=Gs.STEP,t.tick(Gs.STEP);this.verify(),t.ticks>=this.total&&(this.playing=!1,this.ended=!0)}this.paint()}}verify(){const e=this.game();if(!(!e||this.desync>=0)){for(;this.checked<e.checks.length&&this.checked<this.data.checks.length;this.checked++)if(e.checks[this.checked]!==this.data.checks[this.checked]){this.desync=(this.checked+1)*Nf,this.warn(c("Desde el  {
        time
      }
       la demo ya no es igual que el run (se está viendo con otro código).",{time:ad(this.desync)}));return}}}warn(e){const t=this.el.querySelector(".demo-warn");t.textContent="⚠ "+e,t.classList.remove("hidden")}paint(){const e=this.game(),t=(e==null?void 0:e.ticks)??0,s=`${t}|${this.playing}|${this.ended}`;s!==this.shown&&(this.shown=s,this.el.querySelector(".demo-play").textContent=this.ended?"↺":this.playing?"❚❚":"▶",this.el.querySelector(".demo-time").textContent=`${ad(t)} / ${ad(this.total)}`,this.el.querySelector(".demo-track i").style.width=`${(Math.min(1,t/Math.max(1,this.total))*100).toFixed(2)}%`)}destroy(){window.removeEventListener("keydown",this.onKey),this.el.remove(),document.body.classList.remove("demo-on")}}function d_(a){const e=(u,p)=>p?`<section><h4>${u}</h4>${p}</section>`:"";let t=a.promotion??a.job;try{t=ge(t).name}catch{}const s=`<div class="db-head"><b>${Ns(a.name??"?")}</b><span>${Ns(t)} · ${c("Nv  {
        n
      }
      ",{n:a.level})} · ${c("Job  {
        n
      }
      ",{n:a.jobLevel})}</span></div>`,n=_t.map(u=>{var p;return`<span><small>${u.id.toUpperCase()}</small><b>${((p=a.stats)==null?void 0:p[u.id])??0}</b></span>`}).join(""),o=a.inventory??[],i=bs.map(u=>{var m;const p=(m=a.equipped)==null?void 0:m[u.id],y=p?o.find(f=>f.uid===p):void 0;if(!y)return"";const w=(y.cards??[]).filter(Boolean).length;return`<div class="db-item" style="--q:$ {
        y.quality?Ps(y.quality):"#9aa6c4"
      }
      "><img src="$ {
        Me(y.itemId)
      }
      " alt=""><span>${Ns(ss(y))}</span><small>${Ns(u.name)}${y.ilvl?` · iLv ${y.ilvl}`:""}${w?` · ${w} ${c("cartas")}`:""}</small></div>`}).join(""),r=Object.entries(a.talents??{}).filter(([u,p])=>p>0&&Ze[u]).sort(([u],[p])=>Ze[u].job===Ze[p].job?Ze[u].branch-Ze[p].branch||Ze[u].row-Ze[p].row:Ze[u].job<Ze[p].job?-1:1).map(([u,p])=>`<span class="db-tal">${Ns(Ze[u].name)} <b>${p}/${Ze[u].maxRank}</b></span>`).join(""),l=a.endless,d=((l==null?void 0:l.skills)??[]).filter(u=>ce[u]).map(u=>`<span class="db-tal">${Ns(ce[u].name)}</span>`).join(""),h=ih.filter(u=>{var p;return(((p=l==null?void 0:l.ups)==null?void 0:p[u.id])??0)>0}).map(u=>`<span class="db-tal">${Ns(c(u.name))} <b>${l.ups[u.id]}</b></span>`).join("");return s+e(c("Stats"),`<div class="db-stats">${n}</div>`)+e(c("Equipo"),i)+e(c("Talentos"),r?`<div class="db-tags">${r}</div>`:"")+e(c("Skills de la torre"),d?`<div class="db-tags">${d}</div>`:"")+e(c("Mejoras de la torre"),h?`<div class="db-tags">${h}</div>`:"")}function Ns(a){return a.replace(/[&<>"']/g,e=>`&#${e.charCodeAt(0)};`)}var h_={commit:"7967a1a"};const u_=1e4,p_=3e4,ib=[1e3,2e3,5e3,1e4,2e4],rb=2e4,m_=63e4;class Pn{constructor(e,t,s){g(this,"ws");g(this,"url");g(this,"token");g(this,"run",0);g(this,"sentMoves",0);g(this,"sentChecks",0);g(this,"sentPicks",0);g(this,"lastSent",0);g(this,"timer",0);g(this,"retries",0);g(this,"retryTimer",0);g(this,"game",null);g(this,"claimOf",null);g(this,"closed",!1);g(this,"gone",!1);g(this,"onGone",null);g(this,"onSaved",null);g(this,"onSuspended",null);g(this,"ending",null);this.ws=e,this.url=t,this.token=s}static socket(e){const t=new URL(e);return t.searchParams.set("endless","1"),new WebSocket(t.href)}static open(e,t,s,n){return new Promise((o,i)=>{const r=Pn.socket(e),l=new Pn(r,e,t);let d=!1;r.onopen=()=>r.send(JSON.stringify({t:"start",token:t,charId:s,wave:n,engine:n_,build:h_.commit})),r.onerror=()=>!d&&i(new Error("net")),r.onclose=()=>{d?l.lost():i(new Error("net"))},r.onmessage=h=>{const u=JSON.parse(String(h.data));u.t==="started"?(d=!0,l.run=u.run,o({net:l,started:u})):u.t==="error"?d||i(new Error(u.why)):l.message(u)}})}message(e){var t,s,n;e.t==="resumed"?(this.sentMoves=e.ticks??0,this.sentChecks=e.checks??0,this.sentPicks=-1,this.retries=0,this.ending?this.ending():this.flush()):e.t==="saved"?((t=this.onSaved)==null||t.call(this,e.status??null),this.onSaved=null):e.t==="suspended"?((s=this.onSuspended)==null||s.call(this),this.onSuspended=null):e.t==="error"&&e.why==="gone"&&(this.gone=!0,this.ending?this.ending():(n=this.onGone)==null||n.call(this))}get online(){return!this.gone&&!this.closed&&this.ws.readyState===WebSocket.OPEN}lost(){var t;if(this.closed||this.gone){(t=this.onSaved)==null||t.call(this,null),this.onSaved=null;return}const e=ib[Math.min(this.retries,ib.length-1)];this.retries++,this.retryTimer=window.setTimeout(()=>{if(this.closed)return;const s=Pn.socket(this.url);this.ws=s,s.onopen=()=>s.send(JSON.stringify({t:"resume",token:this.token,run:this.run})),s.onclose=()=>this.lost(),s.onmessage=n=>this.message(JSON.parse(String(n.data)))},e)}static restore(e,t,s){return new Promise((n,o)=>{const i=Pn.socket(e),r=new Pn(i,e,t);let l=!1;i.onopen=()=>i.send(JSON.stringify({t:"resume",token:t,run:s,restore:!0})),i.onerror=()=>!l&&o(new Error("net")),i.onclose=()=>{l?r.lost():o(new Error("net"))},i.onmessage=d=>{const h=JSON.parse(String(d.data));!l&&h.t==="resumed"&&h.restore?(l=!0,r.run=s,r.sentMoves=h.ticks,r.sentChecks=h.checks,r.sentPicks=h.restore.picks.length,n({net:r,restore:{...h.restore,ticks:h.ticks,checks:h.checks}})):h.t==="error"?l||o(new Error(h.why)):r.message(h)}})}suspend(e,t){return this.timer&&window.clearInterval(this.timer),this.timer=0,new Promise(s=>{const n=r=>{window.clearTimeout(o),this.closed=!0,this.stop(),this.ws.close(),s(r)},o=window.setTimeout(()=>n(!1),rb);this.onSuspended=()=>n(!0);const i=()=>{if(this.gone)return n(!1);this.flush(),this.ws.send(JSON.stringify({t:"suspend",claim:e,cut:t}))};this.ending=i,this.ws.readyState===WebSocket.OPEN&&i()})}suspendNow(e,t){this.closed||this.ws.readyState!==WebSocket.OPEN||(this.flush(),this.ws.send(JSON.stringify({t:"suspend",claim:e,cut:t})),this.closed=!0)}attach(e,t){this.game=e,this.claimOf=t??null,this.timer=window.setInterval(()=>this.flush(),u_)}flush(){var r;const e=this.game;if(!e||this.ws.readyState!==WebSocket.OPEN)return;const t=e.moveTicks,s=[];for(let l=this.sentMoves;l<t;l++){const d=e.moves[l*2],h=e.moves[l*2+1],u=s.length;u&&s[u-3]===d&&s[u-2]===h?s[u-1]++:s.push(d,h,1)}const n=e.checks.slice(this.sentChecks),o=((r=e.endless)==null?void 0:r.picks)??[],i=o.length!==this.sentPicks;if(!s.length&&!n.length&&!i){performance.now()-this.lastSent>p_&&(this.ws.send(' {
        "t":"ping"
      }
      '),this.lastSent=performance.now());return}this.ws.send(JSON.stringify({t:"in",at:this.sentMoves,runs:s,from:this.sentChecks,checks:n,...i?{picks:o}:{},...this.claimNow(e)})),this.sentPicks=o.length,this.lastSent=performance.now(),this.sentMoves=t,this.sentChecks+=n.length}claimNow(e){try{return this.claimOf&&e.endless?{claim:this.claimOf(e)}:{}}catch{return{}}}stop(){this.timer&&window.clearInterval(this.timer),this.retryTimer&&window.clearTimeout(this.retryTimer),this.timer=this.retryTimer=0}finish(e){return this.timer&&window.clearInterval(this.timer),this.timer=0,new Promise(t=>{let s=!1;const n=d=>{s||(s=!0,t(d))},o=window.setTimeout(()=>n(null),rb),i=window.setTimeout(()=>r(null),m_),r=d=>{window.clearTimeout(o),window.clearTimeout(i),this.closed=!0,this.stop(),this.ws.close(),n(d)};this.onSaved=r;const l=()=>{if(this.gone)return r(null);this.flush(),this.ws.send(JSON.stringify({t:"end",claim:e}))};this.ending=l,this.ws.readyState===WebSocket.OPEN&&l()})}close(){this.closed=!0,this.stop(),this.ws.close()}}const f_=()=>!!ir()&&!0,Yt=a=>document.getElementById(a),ds=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),lb=a=>new URL(`assets/stages/${a}.jpg`,document.baseURI).href,g_={damage:"e_dmg",crit:"e_crit",critDmg:"e_critdmg",haste:"p_cd",area:"e_area",hp:"e_hp",guard:"e_armor",speed:"p_speed",regen:"p_regen",proj:"b_double",boss:"p_dmg",dot:"e_dot",double:"b_cast",cast:"e_cast",reach:"p_reach",targets:"b_plenty",pierce:"b_dmg",flee:"e_dodge",lifesteal:"b_lifesteal"},y_=new Set(["taekwon"]);function v_(a,e){if(!ze(a))return;let s="tower",n="",o=null;const i=f_();let r="";const l=()=>{const A=ze(a);if(!o)return A;const E=o.verified;return{...A,...E?{level:E.level,jobLevel:E.jobLevel,mvpsDefeated:[...E.mvps],promotion:E.promotion??void 0}:{},endless:{...o.progress,ups:{...o.progress.ups},skills:[...o.progress.skills]}}},d=()=>{const A=l(),E=Ph(A),C=lw(lr(A).id,E.learned).filter(({id:I})=>{var V;const N=ce[I];return N.needsShield&&!E.shield?!1:!N.weapons||N.weapons.includes(((V=E.weapon)==null?void 0:V.wtype)??"")}),_=[...new Set(E.starts.map(I=>I.skill))].filter(I=>{var N;return(N=ce[I])==null?void 0:N.create});for(const I of _)C.some(N=>N.id===I)||C.unshift({id:I});const U=ow(lr(A).rank),D=ga(A).skills.filter(I=>C.some(N=>N.id===I)&&!_.includes(I)).slice(0,Math.max(0,U-_.length));return{pool:C,chosen:D,fixed:_,max:U}},h=()=>{const A=l(),E=ga(A),C=d(),_=v==null?void 0:v.me[0],U=N=>`<span class="stg-face tk-face">${N}</span>`,D=N=>N?`<img src="$ {
        N
      }
      " alt="">`:"",I=[{id:"tower",face:U(D(se.icons.get("tk_tower")??"")),name:c("Endless Tower"),sub:o!=null&&o.bestScore?c("Mejor:  {
        n
      }
      ",{n:o.bestScore.toLocaleString()}):c("Pisos sin fin"),pill:o!=null&&o.suspended?c("Guardada"):void 0},{id:"skills",face:U(D(se.icons.get("tk_skills")??"")),name:c("Skills"),sub:c(" {
        n
      }
       de  {
        max
      }
       elegidas",{n:C.chosen.length+C.fixed.length,max:C.max})},{id:"ups",face:U(D(se.icons.get("tk_ups")??"")),name:c("Mejoras"),sub:c(" {
        n
      }
       puntos libres",{n:Nc(E)})},{id:"ladder",face:U(D(se.icons.get("tk_ladder")??"")),name:c("Ladder"),sub:_?c("Puesto  {
        n
      }
       este mes",{n:_.rank}):c("Clasificación mensual")}];Yt("tk-nav").innerHTML=I.map(N=>`<button class="stg-card tk-nav-card$ {
        N.id===s?" sel":""
      }
      " data-tab="$ {
        N.id
      }
      ">${N.face}
          <span class="stg-card-info"><b>${N.name}</b><small>${N.sub}</small></span>${N.pill?`<span class="tk-pill">${N.pill}</span>`:""}</button>`).join(""),Yt("tk-nav").querySelectorAll("[data-tab]").forEach(N=>N.onclick=()=>R(N.dataset.tab))},u=()=>{const A=l(),E=ga(A),C=rh(A);if(i&&!o){Yt("tk-detail").innerHTML=`<div class="info-panel">${r||c("Consultando la torre en el servidor…")}</div>`;return}const _=o==null?void 0:o.verified,U=ze(a),D=[];i||D.push(c("La Endless Tower necesita una cuenta registrada: el servidor comprueba cada partida para las puntuaciones. Crea una o entra en la tuya desde la portada.")),_&&(_.level<U.level||_.jobLevel<U.jobLevel)&&D.push(c("En la torre cuenta lo que el servidor ha podido comprobar de tus partidas: Base Lv  {
        lv
      }
       y Job Lv  {
        job
      }
      .",{lv:_.level,job:_.jobLevel}));const I=oh(A)&&C>0&&(i||!1),N=(o==null?void 0:o.suspended)??null,V=(pe,ye)=>`<span class="tk-chip"><small>${pe}</small><b>${ye}</b></span>`,F=pe=>{const ye=Math.max(0,Math.floor((Date.now()-pe)/36e5));return ye<1?c("hace un momento"):ye<48?c("hace  {
        n
      }
       h",{n:ye}):c("hace  {
        n
      }
       días",{n:Math.floor(ye/24)})},Y=oh(A)?C<=0?c("La torre está cerrada para ti. Supera el MVP de  {
        stage
      }
       con este personaje para abrir sus 10 primeros pisos.",{stage:_a[0].name}):"":c("La torre solo abre sus puertas a quien ha ascendido a 2nd job. Supera la historia del Castillo de Prontera con este personaje y vuelve a hablar conmigo."),Q=_a.map((pe,ye)=>{const dt=ye*Qt+1,os=dt+Qt-1,ws=ye<G1(A);return`<div class="tk-floor$ {
        ws?"":" locked"
      }
      " style="--art:url('${lb(pe.id)}')" title="$ {
        ds(ws?pe.name:c("Supera {stage}", {
          stage:pe.name
        }))
      }
      ">
        <b>${ds(pe.name)}</b><small>${c("Pisos  {
        a
      }
      – {
        b
      }
      ",{a:dt,b:os})}</small><i>${ws?E.best>=os?"✓":"":"🔒"}</i></div>`}).join("");Yt("tk-detail").innerHTML=`
      <div class="stg-banner tk-banner" style="--art:url('${lb("endless")}')">
        <span class="stg-banner-lv">${c("Pisos de 1 minuto")}</span>
        <span class="stg-banner-mvp">${Ge("npc_tower",2)?`<img src="$ {
        Ge("npc_tower",2)
      }
      " alt="">`:""}</span>
        <div class="stg-banner-text"><b>${c("Endless Tower")}</b><small>${c("Mata sin parar, encadena combos y sube piso a piso con tu Deity y tus cartas")}</small></div>
        <div class="tk-chips">${V(c("Mejor puntuación"),((o==null?void 0:o.bestScore)??0).toLocaleString())}${V(c("Mejor piso"),E.best)}${V(c("Puntos de la torre"),Nc(E))}</div>
      </div>
      ${Y?`<div class="info-panel">${Y}</div>`:`<div class="tk-actions">
        <button class="tk-go primary" id="tk-new"${I?"":" disabled"}><b>${c("Nueva partida")}</b><small>${c("Desde el piso 1")}</small></button>
        ${N?`<button class="tk-go" id="tk-continue"${I?"":" disabled"}><b>${c("Continuar partida")}</b><small>${c("Piso  {
        n
      }
       ·  {
        s
      }
       puntos ·  {
        ago
      }
      ",{n:N.wave,s:N.score.toLocaleString(),ago:F(N.saved)})}</small></button>`:""}
      </div>
      ${N?`<div class="tk-hint">${c("Empezar una partida nueva cierra la guardada (cuenta lo que ya jugaste en ella).")}</div>`:""}`}
      <div class="stg-sec"><div class="box-title">${c("Pisos de la torre")}</div><div class="tk-floors">${Q}</div></div>
      ${D.map(pe=>`<div class="info-panel"><span class="muted">${pe}</span></div>`).join("")}`;const Z=pe=>{L(),e(pe)},ke=document.getElementById("tk-new");ke&&(ke.onclick=()=>{const{pool:pe,chosen:ye,fixed:dt,max:os}=d(),ws=ye.length+dt.length,ks=pe.filter(xs=>!ye.includes(xs.id)&&!dt.includes(xs.id)).length;if(ws>=os||!ks)return Z();Ae(c("Skills sin elegir"),"<p>"+c("Llevas  {
        n
      }
       de  {
        max
      }
       skills para la torre: dentro no se pueden cambiar ni se consiguen otras.",{n:ws,max:os})+"</p>",[{label:c("Entrar así"),run:()=>Z()},{label:c("Elegir skills"),primary:!0,run:()=>R("skills")}])});const xe=document.getElementById("tk-continue");xe&&N&&(xe.onclick=()=>Z(N.run))},p=()=>{const{pool:A,chosen:E,fixed:C,max:_}=d(),U=[...C,...E],D=c("La da un talento al empezar la partida: siempre la llevas"),I=Array.from({length:_},(V,F)=>{const Y=U[F];return Y?C.includes(Y)?`<span class="tk-slot on fixed" title="$ {
        ds(ce[Y].name)
      }
       · $ {
        ds(D)
      }
      "><img src="$ {
        se.icons.get(ce[Y].icon)??""
      }
      " alt=""></span>`:`<button class="tk-slot on" data-skill="$ {
        Y
      }
      " title="$ {
        ds(ce[Y].name)
      }
      "><img src="$ {
        se.icons.get(ce[Y].icon)??""
      }
      " alt=""></button>`:'<span class="tk-slot"></span>'}).join(""),N=A.map(({id:V})=>{const F=ce[V],Y=C.includes(V),Q=Y||E.includes(V),Z=!Q&&U.length>=_,ke=F.desc(1).replace(/<[^>]+>/g,"");return Y?`<div class="tk-tile on fixed" title="$ {
        ds(D)
      }
      ">
        <span class="tk-tile-ico"><img src="$ {
        se.icons.get(F.icon)??""
      }
      " alt=""></span><b>${ds(F.name)}</b><small>${c("Por talento")}</small><i>🔒</i></div>`:`<button class="tk-tile$ {
        Q?" on":""
      }
      " data-skill="$ {
        V
      }
      "${Z?" disabled":""} title="$ {
        ds(ke)
      }
      ">
        <span class="tk-tile-ico"><img src="$ {
        se.icons.get(F.icon)??""
      }
      " alt=""></span><b>${ds(F.name)}</b><small>${c(F.kind==="passive"?"Pasiva":"Activa")}</small>${Q?"<i>✓</i>":""}</button>`}).join("");Yt("tk-detail").innerHTML=`
      <div class="stg-sec"><div class="box-title">${c("Skills para la torre")} <span class="tk-count">${U.length}/${_}</span></div><div class="tk-slots">${I}</div></div>
      <div class="stg-sec tk-grow"><div class="box-title">${c("Disponibles")}</div><div class="tk-tiles">${N}</div></div>
      <div class="info-panel"><span class="muted">${c("Empiezas con estas skills a rango 1. En la torre no hay EXP, cofres ni botín: antes de cada piso eliges una carta que mejora una de ellas. El resto de tu fuerza sale de tu equipo, de tu Deity y de las mejoras de la torre.")}</span></div>`,Yt("tk-detail").querySelectorAll("[data-skill]").forEach(V=>{V.onclick=async()=>{const F=V.dataset.skill;if(C.includes(F))return;let Y=E.filter(Q=>A.some(Z=>Z.id===Q));if(Y.includes(F)?Y=Y.filter(Q=>Q!==F):Y.length+C.length<_&&Y.push(F),i)try{o.progress=(await ML(a,Y)).progress}catch{return}else kl(a,Q=>Q.skills=Y);B.ui("ef_blessing",.25),q()}})},y=()=>{const A=ga(l()),E=Nc(A),C=D=>{const I=A.ups[D.id]??0,N=rv(D,I),V=fm(D.id),F=V<O1,Y=I>=V,Q=Y?`<span class="tk-maxed">${c("Completa")}</span>`:`<button class="tk-buy$ {
        E>=N?" primary":""
      }
      " data-up="$ {
        D.id
      }
      "${E>=N?"":" disabled"}>${c("Mejorar")} <b>${N}</b></button>`;return`<div class="tk-tile tk-up$ {
        Y?" maxed":I?" on":""
      }
      ">
        <span class="tk-tile-ico"><img src="assets/runitems/$ {
        g_[D.id]??"e_dmg"
      }
      .png" alt=""></span>
        <b>${c(D.name)}</b>
        <span class="tk-rank-badge">${F?c("Rango  {
        r
      }
      / {
        max
      }
      ",{r:I,max:V}):c("Rango  {
        r
      }
      ",{r:I})}</span>
        <small>${I?D.per(I):c("Sin mejorar")}</small>
        ${Y?"":`<small class="tk-next">→ ${D.per(I+1)}</small>`}
        ${Q}</div>`},_=B5.map(D=>`<div class="tk-up-head">${c(D.name)}</div>${ih.filter(I=>I.group===D.id).map(C).join("")}`).join("");Yt("tk-detail").innerHTML=`
      <div class="tk-points-bar"><span>${c("Puntos de la torre")}</span><b>${E}</b><small>${c("de  {
        n
      }
       ganados",{n:A.earned})}</small>${w()}
        <button class="tk-reset" id="tk-reset"${A.spent>0?"":" disabled"} title="$ {
        ds(c("Todas las mejoras vuelven a rango 0 y recuperas los puntos gastados"))
      }
      ">${c("Resetear mejoras")} <b>${pi}</b> ${c("PK")}</button></div>
      <div class="tk-tiles tk-up-tiles tk-grow">${_}</div>
      <div class="info-panel">${n||`<span class="muted">${c("Cada piso superado da puntos de la torre (más en los de jefes y en los más altos). Las mejoras son permanentes y cada rango cuesta más que el anterior (las más fuertes tienen tope); solo cuentan en la torre.")}</span>`}</div>`;const U=document.getElementById("tk-reset");U&&(U.onclick=()=>{const D=Ho();if(D<pi){Ae(c("Resetear mejoras"),"<p>"+c("Necesitas  {
        n
      }
       Puntos Kafra y tienes  {
        have
      }
      .",{n:pi,have:D.toLocaleString()})+"</p>",[{label:c("Vale"),primary:!0}]);return}Ae(c("Resetear mejoras"),"<p>"+c("Todas las mejoras de la torre de este personaje vuelven a rango 0 y recuperas los  {
        pts
      }
       puntos gastados para repartirlos de nuevo.",{pts:A.spent})+"</p><p>"+c("Cuesta  {
        n
      }
       Puntos Kafra (tienes  {
        have
      }).",{n:pi,have:D.toLocaleString()})+"</p>",[{label:c("Cancelar")},{label:c("Resetear por  {
        n
      }
       PK",{n:pi}),primary:!0,run:async()=>{if(i)try{o.progress=await CL(a)}catch(I){return n=ds(I.message),q()}else kl(a,I=>{I.ups={},I.spent=0}),If(-pi);B.ui("ef_blessing",.5),n=c("Mejoras reseteadas: tienes todos tus puntos de la torre para repartir de nuevo."),q()}}])}),Yt("tk-detail").querySelectorAll("[data-up]").forEach(D=>{D.onclick=async()=>{const I=ih.find(V=>V.id===D.dataset.up);let N=!1;if(i){D.disabled=!0;try{o.progress=(await xL(a,I.id)).progress,N=!0}catch{N=!1}}else kl(a,V=>{const F=V.ups[I.id]??0,Y=rv(I,F);F>=fm(I.id)||Nc(V)<Y||(V.ups[I.id]=F+1,V.spent+=Y,N=!0)});if(!N)return q();B.ui("ef_blessing",.5),n=c("¡ {
        name
      }
       mejorada! Rango  {
        r
      }
      .",{name:`<b>${c(I.name)}</b>`,r:ga(l()).ups[I.id]}),q()}})},w=()=>{const A=o==null?void 0:o.pending;return A&&A.runs>0?`<em title="$ {
        ds(c("El servidor comprueba las partidas a lo largo del día: sus puntos y el ladder se apuntan al comprobarlas."))
      }
      ">${c(" {
        n
      }
       por comprobar (+ {
        p
      })",{n:A.runs,p:A.points})}</em>`:""};let m="",f="all",v=null,x="";const k=A=>{if(A==="all")return c("Histórico");const[E,C]=A.split("-").map(Number);return new Date(Date.UTC(E,C-1,1)).toLocaleDateString(void 0,{month:"long",year:"numeric",timeZone:"UTC"})},M=A=>{if(A==="dancer")return ge("bard").nameF??"Dancer";try{return ge(A).name}catch{return A}},$=()=>{x="",$L(m||"current",f).then(A=>{v=A,m=A.season,q()},()=>{x=c("No se puede consultar el ladder ahora mismo. Prueba dentro de un momento."),s==="ladder"&&q()})},P=()=>{if(!i){Yt("tk-detail").innerHTML=`<div class="info-panel">${c("El ladder es de las partidas comprobadas por el servidor: necesitas una cuenta registrada.")}</div>`;return}if(!v){Yt("tk-detail").innerHTML=`<div class="info-panel">${x||c("Consultando el ladder…")}</div>`;return}const A=D=>se.icons.get(D==="all"?"tk_general":`job_${D}`)??"",E=D=>D==="all"?c("General"):M(D),C=["all",...As.filter(D=>!y_.has(D.base??"")).flatMap(D=>D.id==="bard"?["bard","dancer"]:[D.id])],_=D=>`<div class="tk-lrow$ {
        D.rank<=3?` top top${D.rank}`:""
      }
      $ {
        D.mine?" mine":""
      }
      "><u>${D.rank<=3?"★".repeat(4-D.rank):""}</u><b>${D.rank}</b><span>${ds(D.name)}</span><small>${M(D.job)}</small><em>${D.score.toLocaleString()}</em><i>${c("Piso  {
        n
      }
      ",{n:D.wave})}</i></div>`,U=v.me.filter(D=>!v.rows.some(I=>I.rank===D.rank));Yt("tk-detail").innerHTML=`<div class="tk-lhead"><b>${E(f)}</b><small>${k(v.season)}</small></div>
      <div class="tk-ljobs">${C.map(D=>`<button class="tk-ljob$ {
        D===f?" active":""
      }
      " data-ljob="$ {
        D
      }
      " title="$ {
        ds(E(D))
      }
      "><img src="$ {
        A(D)
      }
      " alt=""></button>`).join("")}</div>
      <div class="chr-list tk-scroll tk-ladder-list">${v.rows.length?v.rows.map(_).join(""):`<div class="info-panel">${c("Nadie ha superado aún ningún piso en esta clasificación.")}</div>`}${U.length?`<div class="tk-lsep">…</div>${U.map(_).join("")}`:""}</div>
      <div class="info-panel"><span class="muted">${c("Cuenta la mejor partida de cada personaje: la puntuación más alta y, a igualdad, el piso más alto superado. Solo partidas comprobadas por el servidor (las comprueba a lo largo del día). Las temporadas son por mes (hora UTC).")}</span></div>`,Yt("tk-detail").querySelectorAll("[data-ljob]").forEach(D=>{D.onclick=()=>{D.dataset.ljob!==f&&(f=D.dataset.ljob,Yt("tk-detail").querySelectorAll(".tk-ljob").forEach(I=>I.classList.toggle("active",I===D)),$())}})},q=()=>{h(),Yt("tk-detail").className=`stg-detail tk-detail tk-on-${s}`,s==="tower"?u():s==="skills"?p():s==="ups"?y():P()},R=A=>{s=A,n="",q()},L=()=>{window.removeEventListener("keydown",j),de("towerkeeper")},j=A=>{A.key==="Escape"&&L()};window.addEventListener("keydown",j),Yt("tk-close").onclick=L,q(),Ue("towerkeeper"),i&&(w1(a).then(A=>{o=A,q()},()=>{r=c("No se puede consultar la torre ahora mismo. Prueba dentro de un momento."),q()}),$())}const Wf=[{name:"Blood Savage",towerFloor:50}];function b_(a){const e=Wf.find(t=>t.name===a);return e?S1().includes(a)?!0:$a().some(t=>t.id!=="dev"&&ga(t).best>=e.towerFloor):!1}function w_(a){const e=Wf.find(t=>a>=t.towerFloor&&!S1().includes(t.name));return e&&zL(e.name),e}const vo=a=>document.getElementById(a),bo=a=>a.replace(/[&<>"]/g,e=>( {
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
      })[e]);
      function k_(a) {
        let e="acc",t="";
        const s=()=> {
          vo("pk-kafra").textContent=`${Ho().toLocaleString(c("es-ES"))} ${c("Puntos Kafra")}`
        },n=(h,u,p,y,w=!1)=>`<div class="chr-ach${w?" done":""}"><span class="pk-icon">${h?`<img src="${h}" alt="">`:""}</span><div class="chr-info"><b>${u}</b><small>${p}</small></div>${y}</div>`,o=()=> {
          const h=ar(),u=Ho(),p=w=>h.pets[w]?h.pets[w].acc?2:Jp(w,h)?1:0:3,y=Rt.filter(w=>w.acc).sort((w,m)=>p(w.id)-p(m.id));
          vo("pk-list").innerHTML=y.map(w=> {
            const m=h.pets[w.id],f=Jp(w.id,h),v=`${bo(Ft(w.acc))} <small>· ${bo(Ht(w.id))}</small>`;if(m!=null&&m.acc)return n(Me(w.acc),v,c("Puesto: bonus ×{m}", {
              m:Ee(an,1)
            }),`<span class="chr-maxed">${c("Comprado")}</span>`,!0);const x=f?`<span class="chr-maxed pk-locked">${c("Bloqueado")}</span>`:`<button class="ro-btn small${u>=Ln?" primary":""}" data-acc="${w.id}"${u>=Ln?"":" disabled"}>${c("Comprar")} · ${Ln}</button>`;return n(Me(w.acc),v,f||c("Bonus del pet ×{m}", {
              m:Ee(an,1)
            }),x)
          }).join(""),vo("pk-list").querySelectorAll("[data-acc]").forEach(w=> {
            w.onclick=()=> {
              const m=w.dataset.acc;if(Ho()<Ln||!cT(m))return;If(-Ln),B.ui("ef_coin",.5);const f=Rt.find(v=>v.id===m);t=c("¡{pet} ya lleva su {acc}!", {
                pet:`<b>${bo(Ht(m))}</b>`,acc:bo(Ft(f.acc))
              }),r()
            }
          })
        },i=()=> {
          const h=ar(),u=es().kills;
          vo("pk-list").innerHTML=Rt.filter(p=>p.from).map(p=> {
            const y=`${bo(Ht(p.from))} → ${bo(Ht(p.id))}`;if(h.pets[p.id])return n(Ge(Xn(p.id)),y,c("Ya lo tienes."),`<span class="chr-maxed">${c("Conseguido")}</span>`,!0);const w=lf(p.id,u,h),m=`<button class="ro-btn small${w?"":" primary"}" data-evo="${p.id}"${w?" disabled":""}>${c("Evolucionar")}</button>`;return n(Ge(Xn(p.id)),y,w||c("¡Listo para evolucionar!"),m)
          }).join(""),vo("pk-list").querySelectorAll("[data-evo]").forEach(p=> {
            p.onclick=()=> {
              const y=p.dataset.evo;dT(y,es().kills)&&(B.ui("ef_angelus",.5),t=c("¡Ha nacido {pet}! Llévalo desde la pestaña Pets del personaje.", {
                pet:`<b>${bo(Ht(y))}</b>`
              }),r())
            }
          })
        },r=()=> {
          s(),document.querySelectorAll("#petkeeper .tab-btn").forEach(h=>h.classList.toggle("active",h.dataset.pk===e)),e==="acc"?o():i(),vo("pk-note").innerHTML=t||`<span class="muted">${e==="acc"?c("Cada pet puede llevar su accesorio de RO cuando llega a Cordial. Los Puntos Kafra se ganan vendiendo equipo y cartas."):c("Los pets de los jefes nacen evolucionando al de antes: con él en Leal y el jefe vencido varias veces. El de antes se queda.")}</span>`
        };
        document.querySelectorAll("#petkeeper .tab-btn").forEach(h=>h.onclick=()=> {
          e=h.dataset.pk,t="",r()
        });
        const l=()=> {
          window.removeEventListener("keydown",d),de("petkeeper"),a()
        },d=h=> {
          h.key==="Escape"&&l()
        };
        window.addEventListener("keydown",d),vo("pk-close").onclick=l,r(),Ue("petkeeper")
      }
      const Js=a=>document.getElementById(a),jn=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),nd=a=>HS(a.es,a.en||a.es,a.zh),cb=a=>new Date(a).toLocaleDateString(Ia(),{day:"numeric",month:"short",year:"numeric"}),wo=a=>!!a.attach&&!a.claimed;async function x_(){var a;return(((a=await k1())==null?void 0:a.pending)??0)>0}const db={notice:"✉",gift:"🎁",recovered:"📦"};function M_(a){const e=a.attach;if(!e)return"";const t=[];(e.gear??[]).forEach((o,i)=>{const r=o.quality??0;t.push(`<div class="item-cell${r?` q${r}`:""}" data-g="${i}"><img src="${Me(o.itemId)}" alt="">${o.refine?`<span class="qty">+${o.refine}</span>`:""}</div>`)});for(const[o,i]of Object.entries(e.cards??{}))t.push(`<div class="item-cell" data-card="${o}"><img src="${se.icons.get("card")}" alt=""><span class="qty">${i}</span></div>`);for(const[o,i]of Object.entries(e.ores??{}))t.push(`<div class="item-cell" title="${jn(Ft(Number(o)))}"><img src="${Me(Number(o))}" alt=""><span class="qty">${i}</span></div>`);const s=e.kafra?`<span class="kafra">${e.kafra.toLocaleString(Ia())} ${c("Puntos Kafra")}</span>`:"",n=a.claimed?`<span class="chr-maxed">${c("Recogido")}</span>`:e.bound?`<span class="muted">${c("Ligado a tu cuenta: no se puede comerciar.")}</span>`:"";return`<div class="mb-attach"><div class="mb-attach-head">${c("Adjunto")} ${s} ${n}</div>${t.length?`<div class="item-grid mb-grid${a.claimed?" claimed":""}">${t.join("")}</div>`:""}</div>`}function $_(a){var i;const e=a.attach,t=[],s=((i=e.gear)==null?void 0:i.length)??0;s&&t.push(s===1?`<b>${jn(Ft(e.gear[0].itemId))}</b>`:c("{n} piezas",{n:s})),e.kafra&&t.push(`${e.kafra.toLocaleString(Ia())} ${c("Puntos Kafra")}`);const n=Object.values(e.cards??{}).reduce((r,l)=>r+l,0);n&&t.push(n===1?`<b>${jn(qt(Number(Object.keys(e.cards)[0])))}</b>`:c("{n} cartas",{n}));const o=Object.values(e.ores??{}).reduce((r,l)=>r+l,0);return o&&t.push(c("{n} minerales",{n:o})),c("Recogido: {what}. Ya está en tu cuenta.",{what:t.join(" · ")})}function S_(a){let e=null,t=0,s="",n=!1;const o=()=>{var y,w,m,f;const d=(e==null?void 0:e.mail)??[];d.some(v=>v.id===t)||(t=((y=d[0])==null?void 0:y.id)??0),Js("mb-list").innerHTML=e?d.length?d.map(v=>`<div class="chr-ach mb-row${v.id===t?" sel":""}${wo(v)||!v.read?"":" done"}" data-id="${v.id}"><span class="pk-icon mb-icon">${db[v.kind]??db.notice}</span><div class="chr-info"><b>${jn(nd(v.title))}</b><small>${cb(v.at)}</small></div>${wo(v)?`<span class="mb-tag">${c("Adjunto")}</span>`:v.read?"":`<span class="mb-tag">${c("Nuevo")}</span>`}</div>`).join(""):`<div class="empty-note">${c("No tienes cartas.")}</div>`:`<div class="empty-note">${c("No se ha podido abrir el buzón. Comprueba la conexión.")}</div>`,Js("mb-list").querySelectorAll("[data-id]").forEach(v=>{v.onclick=()=>{t=Number(v.dataset.id),s="",o()}});const h=d.find(v=>v.id===t);Js("mb-read").innerHTML=h?`<div class="mb-title">${jn(nd(h.title))}</div><div class="mb-meta">${c("Del equipo de RO Life")} · ${cb(h.at)}</div><div class="mb-body">${jn(nd(h.body))}</div>${M_(h)}`:`<span class="muted">${c("Aquí llegan los avisos y regalos del equipo del juego, y lo que recuperemos de tu cuenta.")}</span>`,((m=(w=h==null?void 0:h.attach)==null?void 0:w.gear)!=null&&m.length||(f=h==null?void 0:h.attach)!=null&&f.cards)&&to(Js("mb-read"),"[data-g], [data-card]",v=>{if(v.dataset.card)return Fh(Number(v.dataset.card));const x=h.attach.gear[Number(v.dataset.g)],k={uid:"",cards:[],...x,affixes:x.affixes??[]};return rc(k,k.quality?`<div class="muted">${Re[k.quality].name}</div>`:"")}),Js("mb-note").innerHTML=s;const u=Js("mb-claim"),p=Js("mb-delete");u.hidden=!h||!wo(h),u.disabled=n,p.hidden=!h||wo(h),p.disabled=n},i=async d=>{if(!n){n=!0,o();try{await d()}catch(h){s=`<span class="err">${jn(h instanceof Error?h.message:String(h))}</span>`}n=!1,o()}};Js("mb-claim").onclick=()=>void i(async()=>{const d=e==null?void 0:e.mail.find(h=>h.id===t);!d||!wo(d)||(await jL(d.id),d.claimed=!0,e.pending=e.mail.filter(wo).length,B.ui("ef_coin",.5),s=$_(d))}),Js("mb-delete").onclick=()=>{const d=e==null?void 0:e.mail.find(h=>h.id===t);d&&Ae(c("Cartero"),c("¿Tirar la carta «{title}»?",{title:jn(nd(d.title))}),[{label:c("Cancelar")},{label:c("Tirar"),primary:!0,run:()=>void i(async()=>{e=await PL(d.id),s=""})}])};const r=()=>{window.removeEventListener("keydown",l),de("mailbox"),a(!!(e!=null&&e.mail.some(wo)))},l=d=>{d.key==="Escape"&&r()};window.addEventListener("keydown",l),Js("mb-close").onclick=r,n=!0,o(),Js("mb-list").innerHTML=`<div class="empty-note">${c("Buscando tus cartas…")}</div>`,Ue("mailbox"),k1().then(d=>{e=d,n=!1,d!=null&&d.mail.some(h=>!h.read)&&AL(),o();for(const h of(d==null?void 0:d.mail)??[])h.read=!0})}const Xt=a=>document.getElementById(a),Tm=[["Blood Savage",""],["Bronze Sentry","Se desbloquea en la Endless Tower (próximamente)"],["Black Guard","Se desbloquea en la Endless Tower (próximamente)"],["Shadow","Se desbloquea al superar Shadow Niff (próximamente)"]];function E_(a,e){const t=Bd(a,e.gender),s=ec().filter(o=>!o.creation&&!t.includes(o.row)),n=o=>{const i=Tm.findIndex(([r])=>r===o);return i<0?Tm.length:i};return[...t,...s.sort((o,i)=>n(o.name)-n(i.name)).map(o=>o.row)]}function hb(a,e,t,s){var i;if(t===s||Mt()||Bd(a,e.gender).includes(t))return;const n=ec().find(r=>r.row===t);if(n&&b_(n.name))return;const o=Wf.find(r=>r.name===(n==null?void 0:n.name));return o?c("Se desbloquea al superar el piso {n} de la Endless Tower",{n:o.towerFloor}):c(((i=Tm.find(([r])=>r===(n==null?void 0:n.name)))==null?void 0:i[1])??"Tinte especial: se consigue más adelante")}let _n=null;function Sx(){_n==null||_n()}function T_(a,e){Sx();const t=ze(a);if(!t)return;const s=ri(t),n=La(t),o={...t.look},i={...t.look};let r=0,l=null,d=0,h="";const u=Xt("st-preview"),p=u.getContext("2d");p.imageSmoothingEnabled=!1;const y=()=>i.hair===o.hair&&i.hairColor===o.hairColor&&i.cloth===o.cloth,w=()=>{const P=fl(i.gender);P.includes(i.hair)||(i.hair=P[0]);const q=jp(i.gender,i.hair),R=uw(s,i.gender);q&&i.hairColor>=q.palettes&&(i.hairColor=0),R&&!_p(s,i.gender,i.cloth)&&(i.cloth=0),Xt("st-hair").textContent=`${P.indexOf(i.hair)+1} / ${P.length}`,dh(Xt("st-haircolors"),[...Array((q==null?void 0:q.palettes)??1).keys()],i.hairColor,q,!1,j=>{i.hairColor=j,h="",w()}),dh(Xt("st-clothcolors"),E_(s,i),i.cloth,R,!0,j=>{i.cloth=j,h="",w()},j=>hb(s,i,j,o.cloth)),Xt("st-ok").disabled=y()||!!m(),Xt("st-reset").disabled=y(),f();const L=++d;It(s,i,n).then(j=>{L===d&&(l=j)})},m=()=>hb(s,i,i.cloth,o.cloth),f=()=>{const P=m(),q=ec().find(R=>R.row===i.cloth);if(P&&q){Xt("st-note").innerHTML=`🔒 <b>${c(q.name)}</b>: ${P}. <span class="muted">${c("Puedes verlo en la vista previa, pero aún no aplicarlo.")}</span>`;return}Xt("st-note").innerHTML=h||`<span class="muted">${c("Cambia el peinado, el color de pelo y el de la ropa cuando quieras, sin coste. El color de ropa se conserva al cambiar de job.")}</span>`},v=P=>{const q=fl(i.gender),R=q.indexOf(i.hair);i.hair=q[(R+P+q.length)%q.length],h="",w()},x=Of(u,P=>{p.clearRect(0,0,u.width,u.height),p.fillStyle="rgba(0,0,0,0.25)",p.beginPath(),p.ellipse(u.width/2,u.height-30,34,11,0,0,Math.PI*2),p.fill(),l&&oi(p,l,"idle",r,Math.floor(P/120),u.width/2,u.height-30,2)});_n=()=>{_n=null,x(),window.removeEventListener("keydown",$),de("stylist")};const k=()=>{_n==null||_n(),e()},M=()=>{if(y()||m())return;const P=ze(a);if(!P)return k();P.look={...P.look,hair:i.hair,hairColor:i.hairColor,cloth:i.cloth},ja(P),Object.assign(o,P.look),B.ui("ef_coin",.5),h=`<b>${c("¡Listo! Te queda genial.")}</b>`,w()},$=P=>{P.key==="Escape"&&k(),P.key==="ArrowLeft"&&(r=(r+1)%8),P.key==="ArrowRight"&&(r=(r+7)%8)};window.addEventListener("keydown",$),Xt("st-hair-prev").onclick=()=>v(-1),Xt("st-hair-next").onclick=()=>v(1),Xt("st-rot-l").onclick=()=>r=(r+1)%8,Xt("st-rot-r").onclick=()=>r=(r+7)%8,Xt("st-reset").onclick=()=>{Object.assign(i,o),h="",w()},Xt("st-close").onclick=k,Xt("st-ok").onclick=M,w(),Ue("stylist")}const od=a=>document.getElementById(a),b=(a,e,t)=>Te.lang==="es"?c(a):Te.lang==="zh-TW"&&t?t:e,Gi=()=>Te.lang==="es"?"es-ES":Te.lang==="zh-TW"?"zh-TW":"en-US",Xe=(a,e=0