
// ═══ 人物：Quaternius Universal Base Characters 男女底模＋ Universal Animation Library 動畫（CC0） ═══
// blender/people.py 分好無鋸齒衣物切面、立體領口／下擺層次、圓頭平底鞋楦與七款髮型帽款，並打包 1024×1024 角色細節圖集（T_CharAtlas）；
// tools/people.mjs 以 meshopt 壓縮成 blender/out/people.glb，打包時內嵌成 #glb-people。
// 男女各依七種髮型／帽款，把身體、眉毛、眼睛與那組頭髮合併成一份蒙皮幾何（aSlot 分區＋uv 對圖集），每人一個 SkeletonUtils 複製的
// SkinnedMesh＋自己的 AnimationMixer，一人一次 draw；衣服、內搭、膚色、髮色、虹膜與帽色是每人材質的 uniform。
// 骨架（65 根骨頭）不放進場景圖：網格用 detached 綁定掛在每人的外層節點下，骨頭只在角色空間裡、擺姿勢時才更新，
// 否則每次 render（倒影＋主畫面）都要重算幾千個骨頭矩陣。
// 動畫時間不累加，每幀由 uTime／uBeat 換算（舞池對拍）；動畫庫沒有的動作（調酒、DJ、撐傘、抽菸、抱胸、滑手機）在播放後覆寫骨頭。
// 角色面向 +z，左手在 +x。
await bootStep(BOOT.people, '行人出門…');
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
const SLOT = { skin: 0, top: 1, sleeve: 2, bottom: 3, shin: 4, shoe: 5 };   // 6 頭髮 7 眉毛 8 眼睛 9 帽子
const HAIR_VARS = {
  Male: ['SimpleParted', 'Buzzed', 'Beard', 'BuzzedBeard', 'PartedBeard', 'Swept', 'Cap'],
  Female: ['Long', 'Buns', 'BuzzedFemale', 'Bob', 'LowBun', 'WavyMid', 'Cap'],
};
// aPat 的換算（見 PEOPLE 裡 geos 的註解）；pf 是那一份身體幾何量出來的，衣服併進去時照同一組
function patOf(pos, pf) {
  const pat = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    pat[i] = (pos[i + pf.up] - pf.y0) * pf.sc;
    pat[i + 1] = (pos[i] - pf.cx) * pf.sc;   // 女性的綁定空間左右偏了約 1 m（檔案裡男女並排），以身體左右的中點為 0
    pat[i + 2] = (pos[i + pf.fwdAx] - pf.midFwd) * pf.sc * pf.fwdSgn;
  }
  return pat;
}
const PEOPLE = await (async () => {
  const gltf = await embeddedGLB('people');
  // 兩副骨架的骨頭同名，載入器會把後面那副改成「名稱_1」；統一改回原名，動畫軌道也一樣
  const names = new Set();
  gltf.scene.traverse(o => names.add(o.name));
  const canon = n => { const m = /^(.*)_\d+$/.exec(n); return m && names.has(m[1]) ? m[1] : n; };
  gltf.scene.traverse(o => { if (o.isBone) o.name = canon(o.name); });
  // 動畫只留旋轉（加上骨盆位移）：男女骨架長度不同，不能套用其他骨頭的位移
  const clips = new Map();
  for (const c of gltf.animations) {
    for (const t of c.tracks) { const i = t.name.lastIndexOf('.'); t.name = canon(t.name.slice(0, i)) + t.name.slice(i); }
    c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || /^(pelvis|root)\.position$/.test(t.name));
    clips.set(c.name, c);
  }
  let atlas = null;
  const tpl = {}, geos = {}, bind = {}, wear = {};
  // 衣服（blender/wear.py）：網格名稱 W_<款式>_<Male|Female>，換到同一個綁定空間後在 wearGeo 併進每個人的幾何；下載或解碼失敗就照舊只有身體
  const wgl = await embeddedGLB('wear').catch(e => { console.warn('衣服模型載入失敗', e); return null; });
  const wNames = new Set();
  if (wgl) wgl.scene.traverse(o => wNames.add(o.name));
  const wCanon = n => { const m = /^(.*)_\d+$/.exec(n); return m && wNames.has(m[1]) ? m[1] : n; };
  const P = V3(), N = V3(), M = new T.Matrix4(), A = new T.Matrix4(), NM = new T.Matrix3(), UM = new T.Matrix3();
  for (const g of ['Male', 'Female']) {
    const grp = gltf.scene.getObjectByName(g);
    const meshes = [];
    grp.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    const body = meshes.find(m => m.material.name.endsWith('_skin'));
    if (!atlas && body.material.map) {
      atlas = body.material.map;
      atlas.anisotropy = 4;
    }
    const sk = body.skeleton, bi = new Map(sk.bones.map((b, i) => [b.name, i])), jb = bi.get('pelvis');
    // 掃描人物（scanGet）換到同一個綁定空間用：身體的 bindMatrixInverse × 骨盆的綁定矩陣、骨名 → 編號
    bind[g] = { M: body.bindMatrixInverse.clone().multiply(sk.boneInverses[jb].clone().invert()), bi };
    const parts = [];   // 每個網格一段；v 是髮型編號（-1 = 每個人都有）
    for (const m of meshes) {
      const own = m.name + ' ' + (m.parent ? m.parent.name : '');
      const hair = /_Hair_([A-Za-z]+)/.exec(own);
      const isCap = /_CapMesh/.test(own) || m.material.name.endsWith('_cap');
      const s = isCap ? 9 : hair ? 6 : /_Brows/.test(own) ? 7 : /_Eyes/.test(own) ? 8 : SLOT[m.material.name.split('_').pop()] ?? 0;
      const c = { v: hair ? HAIR_VARS[g].indexOf(hair[1]) : -1, pos: [], nor: [], uv: [], si: [], sw: [], slot: [], unp: [], unn: [], idx: [] };
      // 各網格的 inverse bind 可能差一個量化變換：把頂點換到身體那副骨架的綁定空間
      const ms = m.skeleton, jm = ms.bones.findIndex(b => b.name === 'pelvis');
      M.copy(body.bindMatrixInverse).multiply(A.copy(sk.boneInverses[jb]).invert()).multiply(ms.boneInverses[jm]).multiply(m.bindMatrix);
      NM.getNormalMatrix(M); UM.setFromMatrix4(M);
      // _unpuff／_pmask（people.py）：上衣、褲子分區鼓起來的位移和它屬於哪一組，穿上衣服時 m-char 退回皮膚。
      // 自訂屬性匯出時不會像 POSITION 那樣換成 Y 朝上，這裡自己換（Blender 的 x、y、z → x、z、-y）
      const ga = m.geometry.attributes, guv = ga.uv, gu = ga._unpuff, gn = ga._unorm, gm = ga._pmask;
      const remap = ms.bones.map(b => bi.get(b.name) ?? 0);
      for (let i = 0; i < ga.position.count; i++) {
        P.fromBufferAttribute(ga.position, i).applyMatrix4(M); c.pos.push(P.x, P.y, P.z);
        N.fromBufferAttribute(ga.normal, i).applyMatrix3(NM).normalize(); c.nor.push(N.x, N.y, N.z);
        c.uv.push(guv ? guv.getX(i) : .9, guv ? guv.getY(i) : .1);
        for (let k = 0; k < 4; k++) { c.si.push(remap[ga.skinIndex.getComponent(i, k)]); c.sw.push(ga.skinWeight.getComponent(i, k)); }
        c.slot.push(s);
        if (gu && gn && gm) {
          P.set(gu.getX(i), gu.getZ(i), -gu.getY(i)).applyMatrix3(UM); c.unp.push(P.x, P.y, P.z, Math.round(gm.getX(i)));
          N.set(gn.getX(i), gn.getZ(i), -gn.getY(i)).applyMatrix3(NM).normalize(); c.unn.push(N.x, N.y, N.z);
        } else { c.unp.push(0, 0, 0, 0); c.unn.push(0, 0, 0); }
      }
      const ix = m.geometry.index;
      if (ix) for (let i = 0; i < ix.count; i++) c.idx.push(ix.getX(i));
      else for (let i = 0; i < ga.position.count; i++) c.idx.push(i);
      parts.push(c);
    }
    // 用眼球部件的位置自動判別綁定空間的前方正負號，確保 aPat.z > 0 永遠代表身體正面（開襟外套、口袋都在胸前）
    const eyePart = parts.find(c => c.slot[0] === 8);
    // 每種髮型一份幾何（身體＋那頂頭髮／帽子），沒戴的頭髮不必跑頂點 shader
    geos[g] = HAIR_VARS[g].map((_, h) => {
      const pos = [], nor = [], uvs = [], si = [], sw = [], slot = [], unp = [], unn = [], idx = [];
      for (const c of parts) {
        if (c.v >= 0 && c.v !== h) continue;
        const base = pos.length / 3;
        pos.push(...c.pos); nor.push(...c.nor); uvs.push(...c.uv); si.push(...c.si); sw.push(...c.sw); slot.push(...c.slot); unp.push(...c.unp); unn.push(...c.unn);
        for (const i of c.idx) idx.push(base + i);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
      geo.setAttribute('aSlot', new T.Float32BufferAttribute(slot, 1));
      geo.setAttribute('aUnp', new T.Float32BufferAttribute(unp, 4));
      geo.setAttribute('aUnn', new T.Float32BufferAttribute(unn, 3));
      // 衣物版型與皺褶用的座標（公尺）：x 為離腳底高度（0..1.75）、y 為左右、z 為前後（+ 為胸前正面）
      const bb = new T.Box3().setFromArray(pos), ext = bb.getSize(V3()), up = ext.y >= ext.z ? 1 : 2, fwdAx = 3 - up;
      const sc = 1.75 / Math.max(ext.y, ext.z), midFwd = (bb.min.getComponent(fwdAx) + bb.max.getComponent(fwdAx)) * .5;
      let eyeFwd = midFwd + 1;
      if (eyePart && eyePart.pos.length >= 3) {
        let sum = 0;
        for (let i = 0; i < eyePart.pos.length; i += 3) sum += eyePart.pos[i + fwdAx];
        eyeFwd = sum / (eyePart.pos.length / 3);
      }
      const fwdSgn = eyeFwd >= midFwd ? 1 : -1;
      const pf = { up, fwdAx, y0: bb.min.getComponent(up), sc, midFwd, fwdSgn, cx: (bb.min.x + bb.max.x) / 2 };
      geo.setAttribute('aPat', new T.BufferAttribute(patOf(pos, pf), 3));
      geo.setIndex(idx);
      geo.userData.pf = pf;   // 衣服的 aPat 照同一組換算（wearGeo）
      wearZero(geo);
      return charPack(geo, true);
    });
    // 這個性別的衣服：和上面身體的部件同樣換到身體的綁定空間；_trim 是 wear.py 標的部位（0 布面、1 滾邊與配色、2 金屬）
    wear[g] = {};
    if (wgl) wgl.scene.traverse(m => {
      const mm = m.isSkinnedMesh && /^W_(.+)_(Male|Female)$/.exec(m.name);
      if (!mm || mm[2] !== g) return;
      const ms = m.skeleton, jm = ms.bones.findIndex(b => wCanon(b.name) === 'pelvis');
      M.copy(body.bindMatrixInverse).multiply(A.copy(sk.boneInverses[jb]).invert()).multiply(ms.boneInverses[jm]).multiply(m.bindMatrix);
      NM.getNormalMatrix(M);
      const ga = m.geometry.attributes, n = ga.position.count, tr = ga._trim, gg = ga._grp;
      const remap = ms.bones.map(b => bi.get(wCanon(b.name)) ?? 0);
      // grp：配件往外推的單位（wear_acc.py 的 _grp，見 wearLift）；沒有的不推
      const c = { pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), si: new Uint16Array(n * 4), sw: new Float32Array(n * 4), trim: new Float32Array(n), grp: gg ? new Float32Array(n) : null, idx: [] };
      for (let i = 0; i < n; i++) {
        P.fromBufferAttribute(ga.position, i).applyMatrix4(M).toArray(c.pos, i * 3);
        N.fromBufferAttribute(ga.normal, i).applyMatrix3(NM).normalize().toArray(c.nor, i * 3);
        for (let k = 0; k < 4; k++) { c.si[i * 4 + k] = remap[ga.skinIndex.getComponent(i, k)]; c.sw[i * 4 + k] = ga.skinWeight.getComponent(i, k); }
        c.trim[i] = tr ? tr.getX(i) : 0;
        if (gg) c.grp[i] = gg.getX(i);
      }
      const ix = m.geometry.index;
      c.idx = ix ? Array.from(ix.array) : Array.from({ length: n }, (_, i) => i);
      // 鞋子的墊高與壓腳掌（wear_shoes.py 照這個姿勢做鞋，寫在 extras；poseOne 照它擺）
      c.lift = m.userData.lift || 0; c.flex = m.userData.flex || 0;
      wear[g][mm[1]] = c;
    });
    const t = new T.Group();
    t.add(grp.getObjectByName('root'));
    const sm = new T.SkinnedMesh(geos[g][0]);
    // 女性骨架在檔案裡平移了 1.2 m（男女並排），inverse bind 帶著這段位移；骨頭移出群組後要補回去
    sm.bind(new T.Skeleton(sk.bones, sk.boneInverses.map(m => m.clone().multiply(grp.matrix))), body.bindMatrix);
    sm.name = 'body';
    t.add(sm);
    tpl[g] = t;
  }
  relaxClips(clips, tpl.Male);
  // 坐姿與騎車的骨盆高度：和舊版程序人物對齊（坐在 y 處的人髖部在 y＋.78，騎士在座位原點上 .87）
  const seat = {};
  const probe = cloneSkinned(tpl.Male), mx = new T.AnimationMixer(probe), pel = probe.getObjectByName('pelvis');
  for (const [c, h] of [['Sitting_Idle_Loop', .78], ['Sitting_Talking_Loop', .78], ['Driving_Loop', .87]]) {
    mx.stopAllAction(); mx.clipAction(clips.get(c)).play(); mx.update(0);
    probe.updateMatrixWorld(true);
    seat[c] = h - pel.getWorldPosition(P).y;
  }
  return { tpl, geos, clips, seat, bind, atlas, wear };
})().catch(e => { console.warn('人物模型載入失敗，街上不放人', e); return null; });

// 修正動畫庫預設的誇張備戰姿勢（在載入時一次性處理軌道，每幀零額外 CPU 成本）：
// 1. 手指：取代死板平攤的 T 字手掌，建立食指到小指漸進微彎的自然放鬆手型，消除木偶手／握拳感
// 2. 站姿雙腿：收窄 Idle_Loop 與 Idle_Talking_Loop 原本大外八的超級英雄馬步，並回正腳掌貼平地面、補償骨盆高度
// 3. 待機與交談雙臂：收回外張的上臂與對稱端在腹前的雙手，讓後續每人差異化手勢自然疊加
function relaxClips(clips, tpl) {
  const rest = new Map(), naturalHand = new Map();
  const curlSpec = { index: [.17, .24, .15], middle: [.25, .34, .21], ring: [.33, .43, .27], pinky: [.40, .50, .31], thumb: [.10, .16, .14] };
  const qCurl = new T.Quaternion(), axX = V3(1, 0, 0);
  tpl.traverse(o => {
    if (!o.isBone) return;
    rest.set(o.name, o.quaternion.clone());
    const m = /^(thumb|index|middle|ring|pinky)_0([123])_([lr])$/.exec(o.name);
    if (m) {
      const ang = curlSpec[m[1]][+m[2] - 1];
      qCurl.setFromAxisAngle(axX, ang);
      naturalHand.set(o.name, o.quaternion.clone().multiply(qCurl));
    }
  });
  const q = new T.Quaternion();
  const each = (t, f) => { for (let i = 0; i < t.values.length; i += 4) f(q.fromArray(t.values, i)).toArray(t.values, i); };
  for (const [name, c] of clips) {
    if (name === 'Driving_Loop' || name.startsWith('Pistol_')) continue;
    for (const t of c.tracks) {
      const bone = t.name.slice(0, t.name.lastIndexOf('.'));
      if (naturalHand.has(bone)) each(t, v => v.slerp(naturalHand.get(bone), .76));
      else if (name === 'Idle_Loop' && /^lowerarm_/.test(bone)) each(t, v => v.slerp(rest.get(bone), .36));
      else if (name === 'Idle_Talking_Loop' && /^lowerarm_/.test(bone)) each(t, v => v.slerp(rest.get(bone), .42));
    }
  }

  // 收斂站立與說話的大外八跨步與雙臂外張
  const body = cloneSkinned(tpl), mixer = new T.AnimationMixer(body);
  const pw = new T.Quaternion(), bw = new T.Quaternion(), vDir = V3(), vGoal = V3();
  for (const [clipName, armPull, legPull] of [['Idle_Loop', .46, .62], ['Idle_Talking_Loop', .48, .62]]) {
    const clip = clips.get(clipName);
    if (!clip) continue;
    mixer.stopAllAction();
    mixer.clipAction(clip).play();
    mixer.update(0);
    body.updateMatrixWorld(true);
    const ballL = body.getObjectByName('ball_l'), footL = body.getObjectByName('foot_l');
    const yBefore = Math.min(ballL.getWorldPosition(V3()).y, footL.getWorldPosition(V3()).y);

    // 上臂往身體兩側自然垂放
    for (const s of ['l', 'r']) {
      const ua = body.getObjectByName(`upperarm_${s}`), la = body.getObjectByName(`lowerarm_${s}`);
      const track = clip.tracks.find(t => t.name === `upperarm_${s}.quaternion`);
      if (!track) continue;
      const dir = la.position.clone().applyQuaternion(ua.quaternion).normalize();
      const down = V3(s === 'l' ? .07 : -.07, -1, .02).normalize().applyQuaternion(ua.parent.getWorldQuaternion(pw).invert());
      const fix = new T.Quaternion().setFromUnitVectors(dir, dir.clone().lerp(down, armPull).normalize());
      each(track, v => v.premultiply(fix));
    }

    // 大腿與小腿從超級英雄寬馬步往自然站姿收攏，並補償腳踝使鞋底水平貼地
    for (const [s, sgn] of [['l', 1], ['r', -1]]) {
      const th = body.getObjectByName(`thigh_${s}`), ca = body.getObjectByName(`calf_${s}`), ft = body.getObjectByName(`foot_${s}`);
      const thTrack = clip.tracks.find(t => t.name === `thigh_${s}.quaternion`);
      const caTrack = clip.tracks.find(t => t.name === `calf_${s}.quaternion`);
      const ftTrack = clip.tracks.find(t => t.name === `foot_${s}.quaternion`);
      const footWorldBefore = ft.getWorldQuaternion(new T.Quaternion());
      if (caTrack) each(caTrack, v => v.slerp(rest.get(`calf_${s}`), .45));
      if (thTrack) {
        th.parent.getWorldQuaternion(pw);
        bw.multiplyQuaternions(pw, th.quaternion);
        vDir.copy(ca.position).normalize().applyQuaternion(bw);
        vGoal.set(sgn * .045, -1, .015).normalize();
        const wFix = new T.Quaternion().setFromUnitVectors(vDir, vDir.clone().lerp(vGoal, legPull).normalize());
        const lFix = pw.clone().invert().multiply(wFix).multiply(pw);
        each(thTrack, v => v.premultiply(lFix));
      }
      // 更新姿勢後把腳掌回正到原本的水平世界旋轉（再微調朝前，消除誇張外八腳尖）
      mixer.stopAllAction(); mixer.clipAction(clip).play(); mixer.update(0); body.updateMatrixWorld(true);
      if (ftTrack) {
        const footWorldNow = ft.getWorldQuaternion(new T.Quaternion());
        const yawStraight = new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), -sgn * .10);
        const targetWorld = yawStraight.multiply(footWorldBefore);
        // 世界旋轉的差轉成局部右乘修正（第 0 格量的），整段迴圈都照這個量平貼地面
        const deltaLocal = footWorldNow.clone().invert().multiply(targetWorld);
        each(ftTrack, v => v.multiply(deltaLocal));
      }
    }
    // 重新量測腳底高度，修正 pelvis.position 的 y 使鞋底剛好踩在地面（不懸空也不陷地）
    mixer.stopAllAction(); mixer.clipAction(clip).play(); mixer.update(0); body.updateMatrixWorld(true);
    const yAfter = Math.min(ballL.getWorldPosition(V3()).y, footL.getWorldPosition(V3()).y);
    const dy = yBefore - yAfter;
    const pelPos = clip.tracks.find(t => t.name === 'pelvis.position');
    if (pelPos && Math.abs(dy) > 1e-4) {
      for (let i = 1; i < pelPos.values.length; i += 3) pelPos.values[i] += dy;
    }
  }
  mixer.stopAllAction();
}



