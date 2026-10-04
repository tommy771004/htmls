// 球場畫面：清水模牆、鏝光地坪、天窗天花板、鐵網球門、牆上的隊名大字、補給點與燈光。
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ARENA, PADS_BIG, PADS_SMALL } from '../core/const.js';
import { boardFormTexture, floorTexture, ceilingTextures, cageTexture, stencilTexture } from './textures.js';

export const COLORS = {
  team: [new THREE.Color('#e9e3d4'), new THREE.Color('#1c1a17')],       // 白堊、煤煙
  teamDeep: [new THREE.Color('#8f887c'), new THREE.Color('#0d0c0b')],
  accent: [new THREE.Color('#f4efe4'), new THREE.Color('#e2a23b')],     // 燈條、尾燈、超音速尾跡
  amber: new THREE.Color('#e2a23b'),
};

function geom(part) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(part.uvs, 2));
  g.setIndex(new THREE.BufferAttribute(part.indices, 1));
  return g;
}

export function buildScene(renderer, mesh) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c1a17');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const { A, B, H, GW, GH, GD, R1 } = ARENA;

  // 牆：清水模貼圖，彎道部分顏色深一點（車輪磨過的痕跡）
  const board = boardFormTexture();
  board.repeat.set(1 / 2.4, 1 / 2.4);
  const wallG = geom(mesh.walls);
  {
    const pos = wallG.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      let k = 1;
      if (y < R1 + 0.2) k = 0.74 + 0.26 * (y / (R1 + 0.2));
      else if (y > H - 5.4) k = 0.86;
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
    }
    wallG.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const wallM = new THREE.MeshStandardMaterial({ map: board, roughness: 0.95, vertexColors: true, color: '#d6cfc2', envMapIntensity: 0.4 });
  const walls = new THREE.Mesh(wallG, wallM);
  walls.receiveShadow = true;
  scene.add(walls);

  // 地坪
  const floorT = floorTexture();
  const L = B + GD;
  const floorG = new THREE.PlaneGeometry(2 * A, 2 * L, 1, 1);
  floorG.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorG, new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.88, metalness: 0, envMapIntensity: 0.3 }));
  floor.receiveShadow = true;
  scene.add(floor);

  // 天花板
  const [ceilT, ceilE] = ceilingTextures();
  const ceilG = new THREE.PlaneGeometry(2 * A, 2 * B);
  ceilG.rotateX(Math.PI / 2);
  ceilG.translate(0, H, 0);
  const ceil = new THREE.Mesh(ceilG, new THREE.MeshStandardMaterial({ map: ceilT, emissiveMap: ceilE, emissive: '#ffffff', emissiveIntensity: 1.25, roughness: 0.95 }));
  scene.add(ceil);

  // 球門：深色鐵板＋隊色鐵網、門框
  const goals = new THREE.Group();
  for (const side of [1, -1]) {
    const team = side > 0 ? 1 : 0;      // +Z 的門是煤煙隊守
    const goalG = geom(mesh.goals[side > 0 ? 0 : 1]);
    const back = new THREE.Mesh(goalG, new THREE.MeshStandardMaterial({ color: '#2b2824', roughness: 0.8, side: THREE.FrontSide }));
    back.material.color.lerp(COLORS.teamDeep[team], 0.35);
    const cage = new THREE.Mesh(goalG, new THREE.MeshStandardMaterial({ map: cageTexture('#d8cfbd'), transparent: true, roughness: 0.5, metalness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    cage.material.map.repeat.set(1.4, 1.4);
    goals.add(back, cage);
    // 門框：方鋼柱，隊色漆
    const frameM = new THREE.MeshStandardMaterial({ color: COLORS.team[team], roughness: 0.45, metalness: 0.2 });
    const t = 0.32;
    const zf = side * (B + 0.05);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(t, GH + t, t), frameM);
      post.position.set(sx * (GW + t / 2), (GH + t) / 2, zf);
      post.castShadow = true;
      goals.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2 * GW + 2 * t, t, t), frameM);
    bar.position.set(0, GH + t / 2, zf);
    goals.add(bar);
    // 門內頂端的燈條
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2 * GW - 0.6, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: COLORS.accent[team].clone().multiplyScalar(1.4) }));
    strip.position.set(0, GH - 0.15, side * (B + GD - 0.4));
    goals.add(strip);
    // 牆上的隊名大字（球門上方）
    const name = team === 0 ? '白堊' : '煤煙';
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshStandardMaterial({ map: stencilTexture(name, team === 0 ? 'CHALK · HOME' : 'SOOT · AWAY', '#' + COLORS.team[team].getHexString()), transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    decal.position.set(0, GH + 5.2, side * (B - 0.02));
    decal.rotation.y = side > 0 ? Math.PI : 0;
    goals.add(decal);
  }
  scene.add(goals);

  // 牆上的隊色腰線（兩個半場各自的顏色）
  scene.add(buildStripe(mesh, 7.2, 7.75, 0));
  scene.add(buildStripe(mesh, 7.2, 7.75, 1));

  // 燈光：天窗的冷白主光（陰影）＋環境半球光
  const hemi = new THREE.HemisphereLight('#e4e8ea', '#5c5247', 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#f4f1ea', 1.9);
  sun.position.set(8, 60, 14);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -A - 2; sc.right = A + 2; sc.top = L + 2; sc.bottom = -L - 2; sc.near = 20; sc.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const pads = buildPads(scene);
  return { scene, pads, sun, floor, walls };
}

function buildStripe(mesh, y0, y1, team) {
  const st = mesh.stations;
  const pos = [], idx = [];
  const { RC } = ARENA;
  const r = RC - 0.03;
  for (let i = 0; i <= st.length; i++) {
    const s = st[i % st.length];
    const x = s.px + s.nx * r, z = s.pz + s.nz * r;
    pos.push(x, y0, z, x, y1, z);
  }
  for (let i = 0; i < st.length; i++) {
    const s = st[i], s2 = st[(i + 1) % st.length];
    const zm = (s.pz + s.nz * RC + s2.pz + s2.nz * RC) / 2;
    if ((zm < 0) !== (team === 0)) continue;
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: COLORS.team[team], roughness: 0.8, side: THREE.DoubleSide }));
  return m;
}

