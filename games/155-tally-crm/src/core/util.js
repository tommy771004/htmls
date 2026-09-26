/* util · html templating, formatters, dates, PRNG, small helpers */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});

  /* ── html ─────────────────────────────────────────── */
  // Raw 是「已經安全的 HTML」。html`` 會把插值自動跳脫，Raw 與陣列則原樣接上。
  class Raw {
    constructor(s) { this.s = s; }
    toString() { return this.s; }
  }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  const raw = (s) => (s instanceof Raw ? s : new Raw(s == null ? '' : String(s)));
  function part(v) {
    if (v == null || v === false || v === true) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(part).join('');
    return esc(v);
  }
  function html(strings, ...vals) {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
    return new Raw(out);
  }
  /** Raw / string → Element（單一根）或 DocumentFragment（多根）。 */
  function h(markup) {
    const t = document.createElement('template');
    t.innerHTML = String(markup).trim();
    return t.content.childElementCount === 1 && t.content.childNodes.length === 1 ? t.content.firstElementChild : t.content;
  }
  /** 把 Raw / string / Node 放進容器（取代原內容）。 */
  function render(el, view) {
    if (view instanceof Node) el.replaceChildren(view);
    else el.innerHTML = part(view);
    return el;
  }
  /** 事件委派：on(root, 'click', '[data-act]', (e, match) => …) */
  function on(root, type, selector, fn, opts) {
    const handler = (e) => {
      const m = e.target instanceof Element && e.target.closest(selector);
      if (m && root.contains(m)) fn(e, m);
    };
    root.addEventListener(type, handler, opts);
    return () => root.removeEventListener(type, handler, opts);
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ── numbers & money ─────────────────────────────── */
  const nf = new Intl.NumberFormat('en-US');
  const num = (n) => nf.format(Math.round(n || 0));
  /** NT$1,280,000 */
  const money = (n) => (n < 0 ? '-' : '') + 'NT$' + nf.format(Math.round(Math.abs(n || 0)));
  /** 緊湊金額：128 萬、18.5 萬、2,712 萬、1.2 億；未滿萬顯示 6,800 */
  function moneyCompact(n, { unit = true } = {}) {
    const a = Math.abs(n || 0);
    const sign = n < 0 ? '-' : '';
    let v, u;
    if (a >= 1e8) { v = a / 1e8; u = '億'; v = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10; }
    else if (a >= 1e4) { v = a / 1e4; u = '萬'; v = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10; }
    else return sign + nf.format(Math.round(a));
    return sign + nf.format(v) + (unit ? ' ' + u : '');
  }
  const pct = (x, digits = 0) => (isFinite(x) ? (x * 100).toFixed(digits) : '0') + '%';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (f(x) || 0), 0);

  /* ── dates（本地時間；字串格式 YYYY-MM-DD 或 YYYY-MM-DDTHH:MM） ── */
  const pad = (n) => String(n).padStart(2, '0');
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function parse(v) {
    if (v instanceof Date) return new Date(v.getTime());
    if (typeof v === 'number') return new Date(v);
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(v);
    if (!m) return new Date(v);
    return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  }
  const startOfDay = (d) => { const x = parse(d); x.setHours(0, 0, 0, 0); return x; };
  const today = () => startOfDay(new Date());
  const iso = (d) => { const x = parse(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
  const isoDT = (d) => { const x = parse(d); return `${iso(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
  const addDays = (d, n) => { const x = parse(d); x.setDate(x.getDate() + n); return x; };
  /** 日曆天差：b - a（以日為單位，忽略時刻） */
  const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
  /** 距今天幾天：正數為未來 */
  const daysFromToday = (d) => daysBetween(today(), d);
  /** 週一為一週起點 */
  const startOfWeek = (d) => { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
  function quarterOf(d = new Date()) {
    const x = parse(d);
    const q = Math.floor(x.getMonth() / 3);
    const start = new Date(x.getFullYear(), q * 3, 1);
    const end = new Date(x.getFullYear(), q * 3 + 3, 0);
    return { y: x.getFullYear(), q: q + 1, start, end, label: `${x.getFullYear()} Q${q + 1}`, key: `${x.getFullYear()}Q${q + 1}` };
  }
  const time = (d) => { const x = parse(d); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };
  const hasTime = (s) => typeof s === 'string' && /T\d{2}:\d{2}/.test(s);
  const weekday = (d) => '週' + WEEK[parse(d).getDay()];
  /** 9/12；跨年時 2025/9/12 */
  function fmtDate(d) {
    const x = parse(d);
    const md = `${x.getMonth() + 1}/${x.getDate()}`;
    return x.getFullYear() === new Date().getFullYear() ? md : `${x.getFullYear()}/${md}`;
  }
  const fmtDateLong = (d) => { const x = parse(d); return `${x.getFullYear()} 年 ${x.getMonth() + 1} 月 ${x.getDate()} 日 ${weekday(x)}`; };
  /** 相對時間：今天、昨天、明天、3 天前、週四、下週二、9/12。{ time:true } 會附上時刻。 */
  function relTime(d, { time: withTime = false } = {}) {
    if (!d) return '';
    const x = parse(d);
    const diff = daysFromToday(x);
    let s;
    if (diff === 0) s = '今天';
    else if (diff === -1) s = '昨天';
    else if (diff === 1) s = '明天';
    else if (diff < 0 && diff >= -6) s = `${-diff} 天前`;
    else if (diff > 0) {
      const wk = daysBetween(startOfWeek(today()), startOfWeek(x)) / 7;
      if (wk === 0) s = weekday(x);
      else if (wk === 1) s = '下' + weekday(x);
      else s = fmtDate(x);
    } else s = fmtDate(x);
    return withTime && hasTime(d) ? `${s} ${time(x)}` : s;
  }
  /** 持續時間：35 分、1 小時 20 分 */
  const duration = (min) => (min >= 60 ? `${Math.floor(min / 60)} 小時${min % 60 ? ' ' + (min % 60) + ' 分' : ''}` : `${min} 分`);

  /* ── PRNG（mulberry32） ──────────────────────────── */
  function rng(seed = 1) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const r = {
      next,
      /** 整數 [a, b] */
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      float: (lo, hi) => lo + next() * (hi - lo),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      shuffle(arr) {
        const a2 = arr.slice();
        for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; }
        return a2;
      },
      /** weighted([[value, weight], …]) */
      weighted(pairs) {
        const total = pairs.reduce((s, p) => s + p[1], 0);
        let x = next() * total;
        for (const [v, w] of pairs) { if ((x -= w) < 0) return v; }
        return pairs[pairs.length - 1][0];
      },
    };
    return r;
  }

  /* ── misc ─────────────────────────────────────────── */
  function debounce(fn, ms = 150) {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    return d;
  }
  let uidN = 0;
  const uid = (prefix = 'x') => prefix + Date.now().toString(36).slice(-5) + (uidN++).toString(36);
  const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  const sortBy = (arr, f, dir = 1) => arr.slice().sort((a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia && matchMedia('(max-width: 760px)').matches;
  /** 事件發生在輸入元件內（快捷鍵要略過） */
  const isTyping = (e) => { const t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); };

  CRM.util = {
    Raw, html, raw, esc, h, render, on, $, $$,
    num, money, moneyCompact, pct, clamp, sum,
    parse, today, startOfDay, iso, isoDT, addDays, daysBetween, daysFromToday, startOfWeek, quarterOf,
    time, hasTime, weekday, fmtDate, fmtDateLong, relTime, duration,
    rng, debounce, uid, groupBy, sortBy, reducedMotion, isMobile, isTyping,
  };
})();
