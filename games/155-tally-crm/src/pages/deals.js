/* pages/deals · 交易 Pipeline（#/deals?view=board|list）與交易抽屜（#/deals/:id）
   清單狀態都放在網址 query：
     view=board|list  q=  owner=u1..u6  close=month|quarter|next|overdue  industry=  amount=s|m|l|xl
     group=stage|owner|month（清單分組）  sort=  dir=asc|desc  stage=（手機看板目前顯示的階段）
   抽屜開在目前的看板／清單上方；關閉時回到原本的檢視與篩選。 */
(function () {
  'use strict';
  const CRM = window.CRM;
  const U = CRM.util;
  const { html, raw, h } = U;

  const S = () => CRM.store;
  const ui = () => CRM.ui;
  const R = () => CRM.router;

  /* ── 清單狀態記憶（抽屜底下的檢視、關閉後回到哪裡） ── */
  const LIST_KEYS = ['view', 'q', 'owner', 'close', 'industry', 'amount', 'group', 'sort', 'dir', 'stage'];
  const MEM_KEY = 'tally:deals:list';
  let lastListQuery = null;
  function rememberQuery(q) {
    lastListQuery = {};
    LIST_KEYS.forEach((k) => { if (q[k]) lastListQuery[k] = q[k]; });
    try { sessionStorage.setItem(MEM_KEY, JSON.stringify(lastListQuery)); } catch (e) { /* 只在記憶體 */ }
  }
  function savedQuery() {
    if (lastListQuery) return { ...lastListQuery };
    try { return JSON.parse(sessionStorage.getItem(MEM_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  /* 換頁時保留看板的捲動位置（路由換 path 會捲回頂端） */
  const scrollMem = { valid: false, y: 0, left: 0, lanes: {} };
  function saveScroll() {
    const page = document.querySelector('.pg-deals');
    if (!page) return;
    scrollMem.valid = true;
    scrollMem.y = window.scrollY;
    const b = page.querySelector('.dl-board');
    scrollMem.left = b ? b.scrollLeft : 0;
    scrollMem.lanes = {};
    page.querySelectorAll('.dl-lane-body').forEach((x) => { scrollMem.lanes[x.dataset.drop] = x.scrollTop; });
  }
  function restoreScroll(page) {
    if (!scrollMem.valid) return;
    scrollMem.valid = false;
    const apply = () => {
      window.scrollTo(0, scrollMem.y);
      const b = page.querySelector('.dl-board');
      if (b) b.scrollLeft = scrollMem.left;
      page.querySelectorAll('.dl-lane-body').forEach((x) => { x.scrollTop = scrollMem.lanes[x.dataset.drop] || 0; });
    };
    apply();
    requestAnimationFrame(apply);
  }

  /* ── 常數 ─────────────────────────────────────────── */
  const LOST_REASONS = CRM.store.LOST_REASONS;
  const CLOSE_OPTS = [
    { value: 'month', label: '本月（含逾期）', short: '本月' },
    { value: 'quarter', label: '本季（含逾期）', short: '本季' },
    { value: 'next', label: '下季', short: '下季' },
    { value: 'overdue', label: '已逾期', short: '已逾期' },
  ];
  const AMOUNT_OPTS = [
    { value: 's', label: '50 萬以下', min: 0, max: 5e5 },
    { value: 'm', label: '50 到 150 萬', min: 5e5, max: 15e5 },
    { value: 'l', label: '150 到 300 萬', min: 15e5, max: 3e6 },
    { value: 'xl', label: '300 萬以上', min: 3e6, max: Infinity },
  ];
  const GROUPS = [
    { value: 'stage', label: '依階段' },
    { value: 'owner', label: '依負責人' },
    { value: 'month', label: '依預計成交月' },
  ];
  const SORT_KEYS = ['name', 'company', 'stage', 'close', 'owner', 'days', 'amount'];
  const STALE_DAYS = 30;
  const order = () => S().STAGES.map((s) => s.id);

  /** 金額拆成數字與單位（統計卡用） */
  function parts(n) {
    const s = U.moneyCompact(n);
    const m = s.match(/^(.*?)\s*(萬|億)?$/);
    return { v: m[1], u: m[2] || '元' };
  }
  function dates() {
    const t = U.today();
    const q = U.quarterOf(t);
    const nq = U.quarterOf(U.addDays(q.end, 1));
    const lq = U.quarterOf(U.addDays(q.start, -1));
    return {
      today: U.iso(t),
      mS: U.iso(new Date(t.getFullYear(), t.getMonth(), 1)),
      mE: U.iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)),
      qS: U.iso(q.start), qE: U.iso(q.end),
      nS: U.iso(nq.start), nE: U.iso(nq.end),
      lS: U.iso(lq.start), lE: U.iso(lq.end),
      q, nq, lq,
    };
  }
  function itemsSummary(items) {
    const list = (items || []).slice().sort((a, b) => b.qty * b.price - a.qty * a.price);
    const head = list.slice(0, 2).map((it) => `${it.sku} ×${it.qty}`).join(' · ');
    return list.length > 2 ? `${head} +${list.length - 2}` : head;
  }
  /** 某階段最後一次進入的日期與停留天數 */
  function stageSpans(d) {
    const out = {};
    const hist = d.history || [];
    const endOf = (i) => (i + 1 < hist.length ? hist[i + 1].at : d.closedAt || U.iso(U.today()));
    hist.forEach((e, i) => { out[e.stage] = { at: e.at, days: Math.max(0, U.daysBetween(e.at, endOf(i))) }; });
    return out;
  }

  /* ── 每筆交易的顯示資料 ───────────────────────────── */
  function buildVMs() {
    const store = S();
    const D = dates();
    return store.all('deals').map((d) => {
      const co = store.get('companies', d.companyId);
      const open = store.isOpen(d);
      const last = d.history && d.history.length ? d.history[d.history.length - 1] : null;
      const since = last ? last.at : d.createdAt;
      return {
        id: d.id, d, co, open,
        rep: store.rep(d.owner),
        days: Math.max(0, -U.daysFromToday(since)),
        overdue: open && d.closeDate < D.today ? -U.daysFromToday(d.closeDate) : 0,
        w: store.weightedValue(d),
        items: itemsSummary(d.items),
        recent: !open && (d.closedAt || '') >= D.qS,
        text: [d.name, d.code, co && co.name, co && co.short].join(' ').toLowerCase(),
      };
    });
  }
  function closeMatch(vm, v, D) {
    const d = vm.d;
    if (vm.open) {
      if (v === 'month') return d.closeDate <= D.mE;
      if (v === 'quarter') return d.closeDate <= D.qE;
      if (v === 'next') return d.closeDate >= D.nS && d.closeDate <= D.nE;
      if (v === 'overdue') return d.closeDate < D.today;
      return true;
    }
    const c = d.closedAt || '';
    if (v === 'month') return c >= D.mS && c <= D.mE;
    if (v === 'quarter') return c >= D.qS && c <= D.qE;
    return false;
  }
  const FILTERS = [
    {
      key: 'owner', label: '負責人', icon: 'user', all: '全部負責人',
      options: () => S().all('reps').map((r) => ({ value: r.id, label: r.name + (r.me ? '（我）' : ''), short: r.name, lead: ui().nameBlock(r, { size: 20, title: false }) })),
      match: (vm, v) => vm.d.owner === v,
    },
    {
      key: 'close', label: '預計成交', icon: 'calendar', all: '全部期間',
      options: () => CLOSE_OPTS,
      match: (vm, v) => closeMatch(vm, v, dates()),
    },
    {
      key: 'industry', label: '產業', icon: 'companies', all: '全部產業',
      options: () => {
        const n = {};
        S().all('deals').forEach((d) => { const co = S().get('companies', d.companyId); if (co) n[co.industry] = (n[co.industry] || 0) + 1; });
        return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b, 'zh-Hant')).map((x) => ({ value: x, label: x }));
      },
      match: (vm, v) => !!vm.co && vm.co.industry === v,
    },
    {
      key: 'amount', label: '金額', icon: 'coin', all: '全部金額',
      options: () => AMOUNT_OPTS,
      match: (vm, v) => { const o = AMOUNT_OPTS.find((x) => x.value === v); return !o || (vm.d.amount >= o.min && vm.d.amount < o.max); },
    },
  ];
  function readState(query) {
    const st = {
      view: query.view === 'list' ? 'list' : 'board',
      q: query.q || '',
      group: GROUPS.some((g) => g.value === query.group) ? query.group : 'stage',
      sort: SORT_KEYS.includes(query.sort) ? query.sort : 'close',
      stage: order().includes(query.stage) ? query.stage : '',
    };
    st.dir = query.dir === 'desc' ? -1 : query.dir === 'asc' ? 1 : (st.sort === 'amount' || st.sort === 'days' ? -1 : 1);
    FILTERS.forEach((f) => { const v = query[f.key]; st[f.key] = v && f.options().some((o) => o.value === v) ? v : ''; });
    return st;
  }
  function matchQ(vm, q) {
    const t = (q || '').trim().toLowerCase();
    return !t || vm.text.includes(t);
  }
  function apply(vms, st, { skipFilter = null } = {}) {
    return vms.filter((vm) => {
      if (!matchQ(vm, st.q)) return false;
      for (const f of FILTERS) if (f.key !== skipFilter && st[f.key] && !f.match(vm, st[f.key])) return false;
      return true;
    });
  }

  /* ── 呈現片段 ─────────────────────────────────────── */
  function dueChip(vm) {
    const d = vm.d;
    if (d.stage === 'won') return html`<span class="dl-due is-won">${U.fmtDate(d.closedAt || d.closeDate)} 成交</span>`;
    if (d.stage === 'lost') return html`<span class="dl-due is-lost">${d.lostReason || '未成'}</span>`;
    if (vm.overdue) return html`<span class="dl-due is-overdue" title="預計 ${U.fmtDateLong(d.closeDate)}">逾期 ${vm.overdue} 天</span>`;
    const diff = U.daysFromToday(d.closeDate);
    return html`<span class="dl-due${diff <= 7 ? ' is-soon' : ''}" title="${U.fmtDateLong(d.closeDate)}">預計 ${U.fmtDate(d.closeDate)}</span>`;
  }
  function cardView(vm) {
    const UI = ui();
    const d = vm.d;
    const st = S().stage(d.stage);
    const cls = ['dl-card', d.stage === 'lost' ? 'is-lost' : '', d.stage === 'won' ? 'is-won' : '', vm.overdue ? 'is-overdue' : ''].filter(Boolean).join(' ');
    const stay = vm.open ? html`<span class="dl-stay${vm.days >= STALE_DAYS ? ' is-stale' : ''}" title="進入${st.name}已 ${vm.days} 天">${UI.icon('clock', { size: 13 })}${vm.days} 天</span>` : '';
    return html`<article class="${cls}" tabindex="0" role="button" data-id="${d.id}" aria-roledescription="交易卡" aria-label="${d.name}，${vm.co ? vm.co.name : ''}，${U.money(d.amount)}，${st.name}${vm.overdue ? `，逾期 ${vm.overdue} 天` : ''}。按 Enter 開啟，[ 或 ] 換階段">
      <div class="dl-card-top"><span class="dl-code">${d.code}</span>${dueChip(vm)}</div>
      <p class="dl-card-name">${d.name}</p>
      <p class="dl-card-co">${UI.companyMark(vm.co, { size: 20, title: false })}<span>${vm.co ? vm.co.name : '已刪除的公司'}</span></p>
      <p class="dl-card-items">${vm.items}</p>
      <div class="dl-card-foot">${UI.money(d.amount, { compact: true, lost: d.stage === 'lost', cls: 'dl-card-amt' })}<span class="dl-card-end">${stay}${UI.nameBlock(vm.rep, { size: 24 })}</span></div>
    </article>`;
  }
  function segView(cls, value) {
    return ui().segmented({ name: 'dl-view', value, size: cls === 'dl-mseg' ? 'sm' : 'md', label: '檢視', cls, options: [{ value: 'board', label: '看板', icon: 'board' }, { value: 'list', label: '清單', icon: 'list' }] });
  }

  /* ════════ 看板／清單 ════════ */
  function mountList(el, ctx, { detailId = null } = {}) {
    const { store } = ctx;
    const router = R();
    const UI = ui();
    const baseQuery = detailId ? savedQuery() : ctx.query;
    let st = readState(baseQuery);
    if (!detailId) rememberQuery(ctx.query);
    let vms = buildVMs();
    let alive = true;
    const showEarlier = { won: false, lost: false };

    const header = UI.pageHeader({
      title: '交易',
      sub: '七個階段的 pipeline、本季預測與成交入帳',
      ownNew: true,
      actions: html`${segView('dl-viewseg', st.view)}${UI.btn({ label: '新增交易', icon: 'plus', variant: 'primary', attrs: { 'data-act': 'new' } })}`,
    });
    el.appendChild(header);
    const page = h(html`<div class="page pg-deals">
      <div class="stats dl-stats"></div>
      <div class="card dl-wrap">
        <div class="toolbar dl-bar">
          <div class="dl-filters" role="group" aria-label="篩選"></div>
          <p class="dl-count" aria-live="polite"></p>
          <label class="tsearch dl-search">${UI.icon('search', { size: 15 })}<input class="input" type="search" name="dl-q" placeholder="搜尋名稱、單號或公司" autocomplete="off" aria-label="搜尋交易" value="${st.q}"></label>
          <div class="dl-mview">${segView('dl-mseg', st.view)}</div>
        </div>
        <div class="dl-body"></div>
      </div>
    </div>`);
    el.appendChild(page);
    const $ = (s) => page.querySelector(s);
    const statsEl = $('.dl-stats'), filtersEl = $('.dl-filters'), countEl = $('.dl-count'), bodyEl = $('.dl-body'), searchEl = $('input[name="dl-q"]');

    const syncUrl = () => {
      if (!alive || detailId) return;
      const patch = { view: st.view === 'board' ? null : 'list', q: st.q || null, stage: U.isMobile() && st.stage ? st.stage : null };
      if (st.view === 'list') { patch.group = st.group === 'stage' ? null : st.group; patch.sort = st.sort; patch.dir = st.dir < 0 ? 'desc' : 'asc'; } else { patch.group = null; patch.sort = null; patch.dir = null; }
      FILTERS.forEach((f) => { patch[f.key] = st[f.key] || null; });
      router.setQuery(patch, { silent: true });
      rememberQuery(router.current ? router.current.query : patch);
    };
    const anyFilter = () => !!(st.q || FILTERS.some((f) => st[f.key]));
    function clearAll() {
      st.q = '';
      FILTERS.forEach((f) => { st[f.key] = ''; });
      searchEl.value = '';
      syncUrl();
      draw();
    }
    function listQuery() { const q = {}; const cur = router.current ? router.current.query : {}; LIST_KEYS.forEach((k) => { if (cur[k]) q[k] = cur[k]; }); return q; }
    function openDeal(id) {
      if (!detailId) rememberQuery(listQuery());
      saveScroll();
      router.go('/deals/' + id);
    }

    /* 統計卡 */
    function drawStats() {
      const D = dates();
      const owner = st.owner || null;
      const qp = store.quarterProgress(owner ? { owner } : {});
      const open = store.all('deals').filter((d) => store.isOpen(d) && (!owner || d.owner === owner));
      const pipe = open.reduce((s, d) => s + d.amount, 0);
      const pipeW = store.weighted(open);
      const forecast = qp.won + qp.weighted;
      const pct = Math.round(qp.pct * 100);
      const fpct = Math.round(qp.forecastPct * 100);
      // 近 8 週新進 pipeline（依建立日）
      const w0 = U.addDays(U.startOfWeek(U.today()), -7 * 7);
      const spark = Array(8).fill(0);
      store.all('deals').forEach((d) => { if (owner && d.owner !== owner) return; const i = Math.floor(U.daysBetween(w0, d.createdAt) / 7); if (i >= 0 && i < 8) spark[i] += d.amount; });
      // 平均成交週期：本季成交 vs 上季（含歷史成交摘要）
      const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
      const nowCycles = qp.wonDeals.map((d) => U.daysBetween(d.createdAt, d.closedAt));
      const lastCycles = [
        ...store.all('wins').filter((w) => w.quarter === D.lq.key && (!owner || w.owner === owner)).map((w) => w.cycleDays),
        ...store.all('deals').filter((d) => d.stage === 'won' && d.closedAt >= D.lS && d.closedAt <= D.lE && (!owner || d.owner === owner)).map((d) => U.daysBetween(d.createdAt, d.closedAt)),
      ];
      const cNow = avg(nowCycles), cLast = avg(lastCycles);
      const diff = cLast && cNow ? cLast - cNow : 0;
      const who = owner ? store.rep(owner).name : '全隊';
      const fp = parts(forecast), pp = parts(pipe);
      statsEl.innerHTML = String(html`
        ${UI.statCard({ label: '本季目標達成', value: pct, unit: '%', icon: 'target', tone: 1, foot: html`<span class="dl-mini" role="img" aria-label="已成交 ${U.moneyCompact(qp.won)}，目標 ${U.moneyCompact(qp.target)}"><i style="width:${Math.min(100, pct)}%"></i></span><span class="dl-mini-t">${U.moneyCompact(qp.won, { unit: false })}／${U.moneyCompact(qp.target)}</span>` })}
        ${UI.statCard({ label: '加權預測', value: fp.v, unit: fp.u, icon: 'arrowUpRight', tone: 2, delta: { text: `${fpct}%`, dir: fpct >= 100 ? 'up' : 'flat' }, foot: owner ? `${who} · 含本季加權` : '含本季加權' })}
        ${UI.statCard({ label: '進行中 pipeline', value: pp.v, unit: pp.u, icon: 'deals', tone: 3, foot: `${open.length} 筆 · 加權 ${U.moneyCompact(pipeW)}`, spark, href: router.href('/deals', { ...listQuery(), close: null, amount: null, industry: null, q: null }) })}
        ${UI.statCard({ label: '平均成交週期', value: cNow || '–', unit: cNow ? '天' : '', icon: 'clock', tone: 5, delta: diff ? { text: `${Math.abs(diff)} 天`, dir: diff > 0 ? 'up' : 'down' } : { text: '持平', dir: 'flat' }, foot: diff > 0 ? '比上季快' : diff < 0 ? '比上季慢' : `上季 ${cLast || '–'} 天` })}`);
    }

    /* 篩選列 */
    function ownerLead() {
      const reps = store.all('reps');
      return html`<span class="dl-stack" aria-hidden="true">${reps.slice(0, 4).map((r) => UI.nameBlock(r, { size: 20, title: false }))}</span>`;
    }
    function drawFilters() {
      filtersEl.innerHTML = String(html`${FILTERS.map((f) => {
        const on = st[f.key];
        const opt = on ? f.options().find((o) => o.value === on) : null;
        const lead = opt && opt.lead ? opt.lead : f.key === 'owner' ? ownerLead() : UI.icon(f.icon, { size: 14 });
        return html`<button type="button" class="tbtn dl-fbtn${on ? ' is-on' : ''}" data-filter="${f.key}" aria-haspopup="menu" aria-expanded="false">${lead}<span>${f.label}${opt ? html`<b>：${opt.short || opt.label}</b>` : ''}</span>${UI.icon('chevronDown', { size: 14 })}</button>`;
      })}${anyFilter() ? UI.btn({ label: '清除篩選', size: 'sm', variant: 'quiet', cls: 'dl-clear', attrs: { 'data-act': 'clear' } }) : ''}`);
    }

    /* ── 看板 ── */
    let boardEl = null;
    function buildBoard() {
      bodyEl.innerHTML = String(html`
        <div class="dl-stagebar" role="tablist" aria-label="階段"></div>
        <div class="dl-board">${store.STAGES.map((s) => html`<section class="dl-lane" data-stage="${s.id}" style="--st:${raw(s.color)}" aria-label="${s.name}">
          <header class="dl-lane-head"></header>
          <div class="dl-lane-body" data-drop="${s.id}"></div>
        </section>`)}</div>
        <p class="dl-hint">拖曳卡片換階段。鍵盤聚焦卡片後按 ${UI.kbd('[')} ${UI.kbd(']')} 左右移，${UI.kbd('Enter')} 開啟。</p>`);
      boardEl = bodyEl.querySelector('.dl-board');
    }
    let pendingFocus = null;
    let barStage = null;
    let landedId = null;
    // 從儀表板漏斗帶 stage= 進來時，桌面版把看板捲到該欄並短暫標出
    let jumpStage = st.stage || null;
    function jumpToStage() {
      if (!jumpStage || U.isMobile()) { jumpStage = null; return; }
      const lane = boardEl.querySelector(`.dl-lane[data-stage="${jumpStage}"]`);
      jumpStage = null;
      if (!lane) return;
      boardEl.scrollTo({ left: Math.max(0, lane.offsetLeft - boardEl.offsetLeft - 12), behavior: U.reducedMotion() ? 'auto' : 'smooth' });
      lane.classList.add('is-jump');
      setTimeout(() => lane.classList.remove('is-jump'), 1600);
    }
    function drawBoard(rows) {
      if (!boardEl || !boardEl.isConnected) buildBoard();
      const active = document.activeElement;
      const focusId = pendingFocus || (active && active.closest && active.closest('.dl-card') && boardEl.contains(active) ? active.closest('.dl-card').dataset.id : null);
      pendingFocus = null;
      const by = Object.fromEntries(order().map((s) => [s, []]));
      rows.forEach((vm) => by[vm.d.stage] && by[vm.d.stage].push(vm));
      const openStages = store.OPEN_STAGES.map((s) => s.id);
      const pipeTotal = openStages.reduce((s, id) => s + by[id].reduce((a, vm) => a + vm.d.amount, 0), 0);
      const qp = store.quarterProgress(st.owner ? { owner: st.owner } : {});
      const counts = {};
      store.STAGES.forEach((s) => {
        const lane = boardEl.querySelector(`.dl-lane[data-stage="${s.id}"]`);
        let list = by[s.id];
        let earlier = [];
        if (s.closed) {
          earlier = list.filter((vm) => !vm.recent);
          list = list.filter((vm) => vm.recent);
          const k = (vm) => vm.d.closedAt || '';
          list.sort((a, b) => k(b).localeCompare(k(a)));
          earlier.sort((a, b) => k(b).localeCompare(k(a)));
        } else list.sort((a, b) => a.d.closeDate.localeCompare(b.d.closeDate) || b.d.amount - a.d.amount);
        counts[s.id] = list.length;
        const amt = list.reduce((a, vm) => a + vm.d.amount, 0);
        const w = list.reduce((a, vm) => a + vm.w, 0);
        let share, sub;
        if (s.id === 'won') { share = qp.target ? amt / qp.target : 0; sub = `本季 · 目標 ${Math.round(share * 100)}%`; }
        else if (s.id === 'lost') { const wonAmt = by.won.filter((vm) => vm.recent).reduce((a, vm) => a + vm.d.amount, 0); share = amt + wonAmt ? amt / (amt + wonAmt) : 0; sub = '本季流失'; }
        else { share = pipeTotal ? amt / pipeTotal : 0; sub = `加權 ${U.moneyCompact(w)} · ${Math.round(s.p * 100)}%`; }
        lane.querySelector('.dl-lane-head').innerHTML = String(html`
          <p class="dl-lane-title"><i class="dl-dot" aria-hidden="true"></i><span>${s.name}</span><span class="dl-lane-n">${list.length}</span></p>
          <p class="dl-lane-sum"><b>${amt ? U.moneyCompact(amt) : '0'}</b><span>${sub}</span></p>
          <span class="dl-share" role="img" aria-label="${s.id === 'won' ? '佔本季目標' : s.id === 'lost' ? '佔本季結案金額' : '佔進行中 pipeline'} ${Math.round(share * 100)}%"><i style="width:${(Math.min(1, share) * 100).toFixed(1)}%"></i></span>`);
        const shown = showEarlier[s.id] ? [...list, ...earlier] : list;
        const body = lane.querySelector('.dl-lane-body');
        body.innerHTML = String(html`${shown.map(cardView)}${!shown.length ? html`<p class="dl-empty">${s.closed ? '本季還沒有' + s.name + '的單' : '拖曳交易到這裡'}</p>` : ''}<div class="dl-lane-end">${earlier.length ? html`<button type="button" class="dl-earlier" data-earlier="${s.id}" aria-expanded="${String(showEarlier[s.id])}">${showEarlier[s.id] ? '收合更早的單' : `更早 ${earlier.length} 筆`}${UI.icon(showEarlier[s.id] ? 'chevronUp' : 'chevronDown', { size: 14 })}</button>` : ''}</div>`);
      });
      // 手機：一次一個階段
      if (!st.stage) st.stage = order().find((id) => counts[id] && id === 'nego') || order().find((id) => counts[id]) || 'lead';
      boardEl.querySelectorAll('.dl-lane').forEach((l) => l.classList.toggle('is-active', l.dataset.stage === st.stage));
      const bar = bodyEl.querySelector('.dl-stagebar');
      const keepLeft = bar.scrollLeft;
      bar.innerHTML = String(html`${store.STAGES.map((s) => html`<button type="button" class="dl-pill" role="tab" aria-selected="${String(s.id === st.stage)}" data-pill="${s.id}" style="--st:${raw(s.color)}"><i aria-hidden="true"></i><span>${s.name}</span><b>${counts[s.id]}</b></button>`)}`);
      bar.scrollLeft = keepLeft;
      if (bar.offsetParent && barStage !== st.stage) {
        const p = bar.querySelector(`[data-pill="${st.stage}"]`);
        if (p) bar.scrollLeft = p.offsetLeft - (bar.clientWidth - p.offsetWidth) / 2;
      }
      barStage = st.stage;
      if (focusId) { const c = boardEl.querySelector(`.dl-card[data-id="${focusId}"]`); c && c.focus({ preventScroll: false }); }
      if (landedId) {
        const c = boardEl.querySelector(`.dl-card[data-id="${landedId}"]`);
        landedId = null;
        if (c && !U.reducedMotion()) { c.classList.add('is-landed'); setTimeout(() => c.classList.remove('is-landed'), 1200); }
      }
    }

    /* ── 清單 ── */
    let listSort = { key: st.sort, dir: st.dir };
    function columns() {
      return [
        { key: 'name', label: '交易', m: 'primary', width: '25%', sort: (vm) => vm.d.name, render: (vm) => html`<span class="dl-deal"><span class="dl-deal-name">${vm.d.name}</span><span class="dl-deal-sub"><span class="dl-code">${vm.d.code}</span>${vm.items ? html`<span class="dl-deal-items">${vm.items}</span>` : ''}</span></span>` },
        { key: 'company', label: '公司', m: 'meta', width: '19%', cls: 'dl-col-co', sort: (vm) => (vm.co ? vm.co.name : null), render: (vm) => (vm.co ? html`<a class="dl-co" href="${router.href('/companies/' + vm.co.id)}" data-co="${vm.co.id}">${UI.companyMark(vm.co, { size: 26, title: false })}<span>${vm.co.name}</span></a>` : html`<span class="t-3">無</span>`) },
        st.group === 'stage' ? null : { key: 'stage', label: '階段', m: 'meta', sort: (vm) => order().indexOf(vm.d.stage), render: (vm) => UI.stageTag(vm.d.stage) },
        { key: 'close', label: '預計成交', m: 'meta', sort: (vm) => vm.d.closeDate, render: (vm) => (vm.open ? html`<span class="dl-close${vm.overdue ? ' is-overdue' : ''}">${U.fmtDate(vm.d.closeDate)}${vm.overdue ? html`<span class="dl-od">逾期 ${vm.overdue} 天</span>` : ''}</span>` : dueChip(vm)) },
        { key: 'owner', label: '負責人', m: 'hide', cls: 'dl-col-owner', sort: (vm) => (vm.rep ? vm.rep.name : null), render: (vm) => (vm.rep ? html`<span class="dl-rep">${UI.nameBlock(vm.rep, { size: 26, title: false })}<span>${vm.rep.name}</span></span>` : '') },
        { key: 'days', label: '停留', m: 'hide', align: 'right', cls: 'dl-col-days', sort: (vm) => (vm.open ? vm.days : null), defaultDir: -1, render: (vm) => (vm.open ? html`<span class="dl-days${vm.days >= STALE_DAYS ? ' is-stale' : ''}">${vm.days} 天</span>` : html`<span class="t-3">–</span>`) },
        { key: 'amount', label: '金額', m: 'end', align: 'right', sort: (vm) => vm.d.amount, defaultDir: -1, render: (vm) => html`<span class="dl-amt">${UI.money(vm.d.amount, { compact: true, lost: vm.d.stage === 'lost', cls: 'dl-amt-v' })}${vm.open ? html`<span class="dl-amt-w">加權 ${U.moneyCompact(vm.w)}</span>` : ''}</span>` },
      ].filter(Boolean);
    }
    function groupsOf(rows) {
      const D = dates();
      if (st.group === 'owner') {
        return store.all('reps').map((r) => {
          const qp = store.quarterProgress({ owner: r.id });
          return { key: r.id, lead: UI.nameBlock(r, { size: 26, title: false }), title: r.name, note: `本季達成 ${Math.round(qp.pct * 100)}%`, rows: rows.filter((vm) => vm.d.owner === r.id) };
        }).filter((g) => g.rows.length);
      }
      if (st.group === 'month') {
        const m = {};
        rows.forEach((vm) => { const k = vm.d.closeDate.slice(0, 7); (m[k] = m[k] || []).push(vm); });
        return Object.keys(m).sort().map((k) => {
          const [y, mo] = k.split('-').map(Number);
          const od = m[k].filter((vm) => vm.overdue).length;
          const isNow = k === D.today.slice(0, 7);
          return { key: k, lead: UI.icon('calendar', { size: 16 }), title: `${y} 年 ${mo} 月`, note: [isNow ? '本月' : '', od ? `${od} 筆逾期` : ''].filter(Boolean).join(' · '), overdue: od > 0, rows: m[k] };
        });
      }
      return store.STAGES.map((s) => ({ key: s.id, lead: html`<i class="dl-dot" style="--st:${raw(s.color)}"></i>`, title: s.name, note: s.closed ? '' : `機率 ${Math.round(s.p * 100)}%`, rows: rows.filter((vm) => vm.d.stage === s.id) })).filter((g) => g.rows.length);
    }
    function sortRows(list, cols) {
      const c = cols.find((x) => x.key === listSort.key);
      if (!c) return list;
      return list.slice().sort((a, b) => {
        const x = c.sort(a), y = c.sort(b);
        if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
        return (typeof x === 'string' ? x.localeCompare(y, 'zh-Hant') : x - y) * listSort.dir;
      });
    }
    function drawList(rows) {
      if (!bodyEl.querySelector('.dl-list')) {
        bodyEl.innerHTML = String(html`<div class="dl-listbar"><span class="dl-listbar-l">分組</span><div class="dl-groups"></div></div><section class="dl-list" aria-label="交易清單"></section>`);
        boardEl = null;
      }
      bodyEl.querySelector('.dl-groups').innerHTML = String(UI.tabs({ name: 'dl-group', value: st.group, items: GROUPS.map((g) => ({ value: g.value, label: g.label })), cls: 'dl-gtabs' }));
      const cols = columns();
      const groups = groupsOf(rows);
      const head = html`<thead><tr>${cols.map((c) => {
        const on = listSort.key === c.key;
        return html`<th scope="col" class="${c.align ? 'is-' + c.align : ''} ${c.cls || ''}"${UI.attrs({ 'aria-sort': on ? (listSort.dir > 0 ? 'ascending' : 'descending') : 'none', style: c.width ? `width:${c.width}` : null })}><button type="button" class="tbl-sort${on ? ' is-active' : ''}" data-sort="${c.key}"><span>${c.label}</span>${UI.icon(on && listSort.dir < 0 ? 'chevronDown' : 'chevronUp', { size: 14, cls: 'tbl-sort-ic' })}</button></th>`;
      })}</tr></thead>`;
      const bodies = groups.map((g) => {
        const amt = g.rows.reduce((s, vm) => s + vm.d.amount, 0);
        const w = g.rows.reduce((s, vm) => s + (vm.open ? vm.w : 0), 0);
        const openN = g.rows.filter((vm) => vm.open).length;
        return html`<tbody class="dl-gbody" data-group="${g.key}"><tr class="dl-grow"><td colspan="${cols.length}"><span class="dl-grow-in"><span class="dl-grow-lead">${g.lead}</span><b class="dl-grow-t">${g.title}</b><span class="dl-grow-n">${g.rows.length} 筆</span>${g.note ? html`<span class="dl-grow-note${g.overdue ? ' is-overdue' : ''}">${g.note}</span>` : ''}<span class="dl-grow-sum"><b>${U.moneyCompact(amt)}</b>${openN ? html`<span>加權 ${U.moneyCompact(w)}</span>` : ''}</span></span></td></tr>
          ${sortRows(g.rows, cols).map((vm) => html`<tr class="is-clickable${vm.d.stage === 'lost' ? ' is-lost' : ''}" tabindex="0" data-id="${vm.id}">${cols.map((c) => html`<td class="${c.align ? 'is-' + c.align : ''} ${c.cls || ''}" data-m="${c.m}"${c.m === 'meta' ? UI.attrs({ 'data-label': '' }) : ''}>${c.render(vm)}</td>`)}</tr>`)}</tbody>`;
      });
      const empty = html`<tbody><tr class="tbl-empty"><td colspan="${cols.length}">${emptyView()}</td></tr></tbody>`;
      bodyEl.querySelector('.dl-list').innerHTML = String(html`<table class="tbl dl-tbl"><caption class="sr-only">交易清單，${GROUPS.find((g) => g.value === st.group).label}</caption>${head}${groups.length ? bodies : empty}</table>`);
    }
    const emptyView = () => html`<div class="dl-emptyall">${UI.emptyState({
      title: '沒有符合條件的交易',
      body: '換個關鍵字（名稱、單號、公司都能搜），或放寬篩選。',
      action: UI.btn({ label: '清除篩選', icon: 'close', size: 'sm', attrs: { 'data-act': 'clear' } }),
      compact: true,
    })}</div>`;

    function draw() {
      if (!alive) return;
      const rows = apply(vms, st);
      drawStats();
      drawFilters();
      const open = rows.filter((vm) => vm.open);
      countEl.textContent = `${open.length} 筆進行中 · ${U.moneyCompact(open.reduce((s, vm) => s + vm.d.amount, 0))}`;
      page.classList.toggle('is-board', st.view === 'board');
      page.classList.toggle('is-list', st.view === 'list');
      if (st.view === 'board') { drawBoard(rows); jumpToStage(); } else drawList(rows);
    }
    function setView(v) {
      if (v === st.view) return;
      st.view = v;
      [header, page].flatMap((x) => [...x.querySelectorAll('[data-seg="dl-view"]')]).forEach((g) => g.querySelectorAll(':scope > button').forEach((b) => { const on = b.dataset.value === v; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }));
      bodyEl.innerHTML = '';
      boardEl = null;
      syncUrl();
      draw();
    }
    draw();
    restoreScroll(page);

    /* 重繪排程：拖曳進行中先不重繪；延到下一個 frame，讓成交入帳先量到卡片位置 */
    let raf = 0, pending = false;
    const schedule = () => {
      if (drag || lostPending) { pending = true; return; }
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; if (!alive) return; vms = buildVMs(); draw(); });
    };
    const flushPending = () => { if (pending) { pending = false; schedule(); } };

    /* 搜尋 */
    const pushQ = U.debounce(() => syncUrl(), 300);
    searchEl.addEventListener('input', () => { st.q = searchEl.value; draw(); pushQ(); });
    searchEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && searchEl.value) { e.stopPropagation(); searchEl.value = ''; st.q = ''; draw(); syncUrl(); } });

    /* 檢視與分組 */
    const onSeg = (e) => { if (e.detail.name === 'dl-view') setView(e.detail.value); };
    header.addEventListener('seg-change', onSeg);
    page.addEventListener('seg-change', onSeg);
    page.addEventListener('tab-change', (e) => {
      if (e.detail.name !== 'dl-group') return;
      st.group = e.detail.value;
      syncUrl();
      draw();
      const b = page.querySelector(`.dl-gtabs [data-value="${st.group}"]`);
      b && b.focus({ preventScroll: true });
    });
    header.querySelector('[data-act="new"]').addEventListener('click', () => UI.create('deal', st.owner ? { owner: st.owner } : {}));

    /* 點擊委派 */
    page.addEventListener('click', (e) => {
      const fb = e.target.closest('[data-filter]');
      if (fb) {
        const f = FILTERS.find((x) => x.key === fb.dataset.filter);
        const base = apply(vms, st, { skipFilter: f.key });
        const items = [
          { label: f.all, checked: !st[f.key], hint: String(base.length), value: '' },
          { divider: true },
          ...f.options().map((o) => ({ label: o.label, lead: o.lead, value: o.value, checked: st[f.key] === o.value, hint: String(base.filter((vm) => f.match(vm, o.value)).length) })),
        ];
        UI.menu(fb, items, {
          label: f.label, cls: 'dl-fmenu',
          onSelect: (it) => {
            st[f.key] = it.value;
            syncUrl();
            draw();
            const again = filtersEl.querySelector(`[data-filter="${f.key}"]`);
            again && again.focus({ preventScroll: true });
          },
        });
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'clear') { clearAll(); searchEl.focus({ preventScroll: true }); return; }
      const pill = e.target.closest('[data-pill]');
      if (pill) { st.stage = pill.dataset.pill; syncUrl(); draw(); const p = page.querySelector(`[data-pill="${st.stage}"]`); if (p && e.detail === 0) p.focus({ preventScroll: true }); return; }
      const ear = e.target.closest('[data-earlier]');
      if (ear) { const k = ear.dataset.earlier; showEarlier[k] = !showEarlier[k]; draw(); const b = page.querySelector(`[data-earlier="${k}"]`); if (b && e.detail === 0) b.focus({ preventScroll: true }); return; }
      const co = e.target.closest('[data-co]');
      if (co && !e.metaKey && !e.ctrlKey) { e.preventDefault(); UI.openCompany(co.dataset.co); return; }
      const s = e.target.closest('[data-sort]');
      if (s) {
        const k = s.dataset.sort;
        const c = columns().find((x) => x.key === k) || { defaultDir: 1 };
        listSort = listSort.key === k ? { key: k, dir: -listSort.dir } : { key: k, dir: c.defaultDir || 1 };
        st.sort = listSort.key; st.dir = listSort.dir;
        syncUrl();
        draw();
        const again = page.querySelector(`[data-sort="${k}"]`); again && again.focus({ preventScroll: true });
        return;
      }
      const card = e.target.closest('.dl-card');
      if (card) { if (suppressClick) return; openDeal(card.dataset.id); return; }
      const tr = e.target.closest('tr[data-id]');
      if (tr && !e.target.closest('a,button,input')) openDeal(tr.dataset.id);
    });

    /* 鍵盤：[ ] 換階段、Enter 開啟 */
    page.addEventListener('keydown', (e) => {
      if (U.isTyping(e) || UI.layers.length) return;
      const card = e.target.closest && e.target.closest('.dl-card');
      const tr = e.target.closest && e.target.closest('tr[data-id]');
      if (tr && e.target === tr && e.key === 'Enter') { e.preventDefault(); openDeal(tr.dataset.id); return; }
      if (!card || e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDeal(card.dataset.id); return; }
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const d = store.get('deals', card.dataset.id);
        const ids = order();
        const to = ids[ids.indexOf(d.stage) + (e.key === ']' ? 1 : -1)];
        if (!to) return;
        commitMove(d.id, to, card, { follow: true });
      }
    });

    /* ── 換階段（拖曳、鍵盤共用） ── */
    let lostPending = false;
    function commitMove(id, to, cardEl, { follow = false } = {}) {
      const d = store.get('deals', id);
      if (!d || d.stage === to) { schedule(); return; }
      if (follow) pendingFocus = id; else landedId = id;
      // 手機一次只看一個階段：鍵盤移動時跟著卡片走；拖到分頁鈕上則留在原本的階段
      if (follow && U.isMobile()) st.stage = to;
      if (to === 'lost') { askLost(id, cardEl); return; }
      CRM.actions.moveDealStage(id, to, { sourceEl: cardEl });
    }
    function askLost(id, anchor) {
      lostPending = true;
      let chosen = false;
      const d = store.get('deals', id);
      const layer = UI.menu(anchor, [{ heading: `「${d.name}」未成原因` }, ...LOST_REASONS.map((r) => ({
        label: r, value: r,
        onSelect: () => { chosen = true; lostPending = false; pending = false; CRM.actions.moveDealStage(id, 'lost', { lostReason: r }); },
      }))], { label: '未成原因', cls: 'dl-lostmenu' });
      const cancel = () => { lostPending = false; pending = false; if (!alive) return; pendingFocus = id; vms = buildVMs(); draw(); };
      if (!layer) { cancel(); return; }
      const orig = layer.close;
      layer.close = (o) => { orig.call(layer, o); setTimeout(() => { if (!chosen) cancel(); }, 0); };
    }

    /* ── 拖曳（pointer events，滑鼠與觸控） ── */
    let drag = null, press = null, suppressClick = false;
    function endPress() {
      if (!press) return;
      clearTimeout(press.timer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      press = null;
    }
    page.addEventListener('pointerdown', (e) => {
      if (st.view !== 'board' || e.button > 0 || drag) return;
      const card = e.target.closest('.dl-card');
      if (!card || e.target.closest('a,button')) return;
      press = { card, id: card.dataset.id, x: e.clientX, y: e.clientY, pid: e.pointerId, touch: e.pointerType === 'touch', timer: 0 };
      if (press.touch) press.timer = setTimeout(() => { if (press) beginDrag(press.x, press.y); }, 280);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onCancel);
    });
    const blockTouch = (e) => { if (drag) e.preventDefault(); };
    document.addEventListener('touchmove', blockTouch, { passive: false });
    const blockMenu = (e) => { if (drag || (press && press.touch)) e.preventDefault(); };
    page.addEventListener('contextmenu', blockMenu);

    function onMove(e) {
      if (!press && !drag) return;
      if (!drag) {
        const dist = Math.hypot(e.clientX - press.x, e.clientY - press.y);
        if (press.touch) { if (dist > 8) endPress(); return; }
        if (dist > 6) beginDrag(e.clientX, e.clientY); else return;
      }
      drag.last = { x: e.clientX, y: e.clientY };
      moveGhost();
      locate();
    }
    function beginDrag(x, y) {
      const card = press.card;
      const r = card.getBoundingClientRect();
      const ghost = card.cloneNode(true);
      ghost.classList.add('dl-ghost');
      ghost.removeAttribute('tabindex');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = r.width + 'px';
      document.body.appendChild(ghost);
      const slot = document.createElement('div');
      slot.className = 'dl-slot';
      slot.style.height = r.height + 'px';
      card.after(slot);
      card.classList.add('is-source');
      drag = { id: press.id, card, ghost, slot, from: card.closest('.dl-lane').dataset.stage, off: { x: x - r.left, y: y - r.top }, last: { x, y }, target: null, overBody: null, raf: 0 };
      clearTimeout(press.timer);
      document.documentElement.classList.add('dl-dragging');
      moveGhost();
      locate();
      drag.raf = requestAnimationFrame(autoScroll);
    }
    function moveGhost() {
      const { ghost, last, off } = drag;
      ghost.style.transform = `translate(${Math.round(last.x - off.x)}px, ${Math.round(last.y - off.y)}px) rotate(2.5deg)`;
    }
    function locate() {
      const { x, y } = drag.last;
      const hit = document.elementFromPoint(x, y);
      const pill = hit && hit.closest('.pg-deals [data-pill]');
      const body = !pill && hit && (hit.closest('.pg-deals .dl-lane-body') || (hit.closest('.pg-deals .dl-lane') && hit.closest('.pg-deals .dl-lane').querySelector('.dl-lane-body')));
      page.querySelectorAll('.dl-lane.is-over, .dl-pill.is-over').forEach((n) => n.classList.remove('is-over'));
      drag.overBody = body || null;
      if (pill) {
        pill.classList.add('is-over');
        drag.target = pill.dataset.pill;
        drag.slot.hidden = true;
        return;
      }
      if (body && body.offsetParent) {
        const lane = body.closest('.dl-lane');
        lane.classList.add('is-over');
        drag.target = lane.dataset.stage;
        drag.slot.hidden = false;
        const cards = [...body.querySelectorAll('.dl-card:not(.is-source)')];
        let before = null;
        for (const c of cards) { const r = c.getBoundingClientRect(); if (y < r.top + r.height / 2) { before = c; break; } }
        const ref = before || body.querySelector('.dl-empty') || body.querySelector('.dl-lane-end');
        if (drag.slot.nextElementSibling !== ref || drag.slot.parentElement !== body) body.insertBefore(drag.slot, ref);
        return;
      }
      drag.target = null;
      drag.slot.hidden = true;
    }
    function autoScroll() {
      if (!drag) return;
      const { x, y } = drag.last;
      let moved = false;
      if (U.isMobile()) {
        if (y < 110) { window.scrollBy(0, -12); moved = true; } else if (y > window.innerHeight - 110) { window.scrollBy(0, 12); moved = true; }
      } else if (boardEl) {
        const b = boardEl.getBoundingClientRect();
        const edge = 72;
        if (y > b.top && y < b.bottom) {
          if (x < b.left + edge && boardEl.scrollLeft > 0) { boardEl.scrollLeft -= Math.ceil((b.left + edge - x) / 5); moved = true; } else if (x > b.right - edge) { const before = boardEl.scrollLeft; boardEl.scrollLeft += Math.ceil((x - (b.right - edge)) / 5); moved = moved || boardEl.scrollLeft !== before; }
        }
        const body = drag.overBody;
        if (body) {
          const r = body.getBoundingClientRect();
          if (y < r.top + 48 && body.scrollTop > 0) { body.scrollTop -= 10; moved = true; } else if (y > r.bottom - 48) { const before = body.scrollTop; body.scrollTop += 10; moved = moved || body.scrollTop !== before; }
        }
      }
      if (moved) locate();
      drag.raf = requestAnimationFrame(autoScroll);
    }
    function finishDrag(commit) {
      const g = drag;
      drag = null;
      cancelAnimationFrame(g.raf);
      document.documentElement.classList.remove('dl-dragging');
      page.querySelectorAll('.dl-lane.is-over, .dl-pill.is-over').forEach((n) => n.classList.remove('is-over'));
      g.ghost.remove();
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      const to = commit ? g.target : null;
      if (to && to !== g.from && !g.slot.hidden) g.slot.replaceWith(g.card); else g.slot.remove();
      g.card.classList.remove('is-source');
      if (to && to !== g.from) commitMove(g.id, to, g.card);
      else { pending = false; schedule(); }
      flushPending();
    }
    function onUp() {
      const wasDrag = !!drag;
      endPress();
      if (wasDrag) finishDrag(true);
    }
    function onCancel() {
      const wasDrag = !!drag;
      endPress();
      if (wasDrag) finishDrag(false);
    }
    const onEsc = (e) => { if (e.key === 'Escape' && drag) { e.preventDefault(); endPress(); finishDrag(false); } };
    document.addEventListener('keydown', onEsc, true);

    const off = store.subscribe((evt) => {
      if (!evt.has('deals', 'companies', 'reps', 'contacts', 'activities')) return;
      schedule();
    });

    return {
      openDeal,
      cleanup() {
        alive = false;
        off();
        cancelAnimationFrame(raf);
        if (drag) { cancelAnimationFrame(drag.raf); drag.ghost.remove(); drag = null; document.documentElement.classList.remove('dl-dragging'); }
        endPress();
        document.removeEventListener('touchmove', blockTouch);
        document.removeEventListener('keydown', onEsc, true);
      },
    };
  }

  /* ════════ 交易抽屜 ════════ */
  const TYPE_ICON = { call: 'phone', email: 'mail', meeting: 'meeting', note: 'note', task: 'check', stage: 'stage' };
  const TYPE_NAME = { call: '通話', email: 'Email', meeting: '會議', note: '筆記', task: '完成任務', stage: '階段變更' };

  function openDrawer(id, { onClose }) {
    const store = S();
    const UI = ui();
    const router = R();
    const cur = () => store.get('deals', id);
    let items = cur().items.map((x) => ({ ...x }));
    let tlLimit = 20;

    const body = h(html`<div class="dl-d">
      <header class="dl-dh"></header>
      <section class="dl-dsec dl-steps" aria-label="階段進度"></section>
      <section class="dl-dsec dl-items" aria-label="報價品項"></section>
      <div class="dl-dgrid">
        <section class="dl-dsec dl-people" aria-label="聯絡人"></section>
        <section class="dl-dsec dl-next" aria-label="下一步"></section>
      </div>
      <section class="dl-dsec dl-tl" aria-label="活動紀錄"></section>
    </div>`);
    const dr = UI.drawer({ head: false, body, width: 680, cls: 'dl-drawer', label: `交易：${cur().name}`, onClose });
    const q = (s) => body.querySelector(s);
    const headEl = q('.dl-dh'), stepsEl = q('.dl-steps'), itemsEl = q('.dl-items'), peopleEl = q('.dl-people'), nextEl = q('.dl-next'), tlEl = q('.dl-tl');

    function drawHead() {
      const d = cur();
      const co = store.get('companies', d.companyId);
      const rep = store.rep(d.owner);
      const s = store.stage(d.stage);
      const open = store.isOpen(d);
      const overdue = open && U.daysFromToday(d.closeDate) < 0 ? -U.daysFromToday(d.closeDate) : 0;
      const lastOpen = [...(d.history || [])].reverse().find((e) => store.stage(e.stage) && !store.stage(e.stage).closed);
      let when;
      if (d.stage === 'won') when = html`<span class="dl-dh-k">成交於</span><b>${U.fmtDate(d.closedAt)} ${U.weekday(U.parse(d.closedAt))}</b>`;
      else if (d.stage === 'lost') when = html`<span class="dl-dh-k">未成原因</span><b>${d.lostReason || '未填'}</b>`;
      else when = html`<span class="dl-dh-k">預計成交</span><b class="${overdue ? 't-accent' : ''}">${U.fmtDate(d.closeDate)} ${U.weekday(U.parse(d.closeDate))}</b>${overdue ? html`<span class="dl-od">逾期 ${overdue} 天</span>` : html`<span class="dl-dh-k">${U.daysFromToday(d.closeDate) === 0 ? '就是今天' : `還有 ${U.daysFromToday(d.closeDate)} 天`}</span>`}`;
      headEl.innerHTML = String(html`
        <div class="dl-dh-top"><span class="dl-code">${d.code}</span>${UI.stageTag(d.stage)}<span class="dl-dh-tools">${UI.iconBtn('edit', { label: '編輯交易', size: 'sm', attrs: { 'data-act': 'edit' } })}${UI.iconBtn('close', { label: '關閉', size: 'sm', tip: false, attrs: { 'data-close': '' } })}</span></div>
        <h2 class="dl-dh-name">${d.name}</h2>
        <p class="dl-dh-meta">${co ? html`<a class="dl-dh-co" href="${router.href('/companies/' + co.id)}">${UI.companyMark(co, { size: 22, title: false })}<span>${co.name}</span></a>` : ''}${rep ? html`<span class="dl-dh-rep">${UI.nameBlock(rep, { size: 22, title: false })}<span>${rep.name}負責</span></span>` : ''}<span class="dl-dh-k">建立於 ${U.fmtDate(d.createdAt)}</span></p>
        <div class="dl-dh-money">
          <div class="dl-dh-amtbox"><p class="dl-dh-amt">${UI.money(d.amount, { lost: d.stage === 'lost' })}</p><p class="dl-dh-sub">${open ? `加權 ${U.moneyCompact(store.weightedValue(d))} · 成交機率 ${Math.round(s.p * 100)}%` : d.stage === 'won' ? '已計入本季業績' : '不計入 pipeline'}</p></div>
          <div class="dl-dh-when">${when}</div>
        </div>
        <div class="dl-dh-acts">
          ${open ? html`${UI.btn({ label: '標記成交', icon: 'check', variant: 'primary', size: 'sm', attrs: { 'data-act': 'won' } })}${UI.btn({ label: '標記未成', icon: 'close', variant: 'danger', size: 'sm', attrs: { 'data-act': 'lost', 'aria-haspopup': 'menu' } })}` : UI.btn({ label: d.stage === 'won' ? '移回議價' : `重新開啟（回到${lastOpen ? store.stage(lastOpen.stage).name : '新線索'}）`, icon: 'undo', size: 'sm', attrs: { 'data-act': 'reopen', 'data-to': d.stage === 'won' ? 'nego' : lastOpen ? lastOpen.stage : 'lead' } })}
          ${UI.btn({ label: '記一筆', icon: 'plus', size: 'sm', attrs: { 'data-act': 'log' } })}
          ${UI.btn({ label: '新增任務', icon: 'tasks', size: 'sm', attrs: { 'data-act': 'task' } })}
        </div>`);
    }
    function drawSteps() {
      const d = cur();
      const spans = stageSpans(d);
      const ids = store.OPEN_STAGES.map((s) => s.id);
      const curIdx = ids.indexOf(d.stage);
      const closed = !store.isOpen(d);
      const outcome = closed ? store.stage(d.stage) : null;
      const step = (s, i) => {
        const sp = spans[s.id];
        const isCur = d.stage === s.id;
        const done = closed ? !!sp : i < curIdx;
        const state = isCur ? 'is-current' : done ? 'is-done' : 'is-todo';
        const meta = sp ? `${U.fmtDate(sp.at)} · ${sp.days} 天` : done || closed ? '略過' : '尚未進入';
        return html`<li class="dl-step ${state}" style="--st:${raw(s.color)}"><button type="button" class="dl-step-btn" data-move="${s.id}"${isCur ? raw(' aria-current="step"') : ''} data-tip="${isCur ? '目前階段' : '移到' + s.name}"><span class="dl-step-bar"></span><span class="dl-step-name">${s.name}</span><span class="dl-step-meta">${meta}</span></button></li>`;
      };
      stepsEl.innerHTML = String(html`<div class="dl-sec-h"><h3 class="dl-sec-t">階段進度</h3><span class="dl-sec-n">${closed ? `歷時 ${U.daysBetween(d.createdAt, d.closedAt || U.iso(U.today()))} 天` : `已進行 ${U.daysBetween(d.createdAt, U.iso(U.today()))} 天`}</span></div>
        <ol class="dl-steps-list">${store.OPEN_STAGES.map(step)}
          <li class="dl-step ${outcome ? 'is-current is-final' : 'is-todo'}" style="--st:${raw(outcome ? outcome.color : 'var(--line-strong)')}"><span class="dl-step-btn is-static"><span class="dl-step-bar"></span><span class="dl-step-name">${outcome ? outcome.name : '結案'}</span><span class="dl-step-meta">${outcome ? U.fmtDate(d.closedAt) : '成交或未成'}</span></span></li>
        </ol>`);
    }
    function lineRow(it, i) {
      return html`<div class="lines-row" data-line="${i}">
        <span class="select-wrap"><select class="input select" name="sku" aria-label="品項">${store.PRODUCTS.map((p) => html`<option value="${p.sku}"${p.sku === it.sku ? raw(' selected') : ''}>${p.sku}　${p.short}</option>`)}</select>${UI.icon('chevronDown', { size: 16, cls: 'select-caret' })}</span>
        <input class="input t-right" name="qty" type="number" min="1" value="${it.qty}" aria-label="數量" inputmode="numeric">
        <input class="input t-right" name="price" type="number" min="0" step="100" value="${it.price}" aria-label="單價" inputmode="numeric">
        <span class="lines-total">${U.money(it.qty * it.price)}</span>
        ${UI.iconBtn('trash', { label: '移除品項', size: 'sm', attrs: { 'data-remove': i } })}
      </div>`;
    }
    function drawItems() {
      const active = document.activeElement;
      const keep = active && itemsEl.contains(active) && active.closest('[data-line]') ? { line: active.closest('[data-line]').dataset.line, name: active.name } : null;
      items = cur().items.map((x) => ({ ...x }));
      itemsEl.innerHTML = String(html`<div class="dl-sec-h"><h3 class="dl-sec-t">報價品項</h3><span class="dl-sec-n">${items.length} 項</span></div>
        <div class="lines dl-lines"><div class="lines-head" aria-hidden="true"><span>品項</span><span class="t-right">數量</span><span class="t-right">單價</span><span class="t-right">小計</span><span></span></div>
          <div class="lines-body">${items.map(lineRow)}</div>
          <div class="lines-foot">${UI.btn({ label: '加一項', icon: 'plus', variant: 'quiet', size: 'sm', attrs: { 'data-add': '' } })}<span class="lines-sum">合計（交易金額）<b class="lines-sum-val">${U.money(store.itemsTotal(items))}</b></span></div>
        </div>`);
      if (keep) { const x = itemsEl.querySelector(`[data-line="${keep.line}"] [name="${keep.name}"]`); x && x.focus({ preventScroll: true }); }
    }
    function commitItems(msg) {
      const clean = items.map((x) => ({ sku: x.sku, qty: Math.max(1, Math.round(+x.qty) || 1), price: Math.max(0, Math.round(+x.price) || 0) }));
      const before = cur().amount;
      const { undo } = store.batch(() => store.update('deals', id, { items: clean }));
      const after = cur().amount;
      UI.toast(`${msg}${after !== before ? `，金額 ${U.money(after)}` : ''}`, { undo });
    }
    itemsEl.addEventListener('input', (e) => {
      const row = e.target.closest('[data-line]');
      if (!row || (e.target.name !== 'qty' && e.target.name !== 'price')) return;
      const it = items[+row.dataset.line];
      it[e.target.name] = +e.target.value || 0;
      row.querySelector('.lines-total').textContent = U.money(it.qty * it.price);
      itemsEl.querySelector('.lines-sum-val').textContent = U.money(store.itemsTotal(items));
    });
    itemsEl.addEventListener('change', (e) => {
      const row = e.target.closest('[data-line]');
      if (!row) return;
      const it = items[+row.dataset.line];
      if (e.target.name === 'sku') { const p = store.product(e.target.value); it.sku = e.target.value; it.price = p ? p.price : it.price; commitItems(`品項改為 ${it.sku}`); return; }
      const orig = cur().items[+row.dataset.line];
      if (orig && +orig[e.target.name] === +it[e.target.name]) return;
      commitItems(`已更新 ${it.sku} 的${e.target.name === 'qty' ? '數量' : '單價'}`);
    });
    itemsEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); e.target.blur(); } });
    itemsEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) {
        const used = new Set(items.map((x) => x.sku));
        const p = store.PRODUCTS.find((x) => !used.has(x.sku)) || store.PRODUCTS[0];
        items.push({ sku: p.sku, qty: 1, price: p.price });
        commitItems(`已加入 ${p.sku}`);
        requestAnimationFrame(() => { const rows = itemsEl.querySelectorAll('[data-line]'); const last = rows[rows.length - 1]; last && last.querySelector('select').focus(); });
        return;
      }
      const rm = e.target.closest('[data-remove]');
      if (rm) {
        if (items.length <= 1) { UI.toast('至少要保留一個報價品項'); return; }
        const [gone] = items.splice(+rm.dataset.remove, 1);
        commitItems(`已移除 ${gone.sku}`);
      }
    });

    function drawPeople() {
      const d = cur();
      const people = d.contactIds.map((c) => store.get('contacts', c)).filter(Boolean);
      peopleEl.innerHTML = String(html`<div class="dl-sec-h"><h3 class="dl-sec-t">聯絡人</h3><span class="dl-sec-n">${people.length ? people.length + ' 位' : ''}</span></div>
        ${people.length ? html`<ul class="dl-people-list">${people.map((c, i) => html`<li class="dl-person">${UI.personCell(c, { size: 34, sub: c.title + (i === 0 ? ' · 主要窗口' : ''), href: router.href('/contacts/' + c.id) })}${UI.warmth(store.warmth({ contactId: c.id }), { label: false })}</li>`)}</ul>` : html`<p class="dl-side-empty">還沒有關聯聯絡人，可以在編輯交易時指定。</p>`}`);
    }
    function drawNext() {
      const d = cur();
      const tasks = store.tasksFor({ dealId: id }, { open: true }).slice().sort((a, b) => (a.due + (a.dueTime || '')).localeCompare(b.due + (b.dueTime || '')));
      nextEl.innerHTML = String(html`<div class="dl-sec-h"><h3 class="dl-sec-t">下一步</h3><span class="dl-sec-n">${tasks.length ? tasks.length + ' 件' : ''}</span>${UI.iconBtn('plus', { label: '新增下一步', size: 'sm', attrs: { 'data-act': 'task' } })}</div>
        ${tasks.length ? html`<ul class="dl-task-list">${tasks.slice(0, 4).map((t) => html`<li class="dl-task">${UI.checkbox({ attrs: { 'data-task': t.id, 'aria-label': '完成：' + t.title } })}<span class="dl-task-text"><span>${t.title}</span>${UI.due(t.due, t.dueTime)}</span></li>`)}</ul>` : html`<p class="dl-side-empty">${d.next ? d.next : '還沒有排下一步。成交前的每一步都值得寫下來。'}</p>`}`);
    }
    function evView(a) {
      const rep = store.rep(a.owner);
      const c = a.contactId ? store.get('contacts', a.contactId) : null;
      const meta = [];
      if (a.type === 'call' && a.duration) meta.push(U.duration(a.duration));
      if (a.type === 'meeting') { if (a.location) meta.push(a.location); if (a.duration) meta.push(U.duration(a.duration)); }
      let bodyView = html`<p class="dl-ev-text">${a.body}</p>`;
      if (a.type === 'email') bodyView = html`<p class="dl-ev-subj">${a.subject || '（無主旨）'}</p>${a.body ? html`<p class="dl-ev-text">${a.body}</p>` : ''}`;
      if (a.type === 'meeting' && a.title && a.title !== a.body) bodyView = html`<p class="dl-ev-subj">${a.title}</p><p class="dl-ev-text">${a.body}</p>`;
      if (a.type === 'stage') bodyView = html`<p class="dl-ev-text dl-ev-stage">${a.from ? UI.stageTag(a.from) : ''}${UI.icon('arrowRight', { size: 14 })}${UI.stageTag(a.to)}${a.to === 'lost' && /：/.test(a.body || '') ? html`<span class="t-3">${a.body.split('：').slice(1).join('：')}</span>` : ''}</p>`;
      return html`<li class="dl-ev" data-type="${a.type}">
        <span class="dl-ev-ic" aria-hidden="true">${UI.icon(TYPE_ICON[a.type] || 'note', { size: 16 })}</span>
        <div class="dl-ev-main">
          <p class="dl-ev-head"><span class="dl-ev-type">${TYPE_NAME[a.type] || a.type}</span>${meta.length ? html`<span class="dl-ev-meta">${meta.join(' · ')}</span>` : ''}<time class="dl-ev-time" datetime="${a.at}">${U.time(a.at)}</time></p>
          ${bodyView}
          ${rep || c ? html`<p class="dl-ev-foot">${rep ? html`<span class="dl-ev-who">${UI.nameBlock(rep, { size: 18, title: false })}${rep.name}</span>` : ''}${c ? html`<a class="dl-ev-ct" href="${router.href('/contacts/' + c.id)}">${UI.icon('user', { size: 13 })}<span>${c.name}</span></a>` : ''}</p>` : ''}
        </div>
      </li>`;
    }
    function dayLabel(d) {
      const diff = U.daysFromToday(d);
      const base = `${U.fmtDate(d)} ${U.weekday(U.parse(d))}`;
      return diff === 0 ? `今天 · ${base}` : diff === -1 ? `昨天 · ${base}` : base;
    }
    function drawTimeline() {
      const all = store.activitiesFor({ dealId: id });
      const shown = all.slice(0, tlLimit);
      const groups = [];
      shown.forEach((a) => { const d = a.at.slice(0, 10); const g = groups[groups.length - 1]; if (g && g.d === d) g.items.push(a); else groups.push({ d, items: [a] }); });
      tlEl.innerHTML = String(html`<div class="dl-sec-h"><h3 class="dl-sec-t">活動紀錄</h3><span class="dl-sec-n">${all.length ? all.length + ' 筆' : ''}</span>${UI.btn({ label: '記一筆', icon: 'plus', size: 'sm', variant: 'tonal', cls: 'dl-sec-btn', attrs: { 'data-act': 'log' } })}</div>
        ${shown.length ? groups.map((g) => html`<section class="dl-day"><h4 class="dl-day-h">${dayLabel(g.d)}</h4><ol class="dl-evs">${g.items.map(evView)}</ol></section>`) : UI.emptyState({ compact: true, title: '還沒有活動', body: '記下第一通電話或會議，劃記就會開始累積。' })}
        ${all.length > shown.length ? html`<div class="dl-more">${UI.btn({ label: `顯示更早的 ${Math.min(20, all.length - shown.length)} 筆`, size: 'sm', variant: 'quiet', attrs: { 'data-act': 'more' } })}</div>` : ''}`);
    }
    function drawAll({ withItems = true } = {}) {
      drawHead();
      drawSteps();
      if (withItems) drawItems();
      drawPeople();
      drawNext();
      drawTimeline();
    }
    drawAll();

    function reasonsMenu(anchor) {
      const d = cur();
      UI.menu(anchor, [{ heading: `「${d.name}」未成原因` }, ...LOST_REASONS.map((r) => ({ label: r, onSelect: () => CRM.actions.moveDealStage(id, 'lost', { lostReason: r }) }))], { label: '未成原因', cls: 'dl-lostmenu' });
    }
    body.addEventListener('click', (e) => {
      const mv = e.target.closest('[data-move]');
      if (mv) { const to = mv.dataset.move; if (cur().stage !== to) CRM.actions.moveDealStage(id, to, { sourceEl: mv }); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      const d = cur();
      if (a === 'won') CRM.actions.moveDealStage(id, 'won', { sourceEl: headEl.querySelector('.dl-dh-amt') });
      else if (a === 'lost') reasonsMenu(act);
      else if (a === 'reopen') CRM.actions.moveDealStage(id, act.dataset.to);
      else if (a === 'edit') UI.edit('deal', id);
      else if (a === 'log') UI.logActivity({ dealId: id, contactId: d.contactIds[0] || null, companyId: d.companyId });
      else if (a === 'task') UI.create('task', { dealId: id, contactId: d.contactIds[0] || '' });
      else if (a === 'more') { tlLimit += 20; drawTimeline(); }
    });
    nextEl.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-task]');
      if (cb && cb.checked) CRM.actions.completeTask(cb.dataset.task);
    });

    let raf = 0;
    const off = store.subscribe((evt) => {
      if (!evt.has('deals', 'activities', 'tasks', 'contacts', 'companies', 'reps')) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (dr.closed) return;
        if (!cur()) { dr.close(); return; }
        const inItems = itemsEl.contains(document.activeElement) && document.activeElement.matches('input');
        drawAll({ withItems: !inItems || evt.has('deals') });
      });
    });
    return { close: (o) => dr.close(o), off: () => { off(); cancelAnimationFrame(raf); }, get closed() { return dr.closed; } };
  }

  /* ── 註冊 ─────────────────────────────────────────── */
  let cleanup = null;
  let leaving = false;
  let listApi = null;
  let origin = null;
  CRM.pages.deals = {
    route: /^\/deals(?:\/([\w-]+))?$/,
    title: (ctx) => {
      const id = ctx.params && ctx.params[0];
      if (!id) return '交易';
      const d = ctx.store.get('deals', id);
      return d ? d.name + ' · 交易' : '找不到交易';
    },
    nav: 'deals',
    mount(el, ctx) {
      leaving = false;
      const id = ctx.params && ctx.params[0];
      const exists = id && ctx.store.get('deals', id);
      listApi = mountList(el, ctx, { detailId: id || null });
      let drawer = null;
      if (id && exists) {
        drawer = openDrawer(id, {
          onClose: () => {
            if (leaving) return;
            // 從其他頁面（聯絡人、公司、命令面板）開啟的，關閉後回到原頁
            if (origin && origin.id === id) { const back = origin.hash; origin = null; location.hash = back; return; }
            saveScroll();
            R().go('/deals', savedQuery());
          },
        });
      } else if (id) {
        ctx.ui.toast(`找不到交易「${id}」，可能已被刪除`);
        setTimeout(() => { if (!leaving) R().go('/deals', savedQuery()); }, 0);
      }
      cleanup = () => { if (drawer) drawer.off(); listApi.cleanup(); };
    },
    unmount() {
      leaving = true;
      origin = null;
      if (cleanup) { try { cleanup(); } catch (err) { console.error(err); } }
      cleanup = null;
      listApi = null;
    },
  };

  /* 其他頁面開交易：導到 #/deals/:id，抽屜開在上次的看板／清單上 */
  CRM.ui.openDeal = (id) => {
    const cur = R() && R().current;
    if (cur && cur.name === 'deals' && listApi) { origin = null; listApi.openDeal(id); return; }
    origin = cur ? { id, hash: location.hash } : null;
    R().go('/deals/' + id);
  };
})();
