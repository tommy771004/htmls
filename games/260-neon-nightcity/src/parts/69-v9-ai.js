// ═══ 第九部曲（HANDOFF 的 AI 項目）：警察徵用民車與車門掩護、E 跟路人打招呼與挑釁、甩掉通緝後的便衣尾隨、路人舉手機拍照 ═══
// 數值是自己挑的具名常數（規格書沒給）；每幀入口 aiUpdate（99-main），測試 API 在 __nc.gta.ai，node tools/check-ai.mjs 驗收
const JACK_R = 35, JACK_MIN = 18, JACK_REACH = 1.4, JACK_RUN = 4.6, JACK_MAX = 2, JACK_GIVEUP = 12;   // 徵用：玩家開車跑出 18 m、警員沒車可開，攔 35 m 內的民車，最多兩台
const NOJACK = new Set([...COPS, 'md84', 'ambulance', 'firetruck', 'fire_chief', 'tow', 'tank']);
const COVER_MIN = 7, COVER_MAX = 45, COVER_LEAVE = 6, COVER_FAR = 50, COVER_DOWN = 2.2, COVER_UP = 1.4, COVER_COOL = 8;   // 車門掩護：蹲 2.2 秒、探身開槍 1.4 秒輪流
const TALK_R = 2.5, TALK_T = 6, TALK_END = 7, HECKLE_T = 8, HECKLE_D = 2.2, HECKLE_END = 25;   // 打招呼 6 秒內可以再按 E 挑釁；被挑釁跟上來嗆 8 秒
const TAIL_P = .4, TAIL_STAR = 2, TAIL_NEAR = 25, TAIL_FAR = 45, TAIL_SEE = 70, TAIL_LOSE = 160, TAIL_LOSE_T = 8, TAIL_T = 90;   // 便衣尾隨：甩掉 2 星以上四成機率，跟在 25–45 m
const SNAP_R = 25, SNAP_N = 2, SNAP_T = 2.4, SNAP_HOLD = .8, SNAP_SCARE = 3, SNAP_FUN_R = 30, SNAP_FUN_IV = 2.5, SNAP_MAX = 4;   // 拍照：犯罪 25 m 內最多兩個目擊者舉手機 2.4 秒
const SAY_T = 3.2, SAY_R = 32;   // 對白：頭上 3.2 秒，32 m 外不畫
const FLASH_COL = lin(0xf2f4ff);
const ai = { clk: 0, tail: null, funT: 0, says: [], phones: [], reps: [], force: 0, stats: { jack: 0, cover: 0, greet: 0, heckle: 0, tail: 0, tailBlown: 0, snap: 0, snapDone: 0, snapScared: 0 } };
const aiPick = a => a[Math.floor(Math.random() * a.length)];

// ─── 對白（原創台詞）───
const L_HI_ME = ['嘿。', '晚安。', '你好啊。', '這城市今晚還好嗎？'];
const L_HI = ['嗨。', '晚安，小心路滑。', '你也住這一帶？', '別擋路，我趕時間。', '我們認識嗎？', '今晚的霓虹特別刺眼。', '嗯…哈囉。'];
const L_HI_RAIN = ['這雨下得沒完沒了。', '傘借你？想得美。'];
const L_HI_NIGHT = ['這麼晚了還在外面晃？', '剛下夜班，別煩我。'];
const L_HI_TOUGH = ['看什麼？', '有事快說。', '離我遠一點。'];
const L_TAUNT_ME = ['你這身打扮真夠嗆。', '走路不長眼啊？', '嘖，什麼德性。', '回家吧你。'];
const L_FIGHT = ['你再說一次？', '找死是吧！', '今天讓你躺著回去。'];
const L_FLEE = ['神經病…', '我不想惹事！', '別過來！'];
const L_HECKLE = ['你說什麼？給我站住！', '有種別走！', '我記住你的臉了！', '來啊，再講一次！'];
const L_SNAP = ['拍到了，傳給警察！', '車牌都拍到了。'];
const L_FUN = ['這也太猛了！', '要上熱門了。', '再轉一圈！'];

