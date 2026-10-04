// 特效：粒子、命中火花、衝擊環、光束、斬擊、閃電、地面標記、投射物外觀。
import * as THREE from 'three';
import { heightAt } from './map.js';

const sin = Math.sin, cos = Math.cos, rand = Math.random;

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = canvasTex(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.75)'); r.addColorStop(0.6, 'rgba(255,255,255,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
// 格鬥遊戲式命中火花：鋸齒星形＋放射線
const burstTex = canvasTex(256, (g, s) => {
  const c = s / 2;
  g.translate(c, c);
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rand() * 0.15, r0 = c * (0.25 + rand() * 0.15), r1 = c * (0.62 + rand() * 0.36);
    g.lineWidth = 2 + rand() * 5; g.beginPath(); g.moveTo(cos(a) * r0, sin(a) * r0); g.lineTo(cos(a) * r1, sin(a) * r1); g.stroke();
  }
  g.fillStyle = '#fff'; g.beginPath();
  const n = 12;
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = (i % 2 ? 0.16 : 0.42 + rand() * 0.12) * c; (i ? g.lineTo : g.moveTo).call(g, cos(a) * r, sin(a) * r); }
  g.closePath(); g.fill();
});
const ringTex = canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,.9)'); r.addColorStop(0.85, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const discTex = canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,.55)'); r.addColorStop(0.8, 'rgba(255,255,255,.35)'); r.addColorStop(0.93, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});

/* ---------------- 粒子 ---------------- */
function particleSystem(scene, N, additive) {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), alpha = new Float32Array(N);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), max = new Float32Array(N), grav = new Float32Array(N), drag = new Float32Array(N), s0 = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTex: { value: glowTex }, uScale: { value: 400 } },
    vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
      uniform float uScale; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*uScale/-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ vec4 t=texture2D(uTex,gl_PointCoord); gl_FragColor=vec4(vC*${additive ? '1.15' : '1.0'}, t.a*vA*${additive ? '0.85' : '1.0'}); if(gl_FragColor.a<.01) discard; }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = additive ? 5 : 4;
  scene.add(pts);
  let cursor = 0; const c = new THREE.Color();
  return {
    mat,
    emit(x, y, z, o) {
      const n = o.n || 8;
      for (let k = 0; k < n; k++) {
        const i = cursor; cursor = (cursor + 1) % N;
        const a = rand() * Math.PI * 2, el = (o.up ?? 0.3) + (rand() - 0.5) * (o.spread ?? 1.4), sp = (o.speed || 4) * (0.4 + rand() * 0.8);
        pos[i * 3] = x + (rand() - 0.5) * (o.jitter || 0); pos[i * 3 + 1] = y + (rand() - 0.5) * (o.jitterY ?? o.jitter ?? 0); pos[i * 3 + 2] = z + (rand() - 0.5) * (o.jitter || 0);
        const dirx = o.dir !== undefined ? sin(o.dir + (rand() - 0.5) * (o.cone ?? 0.8)) : cos(a), dirz = o.dir !== undefined ? cos(o.dir + (rand() - 0.5) * (o.cone ?? 0.8)) : sin(a);
        vel[i * 3] = dirx * sp * Math.cos(el); vel[i * 3 + 1] = sp * Math.sin(el) + (o.vy || 0); vel[i * 3 + 2] = dirz * sp * Math.cos(el);
        c.set(o.color || '#fff'); if (o.color2 && rand() < 0.5) c.set(o.color2);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        max[i] = life[i] = (o.life || 0.5) * (0.6 + rand() * 0.7); s0[i] = (o.size || 0.4) * (0.6 + rand() * 0.8);
        grav[i] = o.gravity ?? 6; drag[i] = o.drag ?? 2;
      }
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { if (alpha[i] !== 0) { alpha[i] = 0; } continue; }
        life[i] -= dt;
        const k = Math.max(0, life[i] / max[i]);
        const f = Math.exp(-drag[i] * dt);
        vel[i * 3] *= f; vel[i * 3 + 2] *= f; vel[i * 3 + 1] = vel[i * 3 + 1] * f - grav[i] * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.3; }
        alpha[i] = Math.min(1, k * 2.2); size[i] = s0[i] * (0.35 + 0.65 * k);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true; geo.attributes.size.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}

