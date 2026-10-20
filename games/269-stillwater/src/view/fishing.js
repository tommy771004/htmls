// 釣魚流程（畫面＋時序）：拋竿 → 浮標拋物線落水 → 魚游近、試探點水 → 沉標 → 提竿（完美／一般／太早／太晚）
// → 收線張力博弈（core/reel.js）→ 拉上船、舉魚歡呼、放進魚簍；或斷線、脫鉤。
import * as THREE from 'three';
import { createReel } from '../core/reel.js';
import { reelParams, byId } from '../core/fishdb.js';
import { pickFish } from '../core/quests.js';
import { rollBase, potential, judge } from '../core/quality.js';
import { makeCatch } from '../core/save.js';
import { fishMesh, displayLen } from './fishview.js';

const CAST_REACH = 9.5;
const v3 = new THREE.Vector3(), v4 = new THREE.Vector3(), vTip = new THREE.Vector3();

function makeBobber() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c8402f', roughness: 0.5, flatShading: true }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.5, flatShading: true }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5).translate(0, 0.14, 0), new THREE.MeshStandardMaterial({ color: '#2a2620' }));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4).translate(0, 0.23, 0), new THREE.MeshStandardMaterial({ color: '#e9b949', emissive: '#e9b949', emissiveIntensity: 0.3 }));
  g.add(top, bot, stem, tip);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.6);
  return g;
}

