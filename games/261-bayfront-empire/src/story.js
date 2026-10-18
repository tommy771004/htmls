// 任務改版：角色委託（有對白、限時、選擇與許可證）、限時挑戰、每週任務、攝影與跟拍收藏。
// 主線任務（QUESTS）仍在 data.js、完成自動發獎；這裡的獎勵都要玩家按「領取」。純資料，不碰 DOM／three。
import { BIZ, BIZ_BY_ID, BEACH_IDS, ITEMS, ITEM_BY_ID, LANDMARK_BY_ID } from './data.js';
import { absMin } from './port.js';
import { avgRev, giveItems } from './items.js';

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const hourOf = (s) => (s.minute / 60) % 24;
const rnd1k = (v) => Math.max(1000, Math.round(v / 1000) * 1000);
const beachToday = (s) => BEACH_IDS.reduce((n, id) => n + (s.today.visits[id] || 0), 0);
const partyNow = (s) => { const h = hourOf(s); return s.event === 'party' && (h >= 18 || h < 3); };

// ───────── 角色委託 ─────────
// goal.k：serve（限定店家／條件下服務 n 位）、state（狀態成立）、hold（狀態持續 minutes 分）、
// count（某個累計數字比接受時多 n）、use（用掉 n 個道具）、contracts（完成 n 份合約，可要求零逾期）、choice（二選一）
// cond：sunny（晴天或熱浪）、heat、tier（平價中的店）、party（派對夜）
export const NPCS = [
  {
    id: 'mayor', name: '林市長', role: '灣岸市長', permit: '觀光許可', unlock: (s) => s.quest >= 3, lockText: '主線第 2 章完成後登場',
    look: { skin: '#e2b48f', hair: '#3a3a3a', style: 'side', shirt: '#24476b', acc: 'glasses', tie: '#b4513c' },
    steps: [
      { title: '讓大道熱鬧起來', say: '海濱大道最近冷清了點。六個小時內讓城市商家接待 60 位客人，我就在市議會替你說話。',
        goal: { k: 'serve', zone: 'city', n: 60, hours: 6 }, reward: { money: 40000, items: { temp: 2 } } },
      { title: '夜市還是摩天輪？', say: '市府今年只有一筆觀光補助。你想把它用在夜市，還是摩天輪？',
        goal: { k: 'choice', options: [{ id: 'market', label: '補助海濱夜市', note: '興建費 −40%' }, { id: 'ferris', label: '補助海灣摩天輪', note: '興建費 −40%' }] },
        reward: { money: 0 } },
      { title: '市容評比', say: '評審下週來看。讓顧客評分維持在 85 以上整整 6 個小時，觀光許可就是你的。',
        goal: { k: 'hold', what: 'rating85', minutes: 360 }, reward: { money: 100000, items: { influencer: 1 }, permit: 'mayor' } },
      { title: '封街派對', say: '表演台蓋好了吧？週五晚上我們封街辦派對，讓城市商家在派對夜接待 150 位客人。',
        req: (s) => !!(s.civic && s.civic.stage), reqText: '先蓋好公園街頭表演台',
        goal: { k: 'serve', zone: 'city', cond: 'party', n: 150 }, reward: { money: 300000, items: { fireworks: 2 } } },
    ],
  },
  {
    id: 'harbor', name: '陳港務長', role: '灣岸海港港務長', permit: '遊艇泊位許可', unlock: (s) => s.port.lv >= 1, lockText: '開設海港後登場',
    look: { skin: '#c99272', hair: '#d8d2c4', style: 'short', shirt: '#f4f1e6', acc: 'cap', tie: '#24476b' },
    steps: [
      { title: '急件', say: '有批貨今晚就要。12 個小時內完成一份貨運合約，加班的岸橋我來安排。',
        goal: { k: 'contracts', n: 1, hours: 12 }, reward: { money: 50000, items: { overtime: 2 } } },
      { title: '準時是信用', say: '港口靠的是信用。連續完成 3 份合約，一份都不能逾期。',
        goal: { k: 'contracts', n: 3, noLate: true }, reward: { money: 250000, items: { airfreight: 1 } } },
      { title: '空運救急', say: '船期總有趕不上的時候。用一次急件空運，讓我看看你的應變。',
        goal: { k: 'use', item: 'airfreight', n: 1 }, reward: { money: 150000, permit: 'harbor' } },
    ],
  },
  {
    id: 'coach', name: '阿浪教練', role: '白浪衝浪學校教練', permit: '海灘救生許可', unlock: (s) => s.biz.surf.lv >= 1, lockText: '開設衝浪學校後登場',
    look: { skin: '#b97a55', hair: '#e2b84a', style: 'long', shirt: '#2f7f8f', acc: 'shades' },
    steps: [
      { title: '晴天衝浪課', say: '浪況正好！10 個小時內，在晴天或熱浪天帶 12 位學生下水。',
        goal: { k: 'serve', ids: ['surf'], cond: 'sunny', n: 12, hours: 10 }, reward: { money: 60000, items: { fireworks: 1 } } },
      { title: '熱浪大賽', say: '熱浪來的時候大家都想衝浪。在熱浪天讓衝浪學校服務 8 位客人。',
        goal: { k: 'serve', ids: ['surf'], cond: 'heat', n: 8 }, reward: { money: 150000, items: { heater: 1 } } },
      { title: '安全第一', say: '人一多就要有人看著。讓海灘商家在同一天服務 150 位客人，我去申請救生員塔。',
        goal: { k: 'state', what: 'beach150' }, reward: { money: 120000, permit: 'coach' } },
    ],
  },
  {
    id: 'resident', name: '王太太', role: '公寓住戶代表', permit: '社區停車場同意書', unlock: (s) => Object.values(s.apts).some((v) => v > 0), lockText: '買下第一棟公寓後登場',
    look: { skin: '#f0c7a2', hair: '#8a8a8a', style: 'bun', shirt: '#c0607a', acc: 'earring' },
    steps: [
      { title: '平價咖啡', say: '住戶都說咖啡太貴。把轉角咖啡館改成平價，服務 30 位客人吧。',
        goal: { k: 'serve', ids: ['cafe'], cond: 'tier', n: 30 }, reward: { money: 50000, items: { shuttle: 1 } } },
      { title: '老房子翻新', say: '我們那棟樓的水管會唱歌。翻修任何一棟公寓到 Lv2，大家會很感激的。',
        goal: { k: 'state', what: 'aptLv2' }, reward: { money: 120000, items: { booking: 1 } } },
      { title: '社區市集', say: '用預約券辦一場活動，鄰居都會來。之後停車場的事，我們同意。',
        goal: { k: 'use', item: 'booking', n: 1 }, reward: { money: 150000, permit: 'resident' } },
    ],
  },
  {
    id: 'rivalboss', name: '江董', role: '黑潮集團董事長', unlock: (s) => !!s.rival || (s.stats.rivals || 0) > 0, lockText: '第一個競爭對手出現後登場',
    look: { skin: '#e0b08a', hair: '#1f1f1f', style: 'slick', shirt: '#2a2f3a', acc: 'none', tie: '#ff4f6d' },
    steps: [
      { title: '下戰書', say: '對街那家店是我的。有本事就把它趕走。',
        goal: { k: 'count', what: 'rivals', n: 1 }, reward: { money: 80000, items: { flyer: 2 } } },
      { title: '價格戰', say: '低價誰不會？一天之內讓平價中的店服務 80 位客人，我就認真看你。',
        goal: { k: 'serve', cond: 'tier', n: 80, hours: 24 }, reward: { money: 200000 } },
      { title: '最後談判', say: '我們別再互相消耗了。$4M，黑潮集團旗下的店全部歸你，以後灣岸不會再有對手。',
        goal: { k: 'choice', options: [{ id: 'buy', label: '收購黑潮集團', note: '$4M，之後不會再有競爭對手', cost: 4000000 }] }, reward: { money: 0, rating: 5 } },
    ],
  },
];
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));
export const SUBSIDY = 0.4;

