/* pages/deals · 佔位頁（之後由頁面代理替換） */
(function () {
  'use strict';
  const CRM = window.CRM;
  const { html } = CRM.util;

  CRM.pages.deals = {
    route: /^\/deals(?:\/([\w-]+))?$/,
    title: 'Pipeline',
    nav: 'deals',
    mount(el, ctx) {
      const { ui } = ctx;
      el.appendChild(ui.pageHeader({ title: 'Pipeline' }));
      const body = document.createElement('div');
      body.className = 'page placeholder';
      body.innerHTML = String(html`<div class="panel placeholder-panel">${ui.emptyState({ title: '建構中', body: '七欄看板、清單檢視與交易抽屜會在這裡。' })}</div>`);
      el.appendChild(body);
    },
  };
})();
