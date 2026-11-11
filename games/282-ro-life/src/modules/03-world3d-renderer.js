/**
 * ============================================================================
 * RO Life Source Module: 03-world3d-renderer.js
 * Description: Three.js 3D Map Renderer (`class WV`), GND/RSW/RSM/GAT Parsers, Water/Terrain/Billboard Shaders
 * ============================================================================
 */

const Ym=8,Hb=1024,e6=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,t6=`
varying vec2 vUv;
uniform float seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453); }
float noise(vec2 p, float period) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 i1 = mod(i + 1.0, period);
  i = mod(i, period);
  return mix(mix(hash(i), hash(vec2(i1.x, i.y)), u.x), mix(hash(vec2(i.x, i1.y)), hash(i1), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5, period = ${Ym.toFixed(1)};
  for (int k = 0; k < 5; k++) { v += a * noise(p, period); p *= 2.0; period *= 2.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 p = vUv * ${Ym.toFixed(1)};
  gl_FragColor = vec4(fbm(p), fbm(p + 3.7), 0.0, 1.0);
}
`,a6=`
varying vec2 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`,n6=`
uniform float time;
uniform sampler2D nebula;
varying vec2 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float stars(vec2 p, float density, float t) {
  vec2 c = floor(p);
  float h = hash(c);
  if (h < density) return 0.0;
  vec2 o = vec2(hash(c + 3.1), hash(c + 7.7)) * 0.8 + 0.1;
  float d = length(fract(p) - o);
  float tw = 0.6 + 0.4 * sin(t * (1.0 + h * 3.0) + h * 60.0);
  return smoothstep(0.09, 0.0, d) * tw * (h - density) / (1.0 - density);
}
void main() {
  vec2 p = vWorld * 0.00022;
  float t = time;
  // nebulosas: la misma textura a dos escalas, derivando en sentidos distintos
  float n1 = texture2D(nebula, p * 1.3 / ${Ym.toFixed(1)} + vec2(t * 0.0008, t * 0.0003)).r;
  float n2 = texture2D(nebula, p * 2.4 / ${Ym.toFixed(1)} - vec2(t * 0.0005, -t * 0.0006)).g;
  vec3 col = vec3(0.035, 0.03, 0.09);
  col += vec3(0.48, 0.34, 0.82) * smoothstep(0.45, 0.85, n1) * 0.55;
  col += vec3(0.22, 0.36, 0.85) * smoothstep(0.5, 0.9, n2) * 0.45;
  col += vec3(0.85, 0.42, 0.72) * smoothstep(0.7, 0.95, n1 * n2 * 1.6) * 0.35;
  // estrellas a dos escalas
  float s = stars(vWorld * 0.012, 0.965, t) + stars(vWorld * 0.0045 + 11.0, 0.985, t * 0.7) * 1.4;
  col += vec3(1.0, 0.97, 0.92) * s;
  gl_FragColor = vec4(col, 1.0);
}
`,s6=`
uniform float time;
attribute float seed;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vA = 0.55 + 0.45 * sin(time * (0.8 + seed * 2.0) + seed * 40.0);
  gl_PointSize = (2.0 + seed * 3.5) * (1400.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`,o6=`
varying float vA;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.0, length(d)) * vA;
  gl_FragColor = vec4(vec3(0.85, 0.85, 1.0) * a, a);
}
`,Ob=5200,s0=900;
function jb(a) {
  const e=new Jr(Hb,Hb, {
    depthBuffer:!1
  });
  e.texture.wrapS=Xi,e.texture.wrapT=Xi,e.texture.generateMipmaps=!1,e.texture.minFilter=ks,e.texture.magFilter=ks;
  const t=new Ze( {
    vertexShader:e6,fragmentShader:t6,uniforms: {
      seed: {
        value:0
      }
    },depthTest:!1,depthWrite:!1
  }),n=new Ie(new cs(2,2),t),s=new kS;
  s.add(n);
  const o=new NS(-1,1,1,-1,0,1),r=a.getRenderTarget();
  return a.setRenderTarget(e),a.render(s,o),a.setRenderTarget(r),n.geometry.dispose(),t.dispose(),e
}
class r6 {
  constructor(e,t,n,s,o) {
    x(this,"sky");
    x(this,"dust",null);
    x(this,"skyMat");
    x(this,"dustMat",null);
    x(this,"nebula");
    x(this,"born",performance.now());
    this.nebula=jb(t),this.skyMat=new Ze( {
      vertexShader:a6,fragmentShader:n6,uniforms: {
        time: {
          value:0
        },nebula: {
          value:this.nebula.texture
        }
      },depthWrite:!1
    });
    const r=new cs(o*40,o*40);
    r.rotateX(-Math.PI/2),this.sky=new Ie(r,this.skyMat),this.sky.position.set(n,-Ob,s),this.sky.renderOrder=-10,this.sky.frustumCulled=!1,e.add(this.sky),Tt.fxQuality!=="low"&&this.addDust(e,n,s,o)
  }
  addDust(e,t,n,s) {
    const o=new Float32Array(s0*3),r=new Float32Array(s0),i=s*3;
    for(let d=0;d<s0;d++) {
      let c=0,u=0;
      do c=(Math.random()*2-1)*i,u=(Math.random()*2-1)*i;
      while(Math.abs(c)<s*.55&&Math.abs(u)<s*.55&&Math.random()<.85);
      o[d*3]=t+c,o[d*3+1]=-300-Math.random()*(Ob-800),o[d*3+2]=n+u,r[d]=Math.random()
    }
    const l=new Jt;
    l.setAttribute("position",new Ce(o,3)),l.setAttribute("seed",new Ce(r,1)),this.dustMat=new Ze( {
      vertexShader:s6,fragmentShader:o6,uniforms: {
        time: {
          value:0
        }
      },transparent:!0,depthWrite:!1,blending:Rt
    }),this.dust=new Qi(l,this.dustMat),this.dust.renderOrder=-9,this.dust.frustumCulled=!1,e.add(this.dust)
  }
  rebake(e) {
    this.nebula.dispose(),this.nebula=jb(e),this.skyMat.uniforms.nebula.value=this.nebula.texture
  }
  update() {
    const e=(performance.now()-this.born)/1e3;
    this.skyMat.uniforms.time.value=e,this.dustMat&&(this.dustMat.uniforms.time.value=e)
  }
  destroy() {
    var e,t,n;
    this.sky.removeFromParent(),this.sky.geometry.dispose(),this.skyMat.dispose(),this.nebula.dispose(),(e=this.dust)==null||e.removeFromParent(),(t=this.dust)==null||t.geometry.dispose(),(n=this.dustMat)==null||n.dispose()
  }
}
const wo=[ {
  apothem:205,h:12
}, {
  apothem:165,h:26
}
],Tl=124,yh=185,oc=26,rc=130,Bo=128,o0=60,xy=8,i6=Math.cos(Math.PI/xy),l6=`
  attribute vec2 tile;
  attribute float shade;
  varying vec2 vTile;
  varying float vShade;
  varying vec3 vWorld;
  void main() {
    vTile = tile;
    vShade = shade;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`,d6=a=>`
  ${a}
  uniform sampler2D atlas;
  uniform vec4 rect; // hueco del atlas: u, v de la esquina y tamaño
  uniform float repeatTile; // 1 = se repite (piedra); 0 = una vez (círculo)
  uniform vec3 groundLight;
  varying vec2 vTile;
  varying float vShade;
  void main() {
    vec2 t = repeatTile > 0.5 ? fract(vTile) : clamp(vTile, 0.0, 1.0);
    // un poco hacia dentro del hueco: sin coger el borde del de al lado
    vec2 uv = rect.xy + (t * 0.96 + 0.02) * rect.zw;
    vec3 c = texture2D(atlas, uv).rgb * vShade * groundLight;
    gl_FragColor = vec4(atmos(c), 1.0);
  }`,Gb=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,c6=`
  uniform sampler2D atlas;
  uniform vec4 rect;
  uniform vec3 color;
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec2 uv = rect.xy + (vUv * 0.96 + 0.02) * rect.zw;
    vec3 t = texture2D(atlas, uv).rgb;
    float lum = max(t.r, max(t.g, t.b));
    float r = length(vUv - 0.5) * 2.0;
    float pulse = 0.65 + 0.35 * sin(time * 2.2);
    float a = smoothstep(0.55, 0.95, lum) * (1.0 - smoothstep(0.92, 1.0, r)) * pulse;
    // y un halo suave por el borde
    a += smoothstep(0.7, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r)) * 0.35 * pulse;
    gl_FragColor = vec4(color * a, a);
  }`,u6=`
  uniform vec3 color;
  uniform float time;
  varying vec2 vUv;
  void main() {
    float k = 0.75 + 0.25 * sin(time * 3.0);
    gl_FragColor = vec4(mix(color, vec3(1.0), 0.35) * k, 1.0);
  }`,h6=`
  uniform float time;
  attribute float seed;
  varying float vA;
  void main() {
    float life = fract(time * (0.18 + seed * 0.12) + seed * 7.0);
    vec3 p = position;
    p.y += life * 220.0;
    vA = sin(life * 3.14159) * (0.5 + seed * 0.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (3.0 + seed * 4.0) * (1200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`,m6=`
  uniform vec3 color;
  varying float vA;
  void main() {
    float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vA;
    gl_FragColor = vec4(mix(color, vec3(1.0), 0.4) * a, a);
  }`;