// ─── 穿衣服：那個髮型的身體＋這幾件衣服併成一份幾何（同一組衣服的人共用，快取起來）───
// 衣服的頂點 aSlot = 10，顏色 aWA／aWB／aWC（線性色，8 位元 ×4，第 4 個不用）、aWP（圖案、參數、粗糙度、部位）；身體的這幾個屬性是 0
function wearZero(geo) {
  const n = geo.attributes.position.count;
  for (const k of ['aWA', 'aWB', 'aWC']) geo.setAttribute(k, new T.BufferAttribute(new Uint8Array(n * 4), 4, true));
  geo.setAttribute('aWN', new T.BufferAttribute(new Int8Array(n * 4), 4, true));
  geo.setAttribute('aWP', new T.BufferAttribute(new Float32Array(n * 4), 4));
  if (!geo.attributes.aUnp) geo.setAttribute('aUnp', new T.BufferAttribute(new Float32Array(n * 4), 4));
  if (!geo.attributes.aUnn) geo.setAttribute('aUnn', new T.BufferAttribute(new Float32Array(n * 3), 3));
}
// WebGPU 一條管線最多 8 個頂點緩衝：浮點的 aSlot／aUnp／aUnn／aPat／aWP 交錯成一個、8 位元的衣服顏色交錯成一個（加上位置、法線、uv、骨頭共 8 個）。
// raw：交錯前的陣列留給 wearGeo、wearHide 讀（基本身體）；穿好衣服的那份不必留。
// 寫成函式宣告、清單放在裡面：PEOPLE 的載入在頂層 await 之後就會跑到這裡，那時排在後面的 const 還沒有值
function charPack(g, raw) {
  const n = g.attributes.position.count;
  if (raw) g.userData.raw = {};
  for (const [names, Ty] of [[['aSlot', 'aUnp', 'aUnn', 'aPat', 'aWP'], Float32Array], [['aWA', 'aWB', 'aWC'], Uint8Array]]) {
    const at = names.map(k => g.attributes[k]), st = at.reduce((s, a) => s + a.itemSize, 0), arr = new Ty(n * st), ib = new T.InterleavedBuffer(arr, st);
    let off = 0;
    names.forEach((k, j) => {
      const a = at[j], sz = a.itemSize, src = a.array;
      for (let i = 0; i < n; i++) for (let c = 0; c < sz; c++) arr[i * st + off + c] = src[i * sz + c];
      if (raw) g.userData.raw[k] = src;
      g.setAttribute(k, new T.InterleavedBufferAttribute(ib, sz, off, a.normalized));
      off += sz;
    });
  }
  return g;
}
function charRaw(g, k) { return (g.userData.raw && g.userData.raw[k]) || g.attributes[k].array; }
const WEAR_GEO = new Map();
// 圖案參數：位置型的圖案（胸前、背後、帽子正面）依性別給高度（女性的胸口比較低），w.ph 可以自己指定 [男, 女]；其他圖案用 w.p（多半是密度）
const WEAR_PH = { emblem: [1.31, 1.25], sunset: [1.27, 1.21], badge: [1.715, 1.66], skull: [1.722, 1.667], butterfly: [1.33, 1.29], muay: [.86, .84], crease: [.112, .108], moto: [.542, .535],
  varsity: [1.33, 1.27], crown: [1.33, 1.29], starry: [21.0929, 15.0912], dragon: [1.28, 1.24], gothic: [1.107, 1.09] };
const wearParam = (w, sex) => { const h = w.ph || WEAR_PH[w.pat]; return h ? h[sex === 'Male' ? 0 : 1] : w.p; };
// 襪子圖案的高度參數（aWP.y）：照這件在這份身體上量（aPat 的比例每個髮型不同，寫死的高度會差幾公分）。
// 多半是襪口高度；不對稱的 K12 是右腳（aPat.y < 0）的襪口；網襪、黑絲是大腿根（小腿區上緣往上 30 cm）；用 p 的（格子密度）照舊
const SOCK_TOP = new Set(['sockstripe', 'heather', 'flame', 'lacesheer', 'compress', 'tiedye', 'soccer']);
function sockRef(w, pp, base) {
  if (w.pat === 'fishnet' || w.pat === 'monosheer') return legInfo(base).top + .3;
  if (!SOCK_TOP.has(w.pat) && w.pat !== 'bwstripe') return w.p;
  let t = 0;
  for (let i = 0; i < pp.length; i += 3) if (w.pat !== 'bwstripe' || pp[i + 1] < 0) t = Math.max(t, pp[i]);
  return t;
}
function wearGeo(sex, hIdx, items) {
  const key = `${sex}${hIdx}:${items.map(w => w.id).join(',')}`;
  let g = WEAR_GEO.get(key);
  if (g) return g;
  const base = PEOPLE.geos[sex][hIdx] || PEOPLE.geos[sex][0], W = PEOPLE.wear[sex], pf = base.userData.pf, B = base.attributes;
  const parts = items.map(w => [w, W[w.shape]]).filter(x => x[1]);
  // 穿鞋就附上腳（W_foot）：鞋子蓋住的三角形丟掉，露出來的是皮膚；穿了襪子（有襪底的）就照那雙襪子的顏色與圖案
  const shp = parts.find(([w]) => w.cat === 'shoes'), skp = parts.find(([w]) => w.cat === 'socks' && !w.nofoot);
  if (shp && W.foot) parts.push([skp ? { ...skp[0], id: 'foot', cat: 'foot', shape: 'foot', sock: skp[0] } : { ...FOOT_SKIN, c: shp[0].nail ?? FOOT_SKIN.c }, W.foot]);
  const nb = B.position.count, n = nb + parts.reduce((a, [, c]) => a + c.pos.length / 3, 0);
  const arr = (k, sz, Ty) => { const a = new Ty(n * sz); a.set(charRaw(base, k)); return a; };
  const pos = arr('position', 3, Float32Array), nor = arr('normal', 3, Float32Array), uv = arr('uv', 2, Float32Array), si = arr('skinIndex', 4, Uint16Array), sw = arr('skinWeight', 4, Float32Array);
  const slot = arr('aSlot', 1, Float32Array), unp = arr('aUnp', 4, Float32Array), unn = arr('aUnn', 3, Float32Array), pat = arr('aPat', 3, Float32Array), wa = new Uint8Array(n * 4), wb = new Uint8Array(n * 4), wc = new Uint8Array(n * 4), wp = new Float32Array(n * 4), wn = new Int8Array(n * 4);
  const idx = Array.from(base.index.array);
  const c8 = (hex, a, i) => { const c = lin(hex); a[i] = Math.round(c.r * 255); a[i + 1] = Math.round(c.g * 255); a[i + 2] = Math.round(c.b * 255); };
  const legs = parts.some(([w]) => WEAR_BOT.has(w.cat));
  for (const [w] of parts) { const h = wearHide(sex, hIdx, w, legs); for (let i = 0; i < nb; i++) if (h[i]) wp[i * 4 + 3] = 1; }
  const jk = parts.find(([w]) => w.cat === 'jacket' && !w.see), pn = parts.find(([w]) => w.cat === 'pants');
  const lift = wearLift(sex, hIdx, parts);
  let o = nb;
  for (const [w, c] of parts) {
    const m = c.pos.length / 3, cp = lift.get(c) || c.pos, pp = patOf(cp, pf), sw0 = w.sock || w;
    const par = sw0.cat === 'socks' ? sockRef(sw0, w.sock ? patOf(W[sw0.shape].pos, pf) : pp, base) : wearParam(w, sex);
    pos.set(cp, o * 3); nor.set(c.nor, o * 3); si.set(c.si, o * 4); sw.set(c.sw, o * 4); slot.fill(10, o, o + m);
    pat.set(pp, o * 3);
    for (let i = 0; i < m; i++) {
      const j = o + i;
      c8(w.a, wa, j * 4); c8(w.b, wb, j * 4); c8(w.c, wc, j * 4);
      // 綁定姿勢的法線，軸序同 aPat（上、左右、前後）：m-char 的三面投影
      wn[j * 4] = Math.round(c.nor[i * 3 + pf.up] * 127); wn[j * 4 + 1] = Math.round(c.nor[i * 3] * 127); wn[j * 4 + 2] = Math.round(c.nor[i * 3 + pf.fwdAx] * pf.fwdSgn * 127);
      // 鏡片（部位 5）的 x、y 改放鏡片的種類與明度
      const lens = c.trim[i] > 4.95 && c.trim[i] < 5.9;
      wp[j * 4] = lens ? WEAR_LENS[w.lens] ?? 0 : WEAR_PAT[w.pat] ?? 0; wp[j * 4 + 1] = lens ? w.lv ?? .05 : par; wp[j * 4 + 2] = w.rough + (lens ? 0 : (w.num ?? 0) * 10);
      wp[j * 4 + 3] = w.sock && c.trim[i] > 13.5 ? 0 : c.trim[i];   // 穿襪子的腳：皮膚換成襪子的布面
      uv[j * 2] = .9; uv[j * 2 + 1] = .1;
    }
    // 外套底下的上衣、褲裙；長褲底下的襪子（裙子底下的不丟：裙擺會飄開）；鞋子裡面的腳、襪子與塞進靴筒的褲管
    const un = wearOr(jk && WEAR_UNDER_CAT.has(w.cat) && wearUnder(sex, jk[0], w), pn && w.cat === 'socks' && wearUnder(sex, pn[0], w),
      shp && (w.cat === 'socks' || w.cat === 'pants' || w.cat === 'foot') && wearUnder(sex, shp[0], w)), I = c.idx;
    const nail = w.sock ? c.trim : null;   // 穿襪子的腳不畫指甲
    for (let t = 0; t < I.length; t += 3) {
      if (un && un[I[t]] && un[I[t + 1]] && un[I[t + 2]] || nail && nail[I[t]] > 14.5) continue;
      idx.push(o + I[t], o + I[t + 1], o + I[t + 2]);
    }
    o += m;
  }
  g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
  g.setAttribute('aSlot', new T.BufferAttribute(slot, 1)); g.setAttribute('aUnp', new T.BufferAttribute(unp, 4)); g.setAttribute('aUnn', new T.BufferAttribute(unn, 3)); g.setAttribute('aPat', new T.BufferAttribute(pat, 3));
  g.setAttribute('aWA', new T.BufferAttribute(wa, 4, true)); g.setAttribute('aWB', new T.BufferAttribute(wb, 4, true)); g.setAttribute('aWC', new T.BufferAttribute(wc, 4, true));
  g.setAttribute('aWP', new T.BufferAttribute(wp, 4)); g.setAttribute('aWN', new T.BufferAttribute(wn, 4, true));
  g.setIndex(idx);
  charPack(g, false);
  WEAR_GEO.set(key, g);
  return g;
}
// 這件衣服蓋住身體的哪些頂點（m-char 的 vWP.w）：沿身體頂點的法線往外射 WEAR_HIDE_R，打到衣服的面就算蓋住；
// 往內 WEAR_HIDE_IN 也算（殼抹平肌肉時在胸口、大腿這些凸的地方會縮進皮膚裡，那裡的身體本來就會穿出來）。
// 只蓋貼身的地方：寬的裙襬、外套下襬底下的腿和身體照樣畫，從下面往上看才不會是空的。每件衣服、每個髮型的身體各量一次
// 配件只有 hide 的（手套）藏底下的手，而且只藏 WEAR_HIDE_AC 以內（手套貼著手，射遠了會把指頭露出來的那節也藏掉）
const WEAR_HIDE_R = .04, WEAR_HIDE_SK = .012, WEAR_HIDE_J = .065, WEAR_HIDE_IN = .015, WEAR_HIDE_AC = .008, WEAR_HIDE = new Map(), WEAR_NOHIDE = new Set(['hat', 'glasses', 'acc', 'foot']);
// 衣服的三角形按 3 cm 的格子分桶，回傳 cast(o, d, R, IN, FK)：從 o 沿 d 射到 R 遠（往內 IN 也算，預設 WEAR_HIDE_IN）有沒有打到衣服；
// FK：衣服外面的面要和射線夾多正才算（身體用 .5，見下）
function wearCaster(c) {
  const P = c.pos, I = c.idx, G = new Map(), cs = .03, ck = (x, y, z) => (Math.floor(x / cs) * 73856093) ^ (Math.floor(y / cs) * 19349663) ^ (Math.floor(z / cs) * 83492791);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
    const x0 = Math.floor(Math.min(P[a], P[b], P[d]) / cs), x1 = Math.floor(Math.max(P[a], P[b], P[d]) / cs);
    const y0 = Math.floor(Math.min(P[a + 1], P[b + 1], P[d + 1]) / cs), y1 = Math.floor(Math.max(P[a + 1], P[b + 1], P[d + 1]) / cs);
    const z0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[d + 2]) / cs), z1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[d + 2]) / cs);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const k = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
      let l = G.get(k); if (!l) G.set(k, l = []); l.push(t);
    }
  }
  const hit = (ox, oy, oz, dx, dy, dz, t, HR, IN, FK) => {   // Möller–Trumbore，射線長 HR
    const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
    const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[d] - P[a], e2y = P[d + 1] - P[a + 1], e2z = P[d + 2] - P[a + 2];
    const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) < 1e-12) return false;
    // 只算和身體表面差不多平行的面：衣緣往內折回去的那圈是橫的，算進來會連衣緣外面一點的身體也藏掉（看得到洞）
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    const flat = Math.abs(fx * dx + fy * dy + fz * dz) >= FK * Math.hypot(fx, fy, fz);
    const iv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2], u = (tx * px + ty * py + tz * pz) * iv;
    if (u < 0 || u > 1) return false;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * iv;
    if (v < 0 || u + v > 1) return false;
    const tt = (e2x * qx + e2y * qy + e2z * qz) * iv;
    // 斜的面只算身體裡面的（腋下這種大三角形的殼是斜的，身體從那裡穿出來）；衣緣外面那圈由呼叫的地方往內縮一圈保住
    return (flat || tt < 0) && tt > -IN && tt < HR;
  };
  return (ox, oy, oz, dx, dy, dz, HR, IN = WEAR_HIDE_IN, FK = .5) => {
    const seen = new Set();
    for (const s of [-IN / HR, -IN / HR / 2, -.6, 0, .5, 1]) {
      const l = G.get(ck(ox + dx * HR * s, oy + dy * HR * s, oz + dz * HR * s));
      if (!l) continue;
      for (const t of l) { if (seen.has(t)) continue; seen.add(t); if (hit(ox, oy, oz, dx, dy, dz, t, HR, IN, FK)) return true; }
    }
    return false;
  };
}
// 往內縮一圈：只藏一圈鄰點都被蓋住的頂點。藏不藏是逐頂點內插的，衣緣內側那個頂點藏了，丟掉的範圍會越過衣緣半個三角形（看得到鋸齒狀的洞）
function wearShrink(h, BI) {
  const keep = new Uint8Array(h.length);
  for (let t = 0; t < BI.length; t += 3) {
    const a = BI[t], b = BI[t + 1], d = BI[t + 2];
    if (!(h[a] && h[b] && h[d])) { keep[a] = keep[b] = keep[d] = 1; }
  }
  for (let i = 0; i < h.length; i++) if (keep[i]) h[i] = 0;
}
// full：襪子以外還穿了褲裙（整雙腿退回皮膚），連褲襪蓋到的臀部也要藏；沒有的話襪子只藏 hem 以下（上面是身體原本的長褲，在襪子外面）
// 素腳（鞋子附的 W_foot 沒穿襪子時）：部位 14 畫膚色、15 指甲用第三色；涼鞋可以給 nail（指甲油）
const FOOT_SKIN = { id: 'foot', cat: 'foot', shape: 'foot', pat: 'plain', p: 0, a: 0xd8b8a0, b: 0xd8b8a0, c: 0xe8c8bc, rough: .5 };
const wearOr = (...ms) => {
  const l = ms.filter(Boolean);
  if (l.length < 2) return l[0] || null;
  const o = new Uint8Array(l[0].length);
  for (const m of l) for (let i = 0; i < o.length; i++) o[i] |= m[i];
  return o;
};
function wearHide(sex, hIdx, w, full) {
  const sk = w.cat === 'socks', lim = sk && !full ? legInfo(PEOPLE.geos[sex][hIdx]).top + w.hem : 9;
  const key = `${sex}${hIdx}:${w.shape}${lim < 9 ? '<' : ''}`;
  let h = WEAR_HIDE.get(key);
  if (h) return h;
  const c = PEOPLE.wear[sex][w.shape], base = PEOPLE.geos[sex][hIdx], B = base.attributes, nb = B.position.count;
  h = new Uint8Array(nb);
  // see：透明的雨衣，底下的身體照畫
  if ((!WEAR_NOHIDE.has(w.cat) || w.hide) && !w.see) {
    const cast = wearCaster(c);
    const BP = B.position.array, BN = B.normal.array, SL = charRaw(base, 'aSlot'), BU = charRaw(base, 'aUnp'), BUN = charRaw(base, 'aUnn'), BH = charRaw(base, 'aPat');
    // 穿上這件時退回皮膚的那組（m-char 的 aUnp）從退回去的位置與法線量：殼是照它做的，鼓起來的表面在胸口會高出殼 2 cm
    const jk = w.cat === 'jacket', sh = w.cat === 'shoes', fl = w.cat === 'top' || jk ? 1 : WEAR_BOT.has(w.cat) || sk || sh ? 2 : 0;
    // 裙子只藏貼著的腰臀：裙身底下的大腿跨步時會跑出裙擺，藏起來就是一個洞；外套推得比較遠（羽絨衣 5 cm），長大衣的下襬底下的腿不藏
    const HR = w.cat === 'skirt' ? WEAR_HIDE_SK : jk ? WEAR_HIDE_J : w.cat === 'acc' ? WEAR_HIDE_AC : WEAR_HIDE_R;
    // 襪口下緣往上 3 cm 的腿直接藏：鞋口那圈（people.py 的鞋口滾邊）鼓在塞進鞋口的襪子外面，往外射打不到襪子，會在後跟露出一塊塊皮膚
    let lo = 9;
    if (sk) { const pf = base.userData.pf; for (let i = 0; i < c.pos.length; i += 3) lo = Math.min(lo, (c.pos[i + pf.up] - pf.y0) * pf.sc); }
    // 鞋子：小腿區最下面那排（鞋口滾邊，鼓出 1.15 cm、退不回皮膚）藏掉，露出來的缺口由鞋子附的腳（W_foot，往上多做 3 cm）補上
    const r4 = sh ? legInfo(base).lo + .014 : -9;
    for (let i = 0; i < nb; i++) {
      if (sk && SL[i] > 2.5 && SL[i] < 4.5 && BH[i * 3] > lo && BH[i * 3] < lo + .03) { h[i] = 1; continue; }
      if (sh && SL[i] > 3.5 && SL[i] < 4.5 && BH[i * 3] < r4) { h[i] = 1; continue; }
      if (sh && SL[i] > 4.5) continue;   // 身體的鞋整區不畫（uCov.w 的 4）
      if (SL[i] > 5.5 || jk && SL[i] > 2.5 || sk && (SL[i] > 4.5 || BH[i * 3] > lim)) continue;   // 頭髮、眉毛、眼睛不算；襪子不藏鞋（鞋口那圈往外射會打到塞進鞋口的襪口）
      const u = BU[i * 4 + 3] & fl ? 1 : 0, N3 = u ? BUN : BN;
      if (cast(BP[i * 3] - BU[i * 4] * u, BP[i * 3 + 1] - BU[i * 4 + 1] * u, BP[i * 3 + 2] - BU[i * 4 + 2] * u, N3[i * 3], N3[i * 3 + 1], N3[i * 3 + 2], HR)) h[i] = 1;
    }
    wearShrink(h, base.index.array);
  }
  WEAR_HIDE.set(key, h);
  return h;
}
// 外套底下的上衣、褲頭、裙子：被外套蓋住的三角形整個不畫（三個頂點都蓋住的才丟，衣緣那一排留著）。底下那件比外套寬的地方（古巴領襯衫的領片、
// A 字裙的裙擺）在外套外面，所以往內找到 WEAR_UNDER_IN（裙子 WEAR_UNDER_SK）；外套的開口（前襟、衣襬的開衩）那裡沒有外套的面，照畫。每個性別、每對款式量一次
const WEAR_UNDER_IN = .06, WEAR_UNDER_SK = .1, WEAR_UNDER = new Map(), WEAR_UNDER_CAT = new Set(['top', 'pants', 'skirt']);
function wearUnder(sex, jw, w) {
  const key = `${sex}:${jw.shape}>${w.shape}`;
  let h = WEAR_UNDER.get(key);
  if (h) return h;
  const J = PEOPLE.wear[sex][jw.shape], c = PEOPLE.wear[sex][w.shape], n = c.pos.length / 3, cast = wearCaster(J), P = c.pos, N = c.nor;
  h = new Uint8Array(n);
  const IN = w.cat === 'skirt' ? WEAR_UNDER_SK : WEAR_UNDER_IN;
  for (let i = 0; i < n; i++) if (cast(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], WEAR_HIDE_J, IN, .2)) h[i] = 1;
  // 補洞：鄰點全都蓋住的頂點也算蓋住（短袖往內折的袖口、口袋邊這種朝側面的面，沿法線射不到外套）；外套開口那裡的頂點有沒蓋住的鄰點，不受影響
  const I = c.idx;
  for (let r = 0; r < 2; r++) {
    const open = new Uint8Array(n);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], d = I[t + 2];
      if (!h[a] || !h[b]) { open[d] = 1; } if (!h[b] || !h[d]) { open[a] = 1; } if (!h[a] || !h[d]) { open[b] = 1; }
    }
    for (let i = 0; i < n; i++) if (!open[i]) h[i] = 1;
  }
  WEAR_UNDER.set(key, h);
  return h;
}
const WEAR_BOT = new Set(['pants', 'skirt']);
// ─── 配件往外推：wear_acc.py 照退回皮膚的身體做（項鍊貼著鎖骨、背帶貼著肩膀），穿上衣服就沉進布裡。每個點找最近的皮膚（WEAR_LIFT_K 個身體頂點的
// 退回位置與法線），沿法線往外看 WEAR_LIFT_R 以內最外面那層布（穿的上衣、外套、褲裙；身體原本鼓起來、這次沒退回的衣服；先推好的背心、手套）有多厚，
// 推出去那麼多。_grp ≥ 1 的整組照組裡最厚的推（一節鍊子、一個扣環不變形）：法線一致的（包、卡片）沿平均法線平移，繞一圈的（手錶、耳機）各點沿自己的法線（撐大一圈）；
// 0 的（帶子、手套、方巾）逐點推，再和鄰點抹平（衣緣那裡才不會折一道）。沒有 _grp 的（耳環、耳掛、面罩）不推
const WEAR_LIFT_R = .09, WEAR_LIFT_K = 4, WEAR_LIFT_CS = .04, WEAR_LIFT_Q = .006, WEAR_ACC_SHELL = new Set(['plate_vest', 'biker_gloves']);
// 身體表面（退回皮膚的位置與法線、鼓起來的位移）按 4 cm 分桶；只算皮膚、上衣、袖子、褲子、小腿區（頭髮蓋住肩膀，不算）
function wearSkin(base) {
  if (base.userData.skin) return base.userData.skin;
  const P = charRaw(base, 'position'), N = charRaw(base, 'normal'), SL = charRaw(base, 'aSlot'), U = charRaw(base, 'aUnp'), UN = charRaw(base, 'aUnn'), n = SL.length;
  const rp = new Float32Array(n * 3), rn = new Float32Array(n * 3), G = new Map(), cs = WEAR_LIFT_CS;
  const ck = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  for (let i = 0; i < n; i++) {
    if (SL[i] > 4.5) continue;
    const u = U[i * 4 + 3] > .5;
    for (let k = 0; k < 3; k++) { rp[i * 3 + k] = P[i * 3 + k] - (u ? U[i * 4 + k] : 0); rn[i * 3 + k] = (u ? UN : N)[i * 3 + k]; }
    const key = ck(Math.floor(rp[i * 3] / cs), Math.floor(rp[i * 3 + 1] / cs), Math.floor(rp[i * 3 + 2] / cs));
    let l = G.get(key); if (!l) G.set(key, l = []); l.push(i);
  }
  // 離 (x, y, z) 最近的幾個頂點按距離加權：皮膚點、法線，以及 ret（這次退回的分組，aUnp.w 的位元）以外鼓起來的衣服沿法線多厚
  const near = (x, y, z, ret) => {
    const bi = [], bd = [], gx = Math.floor(x / cs), gy = Math.floor(y / cs), gz = Math.floor(z / cs);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const l = G.get(ck(gx + a, gy + b, gz + c));
      if (l) for (const i of l) {
        const d = (rp[i * 3] - x) ** 2 + (rp[i * 3 + 1] - y) ** 2 + (rp[i * 3 + 2] - z) ** 2;
        if (bd.length < WEAR_LIFT_K || d < bd[bd.length - 1]) {
          let j = bd.length < WEAR_LIFT_K ? bd.length : bd.length - 1;
          while (j > 0 && bd[j - 1] > d) { bd[j] = bd[j - 1]; bi[j] = bi[j - 1]; j--; }
          bd[j] = d; bi[j] = i;
        }
      }
    }
    if (!bi.length) return null;
    const r = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, puff: 0 };
    let ws = 0;
    for (let k = 0; k < bi.length; k++) {
      const i = bi[k], w = 1 / (Math.sqrt(bd[k]) + .002);
      r.x += rp[i * 3] * w; r.y += rp[i * 3 + 1] * w; r.z += rp[i * 3 + 2] * w;
      r.nx += rn[i * 3] * w; r.ny += rn[i * 3 + 1] * w; r.nz += rn[i * 3 + 2] * w; ws += w;
    }
    r.x /= ws; r.y /= ws; r.z /= ws;
    const nl = Math.hypot(r.nx, r.ny, r.nz) || 1;
    r.nx /= nl; r.ny /= nl; r.nz /= nl;
    for (const i of bi) { const g = Math.round(U[i * 4 + 3]); if (g && !(g & ret)) r.puff = Math.max(r.puff, U[i * 4] * r.nx + U[i * 4 + 1] * r.ny + U[i * 4 + 2] * r.nz); }
    return r;
  };
  return (base.userData.skin = { near });
}
// 從 o 沿 d 射到 R 遠，最外面那層布的距離（0 = 沒打到）。只算朝外的面（面的頂點法線和射線同向）：袖子底下朝著身體的那面、帽兜的內裡不算
function wearFar(c) {
  if (c.far) return c.far;
  const P = c.pos, NR = c.nor, I = c.idx, G = new Map(), cs = .03, ck = (x, y, z) => (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
    const x0 = Math.floor(Math.min(P[a], P[b], P[d]) / cs), x1 = Math.floor(Math.max(P[a], P[b], P[d]) / cs);
    const y0 = Math.floor(Math.min(P[a + 1], P[b + 1], P[d + 1]) / cs), y1 = Math.floor(Math.max(P[a + 1], P[b + 1], P[d + 1]) / cs);
    const z0 = Math.floor(Math.min(P[a + 2], P[b + 2], P[d + 2]) / cs), z1 = Math.floor(Math.max(P[a + 2], P[b + 2], P[d + 2]) / cs);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      const k = ck(x, y, z);
      let l = G.get(k); if (!l) G.set(k, l = []); l.push(t);
    }
  }
  const seen = new Set();
  return (c.far = (ox, oy, oz, dx, dy, dz, R) => {
    let best = 0;
    seen.clear();
    for (let s = 0; s <= R + 1e-6; s += cs * .5) {
      const l = G.get(ck(Math.floor((ox + dx * s) / cs), Math.floor((oy + dy * s) / cs), Math.floor((oz + dz * s) / cs)));
      if (!l) continue;
      for (const t of l) {
        if (seen.has(t)) continue;
        seen.add(t);
        const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
        if ((NR[a] + NR[b] + NR[d]) * dx + (NR[a + 1] + NR[b + 1] + NR[d + 1]) * dy + (NR[a + 2] + NR[b + 2] + NR[d + 2]) * dz < .6) continue;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[d] - P[a], e2y = P[d + 1] - P[a + 1], e2z = P[d + 2] - P[a + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const iv = 1 / det, tx = ox - P[a], ty = oy - P[a + 1], tz = oz - P[a + 2], u = (tx * px + ty * py + tz * pz) * iv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, v = (dx * qx + dy * qy + dz * qz) * iv;
        if (v < 0 || u + v > 1) continue;
        const tt = (e2x * qx + e2y * qy + e2z * qz) * iv;
        if (tt > best && tt < R) best = tt;
      }
    }
    return best;
  });
}
// 回傳 Map(配件的 c → 推好的位置)；先推背心、手套（WEAR_ACC_SHELL），其他配件也要讓開它們
function wearLift(sex, hIdx, parts) {
  const out = new Map(), acc = parts.filter(([w, c]) => w.cat === 'acc' && c.grp);
  if (!acc.length) return out;
  const base = PEOPLE.geos[sex][hIdx] || PEOPLE.geos[sex][0], sk = wearSkin(base);
  const cl = parts.filter(([w]) => w.cat === 'top' || w.cat === 'jacket' || WEAR_BOT.has(w.cat)).map(([, c]) => wearFar(c));
  // 這次退回皮膚的分組（同 wearApply 的 uCov.w／uCov.x）：穿了上衣或不透明的外套就沒有身體原本的上衣，穿了褲裙就沒有原本的褲子
  const ret = (parts.some(([w]) => w.cat === 'top' || w.cat === 'jacket' && !w.see) ? 1 : 0) | (parts.some(([w]) => WEAR_BOT.has(w.cat)) ? 2 : 0);
  acc.sort((a, b) => WEAR_ACC_SHELL.has(b[0].shape) - WEAR_ACC_SHELL.has(a[0].shape));
  for (const [w, c] of acc) {
    const P = c.pos, n = P.length / 3, G = c.grp, memo = new Map();
    const tv = new Float32Array(n), nv = new Float32Array(n * 3), has = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], key = `${Math.round(x / WEAR_LIFT_Q)},${Math.round(y / WEAR_LIFT_Q)},${Math.round(z / WEAR_LIFT_Q)}`;
      let r = memo.get(key);
      if (r === undefined) {
        const s = sk.near(x, y, z, ret);
        if (s) {
          let t = s.puff;
          for (const f of cl) t = Math.max(t, f(s.x - s.nx * .003, s.y - s.ny * .003, s.z - s.nz * .003, s.nx, s.ny, s.nz, WEAR_LIFT_R) - .003);
          r = { t, nx: s.nx, ny: s.ny, nz: s.nz };
        } else r = null;
        memo.set(key, r);
      }
      if (r) { tv[i] = r.t; nv[i * 3] = r.nx; nv[i * 3 + 1] = r.ny; nv[i * 3 + 2] = r.nz; has[i] = 1; }
    }
    // 逐點推的：往鄰點抹平（只往大的抹，不會比原本薄），再讓同一個位置的頂點（平面著色拆開的）一樣
    const I = c.idx;
    for (let it = 0; it < 4; it++) {
      const sum = new Float32Array(n), cnt = new Uint16Array(n);
      for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) {
        const a = I[t + e], b = I[t + (e + 1) % 3];
        if (G[a] < .5 && G[b] < .5) { sum[a] += tv[b]; cnt[a]++; sum[b] += tv[a]; cnt[b]++; }
      }
      for (let i = 0; i < n; i++) if (cnt[i]) tv[i] = Math.max(tv[i], sum[i] / cnt[i]);
    }
    const same = new Map();
    for (let i = 0; i < n; i++) { const k = `${P[i * 3]},${P[i * 3 + 1]},${P[i * 3 + 2]}`; same.set(k, Math.max(same.get(k) ?? 0, tv[i])); }
    for (let i = 0; i < n; i++) tv[i] = same.get(`${P[i * 3]},${P[i * 3 + 1]},${P[i * 3 + 2]}`);
    // 整組的：最厚的那點、法線的平均與一致程度
    const gs = new Map();
    for (let i = 0; i < n; i++) {
      const g = Math.round(G[i]);
      if (g < 1) continue;
      let e = gs.get(g); if (!e) gs.set(g, e = { t: 0, x: 0, y: 0, z: 0, k: 0 });
      e.t = Math.max(e.t, tv[i]);
      if (has[i]) { e.x += nv[i * 3]; e.y += nv[i * 3 + 1]; e.z += nv[i * 3 + 2]; e.k++; }
    }
    for (const e of gs.values()) { const l = Math.hypot(e.x, e.y, e.z); e.coh = e.k ? l / e.k : 0; if (l) { e.x /= l; e.y /= l; e.z /= l; } }
    const q = new Float32Array(P);
    let moved = false;
    for (let i = 0; i < n; i++) {
      const g = Math.round(G[i]), e = g >= 1 ? gs.get(g) : null, t = e ? e.t : tv[i];
      if (t <= 0) continue;
      const own = !e || e.coh < .75 && has[i];
      const dx = own ? nv[i * 3] : e.x, dy = own ? nv[i * 3 + 1] : e.y, dz = own ? nv[i * 3 + 2] : e.z;
      q[i * 3] += dx * t; q[i * 3 + 1] += dy * t; q[i * 3 + 2] += dz * t;
      moved = true;
    }
    if (moved) out.set(c, q);
    if (WEAR_ACC_SHELL.has(w.shape)) cl.push(wearFar({ pos: q, nor: c.nor, idx: c.idx }));
  }
  return out;
}
// 戴帽子時換成貼頭皮的短髮（長髮的頭頂比帽冠高，會穿出來）
const HAT_HAIR = { Male: 1, Female: 2 };
// 戴耳環、耳掛（w.ear）時蓋住耳朵的女性髮型（長直髮、鮑伯、中長捲髮）換成低髮髻，耳朵才露得出來
const EAR_HAIR = { 0: 4, 3: 4, 5: 4 };
// 這份身體（每個髮型一份，aPat 的比例與前後置中不同）的小腿區上緣高度與腿中心的前後位置（m-char 的 legA 用 uCov.z）
const LEG_LY = h => h < .42 ? .09 + (.077 - .09) * clamp((h - .1) / .32, 0, 1) : h < .54 ? .077 + (.045 - .077) * (h - .42) / .12 : .045 + (.02 - .045) * clamp((h - .54) / .35, 0, 1);
function legInfo(base) {
  if (base.userData.leg) return base.userData.leg;
  const SL = charRaw(base, 'aSlot'), PT = charRaw(base, 'aPat');
  let top = 0, lo = 9, cz = 0, n = 0;
  for (let i = 0; i < SL.length; i++) if (SL[i] > 3.5 && SL[i] < 4.5) { top = Math.max(top, PT[i * 3]); lo = Math.min(lo, PT[i * 3]); cz += PT[i * 3 + 2] + LEG_LY(PT[i * 3]); n++; }
  return (base.userData.leg = { top, lo, cz: n ? cz / n : 0 });
}
function wearApply(p, sex, hIdx, ids) {
  const items = ids.map(id => WEAR_BY[id]).filter(w => w && PEOPLE.wear[sex][w.shape]);
  const cov = p.cm.uniforms.uCov.value.set(0, 0, 0, 0);
  p.lift = p.flex = 0;
  if (!items.length) return PEOPLE.geos[sex][hIdx] || PEOPLE.geos[sex][0];
  if (items.some(w => w.cat === 'hat')) hIdx = HAT_HAIR[sex];
  else if (sex === 'Female' && items.some(w => w.ear)) hIdx = EAR_HAIR[hIdx] ?? hIdx;
  let f = 0;
  for (const w of items) {
    if (w.cat === 'top') f |= 1;
    else if (WEAR_BOT.has(w.cat)) f |= 2;
    else if (w.cat === 'shoes') { f |= 4; const c = PEOPLE.wear[sex][w.shape]; p.lift = c.lift; p.flex = c.flex; }
  }
  // 襪子、有靴筒的鞋：小腿區上緣往上 hem 以下的腿退回皮膚（m-char 的 uCov.y），身體原本的長褲變成短褲；外面另外穿了褲裙就整雙腿都是
  const lg = legInfo(PEOPLE.geos[sex][hIdx] || PEOPLE.geos[sex][0]), sks = items.filter(w => w.cat === 'socks' || w.cat === 'shoes' && w.hem != null);
  const hem = sks.length ? lg.top + Math.max(...sks.map(w => w.hem)) : 0;
  // 只穿外套：身體原本的上衣退回皮膚（外套照退回去的表面做），顏色照舊；透明的雨衣不退
  cov.set(!(f & 1) && items.some(w => w.cat === 'jacket' && !w.see) ? 1 : 0, hem, lg.cz, f);
  // 衣服沒蓋到的上衣、袖子、褲子分區畫成皮膚（m-char 的 isSkin），顏色也要換成膚色
  const C = p.cm.uniforms.uC.value;
  if (f & 1) { C[1].copy(C[0]); C[2].copy(C[0]); }
  if (f & 2) { C[3].copy(C[0]); C[4].copy(C[0]); }
  return wearGeo(sex, hIdx, items);
}
const NPC_HEELS = new Set(['F05', 'F09']);
const NPC_NOACC = new Set(['A06', 'A07', 'A11']);
const NPC_SHORTS = new Set(['P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08']);
// 路人隨機穿型錄裡的衣服（不用 r()：照外觀雜湊挑，同一個人每次 look 都一樣）
function npcWear(h1, h2, h3, h4, fem) {
  const out = [], by = cat => WEAR.filter(w => w.cat === cat);
  const take = (cat, h, rate) => { const l = by(cat); if (l.length && h < rate) out.push(l[Math.floor(h / rate * l.length) % l.length].id); };
  // 裙子只給女性路人（型錄男女都做了，玩家自己買來穿不限）；褲子與裙子二選一
  const hb = hash01(h2 * 57.3 + h3);
  take('top', hash01(h1 * 91.7 + h4), .34); if (fem && hb < .24) take('skirt', hb, .24); else take('pants', hb, .30); take('hat', hash01(h3 * 33.1 + h1), .12);
  take('jacket', hash01(h4 * 47.9 + h2 * 3.1), .16);
  // 襪子只給露腿的（裙子、P01–P08 的短褲）：長褲底下看不到
  const bot = WEAR_BY[out.find(id => /^[PS]/.test(id))];
  if (bot && (bot.cat === 'skirt' || NPC_SHORTS.has(bot.id))) take('socks', hash01(h1 * 13.7 + h3 * 5.3), .45);
  // 鞋子：高跟鞋、及膝長靴只給女性路人
  const sh = WEAR.filter(w => w.cat === 'shoes' && (fem || !NPC_HEELS.has(w.id))), hs = hash01(h2 * 23.9 + h4 * 7.1);
  if (sh.length && hs < .38) out.push(sh[Math.floor(hs / .38 * sh.length) % sh.length].id);
  // 配件：背心、面罩、手套太顯眼不給路人；耳環、耳掛只給女性路人
  const ac = WEAR.filter(w => w.cat === 'acc' && !NPC_NOACC.has(w.id) && (fem || !w.fem)), ha = hash01(h3 * 71.3 + h4 * 2.9);
  if (ac.length && ha < .22) out.push(ac[Math.floor(ha / .22 * ac.length) % ac.length].id);
  return out;
}