const STATES = {
  rating85: (s) => s.rating >= 85,
  beach150: (s) => beachToday(s) >= 150,
  aptLv2: (s) => Object.values(s.apts).some((v) => v >= 2),
};
const COUNTS = { rivals: (s) => s.stats.rivals || 0 };

function serveMatch(s, g, id) {
  const def = BIZ_BY_ID[id];
  if (g.ids && !g.ids.includes(id)) return false;
  if (g.zone && def.zone !== g.zone) return false;
  if (g.cond === 'sunny' && s.weather.cur !== 'sunny' && s.weather.cur !== 'heat') return false;
  if (g.cond === 'heat' && s.weather.cur !== 'heat') return false;
  if (g.cond === 'tier' && s.biz[id].tier !== -1) return false;
  if (g.cond === 'party' && !partyNow(s)) return false;
  return true;
}

export const npcState = (s, id) => s.story[id] || (s.story[id] = { step: 0, on: false, prog: 0, base: 0, base2: 0, until: 0, ready: false, held: 0 });
// 角色目前的狀態：locked、wait（這一步有前置條件）、new（可以接）、on、ready、done
export function npcStatus(s, id) {
  const n = NPC_BY_ID[id], st = npcState(s, id);
  if (st.step >= n.steps.length) return 'done';
  if (!n.unlock(s)) return 'locked';
  const step = n.steps[st.step];
  if (st.ready) return 'ready';
  if (st.on) return 'on';
  if (step.req && !step.req(s)) return 'wait';
  return 'new';
}
export const npcStep = (s, id) => NPC_BY_ID[id].steps[npcState(s, id).step];
export function npcProgress(s, id) {
  const st = npcState(s, id), g = npcStep(s, id).goal;
  if (!st.on && !st.ready) return { cur: 0, goal: g.n || (g.minutes ? g.minutes : 1) };
  switch (g.k) {
    case 'serve': return { cur: st.prog, goal: g.n };
    case 'contracts': return { cur: s.port.stats.contracts - st.base, goal: g.n };
    case 'use': return { cur: (s.used[g.item] || 0) - st.base, goal: g.n };
    case 'count': return { cur: COUNTS[g.what](s) - st.base, goal: g.n };
    case 'hold': return { cur: st.held ? Math.min(g.minutes, absMin(s) - st.held) : 0, goal: g.minutes };
    case 'state': return { cur: STATES[g.what](s) ? 1 : 0, goal: 1 };
    default: return { cur: 0, goal: 1 };
  }
}
export function acceptNpc(s, id) {
  if (npcStatus(s, id) !== 'new') return false;
  const st = npcState(s, id), g = npcStep(s, id).goal;
  if (g.k === 'choice') return false;
  st.on = true;
  st.prog = 0;
  st.held = 0;
  st.until = g.hours ? absMin(s) + g.hours * 60 : 0;
  st.base = g.k === 'contracts' ? s.port.stats.contracts : g.k === 'use' ? (s.used[g.item] || 0) : g.k === 'count' ? COUNTS[g.what](s) : 0;
  st.base2 = s.port.stats.late;
  return true;
}
// 選擇題：直接完成這一步（收購要付錢）
export function chooseNpc(s, id, opt) {
  if (npcStatus(s, id) !== 'new') return false;
  const st = npcState(s, id), step = npcStep(s, id), o = step.goal.k === 'choice' && step.goal.options.find((x) => x.id === opt);
  if (!o) return false;
  if (o.cost) {
    if (s.money < o.cost) return false;
    s.money -= o.cost;
    s.today.buy += o.cost;
  }
  if (id === 'mayor') {
    // 選的地標已經蓋好了：補助改發現金
    const m = LANDMARK_BY_ID[opt];
    if (s.marks[opt]) { s.money += Math.round(m.cost * SUBSIDY); s.stats.earned += Math.round(m.cost * SUBSIDY); } else s.subsidy = opt;
  }
  if (id === 'rivalboss' && opt === 'buy') {
    s.rivalNext = 1e9;
    if (s.rival) { s.rival = null; s.stats.rivals = (s.stats.rivals || 0) + 1; }
  }
  st.choice = opt;
  st.ready = true;
  return claimNpc(s, id);
}
export function claimNpc(s, id) {
  const st = npcState(s, id);
  if (!st.ready) return false;
  const r = npcStep(s, id).reward;
  payReward(s, r);
  if (r.permit) s.permits[r.permit] = s.day;
  st.step += 1;
  st.on = false;
  st.ready = false;
  st.prog = 0;
  st.held = 0;
  s.stats.story = (s.stats.story || 0) + 1;
  return r;
}
function payReward(s, r) {
  if (r.money) s.money += r.money;
  if (r.items) giveItems(s, r.items);
  if (r.rating) s.rating = Math.min(100, s.rating + r.rating);
}
export const landmarkCost = (s, m) => (s.subsidy === m.id ? Math.round(m.cost * (1 - SUBSIDY)) : m.cost);

