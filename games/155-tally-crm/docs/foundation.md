# 劃記 TALLY CRM · 地基 API

給頁面代理用的參考。規格以 `brief.md` 為準，這份只寫地基實際提供的東西。所有檔案都是 IIFE，掛在 `window.CRM`。

## 建置與驗收

```bash
node games/155-tally-crm/build.mjs                      # → web/155-tally-crm.html，並重寫 src/dev.html
node games/155-tally-crm/tools/check.mjs /contacts      # 1440×900 與 390×844 × 淺／深，截圖到 shots/
node games/155-tally-crm/tools/check.mjs /deals --eval "document.querySelector('.x').click()" --tag open
```

check.mjs 選項：`--eval "<js>"`（就緒後執行，可 await，回傳值會印出）、`--tag name`（截圖檔名後綴，互動截圖用）、`--full`、`--sizes`、`--themes`、`--wait ms`、`--scale 3`（高密度截圖，看細節）、`--keep-storage`、`--dev`（改測 `src/dev.html`）。每張截圖都從乾淨的示範資料開始。失敗條件：exception、console.error、外部請求、缺 viewport、手機寬度水平溢出（和模擬寬度比，不是 innerWidth）。

載入順序：core（util → icons → seed → store → router → ui → forms → palette → shell）→ `src/pages/*.js`（字母序）→ `main.js`。CSS：tokens → base → components → shell → `src/styles/pages/*.css`。新增頁面檔不用改 build。**`src/dev.html` 是 build 產生的**，新增頁面後重跑 build。

## 頁面介面

```js
CRM.pages.contacts = {
  route: /^\/contacts(?:\/([\w-]+))?$/,   // 只比對 path，不含 ?query
  title: '聯絡人',                        // 或 (ctx) => '…'
  nav: 'contacts',                        // 亮起哪個導覽項：dashboard|contacts|companies|deals|tasks|activities
  mount(el, ctx) { el.appendChild(ctx.ui.pageHeader({ title: '聯絡人' })); … },
  unmount() { /* 取消訂閱 */ },
};
```

`ctx = { path, params, query, name, store, actions, ui, util, router, el }`。`params` 是 route 的捕獲群組陣列（`params[0]` = id）。換路由時地基會先 `unmount()`、清空 `el`、關閉所有浮層，再 `mount()`。只改 query 也會重新掛載；不想重掛就用 `router.setQuery(patch, { silent:true })` 自己重繪。

## CRM.router

| API | 說明 |
| --- | --- |
| `go(path, query?)` | `router.go('/deals', { view:'list' })` |
| `href(path, query?)` | `'#/deals?view=list'`，放進 `<a href>` |
| `setQuery(patch, { silent, push })` | 合併 query；`silent:true` 只改網址不重掛 |
| `current` | 目前的 ctx |
| `refresh()` | 重新掛載目前頁面 |

`?theme=dark|light` 只在這次瀏覽生效，不寫入偏好、不會出現在 `href()` 產生的網址裡。`CRM.theme.set('light'|'dark'|'system')` 會寫入偏好（`tally:theme`）。`CRM.theme.isDark` 判斷目前是否深色。

## CRM.store

資料：`store.data` = `{ meta, reps, companies, contacts, deals, tasks, activities, wins }`，存在 localStorage `tally:v1`（失敗就只在記憶體）。

**跨日**：存檔日不是今天時，同一季內把所有日期平移到今天（保留使用者修改，晚於現在的活動時間收回到現在）；跨季則重新產生示範資料。儲存有 250ms debounce。

### 資料形狀

