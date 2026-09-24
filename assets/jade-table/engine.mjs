// 青雀台灣十六張：rules and scoring shared by the browser practice game and authoritative server.
// Source decisions and explicit table variations: plans/127-jade-table-research.md.
export const RULES_ID = 'jade-tw16-v1';
export const TILE_NAMES = Array.from({ length: 27 }, (_, t) => '一二三四五六七八九'[t % 9] + ['萬', '筒', '條'][Math.floor(t / 9)]).concat(['東', '南', '西', '北', '中', '發', '白', '春', '夏', '秋', '冬', '梅', '蘭', '菊', '竹']);
export const TAI_TABLE = [
  ['屁胡', 0, '合法胡牌，仍收一底'], ['門清', 1, '無外露吃碰槓，暗槓不破門清'], ['自摸', 1, '自己摸得胡牌'], ['門清自摸', 3, '合計三台，不重複門清、自摸'],
  ['宣告聽牌', 1, '宣告後鎖手'], ['地聽', 4, '本人首棄牌宣告且未鳴牌；不計門清、聽牌，自摸另二台'], ['圈風／門風', 1, '對應刻槓各一台'], ['三元牌', 1, '中發白刻槓各一台；大小三元不重複'],
  ['正花', 1, '東春梅、南夏蘭、西秋菊、北冬竹'], ['花槓', 2, '四季或四君子齊，替代該組正花'], ['單吊／嵌張／邊張', 1, '只聽單一牌種，只取一項'],
  ['平胡', 2, '五順子、數牌將、無花字、非自摸、真正兩面順子等待'], ['全求人／半求人', '2／1', '五組全外露，榮胡二、自摸一；不加單吊'],
  ['碰碰胡', 4, '五組刻槓'], ['三／四／五暗刻', '2／5／8', '只取最高；榮胡補成的刻子不算暗刻'], ['湊一色', 4, '一門數牌與字牌'], ['清一色', 8, '一門數牌無字'], ['字一色', 8, '全字牌；不加碰碰胡'],
  ['小／大三元', '4／8', '兩龍刻一龍將／三龍刻；不重複三元台'], ['小／大四喜', '8／16', '三風刻一風將／四風刻；大四喜不計門圈風'], ['槓上開花', 1, '暗槓、加槓或補花自摸；明槓補牌不可自摸'], ['搶槓', 1, '搶加槓胡，算加槓者放銃'], ['海底自摸', 1, '最後活牌自摸'],
  ['人胡／地胡／天胡', '8／16／24', '首輪首棄放銃／閒家首次摸牌自摸／莊家起手胡'], ['七搶一／八仙過海', 8, '花胡依來源逐家結算；配牌花胡另四台'], ['莊家／連莊', '1＋2N', '每筆涉及莊家的付款另加，最多連九']
];
const CLAIM_PRIORITY = { win: 3, openKong: 2, pung: 2, chow: 1, pass: 0 };
const four = fn => Array.from({ length: 4 }, (_, p) => fn(p));
const count = (hand, t) => hand.filter(x => x === t).length;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function randomInt(n) { const a = new Uint32Array(1), limit = 4294967296 - 4294967296 % n; do { crypto.getRandomValues(a); } while (a[0] >= limit); return a[0] % n; }
function shuffledWall() { const a = Array.from({ length: 136 }, (_, i) => Math.floor(i / 4)).concat([34, 35, 36, 37, 38, 39, 40, 41]); for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function decompositions(hand, melds = []) {
  if (hand.length !== 17 - melds.length * 3) return [];
  const c = Array(34).fill(0), all = Array(34).fill(0);
  for (const t of hand.concat(melds.flatMap(m => m.tiles))) if (!Number.isInteger(t) || t < 0 || t > 33 || ++all[t] > 4) return [];
  hand.forEach(t => c[t]++); const out = [];
  function walk(groups, pair) {
    const t = c.findIndex(n => n > 0);
    if (t < 0) { if (groups.length + melds.length === 5) out.push({ pair, groups: groups.map(g => ({ ...g, tiles: g.tiles.slice() })) }); return; }
    if (c[t] >= 3) { c[t] -= 3; walk([...groups, { type: 'pung', tiles: [t, t, t], closed: true }], pair); c[t] += 3; }
    if (t < 27 && t % 9 < 7 && c[t + 1] && c[t + 2]) { c[t]--; c[t + 1]--; c[t + 2]--; walk([...groups, { type: 'chow', tiles: [t, t + 1, t + 2], closed: true }], pair); c[t]++; c[t + 1]++; c[t + 2]++; }
  }
  for (let t = 0; t < 34; t++) if (c[t] >= 2) { c[t] -= 2; walk([], t); c[t] += 2; }
  return out;
}
export const canWin = (hand, melds = []) => decompositions(hand, melds).length > 0;
export function waitingTiles(hand, melds = []) { if (hand.length !== 16 - melds.length * 3) return []; return Array.from({ length: 34 }, (_, t) => t).filter(t => canWin([...hand, t], melds)); }
function flowerItems(flowers, wind) {
  const items = [];
  for (const start of [34, 38]) {
    if ([0, 1, 2, 3].every(n => flowers.includes(start + n))) items.push({ name: start === 34 ? '四季花槓' : '四君子花槓', tai: 2 });
    else if (flowers.includes(start + wind)) items.push({ name: `正花・${TILE_NAMES[start + wind]}`, tai: 1 });
  }
  return items;
}
// Score every decomposition and every possible use of the winning tile, then choose the best.
export function scoreHand({ hand, melds = [], flowers = [], wind = 0, roundWind = 0, tile, selfDraw = false, source = '', lastTile = false, declared = false, earthReady = false, heaven = false, earth = false, human = false, flowerRob = false }) {
  const before = hand.slice(); before.splice(before.lastIndexOf(tile), 1);
  const waits = waitingTiles(before, melds), closed = melds.every(m => m.closed), exposedFive = melds.length === 5 && melds.every(m => !m.closed);
  let best = null;
  for (const split of decompositions(hand, melds)) {
    const uses = split.groups.map((g, i) => g.tiles.includes(tile) ? i : -2).filter(i => i >= 0);
    if (split.pair === tile) uses.push(-1);
    for (const use of uses) {
      const items = [], add = (name, tai) => items.push({ name, tai });
      const groups = [...melds, ...split.groups], triples = groups.filter(g => g.type !== 'chow').map(g => g.tiles[0]);
      const dragons = triples.filter(t => t >= 31).length, windTriples = triples.filter(t => t >= 27 && t < 31).length;
      const concealed = groups.filter((g, i) => g.type !== 'chow' && g.closed && (selfDraw || flowerRob || use < 0 || i !== melds.length + use)).length;
      const tiles = hand.concat(melds.flatMap(m => m.tiles)), suits = new Set(tiles.filter(t => t < 27).map(t => Math.floor(t / 9))), honors = tiles.some(t => t >= 27);
      if (heaven) add('天胡', 24); else if (earth) add('地胡', 16); else if (human) add('人胡', 8);
      if (earthReady && !human) { add('地聽', 4); if (selfDraw) add('地聽自摸', 2); }
      else { if (closed && selfDraw) add('門清自摸', 3); else { if (closed) add('門清', 1); if (selfDraw) add('自摸', 1); } if (declared && !earthReady) add('宣告聽牌', 1); }
      if (windTriples === 4) add('大四喜', 16);
      else { if (windTriples === 3 && split.pair >= 27 && split.pair < 31) add('小四喜', 8); if (triples.includes(27 + wind)) add('門風', 1); if (triples.includes(27 + roundWind)) add('圈風', 1); }
      if (dragons === 3) add('大三元', 8); else if (dragons === 2 && split.pair >= 31) add('小三元', 4); else triples.filter(t => t >= 31).forEach(t => add(`${TILE_NAMES[t]}刻／槓`, 1));
      if (!suits.size) add('字一色', 8); else { if (suits.size === 1) add(honors ? '湊一色' : '清一色', honors ? 4 : 8); if (groups.every(g => g.type !== 'chow')) add('碰碰胡', 4); }
      if (concealed >= 3) add(['', '', '', '三暗刻', '四暗刻', '五暗刻'][concealed], ({ 3: 2, 4: 5, 5: 8 })[concealed]);
      if (exposedFive) add(selfDraw ? '半求人' : '全求人', selfDraw ? 1 : 2);
      const group = use < 0 ? null : split.groups[use];
      const middle = group?.type === 'chow' && group.tiles[1] === tile;
      const edge = group?.type === 'chow' && (group.tiles[0] % 9 === 0 && tile % 9 === 2 || group.tiles[0] % 9 === 6 && tile % 9 === 6);
      if (!exposedFive && waits.length === 1) { if (use < 0) add('單吊', 1); else if (middle) add('嵌張', 1); else if (edge) add('邊張', 1); }
      if (!selfDraw && !flowerRob && !flowers.length && !honors && groups.every(g => g.type === 'chow') && use >= 0 && !middle && !edge && waits.length > 1) add('平胡', 2);
      items.push(...flowerItems(flowers, wind));
      if ((selfDraw || flowerRob) && ['flower', 'closedKong', 'addedKong'].includes(source)) add('槓上開花', 1);
      if (source === 'robKong') add('搶槓', 1);
      if (selfDraw && lastTile) add('海底自摸', 1);
      const tai = items.reduce((n, x) => n + x.tai, 0);
      if (!best || tai > best.tai) best = { tai, items: items.length ? items : [{ name: '屁胡', tai: 0 }] };
    }
  }
  return best;
}

export class MahjongGame {
  constructor({ names = ['你', '月白', '竹隱', '遠山'], bots = [false, true, true, true], base = 100, unit = 20, turnMs = 20000, claimMs = 10000 } = {}) {
    this.names = names; this.bots = bots; this.base = base; this.unit = unit; this.turnMs = turnMs; this.claimMs = claimMs;
    this.scores = [1000, 1000, 1000, 1000]; this.round = 0; this.dealer = 0; this.streak = 0; this.rotations = 0; this.actionId = 0; this.state = null;
  }
  setBot(p, bot) { this.bots[p] = bot; }
  shiftTime(ms) { if (this.state?.deadline) this.state.deadline += ms; if (this.state?.botAt) this.state.botAt += ms; }
  log(text) { this.state.log.unshift(text); this.state.log.length = Math.min(25, this.state.log.length); }
  liveCount() { return Math.max(0, this.state.wall.length - 16); }
  enter(phase, now) { this.state.phase = phase; this.actionId++; this.state.deadline = now + (phase === 'reaction' ? this.claimMs : this.turnMs); this.state.botAt = now + 800; }
  startRound(now = Date.now()) {
    if (this.state && this.state.phase !== 'ended') throw Error('請先完成目前牌局。');
    if (this.state) {
      const winner = this.state.result.winner;
      if ((winner === -1 || winner === this.dealer) && this.streak < 9) this.streak++;
      else { this.streak = 0; this.dealer = (this.dealer + 1) % 4; this.rotations++; }
    }
    this.round++;
    this.state = { phase: 'dealing', hands: four(() => []), melds: four(() => []), flowers: four(() => []), discards: four(() => []), discardCount: [0, 0, 0, 0], drawCount: [0, 0, 0, 0], declared: [false, false, false, false], earthReady: [false, false, false, false], passed: four(() => []), passedPung: four(() => []), wall: shuffledWall(), turn: this.dealer, source: '', drawn: -1, last: null, log: [], result: null, anyCall: false, initialFlower: [false, false, false, false] };
    for (let n = 0; n < 16; n++) for (let d = 0; d < 4; d++) this.draw((this.dealer + d) % 4, 'deal', true);
    this.state.hands.forEach(h => h.sort((a, b) => a - b));
    for (let p = 0; p < 4; p++) this.state.initialFlower[p] = this.state.flowers[p].length >= 7;
    this.log(`第 ${this.round} 局，${this.names[this.dealer]}坐莊，連莊 ${this.streak}。`);
    this.beginTurn(this.dealer, now);
  }
  draw(p, source = 'normal', dealing = false) {
    const s = this.state;
    let tail = !['normal', 'deal'].includes(source), flowerDraw = false;
    while (this.liveCount() > 0) {
      const t = tail ? s.wall.pop() : s.wall.shift();
      if (t >= 34) {
        s.flowers[p].push(t); flowerDraw = true; tail = true;
        if (!dealing) this.log(`${this.names[p]}補花 ${TILE_NAMES[t]}。`);
        // A player already holding seven flowers takes an opponent's newly drawn eighth.
        const seven = s.flowers.findIndex((f, q) => q !== p && f.length === 7);
        if (!dealing && seven >= 0) {
          s.flowers[p].pop(); s.flowers[seven].push(t);
          this.draw(seven, 'flower', true);
          this.finish(seven, p, 'flower', { payer: p, branch: 'rob', initial: s.initialFlower[seven] });
          return false;
        }
        continue;
      }
      s.hands[p].push(t);
      if (!dealing) { s.drawn = s.hands[p].length - 1; s.source = source === 'openKong' ? source : flowerDraw ? 'flower' : source; }
      return true;
    }
    if (!dealing) this.finish(-1);
    return false;
  }
  beginTurn(p, now, source = 'normal', draw = true) {
    const s = this.state; s.turn = p; s.drawn = -1; s.source = source; s.passedPung[p] = [];
    if (draw) {
      if (source === 'normal') s.drawCount[p]++;
      if (!this.draw(p, source) || s.phase === 'ended') return;
    }
    this.enter('playing', now);
    const f = s.flowers[p];
    if (f.length === 8) { this.finish(p, -1, s.source, { payer: -1, branch: 'eight', initial: s.initialFlower[p] }); return; }
    if (f.length === 7) {
      const other = s.flowers.findIndex((flowers, q) => q !== p && flowers.length === 1);
      if (other >= 0) { const own = f.slice(); f.push(s.flowers[other].pop()); this.finish(p, other, s.source, { payer: other, branch: 'collect', own, initial: s.initialFlower[p] }); }
    }
  }
  selfWin(p) { const s = this.state; return s.drawn >= 0 && !s.passed[p].length && s.source !== 'openKong' && canWin(s.hands[p], s.melds[p]); }
  options(p) {
    const s = this.state; if (!s) return [];
    if (s.phase === 'reaction') return s.responses[p] ? [] : s.offers[p] || [];
    if (s.phase !== 'playing' || s.turn !== p) return [];
    const out = [];
    if (this.selfWin(p)) out.push({ kind: 'win' });
    if (this.liveCount() > 0) {
      for (let t = 0; t < 34; t++) {
        if (count(s.hands[p], t) === 4 && !s.declared[p]) out.push({ kind: 'closedKong', tile: t });
        if (s.melds[p].some(m => m.type === 'pung' && m.tiles[0] === t) && s.hands[p].includes(t)) {
          if (!s.declared[p] || s.hands[p][s.drawn] === t) out.push({ kind: 'addedKong', tile: t });
        }
      }
    }
    return out;
  }
  offers(p, tile, rob = false) {
    const s = this.state, out = [];
    if (!s.passed[p].length && canWin([...s.hands[p], tile], s.melds[p])) out.push({ kind: 'win' });
    if (rob || s.declared[p] || !this.liveCount()) return out;
    const from = s.last.p, n = count(s.hands[p], tile);
    if (n >= 3 && p !== (from + 1) % 4) out.push({ kind: 'openKong', tile });
    if (n >= 2 && !s.passedPung[p].includes(tile)) out.push({ kind: 'pung', tile });
    if (p === (from + 1) % 4 && tile < 27) {
      for (let start = tile - 2; start <= tile; start++) {
        if (start < 0 || Math.floor(start / 9) !== Math.floor(tile / 9) || start % 9 > 6) continue;
        const tiles = [start, start + 1, start + 2], need = tiles.slice(); need.splice(need.indexOf(tile), 1);
        if (need.every(t => s.hands[p].includes(t))) out.push({ kind: 'chow', tiles });
      }
    }
    return out;
  }
  openReactions(now, rob = false) {
    const s = this.state; s.rob = rob; s.offers = four(p => p === s.last.p ? [] : this.offers(p, s.last.t, rob)); s.responses = [null, null, null, null];
    this.enter('reaction', now);
    if (s.offers.every(a => !a.length)) this.resolve(now);
  }
  markPass(p, action) {
    const s = this.state, opts = s.offers[p];
    if (opts.some(o => o.kind === 'win') && action.kind !== 'win') { s.passed[p] = waitingTiles(s.hands[p], s.melds[p]); s.earthReady[p] = false; }
    if (opts.some(o => o.kind === 'pung') && !['pung', 'openKong', 'win'].includes(action.kind)) s.passedPung[p].push(s.last.t);
  }
  act(p, action, actionId, now = Date.now()) {
    const s = this.state;
    if (!s || s.phase === 'ended' || actionId !== this.actionId) throw Error('回合已變更，請依最新牌桌操作。');
    if (!Number.isInteger(p) || p < 0 || p > 3 || !action || typeof action.kind !== 'string') throw Error('操作格式錯誤。');
    if (s.phase === 'reaction') {
      if (!s.offers[p].length || s.responses[p]) throw Error('目前不能回應此牌。');
      const match = this.options(p).find(o => o.kind === action.kind && (o.tile === undefined || o.tile === action.tile) && (!o.tiles || same(o.tiles, action.tiles)));
      if (action.kind !== 'pass' && !match) throw Error('不能執行這個吃碰槓胡動作。');
      this.markPass(p, action); s.responses[p] = match || { kind: 'pass' };
      // Resolve as soon as no unanswered player can beat the selected claim.
      const rank = (q, o) => CLAIM_PRIORITY[o.kind] * 4 - (q - s.last.p + 4) % 4;
      const best = Math.max(-Infinity, ...s.responses.flatMap((o, q) => o && o.kind !== 'pass' ? [rank(q, o)] : []));
      if (s.offers.every((opts, q) => s.responses[q] || opts.every(o => rank(q, o) < best))) this.resolve(now);
      return;
    }
    if (s.phase !== 'playing' || s.turn !== p) throw Error('還沒輪到你。');
    if (action.kind === 'discard') {
      const i = action.index;
      if (!Number.isInteger(i) || i < 0 || i >= s.hands[p].length || (s.declared[p] && i !== s.drawn)) throw Error('手牌位置無效，聽牌後只能打出新摸的牌。');
      const t = s.hands[p][i], rest = s.hands[p].filter((_, j) => j !== i);
      if (action.ready && (s.declared[p] || !waitingTiles(rest, s.melds[p]).length)) throw Error('打出這張牌後尚未聽牌。');
      if (this.selfWin(p)) { const before = s.hands[p].slice(); before.splice(s.drawn >= 0 ? s.drawn : i, 1); s.passed[p] = waitingTiles(before, s.melds[p]); s.earthReady[p] = false; }
      if (!s.passed[p].includes(t)) s.passed[p] = [];
      if (action.ready) { s.declared[p] = true; s.earthReady[p] = s.discardCount[p] === 0 && s.melds[p].length === 0; this.log(`${this.names[p]}宣告${s.earthReady[p] ? '地聽' : '聽牌'}。`); }
      s.hands[p] = rest.sort((a, b) => a - b); s.discards[p].push(t); s.discardCount[p]++; s.drawn = -1; s.last = { p, t }; s.pendingKong = null;
      this.log(`${this.names[p]}打出${TILE_NAMES[t]}。`); this.openReactions(now); return;
    }
    const match = this.options(p).find(o => o.kind === action.kind && (o.tile === undefined || o.tile === action.tile));
    if (!match) throw Error('這個動作目前不合法。');
    if (action.kind === 'win') { this.finish(p, -1, s.source); return; }
    const t = action.tile;
    if (action.kind === 'closedKong') {
      this.remove(p, [t, t, t, t]); s.melds[p].push({ type: 'kong', tiles: [t, t, t, t], closed: true, from: p }); s.anyCall = true; this.log(`${this.names[p]}暗槓。`); s.last = null; this.beginTurn(p, now, 'closedKong'); return;
    }
    if (action.kind === 'addedKong') { s.last = { p, t }; s.pendingKong = { p, t }; this.log(`${this.names[p]}準備加槓${TILE_NAMES[t]}。`); this.openReactions(now, true); }
  }
  remove(p, tiles) { for (const t of tiles) { const i = this.state.hands[p].indexOf(t); if (i < 0) throw Error('手牌不足。'); this.state.hands[p].splice(i, 1); } }
  resolve(now) {
    const s = this.state, from = s.last.p, t = s.last.t;
    const priorities = CLAIM_PRIORITY;
    const claims = [1, 2, 3].map(d => ({ p: (from + d) % 4, action: s.responses[(from + d) % 4] })).filter(x => x.action && x.action.kind !== 'pass').sort((a, b) => priorities[b.action.kind] - priorities[a.action.kind]);
    const claim = claims[0];
    if (claim?.action.kind === 'win') {
      if (s.rob) this.remove(from, [t]); else s.discards[from].pop();
      s.hands[claim.p].push(t); this.finish(claim.p, from, s.rob ? 'robKong' : 'discard'); return;
    }
    if (s.rob) {
      const meld = s.melds[from].find(m => m.type === 'pung' && m.tiles[0] === t);
      this.remove(from, [t]); meld.type = 'kong'; meld.tiles.push(t); s.pendingKong = null; s.last = null; s.anyCall = true;
      this.log(`${this.names[from]}加槓。`); this.beginTurn(from, now, 'addedKong'); return;
    }
    if (!claim) { this.beginTurn((from + 1) % 4, now); return; }
    const { p, action } = claim, tiles = action.kind === 'chow' ? action.tiles : Array(action.kind === 'openKong' ? 4 : 3).fill(t), need = tiles.slice(); need.splice(need.indexOf(t), 1);
    this.remove(p, need); s.discards[from].pop(); s.melds[p].push({ type: action.kind === 'openKong' ? 'kong' : action.kind, tiles: tiles.slice(), closed: false, from }); s.anyCall = true; s.last = null;
    this.log(`${this.names[p]}${({ chow: '吃', pung: '碰', openKong: '明槓' })[action.kind]}${TILE_NAMES[t]}。`);
    this.beginTurn(p, now, action.kind === 'openKong' ? 'openKong' : 'claim', action.kind === 'openKong');
  }
  chooseDiscard(p) {
    const s = this.state, hand = s.hands[p]; if (s.declared[p]) return s.drawn;
    let best = Infinity, choices = [];
    hand.forEach((t, i) => { let value = (count(hand, t) - 1) * 4; if (t < 27) for (const d of [-2, -1, 1, 2]) if (t + d >= 0 && Math.floor((t + d) / 9) === Math.floor(t / 9)) value += count(hand, t + d) * (Math.abs(d) === 1 ? 1.6 : .7); if (value < best) { best = value; choices = [i]; } else if (value === best) choices.push(i); });
    return choices[randomInt(choices.length)];
  }
  tick(now = Date.now()) {
    const s = this.state; if (!s || s.phase === 'ended') return false;
    if (s.phase === 'playing') {
      if (this.bots[s.turn] && now >= s.botAt) {
        const opts = this.options(s.turn), choice = opts.find(o => o.kind === 'win') || opts.find(o => o.kind.endsWith('Kong'));
        this.act(s.turn, choice || { kind: 'discard', index: this.chooseDiscard(s.turn) }, this.actionId, now); return true;
      }
      if (now >= s.deadline) { this.act(s.turn, { kind: 'discard', index: s.drawn >= 0 ? s.drawn : s.hands[s.turn].length - 1 }, this.actionId, now); return true; }
      return false;
    }
    let changed = false;
    for (let p = 0; p < 4 && s.phase === 'reaction'; p++) {
      if (s.offers[p].length && !s.responses[p] && (now >= s.deadline || this.bots[p] && now >= s.botAt)) {
        this.act(p, this.bots[p] ? s.offers[p][0] : { kind: 'pass' }, this.actionId, now); changed = true;
      }
    }
    return changed;
  }
  finish(winner, from = -1, source = '', flower = null) {
    const s = this.state; this.enter('ended', Date.now()); s.deadline = 0;
    const delta = [0, 0, 0, 0], payments = []; let scoring = { tai: 0, items: [] };
    if (winner >= 0) {
      const wind = (winner - this.dealer + 4) % 4, tile = s.hands[winner].at(-1), selfDraw = from < 0 || flower?.branch === 'collect';
      scoring = scoreHand({ hand: s.hands[winner], melds: s.melds[winner], flowers: flower ? [] : s.flowers[winner], wind, roundWind: Math.floor(this.rotations / 4) % 4, tile, selfDraw, source, flowerRob: flower?.branch === 'rob', lastTile: !this.liveCount(), declared: s.declared[winner], earthReady: s.earthReady[winner], heaven: winner === this.dealer && s.discardCount.every(n => n === 0) && !s.anyCall, earth: winner !== this.dealer && selfDraw && s.drawCount[winner] === 1 && s.discardCount[winner] === 0 && !s.melds[winner].length, human: from >= 0 && s.discardCount[from] === 1 && !s.anyCall && source === 'discard' });
      const normalWin = !!scoring; scoring ||= { tai: 0, items: [] };
      if (flower) { const flowerTai = 8 + (flower.initial ? 4 : 0); scoring = { ...scoring, tai: scoring.tai + flowerTai, items: [...scoring.items, { name: flower.branch === 'eight' ? '八仙過海' : '七搶一', tai: 8 }, ...(flower.initial ? [{ name: '配牌花胡', tai: 4 }] : [])] }; }
      const payers = from < 0 || flower?.branch === 'collect' && normalWin ? [0, 1, 2, 3].filter(p => p !== winner) : [from];
      for (const p of payers) {
        let items = scoring.items.slice();
        if (flower?.branch === 'collect' && normalWin && p !== flower.payer) items = items.filter(x => !['七搶一', '配牌花胡'].includes(x.name)).concat(flowerItems(flower.own, wind));
        const dealerTai = winner === this.dealer || p === this.dealer ? 1 + 2 * this.streak : 0;
        if (dealerTai) items.push({ name: `莊家${this.streak ? '・連' + this.streak + '拉' + this.streak : ''}`, tai: dealerTai });
        const tai = items.reduce((n, x) => n + x.tai, 0), amount = this.base + this.unit * tai;
        delta[p] -= amount; delta[winner] += amount; payments.push({ from: p, to: winner, tai, amount, items });
      }
      this.scores = this.scores.map((n, p) => n + delta[p]);
      this.log(`${this.names[winner]}${flower ? '花胡' : from < 0 ? '自摸' : '胡牌'}，獲得 ${delta[winner]} 分。`);
    } else this.log('活牌已盡，保留十六張，流局續莊。');
    s.result = { winner, from, source, flower: !!flower, scoring, delta, payments };
  }
  view(viewer) {
    const s = this.state, ids = four(i => (i + viewer) % 4), relative = p => p < 0 ? p : (p - viewer + 4) % 4;
    const winner = s.result?.winner;
    return {
      rules: RULES_ID, actionId: this.actionId, round: this.round, dealer: relative(this.dealer), streak: this.streak, roundWind: Math.floor(this.rotations / 4) % 4, base: this.base, unit: this.unit,
      phase: s.phase, turn: relative(s.turn), source: s.source, drawn: s.turn === viewer ? s.drawn : -1, deadline: s.deadline, remaining: this.liveCount(), wallCount: s.wall.length,
      names: ids.map(p => this.names[p]), bots: ids.map(p => this.bots[p]), scores: ids.map(p => this.scores[p]),
      hands: ids.map(p => p === viewer || s.phase === 'ended' && p === winner ? s.hands[p].slice() : Array(s.hands[p].length).fill(null)),
      melds: ids.map(p => s.melds[p].map(m => ({ ...m, from: relative(m.from), tiles: m.closed && p !== viewer && !(s.phase === 'ended' && p === winner) ? m.tiles.map(() => null) : m.tiles.slice() }))),
      flowers: ids.map(p => s.flowers[p].slice()), discards: ids.map(p => s.discards[p].slice()), declared: ids.map(p => s.declared[p]),
      passedWin: s.passed[viewer].length > 0, options: this.options(viewer).map(o => ({ ...o })), canDiscard: s.phase === 'playing' && s.turn === viewer, canPass: s.phase === 'reaction' && s.offers[viewer].length > 0 && !s.responses[viewer],
      last: s.last ? { p: relative(s.last.p), t: s.last.t, rob: !!s.rob } : null, log: s.log.slice(),
      result: s.result ? { ...s.result, winner: relative(s.result.winner), from: relative(s.result.from), delta: ids.map(p => s.result.delta[p]), payments: s.result.payments.map(p => ({ ...p, from: relative(p.from), to: relative(p.to) })) } : null
    };
  }
}
