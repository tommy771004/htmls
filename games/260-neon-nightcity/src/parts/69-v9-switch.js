// ═══ 切換角色小劇場（HANDOFF 的「切換角色小劇場」）：Q 轉盤換人時，鏡頭從高空降下來看到那位主角正在做自己的事
// （抽菸、講電話、跟技師吵架、聽歌跳舞、對空氣出拳、跟買家談價錢），頭上一句台詞，有些有一位配角對話；
// 一動（移動、瞄準、上車）就結束。69-crew.js 的 crewCam 在換人那一刻呼叫 vigStart，40-people.js 照 player.vig 播動作 ───
const VIG_T = 6, VIG_SAY = 1.15, VIG_REPLY = 1.4, VIG_NPC_R = 1.5, VIG_NPC_LEAVE = 25;   // 台詞在降落中段（換人後約 1.15 秒）出現；配角 25 m 外或 20 秒後離場
const VIGS = {
  vance: [
    { anim: ANIM.smoke, say: '又是一個睡不著的晚上。' },
    { anim: ANIM.phone, say: '我說過了，我已經退休了。', then: '…別再打這支號碼。' },
    { anim: ANIM.kneel, say: '這雙鞋陪我跑過三個國家。' },
  ],
  kael: [
    { anim: ANIM.talk, say: '這台的離合器我說過三次了！', npc: { anim: ANIM.talk, say: '老闆，零件還沒到啊。' } },
    { anim: ANIM.danceB, say: '這首我可以聽一整晚。' },
    { anim: ANIM.crouch, say: '胎紋又吃光了…' },
  ],
  jax: [
    { anim: ANIM.punch, say: '熱身一下，等等有客人。' },
    { anim: ANIM.talk, say: '貨在後車廂，錢先拿來。', npc: { anim: ANIM.cross, say: '急什麼，我又不會跑。' } },
    { anim: ANIM.cross, say: '少了兩捆…有人要倒楣了。' },
  ],
};
const vig = { on: null, last: {}, npc: null, n: 0 };
const vigCrowd = crowd(1);
scene.add(vigCrowd.mesh);
vigCrowd.place(0, 0, -60, 0, 0);
function vigStart(i) {
  const id = CREW[i].id, L = VIGS[id];
  let k = Math.floor(Math.random() * L.length);
  if (k === vig.last[id] && L.length > 1) k = (k + 1) % L.length;   // 不連續兩次同一齣
  vig.last[id] = k;
  const V = L[k];
  vigEnd(true);
  vig.on = { V, t: 0, said: 0, i };
  player.vig = V.anim; player.dance = 0;
  if (V.npc) {
    // 配角站在主角面前 1.5 m、面對面（推出牆外）
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    const r = collideCircle(player.x + fx * VIG_NPC_R, player.z + fz * VIG_NPC_R, .3, false);
    vigCrowd.look(0, { r: rng(77 + vig.n++) });
    vig.npc = { x: r.x, z: r.z, yaw: Math.atan2(player.x - r.x, player.z - r.z), anim: V.npc.anim, t: 0, leave: false };
  }
  vig.n++;
}
// quiet：換到下一齣或驗收重設時，配角直接收掉
function vigEnd(quiet) {
  if (vig.on) { vig.on = null; if (player.vig) player.vig = 0; }
  if (vig.npc && quiet) { vig.npc = null; vigCrowd.place(0, 0, -60, 0, 0); }
  else if (vig.npc) vig.npc.leave = true;
}
function vigUpdate(dt) {
  const o = vig.on;
  if (o) {
    o.t += dt;
    // 動了就結束（40-people.js 移動時把 player.vig 歸零）；上車、進室內、瞄準、時間到也是
    if (!player.vig || player.mode !== 'walk' || player.where !== 'out' || gta.aiming || life.dead || o.t > VIG_T + VIG_SAY) vigEnd();
    else {
      if (o.said === 0 && o.t > VIG_SAY) { o.said = 1; sayMe(o.V.say); }
      if (o.said === 1 && o.t > VIG_SAY + VIG_REPLY) {
        o.said = 2;
        if (o.V.npc) aiSay('vig', () => [vig.npc ? vig.npc.x : player.x, footY(vig.npc ? vig.npc.x : player.x, vig.npc ? vig.npc.z : player.z) + 1.95, vig.npc ? vig.npc.z : player.z], o.V.npc.say);
        else if (o.V.then) sayMe(o.V.then);
      }
    }
  }
  const n = vig.npc;
  if (!n) return;
  n.t += dt;
  if (n.leave) {
    // 離場：轉身走開，走遠或過了 20 秒收掉
    n.yaw += wrapA(Math.atan2(n.x - player.x, n.z - player.z) - n.yaw) * (1 - Math.exp(-4 * dt));
    const r = collideCircle(n.x + Math.sin(n.yaw) * 1.4 * dt, n.z + Math.cos(n.yaw) * 1.4 * dt, .3, false); n.x = r.x; n.z = r.z;
    vigCrowd.anim(0, ANIM.walk, n.t, 1);
    if (Math.hypot(n.x - player.x, n.z - player.z) > VIG_NPC_LEAVE || n.t > 20 || player.where !== 'out') { vig.npc = null; vigCrowd.place(0, 0, -60, 0, 0); return; }
  } else vigCrowd.anim(0, n.anim, n.t, 1);
  vigCrowd.place(0, n.x, footY(n.x, n.z), n.z, n.yaw);
}
gtaApi.vig = { st: vig, VIGS, start: vigStart, end: () => vigEnd(true), T: VIG_T, SAY: VIG_SAY };
