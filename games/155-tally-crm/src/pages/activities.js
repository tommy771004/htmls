/* pages/activities · 活動紀錄（#/activities）
   query：type=call|email|meeting|note|stage|task  owner=u2|me  range=today|week|month|90
          day=YYYY-MM-DD（熱度格點選的日，和 range 互斥）  q=
   活動紀錄只列「已經發生」的紀錄（at ≤ 現在）。往來 = store.TOUCH_TYPES（不含階段變更）。 */
(function () {
  'use strict';
  const CRM = window.CRM;
  const U = CRM.util;
  const { html, raw, h } = U;

  const TYPES = [
    { id: 'all', name: '全部' },
    { id: 'call', name: '通話' },
    { id: 'email', name: 'Email' },
    { id: 'meeting', name: '會議' },
    { id: 'note', name: '筆記' },
    { id: 'stage', name: '階段變更' },
    { id: 'task', name: '任務完成' },
  ];
  const TYPE_ICON = { call: 'phone', email: 'mail', meeting: 'meeting', note: 'note', task: 'check', stage: 'stage' };
  const TYPE_NAME = { call: '通話', email: 'Email', meeting: '會議', note: '筆記', task: '完成任務', stage: '階段變更' };
  // 類型分布的堆疊順序：相鄰色（sky／lilac）拆開，階段變更是系統紀錄，用中性色放最後
  const DIST_ORDER = ['call', 'email', 'note', 'meeting', 'task', 'stage'];
  const TYPE_COLOR = { call: 'var(--peach)', email: 'var(--sky)', note: 'var(--lemon)', meeting: 'var(--lilac)', task: 'var(--mint)', stage: 'var(--ink-4)' };
  const RANGES = [
    { id: '', label: '全部期間' },
    { id: 'today', label: '今天' },
    { id: 'week', label: '本週' },
    { id: 'month', label: '本月' },
    { id: '90', label: '近 90 天' },
  ];
  const SLOTS = [
    { label: '早上', sub: '9 點前', test: (hh) => hh < 9 },
    { label: '上午', sub: '9 到 12 點', test: (hh) => hh >= 9 && hh < 12 },
    { label: '中午', sub: '12 到 14 點', test: (hh) => hh >= 12 && hh < 14 },
    { label: '下午', sub: '14 到 18 點', test: (hh) => hh >= 14 && hh < 18 },
    { label: '晚上', sub: '18 點後', test: (hh) => hh >= 18 },
  ];
  const PAGE = 30;
  const HEAT_WEEKS = 12;
  const CME = new Set(['call', 'email', 'meeting']);
  const isVideo = (a) => /視訊|線上|遠端|Teams|Meet|Zoom/i.test(a.location || '');
  const byAtDesc = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

  function readState(q, store) {
    const st = { type: 'all', owner: '', range: '', day: '', q: '' };
    if (TYPES.some((t) => t.id === q.type)) st.type = q.type;
    const own = q.owner === 'me' ? store.me().id : q.owner;
    if (own && store.rep(own)) st.owner = own;
    if (RANGES.some((r) => r.id && r.id === q.range)) st.range = q.range;
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.day || '')) { st.day = q.day; st.range = ''; }
    st.q = (q.q || '').slice(0, 80);
    return st;
  }

  function dayLabel(dateIso) {
    const diff = U.daysFromToday(dateIso);
    const base = `${U.fmtDate(dateIso)} ${U.weekday(U.parse(dateIso))}`;
    return diff === 0 ? `今天 · ${base}` : diff === -1 ? `昨天 · ${base}` : base;
  }

  CRM.pages.activities = {
    route: /^\/activities$/,
    title: '活動紀錄',
    nav: 'activities',
    mount(el, ctx) {
      const { store, router } = ctx;
      const UI = CRM.ui;
      let st = readState(ctx.query || {}, store);
      let limit = PAGE;
      let alive = true;
      const timers = new Set();
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };

      el.appendChild(UI.pageHeader({
        title: '活動紀錄',
        sub: '全隊的通話、Email、會議與階段變更',
        ownNew: true,
        actions: UI.btn({ label: '記一筆', icon: 'plus', variant: 'primary', attrs: { 'data-act': 'log' } }),
      }));
      const page = h(html`<div class="page pg-activities">
        <div class="stats av-stats"></div>
        <section class="card av-heat" aria-label="活動熱度"></section>
        <div class="av-grid">
          <section class="card av-card" aria-label="活動時間軸">
            <div class="toolbar av-viewbar">
              <div class="av-types"></div>
            </div>
            <div class="toolbar av-bar">
              <div class="av-filters" role="group" aria-label="篩選"></div>
              <p class="av-count" aria-live="polite"></p>
              <label class="tsearch av-search">${UI.icon('search', { size: 15 })}<input class="input" type="search" name="av-q" placeholder="搜尋內容、聯絡人或公司" autocomplete="off" aria-label="搜尋活動" value="${st.q}"></label>
            </div>
            <div class="av-tl"></div>
          </section>
          <aside class="av-side" aria-label="本週摘要">
            <section class="card av-sec av-rank"></section>
            <section class="card av-sec av-dist"></section>
          </aside>
        </div>
      </div>`);
      el.appendChild(page);
      const $ = (s) => page.querySelector(s);
      const statsEl = $('.av-stats'), heatEl = $('.av-heat'), typesEl = $('.av-types'), filtersEl = $('.av-filters'), countEl = $('.av-count');
      const tlEl = $('.av-tl'), rankEl = $('.av-rank'), distEl = $('.av-dist'), cardEl = $('.av-card'), searchEl = $('input[name="av-q"]');

      el.querySelector('.ph [data-act="log"]').addEventListener('click', () => UI.logActivity({}));

      /* ── 資料 ── */
      const nowIso = () => U.isoDT(new Date());
      const todayIso = () => U.iso(U.today());
      function logged() {
        const now = nowIso();
        return store.all('activities').filter((a) => a.at <= now).sort(byAtDesc);
      }
      function rangeStart(r) {
        const T = U.today();
        if (r === 'today') return U.iso(T);
        if (r === 'week') return U.iso(U.startOfWeek(T));
        if (r === 'month') return U.iso(new Date(T.getFullYear(), T.getMonth(), 1));
        if (r === '90') return U.iso(U.addDays(T, -89));
        return '';
      }
      const textCache = new Map();
      function textOf(a) {
        const key = a.id + '|' + a.at + '|' + (a.body || '').length + '|' + (a.contactId || '') + (a.dealId || '');
        const hit = textCache.get(a.id);
        if (hit && hit.key === key) return hit.text;
        const c = a.contactId && store.get('contacts', a.contactId);
        const co = a.companyId && store.get('companies', a.companyId);
        const d = a.dealId && store.get('deals', a.dealId);
        const text = [a.body, a.subject, a.title, a.location, c && c.name, co && co.name, co && co.short, d && d.name, d && d.code].filter(Boolean).join(' ').toLowerCase();
        textCache.set(a.id, { key, text });
        return text;
      }
      /** skip：'type' 時不套類型（算分頁計數與類型分布用） */
      function apply(list, { skip = '' } = {}) {
        const from = st.day ? '' : rangeStart(st.range);
        const qq = st.q.trim().toLowerCase();
        return list.filter((a) => {
          if (st.owner && a.owner !== st.owner) return false;
          if (st.day && a.at.slice(0, 10) !== st.day) return false;
          if (from && a.at.slice(0, 10) < from) return false;
          if (skip !== 'type' && st.type !== 'all' && a.type !== st.type) return false;
          if (qq && !textOf(a).includes(qq)) return false;
          return true;
        });
      }
      /** 分面計數：暫時拿掉某些篩選後的結果 */
      function without(patch) {
        const keep = st;
        st = { ...st, ...patch };
        try { return apply(logged(), {}); } finally { st = keep; }
      }
      const anyFilter = () => !!(st.type !== 'all' || st.owner || st.range || st.day || st.q.trim());

      function syncUrl() {
        if (!alive) return;
        router.setQuery({ type: st.type === 'all' ? null : st.type, owner: st.owner || null, range: st.range || null, day: st.day || null, q: st.q.trim() || null }, { silent: true });
      }
      function setState(patch, { focus } = {}) {
        st = { ...st, ...patch };
        if (patch.day) st.range = '';
        if (patch.range) st.day = '';
        limit = PAGE;
        syncUrl();
        draw();
        if (focus) { const f = page.querySelector(focus); f && f.focus({ preventScroll: true }); }
      }
      function clearAll() {
        st = { type: 'all', owner: '', range: '', day: '', q: '' };
        searchEl.value = '';
        limit = PAGE;
        syncUrl();
        draw();
      }

      /* ── 統計卡（全隊、本週一到現在；比較上週同期） ── */
      let lastRepTop = null;
      function drawStats(all) {
        const T = U.today();
        const mon = U.startOfWeek(T);
        const monIso = U.iso(mon);
        const lmonIso = U.iso(U.addDays(mon, -7));
        const lastEnd = U.isoDT(U.addDays(new Date(), -7));
        const week = all.filter((a) => a.at.slice(0, 10) >= monIso);
        const lastWeek = all.filter((a) => a.at.slice(0, 10) >= lmonIso && a.at <= lastEnd);
        const pctDelta = (cur, prev) => {
          if (!prev) return cur ? { text: `${cur}`, dir: 'up' } : { text: '持平', dir: 'flat' };
          const p = Math.round(((cur - prev) / prev) * 100);
          return { text: p === 0 ? '持平' : `${Math.abs(p)}%`, dir: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' };
        };

        const cme = week.filter((a) => CME.has(a.type)).length;
        const cmeLast = lastWeek.filter((a) => CME.has(a.type)).length;
        const series = [];
        const labels = [];
        for (let k = 7; k >= 0; k--) {
          const a = U.iso(U.addDays(mon, -7 * k)), b = U.iso(U.addDays(mon, -7 * k + 6));
          series.push(all.filter((x) => CME.has(x.type) && x.at.slice(0, 10) >= a && x.at.slice(0, 10) <= b).length);
          labels.push(k === 0 ? '本週' : `${U.fmtDate(a)} 那週`);
        }

        const calls = week.filter((a) => a.type === 'call');
        const mins = calls.reduce((s, a) => s + (+a.duration || 0), 0);
        const minsLast = lastWeek.filter((a) => a.type === 'call').reduce((s, a) => s + (+a.duration || 0), 0);
        const hours = mins / 60;

        const meets = week.filter((a) => a.type === 'meeting');
        const video = meets.filter(isVideo).length;
        const meetsLast = lastWeek.filter((a) => a.type === 'meeting').length;
        const md = meets.length - meetsLast;

        const reps = store.all('reps');
        const touchesBy = new Map(reps.map((r) => [r.id, 0]));
        week.forEach((a) => { if (store.TOUCH_TYPES.has(a.type) && touchesBy.has(a.owner)) touchesBy.set(a.owner, touchesBy.get(a.owner) + 1); });
        const ranked = reps.map((r) => ({ r, n: touchesBy.get(r.id) })).sort((a, b) => b.n - a.n || (a.r.me ? -1 : 0));
        const top = ranked[0];
        const topView = top && top.n ? html`${UI.nameBlock(top.r, { size: 28, title: false })}<span class="av-stat-name">${top.r.name}</span>` : html`<span class="av-stat-name t-3">還沒有</span>`;
        statsEl.innerHTML = String(html`
          ${UI.statCard({ label: '本週往來', value: U.num(cme), unit: '次', icon: 'activities', tone: 1, delta: pctDelta(cme, cmeLast), foot: '比上週同期', spark: series, href: router.href('/activities', { range: 'week' }), attrs: { 'data-stat': 'touch' } })}
          ${UI.statCard({ label: '本週通話時數', value: hours >= 10 ? Math.round(hours) : hours.toFixed(1), unit: '小時', icon: 'phone', tone: 3, delta: pctDelta(mins, minsLast), foot: calls.length ? html`${calls.length} 通<span class="av-hide-m"> · 平均 ${Math.round(mins / calls.length)} 分</span>` : '本週還沒有通話', href: router.href('/activities', { type: 'call', range: 'week' }), attrs: { 'data-stat': 'call' } })}
          ${UI.statCard({ label: '本週會議', value: U.num(meets.length), unit: '場', icon: 'meeting', tone: 8, delta: { text: md === 0 ? '持平' : `${Math.abs(md)} 場`, dir: md > 0 ? 'up' : md < 0 ? 'down' : 'flat' }, foot: meets.length ? `現場 ${meets.length - video} · 視訊 ${video}` : '本週還沒有會議', href: router.href('/activities', { type: 'meeting', range: 'week' }), attrs: { 'data-stat': 'meeting' } })}
          ${UI.statCard({ label: '最活躍業務', value: topView, icon: 'target', tone: 2, foot: top && top.n ? html`<span class="av-stat-tally">${UI.tally(top.n, { size: 20, key: 'rep:' + top.r.id, label: `本週 ${top.n} 次往來` })}</span><span>本週 ${top.n} 次往來</span>` : '本週還沒有往來', href: top && top.n ? router.href('/activities', { owner: top.r.id, range: 'week' }) : null, attrs: { 'data-stat': 'rep' } })}`);
        const sp = statsEl.querySelector('[data-stat="touch"] .spark');
        if (sp) sp.querySelectorAll('rect[data-tip]').forEach((r, i) => r.setAttribute('data-tip', `${labels[i]}：${series[i]} 次`));
        lastRepTop = top ? top.r.id : null;
        return ranked;
      }

      /* ── 活動熱度（近 12 週 × 7 天；跟著業務篩選，不跟其他篩選） ── */
      function drawHeat(all) {
        const T = U.today();
        const tIso = U.iso(T);
        const start = U.addDays(U.startOfWeek(T), -7 * (HEAT_WEEKS - 1));
        const startIso = U.iso(start);
        const counts = new Map();
        const slotN = SLOTS.map(() => 0);
        let total = 0;
        all.forEach((a) => {
          if (!store.TOUCH_TYPES.has(a.type)) return;
          if (st.owner && a.owner !== st.owner) return;
          const d = a.at.slice(0, 10);
          if (d < startIso) return;
          counts.set(d, (counts.get(d) || 0) + 1);
          total++;
          const hh = +a.at.slice(11, 13);
          const si = SLOTS.findIndex((s) => s.test(hh));
          if (si >= 0) slotN[si]++;
        });
        const max = Math.max(1, ...counts.values());
        const lvl = (v) => (v ? Math.min(4, Math.max(1, Math.ceil((v / max) * 4))) : 0);
        const cols = [];
        let busiest = null;
        let workdays = 0, workTotal = 0;
        for (let w = 0; w < HEAT_WEEKS; w++) {
          const days = [];
          for (let d = 0; d < 7; d++) {
            const date = U.addDays(start, w * 7 + d);
            const di = U.iso(date);
            const v = counts.get(di) || 0;
            const future = di > tIso;
            if (!future && (!busiest || v > busiest.v)) busiest = { d: di, v };
            if (!future && d < 5) { workdays++; workTotal += v; }
            days.push({ di, v, future, wd: d });
          }
          const first = U.addDays(start, w * 7);
          const prev = w ? U.addDays(start, (w - 1) * 7) : null;
          const month = !prev || prev.getMonth() !== first.getMonth() ? `${first.getMonth() + 1} 月` : '';
          cols.push({ days, month });
        }
        const rep = st.owner ? store.rep(st.owner) : null;
        const WD = ['一', '二', '三', '四', '五', '六', '日'];
        const cellsHtml = [];
        cellsHtml.push(html`<span class="av-hm-corner" aria-hidden="true"></span>`);
        cols.forEach((c) => cellsHtml.push(html`<span class="av-hm-month" aria-hidden="true">${c.month}</span>`));
        for (let d = 0; d < 7; d++) {
          cellsHtml.push(html`<span class="av-hm-wd" aria-hidden="true">${d % 2 === 0 ? WD[d] : ''}</span>`);
          cols.forEach((c) => {
            const x = c.days[d];
            const tip = `${U.fmtDate(x.di)} 週${WD[d]} · ${x.v ? x.v + ' 次往來' : '沒有往來'}`;
            if (x.future) cellsHtml.push(html`<span class="av-hc is-future" aria-hidden="true"></span>`);
            else cellsHtml.push(html`<button type="button" class="av-hc${x.di === st.day ? ' is-on' : ''}${x.di === tIso ? ' is-today' : ''}" data-l="${lvl(x.v)}" data-day="${x.di}" data-n="${x.v}" data-tip="${tip}" aria-label="${tip}" aria-pressed="${String(x.di === st.day)}"></button>`);
          });
        }
        const peakSlot = slotN.indexOf(Math.max(...slotN));
        const teamSlots = SLOTS.map(() => 0);
        all.forEach((a) => { if (store.TOUCH_TYPES.has(a.type) && a.at.slice(0, 10) >= startIso) { const si = SLOTS.findIndex((x) => x.test(+a.at.slice(11, 13))); if (si >= 0) teamSlots[si]++; } });
        const avg = workdays ? workTotal / workdays : 0;
        heatEl.innerHTML = String(html`
          <div class="av-heat-head">
            <div class="av-heat-titles"><h2 class="card-title">活動熱度</h2><p class="card-sub">近 12 週每天的往來次數 · ${rep ? rep.name : '全隊'}，點一天看當天紀錄</p></div>
            <div class="av-legend" aria-hidden="true"><span>少</span>${[0, 1, 2, 3, 4].map((l) => html`<i class="av-hc-key" data-l="${l}"></i>`)}<span>多</span></div>
          </div>
          <div class="av-heat-body">
            <div class="av-hm" role="group" aria-label="近 12 週每日往來次數">${cellsHtml}</div>
            <div class="av-heat-side">
              <dl class="av-facts">
                <div class="av-fact"><dt>近 12 週往來</dt><dd><b>${U.num(total)}</b><span>次</span></dd></div>
                <div class="av-fact"><dt>工作日平均</dt><dd><b>${avg.toFixed(1)}</b><span>次／天</span></dd></div>
                <div class="av-fact"><dt>最忙的一天</dt><dd>${busiest && busiest.v ? html`<button type="button" class="av-peak" data-day="${busiest.d}"><b>${U.fmtDate(busiest.d)}</b><span>${U.weekday(U.parse(busiest.d))} · ${busiest.v} 次</span></button>` : html`<span class="t-3">還沒有</span>`}</dd></div>
              </dl>
              <div class="av-slots">
                <p class="av-slots-h"><span>往來時段</span>${total ? html`<span class="t-3">最常在${SLOTS[peakSlot].label}（${SLOTS[peakSlot].sub}）</span>` : ''}</p>
                ${UI.barH(SLOTS.map((s, i) => ({ s, i })).filter((x) => teamSlots[x.i] || slotN[x.i]).map(({ s, i }) => ({ label: s.label, value: slotN[i], color: i === peakSlot ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 38%, var(--sheet))', valueLabel: total ? U.pct(slotN[i] / total) : '0%' })), { labelWidth: 40, max: Math.max(1, ...slotN) })}
              </div>
            </div>
          </div>`);
      }

      /* ── 工具列 ── */
      function drawTypes(base) {
        const counts = { all: base.length };
        base.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
        typesEl.innerHTML = String(UI.tabs({ name: 'av-type', value: st.type, cls: 'av-tabs', items: TYPES.map((t) => ({ value: t.id, label: t.name, count: counts[t.id] || 0 })) }));
      }
      function drawFilters(shown) {
        const rep = st.owner ? store.rep(st.owner) : null;
        const reps = store.all('reps');
        const range = RANGES.find((r) => r.id === st.range);
        filtersEl.innerHTML = String(html`
          <button type="button" class="tbtn av-fbtn${rep ? ' is-on' : ''}" data-filter="owner" aria-haspopup="menu" aria-expanded="false">${rep ? UI.nameBlock(rep, { size: 20, title: false }) : html`<span class="av-stack" aria-hidden="true">${reps.slice(0, 4).map((r) => UI.nameBlock(r, { size: 20, title: false }))}</span>`}<span>業務${rep ? html`<b>：${rep.name}</b>` : ''}</span>${UI.icon('chevronDown', { size: 14 })}</button>
          <button type="button" class="tbtn av-fbtn${st.range ? ' is-on' : ''}" data-filter="range" aria-haspopup="menu" aria-expanded="false">${UI.icon('calendar', { size: 14 })}<span>期間${st.range ? html`<b>：${range.label}</b>` : ''}</span>${UI.icon('chevronDown', { size: 14 })}</button>
          ${st.day ? html`<button type="button" class="tbtn av-fbtn av-daychip is-on" data-act="unday" aria-label="取消日期篩選 ${dayLabel(st.day)}">${UI.icon('calendar', { size: 14 })}<span><b>${dayLabel(st.day)}</b></span>${UI.icon('close', { size: 14 })}</button>` : ''}
          ${anyFilter() ? UI.btn({ label: '清除篩選', size: 'sm', variant: 'quiet', cls: 'av-clear', attrs: { 'data-act': 'clear' } }) : ''}`);
        countEl.textContent = anyFilter() ? `符合 ${U.num(shown)} 筆` : `共 ${U.num(shown)} 筆`;
      }

      /* ── 時間軸 ── */
      let seen = null; // 已經畫過的活動 id；之後出現的新紀錄加高亮
      let fresh = new Set();
      /** 階段變更的 body 是「A → B：原因」，只留原因 */
      const stageNote = (a) => { const b = a.body || ''; const i = b.indexOf('：'); return i >= 0 ? b.slice(i + 1).trim() : (b.includes('→') ? '' : b); };
      function evView(a) {
        const rep = store.rep(a.owner);
        const c = a.contactId ? store.get('contacts', a.contactId) : null;
        const co = a.companyId ? store.get('companies', a.companyId) : null;
        const deal = a.dealId ? store.get('deals', a.dealId) : null;
        const meta = [];
        if (a.type === 'call' && a.duration) meta.push(U.duration(a.duration));
        if (a.type === 'meeting') { if (a.location) meta.push(a.location); if (a.duration) meta.push(U.duration(a.duration)); }
        let bodyView = html`<p class="av-ev-text">${a.body}</p>`;
        if (a.type === 'email') bodyView = html`<p class="av-ev-subj">${a.subject || '（無主旨）'}</p>${a.body ? html`<p class="av-ev-text">${a.body}</p>` : ''}`;
        if (a.type === 'meeting' && a.title && a.title !== a.body && a.title !== '會議') bodyView = html`<p class="av-ev-subj">${a.title}</p><p class="av-ev-text">${a.body}</p>`;
        if (a.type === 'task') bodyView = html`<p class="av-ev-text av-ev-done">${UI.icon('check', { size: 14 })}<span>${a.body}</span></p>`;
        if (a.type === 'stage') bodyView = html`<p class="av-ev-text av-ev-stage">${a.from ? UI.stageTag(a.from) : html`<span class="t-3">新建</span>`}${UI.icon('arrowRight', { size: 14 })}${UI.stageTag(a.to)}${a.to === 'won' && deal ? html`<span class="av-ev-amt">${UI.money(deal.amount, { compact: true })}</span>` : ''}</p>${stageNote(a) ? html`<p class="av-ev-text">${a.to === 'lost' ? '未成原因：' : ''}${stageNote(a)}</p>` : ''}`;
        return html`<li class="av-ev${fresh.has(a.id) ? ' is-new' : ''}" data-type="${a.type}" data-id="${a.id}" data-owner="${a.owner || ''}" data-at="${a.at}">
          <span class="av-ev-ic" aria-hidden="true">${UI.icon(TYPE_ICON[a.type] || 'note', { size: 16 })}</span>
          <div class="av-ev-main">
            <p class="av-ev-head"><span class="av-ev-type">${TYPE_NAME[a.type] || a.type}</span>${meta.length ? html`<span class="av-ev-meta">${meta.join(' · ')}</span>` : ''}<time class="av-ev-time" datetime="${a.at}">${U.time(a.at)}</time></p>
            ${bodyView}
            <p class="av-ev-foot">
              ${rep ? html`<span class="av-ev-who" title="負責業務">${UI.nameBlock(rep, { size: 20, title: false })}${rep.name}</span>` : ''}
              ${c ? html`<a class="av-ev-link" href="${router.href('/contacts/' + c.id)}" data-contact="${c.id}">${UI.nameBlock(c, { size: 20, title: false })}<span>${c.name}</span></a>` : ''}
              ${co ? html`<a class="av-ev-link" href="${router.href('/companies/' + co.id)}" data-company="${co.id}">${UI.companyMark(co, { size: 20, title: false })}<span>${co.name}</span></a>` : ''}
              ${deal ? html`<button type="button" class="av-ev-deal" data-deal="${deal.id}">${UI.icon('deals', { size: 14 })}<span>${deal.name}</span></button>` : ''}
            </p>
          </div>
        </li>`;
      }
      function drawTimeline(list) {
        const shown = list.slice(0, limit);
        const groups = [];
        shown.forEach((a) => {
          const d = a.at.slice(0, 10);
          const g = groups[groups.length - 1];
          if (g && g.d === d) g.items.push(a); else groups.push({ d, items: [a] });
        });
        const rest = list.length - shown.length;
        const dayN = new Map();
        list.forEach((a) => { const d = a.at.slice(0, 10); dayN.set(d, (dayN.get(d) || 0) + 1); });
        tlEl.innerHTML = String(shown.length
          ? html`<div class="av-tl-body">${groups.map((g) => html`<section class="av-day" aria-label="${dayLabel(g.d)}"><h3 class="av-day-h"><span>${dayLabel(g.d)}</span><span class="av-day-n">${dayN.get(g.d)} 筆</span></h3><ol class="av-evs">${g.items.map(evView)}</ol></section>`)}</div>
            ${rest > 0 ? html`<div class="av-more">${UI.btn({ label: `載入更早的 ${Math.min(PAGE, rest)} 筆`, size: 'sm', icon: 'chevronDown', attrs: { 'data-act': 'more' } })}<span class="t-12 t-3">還有 ${U.num(rest)} 筆</span></div>` : html`<p class="av-end">已經是最早的紀錄</p>`}`
          : html`<div class="av-empty">${UI.emptyState({
            title: anyFilter() ? '沒有符合條件的活動' : '還沒有任何活動',
            body: anyFilter() ? '換個關鍵字，或放寬類型、業務與期間。' : '記下第一通電話或會議，劃記就會開始累積。',
            action: anyFilter() ? UI.btn({ label: '清除篩選', icon: 'close', size: 'sm', attrs: { 'data-act': 'clear' } }) : UI.btn({ label: '記一筆', icon: 'plus', size: 'sm', variant: 'primary', attrs: { 'data-act': 'log' } }),
            compact: true,
          })}</div>`);
      }

      /* ── 右欄：本週排行、類型分布 ── */
      function drawRank(ranked) {
        const top = Math.max(1, ...ranked.map((x) => x.n));
        const total = ranked.reduce((s, x) => s + x.n, 0);
        rankEl.innerHTML = String(html`
          <div class="av-side-h"><h2 class="section-title">本週排行</h2><span class="av-side-sub">往來 ${U.num(total)} 次</span></div>
          <ol class="av-rk-list" style="--tw:${top > 25 ? 52 : Math.max(24, Math.ceil(top / 5) * 24 - 4)}px">${ranked.map((x, i) => html`<li>
            <button type="button" class="av-rk${st.owner === x.r.id ? ' is-on' : ''}" data-owner="${x.r.id}" aria-pressed="${String(st.owner === x.r.id)}" aria-label="${x.r.name} 本週 ${x.n} 次往來，只看${x.r.name}本週的紀錄">
              <span class="av-rk-n">${i + 1}</span>
              ${UI.nameBlock(x.r, { size: 28, title: false })}
              <span class="av-rk-main">
                <span class="av-rk-name">${x.r.name}${x.r.me ? html`<span class="av-rk-me">我</span>` : ''}</span>
                <span class="av-rk-bar" aria-hidden="true"><i style="width:${x.n ? Math.max(4, (x.n / top) * 100).toFixed(1) : 0}%"></i></span>
              </span>
              <span class="av-rk-tally">${x.n ? UI.tally(x.n, { size: 20, key: 'rep:' + x.r.id, label: `${x.n} 次` }) : html`<span class="av-rk-zero">0</span>`}</span>
            </button></li>`)}</ol>`);
      }
      function drawDist(base) {
        const counts = Object.fromEntries(DIST_ORDER.map((t) => [t, 0]));
        base.forEach((a) => { if (a.type in counts) counts[a.type]++; });
        const total = base.length;
        const scope = st.day ? dayLabel(st.day) : (RANGES.find((r) => r.id === st.range) || RANGES[0]).label;
        const segs = DIST_ORDER.filter((t) => counts[t]);
        distEl.innerHTML = String(html`
          <div class="av-side-h"><h2 class="section-title">類型分布</h2><span class="av-side-sub">${scope} · ${U.num(total)} 筆</span></div>
          <div class="av-dist-bar" role="img" aria-label="${DIST_ORDER.map((t) => `${TYPE_NAME[t]} ${counts[t]}`).join('、')}">${total ? segs.map((t) => html`<i style="flex:${counts[t]} 1 0;background:${raw(TYPE_COLOR[t])}" data-tip="${TYPES.find((x) => x.id === t).name}：${counts[t]} 筆（${U.pct(counts[t] / total)}）"></i>`) : html`<i class="is-empty"></i>`}</div>
          <ul class="av-dist-legend">${DIST_ORDER.map((t) => html`<li><button type="button" class="av-dl${st.type === t ? ' is-on' : ''}" data-type="${t}" aria-pressed="${String(st.type === t)}"><i style="background:${raw(TYPE_COLOR[t])}"></i><span class="av-dl-name">${TYPES.find((x) => x.id === t).name}</span><span class="av-dl-n">${counts[t]}</span><span class="av-dl-p">${total ? U.pct(counts[t] / total) : '0%'}</span></button></li>`)}</ul>`);
      }

      /* ── 繪製 ── */
      function draw() {
        const all = logged();
        const base = apply(all, { skip: 'type' });
        const list = st.type === 'all' ? base : base.filter((a) => a.type === st.type);
        const ranked = drawStats(all);
        drawHeat(all);
        drawTypes(base);
        drawFilters(list.length);
        drawTimeline(list);
        drawRank(ranked);
        drawDist(base);
        if (!seen) seen = new Set(all.map((a) => a.id));
        else all.forEach((a) => seen.add(a.id));
        if (fresh.size) {
          const ids = [...fresh];
          later(() => { ids.forEach((id) => fresh.delete(id)); page.querySelectorAll('.av-ev.is-new').forEach((n) => { if (ids.includes(n.dataset.id)) n.classList.remove('is-new'); }); }, 2200);
        }
      }
      draw();

      /* ── 事件 ── */
      page.addEventListener('tab-change', (e) => {
        if (e.detail.name !== 'av-type') return;
        setState({ type: e.detail.value }, { focus: `.av-tabs [data-value="${e.detail.value}"]` });
      });
      const onSearch = U.debounce(() => { if (!alive) return; st.q = searchEl.value; limit = PAGE; syncUrl(); draw(); }, 160);
      searchEl.addEventListener('input', onSearch);
      searchEl.addEventListener('keydown', (e) => { if (e.key === 'Escape' && searchEl.value) { e.stopPropagation(); searchEl.value = ''; st.q = ''; syncUrl(); draw(); } });

      page.addEventListener('click', (e) => {
        const t = e.target;
        const cell = t.closest('.av-hc[data-day], .av-peak[data-day]');
        if (cell) {
          const d = cell.dataset.day;
          const off = st.day === d && cell.classList.contains('av-hc');
          setState({ day: off ? '' : d }, { focus: cell.classList.contains('av-hc') ? `.av-hc[data-day="${d}"]` : null });
          if (!off) {
            const r = cardEl.getBoundingClientRect();
            if (r.top > window.innerHeight * 0.75 || r.top < 0) {
              const hh = (document.querySelector('.ph') || {}).offsetHeight || 0;
              window.scrollTo({ top: window.scrollY + r.top - hh - 8, behavior: U.reducedMotion() ? 'auto' : 'smooth' });
            }
          }
          return;
        }
        const act = t.closest('[data-act]');
        if (act) {
          const a = act.dataset.act;
          if (a === 'clear') { clearAll(); return; }
          if (a === 'unday') { setState({ day: '' }, { focus: '[data-filter="range"]' }); return; }
          if (a === 'log') { UI.logActivity({}); return; }
          if (a === 'more') {
            limit += PAGE;
            const all = logged();
            const base = apply(all, { skip: 'type' });
            const list = st.type === 'all' ? base : base.filter((x) => x.type === st.type);
            const firstNew = list[limit - PAGE];
            drawTimeline(list);
            const n = firstNew && tlEl.querySelector(`.av-ev[data-id="${firstNew.id}"]`);
            if (n) { n.setAttribute('tabindex', '-1'); n.focus({ preventScroll: true }); }
            return;
          }
        }
        const fb = t.closest('[data-filter]');
        if (fb) {
          if (fb.dataset.filter === 'owner') {
            const pool = without({ owner: '' });
            UI.menu(fb, [
              { label: '全部業務', value: '', checked: !st.owner, hint: String(pool.length) },
              { divider: true },
              ...store.all('reps').map((r) => ({ label: r.me ? `${r.name}（我）` : r.name, value: r.id, lead: UI.nameBlock(r, { size: 22, title: false }), checked: st.owner === r.id, hint: String(pool.filter((a) => a.owner === r.id).length) })),
            ], { label: '業務', onSelect: (it) => setState({ owner: it.value }, { focus: '[data-filter="owner"]' }) });
          } else {
            const pool = without({ range: '', day: '' });
            const cnt = (r) => { const from = rangeStart(r); return from ? pool.filter((a) => a.at.slice(0, 10) >= from).length : pool.length; };
            UI.menu(fb, RANGES.map((r) => ({ label: r.label, value: r.id, checked: st.range === r.id && !st.day, hint: String(cnt(r.id)) })), {
              label: '期間',
              onSelect: (it) => setState({ range: it.value, day: '' }, { focus: '[data-filter="range"]' }),
            });
          }
          return;
        }
        const rk = t.closest('.av-rk');
        if (rk) {
          const on = st.owner === rk.dataset.owner && st.range === 'week';
          setState(on ? { owner: '', range: '' } : { owner: rk.dataset.owner, range: 'week' }, { focus: `.av-rk[data-owner="${rk.dataset.owner}"]` });
          return;
        }
        const dl = t.closest('.av-dl');
        if (dl) { setState({ type: st.type === dl.dataset.type ? 'all' : dl.dataset.type }, { focus: `.av-dl[data-type="${dl.dataset.type}"]` }); return; }
        const dealBtn = t.closest('[data-deal]');
        if (dealBtn) { UI.openDeal(dealBtn.dataset.deal); return; }
        const cLink = t.closest('a[data-contact]');
        if (cLink && !e.metaKey && !e.ctrlKey) { e.preventDefault(); UI.openContact(cLink.dataset.contact); return; }
        const coLink = t.closest('a[data-company]');
        if (coLink && !e.metaKey && !e.ctrlKey) { e.preventDefault(); UI.openCompany(coLink.dataset.company); }
      });

      const off = store.subscribe((evt) => {
        if (!alive) return;
        if (!evt.has('activities', 'contacts', 'companies', 'deals', 'reps') && evt.type !== 'reset') return;
        if (evt.type === 'reset') { seen = null; fresh = new Set(); }
        else if (seen && evt.has('activities')) {
          const now = nowIso();
          store.all('activities').forEach((a) => { if (!seen.has(a.id) && a.at <= now) fresh.add(a.id); });
        }
        draw();
      });

      this._cleanup = () => {
        alive = false;
        off();
        timers.forEach((id) => clearTimeout(id));
        timers.clear();
      };
    },
    unmount() { if (this._cleanup) this._cleanup(); this._cleanup = null; },
  };
})();