// 對白掛在說話的人頭上（#says，和目標標記同一套底），同一個人只留最新的一句；body.talking（對話框開著）時整層藏起來
const saysEl = $('says');
const _v9p = V3(), _v9q = V3(), _v9d = V3();
function aiSay(key, get, text, me) {
  const old = ai.says.find(s => s.key === key);
  if (old) { old.el.remove(); ai.says.splice(ai.says.indexOf(old), 1); }
  const el = document.createElement('p');
  el.textContent = text; if (me) el.className = 'me';
  saysEl.appendChild(el);
  ai.says.push({ key, get, text, el, t: 0 });
}
const sayMe = text => aiSay('me', () => (player.mode === 'drive' ? [player.veh.x, player.veh.y + 1.8, player.veh.z] : [player.x, player.y + 1.95, player.z]), text, true);
const sayPed = (k, text) => aiSay('p' + k, () => { const p = peds.people[k]; return [p.x, footY(p.x, p.z) + 1.95, p.z]; }, text);
function saysStep(dt) {
  for (let i = ai.says.length - 1; i >= 0; i--) {
    const s = ai.says[i];
    s.t += dt;
    if (s.t > SAY_T || player.where !== 'out') { s.el.remove(); ai.says.splice(i, 1); continue; }
    s.el.classList.toggle('off', s.t > SAY_T - .25);
    const [x, y, z] = s.get(), d = Math.hypot(x - camera.position.x, z - camera.position.z);
    _v9p.set(x, y, z).project(camera);
    if (_v9p.z > 1 || d > SAY_R || Math.abs(_v9p.x) > 1.1 || Math.abs(_v9p.y) > 1.1) { s.el.style.display = 'none'; continue; }
    s.el.style.display = '';
    s.el.style.transform = `translate(${((_v9p.x * .5 + .5) * innerWidth).toFixed(1)}px,${((-_v9p.y * .5 + .5) * innerHeight).toFixed(1)}px) translate(-50%,-100%)`;
  }
}

// ─── 警察徵用民車：警員沒車可開（被打爛或被玩家開走）而玩家開車跑遠，就攔下最近的民車、把駕駛拖下來開去追。
// 徵用車是 quiet 單位：沒有警笛、不閃燈、車流不讓路、小地圖不閃（69-police.js 與 30-vehicles.js 的 sirenBehind 會跳過）───
function copJack(c, dt, carOk, d) {
  const tc = c.jackC;
  if (tc) {
    c.jackT += dt;
    if (!traffic.includes(tc) || player.mode !== 'drive' || !W.stars || c.jackT > JACK_GIVEUP || d > 120) { tc.jackBy = null; c.jackC = null; return false; }
    tc.hit = Math.max(tc.hit, 1.5);   // 車流停住（30-vehicles.js 的 hit 倒數）
    const ty = TYPES[tc.type], lx = Math.cos(tc.yaw), lz = -Math.sin(tc.yaw);
    const dx = tc.x + lx * (ty.w / 2 + .55) + Math.sin(tc.yaw) * .35 - c.x, dz = tc.z + lz * (ty.w / 2 + .55) + Math.cos(tc.yaw) * .35 - c.z, dd = Math.hypot(dx, dz) || 1;
    if (dd < JACK_REACH) { copTake(c, tc); return true; }
    c.yaw += wrapA(Math.atan2(dx, dz) - c.yaw) * (1 - Math.exp(-10 * dt));
    const r = collideCircle(c.x + dx / dd * JACK_RUN * dt, c.z + dz / dd * JACK_RUN * dt, .32, false); c.x = r.x; c.z = r.z;
    copsCrowd.anim(c.k, ANIM.run, c.ph += dt, 1.15);
    copsCrowd.place(c.k, c.x, footY(c.x, c.z), c.z, c.yaw);
    return true;
  }
  if (carOk || c.swat || c.cover || player.mode !== 'drive' || !W.stars || d < JACK_MIN) return false;
  if ((c.jackLook = (c.jackLook || 0) - dt) > 0) return false;
  c.jackLook = 1.2;
  if (W.units.filter(u => u.jack && !u.v.dead).length >= JACK_MAX) return false;
  let best = null, bd = JACK_R;
  for (const q of traffic) {
    if (NOJACK.has(q.type) || q.turn || Math.abs((q.y || 0) - (c.y || 0)) > 2.5) continue;   // 橋上的車不攔
    if (q.jackBy && q.jackBy.on && q.jackBy.jackC === q) continue;   // 已經有別的警員在攔
    const e = Math.hypot(q.x - c.x, q.z - c.z); if (e < bd) { bd = e; best = q; }
  }
  if (!best) return false;
  c.jackC = best; c.jackT = 0; best.jackBy = c; best.hit = Math.max(best.hit, 1.5);
  return false;
}
function copTake(c, tc) {
  tc.jackBy = null;
  const v = detachCar(tc);
  const j = jacked.indexOf(v); if (j >= 0) jacked.splice(j, 1);   // 交給 W.units 管：dropUnit 收掉，被玩家搶走時 dropUnit 再放回 jacked
  v.vx = v.vz = 0;
  const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);
  spawnExtra(v.x + lx * (v.w / 2 + .7), v.z + lz * (v.w / 2 + .7), v.yaw + Math.PI / 2, lx, lz);   // 被拖下車的駕駛
  sfx.doorCar(true); panic(v.x, v.z, 14, 5);
  const u = { v, kind: 'car', state: 'chase', crew: 1, drive: true, stuck: 0, rev: 0, revS: 1, search: null, searchT: 0, out: false, t: 0, gunT: 4, quiet: 1, jack: 1 };
  v.unit = u; W.units.push(u);
  freeCop(c); c.jackC = null;
  ai.stats.jack++;
  if (Math.hypot(v.x - pX(), v.z - pZ()) < 90) toast('警察攔下一台民車追過來了');
}

