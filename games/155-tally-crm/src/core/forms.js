/* forms · 聯絡人、公司、交易（含報價品項）、任務的新增／編輯對話框，以及「記一筆」活動輸入器
   掛在 CRM.ui：create(kind, prefill)、edit(kind, id)、logActivity(ctx) */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const U = CRM.util;
  const { html, raw, h } = U;
  const ui = CRM.ui;
  const S = () => CRM.store;
  const icon = CRM.icon;

  const REGIONS = ['北區', '中區', '南區', '東區'];
  const repOptions = () => S().all('reps').map((r) => ({ value: r.id, label: r.name + (r.me ? '（我）' : '') }));
  const companyOptions = (blank = '（無）') => [{ value: '', label: blank }, ...U.sortBy(S().all('companies'), (c) => c.name).map((c) => ({ value: c.id, label: c.name }))];
  function contactOptions(companyId, blank = '（無）') {
    const list = companyId ? S().contactsOf(companyId) : S().all('contacts');
    return [{ value: '', label: blank }, ...list.map((c) => ({ value: c.id, label: companyId ? `${c.name}・${c.title}` : `${c.name}・${(S().get('companies', c.companyId) || {}).name || ''}` }))];
  }
  function selectOptions(select, opts, value) {
    select.innerHTML = opts.map((o) => `<option value="${U.esc(o.value)}"${String(o.value) === String(value || '') ? ' selected' : ''}>${U.esc(o.label)}</option>`).join('');
  }
  const industries = () => [...new Set(S().all('companies').map((c) => c.industry))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  /**
   * formModal({ title, body, submitLabel, onSubmit(data, form) }) → onSubmit 回傳字串時顯示錯誤、不關閉
   * data 由 FormData 組成；多選 checkbox 以同名陣列回傳。
   */
  function formModal({ title, sub = '', body, submitLabel = '儲存', onSubmit, size = 'md', danger } = {}) {
    const form = h(html`<form class="form" novalidate>${body}<p class="form-error" role="alert" hidden></p><button type="submit" hidden></button></form>`);
    const actions = [];
    if (danger) actions.push({ label: danger.label, variant: 'danger', icon: 'trash', onClick: () => { danger.run(); } });
    actions.push({ label: '取消', variant: 'quiet' });
    actions.push({ label: submitLabel, variant: 'primary', close: false, onClick: () => { form.requestSubmit(); return false; } });
    const m = ui.modal({ title, sub, body: form, actions, size, cls: 'modal--form' });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {};
      for (const [k, v] of fd.entries()) {
        if (k.endsWith('[]')) (data[k.slice(0, -2)] = data[k.slice(0, -2)] || []).push(v);
        else data[k] = typeof v === 'string' ? v.trim() : v;
      }
      const missing = [...form.querySelectorAll('[required]')].find((i) => !String(i.value).trim());
      const err = form.querySelector('.form-error');
      if (missing) {
        err.textContent = '請填寫「' + (form.querySelector(`label[for="${missing.id}"]`) || { textContent: '必填欄位' }).textContent.replace('＊', '') + '」';
        err.hidden = false;
        missing.focus();
        return;
      }
      const r = onSubmit(data, form);
      if (typeof r === 'string') { err.textContent = r; err.hidden = false; return; }
      m.close();
    });
    return { modal: m, form };
  }

  /* ── 聯絡人 ───────────────────────────────────── */
  function contactForm(prefill = {}, id = null) {
    const c = id ? S().get('contacts', id) : null;
    const v = { name: '', companyId: '', title: '', email: '', mobile: '', owner: S().me().id, lifecycle: '潛在', tags: [], reportsTo: '', ...(c || {}), ...prefill };
    const body = html`<div class="form-grid">
      ${ui.field({ label: '姓名', name: 'name', value: v.name, required: true, attrs: { autofocus: true, autocomplete: 'off' } })}
      ${ui.field({ label: '職稱', name: 'title', value: v.title, placeholder: '例如：設備課長' })}
      ${ui.field({ label: '公司', name: 'companyId', type: 'select', value: v.companyId, options: companyOptions() })}
      ${ui.field({ label: '直屬主管', name: 'reportsTo', type: 'select', value: v.reportsTo || '', options: contactOptions(v.companyId).filter((o) => o.value !== id) })}
      ${ui.field({ label: 'Email', name: 'email', type: 'email', value: v.email, placeholder: 'name@company.com.tw' })}
      ${ui.field({ label: '手機', name: 'mobile', type: 'tel', value: v.mobile, placeholder: '09xx-xxx-xxx' })}
      ${ui.field({ label: '負責業務', name: 'owner', type: 'select', value: v.owner, options: repOptions() })}
      ${ui.field({ label: '生命週期', name: 'lifecycle', type: 'select', value: v.lifecycle, options: S().LIFECYCLES })}
      <fieldset class="field field--full"><legend class="field-label">標籤</legend><div class="check-row">${S().TAGS.map((t) => ui.checkbox({ label: t, checked: v.tags.includes(t), attrs: { name: 'tags[]', value: t } }))}</div></fieldset>
    </div>`;
    const { form } = formModal({
      title: c ? '編輯聯絡人' : '新增聯絡人',
      body,
      submitLabel: c ? '儲存' : '新增聯絡人',
      danger: c ? { label: '刪除', run: () => CRM.actions.deleteRecord('contacts', c.id) } : null,
      onSubmit(d) {
        const doc = { name: d.name, surname: d.name[0], title: d.title, companyId: d.companyId || null, reportsTo: d.reportsTo || null, email: d.email, mobile: d.mobile, owner: d.owner, lifecycle: d.lifecycle, tags: d.tags || [] };
        if (c) { S().update('contacts', c.id, doc); ui.toast(`已更新「${doc.name}」`); }
        else {
          const created = S().create('contacts', { ...doc, level: 'low', phone: '', createdAt: U.iso(U.today()) });
          ui.toast(`已新增聯絡人「${created.name}」`, { action: { label: '開啟', fn: () => ui.openContact(created.id) } });
        }
      },
    });
    form.querySelector('[name="companyId"]').addEventListener('change', (e) => selectOptions(form.querySelector('[name="reportsTo"]'), contactOptions(e.target.value).filter((o) => o.value !== id), ''));
  }

  /* ── 公司 ─────────────────────────────────────── */
  function companyForm(prefill = {}, id = null) {
    const c = id ? S().get('companies', id) : null;
    const v = { name: '', short: '', industry: industries()[0], city: '', region: '北區', size: '', taxId: '', domain: '', owner: S().me().id, status: '潛在', ...(c || {}), ...prefill };
    const body = html`<div class="form-grid">
      ${ui.field({ label: '公司名稱', name: 'name', value: v.name, required: true, full: true, attrs: { autofocus: true, autocomplete: 'off' } })}
      ${ui.field({ label: '字塊簡稱', name: 'short', value: v.short, placeholder: '兩個字', hint: '公司字塊直排顯示的兩個字', attrs: { maxlength: 2 } })}
      ${ui.field({ label: '產業', name: 'industry', type: 'select', value: v.industry, options: industries() })}
      ${ui.field({ label: '城市', name: 'city', value: v.city, placeholder: '例如：台中市西屯區' })}
      ${ui.field({ label: '區域', name: 'region', type: 'select', value: v.region, options: REGIONS })}
      ${ui.field({ label: '員工數', name: 'size', type: 'number', value: v.size, attrs: { min: 1, inputmode: 'numeric' } })}
      ${ui.field({ label: '統一編號', name: 'taxId', value: v.taxId, attrs: { maxlength: 8, inputmode: 'numeric', pattern: '\\d{8}' } })}
      ${ui.field({ label: '網址', name: 'domain', value: v.domain, placeholder: 'example.com.tw' })}
      ${ui.field({ label: '負責業務', name: 'owner', type: 'select', value: v.owner, options: repOptions() })}
      ${ui.field({ label: '客戶狀態', name: 'status', type: 'select', value: v.status, options: S().COMPANY_STATUSES })}
    </div>`;
    formModal({
      title: c ? '編輯公司' : '新增公司',
      body,
      submitLabel: c ? '儲存' : '新增公司',
      danger: c ? { label: '刪除', run: () => CRM.actions.deleteRecord('companies', c.id) } : null,
      onSubmit(d) {
        if (d.taxId && !/^\d{8}$/.test(d.taxId)) return '統一編號要是 8 位數字';
        const doc = { name: d.name, short: (d.short || d.name.replace(/股份有限公司$/, '')).slice(0, 2), industry: d.industry, group: CRM.seed.GROUP_OF[d.industry] || 'building', city: d.city, region: d.region, size: +d.size || 0, taxId: d.taxId, domain: d.domain, owner: d.owner, status: d.status };
        if (c) { S().update('companies', c.id, doc); ui.toast(`已更新「${doc.name}」`); }
        else {
          const created = S().create('companies', { ...doc, phone: '', createdAt: U.iso(U.today()), history: [] });
          ui.toast(`已新增公司「${created.name}」`, { action: { label: '開啟', fn: () => ui.openCompany(created.id) } });
        }
      },
    });
  }

  /* ── 交易（含報價品項） ───────────────────────── */
  function lineRow(it, i) {
    return html`<div class="lines-row" data-line="${i}">
      <span class="select-wrap"><select class="input select" name="sku" aria-label="品項">${S().PRODUCTS.map((p) => html`<option value="${p.sku}"${p.sku === it.sku ? raw(' selected') : ''}>${p.sku}　${p.short}</option>`)}</select>${icon('chevronDown', { size: 16, cls: 'select-caret' })}</span>
      <input class="input t-right" name="qty" type="number" min="1" value="${it.qty}" aria-label="數量" inputmode="numeric">
      <input class="input t-right" name="price" type="number" min="0" step="100" value="${it.price}" aria-label="單價" inputmode="numeric">
      <span class="lines-total">${U.money(it.qty * it.price)}</span>
      ${ui.iconBtn('trash', { label: '移除品項', size: 'sm', attrs: { 'data-remove': i } })}
    </div>`;
  }
  function dealForm(prefill = {}, id = null) {
    const d = id ? S().get('deals', id) : null;
    const v = {
      name: '', companyId: '', contactIds: [], owner: S().me().id, stage: 'lead',
      closeDate: U.iso(U.addDays(U.today(), 60)),
      items: [{ sku: 'AQ-7', qty: 20, price: 6800 }, { sku: 'CL-Y', qty: 1, price: 96000 }],
      ...(d ? JSON.parse(JSON.stringify(d)) : {}), ...prefill,
    };
    let items = v.items.map((x) => ({ ...x }));
    const stageOpts = (d ? S().STAGES : S().OPEN_STAGES).map((s) => ({ value: s.id, label: s.name }));
    const body = html`<div class="form-grid">
      ${ui.field({ label: '交易名稱', name: 'name', value: v.name, required: true, full: true, placeholder: '例如：三號廠房振動監測', attrs: { autofocus: true, autocomplete: 'off' } })}
      ${ui.field({ label: '公司', name: 'companyId', type: 'select', value: v.companyId, options: companyOptions('請選擇公司'), required: true })}
      ${ui.field({ label: '主要聯絡人', name: 'contactId', type: 'select', value: v.contactIds[0] || '', options: contactOptions(v.companyId) })}
      ${ui.field({ label: '階段', name: 'stage', type: 'select', value: v.stage, options: stageOpts })}
      ${ui.field({ label: '預計成交日', name: 'closeDate', type: 'date', value: v.closeDate })}
      ${ui.field({ label: '負責業務', name: 'owner', type: 'select', value: v.owner, options: repOptions() })}
      <div class="field field--full">
        <p class="field-label">報價品項</p>
        <div class="lines"><div class="lines-head" aria-hidden="true"><span>品項</span><span class="t-right">數量</span><span class="t-right">單價</span><span class="t-right">小計</span><span></span></div><div class="lines-body"></div>
        <div class="lines-foot">${ui.btn({ label: '加一項', icon: 'plus', variant: 'quiet', size: 'sm', attrs: { 'data-add': '' } })}<span class="lines-sum">合計 <b class="lines-sum-val"></b></span></div></div>
      </div>
    </div>`;
    const { form } = formModal({
      title: d ? '編輯交易' : '新增交易',
      sub: d ? d.code : '',
      size: 'lg',
      body,
      submitLabel: d ? '儲存' : '新增交易',
      danger: d ? { label: '刪除', run: () => CRM.actions.deleteRecord('deals', d.id) } : null,
      onSubmit(f) {
        if (!items.length) return '至少要有一個報價品項';
        const doc = { name: f.name, companyId: f.companyId, owner: f.owner, closeDate: f.closeDate, items: items.map((x) => ({ sku: x.sku, qty: Math.max(1, +x.qty || 1), price: Math.max(0, +x.price || 0) })) };
        const primary = f.contactId || null;
        if (d) {
          const rest = d.contactIds.filter((x) => x !== primary && S().get('contacts', x) && S().get('contacts', x).companyId === f.companyId);
          S().batch(() => {
            S().update('deals', d.id, { ...doc, contactIds: primary ? [primary, ...rest] : rest });
            if (f.stage !== d.stage) CRM.actions.moveDealStage(d.id, f.stage, { silent: true });
          });
          ui.toast(`已更新「${doc.name}」`);
        } else {
          const year = U.today().getFullYear();
          const maxN = Math.max(0, ...S().all('deals').map((x) => parseInt(String(x.code).split('-')[2], 10) || 0));
          const today = U.iso(U.today());
          const created = S().create('deals', {
            ...doc, code: `Q-${year}-${String(maxN + 1).padStart(4, '0')}`, contactIds: primary ? [primary] : [], stage: f.stage,
            createdAt: today, closedAt: null, lostReason: null, next: '', history: [{ stage: f.stage, at: today }],
          });
          ui.toast(`已新增交易「${created.name}」`, { action: { label: '開啟', fn: () => ui.openDeal(created.id) } });
        }
      },
    });
    const bodyEl = form.querySelector('.lines-body');
    const sumEl = form.querySelector('.lines-sum-val');
    function drawLines() {
      bodyEl.innerHTML = String(html`${items.map((it, i) => lineRow(it, i))}`);
      sumEl.textContent = U.money(S().itemsTotal(items));
    }
    bodyEl.addEventListener('input', (e) => {
      const row = e.target.closest('[data-line]');
      if (!row) return;
      const it = items[+row.dataset.line];
      if (e.target.name === 'qty') it.qty = +e.target.value || 0;
      if (e.target.name === 'price') it.price = +e.target.value || 0;
      row.querySelector('.lines-total').textContent = U.money(it.qty * it.price);
      sumEl.textContent = U.money(S().itemsTotal(items));
    });
    bodyEl.addEventListener('change', (e) => {
      if (e.target.name !== 'sku') return;
      const row = e.target.closest('[data-line]');
      const it = items[+row.dataset.line];
      it.sku = e.target.value;
      it.price = S().product(it.sku).price;
      drawLines();
    });
    form.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (rm) { items.splice(+rm.dataset.remove, 1); drawLines(); return; }
      if (e.target.closest('[data-add]')) {
        const used = new Set(items.map((x) => x.sku));
        const p = S().PRODUCTS.find((x) => !used.has(x.sku)) || S().PRODUCTS[0];
        items.push({ sku: p.sku, qty: 1, price: p.price });
        drawLines();
        const rows = bodyEl.querySelectorAll('[data-line]');
        rows[rows.length - 1].querySelector('select').focus();
      }
    });
    form.querySelector('[name="companyId"]').addEventListener('change', (e) => selectOptions(form.querySelector('[name="contactId"]'), contactOptions(e.target.value), ''));
    drawLines();
  }

  /* ── 任務 ─────────────────────────────────────── */
  function taskForm(prefill = {}, id = null) {
    const t = id ? S().get('tasks', id) : null;
    const v = { title: '', due: U.iso(U.today()), dueTime: '', priority: 'normal', owner: S().me().id, contactId: '', dealId: '', ...(t || {}), ...prefill };
    const dealOpts = [{ value: '', label: '（無）' }, ...S().all('deals').filter(S().isOpen).map((d) => ({ value: d.id, label: `${d.name}・${(S().get('companies', d.companyId) || {}).name || ''}` }))];
    const body = html`<div class="form-grid">
      ${ui.field({ label: '任務', name: 'title', value: v.title, required: true, full: true, placeholder: '例如：打給陳怡君 確認報價', attrs: { autofocus: true, autocomplete: 'off' } })}
      ${ui.field({ label: '到期日', name: 'due', type: 'date', value: v.due })}
      ${ui.field({ label: '時間', name: 'dueTime', type: 'time', value: v.dueTime || '' })}
      <div class="field"><p class="field-label" id="lbl-pri">優先度</p>${ui.segmented({ name: 'priority', value: v.priority, label: '優先度', options: S().PRIORITIES.map((p) => ({ value: p.id, label: p.name })) })}<input type="hidden" name="priority" value="${v.priority}"></div>
      ${ui.field({ label: '負責業務', name: 'owner', type: 'select', value: v.owner, options: repOptions() })}
      ${ui.field({ label: '關聯聯絡人', name: 'contactId', type: 'select', value: v.contactId || '', options: contactOptions(null) })}
      ${ui.field({ label: '關聯交易', name: 'dealId', type: 'select', value: v.dealId || '', options: dealOpts })}
    </div>`;
    const { form } = formModal({
      title: t ? '編輯任務' : '新增任務',
      body,
      submitLabel: t ? '儲存' : '新增任務',
      danger: t ? { label: '刪除', run: () => CRM.actions.deleteRecord('tasks', t.id) } : null,
      onSubmit(f) {
        const contact = f.contactId ? S().get('contacts', f.contactId) : null;
        const deal = f.dealId ? S().get('deals', f.dealId) : null;
        const doc = { title: f.title, due: f.due || U.iso(U.today()), dueTime: f.dueTime || null, priority: f.priority, owner: f.owner, contactId: f.contactId || null, dealId: f.dealId || null, companyId: contact ? contact.companyId : deal ? deal.companyId : null };
        if (t) { S().update('tasks', t.id, doc); ui.toast('已更新任務'); }
        else { S().create('tasks', { ...doc, done: false, doneAt: null, createdAt: U.iso(U.today()) }); ui.toast(`已新增任務：${doc.title}`); }
      },
    });
    form.addEventListener('seg-change', (e) => { if (e.detail.name === 'priority') form.querySelector('input[name="priority"]').value = e.detail.value; });
  }

  /* ── 記一筆（活動輸入器） ─────────────────────── */
  const LOG_TYPES = [
    { value: 'call', label: '通話', icon: 'phone' },
    { value: 'email', label: 'Email', icon: 'mail' },
    { value: 'meeting', label: '會議', icon: 'meeting' },
    { value: 'note', label: '筆記', icon: 'note' },
  ];
  /** logActivity({ contactId, companyId, dealId, type }) → 對話框；送出即寫入並讓劃記多一筆 */
  function logActivityForm(ctx = {}) {
    const type = ctx.type || 'call';
    const fixedContact = ctx.contactId ? S().get('contacts', ctx.contactId) : null;
    const deal = ctx.dealId ? S().get('deals', ctx.dealId) : null;
    const companyId = ctx.companyId || (fixedContact && fixedContact.companyId) || (deal && deal.companyId) || '';
    const dealOpts = (coId) => [{ value: '', label: '（無）' }, ...S().all('deals').filter((d) => S().isOpen(d) && (!coId || d.companyId === coId)).map((d) => ({ value: d.id, label: d.name }))];
    const defaultContact = ctx.contactId || (deal && deal.contactIds[0]) || '';
    const body = html`<div class="form-grid">
      <div class="field field--full">${ui.segmented({ name: 'type', value: type, label: '活動類型', options: LOG_TYPES })}<input type="hidden" name="type" value="${type}"></div>
      ${ui.field({ label: '聯絡人', name: 'contactId', type: 'select', value: defaultContact, options: contactOptions(companyId || null, companyId ? '（公司層級）' : '請選擇') })}
      ${ui.field({ label: '關聯交易', name: 'dealId', type: 'select', value: ctx.dealId || '', options: dealOpts(companyId) })}
      ${ui.field({ label: '主旨', name: 'subject', value: '', cls: 'only-email', placeholder: '例如：報價單 Q-2026-0412' })}
      ${ui.field({ label: '地點', name: 'location', value: '', cls: 'only-meeting', placeholder: '例如：三樓會議室、視訊會議' })}
      ${ui.field({ label: '時長（分）', name: 'duration', type: 'number', value: type === 'meeting' ? 60 : 10, cls: 'only-call only-meeting', attrs: { min: 1, inputmode: 'numeric' } })}
      ${ui.field({ label: '內容', name: 'body', type: 'textarea', rows: 4, full: true, required: true, placeholder: '例如：對方要求比照去年報價打九五折，已回報主管', attrs: { autofocus: true } })}
    </div>`;
    const who = fixedContact ? fixedContact.name : deal ? deal.name : '';
    const { form } = formModal({
      title: '記一筆',
      sub: who,
      body,
      submitLabel: '記下',
      onSubmit(f) {
        if (!f.contactId && !companyId && !f.dealId) return '請選擇聯絡人或交易';
        const data = { type: f.type, contactId: f.contactId || null, dealId: f.dealId || null, companyId: companyId || null, body: f.body };
        if (f.type === 'email') data.subject = f.subject || '（無主旨）';
        if (f.type === 'meeting') { data.location = f.location; data.title = f.subject || '會議'; data.duration = +f.duration || 60; }
        if (f.type === 'call') data.duration = +f.duration || 5;
        if (!data.companyId && data.dealId) data.companyId = S().get('deals', data.dealId).companyId;
        CRM.actions.logActivity(data);
      },
    });
    form.dataset.type = type;
    form.addEventListener('seg-change', (e) => {
      if (e.detail.name !== 'type') return;
      form.dataset.type = e.detail.value;
      form.querySelector('input[name="type"]').value = e.detail.value;
      const dur = form.querySelector('[name="duration"]');
      if (e.detail.value === 'meeting' && +dur.value < 30) dur.value = 60;
      if (e.detail.value === 'call' && +dur.value >= 30) dur.value = 10;
    });
    if (!companyId) {
      form.querySelector('[name="contactId"]').addEventListener('change', (e) => {
        const c = S().get('contacts', e.target.value);
        selectOptions(form.querySelector('[name="dealId"]'), dealOpts(c ? c.companyId : null), '');
      });
    }
  }

  const FORMS = { contact: contactForm, company: companyForm, deal: dealForm, task: taskForm };
  /** create('deal', { companyId:'o03' }) */
  ui.create = (kind, prefill = {}) => (FORMS[kind] ? FORMS[kind](prefill, null) : null);
  /** edit('contact', 'c012') */
  ui.edit = (kind, id) => (FORMS[kind] ? FORMS[kind]({}, id) : null);
  ui.logActivity = (ctx = {}) => logActivityForm(ctx);
  CRM.forms = { formModal, contactForm, companyForm, dealForm, taskForm, logActivityForm, LOG_TYPES, contactOptions, companyOptions, repOptions };
})();
