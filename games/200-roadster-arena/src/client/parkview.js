// 特技場的畫面：夜色、黑地坪、紅霓虹邊線與地面紅光、探照燈塔、泛光燈、招牌、聯結車與一排車、環、加速墊、引導線。
import {
  Scene, Group, Mesh, InstancedMesh, Points, BufferGeometry, Float32BufferAttribute, PlaneGeometry, BoxGeometry, CylinderGeometry, TorusGeometry,
  SphereGeometry, ConeGeometry, TubeGeometry, CatmullRomCurve3, Vector3, Color, Matrix4, Quaternion, Euler, Object3D,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, PointsMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace,
  AdditiveBlending, DoubleSide, BackSide, FogExp2, HemisphereLight, DirectionalLight, LinearMipmapLinearFilter,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PARK, RINGS, PADS, TOWERS, TA } from '../core/park.js';
import { sedanGeometry } from './roadster.js';

export const NEON = new Color(5.2, 0.32, 0.22);

export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}

function geoFrom(m) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(m.uvs, 2));
  g.setIndex([...m.indices]);
  return g;
}

// 霓虹管：折線 → 細管，全部合併成一份
function neonGeometry(lines, radius = 0.09) {
  const gs = [];
  for (const line of lines) {
    if (line.length < 2) continue;
    const pts = line.map((p) => new Vector3(p[0], p[1] + 0.02, p[2]));
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    const curve = pts.length === 2 ? null : new CatmullRomCurve3(pts, false, 'centripetal', 0.1);
    const g = curve ? new TubeGeometry(curve, Math.max(8, Math.ceil(len / 1.2)), radius, 4, false)
      : new TubeGeometry(new CatmullRomCurve3([pts[0], pts[0].clone().lerp(pts[1], 0.5), pts[1]]), Math.max(2, Math.ceil(len / 4)), radius, 4, false);
    gs.push(g.toNonIndexed());
  }
  return mergeGeometries(gs);
}

// 地面紅光：霓虹邊線投到地面的帶狀光暈（只取貼近地面的段落）
function floorGlowGeometry(lines, width = 2.6) {
  const pos = [], uv = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const h = Math.min(a[1], b[1]);
      if (h > 6) continue;
      const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz);
      if (l < 0.05) continue;
      const nx = -dz / l * width, nz = dx / l * width;
      const k = Math.max(0, 1 - h / 6);
      const q = [[a[0] - nx, a[2] - nz, 0, k], [a[0] + nx, a[2] + nz, 1, k], [b[0] + nx, b[2] + nz, 1, k], [b[0] - nx, b[2] - nz, 0, k]];
      for (const t of [0, 1, 2, 0, 2, 3]) { pos.push(q[t][0], 0.025, q[t][1]); uv.push(q[t][2], q[t][3]); }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