// ─── 車門掩護：兩星以上、玩家步行在 7–45 m，下了車的警員躲到警車離玩家較遠的那一側（側面躲在前車門旁、玩家在車頭車尾方向就躲在另一端），
// 蹲著 2.2 秒、探身開槍 1.4 秒輪流；蹲著時射線只打得到 1.15 m 以下（69-police.js 的 rayHooks）。回傳 true：這一幀已處理；'up'：原地照 copStep 的瞄準開槍 ───
function copCover(c, dt, carOk, d) {
  if (c.coverCool > 0) c.coverCool -= dt;
  const u = c.unit, v = carOk ? u.v : null;
  const ok = carOk && player.mode === 'walk' && W.stars >= 2 && !c.jackC && Math.hypot(v.vx, v.vz) < 1.5;
  if (!c.cover) {
    if (!ok || d < COVER_MIN || d > COVER_MAX || c.coverCool > 0) return false;
    c.cover = 'go'; c.coverT = 0; u.hold = true; ai.stats.cover++;   // hold：警車等警員回來才開（driveUnit）
  } else if (!ok || d < COVER_LEAVE || d > COVER_FAR) { c.cover = null; c.coverCool = COVER_COOL; return false; }
  const s = coverSpot(v, pX(), pZ());
  let gx = s[0] - c.x, gz = s[1] - c.z, gd = Math.hypot(gx, gz);
  const tx = pX() - c.x, tz = pZ() - c.z;
  if (gd > .35) {   // 跑過去：直線會穿過車身就先繞到最近的車角
    if (c.cover !== 'go') c.coverT = 0;
    c.cover = 'go';
    const w = coverDetour(v, c.x, c.z, s[0], s[1]);
    if (w) { gx = w[0] - c.x; gz = w[1] - c.z; gd = Math.hypot(gx, gz) || 1; }
    const st = Math.min(gd, 4.4 * dt), r = collideCircle(c.x + gx / gd * st, c.z + gz / gd * st, .32, false); c.x = r.x; c.z = r.z;
    c.yaw += wrapA(Math.atan2(gx, gz) - c.yaw) * (1 - Math.exp(-10 * dt));
    copsCrowd.anim(c.k, ANIM.aimRun, c.ph += dt, 1);
    copsCrowd.place(c.k, c.x, footY(c.x, c.z), c.z, c.yaw);
    return true;
  }
  c.coverT += dt;
  c.yaw += wrapA(Math.atan2(tx, tz) - c.yaw) * (1 - Math.exp(-8 * dt));
  if (c.coverT % (COVER_DOWN + COVER_UP) < COVER_DOWN) {
    c.cover = 'down';
    copsCrowd.anim(c.k, ANIM.crouch, 0, 1);
    copsCrowd.place(c.k, c.x, footY(c.x, c.z), c.z, c.yaw);
    return true;
  }
  c.cover = 'up';
  return 'up';
}
// 掩護點：玩家在車身哪一側（以車寬、車長換算成比例比較），就躲到相對的那一側
function coverSpot(v, px, pz) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = fz, rz = -fx;
  const lr = (px - v.x) * rx + (pz - v.z) * rz, lf = (px - v.x) * fx + (pz - v.z) * fz;
  if (Math.abs(lr) / v.w >= Math.abs(lf) / v.len) {
    const sr = -(Math.sign(lr) || 1) * (v.w / 2 + .55), sf = v.len * .14;   // 前車門旁
    return [v.x + rx * sr + fx * sf, v.z + rz * sr + fz * sf];
  }
  const sf = -(Math.sign(lf) || 1) * (v.len / 2 + .55);
  return [v.x + fx * sf, v.z + fz * sf];
}
function coverDetour(v, ax, az, bx, bz) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = fz, rz = -fx, hw = v.w / 2 + .3, hl = v.len / 2 + .3;
  let cross = false;
  for (let i = 1; i < 6 && !cross; i++) {
    const x = lerp(ax, bx, i / 6) - v.x, z = lerp(az, bz, i / 6) - v.z;
    cross = Math.abs(x * rx + z * rz) < hw && Math.abs(x * fx + z * fz) < hl;
  }
  if (!cross) return null;
  let best = null, bs = 1e9;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const x = v.x + rx * a * (hw + .45) + fx * b * (hl + .45), z = v.z + rz * a * (hw + .45) + fz * b * (hl + .45);
    const s = Math.hypot(x - ax, z - az) + Math.hypot(bx - x, bz - z);
    if (s < bs) { bs = s; best = [x, z]; }
  }
  return best;
}

