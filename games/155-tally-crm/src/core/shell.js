/* shell · 側欄（品牌、搜尋、導覽計數、我的檢視、團隊本季、進度、使用者）、手機分頁列、頁首、快捷鍵 */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const U = CRM.util;
  const { html, h } = U;
  const ui = CRM.ui;
  const icon = CRM.icon;
  const S = () => CRM.store;

  const NAV = [
    { nav: 'dashboard', path: '/', label: '總覽', icon: 'dashboard', key: 'd', title: '儀表板' },
    { nav: 'contacts', path: '/contacts', label: '聯絡人', icon: 'contacts', key: 'c', title: '聯絡人' },
    { nav: 'companies', path: '/companies', label: '公司', icon: 'companies', key: 'o', title: '公司' },
    { nav: 'deals', path: '/deals', label: '交易', icon: 'deals', key: 'p', title: 'Pipeline' },
    { nav: 'tasks', path: '/tasks', label: '任務', icon: 'tasks', key: 't', title: '任務' },
    { nav: 'activities', path: '/activities', label: '活動紀錄', icon: 'activities', key: 'a', title: '活動紀錄' },
  ];

  let mainEl = null;
  let sideEl = null;
  let tabEl = null;
  let currentNav = null;

  /* ── 側欄資料 ─────────────────────────────────── */
  function navCounts() {
    const s = S();
    const me = s.me().id;
    const today = U.iso(U.today());
    const myOpenTasks = s.all('tasks').filter((t) => !t.done && t.owner === me);
    return {
      contacts: s.all('contacts').length,
      companies: s.all('companies').length,
      deals: s.all('deals').filter(s.isOpen).length,
      tasks: myOpenTasks.filter((t) => t.due && t.due <= today).length,
      overdue: myOpenTasks.filter((t) => t.due && t.due < today).length,
    };
  }
  function savedViews() {
    const s = S();
    const me = s.me().id;
    const today = U.iso(U.today());
    const monthEnd = U.iso(s.period('month').end);
    const stale = s.all('contacts').filter((c) => {
      const w = s.warmth({ contactId: c.id }).id;
      return (w === 'cool' || w === 'cold') && s.openDealsFor({ contactId: c.id }).length > 0;
    }).length;
    return [
      { href: '#/contacts?view=stale', label: '該聯絡了', n: stale, tip: '有進行中交易、但 3 週以上沒往來的聯絡人' },
      { href: '#/deals?close=month', label: '本月要成交', n: s.all('deals').filter((d) => s.isOpen(d) && d.closeDate <= monthEnd).length },
      { href: '#/tasks?view=list&due=overdue', label: '逾期任務', n: s.all('tasks').filter((t) => !t.done && t.due && t.due < today).length, warn: true },
      { href: '#/contacts?view=mine', label: '我的聯絡人', n: s.all('contacts').filter((c) => c.owner === me).length },
    ];
  }

  function sideView() {
    const s = S();
    const me = s.me();
    const c = navCounts();
    const count = { contacts: c.contacts, companies: c.companies, deals: c.deals, tasks: c.tasks };
    return html`
      <div class="side-top">
        <a class="side-brand" href="#/" aria-label="劃記 TALLY CRM，回到總覽">${ui.brandMark({ size: 26 })}<span class="side-brand-text"><b>劃記</b><span>TALLY CRM</span></span></a>
      </div>
      <nav class="side-scroll" aria-label="主要導覽">
        <p class="side-heading">工作區</p>
        <ul class="side-nav">${NAV.map((n) => html`<li><a class="side-item" href="#${n.path}" data-nav="${n.nav}"${n.nav === currentNav ? U.raw(' aria-current="page"') : ''}>${icon(n.icon, { size: 20 })}<span class="side-label">${n.label}</span>${n.nav === 'tasks' && c.tasks ? html`<span class="side-count${c.overdue ? ' is-warn' : ''}" title="今天到期與逾期">${c.tasks}</span>` : count[n.nav] != null ? html`<span class="side-count">${count[n.nav]}</span>` : ''}</a></li>`)}</ul>

        <p class="side-heading">我的檢視</p>
        <ul class="side-nav side-nav--views">${savedViews().map((v, i) => html`<li><a class="side-item side-item--view" href="${v.href}"${v.tip ? U.raw(` data-tip="${U.esc(v.tip)}"`) : ''}><span class="side-swatch sw-${i + 1}" aria-hidden="true"></span><span class="side-label">${v.label}</span><span class="side-count${v.warn && v.n ? ' is-warn' : ''}">${v.n}</span></a></li>`)}</ul>
      </nav>
      <div class="side-foot">
        ${meterView()}
        <button type="button" class="side-user" data-user aria-haspopup="dialog" aria-label="${me.name}的選單">${ui.nameBlock(me, { size: 34, title: false })}<span class="side-user-text"><b>${me.name}</b><span>${me.title} · 山嵐感測</span></span>${icon('more', { size: 18 })}</button>
      </div>`;
  }

  function tabView() {
    return html`<ul class="tabbar-list">${NAV.map((n) => html`<li><a class="tabbar-item" href="#${n.path}" data-nav="${n.nav}"${n.nav === currentNav ? U.raw(' aria-current="page"') : ''}>${icon(n.icon, { size: 20 })}<span>${n.nav === 'activities' ? '活動' : n.label}</span></a></li>`)}</ul>`;
  }

  function bindSide() {
    sideEl.querySelector('[data-user]').addEventListener('click', (e) => userMenu(e.currentTarget));
  }
  function renderSide() {
    const scroll = sideEl.querySelector('.side-scroll');
    const top = scroll ? scroll.scrollTop : 0;
    sideEl.innerHTML = String(sideView());
    sideEl.querySelector('.side-scroll').scrollTop = top;
    bindSide();
    shown = { won: S().quarterProgress().won };
  }

  function build(appEl) {
    appEl.innerHTML = String(html`
      <div class="app">
        <aside class="side" aria-label="側欄"></aside>
        <div class="frame"><main class="sheet" id="main" tabindex="-1"></main></div>
        <nav class="tabbar" aria-label="主要導覽"></nav>
      </div>`);
    mainEl = appEl.querySelector('#main');
    sideEl = appEl.querySelector('.side');
    tabEl = appEl.querySelector('.tabbar');
    renderSide();
    tabEl.innerHTML = String(tabView());
    requestAnimationFrame(() => ui.drawMark(sideEl.querySelector('.brand-mark'), { delay: 180 }));
    CRM.events.on('route', (ctx) => {
      const page = CRM.pages[ctx.name];
      currentNav = page && page.nav;
      document.querySelectorAll('.side-item[data-nav], .tabbar-item').forEach((a) => {
        if (a.dataset.nav === currentNav) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    });
    // 資料變動時更新側欄計數（成交時量尺由 refreshMeter 負責動畫，這裡延後重繪免得打斷）
    const redraw = U.debounce(() => { if (hold === 0) renderSide(); else redraw(); }, 400);
    S().subscribe(() => redraw());
    return mainEl;
  }

  /* ── 本季進度（側欄底部；成交入帳飛進這裡） ─────── */
  let hold = 0;
  let shown = null;
  function meterView() {
    const p = S().quarterProgress();
    const pct = Math.min(1, p.pct);
    const fpct = Math.min(1, p.forecastPct);
    return html`<a class="qmeter" href="#/" aria-label="本季進度：已成交 ${U.moneyCompact(p.won)}，目標 ${U.moneyCompact(p.target)}" data-tip="加權預測再 ${U.moneyCompact(p.weighted)}，可到 ${Math.round(p.forecastPct * 100)}%">
      <span class="qmeter-top"><span class="qmeter-label">${p.quarter.label} 業績</span><span class="qmeter-pct">${Math.round(p.pct * 100)}%</span></span>
      <span class="qmeter-val"><b class="qmeter-won">${U.moneyCompact(p.won, { unit: false })}</b><span class="qmeter-of">/ ${U.moneyCompact(p.target)}</span></span>
      <span class="qmeter-track"><i class="qmeter-fore" style="width:${(fpct * 100).toFixed(2)}%"></i><i class="qmeter-fill" style="width:${(pct * 100).toFixed(2)}%"></i></span>
    </a>`;
  }
  function refreshMeter({ animate = false, flash = false } = {}) {
    if (hold > 0) return;
    const p = S().quarterProgress();
    document.querySelectorAll('.qmeter').forEach((m) => {
      const fill = m.querySelector('.qmeter-fill');
      const fore = m.querySelector('.qmeter-fore');
      const won = m.querySelector('.qmeter-won');
      const pctEl = m.querySelector('.qmeter-pct');
      const from = shown ? shown.won : p.won;
      fill.classList.toggle('is-anim', animate);
      fill.style.width = (Math.min(1, p.pct) * 100).toFixed(2) + '%';
      if (fore) fore.style.width = (Math.min(1, p.forecastPct) * 100).toFixed(2) + '%';
      if (pctEl) pctEl.textContent = Math.round(p.pct * 100) + '%';
      if (animate) ui.rollNumber(won, from, p.won, { format: (v) => U.moneyCompact(v, { unit: false }) });
      else won.textContent = U.moneyCompact(p.won, { unit: false });
      if (flash && !U.reducedMotion()) { m.classList.remove('is-flash'); void m.offsetWidth; m.classList.add('is-flash'); }
    });
    shown = { won: p.won, pct: p.pct };
  }
  function holdMeter(on) { hold = Math.max(0, hold + (on ? 1 : -1)); }
  S().subscribe((evt) => { if (evt.has('deals')) refreshMeter({ animate: true }); });

  /* ── pageHeader ───────────────────────────────── */
  /**
   * pageHeader({ title, sub, icon, count, actions, back, crumbs }) → Element
   * 內容頁最上方的一列：左邊頁名（或麵包屑），右邊該頁操作與「新增」。
   * actions：Raw 或 Node。
   */
  function pageHeader({ title = '', sub = '', icon: ic, count, actions = '', back = null, ownNew = false } = {}) {
    const me = S().me();
    const el = h(html`<header class="ph${ownNew ? ' ph--own-new' : ''}">
      <div class="ph-main">
        ${back ? html`<a class="ph-crumb" href="${back.href}">${icon('chevronLeft', { size: 16 })}<span>${back.label || '返回'}</span></a>` : ''}
        <div class="ph-titles">
          <h1 class="ph-title">${title}${count != null ? html`<span class="ph-count">${count}</span>` : ''}</h1>
          ${sub ? html`<p class="ph-sub">${sub}</p>` : ''}
        </div>
      </div>
      <div class="ph-global">
        <button type="button" class="ph-search" data-search aria-label="搜尋與指令（⌘K）">${icon('search', { size: 18 })}<span class="ph-search-text">搜尋聯絡人、公司、交易…</span>${ui.kbd('⌘K')}</button>
        <div class="ph-actions"></div>
        <button type="button" class="btn btn--primary ph-new" data-new aria-haspopup="menu" aria-label="新增">${icon('plus', { size: 18 })}<span>新增</span></button>
        <button type="button" class="ph-user" data-user aria-haspopup="dialog" aria-label="${me.name}的選單">${ui.nameBlock(me, { size: 34, title: false })}</button>
      </div>
    </header>`);
    const act = el.querySelector('.ph-actions');
    if (actions instanceof Node) act.appendChild(actions);
    else if (actions) act.innerHTML = String(actions);
    else act.remove();
    el.querySelector('[data-search]').addEventListener('click', () => CRM.palette && CRM.palette.open());
    el.querySelector('[data-new]').addEventListener('click', (e) => newMenu(e.currentTarget));
    el.querySelector('[data-user]').addEventListener('click', (e) => userMenu(e.currentTarget));
    requestAnimationFrame(() => {
      if (!el.isConnected || !('IntersectionObserver' in window)) return;
      const s = document.createElement('div');
      s.className = 'ph-sentinel';
      el.before(s);
      new IntersectionObserver(([e]) => el.classList.toggle('is-stuck', !e.isIntersecting)).observe(s);
    });
    return el;
  }

  function newMenu(anchor) {
    return ui.menu(anchor, [
      { label: '聯絡人', icon: 'contacts', onSelect: () => ui.create('contact') },
      { label: '公司', icon: 'companies', onSelect: () => ui.create('company') },
      { label: '交易', icon: 'deals', onSelect: () => ui.create('deal') },
      { label: '任務', icon: 'tasks', onSelect: () => ui.create('task') },
      { divider: true },
      { label: '記一筆活動', icon: 'activities', kbd: 'L', onSelect: () => ui.logActivity({}) },
    ], { align: 'end', label: '新增' });
  }

  function userMenu(anchor) {
    const me = S().me();
    const pref = CRM.theme.effectivePref;
    const body = h(html`<div class="usermenu">
      <div class="usermenu-who">${ui.nameBlock(me, { size: 36 })}<div><p class="usermenu-name">${me.name}</p><p class="usermenu-sub">${me.title} · 山嵐感測科技</p></div></div>
      <div class="usermenu-block"><p class="usermenu-label" id="um-theme">外觀</p>${ui.segmented({ name: 'theme', value: pref, label: '外觀', size: 'sm', options: [{ value: 'light', label: '淺色' }, { value: 'dark', label: '深色' }, { value: 'system', label: '跟隨系統' }] })}</div>
      <div class="usermenu-list">
        <button type="button" class="menu-item" data-act="shortcuts">${icon('keyboard', { size: 16, cls: 'menu-icon' })}<span class="menu-label">快捷鍵</span>${ui.kbd('?')}</button>
        <button type="button" class="menu-item" data-act="kit">${icon('grid', { size: 16, cls: 'menu-icon' })}<span class="menu-label">元件總覽</span></button>
        <button type="button" class="menu-item is-danger" data-act="reset">${icon('refresh', { size: 16, cls: 'menu-icon' })}<span class="menu-label">重設示範資料</span></button>
      </div>
      ${S().persistent ? '' : html`<p class="usermenu-note">瀏覽器不允許本機儲存，修改只保留到關閉分頁。</p>`}
    </div>`);
    const layer = ui.popover(anchor, body, { align: anchor.closest('.side') ? 'start' : 'end', cls: 'pop--user', label: '使用者選單' });
    if (!layer) return;
    body.addEventListener('seg-change', (e) => { if (e.detail.name === 'theme') CRM.theme.set(e.detail.value); });
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      layer.close();
      if (b.dataset.act === 'shortcuts') shortcutsHelp();
      if (b.dataset.act === 'kit') CRM.router.go('/kit');
      if (b.dataset.act === 'reset') {
        const ok = await ui.confirm({ title: '重設示範資料？', body: '所有新增與修改都會清除，回到今天的示範資料。', confirmLabel: '重設', danger: true });
        if (ok) { S().reset(); renderSide(); CRM.router.refresh(); ui.toast('已重設示範資料'); }
      }
    });
  }

  /* ── 快捷鍵 ───────────────────────────────────── */
  const SHORTCUTS = [
    ['⌘K', '搜尋與指令'], ['/', '搜尋'], ['C', '新增'], ['L', '記一筆活動'], ['?', '快捷鍵說明'],
    ...NAV.map((n) => [['G', n.key.toUpperCase()], '前往' + (/^[A-Za-z]/.test(n.title) ? ' ' : '') + n.title]),
    ['Esc', '關閉浮層'],
  ];
  function shortcutsHelp() {
    if (ui.layers.some((l) => l.el.classList.contains('modal--keys'))) return;
    ui.modal({
      title: '快捷鍵', size: 'sm', cls: 'modal--keys',
      body: html`<dl class="keys">${SHORTCUTS.map(([k, label]) => html`<div class="keys-row"><dt>${label}</dt><dd>${ui.kbd(k)}</dd></div>`)}</dl>`,
    });
  }
  let chord = null, chordTimer = null;
  function onKey(e) {
    if (e.defaultPrevented) return;
    const k = e.key;
    if ((e.metaKey || e.ctrlKey) && (k === 'k' || k === 'K')) {
      e.preventDefault();
      const top = ui.layers[ui.layers.length - 1];
      if (!top || top.el.classList.contains('modal--palette')) CRM.palette && CRM.palette.toggle();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || U.isTyping(e)) return;
    if (ui.layers.length) return;
    if (chord === 'g') {
      chord = null;
      clearTimeout(chordTimer);
      const n = NAV.find((x) => x.key === k.toLowerCase());
      if (n) { e.preventDefault(); CRM.router.go(n.path); }
      return;
    }
    if (k === 'g' || k === 'G') { chord = 'g'; chordTimer = setTimeout(() => (chord = null), 900); return; }
    if (k === '/') { e.preventDefault(); CRM.palette && CRM.palette.open(); return; }
    if (k === '?') { e.preventDefault(); shortcutsHelp(); return; }
    if (k === 'c' || k === 'C') {
      const b = [...document.querySelectorAll('[data-new]')].find((x) => x.offsetParent !== null);
      e.preventDefault();
      if (b) newMenu(b); else CRM.palette && CRM.palette.open('新增');
      return;
    }
    if (k === 'l' || k === 'L') { e.preventDefault(); ui.logActivity({}); }
  }
  document.addEventListener('keydown', onKey);

  ui.pageHeader = pageHeader;
  CRM.shell = { build, NAV, pageHeader, refreshMeter, holdMeter, shortcutsHelp, newMenu, renderSide, get main() { return mainEl; } };
})();