- **rep** `{ id:'u1', name, surname, title, region, target, email, me? }`；`store.me()` 是周品妤。
- **company** `{ id:'o01', name, short(兩字), city, region:'北區|中區|南區|東區', industry, group, size, taxId, domain, phone, owner, status:'潛在|洽談中|客戶|流失', createdAt, history:[{ key:'2025Q4', label, amount }]×4 }`
- **contact** `{ id:'c001', name, surname, companyId, title, level:'top|mid|low', email, mobile, phone, owner, lifecycle, tags[], reportsTo, createdAt }`
- **deal** `{ id:'d01', code:'Q-2026-0318', name, companyId, contactIds[], owner, stage, items:[{ sku, qty, price }], amount, closeDate, createdAt, closedAt, history:[{ stage, at }], lostReason, next }`；`amount` 永遠等於品項加總（update 帶 items 時自動重算）。
- **task** `{ id:'t001', title, due:'YYYY-MM-DD', dueTime:'15:00'|null, priority:'high|normal|low', owner, contactId, companyId, dealId, done, doneAt, createdAt }`
- **activity** `{ id:'a0001', type, at:'YYYY-MM-DDTHH:MM', owner, contactId, companyId, dealId, body, … }`：`call` 有 `duration`（分），`email` 有 `subject`，`meeting` 有 `title location duration`，`stage` 有 `from to`，`task` 有 `taskId`。
- **win**（過去四季的成交摘要，給營收歷史與成交週期）`{ id, companyId, owner, amount, closedAt, createdAt, cycleDays, quarter }`

日期字串都是本地時間，用 `CRM.util.parse()` 轉 Date。

### CRUD（全部可復原）

```js
store.get('contacts', 'c012')            // 或 null
store.all('deals')                       // 原陣列，不要直接改
store.filter('tasks', (t) => !t.done)
store.create('tasks', { title, due, … }) // 自動給 id，回傳文件
store.update('deals', id, { closeDate })
store.remove('tasks', id)
const { undo } = store.batch(() => { store.update(…); store.create(…); })  // 一次通知、一個復原點
const off = store.subscribe((evt) => { if (evt.has('deals', 'activities')) redraw(); })
store.reset()                            // 回到今天的示範資料
```

`evt = { collection, collections[], ids[], type:'create|update|remove|batch|reset', has(...cols) }`。

### Selectors

| API | 回傳 |
| --- | --- |
| `stage(id)` | `{ id, name, p, color:'var(--st-poc)', closed? }`；`STAGES`、`OPEN_STAGES` |
| `product(sku)` | `{ sku, name, short, price, unit }`；`PRODUCTS` |
| `rep(id)`、`me()` | 業務 |
| `isOpen(deal)`、`itemsTotal(items)` | |
| `dealsByStage(pred?)` | `{ lead:[…], qual:[…], … }` |
| `weightedValue(deal)`、`weighted(deals)` | 加權金額（開放中 = 金額 × 階段機率） |
| `quarterProgress({ owner? })` | `{ quarter, target, won, wonDeals, weighted（本季內預計成交的加權）, pipeline, pipelineWeighted, pct, forecastPct, gap }` |
| `period('month'|'quarter'|'year')` | `{ start, end, label }` |
| `repStats(owner|null, { period })` | `{ target, won, wonCount, lostCount, winRate, avgCycle, avgDeal, openCount, pipeline, weighted, touches, pct }`；null = 全隊 |
| `companyStats(id)` | `{ contacts, openDeals, openAmount, wonTotal, warmth, touches30, lastTouch }` |
| `revenueHistory(companyId)` | 過去四季 + 本季 `[{ key, label, amount }]` |
| `lastTouch(ref)` | 最後往來時間字串或 null |
| `warmth(ref)` | `{ id:'hot|warm|cool|cold', label:'熱', lit:4..1, days|null, last }` |
| `touches(ref, days=30)` | 往來次數（劃記用；不含階段變更） |
| `touchSeries(ref, weeks=12)` | 每週往來次數，由舊到新，最後一格是本週 |
| `activitiesFor(ref, { types, limit, since })` | 新到舊 |
| `dealsFor(ref)`、`openDealsFor(ref)` | |
| `tasksFor(ref, { open })` | `open:true` 未完成 |
| `contactsOf(companyId)`、`companyOf(rec)` | |