// ─── E 跟路人說話：打招呼（對方停下來回一句）→ 6 秒內再按 E 挑釁：脾氣差的動手，其他人一半跑開、一半跟上來嗆 ───
function aiNearPed(x, z, r) {
  let b = -1, bd = r;
  for (let k = 0; k < PED_N; k++) {
    const ps = pedState[k];
    if (ps.out || ps.down > 0 || ps.panic > 0 || ps.fsm && ps.fsm !== 'talk') continue;
    const p = peds.people[k], e = Math.hypot(p.x - x, p.z - z);
    if (e < bd) { bd = e; b = k; }
  }
  return b;
}
ctxLate.push(p => {
  if (p.mode !== 'walk' || p.where !== 'out' || gta.aiming || p.down > 0 || life.dead || p.swim) return null;
  const k = aiNearPed(p.x, p.z, TALK_R);
  if (k < 0) return null;
  return pedState[k].fsm === 'talk' && pedState[k].talkN ? { key: 'E', text: '挑釁', fn: () => aiHeckle(k) } : { key: 'E', text: '打招呼', fn: () => aiGreet(k) };
});
function aiGreet(k) {
  const ps = pedState[k], t = uTimeNow();
  if (ps.down > 0) return;
  sayMe(aiPick(L_HI_ME));
  pedEnter(k, 'talk', t + TALK_T);
  peds.anim(k, ANIM.talk, Math.random() * 5, 1);
  ps.talkN = 1; ps.talkAt = ai.clk + .8; ps.aiEnd = ai.clk + TALK_T;
  ai.stats.greet++;
}
function greetLine(ps) {
  if (ps.tough) return aiPick(L_HI_TOUGH);
  const r = Math.random();
  if (wx.rain > .3 && r < .4) return aiPick(L_HI_RAIN);
  if ((clockSt.min < 300 || clockSt.min > 1380) && r < .35) return aiPick(L_HI_NIGHT);
  return aiPick(L_HI);
}
function aiHeckle(k) {
  const ps = pedState[k], t = uTimeNow();
  if (ps.down > 0) return;
  sayMe(aiPick(L_TAUNT_ME)); ai.stats.heckle++;
  ps.talkN = 0;
  if (ps.tough) { pedEnter(k, 'fight', t + 25); sayPed(k, aiPick(L_FIGHT)); return; }
  if (Math.random() < .5) { sayPed(k, aiPick(L_FLEE)); pedLeave(k, ps); return; }
  pedEnter(k, 'heckle', t + HECKLE_T);
  ps.talkAt = ai.clk + .6; ps.nextSay = ai.clk + 3; ps.aiEnd = ai.clk + HECKLE_T;
}
// 69-combat.js 的 pedFsm 遇到 talk／heckle／snap 交給這裡；回傳 false 表示這一幀交還 40-people 的一般走路
// 計時用 ai.clk（照遊戲 dt 累加，子彈時間與驗收的快轉都對；uTimeNow 是真實時間），只有槍聲 W.bangT 照 69-police.js 用真實時間比
function aiPedFsm(k, ps, dt) {
  const t = ai.clk;
  const px = player.mode === 'drive' ? player.veh.x : player.x, pz = player.mode === 'drive' ? player.veh.z : player.z;
  const dx = px - ps.fx, dz = pz - ps.fz, d = Math.hypot(dx, dz) || 1;
  const bang = uTimeNow() - (W.bangT ?? -9) < 1;
  if (ps.fsm === 'snap') return snapStep(k, ps, dt, t, d, bang);
  if (bang) { pedLeave(k, ps); return false; }
  if (life.dead || player.where !== 'out' || t > ps.aiEnd || d > (ps.fsm === 'talk' ? TALK_END : HECKLE_END)) { pedResume(k, ps); return false; }
  ps.fyaw += wrapA(Math.atan2(dx, dz) - ps.fyaw) * (1 - Math.exp(-6 * dt));
  if (ps.talkAt && t > ps.talkAt) { ps.talkAt = 0; sayPed(k, ps.fsm === 'talk' ? greetLine(ps) : aiPick(L_HECKLE)); }
  if (ps.fsm === 'heckle') {
    const sp = d > HECKLE_D + .6 ? Math.min(4.4, (d - HECKLE_D) * 2) : 0;
    if (sp) { const r = collideCircle(ps.fx + dx / d * sp * dt, ps.fz + dz / d * sp * dt, .3, false); ps.fx = r.x; ps.fz = r.z; }
    peds.anim(k, sp > 2.2 ? ANIM.run : sp ? ANIM.walk : ANIM.talk, ps.walkPh = (ps.walkPh || 0) + dt, 1);
    if (t > ps.nextSay) { ps.nextSay = t + 2.4 + Math.random(); sayPed(k, aiPick(L_HECKLE)); }
  }
  peds.place(k, ps.fx, footY(ps.fx, ps.fz), ps.fz, ps.fyaw);
  return true;
}
// 不慌不忙地回到人行道上（pedLeave 是跑開）
function pedResume(k, ps) {
  ps.fsm = null; ps.talkN = 0;
  ps.s = nearestS(ps, ps.fx, ps.fz);
  const [x, z] = pedPos(ps);
  ps.dx = clamp(ps.fx - x, -1.4, 1.4); ps.dz = clamp(ps.fz - z, -1.4, 1.4); ps.dodge = 1;
  peds.anim(k, ps.um ? ANIM.umbrella : ANIM.walk, Math.random() * 10, ps.v * .78);
}