// ───────── 限時挑戰 ─────────
export const CHAL = { offerMin: 45, gapMin: [300, 540], startQuest: 2 };
const commonItems = ITEMS.filter((i) => !i.rare && !i.port && !i.rival && !i.hours);
function expectServe(s, id, minutes, arrive) {
  const def = BIZ_BY_ID[id], lv = s.biz[id].lv, cap = def.cap[lv - 1];
  return Math.min(arrive * minutes, (cap * minutes) / def.stay);
}
// arrive(id) 由 econ 傳進來（避免互相 import）
export function makeChallenge(s, rand, arrive, priceOf) {
  const h = hourOf(s), now = absMin(s);
  const own = BIZ.filter((b) => s.biz[b.id].lv && arrive(b.id) > 0.02);
  const kinds = [];
  if (own.length) kinds.push('shop', 'rev');
  if (BEACH_IDS.some((id) => s.biz[id].lv && arrive(id) > 0.02) && h >= 9 && h < 15) kinds.push('beach');
  if (s.biz.bar.lv && h >= 15 && h < 17.5) kinds.push('night');
  if (own.length >= 3 && h >= 9 && h < 20) kinds.push('calm');
  if (!kinds.length) return null;
  const k = kinds[Math.floor(rand(s) * kinds.length)];
  const reward = rnd1k(Math.max(12000, avgRev(s) * 0.025));
  const item = commonItems[Math.floor(rand(s) * commonItems.length)].id;
  const c = { k, offerUntil: now + CHAL.offerMin, reward, item, state: 'offer', start: 0, end: 0, base: 0 };
  if (k === 'shop') {
    const b = own[Math.floor(rand(s) * own.length)];
    c.id = b.id;
    c.goal = Math.max(4, Math.round(expectServe(s, b.id, 120, arrive(b.id)) * 1.1));
    c.minutes = 120;
  } else if (k === 'rev') {
    let e = 0;
    for (const b of own) e += expectServe(s, b.id, 180, arrive(b.id)) * priceOf(b.id);
    c.goal = rnd1k(e * 1.15);
    c.minutes = 180;
  } else if (k === 'beach') {
    let e = 0;
    for (const id of BEACH_IDS) if (s.biz[id].lv) e += expectServe(s, id, 120, arrive(id));
    c.goal = Math.max(6, Math.round(e * 1.1));
    c.minutes = 120;
  } else if (k === 'night') {
    c.id = 'bar';
    const def = BIZ_BY_ID.bar;
    c.goal = Math.max(8, Math.round(((def.cap[s.biz.bar.lv - 1] * 360) / def.stay) * 0.45));
    c.minutes = 360;
    c.at = now - s.minute + 18 * 60; // 從今晚 18:00 開始算
  } else {
    // 2 小時內拒客不超過今天平均的 35%
    const turned = Object.values(s.today.turned).reduce((x, y) => x + y, 0);
    const rate = turned / Math.max(60, s.minute - 360);
    c.goal = 120;
    c.limit = Math.max(2, Math.round(rate * 120 * 0.35));
    c.minutes = 120;
  }
  return c;
}
export function chalText(c) {
  switch (c.k) {
    case 'shop': return `${c.minutes / 60} 小時內${BIZ_BY_ID[c.id].name}服務 ${c.goal} 位客人`;
    case 'rev': return `${c.minutes / 60} 小時內營收 $${c.goal.toLocaleString('en-US')}`;
    case 'beach': return `${c.minutes / 60} 小時內海灘商家服務 ${c.goal} 位客人`;
    case 'night': return `今晚 18 點到午夜，燈塔酒吧服務 ${c.goal} 位客人`;
    case 'calm': return `接下來 2 小時全城拒客不超過 ${c.limit} 位`;
    default: return '';
  }
}
const chalCounter = (s, c) => {
  switch (c.k) {
    case 'shop': case 'night': return s.biz[c.id].visits;
    case 'rev': return s.stats.earned;
    case 'beach': return BEACH_IDS.reduce((n, id) => n + s.biz[id].visits, 0);
    case 'calm': return s.stats.turned;
    default: return 0;
  }
};
export function acceptChallenge(s) {
  const c = s.chal;
  if (!c || c.state !== 'offer') return false;
  const now = absMin(s);
  c.state = 'on';
  c.start = c.at && c.at > now ? c.at : now;
  c.end = c.start + c.minutes;
  c.base = c.start > now ? null : chalCounter(s, c);
  return true;
}
export function chalProgress(s) {
  const c = s.chal;
  if (!c || c.state === 'offer' || c.base === null) return { cur: 0, goal: c ? c.goal : 1 };
  if (c.k === 'calm') return { cur: Math.min(c.goal, Math.max(0, absMin(s) - c.start)), goal: c.goal };
  return { cur: Math.min(c.goal, chalCounter(s, c) - c.base), goal: c.goal };
}
export function claimChallenge(s) {
  const c = s.chal;
  if (!c || c.state !== 'ready') return false;
  s.money += c.reward;
  giveItems(s, { [c.item]: 1 });
  s.stats.chals = (s.stats.chals || 0) + 1;
  s.chal = null;
  return true;
}
function stepChallenge(s, rand, ev, arrive, priceOf) {
  const now = absMin(s), c = s.chal;
  if (!c) {
    if (s.quest < CHAL.startQuest) return;
    if (!s.chalNext) s.chalNext = now + 120;
    if (now < s.chalNext) return;
    s.chalNext = now + CHAL.gapMin[0] + Math.floor(rand(s) * (CHAL.gapMin[1] - CHAL.gapMin[0]));
    const n = makeChallenge(s, rand, arrive, priceOf);
    if (n) { s.chal = n; ev.push({ type: 'chal', text: chalText(n) }); }
    return;
  }
  if (c.state === 'offer' && now > c.offerUntil) { s.chal = null; return; }
  if (c.state === 'fail' && now > c.end + 60) { s.chal = null; return; }
  if (c.state !== 'on') return;
  if (c.base === null) { if (now >= c.start) c.base = chalCounter(s, c); else return; }
  if (c.k === 'calm') {
    if (s.stats.turned - c.base > c.limit) { c.state = 'fail'; ev.push({ type: 'chalFail', text: chalText(c) }); return; }
    if (now >= c.end) { c.state = 'ready'; ev.push({ type: 'chalDone', text: chalText(c) }); }
    return;
  }
  if (chalCounter(s, c) - c.base >= c.goal) { c.state = 'ready'; ev.push({ type: 'chalDone', text: chalText(c) }); return; }
  if (now >= c.end) { c.state = 'fail'; ev.push({ type: 'chalFail', text: chalText(c) }); }
}