`ref` 是 `{ contactId }`、`{ companyId }`、`{ dealId }` 或 `{ owner }` 其中之一。往來 = `call email meeting note task`（`TOUCH_TYPES`）。其他常數：`LIFECYCLES TAGS COMPANY_STATUSES LOST_REASONS ACTIVITY_TYPES PRIORITIES WARMTH TEAM_TARGET`。

## CRM.actions（會自己跳可復原的 toast；`{ silent:true }` 可關掉）

```js
actions.moveDealStage(id, 'won', { sourceEl: cardEl })     // 成交：金額從 sourceEl 飛進頁首量尺
actions.moveDealStage(id, 'lost', { lostReason: '價格高於競品' })
actions.logActivity({ type:'call', contactId, dealId, duration: 8, body })  // 對應劃記多畫一筆
actions.completeTask(id)   // 寫入任務完成活動，劃記多一筆
actions.reopenTask(id)
actions.deleteRecord('contacts', id)   // 處理關聯（公司會連同聯絡人、交易、任務、活動一起刪），可復原
```

全部回傳 `{ undo }`。moveDealStage 會更新 `history`、`closedAt`、寫一筆 `stage` 活動。

## CRM.events

`CRM.events.on(type, fn)` 回傳取消函式。

| 事件 | detail |
| --- | --- |
| `won` | `{ deal, amount, sourceEl }`（ui 已自動播放 bookIn，頁面不用處理） |
| `stage` | `{ deal, from, to }` |
| `tally` | `{ keys:['contact:c012','company:o03','deal:d07','rep:u1'], activity, at }` |
| `route` | ctx |
| `theme` | `{ pref, dark }` |
| `ready` | 第一次掛載完成（`window.CRM_READY = true`） |

## CRM.ui

純呈現元件回傳 `Raw`，直接放進 `` html`…` ``；互動元件是命令式。

### 記號

```js
ui.tally(n, { key:'contact:c012', accent:0, size:16 })  // 帶 key 的劃記在 logActivity/completeTask 後自動多畫一筆
ui.bumpTally(el) / ui.animateTallyStroke(el)            // 手動控制
ui.nameBlock(contactOrRepOrId, { size:36 })             // 圓形粉彩頭像刻姓氏（色調依名字固定）；表格 36、列表 26、詳細頁 72
ui.companyMark(companyOrId, { size:26 })                // 圓角方形粉彩標誌，取簡稱第一字
ui.warmth(store.warmth({ contactId }), { label:true })  // 粉彩膠囊＋四格刻度；或 ui.warmth('cold')
ui.tag('客戶', 'mint', { dot:true })                     // 粉彩膠囊；tone：peach mint sky lemon lilac rose teal sand，或 cls:'tag--line'
ui.activityBars(store.touchSeries({ contactId }, 8))    // 近 8 週往來小長條，最後一格（本週）柿色
ui.statCard({ label, value, unit, icon, tone:1-8, delta:{ text:'21%', dir:'up'|'down'|'flat' }, foot, spark:[…], href })
ui.stageTag('poc')
ui.money(1280000)  ui.money(n, { compact:true })  ui.money(n, { lost:true })
ui.relTime(a.at, { time:true })
ui.due(t.due, t.dueTime, { done:t.done })               // 逾期柿色、今天赭色
ui.personCell(contact, { sub, href })  ui.companyCell(company, { sub, href })
ui.brandMark({ size })  ui.drawMark(svgEl)
CRM.icon('phone', { size:16, label:'通話' })            // 名稱見 CRM.icons.names 或 #/kit
```

劃記 `key` 的格式固定是 `contact:<id>`、`company:<id>`、`deal:<id>`、`rep:<id>`，可以用空白放多個。事件觸發時，事件之前就渲染的元素會原地加一筆，之後才重繪的只播放最後一筆的動畫，所以頁面照常在 subscribe 裡重繪即可。

### 控制項