// 每人一份材質（uniform 不同），共用同一個 program；不能用 clone()，會把共用的 U 也複製掉
const charMat = () => new T.ShaderMaterial({ name: 'char',
  uniforms: {
    ...shared(ALLU),
    uAtlas: { value: PEOPLE ? PEOPLE.atlas : null },
    uC: { value: Array.from({ length: 10 }, () => new T.Color()) },
    uGlow: { value: new T.Vector4() },
    uPat: { value: new T.Vector4() },
    uTrait: { value: new T.Vector4() },
    uCov: { value: new T.Vector4() },
    uPatC: { value: new T.Color() },
    uInnerC: { value: new T.Color() },
  },
});
// 掃描人物的材質：和同一人的 charMat 共用 uniform 物件，另外帶底色貼圖
const scanMat = (cm, tex) => new T.ShaderMaterial({ name: 'char', uniforms: { ...cm.uniforms, uMap: { value: tex } }, defines: { SCAN: 1 } });

// ─── 掃描人物（blender/scan_people.py：沒有骨架的 Sketchfab 人物綁到同一副 Quaternius 骨架）───
// assets/260/people/<id>.glb 只在 http(s) 下載，第一次有人要穿才下載；下載好之前（與以檔案開啟時）照舊是程式換色的身體，
// 下載好後把登記過的人重新 look 一次。幾何換到 PEOPLE 的綁定空間、骨頭編號照骨名對回模板骨架，所以動畫與 IK 都照用。
const SCAN_SEX = { jason: 'Male', lucia: 'Female', q_camper: 'Male', q_fisher: 'Male', q_hiker: 'Female' };   // q_：197 湖畔求生的 NPC（tools/q197-people.mjs，本來就是這副骨架）
const SCAN = {}, scanWait = {};
function scanGet(id, p) {
  if (!GLB_ON || !PEOPLE || !SCAN_SEX[id]) return null;
  if (SCAN[id] && (SCAN[id].geo || SCAN[id].fail)) return SCAN[id].geo ? SCAN[id] : null;
  (scanWait[id] ||= new Set()).add(p);   // 下載中再有人要穿也登記，下載好一起重新 look
  if (SCAN[id]) return null;
  SCAN[id] = {};
  glbLoader.loadAsync(`../assets/260/people/${id}.glb`).then(gltf => {
    let m = null;
    gltf.scene.traverse(o => { if (o.isSkinnedMesh && !m) m = o; });
    const g = SCAN_SEX[id], B = PEOPLE.bind[g], ms = m.skeleton, jm = ms.bones.findIndex(b => b.name === 'pelvis');
    const M = B.M.clone().multiply(ms.boneInverses[jm]).multiply(m.bindMatrix), NM = new T.Matrix3().getNormalMatrix(M);
    const src = m.geometry, n = src.attributes.position.count, P = V3();
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const remap = ms.bones.map(b => B.bi.get(b.name) ?? 0);
    for (let i = 0; i < n; i++) {
      P.fromBufferAttribute(src.attributes.position, i).applyMatrix4(M).toArray(pos, i * 3);
      P.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(NM).normalize().toArray(nor, i * 3);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = remap[src.attributes.skinIndex.getComponent(i, k)]; sw[i * 4 + k] = src.attributes.skinWeight.getComponent(i, k); }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('uv', src.attributes.uv);
    geo.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
    geo.setAttribute('aSlot', new T.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('aPat', new T.BufferAttribute(new Float32Array(n * 3), 3));
    wearZero(geo);
    charPack(geo, false);
    geo.setIndex(src.index);
    SCAN[id] = { geo, tex: m.material.map, sex: g };
    for (const q of scanWait[id]) if (q.scanId === id && q.crowd) q.crowd.look(q.k, q.lastLook);
    scanWait[id].clear();
  }).catch(e => { console.warn('掃描人物載入失敗', id, e); SCAN[id] = { fail: true }; });
  return null;
}

const ANIM = { idle: 0, walk: 1, run: 2, danceA: 3, danceB: 4, danceC: 5, sit: 6, bartend: 7, umbrella: 8, dj: 9, cross: 10, talk: 11, ride: 12, punch: 14, smoke: 15,
  die: 16, getup: 17, jab: 18, interact: 19, crouch: 20, aimIdle: 21, aimWalk: 22, swing: 23, handsUp: 24, kneel: 25, throw: 26, aimRun: 27, driveBy: 28, swimIdle: 29, swim: 30, crouchWalk: 31, crouchAim: 32, crouchAimWalk: 33, danceD: 34, danceE: 35, danceF: 36, phone: 38, sprint: 39, breast: 40, jump: 41, text: 42, textWalk: 43, jog: 44 };   // 37 是 69-v5-civic.js 的 climb
// 動作 → 動畫：rate 是每單位相位走幾秒動畫（行走的相位沿用舊版步頻），beat 是幾拍一輪（跳舞對拍），alt 依相位換另一段；walk 依個人步態特質切換 Walk_Loop／Walk_Formal_Loop
const ACLIP = {
  [ANIM.idle]: { c: 'Idle_Loop', organic: 1 }, [ANIM.walk]: { c: 'Walk_Loop', rate: 1.3, gait: 1 }, [ANIM.run]: { c: 'Jog_Fwd_Loop', rate: .98 },
  [ANIM.jog]: { c: 'Jog_Fwd_Loop', rate: .86 },
  [ANIM.danceA]: { c: 'Dance_Loop', beat: 2 }, [ANIM.danceB]: { c: 'Dance_Loop', beat: 2, off: .5 }, [ANIM.danceC]: { c: 'Dance_Loop', beat: 4 },
  // 動畫庫只有一段舞：另外三種舞步是在待機或同一段舞上覆寫上身（OVR），單雙號的人左右相反
  [ANIM.danceD]: { c: 'Idle_Loop' }, [ANIM.danceE]: { c: 'Dance_Loop', beat: 4, off: .25 }, [ANIM.danceF]: { c: 'Dance_Loop', beat: 2, off: .75 },
  [ANIM.sit]: { c: 'Sitting_Idle_Loop', alt: 'Sitting_Talking_Loop', organic: 1 }, [ANIM.bartend]: { c: 'Idle_Loop', organic: 1 }, [ANIM.umbrella]: { c: 'Walk_Loop', rate: 1.3, gait: 1 },
  [ANIM.dj]: { c: 'Idle_Loop' }, [ANIM.cross]: { c: 'Idle_Loop', organic: 1 }, [ANIM.talk]: { c: 'Idle_Talking_Loop', organic: 1 }, [ANIM.ride]: { c: 'Driving_Loop' },
  [ANIM.punch]: { c: 'Punch_Cross', beat: 2, alt: 'Punch_Jab' }, [ANIM.smoke]: { c: 'Idle_Loop', organic: 1 }, [ANIM.phone]: { c: 'Idle_Loop', organic: 1 },
  [ANIM.text]: { c: 'Idle_Loop', organic: 1 }, [ANIM.textWalk]: { c: 'Walk_Loop', rate: 1.18, gait: 1 },
  // 68-gta.js 用的單次動作（once：相位是開始的時刻，播完停在最後一格；rev：倒著播，倒地動畫倒放當作爬起來）
  [ANIM.die]: { c: 'Death01', once: 1, rate: 1.3 }, [ANIM.getup]: { c: 'Death01', once: 1, rev: 1, rate: 1.9 }, [ANIM.jab]: { c: 'Punch_Jab', once: 1, rate: 1.3 },
  [ANIM.interact]: { c: 'Interact', once: 1, rate: 1.2 }, [ANIM.crouch]: { c: 'Crouch_Idle_Loop' },
  [ANIM.aimIdle]: { c: 'Pistol_Idle_Loop' }, [ANIM.aimWalk]: { c: 'Walk_Loop', rate: 1.3 },
  // 69-combat.js：揮砍（近戰武器）、投降舉手、跪下雙手抱頭（被捕）、丟擲、持槍跑（警察）
  [ANIM.swing]: { c: 'Sword_Attack', once: 1, rate: 1.5 }, [ANIM.handsUp]: { c: 'Idle_Loop' }, [ANIM.kneel]: { c: 'Crouch_Idle_Loop' },
  [ANIM.throw]: { c: 'Punch_Cross', once: 1, rate: 1.2 }, [ANIM.aimRun]: { c: 'Jog_Fwd_Loop', rate: .93 },
  // 69-combat.js：開車時把手伸出車窗開槍（坐姿沿用開車動畫）
  [ANIM.driveBy]: { c: 'Driving_Loop' },
  // 下水：踩水與自由式（40-people.js 的 updatePlayerWalk）
  [ANIM.swimIdle]: { c: 'Swim_Idle_Loop' }, [ANIM.swim]: { c: 'Swim_Fwd_Loop', rate: 1.1 },
  // 蹲下（Z）：蹲著走、蹲著瞄準（手臂照持槍瞄準覆寫）
  [ANIM.crouchWalk]: { c: 'Crouch_Fwd_Loop' }, [ANIM.crouchAim]: { c: 'Crouch_Idle_Loop' }, [ANIM.crouchAimWalk]: { c: 'Crouch_Fwd_Loop' },
  // 玩家的奔跑、蛙式與跳（路人照舊用慢跑）：衝刺上身前傾、大幅擺臂、後腳踢高；蛙式是踩水的姿勢往前倒、四肢照 BREAST；跳的手腳全由 OVR 擺
  [ANIM.sprint]: { c: 'Sprint_Loop', rate: .667 }, [ANIM.breast]: { c: 'Swim_Idle_Loop' }, [ANIM.jump]: { c: 'Jog_Fwd_Loop', rate: 0 },
};
const clipOf = (id, p) => {
  const a = ACLIP[id] || ACLIP[0];
  if (a.gait && p.tr && p.tr.formal && !p.isMe) return 'Walk_Formal_Loop';
  return a.alt && p.alt ? a.alt : a.c;
};
function clipTime(id, name, t, b, p) {
  const a = ACLIP[id] || ACLIP[0], d = PEOPLE.clips.get(name).duration;
  if (a.once) { const u = clamp(t * (a.rate || 1), 0, d - 1e-3); return a.rev ? d - 1e-3 - u : u; }
  // 待機、聊天、坐姿等常駐循環依每人專屬相位偏移與呼吸速率錯開，即使外部傳入 phase=0 也不會整群同步
  const tr = p && !p.isMe && a.organic ? p.tr : null;
  const effT = tr ? t * tr.idleRate + tr.phOff : t;
  const u = a.beat ? (b + (a.off || 0) + (p && p.tr ? p.tr.beatJit : 0)) / a.beat * d : effT * (a.rate || 1);
  return ((u % d) + d) % d;
}

// 讓骨頭（指向第一個子骨）轉向角色空間的方向（骨架不在場景裡，世界空間就是角色空間）；w 是和動畫原姿勢的混合比例
const _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _q3 = new T.Quaternion(), _qi = new T.Quaternion(), _v1 = V3(), _v2 = V3();
function aim(p, name, x, y, z, w = 1) {
  const bone = p.bones[name];
  bone.parent.getWorldQuaternion(_q1);
  _q2.multiplyQuaternions(_q1, bone.quaternion);
  _v1.copy(bone.children[0].position).normalize().applyQuaternion(_q2);
  _v2.set(x, y, z).normalize();
  _q3.setFromUnitVectors(_v1, _v2);
  if (w < 1) _q3.slerp(_qi, 1 - w);
  bone.quaternion.copy(_q1.invert().multiply(_q3.multiply(_q2)));
}
// 兩節骨 IK：把 side 這隻手的手腕送到 T（骨架空間），手肘往 pole 那一側彎；上臂、前臂長度取目前姿勢的骨距
const _ikS = V3(), _ikL = V3(), _ikH = V3(), _ikU = V3(), _ikN = V3(), _ikE = V3(), _ikT = V3();
function ikArm(p, side, T, pole, k) {
  const up = p.bones['upperarm_' + side], lo = p.bones['lowerarm_' + side];
  up.getWorldPosition(_ikS); lo.getWorldPosition(_ikL); p.bones['hand_' + side].getWorldPosition(_ikH);
  const a = _ikS.distanceTo(_ikL), b = _ikL.distanceTo(_ikH);
  _ikU.subVectors(T, _ikS);
  const d = clamp(_ikU.length(), Math.abs(a - b) + 1e-4, (a + b) * .999);
  _ikU.normalize();
  const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  _ikN.copy(pole).addScaledVector(_ikU, -pole.dot(_ikU)).normalize();
  _ikE.copy(_ikS).addScaledVector(_ikU, a * ca).addScaledVector(_ikN, a * sa);
  _ikT.copy(_ikS).addScaledVector(_ikU, d);
  aim(p, 'upperarm_' + side, _ikE.x - _ikS.x, _ikE.y - _ikS.y, _ikE.z - _ikS.z, k);
  aim(p, 'lowerarm_' + side, _ikT.x - _ikE.x, _ikT.y - _ikE.y, _ikT.z - _ikE.z, k);
}
// ─── 持槍姿勢：先依瞄準方向擺好槍，再用兩節骨 IK 把雙手送到這把槍的握把與護木，手掌轉向、手指彎起來握住 ───
// 座標是 arms.glb 擺正後的模型座標（公尺；槍口 +z、上方 +y、+x 是持槍者的左邊），照模型側面量的。
// k：long 槍托抵右肩、上身側轉；pistol 雙手前伸（只在瞄準時，平常照動畫單手拿）；hip 架在右腰；shoulder 扛在右肩
// r 右手掌心、l 左手掌心、b 抵肩（槍托底板）或靠肩（筒身）的點；lh 是左手的握法（HAND，右手一律握手槍式握把）
const GUN_HOLD = {
  pistol: { k: 'pistol', r: [0, -.012, -.055], l: [.035, -.03, -.045], lh: 'cup' },
  stun: { k: 'pistol', r: [0, -.015, -.05], l: [.035, -.035, -.04], lh: 'cup' },
  smg: { k: 'pistol', r: [0, .01, -.02], l: [.035, -.01, -.015], lh: 'cup' },
  rifle: { k: 'long', r: [0, -.03, -.175], l: [0, .075, .15], b: [0, .035, -.41], lh: 'guard' },
  shotgun: { k: 'long', r: [0, 0, -.235], l: [0, .045, .23], b: [0, -.005, -.49], lh: 'guard' },
  sniper: { k: 'long', r: [0, -.045, -.29], l: [0, .0, .12], b: [0, -.015, -.54], lh: 'guard' },
  rpg: { k: 'shoulder', r: [0, -.06, -.04], l: [0, -.065, .09], b: [0, .035, -.24], lh: 'gripL' },
  minigun: { k: 'hip', r: [0, .085, -.4], l: [0, .06, -.1], lh: 'bar' },
};
// 手掌的方向（槍的座標）：y 手腕到指根、n 掌心朝向（掌心貼著握的東西）、c 手指彎曲的程度、t 拇指指的方向、o 手腕離握點往手背退幾公尺
// 骨頭的局部軸（綁定姿勢量的）：y 沿著手指、z 是拇指那一側；右手掌心是 −x、左手掌心是 +x，手指繞局部 x 往掌心彎
const HAND = {
  grip: { y: [.35, -.55, .55], n: [.8, 0, .3], c: 1, t: [.75, -.25, .6] },        // 右手握手槍式握把：指根在握把前下方，掌心朝左前包住握把
  gripL: { y: [-.35, -.55, .55], n: [-.8, 0, .3], c: 1, t: [-.75, -.25, .6] },     // 左手握直立的前握把
  guard: { y: [-.75, .4, .35], n: [0, 1, 0], c: 1.05, o: .012, t: [.15, .15, 1] },        // 左手從下面托住護木，手指繞過右側
  cup: { y: [-.3, -.6, .6], n: [-.8, .4, 0], c: .85, o: .015, t: [-.2, .2, 1] },         // 左手包住右手
  bar: { y: [-.8, -.3, .4], n: [0, -1, 0], c: .9, t: [.2, -.7, -.5] },           // 左手從上面抓提把
};
const FINGER_CURL = [.9, 1.2, .8];
const _hgf = V3(), _hgu = V3(), _hgx = V3(), _hgo = V3(), _hgs = V3(), _hgT = V3(), _hgP = V3(), _hgY = V3(), _hgN = V3(), _hgv = V3(), _hgw = V3(), _hgM = new T.Matrix4(), _hgq = new T.Quaternion(), _hgq2 = new T.Quaternion();
const hgv = (o, a, s = 1) => o.set(0, 0, 0).addScaledVector(_hgx, a[0] * s).addScaledVector(_hgu, a[1] * s).addScaledVector(_hgf, a[2] * s);   // 槍的座標 → 角色空間的方向
// 骨頭繞角色空間的 y 軸轉 a（上身側轉、頭轉回來）
function twistY(p, name, a) {
  const b = p.bones[name];
  b.parent.getWorldQuaternion(_hgq); _hgq2.setFromAxisAngle(_v2.set(0, 1, 0), a);
  b.quaternion.premultiply(_hgq).premultiply(_hgq2).premultiply(_hgq.invert());
}
// 手掌轉到 Y（手腕到指根）、掌心朝 N（角色空間，N 已經和 Y 垂直），w 是混合比例；手指彎曲 curl
function orientHand(p, side, Y, N, curl, w) {
  const b = p.bones['hand_' + side];
  _hgv.copy(N).multiplyScalar(side === 'r' ? -1 : 1);   // 局部 x
  _hgw.crossVectors(_hgv, Y).normalize();
  _hgM.makeBasis(_hgv, Y, _hgw); _hgq2.setFromRotationMatrix(_hgM);
  b.parent.getWorldQuaternion(_hgq); _hgq.invert().multiply(_hgq2);
  b.quaternion.slerp(_hgq, w);
  for (const f of ['index', 'middle', 'ring', 'pinky']) for (let j = 1; j <= 3; j++) {
    const fb = p.bones[`${f}_0${j}_${side}`];
    if (fb) fb.quaternion.multiply(_hgq2.setFromAxisAngle(_v1.set(1, 0, 0), FINGER_CURL[j - 1] * curl * w));
  }
}
const HOLD_ANIM = new Set([ANIM.idle, ANIM.walk, ANIM.run, ANIM.jog, ANIM.crouch, ANIM.crouchWalk, ANIM.aimIdle, ANIM.aimWalk, ANIM.aimRun, ANIM.crouchAim, ANIM.crouchAimWalk, ANIM.talk]);
// 手上東西的矩陣（角色空間）乘上 p.h 時會跟著體型的非等比縮放（p.sv，寬、厚和身高不同比例）壓扁拉長：
// 線性部分先除掉寬、厚對身高的比例，位置照樣跟著體型走（握點還在手上），槍身與道具維持原本的比例
function unSquash(p, m) {
  const e = m.elements, rx = p.sv.y / p.sv.x, rz = p.sv.y / p.sv.z;
  e[0] *= rx; e[4] *= rx; e[8] *= rx; e[2] *= rz; e[6] *= rz; e[10] *= rz;
  return m;
}
// 69-combat.js 的 holdAt 每幀把 p.hold 設成手上的槍；這裡算出槍在角色空間的矩陣 p.gunM（holdAt 下一次就照它擺）
function gunPose(p) {
  const G = GUN_HOLD[p.hold];
  if (!G || !p.sm) return false;
  const m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x), k = p.aimK ?? 1, P = p.aimP ?? 0;
  if (G.k === 'pistol' && k < .05) return false;
  // 槍身方向：瞄準時沿瞄準俯仰；長槍沒瞄準時槍口朝前下、略往左（低姿戒備），重武器略朝下
  const pitch = G.k === 'pistol' ? P : lerp(G.k === 'long' ? -.62 : -.3, P, k), yaw = G.k === 'long' ? .38 * (1 - k) : 0;
  _hgf.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  _hgx.set(Math.cos(yaw), 0, -Math.sin(yaw)); _hgu.crossVectors(_hgf, _hgx).normalize();
  // 上身側轉（右肩往後、左肩往前），頭轉回來看前面
  const tw = G.k === 'long' ? -lerp(.3, .55, k) : G.k === 'pistol' ? -.12 * k : -.25;
  twistY(p, 'spine_02', tw * .4); twistY(p, 'spine_03', tw * .6); twistY(p, 'neck_01', -tw * .85);
  p.bones.upperarm_r.getWorldPosition(_hgs); p.bones.upperarm_l.getWorldPosition(_hgT);
  if (G.k === 'long') { _hgo.copy(_hgs).addScaledVector(_v1.set(.06, -.035, .05), m2b); hgv(_v2, G.b, m2b); _hgo.sub(_v2); }   // 槍托底板在右肩窩
  else if (G.k === 'shoulder') { _hgo.copy(_hgs).addScaledVector(_v1.set(.03, .11, 0), m2b); hgv(_v2, G.b, m2b); _hgo.sub(_v2); }   // 筒身扛在右肩上
  else if (G.k === 'hip') { _hgo.copy(_hgs).addScaledVector(_v1.set(.1, -.38, .14), m2b); hgv(_v2, G.r, m2b); _hgo.sub(_v2); }   // 後握把在右腰前
  else { _hgo.lerpVectors(_hgs, _hgT, .4).addScaledVector(_v1.set(0, -.05, 0), m2b).addScaledVector(_hgf, .46 * m2b); hgv(_v2, G.r, m2b); _hgo.sub(_v2); }   // 手槍：兩肩之間偏右、往前伸直
  const w = G.k === 'pistol' ? k : 1;
  // 手腕的位置：掌心中央往手腕退 7.5 cm、往手背退 o（預設 3 cm）；拇指另外擺
  for (const side of ['r', 'l']) {
    const H = HAND[side === 'r' ? 'grip' : G.lh];
    hgv(_hgY, H.y).normalize(); hgv(_hgN, H.n); _hgN.addScaledVector(_hgY, -_hgN.dot(_hgY)).normalize();
    hgv(_hgP, side === 'r' ? G.r : G.l, m2b).add(_hgo).addScaledVector(_hgY, -.075 * m2b).addScaledVector(_hgN, -(H.o ?? .03) * m2b);
    ikArm(p, side, _hgP, side === 'r' ? _v1.set(-1, -1.1, -.3) : _v1.set(.5, -1.2, 0), w);
    orientHand(p, side, _hgY, _hgN, H.c, w);
    hgv(_hgv, H.t); aim(p, 'thumb_02_' + side, _hgv.x, _hgv.y, _hgv.z, w); aim(p, 'thumb_03_' + side, _hgv.x, _hgv.y, _hgv.z, w);
    (p.ikErr ||= {})[side] = p.bones['hand_' + side].getWorldPosition(_v2).distanceTo(_hgP) / m2b;   // 手腕離目標幾公尺（測試 API 的 held().ik）
  }
  if (G.k === 'pistol' && k < .5) return true;   // 舉到一半：槍還跟著右手（holdAt 照手腕擺）
  _hgM.makeBasis(_hgx, _hgu, _hgf).scale(_v1.set(m2b, m2b, m2b)).setPosition(_hgo);
  (p.gunM ||= new T.Matrix4()).copy(unSquash(p, _hgM)); p.gunF = crowdFrame; p.gunId = p.hold;
  return true;
}
// 一隻手握到角色空間的點 C（掌心中央）：H 是 HAND 的握法，方向照目前的 _hgx／_hgu／_hgf 基底（gunPose 的右手也是這樣算）
function gripAt(p, side, C, H, pole, w, m2b) {
  hgv(_hgY, H.y).normalize(); hgv(_hgN, H.n); _hgN.addScaledVector(_hgY, -_hgN.dot(_hgY)).normalize();
  _hgP.copy(C).addScaledVector(_hgY, -.075 * m2b).addScaledVector(_hgN, -(H.o ?? .03) * m2b);
  ikArm(p, side, _hgP, pole, w);
  orientHand(p, side, _hgY, _hgN, H.c, w);
}
// 徒手（或拿近戰武器、投擲物）瞄準：兩拳舉到下巴前，右拳略後（格鬥架式），俯仰跟著瞄準
const FIST = { y: [0, .2, 1], n: [0, -1, 0], c: 1.25, o: .02, t: [0, .2, 1] };
function guardArms(p, k) {
  const m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x), P = clamp(p.aimP ?? 0, -.5, .5);
  _hgf.set(0, Math.sin(P), Math.cos(P)); _hgx.set(1, 0, 0); _hgu.crossVectors(_hgf, _hgx).normalize();
  p.bones.upperarm_r.getWorldPosition(_hgs); p.bones.upperarm_l.getWorldPosition(_hgT);
  _hgo.lerpVectors(_hgs, _hgT, .5);
  gripAt(p, 'r', _v2.copy(_hgo).addScaledVector(_hgx, -.07 * m2b).addScaledVector(_hgu, .08 * m2b).addScaledVector(_hgf, .24 * m2b), FIST, _v1.set(-1, -1.2, -.2), k, m2b);
  gripAt(p, 'l', _v2.copy(_hgo).addScaledVector(_hgx, .09 * m2b).addScaledVector(_hgu, .1 * m2b).addScaledVector(_hgf, .33 * m2b), FIST, _v1.set(1, -1.2, -.2), k, m2b);
}
function aimArms(p) {
  const k = p.aimK ?? 1, P = p.aimP ?? 0, sy = Math.sin(P), cz = Math.cos(P);
  if (p.hold && crowdFrame - p.holdT <= 2 && GUN_HOLD[p.hold]) return;   // 持槍姿勢在 poseOne 最後做（gunPose）
  if (p.guard && p.sm) { guardArms(p, k); return; }   // 68-gta.js：玩家手上不是槍
  aim(p, 'upperarm_r', -.1, sy, cz, k); aim(p, 'lowerarm_r', -.02, sy, cz, k);
  aim(p, 'upperarm_l', -.42, sy - .32, .85, k); aim(p, 'lowerarm_l', -.8, sy * .6 + .05, .6, k);
}
// 車內射擊（p.dbDir 是角色空間的方向，69-combat.js 的 driveByPlace 每幀設定）：右手握槍從右肩沿瞄準方向伸出 0.5 m、略往上
// （從窗框上伸出去，槍由 holdAt 照手腕擺），左手 IK 握在方向盤上；機車兩手都在把手上，只伸右手
function driveByArm(p, bike) {
  if (!p.sm) return;
  const [x, y, z] = p.dbDir, m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x);
  _hgf.set(x, y, z).normalize(); _hgx.set(_hgf.z, 0, -_hgf.x).normalize(); _hgu.crossVectors(_hgf, _hgx).normalize();
  p.bones.upperarm_r.getWorldPosition(_hgs); p.bones.upperarm_l.getWorldPosition(_hgT);
  gripAt(p, 'r', _hgo.copy(_hgs).addScaledVector(_hgf, .5 * m2b).addScaledVector(_v2.set(0, 1, 0), .08 * m2b), HAND.grip, _v1.set(-1, -1.1, -.3), 1, m2b);
  if (bike) return;
  _hgf.set(0, .4, 1).normalize(); _hgx.set(1, 0, 0); _hgu.crossVectors(_hgf, _hgx).normalize();
  gripAt(p, 'l', _hgo.copy(_hgT).addScaledVector(_v2.set(-.14, -.3, .36), m2b), HAND.gripL, _v1.set(.5, -1.2, 0), 1, m2b);
}
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const frac = x => x - Math.floor(x);