// ───────── 每週任務 ─────────
export const weekOf = (s) => Math.floor((s.day - 1) / 7);
const sumWeek = (s) => {
  const w0 = weekOf(s) * 7 + 1;
  let t = 0;
  for (const h of s.history) if (h.day >= w0) t += h.rev;
  for (const k in s.today.rev) t += s.today.rev[k];
  return t;
};
export function newWeekly(s) {
  const avg = avgRev(s);
  const reward = (m = 1) => rnd1k(Math.max(50000, avg * 0.12) * m);
  const tasks = [
    { k: 'wrev', goal: rnd1k(Math.max(150000, avg * 7 * 0.98)), reward: reward(1.5) },
    { k: 'daily', base: s.stats.daily || 0, goal: 8, reward: reward() },
    { k: 'items', base: s.stats.items || 0, goal: 3, reward: reward(0.8) },
    { k: 'r80', goal: 3, reward: reward() },
    { k: 'zero', goal: 1, min: Math.max(40, Math.round((s.history.at(-1)?.visits || 60) * 0.5)), reward: reward(1.2) },
  ];
  if (s.port.lv) tasks.push({ k: 'contracts', base: s.port.stats.contracts, goal: 3, reward: reward() });
  s.weekly = { week: weekOf(s), tasks: tasks.map((t) => ({ ...t, done: false, claimed: false })), r80: 0, zero: 0 };
}
export function weeklyProgress(s, t) {
  const w = s.weekly;
  switch (t.k) {
    case 'wrev': return Math.round(sumWeek(s));
    case 'daily': return (s.stats.daily || 0) - t.base;
    case 'items': return (s.stats.items || 0) - t.base;
    case 'r80': return w.r80;
    case 'zero': return w.zero;
    case 'contracts': return s.port.stats.contracts - t.base;
    default: return 0;
  }
}
export function weeklyText(t) {
  switch (t.k) {
    case 'wrev': return `本週營收 $${t.goal.toLocaleString('en-US')}`;
    case 'daily': return `本週完成 ${t.goal} 個每日任務`;
    case 'items': return `本週使用 ${t.goal} 個道具`;
    case 'r80': return '連續 3 天收盤評分 80 以上';
    case 'zero': return `一整天拒客率低於 12%（至少服務 ${t.min} 位）`;
    case 'contracts': return `本週完成 ${t.goal} 份貨運合約`;
    default: return '';
  }
}
export function claimWeekly(s, i) {
  const t = s.weekly && s.weekly.tasks[i];
  if (!t || !t.done || t.claimed) return false;
  t.claimed = true;
  s.money += t.reward;
  s.stats.weekly = (s.stats.weekly || 0) + 1;
  return true;
}