class p6 {
  constructor(e,t) {
    x(this,"group",new on);
    x(this,"mats",[]);
    x(this,"ring");
    x(this,"crystals",[]);
    x(this,"born",performance.now());
    x(this,"x");
    x(this,"z");
    x(this,"ground");
    this.x=t.x,this.z=t.z,this.ground=t.ground;
    const n=new St(11832575),s=(z,L)=> {
      const U=new Ze( {
        vertexShader:l6,fragmentShader:d6(t.atmosGlsl),uniforms: {
          atlas: {
            value:t.atlas
          },rect: {
            value:z
          },repeatTile: {
            value:L
          },groundLight:t.groundLight,...t.atmosUniforms
        },side:rt
      });
      return this.mats.push(U),U
    },o=[],r=[],i=[],l=[],d=(z,L)=> {
      const U=(L+.5)/xy*Math.PI*2,q=z/i6;
      return[Math.cos(U)*q,Math.sin(U)*q]
    },c=(z,L,U)=> {
      const q=o.length/3;
      for(let N=0;N<4;N++)o.push(z[N][0],z[N][1],z[N][2]),r.push(L[N][0],L[N][1]),i.push(U);
      l.push(q,q+1,q+2,q+2,q+1,q+3)
    },u=(z,L)=>[(this.x+z)/Bo,(this.z+L)/Bo];
    wo.forEach((z,L)=> {
      var N;const U=L?wo[L-1].h:0,q=((N=wo[L+1])==null?void 0:N.apothem)??0;for(let H=0;H<xy;H++) {
        const[V,te]=d(z.apothem,H),[pe,ge]=d(z.apothem,H+1),Be=Math.hypot(pe-V,ge-te)/Bo,Ye=(z.h-U)/Bo;c([[V,z.h,te],[pe,z.h,ge],[V,U,te],[pe,U,ge]],[[0,0],[Be,0],[0,Ye],[Be,Ye]],.62);const[ae,me]=q?d(q,H):[0,0],[Re,we]=q?d(q,H+1):[0,0];c([[V,z.h,te],[pe,z.h,ge],[ae,z.h,me],[Re,z.h,we]],[u(V,te),u(pe,ge),u(ae,me),u(Re,we)],1)
      }
    });
    for(let z=0;z<4;z++) {
      const L=Math.PI/4+z*Math.PI/2,U=Math.cos(L)*yh,q=Math.sin(L)*yh,N=wo[0].h,H=oc/2,V=N+rc,te=[[-H,-H],[H,-H],[H,H],[-H,H]];
      for(let pe=0;pe<4;pe++) {
        const[ge,Be]=te[pe],[Ye,ae]=te[(pe+1)%4];
        c([[U+ge*.8,V,q+Be*.8],[U+Ye*.8,V,q+ae*.8],[U+ge,N,q+Be],[U+Ye,N,q+ae]],[[0,0],[oc/Bo,0],[0,rc/Bo],[oc/Bo,rc/Bo]],pe%2?.7:.85);
        const me=o.length/3;
        o.push(U+ge*.8,V,q+Be*.8,U+Ye*.8,V,q+ae*.8,U,V+16,q),r.push(0,0,oc/Bo,0,oc/Bo/2,.15),i.push(.9,.9,.9),l.push(me,me+1,me+2)
      }
    }
    const h=new Jt;
    h.setAttribute("position",new Ce(o,3)),h.setAttribute("tile",new Ce(r,2)),h.setAttribute("shade",new Ce(i,1)),h.setIndex(l),this.group.add(new Ie(h,s(t.stone,1)));
    const m=wo[wo.length-1].h,p=new Cv(Tl,40);
    p.rotateX(-Math.PI/2);
    const g=p.getAttribute("position"),y=[],f=[];
    for(let z=0;z<g.count;z++)y.push(g.getX(z)/(Tl*2)+.5,.5-g.getZ(z)/(Tl*2)),f.push(1.1);
    p.setAttribute("tile",new Ce(y,2)),p.setAttribute("shade",new Ce(f,1));
    const v=new Ie(p,s(t.circle,0));
    v.position.y=m+.6,this.group.add(v);
    const b=new Ze( {
      vertexShader:Gb,fragmentShader:c6,uniforms: {
        atlas: {
          value:t.atlas
        },rect: {
          value:t.circle
        },color: {
          value:new F(n.r,n.g,n.b)
        },time: {
          value:0
        }
      },transparent:!0,depthWrite:!1,blending:Rt
    });
    this.mats.push(b);
    const _=new cs(Tl*2.1,Tl*2.1);
    _.rotateX(-Math.PI/2),this.ring=new Ie(_,b),this.ring.position.y=m+2,this.group.add(this.ring);
    const S=new Ze( {
      vertexShader:Gb,fragmentShader:u6,uniforms: {
        color: {
          value:new F(n.r,n.g,n.b)
        },time: {
          value:0
        }
      }
    });
    this.mats.push(S);
    const M=new Rv(16);
    M.scale(1,1.6,1);
    for(let z=0;z<4;z++) {
      const L=Math.PI/4+z*Math.PI/2,U=new Ie(M,S);
      U.position.set(Math.cos(L)*yh,wo[0].h+rc+44,Math.sin(L)*yh),U.userData.phase=z*1.7,this.crystals.push(U),this.group.add(U)
    }
    const k=new Float32Array(o0*3),C=new Float32Array(o0);
    for(let z=0;z<o0;z++) {
      const L=Math.random()*Math.PI*2,U=Math.sqrt(Math.random())*Tl*.9;
      k[z*3]=Math.cos(L)*U,k[z*3+1]=m+4,k[z*3+2]=Math.sin(L)*U,C[z]=Math.random()
    }
    const A=new Jt;
    A.setAttribute("position",new Ce(k,3)),A.setAttribute("seed",new Ce(C,1));
    const w=new Ze( {
      vertexShader:h6,fragmentShader:m6,uniforms: {
        time: {
          value:0
        },color: {
          value:new F(n.r,n.g,n.b)
        }
      },transparent:!0,depthWrite:!1,blending:Rt
    });
    this.mats.push(w);
    const T=new Qi(A,w);
    T.frustumCulled=!1,this.group.add(T),this.group.position.set(t.x,t.ground,t.z),e.add(this.group)
  }
  setGlow(e) {
    const t=new St(e);
    for(const n of this.mats)n.uniforms.color&&n.uniforms.color.value.set(t.r,t.g,t.b)
  }
  update() {
    const e=(performance.now()-this.born)/1e3;
    for(const t of this.mats)t.uniforms.time&&(t.uniforms.time.value=e);
    this.ring.rotation.y=e*.12;
    for(const t of this.crystals)t.rotation.y=e*.9+t.userData.phase,t.position.y=wo[0].h+rc+44+Math.sin(e*1.6+t.userData.phase)*6
  }
  heightAt(e,t) {
    const n=Math.abs(e-this.x),s=Math.abs(t-this.z),o=Math.max(n,s,(n+s)*Math.SQRT1_2);
    for(let r=wo.length-1;r>=0;r--)if(o<=wo[r].apothem)return this.ground+wo[r].h;
    return null
  }
  dispose() {
    this.group.removeFromParent(),this.group.traverse(e=> {
      var t;return(t=e.geometry)==null?void 0:t.dispose()
    });
    for(const e of this.mats)e.dispose()
  }
}
const Ks=`
  float fHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), u.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * fNoise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
  // de rojo oscuro a naranja, amarillo y casi blanco (lo más caliente)
  vec3 fireRamp(float t) {
    vec3 c = mix(vec3(0.32, 0.03, 0.0), vec3(1.0, 0.28, 0.02), smoothstep(0.0, 0.4, t));
    c = mix(c, vec3(1.0, 0.7, 0.16), smoothstep(0.35, 0.72, t));
    return mix(c, vec3(1.0, 0.96, 0.78), smoothstep(0.78, 1.0, t));
  }
`,f6=`
  ${Ks}
  uniform float time;
  uniform float fade;
  uniform float arc;
  uniform float seed;
  uniform float stretch;
  varying float vAng;
  varying float vH;
  varying float vAlong;
  void main() {
    vec2 q = vec2(vAng * stretch + seed, vH * 2.2 - time * 3.4);
    float n = fbm(q);
    float n2 = fNoise(vec2(vAng * stretch * 3.0 + seed, vH * 6.0 - time * 7.0));
    float f = clamp((1.0 - vH) * 1.45 + (n - 0.5) * 1.25 + (n2 - 0.5) * 0.4 - 0.18, 0.0, 1.0);
    float ends = arc > 0.5 ? smoothstep(0.0, 0.12, vAlong) * smoothstep(1.0, 0.88, vAlong) : 1.0;
    float a = smoothstep(0.03, 0.4, f) * fade * ends;
    if (a < 0.004) discard;
    gl_FragColor = vec4(fireRamp(f), a);
  }
`,g6=`
  attribute float ang;
  attribute float along;
  attribute float hgt;
  uniform float crest;
  uniform float height;
  uniform float time;
  varying float vAng;
  varying float vH;
  varying float vAlong;
  void main() {
    float flick = 0.78 + 0.22 * sin(ang * 11.0 + time * 9.0) + 0.14 * sin(ang * 23.0 - time * 13.0);
    // las puntas se inclinan hacia fuera y ondean
    float r = crest + hgt * hgt * 14.0 + sin(ang * 17.0 + time * 6.0) * 4.0 * hgt;
    vAng = ang;
    vH = hgt;
    vAlong = along;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(cos(ang) * r, hgt * height * flick, sin(ang) * r, 1.0);
  }
`,y6=`
  attribute vec3 tongue; // centro x, z y semilla
  attribute vec2 size;   // radio y altura
  attribute float ang;
  attribute float hgt;
  uniform float time;
  uniform float grow;
  varying float vAng;
  varying float vH;
  varying float vAlong;
  void main() {
    float flick = 0.7 + 0.3 * sin(time * (7.0 + tongue.z) + tongue.z * 5.0) + 0.12 * sin(time * 17.0 + tongue.z * 11.0);
    float rr = size.x * (1.0 - hgt * 0.75);
    float sway = sin(time * 3.0 + tongue.z * 3.0) * 5.0 * hgt * hgt;
    vec3 p = vec3(tongue.x + cos(ang) * rr + sway, hgt * size.y * flick * grow, tongue.y + sin(ang) * rr);
    vAng = ang + tongue.z * 13.0;
    vH = hgt;
    vAlong = 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`,v6=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,_6=`
  ${Ks}
  uniform int shape;
  uniform vec2 quad;
  uniform float outer;
  uniform float inner;
  uniform float halfAngle;
  uniform float crest;
  uniform float whole;
  uniform float heat;
  uniform float fade;
  uniform float time;
  uniform float seed;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * quad;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float a = abs(ang);
    // borde irregular, como una mancha quemada
    float wob = (fNoise(vec2(ang * 3.0 + seed, seed)) - 0.5) * outer * 0.18;
    float edge = smoothstep(inner - 6.0, inner + 2.0, r) * (1.0 - smoothstep(outer + wob - 10.0, outer + wob + 4.0, r));
    if (shape == 1) edge *= 1.0 - smoothstep(halfAngle - 0.05, halfAngle + 0.02, a);
    if (edge <= 0.0) discard;
    // solo lo que ya ha alcanzado el frente
    float reached = whole > 0.5 ? 1.0 : 1.0 - smoothstep(crest - 4.0, crest + 6.0, r);
    float hot = whole > 0.5 ? 1.0 : exp(-max(0.0, crest - r) / (0.4 * (outer - inner) + 30.0));
    hot *= heat;
    float n = fbm(p * 0.03 + vec2(seed));
    float cracks = 1.0 - smoothstep(0.0, 0.07, abs(n - 0.5));
    float glow = fbm(p * 0.07 + vec2(seed, -time * 0.7));
    float t = clamp(hot * (cracks * 0.95 + glow * 0.35), 0.0, 1.0);
    vec3 col = mix(vec3(0.07, 0.03, 0.02), fireRamp(t), smoothstep(0.05, 0.3, t));
    float alpha = edge * reached * clamp(0.5 + t * 0.7, 0.0, 1.0) * fade;
    gl_FragColor = vec4(col, alpha);
  }
`;
let vh=null;
function wy() {
  if(vh)return vh;
  const a=document.createElement("canvas");
  a.width=a.height=32;
  const e=a.getContext("2d"),t=e.createRadialGradient(16,16,0,16,16,16);
  return t.addColorStop(0,"rgba(255,255,235,1)"),t.addColorStop(.3,"rgba(255,190,80,0.9)"),t.addColorStop(.65,"rgba(255,90,20,0.35)"),t.addColorStop(1,"rgba(255,40,0,0)"),e.fillStyle=t,e.fillRect(0,0,32,32),vh=oi(new pp(a)),vh
}
class Dv {
  constructor(e,t,n) {
    x(this,"points");
    x(this,"list",[]);
    this.spawn=n;
    for(let o=0;o<e;o++)this.list.push( {
      x:0,y:0,z:0,vx:0,vy:0,vz:0,age:0,life:-1,phase:Math.random()*6
    });
    const s=new Jt;
    s.setAttribute("position",new Ce(new Float32Array(e*3),3)),s.setAttribute("color",new Ce(new Float32Array(e*3),3)),this.points=new Qi(s,new Jc( {
      size:t,map:wy(),vertexColors:!0,transparent:!0,depthWrite:!1,blending:Rt,sizeAttenuation:!0
    })),this.points.renderOrder=6,this.points.frustumCulled=!1
  }
  update(e,t) {
    const n=e*1e3;
    let s=t*e+Math.random();
    const o=this.points.geometry.getAttribute("position"),r=this.points.geometry.getAttribute("color");
    this.list.forEach((i,l)=> {
      if(i.life<0||i.age>=i.life)if(s>=1)s-=1,i.age=0,this.spawn(i);else {
        i.life=-1,r.setXYZ(l,0,0,0);return
      }
      i.age+=n,i.vy+=40*e,i.vx*=1-1.4*e,i.vz*=1-1.4*e,i.x+=(i.vx+Math.sin(i.phase+i.age*.006)*18)*e,i.z+=(i.vz+Math.cos(i.phase+i.age*.005)*18)*e,i.y+=i.vy*e,o.setXYZ(l,i.x,i.y,i.z);const d=Math.max(0,1-i.age/i.life),c=.75+.25*Math.sin(i.age*.04+i.phase);r.setXYZ(l,d*c,d*d*.75*c,d*d*d*.3*c)
    }),o.needsUpdate=!0,r.needsUpdate=!0
  }
  dispose() {
    this.points.geometry.dispose(),this.points.material.dispose()
  }
}
function oA(a,e) {
  return new Ze( {
    vertexShader:a,fragmentShader:f6,uniforms: {
      time: {
        value:Math.random()*10
      },fade: {
        value:0
      },arc: {
        value:0
      },seed: {
        value:Math.random()*50
      },stretch: {
        value:14
      },...e
    },transparent:!0,depthWrite:!1,blending:Rt,side:rt
  })
}
function rA(a) {
  const e=2*a.outer+40;
  return new Ze( {
    vertexShader:v6,fragmentShader:_6,uniforms: {
      shape: {
        value:a.shape==="cone"?1:0
      },quad: {
        value:new Ae(e,e)
      },outer: {
        value:a.outer
      },inner: {
        value:a.inner??0
      },halfAngle: {
        value:a.half??Math.PI
      },crest: {
        value:a.patch?a.outer:0
      },whole: {
        value:a.patch?1:0
      },heat: {
        value:1
      },fade: {
        value:0
      },time: {
        value:Math.random()*10
      },seed: {
        value:Math.random()*50
      }
    },transparent:!0,depthWrite:!1,side:rt,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4
  })
}
function iA(a,e,t=0) {
  const n=2*e+40,s=new cs(n,n);
  s.rotateX(-Math.PI/2);
  const o=new Ie(s,a);
  return o.rotation.y=-t,o.renderOrder=2,o.frustumCulled=!1,o
}
const ic=7;
class b6 {
  constructor(e) {
    x(this,"mesh",new on);
    x(this,"wall");
    x(this,"wallMat");
    x(this,"groundMat");
    x(this,"embers");
    x(this,"emberRate");
    x(this,"age",0);
    x(this,"reach");
    this.o=e,this.reach=e.outer;
    const t=e.shape==="cone",n=t?(e.angle??0)-(e.half??0):0,s=t?2*(e.half??0):Math.PI*2,o=Math.max(12,Math.ceil(s/(Math.PI/56))),r=[],i=[],l=[],d=[];
    for(let p=0;p<=o;p++)for(let g=0;g<ic;g++)r.push(n+s*p/o),i.push(p/o),l.push(g/(ic-1)),d.push(0,0,0);
    const c=[];
    for(let p=0;p<o;p++)for(let g=0;g<ic-1;g++) {
      const y=p*ic+g,f=(p+1)*ic+g;
      c.push(y,f,y+1,y+1,f,f+1)
    }
    const u=new Jt;
    u.setAttribute("position",new Ce(d,3)),u.setAttribute("ang",new Ce(r,1)),u.setAttribute("along",new Ce(i,1)),u.setAttribute("hgt",new Ce(l,1)),u.setIndex(c),this.wallMat=oA(g6, {
      crest: {
        value:0
      },height: {
        value:0
      }
    }),this.wallMat.uniforms.arc.value=t?1:0,this.wall=new Ie(u,this.wallMat),this.wall.renderOrder=5,this.wall.frustumCulled=!1,this.groundMat=rA( {
      shape:e.shape,outer:e.outer,inner:e.inner,half:e.half,patch:!1
    });
    const h=iA(this.groundMat,e.outer,e.angle??0),m=Math.round(Math.max(60,260*s/(Math.PI*2)));
    this.emberRate=m*1.3,this.embers=new Dv(m,60,p=> {
      const g=n+Math.random()*s,y=this.wallMat.uniforms.crest.value+(Math.random()-.5)*16;p.x=Math.cos(g)*y,p.z=Math.sin(g)*y,p.y=Math.random()*(this.wallMat.uniforms.height.value*.7);const f=30+Math.random()*90;p.vx=Math.cos(g)*f,p.vz=Math.sin(g)*f,p.vy=70+Math.random()*150,p.life=500+Math.random()*700
    }),this.mesh.add(h,this.wall,this.embers.points)
  }
  update(e) {
    const t=this.o;
    this.age+=e*1e3;
    const n=t.linger??900,s=Math.min(1,this.age/t.duration),o=t.inner??0,r=1-Math.pow(1-s,2),i=o+10+(t.outer-o-10)*r,l=this.wallMat.uniforms;
    l.crest.value=i,l.height.value=(t.height??90)*Math.min(1,s/.15)*(1-.5*Math.max(0,(s-.7)/.3)),l.fade.value=s<1?Math.min(1,s/.1)*(1-Math.max(0,(s-.8)/.2)):0,l.time.value+=e;
    const d=this.groundMat.uniforms;
    d.crest.value=i,d.time.value+=e;
    const c=Math.max(0,this.age-t.duration);
    return d.fade.value=Math.min(1,this.age/120)*(1-Math.min(1,c/n)),d.heat.value=1-.7*Math.min(1,c/n),this.embers.update(e,s<.9?this.emberRate:0),this.age>=t.duration+n
  }
  dispose() {
    for(const e of this.mesh.children)e.geometry.dispose();
    this.wallMat.dispose(),this.groundMat.dispose(),this.embers.dispose()
  }
}
const _h=8,Pl=6,Hc=class Hc {
  constructor(e) {
    x(this,"mesh",new on);
    x(this,"flameMat");
    x(this,"groundMat");
    x(this,"embers");
    x(this,"age",0);
    x(this,"reach");
    this.o=e,this.reach=e.r;
    const t=Math.max(3,Math.round(e.r*e.r/700)),n=[],s=[],o=[],r=[],i=[],l=[];
    for(let h=0;h<t;h++) {
      const m=Math.random()*Math.PI*2,p=Math.sqrt(Math.random())*e.r*.8,g=Math.cos(m)*p,y=Math.sin(m)*p,f=Math.random()*10,v=8+Math.random()*8,b=(.45+Math.random()*.55)*Math.min(90,28+e.r*.6),_=h*(_h+1)*Pl;
      for(let S=0;S<=_h;S++)for(let M=0;M<Pl;M++)n.push(g,y,f),s.push(v,b),o.push(Math.PI*2*S/_h),r.push(M/(Pl-1)),i.push(0,0,0);
      for(let S=0;S<_h;S++)for(let M=0;M<Pl-1;M++) {
        const k=_+S*Pl+M,C=_+(S+1)*Pl+M;
        l.push(k,C,k+1,k+1,C,C+1)
      }
    }
    const d=new Jt;
    d.setAttribute("position",new Ce(i,3)),d.setAttribute("tongue",new Ce(n,3)),d.setAttribute("size",new Ce(s,2)),d.setAttribute("ang",new Ce(o,1)),d.setAttribute("hgt",new Ce(r,1)),d.setIndex(l),this.flameMat=oA(y6, {
      grow: {
        value:0
      }
    }),this.flameMat.uniforms.stretch.value=1.2;
    const c=new Ie(d,this.flameMat);
    c.renderOrder=5,c.frustumCulled=!1,this.groundMat=rA( {
      shape:"ring",outer:e.r,patch:!0
    });
    const u=iA(this.groundMat,e.r);
    this.embers=new Dv(Math.round(20+e.r*.6),55,h=> {
      const m=Math.random()*Math.PI*2,p=Math.sqrt(Math.random())*e.r;h.x=Math.cos(m)*p,h.z=Math.sin(m)*p,h.y=4+Math.random()*20,h.vx=(Math.random()-.5)*30,h.vz=(Math.random()-.5)*30,h.vy=50+Math.random()*110,h.life=600+Math.random()*900
    }),this.mesh.add(u,c,this.embers.points)
  }
  update(e) {
    this.age+=e*1e3;
    const {
      IN:t,OUT:n
    }
    =Hc,s=t+this.o.duration,o=this.age<t?this.age/t:this.age<s?1:Math.max(0,1-(this.age-s)/n),r=this.flameMat.uniforms;
    r.fade.value=o,r.grow.value=this.age<t?o:this.age<s?1:.4+.6*o,r.time.value+=e;
    const i=this.groundMat.uniforms;
    return i.fade.value=Math.min(1,this.age/t)*(this.age<s?1:Math.max(0,1-(this.age-s)/(n*1.6))),i.heat.value=this.age<s?1:o,i.time.value+=e,this.embers.update(e,this.age<s?10+this.o.r*.35:0),this.age>=s+n*1.6
  }
  dispose() {
    for(const e of this.mesh.children)e.geometry.dispose();
    this.flameMat.dispose(),this.groundMat.dispose(),this.embers.dispose()
  }
};
x(Hc,"IN",220),x(Hc,"OUT",500);
let My=Hc;
class x6 {
  constructor(e) {
    x(this,"mesh",new on);
    x(this,"head");
    x(this,"core");
    x(this,"trail");
    x(this,"age",0);
    x(this,"sx");
    x(this,"sy");
    x(this,"sz");
    this.o=e,this.sx=e.dx??-160,this.sz=e.dz??-60,this.sy=e.height??520;
    const t=e.size??800,n=()=> {
      const s=new Jt;
      return s.setAttribute("position",new Ce([0,0,0],3)),s
    };
    this.head=new Qi(n(),new Jc( {
      size:t,map:wy(),color:16742944,transparent:!0,depthWrite:!1,blending:Rt,sizeAttenuation:!0
    })),this.core=new Qi(n(),new Jc( {
      size:t*.45,map:wy(),color:16773824,transparent:!0,depthWrite:!1,blending:Rt,sizeAttenuation:!0
    }));
    for(const s of[this.head,this.core])s.renderOrder=7,s.frustumCulled=!1;
    this.trail=new Dv(80,t*.09,s=> {
      s.x=this.head.position.x+(Math.random()-.5)*20,s.y=this.head.position.y+(Math.random()-.5)*20,s.z=this.head.position.z+(Math.random()-.5)*20,s.vx=(Math.random()-.5)*40,s.vz=(Math.random()-.5)*40,s.vy=20+Math.random()*40,s.life=260+Math.random()*300
    }),this.mesh.add(this.trail.points,this.head,this.core),this.place(0)
  }
  place(e) {
    const t=e*e;
    for(const n of[this.head,this.core])n.position.set(this.sx*(1-t),this.sy*(1-t)+10,this.sz*(1-t))
  }
  update(e) {
    this.age+=e*1e3;
    const t=Math.min(1,this.age/this.o.duration);
    this.place(t);
    const n=.85+.15*Math.sin(this.age*.05);
    return this.head.material.opacity=n,this.trail.update(e,t<1?220:0),t>=1
  }
  dispose() {
    for(const e of[this.head,this.core])e.geometry.dispose(),e.material.dispose();
    this.trail.dispose()
  }
}
ia.enabled=!1;
const w6=28,M6=Td.prototype.dispose,S6=400;
let lA=null;
Ze.prototype.dispose=function() {
  const a=lA;
  if(a) {
    const e=this.vertexShader+`
//
`+this.fragmentShader,t=a.keepers.get(e);
    if(t===this)return;
    if(!t&&a.keepers.size<S6&&a.renderer.properties.get(this).programs!==void 0) {
      a.keepers.set(e,this);
      return
    }
  }
  M6.call(this)
};
const dA= {
  value:1
};
function Vb(a) {
  if(a.userData.fxFade||(a.userData.fxFade=!0,!a.transparent))return;
  const e=a.blending===gv&&a.blendSrc===yv,t=e?"gl_FragColor *= fxOpacity;":"gl_FragColor.a *= fxOpacity;",n=a.onBeforeCompile.bind(a),s=a.customProgramCacheKey.bind(a);
  a.onBeforeCompile=(o,r)=> {
    n(o,r),o.uniforms.fxOpacity=dA;
    const i=o.fragmentShader.lastIndexOf("}");
    o.fragmentShader=`uniform float fxOpacity;
${o.fragmentShader.slice(0,i)}  ${t}
}`
  },a.customProgramCacheKey=()=>`${s()}|fxfade${e?"-pre":""}`,a.needsUpdate=!0
}
function A6(a) {
  const e=Math.min(zs?1.5:2,window.devicePixelRatio||1);
  return a==="high"?e:a==="mid"?Math.min(1,e):.75
}
const tu=new WeakMap;
class k6 {
  constructor() {
    x(this,"refs",[]);
    x(this,"has",new WeakSet)
  }
  add(e) {
    this.has.has(e)||(this.has.add(e),this.refs.push(new WeakRef(e)))
  }
}
let Vr=null;
function E6(a) {
  Vr==null||Vr.add(a)
}
function C6(a) {
  const e=Vr!==a?Vr:null;
  for(const t of a.refs) {
    const n=t.deref();
    !n||e!=null&&e.has.has(n)||(n.dispose(),n.userData.ready=!1)
  }
  Vr===a&&(Vr=null)
}
let Xm=0,Hi=null;
const Wb=4,T6=3e4;
function no(a,e=!1) {
  let t=tu.get(a);
  if(t)_m(a)&&(Hi?Hi.push([a,t]):au(a,t));
  else {
    const n=t=new jn(a.resource);
    t.flipY=!1,t.colorSpace=ir,t.generateMipmaps=!1,t.minFilter=e?ks:os,t.magFilter=e?ks:os,t.needsUpdate=!0,_m(a)&&(n.onUpdate=()=> {
      n.image!==Yc&&(n.userData.gen=Xm,n.userData.ready=!0,Q2(a),n.image=Yc)
    }),tu.set(a,t),_m(a)&&Xc(a)&&(n.userData.ready=!1,Hi?Hi.push([a,t]):au(a,t))
  }
  return E6(t),t
}
function cA(a) {
  if(!_m(a)||!Xc(a))return!0;
  const e=tu.get(a);
  return!!e&&e.userData.ready===!0&&e.userData.gen===Xm
}
function au(a,e) {
  return Xc(a)?cA(a)?Promise.resolve():XR(a).then(()=>au(a,e),()=>{}):(a.resource!==Yc&&e.image!==a.resource&&(e.image=a.resource,e.needsUpdate=!0),Promise.resolve())
}
const Sy=12,P6=120,cu=`
  uniform vec3 envTint;
  uniform vec3 fogColor;
  uniform float fogAmount;
  uniform vec3 focus;
  uniform float viewRadius;
  uniform float playerLight;
  uniform float lightRadius;
  uniform float lightBoost;
  uniform float atmosTime;
  uniform vec2 farFog;
  uniform vec4 fireLights[${Sy}];
  varying vec3 vWorld;
  float atHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float atNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(atHash(i), atHash(i + vec2(1.0, 0.0)), u.x), mix(atHash(i + vec2(0.0, 1.0)), atHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  vec3 atmos(vec3 c) {
    c *= envTint;
    float d = distance(vWorld.xz, focus.xz);
    // de noche (o en el barco hundido), luz cálida alrededor del jugador
    float pl = playerLight * pow(max(0.0, 1.0 - d / lightRadius), 2.0);
    c += c * vec3(1.0, 0.82, 0.55) * pl * lightBoost;
    // fuegos del mapa: luz anaranjada alrededor de cada uno, que además abre la niebla
    float fire = 0.0;
    for (int i = 0; i < ${Sy}; i++) {
      vec4 L = fireLights[i];
      if (L.w <= 0.0) continue;
      float k = max(0.0, 1.0 - distance(vWorld.xz, L.xy) / L.z);
      fire += L.w * k * k;
    }
    c += c * vec3(1.0, 0.6, 0.28) * fire;
    // niebla: más densa hacia los bordes de la vista, en bancos que se mueven con el viento y en las zonas bajas
    vec2 q = vWorld.xz;
    float n = atNoise(q / 900.0 + vec2(atmosTime * 0.020, atmosTime * 0.011)) * 0.65 + atNoise(q / 320.0 - vec2(atmosTime * 0.035, -atmosTime * 0.02)) * 0.35;
    float radial = smoothstep(viewRadius * 0.25, viewRadius * 1.1, d);
    float low = 1.0 - clamp((vWorld.y - focus.y + 40.0) / 260.0, 0.0, 0.6);
    float f = fogAmount * clamp(radial * 0.7 + (n - 0.35) * 0.9 + 0.1, 0.0, 1.0) * low;
    f = clamp(f, 0.0, 0.92) * (1.0 - min(0.75, fire * 0.45));
    // tercera persona: a lo lejos todo se funde con la niebla (no se ve el borde del mapa ni el horizonte vacío)
    if (farFog.y > 0.0) {
      float end = farFog.y * mix(1.0, 0.55, fogAmount);
      float far = smoothstep(farFog.x, end, d);
      f = max(f, far * far * (3.0 - 2.0 * far));
    }
    return mix(c, fogColor, f);
  }`,$b=30,R6=1,z6=`
  uniform vec2 mapSize;
  attribute vec2 uvNext;
  varying vec2 vUv;
  varying vec2 vUvNext;
  varying vec2 vL;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vUvNext = uvNext;
    vL = position.xz / mapSize;
    vWorld = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,L6=`
  ${cu}
  uniform sampler2D atlas;
  uniform sampler2D shadowMap;
  uniform sampler2D lightMap;
  uniform vec3 groundLight;
  // cambio de tema del suelo (setGroundTheme): un frente que se abre desde themeOrigin con borde de runas brillante
  uniform vec3 themeWave; // x, z del origen y radio del frente (px); radio < 0 = sin cambio en marcha
  uniform vec3 themeGlow;
  varying vec2 vUv;
  varying vec2 vUvNext;
  varying vec2 vL;
  void main() {
    vec3 c = texture2D(atlas, vUv).rgb;
    vec3 glow = vec3(0.0);
    if (themeWave.z >= 0.0) {
      float n = atNoise(vWorld.xz * 0.012) * 180.0 + atNoise(vWorld.xz * 0.05) * 50.0;
      float d = distance(vWorld.xz, themeWave.xy) + n - themeWave.z;
      if (d < 0.0) c = texture2D(atlas, vUvNext).rgb;
      // borde fino y con chispas: runas que se encienden al paso del frente
      float edge = 1.0 - smoothstep(0.0, 42.0, abs(d));
      float spark = 0.55 + 0.45 * atNoise(vWorld.xz * 0.09 + themeWave.z * 0.01);
      glow = themeGlow * edge * edge * spark * 0.95;
    }
    c *= groundLight;
    float s = texture2D(shadowMap, vL).r;
    vec3 l = texture2D(lightMap, vL).rgb;
    gl_FragColor = vec4(atmos(c * s + l * 0.6) + glow, 1.0);
  }`,D6=`
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vN = normalize(normal);
    vWorld = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,F6=`
  ${cu}
  uniform sampler2D map;
  uniform vec3 lightDir;
  uniform vec3 ambient;
  uniform vec3 diffuse;
  varying vec2 vUv;
  varying vec3 vN;
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a < 0.5) discard;
    float d = abs(dot(normalize(vN), lightDir));
    vec3 c = t.rgb * min(vec3(1.0), ambient + diffuse * d * 0.85);
    gl_FragColor = vec4(atmos(c), 1.0);
  }`,I6=`
  uniform float time;
  uniform float waveHeight;
  uniform float wavePitch;
  uniform float waveSpeed;
  varying vec2 vW;
  varying vec3 vWorld;
  void main() {
    vec3 p = position;
    float cell = 64.0;
    p.y += sin((p.x / cell + p.z / cell) * wavePitch * 0.1 + time * waveSpeed) * waveHeight;
    vW = p.xz;
    vWorld = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`,B6=`
  ${cu}
  uniform sampler2D map;
  uniform float tile;
  varying vec2 vW;
  void main() {
    vec3 c = texture2D(map, vW / tile).rgb;
    gl_FragColor = vec4(atmos(c), 0.62);
  }`,N6=`
  attribute vec3 iCenter;
  attribute vec4 iRect;   // desplazamiento (x, y) y tamaño (w, h) en píxeles de pantalla; y hacia abajo
  attribute vec4 iUv;     // u0, v0, u1, v1
  attribute vec4 iColor;  // tinte y alfa
  attribute float iBias;  // empuje hacia la cámara para ordenar capas del mismo personaje
  uniform vec3 camRight;
  uniform vec3 camUp;
  uniform vec3 camBack;
  varying vec2 vUv;
  varying vec4 vColor;
  varying vec3 vWorld;
  void main() {
    vec2 c = position.xy;
    vec2 px = iRect.xy + c * iRect.zw;
    vec3 wp = iCenter + camRight * px.x - camUp * px.y + camBack * iBias;
    vUv = mix(iUv.xy, iUv.zw, c);
    vColor = iColor;
    vWorld = iCenter;
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`,U6=`
  ${cu}
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a < 0.08) discard;
    gl_FragColor = vec4(atmos(t.rgb * vColor.rgb), t.a * vColor.a);
  }`,q6=`
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a < 0.08) discard;
    float l = dot(t.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(vColor.rgb * (0.45 + 0.9 * l), t.a * vColor.a);
  }`;
