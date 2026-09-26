/* pages/tasks · 任務（#/tasks?view=list|week）
   query：view=list|week  who=all|me|u2…  due=overdue|today|tomorrow|week|later|done  pri=high|normal|low
          rel=deal|contact|company|none  q=  wk=-1|1（週曆位移）  day=YYYY-MM-DD（手機週曆選的日）  focus=t012 */
(function () {
  'use strict';
  const CRM = window.CRM;
  const U = CRM.util;
  const { html, raw, h } = U;

  const S = () => CRM.store;
  const ui = () => CRM.ui;
  const todayIso = () => U.iso(U.today());

  /* ════════ 自然語言快速新增 ════════ */
  const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const NUM = '\\d{1,2}|[一二兩三四五六七八九十]{1,3}';
  function cnInt(s) {
    if (s == null) return NaN;
    if (/^\d+$/.test(s)) return +s;
    if (s === '十') return 10;
    const m = /^([一二兩三四五六七八九])?十([一二三四五六七八九])?$/.exec(s);
    if (m) return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0);
    return s.length === 1 && s in CN ? CN[s] : NaN;
  }
  const WD = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 日: 6, 天: 6 };
  const PM = new Set(['下午', '晚上', '傍晚', 'pm']);
  const AM = new Set(['上午', '早上', '凌晨', 'am']);

  /**
   * parseQuick('明天下午3點 打給陳怡君 確認報價 !')
   * → { title, due, dueTime, priority, contact, company, hasDate, marks:[{ a, b, kind }] }
   * 日期、時間、優先度會從標題移除；聯絡人姓名保留在標題裡（讀起來才通順）。
   */
  function parseQuick(text) {
    const store = S();
    const T = U.today();
    const out = { raw: text, title: '', due: U.iso(T), dueTime: null, priority: 'normal', contact: null, company: null, hasDate: false, marks: [] };
    const used = [];
    const free = (a, b) => used.every(([x, y]) => b <= x || a >= y);
    /** 找第一個（或全部）沒被佔用的符合，fn 回傳 false 表示不接受 */
    function take(src, kind, fn, all = false) {
      const re = new RegExp(src, 'g');
      let m, hit = false;
      while ((m = re.exec(text))) {
        if (!m[0]) { re.lastIndex++; continue; }
        const lead = m[0].length - m[0].replace(/^\s+/, '').length;
        const a = m.index + lead, b = m.index + m[0].length;
        if (!free(a, b)) continue;
        if (fn && fn(m) === false) continue;
        used.push([a, b]);
        out.marks.push({ a, b, kind });
        hit = true;
        if (!all) break;
      }
      return hit;
    }
    // 優先度
    take('[!！]+|(?:^|\\s)(?:急件|緊急|急|高優先)(?=\\s|$)', 'pri', () => { out.priority = 'high'; }, true);
    // 日期（依序只取第一種）
    let hint = null;
    const setDay = (d) => { out.due = U.iso(d); out.hasDate = true; };
    const datePatterns = [
      ['(今|明)(晚|早)', (m) => { setDay(U.addDays(T, m[1] === '明' ? 1 : 0)); hint = m[2] === '晚' ? 'pm' : 'am'; }],
      ['大後天|後天|明天|明日|今天|今日', (m) => { setDay(U.addDays(T, { 大後天: 3, 後天: 2, 明天: 1, 明日: 1, 今天: 0, 今日: 0 }[m[0]])); }],
      ['(下下|下)?(?:週|周|星期|禮拜)([一二三四五六日天])', (m) => {
        const mon = U.startOfWeek(T);
        let d = U.addDays(mon, (m[1] === '下下' ? 14 : m[1] ? 7 : 0) + WD[m[2]]);
        if (!m[1] && d < T) d = U.addDays(d, 7);
        setDay(d);
      }],
      ['(\\d{1,2})\\s*[/月]\\s*(\\d{1,2})\\s*[日號]?', (m) => {
        const mo = +m[1], da = +m[2];
        if (mo < 1 || mo > 12 || da < 1 || da > 31) return false;
        let d = new Date(T.getFullYear(), mo - 1, da);
        if (d.getMonth() !== mo - 1) return false;
        if (U.daysBetween(d, T) > 60) d = new Date(T.getFullYear() + 1, mo - 1, da);
        setDay(d);
      }],
      [`(${NUM})\\s*天(?:後|之後)`, (m) => { const n = cnInt(m[1]); if (!(n >= 0 && n <= 90)) return false; setDay(U.addDays(T, n)); }],
      ['下(?:週|周|星期|禮拜)(?![一二三四五六日天])', () => { setDay(U.addDays(U.startOfWeek(T), 7)); }],
    ];
    for (const [src, fn] of datePatterns) if (take(src, 'date', fn)) break;
    // 時間
    take(`(上午|早上|中午|下午|晚上|傍晚|凌晨)?\\s*(${NUM})\\s*(?:[:：]\\s*(\\d{2})|點(?:鐘)?\\s*(?:(半)|(${NUM})\\s*分)?|時)`, 'time', (m) => {
      let hh = cnInt(m[2]);
      const mm = m[3] ? +m[3] : m[4] ? 30 : m[5] ? cnInt(m[5]) : 0;
      const p = m[1] || hint;
      if (PM.has(p)) { if (hh < 12) hh += 12; }
      else if (p === '中午') { if (hh < 6) hh += 12; }
      else if (AM.has(p)) { if (hh === 12) hh = 0; }
      else if (hh >= 1 && hh <= 7) hh += 12; // 沒寫上下午：「3點」視為下午三點（上班時段）
      if (!(hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)) return false;
      out.dueTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    });
    // 標題：拿掉日期、時間、優先度
    const cut = [...used].sort((x, y) => x[0] - y[0]);
    let title = '', pos = 0;
    cut.forEach(([a, b]) => { title += text.slice(pos, a) + ' '; pos = b; });
    title += text.slice(pos);
    out.title = title.replace(/\s+/g, ' ').replace(/^[\s,，、。:：]+|[\s,，、:：]+$/g, '').trim();
    // 關聯：最長的聯絡人姓名；找不到再找公司
    let best = null;
    store.all('contacts').forEach((c) => { if (c.name && c.name.length >= 2 && out.title.includes(c.name) && (!best || c.name.length > best.name.length)) best = c; });
    const markName = (name, kind) => {
      let i = text.indexOf(name);
      while (i >= 0 && !free(i, i + name.length)) i = text.indexOf(name, i + 1);
      if (i >= 0) out.marks.push({ a: i, b: i + name.length, kind });
    };
    if (best) {
      out.contact = best;
      out.company = store.get('companies', best.companyId);
      markName(best.name, 'contact');
    } else {
      let bestCo = null, bestKey = '';
      store.all('companies').forEach((co) => {
        [co.name, co.name.replace(/(股份有限公司|有限公司)$/, ''), co.short].forEach((k) => {
          if (k && k.length >= 2 && out.title.includes(k) && k.length > bestKey.length) { bestCo = co; bestKey = k; }
        });
      });
      if (bestCo) { out.company = bestCo; markName(bestKey, 'company'); }
    }
    out.marks.sort((x, y) => x.a - y.a);
    return out;
  }

  /* ════════ 分組 ════════ */
  /** 「本週」的範圍：後天到週日；週末剩不到兩天時改成下週 */
  function weekSpan() {
    const wd = (U.today().getDay() + 6) % 7;
    const end = 6 - wd;
    return end >= 2 ? { end, label: '本週' } : { end: end + 7, label: '下週' };
  }
  function groupsDef() {
    const ws = weekSpan();
    return [
      { id: 'overdue', label: '逾期', tone: 'rose', empty: '沒有逾期的任務，進度都跟上了。' },
      { id: 'today', label: '今天', tone: 'lemon', empty: '今天沒有到期的任務。可以用上面的輸入框排一件。' },
      { id: 'tomorrow', label: '明天', tone: 'peach', empty: '明天還沒有安排。' },
      { id: 'week', label: ws.label, tone: 'sky', empty: `${ws.label}其他天沒有任務。` },
      { id: 'later', label: '之後', tone: 'lilac', empty: '更後面的日子還沒有任務。' },
      { id: 'done', label: '已完成', tone: 'mint', empty: '最近 30 天沒有完成的任務。' },
    ];
  }
  function bucketOf(t, ws = weekSpan()) {
    if (t.done) return 'done';
    const d = U.daysFromToday(t.due);
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
    if (d === 1) return 'tomorrow';
    if (d <= ws.end) return 'week';
    return 'later';
  }
  const PRI_ORDER = { high: 0, normal: 1, low: 2 };
  const byDue = (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || ((a.dueTime || '99') < (b.dueTime || '99') ? -1 : (a.dueTime || '99') > (b.dueTime || '99') ? 1 : 0) || PRI_ORDER[a.priority] - PRI_ORDER[b.priority];

  const WHO_ALL = 'all';
  const FILTERS = [
    {
      key: 'due', label: '到期', icon: 'calendar', all: '全部日期', list: true,
      options: () => groupsDef().map((g) => ({ value: g.id, label: g.label })),
      match: (t, v) => bucketOf(t) === v,
    },
    {
      key: 'pri', label: '優先度', icon: 'flag', all: '全部優先度',
      options: () => [{ value: 'high', label: '高優先' }, { value: 'normal', label: '一般' }, { value: 'low', label: '低優先' }],
      match: (t, v) => t.priority === v,
    },
    {
      key: 'rel', label: '關聯類型', icon: 'link', all: '全部關聯',
      options: () => [{ value: 'deal', label: '關聯交易' }, { value: 'contact', label: '關聯聯絡人' }, { value: 'company', label: '只關聯公司' }, { value: 'none', label: '沒有關聯' }],
      match: (t, v) => (v === 'deal' ? !!t.dealId : v === 'contact' ? !!t.contactId : v === 'company' ? !!t.companyId && !t.contactId : !t.contactId && !t.companyId && !t.dealId),
    },
  ];

  /* ════════ 頁面 ════════ */
  function mount(el, ctx) {
    const { store, router } = ctx;
    const UI = ui();
    const q0 = ctx.query;
    const reps = store.all('reps');
    const st = {
      view: q0.view === 'week' ? 'week' : 'list',
      who: q0.who === 'me' || reps.some((r) => r.id === q0.who && !r.me) ? q0.who : WHO_ALL,
      q: q0.q || '',
      wk: U.clamp(parseInt(q0.wk, 10) || 0, -52, 52),
      day: /^\d{4}-\d{2}-\d{2}$/.test(q0.day || '') ? q0.day : null,
    };
    FILTERS.forEach((f) => { st[f.key] = q0[f.key] && f.options().some((o) => o.value === q0[f.key]) ? q0[f.key] : ''; });
    let openDone = st.due === 'done';
    const settling = new Map(); // id → timer：剛完成、還停在原位的列
    const timers = new Set();
    let flashId = q0.focus || null;
    let lastWeekDone = null;
    let alive = true;

    const viewSeg = (cls) => UI.segmented({ name: 'tk-view', value: st.view, size: 'sm', label: '檢視', cls, options: [{ value: 'list', label: '清單', icon: 'list' }, { value: 'week', label: '週曆', icon: 'week' }] });
    el.appendChild(UI.pageHeader({
      title: '任務',
      sub: '今天要打給誰、下一步是什麼',
      ownNew: true,
      actions: html`${viewSeg('tk-hview')}${UI.btn({ label: '新增任務', icon: 'plus', variant: 'primary', attrs: { 'data-act': 'new' } })}`,
    }));

    const page = h(html`<div class="page pg-tasks">
      <div class="stats tk-stats"></div>
      <section class="card tk-control" aria-label="快速新增與篩選">
        <form class="tk-qa" autocomplete="off">
          <label class="tk-qa-box">
            <span class="tk-qa-plus" aria-hidden="true">${UI.icon('plus', { size: 18 })}</span>
            <span class="tk-qa-field">
              <span class="tk-qa-mirror" aria-hidden="true"></span>
              <input class="tk-qa-input" name="tk-quick" type="text" enterkeyhint="done" placeholder="輸入任務，例如：明天下午3點 打給陳怡君 確認報價" aria-label="快速新增任務" aria-describedby="tk-qa-help">
            </span>
            <button type="submit" class="btn btn--primary btn--sm tk-qa-go" disabled>${UI.icon('plus', { size: 16 })}<span>新增</span></button>
          </label>
          <div class="tk-qa-preview" id="tk-qa-help" aria-live="polite"></div>
        </form>
        <div class="toolbar tk-viewbar">
          <div class="tk-who"></div>
          <label class="tsearch tk-search">${UI.icon('search', { size: 15 })}<input class="input" type="search" name="tk-q" placeholder="搜尋任務、聯絡人或公司" autocomplete="off" aria-label="搜尋任務" value="${st.q}"></label>
        </div>
        <div class="toolbar tk-bar">
          <div class="tk-filters" role="group" aria-label="篩選"></div>
          <p class="tk-count" aria-live="polite"></p>
          ${viewSeg('tk-mview')}
        </div>
      </section>
      <div class="tk-body"></div>
    </div>`);
    el.appendChild(page);
    const $ = (s) => page.querySelector(s);
    const statsEl = $('.tk-stats'), whoEl = $('.tk-who'), filtersEl = $('.tk-filters'), countEl = $('.tk-count'), bodyEl = $('.tk-body');
    const searchEl = $('input[name="tk-q"]');
    const qaForm = $('.tk-qa'), qaInput = $('.tk-qa-input'), qaMirror = $('.tk-qa-mirror'), qaPrev = $('.tk-qa-preview'), qaGo = $('.tk-qa-go');

    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
    const meId = store.me().id;
    const whoId = () => (st.who === 'me' ? meId : st.who === WHO_ALL ? null : st.who);

    function syncUrl() {
      if (!alive) return;
      const patch = { view: st.view, who: st.who === WHO_ALL ? null : st.who, q: st.q || null, wk: st.view === 'week' && st.wk ? String(st.wk) : null, day: st.view === 'week' ? st.day : null, focus: null };
      FILTERS.forEach((f) => { patch[f.key] = st[f.key] || null; });
      if (st.view === 'week') patch.due = null;
      router.setQuery(patch, { silent: true });
    }

    /* ── 篩選 ── */
    function textOf(t) {
      const c = t.contactId && store.get('contacts', t.contactId);
      const co = t.companyId && store.get('companies', t.companyId);
      return [t.title, c && c.name, co && co.name].filter(Boolean).join(' ').toLowerCase();
    }
    /** skip：'who' | 篩選 key，用來算分面計數 */
    function applyFilters(list, { skip = null } = {}) {
      const w = whoId();
      const qq = st.q.trim().toLowerCase();
      return list.filter((t) => {
        if (skip !== 'who' && w && t.owner !== w) return false;
        if (qq && !textOf(t).includes(qq)) return false;
        for (const f of FILTERS) {
          if (f.key === skip || !st[f.key]) continue;
          if (f.key === 'due' && st.view === 'week') continue;
          if (!f.match(t, st[f.key])) return false;
        }
        return true;
      });
    }
    const anyFilter = () => !!(st.q.trim() || FILTERS.some((f) => st[f.key] && !(f.key === 'due' && st.view === 'week')) || st.who !== WHO_ALL);
    function clearAll() {
      st.q = ''; searchEl.value = '';
      FILTERS.forEach((f) => { st[f.key] = ''; });
      st.who = WHO_ALL;
      syncUrl();
      draw();
    }
    const recentDone = (t) => t.done && t.doneAt && U.daysFromToday(t.doneAt) >= -30;
    const inScope = (t) => !t.done || recentDone(t) || settling.has(t.id);

    /* ── 統計 ── */
    function drawStats() {
      const all = store.all('tasks');
      const T = U.today(), tIso = U.iso(T);
      const mon = U.startOfWeek(T), sun = U.addDays(mon, 6);
      const monIso = U.iso(mon), sunIso = U.iso(sun);
      const lmonIso = U.iso(U.addDays(mon, -7)), lsunIso = U.iso(U.addDays(mon, -1));
      const open = all.filter((t) => !t.done);
      const dueToday = open.filter((t) => t.due === tIso);
      const highToday = dueToday.filter((t) => t.priority === 'high').length;
      const overdue = open.filter((t) => t.due < tIso);
      const oldest = overdue.length ? -Math.min(...overdue.map((t) => U.daysFromToday(t.due))) : 0;
      const doneIn = (a, b) => all.filter((t) => t.done && t.doneAt && t.doneAt.slice(0, 10) >= a && t.doneAt.slice(0, 10) <= b).length;
      const weekDone = doneIn(monIso, tIso);
      const lastSame = doneIn(lmonIso, U.iso(U.addDays(T, -7)));
      const rateOf = (a, b) => {
        const due = all.filter((t) => t.due >= a && t.due <= b);
        return due.length ? due.filter((t) => t.done).length / due.length : 0;
      };
      // 本週到今天為止到期的任務 vs 上週同期
      const rate = rateOf(monIso, tIso), lrate = rateOf(lmonIso, U.iso(U.addDays(T, -7)));
      const rdiff = Math.round((rate - lrate) * 100);
      const rates = [5, 4, 3, 2, 1, 0].map((k) => Math.round((k ? rateOf(U.iso(U.addDays(mon, -7 * k)), U.iso(U.addDays(sun, -7 * k))) : rate) * 100));
      const wdiff = weekDone - lastSame;
      statsEl.innerHTML = String(html`
        ${UI.statCard({ label: '今天到期', value: U.num(dueToday.length), unit: '件', icon: 'calendar', tone: 5, delta: highToday ? { text: `${highToday} 件高優先`, dir: 'flat' } : null, foot: highToday ? '' : '沒有高優先', href: router.href('/tasks', { view: 'list', due: 'today' }) })}
        ${UI.statCard({ label: '逾期', value: U.num(overdue.length), unit: '件', icon: 'clock', tone: 4, foot: overdue.length ? `最久的已經拖了 ${oldest} 天` : '全部跟上了', href: router.href('/tasks', { view: 'list', due: 'overdue' }), attrs: { 'data-stat': 'overdue' } })}
        ${UI.statCard({ label: '本週完成', value: U.num(weekDone), unit: '件', icon: 'check', tone: 2, delta: { text: wdiff === 0 ? '持平' : `${Math.abs(wdiff)} 件`, dir: wdiff > 0 ? 'up' : wdiff < 0 ? 'down' : 'flat' }, foot: html`<span class="tk-stat-tally">${UI.tally(weekDone, { size: 20, label: `本週完成 ${weekDone} 件` })}</span>`, attrs: { 'data-stat': 'done' } })}
        ${UI.statCard({ label: '完成率', value: Math.round(rate * 100), unit: '%', icon: 'target', tone: 3, delta: { text: `${Math.abs(rdiff)}%`, dir: rdiff > 0 ? 'up' : rdiff < 0 ? 'down' : 'flat' }, foot: '比上週同期', spark: rates })}`);
      // 本週完成數增加時，劃記最後一筆描出來
      if (lastWeekDone != null && weekDone > lastWeekDone) {
        const tl = statsEl.querySelector('.tk-stat-tally .tally');
        if (tl && weekDone <= 25) UI.animateTallyStroke(tl);
      }
      lastWeekDone = weekDone;
    }

    /* ── 工具列 ── */
    function drawWho() {
      const base = applyFilters(store.all('tasks').filter((t) => !t.done), { skip: 'who' });
      const items = [
        { value: 'me', label: '我的', count: base.filter((t) => t.owner === meId).length },
        { value: WHO_ALL, label: '全部', count: base.length },
        ...reps.filter((r) => !r.me).map((r) => ({ value: r.id, label: r.name, count: base.filter((t) => t.owner === r.id).length })),
      ];
      whoEl.innerHTML = String(UI.tabs({ name: 'tk-who', value: st.who, cls: 'tk-tabs', items }));
    }
    function drawFilters() {
      filtersEl.innerHTML = String(html`${FILTERS.filter((f) => !(f.list && st.view === 'week')).map((f) => {
        const on = st[f.key];
        const opt = on ? f.options().find((o) => o.value === on) : null;
        return html`<button type="button" class="tbtn tk-fbtn${on ? ' is-on' : ''}" data-filter="${f.key}" aria-haspopup="menu" aria-expanded="false">${UI.icon(f.icon, { size: 14 })}<span>${f.label}${opt ? html`<b>：${opt.label}</b>` : ''}</span>${UI.icon('chevronDown', { size: 14 })}</button>`;
      })}${anyFilter() ? UI.btn({ label: '清除篩選', size: 'sm', variant: 'quiet', cls: 'tk-clear', attrs: { 'data-act': 'clear' } }) : ''}`);
    }

    /* ── 共用片段 ── */
    function recChip(t, { size = 26, tallyOn = false } = {}) {
      const c = t.contactId && store.get('contacts', t.contactId);
      const co = t.companyId && store.get('companies', t.companyId);
      const d = t.dealId && store.get('deals', t.dealId);
      if (!c && !co) return html`<span class="tk-rec-none">沒有關聯</span>`;
      const key = [c && 'contact:' + c.id, co && 'company:' + co.id, d && 'deal:' + d.id].filter(Boolean).join(' ');
      const ref = c ? { contactId: c.id } : { companyId: co.id };
      const sub = c ? [co && (co.short ? co.name.replace(/(股份有限公司|有限公司)$/, '') : co.name), d && d.name].filter(Boolean).join(' · ') : d ? d.name : co.industry;
      const tallyEl = tallyOn ? html`<span class="tk-rec-tally">${UI.tally(store.touches(ref, 30), { key, size: 20, accent: 1, label: `近 30 天往來 ${store.touches(ref, 30)} 次` })}</span>` : '';
      return html`<a class="tk-rec" href="${router.href(c ? '/contacts/' + c.id : '/companies/' + co.id)}" data-rec="${c ? 'c:' + c.id : 'o:' + co.id}">${c ? UI.nameBlock(c, { size, title: false }) : UI.companyMark(co, { size, title: false })}<span class="tk-rec-text"><span class="tk-rec-name">${c ? c.name : co.name}</span>${sub ? html`<span class="tk-rec-sub">${sub}</span>` : ''}</span>${tallyEl}</a>`;
    }
    function priMark(t) {
      if (t.priority === 'high') return html`<span class="tk-flag is-high" data-tip="高優先" role="img" aria-label="高優先">${UI.icon('flag', { size: 16 })}</span>`;
      if (t.priority === 'low') return html`<span class="tk-flag is-low" data-tip="低優先" role="img" aria-label="低優先">${UI.icon('flag', { size: 16 })}</span>`;
      return html`<span class="tk-flag" aria-hidden="true"></span>`;
    }
    const checkSvg = raw('<svg class="tk-check-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle class="tk-check-ring" cx="12" cy="12" r="10"/><path class="tk-check-mark" d="M7.4 12.4l3.1 3.1 6.1-6.3"/></svg>');
    const checkBtn = (t) => html`<button type="button" class="tk-check" role="checkbox" aria-checked="${String(!!t.done)}" data-check="${t.id}" aria-label="${t.done ? '標為未完成' : '完成'}：${t.title}">${checkSvg}</button>`;

    function row(t) {
      const rep = store.rep(t.owner);
      const set = settling.has(t.id);
      const dueTxt = t.done && !set
        ? html`<span class="tk-done-at">${U.relTime(t.doneAt)}完成</span>`
        : UI.due(t.due, t.dueTime, { done: t.done });
      return html`<li class="tk-row${t.done ? ' is-done' : ''}${set ? ' is-settling' : ''}" data-id="${t.id}" data-pri="${t.priority}">
        ${checkBtn(t)}
        <div class="tk-main">
          <button type="button" class="tk-title" data-act="edit" data-id="${t.id}"><span class="tk-title-t">${t.title}</span></button>
          <div class="tk-mmeta">${dueTxt}${t.contactId || t.companyId ? html`<span class="tk-mrec">${(store.get('contacts', t.contactId) || store.get('companies', t.companyId) || {}).name || ''}</span>` : ''}</div>
        </div>
        <div class="tk-link">${recChip(t, { tallyOn: set })}</div>
        <div class="tk-due">${dueTxt}</div>
        <div class="tk-pri">${priMark(t)}</div>
        <div class="tk-owner">${rep ? html`<span data-tip="負責：${rep.name}">${UI.nameBlock(rep, { size: 26, title: false })}</span>` : ''}</div>
        <div class="tk-acts">
          ${UI.iconBtn('edit', { label: '編輯', size: 'sm', attrs: { 'data-act': 'edit', 'data-id': t.id } })}
          ${t.done ? '' : UI.iconBtn('calendar', { label: '改期', size: 'sm', attrs: { 'data-act': 'resched', 'data-id': t.id, 'aria-haspopup': 'menu' } })}
          ${UI.iconBtn('trash', { label: '刪除', size: 'sm', attrs: { 'data-act': 'del', 'data-id': t.id } })}
        </div>
        ${UI.iconBtn('more', { label: '更多動作', size: 'sm', cls: 'tk-more', attrs: { 'data-act': 'more', 'data-id': t.id, 'aria-haspopup': 'menu' } })}
      </li>`;
    }

    /* ── 清單檢視 ── */
    function drawList(tasks) {
      const ws = weekSpan();
      const defs = groupsDef();
      const groups = Object.fromEntries(defs.map((g) => [g.id, []]));
      tasks.forEach((t) => {
        // 剛勾完的列先留在原本的組
        const b = settling.has(t.id) ? settling.get(t.id).from : bucketOf(t, ws);
        groups[b].push(t);
      });
      Object.keys(groups).forEach((k) => groups[k].sort(k === 'done' ? (a, b) => ((a.doneAt || '') < (b.doneAt || '') ? 1 : -1) : byDue));
      const narrowed = !!(st.q.trim() || st.pri || st.rel);
      let shown = defs.filter((g) => (st.due ? g.id === st.due : !narrowed || groups[g.id].length));
      if (!shown.length || (narrowed && !st.due && shown.every((g) => !groups[g.id].length))) {
        bodyEl.innerHTML = String(html`<section class="card tk-empty-all">${UI.emptyState({ title: '沒有符合條件的任務', body: '換個關鍵字，或放寬負責人、優先度與關聯類型。', action: UI.btn({ label: '清除篩選', icon: 'close', size: 'sm', attrs: { 'data-act': 'clear' } }) })}</section>`);
        return;
      }
      const T = U.today();
      const subOf = (g) => {
        if (g.id === 'today') return U.fmtDate(T) + ' ' + U.weekday(T);
        if (g.id === 'tomorrow') return U.fmtDate(U.addDays(T, 1)) + ' ' + U.weekday(U.addDays(T, 1));
        if (g.id === 'week') return `${U.fmtDate(U.addDays(T, 2))} 到 ${U.fmtDate(U.addDays(T, ws.end))}`;
        if (g.id === 'done') return '近 30 天';
        if (g.id === 'overdue' && groups.overdue.length) return '越早到期排越前面';
        return '';
      };
      const head = (g, n) => html`<span class="tk-gname">${g.label}</span><span class="tk-gcount">${n}</span><span class="tk-gsub">${subOf(g)}</span>`;
      const list = (g) => (groups[g.id].length
        ? html`<ul class="tk-rows" role="list">${groups[g.id].map(row)}</ul>`
        : html`<p class="tk-gempty">${g.empty}</p>`);
      bodyEl.innerHTML = String(html`<div class="tk-groups">${shown.map((g) => {
        const n = groups[g.id].length;
        if (g.id === 'done') {
          return html`<details class="card tk-group" data-group="done" data-tone="${g.tone}"${openDone ? raw(' open') : ''}><summary class="tk-ghead">${head(g, n)}<span class="tk-gtoggle">${UI.icon('chevronDown', { size: 16 })}<span class="tk-gtoggle-l">${openDone ? '收合' : '展開'}</span></span></summary>${list(g)}</details>`;
        }
        return html`<section class="card tk-group" data-group="${g.id}" data-tone="${g.tone}" aria-label="${g.label}"><header class="tk-ghead">${head(g, n)}</header>${list(g)}</section>`;
      })}</div>`);
    }

    /* ── 週曆檢視 ── */
    function weekDays() {
      const mon = U.addDays(U.startOfWeek(U.today()), st.wk * 7);
      return Array.from({ length: 7 }, (_, i) => U.addDays(mon, i));
    }
    function wcard(t) {
      const c = t.contactId && store.get('contacts', t.contactId);
      const co = t.companyId && store.get('companies', t.companyId);
      const overdue = !t.done && t.due < todayIso();
      return html`<div class="tk-wcard${t.done ? ' is-done' : ''}${overdue ? ' is-overdue' : ''}${settling.has(t.id) ? ' is-settling' : ''}" data-id="${t.id}" data-pri="${t.priority}" tabindex="0" role="button" aria-roledescription="可拖曳的任務" aria-label="${t.title}，${U.fmtDate(t.due)}${t.dueTime ? ' ' + t.dueTime : ''}。按 Enter 編輯，[ 與 ] 前後移一天">
        <div class="tk-wtop">${checkBtn(t)}<span class="tk-wtime">${t.dueTime || '不限時間'}</span>${t.priority !== 'normal' ? priMark(t) : ''}</div>
        <p class="tk-wtitle">${t.title}</p>
        ${c || co ? html`<div class="tk-wrec">${c ? UI.nameBlock(c, { size: 20, title: false }) : UI.companyMark(co, { size: 20, title: false })}<span>${c ? c.name : co.short || co.name}</span></div>` : ''}
      </div>`;
    }
    function drawWeek(tasks) {
      const days = weekDays();
      const tIso = todayIso();
      const isos = days.map(U.iso);
      if (!st.day || !isos.includes(st.day)) st.day = isos.includes(tIso) ? tIso : isos[0];
      const byDay = Object.fromEntries(isos.map((d) => [d, []]));
      tasks.forEach((t) => { if (byDay[t.due]) byDay[t.due].push(t); });
      const order = (a, b) => (a.done - b.done) || byDue(a, b);
      Object.values(byDay).forEach((l) => l.sort(order));
      const total = Object.values(byDay).reduce((s, l) => s + l.length, 0);
      const doneN = Object.values(byDay).reduce((s, l) => s + l.filter((t) => t.done).length, 0);
      const before = st.wk === 0 ? tasks.filter((t) => !t.done && t.due < isos[0]) : [];
      const label = st.wk === 0 ? '本週' : st.wk === 1 ? '下週' : st.wk === -1 ? '上週' : st.wk > 0 ? `${st.wk} 週後` : `${-st.wk} 週前`;
      bodyEl.innerHTML = String(html`<section class="card tk-week" aria-label="週曆">
        <header class="tk-whead">
          <div class="tk-wnav">
            ${UI.iconBtn('chevronLeft', { label: '上一週', size: 'sm', attrs: { 'data-wk': '-1' } })}
            ${UI.iconBtn('chevronRight', { label: '下一週', size: 'sm', attrs: { 'data-wk': '1' } })}
          </div>
          <h2 class="tk-wlabel"><span>${U.fmtDate(days[0])} 到 ${U.fmtDate(days[6])}</span><span class="tk-wrel">${label}</span></h2>
          ${st.wk !== 0 ? UI.btn({ label: '回到本週', size: 'sm', attrs: { 'data-wk': '0' } }) : ''}
          <p class="tk-wsum">${total} 件，已完成 ${doneN}</p>
        </header>
        ${before.length ? html`<div class="tk-wover">${UI.icon('clock', { size: 16 })}<span>本週以前還有 <b>${before.length}</b> 件逾期沒完成</span><a class="btn btn--quiet btn--sm" href="${router.href('/tasks', { view: 'list', due: 'overdue', who: st.who === WHO_ALL ? null : st.who })}">到清單處理</a></div>` : ''}
        <div class="tk-grid" role="list">${days.map((d, i) => {
          const iso = isos[i];
          const list = byDay[iso];
          return html`<div class="tk-col${iso === tIso ? ' is-today' : ''}${iso < tIso ? ' is-past' : ''}" data-day="${iso}" role="listitem" aria-label="${U.weekday(d)} ${U.fmtDate(d)}，${list.length} 件">
            <div class="tk-colhead"><span class="tk-colwd">${U.weekday(d)}</span><span class="tk-colnum">${d.getDate()}</span>${iso === tIso ? html`<span class="tk-coltoday">今天</span>` : ''}<span class="tk-coln">${list.length || ''}</span></div>
            <div class="tk-colbody">${list.length ? list.map(wcard) : html`<p class="tk-colempty">沒有任務</p>`}</div>
          </div>`;
        })}</div>
        <div class="tk-mweek">
          <div class="tk-strip" role="tablist" aria-label="選擇日期">${days.map((d, i) => {
            const iso = isos[i];
            const n = byDay[iso].filter((t) => !t.done).length;
            return html`<button type="button" class="tk-sday${iso === tIso ? ' is-today' : ''}" role="tab" aria-selected="${String(iso === st.day)}" data-pick="${iso}" data-day="${iso}"><span class="tk-sday-wd">${U.weekday(d).slice(1)}</span><span class="tk-sday-n">${d.getDate()}</span><span class="tk-sday-dots" aria-label="${n} 件未完成">${Array.from({ length: Math.min(3, n) }, () => html`<i></i>`)}</span></button>`;
          })}</div>
          <div class="tk-mday">
            <p class="tk-mday-h">${U.fmtDateLong(st.day).replace(/^\d+ 年 /, '')}<span>${byDay[st.day].length} 件</span></p>
            ${byDay[st.day].length ? html`<div class="tk-mlist">${byDay[st.day].map(wcard)}</div>` : html`<p class="tk-colempty tk-mempty">這天沒有任務。長按其他天的任務可以拖到這裡。</p>`}
          </div>
        </div>
      </section>`);
    }

    /* ── 全部重繪 ── */
    function draw() {
      const all = store.all('tasks').filter(inScope);
      const rows = applyFilters(all);
      drawStats();
      drawWho();
      drawFilters();
      const openN = rows.filter((t) => !t.done).length;
      countEl.textContent = `${openN} 件未完成`;
      if (st.view === 'week') drawWeek(applyFilters(store.all('tasks'))); else drawList(rows);
      if (flashId) {
        const id = flashId;
        flashId = null;
        const r = bodyEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (r) {
          r.classList.add('is-flash');
          later(() => r.classList.remove('is-flash'), 1800);
          requestAnimationFrame(() => { const rc = r.getBoundingClientRect(); if (rc.top < 80 || rc.bottom > window.innerHeight - 80) r.scrollIntoView({ block: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' }); });
        }
      }
    }
    if (flashId) { const ft = store.get('tasks', flashId); if (ft && ft.done) openDone = true; }
    draw();

    /* ── 完成／重新開啟 ── */
    function toggleDone(id) {
      const t = store.get('tasks', id);
      if (!t) return;
      if (t.done) {
        if (settling.has(id)) { clearTimeout(settling.get(id).timer); settling.delete(id); }
        CRM.actions.reopenTask(id);
        return;
      }
      const from = bucketOf(t);
      const hold = U.reducedMotion() ? 0 : 1500;
      if (hold) {
        const timer = later(() => { settling.delete(id); draw(); }, hold);
        settling.set(id, { from, timer });
      }
      CRM.actions.completeTask(id);
    }

    /* ── 改期 ── */
    function reschedule(id, due, dueTime) {
      const t = store.get('tasks', id);
      if (!t) return;
      const patch = { due };
      if (dueTime !== undefined) patch.dueTime = dueTime || null;
      if (t.due === due && (dueTime === undefined || (t.dueTime || '') === (dueTime || ''))) return;
      const { undo } = store.batch(() => store.update('tasks', id, patch));
      flashId = id;
      draw();
      UI.toast(`「${t.title}」改到${U.relTime(due)}（${U.fmtDate(due)} ${U.weekday(due)}${patch.dueTime ? ' ' + patch.dueTime : ''}）`, { undo });
    }
    function resDates() {
      const T = U.today();
      const nextMon = U.addDays(U.startOfWeek(T), 7);
      const d = (x) => `${U.weekday(x)} ${U.fmtDate(x)}`;
      return [
        { label: '今天', value: U.iso(T), hint: d(T) },
        { label: '明天', value: U.iso(U.addDays(T, 1)), hint: d(U.addDays(T, 1)) },
        { label: '下週一', value: U.iso(nextMon), hint: d(nextMon) },
      ];
    }
    function customDate(anchor, id) {
      const t = store.get('tasks', id);
      if (!t) return;
      const body = html`<form class="tk-pick" autocomplete="off">
        <p class="tk-pick-h">改到哪一天</p>
        <div class="tk-pick-row">${UI.field({ label: '日期', name: 'due', type: 'date', value: t.due })}${UI.field({ label: '時間', name: 'dueTime', type: 'time', value: t.dueTime || '' })}</div>
        <div class="tk-pick-foot">${UI.btn({ label: '取消', size: 'sm', variant: 'quiet', attrs: { 'data-x': '' } })}${UI.btn({ label: '改期', size: 'sm', variant: 'primary', type: 'submit' })}</div>
      </form>`;
      const pop = UI.popover(anchor, body, { align: 'end', label: '自訂日期', cls: 'tk-pickpop' });
      if (!pop) return;
      const f = pop.el.querySelector('form');
      f.querySelector('[name="due"]').focus();
      f.querySelector('[data-x]').addEventListener('click', () => pop.close());
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const due = f.due.value;
        if (!due) { f.due.focus(); return; }
        pop.close();
        reschedule(id, due, f.dueTime.value);
      });
    }
    function reschedMenu(anchor, id) {
      const t = store.get('tasks', id);
      if (!t) return;
      UI.menu(anchor, [
        { heading: '改到' },
        ...resDates().filter((o) => o.value !== t.due).map((o) => ({ label: o.label, hint: o.hint, icon: 'calendar', onSelect: () => reschedule(id, o.value) })),
        { divider: true },
        { label: '自訂日期…', icon: 'edit', onSelect: () => customDate(anchor, id) },
      ], { align: 'end', label: '改期', cls: 'tk-resmenu' });
    }
    function moreMenu(anchor, id) {
      const t = store.get('tasks', id);
      if (!t) return;
      UI.menu(anchor, [
        { label: '編輯', icon: 'edit', onSelect: () => UI.edit('task', id) },
        ...(t.done ? [] : [{ divider: true }, ...resDates().filter((o) => o.value !== t.due).map((o) => ({ label: `改到${o.label}`, hint: o.hint, icon: 'calendar', onSelect: () => reschedule(id, o.value) })), { label: '自訂日期…', icon: 'calendar', onSelect: () => customDate(anchor, id) }]),
        { divider: true },
        { label: '刪除', icon: 'trash', danger: true, onSelect: () => CRM.actions.deleteRecord('tasks', id) },
      ], { align: 'end', label: '任務動作' });
    }

    /* ── 快速新增 ── */
    let parsed = null;
    function drawQuick() {
      const text = qaInput.value;
      parsed = text.trim() ? parseQuick(text) : null;
      // 輸入框後面的鏡像：辨識到的片段加底色
      let m = '', pos = 0;
      (parsed ? parsed.marks : []).forEach((k) => {
        if (k.a < pos) return;
        m += U.esc(text.slice(pos, k.a)) + `<mark class="tk-mk tk-mk--${k.kind}">${U.esc(text.slice(k.a, k.b))}</mark>`;
        pos = k.b;
      });
      m += U.esc(text.slice(pos));
      qaMirror.innerHTML = m;
      qaMirror.style.transform = `translateX(${-qaInput.scrollLeft}px)`;
      qaGo.disabled = !(parsed && parsed.title);
      if (!parsed) {
        qaPrev.innerHTML = String(html`<p class="tk-qa-hint"><span class="tk-qa-hint-s">可寫日期、時間與聯絡人姓名，加 <b>!</b> 代表高優先</span><span class="tk-qa-hint-l">可以直接寫日期（明天、週五、10/3）、時間（下午3點）、聯絡人姓名，加上 <b>!</b> 或「急」代表高優先。按 ${UI.kbd('Enter')} 新增。</span></p>`);
        return;
      }
      const p = parsed;
      const dateL = `${U.relTime(p.due)} · ${U.fmtDate(p.due)} ${U.weekday(p.due)}`;
      const owner = store.rep(whoId() || meId);
      qaPrev.innerHTML = String(html`<ul class="tk-pills" aria-label="解析結果">
        <li class="tk-pill${p.hasDate ? ' is-hit' : ''}" data-pill="date">${UI.icon('calendar', { size: 14 })}<span>${p.hasDate ? dateL : '沒寫日期，預設今天'}</span></li>
        ${p.dueTime ? html`<li class="tk-pill is-hit" data-pill="time">${UI.icon('clock', { size: 14 })}<span>${p.dueTime}</span></li>` : ''}
        ${p.contact ? html`<li class="tk-pill is-rec" data-pill="contact">${UI.nameBlock(p.contact, { size: 20, title: false })}<span>${p.contact.name}${p.company ? html`<em>${p.company.short ? p.company.name.replace(/(股份有限公司|有限公司)$/, '') : p.company.name}</em>` : ''}</span></li>`
          : p.company ? html`<li class="tk-pill is-rec" data-pill="company">${UI.companyMark(p.company, { size: 20, title: false })}<span>${p.company.name}</span></li>` : ''}
        ${p.priority === 'high' ? html`<li class="tk-pill is-pri" data-pill="pri">${UI.icon('flag', { size: 14 })}<span>高優先</span></li>` : ''}
        ${owner && owner.id !== meId ? html`<li class="tk-pill" data-pill="owner">${UI.nameBlock(owner, { size: 20, title: false })}<span>指派給${owner.name}</span></li>` : ''}
        <li class="tk-pill-title">${p.title ? html`任務名稱：<b>${p.title}</b>` : html`<span class="t-accent">還缺任務內容</span>`}</li>
      </ul>`);
    }
    function submitQuick() {
      drawQuick();
      const p = parsed;
      if (!p || !p.title) { qaInput.focus(); return; }
      let created;
      const { undo } = store.batch(() => {
        created = store.create('tasks', {
          title: p.title, due: p.due, dueTime: p.dueTime, priority: p.priority, owner: whoId() || meId,
          contactId: p.contact ? p.contact.id : null, companyId: p.company ? p.company.id : null, dealId: null,
          done: false, doneAt: null, createdAt: todayIso(),
        });
      });
      qaInput.value = '';
      drawQuick();
      flashId = created.id;
      draw();
      const visible = !!bodyEl.querySelector(`[data-id="${CSS.escape(created.id)}"]`);
      UI.toast(`已新增：${created.title}（${U.relTime(created.due)}${created.dueTime ? ' ' + created.dueTime : ''}）`, visible ? { undo } : { undo, action: { label: '清除篩選', fn: () => { flashId = created.id; clearAll(); } } });
    }
    qaInput.addEventListener('input', drawQuick);
    qaInput.addEventListener('scroll', () => { qaMirror.style.transform = `translateX(${-qaInput.scrollLeft}px)`; });
    qaInput.addEventListener('keyup', () => { qaMirror.style.transform = `translateX(${-qaInput.scrollLeft}px)`; });
    qaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.isComposing || e.keyCode === 229)) { e.preventDefault(); return; } // 選字中的 Enter 不送出
      if (e.key === 'Escape' && qaInput.value) { e.stopPropagation(); qaInput.value = ''; drawQuick(); }
    });
    qaForm.addEventListener('submit', (e) => { e.preventDefault(); submitQuick(); });
    drawQuick();

    /* ── 事件 ── */
    const pushQ = U.debounce(() => syncUrl(), 300);
    searchEl.addEventListener('input', () => { st.q = searchEl.value; draw(); pushQ(); });
    searchEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && searchEl.value) { e.stopPropagation(); searchEl.value = ''; st.q = ''; draw(); syncUrl(); } });

    page.addEventListener('tab-change', (e) => {
      if (e.detail.name !== 'tk-who') return;
      st.who = e.detail.value;
      syncUrl();
      draw();
      drawQuick();
      const b = whoEl.querySelector(`[data-value="${st.who}"]`);
      b && b.focus({ preventScroll: true });
    });
    const onSeg = (e) => {
      if (e.detail.name !== 'tk-view') return;
      st.view = e.detail.value === 'week' ? 'week' : 'list';
      el.querySelectorAll('[data-seg="tk-view"] > button').forEach((b) => {
        const on = b.dataset.value === st.view;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      syncUrl();
      draw();
    };
    el.addEventListener('seg-change', onSeg);
    el.querySelector('.ph [data-act="new"]').addEventListener('click', () => UI.create('task', { owner: whoId() || meId }));

    page.addEventListener('toggle', (e) => {
      const d = e.target;
      if (!(d instanceof HTMLDetailsElement) || d.dataset.group !== 'done') return;
      openDone = d.open;
      const l = d.querySelector('.tk-gtoggle-l');
      if (l) l.textContent = openDone ? '收合' : '展開';
    }, true);

    let suppressClick = false;
    page.addEventListener('click', (e) => {
      if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
      const ck = e.target.closest('[data-check]');
      if (ck) { e.preventDefault(); toggleDone(ck.dataset.check); return; }
      const fb = e.target.closest('[data-filter]');
      if (fb) {
        const f = FILTERS.find((x) => x.key === fb.dataset.filter);
        const base = applyFilters(store.all('tasks').filter(inScope), { skip: f.key });
        const cnt = (v) => base.filter((t) => f.match(t, v) && (f.key === 'due' || !t.done)).length;
        UI.menu(fb, [
          { label: f.all, checked: !st[f.key], value: '' },
          { divider: true },
          ...f.options().map((o) => ({ label: o.label, value: o.value, checked: st[f.key] === o.value, hint: String(cnt(o.value)) })),
        ], {
          label: f.label,
          onSelect: (it) => {
            st[f.key] = it.value;
            if (f.key === 'due' && it.value === 'done') openDone = true;
            syncUrl();
            draw();
            const again = filtersEl.querySelector(`[data-filter="${f.key}"]`);
            again && again.focus({ preventScroll: true });
          },
        });
        return;
      }
      const wk = e.target.closest('[data-wk]');
      if (wk) {
        st.wk = wk.dataset.wk === '0' ? 0 : st.wk + +wk.dataset.wk;
        st.day = null;
        syncUrl();
        draw();
        const again = bodyEl.querySelector(`[data-wk="${wk.dataset.wk}"]`);
        again && again.focus({ preventScroll: true });
        return;
      }
      const pick = e.target.closest('[data-pick]');
      if (pick) {
        st.day = pick.dataset.pick;
        syncUrl();
        draw();
        const again = bodyEl.querySelector(`[data-pick="${st.day}"]`);
        again && again.focus({ preventScroll: true });
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act) {
        const id = act.dataset.id;
        const k = act.dataset.act;
        if (k === 'clear') { clearAll(); return; }
        if (k === 'edit') { UI.edit('task', id); return; }
        if (k === 'del') { CRM.actions.deleteRecord('tasks', id); return; }
        if (k === 'resched') { reschedMenu(act, id); return; }
        if (k === 'more') { moreMenu(act, id); return; }
      }
      const rec = e.target.closest('[data-rec]');
      if (rec && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const [kind, rid] = rec.dataset.rec.split(':');
        kind === 'c' ? UI.openContact(rid) : UI.openCompany(rid);
        return;
      }
      const card = e.target.closest('.tk-wcard');
      if (card && !e.target.closest('a,button')) UI.edit('task', card.dataset.id);
    });

    /* 週曆鍵盤：Enter 編輯，[ ] 前後移一天 */
    page.addEventListener('keydown', (e) => {
      const card = e.target.closest && e.target.closest('.tk-wcard');
      if (!card || e.target !== card) return;
      const t = store.get('tasks', card.dataset.id);
      if (!t) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); UI.edit('task', t.id); }
      else if ((e.key === '[' || e.key === ']') && !t.done) {
        e.preventDefault();
        reschedule(t.id, U.iso(U.addDays(t.due, e.key === ']' ? 1 : -1)));
        const again = bodyEl.querySelector(`.tk-wcard[data-id="${CSS.escape(t.id)}"]`);
        again && again.focus({ preventScroll: true });
      }
    });

    /* 週曆拖曳（pointer events；觸控長按 250ms 後才開始拖，平常可以捲動） */
    let drag = null;
    const onTouchMove = (e) => { if (drag && drag.armed) e.preventDefault(); };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    function dropTarget(x, y) {
      const hit = document.elementFromPoint(x, y);
      const d = hit && hit.closest('[data-day]');
      return d && page.contains(d) ? d : null;
    }
    function endDrag(commit, ev) {
      const d = drag;
      if (!d) return;
      drag = null;
      clearTimeout(d.press);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      d.card.classList.remove('is-armed', 'is-dragging');
      if (d.over) d.over.classList.remove('is-drop');
      if (d.ghost) d.ghost.remove();
      document.documentElement.classList.remove('tk-dragging');
      if (!d.started) return;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      if (!commit) return;
      const target = ev ? dropTarget(ev.clientX, ev.clientY) : d.over;
      if (target && target.dataset.day !== d.from) reschedule(d.id, target.dataset.day);
    }
    function onMove(ev) {
      const d = drag;
      if (!d || ev.pointerId !== d.pid) return;
      const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
      if (!d.started) {
        if (!d.armed) { if (Math.hypot(dx, dy) > 8) endDrag(false); return; }
        if (Math.hypot(dx, dy) < 5) return;
        d.started = true;
        const r = d.card.getBoundingClientRect();
        d.ox = d.sx - r.left; d.oy = d.sy - r.top;
        d.ghost = d.card.cloneNode(true);
        d.ghost.classList.add('tk-ghost');
        d.ghost.removeAttribute('tabindex');
        d.ghost.setAttribute('aria-hidden', 'true');
        d.ghost.style.width = r.width + 'px';
        document.body.appendChild(d.ghost);
        d.card.classList.add('is-dragging');
        document.documentElement.classList.add('tk-dragging');
      }
      ev.preventDefault();
      d.ghost.style.transform = `translate(${ev.clientX - d.ox}px, ${ev.clientY - d.oy}px) rotate(-1.5deg)`;
      const over = dropTarget(ev.clientX, ev.clientY);
      if (over !== d.over) {
        if (d.over) d.over.classList.remove('is-drop');
        if (over && over.dataset.day !== d.from) over.classList.add('is-drop');
        d.over = over;
      }
    }
    function onUp(ev) { if (drag && ev.pointerId === drag.pid) endDrag(true, ev); }
    function onCancel() { endDrag(false); }
    page.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.tk-wcard');
      if (!card || drag || e.button !== 0 || e.target.closest('button,a')) return;
      const t = store.get('tasks', card.dataset.id);
      if (!t || t.done) return;
      const touch = e.pointerType === 'touch';
      drag = { id: t.id, from: t.due, card, pid: e.pointerId, sx: e.clientX, sy: e.clientY, armed: !touch, started: false, over: null, ghost: null, press: null };
      if (touch) {
        drag.press = setTimeout(() => { if (drag && drag.card === card) { drag.armed = true; card.classList.add('is-armed'); } }, 250);
      }
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    });
    page.addEventListener('contextmenu', (e) => { if (e.target.closest('.tk-wcard')) e.preventDefault(); });

    const off = store.subscribe((evt) => {
      if (!evt.has('tasks', 'contacts', 'companies', 'deals', 'activities', 'reps')) return;
      settling.forEach((v, id) => { const t = store.get('tasks', id); if (!t || !t.done) { clearTimeout(v.timer); settling.delete(id); } });
      draw();
      if (evt.has('contacts', 'companies')) drawQuick();
    });

    return () => {
      alive = false;
      off();
      endDrag(false);
      timers.forEach(clearTimeout);
      document.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('seg-change', onSeg);
    };
  }

  CRM.pages.tasks = {
    route: /^\/tasks$/,
    title: '任務',
    nav: 'tasks',
    mount(el, ctx) { this._off = mount(el, ctx); },
    unmount() { if (this._off) this._off(); this._off = null; },
  };
  // 給驗收腳本與日後移入 core 用
  CRM.tasksParse = parseQuick;
})();
