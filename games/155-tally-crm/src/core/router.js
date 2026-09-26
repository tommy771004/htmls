/* router · hash 路由 #/path?query 與主題
   頁面介面：CRM.pages.<name> = { route: RegExp, title, nav, mount(el, ctx), unmount?() } */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const U = CRM.util;
  CRM.pages = CRM.pages || {};

  /* ── theme ───────────────────────────────────────── */
  // 偏好：'light' | 'dark' | 'system'，存在 localStorage。URL 的 ?theme= 只影響這次瀏覽，不寫入偏好。
  const THEME_KEY = 'tally:theme';
  const theme = {
    session: null,
    get pref() {
      try { return localStorage.getItem(THEME_KEY) || 'system'; } catch (e) { return 'system'; }
    },
    set(pref) {
      theme.session = null;
      try { if (pref === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, pref); } catch (e) { /* 只在記憶體 */ }
      theme._mem = pref;
      theme.apply();
    },
    /** 實際套用的偏好（含本次瀏覽的覆寫） */
    get effectivePref() { return theme.session || theme._mem || theme.pref; },
    /** 目前畫面實際是深色嗎 */
    get isDark() {
      const p = theme.effectivePref;
      return p === 'dark' || (p === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    },
    apply() {
      const p = theme.effectivePref;
      const root = document.documentElement;
      if (p === 'light' || p === 'dark') root.dataset.theme = p;
      else delete root.dataset.theme;
      CRM.events && CRM.events.emit('theme', { pref: p, dark: theme.isDark });
    },
    _mem: null,
  };
  CRM.theme = theme;

  /* ── routing ─────────────────────────────────────── */
  let mountEl = null;
  let current = null;

  function parse(hash) {
    const h = (hash || '').replace(/^#/, '') || '/';
    const qi = h.indexOf('?');
    let path = (qi >= 0 ? h.slice(0, qi) : h) || '/';
    try { path = decodeURIComponent(path); } catch (e) { /* 保留原字串 */ }
    const query = Object.fromEntries(new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : ''));
    return { path: path.startsWith('/') ? path : '/' + path, query };
  }
  function resolve(path) {
    for (const [name, page] of Object.entries(CRM.pages)) {
      if (!page || !page.route) continue;
      const m = page.route.exec(path);
      if (m) return { name, page, params: m.slice(1) };
    }
    return null;
  }
  /** '#/deals?view=list'；theme 不寫進網址 */
  function href(path, query) {
    const q = new URLSearchParams();
    Object.entries(query || {}).forEach(([k, v]) => { if (v != null && v !== '' && k !== 'theme') q.set(k, v); });
    const qs = q.toString();
    return '#' + path + (qs ? '?' + qs : '');
  }
  function go(path, query) {
    const next = href(path, query);
    if (location.hash === next) handle();
    else location.hash = next;
  }
  /** 合併 query。{ silent:true } 只改網址不重新掛載頁面（頁面自己重繪）。 */
  function setQuery(patch, { silent = false, push = false } = {}) {
    if (!current) return;
    const query = { ...current.ctx.query, ...patch };
    Object.keys(query).forEach((k) => (query[k] == null || query[k] === '') && delete query[k]);
    const url = href(current.ctx.path, query);
    if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
    if (silent) { current.ctx.query = query; delete current.ctx.query.theme; return; }
    handle();
  }

  function handle() {
    const { path, query } = parse(location.hash);
    if (query.theme === 'dark' || query.theme === 'light') { theme.session = query.theme; }
    delete query.theme;
    theme.apply();

    let r = resolve(path);
    if (!r) r = resolve('/') || null;
    if (current && current.page.unmount) {
      try { current.page.unmount(); } catch (err) { console.error(err); }
    }
    const samePath = current && current.ctx.path === path;
    CRM.ui && CRM.ui.closeAll && CRM.ui.closeAll();
    mountEl.replaceChildren();
    if (!samePath) window.scrollTo(0, 0);
    if (!r) { mountEl.textContent = '找不到頁面'; return; }

    const ctx = {
      path, params: r.params, query, name: r.name,
      store: CRM.store, actions: CRM.actions, ui: CRM.ui, util: U, router: api, el: mountEl,
    };
    current = { ...r, ctx };
    const title = typeof r.page.title === 'function' ? r.page.title(ctx) : r.page.title;
    document.title = (title ? title + ' · ' : '') + '劃記 TALLY CRM';
    document.documentElement.dataset.page = r.name;
    CRM.events.emit('route', ctx);
    try {
      r.page.mount(mountEl, ctx);
    } catch (err) {
      console.error(err);
      mountEl.innerHTML = '<p style="padding:32px">這一頁載入時發生錯誤。</p>';
    }
    if (!window.CRM_READY) {
      window.CRM_READY = true;
      CRM.events.emit('ready', ctx);
    }
  }

  function start(el) {
    mountEl = el;
    window.addEventListener('hashchange', handle);
    handle();
  }

  const api = {
    start, go, href, setQuery, parse, resolve,
    get current() { return current ? current.ctx : null; },
    /** 重新掛載目前頁面 */
    refresh: () => handle(),
  };
  CRM.router = api;
})();
