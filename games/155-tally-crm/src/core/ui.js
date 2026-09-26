/* ui · 全部頁面共用的元件
   純呈現元件回傳 Raw（可直接放進 html``）；互動元件（menu、drawer、modal、toast、table）是命令式 API。 */
(function () {
  'use strict';
  const CRM = (window.CRM = window.CRM || {});
  const U = CRM.util;
  const { html, raw, esc, h } = U;
  const icon = CRM.icon;
  const store = () => CRM.store;

  /** { 'data-id': 1, disabled: true } → Raw 屬性字串 */
  function attrs(obj) {
    if (!obj) return raw('');
    return raw(Object.entries(obj).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join(''));
  }

  /* ════════ 基本控制項 ════════ */

  /** btn({ label, icon, variant:'primary'|'tonal'|'quiet'|'danger', size:'sm'|'md', kbd, attrs }) */
  function btn({ label = '', icon: ic, iconEnd, variant = 'tonal', size = 'md', kbd: k, attrs: a, type = 'button', disabled, cls = '' } = {}) {
    return html`<button type="${type}" class="btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''}${cls ? ' ' + cls : ''}"${attrs({ disabled, ...a })}>${ic ? icon(ic, { size: size === 'sm' ? 16 : 18 }) : ''}${label ? html`<span>${label}</span>` : ''}${iconEnd ? icon(iconEnd, { size: 16 }) : ''}${k ? kbd(k) : ''}</button>`;
  }
  /** iconBtn('more', { label:'更多', attrs }) → 只有圖示的按鈕，label 做 aria-label 與提示 */
  function iconBtn(name, { label = '', attrs: a, size = 'md', cls = '', tip = true } = {}) {
    return html`<button type="button" class="icon-btn${size === 'sm' ? ' icon-btn--sm' : ''}${cls ? ' ' + cls : ''}" aria-label="${label}"${tip && label ? attrs({ 'data-tip': label }) : ''}${attrs(a)}>${icon(name, { size: size === 'sm' ? 16 : 18 })}</button>`;
  }
  /** kbd('⌘K') 或 kbd(['g','d']) */
  function kbd(keys) {
    const list = Array.isArray(keys) ? keys : String(keys).match(/⌘|⇧|⌥|⌃|Ctrl|Esc|Enter|Tab|↑|↓|←|→|./g) || [];
    return html`<span class="kbd-group">${list.map((k) => html`<kbd class="kbd">${k}</kbd>`)}</span>`;
  }

  /** field({ label, name, type, value, options, placeholder, hint, required, rows, attrs, full }) */
  function field({ label, name, type = 'text', value = '', options = [], placeholder = '', hint = '', required, rows = 3, attrs: a, full, cls = '', id } = {}) {
    const fid = id || 'f-' + (name || U.uid('f'));
    let control;
    if (type === 'textarea') control = html`<textarea class="input textarea" id="${fid}" name="${name}" rows="${rows}" placeholder="${placeholder}"${attrs({ required, ...a })}>${value}</textarea>`;
    else if (type === 'select') {
      const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
      control = html`<span class="select-wrap"><select class="input select" id="${fid}" name="${name}"${attrs({ required, ...a })}>${opts.map((o) => html`<option value="${o.value}"${String(o.value) === String(value) ? raw(' selected') : ''}>${o.label}</option>`)}</select>${icon('chevronDown', { size: 16, cls: 'select-caret' })}</span>`;
    } else control = html`<input class="input" id="${fid}" name="${name}" type="${type}" value="${value}" placeholder="${placeholder}"${attrs({ required, ...a })}>`;
    return html`<div class="field${full ? ' field--full' : ''}${cls ? ' ' + cls : ''}">${label ? html`<label class="field-label" for="${fid}">${label}${required ? html`<span class="field-req" aria-hidden="true">＊</span>` : ''}</label>` : ''}${control}${hint ? html`<p class="field-hint">${hint}</p>` : ''}</div>`;
  }
  /** checkbox({ checked, label, attrs, indeterminate }) */
  function checkbox({ checked, label = '', attrs: a, indeterminate, cls = '' } = {}) {
    return html`<label class="check${cls ? ' ' + cls : ''}"><input type="checkbox"${attrs({ checked, 'data-indeterminate': indeterminate ? '1' : null, ...a })}><span class="check-box" aria-hidden="true">${icon('check', { size: 14 })}<i class="check-dash"></i></span>${label ? html`<span class="check-label">${label}</span>` : ''}</label>`;
  }
  /** segmented({ name, value, options:[{ value, label, icon }] }) → 點選時在根元素發出 'seg-change' {name, value} */
  function segmented({ name, value, options = [], size = 'md', label = '', cls = '' } = {}) {
    return html`<div class="seg${size === 'sm' ? ' seg--sm' : ''}${cls ? ' ' + cls : ''}" role="radiogroup" data-seg="${name}"${label ? attrs({ 'aria-label': label }) : ''}>${options.map((o) => {
      const on = String(o.value) === String(value);
      return html`<button type="button" role="radio" aria-checked="${String(on)}" tabindex="${on ? 0 : -1}" data-value="${o.value}"${o.icon && !o.label ? attrs({ 'aria-label': o.title || o.value, 'data-tip': o.title }) : ''}>${o.icon ? icon(o.icon, { size: 16 }) : ''}${o.label ? html`<span>${o.label}</span>` : ''}</button>`;
    })}</div>`;
  }
  /** tabs({ name, value, items:[{ value, label, count }] }) → 發出 'tab-change' {name, value} */
  function tabs({ name, value, items = [], cls = '' } = {}) {
    return html`<div class="tabs${cls ? ' ' + cls : ''}" role="tablist" data-tabs="${name}">${items.map((t) => {
      const on = String(t.value) === String(value);
      return html`<button type="button" role="tab" aria-selected="${String(on)}" tabindex="${on ? 0 : -1}" data-value="${t.value}"><span>${t.label}</span>${t.count != null ? html`<span class="tabs-count">${t.count}</span>` : ''}</button>`;
    })}</div>`;
  }

  /* ════════ 記號：人名字塊、公司字塊、溫度、階段、金額 ════════ */

  const isRep = (p) => p && typeof p.id === 'string' && /^u\d/.test(p.id);
  const resolvePerson = (p) => (typeof p === 'string' ? store().get(/^u/.test(p) ? 'reps' : 'contacts', p) : p);
  /** 依名字挑一個固定的平塗色調（1–8） */
  function toneOf(key) {
    let h = 0;
    for (const ch of String(key || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return (h % 8) + 1;
  }
  /** nameBlock(contactOrRep, { size }) → 圓形頭像刻姓氏；色調依名字固定，業務多一圈細環 */
  function nameBlock(person, { size = 28, title = true, cls = '' } = {}) {
    const p = resolvePerson(person);
    if (!p) return html`<span class="nb nb--empty" style="--nb:${size}px" aria-hidden="true"></span>`;
    const ch = p.surname || (p.name || '?')[0];
    return html`<span class="nb tone-${toneOf(p.name)}${isRep(p) ? ' nb--rep' : ''}${cls ? ' ' + cls : ''}" style="--nb:${size}px"${title ? attrs({ title: p.name }) : ''} aria-hidden="true"><span class="nb-ch">${ch}</span></span>`;
  }
  /** companyMark(company, { size }) → 方形標誌塊，取公司簡稱第一字 */
  function companyMark(company, { size = 24, title = true, cls = '' } = {}) {
    const c = typeof company === 'string' ? store().get('companies', company) : company;
    if (!c) return html`<span class="cm cm--empty" style="--cm:${size}px" aria-hidden="true"></span>`;
    const s = c.short || c.name.slice(0, 2);
    return html`<span class="cm tone-${toneOf(c.name)}${cls ? ' ' + cls : ''}" style="--cm:${size}px"${title ? attrs({ title: c.name }) : ''} aria-hidden="true">${s[0]}</span>`;
  }
  /** activityBars([週往來次數…], { max }) → 近 N 週的小長條，最後一格是本週 */
  function activityBars(series, { max, label = '', cls = '' } = {}) {
    const top = max || Math.max(3, ...series);
    const bars = series.map((v, i) => `<i style="height:${v ? Math.max(18, Math.round((v / top) * 100)) : 0}%"${i === series.length - 1 ? ' class="is-now"' : ''}></i>`).join('');
    return raw(`<span class="abars${cls ? ' ' + cls : ''}" role="img" aria-label="${esc(label || '近 ' + series.length + ' 週往來 ' + series.join('、'))}">${bars}</span>`);
  }
  /**
   * statCard({ label, value, unit, icon, tone:1-8, delta:{ text, dir:'up'|'down'|'flat' }, foot, spark:[…], href })
   * 頁首下方的統計卡：標籤＋色塊圖示、大數字、變化與小走勢。
   */
  function statCard({ label, value, unit = '', icon: ic, tone = 1, delta, foot = '', spark, href, attrs: a } = {}) {
    const inner = html`<span class="stat-label">${label}</span>${ic ? html`<span class="stat-ic tone-${tone}" aria-hidden="true">${icon(ic, { size: 20 })}</span>` : ''}<span class="stat-value">${value}${unit ? html`<span class="stat-unit">${unit}</span>` : ''}</span><span class="stat-foot">${delta ? html`<span class="delta delta--${delta.dir || 'flat'}">${delta.dir === 'up' ? '↑' : delta.dir === 'down' ? '↓' : ''}${delta.text}</span>` : ''}<span class="t-ellipsis">${foot}</span>${spark ? sparkline(spark, { w: 72, h: 24, label: label + '走勢' }) : ''}</span>`;
    return href ? html`<a class="stat" href="${href}"${attrs(a)}>${inner}</a>` : html`<div class="stat"${attrs(a)}>${inner}</div>`;
  }
  /** tag('客戶', 'mint', { dot:true }) → 粉彩膠囊 */
  function tag(label, tone = '', { dot = false, cls = '' } = {}) {
    return html`<span class="tag${tone ? ' tag--' + tone : ''}${cls ? ' ' + cls : ''}">${dot ? html`<i></i>` : ''}${label}</span>`;
  }
  /** warmth(level | warmthObj, { label:true }) → 四格刻度 */
  function warmth(w, { label = true, cls = '' } = {}) {
    const W = store().WARMTH;
    const obj = typeof w === 'string' ? W.find((x) => x.id === w || x.label === w) || W[3] : w || W[3];
    const tip = obj.days == null ? `${obj.label}：尚無往來` : `${obj.label}：${obj.days === 0 ? '今天' : obj.days + ' 天前'}往來`;
    return html`<span class="warmth${cls ? ' ' + cls : ''}" data-lvl="${obj.id}" data-tip="${tip}" role="img" aria-label="關係溫度 ${tip}"><span class="warmth-bar" aria-hidden="true">${[1, 2, 3, 4].map((i) => html`<i class="${i <= obj.lit ? 'on' : ''}"></i>`)}</span>${label ? html`<span class="warmth-label">${obj.label}</span>` : ''}</span>`;
  }
  /** stageTag('poc') → 色點＋文字 */
  function stageTag(id, { label, cls = '' } = {}) {
    const s = store().stage(id);
    if (!s) return raw('');
    return html`<span class="stage-tag${cls ? ' ' + cls : ''}" data-stage="${s.id}"><i style="background:${raw(s.color)}"></i><span>${label || s.name}</span></span>`;
  }
  /** money(1280000) → NT$1,280,000；{ compact:true } → 128 萬；{ lost:true } 穿過字身中央的刪除線 */
  function money(n, { compact = false, lost = false, cls = '' } = {}) {
    const text = compact ? U.moneyCompact(n) : U.money(n);
    return html`<span class="money${lost ? ' money--lost' : ''}${cls ? ' ' + cls : ''}"${compact ? attrs({ title: U.money(n) }) : ''}>${text}</span>`;
  }
  /** relTime('2026-09-23T14:00', { time:true }) → <time>3 天前 14:00</time> */
  function relTime(d, { time = false, cls = '' } = {}) {
    if (!d) return raw('');
    return html`<time class="rel${cls ? ' ' + cls : ''}" datetime="${d}" title="${U.fmtDateLong(d)}${U.hasTime(d) ? ' ' + U.time(d) : ''}">${U.relTime(d, { time })}</time>`;
  }
  /** due(task.due, task.dueTime, { done }) → 逾期柿色、今天赭色 */
  function due(date, dueTime, { done = false } = {}) {
    if (!date) return raw('');
    const diff = U.daysFromToday(date);
    const tone = done ? '' : diff < 0 ? 'is-overdue' : diff === 0 ? 'is-today' : '';
    const text = U.relTime(date) + (dueTime ? ' ' + dueTime : '');
    return html`<time class="due ${tone}" datetime="${date}" title="${U.fmtDateLong(date)}">${diff < 0 && !done ? html`<span class="sr-only">逾期 </span>` : ''}${text}</time>`;
  }
  /** personCell(contact, { sub }) → 字塊＋姓名＋職稱（清單常用） */
  function personCell(person, { sub, size = 28, href } = {}) {
    const p = resolvePerson(person);
    if (!p) return html`<span class="t-3">已刪除</span>`;
    const co = p.companyId ? store().get('companies', p.companyId) : null;
    const line2 = sub != null ? sub : isRep(p) ? p.title : [p.title, co && co.name].filter(Boolean).join(' · ');
    const nameEl = href ? html`<a class="cell-name" href="${href}">${p.name}</a>` : html`<span class="cell-name">${p.name}</span>`;
    return html`<span class="cell-person">${nameBlock(p, { size })}<span class="cell-text">${nameEl}${line2 ? html`<span class="cell-sub">${line2}</span>` : ''}</span></span>`;
  }
  /** companyCell(company, { sub }) */
  function companyCell(company, { sub, size = 30, href } = {}) {
    const c = typeof company === 'string' ? store().get('companies', company) : company;
    if (!c) return html`<span class="t-3">已刪除</span>`;
    const line2 = sub != null ? sub : `${c.industry} · ${c.city.slice(0, 3)}`;
    const nameEl = href ? html`<a class="cell-name" href="${href}">${c.name}</a>` : html`<span class="cell-name">${c.name}</span>`;
    return html`<span class="cell-person">${companyMark(c, { size })}<span class="cell-text">${nameEl}<span class="cell-sub">${line2}</span></span></span>`;
  }

  /* ════════ 劃記 ════════ */

  // 正字五筆（20×20）：上橫、中豎、右短橫、左短豎、底橫。每筆都有方向，描邊動畫依筆順。
  const STROKES = [
    [3.5, 3.5, 16.5, 3.5],
    [10, 3.5, 10, 16.5],
    [10, 10, 15, 10],
    [5.5, 9.5, 5.5, 16.5],
    [2.5, 16.5, 17.5, 16.5],
  ];
  const OVER = 1.3; // 筆尖超出再收回的長度
  function strokePath(i, over = OVER) {
    const [x1, y1, x2, y2] = STROKES[i];
    const L = Math.hypot(x2 - x1, y2 - y1);
    const ex = x2 + ((x2 - x1) / L) * over;
    const ey = y2 + ((y2 - y1) / L) * over;
    const P = L + over;
    return { d: `M${x1} ${y1}L${+ex.toFixed(2)} ${+ey.toFixed(2)}`, P, L };
  }
  function glyph(count, { size, newFrom = Infinity, offset = 0 } = {}) {
    let paths = '';
    for (let i = 0; i < count; i++) {
      const { d, P } = strokePath(i);
      const isNew = offset + i >= newFrom;
      paths += `<path class="tally-s${isNew ? ' is-new' : ''}" d="${d}" style="stroke-dasharray:${P.toFixed(2)} ${P.toFixed(2)};stroke-dashoffset:${OVER}"/>`;
    }
    return `<svg class="tally-g" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true">${paths}</svg>`;
  }
  /**
   * tally(n, { accent, key, size, label }) → 正字劃記。
   * accent：最後幾筆用柿色（當期新增）；key：'contact:c012' 等，記一筆時自動多畫一筆。
   * n > 25 時顯示數字加一個滿格正字。
   */
  function tally(n, { accent = 0, key = '', size = 16, label = '', cls = '', showZero = true } = {}) {
    n = Math.max(0, Math.floor(n || 0));
    const newFrom = n - accent;
    let inner = '';
    if (n === 0) inner = showZero ? `<span class="tally-zero">0</span>` : '';
    else if (n > 25) inner = `<span class="tally-num">${n}</span>` + glyph(5, { size, newFrom: accent ? 0 : Infinity });
    else {
      const full = Math.floor(n / 5);
      for (let g = 0; g < full; g++) inner += glyph(5, { size, newFrom, offset: g * 5 });
      if (n % 5) inner += glyph(n % 5, { size, newFrom, offset: full * 5 });
    }
    const aria = label || `${n} 次`;
    return raw(`<span class="tally${cls ? ' ' + cls : ''}" role="img" aria-label="${esc(aria)}" data-n="${n}" data-accent="${accent}" data-size="${size}"${key ? ` data-key="${esc(key)}"` : ''} data-t="${performance.now().toFixed(1)}">${inner}</span>`);
  }
  /** 讓某個劃記元素的最後一筆以描邊動畫畫出（柿色） */
  function animateTallyStroke(el) {
    const paths = el.querySelectorAll('.tally-s');
    const last = paths[paths.length - 1];
    if (!last) return;
    last.classList.add('is-new');
    if (U.reducedMotion() || !last.animate) return;
    const P = parseFloat(last.style.strokeDasharray) || 10;
    last.animate(
      [{ strokeDashoffset: P }, { strokeDashoffset: 0, offset: 0.72 }, { strokeDashoffset: OVER }],
      { duration: 380, easing: 'cubic-bezier(.3,.6,.35,1)' },
    );
  }
  /** 劃記元素原地多一筆並播放動畫 */
  function bumpTally(el) {
    const n = +el.dataset.n + 1;
    const accent = Math.min(n, +el.dataset.accent + 1);
    const next = h(tally(n, { accent, key: el.dataset.key || '', size: +el.dataset.size || 16, cls: [...el.classList].filter((c) => c !== 'tally').join(' ') }));
    el.replaceWith(next);
    if (n <= 25) animateTallyStroke(next);
    return next;
  }
  // 記一筆活動後，畫面上對應的劃記多畫一筆
  CRM.events.on('tally', ({ keys, at }) => {
    requestAnimationFrame(() => {
      const seen = new Set();
      keys.forEach((k) => {
        document.querySelectorAll(`.tally[data-key~="${CSS.escape(k)}"]`).forEach((el) => {
          if (seen.has(el)) return;
          seen.add(el);
          // 在事件之前就渲染的元素還沒包含新筆畫：原地加一筆；之後重繪的只要播放最後一筆
          if (+el.dataset.t < at) bumpTally(el);
          else if (+el.dataset.n <= 25) animateTallyStroke(el);
        });
      });
    });
  });

  /** 品牌記號：五筆正字。drawMark(svg) 依筆順描出（筆畫本來就在）。 */
  function brandMark({ size = 30, cls = '' } = {}) {
    // 底下一層淡色筆畫一直都在；上層柿色筆畫做描邊動畫，動畫沒跑也完整顯示
    let ghost = '', ink = '';
    for (let i = 0; i < 5; i++) {
      const { d, P } = strokePath(i, 0.01);
      ghost += `<path class="bm-ghost" d="${d}"/>`;
      ink += `<path class="bm-ink" d="${d}" style="stroke-dasharray:${P.toFixed(2)} ${P.toFixed(2)}"/>`;
    }
    const paths = ghost + ink;
    return raw(`<svg class="brand-mark${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true">${paths}</svg>`);
  }
  function drawMark(svg, { delay = 120, each = 170 } = {}) {
    if (!svg || U.reducedMotion()) return;
    svg.querySelectorAll('.bm-ink').forEach((p, i) => {
      const P = parseFloat(p.style.strokeDasharray) || 14;
      p.animate && p.animate([{ strokeDashoffset: P }, { strokeDashoffset: 0 }], { duration: each + 60, delay: delay + i * each, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'backwards' });
    });
  }

  /* ════════ 圖表 ════════ */

  /** sparkline([3,5,2,8], { w, h, label, format }) → 2px 線、最後一點加環、每點可 hover */
  function sparkline(values, { w = 96, h: hh = 28, label = '', format = (v) => v, labels = [] } = {}) {
    const vals = values.map((v) => +v || 0);
    const n = vals.length;
    if (!n) return raw('');
    const max = Math.max(1, ...vals);
    const pad = 4;
    const x = (i) => (n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1));
    const y = (v) => hh - pad - (v / max) * (hh - pad * 2);
    const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const area = `M${x(0).toFixed(1)},${hh - pad} L${pts.join(' L')} L${x(n - 1).toFixed(1)},${hh - pad} Z`;
    const step = n > 1 ? (w - pad * 2) / (n - 1) : w;
    const hits = vals.map((v, i) => `<rect x="${(x(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${hh}" fill="transparent" data-tip="${esc((labels[i] ? labels[i] + '：' : '') + format(v))}"/>`).join('');
    return raw(`<svg class="spark" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" role="img" aria-label="${esc(label || vals.join('、'))}"><path class="spark-area" d="${area}"/><polyline class="spark-line" points="${pts.join(' ')}"/><circle class="spark-dot" cx="${x(n - 1).toFixed(1)}" cy="${y(vals[n - 1]).toFixed(1)}" r="3"/>${hits}</svg>`);
  }
  /**
   * barH(rows, { max, format }) → 水平長條。
   * row：{ label, value, color, valueLabel, href, segments:[{ value, color, label }] }
   */
  function barH(rows, { max, format = (v) => U.moneyCompact(v), labelWidth = 96, cls = '' } = {}) {
    const top = max || Math.max(1, ...rows.map((r) => (r.segments ? r.segments.reduce((s, x) => s + x.value, 0) : r.value)));
    return html`<div class="barh${cls ? ' ' + cls : ''}" style="--barh-label:${labelWidth}px">${rows.map((r) => {
      const segs = r.segments || [{ value: r.value, color: r.color, label: r.label }];
      const total = segs.reduce((s, x) => s + x.value, 0);
      const tip = segs.length > 1 ? segs.map((s) => `${s.label}：${format(s.value)}`).join('、') : `${r.label}：${format(total)}`;
      const lab = r.href ? html`<a class="barh-label" href="${r.href}">${r.label}</a>` : html`<span class="barh-label">${r.label}</span>`;
      return html`<div class="barh-row">${lab}<span class="barh-track" data-tip="${tip}">${segs.map((s, i) => html`<i class="barh-seg${i === segs.length - 1 ? ' is-end' : ''}" style="width:${((s.value / top) * 100).toFixed(2)}%;background:${raw(s.color || 'var(--ink-2)')}"></i>`)}</span><span class="barh-value">${r.valueLabel != null ? r.valueLabel : format(total)}</span></div>`;
    })}</div>`;
  }
  /** 數字滾動：rollNumber(el, from, to, { format, duration }) */
  function rollNumber(el, from, to, { format = U.num, duration = 720 } = {}) {
    if (!el) return;
    if (U.reducedMotion() || from === to) { el.textContent = format(to); return; }
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      el.textContent = format(from + (to - from) * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** emptyState({ title, body, action }) → 淡色正字殘筆 + 說明 */
  function emptyState({ title = '還沒有紀錄', body = '', action = '', compact = false } = {}) {
    return html`<div class="empty${compact ? ' empty--compact' : ''}">${raw(`<svg class="empty-mark" width="44" height="44" viewBox="0 0 20 20" fill="none" aria-hidden="true">${[0, 1, 2, 3, 4].map((i) => `<path d="${strokePath(i, 0).d}" class="${i < 1 ? 'on' : ''}"/>`).join('')}</svg>`)}<p class="empty-title">${title}</p>${body ? html`<p class="empty-body">${body}</p>` : ''}${action ? html`<div class="empty-action">${action}</div>` : ''}</div>`;
  }

  /* ════════ 浮層：layer stack ════════ */

  let layerRoot = null;
  const layers = [];
  function root() {
    if (!layerRoot) {
      layerRoot = document.createElement('div');
      layerRoot.className = 'layers';
      document.body.appendChild(layerRoot);
    }
    return layerRoot;
  }
  function pushLayer(layer) {
    layers.push(layer);
    syncLock();
  }
  function dropLayer(layer) {
    const i = layers.indexOf(layer);
    if (i >= 0) layers.splice(i, 1);
    syncLock();
  }
  function syncLock() {
    document.documentElement.classList.toggle('is-locked', layers.some((l) => l.lock));
  }
  const topLayer = () => layers[layers.length - 1] || null;
  function closeAll() { [...layers].reverse().forEach((l) => l.close({ instant: true, noFocus: true })); }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const top = topLayer();
    if (!top) return;
    e.preventDefault();
    e.stopPropagation();
    top.close();
  }, true);
  document.addEventListener('pointerdown', (e) => {
    const top = topLayer();
    if (!top || top.kind !== 'popover') return;
    if (top.el.contains(e.target) || (top.anchor && top.anchor.contains(e.target))) return;
    top.close({ noFocus: true });
  }, true);
  window.addEventListener('resize', () => { layers.filter((l) => l.kind === 'popover').forEach((l) => l.close({ instant: true, noFocus: true })); });

  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function trapTab(container, e) {
    if (e.key !== 'Tab') return;
    const f = [...container.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function place(el, anchor, { align = 'start', offset = 6 } = {}) {
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    let left = align === 'end' ? r.right - w : align === 'center' ? r.left + r.width / 2 - w / 2 : r.left;
    left = U.clamp(left, 8, window.innerWidth - w - 8);
    let top = r.bottom + offset;
    if (top + hh > window.innerHeight - 8 && r.top - offset - hh > 8) top = r.top - offset - hh;
    top = U.clamp(top, 8, Math.max(8, window.innerHeight - hh - 8));
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
  }

  /** popover(anchor, content, { align, cls, onClose, label }) → { el, close } */
  function popover(anchor, content, { align = 'start', cls = '', onClose, label = '', focus = true, role = 'dialog' } = {}) {
    const existing = layers.find((l) => l.anchor === anchor);
    if (existing) { existing.close(); return null; }
    const el = document.createElement('div');
    el.className = 'pop' + (cls ? ' ' + cls : '');
    el.setAttribute('role', role);
    if (label) el.setAttribute('aria-label', label);
    if (content instanceof Node) el.appendChild(content); else el.innerHTML = String(content);
    root().appendChild(el);
    place(el, anchor, { align });
    if (!U.reducedMotion() && el.animate) el.animate([{ transform: 'translateY(-4px)' }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.22,1,.36,1)' });
    anchor.setAttribute('aria-expanded', 'true');
    const layer = {
      kind: 'popover', el, anchor,
      close({ noFocus } = {}) {
        if (layer.closed) return;
        layer.closed = true;
        dropLayer(layer);
        el.remove();
        anchor.setAttribute('aria-expanded', 'false');
        if (!noFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
        onClose && onClose();
      },
    };
    pushLayer(layer);
    if (focus) {
      const f = el.querySelector('[autofocus]') || el.querySelector(FOCUSABLE);
      f && f.focus({ preventScroll: true });
    }
    return layer;
  }

  /**
   * menu(anchor, items, { align, onSelect, cls }) → 鍵盤可用的選單
   * item：{ label, icon, kbd, hint, danger, checked, disabled, value, onSelect } | { divider:true } | { heading:'…' }
   */
  function menu(anchor, items, { align = 'start', onSelect, cls = '', label = '' } = {}) {
    const body = html`${items.map((it, i) => {
      if (it.divider) return html`<div class="menu-sep" role="separator"></div>`;
      if (it.heading) return html`<div class="menu-heading" role="presentation">${it.heading}</div>`;
      const role = it.checked != null ? 'menuitemradio' : 'menuitem';
      return html`<button type="button" class="menu-item${it.danger ? ' is-danger' : ''}" role="${role}" data-i="${i}" tabindex="-1"${attrs({ disabled: it.disabled, 'aria-checked': it.checked != null ? String(!!it.checked) : null })}>${it.icon ? icon(it.icon, { size: 16, cls: 'menu-icon' }) : it.lead || ''}<span class="menu-label">${it.label}</span>${it.hint ? html`<span class="menu-hint">${it.hint}</span>` : ''}${it.kbd ? kbd(it.kbd) : ''}${it.checked ? icon('check', { size: 16, cls: 'menu-check' }) : ''}</button>`;
    })}`;
    const layer = popover(anchor, body, { align, cls: 'menu' + (cls ? ' ' + cls : ''), role: 'menu', focus: false, label });
    if (!layer) return null;
    const el = layer.el;
    const itemsEls = () => [...el.querySelectorAll('.menu-item:not([disabled])')];
    const focusAt = (i) => { const list = itemsEls(); if (!list.length) return; list[(i + list.length) % list.length].focus(); };
    const first = el.querySelector('.menu-item[aria-checked="true"]:not([disabled])');
    first ? first.focus() : focusAt(0);
    el.addEventListener('keydown', (e) => {
      const list = itemsEls();
      const i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
      else if (e.key === 'End') { e.preventDefault(); focusAt(list.length - 1); }
      else if (e.key === 'Tab') { layer.close({ noFocus: true }); }
      else if (e.key.length === 1 && /\S/.test(e.key)) {
        const j = list.findIndex((b, k) => k > i && b.textContent.trim().toLowerCase().startsWith(e.key.toLowerCase()));
        if (j >= 0) list[j].focus();
      }
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.menu-item');
      if (!b || b.disabled) return;
      const it = items[+b.dataset.i];
      layer.close();
      if (it.onSelect) it.onSelect(it);
      if (onSelect) onSelect(it);
    });
    return layer;
  }

  /** drawer({ title, sub, body, footer, width, onClose, label }) → { el, body, foot, close, setTitle } */
  function drawer({ title = '', sub = '', body = '', footer = '', width = 520, onClose, cls = '', label = '', head = true } = {}) {
    const wrap = h(html`<div class="drawer-root"><div class="scrim"></div><aside class="drawer${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true" aria-label="${label || (typeof title === 'string' ? title : '')}" style="--drawer-w:${width}px" tabindex="-1">${head ? html`<header class="drawer-head"><div class="drawer-titles"><h2 class="drawer-title">${title}</h2>${sub ? html`<p class="drawer-sub">${sub}</p>` : ''}</div>${iconBtn('close', { label: '關閉', attrs: { 'data-close': '' }, tip: false })}</header>` : ''}<div class="drawer-body"></div>${footer ? html`<footer class="drawer-foot"></footer>` : ''}</aside></div>`);
    const aside = wrap.querySelector('.drawer');
    const bodyEl = wrap.querySelector('.drawer-body');
    const foot = wrap.querySelector('.drawer-foot');
    if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = String(body);
    if (foot) { if (footer instanceof Node) foot.appendChild(footer); else foot.innerHTML = String(footer); }
    const returnTo = document.activeElement;
    root().appendChild(wrap);
    const anim = !U.reducedMotion() && aside.animate;
    if (anim) {
      aside.animate([{ transform: U.isMobile() ? 'translateY(24px)' : 'translateX(32px)' }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
      wrap.querySelector('.scrim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    const layer = {
      kind: 'drawer', el: aside, lock: true,
      close({ instant, noFocus } = {}) {
        if (layer.closed) return;
        layer.closed = true;
        dropLayer(layer);
        const done = () => { wrap.remove(); onClose && onClose(); };
        if (anim && !instant) {
          aside.animate([{ transform: 'none' }, { transform: U.isMobile() ? 'translateY(24px)' : 'translateX(32px)', opacity: 0.4 }], { duration: 160, easing: 'ease-in' });
          wrap.querySelector('.scrim').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).onfinish = done;
        } else done();
        if (!noFocus && returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
      },
    };
    wrap.addEventListener('click', (e) => { if (e.target.classList.contains('scrim') || e.target.closest('[data-close]')) layer.close(); });
    aside.addEventListener('keydown', (e) => trapTab(aside, e));
    pushLayer(layer);
    (aside.querySelector('[autofocus]') || aside).focus({ preventScroll: true });
    return {
      el: aside, body: bodyEl, foot, close: (o) => layer.close(o),
      setTitle(t, s) { const tt = aside.querySelector('.drawer-title'); if (tt) tt.textContent = t; const ss = aside.querySelector('.drawer-sub'); if (ss && s != null) ss.textContent = s; },
      get closed() { return !!layer.closed; },
    };
  }

  /**
   * modal({ title, body, actions:[{ label, variant, onClick, close }], size:'sm'|'md'|'lg', onClose })
   * onClick 回傳 false 可阻止關閉。
   */
  function modal({ title = '', sub = '', body = '', actions = [], size = 'md', onClose, cls = '' } = {}) {
    const wrap = h(html`<div class="modal-root"><div class="scrim"></div><div class="modal modal--${size}${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true" aria-label="${typeof title === 'string' ? title : ''}" tabindex="-1"><header class="modal-head"><div><h2 class="modal-title">${title}</h2>${sub ? html`<p class="modal-sub">${sub}</p>` : ''}</div>${iconBtn('close', { label: '關閉', attrs: { 'data-close': '' }, tip: false })}</header><div class="modal-body"></div>${actions.length ? html`<footer class="modal-foot">${actions.map((a, i) => btn({ label: a.label, variant: a.variant || 'tonal', icon: a.icon, attrs: { 'data-action': i, type: a.submit ? 'submit' : 'button' }, kbd: a.kbd }))}</footer>` : ''}</div></div>`);
    const box = wrap.querySelector('.modal');
    const bodyEl = wrap.querySelector('.modal-body');
    if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = String(body);
    const returnTo = document.activeElement;
    root().appendChild(wrap);
    const anim = !U.reducedMotion() && box.animate;
    if (anim) {
      box.animate([{ transform: 'translateY(10px) scale(.99)' }, { transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
      wrap.querySelector('.scrim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
    }
    const layer = {
      kind: 'modal', el: box, lock: true,
      close({ instant, noFocus } = {}) {
        if (layer.closed) return;
        layer.closed = true;
        dropLayer(layer);
        const done = () => { wrap.remove(); onClose && onClose(); };
        if (anim && !instant) wrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140 }).onfinish = done;
        else done();
        if (!noFocus && returnTo && returnTo.isConnected) returnTo.focus({ preventScroll: true });
      },
    };
    wrap.addEventListener('click', (e) => {
      if (e.target.classList.contains('scrim') || e.target.closest('[data-close]')) return layer.close();
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const a = actions[+b.dataset.action];
      const r = a.onClick ? a.onClick(api) : undefined;
      if (r !== false && a.close !== false) layer.close();
    });
    box.addEventListener('keydown', (e) => trapTab(box, e));
    pushLayer(layer);
    const f = box.querySelector('[autofocus]') || bodyEl.querySelector(FOCUSABLE) || box;
    f.focus({ preventScroll: true });
    const api = { el: box, body: bodyEl, close: (o) => layer.close(o), get closed() { return !!layer.closed; } };
    return api;
  }
  /** confirm({ title, body, confirmLabel, danger }) → Promise<boolean> */
  function confirm({ title = '確定嗎？', body = '', confirmLabel = '確定', cancelLabel = '取消', danger = false } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      modal({
        title, size: 'sm', body: body ? html`<p class="t-2">${body}</p>` : '',
        actions: [
          { label: cancelLabel, variant: 'quiet', onClick: () => { answered = true; resolve(false); } },
          { label: confirmLabel, variant: danger ? 'danger-solid' : 'primary', onClick: () => { answered = true; resolve(true); } },
        ],
        onClose: () => { if (!answered) resolve(false); },
      });
    });
  }

  /* ════════ toast ════════ */
  let toastBox = null;
  /** toast('已刪除', { undo, action:{ label, fn }, duration }) */
  function toast(message, { undo, action, duration = 5200, tone = '' } = {}) {
    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'toasts';
      toastBox.setAttribute('role', 'status');
      toastBox.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastBox);
    }
    const el = h(html`<div class="toast${tone ? ' toast--' + tone : ''}"><span class="toast-msg">${message}</span>${undo ? html`<button type="button" class="toast-btn" data-undo>${icon('undo', { size: 16 })}<span>復原</span></button>` : ''}${action ? html`<button type="button" class="toast-btn" data-act>${action.label}</button>` : ''}<button type="button" class="toast-x" aria-label="關閉通知">${icon('close', { size: 14 })}</button></div>`);
    toastBox.appendChild(el);
    while (toastBox.children.length > 3) toastBox.firstElementChild.remove();
    if (!U.reducedMotion() && el.animate) el.animate([{ transform: 'translateY(8px)' }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' });
    let timer;
    const dismiss = () => {
      clearTimeout(timer);
      if (!el.isConnected) return;
      if (!U.reducedMotion() && el.animate) el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(4px)' }], { duration: 150 }).onfinish = () => el.remove();
      else el.remove();
    };
    const arm = () => { clearTimeout(timer); timer = setTimeout(dismiss, duration); };
    el.addEventListener('pointerenter', () => clearTimeout(timer));
    el.addEventListener('pointerleave', arm);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-undo]')) { undo(); dismiss(); toast('已復原', { duration: 2200 }); }
      else if (e.target.closest('[data-act]')) { action.fn(); dismiss(); }
      else if (e.target.closest('.toast-x')) dismiss();
    });
    arm();
    return { el, dismiss };
  }

  /* ════════ tooltip ════════ */
  let tipEl = null, tipFor = null, tipTimer = null;
  function showTip(target) {
    const text = target.getAttribute('data-tip');
    if (!text) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    tipEl.textContent = text;
    tipEl.hidden = false;
    tipFor = target;
    const r = target.getBoundingClientRect();
    const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
    let top = r.top - hh - 8;
    if (top < 6) top = r.bottom + 8;
    tipEl.style.left = Math.round(U.clamp(r.left + r.width / 2 - w / 2, 6, window.innerWidth - w - 6)) + 'px';
    tipEl.style.top = Math.round(top) + 'px';
  }
  function hideTip() { clearTimeout(tipTimer); if (tipEl) tipEl.hidden = true; tipFor = null; }
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target instanceof Element && e.target.closest('[data-tip]');
    if (!t) return;
    if (t === tipFor) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTip(t), tipFor ? 0 : 380);
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target instanceof Element && e.target.closest('[data-tip]');
    if (t && (!e.relatedTarget || !t.contains(e.relatedTarget))) hideTip();
  });
  document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) showTip(t); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('pointerdown', hideTip, true);
  window.addEventListener('scroll', hideTip, true);
  /** tooltip(el, '說明') */
  const tooltip = (el, text) => { el.setAttribute('data-tip', text); return el; };

  /* ════════ segmented / tabs：鍵盤與事件 ════════ */
  function selectInGroup(btnEl, attr, evtName) {
    const group = btnEl.parentElement;
    group.querySelectorAll(':scope > button').forEach((b) => { b.setAttribute(attr, String(b === btnEl)); b.tabIndex = b === btnEl ? 0 : -1; });
    group.dispatchEvent(new CustomEvent(evtName, { bubbles: true, detail: { name: group.dataset.seg || group.dataset.tabs, value: btnEl.dataset.value } }));
  }
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element && e.target.closest('.seg > button, .tabs > button');
    if (!b) return;
    const isSeg = b.parentElement.classList.contains('seg');
    const attr = isSeg ? 'aria-checked' : 'aria-selected';
    if (b.getAttribute(attr) === 'true') return;
    selectInGroup(b, attr, isSeg ? 'seg-change' : 'tab-change');
  });
  document.addEventListener('keydown', (e) => {
    const b = e.target instanceof Element && e.target.closest('.seg > button, .tabs > button');
    if (!b || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const list = [...b.parentElement.querySelectorAll(':scope > button')];
    const i = list.indexOf(b);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    e.preventDefault();
    list[j].focus();
    list[j].click();
  });
  // indeterminate 只能用屬性設定
  const syncIndeterminate = (rootEl) => rootEl.querySelectorAll('input[data-indeterminate="1"]').forEach((i) => { i.indeterminate = true; });

  /* ════════ table ════════ */
  /**
   * table(container, { columns, rows, rowKey, selectable, sort, onRowClick, onSelect, empty, rowAttrs, caption })
   * column：{ key, label, width, align, sort:true|fn, render(row), m:'primary'|'end'|'meta'|'hide', cls }
   * 手機寬度自動改成清單列：m='primary' 佔第一行，'end' 靠右，'meta' 排在第二行，'hide' 隱藏。
   */
  function table(container, config) {
    const cfg = { rowKey: 'id', selectable: false, rows: [], ...config };
    let rows = cfg.rows;
    let sort = cfg.sort || null; // { key, dir }
    const selected = new Set();
    const col = (k) => cfg.columns.find((c) => c.key === k);
    const valueOf = (c, r) => (typeof c.sort === 'function' ? c.sort(r) : r[c.key]);
    function sorted() {
      if (!sort) return rows;
      const c = col(sort.key);
      if (!c || !c.sort) return rows;
      return rows.slice().sort((a, b) => {
        const x = valueOf(c, a), y = valueOf(c, b);
        // 空值不論升降冪一律排在最後
        if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
        return (typeof x === 'string' ? x.localeCompare(y, 'zh-Hant') : x - y) * sort.dir;
      });
    }
    function draw() {
      const list = sorted();
      const allOn = list.length > 0 && list.every((r) => selected.has(r[cfg.rowKey]));
      const someOn = !allOn && list.some((r) => selected.has(r[cfg.rowKey]));
      const head = html`<thead><tr>${cfg.selectable ? html`<th class="tbl-sel" scope="col">${checkbox({ checked: allOn, indeterminate: someOn, attrs: { 'data-all': '', 'aria-label': '全選' } })}</th>` : ''}${cfg.columns.map((c) => {
        const active = sort && sort.key === c.key;
        const ariaSort = active ? (sort.dir > 0 ? 'ascending' : 'descending') : c.sort ? 'none' : null;
        const inner = c.sort ? html`<button type="button" class="tbl-sort${active ? ' is-active' : ''}" data-sort="${c.key}"><span>${c.label}</span>${icon(active && sort.dir < 0 ? 'chevronDown' : 'chevronUp', { size: 14, cls: 'tbl-sort-ic' })}</button>` : c.label;
        return html`<th scope="col" class="${c.align ? 'is-' + c.align : ''} ${c.cls || ''}"${attrs({ 'aria-sort': ariaSort, style: c.width ? `width:${c.width}` : null })}>${inner}</th>`;
      })}</tr></thead>`;
      const body = list.length
        ? html`<tbody>${list.map((r) => {
            const id = r[cfg.rowKey];
            const on = selected.has(id);
            return html`<tr class="${on ? 'is-selected' : ''}${cfg.onRowClick ? ' is-clickable' : ''}" data-id="${id}"${cfg.onRowClick ? attrs({ tabindex: 0 }) : ''}${attrs(cfg.rowAttrs ? cfg.rowAttrs(r) : null)}>${cfg.selectable ? html`<td class="tbl-sel">${checkbox({ checked: on, attrs: { 'data-row': id, 'aria-label': '選取' } })}</td>` : ''}${cfg.columns.map((c) => html`<td class="${c.align ? 'is-' + c.align : ''} ${c.cls || ''}" data-m="${c.m || 'meta'}"${c.m === 'meta' || !c.m ? attrs({ 'data-label': c.mLabel || '' }) : ''}>${c.render ? c.render(r) : r[c.key]}</td>`)}</tr>`;
          })}</tbody>`
        : html`<tbody><tr class="tbl-empty"><td colspan="${cfg.columns.length + (cfg.selectable ? 1 : 0)}">${cfg.empty || emptyState({ title: '沒有符合的資料', compact: true })}</td></tr></tbody>`;
      container.innerHTML = String(html`<table class="tbl${cfg.selectable ? ' tbl--select' : ''}${cfg.cls ? ' ' + cfg.cls : ''}">${cfg.caption ? html`<caption class="sr-only">${cfg.caption}</caption>` : ''}${head}${body}</table>`);
      syncIndeterminate(container);
    }
    const emitSel = () => cfg.onSelect && cfg.onSelect([...selected]);
    container.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sort]');
      if (s) {
        const k = s.dataset.sort;
        sort = sort && sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: col(k).defaultDir || 1 };
        draw();
        cfg.onSort && cfg.onSort(sort);
        container.querySelector(`[data-sort="${k}"]`).focus();
        return;
      }
      if (e.target.closest('.tbl-sel')) return;
      const tr = e.target.closest('tbody tr[data-id]');
      if (!tr || !cfg.onRowClick) return;
      if (e.target.closest('a,button,input,select,textarea,label')) return;
      const r = rows.find((x) => String(x[cfg.rowKey]) === tr.dataset.id);
      r && cfg.onRowClick(r, e);
    });
    container.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-all]')) {
        const list = sorted();
        if (t.checked) list.forEach((r) => selected.add(r[cfg.rowKey])); else list.forEach((r) => selected.delete(r[cfg.rowKey]));
        draw(); emitSel();
        const a = container.querySelector('[data-all]'); a && a.focus();
      } else if (t.matches('[data-row]')) {
        const id = rows.find((r) => String(r[cfg.rowKey]) === t.dataset.row)[cfg.rowKey];
        t.checked ? selected.add(id) : selected.delete(id);
        draw(); emitSel();
        const again = container.querySelector(`[data-row="${CSS.escape(String(id))}"]`); again && again.focus();
      }
    });
    container.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const tr = e.target.closest && e.target.closest('tbody tr[data-id]');
      if (tr && e.target === tr && cfg.onRowClick) { const r = rows.find((x) => String(x[cfg.rowKey]) === tr.dataset.id); r && cfg.onRowClick(r, e); }
    });
    draw();
    return {
      el: container,
      update(next) { rows = next; const ids = new Set(rows.map((r) => r[cfg.rowKey])); [...selected].forEach((id) => ids.has(id) || selected.delete(id)); draw(); },
      selected: () => [...selected],
      clearSelection() { selected.clear(); draw(); emitSel(); },
      setSort(s) { sort = s; draw(); },
      get sort() { return sort; },
      redraw: draw,
    };
  }

  /* ════════ 成交入帳 ════════ */
  /** bookIn(fromEl, amount)：金額標籤飛向頁首「本季進度」，量尺填滿、總額滾動 */
  function bookIn(fromEl, amount) {
    const shell = CRM.shell || {};
    const meter = [...document.querySelectorAll('.qmeter')].find((m) => m.offsetParent !== null && m.getBoundingClientRect().width > 0);
    if (!meter || U.reducedMotion()) {
      shell.refreshMeter && shell.refreshMeter({ animate: !U.reducedMotion() });
      return;
    }
    shell.holdMeter && shell.holdMeter(true);
    const target = meter.querySelector('.qmeter-track') || meter;
    const tr = target.getBoundingClientRect();
    const fr = fromEl && fromEl.isConnected ? fromEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    const label = h(html`<div class="bookin" aria-hidden="true">+${U.moneyCompact(amount)}</div>`);
    document.body.appendChild(label);
    const lw = label.offsetWidth, lh = label.offsetHeight;
    const x0 = fr.left + fr.width / 2 - lw / 2, y0 = fr.top + fr.height / 2 - lh / 2;
    const x1 = tr.left + tr.width * Math.min(1, store().quarterProgress().pct) - lw / 2, y1 = tr.top + tr.height / 2 - lh / 2;
    const lift = Math.min(120, Math.abs(y1 - y0) * 0.35 + 40);
    label.style.left = '0px';
    label.style.top = '0px';
    const a = label.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(1)` },
        { transform: `translate(${x0 + (x1 - x0) * 0.55}px, ${Math.max(y1 + 24, Math.min(y0, y1) - lift)}px) scale(1.04)`, offset: 0.5 },
        { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: 0.9 },
      ],
      { duration: 720, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' },
    );
    const land = () => {
      label.remove();
      shell.holdMeter && shell.holdMeter(false);
      shell.refreshMeter && shell.refreshMeter({ animate: true, flash: true });
    };
    a.onfinish = land;
    a.oncancel = land;
  }
  CRM.events.on('won', ({ amount, sourceEl }) => {
    // store 在批次結束前發出 won：先鎖住量尺，等標籤飛到才更新
    const shell = CRM.shell || {};
    const hasMeter = [...document.querySelectorAll('.qmeter')].some((m) => m.offsetParent !== null);
    const held = hasMeter && !U.reducedMotion() && shell.holdMeter;
    if (held) shell.holdMeter(true);
    requestAnimationFrame(() => { bookIn(sourceEl, amount); if (held) shell.holdMeter(false); });
  });

  /* ════════ 跨頁 hooks（forms.js 會覆寫 create / logActivity） ════════ */
  const go = (p) => CRM.router && CRM.router.go(p);

  CRM.ui = {
    attrs, btn, iconBtn, kbd, field, checkbox, segmented, tabs,
    nameBlock, companyMark, activityBars, toneOf, statCard, tag, warmth, stageTag, money, relTime, due, personCell, companyCell,
    tally, bumpTally, animateTallyStroke, brandMark, drawMark,
    sparkline, barH, rollNumber, emptyState,
    popover, menu, drawer, modal, confirm, toast, tooltip, table, bookIn,
    closeAll, get layers() { return layers.slice(); }, place, syncIndeterminate,
    icon,
    openContact: (id) => go('/contacts/' + id),
    openCompany: (id) => go('/companies/' + id),
    openDeal: (id) => go('/deals/' + id),
  };
})();