// 待機重心轉移與微動作輔助：呼吸、骨盆／脊椎反向平衡（contrapposto）與自然轉頭張望
function idleMicro(p, t, headAmt = .16) {
  const tr = p.tr;
  if (!tr || p.isMe) return;
  const ph = tr.phOff;
  const sway = Math.sin(t * .62 + ph) * .038;
  aim(p, 'spine_01', sway, 1, tr.stoop * .4, .55);
  aim(p, 'spine_02', -sway * .75, 1, tr.stoop * .7, .5);
  if (headAmt > 0) {
    // 間歇性自然張望：平時穩定微動，偶爾緩慢轉頭看街景再轉回
    const u = frac(t * .085 + ph * .17);
    const glance = (sst(.12, .26, u) - sst(.48, .64, u)) * tr.lookDir * headAmt;
    const micro = Math.sin(t * .41 + ph * 1.3) * .045;
    aim(p, 'neck_01', glance + micro, 1, .04 + tr.stoop * .5, .65);
  }
}

// 行走個人化步態覆寫：每人上身傾角、駝背感、擺臂幅度差異（有人雙手插袋邊微擺、有人大步擺臂）與轉彎預視
const _wDownL = V3(.09, -1, .02).normalize(), _wDownR = V3(-.09, -1, .02).normalize(), _yUp = V3(0, 1, 0), _zFwd = V3(0, 0, 1);
function walkPersonalize(p, t, dampRight = false) {
  const tr = p.tr;
  if (!tr || p.isMe) return;
  const turn = clamp(p.turnRate || 0, -.6, .6);
  const leanZ = tr.lean + tr.stoop;
  aim(p, 'spine_01', -turn * .08, 1, leanZ * .45, .55);
  aim(p, 'spine_02', -turn * .10, 1, leanZ * .75, .55);
  // 轉彎時頭先看向轉彎內側，直線時緩慢微幅掃視街道
  const scan = Math.sin(t * .38 + tr.phOff) * .09 + turn * .38;
  aim(p, 'neck_01', scan, 1, tr.stoop * .6, .55);
  // 擺臂收斂或左右不對稱：armDamp > 0 的人把上臂與前臂往自然垂放插值，消除整群同步機械擺臂
  if (tr.armDampL > .02) {
    aim(p, 'upperarm_l', _wDownL.x, _wDownL.y, _wDownL.z, tr.armDampL);
    aim(p, 'lowerarm_l', .04, -.92, .38, tr.armDampL * .75);
  }
  if (!dampRight && tr.armDampR > .02) {
    aim(p, 'upperarm_r', _wDownR.x, _wDownR.y, _wDownR.z, tr.armDampR);
    aim(p, 'lowerarm_r', -.04, -.92, .38, tr.armDampR * .75);
  }
}

