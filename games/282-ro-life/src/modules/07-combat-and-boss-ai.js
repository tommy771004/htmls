/**
 * ============================================================================
 * RO Life Source Module: 07-combat-and-boss-ai.js
 * Description: Main Game Simulation (`class Ka`), Story Campaigns (`class X1`/`JA`/`oP`), Endless Tower (`class D5`), Level-Up Deck (`class Rf`), Boss AI (`class _c`), Minimap (`class FT`), DPS Meter (`class XT`), and Need/Greed Rolls (`class MC`)
 * ============================================================================
 */

const __vite__mapDeps=(i,m=__vite_

// --- Boss Telegraph FX & Boss AI (`class _c`) ---
class ek {
  constructor(e,t,s,n) {
    g(this,"canvas");g(this,"world");g(this,"target");g(this,"layer",new Je);g(this,"cursor");g(this,"action","a0");g(this,"sx",0);g(this,"sy",0);g(this,"inside",!1);g(this,"holding",!1);g(this,"followIn",0);g(this,"cleanup",[]);this.canvas=e,this.world=t,this.target=n,this.cursor=new sn(se.sheet("ui_cursor"),"a0"),this.cursor.loop=!0,this.layer.addChild(this.cursor),this.layer.visible=!1,s.addChild(this.layer),e.classList.add("ro-cursor");const o=d=> {
      if(d.pointerType!=="mouse")return;const h=e.getBoundingClientRect();this.sx=d.clientX-h.left,this.sy=d.clientY-h.top,this.inside=!0
    },i=()=> {
      this.inside=!1,this.holding=!1
    },r=d=> {
      var h,u;d.pointerType!=="mouse"||d.button!==0||(o(d),!((u=(h=this.target).pick)!=null&&u.call(h,d.clientX,d.clientY))&&(this.holding=!0,this.followIn=0,this.go()))
    },l=d=> {
      d.button===0&&(this.holding=!1)
    };e.addEventListener("pointermove",o),e.addEventListener("pointerleave",i),e.addEventListener("pointerdown",r),window.addEventListener("pointerup",l),this.cleanup.push(()=> {
      e.removeEventListener("pointermove",o),e.removeEventListener("pointerleave",i),e.removeEventListener("pointerdown",r),window.removeEventListener("pointerup",l)
    })
  }
  go() {
    const e=this.world.pickGround(this.sx,this.sy);e&&this.target.moveTo(e.x,e.y)
  }
  update(e,t) {
    const s=this.target.rotating()?"a4":"a0";s!==this.action&&(this.action=s,this.cursor.play(s),this.cursor.loop=!0),this.cursor.update(e*1e3),this.layer.visible=this.inside,this.layer.position.set(this.sx,this.sy);const n=this.inside&&t?this.world.pickGround(this.sx,this.sy):null;n?this.world.setCellCursor(Za("tex_grid"),Math.floor(n.x/co)*co,Math.floor(n.y/co)*co,co,!0):this.world.setCellCursor(Za("tex_grid"),0,0,co,!1),this.holding&&t&&(this.followIn-=e,this.followIn<=0&&(this.followIn=Y2,this.go()))
  }
  destroy() {
    this.cleanup.forEach(e=>e()),this.canvas.classList.remove("ro-cursor"),this.world.setCellCursor(void 0,0,0,co,!1),this.layer.destroy( {
      children:!0
    })
  }
}
const X2=.45;class tk {
  constructor(e) {
    g(this,"emitters",[]);const t=e.ambient;if(!t)return;const s=De/e.zoom,n=e.width*e.zoom,o=e.height*e.zoom;for(const i of t.emitters)this.emitters.push( {
      id:t.ids[i.s],x:(n/2+i.pos[0])*s,y:(o/2-i.pos[2])*s,vol:i.vol,range:i.range*s,cycle:Math.max(1,i.cycle),timer:Math.random()*i.cycle
    })
  }
  update(e,t,s,n,o) {
    for(const i of this.emitters) {
      if(i.timer-=e,i.timer>0)continue;i.timer=i.cycle*(.85+Math.random()*.3);const r=Math.hypot(i.x-t,i.y-s);if(r>=i.range)continue;const l=1-r/i.range,d=Math.max(-1,Math.min(1,(n(i.x,i.y)-o/2)/(o/2)));B.playAt(i.id,Math.min(1,i.vol)*l*l*X2,d*.8,3,"ambient")
    }
  }
}
const J2= {
  109:["str_bubble1","str_bubble2","str_bubble3","str_bubble4"]
},vy=1100;class Q2 {
  constructor(e) {
    g(this,"points",[]);const t=De/e.zoom,s=e.width*e.zoom,n=e.height*e.zoom;for(const o of e.effects) {
      const i=J2[o.id];i&&this.points.push( {
        ids:i,x:(s/2+o.pos[0])*t,y:(n/2-o.pos[2])*t,timer:Math.random()*3
      })
    }
  }
  update(e,t,s,n) {
    for(const o of this.points) {
      if(o.timer-=e,o.timer>0||(o.timer=1.5+Math.random()*2.5,Math.abs(o.x-t)>vy||Math.abs(o.y-s)>vy))continue;const i=yt(o.ids[Math.floor(Math.random()*o.ids.length)],o.x,o.y);i&&n(i)
    }
  }
}
const Pt=De/2,ho=65535,To=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],Z2=To.map(a=>a[0]),eE=To.map(a=>a[1]);class sk {
  constructor(e,t,s) {
    g(this,"w");g(this,"h");g(this,"mask");g(this,"dist");g(this,"queue");g(this,"flowCell",-1);g(this,"links",new Map);g(this,"warpCells",null);g(this,"warpTo",[]);g(this,"warpFrom",[]);g(this,"closed",new Set);g(this,"lastWarp",-1);g(this,"pathDist",null);g(this,"clearance",null);this.w=e,this.h=t,this.mask=s,this.dist=new Uint16Array(e*t).fill(ho),this.queue=new Int32Array(e*t)
  }
  cellOf(e,t) {
    const s=Math.floor(e/Pt),n=Math.floor(t/Pt);return s<0||n<0||s>=this.w||n>=this.h?-1:n*this.w+s
  }
  setWarps(e) {
    const {
      w:t,h:s,mask:n
    }
    =this;this.warpFrom=e.map(r=>r.from);const o=(r,l,d)=>Math.max(Math.abs(r.from[0]-l),Math.abs(r.from[1]-d))<=1.5,i=(r,l)=>e.some(d=>o(d,r,l));this.warpTo=e.map(r=> {
      if(!i(r.to[0],r.to[1]))return r.to;for(let l=1;l<6;l++)for(let d=-l;d<=l;d++)for(let h=-l;h<=l;h++) {
        const u=r.to[0]+h,p=r.to[1]+d;if(!(Math.max(Math.abs(h),Math.abs(d))!==l||u<0||p<0||u>=t||p>=s)&&n[p*t+u]&&!i(u,p))return[u,p]
      }
      return r.to
    }),this.buildWarps()
  }
  buildWarps() {
    const {
      w:e,h:t,mask:s
    }
    =this;this.warpCells=new Uint8Array(e*t),this.links.clear(),this.warpFrom.forEach((n,o)=> {
      if(this.closed.has(o))return;const i=[];for(let l=Math.ceil(n[1]-1.5);l<=n[1]+1.5;l++)for(let d=Math.ceil(n[0]-1.5);d<=n[0]+1.5;d++)d<0||l<0||d>=e||l>=t||!s[l*e+d]||(this.warpCells[l*e+d]=o+1,i.push(l*e+d));const r=this.warpTo[o][1]*e+this.warpTo[o][0];this.links.set(r,[...this.links.get(r)??[],...i])
    }),this.flowCell=-1
  }
  setWarpOpen(e,t) {
    e<0||t===!this.closed.has(e)||(t?this.closed.delete(e):this.closed.add(e),this.buildWarps())
  }
  warpOpen(e) {
    return!this.closed.has(e)
  }
  warpAt(e,t) {
    const s=this.warpCells?this.cellOf(e,t):-1,n=s>=0?this.warpCells[s]:0;if(!n)return null;this.lastWarp=n-1;const[o,i]=this.warpTo[n-1];return[(o+.5)*Pt,(i+.5)*Pt]
  }
  walkable(e,t) {
    const s=this.cellOf(e,t);return s>=0&&this.mask[s]===1
  }
  resolve(e,t,s,n) {
    return this.walkable(s,n)||!this.walkable(e,t)?[s,n]:this.walkable(s,t)?[s,t]:this.walkable(e,n)?[e,n]:[e,t]
  }
  nearestWalkable(e,t) {
    if(this.walkable(e,t))return[e,t];const s=Math.floor(e/Pt),n=Math.floor(t/Pt);for(let o=1;o<Math.max(this.w,this.h);o++)for(let i=-o;i<=o;i++)for(let r=-o;r<=o;r++) {
      if(Math.max(Math.abs(r),Math.abs(i))!==o)continue;const l=s+r,d=n+i;if(l>=0&&d>=0&&l<this.w&&d<this.h&&this.mask[d*this.w+l])return[(l+.5)*Pt,(d+.5)*Pt]
    }
    return[e,t]
  }
  updateFlow(e,t) {
    const s=this.cellOf(e,t);if(s<0||s===this.flowCell)return;this.flowCell=s;const {
      w:n,h:o,mask:i,dist:r,queue:l
    }
    =this;r.fill(ho);let d=0,h=0;for(r[s]=0,l[h++]=s;d<h;) {
      const u=l[d++],p=u%n,y=(u-p)/n,w=r[u]+1;for(let f=0;f<8;f++) {
        const v=Z2[f],x=eE[f],k=p+v,M=y+x;if(k<0||M<0||k>=n||M>=o)continue;const $=M*n+k;!i[$]||r[$]<=w||v&&x&&(!i[y*n+k]||!i[M*n+p])||(r[$]=w,l[h++]=$)
      }
      const m=this.links.get(u);if(m)for(const f of m)r[f]<=w||(r[f]=w,l[h++]=f)
    }
  }
  lineClear(e,t,s,n) {
    const o=we(s-e,n-t),i=Math.max(1,Math.ceil(o/(Pt/3)));for(let r=1;r<=i;r++) {
      const l=r/i;if(!this.walkable(e+(s-e)*l,t+(n-t)*l))return!1
    }
    return!0
  }
  pathTo(e,t,s,n) {
    const o=this.cellOf(e,t),i=this.cellOf(s,n);if(o<0||i<0||!this.mask[i])return null;if(this.lineClear(e,t,s,n))return[ {
      x:s,y:n
    }
    ];const {
      w:r,h:l,mask:d,queue:h
    }
    =this,u=this.pathDist??(this.pathDist=new Uint16Array(r*l));u.fill(ho);let p=0,y=0;for(u[i]=0,h[y++]=i;p<y&&u[o]===ho;) {
      const k=h[p++],M=k%r,$=(k-M)/r,P=u[k]+1;for(const[q,R]of To) {
        const L=M+q,j=$+R;if(L<0||j<0||L>=r||j>=l)continue;const A=j*r+L;!d[A]||u[A]<=P||q&&R&&(!d[$*r+L]||!d[j*r+M])||(u[A]=P,h[y++]=A)
      }
    }
    if(u[o]===ho)return null;const w=[];let m=o;for(;m!==i;) {
      const k=m%r,M=(m-k)/r;let $=m;for(const[q,R]of To) {
        const L=k+q,j=M+R;if(L<0||j<0||L>=r||j>=l)continue;const A=j*r+L;!d[A]||u[A]>=u[$]||q&&R&&(!d[M*r+L]||!d[j*r+k])||($=A)
      }
      if($===m)break;m=$;const P=m%r;w.push( {
        x:(P+.5)*Pt,y:((m-P)/r+.5)*Pt
      })
    }
    w.length&&(w[w.length-1]= {
      x:s,y:n
    });const f=[];let v= {
      x:e,y:t
    },x=0;for(;x<w.length;) {
      let k=w.length-1;for(;k>x&&!this.lineClear(v.x,v.y,w[k].x,w[k].y);)k--;f.push(w[k]),v=w[k],x=k+1
    }
    return f
  }
  getClearance() {
    if(this.clearance)return this.clearance;const {
      w:e,h:t,mask:s,queue:n
    }
    =this,o=this.clearance=new Uint8Array(e*t).fill(255);let i=0,r=0;for(let l=0;l<e*t;l++)s[l]||(o[l]=0,n[r++]=l);for(;i<r;) {
      const l=n[i++],d=l%e,h=(l-d)/e;for(const[u,p]of To) {
        const y=d+u,w=h+p;if(y<0||w<0||y>=e||w>=t)continue;const m=w*e+y;o[m]<=o[l]+1||(o[m]=o[l]+1,n[r++]=m)
      }
    }
    for(let l=0;l<t;l++)for(let d=0;d<e;d++) {
      const h=Math.min(d,l,e-1-d,t-1-l)+1;o[l*e+d]>h&&(o[l*e+d]=h)
    }
    return o
  }
  route(e,t,s,n) {
    [e,t]=this.nearestWalkable(e,t),[s,n]=this.nearestWalkable(s,n);const o=this.cellOf(e,t),i=this.cellOf(s,n);if(o<0||i<0)return null;const {
      w:r,h:l,mask:d
    }
    =this,h=this.getClearance(),u=this.warpCells,p=new Float64Array(r*l).fill(1/0),y=new Int32Array(r*l).fill(-1),w=[],m=[],f=($,P)=> {
      let q=w.length;for(w.push($),m.push(P);q>0;) {
        const R=q-1>>1;if(m[R]<=P)break;w[q]=w[R],m[q]=m[R],q=R
      }
      w[q]=$,m[q]=P
    },v=()=> {
      const $=w[0],P=w.pop(),q=m.pop();if(w.length) {
        let R=0;for(;;) {
          let L=2*R+1;if(L>=w.length||(L+1<w.length&&m[L+1]<m[L]&&L++,m[L]>=q))break;w[R]=w[L],m[R]=m[L],R=L
        }
        w[R]=P,m[R]=q
      }
      return $
    };for(p[i]=0,f(i,0);w.length;) {
      const $=m[0],P=v();if($>p[P])continue;if(P===o)break;const q=P%r,R=(P-q)/r;for(const[j,A]of To) {
        const E=q+j,C=R+A;if(E<0||C<0||E>=r||C>=l)continue;const _=C*r+E;if(!d[_]||u!=null&&u[_]||j&&A&&(!d[R*r+E]||!d[C*r+q]))continue;const U=Math.max(0,4-h[_]),D=$+(j&&A?Math.SQRT2:1)*(1+.6*U*U);D>=p[_]||(p[_]=D,y[_]=P,f(_,D))
      }
      const L=this.links.get(P);if(L)for(const j of L)$>=p[j]||(p[j]=$,y[j]=P,f(j,$))
    }
    if(p[o]===1/0)return null;const x=$=> {
      const P=$%r;return {
        x:(P+.5)*Pt,y:(($-P)/r+.5)*Pt
      }
    },k=[];let M=[ {
      x:e,y:t
    }
    ];for(let $=o,P=0;$!==i&&P<r*l;P++) {
      const q=u==null?void 0:u[$];if(q) {
        const[R,L]=this.warpFrom[q-1];M.push( {
          x:(R+.5)*Pt,y:(L+.5)*Pt
        }),k.push(M),$=y[$],M=[x($)];continue
      }
      if($=y[$],$<0)return null;u!=null&&u[$]||M.push($===i? {
        x:s,y:n
      }
      :x($))
    }
    return k.push(M),k.map($=>$.map((P,q)=> {
      if(q===0||q===$.length-1)return P;let[R,L,j]=[0,0,0];for(let A=Math.max(0,q-3);A<=Math.min($.length-1,q+3);A++)[R,L,j]=[R+$[A].x,L+$[A].y,j+1];return {
        x:R/j,y:L/j
      }
    }))
  }
  get warpsKey() {
    return[...this.closed].join(",")
  }
  reachable(e,t) {
    const s=this.cellOf(e,t);return s>=0&&this.dist[s]!==ho
  }
  flowDir(e,t) {
    const s=this.cellOf(e,t);if(s<0||this.dist[s]===ho)return null;const {
      w:n,h:o,mask:i,dist:r
    }
    =this,l=s%n,d=(s-l)/n;let h=r[s],u=0,p=0;for(const[f,v]of To) {
      const x=l+f,k=d+v;if(x<0||k<0||x>=n||k>=o)continue;const M=k*n+x;!i[M]||r[M]>=h||f&&v&&(!i[d*n+x]||!i[k*n+l])||(h=r[M],u=(x+.5)*Pt,p=(k+.5)*Pt)
    }
    if(h===r[s])return null;const y=u-e,w=p-t,m=we(y,w)||1;return[y/m,w/m]
  }
}
const Ni= {
  min:1,max:2
},Ko=[ {
  key:"count",name:"Número de enemigos",min:1,max:3
}, {
  key:"damage",name:"Daño de los enemigos",min:1,max:1.5
}, {
  key:"hp",name:"Vida de los enemigos",min:1,max:2
}, {
  key:"speed",name:"Velocidad de los enemigos",min:1,max:1.5
}, {
  key:"events",name:"Número de eventos",min:1,max:2
}
];for(const a of Ko)Ob(a,["name"]);const Ta= {
  count:1,damage:1,hp:1,speed:1,events:1
};function sr(a) {
  const e=1/Ko.length;return 1+Ko.reduce((t,s)=>t+e*(a[s.key]-s.min)/(s.max-s.min),0)
}
const ak="ro-life.difficulty.v1";function nk() {
  try {
    const a=JSON.parse(localStorage.getItem(ak)??"null");return gr( {
      ...Ta,...a??{}
    })
  }
  catch {
    return {
      ...Ta
    }
  }
}
function tE(a) {
  try {
    localStorage.setItem(ak,JSON.stringify(a))
  }
  catch{}
}
function gr(a) {
  const e= {
    ...a
  };for(const t of Ko) {
    const s=Number(e[t.key]);e[t.key]=Number.isFinite(s)?Math.min(t.max,Math.max(t.min,s)):t.min
  }
  if(e.pick!==void 0) {
    const t=Number(e.pick);e.pick=Number.isFinite(t)?Math.min(Ni.max,Math.max(Ni.min,t)):Ni.min
  }
  return e
}
const Qs=78,xo=200,Lr=170,vu=2600,sE=`
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vP;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vP = position;
    gl_Position = projectionMatrix * mv;
  }
`,aE=`
  ${ni}
  uniform float time;
  uniform float charge;
  uniform float sealed;
  uniform float flash;
  uniform float fade;
  uniform float height;
  uniform float radius;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vP;
  void main() {
    float h = vP.y / height;
    float ang = atan(vP.z, vP.x);
    vec2 q = vec2(ang * 3.0, h * 6.0);
    float grain = fbm(q * 2.5) * 0.6 + fNoise(q * 14.0) * 0.4;
    vec3 bronze = mix(vec3(0.42, 0.26, 0.11), vec3(0.86, 0.6, 0.3), grain);
    // bandas en relieve: la de la boca, la del hombro y la de arriba
    float band = 0.0;
    band += smoothstep(0.035, 0.0, abs(h - 0.1));
    band += smoothstep(0.03, 0.0, abs(h - 0.8));
    band += smoothstep(0.025, 0.0, abs(h - 0.9));
    float groove = smoothstep(0.012, 0.0, abs(h - 0.135)) + smoothstep(0.01, 0.0, abs(h - 0.765));
    // cuatro cuadrículas de 3×3 tetillas (yudu) bajo el hombro
    float sector = mod(ang + 3.14159, 1.5708) - 0.7854;
    float inPanel = step(abs(sector), 0.42) * step(0.56, h) * step(h, 0.76);
    vec2 cell = vec2(sector / 0.28, (h - 0.56) / 0.0667);
    vec2 f = fract(cell) - 0.5;
    float stud = inPanel * smoothstep(0.32, 0.18, length(f));
    float frame = step(abs(sector), 0.45) * step(0.545, h) * step(h, 0.775) * (1.0 - inPanel);
    // loto donde se golpea, a los dos lados
    float lotus = 0.0;
    for (int i = 0; i < 2; i++) {
      float a = float(i) * 3.14159 + 1.5708;
      float da = atan(sin(ang - a), cos(ang - a));
      vec2 lp = vec2(da * radius, (h - 0.3) * height);
      float r = length(lp);
      float petals = 0.5 + 0.5 * cos(atan(lp.y, lp.x) * 8.0);
      lotus += smoothstep(17.0, 13.0, r) * (0.5 + 0.5 * petals) + smoothstep(5.0, 3.0, r);
    }
    float relief = band * 0.55 + stud * 0.7 + frame * 0.25 + lotus * 0.45;
    // pátina: verdete en las zonas bajas de cada relieve y a chorretones
    float drip = fbm(vec2(ang * 5.0, h * 2.0 - fNoise(vec2(ang * 9.0, 0.0)) * 0.6));
    float patina = smoothstep(0.55, 0.85, drip + (1.0 - h) * 0.15) * (1.0 - relief * 0.8);
    vec3 col = mix(bronze, vec3(0.24, 0.5, 0.4), patina * 0.55);
    col = mix(col, vec3(1.0, 0.8, 0.42), relief * 0.75);
    col *= 1.0 - groove * 0.55;
    vec3 n = normalize(vN);
    vec3 v = normalize(vView);
    vec3 l = normalize(vec3(-0.3, 0.8, 0.6));
    float dif = 0.55 + 0.6 * max(0.0, dot(n, l));
    float spec = pow(max(0.0, dot(reflect(-l, n), v)), 28.0) * (0.6 + relief) * (1.0 - patina * 0.7);
    vec3 lit = col * dif + vec3(1.0, 0.9, 0.65) * spec * 1.3;
    // resplandor: dorado al cargar; rojo si está sellada
    float fres = pow(1.0 - abs(dot(n, v)), 2.5);
    vec3 glowCol = mix(vec3(1.0, 0.8, 0.4), vec3(1.0, 0.18, 0.12), sealed);
    float pulse = 0.7 + 0.3 * sin(time * (4.0 + charge * 10.0));
    lit += glowCol * (fres * (0.45 + charge * 1.1) * pulse + relief * (0.15 + charge * 0.45) * pulse);
    lit += vec3(1.0, 0.95, 0.8) * flash * (0.6 + fres);
    gl_FragColor = vec4(lit, fade);
  }
`,nE=`
  varying vec2 vP;
  void main() {
    vP = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,oE=`
  ${ni}
  uniform float time;
  uniform float charge;
  uniform float sealed;
  uniform float fade;
  uniform float wave;
  uniform float safeR;
  uniform float dangerR;
  varying vec2 vP;
  void main() {
    float d = length(vP);
    float a = atan(vP.y, vP.x);
    vec4 outc = vec4(0.0);
    // zona segura
    if (d < safeR * 1.12) {
      float k = d / safeR;
      float rim = exp(-abs(k - 1.0) * 30.0);
      float runes = step(0.5, fract(a * 6.0 / 3.14159 + time * 0.25)) * smoothstep(0.03, 0.0, abs(k - 0.86)) ;
      float ticks = step(0.8, fract(a * 24.0 / 3.14159 - time * 0.4)) * smoothstep(0.025, 0.0, abs(k - 0.94));
      float fill = smoothstep(1.0, 0.0, k) * (0.18 + 0.08 * sin(time * 3.0 - k * 9.0));
      vec3 gold = vec3(1.0, 0.82, 0.45);
      vec3 red = vec3(1.0, 0.16, 0.1);
      // sellada: aspas cruzadas y el borde a trozos
      float hatch = step(0.85, fract((vP.x + vP.y) / 26.0)) + step(0.85, fract((vP.x - vP.y) / 26.0));
      vec3 c = mix(gold, red, sealed);
      float alpha = rim * 1.1 + runes * 0.8 + ticks * 0.6 + fill + sealed * hatch * 0.25 * smoothstep(1.0, 0.6, k);
      alpha *= step(d, safeR * 1.12);
      outc = vec4(c, clamp(alpha, 0.0, 1.0) * (0.55 + 0.45 * charge));
    }
    // peligro en el resto del mapa: rellena desde fuera hacia la zona segura
    if (d > safeR * 1.05) {
      float front = mix(dangerR, safeR * 1.05, charge);
      float filled = smoothstep(front + 60.0, front, d);
      float n = fNoise(vP / 90.0 + time * 0.3);
      float ripples = 0.5 + 0.5 * sin(d / 38.0 + time * 6.0);
      float edge = exp(-abs(d - front) / 18.0);
      float alpha = filled * (0.16 + 0.1 * ripples + 0.06 * n) + edge * 0.6;
      alpha *= smoothstep(dangerR, dangerR * 0.85, d);
      outc.rgb = mix(outc.rgb, vec3(0.9, 0.08, 0.12), step(outc.a, 0.01));
      outc.a = max(outc.a, alpha);
    }
    // la campanada: onda que sale de la campana
    if (wave > 0.0) {
      float r = wave * dangerR;
      float w = exp(-abs(d - r) / 26.0) * (1.0 - wave);
      outc.rgb = mix(outc.rgb, vec3(1.0, 0.9, 0.85), clamp(w * 2.0, 0.0, 1.0));
      outc.a = max(outc.a, w * 1.4);
    }
    gl_FragColor = vec4(outc.rgb, outc.a * fade);
  }
`,iE=`
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`,rE=`
  ${ni}
  uniform float time;
  uniform float charge;
  uniform float sealed;
  uniform float fade;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.5);
    float streak = fNoise(vec2(vUv.x * 40.0, vUv.y * 3.0 + time * 1.6));
    float fall = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    float runes = sealed * step(0.7, fract(vUv.x * 18.0)) * step(0.5, fract(vUv.y * 6.0 - time * 0.8));
    vec3 c = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.2, 0.14), sealed);
    float a = (0.14 + fres * 0.45 + streak * 0.22) * fall * (0.5 + 0.5 * charge) + runes * 0.4;
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * fade);
  }
`;function lE() {
  return[[.86,0],[1,.02],[1,.08],[.95,.12],[.9,.25],[.86,.45],[.84,.65],[.84,.78],[.86,.8],[.82,.84],[.8,.9],[.74,.96],[.55,1],[0,1.01]].map(([e,t])=>new TM(e*Qs,t*xo))
}
class cE {
  constructor(e) {
    g(this,"mesh",new Gn);g(this,"bell",new Gn);g(this,"bellMat");g(this,"groundMat");g(this,"beamMat");g(this,"geos",[]);g(this,"age",0);g(this,"sealedNow",0);g(this,"swing",0);g(this,"swingV",0);g(this,"waveAge",-1);g(this,"out",-1);g(this,"charge",0);g(this,"sealed",!1);const t= {
      time: {
        value:0
      },charge: {
        value:0
      },sealed: {
        value:0
      },fade: {
        value:0
      }
    };this.bellMat=new ys( {
      vertexShader:sE,fragmentShader:aE,uniforms: {
        ...t,flash: {
          value:0
        },height: {
          value:xo
        },radius: {
          value:Qs
        }
      },transparent:!0,side:ba
    });const s=new SM(lE(),48),n=new EM(Qs*.34,Qs*.11,10,24);n.translate(0,xo*1.01+Qs*.3,0);const o=new pg(Qs*.09,Qs*.12,Qs*.55,12);o.translate(Qs*.42,xo*1.01+Qs*.27,0);for(const h of[s,n,o]) {
      this.geos.push(h);const u=new vs(h,this.bellMat);u.renderOrder=4,u.frustumCulled=!1,this.bell.add(u)
    }
    this.bell.position.y=Lr,this.bell.children.forEach(h=>h.position.y=-xo*1.25),this.bell.position.y=Lr+xo*1.25;const i=new jm(vu*2,vu*2);i.rotateX(-Math.PI/2),this.geos.push(i),this.groundMat=new ys( {
      vertexShader:nE,fragmentShader:oE,uniforms: {
        ...t,wave: {
          value:0
        },safeR: {
          value:e.safeR
        },dangerR: {
          value:vu
        }
      },transparent:!0,depthWrite:!1,side:ba,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4
    });const r=new vs(i,this.groundMat);r.position.y=3,r.renderOrder=2,r.frustumCulled=!1;const l=new pg(Qs*.86,e.safeR,Lr,40,1,!0);l.translate(0,Lr/2,0),this.geos.push(l),this.beamMat=new ys( {
      vertexShader:iE,fragmentShader:rE,uniforms: {
        ...t
      },transparent:!0,depthWrite:!1,blending:bh,side:ba
    });const d=new vs(l,this.beamMat);d.renderOrder=5,d.frustumCulled=!1,this.mesh.add(r,d,this.bell)
  }
  toll() {
    this.waveAge=0,this.bellMat.uniforms.flash.value=1,this.swingV+=2.6
  }
  finish() {
    this.out<0&&(this.out=0)
  }
  update(e,t) {
    this.age+=e;const s=e*1e3,n=Math.min(1,this.age/.9);let o=n;this.out>=0&&(this.out+=s,o=Math.max(0,1-this.out/1200)),this.sealedNow+=((this.sealed?1:0)-this.sealedNow)*Math.min(1,e*5),this.swingV+=-this.swing*22*e,this.swingV*=Math.exp(-e*1.6),this.swing+=this.swingV*e,this.bell.rotation.z=this.swing*.35+Math.sin(this.age*1.3)*.03,this.bell.rotation.y=this.age*.15;const i=(1-n)*260+(this.out>=0?this.out/1200*200:0);this.bell.position.y=Lr+xo*1.25+i+Math.sin(this.age*1.7)*6,this.waveAge>=0&&(this.waveAge+=s);const r=this.waveAge>=0?Math.min(1,this.waveAge/1300):0;for(const l of[this.bellMat,this.groundMat,this.beamMat]) {
      const d=l.uniforms;d.time.value+=e,d.charge.value=this.charge,d.sealed.value=this.sealedNow,d.fade.value=o
    }
    return this.groundMat.uniforms.wave.value=r,this.waveAge>=0&&(this.groundMat.uniforms.charge.value=this.charge*(1-Math.min(1,this.waveAge/300))),this.bellMat.uniforms.flash.value=Math.max(0,this.bellMat.uniforms.flash.value-e*2.5),this.out>=1200
  }
  dispose() {
    for(const e of this.geos)e.dispose();this.bellMat.dispose(),this.groundMat.dispose(),this.beamMat.dispose()
  }
}
const dE=`
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`,hE=`
  uniform float opacity;
  uniform float time;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vV);
    float f = 1.0 - abs(dot(n, v));
    float rim = pow(f, 2.2);
    vec3 base = vec3(0.25, 0.55, 1.0);
    vec3 iri = 0.5 + 0.5 * cos(6.2831 * (f * 1.3 + time * 0.25 + vec3(0.0, 0.33, 0.67)));
    vec3 col = mix(base, mix(base, iri, 0.35), rim) + vec3(0.8, 0.9, 1.0) * pow(f, 6.0) * 0.6;
    vec3 L = normalize(vec3(-0.4, 0.85, 0.45));
    float spec = pow(max(dot(reflect(-L, n), v), 0.0), 36.0);
    float a = (0.24 + rim * 0.75 + spec) * opacity;
    gl_FragColor = vec4(col + spec, clamp(a, 0.0, 1.0));
  }`,uE=180;class pE {
  constructor(e) {
    g(this,"mesh",new Gn);g(this,"sphere");g(this,"mat");g(this,"age",0);g(this,"popped",!1);g(this,"phase",Math.random()*6);this.o=e,this.mat=new ys( {
      vertexShader:dE,fragmentShader:hE,uniforms: {
        opacity: {
          value:1
        },time: {
          value:0
        }
      },transparent:!0,depthWrite:!1
    }),this.sphere=new vs(new _m(e.r,24,16),this.mat),this.sphere.renderOrder=3,this.mesh.add(this.sphere)
  }
  update(e) {
    var i;this.age+=e*1e3;const t=this.o,s=Math.min(1,this.age/t.fly);this.mat.uniforms.time.value=this.age/1e3;const n=Math.sin(this.age/40+this.phase);if(this.sphere.position.set(t.dx*s,t.height+Math.sin(s*Math.PI)*t.r*.8,t.dz*s),s<1)return this.sphere.scale.set(1+.07*n,1-.07*n,1+.07*n),!1;this.popped||(this.popped=!0,(i=t.onPop)==null||i.call(t));const o=Math.min(1,(this.age-t.fly)/uE);return this.sphere.scale.setScalar(1+o*.7),this.mat.uniforms.opacity.value=1-o,o>=1
  }
  dispose() {
    this.sphere.geometry.dispose(),this.mat.dispose()
  }
}
const tc=`
  // de bronce oscuro a oro y a un brillo casi blanco
  vec3 goldRamp(float t) {
    vec3 c = mix(vec3(0.45, 0.26, 0.04), vec3(1.0, 0.74, 0.22), smoothstep(0.0, 0.55, t));
    return mix(c, vec3(1.0, 0.97, 0.82), smoothstep(0.7, 1.0, t));
  }
`,mE=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;function Qm(a,e,t=e) {
  const s=new jm(e,t);s.rotateX(-Math.PI/2);const n=new vs(s,a);return n.renderOrder=2,n.frustumCulled=!1,n
}
function Ch(a,e,t=!0) {
  return new ys( {
    vertexShader:mE,fragmentShader:a,uniforms:e,transparent:!0,depthWrite:!1,blending:t?bh:Db,side:ba,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4
  })
}
let Cc=null;function ok() {
  if(Cc)return Cc;const a=document.createElement("canvas");a.width=a.height=64;const e=a.getContext("2d"),t=e.createRadialGradient(32,32,0,32,32,18);t.addColorStop(0,"rgba(255,255,240,1)"),t.addColorStop(.4,"rgba(255,215,110,0.7)"),t.addColorStop(1,"rgba(255,170,40,0)"),e.fillStyle=t,e.fillRect(0,0,64,64),e.globalCompositeOperation="lighter";for(const[s,n]of[[30,2.2],[2.2,30]]) {
    const o=e.createRadialGradient(32,32,0,32,32,30);o.addColorStop(0,"rgba(255,250,220,0.95)"),o.addColorStop(1,"rgba(255,190,60,0)"),e.fillStyle=o,e.beginPath(),e.ellipse(32,32,s,n,0,0,Math.PI*2),e.fill()
  }
  return Cc=Hb(new Fb(a)),Cc
}
let Lc=null;function fE() {
  if(Lc)return Lc;const a=document.createElement("canvas");a.width=a.height=32;const e=a.getContext("2d"),t=e.createRadialGradient(12,11,1,16,16,14);return t.addColorStop(0,"#fff8d0"),t.addColorStop(.45,"#ffd257"),t.addColorStop(1,"#a8701a"),e.fillStyle=t,e.beginPath(),e.arc(16,16,13,0,Math.PI*2),e.fill(),e.strokeStyle="rgba(120,70,10,0.9)",e.lineWidth=2,e.stroke(),e.strokeStyle="rgba(255,240,180,0.8)",e.lineWidth=1.5,e.beginPath(),e.arc(16,16,8,0,Math.PI*2),e.stroke(),Lc=Hb(new Fb(a)),Lc
}
function Gp(a,e,t,s) {
  const n=new Nn;n.setAttribute("position",new Yi(new Float32Array(a*3),3)),n.setAttribute("color",new Yi(new Float32Array(a*3),3));const o=new Xi(n,new CM( {
    size:e,map:t,vertexColors:!0,transparent:!0,depthWrite:!1,alphaTest:s?0:.3,blending:s?bh:Db,sizeAttenuation:!0
  }));return o.renderOrder=6,o.frustumCulled=!1,o
}
function Vp(a) {
  a.geometry.dispose(),a.material.dispose()
}
const gE=`
  uniform float radius;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vH;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    vUv = uv;
    vH = position.y / radius;
    gl_Position = projectionMatrix * mv;
  }
`,yE=`
  ${ni}
  ${tc}
  uniform float time;
  uniform float fade;
  uniform float hit;
  uniform float crack;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vH;
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
  }
  void main() {
    vec2 hv = vec2(vUv.x * 30.0, vH * 7.0);
    vec2 r = vec2(1.0, 1.7320508);
    vec2 a = mod(hv, r) - r * 0.5;
    vec2 b = mod(hv - r * 0.5, r) - r * 0.5;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 id = hv - gv;
    float edge = 1.0 - smoothstep(0.02, 0.07, 0.5 - hexDist(gv));
    // cada celda late a su ritmo
    float cell = 0.5 + 0.5 * sin(time * 3.0 + fHash(id) * 6.28);
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
    float sweep = exp(-abs(vH - fract(time * 0.55)) * 14.0);
    float flick = crack > 0.0 ? step(0.35, fNoise(vec2(time * 30.0, 0.0))) * (1.0 - crack * 0.5) + (1.0 - crack) * 0.3 : 1.0;
    float k = 0.06 + fres * 0.7 + edge * (0.25 + 0.45 * fres) * (0.5 + 0.5 * cell) + sweep * 0.35 + hit * 0.5;
    vec3 col = goldRamp(clamp(0.45 + fres * 0.5 + edge * 0.3 + hit * 0.4, 0.0, 1.0));
    float base = smoothstep(0.0, 0.08, vH);
    gl_FragColor = vec4(col, clamp(k, 0.0, 1.0) * fade * flick * base);
  }
`,vE=`
  ${tc}
  uniform float fade;
  uniform float time;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float ring = exp(-abs(d - 0.92) * 40.0) + 0.25 * smoothstep(0.95, 0.3, d) * (0.6 + 0.4 * sin(time * 4.0 - d * 12.0));
    if (d > 1.0) discard;
    gl_FragColor = vec4(goldRamp(0.6 + ring * 0.3), clamp(ring, 0.0, 1.0) * fade * 0.8);
  }
`;class bE {
  constructor(e) {
    g(this,"mesh",new Gn);g(this,"mat");g(this,"ringMat");g(this,"age",0);this.o=e;const t=new _m(e.r,48,18,0,Math.PI*2,0,Math.PI/2);this.mat=new ys( {
      vertexShader:gE,fragmentShader:yE,uniforms: {
        radius: {
          value:e.r
        },time: {
          value:0
        },fade: {
          value:0
        },hit: {
          value:0
        },crack: {
          value:0
        }
      },transparent:!0,depthWrite:!1,blending:bh,side:ba
    });const s=new vs(t,this.mat);s.renderOrder=5,s.frustumCulled=!1,this.ringMat=Ch(vE, {
      fade: {
        value:0
      },time: {
        value:0
      }
    }),this.mesh.add(Qm(this.ringMat,e.r*2.1),s)
  }
  hit() {
    this.mat.uniforms.hit.value=1
  }
  update(e,t) {
    this.age+=e*1e3;const s=this.o.follow();if(!s)return!0;this.mesh.position.copy(t(s.x,s.y));const n=this.mat.uniforms;n.time.value+=e,n.hit.value=Math.max(0,n.hit.value-e*5);const o=this.o.duration-this.age;n.crack.value=o<700?1-Math.max(0,o)/700:0,n.fade.value=Math.min(1,this.age/250)*(o>0?1:0);const i=Math.min(1,this.age/300);return this.mesh.children[1].scale.set(.6+.4*i,i,.6+.4*i),this.ringMat.uniforms.fade.value=n.fade.value,this.ringMat.uniforms.time.value+=e,o<=0
  }
  dispose() {
    for(const e of this.mesh.children)e.geometry.dispose();this.mat.dispose(),this.ringMat.dispose()
  }
}
const wE=`
  ${ni}
  ${tc}
  uniform float progress;
  uniform float seed;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;
    float k = 1.0 - pow(1.0 - progress, 3.0);
    float ring = exp(-abs(d - k) * 22.0);
    float inner = smoothstep(k, 0.0, d) * (1.0 - progress) * 0.5;
    float sp = step(0.82, fNoise(p * 40.0 + seed)) * smoothstep(k, k - 0.3, d);
    float a = (ring * 1.2 + inner + sp * 0.8) * (1.0 - progress);
    gl_FragColor = vec4(goldRamp(0.55 + ring * 0.45), clamp(a, 0.0, 1.0));
  }
`;class Zm {
  constructor(e) {
    g(this,"mesh",new Gn);g(this,"mat");g(this,"points");g(this,"shards",[]);g(this,"age",0);g(this,"duration");g(this,"reach");this.reach=e.r,this.duration=e.duration??1e3,this.mat=Ch(wE, {
      progress: {
        value:0
      },seed: {
        value:Math.random()*50
      }
    });const t=e.shards??Math.round(30+e.r*.5);for(let s=0;s<t;s++) {
      const n=Math.random()*Math.PI*2,o=Math.random()*e.r*.35,i=60+Math.random()*e.r*1.6;this.shards.push( {
        x:Math.cos(n)*o,y:4,z:Math.sin(n)*o,vx:Math.cos(n)*i,vz:Math.sin(n)*i,vy:220+Math.random()*360,life:600+Math.random()*(this.duration-600),phase:Math.random()*6
      })
    }
    this.points=Gp(t,70,ok(),!0),this.mesh.add(Qm(this.mat,e.r*2.2),this.points)
  }
  update(e) {
    this.age+=e*1e3,this.mat.uniforms.progress.value=Math.min(1,this.age/(this.duration*.6));const t=this.points.geometry.getAttribute("position"),s=this.points.geometry.getAttribute("color");return this.shards.forEach((n,o)=> {
      n.vy-=1100*e,n.x+=n.vx*e,n.z+=n.vz*e,n.y=Math.max(2,n.y+n.vy*e),n.y<=2&&(n.vy=Math.abs(n.vy)*.3,n.vx*=.5,n.vz*=.5),t.setXYZ(o,n.x,n.y,n.z);const i=Math.max(0,1-this.age/n.life),r=.55+.45*Math.abs(Math.sin(this.age*.02+n.phase));s.setXYZ(o,i*r,i*r*.85,i*r*.5)
    }),t.needsUpdate=!0,s.needsUpdate=!0,this.age>=this.duration
  }
  dispose() {
    this.mesh.children[0].geometry.dispose(),this.mat.dispose(),Vp(this.points)
  }
}
const kE=`
  ${ni}
  ${tc}
  uniform float grow;
  uniform float fade;
  uniform float time;
  uniform float seed;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float rr = length(p) * 2.0;
    if (rr > 1.0) discard;
    float ang = atan(p.y, p.x) / 6.2831853;
    float a = ang * 9.0 + (fbm(vec2(rr * 3.0, seed)) - 0.5) * 1.6;
    float d = abs(fract(a) - 0.5);
    float w = 0.1 * (1.0 - rr * 0.55);
    float crack = 1.0 - smoothstep(w * 0.3, w, d);
    float a2 = ang * 19.0 + (fbm(vec2(rr * 6.0, seed + 7.0)) - 0.5) * 3.0;
    float br = (1.0 - smoothstep(0.015, 0.05, abs(fract(a2) - 0.5))) * smoothstep(0.35, 0.55, rr);
    crack = max(crack, br * 0.75);
    // solo hasta donde han llegado
    crack *= 1.0 - smoothstep(grow - 0.08, grow, rr);
    float pulse = 0.65 + 0.35 * sin(time * 10.0 - rr * 8.0);
    float core = smoothstep(0.5, 0.0, rr) * grow * 0.7;
    // resplandor alrededor de cada grieta
    float halo = (1.0 - smoothstep(w, w * 4.0, d)) * 0.35 * (1.0 - smoothstep(grow - 0.08, grow, rr));
    float a3 = (crack * pulse + core + halo) * fade * smoothstep(1.0, 0.85, rr);
    gl_FragColor = vec4(goldRamp(0.5 + crack * 0.5), clamp(a3, 0.0, 1.0));
  }
`;class xE {
  constructor(e) {
    g(this,"mesh");g(this,"mat");g(this,"age",0);g(this,"reach");this.o=e,this.reach=e.r,this.mat=Ch(kE, {
      grow: {
        value:0
      },fade: {
        value:1
      },time: {
        value:0
      },seed: {
        value:Math.random()*50
      }
    }),this.mesh=Qm(this.mat,e.r*2)
  }
  update(e) {
    this.age+=e*1e3;const t=this.mat.uniforms;return t.time.value+=e,t.grow.value=Math.min(1,.15+this.age/this.o.duration*.95),t.fade.value=this.age<this.o.duration?Math.min(1,this.age/150):Math.max(0,1-(this.age-this.o.duration)/400),this.age>=this.o.duration+400
  }
  dispose() {
    this.mesh.geometry.dispose(),this.mat.dispose()
  }
}
class ME {
  constructor(e) {
    g(this,"mesh",new Gn);g(this,"points");g(this,"glints");g(this,"coins",[]);g(this,"age",0);this.o=e;const t=e.count??Math.round(12+e.size*.15);for(let s=0;s<t;s++) {
      const n=e.duration*(.35+Math.random()*.15);this.coins.push( {
        x:(Math.random()-.5)*e.size*.9,z:(Math.random()-.5)*e.size*.9,y0:260+Math.random()*160,t0:Math.random()*(e.duration-n),fall:n,phase:Math.random()*6
      })
    }
    this.points=Gp(t,95,fE(),!1),this.glints=Gp(t,120,ok(),!0),this.mesh.add(this.points,this.glints)
  }
  update(e) {
    this.age+=e*1e3;const t=this.points.geometry.getAttribute("position"),s=this.points.geometry.getAttribute("color"),n=this.glints.geometry.getAttribute("position"),o=this.glints.geometry.getAttribute("color");this.coins.forEach((i,r)=> {
      const l=(this.age-i.t0)/i.fall;if(l<0||l>1.15) {
        s.setXYZ(r,0,0,0),o.setXYZ(r,0,0,0),t.setXYZ(r,0,-9999,0);return
      }
      const d=Math.max(3,i.y0*(1-Math.min(1,l)**2));t.setXYZ(r,i.x,d,i.z),n.setXYZ(r,i.x,d+2,i.z);const h=Math.abs(Math.sin(this.age*.018+i.phase)),u=.55+.6*h;s.setXYZ(r,u,u,u);const p=h>.9||l>1?l>1?1.2-l:.8:0;o.setXYZ(r,p,p*.9,p*.6)
    });for(const i of[t,s,n,o])i.needsUpdate=!0;return this.age>=this.o.duration+150
  }
  dispose() {
    Vp(this.points),Vp(this.glints)
  }
}
const $E=`
  ${ni}
  ${tc}
  uniform float reveal;
  uniform float fade;
  uniform float time;
  uniform float seed;
  varying vec2 vUv;
  void main() {
    float u = vUv.x;
    float v = (vUv.y - 0.5) * 2.0;
    float shown = 1.0 - smoothstep(reveal - 0.05, reveal, u);
    float core = exp(-abs(v) * 6.0);
    float glow = exp(-abs(v) * 2.2) * 0.4;
    float sp = step(0.86, fNoise(vec2(u * 60.0 + seed, v * 6.0 + time * 3.0))) * exp(-abs(v) * 2.0);
    float tail = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.92, u);
    float a = (core + glow + sp) * shown * tail * fade;
    gl_FragColor = vec4(goldRamp(0.5 + core * 0.5), clamp(a, 0.0, 1.0));
  }
`;class SE {
  constructor(e) {
    g(this,"mesh");g(this,"mat");g(this,"age",0);g(this,"reach");this.o=e,this.reach=e.len/2,this.mat=Ch($E, {
      reveal: {
        value:0
      },fade: {
        value:1
      },time: {
        value:0
      },seed: {
        value:Math.random()*50
      }
    });const t=new jm(e.len,e.w*1.6);t.translate(e.len/2,0,0),t.rotateX(-Math.PI/2),this.mesh=new vs(t,this.mat),this.mesh.rotation.y=-e.angle,this.mesh.renderOrder=2,this.mesh.frustumCulled=!1
  }
  update(e) {
    this.age+=e*1e3;const t=this.mat.uniforms;return t.time.value+=e,t.reveal.value=Math.min(1.05,this.age/this.o.reveal),t.fade.value=this.age<this.o.reveal?1:Math.max(0,1-(this.age-this.o.reveal)/this.o.fade),this.age>=this.o.reveal+this.o.fade
  }
  dispose() {
    this.mesh.geometry.dispose(),this.mat.dispose()
  }
}
function EE(a) {
  let e=a>>>0;return()=> {
    e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296
  }
}
const Zs=10;function ik(a,e,t) {
  const s=e-a.x,n=t-a.y;if(a.kind==="circle")return s*s+n*n<(a.r+Zs)*(a.r+Zs);if(a.kind==="ring") {
    const r=we(s,n);return r<a.r+Zs&&r>a.r0-Zs
  }
  if(a.kind==="cone") {
    const r=we(s,n);if(r>a.r+Zs)return!1;if(r<Zs*2)return!0;let l=Ls(n,s)-a.ang;return l=Ls(Le(l),Ie(l)),Math.abs(l)<a.half+Zs/r
  }
  const o=s*Ie(a.ang)+n*Le(a.ang),i=-s*Le(a.ang)+n*Ie(a.ang);return o>-Zs&&o<a.len+Zs&&Math.abs(i)<a.w/2+Zs
}
function rk(a,e) {
  const t=a.zoneDecal(e.kind==="line"?"rect":e.kind,e.kind==="cone"?e.half:e.kind==="ring"?e.r0/e.r:0);return e.kind==="line"?(t.x=e.x+Ie(e.ang)*e.len*.5,t.y=e.y+Le(e.ang)*e.len*.5,t.w=e.len,t.h=e.w,t.rotation=e.ang):(t.x=e.x,t.y=e.y,t.w=t.h=2*e.r,e.kind==="cone"&&(t.rotation=e.ang)),t
}
const TE=260;function $t(a,e,t,s,n,o) {
  const i=rk(a,t);i.alpha=0;let r=0,l=-1,d=!1;a.addFx( {
    view:new Je,update(h) {
      if(l<0&&(e.dead||e.removed)&&(l=0),l>=0) {
        l+=h;const p=Math.min(1,l/TE);return i.flash=d?1-p:0,i.alpha=1-p*p,p<1?!1:(i.dispose(),!0)
      }
      r+=h;const u=Math.min(1,r/s);return i.alpha=Math.min(1,r/140),i.progress=u,u<1||(l=0,d=!0,t.kind==="circle"&&Mn(a,t,t.r,16760992,300),o==null||o(),!a.player.dead&&ik(t,a.player.x,a.player.y)&&n()),!1
    }
  })
}
const CE= {
  str_dust:280,str_firehit1:128,str_firehit2:128,str_firehit3:128,str_holyhit:96,str_lightning:88
};function ln(a,e) {
  e&&a.addFx(e)
}
function Ac(a,e,t,s,n,o=1,i=!1) {
  const r=yt(e,t,s,Math.max(.25,Math.min(2.5,n*o/(CE[e]??128))));r&&i&&(r.upright=!1),ln(a,r)
}
function Vs(a,e,t,s,n,o=!1) {
  const i=(r,l,d)=> {
    o||B.play(r,l,d)
  };switch(e) {
    case"dust":Ac(a,"str_dust",t,s,n,1.15,!0),o||a.shake(.2,Math.min(7,2+n/40)),i("hammerfall",.4,3);break;case"fire":Ac(a,`str_firehit${1+Math.floor(ps()*3)}`,t,s,n,.9),i("ef_firehit",.35,4);break;case"blaze":a.fireWave(t,s, {
      shape:"ring",outer:n,duration:480,height:Math.min(130,50+n*.35),linger:900
    }),o||a.shake(.25,Math.min(6,2+n/50)),i("ef_firehit",.45,4);break;case"gold":a.fx3d(t,s,new Zm( {
      r:n,shards:o?Math.round(8+n*.15):void 0
    })),o||a.shake(.2,Math.min(6,2+n/50)),i("ef_coin",.4,4);break;case"holy":Ac(a,"str_holyhit",t,s,n,.9),i("magnus",.3,3);break;case"dark": {
      const r=se.sheet("fx_smoke").action("a0").dirs[0][0],l=Math.max(.3,Math.min(3,n*.9/Math.max(8,((r==null?void 0:r.width)??80)/2)));ln(a,Ye("fx_smoke",t,s, {
        tint:10116304,add:!1,scale:l
      })),i("ef_soulstrike",.35,3);break
    }
    case"sound":ln(a,LM(t,s,n,16773576,420)),i("mc_loud",.4,2);break;case"thunder":Ac(a,"str_lightning",t,s,n,.8),i("ef_thunderstorm",.3,4);break;case"slash":break;case"water":a.wave(t,s, {
      shape:"ring",outer:n,duration:700
    }),sc(a,t,s,n*.5,Math.max(1,Math.round(n/45))),i("water_spray",.4,3);break
  }
}
function sc(a,e,t,s,n,o=0,i=Math.PI*2) {
  for(let r=0;r<n;r++) {
    const l=o-i/2+i*(r+.5)/n,d=n===1?0:s;ln(a,yt("str_waterhit",e+Ie(l)*d,t+Le(l)*d,.6+ps()*.25))
  }
}
function lk(a,e,t,s,n,o,i) {
  a.firePatch(t,s, {
    r:n,duration:o*1e3
  });for(let r=1;r<=Math.floor(o/.5);r++)a.schedule(.15+r*.5,()=> {
    !e.dead&&!a.player.dead&&we(a.player.x-t,a.player.y-s)<n+Zs&&ft(a,e,i)
  })
}
function LE(a,e,t) {
  const s=new Dw( {
    text:`${e.def.name}: ${c(t)}!!`,style: {
      fontFamily:"Nunito, Segoe UI, sans-serif",fontSize:13,fontWeight:"800",fill:16777215,stroke: {
        color:4860450,width:3
      }
    },resolution:2
  });s.anchor.set(.5,1);const n=new Je;n.addChild(s);let o=0;a.addFx( {
    view:n,upright:!0,lift:(e.sprite.height||100)+28,anchor: {
      get x() {
        return e.x
      },get y() {
        return e.y
      }
    },update(r) {
      return o+=r,n.alpha=o<1400?1:Math.max(0,1-(o-1400)/300),o>=1700||e.dead
    }
  });const i=Object.values(e.sprite.sheet.action("attack").sounds)[0];i&&B.play(i,.45,2)
}
function ft(a,e,t) {
  a.hurtPlayer(e.damage*t,e)
}
function pn(a,e,t) {
  a.face(e-a.x||.01,t-a.y)
}
function $s(a,e,t,s="dust") {
  return(n,o,i)=> {
    const {
      x:r,y:l
    }
    =i.aim(),d=o.x,h=o.y,u=Math.min(420,e*.45);pn(o,r,l),$t(n,o, {
      kind:"circle",x:r,y:l,r:a
    },e,()=>ft(n,o,t),()=>Vs(n,s,r,l,a));let p=0;return n.addFx( {
      view:new Je,update(y) {
        if(o.dead)return o.sprite.y=0,!0;p+=y;const w=(p-(e-u))/u;if(w<=0)return!1;const m=Math.min(1,w);return o.x=d+(r-d)*m,o.y=h+(l-h)*m,o.sprite.y=-Le(m*Math.PI)*110,m<1?!1:(o.sprite.y=0,o.setState("attack"),!0)
      }
    }),e/1e3+.3
  }
}
function js(a,e,t,s,n="dust",o={}) {
  const {
    trailFire:i
  }
  =o;return(r,l,d)=> {
    const h=d.aim(),u=Ls(h.y-l.y,h.x-l.x),p=l.x,y=l.y;pn(l,h.x,h.y);const w=280;return $t(r,l, {
      kind:"line",x:p,y,ang:u,len:a,w:e
    },t,()=>ft(r,l,s),()=> {
      let m=0,f=0;const v=Math.max(2,Math.round(a/e));l.setState("attack"),o.streak&&r.fx3d(p,y,new SE( {
        len:a,w:e,angle:u,reveal:w,fade:900
      })),r.addFx( {
        view:new Je,update(x) {
          if(l.dead)return!0;m+=x;const k=Math.min(1,m/w),M=p+Ie(u)*a*k,$=y+Le(u)*a*k;for([l.x,l.y]=r.walk?r.walk.resolve(l.x,l.y,M,$):[M,$];f<v&&k>=(f+.5)/v;)f++,Vs(r,n,l.x,l.y,e*.5,f>1),i&&lk(r,l,l.x,l.y,e*.55,i.secs,i.mult);return!(k<1)
        }
      })
    }),(t+w)/1e3+.2
  }
}
function Bt(a,e,t,s="dust") {
  return(n,o)=> {
    const i=o.x,r=o.y;return $t(n,o, {
      kind:"circle",x:i,y:r,r:a
    },e,()=>ft(n,o,t),()=> {
      o.setState("attack"),Vs(n,s,i,r,a)
    }),e/1e3+.2
  }
}
function Pc(a,e,t,s="dark") {
  return(o,i,r)=> {
    o.addFx(Ye("fx_smoke",i.x,i.y, {
      add:!1,scale:.9*(i.def.scale??1)
    }));let l=0,d=!1;return o.addFx( {
      view:new Je,update(h) {
        if(i.dead)return i.sprite.alpha=1,!0;if(l+=h,!d) {
          if(i.sprite.alpha=Math.max(0,1-l/320),l<320)return!1;const u=r.aim();let[p,y]=[u.x,u.y];for(let w=0;w<12;w++) {
            const m=r.rnd()*Math.PI*2,f=55+r.rnd()*30,v=u.x+Ie(m)*f,x=u.y+Le(m)*f;if(!o.walk||o.walk.walkable(v,x)&&o.walk.reachable(v,x)) {
              [p,y]=[v,x];break
            }
          }
          return i.x=p,i.y=y,pn(i,u.x,u.y),d=!0,l=0,o.addFx(Ye("fx_smoke",p,y, {
            add:!1,scale:.9*(i.def.scale??1)
          })),$t(o,i, {
            kind:"circle",x:p,y,r:a
          },e,()=>ft(o,i,t),()=> {
            i.setState("attack"),Vs(o,s,p,y,a)
          }),!1
        }
        return i.sprite.alpha=Math.min(1,l/150),l>=150
      }
    }),(320+e)/1e3+.2
  }
}
function bu(a,e,t,s) {
  return(n,o)=> {
    const i=o.x,r=o.y;return a.forEach((l,d)=> {
      const h=d===0?0:a[d-1];n.schedule(e*d,()=> {
        o.dead||$t(n,o, {
          kind:"ring",x:i,y:r,r0:h,r:l
        },t,()=>ft(n,o,s),()=> {
          o.setState("attack"),n.wave(i,r, {
            shape:"ring",inner:h,outer:l,duration:800
          }),sc(n,i,r,(h+l)/2,Math.max(4,Math.round(l/40))),B.play("waves",.45,2),n.shake(.25,4)
        })
      })
    }),(e*(a.length-1)*1e3+t)/1e3+.3
  }
}
function by(a,e,t,s,n) {
  return(o,i,r)=> {
    const l=i.x,d=i.y,h=Math.PI*2/a,u=h/4,p=r.aim(),y=Ls(p.y-d,p.x-l);pn(i,p.x,p.y);const w=m=> {
      if(m>=t||i.dead)return;const f=y+m%2*(h/2);for(let v=0;v<a;v++) {
        const x=f+v*h;$t(o,i, {
          kind:"cone",x:l,y:d,ang:x,r:e,half:u
        },s,()=>ft(o,i,n),()=> {
          o.wave(l,d, {
            shape:"cone",outer:e,half:u,angle:x,duration:700
          }),sc(o,l,d,e*.65,2,x,u*1.2),v===0&&(i.setState("attack"),B.play("waves",.45,2),o.shake(.2,3),w(m+1))
        })
      }
    };return w(0),s*t/1e3+.3
  }
}
function St(a,e) {
  const t=(s,n)=> {
    var o;return n.setState("attack"),(o=s.coop)!=null&&o.replica||s.summon(a,n.x,n.y,e),.8
  };return Dd.add(t),ef.set(t,a),t
}
const Dd=new WeakSet,ef=new Map;function AE(a,e) {
  return ef.set(a,e),a
}
function jt(a,e,t,s,n="slash") {
  return(o,i,r)=> {
    const l=i.x,d=i.y,h=r.aim(),u=Ls(h.y-d,h.x-l);return pn(i,h.x,h.y),$t(o,i, {
      kind:"cone",x:l,y:d,ang:u,r:a,half:e
    },t,()=>ft(o,i,s),()=> {
      if(i.setState("attack"),n==="slash"&&o.addFx(eu(l,d,u,a,e,16770768,320)),n==="gold"&&o.addFx(eu(l,d,u,a,e,16766314,360)),n==="blaze") {
        o.fireWave(l,d, {
          shape:"cone",outer:a,half:e,angle:u,duration:420,height:85,linger:800
        }),B.play("ef_firehit",.45,4),o.shake(.2,3);return
      }
      if(n==="water") {
        o.wave(l,d, {
          shape:"cone",outer:a,half:e,angle:u,duration:600,height:55
        }),sc(o,l+Ie(u)*a*.75,d+Le(u)*a*.75,a*Le(e)*.6,2),B.play("water_spray",.4,3);return
      }
      if(n==="sound") {
        o.addFx(eu(l,d,u,a,e,16773576,420)),B.play("mc_loud",.4,2);return
      }
      const p=a*.6;Vs(o,n,l+Ie(u)*p,d+Le(u)*p,Math.max(a*.2,Math.min(a*.4,p*Le(e))))
    }),t/1e3+.2
  }
}
function PE(a,e,t,s,n=26,o=750) {
  return(i,r,l)=> {
    const d=l.aim(),h=r.x,u=r.y,p=Ls(d.y-u,d.x-h);return pn(r,d.x,d.y),$t(i,r, {
      kind:"cone",x:h,y:u,ang:p,r:a,half:e
    },t,()=>ft(i,r,s),()=> {
      r.setState("attack"),B.play("water_spray",.4,3);for(let y=0;y<n;y++)i.schedule(y/n*o/1e3,()=> {
        if(r.dead)return;const w=p+(l.rnd()*2-1)*e*.85,m=a*(.45+l.rnd()*.55),f=9+l.rnd()*16;ck(i,h+Ie(w)*24,u+Le(w)*24,h+Ie(w)*m,u+Le(w)*m,f,240+l.rnd()*300)
      })
    }),(t+o)/1e3+.2
  }
}
function ck(a,e,t,s,n,o,i) {
  const r=o>18?()=>ln(a,yt("str_waterhit",s,n,o/45)):void 0;a.fx3d(e,t,new pE( {
    r:o,dx:s-e,dz:n-t,fly:i,height:o+14,onPop:r
  }))
}
function _s(a,e,t,s,n,o,i) {
  return(r,l,d)=> {
    for(let h=0;h<a;h++)r.schedule(h*s,()=> {
      if(l.dead)return;const u=d.rnd()*Math.PI*2,p=h===0?0:d.rnd()*n,y=d.aim(),w=y.x+Ie(u)*p,m=y.y+Le(u)*p;$t(r,l, {
        kind:"circle",x:w,y:m,r:e
      },t,()=>ft(r,l,o),()=>Vs(r,i,w,m,e))
    });return l.setState("attack"),.9
  }
}
function wu(a,e,t,s,n,o,i,r=800) {
  return(d,h,u)=> {
    for(let p=0;p<a;p++)d.schedule(p*s,()=> {
      if(h.dead)return;const y=u.rnd()*Math.PI*2,w=p===0?0:u.rnd()*n,m=u.aim(),f=m.x+Ie(y)*w,v=m.y+Le(y)*w,x=u.rnd()<.5?-1:1,[k,M,$]=[x*(90+u.rnd()*60),-30-u.rnd()*40,280+u.rnd()*80];d.schedule(Math.max(0,t-520)/1e3,()=> {
        h.dead||d.fireball(f,v, {
          duration:520,dx:k,dz:M,height:$,size:r
        })
      }),$t(d,h, {
        kind:"circle",x:f,y:v,r:e
      },t,()=>ft(d,h,o),()=> {
        Vs(d,"blaze",f,v,e,p>0),lk(d,h,f,v,e*.8,i,o*.2)
      })
    });return h.setState("attack"),.9
  }
}
function wy(a,e,t) {
  Vs(a,"dust",e.x,e.y,70,!0);let s=0;a.addFx( {
    view:new Je,update(n) {
      s+=n;const o=Math.min(1,s/t);return e.dead?(e.view.alpha=1,e.sprite.y=0,!0):(e.sprite.y=34*o,e.view.alpha=1-o,o>=1)
    }
  })
}
function ku(a,e,t,s,n=!0) {
  return(r,l,d)=> {
    const h=450+a*(t+250);l.hiddenUntil=r.time+h/1e3,wy(r,l,450),B.play("hammerfall",.35,2);for(let u=0;u<a;u++)r.schedule((450+u*(t+250))/1e3,()=> {
      if(l.dead)return;const {
        x:p,y
      }
      =d.aim();n&&r.fx3d(p,y,new xE( {
        r:e,duration:t
      })),$t(r,l, {
        kind:"circle",x:p,y,r:e
      },t,()=>ft(r,l,s),()=> {
        l.x=p,l.y=y,l.view.alpha=1,l.sprite.y=0,l.setState("attack"),n&&Vs(r,"gold",p,y,e),Vs(r,"dust",p,y,e*.8,n),u<a-1?wy(r,l,250):l.hiddenUntil=0
      })
    });return h/1e3+.3
  }
}
function ky(a,e,t,s,n,o,i,r,l=!1) {
  return(d,h,u)=> {
    for(let p=0;p<a;p++)d.schedule(p*s,()=> {
      if(h.dead)return;const y=u.rnd()*Math.PI*2,w=p===0?0:u.rnd()*n,m=u.aim(),f=m.x+Ie(y)*w,v=m.y+Le(y)*w;$t(d,h, {
        kind:"circle",x:f,y:v,r:e
      },t,()=>ft(d,h,o),()=> {
        Vs(d,"water",f,v,e,p>0),l?ln(d,Ye("fx_smoke",f,v, {
          tint:2758720,add:!1,scale:Math.max(.6,e/50)
        })):ln(d,Ye("fx_poison",f,v, {
          scale:Math.max(.6,e/50)
        })),jE(d,h,f,v,e,i,r,l?[.32,.18,.55]:void 0)
      })
    });return h.setState("attack"),.9
  }
}
function jE(a,e,t,s,n,o,i,r=[.35,.9,.2]) {
  const l= {
    kind:"circle",x:t,y:s,r:n
  },d=rk(a,l);d.setTint(...r),d.progress=1;let h=0;a.addFx( {
    view:new Je,update(u) {
      h+=u;const p=h/(o*1e3);return d.alpha=e.dead?0:Math.min(.55,h/200)*(p<.85?1:(1-p)/.15),p<1&&!e.dead?!1:(d.dispose(),!0)
    }
  });for(let u=1;u<=Math.floor(o/.5);u++)a.schedule(u*.5,()=> {
    !e.dead&&!a.player.dead&&ik(l,a.player.x,a.player.y)&&ft(a,e,i)
  })
}
function Hd(a,e,t,s) {
  ln(a,Ye("fx_hydra_atk",e,t+2, {
    add:!1,scale:Math.max(.8,s/40),speed:2.2
  })),ln(a,yt("str_waterhit",e,t,Math.max(.5,s/70)))
}
function _E(a,e,t,s,n,o,i,r) {
  return(l,d,h)=> {
    const u=d.x,p=d.y,y=h.aim(),w=Ls(y.y-p,y.x-u);pn(d,y.x,y.y),d.setState("attack");let m=!1;const f=()=> {
      m||(m=!0,ft(l,d,r))
    };for(let v=0;v<a;v++) {
      const x=w+(v-(a-1)/2)*e;for(let k=0;k<t;k++) {
        const M=s*(k+1),$=u+Ie(x)*M,P=p+Le(x)*M;l.schedule(k*o,()=> {
          d.dead||l.walk&&!l.walk.walkable($,P)||$t(l,d, {
            kind:"circle",x:$,y:P,r:n
          },i,f,()=> {
            Hd(l,$,P,n),v===0&&B.play("water_spray",.3,3)
          })
        })
      }
    }
    return((t-1)*o*1e3+i)/1e3+.3
  }
}
function qE(a,e,t,s,n) {
  return(o,i,r)=> {
    const l=r.aim(),d=r.rnd()*Math.PI;pn(i,l.x,l.y);for(let h=0;h<2;h++) {
      const u=d+h*Math.PI/2;o.schedule(h*s,()=> {
        if(i.dead)return;const p=l.x-Ie(u)*a/2,y=l.y-Le(u)*a/2;$t(o,i, {
          kind:"line",x:p,y,ang:u,len:a,w:e
        },t,()=>ft(o,i,n),()=> {
          i.setState("attack");for(let w=0;w<=4;w++) {
            const m=a*w/4;Hd(o,p+Ie(u)*m,y+Le(u)*m,e*.6)
          }
          B.play("waves",.4,2),o.shake(.25,4)
        })
      })
    }
    return(s*1e3+t)/1e3+.3
  }
}
function IE(a,e,t,s,n) {
  return(o,i)=> {
    const r=i.x,l=i.y,d=a*1e3;i.setState("attack"),$t(o,i, {
      kind:"circle",x:r,y:l,r:s
    },d,()=>ft(o,i,n),()=> {
      o.wave(r,l, {
        shape:"ring",inner:0,outer:s,duration:800,height:60
      }),sc(o,r,l,s*.6,8),B.play("waves",.5,2),o.shake(.35,5)
    });let h=0,u=0;return o.addFx( {
      view:new Je,update(p) {
        if(h+=p,i.dead||h>=d)return!0;if(u-=p,u<=0) {
          u=140;const M=ps()*Math.PI*2,$=e*(.55+ps()*.4);ck(o,r+Ie(M)*$,l+Le(M)*$,r,l,6+ps()*8,900)
        }
        const y=o.player,w=r-y.x,m=l-y.y,f=we(w,m);if(y.dead||f>e||f<20)return!1;const v=t*(1.3-.6*f/e)*p/1e3,x=y.x+w/f*v,k=y.y+m/f*v;return[y.x,y.y]=o.walk?o.walk.resolve(y.x,y.y,x,k):[x,k],!1
      }
    }),a+.3
  }
}
function RE(a,e,t,s,n) {
  return(o,i,r)=> {
    const {
      x:l,y:d
    }
    =r.aim();return pn(i,l,d),$t(o,i, {
      kind:"ring",x:l,y:d,r0:a,r:e
    },t,()=>ft(o,i,n),()=> {
      i.setState("attack");const h=10;for(let u=0;u<h;u++) {
        const p=u/h*Math.PI*2;Hd(o,l+Ie(p)*(a+e)*.5,d+Le(p)*(a+e)*.5,(e-a)*.6)
      }
      B.play("water_spray",.45,3),!i.dead&&$t(o,i, {
        kind:"circle",x:l,y:d,r:a
      },s,()=>ft(o,i,n*1.25),()=> {
        Hd(o,l,d,a),o.wave(l,d, {
          shape:"ring",inner:0,outer:a,duration:600,height:45
        }),o.shake(.3,5)
      })
    }),(t+s)/1e3+.3
  }
}
function BE(a,e,t,s=.75) {
  return(n,o)=> {
    const i=a*1e3,r=o.x,l=o.y,d=new bE( {
      r:o.def.radius*1.9,duration:i,follow:()=>o.dead||o.guardUntil<=n.time?null:o
    });return n.fx3d(r,l,d),o.guard=s,o.guardUntil=n.time+a,o.onGuardHit=()=>d.hit(),B.play("ef_coin2",.5,2),$t(n,o, {
      kind:"circle",x:r,y:l,r:e
    },i,()=>ft(n,o,t),()=> {
      o.guardUntil=0,o.onGuardHit=null,o.setState("attack"),Vs(n,"gold",r,l,e),n.fx3d(r,l,new Zm( {
        r:e*.6,shards:70,duration:1300
      })),n.shake(.35,7)
    }),a+.3
  }
}
function NE(a,e,t,s,n,o=3) {
  return(r,l,d)=> {
    const {
      x:h,y:u
    }
    =d.aim(),p=y=> {
      if(l.dead)return;let w=!0;for(let m=0;m<a;m++)for(let f=0;f<a;f++) {
        if((m+f)%2!==y%2)continue;const v=h+(m-(a-1)/2)*e,x=u+(f-(a-1)/2)*e,k=w;w=!1,r.schedule(Math.max(0,t-520)/1e3,()=> {
          l.dead||r.fx3d(v,x,new ME( {
            size:e,duration:520
          }))
        }),$t(r,l, {
          kind:"line",x:v-e/2,y:x,ang:0,len:e,w:e
        },t,()=>ft(r,l,n),()=> {
          r.fx3d(v,x,new Zm( {
            r:e*.5,shards:6,duration:700
          })),k&&(B.play("ef_coin",.5,3),r.shake(.15,3))
        })
      }
    };for(let y=0;y<o;y++)r.schedule(y*s,()=>p(y));return l.setState("attack"),1.2
  }
}
function Ss(a,e,t) {
  return(s,n,o)=> {
    let i=t(s,n,o);for(let r=1;r<a;r++)s.schedule(e*r,()=> {
      n.dead||t(s,n,o)
    });return i=e*(a-1)+i,i
  }
}
const jc=150,OE=999;function Kp(a,e) {
  return(t,s,n)=> {
    var v;const o=n.aim();let i=o.x,r=o.y;for(let x=0;x<60;x++) {
      const k=n.rnd()*Math.PI*2,M=380+n.rnd()*240,$=o.x+Ie(k)*M,P=o.y+Le(k)*M,q=Array.from( {
        length:8
      },(R,L)=>L/8*Math.PI*2).every(R=>!t.walk||t.walk.walkable($+Ie(R)*jc*.7,P+Le(R)*jc*.7));if(!t.walk||t.walk.walkable($,P)&&t.walk.reachable($,P)&&q) {
        i=$,r=P;break
      }
    }
    const l=new cE( {
      safeR:jc
    });l.sealed=!!e,t.fx3d(i,r,l),B.play("bell_ding",.5,2);const d=a+1.6;s.hiddenUntil=t.time+d,t.addFx(Ye("fx_smoke",s.x,s.y, {
      add:!1,scale:.9*(s.def.scale??1)
    })),t.events.onAnnounce(c(e?"¡La campana está sellada! Mata a {name} en {n} s":"¡Ponte bajo la campana!", {
      name:e?c(DE(e.id)):"",n:(e==null?void 0:e.secs)??0
    }));let h=null;e&&!((v=t.coop)!=null&&v.replica)&&t.schedule(.6,()=> {
      const x=n.rnd()*Math.PI*2;let[k,M]=[i+Ie(x)*220,r+Le(x)*220];t.walk&&([k,M]=t.walk.nearestWalkable(k,M)),h=t.spawnBoss(e.id,k,M),h&&(h.maxHp=h.hp=Math.round(h.maxHp*(e.hp/h.def.hp)))
    });const u=new Dw( {
      text:"",style: {
        fontFamily:"Nunito, Segoe UI, sans-serif",fontSize:30,fontWeight:"900",fill:16773590,stroke: {
          color:5904916,width:5
        }
      },resolution:2
    });u.anchor.set(.5,1);const p=new Je;p.addChild(u);let y=0,w=Math.ceil(a),m=!1,f=!1;return t.addFx( {
      view:p,upright:!0,lift:560,anchor: {
        x:i,y:r
      },update(x) {
        var M;if(y+=x/1e3,s.dead)return l.finish(),!0;s.sprite.alpha=m?Math.min(1,s.sprite.alpha+x/300):Math.max(0,1-y/.3);const k=a-y;if(!m) {
          l.charge=Math.min(1,y/a);const $=Math.max(0,Math.ceil(k));u.text=String($),u.style.fill=l.sealed?16747130:16773590,$<w&&(w=$,$<=3&&B.play("bell_ding",.35,3)),e&&!h&&((M=t.coop)!=null&&M.replica)&&(h=t.enemies.find(P=>P.def.id===e.id&&!P.dead)??null),e&&l.sealed&&h&&h.dead&&y<=e.secs+.6&&(l.sealed=!1,t.events.onAnnounce(c("¡La campana se ha abierto! Ponte debajo")),B.play("bell_ding",.6,2)),e&&l.sealed&&!f&&y>e.secs+.6&&(f=!0,t.events.onAnnounce(c("¡Demasiado tarde! La campana sigue sellada")))
        }
        if(!m&&k<=0) {
          m=!0,u.text="",l.toll(),B.play("bell_toll",.9,2),t.shake(.7,10);const $=we(t.player.x-i,t.player.y-r)<jc-4;!t.player.dead&&(l.sealed||!$)&&t.hurtPlayer(OE,s,!0),s.x=i,s.y=r+30,s.hiddenUntil=0,t.addFx(Ye("fx_smoke",s.x,s.y, {
            add:!1,scale:.9*(s.def.scale??1)
          })),t.schedule(.9,()=>l.finish())
        }
        return m?(p.alpha=0,y>a+1.6):!1
      }
    }),d
  }
}
function DE(a) {
  var e;return((e=Be[a])==null?void 0:e.name)??a
}
const K=(a,e,t,s)=>( {
  name:a,cd:e,range:t,run:s
}),jl= {
  eclipse:[K("Salto lunar",7,460,$s(95,1300,2.2)),K("Embestida",8,420,js(420,80,1100,2)),K("Luna llena",11,650,_s(5,62,1050,.35,140,1.6,"holy"))],vocal:[K("Canto ensordecedor",9,210,Bt(175,1500,2.2,"sound")),K("Saltos de grillo",10,460,Ss(3,1.05,$s(78,900,1.6))),K("Chirrido",7,330,jt(320,.42,1100,2,"sound"))],toad:[K("Chorro de burbujas",8,420,Ss(2,1.35,PE(420,.32,900,1.6))),K("Salto del sapo",10,480,Ss(2,1.15,$s(90,950,1.9,"water"))),K("Croar",11,210,Bt(185,1400,2.2,"sound")),K("¡Ranas!",18,700,St("roda_frog",4))],dragon_fly:[K("Picado",9,480,Ss(3,.85,js(400,70,750,1.6))),K("Zumbido",10,200,Bt(175,1300,2.1,"sound")),K("Aguijonazo",7,280,jt(260,.45,850,1.9)),K("Enjambre",16,700,St("chonchon",6))],mastering:[K("Rebote gelatinoso",8,480,Ss(3,1.1,$s(92,1e3,1.9))),K("Lluvia de Porings",10,650,_s(8,60,1100,.2,180,1.6,"dust")),K("Aplastamiento",7,200,Bt(160,1400,2.4)),K("Gran salto",11,650,$s(140,1500,2.8)),K("Ondas de gelatina",14,600,bu([160,320,480],1.3,2400,2.2)),K("¡Me parto en Porings!",20,700,St("poring",8))],tarou_bite:[K("Mordisco",5,220,jt(200,.5,700,1.5,"slash")),K("Carrera rabiosa",9,480,Ss(3,.9,js(420,80,800,1.7)))],tarou_plague:[K("Mordisco",5,220,jt(200,.5,700,1.5,"slash")),K("Peste de cloaca",9,650,ky(4,75,1e3,.35,160,1.4,6,.3))],tarou_burrow:[K("Mordisco",5,220,jt(200,.5,700,1.5,"slash")),K("Madriguera",11,650,ku(2,85,950,1.8,!1)),K("¡Ratas!",16,700,St("tarou",3))],golden_thief_bug:[K("Excavación dorada",14,650,ku(3,95,1100,2.2)),K("Caparazón de oro",18,700,BE(4.5,230,2.6)),K("Codicia",13,650,NE(5,95,1e3,1.05,1.6)),K("Embestida dorada",10,520,Ss(3,1.25,js(480,100,900,2,"gold", {
    streak:!0
  }))),K("Mandíbulas de oro",6,250,jt(235,.65,900,2.4,"gold")),K("Enjambre",22,700,St("thief_bug",4))],angeling:[K("Luz sagrada",8,650,_s(4,72,1e3,.6,0,1.8,"holy")),K("Salto angelical",8,460,$s(95,1200,2.2,"holy")),K("Juicio del cielo",11,210,Bt(170,1500,2.4,"holy"))],deviling:[K("Bola oscura",8,650,_s(6,64,1050,.25,160,1.7,"dark")),K("Salto diabólico",8,460,$s(95,1150,2.2,"dark")),K("Carga infernal",9,460,js(460,90,1e3,2.2,"dark"))],ghostring:[K("Lamento",9,220,Bt(185,1500,2.3,"dark")),K("Toque fantasma",9,650,_s(5,66,1e3,.3,150,1.7,"dark")),K("Desvanecerse",8,650,Pc(150,1100,2.2,"dark"))],penomena:[K("Tentáculos",7,650,_s(5,70,1e3,.3,160,1.7,"water")),K("Raíces del fondo",11,650,ku(3,95,1e3,2)),K("Marea venenosa",10,600,bu([180,360,540],1.4,2600,2)),K("Brotes de Hydra",18,700,St("hydra",4))],drake:[K("Sablazo",6,500,jt(480,.5,750,2.4)),K("Remolino",16,680,bu([170,340,510,680],1.6,3300,2.6)),K("Oleaje",13,720,by(4,700,3,1500,2.2)),K("¡A mí la tripulación!",18,700,St("pirate_skel",4))],deviace:[K("Mordisco voraz",5,230,jt(210,.5,750,1.6,"water")),K("Embestida abisal",9,480,Ss(3,.9,js(420,80,800,1.7,"water"))),K("Remolino",11,220,Bt(190,1400,2.2,"water"))],strouf:[K("Coletazo",6,260,jt(240,.65,900,2,"water")),K("Thunderstorm",9,650,_s(3,105,1100,.35,230,2,"thunder")),K("Marejada",13,650,by(3,620,3,1500,2)),K("¡Banco de peces!",18,700,St("phen",4))],king_dramoh:[K("Pinzazo",6,260,jt(250,.6,950,2.2,"water")),K("Carga del rey",9,520,js(500,100,1e3,2.2,"water")),K("Burbujas",10,650,_s(6,64,1050,.3,160,1.7,"water")),K("Pinzas de hierro",12,240,Bt(215,1500,2.4,"water")),K("¡Mis súbditos!",18,700,St("vadon",4))],kraken:[K("Hileras de tentáculos",8,700,_E(3,.4,6,95,52,.18,900,1.8)),K("Latigazo cruzado",7,650,qE(760,90,1100,.7,2.2)),K("Nube de tinta",12,650,ky(4,80,1e3,.35,170,1.4,6,.3,!0)),K("Abrazo del Kraken",13,650,RE(95,230,1300,900,2)),K("Vórtice del abismo",17,600,IE(3.2,650,110,230,3)),K("¡Tentáculos del Kraken!",22,700,St("kraken_leg",3))],vagabond_wolf:[K("Dentelladas",6,230,Ss(3,.5,jt(210,.5,650,1.3))),K("Salto del lobo",9,480,Ss(2,1.1,$s(90,1e3,2.2))),K("Carrera salvaje",9,520,js(520,90,900,2.2)),K("Golpe de tierra",11,230,Bt(210,1400,2.4)),K("Aullido de la manada",18,700,St("wolf",4))],skeleton_general:[K("Tajo del general",6,250,jt(240,.6,900,2.2)),K("¡A la carga!",9,500,js(500,90,1e3,2.2)),K("¡Arqueros, disparad!",11,650,_s(7,60,1100,.2,170,1.5,"dust")),K("¡A formar!",18,700,St("skel_soldier",3)),K("¡Arqueros, a mí!",22,700,St("skel_archer",2))],cat_o_nine_tail:[K("Zarpazos",6,240,Ss(2,.55,jt(220,.55,700,1.5,"blaze"))),K("Fuego de zorro",10,650,wu(6,60,1050,.25,170,1.5,2,520)),K("Paso de zorro",9,650,Pc(150,1e3,2.2,"blaze")),K("Nueve colas",12,240,Bt(220,1400,2.4,"blaze")),K("¡Hermanas!",20,700,St("nine_tail",3))],hyegun:[K("Saltos del vampiro",9,520,Ss(4,.9,$s(80,850,1.7,"dark"))),K("Talismanes",10,650,_s(5,66,1e3,.35,150,1.6,"dark")),K("Abrazo de la muerte",10,220,Bt(190,1300,2.4,"dark")),K("Gran salto",8,480,$s(110,1200,2.4,"dark")),K("¡Despertad!",18,700,St("bon_gun",4))],moonlight:[K("Fuego fatuo",10,650,wu(7,66,1100,.24,190,1.7,2.5,600)),K("Paso de la luna",9,650,Pc(160,1050,2.4,"blaze")),K("Danza lunar",13,650,Ss(3,1.1,Pc(130,900,1.8,"blaze"))),K("Abanico de llamas",7,280,jt(280,.6,1e3,2.4,"blaze")),K("Luna de fuego",12,260,Bt(250,1600,2.7,"blaze")),K("Las nueve colas",20,700,St("nine_tail",3))],eddga:[K("Zarpazo ígneo",6,260,jt(240,.7,900,2.4,"blaze")),K("Embestida ardiente",9,560,js(560,100,1e3,2.4,"fire", {
    trailFire: {
      secs:3.5,mult:.35
    }
  })),K("Salto del tigre",9,480,$s(115,1200,2.6,"blaze")),K("Rugido infernal",12,250,Bt(245,1600,2.6,"blaze")),K("Lluvia de brasas",13,700,wu(8,72,1300,.22,220,1.8,3)),K("¡A mí, Bigfoot!",20,700,St("bigfoot",3))],orc_hero:[K("Hachazo",6,270,jt(260,.6,1e3,2.6)),K("Grito de guerra",11,260,Bt(230,1600,2.4,"sound")),K("Carga orca",8,520,js(520,110,1e3,2.4)),K("Salto del héroe",9,480,$s(110,1300,2.6))],osiris:[K("Maldición de la momia",9,650,_s(8,66,1100,.22,200,1.7,"dark")),K("Arenas del desierto",11,260,Bt(225,1600,2.4)),K("Teletransporte",8,480,$s(100,1100,2.4,"dark"))],baphomet:[K("Tormenta oscura",10,700,_s(12,76,1200,.15,250,1.8,"thunder")),K("Guadaña",6,290,jt(280,.75,950,2.8)),K("Embestida",8,560,js(560,110,1e3,2.6)),K("Terremoto",12,290,Bt(260,1700,2.8))]
},HE= {
  kraken:[ {
    at:.5,name:"Furia del abismo",run:St("kraken_leg",5)
  }
  ],moonlight:[ {
    at:.66,name:"Campana de la luna",run:Kp(9)
  }, {
    at:.33,name:"Campana sellada",run:AE(Kp(23, {
      id:"cat_o_nine_tail",secs:20,hp:175e3
    }),"cat_o_nine_tail")
  }
  ]
},FE= {
  moonlight:[ {
    at:.5,name:"Campana de la luna",run:Kp(10)
  }
  ]
},dk=(a,e)=>(a.endless?FE[e]:void 0)??HE[e]??[];function zE(a) {
  for(const e of jl[a]??[])if(Dd.has(e.run))return ef.get(e.run)??null;return null
}
class _c {
  constructor(e,t=[],s=1,n=!1) {
    g(this,"skills");g(this,"ready");g(this,"phases",null);g(this,"phase",0);g(this,"gcd",2.5);this.e=e,this.gcdMult=s,this.skills=[...jl[e.def.id]??[],...t].filter(o=>!(n&&Dd.has(o.run))),this.ready=this.skills.map(()=>le()*3)
  }
  update(e,t) {
    const s=this.e;if(s.dead||!this.skills.length)return;const n=e.bossTarget(s);this.phases??(this.phases=dk(e,s.def.id));const o=this.phases[this.phase];if(o&&s.hp<=s.maxHp*o.at&&s.hiddenUntil<=e.time&&n) {
      this.cast(e,-1-this.phase,n),this.phase++,this.gcd=3;return
    }
    this.gcd-=t;for(let h=0;h<this.ready.length;h++)this.ready[h]-=t;if(this.gcd>0||s.busyUntil>e.time||s.stopped(e.time)||!n)return;const i=n.pos(),r=we(i.x-s.x,i.y-s.y),l=this.skills.map((h,u)=>u).filter(h=>this.ready[h]<=0&&r<=this.skills[h].range&&!(e.noSummons&&Dd.has(this.skills[h].run)));if(!l.length)return;const d=l[Math.floor(le()*l.length)];this.cast(e,d,n),this.ready[d]=this.skills[d].cd,this.gcd=(s.def.boss==="mvp"?2.2:3)*this.gcdMult
  }
  cast(e,t,s) {
    var o;const n=Math.floor(le()*2147483648);hk(e,this.e,t,n,s.pos,t>=0?this.skills[t]:void 0),(o=e.coop)==null||o.bossCast(this.e,t,n,s.mid)
  }
}
function hk(a,e,t,s,n,o) {
  var r;const i=o??(t>=0?(r=jl[e.def.id])==null?void 0:r[t]:dk(a,e.def.id)[-1-t]);i&&(LE(a,e,i.name),e.busyUntil=a.time+i.run(a,e, {
    aim:n,rnd:EE(s)
  }))
}

// --- Minimap (`class FT`), DPS Meter (`class XT`), Need/Greed (`class MC`) & HUD (`class SC`) ---
class FT {
  constructor(e) {
    g(this,"game");g(this,"canvas");g(this,"ctx");g(this,"img",new Image);g(this,"coords");g(this,"zoomIndex",0);g(this,"size",0);g(this,"lastCoords","");g(this,"lastArea","");g(this,"blink",0);this.game=e;const t=document.getElementById("minimap");this.canvas=t.querySelector("canvas"),this.ctx=this.canvas.getContext("2d", {
      willReadFrequently:!0
    }),this.coords=document.getElementById("minimap-coords"),document.getElementById("minimap-name").textContent=Py(e.map.name),this.img.src=e.map.minimap??"",t.querySelector('[data-zoom="in"]').onclick=()=>this.setZoom(1),t.querySelector('[data-zoom="out"]').onclick=()=>this.setZoom(-1),t.classList.toggle("hidden",!e.map.minimap)
  }
  setZoom(e) {
    this.zoomIndex=Math.max(0,Math.min(jy.length-1,this.zoomIndex+e))
  }
  update(e) {
    var Q;const t=this.game,s=t.map,n=t.player,o=this.canvas.clientWidth,i=Math.min(2,window.devicePixelRatio||1),r=Math.round(o*i);r!==this.size&&(this.size=r,this.canvas.width=this.canvas.height=r);const l=n.x/De*2,d=n.y/De*2,h=(Q=t.mapAreas)==null?void 0:Q.find(Z=>l>=Z.x0&&l<Z.x1&&d>=Z.y0&&d<Z.y1),u=h? {
      x0:h.x0*De/2,y0:h.y0*De/2,x1:h.x1*De/2,y1:h.y1*De/2
    }
    : {
      x0:0,y0:0,x1:s.width*De,y1:s.height*De
    },p=h?c(h.name):Py(s.name);p!==this.lastArea&&(this.lastArea=p,document.getElementById("minimap-name").textContent=p);const y=Math.floor(l-((h==null?void 0:h.x0)??0)),w=Math.floor(((h==null?void 0:h.y1)??s.height*2)-d),m=`(${y}, ${w})`;if(m!==this.lastCoords&&(this.lastCoords=m,this.coords.textContent=m),!this.img.complete||!this.img.naturalWidth)return;const f=this.ctx,v=this.size,x=s.width*De,k=s.height*De,M=jy[this.zoomIndex],$=u.x1-u.x0,P=u.y1-u.y0,q=(h?Math.max($,P):Math.min($,P))/M,R=q,L=(Z,ke,xe,pe)=>ke<=pe?Z+(ke-pe)/2:Math.max(Z,Math.min(Z+ke-pe,xe-pe/2)),j=L(u.x0,$,n.x,q),A=L(u.y0,P,n.y,R),E=Math.min(this.img.naturalWidth/x,this.img.naturalHeight/k),C=(this.img.naturalWidth-x*E)/2,_=(this.img.naturalHeight-k*E)/2;f.imageSmoothingEnabled=M===1,f.clearRect(0,0,v,v),f.drawImage(this.img,C+j*E,_+A*E,q*E,R*E,0,0,v,v),h&&(f.save(),f.beginPath(),f.rect(0,0,v,v),f.rect((u.x0-j)/q*v,(u.y0-A)/R*v,$/q*v,P/R*v),f.fillStyle="#000",f.fill("evenodd"),f.restore());const U=(Z,ke)=>[(Z-j)/q*v,(ke-A)/R*v];this.blink+=e;const D=Math.floor(this.blink*3)%2===0;for(const Z of t.enemies) {
      if(Z.dead||!Z.def.boss)continue;const[ke,xe]=U(Z.x,Z.y);f.fillStyle=Z.def.boss==="mvp"?"#ff2a2a":"#ff9a2e",f.globalAlpha=D?1:.45,f.beginPath(),f.arc(ke,xe,3.2*i,0,Math.PI*2),f.fill()
    }
    f.globalAlpha=1;for(const Z of t.pickups) {
      if(Z.dead||Z.kind!=="chest")continue;const[ke,xe]=U(Z.x,Z.y),pe=9*i,ye=7*i;f.fillStyle="#ffc83c",f.strokeStyle="#5a3a12",f.lineWidth=1.2*i,f.beginPath(),f.rect(ke-pe/2,xe-ye/2,pe,ye),f.fill(),f.stroke(),f.beginPath(),f.moveTo(ke-pe/2,xe-ye/6),f.lineTo(ke+pe/2,xe-ye/6),f.stroke(),f.fillStyle="#5a3a12",f.fillRect(ke-i,xe-ye/6,2*i,2.5*i)
    }
    const I=1+.25*Math.sin(this.blink*6);for(const Z of t.pickups) {
      if(Z.dead||Z.kind!=="loot"&&Z.kind!=="card")continue;const[ke,xe]=U(Z.x,Z.y),pe=5.2*i*I;f.beginPath(),f.moveTo(ke,xe-pe),f.lineTo(ke+pe,xe),f.lineTo(ke,xe+pe),f.lineTo(ke-pe,xe),f.closePath(),f.fillStyle=Ps(Math.max(0,Z.quality)),f.strokeStyle="#1d2d57",f.lineWidth=1.2*i,f.fill(),f.stroke()
    }
    for(const Z of t.pickups) {
      if(Z.dead||Z.kind!=="magnet")continue;const[ke,xe]=U(Z.x,Z.y),pe=3.6*i,ye=pe*.9,dt=()=> {
        f.beginPath(),f.moveTo(ke-pe,xe-ye),f.lineTo(ke-pe,xe),f.arc(ke,xe,pe,Math.PI,0,!0),f.lineTo(ke+pe,xe-ye)
      };f.lineCap="butt",dt(),f.strokeStyle="#1d2d57",f.lineWidth=4.6*i,f.stroke(),dt(),f.strokeStyle="#ff3b4a",f.lineWidth=2.6*i,f.stroke(),f.fillStyle="#e8eef8";for(const os of[-1,1])f.fillRect(ke+os*pe-1.3*i,xe-ye,2.6*i,2*i)
    }
    const[N,V]=U(n.x,n.y),F=Math.atan2(n.facingY,n.facingX),Y=6*i;f.save(),f.translate(N,V),f.rotate(F),f.beginPath(),f.moveTo(Y,0),f.lineTo(-Y*.7,-Y*.65),f.lineTo(-Y*.35,0),f.lineTo(-Y*.7,Y*.65),f.closePath(),f.fillStyle="#ffffff",f.strokeStyle="#c0182a",f.lineWidth=1.5*i,f.fill(),f.stroke(),f.restore()
  }
}
const _y="ro-life.dps-open",qy="ro-life.dps-mode",Iy=[222,145,330,190],zT=a=>`hsl(${Iy[a%Iy.length]}, 62%, 74%)`,UT='<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="2" y="8" width="3" height="6" rx="1"/><rect x="6.5" y="3" width="3" height="11" rx="1"/><rect x="11" y="6" width="3" height="8" rx="1"/></svg>',gf="",GT=new Set(["Golpe"]),VT="Cono",KT="Quemadura (talento)",yf="*burn",ql="*poison",WT=a=>a==="Veneno"||a.startsWith("Veneno (");function Zp(a) {
  const e=c(a),t=e===a?/^(.+) \((.+)\)$/.exec(a):null;return t?`${c(t[1])} (${c(t[2])})`:e
}
const YT=500;function Dt(a) {
  return a>=1e6?`${Ee(a/1e6,1)}M`:a>=1e4?`${Ee(a/1e3,0)}k`:a>=1e3?`${Ee(a/1e3,1)}k`:String(Math.round(a))
}
class XT {
  constructor(e) {
    g(this,"btn",document.createElement("button"));g(this,"panel",document.createElement("div"));g(this,"list",document.createElement("div"));g(this,"open",!1);g(this,"mode","players");g(this,"modeBtn",document.createElement("button"));g(this,"next",0);g(this,"hover",null);g(this,"onKey",e=> {
      var t;((t=e.target)==null?void 0:t.tagName)==="INPUT"||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.key.toLowerCase()==="k"&&this.toggle()
    });this.game=e,this.btn.id="dps-toggle",this.btn.className="ro-btn small",this.btn.innerHTML=UT,this.btn.title=`${c("Daño de la partida")} (K)`,this.btn.setAttribute("aria-label",c("Daño de la partida")),this.btn.onclick=()=>this.toggle(),this.panel.id="dps",this.panel.className="ro-window",this.panel.innerHTML=`<div class="ro-title">${c("Daño de la partida")}</div>`,this.list.className="dps-list",this.modeBtn.className="dps-mode hidden",this.modeBtn.onclick=()=> {
      this.mode=this.mode==="players"?"skills":"players";try {
        localStorage.setItem(qy,this.mode)
      }
      catch{}this.apply()
    },this.panel.querySelector(".ro-title").append(this.modeBtn),this.panel.append(this.list),this.list.onmouseover=t=> {
      var s;this.hover=((s=t.target.closest("[data-key]"))==null?void 0:s.dataset.key)??null,this.showTip()
    },this.list.onmouseleave=()=> {
      this.hover=null,this.showTip()
    },document.getElementById("minimap").append(this.btn),document.getElementById("hud").append(this.panel);try {
      this.open=localStorage.getItem(_y)==="1",this.mode=localStorage.getItem(qy)==="skills"?"skills":"players"
    }
    catch {
      this.open=!1
    }
    this.apply(),window.addEventListener("keydown",this.onKey)
  }
  toggle() {
    this.open=!this.open;try {
      localStorage.setItem(_y,this.open?"1":"0")
    }
    catch{}this.apply()
  }
  apply() {
    this.panel.classList.toggle("hidden",!this.open),this.btn.classList.toggle("on",this.open),this.panel.classList.toggle("skills",this.skillsMode),this.modeBtn.textContent=`${this.mode==="players"?c("Jugadores"):c("Skills")} ⇄`,this.modeBtn.title=this.mode==="players"?c("Ver el daño por habilidad"):c("Ver el daño por jugador"),this.next=0,this.open||(this.hover=null),this.showTip()
  }
  get skillsMode() {
    return!!this.game.coop&&this.mode==="skills"
  }
  showTip() {
    const e=document.getElementById("skill-tip"),t=this.hover?[...this.list.querySelectorAll("[data-key]")].find(h=>h.dataset.key===this.hover):void 0,s=t&&(this.skillsMode?tC(this.game,this.hover):this.game.coop?QT(this.game,this.hover):aC(this.game,this.hover));if(!t||!s) {
      e.dataset.from==="dps"&&e.classList.add("hidden");return
    }
    e.innerHTML=s,e.dataset.from="dps",e.classList.add("st-short"),e.classList.remove("hidden");const n=Jn(),o=t.getBoundingClientRect(),i=this.panel.getBoundingClientRect(), {
      width:r,height:l
    }
    =e.getBoundingClientRect(),d=i.left-r-8>=8?i.left-r-8:Math.min(window.innerWidth-r-8,i.right+8);e.style.left=`${d/n}px`,e.style.top=`${Math.max(8,Math.min(window.innerHeight-l-8,o.top+o.height/2-l/2))/n}px`
  }
  update() {
    if(!this.open)return;const e=performance.now();e<this.next||(this.next=e+YT,this.modeBtn.classList.contains("hidden")===!!this.game.coop&&(this.modeBtn.classList.toggle("hidden",!this.game.coop),this.panel.classList.toggle("skills",this.skillsMode)),this.list.innerHTML=this.skillsMode?eC(this.game):this.game.coop?JT(this.game):Bk(this.game),this.hover&&this.showTip())
  }
  destroy() {
    window.removeEventListener("keydown",this.onKey),this.hover=null,this.showTip(),this.btn.remove(),this.panel.remove()
  }
}
function Ik(a,e) {
  const t=Math.round(82-46*Math.min(1,a/60));return {
    light:t,cls:t<60?e>80?" dark full":" dark":""
  }
}
function JT(a) {
  const e=a.coop.damageTable().sort((i,r)=>r.total-i.total),t=e.reduce((i,r)=>i+r.total,0);if(!t)return`<div class="dps-empty">${c("Aún nadie del grupo ha hecho daño.")}</div>`;const s=Math.max(1,a.time),n=e[0].total,o=i=>i.replace(/[&<>"]/g,"");return e.map((i,r)=>{const l=i.total/t*100,d=n?i.total/n*100:0,{light:h,cls:u}=Ik(l,d);return`<div class="dps-row$ {
    u
  }
  $ {
    i.me?" me":""
  }
  " data-key="p:$ {
    i.mid
  }
  ">
          <div class="dps-fill" style="width:$ {
    d
  }
  %;background:hsl(222, 62%, $ {
    h
  }
  %)"></div>
          <span class="dps-name">${r+1}. ${o(i.name)}</span>
          <span class="dps-val">${Dt(i.total)} (${Dt(i.total/s)}, ${Ee(l,l<10?1:0)}%)</span>
        </div>`}).join("")+`<div class="dps-total"><span>${c("Total del grupo")}</span><b>${Dt(t)} · ${Dt(t/s)} ${c("DPS")}</b></div>`}function QT(a,e){const t=a.coop.damageTable(),s=t.find(i=>`p:${i.mid}`===e);if(!s)return"";const n=t.reduce((i,r)=>i+r.total,0)||1,o=i=>Math.round(i).toLocaleString(c("es-ES"));return`<div class="st-head"><div><b>${s.name.replace(/[&<>"]/g,"")
}
</b><small>$ {
  s.me?c("Tú"):c("Compañero de grupo")
}
</small></div></div>
    <div class="st-rows"><span>$ {
  c("Daño total")
}
</span><b>$ {
  o(s.total)
}
</b><span>$ {
  c("DPS")
}
</span><b>$ {
  o(s.total/Math.max(1,a.time))
}
</b><span>$ {
  c("% del daño")
}
</span><b>$ {
  Ee(s.total/n*100,1)
}
%</b></div>`}function ZT(a){return vf(a).map(e=>[e.src,e.part,Math.round(e.total)])}function Rk(a){const e=[],t=[];return a.coop.skillTable().forEach((s,n)=>{const o=zT(n);e.push({name:s.name,me:s.me,color:o});for(const[i,r,l]of s.skills)l>=1&&t.push({key:`s:$ {
  s.mid
}
:$ {
  i
}
|$ {
  r
}
`,src:i,part:r,total:l,who:s.name,me:s.me,color:o})}),{rows:t.sort((s,n)=>n.total-s.total),people:e}}function eC(a){const{rows:e,people:t}=Rk(a),s=l=>l.replace(/[&<>"]/g,""),n=`<div class="dps-legend">$ {
  t.map(l=>`<span><i style="background:${l.color}"></i>${s(l.name)}</span>`).join("")
}
</div>`,o=e.reduce((l,d)=>l+d.total,0);if(!o)return n+`<div class="dps-empty">$ {
  c("Aún nadie del grupo ha hecho daño.")
}
</div>`;const i=Math.max(1,a.time),r=e[0].total;return n+e.map((l,d)=>{const h=l.total/o*100;return`<div class="dps-row" data-key="${s(l.key)}">
          <div class="dps-fill" style="width:${l.total/r*100}%;background:${l.color}"></div>
          <span class="dps-name">$ {
  d+1
}
. $ {
  jh(l)
}
</span>
          <span class="dps-val">$ {
  Dt(l.total)
}
 ($ {
  Dt(l.total/i)
}, $ {
  Ee(h,h<10?1:0)
}
%)</span>
        </div>`}).join("")+`<div class="dps-total"><span>$ {
  c("Total del grupo")
}
</span><b>$ {
  Dt(o)
}
 · $ {
  Dt(o/i)
}
 $ {
  c("DPS")
}
</b></div>`}function tC(a,e){const{rows:t}=Rk(a),s=t.find(l=>l.key===e);if(!s)return"";const n=t.reduce((l,d)=>l+d.total,0)||1,o=ce[s.src===ql?"envenom":s.src],i=o?se.icons.get(o.icon??o.id)??"":"",r=l=>Math.round(l).toLocaleString(c("es-ES"));return`<div class="st-head">$ {
  i?`<img src="${i}" alt="">`:""
}
<div><b>$ {
  jh(s)
}
</b><small>$ {
  s.who.replace(/[&<>"]/g,"")}${s.me?` (${c("Tú")})`:""}</small></div></div>
    <div class="st-rows"><span>${c("Daño total")}</span><b>${r(s.total)}</b><span>${c("DPS")}</span><b>${r(s.total/Math.max(1,a.time))}</b><span>${c("% del daño del grupo")}</span><b>${Ee(s.total/n*100,1)}%</b></div>`}function sC(a){let e=0;for(const t of a.dmgLog.values())for(const s of t.values())e+=s;return`${Dt(e)} · ${Dt(e/Math.max(1,a.time))} ${c("DPS")}`}function vf(a){const e=new Map;for(const[t,s]of a.dmgLog){const n=a.dmgSince.get(t)??0;for(const[o,i]of s){const r=o===KT?yf:WT(o)?ql:"",l=GT.has(o)||o===VT&&Ao(t)?gf:o.endsWith("(Deity)")?"Deity":o,d=r||`${t}|${l}`,h=a.dmgMax.get(`${t}|${o}`)??0,u=e.get(d);u?(u.total+=i,u.since=Math.min(u.since,n),u.max=Math.max(u.max,h)):e.set(d,{key:d,src:r||t,part:l,total:i,since:n,max:h,from:r?new Map:void 0});const p=e.get(d).from;p&&p.set(t,(p.get(t)??0)+i)}}return[...e.values()].filter(t=>t.total>=1).sort((t,s)=>s.total-t.total)}function jh(a){const e=ce[a.src],t=e?e.name:c("Otros");return a.src===ql?c("Venenos"):a.src===yf?Zp("Quemadura (Combustión)"):a.part===gf?t:`${t} · ${Zp(a.part)}`}function aC(a,e){const t=vf(a),s=t.find(p=>p.key===e);if(!s)return"";const n=t.reduce((p,y)=>p+y.total,0),o=ce[s.src===ql?"envenom":s.src],i=o?se.icons.get(o.icon??o.id)??"":"",r=s.src===ql?c("Todos tus venenos"):s.src===yf?c("Todos tus hechizos de fuego"):s.part===gf?c("Golpe de la habilidad"):`${c("Proc")} · ${Zp(s.part)}`,l=s.total/n*100,d=Math.max(1,a.time-s.since),h=p=>`${Math.floor(p/60)}:${String(Math.floor(p%60)).padStart(2,"0")}`,u=p=>Math.round(p).toLocaleString(c("es-ES"));return`<div class="st-head">${i?`<img src="$ {
    i
  }
  " alt="">`:""}<div><b>${jh(s)}</b><small>${r}</small></div></div>
    <div class="st-rows"><span>${c("Daño total")}</span><b>${u(s.total)}</b><span>${c("DPS")}</span><b>${u(s.total/d)}</b>${s.max?`<span>${c("Golpe más alto")}</span><b>${u(s.max)}</b>`:""}<span>${c("% del daño")}</span><b>${Ee(l,1)}%</b><span>${c("Hace daño desde")}</span><b>${c("min")} ${h(s.since)}</b></div>${nC(s)}`}function nC(a){if(!a.from||a.from.size<2)return"";const e=[...a.from].sort((t,s)=>s[1]-t[1]);return`<div class="st-sub">${c("De dónde viene")}</div><div class="st-rows">${e.map(([t,s])=>{var n;return`<span>${((n=ce[t])==null?void 0:n.name)??c("Otros")}</span><b>${Ee(s/a.total*100,1)}%</b>`}).join("")}</div>`}function Bk(a,e=!1){const t=vf(a),s=t.reduce((r,l)=>r+l.total,0);if(!s)return`<div class="dps-empty">${c("Aún no has hecho daño.")}</div>`;const n=Math.max(1,a.time),o=r=>Math.max(1,a.time-r),i=t[0].total;return t.map((r,l)=>{const d=jh(r),h=r.total/s*100,u=r.total/i*100,{light:p,cls:y}=Ik(h,u);return`<div class="dps-row$ {
    y
  }
  " data-key="$ {
    r.key
  }
  "${e?` title="$ {
    d
  }
  "`:""}>
          <div class="dps-fill" style="width:$ {
    u
  }
  %;background:hsl(222, 62%, $ {
    p
  }
  %)"></div>
          <span class="dps-name">${l+1}. ${d}</span>
          ${e?`<span class="dps-val"><small>${Dt(r.total)} · ${Dt(r.total/o(r.since))} ${c("DPS")}</small><b>${Ee(h,h<10?1:0)}%</b></span>`:`<span class="dps-val">${Dt(r.total)} (${Dt(r.total/o(r.since))}, ${Ee(h,h<10?1:0)}%)</span>`}
        </div>`}).join("")+(e?"":`<div class="dps-total"><span>${c("Total")}</span><b>${Dt(s)} · ${Dt(s/n)} ${c("DPS")}</b></div>`)}const Hi="ro-life.blackbox",Nk=Math.random().toString(36).slice(2,10),Yo=`${Hi}.${Nk}`,oC=400,wd=typeof BroadcastChannel<"u"?new BroadcastChannel(Hi):null;wd&&(wd.onmessage=a=>a.data==="alive?"&&wd.postMessage({alive:Nk}));const em="ro-life.incidents",tm=2e3,iC=8,Ry=14,rC=3,sm=a=>{try{const e=localStorage.getItem(a);return e?JSON.parse(e):null}catch{return null}},ii=(a,e)=>{try{localStorage.setItem(a,JSON.stringify(e))}catch{}};let Ne=null,am=0,Si=0,sl=0,al=0,kd=0,xd=0,Gd=0,Ok=0,Fi=null,Md=0;function lC(){const a=new Set;if(!wd)return Promise.resolve(a);const e=new BroadcastChannel(Hi);return e.onmessage=t=>{var n;const s=(n=t.data)==null?void 0:n.alive;s&&a.add(s)},e.postMessage("alive?"),new Promise(t=>window.setTimeout(()=>{e.close(),t(a)},oC))}async function cC(){const a=[];try{for(let s=0;s<localStorage.length;s++){const n=localStorage.key(s);n&&(n===Hi||n.startsWith(Hi+"."))&&a.push(n)}}catch{return[]}if(!a.length)return[];const e=await lC(),t=[];for(const s of a){const n=s.slice(Hi.length+1);if(n&&e.has(n))continue;const o=sm(s);try{localStorage.removeItem(s)}catch{}if(!o||o.end==="ok"||o.end==="hidden"||o.end==="closed")continue;const i=o.end==="webgl"?"WebGL perdido (recarga del juego)":"la página murió (memoria)";t.push({...o,kind:i,gap:Math.round((Date.now()-o.at)/1e3)})}return t.length&&ii(em,[...t,...sm(em)??[]].slice(0,iC)),t.slice(0,3)}function dC(){return sm(em)??[]}function Dk(a,e){const t=Date.now();Ne={start:t,at:t,stage:a,job:e,t:0,enemies:0,fps:0,worst:0,logic:0,world:0,tex:0,geo:0,prog:0,calls:0,screen:"",phys:`${screen.width}x${screen.height}`,cores:navigator.hardwareConcurrency||void 0,res:Te.resolution,runs:Ok,events:[]},am=performance.now(),Si=sl=al=kd=xd=Gd=0,Ne.gpu=Ne.gpuMax=nm=bf(),ii(Yo,Ne)}function hC(a,e){_h(),Ok++,Dk(a,e)}const Il=new Map,Rl=new WeakMap;let nm=0;const uC=20;function bf(){let a=0;for(const[e,t]of Il){if(e.isContextLost()){Il.delete(e);continue}a+=t.bytes+e.drawingBufferWidth*e.drawingBufferHeight*8}return Math.round(a/1048576)}function hs(a){let e=Il.get(a);return e||Il.set(a,e={unit:0,bound:new Map,buffers:new Map,bytes:0}),e}function Ar(a,e,t){if(!e)return;const s=hs(a);if(s.bytes+=t-(Rl.get(e)??0),Rl.set(e,t),!Ne||t<=0)return;const n=bf();n>(Ne.gpuMax??0)&&(Ne.gpuMax=n),n>=nm+uC&&(nm=n,Ne.gpu=n,ii(Yo,Ne))}function By(a,e){if(!e)return;const t=Il.get(a);t&&(t.bytes-=Rl.get(e)??0),Rl.delete(e)}function pC(a){if(a.length>=9)return[a[3],a[4]];const e=a[5];return e?[e.videoWidth||e.naturalWidth||e.width||0,e.videoHeight||e.naturalHeight||e.height||0]:[0,0]}function mC(){for(const a of[globalThis.WebGLRenderingContext,globalThis.WebGL2RenderingContext]){if(!a)continue;const e=a.prototype,t=(s,n)=>{const o=e[s];typeof o=="function"&&(e[s]=function(...i){const r=o.apply(this,i);try{n(this,i)}catch{}return r})};t("activeTexture",(s,[n])=>hs(s).unit=n),t("bindTexture",(s,[n,o])=>{n===s.TEXTURE_2D&&hs(s).bound.set(hs(s).unit,o)}),t("texImage2D",(s,n)=>{if(n[0]!==s.TEXTURE_2D||n[1]!==0)return;const[o,i]=pC(n);Ar(s,hs(s).bound.get(hs(s).unit),o*i*4)}),t("texStorage2D",(s,[,n,,o,i])=>{Ar(s,hs(s).bound.get(hs(s).unit),o*i*4*(n>1?4/3:1))}),t("compressedTexImage2D",(s,n)=>{if(n[1]!==0)return;const o=n[n.length-1];o&&"byteLength"in o&&Ar(s,hs(s).bound.get(hs(s).unit),o.byteLength)}),t("generateMipmap",(s,[n])=>{if(n!==s.TEXTURE_2D)return;const o=hs(s).bound.get(hs(s).unit),i=o?Rl.get(o):void 0;o&&i&&Ar(s,o,Math.round(i*4/3))}),t("deleteTexture",(s,[n])=>By(s,n)),t("bindBuffer",(s,[n,o])=>hs(s).buffers.set(n,o)),t("bufferData",(s,[n,o])=>{const i=typeof o=="number"?o:(o==null?void 0:o.byteLength)??0;Ar(s,hs(s).buffers.get(n),i)}),t("deleteBuffer",(s,[n])=>By(s,n))}}typeof window<"u"&&mC();function Hk(a){var o;if(!Ne)return;const e=a.renderer.info,t=performance.memory;let s=0;for(const i of se.sheets.values())s+=i.pixels;const n=B.memory();Object.assign(Ne,{at:Date.now(),tex:e.memory.textures,geo:e.memory.geometries,prog:((o=e.programs)==null?void 0:o.length)??0,calls:e.render.calls,heap:t?Math.round(t.usedJSHeapSize/1e6):void 0,img:Math.round(s*4/1e6),gpu:bf(),parts:GM(a),snd:n.mb,voices:n.playing,dom:document.getElementsByTagName("*").length,up:Math.round(performance.now()/1e3),screen:`${innerWidth}x${innerHeight}@${devicePixelRatio}`,res:Te.resolution}),Gd=0,ii(Yo,Ne)}function fC(a,e,t,s){if(!Ne||Fi)return;Si++,sl+=a,kd+=e,xd+=t,a>al&&(al=a);const n=performance.now();n-am<tm||(am=n,Object.assign(Ne,{t:Math.round(s.time),enemies:s.enemies.length,fps:sl?Math.round(Si*1e3/sl):0,worst:Math.round(al),logic:+(kd/Si).toFixed(1),world:+(xd/Si).toFixed(1)}),Si=sl=al=kd=xd=0,Hk(s.world3d))}function gC(a,e,t){_h(),Dk(a,e),Fi=t;let s=performance.now();Md=window.setInterval(()=>{if(!Ne||!Fi)return;const n=performance.now();Ne.worst=Math.max(0,Math.round(n-s-tm)),Ne.t=Math.round((Date.now()-Ne.start)/1e3),s=n,Hk(Fi)},tm)}function yC(){Fi&&(_h(),Bl("ok"))}function _h(){Md&&window.clearInterval(Md),Md=0,Fi=null}function cn(a){Ne&&(Ne.events.push(`${Math.round((Date.now()-Ne.start)/1e3)}s ${a}`),Ne.events.length>Ry&&Ne.events.splice(0,Ne.events.length-Ry),ii(Yo,Ne))}VM(a=>cn(`carga ${a}`));const Fk=a=>{!Ne||Gd>=rC||(Gd++,cn(`error: ${a.slice(0,120)}`))};window.addEventListener("error",a=>Fk(String(a.message||a.error||"error")));window.addEventListener("unhandledrejection",a=>{var e;return Fk(String(((e=a.reason)==null?void 0:e.message)??a.reason))});function Bl(a){if(Ne&&!(Ne.end==="webgl"&&a==="closed")){if(Ne.end=a,a==="ok"){Ne=null,_h();try{localStorage.removeItem(Yo)}catch{}return}ii(Yo,Ne)}}function vC(){!Ne||Ne.end!=="hidden"||(Ne.end=void 0,ii(Yo,Ne))}const Ot=a=>document.getElementById(a),Ny=(a,e)=>`<button class="pk-act" data-act="$ {
    e
  }
  " title="$ {
    a.title
  }
  "${a.disabled?" disabled":""}>${a.label}${a.left!==void 0?`<small>${a.left}</small>`:""}</button>`;let Ja=null;const Rn=4,bC="attribute vec2 p; void main()  {
     gl_Position = vec4(p, 0.0, 1.0);
  }
  ",wC=`precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform float uScale;
uniform vec4 uRect[${Rn}]; uniform vec3 uColor[${Rn}]; uniform float uInt[${Rn}];
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 col = vec3(0.0); float alpha = 0.0;
  for (int k = 0; k < ${Rn}; k++) {
    float it = uInt[k];
    if (it < 0.002) continue;
    vec2 p = px - uRect[k].xy;
    float d = sdBox(p, uRect[k].zw, 12.0 * uScale) / uScale;
    if (d < -2.0) continue;
    float ang = atan(p.y, p.x);
    // llamas que suben (el ruido se desplaza hacia arriba) y una ola de brillo que gira alrededor
    float n = fbm((px - uRect[k].xy) / uScale * 0.032 + vec2(0.0, uTime * 1.7));
    float sweep = 0.6 + 0.4 * sin(ang * 3.0 - uTime * 2.4);
    // las llamas suben más por arriba que por abajo
    float up = 1.0 + 0.7 * clamp(-p.y / uRect[k].w, 0.0, 1.0);
    float reach = (24.0 + 74.0 * n * sweep * up) * min(it, 1.6);
    float g = pow(clamp(1.0 - max(d, 0.0) / reach, 0.0, 1.0), 1.5) * (0.45 + 0.75 * n);
    // halo pegado a la carta, igual por todos los lados, y un borde casi blanco
    float halo = exp(-max(d, 0.0) / 14.0) * 0.75;
    float rim = exp(-abs(d) * 0.25);
    vec3 c = uColor[k];
    vec3 hot = mix(c, vec3(1.0), 0.6);
    float a = clamp((g * 1.3 + halo + rim * 0.6) * it, 0.0, 1.0);
    col += mix(c, hot, rim) * a;
    alpha = max(alpha, a);
  }
  gl_FragColor = vec4(col, alpha);
}`;class kC{constructor(e){g(this,"gl");g(this,"prog");g(this,"u",{});this.canvas=e;const t=e.getContext("webgl",{premultipliedAlpha:!0,alpha:!0,antialias:!1});if(!t)throw new Error("sin WebGL");this.gl=t;const s=(r,l)=>{const d=t.createShader(r);if(t.shaderSource(d,l),t.compileShader(d),!t.getShaderParameter(d,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(d)??"shader");return d},n=t.createProgram();if(t.attachShader(n,s(t.VERTEX_SHADER,bC)),t.attachShader(n,s(t.FRAGMENT_SHADER,wC)),t.linkProgram(n),!t.getProgramParameter(n,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(n)??"link");this.prog=n,t.useProgram(n);const o=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,o),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),t.STATIC_DRAW);const i=t.getAttribLocation(n,"p");t.enableVertexAttribArray(i),t.vertexAttribPointer(i,2,t.FLOAT,!1,0,0);for(const r of["uRes","uTime","uScale","uRect","uColor","uInt"])this.u[r]=t.getUniformLocation(n,r)}draw(e,t){const s=this.gl,n=window.devicePixelRatio||1,o=Math.round(window.innerWidth*n),i=Math.round(window.innerHeight*n);if((this.canvas.width!==o||this.canvas.height!==i)&&(this.canvas.width=o,this.canvas.height=i),s.viewport(0,0,o,i),s.clearColor(0,0,0,0),s.clear(s.COLOR_BUFFER_BIT),!t.some(h=>h.intensity>.002))return;const r=new Float32Array(Rn*4),l=new Float32Array(Rn*3),d=new Float32Array(Rn);t.slice(0,Rn).forEach((h,u)=>{r.set([(h.rect.left+h.rect.width/2)*n,(h.rect.top+h.rect.height/2)*n,h.rect.width/2*n,h.rect.height/2*n],u*4),l.set(h.color,u*3),d[u]=h.intensity}),s.useProgram(this.prog),s.uniform2f(this.u.uRes,o,i),s.uniform1f(this.u.uTime,e),s.uniform1f(this.u.uScale,n*Jn()),s.uniform4fv(this.u.uRect,r),s.uniform3fv(this.u.uColor,l),s.uniform1fv(this.u.uInt,d),s.drawArrays(s.TRIANGLE_STRIP,0,4)}clear(){this.gl.clearColor(0,0,0,0),this.gl.clear(this.gl.COLOR_BUFFER_BIT)}}let hi;function zk(){if(hi===void 0){if(Qe)return hi=null,Ot("picker").classList.add("no-gl"),hi;try{hi=new kC(Ot("pk-aura"))}catch{hi=null,Ot("picker").classList.add("no-gl")}}return hi}const Oy=a=>{const e=parseInt(a.replace("#",""),16);return[(e>>16&255)/255,(e>>8&255)/255,(e&255)/255]};function Dy(a,e,t){return Array.from({length:a},(s,n)=>{const o=n/a*Math.PI*2+Math.random()*.4,i=e*(.6+Math.random()*.6);return`<i class="dr-p" style="--x:$ {
    Math.round(Math.cos(o)*i)
  }
  px;--y:$ {
    Math.round(Math.sin(o)*i)
  }
  px;--d:$ {
    (t+Math.random()*.25).toFixed(2)
  }
  s;--s:$ {
    (.6+Math.random()).toFixed(2)
  }
  "></i>`}).join("")}function Uk(){var a;Ja==null||Ja(),Ja=null,(a=zk())==null||a.clear(),Ot("picker").classList.contains("hidden")||cn("cartas cerradas"),Ot("picker").classList.add("hidden"),Ot("pk-cards").innerHTML=""}function br(a){var A;Ja==null||Ja();const e=Ot("picker"),t=a.cards.length;cn(`cartas «${a.title}» ×${t}${a.again?" (otra vez)":""}`),e.classList.toggle("again",!!a.again),Ot("pk-title").textContent=a.title,Ot("pk-sub").textContent=a.subtitle??"",Ot("pk-gain").textContent=a.gain??"",Ot("pk-gain").classList.toggle("hidden",!a.gain),Ot("lu-sockets").classList.toggle("hidden",a.extra!=="sockets"),Ot("pk-hint").textContent=a.hint??(t>1?c("Elige una carta (1– {
    n
  })",{n:t}):"");const s=Ot("pk-cards");s.style.setProperty("--n",String(t)),s.classList.toggle("many",t>4),s.classList.toggle("has-acts",a.cards.some(E=>{var C;return(C=E.actions)==null?void 0:C.length})),s.innerHTML=a.cards.map((E,C)=>{var _;return`<div class="pk-slot$ {
    a.again&&!a.again.fresh.includes(C)?" still":""
  }
  " style="--q:$ {
    E.color
  };--i:$ {
    C
  }
  ">
        <div class="pk-pop">${Qe?"":Dy(14,150,.25+C*.12)}
          <button class="pk-card" data-i="$ {
    C
  }
  ">
            <span class="pk-key">${C+1}</span>
            ${E.badge?`<span class="pk-badge">${E.badge}</span>`:""}
            ${E.fresh?`<span class="pk-ribbon"><span>${E.fresh}</span></span>`:""}
            <span class="pk-art"><img src="$ {
    E.icon
  }
  " alt=""></span>
            <b class="pk-name">${E.name}</b>
            ${E.sub?`<small class="pk-sub">${E.sub}</small>`:""}
            <ul class="pk-lines">${E.lines.map(U=>`<li>${U}</li>`).join("")}</ul>
            ${E.swap?`<span class="pk-swap"><span class="pk-swap-ico">⇄</span><img src="$ {
    E.swap.icon
  }
  " alt=""><span>${E.swap.text}</span></span>`:""}
            ${E.mark?`<span class="pk-mark">${E.mark}</span>`:""}
          </button>
          ${E.confirm?`<div class="pk-back"><div class="pk-back-icons"><img src="$ {
    E.confirm.from
  }
  " alt=""><span>➜</span><img src="$ {
    E.confirm.to
  }
  " alt=""></div><b>${E.confirm.question}</b>${E.confirm.note?`<small>${E.confirm.note}</small>`:""}<div class="pk-back-btns"><button class="ro-btn primary" data-yes>${c("Sí, cambiar")}</button><button class="ro-btn" data-no>${c("No")}</button></div></div>`:""}
          ${(_=E.actions)!=null&&_.length?`<div class="pk-acts">${E.actions.map((U,D)=>Ny(U,`${C}:${D}`)).join("")}</div>`:""}
        </div>
      </div>`}).join("");let n=document.getElementById("pk-bar");n||(n=document.createElement("div"),n.id="pk-bar",Ot("pk-hint").after(n)),n.innerHTML=(a.bar??[]).map((E,C)=>Ny(E,`bar:${C}`)).join(""),n.classList.toggle("hidden",!((A=a.bar)!=null&&A.length));let o=document.getElementById("pk-timer");o||(o=document.createElement("div"),o.id="pk-timer",Ot("pk-sub").after(o)),o.classList.toggle("hidden",!a.deadline),e.classList.remove("hidden","closing");const i=[...s.querySelectorAll(".pk-card")],r=a.cards.map(E=>Oy(E.color)),l=i.map(()=>0);let d=-1,h=-1;const u=performance.now();let p=!!a.locked;const y=()=>!p&&performance.now()-u>380+t*120,w=zk();let m=0,f=performance.now();const v=E=>{const C=Math.min(.05,(E-f)/1e3);f=E,i.forEach((_,U)=>{const D=U===h||a.all&&h>=0?1.6:h>=0?0:U===d?1:0;l[U]+=(D-l[U])*Math.min(1,C*(D>l[U]?9:5))}),w==null||w.draw(E/1e3,i.map((_,U)=>({rect:_.getBoundingClientRect(),color:r[U],intensity:l[U]}))),m=requestAnimationFrame(v)};m=requestAnimationFrame(v);const x=[...s.querySelectorAll(".pk-slot")];let k=-1;const M=(E,C)=>{const _=x[E],U=_.querySelector(".pk-back");U&&(U.style.minHeight=`${i[E].offsetHeight}px`),_.classList.remove("flip"),_.offsetWidth,_.classList.add("flip"),window.setTimeout(()=>{var D;h>=0||(_.classList.toggle("asking",C),C&&((D=_.querySelector("[data-yes]"))==null||D.focus({preventScroll:!0})))},160)},$=()=>{k<0||(M(k,!1),k=-1)},P=E=>{if(!(h>=0||!y()||E<0||E>=t)){if(a.cards[E].confirm&&k!==E)return $(),k=E,M(E,!0);q(E)}},q=E=>{if(h>=0||!y()||E<0||E>=t)return;h=E,Ja=null,window.removeEventListener("keydown",R),window.removeEventListener("keydown",L,!0),n.classList.add("hidden");const C=x;for(const _ of C)_.classList.remove("asking","flip");C.forEach((_,U)=>{_.classList.remove("still"),_.classList.add(U===E||a.all?"chosen":"gone")});for(const[_,U]of C.entries())(_===E||a.all)&&U.querySelector(".pk-pop").insertAdjacentHTML("beforeend",`<span class="pk-flash"></span>${Dy(Qe?10:26,230,0)}`);e.classList.add("closing"),window.setTimeout(()=>{cancelAnimationFrame(m),w==null||w.clear(),e.classList.add("hidden"),e.classList.remove("closing"),s.innerHTML="",a.onPick(E)},820)};i.forEach((E,C)=>{E.onpointerenter=()=>d=C,E.onpointerleave=()=>{d===C&&(d=-1)},E.onfocus=()=>d=C,E.onclick=()=>P(C);const _=x[C].querySelector(".pk-back");_&&(_.querySelector("[data-yes]").onclick=U=>{U.stopPropagation(),k===C&&q(C)},_.querySelector("[data-no]").onclick=U=>{U.stopPropagation(),k===C&&$()})});const R=E=>{const C=Number(E.key);C>=1&&C<=t?P(C-1):k>=0&&E.key==="Enter"?(E.preventDefault(),q(k)):a.all&&(E.key===" "||E.key==="Enter")&&q(0)};window.addEventListener("keydown",R);const L=E=>{E.key!=="Escape"||k<0||h>=0||(E.stopImmediatePropagation(),E.preventDefault(),$())};window.addEventListener("keydown",L,!0);for(const E of e.querySelectorAll(".pk-act")){const[C,_]=E.dataset.act.split(":"),U=C==="bar"?a.bar[Number(_)]:a.cards[Number(C)].actions[Number(_)];E.onclick=D=>{D.stopPropagation(),h<0&&!U.disabled&&U.run()}}let j=0;if(a.deadline){const E=()=>{if(h>=0)return clearInterval(j);const C=Math.max(0,Math.ceil((a.deadline-performance.now())/1e3));o.textContent=c("Elige en  {
    s
  }
   s",{s:C}),o.classList.toggle("urgent",C<=3),C<=0&&(p=!1,y()&&q(Math.floor(Math.random()*t)))};E(),j=window.setInterval(E,250)}return Ja=()=>{cancelAnimationFrame(m),clearInterval(j),window.removeEventListener("keydown",R),window.removeEventListener("keydown",L,!0)},{slots:[...s.querySelectorAll(".pk-slot")],cards:i,unlock:()=>{p=!1,i.forEach((E,C)=>r[C]=Oy(getComputedStyle(E.parentElement.parentElement).getPropertyValue("--q").trim()||"#ffffff"))}}}const wf=["need","greed","pass"],Pr=20,xC=6;function Gk(a,e){return a==="card"?qt(e):zo(e,"")}function Vd(a){return a==="need"?"Need":a==="greed"?"Greed":c("Pasar")}class MC{constructor(){g(this,"box",document.getElementById("loot-rolls"));g(this,"rows",new Map)}open(e,t,s,n,o){const i=t==="card",r=document.createElement("div");r.className="lr-row",r.innerHTML=`<div class="lr-item"><img class="$ {
    i?"card":""
  }
  " src="$ {
    i?Fs(s):Me(s)
  }
  " alt="">
        <div><b style="color:$ {
    Ps(Math.max(0,n))
  }
  ">${Gk(t,s)}</b><small>${i?c("Carta"):t==="egg"?c("Huevo de pet"):c("Pieza")}</small></div></div>
      <div class="lr-time"><span></span></div>
      <div class="lr-btns"><span class="lr-wait">Need / Greed…</span></div>`,r.onpointerdown=d=>d.stopPropagation(),this.box.append(r);const l=performance.now();this.rows.set(e,{el:r,bar:r.querySelector(".lr-time span"),btns:r.querySelector(".lr-btns"),start:l,until:l+o*1e3,picked:!1,closeAt:1/0})}picked(e,t){const s=this.rows.get(e);!s||s.picked||(s.picked=!0,s.btns.innerHTML=`<span class="lr-wait">${c(" {
    c
  }
  : esperando a los demás…",{c:Vd(t)})}</span>`)}result(e,t,s){const n=this.rows.get(e);if(!n)return;const o=r=>wf.indexOf(r),i=[...t].sort((r,l)=>o(r[1])-o(l[1])||l[2]-r[2]);n.btns.innerHTML=`<ul class="lr-res">${i.map(([r,l,d])=>`<li class="$ {
    r===s?"win":""
  }
  "><b>${r}</b><span>${Vd(l)}${l==="pass"?"":` · ${d}`}</span></li>`).join("")}</ul>`,n.picked=!0,n.el.classList.add("done"),n.bar.style.width="0%",n.closeAt=performance.now()+xC*1e3}update(){const e=performance.now();for(const[t,s]of this.rows){if(e>=s.closeAt){s.el.remove(),this.rows.delete(t);continue}s.closeAt===1/0&&(s.bar.style.width=`${Math.max(0,(s.until-e)/(s.until-s.start))*100}%`,e>=s.until&&!s.picked&&(s.picked=!0,s.btns.innerHTML=`<span class="lr-wait">${c("Pasar")}</span>`))}}destroy(){this.rows.clear(),this.box.innerHTML=""}}const $C="(max-width: 720px), (max-height: 500px)",ve=a=>document.getElementById(a);function Jn(){return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ui"))||1}function Ae(a,e,t){var n;ve("npc-name").textContent=a,ve("npc-text").innerHTML=e;const s=ve("npc-options");s.innerHTML='<span class="spacer"></span>';for(const o of t){const i=document.createElement("button");i.className=`ro-btn${o.primary?" primary":""}`,i.textContent=o.label,i.onclick=()=>{var r;de("npc-dialog"),(r=o.run)==null||r.call(o)},s.appendChild(i)}Ue("npc-dialog"),(n=s.lastElementChild)==null||n.focus()}function sa(a,e,t,s){Ae(a,e,[{label:c("Cancelar")},{label:t,primary:!0,run:s}])}function de(a){ve(a).classList.add("hidden")}function Ue(a){ve(a).classList.remove("hidden")}class SC{constructor(e,t,s){g(this,"game");g(this,"minimap");g(this,"dps");g(this,"lastFrame",performance.now());g(this,"weatherText","-");g(this,"bossList",[]);g(this,"bossFills",[]);g(this,"cdEls",[]);g(this,"buffSig","");g(this,"last",{hp:-1,max:-1,lv:-1,exp:-1,sec:-1,kills:-1,skills:"",zeny:-1,items:"-"});g(this,"reveals",[]);g(this,"revealing",!1);this.game=e,ve("hud-name").innerHTML=`<span></span> <small>${e.jobLabel||e.classDef.name}</small>`,ve("hud-name").firstElementChild.textContent=t;const n=document.createElement("canvas");Vk(n,s),ve("hud-portrait").src=n.toDataURL(),n.width=n.height=0,ve("zeny-icon").src=se.icons.get("zeny")??"",ve("runitems").innerHTML="",ve("toasts").innerHTML="",ve("timer").classList.toggle("hidden",e.isStory),this.minimap=new FT(e),this.dps=new XT(e),TC(e),Ue("hud")}update(){var w,m;const e=this.game,t=performance.now();this.minimap.update(Math.min(.1,(t-this.lastFrame)/1e3)),this.dps.update(),this.lastFrame=t;const s=this.last,n=Math.ceil(e.hp);if(n!==s.hp||e.stats.maxHp!==s.max){s.hp=n,s.max=e.stats.maxHp;const f=n/e.stats.maxHp*100;ve("hp-fill").style.width=`${f}%`,ve("hp-fill").style.setProperty("--hp-l",`${Math.round(22+.4*f)}%`),ve("hp-fill").parentElement.classList.toggle("low",f<25),ve("hp-text").textContent=`${n} / ${e.stats.maxHp}`}const o=Math.floor(e.exp/e.expNext*1e3);(e.level!==s.lv||o!==s.exp)&&(s.lv=e.level,s.exp=o,ve("lv").textContent=String(e.level),ve("exp-fill").style.width=`${o/10}%`,ve("exp-text").textContent=`${(o/10).toFixed(1)}%`);const i=e.lootUntil>=0,r=!i&&e.mvpUntil>=0,l=i?-Math.max(0,Math.ceil(e.lootUntil-e.time)):r?-Math.max(0,Math.ceil(e.mvpUntil-e.time)):Math.floor(e.time);if(l!==s.sec){s.sec=l;const f=Math.abs(l);ve("timer").textContent=`${String(Math.floor(f/60)).padStart(2,"0")}:${String(f%60).padStart(2,"0")}`,ve("timer").classList.toggle("loot",i||r&&-l<=30),ve("timer").classList.toggle("mvp",r),ve("timer").title=i?c("Tiempo para recoger el botín"):r?c("Tiempo para vencer al MVP"):""}const d=((w=e.atmosphere)==null?void 0:w.label())??"";d!==this.weatherText&&(this.weatherText=d,ve("weather").textContent=d),e.kills!==s.kills&&(s.kills=e.kills,ve("kills").textContent=`☠ ${e.kills}`),e.zeny!==s.zeny&&(s.zeny=e.zeny,ve("zeny-text").textContent=`${e.zeny} z`,ve("chest-cost").textContent=c("cofre  {
    n
  }
   z",{n:e.chestCost()}));const h=[...e.runItems.slots].map(([f,v])=>`${f}:${v.item}+${v.vals.length}`).join();h!==s.items&&(s.items=h,ve("runitems").innerHTML=Wd(e));const u=[e.basicAttack,...e.slots].map(f=>f+e.skillLevel(f)).join();u!==s.skills&&(s.skills=u,ve("skillbar").innerHTML=Kk(e),this.cdEls=[...ve("skillbar").querySelectorAll("[data-skill]")].flatMap(f=>{const v=e.weapons.find(x=>x.id===f.dataset.skill);return v?[{el:f,w:v,cd:f.querySelector(".cd"),txt:f.querySelector(".cdt"),casts:v.casts}]:[]}));const p=e.activeBuffs(),y=p.map(f=>f.key+f.text).join("|");y!==this.buffSig&&(this.buffSig=y,ve("buffs").innerHTML=p.map(f=>{var v;return`<div class="buff" data-buff="$ {
    f.key
  }
  " style="--c:#$ {
    f.color.toString(16).padStart(6,"0")
  }
  "><img src="$ {
    se.icons.get(((v=ce[f.skill])==null?void 0:v.icon)??f.skill)??""
  }
  "><div class="cd"></div><span class="bs"></span><span class="bt"></span></div>`}).join(""));for(const f of p){const v=ve("buffs").querySelector(`[data-buff="$ {
    f.key
  }
  "]`);v&&(v.querySelector(".cd").style.setProperty("--p",(1-f.left/Math.max(.01,f.total)).toFixed(3)),v.querySelector(".bt").textContent=String(Math.ceil(f.left)),v.querySelector(".bs").textContent=f.stacks>1?`×${f.stacks}`:"",v.classList.toggle("ending",f.left<2))}for(const f of this.cdEls){const v=(m=e.loadout)!=null&&m.missingWeapon?1:f.w.cdFraction();f.cd.style.setProperty("--p",v.toFixed(3));const x=f.w.timer;f.txt.textContent=v>0&&x>=.95?String(Math.ceil(x)):"",f.el.classList.toggle("ready",v===0),f.w.casts!==f.casts&&(f.casts=f.w.casts,f.el.classList.remove("cast"),f.el.offsetWidth,f.el.classList.add("cast"))}}bosses(e){const t=ve("boss-bar");if(!e.length||matchMedia($C).matches){if(!this.bossList.length&&!t.innerHTML)return;de("boss-bar"),t.innerHTML="",this.bossList=[],this.bossFills=[];return}Ue("boss-bar"),(e.length!==this.bossList.length||e.some((s,n)=>s!==this.bossList[n]))&&(this.bossList=[...e],t.innerHTML=e.map(s=>{const n=s.def.boss==="mvp";return`<div class="boss-row$ {
    n?"":" mini"
  }
  "><div class="boss-name"><span class="mvp-tag">${n?"MVP":c("Jefe")}</span><span>${s.def.name}</span></div><div class="boss-segs"><div class="bar boss"><div></div></div></div></div>`}).join(""),this.bossFills=e.map((s,n)=>{var o;return((o=t.children[n])==null?void 0:o.querySelector(".bar > div"))??null})),e.forEach((s,n)=>{const o=this.bossFills[n];o&&(o.style.width=`${Math.max(0,s.hp/s.maxHp*100)}%`)})}reveal(e,t){this.reveals.push({drop:e,done:t}),this.revealing||this.nextReveal()}nextReveal(){var I,N,V;const e=this.reveals.shift(),t=ve("drop-reveal");if(!e){this.revealing=!1,t.classList.add("hidden"),t.innerHTML="";return}this.revealing=!0;const{drop:s}=e,n=s.roll;if(n&&performance.now()>=n.until)return(I=s.closed)==null||I.call(s),e.done(),this.nextReveal();const o=Re[s.quality]??Re[0],i=Ps(s.quality),r=s.kind==="card",l=s.kind==="egg",d=s.kind==="dye"?s.dye:void 0,h=d?c(d.name):r?qt(s.id):l?zo(s.id,""):zo(s.id,qm(s.affixes)),u=r?((N=ms[s.id])==null?void 0:N.bonuses)??[]:l||d?[]:[...((V=fe[s.id])==null?void 0:V.bonuses)??[],...wh(s.id,s.tier),...Im(s.affixes)],p=l?yk[s.id]:void 0,y=d?[c("Tinte especial para todos tus personajes. Póntelo en el Estilista de la plaza.")]:[],w=p?[...vl(p,Wo[0].mult),c("Nace al acabar la partida. Llévalo desde la pestaña Pets del personaje.")]:[],m=r||l||d?null:wa({itemId:s.id,quality:s.quality,tier:s.tier}),f=m?[m.atk?`+${m.atk} ATK`:"",m.matk?`+${m.matk} MATK`:"",m.def?`DEF ${Ee(m.def,1)}`:""].filter(Boolean):[],v=n&&m?KM(s.quality):0,x=v?[c("+ {
    n
  }
   propiedades al azar para quien la gane",{n:v})]:[],k=d?null:r?Fs(s.id):l?null:WM(s.id),M=d?'<canvas class="dye-av" width="160" height="200"></canvas>':k?`<img class="art" src="$ {
    k
  }
  " alt="">`:`<img class="icon" src="$ {
    Me(s.id)
  }
  " alt="">`,$=Array.from({length:28},(F,Y)=>{const Q=Y/28*Math.PI*2+Math.random()*.3,Z=140+Math.random()*160;return`<i class="dr-p" style="--x:$ {
    Math.round(Math.cos(Q)*Z)
  }
  px;--y:$ {
    Math.round(Math.sin(Q)*Z)
  }
  px;--d:$ {
    (.35+Math.random()*.35).toFixed(2)
  }
  s;--s:$ {
    (.6+Math.random()).toFixed(2)
  }
  "></i>`}).join(""),P=s.result,q=P?`<div class="dr-result"><b>${P.winner?P.mine?c("¡Te la llevas tú!"):c(" {
    name
  }
   se lleva  {
    item
  }
  ",{name:P.winner,item:h}):c("Nadie se lleva  {
    item
  }
  ",{item:h})}</b>
        <ul>${P.rolls.map(([F,Y,Q])=>`<li><span>${F}</span><span>${Vd(Y)}</span><b>${Y==="pass"?"—":Q}</b></li>`).join("")}</ul></div>`:"",R=n?`<div class="dr-roll"><div class="lr-time"><span></span></div><div class="dr-roll-btns">${wf.map(F=>`<button class="ro-btn$ {
    F==="need"?" primary":""
  }
  " data-c="$ {
    F
  }
  ">${Vd(F)}</button>`).join("")}</div></div>`:`${q}<button class="ro-btn primary dr-get">${c(d||P&&!P.mine?"Seguir":"Coger")}</button>`;t.style.setProperty("--q",i),t.classList.toggle("roll",!!n),t.innerHTML=`<div class="dr-inner">
      <div class="dr-stage"><div class="dr-rays"></div><div class="dr-glow"></div>${$}<div class="dr-card$ {
    d?" dye":k?"":" gear"
  }
  ">${M}</div></div>
      <div class="dr-name">${h}</div>
      <div class="dr-q">${d?c("Tinte desbloqueado"):r?c("Carta"):l?`${c("Huevo de pet")}${p?` · ${Ht(p)}`:""}`:`${c(o.name)}${s.tier?` · Tier ${s.tier}`

// --- Main Game Run (`class Ka`), Story (`class JA`/`oP`), Endless (`class D5`) & Deck (`class Rf`) ---
class Rf{constructor(e,t={}){g(this,"base",0);g(this,"job",0);g(this,"level");g(this,"exp");g(this,"jobLevel");g(this,"jobExp");g(this,"jobCounted",0);g(this,"jobMax");g(this,"jobCap");g(this,"jobMult");this.level=e.level,this.exp=e.exp,this.jobLevel=e.jobLevel??1,this.jobExp=e.jobExp??0,this.jobMax=e.job?Zn(e.job):50,this.jobCap=t.jobCap??1/0,this.jobMult=(t.jobExp??1)*Math.max(1,t.count??1)**-.5}kill(e,t){const s=t*Ep(this.level,e);this.base+=s,[this.level,this.exp]=Gl(this.level,this.exp,s,Go,Jl),this.jobCounted!==this.job&&this.addJob(this.job-this.jobCounted);const n=this.jobLevel-this.jobCap,o=s*i$*this.jobMult*(n<0?1:p5**(n+1));this.job+=o,this.addJob(o)}addJob(e){[this.jobLevel,this.jobExp]=Gl(this.jobLevel,this.jobExp,e,Ql,this.jobMax),this.jobCounted=this.job}}const p5=.1;function Dh(a,e){var l;const t=a.record;e.skipped||t.runs++,t.totalKills+=e.kills,t.bestTime=Math.max(t.bestTime,Math.floor(e.time)),t.bestLevel=Math.max(t.bestLevel,e.level),t.bestKills=Math.max(t.bestKills,e.kills),e.win&&!e.skipped&&t.wins++;const s=e.stage?et[e.stage]:void 0;if(!(s!=null&&s.story)||s.storyOnly)for(const d of e.mvps??[])(a.mvpsDefeated??(a.mvpsDefeated=[])).includes(d)||a.mvpsDefeated.push(d);s&&((l=e.mvps)!=null&&l.includes(s.bosses[s.bosses.length-1].id))&&!(a.stagesCleared??(a.stagesCleared=[])).includes(e.stage)&&a.stagesCleared.push(e.stage);const n=Math.round(e.baseExp),o=a.level;[a.level,a.exp]=Gl(a.level,a.exp,n,Go,Jl);const i=a.promotion?0:Math.round(e.jobExp),r=a.jobLevel;[a.jobLevel,a.jobExp]=Gl(a.jobLevel,a.jobExp,i,Ql,Zn(a.job));for(const d of e.loot)a.inventory.push({...Hh(d.id,Mh(d.id,d.quality)),quality:d.quality,affixes:d.affixes,ilvl:d.ilvl,tier:d.tier,...d.src?{src:d.src}:{},isNew:!0});for(const d of e.cards)a.cards[d]=(a.cards[d]??0)+1;return ja(a),SL(e.stage),e.skipped||(FL(a,e),lT(a.pet,e.time,e.eggs??[])),{exp:n,levelsGained:a.level-o,newLevel:a.level,statPoints:So(a.level)-So(o),jobExp:i,jobLevelsGained:a.jobLevel-r,newJobLevel:a.jobLevel,talentPoints:yg(a.jobLevel)-yg(r)}}function Hh(a,e=0){return{uid:N1(),itemId:a,cards:Array.from({length:e},()=>null)}}const m5=/^[\p{L}\p{N} _-]{2,16}$/u;function B1(a,e){const t=a.trim();return m5.test(t)?qk(t,"light")?c("Ese nombre no está permitido."):$a().some(s=>s.id!==e&&s.name.toLowerCase()===t.toLowerCase())?c("Ya existe un personaje con ese nombre."):null:c("El nombre debe tener entre 2 y 16 letras, números, espacios, _ o -.")}function N1(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)}const O1=999,f5={guard:40,flee:50,double:50,speed:12,regen:12,targets:5,proj:5,repeat:5,pierce:5,lifesteal:10};function fm(a){return f5[a]??O1}const g5={speed:3,regen:3,lifesteal:3,targets:10,proj:10,repeat:10,pierce:10},y5=1.08;function v5(a,e){return Math.ceil((g5[a]??1)*(e+1)*y5**e)}const pi=500,Qt=10,av=5,b5=60,w5=120,k5=8,x5=15,M5=30,$5=3,Bc=10,nv=1500,S5={mob:10,mini:400,mvp:2500},E5=.1,ov=3,D1=20,T5=.1,H1=3,C5=.8;function L5(a){const e=ym(a);return Math.round(C5*e.basePerSecond*e.seconds*F1("mob",a))}function iv(a){return Math.min(H1,1+Math.floor(a/D1)*T5)}function A5(a,e){return F1(a,e)*(e>=gm?er(1+q5,e-gm+1):1)}function F1(a,e){return S5[a]*(1+E5*(e-1))}const gm=31,P5=2,j5=.15,_5=.3,q5=.05,_u=4,I5=.25,_a=Se.filter(a=>a.map&&et[a.id]&&!a.storyOnly);function z1(a){return et[_a[a].id].waves.map(t=>t.pool.filter(s=>Be[s]&&!Be[s].boss))}function U1(a){for(let e=a;e>=0;e--){const t=_a[e],s=[...new Set(et[t.id].bosses.map(n=>n.id))].filter(n=>n!==t.mvp.id&&Be[n]);if(s.length)return s}return[]}function ym(a){const e=Math.min(_a.length-1,Math.floor((a-1)/Qt)),t=a-e*Qt,s=_a[e],n=z1(e),o=Math.min(n.length-1,Math.floor((t-1)/Qt*n.length)),i=[...new Set([...n[o-1]??[],...n[o]])],r=U1(e),l=k=>r.length?r[k%r.length]:null,h=(t===Qt?[s.mvp.id]:t===8?r.slice(0,3):t===5?[l(0),l(1)]:t===7?[l(1),l(2)]:t===3?[l(0)]:[]).filter(k=>!!k).map(k=>({id:k,mvp:k===s.mvp.id})),u=t===Qt,p=cr().mob,y=a>=gm,w=p.hp*er(1+p.hpGrowth,a-1)*(y?1+P5:1),m=p.damage*er(1+p.dmgGrowth,a-1)*(y?1+j5:1),f=(k,M)=>9+M*.9+k*.6,v=u?0:Math.max(f(e,t),e?f(e-1,Qt-1):0),x=k=>i.reduce((M,$)=>M+k($),0)/Math.max(1,i.length);return{n:a,block:e,local:t,stage:s,pool:i,perSecond:v*(y?1+_5:1),basePerSecond:v,hp:w/Math.max(1,x(k=>Be[k].hp)),damage:m/Math.max(1,x(k=>Be[k].damage)),mobHp:w,mobDmg:m,bosses:h,minis:r,mvp:u,seconds:u?w5:b5}}const R5={mob:{hp:1500,hpGrowth:.055,damage:16,dmgGrowth:.022},mini:{hp:50,damage:1.6},mvp:{hp:300,damage:2.2,speed:1.15}},cr=r$("endless-tune",()=>structuredClone(R5));function oh(a){return!!a.promotion}const is=a=>`${Math.round(a*1e4)/100}%`.replace(".",","),B5=[{id:"dmg",name:"Daño"},{id:"pace",name:"Ritmo de ataque"},{id:"reach",name:"Alcance y objetivos"},{id:"survive",name:"Supervivencia"}],ih=[{id:"damage",group:"dmg",name:"Daño",per:a=>c("+ {
    v
  }
   de daño",{v:is(.15*a)}),apply:(a,e)=>a.damageMult*=1+.15*e},{id:"crit",group:"dmg",name:"Crítico",per:a=>c("+ {
    v
  }
   de probabilidad de crítico",{v:is(.01*a)}),apply:(a,e)=>a.critChance+=.01*e},{id:"critDmg",group:"dmg",name:"Daño crítico",per:a=>c("+ {
    v
  }
   de daño crítico",{v:is(.25*a)}),apply:(a,e)=>a.critMult+=.25*e},{id:"boss",group:"dmg",name:"Daño a jefes y élites",per:a=>c("+ {
    v
  }
   de daño a jefes y élites",{v:is(.1*a)}),apply:(a,e)=>a.bossEliteMult+=.1*e},{id:"dot",group:"dmg",name:"Daño en el tiempo",per:a=>c("+ {
    v
  }
   de daño en el tiempo",{v:is(.3*a)}),apply:(a,e)=>a.dotDmg+=.3*e},{id:"haste",group:"pace",name:"Celeridad",per:a=>c("+ {
    v
  }
   de Celeridad",{v:2*a}),apply:(a,e)=>a.haste+=.02*e},{id:"cast",group:"pace",name:"Rapidez de casteo",per:a=>c("+ {
    v
  }
   de rapidez de casteo",{v:2*a}),apply:(a,e)=>a.castHaste+=.02*e},{id:"double",group:"pace",name:"Doble casteo",per:a=>c("+ {
    v
  }
   de probabilidad de doble casteo",{v:is(.02*a)}),apply:(a,e)=>a.doubleChance+=.02*e},{id:"area",group:"reach",name:"Área",per:a=>c("+ {
    v
  }
   de área",{v:is(.15*a)}),apply:(a,e)=>a.areaMult*=1+.15*e},{id:"reach",group:"reach",name:"Alcance cuerpo a cuerpo",per:a=>c("+ {
    v
  }
   de alcance cuerpo a cuerpo",{v:is(.1*a)}),apply:(a,e)=>a.reachMult+=.1*e},{id:"targets",group:"reach",name:"Objetivos",per:a=>c("+ {
    v
  }
   objetivos",{v:a}),apply:(a,e)=>a.ext.towerTargets=e},{id:"proj",group:"reach",name:"Proyectiles",per:a=>c("+ {
    v
  }
   proyectiles",{v:a}),apply:(a,e)=>a.ext.towerProj=e},{id:"repeat",group:"reach",name:"Repeticiones",per:a=>c("+ {
    v
  }
   repeticiones",{v:a}),apply:(a,e)=>a.ext.towerRepeat=e},{id:"pierce",group:"reach",name:"Penetración",per:a=>c("+ {
    v
  }
   de penetración",{v:is(.1*a)}),apply:(a,e)=>a.ext.towerPierce=.1*e},{id:"hp",group:"survive",name:"Vida máxima",per:a=>c("+ {
    v
  }
   de vida máxima",{v:is(.1*a)}),apply:(a,e)=>a.maxHp*=1+.1*e},{id:"guard",group:"survive",name:"Aguante",per:a=>c("- {
    v
  }
   de daño recibido",{v:is(.015*a)}),apply:(a,e)=>a.damageReduction+=.015*e},{id:"flee",group:"survive",name:"Esquiva",per:a=>c("+ {
    v
  }
   de esquiva",{v:is(.01*a)}),apply:(a,e)=>a.flee+=.01*e},{id:"regen",group:"survive",name:"Regeneración",per:a=>c("+ {
    v
  }
   HP/s",{v:(.5*a).toFixed(1).replace(".",",")}),apply:(a,e)=>a.regen+=.5*e},{id:"lifesteal",group:"survive",name:"Robo de vida",per:a=>c("+ {
    v
  }
   de robo de vida",{v:is(1e-4*a)}),apply:(a,e)=>a.lifesteal+=1e-4*e},{id:"speed",group:"survive",name:"Velocidad",per:a=>c("+ {
    v
  }
   de velocidad",{v:is(.04*a)}),apply:(a,e)=>a.speedMult*=1+.04*e}];function rv(a,e){return v5(a.id,e)}function N5(a){const e=(a-1)%Qt+1;return 1+Math.floor((a-1)/Qt)+(e===5?1:e===10?3:0)}function ga(a){const e=a.endless??{};return{reached:e.reached??1,best:e.best??0,earned:e.earned??0,spent:e.spent??0,ups:{...e.ups??{}},skills:[...e.skills??[]]}}function kl(a,e){const t=ze(a);if(!t)return null;const s=ga(t);return e(s),t.endless=s,ja(t),s}function G1(a){const e=a.mvpsDefeated??[];let t=0;for(const s of _a){if(!zd(e,s.mvp.id))break;t++}return t}function rh(a){return oh(a)?G1(a)*Qt:0}function Nc(a){return a.earned-a.spent}function O5(a,e){for(const t of ih){const s=Math.max(0,Math.min(fm(t.id),Math.floor(e[t.id]??0)));s>0&&t.apply(a,s)}}function V1(a){const e=new Set;for(const o of a){const i=Math.min(_a.length-1,Math.max(0,o));z1(i).flat().forEach(r=>e.add(r)),U1(i).forEach(r=>e.add(r)),e.add(_a[i].mvp.id)}const t=new Set,s=new Set,n=(o,i)=>{if(typeof o=="string")!t.has(o)&&se.manifest.sprites[o]&&(t.add(o),Be[o]&&n(Be[o],0));else if(o&&typeof o=="object"&&i<6&&!s.has(o)){s.add(o);for(const r of Object.values(o))n(r,i+1)}};for(const o of e)n(o,0);return t}class D5{constructor(e,t,s,n){g(this,"wave");g(this,"state","intro");g(this,"left",_u);g(this,"acc",0);g(this,"nextSummon",0);g(this,"bossesIn",0);g(this,"bossList",[]);g(this,"warned",!1);g(this,"counted",new WeakMap);g(this,"points",0);g(this,"score",0);g(this,"waveScore",0);g(this,"quota",0);g(this,"failed",null);g(this,"combo",0);g(this,"bestCombo",0);g(this,"comboLeft",0);g(this,"offer",null);g(this,"picks",[]);g(this,"scripted",null);g(this,"scriptedAt",0);g(this,"autoPicks",!1);g(this,"hurtMult",1);g(this,"cdMult",1);g(this,"floorTick",0);g(this,"themePending",-1);g(this,"comboEl");g(this,"shownCombo",0);g(this,"shownTier",0);g(this,"breakUntil",0);g(this,"cleared",0);g(this,"lastClearTick",0);g(this,"hud");g(this,"hudRows",0);g(this,"drawQueued",0);g(this,"drawNow",()=>{this.drawQueued=0,this.draw()});g(this,"speedText","");g(this,"speedOn",!1);g(this,"onSpeed",null);g(this,"theme",-1);g(this,"sheets",new Set);var i;this.g=e,this.startWave=t,this.lastWave=s,this.hooks=n,this.wave=ym(t),this.hud=document.createElement("div"),this.hud.id="endless-hud",document.body.appendChild(this.hud),this.hud.addEventListener("pointerdown",r=>{var l,d,h;(d=(l=r.target).closest)!=null&&d.call(l,".eh-speed")&&(r.preventDefault(),r.stopPropagation(),(h=this.onSpeed)==null||h.call(this))}),(i=document.getElementById("timer-box"))==null||i.classList.add("hidden"),this.comboEl=document.createElement("div"),this.comboEl.id="endless-combo",this.comboEl.innerHTML=`<span class="ec-label">${c("Combo")}</span><b class="ec-num"></b><span class="ec-mult"></span><span class="ec-bar"><i></i></span>`,document.body.appendChild(this.comboEl),this.setTheme(this.wave.block,1.6);const o=e.towerDeitySkills();o.length?this.offerPick({kind:"deity",skills:o}):this.offerCard()}destroy(){var e;this.drawQueued&&cancelAnimationFrame(this.drawQueued),this.drawQueued=0,this.hud.remove(),document.documentElement.style.removeProperty("--eh-h"),(e=document.getElementById("timer-box"))==null||e.classList.remove("hidden"),this.comboEl.remove()}offerPick(e){var t,s;this.offer=e,this.state="pick",this.floorTick=this.g.ticks,this.render(),(s=(t=this.hooks).onPick)==null||s.call(t,this)}offerCard(e=0){const t=this.g.towerCards(e);t.length?this.offerPick({kind:"card",cards:t}):this.afterPick()}choose(e){var s,n,o,i;const t=this.offer;return this.state!=="pick"||!t||!Number.isInteger(e)||e<0?!1:t.kind==="deity"?e>=t.skills.length?!1:(this.picks.push(this.g.ticks,e),this.offer=null,this.g.setTowerDeity(t.skills[e]),this.offerCard(),(n=(s=this.hooks).onPick)==null||n.call(s,this),!0):e>=t.cards.length?!1:(this.picks.push(this.g.ticks,e),this.offer=null,this.g.applyTowerCard(t.cards[e]),this.afterPick(),(i=(o=this.hooks).onPick)==null||i.call(o,this),!0)}afterPick(){this.themePending>=0&&(this.setTheme(this.themePending,2.6),this.themePending=-1),this.state=this.cleared||this.wave.n>this.startWave?"rest":"intro",this.left=this.state==="intro"?_u:av,this.floorTick=this.g.ticks,this.render()}beforeTick(){if(this.state!=="pick")return;const e=this.scripted;if(e&&this.scriptedAt+1<e.length)for(;this.scriptedAt+1<e.length&&e[this.scriptedAt]<=this.g.ticks&&this.state==="pick";)this.choose(e[this.scriptedAt+1]),this.scriptedAt+=2;else if(this.autoPicks)for(;this.state==="pick";)this.choose(0)}resumeTick(){return this.state==="pick"?this.g.ticks:this.floorTick}swapSheets(e,t){var n;if(Tp)return;const s=V1(t?[e,e+1]:[e]);for(const o of this.g.enemies)o.dead||s.add(o.def.id);for(const o of this.sheets)s.has(o)||((n=se.sheets.get(o))==null||n.unload(),this.sheets.delete(o));for(const o of s)this.sheets.add(o);se.loadSheets(s)}setTheme(e,t){var o;if(e===this.theme)return;this.theme=e;const s=_a[e],n=(o=this.g.map.themes.find(i=>i.id===s.id))==null?void 0:o.cells;n&&this.g.world3d.setGroundTheme(n,this.g.player.x,this.g.player.y,t,F5[s.id]??11075528),this.g.world3d.setArenaTheme(s.id),this.swapSheets(e,!1),this.g.world3d.setGroundLight(H5[s.id]??16777215),this.g.setStageMood(s.id),B.music("endless"),t>.1&&B.play("ef_portal",.6)}update(e){if(this.state==="done")return;if(this.combo>0&&(this.comboLeft-=e,this.comboLeft<=0&&(this.combo=0)),this.state==="pick"){this.render();return}if(this.state==="intro"||this.state==="rest"){this.left-=e,this.left<=0&&this.startWave_(),this.render();return}const t=this.wave;if(this.bossesIn<t.bosses.length&&this.left<=t.seconds-1.5){const o=t.bosses[this.bossesIn],i=this.bossesIn/t.bosses.length*Math.PI*2+le()*.5,r=o.mvp?cr().mvp:cr().mini,l=this.g.endlessBoss(o.id,i,o.mvp,t.mobHp*r.hp,t.mobDmg*r.damage);l&&(this.counted.set(l,o.mvp?"mvp":"mini"),this.bossList.push(l),this.bossesIn++)}if(this.left-=e,t.mvp&&t.seconds-this.left>=this.nextSummon){this.nextSummon+=x5;const o=this.bossList.find(i=>!i.dead&&i.def.boss==="mvp");o&&(o.setState("attack"),this.summon(zE(o.def.id)??t.pool[Math.floor(le()*t.pool.length)],o.x,o.y,M5,170),B.play("mc_loud",.4))}this.acc+=e*t.perSecond;let s=-1;for(;this.acc>=1&&(s<0&&(s=this.g.enemies.reduce((r,l)=>r+(l.dead?0:1),0)),!(s>=nv));){this.acc-=1;const o=t.pool[Math.floor(le()*t.pool.length)],i=this.g.endlessMob(o,t.hp,t.damage);if(!i)break;s++,this.counted.set(i,"mob")}this.acc>3&&(this.acc=3);const n=this.bossesIn<t.bosses.length||this.bossList.some(o=>!o.dead);!this.warned&&this.left<=Bc&&(n||this.waveScore<this.quota)&&(this.warned=!0,this.g.events.onAnnounce(n?c("¡ {
    s
  }
   s para matar a los jefes!",{s:Bc}):c("¡ {
    s
  }
   s para llegar a los puntos del piso!",{s:Bc}))),t.mvp&&!n?this.clearWave():this.left<=0&&(n?this.failFloor("boss"):this.waveScore<this.quota?this.failFloor("quota"):this.clearWave()),this.render()}failFloor(e){this.failed=e,this.state="done",this.g.endlessClear(),B.play("mc_loud",.5),this.g.events.onAnnounce(e==="boss"?c("¡Los jefes siguen vivos! Fin de la partida"):c("¡No has llegado a los puntos del piso! Fin de la partida")),this.render(),this.hooks.onComplete()}startWave_(){const e=this.wave;this.state="fight",this.bossesIn=0,this.bossList=[],this.warned=!1,this.acc=0,this.left=e.seconds,this.nextSummon=k5,this.waveScore=0,this.quota=e.mvp?0:L5(e.n),e.n%Qt===Qt-1&&this.swapSheets(e.block,!0),this.hooks.onStart(e.n);const t=e.bosses.find(s=>s.mvp);t&&B.music("boss"),B.play("mc_loud",.5),this.g.events.onAnnounce(t?c("¡Piso  {
    n
  }
  ! ¡MVP  {
    name
  }
   ha aparecido!",{n:e.n,name:Be[t.id].name}):e.bosses.length?c("¡Piso  {
    n
  }
  ! ¡Jefes en camino!",{n:e.n}):c("¡Piso  {
    n
  }
  !",{n:e.n}))}summon(e,t,s,n,o=110){const i=this.wave,r=Be[e];if(!r||this.state!=="fight")return;let l=this.g.enemies.reduce((d,h)=>d+(h.dead?0:1),0);for(let d=0;d<n&&l<nv;d++){const h=d/n*Math.PI*2+le()*.4,u=this.g.endlessMob(e,i.mobHp/Math.max(1,r.hp),i.mobDmg/Math.max(1,r.damage),!1,{x:t+Ie(h)*o,y:s+Le(h)*o});u&&(l++,this.counted.set(u,"mob"))}}onKill(e){const t=this.counted.get(e);if(!t||this.state!=="fight")return;this.counted.delete(e),this.combo++,this.comboLeft=ov,this.combo>this.bestCombo&&(this.bestCombo=this.combo);const s=Math.round(A5(t,this.wave.n)*iv(this.combo));this.score+=s,this.waveScore+=s}clearWave(){var s;const e=this.wave,t=N5(e.n);if(this.points+=t,this.cleared++,this.lastClearTick=this.g.ticks,this.hooks.onCleared(e.n,t),this.g.fadeMobs(),this.g.healPlayer(this.g.stats.maxHp*I5),B.play("ef_blessing",.5),e.n>=this.lastWave){this.state="done",this.g.events.onAnnounce(c("¡Has superado todos los pisos abiertos! + {
    p
  }
   puntos",{p:t})),this.render(),this.hooks.onComplete();return}if(this.wave=ym(e.n+1),this.g.events.onAnnounce(c("¡Piso  {
    n
  }
   superado!",{n:e.n})),this.wave.block!==e.block){this.themePending=this.wave.block;const n=this.g.towerDeityUp();n&&this.g.events.onAnnounce(c("¡ {
    skill
  }
   Deity sube a rango  {
    r
  }
  !",{skill:((s=ce[n])==null?void 0:s.name)??n,r:this.g.towerDeityRank()}))}B.music("endless"),this.offerCard(e.local===5||e.local===Qt?$5:0)}renderCombo(e){const t=this.comboEl,s=this.g.time,n=o=>{t.classList.remove(o),t.offsetWidth,t.classList.add(o)};if(this.combo>=2){const o=Math.min(5,Math.floor((e-1)/.4)+1);if(this.combo!==this.shownCombo){if(t.querySelector(".ec-num").textContent=String(this.combo),t.querySelector(".ec-mult").textContent=`×${e.toFixed(1)}`,n("pop"),this.combo>this.shownCombo&&this.combo%D1===0&&e<=H1){n("burst");const i=document.createElement("span");i.className="ec-fly",i.textContent=`×${e.toFixed(1)}!`,t.appendChild(i),setTimeout(()=>i.remove(),1100)}this.shownCombo=this.combo}o!==this.shownTier&&(t.classList.remove(`t${this.shownTier}`),t.classList.add(`t${o}`),this.shownTier=o),t.classList.remove("broken"),t.classList.add("on"),t.querySelector(".ec-bar i").style.width=`${Math.round(Math.max(0,Math.min(1,this.comboLeft/ov))*100)}%`}else this.shownCombo>=2?(this.shownCombo>=10?(t.querySelector(".ec-num").textContent=c("¡Roto!"),n("broken"),this.breakUntil=s+.9):t.classList.remove("on"),this.shownCombo=0):this.breakUntil&&s>this.breakUntil&&(this.breakUntil=0,t.classList.remove("on","broken"))}render(){Tp||this.drawQueued||(this.drawQueued=requestAnimationFrame(this.drawNow))}refresh(){this.render()}draw(){var M;const e=this.wave,t=Math.ceil(Math.max(0,this.left)),s=`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`,n=new URL(`assets/stages/${e.stage.id}.jpg`,document.baseURI).href,o=this.state==="fight",i=o?e.seconds:this.state==="rest"?av:_u,r=o||this.state==="rest"||this.state==="intro"?Math.max(0,Math.min(1,this.left/i)):0,l=e.bosses.length,d=o||this.state==="done"?this.bossList.filter($=>$.dead).length:0,h=o&&(this.bossesIn<l||this.bossList.some($=>!$.dead)),u=this.waveScore>=this.quota,p=o&&this.left<=Bc&&(h||!u),y=this.state==="pick"?((M=this.offer)==null?void 0:M.kind)==="deity"?c("Elige tu Deity"):c("Elige una carta"):this.state==="done"?this.failed?c("Fin de la partida"):c("¡Torre superada!"):o?s:c("Empieza en  {
    s
  }
  ",{s:t}),w=p?" danger":o?"":" wait",m=o||!!this.failed,f=m&&this.quota>0?`<div class="eh-bar eh-quota$ {
    u?" ok":p?" danger":""
  }
  "><i style="width:$ {
    Math.round(Math.min(1,this.waveScore/this.quota)*1e3)/10
  }
  %"></i><span>${u?"✓ ":""}${c("Puntos  {
    a
  }
   /  {
    b
  }
  ",{a:this.waveScore.toLocaleString(),b:this.quota.toLocaleString()})}</span></div>`:"",v=m&&l?`<div class="eh-bar eh-boss$ {
    d>=l?" ok":p?" danger":""
  }
  "><i style="width:$ {
    Math.round(d/l*1e3)/10
  }
  %"></i><span>${d>=l?"✓ ":"☠ "}${c("Jefes  {
    a
  }
   /  {
    b
  }
  ",{a:d,b:l})}</span></div>`:"",x=iv(this.combo);this.renderCombo(x),this.hud.innerHTML=`<div class="eh-panel">
        <div class="eh-wave" style="--art:url('${n}')"><small>${c("Piso")}</small><b>${e.n}</b><i>${e.stage.name} · ${e.local}/${Qt}</i></div>
        <div class="eh-main">
          <div class="eh-top"><span class="eh-score">${this.score.toLocaleString()}</span>${this.speedText?`<button class="eh-speed$ {
    this.speedOn?" on":""
  }
  " title="$ {
    c("Velocidad (V): solo en los pisos que ya tienes superados")
  }
  ">${this.speedText}</button>`:""}</div>
          <div class="eh-bar$ {
    w
  }
  "><i style="width:$ {
    Math.round(r*1e3)/10
  }
  %"></i><span>${y}</span></div>
          ${f}${v}
        </div>
      </div>`;const k=1+(f?1:0)+(v?1:0);k!==this.hudRows&&(this.hudRows=k,document.documentElement.style.setProperty("--eh-h",`${this.hud.offsetHeight}px`))}}const H5={sewer:13162751,sunken:13156568,byalan:9091327,payon_cave:14203024},F5={prontera:12124058,sewer:8050943,sunken:10139903,byalan:7008511,payon:16765562,payon_cave:16751194},z5=300,U5=.3,mi={clear:{name:"Despejado",weight:32,fog:.3,rain:0,dark:0,wind:.1,lightning:0},cloudy:{name:"Nublado",weight:22,fog:.38,rain:0,dark:.18,wind:.45,lightning:0},fog:{name:"Niebla",weight:12,fog:.8,rain:0,dark:.1,wind:.1,lightning:0},drizzle:{name:"Llovizna",weight:12,fog:.4,rain:.18,dark:.12,wind:.2,lightning:0},rain:{name:"Lluvia",weight:10,fog:.42,rain:.5,dark:.26,wind:.4,lightning:0},heavy:{name:"Lluvia intensa",weight:7,fog:.5,rain:.85,dark:.38,wind:.65,lightning:.3},storm:{name:"Tormenta",weight:5,fog:.62,rain:1.3,dark:.55,wind:1,lightning:1}},qr=[[0,[.44,.5,.8],[.1,.13,.24]],[.18,[.46,.51,.8],[.12,.15,.26]],[.25,[.92,.78,.82],[.78,.66,.7]],[.32,[1,1,1],[.8,.84,.9]],[.68,[1,1,1],[.8,.84,.9]],[.76,[1.05,.76,.56],[.82,.6,.48]],[.84,[.5,.52,.8],[.16,.16,.3]],[1,[.44,.5,.8],[.1,.13,.24]]];function G5(a){for(let e=0;e<qr.length-1;e++){const[t,s,n]=qr[e],[o,i,r]=qr[e+1];if(a>=t&&a<=o){const l=(a-t)/(o-t||1),d=l*l*(3-2*l);return{tint:s.map((h,u)=>h+(i[u]-h)*d),fog:n.map((h,u)=>h+(r[u]-h)*d)}}}return{tint:qr[0][1],fog:qr[0][2]}}function V5(a){const e=Math.min(Math.abs(a-.5),.5);return Math.max(0,Math.min(1,(e-.24)/.1))}function K5(a){return a<.21||a>=.86?c("Noche"):a<.3?c("Amanecer"):a<.45?c("Mañana"):a<.62?c("Mediodía"):a<.73?c("Tarde"):c("Atardecer")}const lv=[{len:.55,speed:.75,width:.9,alpha:.22},{len:.8,speed:.9,width:1,alpha:.32},{len:1,speed:1,width:1.2,alpha:.45}];class cv{constructor(e){g(this,"view",new Je);g(this,"world");g(this,"rainG",new Vo);g(this,"flashG",new Vo);g(this,"time",0);g(this,"weather","clear");g(this,"weatherLeft",90+Math.random()*60);g(this,"cur",{...mi.clear});g(this,"drops",[]);g(this,"splashes",[]);g(this,"flash",0);g(this,"flashSeq",[]);g(this,"nextBolt",8);g(this,"sfxTimer",4);this.world=e,this.view.addChild(this.rainG,this.flashG)}label(){return`${K5(this.phase())} · ${c(mi[this.weather].name)}`}phase(){return(U5+this.time/z5)%1}update(e,t,s){this.time+=e,this.weatherLeft-=e,this.weatherLeft<=0&&(this.weather=this.pickWeather(),this.weatherLeft=80+Math.random()*80);const n=mi[this.weather],o=1-Math.exp(-e/8);for(const f of["fog","rain","dark","wind","lightning"])this.cur[f]+=(n[f]-this.cur[f])*o;const i=this.phase(),r=G5(i),l=V5(i),d=this.cur,h=Math.max(0,1-Math.abs(i-.26)/.06);if(d.lightning>.2&&(this.nextBolt-=e,this.nextBolt<=0)){this.nextBolt=(5+Math.random()*9)/d.lightning,this.flashSeq=[.07,.07,.14];const f=300+Math.random()*900;setTimeout(()=>B.play("ef_thunderstorm",.35,1,"ambient"),f)}this.flashSeq.length&&(this.flashSeq[0]-=e,this.flash=this.flashSeq.length%2===1?1:0,this.flashSeq[0]<=0&&this.flashSeq.shift(),this.flashSeq.length||(this.flash=0));const u=this.world.atmos,p=1-d.dark*.45,y=d.rain*.08;u.envTint.value.set(r.tint[0]*p*(1-y)+this.flash*.9,r.tint[1]*p+this.flash*.9,r.tint[2]*p*(1+y*.5)+this.flash*.9);const w=d.dark*.35;u.fogColor.value.set(r.fog[0]*(1-w)+.5*w*(1-l),r.fog[1]*(1-w)+.52*w*(1-l),r.fog[2]*(1-w)+.58*w*(1-l)),u.fogAmount.value=Math.min(.95,d.fog+h*.3),u.playerLight.value=Math.min(1,l+d.dark*.35),u.atmosTime.value=this.time;const m=255;this.world.renderer.setClearColor((Math.round(u.fogColor.value.x*m)<<16|Math.round(u.fogColor.value.y*m)<<8|Math.round(u.fogColor.value.z*m))>>>0),this.drawRain(e,t,s),this.flashG.clear(),this.flash>0&&this.flashG.rect(0,0,t,s).fill({color:14542591,alpha:.28}),this.sounds(e,l)}pickWeather(){const e=Object.keys(mi).filter(s=>s!==this.weather);let t=Math.random()*e.reduce((s,n)=>s+mi[n].weight,0);for(const s of e)if(t-=mi[s].weight,t<0)return s;return"clear"}rainNow(){const e=this.cur.rain;if(e<=.01)return 0;const t=.82+.18*Math.sin(this.time*.37)+.1*Math.sin(this.time*1.13+1.7);return e*t}drawRain(e,t,s){const n=this.rainNow(),o=Math.round(Math.pow(n,.85)*(t*s)/4e3),i=.12+this.cur.wind*.38;for(;this.drops.length<o;)this.drops.push(this.newDrop(t,s,i,!0));this.drops.length>o&&(this.drops.length=o);const r=.6+n*.8,l=this.rainG;l.clear();for(const h of this.drops)h.y+=h.speed*e,h.x-=h.speed*i*e,(h.y>s||h.x<-60)&&(h.layer===2&&this.splashes.length<15+n*40&&Math.random()<.5&&this.splashes.push({x:h.x,y:Math.min(h.y,s-4),t:0}),Object.assign(h,this.newDrop(t,s,i,!1)));const d=Math.min(1,.55+n*.35);lv.forEach((h,u)=>{let p=!1;for(const y of this.drops)y.layer===u&&(l.moveTo(y.x,y.y).lineTo(y.x+y.len*r*i,y.y-y.len*r),p=!0);p&&l.stroke({width:h.width,color:14673919,alpha:h.alpha*d})}),n>.6&&l.rect(0,0,t,s).fill({color:10135224,alpha:Math.min(.16,(n-.6)*.22)});for(let h=this.splashes.length-1;h>=0;h--){const u=this.splashes[h];if(u.t+=e,u.t>.28){this.splashes.splice(h,1);continue}const p=2+u.t*18;l.ellipse(u.x,u.y,p,p*.35).stroke({width:1,color:14674175,alpha:.25*(1-u.t/.28)})}}newDrop(e,t,s,n){const o=n?Math.random()*t:-Math.random()*60,i=-60+Math.random()*(e+s*t+120),r=Math.random(),l=r<.5?0:r<.83?1:2,d=lv[l];return{x:i-s*Math.max(0,o),y:o,len:(14+Math.random()*16)*d.len,speed:(900+Math.random()*500)*d.speed,layer:l}}sounds(e,t){if(this.sfxTimer-=e,this.sfxTimer>0)return;this.sfxTimer=5+Math.random()*8;const s=this.cur;if(s.wind>.35&&Math.random()<s.wind)B.playAt(`wx_wind${1+Math.floor(Math.random()*3)}`,.15+s.wind*.2,Math.random()*1.4-.7,1,"ambient");else if(t>.6&&Math.random()<.5){const n=s.rain>.3||Math.random()<.5?`wx_frog${1+Math.floor(Math.random()*2)}`:"wx_owl";B.playAt(n,.22,Math.random()*1.4-.7,1,"ambient")}}destroy(){this.view.destroy({children:!0})}}function dv(a){return/_fild\d/.test(a)}const W5={tint:[.2,.245,.265],fog:[.075,.1,.1],void:131843,wisp:5596767,wispAlpha:1,fogAmount:.92,lightRadius:400,lightBoost:5},hv={tint:[.4,.47,.68],fog:[.03,.055,.13],void:66314,wisp:3691658,wispAlpha:.75,fogAmount:.8,lightRadius:360,lightBoost:2.4},uv={tint:[.62,.6,.8],fog:[0,.06,.26],void:1820,wisp:2310298,wispAlpha:.55,fogAmount:.5,lightRadius:360,lightBoost:2.2,fireRadius:200,fireBoost:.9},pv={tint:[1,1,1],fog:[0,.05,.6],void:2640,wisp:2779872,wispAlpha:.45,fogAmount:.7,lightRadius:380,lightBoost:0,noVignette:!0},Y5=480,X5=1.6;function J5(a){const t=document.createElement("canvas");t.width=t.height=512;const s=t.getContext("2d");let n=a;const o=()=>(n=n*1103515245+12345&2147483647)/2147483647;for(let i=0;i<46;i++){const r=o()*512,l=o()*512,d=50+o()*170,h=.06+o()*.12;for(const u of[-512,0,512])for(const p of[-512,0,512]){const y=s.createRadialGradient(r+u,l+p,0,r+u,l+p,d);y.addColorStop(0,`rgba(255,255,255,${h})`),y.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=y,s.fillRect(r+u-d,l+p-d,d*2,d*2)}}return Ea.from(t)}function Q5(){const a=document.createElement("canvas");a.width=a.height=512;const e=a.getContext("2d"),t=e.createRadialGradient(256,256,0,256,256,256);return t.addColorStop(0,"rgba(0,0,0,0)"),t.addColorStop(.2,"rgba(0,0,0,0)"),t.addColorStop(.45,"rgba(0,0,0,0.5)"),t.addColorStop(.72,"rgba(0,0,0,0.86)"),t.addColorStop(1,"rgba(0,0,0,0.94)"),e.fillStyle=t,e.fillRect(0,0,512,512),Ea.from(a)}class Oc{constructor(e,t=W5,s=[]){g(this,"view",new Je);g(this,"world");g(this,"time",0);g(this,"layers",[]);g(this,"vignette");g(this,"tone");g(this,"fires");g(this,"off",!1);this.world=e,this.tone=t,this.fires=s.map((n,o)=>({...n,phase:o*2.399}));for(const[n,o,i,r,l]of[[7,.32,1.6,[9,4],.9],[31,.24,1,[-14,7],1.15]]){const d=new u2({texture:J5(n),width:16,height:16});d.tint=t.wisp,d.alpha=o*t.wispAlpha,d.tileScale.set(i),this.layers.push({sprite:d,speed:r,parallax:l}),this.view.addChild(d)}this.vignette=new Cp(Q5()),this.vignette.anchor.set(.5),this.vignette.visible=!t.noVignette,this.view.addChild(this.vignette),e.renderer.setClearColor(t.void)}setOff(e){if(e===this.off)return;this.off=e,this.view.visible=!e;const t=this.world.atmos;e&&(t.envTint.value.set(1,1,1),t.fogAmount.value=0,t.playerLight.value=0,t.fireLights.value.forEach(s=>s.setW(0))),this.world.renderer.setClearColor(e?727603:this.tone.void)}update(e,t,s,n,o){if(this.off)return;this.time+=e;const i=this.time,r=this.world.atmos,{tint:l,fog:d}=this.tone,h=1+.06*Math.sin(i*.35)+.03*Math.sin(i*1.7);r.envTint.value.set(l[0]*h,l[1]*h,l[2]*h),r.fogColor.value.set(d[0],d[1],d[2]),r.fogAmount.value=this.tone.fogAmount+.05*Math.sin(i*.21);const u=.88+.07*Math.sin(i*9.1)+.05*Math.sin(i*23.7+1.3);r.playerLight.value=u,r.lightRadius.value=this.tone.lightRadius*(.97+.03*Math.sin(i*6.3)),r.lightBoost.value=this.tone.lightBoost,r.atmosTime.value=i;const p=this.fires.map(m=>({f:m,d:Math.hypot(m.x-n,m.y-o)})).sort((m,f)=>m.d-f.d).slice(0,aw);r.fireLights.value.forEach((m,f)=>{const v=p[f];if(!v)return m.setW(0);const x=v.f.phase,k=.86+.08*Math.sin(i*7.3+x)+.06*Math.sin(i*17.9+x*1.7);m.set(v.f.x,v.f.y,(this.tone.fireRadius??Y5)*(.96+.04*Math.sin(i*5.1+x)),(this.tone.fireBoost??X5)*k)});const y=this.world.project(0,0);for(const m of this.layers)m.sprite.width=t,m.sprite.height=s,m.sprite.tilePosition.set(y.x*m.parallax+i*m.speed[0],y.y*m.parallax+i*m.speed[1]);const w=this.world.project(n,o);this.vignette.position.set(w.x,w.y),this.vignette.width=this.vignette.height=Math.max(t,s)*1.7}destroy(){this.view.destroy({children:!0})}}const qs=(a,e)=>({x:a*32,y:e*32}),Z5={tint:[1.1,.93,.72],lights:[{...qs(70,30),r:460,k:.8},{...qs(55.7,37.7),r:420,k:.8},{...qs(84.3,37.7),r:420,k:.8},{...qs(55.7,56.1),r:420,k:.8},{...qs(84.3,56.1),r:420,k:.8},{...qs(66.3,42),r:320,k:.45},{...qs(73.7,42),r:320,k:.45},{...qs(66.4,56.4),r:320,k:.45},{...qs(73.6,56.4),r:320,k:.45},{...qs(61.3,24.9),r:340,k:.55},{...qs(78.7,24.9),r:340,k:.55},{...qs(70,78),r:380,k:.5}],area:{x0:1280,y0:0,x1:3200,y1:3200}},eA=120,Ir=720,Dc=260;function tA(){const a=document.createElement("canvas");a.width=a.height=32;const e=a.getContext("2d"),t=e.createRadialGradient(16,16,0,16,16,16);return t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.35,"rgba(255,255,255,0.45)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,32,32),Ea.from(a)}function sA(){const a=document.createElement("canvas");a.width=a.height=512;const e=a.getContext("2d"),t=e.createRadialGradient(256,256,0,256,256,256);return t.addColorStop(0,"rgba(60,30,8,0)"),t.addColorStop(.45,"rgba(60,30,8,0)"),t.addColorStop(.8,"rgba(50,24,6,0.4)"),t.addColorStop(1,"rgba(36,16,4,0.65)"),e.fillStyle=t,e.fillRect(0,0,512,512),Ea.from(a)}class aA{constructor(e,t){g(this,"view",new Je);g(this,"world");g(this,"tone");g(this,"time",0);g(this,"weight",0);g(this,"motes",[]);g(this,"vignette");g(this,"center",null);this.world=e,this.tone=t,this.vignette=new Cp(sA()),this.vignette.anchor.set(.5),this.view.addChild(this.vignette);const s=tA();for(let n=0;n<eA;n++){const o=new Cp(s);o.anchor.set(.5),o.blendMode="add",o.tint=Math.random()<.5?16769712:16773336,this.view.addChild(o),this.motes.push({s:o,x:0,y:0,h:0,vx:0,vy:0,vh:0,ph:Math.random()*6.28,size:n%8?.55+Math.random()*.45:1.6+Math.random()*.8})}}inside(e,t){const s=this.tone.area;return e>=s.x0&&e<=s.x1&&t>=s.y0&&t<=s.y1}spawn(e,t,s,n){e.x=t+(Math.random()*2-1)*Ir,e.y=s+(Math.random()*2-1)*Ir,e.h=n?10+Math.random()*Dc:10,e.vx=(Math.random()*2-1)*9,e.vy=(Math.random()*2-1)*9,e.vh=3+Math.random()*7}update(e,t,s,n,o){this.time+=e;const i=this.time,r=this.inside(n,o)?1:0;this.weight+=Math.sign(r-this.weight)*Math.min(Math.abs(r-this.weight),e*2);const l=this.weight,d=this.world.atmos,[h,u,p]=this.tone.tint,y=1+.025*Math.sin(i*.5)+.012*Math.sin(i*2.3);d.envTint.value.set((1+(h-1)*l)*y,(1+(u-1)*l)*y,(1+(p-1)*l)*y),d.atmosTime.value=i;const w=this.tone.lights.map((f,v)=>({l:f,i:v,d:Math.hypot(f.x-n,f.y-o)})).sort((f,v)=>f.d-v.d).slice(0,aw);d.fireLights.value.forEach((f,v)=>{const x=w[v];if(!x||l<=0)return f.setW(0);const k=x.i*2.399,M=.9+.06*Math.sin(i*6.1+k)+.04*Math.sin(i*15.3+k*1.7);f.set(x.l.x,x.l.y,x.l.r*(.97+.03*Math.sin(i*4.2+k)),x.l.k*M*l)}),this.vignette.alpha=l,this.vignette.position.set(t/2,s/2),this.vignette.width=t*1.5,this.vignette.height=s*1.5;const m=!this.center||Math.hypot(this.center.x-n,this.center.y-o)>Ir*1.5;this.center={x:n,y:o};for(const f of this.motes){m&&this.spawn(f,n,o,!0),f.x+=(f.vx+6*Math.sin(i*.7+f.ph))*e,f.y+=(f.vy+6*Math.cos(i*.6+f.ph))*e,f.h+=f.vh*e,(f.h>Dc||Math.abs(f.x-n)>Ir||Math.abs(f.y-o)>Ir)&&this.spawn(f,n,o,!(f.h>Dc));const v=this.world.project(f.x,f.y,f.h),x=.35+.65*Math.max(0,Math.sin(i*.9+f.ph*3.1))**3,k=Math.min(1,f.h/40,(Dc-f.h)/60);f.s.position.set(v.x,v.y),f.s.scale.set(f.size),f.s.alpha=Math.min(1,l*x*k)*(f.size>1.4?.2:.9),f.s.visible=f.s.alpha>.01&&v.x>-20&&v.y>-20&&v.x<t+20&&v.y<s+20}}destroy(){this.view.destroy({children:!0})}}const nA=14,ol=64,oA=44,Hc=140,mv=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,iA=`
  uniform float len;
  uniform float halfW;
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    // distancia (px) al borde en lo ancho y en los extremos (redondeados)
    float along = vUv.x * len;
    float across = (vUv.y - 0.5) * 2.0 * halfW;
    float ends = min(along, len - along);
    float r = max(0.0, halfW - ends);
    float d = length(vec2(r, across)) - halfW;
    float inside = 1.0 - smoothstep(-6.0, 0.0, d);
    float rim = exp(-abs(d) / 4.0);
    // ondas de luz que corren a lo largo y un latido suave
    float wave = 0.5 + 0.5 * sin(along / 16.0 - time * 5.0 + across / 22.0);
    float pulse = 0.85 + 0.15 * sin(time * 6.0);
    // destellos que aparecen y se apagan
    vec2 q = vec2(along, across) / 9.0;
    float tw = step(0.93, hash(floor(q) + floor(time * 4.0))) * (1.0 - smoothstep(0.12, 0.42, length(fract(q) - 0.5)));
    vec3 gold = vec3(1.0, 0.8, 0.38);
    vec3 white = vec3(1.0, 0.98, 0.9);
    vec3 col = mix(gold, white, wave * 0.6 + tw * 0.8 + rim * 0.4);
    float a = inside * (0.32 + 0.28 * wave) * pulse + rim * 0.55 + tw * inside * 0.5;
    gl_FragColor = vec4(col * a * alpha, a * alpha);
  }`,rA=`
  uniform float len;
  uniform float halfW;
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  void main() {
    float along = vUv.x * len;
    float h = vUv.y;
    // lenguas de luz: ruido que corre hacia arriba, más alto en unas zonas que en otras
    float n = noise(vec2(along / 12.0, h * 2.2 - time * 1.7)) * 0.65 + noise(vec2(along / 5.0, h * 4.0 - time * 2.6)) * 0.35;
    float reach = 0.35 + 0.65 * noise(vec2(along / 30.0, time * 0.6));
    float flame = smoothstep(h * 1.15 - 0.15, h * 1.15 + 0.25, n * reach + (1.0 - h) * 0.45);
    // se apaga hacia arriba y en las puntas del rastro
    float fade = pow(1.0 - h, 1.6) * smoothstep(0.0, halfW, min(along, len - along));
    vec3 col = mix(vec3(1.0, 0.7, 0.24), vec3(1.0, 0.97, 0.86), flame * (1.0 - h) * 0.8);
    float a = min(1.0, flame * 1.15 + 0.2) * fade;
    gl_FragColor = vec4(col * a * alpha, a * alpha);
  }`,lA=`
  attribute float size;
  attribute float bright;
  uniform float viewH;
  varying float vBright;
  void main() {
    vBright = bright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * projectionMatrix[1][1] * viewH * 0.5 / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`,cA=`
  uniform float alpha;
  varying float vBright;
  void main() {
    // núcleo blanco nítido y halo dorado alrededor
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.32, r);
    float halo = 1.0 - smoothstep(0.15, 1.0, r);
    float a = min(1.0, core + halo * 0.65) * vBright * alpha;
    vec3 col = mix(vec3(1.0, 0.74, 0.28), vec3(1.0, 1.0, 0.95), core);
    gl_FragColor = vec4(col * a, a);
  }`,qu={transparent:!0,depthWrite:!1,blending:Eh,blendSrc:Sh,blendDst:$h};class dA{constructor(e,t,s,n){g(this,"mesh");g(this,"geo");g(this,"mat");g(this,"crest");g(this,"crestGeo");g(this,"crestMat");g(this,"points");g(this,"sparkGeo");g(this,"sparkMat");g(this,"sparks",[]);g(this,"spawnAcc",0);g(this,"g");g(this,"x0");g(this,"y0");g(this,"x1");g(this,"y1");g(this,"halfW");this.g=e,this.x0=this.x1=t,this.y0=this.y1=s,this.halfW=n;const o=ol+1;this.geo=new Nn,this.geo.setAttribute("position",new Bs(new Float32Array(o*2*3),3)),this.geo.setAttribute("uv",new Bs(new Float32Array(o*2*2),2)),this.geo.setIndex(Iu(0)),this.mat=new ys({vertexShader:mv,fragmentShader:iA,uniforms:{len:{value:1},halfW:{value:n},time:{value:Math.random()*5},alpha:{value:0}},...qu,side:ba,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),this.mesh=new vs(this.geo,this.mat),this.mesh.frustumCulled=!1,this.mesh.renderOrder=1,this.crestGeo=new Nn,this.crestGeo.setAttribute("position",new Bs(new Float32Array(o*4*3),3)),this.crestGeo.setAttribute("uv",new Bs(new Float32Array(o*4*2),2)),this.crestMat=new ys({vertexShader:mv,fragmentShader:rA,uniforms:{len:{value:1},halfW:{value:n},time:{value:Math.random()*5},alpha:{value:0}},...qu,side:ba}),this.crest=new vs(this.crestGeo,this.crestMat),this.crest.frustumCulled=!1,this.crest.renderOrder=6,this.sparkGeo=new Nn,this.sparkGeo.setAttribute("position",new Bs(new Float32Array(Hc*3),3)),this.sparkGeo.setAttribute("size",new Bs(new Float32Array(Hc),1)),this.sparkGeo.setAttribute("bright",new Bs(new Float32Array(Hc),1)),this.sparkMat=new ys({vertexShader:lA,fragmentShader:cA,uniforms:{viewH:{value:window.innerHeight},alpha:{value:0}},...qu}),this.points=new Xi(this.sparkGeo,this.sparkMat),this.points.frustumCulled=!1,this.points.renderOrder=7,e.world3d.scene.add(this.mesh,this.crest,this.points),this.build()}get length(){return Math.hypot(this.x1-this.x0,this.y1-this.y0)}extend(e,t){this.x1=e,this.y1=t,this.build()}distance(e,t){const s=this.x1-this.x0,n=this.y1-this.y0,o=s*s+n*n||1,i=Math.max(0,Math.min(1,((e-this.x0)*s+(t-this.y0)*n)/o));return Math.hypot(e-(this.x0+s*i),t-(this.y0+n*i))}build(){const e=Math.max(1,this.length),t=this.halfW,s=(this.x1-this.x0)/e,n=(this.y1-this.y0)/e,o=e+t*2,i=Math.min(ol,Math.max(1,Math.ceil(o/nA))),r=this.geo.attributes.position,l=this.geo.attributes.uv,d=this.crestGeo.attributes.position,h=this.crestGeo.attributes.uv,u=ol+1;for(let p=0;p<=ol;p++){const y=Math.min(p,i)/i,w=this.x0+s*(y*o-t),m=this.y0+n*(y*o-t),f=Math.min(p,i)/i,v=this.x0+s*f*e,x=this.y0+n*f*e;for(const k of[0,1]){const M=k?1:-1,$=w-n*this.halfW*M,P=m+s*this.halfW*M;r.setXYZ(p*2+k,$,this.g.world3d.heightAt($,P)+1.5,P),l.setXY(p*2+k,y,k);const q=v-n*this.halfW*M*.92,R=x+s*this.halfW*M*.92,L=this.g.world3d.heightAt(q,R),j=k*u*2+p*2;d.setXYZ(j,q,L,R),d.setXYZ(j+1,q,L+oA,R),h.setXY(j,f,0),h.setXY(j+1,f,1)}}r.needsUpdate=!0,l.needsUpdate=!0,d.needsUpdate=!0,h.needsUpdate=!0,this.geo.setDrawRange(0,i*6),this.crestGeo.setIndex([...Iu(0,i),...Iu(u*2,i)]),this.mat.uniforms.len.value=o,this.crestMat.uniforms.len.value=e}update(e,t){this.mat.uniforms.time.value+=e,this.mat.uniforms.alpha.value=t,this.crestMat.uniforms.time.value+=e,this.crestMat.uniforms.alpha.value=t,this.sparkMat.uniforms.alpha.value=t,this.sparkMat.uniforms.viewH.value=window.innerHeight,this.updateSparks(e,t)}updateSparks(e,t){const s=this.length;if(t>.2){this.spawnAcc+=e*Math.min(110,s*this.halfW*2/350);const r=(this.x1-this.x0)/(s||1),l=(this.y1-this.y0)/(s||1);for(;this.spawnAcc>=1&&this.sparks.length<Hc;){this.spawnAcc-=1;const d=Math.random()*s,h=(Math.random()*2-1)*this.halfW*.9;this.sparks.push({x:this.x0+r*d-l*h,y:this.y0+l*d+r*h,h:2,vx:(Math.random()-.5)*10,vy:(Math.random()-.5)*10,vh:28+Math.random()*40,life:0,max:.9+Math.random()*.9,size:10+Math.random()*9})}this.spawnAcc>1&&(this.spawnAcc=1)}const n=this.sparkGeo.attributes.position,o=this.sparkGeo.attributes.size,i=this.sparkGeo.attributes.bright;for(let r=this.sparks.length-1;r>=0;r--){const l=this.sparks[r];if(l.life+=e,l.life>=l.max){this.sparks.splice(r,1);continue}l.x+=(l.vx+Math.sin(l.life*6+r)*8)*e,l.y+=l.vy*e,l.h+=l.vh*e}this.sparks.forEach((r,l)=>{const d=r.life/r.max;n.setXYZ(l,r.x,this.g.world3d.heightAt(r.x,r.y)+r.h,r.y),o.setX(l,r.size*(1-d*.5)),i.setX(l,Math.min(1,d*6)*(1-d))}),n.needsUpdate=!0,o.needsUpdate=!0,i.needsUpdate=!0,this.sparkGeo.setDrawRange(0,this.sparks.length)}dispose(){this.g.world3d.scene.remove(this.mesh,this.crest,this.points),this.geo.dispose(),this.mat.dispose(),this.crestGeo.dispose(),this.crestMat.dispose(),this.sparkGeo.dispose(),this.sparkMat.dispose()}}function Iu(a,e=ol){const t=[];for(let s=0;s<e;s++){const n=a+s*2;t.push(n,n+1,n+2,n+1,n+3,n+2)}return t}const Ha=72,hA=54,uA=26,Fc=160,pA=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,K1=`
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 fire(float k) {
    // de rojo oscuro a naranja y a amarillo pálido
    vec3 a = vec3(0.55, 0.06, 0.02);
    vec3 b = vec3(1.0, 0.42, 0.08);
    vec3 c = vec3(1.0, 0.86, 0.45);
    return k < 0.5 ? mix(a, b, k * 2.0) : mix(b, c, (k - 0.5) * 2.0);
  }`,mA=`
  uniform float around;
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  ${K1}
  void main() {
    float u = vUv.x * around;
    float v = vUv.y;
    // llamas que se retuercen a lo largo del anillo y se abren hacia fuera
    float n = noise(vec2(u / 14.0 + time * 0.8, v * 3.0 - time * 1.6)) * 0.6 + noise(vec2(u / 6.0 - time * 1.3, v * 6.0 - time * 2.4)) * 0.4;
    float band = sin(v * 3.14159);
    float k = clamp(n * 1.25 * band + band * 0.25, 0.0, 1.0);
    float a = smoothstep(0.12, 0.6, k) * band;
    vec3 col = fire(k);
    gl_FragColor = vec4(col * a * alpha, a * alpha);
  }`,fv=`
  uniform float around;
  uniform float time;
  uniform float alpha;
  varying vec2 vUv;
  ${K1}
  void main() {
    float u = vUv.x * around;
    float h = vUv.y;
    // lenguas de fuego que suben y cambian de altura a lo largo de la vuelta
    float n = noise(vec2(u / 10.0, h * 2.5 - time * 2.2)) * 0.65 + noise(vec2(u / 4.0, h * 5.0 - time * 3.4)) * 0.35;
    float reach = 0.4 + 0.6 * noise(vec2(u / 26.0, time * 0.9));
    float flame = smoothstep(h * 1.2 - 0.12, h * 1.2 + 0.25, n * reach + (1.0 - h) * 0.5);
    float k = flame * (1.0 - h * 0.7);
    float a = min(1.0, flame * 1.2) * pow(1.0 - h, 1.3);
    gl_FragColor = vec4(fire(k) * a * alpha, a * alpha);
  }`,fA=`
  attribute float size;
  attribute float bright;
  uniform float viewH;
  varying float vBright;
  void main() {
    vBright = bright;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * projectionMatrix[1][1] * viewH * 0.5 / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`,gA=`
  uniform float alpha;
  varying float vBright;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.3, r);
    float halo = 1.0 - smoothstep(0.15, 1.0, r);
    float a = min(1.0, core + halo * 0.6) * vBright * alpha;
    vec3 col = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.9, 0.55), core);
    gl_FragColor = vec4(col * a, a);
  }`,gv={transparent:!0,depthWrite:!1,blending:Eh,blendSrc:Sh,blendDst:$h};class yA{constructor(e,t,s,n,o){g(this,"group",new Gn);g(this,"mats",[]);g(this,"emberGeo");g(this,"emberMat");g(this,"embers",[]);g(this,"spawnAcc",0);g(this,"g");g(this,"x");g(this,"y");g(this,"r0");g(this,"r1");this.g=e,this.x=t,this.y=s,this.r0=n,this.r1=o;const i=2*Math.PI*o,r=this.mesh(this.groundGeometry(),mA,i,!0);r.renderOrder=1;const l=this.mesh(this.crestGeometry(o,hA),fv,i,!1),d=this.mesh(this.crestGeometry(n,uA),fv,2*Math.PI*n,!1);l.renderOrder=d.renderOrder=6,this.group.add(r,l,d),this.emberGeo=new Nn,this.emberGeo.setAttribute("position",new Bs(new Float32Array(Fc*3),3)),this.emberGeo.setAttribute("size",new Bs(new Float32Array(Fc),1)),this.emberGeo.setAttribute("bright",new Bs(new Float32Array(Fc),1)),this.emberMat=new ys({vertexShader:fA,fragmentShader:gA,uniforms:{viewH:{value:window.innerHeight},alpha:{value:0}},...gv});const h=new Xi(this.emberGeo,this.emberMat);h.frustumCulled=!1,h.renderOrder=7,this.group.add(h),e.world3d.scene.add(this.group)}mesh(e,t,s,n){const o=new ys({vertexShader:pA,fragmentShader:t,uniforms:{around:{value:s},time:{value:Math.random()*5},alpha:{value:0}},...gv,side:ba,...n?{polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-3}:{}});this.mats.push(o);const i=new vs(e,o);return i.frustumCulled=!1,i}groundGeometry(){const e=[],t=[],s=[];for(let n=0;n<=Ha;n++){const o=n/Ha*Math.PI*2;for(const[i,r]of[this.r0,this.r1].entries()){const l=this.x+Math.cos(o)*r,d=this.y+Math.sin(o)*r;e.push(l,this.g.world3d.heightAt(l,d)+1.5,d),t.push(n/Ha,i)}n<Ha&&s.push(n*2,n*2+1,n*2+2,n*2+1,n*2+3,n*2+2)}return this.geometry(e,t,s)}crestGeometry(e,t){const s=[],n=[],o=[];for(let i=0;i<=Ha;i++){const r=i/Ha*Math.PI*2,l=this.x+Math.cos(r)*e,d=this.y+Math.sin(r)*e,h=this.g.world3d.heightAt(l,d);s.push(l,h,d,l,h+t,d),n.push(i/Ha,0,i/Ha,1),i<Ha&&o.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2)}return this.geometry(s,n,o)}geometry(e,t,s){const n=new Nn;return n.setAttribute("position",new Yi(e,3)),n.setAttribute("uv",new Yi(t,2)),n.setIndex(s),n}contains(e,t,s=0){const n=Math.hypot(e-this.x,t-this.y);return n>=this.r0-s&&n<=this.r1+s}update(e,t){for(const s of this.mats)s.uniforms.time.value+=e,s.uniforms.alpha.value=t;this.emberMat.uniforms.alpha.value=t,this.emberMat.uniforms.viewH.value=window.innerHeight,this.updateEmbers(e,t)}updateEmbers(e,t){if(t>.2){for(this.spawnAcc+=e*Math.min(120,2*Math.PI*this.r1*(this.r1-this.r0)/260);this.spawnAcc>=1&&this.embers.length<Fc;)this.spawnAcc-=1,this.embers.push({a:Math.random()*Math.PI*2,r:this.r0+Math.random()*(this.r1-this.r0),h:4,vh:50+Math.random()*70,drift:(Math.random()-.5)*.6,life:0,max:.6+Math.random()*.7,size:7+Math.random()*8});this.spawnAcc>1&&(this.spawnAcc=1)}const s=this.emberGeo.attributes.position,n=this.emberGeo.attributes.size,o=this.emberGeo.attributes.bright;for(let i=this.embers.length-1;i>=0;i--){const r=this.embers[i];if(r.life+=e,r.life>=r.max){this.embers.splice(i,1);continue}r.h+=r.vh*e,r.a+=r.drift*e}this.embers.forEach((i,r)=>{const l=i.life/i.max,d=this.x+Math.cos(i.a)*i.r,h=this.y+Math.sin(i.a)*i.r;s.setXYZ(r,d,this.g.world3d.heightAt(d,h)+i.h,h),n.setX(r,i.size*(1-l*.6)),o.setX(r,Math.min(1,l*8)*(1-l)*(.7+.3*Math.sin(i.life*40+r)))}),s.needsUpdate=!0,n.needsUpdate=!0,o.needsUpdate=!0,this.emberGeo.setDrawRange(0,this.embers.length)}dispose(){this.g.world3d.scene.remove(this.group),this.group.traverse(e=>{(e instanceof vs||e instanceof Xi)&&e.geometry.dispose()});for(const e of this.mats)e.dispose();this.emberMat.dispose()}}const vA=60,bA=1.85,wA=`
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`,kA=`
  uniform float time;
  uniform float alpha;
  uniform float integrity;
  uniform float flash;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // vector del punto al centro de su hexágono
  vec2 hexOffset(vec2 p) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    return dot(a, a) < dot(b, b) ? a : b;
  }
  void main() {
    vec2 p = vec2(vUv.x * 14.0, vUv.y * 5.0);
    vec2 off = hexOffset(p);
    vec2 ao = abs(off);
    // distancia al borde del hexágono (0 en el borde)
    float d = 0.5 - max(dot(ao, normalize(vec2(1.0, 1.7320508))), ao.x);
    float line = 1.0 - smoothstep(0.04, 0.13, d);
    // celdas rotas: se apagan más cuanto menos aguanta la cúpula
    float id = hash(floor((p - off) * 10.0 + 0.5));
    float broken = step(id, (1.0 - integrity) * 0.85);
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.2);
    // barrido de luz que sube y un latido
    float sweep = 1.0 - smoothstep(0.0, 0.08, abs(fract(vUv.y * 0.8 - time * 0.5) - 0.5));
    float pulse = 0.85 + 0.15 * sin(time * 4.0);
    vec3 gold = vec3(1.0, 0.8, 0.36);
    vec3 col = gold * (0.35 + 0.65 * line) + vec3(1.0, 0.96, 0.8) * (fres * 0.6 + sweep * 0.25 * line);
    float a = (0.18 * (1.0 - broken) + line * (1.0 - broken * 0.75) + fres * 0.6) * pulse;
    // grietas rojizas en los bordes de las celdas rotas
    col = mix(col, vec3(1.0, 0.45, 0.2), broken * line * 0.7);
    col += vec3(1.0) * flash * 0.8;
    a = min(1.0, a + flash * 0.35);
    // la base se funde con el suelo
    a *= smoothstep(0.0, 0.12, vUv.y);
    gl_FragColor = vec4(col * a * alpha, a * alpha);
  }`;class xA{constructor(e){g(this,"mesh");g(this,"mat");g(this,"g");g(this,"flash",0);this.g=e;const t=new _m(vA,40,14,0,Math.PI*2,0,Math.PI/2);this.mat=new ys({vertexShader:wA,fragmentShader:kA,uniforms:{time:{value:0},alpha:{value:0},integrity:{value:1},flash:{value:0}},transparent:!0,depthWrite:!1,blending:Eh,blendSrc:Sh,blendDst:$h,side:ba}),this.mesh=new vs(t,this.mat),this.mesh.scale.y=bA,this.mesh.frustumCulled=!1,this.mesh.renderOrder=6,e.world3d.scene.add(this.mesh)}hit(){this.flash=1}update(e,t,s,n,o){this.flash=Math.max(0,this.flash-s*5);const i=this.mat.uniforms;i.time.value+=s,i.alpha.value=n,i.integrity.value=o,i.flash.value=this.flash,this.mesh.position.set(e,this.g.world3d.heightAt(e,t),t)}dispose(){this.g.world3d.scene.remove(this.mesh),this.mesh.geometry.dispose(),this.mat.dispose()}}const fi=5,zc=56,Ru=90,MA=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,$A=`
  uniform float time;
  uniform float alpha;
  uniform float radius;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float r = vUv.y;
    float a = vUv.x * 6.2831853;
    float px = r * radius;
    // aros: el de fuera (doble), uno de runas y uno interior
    float ring = 1.0 - smoothstep(0.0, 2.2, abs(px - radius * 0.97));
    ring += 1.0 - smoothstep(0.0, 1.4, abs(px - radius * 0.9));
    ring += 1.0 - smoothstep(0.0, 1.4, abs(px - radius * 0.55));
    // runas: trazos cortos a lo largo de la franja entre 0,62 y 0,85 que giran despacio
    float ra = a + time * 0.35;
    float slot = floor(ra / 6.2831853 * 28.0);
    float local = fract(ra / 6.2831853 * 28.0);
    float h = hash(slot * 7.13);
    float band = step(0.64, r) * step(r, 0.84);
    float rv = (r - 0.64) / 0.2;
    float glyph = band * step(0.25, local) * step(local, 0.75) * step(abs(rv - 0.5), 0.35 + 0.15 * h)
      * (step(h, 0.5) * step(abs(local - 0.5), 0.07) + step(0.3, h) * step(abs(rv - (0.3 + 0.4 * h)), 0.08));
    // ondas de vida que salen del centro cada 2 s
    float wave = fract(time * 0.5);
    float pulse = (1.0 - smoothstep(0.0, 0.05, abs(r - wave))) * (1.0 - wave);
    // luz suave de dentro
    float inner = (1.0 - r) * 0.18;
    float k = min(1.0, ring * 0.9 + glyph + pulse * 0.8 + inner);
    vec3 green = vec3(0.45, 1.0, 0.55);
    vec3 gold = vec3(1.0, 0.92, 0.55);
    vec3 col = mix(green, gold, glyph * 0.8 + pulse * 0.5);
    float fadeEdge = 1.0 - smoothstep(0.98, 1.0, r);
    float A = k * fadeEdge;
    gl_FragColor = vec4(col * A * alpha, A * alpha);
  }`,SA=`
  attribute float size;
  attribute float bright;
  attribute float spin;
  uniform float viewH;
  varying float vBright;
  varying float vSpin;
  void main() {
    vBright = bright;
    vSpin = spin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * projectionMatrix[1][1] * viewH * 0.5 / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`,EA=`
  uniform float alpha;
  varying float vBright;
  varying float vSpin;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin);
    float s = sin(vSpin);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float d = length(vec2(p.x * 2.4, p.y));
    float leaf = 1.0 - smoothstep(0.32, 0.46, d);
    float core = 1.0 - smoothstep(0.0, 0.25, d);
    float a = leaf * vBright * alpha;
    vec3 col = mix(vec3(0.4, 0.95, 0.45), vec3(1.0, 1.0, 0.75), core);
    gl_FragColor = vec4(col * a, a);
  }`,yv={transparent:!0,depthWrite:!1,blending:Eh,blendSrc:Sh,blendDst:$h};class TA{constructor(e,t,s,n){g(this,"group",new Gn);g(this,"mat");g(this,"leafGeo");g(this,"leafMat");g(this,"leaves",[]);g(this,"acc",0);g(this,"g");g(this,"x");g(this,"y");g(this,"r");this.g=e,this.x=t,this.y=s,this.r=n;const o=[],i=[],r=[];for(let u=0;u<=zc;u++){const p=u/zc*Math.PI*2;for(let y=0;y<=fi;y++){const w=y/fi*n,m=t+Math.cos(p)*w,f=s+Math.sin(p)*w;if(o.push(m,e.world3d.heightAt(m,f)+1.5,f),i.push(u/zc,y/fi),u<zc&&y<fi){const v=u*(fi+1)+y,x=v+fi+1;r.push(v,v+1,x,v+1,x+1,x)}}}const l=new Nn;l.setAttribute("position",new Yi(o,3)),l.setAttribute("uv",new Yi(i,2)),l.setIndex(r),this.mat=new ys({vertexShader:MA,fragmentShader:$A,uniforms:{time:{value:0},alpha:{value:0},radius:{value:n}},...yv,side:ba,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-3});const d=new vs(l,this.mat);d.frustumCulled=!1,d.renderOrder=1,this.leafGeo=new Nn,this.leafGeo.setAttribute("position",new Bs(new Float32Array(Ru*3),3));for(const u of["size","bright","spin"])this.leafGeo.setAttribute(u,new Bs(new Float32Array(Ru),1));this.leafMat=new ys({vertexShader:SA,fragmentShader:EA,uniforms:{viewH:{value:window.innerHeight},alpha:{value:0}},...yv});const h=new Xi(this.leafGeo,this.leafMat);h.frustumCulled=!1,h.renderOrder=7,this.group.add(d,h),e.world3d.scene.add(this.group)}contains(e,t){return Math.hypot(e-this.x,t-this.y)<=this.r}update(e,t){if(this.mat.uniforms.time.value+=e,this.mat.uniforms.alpha.value=t,this.leafMat.uniforms.alpha.value=t,this.leafMat.uniforms.viewH.value=window.innerHeight,t>.2){for(this.acc+=e*26;this.acc>=1&&this.leaves.length<Ru;)this.acc-=1,this.leaves.push({a:Math.random()*Math.PI*2,r:Math.sqrt(Math.random())*this.r*.95,h:3,vh:22+Math.random()*30,swirl:.6+Math.random()*.8,spin:Math.random()*6.28,vs:(Math.random()-.5)*6,life:0,max:1.4+Math.random()*1.2,size:9+Math.random()*7});this.acc>1&&(this.acc=1)}const s=this.leafGeo.attributes.position,n=this.leafGeo.attributes.size,o=this.leafGeo.attributes.bright,i=this.leafGeo.attributes.spin;for(let r=this.leaves.length-1;r>=0;r--){const l=this.leaves[r];if(l.life+=e,l.life>=l.max){this.leaves.splice(r,1);continue}l.h+=l.vh*e,l.a+=l.swirl*e,l.spin+=l.vs*e}this.leaves.forEach((r,l)=>{const d=r.life/r.max,h=this.x+Math.cos(r.a)*r.r,u=this.y+Math.sin(r.a)*r.r;s.setXYZ(l,h,this.g.world3d.heightAt(h,u)+r.h,u),n.setX(l,r.size),o.setX(l,Math.min(1,d*5)*(1-d)),i.setX(l,r.spin)});for(const r of[s,n,o,i])r.needsUpdate=!0;this.leafGeo.setDrawRange(0,this.leaves.length)}dispose(){this.g.world3d.scene.remove(this.group),this.group.traverse(e=>{(e instanceof vs||e instanceof Xi)&&e.geometry.dispose()}),this.mat.dispose(),this.leafMat.dispose()}}const Rr=46,CA=420,LA=600;class Bf{constructor(e,t,s){g(this,"view",new Je);g(this,"sprite");g(this,"x");g(this,"y");g(this,"moving",!1);g(this,"faceX",0);g(this,"faceY",1);const n=Be[cf(e)??e];this.x=t-30,this.y=s+10;const o=Math.min((n==null?void 0:n.radius)??14,18),i=Gm(new Vo().ellipse(0,0,o,o*.4).fill({color:0,alpha:.3}),"shadow",0,.35);this.sprite=new sn(se.sheet(Xn(e)),"idle"),this.sprite.scale.set(.9),this.view.addChild(i,this.sprite),this.view.position.set(this.x,this.y)}update(e,t,s,n){const o=t-this.x,i=s-this.y,r=Math.hypot(o,i);if(r>CA)this.x=t-30,this.y=s+10;else if(r>Rr||this.moving&&r>=Rr*.8){const l=140+Math.max(0,r-Rr)*3,d=Math.min(r-Rr*.7,l*e),h=this.x+o/r*d,u=this.y+i/r*d;if([this.x,this.y]=n?n(this.x,this.y,h,u):[h,u],this.faceX=o,this.faceY=i,!this.moving){this.moving=!0,this.sprite.play("walk");const p=this.sprite.duration;this.sprite.speed=p>0?p/LA:1}}else this.moving&&r<Rr*.8&&(this.moving=!1,this.sprite.play("idle"),this.sprite.speed=1);this.sprite.dir=Vm(this.faceX,this.faceY),this.sprite.update(e*1e3),this.view.position.set(this.x,this.y),this.view.zIndex=this.y}destroy(){this.view.destroy({children:!0})}}function AA(a){var i;const e=fe[a.id],t={itemId:a.id,quality:a.quality,affixes:a.affixes,ilvl:a.ilvl,tier:a.tier},s=wa(t),n=[s.atk?`+${s.atk} ATK`:"",s.matk?`+${s.matk} MATK`:"",s.def?`DEF ${s.def}`:""].filter(Boolean).join(" · "),o=(e==null?void 0:e.slot)==="weapon"?Lp(e.wtype??""):c(((i=bs.find(r=>r.gear===(e==null?void 0:e.slot)))==null?void 0:i.name)??"");return{color:Ps(a.quality),icon:Me(a.id),badge:Re[a.quality].name,name:ss(t),sub:o.charAt(0).toUpperCase()+o.slice(1),lines:[n,...On(Oo(t))].filter(Boolean)}}function W1(a){return new Promise(e=>br({title:c("¡Recompensa!"),subtitle:a.length>1?c("Elige una pieza"):c("Historia superada"),hint:"",cards:a.map(t=>AA(t)),onPick:t=>e(a[t])}))}function Y1(a,e){const t=no(a.id);return new Promise(s=>br({title:c("¡Ascenso de job!"),subtitle:c("Elige tu 2nd job"),hint:"",cards:t.map(n=>({color:"#7fb2ff",icon:se.icons.get(`job_${n.id==="bard"&&e==="f"?"dancer":n.id}`)??"",badge:c("2nd job"),name:Ct(n,e),sub:c("Desde  {
    job
  }
  ",{job:Ct(a,e)}),lines:[n.desc]})),onPick:n=>s(t[n])}))}const W=De/2,J=(a,e)=>({x:(a+.5)*W,y:(e+.5)*W});function Ke(a,e,t,s,n,o=38){return{eye:J(a,e),h:t,at:J(s,n),fov:o}}const ct=a=>document.getElementById(a);class zi{constructor(e,t,s,n="gunslinger"){g(this,"p");g(this,"hold",null);g(this,"goal",null);this.sheets=e,this.p=new Al(ge(n),e),this.p.x=t,this.p.y=s}get x(){return this.p.x}get y(){return this.p.y}face(e,t){const s=Math.hypot(e-this.p.x,t-this.p.y);s>0&&([this.p.facingX,this.p.facingY]=[(e-this.p.x)/s,(t-this.p.y)/s])}update(e,t=0,s=0){if(this.goal){const n=this.goal,o=Math.hypot(n.x-this.p.x,n.y-this.p.y),i=n.speed*e;o<=i?([this.p.x,this.p.y]=[n.x,n.y],this.goal=null,n.done()):(t=(n.x-this.p.x)/o,s=(n.y-this.p.y)/o,this.p.x+=t*i,this.p.y+=s*i)}this.hold?(this.p.sprite.dir=Vm(this.p.facingX,this.p.facingY),this.p.sprite.play(this.hold,this.hold!=="dead"),this.p.sprite.update(e*1e3),this.p.view.position.set(this.p.x,this.p.y),this.p.view.zIndex=this.p.y):this.p.update(e,t,s)}}class PA{constructor(e,t,s,n=1){g(this,"view",new Je);g(this,"sprite");g(this,"goal",null);g(this,"fx",0);g(this,"fy",1);this.x=t,this.y=s;const o=Gm(new Vo().ellipse(0,0,14,5.5).fill({color:0,alpha:.3}),"shadow",0,.35);this.sprite=new sn(se.sheet(e),"idle"),this.sprite.scale.set(n),this.view.addChild(o,this.sprite),this.update(0)}face(e,t){const s=Math.hypot(e-this.x,t-this.y);s>0&&([this.fx,this.fy]=[(e-this.x)/s,(t-this.y)/s])}swap(e){this.sprite.sheet=se.sheet(e),this.sprite.play("idle",!0,!0)}update(e){if(this.goal){const t=this.goal,s=Math.hypot(t.x-this.x,t.y-this.y),n=t.speed*e;s<=n?([this.x,this.y]=[t.x,t.y],this.goal=null,t.done()):(this.face(t.x,t.y),this.x+=(t.x-this.x)/s*n,this.y+=(t.y-this.y)/s*n)}this.sprite.dir=Vm(this.fx,this.fy),this.sprite.update(e*1e3),this.view.position.set(this.x,this.y),this.view.zIndex=this.y}}class X1{constructor(e){g(this,"clock",0);g(this,"seed",1592594996);g(this,"loops",new Map);g(this,"target",null);g(this,"cleanup",[]);g(this,"waits",[]);g(this,"trail",[]);g(this,"route",null);g(this,"routeAt",-1);g(this,"sayDone",null);g(this,"typing",null);g(this,"fadeEl");g(this,"playerView",null);g(this,"curCam",null);g(this,"faceSeq",0);this.g=e;const t=RA();for(let o=0;o<vv;o++){const i=e.groundSprite(t,!1);i.size=1.1*W,i.visible=!1,this.trail.push(i)}const s=()=>this.advance(),n=o=>{e.state!=="cutscene"||!this.sayDone||(o.key===" "||o.key==="Enter"||o.key==="Escape")&&(o.preventDefault(),s())};ct("story").addEventListener("pointerdown",s),window.addEventListener("keydown",n),this.fadeEl=document.createElement("div"),this.fadeEl.id="story-fade",document.body.appendChild(this.fadeEl),this.cleanup.push(()=>{ct("story").removeEventListener("pointerdown",s),window.removeEventListener("keydown",n),this.fadeEl.remove()})}destroy(){this.cleanup.forEach(e=>e());for(const e of this.trail)e.dispose();BA()}onKill(e){}walkable(e,t){return this.g.walk?this.g.walk.nearestWalkable(e,t):[e,t]}rnd(){this.seed=this.seed+1831565813>>>0;let e=this.seed;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}cue(e,t=0){}update(e){this.clock+=e;for(let t=this.waits.length-1;t>=0;t--){if(this.clock<this.waits[t].until)continue;this.waits.splice(t,1)[0].done()}for(const t of this.loops.values())this.clock<t.next||(t.next=this.clock+t.every,t.fn());this.typing&&(this.typing.shown=Math.min(this.typing.text.length,this.typing.shown+e*55),ct("story-text").textContent=this.typing.text.slice(0,Math.floor(this.typing.shown)),this.typing.shown>=this.typing.text.length&&(this.typing=null)),this.step(e,this.g.state==="cutscene")}render(){var v;const e=this.g,t=this.target,s=e.walk;for(const x of this.trail)x.visible=!1;if(!t||e.state!=="playing"||!s)return;const n=e.player;if(Math.hypot(t.x-n.x,t.y-n.y)<3*W)return;const o=`${t.x},${t.y}|${s.warpsKey}`;if(((v=this.route)==null?void 0:v.key)!==o&&!this.planRoute(o))return;let i=this.route;for(;i.leg+1<i.legs.length&&Math.hypot(i.legs[i.leg+1].pts[0].x-n.x,i.legs[i.leg+1].pts[0].y-n.y)<5*W;)i.leg++;let r=bv(i.legs[i.leg],n.x,n.y);if(r.dist>IA*W||!s.lineClear(n.x,n.y,r.x,r.y)){if(this.clock-this.routeAt<.5||!this.planRoute(o))return;i=this.route,r=bv(i.legs[i.leg],n.x,n.y)}const{pts:l,len:d}=i.legs[i.leg],h=d[d.length-1],u=qA*W,p=this.clock*1.6*W%u,y=r.s+1.2*W,w=Math.min(h,r.s+_A*W);let m=1,f=0;for(let x=Math.ceil((y-p)/u)*u+p;x<=w&&f<vv;x+=u){for(;m<l.length-1&&d[m]<x;)m++;const[k,M]=[l[m-1],l[m]],$=(x-d[m-1])/Math.max(1,d[m]-d[m-1]),P=this.trail[f++];P.visible=!0,P.x=k.x+(M.x-k.x)*$,P.y=k.y+(M.y-k.y)*$,P.rotation=jA*Math.atan2(M.y-k.y,M.x-k.x),P.alpha=.85*Math.max(0,Math.min(1,(x-y)/u,(w-x)/(1.5*u)+(w>=h?.6:0)))}}planRoute(e){const t=this.g,s=this.target;this.routeAt=this.clock;const n=t.walk.route(t.player.x,t.player.y,s.x,s.y);return n?(this.route={key:e,leg:0,legs:n.map(o=>{const i=[0];for(let r=1;r<o.length;r++)i.push(i[r-1]+Math.hypot(o[r].x-o[r-1].x,o[r].y-o[r-1].y));return{pts:o,len:i}})},!0):(this.route=null,!1)}begin(){this.g.state!=="cutscene"&&this.g.clearCombatFx(),this.playerView??(this.playerView={zoom:qe.targetZoom,yaw:qe.targetYaw}),this.g.state="cutscene",document.body.classList.add("cutscene"),ct("story").classList.remove("hidden"),ct("story").querySelector(".story-box").classList.add("hidden"),ct("quest").classList.add("hidden")}end(){this.g.camFocus=null,this.loops.delete("cam"),this.loops.delete("pan"),qe.rig=null,this.curCam=null,this.playerView&&(qe.targetZoom=this.playerView.zoom,qe.targetYaw=this.playerView.yaw,this.playerView=null),this.g.state="playing",document.body.classList.remove("cutscene"),ct("story").classList.add("hidden"),(this.target||ct("quest-text").textContent)&&ct("quest").classList.remove("hidden")}quest(e,t){ct("quest-text").textContent=e,this.target=t;const s=ct("quest");this.g.state!=="cutscene"&&s.classList.remove("hidden"),s.classList.add("flash"),setTimeout(()=>s.classList.remove("flash"),400)}questText(e){ct("quest-text").textContent=e}say(e,t,s=!1){const n=this.speakers[e];ct("story").querySelector(".story-box").classList.remove("hidden");const o=ct("story-name");return o.textContent=s?`${n.name} (${c("a lo lejos")})`:n.name,o.style.color=n.color,this.drawFace(n),this.typing={text:t,shown:0},ct("story-text").textContent="",new Promise(i=>this.sayDone=i)}async chooseReward(){var o;const e=this.g,t=((o=e.storyRewards)==null?void 0:o.call(e))??[];if(!t.length)return;const s=ct("story");s.classList.add("hidden");const n=await W1(t);e.storyLoot=[n],s.classList.remove("hidden")}hush(){ct("story").querySelector(".story-box").classList.add("hidden")}advance(){if(this.typing){ct("story-text").textContent=this.typing.text,this.typing=null;return}const e=this.sayDone;this.sayDone=null,e==null||e()}wait(e){return new Promise(t=>this.waits.push({until:this.clock+e,done:t}))}focus(e,t,s=.6){const n=this.g;if(s<=0){this.loops.delete("cam"),n.camFocus={x:e,y:t};return}const o=n.camFocus??{x:n.player.x,y:n.player.y},i=this.clock;this.loop("cam",0,()=>{const r=Math.min(1,(this.clock-i)/s),l=r*r*(3-2*r);n.camFocus={x:o.x+(e-o.x)*l,y:o.y+(t-o.y)*l},r>=1&&this.loops.delete("cam")})}shot(e,t,s,n=0,o=0){qe.rig=null,this.curCam=null,this.loops.delete("pan"),this.focus(e,t,o),qe.targetZoom=s,qe.targetYaw=n,o<=0&&(qe.zoom=s,qe.yaw=n)}cut(e){this.loops.delete("cam"),this.loops.delete("pan"),this.applyCam(e)}pan(e,t,s){this.loops.delete("cam");const n=this.clock,o=(i,r,l)=>i+(r-i)*l;return this.loop("pan",0,()=>{const i=Math.min(1,(this.clock-n)/s),r=i*i*(3-2*i);this.applyCam({eye:{x:o(e.eye.x,t.eye.x,r),y:o(e.eye.y,t.eye.y,r)},h:o(e.h,t.h,r),at:{x:o(e.at.x,t.at.x,r),y:o(e.at.y,t.at.y,r)},fov:o(e.fov,t.fov,r)}),i>=1&&this.loops.delete("pan")}),this.wait(s)}applyCam(e){this.curCam=e;const t=e.eye.x-e.at.x,s=e.eye.y-e.at.y,n=Math.hypot(t,s)||1,o=e.h*Os,i=Math.atan2(t,s);this.g.camFocus={x:e.at.x,y:e.at.y},qe.yaw=qe.targetYaw=i,qe.rig={pitch:Math.atan2(o,n),orbit:Math.hypot(n,o),fov:e.fov}}async backToPlayer(e=.8){const t=this.g.player,s=this.playerView??{zoom:qe.targetZoom,yaw:qe.targetYaw};if(!this.curCam||!qe.rig){this.shot(t.x,t.y,s.zoom,s.yaw,e),await this.wait(e);return}const n=l$(s.zoom),o=c$(s.zoom),i=Math.cos(n)*o,r={eye:{x:t.x+Math.sin(s.yaw)*i,y:t.y+Math.cos(s.yaw)*i},h:Math.sin(n)*o/Os,at:{x:t.x,y:t.y},fov:d$(s.zoom)};await this.pan(this.curCam,r,e),qe.rig=null,this.curCam=null,qe.zoom=qe.targetZoom=s.zoom,qe.yaw=qe.targetYaw=s.yaw,this.g.camFocus=null}closeUp(e,t=.5,s=0,n=0){this.shot(e.x,e.y-.6*W,t,s,n)}emote(e,t,s=100){this.g.addFx(h$(t,e.x,e.y,s,1400))}walk(e,t,s,n=150){const[o,i]=this.g.walk?this.g.walk.nearestWalkable(t,s):[t,s];return new Promise(r=>e.goal={x:o,y:i,speed:n,done:r})}fadeOut(e,t){const s=this.clock,n="fade"+Math.random();return this.loop(n,0,()=>{const o=Math.min(1,(this.clock-s)/t);for(const i of e)i.alpha=1-o}),this.wait(t).then(()=>{this.loops.delete(n);for(const o of e)o.alpha=0})}blackout(e,t=.8){return this.fadeEl.style.transitionDuration=`${t}s`,this.fadeEl.classList.toggle("on",e===1),this.wait(t)}loop(e,t,s){this.loops.set(e,{every:t,next:this.clock,fn:s})}portal(e,t,s,n=1){const o=Za("tex_ring_blue");if(!o)return;const i=this.g;i.cylinder(e,t,{texture:o,bottom:1.3*W*n,top:1.6*W*n,height:3*W*n,duration:1400,alpha:.6,color:s,animation:1,rotate:!0,fade:!0}),i.cylinder(e,t,{texture:o,bottom:.8*W*n,top:1.1*W*n,height:4*W*n,duration:1400,delay:300,alpha:.5,color:s,animation:1,rotate:!0,fade:!0})}prop(e,t,s){const n=new hd(Be[e],t,s,1);return n.setState("move"),this.g.entityLayer.addChild(n.view),n}npc(e,t,s,n=t,o=s+100,i=1){const[r,l]=this.g.walk?this.g.walk.nearestWalkable(t,s):[t,s],d=new PA(e,r,l,i);return d.face(n,o),d.update(0),this.g.entityLayer.addChild(d.view),d}drawFace(e){var o;this.faceSeq++;const t=ct("story-face"),s=t.getContext("2d");s.clearRect(0,0,t.width,t.height),s.imageSmoothingEnabled=!1;const n=(o=e.actor)==null?void 0:o.call(e);if(n){const i=n.sheets,r=2.2,l=Jb(i,"idle",0,0,0).layers.find(p=>p.role==="head"),d=l&&l.sheet.frames[l.frame],h=d?l.x-d.ox+d.w/2:0,u=d?l.y-d.oy+d.h/2:-70;oi(s,i,"idle",0,0,t.width/2-h*r,t.height*.44-u*r,r);return}if(e.sprite)try{const i=se.sheet(e.sprite),r=(i.actions.idle?i.action("idle"):i.action("walk")).dirs[0][0],{x:l,y:d,width:h,height:u}=r.frame,p=Math.min(t.width/h,t.height/u,1.6),y=w=>s.drawImage(w,l,d,h,u,(t.width-h*p)/2,(t.height-u*p)/2,h*p,u*p);if(nw(r.source)&&i.url){const w=++this.faceSeq,m=new Image;m.onload=()=>w===this.faceSeq&&y(m),m.src=i.url}else y(r.source.resource)}catch{}}}const jA=1,_A=22,qA=1.6,vv=16,IA=10;function bv(a,e,t){const{pts:s,len:n}=a;let o={x:s[0].x,y:s[0].y,dist:Math.hypot(s[0].x-e,s[0].y-t),s:0};for(let i=1;i<s.length;i++){const[r,l]=[s[i-1],s[i]],d=n[i]-n[i-1],h=d>0?Math.max(0,Math.min(1,((e-r.x)*(l.x-r.x)+(t-r.y)*(l.y-r.y))/(d*d))):0,u=r.x+(l.x-r.x)*h,p=r.y+(l.y-r.y)*h,y=Math.hypot(u-e,p-t);y<o.dist&&(o={x:u,y:p,dist:y,s:n[i-1]+d*h})}return o}function RA(){const a=document.createElement("canvas");a.width=a.height=64;const e=a.getContext("2d");return e.beginPath(),e.moveTo(58,32),e.lineTo(14,10),e.lineTo(24,32),e.lineTo(14,54),e.closePath(),e.fillStyle="#ffffff",e.strokeStyle="#3a5bb4",e.lineWidth=5,e.lineJoin="round",e.fill(),e.stroke(),Ea.from(a)}function BA(){document.body.classList.remove("cutscene"),ct("story").classList.add("hidden"),ct("quest").classList.add("hidden"),ct("quest-text").textContent=""}const po=J(474,48),Fa=J(476,40),Br=J(471.5,46.5),Nr=J(477.5,47),Uc=[J(479.5,40),J(483.5,37),J(487.5,30)],wv=Ke(474,62,9,475,43,44),Bu=J(69,168),Nu=J(71.5,166),NA=6,gi=J(68.5,24),OA=12,Ou=J(68.5,30),DA=Ke(68.5,50,15,68.5,28,46),kv=[{at:J(69,140),r:6,fx:0,lines:["¡Ah! ¿Has oído eso? Un crujido... justo encima de nosotros.","Solo será la madera del casco... Este barco me pone los pelos de punta."]},{at:J(39,162),r:5,deep:5,lines:["Cajas y redes podridas: aquí guardaban las provisiones.","Haru, si estás escondido para darme un susto, no tiene ninguna gracia."]},{at:J(98,162),r:5,deep:5,fx:1,lines:["Mira, huellas en el polvo... Son de botas, recientes. Seguro que son de Haru.","Ha estado aquí, pero se ha ido. Siempre tan rápido."]},{at:J(69,93),r:5,deep:6,fx:0,lines:["¡¿Qué ha sido ese golpe?! Ha sonado como una puerta al cerrarse...","No hay nadie. Sigamos, pero no te separes de mí."]},{at:J(39,88),r:5,deep:5,lines:["Hamacas... aquí dormía la tripulación.","Siglos bajo el agua y siguen colgadas como si alguien fuera a volver a usarlas."]},{at:J(100,88),r:5,deep:5,fx:7,lines:["Un cofre abierto y vacío. Si ha sido Haru, se va a enterar cuando lo encontremos."]},{at:J(25,35),r:5,deep:5,fx:1,lines:["Esto era el comedor de los oficiales. Hay platos servidos...","...y la comida está fresca. ¿Quién ha estado comiendo aquí?"]},{at:J(114,35),r:5,deep:5,lines:["Este pasillo va hacia el este del barco. De ahí sale un aire helado...","Mejor no separarnos. Haru tiene que haber ido hacia la escalera."]}],Es=J(164,136),HA=8,rs=J(301.5,98),FA=[J(249,58),J(354,58),J(243,154)],Ys=J(302,37),la=J(302,45),zA=55,UA=Ke(302,64,13,302,44,42),GA=.3,xv=1.5,Mv=1.8*W,$v=1.4*W,J1={gender:"f",hair:17,hairColor:1,cloth:2},Q1={gender:"m",hair:5,hairColor:1,cloth:2},VA={gender:"f",hair:7,hairColor:5,cloth:0},lh=13101,KA=.9,Sv=340,WA=.2,YA=.004,XA=1.4,Ev=2,Tv=(a,e)=>{const t=Math.hypot(e.x-a.x,e.y-a.y)||1,s=Math.min(XA*W,t/3)/t;return{x:a.x+(e.x-a.x)*s,y:a.y+(e.y-a.y)*s}};class JA extends X1{constructor(t){super(t);g(this,"phase","island");g(this,"lain",null);g(this,"haru",null);g(this,"selene",null);g(this,"following",!1);g(this,"shotCd",0);g(this,"ghost",null);g(this,"boss",null);g(this,"locks");g(this,"floor2",[]);g(this,"talked",new Set);g(this,"lockTalked",new Set);g(this,"drakeDoor",-1);g(this,"ready");g(this,"speakers",{selene:{name:"Selene",color:"#7a5bb4",actor:()=>this.selene},lain:{name:"Lain",color:"#c0508a",actor:()=>this.lain},haru:{name:"Haru",color:"#3a7fc0",actor:()=>this.haru},ghostring:{name:"Ghostring",color:"#7a5bb4",sprite:"ghostring"},drake:{name:"Drake",color:"#c0392b",sprite:"drake"}});g(this,"home",{zoom:0,yaw:0});if(this.begin(),this.blackout(1,0),t.outdoors=!0,t.spawnHold=!0,t.map.warps.forEach((i,r)=>{var l;i.from[0]<200||i.from[0]>=400||i.name==="H'-H"||(this.floor2.push(r),i.name==="C-C'"&&(this.drakeDoor=r),(l=t.walk)==null||l.setWarpOpen(r,!1))}),t.walk)for(const i of[gi,Ou,Es,rs,Ys,la,Bu,Nu,po,Fa,Br,Nr,...Uc])[i.x,i.y]=t.walk.nearestWalkable(i.x,i.y);this.locks=FA.map(i=>({...this.againstWall(i),on:!1,charge:0,ring:null}));const n=t.player;[n.x,n.y]=this.walkable(po.x,po.y),n.facingX=Fa.x-n.x,n.facingY=Fa.y-n.y,this.ready=Promise.all([It("gunslinger",J1,{weapon:lh}),It("gunslinger",Q1,{weapon:lh}),It("professor",VA,{weapon:1601})]).then(([i,r,l])=>{this.lain=new zi(i,Br.x,Br.y,"gunslinger"),this.haru=new zi(r,Nr.x,Nr.y,"gunslinger"),this.selene=new zi(l,Fa.x,Fa.y,"mage"),this.lain.face(Fa.x,Fa.y),this.haru.face(Fa.x,Fa.y),this.selene.face(po.x,po.y),t.entityLayer.addChild(this.lain.p.view,this.haru.p.view,this.selene.p.view)});const o=i=>Math.hypot(i.x-t.player.x,i.y-t.player.y)<t.world3d.viewReach+200;this.loop("barrier",.6,()=>o(rs)&&this.portal(rs.x,rs.y,[.85,.3,.75],1.5)),this.locks.forEach((i,r)=>this.loop("lock"+r,.9,()=>o(i)&&this.portal(i.x,i.y,i.on?[.55,.85,1]:[.85,.3,.75],i.on?.8:.6))),this.loop("forcefield",.8,()=>this.phase!=="island"&&this.phase!=="end"&&o(Ys)&&this.portal(Ys.x,Ys.y,[1,.85,.45],1)),this.start()}destroy(){var t;super.destroy();for(const s of this.locks)(t=s.ring)==null||t.dispose()}step(t,s){var n,o,i,r;if((n=this.ghost)==null||n.updateView(t*1e3,this.g.time),(o=this.haru)==null||o.update(t),(i=this.selene)==null||i.update(t),s){(r=this.lain)==null||r.update(t);return}this.updateLain(t),this.checkPhase(t)}updateLain(t){var u;const s=this.lain,n=this.g;if(!s)return;if(!this.following){s.update(t);return}const o=this.g.player,i=Math.hypot(o.x-s.x,o.y-s.y);let r=0,l=0;if(i>520){const p=Math.hypot(o.facingX,o.facingY)||1,y=o.x-o.facingX/p*50,w=o.y-o.facingY/p*50,[m,f]=n.walk&&n.walk.lineClear(o.x,o.y,y,w)?[y,w]:[o.x,o.y];[s.p.x,s.p.y]=[m,f],n.addFx(Ye("fx_smoke",m,f,{add:!1,scale:.6}))}else if(i>75){const p=((u=n.walk)==null?void 0:u.flowDir(s.x,s.y))??[(o.x-s.x)/i,(o.y-s.y)/i],y=Math.min(1.25,i/140)*175;r=p[0],l=p[1];const w=s.x+r*y*t,m=s.y+l*y*t;[s.p.x,s.p.y]=n.walk?n.walk.resolve(s.x,s.y,w,m):[w,m]}if(s.update(t,r,l),(this.shotCd-=t)>0)return;let d=null,h=Sv;for(const p of n.enemiesInRadius(s.x,s.y,Sv)){const y=Math.hypot(p.x-s.x,p.y-s.y);p.hiddenUntil>n.time||y>=h||n.walk&&!n.walk.lineClear(s.x,s.y,p.x,p.y)||(d=p,h=y)}d&&(this.shotCd=KA,s.face(d.x,d.y),s.p.attack(),B.play("gs_tripleaction",.25,2),n.addFx(Ri(d.x,d.y-25*(d.def.scale??1))),n.damageEnemy(d,d.maxHp*(d.def.boss?YA:WA),{part:"Lain",fromX:s.x,fromY:s.y,knock:60}))}checkPhase(t){const s=this.g,n=s.player,o=(i,r)=>Math.hypot(i.x-n.x,i.y-n.y)<r;switch(this.phase){case"explore":o(gi,OA*W)?this.cue("kidnap"):this.checkTalks(o);break;case"rescue":o(Es,HA*W)&&this.cue("ghostFight");break;case"descend":s.lowerFloor&&this.cue("below");break;case"barrier":o(rs,9*W)&&this.cue("barrier");break;case"locks":this.updateLocks(t);break;case"enter":n.y/W<zA&&Math.abs(n.x-Ys.x)<22*W&&this.cue("drakeIntro");break;case"drake":this.boss&&this.boss.hp<=this.boss.hpFloor+1&&this.cue("ending");break}}cue(t,s=0){t==="kidnap"?this.kidnap():t==="ghostFight"?this.ghostFight():t==="freeLain"?this.freeLain():t==="talk"?this.talk(s):t==="below"?(this.phase="barrier",this.quest(c("Busca a Haru en la bodega"),rs)):t==="barrier"?this.barrier():t==="lock"?this.activateLock(s):t==="lockTalk"?this.lockTalk(s):t==="drakeIntro"?this.drakeIntro():t==="ending"&&this.ending()}checkTalks(t){const s=this.g.walk,n=this.g.player,o=r=>{const l=Math.hypot(n.x-r.at.x,n.y-r.at.y);return l>=r.deep*W&&l<18*W&&(!s||s.lineClear(r.at.x,r.at.y,n.x,n.y))},i=kv.findIndex((r,l)=>!this.talked.has(l)&&(r.deep?o(r):t(r.at,r.r*W)));i>=0&&this.cue("talk",i)}onKill(t){t===this.boss&&this.phase==="ghostring"&&this.cue("freeLain")}async start(){await this.ready;const t=this.g,s=this.selene,n=this.lain,o=this.haru;this.cut(wv),await this.blackout(0,1.2),await this.wait(.3),await this.say("selene",c("Bienvenidos a vuestra primera misión oficial. Soy Selene, de la élite de Prontera: hoy estáis a mis órdenes.")),await this.say("selene",c("Desde hace semanas los pescadores de Alberta ven luces en el barco hundido por la noche, y dos de sus barcas no han vuelto a puerto.")),await this.say("selene",c("Dicen que dentro del casco se oyen cantos y órdenes de abordaje. La tripulación del capitán Drake lleva siglos en el fondo del mar... y algo la está despertando.")),await this.say("selene",c("Vuestra tarea es entrar, averiguar qué pasa y volver a contármelo. Nada de heroicidades: si veis algo que os supera, salís.")),o.face(this.g.player.x,this.g.player.y),await this.say("haru",c("¿Unos cuantos peces y esqueletos podridos? Esto es pan comido.")),o.face(Uc[0].x,Uc[0].y),await this.say("haru",c("¡Os espero dentro... si es que llegáis! ¡Me adelanto!")),this.hush();const i=(async()=>{for(const l of Uc)await this.walk(o,l.x,l.y,260)})();await this.wait(.5),n.face(o.x,o.y),await this.say("lain",c("¡Haru, espera! ¡No vayas tú solo!")),await i,B.play("ef_teleportation",.4),await this.fadeOut([o.p.view],.4),await this.say("lain",c("Siempre igual... Mi hermano tiene que ser el primero en todo.")),s.face(n.x,n.y),await this.say("selene",c("Id tras él antes de que se meta en un lío. Y traédmelo de una pieza.")),n.face(this.g.player.x,this.g.player.y),await this.say("lain",c("Vamos. Lo encontraremos antes de que haga alguna tontería.")),this.hush(),await this.blackout(1,.8),t.outdoors=!1;const r=t.player;[r.x,r.y]=this.walkable(Bu.x,Bu.y),r.facingX=0,r.facingY=-1,[n.p.x,n.p.y]=[Nu.x,Nu.y],n.face(n.x,n.y-100),[o.p.x,o.p.y]=[Ys.x,Ys.y],o.p.view.alpha=1,o.hold="sit",o.face(la.x,la.y+100),s.p.view.visible=!1,this.normal(r.x,r.y-W),await this.blackout(0,1),await this.say("lain",c("Qué oscuro está esto... ¿Haru? ¡Haru!")),await this.say("lain",c("Nada. Si lo conozco, habrá ido directo hacia lo más hondo del barco. Busquemos la escalera a la bodega.")),this.end(),this.following=!0,this.phase="explore",this.quest(c("Busca a Haru: encuentra la escalera a la bodega"),gi)}async talk(t){const s=kv[t],n=this.lain;if(!(!s||!n||this.talked.has(t))){this.talked.add(t),this.begin(),n.face(this.g.player.x,this.g.player.y),s.fx!==void 0&&this.emote(n,s.fx),await this.wait(.3);for(const o of s.lines)await this.say("lain",c(o));this.end()}}async kidnap(){this.phase="rescue";const t=this.g,s=this.lain;this.following=!1,this.target=null,this.begin(),this.cut(DA),await this.walk(s,Ou.x,Ou.y,170),s.face(gi.x,gi.y),await this.say("lain",c("Ahí está la escalera a la bodega. Si Haru ha pasado por aquí, ya estará abajo.")),await this.say("lain",c("...¿Notas eso? Hace muchísimo frío de repente."));const n=s.x+55,o=s.y-35;this.ghost=this.prop("ghostring",n,o),this.ghost.face(s.x-n,s.y-o),t.addFx(Ye("fx_smoke",n,o,{add:!1,scale:1})),B.play("ef_teleportation",.5),await this.wait(.6),s.face(n,o),await this.say("ghostring",c("Otra alma viva en mi barco... Qué cálida. ¡Vendrás conmigo!")),await this.say("lain",c("¿¡Qué...!? ¡Suéltame!")),this.hush(),this.emote(this.ghost,18,120);const[i,r]=[s.x,s.y];this.loop("kidnap",.3,()=>this.portal(i,r,[.75,.45,1],1.2)),B.play("ef_portal",.7,2),await this.fadeOut([s.p.view,this.ghost.view],1.1),this.loops.delete("kidnap"),await this.blackout(1,.7),await this.say("lain",c("¡¡Aaaaah!! ¡Socorro...! ¡Sacadme de aquí!"),!0),await this.say("lain",c("¡Está todo oscuro...! ¡¿Alguien me oye?!"),!0),this.hush(),[s.p.x,s.p.y]=[Es.x,Es.y],s.p.view.alpha=1,s.hold="sit",s.face(Es.x,Es.y+100),[this.ghost.x,this.ghost.y]=t.walk?t.walk.nearestWalkable(Es.x+70,Es.y+30):[Es.x+70,Es.y+30],this.ghost.view.alpha=1,this.loop("prison",.7,()=>this.portal(Es.x,Es.y,[.75,.45,1],.9)),this.normal(this.g.player.x,this.g.player.y),await this.blackout(0,.8),this.end(),t.spawnHold=!1,t.waveStart=t.time,t.events.onAnnounce(c("El barco ha despertado...")),t.storyLevels(NA,["potion","elixir","blessing","dish","deity"],()=>this.quest(c("Busca a Lain: sus gritos venían del este del barco"),Es))}async ghostFight(){this.phase="ghostring";const t=this.g;this.target=null,t.fadeMobs(700),this.begin();const s=this.ghost;this.focus(s.x,s.y),await this.wait(.4),await this.say("lain",c("¡Estás aquí! ¡Cuidado, es muy rápido!")),await this.say("ghostring",c("¿Vienes a por ella? Su alma ya es mía... y la tuya también lo será."));const[n,o]=[s.x,s.y];this.removeProp(),this.boss=t.spawnBoss("ghostring",n,o),this.end(),this.quest(c("Derrota a Ghostring"),null)}async freeLain(){this.phase="descend";const t=this.lain;this.boss=null,this.loops.delete("prison"),this.portal(t.x,t.y,[1,1,1],1.2),B.play("ef_blessing",.5),await this.wait(1),this.begin(),t.hold=null,t.face(this.g.player.x,this.g.player.y),this.focus(t.x,t.y),await this.say("lain",c("¡Gracias! Pensaba que me quedaba aquí para siempre...")),await this.say("lain",c("Al caer ese fantasma se ha abierto la escalera de la bodega. Haru tiene que estar ahí abajo. ¡Vamos!")),this.end(),this.following=!0,this.quest(c("Baja a la bodega por la escalera"),gi)}async barrier(){var n;this.phase="locks";const t=this.g;this.target=null,t.fadeMobs(700),this.begin();const s=this.frame(rs,0,15,10);this.cut(s),await this.pan(s,this.frame(rs,.25,11,7),2),this.normal(rs.x,rs.y),await this.say("lain",c("Una barrera mágica... Al otro lado se oyen voces. ¡Esa es la voz de Haru!")),await this.say("lain",c("Mira el portal: tiene tres runas grabadas. Seguro que cada una está unida a un mecanismo.")),await this.say("lain",c("Tenemos que encontrar esos tres dispositivos. Estarán en las paredes de las otras salas de esta planta.")),await this.say("lain",c("Si los activamos los tres, la barrera debería caer."));for(const o of this.floor2)o!==this.drakeDoor&&((n=t.walk)==null||n.setWarpOpen(o,!0));t.warpsChanged(),this.end(),this.lockQuest()}async barrierDown(){var s;this.phase="enter";const t=this.g;this.loops.delete("barrier"),(s=t.walk)==null||s.setWarpOpen(this.drakeDoor,!0),t.warpsChanged(),this.portal(rs.x,rs.y,[1,1,1],2),B.play("ef_portal",.7,2),t.events.onAnnounce(c("¡La barrera se ha disuelto!")),this.quest(c("Entra en la sala de Drake"),la)}async drakeIntro(){this.phase="drake";const t=this.g,s=this.lain;this.target=null,t.fadeMobs(1/0,!0),this.boss=t.spawnBoss("drake",la.x,la.y),this.boss&&(this.boss.hpFloor=Math.round(this.boss.maxHp*GA),this.boss.face(this.g.player.x-la.x,this.g.player.y-la.y)),this.begin(),this.cut(UA),await this.wait(1.6),this.normal(Ys.x,Ys.y+3*W),s.face(Ys.x,Ys.y),await this.say("lain",c("¡Haru!")),await this.say("haru",c("¿Lain? ¡No...! ¡Es una trampa, salid de aquí!")),await this.say("drake",c("Jo, jo, jo... Este novato bocazas entró en mi camarote como si fuera suyo. Me vendrá bien para mi tripulación... y vosotros iréis detrás.")),await this.say("lain",c("¡Suelta a mi hermano, pirata!")),await this.say("drake",c("Si lo queréis... ¡venid a por él!")),this.end(),this.quest(c("Derrota a Drake"),null)}async ending(){this.phase="end";const t=this.g,s=this.lain,n=this.haru,o=this.selene,i=this.boss??this.prop("drake",la.x,la.y);this.following=!1,this.begin(),this.focus(i.x,i.y),i.setState("move"),await this.wait(.5),await this.say("drake",c("¡Argh...! Esta vez habéis ganado, marineros de agua dulce.")),await this.say("drake",c("Pero el mar siempre cobra sus deudas. ¡Nos volveremos a ver!")),this.hush(),this.cut(this.frame(i,.2,12,8)),this.portal(i.x,i.y,[.55,.85,1],1.4),B.play("ef_portal",.7,2),await this.fadeOut([i.view],1),t.vanishEnemy(i),t.mvpsKilled.includes("drake")||t.mvpsKilled.push("drake"),this.boss=null,this.portal(n.x,n.y,[1,.9,.55],1.3),B.play("ef_blessing",.5),this.normal(n.x,n.y+2*W),await this.wait(.7),await this.walk(s,n.x+40,n.y+34),s.face(n.x,n.y),n.hold=null,n.face(s.x,s.y),await this.say("lain",c("¡Haru! ¿Estás bien?")),await this.say("haru",c("Ahora sí... Entré a por todas y ese pirata me encerró antes de que me diera cuenta.")),await this.say("lain",c("Eres un cabezota. Vámonos de aquí antes de que vuelva.")),this.hush(),await this.blackout(1,1),t.outdoors=!0,t.fadeMobs(1/0,!0);const r=t.player;[r.x,r.y]=this.walkable(po.x,po.y),[s.p.x,s.p.y]=[Br.x,Br.y],[n.p.x,n.p.y]=[Nr.x,Nr.y],o.p.view.visible=!0;for(const l of[s,n])l.face(o.x,o.y);r.facingX=o.x-r.x,r.facingY=o.y-r.y,o.face(n.x,n.y),this.cut(wv),await this.blackout(0,1.2),await this.say("selene",c("¡Por fin! Empezaba a pensar en entrar yo misma. ¿Qué ha pasado ahí dentro?")),await this.say("lain",c("Un fantasma, Ghostring, me atrapó junto a la escalera de la bodega. Y abajo, el capitán Drake tenía a Haru encerrado en su camarote.")),await this.say("haru",c("Drake ha despertado, y su tripulación con él. Pero le hemos dado una buena paliza: ha huido por un portal.")),await this.say("selene",c("Haru. Te dije que nada de heroicidades. Entraste solo, sin esperar a nadie, y casi os cuesta caro a todos.")),await this.say("selene",c("Un miembro de la élite no se adelanta para lucirse: protege a los suyos. Tendrás tiempo de pensarlo en Prontera... limpiando los establos de los Peco Peco.")),await this.say("haru",c("...Sí, señora.")),o.face(this.g.player.x,this.g.player.y),await this.say("selene",c("Vosotros, en cambio, habéis hecho un trabajo excelente: habéis mantenido la calma, rescatado a vuestros compañeros y averiguado lo que pasaba.")),await this.say("selene",c("Pero esto no ha acabado: Drake ha huido, y no tardará en reunir otra vez a su tripulación. Habrá que darle caza en su guarida, en el fondo del barco.")),await this.say("selene",c("Informaré a Prontera. Cuando estéis preparados, volveréis a por él. De momento, tomad: os lo habéis ganado.")),this.hush(),await this.chooseReward(),await this.wait(.3),s.face(this.g.player.x,this.g.player.y),await this.say("lain",c("Gracias por todo. Sin ti no lo habríamos contado.")),this.hush(),document.body.classList.remove("cutscene"),document.getElementById("story").classList.add("hidden"),this.target=null,t.storyWin()}begin(){this.home={zoom:qe.targetZoom,yaw:qe.targetYaw},super.begin()}normal(t,s){this.shot(t,s,this.home.zoom,this.home.yaw)}frame(t,s,n,o,i=40){const r=this.g.walk;for(const d of[1,.8,.6])for(const h of[0,.3,-.3,.6,-.6,.95,-.95,1.35,-1.35]){const u=s+h,p={x:t.x+Math.sin(u)*n*d*W,y:t.y+Math.cos(u)*n*d*W};if(!r||r.lineClear(t.x,t.y,p.x,p.y)&&this.roomy(p))return{eye:p,h:o*(.5+d/2),at:Tv(t,p),fov:i}}const l={x:t.x+Math.sin(s)*4*W,y:t.y+Math.cos(s)*4*W};return{eye:l,h:9,at:Tv(t,l),fov:i}}roomy(t){const s=this.g.walk;if(s.warpAt(t.x,t.y)||Math.hypot(t.x-rs.x,t.y-rs.y)<3*W)return!1;for(const n of[this.g.player,this.lain,this.haru,this.ghost,this.boss])if(n&&Math.hypot(t.x-n.x,t.y-n.y)<3*W)return!1;for(let n=0;n<8;n++){const o=n*Math.PI/4,i=t.x+Math.cos(o)*Ev*W,r=t.y+Math.sin(o)*Ev*W;if(!s.walkable(i,r)||s.warpAt(i,r))return!1}return!0}againstWall(t){const s=this.g.walk;if(!s)return{...t};const n=this.g.map.warps.map(i=>J(i.from[0],i.from[1]));let o=null;for(const[i,r]of[[0,-1],[0,1],[-1,0],[1,0]]){let l=0;for(;l<25*W&&s.walkable(t.x+i*(l+W/2),t.y+r*(l+W/2));)l+=W/2;const d=t.x+i*l,h=t.y+r*l;if(l>=25*W||n.some(p=>Math.hypot(p.x-d,p.y-h)<4*W))continue;const u={x:t.x+i*Math.max(0,l-$v),y:t.y+r*Math.max(0,l-$v),d:l};if(r<0)return{x:u.x,y:u.y};(!o||l<o.d)&&(o=u)}return o?{x:o.x,y:o.y}:{...t}}lockQuest(){const t=this.locks.filter(n=>n.on).length,s=this.nearestLock();this.quest(c("Activa los mecanismos de la barrera ( {
    n
  }
  /3)",{n:t}),s)}nearestLock(){const t=this.g.player;let s=null;for(const n of this.locks)!n.on&&(!s||Math.hypot(n.x-t.x,n.y-t.y)<Math.hypot(s.x-t.x,s.y-t.y))&&(s=n);return s}updateLocks(t){const s=this.g,n=s.player;if(!this.lockTalked.has(0)&&this.locks.some(o=>!o.on&&Math.hypot(o.x-n.x,o.y-n.y)<7*W)){this.cue("lockTalk",0);return}for(const[o,i]of this.locks.entries()){if(i.on)continue;const r=Math.hypot(i.x-n.x,i.y-n.y)<Mv;i.charge=r?i.charge+t:Math.max(0,i.charge-t*2),i.ring||(i.ring=s.zoneDecal("circle"),[i.ring.x,i.ring.y]=[i.x,i.y],i.ring.w=i.ring.h=Mv*2,i.ring.alpha=.85),i.ring.progress=Math.min(1,i.charge/xv),!(i.charge<xv)&&this.cue("lock",o)}this.phase==="locks"&&(this.target=this.nearestLock())}activateLock(t){var o;const s=this.locks[t];if(!s||s.on)return;s.on=!0,(o=s.ring)==null||o.dispose(),s.ring=null,this.portal(s.x,s.y,[.55,.85,1],1.4),B.play("ef_blessing",.6);const n=this.locks.filter(i=>i.on).length;this.g.events.onAnnounce(c("Mecanismo activado ( {
    n
  }
  /3)",{n})),n===3?this.barrierDown():this.lockQuest(),n===1&&this.lockTalk(1),n===3&&this.lockTalk(2)}async lockTalk(t){const s=this.lain;!s||this.lockTalked.has(t)||(this.lockTalked.add(t),this.begin(),s.face(this.g.player.x,this.g.player.y),await this.wait(.3),t===0?(await this.say("lain",c("¡Mira, en la pared! Brilla igual que las runas del portal. Esto tiene que ser uno de los dispositivos.")),await this.say("lain",c("Quédate encima del círculo un momento a ver si se activa."))):t===1?(await this.say("lain",c("¡Ha funcionado! Una de las runas del portal se ha apagado.")),await this.say("lain",c("Faltan los otros dos. Vamos a buscarlos."))):await this.say("lain",c("Este debería ser el último. ¡Volvamos a la barrera!")),this.end())}removeProp(){var t;(t=this.ghost)==null||t.view.destroy({children:!0}),this.ghost=null}}const _e={heh:18,gg:29,gasp:0,what:1,heart:3,sweat:5,angry:7,dots:10,thanks:15,wah:16,omg:23,sob:28,grats:45,ok:33},Gc=J(248,80),Cv=[[-6,2],[4,-3],[7,3.5],[-2.5,5.5],[-8,-2.5],[2.5,7]],Is=J(70,30.6),ls=J(70,37.5),Du=J(68.7,41.5),Lv=J(71.3,41.5),Kt=J(70,50),Vc=[J(65,49.5),J(75.5,49.5),J(62,53),J(78.5,53.5),J(66.5,55.5),J(74,56)],Av=J(62.5,38),Wt=[J(59.5,72.5),J(80.5,72.5)],Pv=J(69.5,90),jv=J(60.5,78.5),ca=J(70,38.5),_v=J(69,46.5),qv=[[-2.5,-1.5],[2.5,-1]],Iv=[J(67.4,51.6),J(72.6,51.6)],QA=1.1,Rv=360,ZA=.12,Kc=J(248,70),yi=[J(248,64.5),J(243.5,66),J(252.5,66),J(255,68.5)],Bv=[J(244,71.5),J(252,71.5)],Z1=1.45,je=eP({plazaHigh:Ke(248,118,22,248,78,40),plaza:Ke(248,106,9,248,86,40),captain:Ke(243,104,5.5,248,85,40),group:Ke(252,75,3.8,246.5,90,40),bridge:Ke(248,57,8,248,78,40),gate:Ke(248,84,7,248,64,40),hallHigh:Ke(70,104,30,70,40,40),hall:Ke(70,72,11,70,40,40),king:Ke(70,49,4.2,70,31,34),altar:Ke(59,50,4,70,40,36),couple:Ke(78.5,30,4.6,69,45,38),entrance:Ke(70,38,12,63,61,42),knight:Ke(57,49,3.6,67,56,38),prince:Ke(81,49,4,71,41,34),blow:Ke(61,44,4.5,71,32,36),assault:Ke(70,28,15,70,60,42),kingDown:Ke(70,47.5,4,69.5,32,34),duel:Ke(81,52,4.6,69,43,38),ring:Ke(70,62,10,70,43,40),eliteIn:Ke(70,30,13,70,62,42),fightLeft:Ke(54,58,7,66,45,40),fightRight:Ke(86,58,7,74,45,40),duelSide:Ke(58,47,4.4,68,46,36),finale:Ke(86,66,10,69,46,40),gather:Ke(70,60,8,70,38,40)});function eP(a){for(const e of Object.values(a))e.fov*=Z1;return a}const Nv=90,tP=10,sP=12,aP=[{id:"npc_minister",...J(75.5,34),dead:"npc_dead2"},{id:"npc_prince2",...J(77.5,38),dead:"npc_dead4"},{id:"npc_royalguard",...J(60,28),dead:"npc_dead3"},{id:"npc_royalguard",...J(80,28),dead:"npc_dead3"},{id:"npc_maid",...J(55,34),dead:"npc_dead6"},{id:"npc_maid",...J(85,34),dead:null},{id:"npc_minstrel",...J(56.5,41),dead:null,orc:"orc_warrior"},{id:"npc_jester",...J(83.5,41),dead:null,orc:"orc_warrior"},{id:"npc_noble",...J(56,47.5),dead:"npc_dead2"},{id:"npc_lady",...J(57.5,50.5),dead:null,orc:"orc_lady"},{id:"npc_noble2",...J(84,47.5),dead:"npc_dead1"},{id:"npc_lady2",...J(82.5,50.5),dead:null,orc:"orc_lady"},{id:"npc_counselor",...J(58,58),dead:"npc_dead2"},{id:"npc_butler",...J(82,58.5),dead:"npc_dead1"},{id:"npc_guard",...J(57.5,66),dead:"npc_dead3"},{id:"npc_guard",...J(82.5,66),dead:"npc_dead3"}],nP=[{job:"swordsman",name:"Garrett",color:"#b0563c",look:{gender:"m",hair:2,hairColor:1,cloth:0}},{job:"mage",name:"Lyra",color:"#7a5bb4",look:{gender:"f",hair:8,hairColor:4,cloth:0}},{job:"archer",name:"Robin",color:"#4c8a3c",look:{gender:"m",hair:6,hairColor:3,cloth:0}},{job:"acolyte",name:"Celia",color:"#3a7fc0",look:{gender:"f",hair:4,hairColor:0,cloth:0}},{job:"thief",name:"Vex",color:"#6b6b7a",look:{gender:"m",hair:9,hairColor:7,cloth:0}},{job:"merchant",name:"Bruno",color:"#b8862e",look:{gender:"m",hair:5,hairColor:2,cloth:0}},{job:"taekwon",name:"Mei",color:"#c0508a",look:{gender:"f",hair:3,hairColor:5,cloth:0}}],Wc={key:"captain",job:"crusader",base:"swordsman",name:"Capitán de la guardia",color:"#3a5bb4",look:{gender:"m",hair:13,hairColor:6,cloth:0},equip:{weapon:1101,shield:2101}},Yc={key:"guard",job:"knight",base:"swordsman",name:"Guardia",color:"#3a5bb4",look:{gender:"m",hair:11,hairColor:3,cloth:0},equip:{weapon:1101}},Hu=[{key:"paladin",job:"paladin",base:"swordsman",name:"Sir Aldric",color:"#c0392b",look:{gender:"m",hair:1,hairColor:6,cloth:0},equip:{weapon:1101,shield:2101}},{key:"professor",job:"professor",base:"mage",name:"Selene",color:"#7a5bb4",look:{gender:"f",hair:7,hairColor:5,cloth:0},equip:{weapon:1601}},{key:"high_priest",job:"high_priest",base:"acolyte",name:"Padre Matthias",color:"#3a7fc0",look:{gender:"m",hair:10,hairColor:0,cloth:0},equip:{weapon:1501}},{key:"sniper",job:"sniper",base:"archer",name:"Nadia",color:"#4c8a3c",look:{gender:"f",hair:12,hairColor:3,cloth:0},equip:{weapon:1701}}];class oP extends X1{constructor(t){super(t);g(this,"phase","intro");g(this,"mates",[]);g(this,"mateDefs",nP.filter(t=>t.job!==this.g.classDef.id).slice(0,6));g(this,"elite",[]);g(this,"lain",null);g(this,"haru",null);g(this,"shotCd",[0,0]);g(this,"captain",null);g(this,"knight",null);g(this,"props",[]);g(this,"king",null);g(this,"guests",[]);g(this,"beasts",[]);g(this,"shownSec",-1);g(this,"ready");g(this,"speakers",{captain:{name:c(Wc.name),color:Wc.color,actor:()=>this.captain},lain:{name:"Lain",color:"#c0508a",actor:()=>this.lain},haru:{name:"Haru",color:"#3a7fc0",actor:()=>this.haru},guard:{name:c(Yc.name),color:Yc.color,actor:()=>this.knight},king:{name:"Tristan III",color:"#b8862e",sprite:"npc_king"},king_hurt:{name:"Tristan III",color:"#b8862e",sprite:"npc_king_hurt"},bishop:{name:c("Obispo"),color:"#6b6b7a",sprite:"npc_bishop"},princess:{name:c("Princesa"),color:"#c0508a",sprite:"npc_princess"},prince:{name:c("Príncipe Leopold"),color:"#3a7fc0",sprite:"npc_prince"},orc_hero:{name:"Orc Hero",color:"#c0392b",sprite:"orc_hero"},high_orc:{name:"High Orc",color:"#c0392b",sprite:"high_orc"},orc_warrior:{name:"Orc Warrior",color:"#5e8a3a",sprite:"orc_warrior"},orc_lady:{name:"Orc Lady",color:"#5e8a3a",sprite:"orc_lady"},...Object.fromEntries(this.mateDefs.map((t,s)=>[`m${s}`,{name:t.name,color:t.color,actor:()=>this.mates[s]??null}])),...Object.fromEntries(Hu.map((t,s)=>[t.key,{name:t.name,color:t.color,actor:()=>this.elite[s]??null}]))});this.begin(),this.blackout(1,0),B.music("prontera");const s=t.player,n=i=>{const r=Cl[i]??[];return{weapon:r.find(l=>{var d;return((d=fe[l])==null?void 0:d.slot)==="weapon"}),shield:r.find(l=>{var d;return((d=fe[l])==null?void 0:d.slot)==="shield"})}},o=[Wc,Yc,...Hu];this.ready=Promise.all([...this.mateDefs.map(i=>It(i.job,i.look,n(i.job))),...o.map(i=>It(i.job,i.look,i.equip)),It("gunslinger",J1,{weapon:lh}),It("gunslinger",Q1,{weapon:lh})]).then(i=>{const r=this.mateDefs.length;[this.lain,this.haru]=[0,1].map(d=>{const[h,u]=this.walkable(s.x+qv[d][0]*W,s.y+qv[d][1]*W);return this.addActor(new zi(i[r+o.length+d],h,u,"gunslinger"))}),this.lain.face(this.haru.x,this.haru.y),this.haru.face(this.lain.x,this.lain.y),this.mates=this.mateDefs.map((d,h)=>{const[u,p]=this.walkable(s.x+Cv[h][0]*W,s.y+Cv[h][1]*W);return this.addActor(new zi(i[h],u,p,d.job))}),this.mates.forEach((d,h)=>{const u=this.mates[h^1]??s;d.face(u.x,u.y)});const l=(d,h)=>this.addActor(new zi(i[r+h],0,0,d.base));this.captain=l(Wc,0),[this.captain.p.x,this.captain.p.y]=this.walkable(Gc.x,Gc.y),this.captain.face(s.x,s.y),this.knight=l(Yc,1),this.knight.p.view.visible=!1,this.elite=Hu.map((d,h)=>{const u=l(d,2+h);return u.p.view.visible=!1,u})}),this.start()}destroy(){super.destroy();for(const t of this.props)t.view.destroy({children:!0});for(const t of this.beasts)t.view.destroyed||t.view.destroy({children:!0})}step(t,s){var i,r;for(const l of this.mates)l.update(t);for(const l of this.elite)l.update(t);(i=this.captain)==null||i.update(t),(r=this.knight)==null||r.update(t);for(const l of this.props)l.update(t);for(const l of this.beasts)l.view.destroyed||l.updateView(t*1e3,this.g.time);const n=[this.lain,this.haru];if(s||this.phase!=="defend"){for(const l of n)l==null||l.update(t);return}n.forEach((l,d)=>l&&this.fight(l,d,t));const o=Math.max(0,Math.ceil(Nv-this.g.time));o!==this.shownSec&&(this.shownSec=o,this.questText(c("Aguanta el asalto orco junto al rey:  {
    time
  }
  ",{time:`${Math.floor(o/60)}:${String(o%60).padStart(2,"0")}`}))),this.g.time>=Nv&&this.cue("highOrc")}cue(t){t==="highOrc"&&this.phase==="defend"&&this.highOrc()}async start(){await this.ready;const s=this.g.player,n=this.captain,[o,i,r]=this.mates;this.begin(),await this.blackout(1,0),s.facingX=0,s.facingY=-1,this.cut(je.plazaHigh),await this.blackout(0,1.4),this.emote(o,_e.heart),this.emote(i,_e.ok),await this.pan(je.plazaHigh,je.plaza,2.2),this.cut(je.captain),await this.say("captain",c("¡Ahí estáis! Los héroes de los que habla todo el reino."));for(const h of this.mates)h.face(n.x,n.y);this.emote(r,_e.gasp),await this.say("captain",c("Su Majestad Tristan III os ha invitado a la boda de su hija con el príncipe Leopold, en agradecimiento por mantener la paz en Rune-Midgard.")),this.cut(je.group),await this.say("m0",c("¿Una boda real? Espero que haya buena comida.")),this.emote(i,_e.sweat),await this.say("m1",c(" {
    name
  }, por favor, intenta no avergonzarnos delante del rey.",{name:this.mateDefs[0].name})),this.emote(r,_e.dots),await this.say("m2",c("Dicen que el príncipe llegó de un reino lejano hace apenas unas semanas... y que nadie sabe gran cosa de él."));const[l,d]=[this.lain,this.haru];l.face(s.x,s.y),d.face(s.x,s.y),this.cut(this.over(s,d)),this.emote(d,_e.grats),await this.say("haru",c("¿Has visto, Lain? ¡Invitados por el rey en persona! Después de lo del barco ya somos famosos.")),this.cut(this.over(s,l)),this.emote(l,_e.sweat),await this.say("lain",c("Famosos por meterte tú solo en el camarote de un pirata... Hoy compórtate, que es una boda real.")),await this.say("lain",c("Me alegro de verte. Selene dice que lo del barco se lo contó al mismísimo rey.")),this.emote(d,_e.heh),await this.say("haru",c("Tranquila. ¿Qué puede salir mal en una boda?")),this.cut(je.captain),await this.say("captain",c("Seguidme. La ceremonia está a punto de empezar.")),this.hush(),this.cut(je.bridge),this.walkPath(n,[Gc,J(248,72),J(248,60)],150),await this.wait(.7),this.mates.forEach((h,u)=>{const p=h.x<Gc.x?-1:1,y=Math.floor(u/2);this.walkPath(h,[J(248+p*5,82),J(248+p*2.5,73),J(248+p*1.6,67+y*2)],165)}),this.walkPlayer([J(248,84),J(248,75),J(248,70)],165),this.walkPath(l,[J(246.5,86),J(246.5,77),J(246.5,73)],165),this.walkPath(d,[J(249.5,86),J(249.5,77),J(249.5,73)],165),await this.wait(3.2),await this.blackout(1,1),await this.wedding()}buildHall(){const t=this.captain;t.goal=null,[t.p.x,t.p.y]=this.walkable(Av.x,Av.y),t.face(Kt.x,Kt.y),this.king=this.npc("npc_king",Is.x,Is.y,Kt.x,Kt.y);const s=this.npc("npc_bishop",ls.x,ls.y,Kt.x,Kt.y),n=this.npc("npc_princess",Du.x,Du.y,ls.x,ls.y),o=this.npc("npc_prince",Lv.x,Lv.y,ls.x,ls.y);return this.guests=aP.map(i=>({n:this.npc(i.id,i.x,i.y,ls.x,(ls.y+Du.y)/2),dead:i.dead,orc:i.orc})),this.props.push(this.king,s,n,o,...this.guests.map(i=>i.n)),this.placePlayer(Kt.x,Kt.y,ls.x,ls.y),this.mates.forEach((i,r)=>{i.goal=null,[i.p.x,i.p.y]=this.walkable(Vc[r].x,Vc[r].y),i.face(ls.x,ls.y)}),[this.lain,this.haru].forEach((i,r)=>{i&&(i.goal=null,[i.p.x,i.p.y]=this.walkable(Iv[r].x,Iv[r].y),i.face(ls.x,ls.y))}),{bishop:s,princess:n,prince:o}}fallHall(t){for(const s of t)s.view.visible=!1;this.clearBeasts(),this.knight.p.view.visible=!1,this.king.swap("npc_king_hurt");for(const s of this.guests)s.dead?s.n.swap(s.dead):s.n.view.visible=!1;this.captain.hold="dead",this.mates.forEach((s,n)=>{s.goal=null,[s.p.x,s.p.y]=this.walkable(Vc[n].x+(n%3-1)*2*W,Vc[n].y+(2+n%4*2)*W),s.face(s.x+(n%2?1:-1),s.y+1),s.hold="dead"}),[this.lain,this.haru].forEach((s,n)=>{s&&(s.goal=null,s.hold=null,[s.p.x,s.p.y]=this.walkable(ca.x+(n?2.2:-2.2)*W,ca.y+1.4*W),s.face(s.x,s.y+100))})}async wedding(){const t=this.g,{bishop:s,princess:n,prince:o}=this.buildHall(),i=this.king;this.cut(je.hallHigh),await this.wait(.3),await this.blackout(0,1.4);for(const[p,y]of this.guests.entries())p%3===0&&this.emote(y.n,p%2?_e.heart:_e.grats);await this.pan(je.hallHigh,je.hall,2.4),this.cut(je.king),await this.say("king",c("Amigos, bienvenidos. Hoy no solo casamos a mi hija: también honramos a quienes han protegido este reino.")),this.emote(i,_e.heart),await this.say("king",c("Que esta unión traiga la paz entre nuestros pueblos. Obispo, cuando queráis.")),this.cut(je.altar),await this.say("bishop",c("Estamos reunidos ante Odín para unir a la princesa de Prontera y al príncipe Leopold.")),await this.say("bishop",c("Princesa, ¿aceptáis al príncipe Leopold como esposo, en la paz y en la guerra?")),this.cut(je.couple),this.emote(n,_e.heart),await this.say("princess",c("Sí, acepto.")),this.cut(je.altar),await this.say("bishop",c("Príncipe Leopold, ¿aceptáis a la princesa como esposa...?")),this.cut(je.couple),await this.say("prince",c("Yo...")),this.hush(),B.play("swordman_provoke",.5),B.music("glast");const r=this.knight;[r.p.x,r.p.y]=this.walkable(Wt[0].x,Wt[0].y),r.p.view.visible=!0,this.cut(je.entrance);for(const p of this.guests)p.n.y>J(0,52).y&&p.n.face(r.x,r.y);await this.walkPath(r,[J(60,62),J(66,57.5)],230),r.face(Is.x,Is.y);for(const p of this.guests)this.emote(p.n,_e.gasp);for(const p of this.mates)p.face(r.x,r.y);this.cut(je.knight),await this.say("guard",c("¡Majestad! ¡Majestad! ¡Hemos encontrado al príncipe Leopold... muerto en sus aposentos!")),this.cut(je.king),this.emote(i,_e.what),await this.say("king",c("¿Qué...? Pero si el príncipe está aquí, delante de mí..."));for(const p of this.guests)this.rnd()<.5&&this.emote(p.n,_e.what);const[l,d]=[this.lain,this.haru];l.face(d.x,d.y),d.face(o.x,o.y),this.cut(this.over(d,o)),this.emote(d,_e.dots),await this.say("haru",c("Si el príncipe está muerto... entonces, ¿quién es ese?")),this.emote(l,_e.gasp),await this.say("lain",c("Haru, no te muevas. Ese aire helado... es como en el barco.")),o.face(Kt.x,Kt.y),this.cut(je.prince),await this.say("prince",c("Je, je, je... Qué lástima. Con lo bien que iba la ceremonia.")),this.hush(),this.emote(n,_e.omg),t.addFx(Ye("fx_smoke",o.x,o.y,{add:!1,scale:1.6})),this.portal(o.x,o.y,[.4,.8,.3],1.3),B.play("ef_teleportation",.6),o.view.visible=!1;const h=this.beast("orc_hero",o.x,o.y);h.face(0,1),await this.wait(.9);for(const p of this.guests)this.emote(p.n,this.rnd()<.5?_e.omg:_e.wah);for(const p of this.mates)this.emote(p,_e.angry);await this.say("orc_hero",c("¡Humanos estúpidos! Un simple conjuro de cambio de forma y me abrís las puertas de vuestro castillo.")),this.cut(this.over(l,h)),this.emote(d,_e.angry),await this.say("haru",c("¡Lo sabía! ¡Ese príncipe olía a orco desde la entrada!")),await this.say("lain",c("¡Cuidado! ¡Va a por el rey!")),this.hush(),this.cut(je.blow),await this.walkBeast(h,Is.x+1.8*W,Is.y+2.2*W,200),h.face(Is.x-h.x,Is.y-h.y),h.setState("attack"),await this.wait(.25),B.play("ef_bash",.8),t.addFx(Ri(Is.x,Is.y-30)),t.shake(.3,5),i.swap("npc_king_hurt"),await this.wait(.6),this.idle(h),this.emote(n,_e.sob),this.cut(je.couple),await this.say("princess",c("¡Padre!")),this.cut(je.blow),await this.say("orc_hero",c("¡Orcos! ¡Al asalto! ¡Que no quede nadie en pie!")),this.hush(),this.cut(je.assault);const u=this.guests.filter(p=>p.orc);for(const p of u){t.addFx(Ye("fx_smoke",p.n.x,p.n.y,{add:!1,scale:1.3})),this.portal(p.n.x,p.n.y,[.4,.8,.3],1),p.n.view.visible=!1;const y=this.beast(p.orc,p.n.x,p.n.y);y.face(Kt.x-y.x,Kt.y-y.y)}B.play("ef_teleportation",.6);for(const p of this.guests)p.orc||this.emote(p.n,this.rnd()<.5?_e.omg:_e.wah);await this.wait(.7);for(const p of this.beasts.slice(-u.length))this.walkBeast(p,p.x+(Kt.x-p.x)*.45,p.y+(Kt.y-p.y)*.3,150);for(let p=0;p<10;p++){const y=Wt[p%2],w=this.beast(p%3===2?"orc_lady":"orc_warrior",y.x+(this.rnd()-.5)*3*W,y.y+this.rnd()*1.5*W);this.walkBeast(w,y.x+(this.rnd()-.5)*5*W,y.y-(6+this.rnd()*8)*W,140)}for(const p of this.guests)p.orc||this.emote(p.n,this.rnd()<.5?_e.wah:_e.sweat);for(const p of[...this.mates,l,d])p.face(Wt[p.x<Kt.x?0:1].x,Wt[0].y);l.p.attack(),d.p.attack(),B.play("gs_tripleaction",.3,2),await this.wait(2.2),await this.blackout(1,1),await this.say("princess",c("¡Soltadme! ¡Padre! ¡Padre...!"),!0),await this.say("orc_hero",c("La princesa se viene conmigo. Si el rey la quiere de vuelta, que venga a buscarla a las tierras de los orcos... si sobrevive."),!0),this.hush(),await this.aftermath([s,n,o])}async aftermath(t){const s=this.g;this.fallHall(t),this.placePlayer(ca.x,ca.y,Is.x,Is.y),this.cut(je.kingDown),await this.wait(.4),await this.blackout(0,1.4),await this.say("king_hurt",c("Mi hija... se la ha llevado..."));const[n,o]=[this.lain,this.haru];this.cut(this.over(this.g.player,n)),n.face(this.g.player.x,this.g.player.y),o.face(this.g.player.x,this.g.player.y),await this.say("lain",c("¡Sigues en pie! Los demás... no se mueven.")),this.emote(o,_e.angry),await this.say("haru",c("Esos orcos van a pagar por esto. Lain, tú cubre la izquierda. ¡Que no lleguen al rey!"));for(let i=0;i<sP;i++){const r=Wt[i%2];s.storySpawn(i%3===2?"orc_lady":"orc_warrior",r.x+(this.rnd()-.5)*3*W,r.y-this.rnd()*3*W)}this.cut(je.assault),await this.say("king_hurt",c("Los orcos siguen entrando... No dejes que lleguen hasta el trono...")),this.hush(),s.player.facingX=0,s.player.facingY=1,await this.backToPlayer(1.2),this.end(),this.phase="defend",this.quest(c("Aguanta el asalto orco junto al rey:  {
    time
  }
  ",{time:"1:30"}),null),s.storyLevels(tP,["potion","elixir","blessing","dish","deity"])}async highOrc(){this.phase="highorc";const t=this.g,s=this.g.player;t.fadeMobs(1/0,!0),this.target=null,this.begin(),await this.wait(.6),this.placePlayer(ca.x,ca.y+1.5*W,Wt[0].x,Wt[0].y),[this.lain,this.haru].forEach((d,h)=>{d&&(d.goal=null,[d.p.x,d.p.y]=this.walkable(s.x+(h?2.4:-2.4)*W,s.y-1*W),d.face(Wt[0].x,Wt[0].y))});const n=this.beast("high_orc",Pv.x,Pv.y);this.cut(je.entrance),await this.walkBeast(n,jv.x,jv.y,160),await this.walkBeast(n,Wt[0].x,Wt[0].y,140),await this.walkBeast(n,_v.x,_v.y,130),n.face(s.x-n.x,s.y-n.y),this.cut(je.duel),await this.say("high_orc",c("¿Este es el héroe que ha aguantado a mis guerreros? Mi señor Orc Hero me dejó tu cabeza de regalo.")),this.hush(),await this.walkBeast(n,s.x-1.2*W,s.y+3.8*W,200),n.face(s.x-n.x,s.y-n.y),n.setState("attack"),await this.wait(.3),B.play("ef_magnumbreak",.7),t.addFx(Ri(s.x,s.y-30,16756864)),t.shake(.35,6),s.castLock=600,s.sprite.play("hurt",!1,!0),s.hurtFlash=300;const o=[this.lain,this.haru];for(const d of o)d.hold="sit",d.face(n.x,n.y);await this.wait(.5),this.idle(n),this.cut(this.over(s,o[1])),await this.say("haru",c("Ugh... ¿Qué fuerza tiene este bicho...?")),await this.say("lain",c("¡Haru! ¡Levántate, por favor!")),this.hush();const i=[],r=[];this.cut(je.ring);for(let d=0;d<6;d++){const h=Wt[d%2],u=this.beast(d%2?"orc_lady":"orc_warrior",h.x+(this.rnd()-.5)*2*W,h.y),p=Math.PI*(.15+.7*d/5)+Math.PI,[y,w]=this.walkable(s.x+Math.cos(p)*5.5*W,s.y-Math.sin(p)*4.5*W);r.push(this.walkBeast(u,y,w,190).then(()=>u.face(s.x-u.x,s.y-u.y))),i.push(u)}await Promise.all(r),await this.wait(.5);for(const[d,h]of i.entries())setTimeout(()=>this.emote(h,d%2?_e.heh:_e.gg),d*140);await this.say("orc_warrior",c("¡Jo, jo, jo! ¿Este es el que nos ha tenido parados minuto y medio?")),await this.say("orc_lady",c("¡Te vamos a hacer pedazos y a colgarlos de las lámparas!")),this.cut(je.duel),await this.say("high_orc",c("Tres crías y ni un adulto que las proteja. ¡Acabad con ellos!")),this.hush();for(const d of i)d.setState("attack");await this.wait(.7);for(const d of i)this.idle(d);for(const d of Wt)this.portal(d.x,d.y-2*W,[1,.95,.7],1.6);B.play("ef_portal",.7,2);const l=[{x:n.x-2.4*W,y:n.y+1.8*W},{x:s.x-5.5*W,y:s.y+6.5*W},{x:s.x+2.5*W,y:s.y+1.5*W},{x:s.x+6*W,y:s.y+7*W}];this.elite.forEach((d,h)=>{const u=Wt[h<2?0:1];[d.p.x,d.p.y]=this.walkable(u.x+(h%2?1:-1)*W,u.y),d.p.view.visible=!0,d.hold=null,this.walk(d,l[h].x,l[h].y,300)}),this.cut(je.eliteIn),await this.say("paladin",c("¡Ni un paso más, orcos!"));for(const d of o)d.hold=null,d.face(this.elite[1].x,this.elite[1].y);this.emote(o[1],_e.omg),await this.say("haru",c("¡Es la élite de Prontera! ¡Y Selene va con ellos!")),this.emote(o[0],_e.thanks),await this.say("lain",c("¡Selene! ¡Estamos aquí!")),this.cut(this.over(o[0],this.elite[1])),this.elite[1].face(o[0].x,o[0].y),await this.say("professor",c("Habéis aguantado mucho más de lo que nadie esperaba. Quedaos detrás de nosotros: ahora nos toca a nosotros.")),this.hush(),await this.wait(.6);for(const d of this.elite)d.face(n.x,n.y);for(const d of i)d.face(this.elite[1].x-d.x,this.elite[1].y-d.y);await this.eliteFight(n,i),await this.kingPlea(),await this.ending()}async kingPlea(){const t=this.g,s=this.g.player,[n,o,i,r]=this.elite,[l,d]=[this.lain,this.haru],h=this.king;B.music("prontera"),this.clearBeasts(),this.placePlayer(ca.x,ca.y,h.x,h.y),[l,d].forEach((u,p)=>{u.goal=null,u.hold=null,this.walk(u,ca.x+(p?2.4:-2.4)*W,ca.y+1.2*W,180)}),this.cut(je.gather),this.walk(n,h.x+3*W,h.y+6*W,200),this.walk(o,h.x-3.5*W,h.y+7*W,200),this.walk(r,h.x+4*W,h.y+9*W,200),await this.walk(i,h.x-1.6*W,h.y+1.2*W,200);for(const u of[n,o,r])u.face(s.x,s.y);i.face(h.x,h.y),l.face(h.x,h.y),d.face(h.x,h.y),s.facingX=0,s.facingY=1,this.cut(this.over(s,n)),await this.say("paladin",c("Habéis aguantado contra toda una horda. No es poca cosa.")),this.emote(r,_e.ok),this.cut(je.kingDown),i.p.cast(),B.play("heal",.6),vg(t,h.x,h.y),await this.say("high_priest",c("Majestad, no os mováis. La herida es profunda, pero viviréis.")),await this.say("king_hurt",c("Mi hija... ese monstruo se ha llevado a mi hija...")),this.cut(this.over(d,h)),await this.say("haru",c("Lo vimos todo, Majestad. Orc Hero se la llevó... dijo que a las tierras de los orcos.")),this.emote(h,_e.sob),this.cut(je.kingDown),await this.say("king_hurt",c("Os lo ruego... traedla de vuelta.")),this.cut(this.over(s,n)),await this.say("paladin",c("Lo haremos, Majestad. Tenéis mi palabra.")),this.cut(this.over(s,l)),l.face(s.x,s.y),await this.say("lain",c("No pienso quedarme de brazos cruzados. ¿Verdad que tú tampoco?")),this.cut(this.over(s,o)),await this.say("professor",c("Dejad que los sanadores se ocupen del rey. Fuera: tenemos mucho que planear.")),this.hush()}async eliteFight(t,s){var q,R;const n=this.g,o=this.g.player,[i,r,l,d]=this.elite,h=s.filter(L=>L.x<o.x),u=s.filter(L=>L.x>=o.x),p=L=>{L.setState("hurt"),this.wait(.3).then(()=>!L.dead&&this.idle(L))},y=L=>L&&n.addFx(L);this.cut(this.over(d,h[0]??t)),await this.say("sniper",c("Seis orcos y uno grande. Me quedo con los de la izquierda.")),this.hush(),this.cut(je.fightLeft),d.p.cast();for(let L=0;L<3;L++){for(const j of h)y(Ap(j.x,j.y-20,Za("tex_pok2"),6,16773840,500,2*W,.3)),y(gc(j.x,j.y)),p(j);B.play("hit_arrow",.6,3),await this.wait(.16)}const w=h.reduce((L,j)=>L+j.x,0)/Math.max(1,h.length)||o.x,m=h.reduce((L,j)=>L+j.y,0)/Math.max(1,h.length)||o.y;d.face(w,m),d.p.attack(),B.play("hit_arrow",.8,2);const f=bg(2.3);f.tint=13152511,f.alpha=.85;const v={x:d.x+(w-d.x)*2.2,y:d.y+(m-d.y)*2.2};y(Ov(f,d,v,450,Math.PI)),await this.wait(.25);for(const L of h)y(gc(L.x,L.y)),L.setState("dead");await this.wait(.5),this.cut(this.over(r,u[0]??t)),r.face(((q=u[0])==null?void 0:q.x)??o.x,((R=u[0])==null?void 0:R.y)??o.y),r.p.cast(),y(ml(u$(r.x,r.y),r)),B.play("ef_beginspell",.6),await this.wait(.7),this.cut(je.fightRight);const x=u.reduce((L,j)=>L+j.x,0)/Math.max(1,u.length)||o.x,k=u.reduce((L,j)=>L+j.y,0)/Math.max(1,u.length)||o.y;B.play("magician_thunderstorm",.8);for(let L=0;L<14;L++){const j=this.rnd()*Math.PI*2,A=this.rnd()*3.5*W;if(p$(["ef_lightbolt"],.25,2),y(yt("str_lightning",x+Math.cos(j)*A,k+Math.sin(j)*A,.6,0)),L%3===0)for(const E of u)p(E);await this.wait(.16)}for(const L of u)L.setState("dead");await this.wait(.4),this.cut(this.over(l,o)),l.face(o.x,o.y),l.p.cast(),B.play("heal",.6),vg(n,o.x,o.y,()=>o),n.healPlayer(n.stats.maxHp),await this.wait(.5),B.play("ef_angelus",.5),y(ml(yt("str_angelus",o.x,o.y,.8,0),o)),await this.say("high_priest",c("Aguanta. Odín todavía no ha terminado contigo.")),this.hush(),this.cut(je.duelSide),i.face(t.x,t.y),t.face(i.x-t.x,i.y-t.y),i.p.cast(),B.play("ef_endure",.5),y(ml(yt("str_guardstance",i.x,i.y,.9,0),i)),await this.wait(.6);const M=Math.atan2(t.y-i.y,t.x-i.x);i.p.cast(),B.play("ef_shieldpress",.6),y(m$(n,i.x,i.y,M,3*W,.25,16773824)),y(wg(t.x,t.y)),p(t),await this.wait(.5);for(let L=0;L<2;L++)i.p.attack(),B.play("hit_sword",.7,2),y(yt("str_cross",t.x,t.y,.55,0)),y(gc(t.x,t.y)),p(t),await this.wait(.12);await this.wait(.3),t.setState("attack"),await this.wait(.25),B.play("ef_shieldpress",.7),y(wg(i.x,i.y-30)),n.shake(.25,4),await this.wait(.4),this.idle(t),this.cut(this.over(i,t)),await this.say("paladin",c("¡Ahora, todos a la vez!")),this.hush(),this.cut(je.finale),d.face(t.x,t.y),r.face(t.x,t.y),l.face(t.x,t.y),d.p.attack(),B.play("hit_arrow",.8,2);const $=bg(2.3);$.tint=13152511,y(Ov($,d,t,300,Math.PI)),await this.wait(.3),y(gc(t.x,t.y)),p(t),r.p.cast(),B.play("meteor",.7);for(let L=0;L<5;L++)y(f$(["str_meteor1","str_meteor2","str_meteor3","str_meteor4"],t.x+(this.rnd()-.5)*2.5*W,t.y+(this.rnd()-.5)*2.5*W,1.8,0)),L%2===0&&p(t),await this.wait(.2);l.p.cast(),B.play("magnus",.7);for(let L=0;L<3;L++)y(yt("str_cross",t.x,t.y,1,0)),p(t),await this.wait(.3);i.p.cast(),B.play("ef_signum",.8),Mn(n,i,4*W,16770442),y(yt("str_cross",i.x,i.y,4*W/110,0)),n.shake(.5,8),await this.wait(.4),t.setState("dead");const P=Object.values(se.sheetInfo("high_orc").action("die").sounds)[0];P&&B.play(P,.8),await this.wait(1.3)}async ending(){var w;this.phase="end";const t=this.g,s=this.g.player,n=t.player,[o,i,r,l]=this.elite,[d,h]=[this.lain,this.haru];t.mvpsKilled.push("high_orc"),await this.blackout(1,1),this.placePlayer(Kc.x,Kc.y,yi[0].x,yi[0].y),this.elite.forEach((m,f)=>{m.goal=null,m.hold=null,[m.p.x,m.p.y]=this.walkable(yi[f].x,yi[f].y),m.face(Kc.x,Kc.y)}),[d,h].forEach((m,f)=>{m.goal=null,m.hold=null,[m.p.x,m.p.y]=this.walkable(Bv[f].x,Bv[f].y),m.face(yi[0].x,yi[0].y)}),this.cut(je.gate),await this.wait(.3),await this.blackout(0,1.4),this.cut(this.over(s,o)),await this.say("paladin",c("El rey está a salvo con los sanadores de la iglesia. Pero la princesa sigue en poder de Orc Hero.")),this.cut(this.over(s,r)),await this.say("high_priest",c("Le hemos dado nuestra palabra a Su Majestad: la traeremos de vuelta. Y no hay tiempo que perder.")),this.cut(this.over(s,i)),await this.say("professor",c("Los orcos no salieron de la nada. Sus tribus se esconden en los campos de Geffen: allí empezaremos a buscar su paradero.")),this.cut(this.over(s,l)),await this.say("sniper",c("Salimos hacia Geffen al amanecer. Hay que investigar antes de que se la lleven más lejos.")),this.cut(this.over(s,h)),this.emote(h,_e.angry),await this.say("haru",c("¡Nosotros también vamos! Esta vez no pienso adelantarme... mucho.")),this.emote(d,_e.sweat),await this.say("lain",c("Haru... Selene, contad con nosotros. Le debemos mucho a este reino.")),this.cut(this.over(s,i)),this.emote(i,_e.ok),await this.say("professor",c("Contaba con ello. Y contigo también: hoy has demostrado de lo que eres capaz."));const u=t.look,p=no(t.classDef.id),y=u&&this.alreadyPromoted();if(y)this.cut(this.over(s,o)),await this.say("paladin",c("Ya llevas el uniforme de  {
    job
  }
  . Te esperamos en Geffen.",{job:y}));else if(!p.length||!u)this.cut(this.over(s,r)),await this.say("high_priest",c("Tu camino es distinto al nuestro... pero tu valor es el mismo. Ven con nosotros."));else{this.cut(this.over(s,o)),await this.say("paladin",c("Para lo que nos espera en Geffen no basta con lo que sabes ahora. Ha llegado el momento de dar el siguiente paso.")),this.cut(this.over(s,l)),await this.say("sniper",c("Elige tu camino.")),this.hush();const m=await this.choosePromotion(u.look.gender);t.promotion=m.id,t.recomputeStats();const f=await It(m.id,u.look,u.equip),v=this.over(o,n);this.cut(v),n.facingX=v.eye.x-n.x,n.facingY=v.eye.y-n.y,this.portal(n.x,n.y,[1,.95,.7],1.4),B.play("levelup",.7),await this.wait(.5),n.sprite.setSheets(f);for(const x of[...this.elite,d,h])this.emote(x,_e.grats);await this.wait(1),await this.say("paladin",c("Bienvenido a la élite,  {
    job
  }
  .",{job:Ct(m,u.look.gender)}))}(w=t.storyRewards)!=null&&w.call(t).length&&(this.cut(this.over(s,o)),await this.say("paladin",c("Y toma esto: la insignia de la patrulla de Prontera. En Geffen te abrirá todas las puertas.")),this.hush(),await this.chooseReward()),this.cut(je.gate),await this.say("lain",c("¡Nos vemos al amanecer, camino de Geffen!")),this.hush(),await this.wait(.5),document.body.classList.remove("cutscene"),document.getElementById("story").classList.add("hidden"),t.storyWin()}over(t,s){const n=t.x-s.x,o=t.y-s.y,i=Math.hypot(n,o)||1,r=7.5*W,l=2.2*W,d=t.x+n/i*r-o/i*l,h=t.y+o/i*r+n/i*l;return{eye:{x:d,y:h},h:4.6,at:{x:(t.x+s.x)/2,y:(t.y+s.y)/2},fov:40*Z1}}alreadyPromoted(){const t=this.g.look;return t!=null&&t.promotion?Ct(ge(t.promotion),t.look.gender):null}async choosePromotion(t){const s=document.getElementById("story");s.classList.add("hidden");const n=await Y1(this.g.classDef,t);return s.classList.remove("hidden"),n}fight(t,s,n){const o=this.g,i=this.g.player,[r,l]=[i.x+(s?2.2:-2.2)*W,i.y+1.4*W],d=Math.hypot(r-t.x,l-t.y);let h=0,u=0;if(d>15*W)[t.p.x,t.p.y]=this.walkable(r,l);else if(d>.6*W){const w=Math.min(1.3,d/(3*W))*180;h=(r-t.x)/d,u=(l-t.y)/d;const m=t.x+h*w*n,f=t.y+u*w*n;[t.p.x,t.p.y]=o.walk?o.walk.resolve(t.x,t.y,m,f):[m,f]}if(t.update(n,h,u),(this.shotCd[s]-=n)>0)return;let p=null,y=Rv;for(const w of o.enemiesInRadius(t.x,t.y,Rv)){const m=Math.hypot(w.x-t.x,w.y-t.y);w.hiddenUntil>o.time||m>=y||(p=w,y=m)}p&&(this.shotCd[s]=QA+s*.15,t.face(p.x,p.y),t.p.attack(),B.play("gs_tripleaction",.22,2),o.addFx(Ri(p.x,p.y-25*(p.def.scale??1))),o.damageEnemy(p,p.maxHp*ZA,{part:s?"Haru":"Lain",fromX:t.x,fromY:t.y,knock:50}))}addActor(t){return this.g.entityLayer.addChild(t.p.view),t}async walkPath(t,s,n){for(const o of s)await this.walk(t,o.x,o.y,n)}placePlayer(t,s,n,o){var l;this.loops.delete("walkPlayer");const i=this.g.player;[i.x,i.y]=this.walkable(t,s);const r=Math.hypot(n-i.x,o-i.y)||1;[i.facingX,i.facingY]=[(n-i.x)/r,(o-i.y)/r],(l=this.g.walk)==null||l.updateFlow(i.x,i.y)}walkPlayer(t,s=150){const n=this.g.player,o=t.map(r=>this.walkable(r.x,r.y));let i=this.clock;this.loop("walkPlayer",0,()=>{let r=s*(this.clock-i);for(i=this.clock;o.length&&r>0;){const[l,d]=o[0],h=Math.hypot(l-n.x,d-n.y);if(h<=r){[n.x,n.y]=[l,d],o.shift(),r-=h;continue}[n.facingX,n.facingY]=[(l-n.x)/h,(d-n.y)/h],n.x+=n.facingX*r,n.y+=n.facingY*r,r=0}if(!o.length){this.loops.delete("walkPlayer");return}n.sprite.play("walk"),n.castLock=120})}beast(t,s,n){const o=this.prop(t,s,n);return o.sprite.play("idle"),this.beasts.push(o),o}clearBeasts(){for(const t of this.beasts)t.view.destroyed||t.view.destroy({children:!0});this.beasts=[]}idle(t){t.view.destroyed||t.dead||(t.setState("move"),t.sprite.play("idle"))}walkBeast(t,s,n,o){const[i,r]=this.walkable(s,n),l="beast"+Math.random().toString(36).slice(2);let d=this.clock;return new Promise(h=>this.loop(l,0,()=>{if(t.view.destroyed){this.loops.delete(l),h();return}const u=o*(this.clock-d);d=this.clock;const p=Math.hypot(i-t.x,r-t.y);if(p<=u){[t.x,t.y]=[i,r],this.loops.delete(l),t.state==="move"&&t.sprite.play("idle"),h();return}t.state==="move"&&t.sprite.play("walk"),t.face(i-t.x,r-t.y),t.x+=(i-t.x)/p*u,t.y+=(r-t.y)/p*u}))}}function Ov(a,e,t,s,n=0){const[o,i]=g$(t.x-e.x,t.y-e.y);a.rotation=Math.atan2(i,o)+n;let r=0;const l={view:a,lift:40,anchor:{x:e.x,y:e.y},update(d){r+=d;const h=Math.min(1,r/s);return l.anchor={x:e.x+(t.x-e.x)*h,y:e.y+(t.y-e.y)*h},h>=1}};return l}const iP=new Set(["blessing","castHaste","haste","regen"]),rP=a=>2-1.7*er(Math.min(1,a),.7),lP=1,Dv=1.5,cP=.15,dP=6,Hv=.2,Fv=320,hP=1,Fu=["firebolt","lightning"],zv=10,Uv=3,Gv=.3,Vv=16765562,uP=.32,zu=.5,pP=16747066,mP=(a,e)=>yt(["str_firehit1","str_firehit2","str_firehit3"][Math.floor(ps()*3)],a,e,.5,0),fP=5,Uu=.5,gP=16767082,yP=.4,Xc=3*Os,Kv=aS,ji=10,vi=64,ex=32,Jc=29;let yn=ex;const Wv=1024;let Xs=new Int32Array(4097),Qc=new Int32Array(1024),Or=new Int32Array(1024);const Dr=[];let Yv=0,Xv=0,vn=0,Hr=0;const vP=3,bP={id:"potion",rank:0,isNew:!1,rarity:0},Gu=90,wP=320,kP=350,Jv=60,Vu=120,xP={high:140,mid:70,low:25},MP={high:10,mid:4,low:0},$P={high:120,mid:60,low:25},Qv=30,Zv=.2,SP=.5,mo=35,EP=hl(),Zc=7,Ku=900,bi=1024,Nf=30,bt=a=>`${Math.round(a*100)}%`,TP=.2,CP=.5,LP=.3,AP=.15,PP=1,e0=["arrow_shower","arrow_rain","arrow_repel"],jP={damage:{color:16738877,text:a=>We(`+${bt(a)} de daño`)},morale:{color:16756794,text:a=>We(`+${bt(a)} de daño (moral)`)},ambush:{color:12094176,text:a=>We(`+${bt(a)} de daño (emboscada)`)},speed:{color:7339976,text:a=>We(`+${bt(a)} de velocidad`)},lifesteal:{color:16738938,text:a=>We(`+${String(Math.round(a*1e3)/10).replace(".",",")}% de robo de vida`)},flee:{color:12099816,text:a=>We(`+${bt(a)} de Flee`)},armor:{color:12109536,text:a=>We(`+${Math.round(a)} de armadura`)},reduction:{color:16758858,text:a=>We(`-${bt(a)} de daño recibido`)},soulWard:{color:13154559,text:a=>We(`-${bt(a)} de daño recibido`)},brace:{color:14203274,text:a=>We(`-${bt(a)} de daño recibido`)},slow:{color:14203274,text:a=>We(`-${bt(a)} de velocidad`)},soulCharge:{color:13154559,text:a=>We(`+${Math.round(a)} objetivos en el próximo Soul Strike`)},targets:{color:16747069,text:a=>We(`+1 objetivo (quedan ${Math.round(a)})`)},regen:{color:8257405,text:a=>`+${Ee(a,1)} HP/s`},haste:{color:16769126,text:a=>We(`+${Math.round(a)} de Celeridad`)},adrenaline:{color:16758858,text:a=>We(`+${Math.round(a)} de Celeridad y +${Math.round(ES.dmg*100)}% de daño en Fan of Knives, Throw Stone y Sand Attack`)},crit:{color:16769126,text:a=>We(`+${bt(a)} de crítico`)},agiDex:{color:16769126,text:a=>We(`+${bt(a)} de AGI y de DEX`)},windWalk:{color:13628415,text:a=>We(`Doble casteo seguro (quedan ${Math.round(a)})`)},trueSight:{color:16771496,text:a=>We(`+${bt(LS)} de perforación y +${bt(a)} de daño crítico`)},immune:{color:13153535,text:()=>c("Inmune al daño")},shadowBasic:{color:11569888,text:a=>We(`Ataques básicos al ${Math.round(a*100)}% de daño`)},pickup:{color:10148095,text:a=>We(`+${String(Math.round(a/Os*10)/10).replace(".",",")} m de radio de recogida`)},blessing:{color:16769162,text:a=>We(`+${bt(a)} de daño`)},castHaste:{color:16769162,text:a=>We(`+${bt(a)} de rapidez de casteo`)},fervor:{color:16763210,text:a=>We(`Ataques básicos bendecidos: +${bt(CS)} de daño (quedan ${Math.round(a)})`)},wallRage:{color:14256730,text:a=>We(`Muro: +${bt(a)} de daño`)},lastBreath:{color:16773280,text:a=>We(`Último aliento: +${bt(a)} de daño`)},grace:{color:13172672,text:a=>We(`Gracia: tu siguiente Heal hace +${bt(a*TS)} de daño`)}},t0=520,_P=1,s0=16770286,a0=5,n0=1,qP=5e-4,IP=.1,RP=.0025,BP=944,NP=2*Os,OP=.03,DP=600,HP=.85,FP=1e3,zP=.015,UP=.15,GP=30,VP=45,KP=.85,WP=3,YP=25,XP=2,Wu=45;function wi(a){return a.elite||!!a.def.boss}const JP=.5,o0=150,i0=4,r0=12,Ka=class Ka{constructor(e,t,s,n,o,i="prontera"){g(this,"app");g(this,"world",new Je);g(this,"world3d");g(this,"entityLayer",new Je);g(this,"lure",null);g(this,"chargeDmg",0);g(this,"fxLayer",new Je);g(this,"numberLayer",new Je);g(this,"map");g(this,"stageId");g(this,"script");g(this,"warpFx",[]);g(this,"warpFxAt",0);g(this,"gate",null);g(this,"story",null);g(this,"look",null);g(this,"promotion",null);g(this,"storyRewards",null);g(this,"storyLoot",[]);g(this,"spawnHold",!1);g(this,"waveStart",0);g(this,"camFocus",null);g(this,"classDef");g(this,"events");g(this,"bounds");g(this,"player");g(this,"enemies",[]);g(this,"projectiles",[]);g(this,"pickups",[]);g(this,"bossBrains",new Map);g(this,"fx",[]);g(this,"numbers",[]);g(this,"scheduled",[]);g(this,"weapons",[]);g(this,"casts",[]);g(this,"claims",[]);g(this,"aimer",null);g(this,"passives",new Map);g(this,"passiveRank",new Map);g(this,"jobLabel","");g(this,"ext",{});g(this,"slots",[]);g(this,"basicAttack","");g(this,"weaponBasic","");g(this,"stats");g(this,"endless",null);g(this,"endlessUps",null);g(this,"hp");g(this,"level",1);g(this,"exp",0);g(this,"expNext",au(1));g(this,"time",0);g(this,"kills",0);g(this,"state","playing");g(this,"pickDeadline",0);g(this,"pendingLevelUps",0);g(this,"afterLevels",null);g(this,"bosses",[]);g(this,"zoom",1);g(this,"god",!1);g(this,"hiddenUntil",0);g(this,"buffs",new Map);g(this,"hideTotal",0);g(this,"buffAuras",new Map);g(this,"stillTime",0);g(this,"keys",new Set);g(this,"ambient");g(this,"mapEffects");g(this,"walk");g(this,"atmosphere");g(this,"gloom");g(this,"hall");g(this,"mapFires",[]);g(this,"touchMove",{x:0,y:0});g(this,"mouse",null);g(this,"isRotating",()=>!1);g(this,"movePath",null);g(this,"grid",new Map);g(this,"spawnAcc",0);g(this,"nextBoss",0);g(this,"deathTimer",0);g(this,"closeAt",-1);g(this,"lootUntil",-1);g(this,"mvpUntil",-1);g(this,"meteorAcc",0);g(this,"meteorsOn",!1);g(this,"gemTextures");g(this,"loadout");g(this,"dmgLog",new Map);g(this,"dmgSince",new Map);g(this,"dmgMax",new Map);g(this,"dotSeen",!1);g(this,"runItems",new nn);g(this,"pulls",[]);g(this,"bastion",null);g(this,"yggdrasil",null);g(this,"fireRings",[]);g(this,"holyTrails",[]);g(this,"chargeUntil",0);g(this,"chargeLevel",0);g(this,"lifestealLeft",0);g(this,"lifestealReset",0);g(this,"zeny",0);g(this,"chestsOpened",0);g(this,"bossKills",0);g(this,"mvpsKilled",[]);g(this,"killsBy",new Map);g(this,"coop",null);g(this,"perksLeft",{reroll:0,reroll_card:0,banish:0,focus:0,deity:0});g(this,"perksMax",{});g(this,"banished",new Set);g(this,"focused",new Set);g(this,"banishedItems",new Set);g(this,"focusedItems",new Set);g(this,"lastMeatAt",0);g(this,"charExp",new Rf({level:1,exp:0}));g(this,"runLoot",[]);g(this,"mobLoot",0);g(this,"runCards",[]);g(this,"runEggs",[]);g(this,"pet",null);g(this,"noEgg",new Set(hT()));g(this,"revivesUsed",0);g(this,"chestMsgCd",0);g(this,"nextEliteAt",Wu);g(this,"difficulty",{...Ta});g(this,"eliteEvery",Wu);g(this,"hordeEvery",Vu);g(this,"nextHordeAt",Vu);g(this,"bossArena",!1);g(this,"openingChest",null);g(this,"openingCost",0);g(this,"dieSounds",new Map);g(this,"cleanup",[]);g(this,"stepAcc",0);g(this,"ticks",0);g(this,"runCtx",E$());g(this,"shakeLeft",0);g(this,"shakeAmp",0);g(this,"levelUpQueued",!1);g(this,"wings",null);g(this,"lastFrame",performance.now());g(this,"hpBars",new Map);g(this,"playerBar",null);g(this,"deterministic",!1);g(this,"moves",[]);g(this,"replayMoves",null);g(this,"moveTicks",0);g(this,"seed",0);g(this,"checks",[]);g(this,"netDead",new Set);g(this,"lastSiege",-1);g(this,"looseSiege",new Map);g(this,"regen5Left",a0);g(this,"healShown",0);g(this,"healFlush",n0);g(this,"critFxCount",0);var E,C,_,U,D;this.app=e,this.loadout=n,this.classDef=t,this.events=o,this.stageId=i,this.script=et[i],this.map=se.maps.get(this.script.map);const r=this.map.width*De,l=this.map.height*De;this.bounds={x0:Zc*De,y0:Zc*De,x1:r-Zc*De,y1:l-Zc*De},this.world3d=new iw(this.map,document.getElementById("stage")),this.ambient=new tk(this.map),this.mapEffects=new Q2(this.map);const d=this.map.walk;this.walk=d?new sk(d.w,d.h,d.mask):null,(E=this.walk)==null||E.setWarps(this.map.warps),this.warpFx=this.map.warps.map(I=>({x:(I.from[0]+.5)*(De/2),y:(I.from[1]+.5)*(De/2)}));const h=this.script.gate;if(h&&this.walk){const I=N=>this.map.warps.findIndex(V=>V.name===N);this.gate={down:I(h.down),up:I(h.up),open:!1,crossed:!1},this.walk.setWarpOpen(this.gate.down,!1),this.walk.setWarpOpen(this.gate.up,!1)}this.atmosphere=dv(this.map.name)?new cv(this.world3d):null;const u=this.script.mood;this.gloom=u==="gloom"?new Oc(this.world3d):u==="cave"||u==="sewer"||u==="sea"?new Oc(this.world3d,u==="cave"?hv:u==="sewer"?uv:pv,this.map.fires):null,u==="sea"&&this.world3d.useRswGroundLight(),this.hall=u==="hall"?new aA(this.world3d,Z5):null,this.mapFires=this.map.fires.map(I=>({...I,fx:null})),this.entityLayer.sortableChildren=!0,this.world.addChild(this.fxLayer,this.numberLayer),e.stage.addChild(this.world),this.atmosphere&&e.stage.addChild(this.atmosphere.view),this.gloom&&e.stage.addChild(this.gloom.view),this.hall&&e.stage.addChild(this.hall.view),this.gemTextures={gem_blue:se.iconTextures.get("gem_blue"),gem_yellow:se.iconTextures.get("gem_yellow"),gem_red:se.iconTextures.get("gem_red"),meat:se.iconTextures.get("meat"),zeny:se.sheet("fx_coin").action("a0").dirs[0][0],chest:se.sheet("chest_wood").action("a0").dirs[0][0],magnet:se.itemTextures.get(BP)};for(const I of Object.keys(Be)){if(!se.manifest.sprites[I])continue;const N=se.sheetInfo(I).action("die").sounds,V=Object.values(N)[0];V&&this.dieSounds.set(I,V)}this.player=new Al(t,s);const p=this.script.story?this.script.start??this.map.start:this.script.start??null,y=p?[(p[0]+.5)*(De/2),(p[1]+.5)*(De/2)]:[r/2,l/2];[this.player.x,this.player.y]=this.walk?this.walk.nearestWalkable(y[0],y[1]):[y[0],y[1]],this.entityLayer.addChild(this.player.view),n.pet&&(this.pet=new Bf(Yn(n.pet),this.player.x,this.player.y),this.entityLayer.addChild(this.pet.view)),this.recomputeStats(),this.hp=this.stats.maxHp;const w=this.weaponBasic=y$((C=n.weapon)==null?void 0:C.wtype),m=(U=(_=ce[w])==null?void 0:_.tags)==null?void 0:U.includes("melee");this.basicAttack=this.stats.infuse?m?v$:b$:w,this.addWeapon(this.basicAttack,!1);const f=this.weapons.find(I=>I.id===this.basicAttack);f&&w$(f,w);for(const I of n.starts){let N=this.weapons.find(V=>V.id===I.skill);if(!N&&((D=ce[I.skill])!=null&&D.create)&&this.slots.length<this.maxSkills&&(this.addWeapon(I.skill),N=this.weapons[this.weapons.length-1]),!!N)for(;N.rank<I.level;){const V=N.rollUpgrade();if(!V)break;N.applyUpgrade(V)}}for(const I of ro.start)I(this);const v=I=>{var V;if(((V=I.target)==null?void 0:V.tagName)==="INPUT")return;const N=I.key.toLowerCase();this.keys.add(N)},x=I=>this.keys.delete(I.key.toLowerCase()),k=()=>this.keys.clear();window.addEventListener("keydown",v),window.addEventListener("keyup",x),window.addEventListener("blur",k);const M=e.canvas;let $=null;this.isRotating=()=>$!==null;const P=I=>{I.button===2&&($=I.clientX)},q=I=>{$!==null&&(qe.targetYaw-=(I.clientX-$)*.005,$=I.clientX)},R=I=>{I.button===2&&($=null)},L=I=>I.preventDefault(),j=I=>{I.preventDefault(),this.zoomBy(Eg(-I.deltaY*.001))};M.addEventListener("pointerdown",P),window.addEventListener("pointermove",q),window.addEventListener("pointerup",R),M.addEventListener("contextmenu",L),M.addEventListener("wheel",j,{passive:!1}),this.mouse=Qe?null:new ek(M,this.world3d,e.stage,{moveTo:(I,N)=>this.moveTo(I,N),rotating:()=>this.isRotating()});const A=Qe?new rw(M,{move:this.touchMove,rotateBy:I=>qe.targetYaw+=I,zoomBy:I=>this.zoomBy(I),holdKey:(I,N)=>N?this.keys.add(I):this.keys.delete(I),tap:(I,N)=>{const V=M.getBoundingClientRect(),F=this.world3d.pickGround(I-V.left,N-V.top);F&&this.moveTo(F.x,F.y)}}):null;this.cleanup.push(()=>{window.removeEventListener("keydown",v),window.removeEventListener("keyup",x),window.removeEventListener("blur",k),M.removeEventListener("pointerdown",P),window.removeEventListener("pointermove",q),window.removeEventListener("pointerup",R),M.removeEventListener("contextmenu",L),M.removeEventListener("wheel",j),A==null||A.destroy()}),B.music(this.script.bgm),this.script.story==="sunken"?this.story=new JA(this):this.script.story==="castle"&&(this.story=new oP(this)),n.missingWeapon&&setTimeout(()=>o.onAnnounce(c("¡Sin  {
    what
  }
   no puedes atacar!",{what:c(n.missingWeapon)})),300)}get waveTime(){return Math.max(0,this.time-this.waveStart)}get maxSkills(){return ow(this.classDef.rank)}releaseKeys(){this.keys.clear()}ignite(e,t,s){if(t<=0)return;this.dotSeen=!0,t*=1+this.stats.dotDmg;const n=e.burnUntil>this.time?e.burnDps*(e.burnUntil-this.time):0;e.burnDps=(n+t)/zv,e.burnUntil=this.time+zv,e.burnSrc=s}logDamage(e,t,s,n){const o=s;if(o<=0)return;const i=e??"otros";this.dmgSince.has(i)||this.dmgSince.set(i,this.time);let r=this.dmgLog.get(i);r||this.dmgLog.set(i,r=new Map),r.set(t,(r.get(t)??0)+o);const l=`${i}|${t}`;o>(this.dmgMax.get(l)??0)&&this.dmgMax.set(l,o)}snapshot(){const e=this.openingChest?1:0,t=this.charExp;return{v:1,savedAt:Date.now(),stage:this.stageId,gate:this.gate?{open:this.gate.open,crossed:this.gate.crossed}:void 0,difficulty:{...this.difficulty},time:this.time,level:this.level,exp:this.exp,expNext:this.expNext,pendingLevelUps:this.pendingLevelUps,hp:this.hp,zeny:this.zeny+(e?this.openingCost:0),kills:this.kills,bossKills:this.bossKills,mvpsKilled:[...this.mvpsKilled],killsBy:[...this.killsBy],perks:{left:{...this.perksLeft},banished:[...this.banished],focused:[...this.focused],banishedItems:[...this.banishedItems],focusedItems:[...this.focusedItems]},dmgLog:[...this.dmgLog].map(([s,n])=>[s,[...n]]),dmgSince:[...this.dmgSince],dmgMax:[...this.dmgMax],chestsOpened:this.chestsOpened-e,revivesUsed:this.revivesUsed,nextBoss:this.nextBoss,mvpUntil:this.mvpUntil,nextEliteAt:this.nextEliteAt,player:{x:this.player.x,y:this.player.y},charExp:{base:t.base,job:t.job,level:t.level,exp:t.exp},weapons:this.weapons.map(s=>s.saveState()),slots:[...this.slots],passives:[...this.passives],passiveRank:[...this.passiveRank],runItems:[...this.runItems.slots].map(([s,n])=>[s,{...n,vals:[...n.vals]}]),runLoot:[...this.runLoot],mobLoot:this.mobLoot,runCards:[...this.runCards],runEggs:[...this.runEggs],bosses:this.bosses.filter(s=>!s.dead).map(s=>({id:s.def.id,hp:s.hp,maxHp:s.maxHp,x:s.x,y:s.y})),pickups:this.pickups.flatMap(s=>!s.dead&&(s.kind==="chest"||s.kind==="loot"||s.kind==="card"||s.kind==="egg")?[{kind:s.kind,x:s.x,y:s.y,ref:s.ref,quality:s.quality,...s.src?{src:s.src}:{}}]:[])}}setDifficulty(e){this.difficulty=gr(e),this.eliteEvery=Wu/this.difficulty.events,this.hordeEvery=Vu/this.difficulty.events,this.nextEliteAt=fo(this.time,this.eliteEvery),this.nextHordeAt=fo(this.time,this.hordeEvery)}restore(e){var s;this.setDifficulty(e.difficulty??Ta),this.time=e.time,this.level=e.level,this.exp=e.exp,this.expNext=e.expNext,this.zeny=e.zeny,this.kills=e.kills,this.bossKills=e.bossKills,this.mvpsKilled=[...e.mvpsKilled??[]],this.killsBy=new Map(e.killsBy??[]),e.perks&&(this.perksLeft={...this.perksLeft,...e.perks.left},this.banished=new Set(e.perks.banished),this.focused=new Set(e.perks.focused),this.banishedItems=new Set(e.perks.banishedItems??[]),this.focusedItems=new Set(e.perks.focusedItems??[])),this.gate&&e.gate&&(this.gate.open=e.gate.open&&!e.gate.crossed,this.gate.crossed=e.gate.crossed,(s=this.walk)==null||s.setWarpOpen(this.gate.down,this.gate.open));for(const[n,o]of e.dmgLog??[])this.dmgLog.set(n,new Map(o));for(const[n,o]of e.dmgSince??[])this.dmgSince.set(n,o);for(const[n,o]of e.dmgMax??[])this.dmgMax.set(n,o);this.chestsOpened=e.chestsOpened,this.revivesUsed=e.revivesUsed,this.nextBoss=e.nextBoss,this.mvpUntil=e.mvpUntil??-1,this.nextEliteAt=e.nextEliteAt,this.nextHordeAt=fo(e.time,this.hordeEvery),this.bossArena=e.nextBoss>=this.script.bosses.length,Object.assign(this.charExp,e.charExp),this.runLoot=[...e.runLoot],this.mobLoot=e.mobLoot??e.runLoot.length,this.runCards=[...e.runCards],this.runEggs=[...e.runEggs??[]];for(const n of this.runEggs)for(const o of Object.values(Ca))o.egg===n&&this.noEgg.add(o.id);const t=this.weapons.find(n=>n.id===this.basicAttack);for(const n of this.weapons)n!==t&&n.destroy(this);this.weapons=t?[t]:[];for(const n of e.weapons){if(Ao(n.id)){t&&n.id===t.id&&t.loadState(n);continue}const o=ce[n.id];if(!(o!=null&&o.create))continue;const i=o.create();i.loadState(n),this.weapons.push(i)}this.slots=e.slots.filter(n=>ce[n]),this.passives=new Map(e.passives),this.passiveRank=new Map(e.passiveRank),this.runItems.slots.clear();for(const[n,o]of e.runItems)this.runItems.slots.set(n,{...o,vals:[...o.vals]});this.recomputeStats(),this.hp=Math.max(1,Math.min(this.stats.maxHp,e.hp)),[this.player.x,this.player.y]=this.walk?this.walk.nearestWalkable(e.player.x,e.player.y):[e.player.x,e.player.y];for(const n of e.bosses){const o=Be[n.id];if(!o)continue;const i=new hd(o,n.x,n.y,1,!1);i.damage=Math.round(i.damage*this.difficulty.damage*(this.script.mobDmg??1)),i.maxHp=n.maxHp,i.hp=n.hp,this.enemies.push(i),this.entityLayer.addChild(i.view),this.bossBrains.set(i,new _c(i)),this.bosses.push(i)}this.bosses.length&&(this.events.onBosses(this.bosses),this.bosses.some(n=>n.def.boss==="mvp")&&B.music("boss"));for(const n of e.pickups)this.dropPickup(n.kind,n.x,n.y,0,n.ref,n.quality,n.src);this.pendingLevelUps=e.pendingLevelUps,this.pendingLevelUps>0&&(this.state="levelup",this.events.onLevelUp(this.rollChoices()))}takeHost(){const e=this.bosses.map(s=>s.def.id);let t=0;for(const s of this.script.bosses){const n=e.indexOf(s.id);if(n<0)break;e.splice(n,1),t++}this.nextBoss=Math.max(this.nextBoss,t),this.bossArena=this.nextBoss>=this.script.bosses.length,this.nextEliteAt=fo(this.time,this.eliteEvery),this.nextHordeAt=fo(this.time,this.hordeEvery);for(const s of this.bosses)!s.dead&&!this.bossBrains.has(s)&&this.bossBrains.set(s,new _c(s))}debugStart(e,t){this.time=e,this.god=t,this.nextBoss=this.script.bosses.findIndex(s=>s.t>=e),this.nextBoss<0&&(this.nextBoss=this.script.bosses.length),this.nextEliteAt=fo(e,this.eliteEvery),this.nextHordeAt=fo(e,this.hordeEvery)}destroy(){const e=[()=>{var t;return(t=this.story)==null?void 0:t.destroy()},()=>{var t;return(t=this.endless)==null?void 0:t.destroy()},...this.cleanup,()=>{var t;return(t=this.mouse)==null?void 0:t.destroy()},...this.weapons.map(t=>()=>t.destroy(this)),()=>this.app.stage.removeChild(this.world),()=>{var t;return(t=this.atmosphere)==null?void 0:t.destroy()},()=>{var t;return(t=this.gloom)==null?void 0:t.destroy()},()=>{var t;return(t=this.hall)==null?void 0:t.destroy()},()=>{qe.rig=null,document.body.classList.remove("cutscene")},()=>this.world.destroy({children:!0}),()=>this.entityLayer.destroy({children:!0}),()=>this.world3d.dispose()];for(const t of e)try{t()}catch(s){console.error("[destroy]",s)}}recomputeStats(){var i,r,l,d,h;const e=((i=this.stats)==null?void 0:i.maxHp)??this.classDef.hp,t=fs(this.classDef);(r=this.loadout)==null||r.applyStats(t),this.runItems.apply(t);for(const[u,p]of this.passives)(d=(l=ce[u])==null?void 0:l.passive)==null||d.call(l,t,p);const s=this.buffValue("agiDex");t.agi*=1+s,t.dex*=1+s;const n=this.promotion??((h=this.look)==null?void 0:h.promotion);zm(t,(n?ge(n):this.classDef).rank);const o=Math.max(0,this.level-1);t.damageMult*=1+xh*o,t.maxHp*=1+Um*o,this.endlessUps&&O5(t,this.endlessUps),t.extraProjectiles=Math.floor(t.extraProjectiles+1e-6),t.revives=Math.floor(t.revives+1e-6),t.chestDiscount=Math.min(.6,t.chestDiscount),t.damageReduction=Math.min(.6,t.damageReduction),t.flee=Math.min(.5,t.flee),Wb(t),t.maxHp=Math.max(30,Math.round(t.maxHp)),t.regen5+=t.maxHp*t.regenPct5,k$(t.discovery),this.stats=t,this.hp!==void 0&&(t.maxHp>e&&(this.hp+=t.maxHp-e),this.hp=Math.min(this.hp,t.maxHp))}addWeapon(e,t=!0){const s=ce[e];if(!(s!=null&&s.create))throw new Error(`Habilidad activa desconocida: ${e}`);const n=this.coldClone(e)?ce.coldbolt.create(e):s.create();n.element=this.elementFor(e,n),this.weapons.push(n),t&&this.slots.push(e)}elementFor(e,t){var s;return this.coldClone(e)?"water":e==="thunderstorm"&&((s=this.stats)!=null&&s.firestorm)?"fire":(t==null?void 0:t.element)??x$(e)}coldClone(e){var t;return!!((t=this.stats)!=null&&t.allColdBolt)&&Fu.includes(e)}skillDef(e){return ce[this.coldClone(e)?"coldbolt":e]}modKey(e){return this.coldClone(e)?"coldbolt":e}coldGroup(e){var t;return!((t=this.stats)!=null&&t.allColdBolt)||e!=="coldbolt"&&!Fu.includes(e)?[]:["coldbolt",...Fu].filter(s=>s!==e)}isFire(e){return pl(e.id)?cd(this.stats).includes("fire"):this.elementFor(e.id,e)==="fire"}skillTalents(e,t=!0){var i,r;const s=((r=(i=this.loadout)==null?void 0:i.skillTalents)==null?void 0:r[Ao(e)?Sp:this.modKey(e)])??[],o=[...(pl(e)?cd(this.stats):[this.elementFor(e)]).map(l=>kg(l)),...t?this.conduitOthers(e):[]];return[...s,...o.flatMap(l=>{var d,h;return((h=(d=this.loadout)==null?void 0:d.skillTalents)==null?void 0:h[l])??[]})]}conduitOthers(e){var s;const t=xg.findIndex(n=>Mg[n]===e);return t<0||!((((s=this.stats)==null?void 0:s.boltConduit)??0)&1<<t)?[]:xg.map(n=>Mg[n]).filter(n=>n!==e)}sharedUpgrades(e){const t=[...new Set([...this.conduitOthers(e.id),...this.coldGroup(e.id)])].map(n=>this.weapons.find(o=>o.id===n)).filter(n=>!!n);if(!t.length)return{up:e.up,rank:e.rank};const s={...M$()};for(const n of[e,...t])for(const o of Object.keys(s))s[o]+=n.up[o];return{up:s,rank:e.rank+t.reduce((n,o)=>n+o.rank-1,0)}}skillMod(e,t=!0){var u;const s=this.weapons.find(p=>p.id===e),n=t?this.conduitOthers(e):[],o=((u=this.loadout)==null?void 0:u.mods[Ao(e)?Sp:this.modKey(e)])??EP,r=[...(pl(e)?cd(this.stats):[this.elementFor(e,s)]).map(p=>kg(p)),...n].reduce((p,y)=>{var m;const w=(m=this.loadout)==null?void 0:m.mods[y];return w?$g(p,w):p},o),l=(p,y)=>p.poison||p.bleed?{...p,tags:{...p.poison?{poison:y}:{},...p.bleed?{bleed:y}:{}}}:p,d={...r,hit:l(r.hit,"talento")};return[s,...new Set([...n,...this.coldGroup(e)])].map(p=>typeof p=="string"?this.weapons.find(y=>y.id===p):p).reduce((p,y)=>{const w=y&&this.runItems.deityMod(y);return w?$g(p,{...w,hit:l(w.hit,"Deity")}):p},d)}chestCost(){const e=this.chestsOpened;return Math.round((30+25*e+1.5*e*e)*(1-this.stats.chestDiscount))}rollChest(){return this.runItems.roll(this.deityLearned(),this.chestOpts())}deityLearned(){return this.slots.filter(e=>ul(e)&&!this.coldClone(e))}chestOpts(){return{swap:this.perksLeft.deity>0,banished:this.banishedItems,focused:this.focusedItems,useless:this.uselessItems()}}uselessItems(){let e=!1,t=!1,s=!1,n=!1;for(const r of this.weapons)r.has("melee")&&(e=!0),r.has("cast")&&(t=!0),(r.has("physical")||r.has("hybrid")||$$.has(r.id))&&(s=!0),(r.has("magic")||r.has("hybrid")||S$.has(r.id))&&(n=!0);const o=new Set,i=r=>{for(const l of r)o.add(l)};return e||i(Eo.melee),this.dotSeen||i(Eo.dot),t||i(Eo.cast),s||i(Eo.str),n||i(Eo.int),o}rerollChest(){return this.perksLeft.reroll<=0?null:(this.perksLeft.reroll--,this.rollChest())}canRerollChestCard(e){return!!on[e.item]||this.perksLeft.deity>0||e.refine===0}rerollChestCard(e){if(this.perksLeft.reroll_card<=0||!this.canRerollChestCard(e))return null;const t=this.runItems.rollSlot(e.slot,this.deityLearned(),this.chestOpts());return t&&this.perksLeft.reroll_card--,t}banishChestCard(e,t){return this.perksLeft.banish<=0?null:(this.perksLeft.banish--,this.banishedItems.add(e.item),this.focusedItems.delete(e.item),this.runItems.roll(this.deityLearned(),this.chestOpts(),1,t.map(n=>n.slot))[0]??this.runItems.rollSlot(e.slot,this.deityLearned(),this.chestOpts()))}focusChestCard(e){return this.perksLeft.focus<=0||this.focusedItems.has(e.item)?!1:(this.perksLeft.focus--,this.focusedItems.add(e.item),!0)}runItemName(e,t){var s,n;return((s=on[t])==null?void 0:s.name)??(e==="deity"?`${((n=ce[t])==null?void 0:n.name)??t} Deity`:t)}chooseChest(e){if(e||(this.zeny+=this.openingCost),e){this.runItems.choose(e),this.recomputeStats(),B.play(e.refine>0?"ef_blessing":"ef_steal",.5);const t=this.runItemName(e.slot,e.item);this.events.onLoot(e.refine>0?`${t} +${e.refine}`:`¡${t}!`,e.quality)}this.openingChest&&(this.openingChest.dead=!0),this.openingChest=null,this.state="playing"}tryOpenChest(e){var i;const t=this.chestCost();if(this.zeny<t){this.chestMsgCd<=0&&(this.events.onLoot(c("Necesitas  {
    have
  }
  / {
    cost
  }
   zeny para abrir el cofre",{have:this.zeny,cost:t})),this.chestMsgCd=2.5);return}const s=this.rollChest();if(!s.length){e.dead=!0,this.gainExp(30);return}const n=le()<this.stats.freeChest,o=n?0:t;n&&this.events.onLoot(c("¡Cofre gratis!")),this.zeny-=o,this.chestsOpened++,this.openingChest=e,this.openingCost=o,B.play("ef_coin",.5),this.state="levelup",this.events.onChest(s,o),(i=this.coop)==null||i.chestOpened(o)}skillLevel(e){var t;return((t=this.weapons.find(s=>s.id===e))==null?void 0:t.rank)??this.passiveRank.get(e)??0}rollChoices(){const e=this.upgradeChoices(),t=this.freshChoices(),s=[],n=t.findIndex(i=>i.id===this.classDef.start);n>=0&&!this.slots.length?s.push(t.splice(n,1)[0]):t.length&&s.push(this.takeChoice(t));const o=[...t,...e];for(;s.length<3&&o.length;)s.push(this.takeChoice(o));return s.length||s.push(bP),s.sort((i,r)=>Number(r.isNew)-Number(i.isNew))}upgradeChoices(){const e=[];for(const t of this.weapons){if(this.banished.has(t.id))continue;const s=t.rollUpgrade();s&&e.push({id:t.id,rank:t.rank+1,isNew:!1,rarity:s.rarity,upgrade:s})}for(const[t,s]of this.passiveRank){if(this.banished.has(t))continue;const n=Sg();e.push({id:t,rank:s+1,isNew:!1,rarity:n,power:Ii[n].mult})}return e}freshChoices(){var t;const e=[];if(this.slots.length>=this.maxSkills)return e;for(const{id:s}of lw(this.classDef.id,this.loadout.learned))ce[s].needsShield&&!this.loadout.shield||ce[s].weapons&&!ce[s].weapons.includes(((t=this.loadout.weapon)==null?void 0:t.wtype)??"")||!this.skillLevel(s)&&!this.banished.has(s)&&e.push({id:s,rank:1,isNew:!0,rarity:0,power:1});return e}takeChoice(e){const t=o=>this.focused.has(o.id)?vP:1;let s=le()*e.reduce((o,i)=>o+t(i),0),n=0;for(;n<e.length-1&&(s-=t(e[n]))>=0;)n++;return e.splice(n,1)[0]}rerollDeck(){return this.perksLeft.reroll<=0?null:(this.perksLeft.reroll--,this.rollChoices())}canRerollCard(e){return!e.isNew&&e.id!=="potion"}rerollCard(e){if(this.perksLeft.reroll_card<=0||!this.canRerollCard(e))return null;let t=null;const s=this.weapons.find(n=>n.id===e.id);if(s){const n=s.rollUpgrade();n&&(t={...e,rarity:n.rarity,upgrade:n})}else{const n=Sg();t={...e,rarity:n,power:Ii[n].mult}}return t&&this.perksLeft.reroll_card--,t}banishCard(e,t){if(this.perksLeft.banish<=0||e.id==="potion")return null;this.perksLeft.banish--,this.banished.add(e.id),this.focused.delete(e.id);const s=[...this.freshChoices(),...this.upgradeChoices()].filter(n=>!t.some(o=>o.id===n.id));return s.length?this.takeChoice(s):null}focusCard(e){return this.perksLeft.focus<=0||e.id==="potion"||this.focused.has(e.id)?!1:(this.perksLeft.focus--,this.focused.add(e.id),!0)}choose(e){if(e.id==="potion")this.healPlayer(50);else if(ce[e.id].kind==="weapon"){const t=this.weapons.find(s=>s.id===e.id);t?e.upgrade&&t.applyUpgrade(e.upgrade):this.addWeapon(e.id)}else this.passives.has(e.id)||this.slots.push(e.id),this.passives.set(e.id,(this.passives.get(e.id)??0)+(e.power??1)),this.passiveRank.set(e.id,(this.passiveRank.get(e.id)??0)+1),this.recomputeStats(),this.passiveFx(e.id);if(this.pendingLevelUps--,this.pendingLevelUps>0)this.events.onLevelUp(this.rollChoices());else if(this.afterLevels){const t=this.afterLevels;this.afterLevels=null,t()}else this.state="playing"}storyLevels(e,t,s){this.level+=e,this.expNext=au(this.level),this.pendingLevelUps+=e,this.recomputeStats(),B.play("levelup",.6),this.player.dead||this.healPlayer(this.stats.maxHp),this.angelWings(),this.afterLevels=()=>{const n=this.slots.filter(i=>ul(i)&&!this.coldClone(i)),o=t.map(i=>nn.rollLeveled(i,n,Ka.STORY_ITEM_LEVEL));for(const i of o)this.runItems.grant(i);this.recomputeStats(),this.events.onRoulette(o,()=>{this.state="playing",s==null||s()})},this.state="levelup",this.events.onLevelUp(this.rollChoices())}get isStory(){return!!this.script.story}advance(e){for(this.stepAcc=Math.min(this.stepAcc+e,Ka.STEP*5);this.stepAcc>=Ka.STEP*.999;)this.stepAcc-=Ka.STEP,this.tick(Ka.STEP)}tick(e){var t;cw(this.runCtx);try{(t=this.endless)==null||t.beforeTick(),this.step(e)}finally{}}step(e){var x,k,M,$,P,q,R,L,j,A,E,C,_,U,D;e=Math.min(e,.05);const t=e*1e3;this.updateCamera();const s=this.camFocus??this.player;if((x=this.hall)==null||x.update(e,this.app.screen.width,this.app.screen.height,s.x,s.y),this.state==="cutscene"){(k=this.gloom)==null||k.update(e,this.app.screen.width,this.app.screen.height,this.player.x,this.player.y),this.player.update(e,0,0),(M=this.pet)==null||M.update(e,this.player.x,this.player.y);for(const I of this.enemies)I.updateView(t,this.time);($=this.story)==null||$.update(e),this.updateFxList(t);return}const n=this.player.dead,o=n&&!this.coop;if(o?this.state==="paused":this.state==="over"||this.state==="paused"||this.state==="levelup"||this.state==="reveal"||this.state==="partywait"){this.state==="over"&&this.player.update(e,0,0);return}o&&this.state!=="over"&&(this.deathTimer-=e,this.deathTimer<=0&&(this.state="over",this.events.onGameOver(!1))),o||(this.time+=e),this.ticks++,this.deterministic&&this.ticks%Nf===0&&this.checks.push(this.stateHash());for(let I=this.scheduled.length-1;I>=0;I--){const N=this.scheduled[I];N.t-=e,N.t<=0&&(this.scheduled.splice(I,1),N.fn())}let i=0,r=0;(this.keys.has("a")||this.keys.has("arrowleft"))&&(i-=1),(this.keys.has("d")||this.keys.has("arrowright"))&&(i+=1),(this.keys.has("w")||this.keys.has("arrowup"))&&(r-=1),(this.keys.has("s")||this.keys.has("arrowdown"))&&(r+=1);const l=we(i,r),d=this.touchMove.x||this.touchMove.y?this.touchMove:it.move,h=we(d.x,d.y);if(l>0)[i,r]=Rd(i/l,r/l);else if(h>0){const I=Math.min(1,h*1.3)/h;[i,r]=Rd(d.x*I,d.y*I)}if(n)i=0,r=0,this.movePath=null;else if(l>0||h>0)this.movePath=null;else if(this.movePath){const I=this.player;let N=this.movePath[0];for(;N&&we(N.x-I.x,N.y-I.y)<6;)this.movePath.shift(),N=this.movePath[0];if(!N)this.movePath=null;else{const V=we(N.x-I.x,N.y-I.y);i=(N.x-I.x)/V,r=(N.y-I.y)/V}}if(this.deterministic){const I=this.moveTicks++*2;if(this.replayMoves)i=(this.replayMoves[I]??0)/bi,r=(this.replayMoves[I+1]??0)/bi;else{const N=Math.round(i*bi),V=Math.round(r*bi);this.moves.push(N,V),i=N/bi,r=V/bi}}const u=this.classDef.speed*ud*this.stats.speedMult*(1+this.buffValue("speed"))*(1-this.buffValue("slow"))*(this.hiddenUntil>this.time?1.3:1),p=this.player,y=go(p.x+i*u*e,this.bounds.x0,this.bounds.x1),w=go(p.y+r*u*e,this.bounds.y0,this.bounds.y1);[p.x,p.y]=this.walk?this.walk.resolve(p.x,p.y,y,w):[y,w];const m=(P=this.walk)==null?void 0:P.warpAt(p.x,p.y);m&&([p.x,p.y]=m,this.movePath=null,B.play("ef_portal",.6,2),this.gate&&this.walk.lastWarp===this.gate.down&&this.crossGate()),(q=this.walk)==null||q.updateFlow(p.x,p.y),(R=this.gate)!=null&&R.crossed&&this.gate.open&&this.leaveUpperFloor(),this.warpSwirls(),p.update(e,i,r),(L=this.pet)==null||L.update(e,p.x,p.y,this.walk?(I,N,V,F)=>this.walk.resolve(I,N,V,F):void 0),this.stillTime=p.moving?0:this.stillTime+e;const f=!!((j=this.yggdrasil)!=null&&j.circle.contains(this.player.x,this.player.y)),v=(this.stats.regen+this.buffValue("regen")+(this.stillTime>.5?this.stats.regenStill:this.stats.regenMoving))*(f?2:1);if(v>0&&!n&&this.trickleHeal(v*e),(this.regen5Left-=e)<=0&&(this.regen5Left=a0,this.stats.regen5>0&&!n&&this.healPlayer(this.stats.regen5)),this.flushHeal(e),p.sprite.alpha=this.hiddenUntil>this.time?.4:1,(A=this.atmosphere)==null||A.update(e,this.app.screen.width,this.app.screen.height),(E=this.gloom)==null||E.update(e,this.app.screen.width,this.app.screen.height,p.x,p.y),this.updateMapFires(),this.ambient.update(e,p.x,p.y,(I,N)=>this.world3d.project(I,N).x,this.app.screen.width),this.mapEffects.update(e,p.x,p.y,I=>this.addFx(I)),this.rebuildGrid(),!((C=this.loadout)!=null&&C.missingWeapon)&&!n)for(const I of this.weapons)I.update(e,this);if(!n)for(const I of ro.tick)I(this,e);if(this.endless?n||this.endless.update(e):(_=this.coop)!=null&&_.replica||this.spawn(e),this.updateEnemies(e,t),this.updateProjectiles(e,t),this.updateHolyTrails(e),this.updateFireRings(e),this.updatePulls(e),this.updateBastion(e),this.updateYggdrasil(e),this.updateBuffAuras(e),n||this.updatePickups(e),this.updateFxList(t),!(o||this.endless)){if(this.story){this.story.update(e);return}if((U=this.coop)!=null&&U.replica){this.lootUntil<0&&this.time>=this.timeUp&&this.meteorRain(e);return}this.closeAt<0&&this.nextBoss>=this.script.bosses.length&&!this.enemies.some(I=>I.def.boss&&!I.dead)&&(this.closeAt=this.lootUntil=this.time+nu,B.music(this.script.bgm),this.events.onAnnounce(c("¡Victoria! Tienes  {
    n
  }
   s para recoger el botín",{n:nu})),(D=this.coop)==null||D.victory(nu)),this.closeAt>=0?this.time>=this.closeAt&&(this.state="over",this.events.onGameOver(!0)):this.time>=this.timeUp&&this.meteorRain(e)}}updateFxList(e){for(let t=this.fx.length-1;t>=0;t--)this.fx[t].update(e)&&(this.fx[t].view.destroy({children:!0}),this.fx.splice(t,1));for(let t=this.numbers.length-1;t>=0;t--){const s=this.numbers[t];s.update(e),s.dead&&(s.view.destroy({children:!0}),this.numbers.splice(t,1))}}storyWin(){this.state!=="over"&&(this.camFocus=null,this.state="over",this.events.onGameOver(!0))}storySpawn(e,t,s){return this.spawnEnemy(e,(1+this.waveTime/(this.script.hpGrowth??240))*this.difficulty.hp,!1,{x:t,y:s})}spawnBoss(e,t,s){var r;const n=Be[e],o=this.spawnEnemy(e,this.difficulty.hp,!1,{x:t,y:s});if(!o)return null;const i=(r=this.script.bossHp)==null?void 0:r[e];return i&&(o.maxHp=o.hp=Math.max(1,Math.round(o.maxHp*i/n.hp))),this.bosses.push(o),this.events.onBosses(this.bosses),n.boss==="mvp"?this.events.onAnnounce(c("¡MVP  {
    name
  }
   ha aparecido!",{name:n.name})):this.events.onAnnounce(c("¡ {
    name
  }
   ha aparecido!",{name:n.name})),o}fadeMobs(e=1/0,t=!1){t&&(this.bossArena=!0);for(const s of this.enemies)s.dead||s.def.boss||we(s.x-this.player.x,s.y-this.player.y)>e||(s.setState("dead"),this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",s.x,s.y,{add:!1,scale:.8*(s.def.scale??1)})))}vanishEnemy(e){e.removed=!0,this.bossBrains.delete(e),this.bosses=this.bosses.filter(t=>t!==e),this.events.onBosses(this.bosses),this.bosses.some(t=>t.def.boss==="mvp")||B.music(this.script.bgm)}clearCombatFx(){var e,t,s;for(const n of this.projectiles)n.view.destroy({children:!0}),(e=n.model)==null||e.dispose();this.projectiles=[];for(const n of this.holyTrails)n.trail.dispose();this.holyTrails=[];for(const n of this.fireRings)n.ring.dispose();this.fireRings=[],this.pulls=[];for(const n of this.weapons)n.clearScene(this);for(const n of this.buffAuras.values())n.ring.dispose();this.buffAuras.clear(),(t=this.bastion)==null||t.dome.dispose(),this.bastion=null,(s=this.yggdrasil)==null||s.circle.dispose(),this.yggdrasil=null;for(const n of this.pickups)n.dead=!0;this.sweepPickups()}set outdoors(e){var t;(t=this.gloom)==null||t.setOff(e)}get noSummons(){return this.isStory&&this.bossArena}get mapAreas(){return this.script.areas}get lowerFloor(){var e;return!!((e=this.gate)!=null&&e.crossed)}warpsChanged(){this.warpFxAt=0}get timeUp(){return this.mvpUntil>=0?this.mvpUntil:this.script.runLength}meteorRain(e){const t=this.time-this.timeUp;for(this.meteorsOn||(this.meteorsOn=!0,this.events.onAnnounce(c("¡Se acabó el tiempo! Lluvia de meteoritos"))),this.meteorAcc+=e*Math.min(6,1.5+t/8);this.meteorAcc>=1;){this.meteorAcc-=1;const s=this.player,n=le()*Math.PI*2,o=le()<.5?0:60+le()*220,i=s.x+Ie(n)*o,r=s.y+Le(n)*o,l=3.5*(De/2),d=Za("tex_magic_target"),h=d?this.groundSprite(d):null;h&&(h.x=i,h.y=r,h.size=l*2,h.alpha=.8),this.schedule(.5,()=>{const u=yt(`str_meteor${1+Math.floor(ps()*4)}`,i,r);u&&this.addFx(u),B.play("meteor",.4,4)}),this.schedule(1.15,()=>{h==null||h.dispose(),this.shake(.15,4),we(this.player.x-i,this.player.y-r)<l&&this.hurtPlayer(this.stats.maxHp*(.15+t*.02),void 0,!0);for(const u of this.enemiesInRadius(i,r,l))u.def.boss||this.killEnemy(u)})}}updateCamera(){const e=this.player;let t=0,s=0;this.shakeLeft>0&&(t=(ps()-.5)*2*this.shakeAmp,s=(ps()-.5)*2*this.shakeAmp);const n=this.camFocus??e;this.world3d.setView(n.x+t,n.y+s),this.zoom=this.world3d.scaleAt(n.x,n.y)}moveTo(e,t){if(this.state!=="playing"||this.player.dead)return;const s=this.player;let n=go(e,this.bounds.x0,this.bounds.x1),o=go(t,this.bounds.y0,this.bounds.y1);this.walk?([n,o]=this.walk.nearestWalkable(n,o),this.movePath=this.walk.pathTo(s.x,s.y,n,o)):this.movePath=[{x:n,y:o}]}zoomBy(e){qe.targetZoom=go(qe.targetZoom+T$(e)*1.1,0,1)}screenPos(e,t,s=0){return this.world3d.project(e,t,this.world3d.spriteLift(s))}passiveFx(e){const t=this.player,s=o=>o&&this.addFx(o),n=o=>ml(o,t);switch(e){case"blessing":B.play("ef_blessing",.5),s(n(L$("fx_blessing",t.x,t.y,{lift:110}))),s(n(Ap(t.x,t.y,Za("tex_pok2"),10,1753087,1200,128,.2)));break;case"increase_agi":B.play("ef_incagility",.5),s(n(C$(t.x,t.y,!0)));break;case"angelus":B.play("ef_angelus",.5),s(n(yt("str_angelus",t.x,t.y,1,0)));break;case"concentration":B.play("ac_concentration",.5),s(n(yt("str_concentration",t.x,t.y,1,0)));break;case"energy_coat":s(n(yt("str_energycoat",t.x,t.y,1,0)));break;case"endure":B.play("ef_endure",.5);break;default:B.play("ef_beginspell",.35)}}groundSprite(e,t=!0){return this.world3d.addGroundSprite(e,t)}zoneDecal(e,t=0){return this.world3d.addZone(e,t)}wave(e,t,s){this.world3d.addWave(e,t,s)}fireWave(e,t,s){this.world3d.addFireWave(e,t,s)}firePatch(e,t,s){this.world3d.addFirePatch(e,t,s)}fx3d(e,t,s){this.world3d.add3D(e,t,s)}fireball(e,t,s){this.world3d.addFireball(e,t,s)}summon(e,t,s,n,o=110){if(!this.noSummons){if(this.endless)return this.endless.summon(e,t,s,n,o);for(let i=0;i<n;i++){const r=i/n*Math.PI*2+le()*.4;let l=t+Ie(r)*o,d=s+Le(r)*o;this.walk&&([l,d]=this.walk.nearestWalkable(l,d)),this.spawnEnemy(e,(1+this.waveTime/(this.script.hpGrowth??240))*this.difficulty.hp,!1,{x:l,y:d})&&this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",l,d,{add:!1,scale:.8}))}}}cylinder(e,t,s){this.world3d.addCylinder(e,t,s)}shake(e,t){Te.screenShake&&(this.shakeLeft=Math.max(this.shakeLeft,e),this.shakeAmp=Math.max(this.shakeAmp,t))}pixelScale(e,t){return this.world3d.scaleAt(e,t)}angelWings(){var s,n;(s=this.wings)==null||s.s.destroy(),(n=this.wings)==null||n.feathers.destroy();const e=new sn(se.sheet("fx_angelwing"),"a0");e.y=-48,e.alpha=0,this.player.view.addChildAt(e,1);const t=new sn(se.sheet("fx_angelfeather"),"a0");t.y=-48,t.visible=!1,this.player.view.addChild(t),this.wings={s:e,feathers:t,t:0}}updateWings(e){const t=this.wings;if(!t)return;const s=e*1e3;t.t+=s,t.s.update(s);const n=t.s.duration-t.t,o=Math.min(1,t.t/DP);t.s.alpha=HP*Math.max(0,Math.min(o,n/400)),t.s.scale.set(.85+.15*o),t.t>=FP&&(t.feathers.visible=!0,t.feathers.update(s),t.feathers.alpha=.9),!(n>0)&&(t.s.destroy(),t.feathers.destroy(),this.wings=null)}renderWorld(){var n,o;const e=performance.now(),t=Math.min(.1,(e-this.lastFrame)/1e3);this.lastFrame=e;const s=(this.keys.has("q")?1:0)-(this.keys.has("e")?1:0)-it.look.x;s&&(qe.targetYaw+=s*t*1.3),it.look.y&&this.zoomBy(Eg(-it.look.y*t*1.6)),dw(t),this.updateWings(t),(n=this.mouse)==null||n.update(t,this.state==="playing"),this.shakeLeft>0&&(this.shakeLeft-=t,this.shakeLeft<=0&&(this.shakeAmp=0)),this.updateCamera(),this.placeOverlay(),(o=this.story)==null||o.render(),this.fxLayer.alpha=Te.fxOpacity,this.world3d.render(this.entityLayer)}placePlayerBar(){this.playerBar||(this.playerBar={g:new Vo,frac:-1},this.playerBar.g.zIndex=-3,this.numberLayer.sortableChildren=!0,this.numberLayer.addChildAt(this.playerBar.g,0));const e=this.playerBar,t=this.player,s=Math.max(0,Math.min(1,this.hp/this.stats.maxHp));if(Math.abs(s-e.frac)>.002){e.frac=s;const i=50;e.g.clear(),e.g.rect(-i/2-1,-1,i+2,7).fill({color:1053468,alpha:.85}),e.g.rect(-i/2,0,i*s,5).fill(s<.25?15220780:3133514),e.g.rect(-i/2,0,i*s,2).fill({color:16777215,alpha:.35})}const n=this.pixelScale(t.view.x,t.view.y),o=this.screenPos(t.view.x,t.view.y);e.g.position.set(Math.round(o.x),Math.round(o.y+8*n)),e.g.scale.set(Math.max(.8,Math.min(2.2,n))),e.g.visible=n>0&&!t.dead&&!qe.rig&&t.view.visible,e.g.alpha=t.view.alpha}placeHpBars(){for(const[e,t]of this.hpBars)(e.dead||!this.enemies.includes(e))&&(t.g.destroy(),this.hpBars.delete(e));for(const e of this.enemies){if(e.dead||!(e.elite||e.def.boss))continue;let t=this.hpBars.get(e);t||(t={g:new Vo,top:0,frac:-1},this.hpBars.set(e,t),t.g.zIndex=e.def.boss?-1:-2,this.numberLayer.sortableChildren=!0,this.numberLayer.addChildAt(t.g,0)),t.top=Math.max(t.top,e.sprite.height);const s=Math.max(0,e.hp/e.maxHp);if(Math.abs(s-t.frac)>.002){t.frac=s;const i=e.def.boss==="mvp"?16726843:e.def.boss==="mini"?16751150:16762940;t.g.clear(),e.def.boss?QP(t.g,e.def.boss,i,s):(t.g.rect(-46/2-1,-1,48,7).fill({color:1053468,alpha:.85}),t.g.rect(-46/2,0,46*s,5).fill(i),t.g.rect(-46/2,0,46*s,2).fill({color:16777215,alpha:.35}))}const n=this.pixelScale(e.view.x,e.view.y),o=this.screenPos(e.view.x,e.view.y);t.g.position.set(Math.round(o.x),Math.round(o.y-(t.top+10)*n)),t.g.scale.set(Math.max(.8,Math.min(2.2,n))),t.g.visible=n>0,t.g.alpha=e.view.alpha}}placeOverlay(){for(const e of this.fx){const t=e.lift??0;e.anchor??(e.anchor={x:e.view.x,y:e.view.y+t});const s=this.screenPos(e.anchor.x,e.anchor.y,t),n=this.pixelScale(e.anchor.x,e.anchor.y);e.view.position.set(s.x,s.y),e.view.scale.set(n,e.upright?n:n*this.world3d.groundSquashAt(e.anchor.x,e.anchor.y)),e.view.visible=n>0}for(const e of this.projectiles){const t=e.y+mo,s=(i,r,l)=>Math.max(0,e.h0+e.hSlope*l-this.heightAt(i,r))+this.world3d.spriteLift(mo),n=this.world3d.project(e.x,t,s(e.x,t,e.travel)),o=this.pixelScale(e.x,t);if(e.view.position.set(n.x,n.y),e.view.scale.set(o*e.baseScale),e.view.visible=o>0,e.orient!==null&&!e.spin){const i=e.x+e.vx*.03,r=t+e.vy*.03,l=this.world3d.project(i,r,s(i,r,e.travel+we(e.vx,e.vy)*.03));e.view.rotation=Ls(l.y-n.y,l.x-n.x)+e.orient}}this.placeHpBars(),this.placePlayerBar();for(const e of this.numbers){const t=this.screenPos(e.x,e.y,e.lift),s=Math.min(2.5,this.pixelScale(e.x,e.y));e.view.position.set(t.x+e.offX*s,t.y),e.view.scale.set(e.scale*e.size*e.bump*s),e.view.visible=s>0}}heightAt(e,t){return this.world3d.heightAt(e,t)}stateHash(){const e=new Float64Array(1),t=new Uint32Array(e.buffer);let s=2166136261;const n=i=>{s^=i>>>0,s=Math.imul(s,16777619)>>>0},o=i=>{e[0]=i,n(t[0]),n(t[1])};o(this.ticks),o(this.time),o(this.player.x),o(this.player.y),o(this.hp),o(this.kills);for(const i of this.enemies)if(!i.dead){for(let r=0;r<i.def.id.length;r++)n(i.def.id.charCodeAt(r));o(i.x),o(i.y),o(i.hp)}return s.toString(16).padStart(8,"0")}logicReach(){return this.deterministic?Ku:this.world3d.viewReach}inView(e,t){return this.deterministic?we(e-this.player.x,t-this.player.y)<=Ku*.85:this.onScreen(e,t)}onScreen(e,t){const s=this.world3d.project(e,t);return s.x>0&&s.x<this.app.screen.width&&s.y>0&&s.y<this.app.screen.height+20}spawn(e){var d;const t=this.story?void 0:this.script.bosses[this.nextBoss],s=t&&Be[t.id].boss==="mvp"&&this.gate&&!this.gate.crossed;if(t&&!s&&this.time>=t.t){const h=t,u=Be[h.id],p=u.group?this.bosses.find(m=>m.def.group===u.group&&!m.dead):void 0;let y=u.boss==="mvp"&&this.script.mvpAt?{x:(this.script.mvpAt[0]+.5)*(De/2),y:(this.script.mvpAt[1]+.5)*(De/2)}:void 0;if(p){const m=le()*Math.PI*2,[f,v]=[p.x+Ie(m)*90,p.y+Le(m)*90],[x,k]=this.walk?this.walk.nearestWalkable(f,v):[f,v];y={x,y:k}}const w=this.spawnEnemy(h.id,this.difficulty.hp,!1,y);w&&this.nextBoss++,w&&(this.bosses.push(w),this.events.onBosses(this.bosses),this.nextBoss>=this.script.bosses.length&&(this.clearMobs(),this.mvpUntil=this.time+Tg),u.boss==="mvp"?(B.music("boss"),this.events.onAnnounce(c("¡MVP  {
    name
  }
   ha aparecido!",{name:u.name}))):u.group?p||this.events.onAnnounce(c("¡Los  {
    name
  }
   han aparecido!",{name:c(A$[u.group]??u.name)})):this.events.onAnnounce(c("¡ {
    name
  }
   ha aparecido!",{name:u.name})))}if(this.closeAt>=0)return;const n=this.script.waves.find(h=>this.waveTime>=h.from&&this.waveTime<h.to)??this.script.waves[this.script.waves.length-1],o=(1+this.waveTime/(this.script.hpGrowth??240))*this.difficulty.hp;if(this.time>=this.nextHordeAt&&(this.nextHordeAt+=this.hordeEvery,this.time<this.script.runLength&&!this.bossArena&&!this.isStory&&this.horde(n.pool,o)),this.bossArena||this.spawnHold)return;const i=this.enemies.reduce((h,u)=>h+(u.dead?0:1),0),r=this.waveTime<Qv?Zv+(1-Zv)*(this.waveTime/Qv):1,l=this.difficulty.count*(((d=this.coop)==null?void 0:d.partyScale().count)??1);if(!(i>=n.maxAlive*l*r))for(this.spawnAcc+=e*n.perSecond*l*r;this.spawnAcc>=1;)this.spawnAcc-=1,this.spawnEnemy(n.pool[Math.floor(le()*n.pool.length)],o)}edgeDistance(e){return this.deterministic?Ku:this.world3d.edgeDistance(e)}spawnAnchors(){var e;return[this.player,...((e=this.coop)==null?void 0:e.allies())??[]]}spawnPoint(e=this.spawnAnchors()[Math.floor(le()*this.spawnAnchors().length)]){const t=this.script.spawnAt;if(t&&this.walk)for(let s=0;s<12;s++){const[n,o]=t[Math.floor(le()*t.length)],i=(n+.5+(le()*2-1)*3)*(De/2),r=(o+.5+(le()*2-1)*3)*(De/2);if(!(!this.walk.walkable(i,r)||!this.walk.reachable(i,r)))return this.onScreen(i,r)&&this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",i,r,{add:!1,scale:.7})),{x:i,y:r}}for(let s=0;s<24;s++){const n=le()*Math.PI*2,o=this.edgeDistance(n)+Gu+(s>=12?le()*400:0),i=e.x+Ie(n)*o,r=e.y+Le(n)*o;if(!(i<=this.bounds.x0||i>=this.bounds.x1||r<=this.bounds.y0||r>=this.bounds.y1)&&!(this.walk&&(!this.walk.walkable(i,r)||!this.walk.reachable(i,r))))return{x:i,y:r}}if(this.walk&&this.map.warps.length){const s=this.logicReach();for(let n=0;n<30;n++){const o=e.x+(le()*2-1)*s,i=e.y+(le()*2-1)*s;if(!(we(o-e.x,i-e.y)<wP)&&!(!this.walk.walkable(o,i)||!this.walk.reachable(o,i)))return this.onScreen(o,i)&&this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",o,i,{add:!1,scale:.7})),{x:o,y:i}}}return null}warpSwirls(){var s;if(!this.warpFx.length||this.time<this.warpFxAt)return;this.warpFxAt=this.time+.7;const e=Za("tex_ring_blue");if(!e)return;const t=De/2;for(const[n,o]of this.warpFx.entries())!((s=this.walk)!=null&&s.warpOpen(n))||we(o.x-this.player.x,o.y-this.player.y)>this.world3d.viewReach+200||(this.cylinder(o.x,o.y,{texture:e,bottom:1.3*t,top:1.5*t,height:2.6*t,duration:1500,alpha:.55,animation:1,rotate:!0,fade:!0}),this.cylinder(o.x,o.y,{texture:e,bottom:.8*t,top:1.1*t,height:3.4*t,duration:1500,delay:350,alpha:.45,color:[.7,.85,1],animation:1,rotate:!0,fade:!0}))}recycleDistance(){return this.logicReach()+Gu+500}horde(e,t){var l;const s=Math.round(Math.min(120,36+this.time/8)*this.difficulty.count*(((l=this.coop)==null?void 0:l.partyScale().count)??1)),n=this.logicReach()+Gu;let o=0;const i=this.spawnAnchors(),r=Math.round(s/i.length);for(let d=0;d<r*i.length;d++){const h=i[d%i.length],u=Math.floor(d/i.length)/r*Math.PI*2+(le()-.5)*.04;for(const p of[0,90,180]){const y=n+p+le()*40,w=h.x+Ie(u)*y,m=h.y+Le(u)*y;if(w<=this.bounds.x0||w>=this.bounds.x1||m<=this.bounds.y0||m>=this.bounds.y1||this.walk&&(!this.walk.walkable(w,m)||!this.walk.reachable(w,m)))continue;const f=this.spawnEnemy(e[Math.floor(le()*e.length)],t,!1,{x:w,y:m});f&&(f.speedMult=SP,o++);break}}o&&(B.play("mc_loud",.5),this.events.onAnnounce(c("¡Una horda te rodea!")))}groundWarning(e,t,s,n,o,i){const r=this.zoneDecal("circle");r.x=e,r.y=t,r.w=r.h=2*s,r.progress=0;let l=0,d=!1;this.addFx({view:new Je,update:h=>{if(l+=h/1e3,!d&&o.dead)return r.dispose(),!0;if(!d){if(r.progress=Math.min(1,l/n),r.alpha=Math.min(1,l/.15),l<n)return!1;d=!0,l=0,i()}return r.flash=Math.max(0,1-l/.25),r.alpha=Math.max(0,1-l/.25),l<.25?!1:(r.dispose(),!0)}})}openGate(){var e;!this.gate||this.gate.open||this.gate.crossed||(this.gate.open=!0,(e=this.walk)==null||e.setWarpOpen(this.gate.down,!0),this.warpFxAt=0,B.play("ef_portal",.7,2),this.events.onAnnounce(c("¡Se ha abierto la escalera a la planta inferior!")))}crossGate(){this.gate&&(this.gate.crossed=!0,this.events.onAnnounce(c("Planta inferior: ya no hay vuelta atrás")))}leaveUpperFloor(){if(!(!this.gate||!this.walk)){this.gate.open=!1,this.walk.setWarpOpen(this.gate.down,!1),this.walk.updateFlow(this.player.x,this.player.y);for(const e of this.enemies)e.dead||e.def.boss||this.walk.reachable(e.x,e.y)||this.schedule(le()*.8,()=>{e.dead||e.setState("dead")})}}clearMobs(){this.bossArena=!0;for(const e of this.enemies)e.dead||e.def.boss||this.schedule(le()*1.2,()=>{e.dead||(e.setState("dead"),this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",e.x,e.y,{add:!1,scale:.8*(e.def.scale??1)})))})}spawnEnemy(e,t,s=!0,n,o=!1){var p,y;const i=Be[e];if(i.sprout&&this.enemies.reduce((w,m)=>w+(!m.dead&&m.def===i?1:0),0)>=i.sprout.cap)return null;const r=!n&&i.sprout?this.sproutPoint(i.sprout.min,i.sprout.max):null,l=n??r??this.spawnPoint();if(!l)return null;let d=s&&!i.boss&&!this.isStory&&this.time>=this.nextEliteAt;d&&(this.nextEliteAt+=this.eliteEvery),o&&!i.boss&&(d=!0);const h=new hd(i,l.x,l.y,t,d);h.bornAt=this.time;const u=(p=this.coop)==null?void 0:p.partyScale();if(u&&(h.maxHp=h.hp=Math.max(1,Math.round(h.maxHp*(i.boss?u.boss:u.hp)))),!i.boss){const w=P$(this.script,this.waveTime);h.maxHp=h.hp=Math.max(1,Math.round(h.maxHp*w.hp*(this.script.mobHp??1)*(((y=this.script.mobHpBy)==null?void 0:y[e])??1))),h.damage=Math.max(1,Math.round(h.damage*w.damage)),h.gemMult=w.gems*(this.script.gemExp??1)}return h.damage=Math.round(h.damage*this.difficulty.damage*(this.script.mobDmg??1)),i.boss&&this.bossBrains.set(h,new _c(h)),this.enemies.push(h),this.entityLayer.addChild(h.view),r&&this.emerge(h),h}hatch(e){const t=e.def.hatch;e.setState("dead"),this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",e.x,e.y,{add:!1,scale:.6}));const s=this.dieSounds.get(e.def.id);s&&B.play(s,.3,3),this.spawnEnemy(t.id,(1+this.waveTime/(this.script.hpGrowth??240))*this.difficulty.hp,!1,{x:e.x,y:e.y})}blowUp(e){var o;const t=e.def.fuse,s=t.m*Os;if(e.fused=!0,(o=this.coop)!=null&&o.replica||e.setState("dead"),this.fxRoom(!0)){Mn(this,e,s,6994175,360);for(let r=0;r<6;r++){const l=r/6*Math.PI*2,d=yt("str_waterhit",e.x+Ie(l)*s*.55,e.y+Le(l)*s*.55,.6+ps()*.25);d&&this.addFx(d)}const i=yt("str_waterhit",e.x,e.y,.9);i&&this.addFx(i)}B.play("water_spray",.45,3);const n=this.player;!n.dead&&we(n.x-e.x,n.y-e.y)<s+10&&this.hurtPlayer(Math.round(e.damage*t.mult),e)}sproutPoint(e,t){const s=this.player;for(let n=0;n<16;n++){const o=le()*Math.PI*2,i=e+le()*(t-e),r=s.x+Ie(o)*i,l=s.y+Le(o)*i;if(!(r<=this.bounds.x0||r>=this.bounds.x1||l<=this.bounds.y0||l>=this.bounds.y1)&&!(this.walk&&(!this.walk.walkable(r,l)||!this.walk.reachable(r,l)))&&this.inView(r,l))return{x:r,y:l}}return null}emerge(e){e.attackCd=Math.max(e.attackCd,1),e.view.alpha=0;const s=this.fxRoom(!0)?yt("str_dust",e.x,e.y,.35):null;s&&this.addFx(s);let n=0;this.addFx({view:new Je,update:o=>{n+=o;const i=Math.min(1,n/450);return e.dead?(e.view.alpha=1,e.sprite.y=0,!0):(e.sprite.y=30*(1-i),e.view.alpha=Math.min(1,i*2),i>=1)}})}rebuildGrid(){this.grid.clear();for(const e of this.enemies){if(e.dead)continue;const t=l0(Math.floor(e.x/vi),Math.floor(e.y/vi)),s=this.grid.get(t);s?s.push(e):this.grid.set(t,[e])}}buildSeparation(){const e=this.enemies,t=e.length;Qc.length<t&&(Qc=new Int32Array(t*2),Or=new Int32Array(t*2)),Dr.length=0;let s=1/0,n=1/0,o=-1/0,i=-1/0,r=0;for(let d=0;d<t;d++){const h=e[d];h.dead||h.def.radius>Jc||(h.def.radius>r&&(r=h.def.radius),h.x<s&&(s=h.x),h.x>o&&(o=h.x),h.y<n&&(n=h.y),h.y>i&&(i=h.y))}if(s===1/0){vn=Hr=0;for(const d of e)d.dead||Dr.push(d);return}Yv=s,Xv=n,yn=Math.max(ex,Math.ceil(r*1.6)),vn=Math.min(Wv,Math.floor((o-s)/yn)+1),Hr=Math.min(Wv,Math.floor((i-n)/yn)+1);const l=vn*Hr;Xs.length<l+1&&(Xs=new Int32Array(l*2+1)),Xs.fill(0,0,l+1);for(let d=0;d<t;d++){const h=e[d];if(h.dead){Or[d]=-1;continue}if(h.def.radius>Jc){Dr.push(h),Or[d]=-1;continue}const u=Math.min(vn-1,Math.floor((h.x-s)/yn))+Math.min(Hr-1,Math.floor((h.y-n)/yn))*vn;Or[d]=u,Xs[u]++}for(let d=1;d<l;d++)Xs[d]+=Xs[d-1];Xs[l]=Xs[l-1];for(let d=t-1;d>=0;d--){const h=Or[d];h>=0&&(Qc[--Xs[h]]=d)}}separate(e){const t=this.enemies,s=e.def.radius;if(vn>0){const n=s<=Jc?1:Math.ceil((s+Jc)*.8/yn),o=Math.floor((e.x-Yv)/yn),i=Math.floor((e.y-Xv)/yn);for(let r=Math.max(0,i-n),l=Math.min(Hr-1,i+n);r<=l;r++)for(let d=Math.max(0,o-n),h=Math.min(vn-1,o+n);d<=h;d++){const u=d+r*vn;for(let p=Xs[u],y=Xs[u+1];p<y;p++){const w=t[Qc[p]];w!==e&&this.pushApart(e,w)}}}for(let n=0;n<Dr.length;n++){const o=Dr[n];o!==e&&!o.dead&&this.pushApart(e,o)}}pushApart(e,t){const s=e.x-t.x,n=e.y-t.y,o=(e.def.radius+t.def.radius)*.8,i=s*s+n*n;if(i>0&&i<o*o){const r=Math.sqrt(i),l=(o-r)/r*.5*(t.def.boss&&!e.def.boss?1.6:1);e.x+=s*l*.5,e.y+=n*l*.5}}updateEnemies(e,t){var d,h,u,p,y,w;const s=this.player;this.buildSeparation();const n=this.recycleDistance(),o=er(5e-4,e),i=[],r=[];for(const m of this.enemies){if(m.dead){m.updateView(t,this.time);continue}m.def.hatch&&!((d=this.coop)!=null&&d.replica)&&this.time-m.bornAt>=m.def.hatch.secs&&i.push(m),m.def.fuse&&!m.fused&&this.time-m.bornAt>=m.def.fuse.secs&&r.push(m);for(const[V,F]of m.hitBy)m.hitBy.set(V,F-e);if(m.hiddenUntil>this.time&&this.holdDots(m,e),m.poisonUntil>this.time){if(m.poisonTick+=e,m.poisonTick>=.5){m.poisonTick-=.5;let V=0;for(const F of this.activePoisons(m)){const Y=Math.max(1,Math.round(F.dps*.5*(1+this.stats.poisonVuln)*this.petrifiedMult(m)));this.logDamage(F.src,F.part,Y,m.hp-V),V+=Y}if(m.hp-=V,this.addNumber(V,m.x,m.y,40*(m.def.scale??1),14264063,1.2),m.hp<=0){this.killEnemy(m),m.updateView(t,this.time);continue}}}else m.poisonDps=0,m.poisons.clear();if(m.bleedUntil>this.time){if(m.bleedTick+=e,m.bleedTick>=.5){m.bleedTick-=.5;const V=Math.max(1,Math.round(m.bleedDps*.5*this.petrifiedMult(m)));if(this.logDamage(m.bleedSrc.src,m.bleedSrc.part,V,m.hp),m.hp-=V,this.addNumber(V,m.x,m.y,40*(m.def.scale??1),16738906,1.2),this.stats.bleedLifesteal>0&&this.trickleHeal(V*this.stats.bleedLifesteal),m.hp<=0){this.killEnemy(m),m.updateView(t,this.time);continue}}}else m.bleedDps=0;if(m.burnUntil>this.time){if(m.burnTick+=e,m.burnTick>=.5){m.burnTick-=.5;const V=this.stats.burnCrit>0&&le()<this.stats.critChance+this.buffValue("crit");m.burnAcc+=m.burnDps*.5*(V?this.stats.critMult:1)*this.petrifiedMult(m);const F=Math.floor(m.burnAcc);if(m.burnAcc-=F,F>0&&(this.logDamage(m.burnSrc,"Quemadura (talento)",F,m.hp),m.hp-=F,this.addNumber(F,m.x,m.y,40*(m.def.scale??1),V?16764992:16752704,V?1.5:1.2),m.hp<=0)){this.killEnemy(m),m.updateView(t,this.time);continue}}}else m.burnDps=0,m.burnAcc=0;if(m.attackCd-=e,(h=this.coop)!=null&&h.replica){this.followHost(m,e),m.updateView(t,this.time);continue}const f=this.chaseTarget(m),v=f===s,x=f.x-m.x,k=f.y-m.y,M=we(x,k)||1,$=m.def.sprout;if(M>($?$.max*2.2:n)&&!m.def.boss){const V=$?this.sproutPoint($.min,$.max):this.spawnPoint();V&&(m.x=V.x,m.y=V.y,$&&this.emerge(m));continue}m.state==="attack"&&m.stateTime>450&&m.setState("move"),m.state==="hurt"&&m.stateTime>220&&m.setState("move"),(u=this.bossBrains.get(m))==null||u.update(this,e);const P=m.busyUntil>this.time,q=m.stopped(this.time)||P,R=m.blindUntil>this.time,L=v&&(this.hiddenUntil>this.time||s.dead);let j=q?0:m.def.speed*m.speedMult*ud*this.difficulty.speed*(m.slowUntil>this.time?.5:1)*(m.poisonUntil>this.time?1-this.stats.poisonSlow:1);m.state!=="move"&&(j*=m.state==="hurt"?.2:.35);let A=x/M,E=k/M;if(this.walk&&M>90&&(this.time>=m.losAt&&(m.losAt=this.time+.3+le()*.2,m.los=this.walk.lineClear(m.x,m.y,f.x,f.y)),!m.los)){const V=this.walk.flowDir(m.x,m.y);V&&([A,E]=V)}const C=this.lure&&!m.def.boss&&!R&&we(this.lure.x-m.x,this.lure.y-m.y)<this.lure.r?this.lure:null;if(C){const V=C.x-m.x,F=C.y-m.y,Y=we(V,F)||1;A=V/Y,E=F/Y,Y<m.def.radius+24&&(j=0,m.attackCd<=0&&!q&&(m.setState("attack"),m.face(V,F),m.attackCd=1.4,(p=C.onHit)==null||p.call(C,m)))}const _=m.def.ranged,U=!!_&&!C&&!R&&!L&&M<_.range*KP&&(!this.walk||M<=90||m.los);U&&(j=0),_&&m.state==="move"&&(U&&m.sprite.actionName==="walk"?m.sprite.play("idle"):!U&&m.sprite.actionName==="idle"&&m.setState("move"));const D=m.x,I=m.y;(R||L)&&(le()<e*1.5&&(m.blindDir=le()*Math.PI*2),A=Ie(m.blindDir),E=Le(m.blindDir),j*=.45),m.x+=A*j*e+m.kx*e,m.y+=E*j*e+m.ky*e,m.kx*=o,m.ky*=o,U?m.face(x,k):m.state==="move"&&!q?m.face(A,E):P&&m.state==="move"&&m.face(x,k),this.separate(m),this.walk&&([m.x,m.y]=this.walk.resolve(D,I,m.x,m.y));const N=(y=this.walk)==null?void 0:y.warpAt(m.x,m.y);if(N&&([m.x,m.y]=this.walk.nearestWalkable(N[0]+(le()-.5)*40,N[1]+(le()-.5)*40),m.kx=m.ky=0,m.losAt=0,we(s.x-m.x,s.y-m.y)<700&&B.play("ef_portal",.25,2)),m.def.damage>0&&!(m.def.boss&&((w=jl[m.def.id])!=null&&w.length))&&M<m.def.radius+16&&m.attackCd<=0&&!q&&!R&&!L&&!C&&m.hiddenUntil<=this.time){m.setState("attack"),m.face(x,k),m.attackCd=1.4;const V=Object.values(m.sprite.sheet.action("attack").sounds)[0];V&&B.play(V,.35,3),v&&this.hurtPlayer(m.damage,m)}if(_&&v&&M<_.range&&M>=m.def.radius+16&&m.attackCd<=0&&!q&&!R&&!L&&!C&&m.hiddenUntil<=this.time&&(!this.walk||this.walk.lineClear(m.x,m.y,s.x,s.y))){m.setState("attack"),m.face(x,k),m.attackCd=_.cd*(.85+le()*.3);const V=Object.values(m.sprite.sheet.action("attack").sounds)[0];V&&B.play(V,.3,3);const F=s.x,Y=s.y;if(_.arrow){const Q=_.arrow;this.schedule(_.windup,()=>{!m.dead&&!this.player.dead&&this.enemyArrow(m,F,Y,Q,_.range*1.3)})}else this.groundWarning(F,Y,_.radius,_.warn,m,()=>{this.fx.length<160&&this.addFx(Ye(_.fx,F,Y+2,{add:!1,scale:1.15,speed:2.2})),this.schedule(_.windup,()=>{!m.dead&&!this.player.dead&&we(this.player.x-F,this.player.y-Y)<_.radius&&this.hurtPlayer(m.damage,m)})})}m.updateView(t,this.time)}for(const m of i)this.hatch(m);for(const m of r)this.blowUp(m);let l=!1;for(const m of this.enemies)m.removed&&(this.bossBrains.delete(m),m.view.destroy({children:!0}),l=!0);l&&(this.enemies=this.enemies.filter(m=>!m.removed))}chaseTarget(e){var o;const t=this.player;let s=t,n=t.dead?1/0:we(t.x-e.x,t.y-e.y);for(const i of((o=this.coop)==null?void 0:o.allies())??[]){const r=we(i.x-e.x,i.y-e.y);r<n&&(n=r,s=i)}return this.coop&&(e.netTo=this.coop.midOf(s)),s}bossTarget(e){return this.coop?this.coop.bossTarget(e):this.player.dead?null:{mid:0,pos:()=>this.player}}netVictory(e){this.lootUntil=this.time+e,B.music(this.script.bgm),this.events.onAnnounce(c("¡Victoria! Tienes  {
    n
  }
   s para recoger el botín",{n:e}))}netBossCast(e,t,s,n){var o;e.dead||hk(this,e,t,s,((o=this.coop)==null?void 0:o.posOf(n))??(()=>this.player))}takeCC(e){const t=[e.freezeUntil,e.stunUntil,e.slowUntil,e.blindUntil],s=t.some((r,l)=>r>e.netCC[l]+.05&&r>this.time),n=Math.abs(e.kx)+Math.abs(e.ky)>1;if(!s&&!n)return null;e.netCC=t;const o=t.map(r=>Math.max(0,Math.round((r-this.time)*100)/100)),i=[o[0],o[1],o[2],o[3],Math.round(e.kx),Math.round(e.ky)];return e.kx=e.ky=0,i}netCC(e,t,s,n,o,i,r){if(e.dead)return;const l=(d,h)=>d>0?Math.max(h,this.time+Math.min(30,d)):h;e.freezeUntil=l(t,e.freezeUntil),e.stunUntil=l(s,e.stunUntil),e.slowUntil=l(n,e.slowUntil),e.blindUntil=l(o,e.blindUntil),e.def.boss||(e.kx+=Math.max(-2e3,Math.min(2e3,i)),e.ky+=Math.max(-2e3,Math.min(2e3,r)))}followHost(e,t){var w,m;const s=e.x,n=e.y,o=e.busyUntil>this.time;if(!o&&e.netAge<Pp&&(e.netVx||e.netVy)){const f=Math.min(t,Pp-e.netAge);e.netX+=e.netVx*f,e.netY+=e.netVy*f}e.netAge+=t;const i=o?0:Math.min(1,t*10);e.x+=(e.netX-e.x)*i,e.y+=(e.netY-e.y)*i;const r=e.x-s,l=e.y-n;if(we(r,l)>.4&&e.state==="move"&&e.face(r,l),e.state==="attack"&&e.stateTime>450&&e.setState("move"),e.state==="hurt"&&e.stateTime>220&&e.setState("move"),!e.netMine){const f=(m=(w=this.coop)==null?void 0:w.posOf(e.netTo))==null?void 0:m();f&&e.state==="attack"&&e.stateTime<60&&e.face(f.x-e.x,f.y-e.y);return}const d=this.player,h=d.x-e.x,u=d.y-e.y,p=we(h,u)||1;if(e.def.damage>0&&!d.dead&&p<e.def.radius+16&&e.attackCd<=0&&!e.stopped(this.time)&&e.blindUntil<=this.time&&this.hiddenUntil<=this.time){e.setState("attack"),e.face(h,u),e.attackCd=1.4;const f=Object.values(e.sprite.sheet.action("attack").sounds)[0];f&&B.play(f,.35,3),this.hurtPlayer(e.damage,e)}const y=e.def.ranged;if(y&&!d.dead&&p<y.range&&p>=e.def.radius+16&&e.attackCd<=0&&!e.stopped(this.time)&&e.blindUntil<=this.time&&this.hiddenUntil<=this.time&&e.hiddenUntil<=this.time&&(!this.walk||this.walk.lineClear(e.x,e.y,d.x,d.y))){e.setState("attack"),e.face(h,u),e.attackCd=y.cd*(.85+le()*.3);const f=Object.values(e.sprite.sheet.action("attack").sounds)[0];f&&B.play(f,.3,3);const v=d.x,x=d.y;if(y.arrow){const k=y.arrow;this.schedule(y.windup,()=>{!e.dead&&!this.player.dead&&this.enemyArrow(e,v,x,k,y.range*1.3)})}else this.groundWarning(v,x,y.radius,y.warn,e,()=>{this.fx.length<160&&this.addFx(Ye(y.fx,v,x+2,{add:!1,scale:1.15,speed:2.2})),this.schedule(y.windup,()=>{!e.dead&&!this.player.dead&&we(this.player.x-v,this.player.y-x)<y.radius&&this.hurtPlayer(e.damage,e)})})}}netSpawn(e,t,s,n,o,i,r){const l=Be[t];if(!l||this.netDead.has(e)||this.enemies.some(u=>u.nid===e))return;const d=new hd(l,o,i,1,s);d.nid=e,d.maxHp=n,d.hp=d.netHp=r,d.netX=o,d.netY=i,d.damage=Math.round(d.damage*this.difficulty.damage*(this.script.mobDmg??1));const h=this.script.bosses[this.script.bosses.length-1];l.boss&&(h==null?void 0:h.id)===t&&this.mvpUntil<0&&(this.mvpUntil=this.time+Tg),this.enemies.push(d),this.entityLayer.addChild(d.view),l.boss&&(this.bosses.push(d),this.events.onBosses(this.bosses),l.boss==="mvp"?(B.music("boss"),this.events.onAnnounce(c("¡MVP  {
    name
  }
   ha aparecido!",{name:l.name}))):this.events.onAnnounce(c("¡ {
    name
  }
   ha aparecido!",{name:l.name})))}netUpdate(e,t,s,n,o,i,r,l=0,d=0){e.netX=t,e.netY=s,e.netVx=l,e.netVy=d,e.netAge=0,e.netTo=i,e.netMine=r,!e.dead&&(e.hp=Math.min(e.hp,n),e.netHp=e.hp,o===1&&e.state==="move"&&e.setState("attack"))}netKill(e){e.netDeadSent=!0,e.dead||this.replicaDeath(e),this.payKill(e)}netKilled(e){e.dead||(e.hp=0,this.killEnemy(e))}takeDealt(e){const t=Math.max(0,e.netHp-Math.max(0,e.hp));return e.netHp-=t,t}netHit(e,t){e.dead||t<=0||(e.hp-=t,this.addNumber(Math.round(t),e.x,e.y,40*(e.def.scale??1),13621503,1.1),e.hp<1&&this.killEnemy(e))}payKill(e){var t;e.netPaid||(e.netPaid=!0,this.kills++,this.killsBy.set(e.def.id,(this.killsBy.get(e.def.id)??0)+1),this.charExp.kill(e.def.level,e.def.exp*(e.elite?5:1)),e.def.boss&&(this.bossKills++,e.def.boss==="mvp"&&!this.mvpsKilled.includes(e.def.id)&&this.mvpsKilled.push(e.def.id),this.bosses=this.bosses.filter(s=>s!==e),this.events.onBosses(this.bosses),e.def.boss==="mvp"&&!this.bosses.some(s=>s.def.boss==="mvp")&&B.music(this.script.bgm),((t=this.script.gate)==null?void 0:t.boss)===e.def.id&&this.openGate()))}replicaDeath(e){e.nid&&this.netDead.add(e.nid),e.setState("dead"),e.sprite.tint=16777215;const t=this.dieSounds.get(e.def.id);t&&B.play(t,.3,3)}damageMultiplier(){let e=this.stats.damageMult*(1+this.buffValue("damage"))*(1+this.buffValue("morale"))*(1+this.buffValue("blessing"));return this.stats.lowHpDamage>0&&this.lowHp()&&(e*=1+this.stats.lowHpDamage),e}damageEnemy(e,t,s){var m,f,v,x;if(e.dead||e.removed||e.hiddenUntil>this.time)return;const n=this.stats;let o=this.damageMultiplier()*(.9+le()*.2);const i=e.guardUntil>this.time;i&&(o*=1-e.guard,(m=e.onGuardHit)==null||m.call(e)),e.markUntil>this.time&&(o*=1+e.mark),e.poisonUntil>this.time&&(o*=1+this.stats.poisonVuln),e.def.boss?e.zenyMarkUntil>this.time&&(o*=1+LP):(s.src==="mammonite"||s.zenyVuln)&&e.zenyMarkUntil>this.time&&(o*=1+CP+(s.zenyBonus??0)+(this.runItems.deityLevel("zeny_rain")?AP:0)),(e.def.undead||e.def.boss)&&(o*=n.bossUndeadMult),(e.elite||e.def.boss)&&(o*=n.bossEliteMult),e.def.undead&&s.undeadMult&&(o*=s.undeadMult),o*=this.petrifiedMult(e),s.frozenBonus&&e.freezeUntil>this.time&&(o*=1+s.frozenBonus);const r=t<=0,l=!r&&le()<n.critChance+this.buffValue("crit")+(s.critBonus??0);l&&(o*=n.critMult+this.buffValue("trueSight")+(s.critDmg??0)),l&&n.strafeOnCrit>0&&s.src===this.basicAttack&&this.strafeStorm(e),n.stillDmg>0&&this.stillTime>.5&&(o*=1+n.stillDmg);for(const k of ro.damageMult)o*=k(this,e,s);const d=50*(e.def.scale??1),h=r?0:Math.max(1,Math.round(t*o));r||this.logDamage(s.src,s.part??"Golpe",h,e.hp),e.hp-=h;const u=s.combo;if(!r)if(u!=null&&u.num&&!u.num.dead)u.total+=h,u.last=h,u.crit||(u.crit=l),u.num.setValue(u.total,u.crit?16769126:s.numColor??16777215,u.crit);else{const k=this.addNumber(h,e.x,e.y,d,i?13215050:l?16769126:s.numColor??16777215,l?1.8:1.6,l);u&&Object.assign(u,{num:k,total:h,last:h,crit:l})}const p=n.lifesteal+this.buffValue("lifesteal");if(p>0){this.time>=this.lifestealReset&&(this.lifestealReset=this.time+1,this.lifestealLeft=n.maxHp*OP);const k=Math.min(this.lifestealLeft,h*p);this.lifestealLeft-=k,this.trickleHeal(k)}const y=(s.bleed??0)+(n.lowHpBleed>0&&this.lowHp()?n.lowHpBleed:0);if(y>0&&h>0){this.dotSeen=!0,e.bleedDps=Math.max(e.bleedUntil>this.time?e.bleedDps:0,h*y*(1+n.dotDmg)/3),e.bleedUntil=this.time+3;const k=s.bleed?((f=s.tags)==null?void 0:f.bleed)??"Deity":"talento";e.bleedSrc={src:s.src,part:`Sangrado (${k})`}}if(s.freezeNova&&!s.part){const k=s.freezeNova*Os*n.areaMult*(1+(s.src?this.skillMod(s.src).area:0)),M=s.freeze||Dv;for(const $ of this.enemiesInRadius(e.x,e.y,k))$.def.boss||($.freezeUntil=Math.max($.freezeUntil,this.time+M),$.petrified=!1);Mn(this,{x:e.x,y:e.y},k,10477823,420),j$(this,e.x,e.y)}s.burn&&s.burn>0&&h>0&&this.ignite(e,h*s.burn,s.src),this.chargeUntil>this.time&&s.src&&Ao(s.src)&&!s.part&&this.lightningChain(e,h),l&&this.critFx(e),l&&n.critStun>0&&!e.def.boss&&(e.stunUntil=Math.max(e.stunUntil,this.time+n.critStun));const w=n.ext.critSplash??0;if(l&&w>0&&h>0&&s.part!=="Emboscada"){const k={src:s.src,part:"Emboscada",power:s.power,fromX:e.x,fromY:e.y};for(const M of this.enemiesInRadius(e.x,e.y,_$.m*Os))M!==e&&!M.dead&&this.damageEnemy(M,h*w,k)}if(e.flash=110,s.sound?B.play(s.sound,.3,3):s.sounds&&B.play(s.sounds[Math.floor(ps()*s.sounds.length)],.3,4),s.hitFx&&this.fxRoom()){const k=s.hitFx(e.x,e.y);k&&this.addFx(k)}if(this.applyStatus(e,s),n.stunChance>0&&!e.def.boss&&le()<n.stunChance&&(e.stunUntil=Math.max(e.stunUntil,this.time+1)),n.petrifyChance>0&&!e.def.boss&&le()<n.petrifyChance&&(e.freezeUntil=this.time+2,e.petrified=!0),(v=s.afterHit)==null||v.call(s,this,e,h),s.soulSplit&&!s.part&&this.splitSoul(e,t*s.soulSplit,{...s,soulSplit:0},"Alma dividida",hP),s.part||this.mageDeityHit(e,t,s),s.soulCharge&&e.hp<=0&&this.addChargeBuff("soulCharge",this.buffValue("soulCharge")+1,"soul_strike"),s.soulWard&&e.hp<=0){const k=Math.min(Math.round(Hv/s.soulWard),this.buffStacks("soulWard")+1);this.addBuff("soulWard",Math.min(Hv,this.buffValue("soulWard")+s.soulWard),dP,"soul_strike",k)}for(const k of ro.hit)k(this,e,h,s);this.stats.poisonSpread>0&&e.poisonUntil>this.time&&!((x=this.weapons.find(k=>k.id===s.src))!=null&&x.has("magic"))&&this.spreadPoison(e),e.hp<=0?this.killEnemy(e):!e.def.boss&&e.state==="move"&&!e.stopped(this.time)&&e.flinchAt<=this.time&&(e.setState("hurt"),e.flinchAt=this.time+lP),e.def.boss&&this.events.onBosses(this.bosses)}stealMorale(e,t){const s=this.player,n=this.enemiesInRadius(s.x,s.y,e).filter(i=>!i.dead);if(!n.length)return;const o=Math.min(Cg(t),q$*n.length);n.forEach((i,r)=>this.addFx(Lg(this,{x:i.x,y:i.y},s,Math.min(r,12)*22))),this.schedule(.38,()=>{const i=this.buffValue("morale")>0;this.addBuff("morale",o,I$,"demoralizing_shout"),i||this.addFx(R$(this,s,()=>this.buffValue("morale")/Cg(t)))})}chainProvoked(e,t){const s=this.player;for(const n of this.enemiesInRadius(s.x,s.y,e)){if(n.dead||(n.chainedUntil=this.time+t,this.addFx(B$(this,s,n,420)),n.def.boss))continue;const o=Ls(n.y-s.y,n.x-s.x),i=34+le()*26;this.pulls=this.pulls.filter(r=>r.e!==n),this.pulls.push({e:n,fx:n.x,fy:n.y,tx:s.x+Ie(o)*i,ty:s.y+Le(o)*i,t:0})}this.pulls.length&&this.shake(.12,2)}mageDeityHit(e,t,s){if(s.blast&&this.fx.length<140&&Ag(this,e.x,e.y,s.blast*Os*this.stats.areaMult),s.vulcan&&this.fx.length<140&&N$(this,e.x,e.y),s.frostStack&&!e.def.boss&&!e.dead){e.frostStacks++;const n=e.frostStacks>=O$;n&&(e.frostStacks=0,e.freezeUntil=Math.max(e.freezeUntil,this.time+D$),e.petrified=!1),(n||this.fx.length<140)&&H$(this,e.x,e.y,n)}s.frostShatter&&(e.shatterPct=Math.max(e.shatterPct,s.frostShatter)),s.chain&&this.chainBolt(e,t*s.chain,s)}chainBolt(e,t,s){const n=new Set([e]);let o={x:e.x,y:e.y};for(let i=0;i<F$;i++){let r=null,l=Xc;for(const h of this.enemiesInRadius(o.x,o.y,Xc)){if(h.dead||n.has(h))continue;const u=we(h.x-o.x,h.y-o.y);u<l&&([l,r]=[u,h])}if(!r)break;n.add(r);const d={x:r.x,y:r.y};this.addFx(ou(this,o,d,.8)),this.damageEnemy(r,t,{...s,chain:0,part:"Chain Lightning",fromX:o.x,fromY:o.y}),o=d}}siegeEcho(e){if(this.time-this.lastSiege<.3)return;const t=e0.filter(d=>d!==e.id),s=t[Math.floor(le()*t.length)];let n=this.weapons.find(d=>d.id===s);if(n||(n=this.looseSiege.get(s)??ce[s].create(),this.looseSiege.set(s,n)),n.isCasting())return;const o=e.shot,i=(o==null?void 0:o.kind)==="enemy"?o.e:(o==null?void 0:o.kind)==="ground"?o:this.player,r=this.randomVisibleEnemies(12,!0),l=r.find(d=>we(d.x-i.x,d.y-i.y)>160)??r[0];l&&(this.lastSiege=this.time,n.fire(this,s==="arrow_rain"?{kind:"ground",x:l.x,y:l.y,r:0}:{kind:"enemy",e:l,all:[l]}))}strafeStorm(e){if(e.dead||le()>=Pg.chance)return;const t=this.weapons.find(s=>s.id==="double_strafe");!t||t.isCasting()||t.fireBoosted(this,{kind:"enemy",e,all:[e],only:!0},Pg.dmg)}contagion(e){const t=this.skillMod("fire_arrow"),s=z$*Os*this.stats.areaMult*(1+t.area),{x:n,y:o}=e,i=e.maxHp*U$(this.runItems.deityLevel("fire_arrow"));this.schedule(.15,()=>{Ag(this,n,o,s),B.play("ef_firehit",.35,4);for(const r of this.enemiesInRadius(n,o,s))r===e||r.dead||this.damageEnemy(r,i,{src:"fire_arrow",part:"Contagio",burn:G$,knock:60,fromX:n,fromY:o})})}frostShatter(e){const t=e.maxHp*e.shatterPct;e.shatterPct=0;const{x:s,y:n}=e;this.schedule(cP,()=>{const o=this.skillMod("frost_diver"),i=V$*Os*this.stats.areaMult*(1+o.area);K$(this,s,n,i),B.play("ef_frostdiver2",.5,2);for(const r of this.enemiesInRadius(s,n,i))r===e||r.dead||this.damageEnemy(r,t,{src:"frost_diver",part:"Estallido helado",frozenBonus:o.hit.frozenBonus,knock:140,fromX:s,fromY:n})})}splitSoul(e,t,s,n,o){let i=null,r=Fv;for(const d of this.enemiesInRadius(e.x,e.y,Fv)){const h=we(d.x-e.x,d.y-e.y);d!==e&&!d.dead&&h<r&&(r=h,i=d)}if(!i)return;const l=i;W$(this,{x:e.x,y:e.y},{x:l.x,y:l.y},Math.floor(ps()*5),o,!1),this.schedule(Y$/1e3,()=>{l.dead||this.damageEnemy(l,t,{...s,part:n,fromX:e.x,fromY:e.y})})}petrifiedMult(e){return e.petrified&&e.freezeUntil>this.time?1+this.stats.petrifyVuln:1}onSkillCast(e){var s;if((s=this.coop)==null||s.skillCast(e),e.id==="soul_strike"&&this.stats.clearcast>0&&le()<this.stats.clearcast){const n=this.weapons.find(o=>o.id==="napalm");n&&!n.isCasting()&&n.timer>0&&(n.timer=0,Mn(this,this.player,50,13152511,300))}this.stats.siegeRain>0&&e0.includes(e.id)&&this.siegeEcho(e);const t=["arcane_shot","fire_arrow"];if(this.stats.arcaneSurge>0&&t.includes(e.id)){const n=this.weapons.find(o=>o.id!==e.id&&t.includes(o.id));n&&!n.isCasting()&&(n.timer=Math.max(0,n.timer-this.stats.arcaneSurge))}}vortexPull(e,t,s,n){for(const o of this.enemiesInRadius(e,t,s)){if(o.slowUntil=Math.max(o.slowUntil,this.time+n*(o.def.boss?.5:1)),o.def.boss)continue;const i=le()*Math.PI*2,r=le()*s*.18;this.pulls=this.pulls.filter(l=>l.e!==o),this.pulls.push({e:o,fx:o.x,fy:o.y,tx:e+Ie(i)*r,ty:t+Le(i)*r*.7,t:0})}}updatePulls(e){if(this.pulls.length){for(const t of this.pulls){t.t+=e;const s=Math.min(1,t.t/Gv),n=1-(1-s)*(1-s)*(1-s);t.e.x=t.fx+(t.tx-t.fx)*n,t.e.y=t.fy+(t.ty-t.fy)*n,t.e.kx=0,t.e.ky=0,t.e.stunUntil=Math.max(t.e.stunUntil,this.time+.1)}this.pulls=this.pulls.filter(t=>t.t<Gv&&!t.e.dead)}}raiseBastion(e,t){const s=this.stats.maxHp*X$(e);if(this.bastion){Object.assign(this.bastion,{hp:s,max:s,until:this.time+t});return}this.bastion={dome:new xA(this),hp:s,max:s,absorbed:0,until:this.time+t,age:0}}updateBastion(e){const t=this.bastion;if(!t)return;const s=this.player;if(t.age+=e,t.dome.update(s.x,s.y,e,Math.min(1,t.age/.25),Math.max(0,t.hp/t.max)),t.hp>0&&this.time<t.until)return;const n=Math.max(t.absorbed,this.stats.maxHp*J$);for(const o of this.enemiesInRadius(s.x,s.y,iu))this.damageEnemy(o,n,{src:"endure",part:"Bastión (Deity)",knock:160,fromX:s.x,fromY:s.y,numColor:Vv});this.addFx(Q$(this,s.x,s.y,iu)),this.addFx(Z$(this,s.x,s.y)),Mn(this,s,iu,16765562,420),this.shake(.2,5),B.play("ef_shieldpress",.6,2),t.dome.dispose(),this.bastion=null}plantYggdrasil(e){var t;(t=this.yggdrasil)==null||t.circle.dispose(),this.yggdrasil={circle:new TA(this,this.player.x,this.player.y,eS),until:this.time+e,total:e}}updateYggdrasil(e){const t=this.yggdrasil;if(!t)return;const s=t.until-this.time;t.circle.update(e,Math.min(1,(t.total-s)/.3,s/.6)),!(s>0)&&(t.circle.dispose(),this.yggdrasil=null)}chargeWeapon(e,t){const s=Math.max(0,this.chargeUntil-this.time);this.chargeUntil=this.time+t,this.chargeLevel=e,s<=0&&this.addFx(tS(this,this.player,()=>Math.max(0,this.chargeUntil-this.time)*1e3))}lightningChain(e,t){const s=t*sS(this.chargeLevel),n=new Set([e]);let o={x:e.x,y:e.y};this.procDamage(e,s,"sword_dance","Rayo (Deity)",Kv),this.addFx(ou(this,{x:this.player.x,y:this.player.y},o,.7));for(let i=1;i<=nS;i++){let r=null,l=Xc;for(const h of this.enemiesInRadius(o.x,o.y,Xc)){if(h.dead||n.has(h))continue;const u=we(h.x-o.x,h.y-o.y);u<l&&([l,r]=[u,h])}if(!r)break;n.add(r);const d={x:r.x,y:r.y};this.addFx(ou(this,o,d)),this.procDamage(r,s*(1-oS*i),"sword_dance","Rayo (Deity)",Kv),o=d}}procDamage(e,t,s,n,o){if(e.dead)return;const i=Math.max(1,Math.round(t));this.logDamage(s,n,i,e.hp),e.hp-=i,this.addNumber(i,e.x+10,e.y,62*(e.def.scale??1),o,1.6),e.flash=110,e.hp<=0&&this.killEnemy(e),e.def.boss&&this.events.onBosses(this.bosses)}applyStatus(e,t){var n;if(e.dead)return;const s=!!e.def.boss;if(t.slow&&(e.slowUntil=Math.max(e.slowUntil,this.time+t.slow*(s?.5:1))),t.poison){this.dotSeen=!0;const o=1-Math.min(.5,this.stats.poisonFast),i=t.poison*(1+(t.poisonMult??0))*this.damageMultiplier()*(t.power??this.stats.powerMelee)*(1+this.stats.poisonDmg+this.stats.dotDmg)/o,r=t.src==="envenom"?this.runItems.deityLevel("envenom"):0,l=r?e.poisons.get("envenom"):void 0,d=l&&l.until>this.time?Math.min(iS,(l.stacks??0)+1):0;this.addPoison(e,t.src,(n=t.tags)!=null&&n.poison?`Veneno (${t.tags.poison})`:"Veneno",i*(1+rS(r)*d),(3+(t.poisonTime??0)+this.stats.poisonTime)*o,d)}if(t.weaken&&(e.weak=Math.max(e.weakUntil>this.time?e.weak:0,Math.min(.75,t.weaken)),e.weakUntil=this.time+(t.weakenTime??6)),t.mark&&(e.mark=Math.max(e.markUntil>this.time?e.mark:0,t.mark),e.markUntil=this.time+(t.markTime??4)),t.zenyMark&&(e.zenyMarkUntil=Math.max(e.zenyMarkUntil,this.time+t.zenyMark)),s||((t.freeze||t.freezeChance)&&le()<(t.freezeChance??1)&&(e.freezeUntil=Math.max(e.freezeUntil,this.time+(t.freeze||Dv)),e.petrified=!1),t.stun&&le()<(t.stunChance??1)&&(e.stunUntil=Math.max(e.stunUntil,this.time+t.stun)),t.blind&&(e.blindUntil=Math.max(e.blindUntil,this.time+t.blind),e.blindDir=le()*Math.PI*2)),t.knock&&t.fromX!==void 0&&t.fromY!==void 0&&!s&&!e.stopped(this.time)){const o=e.x-t.fromX,i=e.y-t.fromY,r=we(o,i)||1;e.kx+=o/r*t.knock*3,e.ky+=i/r*t.knock*3}}shareParty(e){var t;(t=this.coop)==null||t.shareParty(e)}receiveParty(e,t,s){var i,r;const n=this.player;if(n.dead||this.state==="over")return;const o=e.area;if(Array.isArray(o)&&o.length===3&&o.every(Number.isFinite)){if(we(n.x-o[0],n.y-o[1])>Math.min(o[2],t0))return}else if(we(n.x-t,n.y-s)>t0)return;for(const[l,d,h]of e.buffs??[]){if(!iP.has(l)||!Number.isFinite(d)||!Number.isFinite(h))continue;const u=this.buffs.get(l);u&&u.until>this.time&&u.value>d||this.addBuff(l,d,Math.min(120,Math.max(0,h)),e.src)}e.heal&&Number.isFinite(e.heal)&&e.heal>0&&this.healPlayer(e.heal),(r=(i=lS)[e.src])==null||r.call(i,this,n.x,n.y)}addBuff(e,t,s,n,o){this.buffs.set(e,{value:t,until:this.time+s,total:s,skill:n,stacks:o})}addChargeBuff(e,t,s){this.buffs.set(e,{value:t,until:1/0,total:t,skill:s,charges:!0})}activeBuffs(){const e=new Map;for(const[t,s]of this.buffs){if(!s.skill||s.until<=this.time)continue;const n=jP[t],o=s.charges?`${s.skill}-charges`:s.skill;let i=e.get(o);i||e.set(o,i={key:o,skill:s.skill,left:0,total:s.total,text:[],color:(n==null?void 0:n.color)??16777215,charges:!!s.charges,stacks:0}),i.stacks=Math.max(i.stacks,s.stacks??0),i.left=Math.max(i.left,s.charges?s.value:s.until-this.time),i.total=Math.max(i.total,s.total),n&&i.text.push(n.text(s.value))}return this.hiddenUntil>this.time&&e.set("hiding",{key:"hiding",skill:"hiding",stacks:0,left:this.hiddenUntil-this.time,total:this.hideTotal,text:[c("Oculto: los enemigos no te tocan")],color:13153535}),[...e.values()].map(t=>({...t,text:t.text.join(" · ")}))}updateBuffAuras(e){const t=this.player,s=this.activeBuffs(),n=new Set(s.map(o=>o.key));for(const[o,i]of this.buffAuras)n.has(o)||(i.ring.dispose(),this.buffAuras.delete(o));s.forEach((o,i)=>{let r=this.buffAuras.get(o.key);r||(r={ring:this.groundSprite(cS()),t:0,spark:0},r.ring.tint=o.color,this.buffAuras.set(o.key,r)),r.t+=e,r.spark-=e;const l=r.ring;l.x=t.x,l.y=t.y,l.size=64+i*18+Le(r.t*4)*4;const d=o.left<2?.5+.5*Le(r.t*18):1;l.alpha=(.45+.15*Le(r.t*4))*d,r.spark<=0&&(r.spark=.7,this.addFx(ml(Ap(t.x,t.y,Za("tex_pok3"),3,o.color,900,96,.22),t)))})}spendBuff(e){const t=this.buffs.get(e);return!t||t.until<=this.time?!1:(t.value-=1,t.value<=0&&(t.until=this.time),!0)}clearBuff(e){this.buffs.delete(e)}buffValue(e){const t=this.buffs.get(e);return t&&t.until>this.time?t.value:0}buffStacks(e){const t=this.buffs.get(e);return t&&t.until>this.time?t.stacks??0:0}hidePlayer(e){this.hiddenUntil=this.time+e,this.hideTotal=e}partyZeny(e){return this.coop?this.coop.gain()*(e.elite||e.def.boss?1:1/this.coop.partyScale().count):1}zenyPayout(e){if(e.zenyMarkUntil<=this.time||!this.runItems.deityLevel("zeny_rain"))return;this.endless||(this.dropPickup("zeny",e.x,e.y,(2+Math.ceil(e.def.exp/2))*this.partyZeny(e)),this.addFx(dS(this,e)));const t=this.weapons.find(s=>s.id==="mammonite");t&&t.timer>0&&(t.timer=Math.max(0,t.timer-PP))}addPoison(e,t,s,n,o,i=0){const r=t??"?",l=e.poisons.get(r),d=l&&l.until>this.time,h=d?l.charges.filter(u=>u.until>this.time):[];h.push({dps:n,until:this.time+o}),h.length>Uv&&(h.sort((u,p)=>p.until-u.until).length=Uv),e.poisons.set(r,{src:t,part:s,charges:h,stacks:i,dps:h.reduce((u,p)=>u+p.dps,0),until:Math.max(...h.map(u=>u.until)),secs:Math.max(d?l.secs:0,o)}),e.poisonUntil=Math.max(e.poisonUntil,this.time+o),e.poisonDps=this.activePoisons(e).reduce((u,p)=>u+p.dps,0)}spreadPoison(e){const t=[...e.poisons.values()].filter(r=>r.until>this.time);if(!t.length)return;const s=this.enemiesInRadius(e.x,e.y,NP).filter(r=>r!==e&&!r.dead);if(!s.length)return;const n=s.filter(r=>!t.every(l=>{var d;return(((d=r.poisons.get(l.src??"?"))==null?void 0:d.until)??0)>this.time})),i=(n.length?n:s).reduce((r,l)=>we(l.x-e.x,l.y-e.y)<we(r.x-e.x,r.y-e.y)?l:r);for(const r of t)for(const l of r.charges)l.until>this.time&&this.addPoison(i,r.src,r.part,l.dps,l.until-this.time)}holdDots(e,t){if(e.poisonUntil>this.time){e.poisonUntil+=t,e.poisonTick-=t;for(const s of e.poisons.values()){s.until+=t;for(const n of s.charges)n.until+=t}}e.bleedUntil>this.time&&(e.bleedUntil+=t,e.bleedTick-=t),e.burnUntil>this.time&&(e.burnUntil+=t,e.burnTick-=t)}activePoisons(e){const t=[...e.poisons.values()].filter(s=>s.until>this.time);for(const s of t)s.charges.some(n=>n.until<=this.time)&&(s.charges=s.charges.filter(n=>n.until>this.time),s.dps=s.charges.reduce((n,o)=>n+o.dps,0));return this.stats.poisonStack>0||t.length<2?t:[t.reduce((s,n)=>n.dps>s.dps?n:s)]}deathEffects(e){this.zenyPayout(e),e.shatterPct>0&&e.freezeUntil>this.time&&this.frostShatter(e),e.burnUntil>this.time&&this.runItems.deityLevel("fire_arrow")&&this.contagion(e),e.chainedUntil>this.time&&(this.healPlayer(this.stats.maxHp*hS),this.addFx(Lg(this,{x:e.x,y:e.y},this.player)))}killEnemy(e){var p,y,w;if(e.killed)return;if(e.killed=!0,(p=this.coop)!=null&&p.replica){for(const m of ro.kill)m(this,e);e.shatterPct>0&&e.freezeUntil>this.time&&this.frostShatter(e),e.burnUntil>this.time&&this.runItems.deityLevel("fire_arrow")&&this.contagion(e),this.replicaDeath(e),this.payKill(e);return}e.netPaid=!0;for(const m of ro.kill)m(this,e);if(this.deathEffects(e),this.endless){this.endlessDeath(e);return}const t=this.pickups.length;e.setState("dead"),e.sprite.tint=16777215,this.kills++,this.killsBy.set(e.def.id,(this.killsBy.get(e.def.id)??0)+1),this.charExp.kill(e.def.level,e.def.exp*(e.elite?5:1));const s=this.dieSounds.get(e.def.id);s&&B.play(s,.3,3);const n=Km[e.def.id],o=sr(this.difficulty),i=e.def.group?this.bosses.filter(m=>m!==e&&!m.dead&&m.def.group===e.def.group):[],r=this.isStory||i.length>0,l=r?0:(e.def.boss?.001:1e-4)*o;n&&le()<l&&this.dropPickup("card",e.x-14,e.y+4,0,n,ru);const d=Ca[e.def.id];d&&!d.from&&!r&&!this.noEgg.has(d.id)&&le()<$o(!!e.def.boss)*o&&(this.noEgg.add(d.id),this.dropPickup("egg",e.x+14,e.y+4,0,d.egg,ru));const h=e.def.boss==="mvp"?Ll:e.def.boss==="mini"?uS:0,u=!!e.def.boss;for(const m of r?[]:Qi[e.def.id]??[]){if(!u&&this.mobLoot>=pd(o))break;if(le()<pS(m.id,m.rate,u)*o){if(this.dropPickup("loot",e.x+(le()-.5)*70,e.y+10+le()*20,0,m.id,Qb(h),e.def.id),u)break;this.mobLoot++}}if(e.def.boss){this.bossKills++,e.def.boss==="mvp"&&!this.mvpsKilled.includes(e.def.id)&&this.mvpsKilled.push(e.def.id),((y=this.script.gate)==null?void 0:y.boss)===e.def.id&&this.openGate();for(let m=0;m<12;m++)this.dropGem(e.x+(le()-.5)*120,e.y+(le()-.5)*80,Math.ceil(e.def.exp/12));this.dropMeat(e.x,e.y,2),this.dropPickup("zeny",e.x+20,e.y-10,Math.round(e.def.exp*.6)*this.partyZeny(e)),this.bosses=this.bosses.filter(m=>m!==e),this.events.onBosses(this.bosses);for(const m of i)m.speedMult*=1.2,m.damage=Math.round(m.damage*1.25),this.events.onAnnounce(c("¡ {
    name
  }
   se enfurece!",{name:m.def.name}));e.def.boss==="mvp"&&!this.bosses.some(m=>m.def.boss==="mvp")&&B.music(this.script.bgm),(w=this.story)==null||w.onKill(e)}else{const m=this.coop&&!e.elite?1/this.coop.partyScale().count:1,f=e.def.exp*e.gemMult*m,v=M=>m<1?Math.floor(M+le()):Math.max(1,Math.round(M)),x=v(f*(e.elite?5:1));x>0&&this.dropGem(e.x,e.y,x);const k=le()<this.stats.extraGemChance?v(f):0;if(k>0&&this.dropGem(e.x+12,e.y+6,k),e.elite?(this.dropPickup("chest",e.x,e.y+6,0),this.dropMeat(e.x-14,e.y+4),this.dropPickup("zeny",e.x+16,e.y-8,(15+e.def.exp*3)*this.partyZeny(e))):(le()<.22&&this.dropPickup("zeny",e.x-8,e.y+4,(1+Math.ceil(e.def.exp/2))*this.partyZeny(e)),!this.isStory&&le()<RP*m&&this.dropPickup("chest",e.x,e.y+6,0)),le()<(e.elite?IP:qP)&&this.dropPickup("magnet",e.x+6,e.y-12,0),!e.elite){const M=this.time-this.lastMeatAt>(this.isStory?YP:VP)&&this.hp<this.stats.maxHp*.4,$=zP*this.stats.potionDropMult*(this.isStory?WP:1);(M||le()<$)&&this.dropMeat(e.x+10,e.y)}}e.elite&&this.spreadAroundChest(t)}endlessDeath(e){e.setState("dead"),e.sprite.tint=16777215,this.kills++,this.killsBy.set(e.def.id,(this.killsBy.get(e.def.id)??0)+1);const t=this.dieSounds.get(e.def.id);t&&B.play(t,.3,3),e.def.boss&&(this.bossKills++,this.bosses=this.bosses.filter(s=>s!==e),this.events.onBosses(this.bosses),e.def.boss==="mvp"&&!this.bosses.some(s=>s.def.boss==="mvp")&&B.music(this.script.bgm)),this.endless.onKill(e)}endlessMob(e,t,s,n=!1,o){let i=o;if(i&&this.walk){const[l,d]=this.walk.nearestWalkable(i.x,i.y);i={x:l,y:d}}const r=this.spawnEnemy(e,t,!i,i,n);return r&&i&&this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",i.x,i.y,{add:!1,scale:.8})),r&&(r.damage=Math.max(1,Math.round(r.damage*s))),r}endlessBoss(e,t,s,n,o){var h;const i=this.logicReach()*.55;let r=go(this.player.x+Ie(t)*i,this.bounds.x0+60,this.bounds.x1-60),l=go(this.player.y+Le(t)*i,this.bounds.y0+60,this.bounds.y1-60);this.walk&&([r,l]=this.walk.nearestWalkable(r,l));const d=this.spawnEnemy(e,this.difficulty.hp,!1,{x:r,y:l});if(!d)return null;if(d.maxHp=d.hp=Math.max(1,Math.round(n)),d.damage=Math.max(1,Math.round(o*this.difficulty.damage)),s){d.speedMult*=cr().mvp.speed;const u=(((h=this.endless)==null?void 0:h.wave.minis)??[]).flatMap(p=>jl[p]??[]);this.bossBrains.set(d,new _c(d,u,.7,!0))}return this.bosses.push(d),this.events.onBosses(this.bosses),this.addFx(Ye("fx_smoke",r,l,{add:!1,scale:1.2})),d}endlessBlast(e,t,s,n,o){const i={dead:!1};this.groundWarning(e,t,s,n,i,()=>{this.addFx(Ye("fx_smoke",e,t,{add:!1,scale:1.1})),!this.player.dead&&we(this.player.x-e,this.player.y-t)<s&&this.hurtPlayer(o)})}towerCards(e=0){const t=[];for(const s of[this.basicAttack,...this.slots]){const n=this.weapons.find(o=>o.id===s);if(n){const o=n.rollTower(e);o&&t.push({id:s,rank:n.rank+1,isNew:!1,rarity:e,upgrade:o})}else this.passiveRank.has(s)&&t.push({id:s,rank:this.passiveRank.get(s)+1,isNew:!1,rarity:e,power:Ii[e].mult})}return t}applyTowerCard(e){if(ce[e.id].kind==="weapon"){const s=this.weapons.find(n=>n.id===e.id);s&&e.upgrade&&s.applyUpgrade(e.upgrade)}else this.passives.set(e.id,(this.passives.get(e.id)??0)+(e.power??1)),this.passiveRank.set(e.id,(this.passiveRank.get(e.id)??0)+1),this.passiveFx(e.id);const t=this.stats.maxHp;this.level++,this.recomputeStats(),this.hp=Math.min(this.stats.maxHp,this.hp+Math.max(0,this.stats.maxHp-t))}towerDeitySkills(){return this.weapons.filter(e=>e.id!==this.basicAttack&&ul(e.id)).map(e=>e.id)}setTowerDeity(e){this.runItems.choose({slot:"deity",item:e,quality:0,value:1,refine:0}),this.recomputeStats()}towerDeityUp(){const e=this.runItems.slots.get("deity");return e?(this.runItems.choose({slot:"deity",item:e.item,quality:0,value:1,refine:e.vals.length}),this.recomputeStats(),e.item):null}towerDeityRank(){var e;return((e=this.runItems.slots.get("deity"))==null?void 0:e.vals.length)??0}endlessClear(){this.fadeMobs();for(const e of[...this.bosses])e.dead||e.removed||(this.fxRoom(!0)&&this.addFx(Ye("fx_smoke",e.x,e.y,{add:!1,scale:1.2})),this.vanishEnemy(e))}endlessFail(){this.player.dead||(this.hp=0,this.player.die(),this.deathTimer=1.4,B.play("player_clothes",.6))}setStageMood(e){var i,r,l;if(Tp)return;const t=et[e];if(!t)return;(i=this.atmosphere)==null||i.destroy(),(r=this.gloom)==null||r.destroy(),(l=this.hall)==null||l.destroy(),this.hall=null;const s=this.world3d.atmos;s.envTint.value.set(1,1,1),s.fogAmount.value=0,s.playerLight.value=0,s.fireLights.value.forEach(d=>d.setW(0));const n=t.mood;this.atmosphere=dv(t.map)?new cv(this.world3d):null,this.gloom=n==="gloom"?new Oc(this.world3d):n==="cave"||n==="sewer"||n==="sea"?new Oc(this.world3d,n==="cave"?hv:n==="sewer"?uv:pv):null;const o=this.app.stage.getChildIndex(this.world)+1;this.gloom&&this.app.stage.addChildAt(this.gloom.view,o),this.atmosphere&&this.app.stage.addChildAt(this.atmosphere.view,o)}endlessShot(e){this.enemyArrow(e,this.player.x,this.player.y,ZP,ej)}grantSkills(e){for(const t of e){const s=ce[t];!s||this.skillLevel(t)||this.slots.length>=this.maxSkills||(s.kind==="weapon"?this.addWeapon(t):(this.slots.push(t),this.passives.set(t,1),this.passiveRank.set(t,1)))}this.recomputeStats(),this.hp=this.stats.maxHp}spreadAroundChest(e){const t=this.pickups.slice(e).filter(i=>!i.dead),s=t.find(i=>i.kind==="chest");if(!s)return;const n=t.filter(i=>i!==s),o=le()*Math.PI*2;n.forEach((i,r)=>{const l=o+r/n.length*Math.PI*2,d=58+le()*14,h=s.x+Ie(l)*d,u=s.y+Le(l)*d;this.walk&&!this.walk.walkable(h,u)||(i.x=h,i.y=u,i.view.zIndex=u-1e3,i.beam&&this.world3d.setBeam(i.beam,h,u))})}dropMeat(e,t,s=1){this.lastMeatAt=this.time,this.dropPickup("meat",e,t,Math.round(Math.max(GP,this.stats.maxHp*UP)*s))}addProjectile(e){e.h0=this.heightAt(e.x,e.y+mo),!e.returns&&e.aimX!==void 0&&e.aimY!==void 0&&e.aimDist>1&&(e.hSlope=(this.heightAt(e.aimX,e.aimY+mo)-e.h0)/e.aimDist),this.projectiles.push(e),this.fxLayer.addChild(e.view)}updateProjectiles(e,t){var s;for(const n of this.projectiles){if(n.returns&&!n.returning&&n.life<n.maxLife*.5&&(n.returning=!0,n.hit.clear()),n.returning){const i=we(n.vx,n.vy),r=this.player.x-n.x,l=this.player.y-35-n.y,d=we(r,l)||1;n.vx=r/d*i,n.vy=l/d*i,d<24&&(n.dead=!0)}const o=n.surge?rP(1-n.life/n.maxLife):1;if(n.x+=n.vx*e*o,n.y+=n.vy*e*o,n.travel+=we(n.vx,n.vy)*e*o,n.life-=n.returning?e*.25:e,n.holy>0&&this.growHolyTrail(n,e),n.model){const i=Math.max(0,n.life/n.maxLife);n.model.update(n.x,n.y+30,Ls(n.vy,n.vx),e,Math.min(1,(1-i)*12,i*5))}"update"in n.view&&typeof n.view.update=="function"&&n.view.update(t),n.spin&&(n.view.rotation+=n.spin*e),n.ghost&&n.returning&&(n.dead=!0);for(const i of this.enemiesInRadius(n.x,n.y+30,n.radius)){if(n.hit.has(i))continue;if(n.hit.add(i),n.ghost){const d=n.hitFx&&this.fxRoom()?n.hitFx(n.x,n.y):null;if(d&&this.addFx(d.lift===void 0?Tr(d,mo):d),n.pierce--<=0){n.dead=!0;break}continue}const r=(n.drag>0||n.vortex>0)&&!i.def.boss;r&&n.carried.push({e:i,ox:i.x-n.x,oy:i.y-(n.y+30)}),this.damageEnemy(i,n.damage,{knock:40,fromX:n.x,fromY:n.y+30,sound:n.sound||void 0,...n.hitOpts,...r?{knock:0}:{}}),n.splash&&n.splash.r>0&&mS(this,i,n.damage*n.splash.pct,n.splash.r,n.hitOpts);const l=n.hitFx?this.fxRoom()?n.hitFx(n.x,n.y):null:Te.fxQuality==="high"?Ri(n.x,n.y):null;if(l&&this.addFx(l.lift===void 0?Tr(l,mo):l),n.pierce--<=0){n.dead=!0;break}}n.vortex>0&&!n.ghost&&this.vortexGather(n),n.life<=0&&(n.dead=!0),n.vortex>0&&!n.ghost?this.vortexCarry(n):n.carried.length&&this.dragCarried(n)}if(this.projectiles.some(n=>n.dead)){for(const n of this.projectiles)n.dead&&(n.view.destroy({children:!0}),(s=n.model)==null||s.dispose(),n.trail&&(n.trail.until=this.time+fP));this.projectiles=this.projectiles.filter(n=>!n.dead)}}dragCarried(e){const t=we(e.vx,e.vy)||1,s=e.vx/t,n=e.vy/t,o=e.x+s*e.radius*.6,i=e.y+30+n*e.radius*.6;e.carried=e.carried.filter(d=>!d.e.dead);const r=e.carried.length;if(e.carried.forEach((d,h)=>{const u=(h-(r-1)/2)*34,p=10-h%2*22;d.ox+=(-n*u+s*p-d.ox)*.2,d.oy+=(s*u+n*p-d.oy)*.2,d.e.x=o+d.ox,d.e.y=i+d.oy,d.e.kx=0,d.e.ky=0,d.e.stunUntil=Math.max(d.e.stunUntil,this.time+.15)}),!e.dead||!r)return;const l=e.damage*(yP+e.drag*r);Mn(this,{x:o,y:i},60+8*Math.min(r,8),16765530,360),this.addFx(Tr(fS(this,o,i,r),0)),this.shake(.16,3+Math.min(r,6)),B.play("ef_shieldpress",.5,2);for(const d of e.carried)this.damageEnemy(d.e,l,{...e.hitOpts,knock:90,fromX:o,fromY:i,part:"Aplastamiento (talento)",hitFx:void 0,sound:void 0});e.carried=[]}vortexGather(e){const t=e.x,s=e.y+30,n=gS*this.stats.areaMult;for(const o of this.enemiesInRadius(t,s,n))o.dead||o.def.boss||e.carried.some(i=>i.e===o)||e.carried.push({e:o,ox:o.x-t,oy:o.y-s});e.travel>=yS&&(e.dead=!0)}vortexCarry(e){const t=e.x,s=e.y+30;e.carried=e.carried.filter(l=>!l.e.dead);const n=e.carried.length,o=this.time*7;if(e.carried.forEach((l,d)=>{const h=o+d/Math.max(1,n)*Math.PI*2,u=18+Math.min(40,n*4);l.ox+=(Ie(h)*u-l.ox)*.18,l.oy+=(Le(h)*u*.7-l.oy)*.18,l.e.x=t+l.ox,l.e.y=s+l.oy,l.e.kx=0,l.e.ky=0,l.e.stunUntil=Math.max(l.e.stunUntil,this.time+.15)}),!e.dead)return;const i=jg*this.stats.areaMult;vS(this,t,s,jg),this.shake(.2,5),B.play("ef_magnumbreak",.45,2);const r=e.damage*e.vortex;for(const l of this.enemiesInRadius(t,s,i))this.damageEnemy(l,r,{...e.hitOpts,src:"arrow_repel",part:"Vórtice",knock:150,fromX:t,fromY:s,hitFx:void 0,sound:void 0});e.carried=[]}growHolyTrail(e,t){const s=e.x,n=e.y+30;if(!e.trail){const o=new dA(this,s-e.vx*t,n-e.vy*t,e.radius);e.trail={trail:o,dps:e.damage*e.holy,src:e.hitOpts.src,until:1/0,acc:0},this.holyTrails.push(e.trail)}e.trail.trail.extend(s,n)}igniteRing(e,t,s,n){const o=new yA(this,e,t,s*(1-uP),s*1.05);this.fireRings.push({ring:o,dps:n*bS,until:this.time+_g,acc:0})}updateFireRings(e){for(const t of this.fireRings){const s=t.until-this.time,n=_g-s;if(t.ring.update(e,Math.min(1,n/.15,s/.5)),t.acc+=e,t.acc<zu)continue;t.acc-=zu;const o=t.ring;for(const i of this.enemiesInRadius(o.x,o.y,o.r1+10))o.contains(i.x,i.y,8)&&this.damageEnemy(i,t.dps*zu,{src:"magnum",part:"Tierra en llamas (Deity)",knock:0,numColor:pP,hitFx:mP})}if(this.fireRings.some(t=>t.until<=this.time)){for(const t of this.fireRings)t.until<=this.time&&t.ring.dispose();this.fireRings=this.fireRings.filter(t=>t.until>this.time)}}updateHolyTrails(e){for(const t of this.holyTrails){const s=t.until-this.time;if(t.trail.update(e,Math.min(1,s/.6)),t.acc+=e,t.acc<Uu)continue;t.acc-=Uu;const n=t.trail,o=(n.x0+n.x1)/2,i=(n.y0+n.y1)/2;for(const r of this.enemiesInRadius(o,i,n.length/2+n.halfW+20))n.distance(r.x,r.y)>n.halfW+8||this.damageEnemy(r,t.dps*Uu,{src:t.src,part:"Rastro sagrado (Deity)",knock:0,numColor:gP})}if(this.holyTrails.some(t=>t.until<=this.time)){for(const t of this.holyTrails)t.until<=this.time&&t.trail.dispose();this.holyTrails=this.holyTrails.filter(t=>t.until>this.time)}}dropGem(e,t,s){if(this.pickups.length>kP){let o=null,i=null,r=Jv*Jv,l=-1;for(const d of this.pickups){if(d.dead||d.kind!=="gem_blue"&&d.kind!=="gem_yellow"&&d.kind!=="gem_red")continue;const h=(d.x-e)*(d.x-e)+(d.y-t)*(d.y-t);h<r&&(r=h,o=d);const u=(d.x-this.player.x)*(d.x-this.player.x)+(d.y-this.player.y)*(d.y-this.player.y);u>l&&(l=u,i=d)}if(o){o.value+=s;return}i&&(s+=i.value,i.dead=!0)}const n=s<=2?"gem_blue":s<=10?"gem_yellow":"gem_red";this.dropPickup(n,e,t,s)}dropPickup(e,t,s,n,o=0,i=-1,r=""){let l,d;if(e==="loot"?(l=se.itemTextures.get(o)??this.gemTextures.chest,d=Re[Math.max(0,i)].color):e==="card"?(l=se.iconTextures.get("card"),d=Re[Math.max(0,i)].color):e==="egg"?(l=se.itemTextures.get(o)??this.gemTextures.chest,d=Re[Math.max(0,i)].color):(l=this.gemTextures[e],e==="chest"&&(d=16762940),e==="magnet"&&(d=10475775)),e==="zeny"){const u=n*XP*this.stats.zenyMult;if(n=this.coop?Math.floor(u+le()):Math.max(1,Math.round(u)),!n)return}const h=new wS(e,t,s,n,l,d);h.ref=o,h.src=r,(e==="loot"||e==="card"||e==="egg")&&i>=0&&(h.quality=i,h.beam=this.world3d.addBeam(t,s,Re[i].color),i>=ru&&B.play("ef_angelus",.35,2)),e==="zeny"&&h.sprite.scale.set(1.4),e==="chest"&&h.sprite.scale.set(1.6),e==="magnet"&&h.sprite.scale.set(1.5),this.pickups.push(h),this.entityLayer.addChild(h.view),h.view.zIndex=s-1e3}vacuum(){let e=0;for(const t of this.pickups)t.dead||t.kind==="meat"||t.kind==="chest"||t.kind==="magnet"||(t.magnet=!0,t.vacuum=!0,e++);B.play("ef_blessing",.5),e&&this.events.onLoot(c("¡Imán! Todo el botín vuela hacia ti"))}updatePickups(e){var n;const t=this.player,s=er(this.stats.pickupRadius+this.buffValue("pickup"),2);if(this.chestMsgCd-=e,(n=this.coop)!=null&&n.replica)return this.replicaPickups(e,s);for(const o of this.pickups){if(o.dead)continue;const i=t.x-o.x,r=t.y-20-o.y,l=i*i+r*r;if(o.kind==="chest"){l<1156&&this.state==="playing"&&this.tryOpenChest(o),o.update(e);continue}if(!o.magnet&&l<s&&(o.magnet=!0),o.magnet){const d=Math.sqrt(l)||1,h=o.vacuum?1100:420,u=Math.min(d,h*e);o.x+=i/d*u,o.y+=r/d*u,d-u<18&&(o.dead=!0,this.coop&&(o.kind==="loot"||o.kind==="card"||o.kind==="egg")?this.coop.lootRoll(o.kind,o.ref,o.quality,o.src):this.collect(o))}o.update(e),o.beam&&this.world3d.setBeam(o.beam,o.x,o.y)}if(this.pickups.some(o=>o.dead)){for(const o of this.pickups)o.dead&&(o.beam&&this.world3d.removeBeam(o.beam),o.view.destroy());this.pickups=this.pickups.filter(o=>!o.dead)}}collect(e,t){switch(e.kind){case"meat":this.healPlayer(e.value*this.stats.potionMult),B.play("heal",.4);break;case"magnet":this.vacuum();break;case"zeny":this.zeny+=e.value,B.play("ef_coin",.25,2);break;case"loot":{const s=Math.max(0,e.quality),n=this.itemLevel(),o=this.itemTier(),i=Zl(s,o,e.ref,this.classDef.id);kS(e.ref)||this.runLoot.push({id:e.ref,quality:s,affixes:i,ilvl:n,tier:o,...e.src?{src:e.src}:{}}),B.play("bs_refinesuccess",.5),this.state="reveal",this.events.onDrop({kind:"gear",id:e.ref,quality:s,affixes:i,tier:o,...t})}break;case"card":this.runCards.push(e.ref),B.play("bs_refinesuccess",.5),this.state="reveal",this.events.onDrop({kind:"card",id:e.ref,quality:Math.max(0,e.quality),affixes:[],...t});break;case"egg":this.runEggs.push(e.ref),B.play("bs_refinesuccess",.5),this.state="reveal",this.events.onDrop({kind:"egg",id:e.ref,quality:Math.max(0,e.quality),affixes:[],...t});break;default:this.gainExp(e.value)}}replicaPickups(e,t){const s=this.player;for(const n of this.pickups){if(n.dead)continue;const o=s.x-n.x,i=s.y-20-n.y,r=o*o+i*i;if(n.kind==="chest"){if(r<1156&&this.state==="playing"&&!s.dead){const l=this.chestCost();this.zeny<l?this.chestMsgCd<=0&&(this.events.onLoot(c("Necesitas  {
    have
  }
  / {
    cost
  }
   zeny para abrir el cofre",{have:this.zeny,cost:l})),this.chestMsgCd=2.5):n.magnet||(n.magnet=!0,this.coop.take(n))}}else r<t&&!n.magnet&&!s.dead&&(n.magnet=!0,this.coop.take(n));if(n.magnet&&n.kind!=="chest"){const l=Math.sqrt(r)||1,d=Math.min(l,420*e);n.x+=o/l*d,n.y+=i/l*d,l-d<18&&(n.view.visible=!1)}n.update(e),n.beam&&this.world3d.setBeam(n.beam,n.x,n.y)}this.sweepPickups()}sweepPickups(){if(this.pickups.some(e=>e.dead)){for(const e of this.pickups)e.dead&&(e.beam&&this.world3d.removeBeam(e.beam),e.view.destroy());this.pickups=this.pickups.filter(e=>!e.dead)}}netPickup(e,t,s,n,o,i,r){if(this.pickups.some(d=>d.nid===e))return;this.dropPickup(t,s,n,o,i,r);const l=this.pickups[this.pickups.length-1];l.nid=e,l.value=o}netPickupGone(e){const t=this.pickups.find(s=>s.nid===e);t&&(t.dead=!0)}netTake(e,t){var s;if(!e.dead){if(e.kind==="chest"){if(this.state!=="playing"||this.zeny<this.chestCost())return;this.tryOpenChest(e);return}e.dead=!0,e.kind==="meat"?t(e.kind,e.value,e.ref,e.quality):e.kind==="loot"||e.kind==="card"||e.kind==="egg"?(s=this.coop)==null||s.lootRoll(e.kind,e.ref,e.quality,e.src):this.collect(e)}}netGot(e,t,s,n,o,i=""){if(this.isStory&&(e==="loot"||e==="card"||e==="egg"))return;const r={kind:e,value:t,ref:s,quality:n,src:i};this.collect(r,o)}netEcon(e,t,s,n,o){const i=e-this.level;this.level=e,this.exp=t,this.expNext=s,this.zeny=n,this.chestsOpened=o,i>0&&(this.pendingLevelUps+=i,this.leveledUp(i))}openPartyChest(e){const t=this.rollChest();!t.length||this.player.dead||(B.play("ef_coin",.5),this.state="levelup",this.events.onChest(t,e))}itemLevel(){return ac(this.stageId)}itemTier(){return pf(this.stageId)}gainExp(e){this.exp+=e*(this.coop?this.coop.expMult(this.stats.expMult):this.stats.expMult);let t=0;for(;this.exp>=this.expNext;)this.exp-=this.expNext,this.level++,this.expNext=au(this.level),this.pendingLevelUps++,t++;t&&this.leveledUp(t)}leveledUp(e){if(this.recomputeStats(),B.play("levelup",.6),this.player.dead||this.healPlayer(this.stats.maxHp*this.stats.levelUpHeal*e),this.angelWings(),this.coop)return this.openLevelUp();this.levelUpQueued||(this.levelUpQueued=!0,this.schedule(_P,()=>{this.levelUpQueued=!1,!(this.player.dead||this.pendingLevelUps<=0)&&(this.state="levelup",this.events.onLevelUp(this.rollChoices()))}))}openLevelUp(){this.player.dead||this.pendingLevelUps<=0||this.state==="levelup"||this.state==="over"||(this.state="levelup",this.events.onLevelUp(this.rollChoices()))}hurtPlayer(e,t,s=!1){var d;if(this.player.dead||this.god||this.state==="cutscene"||this.buffValue("immune")>0)return;t&&t.weakUntil>this.time&&(e*=1-t.weak),this.endless&&(e*=this.endless.hurtMult);const n=this.player;if(!s&&le()<this.stats.flee+this.buffValue("flee")){this.addFx(Tr(Ye("fx_miss",n.x,n.y-95,{add:!1,ms:600}),95));return}(d=this.yggdrasil)!=null&&d.circle.contains(n.x,n.y)&&(e*=1-xS);const o=()=>{const h=this.buffValue("brace"),u=Math.min(Math.max(.75,h),this.stats.damageReduction+this.buffValue("reduction")+this.buffValue("soulWard")+h);return s?Math.round(e):Math.max(1,Math.round((e-this.stats.armor-this.buffValue("armor"))*(1-u)*(1-Uo(this.stats.def))))};let i=o();for(const h of ro.hurt)i=h(this,i,t);if(i<=0)return;this.hp-i<this.stats.maxHp*TP&&this.weapons.some(h=>h.onLowHp(this))&&(i=o()),t&&!t.dead&&this.buffValue("brace")>0&&this.runItems.deityLevel("enlarge_weight")&&(this.applyStatus(t,{knock:320,fromX:n.x,fromY:n.y}),this.addFx(Tr(Ri(t.x,t.y),40)),Mn(this,t,34,16765802,260));const r=this.bastion;if(r&&r.hp>0){const h=Math.min(i,r.hp);if(r.hp-=h,r.absorbed+=h,i-=h,r.dome.hit(),this.addNumber(h,n.x-12,n.y,100,Vv,1.2),i<=0)return}if(this.hp-=i,n.hurtFlash=150,this.addNumber(i,n.x,n.y,90,16732240,1.4),t)for(const h of this.weapons)h.onPlayerHit(this,t);const l=this.buffs.get("reduction");if(t&&!t.dead&&this.stats.endureReflect>0&&(l==null?void 0:l.skill)==="endure"&&l.until>this.time){const h=Math.max(1,Math.round(e*this.stats.endureReflect));this.logDamage("endure","Reflejo (talento)",h,t.hp),t.hp-=h,this.addNumber(h,t.x,t.y,50*(t.def.scale??1),16756832,1.4),t.hp<=0&&this.killEnemy(t)}if(this.hp<=0&&this.revivesUsed<this.stats.revives){this.revivesUsed++,this.hp=this.stats.maxHp,this.addFx(Ye("fx_angel",n.x,n.y,{ms:1200})),B.play("ef_angelus",.6),this.events.onAnnounce(c("¡Revives!"));for(const h of this.enemiesInRadius(n.x,n.y,200))this.applyStatus(h,{knock:400,fromX:n.x,fromY:n.y});return}if(this.hp<=0){this.hp=0,this.player.die(),this.deathTimer=1.4,B.play("player_clothes",.6);const h=yt("str_devil",n.x,n.y);h&&this.addFx(h)}}revivePlayer(e){const t=this.player;t.dead&&(t.revive(),this.hp=Math.max(1,Math.round(this.stats.maxHp*e)),this.addFx(Ye("fx_angel",t.x,t.y,{ms:1200})),B.play("ef_angelus",.6),this.events.onAnnounce(c("¡Te han levantado!")))}healPlayer(e){const t=this.hp;this.hp=Math.min(this.stats.maxHp,this.hp+e);const s=Math.round(this.hp-t);s>0&&this.addNumber(s,this.player.x,this.player.y,100,s0,1.4)}lowHp(){return this.stats.berserk>0||this.hp<this.stats.maxHp*.4}trickleHeal(e){const t=this.hp;this.hp=Math.min(this.stats.maxHp,this.hp+e),this.healShown+=this.hp-t}flushHeal(e){if((this.healFlush-=e)>0)return;this.healFlush=n0;const t=Math.floor(this.healShown);t<1||(this.healShown-=t,this.addNumber(t,this.player.x,this.player.y,100,s0,1.2))}enemiesInRadius(e,t,s){const n=[],o=Math.floor((e-s-40)/vi),i=Math.floor((e+s+40)/vi),r=Math.floor((t-s-40)/vi),l=Math.floor((t+s+40)/vi);for(let d=o;d<=i;d++)for(let h=r;h<=l;h++){const u=this.grid.get(l0(d,h));if(u)for(const p of u){if(p.dead||p.hiddenUntil>this.time)continue;const y=s+p.def.radius*.6;(p.x-e)*(p.x-e)+(p.y-t)*(p.y-t)<y*y&&n.push(p)}}return n}enemiesInSector(e,t,s,n,o){return this.enemiesInRadius(e,t,n).filter(i=>{const r=Ls(i.y-t,i.x-e);let l=Math.abs(r-s);return l>Math.PI&&(l=Math.PI*2-l),l<=o||we(i.x-e,i.y-t)<i.def.radius+10})}claim(e,t,s=0){var o;if(this.claims=this.claims.filter(i=>i.until>this.time&&i.w!==e),!t||t.kind==="self")return;const n=this.time+Math.max(JP,s);if(t.kind==="ground")this.claims.push({w:e,until:n,x:t.x,y:t.y,r:t.r});else for(const i of(o=t.all)!=null&&o.length?t.all:[t.e])this.claims.push({w:e,until:n,e:i,x:0,y:0,r:0})}claimed(e){return!this.aimer||e.def.boss?!1:this.claims.some(t=>t.w!==this.aimer&&t.until>this.time&&(t.e?t.e===e:we(e.x-t.x,e.y-t.y)<t.r))}unclaimedFirst(e){if(!this.aimer||!this.claims.length)return e;const t=e.filter(s=>this.claimed(s));return t.length?[...e.filter(s=>!t.includes(s)),...t]:e}nearestEnemy(e){return this.nearestEnemies(1,e)[0]??null}nearestEnemies(e,t){const s=this.player,n=t*t,o=[];for(const i of this.enemies){if(i.dead||i.hiddenUntil>this.time)continue;const r=(i.x-s.x)*(i.x-s.x)+(i.y-s.y)*(i.y-s.y);r<n&&o.push([r,i])}return o.sort((i,r)=>i[0]-r[0]),o.slice(0,e).map(i=>i[1])}priorityEnemies(e,t){const s=this.nearestEnemies(1/0,t),n=s.filter(wi);return this.unclaimedFirst(n.length?[...n,...s.filter(o=>!wi(o))]:s).slice(0,e)}randomVisibleEnemies(e,t=!1){const s=this.enemies.filter(o=>!o.dead&&o.hiddenUntil<=this.time&&this.inView(o.x,o.y));for(let o=s.length-1;o>0;o--){const i=Math.floor(le()*(o+1));[s[o],s[i]]=[s[i],s[o]]}const n=t?[...s.filter(wi),...s.filter(o=>!wi(o))]:s;return this.unclaimedFirst(n).slice(0,e)}clusterTarget(e=!1,t=90){var s;return((s=this.clusterSpot(t,e))==null?void 0:s.e)??null}clusterTargets(e,t){const s=this.enemies.filter(l=>!l.dead&&l.hiddenUntil<=this.time&&this.inView(l.x,l.y)),n=l=>l.def.boss?r0:l.elite?i0:1,o=this.player,i=s.map(l=>{let d=0;for(const h of this.enemiesInRadius(l.x,l.y,t))h.dead||(d+=n(h));return{e:l,rank:d-we(l.x-o.x,l.y-o.y)*1e-4}});if(i.sort((l,d)=>d.rank-l.rank),this.aimer&&this.claims.length){const l=new Set(s.filter(d=>this.claimed(d)));l.size&&i.sort((d,h)=>+l.has(d.e)-+l.has(h.e))}const r=[];for(const l of i)r.length<e&&r.every(d=>we(d.x-l.e.x,d.y-l.e.y)>t)&&r.push(l.e);for(const l of i)r.length<e&&!r.includes(l.e)&&r.push(l.e);return r}clusterSpot(e,t=!1){const s=this.enemies.filter(h=>!h.dead&&h.hiddenUntil<=this.time&&this.inView(h.x,h.y));if(!s.length)return null;let n=s;if(s.length>o0){const h=s.filter(wi),u=s.filter(p=>!wi(p));for(let p=u.length-1;p>0;p--){const y=Math.floor(le()*(p+1));[u[p],u[y]]=[u[y],u[p]]}n=[...h,...u.slice(0,Math.max(0,o0-h.length))]}const o=h=>t?h.def.boss?r0:h.elite?i0:1:1,i=this.player;let r=null,l=-1;const d=n.filter(h=>!this.claimed(h));d.length&&(n=d);for(const h of n){let u=0,p=0,y=0;for(const m of this.enemiesInRadius(h.x,h.y,e)){const f=o(m);u+=f,p+=m.x*f,y+=m.y*f}if(u<=0)continue;const w=u-we(h.x-i.x,h.y-i.y)*1e-4;w>l&&(l=w,r={x:p/u,y:y/u,e:h})}return r}leadPoint(e,t){const s=this.player,n=e.stopped(this.time)?0:e.def.speed*e.speedMult*ud*this.difficulty.speed*(e.slowUntil>this.time?.5:1)*(e.poisonUntil>this.time?1-this.stats.poisonSlow:1);let o=e.x,i=e.y;for(let r=0;r<t&&n>0;r+=.1){const l=s.x-o,d=s.y-i,h=we(l,d);if(h<=40)break;let u=l/h,p=d/h;if(this.walk&&h>90&&!e.los){const w=this.walk.flowDir(o,i);w&&([u,p]=w)}const y=Math.min(n*Math.min(.1,t-r),h-40);o+=u*y,i+=p*y}return{x:o,y:i}}strongestVisibleEnemies(e){return this.enemies.filter(t=>!t.dead&&t.hiddenUntil<=this.time&&this.inView(t.x,t.y)).sort((t,s)=>s.hp-t.hp).slice(0,e)}enemyArrow(e,t,s,n,o){if(!this.deterministic&&this.fx.length>=160)return;const i=Ls(s-e.y,t-e.x),r=Ie(i)*n,l=Le(i)*n,d=new sn(se.sheet("fx_arrow"),"a2");d.scale.set(.9);const h=new Je;h.addChild(d);let u=e.x,p=e.y,y=0;const w=e.damage,m={view:h,upright:!0,lift:mo,anchor:{x:u,y:p},update:f=>{const v=f/1e3;u+=r*v,p+=l*v,y+=n*v,m.anchor={x:u,y:p};const x=this.world3d.project(u,p),k=this.world3d.project(u+r*.05,p+l*.05);d.rotation=Ls(k.y-x.y,k.x-x.x)+Math.PI;const M=this.player;return!M.dead&&we(M.x-u,M.y-p)<26?(this.hurtPlayer(w,e),!0):y>o||!!this.walk&&!this.walk.walkable(u,p)}};this.addFx(m)}updateMapFires(){const e=this.player;for(const t of this.mapFires){const s=we(t.x-e.x,t.y-e.y)<1700;if(s&&!t.fx){const n=MS(.5);if(!n)continue;n.anchor={x:t.x,y:t.y},t.fx=n,this.addFx(n)}t.fx&&(t.fx.lift=t.h/this.world3d.spriteLift(1)),!s&&t.fx&&(t.fx.off=!0,t.fx=null)}}fxRoom(e=!1){const t=Te.fxQuality;return!(e&&t==="low")&&this.fx.length<xP[t]}addFx(e){this.fx.push(e),this.fxLayer.addChild(e.view)}critFx(e){if(this.critFxCount>=MP[Te.fxQuality])return;const t=$S("fx_crit",e.x,e.y,.9*(e.def.scale??1));if(!t)return;this.critFxCount++;const s=t.update.bind(t);t.update=n=>{const o=s(n);return o&&this.critFxCount--,o},this.addFx(t),B.play(ps()<.5?"ef_hit2":"ef_hit4",.5,3)}addNumber(e,t,s,n,o,i=1.6,r=!1){if(this.numbers.length>=$P[Te.fxQuality]||!Te.damageNumbers)return;const l=new SS(e,t,s,n,o,i,r);return this.numbers.push(l),this.numberLayer.addChild(l.view),l}comboEcho(e,t,s){if(!(!t.num||t.num.dead||t.last<=0)&&(t.total+=Math.max(1,Math.round(t.last*(.9+ps()*.2))),t.num.setValue(t.total,t.crit?16769126:s.numColor??16777215,t.crit),s.sound&&B.play(s.sound,.3,3),s.hitFx&&this.fxRoom())){const n=s.hitFx(e.x,e.y);n&&this.addFx(n)}}schedule(e,t){this.scheduled.push({t:e,fn:t})}};g(Ka,"STORY_ITEM_LEVEL",5),g(Ka,"STEP",1/60);let Gs=Ka;function QP(a,e,t,s){const n=e==="mvp"?84:66,o=e==="mvp"?9:8,i=10,r=-n/2+i;a.roundRect(r-3,-3,n+6,o+6,5).fill({color:16777215,alpha:.95}),a.roundRect(r-1,-1,n+2,o+2,3).fill({color:1053468,alpha:.9}),s>0&&(a.roundRect(r,0,n*s,o,2).fill(t),a.rect(r+1,1,Math.max(0,n*s-2),o*.35).fill({color:16777215,alpha:.4}));const l=r-3-i+2,d=o/2;a.circle(l,d,i).fill(16777215),a.circle(l,d,i-1.8).fill(t),a.circle(l,d-1.2,4.6).fill(16777215),a.roundRect(l-3,d+1.5,6,3.8,1).fill(16777215),a.circle(l-1.8,d-1.2,1.4).fill(t),a.circle(l+1.8,d-1.2,1.4).fill(t),a.rect(l-.5,d+2.6,1,2.7).fill(t)}function fo(a,e){return(Math.floor(a/e)+1)*e}function go(a,e,t){return a<e?e:a>t?t:a}const ZP=420,ej=1e3;function l0(a,e){return(a+32768)*65536+(e+32768)}const vm="ro-life.dev",Td="32b9d0a39ce4d0e72a383610db1f25823d6e433b225e5ed7b17c36916ab989cb",tj=[],tx=()=>!tj.includes(location.hostname)&&new URLSearchParams(location.search).has("dev");async function sj(a){const e=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(a));return[...new Uint8Array(e)].map(t=>t.toString(16).padStart(2,"0")).join("")}function aj(){if(tx())try{localStorage.getItem(vm)===Td&&mk(!0)}catch{}}function nj(a){if(!tx())return;try{if(localStorage.getItem(vm)===Td)return}catch{}const e=async()=>{var n;const s=((n=document.querySelector("#dev-pw"))==null?void 0:n.value)??"";if(s){if(!crypto.subtle||await sj(s)!==Td)return t(!0);mk(!0);try{localStorage.setItem(vm,Td)}catch{}a()}},t=(s=!1)=>{Ae(c("Modo de pruebas"),`${s?`<p class="error">${c("Contraseña incorrecta")}</p>`:""}<label class="field">${c("Contraseña")} <input id="dev-pw" type="password" autocomplete="off" /></label>`,[{label:c("Cancelar")},{label:c("Entrar"),primary:!0,run:()=>void e()}]);const n=document.querySelector("#dev-pw");n.onkeydown=o=>{var i;o.key==="Enter"&&(o.preventDefault(),o.stopPropagation(),(i=document.querySelector("#npc-options .primary"))==null||i.click())},setTimeout(()=>n.focus(),30)};t()}const _i=600,c0=[60,50,40,30,20,10],oj=25;function ij(a,e,t){const s=mn({itemId:e,ilvl:t}),n={...Hh(e,Mh(e,dd)),quality:dd,ilvl:t,tier:s,affixes:Zl(dd,s,e,a.job)};return{g:n,s:nr(n,a.job)}}function Yu(a,e,t,s){return e.filter(n=>n.slot===t).map(n=>ij(a,n.id,s)).sort((n,o)=>o.s-n.s)}function d0(a,e){var m;const t=Object.values(fe).filter(f=>!f.starter&&!f.secret&&En(a,f)),s=Yu(a,t,"weapon",e),n=ge(a.job).scaling==="ranged",o=s.find(f=>{var v;return(v=fe[f.g.itemId].jobs)==null?void 0:v.includes(a.job)})??(n?s.find(f=>fe[f.g.itemId].wtype==="활"):void 0)??s[0],i=!!o&&Ji(fe[o.g.itemId]),l=bs.filter(f=>f.id!=="weapon"&&(f.id!=="shield"||!i)).map(f=>({slot:f.id,list:Yu(a,t,f.gear,e),i:0})).filter(f=>f.list.length),d=()=>((o==null?void 0:o.s)??0)+l.reduce((f,v)=>f+v.list[v.i].s,0);let h=d();for(;h>_i;){const f=l.filter(x=>x.i<x.list.length-1).sort((x,k)=>x.list[x.i].s-x.list[x.i+1].s-(k.list[k.i].s-k.list[k.i+1].s))[0];if(!f)break;f.i++;const v=d();if(v<_i&&_i-v>h-_i){f.i--;break}h=v}const u=[...o?[["weapon",o.g]]:[],...l.map(f=>[f.slot,f.list[f.i].g])],p=[],y=new Set([((m=fe[(o==null?void 0:o.g.itemId)??-1])==null?void 0:m.wtype)??""]);for(const f of s){const v=fe[f.g.itemId].wtype??"";y.has(v)||(y.add(v),p.push(f.g))}const w=i?Yu(a,t,"shield",e)[0]:void 0;return w&&p.push(w.g),{worn:u,spare:p,total:d()}}function rj(a){let e=d0(a,c0[0]);for(const o of c0.slice(1)){if(e.total<=_i+oj)break;e=d0(a,o)}const{worn:t,spare:s}=e,n=xt();for(const o of[...t.map(([,i])=>i),...s])n.inventory.push({...o,owner:a.id});eo(n),a.equipped=Object.fromEntries(t.map(([o,i])=>[o,i.uid])),a.starterGiven=!0,ja(a)}var h0={commit:"7967a1a",date:"2026-11-11T01:47:09.000Z"};const Cs=a=>document.getElementById(a);let Cn="sound",bm=null,en=null;const lj=[{id:"sound",label:"Sonido"},{id:"graphics",label:"Gráficos"},{id:"game",label:"Juego"},{id:"lang",label:"Idioma"},{id:"controls",label:"Controles"}],sx={sound:["master","music","sfx","ambient","ui","muted","muteHidden"],graphics:["fxOpacity","fxQuality","resolution"],game:["damageNumbers","straightNumbers","screenShake","autoPause","profanityFilter","uiScale"],lang:["chatLocal","chatGeneral","chatTrade","chatCn"],controls:[]},cj=[{key:"master",label:"Volumen general",hint:"Todo el sonido del juego"},{key:"music",label:"Música",hint:"Temas de Prontera, los campos y los MVP"},{key:"sfx",label:"Efectos",hint:"Habilidades, golpes, monstruos y botín"},{key:"ambient",label:"Ambiente",hint:"Viento, tormentas y animales"},{key:"ui",label:"Interfaz",hint:"Equipar, vender y subir estadísticas"}],dj=[{key:"chatLocal",label:"Canal",hint:"Los jugadores de tu canal de la plaza (también en bocadillos)"},{key:"chatGeneral",label:"General",hint:"Todos los canales de la plaza"},{key:"chatTrade",label:"Comercio",hint:"Compraventa, de todos los canales de la plaza"},{key:"chatCn",label:"Canal 中文 (chino)",hint:"Los mensajes en chino del General y el Comercio van a este canal; solo los ves con él activado"}],hj=[0,.8,.9,1,1.15,1.35,1.55],uj=[{id:"high",label:"Alta"},{id:"mid",label:"Media"},{id:"low",label:"Baja"}];function pj(){return!Cs("options").classList.contains("hidden")}function ch(a,e){bm=null,en=e??null,il(),Cs("opt-version").textContent=mj(),Ue("options")}function Vl(){de("options");const a=bm;bm=null,en=null,a==null||a()}function mj(){const a=new Date(h0.date).toLocaleString(Te.lang,{dateStyle:"short",timeStyle:"short"});return c("Versión  {
    v
  }
  ",{v:`${a} · ${h0.commit}`})}function bn(a,e,t=""){return`<label class="opt-row opt-check"><span><b>${c(e)}</b>${t?`<small>${c(t)}</small>`:""}</span>
    <input type="checkbox" data-check="$ {
    a
  }
  "${Te[a]?" checked":""}><i class="opt-switch"></i></label>`}function u0(a,e,t){return`<div class="opt-row"><span><b>${c(e)}</b><small>${c(t)}</small></span>
    <div class="seg opt-seg">${uj.map(s=>`<button class="ro-btn small$ {
    PS(a)===s.id?" active":""
  }
  " data-level="$ {
    a
  }
  " data-value="$ {
    s.id
  }
  ">${c(s.label)}</button>`).join("")}</div></div>`}function il(){Cs("opt-tabs").innerHTML=lj.map(e=>`<button class="tab-btn$ {
    e.id===Cn?" active":""
  }
  " data-opt-tab="$ {
    e.id
  }
  ">${c(e.label)}</button>`).join("");const a=Cs("opt-body");if(Cn==="sound")a.innerHTML=bn("muted","Silenciar todo",Qe?"":"También con la tecla M")+cj.map(e=>`<div class="opt-row opt-range$ {
    Te.muted?" off":""
  }
  "><span><b>${c(e.label)}</b><small>${c(e.hint)}</small></span>
          <input type="range" min="0" max="100" step="1" value="$ {
    Math.round(Te[e.key]*100)
  }
  " data-vol="$ {
    e.key
  }
  "><output>${Math.round(Te[e.key]*100)}%</output></div>`).join("")+bn("muteHidden","Silenciar en segundo plano","Cuando cambias de pestaña o de app");else if(Cn==="graphics"){const e=Math.round(Te.fxOpacity*100);a.innerHTML=`<div class="opt-row opt-range"><span><b>${c("Opacidad de los efectos")}</b><small>${c("Skills y golpes; los avisos de los jefes y el botín siempre se ven enteros")}</small></span>
        <input type="range" min="10" max="100" step="5" value="$ {
    e
  }
  " data-pct="fxOpacity"><output>${e}%</output></div>`+u0("fxQuality","Calidad de los efectos","En media y baja hay menos chispas de golpe, críticos, humo y números de daño a la vez")+u0("resolution","Resolución","El mundo y los efectos se dibujan con menos píxeles: más fluido en móviles y equipos justos")}else if(Cn==="game")a.innerHTML=bn("damageNumbers","Números de daño","El daño que haces y recibes sobre los personajes")+bn("straightNumbers","Números en línea recta","Suben derechos y se desvanecen, en vez del arco de RO")+bn("screenShake","Temblor de pantalla","Magnum Break, meteoritos y otros golpes fuertes")+bn("autoPause","Pausa automática","Pausa la partida al cambiar de pestaña o de app")+bn("profanityFilter","Filtro de palabras","Tapa palabrotas e insultos en el chat; lo más grave se tapa siempre")+`<div class="opt-row"><span><b>${c("Tamaño de la interfaz")}</b><small>${c("Ventanas, HUD y textos")}</small></span>
        <div class="seg opt-seg">${hj.map(e=>`<button class="ro-btn small$ {
    Te.uiScale===e?" active":""
  }
  " data-scale="$ {
    e
  }
  ">${e?Math.round(e*100)+"%":c("Auto")}</button>`).join("")}</div></div>`+(en?`<div class="opt-section-title">${c("Cuenta")}</div>
        <div class="opt-row"><span><b>${en.label}</b><small>${en.hint}</small></span><button class="ro-btn small" data-action>${en.label}</button></div>`:"");else if(Cn==="lang")a.innerHTML=`<div class="opt-row"><span><b>${c("Idioma")}</b><small>${c("Textos del juego y de las ventanas")}</small></span>
        <div class="seg opt-seg">${hw.map(e=>`<button class="ro-btn small$ {
    Te.lang===e.id?" active":""
  }
  " data-lang="$ {
    e.id
  }
  ">${e.name}</button>`).join("")}</div></div>
      <p class="muted opt-note">${c("Los nombres de habilidades, monstruos y objetos son los del cliente de Ragnarok.")}</p>
      <div class="opt-section-title">${c("Canales de chat")}</div>`+dj.map(e=>bn(e.key,e.label,e.hint)).join("");else{const e=Qe?[["Un dedo","Moverse (joystick)"],["Toque corto","Ir andando hasta ahí"],["Dos dedos","Girar la cámara y hacer zoom"],["❚❚","Pausa"]]:[["WASD / ↑↓←→","Moverse"],["Q / E","Girar la cámara"],["Clic derecho + arrastrar","Girar la cámara"],["Rueda del ratón","Acercar o alejar la cámara"],["Esc","Opciones, pausa o volver atrás"],["C","Personaje (en Prontera)"],["X","Cambiar personaje (en Prontera)"],["M","Silenciar"],["Enter","Jugar (en la selección)"]],t=[["Stick izquierdo","Moverse"],["Stick derecho / LB RB","Girar la cámara"],["Stick derecho ↑↓","Acercar o alejar la cámara"],["Start","Pausa"],["Cruceta / stick","Moverse por los menús"],["A","Elegir o hablar con un NPC"],["B","Volver atrás"],["X","Clic derecho: quitar un talento o la pieza de una casilla, +10 a una estadística"],["X","Amigos (en Prontera)"],["Y","Personaje (en Prontera); añadir cartas a la pieza de una casilla"],["Select","Cambiar personaje (en Prontera)"],["←/→","Elegir a un jugador de alrededor (en Prontera); A, su menú"],["↑ / ↓","Chat / emotes y frases rápidas (en Prontera)"],["RT","Entrar en el panel del grupo (en Prontera); B sale"],["LB / RB","Cambiar de pestaña en las ventanas"],["LT / RT","Cambiar de filtro o de rama de talentos"]],s=n=>`<div class="opt-keys">${n.map(([o,i])=>`<kbd>${c(o)}</kbd><span>${c(i)}</span>`).join("")}</div>`;a.innerHTML=`${s(e)}<div class="opt-keys-title">${c("Mando")}</div>${s(t)}`}Cs("opt-defaults").classList.toggle("hidden",!sx[Cn].length),Cs("opt-install").classList.toggle("hidden",!e1())}function Xu(){const a=document.documentElement.style;Te.uiScale?a.setProperty("--ui",String(Te.uiScale)):a.removeProperty("--ui")}function fj(){Cs("opt-tabs").addEventListener("click",e=>{const t=e.target.closest("[data-opt-tab]");t&&(Cn=t.dataset.optTab,il())});const a=Cs("opt-body");a.addEventListener("input",e=>{const t=e.target;t.dataset.vol?($n({[t.dataset.vol]:Number(t.value)/100}),t.nextElementSibling.textContent=`${t.value}%`):t.dataset.pct&&($n({[t.dataset.pct]:Number(t.value)/100}),t.nextElementSibling.textContent=`${t.value}%`)}),a.addEventListener("change",e=>{const t=e.target;t.dataset.check&&($n({[t.dataset.check]:t.checked}),t.dataset.check==="muted"&&il())}),a.addEventListener("click",e=>{const t=e.target.closest("[data-scale], [data-lang], [data-level], [data-action]");if(t){if(t.dataset.action!==void 0)return en==null?void 0:en.run();t.dataset.level?$n({[t.dataset.level]:t.dataset.value}):t.dataset.scale?($n({uiScale:Number(t.dataset.scale)}),Xu()):$n({lang:t.dataset.lang}),il()}}),Cs("opt-defaults").onclick=()=>{AS(sx[Cn]),Xu(),il()},Cs("opt-close").onclick=()=>Vl(),Cs("opt-install").onclick=()=>void YC(),window.addEventListener("ro-install",()=>Cs("opt-install").classList.toggle("hidden",!e1())),Cs("options").addEventListener("pointerdown",e=>{e.target===e.currentTarget&&Vl()}),Xu()}let p0=null,m0=new Set;function gj(a,e){var s;if((s=fe[a.itemId])!=null&&s.starter||a.owner)return!0;const t=b1();return t?(t!==p0&&(p0=t,m0=new Set(t.uids)),!m0.has(a.uid)&&!Ul().has(a.uid)):!1}function wm(a,e){return gj(a)?`<span class="untradable-tag" title="$ {
    c("No se puede dar en un intercambio")
  }
  ">${c("No comerciable")}</span>`:""}const km=a=>a.replace(/[&<>"]/g,e=>( {
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"
  })[e]),ax=a=>a.length?`<ul class="bon-list">${On(a).map(e=>`<li>$ {
    e
  }
  </li>`).join("")}</ul>`:"",yj= {
    weapon:"Arma",armor:"Armadura",shield:"Escudo",garment:"Capa",shoes:"Calzado",headgear:"Casco",accessory:"Accesorio"
  },nx='<span class="safe-tag" aria-hidden="true">🔒</span>';function rc(a,e="") {
    const t=fe[a.itemId];if(!t)return"";const s=wa(a),n=[s.atk?`+${s.atk} ATK`:"",s.matk?`+${s.matk} MATK`:"",s.def?`DEF ${Ee(s.def,1)}`:""].filter(Boolean),o=[a.refine?c("Refinado +{n}: ×{m}", {
      n:a.refine,m:Ee(yr(a.refine),2)
    }):""].filter(Boolean),i=bs.find(d=>d.gear===t.slot).name,r=a.cards.filter(d=>!!d),l=[...Oo(a),...r.flatMap(d=> {
      var h;return((h=ms[d])==null?void 0:h.bonuses)??[]
    })];return`<div class="tip-item"><img class="tip-icon" src="${Me(a.itemId)}" alt=""><div>
    <b style="color:${a.quality?Ps(a.quality):"inherit"}">${km(ss(a))}</b>
    <div class="muted">${a.quality?`$ {
      Re[a.quality].name
    }
     · `:""}${t.starter?"":`Tier $ {
      mn(a)
    }
     · `}${i}${t.starter?` · $ {
      c("equipo inicial")
    }
    `:""}</div>${wm(a)}${a.safe?`<span class="safe-chip">$ {
      c("Protegido")
    }
    </span>`:""}
  </div></div>
  ${t.jobs?`<div class="muted">$ {
      t.jobs.map(d=>ge(d).name).join(", ")
    }
    </div>`:""}
  ${n.length?`<div class="base-stats">$ {
      n.join(" · ")
    }
    </div>`:""}${o.length?`<div class="muted">$ {
      o.join(" · ")
    }
    </div>`:""}
  ${ax(l)}
  ${a.cards.length?`<div class="muted">$ {
      c("Cartas")
    }
    : $ {
      r.length?r.map(d=>km(qt(d))).join(", "):c("{n} huecos para cartas libres", {
        n:a.cards.length
      })
    }
    </div>`:""}
  ${e}`
  }
  function Fh(a,e="") {
    const t=ms[a];return t?`<div class="tip-item"><img class="tip-card" src="${Fs(a)}" alt=""><div>
    <b>${km(qt(a))}</b>
    <div class="muted">${c("Se encaja en")}: ${c(yj[t.compound]??t.compound)}</div>
    ${ax(t.bonuses)}
  </div></div>${e}`:""
  }
  let An=null,Ju=null;function to(a,e,t) {
    if(Qe)return;An||(An=document.createElement("div"),An.className="tooltip item-tip hidden",document.body.appendChild(An));const s=An;a.onmousemove=n=> {
      const o=n.target.closest(e);if(!o||!a.contains(o))return s.classList.add("hidden");if(o!==Ju||s.classList.contains("hidden")) {
        const u=t(o);if(Ju=o,!u)return Ju=null,s.classList.add("hidden");s.innerHTML=u,s.classList.remove("hidden")
      }
      const i=Jn(), {
        width:r,height:l
      }
      =s.getBoundingClientRect(),d=n.clientX+16+r>window.innerWidth?n.clientX-r-12:n.clientX+16,h=Math.min(window.innerHeight-l-8,n.clientY+12);s.style.left=`${Math.max(8,d)/i}px`,s.style.top=`${Math.max(8,h)/i}px`
    },a.onmouseleave=()=>s.classList.add("hidden")
  }
  function lc() {
    An==null||An.classList.add("hidden")
  }
  const f0=(a,e)=>e?c("{job} se desbloquea con un secreto de {stage}", {
    job:a,stage:e.name
  }):c("{job} se desbloquea con un secreto", {
    job:a
  });function vj(a) {
    const e=Cl[a]??Cl[ge(a).base??""]??[];return {
      weapon:e.find(t=> {
        var s;return((s=fe[t])==null?void 0:s.slot)==="weapon"
      }),shield:e.find(t=> {
        var s;return((s=fe[t])==null?void 0:s.slot)==="shield"
      }),cart:Vb.has(a)?Kb(1):void 0
    }
  }
  const bj= {
    melee:"str",ranged:"dex",magic:"int"
  },Fr= {
    acolyte: {
      stats:["int","str"],note:"Daño del Acolyte: INT camino de Priest, STR camino de Monk."
    }
  },$e=a=>document.getElementById(a);function Of(a,e) {
    const t=performance.now();let s=!1;const n=o=> {
      s||!a.isConnected||(a.offsetParent!==null&&e(o-t),requestAnimationFrame(n))
    };return requestAnimationFrame(n),()=>s=!0
  }
  const g0=60,y0=50;function wj() {
    const a=["Ka","Ri","Lu","Mo","Ae","Sel","Dar","Fe","Ny","To","Va","Zen","Mi","Ro","Ash","El"],e=["ra","li","no","ve","ri","sa","ki","ma","do","ne"],t=["n","ra","el","is","ko","th","ya","on","ia","us"],s=n=>n[Math.floor(Math.random()*n.length)];return s(a)+(Math.random()<.5?s(e):"")+s(t)
  }
  function dh(a,e,t,s,n,o,i) {
    a.innerHTML="";for(const[r,l]of e.entries()) {
      const d=document.createElement("button"),h=i==null?void 0:i(l);d.className=`ro-btn swatch${l===t?" active":""}${h?" locked":""}`;const u=n?ec().find(w=>w.row===l):void 0,p=l===0?c("Original"):u?c(u.name):c("Color {n}", {
        n:r
      });d.title=h?`${p} — ${h}`:p;const y=document.createElement("canvas");y.width=30,y.height=30,d.appendChild(y),h&&d.insertAdjacentHTML("beforeend",'<i class="swatch-lock">🔒</i>'),d.onclick=()=>o(l),a.appendChild(d),s&&_S(s.json,l).then(w=> {
        const m=w.frames[w.action("idle").dirs[0][0][0]];if(!m)return;const f=y.getContext("2d");f.imageSmoothingEnabled=!1;const v=Math.min(28/m.w,28/m.h,1.5);f.drawImage(w.canvas,m.x,m.y,m.w,m.h,15-m.w*v/2,15-m.h*v/2,m.w*v,m.h*v)
      })
    }
  }
  let Cd=null;function xm() {
    Cd==null||Cd()
  }
  function ox(a) {
    let e=0;const t=()=> {
      const y=$a(),w=new Map(y.map(x=>[x.slot,x])),m=$e("slots");m.innerHTML="";for(let x=0;x<C1;x++) {
        const k=w.get(x),M=document.createElement("div");if(M.className=`slot${k?"":" empty"}${x===e?" selected":""}`,k) {
          const $=document.createElement("canvas");$.width=90,$.height=105,M.appendChild($),M.insertAdjacentHTML("beforeend",`<div class="slot-name"></div><div class="slot-job">${zl(k)}<br>Base Lv ${k.level} · Job Lv ${Nh(k)}</div>`),M.querySelector(".slot-name").textContent=k.name,It(ri(k),k.look,La(k)).then(P=> {
            const q=["idle",P.weapon||P.shield?"ready":"walk"],R=jS(P,q,0),L=4;$.width=Math.max(90,2*Math.ceil(Math.max(-R.x0,R.x1))+L*2),$.height=Math.max(105,Math.ceil(R.y1-R.y0)+L*2);const j=$.width/2,A=$.height-L-R.y1,E=$.getContext("2d");E.imageSmoothingEnabled=!1,Of($,C=> {
              E.clearRect(0,0,$.width,$.height),oi(E,P,q[x===e?1:0],0,Math.floor(C/110),j,A)
            })
          })
        }
        else M.textContent=c("Slot vacío");M.onclick=()=> {
          e=x,t()
        },M.ondblclick=()=>k?i():r(),m.appendChild(M)
      }
      const f=w.get(e),v=$e("slot-info");if(f) {
        const x=f.record;v.innerHTML=`<div class="grid">
        <div>${c("Nombre")}: <b class="n"></b></div><div>Job: <b>${zl(f)}</b></div>
        <div>${c("Partidas")}: <b>${x.runs}</b> (${c("{n} victorias",{n:x.wins})})</div><div>${c("Nv récord en partida")}: <b>${x.bestLevel}</b></div>
        <div>${c("Monstruos")}: <b>${x.totalKills}</b></div></div>`,v.querySelector(".n").textContent=f.name
      }
      else v.innerHTML=c("Slot vacío. Pulsa <b>Crear</b> para hacer un personaje nuevo.");$e("btn-play").disabled=!f,$e("btn-delete").disabled=!f,$e("btn-create").disabled=!!f
    },s=()=>$a().find(y=>y.slot===e),n=(y,w="")=> {
      const m=document.createElement("b");m.textContent=y.name;const f=document.createElement("b");f.textContent=w,Ae(c("Cambiar de nombre"),`<p>${c("El nombre {who} ya lo usa otro jugador. Elige otro para seguir con este personaje.",{who:m.outerHTML})}</p><label class="field">${c("Nombre")} <input id="rename-input" maxlength="16" autocomplete="off" spellcheck="false" /></label>${w?`<p>$ {
        f.outerHTML
      }
      </p>`:""}`,[ {
        label:c("Cancelar")
      }, {
        label:c("Cambiar"),primary:!0,run:()=>void o(y,$e("rename-input").value)
      }
      ]),setTimeout(()=> {
        var v;return(v=document.getElementById("rename-input"))==null?void 0:v.focus()
      },50)
    },o=async(y,w)=> {
      const m=w.trim(),f=B1(m,y.id);if(f)return n(y,f);try {
        await v1(y.id,m)
      }
      catch(v) {
        return n(y,v.message)
      }
      y.name=m,delete y.rename,ja(y),t()
    },i=()=> {
      const y=s();if(y) {
        if(y.rename)return n(y);d(),de("charselect"),a(y)
      }
    },r=()=> {
      s()||(d(),de("charselect"),kj(e,y=> {
        y!=null&&y.dev?rj(y):y&&ja(y),ox(a)
      }))
    },l=y=> {
      y.key==="Enter"&&document.getElementById("options").classList.contains("hidden")&&document.getElementById("npc-dialog").classList.contains("hidden")&&i()
    },d=()=> {
      window.removeEventListener("keydown",l),window.removeEventListener("ro-lang",t)
    };Cd=()=> {
      d(),de("charselect")
    };const h=()=>document.querySelector("#slots .slot.selected");rn("charselect",y=> {
      const w=y.focused;if(!(w!=null&&w.closest("#slots")))return y.kind==="B";if(y.kind==="move") {
        const m=pa([...document.querySelectorAll("#slots .slot")],w,y.dx,y.dy);return m?(m.click(),He(h()),!0):!1
      }
      return y.kind==="A"?(s()?i():r(),!0):y.kind==="B"
    },y=>[["A",y!=null&&y.closest("#slots")?s()?"Jugar":"Crear":"Elegir"],["Start","Opciones"]]),$e("btn-play").onclick=i,$e("btn-create").onclick=r,$e("btn-delete").onclick=()=> {
      const y=s();if(!y)return;const w=document.createElement("b");w.textContent=y.name,sa(c("Borrar personaje"),c("¿Borrar a {who}? Se perderán sus récords y su equipo inicial.", {
        who:w.outerHTML
      }),c("Borrar"),()=> {
        h5(y.id),t()
      })
    };const u=()=> {
      if(Mt())return sa(c("Borrar datos de pruebas"),c("¿Borrar todos los personajes de pruebas, su equipo y todo lo que han guardado? Tu cuenta normal no se toca."),c("Borrar todo"),()=> {
        oT(),Vl(),e=0,t()
      });const y=Pa(),w=y?y.name:c("BORRAR"),m=document.createElement("b");m.textContent=w,Ae(c("Borrar progreso"),(y?c("¿Borrar todo el progreso de tu cuenta? Se perderán <b>todos los personajes</b>, el inventario, las cartas, los minerales, los Puntos Kafra y las clases desbloqueadas, también en el servidor y en todos tus dispositivos. Tu usuario sigue existiendo y podrás empezar de cero con él. <b>No se puede deshacer.</b>"):c("¿Borrar todo el progreso de invitado de este navegador? Se perderán <b>todos los personajes</b>, el inventario, las cartas, los minerales, los Puntos Kafra y las clases desbloqueadas. <b>No se puede deshacer.</b>"))+`<p>${c("Para borrar un solo personaje, usa «Borrar» en la selección de personaje.")}</p><label class="field">${c("Para confirmarlo, escribe {w}:",{w:m.outerHTML})}<input id="reset-word" type="text" autocomplete="off" spellcheck="false" /></label>`,[ {
        label:c("Cancelar")
      }, {
        label:c("Borrar todo"),primary:!0,run:()=> {
          u5(),Vl(),e=0,t()
        }
      }
      ]);const f=$e("npc-options").lastElementChild,v=$e("reset-word");f.disabled=!0,v.oninput=()=>f.disabled=v.value.trim().toLowerCase()!==w.toLowerCase(),v.focus()
    };$e("btn-options").onclick=()=>ch(void 0, {
      label:Mt()?c("Borrar datos de pruebas"):c("Borrar progreso"),hint:Mt()?c("Solo los personajes de pruebas; tu cuenta normal no se toca"):c("Todos los personajes, el inventario, l