// 在 BrickLink 查每種零件＋顏色的價格與賣家（公開頁面，不需登入），產生 ../prices.json 與 ../weights.json。
// 1. 價格指南（catalogPG.asp）：近 6 個月全新成交、目前全新在售的最低／平均價
// 2. 目錄頁：零件重量（驗證重心用）與內部編號
// 3. 在售清單（catalogifs.ajax）：可寄送到台灣、全新、庫存夠的賣家，依價格排序
// 最後用貪婪集合覆蓋挑出能湊齊全部零件的少數店家，當作購物車方案。
// 用法：PLAYWRIGHT=…/playwright-core/index.mjs CHROME=… node bricklink.mjs
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, '..');
const SHIP_TO = 'TW';
const bom = JSON.parse(fs.readFileSync(path.join(OUT, 'bom.json'), 'utf8'));
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', locale: 'zh-TW' });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (s) => (s == null ? null : Number(String(s).replace(/[^\d.]/g, '')));

async function open(url) {
  for (let i = 0; i < 3; i++) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await pause(2500);
    const t = await page.title();
    if (!/Please wait|Just a moment/i.test(t)) return t;
  }
  throw new Error('BrickLink 沒有回應：' + url);
}

// 查詢結果先存在 build/ 裡，重算購物車方案時不必重抓
const CACHE = path.join(OUT, 'build', 'bricklink-raw.json');
const cached = process.env.REUSE && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : null;
// ---- 目錄頁：重量、內部編號 ----
const items = cached?.items || {};
if (!cached) for (const bl of [...new Set(bom.lots.map((l) => l.bl))]) {
  const title = await open(`https://www.bricklink.com/v2/catalog/catalogitem.page?P=${encodeURIComponent(bl)}`);
  const info = await page.evaluate(() => {
    const html = document.documentElement.innerHTML, t = document.body.innerText;
    return { idItem: (/idItem\s*:\s*(\d+)/.exec(html) || [])[1], weight: (/Weight:\s*([\d.]+)\s*g/.exec(t) || [])[1], name: (/Item No:[^\n]*\n/.exec(t) || [''])[0] };
  });
  if (!info.idItem) throw new Error('BrickLink 目錄找不到 ' + bl);
  items[bl] = { idItem: +info.idItem, weight: num(info.weight), name: title.replace(/\s*:\s*Part.*$/, '') };
  console.log(bl, items[bl].name, items[bl].weight + 'g');
  await pause(1200);
}

// ---- 價格指南與在售清單 ----
const lots = cached?.lots || {};
if (!cached) for (const l of bom.lots) {
  const title = await open(`https://www.bricklink.com/catalogPG.asp?P=${encodeURIComponent(l.bl)}&colorID=${l.blColor}`);
  const colorOk = title.includes(`in ${l.colorEn} Color`);
  const pg = await page.evaluate(() => {
    const t = document.body.innerText.replace(/ /g, ' ');
    const re = /(Times Sold|Total Lots):\s*([\d,]+)\s*Total Qty:\s*([\d,]+)\s*Min Price:\s*TWD\s*([\d,.]+)\s*Avg Price:\s*TWD\s*([\d,.]+)\s*Qty Avg Price:\s*TWD\s*([\d,.]+)/g;
    const out = []; let m; while ((m = re.exec(t))) out.push(m.slice(1));
    return out;
  });
  // 版面固定為：近 6 個月（全新、二手）→ 目前在售（全新、二手）；只取全新
  const sold = pg.find((r) => r[0] === 'Times Sold'), cur = pg.find((r) => r[0] === 'Total Lots');
  const ifs = await page.evaluate(async ({ id, c, q, ss }) => {
    const r = await fetch(`/ajax/clone/catalogifs.ajax?itemid=${id}&color=${c}&cond=N&minqty=${q}&ss=${ss}&rpp=100&pi=1`);
    return r.json();
  }, { id: items[l.bl].idItem, c: l.blColor, q: l.qty, ss: SHIP_TO });
  const sellers = (ifs.list || []).map((x) => ({ idInv: x.idInv, store: x.strStorename, user: x.strSellerUsername, country: x.strSellerCountryCode, price: num(x.mDisplaySalePrice), qty: x.n4Qty, minBuy: num(x.mMinBuy), color: x.strColor }));
  lots[l.key] = {
    bl: l.bl, blColor: l.blColor, qty: l.qty, colorOk, colorName: sellers[0]?.color || null,
    sold6mNew: sold ? { times: num(sold[1]), qty: num(sold[2]), min: num(sold[3]), avg: num(sold[4]), qtyAvg: num(sold[5]) } : null,
    forSaleNew: cur ? { lots: num(cur[1]), qty: num(cur[2]), min: num(cur[3]), avg: num(cur[4]), qtyAvg: num(cur[5]) } : null,
    sellersShippingToTW: ifs.total_count ?? sellers.length,
    sellers,
  };
  console.log(l.key, colorOk ? '' : '顏色不符！', 'TW 賣家', lots[l.key].sellersShippingToTW, '最低', sellers[0]?.price, '均價', lots[l.key].forSaleNew?.avg);
  await pause(1200);
}

fs.mkdirSync(path.dirname(CACHE), { recursive: true });
fs.writeFileSync(CACHE, JSON.stringify({ items, lots }));