// ─── 拍照：路人目擊的犯罪（69-police.js 的 crime 排進 W.reports 的那筆）由最近的一兩個人舉手機拍下來，就是那筆報案；
// 拍的人全被嚇跑（槍聲、被瞄準、走近 3 m、被撞倒）而且還沒拍完，報案就取消。燒胎、甜甜圈、跳台飛車也會有人拍，但不報案 ───
function snapWitness(rep, x, z) {
  const c = [];
  for (let k = 0; k < PED_N; k++) {
    const ps = pedState[k];
    if (ps.out || ps.down > 0 || ps.fsm) continue;
    const p = peds.people[k], e = Math.hypot(p.x - x, p.z - z);
    if (e < SNAP_R && e > SNAP_SCARE + 1 && losClear(p.x, p.z, x, z)) c.push([e, k]);
  }
  c.sort((a, b) => a[0] - b[0]);
  const ks = c.slice(0, SNAP_N).map(([, k]) => k).filter(k => snapStart(k, rep));
  if (ks.length) ai.reps.push({ rep, ks, done: false });
}
function snapStart(k, rep) {
  if (snapCount() >= SNAP_MAX) return false;
  const ps = pedState[k];
  pedEnter(k, 'snap', uTimeNow() + SNAP_T + SNAP_HOLD + 1);
  if (ps.fsm !== 'snap') return false;
  peds.anim(k, ANIM.aimIdle, 0, 1);
  ps.aiEnd = ai.clk + SNAP_T + SNAP_HOLD + 1; ps.snapT = 0; ps.snapDone = 0; ps.snapRep = rep;
  ai.stats.snap++;
  return true;
}
const snapCount = () => pedState.reduce((n, ps) => n + (ps.fsm === 'snap' ? 1 : 0), 0);
function snapStep(k, ps, dt, t, d, bang) {
  const P = peds.people[k];
  if (bang || life.dead || player.where !== 'out' || d < SNAP_SCARE && player.mode === 'walk' || t > ps.aiEnd) {
    if (ps.snapDone && !bang) pedResume(k, ps); else pedLeave(k, ps);
    P.aimK = 0; return false;
  }
  const px = player.mode === 'drive' ? player.veh.x : player.x, pz = player.mode === 'drive' ? player.veh.z : player.z, py = player.mode === 'drive' ? player.veh.y + 1 : player.y + 1.2;
  ps.fyaw += wrapA(Math.atan2(px - ps.fx, pz - ps.fz) - ps.fyaw) * (1 - Math.exp(-7 * dt));
  P.aimK = 1; P.aimP = clamp(Math.atan2(py - 1.45, d), -.4, .4) + .18;   // 持槍瞄準的手臂（右手伸直、左手托著），手機夾在兩手中間、舉得比槍略高
  peds.anim(k, ANIM.aimIdle, 0, 1);
  ps.snapT += dt;
  if (ps.snapT > SNAP_T && !ps.snapDone) {
    ps.snapDone = 1; ai.stats.snapDone++;
    fxLights.push({ x: ps.fx + Math.sin(ps.fyaw) * .45, y: footY(ps.fx, ps.fz) + 1.55, z: ps.fz + Math.cos(ps.fyaw) * .45, col: FLASH_COL, r: 7, i: 3.2, life: 0, max: .14 });   // 閃光燈在手機的位置（手前 0.45 m）
    if (Math.hypot(ps.fx - camera.position.x, ps.fz - camera.position.z) < 25) sfx.click();
    if (ps.snapRep) { const r = ai.reps.find(o => o.rep === ps.snapRep); if (r) r.done = true; if (Math.random() < .5) sayPed(k, aiPick(L_SNAP)); }
    else if (Math.random() < .5) sayPed(k, aiPick(L_FUN));
  }
  if (ps.snapT > SNAP_T + SNAP_HOLD) { P.aimK = 0; ps.snapRep = null; pedResume(k, ps); return false; }
  peds.place(k, ps.fx, footY(ps.fx, ps.fz), ps.fz, ps.fyaw);
  return true;
}
// 手機：orbarts 的 Smartphone Highpoly（props/phone.glb，以 http(s) 開啟才下載）；之前與以檔案開啟用一塊黑色機身加亮螢幕
const PHONE_A = {};
const phoneFbGeo = (() => { const k = new Kit(); k.box(0, .075, 0, .07, .15, .009, 0x15171b, 3).box(0, .077, .0048, .063, .137, .001, 0xc8dcff, 8); return k.build(); })();
let phoneItem = null;
if (GLB_ON) loadProps('phone').then(items => { phoneItem = items && items.phone; if (phoneItem) for (const h of ai.phones) phoneSwap(h); });
function phoneSwap(h) {
  if (!phoneItem || h.userData.real) return;
  h.clear(); const o = propObject(phoneItem, 0, -.07, 0); h.add(o); h.userData.real = 1;
}
function aiPhone(i) {
  let h = ai.phones[i];
  if (!h) {
    h = new T.Group(); h.matrixAutoUpdate = false; h.userData.id = 'phone';
    const m = new T.Mesh(phoneFbGeo, MAT.uber); m.position.y = -.07; h.add(m);
    scene.add(h); ai.phones[i] = h; phoneSwap(h);
  }
  return h;
}
function phonesStep() {
  let n = 0;
  for (let k = 0; k < PED_N && n < SNAP_MAX; k++) {
    const ps = pedState[k], P = peds.people[k];
    if (ps.fsm !== 'snap' || ps.out || !P.sm) continue;
    _v9d.set(-Math.sin(ps.fyaw), 0, -Math.cos(ps.fyaw));   // 螢幕朝拍照的人、背面（鏡頭）朝前
    const h = aiPhone(n++);
    holdAt(h, P, PHONE_A, _v9d);   // 朝向照 _v9d；位置改到兩手中間
    boneW(P, 'hand_l', _v9p); boneW(P, 'hand_r', _v9q);
    h.matrix.setPosition(_v9p.add(_v9q).multiplyScalar(.5).addScaledVector(_v9d, -.03));
  }
  for (; n < ai.phones.length; n++) ai.phones[n].visible = false;
}
// 報案拍照的結算：拍的人都被打斷又沒人拍完，就把那筆報案拿掉
function repsStep() {
  for (let i = ai.reps.length - 1; i >= 0; i--) {
    const r = ai.reps[i], j = W.reports.indexOf(r.rep);
    if (j < 0 || r.done) { ai.reps.splice(i, 1); continue; }
    if (r.ks.every(k => pedState[k].fsm !== 'snap' || pedState[k].snapRep !== r.rep)) { W.reports.splice(j, 1); ai.reps.splice(i, 1); ai.stats.snapScared++; }
  }
}
function funSnaps(dt) {
  const v = player.veh;
  if (player.mode !== 'drive' || !v || !(v.burnout || v.air || vd.burnT > VD_HOLD_T)) { ai.funT = Math.min(ai.funT, .6); return; }
  if ((ai.funT -= dt) > 0) return;
  ai.funT = SNAP_FUN_IV;
  let b = -1, bd = SNAP_FUN_R;
  for (let k = 0; k < PED_N; k++) {
    const ps = pedState[k], p = peds.people[k];
    if (ps.out || ps.down > 0 || ps.fsm || ps.panic > 0) continue;
    const e = Math.hypot(p.x - v.x, p.z - v.z);
    if (e < bd && e > 6 && losClear(p.x, p.z, v.x, v.z)) { bd = e; b = k; }
  }
  if (b >= 0) snapStart(b, null);
}