function Fv(a) {
  return a.ghost=!0,a
}
class H6 {
  constructor(e,t,n=!1) {
    x(this,"mesh");
    x(this,"geo");
    x(this,"cap",0);
    x(this,"count",0);
    x(this,"lastUsed",performance.now());
    x(this,"center");
    x(this,"rect");
    x(this,"uv");
    x(this,"color");
    x(this,"bias");
    const s=new cs(1,1);
    this.geo=new US,this.geo.setAttribute("position",new Ce([0,0,0,1,0,0,0,1,0,1,1,0],3)),this.geo.setIndex([0,2,1,1,2,3]),s.dispose(),this.grow(64);
    const o=new Ze( {
      vertexShader:N6,fragmentShader:n?q6:U6,uniforms: {
        ...t,map: {
          value:e
        }
      },transparent:!0,depthWrite:!n,blending:n?Rt:Vo,side:rt
    });
    this.mesh=new Ie(this.geo,o),this.mesh.frustumCulled=!1,this.mesh.renderOrder=n?3:2
  }
  grow(e) {
    const t= {
      c:this.center,r:this.rect,u:this.uv,k:this.color,b:this.bias
    };
    this.cap=e,this.center=new Float32Array(e*3),this.rect=new Float32Array(e*4),this.uv=new Float32Array(e*4),this.color=new Float32Array(e*4),this.bias=new Float32Array(e),t.c&&(this.center.set(t.c),this.rect.set(t.r),this.uv.set(t.u),this.color.set(t.k),this.bias.set(t.b)),this.geo.setAttribute("iCenter",new io(this.center,3)),this.geo.setAttribute("iRect",new io(this.rect,4)),this.geo.setAttribute("iUv",new io(this.uv,4)),this.geo.setAttribute("iColor",new io(this.color,4)),this.geo.setAttribute("iBias",new io(this.bias,1)),uA(this.geo)
  }
  push(e,t,n,s,o,r,i,l,d,c,u,h,m,p) {
    this.count>=this.cap&&this.grow(this.cap*2);
    const g=this.count++;
    this.center.set([e,t,n],g*3),this.rect.set([s,o,r,i],g*4),this.uv.set([l,d,c,u],g*4),this.color.set([(h>>16&255)/255,(h>>8&255)/255,(h&255)/255,m],g*4),this.bias[g]=p
  }
  flush() {
    for(const e of["iCenter","iRect","iUv","iColor","iBias"])this.geo.getAttribute(e).needsUpdate=!0;
    this.geo.instanceCount=this.count,this.mesh.visible=this.count>0,this.count>0&&(this.lastUsed=performance.now())
  }
  dispose() {
    this.geo.dispose(),this.mesh.material.dispose()
  }
}
function uA(a) {
  a._maxInstanceCount=void 0
}
const O6=`
  attribute vec3 iCenter;
  attribute vec2 iSize;
  attribute vec4 iColor;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vUv = position.xy;
    vColor = iColor;
    vec3 wp = iCenter + vec3((position.x - 0.5) * 2.0 * iSize.x, 0.0, (position.y - 0.5) * 2.0 * iSize.y);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  }`,j6=`
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.55, d);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }`;
class Yb {
  constructor(e) {
    x(this,"mesh");
    x(this,"geo",new US);
    x(this,"cap",0);
    x(this,"count",0);
    x(this,"center");
    x(this,"size");
    x(this,"color");
    this.geo.setAttribute("position",new Ce([0,0,0,1,0,0,0,1,0,1,1,0],3)),this.geo.setIndex([0,2,1,1,2,3]),this.grow(128);
    const t=new Ze( {
      vertexShader:O6,fragmentShader:j6,transparent:!0,depthWrite:!1,side:rt,blending:e?Rt:Vo,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2
    });
    this.mesh=new Ie(this.geo,t),this.mesh.frustumCulled=!1,this.mesh.renderOrder=1
  }
  grow(e) {
    const t= {
      c:this.center,s:this.size,k:this.color
    };
    this.cap=e,this.center=new Float32Array(e*3),this.size=new Float32Array(e*2),this.color=new Float32Array(e*4),t.c&&(this.center.set(t.c),this.size.set(t.s),this.color.set(t.k)),this.geo.setAttribute("iCenter",new io(this.center,3)),this.geo.setAttribute("iSize",new io(this.size,2)),this.geo.setAttribute("iColor",new io(this.color,4)),uA(this.geo)
  }
  push(e,t,n,s,o,r,i) {
    this.count>=this.cap&&this.grow(this.cap*2);
    const l=this.count++;
    this.center.set([e,t,n],l*3),this.size.set([s,o],l*2),this.color.set([(r>>16&255)/255,(r>>8&255)/255,(r&255)/255,i],l*4)
  }
  flush() {
    for(const e of["iCenter","iSize","iColor"])this.geo.getAttribute(e).needsUpdate=!0;
    this.geo.instanceCount=this.count,this.mesh.visible=this.count>0
  }
  dispose() {
    this.geo.dispose(),this.mesh.material.dispose()
  }
}
class G6 {
  constructor(e,t=!0) {
    x(this,"x",0);
    x(this,"y",0);
    x(this,"size",64);
    x(this,"sizeY",NaN);
    x(this,"rotation",0);
    x(this,"alpha",1);
    x(this,"tint",16777215);
    x(this,"visible",!0);
    x(this,"mesh");
    x(this,"mat");
    x(this,"disposed",!1);
    const n=new cs(1,1);
    n.rotateX(-Math.PI/2),this.mat=new $o( {
      map:no(e.source,!0),transparent:!0,depthWrite:!1,side:rt,blending:t?Rt:Vo,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-3
    }),this.mesh=new Ie(n,this.mat),this.mesh.renderOrder=1,this.mesh.frustumCulled=!1
  }
  place(e) {
    this.mesh.visible=this.visible&&this.alpha>.01,this.mesh.position.set(this.x,e+1.5,this.y),this.mesh.rotation.y=-this.rotation,this.mesh.scale.set(this.size,1,Number.isNaN(this.sizeY)?this.size:this.sizeY),this.mat.opacity=Math.min(1,this.alpha),this.mat.color.setHex(this.tint)
  }
  dispose() {
    this.disposed=!0
  }
  free() {
    this.mesh.geometry.dispose(),this.mat.dispose()
  }
}
const hA=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,V6=`
  uniform int shape;
  uniform vec2 dims;
  uniform vec2 quad;
  uniform float halfAngle;
  uniform float progress;
  uniform float opacity;
  uniform float flash;
  uniform float time;
  uniform vec3 tint;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * quad;
    float d;
    float front;
    float R = dims.x * 0.5;
    if (shape == 0) {
      float r = length(p);
      d = r - R;
      front = r - R * progress;
    } else if (shape == 3) {
      // anillo (donut): halfAngle es el radio interior en fracción del exterior; se llena de dentro afuera
      float r = length(p);
      float Ri = R * halfAngle;
      d = max(r - R, Ri - r);
      front = r - (Ri + (R - Ri) * progress);
    } else if (shape == 1) {
      float r = length(p);
      float a = abs(atan(p.y, p.x));
      d = max(r - R, r * sin(clamp(a - halfAngle, -1.5, 1.5)));
      front = r - R * progress;
    } else {
      vec2 q = abs(p) - dims * 0.5;
      d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      front = (p.x + dims.x * 0.5) - dims.x * progress;
    }
    float aa = max(fwidth(d), 0.001);
    float inside = 1.0 - smoothstep(-aa, aa, d);
    // borde: línea fina nítida + halo a ambos lados
    float line = 1.0 - smoothstep(0.6, 0.6 + aa * 1.5, abs(d));
    float glow = exp(-abs(d) / 7.0);
    // relleno: tenue en el centro, más vivo cerca del borde, con un leve latido
    float body = inside * (0.07 + 0.16 * smoothstep(-R * 0.6, 0.0, d)) * (0.9 + 0.1 * sin(time * 9.0));
    // parte ya llenada y su frente brillante
    float faa = max(fwidth(front), 0.001);
    float filled = inside * (1.0 - smoothstep(-faa, faa, front));
    float frontGlow = inside * exp(-abs(front) / 5.0) * step(0.001, progress) * step(progress, 0.999);
    float a = body + filled * 0.2 + line * 0.9 + glow * 0.32 + frontGlow * 0.55 + flash * inside * 0.6;
    vec3 red = tint;
    vec3 hot = mix(tint, vec3(1.0), 0.6);
    vec3 col = mix(red, hot, clamp(line * 0.55 + frontGlow * 0.7 + flash, 0.0, 1.0));
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * opacity);
  }
`;
class W6 {
  constructor(e,t=0) {
    x(this,"x",0);
    x(this,"y",0);
    x(this,"rotation",0);
    x(this,"w",64);
    x(this,"h",64);
    x(this,"progress",0);
    x(this,"alpha",1);
    x(this,"flash",0);
    x(this,"visible",!0);
    x(this,"disposed",!1);
    x(this,"mesh");
    x(this,"mat");
    x(this,"born",performance.now());
    const n=new cs(1,1);
    n.rotateX(-Math.PI/2),this.mat=new Ze( {
      vertexShader:hA,fragmentShader:V6,uniforms: {
        shape: {
          value:e==="circle"?0:e==="cone"?1:e==="ring"?3:2
        },dims: {
          value:new Ae(64,64)
        },quad: {
          value:new Ae(64,64)
        },halfAngle: {
          value:t
        },progress: {
          value:0
        },opacity: {
          value:1
        },flash: {
          value:0
        },time: {
          value:0
        },tint: {
          value:new F(1,.18,.1)
        }
      },transparent:!0,depthWrite:!1,side:rt,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-3
    }),this.mesh=new Ie(n,this.mat),this.mesh.renderOrder=1,this.mesh.frustumCulled=!1
  }
  get size() {
    return Math.max(this.w,this.h)
  }
  place(e) {
    this.mesh.visible=this.visible&&this.alpha>.01,this.mesh.position.set(this.x,e+1.5,this.y),this.mesh.rotation.y=-this.rotation;
    const t=16;
    this.mesh.scale.set(this.w+t,1,this.h+t);
    const n=this.mat.uniforms;
    n.dims.value.set(this.w,this.h),n.quad.value.set(this.w+t,this.h+t),n.progress.value=this.progress,n.opacity.value=Math.min(1,this.alpha),n.flash.value=this.flash,n.time.value=(performance.now()-this.born)/1e3
  }
  setTint(e,t,n) {
    this.mat.uniforms.tint.value.set(e,t,n)
  }
  dispose() {
    this.disposed=!0
  }
  free() {
    this.mesh.geometry.dispose(),this.mat.dispose()
  }
}
const $6=`
  uniform int shape;
  uniform vec2 quad;
  uniform float outer;
  uniform float inner;
  uniform float halfAngle;
  uniform float progress;
  uniform float time;
  varying vec2 vUv;
  float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x), mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    vec2 p = (vUv - 0.5) * quad;
    float r = length(p);
    float a = abs(atan(p.y, p.x));
    // dentro de la zona, con bordes suaves
    float edge = smoothstep(inner - 6.0, inner + 2.0, r) * (1.0 - smoothstep(outer - 2.0, outer + 6.0, r));
    if (shape == 1) edge *= 1.0 - smoothstep(halfAngle - 0.04, halfAngle + 0.02, a);
    if (edge <= 0.0) discard;
    float k = 1.0 - pow(1.0 - progress, 2.0);
    float crest = mix(inner, outer, k);
    // la cresta se ondula con ruido para no ser un arco perfecto
    float wob = (wNoise(vec2(a * 9.0, time * 2.0)) - 0.5) * 14.0;
    float dc = r - crest - wob;
    float foam = exp(-abs(dc) / 7.0) * (0.75 + 0.25 * wNoise(p * 0.15 + time * 3.0));
    // estela: agua detrás de la cresta, más clara cerca de ella
    float wake = dc < 0.0 ? exp(dc / (0.4 * (outer - inner) + 24.0)) : 0.0;
    float ripple = 0.5 + 0.5 * sin(r * 0.09 - time * 7.0 + wNoise(p * 0.04) * 4.0);
    vec3 deep = vec3(0.04, 0.22, 0.32);
    vec3 light = vec3(0.36, 0.74, 0.9);
    vec3 col = mix(deep, light, ripple * 0.6 + wake * 0.4);
    col = mix(col, vec3(0.92, 0.97, 1.0), clamp(foam * 1.3, 0.0, 1.0));
    float fade = 1.0 - smoothstep(0.7, 1.0, progress);
    float alpha = edge * clamp(wake * 0.85 + foam * 0.95, 0.0, 1.0) * fade;
    gl_FragColor = vec4(col, alpha);
  }
`,Y6=`
  attribute vec2 prof;   // sección: desplazamiento radial (en grosores) y altura (0..1)
  attribute float ang;   // ángulo en el suelo (0 = +x)
  attribute float along; // 0..1 a lo largo del arco (para apagar los extremos del cono)
  uniform float crest;
  uniform float thick;
  uniform float height;
  uniform float time;
  varying vec2 vProf;
  varying float vAlong;
  varying float vAng;
  void main() {
    // la cresta se ondula a lo largo del arco y con el tiempo, como agua de verdad
    float wob = sin(ang * 7.0 + time * 4.0) * 0.09 + sin(ang * 13.0 - time * 6.0) * 0.05;
    float r = crest + prof.x * thick * (1.0 + wob * 0.5);
    float y = prof.y * height * (1.0 + wob);
    vProf = prof;
    vAlong = along;
    vAng = ang;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(cos(ang) * r, y, sin(ang) * r, 1.0);
  }
`,X6=`
  uniform float time;
  uniform float fade;
  uniform float arc;
  varying vec2 vProf;
  varying float vAlong;
  varying float vAng;
  float nHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float nNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(nHash(i), nHash(i + vec2(1.0, 0.0)), u.x), mix(nHash(i + vec2(0.0, 1.0)), nHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    float h = vProf.y;
    float front = smoothstep(0.0, 0.6, vProf.x);
    // agua revuelta que sube por la cara de la ola (ruido, no franjas regulares)
    vec2 q = vec2(vAng * 26.0, h * 5.0 - time * 2.6);
    float streak = nNoise(q) * 0.65 + nNoise(q * 2.3 + 7.0) * 0.35;
    vec3 deep = vec3(0.03, 0.2, 0.3);
    vec3 light = vec3(0.3, 0.72, 0.88);
    vec3 col = mix(deep, light, clamp(h * 0.75 + (streak - 0.5) * 0.5, 0.0, 1.0));
    // espuma en la cresta y en el labio, con algo de ruido
    float foam = smoothstep(0.72, 0.95, h) + front * smoothstep(0.4, 0.8, h) * 0.8;
    foam *= 0.6 + 0.6 * nNoise(vec2(vAng * 60.0, h * 8.0 - time * 5.0));
    col = mix(col, vec3(0.94, 0.98, 1.0), clamp(foam, 0.0, 1.0));
    // en los extremos del cono se deshace
    float ends = arc > 0.5 ? smoothstep(0.0, 0.1, vAlong) * smoothstep(1.0, 0.9, vAlong) : 1.0;
    float a = (0.55 + 0.35 * h + foam * 0.3) * smoothstep(0.0, 0.12, h + 0.02) * ends * fade;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }
`,Xb=[[-1.2,0],[-.9,.12],[-.6,.32],[-.3,.58],[-.05,.84],[.15,1],[.32,1.02],[.46,.94],[.55,.8],[.58,.64],[.52,.5]];
let bh=null;
function K6() {
  if(bh)return bh;
  const a=document.createElement("canvas");
  a.width=a.height=32;
  const e=a.getContext("2d"),t=e.createRadialGradient(16,16,0,16,16,16);
  return t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.35,"rgba(230,246,255,0.85)"),t.addColorStop(1,"rgba(200,235,255,0)"),e.fillStyle=t,e.fillRect(0,0,32,32),bh=oi(new pp(a)),bh
}
const J6=760;
class Q6 {
  constructor(e) {
    x(this,"mesh");
    x(this,"mat");
    x(this,"age",0);
    x(this,"drops",[]);
    x(this,"spray");
    this.o=e;
    const t=e.shape==="cone",n=t?(e.angle??0)-(e.half??0):0,s=t?2*(e.half??0):Math.PI*2,o=Math.max(10,Math.ceil(s/(Math.PI/48))),r=[],i=[],l=[],d=[];
    for(let g=0;g<=o;g++)for(const[y,f]of Xb)r.push(y,f),i.push(n+s*g/o),l.push(g/o),d.push(0,0,0);
    const c=[],u=Xb.length;
    for(let g=0;g<o;g++)for(let y=0;y<u-1;y++) {
      const f=g*u+y,v=(g+1)*u+y;
      c.push(f,v,f+1,f+1,v,v+1)
    }
    const h=new Jt;
    h.setAttribute("position",new Ce(d,3)),h.setAttribute("prof",new Ce(r,2)),h.setAttribute("ang",new Ce(i,1)),h.setAttribute("along",new Ce(l,1)),h.setIndex(c),this.mat=new Ze( {
      vertexShader:Y6,fragmentShader:X6,uniforms: {
        crest: {
          value:0
        },thick: {
          value:Math.max(26,Math.min(60,(e.outer-(e.inner??0))*.3))
        },height: {
          value:0
        },time: {
          value:Math.random()*10
        },fade: {
          value:1
        },arc: {
          value:t?1:0
        }
      },transparent:!0,depthWrite:!1,side:rt
    }),this.mesh=new Ie(h,this.mat),this.mesh.renderOrder=4,this.mesh.frustumCulled=!1;
    const m=Math.round(Math.max(90,380*s/(Math.PI*2)));
    for(let g=0;g<m;g++)this.drops.push( {
      a:n+Math.random()*s,t0:Math.random()*e.duration*.72,life:450+Math.random()*450,vr:40+Math.random()*150,vy:120+Math.random()*200,r0:0,y0:0,born:!1
    });
    const p=new Jt;
    p.setAttribute("position",new Ce(new Float32Array(m*3),3)),p.setAttribute("color",new Ce(new Float32Array(m*3),3)),this.spray=new Qi(p,new Jc( {
      size:15,map:K6(),vertexColors:!0,transparent:!0,depthWrite:!1,blending:Rt,sizeAttenuation:!0
    })),this.spray.renderOrder=5,this.spray.frustumCulled=!1,this.mesh.add(this.spray)
  }
  update(e) {
    const t=this.o;
    this.age+=e*1e3;
    const n=Math.min(1,this.age/t.duration),s=this.mat.uniforms,o=1-Math.pow(1-n,2);
    s.crest.value=Math.max((t.inner??0)+18,(t.inner??0)+(t.outer-(t.inner??0))*o);
    const r=t.height??70;
    s.height.value=r*Math.min(1,n/.18)*(1-.6*Math.max(0,(n-.65)/.35)),s.fade.value=1-Math.max(0,(n-.75)/.25),s.time.value+=e;
    const i=this.spray.geometry.getAttribute("position"),l=this.spray.geometry.getAttribute("color");
    return this.drops.forEach((d,c)=> {
      const u=this.age-d.t0;if(u<0||u>d.life) {
        l.setXYZ(c,0,0,0);return
      }
      d.born||(d.born=!0,d.r0=s.crest.value+(Math.random()-.3)*14,d.y0=s.height.value*(.55+Math.random()*.45));const h=u/1e3,m=d.r0+d.vr*h,p=Math.max(0,d.y0+d.vy*h-.5*J6*h*h);i.setXYZ(c,Math.cos(d.a)*m,p,Math.sin(d.a)*m);const g=Math.pow(1-u/d.life,1.3)*(p>0?1:.4);l.setXYZ(c,.95*g,1*g,1*g)
    }),i.needsUpdate=!0,l.needsUpdate=!0,this.age>=t.duration
  }
  dispose() {
    this.mesh.geometry.dispose(),this.mat.dispose(),this.spray.geometry.dispose(),this.spray.material.dispose()
  }
}
class Z6 {
  constructor(e) {
    x(this,"mesh");
    x(this,"mat");
    x(this,"age",0);
    x(this,"duration");
    this.duration=e.duration;
    const t=2*e.outer+24,n=new cs(t,t);
    n.rotateX(-Math.PI/2),this.mat=new Ze( {
      vertexShader:hA,fragmentShader:$6,uniforms: {
        shape: {
          value:e.shape==="cone"?1:0
        },quad: {
          value:new Ae(t,t)
        },outer: {
          value:e.outer
        },inner: {
          value:e.inner??0
        },halfAngle: {
          value:e.half??Math.PI
        },progress: {
          value:0
        },time: {
          value:Math.random()*10
        }
      },transparent:!0,depthWrite:!1,side:rt,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4
    }),this.mesh=new Ie(n,this.mat),this.mesh.rotation.y=-(e.angle??0),this.mesh.renderOrder=2,this.mesh.frustumCulled=!1
  }
  update(e) {
    return this.age+=e*1e3,this.mat.uniforms.progress.value=Math.min(1,this.age/this.duration),this.mat.uniforms.time.value+=e,this.age>=this.duration
  }
  dispose() {
    this.mesh.geometry.dispose(),this.mat.dispose()
  }
}
class eN {
  constructor(e) {
    x(this,"mesh");
    x(this,"mat");
    x(this,"age",0);
    x(this,"opts");
    this.opts=e;
    const t=new Fo(Math.max(.5,e.top),Math.max(.5,e.bottom),Math.max(1,e.height),36,1,!0);
    t.translate(0,Math.max(1,e.height)/2,0);
    const n=t.attributes.uv;
    for(let o=0;o<n.count;o++)n.setY(o,1-n.getY(o));
    const s=e.color??[1,1,1];
    this.mat=new $o( {
      map:no(e.texture.source,!0),color:new St(s[0],s[1],s[2]),transparent:!0,opacity:0,blending:Rt,depthWrite:!1,side:rt
    }),this.mesh=new Ie(t,this.mat),this.mesh.renderOrder=3,this.mesh.frustumCulled=!1,this.mesh.visible=!1
  }
  update(e,t) {
    const n=this.opts;
    this.age+=e*1e3;
    const s=this.age-(n.delay??0);
    if(s<0)return!1;
    const o=Math.min(1,s/n.duration);
    if(n.follow) {
      const d=n.follow();
      this.mesh.position.copy(t(d.x,d.y))
    }
    this.mesh.visible=!0;
    const r=n.animation??0,i=Math.min(1,o*2.2);
    this.mesh.scale.set(r===2?i:r===4?.5+.5*i:1,r===1?i:1,r===2?i:r===4?.5+.5*i:1),n.rotate&&(this.mesh.rotation.y+=e*2.4);
    const l=n.alpha??1;
    return this.mat.opacity=n.fade?l*(o<.15?o/.15:1-(o-.15)/.85):l*(o>.85?(1-o)/.15:1),o>=1
  }
  dispose() {
    this.mesh.geometry.dispose(),this.mat.dispose()
  }
}
const tN=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,aN=`
  uniform vec3 color;
  uniform float alpha;
  uniform float time;
  varying vec2 vUv;
  void main() {
    // intenso abajo y desvanecido hacia arriba, con un pulso suave y un brillo que sube
    float fade = pow(1.0 - vUv.y, 1.6);
    float pulse = 0.82 + 0.18 * sin(time * 3.0);
    float rise = 0.25 * smoothstep(0.0, 0.15, fract(vUv.y * 1.5 - time * 0.6)) * (1.0 - smoothstep(0.15, 0.3, fract(vUv.y * 1.5 - time * 0.6)));
    float k = fade * pulse + rise * fade;
    gl_FragColor = vec4(color * k * alpha, k * alpha);
  }`;