// 動畫庫沒有的動作與寫實姿態修飾：t 是相位時間、b 是拍點
const OVR = {
  [ANIM.idle]: (p, t) => idleMicro(p, t, .18),
  [ANIM.walk]: (p, t) => walkPersonalize(p, t, false),
  // 慢跑運動的路人（與倉皇逃跑 run、主角衝刺 sprint 明確區隔）：上身端正穩定、手肘貼肋緊湊擺動、步伐輕快有節奏
  [ANIM.jog]: (p, t) => {
    const sw = Math.sin(t * 5.4);
    aim(p, 'spine_01', 0, 1, .04, .6);
    aim(p, 'spine_02', sw * .04, 1, .06, .6);
    aim(p, 'neck_01', 0, 1, -.02, .65);
    aim(p, 'upperarm_l', .18, -.92, -.14 + sw * .28, .65);
    aim(p, 'upperarm_r', -.18, -.92, -.14 - sw * .28, .65);
    aim(p, 'lowerarm_l', -.08, .12 + sw * .15, .98, .72);
    aim(p, 'lowerarm_r', .08, .12 - sw * .15, .98, .72);
  },
  // 驚慌奔逃／追擊跑（run）：身體明顯前傾、不時驚慌側頭張望、手臂急促大擺
  [ANIM.run]: (p, t) => {
    if (p.isMe) return;
    const lookBack = Math.sin(t * 1.9 + p.k * 1.7) * .24;
    aim(p, 'spine_01', 0, .98, .18, .6);
    aim(p, 'spine_02', 0, .97, .22, .6);
    aim(p, 'neck_01', lookBack, .99, -.08, .55);
  },
  // 撐傘：左手依個人步態自然擺動，右手穩定握在胸前傘柄位置並彎指握拳，傘柄緊貼掌心不再懸空
  [ANIM.umbrella]: (p, t) => {
    walkPersonalize(p, t, true);
    const w = .032 * Math.sin(t * 7.8 + p.k);
    aim(p, 'upperarm_r', -.22, -.86, .44 + w);
    aim(p, 'lowerarm_r', .12 + w * .4, .36, .92);
    orientHand(p, 'r', _yUp, _zFwd, .92, .88);
  },
  // 抱胸：雙臂自然上下交疊貼近胸腹、避免左右前臂互相穿插，搭配呼吸與轉頭微動
  [ANIM.cross]: (p, t) => {
    idleMicro(p, t, .15);
    const br = .028 * Math.sin(t * 1.5 + p.k * 1.3);
    aim(p, 'upperarm_l', .22, -.89, .36 + br); aim(p, 'upperarm_r', -.22, -.91, .32 + br);
    aim(p, 'lowerarm_l', -.90, .09 + br, .43); aim(p, 'lowerarm_r', .92, -.06 + br, .34);
  },
  // 交談：打破原本雙手對稱端籃球的僵硬迴圈，依人物編號分成三種不對稱自然說話／傾聽手勢與點頭節奏
  [ANIM.talk]: (p, t) => {
    const ph = p.tr ? p.tr.phOff : p.k * 1.7;
    const style = p.k % 3;
    const nod = Math.sin(t * 2.3 + ph) * .06 + Math.sin(t * .9 + ph) * .04;
    const turn = Math.sin(t * .55 + ph * 1.4) * .12;
    aim(p, 'spine_01', Math.sin(t * .65 + ph) * .035, 1, .02, .5);
    aim(p, 'neck_01', turn, 1, .05 + nod, .65);
    // 間歇手勢包絡線：講到重點時舉手比劃，停頓時自然放下
    const u = frac(t * .16 + ph * .11);
    const active = sst(.08, .22, u) * sst(.78, .58, u);
    const wave = Math.sin(t * 3.4 + ph) * .16;
    if (style === 0) {
      // 左手自然垂放身側，右手單手隨語氣比劃
      aim(p, 'upperarm_l', .10, -.98, .06, .88);
      aim(p, 'lowerarm_l', .04, -.92, .36, .85);
      aim(p, 'upperarm_r', -.20, -.90 + .12 * active, .26 + .16 * active, .82);
      aim(p, 'lowerarm_r', .18 + wave * active, -.35 + .58 * active, .88, .85);
    } else if (style === 1) {
      // 右手微插腰側／垂放，左手開放式手勢
      aim(p, 'upperarm_r', -.12, -.97, .05, .88);
      aim(p, 'lowerarm_r', -.05, -.90, .40, .85);
      aim(p, 'upperarm_l', .20, -.90 + .12 * active, .25 + .15 * active, .82);
      aim(p, 'lowerarm_l', -.18 - wave * active, -.32 + .55 * active, .88, .85);
    } else {
      // 傾聽／輕緩雙手交錯：多數時間放鬆微垂，偶爾微抬回應
      aim(p, 'upperarm_l', .13, -.96, .12 + .10 * active, .80);
      aim(p, 'upperarm_r', -.13, -.96, .12 + .12 * active, .80);
      aim(p, 'lowerarm_l', -.15, -.75 + .55 * active, .65, .78);
      aim(p, 'lowerarm_r', .15, -.72 + .60 * active + wave * .4 * active, .68, .78);
    }
  },
  [ANIM.dj]: (p, t) => {
    aim(p, 'upperarm_l', .75, .3, .1); aim(p, 'lowerarm_l', -.55, .8, -.1);
    aim(p, 'upperarm_r', -.25, -.6, .75); aim(p, 'lowerarm_r', .15 + .25 * Math.sin(t * 7), -.25, 1);
  },
  [ANIM.bartend]: (p, t) => {
    if (frac(t * .08) < .5) {
      const sh = .25 * Math.sin(t * 19);
      aim(p, 'upperarm_l', .3, -.45, .85); aim(p, 'upperarm_r', -.3, -.45, .85);
      aim(p, 'lowerarm_l', -.35, .55 + sh, .75); aim(p, 'lowerarm_r', .35, .55 + sh, .75);
    } else { aim(p, 'upperarm_r', -.2, -.75, .6); aim(p, 'lowerarm_r', .1 + .3 * Math.cos(t * 4), -.15, 1); }
  },
  [ANIM.smoke]: (p, t) => {
    idleMicro(p, t, .10);
    const ph = p.tr ? p.tr.phOff * .1 : 0;
    const u = frac(t * .09 + ph), k = sst(0, .11, u) * sst(.28, .17, u);
    aim(p, 'upperarm_l', .10, -.98, .06, .75);
    aim(p, 'upperarm_r', -.22, -.88 + .38 * k, .32 + .32 * k);
    aim(p, 'lowerarm_r', .08 + .28 * k, -.12 + 1.08 * k, .96 - .52 * k);
    if (k > .1) aim(p, 'neck_01', -.04 * k, 1, -.08 * k, .6);
  },
  // 講電話：右手腕用 ikArm 送到右耳旁（手肘往外下方彎），掌心轉向臉頰（orientHand），手機由 handPose 擺在耳朵與嘴之間；左手放鬆垂下
  [ANIM.phone]: (p, t) => {
    idleMicro(p, t, 0);
    const m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x);   // 骨架空間的單位不是公尺
    p.bones.Head.getWorldPosition(_hpT);
    ikArm(p, 'r', _hpT.add(_v2.set(-.098, -.012, .062).multiplyScalar(m2b)), _hpPole, 1);   // Head 骨在下巴的高度：手腕在下顎角前面，手掌往上貼著耳朵（手腕放在耳旁的話整隻手會蓋到頭頂）
    orientHand(p, 'r', _hgY.set(.12, .9, -.42).normalize(), _hgN.set(.96, -.12, .2).normalize(), .65, .85);
    aim(p, 'neck_01', -.09, .99, .05, .75);
    aim(p, 'upperarm_l', .10, -.98, .06, .75);
  },
  // 低頭滑手機（站立待機與邊走邊看）：右手在胸前托著發光手機、低頭注視螢幕、拇指微幅滑動
  [ANIM.text]: (p, t) => {
    idleMicro(p, t, 0);
    const scroll = Math.sin(t * 2.8 + p.k) * .025;
    aim(p, 'neck_01', .03, .86, .51, .92);
    aim(p, 'upperarm_r', -.18, -.86, .46, .92);
    aim(p, 'lowerarm_r', .28, .24 + scroll, .92, .92);
    orientHand(p, 'r', _hgY.set(.22, .35, .91).normalize(), _hgN.set(.15, .91, -.38).normalize(), .58, .85);
    aim(p, 'upperarm_l', .12, -.96, .14, .75);
  },
  [ANIM.textWalk]: (p, t) => {
    walkPersonalize(p, t, true);
    const bob = Math.sin(t * 6.5) * .02;
    aim(p, 'neck_01', 0, .88, .48, .90);
    aim(p, 'upperarm_r', -.18, -.85, .48 + bob, .92);
    aim(p, 'lowerarm_r', .28, .26 + bob, .91, .92);
    orientHand(p, 'r', _hgY.set(.22, .35, .91).normalize(), _hgN.set(.15, .91, -.38).normalize(), .58, .85);
  },
  [ANIM.sit]: (p, t) => {
    const ph = p.tr ? p.tr.phOff * .08 : 0;
    const u = frac(t * .07 + ph), k = sst(0, .08, u) * sst(.2, .12, u);
    if (k > .01) { aim(p, 'upperarm_r', -.15, -.55, .8, k); aim(p, 'lowerarm_r', .3, .95, .25, k); }
  },
  // 機車：動畫庫只有開車的坐姿，改成上身前傾、手伸向把手
  // 雙手跟著龍頭：向左轉時左把往後、右把往前（30-vehicles.js 的前叉繞轉向軸轉 steer×0.6）
  [ANIM.ride]: p => {
    const v = player.veh, s = v && !v.isCar ? v.steer * .6 : 0;
    aim(p, 'spine_01', 0, .82, .55); aim(p, 'neck_01', s * .3, .9, .45);
    aim(p, 'upperarm_l', .3, -.3, .9 - .5 * s); aim(p, 'upperarm_r', -.3, -.3, .9 + .5 * s);
    aim(p, 'lowerarm_l', -.05, -.45, 1 - .6 * s); aim(p, 'lowerarm_r', .05, -.45, 1 + .6 * s);
    if (p.dbDir) driveByArm(p, true);
  },
  // 車內射擊：腿往前伸平（收在儀表板下，免得腳從車底露出來）
  [ANIM.driveBy]: p => {
    aim(p, 'thigh_l', .05, -.12, 1); aim(p, 'thigh_r', -.05, -.12, 1); aim(p, 'calf_l', 0, -.25, 1); aim(p, 'calf_r', 0, -.25, 1);
    if (p.dbDir) driveByArm(p);
  },
  [ANIM.danceB]: (p, t, b) => {
    const k = .3 * Math.sin(b * Math.PI * 2);
    aim(p, 'upperarm_l', .35, 1, .1); aim(p, 'upperarm_r', -.35, 1, .1);
    aim(p, 'lowerarm_l', -.2 + k, 1, .2); aim(p, 'lowerarm_r', .2 + k, 1, .2);
  },
  // 持槍瞄準：右臂沿準星的俯仰伸直，左手過來托住（p.aimP 是俯仰角、p.aimK 是瞄準的混合比例，68-gta.js 每幀設定）
  [ANIM.aimIdle]: p => aimArms(p), [ANIM.aimWalk]: p => aimArms(p), [ANIM.aimRun]: p => aimArms(p),
  [ANIM.crouchAim]: p => aimArms(p), [ANIM.crouchAimWalk]: p => aimArms(p),
  // 投降：雙手舉過頭；被捕：跪著、雙手抱在腦後
  [ANIM.handsUp]: (p, t) => {
    const s = .04 * Math.sin(t * 9);
    aim(p, 'upperarm_l', .55, .82, .1); aim(p, 'upperarm_r', -.55, .82, .1);
    aim(p, 'lowerarm_l', .08 + s, 1, .05); aim(p, 'lowerarm_r', -.08 - s, 1, .05);
  },
  [ANIM.kneel]: p => {
    aim(p, 'upperarm_l', .85, .45, -.2); aim(p, 'upperarm_r', -.85, .45, -.2);
    aim(p, 'lowerarm_l', -.75, .45, -.45); aim(p, 'lowerarm_r', .75, .45, -.45);
  },
  [ANIM.danceC]: (p, t, b) => {
    const k = Math.sin(b * Math.PI);
    aim(p, 'upperarm_l', .9, -.2 + .6 * Math.max(0, k), .4); aim(p, 'upperarm_r', -.9, -.2 + .6 * Math.max(0, -k), .4);
  },
  // 兩步擺：上身兩拍左右擺一次、每拍點頭，手肘彎著輪流往上頂
  [ANIM.danceD]: (p, t, b) => {
    const m = p.k & 1 ? -1 : 1, [A, B] = m > 0 ? ['l', 'r'] : ['r', 'l'];
    const s = Math.sin(b * Math.PI), h = Math.abs(Math.sin(b * Math.PI * 2));
    aim(p, 'spine_01', .14 * s * m, 1, .06); aim(p, 'spine_02', -.08 * s * m, 1, .08); aim(p, 'neck_01', 0, 1, .1 + .25 * h);
    aim(p, 'upperarm_' + A, m * .45, -.6, .35); aim(p, 'lowerarm_' + A, -m * .15, .15 + .7 * Math.max(0, s), .9);
    aim(p, 'upperarm_' + B, -m * .45, -.6, .35); aim(p, 'lowerarm_' + B, m * .15, .15 + .7 * Math.max(0, -s), .9);
  },
  // 雙手舉高，四拍左右揮一輪
  [ANIM.danceE]: (p, t, b) => {
    const w = Math.sin(b * Math.PI / 2) * (p.k & 1 ? -1 : 1);
    aim(p, 'upperarm_l', .3 + .12 * w, 1, .15); aim(p, 'upperarm_r', -.3 + .12 * w, 1, .15);
    aim(p, 'lowerarm_l', .05 + .45 * w, 1, .05); aim(p, 'lowerarm_r', -.05 + .45 * w, 1, .05);
  },
  // 一手叉腰，另一手前一拍指天、後一拍收回胸前
  [ANIM.danceF]: (p, t, b) => {
    const m = p.k & 1 ? -1 : 1, [A, B] = m > 0 ? ['l', 'r'] : ['r', 'l'];
    const u = frac(b / 2), up = sst(0, .12, u) * sst(.62, .5, u);
    aim(p, 'upperarm_' + B, -m * .35, -.2 + 1.1 * up, .7 - .4 * up); aim(p, 'lowerarm_' + B, -m * .15, .3 + .7 * up, .6 - .5 * up);
    aim(p, 'upperarm_' + A, m * .65, -.65, -.25); aim(p, 'lowerarm_' + A, -m * .55, -.35, .35);
  },
};

