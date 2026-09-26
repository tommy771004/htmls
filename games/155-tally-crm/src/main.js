/* main · 啟動：套用主題、建立外框、開始路由 */
(function () {
  'use strict';
  const CRM = window.CRM;
  CRM.theme.apply();
  const main = CRM.shell.build(document.getElementById('app'));
  CRM.router.start(main);
})();
