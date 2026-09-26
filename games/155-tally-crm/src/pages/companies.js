/* pages/companies · 公司清單（表格／卡片）與公司詳細（抬頭、概覽、組織圖、交易、聯絡人、往來）
   清單的狀態、篩選、排序、檢視都放在網址 query：
     status=客戶|洽談中|潛在|流失  view=table|cards  q=  ind=  region=  city=  size=s1..s4  owner=u1..u6
     warmth=hot|warm|cool|cold|stale（stale = 涼或冷且有進行中交易）  sort=  dir=asc|desc
   詳細頁：#/companies/:id?tab=overview|org|deals|contacts|activity&type=call|email|… */
(function () {
  'use strict';
  const CRM = window.CRM;
  const U = CRM.util;
  const { html, raw, h } = U;
  const S = () => CRM.store;
  const ui = () => CRM.ui;

  /* ════════ 區域 helper（建議移入 core） ════════ */

  const REGIONS = ['北區', '中區', '南區', '東區'];
  const SIZE_BUCKETS = [
    { id: 's1', label: '未滿 100 人', short: '< 100', test: (n) => n < 100 },
    { id: 's2', label: '100 至 299 人', short: '100–299', test: (n) => n >= 100 && n < 300 },
    { id: 's3', label: '300 至 999 人', short: '300–999', test: (n) => n >= 300 && n < 1000 },
    { id: 's4', label: '1,000 人以上', short: '1,000+', test: (n) => n >= 1000 },
  ];
  const STATUS_ORDER = ['客戶', '洽談中', '潛在', '流失'];
  // 與聯絡人頁的生命週期同義同色
  const STATUS_TONE = { 潛在: 'sky', 洽談中: 'lemon', 客戶: 'mint', 流失: '' };
  const LEVEL = { top: 0, mid: 1, low: 2 };
  const cityOf = (c) => (c.city || '').slice(0, 3);
  const TYPE_NAME = { call: '通話', email: 'Email', meeting: '會議', note: '筆記', task: '完成任務', stage: '階段變更' };
  const TYPE_ICON = { call: 'phone', email: 'mail', meeting: 'meeting', note: 'note', task: 'check', stage: 'stage' };
  const TL_TYPES = [
    { id: 'all', name: '全部' }, { id: 'call', name: '通話' }, { id: 'email', name: 'Email' }, { id: 'meeting', name: '會議' },
    { id: 'note', name: '筆記' }, { id: 'task', name: '任務完成' }, { id: 'stage', name: '階段變更' },
  ];
  const isStale = (w, openN) => (w.id === 'cool' || w.id === 'cold') && openN > 0;

  /** '2,712 萬' → { v:'2,712', u:'萬' }（統計卡的大數字與單位分開） */
  function splitMoney(n) {
    const s = U.moneyCompact(n);
    const m = s.match(/^(.*?)\s*(萬|億)$/);
    return m ? { v: m[1], u: m[2] } : { v: s, u: '' };
  }

  /** 公司的贏單率與平均成交週期（companyStats 沒有） */
  function companyPerf(id) {
    const store = S();
    const deals = store.dealsFor({ companyId: id });
    const won = deals.filter((d) => d.stage === 'won');
    const lost = deals.filter((d) => d.stage === 'lost');
    const wins = store.all('wins').filter((w) => w.companyId === id);
    const wonN = won.length + wins.length;
    const closed = wonN + lost.length;
    const cycles = [...won.filter((d) => d.closedAt).map((d) => U.daysBetween(d.createdAt, d.closedAt)), ...wins.map((w) => w.cycleDays)];
    return {
      wonN, lostN: lost.length, closed,
      winRate: closed ? wonN / closed : null,
      avgCycle: cycles.length ? Math.round(U.sum(cycles) / cycles.length) : null,
    };
  }

  /** 依 reportsTo 建樹：主管不在本公司（或沒有主管）的人成為獨立的根；seen 防止循環 */
  function orgForest(contacts) {
    const ids = new Set(contacts.map((c) => c.id));
    const kids = new Map();
    const roots = [];
    const byLevel = (a, b) => (LEVEL[a.level] ?? 3) - (LEVEL[b.level] ?? 3);
    contacts.slice().sort(byLevel).forEach((c) => {
      if (c.reportsTo && ids.has(c.reportsTo) && c.reportsTo !== c.id) {
        if (!kids.has(c.reportsTo)) kids.set(c.reportsTo, []);
        kids.get(c.reportsTo).push(c);
      } else roots.push(c);
    });
    const seen = new Set();
    const build = (c) => {
      if (seen.has(c.id)) return null;
      seen.add(c.id);
      return { c, children: (kids.get(c.id) || []).map(build).filter(Boolean) };
    };
    const forest = roots.map(build).filter(Boolean);
    contacts.forEach((c) => { if (!seen.has(c.id)) { const t = build(c); if (t) forest.push(t); } });
    return forest;
  }

  /** 重疊的小頭像堆疊（最多 3 位，高層在前） */
  function avatarStack(people, { size = 26, max = 3 } = {}) {
    const list = people.slice().sort((a, b) => (LEVEL[a.level] ?? 3) - (LEVEL[b.level] ?? 3)).slice(0, max);
    if (!list.length) return html`<span class="co-stack is-empty" aria-hidden="true"></span>`;
    return html`<span class="co-stack" aria-hidden="true">${list.map((p) => ui().nameBlock(p, { size, title: false }))}</span>`;
  }

  /* ════════ 清單列資料 ════════ */

  function buildVMs() {
    const store = S();
    return store.all('companies').map((c) => {
      const st = store.companyStats(c.id);
      const rep = store.rep(c.owner);
      const people = store.contactsOf(c.id);
      const series = store.touchSeries({ companyId: c.id }, 8);
      return {
        id: c.id, c, rep, people, series,
        size: c.size || 0,
        contacts: people.length,
        openN: st.openDeals.length,
        openAmt: st.openAmount,
        won: st.wonTotal,
        touches: U.sum(series),
        w: st.warmth,
        text: [c.name, c.short, c.industry, c.city, c.domain, c.taxId, c.phone, ...people.map((p) => p.name)].join(' ').toLowerCase(),
      };
    });
  }

  const LIST_KEYS = ['status', 'view', 'q', 'ind', 'region', 'city', 'size', 'owner', 'warmth', 'sort', 'dir'];
  const MEM_KEY = 'tally:companies:list';
  let lastListQuery = null;
  function rememberQuery(q) {
    lastListQuery = {};
    LIST_KEYS.forEach((k) => { if (q[k]) lastListQuery[k] = q[k]; });
    try { sessionStorage.setItem(MEM_KEY, JSON.stringify(lastListQuery)); } catch (e) { /* 只在記憶體 */ }
  }
  function savedQuery() {
    if (lastListQuery) return lastListQuery;
    try { return JSON.parse(sessionStorage.getItem(MEM_KEY) || '{}') || {}; } catch (e) { return {}; }
  }

  const SORTS = [
    { key: 'won', label: '累計成交', dir: -1, v: (r) => r.won },
    { key: 'open', label: '進行中交易', dir: -1, v: (r) => r.openAmt },
    { key: 'touches', label: '近 8 週往來', dir: -1, v: (r) => r.touches },
    { key: 'warmth', label: '關係溫度', dir: 1, v: (r) => (r.w.days == null ? 99999 : r.w.days) },
    { key: 'size', label: '員工數', dir: -1, v: (r) => r.size },
    { key: 'contacts', label: '聯絡人數', dir: -1, v: (r) => r.contacts },
    { key: 'name', label: '名稱', dir: 1, v: (r) => r.c.name },
    { key: 'owner', label: '負責人', dir: 1, v: (r) => (r.rep ? r.rep.name : '') },
  ];
  const sortDef = (k) => SORTS.find((s) => s.key === k) || SORTS[0];

  /* ════════ 篩選 ════════ */

  const FILTERS = [
    {
      key: 'ind', label: '產業', icon: 'companies', all: '全部產業',
      options: () => [...new Set(S().all('companies').map((c) => c.industry))].sort((a, b) => a.localeCompare(b, 'zh-Hant')).map((i) => ({ value: i, label: i })),
      match: (vm, v) => vm.c.industry === v,
    },
    {
      key: 'region', label: '地區', icon: 'pin', all: '全部地區',
      // 地區與城市兩個 key 共用一顆按鈕，值用 region / city 表示
      options: () => {
        const all = S().all('companies');
        const out = [];
        REGIONS.forEach((r) => {
          const cities = [...new Set(all.filter((c) => c.region === r).map(cityOf))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
          if (!cities.length) return;
          out.push({ value: r, label: r + '全部', short: r, region: r, city: '' });
          cities.forEach((ci) => out.push({ value: r + '|' + ci, label: ci, short: ci, region: r, city: ci, indent: true }));
        });
        return out;
      },
      match: (vm, v) => { const [r, ci] = v.split('|'); return vm.c.region === r && (!ci || cityOf(vm.c) === ci); },
    },
    {
      key: 'size', label: '規模', icon: 'contacts', all: '全部規模',
      options: () => SIZE_BUCKETS.map((b) => ({ value: b.id, label: b.label, short: b.short + ' 人' })),
      match: (vm, v) => { const b = SIZE_BUCKETS.find((x) => x.id === v); return !b || b.test(vm.size); },
    },
    {
      key: 'owner', label: '負責人', icon: 'user', all: '全部負責人',
      options: () => S().all('reps').map((r) => ({ value: r.id, label: r.name + (r.me ? '（我）' : ''), short: r.name, lead: ui().nameBlock(r, { size: 20, title: false }) })),
      match: (vm, v) => vm.c.owner === v,
    },
    {
      key: 'warmth', label: '關係溫度', icon: 'clock', all: '全部溫度',
      options: () => [
        ...S().WARMTH.map((w) => ({ value: w.id, label: `${w.label}（${w.id === 'hot' ? '7 天內' : w.id === 'warm' ? '8 到 21 天' : w.id === 'cool' ? '22 到 45 天' : '超過 45 天'}）`, short: w.label, lead: ui().warmth(w.id, { label: false }) })),
        { value: 'stale', label: '需要關注（涼或冷、有進行中交易）', short: '需要關注', divider: true },
      ],
      match: (vm, v) => (v === 'stale' ? isStale(vm.w, vm.openN) : vm.w.id === v),
    },
  ];

  function readState(query) {
    const st = { status: STATUS_ORDER.includes(query.status) ? query.status : 'all', q: query.q || '', view: query.view === 'cards' ? 'cards' : 'table' };
    FILTERS.forEach((f) => {
      let v = query[f.key] || '';
      if (f.key === 'region') v = query.region ? query.region + (query.city ? '|' + query.city : '') : '';
      st[f.key] = v && f.options().some((o) => o.value === v) ? v : '';
    });
    const def = sortDef(query.sort);
    st.sort = def.key;
    st.dir = query.dir === 'asc' ? 1 : query.dir === 'desc' ? -1 : def.dir;
    return st;
  }
  function apply(vms, st, { skipStatus = false, skipFilter = null } = {}) {
    const t = (st.q || '').trim().toLowerCase();
    return vms.filter((vm) => {
      if (!skipStatus && st.status !== 'all' && vm.c.status !== st.status) return false;
      if (t && !vm.text.includes(t)) return false;
      for (const f of FILTERS) if (f.key !== skipFilter && st[f.key] && !f.match(vm, st[f.key])) return false;
      return true;
    });
  }
  function sortRows(rows, st) {
    const d = sortDef(st.sort);
    return rows.slice().sort((a, b) => {
      const x = d.v(a), y = d.v(b);
      const r = typeof x === 'string' ? x.localeCompare(y, 'zh-Hant') : x - y;
      return (r || a.c.name.localeCompare(b.c.name, 'zh-Hant') * st.dir) * st.dir;
    });
  }

  /* ════════ 清單頁 ════════ */

  function mountList(el, ctx) {
    const { store, router } = ctx;
    const UI = ui();
    let st = readState(ctx.query);
    rememberQuery(ctx.query);
    let vms = buildVMs();

    el.appendChild(UI.pageHeader({
      title: '公司',
      sub: '客戶公司、組織與往來熱度',
      ownNew: true,
      actions: UI.btn({ label: '新增公司', icon: 'plus', variant: 'primary', attrs: { 'data-act': 'new' } }),
    }));
    const page = h(html`<div class="page pg-companies co-listpage">
      <div class="stats co-stats"></div>
      <div class="card co-card">
        <div class="toolbar co-viewbar">
          <div class="co-views"></div>
          <div class="co-vtools">
            <label class="tsearch co-search">${UI.icon('search', { size: 15 })}<input class="input" type="search" name="co-q" placeholder="搜尋公司、城市、統編或聯絡人" autocomplete="off" aria-label="搜尋公司" value="${st.q}"></label>
            <div class="co-viewseg"></div>
          </div>
        </div>
        <div class="toolbar co-bar">
          <div class="co-filters" role="group" aria-label="篩選"></div>
          <div class="co-bar-end"><span class="co-sortslot"></span><p class="co-count" aria-live="polite"></p></div>
        </div>
        <section class="co-table" aria-label="公司清單"></section>
      </div>
      <ul class="co-grid" aria-label="公司卡片" hidden></ul>
    </div>`);
    el.appendChild(page);
    el.querySelector('.ph [data-act="new"]').addEventListener('click', () => UI.create('company', st.status !== 'all' ? { status: st.status } : {}));
    const $ = (s) => page.querySelector(s);
    const statsEl = $('.co-stats'), viewsEl = $('.co-views'), segEl = $('.co-viewseg'), filtersEl = $('.co-filters'), countEl = $('.co-count'), sortSlot = $('.co-sortslot'), tableEl = $('.co-table'), gridEl = $('.co-grid'), cardEl = $('.co-card'), searchEl = $('input[name="co-q"]');

    let alive = true;
    const syncUrl = () => {
      if (!alive) return;
      const def = sortDef(st.sort);
      const [region, city] = (st.region || '').split('|');
      const patch = {
        status: st.status === 'all' ? null : st.status,
        view: st.view === 'cards' ? 'cards' : null,
        q: st.q || null,
        ind: st.ind || null, region: region || null, city: city || null, size: st.size || null, owner: st.owner || null, warmth: st.warmth || null,
        sort: st.sort === 'won' && st.dir === def.dir ? null : st.sort,
        dir: st.sort === 'won' && st.dir === def.dir ? null : st.dir < 0 ? 'desc' : 'asc',
      };
      router.setQuery(patch, { silent: true });
      rememberQuery(router.current ? router.current.query : patch);
    };
    const anyFilter = () => !!(st.q || FILTERS.some((f) => st[f.key]) || st.status !== 'all');
    function clearAll() {
      st = { ...st, status: 'all', q: '' };
      FILTERS.forEach((f) => { st[f.key] = ''; });
      searchEl.value = '';
      syncUrl();
      draw();
    }
    const emptyView = () => html`<div class="co-empty">${UI.emptyState({
      title: '沒有符合條件的公司',
      body: st.q ? `找不到「${st.q}」。試試公司簡稱、城市、統編或聯絡人姓名。` : '放寬客戶狀態或篩選條件看看。',
      action: UI.btn({ label: '清除篩選', icon: 'close', size: 'sm', attrs: { 'data-act': 'clear' } }),
      compact: true,
    })}</div>`;

    const table = UI.table(tableEl, {
      rows: [],
      caption: '公司',
      sort: { key: st.sort, dir: st.dir },
      empty: emptyView(),
      onRowClick: (r) => UI.openCompany(r.id),
      onSort: (s) => { st.sort = s.key; st.dir = s.dir; syncUrl(); drawSort(); },
      columns: [
        { key: 'name', label: '公司', m: 'primary', width: '24%', sort: (r) => r.c.name, render: (r) => UI.companyCell(r.c, { size: 36, sub: `${r.c.industry} · ${cityOf(r.c)}`, href: router.href('/companies/' + r.id) }) },
        { key: 'size', label: '員工數', align: 'right', m: 'hide', cls: 'co-col-size', sort: (r) => r.size, defaultDir: -1, render: (r) => html`<span class="co-num">${U.num(r.size)}</span>` },
        { key: 'contacts', label: '聯絡人', m: 'meta', cls: 'co-col-people', sort: (r) => r.contacts, defaultDir: -1, render: (r) => html`<span class="co-people">${avatarStack(r.people)}<span class="co-people-n">${r.contacts} 位</span></span>` },
        { key: 'open', label: '進行中交易', align: 'right', m: 'end', sort: (r) => r.openAmt, defaultDir: -1, render: (r) => (r.openAmt ? html`<span class="co-open"><span class="co-open-amt">${UI.money(r.openAmt, { compact: true })}</span><span class="co-open-n">${r.openN} 筆</span></span>` : html`<span class="co-none">–</span>`) },
        { key: 'won', label: '累計成交', align: 'right', m: 'hide', cls: 'co-col-won', sort: (r) => r.won, defaultDir: -1, render: (r) => (r.won ? html`<span class="co-won">${UI.money(r.won, { compact: true })}</span>` : html`<span class="co-none">–</span>`) },
        { key: 'touches', label: '近 8 週往來', m: 'hide', cls: 'co-col-touch', sort: (r) => r.touches, defaultDir: -1, render: (r) => html`<span class="co-touch">${UI.activityBars(r.series, { label: `近 8 週往來 ${r.series.join('、')} 次` })}<span class="co-touch-n">${r.touches || ''}</span></span>` },
        { key: 'warmth', label: '關係溫度', m: 'meta', sort: (r) => (r.w.days == null ? 99999 : r.w.days), render: (r) => UI.warmth(r.w) },
        { key: 'owner', label: '負責人', m: 'hide', cls: 'co-col-owner', sort: (r) => (r.rep ? r.rep.name : null), render: (r) => (r.rep ? html`<span class="co-rep">${UI.nameBlock(r.rep, { size: 26, title: false })}<span>${r.rep.name}</span></span>` : '') },
      ],
    });

    function drawStats() {
      const all = store.all('companies');
      const q = store.quarter();
      const qs = U.iso(q.start);
      const customers = all.filter((c) => c.status === '客戶').length;
      const newQ = all.filter((c) => (c.createdAt || '') >= qs).length;
      const qp = store.quarterProgress();
      const pipe = splitMoney(qp.pipeline);
      const openN = store.all('deals').filter(store.isOpen).length;
      // 本季成交 vs 上季：以每家公司的營收歷史彙總
      const byKey = new Map();
      all.forEach((c) => store.revenueHistory(c.id).forEach((r) => byKey.set(r.key, { label: r.label, amount: (byKey.get(r.key) ? byKey.get(r.key).amount : 0) + r.amount })));
      const hist = [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
      const cur = hist.length ? hist[hist.length - 1].amount : qp.won;
      const prev = hist.length > 1 ? hist[hist.length - 2].amount : 0;
      const diff = prev ? Math.round(((cur - prev) / prev) * 100) : 0;
      const won = splitMoney(cur);
      const attn = vms.filter((vm) => isStale(vm.w, vm.openN)).length;
      statsEl.innerHTML = String(html`
        ${UI.statCard({ label: '客戶公司', value: U.num(customers), unit: '家', icon: 'companies', tone: 3, delta: newQ ? { text: `${newQ} 本季新增`, dir: 'up' } : { text: '本季無新增', dir: 'flat' }, foot: `共 ${all.length} 家公司`, href: router.href('/companies', { status: '客戶' }) })}
        ${UI.statCard({ label: '進行中交易', value: pipe.v, unit: pipe.u, icon: 'deals', tone: 1, foot: `${openN} 筆 · 加權 ${U.moneyCompact(qp.pipelineWeighted)}` })}
        ${UI.statCard({ label: '本季成交', value: won.v, unit: won.u, icon: 'coin', tone: 2, delta: { text: `${Math.abs(diff)}%`, dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' }, foot: '比上季', spark: hist.map((x) => x.amount) })}
        ${UI.statCard({ label: '需要關注', value: U.num(attn), unit: '家', icon: 'clock', tone: 4, foot: '有進行中交易、3 週以上沒往來', href: router.href('/companies', { warmth: 'stale' }) })}`);
    }
    function drawViews() {
      const base = apply(vms, st, { skipStatus: true });
      viewsEl.innerHTML = String(UI.tabs({
        name: 'co-status', value: st.status,
        items: [{ value: 'all', label: '全部', count: base.length }, ...STATUS_ORDER.map((s) => ({ value: s, label: s, count: base.filter((vm) => vm.c.status === s).length }))],
      }));
    }
    function drawSeg() {
      segEl.innerHTML = String(UI.segmented({ name: 'co-view', value: st.view, label: '檢視方式', options: [{ value: 'table', label: '表格', icon: 'list' }, { value: 'cards', label: '卡片', icon: 'grid' }] }));
    }
    function drawFilters() {
      filtersEl.innerHTML = String(html`${FILTERS.map((f) => {
        const on = st[f.key];
        const opt = on ? f.options().find((o) => o.value === on) : null;
        return html`<button type="button" class="tbtn co-fbtn${on ? ' is-on' : ''}" data-filter="${f.key}" aria-haspopup="menu" aria-expanded="false">${opt && opt.lead ? opt.lead : UI.icon(f.icon || 'filter', { size: 14 })}<span>${f.label}${opt ? html`<b>：${opt.short || opt.label}</b>` : ''}</span>${UI.icon('chevronDown', { size: 14 })}</button>`;
      })}${anyFilter() ? UI.btn({ label: '清除篩選', size: 'sm', variant: 'quiet', cls: 'co-clear', attrs: { 'data-act': 'clear' } }) : ''}`);
    }
    function drawSort() {
      if (st.view !== 'cards') { sortSlot.innerHTML = ''; return; }
      const d = sortDef(st.sort);
      const dirText = d.key === 'warmth' ? (st.dir > 0 ? '熱到冷' : '冷到熱') : d.key === 'name' || d.key === 'owner' ? (st.dir > 0 ? '' : '反序') : st.dir < 0 ? '高到低' : '低到高';
      sortSlot.innerHTML = String(html`<button type="button" class="tbtn co-sortbtn" data-sortmenu aria-haspopup="menu" aria-expanded="false">${UI.icon('sort', { size: 14 })}<span>排序<b>：${d.label}</b>${dirText ? html`<span class="co-sortdir">${dirText}</span>` : ''}</span>${UI.icon('chevronDown', { size: 14 })}</button>`);
    }
    function tileView(vm) {
      const c = vm.c;
      return html`<li><a class="co-tile" href="${router.href('/companies/' + vm.id)}" data-id="${vm.id}">
        <span class="co-tile-head">
          ${UI.companyMark(c, { size: 44, title: false })}
          <span class="co-tile-titles"><span class="co-tile-name">${c.name}</span><span class="co-tile-sub">${c.industry} · ${cityOf(c)}</span></span>
          ${UI.tag(c.status, STATUS_TONE[c.status], { dot: true, cls: 'co-tile-status' })}
        </span>
        <span class="co-tile-figs">
          <span class="co-fig"><span class="co-fig-k">進行中</span><span class="co-fig-v">${vm.openAmt ? U.moneyCompact(vm.openAmt) : '–'}</span><span class="co-fig-s">${vm.openN ? vm.openN + ' 筆交易' : '沒有交易'}</span></span>
          <span class="co-fig"><span class="co-fig-k">累計成交</span><span class="co-fig-v">${vm.won ? U.moneyCompact(vm.won) : '–'}</span><span class="co-fig-s">近五季</span></span>
          <span class="co-fig"><span class="co-fig-k">聯絡人</span><span class="co-fig-v">${vm.contacts}</span><span class="co-fig-s">位</span></span>
        </span>
        <span class="co-tile-people">${avatarStack(vm.people, { size: 28 })}<span class="co-tile-pn">${vm.people.length ? vm.people.slice().sort((a, b) => (LEVEL[a.level] ?? 3) - (LEVEL[b.level] ?? 3))[0].name + (vm.people.length > 1 ? ` 等 ${vm.people.length} 位` : '') : '還沒有聯絡人'}</span>${UI.activityBars(vm.series, { label: `近 8 週往來 ${vm.series.join('、')} 次`, cls: 'co-tile-bars' })}</span>
        <span class="co-tile-foot">${UI.warmth(vm.w)}${vm.rep ? html`<span class="co-rep">${UI.nameBlock(vm.rep, { size: 24, title: false })}<span>${vm.rep.name}</span></span>` : ''}</span>
      </a></li>`;
    }
    function draw() {
      const rows = sortRows(apply(vms, st), st);
      drawStats();
      drawViews();
      drawFilters();
      drawSort();
      countEl.textContent = rows.length === vms.length ? `${rows.length} 家` : `顯示 ${rows.length} ／ ${vms.length} 家`;
      const cards = st.view === 'cards';
      page.classList.toggle('is-cards', cards);
      tableEl.hidden = cards;
      gridEl.hidden = !cards;
      if (cards) {
        gridEl.innerHTML = rows.length ? String(html`${rows.map(tileView)}`) : String(html`<li class="co-grid-empty card">${emptyView()}</li>`);
      } else {
        table.setSort({ key: st.sort, dir: st.dir });
        table.update(rows);
      }
    }
    drawSeg();
    draw();

    /* 搜尋 */
    const pushQ = U.debounce(() => syncUrl(), 300);
    searchEl.addEventListener('input', () => { st.q = searchEl.value; draw(); pushQ(); });
    searchEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && searchEl.value) { e.stopPropagation(); searchEl.value = ''; st.q = ''; draw(); syncUrl(); } });

    page.addEventListener('tab-change', (e) => {
      if (e.detail.name !== 'co-status') return;
      st.status = e.detail.value;
      syncUrl();
      draw();
      const b = viewsEl.querySelector(`[data-value="${st.status}"]`);
      b && b.focus({ preventScroll: true });
    });
    page.addEventListener('seg-change', (e) => {
      if (e.detail.name !== 'co-view') return;
      st.view = e.detail.value === 'cards' ? 'cards' : 'table';
      syncUrl();
      draw();
    });
    page.addEventListener('click', (e) => {
      const fb = e.target.closest('[data-filter]');
      if (fb) {
        const f = FILTERS.find((x) => x.key === fb.dataset.filter);
        const base = apply(vms, st, { skipFilter: f.key });
        const items = [{ label: f.all, checked: !st[f.key], hint: String(base.length), value: '' }, { divider: true }];
        f.options().forEach((o) => {
          if (o.divider) items.push({ divider: true });
          const n = base.filter((vm) => f.match(vm, o.value)).length;
          items.push({ label: o.label, lead: o.indent ? raw('<span class="co-indent" aria-hidden="true"></span>') : o.lead, value: o.value, checked: st[f.key] === o.value, hint: String(n), disabled: !n && st[f.key] !== o.value });
        });
        fb.setAttribute('aria-expanded', 'true');
        UI.menu(fb, items, {
          label: f.label, cls: 'co-fmenu',
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
      const sm = e.target.closest('[data-sortmenu]');
      if (sm) {
        UI.menu(sm, SORTS.map((d) => ({ label: d.label, checked: st.sort === d.key, hint: st.sort === d.key ? '再選一次反轉' : '', key: d.key })), {
          align: 'end', label: '排序', cls: 'co-fmenu',
          onSelect: (it) => {
            st.dir = st.sort === it.key ? -st.dir : sortDef(it.key).dir;
            st.sort = it.key;
            syncUrl();
            draw();
            const again = sortSlot.querySelector('[data-sortmenu]');
            again && again.focus({ preventScroll: true });
          },
        });
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'clear') { clearAll(); searchEl.focus({ preventScroll: true }); }
    });

    const off = store.subscribe((evt) => {
      if (!evt.has('companies', 'contacts', 'activities', 'deals', 'reps', 'wins')) return;
      vms = buildVMs();
      draw();
    });
    return () => { alive = false; off(); };
  }

  /* ════════ 詳細頁 ════════ */

  const TABS = ['overview', 'org', 'deals', 'contacts', 'activity'];

  function mountDetail(el, ctx, id) {
    const { store, router, actions } = ctx;
    const UI = ui();
    const back = { href: router.href('/companies', savedQuery()), label: '公司' };
    const co0 = store.get('companies', id);
    el.appendChild(UI.pageHeader({ title: '公司', sub: co0 ? co0.name : '', back }));
    const page = document.createElement('div');
    page.className = 'page pg-companies co-detail';
    el.appendChild(page);

    const cur = () => store.get('companies', id);
    const missing = (title, body) => {
      page.innerHTML = String(html`<section class="card co-missing">${UI.emptyState({
        title, body,
        action: html`<a class="btn btn--primary btn--sm" href="${back.href}">${UI.icon('chevronLeft', { size: 16 })}<span>回到公司清單</span></a>`,
      })}</section>`);
    };
    if (!cur()) {
      missing('找不到這家公司', `編號「${id}」不存在，可能已被刪除或網址有誤。`);
      const off0 = store.subscribe(() => { if (cur()) router.refresh(); });
      return () => off0();
    }

    let tab = TABS.includes(ctx.query.tab) ? ctx.query.tab : 'overview';
    let tlType = TL_TYPES.some((t) => t.id === ctx.query.type) ? ctx.query.type : 'all';
    let tlLimit = 30;
    let subTable = null;

    page.innerHTML = String(html`
      <section class="card co-hero" aria-label="公司摘要"></section>
      <section class="card co-body">
        <div class="co-tabbar"></div>
        <div class="co-panel" role="tabpanel"></div>
      </section>`);
    const heroEl = page.querySelector('.co-hero'), tabbarEl = page.querySelector('.co-tabbar'), panelEl = page.querySelector('.co-panel');

    /* 頁首：字塊、名稱、資料、動作、近三個月劃記 */
    function drawHero() {
      const c = cur();
      const rep = store.rep(c.owner);
      const w = store.warmth({ companyId: id });
      const t = U.today();
      const months = [2, 1, 0].map((i) => {
        const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const n = store.all('activities').filter((a) => a.companyId === id && store.TOUCH_TYPES.has(a.type) && a.at.slice(0, 7) === key).length;
        return { label: `${d.getMonth() + 1} 月`, n, current: i === 0 };
      });
      const total = months.reduce((s, m) => s + m.n, 0);
      const tel = String(c.phone || '').replace(/[^\d#]/g, '');
      heroEl.innerHTML = String(html`
        <div class="co-hero-id">
          ${UI.companyMark(c, { size: 72, title: false, cls: 'co-hero-cm' })}
          <div class="co-hero-text">
            <h2 class="co-name">${c.name}</h2>
            <p class="co-role"><span>${c.industry}</span><span class="co-dot" aria-hidden="true">·</span><span>${c.city}</span>${c.region ? html`<span class="co-dot" aria-hidden="true">·</span><span>${c.region}</span>` : ''}</p>
            <p class="co-facts">
              ${rep ? html`<span class="co-fact">${UI.nameBlock(rep, { size: 20, title: false })}<span>${rep.name}負責</span></span>` : ''}
              <button type="button" class="tag${STATUS_TONE[c.status] ? ' tag--' + STATUS_TONE[c.status] : ''} co-status" data-act="status" aria-haspopup="menu" aria-label="客戶狀態：${c.status}，點選變更"><i></i>${c.status}${UI.icon('chevronDown', { size: 12 })}</button>
            </p>
            <dl class="co-meta">
              <div><dt>統編</dt><dd class="co-tnum">${c.taxId || '未填'}</dd></div>
              <div><dt>網址</dt><dd title="示範用虛構網域">${c.domain || '未填'}</dd></div>
              <div><dt>員工</dt><dd class="co-tnum">${c.size ? U.num(c.size) + ' 人' : '未填'}</dd></div>
            </dl>
          </div>
        </div>
        <div class="co-hero-acts">
          ${tel ? html`<a class="btn btn--tonal btn--sm" href="tel:${tel}">${UI.icon('phone', { size: 16 })}<span>撥打</span></a>` : ''}
          ${UI.btn({ label: '記一筆', icon: 'plus', size: 'sm', variant: 'primary', attrs: { 'data-act': 'log' } })}
          ${UI.btn({ label: '新增聯絡人', icon: 'contacts', size: 'sm', attrs: { 'data-act': 'new-contact' } })}
          ${UI.btn({ label: '新增交易', icon: 'deals', size: 'sm', attrs: { 'data-act': 'new-deal' } })}
          ${UI.iconBtn('edit', { label: '編輯公司', size: 'sm', attrs: { 'data-act': 'edit' } })}
          ${UI.iconBtn('more', { label: '更多動作', size: 'sm', attrs: { 'data-act': 'more-menu', 'aria-haspopup': 'menu' } })}
        </div>
        <div class="co-hero-side">
          <div class="co-months" role="group" aria-label="近三個月往來 ${total} 次">
            ${months.map((m) => html`<div class="co-month${m.current ? ' is-current' : ''}"><span class="co-month-l">${m.label}</span>${UI.tally(m.n, { size: 20, key: m.current ? 'company:' + id : '', label: `${m.label}往來 ${m.n} 次`, cls: m.current ? 'co-tally-now' : '' })}</div>`)}
          </div>
          <div class="co-hero-foot"><p class="co-hero-sum"><b>${total}</b><span>次往來 · 近三個月</span></p>
          <div class="co-hero-warm">${UI.warmth(w)}<span class="t-12 t-3">${w.days == null ? '尚無往來' : w.days === 0 ? '今天' : `${w.days} 天前`}</span></div></div>
        </div>`);
    }

    function companyActivities() {
      const dealIds = new Set(store.dealsFor({ companyId: id }).map((d) => d.id));
      return store.all('activities').filter((a) => a.companyId === id || (a.dealId && dealIds.has(a.dealId))).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    }

    function drawTabbar() {
      const contacts = store.contactsOf(id);
      tabbarEl.innerHTML = String(UI.tabs({
        name: 'co-tab', value: tab, cls: 'tabs--line co-tabs',
        items: [
          { value: 'overview', label: '概覽' },
          { value: 'org', label: '組織圖' },
          { value: 'deals', label: '交易', count: store.dealsFor({ companyId: id }).length },
          { value: 'contacts', label: '聯絡人', count: contacts.length },
          { value: 'activity', label: '往來', count: companyActivities().length },
        ],
      }));
    }

    /* ── 共用片段 ── */
    function evView(a, { compact = false } = {}) {
      const rep = store.rep(a.owner);
      const deal = a.dealId ? store.get('deals', a.dealId) : null;
      const who = a.contactId ? store.get('contacts', a.contactId) : null;
      const meta = [];
      if (a.type === 'call' && a.duration) meta.push(U.duration(a.duration));
      if (a.type === 'meeting') { if (a.location) meta.push(a.location); if (a.duration) meta.push(U.duration(a.duration)); }
      let bodyView = html`<p class="co-ev-text">${a.body}</p>`;
      if (a.type === 'email') bodyView = html`<p class="co-ev-subj">${a.subject || '（無主旨）'}</p>${a.body ? html`<p class="co-ev-text">${a.body}</p>` : ''}`;
      if (a.type === 'meeting' && a.title && a.title !== a.body) bodyView = html`<p class="co-ev-subj">${a.title}</p><p class="co-ev-text">${a.body}</p>`;
      if (a.type === 'stage') bodyView = html`<p class="co-ev-text co-ev-stage">${a.from ? UI.stageTag(a.from) : ''}${UI.icon('arrowRight', { size: 14 })}${UI.stageTag(a.to)}</p>`;
      return html`<li class="co-ev" data-type="${a.type}">
        <span class="co-ev-ic" aria-hidden="true">${UI.icon(TYPE_ICON[a.type] || 'note', { size: 18 })}</span>
        <div class="co-ev-main">
          <p class="co-ev-head"><span class="co-ev-type">${TYPE_NAME[a.type] || '活動'}</span>${meta.length ? html`<span class="co-ev-meta">${meta.join(' · ')}</span>` : ''}${compact ? html`<span class="co-ev-time">${UI.relTime(a.at)}</span>` : html`<time class="co-ev-time" datetime="${a.at}">${U.time(a.at)}</time>`}</p>
          ${bodyView}
          <p class="co-ev-foot">${who ? html`<a class="co-ev-who" href="${router.href('/contacts/' + who.id)}">${UI.nameBlock(who, { size: 18, title: false })}${who.name}</a>` : ''}${rep ? html`<span class="co-ev-rep">${who ? '由' : ''}${rep.name}${who ? '記錄' : ''}</span>` : ''}${deal ? html`<button type="button" class="co-ev-deal" data-deal="${deal.id}">${UI.icon('deals', { size: 14 })}<span>${deal.name}</span></button>` : ''}</p>
        </div>
      </li>`;
    }
    function taskItem(t) {
      const who = t.contactId ? store.get('contacts', t.contactId) : null;
      return html`<li class="co-task">${UI.checkbox({ attrs: { 'data-task': t.id, 'aria-label': '完成：' + t.title } })}<span class="co-task-text"><span class="co-task-title">${t.priority === 'high' ? html`<span class="co-task-hi" data-tip="高優先">${UI.icon('flag', { size: 14 })}</span>` : ''}${t.title}</span><span class="co-task-meta">${UI.due(t.due, t.dueTime)}${who ? html`<span>${who.name}</span>` : ''}</span></span></li>`;
    }
    const secHead = (title, extra = '', action = '') => html`<header class="co-sec-h"><h3 class="co-sec-t">${title}</h3>${extra ? html`<span class="co-sec-n">${extra}</span>` : ''}${action}</header>`;
    const moreLink = (label, goto) => html`<button type="button" class="co-sec-more" data-goto="${goto}">${label}${UI.icon('chevronRight', { size: 14 })}</button>`;

    /* ── 概覽 ── */
    function overviewView() {
      const c = cur();
      const st = store.companyStats(id);
      const perf = companyPerf(id);
      const hist = store.revenueHistory(id);
      const past = hist.slice(0, -1).slice(-4);
      const current = hist[hist.length - 1];
      const tasks = U.sortBy(store.tasksFor({ companyId: id }, { open: true }), (t) => t.due + (t.dueTime || '99'));
      const recent = companyActivities().slice(0, 5);
      const openDeals = U.sortBy(st.openDeals, (d) => d.closeDate);
      const kpi = (k, v, s) => html`<div class="co-kpi"><p class="co-kpi-k">${k}</p><p class="co-kpi-v">${v}</p><p class="co-kpi-s">${s}</p></div>`;
      panelEl.innerHTML = String(html`
        <div class="co-kpis" role="group" aria-label="關鍵數字">
          ${kpi('累計成交', st.wonTotal ? U.moneyCompact(st.wonTotal) : '尚無', perf.wonN ? `${perf.wonN} 筆成交 · 近五季` : '還沒有成交紀錄')}
          ${kpi('進行中加權', st.openDeals.length ? U.moneyCompact(store.weighted(st.openDeals)) : '–', st.openDeals.length ? `${st.openDeals.length} 筆 · 總額 ${U.moneyCompact(st.openAmount)}` : '沒有進行中的交易')}
          ${kpi('贏單率', perf.winRate == null ? '–' : U.pct(perf.winRate), perf.closed ? `${perf.wonN} 勝 ${perf.lostN} 敗` : '結案後才會計算')}
          ${kpi('平均成交週期', perf.avgCycle == null ? '–' : html`${perf.avgCycle}<small> 天</small>`, perf.avgCycle == null ? '尚無成交' : '從建立到成交')}
        </div>
        <div class="co-ov">
          <div class="co-ov-main">
            <section class="co-sec" aria-label="近四季成交">
              ${secHead('近四季成交', '', html`<p class="co-sec-note">本季至今 <b>${current && current.amount ? U.money(current.amount) : '尚無'}</b></p>`)}
              ${revenueChart(past)}
            </section>
            <section class="co-sec" aria-label="近期往來">
              ${secHead('近期往來', '', recent.length ? moreLink('全部往來', 'activity') : '')}
              ${recent.length ? html`<ol class="co-evs co-evs--compact">${recent.map((a) => evView(a, { compact: true }))}</ol>` : UI.emptyState({ compact: true, title: '還沒有往來', body: '記下第一通電話或會議，劃記就會開始累積。' })}
            </section>
          </div>
          <aside class="co-ov-side">
            <section class="co-sec" aria-label="下一步">
              ${secHead('下一步', tasks.length ? tasks.length + ' 件' : '', UI.iconBtn('plus', { label: '新增任務', size: 'sm', cls: 'co-sec-add', attrs: { 'data-act': 'task' } }))}
              ${tasks.length ? html`<ul class="co-task-list">${tasks.slice(0, 5).map(taskItem)}</ul>${tasks.length > 5 ? html`<p class="co-side-empty">另有 ${tasks.length - 5} 件，見任務頁</p>` : ''}` : html`<p class="co-side-empty">沒有待辦，要不要排下一步？</p>`}
            </section>
            <section class="co-sec" aria-label="進行中交易">
              ${secHead('進行中交易', openDeals.length ? U.moneyCompact(st.openAmount) : '', UI.iconBtn('plus', { label: '新增交易', size: 'sm', cls: 'co-sec-add', attrs: { 'data-act': 'new-deal' } }))}
              ${openDeals.length ? html`<ul class="co-mdeals">${openDeals.slice(0, 4).map((d) => html`<li><button type="button" class="co-mdeal" data-deal="${d.id}"><span class="co-mdeal-top"><span class="co-mdeal-name">${d.name}</span>${UI.money(d.amount, { compact: true, cls: 'co-mdeal-amt' })}</span><span class="co-mdeal-bot">${UI.stageTag(d.stage)}<span class="t-12 t-3">預計 ${U.fmtDate(d.closeDate)}</span><span class="co-mdeal-code">${d.code}</span></span></button></li>`)}</ul>${openDeals.length > 4 ? moreLink(`全部 ${openDeals.length} 筆交易`, 'deals') : ''}` : html`<p class="co-side-empty">沒有進行中的交易。</p>`}
            </section>
          </aside>
        </div>`);
    }

    function revenueChart(rows) {
      const max = Math.max(0, ...rows.map((r) => r.amount));
      if (!rows.length || !max) return html`<div class="co-rev-empty">${UI.emptyState({ title: '近四季沒有成交', body: '第一筆成交後，這裡會顯示每季金額。', compact: true })}</div>`;
      const tip = (r) => `${r.label}：${U.money(r.amount)}`;
      return html`<div class="co-rbars" role="img" aria-label="近四季成交：${rows.map(tip).join('、')}">
        ${rows.map((r) => {
          const hh = r.amount ? Math.max(3, (r.amount / max) * 100) : 0;
          const [y, q] = r.label.split(' ');
          return html`<div class="co-rbar" data-tip="${tip(r)}"><span class="co-rbar-plot"><span class="co-rbar-v">${r.amount ? U.moneyCompact(r.amount) : '0'}</span><i style="height:${hh.toFixed(1)}%"></i></span><span class="co-rbar-k"><b>${q || r.label}</b>${y && q ? html`<span>${y}</span>` : ''}</span></div>`;
        })}
      </div>
      <table class="sr-only"><caption>近四季成交金額</caption><tbody>${rows.map((r) => html`<tr><th scope="row">${r.label}</th><td>${U.money(r.amount)}</td></tr>`)}</tbody></table>`;
    }

    /* ── 組織圖 ── */
    function orgView() {
      const contacts = store.contactsOf(id);
      if (!contacts.length) {
        panelEl.innerHTML = String(UI.emptyState({ title: '還沒有聯絡人', body: '新增聯絡人並填「直屬主管」，組織圖就會自動長出來。', action: UI.btn({ label: '新增聯絡人', icon: 'plus', size: 'sm', variant: 'primary', attrs: { 'data-act': 'new-contact' } }) }));
        return;
      }
      const forest = orgForest(contacts);
      const node = (t) => {
        const p = t.c;
        const w = store.warmth({ contactId: p.id });
        const decider = (p.tags || []).includes('決策者');
        return html`<li><a class="co-node${decider ? ' is-decider' : ''}" href="${router.href('/contacts/' + p.id)}" data-contact="${p.id}">
          ${UI.nameBlock(p, { size: 32, title: false })}
          <span class="co-node-text"><span class="co-node-name">${p.name}</span><span class="co-node-title">${p.title || '未填職稱'}</span></span>
          ${UI.warmth(w, { label: false, cls: 'co-node-w' })}
        </a>${t.children.length ? html`<ul>${t.children.map(node)}</ul>` : ''}</li>`;
      };
      const loose = forest.filter((t) => !t.children.length && forest.length > 1 && t.c.level !== 'top');
      const trees = forest.filter((t) => !loose.includes(t));
      const lines = trees.length;
      panelEl.innerHTML = String(html`
        <section class="co-sec co-org" aria-label="組織圖">
          ${secHead('組織圖', `${contacts.length} 位`, html`<p class="co-sec-note">依「直屬主管」排列${lines > 1 ? `，共 ${lines} 條匯報線` : ''}。點人名開啟聯絡人。</p>`)}
          <div class="co-org-scroll"><div class="co-tree">${trees.map((t) => html`<ul class="co-tree-root">${node(t)}</ul>`)}</div></div>
          ${loose.length ? html`<div class="co-org-loose"><p class="co-org-loose-h">未指定主管</p><ul class="co-loose">${loose.map(node)}</ul></div>` : ''}
        </section>`);
    }

    /* ── 交易（依階段分組） ── */
    function dealsView() {
      const deals = store.dealsFor({ companyId: id });
      if (!deals.length) {
        panelEl.innerHTML = String(UI.emptyState({ title: '這家公司還沒有交易', body: '從場勘或報價開始，建立第一筆交易。', action: UI.btn({ label: '新增交易', icon: 'plus', size: 'sm', variant: 'primary', attrs: { 'data-act': 'new-deal' } }) }));
        return;
      }
      const groups = store.STAGES.map((s) => ({
        s,
        list: s.closed ? deals.filter((d) => d.stage === s.id).sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || '')) : U.sortBy(deals.filter((d) => d.stage === s.id), (d) => d.closeDate),
      })).filter((g) => g.list.length);
      panelEl.innerHTML = String(html`<div class="co-dgroups">${groups.map(({ s, list }) => html`
        <section class="co-dgroup" aria-label="${s.name}">
          <header class="co-dgroup-h">${UI.stageTag(s.id, { cls: 'co-dgroup-stage' })}<span class="co-sec-n">${list.length} 筆</span><span class="co-dgroup-sum">${UI.money(U.sum(list, (d) => d.amount), { compact: true, lost: s.id === 'lost' })}</span></header>
          <ul class="co-dlist">${list.map((d) => {
            const lead = d.contactIds && d.contactIds[0] ? store.get('contacts', d.contactIds[0]) : null;
            const overdue = !d.closedAt && U.daysFromToday(d.closeDate) < 0;
            const dateLabel = d.closedAt ? `${s.id === 'won' ? '成交' : '結案'} ${U.fmtDate(d.closedAt)}` : `${overdue ? '逾期 · ' : '預計 '}${U.fmtDate(d.closeDate)}`;
            const sub = [lead && lead.name, d.closedAt ? d.lostReason : d.next].filter(Boolean).join(' · ');
            return html`<li><button type="button" class="co-drow" data-deal="${d.id}">
              <span class="co-drow-main"><span class="co-drow-name">${d.name}</span><span class="co-drow-sub"><span class="co-drow-code">${d.code}</span>${sub ? html`<span class="co-drow-next">${sub}</span>` : ''}</span></span>
              <span class="co-drow-date${overdue ? ' is-overdue' : ''}">${dateLabel}</span>
              <span class="co-drow-owner">${UI.nameBlock(d.owner, { size: 26 })}</span>
              <span class="co-drow-amt">${UI.money(d.amount, { compact: true, lost: d.stage === 'lost' })}</span>
            </button></li>`;
          })}</ul>
        </section>`)}</div>`);
    }

    /* ── 聯絡人 ── */
    function contactsView() {
      const contacts = store.contactsOf(id);
      panelEl.innerHTML = String(html`<section class="co-sec co-ctable" aria-label="聯絡人">${secHead('聯絡人', `${contacts.length} 位`, UI.btn({ label: '新增聯絡人', icon: 'plus', size: 'sm', cls: 'co-sec-btn', attrs: { 'data-act': 'new-contact' } }))}<div class="co-ctable-body"></div></section>`);
      const box = panelEl.querySelector('.co-ctable-body');
      if (!contacts.length) { box.innerHTML = String(UI.emptyState({ title: '還沒有聯絡人', compact: true })); subTable = null; return; }
      const rows = contacts.map((p) => {
        const w = store.warmth({ contactId: p.id });
        const series = store.touchSeries({ contactId: p.id }, 8);
        return { id: p.id, p, w, series, touches: U.sum(series), boss: p.reportsTo ? store.get('contacts', p.reportsTo) : null };
      });
      subTable = UI.table(box, {
        rows, caption: cur().name + '的聯絡人', sort: { key: 'level', dir: 1 }, cls: 'co-ctbl',
        onRowClick: (r) => UI.openContact(r.id),
        columns: [
          { key: 'level', label: '姓名', m: 'primary', width: '26%', sort: (r) => (LEVEL[r.p.level] ?? 3) * 1000 + (r.boss ? 1 : 0), render: (r) => UI.personCell(r.p, { size: 36, sub: r.p.title, href: router.href('/contacts/' + r.id) }) },
          { key: 'boss', label: '直屬主管', m: 'hide', cls: 'co-ccol-boss', sort: (r) => (r.boss ? r.boss.name : null), render: (r) => (r.boss ? html`<span class="co-rep">${UI.nameBlock(r.boss, { size: 22, title: false })}<span>${r.boss.name}</span></span>` : html`<span class="co-none">–</span>`) },
          { key: 'mobile', label: '手機', m: 'hide', cls: 'co-ccol-mobile', render: (r) => html`<span class="co-tnum co-nowrap">${r.p.mobile || ''}</span>` },
          { key: 'touches', label: '近 8 週往來', m: 'hide', sort: (r) => r.touches, defaultDir: -1, render: (r) => html`<span class="co-touch">${UI.activityBars(r.series)}<span class="co-touch-n">${r.touches || ''}</span></span>` },
          { key: 'warmth', label: '關係溫度', m: 'meta', sort: (r) => (r.w.days == null ? 99999 : r.w.days), render: (r) => UI.warmth(r.w) },
          { key: 'life', label: '生命週期', m: 'end', sort: (r) => r.p.lifecycle, render: (r) => UI.tag(r.p.lifecycle, { 潛在: 'sky', 洽談中: 'lemon', 客戶: 'mint', 合作夥伴: 'lilac' }[r.p.lifecycle] || '', { dot: true }) },
        ],
      });
    }

    /* ── 往來時間軸 ── */
    function dayLabel(dateIso) {
      const diff = U.daysFromToday(dateIso);
      const base = `${U.fmtDate(dateIso)} ${U.weekday(U.parse(dateIso))}`;
      return diff === 0 ? `今天 · ${base}` : diff === -1 ? `昨天 · ${base}` : base;
    }
    function activityView() {
      const all = companyActivities();
      const counts = Object.fromEntries(TL_TYPES.map((t) => [t.id, t.id === 'all' ? all.length : all.filter((a) => a.type === t.id).length]));
      const items = TL_TYPES.filter((t) => t.id === 'all' || counts[t.id] || t.id === tlType).map((t) => ({ value: t.id, label: t.name, count: counts[t.id] }));
      const list = tlType === 'all' ? all : all.filter((a) => a.type === tlType);
      const shown = list.slice(0, tlLimit);
      const groups = [];
      shown.forEach((a) => { const d = a.at.slice(0, 10); const g = groups[groups.length - 1]; if (g && g.d === d) g.items.push(a); else groups.push({ d, items: [a] }); });
      panelEl.innerHTML = String(html`<section class="co-sec co-tl" aria-label="往來紀錄">
        <div class="co-tl-head">${UI.tabs({ name: 'co-tl', value: tlType, items, cls: 'co-tl-tabs' })}${UI.btn({ label: '記一筆', icon: 'plus', size: 'sm', variant: 'primary', attrs: { 'data-act': 'log' } })}</div>
        ${shown.length ? html`<div class="co-tl-body">${groups.map((g) => html`<section class="co-day"><h4 class="co-day-h">${dayLabel(g.d)}</h4><ol class="co-evs">${g.items.map((a) => evView(a))}</ol></section>`)}</div>` : UI.emptyState({ compact: true, title: all.length ? '這個類型還沒有紀錄' : '還沒有往來', body: all.length ? '換個類型看看，或記一筆。' : '記下第一通電話或會議，劃記就會開始累積。' })}
        ${list.length > shown.length ? html`<div class="co-more">${UI.btn({ label: `顯示更早的 ${Math.min(30, list.length - shown.length)} 筆`, size: 'sm', variant: 'quiet', attrs: { 'data-act': 'more' } })}<span class="t-12 t-3">共 ${list.length} 筆</span></div>` : ''}
      </section>`);
    }

    function drawPanel() {
      subTable = null;
      panelEl.dataset.tab = tab;
      ({ overview: overviewView, org: orgView, deals: dealsView, contacts: contactsView, activity: activityView })[tab]();
    }
    function drawAll() {
      drawHero();
      drawTabbar();
      drawPanel();
    }
    drawAll();

    /* ── 事件 ── */
    function setTab(next) {
      tab = next;
      tlType = 'all';
      tlLimit = 30;
      router.setQuery({ tab: tab === 'overview' ? null : tab, type: null }, { silent: true });
      drawTabbar();
      drawPanel();
      const b = tabbarEl.querySelector(`[data-value="${tab}"]`);
      b && b.focus({ preventScroll: true });
    }
    page.addEventListener('tab-change', (e) => {
      if (e.detail.name === 'co-tab') setTab(e.detail.value);
      else if (e.detail.name === 'co-tl') {
        tlType = e.detail.value;
        tlLimit = 30;
        router.setQuery({ type: tlType === 'all' ? null : tlType }, { silent: true });
        drawPanel();
        const b = panelEl.querySelector(`.co-tl-tabs [data-value="${tlType}"]`);
        b && b.focus({ preventScroll: true });
      }
    });
    page.addEventListener('change', (e) => {
      const t = e.target.closest('[data-task]');
      if (t && t.checked) actions.completeTask(t.dataset.task);
    });
    page.addEventListener('click', (e) => {
      const deal = e.target.closest('[data-deal]');
      if (deal) { UI.openDeal(deal.dataset.deal); return; }
      const node = e.target.closest('[data-contact]');
      if (node && !e.metaKey && !e.ctrlKey) { e.preventDefault(); UI.openContact(node.dataset.contact); return; }
      const go = e.target.closest('[data-goto]');
      if (go) { setTab(go.dataset.goto); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      const c = cur();
      if (act === 'log') UI.logActivity({ companyId: id });
      else if (act === 'new-contact') UI.create('contact', { companyId: id });
      else if (act === 'new-deal') UI.create('deal', { companyId: id });
      else if (act === 'task') UI.create('task', { companyId: id });
      else if (act === 'edit') UI.edit('company', id);
      else if (act === 'more') { tlLimit += 30; drawPanel(); }
      else if (act === 'status') {
        UI.menu(a, store.COMPANY_STATUSES.map((s) => ({ label: s, checked: c.status === s, value: s })), {
          label: '客戶狀態',
          onSelect: (it) => {
            if (it.value === c.status) return;
            const prev = c.status;
            const { undo } = store.batch(() => store.update('companies', id, { status: it.value }));
            UI.toast(`客戶狀態：${prev} 改為 ${it.value}`, { undo });
          },
        });
      } else if (act === 'more-menu') {
        UI.menu(a, [
          { label: '新增任務', icon: 'tasks', onSelect: () => UI.create('task', { companyId: id }) },
          { label: '編輯公司資料', icon: 'edit', onSelect: () => UI.edit('company', id) },
          { divider: true },
          { label: '刪除公司', icon: 'trash', danger: true, onSelect: async () => {
            const n = store.contactsOf(id).length, d = store.dealsFor({ companyId: id }).length;
            const ok = await UI.confirm({ title: `刪除「${c.name}」？`, body: `會一併刪除 ${n} 位聯絡人、${d} 筆交易與相關任務和往來。刪除後可以在通知裡復原。`, confirmLabel: '刪除', danger: true });
            if (ok) actions.deleteRecord('companies', id);
          } },
        ], { align: 'end', label: '更多動作' });
      }
    });

    const off = store.subscribe((evt) => {
      if (!cur()) { missing('這家公司已刪除', '可以按通知上的「復原」救回來。'); return; }
      if (!page.querySelector('.co-hero')) { router.refresh(); return; }
      if (!evt.has('companies', 'contacts', 'deals', 'activities', 'tasks', 'wins', 'reps')) return;
      const y = window.scrollY;
      drawAll();
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
    });
    return () => { off(); subTable = null; };
  }

  /* ════════ 註冊 ════════ */

  let cleanup = null;
  CRM.pages.companies = {
    route: /^\/companies(?:\/([\w-]+))?$/,
    title: (ctx) => {
      const id = ctx.params && ctx.params[0];
      if (!id) return '公司';
      const c = ctx.store.get('companies', id);
      return c ? c.name + ' · 公司' : '找不到公司';
    },
    nav: 'companies',
    mount(el, ctx) {
      const id = ctx.params && ctx.params[0];
      cleanup = id ? mountDetail(el, ctx, id) : mountList(el, ctx);
    },
    unmount() {
      if (cleanup) { try { cleanup(); } catch (err) { console.error(err); } }
      cleanup = null;
    },
  };
})();
