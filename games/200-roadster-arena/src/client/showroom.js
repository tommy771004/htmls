// 展示間：鏡面黑地坪、轉台、頂上的燈條。滑鼠／手指拖曳環繞、滾輪或雙指縮放，閒置時自動慢慢轉。
import {
  Scene, PerspectiveCamera, Mesh, MeshStandardMaterial, MeshBasicMaterial, PlaneGeometry, CircleGeometry, RingGeometry, CylinderGeometry,
  BoxGeometry, Color, SpotLight, HemisphereLight, Group, Fog, Vector3, CanvasTexture, AdditiveBlending, DoubleSide,
} from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Roadster } from './roadster.js';

export class Showroom {
  constructor(gfx) {
    this.gfx = gfx;
    const s = this.scene = new Scene();
    s.background = new Color('#060606');
    s.fog = new Fog('#060606', 18, 46);
    s.environment = gfx.envMap('studio');
    s.userData.bloom = [0.35, 0.35, 1.8];
    s.environmentIntensity = 1.0;
    this.camera = new PerspectiveCamera(32, 1, 0.1, 200);
    // 地坪：鏡面反射上蓋一層半透明的深色，越遠越暗
    const mirror = new Reflector(new CircleGeometry(40, 64), { textureWidth: 1024, textureHeight: 1024, color: new Color('#7a7a7a') });
    mirror.rotation.x = -Math.PI / 2;
    s.add(mirror);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(6,6,6,0.55)'); g.addColorStop(0.35, 'rgba(6,6,6,0.78)'); g.addColorStop(1, 'rgba(6,6,6,1)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const veil = new Mesh(new CircleGeometry(40, 64), new MeshBasicMaterial({ map: new CanvasTexture(c), transparent: true, depthWrite: false }));
    veil.rotation.x = -Math.PI / 2; veil.position.y = 0.002;
    s.add(veil);
    // 轉台：深色圓盤，邊緣一圈紅光
    this.table = new Group();
    const disc = new Mesh(new CylinderGeometry(3.6, 3.65, 0.06, 96), new MeshStandardMaterial({ color: '#111112', roughness: 0.72, metalness: 0.15 }));
    disc.position.y = 0.03; disc.receiveShadow = true;
    const ring = new Mesh(new RingGeometry(3.62, 3.68, 128), new MeshBasicMaterial({ color: new Color(3.2, 0.2, 0.15), side: DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.061;
    this.table.add(disc, ring);
    s.add(this.table);
    // 頂上的燈條與背牆的直條光
    for (const z of [-2.4, 0, 2.4]) {
      const bar = new Mesh(new BoxGeometry(7, 0.04, 0.16), new MeshBasicMaterial({ color: new Color(3, 3, 3) }));
      bar.position.set(0, 6.2, z); s.add(bar);
    }
    for (let k = -6; k <= 6; k++) {
      const slat = new Mesh(new PlaneGeometry(0.05, 7), new MeshBasicMaterial({ color: new Color(0.5, 0.5, 0.52), transparent: true, opacity: 0.55 - Math.abs(k) * 0.035, blending: AdditiveBlending, depthWrite: false }));
      slat.position.set(k * 1.1, 3.5, -12); s.add(slat);
    }
    const key = new SpotLight('#ffffff', 60, 30, 0.6, 0.6, 2);
    key.position.set(1.5, 9, 3); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
    key.target.position.set(0, 0, 0);
    s.add(key, key.target);
    const rim = new SpotLight('#ffe8e0', 90, 30, 0.5, 0.8, 2);
    rim.position.set(-6, 3, -7); s.add(rim, rim.target);
    s.add(new HemisphereLight('#b8c0cc', '#0b0b0b', 0.25));
    this.car = new Roadster({ lights: true, paint: 'pearl' });
    this.car.group.position.y = 0.36 + 0.06;
    this.table.add(this.car.group);
    this.car.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.state = { spin: 0, steerVis: 0, wingH: 0, wingA: 0.05, aero: 'AUTO', boosting: false, hovering: false };
    this.doors = 0; this.doorTarget = 1; this.aeroMode = 'stowed'; this.lights = 1;
    this.orbit = { yaw: 0.7, pitch: 0.16, dist: 9.5, auto: true, idle: 0 };
    this.car.setLights(1);
    if (this.car.spots) for (const sp of this.car.spots) sp.visible = false;
  }

  setAero(mode) { this.aeroMode = mode; }

  // 拖曳環繞：由 UI 層把指標事件轉成 drag(dx, dy)／zoom(k)
  drag(dx, dy) { const o = this.orbit; o.yaw -= dx * 0.006; o.pitch = Math.max(0.02, Math.min(0.9, o.pitch + dy * 0.004)); o.idle = 0; }
  zoom(k) { const o = this.orbit; o.dist = Math.max(5.2, Math.min(16, o.dist * k)); o.idle = 0; }

  update(dt, time) {
    this.doors += Math.sign(this.doorTarget - this.doors) * Math.min(Math.abs(this.doorTarget - this.doors), dt * 0.9);
    this.car.setDoors(this.doors);
    const st = this.state;
    const tgt = this.aeroMode === 'stowed' ? [0, 0.05] : this.aeroMode === 'deployed' ? [1, 0.3] : [1, 1];
    st.wingH += (tgt[0] - st.wingH) * Math.min(1, dt * 3);
    st.wingA += (tgt[1] - st.wingA) * Math.min(1, dt * 3);
    st.aero = this.aeroMode === 'stowed' ? 'AUTO' : 'HIGH';
    st.braking = this.aeroMode === 'airbrake';
    this.car.update(st, dt, time);
    const o = this.orbit;
    o.idle += dt;
    if (o.idle > 2.5) o.yaw += dt * 0.12 * Math.min(1, (o.idle - 2.5) / 2);
    const cam = this.camera;
    cam.position.set(Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, 0.9 + Math.sin(o.pitch) * o.dist, Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    cam.lookAt(0, 0.65, 0);
  }
}