// 關鍵姿勢插值：K 是 [[u, 方向, 方向...], ...]（u 由 0 到 1），取第 j 個方向，兩格之間用 smoothstep；mx 是 -1 時 x 鏡射（右邊的手腳）
const _kv = V3(), _kw = V3();
function keyDir(K, u, j, mx = 1) {
  let i = 1; while (i < K.length - 1 && K[i][0] < u) i++;
  const a = K[i - 1][j], b = K[i][j], s = sst(K[i - 1][0], K[i][0], u);
  return _kv.set(a[0] * mx, a[1], a[2]).lerp(_kw.set(b[0] * mx, b[1], b[2]), s);
}
// 蛙式一輪（水平的座標：+z 前進方向、+y 上、+x 左邊；右邊鏡射，擺的時候依身體的傾斜換成身體座標）：
// 滑行（雙臂往前伸在水面下）→ 往外划開 → 手肘往下收、雙手合到下巴前 → 往前伸；手划完時膝蓋往下張開收腿、往外往後蹬、併攏
const BREAST = {
  arm: [[0, [.12, -.1, 1], [.05, -.08, 1]], [.12, [.12, -.1, 1], [.05, -.08, 1]], [.38, [.75, -.05, .65], [.6, -.25, .75]], [.55, [.6, -.55, .3], [-.7, -.2, .65]],
    [.75, [.12, -.1, 1], [.05, -.08, 1]], [1, [.12, -.1, 1], [.05, -.08, 1]]],
  leg: [[0, [.07, -.47, -.88], [.05, -.42, -.9]], [.42, [.07, -.47, -.88], [.05, -.42, -.9]], [.6, [.35, -.9, -.2], [.2, .3, -.95]], [.78, [.3, -.5, -.8], [.4, -.45, -.8]],
    [.92, [.07, -.47, -.88], [.05, -.42, -.9]], [1, [.07, -.47, -.88], [.05, -.42, -.9]]],
};
const BR_TILT = 1.08, BR_PEL = -.33, BR_LIFT = .26;   // 往前倒 62°（繞踩水時的骨盆，根骨下 0.33 m），再抬高 0.26 m：肩膀貼水面、頭與帽子露出來
function breastPose(p, t, w) {
  const u = frac(t), a = BR_TILT * w, c = Math.cos(a), sn = Math.sin(a);
  // 水平座標 → 身體座標（身體繞 x 往前倒 a）
  const put = (bone, d) => aim(p, bone, d.x, d.y * c + d.z * sn, d.z * c - d.y * sn, w);
  aim(p, 'spine_01', 0, 1, -.05, w); aim(p, 'spine_02', 0, 1, -.1, w); aim(p, 'spine_03', 0, 1, -.15, w);
  put('neck_01', _kv.set(0, .75, .65));   // 頭往後仰，趴著也看前面
  for (const [s, m] of [['l', 1], ['r', -1]]) {
    put('upperarm_' + s, keyDir(BREAST.arm, u, 1, m)); put('lowerarm_' + s, keyDir(BREAST.arm, u, 2, m));
    put('thigh_' + s, keyDir(BREAST.leg, u, 1, m)); put('calf_' + s, keyDir(BREAST.leg, u, 2, m));
  }
  p.sm.rotation.x = a; p.sm.position.y += BR_PEL - BR_PEL * c + BR_LIFT * w; p.sm.position.z = -BR_PEL * sn;
}
// 跳（player.jump，u 是起跳到落地的比例）：一腳蹬地在後、一膝抬起 → 騰空雙臂往兩側張開保持平衡、膝蓋收起 → 落下前腿伸直
// [u, 左上臂, 左前臂, 左大腿, 左小腿, 右大腿, 右小腿]（右手照左手鏡射）
const JUMP = [
  [0, [.3, -.85, -.35], [.2, -.3, .9], [.06, -.85, -.5], [.05, -.45, -.9], [-.06, -.5, .85], [-.03, -.98, .15]],
  [.2, [.97, .2, .1], [.97, .25, .05], [.12, -.6, .8], [.06, -.95, -.3], [-.12, -.6, .8], [-.06, -.95, -.3]],
  [.8, [.95, .3, .08], [.95, .32, .02], [.1, -.97, .2], [.06, -1, -.05], [-.1, -.97, .2], [-.06, -1, -.05]],
  [1, [.95, .3, .08], [.95, .32, .02], [.1, -.97, .2], [.06, -1, -.05], [-.1, -.97, .2], [-.06, -1, -.05]],
];
OVR[ANIM.jump] = p => {
  const J = player.jump, u = J ? clamp(J.t / J.T, 0, 1) : 1;
  for (const [s, m] of [['l', 1], ['r', -1]]) {
    let d = keyDir(JUMP, u, 1, m); aim(p, 'upperarm_' + s, d.x, d.y, d.z);
    d = keyDir(JUMP, u, 2, m); aim(p, 'lowerarm_' + s, d.x, d.y, d.z);
  }
  for (const [s, j] of [['l', 3], ['r', 5]]) {
    let d = keyDir(JUMP, u, j); aim(p, 'thigh_' + s, d.x, d.y, d.z);
    d = keyDir(JUMP, u, j + 1); aim(p, 'calf_' + s, d.x, d.y, d.z);
  }
};

const DANCES = [ANIM.danceA, ANIM.danceB, ANIM.danceC, ANIM.punch, ANIM.danceD, ANIM.danceE, ANIM.danceF];
// 寫實膚色、自然為主的都市髮色、協調街頭／通勤服裝色盤與真實虹膜色
const SKINS = [0xf2ccb0, 0xdfb08c, 0xc28b64, 0x94603e, 0x613c26, 0xe8be9b].map(lin);
const HAIRS = [0x14110f, 0x261a12, 0x4c311d, 0x8e6b44, 0x5c5854, 0x1c1918, 0x5c2320, 0x382a20].map(lin);
const DYED_HAIRS = [0x6e2232, 0x284e62, 0xb89b72, 0x76747a].map(lin);   // 少數年輕潮人／夜店客挑染髮色
const TOPS = [0x242830, 0x382c24, 0x582126, 0x1e2e44, 0x757166, 0x28382e, 0x8a6d46, 0x16181d, 0x433648, 0xbab6ac, 0x2f4858, 0x565c4e, 0xcac6be, 0x6b3b2a].map(lin);
const INNERS = [0xd8d5ce, 0x202226, 0x8d8f92, 0xded8c8, 0x2d3744, 0x4c2428].map(lin);
const BOTS = [0x1c2028, 0x283242, 0x3c342a, 0x141518, 0x334257, 0x54493c, 0x2b2d30, 0x685d4c].map(lin);
const SHOES = [0x151518, 0x221d19, 0x362a20, 0xc4c1ba, 0x262b34].map(lin);
const CAPS = [0x16181e, 0x1e283b, 0x32362c, 0x3b2324, 0x423e38].map(lin);
const IRISES = [0x26170e, 0x3b2414, 0x54391d, 0x354856, 0x3d4b38, 0x1e140e].map(lin);
const GLOWS = [0x2cf2d8, 0xff3fa0, 0xffae57, 0x7af0ff, 0xd6ff3a].map(lin);
const EYES = IRISES[0];

const hash01 = x => { const v = frac(Math.sin(x * 12.9898 + 78.233) * 43758.5453); return Number.isFinite(v) ? v : 0; };
const toCol = v => typeof v === 'number' ? lin(v) : v;
const CROWDS = [];
// 建一群人：每人一組外觀、體型與動作特質。look 的 coat＝長袖、skirt＝露腿、longHair＝長髮女性、glow＝鞋子的霓虹飾條；
// r() 的次數與順序和舊版相同，體型、步態、虹膜、內搭色等新特徵都由 hash01 推導
function crowd(n, cap = n) {
  const group = new T.Group();
  const people = [];
  for (let k = 0; k < cap; k++) people.push({ k, x: 0, y: 0, z: 0, yaw: 0, s: 1, sv: V3(1, 1, 1), rig: null, a: [0, 0, 1, 0], a2: [0, 0, 1], handL: V3(-.25, 1.2, .3), turnRate: 0 });
  const api = {
    mesh: group, people,
    look(k, o = {}) {
      const r = o.r || Math.random;
      const pick = arr => arr[Math.floor(r() * arr.length)];
      const p = people[k];
      if (!PEOPLE) return;
      const fem = o.female ?? (o.longHair ? true : o.longHair === 0 ? false : r() < .45);
      const sex = fem ? 'Female' : 'Male';
      if (p.rig && p.sex !== sex) { p.h.remove(p.sm); p.rig = null; }
      const fresh = !p.rig;
      if (fresh) {
        p.sex = sex;
        p.h ||= group.add(new T.Group()).children.at(-1);
        p.rig = cloneSkinned(PEOPLE.tpl[sex]);
        p.sm = p.rig.getObjectByName('body');
        p.rig.remove(p.sm);
        p.sm.bindMode = T.DetachedBindMode;
        p.h.add(p.sm);
        p.cm = charMat();
        p.sm.material = p.cm;
        p.scanMats = {};
        p.sm.boundingSphere = new T.Sphere(V3(0, 1, 0), 1.35);
        // 骨頭矩陣只在擺過姿勢後重算（倒影與主畫面各 render 一次，遠處的人隔幀才擺）
        const sk = p.sm.skeleton;
        sk.update = () => { if (sk.dirty) { T.Skeleton.prototype.update.call(sk); sk.dirty = false; } };
        p.bones = {};
        p.rig.traverse(b => { if (b.isBone) p.bones[b.name] = b; });
        p.mixer = new T.AnimationMixer(p.rig);
        p.acts = new Map();
      }
      const u = p.cm.uniforms, C = u.uC.value;
      p.crowd = api; p.lastLook = o; p.scanId = o.scan || null;
      const sc = o.scan ? scanGet(o.scan, p) : null;

      // ── 以下 r() 消耗順序與次數和舊版 100% 一致 ──
      const skin = o.skin ? toCol(o.skin) : pick(SKINS), top = o.top ? toCol(o.top) : pick(TOPS), bot = o.bot ? toCol(o.bot) : pick(BOTS), hair0 = o.hair ? toCol(o.hair) : pick(HAIRS);
      const long = o.coat ?? (r() < .6 ? 1 : 0), bare = fem && (o.skirt ?? (r() < .3 ? 1 : 0));
      const shoe = o.shoe ? toCol(o.shoe) : pick(SHOES);
      const rHair = fem ? (o.longHair ? 0 : o.longHair === 0 ? 1 + Math.floor(r() * 2) : Math.floor(r() * 3)) : (o.hat ? 1 : Math.floor(r() * 3));
      const gc = o.glow ? toCol(o.glow) : pick(GLOWS);
      const glowW = o.glowI ?? (r() < .3 ? 1.6 : 0);
      p.s = o.scale || ((fem ? .95 : 1) * (.94 + r() * .1));
      p.alt = r() < .5;   // 有兩段動畫的動作（坐、出拳）固定用哪一段
      // ── r() 消耗結束，以下全用決定性雜湊衍生豐富細節 ──

      const seed = (p.k + 1) * 17.371 + (top.r || 0) * 91.13 + (bot.b || 0) * 47.71 + (skin.g || 0) * 31.9 + p.s * 53.1;
      const h1 = hash01(seed), h2 = hash01(seed + 7.13), h3 = hash01(seed + 19.41), h4 = hash01(seed + 37.89);

      // 少數年輕路人／夜店客（約 11%，且非制服角色）帶低飽和挑染髮色
      const hair = (!o.hair && !o.top && h2 > .89) ? DYED_HAIRS[Math.floor(h3 * DYED_HAIRS.length)] : hair0;
      const iris = IRISES[Math.floor(h4 * IRISES.length)];

      // 髮型與帽款分派：o.hat 為真時戴結構化立體鴨舌／勤務帽（警察、SWAT、傭兵、Jax、半數幫派），一般路人也依雜湊涵蓋全部 7 款自然髮型
      let hIdx = rHair;
      if (o.hat) {
        hIdx = 6;   // Cap
      } else if (fem) {
        if (o.longHair) hIdx = h1 < .62 ? 0 : 5;                             // Long 或 WavyMid
        else if (o.longHair === 0) hIdx = h1 < .52 ? 3 : h1 < .86 ? 4 : 2;   // Bob、LowBun 或極短髮
        else hIdx = [0, 3, 4, 5, 0, 3, 1, 2][Math.floor(h1 * 8)];            // 大多為長髮、鮑伯、單髻、微捲，少數雙包頭與極短髮
      } else {
        if (o.top && o.hat === 0) hIdx = rHair === 1 ? 1 : h1 < .55 ? 0 : 5; // 具名無帽男主角（Kael、Vance 等）保持俐落旁分／後梳／寸頭
        else if (h1 > .91 && o.hat === undefined) hIdx = 6;                  // 約 9% 街頭男路人戴休閒鴨舌帽
        else hIdx = [0, 5, 1, 3, 4, 0, 5, 2][Math.floor(h1 * 8)];            // 涵蓋旁分、後梳、寸頭、寸頭落腮鬍、旁分落腮鬍與光頭鬍
      }

      C[0].copy(skin); C[1].copy(top); C[2].copy(long ? top : skin); C[3].copy(bot); C[4].copy(bare ? skin : bot);
      C[5].copy(shoe); C[6].copy(hair); C[7].copy(hair).multiplyScalar(.72); C[8].copy(iris);
      // 帽色：制服角色（指定 o.top 與 o.hat）用上衣同色系深色勤務帽，一般戴帽路人挑協調帽色
      if (o.top && o.hat) C[9].copy(top).multiplyScalar(.82);
      else C[9].copy(CAPS[Math.floor(h3 * CAPS.length)]);

      // 衣物層次與內搭色：長袖多出開襟夾克配內搭 T 恤、拼袖夾克與連帽衛衣；指定上衣的制服角色預設俐落素面（Kael 給開襟皮衣層次感更帥）
      let pat = o.pat ?? 0;
      if (o.pat === undefined) {
        if (!o.top) {
          if (long) pat = h2 < .30 ? 0 : h2 < .62 ? 1 : h2 < .80 ? 2 : h2 < .93 ? 3 : 4;
          else pat = h2 < .68 ? 0 : h2 < .86 ? 2 : 4;
        }
      }
      const innerCol = INNERS[Math.floor((h3 * 6 + h1 * 3) % INNERS.length)];
      u.uInnerC.value.copy(innerCol);
      if (Math.abs(innerCol.r - top.r) + Math.abs(innerCol.g - top.g) + Math.abs(innerCol.b - top.b) < .10) {
        u.uInnerC.value.copy(top.r + top.g + top.b > .45 ? INNERS[1] : INNERS[0]);
      }
      u.uPat.value.set(pat, pat === 4 ? 14 + Math.floor(h4 * 8) : 1, .92, long);
      const pc = u.uPatC.value.copy(TOPS[Math.floor(h4 * TOPS.length)]);
      if (Math.abs(pc.r - top.r) + Math.abs(pc.g - top.g) + Math.abs(pc.b - top.b) < .08) pc.copy(top).multiplyScalar(.45);

      // 年齡感（約 22% 路人帶中老年沉穩特徵）與布料粗糙度類型（棉麻／斜紋／皮衣機能布）
      const age = o.top ? 0 : h3 > .78 ? (h3 - .78) / .22 : 0;
      const fabKind = o.top && long ? .68 : h4;
      u.uTrait.value.set(bare ? 1 : 0, fabKind, age, 0);

      // 衣服（39-wear-items.js）：o.wear 指定（店裡的假人、只剩內衣時給空的），玩家穿存檔裡的（69-wear.js），，沒指定的一般路人照雜湊隨機穿；制服與掃描人物不穿
      const wl = o.wear ?? (p.isMe ? WEAR_ME.on() : o.top || o.scan || o.hat || o.uniform ? [] : npcWear(h1, h2, h3, h4, fem));
      p.wear = wl;
      p.sm.geometry = wearApply(p, sex, hIdx, wl);
      if (sc && sc.sex === sex) { p.sm.geometry = sc.geo; p.sm.material = p.scanMats[o.scan] ||= scanMat(p.cm, sc.tex); u.uCov.value.set(0, 0, 0, 0); }
      else p.sm.material = p.cm;
      u.uGlow.value.set(gc.r, gc.g, gc.b, o.glowI ?? (h2 > .78 ? glowW : 0));

      // 體型比例差異（高矮胖瘦）：具名／戰鬥角色保持精準比例避免長槍 IK 歪斜；一般路人拉開高瘦、標準、健壯、微胖厚實差異
      if (o.scale) {
        const wB = o.scale > 1.03 ? 1.03 : 1;
        p.sv.set(p.s * wB, p.s, p.s * wB);
      } else {
        const hMul = .93 + h1 * .14 - age * .025;          // 身高落差約 1.54m .. 1.90m
        const bld = h2;                                    // 0..0.25 纖瘦、0.25..0.68 勻稱、0.68..0.86 寬肩健壯、0.86..1 豐腴厚實
        const wMul = bld < .25 ? lerp(.89, .95, bld / .25) : bld < .68 ? lerp(.95, 1.04, (bld - .25) / .43) : lerp(1.04, 1.15, (bld - .68) / .32);
        const dMul = bld < .25 ? lerp(.88, .94, bld / .25) : bld < .68 ? lerp(.94, 1.04, (bld - .25) / .43) : lerp(1.04, 1.19, (bld - .68) / .32);
        const sy = p.s * hMul;
        p.sv.set(sy * wMul, sy, sy * dMul);
      }

      // 每人專屬步態與待機微動特質（零亂數消耗）
      p.tr = {
        formal: h1 > .56 || age > .35,
        lean: (h2 - .42) * .11,                            // 行走上身微前傾（趕路）或挺直（悠閒）
        stoop: age * .13,                                  // 年長者上背自然微駝
        armDampL: h3 < .26 ? .52 : h3 < .55 ? .18 : 0,     // 擺臂幅度（插口袋邊小幅擺動 vs 自然大擺）
        armDampR: h4 < .26 ? .52 : h4 < .55 ? .16 : 0,
        phOff: (p.k * 2.39996 + h1 * 6.283) % 62.83,
        idleRate: .87 + h2 * .26,
        lookDir: h3 > .5 ? 1 : -1,
        beatJit: (h4 - .5) * .09,
        age,
      };
      if (fresh) poseOne(p, 0, 0);   // 先擺一次待機，畫面外（倒影裡）的人才不會是 T 字
    },
    anim(k, id, phase = Math.random() * 10, speed = 1, beatOff = 0) { const a = people[k].a; a[0] = id; a[1] = phase; a[2] = speed; a[3] = beatOff; },
    anim2(k, id, w, speed = 1) { const a = people[k].a2; a[0] = id; a[1] = w; a[2] = speed; },
    place(k, x, y, z, yaw) {
      const p = people[k]; p.x = x; p.y = y; p.z = z; p.yaw = yaw;
      if (p.h) { p.h.position.set(x, y, z); p.h.rotation.set(0, yaw, 0); p.h.scale.copy(p.sv); }
    },
    // 直接給整個變換（騎機車時跟著車身壓車）
    placeM(k, m) {
      const p = people[k];
      if (!p.h) return;
      m.decompose(p.h.position, p.h.quaternion, p.h.scale);
      p.h.scale.multiply(p.sv);
      p.x = p.h.position.x; p.y = p.h.position.y; p.z = p.h.position.z;
    },
    flush() {},
  };
  CROWDS.push(api);
  return api;
}
function act(p, name) {
  let a = p.acts.get(name);
  if (!a) { a = p.mixer.clipAction(PEOPLE.clips.get(name)); p.acts.set(name, a); }
  if (!a.isRunning()) a.play();
  return a;
}
// 鞋子的墊高與壓腳掌（wear_shoes.py 先把骨架擺成同一個姿勢做鞋）：骨盆往上 lift（綁定空間的公尺；骨頭、身體、手上的東西一起抬），
// 兩腳的 foot 繞左右軸轉 flex（腳尖往下）、ball 轉回來（前掌貼地）。軸是綁定姿勢裡世界的上、左右換到各骨頭的局部座標，每副骨架量一次
const SHOE_AX = new WeakMap(), _sq = new T.Quaternion(), _sm3 = new T.Matrix3();
function shoeAx(p) {
  const sk = p.sm.skeleton;
  let a = SHOE_AX.get(sk);
  if (a) return a;
  const up = PEOPLE.geos[p.sex][0].userData.pf.up, B = _sm3.setFromMatrix4(p.sm.bindMatrix), U = V3().setComponent(up, 1).applyMatrix3(B), X = V3(1, 0, 0).applyMatrix3(B).normalize();
  const loc = (b, d, norm) => { const v = d.clone().applyMatrix3(_sm3.setFromMatrix4(sk.boneInverses[sk.bones.indexOf(b)])); return norm ? v.normalize() : v; };
  a = { up: loc(p.bones.pelvis.parent, U, false), ax: ['foot_l', 'foot_r', 'ball_l', 'ball_r'].map(n => [p.bones[n], loc(p.bones[n], X, true), n[0] === 'f' ? 1 : -1]) };
  SHOE_AX.set(sk, a);
  return a;
}
function shoeUndo(p) {
  const d = p.shoeD;
  if (!d) return;
  const a = shoeAx(p);
  p.bones.pelvis.position.addScaledVector(a.up, -d.lift);
  for (const [b, ax, sg] of a.ax) b.quaternion.multiply(_sq.setFromAxisAngle(ax, -sg * d.flex));
  p.shoeD = null;
}
function shoeDo(p, lift) {
  if (!p.lift && !p.flex) return;
  const a = shoeAx(p), d = p.shoeD = { lift: lift ? p.lift : 0, flex: p.flex };
  p.bones.pelvis.position.addScaledVector(a.up, d.lift);
  for (const [b, ax, sg] of a.ax) b.quaternion.multiply(_sq.setFromAxisAngle(ax, sg * d.flex));
}
function poseOne(p, t, b) {
  const [id, ph, sp, bo] = p.a, [id2, w2, sp2] = p.a2;
  const n1 = clipOf(id, p), n2 = w2 > .01 ? clipOf(id2, p) : null, mix2 = n2 && n2 !== n1;
  for (const [n, a] of p.acts) if (n !== n1 && !(mix2 && n === n2) && a.isRunning()) a.stop();
  const a1 = act(p, n1);
  a1.time = clipTime(id, n1, t * sp + ph, b + bo, p); a1.weight = mix2 ? 1 - w2 : 1;
  if (mix2) { const a2 = act(p, n2); a2.time = clipTime(id2, n2, t * sp2 + ph, b + bo, p); a2.weight = w2; }
  shoeUndo(p);
  p.mixer.update(0);
  p.sm.position.y = PEOPLE.seat[n1] || 0;
  // 坐著（PEOPLE.seat 有的動作）不墊高，腳掌照壓
  shoeDo(p, !PEOPLE.seat[n1]);
  const f = OVR[id];
  if (f && (!mix2 || w2 < .5)) f(p, t * sp + ph, b + bo);
  // 蛙式：swK 讓下水、停下來踩水時慢慢趴下去、立起來（隔幀才擺的人用實際經過的時間）
  const bk = id === ANIM.breast ? 1 : 0;
  if (bk || p.swK > .01) { p.swK = (p.swK || 0) + (bk - (p.swK || 0)) * (1 - Math.exp(-5 * clamp(t - (p.swT ?? t), 0, .1))); breastPose(p, t * sp + ph, p.swK); }
  else if (p.swK) { p.swK = 0; p.sm.rotation.x = 0; p.sm.position.z = 0; }
  p.swT = t;
  if (p.hold && crowdFrame - p.holdT <= 2 && HOLD_ANIM.has(id) && (!mix2 || w2 < .5)) gunPose(p);
  p.rig.updateMatrixWorld(true);
  if (HAND_PROP[id] && (!mix2 || w2 < .5)) handPose(p, id);
  p.sm.skeleton.dirty = true;
  if (id === ANIM.umbrella) p.handL.setFromMatrixPosition(p.bones.hand_r.matrixWorld).y += p.sm.position.y;
}
// 每幀更新目前場景裡、在畫面內的人；遠處的人隔幀更新
const _fr = new T.Frustum(), _pm = new T.Matrix4(), _sph = new T.Sphere(V3(), 1.4);
let crowdFrame = 0;
function updateCrowds(scn) {
  crowdFrame++;
  camera.updateMatrixWorld();
  _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const t = U.uTime.value, b = U.uBeat.value, cp = camera.position;
  for (const c of CROWDS) {
    if (c.mesh.parent !== scn || !c.mesh.visible) continue;
    for (const p of c.people) {
      if (!p.rig) continue;
      _sph.center.set(p.x, p.y + 1, p.z);
      if (!_fr.intersectsSphere(_sph)) continue;
      const d = cp.distanceTo(_sph.center);
      if (d > 35 && (crowdFrame + p.k) % (d > 70 ? 4 : 2)) continue;
      poseOne(p, t, b);
    }
  }
  handPropsStep(scn);
}

