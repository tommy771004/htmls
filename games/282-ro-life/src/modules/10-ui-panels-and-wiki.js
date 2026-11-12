/**
 * ============================================================================
 * RO Life Source Module: 10-ui-panels-and-wiki.js
 * Description: UI Focus & Talent Tree UI, Character Select/Create/Panel, Stages UI, Kafra Shop, Stylist, In-Game Wiki, Title Screen Parade (`class uq`), Changelogs (`Ix`/`Cq`/`Lq`), Performance Overlay (`class Jf`), and Bootstrap (`Hq`)
 * ============================================================================
 */

6,ey=7,S2=8,mu=9,ty=12,sy=13,ay=14,ny=15,E2=["#options","#drop-reveal","#picker","#npc-dialog","#player-menu","#emote-panel","#friends","#story","#gameover","#pause","#cp-sock","#charpanel","#stages","#shop","#smith","#chronicle","#petkeeper","#mailbox","#wiki","#towerkeeper","#stylist","#charcreate","#inspect","#charselect","#splash .sp-card"],Hw='.tab-btn, .sp-tabs [role="tab"]',Fw=".inv-filters .inv-chip, .tree-tabs .tree-tab",Ym='button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',T2=a=>a.onclick!==null||a.oncontextmenu!==null||a.ondblclick!==null,bd=a=>a instanceof HTMLElement&&!a.matches(":disabled")&&!a.matches(Hw)&&!a.matches(Fw)&&(a.matches(Ym)||T2(a)),Op=a=>(a.matches("input, select")?a.closest("label, .opt-row")??a:a).getBoundingClientRect(),ut=a=> {
  if(a.classList.contains("hidden")||a.closest(".hidden"))return!1;
  const e=Op(a);
  return e.width>0&&e.height>0&&getComputedStyle(a).visibility!=="hidden"
};
function C2() {
  const a=[];
  for(const e of E2) {
    const t=document.querySelector(e);
    t&&ut(t)&&a.push(t)
  }
  return Po&&ut(Po)?a.push(Po):Po=null,a
}
let Po=null;
function zw(a) {
  const e=[...a.querySelectorAll("*")].filter(bd),t=new Set(e);
  return e.filter(s=> {
    if(!s.matches(Ym)) {
      let n=0;for(const o of s.querySelectorAll("*"))if(t.has(o)&&++n>=2)return!1
    }
    return ut(s)
  })
}
function oy(a,e) {
  const t=Dp(e);
  if(!(a.querySelector(".pk-card")&&!(t!=null&&t.classList.contains("pk-card"))))return t
}
const Dp=a=>a.find(e=>e.classList.contains("pk-card"))??a.find(e=>e.classList.contains("sel")||e.classList.contains("selected"))??a.find(e=>e.classList.contains("primary"))??a[0],Zt="pad-hover",iy=new WeakSet;
function Uw(a) {
  const e=[];
  let t=0,s=0;
  for(let n=0;n<a.length;n++) {
    const o=a[n];
    o==="("||o==="["?t++:o===")"||o==="]"?t--:o===","&&!t&&(e.push(a.slice(s,n)),s=n+1)
  }
  return e.push(a.slice(s)),e.map(n=>n.trim())
}
function L2(a) {
  const e=Uw(a).filter(t=>/:hover|:focus-visible/.test(t)).map(t=>t.replace(/:hover|:focus-visible/g,`.${Zt}`));
  return e.length?[...new Set(e)].join(", "):null
}
const ry=new RegExp("(?<=^|[\\s>+~(])(input|select)((\\[[^\\]]*\\])|([.:#][\\w-]+(\\([^)]*\\))?))*");
function A2(a) {
  const e=Uw(a).filter(t=>ry.test(t)&&!t.includes(`.${Zt}`)).map(t=>t.replace(ry,s=>`${s}.${Zt}`));
  return e.length?e.join(", "):null
}
const P2=typeof CSS<"u"&&CSS.supports("color","oklch(from red l c h)"),ly=a=>P2?`oklch(from ${a} l calc(c * 1.6) 29)`:`color-mix(in oklab, ${a} 35%, #c0392b)`,j2=/^(var|rgba?|hsla?|color-mix|oklch|oklab|lab|lch|color)\(/i;function Gw(a) {
  var s;let e="",t=0;for(;t<a.length;) {
    const n=a.slice(t);if(j2.test(n)&&(t===0||/[\s,(]/.test(a[t-1]))) {
      let i=0,r=t;for(;r<a.length;r++)if(a[r]==="(")i++;else if(a[r]===")"&&--i===0)break;const l=a.slice(t,r+1),d=(s=/^var\((--[\w-]+)/.exec(l))==null?void 0:s[1],h=d?getComputedStyle(document.documentElement).getPropertyValue(d).trim():"";e+=h&&/gradient\(|,/.test(h)?Gw(h):ly(l),t=r+1;continue
    }
    const o=/^#[0-9a-f] {
      3,8
    }
    \b/i.exec(n);if(o) {
      e+=ly(o[0]),t+=o[0].length;continue
    }
    e+=a[t],t++
  }
  return e
}
const _2=/^(color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|box-shadow|text-shadow|accent-color|fill|stroke|caret-color|text-decoration(-color)?)$/;function cy(a,e) {
  return a.split(/;(?![^(]*\))/).map(t=> {
    const s=t.indexOf(":");if(s<0)return"";const n=t.slice(0,s).trim(),o=_2.test(n);if(e&&!o)return"";const i=/!important\s*$/.test(t),r=t.slice(s+1).replace(/!important\s*$/,"").trim();return`${n}: ${o?Gw(r):r}${i?" !important":""}`
  }).filter(Boolean).join("; ")
}
const q2= {
  ".ro-btn.primary":`.ro-btn.${Zt}:not(:disabled)`,'.prim-btn[data-d="1"]':`.prim-row.${Zt} .prim-btn:not(:disabled)`,".prim-name":`.prim-row.${Zt} .prim-name`,".sock.sel":`.sock.${Zt}`,".lobby-name.npc":`.lobby-name.other.${Zt}`
};function Vw(a) {
  for(let e=a.cssRules.length-1;e>=0;e--) {
    const t=a.cssRules[e];if(t instanceof CSSStyleRule) {
      const s=q2[t.selectorText.replace(/'/g,'"')];if(s)try{a.insertRule(`${s} { ${cy(t.style.cssText,!1)} }`,e+1)}catch{}const n=L2(t.selectorText),o=n??A2(t.selectorText);if(!o)continue;const i=cy(t.style.cssText,!n);if(!i)continue;try{a.insertRule(`${o} { ${i} }`,e+1)}catch{}}else t instanceof CSSGroupingRule&&Vw(t)}}function Kw(){for(const a of document.styleSheets)if(!iy.has(a)){iy.add(a);try{Vw(a)}catch{}}}let Hp=null;function ta(a,e=!0){const t=a.getBoundingClientRect();return{clientX:t.left+t.width/2,clientY:t.top+t.height/2,bubbles:e,cancelable:!0,view:window}}function I2(a){a.dispatchEvent(new PointerEvent("pointerover",{...ta(a),pointerType:"mouse"})),a.dispatchEvent(new PointerEvent("pointerenter",{...ta(a,!1),pointerType:"mouse"})),a.dispatchEvent(new MouseEvent("mouseover",ta(a))),a.dispatchEvent(new MouseEvent("mouseenter",ta(a,!1))),a.dispatchEvent(new MouseEvent("mousemove",ta(a))),Hp=a}function R2(){const a=Hp;Hp=null,a&&(a.dispatchEvent(new PointerEvent("pointerout",{...ta(a),pointerType:"mouse"})),a.dispatchEvent(new PointerEvent("pointerleave",{...ta(a,!1),pointerType:"mouse"})),a.dispatchEvent(new MouseEvent("mouseout",ta(a))),a.dispatchEvent(new MouseEvent("mouseleave",ta(a,!1))))}function Nd(a,e=!1){if(e)return a.dispatchEvent(new MouseEvent("contextmenu",{...ta(a),button:2,buttons:2}));if(a.matches("input, select, a[href]"))return a.click();a.dispatchEvent(new MouseEvent("click",{...ta(a),detail:1}))}function Xm(){R2();for(const a of document.querySelectorAll(`.${Zt}`))a.classList.remove(Zt)}let jo=null;function Ww(a){var n,o;if(a.id)return`#${a.id}`;const e=[...a.classList].filter(i=>!/^(sel|active|pad-hover|has-new|worn|equipped|filled)$/.test(i)).join("."),t=Object.entries(a.dataset).map(([i,r])=>`${i}=${r}`).join(",");return`${((o=(n=a.parentElement)==null?void 0:n.closest("[id]"))==null?void 0:o.id)??""}>${a.tagName}.${e}[${t}]`}function Hs(a){!a.matches(Ym)&&!a.hasAttribute("tabindex")&&a.setAttribute("tabindex","-1"),a.focus({preventScroll:!0}),a.scrollIntoView({block:"nearest",inline:"nearest"}),Kw(),Xm();for(let t=a;t&&t!==document.body;t=t.parentElement)t.classList.add(Zt);I2(a);const e=a.getBoundingClientRect();jo={key:Ww(a),x:e.left+e.width/2,y:e.top+e.height/2},Up=!0}function B2(a){if(!jo||!a.length)return null;const e=a.find(n=>Ww(n)===jo.key);if(e)return e;let t=null,s=1/0;for(const n of a){const o=n.getBoundingClientRect(),i=Math.hypot(o.left+o.width/2-jo.x,o.top+o.height/2-jo.y);i<s&&(s=i,t=n)}return t}function Yw(a){const e=[...a.querySelectorAll(Hw)].filter(t=>ut(t)&&!t.disabled);return e.filter(t=>{var s;return t.parentElement===((s=e[0])==null?void 0:s.parentElement)})}function Xw(a){const e=[...a.querySelectorAll(Fw)].filter(t=>ut(t)&&!t.disabled);return e.filter(t=>{var s;return t.parentElement===((s=e[0])==null?void 0:s.parentElement)})}function dy(a,e){const t=Xw(a);if(t.length<2)return;const s=Math.max(0,t.findIndex(n=>n.classList.contains("active")));Nd(t[(s+e+t.length)%t.length])}function hy(a,e){const t=Yw(a);if(t.length<2)return!1;const s=Math.max(0,t.findIndex(n=>n.classList.contains("active")));return Nd(t[(s+e+t.length)%t.length]),!0}function N2(a,e,t,s){const n=Jm(a,e,t,s);n&&Hs(n)}function Jm(a,e,t,s){const n=Op(e),o=n.left+n.width/2,i=n.top+n.height/2;let r=null,l=1/0,d=!1;for(const h of a){if(h===e)continue;const u=Op(h),p=u.left+u.width/2-o,y=u.top+u.height/2-i,w=p*t+y*s;if(w<=4)continue;const m=Math.abs(p*s-y*t),f=t?u.top<n.bottom&&u.bottom>n.top:u.left<n.right&&u.right>n.left;if(!f&&m>w*(t?.5:2.5)||d&&!f)continue;const v=w+m*2.5;(f&&!d||v<l)&&(l=v,r=h,d=f)}return r}const Od=new Map;function rn(a,e,t){Od.set(a,e),t?Pl.set(a,t):Pl.delete(a)}function Fp(a){Od.delete(a),Pl.delete(a)}const Pl=new Map;let Sn=null,zp="";function Mi(a){const e=a!=null&&a.length?a.map(t=>t.join(":")).join("|"):"";e!==zp&&(zp=e,Sn||(Sn=document.createElement("div"),Sn.id="pad-hints",document.body.appendChild(Sn)),Sn.classList.toggle("hidden",!e),Sn.innerHTML=(a??[]).map(([t,s])=>`<span><kbd>${c(t)}</kbd>${c(s)}</span>`).join("")),O2()}function O2(){const a=document.getElementById("party-frame");if(!a||document.documentElement.classList.contains("touch"))return;let e="";if(Sn&&zp&&ut(a)){const t=parseFloat(getComputedStyle(a).zoom)||1;e=`${Math.round((window.innerHeight-Sn.getBoundingClientRect().top+8)/t)}px`}a.style.bottom!==e&&(a.style.bottom=e)}function D2(a){const e=[];return a instanceof HTMLInputElement&&a.type==="range"?e.push(["←/→","Ajustar"]):a instanceof HTMLSelectElement?e.push(["←/→","Cambiar"]):a&&e.push(["A",a instanceof HTMLInputElement&&a.type==="checkbox"?"Marcar":"Elegir"]),e.push(["B","Atrás"]),e}function H2(a,e){const t=e.filter(([i])=>i!=="LB/RB"&&i!=="LT/RT"),s=[];Yw(a).length>=2&&s.push(["LB/RB","Pestañas"]);const n=Xw(a);n.length>=2&&s.push(["LT/RT",n[0].classList.contains("tree-tab")?"Rama":"Filtro"]);const o=t.findIndex(([i])=>i==="B");return o<0?[...t,...s]:[...t.slice(0,o),...s,...t.slice(o)]}function He(a){a&&Hs(a)}const pa=Jm;let In=null;function uy(a){In&&In!==a&&In.classList.remove(Zt),In=a,a&&(Kw(),a.classList.add(Zt))}function F2(a,e){if(!e)return!1;if(a instanceof HTMLInputElement&&a.type==="range"){const t=Number(a.min||0),s=Number(a.max||100),n=Number(a.step)||1,o=Math.max(n,Math.round((s-t)/20/n)*n);a.value=String(Math.min(s,Math.max(t,Number(a.value)+e*o)))}else if(a instanceof HTMLSelectElement){const t=a.selectedIndex+e;if(t<0||t>=a.options.length)return!0;a.selectedIndex=t}else return!1;return a.dispatchEvent(new Event("input",{bubbles:!0})),a.dispatchEvent(new Event("change",{bubbles:!0})),!0}const py=a=>a.scrollHeight>a.clientHeight+2&&/auto|scroll/.test(getComputedStyle(a).overflowY);function z2(a,e){for(let t=a;t&&e.contains(t);t=t.parentElement)if(py(t))return t;return[...e.querySelectorAll("*")].find(py)??null}function Sc(a){window.dispatchEvent(new KeyboardEvent("keydown",{key:a,bubbles:!0})),window.dispatchEvent(new KeyboardEvent("keyup",{key:a,bubbles:!0}))}const my=a=>Math.abs(a)<vd?0:a;function U2(a,e){const t=Math.hypot(a,e);if(t<vd)return{x:0,y:0};const s=Math.min(1,(t-vd)/(1-vd))/t;return{x:a*s,y:e*s}}let fu=[],Ec="",fy=0,Up=!1,Tc=null,gu=!1,fn=null;const G2=1500;let gy=new Set;const yu=new Map;let Jw=0;function Qw(){requestAnimationFrame(Qw),Zw()}function Zw(){var P,q,R,L,j;Jw=performance.now();const a=[...((P=navigator.getGamepads)==null?void 0:P.call(navigator))??[]].find(A=>A&&A.connected&&A.buttons.length>mu);if(!a){it.move.x=it.move.y=it.look.x=it.look.y=0,fu=[],Mi(null);return}const e=a.buttons.map(A=>A.pressed),t=fu,s=A=>e[A]&&!t[A];fu=e;const n=U2(a.axes[0]??0,a.axes[1]??0),o=my(a.axes[2]??0),i=my(a.axes[3]??0);(e.some(Boolean)||n.x||n.y||o||i)&&document.body.classList.add("pad-nav");const r=C2(),l=r[0]??null,d=r.filter(A=>!gy.has(A));gy=new Set(r);for(const A of d)yu.delete(A);if(!l){Up&&(Xm(),Up=!1);const A=document.getElementById("chat-input");if(A&&document.activeElement===A){it.move.x=it.move.y=it.look.x=it.look.y=0,s(pu)&&((q=A.form)==null||q.requestSubmit()),s($c)&&A.blur(),Mi(document.body.classList.contains("pad-nav")?[["A","Enviar"],["B","Cerrar chat"]]:null);return}it.move.x=n.x,it.move.y=n.y,it.look.x=o+(e[Zg]?1:0)-(e[Qg]?1:0),it.look.y=i,s(mu)&&Sc("Escape"),In!=null&&In.isConnected&&document.body.classList.contains("pad-nav")&&In.classList.add(Zt);const E=Od.get("town"),C=(Y,Q=0)=>(E==null?void 0:E({kind:Y,dx:Q,dy:0,focused:null}))??!1;s(ay)&&C("move",-1),s(ny)&&C("move",1),s($c)&&C("B");const _=document.getElementById("chat-emote");s(ty)&&A&&ut(A)&&!A.disabled&&A.focus(),s(sy)&&_&&ut(_)&&_.click();const U=document.getElementById("lobby-prompt");s(pu)&&!C("A")&&U&&ut(U)&&U.click(),s(Jg)&&Sc("c");const D=document.getElementById("party-frame");s(ey)&&D&&ut(D)&&(Po=D);const I=document.getElementById("lobby-friends"),N=document.getElementById("lobby-switch");s(Xg)&&I&&ut(I)&&I.click(),s(S2)&&N&&ut(N)&&N.click();const V=document.getElementById("lobby-ui"),F=[...((R=Pl.get("town"))==null?void 0:R(null))??[]];U&&ut(U)&&!F.some(([Y])=>Y==="A")&&F.push(["A","Hablar"]),A&&ut(A)&&!A.disabled&&F.push(["↑","Chat"]),_&&ut(_)&&F.push(["↓","Emotes"]),I&&ut(I)&&F.push(["X","Amigos"]),F.push(["Y","Personaje"]),D&&ut(D)&&F.push(["RT","Grupo"]),N&&ut(N)&&F.push(["Select","Cambiar personaje"]),F.push(["Start","Opciones"]),Mi(document.body.classList.contains("pad-nav")&&V&&ut(V)?F:null);return}it.move.x=it.move.y=it.look.x=it.look.y=0,l!==Tc&&(Tc&&yu.set(Tc,jo),jo=yu.get(l)??null),Tc=l;const h=Od.get(l.id),u=(A,E=0,C=0)=>{if(!h)return!1;const _=document.activeElement;return h({kind:A,dx:E,dy:C,focused:_ instanceof HTMLElement&&l.contains(_)?_:null})};let p=null;const y=()=>p??(p=zw(l)),w=document.activeElement,m=w&&l.contains(w)&&bd(w)&&ut(w)?w:null,f=document.body.classList.contains("pad-nav"),v=A=>{if(p=null,u("enter"))return;const E=A(y());E&&Hs(E)};if(f&&d.includes(l))if(gu=!0,fn={menu:l,until:performance.now()+G2,own:!1},p=null,u("enter"))fn.own=!0;else{const A=oy(l,y());A&&Hs(A)}else if(f&&(fn==null?void 0:fn.menu)===l&&!fn.own&&performance.now()<fn.until){const A=oy(l,y());A&&document.activeElement!==A&&Hs(A)}else!m&&f&&y().length?Hs(B2(y())??Dp(y())):m&&f&&!m.classList.contains(Zt)&&Hs(m);if(s(pu)&&!u("A")&&(m?Nd(m):y().length||Sc(" ")),s(Xg)&&!u("X")&&m&&Nd(m,!0),s(Jg)&&u("Y"),s($2)&&!u("LT")&&dy(l,-1),s(ey)&&!u("RT")&&dy(l,1),(s(Qg)&&hy(l,-1)||s(Zg)&&hy(l,1))&&v(A=>A[0]),s($c)&&l===Po?Po=null:(s($c)&&!u("B")||s(mu))&&Sc("Escape"),i&&((L=z2(m??l,l))==null||L.scrollBy(0,i*18)),f){const A=document.activeElement instanceof HTMLElement&&l.contains(document.activeElement)?document.activeElement:null;Mi(H2(l,((j=Pl.get(l.id))==null?void 0:j(A))??D2(A&&bd(A)?A:null)))}else Mi(null);const x=e[ay]||n.x<-Mc?-1:e[ny]||n.x>Mc?1:0,k=e[ty]||n.y<-Mc?-1:e[sy]||n.y>Mc?1:0,M=x||k?`${x},${k}`:"",$=performance.now();if(!M)Ec="",gu=!1;else if(!gu){if(M!==Ec||$>=fy){fn=null,fy=$+(M!==Ec?x2:M2),Ec=M;const A=document.activeElement,E=A&&l.contains(A)&&bd(A)?A:null;u("move",k?0:x,k)||(E?F2(E,k?0:x)||N2(y(),E,k?0:x,k):y().length&&Hs(Dp(y())))}}}let yy=!1;const V2={towerkeeper:{nav:"#tk-nav",detail:"#tk-detail"},wiki:{nav:"#wk-nav",detail:"#wk-detail"}};function K2(a,e,t){const s=()=>[...document.querySelectorAll(`${e} .stg-card`)].filter(ut),n=()=>s().find(o=>o.classList.contains("sel"))??s()[0];rn(a,o=>{const i=o.focused;if(o.kind==="enter"){const r=n();return r&&Hs(r),!!r}if(i!=null&&i.closest(e)){if(o.kind==="move"&&o.dy){const r=Jm(s(),i,0,o.dy);return r?(r.click(),Hs(n()??r),!0):!1}if(o.kind==="A"||o.kind==="move"&&o.dx>0){const r=document.querySelector(t),l=r?zw(r)[0]:void 0;return l&&Hs(l),!0}return o.kind==="move"}if(i!=null&&i.closest(t)&&o.kind==="B"){const r=n();return r&&Hs(r),!!r}return!1},o=>o!=null&&o.closest(e)?[["↑/↓","Secciones"],["A","Entrar"],["B","Cerrar"]]:o!=null&&o.closest(t)?[["A","Elegir"],["B","Volver"]]:null)}function W2(){if(yy||!("getGamepads"in navigator))return;yy=!0;for(const[n,{nav:o,detail:i}]of Object.entries(V2))K2(n,o,i);const a=n=>{!n.isTrusted||!document.body.classList.contains("pad-nav")||(document.body.classList.remove("pad-nav"),Xm(),Mi(null))};let e=NaN,t=NaN;const s=n=>{if(!n.isTrusted)return;const o=n.screenX===e&&n.screenY===t;e=n.screenX,t=n.screenY,!o&&(n.movementX||n.movementY)&&a(n)};window.addEventListener("mousemove",s,{passive:!0}),window.addEventListener("pointerdown",a,{passive:!0}),window.addEventListener("keydown",a),requestAnimationFrame(Qw),setInterval(()=>{performance.now()-Jw>200&&Zw()},100)}const co=32,Y2=.12;

// --- Character Select/Create/Panel, Stages, Shop, Blacksmith & Inspect UI ---
as cartas y los Puntos Kafra de la cuenta"),run:u
    }),window.addEventListener("keydown",l),window.addEventListener("ro-lang",t);const p=$a().sort((y,w)=>y.slot-w.slot)[0];p&&(e=p.slot),t(),Ue("charselect")
  }
  const zr=[["idle","Quieto"],["walk","Andar"],["ready","Combate"],["attack","Atacar"],["cast","Lanzar"],["sit","Sentado"]];function kj(a,e) {
    const t= {
      gender:"m",hair:1,hairColor:0,cloth:0
    },s=Mt()?As:Tt;let n=s[0].id,o=0,i=0,r=null,l=0;const d=$e("cc-preview"),h=d.getContext("2d");h.imageSmoothingEnabled=!1;let u=Wn();const p=()=> {
      var C;return((C=Fr[n])==null?void 0:C.stats)??[bj[ge(n).scaling]]
    },y=()=> {
      const C=p(),_=Fr[n]?c(Fr[n].note):c("{stat}: de ella sale el daño del {job}.", {
        stat:C[0].toUpperCase(),job:Ct(ge(n),t.gender)
      }),U=Ti(1,u);$e("cc-stat-left").textContent=String(U);const D=$e("cc-stats");D.innerHTML=_t.map(( {
        id:I,name:N
      })=>`<div class="cc-stat${C.includes(I)?" main":""}" data-uid="stat-${I}"><b>${N}${C.includes(I)?"<i>★</i>":""}</b>
      <button class="ro-btn small" data-s="${I}" data-d="-1" ${u[I]>Zi?"":"disabled"}>−</button>
      <span>${u[I]}</span>
      <button class="ro-btn small" data-s="${I}" data-d="1" ${gl(1,u,I)?"":"disabled"}>+</button>
      <small class="cc-stat-cost">${u[I]<mr?`$ {
        c("coste")
      }
       $ {
        Wm(u[I])
      }
      `:c("máx.")}</small></div>`).join("")+`<div class="cc-main-note"><i>★</i> ${_}</div>`,D.querySelectorAll("button").forEach(I=> {
        I.onclick=()=> {
          const N=I.dataset.s;(I.dataset.d==="1"?gl(1,u,N):u[N]>Zi)&&(u[N]+=Number(I.dataset.d)),$e("cc-error").textContent="",m(N),y()
        }
      })
    },w=C=> {
      const _=_t.find(D=>D.id===C),U=p().includes(C)?`<div class="stat-tip-main">★ ${Fr[n]?c(Fr[n].note):c("La estadística de daño del {job}.",{job:Ct(ge(n),t.gender)})}</div>`:"";return`<div class="stat-tip"><b>${_.name}</b> ${_.desc}${U}</div>`
    },m=C=> {
      Qe&&($e("cc-stat-desc").innerHTML=w(C))
    };to($e("cc-stats"),".cc-stat",C=>w(C.dataset.uid.slice(5))),$e("cc-stats").onclick=C=> {
      const _=C.target.closest(".cc-stat");_&&m(_.dataset.uid.slice(5))
    },$e("cc-stat-desc").classList.toggle("hidden",!Qe),$e("cc-stat-desc").textContent=c("Toca una estadística para ver qué hace.");const f=()=> {
      for(u=Wn();;) {
        const C=_t.map(_=>_.id).filter(_=>gl(1,u,_));if(!C.length)break;u[C[Math.floor(Math.random()*C.length)]]++
      }
      y()
    },v=$e("cc-name");v.value="",$e("cc-error").textContent="";const x=()=> {
      const C=++l;It(n,t,vj(n)).then(_=> {
        C===l&&(r=_)
      })
    },k=()=> {
      const C=$e("cc-jobs");C.innerHTML="";for(const F of s) {
        const Y=document.createElement("button"),Q=F.rank===2?void 0:Cy(F.id),Z=Q!==void 0;Y.className=`ro-btn job-btn${F.id===n?" active":""}${Z?" locked":""}`;const ke=F.rank===2?`job_${F.id==="bard"&&t.gender==="f"?"dancer":F.id}`:ce[F.start].icon;Y.innerHTML=`<img src="${se.icons.get(ke)??se.icons.get(ce[F.start].icon)}"><span>${Ct(F,t.gender)}</span>${Z?'<i class="job-lock">🔒</i>':""}`,Y.title=Z?f0(F.name,Q):F.desc,Y.onclick=()=> {
          if(Z) {
            $e("cc-error").textContent=`🔒 ${f0(F.name,Q)}`;return
          }
          $e("cc-error").textContent="",n=F.id,_p(n,t.gender,t.cloth)||(t.cloth=0),M()
        },C.appendChild(Y)
      }
      const _=ge(n),U=ce[_.start],D=F=>`<img class="tree-icon" src="${se.icons.get(ce[F].icon)}" title="${ce[F].name}${Kn(ce[F].name)?` ($ {
        Kn(ce[F].name)
      })`:""}: ${ce[F].desc(1)}${ce[F].needsShield?` ($ {
        c("requiere escudo")
      })`:""}">`,N=(tr[_.id]??Th[_.id]??[]).filter(F=>ce[F].kind==="weapon").map(D).join(""),V=_.rank===2?`<br>🔧 ${c("Personaje de pruebas: empieza a Nv {lv} y Job Lv {jl}, con todos sus puntos por repartir y equipo legendario de unos {gs} de gearscore.",{lv:g0,jl:y0,gs:_i})}`:"";$e("cc-jobinfo").innerHTML=`<b>${Ct(_,t.gender)}</b> — ${_.desc}<br>HP <b>${_.hp}</b> · ${c("Velocidad")} <b>${_.speed}</b> · ${c("Armadura")} <b>${_.armor}</b><br>${c("Empieza con el ataque de su arma")} · ${c("Emblemática")}: ${D(U.id)} <b>${U.name}</b> (${c("en la 1.ª subida")})<div class="tree"><span>${c("Habilidades")}</span>${N}</div>${V}`
    },M=()=> {
      const C=fl(t.gender);C.includes(t.hair)||(t.hair=C[0]);const _=jp(t.gender,t.hair),U=uw(n,t.gender);_&&t.hairColor>=_.palettes&&(t.hairColor=0),U&&!_p(n,t.gender,t.cloth)&&(t.cloth=0),document.querySelectorAll("[data-gender]").forEach(D=>D.classList.toggle("active",D.dataset.gender===t.gender)),$e("cc-hair").textContent=`${C.indexOf(t.hair)+1} / ${C.length}`,k(),y(),dh($e("cc-haircolors"),[...Array((_==null?void 0:_.palettes)??1).keys()],t.hairColor,_,!1,D=> {
        t.hairColor=D,M()
      }),dh($e("cc-clothcolors"),Bd(n,t.gender),t.cloth,U,!0,D=> {
        t.cloth=D,M()
      }),$e("cc-anim").textContent=c(zr[i][1]),x()
    },$=C=> {
      const _=fl(t.gender),U=_.indexOf(t.hair);t.hair=_[(U+C+_.length)%_.length],M()
    };document.querySelectorAll("[data-gender]").forEach(C=> {
      C.onclick=()=> {
        t.gender=C.dataset.gender,M()
      }
    }),$e("cc-hair-prev").onclick=()=>$(-1),$e("cc-hair-next").onclick=()=>$(1),$e("cc-rot-l").onclick=()=>o=(o+1)%8,$e("cc-rot-r").onclick=()=>o=(o+7)%8,$e("cc-anim").onclick=()=> {
      i=(i+1)%zr.length,$e("cc-anim").textContent=c(zr[i][1])
    },$e("cc-random").onclick=()=> {
      var D;t.gender=Math.random()<.5?"m":"f";const C=fl(t.gender);t.hair=C[Math.floor(Math.random()*Math.min(C.length,30))],t.hairColor=Math.floor(Math.random()*(((D=jp(t.gender,t.hair))==null?void 0:D.palettes)??1));const _=s.filter(I=>I.rank===2||Cy(I.id)===void 0);n=_[Math.floor(Math.random()*_.length)].id,$e("cc-error").textContent="";const U=Bd(n,t.gender);t.cloth=U[Math.floor(Math.random()*U.length)],f(),v.value.trim()||(v.value=wj()),M()
    };const P=C=>(C==null?void 0:C.closest("#cc-stats .cc-stat"))??null,q=C=>C?C.querySelector('button[data-d="1"]:not(:disabled)')??C.querySelector('button[data-d="-1"]:not(:disabled)'):null;rn("charcreate",C=> {
      var I;if(C.kind==="enter") {
        const N=document.querySelector("#cc-jobs .active");return N&&He(N),!!N
      }
      const _=P(C.focused);if(!_)return!1;const U=_.dataset.uid.slice(5),D=()=>He(q(document.querySelector(`#cc-stats .cc-stat[data-uid="stat-${U}"]`)));if(C.kind==="move"&&C.dx||C.kind==="A")return(I=_.querySelector(`button[data-d="${C.kind==="A"?1:C.dx}"]:not(:disabled)`))==null||I.click(),D(),!0;if(C.kind==="move") {
        const N=[...document.querySelectorAll("#cc-stats .cc-stat")];for(let V=N.indexOf(_)+C.dy;V>=0&&V<N.length;V+=C.dy) {
          const F=q(N[V]);if(F)return He(F),!0
        }
        return!1
      }
      return!1
    },C=>P(C)?[["←/→","−1 / +1"],["A","+1"],["B","Cancelar"]]:null);const R=C=> {
      E(),de("charcreate"),window.removeEventListener("keydown",A),e(C)
    };let L=!1;const j=async()=> {
      if(L)return;const C=B1(v.value);if(C) {
        $e("cc-error").textContent=C,v.focus();return
      }
      const _= {
        id:N1(),slot:a,name:v.value.trim(),job:n,look: {
          ...t
        },createdAt:Date.now(),record:ZL(),...n5(n,!1,u)
      };if(ge(n).rank===2&&Object.assign(_, {
        dev:!0,level:g0,jobLevel:y0
      }),!_.dev) {
        L=!0;try {
          await v1(_.id,_.name)
        }
        catch(U) {
          $e("cc-error").textContent=U.message,v.focus();return
        }
        finally {
          L=!1
        }
      }
      R(_)
    },A=C=> {
      C.key==="Escape"&&R(null),C.key==="Enter"&&j(),document.activeElement!==v&&(C.key==="ArrowLeft"&&(o=(o+1)%8),C.key==="ArrowRight"&&(o=(o+7)%8))
    };$e("cc-cancel").onclick=()=>R(null),$e("cc-ok").onclick=()=>void j(),v.oninput=()=>$e("cc-error").textContent="",window.addEventListener("keydown",A);const E=Of(d,C=> {
      h.clearRect(0,0,d.width,d.height),h.fillStyle="rgba(0,0,0,0.25)",h.beginPath(),h.ellipse(d.width/2,d.height-30,34,11,0,0,Math.PI*2),h.fill(),r&&oi(h,r,zr[i][0]==="attack"?qS(r):zr[i][0],o,Math.floor(C/120),d.width/2,d.height-30,2)
    });M(),y(),Ue("charcreate"),Qe||setTimeout(()=>v.focus(),50)
  }
  const zh="Maestro de oficios";function xj(a,e) {
    const t=ze(a);if(!t)return;const s=c(zh),n=ge(t.job),o=[ {
      label:c("Cerrar")
    }
    ];if((n.rank??1)<2)return Ae(s,c("Cuando subas a 2nd job elegirás una de sus tres ramas como especialización. Si luego quieres otra, ven a verme."),o);const i=Ct(n,t.look.gender);if(t.spec===void 0)return Ae(s,c("Aún no tienes especialización: la elige el primer punto que pongas en uno de los árboles de {job}.", {
      job:i
    }),o);const r=Mt()?0:j1,l=Ho(),d=c("Ahora eres {job} de <b>{branch}</b>. Por {price} Puntos Kafra te devuelvo los puntos de tus árboles de {job} y eliges otra rama con el primer punto que pongas. Tienes {kafra}.", {
      job:i,branch:Bo[t.job][t.spec].name,price:r,kafra:l
    });if(l<r)return Ae(s,`${d}<br><span class="error">${c("No tienes Puntos Kafra suficientes.")}</span>`,o);Ae(s,d,[...o, {
      label:c("Cambiar"),primary:!0,run:()=> {
        r&&If(-r);const h=ze(a);h&&l5(h)
      }
    }
    ])
  }
  const Mj= {
    formless:"Amorfo",undead:"No muerto",brute:"Bestia",plant:"Planta",insect:"Insecto",fish:"Pez",demon:"Demonio",demihuman:"Semihumano",angel:"Ángel",dragon:"Dragón"
  },$j= {
    neutral:"Neutro",water:"Agua",earth:"Tierra",fire:"Fuego",wind:"Viento",poison:"Veneno",holy:"Sagrado",shadow:"Sombra",ghost:"Fantasma",undead:"No muerto"
  },Sj= {
    small:"Pequeño",medium:"Mediano",large:"Grande"
  },X=(a,e,t,s)=>( {
    race:a,element:e,elementLv:t,size:s
  }),Ej= {
    poring:X("plant","water",1,"medium"),lunatic:X("brute","neutral",3,"small"),fabre:X("insect","earth",1,"small"),pupa:X("insect","earth",1,"small"),drops:X("plant","fire",1,"medium"),picky:X("brute","fire",1,"small"),peco_egg:X("formless","neutral",3,"small"),condor:X("brute","wind",1,"medium"),savage_babe:X("brute","earth",1,"small"),hornet:X("insect","wind",1,"small"),thief_bug_egg:X("insect","shadow",1,"small"),baby_desert_wolf:X("brute","fire",1,"small"),rocker:X("insect","earth",1,"medium"),familiar:X("brute","shadow",1,"small"),thief_bug:X("insect","neutral",3,"small"),thief_bug_female:X("insect","shadow",1,"medium"),roda_frog:X("fish","water",1,"medium"),creamy:X("insect","wind",1,"small"),mandragora:X("plant","earth",3,"medium"),toad:X("fish","water",1,"medium"),dragon_fly:X("insect","wind",1,"small"),tarou:X("brute","shadow",1,"small"),tarou_bite:X("brute","shadow",1,"small"),tarou_plague:X("brute","shadow",1,"small"),tarou_burrow:X("brute","shadow",1,"small"),drainliar:X("brute","shadow",2,"small"),cramp:X("brute","poison",2,"small"),plankton:X("plant","water",3,"small"),eclipse:X("brute","neutral",3,"medium"),vocal:X("insect","earth",1,"medium"),mastering:X("plant","water",1,"medium"),golden_thief_bug:X("insect","fire",2,"large"),chonchon:X("insect","wind",1,"small"),goblin:X("demihuman","wind",1,"medium"),kobold:X("demihuman","wind",2,"medium"),orc_skeleton:X("undead","undead",1,"medium"),ghostring:X("demon","ghost",4,"medium"),orc_hero:X("demihuman","earth",2,"large"),osiris:X("undead","undead",4,"medium"),baphomet:X("demon","shadow",3,"large"),kukre:X("fish","water",1,"small"),marina:X("plant","water",2,"small"),hydra:X("plant","water",2,"small"),whisper:X("demon","ghost",3,"small"),penomena:X("fish","poison",1,"medium"),sword_fish:X("fish","water",2,"large"),pirate_skel:X("undead","undead",1,"medium"),drake:X("undead","undead",1,"medium"),vadon:X("fish","water",1,"small"),cornutus:X("fish","water",1,"small"),marse:X("fish","water",2,"small"),phen:X("fish","water",2,"medium"),obeaune:X("fish","water",2,"medium"),marine_sphere:X("plant","water",2,"small"),merman:X("demihuman","water",3,"medium"),kraken_leg:X("fish","water",2,"large"),deviace:X("fish","water",4,"medium"),strouf:X("fish","water",3,"large"),king_dramoh:X("fish","water",3,"large"),kraken:X("fish","water",4,"large"),spore:X("plant","water",1,"medium"),willow:X("plant","earth",1,"medium"),poporing:X("plant","poison",1,"medium"),snake:X("brute","earth",1,"medium"),worm_tail:X("plant","earth",1,"medium"),poison_spore:X("plant","poison",1,"medium"),smokie:X("brute","earth",1,"small"),wolf:X("brute","earth",1,"medium"),elder_willow:X("plant","fire",2,"medium"),dragon_tail:X("insect","wind",2,"medium"),bigfoot:X("brute","earth",1,"large"),greatest_general:X("formless","fire",2,"medium"),dokebi:X("demon","shadow",1,"small"),nine_tail:X("brute","fire",3,"medium"),angeling:X("angel","holy",4,"medium"),deviling:X("demon","shadow",4,"medium"),vagabond_wolf:X("brute","earth",1,"medium"),eddga:X("brute","fire",1,"large"),zombie:X("undead","undead",1,"medium"),skeleton:X("undead","undead",1,"medium"),skel_archer:X("undead","undead",1,"medium"),skel_soldier:X("undead","undead",1,"medium"),munak:X("undead","undead",1,"medium"),bon_gun:X("undead","undead",1,"medium"),sohee:X("demon","water",1,"medium"),horong:X("formless","fire",4,"small"),skeleton_general:X("undead","undead",1,"medium"),cat_o_nine_tail:X("demon","fire",3,"small"),hyegun:X("undead","undead",2,"medium"),moonlight:X("demon","fire",3,"medium"),orc_warrior:X("demihuman","earth",1,"medium"),orc_lady:X("demihuman","earth",2,"medium"),high_orc:X("demihuman","fire",2,"large")
  },wt=a=>document.getElementById(a),Ya=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),Tj=a=>`${Math.floor(a/60)}:${String(a%60).padStart(2,"0")}`,Ur=new Map;function Ge(a,e=1){const t=`${a}@${e}`;let s=Ur.get(t);if(s!==void 0)return s;s="";const n=se.sheetInfo(a);if(!n)return Ur.set(t,s),s;const o=n.action("idle").dirs[0][0];if(n.loaded&&!nw(o.source))s=v0(o.source.resource,o.frame,e);else if(n.url){const i=`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><desc>${t}</desc></svg>`)}`,r=new Image;r.onload=()=>{const l=v0(r,o.frame,e);Ur.set(t,l);for(const d of Array.from(document.images))d.getAttribute("src")===i&&(d.src=l)},r.onerror=()=>Ur.delete(t),r.src=n.url,s=i}return Ur.set(t,s),s}function v0(a,e,t){try{const{x:s,y:n,width:o,height:i}=e,r=document.createElement("canvas");r.width=Math.round(o*t),r.height=Math.round(i*t);const l=r.getContext("2d");return l.imageSmoothingEnabled=!1,l.drawImage(a,s,n,o,i,0,0,r.width,r.height),r.toDataURL()}catch{return""}}const rl=a=>{var e;return((e=Be[a])==null?void 0:e.name)??a};function b0(a){if(!a.secret)return{badge:"",pill:""};if(!I1(a.secret.job)){const n=c("Esconde un desbloqueo secreto");return{badge:`<span class="stg-secret" title="${n}">?</span>`,pill:`<span class="stg-banner-secret" title="${n}">? ${c("Secreto")}</span>`}}const e=ge(a.secret.job),t=`<img src="${se.icons.get(ce[e.start].icon)}" alt="">`,s=c("Secreto descubierto: {job} desbloqueado",{job:e.name});return{badge:`<span class="stg-secret found" title="${s}">${t}</span>`,pill:`<span class="stg-banner-secret found" title="${s}">${t}${c("{job} desbloqueado",{job:e.name})}</span>`}}function Cj(a){const e=[a.mvp.id,...a.minis.map(n=>n.id)],t=[...new Set(e.flatMap(n=>(Qi[n]??[]).slice().sort((o,i)=>i.rate-o.rate).map(o=>o.id)))],s=e.map(n=>Km[n]).filter(n=>!!n);return{gear:t,cards:s}}function Lj(a){const e=Be[a],t=(e==null?void 0:e.boss)==="mvp"?"MVP":(e==null?void 0:e.boss)==="mini"?"Mini":c("Monstruo"),s=Ge(a),n=(Qi[a]??[]).slice().sort((d,h)=>h.rate-d.rate),o=Km[a],i=[...n.map(d=>`<li><img src="${Me(d.id)}" alt=""><span>${Ya(zo(d.id,""))}</span></li>`),...o?[`<li class="card"><img src="${Fs(o)}" alt=""><span>${Ya(qt(o))}</span></li>`]:[]],r=Ej[a],l=[...r?[`${c("Raza")}: ${c(Mj[r.race])}`,`${c("Elemento")}: ${c($j[r.element])} ${r.elementLv}`,`${c("Tamaño")}: ${c(Sj[r.size])}`]:[],...e?[`HP ${e.hp.toLocaleString(c("es-ES"))}`]:[],...e!=null&&e.ranged?[c("A distancia")]:[],...e&&!e.speed?[c("No se mueve")]:[]];return`<div class="st-head">${s?`<img src="${s}" alt="">`:""}<div><b>${Ya(rl(a))}</b><small>${e?`${c("Nv {n}",{n:e.level})} · `:""}${t}</small></div></div>
    ${l.length?`<div class="st-tags">${l.map(d=>`<span>${d}</span>`).join("")}</div>`:""}
    <div class="st-sub st-drops-sub">${c("Puede soltar")}</div>
    ${i.length?`<ul class="st-drops">${i.join("")}</ul>`:`<div class="st-note st-drops-none">${c("Nada de equipo ni carta.")}</div>`}`}const ix=a=>Lt(`ro-life.stages-seen.v1.${a}`);function Aj(a){try{return new Set(JSON.parse(as.getItem(ix(a.id))??"[]"))}catch{return new Set}}function hh(a,e=vr(a)){return Se.flatMap((t,s)=>t.map&&Ud(a,s,e).unlocked?[s]:[])}function rx(a,e){const t=Aj(a);return new Set(hh(a,e).filter(s=>s>0&&!t.has(Se[s].id)))}const Pj=a=>rx(a).size>0;function jj(a,e,t){const s=vr(a),n=rx(a,s);try{as.setItem(ix(a.id),JSON.stringify(hh(a,s).map(f=>Se[f].id)))}catch{}let o=Math.max(0,...hh(a,s));const i=f=>{const v=Se[f],x=Ud(a,f,s);return v.map?x.unlocked?x.cleared?{cls:"cleared",text:`✓ ${c("Superado")}`}:{cls:"open",text:c("Disponible")}:{cls:"locked",text:c("Bloqueado")}:{cls:"soon",text:c("Próximamente")}},r=()=>{wt("stg-list").innerHTML=Se.map((f,v)=>{const x=i(v),k=Ge(f.mvp.id);return`<button class="stg-card ${x.cls}${v===o?" sel":""}" data-i="${v}">
        <span class="stg-face">${k?`<img src="${k}" alt="">`:"?"}</span>
        <span class="stg-card-info"><b>${f.name}</b><small>MVP ${Ya(rl(f.mvp.id))}</small></span>
        <span class="stg-lv">${c("Nv {n}",{n:f.levels})}</span>
        <span class="stg-state">${x.text}</span>
        ${b0(f).badge}
        ${n.has(v)?`<span class="stg-new">${c("¡Nuevo!")}</span>`:""}
      </button>`}).join(""),wt("stg-list").querySelectorAll(".stg-card").forEach(f=>{f.onclick=()=>{o=Number(f.dataset.i),h()}})},l=(f,v,x)=>{const k=Ge(f);return`<div class="stg-boss${x?" mvp":""}" data-mob="${f}">
      <span class="stg-boss-face">${k?`<img src="${k}" alt="">`:"?"}</span>
      <b>${Ya(rl(f))}</b><small>${x?"MVP":"Mini"}${v!==void 0?` · ${c("min")} ${Tj(v)}`:""}</small>
    </div>`},d=()=>{const f=Se[o],v=Ud(a,o,s),x=i(o),k=new URL(`assets/stages/${f.id}.jpg`,document.baseURI).href,M=Cj(f),$=(E,C)=>`<span class="stg-req ${E?"ok":"no"}">${E?"✓":"✗"} ${C}</span>`,P=[v.needMvp?$(v.mvpOk,c("Vence a {mvp}",{mvp:Ya(rl(v.needMvp.mvp.id))})):"",f.gsMin?$(v.gsOk,c("Gearscore {min} (tienes {gs})",{min:f.gsMin,gs:s})):"",f.jobLvMin?$(v.jobOk,c("Job Lv {n} (tienes {lv})",{n:f.jobLvMin,lv:a.jobLevel})):"",f.story?$(v.storyOk,c("Supera la historia")):""].filter(Boolean),q=M.gear.length||M.cards.length?M.gear.map(E=>`<span class="stg-loot" title="${Ya(zo(E,""))}"><img src="${Me(E)}" alt=""></span>`).join("")+M.cards.map(E=>`<span class="stg-loot card" title="${Ya(qt(E))}"><img src="${Fs(E)}" alt=""></span>`).join(""):`<span class="stg-empty">${c("Aún por descubrir")}</span>`;wt("stg-detail").innerHTML=`
      <div class="stg-banner${f.map?"":" nomap"}" style="--art:url('$ {
    k
  }
  ')">
        <span class="stg-banner-lv">${c("Nv {n}",{n:f.levels})}</span>
        <span class="stg-banner-state ${x.cls}">${x.text}</span>
        ${n.has(o)?`<span class="stg-banner-new">${c("¡Nuevo stage!")}</span>`:""}
        ${b0(f).pill}
        <span class="stg-banner-mvp">${Ge(f.mvp.id,2)?`<img src="${Ge(f.mvp.id,2)}" alt="">`:""}</span>
        <div class="stg-banner-text"><b>${f.name}</b><small>${f.place} · MVP ${Ya(rl(f.mvp.id))}</small></div>
      </div>
      <div class="stg-sec"><div class="box-title">${c("Jefes")}</div><div class="stg-bosses">${f.minis.map(E=>l(E.id,E.t,!1)).join("")}${l(f.mvp.id,f.mvp.t,!0)}</div></div>
      <div class="stg-sec"><div class="box-title">${c("Monstruos")}</div><div class="stg-mobs">${f.monsters.map(E=>{const C=Ge(E);return`<span class="stg-mob" data-mob="${E}">${C?`<img src="${C}" alt="">`:"?"}</span>`}).join("")}</div></div>
      <div class="stg-sec"><div class="box-title">${c("Botín de los jefes")}</div><div class="stg-loots">${q}</div></div>
      ${P.length?`<div class="stg-sec"><div class="box-title">${c("Requisitos")}</div><div class="stg-reqs">${P.join("")}</div></div>`:""}`;const R=wt("stg-go");R.classList.toggle("hidden",!!f.storyOnly),R.disabled=!f.map||!v.unlocked||!v.storyOk,R.textContent=f.map?c("Partir"):c("Próximamente"),R.title=f.story&&!v.storyOk?c("Supera antes la historia"):"";const L=wt("stg-story");L.classList.toggle("hidden",!f.story&&!f.storyOnly),L.disabled=!f.map||!v.unlocked||!!f.story&&v.storyOk||v.closed,L.title=f.story&&v.storyOk||v.closed?c("Historia superada"):"",L.textContent=c("Historia"),L.classList.toggle("primary",!!f.story&&!v.storyOk||!!f.storyOnly&&!v.closed),R.classList.toggle("primary",!f.story||v.storyOk);const j=f.storyOnly?f.id:f.story,A=wt("stg-skip");A.classList.toggle("hidden",!j||L.disabled||!(t!=null&&t.canSkip(j))),A.textContent=c("Saltar historia"),A.title=c("Ya la ha superado otro personaje de tu cuenta: te llevas su recompensa sin jugarla (sin EXP)")},h=()=>{de("skill-tip"),r(),d()},u=wt("skill-tip");let p=0;const y=wt("stg-detail");y.onmouseover=f=>{const v=f.target.closest("[data-mob]");if(!v)return u.classList.add("hidden");u.innerHTML=Lj(v.dataset.mob),u.classList.add("st-short"),u.classList.remove("hidden");const x=Jn(),k=v.getBoundingClientRect(),{width:M,height:$}=u.getBoundingClientRect();u.style.left=`${Math.max(8,Math.min(window.innerWidth-M-8,k.left+k.width/2-M/2))/x}px`,u.style.top=`${(k.top-$-10>=8?k.top-$-10:k.bottom+10)/x}px`},y.onmouseleave=()=>u.classList.add("hidden"),y.onclick=f=>{Qe&&(y.onmouseover(f),clearTimeout(p),p=window.setTimeout(()=>u.classList.add("hidden"),3e3))},wt("stg-gs").innerHTML=`${c("Tu gearscore")}: <b>${s}</b>`,wt("stg-close").onclick=()=>de("stages"),wt("stg-go").onclick=()=>{wt("stg-go").disabled||(de("stages"),e(Se[o].id))},wt("stg-skip").onclick=()=>{const f=Se[o].storyOnly?Se[o].id:Se[o].story;wt("stg-skip").classList.contains("hidden")||!f||!t||(de("stages"),t.onSkip(f))},wt("stg-story").onclick=()=>{const f=Se[o].storyOnly?Se[o].id:Se[o].story;wt("stg-story").disabled||!f||(de("stages"),e(f))};const w=()=>document.querySelector("#stg-list .stg-card.sel"),m=()=>[wt("stg-skip"),wt("stg-story"),wt("stg-go")].filter(f=>!f.classList.contains("hidden")&&!f.disabled);rn("stages",f=>{const v=f.focused;if(v!=null&&v.classList.contains("stg-card")){if(f.kind==="move"){const x=pa([...document.querySelectorAll("#stg-list .stg-card")],v,f.dx,f.dy);return x&&(x.click(),He(w())),!0}if(f.kind==="A"){const x=m(),k=x.find(M=>M.classList.contains("primary"))??x[0];return k&&He(k),!0}return!1}return v&&m().includes(v)?f.kind==="move"?(f.dx&&He(pa(m(),v,f.dx,0)??v),!0):f.kind==="B"?(He(w()),!0):!1:f.kind==="move"||f.kind==="enter"?(He(w()),!0):!1},f=>f&&m().includes(f)?[["A",f.textContent??""],...m().length>1?[["←/→","Historia / Partir"]]:[],["B","Volver"]]:[["A","Elegir"],["B","Cerrar"]]),h(),Ue("stages")}const ue=a=>document.getElementById(a),Oe=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),kt=a=>`${Math.round(a*100)}%`,Qu=[{id:"all",name:"Todo",slots:null},{id:"weapon",name:"Armas",slots:["weapon"]},{id:"head",name:"Cabeza",slots:["head_top","head_mid","head_low"]},{id:"armor",name:"Armadura",slots:["armor"]},{id:"shield",name:"Escudo",slots:["shield"]},{id:"garment",name:"Capa",slots:["garment"]},{id:"shoes",name:"Calzado",slots:["shoes"]},{id:"acc",name:"Accesorios",slots:["acc"]}],w0="mats",_j=[at.phracon,at.emveretarcon,at.oridecon,at.elunium,at.enrichedOridecon,at.enrichedElunium],Zu=[{id:"all",name:"Todo",slot:null},{id:"weapon",name:"Arma",slot:"weapon"},{id:"headgear",name:"Casco",slot:"headgear"},{id:"armor",name:"Armadura",slot:"armor"},{id:"shield",name:"Escudo",slot:"shield"},{id:"garment",name:"Capa",slot:"garment"},{id:"shoes",name:"Calzado",slot:"shoes"},{id:"accessory",name:"Accesorio",slot:"accessory"}];let ep="all",k0="all",tp=!1,Nt="weapon";const qj=[["HP",a=>a.maxHp,"int"],["ATK cuerpo a cuerpo",a=>a.atk,"int"],["ATK a distancia",a=>a.atkRanged,"int"],["MATK",a=>a.matk,"int"],["Daño",a=>a.damageMult-1,"pct"],["Celeridad",a=>a.haste*100,"dec"],["Velocidad",a=>a.speedMult-1,"pct"],["DEF",a=>a.def,"dec"],["Armadura",a=>a.armor,"dec"],["Daño recibido",a=>a.damageReduction,"red"],["Crítico",a=>a.critChance,"pct"],["Perforación",a=>a.pierceChance,"pct"],["Daño crítico",a=>a.critMult,"pct"],["Flee",a=>a.flee,"pct"],["Doble casteo",a=>a.doubleChance,"pct"],["Área",a=>a.areaMult-1,"pct"],["Alcance cuerpo a cuerpo",a=>a.reachMult-1,"pct"],["Rapidez de casteo",a=>a.castHaste*100,"dec"],["Regeneración",a=>a.regen,"dec"],["Robo de vida",a=>a.lifesteal,"pct"],["EXP",a=>a.expMult-1,"pct"],["Zeny",a=>a.zenyMult-1,"pct"],["STR",a=>a.str,"int"],["AGI",a=>a.agi,"int"],["VIT",a=>a.vit,"int"],["INT",a=>a.int,"int"],["DEX",a=>a.dex,"int"],["LUK",a=>a.luk,"int"]];function x0(a,e){if(e==="int")return String(Math.round(a));if(e==="dec")return Ee(a,1);const t=`${Ee(a*100,1)}%`;return e==="red"?`-${t}`:t}function Ij(a,e){const s=Math.max(..._t.map(({id:u})=>e[u])),n=Math.min(mr,Math.max(20,Math.ceil(s/10)*10)),o=(u,p)=>{const y=(u*60-90)*Math.PI/180;return[Math.cos(y)*p,Math.sin(y)*p]},i=u=>_t.map((p,y)=>o(y,u(y)).map(w=>w.toFixed(1)).join(",")).join(" "),r=[1,2/3,1/3].map(u=>`<polygon class="ring$ {
    u===1?" outer":""
  }
  " points="$ {
    i(()=>78*u)
  }
  "/>`).join(""),l=_t.map((u,p)=>{const[y,w]=o(p,78);return`<line class="spoke" x1="0" y1="0" x2="$ {
    y.toFixed(1)
  }
  " y2="$ {
    w.toFixed(1)
  }
  "/>`}).join(""),d=u=>p=>78*Math.min(u[_t[p].id],n)/n,h=_t.map(({id:u,name:p},y)=>{const[w,m]=o(y,100),f=e[u]-a[u];return`<text x="$ {
    w.toFixed(1)
  }
  " y="$ {
    (m-3).toFixed(1)
  }
  "><tspan class="lbl">${p}</tspan><tspan class="num" x="$ {
    w.toFixed(1)
  }
  " dy="13">${a[u]}${f?`<tspan class="bon"> +${f}</tspan>`:""}</tspan></text>`}).join("");return`<svg viewBox="-135 -112 270 228" role="img" aria-label="$ {
    c("Estadísticas")
  }
  ">${r}${l}<polygon class="total" points="$ {
    i(d(e))
  }
  "/><polygon class="base" points="$ {
    i(d(a))
  }
  "/>${h}<text class="scale" x="133" y="112">${c("escala")} 0–${n}</text></svg>`}let Gr=null;function Rj(a,e){ue("cp-back").textContent=e.backLabel??c("Cambiar personaje");let t=ze(a),s=()=>{};const n=()=>{ja(t),t=ze(a)};let o="";const i=()=>El(t.job).includes(o)?o:t.job,r=()=>{ue("cp-title").textContent=`${t.name} · ${zl(t)}`,ue("cp-level").textContent=`Base Lv ${t.level}`;const S=t.level>=Jl,T=Go(t.level);ue("cp-exp-fill").style.width=S?"100%":`${t.exp/T*100}%`,ue("cp-exp-text").textContent=S?c("Nivel máximo"):`${t.exp} / ${T} EXP`,ue("cp-job-level").textContent=`Job Lv ${Nh(t)}`;const O=!!t.promotion,H=!O&&t.jobLevel>=Zn(t.job),G=Ql(t.jobLevel);ue("cp-job-exp-fill").style.width=O?"0%":H?"100%":`${t.jobExp/G*100}%`,ue("cp-job-exp-text").textContent=O?"0 EXP":H?c("Nivel máximo"):`${t.jobExp} / ${G} EXP`;const oe=BS(t.job,t.jobLevel,t.talents,i());ue("cp-points").textContent=c(oe===1?" {
    n
  }
   punto de talento":" {
    n
  }
   puntos de talento",{n:oe}),ue("cp-points").classList.toggle("none",oe===0);const ae=Ti(t.level,t.stats);ue("cp-stat-points").textContent=c(ae===1?" {
    n
  }
   punto de estado":" {
    n
  }
   puntos de estado",{n:ae}),ue("cp-stat-points").classList.toggle("none",ae===0)},l=S=>ss(S),d=S=>S.quality?Ps(S.quality):"inherit",h=S=>bs.find(T=>T.id===S),u=S=>S?t.inventory.find(T=>T.uid===S):void 0,p=S=>nr(S,t.job),y=S=>[...Oo(S),...S.cards.flatMap(T=>{var O;return T?((O=ms[T])==null?void 0:O.bonuses)??[]:[]})],w=S=>S.length?`<ul class="bon-list">${On(S).map(T=>`<li>${T}</li>`).join("")}</ul>`:"",m=(S,T=0)=>`<span class="gs">GS <b>${S}</b>${T?`<i class="$ {
    T>0?"up":"down"
  }
  ">${T>0?"▲":"▼"}${Math.abs(T)}</i>`:""}</span>`,f=S=>{const T=wa(S),O=[T.atk?`+${T.atk} ATK`:"",T.matk?`+${T.matk} MATK`:"",T.def?`DEF ${Ee(T.def,1)}`:""].filter(Boolean);return O.length?`<div class="base-stats">${O.join(" · ")}</div>`:""},v=S=>{var T;return(S.quality?`${Re[S.quality].name} · `:"")+((T=fe[S.itemId])!=null&&T.starter?"":`Tier ${mn(S)} · `)},x=S=>{const O=fe[S.itemId]?wa(S):{atk:0,matk:0,def:0};return[...[O.atk?`+${O.atk} ATK`:"",O.matk?`+${O.matk} MATK`:"",O.def?`DEF ${Ee(O.def,1)}`:""].filter(Boolean),...On(y(S))].slice(0,3).join(" · ")},k=(S,T="")=>S.cards.length?`<div class="card-slots$ {
    T?" click":""
  }
  "${T?` id="$ {
    T
  }
  " title="$ {
    c("Añadir cartas")
  }
  "`:""}>${S.cards.map(O=>O?`<div class="card-slot filled" title="$ {
    Oe(qt(O))
  }
  "><img src="$ {
    Fs(O)
  }
  "></div>`:`<div class="card-slot" title="$ {
    c("Hueco libre")
  }
  ">◇</div>`).join("")}</div>`:"",M=S=>t.inventory.some(T=>{var O;return T.isNew&&((O=fe[T.itemId])==null?void 0:O.slot)===S&&Tn(t,T)&&En(t,fe[T.itemId])&&!qo(t,T.uid)}),$=S=>{const T=u(S);return T!=null&&T.isNew?(delete T.isNew,n(),!0):!1},P=`<span class="new-tag">${c("Nuevo")}</span>`,q=S=>{const T=u(t.equipped[S.id]),O=T?T.cards.filter(Boolean).length:0;return`<div class="equip-slot$ {
    Nt===S.id?" sel":""
  }
  $ {
    T!=null&&T.quality?` q${T.quality}`:""
  }
  " data-slot="$ {
    S.id
  }
  ">
      <div class="ico">${T?`<img src="$ {
    Me(T.itemId)
  }
  ">`:""}</div>
      <div><span class="lbl">${S.name}${M(S.gear)?P:""}</span><span class="nm">${T?Oe(l(T)):"—"}</span></div>
      ${T?`<span class="slot-side">${T.cards.length?`<span class="cards">${"◆".repeat(O)}${"◇".repeat(T.cards.length-O)}</span>`:""}<span class="slot-gs">${p(T)}</span></span>`:""}
    </div>`},R=Ek,L=()=>R(t),j=S=>{const T=R(t),O={...t,equipped:{...t.equipped}};Ty(O,S,Nt);const H=R(O),G=qj.map(([oe,ae,Ce])=>({k:oe,kind:Ce,a:ae(T),b:ae(H)})).filter(oe=>Math.abs(oe.b-oe.a)>1e-6);return G.length?`<div class="cmp-rows">${G.map(oe=>{const ae=oe.b>oe.a;return`<span>${c(oe.k)}</span><b>${x0(oe.a,oe.kind)}</b><i class="$ {
    ae?"up":"down"
  }
  ">${ae?"▲":"▼"} ${x0(oe.b,oe.kind)}</i>`}).join("")}</div>`:`<div class="muted">${c("No cambia ninguna estadística.")}</div>`};let A=null,E=null;const C=()=>{const S=nl(t);return t.inventory.filter(T=>{const O=fe[T.itemId];return O&&Ck(t.job,O,Nt)&&Tn(t,T)&&En(t,O)&&!qo(t,T.uid)}).map(T=>({g:T,s:p(T),by:S.get(T.uid)})).sort((T,O)=>O.s-T.s)},_=()=>{const S=h(Nt),T=u(t.equipped[Nt]),O=T?p(T):0,H=C(),G=A?H.find(ie=>ie.g.uid===A):void 0;let oe=`<div class="box-title">${S.name} · ${c("Equipado")}</div>`;if(!T)oe+=`<div class="empty-note">${c("Nada equipado en esta ranura.")}</div>`;else{const ie=fe[T.itemId];oe+=`<div class="eq-item"><img class="big" src="$ {
    Me(T.itemId)
  }
  "><div class="eq-info">
        <div class="eq-name"><b style="color:$ {
    d(T)
  }
  ">${Oe(l(T))}</b>${m(O)}</div>
        <span class="muted">${v(T)}${S.name}${ie.starter?` · ${c("equipo inicial")}`:""}</span>${wm(T)}
        ${f(T)}${w(y(T))}${k(T,"cp-cur-sockets")}
        <div class="btn-row">${T.cards.length?`<button class="ro-btn small" id="cp-add-cards">${c("Añadir cartas")}</button>`:""}<button class="ro-btn small" id="cp-unequip">${c("Quitar")}</button></div>
      </div></div>`}const ae=Qp(t);ae&&Nt==="weapon"&&(oe+=`<div class="error">${c("¡Sin  {
    what
  }
   no puedes atacar!",{what:c(ae)})}</div>`),ue("cp-eq-current").innerHTML=oe,ue("cp-eq-cmp").innerHTML=`<div class="box-title">${c("Comparación")}</div>${G?`<div class="cmp-head">${c("Si cambias por")} <b style="color:$ {
    d(G.g)
  }
  ">${Oe(l(G.g))}</b>${m(G.s,G.s-O)}</div>${j(G.g.uid)}`:`<div class="cmp-hint">${c(H.length?"Pasa el ratón por un objeto de la lista (o tócalo) para ver qué ganas y qué pierdes.":"No tienes nada con lo que comparar.")}</div>`}`;const Ce=document.getElementById("cp-add-cards");Ce&&T&&(Ce.onclick=()=>F(T.uid));const ne=document.getElementById("cp-cur-sockets");ne&&T&&(ne.onclick=()=>F(T.uid));const te=document.getElementById("cp-unequip");te&&(te.onclick=()=>{LT(t,Nt),B.ui("player_clothes",.4),n(),na()})},U=()=>{const S=u(t.equipped[Nt]),T=S?p(S):0,O=C();ue("cp-eq-list-title").textContent=`${c("Para esta ranura")} (${O.length})`;const H=ue("cp-eq-list");H.innerHTML=O.length?O.map(({g:G,s:oe,by:ae})=>`<div class="cand$ {
    G.quality?` q${G.quality}`:""
  }
  $ {
    G.uid===E?" sel":""
  }
  $ {
    ae?" worn":""
  }
  " data-uid="$ {
    G.uid
  }
  ">
        <div class="ico"><img src="$ {
    Me(G.itemId)
  }
  ">${G.isNew?P:""}</div>
        <div class="cand-info"><b style="color:$ {
    d(G)
  }
  ">${Oe(l(G))}</b><small>${ae?c("lo lleva  {
    who
  }
  ",{who:Oe(ae)}):Oe(x(G))}</small></div>
        <div class="cand-side">${m(oe,oe-T)}${ae?"":`<button class="ro-btn small cand-eq">${c("Equipar")}</button>`}</div>
      </div>`).join(""):`<div class="empty-note">${c("No tienes nada para esta ranura.")}</div>`,H.querySelectorAll(".cand").forEach(G=>{const oe=G.dataset.uid;G.onpointerenter=Ce=>{Ce.pointerType!=="mouse"||A===oe||(A=oe,_())},G.onclick=()=>{if(A=E=oe,$(oe))return xe(),I();H.querySelectorAll(".cand.sel").forEach(Ce=>Ce.classList.remove("sel")),G.classList.add("sel"),_()},G.ondblclick=()=>{G.classList.contains("worn")||D(oe)};const ae=G.querySelector(".cand-eq");ae&&(ae.onclick=Ce=>{Ce.stopPropagation(),D(oe)})}),H.onpointerleave=()=>{A!==E&&(A=E,_())}},D=S=>{const T=u(t.equipped[Nt]),O=u(S);if(!O)return;const H=ne=>{delete O.isNew,ne&&T&&PT(t,T.uid,S),Ty(t,S,Nt),B.ui("player_clothes",.4),A=E=null,n(),na()},G=T?T.cards.filter(Boolean).length:0,oe=O.cards.filter(ne=>ne===null).length;if(!T||!G||!oe)return H(!1);const ae=Math.min(G,oe),Ce={old:`<b>${Oe(l(T))}</b>`,new:`<b>${Oe(l(O))}</b>`};Ae(c("Cambiar equipo"),`${c(G===1?" {
    old
  }
   lleva 1 carta encajada.":" {
    old
  }
   lleva  {
    n
  }
   cartas encajadas.",{...Ce,n:G})} ${c(ae===G?"¿Las pasas a  {
    new
  }
  ?":"¿Pasas  {
    n
  }
   a  {
    new
  }
  ? Las demás se quedan en la pieza que quitas.",{...Ce,n:ae})}`,[{label:c("Cancelar")},{label:c("Dejarlas"),run:()=>H(!1)},{label:c("Pasar cartas"),primary:!0,run:()=>H(!0)}])},I=()=>{const S=["head_top","head_mid","armor","garment","acc1"],T=["head_low","weapon","shield","shoes","acc2"];ue("cp-slots-left").innerHTML=S.map(ne=>q(h(ne))).join(""),ue("cp-slots-right").innerHTML=T.map(ne=>q(h(ne))).join(""),document.querySelectorAll("#charpanel .equip-slot").forEach(ne=>{ne.onclick=()=>{Nt=ne.dataset.slot,A=E=null,I()}});const O=vr(t);ue("cp-gs").innerHTML=`<span>${c("Gearscore")}</span><b>${O}</b>`;const H=t.inventory.some(ne=>ne.isNew&&Tn(t,ne));document.querySelectorAll('#charpanel .tab-btn[data-tab="equip"], #charpanel .tab-btn[data-tab="inv"]').forEach(ne=>ne.classList.toggle("has-new",H)),cg(),_(),U();const G=L(),oe=[["HP",`${Math.round(G.maxHp)}`],["Daño",`+${kt(G.damageMult-1)}`],["Celeridad",`${Math.round(G.haste*100)} (-${kt(1-No(G.haste))} ${c("de enfriamiento")})`],["Velocidad",`+${kt(G.speedMult-1)}`],["DEF",`${Ee(G.def,1)} (-${kt(Uo(G.def))} ${c("de daño")})`],["Armadura",`${Math.round(G.armor*10)/10}`],["Daño recibido",`-${kt(Math.min(.6,G.damageReduction))}`],["Crítico",kt(G.critChance)],...G.pierceChance>0?[["Perforación",kt(G.pierceChance)]]:[],["Flee",kt(Math.min(.5,G.flee))],["Área",`+${kt(G.areaMult-1)}`],["EXP",`+${kt(G.expMult-1)}`],["Zeny",`+${kt(G.zenyMult-1)}`]],ae=[["Daño crítico",G.critMult-1.6,`×${Ee(G.critMult,2)}`],["Doble casteo",G.doubleChance,kt(G.doubleChance)],["Daño a jefes y élites",G.bossEliteMult-1,`+${kt(G.bossEliteMult-1)}`],["Daño a jefes y no-muertos",G.bossUndeadMult-1,`+${kt(G.bossUndeadMult-1)}`],["Alcance cuerpo a cuerpo",G.reachMult-1,`+${kt(G.reachMult-1)}`],["Daño con poca vida",G.lowHpDamage,`+${kt(G.lowHpDamage)}`],["Regeneración",G.regen,`${Ee(G.regen,2)} HP/s`],["Aturdir al golpear",G.stunChance,kt(G.stunChance)],["Robo de vida",G.lifesteal,kt(G.lifesteal)],["Rapidez de casteo",G.castHaste,`${Math.round(G.castHaste*100)} (-${kt(1-No(G.castHaste))})`]];for(const[ne,te,ie]of ae)Math.abs(te)>1e-6&&oe.push([ne,ie]);G.revives&&oe.push(["Revivir",`${G.revives}×`]);const Ce=Qp(t);ue("cp-stats").innerHTML=oe.map(([ne,te])=>`<div class="stat-chip"><span>${c(ne)}</span><b>${te}</b></div>`).join("")+(Ce?`<div class="error stat-missing">${c("¡Sin  {
    what
  }
   no puedes atacar!",{what:c(Ce)})}</div>`:"")};let N="",V=0;const F=S=>{const T=u(S);!T||!T.cards.length||(N=S,V=Math.max(0,T.cards.indexOf(null)),Y(),Ue("cp-sock"))},Y=()=>{const S=u(N),T=S&&fe[S.itemId];if(!S||!T)return de("cp-sock");const O=Xb(T.slot),H=Object.entries(t.cards).map(([ne,te])=>({id:Number(ne),n:te})).filter(({id:ne,n:te})=>{var ie;return te>0&&((ie=ms[ne])==null?void 0:ie.compound)===O}).map(ne=>({...ne,s:$i(ne.id,t.job)})).sort((ne,te)=>te.s-ne.s),G=S.cards[V],oe=S.cards.map((ne,te)=>`<button class="sock$ {
    te===V?" sel":""
  }
  $ {
    ne?" filled":""
  }
  " data-i="$ {
    te
  }
  ">${ne?`<img src="$ {
    Fs(ne)
  }
  "><span>${Oe(qt(ne))}</span><small>GS ${$i(ne,t.job)}</small>`:`<span class="sock-empty">◇</span><span>${c("Hueco  {
    n
  }
  ",{n:te+1})}</span><small>${c("vacío")}</small>`}</button>`).join("");ue("cp-sock-body").innerHTML=`<div class="eq-item"><img class="big" src="$ {
    Me(S.itemId)
  }
  "><div class="eq-info">
        <div class="eq-name"><b style="color:$ {
    d(S)
  }
  ">${Oe(l(S))}</b>${m(p(S))}</div>${w(y(S))}</div></div>
      <div class="sock-row">${oe}</div>
      <div class="sock-hint">${G?`${c("Hueco  {
    n
  }
  : elige otra carta para cambiarla o",{n:V+1})} <button class="ro-btn small" id="cp-sock-remove">${c("Quitar carta")}</button>`:c("Elige la carta para el hueco  {
    n
  }
  .",{n:V+1})}</div>
      <div class="box-title">${c("Cartas para  {
    slot
  }
  ",{slot:M0(O)})}</div>
      <div class="sock-cards">${H.length?H.map(({id:ne,n:te,s:ie})=>`<div class="sock-card" data-id="$ {
    ne
  }
  "><img src="$ {
    Fs(ne)
  }
  "><div class="cand-info"><b>${Oe(qt(ne))}</b><small>${On(ms[ne].bonuses).join(" · ")}</small></div>${m(ie)}<span class="qty-tag">×${te}</span></div>`).join(""):`<div class="empty-note">${c("No tienes cartas que encajen en este tipo de equipo.")}</div>`}</div>`;const ae=ue("cp-sock-body");ae.querySelectorAll(".sock").forEach(ne=>{ne.onclick=()=>{V=Number(ne.dataset.i),Y()}}),ae.querySelectorAll(".sock-card").forEach(ne=>{ne.onclick=()=>{var ie;if(AT(t,N,V,Number(ne.dataset.id)))return;B.ui("ef_coin",.4),n();const te=((ie=u(N))==null?void 0:ie.cards.indexOf(null))??-1;te>=0&&(V=te),Y(),na()}});const Ce=document.getElementById("cp-sock-remove");Ce&&(Ce.onclick=()=>{uf(t,N,V),n(),Y(),na()})};ue("cp-sock-done").onclick=()=>de("cp-sock");let Q=null,Z=null;const ke=()=>{const S=ue("cp-inv-detail"),T=Z===null?0:xt().materials[Z]??0;if(Z===null||!(T>0)){Z=null,S.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="empty-note">${c("Selecciona un material para ver para qué sirve.")}</div>`;return}S.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="eq-item"><img class="big" src="$ {
    Me(Z)
  }
  "><div class="eq-info">
      <div class="eq-name"><b>${Oe(Ft(Z))}</b></div>
      <span class="muted">${c("Mineral de refine")} · ${c("tienes  {
    n
  }
  ",{n:T.toLocaleString(c("es-ES"))})}</span>
      <div>${c(Wp[Z]??"")}</div>
      <div class="muted">${c("Para refinar, habla con el herrero Hollgrehenn en la plaza.")}</div>
    </div></div>`},xe=()=>{ue("cp-kafra").textContent=`${Ho().toLocaleString(c("es-ES"))} ${c("Puntos Kafra")}`;const S=ue("cp-inventory"),T=t.inventory.filter(he=>Tn(t,he)&&fe[he.itemId]),O=tp?T.filter(he=>En(t,fe[he.itemId])):T,H=(he,At)=>!he.slots||he.slots.includes(fe[At.itemId].slot),G=Qu.find(he=>he.id===ep)??Qu[0],oe=O.filter(he=>H(G,he)).sort((he,At)=>p(At)-p(he)),ae=nl(t),Ce=xt().materials,ne=_j.filter(he=>Ce[he]>0),te=ep===w0;ue("cp-inv-filters").innerHTML=Qu.map(he=>{const At=O.filter(Ms=>H(he,Ms)).length;return`<button class="inv-chip$ {
    !te&&he.id===G.id?" active":""
  }
  " data-f="$ {
    he.id
  }
  "${At||he.id==="all"?"":" disabled"}>${c(he.name)} <small>${At}</small></button>`}).join("")+`<button class="inv-chip$ {
    te?" active":""
  }
  " data-f="$ {
    w0
  }
  ">${c("Materiales")} <small>${ne.length}</small></button>`+(te?"":`<label class="inv-mine"><input type="checkbox" id="cp-only-mine"${tp?" checked":""}> ${c("Solo mi job")}</label>`),ue("cp-inv-filters").querySelectorAll(".inv-chip").forEach(he=>{he.onclick=()=>{ep=he.dataset.f,xe()}});const ie=document.getElementById("cp-only-mine");if(ie&&(ie.onchange=()=>{tp=ie.checked,xe()}),te){S.innerHTML=ne.length?ne.map(he=>`<div class="item-cell$ {
    Z===he?" sel":""
  }
  " data-ore="$ {
    he
  }
  "><img src="$ {
    Me(he)
  }
  "><span class="qty">${Ce[he]}</span></div>`).join(""):`<div class="empty-note">${c("Sin materiales. Los minerales de refine se compran a la Kafra de la plaza.")}</div>`,S.querySelectorAll("[data-ore]").forEach(he=>{he.onclick=()=>{Z=Number(he.dataset.ore),xe()}}),ke();return}T.length?oe.length?(S.innerHTML=oe.map(he=>{const At=fe[he.itemId],Ms=["item-cell"],Jh=ae.get(he.uid);return qo(t,he.uid)?Ms.push("equipped"):Jh&&Ms.push("worn"),At!=null&&At.rare&&Ms.push("rare"),he.quality&&Ms.push(`q${he.quality}`),At&&!En(t,At)&&Ms.push("locked"),Q===he.uid&&Ms.push("sel"),`<div class="$ {
    Ms.join(" ")
  }
  " data-uid="$ {
    he.uid
  }
  "><img src="$ {
    Me(he.itemId)
  }
  ">${he.isNew?P:""}${he.safe?nx:""}</div>`}).join(""),S.querySelectorAll(".item-cell").forEach(he=>{he.onclick=()=>{Q=he.dataset.uid,$(Q)&&I(),xe()}})):S.innerHTML=`<div class="empty-note">${c("Nada de este tipo.")}</div>`:S.innerHTML=`<div class="empty-note">${c("Vacío. Los minis y MVPs sueltan equipo durante la partida.")}</div>`,pe()},pe=()=>{var te;const S=ue("cp-inv-detail"),T=u(Q??void 0),O=T&&fe[T.itemId];if(!T||!O||!Tn(t,T)){Q=null,S.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="empty-note">${c("Selecciona un objeto para ver sus estadísticas.")}</div>`;return}const H=nl(t).get(T.uid),G=((te=Object.entries(t.equipped).find(([,ie])=>ie===T.uid))==null?void 0:te[0])??"",oe=bs.find(ie=>ie.gear===O.slot).name,ae=T.cards.filter(ie=>!!ie).map(ie=>Oe(qt(ie))),Ce=G?`<div class="worn-note">${c("Equipado en  {
    slot
  }
  ",{slot:h(G).name})}</div>`:H?`<div class="worn-note">${c("Lo lleva  {
    who
  }
  . Quítaselo desde su personaje para usarlo aquí.",{who:Oe(H)})}</div>`:En(t,O)?"":`<div class="error">${c("Tu job no puede usar este objeto.")}</div>`;S.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="eq-item"><img class="big" src="$ {
    Me(T.itemId)
  }
  "><div class="eq-info">
      <div class="eq-name"><b style="color:$ {
    d(T)
  }
  ">${Oe(l(T))}</b>${m(p(T))}</div>
      <span class="muted">${v(T)}${oe}${O.rare?` · ★ ${c("raro")}`:""}${O.starter?` · ${c("equipo inicial")}`:""}</span>${wm(T)}
      ${O.jobs?`<div class="muted">${O.jobs.map(ie=>ge(ie).name).join(", ")}</div>`:""}
      ${f(T)}${w(y(T))}
      ${T.cards.length?`${k(T)}<div class="muted">${ae.length?`${c("Cartas")}: ${ae.join(", ")}`:c(" {
    n
  }
   huecos para cartas libres",{n:T.cards.length})}</div>`:`<div class="muted">${c("Sin huecos para cartas.")}</div>`}
      ${Ce}
      ${T.safe?`<div class="safe-note">${c("Protegido: el vendedor no lo compra y no se puede tirar.")}</div>`:""}
      <div class="btn-row"><button class="ro-btn small" id="cp-safe">${c(T.safe?"Quitar protección":"Proteger")}</button>${H||T.safe?"":`<button class="ro-btn small" id="cp-discard">${c("Tirar")}</button>`}</div>
    </div></div>`,ue("cp-safe").onclick=()=>{T.safe?delete T.safe:T.safe=!0,n(),xe()};const ne=document.getElementById("cp-discard");ne&&(ne.onclick=()=>sa(c("Tirar objeto"),c("¿Tirar  {
    what
  }
  ? Las cartas encajadas vuelven a tu álbum.",{what:`<b>${Oe(l(T))}</b>`}),c("Tirar"),()=>{Ak(t,T.uid),Q=null,n(),na()}))};let ye=null;const dt=new Set,os=(S,T)=>()=>{if(ue(`cp-tab-${S}`).classList.contains("hidden")){dt.add(S);return}dt.delete(S),T()},ws=os("cards",()=>{const S=Object.entries(t.cards).map(([te,ie])=>({id:Number(te),n:ie})).filter(({id:te,n:ie})=>ie>0&&ms[te]),T=(te,ie)=>!te.slot||ms[ie].compound===te.slot,O=Zu.find(te=>te.id===k0)??Zu[0];ue("cp-card-filters").innerHTML=Zu.map(te=>{const ie=S.filter(he=>T(te,he.id)).length;return`<button class="inv-chip$ {
    te.id===O.id?" active":""
  }
  " data-f="$ {
    te.id
  }
  "${ie||te.id==="all"?"":" disabled"}>${c(te.name)} <small>${ie}</small></button>`}).join(""),ue("cp-card-filters").querySelectorAll(".inv-chip").forEach(te=>{te.onclick=()=>{k0=te.dataset.f,ws()}});const H=S.filter(te=>T(O,te.id)).sort((te,ie)=>$i(ie.id,t.job)-$i(te.id,t.job)),G=ue("cp-cards");S.length?H.length?(G.innerHTML=H.map(({id:te,n:ie})=>`<div class="item-cell card-cell$ {
    ye===te?" sel":""
  }
  " data-card="$ {
    te
  }
  "><img src="$ {
    Fs(te)
  }
  "><span class="qty">${ie}</span></div>`).join(""),G.querySelectorAll(".item-cell").forEach(te=>{te.onclick=()=>{ye=Number(te.dataset.card),ws()}})):G.innerHTML=`<div class="empty-note">${c("Nada de este tipo.")}</div>`:G.innerHTML=`<div class="empty-note">${c("Sin cartas. Cada monstruo puede soltar la suya.")}</div>`;const oe=ue("cp-card-detail"),ae=ye!==null?ms[ye]:void 0,Ce=ye!==null?t.cards[ye]??0:0,ne=ye!==null?t.inventory.filter(te=>Tn(t,te)).reduce((te,ie)=>te+ie.cards.filter(he=>he===ye).length,0):0;if(!ae||ye===null||!Ce&&!ne){ye=null,oe.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="empty-note">${c("Selecciona una carta para ver lo que da.")}</div>`;return}oe.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="eq-item"><img class="card-art" src="$ {
    Fs(ye)
  }
  "><div class="eq-info">
      <div class="eq-name"><b>${Oe(qt(ye))}</b>${m($i(ye,t.job))}</div>
      <span class="muted">${c("Se encaja en")}: ${M0(ae.compound)}</span>
      ${w(ae.bonuses)}
      <div class="muted">${c("Tienes  {
    n
  }
   en el álbum",{n:Ce})}${ne?` · ${c(" {
    n
  }
   encajadas",{n:ne})}`:""}</div>
      <div class="muted">${c("Se encajan desde Equipo, con «Añadir cartas».")}</div>
    </div></div>`});let ks=null;const xs=S=>Se.filter(T=>{const O=et[T.id];return O&&!O.story&&(O.waves.some(H=>H.pool.includes(S))||O.bosses.some(H=>H.id===S))}).map(T=>c(T.name)),Ba=os("pets",()=>{var te;const S=ar(),T=ie=>!!S.pets[ie];ue("cp-pet-count").textContent=`${Rt.filter(ie=>T(ie.id)).length}/${Rt.length}`,ue("cp-pets").innerHTML=Rt.map(ie=>{const he=T(ie.id),At=he?Ge(Xn(Yn(ie.id,S))):"",Ms=he&&At?`<img class="pet-pic" src="$ {
    At
  }
  " alt="">`:`<img src="$ {
    Me(ie.egg)
  }
  " alt="">`;return`<div class="item-cell pet-cell$ {
    he?"":" locked"
  }
  $ {
    ks===ie.id?" sel":""
  }
  $ {
    t.pet===ie.id&&he?" equipped":""
  }
  " data-pet="$ {
    ie.id
  }
  " title="$ {
    Oe(Ht(ie.id))
  }
  ">${Ms}</div>`}).join(""),ue("cp-pets").querySelectorAll(".pet-cell").forEach(ie=>{ie.onclick=()=>{ks=ie.dataset.pet,Ba()}});const O=ue("cp-pet-detail"),H=ks?Ca[ks]:void 0;if(!H){O.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="empty-note">${c("Los pets son de la cuenta: su huevo cae de su monstruo y cada personaje lleva uno, que le sigue en partida y le da su bonus.")}</div>`;return}const G=S.pets[H.id],oe=Ge(Xn(G?Yn(H.id,S):H.id),1.5),ae=es().kills,Ce=H.from?c("Evoluciona de  {
    pet
  }
  : con  {
    pet
  }
   en Leal y  {
    m
  }
   vencido  {
    n
  }
   veces.",{pet:Ht(H.from),m:Ht(H.id),n:Di}):c("Su huevo cae de  {
    m
  }
   ( {
    where
  }).",{m:Ht(H.id),where:xs(H.id).join(", ")});let ne;if(G){const ie=bk(G.intimacy),he=Wo.find(Jh=>Jh.min>G.intimacy),At=Math.round(G.intimacy/Yp*100),Ms=H.acc?G.acc?`<div class="pet-acc"><img src="$ {
    Me(H.acc)
  }
  " alt=""><span>${Oe(Ft(H.acc))} <small>(${c("bonus × {
    m
  }
  ",{m:Ee(an,1)})})</small></span></div>`:`<div class="pet-acc off"><img src="$ {
    Me(H.acc)
  }
  " alt=""><span>${Oe(Ft(H.acc))} <small>${c(G.intimacy>=Xp?"Lo vende la Cuidadora de pets de la plaza (bonus × {
    m
  }).":"En Cordial, la Cuidadora de pets de la plaza te venderá su accesorio (bonus × {
    m
  }).",{m:Ee(an,1)})}</small></span></div>`:"";ne=`<div class="muted">${c("Intimidad")}: <b>${c(ie.name)}</b>${he?` · ${c(" {
    tier
  }
   en  {
    n
  }
  ",{tier:c(he.name),n:he.min})}`:""}</div>
        <div class="chr-bar"><span style="width:$ {
    At
  }
  %"></span><em>${G.intimacy} / ${Yp}</em></div>
        ${w(kk(H.id,S))}
        ${ie.mult<1?`<div class="muted">${c("En Leal")}: ${vl(H.id,G.acc?an:1).join(" · ")}</div>`:""}
        ${Ms}
        <div class="muted">${c("Gana intimidad jugando partidas con él.")}</div>
        <div class="btn-row"><button class="ro-btn small$ {
    t.pet===H.id?"":" primary"
  }
  " data-pet-use>${t.pet===H.id?c("Dejar en casa"):c("Llevar")}</button></div>`}else{const ie=H.from?lf(H.id,ae,S):"";ne=`<div class="muted">${c("Al salir del huevo (Neutral)")}: ${vl(H.id,Wo[0].mult).join(" · ")}</div>
        <div class="muted">${c("En Leal")}: ${vl(H.id,1).join(" · ")}</div>
        ${H.from?`<div class="muted">${ie?`${ie} `:""}${c("Se evoluciona con la Cuidadora de pets de la plaza.")}</div>`:""}`}O.innerHTML=`<div class="box-title">${c("Detalle")}</div><div class="eq-item"><div class="pet-portrait$ {
    G?"":" locked"
  }
  ">${oe?`<img src="$ {
    oe
  }
  " alt="">`:""}</div><div class="eq-info">
      <div class="eq-name"><b>${Oe(Ht(H.id))}</b>${G?`<span class="gs">GS <b>${Sk(H.id,t.job)}</b></span>`:""}</div>
      <span class="muted">${Ce}</span>
      ${ne}
    </div></div>`,(te=O.querySelector("[data-pet-use]"))==null||te.addEventListener("click",()=>{t.pet=t.pet===H.id?void 0:H.id,B.ui("ef_blessing",.3),n(),Ba(),cc()})}),aa=(S,T)=>{let O=!1;for(let H=0;H<Math.abs(T);H++){if(T>0&&gl(t.level,t.stats,S))t.stats[S]++;else if(T<0&&t.stats[S]>Zi)t.stats[S]--;else break;O=!0}O&&(B.ui(T>0?"ef_blessing":"player_clothes",.25),n(),r(),cc(Math.sign(T)),I())};let Vh=new Map;const cc=(S=0)=>{const T=L(),O=Ti(t.level,t.stats);ue("cp-prim-left").textContent=String(O),ue("cp-radar").innerHTML=Ij(t.stats,T);const H=ue("cp-prim");H.innerHTML=_t.map(({id:ae,name:Ce,desc:ne})=>{const te=t.stats[ae],ie=T[ae]-te,he=te<mr?Wm(te):0;return`<div class="prim-row" title="$ {
    Oe(ne)
  }
  "><b class="prim-name">${Ce}</b><span class="prim-val">${te}${ie?`<span class="prim-bonus"> +${ie}</span>`:""}</span>
        <button class="prim-btn" data-s="$ {
    ae
  }
  " data-d="-1" ${te>Zi?"":"disabled"}>−</button>
        <button class="prim-btn" data-s="$ {
    ae
  }
  " data-d="1" ${gl(t.level,t.stats,ae)?"":"disabled"}>+</button>
        <span class="prim-cost">${he?`${c("coste")} ${he}`:c("máx.")}</span></div>`}).join(""),H.querySelectorAll(".prim-btn").forEach(ae=>{const Ce=ae.dataset.s,ne=Number(ae.dataset.d);ae.onclick=()=>aa(Ce,ne),ae.oncontextmenu=te=>{te.preventDefault(),aa(Ce,ne*10)}});const G=hx(T),oe=S>0?"up":"down";ue("cp-derived").innerHTML=G.map(([ae,Ce])=>S!==0&&Vh.has(ae)&&Vh.get(ae)!==Ce?`<span class="hit $ {
    oe
  }
  ">${c(ae)}</span><b class="hit $ {
    oe
  }
  ">${S>0?"▲":"▼"} ${Ce}</b>`:`<span>${c(ae)}</span><b>${Ce}</b>`).join(""),Vh=new Map(G)},Gt=ue("tooltip"),Kh=(S,T)=>{Gt.innerHTML=uh(t,S),Gt.classList.remove("hidden");const O=Jn(),H=Math.min(window.innerWidth-270*O,T.clientX+14);Gt.style.left=`${H/O}px`,Gt.style.top=`${Math.min(window.innerHeight-120*O,T.clientY+14)/O}px`},Na=()=>{Gt.classList.add("hidden"),Gt.classList.remove("talent-pop"),document.removeEventListener("pointerdown",ng),window.removeEventListener("keydown",og,!0),document.querySelectorAll("#cp-trees .talent.picked").forEach(S=>S.classList.remove("picked"))},dc=(S,T)=>{if(T>0?!qp(S,t.job,t.jobLevel,t.talents,t.spec):!Bg(S,t.talents))return!1;if(T>0&&t.spec===void 0&&(ge(S.job).rank??1)>=2){Na();const O=Bo[S.job][S.branch].name;return sa(c("Especialización"),c("¿Especializarte en <b> {
    branch
  }
  </b>? Solo podrás poner puntos en esa rama de  {
    job
  }
  : suma sus 2 skills. Para cambiarla, habla con  {
    npc
  }
   en Prontera ( {
    price
  }
   Puntos Kafra).",{branch:O,job:Ct(ge(S.job),t.look.gender),npc:c(zh),price:j1}),c("Elegir"),()=>{t.spec=S.branch,dc(S,1)}),!1}return t.talents[S.id]=(t.talents[S.id]??0)+T,t.talents[S.id]<=0&&delete t.talents[S.id],T>0&&B.ui("ef_blessing",.3),n(),r(),hc(),I(),cc(),!0},ag=S=>{const T=ue("cp-trees").querySelector(`.talent[data-t="$ {
    S.id
  }
  "]`);if(!T)return Na();const O=t.talents[S.id]??0;Gt.innerHTML=`${uh(t,S)}<div class="tp-btns">
      <button class="ro-btn" data-d="-1" ${Bg(S,t.talents)?"":"disabled"}>−</button>
      <span>${O}/${S.maxRank}</span>
      <button class="ro-btn primary" data-d="1" ${qp(S,t.job,t.jobLevel,t.talents,t.spec)?"":"disabled"}>+</button></div>`,Gt.classList.add("talent-pop"),Gt.classList.remove("hidden"),Gt.querySelectorAll(".tp-btns button").forEach(ie=>{ie.onclick=()=>{dc(S,Number(ie.dataset.d))&&ag(S)}});const H=Jn(),G=T.getBoundingClientRect(),oe=Gt.offsetWidth*H,ae=Gt.offsetHeight*H,Ce=Math.max(8,Math.min(window.innerWidth-oe-8,G.left+G.width/2-oe/2)),ne=G.bottom+8,te=ne+ae<=window.innerHeight-8?ne:Math.max(8,G.top-8-ae);Gt.style.left=`${Ce/H}px`,Gt.style.top=`${te/H}px`,ue("cp-trees").querySelectorAll(".talent.picked").forEach(ie=>ie.classList.remove("picked")),T.classList.add("picked"),document.addEventListener("pointerdown",ng),window.addEventListener("keydown",og,!0)},ng=S=>{var O;const T=S.target;!Gt.contains(T)&&!((O=T.closest)!=null&&O.call(T,".talent"))&&Na()},og=S=>{S.key==="Escape"&&(S.stopImmediatePropagation(),Na())};let Wh=0;const hc=()=>{const S=ue("cp-trees"),T=o===xl&&El(t.job).length<2;S.innerHTML=Nj(t,T?xl:i())+(T?Oj(t,Wh):dx(t,Wh,!1,i()))+Dj(t),ue("cp-reset").closest(".cp-reset-row").classList.toggle("hidden",T),S.querySelectorAll(".tree-job").forEach(O=>{O.onclick=()=>{o=O.dataset.job,Na(),r(),hc()}}),S.querySelectorAll("[data-devjob]").forEach(O=>{O.onclick=()=>{const H=O.dataset.devjob;H==="@max"?t.jobLevel=Zn(t.job):_f(t,H==="@none"?null:H),o="",n(),pc="",cg(),na()}}),S.querySelectorAll(".tree-tab").forEach(O=>{O.onclick=()=>{Wh=Number(O.dataset.b),Na(),hc()}}),S.querySelectorAll(".talent").forEach(O=>{const H=Ze[O.dataset.t];if(Qe){O.onclick=()=>ag(H);return}O.onmousemove=G=>Kh(H,G),O.onmouseleave=Na,O.onclick=G=>{dc(H,1),Kh(H,G)},O.oncontextmenu=G=>{G.preventDefault(),dc(H,-1)&&Kh(H,G)}})},ig=S=>{document.querySelectorAll("#charpanel .tab-btn").forEach(T=>T.classList.toggle("active",T.dataset.tab===S)),ue("cp-tab-equip").classList.toggle("hidden",S!=="equip"),ue("cp-tab-inv").classList.toggle("hidden",S!=="inv"),ue("cp-tab-cards").classList.toggle("hidden",S!=="cards"),ue("cp-tab-pets").classList.toggle("hidden",S!=="pets"),ue("cp-tab-stats").classList.toggle("hidden",S!=="stats"),ue("cp-tab-talents").classList.toggle("hidden",S!=="talents"),ue("cp-points").style.visibility=S==="talents"?"":"hidden",ue("cp-stat-points").style.visibility=S==="stats"?"":"hidden",Na(),de("cp-sock"),S==="cards"&&dt.has("cards")&&ws(),S==="pets"&&dt.has("pets")&&Ba(),cn(`panel: ${S}`)};document.querySelectorAll("#charpanel .tab-btn").forEach(S=>S.onclick=()=>ig(S.dataset.tab));const Vt=S=>[...document.querySelectorAll(S)].filter(T=>!T.closest(".hidden")&&T.getClientRects().length>0&&!T.disabled),rg=()=>{var S;return(S=document.querySelector("#charpanel .tab-btn.active"))==null?void 0:S.dataset.tab},$r=()=>document.querySelector(`#charpanel .equip-slot[data-slot="$ {
    Nt
  }
  "]`),lg=()=>(A!==E&&(A=E,_()),He($r()),!0),uc=S=>(S.dataset.slot!==Nt&&(Nt=S.dataset.slot,A=E=null,I()),He($r()),!0),Yx=(S,T)=>{var O;if(T!=null&&T.classList.contains("equip-slot")){if(S.kind==="move"){const H=pa(Vt("#charpanel .equip-slot"),T,S.dx,S.dy);return H?uc(H):(S.dx>0&&He(Vt("#cp-eq-list .cand")[0]),!0)}if(S.kind==="A")return uc(T),He(Vt("#cp-eq-list .cand")[0]??$r()),!0;if(S.kind==="X")return(O=document.getElementById("cp-unequip"))==null||O.click(),He($r()),!0;if(S.kind==="Y"){const H=u(t.equipped[Nt]);return H!=null&&H.cards.length&&F(H.uid),!0}return!1}if(T!=null&&T.closest("#cp-eq-list")){const H=T.closest(".cand");if(S.kind==="move")return S.dx<0?lg():(S.dy&&H&&He(pa(Vt("#cp-eq-list .cand"),H,0,S.dy)??H),!0);if(S.kind==="A")return H&&!H.classList.contains("worn")&&(D(H.dataset.uid),He($r())),!0;if(S.kind==="B")return lg()}if(T&&S.kind==="move"){const H=pa(Vt("#charpanel .equip-slot, #charpanel button, #charpanel .cand"),T,S.dx,S.dy);if(H!=null&&H.classList.contains("equip-slot"))return uc(H)}return!1},Yh=S=>S?S.querySelector('.prim-btn[data-d="1"]:not(:disabled)')??S.querySelector('.prim-btn[data-d="-1"]:not(:disabled)'):null,Xx=(S,T)=>{const O=T==null?void 0:T.closest("#cp-prim .prim-row");if(!O)return!1;const H=O.querySelector(".prim-btn").dataset.s,G=()=>{var oe;return He(Yh((oe=document.querySelector(`#cp-prim .prim-btn[data-s="$ {
    H
  }
  "]`))==null?void 0:oe.closest(".prim-row"))??void 0)};if(S.kind==="move"&&S.dx)return aa(H,S.dx),G(),!0;if(S.kind==="move"){const oe=[...document.querySelectorAll("#cp-prim .prim-row")];for(let ae=oe.indexOf(O)+S.dy;ae>=0&&ae<oe.length;ae+=S.dy){const Ce=Yh(oe[ae]);if(Ce)return He(Ce),!0}return!1}return S.kind==="A"||S.kind==="X"?(aa(H,S.kind==="X"?10:1),G(),!0):!1},io={inv:["#cp-inventory","#cp-inv-detail"],cards:["#cp-cards","#cp-card-detail"],pets:["#cp-pets","#cp-pet-detail"]},Jx=(S,T,O)=>{const[H,G]=io[O],oe=()=>document.querySelector(`${H} .item-cell.sel`);if(T!=null&&T.matches(".item-cell")&&T.closest(H)){if(S.kind==="move"){const ae=pa(Vt(`${H} .item-cell`),T,S.dx,S.dy);return ae?(ae.click(),He(oe()??ae),!0):!1}return S.kind==="A"?(T.classList.contains("sel")||T.click(),He(Vt(`${G} button`)[0]??oe()),!0):!1}if(T!=null&&T.closest(G)&&S.kind==="B")return He(oe()),!0;if(T&&S.kind==="move"&&!T.closest(G)){const ae=pa(Vt("#charpanel .item-cell, #charpanel button, #charpanel input"),T,S.dx,S.dy);if(ae!=null&&ae.matches(".item-cell")&&ae.closest(H))return ae.click(),He(oe()??ae),!0}return!1},Qx=S=>{const T=rg(),O=[["B","Cerrar"]];if(T==="equip"&&(S!=null&&S.classList.contains("equip-slot"))){const H=u(t.equipped[Nt]);return[["A","Piezas"],...H?[["X","Quitar"]]:[],...H!=null&&H.cards.length?[["Y","Cartas"]]:[],...O]}if(T==="equip"&&(S!=null&&S.closest("#cp-eq-list"))){const H=S.closest(".cand");return[...H&&!H.classList.contains("worn")?[["A","Equipar"]]:[],["↑/↓","Comparar"],["B","Volver"]]}if(T==="stats"&&(S!=null&&S.closest("#cp-prim .prim-row")))return[["←/→","−1 / +1"],["X","+10"],...O];if(T==="talents"&&(S!=null&&S.classList.contains("talent")))return[["A","Subir"],["X","Bajar"],...O];if(T&&io[T]){const[H,G]=io[T];if(S!=null&&S.matches(".item-cell")&&S.closest(H))return[...Vt(`${G} button`).length?[["A","Acciones"]]:[],...O];if(S!=null&&S.closest(G))return[["A","Elegir"],["B","Volver"]]}return null},Zx=S=>{if(S==="equip"){const T=Vt("#charpanel .equip-slot")[0];return T?uc(T):!1}if(S&&io[S]){const T=Vt(`${io[S][0]} .item-cell`)[0];return T?(T.classList.contains("sel")||T.click(),He(document.querySelector(`${io[S][0]} .item-cell.sel`)??T),!0):!1}if(S==="stats"){const T=[...document.querySelectorAll("#cp-prim .prim-row")].map(Yh).find(Boolean);return T&&He(T),!!T}if(S==="talents"){const T=Vt("#cp-trees .talent")[0];return T&&He(T),!!T}return!1};rn("charpanel",S=>{const T=S.focused,O=rg();return S.kind==="enter"?Zx(O):O==="equip"?Yx(S,T):O==="stats"?Xx(S,T):O&&io[O]?Jx(S,T,O):!1},Qx);const Sr=()=>document.querySelector("#cp-sock-body .sock.sel");rn("cp-sock",S=>{var O;const T=S.focused;if(T!=null&&T.classList.contains("sock")){if(S.kind==="move"&&S.dx){const H=pa(Vt("#cp-sock-body .sock"),T,S.dx,0);return H&&(H.click(),He(Sr())),!0}if(S.kind==="move"&&S.dy>0||S.kind==="A"){const H=Vt("#cp-sock-body .sock-card")[0];return H?(He(H),!0):S.kind==="A"}return S.kind==="X"?((O=document.getElementById("cp-sock-remove"))==null||O.click(),He(Sr()),!0):!1}if(T!=null&&T.classList.contains("sock-card")){if(S.kind==="move"&&S.dy)return He(pa(Vt("#cp-sock-body .sock-card"),T,0,S.dy)??(S.dy<0?Sr():T)),!0;if(S.kind==="A")return T.click(),He(Sr()),!0;if(S.kind==="B")return He(Sr()),!0}return!1},S=>S!=null&&S.classList.contains("sock")?[["←/→","Hueco"],["A","Cartas"],...S.classList.contains("filled")?[["X","Quitar carta"]]:[],["B","Cerrar"]]:S!=null&&S.classList.contains("sock-card")?[["A","Encajar"],["B","Volver"]]:null);let Er=null,pc="";const cg=async()=>{const S=La(t),T=JSON.stringify(S);if(T===pc)return;pc=T;const O=await It(ri(t),t.look,S);T===pc&&(Er=O)};let Xh=0;const eM=()=>{const S=ue("cp-avatar"),T=S.getContext("2d");T.imageSmoothingEnabled=!1,S.onclick=()=>Xh=(Xh+1)%8,S.title=c("Clic para girar");let O=!1;const H=performance.now(),G=oe=>{O||(T.clearRect(0,0,S.width,S.height),Er&&oi(T,Er,Er.weapon||Er.shield?"ready":"walk",Xh,Math.floor((oe-H)/120),S.width/2,S.height*.76,1.5),requestAnimationFrame(G))};requestAnimationFrame(G),s=()=>O=!0},na=()=>{r(),I(),xe(),ws(),Ba(),cc(),hc()};Gr&&window.removeEventListener("ro-save-replaced",Gr);const mc=()=>{var T;if((T=document.getElementById("charpanel"))!=null&&T.classList.contains("hidden"))return;const S=ze(a);S&&(t=S,na())};Gr=mc,window.addEventListener("ro-save-replaced",mc),to(ue("cp-inventory"),"[data-uid], [data-ore]",S=>{if(S.dataset.ore){const H=Number(S.dataset.ore);return`<div class="tip-item"><img class="tip-icon" src="$ {
    Me(H)
  }
  " alt=""><div><b>${Oe(Ft(H))}</b>
        <div class="muted">${c(Wp[H]??"")}</div></div></div>`}const T=u(S.dataset.uid);if(!T||!fe[T.itemId])return"";const O=nl(t).get(T.uid);return rc(T,qo(t,T.uid)?`<div class="worn-note">${c("Equipado")}</div>`:O?`<div class="worn-note">${c("lo lleva  {
    who
  }
  ",{who:Oe(O)})}</div>`:En(t,fe[T.itemId])?"":`<div class="error">${c("Tu job no puede usar este objeto.")}</div>`)}),to(ue("cp-cards"),"[data-card]",S=>{const T=Number(S.dataset.card);return Fh(T,`<div class="muted">${c("Tienes  {
    n
  }
   en el álbum",{n:t.cards[T]??0})}</div>`)});const tM=()=>{window.removeEventListener("ro-save-replaced",mc),Gr===mc&&(Gr=null),s(),Na(),lc(),de("cp-sock"),de("charpanel")};ue("cp-back").onclick=()=>{tM(),e.onBack()},ue("cp-reset").onclick=()=>{const S=i(),T=Object.keys(t.talents).filter(O=>{var H;return((H=Ze[O])==null?void 0:H.job)===S});T.length&&sa(c("Reiniciar talentos"),c("¿Reiniciar todos los talentos? Recuperas todos los puntos."),c("Reiniciar"),()=>{for(const O of T)delete t.talents[O];n(),na()})},ue("cp-stat-reset").onclick=()=>{Ti(t.level,Wn())!==Ti(t.level,t.stats)&&sa(c("Reiniciar estadísticas"),c("¿Reiniciar las estadísticas? Recuperas todos los puntos de estado."),c("Reiniciar"),()=>{t.stats=Wn(),n(),na()})},ig("equip"),na(),eM(),Ue("charpanel")}const lx=a=>{var e;return(e=Dn(a).find(t=>t.slot==="weapon"))==null?void 0:e.def.wtype},cx=a=>Fd(a);function uh(a,e){const t=a.talents[e.id]??0,s=gw(e,a.talents),n=mw(e).map(i=>Ze[i]).filter(i=>i&&(a.talents[i.id]??0)<i.maxRank);let o="";if(e.weapons){const i=lx(a),r=e.weapons.includes(i??""),l=r?c("Activo con tu arma actual."):i?c("Ahora no hace nada: llevas  {
    weapon
  }
  .",{weapon:Lp(i)}):c("Ahora no hace nada: no llevas arma.");o=`<div class="tip-weapon $ {
    r?"on":"off"
  }
  "><b>${c("Solo con  {
    weapons
  }
  ",{weapons:e.weapons.map(Lp).join(c(" o "))})}</b><br>${l}</div>`}if(e.needsShield){const i=cx(a);o+=`<div class="tip-weapon $ {
    i?"on":"off"
  }
  "><b>${c("Solo con escudo")}</b><br>${i?c("Activo con tu equipo actual."):c("Ahora no hace nada: no llevas escudo.")}</div>`}return`<b>${Oe(e.name)}</b>${Kn(e.name)?` <span class="ro-orig">(${Oe(Kn(e.name))})</span>`:""} <span class="muted">${c("Rango  {
    r
  }
  / {
    max
  }
  ",{r:t,max:e.maxRank})}</span>${o}<br>${t>0?Oe(e.desc(t)):Oe(e.desc(1))}${t>0&&t<e.maxRank?`<br><span class="next">${c("Siguiente rango")}: ${Oe(e.desc(t+1))}</span>`:""}${Bj(a,e)}${(ge(e.job).rank??1)>=2&&a.spec!==void 0&&a.spec!==e.branch?`<br><span class="req">${c("No es tu especialización: solo se cambia con  {
    npc
  }
   en Prontera.",{npc:c(zh)})}</span>`:""}${s?"":`<br><span class="req">${c("Requiere  {
    n
  }
   puntos en  {
    branch
  }
  .",{n:e.row*Bi,branch:Bo[e.job][e.branch].name})}</span>`}${n.map(i=>`<br><span class="req">${c("Requiere  {
    talent
  }
   al máximo ( {
    n
  }
  / {
    max
  }).",{talent:Oe(i.name),n:a.talents[i.id]??0,max:i.maxRank})}</span>`).join("")}`}function Bj(a,e){var i;if(!e.path)return"";const t=Bo[e.job][e.branch].paths??{},s=t[e.path],n=fw(e,a.talents),o=s?`<br><span class="path">${c("Camino")}: <b>${Oe(s.name)}</b> — ${Oe(s.desc)}</span>`:"";return n?`${o}<br><span class="req">${c("Camino cerrado: ya vas por  {
    path
  }
  . Los dos caminos de una skill no se juntan.",{path:Oe(((i=t[n])==null?void 0:i.name)??n)})}</span>`:o}function dx(a,e,t=!1,s=a.job){if(!Bo[s])return"";const n=pw(s);return`<div class="tree-tabs">${Bo[s].map((i,r)=>`<button class="tree-tab$ {
    r===e?" active":""
  }
  " data-b="$ {
    r
  }
  "><img src="$ {
    se.icons.get(i.icon)
  }
  "><span>${i.name}</span><b>${qg(s,r,a.talents)}</b></button>`).join("")}</div>`+Bo[s].map((i,r)=>{const l=qg(s,r,a.talents),d=n.filter(k=>k.branch===r),h=Math.max(1,...n.map(k=>k.row+1)),u=IS(s),p=k=>(k+.5)/u*100,y=k=>(k+.5)/h*100,w=d.flatMap(k=>mw(k).filter(M=>Ze[M]).map(M=>({t:k,p:Ze[M]}))).map(({t:k,p:M})=>{const $=(a.talents[M.id]??0)>=M.maxRank?" on":"",P=[];M.col!==k.col&&P.push(`<div class="arw h$ {
    $
  }
  " style="top:$ {
    y(M.row)
  }
  %;left:$ {
    p(Math.min(M.col,k.col))
  }
  %;width:$ {
    Math.abs(p(k.col)-p(M.col))
  }
  %"></div>`),M.row!==k.row&&P.push(`<div class="arw v$ {
    $
  }
  " style="left:$ {
    p(k.col)
  }
  %;top:$ {
    y(M.row)
  }
  %;height:$ {
    y(k.row)-y(M.row)
  }
  %"></div>`);const q=M.row===k.row?k.col>M.col?" side":" side left":"";return P.push(`<div class="arw-head$ {
    q
  }
  $ {
    $
  }
  " style="left:$ {
    p(k.col)
  }
  %;top:$ {
    y(k.row)
  }
  %"></div>`),P.join("")}).join(""),m=Array.from({length:h},(k,M)=>{const $=l-d.filter(P=>P.row>=M).reduce((P,q)=>P+(a.talents[q.id]??0),0)>=M*Bi;return M>0?`<div class="tier$ {
    $?" open":""
  }
  " style="top:$ {
    M/h*100
  }
  %;height:$ {
    100/h
  }
  %"><span>${M*Bi}</span></div>`:""}).join(""),f=d.map(k=>{const M=a.talents[k.id]??0,$=["talent"];return(k.weapons||k.needsShield)&&$.push("wpn"),k.learn&&$.push("learn"),M>0&&!Yb(k,lx(a),cx(a))&&$.push("inactive"),M===0&&fw(k,a.talents)?$.push("locked","path-closed"):(!gw(k,a.talents)||!RS(k,a.talents))&&M===0?$.push("locked"):M>=k.maxRank?$.push("maxed"):M>0?$.push("some"):!t&&qp(k,a.job,a.jobLevel,a.talents,a.spec)&&$.push("can"),`<div class="$ {
    $.join(" ")
  }
  " data-t="$ {
    k.id
  }
  " data-uid="$ {
    k.id
  }
  " style="left:$ {
    p(k.col)
  }
  %;top:$ {
    y(k.row)
  }
  %"><img src="$ {
    se.icons.get(k.icon)
  }
  "><span class="rank">${M}/${k.maxRank}</span>${k.weapons?'<span class="wpn-tag">⚔</span>':k.needsShield?'<span class="wpn-tag">🛡</span>':""}</div>`}).join(""),v=(ge(s).rank??1)>=2&&a.spec!==void 0&&a.spec!==r,x=(ge(s).rank??1)>=2&&a.spec===r?`<span class="spec-tag">${c("Especialización")}</span>`:v?'<span class="spec-tag off">🔒</span>':"";return`<div class="tree-col t$ {
    r
  }
  $ {
    r===e?" active":""
  }
  $ {
    v?" off-spec":""
  }
  "><div class="tree-head"><img src="$ {
    se.icons.get(i.icon)
  }
  "><b>${i.name}</b>${x}<span class="pts">${l}</span></div><div class="tree-desc">${i.desc}</div><div class="tree-board" style="height:$ {
    h*58
  }
  px">${m}${w}${f}</div></div>`}).join("")}const xl="@2nd";function Nj(a,e){const t=El(a.job);if(t.length<2){if(!no(a.job).length)return"";const s=a.promotion?ge(a.promotion):null;return`<div class="tree-jobs"><button class="ro-btn small tree-job$ {
    e!==xl?" active":""
  }
  " data-job="$ {
    a.job
  }
  ">${Ct(ge(a.job),a.look.gender)} <b>${Ig(a.talents,a.job)}/${Rg(a.job,a.jobLevel,a.job)}</b></button><button class="ro-btn small tree-job soon$ {
    e===xl?" active":""
  }
  " data-job="$ {
    xl
  }
  ">${s?Ct(s,a.look.gender):c("2º job")} <span class="tree-lock">🔒</span></button></div>`}return`<div class="tree-jobs">${t.map(s=>`<button class="ro-btn small tree-job$ {
    s===e?" active":""
  }
  " data-job="$ {
    s
  }
  ">${Ct(ge(s),a.look.gender)} <b>${Ig(a.talents,s)}/${Rg(a.job,a.jobLevel,s)}</b></button>`).join("")}</div>`}function Oj(a,e){const t=a.promotion?ge(a.promotion):null,s=Math.max(1,...pw(a.job).map(d=>d.row+1)),n=t?c("Talentos de  {
    job
  }
  ",{job:Ct(t,a.look.gender)}):c("Talentos del 2º job"),o=t?c("Sus tres árboles llegarán pronto, con puntos propios. Los talentos de  {
    job
  }
   se quedan como están.",{job:ge(a.job).name}):c("Se abren al subir a 2º job en el Castillo de Prontera: tres árboles nuevos con puntos propios, sin perder los de  {
    job
  }
  .",{job:ge(a.job).name}),i=Array.from({length:s*yc},(d,h)=>`<span class="soon-slot" style="left:$ {
    (h%yc+.5)/yc*100
  }
  %;top:$ {
    (Math.floor(h/yc)+.5)/s*100
  }
  %"></span>`).join(""),r=[0,1,2].map(d=>`<button class="tree-tab$ {
    d===e?" active":""
  }
  " data-b="$ {
    d
  }
  "><span>?</span></button>`).join(""),l=[0,1,2].map(d=>`<div class="tree-col t$ {
    d
  }
   soon$ {
    d===e?" active":""
  }
  "><div class="tree-head"><b>???</b><span class="pts">🔒</span></div><div class="tree-desc"></div><div class="tree-board" style="height:$ {
    s*58
  }
  px">${i}</div></div>`).join("");return`<div class="tree-soon"><b>${n}</b><span>${o}</span></div><div class="tree-tabs">${r}</div>${l}`}function Dj(a){return Mt()?`<div class="btn-row dev-jobs"><span class="muted">dev:</span>${(a.promotion?[["@none",`← ${ge(a.job).name}`]]:no(a.job).map(t=>[t.id,`→ ${Ct(t,a.look.gender)}`])).map(([t,s])=>`<button class="ro-btn small" data-devjob="$ {
    t
  }
  ">${s}</button>`).join("")}<button class="ro-btn small" data-devjob="@max">Job Lv ${Zn(a.job)}</button></div>`:""}function hx(a){const e=t=>{const s=Ip(el[t],t,a);return s>0?`${Ee(s,2)} s`:c("instantáneo")};return[["HP máximo",`${a.maxHp}`],["Regeneración",`${Ee(a.regen,2)} HP/s`],["ATK cuerpo a cuerpo",`${Math.round(a.atk)} (×${Ee(a.powerMelee,2)})`],["ATK a distancia",`${Math.round(a.atkRanged)} (×${Ee(a.powerRanged,2)})`],["MATK",`${Math.round(a.matk)} (×${Ee(a.powerMagic,2)})`],["Celeridad",`${Ee(a.haste*100,1)} (-${Ee((1-No(a.haste))*100,1)}% ${c("de enfriamiento")})`],["Crítico",`${Ee(a.critChance*100,1)}%`],["Casteo máx. (un objetivo)",e("single")],["Casteo máx. (zonal)",e("area")]]}function M0(a){return c({weapon:"Arma",armor:"Armadura",shield:"Escudo",garment:"Capa",shoes:"Calzado",headgear:"Casco",accessory:"Accesorio"}[a]??a)}const za=a=>document.getElementById(a);

// --- In-Game Wiki, Title Screen Parade (`class uq`), Changelogs & Bootstrap (`Hq`) ---
)=>`${(a*100).toFixed(e).replace(".",Te.lang==="es"?",":".")}%`,be=(a,e=1)=>(Math.round(a*10**e)/10**e).toLocaleString(Gi()),so=a=>se.icons.get(a)??"",Fe=(a,e="")=>a?`<img src="$ {
    a
  }
  " alt=""${e?` class="$ {
    e
  }
  "`:""}>`:"",Ws=a=>new URL(`assets/stages/${a}.jpg`,document.baseURI).href,me=(a,e,t="")=>`<div class="stg-sec wk-box $ {
    t
  }
  "><div class="box-title">${a}</div>${e}</div>`,Pe=a=>`<p class="wk-p">${a}</p>`,Ut=(a,e="info")=>`<div class="wk-tip $ {
    e
  }
  ">${a}</div>`,tn=a=>`<div class="wk-formula">${a}</div>`,Uh=a=>`<div class="wk-chips">${a.map(([e,t])=>`<span class="wk-chip"><small>${e}</small><b>${t}</b></span>`).join("")}</div>`,ns=(a,e,t="")=>`<div class="wk-table-wrap"><table class="wk-table $ {
    t
  }
  "><thead><tr>${a.map(s=>`<th>${s}</th>`).join("")}</tr></thead><tbody>${e.map(s=>`<tr>${s.map(n=>`<td>${n}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,vt=(a,e,t,s={})=>`<div class="stg-banner wk-banner $ {
    s.tone??""
  }
  "${s.art?` style="--art:url('${s.art}')"`:""}>
    <span class="stg-banner-lv">${t}</span>
    ${s.face?`<span class="stg-banner-mvp">${s.face}</span>`:""}
    <div class="stg-banner-text"><b>${a}</b><small>${e}</small></div>
  </div>`,gs=(a,e,t,s,n,o=1)=>`<label class="wk-slider"><span>${e}</span><input type="range" id="$ {
    a
  }
  " min="$ {
    t
  }
  " max="$ {
    s
  }
  " step="$ {
    o
  }
  " value="$ {
    n
  }
  "><output id="$ {
    a
  }
  -v">${n}</output></label>`;function Lo(a){const r=a.xMin??0,l=a.yMin??0,d=x=>46+(x-r)/(a.xMax-r)*502,h=x=>12+(1-(Math.min(a.yMax,Math.max(l,x))-l)/(a.yMax-l))*178,u=a.xFmt??(x=>be(x,0)),p=a.yFmt??(x=>be(x,1));let y="";const w=a.yTicks??4;for(let x=0;x<=w;x++){const k=l+(a.yMax-l)*x/w;y+=`<line x1="46" x2="548" y1="$ {
    h(k)
  }
  " y2="$ {
    h(k)
  }
  " class="wk-grid"/><text x="40" y="$ {
    h(k)+4
  }
  " text-anchor="end" class="wk-axis">${p(k)}</text>`}for(let x=0;x<=5;x++){const k=r+(a.xMax-r)*x/5;y+=`<text x="$ {
    d(k)
  }
  " y="210" text-anchor="middle" class="wk-axis">${u(k)}</text>`}const m=a.series.map(x=>{const k=[];for(let M=0;M<=120;M++){const $=r+(a.xMax-r)*M/120;k.push(`${d($).toFixed(1)},${h(x.fn($)).toFixed(1)}`)}return`<polyline points="$ {
    k.join(" ")
  }
  " fill="none" stroke="$ {
    x.color
  }
  " stroke-width="2.5" stroke-linejoin="round"${x.dash?' stroke-dasharray="6 5"':""}/>`}).join("");let f="";if(a.marker!==void 0){const x=d(Math.min(a.xMax,Math.max(r,a.marker)));f=`<line x1="$ {
    x
  }
  " x2="$ {
    x
  }
  " y1="12" y2="190" class="wk-mark"/>`;for(const k of a.series)f+=`<circle cx="$ {
    x
  }
  " cy="$ {
    h(k.fn(a.marker))
  }
  " r="4.5" fill="#fff" stroke="$ {
    k.color
  }
  " stroke-width="2.5"/>`}const v=a.series.map(x=>`<span><i style="background:$ {
    x.color
  }
  "></i>${x.label}</span>`).join("");return`<div class="wk-chart"><svg viewBox="0 0 560 220" preserveAspectRatio="xMidYMid meet">${y}<line x1="46" x2="46" y1="12" y2="190" class="wk-axisline"/><line x1="46" x2="548" y1="190" y2="190" class="wk-axisline"/>${m}${f}</svg><div class="wk-legend">${v}${a.xLabel?`<em>${a.xLabel}</em>`:""}</div></div>`}const Us={blue:"#3a5bb4",sky:"#6f8fd8",orange:"#f08a20",green:"#3cb65a",violet:"#9b5fe0",red:"#d9534f"},us={stats:{str:40,agi:30,vit:20,int:1,dex:30,luk:10},rank:1,eqAtk:30,eqMatk:0};function Cm(){const a=fs(ge("swordsman"));return Object.assign(a,us.stats),a.atk=us.eqAtk,a.matk=us.eqMatk,zm(a,us.rank),a}function C_(a,e,t){return Math.pow(a/e,Math.min(1,.5+t.basicExpBonus))*e}const L_={reroll:"🔄",reroll_card:"🃏",banish:"🚫",focus:"🎯",deity:"🌟"},oo=a=>`<span class="wk-emoji">${a}</span>`,Ex={id:"start",name:()=>b("Cómo se juega","How to play","怎麼玩"),sub:()=>b("El ciclo de una partida","The loop of a run","一局遊戲的循環"),face:()=>oo("📖"),render:()=>{const a=[["🏰",b("La plaza","The plaza","廣場"),b("Prontera es tu base. Aquí hablas con los NPCs, repartes stats y talentos, equipas lo que has conseguido y quedas con otros jugadores.","Prontera is your base. Talk to the NPCs, spend stats and talents, equip your loot and meet other players.","普隆德拉是你的基地。和 NPC 交談、分配素質與天賦、裝備戰利品，並認識其他玩家。")],["🗺️",b("La expedición","The expedition","遠征"),b("El Capitán de expediciones te lleva a un stage. Cada partida empieza a nivel 1 de partida, sin skills salvo el ataque básico.","The Expedition Captain sends you to a stage. Every run starts at run level 1 with only your basic attack.","遠征隊長會派你前往關卡。每局都從本局等級 1 開始，只有普通攻擊。")],["⚔️",b("Sobrevivir","Survive","生存"),b("Solo te mueves: el ataque básico y las skills se lanzan solos en cuanto están listos y tienen a alguien a su alcance.","You only move: your basic attack and skills fire on their own as soon as they are ready and have a target in range.","你只需要移動：普通攻擊與技能只要準備好、射程內有目標就會自動施放。")],["💎",b("Subir de nivel","Level up","升級"),b(`Los monstruos sueltan gemas de EXP. Cada nivel de partida eliges una de 3 cartas: una skill nueva (hasta ${Ds} huecos en 1st job, ${Ds+1} en 2nd job) o una mejora de las que ya tienes.`,`Monsters drop EXP gems. Every run level you pick one of 3 cards: a new skill (up to ${Ds} slots as a 1st job, ${Ds+1} as a 2nd job) or an upgrade to one you own.`,`怪物會掉落經驗寶石。本局每升一級就從 3 張卡片中選一張：新技能（一轉最多 ${Ds} 個欄位，二轉 ${Ds+1} 個）或已有技能的強化。`)],["🎁",b("Cofres","Chests","寶箱"),b("Las élites sueltan cofres. Abrirlos cuesta zeny y te dan piezas de partida (pociones, elixires, bendiciones, platos y Deity).","Elites drop chests. Opening them costs zeny and grants run items (potions, elixirs, blessings, dishes and Deity).","菁英會掉落寶箱。開啟需要金幣，可獲得本局道具（藥水、秘藥、祝福、料理與神祇）。")],["👑",b("Jefes y MVP","Bosses and MVP","頭目與 MVP"),b("Los minijefes salen a su minuto y el MVP al final. Vencer al MVP abre el siguiente stage para ese personaje.","Mini bosses arrive on schedule and the MVP at the end. Beating the MVP unlocks the next stage for that character.","小頭目會按時出現，MVP 在最後登場。擊敗 MVP 會為該角色解鎖下一個關卡。")],["📈",b("Progreso","Progress","成長"),b("Al acabar te llevas EXP de personaje (Base Lv y Job Lv), el equipo y las cartas que hayas cogido. Eso es lo que te hace más fuerte para el siguiente intento.","When the run ends you keep character EXP (Base Lv and Job Lv), gear and cards. That is what makes you stronger for the next attempt.","一局結束後，你保留角色經驗（基本等級與職業等級）、裝備與卡片。這就是讓你在下一次挑戰變得更強的東西。")]];return`${vt(b("Bienvenido a la Biblioteca","Welcome to the Library","歡迎來到圖書館"),b("Todo lo que necesitas saber para sobrevivir a la horda","Everything you need to survive the horde","在怪物群中生存所需的一切知識"),b("Wiki","Wiki","Wiki"),{art:Ws("prontera"),face:Fe(Ge("npc_librarian",2))})}
      ${me(b("El ciclo del juego","The game loop","遊戲循環"),`<div class="wk-steps">${a.map(([e,t,s],n)=>`<div class="wk-step"><span class="wk-step-n">${n+1}</span><span class="wk-step-e">${e}</span><b>${t}</b><small>${s}</small></div>`).join("")}</div>`)}
      ${me(b("En cada nivel de partida","Every run level","每個本局等級"),Uh([[b("Daño","Damage","傷害"),`+${Xe(xh)}`],[b("Vida máxima","Max HP","最大 HP"),`+${Xe(Um,1)}`],[b("Curación al subir","Heal on level up","升級時治療"),Xe(fs(Tt[0]).levelUpHeal)],[b("Cartas a elegir","Cards to choose","可選卡片"),"3"]])+Pe(b("Estos bonus se multiplican sobre todo lo demás: a nivel 30 de partida pegas un 87% más que a nivel 1 con las mismas cartas.","These bonuses multiply on top of everything else: at run level 30 you hit 87% harder than at level 1 with the same cards.","這些加成會乘在其他所有加成之上：本局等級 30 時，同樣的卡片打出的傷害比等級 1 高 87%。")))}
      ${me(b("Controles","Controls","操作"),ns([b("Acción","Action","動作"),b("Teclado y ratón","Keyboard & mouse","鍵盤與滑鼠"),b("Móvil / mando","Mobile / gamepad","手機／手把")],[[b("Moverse","Move","移動"),"WASD · "+b("flechas","arrows","方向鍵")+" · "+b("clic","click","點擊"),b("joystick táctil · stick izquierdo","touch joystick · left stick","觸控搖桿 · 左搖桿")],[b("Medidor de daño","Damage meter","傷害統計"),"K",b("botón del minimapa","minimap button","小地圖按鈕")],[b("Pausa / cerrar ventanas","Pause / close windows","暫停／關閉視窗"),"Esc","Start · B"],[b("Elegir carta","Pick a card","選擇卡片"),b("clic","click","點擊"),b("toque · A","tap · A","點擊 · A")]]))}
      ${Ut(b("Consejo: al principio de cada partida hay un arranque suave de 30 segundos en el que salen menos monstruos y más despacio. Aprovéchalo para coger tu primera skill.","Tip: every run starts with a 30-second soft opening with fewer, slower monsters. Use it to grab your first skill.","提示：每局開頭有 30 秒的緩衝期，怪物較少也較慢。趁這段時間拿到你的第一個技能。"),"good")}`}},A_={id:"stats",name:()=>b("Estadísticas","Stats","素質"),sub:()=>"STR · AGI · VIT · INT · DEX · LUK",face:()=>oo("📊"),render:()=>{const a={str:"💪",agi:"💨",vit:"❤️",int:"🔮",dex:"🎯",luk:"🍀"},e=_t.map(s=>`<div class="wk-stat wk-stat-$ {
    s.id
  }
  "><span class="wk-stat-e">${a[s.id]}</span><b>${s.name}</b><small>${s.desc}</small></div>`).join(""),t=[1,10,20,30,40,50,60,70,80,90,98].map(s=>[`${s} → ${s+1}`,String(Wm(s)),String(Ng(s+1))]);return`${vt(b("Estadísticas de RO","RO stats","RO 素質"),b("Se reparten fuera de partida y cuentan en todas","Spent outside runs, they apply to every run","在局外分配，適用於每一局"),b("Personaje","Character","角色"),{tone:"wk-tone-blue"})}
      ${me(b("Qué hace cada una","What each one does","各素質的作用"),`<div class="wk-stats">${e}</div>`)}
      ${me(b("Calculadora de stats","Stat calculator","素質計算機"),`<div class="wk-calc">
          <div class="wk-calc-in">
            ${_t.map(s=>gs(`wk-s-${s.id}`,s.name,1,mr,us.stats[s.id])).join("")}
            ${gs("wk-eqatk",b("ATK del equipo","Gear ATK","裝備 ATK"),0,400,us.eqAtk)}
            ${gs("wk-eqmatk",b("MATK del equipo","Gear MATK","裝備 MATK"),0,400,us.eqMatk)}
            <div class="tabs wk-rank"><button class="tab-btn$ {
    us.rank===1?" active":""
  }
  " data-rank="1">${b("1st job","1st job","一轉")}</button><button class="tab-btn$ {
    us.rank===2?" active":""
  }
  " data-rank="2">${b("2nd job","2nd job","二轉")}</button></div>
          </div>
          <div class="wk-calc-out" id="wk-calc-out"></div>
        </div>`)}
      ${me(b("Puntos de estado","Status points","素質點數"),Pe(b(`Empiezas con <b>${lu}</b> puntos al crear el personaje y cada Base Lv te da <b>floor(nivel / 5) + 3</b> más: <b>${So(99).toLocaleString(Gi())}</b> en total a nivel 99. Subir una stat cuesta más cuanto más alta está, como en RO:`,`You start with <b>${lu}</b> points at character creation and every Base Lv grants <b>floor(level / 5) + 3</b> more: <b>${So(99).toLocaleString(Gi())}</b> in total at level 99. Raising a stat costs more the higher it is, just like RO:`,`建立角色時你有 <b>${lu}</b> 點，每個基本 Lv 再給 <b>floor(等級 / 5) + 3</b> 點：99 級時共 <b>${So(99).toLocaleString(Gi())}</b> 點。素質越高，提升所需的點數越多，就像在 RO 裡：`))+ns([b("Subida","Raise","提升"),b("Cuesta","Cost","花費"),b("Total gastado","Total spent","總花費")],t,"wk-compact")+Ut(b("Puedes reiniciar las stats desde el panel del personaje cuando quieras.","You can reset your stats from the character panel at any time.","你隨時可以在角色面板重置素質。")))}`},bind:a=>{const e=a.querySelector("#wk-calc-out"),t=()=>{const s=Cm(),n=_t.reduce((l,d)=>l+Ng(us.stats[d.id]),0);let o=1;for(;o<99&&So(o)<n;)o++;const i=So(o)>=n,r=(l,d,h="")=>`<div class="wk-out-row"><span>${l}${h?`<small>${h}</small>`:""}</span><b>${d}</b></div>`;e.innerHTML=`
        <div class="wk-out-group"><div class="wk-out-h">⚔️ ${b("Ataque","Attack","攻擊")}</div>
          ${r(b("ATK cuerpo a cuerpo","Melee ATK","近戰 ATK"),be(s.atk,0),b("equipo + 3×STR","gear + 3×STR","裝備 + 3×STR"))}
          ${r(b("ATK a distancia","Ranged ATK","遠程 ATK"),be(s.atkRanged,0),b("equipo + STR + 3×DEX","gear + STR + 3×DEX","裝備 + STR + 3×DEX"))}
          ${r("MATK",be(s.matk,0),b("equipo + 3×INT","gear + 3×INT","裝備 + 3×INT"))}
          ${r(b("Poder de skills cuerpo a cuerpo","Melee skill power","近戰技能威力"),"×"+be(s.powerMelee,2))}
          ${r(b("Poder de skills a distancia","Ranged skill power","遠程技能威力"),"×"+be(s.powerRanged,2))}
          ${r(b("Poder de skills mágicas","Magic skill power","魔法技能威力"),"×"+be(s.powerMagic,2))}
          ${r(b("Ataque básico cuerpo a cuerpo","Melee basic attack","近戰普通攻擊"),"×"+be(C_(s.powerMelee,s.jumpMelee,s),2),b("raíz del poder","square root of power","威力的平方根"))}
        </div>
        <div class="wk-out-group"><div class="wk-out-h">⏱️ ${b("Ritmo","Tempo","節奏")}</div>
          ${r(b("Celeridad","Haste","冷卻縮減"),be(s.haste*100,1),b("AGI × 0,67","AGI × 0.67","AGI × 0.67"))}
          ${r(b("Enfriamiento de las skills","Skill cooldowns","技能冷卻"),"−"+Xe(1-No(s.haste),1))}
          ${r(b("Casteo a un objetivo","Single-target cast","單體詠唱"),be(Ip(el.single,"single",s),2)+" s",`${b("base","base","基礎")} ${el.single} s`)}
          ${r(b("Casteo zonal","Area cast","範圍詠唱"),be(Ip(el.area,"area",s),2)+" s",`${b("base","base","基礎")} ${el.area} s`)}
          ${r(b("Doble casteo","Double cast","雙重詠唱"),Xe(s.doubleChance,1))}
        </div>
        <div class="wk-out-group"><div class="wk-out-h">🛡️ ${b("Supervivencia","Survival","生存")}</div>
          ${r(b("Vida máxima","Max HP","最大 HP"),"+"+Xe(.02*us.stats.vit,0))}
          ${r(b("Regeneración","Regeneration","回復"),be(s.regen,1)+" HP/s")}
          ${r(b("Curación de la carne","Meat healing","肉的治療量"),"×"+be(s.potionMult,2))}
          ${r("Flee",Xe(Math.min(.5,s.flee),1),b("tope 50%","cap 50%","上限 50%"))}
          ${r(b("Crítico","Critical","爆擊"),Xe(s.critChance,1),b("3% + 0,3% por LUK","3% + 0.3% per LUK","3% + 每點 LUK 0.3%"))}
        </div>
        <div class="wk-out-foot $ {
    i?"":"bad"
  }
  ">${b(`Esta build gasta <b>${n}</b> puntos de estado: hace falta <b>Base Lv ${o}</b>.`,`This build spends <b>${n}</b> status points: it needs <b>Base Lv ${o}</b>.`,`這個配置花費 <b>${n}</b> 素質點數：需要 <b>基本 Lv ${o}</b>。`)}${i?"":" "+b("(¡No llega ni a nivel 99!)","(Not even level 99 is enough!)","（連 99 級都不夠！）")}</div>`};for(const s of _t){const n=a.querySelector(`#wk-s-${s.id}`);n.oninput=()=>{us.stats[s.id]=+n.value,a.querySelector(`#wk-s-${s.id}-v`).textContent=n.value,t()}}for(const[s,n]of[["wk-eqatk","eqAtk"],["wk-eqmatk","eqMatk"]]){const o=a.querySelector(`#${s}`);o.oninput=()=>{us[n]=+o.value,a.querySelector(`#${s}-v`).textContent=o.value,t()}}a.querySelectorAll("[data-rank]").forEach(s=>{s.onclick=()=>{us.rank=+s.dataset.rank,a.querySelectorAll("[data-rank]").forEach(n=>n.classList.toggle("active",n===s)),t()}}),t()}},P_={id:"damage",name:()=>b("Daño: ATK y MATK","Damage: ATK & MATK","傷害：ATK 與 MATK"),sub:()=>b("Cómo se calcula cada golpe","How every hit is computed","每一擊如何計算"),face:()=>oo("💥"),render:()=>{const a=Cm(),e=Dg[1],t=Dg[2],s=[0,30,60,90,120,150,180,240,300].map(o=>[String(o),"×"+be(ia(o,1),2),"×"+be(ia(o,2),2),"×"+be(Math.sqrt(ia(o,1)),2)]),n=[[b("Daño base","Base damage","基礎傷害"),b("el propio de la skill: no cambia en toda la partida","the skill’s own value: it never changes during the run","技能本身的數值：本局中不會改變")],[b("× (1 + mejoras)","× (1 + upgrades)","× (1 + 強化)"),b("mejoras de daño de las cartas y talentos de la skill (se suman)","damage upgrades from cards and the skill’s talents (additive)","來自卡片與技能天賦的傷害強化（加算）")],[b("× Poder","× Power","× 威力"),b("ATK cuerpo a cuerpo, ATK a distancia o MATK, según la skill","melee ATK, ranged ATK or MATK, depending on the skill","依技能而定：近戰 ATK、遠程 ATK 或 MATK")],[b("× Daño","× Damage","× 傷害"),b("bonus de daño del equipo, cofres y talentos, × nivel de partida, × buffs","damage bonuses from gear, chests and talents, × run level, × buffs","來自裝備、寶箱與天賦的傷害加成，× 本局等級，× 增益")],[b("× 90–110%","× 90–110%","× 90–110%"),b("variación aleatoria de cada golpe","random variance of every hit","每一擊的隨機浮動")],[b("× Crítico","× Critical","× 爆擊"),b(`si es crítico: ×${be(fs(Tt[0]).critMult,1)} de base, más el daño crítico que sumes`,`on a crit: ×${be(fs(Tt[0]).critMult,1)} base, plus any critical damage you add`,`爆擊時：基礎 ×${be(fs(Tt[0]).critMult,1)}，再加上你額外的爆擊傷害`)],[b("× Objetivo","× Target","× 目標"),b("jefes, élites, no-muertos, marcados, envenenados, petrificados…","bosses, elites, undead, marked, poisoned, petrified targets…","頭目、菁英、不死族、被標記、中毒、石化的目標…")]];return`${vt(b("ATK, MATK y poder","ATK, MATK and power","ATK、MATK 與威力"),b("El mismo número decide el daño de cada skill","One number scales every skill","一個數字決定所有技能的強度"),b("Combate","Combat","戰鬥"),{tone:"wk-tone-orange"})}
      ${me(b("La cadena del daño","The damage chain","傷害鏈"),`<div class="wk-pipe">${n.map(([o,i])=>`<div class="wk-pipe-step"><b>${o}</b><small>${i}</small></div>`).join('<span class="wk-pipe-arrow">➜</span>')}</div>`)}
      ${me(b("De dónde sale el ATK y el MATK","Where ATK and MATK come from","ATK 與 MATK 從何而來"),`<div class="wk-trio">
          <div class="wk-trio-c melee"><b>⚔️ ${b("Cuerpo a cuerpo","Melee","近戰")}</b>${tn(b("ATK equipo + 3 × STR","Gear ATK + 3 × STR","裝備 ATK + 3 × STR"))}<small>${b("Bash, Mammonite, Envenom, golpes con arma…","Bash, Mammonite, Envenom, weapon strikes…","狂擊、金錢攻擊、施毒、武器打擊…")}</small></div>
          <div class="wk-trio-c ranged"><b>🏹 ${b("A distancia","Ranged","遠程")}</b>${tn(b("ATK equipo + STR + 3 × DEX","Gear ATK + STR + 3 × DEX","裝備 ATK + STR + 3 × DEX"))}<small>${b("Double Strafe, flechas, shurikens, balas…","Double Strafe, arrows, shuriken, bullets…","二連矢、箭矢、手裡劍、子彈…")}</small></div>
          <div class="wk-trio-c magic"><b>🔮 ${b("Mágico","Magic","魔法")}</b>${tn(b("MATK equipo + 3 × INT","Gear MATK + 3 × INT","裝備 MATK + 3 × INT"))}<small>${b("Bolts, Soul Strike, Heal, Holy Light…","Bolts, Soul Strike, Heal, Holy Light…","箭術、聖靈召喚、治癒術、神聖之光…")}</small></div>
        </div>`+Ut(b("Lo que usa cada skill lo deciden sus etiquetas, no tu job: un Acolyte con STR pega con la maza igual de bien que con magia si la skill es física. Las skills híbridas (Arcane Shot, Flecha ígnea) suman el ATK a distancia y el MATK.","What each skill uses is decided by its tags, not your job: an Acolyte with STR hits just as hard with a mace if the skill is physical. Hybrid skills (Arcane Shot, Fire Arrow) add ranged ATK and MATK together.","技能使用哪種數值由技能標籤決定，而不是你的職業：若技能是物理的，有 STR 的服事拿鈍器一樣打得很痛。混合技能（奧術射擊、火焰箭）會把遠程 ATK 與 MATK 加總。")))}
      ${me(b("El poder: una curva que acelera","Power: an accelerating curve","威力：加速成長的曲線"),Pe(b("El ATK no suma daño plano: se convierte en un <b>multiplicador de poder</b>. Los primeros puntos apenas se notan y los últimos muchísimo. El 2nd job usa una curva aún más empinada (cúbica) y nunca rinde menos de ×1,5 lo que daría el 1st job con las mismas stats.","ATK does not add flat damage: it becomes a <b>power multiplier</b>. The first points barely show and the last ones are huge. 2nd jobs use an even steeper (cubic) curve and never yield less than ×1.5 what the 1st job would with the same stats.","ATK 不是增加固定傷害，而是轉換成<b>威力倍率</b>。前幾點幾乎看不出差別，最後幾點則非常驚人。二轉職業使用更陡（三次方）的曲線，且永遠至少是同素質一轉職業的 ×1.5。"))+tn(`1st job: ${b("poder","power","威力")} = 1 + (ATK / 15,46)<sup>${Og[1]}</sup> × ${String(e).replace(".",",")}<br>2nd job: ${b("poder","power","威力")} = ${b("máx","max","最大")}(1 + (ATK / 15,46)<sup>${Og[2]}</sup> × ${String(t).replace(".",",")}, 1,5 × 1st job)`)+`<div id="wk-power-chart"></div>${gs("wk-pw",b("ATK / MATK","ATK / MATK","ATK / MATK"),0,300,Math.round(a.atk))}<div id="wk-power-read" class="wk-read"></div>`+ns(["ATK","Skill 1st","Skill 2nd",b("Básico 1st","Basic 1st","一轉基礎")],s,"wk-compact"))}
      ${me(b("El ataque básico","The basic attack","普通攻擊"),Pe(b("El básico pega muy a menudo, así que escala con la <b>raíz cuadrada</b> del poder para no eclipsar a las skills. Los 2nd jobs lo escalan algo mejor (exponente 0,65) y el salto de job lo recibe entero. El arco escala más que el resto de armas. Swordsman y Merchant (y sus 2nd jobs) hacen un <b>75% más</b> con el básico cuerpo a cuerpo con arma de una mano y un <b>125% más</b> con una a dos manos; el Thief, un <b>35%</b> y un <b>50% más</b>. Además, las skills de área de los tres pegan un <b>40% más a los jefes</b>.","The basic attack hits very often, so it scales with the <b>square root</b> of power so it doesn’t overshadow skills. 2nd jobs scale it a bit better (exponent 0.65) and get the full job jump. Bows scale more than other weapons. Swordsman and Merchant (and their 2nd jobs) deal <b>75% more</b> with a melee basic attack using a one-handed weapon and <b>125% more</b> with a two-handed one; the Thief, <b>35%</b> and <b>50% more</b>. On top of that, the area skills of all three deal <b>40% more to bosses</b>.","普通攻擊打得非常頻繁，因此隨威力的<b>平方根</b>成長，以免蓋過技能。二轉職業的成長稍好（指數 0.65）並享有完整的轉職提升。弓的成長比其他武器高。劍士與商人（及其二轉）使用單手武器的近戰普通攻擊傷害<b>多 75%</b>，雙手武器<b>多 125%</b>；盜賊分別<b>多 35%</b> 與<b>多 50%</b>。此外，這三個職業的範圍技能<b>對頭目多 40% 傷害</b>。")))}
      ${me(b("Calculadora de golpe","Hit calculator","打擊計算機"),`<div class="wk-hit">
          <label class="wk-select"><span>${b("Skill","Skill","技能")}</span><select id="wk-hit-skill">${j_().map(o=>`<option value="$ {
    o
  }
  ">${ce[o].name}</option>`).join("")}</select></label>
          ${gs("wk-hit-up",b("Mejoras de daño (+%)","Damage upgrades (+%)","傷害強化（+%）"),0,300,0,10)}
          ${gs("wk-hit-bonus",b("Bonus de daño (+%)","Damage bonus (+%)","傷害加成（+%）"),0,200,0,5)}
          ${gs("wk-hit-runlv",b("Nivel de partida","Run level","本局等級"),1,60,1)}
          <div id="wk-hit-out" class="wk-hit-out"></div>
        </div>`+Ut(b("Usa las stats de la calculadora de la sección Estadísticas. Es una estimación: no cuenta marcas, buffs, talentos con efectos propios ni la vulnerabilidad del objetivo.","Uses the stats from the Stats calculator. It is an estimate: it ignores marks, buffs, talents with special effects and target vulnerability.","使用素質計算機中的素質。這只是估算：忽略標記、增益、具特殊效果的天賦與目標弱點。")))}
      ${me(b("Crítico y doble casteo","Critical and double cast","爆擊與雙重詠唱"),Uh([[b("Crítico base","Base crit","基礎爆擊"),Xe(fs(Tt[0]).critChance)],[b("Por punto de LUK","Per LUK point","每點 LUK"),"+0,3%"],[b("Daño crítico base","Base crit damage","基礎爆擊傷害"),"×"+be(fs(Tt[0]).critMult,1)],[b("Doble casteo por DEX","Double cast per DEX","每點 DEX 雙重詠唱"),"+0,1%"],[b("Doble casteo por LUK","Double cast per LUK","每點 LUK 雙重詠唱"),"+0,05%"]])+Pe(b("El doble casteo hace que una skill o un ataque salga dos veces seguidas sin gastar otro enfriamiento.","Double cast makes a skill or attack fire twice in a row without spending another cooldown.","雙重詠唱讓技能或攻擊連續發動兩次，且不消耗額外冷卻。")))}`},bind:a=>{const e=Cm(),t=a.querySelector("#wk-power-chart"),s=a.querySelector("#wk-power-read"),n=a.querySelector("#wk-pw"),o=()=>{const h=+n.value;a.querySelector("#wk-pw-v").textContent=n.value,t.innerHTML=Lo({series:[{fn:u=>ia(u,1),color:Us.blue,label:b("Skills 1st job","1st job skills","一轉技能")},{fn:u=>ia(u,2),color:Us.orange,label:b("Skills 2nd job","2nd job skills","二轉技能")},{fn:u=>Math.sqrt(ia(u,1)),color:Us.green,label:b("Básico 1st job","1st job basic","一轉普攻"),dash:!0}],xMax:300,yMax:Math.ceil(ia(300,2)/10)*10,yFmt:u=>"×"+be(u,0),marker:h,xLabel:"ATK / MATK"}),s.innerHTML=`${b("Con","With","搭配")} <b>${h}</b>: 1st job <b>×${be(ia(h,1),2)}</b> · 2nd job <b>×${be(ia(h,2),2)}</b> · ${b("básico","basic","普攻")} <b>×${be(Math.sqrt(ia(h,1)),2)}</b>`};n.oninput=o,o();const i=a.querySelector("#wk-hit-skill"),r=["wk-hit-up","wk-hit-bonus","wk-hit-runlv"],l=a.querySelector("#wk-hit-out"),d=()=>{var k,M;for(const $ of r)a.querySelector(`#${$}-v`).textContent=a.querySelector(`#${$}`).value;const h=$=>+a.querySelector(`#${$}`).value,u=i.value,p=ce[u].create(),y=((M=(k=p.cfg)==null?void 0:k.dmg)==null?void 0:M.call(k,1))??0,w=ce[u].tags??[],m=w.includes("hybrid")?e.powerHybrid:w.includes("magic")?e.powerMagic:w.includes("physical")?w.includes("melee")?e.powerMelee:e.powerRanged:1,f=(1+h("wk-hit-up")/100)*m*(p.dmgScale??1)*(1+h("wk-hit-bonus")/100)*(1+xh*(h("wk-hit-runlv")-1)),v=y*f,x=w.includes("hybrid")?b("híbrida","hybrid","混合"):w.includes("magic")?"MATK":w.includes("melee")?b("ATK cuerpo a cuerpo","melee ATK","近戰 ATK"):b("ATK a distancia","ranged ATK","遠程 ATK");l.innerHTML=`<div class="wk-hit-big"><small>${b("Golpe normal","Normal hit","一般打擊")}</small><b>${be(v*.9,0)} – ${be(v*1.1,0)}</b></div>
        <div class="wk-hit-big crit"><small>${b("Crítico","Critical","爆擊")}</small><b>${be(v*.9*e.critMult,0)} – ${be(v*1.1*e.critMult,0)}</b></div>
        <div class="wk-hit-note">${b("Base","Base","基礎")} ${be(y*(p.dmgScale??1),1)} · ${b("escala con","scales with","成長依據")} ${x} (×${be(m,2)})</div>`};i.onchange=d;for(const h of r)a.querySelector(`#${h}`).oninput=d;d()}};function j_(){return Tt.filter(Yf).flatMap(a=>tr[a.id]??[]).filter(a=>{var t,s;const e=ce[a];if(!(e!=null&&e.create)||e.type==="buff"||e.type==="control")return!1;try{return(((s=(t=e.create().cfg)==null?void 0:t.dmg)==null?void 0:s.call(t,1))??0)>0}catch{return!1}})}const __={id:"curves",name:()=>b("Valores decrecientes","Diminishing returns","收益遞減"),sub:()=>b("Topes y curvas de cada bonus","Caps and curves of every bonus","各項加成的上限與曲線"),face:()=>oo("📉"),render:()=>{const a=[[b("Reducción de daño","Damage reduction","傷害減免"),"60%",b("75% contando buffs temporales","75% counting temporary buffs","含暫時增益 75%")],["Flee","50%",b("AGI 0,2% y LUK 0,1% por punto","AGI 0.2% and LUK 0.1% per point","每點 AGI 0.2%、LUK 0.1%")],[b("Robo de vida","Lifesteal","吸血"),b("3% de la vida/s","3% of max HP/s","每秒最大 HP 的 3%"),b("lo que pase no cura","anything above heals nothing","超出部分不會治療")],[b("Descuento de cofres","Chest discount","寶箱折扣"),"60%",""],[b("Área, alcance y velocidad","Area, reach and speed","範圍、攻擊範圍與速度"),"+200%",b("curva suave, ver arriba","soft curve, see above","平緩曲線，見上方")],[b("+Proyectiles por cartas","+Projectiles from cards","卡片帶來的 +投射物"),`+${md}`,b("ataque básico a distancia y Arrow Repel; Deity, talentos y equipo aparte","ranged basic attacks and Arrow Repel; Deity, talents and gear are separate","遠程普通攻擊與衝鋒箭；神祇、天賦與裝備另計")],[b("Perforación","Pierce","貫穿"),b("75% (8 enemigos más)","75% (8 extra enemies)","75%（多 8 個敵人）"),b("es una probabilidad por enemigo: 2–10% por carta, 10% el Deity, 20% el Archer con arco","a chance per enemy: 2–10% per card, 10% from Deity, 20% for Archer with a bow","每個敵人一次機率：每張卡片 2–10%，神祇 10%，弓箭手持弓 20%")],[b("Enfriamiento","Cooldown","冷卻"),b("nunca 0","never 0","永遠不會是 0"),b("cada punto rinde menos","each point is worth less","每一點的價值遞減")]];return`${vt(b("Valores decrecientes","Diminishing returns","收益遞減"),b("Apilar un solo bonus rinde cada vez menos","Stacking a single bonus gets less and less effective","只堆單一加成，效果會越來越差"),b("Mecánicas","Mechanics","機制"),{tone:"wk-tone-violet"})}
      ${Ut(b("Muchas estadísticas no suman en línea recta: los primeros puntos rinden mucho y los siguientes cada vez menos. Así ninguna build puede romper el juego apilando una sola cosa, y repartir suele salir a cuenta.","Many stats don’t add up linearly: the first points are worth a lot and the next ones less and less. No build can break the game by stacking one thing, so spreading out usually pays off.","許多數值並非線性相加：前幾點很值錢，後面越來越少。沒有任何配置能靠堆一種東西破壞遊戲，所以平均分配通常比較划算。"))}
      ${me(b("Curvas interactivas","Interactive curves","互動曲線"),`<div class="tabs wk-curve-tabs">
          <button class="tab-btn active" data-curve="haste">${b("Celeridad","Haste","冷卻縮減")}</button>
          <button class="tab-btn" data-curve="soft">${b("Área · alcance · velocidad","Area · reach · speed","範圍 · 攻擊範圍 · 速度")}</button>
          <button class="tab-btn" data-curve="def">DEF</button>
          <button class="tab-btn" data-curve="disc">${b("Descubrimiento","Discovery","尋寶率")}</button>
          <button class="tab-btn" data-curve="exp">EXP</button>
        </div>
        <div id="wk-curve"></div>${gs("wk-cv","",0,300,100)}<div id="wk-curve-read" class="wk-read"></div><div id="wk-curve-note"></div>`)}
      ${me(b("Topes","Caps","上限"),ns([b("Estadística","Stat","素質"),b("Tope","Cap","上限"),b("Notas","Notes","備註")],a))}
      ${me(b("Lo que se suma y lo que se encadena","What adds and what chains","哪些相加、哪些相乘"),Pe(b("Los bonus de daño, de crítico, de vida o de área de distintas fuentes se <b>suman</b> entre sí antes de aplicarse. La Celeridad y la rapidez de casteo también se suman, pero luego pasan por su curva. Las piezas de cofre de enfriamiento se encadenan: dos de −16% y −12% dejan el enfriamiento en el 74%, no en el 72%.","Damage, crit, HP or area bonuses from different sources are <b>added</b> together before being applied. Haste and cast speed also add up, but then go through their curve. Cooldown chest items chain: −16% and −12% leave cooldown at 74%, not 72%.","來自不同來源的傷害、爆擊、HP 或範圍加成會先<b>相加</b>再套用。冷卻縮減與詠唱速度也會相加，但之後會經過其曲線。冷卻類寶箱道具會連乘：−16% 與 −12% 讓冷卻變成 74%，而不是 72%。")))}`},bind:a=>{const e=a.querySelector("#wk-curve"),t=a.querySelector("#wk-cv"),s=t.parentElement.querySelector("span"),n=a.querySelector("#wk-curve-read"),o=a.querySelector("#wk-curve-note"),i=u=>u/(1+u/2);let r="haste";const l={haste:{max:300,label:b("Celeridad","Haste","冷卻縮減"),draw:u=>Lo({series:[{fn:p=>No(p/100)*100,color:Us.blue,label:b("Enfriamiento que queda","Remaining cooldown","剩餘冷卻")}],xMax:300,yMax:100,yFmt:p=>be(p,0)+"%",marker:u,xLabel:b("puntos de Celeridad","Haste points","冷卻縮減點數")}),read:u=>`${u} ${b("de Celeridad","Haste","冷卻縮減")} → ${b("enfriamiento al","cooldown at","冷卻為")} <b>${Xe(No(u/100),1)}</b> (−${Xe(1-No(u/100),1)}) · ${b("equivale a","equals","等於")} <b>${be(u/(vc*100),0)}</b> AGI`,note:tn(b("enfriamiento = base × 1 / (1 + Celeridad / 100)","cooldown = base × 1 / (1 + Haste / 100)","冷卻 = 基礎 × 1 / (1 + 冷卻縮減 / 100)"))+Pe(b(`Viene de la AGI (${be(vc*100,2)} por punto), de las mejoras de enfriamiento de cada skill (+6 por mejora común), de pociones, bendiciones, equipo y buffs. 100 puntos dejan el enfriamiento a la mitad; 300, a la cuarta parte. La rapidez de casteo funciona igual, después de que la DEX haya recortado el casteo (instantáneo con ${ci.single} DEX a un objetivo y ${ci.area} DEX en zonales).`,`It comes from AGI (${be(vc*100,2)} per point), each skill’s cooldown upgrades (+6 per common upgrade), potions, blessings, gear and buffs. 100 points halve cooldowns; 300 leave a quarter. Cast speed works the same way, after DEX has trimmed the cast (instant at ${ci.single} DEX for single target and ${ci.area} DEX for area skills).`,`來源有 AGI（每點 ${be(vc*100,2)}）、每個技能的冷卻強化（每個普通強化 +6）、藥水、祝福、裝備與增益。100 點讓冷卻減半；300 點剩下四分之一。詠唱速度的運作方式相同，在 DEX 縮短詠唱之後套用（單體技能 ${ci.single} DEX、範圍技能 ${ci.area} DEX 時瞬發）。`))},soft:{max:400,label:b("Bonus (+%)","Bonus (+%)","加成（+%）"),draw:u=>Lo({series:[{fn:p=>i(p/100)*100,color:Us.orange,label:b("Lo que se aplica","What applies","實際套用")},{fn:p=>p,color:Us.sky,label:b("Sin curva","Without curve","不經曲線"),dash:!0}],xMax:400,yMax:220,yFmt:p=>"+"+be(p,0)+"%",marker:u,xLabel:b("bonus sumado","summed bonus","加總加成")}),read:u=>`+${u}% → <b>+${be(i(u/100)*100,0)}%</b>`,note:tn(b("aplicado = bonus / (1 + bonus / 2)","applied = bonus / (1 + bonus / 2)","套用 = 加成 / (1 + 加成 / 2)"))+Pe(b("Vale para el área, el alcance de los golpes cuerpo a cuerpo y la velocidad de movimiento. El tope está en +200%. Los modificadores propios de cada skill (los de sus talentos y mejoras) van aparte y no pasan por esta curva.","Applies to area, melee reach and movement speed. The cap is +200%. Each skill’s own modifiers (from its talents and upgrades) are separate and don’t go through this curve.","適用於範圍、近戰攻擊範圍與移動速度。上限為 +200%。各技能本身的修正（來自其天賦與強化）另外計算，不經過此曲線。"))},def:{max:200,label:"DEF",draw:u=>Lo({series:[{fn:p=>Uo(p)*100,color:Us.green,label:b("Daño que quita","Damage removed","減少的傷害")}],xMax:200,yMax:80,yFmt:p=>be(p,0)+"%",marker:u,xLabel:b("DEF del equipo","gear DEF","裝備 DEF")}),read:u=>`${u} DEF → <b>−${Xe(Uo(u),1)}</b> ${b("de cada golpe","of every hit","每一擊的")}`,note:tn(`DEF / (DEF + ${FS})`)+Pe(b("La DEF del equipo (y su refine) funciona como la hard DEF de RO: quita un porcentaje de cada golpe y cada punto rinde algo menos que el anterior. Se multiplica con las demás reducciones, no se suma a su tope.","Gear DEF (and its refine) works like RO hard DEF: it removes a percentage of every hit and each point is worth a bit less. It multiplies with other reductions instead of counting towards their cap.","裝備 DEF（及其精煉）如同 RO 的硬 DEF：減少每一擊一定比例的傷害，每點價值略為遞減。它與其他減免相乘，而不計入其上限。"))},disc:{max:300,label:b("Descubrimiento (+%)","Discovery (+%)","尋寶率（+%）"),draw:u=>Lo({series:Re.slice(2).map((p,y)=>({fn:w=>ub(w/100)[y+2]*100,color:["#2f7bff","#a040ff","#ff9a2e"][y],label:p.name})),xMax:300,yMax:40,yFmt:p=>be(p,0)+"%",marker:u,xLabel:b("descubrimiento","discovery","尋寶率")}),read:u=>Re.map((p,y)=>`<span class="wk-q $ {
    p.cls
  }
  ">${p.name} ${Xe(ub(u/100)[y],1)}</span>`).join(" "),note:Pe(b("El descubrimiento hace que cada calidad pese más cuanto más alta es (mejoras de skill, objetos de cofre y botín). Rinde cada vez menos: d / (1 + d), y nunca llega a doblar el peso de cada escalón.","Discovery makes higher qualities weigh more (skill upgrades, chest items and loot). It has diminishing returns: d / (1 + d), and never quite doubles each step’s weight.","尋寶率讓較高品質的權重更高（技能強化、寶箱道具與戰利品）。收益遞減：d / (1 + d)，每一階的權重永遠不會完全翻倍。"))},exp:{max:8,label:b("Niveles por encima del monstruo","Levels above the monster","高於怪物的等級"),draw:u=>Lo({series:[{fn:p=>Ep(Math.round(p)+10,10)*100,color:Us.violet,label:b("EXP que da","EXP granted","獲得經驗")}],xMax:8,yMax:100,yFmt:p=>be(p,0)+"%",marker:u,xLabel:b("niveles de más","levels above","高出等級")}),read:u=>`+${u} ${b("niveles","levels","等級")} → <b>${Xe(Ep(u+10,10),1)}</b> ${b("de la EXP","of the EXP","的經驗")}`,note:Pe(b(`Por cada nivel que tu Base Lv supere al del monstruo, su EXP (base y de job) se queda en el ${Xe(du)}, nunca por debajo del 1%. Los monstruos de más nivel dan su EXP entera. Por eso cada stage solo sirve para subir hasta poco más del nivel de sus monstruos.`,`For every level your Base Lv is above the monster, its EXP (base and job) is multiplied by ${Xe(du)}, never below 1%. Higher-level monsters give full EXP. That’s why each stage only levels you up to a little past its monsters.`,`你的基本 Lv 每比怪物高一級，牠的經驗（基本與職業）就乘以 ${Xe(du)}，最低 1%。等級更高的怪物給完整經驗。所以每個關卡只會讓你升到比其怪物稍高一點。`))}},d=()=>{const u=l[r],p=+t.value;s.textContent=u.label,a.querySelector("#wk-cv-v").textContent=t.value,e.innerHTML=u.draw(p),n.innerHTML=u.read(p)},h=u=>{r=u;const p=l[u];t.max=String(p.max),t.value=String(Math.round(p.max/3)),o.innerHTML=p.note,a.querySelectorAll("[data-curve]").forEach(y=>y.classList.toggle("active",y.dataset.curve===u)),d()};a.querySelectorAll("[data-curve]").forEach(u=>u.onclick=()=>h(u.dataset.curve)),t.oninput=d,h("haste")}};function ub(a){const e=a/(1+a),t=Re.map((n,o)=>n.weight*Math.pow(1+e,o)),s=t.reduce((n,o)=>n+o,0);return t.map(n=>n/s)}const q_={id:"survival",name:()=>b("Defensa y estados","Defense & statuses","防禦與狀態"),sub:()=>b("Daño recibido, curación, estados","Damage taken, healing, statuses","受到傷害、治療、狀態"),face:()=>oo("🛡️"),render:()=>{const a=[["💫",b("Aturdir","Stun","暈眩"),b("El monstruo se queda quieto sin atacar. Los jefes no se aturden.","The monster stands still without attacking. Bosses can’t be stunned.","怪物停在原地不攻擊。頭目無法被暈眩。")],["❄️",b("Congelar","Freeze","冰凍"),b("Lo deja helado sin moverse. Los jefes no se congelan. Algunas skills pegan más a los congelados.","Frozen solid in place. Bosses can’t be frozen. Some skills deal extra damage to frozen targets.","被凍在原地。頭目無法被冰凍。部分技能對冰凍目標造成額外傷害。")],["🐢",b("Ralentizar","Slow","緩速"),b("Anda más despacio. Funciona también con los jefes.","Moves slower. Works on bosses too.","移動變慢。對頭目也有效。")],["🌫️",b("Cegar","Blind","致盲"),b("Se desorienta y deja de perseguirte bien.","Gets disoriented and can’t chase you properly.","迷失方向，無法好好追你。")],["☠️",b("Veneno","Poison","毒"),b("Daño en el tiempo. Los venenos de skills distintas no se suman: solo hace daño el más fuerte, salvo con talentos que digan lo contrario.","Damage over time. Poisons from different skills don’t stack: only the strongest ticks, unless a talent says otherwise.","持續傷害。不同技能的毒不會疊加：只有最強的會生效，除非天賦另有說明。")],["🔥",b("Quemadura","Burn","燃燒"),b("Daño de fuego en el tiempo durante 10 s.","Fire damage over 10 s.","10 秒內持續造成火焰傷害。")],["🩸",b("Sangrado","Bleed","流血"),b("Reparte parte del daño del golpe en 3 s.","Spreads part of the hit’s damage over 3 s.","將該擊的部分傷害分攤在 3 秒內。")],["🗿",b("Petrificar","Petrify","石化"),b("Lo convierte en piedra; con talentos, los petrificados reciben más daño.","Turns it to stone; with talents, petrified targets take extra damage.","使目標石化；搭配天賦時，石化目標會受到額外傷害。")],["↔️",b("Empujar","Knockback","擊退"),b("Lo aparta de ti. Los jefes no se empujan.","Pushes it away. Bosses can’t be pushed.","把目標推開。頭目無法被推開。")]];return`${vt(b("Aguantar la horda","Holding the horde","撐住怪物群"),b("Cómo se reduce el daño que recibes","How incoming damage is reduced","受到的傷害如何減免"),b("Mecánicas","Mechanics","機制"),{tone:"wk-tone-green"})}
      ${me(b("Daño que recibes","Damage you take","你受到的傷害"),tn(b("daño = máx(1, (golpe − armadura) × (1 − reducción) × (1 − DEF%))","damage = max(1, (hit − armor) × (1 − reduction) × (1 − DEF%))","傷害 = max(1, (打擊 − 護甲) × (1 − 減免) × (1 − DEF%))"))+Pe(b("Antes de nada se tira el <b>Flee</b>: si esquivas, el golpe no hace nada (verás «Miss»). Después la <b>armadura</b> resta un número fijo a cada golpe (muy fuerte contra monstruos débiles), la <b>reducción</b> quita un porcentaje (tope 60%) y la <b>DEF</b> del equipo otro porcentaje aparte.","First <b>Flee</b> is rolled: if you dodge, the hit does nothing (you’ll see “Miss”). Then <b>armor</b> subtracts a flat amount from every hit (great against weak monsters), <b>reduction</b> removes a percentage (60% cap) and gear <b>DEF</b> removes another percentage on top.","首先判定<b>迴避</b>：閃避成功時該擊無效（會看到「Miss」）。接著<b>護甲</b>從每一擊扣除固定數值（對付弱怪很有效），<b>減免</b>扣除一定比例（上限 60%），裝備 <b>DEF</b> 再額外扣除一定比例。"))+`<div class="wk-hit">${gs("wk-d-hit",b("Golpe del monstruo","Monster hit","怪物打擊"),5,400,80)}${gs("wk-d-arm",b("Armadura","Armor","護甲"),0,30,2)}${gs("wk-d-red",b("Reducción (%)","Reduction (%)","減免（%）"),0,60,10)}${gs("wk-d-def","DEF",0,150,20)}${gs("wk-d-flee","Flee (%)",0,50,5)}<div id="wk-d-out" class="wk-hit-out"></div></div>`)}
      ${me(b("Curarse","Healing","治療"),ns([b("Fuente","Source","來源"),b("Cómo","How","方式")],[[b("Regeneración","Regeneration","回復"),b("0,1 HP/s por punto de VIT, más la de equipo y cofres (algunas solo quieto o solo moviéndote)","0.1 HP/s per VIT point, plus gear and chests (some only while standing still or moving)","每點 VIT 0.1 HP/秒，加上裝備與寶箱（部分僅限站立或移動時）")],[b("Carne","Meat","肉"),b("Cura un 15% de la vida máxima (mínimo 30). La sueltan un 1,5% de los monstruos, las élites siempre y los jefes una doble. Si llevas 45 s sin carne y vas mal de vida, la siguiente muerte la suelta seguro.","Heals 15% of max HP (min 30). Dropped by 1.5% of monsters, always by elites and doubled by bosses. After 45 s without meat at low HP, the next kill is guaranteed to drop one.","回復最大 HP 的 15%（至少 30）。1.5% 的怪物會掉落，菁英必定掉落，頭目掉落兩份。低 HP 且 45 秒沒吃到肉時，下一次擊殺必定掉落。")],[b("Subir de nivel","Level up","升級"),b("Cada nivel de partida cura un 30% de la vida máxima.","Each run level heals 30% of max HP.","每升一級本局等級回復最大 HP 的 30%。")],[b("Robo de vida","Lifesteal","吸血"),b("Cura una parte del daño que haces, hasta un 3% de tu vida por segundo.","Heals part of the damage you deal, up to 3% of your HP per second.","回復部分造成的傷害，每秒最多回復 HP 的 3%。")],[b("Revivir","Revive","復活"),b("Algunos objetos y talentos te levantan con toda la vida una vez por partida.","Some items and talents bring you back at full HP once per run.","部分道具與天賦能讓你每局滿血復活一次。")]])+Ut(b("La VIT también sube la curación de la carne un 2% por punto.","VIT also increases meat healing by 2% per point.","VIT 也會讓肉的治療量每點提高 2%。")))}
      ${me(b("Estados alterados","Status effects","狀態效果"),`<div class="wk-grid3">${a.map(([e,t,s])=>`<div class="wk-mini"><span>${e}</span><b>${t}</b><small>${s}</small></div>`).join("")}</div>`)}
      ${me(b("Los jefes avisan","Bosses telegraph","頭目會預告"),Pe(b("Las skills de los minijefes y MVP marcan en el suelo la zona roja que van a golpear y la rellenan desde dentro: cuando se llena, golpea a quien siga dentro. Los monstruos a distancia hacen lo mismo con un círculo a tus pies, y las flechas se esquivan saliendo de su línea.","Mini boss and MVP skills mark the red area they will hit and fill it from the inside: when it’s full, it hits anyone still inside. Ranged monsters do the same with a circle at your feet, and arrows can be dodged by stepping out of their line.","小頭目與 MVP 的技能會標示即將命中的紅色區域，並從內部逐漸填滿：填滿時仍在裡面的人會被擊中。遠程怪物會在你腳下標示圓圈，箭矢則可以走出其射線來閃避。")))}`},bind:a=>{const e=["wk-d-hit","wk-d-arm","wk-d-red","wk-d-def","wk-d-flee"],t=a.querySelector("#wk-d-out"),s=()=>{const n=r=>+a.querySelector(`#${r}`).value;for(const r of e)a.querySelector(`#${r}-v`).textContent=String(n(r));const o=Math.max(1,Math.round((n("wk-d-hit")-n("wk-d-arm"))*(1-n("wk-d-red")/100)*(1-Uo(n("wk-d-def"))))),i=o*(1-n("wk-d-flee")/100);t.innerHTML=`<div class="wk-hit-big"><small>${b("Por golpe que entra","Per landed hit","每次命中")}</small><b>${o}</b></div><div class="wk-hit-big good"><small>${b("Media contando el Flee","Average with Flee","計入迴避的平均")}</small><b>${be(i,1)}</b></div><div class="wk-hit-note">${b("Te quitas","You avoid","你閃避了")} ${Xe(1-i/n("wk-d-hit"),0)} ${b("del daño","of the damage","的傷害")}</div>`};for(const n of e)a.querySelector(`#${n}`).oninput=s;s()}};let hp="swordsman";const I_={id:"skills",name:()=>b("Skills","Skills","技能"),sub:()=>b("Tipos, mejoras y todas las skills","Types, upgrades and every skill","類型、強化與所有技能"),face:()=>Fe(so(ce.bash.icon)),render:()=>{const a={dmg:b("daño","damage","傷害"),cd:b("enfriamiento","cooldown","冷卻"),area:b("área","area","範圍"),reach:b("alcance","reach","攻擊範圍"),count:b("cantidad","count","數量"),targets:b("objetivos","targets","目標"),pierce:b("probabilidad de perforar","pierce chance","貫穿機率"),speed:b("velocidad","speed","速度"),duration:b("duración","duration","持續時間"),effect:b("efecto","effect","效果")},e=Object.entries(Tl).map(([,s])=>[`<b>${c(s.label)}</b>`,s.aspects.map(n=>a[n]).join(" · ")]),t=ya([...Tt,...As]);return`${vt(b("Skills","Skills","技能"),b("Se consiguen y se mejoran subiendo de nivel en la partida","Earned and upgraded by leveling up during the run","在本局中升級時取得並強化"),b("Combate","Combat","戰鬥"),{tone:"wk-tone-blue"})}
      ${me(b("Cómo funcionan","How they work","運作方式"),Pe(b(`Cada partida empiezas solo con el ataque básico de tu arma. Al subir de nivel salen skills de tu job hasta llenar <b>${Ds} huecos</b> (${Ds+1} en 2nd job); a partir de ahí, las cartas mejoran las que tienes. Las skills no tienen nivel máximo: cada carta de mejora que coges sube un aspecto de la skill (daño, enfriamiento, área…) según la calidad de la carta, y como el daño no tiene tope, siempre hay algo que mejorar. La skill emblemática de tu job sale en la primera elección.`,`Each run you start with just your weapon’s basic attack. Leveling up offers your job’s skills until <b>${Ds} slots</b> are full (${Ds+1} as a 2nd job); after that, cards upgrade the ones you have. Skills have no max level: each upgrade card you take improves one aspect of the skill (damage, cooldown, area…) according to the card’s quality, and since damage has no cap, there is always something to improve. Your job’s signature skill appears in the first pick.`,`每局一開始你只有武器的普通攻擊。升級時會提供你職業的技能，直到 <b>${Ds} 個欄位</b>填滿（二轉 ${Ds+1} 個）；之後卡片會強化你已有的技能。技能沒有等級上限：每張強化卡片會依卡片品質提升技能的一個面向（傷害、冷卻、範圍……），而且傷害沒有上限，所以永遠有東西可以強化。你職業的招牌技能會出現在第一次選擇中。`))+Pe(b("Las skills se lanzan solas cuando se enfrían y tienen un objetivo. Las que tienen casteo marcan a su objetivo (o un círculo en el suelo si son zonales) mientras cargan. Las élites y los jefes tienen prioridad: las skills van a por ellos primero si están a su alcance.","Skills fire on their own when off cooldown and a target is available. Skills with a cast lock onto their target (or show a ground circle for area skills) while charging. Elites and bosses take priority: skills go for them first when in range.","技能冷卻結束且有目標時會自動施放。需要詠唱的技能在蓄力時會鎖定目標（範圍技能會在地面顯示圓圈）。菁英與頭目優先：在射程內時技能會先打牠們。")))}
      ${me(b("Mejoras según el tipo de skill","Upgrades by skill type","依技能類型的強化"),ns([b("Tipo","Type","類型"),b("Qué puede mejorar","What can improve","可強化的項目")],e)+Pe(b("Además, muchas skills mejoran sus efectos propios: la probabilidad de aturdir de Bash, la ralentización de Cold Bolt, la fuerza de un buff…","Many skills also improve their own effects: Bash’s stun chance, Cold Bolt’s slow, a buff’s strength…","許多技能也會強化自身的效果：狂擊的暈眩機率、冰箭術的緩速、增益的強度…"))+Ut(b(`<b>Proyectiles:</b> el ataque básico a distancia (arco, vara, instrumento…) y Arrow Repel tienen como mucho <b>+${md} proyectiles por cartas</b>, que salen de uno en uno y siempre en carta blanca. El ataque infusionado del Mage no tiene cartas de +proyectil. Los Deity, los talentos y el equipo van aparte, y los +objetivos no tienen tope.<br><b>Perforación:</b> es una probabilidad. Cada carta da del 2% (común) al 10% (legendaria) y el Archer con arco tiene un 20% de base. Cada enemigo atravesado es otra tirada, así que un disparo puede atravesar a varios seguidos. Sumándolo todo, la probabilidad tiene un tope del 75%. Las skills que ya atraviesan a todos no cambian.`,`<b>Projectiles:</b> ranged basic attacks (bow, rod, instrument…) and Arrow Repel get at most <b>+${md} projectiles from cards</b>, one at a time and always as a common card. The Mage’s infused attack has no +projectile cards. Deity, talents and gear are separate, and +targets have no cap.<br><b>Pierce:</b> it is a chance. Each card gives 2% (common) to 10% (legendary) and Archer with a bow has 20% base. Every enemy pierced is a new roll, so one shot can pass through several in a row. With everything added up, the chance is capped at 75%. Skills that already pass through everything are unchanged.`,`<b>投射物：</b>遠程普通攻擊（弓、法杖、樂器……）與衝鋒箭從卡片最多只能獲得 <b>+${md} 投射物</b>，每次一個，永遠是普通卡片。魔法師的附魔攻擊沒有 +投射物 卡片。神祇、天賦與裝備另計，+目標沒有上限。<br><b>貫穿：</b>是機率。每張卡片提供 2%（普通）到 10%（傳說），持弓的弓箭手基礎有 20%。每貫穿一個敵人都會重新判定，所以一發射擊可以連續穿過好幾個敵人。全部加總後機率上限為 75%。本來就會穿過一切的技能不變。`)))}
      ${me(b("Todas las skills","Every skill","所有技能"),`<div class="wk-jobpick">${t.map(s=>`<button class="wk-jobbtn$ {
    s.key===hp?" sel":""
  }
  $ {
    s.job.rank===2?" dev":""
  }
  " data-sjob="$ {
    s.key
  }
  " title="$ {
    s.name
  }
  ">${Fe(s.icon)}<small>${s.name}</small></button>`).join("")}</div><div id="wk-skill-list" class="wk-skill-list"></div>`)}`},bind:a=>{const e=a.querySelector("#wk-skill-list"),t=()=>{const s=Tx(hp),n=s.job,o=tr[n.id]??Th[n.id]??[];e.innerHTML=o.length?o.map(i=>{const r=ce[i];if(!r)return"";const l=(r.tags??[]).filter(h=>h!=="basic").map(h=>`<span class="wk-tag">${c(tw[h]??h)}</span>`).join(""),d=kh(i,fs(n));return`<div class="wk-skill" data-sk="$ {
    i
  }
  ">
                <div class="wk-skill-head">${Fe(so(r.icon))}<div><b>${r.name}</b><small>${r.type?c(Tl[r.type].label):""}${d?" · "+d:""}</small></div></div>
                <div class="wk-tags">${l}</div>
                <div class="wk-skill-desc">${r.desc(1)}</div>
              </div>`}).join(""):`<div class="stg-empty">${b("Este job aún no tiene skills propias.","This job has no skills of its own yet.","此職業目前還沒有專屬技能。")}</div>`,n.base&&e.insertAdjacentHTML("afterbegin",Ut(`${fh()} ${b(`${s.name} conserva todas las skills de ${ge(n.base).name} y aprende estas en sus árboles de talentos. Los 2nd jobs aún están en desarrollo: sus skills pueden cambiar.`,`${s.name} keeps every ${ge(n.base).name} skill and learns these from its talent trees. 2nd jobs are still in development: their skills may change.`,`${s.name}保留${ge(n.base).name}的所有技能，並從天賦樹學會以下技能。二轉仍在開發中：其技能可能會調整。`)}`))};a.querySelectorAll("[data-sjob]").forEach(s=>{s.onclick=()=>{hp=s.dataset.sjob,a.querySelectorAll("[data-sjob]").forEach(n=>n.classList.toggle("sel",n===s)),t()}}),t()}};function pb(a){var e;return so(`job_${a.id}`)||so(((e=ce[a.start])==null?void 0:e.icon)??"")}const Yf=a=>a.tier!=="extended";function ya(a){return a.filter(Yf).flatMap(e=>{const t={key:e.id,job:e,name:e.name,icon:pb(e),desc:e.desc};return e.nameF?[{...t,desc:b("Con personaje chico. Canciones con instrumento que te refuerzan y desconciertan a la horda. Comparte skills y árboles con la Dancer.","For male characters. Songs played on an instrument that empower you and confuse the horde. Shares skills and trees with the Dancer.","男性角色專用。以樂器演奏歌曲，強化你並迷惑怪物群。與舞孃共用技能與天賦樹。")},{key:"dancer",job:e,name:e.nameF,icon:so("job_dancer")||pb(e),desc:b("Con personaje chica. Danzas con látigo que te refuerzan y desconciertan a la horda. Comparte skills y árboles con el Bard.","For female characters. Whip dances that empower you and confuse the horde. Shares skills and trees with the Bard.","女性角色專用。以鞭子跳舞，強化你並迷惑怪物群。與吟遊詩人共用技能與天賦樹。")}]:[t]})}const Tx=a=>ya([...Tt,...As]).find(e=>e.key===a)??ya(Tt)[0],R_=a=>ya(no(a.id)).map(e=>e.name),fh=()=>`<span class="wk-dev">🛠️ ${b("En desarrollo","In development","開發中")}</span>`,B_={id:"quality",name:()=>b("Calidades","Qualities","品質"),sub:()=>b("De común a legendario","From common to legendary","從普通到傳說"),face:()=>`<span class="wk-qdots">${Re.map(a=>`<i class="$ {
    a.cls
  }
  "></i>`).join("")}</span>`,render:()=>{const a=Re.reduce((e,t)=>e+t.weight,0);return`${vt(b("Calidades","Qualities","品質"),b("Los mismos cinco colores para todo lo que sale","The same five colours for everything you find","你找到的所有東西都使用相同的五種顏色"),b("Botín","Loot","戰利品"),{tone:"wk-tone-violet"})}
      ${me(b("Las cinco calidades","The five qualities","五種品質"),`<div class="wk-qrow">${Re.map(e=>`<div class="wk-qcard $ {
    e.cls
  }
  "><b>${e.name}</b><span class="wk-qbar"><i style="width:$ {
    e.weight/Re[0].weight*100
  }
  %"></i></span><small>${b("Probabilidad","Chance","機率")} <b>${Xe(e.weight/a,1)}</b></small><small>${b("Mejora de skill","Skill upgrade","技能強化")} <b>×${be(e.mult,2)}</b></small><small>${b("ATK/MATK del arma","Weapon ATK/MATK","武器 ATK/MATK")} <b>×${be(e.baseMult,2)}</b></small></div>`).join("")}</div>`)}
      ${me(b("Dónde se usan","Where they apply","適用範圍"),ns([b("Qué","What","項目"),b("Qué cambia la calidad","What quality changes","品質會改變什麼")],[[b("Mejoras de skill","Skill upgrades","技能強化"),b("Multiplica lo que sube la mejora. Las legendarias son dos mejoras a la vez (una épica y otra rara). En lo que va por unidades (objetivos, proyectiles): +1, +2 en épica y +3 en legendaria, salvo los +proyectiles con tope, que siempre salen de uno en uno en carta blanca. La probabilidad de perforar va del 2% en común al 10% en legendaria.","Multiplies how much the upgrade adds. Legendary ones are two upgrades at once (one epic and one rare). For whole numbers (targets, projectiles): +1, +2 for epic and +3 for legendary, except capped +projectiles, which always come one at a time as a common card. Pierce chance goes from 2% at common to 10% at legendary.","讓強化的加成倍增。傳說強化等於一次兩個強化（一個史詩加一個稀有）。整數類（目標、投射物）：普通 +1、史詩 +2、傳說 +3；但有上限的 +投射物例外，永遠以普通卡片一次 +1。貫穿機率從普通的 2% 到傳說的 10%。")],[b("Objetos de cofre","Chest items","寶箱道具"),b("Dentro del rango de cada objeto, común da el mínimo y legendario el máximo.","Within each item’s range, common gives the minimum and legendary the maximum.","在各道具的範圍內，普通給最小值，傳說給最大值。")],[b("Equipo","Gear","裝備"),b("Más affixes (ver Equipo) y algo más de ATK/MATK en las armas.","More affixes (see Gear) and slightly more ATK/MATK on weapons.","更多詞綴（見「裝備」），武器的 ATK/MATK 也略高。")]])+Ut(b("Los jefes nunca sueltan piezas comunes.","Bosses never drop common pieces.","頭目永遠不會掉落普通品質的裝備。")))}`}},N_={id:"run",name:()=>b("La partida","The run","本局"),sub:()=>b("Élites, hordas, cofres y dificultad","Elites, hordes, chests and difficulty","菁英、怪物群、寶箱與難度"),face:()=>oo("🎁"),render:()=>{const a=s=>Math.round(30+25*s+1.5*s*s),e=s=>Eo.melee.includes(s)?`<em class="wk-build">${b("Solo con golpes cuerpo a cuerpo","Melee builds only","僅限近戰配置")}</em>`:Eo.dot.includes(s)?`<em class="wk-build">${b("Solo si ya has envenenado, quemado o hecho sangrar","Only after poisoning, burning or bleeding","需先造成中毒、燃燒或流血")}</em>`:"",t=Vn.filter(s=>s.id!=="deity").map(s=>{const n=Object.values(on).filter(o=>o.slot===s.id);return me(`${s.name} <span class="wk-count">${n.length}</span>`,`<div class="wk-items">${n.map(o=>`<div class="wk-item">${Fe(o.img?new URL(`assets/${o.img}`,document.baseURI).href:Me(o.icon))}<div><b>${c(o.name)}</b><small>${o.text(o.range[0])} → ${o.text(o.range[1])}</small>${e(o.id)}</div></div>`).join("")}</div>`,"wk-slot-box")});return`${vt(b("Dentro de la partida","Inside a run","本局之中"),b("Lo que pasa durante los minutos de cada stage","What happens during each stage’s minutes","每個關卡的那幾分鐘內會發生什麼"),b("Partida","Run","本局"),{art:Ws("payon"),tone:""})}
      ${me(b("El ritmo","The rhythm","節奏"),`<div class="wk-grid3">
        <div class="wk-mini"><span>⭐</span><b>${b("Élites cada 45 s","Elites every 45 s","每 45 秒出現菁英")}</b><small>${b("Monstruos más grandes y duros. Siempre sueltan un cofre y carne.","Bigger, tougher monsters. They always drop a chest and meat.","更大更強的怪物。必定掉落寶箱與肉。")}</small></div>
        <div class="wk-mini"><span>🌀</span><b>${b("Hordas cada 2 min","Hordes every 2 min","每 2 分鐘出現怪物群")}</b><small>${b("Un círculo de monstruos te rodea y se cierra despacio: ábrete paso antes de que te atrape.","A ring of monsters surrounds you and closes in slowly: break out before it catches you.","一圈怪物包圍你並慢慢收攏：在被困住前突圍。")}</small></div>
        <div class="wk-mini"><span>👑</span><b>${b("Jefes","Bosses","頭目")}</b><small>${b("Minijefes a su minuto y el MVP al final. Sueltan equipo, cartas y huevos de pet.","Mini bosses on schedule and the MVP at the end. They drop gear, cards and pet eggs.","小頭目按時出現，MVP 在最後登場。會掉落裝備、卡片與寵物蛋。")}</small></div>
        <div class="wk-mini"><span>🧲</span><b>${b("Imán","Magnet","磁鐵")}</b><small>${b("Atrae todas las gemas del mapa. Muy raro en monstruos normales; las élites, un 10%.","Pulls every gem on the map. Very rare from normal monsters; elites drop it 10% of the time.","吸取地圖上所有寶石。一般怪物極少掉落；菁英有 10% 機率。")}</small></div>
        <div class="wk-mini"><span>💰</span><b>Zeny</b><small>${b("Lo sueltan los monstruos y solo sirve dentro de la partida: para abrir cofres.","Dropped by monsters and only used inside the run: to open chests.","由怪物掉落，只在本局中使用：用來開寶箱。")}</small></div>
        <div class="wk-mini"><span>📈</span><b>${b("Más vida con el tiempo","More HP over time","血量隨時間成長")}</b><small>${b("Los monstruos normales doblan su vida cada pocos minutos: tu build tiene que crecer al mismo ritmo.","Normal monsters double their HP every few minutes: your build has to grow at the same pace.","一般怪物每隔幾分鐘血量就會翻倍：你的配置也得以相同速度成長。")}</small></div>
      </div>`)}
      ${me(b("Cofres","Chests","寶箱"),Pe(b("Al abrir un cofre salen tres opciones de huecos distintos. Si el hueco está vacío puede salir cualquiera de sus objetos; si ya tiene uno, solo ese, para refinarlo (sin tope). Cada cofre cuesta más que el anterior:","Opening a chest offers three options from different slots. An empty slot can offer any of its items; a filled slot only offers that item again, to refine it (no cap). Each chest costs more than the last:","開啟寶箱會提供三個不同欄位的選項。空欄位可能出現該欄位的任何道具；已有道具的欄位只會再次出現該道具，用來精煉（無上限）。每個寶箱都比上一個貴："))+tn(b("coste = 30 + 25·n + 1,5·n² zeny (n = cofres ya abiertos)","cost = 30 + 25·n + 1.5·n² zeny (n = chests already opened)","費用 = 30 + 25·n + 1.5·n² 金幣（n = 已開啟的寶箱數）"))+Uh([1,2,3,5,10,15,20].map(s=>[`#${s}`,`${a(s-1).toLocaleString(Gi())} z`]))+Ut(b("Las élites sueltan cofre siempre y los monstruos normales, muy de vez en cuando (0,25%).","Elites always drop a chest and normal monsters very rarely do (0.25%).","菁英必定掉落寶箱，一般怪物極少掉落（0.25%）。"))+Ut(b("El cofre no ofrece lo que no te sirve: el alcance solo sale si tu ataque básico o alguna skill pega cuerpo a cuerpo, el daño en el tiempo solo cuando en la partida ya has envenenado, quemado o hecho sangrar a alguien, la rapidez de casteo solo si alguna skill que llevas castea, la STR solo con daño físico y la INT solo con magia o curas.","Chests don’t offer what you can’t use: reach only shows up if your basic attack or a skill hits in melee, damage over time only once you have poisoned, burned or bled something this run, cast speed only if one of your skills has a cast time, STR only with physical damage and INT only with magic or healing.","寶箱不會提供你用不到的東西：只有當普通攻擊或某技能是近戰時才會出現攻擊範圍，持續傷害只在本局中你已造成中毒、燃燒或流血後才會出現，詠唱速度只在你有需要詠唱的技能時出現，STR 只在有物理傷害時出現，INT 只在有魔法或治療時出現。"),"good"))}
      ${t.join("")}
      ${me('Deity <span class="wk-count">★</span>',Pe(b("Los Deity transforman una skill que ya has aprendido en la partida: cambian cómo funciona y siempre son legendarios. Cada vez que vuelve a salir se refina y mejora. Solo salen de skills que llevas.","Deity transform a skill you have learned this run: they change how it works and are always legendary. Each time it shows up again it gets refined and improves. They only appear for skills you have.","神祇會改造你本局已學會的技能：改變其運作方式，且永遠是傳說品質。每次再出現都會精煉並強化。只會為你擁有的技能出現。")),"wk-deity")}
      ${me(b("Mejoras del roll (Cronista)","Roll perks (Chronicler)","抽卡特權（事蹟記錄者）"),`<div class="wk-items">${si.map(s=>`<div class="wk-item"><span class="wk-emoji sm">${L_[s.id]??"✨"}</span><div><b>${c(s.name)}</b><small>${c(s.desc)} ${b(`Hasta ${s.cost.length} ${s.cost.length>1?"usos":"uso"} por partida.`,`Up to ${s.cost.length} ${s.cost.length>1?"uses":"use"} per run.`,`每局最多 ${s.cost.length} 次。`)}</small></div></div>`).join("")}</div>`)}
      ${me(b("Dificultad","Difficulty","難度"),Pe(b("Antes de salir puedes subir la dificultad. Cada control endurece un aspecto de los monstruos y se lleva una parte igual del premio: con todo al máximo, el botín se dobla.","Before leaving you can raise the difficulty. Each slider toughens one aspect of the monsters and gives an equal share of the reward: with everything maxed, loot is doubled.","出發前可以提高難度。每個滑桿強化怪物的一個面向，並平均分配獎勵：全部拉滿時，戰利品加倍。"))+ns([b("Control","Slider","滑桿"),b("Rango","Range","範圍"),b("Botín extra al máximo","Extra loot at max","拉滿時的額外戰利品")],Ko.map(s=>[s.name,`×${be(s.min,1)} – ×${be(s.max,1)}`,"+"+Xe(1/Ko.length)])))}`}};let up="swordsman";const O_={id:"jobs",name:()=>b("Jobs","Jobs","職業"),sub:()=>b(`${ya([...Tt,...As]).length} jobs: 1st y 2nd job`,`${ya([...Tt,...As]).length} jobs: 1st and 2nd`,`${ya([...Tt,...As]).length} 種職業：一轉與二轉`),face:()=>Fe(so("job_knight")),render:()=>{const a=e=>`<button class="wk-job$ {
    e.key===up?" sel":""
  }
  $ {
    e.job.rank===2?" dev":""
  }
  " data-job="$ {
    e.key
  }
  ">${e.job.rank===2?`<span class="wk-dev-tag">${b("En desarrollo","In development","開發中")}</span>`:""}${Fe(e.icon)}<b>${e.name}</b><small>${mb(e.job)}</small></button>`;return`${vt(b("Jobs","Jobs","職業"),b("Del 1st job al 2nd job en el Castillo de Prontera","From 1st job to 2nd job at Prontera Castle","在普隆德拉城從一轉晉升二轉"),b("Personaje","Character","角色"),{art:Ws("prt_castle")})}
      ${me(b("1st jobs","1st jobs","一轉職業"),`<div class="wk-jobs">${ya(Tt).map(a).join("")}</div>`)}
      ${me(`${b("2nd jobs","2nd jobs","二轉職業")} ${fh()}`,Ut(b("Los 2nd jobs están en desarrollo: sus skills, talentos y valores pueden cambiar antes de publicarse.","2nd jobs are in development: their skills, talents and values may change before release.","二轉職業仍在開發中：技能、天賦與數值在正式推出前可能變動。"),"warn")+`<div class="wk-jobs">${ya(As).map(a).join("")}</div>`+Pe(b(`Con <b>Job Lv ${fa[1]}</b> se abre la historia del Castillo de Prontera, donde se asciende a 2nd job. Cada 1st job puede elegir entre dos. Bard y Dancer son el mismo job: Bard con personaje chico y Dancer con chica. El 2nd job conserva el árbol y las skills de su 1st job, suma sus propios árboles con ${fa[2]} puntos más, tiene entre ×2 y ×3 la vida y un hueco de skill más, y su ATK/MATK rinde mucho más.`,`At <b>Job Lv ${fa[1]}</b> the Prontera Castle story opens, where you advance to a 2nd job. Each 1st job chooses between two. Bard and Dancer are the same job: Bard for male characters and Dancer for female ones. The 2nd job keeps its 1st job’s tree and skills, adds its own trees with ${fa[2]} more points, has ×2 to ×3 the HP and one more skill slot, and its ATK/MATK is worth much more.`,`<b>職業 Lv ${fa[1]}</b> 時會開放普隆德拉城的劇情，在那裡完成二轉。每個一轉職業可以在兩個之間選擇。吟遊詩人與舞孃是同一個職業：男性角色為吟遊詩人，女性角色為舞孃。二轉保留一轉的天賦樹與技能，加入自己的天賦樹並多 ${fa[2]} 點，HP 為 ×2 到 ×3，多一個技能欄位，ATK/MATK 的價值也高很多。`)))}
      <div id="wk-job-detail"></div>`},bind:a=>{const e=a.querySelector("#wk-job-detail"),t=()=>{var d;const s=Tx(up),n=s.job,o=[...n.base?tr[n.base]??[]:[],...tr[n.id]??Th[n.id]??[]],i=Math.max(...[...Tt,...As].filter(Yf).map(h=>h.hp)),r=(h,u,p,y)=>`<div class="wk-bar"><span>${h}</span><i><em style="width:$ {
    Math.min(100,u/p*100)
  }
  %"></em></i><b>${y}</b></div>`,l=R_(n);e.innerHTML=me(`${s.name}${n.rank===2?" "+fh():""}`,`<div class="wk-jobd">
          <div class="wk-jobd-face">${Fe(s.icon)}</div>
          <div class="wk-jobd-info"><p class="wk-p">${s.desc}</p>
            ${r(b("Vida","HP","HP"),n.hp,i,String(n.hp))}
            ${r(b("Velocidad","Speed","速度"),n.speed,180,String(n.speed))}
            ${r(b("Armadura","Armor","護甲"),n.armor,2,String(n.armor))}
            ${Uh([[b("Escala con","Scales with","成長依據"),mb(n)],[b("Skill inicial","Starting skill","初始技能"),((d=ce[n.start])==null?void 0:d.name)??"—"],...n.base?[[b("Viene de","Comes from","轉職自"),ge(n.base).name]]:[],...l.length?[[b("Asciende a","Advances to","晉升為"),l.join(" / ")]]:[],...n.mount?[[b("Montura","Mount","坐騎"),"Peco Peco"]]:[]])}
          </div>
        </div>
        <div class="wk-skillicons">${o.map(h=>ce[h]?`<span title="$ {
    ce[h].name
  }
  ">${Fe(so(ce[h].icon))}<small>${ce[h].name}</small></span>`:"").join("")}</div>`,"wk-job-box")};a.querySelectorAll("[data-job]").forEach(s=>{s.onclick=()=>{up=s.dataset.job,a.querySelectorAll("[data-job]").forEach(n=>n.classList.toggle("sel",n===s)),t(),e.scrollIntoView({behavior:"smooth",block:"nearest"})}}),t()}};function mb(a){return a.scaling==="melee"?b("Cuerpo a cuerpo · STR","Melee · STR","近戰 · STR"):a.scaling==="ranged"?b("A distancia · DEX","Ranged · DEX","遠程 · DEX"):b("Mágico · INT","Magic · INT","魔法 · INT")}const D_={id:"progress",name:()=>b("Niveles y talentos","Levels & talents","等級與天賦"),sub:()=>b("Base Lv, Job Lv y árboles","Base Lv, Job Lv and trees","基本等級、職業等級與天賦樹"),face:()=>oo("🌳"),render:()=>{const a=[1,5,10,15,20,30,40,50,70,98].map(t=>[String(t),Go(t).toLocaleString(Gi())]),e=Se.filter(t=>{var s;return((s=et[t.id])==null?void 0:s.jobCap)&&!t.storyOnly}).map(t=>[t.name,`Job Lv ${et[t.id].jobCap}`]);return`${vt(b("Crecer con el personaje","Growing your character","培養你的角色"),b("Lo que se queda entre partidas","What stays between runs","局與局之間保留的東西"),b("Progreso","Progress","成長"),{tone:"wk-tone-green"})}
      ${me(b("Dos niveles distintos","Two different levels","兩種不同的等級"),`<div class="wk-trio">
        <div class="wk-trio-c melee"><b>🧍 Base Lv</b><small>${b("Hasta 99. Da puntos de estado para STR, AGI, VIT, INT, DEX y LUK. Su EXP crece de forma exponencial, como en RO.","Up to 99. Grants status points for STR, AGI, VIT, INT, DEX and LUK. Its EXP grows exponentially, like RO.","最高 99。提供 STR、AGI、VIT、INT、DEX 與 LUK 的素質點數。所需經驗呈指數成長，與 RO 相同。")}</small></div>
        <div class="wk-trio-c ranged"><b>🎓 Job Lv</b><small>${b(`Hasta ${fa[1]}. Cada nivel da un punto de talento. Sube a más del doble de ritmo que la base.`,`Up to ${fa[1]}. Each level grants one talent point. It rises more than twice as fast as Base Lv.`,`最高 ${fa[1]}。每一級給一點天賦點數。升級速度是基本 Lv 的兩倍以上。`)}</small></div>
        <div class="wk-trio-c magic"><b>⚡ ${b("Nivel de partida","Run level","本局等級")}</b><small>${b("Empieza en 1 cada partida y se pierde al acabar. Da las cartas de skills y mejoras.","Starts at 1 every run and is lost at the end. Grants skill and upgrade cards.","每局從 1 開始，結束時歸零。提供技能與強化卡片。")}</small></div>
      </div>`)}
      ${me(b("EXP de Base Lv","Base Lv EXP","基本等級經驗"),`<div class="wk-two">${Lo({series:[{fn:t=>Math.log10(Go(Math.min(98,Math.max(1,Math.round(t))))),color:Us.blue,label:b("EXP para el siguiente nivel (escala log)","EXP to next level (log scale)","升到下一級所需經驗（對數刻度）")}],xMax:100,yMax:9,yTicks:3,yFmt:t=>t>=6?be(10**t/1e6,0)+"M":t>=3?be(10**t/1e3,0)+"k":be(10**t,0),xLabel:"Base Lv"})}${ns(["Lv","EXP"],a,"wk-compact")}</div>`+Ut(b("Los monstruos que estén por debajo de tu Base Lv dan cada vez menos EXP (la mitad por cada nivel de diferencia): para subir hay que ir a stages más altos.","Monsters below your Base Lv give less and less EXP (half per level of difference): to keep leveling you have to move to higher stages.","等級低於你基本等級的怪物給的經驗越來越少（每差一級減半）：想繼續升級就得前往更高的關卡。")))}
      ${me(b("Hasta dónde sube el Job Lv en cada stage","How far Job Lv rises in each stage","各關卡能把職業等級練到多高"),ns(["Stage",b("Sube bien hasta","Rises well until","順利成長至")],e,"wk-compact")+Pe(b("Pasado ese Job Lv, el stage apenas da EXP de job: hay que pasar al siguiente. El último tramo hasta 50 pide repetir la Cueva de Payon.","Past that Job Lv, the stage barely gives job EXP: move on to the next one. The last stretch to 50 means repeating Payon Cave.","超過該職業等級後，關卡幾乎不再給職業經驗：請前往下一個關卡。最後衝到 50 需要反覆刷斐揚洞穴。")))}
      ${me(b("Árboles de talentos","Talent trees","天賦樹"),Pe(b(`Cada job tiene tres árboles de talentos permanentes. Cada fila pide <b>${Bi} puntos</b> gastados en ese árbol por cada fila anterior, y algunos talentos piden otro al máximo (la flecha del árbol). Los talentos mejoran skills concretas (más daño, más objetivos, conos, efectos nuevos) o tus estadísticas, y los de las últimas filas transforman cómo juega una skill.`,`Each job has three permanent talent trees. Each row needs <b>${Bi} points</b> spent in that tree per previous row, and some talents need another one maxed first (the tree’s arrow). Talents improve specific skills (more damage, more targets, cones, new effects) or your stats, and the ones in the last rows transform how a skill plays.`,`每個職業有三棵永久的天賦樹。每一列需要在該樹中每前一列投入 <b>${Bi} 點</b>，有些天賦需要先把另一個點滿（樹上的箭頭）。天賦會強化特定技能（更多傷害、更多目標、錐形、新效果）或你的數值，最後幾列的天賦會改變技能的玩法。`))+Pe(b("En 2nd job, de sus tres ramas solo se ponen puntos en una: tu especialización. Los puntos del 1st job se quedan con lo que gastaste al ascender.","As a 2nd job, only one of its three branches can receive points: your specialization. Your 1st job points stay as you spent them when you advanced.","二轉時，三個分支中只有一個能投入點數：你的專精。一轉的點數維持轉職時的分配。"))+`<a class="ro-btn wk-link" href="talents.html" target="_blank" rel="noopener">🌳 ${b("Ver todos los árboles de talentos","Browse every talent tree","瀏覽所有天賦樹")}</a>`+Ut(b("Puedes reiniciar los talentos desde el panel del personaje.","You can reset talents from the character panel.","你可以在角色面板重置天賦。")))}`}},H_={id:"gear",name:()=>b("Equipo y refine","Gear & refine","裝備與精煉"),sub:()=>b("Tiers, affixes, cartas, herrero","Tiers, affixes, cards, smith","階級、詞綴、卡片、鐵匠"),face:()=>Fe(Me(1201)),render:()=>{const a=[["🪖",b("Cabeza (arriba, medio, abajo)","Head (upper, middle, lower)","頭部（上、中、下）")],["👕",b("Armadura","Armor","護甲")],["🗡️",b("Arma","Weapon","武器")],["🛡️",b("Escudo","Shield","盾牌")],["🧣",b("Capa","Garment","披肩")],["👢",b("Calzado","Shoes","鞋子")],["💍",b("Accesorios","Accessories","飾品")]],e=i=>i<=4?"Phracon":i<=7?"Emveretarcon":b("Oridecon (armas) · Elunium (resto)","Oridecon (weapons) · Elunium (others)","神之金屬（武器）· 鋁（其他）"),t=[.04,.04,.04,.04,.06,.06,.06,.12,.12,.12];let s=1;const n=Array.from({length:ma},(i,r)=>{s+=t[r];const l=Li(r+1);return[`+${r+1}`,e(r+1),`<span class="wk-chance"><i style="width:$ {
    l
  }
  %;background:$ {
    l>=100?Us.green:l>=60?Us.orange:Us.red
  }
  "></i><b>${l}%</b></span>`,`×${be(s,2)}`]}),o=[[`<span class="wk-q r0">${Re[0].name}</span>`,b("Nada","Nothing","無")],[`<span class="wk-q r1">${Re[1].name}</span>`,b("Una stat principal","One primary stat","一項主要素質")],[`<span class="wk-q r2">${Re[2].name}</span>`,b("Una stat principal + crítico, Celeridad o área (o perforación en armaduras y armas a distancia)","One primary stat + crit, Haste or area (or pierce on armor and ranged weapons)","一項主要素質 + 爆擊、冷卻縮減或範圍（防具與遠程武器則可能是貫穿）")],[`<span class="wk-q r3">${Re[3].name}</span>`,b("Dos stats principales + crítico/Celeridad/área + vida/armadura/velocidad/Flee","Two primary stats + crit/Haste/area + HP/armor/speed/Flee","兩項主要素質 + 爆擊／冷卻縮減／範圍 + HP／護甲／速度／迴避")],[`<span class="wk-q r4">${Re[4].name}</span>`,b("Todo lo de la épica y +10–20% de daño a una skill de tu job","Everything from epic and +10–20% damage to one of your job’s skills","史詩的全部效果，再加上對你職業某一技能 +10–20% 傷害")]];return`${vt(b("Equipo","Gear","裝備"),b("Lo que sueltan los jefes y lo que hace el herrero","What bosses drop and what the smith does","頭目會掉落什麼，以及鐵匠能做什麼"),b("Botín","Loot","戰利品"),{art:Ws("sewer"),face:Fe(Ge("npc_smith",2))})}
      ${me(b("Huecos de equipo","Equipment slots","裝備欄位"),`<div class="wk-grid4">${a.map(([i,r])=>`<div class="wk-mini small"><span>${i}</span><b>${r}</b></div>`).join("")}</div>`+Pe(b(`El equipo cae de los monstruos (los drops de RO de cada uno) y es de la cuenta: lo comparten todos tus personajes. Al morir no se pierde nada de lo que ya llevabas. Los monstruos normales y las élites sueltan como mucho ${cu} piezas por partida con la dificultad más baja y hasta ${pd(2)} con todo al máximo; cada jefe, una como mucho, aparte.`,`Gear drops from monsters (each one’s RO drops) and belongs to the account: all your characters share it. Dying never costs you what you already had. Regular monsters and elites drop at most ${cu} pieces per run at the lowest difficulty and up to ${pd(2)} with everything maxed; each boss drops at most one, on top of that.`,`裝備由怪物掉落（各自在 RO 中的掉落物），屬於帳號：你所有的角色共用。死亡永遠不會讓你失去已經擁有的東西。一般怪物與菁英在最低難度時每局最多掉落 ${cu} 件，全部拉滿時最多 ${pd(2)} 件；每隻首領另外最多掉落一件。`)))}
      ${me(b("Tiers y poder base","Tiers and base power","階級與基礎強度"),Pe(b(`El poder de una pieza no depende de su nombre de RO, sino del <b>tier</b> del stage donde cayó. Un arma de tier 1 tiene entre ${ko[0]} y ${ko[1]} de ATK (o MATK, si es vara o libro), y cada tier sube un 10%. Dentro de eso, el tipo de arma la coloca como en RO: dagas, nudillos y látigos abajo; espadas y mazas en medio; hachas y lanzas algo más; las de dos manos arriba. La DEF de las armaduras y el valor de los affixes se multiplican por el tier (tier 2 = ×2).`,`A piece’s power doesn’t depend on its RO name but on the <b>tier</b> of the stage where it dropped. A tier 1 weapon has ${ko[0]}–${ko[1]} ATK (or MATK for rods and books), and each tier adds 10%. Within that, the weapon type places it like RO: daggers, knuckles and whips at the bottom; swords and maces in the middle; axes and spears a bit higher; two-handers at the top. Armor DEF and affix values are multiplied by the tier (tier 2 = ×2).`,`一件裝備的威力不取決於它在 RO 中的名稱，而是取決於掉落關卡的<b>階級</b>。第 1 階級的武器有 ${ko[0]}–${ko[1]} ATK（法杖與書為 MATK），每一階級多 10%。在這個範圍內，武器類型的定位和 RO 一樣：短劍、拳套與鞭子在最下面；劍與鈍器在中間；斧與矛稍高；雙手武器在最上面。防具 DEF 與詞綴數值會乘以階級（第 2 階級 = ×2）。`)))}
      ${me(b("Affixes según la calidad","Affixes by quality","依品質的詞綴"),ns([b("Calidad","Quality","品質"),b("Affixes","Affixes","詞綴")],o)+Pe(b("La pieza toma el nombre de su stat principal más alta: «Knife of Strength».","The piece is named after its highest primary stat: “Knife of Strength”.","裝備以其最高的主要素質命名：「力量之短劍」。")))}
      ${me(b("Refine (Herrero Hollgrehenn)","Refine (Hollgrehenn the Blacksmith)","精煉（鐵匠忽克連）"),ns([b("Nivel","Level","等級"),b("Mineral","Ore","礦石"),b("Éxito","Success","成功率"),b("Poder total","Total power","總強度")],n)+Ut(b("Si un refine falla, la pieza se rompe y se pierde con sus cartas. Hasta +4 es seguro. Los minerales se compran al Vendedor de minerales con Puntos Kafra. Accesorios, cabeza media o baja y el equipo inicial no se refinan.","If a refine fails, the piece breaks and is lost with its cards. Up to +4 is safe. Ores are bought from the Ore Merchant with Kafra Points. Accessories, middle/lower headgear and starter gear can’t be refined.","精煉失敗時，裝備會連同卡片一起損毀消失。+4 以內安全。礦石可用卡普拉點數向礦石商人購買。飾品、中／下頭飾與初始裝備無法精煉。"),"warn"))}
      ${me(b("Cartas","Cards","卡片"),Pe(b("Cada monstruo puede soltar su carta de RO (muy rara; más probable en los jefes). Se encajan en los huecos de las piezas desde el panel del personaje y dan sus bonus mientras lleves la pieza puesta.","Every monster can drop its RO card (very rare; more likely from bosses). Socket them into gear slots from the character panel; they grant their bonuses while you wear the piece.","每種怪物都可能掉落其 RO 卡片（非常稀有；頭目機率較高）。在角色面板將卡片插入裝備的插槽；穿著該裝備時即可獲得卡片加成。")))}
      ${me("Gearscore",Pe(b("Un número para comparar de un vistazo lo que vale una pieza o una carta <b>para tu job</b>: +STR vale mucho para un Swordsman y poco para un Mage. Cada pieza suma además por su tier y su calidad. Los stages piden un gearscore mínimo con lo que llevas puesto (tu pet también cuenta).","A number to compare at a glance what a piece or card is worth <b>for your job</b>: +STR is great for a Swordsman and poor for a Mage. Each piece also adds by tier and quality. Stages require a minimum gearscore from what you wear (your pet counts too).","一個數字，讓你一眼比較裝備或卡片<b>對你的職業</b>的價值：+STR 對劍士很棒，對魔法師則很差。每件裝備也會依階級與品質加分。關卡要求你身上裝備的最低裝備分數（寵物也算）。")))}
      ${me(b("Puntos Kafra","Kafra Points","卡普拉點數"),Pe(b("La moneda de la cuenta. Se consiguen vendiendo equipo y cartas al Vendedor de minerales y sirven para comprar minerales, accesorios de pet y más. También se pueden intercambiar con otros jugadores.","The account currency. Earn them by selling gear and cards to the Ore Merchant and spend them on ores, pet accessories and more. They can also be traded with other players.","帳號共用的貨幣。把裝備與卡片賣給礦石商人即可賺取，可用來購買礦石、寵物配件等。也能與其他玩家交易。")))}`}},F_={id:"stages",name:()=>b("Stages","Stages","關卡"),sub:()=>b("Los mapas, sus jefes y requisitos","Maps, bosses and requirements","地圖、頭目與條件"),face:()=>Fe(Ge("mastering",.6)),render:()=>{const a=Se.map((e,t)=>{const s=et[e.id],n=!!e.map,o=Be[e.mvp.id],i=[];t>0&&i.push(b(`MVP de ${Se[t-1].name}`,`${Se[t-1].name} MVP`,`${Se[t-1].name}的 MVP`)),e.gsMin&&i.push(`GS ${e.gsMin}`),e.jobLvMin&&i.push(`Job Lv ${e.jobLvMin}`);const r=e.minis.map(l=>Be[l.id]?`<span class="wk-boss" title="$ {
    c(Be[l.id].name)
  }
  ">${Fe(Ge(l.id,1))}</span>`:"").join("");return`<div class="wk-stage$ {
    n?"":" soon"
  }
  " style="--art:url('${Ws(e.id)}')">
        <div class="wk-stage-top"><span class="stg-banner-lv">Nv ${e.levels}</span><span class="wk-stage-tier">Tier ${e.tier}</span>${e.story||e.storyOnly?`<span class="wk-stage-story">📜 ${b("Historia","Story","劇情")}</span>`:""}${n?"":`<span class="wk-stage-story soon">${b("Próximamente","Coming soon","即將推出")}</span>`}</div>
        <div class="wk-stage-mvp">${Fe(Ge(e.mvp.id,1.4))}</div>
        <div class="wk-stage-body"><b>${e.name}</b><small>${e.place}${s&&n&&!e.storyOnly?` · ${be(s.runLength/60,0)} min`:""}</small>
          <div class="wk-stage-row"><span class="wk-mvp-name">👑 ${o?c(o.name):e.mvp.id}</span>${r}</div>
          <div class="wk-stage-row">${i.map(l=>`<span class="stg-req">${l}</span>`).join("")||`<span class="stg-req ok">${b("Abierto desde el principio","Open from the start","一開始就開放")}</span>`}</div>
        </div>
      </div>`}).join("");return`${vt(b("Stages","Stages","關卡"),b("Cada uno se abre al vencer al MVP del anterior","Each one opens by beating the previous MVP","擊敗前一個 MVP 即可開啟"),b("Mundo","World","世界"),{art:Ws("payon_cave")})}
      ${me(b("Requisitos","Requirements","條件"),Pe(b("Para entrar en un stage hace falta haber vencido al MVP del anterior <b>con ese personaje</b> y llegar a su gearscore mínimo con lo que llevas puesto. El Castillo de Prontera pide además Job Lv 50: es la historia del ascenso a 2nd job y se juega una sola vez.","To enter a stage you need to have beaten the previous MVP <b>with that character</b> and meet its minimum gearscore with what you wear. Prontera Castle also needs Job Lv 50: it’s the 2nd job advancement story and is played only once.","要進入關卡，你必須<b>用該角色</b>擊敗前一個 MVP，且身上裝備達到最低裝備分數。普隆德拉城還需要職業等級 50：這是二轉的劇情，只能玩一次。"))+Ut(b("Las partidas empiezan siempre a nivel 1 de partida, así que en los stages altos los monstruos salen rebajados al principio y alcanzan su fuerza completa en los primeros minutos. Los jefes salen siempre con toda su fuerza.","Runs always start at run level 1, so in higher stages monsters start weakened and reach full strength over the first minutes. Bosses always come at full strength.","每局都從本局等級 1 開始，因此在高等關卡中，怪物一開始較弱，前幾分鐘內才達到完整強度。頭目永遠以完整強度登場。")))}
      <div class="wk-stages">${a}</div>`}},z_={id:"plaza",name:()=>b("La plaza de Prontera","Prontera plaza","普隆德拉廣場"),sub:()=>b("Quién es quién","Who is who","誰是誰"),face:()=>Fe(Ge("npc_knight",.7)),render:()=>{const a=[["npc_knight",c("Capitán de expediciones"),b("Elige stage, dificultad y sal de expedición. Una «!» avisa de un stage recién abierto.","Pick a stage and difficulty and head out. A “!” marks a newly unlocked stage.","選擇關卡與難度後出發。「!」表示新解鎖的關卡。")],["npc_vendor",c("Vendedor de minerales"),b("Compra tu equipo y cartas a cambio de Puntos Kafra y vende los minerales de refine.","Buys your gear and cards for Kafra Points and sells refining ores.","用卡普拉點數收購你的裝備與卡片，並販售精煉礦石。")],["npc_smith",c("Herrero Hollgrehenn"),b("Refina el equipo hasta +10 con minerales. Cuidado: a partir de +5 puede romperse.","Refines gear up to +10 with ores. Careful: from +5 it can break.","用礦石將裝備精煉到 +10。小心：+5 起可能會損毀。")],["npc_minister",c("Cronista de hazañas"),b("Apunta los logros de la cuenta y, con sus puntos, vende mejoras del roll de cartas (Reroll, Banish, Focus…).","Records account achievements and, with their points, sells card-roll perks (Reroll, Banish, Focus…).","記錄帳號成就，並用其點數販售抽卡特權（重抽、放逐、專注…）。")],["npc_petkeeper",c("Cuidadora de pets"),b("Vende los accesorios de tus pets y los hace evolucionar.","Sells your pets’ accessories and evolves them.","販售寵物配件並讓寵物進化。")],["npc_postman",c("Cartero"),b("El correo del juego: avisos y regalos del equipo, y lo que recuperemos de tu cuenta. Lo que llega adjunto se recoge aquí. Una «!» avisa de carta nueva. Solo con cuenta.","The game’s mail: notices and gifts from the team, and anything we recover for your account. Attached items are collected here. A “!” means new mail. Account only.","遊戲信件：團隊的通知與禮物，以及我們為你的帳號找回的物品。附件在這裡領取。「!」表示有新信件。需要帳號。")],["npc_stylist",c("Estilista"),b("Cambia peinado, color de pelo y tinte de ropa gratis.","Changes hairstyle, hair colour and clothing dye for free.","免費更換髮型、髮色與服裝染色。")],["npc_librarian",c("Bibliotecario"),b("Yo mismo: esta wiki.","Me: this wiki.","我：就是這個 Wiki。")]];return a.push(["npc_tower",c("Guardián de la Torre"),b("La puerta de la Endless Tower: oleadas sin fin con clasificación mensual.","The Endless Tower gate: endless waves with a monthly ladder.","魔物終結塔的入口：無盡波次與每月排行榜。")]),`${vt(b("La plaza de la fuente","The fountain plaza","噴泉廣場"),b("Tu punto de partida y de vuelta","Where every journey begins and ends","每段旅程的起點與終點"),b("Mundo","World","世界"),{art:Ws("prontera"),face:Fe(Ge("npc_kafra",2))})}
      ${me(b("NPCs","NPCs","NPC"),`<div class="wk-npcs">${a.map(([e,t,s])=>`<div class="wk-npc"><span class="wk-npc-face">${Fe(Ge(e,1))}</span><div><b>${t}</b><small>${s}</small></div></div>`).join("")}</div>`)}
      ${me(b("Tu personaje","Your character","你的角色"),Pe(b("El botón de tu personaje abre su panel: equipo, cartas, stats, talentos, pet y récords. Desde ahí también se reinician stats y talentos. El inventario, las cartas sueltas, los minerales y los Puntos Kafra son de la cuenta: los comparten todos tus personajes.","Your character button opens their panel: gear, cards, stats, talents, pet and records. Stats and talents are reset from there too. Inventory, loose cards, ores and Kafra Points belong to the account: all your characters share them.","角色按鈕會開啟角色面板：裝備、卡片、素質、天賦、寵物與紀錄。素質與天賦也在那裡重置。背包、未插的卡片、礦石與卡普拉點數屬於帳號：所有角色共用。")))}`}},U_={id:"pets",name:()=>b("Pets","Pets","寵物"),sub:()=>b(`${Rt.length} compañeros con bonus`,`${Rt.length} companions with bonuses`,`${Rt.length} 隻有加成的夥伴`),face:()=>Fe(Ge("poring_pet",1)||Ge("poring",1)),render:()=>{const a=Rt.map(e=>{var n,o,i,r;const t=Ge(Xn(e.id),1)||Ge(e.id,1),s=e.from?b(`Evoluciona de ${c(((n=Be[e.from])==null?void 0:n.name)??e.from)}`,`Evolves from ${((o=Be[e.from])==null?void 0:o.name)??e.from}`,`由${((i=Be[e.from])==null?void 0:i.name)??e.from}進化`):b("Huevo","Egg","蛋");return`<div class="wk-pet$ {
    e.from?" evo":""
  }
  "><span class="wk-pet-face">${Fe(t)}</span><b>${c(((r=Be[e.id])==null?void 0:r.name)??e.id)}</b><small class="wk-pet-how">${e.from?"✨ ":`${Fe(Me(e.egg),"wk-egg")} `}${s}</small><small>${vl(e.id,1).join(" · ")}</small></div>`}).join("");return`${vt(b("Pets","Pets","寵物"),b("Te siguen en partida y te dan su bonus","They follow you in runs and grant their bonus","在遊戲中跟著你並提供加成"),b("Compañeros","Companions","夥伴"),{tone:"wk-tone-green",face:Fe(Ge("poring_pet",2.4)||Ge("poring",2))})}
      ${me(b("Cómo se consiguen","How to get them","取得方式"),Pe(b(`Su huevo cae de su monstruo, como las cartas: ${Xe($o(!1),2)} en monstruos normales y ${Xe($o(!0),1)} en el MVP. Un pet que ya tienes no vuelve a soltar huevo. Los pets de jefes no salen de huevo: se consiguen evolucionando el pet de antes.`,`Their egg drops from their monster, like cards: ${Xe($o(!1),2)} from normal monsters and ${Xe($o(!0),1)} from the MVP. A pet you already own won’t drop again. Boss pets don’t hatch from eggs: you get them by evolving the previous pet.`,`牠們的蛋和卡片一樣由對應的怪物掉落：一般怪物 ${Xe($o(!1),2)}，MVP ${Xe($o(!0),1)}。已經擁有的寵物不會再掉落。首領寵物不是從蛋孵化：要讓前一隻寵物進化才能取得。`))+ns([b("Intimidad","Intimacy","親密度"),b("Desde","From","來源"),b("Bonus","Bonus","加成")],Wo.map(e=>[c(e.name),String(e.min),Xe(e.mult)]))+Pe(b(`La intimidad sube jugando partidas con el pet (unas 3 partidas largas hasta Leal). En Cordial, la Cuidadora vende su accesorio por ${Ln} Puntos Kafra: el bonus sube ×${be(an,1)}. Para evolucionar hace falta el pet en Leal y haber vencido ${Di} veces a su jefe (con cualquier personaje de la cuenta).`,`Intimacy rises by playing runs with the pet (about 3 long runs to Loyal). At Cordial, the Pet Keeper sells its accessory for ${Ln} Kafra Points: the bonus goes ×${be(an,1)}. Evolving needs the pet at Loyal and its boss beaten ${Di} times (by any character on the account).`,`和寵物一起遊玩就會提升親密度（大約 3 場長時間的遊戲達到忠誠）。達到親密時，寵物飼育員會以 ${Ln} 卡普拉點數販賣牠的配件：加成變為 ×${be(an,1)}。進化需要寵物達到忠誠，並擊敗其首領 ${Di} 次（帳號中任何角色都可以）。`)))}
      ${me(b("Todos los pets (bonus en Leal, sin accesorio)","Every pet (Loyal bonus, no accessory)","所有寵物（忠誠加成、無配件）"),`<div class="wk-pets">${a}</div>`)}`}},G_={id:"more",name:()=>b("Logros e historia","Achievements & story","成就與劇情"),sub:()=>b("Cronista y modo historia","Chronicler and story mode","事蹟記錄者與劇情模式"),face:()=>Fe(Ge("npc_minister",.7)),render:()=>{const a=E1.map(e=>[c(e.name),String(ts.filter(t=>t.cat===e.id).length),String(ts.filter(t=>t.cat===e.id).reduce((t,s)=>t+s.points,0))]);return`${vt(b("Hazañas e historias","Deeds and stories","事蹟與故事"),b("Lo que cuenta para toda la cuenta","What counts for the whole account","整個帳號共用的紀錄"),b("Cuenta","Account","帳號"),{art:Ws("sunken")})}
      ${me(b("Logros","Achievements","成就"),Pe(b("Los logros son hitos de toda la cuenta: stages superados, 2nd jobs, MVPs vencidos, monstruos cazados… Cada uno da Puntos de hazaña la primera vez, y el Cronista los cambia por rangos de las mejoras del roll de cartas: cada rango es un uso más por partida.","Achievements are account-wide milestones: stages cleared, 2nd jobs, MVPs defeated, monsters hunted… Each grants Deed Points the first time, and the Chronicler trades them for card-roll perk ranks: each rank is one more use per run.","成就是帳號共用的里程碑：通關關卡、二轉、擊敗 MVP、狩獵怪物… 每個成就首次達成時給予事蹟點數，事蹟記錄者可用點數兌換抽卡特權等級：每一級為每局多一次使用次數。"))+ns([b("Categoría","Category","分類"),b("Logros","Achievements","成就"),b("Puntos","Points","點數")],a,"wk-compact"))}
      ${me(b("Modo historia","Story mode","劇情模式"),Pe(b("Algunos stages tienen una versión con historia, con diálogos y cinemáticas. En ellas no hay dificultad ni botín: la recompensa se elige en cartas al terminar. La historia se juega antes que la versión normal del stage, que no se abre hasta vencer a su MVP en la historia.","Some stages have a story version with dialogue and cutscenes. They have no difficulty settings or loot: the reward is chosen from cards at the end. The story is played before the stage’s normal version, which only opens after beating its MVP in the story.","部分關卡有包含對話與過場動畫的劇情版本。劇情版沒有難度設定也沒有戰利品：結束時從卡片中選擇獎勵。劇情要先於關卡的一般版本遊玩，一般版本要在劇情中擊敗其 MVP 後才會開啟。"))+`<div class="wk-grid3">
          <div class="wk-mini"><span>⚓</span><b>${b("Barco hundido","Sunken Ship","失事輪")}</b><small>${b("Tu primera misión oficial junto a los hermanos Lain y Haru, a las órdenes de Selene.","Your first official mission with siblings Lain and Haru, under Selene’s command.","你和萊恩、哈魯兄妹在瑟蕾娜指揮下的第一個正式任務。")}</small></div>
          <div class="wk-mini"><span>🏰</span><b>${b("Castillo de Prontera","Prontera Castle","普隆德拉城")}</b><small>${b("La boda real, el asalto orco y tu ascenso a 2nd job.","The royal wedding, the orc assault and your 2nd job advancement.","皇家婚禮、獸人襲擊與你的二轉晉升。")}</small></div>
        </div>`)}`}},V_={id:"online",name:()=>b("Jugar con otros","Playing with others","與其他人一起玩"),sub:()=>b("Grupo, trade, chat y amigos","Party, trade, chat and friends","組隊、交易、聊天與好友"),face:()=>oo("🤝"),render:()=>`${vt(b("Jugar con otros","Playing with others","與其他人一起玩"),b("La plaza está llena de aventureros","The plaza is full of adventurers","廣場上滿是冒險者"),b("Online","Online","線上"),{art:Ws("byalan")})}
      ${me(b("Grupo","Party","隊伍"),`<div class="wk-grid3">
        <div class="wk-mini"><span>👥</span><b>${b("Hasta 3","Up to 3","最多 3 人")}</b><small>${b("El líder es el anfitrión: elige el stage y lleva los monstruos. Si se va, otro del grupo sigue la partida.","The leader is the host: picks the stage and runs the monsters. If they leave, another member takes the run over.","隊長是主機：選擇關卡並負責運算怪物。隊長離開時，由隊伍中的另一人接手繼續。")}</small></div>
        <div class="wk-mini"><span>💎</span><b>${b("EXP compartida","Shared EXP","共享經驗")}</b><small>${b("La EXP, el nivel de partida y el zeny son de todos. La carne, de quien la coge.","EXP, run level and zeny are shared. Meat goes to whoever picks it up.","經驗、本局等級與金幣共享。肉歸撿到的人。")}</small></div>
        <div class="wk-mini"><span>⏸️</span><b>${b("Todos eligen","Everyone picks","每個人都要選")}</b><small>${b("Al subir de nivel o abrir un cofre, la partida espera a que elijan todos (10 s cada uno; el líder puede subirlo hasta 20 s al proponer la salida).","On level up or chest opening, the run waits for everyone to choose (10 s each; the leader can raise it to 20 s when proposing the trip).","升級或開寶箱時，遊戲會等所有人選完（每人 10 秒；隊長提議出發時可提高到 20 秒）。")}</small></div>
        <div class="wk-mini"><span>🎲</span><b>Need / Greed</b><small>${b("Las piezas y cartas se tiran entre todos: gana el dado más alto de Need; si nadie pide Need, el de Greed.","Gear and cards are rolled for: the highest Need roll wins; if nobody needs it, the highest Greed.","裝備與卡片以擲骰分配：需求骰最高者獲得；若沒人需要，則貪婪骰最高者獲得。")}</small></div>
        <div class="wk-mini"><span>📜</span><b>${b("Historias en solitario","Stories are solo","劇情為單人")}</b><small>${b("Las historias no se pueden jugar en grupo: sal del grupo para jugarlas. Si otro personaje de tu cuenta ya la ha superado, puedes saltarla y llevarte su recompensa (sin EXP).","Stories cannot be played in a party: leave the party to play them. If another character on your account already cleared one, you can skip it and get its reward (no EXP).","劇情無法組隊遊玩：請先離開隊伍再遊玩。若帳號中的其他角色已通關，可以跳過並獲得獎勵（沒有經驗值）。")}</small></div>
        <div class="wk-mini"><span>👑</span><b>${b("Jefes","Bosses","頭目")}</b><small>${b("Van a por el jugador más cercano.","They target the nearest player.","牠們會攻擊最近的玩家。")}</small></div>
      </div>`)}
      ${me(b("En la plaza","In the plaza","在廣場"),ns([b("Qué","What","項目"),b("Cómo","How","方式")],[[b("Chat y emotes","Chat and emotes","聊天與表情"),b("Escribe en el chat. Los emotes de RO salen con sus comandos (/lv, /$, /thx…) o desde el botón de emotes.","Type in chat. RO emotes work with their commands (/lv, /$, /thx…) or from the emote button.","在聊天框輸入。RO 表情可用指令（/lv、/$、/thx…）或表情按鈕使用。")],[b("Menú de un jugador","Player menu","玩家選單"),b("Tócale para susurrar, inspeccionar su equipo, comerciar, invitarle al grupo o añadirle de amigo. Las piezas con la etiqueta «No comerciable» (el equipo inicial y lo ligado a tu cuenta, como lo que conseguiste jugando de invitado) no se pueden dar.","Tap them to whisper, inspect their gear, trade, invite to party or add as a friend. Pieces tagged “Not tradable” (starter gear and anything bound to your account, like what you got while playing as a guest) can't be given away.","點擊玩家即可密語、查看裝備、交易、邀請組隊或加為好友。標有「不可交易」的裝備（初始裝備與綁定帳號的物品，例如以訪客身分取得的）無法給予他人。")],[b("Trade","Trade","交易"),b("Equipo, cartas, minerales y Puntos Kafra, con chat entre los dos. Hace falta OK y confirmación de ambos.","Gear, cards, ores and Kafra Points, with a private chat. Both players must OK and confirm.","裝備、卡片、礦石與卡普拉點數，附私人聊天。雙方都必須按 OK 並確認。")],[b("Amigos","Friends","好友"),b("Lista con dónde está cada uno (canal, partida o desconectado). Solo con cuenta registrada.","List showing where each friend is (channel, in a run or offline). Registered accounts only.","顯示每位好友所在位置的清單（頻道、遊戲中或離線）。僅限註冊帳號。")],[b("Lobbies","Lobbies","大廳"),b("La plaza se reparte en lobbies con nombre (Asgard, Midgard…), cada uno con sus canales, su chat y sus grupos. Eliges uno al entrar en Prontera (normal, concurrido o lleno) y puedes cambiar desde el cartel de arriba. Tus amigos, los susurros y la Endless Tower son comunes a todos; a un amigo de otro lobby puedes invitarle al grupo desde la lista de amigos y, si acepta, se cambia al tuyo.","The plaza is split into named lobbies (Asgard, Midgard…), each with its own channels, chat and parties. You pick one when you enter Prontera (normal, crowded or full) and can switch from the label at the top. Friends, whispers and the Endless Tower are shared by all of them; you can invite a friend from another lobby to your party from the friends list and, if they accept, they move to yours.","廣場分成幾個有名字的大廳（阿斯嘉特、米德加爾特…），每個都有自己的頻道、聊天和隊伍。進入普隆德拉時選擇一個（正常、擁擠或已滿），也可以從上方的標示切換。好友、悄悄話和無盡之塔在所有大廳都共用；可以從好友清單邀請其他大廳的好友加入隊伍，對方接受後會換到你的大廳。")],[b("Canales","Channels","頻道"),b("Cada lobby tiene varios canales; puedes ir al de un amigo desde su menú.","Each lobby has several channels; you can jump to a friend’s from their menu.","每個大廳有多個頻道；可從好友的選單直接跳到其頻道。")]]))}`},K_={id:"tower",name:()=>"Endless Tower",sub:()=>b("Oleadas sin fin y ladder","Endless waves and ladder","無盡波次與排行榜"),face:()=>Fe(Ge("npc_tower",.7)),render:()=>`${vt("Endless Tower",b("Mata sin parar y sube en la clasificación","Keep killing and climb the ladder","不停擊殺，爬上排行榜"),"Endgame",{art:Ws("endless"),face:Fe(Ge("npc_tower",2))})}
    ${me(b("La torre","The tower","塔"),Pe(b("Solo para personajes con 2nd job. Pisos de un minuto, cada vez más duros, con monstruos que no paran de salir: para superar cada uno hay que llegar a sus puntos mínimos y, si tiene jefes, matarlos antes de que acabe el tiempo; si no, se acaba la partida. Los pisos 10, 20, 30... duran dos minutos y solo sale el MVP del bloque, que llama a 30 monstruos cada 15 segundos: hay que matarlo a tiempo. Al empezar eliges la Deity de una de tus skills (sube un rango cada 10 pisos) y antes de cada piso eliges una de las cartas de mejora común que salen, una para el ataque básico y otra por cada skill que llevas (+3% de daño y +0,5% de vida, como al subir de nivel); tras los pisos 5 y 10 de cada bloque, las cartas son épicas. Superar el piso 50 desbloquea el tinte Blood Savage para todos tus personajes (se pone en el Estilista). Una partida se puede guardar y retomar una sola vez, desde el principio del piso en el que ibas. Las mejoras y skills de la torre se compran con sus propios puntos en el Guardián. Necesita cuenta registrada: el servidor comprueba cada partida para la clasificación mensual.","2nd job characters only. One-minute floors that keep getting harder, with monsters that never stop coming: to clear each one you must reach its minimum points and, if it has bosses, kill them before time runs out; otherwise the run ends. Floors 10, 20, 30... last two minutes and only the MVP of the block shows up, summoning 30 monsters every 15 seconds: you have to kill it in time. At the start you pick the Deity of one of your skills (it goes up a rank every 10 floors) and before each floor you pick one of the common upgrade cards on offer, one for your basic attack and one for each skill you carry (+3% damage and +0.5% HP, like a level-up); after floors 5 and 10 of each block, the cards are epic. Clearing floor 50 unlocks the Blood Savage dye for all your characters (put it on at the Stylist). A run can be saved and resumed only once, from the start of the floor you were on. Tower upgrades and skills are bought with its own points at the Guardian. Needs a registered account: the server verifies every run for the monthly ladder.","僅限二轉角色。每層一分鐘、越來越難，怪物源源不絕：要通過每一層，必須達到最低分數，若有首領還要在時間內擊殺；否則本局結束。第 10、20、30……層持續兩分鐘，只有該區段的 MVP 出現，每 15 秒召喚 30 隻怪物：你必須及時擊殺牠。開始時選擇你某個技能的神祇（每 10 層提升一級），每層開始前從提供的普通強化卡片中選一張，一張給普通攻擊，你攜帶的每個技能各一張（傷害 +3%、HP +0.5%，就像升級一樣）；每個區段第 5 與第 10 層之後，卡片為史詩。通過第 50 層會為你所有角色解鎖 Blood Savage 染料（到造型師那裡換上）。每局只能儲存並繼續一次，從所在樓層的起點開始。塔的強化與技能用塔自己的點數向守護者購買。需要已註冊的帳號：伺服器會驗證每一局以列入每月排行榜。"))+Pe(b("En los pisos que ese personaje ya tiene superados puedes acelerar la partida a x2 o x4 con el botón de velocidad del marcador (o la tecla V); mientras va acelerada, los gráficos bajan al mínimo. Al llegar a un piso que aún no has superado vuelve sola a la velocidad normal y a tus gráficos. Cuenta igual que a velocidad normal.","On floors that character has already cleared you can speed the run up to x2 or x4 with the speed button on the scoreboard (or the V key); while it is sped up, graphics drop to the minimum. When you reach a floor you have not cleared yet it goes back to normal speed and your graphics on its own. It counts the same as at normal speed.","在該角色已經通過的樓層，可以用計分板上的速度按鈕（或 V 鍵）把遊戲加速到 x2 或 x4；加速時畫面會降到最低。到達尚未通過的樓層時，會自動回到正常速度與你的畫面設定。計分方式與正常速度相同。")))}`},Cx=(a,e)=>`<div class="tabs wk-ptabs">${a.map(([t,s])=>`<button class="tab-btn${t===e?" active":""}" data-pane-tab="${t}">${s}</button>`).join("")}</div>`,Lx=(a,e,t)=>`<div class="wk-pane${a===e?" on":""}" data-pane="${a}">${t}</div>`;function W_(a,e){return a.querySelectorAll("[data-pane-tab]").forEach(t=>t.classList.toggle("active",t.dataset.paneTab===e)),a.querySelectorAll("[data-pane]").forEach(t=>t.classList.toggle("on",t.dataset.pane===e)),e}const Ax=(a,e)=>a.querySelectorAll("[data-pane-tab]").forEach(t=>t.onclick=()=>e(W_(a,t.dataset.paneTab)));let Xr="swordsman",id=1;const fb=new Map;function Px(a){var t,s;let e=fb.get(a);if(e===void 0){try{e=((s=(t=ce[a])==null?void 0:t.create)==null?void 0:s.call(t))??null}catch{e=null}fb.set(a,e)}return e}const gb=a=>(tr[a.id]??Th[a.id]??[]).filter(e=>ul(e)&&Px(e)),yb=(a,e)=>(nn.deityTexts(Px(a),e)??[]).map(t=>`<li>${t}</li>`).join(""),Y_={id:"deity",name:()=>b("Deity por job","Deity by job","各職業神祇"),sub:()=>b("Lo que hace la Deity de cada skill","What each skill’s Deity does","每個技能的神祇效果"),face:()=>Fe(Me(1530)),render:()=>{var n;const a=ya([...Tt,...As]).filter(o=>o.key!=="dancer"&&gb(o.job).length);a.some(o=>o.key===Xr)||(Xr=((n=a[0])==null?void 0:n.key)??"");const e=Object.values(on).filter(o=>o.slot==="deity"),t=a.map(o=>{const i=o.job,r=gb(i).map(d=>`<div class="wk-deity-sk"><div class="wk-deity-hd">${Fe(so(ce[d].icon))}<b>${ce[d].name} Deity</b></div><ul data-dsk="${d}">${yb(d,id)}</ul></div>`).join(""),l=i.base?Pe(b(`Además, todas las Deity del ${ge(i.base).name}: el ${o.name} conserva sus skills.`,`Plus every ${ge(i.base).name} Deity: the ${o.name} keeps those skills.`,`另外還有${ge(i.base).name}的所有神祇：${o.name}保留那些技能。`)):"";return Lx(o.key,Xr,me(`${Fe(o.icon,"wk-inline-ic")} ${o.name}${i.rank===2?" "+fh():""}`,`<div class="wk-deity-list">${r}</div>${l}`))}).join(""),s=o=>o.job.nameF?`${o.job.name} / ${o.job.nameF}`:o.name;return`${vt(b("Deity","Deity","神祇"),b("El quinto hueco del cofre: transforma una skill","The fifth chest slot: it transforms a skill","寶箱的第五個欄位：改造一個技能"),b("Partida","Run","本局"),{art:Ws("prt_castle"),tone:"wk-tone-violet"})}
      ${me(b("Cómo funcionan","How they work","運作方式"),Pe(b("En el cofre, el hueco Deity ofrece la Deity de una skill que llevas en la partida. Siempre es legendaria y cada vez que vuelve a salir se refina y sube un rango: los números de abajo crecen con él. Mientras no tengas una de skill, el hueco puede llenarse con una Deity de stats. En la Endless Tower eliges una al empezar y sube un rango cada 10 pisos.","In a chest, the Deity slot offers the Deity of a skill you carry this run. It is always legendary and each time it shows up again it is refined and goes up a rank: the numbers below grow with it. Until you have a skill Deity, the slot can hold a stat Deity. In the Endless Tower you pick one at the start and it goes up a rank every 10 floors.","在寶箱中，神祇欄位會提供你本局攜帶技能的神祇。它永遠是傳說品質，每次再出現都會精煉並提升一級：下方的數字會隨之成長。在擁有技能神祇之前，此欄位可以放屬性神祇。在無盡之塔中，你會在開始時選一個，每 10 層提升一級。"))+gs("wk-deity-rank",b("Rango","Rank","等級"),1,10,id))}
      ${me(`${b("Deity de stats","Stat Deity","屬性神祇")} <span class="wk-count">${e.length}</span>`,`<div class="wk-items">${e.map(o=>`<div class="wk-item">${Fe(Me(o.icon))}<div><b>${c(o.name)}</b><small>${o.text(o.range[0])} → ${o.text(o.range[1])}</small></div></div>`).join("")}</div>`+Pe(b("Valen para cualquier job. Cada refinado suma otra tirada.","They work for any job. Each refine adds another roll.","任何職業都適用。每次精煉再加一次數值。")))}
      ${Cx(a.map(o=>[o.key,`${Fe(o.icon,"wk-tab-ic")}${s(o)}`]),Xr)}
      ${t}`},bind:a=>{Ax(a,s=>Xr=s);const e=a.querySelector("#wk-deity-rank"),t=a.querySelector("#wk-deity-rank-v");e.oninput=()=>{id=+e.value,t.textContent=e.value,a.querySelectorAll("[data-dsk]").forEach(s=>s.innerHTML=yb(s.dataset.dsk,id))}}};let Jr="weapon";const X_=["weapon","shield","head_top","head_mid","head_low","armor","garment","shoes","acc"],Qr={단검:()=>b("Dagas","Daggers","短劍"),검:()=>b("Espadas","Swords","單手劍"),양손검:()=>b("Espadas a dos manos","Two-handed swords","雙手劍"),카타르:()=>"Katar",창:()=>b("Lanzas","Spears","單手矛"),양손창:()=>b("Lanzas a dos manos","Two-handed spears","雙手矛"),도끼:()=>b("Hachas","Axes","單手斧"),양손도끼:()=>b("Hachas a dos manos","Two-handed axes","雙手斧"),클럽:()=>b("Mazas","Maces","鈍器"),너클:()=>b("Nudillos","Knuckles","拳套"),롯드:()=>b("Varas","Rods","法杖"),책:()=>b("Libros","Books","書"),활:()=>b("Arcos","Bows","弓"),악기:()=>b("Instrumentos","Instruments","樂器"),채찍:()=>b("Látigos","Whips","鞭子"),권총:()=>b("Pistolas","Pistols","手槍"),라이플:()=>b("Rifles","Rifles","步槍"),샷건:()=>b("Escopetas","Shotguns","散彈槍"),수리검:()=>"Huuma"};let pp=null;function J_(){if(pp)return pp;const a=new Map,e=(t,s)=>{const n=fe[t];if(!n||n.secret||n.starter)return;let o=a.get(t);o||a.set(t,o=[]),o.some(i=>i.stage===s.stage&&i.mob===s.mob)||o.push(s)};return Se.forEach((t,s)=>{var o;if(!t.map)return;for(const i of t.monsters)for(const r of Qi[i]??[])e(r.id,{stage:s,mob:i,boss:!1});for(const i of[...t.minis.map(r=>r.id),t.mvp.id])for(const r of Qi[i]??[])e(r.id,{stage:s,mob:i,boss:!0});const n=(o=et[t.id])==null?void 0:o.reward;n&&e(n,{stage:s,mob:null,boss:!1})}),pp=a}const Q_={id:"equip",name:()=>b("Equipo por pieza","Gear by slot","各部位裝備"),sub:()=>b("Su ★ y dónde cae","Its ★ and where it drops","★ 屬性與掉落處"),face:()=>Fe(Me(2302)),render:()=>{const a=J_(),e=r=>bs.find(l=>l.gear===r).name,t=r=>r.mob?`${r.boss?"👑 ":""}${Be[r.mob]?c(Be[r.mob].name):r.mob}`:`🎁 ${b("Recompensa del stage","Stage reward","關卡獎勵")}`,s=r=>{const l=r[0],d=r.flatMap(y=>a.get(y)),h=[...new Set(d.map(y=>Se[y.stage].tier))].sort((y,w)=>y-w),u=h.map(y=>{const w=[...new Set(r.flatMap(m=>wh(m,y).map(f=>f.text(1))))];return w.length?`<span class="wk-star">${h.length>1?`<em>T${y}</em>`:""}${w.join(" · ")}</span>`:""}).join(""),p=[...new Set(d.map(y=>y.stage))].sort((y,w)=>y-w).map(y=>{const w=Se[y];return`<li><b>${w.name}</b> <em>T${w.tier}</em>: ${[...new Set(d.filter(m=>m.stage===y).map(t))].join(", ")}</li>`}).join("");return`<div class="wk-gear">${Fe(Me(l))}<div><b>${ll(Ft(l))}</b>${u||`<small class="wk-nostar">${b("Sin ★: solo su tier y sus affixes","No ★: only its tier and affixes","無 ★：只有階級與詞綴")}</small>`}<ul>${p}</ul></div></div>`},n=[...a.keys()].sort((r,l)=>r-l),o=r=>{const l=new Map;for(const d of r){const h=Ft(d),u=l.get(h);u?u.push(d):l.set(h,[d])}return[...l.values()]},i=X_.map(r=>{const l=o(n.filter(h=>fe[h].slot===r));let d;return r==="weapon"?d=[...new Set(l.map(u=>fe[u[0]].wtype??""))].sort((u,p)=>Object.keys(Qr).indexOf(u)-Object.keys(Qr).indexOf(p)).map(u=>{var y;const p=l.filter(w=>(fe[w[0]].wtype??"")===u);return me(`${((y=Qr[u])==null?void 0:y.call(Qr))??b("Otras","Other","其他")} <span class="wk-count">${p.length}</span>`,`<div class="wk-gears">${p.map(s).join("")}</div>`)}).join(""):d=me(`${e(r)} <span class="wk-count">${l.length}</span>`,`<div class="wk-gears">${l.map(s).join("")}</div>`),[r,l.length,Lx(r,Jr,d)]}).filter(r=>r[1]);return i.some(r=>r[0]===Jr)||(Jr=i[0][0]),`${vt(b("Equipo por pieza","Gear by slot","各部位裝備"),b("Todo lo que cae en los stages","Everything that drops in the stages","關卡中掉落的一切"),b("Botín","Loot","戰利品"),{art:Ws("sewer"),tone:"wk-tone-green"})}
      ${me(b("La ★ de cada pieza","Each piece’s ★","每件裝備的 ★"),Pe(b("Muchas piezas traen algo propio, sacado de lo que dan en RO: la <b>★</b> de la ficha. Sale en todas las calidades, aparte de los affixes, y su valor se multiplica por el tier del stage donde cae (tier 2 = ×2) y por el refine. 👑 = minijefe o MVP: sueltan su equipo mucho más a menudo que los monstruos normales.","Many pieces carry something of their own, taken from what they give in RO: the <b>★</b> on the tooltip. It comes at every quality, on top of the affixes, and its value is multiplied by the tier of the stage where it drops (tier 2 = ×2) and by refine. 👑 = mini boss or MVP: they drop their gear much more often than normal monsters.","許多裝備帶有自己的屬性，取自它們在 RO 中的效果：說明中的 <b>★</b>。它在所有品質都會出現，與詞綴分開，數值會乘以掉落關卡的階級（第 2 階級 = ×2）與精煉。👑 = 小頭目或 MVP：牠們掉落裝備的機率比一般怪物高得多。")))}
      ${Cx(i.map(([r,l])=>[r,`${e(r)} <small>${l}</small>`]),Jr)}
      ${i.map(r=>r[2]).join("")}`},bind:a=>Ax(a,e=>Jr=e)};function mp(){return[Ex,A_,P_,__,q_,I_,B_,N_,Y_,O_,D_,H_,Q_,F_,z_,U_,G_,V_,K_]}let qn=null,rd="start";function jx(){qn==null||qn()}function Z_(){jx();const a=od("wk-nav"),e=od("wk-detail"),t=od("wk-search");t.value="",t.placeholder=b("Buscar en la wiki…","Search the wiki…","搜尋 Wiki…");let s="";const n=()=>{const h=mp();a.innerHTML=h.map(u=>`<button class="stg-card wk-nav-card${u.id===rd&&!s?" sel":""}" data-sec="${u.id}"><span class="stg-face wk-face">${u.face()}</span><span class="stg-card-info"><b>${u.name()}</b><small>${u.sub()}</small></span></button>`).join(""),a.querySelectorAll("[data-sec]").forEach(u=>u.onclick=()=>o(u.dataset.sec))},o=(h,u="")=>{var y,w;const p=mp().find(m=>m.id===h)??Ex;if(rd=p.id,s&&!u&&(s="",t.value=""),e.innerHTML=p.render(),e.scrollTop=0,(y=p.bind)==null||y.call(p,e),n(),requestAnimationFrame(()=>{var m;return(m=a.querySelector(".sel"))==null?void 0:m.scrollIntoView({block:"nearest"})}),u){eq(e,u);const m=e.querySelector(".wk-mark-hit"),f=m==null?void 0:m.closest("[data-pane]");m&&f&&!f.classList.contains("on")&&((w=e.querySelector(`[data-pane-tab="${f.dataset.pane}"]`))==null||w.click(),m.scrollIntoView({block:"center"}))}},i=()=>{const h=Vi(s),u=[],p=document.createElement("div");for(const y of mp()){p.innerHTML=y.render().replace(/</g," <");const w=(p.textContent??"").replace(/\s+/g," "),m=Vi(w);let f=0;for(let P=m.indexOf(h);P>=0;P=m.indexOf(h,P+h.length))f++;if(!f&&!Vi(y.name()).includes(h))continue;const v=Math.max(0,m.indexOf(h)),x=Math.max(0,v-60),k=w.slice(x,v+h.length+90),M=v-x,$=`${x>0?"…":""}${ll(k.slice(0,M))}<mark>${ll(k.slice(M,M+h.length))}</mark>${ll(k.slice(M+h.length))}…`;u.push({s:y,snip:$,n:f})}u.sort((y,w)=>w.n-y.n),e.innerHTML=`${vt(b("Búsqueda","Search","搜尋"),`«${ll(s)}»`,b(`${u.length} secciones`,`${u.length} sections`,`${u.length} 個章節`),{tone:"wk-tone-blue"})}
      ${u.length?u.map(y=>`<button class="wk-result" data-res="${y.s.id}"><span class="stg-face wk-face">${y.s.face()}</span><span><b>${y.s.name()}</b><small>${y.snip}</small></span><em>${y.n}</em></button>`).join(""):`<div class="info-panel">${b("No encuentro nada con eso. Prueba con otra palabra: «crítico», «refine», «AGI»…","Nothing found. Try another word: “critical”, “refine”, “AGI”…","找不到結果。試試其他關鍵字：「爆擊」「精煉」「AGI」…")}</div>`}`,e.querySelectorAll("[data-res]").forEach(y=>y.onclick=()=>o(y.dataset.res,s)),a.querySelectorAll(".sel").forEach(y=>y.classList.remove("sel"))};let r=0;t.oninput=()=>{clearTimeout(r),r=window.setTimeout(()=>{s=t.value.trim(),s.length>=2?i():o(rd)},160)};const l=h=>{h.key==="Escape"&&(h.stopPropagation(),d())},d=()=>{qn==null||qn()};qn=()=>{qn=null,clearTimeout(r),window.removeEventListener("keydown",l,!0),de("wiki")},window.addEventListener("keydown",l,!0),od("wk-close").onclick=d,Ue("wiki"),o(rd)}const ll=a=>a.replace(/[&<>"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[e]),Vi=a=>a.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();function eq(a,e){var i;const t=Vi(e),s=document.createTreeWalker(a,NodeFilter.SHOW_TEXT),n=[];for(let r=s.nextNode();r;r=s.nextNode())Vi(r.nodeValue??"").includes(t)&&!((i=r.parentElement)!=null&&i.closest("svg, option, script"))&&n.push(r);let o=null;for(const r of n){const l=r.nodeValue,d=Vi(l).indexOf(t);if(d<0)continue;const h=r.splitText(d);h.splitText(e.length);const u=document.createElement("mark");u.className="wk-mark-hit",h.parentNode.replaceChild(u,h),u.appendChild(h),o??(o=u)}o==null||o.scrollIntoView({block:"center"})}const Zr=a=>a.map(e=>[e.toLowerCase().replace(/[^a-z0-9]+/g,"_"),e]),Lm=[{id:"city",text:"¿Cuál es tu ciudad preferida?",options:Zr(["Al De Baran","Alberta","Amatsu","Ayothaya","Comodo","Einbroch","Geffen","Hugel","Izlude","Juno","Lighthalzen","Louyang","Morroc","Payon","Prontera","Rachel"])},{id:"monster",text:"¿Cuál es tu monstruo favorito?",options:Zr(["Abysmal Knight","Agav","Agony of Royal Knight","Alarm","Alice","Alicel","Aliot","Aliza","Alligator","Alphoccio","Am Mut","Ambernite","Anacondaq","Ancient Mimic","Ancient Mummy","Ancient Tree","Ancient Worm","Andre","Andre Egg","Andre Larva","Angelring","Angra Mantis","Anolian","Anopheles","Antique Book","Antonio","Anubis","Apocalipse","Aqua Elemental","Arc Angelring","Arc Elder","Archdam","Archer Skeleton","Arclouze","Argiope","Argos","Armeyer Dinze","Assaulter","Aster","Aunoe","Baby Desert Wolf","Baby Leopard","Bakonawa","Banaspaty","Bangungot","Banshee","Banshee Master","Baphomet Jr.","Baroness of Retribution","Bathory","Beetle King","Beholder","Beholder Master","Big Bell","Big Ben","Big Eggring","Bigfoot","Blazzer","Bloody Butterfly","Bloody Knight","Bloody Murderer","Blue Acidus","Bongun","Bow Guardian","Bradium Golem","Breeze","Brilight","Bungisngis","Butoijo","Buwaya","Byorgue","Caramel","Carat","Cat O' Nine Tails","Caterpillar","Cecil Damon","Celia","Cendrawasih","Cenere","Centipede","Centipede Larva","Charge Basilisk","Charleston","Chen","Chepet","Chimera","Choco","Chonchon","Christmas Cookie","Chun Tree","Clock","Cloud Hermit","Cobalt Mineral","Coco","Comodo","Condor","Cookie","Cornus","Cornutus","Crab","Cramp","Creamy","Creamy Fear","Cruiser","Daehyon","Dame of Sentinel","Dark Coelacanth","Dark Frame","Dark Illusion","Dark Pinguicula","Dark Priest","Dark Shadow","Death Word","Demon Fungus","Desert Wolf","Despero of Thanatos","Deviace","Devilring","Deviruchi","Diabolic","Diego","Dimik","Disguise","Dokkaebi","Dolomedes","Dolor of Thanatos","Draco","Draco Egg","Dragon Egg","Dragon Tail","Dragonfly","Drainliar","Driller","Drops","Drosera","Dryad","Dullahan","Dumpling Kid","Duneyrr","Dustiness","Earth Deleter","Earth Petite","Echio","Eclipse","Eggring","Eggyra","Egnigem Cenia","Elder","Elder Willow","Elvira","Enchanted Peach Tree","Engkanto","Entweihen Crothen","Eremes Guile","Errende Ebecee","Evil Druid","Evil Nymph","Executioner","Explosion","Fabre","Faithful Manager","Fake Valkyrie","False Angel","Familiar","Fanat","Female Thiefbug","Firelock Soldier","Flame Skull","Flamel","Flora","Freezer","Frilldora","Frozen Wolf","Fruit Pom Spider","Frus","Fur Seal","Gajomart","Galapago","Galion","Gargoyle","Gazeti","Gemini-S58","Geographer","Gertie","Ghostring","Ghoul","Giant Hornet","Giant Octopus","Giant Spider","Giant Whisper","Gibbet","Giearth","Gig","Goat","Goblin","Goblin Archer","Goblin Leader","Goblin Steamrider","Gold Acidus","Gold Scaraba","Golem","Grand Peco","Grass Fabre","Greatest General","Green Ferus","Green Maiden","Gremlin","Grizzly","Grove","Grudge of Royal Knight","Gryphon","Gullinbursti","Hardrock Mammoth","Harpy","Hatii Bebe","Heater","Heavy Metalring","Hell Apocalypse","Hell Poodle","Hermit Plant","High Orc","Hill Wind","Hillslion","Hode","Hodremlin","Holden","Horn","Hornet","Horong","Howard Alt-Eisen","Hunter Fly","Hunter Wolf","Hydra","Hydrolancer","Hylozoist","Ice Titan","Immortal Corps","Imp","Incubus","Injustice","Iron Fist","Isilla","Isis","Jakk","Jejeling","Jing Guai","Joker","Jungle Mandragora","Kaho","Kapha","Karakasa","Kasa","Kathryne Keyron","Kavach Icarus","Khalitzburg","Khalitzburg Knight","Killer Mantis","King Dramoh","Knocker","Kobold","Kobold Archer","Kobold Leader","Kraben","Kukre","Lady Solace","Laurell Weinder","Lava Golem","Leaf Cat","Leaf Lunatic","Leib Olmai","Lichtern Blue","Lichtern Green","Lichtern Red","Lichtern Yellow","Little Fatum","Lock Step","Loli Ruri","Luciola Vespa","Lude","Lunatic","Maero of Thanatos","Magmaring","Magnolia","Majoruros","Male Thiefbug","Manananggal","Mandragora","Mangkukulam","Manny","Mantis","Mao Guai","Marc","Marduk","Margaretha Sorin","Marin","Marina","Marine Sphere","Marionette","Marse","Martin","Mastering","Matyr","Maya Purple","Medusa","Megalith","Megalodon","Menblatt","Merman","Metaling","Metaller","Mi Gao","Mimic","Miming","Mineral","Mini Demon","Minorous","Mistress of Shelter","Miyabi Doll","Mobster","Muka","Mummy","Munak","Muscipular","Mutant Coelacanth","Mutant Dragonoid","Myst","Myst Case","Mysteltainn","Naga","Naght Seiger","Necromancer","Neo Punk","Nepenthes","Nereid","Nightmare","Nightmare Terror","Nine Tail","Novice Poring","Noxious","Obeaune","Obsidian","Octopus","Odium of Thanatos","Ogretooth","Orc Archer","Orc Baby","Orc Lady","Orc Skeleton","Orc Warrior","Orc Zombie","Owl Baron","Owl Duke","Owl Marquees","Owl Viscount","Panzer Goblin","Parasite","Parus","Pasana","Pecopeco","Pecopeco Egg","Penomena","Permeter","Pest","Petal","Phen","Phendark","Phylla","Picky","Picky Egg","Pinguicula","Pirate Skel","Pitman","Plankton","Plasma","Poison Spore","Poisonous Toad","Pom Spider","Poporing","Porcellio","Poring","Pot Dofle","Punk","Pupa","Quve","Rafflesia","Rafflesia Alnoldi","Raggler","Randel","Rata","Raydric","Raydric Archer","Red Eruma","Red Ferus","Red Novus","Remover","Requiem","Rhyncho","Rideword","Rocker","Roda Frog","Rotar Zairo","Roween","RSX-0806","Rudo","Rybio","Sage Worm","Salamander","Sandman","Santa Poring","Sarah","Sasquatch","Savage","Savage Babe","Scaraba","Scorpion","Scorpion King","Scout Basilisk","Scrat","Sea-Otter","Sedora","Seeker","Seyren Windsor","Shell Fish","Shinobi","Sid","Sidewinder","Siorava","Siroma","Skeggiold","Skel Prisoner","Skel Worker","Skeleton","Skeleton General","Skogul","Sky Deleter","Sky Petite","Sleeper","Smokie","Snake","Snowier","Sohee","Soheon","Soldier Andre","Soldier Skeleton","Solider","Spore","Spring Rabbit","Sropho","Stainer","Stalactic Golem","Stapo","Steel Chonchon","Stem Worm","Step","Sting","Stone Shooter","Strouf","Succubus","Sweet Roda Frog","Sword Guardian","Swordfish","Taffy","Tamruan","Tarou","Tatacho","Teddy Bear","Tendrillion","Tengu","Thara Frog","The Paper","Thief Bug","Thiefbug Egg","Tikbalang","Time Keeper","Tiyanak","Toad","Tower Keeper","Trance Spore","Trentini","Tri Joint","Ungoliant","Vadon","Val'khiri","Vanberk","Venatu","Venomous","Verit","Violent Coelacanth","Violy","Vitata","Vocal","Wakwak","Wanderer","Wandering Wolf","Warrior Lola","Waste Stove","Watcher","Weird Coelacanth","Whisper","White Knight","Wickebine Tres","Wild Honet","Wild Rider","Wild Rose","Willow","Wind Ghost","Wolf","Wooden Golem","Wootan Fighter","Wootan Shooter","Wormtail","Wraith","Wraith Dead","Yao Jun","Yellow Novus","Yoyo","Zakudam","Zealotus","Zenorc","Zerom","Zhu Po Long","Zipper Bear","Zombie","Zombie Guard","Zombie Master","Zombie Prisoner","Zombie Slaughter"])},{id:"mvp",text:"¿Qué MVP respetas más?",options:Zr(["Amdarais","Amon Ra","Ancient King Groza","Archbishop Margaretha","Assassin Cross","Atroce","Baphomet","Beelzebub","Bijou","Boitata","Champion","Chaos Baphomet","Clown","Contaminated Spider Queen","Corruption Root","Creator","Dark Lord","Dark Snake Lord","Despair God Morocc","Detardeurus","Doppelganger","Dracula","Drake","Eddga","Faceworm Queen","Fallen Bishop","Fenrir","General Daehyon","Genetic Flamel","Gioia","Gloom Under Night","Gold Queen Scaraba","Golden Thief Bug","Gopinich","Grim Reaper Ankou","Guardian Kades","Guillotine Cross Eremes","Gypsy","Hatii","High Priest","High Wizard","Ifrit","Incantation Samurai","Kiel-D-01","Kraken","Ktullanux","Lady Tanee","Leak","Lord Knight","Lord Morocc","Lord of the Dead","Mastersmith","Maya","Mechanic Howard","Memory of Thanatos","Minstrel Alphoccio","Mistress","Moonlight Flower","Muspellskoll","Nidhoggur Shadow","Orc Hero","Orc Lord","Osiris","Paladin","Pharaoh","Phreeoni","Professor","Pyuriel","Queen Scaraba","Randgris","Ranger Cecil","Royal Guard Randel","Rune Knight Seyren","Shadow Chaser Gertie","Sniper","Sorcerer Celia","Stalker","Stormy Knight","Sura Chen","Tao Gunka","Timeholder","Turtle General","Vesper","Wanderer Trentini","Warlock Kathryne","White Lady"])},{id:"job",text:"¿Qué job te gusta más?",options:Zr(["Alchemist","Assassin","Bard","Blacksmith","Crusader","Dancer","Gunslinger","Hunter","Knight","Monk","Ninja","Priest","Rogue","Sage","Super Novice","Wizard"])},{id:"pet",text:"¿Qué pet tendrías?",options:Zr(["Baby Desert Wolf","Dokebi","Drops","Familiar","Lunatic","Munak","Nine Tail","Picky","Poporing","Poring","Rocker","Savage Babe","Smokie","Sohee","Spore","Whisper"])}];function tq(a){const e=[...a];for(let t=e.length-1;t>0;t--){const s=Math.floor(Math.random()*(t+1));[e[t],e[s]]=[e[s],e[t]]}return e}function Am(a){const e=Lm.map(s=>tq(s.options)),t=()=>{const s=gh(a,!0);a.innerHTML="",Lm.forEach((n,o)=>{const i=document.createElement("label");i.className="sp-field rq-field",i.append(c(n.text));const r=document.createElement("select");r.name=`q${o}`,r.className="ro-select";const l=new Option(c("Elige…"),"");l.disabled=!0,r.add(l);for(const[d,h]of e[o])r.add(new Option(h,d));r.value=s[o]??"",r.value||(l.selected=!0),i.append(r),a.append(i)})};t(),window.addEventListener("ro-lang",t)}function gh(a,e=!1){const t=Lm.map((s,n)=>{var o;return((o=a.querySelector(`select[name="q$ {
    n
  }
  "]`))==null?void 0:o.value)||void 0});return e||t.every(Boolean)?t:null}function Pm(a){for(const e of a.querySelectorAll("select"))e.selectedIndex=0}const sq="/splash/endless-tower.jpg",aq="/splash/endless-tower-mask.svg",fp=1584,gp=672,vb=[1015,70],nq=560,oq="(max-width: 820px), (max-height: 560px) and (max-width: 1100px)",iq=4,bb=.3,rq="attribute vec2 a;void main() {
    gl_Position=vec4(a,0.,1.);
  }
  ",lq=`precision mediump float;
uniform sampler2D uImg, uMask;
uniform vec2 uRes, uPos, uImgSize, uCenter;
uniform float uRadius, uTime, uSec;
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  // del píxel del lienzo al de la imagen, como background-size: cover y background-position
  float s = max(uRes.x / uImgSize.x, uRes.y / uImgSize.y);
  vec2 img = (p - (uRes - uImgSize * s) * uPos) / s;
  vec2 d = (img - uCenter) * vec2(1.0, 2.0);
  float r = length(d) / uRadius;
  float fall = 1.0 - smoothstep(0.0, 1.0, r);
  fall *= fall;
  // dos fases desfasadas que se funden: gira sin parar y la imagen nunca se retuerce
  float t1 = fract(uTime), t2 = fract(uTime + 0.5);
  vec2 d1 = rot(d, -t1 * ${bb.toFixed(3)} * fall) * vec2(1.0, 0.5);
  vec2 d2 = rot(d, -t2 * ${bb.toFixed(3)} * fall) * vec2(1.0, 0.5);
  vec4 c1 = texture2D(uImg, (uCenter + d1) / uImgSize);
  vec4 c2 = texture2D(uImg, (uCenter + d2) / uImgSize);
  vec3 col = mix(c1.rgb, c2.rgb, abs(1.0 - 2.0 * t1));
  // un brillo morado que late despacio en el ojo del remolino
  col += vec3(0.16, 0.06, 0.24) * fall * (0.55 + 0.45 * sin(uSec * 0.9));
  // solo dentro del remolino y fuera de la torre (la máscara es opaca salvo en ella)
  float a = (1.0 - smoothstep(0.75, 1.0, r)) * texture2D(uMask, img / uImgSize).a;
  gl_FragColor = vec4(col * a, a);
}`;function wb(a){return new Promise((e,t)=>{const s=new Image;s.onload=()=>e(s),s.onerror=t,s.src=a})}class cq{constructor(e){g(this,"canvas");g(this,"gl");g(this,"uni",{});g(this,"ready",!1);g(this,"raf",0);g(this,"t0",performance.now());g(this,"frame",e=>{this.raf=requestAnimationFrame(this.frame);const t=this.gl;if(!t||!this.ready)return;const s=Math.max(1,Math.round(this.canvas.clientWidth/2)),n=Math.max(1,Math.round(this.canvas.clientHeight/2));(this.canvas.width!==s||this.canvas.height!==n)&&(this.canvas.width=s,this.canvas.height=n,t.viewport(0,0,s,n)),t.uniform2f(this.uni.uRes,s,n),t.uniform2f(this.uni.uPos,matchMedia(oq).matches?.66:.8,.5);const o=(e-this.t0)/1e3;t.uniform1f(this.uni.uTime,o/iq),t.uniform1f(this.uni.uSec,o%(200*Math.PI/.9)),t.drawArrays(t.TRIANGLE_STRIP,0,4)});this.canvas=document.createElement("canvas"),this.canvas.className="sp-swirl",e.appendChild(this.canvas),this.gl=this.canvas.getContext("webgl",{premultipliedAlpha:!0,alpha:!0,antialias:!1}),this.gl?this.init(this.gl).catch(()=>this.canvas.remove()):this.canvas.remove()}async init(e){const[t,s]=await Promise.all([wb(sq),wb(aq)]),n=document.createElement("canvas");n.width=fp,n.height=gp,n.getContext("2d").drawImage(s,0,0,fp,gp);const o=(d,h)=>{const u=e.createShader(d);if(e.shaderSource(u,h),e.compileShader(u),!e.getShaderParameter(u,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(u)??"shader");return u},i=e.createProgram();if(e.attachShader(i,o(e.VERTEX_SHADER,rq)),e.attachShader(i,o(e.FRAGMENT_SHADER,lq)),e.linkProgram(i),!e.getProgramParameter(i,e.LINK_STATUS))throw new Error("link");e.useProgram(i),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW);const r=e.getAttribLocation(i,"a");e.enableVertexAttribArray(r),e.vertexAttribPointer(r,2,e.FLOAT,!1,0,0);const l=(d,h)=>{e.activeTexture(e.TEXTURE0+d),e.bindTexture(e.TEXTURE_2D,e.createTexture()),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,h)};l(0,t),l(1,n);for(const d of["uImg","uMask","uRes","uPos","uImgSize","uCenter","uRadius","uTime","uSec"])this.uni[d]=e.getUniformLocation(i,d);e.uniform1i(this.uni.uImg,0),e.uniform1i(this.uni.uMask,1),e.uniform2f(this.uni.uImgSize,fp,gp),e.uniform2f(this.uni.uCenter,vb[0],vb[1]),e.uniform1f(this.uni.uRadius,nq),this.ready=!0}start(){this.raf||(this.raf=requestAnimationFrame(this.frame))}stop(){cancelAnimationFrame(this.raf),this.raf=0}}var kb={commit:"7967a1a",date:"2026-11-11T01:47:09.000Z"};const st={enabled:!1},dq=()=>{var a;return((a=st.current)==null?void 0:a.call(st))??null},xb="ro-splash-tab",hq={},Mb=[{id:"zombie",weight:6,speed:26},{id:"skeleton",weight:6,speed:40},{id:"skel_soldier",weight:4,speed:40},{id:"skel_archer",weight:4,speed:40},{id:"munak",weight:4,speed:30},{id:"bon_gun",weight:4,speed:30},{id:"sohee",weight:3,speed:44},{id:"orc_warrior",weight:3,speed:48},{id:"orc_lady",weight:2,speed:48},{id:"nine_tail",weight:3,speed:70},{id:"moonlight",weight:1,speed:52,size:1.3,mvp:!0},{id:"eddga",weight:1,speed:52,size:1.3,mvp:!0},{id:"drake",weight:1,speed:44,size:1.3,mvp:!0},{id:"golden_thief_bug",weight:1,speed:60,size:2,mvp:!0},{id:"mastering",weight:1,speed:46,size:2,mvp:!0}],ea=a=>document.getElementById(a);function Xf(a){return fetch(`assets/sprites/${a}.json`).then(e=>e.json()).then(e=>new Promise((t,s)=>{const n=new Image;n.onload=()=>t({img:n,json:e}),n.onerror=s,n.src=`assets/sprites/${e.image}`}))}class uq{constructor(e,t){g(this,"ctx");g(this,"flyCtx");g(this,"sheets",new Map);g(this,"walkers",[]);g(this,"last",0);g(this,"nextGroup",0);g(this,"raf",0);g(this,"w",0);g(this,"h",0);g(this,"ratio",1);g(this,"resize",()=>{const e=Math.min(2,devicePixelRatio||1);this.ratio=e,this.w=this.canvas.clientWidth,this.h=this.canvas.clientHeight;for(const[t,s]of[[this.canvas,this.ctx],[this.flyCanvas,this.flyCtx]])t.width=Math.round(this.w*e),t.height=Math.round(this.h*e),s.setTransform(e,0,0,e,0,0),s.imageSmoothingEnabled=!1});g(this,"frame",e=>{this.raf=requestAnimationFrame(this.frame),(this.canvas.clientWidth!==this.w||this.canvas.clientHeight!==this.h)&&this.resize();const t=Math.min(.05,(e-(this.last||e))/1e3);this.last=e,this.sheets.size&&e>=this.nextGroup&&this.walkers.length<18&&(this.spawnGroup(),this.nextGroup=e+1800+Math.random()*3200),this.ctx.clearRect(0,0,this.w,this.h),this.flyCtx.clearRect(0,0,this.w,this.h),this.walkers=this.walkers.filter(s=>s.x<this.w+80),this.walkers.sort((s,n)=>s.y-n.y);for(const s of this.walkers)s.x+=s.speed*t,s.time+=t*1e3,this.draw(s)});this.canvas=e,this.flyCanvas=t,this.ctx=e.getContext("2d"),this.flyCtx=t.getContext("2d");for(const s of Mb)Xf(s.id).then(n=>this.sheets.set(s.id,n)).catch(()=>{});this.start()}start(){this.raf||(this.last=0,this.resize(),window.addEventListener("resize",this.resize),this.raf=requestAnimationFrame(this.frame))}stop(){cancelAnimationFrame(this.raf),this.raf=0,window.removeEventListener("resize",this.resize),this.canvas.width=this.canvas.height=this.flyCanvas.width=this.flyCanvas.height=0,this.w=this.h=0}pick(e=!0){const t=Mb.filter(n=>this.sheets.has(n.id)&&(e||!n.mvp));let s=Math.random()*t.reduce((n,o)=>n+o.weight,0);return t.find(n=>(s-=n.weight)<0)??t[0]}spawnGroup(){const e=Math.random()<.5?this.pick():null,t=e!=null&&e.mvp?1:1+Math.floor(Math.random()*4),s=.76+Math.random()*.12;for(let n=0;n<t;n++){const o=e??this.pick(!1);if(!o)return;const i=Math.min(.9,Math.max(.74,s+(Math.random()-.5)*.05)),r=(1.8+(i-.72)*2.5)*Math.max(.75,Math.min(1.25,this.h/900))*(o.size??1),l=Math.max(1,Math.round(r*this.ratio))/this.ratio;this.walkers.push({sheet:this.sheets.get(o.id),x:-40-n*(34+Math.random()*30)*l,y:i*this.h,alt:o.fly?(.04+Math.random()*.04)*this.h:0,speed:o.speed*(.85+Math.random()*.3)*l,scale:l,time:Math.random()*1e3,fly:!!o.fly})}}draw(e){const{json:t,img:s}=e.sheet,n=t.actions.walk??t.actions.idle,o=n.dirs[6%n.dirs.length]??n.dirs[0],i=t.frames[o[Math.floor(e.time/Math.max(30,n.delay))%o.length]];if(!i)return;const[r,l,d,h,u,p]=i,y=this.ctx,w=e.y;y.fillStyle="rgba(30, 40, 70, 0.22)",y.beginPath(),y.ellipse(e.x,w,13*e.scale,4.5*e.scale,0,0,Math.PI*2),y.fill();const m=e.fly?Math.sin(e.time/260)*6*e.scale:0,f=e.fly?this.flyCtx:y,v=Math.round(e.x-u*e.scale),x=Math.round(e.y-e.alt+m-p*e.scale),k=Math.round(d*e.scale),M=Math.round(h*e.scale);i[7]===1?(f.save(),f.translate(v+k,x),f.scale(-1,1),f.drawImage(s,r,l,d,h,0,0,k,M),f.restore()):f.drawImage(s,r,l,d,h,v,x,k,M)}}let ha=null,ua=null,yp=null;function pq(){return Promise.resolve(()=>{})}function mq(){}function fq(a){const e=a.querySelector(".sp-lang-btn"),t=a.querySelector(".sp-lang-list");t.innerHTML=hw.map(o=>`<li role="option" tabindex="-1" data-lang="${o.id}">${o.name}<small>${o.id.toUpperCase()}</small></li>`).join("");const s=[...t.querySelectorAll("li")],n=o=>{var i;t.classList.toggle("hidden",!o),e.setAttribute("aria-expanded",String(o)),o&&((i=s.find(r=>r.getAttribute("aria-selected")==="true")??s[0])==null||i.focus())};e.onclick=o=>{o.stopPropagation(),n(t.classList.contains("hidden"))},t.onclick=o=>{const i=o.target.closest("[data-lang]");i&&($n({lang:i.dataset.lang}),n(!1),e.focus())},t.onkeydown=o=>{var r,l;const i=s.indexOf(document.activeElement);o.key==="ArrowDown"||o.key==="ArrowUp"?(o.preventDefault(),(r=s[(i+(o.key==="ArrowDown"?1:s.length-1))%s.length])==null||r.focus()):o.key==="Enter"||o.key===" "?(o.preventDefault(),o.stopPropagation(),(l=document.activeElement)==null||l.click()):o.key==="Escape"&&(o.stopPropagation(),n(!1),e.focus())},document.addEventListener("pointerdown",o=>{a.contains(o.target)||n(!1)}),fr(o=>{e.querySelector("b").textContent=o.lang.toUpperCase();for(const i of s)i.setAttribute("aria-selected",String(i.dataset.lang===o.lang))})}function gq(a,e,t){return/^\w{3,16}$/.test(a)?qk(a,"light")?c("Ese nombre no está permitido."):e.length<8?c("La contraseña necesita al menos 8 caracteres."):t!==void 0&&e!==t?c("Las contraseñas no coinciden."):"":c("El usuario lleva de 3 a 16 letras, números o _.")}function yq(a,e,t){const s=[...a.querySelectorAll("[data-sp-tab]")],n=a.querySelector(".sp-soon"),o=x=>{const k=x==="recover"?"login":x;for(const M of s)M.classList.toggle("active",M.dataset.spTab===k),M.setAttribute("aria-selected",String(M.dataset.spTab===k));for(const M of a.querySelectorAll("[data-sp-pane]"))M.classList.toggle("hidden",M.dataset.spPane!==x);if(n.classList.toggle("hidden",x==="guest"||st.enabled),e(k),x!=="recover")try{localStorage.setItem(xb,x)}catch{}};for(const x of s)x.onclick=()=>o(x.dataset.spTab);let i=null;try{i=localStorage.getItem(xb)}catch{}o(st.enabled&&(i==="login"||i==="register")?i:"guest");const r=(x,k)=>{const M=x.querySelector("fieldset"),$=x.querySelector(".sp-error");M.disabled=!st.enabled,x.onsubmit=async P=>{if(P.preventDefault(),!st.enabled)return;$.textContent="";const q=new FormData(x);M.disabled=!0;try{const R=k(q);typeof R=="string"?$.textContent=R:(await R,t())}catch(R){$.textContent=R instanceof Error?R.message:c("No se pudo conectar con el servidor.")}finally{M.disabled=!1}}},l=(x,k)=>String(x.get(k)??"");r(a.querySelector("#sp-login"),x=>{const[k,M]=[l(x,"username").trim(),l(x,"password")];return!k||!M?c("Escribe tu usuario y tu contraseña."):st.login(k,M)});const d=a.querySelector("#sp-register"),h=d.querySelector("[data-questions]");Am(h);const u=d.querySelector("[name=questions]"),p=()=>{h.classList.toggle("hidden",!u.checked),a.querySelector("#sp-rq-help").classList.toggle("hidden",!u.checked),a.querySelector("#sp-rq-declined").classList.toggle("hidden",u.checked)};u.onchange=p,p(),r(d,x=>{const[k,M,$]=[l(x,"username").trim(),l(x,"password"),l(x,"password2")],P=x.get("questions")==="on",q=P?gh(h):null,R=gq(k,M,$)||(P&&!q?c("Contesta las 5 preguntas de seguridad."):"");return R||(!P&&!confirm(c("¿Crear la cuenta sin preguntas de seguridad? Es permanente: no podrás añadirlas después y, si pierdes la contraseña, no se podrá recuperar la cuenta."))?"":st.register(k,M,x.get("upload")==="on",q).then(()=>Pm(h)))});const y=a.querySelector("#sp-recover"),w=a.querySelector("#sp-reset"),m=y.querySelector("[data-questions]");Am(m);let f="";const v=x=>{y.classList.toggle("hidden",x!==1),w.classList.toggle("hidden",x!==2);for(const k of[y,w])k.querySelector(".sp-error").textContent="";x===1?(f="",w.reset()):w.querySelector("[name=password]").focus()};return a.querySelector("#sp-forgot").onclick=()=>{const x=a.querySelector("#sp-login [name=username]").value.trim(),k=y.querySelector("[name=username]");x&&!k.value&&(k.value=x),v(1),o("recover")},a.querySelector("#sp-recover-back").onclick=()=>{v(1),o("login")},y.onsubmit=async x=>{x.preventDefault();const k=y.querySelector(".sp-error"),M=y.querySelector("fieldset"),$=y.querySelector("[name=username]").value.trim(),P=gh(m);if(k.textContent=/^\w{3,16}$/.test($)?P?"":c("Contesta las 5 preguntas de seguridad."):c("El usuario lleva de 3 a 16 letras, números o _."),!(k.textContent||!st.enabled)){M.disabled=!0;try{f=await st.checkRecovery($,P),Pm(m),w.querySelector("[name=username]").value=$,v(2)}catch(q){k.textContent=q instanceof Error?q.message:c("No se pudo conectar con el servidor.")}finally{M.disabled=!1}}},r(w,x=>{const[k,M]=[l(x,"password"),l(x,"password2")];return k.length<8?c("La contraseña necesita al menos 8 caracteres."):k!==M?c("Las contraseñas no coinciden."):st.recover(f,k).then(()=>{v(1),y.reset(),o("login")},$=>{throw $ instanceof Error&&$.message===c("Ha pasado demasiado tiempo. Vuelve a contestar las preguntas.")&&(v(1),y.querySelector(".sp-error").textContent=$.message),$})}),o}function vq(a){const e=document.createElement("div");e.className="ro-btn primary sp-submit sp-update";const t=document.createElement("i");t.className="sp-fill";const s=document.createElement("span");e.append(t,s),a.querySelector(".sp-logo").append(e);const n=()=>{const{state:o,progress:i}=Do;a.classList.toggle("sp-checking",o==="checking"),a.classList.toggle("sp-updating",o==="updating"),document.body.classList.toggle("sp-updating",o==="updating");const r=Math.round(i*100);s.textContent=c("Actualizando… {p}%",{p:r}),t.style.transform=`scaleX(${r/100})`};window.addEventListener("ro-update",n),window.addEventListener("ro-lang",n),n()}function bq(){const a=ea("splash");document.body.classList.add("sp-on");const e=ea("sp-play"),t=e.querySelector("span"),s=e.querySelector(".sp-fill");let n=0,o="loading",i="";vq(a);const r=a.querySelector(".sp-motes");for(let L=0;L<18;L++){const j=document.createElement("i");j.style.left=`${Math.random()*100}%`,j.style.animationDuration=`${9+Math.random()*10}s`,j.style.animationDelay=`${-Math.random()*18}s`,r.appendChild(j)}ha=new uq(ea("sp-parade"),ea("sp-parade-fly")),matchMedia("(prefers-reduced-motion: reduce)").matches||(ua=new cq(a.querySelector(".sp-bg")));for(const[L,j]of Object.entries(hq))for(const A of document.querySelectorAll(`.sp-links .${L}`))j?A.href=j:(A.classList.add("off"),A.setAttribute("aria-disabled","true"),A.title=c("Próximamente"));ea("sp-version").textContent=`v${kb.date.slice(0,10).replaceAll("-",".")} · ${kb.commit}`;const l=ea("sp-maint"),d=()=>{const L=lm()&&o==="ready";t.textContent=L?c("En mantenimiento"):o==="ready"?c("¡Jugar!"):o==="error"?i:c("Cargando… {p}%",{p:n}),o==="ready"&&(e.disabled=L),e.classList.toggle("maint",L),s.style.transform=`scaleX(${n/100})`;const j=Ky();a.classList.toggle("sp-maint-on",j.state==="maintenance");const A=`${j.state}|${j.at}|${j.message}|${Te.lang}`;A!==h&&(h=A,w(j)),u&&(u.textContent=`${c("Dentro de {left}",{left:o1()})} · ${Ai(j)||c("El servidor se actualizará.")}`)};let h="",u=null;const p=(L,j,A="")=>{const E=document.createElement(L);return E.className=j,E.textContent=A,E},y=async L=>{const{img:j,json:A}=await Xf("poring"),E=A.actions.walk??A.actions.idle,C=E.dirs[0],_=L.getContext("2d");_.imageSmoothingEnabled=!1;const U=performance.now(),D=I=>{if(!L.isConnected)return;const N=A.frames[C[Math.floor((I-U)/Math.max(30,E.delay))%C.length]];if(_.clearRect(0,0,L.width,L.height),_.fillStyle="rgba(30, 40, 70, 0.18)",_.beginPath(),_.ellipse(32,52,13,4,0,0,Math.PI*2),_.fill(),N){const[V,F,Y,Q,Z,ke]=N;_.drawImage(j,V,F,Y,Q,Math.round(32-Z),Math.round(52-ke),Y,Q)}requestAnimationFrame(D)};requestAnimationFrame(D)},w=L=>{if(l.replaceChildren(),u=null,l.className=`sp-maint ${L.state}${L.state==="ok"?" hidden":""}`,L.state==="maintenance"){const j=p("div","sp-maint-art"),A=document.createElement("canvas");A.width=A.height=64,j.append(A),y(A);const E=p("div","sp-maint-dots");E.append(p("i",""),p("i",""),p("i",""));const C=p("button","ro-btn primary sp-submit sp-maint-retry",c("Volver a comprobar"));C.onclick=async()=>{if(C.disabled=!0,C.textContent=c("Comprobando…"),(await oL()).state!=="maintenance")return location.reload();C.textContent=c("Seguimos en ello"),setTimeout(()=>{C.disabled=!1,C.textContent=c("Volver a comprobar")},2500)},l.append(j,p("b","sp-maint-title",c("En mantenimiento")),p("p","sp-maint-text",Ol(L)),E,C)}else L.state==="warn"?(u=p("span","sp-maint-left"),l.append(p("b","sp-maint-when",c("Mantenimiento a las {time}",{time:n1(L)})),u)):L.state==="info"&&l.append(p("b","sp-maint-when",c("Aviso")),p("span","sp-maint-left",Ai(L)))};a1(()=>d()),setInterval(()=>Ky().state==="warn"&&d(),1e3),fq(ea("sp-lang")),mq(),fr(()=>d()),d();const m=L=>{L==="menu"&&a.classList.remove("hidden","leaving"),a.classList.add("menu"),document.body.classList.toggle("sp-backdrop",L==="menu"),document.body.classList.toggle("sp-on",L==="menu"),L==="menu"?(ha==null||ha.start(),ua==null||ua.start()):(ha==null||ha.stop(),ua==null||ua.stop(),a.classList.add("hidden"))},f=()=>{e.onclick=null,window.removeEventListener("keydown",k),m("menu")};let v="guest",x=null;const k=L=>{var j;((j=L.target)==null?void 0:j.tagName)!=="INPUT"&&v==="guest"&&o==="ready"&&(L.key==="Enter"||L.key===" ")&&e.click()};window.addEventListener("keydown",k);const M=yq(a,L=>v=L,()=>{o==="ready"&&e.click()}),$=a.querySelector('[data-sp-tab="guest"]'),P=a.querySelector('[data-sp-tab="login"]'),q=ea("sp-leave"),R=()=>{var j;$.textContent=dq()??c("Invitado");const L=!!((j=st.current)!=null&&j.call(st));P.classList.toggle("hidden",L),q.classList.toggle("hidden",!L),L&&v==="login"&&M("guest")};return R(),window.addEventListener("ro-account",R),window.addEventListener("ro-lang",R),q.onclick=async()=>{var L;q.disabled=!0;try{await((L=st.logout)==null?void 0:L.call(st))}finally{q.disabled=!1}M("guest")},{progress(L){n=Math.round(L*100),d()},fail(L){o="error",i=L,e.disabled=!1,e.onclick=()=>void im(!0).then(j=>j||location.reload()),d()},ready(L){o="ready",n=100,e.disabled=!1,e.classList.add("ready"),d(),x=()=>{lm()||(f(),L())},e.onclick=x},welcome(L="guest"){M(L),a.classList.remove("menu","hidden","leaving"),document.body.classList.remove("sp-backdrop"),document.body.classList.add("sp-on"),ha==null||ha.start(),ua==null||ua.start(),e.onclick=x,window.addEventListener("keydown",k)},menu(){f()},hide(){e.onclick=null,window.removeEventListener("keydown",k),m("off")}}}const $l=a=>document.getElementById(a);let $b=!1;function wq(a,e){const t=a.querySelector("fieldset"),s=a.querySelector(".sp-error");a.onsubmit=async n=>{n.preventDefault(),s.textContent="";const o=new FormData(a);t.disabled=!0;try{await e(o)}catch(i){s.textContent=i instanceof Error?i.message:String(i)}finally{t.disabled=!1}}}const _x=a=>{(a.key==="Escape"||a.key==="Enter")&&a.stopImmediatePropagation()};function kq(){if($b)return;$b=!0;const a=$l("acc-questions"),e=a.querySelector("[data-questions]");Am(e),wq(a,async()=>{const t=gh(e);if(!t)throw new Error(c("Contesta las 5 preguntas de seguridad."));return await DL(t),a.reset(),Pm(e),Sb(),alert(c("Preguntas de seguridad guardadas. Recuerda tus respuestas: son la única forma de recuperar la cuenta.")),""}),$l("acc-decline").onclick=async()=>{if(!confirm(c("¿Seguro que no quieres preguntas de seguridad? Es permanente: no te las volveremos a ofrecer y, si pierdes la contraseña, no se podrá recuperar la cuenta.")))return;const t=a.querySelector(".sp-error");t.textContent="";try{await OL(),Sb()}catch(s){t.textContent=s instanceof Error?s.message:String(s)}}}function xq(a){if(Pa()){kq();for(const e of document.querySelectorAll("#account-popup .sp-error"))e.textContent="";$l("acc-why-none").classList.toggle("hidden",a!=="none"),$l("acc-why-reset").classList.toggle("hidden",a!=="reset"),Ue("account-popup"),$l("account-popup").querySelector(".ro-body").scrollTop=0,window.addEventListener("keydown",_x,!0)}}function Sb(){de("account-popup"),window.removeEventListener("keydown",_x,!0)}function Mq(){const a=NL();(a==="none"||a==="reset")&&xq(a)}const Pd=["poring","drops","poporing"],qx="ro-life.profile.v1";function $q(){try{const a=JSON.parse(localStorage.getItem(qx)??"{}");return{portrait:Pd.includes(a.portrait??"")?a.portrait:Pd[0]}}catch{return{portrait:Pd[0]}}}function Sq(a){try{localStorage.setItem(qx,JSON.stringify(a))}catch{}}const vp=new Map,Eq=a=>(vp.has(a)||vp.set(a,Xf(a)),vp.get(a));async function Eb(a,e){const{img:t,json:s}=await Eq(e),o=(s.actions.idle??Object.values(s.actions)[0]).dirs[0].map(f=>s.frames[f]).filter(Boolean),[i,r,l,d]=o.reduce((f,v)=>v[2]*v[3]>f[2]*f[3]?v:f),h=Math.min(d,Math.round(l*1.15)),u=a.getContext("2d"),p=a.width;u.clearRect(0,0,p,p),u.imageSmoothingEnabled=!1;const y=Math.min(p*.78/l,p*.78/h,6),w=l*y,m=h*y;u.drawImage(t,i,r,l,h,Math.round((p-w)/2),Math.round((p-m)/2+p*.04),Math.round(w),Math.round(m))}function Tq(a){const e=d=>document.getElementById(d);let t=$q();const s=e("pb-portrait").querySelector("canvas"),n=()=>{Eb(s,t.portrait);const d=Pa();e("pb-name").textContent=d?d.name:c("Invitado"),e("pb-kind").textContent=c("Personajes {n}/{max}",{n:$a().length,max:C1}),e("pb-register").classList.toggle("hidden",!!d),e("pb-exit").title=d?c("Cerrar la sesión y volver a la portada"):c("Volver a la portada");const h=es(),u=ts.filter(p=>rr(p,h)).length;e("pb-ach-fill").style.width=`${ts.length?u/ts.length*100:0}%`,e("pb-ach-text").textContent=`${u}/${ts.length}`,e("pb-kafra").innerHTML=`<b>${Ho().toLocaleString(Te.lang)}</b> ${c("Puntos Kafra")}`};n(),window.addEventListener("ro-lang",n),window.addEventListener("ro-account",n),new MutationObserver(()=>{document.getElementById("charselect").classList.contains("hidden")||(n(),Mq())}).observe(document.getElementById("charselect"),{attributes:!0,attributeFilter:["class"]}),new MutationObserver(n).observe(e("slots"),{childList:!0});const o=e("pb-grid"),i=()=>{o.innerHTML="";for(const d of Pd){const h=document.createElement("button");h.className="pb-tile"+(d===t.portrait?" active":""),h.dataset.id=d;const u=document.createElement("canvas");u.width=u.height=128,h.appendChild(u),o.appendChild(h),Eb(u,d)}},r=()=>{de("portrait-picker"),window.removeEventListener("keydown",l,!0)},l=d=>{(d.key==="Escape"||d.key==="Enter")&&(d.stopImmediatePropagation(),d.key==="Escape"&&r())};e("pb-portrait").onclick=()=>{i(),Ue("portrait-picker"),window.addEventListener("keydown",l,!0)},o.onclick=d=>{const h=d.target.closest(".pb-tile");h&&(t={...t,portrait:h.dataset.id},Sq(t),n(),r())},e("pb-close").onclick=r,e("pb-register").onclick=a.onCreateAccount,e("pb-exit").onclick=a.onExit}const Ix=`# Changelog

Novedades de RO LIFE. Se muestran en el juego (botón «Novedades»), una pestaña por día, la más reciente primero.
Cada punto empieza con una etiqueta: \`[Nuevo]\`, \`[Cambio]\`, \`[Mejora]\` o \`[Arreglo]\` (se muestran en color).

## 12/11 — 12 de noviembre de 2026

Formad grupo y jugad las fases juntos.

### En grupo
- [Nuevo] Toca a otro jugador en la plaza para invitarlo a tu grupo (hasta 3 personas).
- [Nuevo] Canal de grupo, solo para los miembros.
- [Nuevo] Fases cooperativas: el líder elige la fase y, cuando todos confirman, salís juntos.

### Prontera
- [Nuevo] La plaza se divide en varios canales; toca el número de jugadores bajo el nombre del lugar para cambiar de canal.
- [Nuevo] Mensajes sin conexión: deja un mensaje a un amigo desconectado y lo recibirá al entrar en la plaza.
- [Nuevo] Denunciar a jugadores que molestan en la plaza.

### Además
- [Mejora] Los recursos se cargan desde una CDN: carga más rápida y al recargar no se descarga todo otra vez.

## 11/11 — 11 de noviembre de 2026

Primera versión pública de RO LIFE.

### La partida
- [Nuevo] 14 clases, 13 fases y la Endless Tower; chino tradicional por defecto.
- [Nuevo] Inicio de sesión con Google o LINE; la partida se guarda en la nube y puedes seguir en otro dispositivo.

### Prontera
- [Nuevo] Plaza multijugador: ves a otros aventureros moverse, cambiar de aspecto y usar emotes; con sesión iniciada puedes chatear en público.
- [Nuevo] Amigos, mensajes privados y ver el perfil de otros jugadores.

### Arreglos
- [Arreglo] En algunas direcciones la portada se quedaba bloqueada y no se podía empezar a jugar.
- [Arreglo] Los iconos de pociones, elixires y bendiciones de la barra rápida salían rotos.
`,Cq=`# Changelog

What's new in RO LIFE. Shown in the game ("News" button), one tab per day, newest first.
Each entry starts with a tag: \`[New]\`, \`[Change]\`, \`[Improvement]\` or \`[Fix]\` (shown as a coloured label).

## Nov 12 — November 12, 2026

Team up and clear stages together.

### Party
- [New] Tap another player in the plaza to invite them to your party (up to 3).
- [New] Party chat, visible only to members.
- [New] Co-op stages: the leader picks a stage and, once everyone is ready, the party heads out together.

### Prontera
- [New] The plaza is split into channels; tap the player count under the place name to switch.
- [New] Offline messages: leave a message for an offline friend and they get it next time they enter the plaza.
- [New] Report players who cause trouble in the plaza.

### Other
- [Improvement] Assets now load from a CDN: faster loading, and reloading no longer downloads everything again.

## Nov 11 — November 11, 2026

First public release of RO LIFE.

### Game
- [New] 14 classes, 13 stages and the Endless Tower; Traditional Chinese by default.
- [New] Sign in with Google or LINE; your save is kept in the cloud so you can continue on another device.

### Prontera
- [New] Multiplayer plaza: see other adventurers walk, change outfits and emote; signed-in players can chat in public.
- [New] Friends, whispers and viewing other players' profiles.

### Fixes
- [Fix] On some addresses the title screen got stuck and the game would not start.
- [Fix] Potion, elixir and blessing icons on the quick bar showed as broken images.
`,Lq=`# 更新紀錄

仙境人生 RO LIFE 的更新紀錄，顯示在遊戲的「最新消息」，一天一個分頁，最新的在最前面。
每個項目以標籤開頭：\`[新增]\`、\`[調整]\`、\`[改善]\` 或 \`[修正]\`（顯示為彩色標籤）。

## 11/12 — 2026 年 11 月 12 日

組隊一起打關卡。

### 組隊
- [新增] 在廣場點選其他玩家，可以邀請組隊（最多 3 人）。
- [新增] 隊伍頻道，只有隊員看得到。
- [新增] 合作關卡：隊長選好關卡，全員按好後一起出發。

### 普隆德拉
- [新增] 廣場分成多個頻道，點地點名稱下方的人數就能換頻道。
- [新增] 離線留言：好友不在線上也能留言，對方下次進廣場就會收到。
- [新增] 檢舉在廣場鬧事的玩家。

### 其他
- [改善] 素材改由 CDN 載入，載入更快；重新整理不必全部重新下載。

## 11/11 — 2026 年 11 月 11 日

仙境人生 RO LIFE 公開。

### 遊戲
- [新增] 14 種職業、13 座關卡與無盡之塔，預設繁體中文。
- [新增] Google／LINE 登入，存檔保存在雲端，換裝置也能接著玩。

### 普隆德拉
- [新增] 多人廣場：看得到其他冒險者走動、換裝與表情，登入後可以公開聊天。
- [新增] 好友、密語，以及查看其他玩家的資料。

### 修正
- [修正] 部分網址開啟時卡在開場畫面、無法開始遊戲。
- [修正] 快捷列的藥水、靈藥與祝福圖示顯示成破圖。
`,Rx="ro-life.news-seen",yh=a=>a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),Kl=a=>yh(a).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>"),Aq=a=>/^(sin publicar|unreleased|para el siguiente push|for the next push|未發布|下次推送)$/i.test(a),Pq=[[/^(nuevo|nueva|new|新增)$/i,"new"],[/^(cambio|equilibrio|change|balance|調整)$/i,"change"],[/^(mejora|improvement|improved|改善)$/i,"better"],[/^(arreglo|fix|fixed|修正)$/i,"fix"]];function jq(a){var s;const e=/^\[([^\]]+)\]\s*/.exec(a);return e?`<li><span class="news-tag tag-${((s=Pq.find(([n])=>n.test(e[1].trim())))==null?void 0:s[1])??"other"}">$ {
    yh(e[1].trim())
  }
  </span> $ {
    Kl(a.slice(e[0].length))
  }
  </li>`:`<li>$ {
    Kl(a)
  }
  </li>`}function Bx(a){const e=[];let t=null,s=null,n=!1;const o=()=>{s!==null&&(t==null||t.parts.push(jq(s))),s=null},i=()=>{o(),n&&(t==null||t.parts.push("</ul>")),n=!1},r=()=>{i(),t&&!Aq(t.title)&&e.push({title:t.title,tab:t.title.split(/\s+[—–-]\s+/)[0],html:t.parts.join("")}),t=null};for(const l of a.split(/\r?\n/)){const d=l.trimEnd();if(d.startsWith("## "))r(),t={title:d.slice(3).trim(),parts:[]};else if(t)d.startsWith("### ")?(i(),t.parts.push(`<h3>$ {
    Kl(d.slice(4).trim())
  }
  </h3>`)):d.startsWith("- ")?(o(),n||t.parts.push("<ul>"),n=!0,s=d.slice(2).trim()):s!==null&&/^\s+\S/.test(l)?s+=` $ {
    d.trim()
  }
  `:d.trim()?n||t.parts.push(`<p>$ {
    Kl(d.trim())
  }
  </p>`):o();else continue}return r(),e}function Nx(){const a=Bx(Ix).map(t=>t.title+t.html).join("|");let e=0;for(let t=0;t<a.length;t++)e=e*31+a.charCodeAt(t)|0;return String(e)}function _q(){try{return localStorage.getItem(Rx)===Nx()}catch{return!0}}function qq(){const a=d=>document.getElementById(d),e=a("news-btn"),t=a("news-popup"),s=a("news-tabs"),n=a("news-body");let o=0;const i=d=>{var p;const h=Bx(Te.lang==="es"?Ix:Te.lang==="zh-TW"?Lq:Cq);o=Math.min(d,Math.max(0,h.length-1)),s.innerHTML=h.map((y,w)=>`<button role="tab" class="${w===o?"active":""}" data-i="${w}">$ {
    yh(y.tab)
  }
  </button>`).join(""),s.classList.toggle("hidden",!h.length);const u=h[o];n.innerHTML=u?`<h2>$ {
    Kl(u.title)
  }
  </h2>$ {
    u.html
  }
  `:`<p class="news-empty">$ {
    yh(c("Pronto habrá novedades."))
  }
  </p>`,n.scrollTop=0,(p=s.querySelector(".active"))==null||p.scrollIntoView({block:"nearest",inline:"nearest"})};s.onclick=d=>{const h=d.target.closest("[data-i]");h&&i(Number(h.dataset.i))},e.classList.toggle("fresh",!_q());const r=()=>{t.classList.add("hidden"),window.removeEventListener("keydown",l,!0)},l=d=>{(d.key==="Escape"||d.key==="Enter")&&(d.stopImmediatePropagation(),d.key==="Escape"&&r())};e.onclick=()=>{i(0),t.classList.remove("hidden"),window.addEventListener("keydown",l,!0),e.classList.remove("fresh");try{localStorage.setItem(Rx,Nx())}catch{}},a("news-close").onclick=r,t.addEventListener("click",d=>{d.target===t&&r()}),fr(()=>{t.classList.contains("hidden")||i(o)})}const bp="ro-life.perf",Tb=500,Cb=33;function Iq(){const a=new URLSearchParams(location.search).get("perf");try{return a!==null&&(a==="0"?localStorage.removeItem(bp):localStorage.setItem(bp,"1")),localStorage.getItem(bp)==="1"}catch{return a!==null&&a!=="0"}}const Lb=()=>({frames:0,frameMs:0,worst:0,slow:0,logic:0,world:0,overlay:0});class Jf{constructor(e){g(this,"box",document.createElement("div"));g(this,"win",Lb());g(this,"next",performance.now()+Tb);g(this,"recent",[]);g(this,"overlayStart",0);this.app=e,this.box.id="perf",this.box.style.cssText="position:fixed;left:calc(8px + env(safe-area-inset-left));top:calc(92px + env(safe-area-inset-top));z-index:1000;pointer-events:none;padding:4px 8px;border-radius:8px;background:rgba(255,255,255,0.88);border:1px solid #c5d3ee;color:#24427e;font:11px/1.35 ui-monospace,Consolas,monospace;white-space:nowrap;box-shadow:0 2px 8px rgba(40,70,140,0.18)",document.body.append(this.box);const t=e.renderer.render.bind(e.renderer);e.renderer.render=(...s)=>{this.overlayStart=performance.now();const n=t(...s);return this.win.overlay+=performance.now()-this.overlayStart,n}}static create(e){return Iq()?new Jf(e):null}frame(e,t,s,n){const o=this.win;o.frames++,o.frameMs+=e,o.worst=Math.max(o.worst,e),o.logic+=t,o.world+=s;const i=performance.now();e>Cb&&(o.slow++,this.recent.push({t:i,ms:e})),!(i<this.next)&&(this.next=i+Tb,this.recent=this.recent.filter(r=>i-r.t<1e4),this.paint(n),this.win=Lb())}paint(e){const t=this.win,s=Math.max(1,t.frames),n=1e3*s/Math.max(1,t.frameMs),o=d=>(d/s).toFixed(1),i=(t.logic+t.world+t.overlay)/s,r=[`<b>$ {
    n.toFixed(0)
  }
   FPS</b> · $ {
    (t.frameMs/s).toFixed(1)
  }
   ms · peor $ {
    t.worst.toFixed(0)
  }
   ms`,`lógica $ {
    o(t.logic)
  }
   · 3D $ {
    o(t.world)
  }
   · 2D $ {
    o(t.overlay)
  }
   ms`,`CPU $ {
    i.toFixed(1)
  }
   ms · resto (espera/GPU) $ {
    Math.max(0,t.frameMs/s-i).toFixed(1)
  }
   ms`,`tirones >$ {
    Cb
  }
   ms: $ {
    t.slow
  }
   ahora · $ {
    this.recent.length
  }
   en 10 s$ {
    this.recent.length?` (máx ${Math.max(...this.recent.map(d=>d.ms)).toFixed(0)})`:""
  }
  `];if(e){const d=e.world3d.renderer.info.render;r.push(`monstruos $ {
    e.enemies.length
  }
   · efectos $ {
    e.fx.length
  }
   · 3D $ {
    e.world3d.scene.children.length
  }
   obj · números $ {
    e.numbers.length
  }
  `,`draw calls 3D $ {
    d.calls
  }
   · triángulos $ {
    d.triangles
  }
  `,`resolución 3D $ {
    e.world3d.renderer.getPixelRatio()
  }
  × · 2D $ {
    this.app.renderer.resolution
  }
  × · $ {
    window.innerWidth
  }
  ×$ {
    window.innerHeight
  }
  `)}const l=performance.memory;l&&r.push(`memoria JS $ {
    (l.usedJSHeapSize/1048576).toFixed(0)
  }
   MB`),this.box.innerHTML=r.join("<br>")}}const Rq=4e3;let Qa=null;function Bq(a){var t;const e=[];for(const s of hh(a).reverse()){const n=Se[s];for(const o of[n.story,n.storyOnly?void 0:n.id]){const i=o?(t=et[o])==null?void 0:t.map:void 0;i&&!e.includes(i)&&e.push(i)}}return e}function Nq(a){var n;if(Ox(),(n=navigator.connection)!=null&&n.saveData)return;const e=Qa=new AbortController,{signal:t}=e,s=Bq(a);setTimeout(async()=>{const o="serviceWorker"in navigator?navigator.serviceWorker.controller:null;if(o){const i=[];for(const r of s){if(t.aborted)return;try{i.push(...await se.mapFiles(r,t))}catch{if(t.aborted)return}}!t.aborted&&i.length&&o.postMessage({t:"warm",urls:i}),Qa===e&&(Qa=null);return}for(const i of s){if(t.aborted)return;try{await se.warmMap(i,t)}catch{if(t.aborted)return}}Qa===e&&(Qa=null)},Rq)}function Ox(){var a;Qa==null||Qa.abort(),Qa=null,"serviceWorker"in navigator&&((a=navigator.serviceWorker.controller)==null||a.postMessage({t:"warm-stop"}))}var Oq={commit:"7967a1a"};const Xa=new Lw;let z=null,re=null,qi=null,tt=null,mt=null,cl=null,pt=null,Fn=!1;const dl=Number(new URLSearchParams(location.search).get("demo"))||0;let zn=null,Jt;const Dq=25e3;async function Hq(){zS();const a=cC();aj(),lL(()=>!!z&&z.state!=="over"),_L(),st.enabled=!0,st.login=async(o,i)=>{await qL(o,i),Zd()},st.register=IL,st.checkRecovery=RL,st.recover=async(o,i)=>{await BL(o,i),Zd()},st.current=()=>{var o;return((o=Pa())==null?void 0:o.name)??null},st.logout=tv,fj(),dl||FC(),iL(),a1(o=>{o.state==="maintenance"?Dx():(o.state==="warn"||o.state==="info")&&(re==null||re.notice(Ol()))}),tL(o=>re==null?void 0:re.notice(c(o===1?"El mantenimiento empieza en 1 minuto: termina lo que estés haciendo.":"El mantenimiento empieza en {n} minutos.",{n:o}))),DC({quiet:()=>!z&&!re,playing:()=>!!z}),Jt=bq(),OT()||document.getElementById("dl-btn").remove(),ff("talentsPage")||document.getElementById("talents-btn").remove(),qq(),dl||uL(),a.then(o=>{o.length&&ju().then(()=>o.forEach(i=>cL(i)))}),ju().then(()=>bL($a())),await Xa.init({resizeTo:window,backgroundAlpha:0,antialias:!1,resolution:Hg(Te.resolution),autoDensity:!0}),fr(o=>{const i=Hg(o.resolution);Xa.renderer.resolution!==i&&Xa.renderer.resize(window.innerWidth,window.innerHeight,i)}),document.getElementById("stage").appendChild(Xa.canvas);const e=document.querySelector("#loading .loading-text");await om;let t=Date.now();const s=window.setInterval(()=>{Date.now()-t<Dq||(clearInterval(s),im().then(o=>{o||Jt.fail(c("No se pudo cargar el juego. Pulsa para reintentar."))}))},5e3);try{await se.load(o=>{t=Date.now(),e.textContent=c("Cargando assets de Ragnarok… {p}%",{p:Math.round(o*100)}),Jt.progress(o)}),clearInterval(s)}catch(o){if(clearInterval(s),await im())return;e.textContent=c("No se encontraron los assets. Ejecuta primero: npm run extract"),Jt.fail(c("No se pudo cargar el juego. Pulsa para reintentar.")),console.error(o);return}de("loading");const n=Jf.create(Xa);if(Xa.ticker.add(o=>{const i=performance.now();if(re)try{re.tick(o.deltaMS/1e3),re.render()}catch(r){Ab("plaza",r)}if(!z)return n==null?void 0:n.frame(o.deltaMS,performance.now()-i,0,null);try{zn?zn.frame(o.deltaMS/1e3):!ai&&(mt||!z.world3d.loading)&&z.advance(o.deltaMS/1e3*(ao>0&&z.endless?cI(z):1)),Kq(z),mt==null||mt.update(o.deltaMS/1e3);const r=performance.now();z.renderWorld();const l=performance.now();fC(o.deltaMS,r-i,l-r,z),tt==null||tt.update(),n==null||n.frame(o.deltaMS,r-i+(performance.now()-l),l-r,z)}catch(r){Ab("partida",r)}}),US(),W2(),window.addEventListener("keydown",o=>{var i;if(((i=o.target)==null?void 0:i.tagName)!=="INPUT"){if(pj()){o.key==="Escape"&&Vl();return}if(o.key==="Escape")return Uq(o);o.ctrlKey||o.metaKey||o.altKey||(o.key.toLowerCase()==="c"&&re&&qi&&!document.querySelector(".overlay:not(.hidden)")&&Hx(qi),o.key.toLowerCase()==="x"&&re&&!document.querySelector(".overlay:not(.hidden)")&&document.getElementById("lobby-switch").click(),o.key.toLowerCase()==="m"&&B.toggleMute())}}),window.addEventListener("ro-pause",()=>Wi()),window.addEventListener("ro-lang",()=>{qi&&Sa(qi)}),document.addEventListener("visibilitychange",()=>{document.hidden&&Te.autoPause&&(z==null?void 0:z.state)==="playing"&&!mt&&!zn&&Wi()}),document.getElementById("btn-resume").onclick=()=>Wi(),document.getElementById("btn-pause-options").onclick=()=>ch(),document.getElementById("lobby-options").onclick=()=>ch(),document.getElementById("btn-endrun").onclick=()=>{de("pause"),Ki(!1,!0)},document.getElementById("btn-quit").onclick=()=>{if(de("pause"),z!=null&&z.endless&&lt&&!z.player.dead)return Xl?Ki(!1,!0):void tI();if(!Sl())return Ki(!1,!0);const o=pt.id;Mr(),Sa(o)},window.addEventListener("pagehide",()=>{Bl("closed"),Sl(),z!=null&&z.endless&&lt&&!z.player.dead&&!Xl&&lt.suspendNow(Gh(z.endless),z.endless.resumeTick())}),Vq(),dl)return void iI(dl);document.addEventListener("visibilitychange",()=>{document.hidden?Bl("hidden"):vC(),document.hidden&&Sl()}),new URLSearchParams(location.search).has("diag")&&a.then(()=>nI()),nj(()=>{document.getElementById("charselect").classList.contains("hidden")||dr()}),zq(),Jt.ready(()=>{B.unlock(),vw(),ju().then(dr)}),Tq({onCreateAccount:()=>{xm(),B.music(Wl),Jt.welcome("register")},onExit:()=>{xm();const o=!!Pa();B.music(Wl),tv().then(()=>Jt.welcome(o?"login":"guest"))}})}function Fq(){(z==null?void 0:z.state)==="playing"&&Wi(),!(z&&z.state!=="paused")&&ch()}function Dx(){if(z)return;const a=!!re||!document.getElementById("charselect").classList.contains("hidden");Un(),xm(),B.music(Wl),Jt.welcome(),a&&Ae(c("Mantenimiento"),`<p>$ {
    Ol()
  }
  </p>`,[{label:c("Aceptar"),primary:!0}])}function dr(){qh()||(Jt.menu(),B.music("prontera"),ox(a=>{B.unlock(),Sa(a.id)}))}const Wl="endless";function zq(){B.music(Wl);const a=()=>{window.removeEventListener("pointerdown",a),window.removeEventListener("keydown",a),B.unlock(),!z&&!document.getElementById("splash").classList.contains("menu")&&B.music(Wl)};window.addEventListener("pointerdown",a),window.addEventListener("keydown",a)}const wp=new Set;function Ab(a,e){const t=`$ {
    a
  }
  : $ {
    (e==null?void 0:e.message)??e
  }
  `;wp.has(t)||wp.size>20||(wp.add(t),console.error("[frame]",a,e),cn(`error en el frame ($ {
    t.slice(0,120)
  })`))}function xn(a){return!document.getElementById(a).classList.contains("hidden")}function Uq(a){if(xn("npc-dialog"))return a.stopImmediatePropagation(),de("npc-dialog");if(xn("shop")||xn("charcreate"))return;if(xn("stages"))return de("stages");if(xn("friends"))return de("friends");if(xn("cp-sock"))return de("cp-sock");if(xn("charpanel"))return document.getElementById("cp-back").click();if(z)return Wi();[...document.querySelectorAll(".overlay:not(.hidden)")].filter(t=>t.id!=="charselect").length||Fq()}function Hx(a){Rj(a,{onBack:()=>void jd(a),backLabel:c("Volver a Prontera")})}async function Sa(a){if(lm())return Dx();z&&Mr();const e=ze(a);if(!e)return dr();const t=document.querySelector("#loading .loading-text");t.textContent=c("Entrando en Prontera…"),Ue("loading"),!re&&!z&&se.releaseScene(["prontera"]);const s=ka(e),[n,o]=await Promise.all([se.loadMap("prontera"),It(ri(e),e.look,La(e)),se.loadSheets(s?[Xn(Yn(s))]:[])]);Jt.hide(),Un();const i=re=new C3(n,lr(e),o,e.name,Xa);re.setPet(ka(e)&&Yn(ka(e)));const r=re.world3d.whenReady();if(r.then(()=>re===i&&de("loading")),e.dev||r.then(()=>re===i&&i.goOnline(e.name,vh(e),kx(e))),re.partyHooks={describe:l=>Xq(a,l),start:l=>Jq(a,l),blocked:l=>Fx(a,l)},qi=a,document.body.classList.add("in-lobby"),Nq(e),re.addNpc("vendor","npc_vendor",c("Vendedor de minerales"),c("Hablar con el vendedor"),475,584,3,()=>s_()),re.addNpc("smith","npc_smith",c("Herrero Hollgrehenn"),c("Hablar con el herrero"),652,408,3,()=>a_(a,()=>void jd(a))),re.addNpc("captain","npc_knight",c("Capitán de expediciones"),c("Hablar con el capitán"),141,378,0,()=>Wq(a)),re.setNpcAlert("captain",Pj(e)),re.addNpc("chronicle","npc_minister",c("Cronista de hazañas"),c("Hablar con el cronista"),-153,384,6,()=>Hj(()=>re==null?void 0:re.setNpcAlert("chronicle",!1))),re.setNpcAlert("chronicle",WL().length>0),re.addNpc("petkeeper","npc_petkeeper",c("Cuidadora de pets"),c("Hablar con la cuidadora"),-250,352,6,()=>k_(()=>void jd(a))),Mt()&&re.addNpc("specmaster","npc_counselor",c(zh),c("Hablar con el maestro"),250,352,2,()=>xj(a)),re.addNpc("stylist","npc_stylist",c("Estilista"),c("Hablar con el estilista"),-475,584,5,()=>T_(a,()=>void jd(a))),ff("wiki")&&re.addNpc("librarian","npc_librarian",c("Bibliotecario"),c("Hablar con el bibliotecario"),-211,910,0,()=>Z_()),!e.dev){const l=re;re.addNpc("postman","npc_postman",c("Cartero"),c("Mirar el correo"),211,910,0,()=>S_(d=>re==null?void 0:re.setNpcAlert("postman",d))),re.mailHook=()=>re==null?void 0:re.setNpcAlert("postman",!0),x_().then(d=>{re===l&&l.setNpcAlert("postman",d)})}re.addNpc("tower","npc_tower",c("Guardián de la Torre"),c("Hablar con el guardián"),-652,408,7,()=>v_(a,l=>{const d=ze(a);d&&(Un(),hr(d,void 0,{...Ta},"endless",null,1,null,l))})),document.getElementById("lobby-char").onclick=()=>Hx(a),oc(a)&&zx(e,null),document.getElementById("lobby-switch").onclick=()=>{Un(),dr()}}async function jd(a){const e=ze(a);!e||!re||(re.setAvatar(await It(ri(e),e.look,La(e)),vh(e),kx(e)),re.setPet(ka(e)&&Yn(ka(e))))}function vh(a){return{job:a.job,...a.promotion?{promotion:a.promotion}:{},...P1(a)?{peco:!0}:{},gender:a.look.gender,hair:a.look.hair,hairColor:a.look.hairColor,cloth:a.look.cloth,equip:La(a),...ka(a)?{pet:Yn(ka(a))}:{}}}function Un(){re&&(de("npc-dialog"),de("shop"),de("chronicle"),de("petkeeper"),de("mailbox"),Sx(),jx()),re==null||re.destroy(),re=null,qi=null,Ox(),document.body.classList.remove("in-lobby")}const Gq=3e3,Pb="ro-life.gl-reload";function Vq(){const a=new Set;let e=0;const t=()=>{clearTimeout(e),a.size&&(document.hidden||(e=window.setTimeout(()=>{for(const n of a)n.isConnected||a.delete(n);if(!a.size)return;let s=0;try{s=Number(sessionStorage.getItem(Pb))||0,sessionStorage.setItem(Pb,String(Date.now()))}catch{}if(Date.now()-s<3e4){tt==null||tt.toast(c("Se han perdido los gráficos. Recarga la página para recuperarlos."));return}Sl(),Bl("webgl"),location.reload()},Gq)))};document.addEventListener("webglcontextlost",s=>{var n;cn(`WebGL perdido ($ {
    (n=s.target.classList)!=null&&n.contains("world3d")?"mundo 3D":"capa 2D"
  })`),a.add(s.target),t()},!0),document.addEventListener("webglcontextrestored",s=>{cn("WebGL recuperado"),a.delete(s.target),t()},!0),document.addEventListener("visibilitychange",t)}const jb=10;let _b=null,kp=0;function Kq(a){_b!==a&&(_b=a,kp=a.time+jb),!(a.state!=="playing"||a.time<kp)&&(kp=a.time+jb,Sl())}function Sl(){return mt||!z||!pt||pt.id==="dev"||Fn||z.state==="over"||z.player.dead||z.story||z.endless?!1:(HL(pt.id,z.snapshot()),!0)}function Wq(a){const e=ze(a);e&&(jj(e,t=>{var n;const s=ze(a);if(s){if(re!=null&&re.inParty()&&((n=et[t])!=null&&n.story))return Ae(c("Grupo"),c("Las historias se juegan en solitario: sal del grupo para jugarla."),[{label:c("Vale"),primary:!0}]);if(re!=null&&re.inParty())return Yq(s,t);Qq(s,t)}},{canSkip:t=>Ux(a,t),onSkip:t=>void oI(a,t)}),re==null||re.setNpcAlert("captain",!1))}const Qf=a=>Se.find(e=>e.id===a||e.story===a);function Yq(a,e){if(!(re!=null&&re.isPartyLeader()))return Ae(c("Grupo"),c("En grupo, el stage lo elige el líder."),[{label:c("Vale"),primary:!0}]);const t=Qf(e),s=re.partyMembers().flatMap(n=>{const o=[];return t&&n.gs<t.gsMin&&o.push(c("gearscore {gs} de {min}",{gs:n.gs,min:t.gsMin})),t!=null&&t.jobLvMin&&n.jobLevel<t.jobLvMin&&o.push(c("Job Lv {lv} de {min}",{lv:n.jobLevel,min:t.jobLvMin})),o.length?[`<li><b>$ {
    n.name.replace(/[&<>"]/g,"")}</b>: ${o.join(", ")}</li>`]:[]});if(s.length)return Ae(c("Grupo"),`${c("No todo el grupo puede entrar en este stage:")}<ul class="party-short">${s.join("")}</ul>`,[{label:c("Vale"),primary:!0}]);Zf(a,e,n=>re==null?void 0:re.proposeTrip({stage:e,diff:{...n}}))}function Xq(a,e){const t=Qf(e.stage),s=(t==null?void 0:t.story)===e.stage?` (${c("historia")})`:"",n=gr(e.diff),o=sr(n)>1.001?` · ${c("Botín")} ×${Ee(sr(n),2)}`:"",i=(n.pick??1)>1.001?` · ${c(" {
      n
    }
     s para elegir carta",{n:Math.round(ji*n.pick)})}`:"",r=oc(a)?`<br><small>${c("Tienes una partida a medias: al salir se cobra lo que llevabas y se descarta.")}</small>`:"",l=ze(a),h=!!l&&!!(t!=null&&t.storyOnly)&&(!!l.promotion||(l.stagesCleared??[]).includes(t.id))?`<br><small>${c("Ya has superado esta historia: vas como ayuda (cobras la partida, pero no la recompensa del final).")}</small>`:"";return`<b>${(t==null?void 0:t.name)??e.stage}${s}</b>${o}${i}${r}${h}`}function Fx(a,e){var i;const t=ze(a),s=Qf(e.stage);if(!t||!s)return null;const n=Ud(t,Se.indexOf(s)),o=[];return!n.mvpOk&&n.needMvp&&o.push(c("vencer a  {
      mvp
    }
    ",{mvp:((i=Be[n.needMvp.mvp.id])==null?void 0:i.name)??n.needMvp.mvp.id})),n.gsOk||o.push(c("gearscore  {
      gs
    }
     de  {
      min
    }
    ",{gs:vr(t),min:s.gsMin})),n.jobOk||o.push(c("Job Lv  {
      lv
    }
     de  {
      min
    }
    ",{lv:t.jobLevel,min:s.jobLvMin??0})),e.stage===s.id&&s.story&&!n.storyOk&&o.push(c("superar antes su historia")),o.length?o.join(", "):null}function Jq(a,e){const t=Fx(a,e);if(t){Ae(c("Grupo"),`${c("No puedes ir a ese stage con el grupo:")} ${t}`,[{label:c("Vale"),primary:!0}]);return}de("stages"),de("npc-dialog");const s=oc(a);if(s){Bh(a);const i=ze(a);i&&Dh(i,M1(s))}const n=ze(a);if(!n)return;const o=((re==null?void 0:re.partyMembers())??[]).map(i=>({mid:i.mid,name:i.name}));Un(),hr(n,void 0,gr(e.diff),e.stage,o)}function Qq(a,e){if(oc(a.id))return zx(a,e);Zf(a,e)}function Zf(a,e,t){var l;if((l=et[e])!=null&&l.story){if(t)return t({...Ta});const d=ze(a.id);if(!d)return;Un(),hr(d,void 0,{...Ta},e);return}const s=nk(),n=d=>`${Math.round(d*100)}%`,o=Ko.map(d=>`<label class="diff-row"><span>${d.name}</span><input type="range" data-key="$ {
      d.key
    }
    " min="$ {
      d.min
    }
    " max="$ {
      d.max
    }
    " step="0.05" value="$ {
      s[d.key]
    }
    "><b data-out="$ {
      d.key
    }
    ">${n(s[d.key])}</b></label>`).join("");t&&(s.pick=gr({...s,pick:s.pick??Ni.min}).pick);const i=()=>Math.round(ji*(s.pick??1)),r=t?`<label class="diff-row"><span>${c("Tiempo para elegir carta")}</span><input type="range" data-pick min="$ {
      ji*Ni.min
    }
    " max="$ {
      ji*Ni.max
    }
    " step="1" value="$ {
      i()
    }
    "><b data-out="pick">${i()} s</b></label>`:"";Ae(c("Dificultad"),`<div class="diff">${o}${r}<div class="diff-reward">${c("Botín")} <b data-out="drop">×${Ee(sr(s),2)}</b></div></div>`,[{label:c("Cancelar")},{label:c(t?"Proponer al grupo":"Ir al campo"),primary:!0,run:()=>{if(tE(s),t)return t(s);const d=ze(a.id);d&&(Un(),hr(d,void 0,s,e))}}]);for(const d of document.querySelectorAll("#npc-text .diff input")){if(d.dataset.pick!==void 0){d.oninput=()=>{s.pick=Number(d.value)/ji,document.querySelector('#npc-text [data-out="pick"]').textContent=`${i()} s`};continue}d.oninput=()=>{const h=d.dataset.key;s[h]=Number(d.value),document.querySelector(`#npc-text [data-out="$ {
      h
    }
    "]`).textContent=n(s[h]),document.querySelector('#npc-text [data-out="drop"]').textContent=`×${Ee(sr(s),2)}`}}}function zx(a,e){const t=oc(a.id);if(!t)return;const s=Math.floor(t.time),n=`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;Ae(c("Partida a medias"),c("Dejaste una partida en <b> {
      stage
    }
    </b> en el minuto <b> {
      t
    }
    </b> (Nv  {
      lv
    }). ¿Quieres seguir desde ahí?",{stage:mf(t.stage),t:n,lv:t.level}),[{label:c("Descartar"),run:()=>{Bh(a.id);const o=ze(a.id),i=o?Dh(o,M1(t)):null;e&&o?Zf(o,e):i&&Ae(c("Partida descartada"),c("Cobras lo que llevabas: <b>+ {
      exp
    }
    </b> EXP base y <b>+ {
      job
    }
    </b> EXP de job, y el botín que habías conseguido.",{exp:i.exp,job:i.jobExp}),[{label:c("Vale"),primary:!0}])}},{label:c("Continuar"),primary:!0,run:()=>{const o=ze(a.id);o&&(Un(),hr(o,t,void 0,t.stage))}}])}async function hr(...a){if(!xp){xp=!0;try{await Zq(...a)}finally{xp=!1}}}let xp=!1;async function Zq(a,e,t=nk(),s="prontera",n=null,o=1,i=null,r=null){var x;const l=s==="endless";if(Xl=!1,l&&!i&&(!oh(a)||rh(a)<=0))return void Sa(a.id);let d=null,h=null;if(l&&!i){const k=ir();if(k)try{if(r){const M=await Pn.restore(Ui(1),k,r);lt=M.net,h=M.restore,d={run:h.run,seed:h.seed,wave:h.wave,last:h.last,char:h.char,best:h.best}}else{const M=await Pn.open(Ui(1),k,a.id,1);lt=M.net,d=M.started}a=d.char}catch(M){const $=a.id;Sa($),Ae(c("Endless Tower"),"<p>"+dI(M.message)+"</p>",[{label:c("Vale"),primary:!0}]);return}else return void Sa(a.id)}et[s]||(s="prontera");const u=et[s];vw();const p=document.querySelector("#loading .loading-text");p.textContent=c("Entrando en  {
      stage
    }
    …",{stage:mf(s)}),Ue("loading"),z||(se.releaseScene([u.map,"prontera"]),u.map!=="prontera"&&se.parkMap("prontera"));const y=ka(a),w=l?V1([0]):sI(s),m=["fx_angelwing","fx_angelfeather"],[f]=await Promise.all([It(ri(a),a.look,La(a)),se.loadMap(u.map),se.loadSheets([...w,...m,...y?[Xn(Yn(y))]:[]])]);de("loading"),Jt.hide(),pt=a,Fn=!1,!a.dev&&a.id!=="dev"&&!l&&wL(s,!!e,u.story?1:sr(gr((e==null?void 0:e.difficulty)??t)),(e==null?void 0:e.time)??0);const v={onLevelUp:k=>xf(z,k,M=>z.choose(M)),onChest:(k,M)=>Xk(z,k,M,$=>z.chooseChest($)),onRoulette:(k,M)=>NC(z,k,M),onLoot:(k,M)=>tt==null?void 0:tt.toast(k,M),onDrop:k=>tt==null?void 0:tt.reveal(k,()=>{(z==null?void 0:z.state)==="reveal"&&(z.state="playing")}),onGameOver:k=>{zn||(mt==null||mt.gameOver(k),Ki(k))},onBosses:k=>tt==null?void 0:tt.bosses(k),onAnnounce:k=>!ai&&(tt==null?void 0:tt.announce(k))};if(l){const k=a.id,M=(d==null?void 0:d.last)??Math.max(1,rh(a));qb=(d==null?void 0:d.wave)??Math.min(o,M),Ib=d?{char:a,wave:d.wave,seed:d.seed}:{char:a,wave:qb,seed:(i==null?void 0:i.seed)??Fg(),tune:(i==null?void 0:i.tune)??Mx()};const $=()=>{const q=z,R=()=>window.setTimeout(()=>z===q&&(z==null?void 0:z.endless)&&Ki(!0),4e3),L=q==null?void 0:q.endless;L&&!L.failed?Gx(L.wave.n,R):R()},P={onStart:()=>{},onCleared:()=>{},onComplete:()=>{}};if(z=o_(Xa,f,v,Ib,i?P:d?{...P,onComplete:$,onPick:_d}:{onPick:_d,onStart:q=>kl(k,R=>R.reached=Math.max(R.reached,q)),onCleared:(q,R)=>kl(k,L=>{L.best=Math.max(L.best,q),L.earned+=R,L.reached=Math.max(L.reached,Math.min(q+1,M))}),onComplete:$}),lt==null||lt.attach(z,q=>Gh(q.endless)),lt){const q=z;lt.onGone=()=>z===q&&!Fn&&Ki(!1,!0)}!i&&z.endless&&lI(z.endless,d?d.best??0:ga(a).best),!i&&((x=z.endless)!=null&&x.offer)&&_d(z.endless)}else yw(Fg()),z=new Gs(Xa,lr(a),f,Ph(a),v,s),z.charExp=new Rf(a,{jobCap:u.jobCap,jobExp:u.jobExp,count:u.story?1:t.count}),z.look={look:a.look,equip:La(a),promotion:a.promotion},z.recomputeStats();if(hC(s,a.job),z.perksLeft=l?{reroll:0,reroll_card:0,banish:0,focus:0,deity:0}:QL(),z.perksMax={...z.perksLeft},z.jobLabel=zl(a),tt=new SC(z,a.name,f),n?mt=new e_(z,a.name,vh(a),n):!a.dev&&a.id!=="dev"&&ir()&&(cl=new e3(Ui(),()=>({name:a.name,look:vh(a),stage:s,secs:(z==null?void 0:z.time)??0}))),l||z.setDifficulty(u.story?Ta:t),z.storyRewards=()=>Wx(a,s),e&&z.restore(e),i&&(z.replayMoves=i.moves??Kf(i.runs??[]),z.endless&&(z.endless.scripted=i.picks??[]),z.endless&&i.autoPicks&&(z.endless.autoPicks=!0)),i&&!dl){const k=performance.now();for(let P=0;z.ticks<i.ticks&&P<i.ticks*2;P++)z.tick(Gs.STEP);const M=z.stateHash(),$=i.checks.findIndex((P,q)=>z.checks[q]!==P);Rb={ok:M===i.hash,hash:M,expected:i.hash,ticks:z.ticks,ms:Math.round(performance.now()-k),firstBadCheck:$<0?-1:($+1)*Nf},console.info("[replay]",Rb)}if(new URLSearchParams(location.search),z.world3d.loading){const k=z;Ue("loading"),k.world3d.whenReady().then(()=>z===k&&de("loading"))}h&&await eI(h)}let ai=!1;async function eI(a){const e=z;if(!(e!=null&&e.endless))return;const t=document.querySelector("#loading .loading-text");Ue("loading"),ai=!0,B.hush=!0;const s=Kf(a.runs);e.replayMoves=s,e.endless.scripted=a.picks;try{for(;e.ticks<a.ticks&&z===e;){for(let n=0;n<900&&e.ticks<a.ticks;n++)e.tick(Gs.STEP);t.textContent=c("Recuperando tu partida…  {
      p
    }
     %",{p:Math.floor(e.ticks/Math.max(1,a.ticks)*100)}),await new Promise(n=>setTimeout(n,0))}}finally{ai=!1,B.hush=!1,de("loading")}z!==e||!e.endless||(e.endless.beforeTick(),e.moves=s.slice(0,e.ticks*2),e.replayMoves=null,e.endless.scripted=null,Xl=!0,e.endless.offer?_d(e.endless):e.state==="playing"&&Wi())}function Gh(a){const e=a.state==="fight"||a.state==="done"?a.wave.n:a.wave.n-1;return{wave:Math.max(e,a.startWave),cleared:a.cleared,points:a.points,bestWave:a.cleared>0?a.startWave+a.cleared-1:0,score:a.score}}async function tI(){const a=z,e=lt;if(!(a!=null&&a.endless)||!e||!pt)return;lt=null;const t=pt.id;a.state="paused";const s=await e.suspend(Gh(a.endless),a.endless.resumeTick());Fn=!0,Mr(),Sa(t),Ae(c("Endless Tower"),"<p>"+(s?c("Partida guardada. Puedes seguirla desde el Guardián de la Torre durante los próximos 7 días, con tu personaje tal como entró. Vuelves al principio del piso en el que estabas, con la puntuación que tenías al empezarlo. Solo se puede retomar una vez: si vuelves a salir, la partida se acaba."):c("No se ha podido guardar la partida: el servidor la cerrará con lo que ya tenía."))+"</p>",[{label:c("Vale"),primary:!0}])}function sI(a){return aI(et[a])}function aI(a){const e=new Set,t=new Set,s=(n,o)=>{if(typeof n=="string")!e.has(n)&&se.manifest.sprites[n]&&(e.add(n),Be[n]&&s(Be[n],0));else if(n&&typeof n=="object"&&o<6&&!t.has(n)){t.add(n);for(const i of Object.values(n))s(i,o+1)}};return s(a,0),e}function nI(){const a=dC(),e=o=>String(o??"").replace(/[&<>]/g,i=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[i]),t=a.map(o=>`<p><b>${e(new Date(o.at).toLocaleString())}</b> · ${e(o.kind)}<br>${e(o.stage)} · ${e(o.job)} · ${Math.floor(o.t/60)}:${String(o.t%60).padStart(2,"0")} de partida (${Math.round((o.at-o.start)/1e3)} s reales)<br>${o.fps} FPS · frame peor ${o.worst} ms · lógica ${o.logic} ms · 3D ${o.world} ms · ${o.enemies} monstruos<br>GPU: ${o.tex} texturas · ${o.geo} geometrías · ${o.prog} shaders · ${o.calls} draw calls${o.heap?` · JS ${o.heap} MB`:""}<br>${e(o.screen)} · resolución ${e(o.res)}${o.events.length?"<br>"+o.events.map(e).join("<br>"):""}</p>`),s=document.getElementById("npc-dialog"),n=()=>s.style.removeProperty("z-index");Ae("Diagnóstico",t.join("")||"<p>Sin cierres apuntados.</p>",[{label:"Borrar",run:()=>(localStorage.removeItem("ro-life.incidents"),n())},{label:"Cerrar",primary:!0,run:n}]),s.style.zIndex="40"}function Ux(a,e){const t=o=>(o.stagesCleared??[]).includes(e)||e==="prt_castle"&&!!o.promotion,s=$a(),n=s.find(o=>o.id===a);return!!n&&!n.dev&&!t(n)&&s.some(o=>o.id!==a&&!o.dev&&t(o))}async function oI(a,e){const t=ze(a),s=et[e];if(!t||!s||!Ux(a,e)||!await new Promise(l=>Ae(c("Saltar historia"),"<p>"+c("Otro personaje de tu cuenta ya ha superado esta historia. Si la saltas, te llevas su recompensa como si la hubieras superado, pero sin EXP.")+"</p>",[{label:c("Cancelar"),run:()=>l(!1)},{label:c("Saltar historia"),primary:!0,run:()=>l(!0)}])))return;if(!await kL(e,t.id)){Ae(c("Saltar historia"),"<p>"+c("No se puede saltar la historia ahora mismo. Prueba dentro de un momento.")+"</p>",[{label:c("Vale"),primary:!0}]);return}const o=Wx(t,e),i=e==="prt_castle"&&!t.promotion&&no(t.job).length?(await Y1(ge(t.job),t.look.gender)).id:null,r=o.length?[await W1(o)]:[];i&&_f(t,i);for(const l of r)jf(t,l.id);Dh(t,{time:0,level:1,kills:0,mvps:[s.bosses[s.bosses.length-1].id],stage:e,win:!0,loot:r,cards:[],eggs:[],baseExp:0,jobExp:0,killsBy:{},skipped:!0}),i&&Sa(t.id)}function Ki(a,e=!1){var h;if(!z||!pt)return;if(z.endless)return Fn?void 0:hI(a,e);e&&(mt==null||mt.abandon()),z.state="over";let t=null;if(!Fn){Fn=!0,Bh(pt.id);const u=et[z.stageId],p=!!pt.promotion;if(a&&z.promotion&&!p&&_f(pt,z.promotion),a&&(u!=null&&u.story)){for(const y of z.storyLoot)jf(pt,y.id);z.runLoot.push(...z.storyLoot)}t=Dh(pt,{time:z.time,level:z.level,kills:z.kills,bossKills:z.bossKills,mvps:z.mvpsKilled,stage:z.stageId,win:a,loot:z.runLoot,cards:z.runCards,eggs:z.runEggs,baseExp:z.charExp.base,jobExp:z.charExp.job,killsBy:Object.fromEntries(z.killsBy)})}const s=pt.id,n=z,o=pt,i=!a&&!!(mt!=null&&mt.leaderLeft),r=()=>{Jk(n,a,t,o,()=>{Mr(),s==="dev"?dr():Sa(s)}),e?document.getElementById("go-title").textContent=c("Partida abandonada"):i&&(document.getElementById("go-title").textContent=c("Partida terminada"))},l=Se.findIndex(u=>u.id===n.stageId);a&&l>=0&&!((h=Se[l+1])!=null&&h.map)?Ae(c("Continuará..."),"<p>"+c("Has llegado al final de la aventura... por ahora.")+"</p><p>"+c("Tu historia continuará muy pronto: los próximos stages llegarán en una nueva actualización.")+"</p>",[{label:c("Aceptar"),primary:!0,run:r}]):r()}async function iI(a){Jt.hide();const e=document.querySelector("#loading .loading-text");e.textContent=c("Cargando la demo…"),Ue("loading");let t;try{const r=await fetch(new URL(`api/admin/endless-run/${a}`,document.baseURI).href,{credentials:"same-origin"});if(!r.ok)throw new Error(String(r.status));t=await r.json()}catch(i){de("loading");const r=i.message==="401"||i.message==="403";Ae(c("Demo"),"<p>"+(r?c("Entra antes en el panel de control: las demos solo se ven desde allí."):c("No se ha podido cargar la demo de este run."))+"</p>",[{label:c("Vale"),primary:!0}]);return}if(t.build&&t.build!==Oq.commit&&!location.pathname.includes("/demos/")){const i=new URL(`demos/${t.build}.html`,document.baseURI);if(await fetch(i.href,{method:"HEAD"}).then(l=>l.ok&&(l.headers.get("content-type")??"").includes("html"),()=>!1))return void location.replace(`${i.href}?demo=${a}${location.search.includes("mute")?"&mute":""}`)}const s={charId:t.char.id,char:t.char,tune:Mx(),wave:t.waveStart,seed:t.seed,moves:Kf(t.runs),picks:t.picks,ticks:$x(t.runs),hash:"",checks:t.checks},n=async()=>{z&&Mr(),await hr(s.char,void 0,{...Ta},"endless",null,s.wave,s)},o=async i=>{const r=z;if(r){Ue("loading"),ai=!0,B.hush=!0;try{for(;r.ticks<i&&z===r;){for(let l=0;l<900&&r.ticks<i;l++)r.tick(Gs.STEP);e.textContent=c("Avanzando la demo…  {
      p
    }
     %",{p:Math.floor(r.ticks/Math.max(1,i)*100)}),await new Promise(l=>setTimeout(l,0))}}finally{ai=!1,B.hush=!1,de("loading")}}};await n(),zn=new c_(t,()=>z,n,o),document.title=`Demo #${t.id} · RO Life`,window.addEventListener("pointerdown",()=>B.unlock(),{once:!0})}function _d(a){const e=a.offer,t=z;if(!(!e||ai||!t)){if(e.kind==="card")return Gx(a.wave.n-1,()=>a.offer===e&&z===t&&xf(t,e.cards,s=>a.choose(e.cards.indexOf(s))));br({title:c("Elige tu Deity"),subtitle:c("Solo una: sube un rango cada 10 pisos"),cards:e.skills.map(s=>{const n=t.weapons.find(o=>o.id===s);return{color:"#a07ae0",icon:se.icons.get(ce[s].icon)??"",badge:c("Deity"),name:`${ce[s].name} Deity`,sub:c("Rango 1"),lines:n?nn.deityTexts(n,1):[]}}),onPick:s=>a.choose(s)})}}function Gx(a,e){const t=pt&&!zn&&pt.id!=="dev"&&(lt!=null&&lt.online)?ze(pt.id)??pt:null,s=t?w_(a):void 0,n=s&&ec().find(o=>o.name===s.name);if(!t||!s||!n||!tt)return e();B.ui("ef_blessing",.6),tt.reveal({kind:"dye",id:0,quality:4,affixes:[],dye:{name:s.name,job:ri(t),look:{...t.look,cloth:n.row},equip:La(t)}},e)}const qd=[1,2,4],Vx="ro-life:tower-speed";let Yl=1,ao=0,Fo=null;function rI(){try{const a=Number(localStorage.getItem(Vx));return qd.includes(a)?a:1}catch{return 1}}function eg(a){Yl=a,bw(a>1);const e=Fo;e&&(e.speedText=ao>0?`x${a}`:"",e.speedOn=a>1,e.refresh())}function Kx(){if(ao<=0||!Fo||(z==null?void 0:z.endless)!==Fo||z.state==="over")return;const a=qd[(qd.indexOf(Yl)+1)%qd.length];try{localStorage.setItem(Vx,String(a))}catch{}eg(a)}const tg=a=>{var e;((e=a.target)==null?void 0:e.tagName)==="INPUT"||a.repeat||a.ctrlKey||a.metaKey||a.altKey||a.key.toLowerCase()==="v"&&Kx()};function lI(a,e){sg(),ao=e>0&&a.wave.n<=e?e:0,ao&&(Fo=a,a.onSpeed=Kx,window.addEventListener("keydown",tg),eg(rI()))}function sg(){Fo&&(Fo.onSpeed=null),Fo=null,ao=0,Yl=1,bw(!1),window.removeEventListener("keydown",tg)}function cI(a){const e=a.endless;if(e.wave.n<=ao&&e.state!=="done")return Yl;const t=Yl;return ao=0,eg(1),window.removeEventListener("keydown",tg),t>1&&e.state!=="done"&&a.events.onAnnounce(c("Piso nuevo: velocidad normal")),1}let qb=1,Xl=!1,Ib=null,lt=null;function dI(a){return c({auth:"Tu sesión ha caducado: vuelve a entrar en tu cuenta.",job:"Solo los personajes con 2nd job pueden entrar en la torre.",locked:"Este personaje aún no tiene pisos abiertos.",char:"El servidor aún no tiene este personaje: espera unos segundos a que se guarde tu partida y vuelve a intentarlo.",busy:"Ya tienes una partida de la torre en marcha.",version:"Hay una versión nueva del juego: recarga la página para entrar en la torre.",maintenance:"El servidor está en mantenimiento.",banned:"Tu cuenta está bloqueada.",full:"La torre está llena ahora mismo: prueba dentro de un momento.",verify:"El job de este personaje no coincide con el que tiene apuntado el servidor.",stats:"Tus estadísticas repartidas no caben en el Base Lv que el servidor ha podido comprobar de tus partidas.",talents:"Tus talentos no caben en el Job Lv que el servidor ha podido comprobar de tus partidas."}[a]??"No se puede conectar con la torre ahora mismo. Prueba dentro de un momento.")}let Rb=null;function hI(a,e){sg();const t=z,s=pt,n=t.endless;t.state="over",Fn=!0;const o=s.id;Jk(t,a,null,s,()=>{Mr(),o==="dev"?dr():Sa(o)}),document.getElementById("go-title").textContent=n.failed==="quota"?c("No llegaste a los puntos del piso"):n.failed==="boss"?c("Los jefes siguieron vivos"):e?c("Partida terminada"):a?c("¡Torre superada!"):c("Has caído en la torre");const i=(w,m)=>`<div class="go-chip"><span>${w}</span><b>${m}</b></div>`,r=n.state==="fight"||n.state==="done"?n.wave.n:n.wave.n-1,l=document.createElement("section");l.className="go-box";let d=null;const h=(w,m,f,v)=>{const x=ga(ze(o)??s),k=d??x.earned-x.spent;l.innerHTML=`<div class="go-box-title"><span>${c("Endless Tower")}</span><small>${v}</small></div><div class="go-chips">${i(c("Puntuación"),n.score.toLocaleString())}${i(c("Mejor combo"),n.bestCombo)}${i(c("Piso"),w)}${i(c("Pisos superados"),m)}${i(c("Puntos de la torre"),"+"+f)}${i(c("Puntos libres"),d===null&&lt?"…":k)}</div>`};document.getElementById("go-stats").prepend(l);const u=lt;if(lt=null,!u){h(Math.max(r,n.startWave),n.cleared,n.points,"");return}const p=Math.max(r,n.startWave);h(p,n.cleared,n.points,c("Registrando la partida en el servidor…"));const y=Gh(n);u.finish(y).then(w=>{const m=w==="pending"?c("Partida registrada: el servidor la comprobará a lo largo del día. Los puntos y el ladder se apuntan al comprobarla."):w==="cheat"?c("Partida anulada por el servidor"):w==="empty"?c("Partida sin jugar: no cuenta."):u.gone?c("La conexión con el servidor se cortó demasiado rato y cerró la partida: cuenta lo que le llegó antes del corte."):c("El servidor no ha confirmado el final: cuenta lo que le llegó antes de cortarse.");h(p,n.cleared,n.points,m),w1(o).then(f=>{d=f.progress.earned-f.progress.spent,h(p,n.cleared,n.points,m)},()=>{})})}function Wx(a,e){const t=et[e],s=[];if(!t)return s;if(t.reward&&!a.promotion&&!(a.stagesCleared??[]).includes(e)){const n=pf(e);s.push({id:t.reward,quality:Ll,affixes:Zl(Ll,n,t.reward,a.job),ilvl:ac(e),tier:n})}return t.jobWeapon&&s.push(...A1(a,e)),s}function Mr(){Bl("ok");const a=t=>{try{t()}catch(s){console.error("[endGame]",s)}};a(()=>lt==null?void 0:lt.close()),lt=null,a(sg),a(()=>mt==null?void 0:mt.destroy()),mt=null,a(()=>cl==null?void 0:cl.close()),cl=null,a(()=>tt==null?void 0:tt.destroy()),tt=null;const e=z;z=null,pt=null,a(()=>e==null?void 0:e.destroy()),xn("picker")&&a(()=>Uk()),de("pause")}function Wi(){if(z){if(zn)return zn.toggle();if(mt){document.getElementById("pause").classList.contains("hidden")?Ue("pause"):de("pause");return}if(z.state==="playing"){z.state="paused";const a=!!z.endless&&!!lt;document.getElementById("btn-quit").textContent=a?Xl?c("Terminar y salir"):c("Guardar y salir (solo una vez)"):c("Salir al menú"),document.getElementById("btn-endrun").classList.toggle("hidden",!z.endless),Ue("pause")}else z.state==="paused"&&(z.state="playing",de("pause"))}}Hq().catch(a=>{console.error(a),Jt==null||Jt.fail(c("No se pudo cargar el juego. Pulsa para reintentar."))});export{Mw as A,w2 as B,ww as C,e2 as R,YS as S,$w as V,fd as a,a2 as b,yI as l,WS as u};