// ─── 便衣尾隨：甩掉 2 星以上的通緝時有四成機率，一台沒有標誌的房車從後面的路口跟上來（在 25–45 m 外照你的速度跟），
// 被它看到犯罪直接 2 星、它變成追捕的警車；跟丟 8 秒（160 m 外）或 90 秒後放棄；玩家把它搶走就是搶車 ───
function tailStart(peak) {
  if (peak < TAIL_STAR || ai.tail || player.where !== 'out' || !ai.force && Math.random() > TAIL_P) return null;
  const sp = spawnSpot(70, 130); if (!sp) return null;
  const v = buildVeh(aiPick(SEDANS), sp.x, sp.z, sp.yaw, 8, Math.random(), Math.floor(Math.random() * 4), 'tail');
  v.y = spawnY(v.x, v.z); v.name = '沒有標誌的房車'; v.lights = 1;
  poseVehicle(v);
  ai.tail = { v, t: 0, lost: 0, field: null, fieldT: 0, goal: -1, gp: null, stuck: 0, rev: 0, revS: 1, hp0: v.hp, hint: 0, leave: false };
  ai.stats.tail++;
  return ai.tail;
}
function tailStep(dt) {
  const T = ai.tail; if (!T) return;
  const v = T.v;
  if (player.veh === v) { ai.tail = null; jacked.push(v); crime('jack', v.x, v.z); return; }
  if (v.dead) { ai.tail = null; return; }   // 打爛的車留在原地當殘骸（jacked 會收）
  const px = pX(), pz = pZ(), d = Math.hypot(px - v.x, pz - v.z);
  if (T.leave) {
    aiDrive(v, { thr: .8, brk: 0, steer: 0, hb: false }, dt);
    if (d > 140 || d > 60 && !onScreen(v.x, v.z)) tailDrop();
    return;
  }
  if (W.stars > 0) { tailBust(); return; }   // 別的原因又被通緝：便衣車直接加入追捕
  T.t += dt;
  T.lost = d > TAIL_LOSE ? T.lost + dt : 0;
  if (!T.hint && T.t > 6 && d < 70) { T.hint = 1; toast('後面那台房車跟了好幾個路口了…'); }
  if (T.lost > TAIL_LOSE_T || T.t > TAIL_T) { if (T.hint) toast(T.lost > TAIL_LOSE_T ? '甩掉那台便衣車了' : '那台房車轉進巷子不見了'); T.leave = true; return; }
  if (v.hp < T.hp0 - 40 && d < 30) { tailBust(); addHeat(CRIME.ramcop, TAIL_STAR); return; }   // 撞它：身分曝光
  // 路網：每秒最多重算一次距離場（rnField 沒有快取）
  const gp = rnProject(px, pz);
  T.fieldT -= dt;
  if (!T.field || T.fieldT <= 0 && gp.e.id !== T.goal) { T.fieldT = 1; T.goal = gp.e.id; T.field = fieldTo(gp); }
  const [tx, tz] = d > 28 || !losClear(v.x, v.z, px, pz) ? roadNext(v, T.field, gp, px, pz) : [px, pz];
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), vF = v.vx * fx + v.vz * fz;
  const pv = player.mode === 'drive' ? Math.hypot(player.veh.vx, player.veh.vz) : player.v || 0;
  const da = wrapA(Math.atan2(tx - v.x, tz - v.z) - v.yaw), ad = Math.abs(da);
  let want = d > TAIL_FAR ? v.vmax * .8 : d < TAIL_NEAR ? Math.max(0, pv - 3) : pv + 1.5;
  if (ad > 1.1) want = Math.min(want, 8); else if (ad > .45) want = Math.min(want, 15);
  let steer = clamp(da * 2.4, -1, 1), thr = 0, brk = 0;
  if (vF > want + 1) brk = clamp((vF - want) / 7, .3, 1); else if (vF < want) thr = ad > 1.8 ? .5 : 1;
  if (T.rev > 0) { T.rev -= dt; thr = 0; brk = 1; steer = -T.revS; }
  else if (thr > .3 && Math.abs(vF) < 1.2) { T.stuck += dt; if (T.stuck > 1.3) { T.rev = 1.2; T.revS = Math.sign(da) || 1; T.stuck = 0; } }
  else T.stuck = 0;
  aiDrive(v, { thr, brk, steer, hb: false }, dt);
  v.lights = 1;
}
// 69-police.js 的 crime 最前面問：便衣車 70 m 內看得到，直接 2 星
function tailCrime(x, z, n) {
  const T = ai.tail;
  if (!T || T.leave || T.v.dead || Math.hypot(T.v.x - x, T.v.z - z) > TAIL_SEE || !losClear(T.v.x, T.v.z, x, z)) return false;
  tailBust(); addHeat(n, TAIL_STAR);
  return true;
}
function tailBust() {
  const T = ai.tail; if (!T) return;
  ai.tail = null; ai.stats.tailBlown++;
  const v = T.v, u = { v, kind: 'car', state: 'chase', crew: 2, drive: true, stuck: 0, rev: 0, revS: 1, search: null, searchT: 0, out: false, t: 0, gunT: 4, quiet: 1, tail: 1 };
  v.unit = u; W.units.push(u);
  toast('那台房車是便衣警察！');
}
function tailDrop() {
  const T = ai.tail; if (!T) return;
  ai.tail = null;
  const v = T.v, k = vehicles.indexOf(v); if (k >= 0) vehicles.splice(k, 1);
  scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}

