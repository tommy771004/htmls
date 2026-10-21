// 車球聯賽的畫面：室內夜間球場（深色牆板、地面接牆的紅霓虹、隊色球門與球門框光）、場地標線、
// 巨型足球（著色器畫五邊形與接縫）、球的落點影、加速墊、每台車的名牌。
import {
  Scene, Group, Mesh, Sprite, SpriteMaterial, BufferGeometry, Float32BufferAttribute, PlaneGeometry, SphereGeometry, CircleGeometry, RingGeometry,
  BoxGeometry, Color, Vector3, MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, CanvasTexture, SRGBColorSpace, RepeatWrapping,
  AdditiveBlending, DoubleSide, FogExp2, HemisphereLight, DirectionalLight, PointLight,
} from 'three';
import { ARENA, BALL } from '../core/const.js';
import { LEAGUE_PADS } from '../core/league.js';
import { Roadster } from './roadster.js';
import { canvasTex } from './parkview.js';

export const TEAM_COLOR = [new Color(5, 0.45, 0.32), new Color(0.6, 1.9, 4.6)];
export const TEAM_CSS = ['#ff4a3d', '#7cc4ff'];
export const TEAM_PAINT = ['signal', 'glacier'];

function geoFrom(m) {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(m.normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(m.uvs, 2));
  g.setIndex([...m.indices]);
  return g;
}

