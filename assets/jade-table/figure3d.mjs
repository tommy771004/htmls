// 青雀 3D figures for the lobby and the result stage: one small renderer whose canvas moves between hosts.
// Models come from games/127-jade-table/tools/figures.mjs (assets/jade-table/figures/<cast>.glb); each scene's extras carry the rig
// map (arm, forearm, spine, chest, neck, head, eyelid bones) so posing works on any skeleton. Models with an idle clip play it;
// the rest stand in a procedural idle: arms let down from the T-pose, breathing, a slow look-around and blinks.
// Everything is drawn with one toon ramp and an ink outline so the different sources share a look.
// Any failure resolves mount() to false and the caller keeps its painting.
import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three-0.186.0/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/three-0.186.0/addons/libs/meshopt_decoder.module.js';

const H = 1.6, UP = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _i = new THREE.Quaternion();
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

// Turn a bone (in world space) so the direction to its child becomes dir; w blends from the current pose.
function aim(bone, child, dir, w = 1) {
  if (!bone || !child) return;
  bone.updateWorldMatrix(true, true);
  _a.setFromMatrixPosition(bone.matrixWorld); _b.setFromMatrixPosition(child.matrixWorld).sub(_a).normalize();
  _q.setFromUnitVectors(_b, _d.copy(dir).normalize()); if (w < 1) _q.slerp(_i, 1 - w);
  turn(bone, _q);
}
// Apply a world-space rotation q to a bone: L' = P⁻¹·q·P·L.
function turn(bone, q) {
  bone.parent.getWorldQuaternion(_p);
  bone.quaternion.premultiply(_p.clone().invert().multiply(q).multiply(_p));
}
const spin = (bone, axis, ang) => { if (bone && ang) turn(bone, _q.setFromAxisAngle(axis, ang)); };

function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 240, 240, 240, 255]), 3, 1);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}