// ───────── 攝影與跟拍收藏（判定在畫面層，這裡只存結果） ─────────
export const SHOTS = [
  { id: 'beams', name: '燈塔與摩天輪', hint: '晚上讓燈塔光束和摩天輪同時入鏡', reward: 120000 },
  { id: 'umbrellas', name: '雨天的傘', hint: '下雨時拍到街上至少 8 把傘', reward: 60000 },
  { id: 'fireworks', name: '海上煙火', hint: '煙火秀進行中，把煙火拍進畫面', reward: 100000 },
  { id: 'club', name: '夜店舞池', hint: '晚上 8 點到凌晨 3 點，放大拍 Lv3 酒吧的舞池', reward: 80000 },
  { id: 'tower', name: '三層樓的生意', hint: '三層疊樓都開業時，把整棟拍進畫面', reward: 80000 },
  { id: 'sunrise', name: '海上日出', hint: '清晨 5 點半到 7 點，鏡頭對著海', reward: 60000 },
  { id: 'yacht', name: '帝國號出航', hint: '把巡航中的帝國號拍進畫面', reward: 150000 },
  { id: 'mascot', name: '浪浪散步', hint: '拍到在步道上散步的吉祥物', reward: 60000 },
];
export const FOLLOWS = [
  { id: 'upstairs', name: '搭電梯上樓', hint: '跟拍一位客人，直到他在樓上的店坐下', reward: 60000 },
  { id: 'umbrella', name: '傘下午睡', hint: '跟拍一位海灘客，直到他在遮陽傘下躺好', reward: 50000 },
  { id: 'boat', name: '出海一趟', hint: '跟拍一位租船客出海再回到碼頭', reward: 90000 },
  { id: 'mascot', name: '浪浪的一天', hint: '跟拍吉祥物 30 秒', reward: 50000 },
];
// 收藏的狀態：1 已達成待領、2 已領取
export function markShot(s, kind, id) {
  const box = kind === 'shot' ? s.shots : s.follows;
  if (box[id]) return false;
  box[id] = 1;
  return true;
}
export function claimShot(s, kind, id) {
  const box = kind === 'shot' ? s.shots : s.follows;
  const def = (kind === 'shot' ? SHOTS : FOLLOWS).find((x) => x.id === id);
  if (!def || box[id] !== 1) return false;
  box[id] = 2;
  s.money += def.reward;
  return true;
}