// ---- 購物車方案：貪婪集合覆蓋（每多一家店估 NT$ 250 運費門檻成本），盡量少店、總價低 ----
const STORE_COST = 250;
const stores = new Map();
for (const [key, lot] of Object.entries(lots)) for (const s of lot.sellers) {
  if (!stores.has(s.user)) stores.set(s.user, { user: s.user, store: s.store, country: s.country, minBuy: s.minBuy, offers: new Map() });
  const st = stores.get(s.user);
  const prev = st.offers.get(key);
  if (!prev || s.price < prev.price) st.offers.set(key, { price: s.price, qty: s.qty, idInv: s.idInv });
}
const need = new Set(Object.keys(lots));
const plan = [];
while (need.size) {
  let best = null;
  for (const st of stores.values()) {
    const cover = [...need].filter((k) => st.offers.has(k));
    if (!cover.length) continue;
    // 店家有最低消費（Minimum Buy）：這一單的小計不到門檻就不能選
    const sub = cover.reduce((s, k) => s + st.offers.get(k).price * lots[k].qty, 0);
    if (st.minBuy && sub < st.minBuy) continue;
    // 這家店能省下的錢：每個涵蓋的零件以「市場最低價 × 1.6」當作不在這家買的替代成本
    let gain = -STORE_COST;
    for (const k of cover) { const alt = lots[k].sellers[0].price * 1.6 * lots[k].qty + 30; gain += alt - st.offers.get(k).price * lots[k].qty; }
    if (!best || gain > best.gain) best = { st, cover, gain };
  }
  if (!best) break;
  const items2 = best.cover.map((k) => ({ key: k, bl: lots[k].bl, blColor: lots[k].blColor, qty: lots[k].qty, price: best.st.offers.get(k).price, idInv: best.st.offers.get(k).idInv }));
  const subtotal = items2.reduce((s, x) => s + x.price * x.qty, 0);
  plan.push({ store: best.st.store, user: best.st.user, country: best.st.country, minBuy: best.st.minBuy, items: items2, subtotal: +subtotal.toFixed(2) });
  for (const k of best.cover) need.delete(k);
}
if (cached) await open('https://www.bricklink.com/v2/catalog/catalogitem.page?P=3001');
// 只為一兩樣零件多開一家店不划算：往後翻在售清單，看已選的店有沒有這些零件，有就併過去
for (let i = plan.length - 1; i >= 0; i--) {
  const small = plan[i];
  if (small.subtotal >= 100) continue;
  const others = new Set(plan.filter((x) => x !== small).map((x) => x.user));
  const moved = [];
  for (const it of small.items) {
    let hit = null;
    for (let pi = 2; pi <= 30 && !hit; pi++) {
      const res = await page.evaluate(async ({ id, c, q, ss, pi }) => (await fetch(`/ajax/clone/catalogifs.ajax?itemid=${id}&color=${c}&cond=N&minqty=${q}&ss=${ss}&rpp=100&pi=${pi}`)).json(),
        { id: items[it.bl].idItem, c: it.blColor, q: it.qty, ss: SHIP_TO, pi });
      if (!res.list?.length) break;
      hit = res.list.find((x) => others.has(x.strSellerUsername));
      await pause(600);
    }
    if (hit) moved.push({ it, user: hit.strSellerUsername, price: num(hit.mDisplaySalePrice), idInv: hit.idInv });
  }
  if (moved.length === small.items.length) {
    for (const m of moved) {
      const dst = plan.find((x) => x.user === m.user);
      dst.items.push({ ...m.it, price: m.price, idInv: m.idInv }); dst.subtotal = +(dst.subtotal + m.price * m.it.qty).toFixed(2);
    }
    plan.splice(i, 1);
    console.log('併單：', small.store, '→', moved.map((m) => m.user + ' ' + m.it.key + ' @' + m.price).join('、'));
  }
}
const unit = {};
for (const s of plan) for (const it of s.items) unit[it.key] = { unit: it.price, store: s.store, user: s.user, country: s.country };
const total = plan.reduce((s, x) => s + x.subtotal, 0);
const date = new Date().toISOString().slice(0, 10);
const out = {
  meta: {
    date, currency: 'TWD', shipTo: SHIP_TO, source: 'BrickLink 價格指南與在售清單（全新、可寄台灣）',
    stores: plan.length, total: +total.toFixed(2), uncovered: [...need],
    note: `${date} 查詢 BrickLink，${plan.length} 家可寄台灣的店湊齊全部零件，不含運費與稅`,
  },
  plan,
  lots: Object.fromEntries(Object.entries(lots).map(([k, v]) => [k, { ...v, unit: unit[k]?.unit ?? null, store: unit[k]?.store ?? null, sellers: v.sellers.slice(0, 5) }])),
};
fs.writeFileSync(path.join(OUT, 'prices.json'), JSON.stringify(out, null, 1));
const weights = {};
for (const l of bom.lots) weights[l.id] = items[l.bl].weight;
fs.writeFileSync(path.join(OUT, 'weights.json'), JSON.stringify(weights, null, 1));
console.log('stores', plan.length, 'total TWD', total.toFixed(0), 'uncovered', [...need]);
await browser.close();
