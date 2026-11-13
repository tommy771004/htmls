// 21-rigbeast.js：海上鑽油平台（21-rig.js）的海獸 —— MightyPinecone 的 Turtle Kaiju（Sketchfab，CC BY 4.0，作者自己設計的龜形巨獸，不是任何既有作品的角色）。
// 鏡頭在平台 1.6 km 內、人在戶外待一陣子，平台東邊的海面先鼓起、翻白、海底轟隆，接著牠頭先出水、站起來（水到膝，殼的下緣泡在水裡），
// 朝平台吼叫（仰頭、張嘴、舉起雙手），涉水沿著半徑 150 m 的弧走過平台東側，最後前傾沉回海裡；4 分鐘後（還在附近時）再來一次。
// 模型：tools/beast-glb.mjs 處理成 assets/260/beast/turtle_kaiju.glb（頭朝 +z、腳底 y = 0、高 60 m，貼圖 2048 WebP），
//   鏡頭第一次到平台 2.5 km 內才下載（只有 http(s) 才有；以檔案開啟或下載失敗時海獸不出現）。
// 動作：原檔沒有骨架，_BONE 屬性分出頭、顎、兩手、兩腳，每幀算骨頭的剛體變換寫進 uBn（m-beast.mjs 在頂點著色器裡轉）；身體整個繞髖轉（Group）。
// 海面：MAT_RIGSEA 的 uRigK（白沫圈）／uRigKB（浮出前的鼓起）；水幕：rigFx 的 SPRAY（uRigS／uRigS2）；點光：beastLights()（吼叫時嘴裡的琥珀光）。
const BEAST_T = { boil: 7, rise: 20, roar: 26, walk: 62, sink: 75 };   // 每一段結束在第幾秒：翻騰 → 浮出 → 吼叫 → 涉水 → 下沉
const BEAST_R = 150, BEAST_A0 = -.5, BEAST_A1 = .25;   // 平台局部座標的極座標：半徑、起訖方位 atan2(z, x)（東北 → 東南，避開西邊的拖船與火炬臂）
const BEAST_Y = SEA_Y - 13, BEAST_DEEP = -82;   // 站著時根節點的高度（腳底；水到膝蓋）、藏在海裡的高度（頭頂也在水面下）
const BEAST_URL = A260 + 'beast/turtle_kaiju.glb';
const BEAST_NB = 7;   // 骨頭：0 身體、1 頭（脖子根）、2 下顎、3 右手、4 左手、5 右腳、6 左腳
const BEAST = { on: false, hold: false, t: 0, next: 20, root: null, body: null, mesh: null, J: null, load: null, fail: '', spray: null, circ: null, played: {}, glow: 0, x: 0, z: 0, y: BEAST_DEEP, yaw: 0, light: V3(), k: 0,
  bn: V4A(BEAST_NB * 3), bw: new T.Vector4(0, SEA_Y, 0, 0) };
for (let i = 0; i < BEAST_NB; i++) for (let r = 0; r < 3; r++) v4set(BEAST.bn, i * 3 + r, +(r === 0), +(r === 1), +(r === 2), 0);

