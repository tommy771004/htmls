/* pages/dashboard · 總覽（#/）
   給登入的主管看：本期業績與缺口、Pipeline 漏斗、今天的任務、該聯絡的人、即將成交、業務排行、活動量與最新動態。
   query：period=month|quarter|year（預設本季）  owner=u1..u6（單一業務） */
(function () {
  'use strict';
  const CRM = window.CRM;
  const U = CRM.util;
  const { html, raw, h } = U;

  const S = () => CRM.store;
  const ui = () => CRM.ui;

  const PERIODS = [
    { value: 'month', label: '本月' },
    { value: 'quarter', label: '本季' },
    { value: 'year', label: '今年' },
  ];
  const PREV = { month: '上月', quarter: '上季', year: '去年' };
  const TYPE_ICON = { call: 'phone', email: 'mail', meeting: 'meeting', note: 'note', task: 'check', stage: 'stage' };
  const TYPE_NAME = { call: '通話', email: 'Email', meeting: '會議', note: '筆記', task: '完成任務', stage: '階段變更' };
  const FUNNEL_ORDER = ['lead', 'qual', 'poc', 'prop', 'nego', 'won'];

  /* ── 小工具 ─────────────────────────────────────── */
  const iso = (d) => U.iso(d);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const wan = (n) => U.moneyCompact(n);
  function parts(n) {
    const s = U.moneyCompact(n);
    const m = s.match(/^(.*?)\s*(萬|億)?$/);
    return { v: m[1], u: m[2] || '元' };
  }
  const givenName = (p) => (p.surname && p.name.startsWith(p.surname) ? p.name.slice(p.surname.length) : p.name.slice(1)) || p.name;
  function greeting() {
    const hr = new Date().getHours();
    if (hr < 5) return '夜深了';
    if (hr < 11) return '早安';
    if (hr < 14) return '午安';
    if (hr < 18) return '下午好';
    return '晚安';
  }
  /** 期間與上一期（Date） */
  function periodRange(kind) {
    const p = S().period(kind);
    const s = p.start;
    let prev;
    if (kind === 'month') prev = { start: new Date(s.getFullYear(), s.getMonth() - 1, 1), end: new Date(s.getFullYear(), s.getMonth(), 0) };
    else if (kind === 'year') prev = { start: new Date(s.getFullYear() - 1, 0, 1), end: new Date(s.getFullYear() - 1, 11, 31) };
    else prev = { start: new Date(s.getFullYear(), s.getMonth() - 3, 1), end: new Date(s.getFullYear(), s.getMonth(), 0) };
    return { ...p, ps: iso(p.start), pe: iso(p.end), prev: { ...prev, ps: iso(prev.start), pe: iso(prev.end) } };
  }
  /** 期間內的成交（進行中資料的成交單＋歷史成交摘要），{ amount, cycle, at } */
  function wonIn(ps, pe, owner) {
    const store = S();
    const mine = (o) => !owner || o === owner;
    return [
      ...store.all('deals').filter((d) => d.stage === 'won' && d.closedAt && d.closedAt >= ps && d.closedAt <= pe && mine(d.owner)).map((d) => ({ amount: d.amount, cycle: U.daysBetween(d.createdAt, d.closedAt), at: d.closedAt })),
      ...store.all('wins').filter((w) => w.closedAt >= ps && w.closedAt <= pe && mine(w.owner)).map((w) => ({ amount: w.amount, cycle: w.cycleDays, at: w.closedAt })),
    ];
  }
  function lostIn(ps, pe, owner) {
    return S().all('deals').filter((d) => d.stage === 'lost' && d.closedAt && d.closedAt >= ps && d.closedAt <= pe && (!owner || d.owner === owner));
  }
  function wonDealsIn(ps, pe, owner) {
    return S().all('deals').filter((d) => d.stage === 'won' && d.closedAt && d.closedAt >= ps && d.closedAt <= pe && (!owner || d.owner === owner));
  }

  /* ── 計算：一次算出整頁要用的資料 ─────────────────── */
  function compute(st) {
    const store = S();
    const owner = st.owner || null;
    const P = periodRange(st.period);
    const T = U.today();
    const todayIso = iso(T);
    const mineDeal = (d) => !owner || d.owner === owner;
    const openDeals = store.all('deals').filter((d) => store.isOpen(d) && mineDeal(d));

    /* 業績 */
    const baseRs = store.repStats(owner, { period: st.period });
    const target = baseRs.target;
    const wins = wonIn(P.ps, P.pe, owner);
    const won = wins.reduce((s, x) => s + x.amount, 0);
    const inPeriodOpen = openDeals.filter((d) => d.closeDate <= P.pe);
    const forecastW = store.weighted(inPeriodOpen);
    const totalDays = U.daysBetween(P.start, P.end) + 1;
    const elapsed = U.clamp(U.daysBetween(P.start, T) + 1, 0, totalDays);
    const hero = {
      label: P.label, target, won, weighted: forecastW, count: wins.length,
      pct: target ? won / target : 0,
      forecastPct: target ? (won + forecastW) / target : 0,
      pace: elapsed / totalDays,
      gap: Math.max(0, target - won),
      daysLeft: Math.max(0, U.daysBetween(T, P.end)),
      series: cumSeries(st.period, P, wins, target, T),
      rangeLabel: st.period === 'quarter' ? U.quarterOf(T).label : st.period === 'year' ? `${T.getFullYear()} 年` : `${T.getMonth() + 1} 月`,
    };

    /* 三張統計卡：本期 vs 上一期 */
    const closedNow = { won: wonDealsIn(P.ps, P.pe, owner).length, lost: lostIn(P.ps, P.pe, owner).length };
    const closedPrev = { won: wonDealsIn(P.prev.ps, P.prev.pe, owner).length, lost: lostIn(P.prev.ps, P.prev.pe, owner).length };
    const rate = (c) => (c.won + c.lost ? c.won / (c.won + c.lost) : null);
    const prevWins = wonIn(P.prev.ps, P.prev.pe, owner);
    const kpi = {
      winRate: rate(closedNow), winRatePrev: closedPrev.won + closedPrev.lost >= 3 ? rate(closedPrev) : null, closedNow,
      cycle: Math.round(avg(wins.map((w) => w.cycle))), cyclePrev: Math.round(avg(prevWins.map((w) => w.cycle))),
      avgDeal: avg(wins.map((w) => w.amount)), avgDealPrev: avg(prevWins.map((w) => w.amount)),
      prevName: PREV[st.period],
    };

    /* 漏斗 */
    const hist = store.all('deals').filter(mineDeal);
    const reached = (sid) => hist.filter((d) => d.stage === sid || (d.history || []).some((x) => x.stage === sid)).length;
    const reach = Object.fromEntries(store.STAGES.map((s) => [s.id, reached(s.id)]));
    const funnel = store.STAGES.map((s) => {
      let list;
      if (s.id === 'won') list = wonDealsIn(P.ps, P.pe, owner);
      else if (s.id === 'lost') list = lostIn(P.ps, P.pe, owner);
      else list = openDeals.filter((d) => d.stage === s.id);
      const amount = list.reduce((a, d) => a + d.amount, 0);
      const i = FUNNEL_ORDER.indexOf(s.id);
      const conv = i > 0 && reach[FUNNEL_ORDER[i - 1]] ? reach[s.id] / reach[FUNNEL_ORDER[i - 1]] : null;
      return { s, count: list.length, amount, weighted: s.id === 'lost' ? 0 : s.id === 'won' ? amount : store.weighted(list), conv };
    });
    const newLeads = hist.filter((d) => d.createdAt >= P.ps && d.createdAt <= P.pe).length;
    const lossRate = reach.nego ? hist.filter((d) => d.stage === 'lost').length / Math.max(1, hist.filter((d) => d.stage === 'lost' || d.stage === 'won').length) : null;

    /* 今天（登入者，或篩選的業務） */
    const who = owner || store.me().id;
    const taskList = store.all('tasks').filter((t) => t.owner === who && !t.done && t.due <= todayIso)
      .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (a.dueTime || '99') < (b.dueTime || '99') ? -1 : 1));
    const doneToday = store.all('tasks').filter((t) => t.owner === who && t.done && (t.doneAt || '').slice(0, 10) === todayIso).length;

    /* 該聯絡了 */
    const stale = store.all('contacts').filter((c) => !owner || c.owner === owner).map((c) => {
      const w = store.warmth({ contactId: c.id });
      if (w.id !== 'cool' && w.id !== 'cold') return null;
      const open = store.openDealsFor({ contactId: c.id });
      if (!open.length) return null;
      return { c, w, co: store.get('companies', c.companyId), openAmt: open.reduce((s, d) => s + d.amount, 0), openN: open.length };
    }).filter(Boolean).sort((a, b) => b.openAmt - a.openAmt);

    /* 即將成交（30 天內＋逾期） */
    const in30 = iso(U.addDays(T, 30));
    const closing = openDeals.filter((d) => d.closeDate <= in30).sort((a, b) => (a.closeDate < b.closeDate ? -1 : a.closeDate > b.closeDate ? 1 : b.amount - a.amount));
    const wkS = iso(U.startOfWeek(T)), wkE = iso(U.addDays(U.startOfWeek(T), 6));
    const thisWeekClose = openDeals.filter((d) => d.closeDate >= wkS && d.closeDate <= wkE).length;

    /* 業務排行與活動量 */
    const reps = store.all('reps').map((r) => {
      const rs = store.repStats(r.id, { period: st.period });
      const rWon = wonIn(P.ps, P.pe, r.id).reduce((s, x) => s + x.amount, 0);
      const series = store.touchSeries({ owner: r.id }, 12);
      const todayN = store.all('activities').filter((a) => a.owner === r.id && store.TOUCH_TYPES.has(a.type) && a.at.slice(0, 10) === todayIso).length;
      return { r, target: rs.target, won: rWon, pct: rs.target ? rWon / rs.target : 0, pipeline: rs.pipeline, openCount: rs.openCount, series, week: series[11], lastWeek: series[10], todayN };
    }).sort((a, b) => b.pct - a.pct || b.won - a.won);

    /* 最新動態 */
    const nowDT = U.isoDT(new Date());
    const feed = store.all('activities').filter((a) => (!owner || a.owner === owner) && a.at <= nowDT).slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 8);

    return { st, owner, P, hero, kpi, funnel, newLeads, lossRate, reach, who, taskList, doneToday, stale, closing, thisWeekClose, reps, feed, openDeals, todayIso };
  }

  /** 累計成交的走勢：本月依日、本季依週、今年依月 */
  function cumSeries(kind, P, wins, target, T) {
    let n, idx, label;
    if (kind === 'month') {
      n = U.daysBetween(P.start, P.end) + 1;
      idx = (d) => U.daysBetween(P.start, d);
      label = (i) => U.fmtDate(U.addDays(P.start, i));
    } else if (kind === 'year') {
      n = 12;
      idx = (d) => U.parse(d).getMonth();
      label = (i) => `${i + 1} 月`;
    } else {
      n = Math.ceil((U.daysBetween(P.start, P.end) + 1) / 7);
      idx = (d) => Math.floor(U.daysBetween(P.start, d) / 7);
      label = (i) => { const a = U.addDays(P.start, i * 7); const b = U.addDays(a, 6) > P.end ? P.end : U.addDays(a, 6); return `第 ${i + 1} 週（${U.fmtDate(a)}–${U.fmtDate(b)}）`; };
    }
    const buckets = Array(n).fill(0);
    wins.forEach((w) => { const i = idx(w.at); if (i >= 0 && i < n) buckets[i] += w.amount; });
    const nowI = U.clamp(idx(T), 0, n - 1);
    let acc = 0;
    const won = buckets.map((v, i) => { acc += v; return i <= nowI ? acc : null; });
    const pace = buckets.map((_, i) => (target * (i + 1)) / n);
    return { n, won, pace, nowI, labels: buckets.map((_, i) => label(i)), start: U.fmtDate(P.start), end: U.fmtDate(P.end) };
  }

  /* ════════ 掛載 ════════ */
  function mount(el, ctx) {
    const { store, router } = ctx;
    const UI = ui();
    const reps = () => store.all('reps');
    const readState = (q) => ({
      period: PERIODS.some((p) => p.value === q.period) ? q.period : 'quarter',
      owner: q.owner && reps().some((r) => r.id === q.owner) ? q.owner : '',
    });
    let st = readState(ctx.query);
    let D = null;
    const settling = new Map(); // 剛勾完成、還留在「今天」裡播放動畫的任務
    let lastDone = null;
    let alive = true;

    const header = UI.pageHeader({ title: '總覽', sub: ' ', actions: h(html`<div class="db-filters"></div>`) });
    header.classList.add('db-ph');
    el.appendChild(header);
    const page = h(html`<div class="page pg-dashboard">
      <div class="db-mbar">
        <p class="db-msub"></p>
        <div class="db-filters"></div>
      </div>
      <div class="db-grid">
        <section class="card db-hero" aria-label="業績進度"></section>
        <div class="db-kpis" aria-label="成交指標"></div>
        <section class="card db-funnel" aria-label="Pipeline 漏斗"></section>
        <section class="card db-today" aria-label="今天的任務"></section>
        <section class="card db-stale" aria-label="該聯絡了"></section>
        <section class="card db-closing" aria-label="即將成交"></section>
        <section class="card db-reps" aria-label="業務排行"></section>
        <section class="card db-heat" aria-label="近 12 週活動量"></section>
        <section class="card db-feed" aria-label="最新動態"></section>
      </div>
    </div>`);
    el.appendChild(page);
    const $ = (s) => page.querySelector(s);

    /* ── 連結 ── */
    const ownerQ = () => (st.owner ? { owner: st.owner } : {});
    const whoQ = (id) => (id === store.me().id ? 'me' : id);
    const link = {
      deals: (q = {}) => router.href('/deals', { ...ownerQ(), ...q }),
      contacts: (q = {}) => router.href('/contacts', { ...ownerQ(), ...q }),
      tasks: (q = {}) => router.href('/tasks', { view: 'list', who: whoQ(D.who), ...q }),
      activities: (q = {}) => router.href('/activities', { ...ownerQ(), range: 'week', ...q }),
    };

    /* ── 篩選控制（頁首；手機在頁內） ── */
    function drawFilters() {
      const rep = st.owner ? store.rep(st.owner) : null;
      const markup = String(html`${UI.segmented({ name: 'db-period', value: st.period, label: '期間', options: PERIODS, cls: 'db-seg' })}<button type="button" class="tbtn db-repbtn${rep ? ' is-on' : ''}" data-act="rep" aria-haspopup="menu" aria-expanded="false">${rep ? UI.nameBlock(rep, { size: 24, title: false }) : html`<span class="db-stack" aria-hidden="true">${reps().slice(0, 4).map((r) => UI.nameBlock(r, { size: 22, title: false }))}</span>`}<span>${rep ? rep.name : '全部業務'}</span>${UI.icon('chevronDown', { size: 14 })}</button>`);
      el.querySelectorAll('.db-filters').forEach((f) => { f.innerHTML = markup; });
    }
    function drawHeader() {
      const me = store.me();
      const d = U.today();
      const whoName = st.owner && st.owner !== me.id ? `${store.rep(st.owner).name}：` : '';
      const sub = `${U.fmtDate(d)} ${U.weekday(d)} · ${whoName}今天 ${D.taskList.length} 件任務、本週 ${D.thisWeekClose} 筆要成交`;
      const t = header.querySelector('.ph-title');
      t.textContent = `${greeting()}，${givenName(me)}`;
      header.querySelector('.ph-sub').textContent = sub;
      $('.db-msub').textContent = sub;
    }
    function setState(patch) {
      st = { ...st, ...patch };
      router.setQuery({ period: st.period === 'quarter' ? null : st.period, owner: st.owner || null }, { silent: true });
      drawAll();
    }

    /* ── 業績主卡 ── */
    function heroChart(sr) {
      const W = 320, H = 212, L = 6, R = 6, TP = 12, B = 8;
      const max = Math.max(1, ...sr.pace, ...sr.won.filter((v) => v != null)) * 1.04;
      const x = (i) => L + (sr.n === 1 ? 0 : (i * (W - L - R)) / (sr.n - 1));
      const y = (v) => TP + (1 - v / max) * (H - TP - B);
      const wonPts = sr.won.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
      const last = sr.nowI;
      const area = `M${x(0).toFixed(1)},${y(0).toFixed(1)} L${wonPts.join(' L')} L${x(last).toFixed(1)},${y(0).toFixed(1)} Z`;
      const tgtY = y(sr.pace[sr.n - 1]);
      return raw(`<svg class="db-lc" viewBox="0 0 ${W} ${H}" role="img" aria-label="累計成交與目標進度">
        <line class="db-lc-grid" x1="${L}" x2="${W - R}" y1="${tgtY.toFixed(1)}" y2="${tgtY.toFixed(1)}"/>
        <line class="db-lc-base" x1="${L}" x2="${W - R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>
        <line class="db-lc-pace" x1="${x(0).toFixed(1)}" y1="${y(0).toFixed(1)}" x2="${x(sr.n - 1).toFixed(1)}" y2="${tgtY.toFixed(1)}"/>
        <path class="db-lc-area" d="${area}"/>
        <polyline class="db-lc-won" points="${wonPts.join(' ')}"/>
        <line class="db-lc-x" x1="0" x2="0" y1="${TP}" y2="${y(0).toFixed(1)}"/>
        <circle class="db-lc-hp" r="4" cx="-20" cy="-20"/>
        <circle class="db-lc-hw" r="4" cx="-20" cy="-20"/>
        <circle class="db-lc-dot" r="4.5" cx="${x(last).toFixed(1)}" cy="${y(sr.won[last]).toFixed(1)}"/>
      </svg>`);
    }
    function drawHero() {
      const k = D.hero;
      const pct = Math.round(k.pct * 100), fpct = Math.round(k.forecastPct * 100), pacePct = Math.round(k.pace * 100);
      const scale = Math.max(k.target, k.won + k.weighted) * 1.1 || 1;
      const wW = Math.min(100, (k.won / scale) * 100), fW = Math.min(100 - wW, (k.weighted / scale) * 100);
      const tX = (k.target / scale) * 100, pX = ((k.target * k.pace) / scale) * 100;
      const wp = parts(k.won);
      const ahead = pct - pacePct;
      const rep = st.owner ? store.rep(st.owner) : null;
      let say;
      if (k.won >= k.target) say = html`已達標，超出目標 <b>${wan(k.won - k.target)}</b>。${k.weighted ? html`加權預測再加 <b>${wan(k.weighted)}</b>。` : ''}`;
      else if (k.weighted) say = html`還差 <b class="db-gap">${wan(k.gap)}</b>，加權預測可到 <b>${fpct}%</b>。`;
      else say = html`還差 <b class="db-gap">${wan(k.gap)}</b>，${k.label}內沒有預計成交的單可補。`;
      const paceSay = k.won >= k.target ? '' : ahead >= 0 ? `比時間進度（${pacePct}%）超前 ${ahead} 個百分點` : `時間已過 ${pacePct}%，達成落後 ${-ahead} 個百分點`;
      const sr = k.series;
      $('.db-hero').innerHTML = String(html`
        <div class="db-hero-top">
          <div class="db-hero-fig">
            <p class="db-hero-label"><span>${k.label}業績${rep ? ` · ${rep.name}` : ''}</span><span class="db-hero-range">${k.rangeLabel}${k.daysLeft ? ` · 剩 ${k.daysLeft} 天` : ''}</span></p>
            <p class="db-hero-num"><span class="db-hero-won">${wp.v}</span><span class="db-hero-unit">${wp.u}</span><span class="db-hero-of">／目標 ${wan(k.target)}</span></p>
            <p class="db-hero-pct"><b>${pct}%</b><span>已達成 · ${k.count} 筆成交</span></p>
          </div>
          <div class="db-hero-chart">
            <p class="db-legend"><span class="db-key db-key--won"></span>累計成交<span class="db-key db-key--pace"></span>目標進度</p>
            <div class="db-lc-wrap" data-chart>${heroChart(sr)}<div class="db-ctip" hidden></div></div>
            <p class="db-lc-axis"><span>${sr.start}</span><span>${sr.end}</span></p>
          </div>
        </div>
        <div class="db-meter">
          <div class="db-meter-track" role="img" aria-label="已成交 ${wan(k.won)}，加權預測再加 ${wan(k.weighted)}，目標 ${wan(k.target)}">
            <i class="db-meter-won" style="width:${wW.toFixed(2)}%" data-tip="已成交 ${wan(k.won)}（${pct}%）"></i><i class="db-meter-fc" style="left:${wW.toFixed(2)}%;width:${fW.toFixed(2)}%" data-tip="加權預測 +${wan(k.weighted)}（到 ${fpct}%）"></i>
            <span class="db-meter-tgt" style="left:${tX.toFixed(2)}%"><span>目標 ${wan(k.target)}</span></span>
            ${k.pace < 1 ? html`<span class="db-meter-pace" style="left:${pX.toFixed(2)}%" data-tip="照時間進度今天應達 ${wan(k.target * k.pace)}（${pacePct}%）"></span>` : ''}
          </div>
          <p class="db-legend db-meter-legend"><span class="db-lg"><span class="db-key db-key--bar"></span>已成交 ${wan(k.won)}</span><span class="db-lg"><span class="db-key db-key--fc"></span>加權預測 +${wan(k.weighted)}</span>${k.pace < 1 ? html`<span class="db-lg"><span class="db-key db-key--tick"></span>今天應達 ${pacePct}%</span>` : ''}</p>
        </div>
        <div class="db-say">
          <p class="db-say-main">${say}</p>
          ${paceSay ? html`<p class="db-say-pace${ahead < 0 ? ' is-behind' : ''}">${paceSay}</p>` : ''}
          <a class="db-say-link" href="${link.deals({ close: st.period === 'year' ? null : st.period === 'month' ? 'month' : 'quarter' })}">看${k.label}要成交的單${UI.icon('arrowRight', { size: 14 })}</a>
        </div>`);
      bindChart($('.db-hero [data-chart]'), sr);
    }
    /** 折線圖的十字線與提示：找最近的 x，兩條線的值一起列 */
    function bindChart(wrap, sr) {
      const svg = wrap.querySelector('svg');
      const tip = wrap.querySelector('.db-ctip');
      const W = 320, H = 212, L = 6, R = 6, TP = 12, B = 8;
      const max = Math.max(1, ...sr.pace, ...sr.won.filter((v) => v != null)) * 1.04;
      const x = (i) => L + (sr.n === 1 ? 0 : (i * (W - L - R)) / (sr.n - 1));
      const y = (v) => TP + (1 - v / max) * (H - TP - B);
      const cross = svg.querySelector('.db-lc-x'), hp = svg.querySelector('.db-lc-hp'), hw = svg.querySelector('.db-lc-hw');
      function show(i) {
        const px = x(i);
        cross.setAttribute('x1', px); cross.setAttribute('x2', px);
        cross.classList.add('is-on');
        wrap.classList.add('is-hover');
        hp.setAttribute('cx', px); hp.setAttribute('cy', y(sr.pace[i]));
        const wv = sr.won[i];
        if (wv != null) { hw.setAttribute('cx', px); hw.setAttribute('cy', y(wv)); } else { hw.setAttribute('cx', -20); }
        tip.textContent = '';
        const head = document.createElement('p'); head.className = 'db-ctip-h'; head.textContent = sr.labels[i];
        tip.appendChild(head);
        [[wv, '累計成交', 'won'], [sr.pace[i], '目標進度', 'pace']].forEach(([v, name, cls]) => {
          const row = document.createElement('p'); row.className = 'db-ctip-r';
          const key = document.createElement('i'); key.className = 'db-key db-key--' + cls;
          const b = document.createElement('b'); b.textContent = v == null ? '尚未到' : wan(v);
          const s = document.createElement('span'); s.textContent = name;
          row.append(key, b, s); tip.appendChild(row);
        });
        tip.hidden = false;
        const rect = wrap.getBoundingClientRect();
        const left = (px / W) * rect.width;
        tip.style.left = Math.round(U.clamp(left - tip.offsetWidth / 2, 0, rect.width - tip.offsetWidth)) + 'px';
      }
      function hide() { tip.hidden = true; wrap.classList.remove('is-hover'); cross.classList.remove('is-on'); hp.setAttribute('cx', -20); hw.setAttribute('cx', -20); }
      wrap.addEventListener('pointermove', (e) => {
        const rect = svg.getBoundingClientRect();
        const vx = ((e.clientX - rect.left) / rect.width) * W;
        const i = U.clamp(Math.round(((vx - L) / (W - L - R)) * (sr.n - 1)), 0, sr.n - 1);
        show(i);
      });
      wrap.addEventListener('pointerleave', hide);
      wrap.tabIndex = 0;
      wrap.setAttribute('aria-label', '累計成交走勢，左右鍵逐點查看');
      let fi = sr.nowI;
      wrap.addEventListener('focus', () => show(fi));
      wrap.addEventListener('blur', hide);
      wrap.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        fi = U.clamp(fi + (e.key === 'ArrowRight' ? 1 : -1), 0, sr.n - 1);
        show(fi);
      });
    }

    /* ── 三張統計卡 ── */
    function drawKpis() {
      const k = D.kpi;
      const ap = parts(k.avgDeal);
      const wr = k.winRate == null ? null : Math.round(k.winRate * 100);
      const wrPrev = k.winRatePrev == null ? null : Math.round(k.winRatePrev * 100);
      const wrD = wr != null && wrPrev != null ? wr - wrPrev : null;
      const cyD = k.cycle && k.cyclePrev ? k.cyclePrev - k.cycle : null;
      const adD = k.avgDeal && k.avgDealPrev ? Math.round(((k.avgDeal - k.avgDealPrev) / k.avgDealPrev) * 100) : null;
      const dir = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');
      $('.db-kpis').innerHTML = String(html`
        ${UI.statCard({ label: '贏單率', value: wr == null ? '–' : wr, unit: wr == null ? '' : '%', icon: 'target', tone: 2, delta: wrD != null ? { text: `${Math.abs(wrD)} 個百分點`, dir: dir(wrD) } : null, foot: wrD != null ? `比${k.prevName} · ${k.closedNow.won} 勝 ${k.closedNow.lost} 敗` : `${k.closedNow.won} 勝 ${k.closedNow.lost} 敗`, href: link.deals({ view: 'list', group: 'stage' }) })}
        ${UI.statCard({ label: '平均成交週期', value: k.cycle || '–', unit: k.cycle ? '天' : '', icon: 'clock', tone: 5, delta: cyD ? { text: `${Math.abs(cyD)} 天`, dir: cyD > 0 ? 'up' : 'down' } : null, foot: cyD ? (cyD > 0 ? `比${k.prevName}快` : `比${k.prevName}慢`) : k.cyclePrev ? `${k.prevName} ${k.cyclePrev} 天` : '從建立到成交', href: link.deals({ view: 'list', sort: 'days', dir: 'desc' }) })}
        ${UI.statCard({ label: '平均單價', value: k.avgDeal ? ap.v : '–', unit: k.avgDeal ? ap.u : '', icon: 'coin', tone: 3, delta: adD != null ? { text: `${Math.abs(adD)}%`, dir: dir(adD) } : null, foot: adD != null ? `比${k.prevName} · ${k.prevName} ${wan(k.avgDealPrev)}` : '本期成交的平均金額', href: link.deals({ view: 'list', sort: 'amount', dir: 'desc' }) })}`);
    }

    /* ── Pipeline 漏斗 ── */
    function drawFunnel() {
      const rows = D.funnel;
      const max = Math.max(1, ...rows.map((r) => r.amount));
      const open = rows.filter((r) => !r.s.closed);
      const openAmt = open.reduce((s, r) => s + r.amount, 0), openW = open.reduce((s, r) => s + r.weighted, 0), openN = open.reduce((s, r) => s + r.count, 0);
      const pLabel = D.P.label;
      $('.db-funnel').innerHTML = String(html`
        <div class="card-head db-head">
          <div class="db-head-t"><h2 class="card-title">Pipeline 漏斗</h2><p class="card-sub">進行中 ${openN} 筆 · ${wan(openAmt)} · 加權 ${wan(openW)}</p></div>
          <a class="db-more" href="${link.deals()}">看 Pipeline${UI.icon('arrowRight', { size: 14 })}</a>
        </div>
        <div class="db-fn-cols" aria-hidden="true"><span>階段</span><span class="db-legend"><span class="db-key db-key--solid"></span>加權<span class="db-key db-key--tint"></span>總額</span><span>筆數</span><span>金額</span><span>轉換</span></div>
        <ol class="db-fn">${rows.map((r) => {
          const wPct = (r.amount / max) * 100, wwPct = (r.weighted / max) * 100;
          const convTxt = r.s.id === 'lead' ? html`<span class="db-fn-new" data-tip="${pLabel}新建立的交易">新進 ${D.newLeads}</span>` : r.s.id === 'lost' ? html`<span class="db-fn-conv is-lost" data-tip="全部結案交易中未成的比例">${D.lossRate == null ? '–' : Math.round(D.lossRate * 100) + '%'}</span>` : html`<span class="db-fn-conv" data-tip="到過「${store.stage(FUNNEL_ORDER[FUNNEL_ORDER.indexOf(r.s.id) - 1]).name}」的交易中，有 ${r.conv == null ? '–' : Math.round(r.conv * 100) + '%'} 走到「${r.s.name}」">${r.conv == null ? '–' : Math.round(r.conv * 100) + '%'}</span>`;
          const sub = r.s.id === 'won' ? `${pLabel}成交` : r.s.id === 'lost' ? `${pLabel}未成` : `加權 ${wan(r.weighted)}`;
          return html`<li class="db-fn-row${r.s.id === 'lost' ? ' is-lost' : ''}" style="--st:${raw(r.s.color)}">
            <a class="db-fn-link" href="${link.deals({ stage: r.s.id })}" aria-label="${r.s.name}：${r.count} 筆，${wan(r.amount)}，在 Pipeline 查看">
              <span class="db-fn-name"><i aria-hidden="true"></i>${r.s.name}<span class="db-fn-mn">${r.count}</span></span>
              <span class="db-fn-bar" data-tip="${r.s.name} · 總額 ${wan(r.amount)} · ${sub}"><i class="db-fn-tint" style="width:${wPct.toFixed(2)}%"></i>${r.s.id !== 'lost' ? html`<i class="db-fn-solid" style="width:${wwPct.toFixed(2)}%"></i>` : ''}</span>
              <span class="db-fn-n">${r.count}</span>
              <span class="db-fn-amt"><b>${r.amount ? wan(r.amount) : '0'}</b><span>${sub}</span></span>
              <span class="db-fn-cv">${convTxt}</span>
            </a>
          </li>`;
        })}</ol>`);
    }

    /* ── 今天 ── */
    const checkSvg = raw('<svg class="db-check-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle class="db-check-ring" cx="12" cy="12" r="10"/><path class="db-check-mark" d="M7.4 12.4l3.1 3.1 6.1-6.3"/></svg>');
    function drawToday() {
      const whoRep = store.rep(D.who);
      const isMe = D.who === store.me().id;
      const settlingTasks = [...settling.keys()].map((id) => store.get('tasks', id)).filter((t) => t && !D.taskList.includes(t));
      const list = [...D.taskList, ...settlingTasks].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (a.dueTime || '99') < (b.dueTime || '99') ? -1 : 1));
      const overdue = D.taskList.filter((t) => t.due < D.todayIso).length;
      const dueToday = D.taskList.length - overdue;
      const shown = list.slice(0, 6);
      const rel = (t) => {
        const c = t.contactId ? store.get('contacts', t.contactId) : null;
        const co = t.companyId ? store.get('companies', t.companyId) : c ? store.get('companies', c.companyId) : null;
        return [c && c.name, co && co.name].filter(Boolean).join(' · ');
      };
      $('.db-today').innerHTML = String(html`
        <div class="card-head db-head">
          <div class="db-head-t"><h2 class="card-title">今天${isMe ? '' : ` · ${whoRep.name}`}</h2><p class="card-sub">${overdue ? html`<a class="db-sublink is-overdue" href="${link.tasks({ due: 'overdue' })}">逾期 ${overdue}</a> · ` : ''}<a class="db-sublink" href="${link.tasks({ due: 'today' })}">今天到期 ${dueToday}</a></p></div>
          <p class="db-done" aria-live="polite"><span class="db-done-l">今天完成</span>${UI.tally(D.doneToday, { size: 20, accent: D.doneToday ? 1 : 0, label: `今天完成 ${D.doneToday} 件`, cls: 'db-done-tally' })}</p>
        </div>
        ${shown.length ? html`<ul class="db-tasks">${shown.map((t) => {
          const set = settling.has(t.id);
          return html`<li class="db-task${t.done ? ' is-done' : ''}${set ? ' is-settling' : ''}" data-id="${t.id}" data-pri="${t.priority}">
            <button type="button" class="db-check" role="checkbox" aria-checked="${String(!!t.done)}" data-check="${t.id}" aria-label="${t.done ? '已完成' : '完成'}：${t.title}">${checkSvg}</button>
            <div class="db-task-main">
              <a class="db-task-t" href="${router.href('/tasks', { view: 'list', focus: t.id })}">${t.title}</a>
              <p class="db-task-sub">${UI.due(t.due, t.dueTime, { done: t.done })}${rel(t) ? html`<span class="db-task-rel">${rel(t)}</span>` : ''}</p>
            </div>
            ${t.priority === 'high' ? html`<span class="db-flag" data-tip="高優先" role="img" aria-label="高優先">${UI.icon('flag', { size: 16 })}</span>` : ''}
          </li>`;
        })}</ul>` : html`<div class="db-empty">${UI.emptyState({ compact: true, title: '今天的事都做完了', body: '明天的任務會在這裡出現。', action: UI.btn({ label: '新增任務', icon: 'plus', size: 'sm', attrs: { 'data-act': 'new-task' } }) })}</div>`}
        <div class="db-foot">${list.length > shown.length ? html`<span class="t-3">還有 ${list.length - shown.length} 件</span>` : html`<span></span>`}<a class="db-more" href="${link.tasks({ due: null })}">全部任務${UI.icon('arrowRight', { size: 14 })}</a></div>`);
      const tl = $('.db-done-tally');
      if (lastDone != null && D.doneToday > lastDone && tl) UI.animateTallyStroke(tl);
      lastDone = D.doneToday;
    }
    function completeFromToday(id) {
      const t = store.get('tasks', id);
      if (!t || t.done) return;
      const hold = U.reducedMotion() ? 0 : 1500;
      if (hold) {
        const timer = setTimeout(() => { settling.delete(id); if (alive) drawToday(); }, hold);
        settling.set(id, timer);
      }
      CRM.actions.completeTask(id);
    }

    /* ── 該聯絡了 ── */
    function drawStale() {
      const list = D.stale.slice(0, 6);
      $('.db-stale').innerHTML = String(html`
        <div class="card-head db-head">
          <div class="db-head-t"><h2 class="card-title">該聯絡了</h2><p class="card-sub">涼或冷、還有進行中交易，依金額排序</p></div>
          <a class="db-more" href="${link.contacts({ view: 'stale' })}">全部 ${D.stale.length} 位${UI.icon('arrowRight', { size: 14 })}</a>
        </div>
        ${list.length ? html`<ul class="db-list db-stale-list">${list.map((x) => html`<li class="db-sc">
          <a class="db-sc-who" href="${router.href('/contacts/' + x.c.id)}">${UI.nameBlock(x.c, { size: 36, title: false })}<span class="db-sc-text"><span class="db-sc-name">${x.c.name}</span><span class="db-sc-co">${x.co ? x.co.name : x.c.title}</span></span></a>
          <span class="db-sc-w">${UI.warmth(x.w)}<span class="db-sc-days">${x.w.days == null ? '尚無往來' : `${x.w.days} 天沒聯絡`}</span></span>
          <span class="db-sc-amt"><b>${wan(x.openAmt)}</b><span>${x.openN} 筆進行中</span></span>
          ${UI.btn({ label: '記一筆', icon: 'phone', size: 'sm', cls: 'db-sc-log', attrs: { 'data-log': x.c.id, 'aria-label': `記一筆：${x.c.name}` } })}
        </li>`)}</ul>` : html`<div class="db-empty">${UI.emptyState({ compact: true, title: '大家都聯絡得很勤', body: '有進行中交易的聯絡人，三週內都有往來。' })}</div>`}`);
    }

    /* ── 即將成交 ── */
    function drawClosing() {
      const list = D.closing.slice(0, 6);
      const total = D.closing.reduce((s, d) => s + d.amount, 0);
      const overdue = D.closing.filter((d) => d.closeDate < D.todayIso).length;
      $('.db-closing').innerHTML = String(html`
        <div class="card-head db-head">
          <div class="db-head-t"><h2 class="card-title">即將成交</h2><p class="card-sub">30 天內 ${D.closing.length} 筆 · ${wan(total)}${overdue ? html` · <a class="db-sublink is-overdue" href="${link.deals({ close: 'overdue' })}">逾期 ${overdue}</a>` : ''}</p></div>
          <a class="db-more" href="${link.deals({ close: 'month' })}">本月要成交${UI.icon('arrowRight', { size: 14 })}</a>
        </div>
        ${list.length ? html`<ul class="db-list db-cl-list">${list.map((d) => {
          const co = store.get('companies', d.companyId);
          const rep = store.rep(d.owner);
          const diff = U.daysFromToday(d.closeDate);
          const when = diff < 0 ? `逾期 ${-diff} 天` : diff === 0 ? '今天' : `${diff} 天後`;
          return html`<li><button type="button" class="db-cl" data-deal="${d.id}">
            <span class="db-cl-main"><span class="db-cl-name"><i class="db-dot" style="background:${raw(store.stage(d.stage).color)}" aria-hidden="true"></i><span class="t-ellipsis">${d.name}</span></span><span class="db-cl-co">${co ? co.name : ''} · ${store.stage(d.stage).name}</span></span>
            <span class="db-cl-when${diff < 0 ? ' is-overdue' : diff <= 3 ? ' is-soon' : ''}"><b>${U.fmtDate(d.closeDate)}</b><span>${when}</span></span>
            <span class="db-cl-amt">${wan(d.amount)}</span>
            <span class="db-cl-rep" data-tip="負責：${rep ? rep.name : ''}">${UI.nameBlock(rep, { size: 26, title: false })}</span>
          </button></li>`;
        })}</ul>` : html`<div class="db-empty">${UI.emptyState({ compact: true, title: '30 天內沒有要成交的單', body: '到 Pipeline 看看哪些單可以往前推。' })}</div>`}`);
    }

    /* ── 業務排行 ── */
    function drawReps() {
      const pLabel = D.P.label;
      $('.db-reps').innerHTML = String(html`
        <div class="card-head db-head">
          <div class="db-head-t"><h2 class="card-title">業務排行</h2><p class="card-sub">${pLabel}成交／目標 · 點一位只看他的數字</p></div>
          ${st.owner ? html`<button type="button" class="db-more" data-act="clear-owner">看全隊${UI.icon('close', { size: 14 })}</button>` : html`<a class="db-more" href="${link.activities()}">本週活動${UI.icon('arrowRight', { size: 14 })}</a>`}
        </div>
        <div class="db-rk-cols" aria-hidden="true"><span></span><span>業務</span><span>${pLabel}達成</span><span>進行中</span><span>本週往來</span></div>
        <ol class="db-rk">${D.reps.map((x, i) => {
          const on = st.owner === x.r.id;
          const w = Math.min(100, x.pct * 100);
          const diff = x.week - x.lastWeek;
          return html`<li><button type="button" class="db-rk-row${on ? ' is-on' : ''}${st.owner && !on ? ' is-dim' : ''}" data-rep="${x.r.id}" aria-pressed="${String(on)}">
            <span class="db-rk-n">${i + 1}</span>
            <span class="db-rk-who">${UI.nameBlock(x.r, { size: 36, title: false })}<span class="db-rk-text"><span class="db-rk-name">${x.r.name}${x.r.me ? html`<span class="db-me">我</span>` : ''}</span><span class="db-rk-sub">${x.r.region} · 目標 ${wan(x.target)}</span></span></span>
            <span class="db-rk-q"><span class="db-rk-qtop"><b>${Math.round(x.pct * 100)}%</b><span>${wan(x.won)}</span></span><span class="db-rk-bar" role="img" aria-label="達成 ${Math.round(x.pct * 100)}%"><i style="width:${w.toFixed(1)}%"></i></span></span>
            <span class="db-rk-pipe"><b>${wan(x.pipeline)}</b><span>${x.openCount} 筆</span></span>
            <span class="db-rk-tally">${UI.tally(x.week, { key: 'rep:' + x.r.id, size: 20, accent: Math.min(x.week, x.todayN), label: `本週往來 ${x.week} 次`, cls: 'db-rk-t', showZero: false })}<span class="db-rk-tn"><b>${x.week}</b> 次<span class="${diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}">${diff > 0 ? `比上週多 ${diff}` : diff < 0 ? `比上週少 ${-diff}` : '和上週一樣'}</span></span></span>
          </button></li>`;
        })}</ol>`);
    }

    /* ── 活動量格子圖 ── */
    function drawHeat() {
      const start = U.addDays(U.startOfWeek(U.today()), -7 * 11);
      const weeks = Array.from({ length: 12 }, (_, i) => U.addDays(start, i * 7));
      const max = Math.max(1, ...D.reps.flatMap((x) => x.series));
      const lvl = (v) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));
      const total = D.reps.reduce((s, x) => s + x.series.reduce((a, b) => a + b, 0), 0);
      $('.db-heat').innerHTML = String(html`
        <div class="card-head db-head">
          <div class="db-head-t"><h2 class="card-title">活動量</h2><p class="card-sub">近 12 週往來 ${U.num(total)} 次</p></div>
          <a class="db-more" href="${link.activities()}">活動紀錄${UI.icon('arrowRight', { size: 14 })}</a>
        </div>
        <div class="db-hm" role="table" aria-label="業務每週往來次數">
          <div class="db-hm-row db-hm-axis" role="row"><span role="columnheader" class="db-hm-lab"><span class="sr-only">業務</span></span>${weeks.map((w, i) => html`<span role="columnheader" class="db-hm-wk${i === 11 ? ' is-now' : ''}">${i === 11 ? '本週' : i % 3 === 0 ? U.fmtDate(w) : ''}</span>`)}</div>
          ${D.reps.map((x) => html`<div class="db-hm-row${st.owner === x.r.id ? ' is-on' : ''}" role="row">
            <button type="button" role="rowheader" class="db-hm-lab" data-rep="${x.r.id}">${UI.nameBlock(x.r, { size: 26, title: false })}<span class="db-hm-name">${x.r.name}</span></button>
            ${x.series.map((v, i) => html`<span role="cell" class="db-hm-c${i === 11 ? ' is-now' : ''}" data-l="${lvl(v)}" data-tip="${x.r.name} · ${U.fmtDate(weeks[i])} 那週：${v} 次往來" aria-label="${U.fmtDate(weeks[i])} 那週 ${v} 次"></span>`)}
          </div>`)}
        </div>
        <p class="db-hm-legend"><span>少</span>${[0, 1, 2, 3, 4].map((l) => html`<i class="db-hm-c" data-l="${l}" aria-hidden="true"></i>`)}<span>多</span></p>`);
    }

    /* ── 最新動態 ── */
    function evView(a) {
      const rep = store.rep(a.owner);
      const c = a.contactId ? store.get('contacts', a.contactId) : null;
      const co = a.companyId ? store.get('companies', a.companyId) : c ? store.get('companies', c.companyId) : null;
      const deal = a.dealId ? store.get('deals', a.dealId) : null;
      const meta = [];
      if (a.type === 'call' && a.duration) meta.push(U.duration(a.duration));
      if (a.type === 'meeting' && a.location) meta.push(a.location);
      let body = html`<p class="db-ev-text">${a.body}</p>`;
      if (a.type === 'email') body = html`<p class="db-ev-text"><b>${a.subject || '（無主旨）'}</b>${a.body ? html` · ${a.body}` : ''}</p>`;
      if (a.type === 'stage') body = html`<p class="db-ev-text db-ev-stage">${a.from ? UI.stageTag(a.from) : ''}${UI.icon('arrowRight', { size: 14 })}${UI.stageTag(a.to)}</p>`;
      const who = c ? html`<a href="${router.href('/contacts/' + c.id)}">${c.name}</a>` : co ? html`<a href="${router.href('/companies/' + co.id)}">${co.name}</a>` : deal ? deal.name : '';
      return html`<li class="db-ev" data-type="${a.type}">
        <span class="db-ev-ic" aria-hidden="true">${UI.icon(TYPE_ICON[a.type] || 'note', { size: 16 })}</span>
        <div class="db-ev-main">
          <p class="db-ev-head"><span class="db-ev-type">${TYPE_NAME[a.type] || a.type}</span>${who ? html`<span class="db-ev-who">${who}</span>` : ''}${meta.length ? html`<span class="db-ev-meta">${meta.join(' · ')}</span>` : ''}<time class="db-ev-time" datetime="${a.at}">${U.relTime(a.at, { time: true })}</time></p>
          ${body}
          <p class="db-ev-foot">${rep ? html`<span class="db-ev-rep">${UI.nameBlock(rep, { size: 18, title: false })}${rep.name}</span>` : ''}${deal ? html`<button type="button" class="db-ev-deal" data-deal="${deal.id}">${UI.icon('deals', { size: 14 })}<span>${deal.name}</span></button>` : ''}</p>
        </div>
      </li>`;
    }
    function drawFeed() {
      const f = D.feed;
      const half = Math.ceil(f.length / 2);
      $('.db-feed').innerHTML = String(html`
        <div class="card-head db-head">
          <div class="db-head-t"><h2 class="card-title">最新動態</h2><p class="card-sub">${st.owner ? store.rep(st.owner).name + '的' : '全隊'}最近 ${f.length} 筆</p></div>
          <a class="db-more" href="${link.activities()}">全部動態${UI.icon('arrowRight', { size: 14 })}</a>
        </div>
        ${f.length ? html`<div class="db-feed-cols"><ol class="db-evs">${f.slice(0, half).map(evView)}</ol><ol class="db-evs">${f.slice(half).map(evView)}</ol></div>` : html`<div class="db-empty">${UI.emptyState({ compact: true, title: '還沒有動態', body: '記下第一通電話或會議，這裡就會開始累積。' })}</div>`}`);
    }

    function drawAll() {
      D = compute(st);
      drawFilters();
      drawHeader();
      drawHero();
      drawKpis();
      drawFunnel();
      drawToday();
      drawStale();
      drawClosing();
      drawReps();
      drawHeat();
      drawFeed();
    }
    drawAll();

    /* ── 互動 ── */
    function repMenu(anchor) {
      const items = [
        { label: '全部業務', checked: !st.owner, value: '', hint: `${Math.round(D.hero.pct * 100)}%` },
        { divider: true },
        ...D.reps.map((x) => ({ label: x.r.name + (x.r.me ? '（我）' : ''), lead: UI.nameBlock(x.r, { size: 20, title: false }), value: x.r.id, checked: st.owner === x.r.id, hint: `${Math.round(x.pct * 100)}%` })),
      ];
      UI.menu(anchor, items, { label: '業務', align: 'end', cls: 'db-repmenu', onSelect: (it) => setState({ owner: it.value }) });
    }
    const onSeg = (e) => {
      if (e.detail.name !== 'db-period') return;
      const inHeader = !!e.target.closest('.db-ph');
      setState({ period: e.detail.value });
      // 重繪後把焦點放回同一組控制項的新按鈕
      const scope = inHeader ? header : page;
      const b = scope.querySelector(`.db-seg [data-value="${st.period}"]`);
      if (b) b.focus({ preventScroll: true });
    };
    el.addEventListener('seg-change', onSeg);
    const onClick = (e) => {
      const t = e.target;
      const rb = t.closest('[data-act="rep"]');
      if (rb) { repMenu(rb); return; }
      const ck = t.closest('[data-check]');
      if (ck) { completeFromToday(ck.dataset.check); return; }
      const lg = t.closest('[data-log]');
      if (lg) { UI.logActivity({ contactId: lg.dataset.log, type: 'call' }); return; }
      const dl = t.closest('[data-deal]');
      if (dl) { UI.openDeal(dl.dataset.deal); return; }
      const rp = t.closest('[data-rep]');
      if (rp) { const id = rp.dataset.rep; setState({ owner: st.owner === id ? '' : id }); const again = page.querySelector(`.db-rk [data-rep="${id}"]`); if (again && rp.closest('.db-rk')) again.focus({ preventScroll: true }); return; }
      const act = t.closest('[data-act]');
      if (act && act.dataset.act === 'clear-owner') { setState({ owner: '' }); return; }
      if (act && act.dataset.act === 'new-task') { UI.create('task', { owner: D.who, due: D.todayIso }); }
    };
    el.addEventListener('click', onClick);

    const off = store.subscribe((evt) => {
      if (!alive || !evt.has('deals', 'tasks', 'activities', 'contacts', 'companies', 'reps', 'wins')) return;
      // 在收尾動畫期間按了復原：任務已重新開啟，就不要再留著完成的樣子
      settling.forEach((tm, id) => { const t = store.get('tasks', id); if (!t || !t.done) { clearTimeout(tm); settling.delete(id); } });
      // 同步重繪，讓劃記事件（在 store 通知之後）能找到新渲染的元素播放筆畫
      drawAll();
    });
    return () => { alive = false; off(); el.removeEventListener('seg-change', onSeg); el.removeEventListener('click', onClick); settling.forEach((tm) => clearTimeout(tm)); settling.clear(); };
  }

  let cleanup = null;
  CRM.pages.dashboard = {
    route: /^\/$/,
    title: '總覽',
    nav: 'dashboard',
    mount(el, ctx) { cleanup = mount(el, ctx); },
    unmount() { if (cleanup) cleanup(); cleanup = null; },
  };
})();