export function createFigureStage({ base = '../assets/jade-table/figures/', reduced = false } = {}) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), ramp = toonRamp(), cache = new Map();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0, 0);
  const canvas = renderer.domElement; canvas.className = 'figure3d'; canvas.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(22, 1, .1, 40), holder = new THREE.Group();
  scene.add(holder, new THREE.HemisphereLight('#fff4dc', '#1f4a3b', 1.05));
  const key = new THREE.DirectionalLight('#fff0d2', 1.7); key.position.set(2.2, 3, 3.2);
  const rim = new THREE.DirectionalLight('#cdeee2', 3.2); rim.position.set(-2.6, 2.2, -2.4);
  scene.add(key, rim);
  let host = null, mode = 'lobby', cur = null, raf = 0, last = 0, t0 = 0, poseAt = 0, gen = 0;
  const ro = new ResizeObserver(() => fit());

  function load(id) {
    if (!cache.has(id)) cache.set(id, loader.loadAsync(base + id + '.glb').then((g) => prepare(g)).catch(() => null));
    return cache.get(id);
  }
  function prepare(gltf) {
    const root = gltf.scene, rig = root.userData.rig || {}, by = (n) => n && root.getObjectByName(n);
    const outline = new THREE.MeshBasicMaterial({ color: '#0d1d17', side: THREE.BackSide }), uInk = { value: 0 };
    outline.onBeforeCompile = (s) => {
      s.uniforms.uInk = uInk;
      s.vertexShader = 'uniform float uInk;\n' + s.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n#ifdef USE_SKINNING\ntransformed += normalize(objectNormal) * uInk;\n#else\ntransformed += normalize(normal) * uInk;\n#endif');
    };
    const inks = [], noInk = rig.noInk ? new RegExp(rig.noInk, 'i') : null;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const ink = o.isSkinnedMesh && !(noInk && [o.name, ...[o.material].flat().map((m) => m.name)].some((n) => noInk.test(n)));
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => new THREE.MeshToonMaterial({
        map: m.map, color: m.color, gradientMap: ramp, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side,
      }));
      o.material = Array.isArray(o.material) ? mats : mats[0];
      if (ink) inks.push(o);
    });
    for (const o of inks) {
      const ink = new THREE.SkinnedMesh(o.geometry, outline); ink.bind(o.skeleton, o.bindMatrix); ink.frustumCulled = false; ink.renderOrder = -1;
      o.parent.add(ink); ink.position.copy(o.position); ink.quaternion.copy(o.quaternion); ink.scale.copy(o.scale);
    }
    // Normalise: feet on the floor, H tall, centred, facing +z (rig.yaw turns models authored another way).
    const wrap = new THREE.Group(); wrap.add(root); root.rotation.y += rig.yaw || 0; wrap.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true), s = H / (box.max.y - box.min.y), c = box.getCenter(new THREE.Vector3());
    root.scale.multiplyScalar(s); root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    // Ink width is in object units, so undo the model's own scale.
    wrap.updateMatrixWorld(true);
    uInk.value = (rig.ink ?? .0035) / (inks[0] ? inks[0].matrixWorld.getMaxScaleOnAxis() : 1);
    const bones = {}; for (const k of ['armL', 'armR', 'foreL', 'foreR', 'handL', 'handR', 'spine', 'chest', 'neck', 'head']) bones[k] = by(rig[k]);
    const lids = (rig.lids || []).map(([u, d]) => [by(u), by(d)]).filter(([u, d]) => u && d && u.parent === d.parent).map(([u, d]) => [u, u.position.clone(), d.position.clone()]);
    const rest = []; root.traverse((o) => { if (o.isBone) rest.push([o, o.quaternion.clone()]); });
    // Cloth and ribbons that hang from the arms in the T-pose keep that world orientation once the arms come down.
    const rq = wrap.getWorldQuaternion(new THREE.Quaternion()).invert();
    const hang = (rig.hang || []).map(by).filter(Boolean).map((o) => [o, rq.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()))]);
    // Ribbons that streamed along the arm instead are aimed straight down.
    const dangle = (rig.dangle || []).map(by).filter((o) => o?.children.some((c) => c.isBone)).map((o) => [o, o.children.find((c) => c.isBone)]);
    const mixer = gltf.animations.length ? new THREE.AnimationMixer(root) : null;
    const clip = (re) => re && gltf.animations.find((a) => new RegExp(re, 'i').test(a.name));
    const idle = clip(rig.idle), win = clip(rig.win);
    return { wrap, root, rig, bones, lids, rest, hang, dangle, mixer, idle, win, blinkAt: 2 };
  }

  // Frame the figure for the host's box: lobby shows knees up, the result stage waist up, and a wide short box only the chest up.
  function fit() {
    if (!host) return;
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const wide = w / h > 1.25, [lo, hi, fx] = mode === 'win' ? (wide ? [.6, 1.03, .5] : [.42, 1.03, .44]) : (wide ? [.5, 1.04, .5] : [.3, 1.04, .5]);
    const half = (hi - lo) * H / 2, d = half / Math.tan(camera.fov * Math.PI / 360), yc = (lo * H + hi * H) / 2;
    camera.position.set((.5 - fx) * 2 * half * camera.aspect, yc + .08, d); camera.lookAt(camera.position.x, yc, 0); camera.updateProjectionMatrix();
    draw(performance.now());
  }

  function pose(f, t, now) {
    const { bones: b, rig } = f;
    if (f.mixer) f.mixer.update(Math.min(.05, (now - last) / 1000)); else for (const [o, q] of f.rest) o.quaternion.copy(q);
    const mv = reduced ? 0 : 1, sL = Math.sign(holder.worldToLocal(b.armL ? b.armL.getWorldPosition(_a) : _a.set(1, 0, 0)).x) || 1, sR = -sL;
    const yaw = holder.quaternion, dir = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(yaw);
    if (!f.idle) {
      spin(b.spine, Z, mv * .018 * Math.sin(t * .55));
      spin(b.chest, X, mv * -.025 * Math.sin(t * 1.6));
      aim(b.armL, b.foreL, dir(sL * .3, -1, .06 + mv * .02 * Math.sin(t * 1.6))); aim(b.foreL, b.handL, dir(sL * .1, -1, .32));
      aim(b.armR, b.foreR, dir(sR * .3, -1, .06 + mv * .02 * Math.sin(t * 1.6 + .4))); aim(b.foreR, b.handR, dir(sR * .1, -1, .32));
    }
    spin(b.neck, UP, mv * .07 * Math.sin(t * .31)); spin(b.head, X, mv * .035 * Math.sin(t * .47 + 1));
    if (mode === 'win') {
      const k = reduced ? 1 : ease((now - poseAt) / 650);
      if (!f.win) {
        aim(b.armR, b.foreR, dir(sR * .45, .85, .25), k); aim(b.foreR, b.handR, dir(sR * .05, 1, .15), k);
        aim(b.armL, b.foreL, dir(sL * .62, -.72, -.1), k); aim(b.foreL, b.handL, dir(-sL * .7, -.25, .35), k);
        spin(b.head, Z, -sR * .12 * k); spin(b.spine, Z, sR * .05 * k);
      }
    }
    if (f.hang.length) {
      f.wrap.getWorldQuaternion(_q);
      for (const [o, q] of f.hang) { o.parent.updateWorldMatrix(true, false); o.parent.getWorldQuaternion(_p); o.quaternion.copy(_p.invert().multiply(_q).multiply(q)); }
    }
    for (const [o, c] of f.dangle) aim(o, c, dir(0, -1, .12));
    // Blink: the upper lid bones slide most of the way to the lower ones for a moment every few seconds.
    if (f.lids.length) {
      if (!reduced && t > f.blinkAt + .14) f.blinkAt = t + 2.5 + ((t * 7.31) % 1) * 3;
      const k = reduced ? 0 : Math.max(0, 1 - Math.abs(t - f.blinkAt - .07) / .07) * .85;
      for (const [u, up, dn] of f.lids) u.position.lerpVectors(up, dn, k);
    }
  }

  function draw(now) {
    if (!cur) return;
    pose(cur, (now - t0) / 1000, now); last = now;
    renderer.render(scene, camera);
  }
  function loop(now) {
    raf = 0;
    const dlg = host?.closest('dialog');
    if (!host || !host.isConnected || (dlg && !dlg.open) || !cur) return;
    draw(now); if (!reduced) raf = requestAnimationFrame(loop);
  }

  async function mount(el, id, as = 'lobby') {
    const my = ++gen, f = await load(id);
    if (my !== gen) return false;
    if (!f) return false;
    if (host !== el) { if (host) ro.unobserve(host); host = el; el.append(canvas); ro.observe(el); }
    mode = as; poseAt = performance.now();
    if (cur !== f) { if (cur) holder.remove(cur.wrap); cur = f; holder.add(f.wrap); t0 = performance.now(); }
    if (f.mixer) { f.mixer.stopAllAction(); const c = (as === 'win' && f.win) || f.idle; if (c) f.mixer.clipAction(c).reset().play(); }
    holder.rotation.y = as === 'win' ? .32 : .22;
    last = performance.now(); fit();
    if (!raf) raf = requestAnimationFrame(loop);
    return true;
  }
  function unmount(el) {
    if (host !== el) return;
    ro.unobserve(host); canvas.remove(); host = null; gen++;
    if (raf) cancelAnimationFrame(raf); raf = 0;
  }
  return { mount, unmount, preload: load, canvas, get current() { return cur; }, THREE };
}
