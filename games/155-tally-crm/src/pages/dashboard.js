/* pages/dashboard · 佔位頁（之後由頁面代理替換） */
(function () {
  'use strict';
  const CRM = window.CRM;
  const { html } = CRM.util;

  CRM.pages.dashboard = {
    route: /^\/$/,
    title: '儀表板',
    nav: 'dashboard',
    mount(el, ctx) {
      const { ui } = ctx;
      el.appendChild(ui.pageHeader({ title: '儀表板' }));
      const body = document.createElement('div');
      body.className = 'page placeholder';
      body.innerHTML = String(html`<div class="panel placeholder-panel">${ui.emptyState({ title: '建構中', body: '今天的任務、本季預測、Pipeline 漏斗與業務活動量會在這裡。' })}</div>`);
      el.appendChild(body);
    },
  };
})();
