// 粒子：水花、水滴、完美提竿的金色水花、船尾白沫、瀑布水霧、晨霧。一個 Points，per-particle 顏色／大小／透明度。
import * as THREE from 'three';

const MAX = 900;
export function createFx(scene) {
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 4), size = new Float32Array(MAX);
  const P = Array.from({ length: MAX }, () => ({ life: 0 }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 400 }, ...THREE.UniformsLib.fog }, fog: true,
    vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vCol;
      #include <fog_pars_vertex>
      void main(){ vCol = aCol; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = aSize * uScale / -mvPosition.z;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec4 vCol;
      #include <fog_pars_fragment>
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
        float a = vCol.a * smoothstep(0.5, 0.18, r); gl_FragColor = vec4(vCol.rgb, a);
        #include <fog_fragment>
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.renderOrder = 4;
  scene.add(pts);
  let next = 0;
  const C = { water: new THREE.Color('#eef7f2'), foam: new THREE.Color('#f4f8f2'), gold: new THREE.Color('#ffd27a'), mist: new THREE.Color('#e9f0ee'), spark: new THREE.Color('#fff2c4') };
  function emit(x, y, z, o) {
    const p = P[next]; next = (next + 1) % MAX;
    p.x = x; p.y = y; p.z = z; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = p.max = o.life || 1; p.size = o.size || 0.15; p.grow = o.grow || 0; p.g = o.g ?? 9.8; p.drag = o.drag || 0;
    p.c = o.c || C.water; p.a = o.a ?? 0.9; p.floor = o.floor ?? -0.05;
  }
  const api = {
    splash(x, z, n = 14, power = 1, kind = 'water') {
      const c = kind === 'gold' ? C.gold : C.water;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, s = (0.6 + Math.random() * 1.6) * power;
        emit(x, 0.05, z, { vx: Math.cos(a) * s * 0.6, vz: Math.sin(a) * s * 0.6, vy: 1.6 * power + Math.random() * 2.2 * power, life: 0.5 + Math.random() * 0.5, size: 0.07 + Math.random() * 0.12, c, a: 0.95 });
      }
      if (kind === 'gold') for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28; emit(x, 0.3, z, { vx: Math.cos(a) * 1.2, vz: Math.sin(a) * 1.2, vy: 2 + Math.random() * 2.5, life: 0.9 + Math.random() * 0.5, size: 0.08, c: C.spark, g: 3, a: 1 }); }
    },
    drip(x, y, z) { emit(x, y, z, { vy: -0.2, life: 0.5, size: 0.05, a: 0.8 }); },
    foam(x, z, vx, vz) { emit(x + (Math.random() - 0.5) * 0.3, 0.03, z + (Math.random() - 0.5) * 0.3, { vx: vx * 0.3, vz: vz * 0.3, vy: 0, g: 0, life: 1.4 + Math.random() * 0.8, size: 0.16 + Math.random() * 0.14, grow: 0.25, c: C.foam, a: 0.55, drag: 1.2 }); },
    mist(x, y, z, big = 1) { emit(x, y, z, { vx: (Math.random() - 0.5) * 1.2, vz: 0.4 + Math.random() * 1.0, vy: 0.5 + Math.random() * 1.2, g: -0.1, life: 2.5 + Math.random() * 2, size: (1.2 + Math.random() * 1.6) * big, grow: 0.8, c: C.mist, a: 0.22, drag: 0.4 }); },
    haze(x, y, z) { emit(x, y, z, { vx: 0.3 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.2, vy: 0.02, g: 0, life: 6 + Math.random() * 4, size: 5 + Math.random() * 4, grow: 0.3, c: C.mist, a: 0.12, drag: 0 }); },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = P[i];
        if (p.life <= 0) { size[i] = 0; col[i * 4 + 3] = 0; continue; }
        p.life -= dt;
        p.vy -= p.g * dt;
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vz *= k;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < p.floor && p.g > 0) { p.life = 0; }
        p.size += p.grow * dt;
        const t = p.life / p.max;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        col[i * 4] = p.c.r; col[i * 4 + 1] = p.c.g; col[i * 4 + 2] = p.c.b; col[i * 4 + 3] = p.a * Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 8);
        size[i] = p.size;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aCol.needsUpdate = true; geo.attributes.aSize.needsUpdate = true;
    },
    setScale(h) { mat.uniforms.uScale.value = h * 0.9; },
  };
  return api;
}