{
  const root = BEAST.root = new T.Group(); root.visible = false; scene.add(root);
  BEAST.body = new T.Group(); root.add(BEAST.body);
  // 水幕
  const NS = isTouch ? 2500 : 6000, rr = rng(9091), pos = new Float32Array(NS * 12), ar = new Float32Array(NS * 16), idx = new Uint32Array(NS * 6);
  for (let i = 0; i < NS; i++) { const a = rr(), b = rr(), c = rr(), d = rr(); for (let j = 0; j < 4; j++) { pos.set([j & 1 ? 1 : -1, j >> 1, 0], i * 12 + j * 3); ar.set([a, b, c, d], i * 16 + j * 4); } idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6); }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('aR', new T.BufferAttribute(ar, 4)); sg.setIndex(new T.BufferAttribute(idx, 1));
  const sm = rigFxMat('SPRAY', { blending: T.AdditiveBlending }); gfxLate.push(sm);
  BEAST.spray = new T.Mesh(sg, sm); BEAST.spray.frustumCulled = false; BEAST.spray.renderOrder = 20; BEAST.spray.visible = false; scene.add(BEAST.spray);
}
// 下載模型（26-glb.js 的 glbLoader、27-props.js 的 warmJob／glbWarm 在後面的 part，只在函式裡用）
function beastLoad() {
  if (BEAST.load) return BEAST.load;
  if (!/^https?:$/.test(location.protocol)) { BEAST.fail = '以檔案開啟，不下載模型'; return BEAST.load = Promise.resolve(false); }
  return BEAST.load = glbLoader.loadAsync(BEAST_URL).then(g => warmJob(async () => {
    let src = null; g.scene.traverse(o => { if (o.isMesh && !src) src = o; });
    const J = g.scene.userData.joints, s = src.material;
    if (!J || !src.geometry.attributes._bone || !src.geometry.attributes.tangent) throw new Error('模型缺少關節或 _BONE／tangent');
    const mat = new T.ShaderMaterial({ name: 'beast', defines: {},
      uniforms: { ...shared(ALLU), uMap: { value: s.map }, uNMap: { value: s.normalMap }, uOrm: { value: s.aoMap || s.roughnessMap }, uBn: { value: BEAST.bn }, uBw: { value: BEAST.bw } } });
    const m = new T.Mesh(src.geometry, mat); m.frustumCulled = false;   // 70-render 的霧剔除照開場時的位置算，會動的不剔除
    BEAST.J = Object.fromEntries(Object.entries(J).map(([k, v]) => [k, V3(...v)]));
    const hip = BEAST.J.legL; BEAST.body.position.set(0, hip.y, hip.z); m.position.set(0, -hip.y, -hip.z);
    await glbWarm([m]);
    BEAST.body.add(m); BEAST.mesh = m;
    return true;
  })).catch(e => { BEAST.fail = String(e && e.message || e).slice(0, 120); console.warn('海獸模型下載失敗', e); return false; });
}