// ───────── 掛鉤：econ 在服務、每 tick、跨日時呼叫 ─────────
export function storyServe(s, id) {
  for (const n of NPCS) {
    const st = s.story[n.id];
    if (!st || !st.on || st.ready) continue;
    const g = n.steps[st.step].goal;
    if (g.k === 'serve' && serveMatch(s, g, id)) st.prog++;
  }
}
export function checkStory(s, rand, ev, arrive, priceOf) {
  const now = absMin(s);
  for (const n of NPCS) {
    const st = npcState(s, n.id);
    if (st.step >= n.steps.length) continue;
    if (!st.seen && n.unlock(s)) { st.seen = true; ev.push({ type: 'npc', id: n.id, name: n.name }); }
    if (!st.on || st.ready) continue;
    const g = n.steps[st.step].goal;
    if (g.k === 'contracts' && g.noLate && s.port.stats.late > st.base2) {
      // 有一份逾期：從頭算
      st.base = s.port.stats.contracts;
      st.base2 = s.port.stats.late;
      ev.push({ type: 'npcReset', id: n.id, name: n.name });
    }
    if (g.k === 'hold') {
      if (STATES[g.what](s)) { if (!st.held) st.held = now; } else st.held = 0;
    }
    const p = npcProgress(s, n.id);
    if (p.cur >= p.goal) { st.ready = true; ev.push({ type: 'npcReady', id: n.id, name: n.name, title: n.steps[st.step].title }); continue; }
    if (st.until && now > st.until) {
      st.on = false;
      st.prog = 0;
      ev.push({ type: 'npcFail', id: n.id, name: n.name, title: n.steps[st.step].title });
    }
  }
  stepChallenge(s, rand, ev, arrive, priceOf);
  if (!s.weekly || s.weekly.week !== weekOf(s)) newWeekly(s);
  for (const t of s.weekly.tasks) {
    if (t.done) continue;
    if (weeklyProgress(s, t) >= t.goal) { t.done = true; ev.push({ type: 'weekly', text: weeklyText(t) }); }
  }
}
// 跨日（在 today 清空之前）：每週的零拒客與評分連續天數、每日任務連續完成
export function storyDayEnd(s) {
  if (!s.weekly || s.weekly.week !== weekOf(s)) newWeekly(s);
  const w = s.weekly;
  const turned = Object.values(s.today.turned).reduce((a, b) => a + b, 0);
  const visits = Object.values(s.today.visits).reduce((a, b) => a + b, 0);
  const z = w.tasks.find((t) => t.k === 'zero');
  // 拒客率低於 12%：客滿是常態，要靠臨時工、外送與點餐機壓下來
  if (z && visits >= z.min && turned / (turned + visits) < 0.12) w.zero++;
  w.r80 = s.rating >= 80 ? w.r80 + 1 : 0;
  const all = s.daily && s.daily.day === s.day && s.daily.tasks.length && s.daily.tasks.every((t) => t.done);
  s.streak = all ? (s.streak || 0) + 1 : 0;
  s.stats.streakBest = Math.max(s.stats.streakBest || 0, s.streak);
}