// 補給點：大的是一顆會轉的琥珀色能量核，小的是地上的圓片
function buildPads(scene) {
  const list = [];
  const baseM = new THREE.MeshStandardMaterial({ color: '#3a3631', roughness: 0.6, metalness: 0.7 });
  const coreM = new THREE.MeshStandardMaterial({ color: '#e2a23b', emissive: '#e2a23b', emissiveIntensity: 1.6, roughness: 0.3 });
  const coreOff = new THREE.MeshStandardMaterial({ color: '#4a3d2b', roughness: 0.6 });
  const bigBase = new THREE.CylinderGeometry(1.5, 1.7, 0.16, 32);
  const bigCore = new THREE.OctahedronGeometry(0.62, 0);
  const smallBase = new THREE.CylinderGeometry(0.62, 0.7, 0.07, 24);
  const smallCore = new THREE.CylinderGeometry(0.36, 0.36, 0.09, 6);
  for (const [x, z] of PADS_BIG) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(bigBase, baseM); base.position.y = 0.08; base.receiveShadow = true;
    const core = new THREE.Mesh(bigCore, coreM); core.position.y = 1.05; core.castShadow = true;
    g.add(base, core);
    scene.add(g);
    list.push({ group: g, core, big: true, on: coreM, off: coreOff });
  }
  for (const [x, z] of PADS_SMALL) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(smallBase, baseM); base.position.y = 0.035;
    const core = new THREE.Mesh(smallCore, coreM); core.position.y = 0.07;
    g.add(base, core);
    scene.add(g);
    list.push({ group: g, core, big: false, on: coreM, off: coreOff });
  }
  return list;
}
