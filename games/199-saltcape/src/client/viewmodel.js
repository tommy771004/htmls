// 第一人稱手臂與槍：獨立場景、另一支鏡頭，畫在世界之上所以不會插進牆裡。
import * as THREE from 'three';
import { gunMesh, camoTexture } from './actors.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { WEAPONS } from '../core/rules.js';

export function makeViewmodel() {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  scene.add(new THREE.HemisphereLight('#efe6d6', '#7a5f40', 2.2));
  const key = new THREE.DirectionalLight('#ffd9a8', 2.6); key.position.set(-1, 1.4, 0.8); scene.add(key);
  const rim = new THREE.DirectionalLight('#c9d6dc', 1.2); rim.position.set(1.2, 0.4, -1); scene.add(rim);
  const rig = new THREE.Group(); scene.add(rig);
  const sway = new THREE.Group(); rig.add(sway);
  const gunHolder = new THREE.Group(); sway.add(gunHolder);
  const sleeve = new THREE.MeshStandardMaterial({ map: camoTexture(['#a99a77', '#7c7556', '#5c4b36', '#c9bc98'], 50, 3), roughness: 0.95 });
  const glove = new THREE.MeshStandardMaterial({ color: '#2f2924', roughness: 0.65 });
  const arm = (side) => {
    const g = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.046, 0.34, 12).rotateX(Math.PI / 2), sleeve); fore.position.z = 0.15; g.add(fore);
    const fold = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 6, 14).rotateX(0), sleeve); fold.position.z = 0.04; g.add(fold);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.033, 0.035, 12).rotateX(Math.PI / 2), glove); cuff.position.z = 0.0; g.add(cuff);
    // 手套：掌心＋四指＋拇指
    const hand = new THREE.Group(); hand.position.z = -0.045; g.add(hand);
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.03, 0.075, 2, 0.01), glove); hand.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.position.set(-0.022 + i * 0.0147, -0.004, -0.036); f.rotation.x = -1.1; hand.add(f);
      const a = new THREE.Mesh(new RoundedBoxGeometry(0.013, 0.014, 0.03, 1, 0.005), glove); a.position.z = -0.014; f.add(a);
      const b = new THREE.Group(); b.position.z = -0.028; b.rotation.x = -0.9; f.add(b);
      const c = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.013, 0.026, 1, 0.005), glove); c.position.z = -0.012; b.add(c);
    }
    const th = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.014, 0.04, 1, 0.006), glove); th.position.set(0.03 * side, 0.006, -0.02); th.rotation.set(-0.3, -0.7 * side, 0); hand.add(th);
    const watch = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.012, 0.03, 1, 0.004), new THREE.MeshStandardMaterial({ color: '#1f1d1a', roughness: 0.4 })); watch.position.set(0, 0.034, 0.025); if (side < 0) g.add(watch);
    g.userData.side = side;
    return g;
  };
  const rArm = arm(1), lArm = arm(-1);
  sway.add(rArm, lArm);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ color: '#ffd48a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, map: flashTexture() }));
  sway.add(flash);
  const vm = {
    scene, cam, rig, sway, gunHolder, rArm, lArm, flash,
    key: '', gun: null, kick: 0, kickR: 0, bobT: 0, swayX: 0, swayY: 0, lower: 0, flashT: 0, adsV: 0,
    setWeapon(w) {
      if (w === vm.key) return;
      if (vm.gun) gunHolder.remove(vm.gun);
      vm.gun = w ? gunMesh(w, 1) : null;
      if (vm.gun) { vm.gun.traverse((o) => { o.castShadow = false; }); gunHolder.add(vm.gun); }
      vm.key = w;
      vm.lower = 1;
      vm.muzzleZ = w === 'p9' ? -0.17 : w === 'smg' ? -0.4 : w === 'sr' ? -0.84 : w === 'dmr' ? -0.71 : w === 'sg' ? -0.64 : -0.56;
    },
    fire(w) {
      const W = WEAPONS[w];
      vm.kick = Math.min(1.4, vm.kick + (W.dmg > 50 ? 1.2 : W.pellets ? 1 : 0.42));
      vm.kickR = (Math.random() - 0.5) * 0.6;
      vm.flashT = 0.05;
      flash.rotation.z = Math.random() * 6.28;
    },
    update(dt, st) {
      // st: { aspect, ads, moving, speed, sprint, reload, reloadT, swap, mouseDX, mouseDY, plate, crouch, airborne }
      cam.aspect = st.aspect; cam.fov = 58 - st.ads * 12; cam.updateProjectionMatrix();
      vm.kick = Math.max(0, vm.kick - dt * (6 + vm.kick * 4));
      vm.lower = Math.max(0, vm.lower - dt * 3.2);
      vm.bobT += dt * (st.moving ? (st.sprint ? 13 : 9) : 1.5);
      const bobA = st.moving ? (st.sprint ? 0.022 : 0.011) * (1 - st.ads * 0.85) : 0.002;
      vm.swayX += (-st.mouseDX * 0.0006 - vm.swayX) * Math.min(1, dt * 10);
      vm.swayY += (st.mouseDY * 0.0006 - vm.swayY) * Math.min(1, dt * 10);
      const hip = new THREE.Vector3(0.19, -0.2, -0.5), ads = new THREE.Vector3(0, -0.07, -0.36);
      if (vm.key === 'sr') ads.y = -0.125; if (vm.key === 'dmr') ads.y = -0.115; if (vm.key === 'ar') ads.y = -0.115; if (vm.key === 'sg') ads.y = -0.073;
      if (vm.key === 'p9') { hip.set(0.15, -0.17, -0.42); ads.set(0, -0.068, -0.34); }
      const p = hip.clone().lerp(ads, st.ads);
      p.x += Math.sin(vm.bobT) * bobA + vm.swayX;
      p.y += Math.abs(Math.cos(vm.bobT)) * bobA * 0.8 - vm.swayY - vm.lower * 0.25 - (st.plate ? 0.18 : 0);
      p.z += vm.kick * 0.045;
      sway.position.copy(p);
      let rx = vm.kick * 0.09 + vm.swayY * 2, ry = vm.swayX * 2 + vm.kickR * vm.kick * 0.05, rz = 0;
      if (st.sprint) { rx -= 0.35; ry += 0.55; rz += 0.25; sway.position.x += 0.04; sway.position.y -= 0.03; }
      if (st.reload) { const k = Math.sin(Math.min(1, st.reloadT) * Math.PI); rx -= 0.25 * k; rz += 0.6 * k; sway.position.y -= 0.06 * k; }
      sway.rotation.set(rx, ry, rz);
      // 手的位置：右手握把、左手護木
      // 手的位置：右手握把、左手托護木（前臂朝鏡頭後下方延伸）
      const fz = { p9: -0.02, smg: -0.24, ar: -0.33, sg: -0.38, dmr: -0.3, sr: -0.3 }[vm.key] ?? -0.3;
      rArm.position.set(0.012, -0.05, 0.04); rArm.rotation.set(0.9, 0.35, 0.1);
      const rl = st.reload ? Math.sin(Math.min(1, st.reloadT) * Math.PI) : 0;
      if (vm.key === 'p9') { lArm.position.set(-0.022, -0.05, 0.035); lArm.rotation.set(0.5, -0.45, -0.3); }
      else { lArm.position.set(-0.008, -0.03 - rl * 0.06, fz + rl * 0.2); lArm.rotation.set(0.95 + rl * 0.4, -0.42, -0.25); }
      flash.position.set(0, 0.04, vm.muzzleZ || -0.5);
      vm.flashT -= dt;
      flash.material.opacity = vm.flashT > 0 ? 1 : 0;
      flash.scale.setScalar(vm.key === 'p9' ? 0.6 : 1);
      rig.visible = !!vm.gun && st.visible;
    },
  };
  return vm;
}

function flashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,200,110,.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = g; x.beginPath();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = i % 2 ? 12 : 32; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