const glowMat = () => new ShaderMaterial({
  transparent: true, depthWrite: false, blending: AdditiveBlending,
  uniforms: { color: { value: new Color(1.0, 0.08, 0.05) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 color; varying vec2 vUv; void main(){ float d = abs(vUv.x - 0.5) * 2.0; float a = pow(clamp(1.0 - d, 0.0, 1.0), 2.2) * clamp(vUv.y, 0.0, 1.0); gl_FragColor = vec4(color * a * 0.32, 1.0); }',
});

// 探照燈光束：加性錐體，沿長度淡出、邊緣柔化
const beamMat = () => new ShaderMaterial({
  transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
  uniforms: { color: { value: new Color(0.9, 0.92, 1.0) }, k: { value: 0.11 } },
  vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV;
    void main(){ vT = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 color; uniform float k; varying float vT; varying vec3 vN; varying vec3 vV;
    void main(){ float edge = pow(min(abs(dot(normalize(vN), normalize(vV))), 1.0), 1.6); float fall = pow(clamp(vT, 0.0, 1.0), 1.4); gl_FragColor = vec4(color * edge * fall * k, 1.0); }`,
});

// 天空：地平線一圈暗紅的城市光，往上轉黑
const skyMat = () => new ShaderMaterial({
  side: BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec3 vP;
    void main(){
      float h = max(vP.y, 0.0);
      vec3 zen = vec3(0.004, 0.0045, 0.006), hor = vec3(0.035, 0.026, 0.024);
      vec3 c = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.45));
      float city = smoothstep(0.18, 0.0, h) * (0.6 + 0.4 * smoothstep(0.2, 1.0, dot(normalize(vP.xz + vec2(1e-5)), normalize(vec2(-0.4, 1.0)))));
      c += vec3(0.07, 0.018, 0.012) * city;
      gl_FragColor = vec4(c, 1.0);
    }`,
});

export class ParkView {
  constructor(gfx, park) {
    this.gfx = gfx;
    this.park = park;
    const s = this.scene = new Scene();
    s.fog = new FogExp2('#0d0c0d', 0.0021);
    s.environment = gfx.envMap('night');
    s.environmentIntensity = 0.55;
    s.userData.bloom = [0.62, 0.5, 0.92];
    this.time = 0;
    this.buildSky();
    this.buildGround();
    this.buildPieces();
    this.buildBoxes();
    this.buildTowers();
    this.buildRings();
    this.buildPads();
    this.buildGuide();
    this.buildSigns();
    this.hemi = new HemisphereLight('#8d94a3', '#1a1716', 1.25);
    s.add(this.hemi);
    const moon = this.moon = new DirectionalLight('#dfe4f0', 1.5);
    moon.position.set(-50, 110, -80);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 400;
    moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
    s.add(moon, moon.target);
  }

  buildSky() {
    const sky = new Mesh(new SphereGeometry(3000, 32, 16), skyMat());
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.sky = sky;
    // 星星
    const n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = rnd(), v = rnd() * 0.92 + 0.08;
      const th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 2600, y * 2600, Math.sin(th) * r * 2600], i * 3);
      const b = 0.25 + Math.pow(rnd(), 6) * 2.2;
      col.set([b, b * 0.96, b * (0.9 + rnd() * 0.2)], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    const stars = new Points(g, new PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
    this.sky.add(stars);
    // 遠山剪影
    const ring = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2;
      const h = 40 + 70 * Math.abs(Math.sin(a * 3.1 + 1.3)) * (0.5 + 0.5 * Math.sin(a * 7.7)) + 30 * Math.sin(a * 17.3) ** 2;
      ring.push([Math.cos(a) * 2300, h, Math.sin(a) * 2300]);
    }
    const mp = [];
    for (let i = 0; i < N; i++) {
      const a = ring[i], b = ring[i + 1];
      mp.push(a[0], -20, a[2], b[0], -20, b[2], b[0], b[1], b[2], a[0], -20, a[2], b[0], b[1], b[2], a[0], a[1], a[2]);
    }
    const mg = new BufferGeometry(); mg.setAttribute('position', new Float32BufferAttribute(mp, 3));
    const mtn = new Mesh(mg, new MeshBasicMaterial({ color: '#030303', fog: false, side: DoubleSide }));
    this.scene.add(mtn);
  }

  buildGround() {
    // 柏油：細顆粒＋幾道修補痕，重複貼
    const asphalt = canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#5c5c5f'; x.fillRect(0, 0, w, h);
      const img = x.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      x.putImageData(img, 0, 0);
      x.strokeStyle = 'rgba(20,20,22,.16)'; x.lineWidth = 3;
      for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(Math.random() * w, 0); x.bezierCurveTo(Math.random() * w, h * 0.3, Math.random() * w, h * 0.6, Math.random() * w, h); x.stroke(); }
    }, { repeat: [260, 260] });
    const ground = new Mesh(new PlaneGeometry(2600, 2600), new MeshStandardMaterial({ color: '#ffffff', map: asphalt, roughness: 0.78, metalness: 0.0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // 跑道：中央虛線、兩側實線、起跑格
    const runway = canvasTex(256, 2048, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = 'rgba(235,235,235,.9)';
      x.fillRect(6, 0, 6, h); x.fillRect(w - 12, 0, 6, h);
      for (let y = 0; y < h; y += 64) x.fillRect(w / 2 - 3, y, 6, 34);
    });
    const rw = new Mesh(new PlaneGeometry(36, 460), new MeshStandardMaterial({ map: runway, color: '#7a7a7a', transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    rw.rotation.x = -Math.PI / 2; rw.position.set(0, 0.01, -100);
    this.scene.add(rw);
    // 跑道兩側地上的紅色霓虹線（參考畫面的地面紅線）、圍牆頂的紅線
    const H = PARK.HALF;
    const lines = [
      [[-18, 0, -330], [-18, 0, 130]], [[18, 0, -330], [18, 0, 130]],
      [[-H, PARK.WALL_H, -H], [H, PARK.WALL_H, -H]], [[H, PARK.WALL_H, -H], [H, PARK.WALL_H, H]], [[H, PARK.WALL_H, H], [-H, PARK.WALL_H, H]], [[-H, PARK.WALL_H, H], [-H, PARK.WALL_H, -H]],
      [[-60, 0, -60], [-200, 0, -60]].map((p) => p), [[30, 0, 40], [170, 0, 40]],
    ];
    this.groundLines = lines;
    const wallMat = new MeshStandardMaterial({ color: '#141416', roughness: 0.8 });
    for (const [x, z, w, d] of [[0, H + 1, 2 * H + 4, 2], [0, -H - 1, 2 * H + 4, 2], [H + 1, 0, 2, 2 * H + 4], [-H - 1, 0, 2, 2 * H + 4]]) {
      const m = new Mesh(new BoxGeometry(w, PARK.WALL_H, d), wallMat); m.position.set(x, PARK.WALL_H / 2, z); this.scene.add(m);
    }
  }

  buildPieces() {
    const tops = [], sides = [], chev = [];
    const edges = [...this.groundLines.slice(0, 6)];
    const glowLines = [this.groundLines[0], this.groundLines[1]];
    for (const p of this.park.pieces) {
      (p.chevrons ? chev : tops).push(geoFrom(p.top));
      sides.push(geoFrom(p.side));
      for (const e of p.edges) { edges.push(e); glowLines.push(e); }
    }
    const panel = canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#8c8c90'; x.fillRect(0, 0, w, h);
      const img = x.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      x.putImageData(img, 0, 0);
      x.fillStyle = 'rgba(25,25,28,.6)'; x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h);
    }, { repeat: [1, 1] });
    panel.repeat.set(1 / 4, 1 / 4);
    const topMat = new MeshStandardMaterial({ color: '#ffffff', map: panel, roughness: 0.6, metalness: 0.1 });
    const chevTex = canvasTex(256, 512, (x, w, h) => {
      x.fillStyle = '#8c8c90'; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(245,245,245,.95)';
      for (let k = 0; k < 2; k++) {
        const y0 = k * h / 2 + 60;
        x.beginPath(); x.moveTo(w * 0.18, y0 + 120); x.lineTo(w * 0.5, y0); x.lineTo(w * 0.82, y0 + 120); x.lineTo(w * 0.82, y0 + 160); x.lineTo(w * 0.5, y0 + 40); x.lineTo(w * 0.18, y0 + 160); x.closePath(); x.fill();
      }
    });
    chevTex.wrapS = chevTex.wrapT = RepeatWrapping;
    chevTex.repeat.set(1 / 16, 1 / 8);
    const chevMat = new MeshStandardMaterial({ color: '#ffffff', map: chevTex, roughness: 0.55, metalness: 0.1 });
    const sideMat = new MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.75, side: DoubleSide });
    const add = (geos, mat) => { if (!geos.length) return; const m = new Mesh(mergeGeometries(geos), mat); m.receiveShadow = true; this.scene.add(m); return m; };
    add(tops, topMat); add(chev, chevMat); add(sides, sideMat);
    // U 形牆與騎牆的頂面材質要雙面（從外面也看得到）
    topMat.side = DoubleSide; chevMat.side = DoubleSide;
    this.neon = new Mesh(neonGeometry(edges, 0.1), new MeshBasicMaterial({ color: NEON }));
    this.scene.add(this.neon);
    this.glow = new Mesh(floorGlowGeometry(glowLines), glowMat());
    this.scene.add(this.glow);
  }

  buildBoxes() {
    const sedan = sedanGeometry();
    const tints = ['#1f2833', '#5b1517', '#c9c6c0', '#2b2b2e', '#46525b', '#7a6a4e', '#141414', '#8a8f94'];
    const glass = new MeshStandardMaterial({ color: '#08090a', roughness: 0.15, metalness: 0.3 });
    const trailerTex = canvasTex(1024, 256, (x, w, h) => {
      x.fillStyle = '#d8d8d6'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < w; k += 24) { x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(k, 0, 3, h); }
      x.fillStyle = '#1a1a1c'; x.font = 'italic 900 120px system-ui, sans-serif'; x.textBaseline = 'middle';
      x.fillText('HAUL / 88', 60, h / 2 + 6);
      x.fillStyle = '#b01b1f'; x.fillRect(0, h - 26, w, 10);
    });
    for (const b of this.park.boxes) {
      if (b.kind === 'parked') {
        const m = new Mesh(sedan.geometry, [new MeshStandardMaterial({ color: tints[b.tint % tints.length], roughness: 0.35, metalness: 0.5 }), glass]);
        const mats = sedan.mats.map((n) => (n === 'glass' ? glass : m.material[0]));
        m.material = mats;
        m.position.set(b.x, 0, b.z); m.rotation.y = b.yaw;
        m.castShadow = true; this.scene.add(m);
      } else if (b.kind === 'semi') {
        const g = new Group();
        const box = new Mesh(new BoxGeometry(b.hx * 2, b.hy * 2 - 1.2, b.hz * 2), [
          new MeshStandardMaterial({ map: trailerTex, roughness: 0.5 }), new MeshStandardMaterial({ map: trailerTex, roughness: 0.5 }),
          new MeshStandardMaterial({ color: '#cfcfcc', roughness: 0.5 }), new MeshStandardMaterial({ color: '#222', roughness: 0.8 }),
          new MeshStandardMaterial({ color: '#cfcfcc', roughness: 0.5 }), new MeshStandardMaterial({ color: '#cfcfcc', roughness: 0.5 }),
        ]);
        box.position.y = 0.6; g.add(box);
        const chassis = new Mesh(new BoxGeometry(b.hx * 1.6, 0.4, b.hz * 2), new MeshStandardMaterial({ color: '#111', roughness: 0.7 }));
        chassis.position.y = -b.hy + 1.0; g.add(chassis);
        for (const z of [-b.hz + 1.2, -b.hz + 2.6]) for (const x of [-b.hx + 0.3, b.hx - 0.3]) {
          const w = new Mesh(new CylinderGeometry(0.5, 0.5, 0.5, 16), new MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.9 }));
          w.rotation.z = Math.PI / 2; w.position.set(x, -b.hy + 0.5, z); g.add(w);
        }
        g.position.set(b.x, b.y, b.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.scene.add(g);
      } else if (b.kind === 'cab') {
        const g = new Group();
        const body = new Mesh(new BoxGeometry(b.hx * 2, b.hy * 2 - 0.6, b.hz * 2), new MeshStandardMaterial({ color: '#7a1216', roughness: 0.35, metalness: 0.4 }));
        body.position.y = 0.3; g.add(body);
        const win = new Mesh(new BoxGeometry(b.hx * 2 + 0.02, 0.8, 0.9), glass); win.position.set(0, b.hy - 0.6, b.hz - 0.6); g.add(win);
        for (const z of [-b.hz + 0.8, b.hz - 0.8]) for (const x of [-b.hx, b.hx]) {
          const w = new Mesh(new CylinderGeometry(0.5, 0.5, 0.4, 16), new MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.9 }));
          w.rotation.z = Math.PI / 2; w.position.set(x, -b.hy + 0.5, z); g.add(w);
        }
        g.position.set(b.x, b.y, b.z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.scene.add(g);
      } else if (b.kind === 'pillar') {
        const m = new Mesh(new BoxGeometry(b.hx * 2, b.hy * 2, b.hz * 2), new MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.6 }));
        m.position.set(b.x, b.y, b.z); this.scene.add(m);
      }
    }
    // 拱門：起終點（跑道上）與終點閘門（東側），橫樑＋霓虹框
    const arch = (x, z, yaw, span, text) => {
      const g = new Group();
      const beam = new Mesh(new BoxGeometry(span + 2.4, 2.4, 2.4), new MeshStandardMaterial({ color: '#141416', roughness: 0.5 }));
      beam.position.y = 15.2; g.add(beam);
      const frame = [[[-span / 2, 0, 0], [-span / 2, 14, 0], [span / 2, 14, 0], [span / 2, 0, 0]]];
      const n = new Mesh(neonGeometry(frame.map((l) => l.map(([a, b, c]) => [a, b, c + 1.3])), 0.16), new MeshBasicMaterial({ color: NEON }));
      const n2 = n.clone(); n2.position.z = -2.6;
      g.add(n, n2);
      const tex = canvasTex(1024, 128, (c, w, h) => {
        c.fillStyle = '#0c0c0d'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#f2efe9'; c.font = 'italic 800 76px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(text, w / 2, h / 2 + 4);
      });
      for (const sgn of [1, -1]) {
        const sign = new Mesh(new PlaneGeometry(span * 0.7, span * 0.7 / 8), new MeshBasicMaterial({ map: tex, color: new Color(1.4, 1.4, 1.4) }));
        sign.position.set(0, 15.2, 1.22 * sgn); sign.rotation.y = sgn > 0 ? 0 : Math.PI; g.add(sign);
      }
      g.position.set(x, 0, z); g.rotation.y = yaw;
      this.scene.add(g);
    };
    arch(0, -280, 0, 50, 'START / FINISH');
    arch(70, -240, Math.PI / 2, 56, 'FINISH');
  }

  buildTowers() {
    this.beams = [];
    const steel = new MeshStandardMaterial({ color: '#202024', roughness: 0.6, metalness: 0.5 });
    const lampMat = new MeshBasicMaterial({ color: new Color(6, 6, 5.6) });
    const beamGeo = new CylinderGeometry(0.6, 16, 420, 24, 1, true);
    beamGeo.translate(0, -210, 0);
    // uv.y：0 在燈頭、1 在遠端 → 反過來讓燈頭最亮
    const uvs = beamGeo.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setY(i, uvs.getY(i));
    const bm = beamMat();
    const poolTex = canvasTex(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,248,236,.55)'); g.addColorStop(0.4, 'rgba(255,248,236,.18)'); g.addColorStop(1, 'rgba(255,248,236,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });
    const poolMat = new MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: AdditiveBlending });
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const [x, z] of TOWERS) {
      const g = new Group();
      const h = 26 + rnd() * 10;
      const mast = new Mesh(new BoxGeometry(0.7, h, 0.7), steel); mast.position.y = h / 2; g.add(mast);
      const head = new Mesh(new BoxGeometry(4.2, 1.6, 0.5), steel); head.position.set(0, h, 0); g.add(head);
      for (let k = 0; k < 6; k++) { const l = new Mesh(new PlaneGeometry(0.55, 0.55), lampMat); l.position.set(-1.5 + (k % 3) * 1.5, h + (k < 3 ? 0.35 : -0.35), 0.27); g.add(l); }
      // 兩道會掃動的探照燈
      for (let k = 0; k < 2; k++) {
        const pivot = new Group(); pivot.position.set(k ? 1.6 : -1.6, h + 1.2, 0);
        const beam = new Mesh(beamGeo, bm);
        beam.rotation.x = Math.PI; // 光束往上
        pivot.add(beam);
        g.add(pivot);
        this.beams.push({ pivot, ph: rnd() * Math.PI * 2, sp: 0.12 + rnd() * 0.15, tilt: 0.25 + rnd() * 0.35, dir: rnd() * Math.PI * 2 });
      }
      const pool = new Mesh(new PlaneGeometry(70, 70), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.03, 18);
      g.add(pool);
      g.position.set(x, 0, z);
      g.lookAt(0, 0, 0);
      this.scene.add(g);
    }
  }

  buildRings() {
    this.rings = RINGS.map((r) => {
      const m = new Mesh(new TorusGeometry(r.r, 0.28, 10, 64), new MeshBasicMaterial({ color: new Color(5.5, 0.3, 0.22) }));
      m.position.set(r.x, r.y, r.z);
      m.lookAt(r.x + r.axis[0], r.y + r.axis[1], r.z + r.axis[2]);
      this.scene.add(m);
      return m;
    });
    // Time Attack 的檢查點環
    const gates = [...TA.gates];
    this.gates = gates.map((gt) => {
      const g = new Group();
      const ring = new Mesh(new TorusGeometry(gt.r, 0.34, 12, 80), new MeshBasicMaterial({ color: new Color(4, 4, 4.2) }));
      g.add(ring);
      g.position.set(gt.x, gt.y, gt.z);
      g.lookAt(gt.x + gt.dir[0], gt.y + gt.dir[1], gt.z + gt.dir[2]);
      g.visible = false;
      this.scene.add(g);
      return { g, ring };
    });
  }

  buildPads() {
    const tex = canvasTex(128, 256, (x, w, h) => {
      x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h);
      x.fillStyle = 'rgba(160,215,255,1)';
      for (let k = 0; k < 2; k++) {
        const y0 = k * 128 + 20;
        x.beginPath(); x.moveTo(10, y0 + 70); x.lineTo(64, y0); x.lineTo(118, y0 + 70); x.lineTo(118, y0 + 96); x.lineTo(64, y0 + 26); x.lineTo(10, y0 + 96); x.closePath(); x.fill();
      }
    });
    tex.wrapS = tex.wrapT = RepeatWrapping;
    this.padTex = tex;
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending, color: new Color(1.6, 1.8, 2.2) });
    const frameMat = new MeshBasicMaterial({ color: new Color(0.6, 1.2, 2.6) });
    for (const p of PADS) {
      const m = new Mesh(new PlaneGeometry(6, 10), mat);
      m.position.set(p.x, 0.04, p.z);
      // 先轉 yaw 再躺平，箭頭朝 yaw 方向
      m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, p.yaw + Math.PI, 0);
      this.scene.add(m);
      const f = new Mesh(neonGeometry([[[-3, 0, -5], [-3, 0, 5]], [[3, 0, -5], [3, 0, 5]]], 0.07), frameMat);
      f.position.set(p.x, 0.02, p.z); f.rotation.y = p.yaw;
      this.scene.add(f);
    }
  }

  // Time Attack 引導線：地上一串發光短線，沿路線往前流動
  buildGuide() {
    const pts = TA.guide.map(([x, z]) => new Vector3(x, 0.06, z));
    const curve = new CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const n = Math.floor(len / 3.2);
    const dash = new PlaneGeometry(0.5, 1.6);
    dash.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ color: new Color(1.4, 2.0, 3.2), transparent: true, depthWrite: false, blending: AdditiveBlending });
    const im = new InstancedMesh(dash, mat, n);
    const m = new Matrix4(), q = new Quaternion(), e = new Euler();
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      e.set(0, Math.atan2(tg.x, tg.z), 0); q.setFromEuler(e);
      m.compose(p, q, new Vector3(1, 1, 1));
      im.setMatrixAt(i, m);
    }
    im.visible = false;
    this.guide = im;
    this.guideMat = mat;
    this.scene.add(im);
  }

  buildSigns() {
    const mk = (text, w) => canvasTex(1024, 256, (c, W, H) => {
      c.fillStyle = '#0b0b0c'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#ff3a2e'; c.lineWidth = 6; c.strokeRect(10, 10, W - 20, H - 20);
      c.fillStyle = '#f4f1ea'; c.font = 'italic 800 120px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(text, W / 2, H / 2 + 8, W - 80);
    });
    const post = new MeshStandardMaterial({ color: '#1b1b1e', roughness: 0.6 });
    for (const p of this.park.pieces) {
      if (!p.label || !p.sign) continue;
      const g = new Group();
      const W = 18, H = 4.5;
      const panel = new Mesh(new PlaneGeometry(W, H), new MeshBasicMaterial({ map: mk(p.label), color: new Color(1.3, 1.3, 1.3), side: DoubleSide }));
      g.add(panel);
      for (const x of [-W / 2 + 1, W / 2 - 1]) { const pole = new Mesh(new BoxGeometry(0.4, p.sign[1], 0.4), post); pole.position.set(x, -p.sign[1] / 2, -0.3); g.add(pole); }
      g.position.set(p.sign[0], p.sign[1], p.sign[2]);
      g.rotation.y = p.F.yaw + Math.PI;
      this.scene.add(g);
    }
  }

  setGates(next, visible) {
    this.gates.forEach((g, i) => {
      g.g.visible = visible && i >= next;
      const on = i === next;
      g.ring.material.color.setScalar(on ? 4.2 : 0.7);
    });
    this.guide.visible = visible;
  }

  update(dt, focus) {
    this.time += dt;
    const t = this.time;
    for (const b of this.beams) {
      const a = b.dir + Math.sin(t * b.sp + b.ph) * 0.9;
      b.pivot.rotation.set(Math.sin(a) * b.tilt, 0, Math.cos(a) * b.tilt);
    }
    for (const r of this.rings) r.rotation.z += dt * 0.6;
    this.padTex.offset.y = (t * 1.6) % 1;
    this.guideMat.opacity = 0.65 + 0.35 * Math.sin(t * 5);
    if (focus) {
      // 影子相機跟著焦點
      this.moon.position.set(focus.x - 50, focus.y + 110, focus.z - 80);
      this.moon.target.position.set(focus.x, focus.y, focus.z);
      this.moon.target.updateMatrixWorld();
      this.sky.position.set(focus.x, 0, focus.z);
    }
  }
}
