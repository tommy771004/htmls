// Gamepad（standard mapping）讀取與選單邊緣偵測。純邏輯：傳入類似 Gamepad 的物件即可測。

export const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

const bval = (pad, i) => {
  const b = pad && pad.buttons && pad.buttons[i];
  if (b == null) return 0;
  if (typeof b === 'number') return b;
  return b.pressed ? Math.max(b.value || 0, 1e-3) : (b.value || 0);
};
const bdown = (pad, i, th = 0.5) => {
  const b = pad && pad.buttons && pad.buttons[i];
  if (b == null) return false;
  if (typeof b === 'number') return b > th;
  return !!b.pressed || (b.value || 0) > th;
};
const axis = (pad, i) => {
  const a = pad && pad.axes ? pad.axes[i] : 0;
  return Number.isFinite(a) ? a : 0;
};

// 死區後重新縮放到 0..1
export function deadzone(v, dz) {
  const m = Math.abs(v);
  if (m <= dz) return 0;
  return Math.sign(v) * Math.min(1, (m - dz) / (1 - dz));
}

// 單幀讀值 → {steer, throttle, brake, nitro, start, active}
export function readPad(pad, dz = 0.15) {
  let steer = deadzone(axis(pad, 0), dz);
  if (bdown(pad, BTN.LEFT)) steer = -1;
  else if (bdown(pad, BTN.RIGHT)) steer = 1;
  // RT 類比優先，A 為數位油門
  let throttle = bval(pad, BTN.RT);
  if (bdown(pad, BTN.A)) throttle = 1;
  let brake = bval(pad, BTN.LT);
  if (bdown(pad, BTN.B)) brake = 1;
  // 扳機靜止時有些手把回報微小值
  if (throttle < 0.06) throttle = 0;
  if (brake < 0.06) brake = 0;
  const nitro = bdown(pad, BTN.X) || bdown(pad, BTN.RB);
  const start = bdown(pad, BTN.START);
  let active = steer !== 0 || throttle > 0 || brake > 0 || nitro || start;
  if (!active && pad && pad.buttons) {
    for (let i = 0; i < pad.buttons.length; i++) if (bdown(pad, i)) { active = true; break; }
    if (!active && Math.abs(axis(pad, 1)) > 0.5) active = true;
  }
  return { steer, throttle: Math.min(1, throttle), brake: Math.min(1, brake), nitro, start, active };
}

// 選單方向：十字鍵 + 左搖桿（遲滯），長按自動連發
const DIRS = ['up', 'down', 'left', 'right'];
export const REPEAT = { first: 0.42, every: 0.12 };

export function createPadTracker() {
  const prev = new Map();     // pad index → { held:{name:bool}, t:{dir:秒} }
  let current = -1;           // 目前採用的手把 index

  function menuState(pad, p) {
    const ax = axis(pad, 0), ay = axis(pad, 1);
    const wasX = p.held.left || p.held.right, wasY = p.held.up || p.held.down;
    const thX = wasX ? 0.35 : 0.6, thY = wasY ? 0.35 : 0.6;
    return {
      up: bdown(pad, BTN.UP) || ay < -thY,
      down: bdown(pad, BTN.DOWN) || ay > thY,
      left: bdown(pad, BTN.LEFT) || ax < -thX,
      right: bdown(pad, BTN.RIGHT) || ax > thX,
      confirm: bdown(pad, BTN.A),
      back: bdown(pad, BTN.B),
      menu: bdown(pad, BTN.START),
    };
  }

  // pads：navigator.getGamepads() 的結果（可含 null）。回傳 {input|null, index, id, menu:[事件名], active}
  function update(pads, dt, dz = 0.15) {
    const menu = [];
    const list = pads ? Array.from(pads) : [];
    const live = [];
    for (let i = 0; i < list.length; i++) {
      const pad = list[i];
      if (!pad || pad.connected === false) continue;
      live.push({ pad, idx: pad.index ?? i, r: readPad(pad, dz) });
    }
    // 拔掉的手把
    const seen = new Set(live.map((q) => q.idx));
    for (const k of [...prev.keys()]) if (!seen.has(k)) prev.delete(k);
    // 多支手把：目前手把沒在動、另一支有動作時換過去；目前手把不見了退回第一支
    const cur = live.find((q) => q.idx === current);
    if (!cur || !cur.r.active) {
      const act = live.find((q) => q.r.active);
      if (act) current = act.idx;
      else if (!cur) current = live.length ? live[0].idx : -1;
    }
    for (const { pad, idx } of live) {
      let p = prev.get(idx);
      if (!p) { p = { held: {}, t: {} }; prev.set(idx, p); }
      const m = menuState(pad, p);
      for (const k of ['confirm', 'back', 'menu']) {
        if (m[k] && !p.held[k]) menu.push(k);
      }
      for (const d of DIRS) {
        if (!m[d]) continue;
        if (!p.held[d]) { menu.push(d); p.t[d] = REPEAT.first; }
        else {
          p.t[d] = (p.t[d] ?? REPEAT.first) - (dt > 0 ? dt : 0);
          if (p.t[d] <= 0) { menu.push(d); p.t[d] = REPEAT.every; }
        }
      }
      p.held = m;
    }
    const ch = live.find((q) => q.idx === current);
    return { input: ch ? ch.r : null, index: ch ? ch.idx : -1, id: ch ? ch.pad.id : '', menu, active: !!(ch && ch.r.active) };
  }

  return { update, current: () => current, reset() { prev.clear(); current = -1; } };
}
