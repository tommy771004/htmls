/* pages/activities · 佔位頁（之後由頁面代理替換） */
(function () {
  'use strict';
  const CRM = window.CRM;
  const { html } = CRM.util;

  CRM.pages.activities = {
    route: /^\/activities$/,
    title: '活動紀錄',
    nav: 'activities',
    mount(el, ctx) {
      const { ui } = ctx;
      el.appendChild(ui.pageHeader({ title: '活動紀錄' }));
      const body = document.createElement('div');
      body.className = 'page placeholder';
      body.innerHTML = String(html`<div class="panel placeholder-panel">${ui.emptyState({ title: '建構中', body: '全域時間軸會在這裡。' })}</div>`);
      el.appendChild(body);
    },
  };
})();
