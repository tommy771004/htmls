/* palette · ⌘K 命令面板：搜尋聯絡人、公司、交易、任務，並執行動作 */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const U = CRM.util;
  const { html, h } = U;
  const ui = CRM.ui;
  const icon = CRM.icon;

  /** 模糊比對分數：完全相同 > 開頭 > 包含 > 依序出現；-1 表示不符 */
  function score(q, text) {
    if (!text) return -1;
    const t = String(text).toLowerCase();
    if (!q) return 1;
    if (t === q) return 120;
    if (t.startsWith(q)) return 100 - Math.min(20, t.length - q.length);
    const i = t.indexOf(q);
    if (i >= 0) return 80 - Math.min(30, i);
    let j = 0, gaps = 0, last = -1;
    for (const ch of q) {
      const k = t.indexOf(ch, j);
      if (k < 0) return -1;
      if (last >= 0 && k > last + 1) gaps++;
      last = k;
      j = k + 1;
    }
    return 40 - Math.min(30, gaps * 6);
  }
  const best = (q, fields) => Math.max(...fields.map((f, i) => score(q, f) - (i ? 6 : 0)));

  function sources(q) {
    const S = CRM.store;
    const groups = [];
    const go = (p) => () => CRM.router.go(p);
    const actions = [
      { label: '新增聯絡人', icon: 'contacts', hint: '新增', run: () => ui.create('contact'), keys: ['新增聯絡人', 'new contact', 'xz'] },
      { label: '新增公司', icon: 'companies', hint: '新增', run: () => ui.create('company'), keys: ['新增公司', 'new company'] },
      { label: '新增交易', icon: 'deals', hint: '新增', run: () => ui.create('deal'), keys: ['新增交易', 'new deal'] },
      { label: '新增任務', icon: 'tasks', hint: '新增', run: () => ui.create('task'), keys: ['新增任務', 'new task'] },
      { label: '記一筆活動', icon: 'activities', hint: '新增', run: () => ui.logActivity({}), keys: ['記一筆活動', '新增活動', 'log'] },
      { label: '切換為淺色主題', icon: 'check', hint: '主題', run: () => CRM.theme.set('light'), keys: ['切換主題 淺色', 'light theme'] },
      { label: '切換為深色主題', icon: 'check', hint: '主題', run: () => CRM.theme.set('dark'), keys: ['切換主題 深色', 'dark theme'] },
      { label: '主題跟隨系統', icon: 'check', hint: '主題', run: () => CRM.theme.set('system'), keys: ['切換主題 跟隨系統', 'system theme'] },
      { label: '快捷鍵說明', icon: 'keyboard', hint: '說明', run: () => CRM.shell.shortcutsHelp(), keys: ['快捷鍵', 'shortcuts', 'help'] },
    ];
    const navs = CRM.shell.NAV.map((n) => ({ label: '前往' + (/^[A-Za-z]/.test(n.title) ? ' ' : '') + n.title, icon: n.icon, hint: '頁面', run: go(n.path), keys: ['前往' + n.title, n.title, n.label, n.nav] }));
    navs.push({ label: '前往元件總覽', icon: 'grid', hint: '頁面', run: go('/kit'), keys: ['元件總覽', 'kit'] });

    const pick = (list, fields, limit) => list.map((x) => ({ x, s: best(q, fields(x)) })).filter((r) => r.s >= 0).sort((a, b) => b.s - a.s).slice(0, limit);

    if (!q) {
      groups.push({ label: '前往', items: navs.slice(0, 6) });
      groups.push({ label: '動作', items: actions.slice(0, 5) });
      return groups;
    }
    const people = pick(S.all('contacts'), (c) => { const co = S.get('companies', c.companyId); return [c.name, co && co.name, c.title, c.email, c.mobile]; }, 6)
      .map(({ x: c, s }) => { const co = S.get('companies', c.companyId); return { s, label: c.name, sub: [c.title, co && co.name].filter(Boolean).join(' · '), lead: ui.nameBlock(c, { size: 24, title: false }), run: () => ui.openContact(c.id) }; });
    const cos = pick(S.all('companies'), (c) => [c.name, c.industry, c.city, c.domain, c.taxId], 5)
      .map(({ x: c, s }) => ({ s, label: c.name, sub: `${c.industry} · ${c.city}`, lead: ui.companyMark(c, { size: 26, title: false }), run: () => ui.openCompany(c.id) }));
    const deals = pick(S.all('deals'), (d) => { const co = S.get('companies', d.companyId); return [d.name, d.code, co && co.name]; }, 5)
      .map(({ x: d, s }) => { const co = S.get('companies', d.companyId); return { s, label: d.name, sub: html`<span class="t-mono">${d.code}</span> · ${co ? co.name : ''} · ${U.moneyCompact(d.amount)}`, icon: 'deals', trail: ui.stageTag(d.stage), run: () => ui.openDeal(d.id) }; });
    const tasks = pick(S.filter('tasks', (t) => !t.done), (t) => [t.title], 4)
      .map(({ x: t, s }) => ({ s, label: t.title, sub: html`${ui.due(t.due, t.dueTime)}`, icon: 'tasks', run: () => CRM.router.go('/tasks', { focus: t.id }) }));
    const acts = pick([...actions, ...navs], (a) => a.keys, 5).map(({ x, s }) => ({ ...x, s }));

    const all = [
      { label: '聯絡人', items: people },
      { label: '公司', items: cos },
      { label: '交易', items: deals },
      { label: '任務', items: tasks },
      { label: '動作', items: acts },
    ].filter((g) => g.items.length);
    all.sort((a, b) => Math.max(...b.items.map((i) => i.s)) - Math.max(...a.items.map((i) => i.s)));
    return all;
  }

  let layerApi = null;
  function open(initial = '') {
    if (layerApi && !layerApi.closed) { layerApi.input.focus(); return layerApi; }
    const el = h(html`<div class="palette">
      <div class="palette-bar">${icon('search', { size: 20, cls: 'palette-ic' })}<input class="palette-input" type="text" placeholder="搜尋聯絡人、公司、交易，或輸入指令" aria-label="搜尋或輸入指令" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list">${ui.kbd('Esc')}</div>
      <div class="palette-list" id="palette-list" role="listbox" aria-label="結果"></div>
      <div class="palette-foot">${ui.kbd('↑')}${ui.kbd('↓')}<span>選擇</span>${ui.kbd('Enter')}<span>開啟</span></div>
    </div>`);
    const m = ui.modal({ title: '搜尋與指令', body: el, size: 'palette', cls: 'modal--palette', onClose: () => { layerApi = null; } });
    const input = el.querySelector('.palette-input');
    const list = el.querySelector('.palette-list');
    let flat = [];
    let active = 0;
    function draw() {
      const q = input.value.trim().toLowerCase();
      const groups = sources(q);
      flat = [];
      list.innerHTML = String(groups.length
        ? html`${groups.map((g) => html`<div class="palette-group" role="group" aria-label="${g.label}"><p class="palette-group-label">${g.label}</p>${g.items.map((it) => {
            const i = flat.push(it) - 1;
            return html`<div class="palette-item" role="option" id="pi-${i}" data-i="${i}" aria-selected="false"><span class="palette-lead">${it.lead || icon(it.icon || 'arrowRight', { size: 18 })}</span><span class="palette-text"><span class="palette-label">${it.label}</span>${it.sub ? html`<span class="palette-sub">${it.sub}</span>` : ''}</span>${it.trail || (it.hint ? html`<span class="palette-hint">${it.hint}</span>` : '')}</div>`;
          })}</div>`)}`
        : html`<div class="palette-none">${ui.emptyState({ title: '找不到符合的結果', body: '試試姓名、公司、單號或「新增」', compact: true })}</div>`);
      setActive(0);
    }
    function setActive(i) {
      if (!flat.length) return;
      active = (i + flat.length) % flat.length;
      list.querySelectorAll('.palette-item').forEach((n) => n.setAttribute('aria-selected', String(+n.dataset.i === active)));
      const cur = list.querySelector(`[data-i="${active}"]`);
      if (cur) { cur.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', cur.id); }
    }
    function run(i) {
      const it = flat[i];
      if (!it) return;
      m.close({ noFocus: true });
      it.run();
    }
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    });
    list.addEventListener('pointermove', (e) => { const n = e.target.closest('.palette-item'); if (n && +n.dataset.i !== active) setActive(+n.dataset.i); });
    list.addEventListener('click', (e) => { const n = e.target.closest('.palette-item'); if (n) run(+n.dataset.i); });
    input.value = initial;
    draw();
    input.focus();
    layerApi = { input, close: m.close, get closed() { return m.closed; } };
    return layerApi;
  }
  function toggle() { if (layerApi && !layerApi.closed) layerApi.close(); else open(); }

  CRM.palette = { open, toggle, score };
})();
