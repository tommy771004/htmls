// 特效：曳光彈、彈著粉塵、命中血霧、槍口閃光、毒圈牆、地上的戰利品標記與光柱。
import * as THREE from 'three';
import { decodeLoot, RARITY } from '../core/rules.js';
import { gunMesh } from './actors.js';

export function makeFx(scene, A) {
  const fx = { scene, tracers: [], puffs: [], lights: [] };
  // 曳光彈：共用一組線段
  const TR = 96;
  const trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 6), 3));
  trGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TR * 6), 3));
  const trLines = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  trLines.frustumCulled = false;
  scene.add(trLines);
  const tracers = Array.from({ length: TR }, () => ({ life: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), len: 0, speed: 600, t: 0 }));
  let trI = 0;
  fx.tracer = (a, b, bright = 1) => {
    const t = tracers[trI = (trI + 1) % TR];
    t.a.copy(a); t.b.copy(b); t.len = a.distanceTo(b); t.t = 0; t.life = Math.max(0.06, t.len / 700) + 0.04; t.bright = bright;
  };
  // 有下墜的子彈：每格依速度與重力前進，畫成一小段亮線
  const PJ = 24;
  const pjGeo = new THREE.BufferGeometry();
  pjGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PJ * 6), 3));
  pjGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PJ * 6), 3));
  const pjLines = new THREE.LineSegments(pjGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pjLines.frustumCulled = false; scene.add(pjLines);
  const pjs = Array.from({ length: PJ }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
  let pjI = 0;
  fx.projectile = (o, v) => { const q = pjs[pjI = (pjI + 1) % PJ]; q.p.copy(o); q.v.copy(v); q.life = 1.8; };
  fx.projectileHit = (at) => {
    // 把離命中點最近的那顆收掉
    let best = null, bd = 1e9;
    for (const q of pjs) if (q.life > 0) { const d = q.p.distanceToSquared(at); if (d < bd) { bd = d; best = q; } }
    if (best && bd < 60 * 60) best.life = 0;
  };
  // 粉塵與血霧：點精靈
  const PU = 160;
  const puGeo = new THREE.BufferGeometry();
  puGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PU * 3), 3));
  puGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PU * 3), 3));
  puGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(PU), 1));
  const puMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; varying float vA; void main(){ vC = color; vA = clamp(size, 0., 1.); vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = abs(size) * 300. / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; gl_FragColor = vec4(vC, (1. - d * 2.) * 0.75); }',
  });
  const puPts = new THREE.Points(puGeo, puMat); puPts.frustumCulled = false; scene.add(puPts);
  const puffs = Array.from({ length: PU }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), s: 0.3 }));
  let puI = 0;
  fx.puff = (pos, color, n = 4, size = 0.35, spread = 1.2) => {
    for (let k = 0; k < n; k++) {
      const q = puffs[puI = (puI + 1) % PU];
      q.p.copy(pos); q.v.set((Math.random() - 0.5) * spread, Math.random() * spread * 0.8, (Math.random() - 0.5) * spread);
      q.c.set(color); q.life = q.max = 0.35 + Math.random() * 0.4; q.s = size * (0.7 + Math.random() * 0.6);
    }
  };
  // 槍口閃光的點光源（世界）
  const flashLight = new THREE.PointLight('#ffc56e', 0, 9, 2); scene.add(flashLight);
  fx.muzzle = (pos) => { flashLight.position.copy(pos); flashLight.intensity = 18; };

  // 毒圈牆
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 160, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { time: { value: 0 }, inside: { value: 0 } },
    vertexShader: 'varying vec3 vW; varying vec2 vU; void main(){ vU = uv; vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float time, inside; varying vec3 vW; varying vec2 vU;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1))) * 43758.5); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        // 紫色毒圈牆：緩慢翻騰的雲帶＋往上竄的細閃電紋
        vec2 p = vec2(vU.x * 90., vW.y * 0.02);
        float n = vn(p + vec2(time * 0.15, -time * 0.08)) * 0.65 + vn(p * 2.3 - vec2(time * 0.22, time * 0.1)) * 0.35;
        float band = smoothstep(0.3, 0.9, n);
        vec3 c = mix(vec3(0.28,0.12,0.62), vec3(0.62,0.42,1.0), band);
        // 閃電紋：少量、左右抖動的鋸齒線，只在一小段高度亮起
        float col = vU.x * 900.;
        float sid = floor(col);
        float flick = step(0.985, hash(vec2(sid, floor(time * 4. + sid * 0.37))));
        float jag = (vn(vec2(sid * 7.1, vW.y * 0.09)) - 0.5) * 0.9 + (vn(vec2(sid, vW.y * 0.35)) - 0.5) * 0.3;
        float seg = smoothstep(0.55, 0.9, vn(vec2(sid * 3.3, vW.y * 0.012 - time * 1.5)));
        float streak = flick * smoothstep(0.12, 0.0, abs(fract(col) - 0.5 + jag)) * seg;
        c += vec3(0.62, 0.45, 1.0) * streak * 1.6;
        float h = smoothstep(460., 30., vW.y) * smoothstep(-30., 5., vW.y);
        float a = (0.36 + band * 0.24 + streak * 0.5) * h;
        float d = length(cameraPosition - vW);
        a *= smoothstep(1.5, 30., d) * mix(1., 0.8, inside);
        gl_FragColor = vec4(c, a);
      }`,
  }));
  wall.renderOrder = 5;
  scene.add(wall);
  fx.wall = wall;
  // 閃電：在鏡頭附近的毒圈牆上隨機劈下鋸齒線，配紫色閃光
  const BOLT = 3, SEG = 14;
  const bolts = Array.from({ length: BOLT }, () => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 2 * 3 * 2), 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#e8d8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    l.frustumCulled = false; scene.add(l); return { l, t: 0, next: Math.random() * 2 };
  });
  const flash = new THREE.PointLight('#a77bff', 0, 400, 1.2); scene.add(flash);
  fx.onThunder = null;
  const strike = (b, storm, camPos) => {
    // 取牆上離鏡頭最近的方向附近一點
    const a0 = Math.atan2(camPos.z - storm.z, camPos.x - storm.x) + (Math.random() - 0.5) * 0.9;
    const bx = storm.x + Math.cos(a0) * storm.r, bz = storm.z + Math.sin(a0) * storm.r;
    const top = 260 + Math.random() * 160, arr = b.l.geometry.attributes.position.array;
    let x = bx, y = top, z = bz, k = 0;
    for (let i = 0; i < SEG; i++) {
      const nx = x + (Math.random() - 0.5) * 16, ny = y - top / SEG, nz = z + (Math.random() - 0.5) * 16;
      arr.set([x, y, z, nx, ny, nz], k); k += 6;
      if (Math.random() < 0.3) { const fx2 = nx + (Math.random() - 0.5) * 30, fy = ny - 14, fz = nz + (Math.random() - 0.5) * 30; arr.set([nx, ny, nz, fx2, fy, fz], k); } else arr.fill(0, k, k + 6);
      k += 6; x = nx; y = ny; z = nz;
    }
    b.l.geometry.attributes.position.needsUpdate = true;
    b.t = 0.18; flash.position.set(bx, top * 0.5, bz); flash.intensity = 4e4;
    const d = Math.hypot(camPos.x - bx, camPos.z - bz);
    fx.onThunder?.(d);
  };
  // 下一圈的地面標線
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.995, 1, 160, 1), new THREE.MeshBasicMaterial({ color: '#fbf7ee', transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 4; scene.add(ring);
  fx.nextRing = ring;

  // 戰利品：地面光圈（instanced）、物件模型、稀有光柱
  const ringGeo = new THREE.RingGeometry(0.42, 0.55, 28); ringGeo.rotateX(-Math.PI / 2);
  const MAXL = 260;
  const lootRings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAXL);
  lootRings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXL * 3), 3);
  lootRings.count = 0; lootRings.frustumCulled = false; scene.add(lootRings);
  const beamGeo = new THREE.CylinderGeometry(0.06, 0.12, 14, 8, 1, true); beamGeo.translate(0, 7, 0);
  const beams = new THREE.InstancedMesh(beamGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying float vY; varying vec3 vC; void main(){ vY = position.y / 14.; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.); }',
    fragmentShader: 'varying float vY; varying vec3 vC; void main(){ gl_FragColor = vec4(vC, (1. - vY) * 0.55); }',
  }), 60);
  beams.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(60 * 3), 3);
  beams.count = 0; beams.frustumCulled = false; scene.add(beams);
  const itemGeos = {
    a: new THREE.BoxGeometry(0.34, 0.2, 0.22).translate(0, 0.1, 0),
    p: new THREE.BoxGeometry(0.3, 0.05, 0.38).translate(0, 0.03, 0),
    v: new THREE.BoxGeometry(0.46, 0.14, 0.52).translate(0, 0.07, 0),
  };
  const itemMats = { a: new THREE.MeshStandardMaterial({ color: '#4f5a3a', roughness: 0.7 }), p: new THREE.MeshStandardMaterial({ color: '#9cb4c0', roughness: 0.4, metalness: 0.3 }), v: new THREE.MeshStandardMaterial({ color: '#5c5440', roughness: 0.9 }) };
  // 彈藥用 Poly Haven 的軍用彈藥箱（有的話）
  const crate = A?.props?.old_military_crate;
  if (crate) {
    let mesh = null; crate.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (mesh) {
      const g = mesh.geometry.clone(); g.computeBoundingBox();
      const bb = g.boundingBox, sz = bb.getSize(new THREE.Vector3()), s = 0.5 / Math.max(sz.x, sz.z);
      g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); g.scale(s, s, s);
      itemGeos.a = g; itemMats.a = mesh.material;
    }
  }
  const itemInst = {};
  for (const k of ['a', 'p', 'v']) { const im = new THREE.InstancedMesh(itemGeos[k], itemMats[k], MAXL); im.count = 0; im.castShadow = true; im.frustumCulled = false; scene.add(im); itemInst[k] = im; }
  const weaponPool = new Map(); // id → mesh
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  let lootTimer = 0;
  fx.updateLoot = (loot, cam, dt, force) => {
    lootTimer -= dt;
    if (lootTimer > 0 && !force) return;
    lootTimer = 0.25;
    const cx = cam.position.x, cz = cam.position.z, R = 90;
    const list = [];
    for (const it of loot.values()) { const dx = it.x - cx, dz = it.z - cz, d2 = dx * dx + dz * dz; if (d2 < R * R) list.push([d2, it]); }
    list.sort((a, b) => a[0] - b[0]);
    const n = Math.min(MAXL, list.length);
    const counts = { a: 0, p: 0, v: 0 };
    let nb = 0;
    const keep = new Set();
    lootRings.count = n;
    for (let i = 0; i < n; i++) {
      const it = list[i][1], d = decodeLoot(it.code);
      dummy.position.set(it.x, it.y + 0.03, it.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(d.kind === 'w' ? 1.25 : 0.8); dummy.updateMatrix();
      lootRings.setMatrixAt(i, dummy.matrix);
      col.set(d.kind === 'w' ? RARITY[d.r].color : d.kind === 'p' ? '#9cc3d8' : d.kind === 'v' ? (d.lv === 3 ? RARITY[3].color : RARITY[2].color) : '#d8cfa8');
      lootRings.setColorAt(i, col);
      if (d.kind === 'w') {
        keep.add(it.id);
        let m = weaponPool.get(it.id);
        if (!m) { m = gunMesh(d.w, 1.6); m.position.set(it.x, it.y + 0.12, it.z); m.rotation.set(0, (it.id * 2.4) % 6.28, Math.PI / 2 - 0.1); scene.add(m); weaponPool.set(it.id, m); }
        if (d.r >= 2 && nb < 60 && list[i][0] < 70 * 70) { dummy.position.set(it.x, it.y, it.z); dummy.scale.setScalar(1); dummy.updateMatrix(); beams.setMatrixAt(nb, dummy.matrix); beams.setColorAt(nb, col); nb++; }
      } else if (itemInst[d.kind]) {
        const im = itemInst[d.kind];
        dummy.position.set(it.x, it.y + 0.02, it.z); dummy.rotation.set(0, (it.id * 1.7) % 6.28, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
        im.setMatrixAt(counts[d.kind]++, dummy.matrix);
      }
    }
    for (const [id, m] of weaponPool) if (!keep.has(id)) { scene.remove(m); weaponPool.delete(id); }
    for (const k of ['a', 'p', 'v']) { itemInst[k].count = counts[k]; itemInst[k].instanceMatrix.needsUpdate = true; }
    lootRings.instanceMatrix.needsUpdate = true; if (lootRings.instanceColor) lootRings.instanceColor.needsUpdate = true;
    beams.count = nb; beams.instanceMatrix.needsUpdate = true; if (beams.instanceColor) beams.instanceColor.needsUpdate = true;
  };
  fx.clearLoot = () => { for (const m of weaponPool.values()) scene.remove(m); weaponPool.clear(); lootRings.count = 0; beams.count = 0; for (const k of ['a', 'p', 'v']) itemInst[k].count = 0; };

  fx.update = (dt, time, storm, next, camPos) => {
    // 曳光彈：一小段亮線沿彈道前進
    const pa = trGeo.attributes.position.array, ca = trGeo.attributes.color.array;
    for (let i = 0; i < TR; i++) {
      const t = tracers[i];
      if (t.life > 0) {
        t.t += dt; t.life -= dt;
        const head = Math.min(1, (t.t * 700) / Math.max(1, t.len)), tail = Math.max(0, head - 14 / Math.max(1, t.len));
        const a = t.a.clone().lerp(t.b, tail), b = t.a.clone().lerp(t.b, head);
        pa.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        const k = Math.max(0, Math.min(1, t.life * 12)) * t.bright;
        ca.set([0.5 * k, 0.32 * k, 0.12 * k, 1 * k, 0.86 * k, 0.55 * k], i * 6);
      } else { ca.fill(0, i * 6, i * 6 + 6); }
    }
    trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
    const jp = pjGeo.attributes.position.array, jc = pjGeo.attributes.color.array;
    for (let i = 0; i < PJ; i++) {
      const q = pjs[i];
      if (q.life > 0) {
        q.life -= dt; q.v.y -= 9.8 * dt; q.p.addScaledVector(q.v, dt);
        const tail = q.p.clone().addScaledVector(q.v, -0.022);
        jp.set([tail.x, tail.y, tail.z, q.p.x, q.p.y, q.p.z], i * 6);
        jc.set([0.45, 0.3, 0.12, 1, 0.9, 0.62], i * 6);
      } else jc.fill(0, i * 6, i * 6 + 6);
    }
    pjGeo.attributes.position.needsUpdate = true; pjGeo.attributes.color.needsUpdate = true;
    const pp = puGeo.attributes.position.array, pc = puGeo.attributes.color.array, ps = puGeo.attributes.size.array;
    for (let i = 0; i < PU; i++) {
      const q = puffs[i];
      if (q.life > 0) {
        q.life -= dt; q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 3); q.v.y += dt * 0.6;
        pp[i * 3] = q.p.x; pp[i * 3 + 1] = q.p.y; pp[i * 3 + 2] = q.p.z;
        const k = q.life / q.max; pc[i * 3] = q.c.r; pc[i * 3 + 1] = q.c.g; pc[i * 3 + 2] = q.c.b; ps[i] = q.s * (1.6 - k * 0.6) * Math.min(1, k * 3);
      } else ps[i] = 0;
    }
    puGeo.attributes.position.needsUpdate = true; puGeo.attributes.color.needsUpdate = true; puGeo.attributes.size.needsUpdate = true;
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 400);
    // 毒圈
    for (const b of bolts) {
      b.t -= dt; b.next -= dt;
      b.l.material.opacity = b.t > 0 ? (0.5 + Math.random() * 0.5) : 0;
      if (storm && b.next <= 0) { b.next = 0.6 + Math.random() * 2.2; if (Math.hypot(camPos.x - storm.x, camPos.z - storm.z) > storm.r - 600) strike(b, storm, camPos); }
    }
    flash.intensity = Math.max(0, flash.intensity - dt * 2.4e5);
    if (storm) {
      wall.visible = true;
      wall.position.set(storm.x, 180, storm.z);
      wall.scale.set(Math.max(1, storm.r), 420, Math.max(1, storm.r));
      wall.material.uniforms.time.value = time;
      const dx = camPos.x - storm.x, dz = camPos.z - storm.z;
      wall.material.uniforms.inside.value = dx * dx + dz * dz < storm.r * storm.r ? 0 : 1;
    } else wall.visible = false;
    if (false && next && next.r > 1) { ring.visible = true; ring.position.set(next.x, 0.4 + Math.max(0, camPos.y - 400) * 0.02, next.z); ring.scale.set(next.r, next.r, next.r); }
    else ring.visible = false;
  };
  return fx;
}