// ─── 手上的小道具：抽菸的人右手夾菸（菸頭發光）、講電話貼右耳、低頭滑手機的人掌心托著亮屏手機 ───
// handPose 在擺好姿勢後算出道具在角色空間的矩陣 p.propL（遠處的人隔幀才擺，位置跟著 p.h 每幀走）；handPropsStep 依鏡頭距離挑最近的幾個擺上去。
// 手機的模型在 69-v9-ai.js（phoneSwap，以 http(s) 開啟才下載），這裡先用程式建模的機身
const _hpPole = V3(-1, -.7, .15), _hpT = V3(), _hpA = V3(), _hpB = V3(), _hpX = V3(), _hpY = V3(), _hpZ = V3(), _hpM = new T.Matrix4();
const _phoneGeo = new Kit().box(0, 0, 0, .07, .15, .009, 0x15171b, 3).box(0, 0, .0048, .063, .137, .001, 0xc8dcff, 8).build();
const HAND_PROP = {
  [ANIM.smoke]: { max: 12, R: 45, list: [], geo: new Kit().cyl(0, .01, 0, .0047, .0047, .022, 8, 0xc8803a, 2).cyl(0, .053, 0, .0045, .0045, .064, 8, 0xece8e0, 2).cyl(0, .0875, 0, .0044, .0044, .005, 8, 0xff5a1a, 11).build() },   // 濾嘴在掌心裡，菸身與菸頭從指間伸出約 6 cm
  [ANIM.phone]: { max: 6, R: 45, list: [], phone: 1, geo: _phoneGeo },
  [ANIM.text]: { max: 8, R: 45, list: [], phone: 1, geo: _phoneGeo },
  [ANIM.textWalk]: { max: 8, R: 45, list: [], phone: 1, geo: _phoneGeo },
};
function handPose(p, id) {
  const L = p.propL ||= new T.Matrix4(), m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x);
  p.bones.hand_r.getWorldPosition(_hpA); p.bones.lowerarm_r.getWorldPosition(_hpB);
  _hpY.subVectors(_hpA, _hpB).normalize();   // 前臂方向（手肘 → 手腕）
  if (id === ANIM.phone) {
    // 機身長邊從嘴邊斜到耳上（往上、往後），螢幕朝頭（+x 是角色的左邊），中心貼在右耳外側
    _hpY.set(0, 1, -.42).normalize(); _hpZ.set(.96, .18, .20).normalize(); _hpX.crossVectors(_hpY, _hpZ).normalize(); _hpZ.crossVectors(_hpX, _hpY);
    p.bones.Head.getWorldPosition(_hpA).add(_v1.set(-.094, .05, .046).multiplyScalar(m2b));
  } else if (id === ANIM.text || id === ANIM.textWalk) {
    // 低頭滑手機：手機握在右手掌心前方，螢幕朝上偏臉部（-z 偏 +y）
    _hpA.addScaledVector(_hpY, .075 * m2b).add(_v1.set(.015, .02, .01).multiplyScalar(m2b));
    _hpY.set(.15, .42, .89).normalize();
    _hpZ.set(.12, .88, -.45).normalize();
    _hpX.crossVectors(_hpY, _hpZ).normalize();
    _hpZ.crossVectors(_hpX, _hpY).normalize();
  } else {
    // 菸夾在指間：手腕往指尖 8 cm，菸身和前臂垂直；朝向取「前、外、上」斜向的參考方向扣掉前臂分量
    // （手垂著時朝前、前臂朝前時從拳頭上緣往上，不會因為前臂朝前而退化；朝內會整根穿進拳頭）
    _hpA.addScaledVector(_hpY, .08 * m2b);
    _hpZ.set(-.3, .5, 1).normalize(); _hpZ.addScaledVector(_hpY, -_hpZ.dot(_hpY)).normalize(); _hpX.crossVectors(_hpZ, _hpY).normalize(); _hpY.copy(_hpZ); _hpZ.crossVectors(_hpX, _hpY);
  }
  _hpM.makeBasis(_hpX, _hpY, _hpZ).scale(_v1.set(m2b, m2b, m2b)).setPosition(_hpA);
  p.sm.updateMatrix(); unSquash(p, L.multiplyMatrices(p.sm.matrix, _hpM));
  p.propId = id; p.propF = crowdFrame;
}
function handPropGet(hp, i) {
  let g = hp.list[i];
  if (!g) {
    g = new T.Group(); g.matrixAutoUpdate = false; g.add(new T.Mesh(hp.geo, MAT.uber)); hp.list[i] = g;
    if (hp.phone) { g.userData.id = 'phone'; phoneSwap(g); }
  }
  return g;
}
const _hpC = [];
function handPropsStep(scn) {
  for (const id in HAND_PROP) {
    const hp = HAND_PROP[id], cp = camera.position;
    _hpC.length = 0;
    for (const c of CROWDS) {
      if (c.mesh.parent !== scn || !c.mesh.visible) continue;
      for (const p of c.people) if (p.rig && p.propId == id && p.a[0] == id && crowdFrame - p.propF <= 6 && p.h.visible !== false) { const d = (p.x - cp.x) ** 2 + (p.z - cp.z) ** 2; if (d < hp.R * hp.R) _hpC.push([d, p]); }
    }
    if (_hpC.length > hp.max) _hpC.sort((a, b) => a[0] - b[0]);
    const n = Math.min(_hpC.length, hp.max);
    for (let i = 0; i < n; i++) {
      const p = _hpC[i][1], g = handPropGet(hp, i);
      if (g.parent !== scn) scn.add(g);
      p.h.updateMatrixWorld(); g.matrix.multiplyMatrices(p.h.matrixWorld, p.propL); g.matrixWorldNeedsUpdate = true; g.visible = true;
    }
    for (let i = n; i < hp.list.length; i++) hp.list[i].visible = false;
  }
}

// ─── 街上的行人：沿著街區人行道繞圈，具圓角轉彎、步頻步幅差異、慢跑者、邊走邊看手機與櫥窗駐足過渡 ───
const PED_N = LOW ? 23 : 48;   // 2026-10-26 多 25%（原本 18／38）
// 掃描的 Lucia（女性、長髮）：重看一次外觀用自己的亂數（下載好之後 scanGet 會拿同一組參數再 look 一次）
const LUCIA = k => ({ r: rng(500 + k), scan: 'lucia', female: true, longHair: 1, glowI: 0 });
// 197 湖畔求生的三個 NPC（營地的阿哲、碼頭的老陳、健行的小安）也進城當路人：外觀同樣另外抽亂數
const Q197 = { 2: 'q_camper', 12: 'q_fisher', 16: 'q_hiker' };
const q197Look = (k, id) => ({ r: rng(700 + k), scan: id, female: id === 'q_hiker', glowI: 0 });
const xzW = (x, z, y) => { const [X, Z] = toW(x, z); return [X, y, Z]; };   // 邏輯 (x, z) → peds.place 的世界座標 x, y, z
const peds = crowd(PED_N + 8);
const pedState = [];
const rP = rng(77);
const umbrellas = [];

// 依路人當下狀態決定日常行走動畫與對應步頻速率（身高較高者步幅較長、步頻略沉穩）
function pedBaseAnim(k, ps) {
  if (ps.um) return ANIM.umbrella;
  if (ps.jogger && wx.rain < .22) return ANIM.jog;
  if (ps.texter && wx.rain < .35) return ANIM.textWalk;
  return ANIM.walk;
}
function pedStepRate(k, ps, vNow) {
  const p = peds.people[k], hScale = p && p.sv ? p.sv.y : 1;
  if (ps.jogger && !ps.um && wx.rain < .22) return (vNow / 2.45) * 1.05 / hScale;
  return (vNow * .78) / Math.max(.85, hScale);
}

{
  const inner = blocks.filter(b => !b.outer && !b.park && isOld(b.i, b.j));   // 開場在舊城區（玩家附近），之後 pedRelocate 跟著玩家搬
  for (let k = 0; k < PED_N; k++) {
    // 嚴格保持與舊版一模一樣的 rP() 消耗順序：b → inset → um → s → dir → v → look → initPh
    const b = inner[Math.floor(rP() * inner.length)];
    const inset = Math.min(1.3 + rP() * 2.4, BLD_ON ? SW - ALIGN_OUT - .3 : 9);   // 實體建築推到街面後台階最多凸出 ALIGN_OUT（27-bldfoot.js），路人不貼著牆走
    const w = b.x1 - b.x0 - inset * 2, d = b.z1 - b.z0 - inset * 2;
    const per = 2 * (w + d);
    const um = rP() < .62;
    const s0 = rP() * per;
    const dir0 = rP() < .5 ? 1 : -1;
    const baseV = 1.05 + rP() * .5;
    peds.look(k, { r: rP });
    if (k % 19 === 7) peds.look(k, LUCIA(k));   // 幾個路人換成 Lucia 的掃描模型（http(s) 下載好才換；亂數另外抽，rP 的序列不變）
    else if (Q197[k % 19]) peds.look(k, q197Look(k, Q197[k % 19]));
    const initPh = rP() * 10;

    // 用決定性雜湊區分：少數無雨慢跑客（jogger）、低頭滑手機族（texter）與偶爾駐足看櫥窗的行人，不改動 rP 序列
    const hk = hash01(k * 23.17 + baseV * 19.3), hk2 = hash01(k * 41.9 + 5.7);
    const age = peds.people[k].tr ? peds.people[k].tr.age : 0;
    const jogger = !um && age < .1 && hk > .88;
    const texter = !um && !jogger && age < .3 && hk > .73 && hk <= .88;
    const vIndiv = jogger ? 2.35 + hk2 * .42 : texter ? .96 + hk2 * .22 : baseV * (1 - age * .18) * (.92 + hk2 * .18);
    const a0 = um ? ANIM.umbrella : jogger && wx.rain < .22 ? ANIM.jog : texter && wx.rain < .35 ? ANIM.textWalk : ANIM.walk;
    const ps = {
      b, inset, w, d, per, s: s0, dir: dir0, v: vIndiv, curV: vIndiv,
      um, um0: um, dodge: 0, dx: 0, dz: 0,
      jogger, texter, walkPh: initPh,
      pauseT: 0, pauseCd: 7 + hk * 24, pauseAnim: hk2 > .48 ? ANIM.text : ANIM.idle,
      curAnim: a0, prevAnim: a0, blend: 0, yaw: null,
    };
    pedState.push(ps);
    peds.anim(k, a0, initPh, pedStepRate(k, ps, vIndiv));
    if (um) umbrellas.push(k);
  }
  // 夜店門口排隊人龍與保鑣：打破等距排排站與全體同向，改為兩兩結伴面對面交談、滑手機亮屏、抽菸等自然社交間距與朝向（rP 消耗次數完全不變）
  const qOffsets = [0, .82, 2.22, 3.02, 4.45, 5.55];
  const qLat = [.06, .34, -.04, .28, .12, -.08];
  const qAnims = [ANIM.talk, ANIM.idle, ANIM.smoke, ANIM.talk, ANIM.text, ANIM.cross];
  // 結伴朝向：0 與 1 微側身相對聊天、2 與 3 相對閒聊、4 低頭看手機略朝排隊方向、5 抱胸微側張望
  const qFaceBase = [Math.PI * .78, Math.PI * .22, Math.PI * .74, Math.PI * .26, Math.PI * .52, Math.PI * .42];
  for (let q = 0; q < 6; q++) {
    const k = PED_N + q;
    peds.look(k, { r: rP, glowI: q % 2 ? 1.3 : 0 });
    if (q === 2) peds.look(k, LUCIA(k));
    const ph = rP() * 10;
    const jit = (rP() - .5) * .28;
    const x = CLUB_X - 4.35 - qOffsets[q], z = CLUB_Z + 1.42 + qLat[q];
    peds.anim(k, qAnims[q], ph, .90 + (q % 3) * .09);
    peds.place(k, ...xzW(x, z, .15), yawW(zoneAtL(x, z), qFaceBase[q] + jit));
    circles.push({ x, z, r: .3 });
  }
  peds.look(PED_N + 6, { top: lin(0x0c0c0e), bot: lin(0x0c0c0e), skin: SKINS[3], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, glowI: 0, scale: 1.12 });
  peds.anim(PED_N + 6, ANIM.cross, 2.7, .94);
  peds.place(PED_N + 6, ...xzW(CLUB_X + 1.6, CLUB_Z + 1.1, .15), yawW(zoneAtL(CLUB_X, CLUB_Z), 0));
  circles.push({ x: CLUB_X + 1.6, z: CLUB_Z + 1.1, r: .35 });
  // 酒吧門口抽菸的人
  peds.look(PED_N + 7, { r: rP, coat: 1 });
  peds.anim(PED_N + 7, ANIM.smoke, 3.4, .96);
  peds.place(PED_N + 7, ...xzW(BAR_X - 3.2, BAR_Z + .45, .15), yawW(zoneAtL(BAR_X, BAR_Z), .2));
  circles.push({ x: BAR_X - 3.2, z: BAR_Z + .45, r: .3 });
  peds.mesh.count = PED_N + 8;
  scene.add(peds.mesh);
}
const BOUNCER = { x: CLUB_X + 1.6, z: CLUB_Z + 1.1 };   // 邏輯座標（60-venues.js 用到時換算）

// 雨停了收傘、下雨了撐傘（28-sky.js 的 updateWeather 在雨量跨過門檻時呼叫）；倒地、逃跑或被 69-combat 接手的人等恢復時自己換
function pedUmbrellas(on) {
  pedState.forEach((ps, k) => {
    const want = on && ps.um0;
    if (ps.um === want) return;
    ps.um = want;
    if (!(ps.down > 0) && !(ps.panic > 0) && !ps.fsm) {
      const na = pedBaseAnim(k, ps);
      ps.prevAnim = ps.curAnim; ps.curAnim = na; ps.blend = 1; ps.pauseT = 0;
      peds.anim(k, na, rP() * 10, pedStepRate(k, ps, Math.max(.4, ps.curV)));
    }
  });
}
const umbMesh = (() => {
  const k = new Kit();
  const cone = new T.ConeGeometry(.62, .32, 12, 1, true);
  k.add(cone, 0xffffff, 10, tf(0, .16, 0));
  k.cyl(0, -.45, 0, .011, .011, .95, 6, 0x222222, 15);
  k.cyl(0, -.94, .02, .018, .018, .12, 6, 0x3a2a1a, 2, .35);
  const g = k.build();
  const m = new T.InstancedMesh(g, MAT.uberD, Math.max(1, umbrellas.length));
  const cols = [0x14161a, 0x1e2430, 0x521820, 0x1d2d44, 0x7e92a2, 0x28382c].map(lin);
  const ic = new Float32Array(Math.max(1, umbrellas.length) * 3);
  umbrellas.forEach((_, i) => { const c = cols[i % cols.length]; ic.set([c.r, c.g, c.b], i * 3); });
  m.instanceColor = new T.InstancedBufferAttribute(ic, 3);
  m.frustumCulled = false; scene.add(m);
  return m;
})();
// uberD 是雙面材質：傘面顏色以 instanceColor 乘上
MAT.uberD.name = 'uberTint';