// 足球：12 個五邊形中心（二十面體頂點），片段著色器找最近的中心畫深色塊，邊界畫接縫
const ballMat = () => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map((p) => new Vector3(...p).normalize());
  return new ShaderMaterial({
    uniforms: { C: { value: v }, glow: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; varying vec3 vL;
      void main(){ vL = normalize(position); vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 C[12]; uniform float glow; varying vec3 vN; varying vec3 vW; varying vec3 vL;
      void main(){
        float a = -1.0, b = -1.0;
        for (int i = 0; i < 12; i++) { float d = dot(normalize(vL), C[i]); if (d > a) { b = a; a = d; } else if (d > b) b = d; }
        float pent = smoothstep(0.905, 0.915, a);
        float seam = 1.0 - smoothstep(0.0, 0.012, a - b);
        vec3 base = mix(vec3(0.82, 0.81, 0.79), vec3(0.03, 0.03, 0.035), pent);
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN);
        vec3 L = normalize(vec3(0.3, 1.0, 0.2));
        float diff = 0.35 + 0.65 * max(dot(normalize((viewMatrix * vec4(L, 0.0)).xyz), N), 0.0);
        float rim = pow(1.0 - max(dot(N, normalize((viewMatrix * vec4(V, 0.0)).xyz)), 0.0), 3.0);
        vec3 c = base * diff + vec3(2.6, 0.22, 0.16) * seam * (0.6 + glow) + vec3(0.25) * rim;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
};

const _tp = new Vector3();
// 名牌：畫在畫布上的小字，Sprite 永遠面向鏡頭
function nameTag(text, team) {
  const tex = canvasTex(256, 64, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.font = '600 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(0,0,0,.55)';
    const tw = Math.min(w - 8, x.measureText(text).width + 28);
    x.fillRect((w - tw) / 2, 10, tw, 44);
    x.fillStyle = TEAM_CSS[team]; x.fillRect((w - tw) / 2, 50, tw, 4);
    x.fillStyle = '#ece9e2'; x.fillText(text, w / 2, 32, w - 20);
  });
  const s = new Sprite(new SpriteMaterial({ map: tex, depthTest: true, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(4.4, 1.1, 1); s.position.y = 2.6;
  s.renderOrder = 8;
  // 近大遠小但有上下限；離鏡頭太近（自己旁邊的車）就淡掉，不擋畫面
  s.onBeforeRender = (r, sc, cam) => {
    const d = s.getWorldPosition(_tp).distanceTo(cam.position);
    const k = Math.min(1.6, Math.max(0.55, d / 22));
    s.scale.set(4.4 * k, 1.1 * k, 1);
    s.material.opacity = Math.min(1, Math.max(0, (d - 8) / 6));
  };
  return s;
}

export class LeagueView {
  constructor(gfx, league) {
    this.gfx = gfx; this.lg = league;
    const s = this.scene = new Scene();
    s.background = new Color('#050505');
    s.fog = new FogExp2('#050505', 0.0032);
    s.environment = gfx.envMap('night');
    s.environmentIntensity = 0.5;
    s.userData.bloom = [0.55, 0.45, 0.95];
    this.time = 0;
    this.buildArena();
    this.buildBall();
    this.buildPads();
    s.add(new HemisphereLight('#9aa1ae', '#1b1918', 1.4));
    const sun = this.sun = new DirectionalLight('#f2f0ea', 1.6);
    sun.position.set(20, 80, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 200;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);
    this.cars = new Map();
  }

  buildArena() {
    const { A, B, H, GW, GH, GD } = ARENA;
    const m = this.lg.mesh;
    // 地面標線
    const field = canvasTex(1024, 1472, (x, w, h) => {
      x.fillStyle = '#4a4a4e'; x.fillRect(0, 0, w, h);
      const img = x.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      x.putImageData(img, 0, 0);
      const sx = w / (2 * A), sz = h / (2 * B);
      const P = (px, pz) => [(px + A) * sx, (pz + B) * sz];
      // 兩個半場淡淡的隊色
      x.fillStyle = 'rgba(255,74,61,.07)'; x.fillRect(0, 0, w, h / 2);
      x.fillStyle = 'rgba(124,196,255,.07)'; x.fillRect(0, h / 2, w, h / 2);
      x.strokeStyle = 'rgba(236,233,226,.75)'; x.lineWidth = 5;
      x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
      x.beginPath(); x.arc(w / 2, h / 2, 18 * sx, 0, Math.PI * 2); x.stroke();
      x.fillStyle = 'rgba(236,233,226,.75)'; x.beginPath(); x.arc(w / 2, h / 2, 1.2 * sx, 0, Math.PI * 2); x.fill();
      for (const e of [-1, 1]) {
        const [x0, z0] = P(-GW - 10, e * B), [x1, z1] = P(GW + 10, e * (B - 22));
        x.strokeRect(Math.min(x0, x1), Math.min(z0, z1), Math.abs(x1 - x0), Math.abs(z1 - z0));
      }
    }, { srgb: true });
    field.anisotropy = 8;
    const floor = new Mesh(new PlaneGeometry(2 * A, 2 * B), new MeshStandardMaterial({ map: field, roughness: 0.6, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    this.scene.add(floor);
    // 球門裡的地面
    for (const e of [-1, 1]) {
      const g = new Mesh(new PlaneGeometry(2 * GW, GD), new MeshStandardMaterial({ color: '#202024', roughness: 0.8 }));
      g.rotation.x = -Math.PI / 2; g.position.set(0, 0.005, e * (B + GD / 2));
      this.scene.add(g);
    }
    // 牆板：v 方向每 6 m 一道接縫，地面彎道頂一條霓虹
    const panel = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#26262a'; x.fillRect(0, 0, w, h);
      const img = x.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      x.putImageData(img, 0, 0);
      x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h);
    });
    panel.wrapS = panel.wrapT = RepeatWrapping; panel.repeat.set(1 / 8, 1 / 6);
    const walls = new Mesh(geoFrom(m.walls), new MeshStandardMaterial({ map: panel, roughness: 0.55, metalness: 0.15 }));
    walls.receiveShadow = true;
    this.scene.add(walls);
    // 霓虹：沿牆面站點，在地面彎道頂（R1 高）與天花板彎道起點各畫一圈
    const st = m.stations, prof = m.profile;
    const ring = (k, lift = 0) => {
      const p = prof[k], pts = [];
      for (let i = 0; i <= st.length; i++) {
        const s0 = st[i % st.length];
        const r = ARENA.RC - p.w;
        pts.push(s0.px + s0.nx * (r - 0.05), p.y + lift, s0.pz + s0.nz * (r - 0.05));
      }
      return pts;
    };
    const tubes = [];
    const strip = (pts, wdt) => {
      // 薄帶：垂直方向寬 wdt
      const pos = [];
      for (let i = 0; i < pts.length / 3 - 1; i++) {
        const a = [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]], b = [pts[i * 3 + 3], pts[i * 3 + 4], pts[i * 3 + 5]];
        // 球門口那一段跳過（站點在門框內的彎道已經被挖掉）
        if (a[1] < ARENA.GH && Math.abs((a[0] + b[0]) / 2) < GW && Math.abs(a[2]) > B - 1) continue;
        pos.push(a[0], a[1] - wdt, a[2], b[0], b[1] - wdt, b[2], b[0], b[1] + wdt, b[2], a[0], a[1] - wdt, a[2], b[0], b[1] + wdt, b[2], a[0], a[1] + wdt, a[2]);
      }
      const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      return g;
    };
    const neonMat = new MeshBasicMaterial({ color: new Color(4.2, 0.25, 0.18), side: DoubleSide });
    const iTop = prof.findIndex((p) => p.w === 0);
    this.scene.add(new Mesh(strip(ring(iTop, 0), 0.12), neonMat));
    this.scene.add(new Mesh(strip(ring(iTop, ARENA.H - ARENA.R2 - prof[iTop].y - 0.5), 0.08), new MeshBasicMaterial({ color: new Color(1.6, 1.6, 1.7), side: DoubleSide })));
    // 球門：裡面一層隊色的發光網格，門框是隊色霓虹
    this.goalMats = [];
    m.goals.forEach((gm, i) => {
      const team = i === 0 ? 1 : 0;   // +Z 端是 ICE 的球門
      const net = canvasTex(128, 128, (x, w, h) => {
        x.fillStyle = '#060606'; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2;
        for (let k = 0; k <= 128; k += 16) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, h); x.stroke(); x.beginPath(); x.moveTo(0, k); x.lineTo(w, k); x.stroke(); }
      });
      net.wrapS = net.wrapT = RepeatWrapping; net.repeat.set(1 / 2, 1 / 2);
      const mat = new MeshStandardMaterial({ color: '#111', emissive: TEAM_COLOR[team].clone().multiplyScalar(0.12), emissiveMap: net, roughness: 0.7, side: DoubleSide });
      this.goalMats[team] = mat;
      this.scene.add(new Mesh(geoFrom(gm), mat));
      const z = (i === 0 ? 1 : -1) * B;
      const frame = new MeshBasicMaterial({ color: TEAM_COLOR[team] });
      const bar = new Mesh(new BoxGeometry(2 * GW + 0.6, 0.3, 0.3), frame); bar.position.set(0, GH, z); this.scene.add(bar);
      for (const sx of [-1, 1]) { const p = new Mesh(new BoxGeometry(0.3, GH, 0.3), frame); p.position.set(sx * GW, GH / 2, z); this.scene.add(p); }
      // 球門的光照到場上
      const pl = new PointLight(TEAM_COLOR[team].clone().multiplyScalar(0.2), 260, 70, 2);
      pl.position.set(0, GH * 0.6, z + (i === 0 ? 6 : -6));
      this.scene.add(pl);
    });
    // 天花板：深色平面＋燈條
    const ceil = new Mesh(new PlaneGeometry(2 * A, 2 * B), new MeshStandardMaterial({ color: '#0c0c0d', roughness: 0.9, side: DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
    this.scene.add(ceil);
    const lamp = new MeshBasicMaterial({ color: new Color(3.2, 3.15, 3.0) });
    for (const x of [-30, -10, 10, 30]) {
      const b = new Mesh(new BoxGeometry(1.2, 0.2, 2 * B - 50), lamp); b.position.set(x, H - 0.2, 0); this.scene.add(b);
    }
  }

  buildBall() {
    const g = new Group();
    this.ballMat = ballMat();
    const sphere = new Mesh(new SphereGeometry(BALL.R, 64, 32), this.ballMat);
    sphere.castShadow = true;
    g.add(sphere);
    this.ball = g;
    this.scene.add(g);
    // 落點影：地面上一圈，越高越大越淡，方便判斷球高
    const shadowTex = canvasTex(128, 128, (x, w, h) => {
      const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(0.7, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
    });
    this.blob = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.scene.add(this.blob);
    this.marker = new Mesh(new RingGeometry(0.96, 1, 64), new MeshBasicMaterial({ color: new Color(2.4, 0.2, 0.15), transparent: true, opacity: 0.8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker);
  }

  buildPads() {
    this.pads = LEAGUE_PADS.map((p) => {
      const g = new Group();
      const disc = new Mesh(new CircleGeometry(3.2, 40), new MeshBasicMaterial({ color: new Color(0.5, 1.2, 2.4), transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04;
      const ring = new Mesh(new RingGeometry(3.3, 3.55, 48), new MeshBasicMaterial({ color: new Color(0.8, 1.8, 3.6) }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
      g.add(disc, ring);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
      return { g, disc, ring };
    });
  }

  // 車：本機與遠端共用，依 id 建立
  car(id, team, name, { tag = true, lights = false } = {}) {
    let c = this.cars.get(id);
    if (c && c.team !== team) { this.scene.remove(c.model.group); this.cars.delete(id); c = null; }
    if (!c) {
      const model = new Roadster({ paint: TEAM_PAINT[team], lights });
      if (lights) model.setLights(1);
      if (tag) model.group.add(nameTag(name, team));
      this.scene.add(model.group);
      c = { model, team, name, seen: 0 };
      this.cars.set(id, c);
    }
    return c;
  }

  removeCar(id) {
    const c = this.cars.get(id);
    if (!c) return;
    this.scene.remove(c.model.group);
    this.cars.delete(id);
  }

  update(dt, ballPos, ballQuat, focus) {
    this.time += dt;
    this.ball.position.copy(ballPos);
    this.ball.quaternion.copy(ballQuat);
    const h = Math.max(0, ballPos.y - BALL.R);
    const k = 1 + h * 0.05;
    this.blob.scale.set(BALL.R * 2.2 * k, BALL.R * 2.2 * k, 1);
    this.blob.material.opacity = Math.max(0.15, 1 - h * 0.04);
    this.blob.position.set(ballPos.x, 0.03, ballPos.z);
    this.marker.visible = h > 2;
    this.marker.scale.setScalar(BALL.R * 1.05);
    this.marker.position.set(ballPos.x, 0.04, ballPos.z);
    this.ballMat.uniforms.glow.value *= Math.exp(-dt * 3);
    for (let i = 0; i < this.pads.length; i++) {
      const on = this.lg.pads[i].cool <= 0;
      this.pads[i].disc.material.opacity = on ? 0.45 + Math.sin(this.time * 4 + i) * 0.15 : 0.08;
    }
    if (focus) {
      this.sun.position.set(focus.x + 20, focus.y + 80, focus.z + 10);
      this.sun.target.position.copy(focus);
      this.sun.target.updateMatrixWorld();
    }
  }

  flashGoal(team) { if (this.goalMats[team]) this.goalMats[team].emissive.copy(TEAM_COLOR[team]).multiplyScalar(0.9); this.goalFlash = team; }
  decayGoal(dt) {
    for (let t = 0; t < 2; t++) {
      const m = this.goalMats[t]; if (!m) continue;
      const base = TEAM_COLOR[t].clone().multiplyScalar(0.12);
      m.emissive.lerp(base, 1 - Math.exp(-dt * 1.5));
    }
  }
}