// ─── 每幀（99-main.js）───
function aiUpdate(dt) {
  ai.clk += dt;
  if (player.where === 'out') { tailStep(dt); funSnaps(dt); }
  repsStep();
  phonesStep();
  saysStep(dt);
}
gtaApi.ai = {
  ai, stats: ai.stats, nearPed: aiNearPed, greet: aiGreet, heckle: aiHeckle, snapWitness, snapStart, coverSpot,
  ped(k) { const ps = pedState[k], p = peds.people[k]; return { fsm: ps.fsm || null, talkN: ps.talkN || 0, tough: !!ps.tough, x: p.x, z: p.z, snapT: ps.snapT || 0, snapDone: !!ps.snapDone }; },
  tail(peak = 3) { ai.force = 1; const T = tailStart(peak); ai.force = 0; return !!T; },
  tailSt() { const T = ai.tail; return T && { x: T.v.x, z: T.v.z, t: T.t, lost: T.lost, leave: T.leave, d: Math.hypot(T.v.x - pX(), T.v.z - pZ()) }; },
  tailDrop, says: () => ai.says.map(s => s.text),
  cops: () => W.cops.filter(c => c.on).map(c => ({ k: c.k, x: c.x, z: c.z, cover: c.cover || null, jack: !!c.jackC, unit: W.units.indexOf(c.unit) })),
  units: () => W.units.map(u => ({ x: u.v.x, z: u.v.z, quiet: !!u.quiet, jack: !!u.jack, tail: !!u.tail, crew: u.crew, hold: !!u.hold, dead: !!u.v.dead, sp: Math.hypot(u.v.vx, u.v.vz) })),
  sirenNear: () => sirenNear,
};
