/* store · collections、CRUD（可復原）、訂閱、localStorage 持久化、selectors 與 actions */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const U = CRM.util;
  const S = CRM.seed;

  /* ── event bus ───────────────────────────────────── */
  const handlers = {};
  const events = {
    on(type, fn) { (handlers[type] = handlers[type] || new Set()).add(fn); return () => events.off(type, fn); },
    off(type, fn) { handlers[type] && handlers[type].delete(fn); },
    emit(type, detail) {
      (handlers[type] ? [...handlers[type]] : []).forEach((fn) => {
        try { fn(detail); } catch (err) { console.error(err); }
      });
    },
  };
  CRM.events = events;

  /* ── state ───────────────────────────────────────── */
  const KEY = 'tally:v1';
  const COLS = ['reps', 'companies', 'contacts', 'deals', 'tasks', 'activities', 'wins'];
  const PREFIX = { reps: 'u', companies: 'o', contacts: 'c', deals: 'd', tasks: 't', activities: 'a', wins: 'w' };
  const TOUCH_TYPES = new Set(['call', 'email', 'meeting', 'note', 'task']);
  let db = null;
  let idx = {};
  let persistent = true;
  const subs = new Set();

  const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;
  /** 把所有日期欄位平移 n 天（存檔跨日時讓資料維持「相對今天」） */
  function shiftDates(node, n) {
    if (Array.isArray(node)) node.forEach((x, i) => { if (typeof x === 'string' && DATE_RE.test(x)) node[i] = shift1(x, n); else if (x && typeof x === 'object') shiftDates(x, n); });
    else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (typeof v === 'string' && DATE_RE.test(v)) node[k] = shift1(v, n);
        else if (v && typeof v === 'object') shiftDates(v, n);
      }
    }
  }
  const shift1 = (s, n) => (s.length > 10 ? U.isoDT(U.addDays(s, n)) : U.iso(U.addDays(s, n)));

  function reindex() {
    idx = {};
    COLS.forEach((c) => { idx[c] = new Map((db[c] || (db[c] = [])).map((d) => [d.id, d])); });
    cache.clear();
  }

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { persistent = false; }
    if (saved && saved.meta && saved.meta.version === 2) {
      const todayIso = U.iso(U.today());
      if (saved.meta.seededOn !== todayIso) {
        // 同一季：平移日期保留使用者的修改；跨季：重新產生示範資料
        if (saved.meta.quarter === U.quarterOf(U.today()).key) {
          shiftDates(saved, U.daysBetween(saved.meta.seededOn, todayIso));
          saved.meta.seededOn = todayIso;
          // 平移後今天的活動可能晚於現在：收回到現在
          const now = U.isoDT(new Date());
          (saved.activities || []).forEach((a) => { if (a.at > now) a.at = now; });
          (saved.tasks || []).forEach((t) => { if (t.doneAt && t.doneAt > now) t.doneAt = now; });
        } else saved = null;
      }
    } else saved = null;
    db = saved || S.generate();
    reindex();
  }

  const save = U.debounce(() => {
    if (!persistent) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { persistent = false; }
  }, 250);

  /* ── change notification & batches ───────────────── */
  let batchDepth = 0;
  let log = null; // 目前批次的反向操作
  let pending = null; // { collections:Set, ids:Set, type }
  const cache = new Map();

  function touch(col, type, id) {
    cache.clear();
    if (!pending) pending = { collections: new Set(), ids: new Set(), types: new Set() };
    pending.collections.add(col);
    pending.ids.add(id);
    pending.types.add(type);
    if (!batchDepth) flush();
  }
  function flush() {
    if (!pending) return;
    const p = pending;
    pending = null;
    const collections = [...p.collections];
    const evt = {
      collection: collections[0],
      collections,
      ids: [...p.ids],
      type: p.types.size === 1 ? [...p.types][0] : 'batch',
      has: (...cols) => cols.some((c) => p.collections.has(c)),
    };
    save();
    [...subs].forEach((fn) => { try { fn(evt); } catch (err) { console.error(err); } });
  }

  /** 把多個變更合成一次通知與一個復原點：const { undo } = store.batch(() => { … }) */
  function batch(fn) {
    const outer = log;
    const mine = [];
    log = mine;
    batchDepth++;
    let result;
    try { result = fn(); } finally {
      batchDepth--;
      log = outer;
      if (outer) outer.push(...mine);
      if (!batchDepth) flush();
    }
    const undo = () => revert(mine);
    return { result, undo };
  }
  function revert(ops) {
    batchDepth++;
    const saveLog = log;
    log = null;
    try {
      for (let i = ops.length - 1; i >= 0; i--) {
        const op = ops[i];
        if (op.op === 'remove') removeRaw(op.col, op.id);
        else if (op.op === 'insert') insertRaw(op.col, op.doc, op.index);
        else if (op.op === 'restore') {
          const d = idx[op.col].get(op.id);
          if (d) { for (const k of Object.keys(op.prev)) { if (op.prev[k] === undefined) delete d[k]; else d[k] = op.prev[k]; } touch(op.col, 'update', op.id); }
        }
      }
    } finally { log = saveLog; batchDepth--; if (!batchDepth) flush(); }
  }
  const record = (op) => { if (log) log.push(op); };
  const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

  function nextId(col) {
    const p = PREFIX[col] || 'x';
    let max = 0;
    for (const d of db[col]) { const n = parseInt(String(d.id).slice(p.length), 10); if (n > max) max = n; }
    const width = { companies: 2, contacts: 3, deals: 2, tasks: 3, activities: 4, wins: 2, reps: 1 }[col] || 3;
    return p + String(max + 1).padStart(width, '0');
  }
  function insertRaw(col, doc, index) {
    const arr = db[col];
    if (index == null || index > arr.length) arr.push(doc); else arr.splice(index, 0, doc);
    idx[col].set(doc.id, doc);
    touch(col, 'create', doc.id);
  }
  function removeRaw(col, id) {
    const arr = db[col];
    const i = arr.findIndex((d) => d.id === id);
    if (i < 0) return null;
    const [d] = arr.splice(i, 1);
    idx[col].delete(id);
    touch(col, 'remove', id);
    return { d, i };
  }

  /* ── CRUD ─────────────────────────────────────────── */
  function create(col, doc) {
    const d = { ...doc };
    if (!d.id) d.id = nextId(col);
    if (col === 'deals' && d.items) d.amount = itemsTotal(d.items);
    let res;
    const run = () => { insertRaw(col, d); record({ op: 'remove', col, id: d.id }); return d; };
    if (log) return run();
    res = batch(run);
    return res.result;
  }
  function update(col, id, patch) {
    const run = () => {
      const d = idx[col].get(id);
      if (!d) return null;
      const prev = {};
      for (const k of Object.keys(patch)) prev[k] = clone(d[k]);
      Object.assign(d, patch);
      if (col === 'deals' && patch.items) { prev.amount = prev.amount === undefined ? d.amount : prev.amount; d.amount = itemsTotal(d.items); }
      record({ op: 'restore', col, id, prev });
      touch(col, 'update', id);
      return d;
    };
    return log ? run() : batch(run).result;
  }
  function remove(col, id) {
    const run = () => {
      const r = removeRaw(col, id);
      if (r) record({ op: 'insert', col, doc: r.d, index: r.i });
      return r ? r.d : null;
    };
    return log ? run() : batch(run).result;
  }
  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
  function reset() {
    db = S.generate();
    reindex();
    save.flush();
    pending = { collections: new Set(COLS), ids: new Set(), types: new Set(['reset']) };
    flush();
  }

  /* ── basic getters ───────────────────────────────── */
  const get = (col, id) => (id ? idx[col] && idx[col].get(id) : undefined) || null;
  const all = (col) => db[col];
  const filter = (col, pred) => db[col].filter(pred);
  const find = (col, pred) => db[col].find(pred) || null;
  const STAGE_MAP = Object.fromEntries(S.STAGES.map((s) => [s.id, s]));
  const stage = (id) => STAGE_MAP[id] || null;
  const product = (sku) => S.PRODUCTS.find((p) => p.sku === sku) || null;
  const me = () => db.reps.find((r) => r.me) || db.reps[0];
  const rep = (id) => get('reps', id);
  const itemsTotal = (items) => (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  const isOpen = (d) => d.stage !== 'won' && d.stage !== 'lost';

  /* ── memo helper ─────────────────────────────────── */
  function memo(key, fn) {
    if (cache.has(key)) return cache.get(key);
    const v = fn();
    cache.set(key, v);
    return v;
  }

  /* ── activity indexes ───────────────────────────── */
  function refMatch(ref) {
    if (ref.contactId) return (a) => a.contactId === ref.contactId;
    if (ref.companyId) return (a) => a.companyId === ref.companyId;
    if (ref.dealId) return (a) => a.dealId === ref.dealId;
    if (ref.owner) return (a) => a.owner === ref.owner;
    return () => true;
  }
  const refKey = (ref) => (ref.contactId ? 'c:' + ref.contactId : ref.companyId ? 'o:' + ref.companyId : ref.dealId ? 'd:' + ref.dealId : ref.owner ? 'u:' + ref.owner : 'all');
  /** 每個 contact / company / deal / owner 的最後往來時間（只算真正的往來，不含階段變更） */
  const lastTouchMap = () => memo('lastTouch', () => {
    const m = new Map();
    for (const a of db.activities) {
      if (!TOUCH_TYPES.has(a.type)) continue;
      for (const k of ['c:' + a.contactId, 'o:' + a.companyId, 'd:' + a.dealId, 'u:' + a.owner]) {
        if (k.endsWith(':null') || k.endsWith(':undefined')) continue;
        const prev = m.get(k);
        if (!prev || a.at > prev) m.set(k, a.at);
      }
    }
    return m;
  });
  const lastTouch = (ref) => lastTouchMap().get(refKey(ref)) || null;

  const WARMTH = [
    { id: 'hot', label: '熱', lit: 4, max: 7 },
    { id: 'warm', label: '溫', lit: 3, max: 21 },
    { id: 'cool', label: '涼', lit: 2, max: 45 },
    { id: 'cold', label: '冷', lit: 1, max: Infinity },
  ];
  /** 關係溫度：{ id:'hot'|'warm'|'cool'|'cold', label:'熱', lit:4, days:3|null, last } */
  function warmth(ref) {
    const last = lastTouch(ref);
    const days = last ? -U.daysFromToday(last) : null;
    const w = days == null ? WARMTH[3] : WARMTH.find((x) => days <= x.max);
    return { ...w, days, last };
  }
  /** 近 N 天往來次數（劃記用） */
  function touches(ref, days = 30) {
    const from = U.iso(U.addDays(U.today(), -(days - 1)));
    const match = refMatch(ref);
    let n = 0;
    for (const a of db.activities) if (TOUCH_TYPES.has(a.type) && a.at >= from && match(a)) n++;
    return n;
  }
  /** 依週統計往來次數（由舊到新），本週為最後一格 */
  function touchSeries(ref = {}, weeks = 12) {
    const start = U.addDays(U.startOfWeek(U.today()), -7 * (weeks - 1));
    const out = Array(weeks).fill(0);
    const match = refMatch(ref);
    const from = U.iso(start);
    for (const a of db.activities) {
      if (!TOUCH_TYPES.has(a.type) || a.at < from || !match(a)) continue;
      const w = Math.floor(U.daysBetween(start, a.at) / 7);
      if (w >= 0 && w < weeks) out[w]++;
    }
    return out;
  }
  function activitiesFor(ref = {}, { types, limit, since } = {}) {
    const match = refMatch(ref);
    const t = types ? new Set(types) : null;
    const list = db.activities.filter((a) => match(a) && (!t || t.has(a.type)) && (!since || a.at >= since));
    list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return limit ? list.slice(0, limit) : list;
  }
  function dealsFor(ref = {}) {
    if (ref.contactId) return db.deals.filter((d) => d.contactIds.includes(ref.contactId));
    if (ref.companyId) return db.deals.filter((d) => d.companyId === ref.companyId);
    if (ref.owner) return db.deals.filter((d) => d.owner === ref.owner);
    return db.deals.slice();
  }
  const openDealsFor = (ref) => dealsFor(ref).filter(isOpen);
  function tasksFor(ref = {}, { open } = {}) {
    const m = ref.contactId ? (t) => t.contactId === ref.contactId : ref.companyId ? (t) => t.companyId === ref.companyId : ref.dealId ? (t) => t.dealId === ref.dealId : ref.owner ? (t) => t.owner === ref.owner : () => true;
    return db.tasks.filter((t) => m(t) && (open == null || t.done !== open));
  }

  /* ── pipeline & quota ────────────────────────────── */
  function dealsByStage(pred) {
    const out = Object.fromEntries(S.STAGES.map((s) => [s.id, []]));
    for (const d of db.deals) if (!pred || pred(d)) (out[d.stage] || (out[d.stage] = [])).push(d);
    return out;
  }
  const weightedValue = (d) => (isOpen(d) ? d.amount * stage(d.stage).p : d.stage === 'won' ? d.amount : 0);
  const weighted = (deals) => deals.reduce((s, d) => s + weightedValue(d), 0);
  const quarter = (d) => U.quarterOf(d || U.today());
  /** 本季進度：{ quarter, target, won, wonDeals, weighted（本季內預計成交的加權）, pipelineWeighted, pipeline, pct, forecastPct, gap } */
  function quarterProgress({ owner } = {}) {
    return memo('qp:' + (owner || 'all'), () => {
      const q = quarter();
      const qs = U.iso(q.start), qe = U.iso(q.end);
      const target = owner ? (rep(owner) || {}).target || 0 : S.TEAM_TARGET;
      const mine = owner ? db.deals.filter((d) => d.owner === owner) : db.deals;
      const wonDeals = mine.filter((d) => d.stage === 'won' && d.closedAt && d.closedAt >= qs && d.closedAt <= qe);
      const won = wonDeals.reduce((s, d) => s + d.amount, 0);
      const open = mine.filter(isOpen);
      const inQ = open.filter((d) => d.closeDate <= qe);
      const w = weighted(inQ);
      return {
        quarter: q, target, won, wonDeals, weighted: w,
        pipeline: open.reduce((s, d) => s + d.amount, 0),
        pipelineWeighted: weighted(open),
        pct: target ? won / target : 0,
        forecastPct: target ? (won + w) / target : 0,
        gap: Math.max(0, target - won),
      };
    });
  }
  /** 期間：'month' | 'quarter' | 'year' → { start, end, label } */
  function period(kind = 'quarter') {
    const t = U.today();
    if (kind === 'month') return { start: new Date(t.getFullYear(), t.getMonth(), 1), end: new Date(t.getFullYear(), t.getMonth() + 1, 0), label: '本月' };
    if (kind === 'year') return { start: new Date(t.getFullYear(), 0, 1), end: new Date(t.getFullYear(), 11, 31), label: '今年' };
    const q = quarter();
    return { start: q.start, end: q.end, label: '本季' };
  }
  /** 業務統計：repStats('u3', { period:'quarter' })；owner 為 null 時是全隊 */
  function repStats(owner, { period: kind = 'quarter' } = {}) {
    return memo(`rs:${owner}:${kind}`, () => {
      const p = period(kind);
      const ps = U.iso(p.start), pe = U.iso(p.end);
      const deals = owner ? db.deals.filter((d) => d.owner === owner) : db.deals;
      const closed = deals.filter((d) => d.closedAt && d.closedAt >= ps && d.closedAt <= pe);
      const wonDeals = closed.filter((d) => d.stage === 'won');
      const lost = closed.filter((d) => d.stage === 'lost');
      const won = wonDeals.reduce((s, d) => s + d.amount, 0);
      // 成交週期與平均單價：近 12 個月的成交（含歷史 wins）
      const yearAgo = U.iso(U.addDays(U.today(), -365));
      const hist = [
        ...deals.filter((d) => d.stage === 'won' && d.closedAt >= yearAgo).map((d) => ({ amount: d.amount, cycle: U.daysBetween(d.createdAt, d.closedAt) })),
        ...db.wins.filter((w) => (!owner || w.owner === owner) && w.closedAt >= yearAgo).map((w) => ({ amount: w.amount, cycle: w.cycleDays })),
      ];
      const baseTarget = owner ? (rep(owner) || {}).target || 0 : S.TEAM_TARGET;
      const target = kind === 'month' ? baseTarget / 3 : kind === 'year' ? baseTarget * 4 : baseTarget;
      const open = deals.filter(isOpen);
      return {
        owner, period: p, target, won, wonCount: wonDeals.length, lostCount: lost.length,
        winRate: closed.length ? wonDeals.length / closed.length : 0,
        avgCycle: hist.length ? Math.round(hist.reduce((s, x) => s + x.cycle, 0) / hist.length) : 0,
        avgDeal: hist.length ? hist.reduce((s, x) => s + x.amount, 0) / hist.length : 0,
        openCount: open.length, pipeline: open.reduce((s, d) => s + d.amount, 0), weighted: weighted(open),
        touches: db.activities.filter((a) => TOUCH_TYPES.has(a.type) && (!owner || a.owner === owner) && a.at >= ps && a.at <= pe + 'T99').length,
        pct: target ? won / target : 0,
      };
    });
  }
  /** 公司統計：{ contacts, openDeals, openAmount, wonTotal, warmth, touches30, lastTouch } */
  function companyStats(id) {
    const openDeals = db.deals.filter((d) => d.companyId === id && isOpen(d));
    const wonDeals = db.deals.filter((d) => d.companyId === id && d.stage === 'won');
    const hist = db.wins.filter((w) => w.companyId === id);
    return {
      contacts: db.contacts.filter((c) => c.companyId === id).length,
      openDeals,
      openAmount: openDeals.reduce((s, d) => s + d.amount, 0),
      wonTotal: wonDeals.reduce((s, d) => s + d.amount, 0) + hist.reduce((s, w) => s + w.amount, 0),
      warmth: warmth({ companyId: id }),
      touches30: touches({ companyId: id }, 30),
      lastTouch: lastTouch({ companyId: id }),
    };
  }
  /** 公司營收歷史：過去四季 + 本季，[{ key, label, amount }] */
  function revenueHistory(companyId) {
    const co = get('companies', companyId);
    const q = quarter();
    const rows = (co && co.history ? co.history : []).map((h) => ({ ...h }));
    const current = db.deals.filter((d) => d.companyId === companyId && d.stage === 'won' && d.closedAt && U.quarterOf(d.closedAt).key === q.key).reduce((s, d) => s + d.amount, 0);
    // 上季成交的單也算進歷史
    for (const d of db.deals) {
      if (d.companyId !== companyId || d.stage !== 'won' || !d.closedAt) continue;
      const k = U.quarterOf(d.closedAt).key;
      const row = rows.find((r) => r.key === k);
      if (row) row.amount += d.amount;
    }
    rows.push({ key: q.key, label: q.label, amount: current });
    return rows;
  }
  const contactsOf = (companyId) => db.contacts.filter((c) => c.companyId === companyId);
  const companyOf = (rec) => (rec ? get('companies', rec.companyId) : null);

  /* ── actions ─────────────────────────────────────── */
  const ui = () => CRM.ui || {};
  const toast = (msg, opts) => { if (ui().toast) ui().toast(msg, opts); };
  const nowIso = () => U.isoDT(new Date());
  const tallyKeys = (a) => [a.contactId && 'contact:' + a.contactId, a.companyId && 'company:' + a.companyId, a.dealId && 'deal:' + a.dealId, a.owner && 'rep:' + a.owner].filter(Boolean);

  /** 移動交易階段。won 會發出 'won' 事件（ui 據此播放成交入帳）。 */
  function moveDealStage(id, to, { lostReason = null, sourceEl = null, silent = false } = {}) {
    const d = get('deals', id);
    if (!d || d.stage === to || !stage(to)) return null;
    const from = d.stage;
    const closed = to === 'won' || to === 'lost';
    const today = U.iso(U.today());
    const at = performance.now();
    const { undo } = batch(() => {
      if (to === 'won') events.emit('won', { deal: d, amount: d.amount, sourceEl });
      update('deals', id, {
        stage: to,
        history: [...d.history, { stage: to, at: today }],
        closedAt: closed ? today : null,
        closeDate: closed ? today : d.closeDate,
        lostReason: to === 'lost' ? lostReason || '未填原因' : null,
      });
      create('activities', {
        type: 'stage', at: nowIso(), owner: d.owner, contactId: null, companyId: d.companyId, dealId: d.id, from, to,
        body: `${stage(from).name} → ${stage(to).name}${to === 'lost' && lostReason ? '：' + lostReason : ''}`,
      });
    });
    events.emit('stage', { deal: d, from, to, at });
    if (!silent) {
      const msg = to === 'won' ? `成交入帳 ${U.money(d.amount)}` : to === 'lost' ? `已標記未成：${d.lostReason}` : `「${d.name}」移到${stage(to).name}`;
      toast(msg, { undo });
    }
    return { undo };
  }

  /** 記一筆活動：logActivity({ type:'call', contactId, body, duration }) */
  function logActivity(data, { silent = false } = {}) {
    const contact = data.contactId ? get('contacts', data.contactId) : null;
    const deal = data.dealId ? get('deals', data.dealId) : null;
    const a = {
      type: 'note', at: nowIso(), owner: me().id, contactId: null, companyId: null, dealId: null, body: '',
      ...data,
    };
    if (!a.companyId) a.companyId = contact ? contact.companyId : deal ? deal.companyId : null;
    const at = performance.now();
    let created;
    const { undo } = batch(() => { created = create('activities', a); });
    events.emit('tally', { keys: tallyKeys(created), activity: created, at });
    if (!silent) {
      const t = S.ACTIVITY_TYPES.find((x) => x.id === a.type);
      toast(`已記一筆${t ? t.name : ''}${contact ? '：' + contact.name : ''}`, { undo });
    }
    return { activity: created, undo };
  }

  /** 完成任務：寫入任務完成活動，關聯紀錄的劃記多一筆 */
  function completeTask(id, { silent = false } = {}) {
    const t = get('tasks', id);
    if (!t || t.done) return null;
    const at = performance.now();
    let act;
    const { undo } = batch(() => {
      update('tasks', id, { done: true, doneAt: nowIso() });
      act = create('activities', { type: 'task', at: nowIso(), owner: t.owner, contactId: t.contactId, companyId: t.companyId, dealId: t.dealId, taskId: t.id, body: t.title });
    });
    events.emit('tally', { keys: tallyKeys(act), activity: act, at });
    if (!silent) toast(`完成：${t.title}`, { undo });
    return { undo };
  }
  function reopenTask(id, { silent = false } = {}) {
    const t = get('tasks', id);
    if (!t || !t.done) return null;
    const { undo } = batch(() => {
      update('tasks', id, { done: false, doneAt: null });
      const act = db.activities.filter((a) => a.type === 'task' && a.taskId === id).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
      if (act) remove('activities', act.id);
    });
    if (!silent) toast(`已重新開啟：${t.title}`, { undo });
    return { undo };
  }

  /** 刪除紀錄並處理關聯（全部可復原） */
  function deleteRecord(col, id, { silent = false } = {}) {
    const rec = get(col, id);
    if (!rec) return null;
    const { undo } = batch(() => {
      if (col === 'contacts') {
        db.deals.filter((d) => d.contactIds.includes(id)).forEach((d) => update('deals', d.id, { contactIds: d.contactIds.filter((x) => x !== id) }));
        db.tasks.filter((t) => t.contactId === id).forEach((t) => update('tasks', t.id, { contactId: null }));
        db.activities.filter((a) => a.contactId === id).forEach((a) => update('activities', a.id, { contactId: null }));
        db.contacts.filter((c) => c.reportsTo === id).forEach((c) => update('contacts', c.id, { reportsTo: rec.reportsTo || null }));
      } else if (col === 'companies') {
        db.contacts.filter((c) => c.companyId === id).map((c) => c.id).forEach((cid) => remove('contacts', cid));
        db.deals.filter((d) => d.companyId === id).map((d) => d.id).forEach((did) => remove('deals', did));
        db.tasks.filter((t) => t.companyId === id).map((t) => t.id).forEach((tid) => remove('tasks', tid));
        db.activities.filter((a) => a.companyId === id).map((a) => a.id).forEach((aid) => remove('activities', aid));
      } else if (col === 'deals') {
        db.tasks.filter((t) => t.dealId === id).forEach((t) => update('tasks', t.id, { dealId: null }));
        db.activities.filter((a) => a.dealId === id).forEach((a) => (a.type === 'stage' ? remove('activities', a.id) : update('activities', a.id, { dealId: null })));
      }
      remove(col, id);
    });
    if (!silent) toast(`已刪除「${rec.name || rec.title || rec.subject || '紀錄'}」`, { undo });
    return { undo };
  }

  load();

  CRM.store = {
    get data() { return db; },
    get persistent() { return persistent; },
    KEY, COLS, TOUCH_TYPES, WARMTH,
    STAGES: S.STAGES, OPEN_STAGES: S.STAGES.filter((s) => !s.closed), PRODUCTS: S.PRODUCTS, TEAM_TARGET: S.TEAM_TARGET,
    LIFECYCLES: S.LIFECYCLES, COMPANY_STATUSES: S.COMPANY_STATUSES, TAGS: S.TAGS, LOST_REASONS: S.LOST_REASONS,
    ACTIVITY_TYPES: S.ACTIVITY_TYPES, PRIORITIES: S.PRIORITIES,
    get, all, filter, find, create, update, remove, batch, subscribe, reset, nextId,
    stage, product, me, rep, itemsTotal, isOpen,
    lastTouch, warmth, touches, touchSeries, activitiesFor, dealsFor, openDealsFor, tasksFor,
    dealsByStage, weightedValue, weighted, quarter, quarterProgress, period, repStats, companyStats, revenueHistory,
    contactsOf, companyOf,
  };
  CRM.actions = { moveDealStage, logActivity, completeTask, reopenTask, deleteRecord };
})();