export function createFx(scene, camera) {
  const add = particleSystem(scene, 4200, true);
  const dust = particleSystem(scene, 1600, false);
  const live = []; // { t, dur, update(k, dt), done() }
  const spawn = (o) => { o.t = 0; live.push(o); return o; };
  const addMat = (color, map, opacity = 1) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });

  // 點光源池（爆炸時照亮地面與角色）
  const lights = [];
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight('#ffffff', 0, 14, 1.6); scene.add(l); lights.push({ l, t: 0, dur: 1, i0: 0 }); }
  let li = 0;
  function pop(x, y, z, color, intensity, range = 12, dur = 0.35) {
    const L = lights[li]; li = (li + 1) % lights.length;
    L.l.position.set(x, y, z); L.l.color.set(color); L.l.distance = range; L.i0 = intensity; L.t = 0; L.dur = dur; L.l.intensity = intensity;
  }

  // 面向鏡頭的平面
  const planeG = new THREE.PlaneGeometry(1, 1);
  const flatG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  function billboard(tex, color, size, x, y, z, dur, grow = 1.6, spin = 0) {
    const m = new THREE.Mesh(planeG, addMat(color, tex)); m.position.set(x, y, z); m.renderOrder = 6; scene.add(m);
    const r0 = rand() * Math.PI;
    return spawn({
      dur, update(k) { m.quaternion.copy(camera.quaternion); m.rotateZ(r0 + spin * k); const s = size * (0.55 + grow * Math.pow(k, 0.5)); m.scale.set(s, s, s); m.material.opacity = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85; },
      done() { scene.remove(m); m.material.dispose(); },
    });
  }
  function groundRing(x, z, color, radius, dur, tex = ringTex, y0 = 0.15) {
    const m = new THREE.Mesh(flatG, addMat(color, tex)); m.position.set(x, heightAt(x, z) + y0, z); m.renderOrder = 3; scene.add(m);
    return spawn({
      dur, update(k) { const s = radius * 2 * (0.2 + 0.8 * (1 - (1 - k) * (1 - k))); m.scale.set(s, 1, s); m.material.opacity = 1 - k; },
      done() { scene.remove(m); m.material.dispose(); },
    });
  }

  const api = {
    update(dt) {
      add.update(dt); dust.update(dt);
      for (let i = live.length - 1; i >= 0; i--) {
        const o = live[i]; o.t += dt;
        const k = Math.min(1, o.t / o.dur);
        o.update && o.update(k, dt);
        if (o.t >= o.dur || o.kill) { o.done && o.done(); live.splice(i, 1); }
      }
      for (const L of lights) if (L.l.intensity > 0) { L.t += dt; L.l.intensity = Math.max(0, L.i0 * (1 - L.t / L.dur)); }
    },
    setPixelScale(h) { add.mat.uniforms.uScale.value = h * 0.9; dust.mat.uniforms.uScale.value = h * 0.9; },
    emit: (x, y, z, o) => add.emit(x, y, z, o),
    dust(x, z, n = 10, color = '#c9b48a', size = 0.9) { dust.emit(x, 0.3, z, { n, speed: 3, up: 0.5, spread: 0.6, color, size, life: 0.9, gravity: 1, drag: 3, jitter: 0.8 }); },

    hitSpark(x, y, z, color, scale = 1, kind = 'light') {
      billboard(burstTex, '#ffffff', 1.5 * scale, x, y, z, 0.13 + scale * 0.03, 1.2);
      billboard(burstTex, color, 2.3 * scale, x, y, z, 0.18 + scale * 0.04, 1.4, 0.6);
      if (kind === 'heavy') { groundRing(x, z, color, 2.2 * scale, 0.3); pop(x, y, z, color, 30 * scale, 10, 0.25); }
      const c2 = kind === 'ice' ? '#ffffff' : kind === 'spark' ? '#fffbe0' : '#fff2c0';
      add.emit(x, y, z, { n: Math.round(10 * scale), speed: 9 * scale, up: 0.3, spread: 2.4, color, color2: c2, size: 0.25, life: 0.35, gravity: 9, drag: 4 });
    },
    ring: (x, z, color, radius, dur) => groundRing(x, z, color, radius, dur),
    explode(x, z, color, radius, style) {
      const y = heightAt(x, z) + 0.8;
      groundRing(x, z, color, radius * 1.2, 0.45); groundRing(x, z, '#ffffff', radius * 0.7, 0.3);
      billboard(burstTex, color, radius * 1.05, x, y + 0.6, z, 0.22, 1.1);
      billboard(glowTex, color, radius * 1.7, x, y + 0.8, z, 0.3, 0.6);
      pop(x, y + 2, z, color, 60, radius * 3, 0.45);
      add.emit(x, y, z, { n: 28, speed: 12, up: 0.6, spread: 1.6, color, color2: '#ffffff', size: 0.38, life: 0.6, gravity: 8, drag: 3, jitter: radius * 0.5 });
      if (style === 'rock') dust.emit(x, 0.4, z, { n: 40, speed: 9, up: 0.9, spread: 0.8, color: '#7a6a52', color2: '#a89272', size: 0.5, life: 1.2, gravity: 16, drag: 1.2, jitter: radius });
      else if (style === 'ice') add.emit(x, y, z, { n: 30, speed: 10, up: 1.0, spread: 0.8, color: '#e9fbff', size: 0.35, life: 0.9, gravity: 14, drag: 1, jitter: radius * 0.6 });
      dust.emit(x, 0.3, z, { n: 24, speed: 6, up: 0.15, spread: 0.3, color: '#cbb995', size: 1.4, life: 1.1, gravity: 0, drag: 2.5, jitter: radius * 0.4 });
    },
    vanish(x, z, color, h, arrive) {
      const y = heightAt(x, z);
      billboard(glowTex, color, 3.2, x, y + 1, z, 0.22, 0.4);
      groundRing(x, z, color, 2.2, 0.28);
      // 直立的殘影線
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(planeG, addMat(i % 2 ? '#ffffff' : color, glowTex));
        const ox = (rand() - 0.5) * 1.2, oz = (rand() - 0.5) * 1.2;
        m.position.set(x + ox, y + 1, z + oz); m.renderOrder = 6; scene.add(m);
        spawn({ dur: 0.25 + rand() * 0.1, update(k) { m.quaternion.copy(camera.quaternion); m.scale.set(0.18 * (1 - k), 3 + k * 2, 1); m.position.y = y + 1 + (arrive ? -k : k) * 1.5; m.material.opacity = 1 - k; }, done() { scene.remove(m); m.material.dispose(); } });
      }
      add.emit(x, y + 1, z, { n: 16, speed: 5, up: 1.2, spread: 0.8, color, color2: '#ffffff', size: 0.3, life: 0.35, gravity: -2, jitter: 0.8 });
    },
    trail(h, color) {
      add.emit(h.x, h.y + 1.0, h.z, { n: 2, speed: 0.6, color, color2: '#ffffff', size: 0.55, life: 0.28, gravity: 0, drag: 6, jitter: 0.5, jitterY: 1.2 });
      if (rand() < 0.4) dust.emit(h.x, 0.2, h.z, { n: 1, speed: 1.5, up: 0.3, color: '#c9b48a', size: 0.9, life: 0.6, gravity: 0, drag: 3 });
    },
    // 投射物外觀：回傳 { update(p, dt), remove() }
    orb(color, size, style) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.45, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
      const glow = new THREE.Mesh(planeG, addMat(color, glowTex)); glow.scale.setScalar(size * 3.2);
      const halo = new THREE.Mesh(planeG, addMat(color, burstTex, 0.6)); halo.scale.setScalar(size * 2.4);
      g.add(core, glow, halo); scene.add(g);
      let t = 0;
      return {
        update(p, dt) {
          t += dt; g.position.set(p.x, p.y + heightAt(p.x, p.z), p.z);
          glow.quaternion.copy(camera.quaternion); halo.quaternion.copy(camera.quaternion); halo.rotateZ(t * 9);
          add.emit(p.x, g.position.y, p.z, { n: style === 'tower' ? 1 : 3, speed: 1.2, color, color2: style === 'fire' ? '#ffd29a' : '#ffffff', size: size * 0.8, life: 0.3, gravity: style === 'fire' ? -3 : 0, drag: 5, jitter: size * 0.4 });
        },
        remove() { scene.remove(g); core.geometry.dispose(); core.material.dispose(); glow.material.dispose(); halo.material.dispose(); },
      };
    },
    bolt(color, size) {
      const m = new THREE.Mesh(planeG, addMat(color, glowTex)); m.scale.setScalar(size * 3); scene.add(m);
      const c = new THREE.Mesh(planeG, addMat('#ffffff', glowTex)); c.scale.setScalar(size * 1.3); scene.add(c);
      return {
        update(p) { m.position.set(p.x, p.y, p.z); c.position.copy(m.position); m.quaternion.copy(camera.quaternion); c.quaternion.copy(camera.quaternion); if (rand() < 0.6) add.emit(p.x, p.y, p.z, { n: 1, speed: 0.4, color, size: size * 1.2, life: 0.18, gravity: 0 }); },
        remove() { scene.remove(m, c); m.material.dispose(); c.material.dispose(); },
      };
    },
    lance(color) {
      const g = new THREE.Group();
      const geo = new THREE.OctahedronGeometry(0.5, 0); geo.scale(0.6, 0.6, 3.6);
      const crystal = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#e9fbff', toneMapped: false }));
      const glow = new THREE.Mesh(geo, addMat(color, null, 0.5)); glow.scale.setScalar(1.6);
      g.add(crystal, glow); scene.add(g);
      return {
        update(p) { g.position.set(p.x, p.y, p.z); g.rotation.set(0, p.ang, 0); add.emit(p.x, p.y, p.z, { n: 3, speed: 1, color, color2: '#ffffff', size: 0.5, life: 0.35, gravity: 1, drag: 4, jitter: 0.4 }); },
        remove() { scene.remove(g); geo.dispose(); crystal.material.dispose(); glow.material.dispose(); },
      };
    },
    // 巨大光束：從角色手部朝 ang 延伸
    beam(h, ang, len, width, color, coreColor, style) {
      const g = new THREE.Group(); scene.add(g);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide, toneMapped: false,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color(coreColor) }, uFade: { value: 1 } },
        vertexShader: 'varying vec2 vUv; varying float vNdv; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*normal); vNdv=abs(dot(n, normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }',
        fragmentShader: `varying vec2 vUv; varying float vNdv; uniform float uTime; uniform vec3 uColor; uniform vec3 uCore; uniform float uFade;
          float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
          void main(){
            float ripple = n(vec2(vUv.y*14.-uTime*22., vUv.x*12.))*.5 + n(vec2(vUv.y*34.-uTime*40., vUv.x*24.))*.5;
            float body = smoothstep(.05,.55,vNdv + (ripple-.5)*.35);
            float core = smoothstep(.9,.995,vNdv + (ripple-.5)*.1);
            vec3 c = mix(uColor*(.55+.45*vNdv+.25*ripple), uCore*1.2, core);
            float tip = smoothstep(1.,.93,vUv.y);
            gl_FragColor = vec4(c, clamp(body*1.3,0.,1.)*tip*uFade);
          }`,
      });
      const cyl = new THREE.CylinderGeometry(width * 0.62, width * 0.5, len, 18, 1, true); cyl.rotateX(Math.PI / 2); cyl.translate(0, 0, len / 2);
      const tube = new THREE.Mesh(cyl, mat); tube.renderOrder = 8; g.add(tube);
      const coreMat = mat.clone(); coreMat.uniforms = THREE.UniformsUtils.clone(mat.uniforms); coreMat.uniforms.uColor.value = new THREE.Color(coreColor).multiplyScalar(0.62); coreMat.uniforms.uCore.value = new THREE.Color(coreColor).multiplyScalar(0.7); coreMat.blending = THREE.AdditiveBlending;
      const coreTube = new THREE.Mesh(cyl, coreMat); coreTube.renderOrder = 9; coreTube.scale.set(0.38, 0.38, 1); g.add(coreTube);
      let helix = null;
      if (style === 'spiral') {
        class Helix extends THREE.Curve { getPoint(t, o = new THREE.Vector3()) { const a = t * len * 1.6; return o.set(Math.cos(a) * width * 0.75, Math.sin(a) * width * 0.75, t * len); } }
        const hg = new THREE.TubeGeometry(new Helix(), Math.ceil(len * 6), width * 0.14, 6, false);
        helix = new THREE.Mesh(hg, addMat('#e070ff', null, 0.9)); helix.renderOrder = 9; g.add(helix);
      }
      const outer = new THREE.Mesh(cyl, addMat(color, null, 0.1)); outer.scale.set(1.35, 1.35, 1); g.add(outer);
      const cap = new THREE.Mesh(planeG, addMat(color, burstTex, 0.7)); cap.scale.setScalar(width * 1.5); scene.add(cap);
      const capCore = new THREE.Mesh(planeG, addMat(coreColor, glowTex, 0.6)); capCore.scale.setScalar(width * 1.1); scene.add(capCore);
      const end = new THREE.Mesh(planeG, addMat(color, burstTex, 0.8)); end.scale.setScalar(width * 1.8); scene.add(end);
      let t = 0, life = 0, removing = false;
      const o = spawn({
        dur: 99,
        update(k, dt) {
          t += dt; life += dt;
          const grow = Math.min(1, life / 0.12);
          mat.uniforms.uTime.value = t; coreMat.uniforms.uTime.value = t * 1.3; if (helix) { helix.rotation.z = -t * 14; helix.scale.z = grow; }
          const wob = 1 + sin(t * 40) * 0.06;
          tube.scale.set(wob, wob, grow); coreTube.scale.set(0.38 * wob, 0.38 * wob, grow); outer.scale.set(1.35 * wob, 1.35 * wob, grow);
          cap.quaternion.copy(camera.quaternion); cap.rotateZ(t * 7); capCore.quaternion.copy(camera.quaternion);
          end.quaternion.copy(camera.quaternion); end.rotateZ(-t * 9);
          end.position.set(g.position.x + sin(ang) * len * grow, g.position.y, g.position.z + cos(ang) * len * grow);
          if (removing) { const f = Math.max(0, 1 - this.rt / 0.22); this.rt += dt; mat.uniforms.uFade.value = f; coreMat.uniforms.uFade.value = f; coreTube.scale.x = coreTube.scale.y = 0.38 * f; outer.material.opacity = 0.1 * f; cap.material.opacity = 0.7 * f; end.material.opacity = 0.8 * f; capCore.material.opacity = 0.6 * f; tube.scale.x = tube.scale.y = f; if (helix) helix.material.opacity = 0.9 * f; if (f <= 0) this.kill = true; }
          else {
            const d = rand() * len * grow;
            add.emit(g.position.x + sin(ang) * d, 0.4, g.position.z + cos(ang) * d, { n: 2, speed: 6, up: 0.9, spread: 0.6, color, color2: coreColor, size: 0.5, life: 0.4, gravity: 4 });
            if (rand() < 0.12) dust.emit(g.position.x + sin(ang) * d, 0.2, g.position.z + cos(ang) * d, { n: 1, speed: 4, up: 0.2, color: '#8a7656', size: 1.0, life: 0.6, gravity: 0, drag: 2 });
          }
        },
        done() { scene.remove(g, cap, capCore, end); cyl.dispose(); mat.dispose(); coreMat.dispose(); if (helix) { helix.geometry.dispose(); helix.material.dispose(); } outer.material.dispose(); cap.material.dispose(); capCore.material.dispose(); end.material.dispose(); },
      });
      const light = lights[li]; li = (li + 1) % lights.length;
      return {
        update(hh, a) {
          ang = a;
          const ox = hh.x + sin(a) * 1.0, oz = hh.z + cos(a) * 1.0, oy = heightAt(hh.x, hh.z) + 1.25;
          g.position.set(ox, oy, oz); g.rotation.set(0, a, 0);
          cap.position.set(ox, oy, oz); capCore.position.copy(cap.position);
          light.l.position.set(ox + sin(a) * len * 0.4, oy + 2, oz + cos(a) * len * 0.4); light.l.color.set(color); light.l.distance = len * 0.9; light.l.intensity = light.i0 = 22; light.t = 0; light.dur = 0.4;
        },
        remove() { if (!removing) { removing = true; o.rt = 0; } },
      };
    },
    slash(x, z, ang, color, scale = 2) {
      const geo = new THREE.RingGeometry(scale * 0.7, scale, 24, 1, -1.3, 2.6); geo.rotateX(-Math.PI / 2);
      const uv = geo.attributes.uv, pos = geo.attributes.position, alpha = [];
      const m = new THREE.Mesh(geo, addMat(color, glowTex)); m.position.set(x, heightAt(x, z) + 1.1, z); m.rotation.y = ang - Math.PI / 2; m.renderOrder = 6; scene.add(m);
      const m2 = new THREE.Mesh(geo, addMat('#ffffff', glowTex, 0.8)); m2.scale.setScalar(0.92); m.add(m2);
      spawn({ dur: 0.22, update(k) { m.rotation.y = ang - Math.PI / 2 + (k - 0.5) * 1.6; m.material.opacity = 1 - k; m2.material.opacity = 0.8 * (1 - k); m.scale.setScalar(0.8 + k * 0.4); }, done() { scene.remove(m); geo.dispose(); m.material.dispose(); m2.material.dispose(); } });
    },
    lightning(a, b, color) {
      const pts = [], n = 8;
      for (let i = 0; i <= n; i++) { const k = i / n, j = i === 0 || i === n ? 0 : 0.7; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * k + (rand() - 0.5) * j, a.y + (b.y - a.y) * k + (rand() - 0.5) * j, a.z + (b.z - a.z) * k + (rand() - 0.5) * j)); }
      const make = (w, col, op) => {
        const verts = [], view = new THREE.Vector3(), side = new THREE.Vector3(), seg = new THREE.Vector3();
        camera.getWorldDirection(view);
        for (let i = 0; i < n; i++) {
          seg.subVectors(pts[i + 1], pts[i]); side.crossVectors(seg, view).normalize().multiplyScalar(w);
          const p0 = pts[i], p1 = pts[i + 1];
          verts.push(p0.x - side.x, p0.y - side.y, p0.z - side.z, p0.x + side.x, p0.y + side.y, p0.z + side.z, p1.x + side.x, p1.y + side.y, p1.z + side.z);
          verts.push(p0.x - side.x, p0.y - side.y, p0.z - side.z, p1.x + side.x, p1.y + side.y, p1.z + side.z, p1.x - side.x, p1.y - side.y, p1.z - side.z);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        const m = new THREE.Mesh(g, addMat(col, null, op)); m.renderOrder = 7; scene.add(m); return m;
      };
      const outer = make(0.32, color, 0.55), inner = make(0.09, '#ffffff', 1);
      spawn({ dur: 0.18, update(k) { outer.material.opacity = 0.55 * (1 - k); inner.material.opacity = 1 - k; }, done() { for (const m of [outer, inner]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } } });
      pop(b.x, b.y + 1, b.z, color, 25, 10, 0.18);
      add.emit(b.x, b.y, b.z, { n: 8, speed: 7, color, color2: '#ffffff', size: 0.25, life: 0.25, gravity: 6 });
    },
    mist(x, z, r, color, dur) {
      const m = new THREE.Mesh(flatG, new THREE.MeshBasicMaterial({ color, map: discTex, transparent: true, opacity: 0.6, depthWrite: false }));
      m.position.set(x, heightAt(x, z) + 0.12, z); m.scale.set(r * 2, 1, r * 2); scene.add(m);
      const o = spawn({ dur, update(k) { m.material.opacity = 0.6 * Math.min(1, (1 - k) * 4); if (rand() < 0.5) dust.emit(x + (rand() - 0.5) * r * 1.6, 0.4, z + (rand() - 0.5) * r * 1.6, { n: 1, speed: 0.4, up: 1, color: '#e6f7ff', size: 1.6, life: 1.2, gravity: -0.3, drag: 1 }); }, done() { scene.remove(m); m.material.dispose(); } });
      return { remove() { o.kill = true; } };
    },
    target(x, z, r, color, dur) {
      const ring = new THREE.Mesh(flatG, addMat(color, ringTex, 0.9)); ring.position.set(x, heightAt(x, z) + 0.14, z); ring.scale.set(r * 2, 1, r * 2); scene.add(ring);
      const fill = new THREE.Mesh(flatG, addMat(color, discTex, 0.45)); fill.position.copy(ring.position); scene.add(fill);
      const o = spawn({ dur: 99, update(k, dt) { this.tt = (this.tt || 0) + dt; const f = Math.min(1, this.tt / dur); fill.scale.set(r * 2 * f, 1, r * 2 * f); ring.material.opacity = 0.6 + 0.4 * sin(this.tt * 20); }, done() { scene.remove(ring, fill); ring.material.dispose(); fill.material.dispose(); } });
      return { remove() { o.kill = true; } };
    },
    comet(x, z, color, dur) {
      const geo = new THREE.IcosahedronGeometry(1.6, 0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f2fdff', toneMapped: false }));
      const glow = new THREE.Mesh(planeG, addMat(color, glowTex)); glow.scale.setScalar(7);
      scene.add(m, glow);
      const sx = x + 14, sy = 40, sz = z - 18;
      spawn({ dur, update(k) { const e = k * k; m.position.set(sx + (x - sx) * e, sy + (heightAt(x, z) + 1 - sy) * e, sz + (z - sz) * e); m.rotation.x += 0.2; m.rotation.y += 0.13; glow.position.copy(m.position); glow.quaternion.copy(camera.quaternion); add.emit(m.position.x, m.position.y, m.position.z, { n: 6, speed: 2, color, color2: '#ffffff', size: 1.2, life: 0.5, gravity: 0, drag: 2, jitter: 1.4 }); }, done() { scene.remove(m, glow); geo.dispose(); m.material.dispose(); glow.material.dispose(); } });
    },
    iceField(x, z, r) {
      const geo = new THREE.ConeGeometry(0.5, 2.6, 5); geo.translate(0, 1.3, 0);
      const mat = new THREE.MeshToonMaterial({ color: '#d8f6ff', emissive: '#4fb7e0', emissiveIntensity: 0.4, transparent: true, opacity: 0.92 });
      const n = 26, im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
      const spikes = []; for (let i = 0; i < n; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()) * r; spikes.push({ x: x + cos(a) * d, z: z + sin(a) * d, s: 0.6 + rand() * 1.1, tx: (rand() - 0.5) * 0.7, tz: (rand() - 0.5) * 0.7 }); }
      im.castShadow = true; scene.add(im);
      spawn({ dur: 1.8, update(k) { const g = k < 0.1 ? k / 0.1 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; spikes.forEach((sp, i) => { e.set(sp.tx, 0, sp.tz); q.setFromEuler(e); s.set(sp.s, sp.s * g, sp.s); p.set(sp.x, heightAt(sp.x, sp.z), sp.z); m4.compose(p, q, s); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; }, done() { scene.remove(im); geo.dispose(); mat.dispose(); im.dispose(); } });
    },
    crater(x, z, r) {
      groundRing(x, z, '#e3ffb5', r * 1.3, 0.6);
      const geo = new THREE.DodecahedronGeometry(0.7, 0), mat = new THREE.MeshToonMaterial({ color: '#8a7a62' });
      const n = 16, im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
      const rocks = []; for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rand() * 0.3, d = r * (0.55 + rand() * 0.4); rocks.push({ x: x + cos(a) * d, z: z + sin(a) * d, s: 0.6 + rand() * 1.2, r: rand() * 6 }); }
      im.castShadow = true; scene.add(im);
      spawn({ dur: 2.2, update(k) { const g = k < 0.08 ? k / 0.08 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; rocks.forEach((rk, i) => { e.set(rk.r, rk.r * 2, 0); q.setFromEuler(e); s.setScalar(rk.s * g); p.set(rk.x, heightAt(rk.x, rk.z) + rk.s * 0.2, rk.z); m4.compose(p, q, s); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; }, done() { scene.remove(im); geo.dispose(); mat.dispose(); im.dispose(); } });
    },
    quake(x, z, ang, len, arc, color) {
      const geo = new THREE.ConeGeometry(0.55, 1.8, 5); geo.translate(0, 0.9, 0);
      const mat = new THREE.MeshToonMaterial({ color: '#9b8a6c' });
      const n = 22, im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
      const spikes = []; for (let i = 0; i < n; i++) { const d = 1.2 + (i / n) * len, a = ang + (rand() - 0.5) * arc * 1.1 * (d / len + 0.3); spikes.push({ x: x + sin(a) * d, z: z + cos(a) * d, d, s: 0.7 + rand() * 0.8, tx: (rand() - 0.5) * 0.6, tz: (rand() - 0.5) * 0.6 }); }
      im.castShadow = true; scene.add(im);
      spawn({ dur: 1.1, update(k) { const front = k * len * 3.5; spikes.forEach((sp, i) => { const g = sp.d < front ? Math.min(1, (front - sp.d) / 2) * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1) : 0; e.set(sp.tx, 0, sp.tz); q.setFromEuler(e); s.set(sp.s, sp.s * g + 1e-3, sp.s); p.set(sp.x, heightAt(sp.x, sp.z) - 0.2, sp.z); m4.compose(p, q, s); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; }, done() { scene.remove(im); geo.dispose(); mat.dispose(); im.dispose(); } });
      for (let i = 0; i < 6; i++) { const d = 1.5 + (i / 6) * len; dust.emit(x + sin(ang) * d, 0.3, z + cos(ang) * d, { n: 5, speed: 4, up: 0.7, color: '#b8a27c', size: 1.1, life: 0.8, gravity: 2, drag: 2, jitter: 1.5 }); }
      add.emit(x + sin(ang) * 1.4, 0.6, z + cos(ang) * 1.4, { n: 14, speed: 8, dir: ang, cone: arc, up: 0.4, color, color2: '#ffffff', size: 0.35, life: 0.4 });
    },
    shieldFx(h, color, dur) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      scene.add(m);
      spawn({ dur, update(k) { m.position.set(h.x, h.y + 1.1 + heightAt(h.x, h.z), h.z); m.rotation.y += 0.03; m.material.opacity = h.st.shield > 0 && h.alive ? 0.3 * (k > 0.85 ? (1 - k) / 0.15 : 1) : 0; if (!(h.st.shield > 0)) this.kill = true; }, done() { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
    },
    clickMarker(x, z, attack) {
      const col = attack ? '#ff5a3c' : '#9cf0b4';
      groundRing(x, z, col, 0.9, 0.35, ringTex, 0.12);
    },
    levelUp(u, color) {
      groundRing(u.x, u.z, color, 2.8, 0.6);
      add.emit(u.x, 0.3, u.z, { n: 30, speed: 2, up: 1.4, spread: 0.3, vy: 3, color, color2: '#ffffff', size: 0.35, life: 1, gravity: -1, drag: 1, jitter: 1.4 });
    },
    towerFall(x, z) {
      dust.emit(x, 1, z, { n: 60, speed: 6, up: 0.6, spread: 1, color: '#9a8c74', color2: '#c8b898', size: 2.2, life: 1.8, gravity: 0.5, drag: 1.6, jitter: 2.5 });
      dust.emit(x, 2, z, { n: 40, speed: 10, up: 1, spread: 0.8, color: '#6e6352', size: 0.6, life: 1.4, gravity: 14, drag: 0.6, jitter: 2 });
      groundRing(x, z, '#ffffff', 7, 0.6);
      pop(x, 4, z, '#ffe2b0', 60, 20, 0.6);
    },
    // 貫穿氣功波：前端一道彎月狀能量
    wave(color, width) {
      const geo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); geo.scale(width * 0.7, 0.55, 0.9); geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, addMat(color, null, 0.85)); const c = new THREE.Mesh(geo, addMat('#ffffff', null, 0.7)); c.scale.setScalar(0.55); m.add(c);
      m.renderOrder = 7; scene.add(m);
      return {
        update(p) { m.position.set(p.x, p.y, p.z); m.rotation.y = p.ang; add.emit(p.x, p.y, p.z, { n: 3, speed: 1.5, color, color2: '#ffffff', size: 0.5, life: 0.3, gravity: 0, drag: 4, jitter: width * 0.5 }); },
        remove() { scene.remove(m); geo.dispose(); m.material.dispose(); c.material.dispose(); },
      };
    },
    // 死亡光束：細長的光針
    needle(color) {
      const geo = new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6); geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })); const gl = new THREE.Mesh(geo, addMat(color, null, 0.6)); gl.scale.set(4, 4, 1.1); m.add(gl);
      scene.add(m);
      return {
        update(p) { m.position.set(p.x, p.y, p.z); m.rotation.y = p.ang; add.emit(p.x, p.y, p.z, { n: 2, speed: 0.3, color, size: 0.35, life: 0.2, gravity: 0 }); },
        remove() { scene.remove(m); geo.dispose(); m.material.dispose(); gl.material.dispose(); },
      };
    },
    // 旋轉圓盤（死亡飛盤、氣圓斬）
    disc(color, r) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.25, r, 32).rotateX(-Math.PI / 2), addMat(color, null, 0.9));
      const edge = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r * 1.05, 32).rotateX(-Math.PI / 2), addMat('#ffffff', null, 0.9));
      g.add(ring, edge); g.renderOrder = 7; scene.add(g);
      let t = 0;
      return {
        update(p, dt) { t += dt; g.position.set(p.x, p.y, p.z); g.rotation.y = t * 30; g.rotation.z = 0.15; if (Math.random() < 0.5) add.emit(p.x, p.y, p.z, { n: 1, speed: 0.5, color, size: 0.4, life: 0.2, gravity: 0, jitter: r }); },
        remove() { scene.remove(g); for (const m of [ring, edge]) { m.geometry.dispose(); m.material.dispose(); } },
      };
    },
    // 死亡球：可移動、可縮放的大能量球
    deathBall(color) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffd9b0', toneMapped: false }));
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1.18, 24, 16), addMat(color, null, 0.55));
      const glow = new THREE.Mesh(planeG, addMat(color, glowTex, 0.8)); glow.scale.setScalar(4.2);
      g.add(core, shell); scene.add(g, glow);
      const L = lights[li]; li = (li + 1) % lights.length;
      return {
        update(x, y, z, sc) { g.position.set(x, y, z); g.scale.setScalar(sc); glow.position.set(x, y, z); glow.scale.setScalar(sc * 4.2); glow.quaternion.copy(camera.quaternion); shell.rotation.y += 0.05; L.l.position.set(x, y, z); L.l.color.set(color); L.l.distance = 14 + sc * 4; L.l.intensity = L.i0 = 30; L.t = 0; L.dur = 0.5; if (Math.random() < 0.7) add.emit(x, y, z, { n: 2, speed: 2, color, color2: '#ffffff', size: 0.5 * sc, life: 0.4, gravity: 0, jitter: sc * 1.5 }); },
        remove() { scene.remove(g, glow); core.geometry.dispose(); core.material.dispose(); shell.geometry.dispose(); shell.material.dispose(); glow.material.dispose(); },
      };
    },
    // 魔空包圍彈：一圈氣彈浮現後收攏
    hellzone(x, z, r, color, dur) {
      const n = 12, orbs = [], y0 = heightAt(x, z);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(planeG, addMat(color, glowTex)); m.renderOrder = 7; scene.add(m);
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })); scene.add(c);
        orbs.push({ m, c, a: (i / n) * Math.PI * 2, h: 1 + (i % 3) * 0.9 });
      }
      spawn({ dur, update(k) { const rr = r * 1.7 * (1 - Math.pow(k, 3)) + 0.3; for (const o of orbs) { const a = o.a + k * 2; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, py = y0 + o.h * (1 - k * 0.6); o.m.position.set(px, py, pz); o.c.position.set(px, py, pz); o.m.quaternion.copy(camera.quaternion); o.m.scale.setScalar(1.2 + k); } }, done() { for (const o of orbs) { scene.remove(o.m, o.c); o.m.material.dispose(); o.c.geometry.dispose(); o.c.material.dispose(); } } });
    },
    // 圓頂爆炸（熱圓頂攻擊、死亡球落點）
    dome(x, z, r, color) {
      const geo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const m = new THREE.Mesh(geo, addMat(color, null, 0.7)); const c = new THREE.Mesh(geo, addMat('#ffffff', null, 0.6));
      const y = heightAt(x, z); m.position.set(x, y, z); c.position.set(x, y, z); m.renderOrder = c.renderOrder = 7; scene.add(m, c);
      pop(x, y + 3, z, color, 90, r * 4, 0.7);
      spawn({ dur: 0.75, update(k) { const e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(r * (0.2 + e)); c.scale.setScalar(r * (0.1 + e * 0.75)); m.material.opacity = 0.7 * (1 - k); c.material.opacity = 0.6 * (1 - k * 1.3); }, done() { scene.remove(m, c); geo.dispose(); m.material.dispose(); c.material.dispose(); } });
      dust.emit(x, 0.5, z, { n: 40, speed: 12, up: 0.3, spread: 0.4, color: '#c9b48a', size: 1.6, life: 1.2, gravity: 0, drag: 2, jitter: r * 0.3 });
    },
    // 能量屏障：擴張的半透明球
    barrier(h, color) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), addMat(color, null, 0.5)); m.renderOrder = 7; scene.add(m);
      spawn({ dur: 0.5, update(k) { m.position.set(h.x, heightAt(h.x, h.z) + 1.1, h.z); m.scale.setScalar(1 + k * 3.5); m.material.opacity = 0.5 * (1 - k); }, done() { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
      groundRing(h.x, h.z, color, 4.5, 0.45);
    },
    // 兩點之間拉長的手臂／繩索
    stretch(getA, getB, color, width, dur) {
      const geo = new THREE.CylinderGeometry(width, width, 1, 8); geo.translate(0, 0.5, 0); geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color })); m.castShadow = true; scene.add(m);
      const A = new THREE.Vector3(), Bv = new THREE.Vector3();
      spawn({ dur, update() { const a = getA(), b = getB(); A.set(a.x, a.y, a.z); Bv.set(b.x, b.y, b.z); m.position.copy(A); m.lookAt(Bv); m.scale.set(1, 1, Math.max(0.01, A.distanceTo(Bv))); }, done() { scene.remove(m); geo.dispose(); m.material.dispose(); } });
    },
    // 超級賽亞人變身：金色爆光與電光
    transform(h, color) {
      groundRing(h.x, h.z, color, 5, 0.6); groundRing(h.x, h.z, '#ffffff', 3, 0.4);
      billboard(burstTex, color, 6, h.x, heightAt(h.x, h.z) + 1.2, h.z, 0.4, 1.2);
      pop(h.x, 2, h.z, color, 70, 16, 0.6);
      add.emit(h.x, 1, h.z, { n: 50, speed: 8, up: 1.2, spread: 0.6, color, color2: '#ffffff', size: 0.5, life: 0.7, gravity: -2, drag: 2, jitter: 1 });
    },
    sparks(x, y, z, color) { add.emit(x, y, z, { n: 1, speed: 6, up: 0.2, spread: 3, color, color2: '#ffffff', size: 0.18, life: 0.12, gravity: 0, drag: 1, jitter: 1.2, jitterY: 1.8 }); },
    aura(x, y, z, color, n = 2) { add.emit(x, y, z, { n, speed: 0.8, up: 1.4, spread: 0.4, vy: 2.5, color, color2: '#ffffff', size: 0.45, life: 0.5, gravity: -2, drag: 2, jitter: 1.1, jitterY: 1.6 }); },
  };
  return api;
}
