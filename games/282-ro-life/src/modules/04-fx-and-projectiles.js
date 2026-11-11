/**
 * ============================================================================
 * RO Life Source Module: 04-fx-and-projectiles.js
 * Description: 8-Directional Sprite (`class Fn`), STR Effect Player (`class Bv`), 3D Procedural Weapons/Beams (`dN`/`nN`/`Q6`), and Combat Event Hooks (`Ct`)
 * ============================================================================
 */

class Fn extends Ra {
  constructor(t,n="idle") {
    super();
    x(this,"sheet");
    x(this,"actionName","");
    x(this,"dir",0);
    x(this,"time",0);
    x(this,"loop",!0);
    x(this,"speed",1);
    x(this,"finished",!1);
    x(this,"playSounds",!1);
    x(this,"act");
    x(this,"lastFrame",-1);
    this.sheet=t,this.play(n,!0)
  }
  play(t,n=!0,s=!1) {
    if(t===this.actionName&&!s) {
      this.loop=n;
      return
    }
    this.actionName=t,this.act=this.sheet.action(t),this.loop=n,this.time=0,this.finished=!1,this.lastFrame=-1,this.refresh()
  }
  get duration() {
    return this.frames().length*this.act.delay
  }
  frames() {
    const t=this.act.dirs;
    return t[t.length===1?0:this.dir%t.length]??t[0]
  }
  update(t) {
    this.time+=t*this.speed,this.refresh()
  }
  refresh() {
    const t=this.frames();
    if(!t||t.length===0)return;
    let n=Math.floor(this.time/this.act.delay);
    n>=t.length&&(this.loop?n%=t.length:(n=t.length-1,this.finished=!0)),n!==this.lastFrame&&(this.playSounds&&this.act.sounds[n]&&ce.play(this.act.sounds[n],.5),this.lastFrame=n);
    const s=t[n];
    this.texture!==s&&(this.texture=s,this.anchor.copyFrom(s.defaultAnchor))
  }
}
const rd=110,oN=`
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vPos = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`,rN=`
  uniform vec3 color;
  uniform vec3 rim;
  uniform float time;
  uniform float alpha;
  uniform float groove;
  uniform float flicker;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(vView);
    // luz fija (la escena no tiene luces) y un brillo especular de metal
    float lit = 0.62 + 0.42 * abs(dot(n, normalize(vec3(0.35, 0.8, 0.5))));
    float spec = pow(max(0.0, dot(reflect(-normalize(vec3(0.35, 0.8, 0.5)), n), v)), 18.0);
    vec3 col = color * lit + vec3(1.0) * spec * 0.7;
    // acanaladura central de la hoja (más oscura) con su filo de luz
    col *= 1.0 - groove * 0.28 * (1.0 - smoothstep(0.8, 1.6, abs(vPos.x)));
    // destello que baja por la hoja
    float band = fract(-vPos.y / 140.0 - time * 1.1);
    col += vec3(1.0) * groove * 0.55 * (1.0 - smoothstep(0.0, 0.06, abs(band - 0.5)));
    // bordes de la silueta (fresnel), con parpadeo si va electrificada
    float fres = pow(1.0 - abs(dot(n, v)), 2.2);
    float fl = 1.0 + flicker * (0.6 * sin(time * 47.0) * sin(time * 31.0 + vPos.y * 0.2));
    col += rim * fres * 0.9 * fl;
    gl_FragColor = vec4(col, alpha);
  }`;