// 面向鏡頭的釣線（一條細長帶子）
function makeLine() {
  const SEG = 28;
  const pos = new Float32Array((SEG + 1) * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color: '#f3efe4', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  const pts = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
  const side = new THREE.Vector3(), tan = new THREE.Vector3(), toCam = new THREE.Vector3();
  return {
    mesh,
    set(a, b, sag, cam, width = 0.022) {
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        pts[i].lerpVectors(a, b, t);
        pts[i].y -= Math.sin(t * Math.PI) * sag;
        if (pts[i].y < -0.02 && t > 0.5) pts[i].y = Math.max(pts[i].y, b.y + (pts[i].y - b.y) * 0.5);
      }
      for (let i = 0; i <= SEG; i++) {
        tan.subVectors(pts[Math.min(SEG, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        toCam.subVectors(cam, pts[i]).normalize();
        side.crossVectors(tan, toCam).normalize().multiplyScalar(width / 2);
        pos[i * 6] = pts[i].x - side.x; pos[i * 6 + 1] = pts[i].y - side.y; pos[i * 6 + 2] = pts[i].z - side.z;
        pos[i * 6 + 3] = pts[i].x + side.x; pos[i * 6 + 4] = pts[i].y + side.y; pos[i * 6 + 5] = pts[i].z + side.z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

export function createFishing(ctx) {
  const { scene, boatView, water, fx, audio, shoals, ui, grid, camera } = ctx;
  const bobber = makeBobber(); bobber.visible = false; scene.add(bobber);
  const line = makeLine(); line.mesh.visible = false; scene.add(line.mesh);
  let hooked = null;          // 上鉤的魚的網格
  const S = {
    phase: 'idle', t: 0, spot: null, fish: null, target: new THREE.Vector3(), from: new THREE.Vector3(),
    bob: new THREE.Vector3(), nibbles: 0, nibT: 0, biteT: 0, delay: 0, perfect: false, reel: null, hold: false,
    ctxQ: null, fishPos: new THREE.Vector3(), fishVel: new THREE.Vector3(), angle: 0, dist: 0, castDist: 0,
    jumpT: 0, landT: 0, result: null, lastCatch: null, dip: 0, sink: 0, tension: 0, sway: 0,
  };
  const setPhase = (p) => { S.phase = p; S.t = 0; };

  function clearHooked() { if (hooked) { scene.remove(hooked); hooked = null; } }

  const api = {
    S,
    get busy() { return S.phase !== 'idle'; },
    // 拋竿：spot = 釣點資料，at = 釣點中心（世界座標），info = { time, timeIdx, day, upgrades, pity }
    cast(spot, at, info, rng) {
      if (S.phase !== 'idle') return false;
      S.spot = spot; S.info = info; S.rng = rng;
      const bp = boatView.root.position;
      const dx = at.x - bp.x, dz = at.z - bp.z, d = Math.hypot(dx, dz);
      const reach = Math.min(CAST_REACH, Math.max(3.5, d + (rng() - 0.5) * 1.6));
      const a = Math.atan2(dx, dz) + (rng() - 0.5) * 0.25;
      S.target.set(bp.x + Math.sin(a) * reach, 0, bp.z + Math.cos(a) * reach);
      // 落點太淺就往船這邊拉
      for (let k = 0; k < 6 && grid.sample(S.target.x, S.target.z) > -0.6; k++) S.target.lerp(bp, 0.25);
      S.castDist = S.target.distanceTo(v3.set(bp.x, 0, bp.z));
      S.fish = pickFish(spot, info.time, rng, info.pity || 0);
      const p = reelParams(S.fish);
      S.nibbles = Math.round(p.nib[0] + rng() * (p.nib[1] - p.nib[0]));
      S.delay = (1.6 + rng() * 3.6) * p.bite;
      S.perfect = false; S.result = null; S.reel = null;
      boatView.faceTo(S.target.x, S.target.z);
      boatView.play('cast', 0.2);
      audio.whoosh();
      setPhase('cast');
      return true;
    },
    // 按下動作鍵（提竿）／放開；回傳 UI 要顯示的文字
    press(down) {
      S.hold = down;
      if (!down) return;
      if (S.phase === 'wait') {
        // 還沒沉標就提竿：魚被嚇跑
        ui.pop('太早了，魚被嚇跑了', 'warn');
        audio.plop(0.4);
        api.retrieve('early');
      } else if (S.phase === 'bite') {
        const p = reelParams(S.fish);
        const lanternBonus = S.info.upgrades.lantern && S.info.time === 'dusk' ? 0.08 : 0;
        const perfectWin = Math.min(p.perfect + lanternBonus, p.win * 0.6);
        S.perfect = S.t <= perfectWin;
        const timeBest = S.fish.best.includes(S.info.time);
        S.q = { base: rollBase(S.rng), perfect: S.perfect, spotBonus: S.spot.bonus, timeBest };
        const pot = potential(S.q);
        S.reel = createReel(S.fish, {
          perfect: S.perfect, potentialTier: pot, rodMult: S.info.upgrades.rod ? 1.2 : 1,
          lineBonus: S.info.upgrades.line ? 0.2 : 0, rng: S.rng,
        });
        S.pot = pot;
        boatView.play('hook', 0.08);
        fx.splash(S.bob.x, S.bob.z, S.perfect ? 22 : 12, S.perfect ? 1.3 : 0.9, S.perfect ? 'gold' : 'water');
        water.ripple(S.bob.x, S.bob.z, 1.2);
        if (S.perfect) { ui.pop('完美提竿 Perfect Hook', 'gold'); audio.perfect(); } else { ui.pop('上鉤了', ''); audio.hook(); }
        if (pot >= 3) setTimeout(() => ui.pop('是個大傢伙！', 'big'), 700);
        S.fishPos.copy(S.bob).setY(-0.6);
        S.angle = Math.atan2(S.bob.x - boatView.root.position.x, S.bob.z - boatView.root.position.z);
        S.dist = S.castDist;
        shoals.hideApproach();
        clearHooked();
        hooked = fishMesh(S.fish.id);
        scene.add(hooked);
        bobber.visible = false;
        setPhase('hook');
      }
    },
    cancel() { if (S.phase === 'wait' || S.phase === 'cast') { api.retrieve('cancel'); return true; } return false; },
    retrieve(why) {
      shoals.setApproach(null);
      S.why = why;
      setPhase('retrieve');
    },
    update(dt, t, cam) {
      S.t += dt;
      const bp = boatView.root.position;
      const tip = boatView.rodTip(vTip);
      let lineTo = null, sag = 0.25;
      switch (S.phase) {
        case 'idle': break;
        case 'cast': {
          if (S.t >= 0.55 && !bobber.visible) { bobber.visible = true; S.from.copy(tip); S.flyT = 0; }
          if (bobber.visible) {
            S.flyT += dt / 0.75;
            const k = Math.min(1, S.flyT);
            S.bob.lerpVectors(S.from, S.target, k);
            S.bob.y = THREE.MathUtils.lerp(S.from.y, 0, k) + Math.sin(k * Math.PI) * (1.6 + S.castDist * 0.18);
            if (k >= 1) {
              S.bob.y = 0;
              fx.splash(S.bob.x, S.bob.z, 8, 0.6);
              water.ripple(S.bob.x, S.bob.z, 1);
              audio.plop(1);
              boatView.play('wait', 0.3);
              shoals.setApproach(S.spot.k, S.bob.x, S.bob.z, S.fish.id);
              setPhase('wait');
            }
          }
          lineTo = bobber.visible ? S.bob : null; sag = 0.05;
          break;
        }
        case 'wait': {
          // 魚游近後依序試探點水，再沉標
          const ap = shoals.approach;
          const near = ap ? ap.d < 1.0 : S.t > S.delay;
          if (near && S.t > S.delay) {
            S.nibT -= dt;
            if (S.nibT <= 0) {
              if (S.nibbles > 0) {
                S.nibbles--; S.nibT = 0.55 + S.rng() * 0.75;
                const faint = reelParams(S.fish).faint;
                S.dip = faint ? 0.025 : 0.07;
                water.ripple(S.bob.x, S.bob.z, faint ? 0.25 : 0.5);
                audio.nibble(faint ? 0.4 : 1);
              } else {
                S.sink = 1;
                fx.splash(S.bob.x, S.bob.z, 10, 0.8);
                water.ripple(S.bob.x, S.bob.z, 1.3);
                audio.bite();
                ui.bite(true);
                setPhase('bite');
              }
            }
          }
          if (S.t > 40) { ui.pop('沒有動靜，換個地方試試', ''); api.retrieve('quiet'); }
          break;
        }
        case 'bite': {
          if (S.t > reelParams(S.fish).win) { ui.bite(false); ui.pop('魚把餌吃掉了', 'warn'); api.retrieve('miss'); }
          break;
        }
        case 'hook': {
          ui.bite(false);
          if (S.t > 0.35) { boatView.play('reel', 0.15); setPhase('reel'); }
          break;
        }
        case 'reel': {
          const r = S.reel;
          r.step(dt, S.hold);
          for (const e of r.events) {
            if (e === 'jump') { S.jumpT = 1.1; audio.splash(1.2); }
            if (e === 'wave' || e === 'burst' || e === 'surge' || e === 'run') { fx.splash(S.fishPos.x, S.fishPos.z, 14, 1.1); audio.splash(1); ui.pop(e === 'wave' ? '魚王猛烈拉扯！' : e === 'run' ? '長距離暴衝！' : '暴衝！', 'warn'); }
            if (e === 'dive') ui.pop('深淵下潛：魚強制退線', 'warn');
            if (e === 'lock') ui.pop('鑽進石縫，張力鎖死', 'warn');
            if (e === 'red') audio.creak();
          }
          // 魚的位置：距離跟著進度收短，暴衝時往側邊竄
          const struggling = r.show !== 'calm';
          S.dist = 1.6 + (S.castDist + 1.5 - 1.6) * (1 - r.progress / 100);
          S.angle += (struggling ? Math.sin(t * 1.7) * 1.4 : Math.sin(t * 0.6) * 0.25) * dt;
          const fx0 = bp.x + Math.sin(S.angle) * S.dist, fz0 = bp.z + Math.cos(S.angle) * S.dist;
          const bed = grid.sample(fx0, fz0);
          let fy = r.phase === 'dive' ? Math.max(bed + 0.3, -2.4) : struggling ? -0.35 : -0.55;
          if (S.jumpT > 0) {
            S.jumpT -= dt;
            const k = 1 - S.jumpT / 1.1;
            fy = Math.sin(k * Math.PI) * 1.3 - 0.1;
            if (k > 0.05 && k < 0.1) fx.splash(fx0, fz0, 12, 1);
            if (S.jumpT <= 0) { fx.splash(fx0, fz0, 16, 1.1); water.ripple(fx0, fz0, 1.4); }
          }
          S.fishPos.x += (fx0 - S.fishPos.x) * Math.min(1, dt * 4);
          S.fishPos.z += (fz0 - S.fishPos.z) * Math.min(1, dt * 4);
          S.fishPos.y += (fy - S.fishPos.y) * Math.min(1, dt * (S.jumpT > 0 ? 20 : 3));
          if (hooked) {
            hooked.position.copy(S.fishPos);
            const away = Math.atan2(S.fishPos.x - bp.x, S.fishPos.z - bp.z);
            hooked.rotation.set(S.jumpT > 0 ? -0.6 * Math.cos((1 - S.jumpT / 1.1) * Math.PI) : 0, away + (struggling ? Math.sin(t * 9) * 0.5 : 0), 0, 'YXZ');
            hooked.material.userData.uSwim.value.set(0, struggling ? 22 : 10, struggling ? 0.22 : 0.12, 0);
            hooked.material.userData.uGlow.value = S.fish.id === 55 ? 0.35 : 0;
          }
          if (struggling && Math.random() < dt * 6) { fx.splash(S.fishPos.x, S.fishPos.z, 3, 0.6); water.ripple(S.fishPos.x, S.fishPos.z, 0.6); }
          S.tension = r.tension;
          S.sway = reelParams(S.fish).sway ? Math.sin(t * 7) * 0.05 * (r.tension / 100) : 0;
          audio.reel(S.hold && r.phase !== 'lock', r.tension);
          lineTo = v3.set(S.fishPos.x, Math.max(S.fishPos.y, -0.05), S.fishPos.z); sag = 0.3 * (1 - r.tension / 100);
          boatView.faceTo(S.fishPos.x, S.fishPos.z);
          if (r.result) {
            audio.reel(false, 0);
            ui.reelEnd();
            if (r.result === 'caught') {
              const j = judge({ ...S.q, maxTension: r.maxTension, redEntries: r.redEntries, rng: S.rng });
              S.lastCatch = makeCatch(S.fish, j, { time: S.info.time, perfect: S.perfect, day: S.info.day });
              S.lastJudge = j;
              fx.splash(S.fishPos.x, S.fishPos.z, 18, 1.2);
              audio.landed();
              boatView.play('cheer', 0.15);
              S.landFrom = S.fishPos.clone();
              hooked.scale.setScalar(displayLen(S.fish, j.mult));
              setPhase('land');
            } else {
              if (r.result === 'snap') { ui.pop('斷線了！張力太高', 'bad'); audio.snap(); }
              else { ui.pop('脫鉤了，魚溜走了', 'bad'); audio.plop(0.6); }
              fx.splash(S.fishPos.x, S.fishPos.z, 10, 0.9);
              S.result = r.result;
              clearHooked();
              S.why = r.result;
              boatView.setBend(0);
              setPhase('retrieve');
            }
          }
          break;
        }
        case 'land': {
          // 魚從水裡飛到漁夫左手，舉著歡呼
          const hand = boatView.hand(v3);
          const k = Math.min(1, S.t / 0.45);
          if (hooked) {
            if (k < 1) {
              hooked.position.lerpVectors(S.landFrom, hand, k);
              hooked.position.y += Math.sin(k * Math.PI) * 1.2;
            } else hooked.position.copy(hand).add(v4.set(0, -0.05 - hooked.scale.x * 0.35, 0));
            hooked.rotation.set(-Math.PI / 2 + 0.2, boatView.root.rotation.y, 0, 'YXZ');
            hooked.material.userData.uSwim.value.set(0, 16, 0.2, 0);
            if (Math.random() < dt * 8) fx.drip(hooked.position.x, hooked.position.y - 0.2, hooked.position.z);
          }
          if (S.t > 0.5 && !S.reported) { S.reported = true; ctx.onCatch(S.lastCatch, S.lastJudge); }
          if (S.t > 1.6) {
            boatView.openLid();
            audio.creel();
            clearHooked();
            S.reported = false;
            boatView.stopFishing();
            boatView.faceRow();
            setPhase('idle');
            ctx.onDone && ctx.onDone('caught');
          }
          break;
        }
        case 'retrieve': {
          ui.bite(false);
          if (S.why === 'snap' || S.why === 'escape') {
            if (S.t > 0.9) { boatView.stopFishing(); boatView.faceRow(); bobber.visible = false; setPhase('idle'); ctx.onDone && ctx.onDone(S.why); }
            break;
          }
          if (bobber.visible) {
            S.bob.lerp(v3.copy(tip).setY(0.05), Math.min(1, dt * 5));
            lineTo = S.bob;
            if (S.bob.distanceTo(tip) < 1.0 || S.t > 0.9) bobber.visible = false;
          }
          if (S.t > 0.5) { boatView.stopFishing(); boatView.faceRow(); }
          if (S.t > 0.95) { setPhase('idle'); ctx.onDone && ctx.onDone(S.why); }
          break;
        }
      }
      // 浮標：點水與沉標
      if (bobber.visible) {
        S.dip = Math.max(0, S.dip - dt * 0.35);
        const sinkY = S.phase === 'bite' ? -0.28 + Math.sin(t * 9) * 0.03 : 0;
        bobber.position.set(S.bob.x, (S.phase === 'cast' ? S.bob.y : sinkY - S.dip + Math.sin(t * 2.2) * 0.012), S.bob.z);
        bobber.rotation.z = S.phase === 'bite' ? Math.sin(t * 13) * 0.3 : Math.sin(t * 1.4) * 0.06;
      }
      // 竿身彎曲與釣線
      const bendT = S.phase === 'reel' ? 0.25 + (S.reel.tension / 100) * 0.75 : S.phase === 'bite' ? 0.2 : 0;
      boatView.setBend(bendT);
      if (lineTo) {
        line.mesh.visible = true;
        line.set(tip, v4.copy(lineTo).setY(Math.max(-0.1, lineTo.y + (bobber.visible ? 0.3 : 0))), sag, cam);
      } else line.mesh.visible = false;
    },
    bobberScreen(cam, w, h) {
      if (!bobber.visible) return null;
      v3.copy(bobber.position).setY(0.6).project(cam);
      return [(v3.x + 1) / 2 * w, (1 - v3.y) / 2 * h];
    },
    reset() { clearHooked(); bobber.visible = false; line.mesh.visible = false; shoals.setApproach(null); setPhase('idle'); },
  };
  return api;
}