class nN {
  constructor(e) {
    x(this,"group",new on);
    x(this,"mats",[]);
    x(this,"age",0);
    const t=new St(e);
    for(const[n,s,o,r]of[[16,200,.55,!1],[4.5,260,.6,!0]]) {
      const i=new Fo(n,n,s,20,1,!0);
      i.translate(0,s/2,0);
      const l=new Ze( {
        vertexShader:tN,fragmentShader:aN,uniforms: {
          color: {
            value:t
          },alpha: {
            value:o
          },time: {
            value:Math.random()*10
          }
        },transparent:!0,depthWrite:!1,blending:r?Rt:gv,blendSrc:yv,blendDst:Om,side:rt
      });
      l.userData.alpha=o,this.mats.push(l);
      const d=new Ie(i,l);
      d.frustumCulled=!1,d.renderOrder=3,this.group.add(d)
    }
  }
  update(e) {
    this.age+=e;
    const t=Math.min(1,this.age/.35);
    this.group.scale.set(1+(1-t)*1.5,t,1+(1-t)*1.5);
    const n=this.age<.35?1.6-t*.6:1;
    for(const s of this.mats)s.uniforms.time.value+=e,s.uniforms.alpha.value=s.userData.alpha*n
  }
  dispose() {
    for(const e of this.group.children)e.geometry.dispose();
    for(const e of this.mats)e.dispose()
  }
}
function el(a,e,t=0,n=.35) {
  return a.decal= {
    kind:e,color:t,alpha:n
  },a
}
const sN=.75;
class WV {
  constructor(e,t) {
    x(this,"textures",Vr=new k6);
    x(this,"renderer");
    x(this,"scene",new kS);
    x(this,"hanging",new on);
    x(this,"perspective",new ro(45,1,4,3e4));
    x(this,"tmpV",new F);
    x(this,"fwd",new F);
    x(this,"map");
    x(this,"hScale");
    x(this,"batches",new Map);
    x(this,"ghostBatches",new Map);
    x(this,"shadows",new Yb(!1));
    x(this,"glows",new Yb(!0));
    x(this,"shared");
    x(this,"atmos", {
      envTint: {
        value:new F(1,1,1)
      },fogColor: {
        value:new F(.8,.84,.9)
      },fogAmount: {
        value:0
      },focus: {
        value:new F
      },viewRadius: {
        value:1e3
      },playerLight: {
        value:0
      },lightRadius: {
        value:300
      },lightBoost: {
        value:1.7
      },atmosTime: {
        value:0
      },farFog: {
        value:new Ae(0,0)
      },fireLights: {
        value:Array.from( {
          length:Sy
        },()=>new Oa(0,0,1,0))
      }
    });
    x(this,"terrainMaterial");
    x(this,"cylinders",[]);
    x(this,"beams",new Set);
    x(this,"groundSprites",[]);
    x(this,"lastFx",performance.now());
    x(this,"modelMaterials",[]);
    x(this,"waterMaterial",null);
    x(this,"waterFrames",[]);
    x(this,"onResize");
    x(this,"offSettings");
    x(this,"target",new F);
    x(this,"keep",new WeakSet);
    x(this,"altar",null);
    x(this,"cosmos",null);
    x(this,"themeModels",new Map);
    x(this,"waterMesh",null);
    x(this,"floorChunks",[]);
    x(this,"themeAnim",null);
    x(this,"footprint",[]);
    x(this,"footprintMax",1e3);
    x(this,"cellCursor",null);
    x(this,"nextPrune",0);
    x(this,"restoring",null);
    x(this,"gone",!1);
    this.map=e,this.hScale=ra/e.zoom,this.renderer=new BB( {
      antialias:!1,alpha:!1
    }),lA= {
      renderer:this.renderer,keepers:new Map
    },this.renderer.setSize(window.innerWidth,window.innerHeight),this.renderer.setClearColor(329484),this.renderer.outputColorSpace=Ji;
    const n=this.renderer.domElement;
    n.classList.add("world3d"),t.prepend(n),Xm++,Hi=[],n.addEventListener("webglcontextrestored",()=> {
      this.cosmos&&this.cosmos.rebake(this.renderer),Xm++;const s=[];for(const r of YR()) {
        const i=tu.get(r);i&&s.push(au(r,i))
      }
      const o=this.restoring=Promise.all(s).then(()=> {
        this.restoring===o&&(this.restoring=null)
      })
    });
    for(const s of xt.sheets.values()) {
      const o=s.lazySource;
      o&&!Xc(o)&&this.renderer.initTexture(no(o))
    }
    this.shared= {
      camRight: {
        value:new F(1,0,0)
      },camUp: {
        value:new F(0,1/Bb,0)
      },camBack: {
        value:new F(0,Ib,Bb)
      },...this.atmos
    },this.terrainMaterial=new Ze( {
      vertexShader:z6,fragmentShader:L6,uniforms: {
        atlas: {
          value:no(e.atlas.source,!0)
        },shadowMap: {
          value:no(e.shadow.source,!0)
        },lightMap: {
          value:no(e.light.source,!0)
        },groundLight: {
          value:new F(1,1,1)
        },themeWave: {
          value:new F(0,0,-1)
        },themeGlow: {
          value:new F(.6,1,.75)
        },mapSize: {
          value:new Ae(e.width*ra,e.height*ra)
        },...this.atmos
      },side:rt
    });
    try {
      this.buildTerrain(),this.buildModels(),this.buildWater()
    }
    finally {
      const s=Hi??[];
      if(Hi=null,s.length) {
        const o=this.restoring=this.uploadInBatches(s).then(()=> {
          this.restoring===o&&(this.restoring=null)
        })
      }
    }
    this.scene.add(this.shadows.mesh,this.glows.mesh,this.hanging);
    for(const s of this.scene.children)this.keep.add(s);
    this.offSettings=pv(s=> {
      dA.value=s.fxOpacity;const o=A6(s.resolution);this.renderer.getPixelRatio()!==o&&this.renderer.setPixelRatio(o)
    }),this.onResize=()=>this.renderer.setSize(window.innerWidth,window.innerHeight),window.addEventListener("resize",this.onResize)
  }
  useRswGroundLight() {
    const e=this.map.models;
    if(!e)return;
    const t=Math.sin(e.light.latitude*(Math.PI/180)),n=[0,1,2].map(s=>Math.min(1,e.light.ambient[s]+e.light.diffuse[s]*t));
    this.terrainMaterial.uniforms.groundLight.value.set(n[0],n[1],n[2])
  }
  setGroundLight(e) {
    const t=new St(e);
    this.terrainMaterial.uniforms.groundLight.value.set(t.r,t.g,t.b)
  }
  heightAt(e,t) {
    var v;
    const n=(v=this.altar)==null?void 0:v.heightAt(e,t);
    if(n!=null)return n;
    const s=this.map.altitude, {
      width:o,height:r,heights:i
    }
    =s? {
      width:s.w,height:s.h,heights:s.heights
    }
    :this.map,l=s?ra/2:ra,d=e/l,c=t/l,u=Math.min(o-1,Math.max(0,Math.floor(d))),h=Math.min(r-1,Math.max(0,Math.floor(c))),m=Math.min(1,Math.max(0,d-u)),p=Math.min(1,Math.max(0,c-h)),g=(h*o+u)*4,y=i[g]*(1-m)+i[g+1]*m,f=i[g+2]*(1-m)+i[g+3]*m;
    return-(y*(1-p)+f*p)*this.hScale
  }
  buildTerrain() {
    const {
      width:e,height:t,cells:n,heights:s,walls:o
    }
    =this.map,r=this.hScale,i=50;
    for(let y=0;y<t;y+=i)for(let f=0;f<e;f+=i) {
      const v=[],b=[],_=[],S=[];
      for(let M=y;M<Math.min(t,y+i);M++)for(let k=f;k<Math.min(e,f+i);k++) {
        const C=(M*e+k)*8;
        if(Number.isNaN(n[C]))continue;
        const A=(M*e+k)*4,w=v.length/3,T=k*ra,z=M*ra;
        v.push(T,-s[A]*r,z,T+ra,-s[A+1]*r,z,T,-s[A+2]*r,z+ra,T+ra,-s[A+3]*r,z+ra);
        for(let L=0;L<8;L++)b.push(n[C+L]);
        _.push(w,w+2,w+1,w+1,w+2,w+3),S.push(C)
      }
      _.length&&this.floorChunks.push( {
        geo:this.addMesh(v,b,_),at:S
      })
    }
    const l=[],d=[],c=[],u=this.map.name==="endless";
    let h=1/0,m=-1/0,p=1/0,g=-1/0;
    for(let y=0;y<o.length;y+=20) {
      if(u) {
        for(const v of[0,1])h=Math.min(h,o[y+v*3]),m=Math.max(m,o[y+v*3]),p=Math.min(p,o[y+v*3+1]),g=Math.max(g,o[y+v*3+1]);
        for(let v=0;v<R6;v++) {
          const b=l.length/3,_=v*$b;
          for(let S=0;S<4;S++)l.push(o[y+S*3]*ra,-(_+(S<2?0:$b))*r,o[y+S*3+1]*ra);
          for(let S=0;S<8;S++)d.push(o[y+12+S]);
          c.push(b,b+1,b+2,b+1,b+3,b+2)
        }
        continue
      }
      const f=l.length/3;
      for(let v=0;v<4;v++)l.push(o[y+v*3]*ra,-o[y+v*3+2]*r,o[y+v*3+1]*ra);
      for(let v=0;v<8;v++)d.push(o[y+12+v]);
      c.push(f,f+1,f+2,f+1,f+3,f+2)
    }
    c.length&&this.addMesh(l,d,c),u&&Number.isFinite(h)&&(this.cosmos=new r6(this.scene,this.renderer,(h+m)/2*ra,(p+g)/2*ra,Math.max(m-h,g-p)*ra),this.renderer.setClearColor(591900),this.buildAltar())
  }
  buildAltar() {
    const {
      width:e,cells:t
    }
    =this.map,n=(d,c,u)=> {
      let h=1/0,m=-1/0,p=1/0,g=-1/0;
      for(let y=c;y<c+u;y++)for(let f=d;f<d+u;f++) {
        const v=(y*e+f)*8;
        for(let b=0;b<4;b++) {
          const _=t[v+b*2],S=t[v+b*2+1];
          if(Number.isNaN(_))return null;
          h=Math.min(h,_),m=Math.max(m,_),p=Math.min(p,S),g=Math.max(g,S)
        }
      }
      return new Oa(h,p,m-h,g-p)
    },s=Math.floor(e/2),o=n(s-2,s-2,4),r=n(s+6,s+6,2);
    if(!o||!r)return;
    const i=e/2*ra,l=this.map.height/2*ra;
    this.altar=new p6(this.scene, {
      x:i,z:l,ground:this.heightAt(i,l),atlas:this.terrainMaterial.uniforms.atlas.value,stone:r,circle:o,atmosGlsl:cu,atmosUniforms:this.atmos,groundLight:this.terrainMaterial.uniforms.groundLight
    })
  }
  buildModels() {
    const e=this.map.models;
    if(!e)return;
    const {
      width:t,height:n
    }
    =this.map,s=this.map.zoom,o=this.hScale,r=Math.PI/180,i=new Map,l=new Map,d=new ya,c=new ya,u=new F,h=new Map;
    for(const f of e.instances) {
      const v=e.models[f.m];
      d.makeScale(o,o,o),d.multiply(c.makeTranslation(t*s/2+f.pos[0],-f.pos[1],n*s/2-f.pos[2])),d.multiply(c.makeRotationZ(-f.rot[2]*r)),d.multiply(c.makeRotationX(f.rot[0]*r)),d.multiply(c.makeRotationY(-f.rot[1]*r)),d.multiply(c.makeScale(f.scale[0],-f.scale[1],-f.scale[2]));
      const b=v.meshes.map(A=> {
        const w=[],T=[];for(let z=0;z<A.count;z++) {
          const L=A.offset+z*5;u.set(e.data[L],e.data[L+1],e.data[L+2]).applyMatrix4(d),w.push(u.x,u.y,u.z),T.push(e.data[L+3],e.data[L+4])
        }
        return {
          tex:A.tex,pos:w,uv:T
        }
      });
      let[_,S,M,k]=[1/0,0,0,0];
      for(const A of b)for(let w=0;w<A.pos.length;w+=3)_=Math.min(_,A.pos[w+1]),S+=A.pos[w],M+=A.pos[w+2],k++;
      const C=k>0&&_-this.heightAt(S/k,M/k)>P6;
      for(const A of b) {
        let w=C?l:i;
        if(f.theme) {
          let z=h.get(f.theme);
          z||h.set(f.theme,z=new Map),w=z
        }
        let T=w.get(A.tex);
        T||w.set(A.tex,T= {
          pos:[],uv:[]
        }),T.pos.push(...A.pos),T.uv.push(...A.uv)
      }
    }
    const m=e.light.longitude*r,p=e.light.latitude*r,g=new F(-Math.cos(p)*Math.sin(m),Math.sin(p),Math.cos(p)*Math.cos(m)).normalize(),y=[...[...i].map(([f,v])=>[f,v,!1,null]),...[...l].map(([f,v])=>[f,v,!0,null]),...[...h].flatMap(([f,v])=>[...v].map(([b,_])=>[b,_,!1,f]))];
    for(const[f,v,b,_]of y) {
      const S=new Jt;
      S.setAttribute("position",new Ce(v.pos,3)),S.setAttribute("uv",new Ce(v.uv,2)),S.computeVertexNormals();
      const M=new Ze( {
        vertexShader:D6,fragmentShader:F6,uniforms: {
          map: {
            value:no(e.textures[f].source,!0)
          },lightDir: {
            value:g
          },ambient: {
            value:new F(...e.light.ambient)
          },diffuse: {
            value:new F(...e.light.diffuse)
          },...this.atmos
        },side:rt
      }),k=new Ie(S,M);
      if(k.renderOrder=0,(b?this.hanging:this.scene).add(k),this.modelMaterials.push(M),_) {
        k.visible=!1;
        let C=this.themeModels.get(_);
        C||this.themeModels.set(_,C=[]),C.push(k)
      }
    }
  }
  setArenaTheme(e) {
    var s,o;
    for(const[r,i]of this.themeModels)for(const l of i)l.visible=r===e;
    const t=(o=(s=this.map.models)==null?void 0:s.themeWater)==null?void 0:o[e];
    if(!this.waterMesh||!this.waterMaterial||(this.waterMesh.visible=!!t,!t))return;
    this.waterFrames=t.frames.map(r=> {
      const i=no(r.source,!0);return i.wrapS=i.wrapT=Xi,i.needsUpdate=!0,i
    });
    const n=this.waterMaterial.uniforms;
    n.map.value=this.waterFrames[0],n.waveHeight.value=t.waveHeight*this.hScale,n.wavePitch.value=t.wavePitch*Math.PI/180,n.waveSpeed.value=t.waveSpeed
  }
  buildWater() {
    const e=this.map.models,t=e==null?void 0:e.water,n=e!=null&&e.themeWater?Object.values(e.themeWater)[0]:null;
    if(!e||!t||!e.waterTextures.length&&!n)return;
    const {
      width:s,height:o,cells:r,heights:i
    }
    =this.map,l=-t.level*this.hScale,d=[],c=[];
    for(let m=0;m<o;m++)for(let p=0;p<s;p++) {
      const g=m*s+p;
      if(Number.isNaN(r[g*8])||Math.max(i[g*4],i[g*4+1],i[g*4+2],i[g*4+3])<t.level-t.waveHeight-1)continue;
      const y=d.length/3;
      d.push(p*ra,l,m*ra,(p+1)*ra,l,m*ra,p*ra,l,(m+1)*ra,(p+1)*ra,l,(m+1)*ra),c.push(y,y+2,y+1,y+1,y+2,y+3)
    }
    if(!c.length)return;
    const u=new Jt;
    u.setAttribute("position",new Ce(d,3)),u.setIndex(c),this.waterFrames=(e.waterTextures.length?e.waterTextures:n.frames).map(m=> {
      const p=no(m.source,!0);return p.wrapS=p.wrapT=Xi,p.needsUpdate=!0,p
    }),this.waterMaterial=new Ze( {
      vertexShader:I6,fragmentShader:B6,uniforms: {
        map: {
          value:this.waterFrames[0]
        },time: {
          value:0
        },waveHeight: {
          value:t.waveHeight*this.hScale
        },wavePitch: {
          value:t.wavePitch*Math.PI/180
        },waveSpeed: {
          value:t.waveSpeed
        },tile: {
          value:ra*4
        },...this.atmos
      },transparent:!0,depthWrite:!1
    });
    const h=new Ie(u,this.waterMaterial);
    h.renderOrder=1,this.scene.add(h),this.waterMesh=h,e.themeWater&&(h.visible=!1)
  }
  addMesh(e,t,n) {
    const s=new Jt;
    s.setAttribute("position",new Ce(e,3)),s.setAttribute("uv",new Ce(t,2)),s.setAttribute("uvNext",new Ce(t,2)),s.setIndex(n);
    const o=new Ie(s,this.terrainMaterial);
    return o.renderOrder=0,this.scene.add(o),s
  }
  setGroundTheme(e,t,n,s=2.2,o=11075528,r) {
    var u;
    (u=this.altar)==null||u.setGlow(o),this.finishGroundTheme();
    for(const {
      geo:h,at:m
    }
    of this.floorChunks) {
      const p=h.getAttribute("uvNext");
      m.forEach((g,y)=> {
        for(let f=0;f<4;f++)p.setXY(y*4+f,e[g+f*2],e[g+f*2+1])
      }),p.needsUpdate=!0
    }
    const i=this.map.width*ra,l=this.map.height*ra,d=Math.max(Math.hypot(t,n),Math.hypot(i-t,n),Math.hypot(t,l-n),Math.hypot(i-t,l-n))+260,c=new St(o);
    this.terrainMaterial.uniforms.themeGlow.value.set(c.r,c.g,c.b),this.themeAnim= {
      x:t,y:n,start:performance.now(),secs:s,reach:d,done:r
    },this.terrainMaterial.uniforms.themeWave.value.set(t,n,0)
  }
  finishGroundTheme() {
    var t;
    const e=this.themeAnim;
    if(e) {
      this.themeAnim=null;
      for(const {
        geo:n
      }
      of this.floorChunks) {
        const s=n.getAttribute("uv");
        s.array.set(n.getAttribute("uvNext").array),s.needsUpdate=!0
      }
      this.terrainMaterial.uniforms.themeWave.value.z=-1,(t=e.done)==null||t.call(e)
    }
  }
  updateGroundTheme() {
    const e=this.themeAnim;
    if(!e)return;
    const t=Math.min(1,(performance.now()-e.start)/(e.secs*1e3));
    this.terrainMaterial.uniforms.themeWave.value.z=e.reach*t*t,t>=1&&this.finishGroundTheme()
  }
  setView(e,t) {
    const n=window.innerWidth,s=window.innerHeight,o=this.perspective,r=this.heightAt(e,t),i=Ha.rig;
    this.hanging.visible=!i;
    const l=i?i.pitch:UB(),c=1+((s>n?Math.pow(s/n,sN):1)-1)*(1-Ha.zoom),u=i?i.orbit:YS()*c,h=i?i.orbit:qB()*c;
    o.aspect=n/s,o.fov=i?i.fov:KS(),o.near=Math.max(4,(h-1500)*.3),o.updateProjectionMatrix(),this.target.set(e,r+(i?60:(.4+.9*(1-l/(Math.PI/2)))*60),t);
    const m=Math.sin(Ha.yaw),p=Math.cos(Ha.yaw),g=e+m*Math.cos(l)*h,y=t+p*Math.cos(l)*h;
    let f=this.target.y+Math.sin(l)*h;
    const v=this.heightAt(g,y)+40;
    f<v&&(f=v),o.position.set(g,f,y),o.up.set(0,1,0),o.lookAt(this.target),o.updateMatrixWorld(),this.shared.camRight.value.set(p,0,-m),this.shared.camBack.value.set(m*Math.cos(l),Math.sin(l),p*Math.cos(l)),this.shared.camUp.value.set(0,1/Math.max(.5,Math.cos(l)),0),this.updateFootprint(e,t,r),this.atmos.focus.value.set(e,r,t),this.atmos.viewRadius.value=Math.max(900,this.footprintMax),this.atmos.farFog.value.set(u*.6+500,u+2400)
  }
  updateFootprint(e,t,n) {
    const o=this.perspective,r=[],i=8,l=[];
    for(let h=0;h<i;h++)l.push([-1+2*h/i,1]);
    for(let h=0;h<i;h++)l.push([1,1-2*h/i]);
    for(let h=0;h<i;h++)l.push([1-2*h/i,-1]);
    for(let h=0;h<i;h++)l.push([-1,-1+2*h/i]);
    const d=new F,c=new F;
    let u=0;
    for(const[h,m]of l) {
      d.set(h,m,-1).unproject(o),c.set(h,m,1).unproject(o).sub(d).normalize();
      let p,g;
      const y=c.y<-1e-4?(n-d.y)/c.y:1/0;
      if(y>0&&isFinite(y))p=d.x+c.x*y-e,g=d.z+c.z*y-t;
      else {
        p=c.x,g=c.z;
        const v=Math.hypot(p,g)||1;
        p=p/v*1700,g=g/v*1700
      }
      const f=Math.hypot(p,g);
      f>1700&&(p*=1700/f,g*=1700/f),u=Math.max(u,Math.min(f,1700)),r.push([p,g])
    }
    this.footprint=r,this.footprintMax=u
  }
  edgeDistance(e) {
    const t=Math.cos(e),n=Math.sin(e),s=this.footprint;
    let o=1/0;
    for(let r=0;r<s.length;r++) {
      const[i,l]=s[r],[d,c]=s[(r+1)%s.length],u=d-i,h=c-l,m=t*h-n*u;
      if(Math.abs(m)<1e-9)continue;
      const p=(i*h-l*u)/m,g=(i*n-l*t)/m;
      p>0&&g>=0&&g<=1&&(o=Math.min(o,p))
    }
    return isFinite(o)?o:this.footprintMax
  }
  get viewReach() {
    return this.footprintMax
  }
  get activeCamera() {
    return this.perspective
  }
  scaleAt(e,t,n=0) {
    const s=this.perspective;
    s.getWorldDirection(this.fwd);
    const o=this.tmpV.set(e,this.heightAt(e,t)+n,t).sub(s.position).dot(this.fwd);
    return o<=1?0:window.innerHeight/2/(Math.tan(s.fov*Math.PI/360)*o)
  }
  groundSquashAt(e,t) {
    const n=this.perspective,s=e-n.position.x,o=t-n.position.z,r=n.position.y-this.heightAt(e,t);
    return Math.max(.12,r/Math.hypot(s,r,o))
  }
  spriteLift(e) {
    return e*this.shared.camUp.value.y
  }
  project(e,t,n=0) {
    const s=this.tmpV.set(e,this.heightAt(e,t)+n,t).project(this.perspective);
    return s.z>1||s.z<-1? {
      x:-1e5,y:-1e5
    }
    : {
      x:(s.x+1)/2*window.innerWidth,y:(1-s.y)/2*window.innerHeight
    }
  }
  addZone(e,t=0) {
    const n=new W6(e,t);
    return this.scene.add(n.mesh),this.keep.add(n.mesh),this.groundSprites.push(n),n
  }
  addGroundSprite(e,t=!0) {
    const n=new G6(e,t);
    return this.scene.add(n.mesh),this.keep.add(n.mesh),this.groundSprites.push(n),n
  }
  updateGroundSprites() {
    for(let e=this.groundSprites.length-1;e>=0;e--) {
      const t=this.groundSprites[e];
      if(t.disposed) {
        this.scene.remove(t.mesh),t.free(),this.groundSprites.splice(e,1);
        continue
      }
      const n=t.size/2;
      t.place(Math.max(this.heightAt(t.x,t.y),this.heightAt(t.x-n,t.y),this.heightAt(t.x+n,t.y),this.heightAt(t.x,t.y-n),this.heightAt(t.x,t.y+n)))
    }
  }
  addWave(e,t,n) {
    const s=this.heightAt(e,t),o=new Z6(n);
    if(o.mesh.position.set(e,s+2,t),this.scene.add(o.mesh),this.cylinders.push(o),(n.height??70)<=0)return;
    const r=new Q6(n);
    r.mesh.position.set(e,s+1,t),this.scene.add(r.mesh),this.cylinders.push(r)
  }
  add3D(e,t,n) {
    const s=n.reach??0,o=s?Math.max(this.heightAt(e,t),this.heightAt(e-s,t),this.heightAt(e+s,t),this.heightAt(e,t-s),this.heightAt(e,t+s)):this.heightAt(e,t);
    n.mesh.position.set(e,o+1,t),this.scene.add(n.mesh),this.cylinders.push(n)
  }
  addFireWave(e,t,n) {
    this.add3D(e,t,new b6(n))
  }
  addFirePatch(e,t,n) {
    this.add3D(e,t,new My(n))
  }
  addFireball(e,t,n) {
    this.add3D(e,t,new x6(n))
  }
  addCylinder(e,t,n) {
    const s=new eN(n);
    s.mesh.position.set(e,this.heightAt(e,t)+2,t),this.scene.add(s.mesh),this.cylinders.push(s)
  }
  pickGround(e,t) {
    const n=this.perspective,s=e/window.innerWidth*2-1,o=1-t/window.innerHeight*2,r=new F(s,o,-1).unproject(n),i=new F(s,o,1).unproject(n).sub(r).normalize(),l=h=>r.y+i.y*h-this.heightAt(r.x+i.x*h,r.z+i.z*h),d=this.target.y+800,c=i.y<0&&r.y>d?(r.y-d)/-i.y:0;
    let u=c;
    for(let h=c;h<c+6e3;h+=12) {
      if(l(h)<=0) {
        let m=u,p=h;
        for(let g=0;g<10;g++) {
          const y=(m+p)/2;
          l(y)>0?m=y:p=y
        }
        return {
          x:r.x+i.x*p,y:r.z+i.z*p
        }
      }
      u=h
    }
    return null
  }
  setCellCursor(e,t,n,s,o) {
    if(!this.cellCursor) {
      if(!e)return;
      const i=no(e.source,!0),l=(d,c,u)=> {
        const h=new Jt;
        h.setAttribute("position",new Ce(new Float32Array(12),3)),h.setAttribute("uv",new Ce([0,0,1,0,0,1,1,1],2)),h.setIndex([0,2,1,1,2,3]);
        const m=new $o( {
          map:i,color:d,opacity:c,transparent:!0,depthWrite:!1,side:rt,polygonOffset:!0,polygonOffsetFactor:-4,polygonOffsetUnits:-4
        }),p=new Ie(h,m);
        return p.renderOrder=u,p.frustumCulled=!1,p
      };
      this.cellCursor=new on,this.cellCursor.add(l(0,.6,1),l(16777215,1,2)),this.scene.add(this.cellCursor),this.keep.add(this.cellCursor)
    }
    const r=this.cellCursor;
    r.visible=o,o&&r.children.forEach((i,l)=> {
      const d=l===0?s*.09:0,c=i.geometry.getAttribute("position"),u=(h,m,p)=>c.setXYZ(h,m,this.heightAt(m,p)+1,p);u(0,t-d,n-d),u(1,t+s+d,n-d),u(2,t-d,n+s+d),u(3,t+s+d,n+s+d),c.needsUpdate=!0
    })
  }
  addBeam(e,t,n) {
    const s=new nN(n);
    return s.group.position.set(e,this.heightAt(e,t),t),this.scene.add(s.group),this.keep.add(s.group),this.beams.add(s),s
  }
  setBeam(e,t,n) {
    e.group.position.set(t,this.heightAt(t,n),n)
  }
  removeBeam(e) {
    this.beams.delete(e)&&(this.scene.remove(e.group),e.dispose())
  }
  updateCylinders() {
    const e=performance.now(),t=Math.min(.1,(e-this.lastFx)/1e3);
    this.lastFx=e;
    for(const s of this.beams)s.update(t);
    const n=(s,o)=>this.tmpV.set(s,this.heightAt(s,o)+2,o);
    for(let s=this.cylinders.length-1;s>=0;s--) {
      const o=this.cylinders[s];
      o.update(t,n)&&(this.scene.remove(o.mesh),o.dispose(),this.cylinders.splice(s,1))
    }
  }
  render(e) {
    var n,s;
    if(this.restoring)return;
    this.updateGroundTheme(),(n=this.cosmos)==null||n.update(),(s=this.altar)==null||s.update();
    const t=this.renderer.getSize(new Ae);
    if((t.x!==window.innerWidth||t.y!==window.innerHeight)&&this.renderer.setSize(window.innerWidth,window.innerHeight),this.waterMaterial) {
      const o=performance.now()/1e3;
      this.waterMaterial.uniforms.time.value=o,this.waterMaterial.uniforms.map.value=this.waterFrames[Math.floor(o*12)%this.waterFrames.length]
    }
    for(const o of this.batches.values())o.count=0;
    for(const o of this.ghostBatches.values())o.count=0;
    this.shadows.count=0,this.glows.count=0;
    for(const o of e.children) {
      if(!o.visible||o.alpha<=0)continue;
      const r=o.x,i=o.y,l=this.heightAt(r,i);
      this.walk(o,r,l,i,0,0,o.scale.x,o.scale.y,16777215,o.alpha, {
        n:0
      },o===e)
    }
    for(const o of this.batches.values())o.flush();
    for(const o of this.ghostBatches.values())o.flush();
    this.pruneBatches(),this.shadows.flush(),this.glows.flush(),this.updateCylinders(),this.updateGroundSprites(),this.fadeEffects(),this.renderer.render(this.scene,this.activeCamera),this.pinPrograms()
  }
  fadeEffects() {
    for(const e of this.scene.children)this.keep.has(e)||e.traverse(t=> {
      const n=t.material;n&&(Array.isArray(n)?n.forEach(Vb):Vb(n))
    })
  }
  pinPrograms() {
    const e=this.renderer.info.programs;
    if(e)for(const t of e)t.pinned||(t.pinned=!0,t.usedTimes++)
  }
  walk(e,t,n,s,o,r,i,l,d,c,u,h) {
    h||this.emit(e,t,n,s,o,r,i,l,d,c,u);
    for(const m of e.children) {
      if(!m.visible||m.alpha<=0)continue;
      const p=o+m.x*i,g=r+m.y*l,y=Kb(d,m.tint??16777215);
      this.walk(m,t,n,s,p,g,i*m.scale.x,l*m.scale.y,y,c*m.alpha,u,!1)
    }
  }
  emit(e,t,n,s,o,r,i,l,d,c,u) {
    if(e instanceof Ra) {
      const h=e.texture;
      if(!h||!h.source||$R(h.source))return;
      if(!cA(h.source)) {
        no(h.source);
        return
      }
      const m=h.frame,p=h.source,g=!!e.ghost,y=g?this.ghostBatches:this.batches;
      let f=y.get(p);
      f||(f=new H6(no(p),this.shared,g),y.set(p,f),this.scene.add(f.mesh),this.keep.add(f.mesh));
      const v=p.width,b=p.height,_=h.orig.width*i,S=h.orig.height*l,M=m.x/v,k=(m.x+m.width)/v,C=h.rotate===ba.MIRROR_HORIZONTAL;
      f.push(t,n,s,o-e.anchor.x*_,r-e.anchor.y*S,_,S,C?k:M,m.y/b,C?M:k,(m.y+m.height)/b,Kb(d,e.tint),c,w6+u.n++*.6)
    }
    else if(e instanceof et) {
      const h=e.decal;
      if(!h)return;
      const m=e.getLocalBounds(),p=m.width/2*Math.abs(i),g=m.height/2*Math.abs(l)/Ib,y=h.kind==="shadow"?this.shadows:this.glows,f=t+o,v=s+r,b=Math.max(n,this.heightAt(f-p,v),this.heightAt(f+p,v),this.heightAt(f,v-g),this.heightAt(f,v+g));
      y.push(f,b+1,v,p,g,h.color,h.alpha*c)
    }
  }
  whenReady() {
    return this.restoring??Promise.resolve()
  }
  get loading() {
    return this.restoring!==null
  }
  async uploadInBatches(e) {
    for(let t=0;t<e.length&&!this.gone;t+=Wb) {
      const n=e.slice(t,t+Wb);
      if(await Promise.all(n.map(([s,o])=>au(s,o))),this.gone)return;
      for(const[s,o]of n)!Xc(s)&&o.image!==Yc&&this.renderer.initTexture(o)
    }
  }
  pruneBatches() {
    const e=performance.now();
    if(!(e<this.nextPrune)) {
      this.nextPrune=e+1e3;
      for(const[t,n]of[[this.batches,this.ghostBatches],[this.ghostBatches,this.batches]])for(const[s,o]of t) {
        if(e-o.lastUsed<T6)continue;
        t.delete(s),this.scene.remove(o.mesh),o.dispose();
        const r=tu.get(s);
        r&&!n.has(s)&&(r.dispose(),r.userData.ready=!1)
      }
    }
  }
  dispose() {
    this.gone=!0;
    try {
      this.disposeScene()
    }
    finally {
      try {
        this.renderer.dispose(),this.renderer.forceContextLoss()
      }
      finally {
        this.renderer.domElement.remove()
      }
    }
  }
  disposeScene() {
    var e,t,n;
    window.removeEventListener("resize",this.onResize),(e=this.cosmos)==null||e.destroy(),this.cosmos=null,(t=this.altar)==null||t.dispose(),this.altar=null,this.offSettings();
    for(const s of this.beams)s.dispose();
    for(const s of this.batches.values())s.dispose();
    for(const s of this.ghostBatches.values())s.dispose();
    this.shadows.dispose(),this.glows.dispose(),this.scene.traverse(s=> {
      s instanceof Ie&&s.geometry.dispose()
    }),this.terrainMaterial.dispose();
    for(const s of this.modelMaterials)s.dispose();
    (n=this.waterMaterial)==null||n.dispose(),C6(this.textures),NB()
  }
}
function Kb(a,e) {
  if(a===16777215)return e;
  if(e===16777215)return a;
  const t=(a>>16&255)*(e>>16&255)/255,n=(a>>8&255)*(e>>8&255)/255,s=(a&255)*(e&255)/255;
  return Math.round(t)<<16|Math.round(n)<<8|Math.round(s)
}
function tl(a,e) {
  const[t,n]=HB(a,e);
  return((Math.round(Math.atan2(n,t)/(Math.PI/4))+6)%8+8)%8
}