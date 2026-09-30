// 鍵盤對應與轉向爬升。純邏輯，不碰 DOM。

export const KEY_ACTION = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'throttle', KeyW: 'throttle',
  ArrowDown: 'brake', KeyS: 'brake',
  Space: 'nitro', ShiftLeft: 'nitro', ShiftRight: 'nitro',
};

// 選單導覽（onMenu）用
export const KEY_MENU = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Enter: 'confirm', NumpadEnter: 'confirm',
  Escape: 'back', Backspace: 'back',
  KeyP: 'menu',
};

// 遊戲中要擋掉預設捲動的鍵
export const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export const RAMP = { rise: 4.2, fall: 7.5, cross: 12 };

// 數位方向（−1/0/+1）→ 平滑 steer：按住爬升、放開回中較快、反向時先快速過零
export function rampSteer(cur, dir, dt, r = RAMP) {
  if (!(dt > 0)) return cur;
  if (dir === 0) {
    const d = r.fall * dt;
    return Math.abs(cur) <= d ? 0 : cur - Math.sign(cur) * d;
  }
  if (cur !== 0 && Math.sign(cur) !== Math.sign(dir)) {
    const d = r.cross * dt;
    return Math.abs(cur) <= d ? 0 : cur - Math.sign(cur) * d;
  }
  const next = cur + dir * r.rise * dt;
  return dir > 0 ? Math.min(1, next) : Math.max(-1, next);
}

export function isTextTarget(t) {
  if (!t || !t.tagName) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t.isContentEditable;
}

// 多個來源合併：steer 取絕對值最大者（保留正負），油門/煞車取最大，氮氣取 OR
export function combine(list) {
  let steer = 0, throttle = 0, brake = 0, nitro = false;
  for (const s of list) {
    if (!s) continue;
    if (Math.abs(s.steer || 0) > Math.abs(steer)) steer = s.steer;
    if ((s.throttle || 0) > throttle) throttle = s.throttle;
    if ((s.brake || 0) > brake) brake = s.brake;
    if (s.nitro) nitro = true;
  }
  return { steer: Math.max(-1, Math.min(1, steer)), throttle: Math.min(1, throttle), brake: Math.min(1, brake), nitro };
}
