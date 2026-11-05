// 遊戲動態事件演出（「事」）：2 個 InstancedMesh 統包腳步墨塵、落地氣浪、抓壁碎石、拔刀飛墨、
// 梵鐘音波震盪、石燈點火流螢、香爐裊裊青煙、寒潭水紋與冰縫碎霜。
import * as THREE from 'three';

function blotTexture() {
  const S = 128;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  let s = 57; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const rg = g.createRadialGradient(64, 64, 4, 64, 64, 58);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.45, 'rgba(255,255,255,0.72)');
  rg.addColorStop(0.8, 'rgba(255,255,255,0.22)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 46 + (i === 0 || i === 24 ? 6 : rnd() * 14);
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}

function ringTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(128, 128);
  for (let i = 0; i < 6; i++) {
    const r = 92 + i * 4.2;
    g.strokeStyle = `rgba(255,255,255,${(0.75 - i * 0.11).toFixed(2)})`;
    g.lineWidth = 5.5 - i * 0.65;
    g.beginPath();
    g.arc(0, 0, r, i * 0.35, i * 0.35 + Math.PI * (1.82 - i * 0.08));
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

export function makeVFX(scene) {
  // ---------- 1. 公告板粒子池（墨點、煙塵、雪沫、流螢、香煙） ----------
  const NP = 120;
  const pPos = new Float32Array(NP * 4);
  const pCol = new Float32Array(NP * 4);
  const pGeo = new THREE.PlaneGeometry(1, 1);
  const aPos = new THREE.InstancedBufferAttribute(pPos, 4);
  const aCol = new THREE.InstancedBufferAttribute(pCol, 4);
  aPos.setUsage(THREE.DynamicDrawUsage);
  aCol.setUsage(THREE.DynamicDrawUsage);
  pGeo.setAttribute('aPos', aPos);
  pGeo.setAttribute('aCol', aCol);

  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTex: { value: blotTexture() } },
    vertexShader: /* glsl */`
      attribute vec4 aPos; attribute vec4 aCol;
      varying vec2 vUv; varying vec4 vCol;
      void main(){
        if (aCol.a <= 0.002 || aPos.w <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); vUv = uv; return; }
        vec4 mv = viewMatrix * vec4(aPos.xyz, 1.0);
        mv.xy += position.xy * aPos.w;
        vUv = uv; vCol = aCol;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex; varying vec2 vUv; varying vec4 vCol;
      void main(){
        float m = texture2D(uTex, vUv).a;
        if (m * vCol.a < 0.01) discard;
        gl_FragColor = vec4(vCol.rgb, m * vCol.a);
        #include <colorspace_fragment>
      }`,
  });
  const puffMesh = new THREE.InstancedMesh(pGeo, pMat, NP);
  puffMesh.frustumCulled = false;
  puffMesh.userData.noBake = true;
  scene.add(puffMesh);

  const P = Array.from({ length: NP }, () => ({ t: 0, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, s0: 0, s1: 0, r: 0, gr: 0, b: 0, a: 0, swirl: 0 }));
  let pHead = 0;
  const colTmp = new THREE.Color();

  function emitPuff({ x, y, z, vx = 0, vy = 0.5, vz = 0, g = 0, s0 = 0.12, s1 = 0.36, life = 0.65, color = 0x22232a, alpha = 0.6, swirl = 0 }) {
    const q = P[pHead]; pHead = (pHead + 1) % NP;
    colTmp.setHex(color);
    q.t = 0; q.life = life; q.x = x; q.y = y; q.z = z;
    q.vx = vx; q.vy = vy; q.vz = vz; q.g = g;
    q.s0 = s0; q.s1 = s1; q.r = colTmp.r; q.gr = colTmp.g; q.b = colTmp.b; q.a = alpha; q.swirl = swirl;
  }

  // ---------- 2. 3D 水墨氣浪／音波／水紋環池 ----------
  const NR = 28;
  const rCol = new Float32Array(NR * 4);
  const rGeo = new THREE.PlaneGeometry(2, 2);
  const arCol = new THREE.InstancedBufferAttribute(rCol, 4);
  arCol.setUsage(THREE.DynamicDrawUsage);
  rGeo.setAttribute('aCol', arCol);
  const rMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTex: { value: ringTexture() } },
    vertexShader: /* glsl */`
      attribute vec4 aCol; varying vec2 vUv; varying vec4 vCol;
      void main(){
        if (aCol.a <= 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); vUv = uv; return; }
        vUv = uv; vCol = aCol;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uTex; varying vec2 vUv; varying vec4 vCol;
      void main(){
        float m = texture2D(uTex, vUv).a;
        if (m * vCol.a < 0.01) discard;
        gl_FragColor = vec4(vCol.rgb, m * vCol.a);
        #include <colorspace_fragment>
      }`,
  });
  const ringMesh = new THREE.InstancedMesh(rGeo, rMat, NR);
  ringMesh.frustumCulled = false;
  ringMesh.userData.noBake = true;
  scene.add(ringMesh);

  const R = Array.from({ length: NR }, () => ({ t: 0, life: 0, x: 0, y: 0, z: 0, rx: -Math.PI / 2, ry: 0, rz: 0, s0: 0.2, s1: 1.5, r: 0, g: 0, b: 0, a: 0 }));
  let rHead = 0;
  const rM = new THREE.Matrix4(), rQ = new THREE.Quaternion(), rE = new THREE.Euler(), rP = new THREE.Vector3(), rS = new THREE.Vector3();

  function emitRing({ x, y, z, rx = -Math.PI / 2, ry = 0, rz = 0, s0 = 0.25, s1 = 1.6, life = 0.7, color = 0x1e1f26, alpha = 0.65 }) {
    const q = R[rHead]; rHead = (rHead + 1) % NR;
    colTmp.setHex(color);
    q.t = 0; q.life = life; q.x = x; q.y = y; q.z = z;
    q.rx = rx; q.ry = ry; q.rz = rz; q.s0 = s0; q.s1 = s1;
    q.r = colTmp.r; q.g = colTmp.g; q.b = colTmp.b; q.a = alpha;
  }

  let sd = 17;
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);

  // ---------- 高階事件觸發器 ----------
  function footstep(x, y, z, snow = false) {
    for (let i = 0; i < 2; i++) {
      emitPuff({
        x: x + (rnd() - 0.5) * 0.22, y: y + 0.05, z: z + (rnd() - 0.5) * 0.22,
        vx: (rnd() - 0.5) * 0.45, vy: 0.25 + rnd() * 0.35, vz: (rnd() - 0.5) * 0.45,
        s0: 0.08, s1: 0.26, life: 0.42, color: snow ? 0xeef2f6 : 0x3b3834, alpha: snow ? 0.52 : 0.34,
      });
    }
  }

  function landBurst(x, y, z, snow = false, strength = 1) {
    const n = Math.round(5 + 4 * strength);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.5, sp = (0.7 + rnd() * 0.9) * strength;
      emitPuff({
        x: x + Math.cos(a) * 0.14, y: y + 0.06, z: z + Math.sin(a) * 0.14,
        vx: Math.cos(a) * sp, vy: 0.35 + rnd() * 0.55, vz: Math.sin(a) * sp, g: -1.2,
        s0: 0.12, s1: 0.38 * strength + 0.12, life: 0.52, color: snow ? 0xf2f5f8 : 0x2c2b29, alpha: snow ? 0.62 : 0.45,
      });
    }
    emitRing({ x, y: y + 0.03, z, rz: rnd() * 6.28, s0: 0.22, s1: 0.85 + 0.45 * strength, life: 0.45, color: snow ? 0xdde5ec : 0x24242b, alpha: 0.48 });
  }

  function grabSparks(x, y, z, snow = false) {
    for (let i = 0; i < 6; i++) {
      emitPuff({
        x: x + (rnd() - 0.5) * 0.5, y: y + (rnd() - 0.5) * 0.12, z: z + (rnd() - 0.5) * 0.18,
        vx: (rnd() - 0.5) * 0.8, vy: -0.2 + rnd() * 0.5, vz: (rnd() - 0.5) * 0.6, g: -4.2,
        s0: 0.06, s1: 0.16, life: 0.48, color: snow ? 0xd9e8f0 : 0x1d1e24, alpha: 0.65,
      });
    }
  }

  function slashInk(x, y, z, yaw) {
    for (let i = 0; i < 8; i++) {
      const a = yaw + (rnd() - 0.5) * 1.9;
      const sp = 1.6 + rnd() * 2.2;
      emitPuff({
        x: x + Math.sin(a) * 0.45, y: y + 1.05 + (rnd() - 0.5) * 0.18, z: z + Math.cos(a) * 0.45,
        vx: Math.sin(a) * sp, vy: (rnd() - 0.4) * 0.8, vz: Math.cos(a) * sp, g: -2.5,
        s0: 0.07, s1: 0.20, life: 0.38 + rnd() * 0.18, color: i % 4 === 0 ? 0xa63a2d : 0x14151a, alpha: 0.78,
      });
    }
  }

  function bellWave(x, y, z) {
    // 三道交錯擴散的梵鐘音波環（垂直雙向＋水平地面氣浪）＋震落金墨微塵
    emitRing({ x, y: y + 1.8, z, rx: 0, ry: 0, rz: rnd() * 3, s0: 0.45, s1: 4.8, life: 1.15, color: 0xc89a4b, alpha: 0.75 });
    emitRing({ x, y: y + 1.8, z, rx: 0, ry: Math.PI / 2, rz: rnd() * 3, s0: 0.45, s1: 4.6, life: 1.15, color: 0x1b1c22, alpha: 0.62 });
    emitRing({ x, y: y + 0.05, z, rx: -Math.PI / 2, rz: rnd() * 6, s0: 0.5, s1: 5.4, life: 1.25, color: 0x1b1c22, alpha: 0.58 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      emitPuff({
        x: x + Math.cos(a) * 0.4, y: y + 1.7 + (rnd() - 0.5) * 0.4, z: z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * (1.2 + rnd() * 1.4), vy: (rnd() - 0.3) * 0.9, vz: Math.sin(a) * (1.2 + rnd() * 1.4),
        s0: 0.08, s1: 0.24, life: 0.85, color: i % 2 === 0 ? 0xd9a856 : 0x1c1d24, alpha: 0.72,
      });
    }
  }

  function lanternIgnite(x, y, z) {
    emitRing({ x, y: y + 1.24, z, rx: -Math.PI / 2, s0: 0.18, s1: 2.2, life: 0.8, color: 0xffb347, alpha: 0.82 });
    emitRing({ x, y: y + 0.04, z, rx: -Math.PI / 2, s0: 0.2, s1: 1.9, life: 0.75, color: 0xa63a2d, alpha: 0.55 });
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2;
      emitPuff({
        x: x + Math.cos(a) * 0.18, y: y + 1.22, z: z + Math.sin(a) * 0.18,
        vx: Math.cos(a) * (0.4 + rnd() * 0.6), vy: 0.8 + rnd() * 1.1, vz: Math.sin(a) * (0.4 + rnd() * 0.6),
        s0: 0.07, s1: 0.02, life: 0.95, color: i % 3 === 0 ? 0xffdf8e : 0xff9d3b, alpha: 0.88, swirl: 2.2,
      });
    }
  }

  function ambientEmber(x, y, z) {
    emitPuff({
      x: x + (rnd() - 0.5) * 0.34, y: y + 1.18 + rnd() * 0.2, z: z + (rnd() - 0.5) * 0.34,
      vx: (rnd() - 0.5) * 0.18, vy: 0.36 + rnd() * 0.35, vz: (rnd() - 0.5) * 0.18,
      s0: 0.055, s1: 0.015, life: 1.35 + rnd() * 0.6, color: rnd() < 0.5 ? 0xffca6b : 0xf0833a, alpha: 0.78, swirl: 1.8,
    });
  }

  function ambientIncense(x, y, z) {
    emitPuff({
      x: x + (rnd() - 0.5) * 0.08, y, z: z + (rnd() - 0.5) * 0.08,
      vx: 0.06 + (rnd() - 0.5) * 0.08, vy: 0.42 + rnd() * 0.18, vz: -0.08 + (rnd() - 0.5) * 0.08,
      s0: 0.07, s1: 0.46, life: 2.3 + rnd() * 0.6, color: 0xd8d2c5, alpha: 0.28, swirl: 1.5,
    });
  }

  function waterRipple(x, y, z, scale = 1.6) {
    emitRing({ x, y: y + 0.025, z, rx: -Math.PI / 2, rz: rnd() * 6.28, s0: 0.35, s1: scale, life: 1.35, color: 0x8d9aa6, alpha: 0.42 });
  }

  function frostTrickle(x, y, z) {
    emitPuff({
      x: x + (rnd() - 0.5) * 1.4, y: y - 0.18, z: z + 0.32,
      vx: (rnd() - 0.5) * 0.25, vy: -0.6 - rnd() * 0.8, vz: 0.08 + rnd() * 0.15, g: -5.5,
      s0: 0.05, s1: 0.10, life: 0.55, color: 0xdaf0f8, alpha: 0.75,
    });
  }

  function update(dt, time) {
    for (let i = 0; i < NP; i++) {
      const q = P[i], o = i * 4;
      if (q.t >= q.life || q.life <= 0) {
        pCol[o + 3] = 0; pPos[o + 3] = 0;
        continue;
      }
      q.t += dt;
      const u = Math.min(1, q.t / q.life);
      q.vy += q.g * dt;
      const sw = q.swirl ? Math.sin(time * 3.1 + i) * q.swirl * dt : 0;
      q.x += q.vx * dt + sw * 0.12;
      q.y += q.vy * dt;
      q.z += q.vz * dt + sw * 0.08;
      pPos[o] = q.x; pPos[o + 1] = q.y; pPos[o + 2] = q.z;
      pPos[o + 3] = q.s0 + (q.s1 - q.s0) * u;
      pCol[o] = q.r; pCol[o + 1] = q.gr; pCol[o + 2] = q.b;
      pCol[o + 3] = q.a * Math.sin(Math.min(1, u * 4) * Math.PI * 0.5) * (1 - u);
    }
    aPos.needsUpdate = true;
    aCol.needsUpdate = true;

    for (let i = 0; i < NR; i++) {
      const q = R[i], o = i * 4;
      if (q.t >= q.life || q.life <= 0) {
        rCol[o + 3] = 0;
        continue;
      }
      q.t += dt;
      const u = Math.min(1, q.t / q.life);
      const easeOut = 1 - Math.pow(1 - u, 2.2);
      const sc = q.s0 + (q.s1 - q.s0) * easeOut;
      rP.set(q.x, q.y, q.z);
      rE.set(q.rx, q.ry, q.rz + u * 0.35);
      rQ.setFromEuler(rE);
      rS.set(sc, sc, sc);
      ringMesh.setMatrixAt(i, rM.compose(rP, rQ, rS));
      rCol[o] = q.r; rCol[o + 1] = q.g; rCol[o + 2] = q.b;
      rCol[o + 3] = q.a * (1 - u) * (1 - u * 0.4);
    }
    ringMesh.instanceMatrix.needsUpdate = true;
    arCol.needsUpdate = true;
  }

  return { update, emitPuff, emitRing, footstep, landBurst, grabSparks, slashInk, bellWave, lanternIgnite, ambientEmber, ambientIncense, waterRipple, frostTrickle };
}
