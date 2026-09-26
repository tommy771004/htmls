/* pages/kit · 元件總覽（#/kit，不在導覽上）：審查設計系統用 */
(function () {
  'use strict';
  const CRM = window.CRM;
  const U = CRM.util;
  const { html, raw } = U;

  const section = (id, title, desc, body, span = 1) => html`<section class="kit-sec${span === 2 ? ' kit-sec--wide' : ''}" id="kit-${id}"><header class="kit-sec-head"><h2 class="section-title">${title}</h2>${desc ? html`<p class="kit-desc">${desc}</p>` : ''}</header><div class="kit-sec-body">${body}</div></section>`;

  CRM.pages.kit = {
    route: /^\/kit$/,
    title: '元件總覽',
    nav: null,
    mount(el, ctx) {
      const { ui, store, actions } = ctx;
      const me = store.me();
      const reps = store.all('reps');
      const contacts = store.all('contacts');
      const companies = store.all('companies');
      const hotContact = contacts.find((c) => store.warmth({ contactId: c.id }).id === 'hot') || contacts[0];
      const nego = () => store.all('deals').find((d) => d.stage === 'nego');

      el.appendChild(ui.pageHeader({
        title: '元件總覽',
        sub: '劃記設計系統的每個元件與狀態',
        actions: ui.segmented({ name: 'kit-density', value: 'all', size: 'sm', options: [{ value: 'all', label: '全部' }, { value: 'marks', label: '記號' }, { value: 'controls', label: '控制項' }, { value: 'data', label: '資料' }] }),
      }));

      const swatches = ['bg', 'panel', 'raised', 'inset', 'ink', 'ink-2', 'ink-3', 'accent', 'pine', 'ochre'];
      const stageIds = store.STAGES.map((s) => s.id);
      const relDays = [-40, -9, -3, -1, 0, 1, 3, 6, 12];
      const series = store.touchSeries({ owner: me.id }, 12);
      const repRows = reps.map((r) => {
        const p = store.quarterProgress({ owner: r.id });
        return { label: r.name, segments: [{ value: p.won, color: 'var(--pine)', label: '已成交' }, { value: Math.max(0, p.target - p.won), color: 'var(--inset)', label: '缺口' }], valueLabel: U.pct(p.pct) };
      });
      const funnel = store.OPEN_STAGES.map((s) => { const ds = store.dealsByStage()[s.id]; return { label: s.name, value: ds.reduce((a, d) => a + d.amount, 0), color: s.color }; });

      const body = document.createElement('div');
      body.className = 'page kit';
      body.innerHTML = String(html`
        <div class="kit-grid" data-group="marks">
          ${section('tally', '劃記 tally(n)', '滿五一組依筆順畫出；超過 25 顯示數字加一個滿格正字。柿色是當期新增的筆畫。', html`
            <div class="kit-tallies">${Array.from({ length: 27 }, (_, i) => i + 1).map((n) => html`<div class="kit-tally"><span class="kit-n">${n}</span>${ui.tally(n, { accent: n % 7 === 0 ? 2 : 0 })}</div>`)}</div>
            <div class="kit-row kit-row--top">
              <div class="kit-demo">${ui.tally(3, { key: 'kit:demo', size: 20 })}<span class="label">點「多畫一筆」</span></div>
              ${ui.btn({ label: '多畫一筆', icon: 'plus', size: 'sm', attrs: { 'data-kit': 'bump' } })}
              <span class="kit-sep"></span>
              ${ui.personCell(hotContact)}
              ${ui.tally(store.touches({ contactId: hotContact.id }), { key: 'contact:' + hotContact.id })}
              ${ui.btn({ label: '記一筆通話', icon: 'phone', size: 'sm', variant: 'primary', attrs: { 'data-kit': 'log' } })}
            </div>`, 2)}
          ${section('mark', '品牌記號', '五筆圓頭粗筆畫的正字，啟動時依筆順描出。', html`
            <div class="kit-row kit-wrap">${ui.brandMark({ size: 56, cls: 'kit-brand' })}${ui.brandMark({ size: 32 })}${ui.brandMark({ size: 20 })}<span class="kit-wordmark">劃記</span>${ui.btn({ label: '重新描出', icon: 'refresh', size: 'sm', variant: 'quiet', attrs: { 'data-kit': 'redraw' } })}</div>`)}
          ${section('blocks', '頭像與公司標誌', '圓形粉彩頭像刻姓氏，色調依名字固定；業務多一圈白環。公司是圓角方形標誌，取簡稱第一字。', html`
            <div class="kit-row kit-wrap">${[20, 24, 28, 32, 40, 56].map((s) => ui.nameBlock(me, { size: s }))}</div>
            <div class="kit-row kit-wrap">${[20, 24, 28, 32, 40, 56].map((s, i) => ui.nameBlock(contacts[i * 7], { size: s }))}</div>
            <div class="kit-row kit-wrap">${[28, 32, 40, 56].map((s, i) => ui.companyMark(companies[i * 5], { size: s }))}${reps.map((r) => ui.nameBlock(r, { size: 28 }))}</div>`)}
          ${section('warmth', '關係溫度', '依最後往來天數：熱 ≤7、溫 ≤21、涼 ≤45、冷 >45。', html`
            <div class="kit-row kit-wrap">${store.WARMTH.map((w) => ui.warmth({ ...w, days: { hot: 3, warm: 12, cool: 30, cold: 64 }[w.id] }))}</div>`)}
          ${section('stage', '階段與金額', '階段用色點加文字；未成金額的刪除線穿過數字正中央。', html`
            <div class="kit-row kit-wrap">${stageIds.map((s) => ui.stageTag(s))}</div>
            <div class="kit-row kit-wrap kit-money">${ui.money(1280000)}${ui.money(1280000, { compact: true })}${ui.money(27122800, { compact: true })}${ui.money(185000, { compact: true })}${ui.money(3460000, { lost: true })}<span class="t-20">${ui.money(3460000, { lost: true })}</span></div>`)}
          ${section('time', '時間', '相對今天；逾期柿色、今天赭色。', html`
            <div class="kit-row kit-wrap">${relDays.map((d) => html`<span class="kit-chipless">${ui.relTime(U.iso(U.addDays(U.today(), d)))}</span>`)}</div>
            <div class="kit-row kit-wrap">${ui.due(U.iso(U.addDays(U.today(), -2)), '10:00')}${ui.due(U.iso(U.today()), '15:00')}${ui.due(U.iso(U.addDays(U.today(), 1)))}${ui.due(U.iso(U.addDays(U.today(), -2)), null, { done: true })}<span class="t-mono t-3">Q-2026-0412</span></div>`)}
          ${section('colors', '色彩 token', '帶綠石灰底、墨色主按鈕、柿色只給品牌與逾期。', html`
            <div class="kit-swatches">${swatches.map((s) => html`<div class="kit-sw"><i style="background:var(--${s})"></i><span>--${s}</span></div>`)}</div>
            <div class="kit-swatches">${stageIds.map((s) => html`<div class="kit-sw"><i style="background:var(--st-${s})"></i><span>--st-${s}</span></div>`)}</div>`)}
          ${section('type', '字級', '宋體給頁名、大數字與字塊；UI 用系統字；等寬只給代碼與時間。', html`
            <div class="kit-type">
              <p class="t-display" style="font-size:var(--fs-34)">NT$2,712 萬</p>
              <p class="t-display" style="font-size:var(--fs-26)">豐穗精機股份有限公司</p>
              <p class="t-20 t-strong">本季預測 20</p>
              <p class="t-16 t-strong">該聯絡了 16</p>
              <p>內文 14：場勘三號廠房，12 台 CNC 主軸馬達需加裝 VB-3，配電盤空間足夠。</p>
              <p class="t-13 t-2">次要 13：對方要求比照去年報價打九五折，已回報主管。</p>
              <p class="t-12 t-3">說明 12：最後往來 3 天前</p>
            </div>`)}
        </div>

        <div class="kit-grid" data-group="controls">
          ${section('buttons', '按鈕', '主要按鈕是實心墨色；hover 只改底色，不上浮不縮放。', html`
            <div class="kit-row kit-wrap">${ui.btn({ label: '新增交易', icon: 'plus', variant: 'primary' })}${ui.btn({ label: '篩選', icon: 'filter' })}${ui.btn({ label: '匯出', variant: 'quiet' })}${ui.btn({ label: '刪除', icon: 'trash', variant: 'danger' })}${ui.btn({ label: '重設', variant: 'danger-solid' })}</div>
            <div class="kit-row kit-wrap">${ui.btn({ label: '儲存', variant: 'primary', size: 'sm' })}${ui.btn({ label: '清單', icon: 'list', size: 'sm' })}${ui.btn({ label: '取消', variant: 'quiet', size: 'sm' })}${ui.btn({ label: '停用', variant: 'primary', disabled: true })}${ui.btn({ label: '停用', disabled: true })}${ui.btn({ label: '搜尋', icon: 'search', kbd: '⌘K' })}</div>
            <div class="kit-row kit-wrap">${['phone', 'mail', 'meeting', 'note', 'edit', 'link', 'more'].map((n) => ui.iconBtn(n, { label: n }))}${ui.kbd('⌘K')}${ui.kbd(['G', 'D'])}${ui.kbd('?')}</div>`)}
          ${section('fields', '欄位', '輸入框用凹陷底；焦點環 2px 松綠。', html`
            <div class="form-grid">
              ${ui.field({ label: '姓名', name: 'k-name', value: '陳怡君', required: true })}
              ${ui.field({ label: '公司', name: 'k-co', type: 'select', value: companies[0].id, options: companies.slice(0, 6).map((c) => ({ value: c.id, label: c.name })) })}
              ${ui.field({ label: '預計成交日', name: 'k-date', type: 'date', value: U.iso(U.addDays(U.today(), 21)) })}
              ${ui.field({ label: 'Email', name: 'k-mail', type: 'email', placeholder: 'name@company.com.tw', hint: '用公司網域' })}
              ${ui.field({ label: '內容', name: 'k-body', type: 'textarea', full: true, placeholder: '通話重點、下一步' })}
            </div>
            <div class="kit-row kit-wrap">${ui.checkbox({ label: '決策者', checked: true })}${ui.checkbox({ label: '技術窗口' })}${ui.checkbox({ label: '部分', indeterminate: true })}</div>
            <div class="kit-row kit-wrap">${ui.segmented({ name: 'k-view', value: 'board', options: [{ value: 'board', label: '看板', icon: 'board' }, { value: 'list', label: '清單', icon: 'list' }] })}${ui.segmented({ name: 'k-period', value: 'quarter', size: 'sm', options: [{ value: 'month', label: '本月' }, { value: 'quarter', label: '本季' }, { value: 'year', label: '今年' }] })}</div>
            ${ui.tabs({ name: 'k-tabs', value: 'timeline', items: [{ value: 'timeline', label: '往來', count: 24 }, { value: 'deals', label: '交易', count: 2 }, { value: 'tasks', label: '任務', count: 3 }] })}`)}
          ${section('icons', '圖示', '20 格線、1.6 描邊、圓頭；封閉形在左上角留一道提筆缺口。', html`
            <div class="kit-icons">${CRM.icons.names.map((n) => html`<div class="kit-icon" data-tip="${n}">${CRM.icon(n, { size: 20 })}<span>${n}</span></div>`)}</div>`, 2)}
          ${section('layers', '浮層', '選單、抽屜、對話框、命令面板與可復原的 toast。Esc 關閉最上層。', html`
            <div class="kit-row kit-wrap">
              ${ui.btn({ label: '選單', iconEnd: 'chevronDown', attrs: { 'data-kit': 'menu' } })}
              ${ui.btn({ label: '抽屜', attrs: { 'data-kit': 'drawer' } })}
              ${ui.btn({ label: '對話框', attrs: { 'data-kit': 'modal' } })}
              ${ui.btn({ label: '確認', attrs: { 'data-kit': 'confirm' } })}
              ${ui.btn({ label: 'Toast', attrs: { 'data-kit': 'toast' } })}
              ${ui.btn({ label: '命令面板', icon: 'search', kbd: '⌘K', attrs: { 'data-kit': 'palette' } })}
              ${ui.btn({ label: '記一筆表單', icon: 'activities', attrs: { 'data-kit': 'logform' } })}
              ${ui.btn({ label: '交易表單', icon: 'deals', attrs: { 'data-kit': 'dealform' } })}
              ${ui.btn({ label: '標記一筆成交', icon: 'check', variant: 'primary', attrs: { 'data-kit': 'won' } })}
            </div>
            <p class="t-13 t-3">成交入帳：金額從按鈕飛向頁首的「本季進度」，量尺填滿、總額滾動。可按 toast 的復原。</p>`, 2)}
        </div>

        <div class="kit-grid" data-group="data">
          ${section('table', '表格', '排序、全選、欄位對齊；手機寬度自動改成清單列。', html`<div class="kit-table panel"></div>`, 2)}
          ${section('charts', '圖表', '細線、4px 圓頭資料端、2px 表面間隔；每個標記都能 hover。', html`
            <div class="kit-row kit-wrap">${ui.sparkline(series, { w: 160, h: 36, label: '近 12 週往來次數', labels: series.map((_, i) => (i === series.length - 1 ? '本週' : `${series.length - 1 - i} 週前`)), format: (v) => v + ' 次' })}<span class="t-13 t-2">近 12 週往來（${me.name}）</span></div>
            <p class="label">業務達成率（已成交 ／ 缺口）</p>
            ${ui.barH(repRows, { format: (v) => U.moneyCompact(v), labelWidth: 56 })}
            <p class="label">Pipeline 各階段金額</p>
            ${ui.barH(funnel, { labelWidth: 72 })}`)}
          ${section('empty', '空狀態', '淡色正字只畫了第一筆。', html`<div class="panel">${ui.emptyState({ title: '這位聯絡人還沒有往來', body: '記下第一通電話或會議，劃記就會開始累積。', action: ui.btn({ label: '記一筆', icon: 'plus', variant: 'primary', size: 'sm', attrs: { 'data-kit': 'logform' } }) })}</div>`)}
        </div>`);
      el.appendChild(body);

      // 表格
      const rows = contacts.slice(0, 9);
      const tableEl = body.querySelector('.kit-table');
      const tbl = ui.table(tableEl, {
        selectable: true,
        rows,
        sort: { key: 'touches', dir: -1 },
        caption: '聯絡人',
        onRowClick: (r) => ui.toast(`開啟 ${r.name}（示範）`),
        onSelect: (ids) => { tableEl.dataset.selected = ids.length; },
        columns: [
          { key: 'name', label: '姓名', m: 'primary', sort: (r) => r.name, render: (r) => ui.personCell(r) },
          { key: 'company', label: '公司', m: 'hide', sort: (r) => (store.get('companies', r.companyId) || {}).name, render: (r) => (store.get('companies', r.companyId) || {}).name },
          { key: 'lifecycle', label: '生命週期', m: 'meta', sort: true, render: (r) => r.lifecycle },
          { key: 'touches', label: '近 30 天', m: 'meta', sort: (r) => store.touches({ contactId: r.id }), defaultDir: -1, render: (r) => ui.tally(store.touches({ contactId: r.id }), { key: 'contact:' + r.id }) },
          { key: 'warmth', label: '溫度', m: 'meta', sort: (r) => store.warmth({ contactId: r.id }).days ?? 999, render: (r) => ui.warmth(store.warmth({ contactId: r.id })) },
          { key: 'last', label: '最後往來', m: 'hide', sort: (r) => store.lastTouch({ contactId: r.id }) || '', render: (r) => ui.relTime(store.lastTouch({ contactId: r.id })) },
          { key: 'owner', label: '負責', m: 'hide', render: (r) => ui.nameBlock(r.owner, { size: 24 }) },
          { key: 'open', label: '進行中', align: 'right', m: 'end', sort: (r) => store.openDealsFor({ contactId: r.id }).reduce((s, d) => s + d.amount, 0), defaultDir: -1, render: (r) => { const v = store.openDealsFor({ contactId: r.id }).reduce((s, d) => s + d.amount, 0); return v ? ui.money(v, { compact: true }) : html`<span class="t-3">無</span>`; } },
        ],
      });
      const unsub = store.subscribe((evt) => { if (evt.has('activities', 'contacts', 'deals')) tbl.redraw(); });

      // 分組篩選
      body.previousElementSibling && el.querySelector('.ph').addEventListener('seg-change', (e) => {
        body.querySelectorAll('.kit-grid').forEach((g) => { g.hidden = e.detail.value !== 'all' && g.dataset.group !== e.detail.value; });
      });

      U.on(body, 'click', '[data-kit]', (e, b) => {
        const k = b.dataset.kit;
        if (k === 'bump') { const t = body.querySelector('.tally[data-key="kit:demo"]'); ui.bumpTally(t); }
        if (k === 'log') actions.logActivity({ type: 'call', contactId: hotContact.id, duration: 6, body: '確認報價內容，對方希望平台年約改成三年約' });
        if (k === 'redraw') body.querySelectorAll('.brand-mark').forEach((m) => ui.drawMark(m, { delay: 0 }));
        if (k === 'menu') ui.menu(b, [
          { heading: '移到階段' },
          ...store.OPEN_STAGES.map((s) => ({ label: s.name, lead: ui.stageTag(s.id, { label: ' ' }), checked: s.id === 'prop' })),
          { divider: true },
          { label: '編輯', icon: 'edit', kbd: 'E' },
          { label: '複製連結', icon: 'link' },
          { label: '刪除', icon: 'trash', danger: true },
        ], { onSelect: (it) => ui.toast(`選了「${it.label}」`) });
        if (k === 'drawer') {
          const d = store.all('deals').find((x) => x.stage === 'prop');
          const co = store.get('companies', d.companyId);
          ui.drawer({
            title: d.name, sub: html`<span class="t-mono">${d.code}</span> · ${co.name}`,
            body: html`<div class="stack-4"><div class="row-3">${ui.companyMark(co, { size: 40 })}<div><p class="t-display t-20">${ui.money(d.amount)}</p><p class="t-13 t-3">${ui.stageTag(d.stage)} · 預計 ${U.fmtDate(d.closeDate)} 成交</p></div></div>${ui.barH(d.items.map((it) => ({ label: store.product(it.sku).short, value: it.qty * it.price, color: 'var(--st-prop)' })), { labelWidth: 88 })}${ui.tally(store.touches({ dealId: d.id }, 90), { key: 'deal:' + d.id, size: 18 })}</div>`,
            footer: html`${ui.btn({ label: '標記未成', variant: 'quiet', attrs: { 'data-close': '' } })}${ui.btn({ label: '標記成交', variant: 'primary', icon: 'check', attrs: { 'data-close': '' } })}`,
          });
        }
        if (k === 'modal') ui.modal({ title: '未成原因', body: html`<div class="stack">${store.LOST_REASONS.map((r, i) => ui.checkbox({ label: r, checked: i === 0 }))}</div>`, size: 'sm', actions: [{ label: '取消', variant: 'quiet' }, { label: '標記未成', variant: 'primary' }] });
        if (k === 'confirm') ui.confirm({ title: '刪除這家公司？', body: '會一併刪除聯絡人、交易與往來紀錄，可以從通知復原。', confirmLabel: '刪除', danger: true }).then((ok) => ok && ui.toast('已刪除（示範）', { undo: () => {} }));
        if (k === 'toast') ui.toast('已記一筆通話：陳怡君', { undo: () => {} });
        if (k === 'palette') CRM.palette.open();
        if (k === 'logform') ui.logActivity({ contactId: hotContact.id });
        if (k === 'dealform') ui.create('deal', { companyId: companies[0].id });
        if (k === 'won') { const d = nego(); if (d) actions.moveDealStage(d.id, 'won', { sourceEl: b }); else ui.toast('沒有議價中的交易了'); }
      });

      this._unsub = unsub;
    },
    unmount() { this._unsub && this._unsub(); },
  };
})();