```js
ui.btn({ label:'新增交易', icon:'plus', variant:'primary'|'tonal'|'quiet'|'danger'|'danger-solid', size:'sm', kbd:'⌘K', attrs:{ 'data-act':'new' } })
ui.iconBtn('more', { label:'更多', size:'sm', attrs })
ui.field({ label, name, type:'text|textarea|select|date|time|number|email|tel', value, options, placeholder, hint, required, full, attrs })
ui.checkbox({ checked, label, indeterminate, attrs })
ui.segmented({ name:'view', value:'board', options:[{ value:'board', label:'看板', icon:'board' }], size:'sm' })
ui.tabs({ name:'tl', value:'all', items:[{ value:'all', label:'全部', count:24 }] })
ui.kbd('⌘K')  ui.kbd(['G','D'])
```

segmented 與 tabs 的切換是全域處理的：監聽 `el.addEventListener('seg-change', e => e.detail /* { name, value } */)`、`'tab-change'`。

### 資料

```js
const t = ui.table(container, {
  rows, selectable:true, sort:{ key:'name', dir:1 }, caption:'聯絡人',
  onRowClick:(row) => ui.openContact(row.id), onSelect:(ids) => …,
  columns:[{ key:'name', label:'姓名', sort:(r) => r.name, render:(r) => ui.personCell(r), m:'primary' },
           { key:'amount', label:'金額', align:'right', sort:true, defaultDir:-1, m:'end', render:… },
           { key:'owner', label:'負責', m:'hide' }, { key:'x', label:'…', m:'meta', mLabel:'最後往來' }],
});
t.update(rows); t.selected(); t.clearSelection(); t.redraw();
```

手機（≤760px）表格自動改成清單列：`m:'primary'` 第一行、`m:'end'` 靠右、`m:'meta'` 排在第二行（`mLabel` 會加在前面）、`m:'hide'` 隱藏。不要用 `overflow-x:auto`。

```js
ui.sparkline(values, { w:96, h:28, labels, format })     // 每點可 hover
ui.barH(rows, { format, labelWidth:96, max })            // row：{ label, value, color, href, valueLabel, segments:[{ value, color, label }] }
ui.rollNumber(el, from, to, { format })
ui.emptyState({ title, body, action, compact })
```

圖表顏色只用 token（`var(--st-poc)`、`var(--pine)`、`var(--ink-2)`）。

### 浮層（同一個 layer stack：Esc 與點外面只關最上層，關閉後焦點回到觸發點）

```js
ui.menu(anchorBtn, [{ label:'編輯', icon:'edit', kbd:'E', onSelect }, { divider:true }, { label:'刪除', icon:'trash', danger:true }], { align:'end' })
ui.popover(anchor, rawOrNode, { align, cls, label })   // → { el, close }
const d = ui.drawer({ title, sub, body, footer, width:560 })  // → { el, body, foot, close, setTitle }；手機全螢幕
ui.modal({ title, body, size:'sm|md|lg', actions:[{ label, variant, onClick(api) /* 回傳 false 不關 */ }] })
await ui.confirm({ title, body, confirmLabel, danger:true })
ui.toast('已刪除', { undo, action:{ label:'開啟', fn } })
ui.tooltip(el, '說明')   // 或直接寫 data-tip="…"
ui.closeAll()
ui.bookIn(fromEl, amount) // 通常不用直接呼叫，moveDealStage 會觸發
```

### 跨頁 hooks

```js
ui.openContact(id)  ui.openCompany(id)  ui.openDeal(id)   // 預設導到 #/contacts/<id> 等；頁面可以覆寫
ui.create('contact'|'company'|'deal'|'task', prefill)    // 表單對話框
ui.edit('deal', id)
ui.logActivity({ contactId, companyId, dealId, type })   // 記一筆對話框
ui.pageHeader({ title, sub, count, actions, ownNew:true, back:{ href:'#/contacts', label:'聯絡人' } })  // → Element
CRM.palette.open('初始字')
```