// ── 控制 ──
function beastGo() { if (!BEAST.mesh) return; Object.assign(BEAST, { on: true, t: 0, played: {}, next: 240 }); BEAST.root.visible = BEAST.spray.visible = true; }
function beastStop() {
  Object.assign(BEAST, { on: false, y: BEAST_DEEP, glow: 0 }); BEAST.root.visible = BEAST.spray.visible = false;
  MAT_RIGSEA.uniforms.uRigK.value.w = 0; MAT_RIGSEA.uniforms.uRigKB.value.x = 0; RIG_FXU.uRigS.value.w = 0;
  if (BEAST.circ) for (const c of BEAST.circ) c.x = c.z = 1e9;
}
const _bstV = V3(), _bstE = new T.Euler(), _bstR = new T.Matrix4(), _bstT = new T.Matrix4(), _bstH = new T.Matrix4(), _bstJ = new T.Matrix4();
const bstSs = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const bstWin = (t, a, b, f = 1.2) => bstSs((t - a) / f) * (1 - bstSs((t - b + f) / f));   // a 到 b 之間是 1，兩端各 f 秒淡入淡出
// 繞關節 c 轉（YXZ 歐拉角），有 par 時再乘上父骨頭；寫進 uBn 第 i 根（三列）
function bstBone(i, out, c, rx, ry, rz, par) {
  _bstE.set(rx, ry, rz, 'YXZ');
  out.makeTranslation(c.x, c.y, c.z).multiply(_bstR.makeRotationFromEuler(_bstE)).multiply(_bstT.makeTranslation(-c.x, -c.y, -c.z));
  if (par) out.premultiply(par);
  const e = out.elements; for (let r = 0; r < 3; r++) v4set(BEAST.bn, i * 3 + r, e[r], e[r + 4], e[r + 8], e[r + 12]);
  return out;
}
function beastUpdate(dt) {
  const cam = camera.position, cd = Math.hypot(cam.x - RIG.cx, cam.z - RIG.cz);
  if (!BEAST.on) {
    if (!BEAST.load && RIG.near && cd < 2500) beastLoad();
    if (BEAST.mesh && !BEAST.hold && RIG.near && cd < 1600 && player.where === 'out') { BEAST.next -= dt; if (BEAST.next <= 0) beastGo(); }
    return;
  }
  BEAST.t += Math.min(dt, .1);
  const t = BEAST.t, T_ = BEAST_T, B = BEAST, J = B.J;
  if (t >= T_.sink) { beastStop(); return; }
  // 位置與朝向：沿弧走；浮出與吼叫時臉朝平台，走路時順著弧的切線
  const uw = clamp((t - T_.roar) / (T_.walk - T_.roar), 0, 1), a = lerp(BEAST_A0, BEAST_A1, uw * uw * (3 - 2 * uw));
  const lx = Math.cos(a) * BEAST_R, lz = Math.sin(a) * BEAST_R, [x, z] = rigW(lx, lz), [tx, tz] = rigW(lx - Math.sin(a), lz + Math.cos(a));
  const yawRig = Math.atan2(RIG.cx - x, RIG.cz - z), yawWalk = Math.atan2(tx - x, tz - z);
  const wk = bstWin(t, T_.roar, T_.walk, 3.5);
  let dy = yawWalk - yawRig; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const yaw = yawRig + dy * wk;
  const ur = clamp((t - T_.boil) / (T_.rise - T_.boil), 0, 1), us = clamp((t - T_.walk) / (T_.sink - T_.walk), 0, 1);
  const ph = (t - T_.roar) * Math.PI * 2 / 4.2;   // 一步 2.1 秒（殼重，走得慢）
  let y = t < T_.boil ? BEAST_DEEP : lerp(BEAST_DEEP, BEAST_Y, 1 - (1 - ur) ** 3);
  if (us > 0) y = lerp(BEAST_Y, BEAST_DEEP - 4, us ** 2.2);
  y += wk * .9 * Math.abs(Math.sin(ph)) + Math.sin(t * .9) * .25;
  Object.assign(B, { x, z, y, yaw, lx, lz });
  B.root.position.set(x, y, z); B.root.rotation.y = yaw;
  // 姿勢：身體繞髖前傾（浮出時頭先出水、下沉時往前栽），吼叫時往後仰、仰頭、張嘴、舉手
  const roar = Math.max(bstWin(t, T_.rise + .3, T_.roar), .8 * bstWin(t, T_.walk - 7, T_.walk - 2));
  B.body.rotation.x = .42 * (1 - bstSs(ur * 1.2)) + .5 * bstSs(us * 1.3) + .025 * Math.sin(t * .9) - .1 * roar;
  B.body.rotation.z = .05 * Math.sin(ph) * wk;
  const head = bstBone(1, _bstH, J.head, -.44 * roar + .05 * Math.sin(t * .7), .25 * Math.sin(t * .31) * (1 - roar), .04 * Math.sin(t * .5) * (1 - roar));
  bstBone(2, _bstJ, J.jaw, .55 * roar + .04 * (1 + Math.sin(t * 1.3)), 0, 0, head);
  for (const [i, c, s] of [[3, J.armR, -1], [4, J.armL, 1]]) bstBone(i, _bstJ, c, -.55 * roar + .2 * Math.sin(ph + (s > 0 ? Math.PI : 0)) * wk + .04 * Math.sin(t * .8 + s), 0, s * .28 * roar);
  for (const [i, c, s] of [[5, J.legR, -1], [6, J.legL, 1]]) bstBone(i, _bstJ, c, -.32 * Math.sin(ph + (s > 0 ? Math.PI : 0)) * wk, 0, 0);
  B.glow = .1 + .9 * roar + .08 * Math.sin(t * 2.3);
  // 濕身：剛出水最濕，走一陣子慢慢乾一點；水線附近一直是濕的
  B.bw.set(lerp(1, .55, bstSs((t - T_.rise) / 30)), SEA_Y, t, 1);
  // 海面：翻騰時鼓起＋白沫圈，出水後是身體四周的白沫，下沉時再翻一次
  const K = MAT_RIGSEA.uniforms.uRigK.value, KB = MAT_RIGSEA.uniforms.uRigKB.value, bo = clamp(t / T_.boil, 0, 1);
  K.set(x, z, t < T_.boil ? 40 : 28 + 6 * us, t < T_.boil ? .9 * bstSs(bo) : Math.max(1 - .3 * bstSs((t - T_.rise) / 3), .7 + .3 * us) * (1 - bstSs((t - T_.sink + 2) / 2)));
  KB.x = 4 * bstSs(bo) * (1 - bstSs((t - T_.boil) / 2.5));
  // 水幕：出水那幾秒最濃，走路時腳邊一點，下沉時再一次
  RIG_FXU.uRigS.value.set(x, z, 20, t < T_.boil ? 0 : Math.max(1 - bstSs((t - T_.rise - 1) / 5), .22 * wk, us > 0 ? 1 - bstSs((t - T_.sink + 3) / 3) : 0));
  RIG_FXU.uRigS2.value.set(Math.max(SEA_Y + 2, y + 50), SEA_Y, 0, 0);
  // 嘴裡的光：嘴前緣跟著頭與下顎轉
  B.root.updateMatrixWorld(true);   // 每幀都在動：整棵一起強制重算（拖船的 rigUpdate 也是自己算）
  B.light.set(0, J.jaw.y - 1, J.jaw.z + 9).applyMatrix4(head).applyMatrix4(B.mesh.matrixWorld);
  // 碰撞：殼與頭（30-vehicles.js 的 dynMore；頂層是 TDZ，第一次更新才放進去）
  if (!B.circ) { B.circ = [{ x: 1e9, z: 1e9, r: 24 }, { x: 1e9, z: 1e9, r: 9 }]; dynMore.push(...B.circ); }
  const up = y > BEAST_DEEP + 30;
  [[0, 30, -6], [0, 36, 38]].forEach((p, i) => { _bstV.set(...p).applyMatrix4(B.mesh.matrixWorld); B.circ[i].x = up ? _bstV.x : 1e9; B.circ[i].z = up ? _bstV.z : 1e9; });
  // 聲音（照鏡頭距離）
  const k = (1 - clamp(Math.hypot(cam.x - x, cam.z - z) / 2600, 0, 1)) ** 2, fire = (id, at, f) => { if (t >= at && !B.played[id]) { B.played[id] = 1; if (player.where === 'out') f(); } };
  fire('rumble', .2, () => sfx.beastRumble(k)); fire('rise', T_.boil + .5, () => sfx.splash(k)); fire('roar', T_.rise + .6, () => sfx.beastRoar(k));
  fire('roar2', T_.walk - 6.5, () => sfx.beastRoar(k * .7)); fire('sink', T_.walk + 2, () => sfx.splash(k));
}
// 點光：吼叫時嘴裡的琥珀色光（鏡頭 1.6 km 內、出水以後）
const BEAST_LC = lin(0xff7a20);
function beastLights() {
  const B = BEAST, cam = camera.position;
  if (!B.on || B.y < BEAST_DEEP + 35 || B.glow < .15 || Math.hypot(cam.x - B.x, cam.z - B.z) > 1600) return [];
  return [{ x: B.light.x, y: B.light.y, z: B.light.z, col: BEAST_LC, r: 70, i: 34 * B.glow }];
}
// 測試用：跳到第幾秒（姿勢與海面照那一刻擺好）；模型還沒下載好就回傳 false
function beastSeek(s) { if (!BEAST.mesh) return false; if (!BEAST.on) beastGo(); BEAST.t = Math.max(0, s - .016); BEAST.played = { rumble: 1, rise: 1, roar: 1, roar2: 1, sink: 1 }; beastUpdate(.016); return true; }
