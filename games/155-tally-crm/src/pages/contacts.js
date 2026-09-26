/* pages/contacts · 聯絡人清單（#/contacts）與詳細頁（#/contacts/:id）
   清單的檢視、篩選、搜尋、排序都放在網址 query：
     view=all|mine|stale|decision|expo  q=  owner=u1..u6  lifecycle=潛在…  tag=決策者…  warmth=hot|warm|cool|cold  sort=  dir=asc|desc */
(function () {
  'use strict';
  const CRM = window.CRM;
  const U = CRM.util;
  const { html, raw, h } = U;

  const S = () => CRM.store;
  const ui = () => CRM.ui;

  /* ── 共用 ─────────────────────────────────────────── */
  const LIST_KEYS = ['view', 'q', 'owner', 'lifecycle', 'tag', 'warmth', 'sort', 'dir'];
  const MEM_KEY = 'tally:contacts:list';
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
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const cmp = (a, b) => (a < b ? 1 : a > b ? -1 : 0);

  const VIEWS = [
    { id: 'all', label: '全部', test: () => true },
    { id: 'mine', label: '我的聯絡人', test: (vm) => vm.c.owner === S().me().id },
    { id: 'stale', label: '該聯絡了', test: (vm) => (vm.w.id === 'cold' || vm.w.id === 'cool') && vm.openN > 0 },
    { id: 'decision', label: '決策者', test: (vm) => (vm.c.tags || []).includes('決策者') },
    { id: 'expo', label: '2026 自動化展', test: (vm) => (vm.c.tags || []).includes('2026 自動化展') },
  ];
  const FILTERS = [
    {
      key: 'owner', label: '負責人', icon: 'user', all: '全部負責人',
      options: () => S().all('reps').map((r) => ({ value: r.id, label: r.name + (r.me ? '（我）' : ''), short: r.name, lead: ui().nameBlock(r, { size: 20, title: false }) })),
      match: (vm, v) => vm.c.owner === v,
    },
    {
      key: 'lifecycle', label: '生命週期', icon: 'stage', all: '全部階段',
      options: () => S().LIFECYCLES.map((l) => ({ value: l, label: l })),
      match: (vm, v) => vm.c.lifecycle === v,
    },
    {
      key: 'tag', label: '標籤', icon: 'tag', all: '全部標籤',
      options: () => S().TAGS.map((t) => ({ value: t, label: t })),
      match: (vm, v) => (vm.c.tags || []).includes(v),
    },
    {
      key: 'warmth', label: '關係溫度', icon: 'clock', all: '全部溫度',
      options: () => S().WARMTH.map((w) => ({ value: w.id, label: `${w.label}（${w.id === 'hot' ? '7 天內' : w.id === 'warm' ? '8 到 21 天' : w.id === 'cool' ? '22 到 45 天' : '超過 45 天'}）`, short: w.label, lead: ui().warmth(w.id, { label: false }) })),
      match: (vm, v) => vm.w.id === v,
    },
  ];
  const SORT_KEYS = ['name', 'company', 'lifecycle', 'touches', 'warmth', 'last', 'owner', 'open'];
  const LIFE_ORDER = { 潛在: 0, 洽談中: 1, 客戶: 2, 合作夥伴: 3, 流失: 4 };
  const LIFE_TONE = { 潛在: 'sky', 洽談中: 'lemon', 客戶: 'mint', 合作夥伴: 'lilac', 流失: '' };

  /** 每位聯絡人的顯示資料（每次重繪算一次） */
  function buildVMs() {
    const store = S();
    return store.all('contacts').map((c) => {
      const co = store.get('companies', c.companyId);
      const w = store.warmth({ contactId: c.id });
      const open = store.openDealsFor({ contactId: c.id });
      const rep = store.rep(c.owner);
      return {
        id: c.id, c, co, w, rep,
        last: w.last,
        touches: store.touches({ contactId: c.id }, 56),
        series: store.touchSeries({ contactId: c.id }, 8),
        openAmt: open.reduce((s, d) => s + d.amount, 0),
        openN: open.length,
        text: [c.name, co && co.name, co && co.short, c.email, c.title].join(' ').toLowerCase(),
        nums: digits(c.mobile) + ' ' + digits(c.phone),
      };
    });
  }
  function readState(query) {
    const st = { view: VIEWS.some((v) => v.id === query.view) ? query.view : 'all', q: query.q || '' };
    FILTERS.forEach((f) => { const v = query[f.key]; st[f.key] = v && f.options().some((o) => o.value === v) ? v : ''; });
    st.sort = SORT_KEYS.includes(query.sort) ? query.sort : 'last';
    st.dir = query.dir === 'asc' ? 1 : query.dir === 'desc' ? -1 : (query.sort && SORT_KEYS.includes(query.sort) ? 1 : -1);
    return st;
  }
  function matchQ(vm, q) {
    if (!q) return true;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    if (vm.text.includes(t)) return true;
    const d = digits(t);
    return d.length >= 3 && d.length === t.replace(/[\s-]/g, '').length && vm.nums.includes(d);
  }
  /** 套用檢視＋搜尋＋篩選；skipView／skipFilter 用來算分面計數 */
  function apply(vms, st, { skipView = false, skipFilter = null } = {}) {
    const view = VIEWS.find((v) => v.id === st.view);
    return vms.filter((vm) => {
      if (!skipView && !view.test(vm)) return false;
      if (!matchQ(vm, st.q)) return false;
      for (const f of FILTERS) if (f.key !== skipFilter && st[f.key] && !f.match(vm, st[f.key])) return false;
      return true;
    });
  }

  /* ════════ 清單 ════════ */
  function mountList(el, ctx) {
    const { store, router } = ctx;
    const UI = ui();
    let st = readState(ctx.query);
    rememberQuery(ctx.query);
    let vms = buildVMs();

    el.appendChild(UI.pageHeader({
      title: '聯絡人',
      sub: '客戶窗口、決策者與往來熱度',
      ownNew: true,
      actions: UI.btn({ label: '新增聯絡人', icon: 'plus', variant: 'primary', attrs: { 'data-act': 'new' } }),
    }));
    const page = h(html`<div class="page pg-contacts ct-listpage">
      <div class="stats ct-stats"></div>
      <div class="card ct-card">
      <div class="toolbar ct-viewbar">
        <div class="ct-views"></div>
        <label class="tsearch ct-search">${UI.icon('search', { size: 15 })}<input class="input" type="search" name="ct-q" placeholder="搜尋姓名、公司或電話" autocomplete="off" aria-label="搜尋聯絡人" value="${st.q}"></label>
      </div>
      <div class="toolbar ct-bar">
        <div class="ct-tools">
          <div class="ct-filters" role="group" aria-label="篩選"></div>
          <p class="ct-count" aria-live="polite"></p>
        </div>
        <div class="ct-bulk" hidden>
          <p class="ct-bulk-n"></p>
          ${UI.btn({ label: '指派負責人', icon: 'user', size: 'sm', attrs: { 'data-bulk': 'assign', 'aria-haspopup': 'menu' } })}
          ${UI.btn({ label: '加標籤', icon: 'tag', size: 'sm', attrs: { 'data-bulk': 'tag', 'aria-haspopup': 'menu' } })}
          ${UI.btn({ label: '刪除', icon: 'trash', size: 'sm', variant: 'danger', attrs: { 'data-bulk': 'delete' } })}
          ${UI.btn({ label: '取消選取', size: 'sm', variant: 'quiet', cls: 'ct-bulk-x', attrs: { 'data-bulk': 'clear' } })}
        </div>
      </div>
      <section class="ct-table" aria-label="聯絡人清單"></section>
      </div>
    </div>`);
    el.appendChild(page);
    el.querySelector('.ph [data-act="new"]').addEventListener('click', () => UI.create('contact', st.view === 'mine' ? { owner: store.me().id } : {}));
    const $ = (s) => page.querySelector(s);
    const viewsEl = $('.ct-views'), filtersEl = $('.ct-filters'), countEl = $('.ct-count'), toolsEl = $('.ct-tools'), bulkEl = $('.ct-bulk'), searchEl = $('input[name="ct-q"]');

    let alive = true;
    const syncUrl = () => {
      if (!alive) return;
      const patch = { view: st.view === 'all' ? null : st.view, q: st.q || null, sort: st.sort, dir: st.dir < 0 ? 'desc' : 'asc' };
      FILTERS.forEach((f) => { patch[f.key] = st[f.key] || null; });
      router.setQuery(patch, { silent: true });
      rememberQuery(router.current ? router.current.query : patch);
    };
    const anyFilter = () => !!(st.q || FILTERS.some((f) => st[f.key]) || st.view !== 'all');
    function clearAll() {
      st = { ...st, view: 'all', q: '' };
      FILTERS.forEach((f) => { st[f.key] = ''; });
      searchEl.value = '';
      syncUrl();
      draw();
    }

    const emptyView = () => html`<div class="ct-empty">${UI.emptyState({
      title: '沒有符合條件的聯絡人',
      body: '換個關鍵字（公司、Email、手機號碼都能搜），或放寬檢視與篩選。',
      action: UI.btn({ label: '清除篩選', icon: 'close', size: 'sm', attrs: { 'data-act': 'clear' } }),
      compact: true,
    })}</div>`;

    const table = UI.table($('.ct-table'), {
      rows: [],
      selectable: true,
      caption: '聯絡人',
      sort: { key: st.sort, dir: st.dir },
      empty: emptyView(),
      onRowClick: (r) => UI.openContact(r.id),
      onSelect: () => drawBulk(),
      onSort: (s) => { st.sort = s.key; st.dir = s.dir; syncUrl(); },
      columns: [
        { key: 'name', label: '姓名', m: 'primary', width: '24%', sort: (r) => r.c.name, render: (r) => UI.personCell(r.c, { size: 36, href: router.href('/contacts/' + r.id), sub: r.c.title || '' }) },
        { key: 'company', label: '公司', m: 'meta', width: '18%', cls: 'ct-col-co', sort: (r) => (r.co ? r.co.name : null), render: (r) => (r.co ? html`<a class="ct-co" href="${router.href('/companies/' + r.co.id)}" data-co="${r.co.id}">${UI.companyMark(r.co, { size: 26, title: false })}<span class="ct-co-name">${r.co.name}</span></a>` : html`<span class="t-3">無</span>`) },
        { key: 'lifecycle', label: '生命週期', m: 'hide', sort: (r) => LIFE_ORDER[r.c.lifecycle], render: (r) => UI.tag(r.c.lifecycle, LIFE_TONE[r.c.lifecycle], { dot: true, cls: 'ct-life' }) },
        { key: 'touches', label: '近 8 週往來', m: 'hide', sort: (r) => r.touches, defaultDir: -1, render: (r) => html`<span class="ct-touch">${UI.activityBars(r.series, { label: `近 8 週往來 ${r.series.join('、')} 次` })}<span class="ct-touch-n">${r.touches || ''}</span></span>` },
        { key: 'warmth', label: '關係溫度', m: 'meta', sort: (r) => (r.w.days == null ? 9999 : r.w.days), render: (r) => UI.warmth(r.w) },
        { key: 'last', label: '最後往來', m: 'meta', mLabel: '', sort: (r) => r.last, defaultDir: -1, render: (r) => (r.last ? html`<span class="t-2">${UI.relTime(r.last)}</span>` : html`<span class="t-3">尚無</span>`) },
        { key: 'owner', label: '負責人', m: 'hide', sort: (r) => (r.rep ? r.rep.name : null), render: (r) => (r.rep ? html`<span class="ct-rep">${UI.nameBlock(r.rep, { size: 26, title: false })}<span>${r.rep.name}</span></span>` : '') },
        { key: 'open', label: '進行中交易', align: 'right', m: 'end', sort: (r) => r.openAmt, defaultDir: -1, render: (r) => (r.openAmt ? html`<span class="ct-open"><span class="ct-open-amt">${UI.money(r.openAmt, { compact: true })}</span><span class="ct-open-n">${r.openN} 筆</span></span>` : html`<span class="ct-open-none">–</span>`) },
      ],
    });

    const statsEl = page.querySelector('.ct-stats');
    function drawStats() {
      const all = store.all('contacts');
      const t = U.today();
      const monthKey = U.iso(t).slice(0, 7);
      const lastMonth = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const lastKey = U.iso(lastMonth).slice(0, 7);
      const newThis = all.filter((c) => (c.createdAt || '').slice(0, 7) === monthKey).length;
      const touchesIn = (key, uptoDay) => store.all('activities').filter((a) => store.TOUCH_TYPES.has(a.type) && a.contactId && a.at.slice(0, 7) === key && +a.at.slice(8, 10) <= uptoDay).length;
      const thisM = touchesIn(monthKey, t.getDate());
      const lastM = touchesIn(lastKey, t.getDate());
      const diff = lastM ? Math.round(((thisM - lastM) / lastM) * 100) : 0;
      const stale = vms.filter(VIEWS.find((v) => v.id === 'stale').test).length;
      const customers = all.filter((c) => c.lifecycle === '客戶').length;
      const series = store.touchSeries({}, 8);
      statsEl.innerHTML = String(html`
        ${UI.statCard({ label: '全部聯絡人', value: U.num(all.length), unit: '位', icon: 'contacts', tone: 3, delta: newThis ? { text: `${newThis} 本月新增`, dir: 'up' } : { text: '本月無新增', dir: 'flat' }, foot: `${store.all('companies').length} 家公司` })}
        ${UI.statCard({ label: '本月往來', value: U.num(thisM), unit: '次', icon: 'activities', tone: 1, delta: { text: `${Math.abs(diff)}%`, dir: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' }, foot: '比上月同期', spark: series })}
        ${UI.statCard({ label: '該聯絡了', value: U.num(stale), unit: '位', icon: 'clock', tone: 4, foot: '有進行中交易、3 週沒往來', href: router.href('/contacts', { view: 'stale' }) })}
        ${UI.statCard({ label: '客戶', value: U.num(customers), unit: '位', icon: 'tag', tone: 2, delta: { text: `${Math.round((customers / Math.max(1, all.length)) * 100)}%`, dir: 'flat' }, foot: '佔全部聯絡人' })}`);
    }
    function drawViews() {
      const base = apply(vms, st, { skipView: true });
      viewsEl.innerHTML = String(UI.tabs({
        name: 'ct-view', value: st.view, cls: 'ct-tabs',
        items: VIEWS.map((v) => ({ value: v.id, label: v.note ? html`${v.label}<span class="ct-tab-note">（${v.note}）</span>` : v.label, count: base.filter(v.test).length })),
      }));
    }
    function drawFilters() {
      filtersEl.innerHTML = String(html`${FILTERS.map((f) => {
        const on = st[f.key];
        const opt = on ? f.options().find((o) => o.value === on) : null;
        return html`<button type="button" class="tbtn ct-fbtn${on ? ' is-on' : ''}" data-filter="${f.key}" aria-haspopup="menu" aria-expanded="false">${opt && opt.lead ? opt.lead : UI.icon(f.icon || 'filter', { size: 14 })}<span>${f.label}${opt ? html`<b>：${opt.short || opt.label}</b>` : ''}</span>${UI.icon('chevronDown', { size: 14 })}</button>`;
      })}${anyFilter() ? UI.btn({ label: '清除篩選', size: 'sm', variant: 'quiet', cls: 'ct-clear', attrs: { 'data-act': 'clear' } }) : ''}`);
    }
    function drawBulk() {
      const n = table.selected().length;
      bulkEl.hidden = !n;
      toolsEl.hidden = !!n;
      if (n) bulkEl.querySelector('.ct-bulk-n').textContent = `已選 ${n} 位`;
    }
    function draw() {
      const rows = apply(vms, st);
      drawStats();
      drawViews();
      drawFilters();
      countEl.textContent = rows.length === vms.length ? `${rows.length} 位` : `顯示 ${rows.length} ／ ${vms.length} 位`;
      table.update(rows);
      drawBulk();
    }
    draw();

    /* 搜尋 */
    const pushQ = U.debounce(() => syncUrl(), 300);
    searchEl.addEventListener('input', () => { st.q = searchEl.value; draw(); pushQ(); });
    searchEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && searchEl.value) { e.stopPropagation(); searchEl.value = ''; st.q = ''; draw(); syncUrl(); } });

    /* 檢視 */
    page.addEventListener('tab-change', (e) => {
      if (e.detail.name !== 'ct-view') return;
      st.view = e.detail.value;
      table.clearSelection();
      syncUrl();
      draw();
      const b = viewsEl.querySelector(`[data-value="${st.view}"]`);
      b && b.focus({ preventScroll: true });
    });

    /* 篩選選單 */
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
          label: f.label, cls: 'ct-fmenu',
          onSelect: (it) => {
            st[f.key] = it.value;
            table.clearSelection();
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
      const co = e.target.closest('[data-co]');
      if (co && !e.metaKey && !e.ctrlKey) { e.preventDefault(); UI.openCompany(co.dataset.co); return; }
      const bb = e.target.closest('[data-bulk]');
      if (bb) bulk(bb.dataset.bulk, bb);
    });

    /* 批次 */
    function bulk(kind, anchor) {
      const ids = table.selected();
      if (!ids.length) return;
      if (kind === 'clear') { table.clearSelection(); return; }
      if (kind === 'assign') {
        UI.menu(anchor, [{ heading: `指派 ${ids.length} 位聯絡人給` }, ...store.all('reps').map((r) => ({
          label: r.name + (r.me ? '（我）' : ''), lead: UI.nameBlock(r, { size: 20, title: false }), hint: r.region,
          onSelect: () => {
            const { undo } = store.batch(() => ids.forEach((id) => store.update('contacts', id, { owner: r.id })));
            table.clearSelection();
            UI.toast(`已將 ${ids.length} 位指派給${r.name}`, { undo });
          },
        }))], { label: '指派負責人' });
      } else if (kind === 'tag') {
        UI.menu(anchor, [{ heading: `為 ${ids.length} 位加上標籤` }, ...store.TAGS.map((t) => {
          const have = ids.filter((id) => (store.get('contacts', id).tags || []).includes(t)).length;
          return {
            label: t, icon: 'tag', hint: have === ids.length ? '都已有' : have ? `${have} 位已有` : '', disabled: have === ids.length,
            onSelect: () => {
              const { undo } = store.batch(() => ids.forEach((id) => { const c = store.get('contacts', id); if (!(c.tags || []).includes(t)) store.update('contacts', id, { tags: [...(c.tags || []), t] }); }));
              table.clearSelection();
              UI.toast(`已為 ${ids.length - have} 位加上「${t}」`, { undo });
            },
          };
        })], { label: '加標籤' });
      } else if (kind === 'delete') {
        const first = store.get('contacts', ids[0]);
        const { undo } = store.batch(() => ids.forEach((id) => CRM.actions.deleteRecord('contacts', id, { silent: true })));
        table.clearSelection();
        UI.toast(ids.length === 1 ? `已刪除「${first.name}」` : `已刪除 ${ids.length} 位聯絡人`, { undo });
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape' && !UI.layers.length && table.selected().length && !U.isTyping(e)) table.clearSelection();
    };
    document.addEventListener('keydown', onKey);

    const off = store.subscribe((evt) => {
      if (!evt.has('contacts', 'activities', 'deals', 'companies', 'reps')) return;
      vms = buildVMs();
      draw();
      const cnt = el.querySelector('.ph-count');
      if (cnt) cnt.textContent = store.all('contacts').length;
    });
    return () => { alive = false; off(); document.removeEventListener('keydown', onKey); };
  }

  /* ════════ 詳細頁 ════════ */
  const TL_TYPES = [
    { id: 'all', name: '全部' },
    { id: 'call', name: '通話' },
    { id: 'email', name: 'Email' },
    { id: 'meeting', name: '會議' },
    { id: 'note', name: '筆記' },
    { id: 'task', name: '任務完成' },
    { id: 'stage', name: '階段變更' },
  ];
  const TYPE_ICON = { call: 'phone', email: 'mail', meeting: 'meeting', note: 'note', task: 'check', stage: 'stage' };
  const TYPE_NAME = { call: '通話', email: 'Email', meeting: '會議', note: '筆記', task: '完成任務', stage: '階段變更' };
  const PLACEHOLDER = {
    call: '通話重點、對方的疑慮、下一步。例如：採購說預算要等 11 月董事會',
    email: '信件摘要。例如：寄出 PoC 兩週數據與報價草案',
    meeting: '會議結論與待辦。例如：場勘三號廠房，12 台主軸馬達需加裝 VB-3',
    note: '寫下觀察或提醒，只有團隊看得到',
  };

  function mountDetail(el, ctx, id) {
    const { store, router } = ctx;
    const UI = ui();
    const back = { href: router.href('/contacts', savedQuery()), label: '聯絡人' };
    const c0 = store.get('contacts', id);
    el.appendChild(UI.pageHeader({ title: '聯絡人', sub: c0 ? `${c0.name} · 詳細資料` : '', back }));

    const page = document.createElement('div');
    page.className = 'page pg-contacts ct-detail';
    el.appendChild(page);

    const cur = () => store.get('contacts', id);
    if (!cur()) {
      page.innerHTML = String(html`<section class="panel ct-missing">${UI.emptyState({
        title: '找不到這位聯絡人',
        body: `編號「${id}」不存在，可能已被刪除或網址有誤。`,
        action: html`<a class="btn btn--primary btn--sm" href="${back.href}">${UI.icon('chevronLeft', { size: 16 })}<span>回到聯絡人清單</span></a>`,
      })}</section>`);
      const off0 = store.subscribe(() => { if (cur()) router.refresh(); });
      return () => off0();
    }

    let tlType = 'all';
    let tlLimit = 30;
    let composeType = 'call';
    let editing = false;

    page.innerHTML = String(html`
      <section class="card ct-hero" aria-label="聯絡人摘要"></section>
      <div class="ct-grid">
        <div class="ct-main">
          <section class="card ct-compose" aria-label="記一筆"></section>
          <section class="card ct-tl" aria-label="往來紀錄"></section>
        </div>
        <aside class="ct-side">
          <details class="card ct-sec ct-props" open>
            <summary class="ct-props-sum"><span class="section-title">聯絡資料</span>${UI.icon('chevronDown', { size: 16, cls: 'ct-props-caret' })}</summary>
            <dl class="ct-props-list"></dl>
          </details>
          <section class="card ct-sec ct-deals" aria-label="進行中交易"></section>
          <section class="card ct-sec ct-tasks" aria-label="待辦任務"></section>
          <section class="card ct-sec ct-peers" aria-label="同公司的其他人"></section>
        </aside>
      </div>`);
    const $ = (s) => page.querySelector(s);
    const heroEl = $('.ct-hero'), composeEl = $('.ct-compose'), tlEl = $('.ct-tl'), propsEl = $('.ct-props-list'), dealsEl = $('.ct-deals'), tasksEl = $('.ct-tasks'), peersEl = $('.ct-peers');
    if (U.isMobile()) $('.ct-props').open = false;

    /* 頁首：姓名、職稱、動作、近三個月劃記、溫度 */
    function drawHero() {
      const c = cur();
      const co = store.get('companies', c.companyId);
      const rep = store.rep(c.owner);
      const w = store.warmth({ contactId: id });
      const t = U.today();
      const months = [2, 1, 0].map((i) => {
        const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const n = store.all('activities').filter((a) => a.contactId === id && store.TOUCH_TYPES.has(a.type) && a.at.slice(0, 7) === key).length;
        return { label: `${d.getMonth() + 1} 月`, n, current: i === 0 };
      });
      const total = months.reduce((s, m) => s + m.n, 0);
      const tel = digits(c.mobile);
      heroEl.innerHTML = String(html`
        <div class="ct-hero-id">
          ${UI.nameBlock(c, { size: 72, cls: 'ct-hero-nb' })}
          <div class="ct-hero-text">
            <h2 class="ct-name">${c.name}</h2>
            <p class="ct-role">${c.title || '未填職稱'}${co ? html`<span class="ct-dot" aria-hidden="true">·</span><a href="${router.href('/companies/' + co.id)}" data-co="${co.id}">${co.name}</a>` : ''}</p>
            <p class="ct-facts">
              ${rep ? html`<span class="ct-fact">${UI.nameBlock(rep, { size: 20, title: false })}<span>${rep.name}負責</span></span>` : ''}
              ${UI.tag(c.lifecycle, LIFE_TONE[c.lifecycle], { dot: true })}
              ${(c.tags || []).map((t) => UI.tag(t, '', { cls: 'tag--line' }))}
            </p>
          </div>
        </div>
        <div class="ct-hero-acts">
          ${tel ? html`<a class="btn btn--tonal btn--sm" href="tel:${tel}">${UI.icon('phone', { size: 16 })}<span>撥打</span></a>` : UI.btn({ label: '撥打', icon: 'phone', size: 'sm', disabled: true })}
          ${c.email ? html`<a class="btn btn--tonal btn--sm" href="mailto:${c.email}">${UI.icon('mail', { size: 16 })}<span>Email</span></a>` : UI.btn({ label: 'Email', icon: 'mail', size: 'sm', disabled: true })}
          ${UI.btn({ label: '記一筆', icon: 'plus', size: 'sm', variant: 'primary', attrs: { 'data-act': 'log' } })}
          ${UI.btn({ label: '新增任務', icon: 'tasks', size: 'sm', attrs: { 'data-act': 'task' } })}
          ${UI.iconBtn('edit', { label: '編輯聯絡人', size: 'sm', attrs: { 'data-act': 'edit' } })}
        </div>
        <div class="ct-hero-side">
          <div class="ct-months" role="group" aria-label="近三個月往來 ${total} 次">
            ${months.map((m) => html`<div class="ct-month${m.current ? ' is-current' : ''}"><span class="ct-month-l">${m.label}</span>${UI.tally(m.n, { size: 20, key: m.current ? 'contact:' + id : '', label: `${m.label}往來 ${m.n} 次`, cls: m.current ? 'ct-tally-now' : '' })}</div>`)}
          </div>
          <div class="ct-hero-foot"><p class="ct-hero-sum"><b>${total}</b><span>次往來 · 近三個月</span></p>
          <div class="ct-hero-warm">${UI.warmth(w)}<span class="t-12 t-3">${w.days == null ? '尚無往來' : w.days === 0 ? '今天' : `${w.days} 天前`}</span></div></div>
        </div>`);
    }

    /* 活動輸入器 */
    function drawCompose() {
      const deals = store.openDealsFor({ contactId: id });
      composeEl.innerHTML = String(html`<form class="ct-compose-form" data-type="${composeType}" novalidate>
        <div class="ct-compose-head">
          <h2 class="section-title">記一筆</h2>
          ${UI.segmented({ name: 'ct-type', value: composeType, size: 'sm', label: '活動類型', options: CRM.forms.LOG_TYPES })}
        </div>
        <input class="input ct-c-subject only-email" name="subject" placeholder="主旨，例如：報價單 Q-2026-0412" aria-label="Email 主旨" autocomplete="off">
        <textarea class="input textarea ct-c-body" name="body" rows="3" placeholder="${PLACEHOLDER[composeType]}" aria-label="內容"></textarea>
        <div class="ct-compose-row">
          <label class="ct-c-field only-meeting"><span>地點</span><input class="input" name="location" placeholder="三樓會議室、視訊" autocomplete="off"></label>
          <label class="ct-c-field ct-c-dur only-call only-meeting"><span>時長</span><input class="input" type="number" name="duration" min="1" inputmode="numeric" value="${composeType === 'meeting' ? 60 : 10}"><span>分</span></label>
          ${deals.length ? html`<label class="ct-c-field ct-c-deal"><span>交易</span><span class="select-wrap"><select class="input select" name="dealId"><option value="">不關聯</option>${deals.map((d, i) => html`<option value="${d.id}"${i === 0 && deals.length === 1 ? raw(' selected') : ''}>${d.name}</option>`)}</select>${UI.icon('chevronDown', { size: 16, cls: 'select-caret' })}</span></label>` : ''}
          <span class="ct-c-hint">${UI.kbd('⌘')}${UI.kbd('Enter')}</span>
          ${UI.btn({ label: '記下', variant: 'primary', size: 'sm', type: 'submit', cls: 'ct-c-submit' })}
        </div>
        <p class="ct-c-err" role="alert" hidden>先寫下內容再記。</p>
      </form>`);
    }
    function setComposeType(t) {
      composeType = t;
      const form = composeEl.querySelector('form');
      form.dataset.type = t;
      form.querySelector('[name="body"]').placeholder = PLACEHOLDER[t];
      const dur = form.querySelector('[name="duration"]');
      if (t === 'meeting' && +dur.value < 30) dur.value = 60;
      if (t === 'call' && +dur.value >= 30) dur.value = 10;
    }
    composeEl.addEventListener('seg-change', (e) => { if (e.detail.name === 'ct-type') setComposeType(e.detail.value); });
    function submitCompose() {
      const form = composeEl.querySelector('form');
      const f = Object.fromEntries(new FormData(form).entries());
      const body = (f.body || '').trim();
      const err = form.querySelector('.ct-c-err');
      if (!body) { err.hidden = false; form.querySelector('[name="body"]').focus(); return; }
      err.hidden = true;
      const data = { type: composeType, contactId: id, dealId: f.dealId || null, body };
      if (composeType === 'call') data.duration = Math.max(1, +f.duration || 5);
      if (composeType === 'meeting') { data.duration = Math.max(1, +f.duration || 60); data.location = (f.location || '').trim() || '未填地點'; data.title = body.split(/[，。\n]/)[0].slice(0, 24) || '會議'; }
      if (composeType === 'email') data.subject = (f.subject || '').trim() || '（無主旨）';
      CRM.actions.logActivity(data);
      form.querySelector('[name="body"]').value = '';
      const s = form.querySelector('[name="subject"]'); if (s) s.value = '';
      const l = form.querySelector('[name="location"]'); if (l) l.value = '';
    }
    composeEl.addEventListener('submit', (e) => { e.preventDefault(); submitCompose(); });
    composeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitCompose(); }
    });
    composeEl.addEventListener('input', (e) => { if (e.target.name === 'body') composeEl.querySelector('.ct-c-err').hidden = true; });

    /* 往來時間軸 */
    function contactActivities() {
      const dealIds = new Set(store.dealsFor({ contactId: id }).map((d) => d.id));
      return store.all('activities').filter((a) => a.contactId === id || (a.type === 'stage' && dealIds.has(a.dealId))).sort((a, b) => cmp(a.at, b.at));
    }
    function evView(a) {
      const rep = store.rep(a.owner);
      const deal = a.dealId ? store.get('deals', a.dealId) : null;
      let head = TYPE_NAME[a.type] || a.type;
      const meta = [];
      if (a.type === 'call' && a.duration) meta.push(U.duration(a.duration));
      if (a.type === 'meeting') { if (a.location) meta.push(a.location); if (a.duration) meta.push(U.duration(a.duration)); }
      let bodyView = html`<p class="ct-ev-text">${a.body}</p>`;
      if (a.type === 'email') bodyView = html`<p class="ct-ev-subj">${a.subject || '（無主旨）'}</p>${a.body ? html`<p class="ct-ev-text">${a.body}</p>` : ''}`;
      if (a.type === 'meeting' && a.title && a.title !== a.body) bodyView = html`<p class="ct-ev-subj">${a.title}</p><p class="ct-ev-text">${a.body}</p>`;
      if (a.type === 'stage') bodyView = html`<p class="ct-ev-text ct-ev-stage">${a.from ? UI.stageTag(a.from) : ''}${UI.icon('arrowRight', { size: 14 })}${UI.stageTag(a.to)}</p>`;
      return html`<li class="ct-ev" data-type="${a.type}">
        <span class="ct-ev-ic" aria-hidden="true">${UI.icon(TYPE_ICON[a.type] || 'note', { size: 18 })}</span>
        <div class="ct-ev-main">
          <p class="ct-ev-head"><span class="ct-ev-type">${head}</span>${meta.length ? html`<span class="ct-ev-meta">${meta.join(' · ')}</span>` : ''}<time class="ct-ev-time t-mono" datetime="${a.at}">${U.time(a.at)}</time></p>
          ${bodyView}
          <p class="ct-ev-foot">${rep ? html`<span class="ct-ev-who">${UI.nameBlock(rep, { size: 18, title: false })}${rep.name}</span>` : ''}${deal ? html`<button type="button" class="ct-ev-deal" data-deal="${deal.id}">${UI.icon('deals', { size: 14 })}<span>${deal.name}</span></button>` : ''}</p>
        </div>
      </li>`;
    }
    function dayLabel(dateIso) {
      const diff = U.daysFromToday(dateIso);
      const base = `${U.fmtDate(dateIso)} ${U.weekday(U.parse(dateIso))}`;
      return diff === 0 ? `今天 · ${base}` : diff === -1 ? `昨天 · ${base}` : base;
    }
    function drawTimeline() {
      const all = contactActivities();
      const counts = Object.fromEntries(TL_TYPES.map((t) => [t.id, t.id === 'all' ? all.length : all.filter((a) => a.type === t.id).length]));
      const items = TL_TYPES.filter((t) => t.id === 'all' || counts[t.id] || t.id === tlType).map((t) => ({ value: t.id, label: t.name, count: counts[t.id] }));
      const list = tlType === 'all' ? all : all.filter((a) => a.type === tlType);
      const shown = list.slice(0, tlLimit);
      const groups = [];
      shown.forEach((a) => {
        const d = a.at.slice(0, 10);
        const g = groups[groups.length - 1];
        if (g && g.d === d) g.items.push(a); else groups.push({ d, items: [a] });
      });
      tlEl.innerHTML = String(html`
        <div class="ct-tl-head"><h2 class="section-title">往來紀錄</h2>${UI.tabs({ name: 'ct-tl', value: tlType, items, cls: 'ct-tl-tabs' })}</div>
        ${shown.length ? html`<div class="ct-tl-body">${groups.map((g) => html`<section class="ct-day"><h3 class="ct-day-h">${dayLabel(g.d)}</h3><ol class="ct-evs">${g.items.map(evView)}</ol></section>`)}</div>` : UI.emptyState({ compact: true, title: all.length ? '這個類型還沒有紀錄' : '還沒有往來', body: all.length ? '換個類型看看，或在上方記一筆。' : '記下第一通電話或會議，劃記就會開始累積。' })}
        ${list.length > shown.length ? html`<div class="ct-more">${UI.btn({ label: `顯示更早的 ${Math.min(30, list.length - shown.length)} 筆`, size: 'sm', variant: 'quiet', attrs: { 'data-act': 'more' } })}<span class="t-12 t-3">共 ${list.length} 筆</span></div>` : ''}`);
    }
    tlEl.addEventListener('tab-change', (e) => { if (e.detail.name !== 'ct-tl') return; tlType = e.detail.value; tlLimit = 30; drawTimeline(); const b = tlEl.querySelector(`.ct-tl-tabs [data-value="${tlType}"]`); b && b.focus({ preventScroll: true }); });

    /* 聯絡資料（就地編輯） */
    const PROPS = [
      { key: 'email', label: 'Email', kind: 'text', type: 'email' },
      { key: 'mobile', label: '手機', kind: 'text', type: 'tel' },
      { key: 'phone', label: '公司電話', kind: 'text', type: 'tel' },
      { key: 'title', label: '職稱', kind: 'text', type: 'text' },
      { key: 'companyId', label: '公司', kind: 'readonly' },
      { key: 'lifecycle', label: '生命週期', kind: 'menu' },
      { key: 'tags', label: '標籤', kind: 'tags' },
      { key: 'owner', label: '負責人', kind: 'menu' },
      { key: 'reportsTo', label: '直屬主管', kind: 'menu' },
      { key: 'createdAt', label: '建立於', kind: 'readonly' },
    ];
    function propValue(p, c) {
      if (p.key === 'companyId') { const co = store.get('companies', c.companyId); return co ? html`<a class="ct-pv-link" href="${router.href('/companies/' + co.id)}" data-co="${co.id}">${co.name}</a>` : html`<span class="t-3">無</span>`; }
      if (p.key === 'createdAt') return c.createdAt ? html`<span>${U.fmtDateLong(c.createdAt).replace(/ 週.$/, '')}</span>` : html`<span class="t-3">不明</span>`;
      if (p.key === 'owner') { const r = store.rep(c.owner); return r ? html`<span class="ct-pv-person">${UI.nameBlock(r, { size: 20, title: false })}${r.name}</span>` : html`<span class="t-3">未指派</span>`; }
      if (p.key === 'reportsTo') { const b = c.reportsTo && store.get('contacts', c.reportsTo); return b ? html`<span class="ct-pv-person">${UI.nameBlock(b, { size: 20, title: false })}${b.name}<span class="t-3">${b.title}</span></span>` : html`<span class="t-3">無</span>`; }
      if (p.key === 'tags') return (c.tags || []).length ? html`<span>${c.tags.join('、')}</span>` : html`<span class="t-3">新增標籤</span>`;
      const v = c[p.key];
      return v ? html`<span class="ct-pv-text">${v}</span>` : html`<span class="t-3">新增${p.label}</span>`;
    }
    function drawProps() {
      const c = cur();
      propsEl.innerHTML = String(html`${PROPS.map((p) => html`<div class="ct-prop" data-key="${p.key}"><dt>${p.label}</dt><dd>${p.kind === 'readonly' ? html`<span class="ct-pv is-ro">${propValue(p, c)}</span>` : html`<button type="button" class="ct-pv" data-edit="${p.key}" aria-label="編輯${p.label}"${p.kind !== 'text' ? raw(' aria-haspopup="menu"') : ''}>${propValue(p, c)}${UI.icon('edit', { size: 14, cls: 'ct-pv-ic' })}</button>`}</dd></div>`)}`);
    }
    function commit(patch, label) {
      const { undo } = store.batch(() => store.update('contacts', id, patch));
      UI.toast(`已更新${label}`, { undo });
    }
    const refocus = (key) => requestAnimationFrame(() => { const b = propsEl.querySelector(`[data-edit="${key}"]`); b && b.focus({ preventScroll: true }); });
    function editText(btn, p) {
      const c = cur();
      const old = c[p.key] || '';
      editing = true;
      const input = h(html`<input class="input ct-pin" type="${p.type}" name="ct-${p.key}" value="${old}" aria-label="${p.label}" autocomplete="off">`);
      btn.replaceWith(input);
      input.focus();
      input.select();
      let done = false;
      const finish = (save) => {
        if (done) return;
        const v = input.value.trim();
        if (save && p.key === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
          if (document.activeElement === input) { input.setAttribute('aria-invalid', 'true'); input.title = 'Email 格式不正確'; UI.toast('Email 格式不正確，請再檢查'); return; }
          save = false;
          UI.toast('Email 格式不正確，沒有儲存');
        }
        done = true;
        editing = false;
        if (save && v !== old) commit({ [p.key]: v }, p.label);
        else drawProps();
        refocus(p.key);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      });
      input.addEventListener('blur', () => finish(true));
    }
    function editMenu(btn, p) {
      const c = cur();
      let items = [];
      if (p.key === 'lifecycle') items = store.LIFECYCLES.map((l) => ({ label: l, checked: c.lifecycle === l, onSelect: () => l !== c.lifecycle && commit({ lifecycle: l }, '生命週期') }));
      if (p.key === 'owner') items = store.all('reps').map((r) => ({ label: r.name + (r.me ? '（我）' : ''), lead: UI.nameBlock(r, { size: 20, title: false }), hint: r.region, checked: c.owner === r.id, onSelect: () => r.id !== c.owner && commit({ owner: r.id }, '負責人') }));
      if (p.key === 'reportsTo') {
        const peers = store.contactsOf(c.companyId).filter((x) => x.id !== id && x.reportsTo !== id);
        items = [{ label: '無', checked: !c.reportsTo, onSelect: () => c.reportsTo && commit({ reportsTo: null }, '直屬主管') }, { divider: true },
          ...peers.map((x) => ({ label: x.name, lead: UI.nameBlock(x, { size: 20, title: false }), hint: x.title, checked: c.reportsTo === x.id, onSelect: () => x.id !== c.reportsTo && commit({ reportsTo: x.id }, '直屬主管') }))];
      }
      if (p.key === 'tags') {
        items = [{ heading: '點選加上或移除' }, ...store.TAGS.map((t) => {
          const on = (c.tags || []).includes(t);
          return { label: t, checked: on, onSelect: () => commit({ tags: on ? c.tags.filter((x) => x !== t) : [...(c.tags || []), t] }, `標籤（${on ? '移除' : '加上'}「${t}」）`) };
        })];
      }
      UI.menu(btn, items, { label: p.label, align: 'end', onSelect: () => refocus(p.key) });
    }
    propsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-edit]');
      if (!b) return;
      const p = PROPS.find((x) => x.key === b.dataset.edit);
      if (p.kind === 'text') editText(b, p); else editMenu(b, p);
    });

    /* 側欄：交易、任務、同事 */
    function drawDeals() {
      const deals = store.openDealsFor({ contactId: id }).slice().sort((a, b) => a.closeDate.localeCompare(b.closeDate));
      dealsEl.innerHTML = String(html`<header class="ct-side-h"><h2 class="section-title">進行中交易</h2><span class="ct-side-n">${deals.length ? UI.money(deals.reduce((s, d) => s + d.amount, 0), { compact: true }) : ''}</span>${UI.iconBtn('plus', { label: '新增交易', size: 'sm', attrs: { 'data-act': 'deal' } })}</header>
        ${deals.length ? html`<ul class="ct-deal-list">${deals.map((d) => html`<li><button type="button" class="ct-deal" data-deal="${d.id}"><span class="ct-deal-top"><span class="ct-deal-name">${d.name}</span>${UI.money(d.amount, { compact: true, cls: 'ct-deal-amt' })}</span><span class="ct-deal-bot">${UI.stageTag(d.stage)}<span class="t-12 t-3">預計 ${U.fmtDate(d.closeDate)}</span><span class="t-mono t-12 t-3 ct-deal-code">${d.code}</span></span></button></li>`)}</ul>` : html`<p class="ct-side-empty">沒有進行中的交易。</p>`}`);
    }
    function drawTasks() {
      const tasks = store.tasksFor({ contactId: id }, { open: true }).slice().sort((a, b) => (a.due + (a.dueTime || '')).localeCompare(b.due + (b.dueTime || '')));
      tasksEl.innerHTML = String(html`<header class="ct-side-h"><h2 class="section-title">待辦任務</h2><span class="ct-side-n">${tasks.length ? tasks.length + ' 件' : ''}</span>${UI.iconBtn('plus', { label: '新增任務', size: 'sm', attrs: { 'data-act': 'task' } })}</header>
        ${tasks.length ? html`<ul class="ct-task-list">${tasks.map((t) => html`<li class="ct-task">${UI.checkbox({ attrs: { 'data-task': t.id, 'aria-label': '完成：' + t.title } })}<span class="ct-task-text"><span class="ct-task-title">${t.priority === 'high' ? html`<span class="ct-task-hi" data-tip="高優先">${UI.icon('flag', { size: 14 })}</span>` : ''}${t.title}</span>${UI.due(t.due, t.dueTime)}</span></li>`)}</ul>` : html`<p class="ct-side-empty">沒有待辦，要不要排下一步？</p>`}`);
    }
    function drawPeers() {
      const c = cur();
      const co = store.get('companies', c.companyId);
      const peers = co ? store.contactsOf(co.id).filter((x) => x.id !== id) : [];
      const lv = { top: 0, mid: 1, low: 2 };
      peers.sort((a, b) => (lv[a.level] ?? 3) - (lv[b.level] ?? 3));
      peersEl.innerHTML = String(html`<header class="ct-side-h"><h2 class="section-title">同公司的其他人</h2><span class="ct-side-n">${peers.length ? peers.length + ' 位' : ''}</span></header>
        ${peers.length ? html`<ul class="ct-peer-list">${peers.slice(0, 6).map((x) => html`<li class="ct-peer">${UI.personCell(x, { size: 28, sub: x.title, href: router.href('/contacts/' + x.id) })}${UI.warmth(store.warmth({ contactId: x.id }), { label: false })}</li>`)}</ul>` : html`<p class="ct-side-empty">${co ? '這家公司還沒有其他聯絡人。' : '尚未關聯公司。'}</p>`}
        ${co ? html`<a class="ct-peer-more" href="${router.href('/companies/' + co.id)}" data-co="${co.id}">${peers.length > 6 ? `查看全部 ${peers.length} 位與組織圖` : '查看公司與組織圖'}${UI.icon('chevronRight', { size: 14 })}</a>` : ''}`);
    }

    function drawAll() {
      drawHero();
      drawTimeline();
      if (!editing) drawProps();
      drawDeals();
      drawTasks();
      drawPeers();
    }
    drawCompose();
    drawAll();

    /* 事件委派 */
    page.addEventListener('click', (e) => {
      const co = e.target.closest('[data-co]');
      if (co && !e.metaKey && !e.ctrlKey) { e.preventDefault(); UI.openCompany(co.dataset.co); return; }
      const deal = e.target.closest('[data-deal]');
      if (deal) { CRM.ui.openDeal(deal.dataset.deal); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const c = cur();
      const a = act.dataset.act;
      if (a === 'log') {
        const ta = composeEl.querySelector('[name="body"]');
        composeEl.scrollIntoView({ block: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
        ta.focus({ preventScroll: true });
      } else if (a === 'task') UI.create('task', { contactId: id });
      else if (a === 'edit') UI.edit('contact', id);
      else if (a === 'deal') UI.create('deal', { companyId: c.companyId || '', contactIds: [id] });
      else if (a === 'more') { tlLimit += 30; drawTimeline(); }
    });
    tasksEl.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-task]');
      if (cb && cb.checked) CRM.actions.completeTask(cb.dataset.task);
    });

    const off = store.subscribe((evt) => {
      if (!cur()) {
        page.innerHTML = String(html`<section class="panel ct-missing">${UI.emptyState({ title: '這位聯絡人已刪除', body: '可以按通知上的「復原」救回來。', action: html`<a class="btn btn--primary btn--sm" href="${back.href}">${UI.icon('chevronLeft', { size: 16 })}<span>回到聯絡人清單</span></a>` })}</section>`);
        return;
      }
      if (!page.querySelector('.ct-hero')) { router.refresh(); return; }
      if (evt.has('contacts', 'activities', 'deals', 'tasks', 'companies', 'reps')) drawAll();
      if (evt.has('deals')) {
        const form = composeEl.querySelector('form');
        const names = ['body', 'subject', 'location', 'duration'];
        const keep = form ? names.map((n) => form.querySelector(`[name="${n}"]`).value) : null;
        drawCompose();
        if (keep) { const f2 = composeEl.querySelector('form'); names.forEach((n, i) => { f2.querySelector(`[name="${n}"]`).value = keep[i]; }); }
      }
    });
    return () => off();
  }

  /* ── 註冊 ─────────────────────────────────────────── */
  let cleanup = null;
  CRM.pages.contacts = {
    route: /^\/contacts(?:\/([\w-]+))?$/,
    title: (ctx) => {
      const id = ctx.params && ctx.params[0];
      if (!id) return '聯絡人';
      const c = ctx.store.get('contacts', id);
      return c ? c.name + ' · 聯絡人' : '找不到聯絡人';
    },
    nav: 'contacts',
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