頁首在畫布上：左邊 26px 頁名（`count` 接在後面、`sub` 在下面一行、`back` 會加一顆返回鈕），右邊是搜尋框、`actions`、＋新增選單。頁面有自己的主要新增按鈕時傳 `ownNew:true`，並把按鈕做成 `variant:'primary'` 放在 `actions`，通用的「新增」就會隱藏。本季業績量尺在側欄底部。

## CRM.util

`html`（自動跳脫的 tagged template，陣列與 Raw 原樣接上）、`raw(str)`、`esc`、`h(markup)` → Element、`render(el, view)`、`on(root, type, selector, fn)` 事件委派、`$ $$`。
金額：`money(n)` → `NT$1,280,000`、`moneyCompact(n)` → `128 萬`／`2,712 萬`／`1.2 億`、`num`、`pct(x, digits)`。
日期：`parse today iso isoDT addDays daysBetween daysFromToday startOfWeek quarterOf time weekday fmtDate(9/12) fmtDateLong relTime(今天／昨天／3 天前／週四／下週二／9/12) duration(1 小時 20 分)`。
其他：`rng(seed)`（`next int float pick chance shuffle weighted`）、`debounce`、`uid`、`groupBy`、`sortBy`、`clamp`、`sum`、`reducedMotion()`、`isMobile()`、`isTyping(e)`。

## CSS 慣例

- 只用 token：色彩（`--bg --sheet --subtle --inset --raised --ink --ink-2 --ink-3 --ink-4 --line --line-strong --accent --accent-strong --accent-soft --pine --ochre --hover --press --select --st-*` 與粉彩）、間距 `--s1…--s14`、圓角 `--r-ctl --r-panel --r-pill`、陰影 `--shadow-card`（卡片）`--shadow-pop`（浮層）、動效 `--ease-out --dur-*`、字體 `--font-ui --font-display --font-mono`、字級 `--fs-12…--fs-34`、`--gutter`。
- 柿色當文字請用 `--accent-strong`（對比較高）；`--ink-4` 只做裝飾不放文字。
- 頁面結構照聯絡人頁：`pageHeader` → `<div class="page pg-xxx">`（直向 flex、gap 20、左右 `--gutter`）→ `.stats`（4 張 `ui.statCard`）→ `.card`（白色大圓角卡片；`.card-pad` 內距、`.card-head` / `.card-title` / `.card-sub`）。
- 卡片內的工具列：`.toolbar`（上方膠囊分頁 `ui.tabs` ＋右邊 `.tsearch`，下一列 `.tbtn` 篩選膠囊，`.is-on` 表示已套用）。
- 粉彩 token：`--peach(-bg) --mint(-bg) --sky(-bg) --lemon(-bg) --lilac(-bg) --rose(-bg) --teal(-bg) --sand(-bg)`；`.tone-1…8` 會設定 `--t-bg / --t-fg` 給自訂元件用。
- 工具 class：`.row .row-3 .stack .stack-4 .grow .push .t-display .t-mono .t-12/13/16/20 .t-2 .t-3 .t-accent .t-pine .t-ochre .t-strong .t-right .t-ellipsis .sr-only`。
- 手機斷點 760px；頁面代理自己的 class 請加頁面前綴（`.ct-…`、`.co-…`、`.dl-…`）。
- 卡片 hover 只改底色（`background: var(--hover)`），不上浮、不加陰影；內容不能以 opacity 0 起始。

## 快捷鍵（地基處理）

`⌘K`／`Ctrl+K` 命令面板、`/` 搜尋、`c` 新增選單、`l` 記一筆、`?` 說明、`g d/c/o/p/t/a` 前往頁面。焦點在輸入框或有浮層時不觸發。頁面自己的快捷鍵（例如看板的 `[` `]`）請在 keydown 裡檢查 `CRM.util.isTyping(e)` 與 `CRM.ui.layers.length`。