// ───────── 存檔 ─────────
export function newStory() {
  return { story: {}, subsidy: null, chal: null, chalNext: 0, weekly: null, streak: 0, shots: {}, follows: {} };
}
export function sanitizeStory(raw, s) {
  const r = raw && typeof raw === 'object' ? raw : {};
  for (const n of NPCS) {
    const v = r.story && r.story[n.id];
    if (!v || typeof v !== 'object') continue;
    const st = npcState(s, n.id);
    st.step = Math.max(0, Math.min(n.steps.length, Math.round(num(v.step, 0))));
    st.seen = !!v.seen;
    if (st.step < n.steps.length) {
      const g = n.steps[st.step].goal;
      st.on = !!v.on && g.k !== 'choice';
      st.ready = !!v.ready;
      st.prog = Math.max(0, Math.round(num(v.prog, 0)));
      st.base = num(v.base, 0);
      st.base2 = num(v.base2, 0);
      st.until = num(v.until, 0);
      st.held = num(v.held, 0);
    }
    if (typeof v.choice === 'string') st.choice = v.choice;
  }
  if (r.subsidy === 'market' || r.subsidy === 'ferris') s.subsidy = r.subsidy;
  const c = r.chal;
  if (c && typeof c === 'object' && ['shop', 'rev', 'beach', 'night', 'calm'].includes(c.k) && ['offer', 'on', 'ready', 'fail'].includes(c.state)
    && typeof c.goal === 'number' && (!c.id || BIZ_BY_ID[c.id]) && ITEM_BY_ID[c.item]) {
    s.chal = { k: c.k, id: c.id, goal: c.goal, minutes: num(c.minutes, 120), reward: num(c.reward, 12000), item: c.item, state: c.state,
      offerUntil: num(c.offerUntil, 0), limit: num(c.limit, 3), start: num(c.start, 0), end: num(c.end, 0), base: c.base === null ? null : num(c.base, 0), at: num(c.at, 0) || undefined };
  }
  s.chalNext = num(r.chalNext, 0);
  const w = r.weekly;
  if (w && typeof w === 'object' && w.week === weekOf(s) && Array.isArray(w.tasks)) {
    const ok = ['wrev', 'daily', 'items', 'r80', 'zero', 'contracts'];
    s.weekly = {
      week: w.week, r80: Math.max(0, Math.round(num(w.r80, 0))), zero: Math.max(0, Math.round(num(w.zero, 0))),
      tasks: w.tasks.filter((t) => t && ok.includes(t.k) && typeof t.goal === 'number').slice(0, 8)
        .map((t) => ({ k: t.k, goal: t.goal, base: num(t.base, 0), min: num(t.min, 40), reward: num(t.reward, 50000), done: !!t.done, claimed: !!t.claimed })),
    };
  }
  s.streak = Math.max(0, Math.round(num(r.streak, 0)));
  for (const [k, v] of Object.entries(r.shots || {})) if (SHOTS.some((x) => x.id === k) && (v === 1 || v === 2)) s.shots[k] = v;
  for (const [k, v] of Object.entries(r.follows || {})) if (FOLLOWS.some((x) => x.id === k) && (v === 1 || v === 2)) s.follows[k] = v;
}