function iN() {
  const a=new Pv;
  a.moveTo(-5.5,0),a.lineTo(5.5,0),a.lineTo(4.6,-rd+22),a.lineTo(0,-rd),a.lineTo(-4.6,-rd+22),a.lineTo(-5.5,0);
  const e=new yp(a, {
    depth:1.2,bevelEnabled:!0,bevelThickness:1.3,bevelSize:1.7,bevelSegments:1,curveSegments:1
  });
  return e.translate(0,0,-.6),e.computeVertexNormals(),e
}
let r0=null;
function lN() {
  if(r0)return r0;
  const a=new Pd(30,5,8);
  a.translate(0,2.5,0);
  const e=new Fo(2.6,2.9,22,10);
  e.translate(0,16,0);
  const t=new vp(4.6,12,8);
  return t.translate(0,30,0),r0= {
    blade:iN(),guard:a,grip:e,pommel:t
  }
}
function Jb(a,e,t) {
  return new Ze( {
    vertexShader:oN,fragmentShader:rN,uniforms: {
      color: {
        value:new St(a)
      },rim: {
        value:new St(e)
      },time: {
        value:Math.random()*5
      },alpha: {
        value:0
      },groove: {
        value:t
      },flicker: {
        value:0
      }
    },transparent:!0,side:rt
  })
}
class dN {
  constructor(e,t=!1) {
    x(this,"group",new on);
    x(this,"mats");
    x(this,"grip");
    x(this,"glow");
    x(this,"g");
    x(this,"electric");
    this.g=e,this.electric=t;
    const n=lN(),s=Jb(14673908,t?4179199:10474239,1),o=Jb(14857818,16773296,0);
    t&&(s.uniforms.flicker.value=1),this.mats=[s,o],this.grip=new $o( {
      color:7031346,transparent:!0,opacity:0
    }),this.glow=new $o( {
      color:t?4179199:10474239,transparent:!0,opacity:0,blending:Rt,depthWrite:!1,side:rt
    });
    const r=new Ie(n.blade,this.glow);
    r.scale.set(1.9,1.02,3);
    const i=[new Ie(n.blade,s),new Ie(n.guard,o),new Ie(n.grip,this.grip),new Ie(n.pommel,o),r];
    for(const l of i)l.frustumCulled=!1,l.renderOrder=4,this.group.add(l);
    r.renderOrder=5,e.world3d.scene.add(this.group)
  }
  place(e,t,n,s,o,r) {
    this.group.position.set(e,this.g.world3d.heightAt(e,t)+n+rd,t),this.group.rotation.y=s;
    for(const l of this.mats)l.uniforms.time.value+=r,l.uniforms.alpha.value=o;
    this.grip.opacity=o;
    const i=this.electric?.45+.25*Math.random():.28;
    this.glow.opacity=i*o
  }
  dispose() {
    this.g.world3d.scene.remove(this.group);
    for(const e of this.mats)e.dispose();
    this.grip.dispose(),this.glow.dispose()
  }
}
const cN=3e3,Ay=new WeakMap;
function mA(a) {
  const e=a.world3d;
  let t=Ay.get(e);
  return t||Ay.set(e,t= {
    n:0
  }),t
}
function uN() {
  const a=Tt.fxQuality==="high"?1:Tt.fxQuality==="mid"?.6:.35;
  return Math.round(cN*a*(zs?.4:1))
}
function xd() {
  const a=Tt.fxQuality==="high"?1:Tt.fxQuality==="mid"?.5:.25;
  return zs?a*.5:a
}
function hN(a) {
  const e=mA(a);
  return e.n>=uN()?!1:(e.n++,!0)
}
function mN(a,e) {
  if(e<=0)return;
  const t=mA(a);
  t.n=Math.max(0,t.n-e)
}
function $V(a) {
  var e;
  return((e=Ay.get(a))==null?void 0:e.n)??0
}
const i0=ra/2;
function Wr(a) {
  var e;
  return a.kind==="enemy"?(e=a.all)!=null&&e.length?a.all:[a.e]:[]
}
const pN= {
  neutral:"tex_magic_violet",ghost:"tex_magic_violet",holy:"tex_magic_violet",earth:"tex_magic_violet",fire:"tex_magic_red",water:"tex_magic_blue",wind:"tex_magic_green"
},fN= {
  neutral:[.9,.8,1],ghost:[.85,.7,1],holy:[1,1,.85],earth:[1,.9,.6],fire:[1,.55,.45],water:[.55,.75,1],wind:[.6,1,.6]
},wd=180;
function gN(a,e,t,n) {
  const s=xt.fxTextures.get(pN[n]);
  s&&a.cylinder(a.player.x,a.player.y, {
    texture:s,bottom:1.4*i0,top:1.3*i0,height:3.2*i0,duration:t,alpha:.85,color:fN[n],rotate:!0,follow:()=>a.player
  }),a.addFx(pA(a,e)),a.addFx(yN(a,e)),a.addFx(vN(a,e))
}
function pA(a,e) {
  const t=xt.fxTextures.get("tex_lockon"),n=new Map;
  return {
    view:new ue,update(s) {
      const o=new Set(e.done?[]:Wr(e.aim).filter(r=>!r.dead));
      if(t)for(const r of o)n.has(r)||n.set(r, {
        s:a.groundSprite(t),age:0,out:0
      });
      for(const[r,i]of n) {
        const l=r.def.scale??1;
        if(i.s.x=r.x,i.s.y=r.y,i.s.rotation+=s*.004,o.has(r)) {
          i.age+=s;
          const d=Math.min(1,i.age/250);
          i.s.size=78*l*(2.2-1.2*d),i.s.alpha=d
        }
        else i.out+=s,i.s.alpha=Math.max(0,1-i.out/wd),(i.out>=wd||r.dead)&&(i.s.dispose(),n.delete(r))
      }
      return e.done&&n.size===0
    }
  }
}
function yN(a,e) {
  const t=xt.fxTextures.get("tex_magic_target");
  let n=null,s=0,o=0;
  return {
    view:new ue,update(r) {
      const i=e.aim,l=e.done||i.kind==="enemy"||i.r<=0?null:i;
      if(l&&!n&&t&&(n=a.groundSprite(t)),!n)return!l;
      if(n.rotation+=r*.0012,l) {
        s+=r;
        const d=l.kind==="self"?a.player:l;
        n.x=d.x,n.y=d.y;
        const c=Math.min(1,s/200);
        return n.size=l.r*2*(.6+.4*c),n.alpha=c*(.75+.25*e.progress),!1
      }
      return o+=r,n.alpha=Math.max(0,1-o/wd),o<wd?!1:(n.dispose(),!0)
    }
  }
}
let xh=null;
function ol() {
  if(xh)return xh;
  const a=document.createElement("canvas");
  a.width=a.height=256;
  const e=a.getContext("2d"),t=e.createRadialGradient(128,128,0,128,128,128);
  return t.addColorStop(0,"rgba(255,255,255,0)"),t.addColorStop(.62,"rgba(255,255,255,0.05)"),t.addColorStop(.9,"rgba(255,255,255,0.75)"),t.addColorStop(.96,"rgba(255,255,255,1)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,256,256),xh=qt.from(a),xh
}
const Qb=new Map;
function yr(a) {
  const e=Math.round(a*100),t=Qb.get(e);
  if(t)return t;
  const n=document.createElement("canvas");
  n.width=n.height=256;
  const s=n.getContext("2d"),o=e/100,r=s.createRadialGradient(128,128,0,128,128,128);
  r.addColorStop(0,"rgba(255,255,255,0)"),r.addColorStop(Math.max(0,o-.04),"rgba(255,255,255,0)"),r.addColorStop(o,"rgba(255,255,255,0.85)"),r.addColorStop(Math.min(.9,o+.06),"rgba(255,255,255,0.22)"),r.addColorStop(.9,"rgba(255,255,255,0.3)"),r.addColorStop(.96,"rgba(255,255,255,1)"),r.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=r,s.fillRect(0,0,256,256);
  const i=qt.from(n);
  return Qb.set(e,i),i
}
function Iv(a,e,t,n,s=16777215,o=420,r=.85) {
  const i=a.groundSprite(yr(n));
  i.tint=s;
  let l=0;
  a.addFx( {
    view:new ue,update(d) {
      l+=d;const c=Math.min(1,l/o);return i.x=e.x,i.y=e.y,i.size=2*t*(.92+.08*c),i.alpha=r*(c<.6?1:(1-c)/.4),c<1?!1:(i.dispose(),!0)
    }
  })
}
function ea(a,e,t,n=16777215,s=380) {
  const o=a.groundSprite(ol());
  o.tint=n;
  let r=0;
  a.addFx( {
    view:new ue,update(i) {
      r+=i;const l=Math.min(1,r/s),d=1-(1-l)*(1-l);return o.x=e.x,o.y=e.y,o.size=2*t*(.15+.85*d),o.alpha=.9*(l<.7?1:(1-l)/.3),l<1?!1:(o.dispose(),!0)
    }
  })
}
function uu(a,e,t=350) {
  if(!e.length)return;
  const n= {
    aim: {
      kind:"enemy",e:e[0],all:e
    },done:!1
  };
  a.addFx(pA(a,n)),a.schedule(t/1e3,()=>n.done=!0)
}
function vN(a,e) {
  const t=new et,n=46,s= {
    x:0,y:0
  };
  let o=0;
  return {
    view:t,anchor:s,upright:!0,lift:100,update(r) {
      const i=a.casts.indexOf(e);
      return i>=0&&(this.lift=100+i*8),s.x=a.player.x,s.y=a.player.y,e.done?(o+=r,t.alpha=Math.max(0,1-o/wd),o>=wd):(t.clear(),t.rect(-n/2-1,-1,n+2,6).fill( {
        color:1053468,alpha:.85
      }),t.rect(-n/2,0,n*e.progress,4).fill(5230698),t.rect(-n/2,0,n*e.progress,1.5).fill( {
        color:16777215,alpha:.4
      }),!1)
    }
  }
}
const Zb=[16762586,16769772,16757708],l0=48,oo=4179199;
function Go(a,e,t,n,s,o,r,i,l,d) {
  const c=n-e,u=s-t,h=Math.hypot(c,u)||1,m=-u/h,p=c/h;
  a.moveTo(e,t);
  for(let g=1;g<r;g++) {
    const y=g/r,f=(Math.random()*2-1)*o*Math.sin(y*Math.PI);
    a.lineTo(e+c*y+m*f,t+u*y+p*f)
  }
  a.lineTo(n,s).stroke( {
    color:i,width:l,alpha:d,cap:"round",join:"round"
  })
}
function _N(a,e,t,n,s,o=!1,r=5,i=0) {
  const l=new ue;
  a.fxLayer.addChild(l);
  const d=new et;
  d.blendMode="add";
  const c=new et;
  l.addChild(c,d);
  const u=Array.from( {
    length:r
  },(M,k)=>( {
    model:new dN(a,o),phase:k/r*Math.PI*2,delay:k*35,landed:!1,mid: {
      x:0,y:0
    },top: {
      x:0,y:0
    },z:1
  })),h=[],m=170,p=260,g=s+p,y=Math.random()*Math.PI*2,f=t*(n+(1-n)*.55);
  let v=i>0?0:f,b=0,_=!1,S=0;
  return {
    view:new ue,update(M) {
      if(b+=M,i>0) {
        const w=Math.min(1,b/i);
        v=f*(.15+.85*(1-(1-w)*(1-w)))
      }
      const k=Math.min(1,Math.max(0,(b-m-60)/300));
      S+=M/1e3*Math.PI*2*1.5*k*k;
      const C=(w,T,z)=>a.screenPos(e.x+Math.cos(w)*T,e.y+Math.sin(w)*T,z);
      d.clear(),c.clear();
      const A=b<s?1:Math.max(0,1-(b-s)/120);
      for(const w of u) {
        const T=y+w.phase+S,z=Math.min(1,Math.max(0,(b-w.delay)/m)),L=e.x+Math.cos(T)*v,U=e.y+Math.sin(T)*v,q=a.pixelScale(L,U)*1.8,N=C(T,v,0),H=(1-z*z)*330-l0,V=(b<w.delay?0:Math.min(1,z*3))*A;
        w.model.place(L,U,H,-T+Math.PI/2,V,M/1e3),w.landed=z>=1,w.z=q;
        const te=a.world3d.project(L,U,H+l0+(rd-l0)*.45),pe=a.world3d.project(L,U,H+rd);
        if(w.mid.x=te.x,w.mid.y=te.y,w.top.x=pe.x,w.top.y=pe.y,z<1)continue;
        const ge=b-w.delay-m;
        if(ge<160) {
          const Be=ge/160;
          d.ellipse(N.x,N.y,(10+34*Be)*q,(4+13*Be)*q).stroke( {
            color:15398655,width:2.5*q,alpha:(1-Be)*.9*A
          })
        }
        if(c.ellipse(N.x,N.y+.5*q,7*q,2.4*q).fill( {
          color:3812900,alpha:.45*A
        }),k>0) {
          let Be=N;
          for(let Ye=1;Ye<=10;Ye++) {
            const ae=Ye/10,me=C(T-1.1*k*ae,v,0),Re=o?ae<.3?15400959:oo:ae<.3?15398655:10474239;
            d.moveTo(Be.x,Be.y).lineTo(me.x,me.y).stroke( {
              color:Re,width:6*q*(1-ae)+.5,alpha:(o?.75:.5)*k*(1-ae)*A
            }),Be=me
          }
          if(o) {
            const Ye=C(T-1.1*k,v,0);
            Go(d,N.x,N.y-2*q,Ye.x,Ye.y,7*q,6,oo,3*q,.6*k*A),Go(d,N.x,N.y-2*q,Ye.x,Ye.y,7*q,6,16777215,1.2*q,.9*k*A)
          }
        }
      }
      if(o&&u.forEach((w,T)=> {
        const z=u[(T+1)%u.length];if(!w.landed||!z.landed||Math.random()<.25)return;const L=10*w.z;Go(d,w.mid.x,w.mid.y,z.mid.x,z.mid.y,L,9,oo,4*w.z,.55*A),Go(d,w.mid.x,w.mid.y,z.mid.x,z.mid.y,L,9,16777215,1.4*w.z,.95*A)
      }),!_&&b>=s) {
        _=!0;
        for(const w of u) {
          const T=w.z;
          for(let z=0;z<9;z++) {
            const L=new et().ellipse(0,0,3.4*T,1.8*T).fill( {
              color:Zb[z%Zb.length]
            }),U=Math.random();
            L.position.set(w.top.x+(w.mid.x-w.top.x)*U*2,w.top.y+(w.mid.y-w.top.y)*U*2),l.addChild(L);
            const q=Math.random()*Math.PI*2,N=(40+Math.random()*90)*T;
            h.push( {
              g:L,x:L.x,y:L.y,vx:Math.cos(q)*N,vy:Math.sin(q)*N*.6-60*T,spin:(Math.random()-.5)*14,life:0
            })
          }
        }
      }
      for(const w of h) {
        const T=M/1e3;
        w.life+=M,w.vy+=90*T,w.x+=w.vx*T,w.y+=w.vy*T,w.g.position.set(w.x,w.y),w.g.rotation+=w.spin*T,w.g.alpha=Math.max(0,1-w.life/p)
      }
      if(b<g)return!1;
      l.destroy( {
        children:!0
      });
      for(const w of u)w.model.dispose();
      return!0
    }
  }
}
function bN(a,e,t,n=1) {
  const s=new et;
  s.blendMode="add",a.fxLayer.addChild(s);
  const o=250;
  let r=0,i=0;
  return {
    view:new ue,update(l) {
      if(r+=l,r>=i) {
        i=r+45;
        const d=a.screenPos(e.x,e.y,42),c=a.screenPos(t.x,t.y,42),u=a.pixelScale(t.x,t.y)*n,h=Math.min(26,Math.hypot(c.x-d.x,c.y-d.y)*.18)*u+3,m=1-r/o;
        s.clear(),Go(s,d.x,d.y,c.x,c.y,h,8,oo,7*u,.45*m),Go(s,d.x,d.y,c.x,c.y,h,8,15400959,2.2*u,m),s.circle(c.x,c.y,9*u).fill( {
          color:oo,alpha:.35*m
        })
      }
      return r<o?!1:(s.destroy(),!0)
    }
  }
}
let wh=null;
function xN() {
  if(wh)return wh;
  const a=s=> {
    const o=document.createElement("canvas");
    o.width=o.height=256;
    const r=o.getContext("2d");
    return r.translate(128,128),r.lineCap="round",s(r),qt.from(o)
  },e=a(s=> {
    for(let o=0;o<3;o++) {
      const r=o*Math.PI*2/3;for(const[i,l,d]of[[10,.35,14],[3.5,1,6]])s.beginPath(),s.arc(0,0,112,r,r+1.7),s.strokeStyle=`rgba(255,255,255,${l})`,s.lineWidth=i,s.shadowColor="white",s.shadowBlur=d,s.stroke();s.beginPath(),s.arc(Math.cos(r+1.7)*112,Math.sin(r+1.7)*112,6,0,Math.PI*2),s.fillStyle="white",s.fill()
    }
    s.shadowBlur=0;for(let o=0;o<48;o++) {
      const r=o/48*Math.PI*2;s.beginPath(),s.arc(Math.cos(r)*98,Math.sin(r)*98,o%4===0?2.4:1.2,0,Math.PI*2),s.fillStyle="rgba(255,255,255,0.8)",s.fill()
    }
  }),t=a(s=> {
    s.beginPath(),s.arc(0,0,78,0,Math.PI*2),s.strokeStyle="rgba(255,255,255,0.55)",s.lineWidth=2,s.stroke(),s.beginPath(),s.arc(0,0,62,0,Math.PI*2),s.strokeStyle="rgba(255,255,255,0.3)",s.lineWidth=1.5,s.stroke();for(let o=0;o<8;o++)s.save(),s.rotate(o/8*Math.PI*2),s.beginPath(),s.moveTo(0,-84),s.lineTo(6,-70),s.lineTo(0,-56),s.lineTo(-6,-70),s.closePath(),s.fillStyle="rgba(255,255,255,0.85)",s.shadowColor="white",s.shadowBlur=8,s.fill(),s.beginPath(),s.moveTo(-16,-70),s.lineTo(-10,-70),s.moveTo(10,-70),s.lineTo(16,-70),s.strokeStyle="rgba(255,255,255,0.7)",s.lineWidth=2,s.stroke(),s.restore()
  }),n=a(s=> {
    const o=s.createRadialGradient(0,0,0,0,0,128);o.addColorStop(0,"rgba(255,255,255,0.55)"),o.addColorStop(.5,"rgba(255,255,255,0.22)"),o.addColorStop(.85,"rgba(255,255,255,0.08)"),o.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=o,s.fillRect(-128,-128,256,256)
  });
  return wh= {
    outer:e,inner:t,glow:n
  },wh
}
function YV(a,e,t) {
  const n=xN(),s=a.groundSprite(n.glow),o=a.groundSprite(n.outer),r=a.groundSprite(n.inner);
  s.tint=oo,o.tint=10479359,r.tint=oo;
  const i=new et,l=new et;
  i.blendMode="add",l.blendMode="add",a.fxLayer.addChild(i,l);
  const d=52,c=380,u=1100,h=92,m=(b,_,S,M,k=0)=> {
    const C=[];
    for(let A=0;A<=M;A++) {
      const w=_+(S-_)*A/M,T=a.screenPos(e.x+Math.cos(w)*b,e.y+Math.sin(w)*b,k);
      C.push(T.x,T.y)
    }
    return C
  },p=[0,.5].map(b=>( {
    phase:b,trail:[]
  }));
  let g=0,y=0,f=250,v=null;
  return {
    view:new ue,update(b) {
      g+=b;
      const _=t(),S=a.pixelScale(e.x,e.y);
      let M=Math.min(1,_/250);
      _<1e3&&(M*=.55+.45*Math.abs(Math.sin(g/55)));
      const k=.75+.25*Math.sin(g/140),C=g/900;
      for(const A of[s,o,r])A.x=e.x,A.y=e.y;
      if(s.size=d*2.6,s.alpha=.55*k*M,o.size=d*2.2,o.rotation=C,o.alpha=(.75+.25*k)*M,r.size=d*2.2,r.rotation=-C*1.4,r.alpha=M,i.clear(),g<c) {
        const A=g/c,w=1-A;
        i.poly(m(d*(.4+1.6*A),0,Math.PI*2,36),!0).stroke( {
          color:15400959,width:4*S*w,alpha:w
        });
        const T=a.screenPos(e.x,e.y,45);
        i.circle(T.x,T.y,(20+40*A)*S).fill( {
          color:oo,alpha:.4*w
        }),i.circle(T.x,T.y,(10+14*A)*S).fill( {
          color:16777215,alpha:.6*w
        })
      }
      for(const A of p) {
        const w=((g/u+A.phase)%1+1)%1,T=w*Math.PI*4+A.phase*Math.PI,z=20*(1-w*.45),L=a.screenPos(e.x+Math.cos(T)*z,e.y+Math.sin(T)*z*.6,6+w*h);
        w<.04&&(A.trail.length=0),A.trail.push(L),A.trail.length>9&&A.trail.shift();
        const U=Math.min(1,w/.1,(1-w)/.15)*M;
        for(let q=1;q<A.trail.length;q++) {
          const N=q/A.trail.length;
          i.moveTo(A.trail[q-1].x,A.trail[q-1].y).lineTo(A.trail[q].x,A.trail[q].y).stroke( {
            color:oo,width:3.2*S*N,alpha:.7*N*U,cap:"round"
          })
        }
        i.circle(L.x,L.y,5*S).fill( {
          color:oo,alpha:.35*U
        }),i.circle(L.x,L.y,2.2*S).fill( {
          color:16777215,alpha:U
        })
      }
      if(g>=y) {
        y=g+80,l.clear();
        for(let A=0;A<2;A++) {
          const w=Math.random()<.5?-1:1,T=15+Math.random()*55,z=T+14+Math.random()*18,L=a.screenPos(e.x+w*(8+Math.random()*6),e.y,T),U=a.screenPos(e.x+w*(14+Math.random()*10),e.y,z);
          Go(l,L.x,L.y,U.x,U.y,5*S,4,oo,3*S,.55*M),Go(l,L.x,L.y,U.x,U.y,5*S,4,16777215,1*S,.95*M)
        }
        if(g>=f&&_>300) {
          f=g+550+Math.random()*600;
          const A=Math.random()*Math.PI*2;
          v= {
            x:e.x+Math.cos(A)*d,y:e.y+Math.sin(A)*d,t:g
          }
        }
        if(v&&g-v.t<200) {
          const A=1-(g-v.t)/200,w=a.screenPos(e.x,e.y,h+25),T=a.screenPos(v.x,v.y,0);
          Go(l,w.x,w.y,T.x,T.y,12*S,7,oo,6*S,.5*A*M),Go(l,w.x,w.y,T.x,T.y,12*S,7,15400959,1.8*S,A*M),l.ellipse(T.x,T.y,12*S,6*S).fill( {
            color:15400959,alpha:.55*A*M
          })
        }
      }
      return _>0?!1:(i.destroy(),l.destroy(),s.dispose(),o.dispose(),r.dispose(),!0)
    }
  }
}
function fA(a,e,t,n=!1) {
  const s=new et;
  s.blendMode="add",a.fxLayer.addChild(s);
  const o=n?[ {
    delay:0,color:16773296
  }, {
    delay:80,color:16756794
  }, {
    delay:160,color:16734762
  }, {
    delay:240,color:16765530
  }
  ]:[ {
    delay:0,color:16774102
  }, {
    delay:90,color:13153520
  }, {
    delay:180,color:10848992
  }
  ],r=n?1.5:1,i=420,l=o[o.length-1].delay+i+60,d=Array.from( {
    length:12
  },(u,h)=>( {
    a:h/12*Math.PI*2+(Math.random()-.5)*.25,len:.7+Math.random()*.6
  }));
  a.shake(.18,3);
  let c=0;
  return {
    view:new ue,update(u) {
      c+=u,s.clear();
      const h=a.screenPos(e.x,e.y,0),m=a.screenPos(e.x+t,e.y,0),p=a.screenPos(e.x,e.y+t,0),g=Math.hypot(m.x-h.x,m.y-h.y),y=Math.hypot(p.x-h.x,p.y-h.y),f=a.pixelScale(e.x,e.y);
      for(const b of o) {
        const _=Math.min(1,Math.max(0,(c-b.delay)/i));
        if(_<=0||_>=1)continue;
        const M=.12+.88*(1-(1-_)**3);
        s.ellipse(h.x,h.y,g*M,y*M).stroke( {
          color:b.color,width:(12-9*_)*f*r,alpha:.85*(1-_*_)
        })
      }
      const v=Math.min(1,c/260);
      if(v<1) {
        const b=a.screenPos(e.x,e.y,78);
        for(const _ of d) {
          const S=(16+34*v)*f,M=S+(16-10*v)*_.len*f;
          s.moveTo(b.x+Math.cos(_.a)*S,b.y+Math.sin(_.a)*S).lineTo(b.x+Math.cos(_.a)*M,b.y+Math.sin(_.a)*M).stroke( {
            color:16777215,width:3*f,alpha:1-v,cap:"round"
          })
        }
      }
      return c<l?!1:(s.destroy(),!0)
    }
  }
}
function bp(a,e) {
  const t=new et,n=(r,i)=>t.moveTo(-9,r-5).lineTo(0,r+4).lineTo(9,r-5).stroke( {
    color:9334744,width:4,alpha:i,cap:"round",join:"round"
  }).moveTo(-9,r-5).lineTo(0,r+4).lineTo(9,r-5).stroke( {
    color:15129855,width:1.6,alpha:i,cap:"round",join:"round"
  }),s=750;
  let o=0;
  return {
    view:t,anchor: {
      x:a,y:e
    },lift:70,upright:!0,update(r) {
      o+=r;
      const i=Math.min(1,o/s),l=i<.2?i/.2:1-(i-.2)/.8;
      return t.clear(),n(-14+22*i,l),n(-2+22*i,l*.7),i>=1
    }
  }
}
function XV(a,e,t,n=0) {
  const s=new et;
  s.blendMode="add",a.fxLayer.addChild(s);
  const o=360,r=[],i=(Math.random()-.5)*2;
  let l=-n;
  return {
    view:new ue,update(d) {
      if(l+=d,s.clear(),l<0)return!1;
      const c=Math.min(1,l/o),u=c*c,h=e.x+(t.x-e.x)*u,m=e.y+(t.y-e.y)*u,p=a.screenPos(h,m,35+10*u+Math.sin(c*Math.PI)*45),g=a.screenPos(e.x,e.y,0),y=a.screenPos(t.x,t.y,0),f=Math.hypot(y.x-g.x,y.y-g.y)||1,v=Math.sin(c*Math.PI)*i*30,b=p.x+-(y.y-g.y)/f*v,_=p.y+(y.x-g.x)/f*v;
      r.unshift( {
        x:b,y:_
      }),r.length>7&&r.pop();
      const S=a.pixelScale(h,m);
      return r.forEach((M,k)=>s.circle(M.x,M.y,(6-k*.7)*S).fill( {
        color:16756794,alpha:.5*(1-k/7)
      })),s.circle(b,_,7*S).fill( {
        color:16765530,alpha:.55
      }),s.circle(b,_,3.2*S).fill( {
        color:16777215,alpha:.95
      }),c<1?!1:(s.destroy(),!0)
    }
  }
}
function KV(a,e,t) {
  const n=new et;
  n.blendMode="add",a.fxLayer.addChild(n);
  const s=[];
  let o=0;
  return {
    view:new ue,update(r) {
      const i=Math.max(0,Math.min(1,t()));
      for(o+=r/1e3*(i>0?12+36*i:0);o>=1;)o-=1,s.push( {
        a:Math.random()*Math.PI*2,r:.6+Math.random()*.5,life:0,max:500+Math.random()*300,color:Math.random()<.5?16742954:16765530,size:3.5+Math.random()*3
      });
      n.clear();
      const l=a.pixelScale(e.x,e.y),d=a.screenPos(e.x,e.y,0);
      i>0&&(n.ellipse(d.x,d.y,32*l,12*l).fill( {
        color:16747066,alpha:.18+.22*i
      }),n.ellipse(d.x,d.y-40*l,24*l,46*l).fill( {
        color:16756794,alpha:.06+.1*i
      }));
      for(let c=s.length-1;c>=0;c--) {
        const u=s[c];
        u.life+=r;
        const h=u.life/u.max;
        if(h>=1) {
          s.splice(c,1);
          continue
        }
        const m=d.x+Math.cos(u.a)*22*u.r*l,p=d.y+Math.sin(u.a)*9*u.r*l-(8+95*h)*l;
        n.circle(m,p,u.size*(1-h*.6)*l).fill( {
          color:u.color,alpha:.8*(1-h)
        })
      }
      return i>0||s.length?!1:(n.destroy(),!0)
    }
  }
}
function xp(a,e) {
  const t=new et;
  t.blendMode="add",t.position.set(a,e);
  const n=260;
  let s=0;
  return {
    view:t,upright:!0,update(o) {
      s+=o;
      const r=Math.min(1,s/n);
      t.clear(),t.circle(0,0,8+22*r).stroke( {
        color:16765530,width:4*(1-r)+1,alpha:1-r
      });
      const i=14*(1-r*.5);
      return t.rect(-1.5,-i,3,i*2).fill( {
        color:16777215,alpha:1-r
      }).rect(-i,-1.5,i*2,3).fill( {
        color:16777215,alpha:1-r
      }),r>=1
    }
  }
}
function JV(a,e,t,n) {
  const s=new et;
  s.blendMode="add",s.position.set(e,t);
  const o=420,r=Array.from( {
    length:6+Math.min(n,8)
  },()=>( {
    a:Math.random()*Math.PI*2,len:.6+Math.random()*.6
  })),i=1+Math.min(n,8)*.12;
  let l=0;
  return {
    view:s,update(d) {
      l+=d;
      const c=Math.min(1,l/o),u=1-(1-c)**3;
      s.clear(),s.circle(0,0,(20+60*u)*i).stroke( {
        color:16765530,width:10*(1-c)+1,alpha:.9*(1-c)
      }),s.circle(0,0,(10+40*u)*i).stroke( {
        color:16777215,width:5*(1-c)+.5,alpha:.8*(1-c)
      });
      for(const h of r) {
        const m=12*i,p=m+50*h.len*u*i;
        s.moveTo(Math.cos(h.a)*m,Math.sin(h.a)*m).lineTo(Math.cos(h.a)*p,Math.sin(h.a)*p).stroke( {
          color:16773296,width:3,alpha:1-c
        })
      }
      return c>=1
    }
  }
}
function vr(a,e,t,n) {
  const s=[ {
    s:a.groundSprite(yr(.82)),delay:0,color:16756832
  }, {
    s:a.groundSprite(yr(.9)),delay:80,color:16773312
  }
  ];
  for(const u of s)u.s.tint=u.color,u.s.alpha=0,u.s.x=e,u.s.y=t;
  const o=new et;
  a.fxLayer.addChild(o);
  const r=Array.from( {
    length:12
  },(u,h)=>( {
    a:h/12*Math.PI*2+Math.random()*.4,d:.75+Math.random()*.3,size:.8+Math.random()*.6
  })),i=Array.from( {
    length:12
  },()=>( {
    a:Math.random()*Math.PI*2,d:.4+Math.random()*.6,up:40+Math.random()*50,size:2+Math.random()*2
  })),l=300,d=520;
  let c=0;
  return {
    view:new ue,update(u) {
      c+=u;
      for(const g of s) {
        const y=Math.min(1,Math.max(0,(c-g.delay)/l)),f=1-(1-y)**3;
        g.s.size=2*n*(.15+.85*f),g.s.alpha=y<=0?0:.95*(1-y*y)
      }
      o.clear();
      const h=a.pixelScale(e,t),m=Math.min(1,c/d),p=1-(1-m)**2;
      for(const g of r) {
        const y=n*g.d*p,f=a.screenPos(e+Math.cos(g.a)*y,t+Math.sin(g.a)*y,6);
        o.circle(f.x,f.y,(8+14*m)*g.size*h).fill( {
          color:12096362,alpha:.6*(1-m)
        })
      }
      for(const g of i) {
        const y=n*g.d*p,f=a.screenPos(e+Math.cos(g.a)*y,t+Math.sin(g.a)*y,g.up*4*m*(1-m));
        o.rect(f.x-g.size*h,f.y-g.size*h,g.size*2*h,g.size*2*h).fill( {
          color:7031346,alpha:1-m*m
        })
      }
      if(c<d)return!1;
      for(const g of s)g.s.dispose();
      return o.destroy(),!0
    }
  }
}
function ex(a,e,t,n,s,o,r,i,l) {
  const d=[];
  for(let c=0;c<10;c++) {
    const u=c/10*Math.PI*2,h=Math.cos(u)*s,m=Math.sin(u)*o;
    d.push(e+h*Math.cos(n)-m*Math.sin(n),t+h*Math.sin(n)+m*Math.cos(n))
  }
  a.poly(d).stroke( {
    color:r,width:i,alpha:l
  })
}
function QV(a,e,t,n) {
  const s=new et;
  a.fxLayer.addChild(s);
  const o=new et;
  o.blendMode="add",a.fxLayer.addChild(o);
  const r=110;
  let i=0;
  return {
    view:new ue,update(l) {
      i+=l,s.clear(),o.clear();
      const d=a.screenPos(e.x,e.y,40),c=a.screenPos(t.x,t.y,28),u=a.pixelScale(e.x,e.y),h=Math.min(1,i/r),m=d.x+(c.x-d.x)*h,p=d.y+(c.y-d.y)*h,g=Math.hypot(m-d.x,p-d.y),y=Math.atan2(p-d.y,m-d.x),f=i<n*.7?1:Math.max(0,1-(i-n*.7)/(n*.3)),v=9*u,b=Math.max(1,Math.floor(g/v));
      o.moveTo(d.x,d.y).lineTo(m,p).stroke( {
        color:16734762,width:9*u,alpha:.28*f,cap:"round"
      });
      for(let _=0;_<b;_++) {
        const S=(_+.5)/b,M=d.x+(m-d.x)*S,k=d.y+(p-d.y)*S;
        _%2?ex(s,M,k,y,5.5*u,1.4*u,16765562,1.6*u,f):ex(s,M,k,y,5.5*u,3.2*u,16742970,2*u,f)
      }
      return i<n?!1:(s.destroy(),o.destroy(),!0)
    }
  }
}
function ZV(a,e,t) {
  const n=new et;
  n.blendMode="add",a.fxLayer.addChild(n);
  const s=Array.from( {
    length:22
  },()=>( {
    a:Math.random()*Math.PI*2,sp:140+Math.random()*160,up:60+Math.random()*80,rot:Math.random()*6.28,vr:(Math.random()-.5)*16,size:4+Math.random()*5
  })),o=650;
  let r=0;
  return {
    view:new ue,update(i) {
      r+=i,n.clear();
      const l=Math.min(1,r/o),d=r/1e3,c=a.pixelScale(e,t);
      for(const u of s) {
        const h=u.sp*d,m=40+u.up*d*2-260*d*d,p=a.screenPos(e+Math.cos(u.a)*h,t+Math.sin(u.a)*h,Math.max(0,m)),g=u.rot+u.vr*d,y=u.size*c;
        n.poly([p.x+Math.cos(g)*y,p.y+Math.sin(g)*y,p.x+Math.cos(g+2.3)*y*.7,p.y+Math.sin(g+2.3)*y*.7,p.x+Math.cos(g+4)*y*.5,p.y+Math.sin(g+4)*y*.5]).fill( {
          color:l<.4?16773312:16762976,alpha:1-l
        })
      }
      return r<o?!1:(n.destroy(),!0)
    }
  }
}
function wN(a,e,t) {
  const n=a.groundSprite(yr(.8));
  n.tint=16765562;
  const s=a.groundSprite(ol());
  s.tint=16773312;
  let o=0;
  return {
    view:new ue,update(r) {
      o+=r;
      const i=Math.min(1,o/t);
      return n.x=s.x=e.x,n.y=s.y=e.y,n.size=150*(1-i*.7),n.alpha=.3+.6*i,s.size=30+50*i,s.alpha=.5*i,i<1?!1:(n.dispose(),s.dispose(),!0)
    }
  }
}
function gA(a,e,t,n,s,o=!1,r=90) {
  var k;
  const i=e.x,l=e.y,d=a.player.sprite.sheets.cart;
  let c=null;
  const u=[],h=new et;
  h.blendMode="add";
  const m=new et;
  if(a.fxLayer.addChildAt(m,0),a.fxLayer.addChild(h),d) {
    const C=d.action("walk").dirs[tl(t.x-i,t.y-l)%8],A=((k=C==null?void 0:C[0])==null?void 0:k[0])??-1;
    if(A>=0) {
      for(const w of[.18,.34]) {
        const T=new Ra(d.textures[A]);
        T.alpha=w,T.tint=o?16765802:15266559,a.fxLayer.addChild(T),u.push(T)
      }
      c=new Ra(d.textures[A]),a.fxLayer.addChild(c)
    }
  }
  const p=a.screenPos(i,l,30),g=a.screenPos(t.x,t.y,30),y=Math.atan2(g.y-p.y,g.x-p.x),f=Array.from( {
    length:7
  },()=>( {
    a:y+Math.PI+(Math.random()-.5)*1.8,d:.6+Math.random()*.6
  })),v=260,b=(Math.random()<.5?-1:1)*.5,_=[];
  let S=0,M=!1;
  return {
    view:new ue,update(C) {
      S+=C;
      const A=Math.min(1,S/n),w=i+(t.x-i)*A,T=l+(t.y-l)*A,z=r*Math.sin(Math.PI*A)*(1-.25*A),L=a.pixelScale(w,T),U=a.screenPos(w,T,0);
      m.clear().ellipse(U.x,U.y,18*L*(1-z/220),7*L*(1-z/220)).fill( {
        color:0,alpha:.3
      });
      const q=a.screenPos(w,T,z),N=Math.sin(A*Math.PI)*b;
      if(_.unshift( {
        x:q.x,y:q.y,rot:N
      }),_.length>10&&_.pop(),h.clear(),S<v) {
        const H=S/v,V=a.pixelScale(i,l),te=a.screenPos(i,l,30);
        for(let ge=0;ge<3;ge++) {
          const Be=(22+ge*14+60*H)*V;
          h.arc(te.x,te.y,Be,y-.55+ge*.08,y+.55-ge*.08).stroke( {
            color:o?16769946:15923455,width:(5-ge)*V*(1-H),alpha:.85*(1-H)
          })
        }
        const pe=a.screenPos(i,l,0);
        for(const ge of f) {
          const Be=(10+40*H)*ge.d*V;
          h.circle(pe.x+Math.cos(ge.a)*Be,pe.y+Math.sin(ge.a)*Be*.5,(6+8*H)*V).fill( {
            color:14271648,alpha:.35*(1-H)
          })
        }
      }
      if(_.length>1) {
        for(let Ye=1;Ye<_.length;Ye++) {
          const ae=Ye/_.length;
          h.moveTo(_[Ye-1].x,_[Ye-1].y-8*L).lineTo(_[Ye].x,_[Ye].y-8*L).stroke( {
            color:o?16765802:16777215,width:9*L*(1-ae),alpha:(o?.8:.5)*(1-ae),cap:"round"
          })
        }
        const H=_[Math.min(4,_.length-1)],V=q.x-H.x,te=q.y-H.y,pe=Math.hypot(V,te)||1,ge=-te/pe,Be=V/pe;
        for(const Ye of[-14,-5,6,15]) {
          const ae=q.x+ge*Ye*L-V/pe*10*L,me=q.y-8*L+Be*Ye*L-te/pe*10*L,Re=(26+Math.abs(Ye))*L;
          h.moveTo(ae,me).lineTo(ae-V/pe*Re,me-te/pe*Re).stroke( {
            color:o?16769946:15398143,width:2*L,alpha:.7,cap:"round"
          })
        }
      }
      if(c&&(c.position.set(q.x,q.y),c.scale.set(L),c.rotation=N,u.forEach((H,V)=> {
        const te=_[Math.min(_.length-1,(2-V)*3)];H.position.set(te.x,te.y),H.scale.set(L),H.rotation=te.rot
      })),A<1)return!1;
      M||(M=!0,s()),c==null||c.destroy();
      for(const H of u)H.destroy();
      return h.destroy(),m.destroy(),!0
    }
  }
}
function yA(a,e,t,n,s,o,r,i) {
  for(const {
    e:l,ux:d,uy:c
  }
  of n) {
    let u=s.get(l);
    if(u||s.set(l,u=[]),i&&!l.dead&&r<.75&&u.push( {
      x:l.x,y:l.y,t:o,s:.7+Math.random()*.6
    }),r<.7&&!l.dead) {
      const h=1-r/.7,m=a.pixelScale(l.x,l.y);
      for(const p of[-12,0,12]) {
        const g=l.x-c*p,y=l.y+d*p,f=a.screenPos(g-d*16,y-c*16,22),v=a.screenPos(g-d*(50+Math.abs(p)),y-c*(50+Math.abs(p)),22);
        e.moveTo(f.x,f.y).lineTo(v.x,v.y).stroke( {
          color:15398143,width:2.5*m,alpha:.85*h,cap:"round"
        })
      }
    }
    vA(a,t,u,o,380)
  }
}
function vA(a,e,t,n,s) {
  for(const o of t) {
    const r=Math.min(1,(n-o.t)/s);
    if(r>=1)continue;
    const i=a.screenPos(o.x,o.y,4),l=a.pixelScale(o.x,o.y);
    e.circle(i.x,i.y,(6+10*r)*o.s*l).fill( {
      color:12887162,alpha:.5*(1-r)
    })
  }
}
function MN(a,e,t,n) {
  const s=e.x,o=e.y;
  a.addFx(vr(a,s,o,t));
  const r=new et;
  r.blendMode="add";
  const i=new et;
  a.fxLayer.addChild(i),a.fxLayer.addChild(r);
  const l=Array.from( {
    length:18
  },(p,g)=>( {
    a:g/18*Math.PI*2+Math.random()*.2,len:.25+Math.random()*.2
  })),d=n.map(p=> {
    const g=Math.hypot(p.x-s,p.y-o)||1;return {
      e:p,ux:(p.x-s)/g,uy:(p.y-o)/g
    }
  }),c=new Map,u=650;
  let h=0,m=0;
  return {
    view:new ue,update(p) {
      h+=p;
      const g=Math.min(1,h/u);
      r.clear(),i.clear();
      const y=a.pixelScale(s,o),f=Math.min(1,h/300);
      if(f<1) {
        const b=1-(1-f)**2;
        for(const S of l) {
          const M=t*(.25+.95*b),k=M-t*S.len,C=a.screenPos(s+Math.cos(S.a)*k,o+Math.sin(S.a)*k,14),A=a.screenPos(s+Math.cos(S.a)*M,o+Math.sin(S.a)*M,14);
          r.moveTo(C.x,C.y).lineTo(A.x,A.y).stroke( {
            color:16186111,width:3*y*(1-f),alpha:.9*(1-f),cap:"round"
          })
        }
        const _=a.screenPos(s,o,0);
        r.ellipse(_.x,_.y,t*b*y,t*b*y*.5).stroke( {
          color:16777215,width:6*y*(1-f),alpha:.7*(1-f)
        })
      }
      const v=h-m>45;
      return v&&(m=h),yA(a,r,i,d,c,h,g,v),g<1?!1:(r.destroy(),i.destroy(),!0)
    }
  }
}
function SN(a,e,t,n,s=!1) {
  const o=a.player,r=new et;
  r.blendMode="add";
  const i=new et;
  a.fxLayer.addChild(i),a.fxLayer.addChild(r);
  const l=[],d=new Map,c=[],u=[],h=500,m=28,p=340;
  let g=0,y=0,f=-m,v=!1;
  const b=()=> {
    const _=new ue;
    for(const S of o.sprite.children) {
      if(!S.visible||!(S instanceof Ra))continue;
      const M=Fv(new Ra(S.texture));
      M.anchor.copyFrom(S.anchor),M.position.copyFrom(S.position),_.addChild(M)
    }
    _.scale.copyFrom(o.sprite.scale),_.position.set(o.x,o.y),_.zIndex=o.y-1,a.entityLayer.addChild(_),u.push( {
      view:_,t:g
    })
  };
  return {
    view:new ue,update(_) {
      g+=_;
      const S=Math.min(1,g/t);
      if(!v) {
        for(const k of n(S))l.push( {
          ...k,at:g
        });
        g-f>=m&&(f=g,b()),S>=1&&(v=!0)
      }
      for(const k of u) {
        const C=Math.min(1,(g-k.t)/p);
        k.view.alpha=.75*(1-C)*(1-C);
        for(const A of k.view.children)A.tint=s?C<.35?16760960:16734762:C<.35?16773296:16758858
      }
      for(const k of u.filter(C=>g-C.t>=p))k.view.destroy( {
        children:!0
      });
      u.splice(0,u.length,...u.filter(k=>g-k.t<p)),r.clear(),i.clear();
      const M=g-y>35;
      M&&(y=g),S<1&&M&&c.push( {
        x:o.x+e.x*30,y:o.y+e.y*30,t:g,s:.9+Math.random()*.6
      }),vA(a,i,c,g,420);
      for(const k of l)yA(a,r,i,[k],d,g,Math.min(1,(g-k.at)/h),M);
      return!v||g<t+h||u.length?!1:(r.destroy(),i.destroy(),!0)
    }
  }
}
function AN(a,e,t,n,s,o,r) {
  const i=new ue,l=el(new et().ellipse(0,0,18,7).fill( {
    color:0,alpha:.35
  }),"shadow",0,.4),d=new Fn(xt.sheet("npc_vending"),"idle");
  d.loop=!0,i.addChild(l,d),i.position.set(e,t),i.zIndex=t,a.entityLayer.addChild(i);
  const c=a.groundSprite(yr(.94));
  c.tint=r?16747224:16765802,c.x=e,c.y=t,c.size=n*2;
  const u=r?Fv(new Fn(xt.sheet("npc_vending"),"idle")):null;
  u&&(u.tint=16751328,u.scale.set(1.12,1.05),i.addChild(u)),c.alpha=0;
  const h=260,m=1e3,p= {
    x:e,y:t,r:n,onHit:r==null?void 0:r.onHit
  };
  let g=0,y=!1;
  return {
    view:new ue,update(f) {
      g+=f,d.update(f);
      const v=Math.min(1,g/h);
      if(d.y=-220*(1-v*v),u&&(u.texture=d.texture,u.anchor.copyFrom(d.anchor),u.position.copyFrom(d.position),u.alpha=y?.35+.25*Math.sin(g/120):0),l.scale.set(.4+.6*v),!y&&v>=1&&(y=!0,a.lure=p,a.addFx(vr(a,e,t,70)),a.shake(.12,3)),y) {
        c.alpha=.35+.15*Math.sin(g/140);
        const b=s-g;
        if(b<m) {
          const _=1-b/m;
          d.x=Math.sin(g/18)*3*_,d.tint=Math.sin(g/(90-60*_))>0?16752784:16777215
        }
      }
      return g<s?!1:(a.lure===p&&(a.lure=null),o(),c.dispose(),i.destroy( {
        children:!0
      }),!0)
    }
  }
}
function _A(a,e,t,n,s=10) {
  const o=a.groundSprite(ol());
  o.tint=16765802,o.x=e,o.y=t,o.alpha=0;
  const r=a.groundSprite(yr(.86));
  r.tint=16773296,r.x=e,r.y=t,r.alpha=0;
  const i=new ue;
  a.fxLayer.addChild(i);
  const l=Array.from( {
    length:s
  },(u,h)=> {
    const m=new Fn(xt.sheet("fx_coin"),"a0");m.loop=!0,m.time=Math.random()*600,i.addChild(m);const p=h/s*Math.PI*2+Math.random()*.4;return {
      s:m,a:p,d:n*(.5+Math.random()*.6),up:50+Math.random()*50
    }
  }),d=620;
  let c=0;
  return {
    view:new ue,update(u) {
      c+=u;
      const h=Math.min(1,c/d),m=1-(1-h)**2;
      o.size=n*2.4*(.4+.6*m),o.alpha=.9*(1-h),r.size=n*2*(.2+.8*m),r.alpha=.95*(1-h*h);
      for(const p of l) {
        p.s.update(u);
        const g=e+Math.cos(p.a)*p.d*m,y=t+Math.sin(p.a)*p.d*m,f=a.screenPos(g,y,p.up*4*h*(1-h)+10),v=a.pixelScale(g,y);
        p.s.position.set(f.x,f.y),p.s.scale.set(2.2*v),p.s.alpha=h<.8?1:(1-h)/.2
      }
      return h<1?!1:(o.dispose(),r.dispose(),i.destroy( {
        children:!0
      }),!0)
    }
  }
}
function eW(a,e) {
  const t=a.player,n=new Fn(xt.sheet("fx_coin"),"a0");
  n.loop=!0;
  const s=new et;
  s.blendMode="add",a.fxLayer.addChild(s,n);
  const o=[],r=520,i=e.x,l=e.y;
  let d=0;
  return {
    view:new ue,update(c) {
      d+=c;
      const u=Math.min(1,d/r),h=u*u,m=i+(t.x-i)*h,p=l+(t.y-l)*h,g=a.screenPos(m,p,40+60*Math.sin(Math.PI*u)),y=a.pixelScale(m,p);
      n.update(c),n.position.set(g.x,g.y),n.scale.set(2.2*y),o.unshift( {
        x:g.x,y:g.y
      }),o.length>9&&o.pop(),s.clear();
      for(let f=1;f<o.length;f++) {
        const v=f/o.length;
        s.moveTo(o[f-1].x,o[f-1].y).lineTo(o[f].x,o[f].y).stroke( {
          color:16765802,width:6*y*(1-v),alpha:.8*(1-v),cap:"round"
        })
      }
      return u<1?!1:(s.destroy(),n.destroy(),!0)
    }
  }
}
function bA(a,e,t,n) {
  const s=new et;
  a.fxLayer.addChildAt(s,0);
  const o=e.flatMap(i=>Array.from( {
    length:2
  },()=>( {
    x:i.x+(Math.random()-.5)*30,y:i.y+(Math.random()-.5)*22,s:.8+Math.random()*.6,ph:Math.random()*6
  })));
  let r=0;
  return {
    view:new ue,update(i) {
      r+=i,n();
      const l=Math.min(1,r/200)*Math.min(1,(t-r)/500);
      s.clear();
      for(const d of o) {
        const c=a.screenPos(d.x,d.y,6+3*Math.sin(r/300+d.ph)),u=a.pixelScale(d.x,d.y);
        s.circle(c.x,c.y,(14+3*Math.sin(r/250+d.ph))*d.s*u).fill( {
          color:11043418,alpha:.5*l
        })
      }
      return r<t?!1:(s.destroy(),!0)
    }
  }
}
const tx=[16743096,7260415,16767050,9367690];
function kN(a,e,t,n,s) {
  const o=tx[Math.floor(Math.random()*tx.length)],r=new et,i=new et,l=new et;
  a.fxLayer.addChildAt(r,0),a.fxLayer.addChild(i,l);
  const d=Array.from( {
    length:14
  },()=>( {
    a:Math.random()*Math.PI*2,d:30+Math.random()*40,up:30+Math.random()*40,c:Math.random()<.5?o:16777215
  })),c=[ {
    end:.42,peak:70
  }, {
    end:.76,peak:34
  }, {
    end:1,peak:14
  }
  ],u=64,h=720,m=380,p=(Math.random()<.5?-1:1)/60;
  let g=0,y=0,f=!1;
  return {
    view:new ue,update(v) {
      y+=v;
      const b=Math.min(1,y/h);
      if(i.clear(),l.clear(),r.clear(),b<1) {
        let _=0;
        for(;b>c[_].end;)_++;
        _>g&&(g=_,s==null||s());
        const S=_?c[_-1].end:0,M=(b-S)/(c[_].end-S),C=(_?0:u)*(1-M)+c[_].peak*4*M*(1-M),A=e.x+(t.x-e.x)*b,w=e.y+(t.y-e.y)*b,T=a.pixelScale(A,w),z=a.screenPos(A,w,0);
        r.ellipse(z.x,z.y,9*T*(1-C/200),4*T*(1-C/200)).fill( {
          color:0,alpha:.25
        });
        const L=a.screenPos(A,w,C+10),U=C<6?.8:1,q=10*T,N=y*p;
        i.ellipse(L.x,L.y,(q+1.5*T)/U,(q+1.5*T)*U).fill(3878751),i.ellipse(L.x,L.y,q/U,q*U).fill(16777215),i.moveTo(L.x,L.y).arc(L.x,L.y,q,N,N+Math.PI).closePath().fill(o),i.moveTo(L.x+Math.cos(N)*q,L.y+Math.sin(N)*q).lineTo(L.x-Math.cos(N)*q,L.y-Math.sin(N)*q).stroke( {
          color:3878751,width:1.5*T
        }),i.circle(L.x-q*.35,L.y-q*.4,q*.25).fill( {
          color:16777215,alpha:.9
        })
      }
      else {
        f||(f=!0,n());
        const _=Math.min(1,(y-h)/m),S=a.pixelScale(t.x,t.y),M=a.screenPos(t.x,t.y,10+20*_),k=10*S,C=14*S*_;
        i.moveTo(M.x,M.y-C).arc(M.x,M.y-C,k,Math.PI,Math.PI*2).closePath().fill( {
          color:o,alpha:1-_
        }),i.moveTo(M.x,M.y+C).arc(M.x,M.y+C,k,0,Math.PI).closePath().fill( {
          color:16777215,alpha:1-_
        });
        for(const A of d) {
          const w=t.x+Math.cos(A.a)*A.d*_,T=t.y+Math.sin(A.a)*A.d*_*.6,z=a.screenPos(w,T,10+A.up*4*_*(1-_)),L=a.pixelScale(w,T);
          l.rect(z.x-2*L,z.y-2*L,4*L,4*L).fill( {
            color:A.c,alpha:1-_
          })
        }
        if(_>=1)return r.destroy(),i.destroy(),l.destroy(),!0
      }
      return!1
    }
  }
}
function xA(a,e,t,n=()=>!0) {
  const s=a.player,o=new ue;
  a.entityLayer.addChild(o);
  let r=0;
  return {
    view:new ue,update(i) {
      if(r+=i,o.removeChildren().forEach(l=>l.destroy()),r<t&&!s.dead&&n()) {
        for(const c of s.sprite.children) {
          if(!c.visible||!(c instanceof Ra))continue;
          const u=Fv(new Ra(c.texture));
          u.anchor.copyFrom(c.anchor),u.position.copyFrom(c.position),u.tint=e,o.addChild(u)
        }
        const l=.5+.5*Math.sin(r/110),d=Math.min(1,r/150)*Math.min(1,(t-r)/300);
        return o.scale.set(s.sprite.scale.x*(1.08+.04*l),s.sprite.scale.y*(1.05+.03*l)),o.position.set(s.x,s.y+2),o.zIndex=s.y-1,o.alpha=(.35+.3*l)*d,!1
      }
      return o.destroy( {
        children:!0
      }),!0
    }
  }
}
const No= {
  rate:110,rateGold:160,maxLive:240,gravity:2400,bounce:.42,maxBounces:3,rest:260,scale:1.15,scaleGold:1.35
};
function EN(a,e,t,n,s,o=!1) {
  const r=a.groundSprite(ol());
  r.tint=o?16760896:16765802,r.x=e,r.y=t,r.size=n*2.3,r.alpha=0;
  const i=a.groundSprite(yr(.93));
  i.tint=o?16769162:16773296,i.x=e,i.y=t,i.size=n*2,i.alpha=0;
  const l=new et,d=new ue,c=new et;
  c.blendMode="add",a.fxLayer.addChild(l,d,c);
  const u=[],h=[],m=xd(),p=(o?No.rateGold:No.rate)*m,g=Math.max(12,Math.round(No.maxLive*m)),y=m<.5,f=s+900;
  let v=0,b=0;
  const _=()=> {
    const S=Math.random()*Math.PI*2,M=Math.sqrt(Math.random())*n,k=new Fn(xt.sheet("fx_coin"),"a0");
    k.loop=!0,k.time=Math.random()*600,o&&(k.tint=16773808),d.addChild(k),u.push( {
      s:k,x:e+Math.cos(S)*M,y:t+Math.sin(S)*M,h:260+Math.random()*120,v:520+Math.random()*260,vx:0,vy:0,bounces:0,landed:-1,spin:1.4+Math.random()*1.2
    })
  };
  return {
    view:new ue,update(S) {
      v+=S;
      const M=S/1e3,k=Math.min(1,v/200),C=Math.min(1,Math.max(0,(f-v)/500)),A=.5+.5*Math.sin(v/130);
      if(r.alpha=(o?.55:.4)*k*C*(.75+.25*A),i.alpha=.7*k*C*(.6+.4*A),v<s)for(b+=p*M;b>=1;)b--,u.length<g&&_();
      y||l.clear(),c.clear();
      for(const w of u) {
        if(w.landed<0&&(w.v+=No.gravity*M,w.h-=w.v*M,w.x+=w.vx*M,w.y+=w.vy*M,w.h<=0)) {
          if(w.h=0,w.bounces===0) {
            const L=Math.random()*Math.PI*2,U=40+Math.random()*70;
            w.vx=Math.cos(L)*U,w.vy=Math.sin(L)*U*.6,h.push( {
              x:w.x,y:w.y,t:v,dx:(Math.random()-.5)*16,up:14+Math.random()*14,big:!0
            })
          }
          w.bounces++,w.v=-w.v*No.bounce,w.vx*=.6,w.vy*=.6,(w.bounces>=No.maxBounces||Math.abs(w.v)<90)&&(w.v=0,w.landed=v)
        }
        w.s.update(w.landed<0?S*w.spin*(w.bounces?.6:1):0);
        const T=a.screenPos(w.x,w.y,w.h+4),z=a.pixelScale(w.x,w.y);
        if(w.s.position.set(T.x,T.y),w.s.scale.set((o?No.scaleGold:No.scale)*z),w.s.alpha=w.landed<0?1:Math.max(0,1-(v-w.landed)/No.rest),!y&&w.landed<0&&w.bounces===0) {
          const L=a.screenPos(w.x,w.y,w.h+4+Math.min(46,w.v*.05));
          l.moveTo(L.x,L.y).lineTo(T.x,T.y).stroke( {
            color:o?16765802:16773296,width:1.6*z,alpha:o?.6:.45,cap:"round"
          })
        }
      }
      for(const w of h) {
        const T=(v-w.t)/320;
        if(T>=1)continue;
        const z=a.screenPos(w.x+w.dx*T,w.y,6+w.up*T),L=a.pixelScale(w.x,w.y),U=(3+4*(1-T))*L,q=.85*(1-T);
        if(c.moveTo(z.x-U,z.y).lineTo(z.x+U,z.y).stroke( {
          color:16774856,width:1.6*L,alpha:q
        }),c.moveTo(z.x,z.y-U).lineTo(z.x,z.y+U).stroke( {
          color:16774856,width:1.6*L,alpha:q
        }),w.big&&!y) {
          const N=a.screenPos(w.x,w.y,0);
          for(let H=0;H<4;H++) {
            const V=H/4*Math.PI*2+w.t,te=(4+10*T)*L;
            c.circle(N.x+Math.cos(V)*te,N.y+Math.sin(V)*te*.5,1.2*L).fill( {
              color:16769162,alpha:q
            })
          }
        }
      }
      for(let w=u.length-1;w>=0;w--)u[w].landed>=0&&v-u[w].landed>No.rest&&(u[w].s.destroy(),u.splice(w,1));
      for(let w=h.length-1;w>=0;w--)v-h[w].t>320&&h.splice(w,1);
      return v<f||u.length?!1:(r.dispose(),i.dispose(),d.destroy( {
        children:!0
      }),l.destroy(),c.destroy(),!0)
    }
  }
}
function CN(a,e,t,n,s=!1) {
  const o=a.groundSprite(yr(.8));
  o.tint=s?16756784:16765802,o.x=e,o.y=t,o.alpha=0;
  const r=a.groundSprite(ol());
  r.tint=16773824,r.x=e,r.y=t,r.alpha=0;
  const i=360;
  let l=0;
  return {
    view:new ue,update(d) {
      l+=d;
      const c=Math.min(1,l/i),u=1-(1-c)**3;
      return o.size=n*2*(.25+.8*u),o.alpha=.95*(1-c*c),r.size=n*2.4,r.alpha=(s?.7:.5)*(1-c),c<1?!1:(o.dispose(),r.dispose(),!0)
    }
  }
}
let ax=1;
function hu(a,e,t,n,s,o,r=16758858) {
  const i=new et;
  a.fxLayer.addChild(i);
  const l=140,d=420,c=20,u=16,h=ax=-ax,m=n-o*h,p=2*o*h,g=S=>Math.max(0,Math.min(1,(S-m)/p))*l,y=(S,M,k=u)=>a.screenPos(e+Math.cos(S)*M,t+Math.sin(S)*M,k),f=Array.from( {
    length:7
  },(S,M)=> {
    const k=n+((M+.5)/7*2-1)*o*.85+(Math.random()-.5)*.1;return {
      a:k,d0:.2+Math.random()*.2,len:.3+Math.random()*.3,delay:g(k)
    }
  }),v=Array.from( {
    length:18
  },()=> {
    const S=n+(Math.random()*2-1)*o;return {
      a:S,d:s*(.8+Math.random()*.2),v:.15+Math.random()*.35,up:10+Math.random()*30,delay:g(S),gold:Math.random()<.55
    }
  }),b=(S,M,k,C,A,w)=> {
    if(M-S<.01||w<=0)return;
    const T=[],z=[];
    for(let L=0;L<=c;L++) {
      const U=L/c,q=m+p*(S+(M-S)*U),N=y(q,k);
      T.push(N.x,N.y);
      const H=C*Math.sin(Math.PI*U)**.7,V=y(q,k-H);
      z.unshift(V.x,V.y)
    }
    i.poly([...T,...z]).fill( {
      color:A,alpha:w
    })
  };
  let _=0;
  return {
    view:new ue,update(S) {
      _+=S,i.clear();
      const M=a.pixelScale(e,t),k=Math.min(1,_/l),C=Math.max(0,Math.min(k,(_-l*.45)/(l*1.6))),A=_<=l?1:Math.max(0,1-(_-l)/(d-l-80)),w=s*(1+.1*(1-A)),T=Math.min(1,_/60)*A;
      if(T>0) {
        const U=a.screenPos(e,t,2),q=[];
        for(let N=0;N<=c;N++) {
          const H=y(n-o+2*o*N/c,s,2);
          q.push(H.x,H.y)
        }
        i.poly([U.x,U.y,...q]).fill( {
          color:r,alpha:.14*T
        }),i.poly(q,!1).stroke( {
          color:r,width:2.5*M,alpha:.5*T,cap:"round"
        })
      }
      for(const U of f) {
        const q=(_-U.delay)/170;
        if(q<=0||q>=1)continue;
        const N=y(U.a,s*(U.d0+.7*q)),H=y(U.a,s*(U.d0+U.len+.55*q));
        i.moveTo(N.x,N.y).lineTo(H.x,H.y).stroke( {
          color:16777215,width:2.2*M,alpha:.85*(1-q),cap:"round"
        })
      }
      const z=Math.min(1,Math.max(0,(_-30)/l)),L=Math.max(0,Math.min(z,(_-30-l*.45)/(l*1.6)));
      if(b(L,z,w*.74,s*.14,r,.35*A),b(L,z,w*.74,s*.05,16777215,.6*A),b(C,k,w,s*.36,r,.16*A),b(C,k,w,s*.25,r,.32*A),b(C,k,w,s*.15,16767370,.75*A),b(C,k,w,s*.07,16777215,A),k-C>.01&&A>0) {
        const U=[];
        for(let q=0;q<=c;q++) {
          const N=y(m+p*(C+(k-C)*q/c),w+1.5);
          U.push(N.x,N.y)
        }
        i.poly(U,!1).stroke( {
          color:16777215,width:(1.5+2.5*A)*M,alpha:A,cap:"round"
        })
      }
      for(const U of v) {
        const q=(_-U.delay)/260;
        if(q<=0||q>=1)continue;
        const N=U.d+U.v*(_-U.delay),H=y(U.a,N,u+U.up*4*q*(1-q));
        i.circle(H.x,H.y,(1+2.4*(1-q))*M).fill( {
          color:U.gold?16765562:16777215,alpha:1-q*q
        })
      }
      return _<d?!1:(i.destroy(),!0)
    }
  }
}
const d0=[14268282,12884570,15258528,10976325,8214064,9398846],Mh=[];
function TN() {
  if(Mh.length)return Mh;
  for(let a=0;a<3;a++) {
    const e=document.createElement("canvas");
    e.width=e.height=96;
    const t=e.getContext("2d");
    for(let n=0;n<46;n++) {
      const s=Math.random()*Math.PI*2,o=Math.random()**1.4*30,r=48+Math.cos(s)*o,i=48+Math.sin(s)*o*.8,l=6+Math.random()*12,d=t.createRadialGradient(r,i,0,r,i,l);
      d.addColorStop(0,"rgba(255,255,255,0.3)"),d.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=d,t.fillRect(r-l,i-l,l*2,l*2)
    }
    for(let n=0;n<40;n++) {
      const s=Math.random()*Math.PI*2,o=Math.random()*40;
      t.fillStyle=`rgba(255,255,255,${.3+Math.random()*.4})`,t.fillRect(48+Math.cos(s)*o,48+Math.sin(s)*o*.8,1.5,1.5)
    }
    Mh.push(qt.from(e))
  }
  return Mh
}
function PN(a,e,t,n,s,o) {
  const r=TN(),i=new ue,l=new et;
  a.fxLayer.addChild(i,l);
  const d=xd(),c=d<.5,u=Math.max(6,Math.round(16*d)),h=Array.from( {
    length:Math.max(30,Math.round(200*d))
  },()=>( {
    a:n+(Math.random()+Math.random()-1)*o,d:s*(.25+Math.random()*.85),up:6+Math.random()*22,delay:Math.random()*110,ms:200+Math.random()*140,size:.7+Math.random()*1.1,color:d0[Math.floor(Math.random()*d0.length)]
  })),m=Array.from( {
    length:u
  },(f,v)=> {
    const b=new Ra(r[v%r.length]);return b.anchor.set(.5),b.tint=d0[Math.floor(Math.random()*3)],b.alpha=0,i.addChild(b), {
      s:b,a:n+(Math.random()*2-1)*o*.85,d:s*(.25+v/u*.75),delay:30+v/u*170,size:.8+Math.random()*.6,drift:(Math.random()-.5)*.4,rot:Math.random()*Math.PI*2
    }
  }),p=950;
  let g=0;
  const y=(f,v)=> {
    const b=1-(1-Math.min(1,v))**2,_=Math.max(0,24+f.up*4*v*(1-v)-24*v);
    return a.screenPos(e+Math.cos(f.a)*f.d*b,t+Math.sin(f.a)*f.d*b,_)
  };
  return {
    view:new ue,update(f) {
      g+=f,l.clear();
      const v=a.pixelScale(e,t);
      for(const b of m) {
        const _=Math.min(1,Math.max(0,(g-b.delay)/(p-b.delay)));
        if(b.s.visible=_>0,_<=0)continue;
        const S=1-(1-Math.min(1,_*3))**2,M=b.d*S+10*_,k=b.a+b.drift*_,C=a.screenPos(e+Math.cos(k)*M,t+Math.sin(k)*M,14+14*_);
        b.s.position.set(C.x,C.y),b.s.scale.set(b.size*(.45+.9*S+.3*_)*v),b.s.rotation=b.rot+_*.6,b.s.alpha=Math.min(1,_*8)*(1-_)**1.3
      }
      for(const b of h) {
        const _=(g-b.delay)/b.ms;
        if(_<=0||_>1.4)continue;
        const S=y(b,_),M=_<1?1:1-(_-1)/.4;
        if(_<1&&!c) {
          const k=y(b,Math.max(0,_-.09));
          l.moveTo(k.x,k.y).lineTo(S.x,S.y).stroke( {
            color:b.color,width:b.size*v,alpha:.4*M,cap:"round"
          })
        }
        l.rect(S.x-b.size*v*.6,S.y-b.size*v*.6,b.size*v*1.2,b.size*v*1.2).fill( {
          color:b.color,alpha:.95*M
        })
      }
      return g<p?!1:(i.destroy( {
        children:!0
      }),l.destroy(),!0)
    }
  }
}
function wA(a,e,t,n,s,o,r=120) {
  const i=e.x,l=e.y,d=new et;
  a.fxLayer.addChildAt(d,0);
  const c=new Ra(o);
  c.anchor.set(.5),a.fxLayer.addChild(c);
  const u=new et;
  a.fxLayer.addChild(u);
  const h=(Math.random()<.5?-1:1)*14,m=[];
  let p=0,g=!1;
  return {
    view:new ue,update(y) {
      p+=y;
      const f=Math.min(1,p/n),v=i+(t.x-i)*f,b=l+(t.y-l)*f,_=30+r*Math.sin(Math.PI*f)-30*f,S=a.pixelScale(v,b),M=a.screenPos(v,b,0);
      d.clear().ellipse(M.x,M.y,10*S,4*S).fill( {
        color:0,alpha:.28
      });
      const k=a.screenPos(v,b,_);
      return c.position.set(k.x,k.y),c.scale.set(1.7*S),c.rotation=h*p/1e3,m.unshift( {
        x:k.x,y:k.y
      }),m.length>9&&m.pop(),u.clear(),m.forEach((C,A)=>u.circle(C.x,C.y,(6-A*.5)*S).fill( {
        color:A%2?10216298:12745696,alpha:.35*(1-A/m.length)
      })),f<1?!1:(g||(g=!0,s()),d.destroy(),c.destroy(),u.destroy(),!0)
    }
  }
}
const Sh=[];
function RN() {
  if(Sh.length)return Sh;
  for(let a=0;a<4;a++) {
    const e=document.createElement("canvas");
    e.width=e.height=128;
    const t=e.getContext("2d");
    t.fillStyle="rgb(225,225,225)";
    const n=(o,r,i)=> {
      t.beginPath(),t.arc(o,r,i,0,Math.PI*2),t.fill()
    };
    n(64,64,22);
    for(let o=0;o<7;o++) {
      const r=Math.random()*Math.PI*2;
      n(64+Math.cos(r)*14,64+Math.sin(r)*14,8+Math.random()*8)
    }
    const s=10+Math.floor(Math.random()*6);
    for(let o=0;o<s;o++) {
      const r=o/s*Math.PI*2+(Math.random()-.5)*.4,i=30+Math.random()*30,l=3+Math.random()*4,d=Math.cos(r),c=Math.sin(r);
      t.beginPath(),t.moveTo(64-c*l,64+d*l),t.lineTo(64+d*i,64+c*i),t.lineTo(64+c*l,64-d*l),t.closePath(),t.fill(),n(64+d*i,64+c*i,1.5+Math.random()*2);
      for(let u=0;u<2;u++) {
        const h=i+4+Math.random()*10;
        n(64+d*h+(Math.random()-.5)*4,64+c*h+(Math.random()-.5)*4,.8+Math.random()*1.6)
      }
    }
    Sh.push(qt.from(e))
  }
  return Sh
}
const sr= {
  light:14071039,body:10117078,dark:5909900,drops:34,puddleMs:1500
};
function zN(a,e,t,n) {
  const s=RN(),o=a.groundSprite(s[Math.floor(Math.random()*s.length)],!1);
  o.tint=sr.body,o.x=e,o.y=t,o.rotation=Math.random()*Math.PI*2,o.alpha=0;
  const r=new et;
  a.fxLayer.addChild(r);
  const i=Array.from( {
    length:sr.drops
  },()=>( {
    a:Math.random()*Math.PI*2,d:n*(.3+Math.random()*.75),up:6+Math.random()*22,ms:170+Math.random()*170,size:1.2+Math.random()*2.3,spot:null,landed:-1
  })),l=Array.from( {
    length:11
  },(m,p)=>( {
    a:p/11*Math.PI*2+Math.random()*.4,len:n*(.3+Math.random()*.3),w:3+Math.random()*3
  })),d=200,c=450+sr.puddleMs;
  let u=0;
  const h=(m,p,g,y,f,v,b)=> {
    const _=m-g,S=p-y,M=Math.hypot(_,S)||1,k=-S/M*f,C=_/M*f;
    r.moveTo(g,y).lineTo(m+k,p+C).lineTo(m-k,p-C).closePath().fill( {
      color:v,alpha:b
    }),r.circle(m,p,f).fill( {
      color:v,alpha:b
    })
  };
  return {
    view:new ue,update(m) {
      var v;
      u+=m,r.clear();
      const p=a.pixelScale(e,t),g=Math.min(1,Math.max(0,(c-u)/sr.puddleMs)),y=Math.min(1,u/90);
      o.size=n*(.4+.75*(1-(1-y)**3)),o.alpha=.85*g;
      const f=u/d;
      if(f<1) {
        const b=Math.sin(Math.PI*Math.min(1,f*1.3)),_=a.screenPos(e,t,4);
        for(const S of l) {
          const M=S.len*(.3+.7*b),k=10*b,C=a.screenPos(e+Math.cos(S.a)*M,t+Math.sin(S.a)*M,k);
          h(_.x,_.y,C.x,C.y,S.w*p*(1-f*.5),sr.body,.95),h(_.x,_.y,C.x,C.y,S.w*.4*p,sr.light,.7*(1-f))
        }
      }
      for(const b of i) {
        const _=u/b.ms;
        if(_<1) {
          const S=C=> {
            const A=1-(1-C)**2;
            return a.screenPos(e+Math.cos(b.a)*b.d*A,t+Math.sin(b.a)*b.d*A,b.up*4*C*(1-C))
          },M=S(_),k=S(Math.max(0,_-.22));
          h(M.x,M.y,k.x,k.y,b.size*p,sr.body,.95);
          continue
        }
        b.spot||(b.spot=a.groundSprite(s[Math.floor(Math.random()*s.length)],!1),b.spot.tint=Math.random()<.3?sr.dark:sr.body,b.spot.x=e+Math.cos(b.a)*b.d,b.spot.y=t+Math.sin(b.a)*b.d,b.spot.rotation=Math.random()*Math.PI*2,b.landed=u),b.spot.size=b.size*(4+4*Math.min(1,(u-b.landed)/80)),b.spot.alpha=.8*g
      }
      if(u<c)return!1;
      o.dispose();
      for(const b of i)(v=b.spot)==null||v.dispose();
      return r.destroy(),!0
    }
  }
}
function MA(a,e,t) {
  const n=new et;
  a.fxLayer.addChild(n);
  const s=()=>Array.from( {
    length:9
  },()=>( {
    a:Math.random()*Math.PI*2,d:6+Math.random()*22,size:.7+Math.random()*.6
  })),o=[ {
    at:e,puffs:s()
  }, {
    at:t,puffs:s()
  }
  ],r=520;
  let i=0;
  return {
    view:new ue,update(l) {
      i+=l;
      const d=Math.min(1,i/r),c=1-(1-d)**2;
      n.clear();
      const u=a.screenPos(e.x,e.y,30),h=a.screenPos(t.x,t.y,30),m=a.pixelScale(t.x,t.y);
      n.moveTo(u.x,u.y).lineTo(h.x,h.y).stroke( {
        color:3810128,width:14*m*(1-d),alpha:.45*(1-d),cap:"round"
      }),n.moveTo(u.x,u.y).lineTo(h.x,h.y).stroke( {
        color:11832575,width:3*m*(1-d),alpha:.8*(1-d),cap:"round"
      });
      for(const p of o)for(const g of p.puffs) {
        const y=a.screenPos(p.at.x+Math.cos(g.a)*g.d*(1+c),p.at.y+Math.sin(g.a)*g.d*(1+c),20+30*c),f=(12+14*c)*g.size*m;
        n.circle(y.x,y.y,f).fill( {
          color:2759226,alpha:.5*(1-d)
        }),n.circle(y.x-f*.3,y.y-f*.3,f*.45).fill( {
          color:9071288,alpha:.35*(1-d)
        })
      }
      return d<1?!1:(n.destroy(),!0)
    }
  }
}
const LN=Math.atan2(7,-12);
function DN(a,e,t,n,s=12) {
  const o=new et;
  o.blendMode="add";
  const r=new ue;
  a.fxLayer.addChild(o,r);
  const i=xt.sheet("fx_kunai"),l=Math.random()*Math.PI*2,d=Array.from( {
    length:s
  },(m,p)=> {
    const g=new Fn(i,"a0");return r.addChild(g), {
      a:l+p/s*Math.PI*2,s:g,delay:p%3*18
    }
  }),c=170,u=270;
  let h=0;
  return {
    view:new ue,update(m) {
      h+=m,o.clear();
      const p=a.pixelScale(e,t),g=h<c?1:Math.max(0,1-(h-c)/(u-c));
      for(const y of d) {
        const f=k=> {
          const C=1-(1-Math.max(0,k))**2,A=26+(n-26)*C;
          return a.screenPos(e+Math.cos(y.a)*A,t+Math.sin(y.a)*A,30)
        },v=Math.min(1,Math.max(0,(h-y.delay)/c)),b=f(0),_=f(1),S=Math.atan2(_.y-b.y,_.x-b.x)-LN,M=f(v);
        if(y.s.position.set(M.x,M.y),y.s.rotation=S,y.s.scale.set(1.5*p),y.s.visible=v>0,y.s.alpha=g,v>0&&v<1) {
          const k=f(Math.max(0,v-.35*(1-v*.6)));
          o.moveTo(k.x,k.y).lineTo(M.x,M.y).stroke( {
            color:14674175,width:2.4*p,alpha:.55*g,cap:"round"
          }),o.moveTo(k.x,k.y).lineTo(M.x,M.y).stroke( {
            color:16777215,width:1*p,alpha:.9*g,cap:"round"
          })
        }
      }
      return h<u?!1:(r.destroy( {
        children:!0
      }),o.destroy(),!0)
    }
  }
}
const Ah=[];
function FN() {
  if(Ah.length)return Ah;
  const a=64,e=56,t=a/2,n=36;
  for(let s=0;s<4;s++) {
    const o=document.createElement("canvas");
    o.width=a,o.height=e;
    const r=o.getContext("2d"),i=s/4*(Math.PI*2/3)+.3,l=[0,1,2].map(m=> {
      const p=i+m/3*Math.PI*2;return {
        tx:t+Math.cos(p)*19,ty:n+Math.sin(p)*8.5+3,a:p
      }
    }),d= {
      tx:t+Math.cos(i+Math.PI)*4,ty:n-21
    },c=m=> {
      const p=m.tx-t,g=m.ty-n,y=Math.hypot(p,g)||1,f=-g/y*5.2,v=p/y*5.2,b=f*-.6+v*-.8>0;
      r.beginPath(),r.moveTo(t+f,n+v),r.lineTo(m.tx,m.ty),r.lineTo(t,n),r.closePath(),r.fillStyle=b?"#e6eaef":"#7d838d",r.fill(),r.beginPath(),r.moveTo(t-f,n-v),r.lineTo(m.tx,m.ty),r.lineTo(t,n),r.closePath(),r.fillStyle=b?"#7d838d":"#b4bac3",r.fill(),r.beginPath(),r.moveTo(t+f,n+v),r.lineTo(m.tx,m.ty),r.lineTo(t-f,n-v),r.strokeStyle="#2b2e34",r.lineWidth=1.6,r.lineJoin="round",r.stroke()
    },u=l.filter(m=>m.ty<n).sort((m,p)=>m.ty-p.ty),h=l.filter(m=>m.ty>=n).sort((m,p)=>m.ty-p.ty);
    for(const m of u)c(m);
    c(d);
    for(const m of h)c(m);
    r.fillStyle="rgba(255,255,255,0.9)",r.beginPath(),r.arc(t-1.5,n-2,1.8,0,Math.PI*2),r.fill(),r.beginPath(),r.arc(d.tx+.5,d.ty+5,1.2,0,Math.PI*2),r.fill(),Ah.push(qt.from(o))
  }
  return Ah
}
function IN(a,e,t,n) {
  const s=FN(),o=new et;
  o.blendMode="add";
  const r=new et;
  a.fxLayer.addChild(r,o);
  const i=300,l=Array.from( {
    length:2+Math.floor(Math.random()*2)
  },()=> {
    const u=new ue,h=el(new et().ellipse(0,0,9,3.5).fill( {
      color:0,alpha:.35
    }),"shadow",0,.35),m=new Ra(s[0]);m.anchor.set(.5,36/56),u.addChild(h,m);const p= {
      view:u,shadow:h,s:m,x:e+(Math.random()-.5)*40,y:t+(Math.random()-.5)*26,pose:Math.floor(Math.random()*s.length),size:.5+Math.random()*.1,delay:Math.random()*160,landed:-1
    };return u.position.set(p.x,p.y),u.zIndex=p.y,u.visible=!1,a.entityLayer.addChild(u),p
  });
  let d= {
    b:-1,t:0
  },c=0;
  return {
    view:new ue,update(u) {
      c+=u,o.clear(),r.clear();
      const h=Math.max(0,Math.min(1,(n-c)/400));
      if(l.forEach((m,p)=> {
        const g=Math.min(1,Math.max(0,(c-m.delay)/i));if(m.view.visible=g>0,m.view.alpha=h,g<1) {
          const v=46*(1-g)**2+(g>.7?8*Math.sin((g-.7)/.3*Math.PI):0);m.s.y=-v,m.s.texture=s[(m.pose+Math.floor(c/45))%s.length],m.s.scale.set(m.size),m.shadow.scale.set(.6+.4*g);return
        }
        m.landed<0&&(m.landed=c,m.s.y=0,m.s.texture=s[m.pose],m.shadow.scale.set(1));const y=a.pixelScale(m.x,m.y),f=(c-m.landed)/340;if(f<1)for(let v=0;v<3;v++) {
          const b=v/3*Math.PI*2+p,_=a.screenPos(m.x+Math.cos(b)*9*f,m.y+Math.sin(b)*5*f,3+6*f);r.circle(_.x,_.y,(3+5*f)*y).fill( {
            color:13351316,alpha:.4*(1-f)
          })
        }
        if(d.b===p) {
          const v=(c-d.t)/280;if(v<1) {
            const b=a.screenPos(m.x,m.y,12*m.size*2),_=(2+6*Math.sin(Math.PI*v))*y,S=.95*Math.sin(Math.PI*v)*h;o.moveTo(b.x-_,b.y).lineTo(b.x+_,b.y).stroke( {
              color:16777215,width:1.3*y,alpha:S
            }),o.moveTo(b.x,b.y-_).lineTo(b.x,b.y+_).stroke( {
              color:16777215,width:1.3*y,alpha:S
            }),o.circle(b.x,b.y,1.6*y).fill( {
              color:16777215,alpha:S
            })
          }
        }
      }),c>i+200&&c-d.t>700&&Math.random()<.03&&(d= {
        b:Math.floor(Math.random()*l.length),t:c
      }),c<n)return!1;
      for(const m of l)m.view.destroy( {
        children:!0
      });
      return o.destroy(),r.destroy(),!0
    }
  }
}
function mu(a,e,t,n,s,o,r=.4) {
  const i=new et;
  a.fxLayer.addChildAt(i,0);
  const l=Math.max(8,Math.round(n/9)),d=Array.from( {
    length:l
  },()=>( {
    a:Math.random()*Math.PI*2,d:Math.sqrt(Math.random())*n*.8,spin:(Math.random()-.5)*6e-4,size:.7+Math.random()*.6,phase:Math.random()*Math.PI*2,color:o[Math.floor(Math.random()*o.length)]
  })),c=260;
  let u=0;
  return {
    view:new ue,update(h) {
      u+=h,i.clear();
      const m=a.pixelScale(e,t),p=Math.min(1,u/c),g=Math.min(1,(s-u)/400);
      for(const y of d) {
        const f=y.a+y.spin*u,v=a.screenPos(e+Math.cos(f)*y.d*(.4+.6*p),t+Math.sin(f)*y.d*(.4+.6*p),12+6*Math.sin(u/500+y.phase)),b=(16+6*Math.sin(u/420+y.phase))*y.size*m*(.5+.5*p);
        i.circle(v.x,v.y,b).fill( {
          color:y.color,alpha:r*g
        })
      }
      return u<s?!1:(i.destroy(),!0)
    }
  }
}
const Km=!!globalThis.__roHeadless,BN=320,NN=320;
class Bv {
  constructor(e,t,n,s=1,o=0) {
    x(this,"view",new ue);
    x(this,"upright",!0);
    x(this,"lift");
    x(this,"data");
    x(this,"sprites");
    x(this,"t",0);
    x(this,"end");
    x(this,"loopMs",0);
    x(this,"hold",null);
    x(this,"inner",new ue);
    x(this,"onlyLayers",null);
    x(this,"built",!1);
    x(this,"total",0);
    this.data=e,this.loopMs=o,this.view.position.set(t,n),this.inner.scale.set(s),this.view.addChild(this.inner),this.sprites=e.layers.map(()=>null),this.build(),this.end=Math.max(...e.layers.map(r=> {
      var i;return((i=r.keys[r.keys.length-1])==null?void 0:i.f)??0
    })),this.update(0)
  }
  build() {
    this.built||!this.data.ready||Km||(this.built=!0,this.sprites=this.data.layers.map((e,t)=> {
      if(!e.tex.length||!e.keys.length||this.onlyLayers&&!this.onlyLayers.includes(t))return null;const n=new Ra(e.tex[0]);return n.anchor.set(.5),n.visible=!1,this.inner.addChild(n),n
    }))
  }
  only(e) {
    return this.onlyLayers=e,this.sprites=this.sprites.map((t,n)=>!t||e.includes(n)?t:(t.destroy(),null)),this
  }
  holdAt(e,t) {
    this.hold= {
      at:e,left:t
    }
  }
  update(e) {
    this.t+=e,this.total+=e;
    let t=this.t/1e3*this.data.fps;
    if(this.hold&&t>=this.hold.at&&this.hold.left>0&&(this.hold.left-=e,t=this.hold.at,this.t=t/this.data.fps*1e3),this.loopMs>0&&t>this.end&&(this.t=0,t=0),this.build(),!Km&&this.built&&this.data.layers.forEach((n,s)=> {
      const o=this.sprites[s];o&&this.pose(o,n.keys,t,n.tex)
    }),this.loopMs>0) {
      const n=this.loopMs-this.total;
      return this.view.alpha=Math.max(0,Math.min(1,n/500)),n<=0
    }
    return t>this.end
  }
  pose(e,t,n,s) {
    let o=null,r=null;
    for(const f of t) {
      if(f.f>n)break;
      f.t===0?(o=f,r=null):o&&f.f===o.f&&(r=f)
    }
    if(!o||!r&&n-o.f>=1) {
      e.visible=!1;
      return
    }
    const i=r?n-o.f:0,l=f=>o.xy[f]+(r?r.xy[f]*i:0),d=l(0),c=l(1),u=l(4),h=l(7),m=o.pos[0]+(r?r.pos[0]*i:0),p=o.pos[1]+(r?r.pos[1]*i:0),g=(o.c[3]+(r?r.c[3]*i:0))/255,y=f=>Math.max(0,Math.min(255,Math.round(o.c[f]+(r?r.c[f]*i:0))));
    if(e.visible=g>.01,e.position.set(m-BN+(d+c)/2,p-NN+(u+h)/2),e.scale.set((c-d)/e.texture.width,(h-u)/e.texture.height),e.rotation=(o.a+(r?r.a*i:0))*Math.PI/180,e.alpha=Math.min(1,g),e.tint=y(0)<<16|y(1)<<8|y(2),e.blendMode=o.add?"add":"normal",s.length>1) {
      let f=o.af??0;
      const v=(r==null?void 0:r.ani)??0,b=(r==null?void 0:r.d)??0;
      r&&v===1?f=(o.af??0)+(r.af??0)*i:v===2?f=Math.min((o.af??0)+b*i,s.length-1):v===3?f=((o.af??0)+b*i)%s.length:v===4&&(f=(((o.af??0)-b*i)%s.length+s.length)%s.length);
      const _=s[Math.max(0,Math.min(s.length-1,Math.floor(f)))];
      if(e.texture!==_) {
        const S=e.scale.x*e.texture.width,M=e.scale.y*e.texture.height;
        e.texture=_,e.scale.set(S/_.width,M/_.height)
      }
    }
  }
}
function UN(a,e,t,n,s) {
  const o=xt.str(a);
  if(!o)return null;
  const r=new Bv(o,e,t);
  return r.holdAt(n,s),r
}
function qN(a,e,t,n=1,s=0) {
  const o=xt.str(a);
  return o?new Bv(o,e,t,n,s):null
}
function SA() {
  const a=Tt.fxQuality==="high"?1:Tt.fxQuality==="mid"?.5:.25;
  return zs?a*.5:a
}
const Nv=32;
let kh=null;
function zd() {
  if(kh)return kh;
  const a=document.createElement("canvas");
  a.width=a.height=128;
  const e=a.getContext("2d"),t=e.createRadialGradient(64,64,0,64,64,64);
  return t.addColorStop(0,"rgba(255,255,255,0.9)"),t.addColorStop(.35,"rgba(255,255,255,0.4)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,128,128),kh=qt.from(a),kh
}
let Eh=null;
function HN() {
  if(Eh)return Eh;
  const a=document.createElement("canvas");
  a.width=a.height=64;
  const e=a.getContext("2d"),t=e.createRadialGradient(32,32,0,32,32,32);
  return t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.25,"rgba(255,255,255,0.75)"),t.addColorStop(.6,"rgba(255,255,255,0.22)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,64,64),Eh=oi(new pp(a)),Eh
}
const ON=`
  attribute float size;
  attribute vec4 pcolor;
  uniform float scale;
  varying vec4 vC;
  void main() {
    vC = pcolor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * scale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`,jN=`
  uniform sampler2D map;
  varying vec4 vC;
  void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    gl_FragColor = vec4(vC.rgb * t.rgb, vC.a * t.a);
  }`;
class Ot {
  constructor(e,t,n=!0,s) {
    x(this,"view",new ue);
    x(this,"list",[]);
    x(this,"spare",[]);
    x(this,"lights",[]);
    x(this,"points");
    x(this,"mat");
    x(this,"stopped",!1);
    this.g=e,this.cap=t;
    const o=new Jt;
    o.setAttribute("position",new Ce(new Float32Array(t*3),3)),o.setAttribute("pcolor",new Ce(new Float32Array(t*4),4)),o.setAttribute("size",new Ce(new Float32Array(t),1)),o.setDrawRange(0,0),this.mat=new Ze( {
      vertexShader:ON,fragmentShader:jN,uniforms: {
        map: {
          value:s??HN()
        },scale: {
          value:1
        }
      },transparent:!0,depthWrite:!1,blending:n?Rt:Vo
    }),this.points=new Qi(o,this.mat),this.points.frustumCulled=!1,this.points.renderOrder=7,e.world3d.scene.add(this.points)
  }
  emit(e) {
    if(this.list.length+this.lights.length>=this.cap||!hN(this.g))return;
    const t=this.spare.pop()??{};
    t.vx=t.vy=t.vz=t.age=t.grav=t.drag=t.twinkle=0,t.life=300,t.s0=t.s1=6,t.c0=t.c1=GN,t.a0=1,Object.assign(t,e),this.list.push(t)
  }
  light() {
    if(this.list.length+this.lights.length>=this.cap)return null;
    const e=this.lights,t= {
      x:0,y:0,z:0,size:0,r:1,g:1,b:1,a:0,off() {
        const n=e.indexOf(t);
        n>=0&&e.splice(n,1)
      }
    };
    return e.push(t),t
  }
  stop() {
    this.stopped=!0
  }
  update(e) {
    const t=e/1e3,n=this.g.world3d;
    this.mat.uniforms.scale.value=n.renderer.domElement.height/(2*Math.tan(n.perspective.fov*Math.PI/360));
    const s=this.points.geometry,o=s.getAttribute("position"),r=s.getAttribute("pcolor"),i=s.getAttribute("size"),l=o.array,d=r.array,c=i.array,u=this.list;
    let h=0;
    const m=u.length;
    for(let p=0;p<u.length;p++) {
      const g=u[p];
      if((g.age+=e)>=g.life) {
        this.spare.push(g);
        continue
      }
      const y=Math.max(0,1-g.drag*t);
      g.vx*=y,g.vz*=y,g.vy=g.vy*y+g.grav*t,g.x+=g.vx*t,g.y+=g.vy*t,g.z+=g.vz*t;
      const f=g.age/g.life,v=g.twinkle>0?.35+.65*Math.abs(Math.sin(g.age*g.twinkle)):1;
      l[h*3]=g.x,l[h*3+1]=g.y,l[h*3+2]=g.z,d[h*4]=g.c0[0]+(g.c1[0]-g.c0[0])*f,d[h*4+1]=g.c0[1]+(g.c1[1]-g.c0[1])*f,d[h*4+2]=g.c0[2]+(g.c1[2]-g.c0[2])*f,d[h*4+3]=g.a0*(1-f)*v,c[h]=g.s0+(g.s1-g.s0)*f,u[h++]=g
    }
    u.length=h,mN(this.g,m-h);
    for(const p of this.lights)l[h*3]=p.x,l[h*3+1]=p.y,l[h*3+2]=p.z,d[h*4]=p.r,d[h*4+1]=p.g,d[h*4+2]=p.b,d[h*4+3]=p.a,c[h++]=p.size;
    if(s.setDrawRange(0,h),h)for(const[p,g]of[[o,3],[r,4],[i,1]])p.clearUpdateRanges(),p.addUpdateRange(0,h*g),p.needsUpdate=!0;
    return!this.stopped||h?!1:(this.g.world3d.scene.remove(this.points),s.dispose(),this.mat.dispose(),!0)
  }
}
const GN=[1,1,1],nx=new WeakMap;
function pu(a) {
  let e=nx.get(a);
  return e||(e=new Ot(a,6e3),nx.set(a,e),a.addFx(e)),e
}
const Ue=(a,e)=>a+Math.random()*(e-a);
function VN(a,e,t) {
  const n=pu(a).light()?? {
    x:0,y:0,z:0,size:0,r:0,g:0,b:0,a:0,off(){}
  };
  return n.r=(e>>16&255)/255,n.g=(e>>8&255)/255,n.b=(e&255)/255,n.size=t,n
}
const sx=new Map;
function ky(a,e) {
  let t=sx.get(a);
  return t||(t=e(),t.userData.shared=!0,sx.set(a,oi(t))),t
}
const WN=new F,Ec=new WeakMap,$N=40;
class Rr {
  constructor(e,t,n) {
    x(this,"group",new on);
    x(this,"trail");
    x(this,"t",0);
    x(this,"last",null);
    x(this,"dir",new F(1,0,0));
    x(this,"light",null);
    x(this,"parts",[]);
    x(this,"lights",[]);
    x(this,"world");
    if(this.g=e,this.lightSize=n,this.world=e.world3d,Ec.set(this.world,(Ec.get(this.world)??0)+1),this.trail=pu(e),!zs) {
      const s=this.light=e.groundSprite(zd(),!0);
      s.tint=t,s.size=n,s.alpha=0
    }
    this.group.renderOrder=8,e.world3d.scene.add(this.group)
  }
  add(...e) {
    return this.parts.push(...e),this
  }
  glow(e,t) {
    const n=VN(this.g,e,t);
    return this.lights.push(n),n
  }
  place(e,t,n,s) {
    const o=this.group.position,r=this.dir;
    e.x=o.x+t*r.x-s*r.z,e.y=o.y+n,e.z=o.z+t*r.z+s*r.x
  }
  update(e,t,n,s,o) {
    var c;
    this.t+=s;
    const r=this.g.world3d.heightAt(e,t)+Nv;
    this.group.position.set(e,r,t),this.group.rotation.set(0,-n,0),this.dir.set(Math.cos(n),0,Math.sin(n));
    const i=this.light;
    i&&(i.x=e,i.y=t,i.size=this.lightSize*(.92+.08*Math.sin(this.t*31)),i.alpha=.3*o);
    const l=this.group.position.clone(),d=this.last??l;
    for(const u of this.parts)u.animate(s,o);
    if(o>=.2)for(const u of this.parts)(c=u.emit)==null||c.call(u,d,l,s,o);
    this.last=l
  }
  along(e,t,n,s,o) {
    const r=Math.floor(n*SA()*s+Math.random());
    for(let i=0;i<r;i++)o(WN.copy(e).lerp(t,Math.random()))
  }
  dispose() {
    var e,t;
    Ec.set(this.world,Math.max(0,(Ec.get(this.world)??1)-1));
    for(const n of this.parts)(e=n.dispose)==null||e.call(n);
    for(const n of this.lights)n.off();
    (t=this.light)==null||t.dispose(),this.g.world3d.scene.remove(this.group),this.group.traverse(n=> {
      n instanceof Ie&&(n.geometry.userData.shared||n.geometry.dispose(),n.material.dispose())
    })
  }
}
function zr(a,e,t,n,s,o=!1,r=0) {
  const i=a.glow(t,s),l=a.glow(e,n);
  return {
    animate(d,c) {
      const u=o?Math.random()<.15?.55:.9+.1*Math.random():.85+.15*Math.sin(a.t*47)*Math.sin(a.t*23);
      a.place(l,r,0,0),a.place(i,r,0,0),l.a=.95*c*u,i.a=.55*c*u,i.size=s*(o?.85+.3*Math.random():.94+.12*u)
    }
  }
}
const AA=`
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vP = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`,YN=`
  uniform float time;
  uniform float alpha;
  uniform vec3 c0;
  uniform vec3 c1;
  uniform vec3 c2;
  uniform vec3 c3;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vView;
  ${Ks}
  // de lo más frío (c0) a lo más caliente (c3): fuego, plasma...
  vec3 ramp(float t) {
    vec3 c = mix(c0, c1, smoothstep(0.0, 0.4, t));
    c = mix(c, c2, smoothstep(0.35, 0.72, t));
    return mix(c, c3, smoothstep(0.78, 1.0, t));
  }
  void main() {
    // a lo largo: 1 delante, -1 en la cola; las llamas corren hacia atrás
    float along = clamp(vP.x / 8.0, -1.0, 1.0);
    float n = fbm(vec2(vP.x * 0.22 + time * 9.0, atan(vP.y, vP.z) * 1.6 + vP.x * 0.05));
    float n2 = fbm(vec2(vP.x * 0.45 + time * 14.0, vP.y * 0.3 - vP.z * 0.3));
    // centro más caliente que el borde (visto de frente)
    float core = pow(abs(dot(normalize(vN), normalize(vView))), 1.4);
    float heat = (0.35 + 0.65 * (along * 0.5 + 0.5)) * (0.45 + 0.75 * n) * (0.5 + 0.7 * core) + n2 * 0.15;
    vec3 col = ramp(clamp(heat, 0.0, 1.0));
    // la cola se deshilacha
    float a = smoothstep(0.12, 0.5, heat) * smoothstep(-1.05, -0.35, along + (n - 0.5) * 0.8);
    gl_FragColor = vec4(col, a * alpha);
  }`,ox=[[.32,.03,0],[1,.28,.02],[1,.7,.16],[1,.96,.78]],XN=[[.16,.02,.32],[.62,.1,.95],[1,.42,.85],[1,.93,1]];
function c0(a,e,t=1,n=1) {
  const s=new Ze( {
    vertexShader:AA,fragmentShader:YN,uniforms: {
      time: {
        value:Math.random()*10
      },alpha: {
        value:0
      },...Object.fromEntries(e.map((r,i)=>[`c${i}`, {
        value:new F(...r)
      }
      ]))
    },transparent:!0,depthWrite:!1,blending:Rt
  }),o=new Ie(ky("flame",()=>new vp(8,16,10)),s);
  return o.scale.set(2.6*t,1.25*t,1.25*t),o.position.x=-8*t,o.frustumCulled=!1,o.renderOrder=9,a.group.add(o), {
    animate(r,i) {
      s.uniforms.time.value+=r,s.uniforms.alpha.value=i*n
    }
  }
}
const kA=AA,EA=`
  uniform float time;
  uniform float alpha;
  uniform float len;
  uniform vec3 deep;
  uniform vec3 pale;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vN);
    // caras planas con una luz fija de arriba (la escena no tiene luces): unas claras y otras más hondas
    float lit = 0.55 + 0.45 * abs(dot(n, normalize(vec3(0.3, 0.9, 0.35))));
    float fres = pow(1.0 - abs(dot(n, normalize(vView))), 2.2);
    vec3 col = mix(deep, pale, lit * lit);
    // reflejo que recorre el cristal de la punta a la cola
    float band = fract(vP.x / len * 0.5 - time * 1.6);
    float glint = 1.0 - smoothstep(0.0, 0.08, abs(band - 0.5));
    col += vec3(1.0) * (fres * 0.8 + glint * 0.55);
    gl_FragColor = vec4(col, alpha * (0.78 + 0.22 * fres + 0.3 * glint));
  }`;
function Ey(a,e,t) {
  const n=[];
  for(let l=0;l<6;l++) {
    const d=l/6*Math.PI*2,c=t*(l%2?.82:1);
    n.push(new F(0,Math.cos(d)*c,Math.sin(d)*c))
  }
  const s=new F(a,0,0),o=new F(-e,0,0),r=[];
  for(let l=0;l<6;l++) {
    const d=n[l],c=n[(l+1)%6];
    r.push(...s.toArray(),...c.toArray(),...d.toArray()),r.push(...o.toArray(),...d.toArray(),...c.toArray())
  }
  const i=new Jt;
  return i.setAttribute("position",new Ce(r,3)),i.computeVertexNormals(),i
}
const KN=[.1,.38,.85],JN=[.82,.96,1];
function u0(a,e=1,t=KN,n=JN,s=2,o=8) {
  const r=[],i=u=> {
    const h=new Ze( {
      vertexShader:kA,fragmentShader:EA,uniforms: {
        time: {
          value:Math.random()*10
        },alpha: {
          value:0
        },len: {
          value:u
        },deep: {
          value:new F(...t)
        },pale: {
          value:new F(...n)
        }
      },transparent:!0,depthWrite:!1,side:rt
    });
    return r.push(h),h
  },l=new on,d=new Ie(ky(`shard${e}`,()=>Ey(26*e,12*e,8*e)),i(38*e));
  d.frustumCulled=!1,d.renderOrder=o,l.add(d);
  const c=[];
  for(let u=0;u<s;u++) {
    const h=new Ie(ky(`bit${e}`,()=>Ey(10*e,5*e,3.2*e)),i(15*e));
    h.frustumCulled=!1,h.renderOrder=o,c.push(h),a.group.add(h)
  }
  return a.group.add(l), {
    animate(u,h) {
      for(const m of r)m.uniforms.time.value+=u,m.uniforms.alpha.value=h;
      l.rotation.x+=u*9,c.forEach((m,p)=> {
        const g=a.t*11+p*Math.PI*2/c.length;m.position.set((-12-p*5)*e,Math.cos(g)*12*e,Math.sin(g)*12*e),m.rotation.x=g*1.5
      })
    }
  }
}
const QN=[7310591,12176127,16777215],ZN=[[6,0,.22],[3,1,.55],[1.3,2,1]],eU=[[4,1,.6],[1.5,2,1]];
function Ch(a,e,t=4,n=1,s=!0,o=1) {
  const r=new et;
  r.blendMode="add",a.g.fxLayer.addChild(r);
  const i=[];
  let l=0,d=0,c=null;
  return {
    animate(u,h) {
      const m=a.g,p=a.group.position;
      i.unshift( {
        x:p.x,y:p.z,h:p.y-m.world3d.heightAt(p.x,p.z)
      }),i.length>9&&i.pop();
      const g=m.screenPos(i[0].x,i[0].y,i[0].h);
      if(r.alpha=h,(d-=u)>0&&c) {
        r.position.set(g.x-c.x,g.y-c.y);
        return
      }
      if(d=zs?.09:.045,l=Math.random()*1e3,r.clear(),r.position.set(0,0),c=null,h<=.02)return;
      c=g;
      const y=m.pixelScale(p.x,p.z);
      let f=l;
      const v=()=>(f=(f*9301+49297)%233280)/233280,b=(_,S,M)=> {
        const k=[];
        for(let C=0;C<_.length-1;C++) {
          const A=_[C],w=_[C+1];
          for(let T=0;T<3;T++) {
            const z=T/3;
            k.push( {
              x:A.x+(w.x-A.x)*z+(T?(v()-.5)*S:0),y:A.y+(w.y-A.y)*z+(T?(v()-.5)*S:0)
            })
          }
        }
        k.push(_[_.length-1]),(zs?eU:ZN).forEach(([C,A,w])=> {
          const T=e[A];r.moveTo(k[0].x,k[0].y);for(const z of k.slice(1))r.lineTo(z.x,z.y);r.stroke( {
            width:C*y,color:T,alpha:w*M*o,cap:"round",join:"round"
          })
        })
      };
      for(let _=0;_<t;_++) {
        const S=v()*Math.PI*2,M=(12+v()*14)*n*y,k= {
          x:g.x+Math.cos(S+(v()-.5))*M*.5,y:g.y+Math.sin(S+(v()-.5))*M*.5
        };
        b([g,k, {
          x:g.x+Math.cos(S)*M,y:g.y+Math.sin(S)*M
        }
        ],7*y,.9)
      }
      s&&i.length>2&&b(i.map(_=>m.screenPos(_.x,_.y,_.h)),10*y,.7)
    },dispose() {
      r.destroy()
    }
  }
}
function tU(a) {
  const e=[[16738832,[1,.5,.12]],[3193087,[.35,.8,1]],[10124031,[.7,.6,1]]].map(([t,n])=> {
    const s=a.glow(t,22),o=a.glow(16777215,7);return {
      s,c:o,rgb:n
    }
  });
  return {
    animate(t,n) {
      e.forEach((s,o)=> {
        const r=a.t*13+o*Math.PI*2/3;a.place(s.s,-2,Math.cos(r)*16,Math.sin(r)*16),a.place(s.c,-2,Math.cos(r)*16,Math.sin(r)*16),s.s.a=n,s.c.a=n
      })
    },emit(t,n,s) {
      for(const o of e) {
        const r=o.s,i=Math.floor(70*SA()*s+Math.random());
        for(let l=0;l<i;l++) {
          const d=Math.random();
          a.trail.emit( {
            x:r.x-(n.x-t.x)*d,y:r.y,z:r.z-(n.z-t.z)*d,life:Ue(260,400),s0:8,s1:2,c0:o.rgb,c1:o.rgb,a0:.9,drag:2
          })
        }
      }
    }
  }
}
function Th(a,e=1,t=[1,.78,.35],n=[.75,.12,.02],s=[[1,.85,.5],[.9,.25,.05]]) {
  return {
    animate(){},emit(o,r,i) {
      const l=a.dir;
      a.along(o,r,150*e,i,d=>a.trail.emit( {
        x:d.x-l.x*10+Ue(-3,3),y:d.y+Ue(-3,3),z:d.z-l.z*10+Ue(-3,3),vx:-l.x*Ue(20,60)+Ue(-15,15),vy:Ue(10,35),vz:-l.z*Ue(20,60)+Ue(-15,15),life:Ue(170,280),s0:Ue(14,19),s1:Ue(5,9),c0:t,c1:n,a0:.75,drag:2
      })),a.along(o,r,45*e,i,d=>a.trail.emit( {
        x:d.x+Ue(-5,5),y:d.y+Ue(-4,4),z:d.z+Ue(-5,5),vx:Ue(-50,50),vy:Ue(20,70),vz:Ue(-50,50),life:Ue(380,700),s0:Ue(3,4.5),s1:1.5,c0:s[0],c1:s[1],a0:1,grav:60,drag:2.5
      }))
    }
  }
}
function Ph(a,e=1,t=[.7,.88,1],n=.32,s=!1) {
  return {
    animate(){},emit(o,r,i) {
      a.along(o,r,70*e,i,l=>a.trail.emit( {
        x:l.x+Ue(-3,3),y:l.y+Ue(-3,3),z:l.z+Ue(-3,3),vx:Ue(-10,10),vy:s?Ue(25,55):Ue(-6,6),vz:Ue(-10,10),life:Ue(380,560)*(s?1.4:1),s0:Ue(9,13),s1:Ue(22,30)*(s?1.4:1)*(zs?.65:1),c0:t,c1:[t[0]*.7,t[1]*.85,t[2]],a0:n,drag:3
      })),a.along(o,r,60*e,i,l=>a.trail.emit( {
        x:l.x+Ue(-7,7),y:l.y+Ue(-6,6),z:l.z+Ue(-7,7),vx:Ue(-15,15),vy:Ue(-5,10),vz:Ue(-15,15),life:Ue(380,700),s0:Ue(3,4.5),s1:1.2,c0:[1,1,1],c1:[.6,.85,1],a0:1,grav:-45,drag:2,twinkle:Ue(.02,.04)
      }))
    }
  }
}
function Rh(a,e=1,t=[1,1,.9],n=[.45,.6,1]) {
  return {
    animate(){},emit(s,o,r) {
      a.along(s,o,70*e,r,i=>a.trail.emit( {
        x:i.x,y:i.y,z:i.z,vx:Ue(-120,120),vy:Ue(-40,90),vz:Ue(-120,120),life:Ue(140,280),s0:Ue(3,4.5),s1:1,c0:t,c1:n,a0:1,grav:-260,drag:3
      }))
    }
  }
}
const rx= {
  fire:[16773832,16738842],water:[15268095,10477823],wind:[16777215,9087231],"fire+water":[16769216,16742954],"fire+wind":[16773375,11555071],"water+wind":[16777215,6342911],default:[16777215,14207231]
},CA=a=>["fire","water","wind"].filter(e=>a.includes(e)).join("+");
function aU(a,e) {
  const t=CA(e);
  if(zs&&(Ec.get(a.world3d)??0)>=$N) {
    const[n,s]=rx[t]??rx.default,o=new Rr(a,s,40);
    return o.add(zr(o,n,s,10,34))
  }
  switch(t) {
    case"fire": {
      const n=new Rr(a,16742954,54);
      return n.add(zr(n,16773832,16738842,24,54,!1,2),c0(n,ox),Th(n))
    }
    case"water": {
      const n=new Rr(a,9427199,46);
      return n.add(zr(n,15268095,10477823,10,56,!1,3),u0(n),Ph(n))
    }
    case"wind": {
      const n=new Rr(a,11847935,50);
      return n.add(zr(n,16777215,9087231,16,50,!0),Ch(n,QN),Rh(n))
    }
    case"fire+water": {
      const n=new Rr(a,16756858,56);
      return n.add(u0(n,.85,[.04,.26,.8],[.5,.82,1],2,10),c0(n,ox,1.2,.5),zr(n,16769216,16742954,8,64),Th(n,.6),Ph(n,.7,[.95,.95,1],.4,!0))
    }
    case"fire+wind": {
      const n=new Rr(a,13662975,58);
      return n.add(zr(n,16773375,11555071,22,62,!0,2),c0(n,XN),Ch(n,[16742954,16756960,16777215],5,1.15),Th(n,.7,[1,.6,.95],[.45,.08,.7],[[1,.8,1],[.7,.2,1]]),Rh(n,.6,[1,.9,.7],[1,.4,.2]))
    }
    case"water+wind": {
      const n=new Rr(a,8380671,52);
      return n.add(zr(n,16777215,6342911,8,48,!0,3),u0(n,1.15,[.05,.3,.75],[.75,1,1]),Ch(n,[4245759,11071743,16777215],3,.85,!1,.75),Ph(n,.7),Rh(n,.8,[.9,1,1],[.3,.8,1]))
    }
    default: {
      const n=new Rr(a,16773344,60);
      return n.add(zr(n,16777215,14207231,10,34,!0),tU(n),Ch(n,[11571455,15261951,16777215],2,.8,!0,.55),Th(n,.2),Ph(n,.25),Rh(n,.3))
    }
  }
}
class Uv {
  constructor(e,t,n,s=1) {
    x(this,"view",new ue);
    x(this,"gr",new et);
    x(this,"t",0);
    x(this,"bits");
    this.g=e,this.x=t,this.y=n,this.size=s,this.bits=Array.from( {
      length:Math.round(11*s)
    },()=> {
      const o=Math.random()*Math.PI*2,r=Ue(70,170)*Math.sqrt(s);return {
        vx:Math.cos(o)*r,vy:Math.sin(o)*r*.6-Ue(40,110),rot:Math.random()*6,vr:Ue(-14,14),len:Ue(5,10)*Math.sqrt(s),w:Ue(1.6,3)*Math.sqrt(s),pale:Math.random()<.5
      }
    }),this.gr.blendMode="add",e.fxLayer.addChild(this.gr)
  }
  update(e) {
    this.t+=e/1e3;
    const n=this.t/.5;
    if(this.gr.clear(),n>=1)return this.gr.destroy(),!0;
    const s=this.g.pixelScale(this.x,this.y),o=this.g.screenPos(this.x,this.y,Nv*.8);
    this.t<.12&&this.gr.circle(o.x,o.y,(10+90*this.t)*s*this.size).fill( {
      color:14677247,alpha:.75*(1-this.t/.12)
    });
    for(const r of this.bits) {
      const i=o.x+r.vx*this.t*s,l=o.y+(r.vy*this.t+260*this.t*this.t)*s,d=r.rot+r.vr*this.t,c=Math.cos(d)*r.len*s,u=Math.sin(d)*r.len*s,h=-u*(r.w/r.len),m=c*(r.w/r.len);
      this.gr.poly([i+c,l+u,i+h,l+m,i-c*.6,l-u*.6,i-h,l-m]).fill( {
        color:r.pale?15924223:9425663,alpha:.95*(1-n)
      })
    }
    return!1
  }
}
function nU(a,e,t,n) {
  const s=pu(a),o=a.world3d.heightAt(t,n)+Nv*.8,r=1/Math.sqrt(e.length),i=(d,c)=> {
    for(let u=0;u<Math.round(d*r);u++)s.emit(c(Math.random()*Math.PI*2,Math.random()*Math.PI-Math.PI/2))
  },l=e.includes("fire")&&e.includes("wind")&&e.length===2;
  if(e.includes("fire")) {
    const[d,c]=l?[[1,.7,1],[.5,.1,.8]]:[[1,.85,.45],[.7,.1,.02]];
    i(22,(u,h)=> {
      const m=Ue(60,160);return {
        x:t,y:o,z:n,vx:Math.cos(u)*Math.cos(h)*m,vy:Math.sin(h)*m*.7+30,vz:Math.sin(u)*Math.cos(h)*m,life:Ue(200,340),s0:Ue(16,22),s1:Ue(6,10),c0:d,c1:c,a0:.8,drag:4
      }
    }),i(16,u=>( {
      x:t,y:o,z:n,vx:Math.cos(u)*Ue(60,180),vy:Ue(60,160),vz:Math.sin(u)*Ue(60,180),life:Ue(450,800),s0:4,s1:1.5,c0:[1,.85,.5],c1:[.9,.25,.05],a0:1,grav:-120,drag:1.5
    }))
  }
  if(e.includes("water")) {
    a.addFx(new Uv(a,t,n));
    const d=e.includes("fire");
    s.emit( {
      x:t,y:o,z:n,life:160,s0:40,s1:64,c0:[.85,.95,1],c1:[.5,.75,1],a0:.9
    }),i(26,(c,u)=> {
      const h=Ue(90,220);return {
        x:t,y:o,z:n,vx:Math.cos(c)*Math.cos(u)*h,vy:Math.sin(u)*h*.6+50,vz:Math.sin(c)*Math.cos(u)*h,life:Ue(350,600),s0:Ue(5,8),s1:2,c0:[1,1,1],c1:[.55,.8,1],a0:1,grav:-380,drag:1.2,twinkle:Ue(.03,.05)
      }
    }),i(d?18:12,c=>( {
      x:t,y:o,z:n,vx:Math.cos(c)*Ue(30,70),vy:d?Ue(40,90):Ue(-5,15),vz:Math.sin(c)*Ue(30,70),life:Ue(500,750)*(d?1.4:1),s0:12,s1:Ue(30,40)*(d?1.5:1),c0:d?[1,1,1]:[.75,.9,1],c1:[.5,.75,1],a0:d?.45:.35,drag:2.5
    }))
  }
  if(e.includes("wind")) {
    const[d,c]=l?[[1,.9,.7],[1,.4,.2]]:e.includes("water")?[[.9,1,1],[.3,.8,1]]:[[1,1,.9],[.45,.6,1]];
    i(28,(u,h)=> {
      const m=Ue(140,320);return {
        x:t,y:o,z:n,vx:Math.cos(u)*Math.cos(h)*m,vy:Math.sin(h)*m*.6+40,vz:Math.sin(u)*Math.cos(h)*m,life:Ue(150,300),s0:Ue(3,5),s1:1,c0:d,c1:c,a0:1,grav:-300,drag:3
      }
    }),s.emit( {
      x:t,y:o,z:n,life:140,s0:46,s1:70,c0:l?[1,.75,1]:[.85,.9,1],c1:[.5,.6,1],a0:.9
    })
  }
  return {
    view:new ue,update:()=>!0
  }
}
const sU=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,oU=`
  uniform float prog;   // 0..1: por dónde va el borde de delante
  uniform float alpha;
  uniform float time;
  uniform vec3 colA;    // interior
  uniform vec3 colB;    // medio
  uniform vec3 colC;    // filo
  varying vec2 vUv;
  ${Ks}
  void main() {
    float u = vUv.x; // a lo largo del barrido
    float v = vUv.y; // 0 dentro, 1 en el filo
    float head = prog * 1.08;
    float d = head - u;
    // solo detrás del borde; la estela se apaga hacia atrás
    float trail = smoothstep(-0.015, 0.02, d) * (1.0 - smoothstep(0.0, 0.7, d));
    // forma de media luna: más ancha en el centro del barrido, afilada en las puntas
    float width = 0.35 + 0.65 * sin(clamp(u, 0.0, 1.0) * 3.14159);
    float inner = 1.0 - width;
    float band = smoothstep(inner - 0.02, inner + 0.25, v) * (1.0 - smoothstep(0.9, 1.0, v));
    float edge = exp(-pow((v - 0.9) * 14.0, 2.0));
    float front = exp(-d * d * 900.0);
    float n = fbm(vec2(u * 10.0 - time * 7.0, v * 4.0));
    vec3 c = v < 0.5 ? mix(colA, colB, v * 2.0) : mix(colB, colC, (v - 0.5) * 2.0);
    c = mix(c, vec3(1.0), clamp(edge * 0.55 + front * 0.8, 0.0, 1.0));
    float a = trail * band * (0.45 + 0.55 * n) + trail * edge * 0.9 + front * band * 0.8;
    gl_FragColor = vec4(c, a * alpha);
  }`,ix= {
  fire:[[.9,.15,.02],[1,.5,.1],[1,.9,.5]],water:[[.15,.4,1],[.45,.78,1],[.9,.98,1]],wind:[[.3,.3,1],[.5,.65,1],[.92,.95,1]],"fire+water":[[.95,.3,.05],[1,.75,.55],[.6,.88,1]],"fire+wind":[[.45,.05,.85],[.9,.35,.95],[1,.75,1]],"water+wind":[[.1,.45,1],[.3,.85,1],[.92,1,1]],"fire+water+wind":[[1,.4,.08],[.55,.45,1],[.6,.92,1]]
};
function rU(a,e,t,n,s,o,r) {
  const d=[],c=[],u=[];
  for(let m=0;m<=36;m++) {
    const p=m/36,g=t-n+2*n*p,y=r-14+34*p;
    for(let f=0;f<=6;f++) {
      const v=f/6,b=s+(o-s)*v;
      d.push(a+Math.cos(g)*b,y+v*6,e+Math.sin(g)*b),c.push(p,v)
    }
  }
  for(let m=0;m<36;m++)for(let p=0;p<6;p++) {
    const g=m*7+p;
    u.push(g,g+6+1,g+1,g+1,g+6+1,g+6+2)
  }
  const h=new Jt;
  return h.setAttribute("position",new Ce(d,3)),h.setAttribute("uv",new Ce(c,2)),h.setIndex(u),h
}
class iU {
  constructor(e,t,n,s,o,r,i) {
    x(this,"view",new ue);
    x(this,"mesh");
    x(this,"mat");
    x(this,"ps");
    x(this,"t",0);
    x(this,"lastK",0);
    x(this,"h");
    x(this,"plasma");
    this.g=e,this.els=t,this.x=n,this.y=s,this.ang=o,this.r=r,this.half=i,this.h=e.world3d.heightAt(n,s)+30;
    const[l,d,c]=ix[CA(t)]??ix.fire;
    this.mat=new Ze( {
      vertexShader:sU,fragmentShader:oU,uniforms: {
        prog: {
          value:0
        },alpha: {
          value:1
        },time: {
          value:Math.random()*10
        },colA: {
          value:new St(...l)
        },colB: {
          value:new St(...d)
        },colC: {
          value:new St(...c)
        }
      },transparent:!0,depthWrite:!1,blending:Rt,side:rt
    }),this.mesh=new Ie(rU(n,s,o,i,r*.2,r,this.h),this.mat),this.mesh.renderOrder=8,this.mesh.frustumCulled=!1,e.world3d.scene.add(this.mesh),this.ps=pu(e),this.plasma=t.includes("fire")&&t.includes("wind")&&!t.includes("water")
  }
  at(e,t) {
    const n=this.ang-this.half+2*this.half*e,s=this.r*(.2+.8*t);
    return {
      x:this.x+Math.cos(n)*s,y:this.h-14+34*e+t*6,z:this.y+Math.sin(n)*s,a:n
    }
  }
  details(e,t) {
    const n=this.ps;
    for(let s=e;s<t;s+=.035) {
      const o=Math.min(1,s);
      if(this.els.includes("fire")) {
        const r=this.at(o,.75+Math.random()*.25),[i,l]=this.plasma?[[1,.7,1],[.5,.1,.8]]:[[1,.85,.45],[.85,.15,.02]];
        n.emit( {
          x:r.x,y:r.y,z:r.z,vx:Math.cos(r.a)*30,vy:70+Math.random()*60,vz:Math.sin(r.a)*30,life:260+Math.random()*160,s0:18,s1:5,c0:i,c1:l,a0:.75,drag:2
        })
      }
      if(this.els.includes("water")) {
        const r=this.at(o,.6+Math.random()*.4);
        n.emit( {
          x:r.x,y:r.y,z:r.z,vx:Math.cos(r.a)*60,vy:40+Math.random()*60,vz:Math.sin(r.a)*60,life:450,s0:6,s1:3,c0:[.95,1,1],c1:[.4,.75,1],a0:1,grav:-600,twinkle:.03
        })
      }
    }
    if(this.els.includes("wind")&&t>.15)for(let s=0;s<2;s++) {
      const o=.45+.4*Math.random();
      let r=this.at(Math.max(0,t-.3),o);
      for(let i=1;i<=7;i++) {
        const l=Math.max(0,t-.3)+.3*i/7,d=this.at(Math.min(1,l),Math.min(1,Math.max(.2,o+(Math.random()-.5)*.35)));
        for(let c=0;c<4;c++) {
          const u=c/4;
          n.emit( {
            x:r.x+(d.x-r.x)*u,y:r.y+(d.y-r.y)*u,z:r.z+(d.z-r.z)*u,life:70,s0:5,s1:3,c0:[1,1,1],c1:this.plasma?[1,.6,1]:[.6,.75,1],a0:1
          })
        }
        r=d
      }
    }
  }
  update(e) {
    this.t+=e;
    const s=Math.min(1,this.t/130);
    return this.mat.uniforms.prog.value=s,this.mat.uniforms.time.value+=e/1e3,this.mat.uniforms.alpha.value=this.t<130?1:Math.max(0,1-(this.t-130)/140),s>this.lastK&&this.details(this.lastK,s),this.lastK=s,this.t<270?!1:(this.g.world3d.scene.remove(this.mesh),this.mesh.geometry.dispose(),this.mat.dispose(),!0)
  }
}
function lU(a,e,t,n,s,o,r) {
  return new iU(a,e,t,n,s,o,r)
}
function dU(a,e,t,n) {
  const s=pu(a),o=a.world3d.heightAt(t,n)+28,i=e.includes("fire")&&e.includes("wind")&&!e.includes("water")?[uU]:e.map(l=>cU[l]);
  s.emit( {
    x:t,y:o,z:n,life:110,s0:26,s1:34,c0:[1,1,1],c1:i[0],a0:.55
  });
  for(let l=0;l<5;l++) {
    const d=Math.random()*Math.PI*2,c=i[l%i.length];
    s.emit( {
      x:t,y:o,z:n,vx:Math.cos(d)*90,vy:30+Math.random()*60,vz:Math.sin(d)*90,life:220,s0:5,s1:1,c0:[1,1,1],c1:c,a0:.9,drag:4
    })
  }
}
const cU= {
  fire:[1,.45,.1],water:[.45,.78,1],wind:[.55,.65,1]
},uU=[.8,.35,1],zh=new WeakMap,hU=6,mU=8,Cy=36,lx=30,$r=.55,TA=58,dx=7,Mi=52,pU=`
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vPos = position;
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`,fU=`
  uniform float halfW;
  uniform float height;
  uniform float time;
  uniform float alpha;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    float x = vPos.x;
    float y = vPos.y;
    // ribete dorado alrededor de la placa
    float b = 5.0;
    float edge = max(smoothstep(halfW - b - 1.0, halfW - b, abs(x)), max(1.0 - smoothstep(b, b + 1.0, y), smoothstep(height - b - 1.0, height - b, y)));
    // cruz de Crusader
    float vert = (1.0 - smoothstep(3.0, 4.2, abs(x))) * step(height * 0.17, y) * step(y, height * 0.85);
    float hor = (1.0 - smoothstep(3.0, 4.2, abs(y - height * 0.62))) * step(abs(x), halfW * 0.45);
    float gold = max(edge, max(vert, hor));
    vec3 col = mix(vec3(0.98, 0.97, 0.93), vec3(0.93, 0.72, 0.30), gold);
    // luz fija de arriba y de frente (la escena no tiene luces)
    vec3 n = normalize(vN);
    float lit = 0.72 + 0.38 * abs(dot(n, normalize(vec3(0.3, 0.85, 0.45))));
    // barrido de luz en diagonal que recorre la placa
    float band = fract((x / halfW) * 0.5 + 0.5 - y / height * 0.45 - time * 1.4);
    float sweep = 1.0 - smoothstep(0.0, 0.09, abs(band - 0.5));
    // los bordes de la silueta brillan (fresnel)
    float fres = pow(1.0 - abs(dot(n, normalize(vView))), 2.0);
    col = col * lit + vec3(1.0, 0.96, 0.82) * 0.45 * sweep + vec3(1.0, 0.85, 0.5) * fres * 0.7;
    gl_FragColor = vec4(col, alpha * (0.82 + 0.18 * gold));
  }`;
function gU() {
  const a=Math.asin(Cy/Mi),e=new Pv,t=16;
  for(let s=0;s<=t;s++) {
    const o=-a+2*a*s/t,r=Mi*Math.sin(o),i=Mi*Math.cos(o)-Mi;
    s===0?e.moveTo(r,i):e.lineTo(r,i)
  }
  for(let s=t;s>=0;s--) {
    const o=-a+2*a*s/t;
    e.lineTo((Mi-dx)*Math.sin(o),(Mi-dx)*Math.cos(o)-Mi)
  }
  const n=new yp(e, {
    depth:TA,bevelEnabled:!1,curveSegments:1
  });
  return n.rotateX(-Math.PI/2),n.computeVertexNormals(),n
}
let yU=null;
const cx=[5914152,8018492,10123861,4863012].map(a=>[(a>>16&255)/255,(a>>8&255)/255,(a&255)/255]),ux=[201/255,168/255,126/255];
let lc=null;
function vU() {
  if(lc)return lc;
  const a=document.createElement("canvas");
  a.width=a.height=32;
  const e=a.getContext("2d"),t=[[16,3],[27,9],[29,20],[19,29],[7,26],[3,14]];
  e.beginPath(),t.forEach(([s,o],r)=>r?e.lineTo(s,o):e.moveTo(s,o)),e.closePath();
  const n=e.createLinearGradient(6,4,26,28);
  return n.addColorStop(0,"#ffffff"),n.addColorStop(1,"#a8a8a8"),e.fillStyle=n,e.fill(),lc=oi(new pp(a)),lc.magFilter=os,lc
}
const hx=new WeakMap;
function _U(a) {
  let e=hx.get(a);
  return e||(e= {
    rocks:new Ot(a,3e3,!1,vU()),dust:new Ot(a,1500,!1)
  },hx.set(a,e),a.addFx(e.rocks),a.addFx(e.dust)),e
}
class PA {
  constructor(e) {
    x(this,"view",new ue);
    x(this,"stopped",!1);
    x(this,"g");
    this.g=e
  }
  put(e,t,n,s,o,r,i,l) {
    const {
      rocks:d,dust:c
    }
    =_U(this.g),u=this.g.world3d.heightAt(e,t)+2;
    if(o)c.emit( {
      x:e,y:u,z:t,vx:n,vy:r,vz:s,drag:5,life:l*1e3,s0:i*2,s1:i*4.5,c0:ux,c1:ux,a0:.4
    });
    else {
      const h=cx[Math.floor(Math.random()*cx.length)];
      d.emit( {
        x:e,y:u,z:t,vx:n,vy:r,vz:s,grav:-520,life:l*1e3,s0:i*2.4,s1:i*2.4,c0:h,c1:h,a0:1
      })
    }
  }
  emit(e,t,n,s,o,r) {
    for(let i=0;i<r;i++) {
      const l=Math.random()*2-1,d=Math.sign(l||1),c=50+Math.random()*130,u=30+Math.random()*90,h=Math.random()<.3;
      this.put(e-s*l*o,t+n*l*o,-s*d*c-n*u,n*d*c-s*u,h,h?20+Math.random()*30:110+Math.random()*190,h?6+Math.random()*7:2.1+Math.random()*3.1,h?.5+Math.random()*.3:.45+Math.random()*.35)
    }
  }
  burst(e,t,n,s,o,r=.6) {
    for(let i=0;i<s;i++) {
      const l=o===void 0?Math.random()*Math.PI*2:o+(Math.random()*2-1)*r,d=Math.random()*n,c=o===void 0?40+Math.random()*120:120+Math.random()*200,u=Math.random()<.3;
      this.put(e+Math.cos(l)*d,t+Math.sin(l)*d,Math.cos(l)*c,Math.sin(l)*c,u,u?20+Math.random()*30:150+Math.random()*200,u?7+Math.random()*8:2.2+Math.random()*3.4,u?.6+Math.random()*.3:.55+Math.random()*.35)
    }
  }
  stop() {
    this.stopped=!0
  }
  update() {
    return this.stopped
  }
}
class bU {
  constructor(e,t=1) {
    x(this,"group",new on);
    x(this,"mat");
    x(this,"ghosts",[]);
    x(this,"trail",[]);
    x(this,"t",Math.random()*10);
    x(this,"g");
    x(this,"debris");
    x(this,"last",null);
    x(this,"half");
    x(this,"lift",0);
    x(this,"lean",0);
    x(this,"ground");
    x(this,"hidden",!1);
    x(this,"world");
    this.g=e,this.half=Cy*t,this.world=e.world3d;
    const n=zh.get(this.world)??0;
    zh.set(this.world,n+1);
    const s=zs&&n>=hU;
    this.hidden=zs&&n>=mU,this.debris=new PA(e),e.addFx(this.debris),this.ground=this.hidden?null:e.groundSprite(ol(),!1),this.ground&&(this.ground.tint=0,this.ground.size=80*t,this.ground.alpha=0);
    const o=yU??(yU=oi(gU()));
    this.mat=new Ze( {
      vertexShader:pU,fragmentShader:fU,uniforms: {
        halfW: {
          value:Cy
        },height: {
          value:TA
        },time: {
          value:0
        },alpha: {
          value:0
        }
      },transparent:!0,depthWrite:!1,side:rt
    });
    const r=new Ie(o,this.mat);
    r.renderOrder=4,r.frustumCulled=!1,this.group.add(r);
    const i=new $o( {
      color:16765562,transparent:!0,opacity:0,blending:Rt,depthWrite:!1,side:rt,forceSinglePass:!0
    }),l=new Ie(o,i);
    l.scale.set(1.12,1.08,1.6),l.position.y=-2,l.renderOrder=5,l.frustumCulled=!1,!s&&!this.hidden?(this.group.add(l),this.ghosts.push( {
      mesh:l,mat:i,base:.28
    })):i.dispose(),this.group.scale.setScalar(t),this.hidden||e.world3d.scene.add(this.group);
    for(const d of s||this.hidden?[]:[.22,.11]) {
      const c=new $o( {
        color:16770728,transparent:!0,opacity:0,blending:Rt,depthWrite:!1,side:rt,forceSinglePass:!0
      }),u=new Ie(o,c);
      u.scale.setScalar(t),u.renderOrder=5,u.frustumCulled=!1,e.world3d.scene.add(u),this.ghosts.push( {
        mesh:u,mat:c,base:d
      })
    }
  }
  form(e) {
    if(e>=1) {
      this.lift=0,this.lean=0,this.ghosts[0]&&(this.ghosts[0].base=.28);
      return
    }
    if(e<$r) {
      const n=e/$r;
      this.lift=150*(1-n*n),this.lean=0,this.ghosts[0]&&(this.ghosts[0].base=.28);
      return
    }
    const t=(e-$r)/(1-$r);
    this.lift=5*Math.sin(Math.min(1,t*3)*Math.PI)*(1-t),this.lean=.38*(1-(1-t)**2),this.ghosts[0]&&(this.ghosts[0].base=.28+.5*t)
  }
  update(e,t,n,s,o) {
    this.t+=s,this.mat.uniforms.time.value=this.t,this.mat.uniforms.alpha.value=o;
    const r=Math.atan2(-Math.cos(n),-Math.sin(n)),i=this.g.world3d.heightAt(e,t)+lx+this.lift+Math.sin(this.t*9)*1.5;
    if(this.group.position.set(e,i,t),this.group.rotation.order="YXZ",this.group.rotation.y=r,this.group.rotation.x=this.lean,this.ghosts[0]&&(this.ghosts[0].mat.opacity=this.ghosts[0].base*o),this.ground&&(this.ground.x=e,this.ground.y=t,this.ground.alpha=.32*o*Math.max(.2,1-this.lift/150)),this.last&&this.lift===0&&this.lean===0) {
      const l=Math.hypot(e-this.last.x,t-this.last.y);
      l>.5&&!this.hidden&&this.debris.emit(e,t,(e-this.last.x)/l,(t-this.last.y)/l,this.half,Math.min(20,Math.round(l*.8+Math.random())))
    }
    this.last= {
      x:e,y:t
    },this.trail.unshift( {
      x:e,y:t
    }),this.trail.length>9&&this.trail.pop(),[4,8].forEach((l,d)=> {
      const c=this.ghosts[d+1];if(!c)return;const u=this.trail[Math.min(l,this.trail.length-1)];c.mesh.position.set(u.x,this.g.world3d.heightAt(u.x,u.y)+lx,u.y),c.mesh.rotation.y=r,c.mat.opacity=c.base*o*(this.trail.length>l?1:0)
    })
  }
  dispose() {
    var e;
    zh.set(this.world,Math.max(0,(zh.get(this.world)??1)-1)),this.debris.stop(),(e=this.ground)==null||e.dispose(),this.g.world3d.scene.remove(this.group);
    for(const t of this.ghosts)this.g.world3d.scene.remove(t.mesh),t.mat.dispose();
    this.mat.dispose()
  }
}
const qv={},Ct= {
  start:[],tick:[],hurt:[],damageMult:[],hit:[],kill:[],cast:[]
};
function oe(a,e) {
  return a.stats.ext[e]??0
}
const tW= {
  dmg:"Daño",cd:"Celeridad",cast:"Rapidez de casteo",area:"Área",reach:"Alcance cuerpo a cuerpo",count:"Cantidad",targets:"Objetivos",pierce:"Perforación",projSpeed:"Velocidad de proyectil",orbitSpeed:"Velocidad de giro",moveSpeed:"Velocidad de movimiento",duration:"Duración",splash:"Salpicadura",cone:"Golpe en cono"
};
function ao(a) {
  return`${String(Math.round(a*1e3)/10).replace(".",",")}%`
}
function Cc(a) {
  return String(Math.round(a*10)/10).replace(".",",")
}
function mx(a,e) {
  return e>1?a+(/[aeiou]$/.test(a)?"s":"es"):a
}
function RA(a,e,t="proyectil") {
  switch(a) {
    case"dmg":return`+${ao(e)} de daño`;
    case"cd":return`+${Cc(e*100)} de Celeridad`;
    case"cast":return`+${Cc(e*100)} de rapidez de casteo`;
    case"area":return`+${ao(e)} de área`;
    case"reach":return`+${ao(e)} de alcance cuerpo a cuerpo`;
    case"count":return`+${Cc(e)} ${mx(t,e)}`;
    case"targets":return`+${Cc(e)} ${mx("objetivo",e)}`;
    case"pierce":return`+${ao(e)} de perforación`;
    case"projSpeed":return`+${ao(e)} de velocidad de proyectil`;
    case"orbitSpeed":return`+${ao(e)} de velocidad de giro`;
    case"moveSpeed":return e<0?`-${ao(-e)} de velocidad de movimiento`:`+${ao(e)} de velocidad de movimiento`;
    case"duration":return`+${ao(e)} de duración`;
    case"splash":return`+${ao(e)} de salpicadura`;
    case"cone":return`golpe en cono (${ao(e)} del daño a los demás)`
  }
}
function Kt(a,e,t) {
  return RA(a,e,t)
}
function zA(a,e) {
  return`Salpicadura: ${ao(a)} del daño a ${Cc(e)} m`
}
function Nc(a,e,t) {
  return Pt(RA(a,e,t))
}
function LA(a,e) {
  return Pt(zA(a,e))
}
function fu(a,e,t,n) {
  return bt("{mod} en {skill}.", {
    mod:Nc(a,e,n),skill:t
  })
}