// 繞街區的路線在邏輯座標算，回傳世界座標的位置與前進方向 [x, z, tx, tz]；轉角走半徑 rc 的圓弧，不在轉角瞬間轉 90°
const blkZone = b => b.zn ??= zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
const blkW = b => b.wc ??= toW((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, blkZone(b));
function pedPosL(ps) {
  const { b, inset, w, d } = ps;
  let s = ((ps.s % ps.per) + ps.per) % ps.per;
  const x0 = b.x0 + inset, z0 = b.z0 + inset;
  const rc = Math.min(1.35, w * .18, d * .18);
  // 四個轉角：在距離頂點 ±rc 範圍內走平滑圓弧並連續插值切線方向
  const corners = [
    [w, x0 + w - rc, z0 + rc, 0],
    [w + d, x0 + w - rc, z0 + d - rc, Math.PI * .5],
    [2 * w + d, x0 + rc, z0 + d - rc, Math.PI],
    [2 * (w + d), x0 + rc, z0 + rc, Math.PI * 1.5],
  ];
  // 檢查靠近起點/終點 (s ≈ 0 或 s ≈ per) 的第四個轉角
  if (rc > .15) {
    const dsLast = s < rc ? s + rc : s > ps.per - rc ? s - (ps.per - rc) : -1;
    if (dsLast >= 0) {
      const u = clamp(dsLast / (2 * rc), 0, 1), ang = Math.PI * 1.5 + u * Math.PI * .5;
      return [x0 + rc + Math.sin(ang) * rc, z0 + rc - Math.cos(ang) * rc, Math.cos(ang), Math.sin(ang)];
    }
    for (let ci = 0; ci < 3; ci++) {
      const [sc, cx, cz, a0] = corners[ci];
      if (Math.abs(s - sc) < rc) {
        const u = (s - (sc - rc)) / (2 * rc), ang = a0 + u * Math.PI * .5;
        return [cx + Math.sin(ang) * rc, cz - Math.cos(ang) * rc, Math.cos(ang), Math.sin(ang)];
      }
    }
  }
  if (s < w) return [x0 + s, z0, 1, 0];
  s -= w; if (s < d) return [x0 + w, z0 + s, 0, 1];
  s -= d; if (s < w) return [x0 + w - s, z0 + d, -1, 0];
  s -= w; return [x0, z0 + d - s, 0, -1];
}
function pedPos(ps) {
  const [x, z, tx, tz] = pedPosL(ps), zn = blkZone(ps.b), [X, Z] = toW(x, z, zn), [TX, TZ] = dirW(zn, tx, tz);
  return [X, Z, TX, TZ];
}

// 行人繞著一個街區走；走出玩家的生成圈（30-vehicles.js 的 RING_PED，90–140 m，移動時往外推、偏向前方）又不在鏡頭裡，
// 就換到外環上的街區，出現的那一點也要在鏡頭看不到的地方；街區超過 230 m 的不管看不看得到都換。找不到就下一幀再試，
// 連續 RING_LOOSE 次找不到（一直往前走、前方都看得到），就放在外環的外半圈（一百多公尺外的人只有幾個像素高）；移動時背後的人先換
const pedBlocks = blocks.filter(b => !b.outer && !b.park);
function pedRelocate(ps, px, pz, [r0, r1] = ringR(RING_PED)) {
  const loose = (ps.ringF || 0) >= RING_LOOSE;
  for (let n = 0; n < 30; n++) {
    const b = pedBlocks[Math.floor(rP() * pedBlocks.length)], [bx, bz] = blkW(b), d = Math.hypot(bx - px, bz - pz);
    if (d < r0 - 30 || d > r1 + 30 || rP() > ringAhead(bx, bz, px, pz)) continue;
    const w = b.x1 - b.x0 - ps.inset * 2, dd = b.z1 - b.z0 - ps.inset * 2, per = 2 * (w + dd);
    for (let m = 0; m < 3; m++) {
      const q = { b, inset: ps.inset, w, d: dd, per, s: rP() * per }, [x, z] = pedPos(q), dp = Math.hypot(x - px, z - pz);
      if (dp < (loose ? (r0 + r1) / 2 : r0) || dp > r1 || !loose && !ringHidden(x, z, 1)) continue;
      ps.b = b; ps.w = w; ps.d = dd; ps.per = per; ps.s = q.s; ps.dx = ps.dz = 0; ps.ringF = 0; ps.yaw = null; ps.pauseT = 0;
      return true;
    }
  }
  ps.ringF = (ps.ringF || 0) + 1;
  return false;
}
// 下雨天路人變少：雨越大，越多人躲進室內（沒帶傘的先走）。只在離玩家 55 m 外消失、出現，放到遠處就不會被撞、被瞄準或當目擊者
pedState.forEach((ps, k) => { const h = (k * .6180339887 + .31) % 1; ps.shy = ps.um0 ? h * .6 : .4 + h * .6; });
const PED_AWAY = 2e4;
const PED_DIVE_V = 7, PED_DIVE_T = .9, PED_DIVE_W = .9, PED_DIVE_A = 7;   // 撲開：車速 7 m/s 以上、0.9 秒車程內、車寬外 0.9 m；在框裡每秒往外橫移 7 m（最多 2.6 m）

// 換成 nextId（從原本的動作淡出）；比的是實際在播的 a[0]，68-gta.js、69-combat.js 會直接 peds.anim 讓人跑，ps.curAnim 不準
function pedSwitchAnim(k, ps, nextId, spRate, ph = ps.walkPh) {
  const a = peds.people[k].a;
  ps.curAnim = nextId;
  if (a[0] === nextId) { a[2] = spRate; return; }
  ps.prevAnim = a[0];
  ps.blend = 1;
  peds.anim(k, nextId, ph, spRate);
}

function updatePeds(dt) {
  let u = 0;
  const ppx = pX(), ppz = pZ(), share = (1 - .5 * clamp((wx.rain - .1) / .8, 0, 1)) * pedTurfShare() * SET.ped;   // SET.ped：Esc 選單的人口密集程度   // 69-turf.js：赤蠍幫的地盤路人少
  const ring = ringR(RING_PED);
  let ringN = RING_PER_FRAME + 1;
  pedState.forEach((ps, k) => {
    if (ps.out) { if (ps.shy >= share || ringN <= 0) return; ringN--; if (!pedRelocate(ps, ppx, ppz, ring)) return; ps.out = 0; }   // 雨停回到街上的人也從外環看不到的地方出來
    else if (ps.shy >= share && !ps.fsm && !(ps.down > 0) && !(ps.panic > 0)) {
      const p = peds.people[k];
      if ((p.x - ppx) ** 2 + (p.z - ppz) ** 2 > 55 * 55) { ps.out = 1; peds.place(k, PED_AWAY, -50, PED_AWAY, 0); return; }
    }
    if (ringN > 0 && !ps.fsm && !(ps.down > 0) && !(ps.panic > 0)) {
      const [bx, bz] = blkW(ps.b), d2 = (bx - ppx) ** 2 + (bz - ppz) ** 2, p = peds.people[k], dx = p.x - ppx, dz = p.z - ppz;
      if (d2 > RING_PED.hard ** 2 || (ringBehind(dx, dz, dx * dx + dz * dz, ring[0]) || d2 > (ring[1] + 40) ** 2) && ringHidden(p.x, p.z, 1)) { ringN--; pedRelocate(ps, ppx, ppz, ring); }   // 街區中心比人的位置遠一點，留 40 m
    }
    // 68-gta.js：中彈或被撞倒地（down 秒數倒數完換個地方重新出現），聽到槍聲爆炸就跑（panic）
    // 69-combat.js：被槍指著投降、抱頭蹲下、脾氣差的人反擊（pedFsm 接手這一幀就 return）
    // 69-combat.js／69-v9-ai.js 接手時清掉平滑過渡殘留權重，避免干擾外部狀態機
    if (ps.fsm && !(ps.down > 0)) {
      if (ps.blend > 0) { ps.blend = 0; peds.anim2(k, ps.prevAnim, 0, 1); }
      ps.yaw = null;
      if (pedFsm(k, ps, dt)) return;
    }
    if (ps.down > 0) {
      ps.down -= dt;
      if (ps.blend > 0) { ps.blend = 0; peds.anim2(k, ps.prevAnim, 0, 1); }
      peds.place(k, ps.dpos[0], ps.fly ? ps.fly.y : groundH(ps.dpos[0], ps.dpos[1]) > 0 ? .15 : 0, ps.dpos[1], ps.dpos[2]);   // fly：68-wreck.js 被車撞飛
      if (ps.down <= 0 && ps.stun) { ps.stun = 0; ps.panic = 6; ps.curAnim = ANIM.run; peds.anim(k, ANIM.run, rP() * 10, 1.15); return; }   // 電擊槍：原地爬起來逃跑
      if (ps.down <= 0) {
        ps.s = rP() * ps.per; ps.dx = ps.dz = 0; ps.panic = 0; ps.yaw = null;
        const na = pedBaseAnim(k, ps); ps.curAnim = na;
        peds.anim(k, na, rP() * 10, pedStepRate(k, ps, ps.v));
      }
      return;
    }
    if (ps.panic > 0) {
      ps.panic -= dt;
      ps.pauseT = 0;
      if (ps.panic <= 0) pedSwitchAnim(k, ps, pedBaseAnim(k, ps), pedStepRate(k, ps, ps.v), rP() * 10);   // 相位照舊版抽 rP()，換位的亂數序列不變
    }

    // 日常駐足小動作（看店面櫥窗或停下回訊息，大雨、撐傘、慢跑與恐慌時不停）
    if (!(ps.panic > 0) && !ps.um && !ps.jogger && wx.rain < .25 && !(ps.dodge > 0)) {
      if (ps.pauseT > 0) {
        ps.pauseT -= dt;
      } else {
        ps.pauseCd -= dt;
        if (ps.pauseCd <= 0) {
          ps.pauseT = 3.2 + (k % 4) * 1.1;
          ps.pauseCd = 16 + (k % 7) * 4.5;
        }
      }
    } else {
      ps.pauseT = 0;
    }

    // 起步與停步平滑加減速過渡
    const wantV = ps.panic > 0 ? 4.4 : ps.pauseT > 0 ? 0 : ps.v;
    ps.curV = damp(ps.curV ?? ps.v, wantV, ps.panic > 0 ? 8 : 4.2, dt);
    ps.s += ps.curV * ps.dir * dt;

    let [x, z, tx, tz] = pedPos(ps);
    tx *= ps.dir; tz *= ps.dir;

    // 被玩家逼近時往旁邊閃
    const px = player.mode === 'drive' ? player.veh.x : player.x, pz = player.mode === 'drive' ? player.veh.z : player.z;
    const dx = x + ps.dx - px, dz = z + ps.dz - pz, dd = Math.hypot(dx, dz);
    const danger = player.mode === 'drive' ? (Math.hypot(player.veh.vx, player.veh.vz) > 3 ? 4.5 : 2.4) : .9;
    if (dd < danger && dd > .01) { ps.dx += dx / dd * (danger - dd) * 4 * dt; ps.dz += dz / dd * (danger - dd) * 4 * dt; ps.dodge = 1.2; ps.pauseT = 0; }
    // 撲開：玩家的車開得快時，車頭前方 PED_DIVE_T 秒車程、車寬兩側各多 PED_DIVE_W 的長方形裡的人往車身外側撲（從車的中線往外）
    if (player.mode === 'drive' && dd < 40) {
      const v = player.veh, sp = Math.hypot(v.vx, v.vz);
      if (sp > PED_DIVE_V && !v.boat && !v.fly) {
        const fx = v.vx / sp, fz = v.vz / sp, ahead = dx * fx + dz * fz, side = dx * fz - dz * fx, half = (v.w || 1.9) / 2 + PED_DIVE_W;
        if (ahead > -1 && ahead < sp * PED_DIVE_T + (v.len || 4.4) / 2 && Math.abs(side) < half) {
          // side > 0 是車的左邊（左邊的單位向量 (fz, -fx)），往同一邊撲；撲出去之後就不換邊
          const s = ps.dive > 0 ? ps.diveS : side > .05 ? 1 : side < -.05 ? -1 : (k & 1 ? 1 : -1);
          ps.diveS = s;
          ps.dx += fz * s * PED_DIVE_A * dt; ps.dz -= fx * s * PED_DIVE_A * dt; ps.dodge = 1.4; ps.dive = .8;
          if (!(ps.panic > 0)) { ps.panic = 3; ps.curAnim = ANIM.run; peds.anim(k, ANIM.run, rP() * 10, 1.35); }
        }
      }
    }
    ps.dx = damp(ps.dx, 0, ps.dodge > 0 ? .3 : 1.2, dt); ps.dz = damp(ps.dz, 0, ps.dodge > 0 ? .3 : 1.2, dt);
    const lim = ps.dive > 0 ? 2.6 : 1.4; ps.dx = clamp(ps.dx, -lim, lim); ps.dz = clamp(ps.dz, -lim, lim);
    if (ps.dive > 0) ps.dive -= dt;
    if (ps.dodge > 0) ps.dodge -= dt;
    x += ps.dx; z += ps.dz;

    // 動作混合與轉向平滑阻尼（駐足看櫥窗時微轉向建築側，轉彎時計算角速度供頭部預視與身體微傾）
    const p = peds.people[k];
    if (!(ps.panic > 0)) {
      const wantAnim = ps.curV < .18 ? ps.pauseAnim : pedBaseAnim(k, ps);
      const spRate = ps.curV < .18 ? 1 : pedStepRate(k, ps, Math.max(.35, ps.curV));
      pedSwitchAnim(k, ps, wantAnim, spRate);
    }
    if (ps.blend > 0) {
      ps.blend = Math.max(0, ps.blend - dt * 3.4);
      peds.anim2(k, ps.prevAnim, ps.blend, ps.prevAnim === ANIM.walk || ps.prevAnim === ANIM.jog ? pedStepRate(k, ps, ps.v) : 1);
    }

    let tgtYaw = Math.atan2(tx, tz);
    if (ps.pauseT > 0 && ps.pauseAnim === ANIM.idle) tgtYaw += ps.dir * .55;   // 側身望向店面櫥窗
    if (ps.yaw === null || Number.isNaN(ps.yaw)) {
      ps.yaw = tgtYaw; p.turnRate = 0;
    } else {
      const diff = wrapA(tgtYaw - ps.yaw);
      const stepYaw = diff * (1 - Math.exp(-7.5 * dt));
      ps.yaw += stepYaw;
      p.turnRate = damp(p.turnRate || 0, diff, 8, dt);
    }
    const yaw = ps.yaw;
    peds.place(k, x, .15, z, yaw);

    if (ps.um && !(ps.panic > 0)) {
      // 傘柄握把（局部 y=-0.94, z=0.02）精確對齊右手掌心（考慮腕到掌心偏移、傘頂微傾造成的底端位移與每人體型縮放 sv）
      const h = p.handL, sv = p.sv, c = Math.cos(yaw), s = Math.sin(yaw);
      const pitch = .04, roll = -clamp(p.turnRate || 0, -.3, .3) * .12;
      const hx = (h.x + .008) * sv.x - roll * .94, hy = (h.y + .022) * sv.y, hz = (h.z + .056) * sv.z + pitch * .94 - .02;
      _o.position.set(x + hx * c + hz * s, .15 + hy + .94, z + hz * c - hx * s);
      _o.rotation.set(pitch, yaw, roll); _o.scale.setScalar(1); _o.updateMatrix();
      umbMesh.setMatrixAt(u++, _o.matrix);
    }
  });
  instPush(umbMesh, u);
  peds.flush();
}

// ─── 玩家 ───
const me = crowd(1);
me.people[0].isMe = true;
me.look(0, { r: rng(9), female: false, top: lin(0x2b2420), bot: lin(0x17181c), skin: SKINS[1], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, shoe: SHOES[0], glow: lin(0xffae57), glowI: 1.4, scale: 1, pat: 1 });
me.anim(0, ANIM.idle, 0, 1);
scene.add(me.mesh);
const player = { mode: 'walk', ...WP(avX(1) - 9.6, stZ(2) + 18), y: .15, yaw: yawW(zoneAtL(avX(1), stZ(2)), 0), v: 0, vx: 0, vz: 0, veh: null, walkPh: 0, dance: 0, anim: ANIM.idle, blend: 0, prevAnim: ANIM.idle, where: 'out', stepT: 0 };
const SWIM_Y = .06;   // UAL 的游泳動畫以根骨當水面（踩水骨盆在 -0.33 m、自由式在 -0.08 m）
function updatePlayerWalk(inp, dt, camYaw) {
  if (player.ride && player.ride.metro) { metroRide(inp, dt); return; }   // 69-v9-metro.js：搭地鐵（站在車門旁跟著車走）
  if (player.ride && player.ride.tron) { tronRide(inp, dt, camYaw); return; }   // 21-tron.js：騎光格島的光速機車、坐長椅
  if (player.ride) { aptRide(dt); return; }   // 69-safehouse.js：走樓梯、搭電梯（照路徑走，不受碰撞）
  if (player.air3) { airStep(inp, dt, camYaw); return; }   // 69-v3-crash.js：被拋出車外、自由落體、開傘
  if (vaultStep(dt)) return;                               // 69-v3-crash.js：翻越矮牆與停著的車
  if (V5.lad) { ladStep(inp, dt); return; }               // 69-v5-civic.js：爬外牆鐵梯、翻鐵絲網
  let mx = inp.mx, mz = inp.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  if (ml > .05) { player.dance = 0; player.vig = 0; }   // vig：69-v9-switch.js 切換角色的小劇場動作
  // 相機的前方 = (sin yaw, cos yaw)；右方 = (-cos, sin)
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
  const wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
  const aimM = gta.aiming || gta.guard, run = inp.run && ml > .1 && !aimM;
  // 水深超過 1.25 m 改游泳（離開時 1.05 m，避免在邊界來回切換）；涉水時走慢一點
  // 跳躍中（jumpTry）不切換游泳：落進水裡那一幀才下水
  const depth = player.where === 'out' ? waterDepth(player.x, player.z) : 0, wasSwim = player.swim, J = player.jump;
  player.swim = !J && depth > (player.swim ? 1.05 : 1.25);
  if (player.swim !== wasSwim && depth > 0) { sfx.splash(player.swim ? 1 : .5); if (player.swim) { player.dance = 0; arm.trig = false; waterSplash(player.x, player.z, .8); } }
  const wade = player.swim || J ? 1 : clamp(1 - depth * .5, .45, 1);
  // 蹲下（69-combat.js 的 Z 鍵）：跑起來或水深過膝就站起來；crouchK 給相機降低高度
  if (player.crouch && (run || depth > .4)) player.crouch = false;
  player.crouchK = damp(player.crouchK || 0, player.crouch ? 1 : 0, 10, dt);
  // runK：69-v3-skills.js 的衝刺體力（喘的時候變慢）；skK.crouch：潛行等級讓蹲行快一點
  const rk = player.runK ?? 1, ck = skK.crouch;
  const target = ml > .05 ? (player.swim ? (run ? 2.3 * rk : 1.3) * (player.dive ? 1.15 : 1) : (run ? 4.6 * rk : player.crouch ? (aimM ? 1.1 : 1.3) * ck : aimM ? 1.5 : 1.7) * wade) * Math.min(1, ml) : 0;
  if (!J) player.v = damp(player.v, target * (player.loadK ?? 1), target > player.v ? 6 : 10, dt);   // loadK：69-v7-casino.js 袋子裡金條太重；空中保持起跳時的速度
  let mdx = Math.sin(player.yaw), mdz = Math.cos(player.yaw);
  if (aimM) {
    // 瞄準時身體對著準星，移動方向照搖桿（側移、後退）
    player.yaw += wrapA(camYaw - player.yaw) * (1 - Math.exp(-18 * dt));
    if (ml > .05) { const l = Math.hypot(wx, wz); player.mvx = wx / l; player.mvz = wz / l; }
    mdx = player.mvx || 0; mdz = player.mvz || 0;
  } else if (ml > .05) {
    const ty = Math.atan2(wx, wz);
    player.yaw += wrapA(ty - player.yaw) * (1 - Math.exp(-(J ? 2.5 : 12) * dt));   // 空中只能稍微修正方向
    mdx = Math.sin(player.yaw); mdz = Math.cos(player.yaw);
  }
  const nx = player.x + mdx * player.v * dt, nz = player.z + mdz * player.v * dt;
  colY = player.y;   // 快速道路橋面上的護欄只擋橋上的人、橋下的柱子只擋地面的人（30-vehicles.js）
  let r = skyWalk() ? { x: nx, z: nz } : collideCircle(nx, nz, .32, false, true);   // 塔吊的吊臂上（69-v5-tower.js）只看步行面
  colY = 0;
  let x = r.x, z = r.z;
  if (depth > 0) { [x, z] = farClamp(x, z); if (!tronNear(x, z)) z = Math.min(z, ISLE.z1 + 320); }   // 游不到對岸（21-coast.js 的 farClamp）；光格島附近（21-tron.js）可以游到碼頭的梯子
  // 車流、載具與路人（69-kinema.js：停著的車推得動一點、被車夾在牆上、和路人互相讓開、衝刺撞人）
  if (!skyWalk()) [x, z] = kinWalk(x, z);
  if (player.where === 'out') [x, z] = walkStep(player.x, player.z, x, z, player.y);   // 北嶺鐵道橋的護欄、洞壁、橋墩（20-walk.js）
  player.x = x; player.z = z;
  // 游泳時根骨貼著水面，慢慢上下起伏
  // 從梯子前的缺口上岸（31-boats.js、10-city.js 的 LADDERS）：一下子高 1.6 m，慢一點爬上去
  const fy = player.where === 'out' ? walkY(x, z, player.y, deckAt(x, z, player.y) ?? seaFloor(x, z)) : VENUES[player.where].lvs ? VENUES[player.where].lvY : groundH(x, z);   // 分層的安全屋：所在那一層的地板；戶外是步行面（20-walk.js）、快速道路橋面或地面
  if (J) jumpStep(J, fy, depth, dt);
  else player.y = player.swim ? damp(player.y, SEA_Y - SWIM_Y + Math.sin(uTimeNow() * 2.1) * .04 - (player.diveK || 0) * DIVE_D, 6, dt) : damp(player.y, fy, fy - player.y > .8 ? 4 : 20, dt);
  // 動作混合
  const sp = player.v;
  let a = player.swim ? (sp > .25 ? ANIM.breast : ANIM.swimIdle) : J ? ANIM.jump : sp > 3 ? ANIM.sprint : sp > .25 ? ANIM.walk : player.vig || (player.dance ? DANCES[player.dance - 1] : ANIM.idle);
  if (aimM) a = sp > .25 ? ANIM.aimWalk : ANIM.aimIdle;
  if (player.crouch) a = aimM ? (sp > .25 ? ANIM.crouchAimWalk : ANIM.crouchAim) : sp > .25 ? ANIM.crouchWalk : ANIM.crouch;
  if (a !== player.anim) { player.prevAnim = player.anim; player.anim = a; player.blend = 1; }
  player.blend = Math.max(0, player.blend - dt * 5);
  const back = aimM && mdx * Math.sin(player.yaw) + mdz * Math.cos(player.yaw) < -.3 ? -1 : 1;   // 瞄準時往後退：走路動畫倒著播
  // 每秒幾輪：走路 1.7 m/s 約 0.95 秒一輪、衝刺 4.6 m/s 每秒 1.5 輪（3 步）、蛙式 1.3 m/s 約 1.3 秒划一次
  const rate = a === ANIM.breast ? .45 + sp * .25 : a === ANIM.sprint ? sp / 4.6 * 1.5 : a === ANIM.jump ? 0 : a === ANIM.walk || a === ANIM.aimWalk ? sp / 1.7 * 1.07 * back : a === ANIM.crouchWalk || a === ANIM.crouchAimWalk ? sp * .75 * back : 1;
  player.walkPh += dt * rate;
  me.anim(0, a, player.walkPh - uTimeNow(), 1, 0);
  me.anim2(0, player.prevAnim, player.blend, 1);
  me.place(0, player.x, player.y, player.z, player.yaw);
  me.flush();
  // 腳步聲
  if (player.swim) {   // 划水聲
    const ph = player.walkPh;   // 蛙式每划一次一聲
    if (sp > .25 && Math.floor(ph) !== Math.floor(player.stepT)) sfx.splash(.25);
    player.stepT = ph;
  } else if (a === ANIM.walk || a === ANIM.sprint || a === ANIM.aimWalk) {
    const ph = player.walkPh * 2;
    if (Math.floor(ph) !== Math.floor(player.stepT)) sfx.step(a === ANIM.sprint, player.where !== 'out' || villaSt.inK > .5);
    player.stepT = ph;
  }
}
const uTimeNow = () => U.uTime.value;
// 跳（空白鍵；69-v3-crash.js 的 crashKey 先問翻越再問這裡）：原地或助跑起跳，約 0.9 m 高、0.86 秒落地，空中保持起跳的速度
const JUMP_VY = 4.2;
function jumpTry() {
  if (player.mode !== 'walk' || player.swim || player.jump || player.down > 0 || player.air3 || player.ride || vault.on || gta.jack || life.dead) return false;
  player.jump = { t: 0, vy: JUMP_VY, T: 2 * JUMP_VY / 9.8 }; player.crouch = false; player.dance = 0; player.blend = Math.min(player.blend, .45);
  sfx.step(true, player.where !== 'out' || villaSt.inK > .5);
  return true;
}
// 拋物線：落到步行面就落地；落進深水（1.25 m 以上）身體先沉到水下 0.9 m 再浮上來（下一幀成立游泳，濺水聲與水花在那裡）；
// 腳下比身體低 3.5 m 以上（從高處跳下去）交給 69-v3-crash.js 的自由落體，落地照高度算傷害
function jumpStep(J, fy, depth, dt) {
  J.t += dt; J.vy -= 9.8 * dt; player.y += J.vy * dt;
  if (J.vy > 0) return;
  if (depth > 1.25 && player.y <= SEA_Y) { player.jump = null; player.y = SEA_Y - SWIM_Y - .9; return; }
  if (player.y <= fy) { player.jump = null; player.y = fy; sfx.step(true, player.where !== 'out' || villaSt.inK > .5); return; }
  if (player.y - fy > 3.5 && player.where === 'out') { player.jump = null; player.air3 = { kind: 'fall', vx: Math.sin(player.yaw) * player.v, vy: J.vy, vz: Math.cos(player.yaw) * player.v, t: 0 }; }
}
