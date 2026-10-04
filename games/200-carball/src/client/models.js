// 車與球的模型：全部程式建模。車身是側面輪廓擠出、再修圓角的楔形跑車，四輪會轉向、會隨懸吊上下。
import * as THREE from 'three';
import { CAR, BALL } from '../core/const.js';
import { COLORS } from './scene.js';
import { soccerTexture } from './textures.js';

function sideProfile(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

// 放樣：每個斷面 [z, 半寬, 底, 頂]，斷面是圓角矩形，越往上越窄（taper）
function loft(sections, taper, M = 28) {
  const pos = [], idx = [];
  const ring = (z, hw, yb, yt) => {
    const yc = (yb + yt) / 2, hh = (yt - yb) / 2;
    for (let i = 0; i < M; i++) {
      const a = (i / M) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      // 超橢圓（n = 5）：方中帶圓
      const x = Math.sign(c) * Math.pow(Math.abs(c), 0.4) * hw, y = Math.sign(s) * Math.pow(Math.abs(s), 0.4) * hh;
      const k = 1 - taper * Math.max(0, y / hh);
      pos.push(x * k, yc + y, z);
    }
  };
  for (const [z, hw, yb, yt] of sections) ring(z, hw, yb, yt);
  for (let j = 0; j < sections.length - 1; j++) {
    for (let i = 0; i < M; i++) {
      const a = j * M + i, b = j * M + (i + 1) % M, c = (j + 1) * M + (i + 1) % M, d = (j + 1) * M + i;
      idx.push(a, d, c, a, c, b);
    }
  }
  // 兩端封口
  const n = pos.length / 3;
  for (const [j, flip] of [[0, true], [sections.length - 1, false]]) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < M; i++) { cx += pos[(j * M + i) * 3]; cy += pos[(j * M + i) * 3 + 1]; cz += pos[(j * M + i) * 3 + 2]; }
    pos.push(cx / M, cy / M, cz / M);
    const ci = pos.length / 3 - 1;
    for (let i = 0; i < M; i++) { const a = j * M + i, b = j * M + (i + 1) % M; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  }
  void n;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 側面輪廓（z 向前、y 向上），擠出方向是車寬
function extrudeSide(pts, width, bevel) {
  const g = new THREE.ExtrudeGeometry(sideProfile(pts), { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  // ExtrudeGeometry 在 shape 的 xy 平面上、往 +z 擠出；轉成 z 向前、x 是寬
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function buildCar(team) {
  const root = new THREE.Group();
  const body = new THREE.Group();          // 車身（相對原點）
  root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color: COLORS.team[team], roughness: team === 0 ? 0.42 : 0.3, metalness: team === 0 ? 0.1 : 0.35, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d1b19', roughness: 0.7, metalness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: team === 0 ? '#2e2b27' : COLORS.accent[1], roughness: 0.55, metalness: 0.35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#141a1c', roughness: 0.08, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.92 });
  const lamp = new THREE.MeshBasicMaterial({ color: '#f3ead2' });
  const tail = new THREE.MeshBasicMaterial({ color: team === 0 ? '#ff5a3c' : '#ffb347' });

  // 主車身：沿車長放樣的圓角斷面，上窄下寬（tumblehome），低鼻高尾
  const hull = new THREE.Mesh(loft([
    [-0.745, 0.36, 0.11, 0.29], [-0.72, 0.41, 0.075, 0.335], [-0.55, 0.43, 0.06, 0.355], [-0.25, 0.435, 0.06, 0.35],
    [0.10, 0.435, 0.06, 0.32], [0.42, 0.425, 0.06, 0.27], [0.66, 0.40, 0.065, 0.205], [0.80, 0.34, 0.08, 0.14], [0.835, 0.26, 0.10, 0.115],
  ], 0.1), paint);
  hull.castShadow = true;
  body.add(hull);
  // 底盤裙邊
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 1.42), dark);
  skirt.position.set(0, 0.065, 0.04);
  body.add(skirt);
  // 座艙（深色玻璃），上窄下寬
  const cabin = new THREE.Mesh(loft([
    [-0.47, 0.30, 0.30, 0.345], [-0.40, 0.315, 0.30, 0.45], [-0.16, 0.305, 0.30, 0.505], [0.06, 0.29, 0.29, 0.49],
    [0.24, 0.27, 0.27, 0.40], [0.34, 0.25, 0.26, 0.30],
  ], 0.32), glass);
  cabin.castShadow = true;
  body.add(cabin);
  // 擴散器與後保桿
  const diff = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.06), dark);
  diff.position.set(0, 0.12, -0.74);
  body.add(diff);
  // 尾翼
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.03, 0.18), trim);
  wing.position.set(0, 0.47, -0.62);
  wing.rotation.x = -0.12;
  body.add(wing);
  for (const sx of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.1), trim);
    st.position.set(sx * 0.3, 0.4, -0.6);
    body.add(st);
  }
  // 側邊色帶（隊色深色）
  for (const sx of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.045, 1.0), trim);
    band.position.set(sx * 0.425, 0.17, 0.02);
    body.add(band);
  }
  // 車燈
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.02), lamp);
    hl.position.set(sx * 0.24, 0.135, 0.83);
    hl.rotation.x = -0.5;
    body.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.02), tail);
    tl.position.set(sx * 0.24, 0.27, -0.735);
    body.add(tl);
  }
  // 噴射口
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.12, 14, 1, true), dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.2, -0.75);
  body.add(nozzle);

  // 輪子
  const tireM = new THREE.MeshStandardMaterial({ color: '#191817', roughness: 0.9 });
  const rimM = new THREE.MeshStandardMaterial({ color: '#c9c2b4', roughness: 0.35, metalness: 0.8 });
  const wheels = CAR.WHEELS.map((w) => {
    const r = w.front ? 0.165 : 0.185;
    const pivot = new THREE.Group();      // 轉向
    const spin = new THREE.Group();       // 滾動
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 22), tireM);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.165, 6), rimM);
    rim.rotation.z = Math.PI / 2;
    spin.add(tire, rim);
    pivot.add(spin);
    pivot.position.set(Math.sign(w.x) * (w.front ? 0.4 : 0.41), w.y - 0.2, w.z);
    root.add(pivot);
    return { pivot, spin, def: w, r };
  });

  // 加速火焰：兩層錐體，外層暖、內層亮
  const flameM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uPow: { value: 0 }, uCol: { value: new THREE.Color('#ffb347') }, uCore: { value: new THREE.Color('#fff4d6') } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uT, uPow; uniform vec3 uCol, uCore; varying vec2 vUv;
      void main(){ float along = vUv.y; float n = sin(vUv.x*25.0 + uT*40.0)*0.5+0.5;
        float a = smoothstep(0.0, 0.25, along) * (0.45 + 0.35*n) * uPow * 0.8;
        vec3 c = mix(uCol, uCore, smoothstep(0.55, 1.0, along));
        gl_FragColor = vec4(c * a, a); }`,
  });
  const flameG = new THREE.ConeGeometry(0.1, 0.9, 16, 1, true);
  flameG.translate(0, -0.45, 0);
  flameG.rotateX(-Math.PI / 2);
  const flame = new THREE.Mesh(flameG, flameM);
  flame.position.set(0, 0.2, -0.78);
  flame.visible = false;
  body.add(flame);

  root.userData = { wheels, flame, flameM, body, paint };
  return root;
}

// 依物理狀態擺好車：位置、姿態、輪子轉向／高度／滾動、火焰
export function poseCar(obj, pos, quat, st, time) {
  obj.position.set(pos.x, pos.y, pos.z);
  obj.quaternion.set(quat.x, quat.y, quat.z, quat.w);
  const u = obj.userData;
  for (let i = 0; i < 4; i++) {
    const w = u.wheels[i];
    const dist = st.wheels ? st.wheels[i].dist : 0.36;
    const y = w.def.y - Math.min(dist, 0.41) + (w.r - 0.04);
    w.pivot.position.y += (y - w.pivot.position.y) * 0.5;
    w.pivot.rotation.y = w.def.front ? -st.steerVis : 0;
    w.spin.rotation.x = st.spin;
  }
  u.flame.visible = st.boosting;
  if (st.boosting) {
    u.flameM.uniforms.uT.value = time;
    u.flameM.uniforms.uPow.value = 0.85 + Math.sin(time * 60) * 0.15;
    u.flame.scale.set(1, 1, 0.8 + Math.random() * 0.45);
  }
}

export function buildBall() {
  const g = new THREE.SphereGeometry(BALL.R, 64, 40);
  const m = new THREE.MeshStandardMaterial({ map: soccerTexture(), roughness: 0.45, metalness: 0.05, envMapIntensity: 0.9 });
  const ball = new THREE.Mesh(g, m);
  ball.castShadow = true;
  return ball;
}

// 球的落點指示：地面上正下方的暗圈，幫助判斷高度（太陽光不是正上方，所以另外畫）
export function buildBallMarker() {
  const g = new THREE.RingGeometry(0.75, 0.95, 40);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: '#1a1714', transparent: true, opacity: 0.35, depthWrite: false });
  const ring = new THREE.Mesh(g, m);
  ring.renderOrder = 2;
  return ring;
}
