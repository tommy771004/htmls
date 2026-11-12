// 282 角色名審核（純函式、沒有相依：Vercel 的 /api/ro/game 與 Cloudflare 的大廳 Worker 共用）。
//   nameProblem(name, {format = true, extra = []}) → null（可以用）｜'format'｜'reserved'（冒充官方）｜'offensive'
//   nameKey(name)  比對用的正規化（NFKC、小寫、去掉空白 _ -）
// 用在三個地方：POST game/name（引擎建角、改名前會問，回 offensive 引擎顯示「這個名字不能用」）、
// 存檔驗證（game-rules.mjs：硬塞的名字換成「冒險者NNNN」並加上引擎原本的 rename 旗標，進遊戲前要先改名）、
// 大廳 hello（lobby-core.mjs：只查 reserved／offensive，不查格式，舊名字不受影響）。
// 比對前先正規化：全形轉半形、去掉分隔、常見的數字代字（sh1t）、拉長的字母（fuuuck）。
// 短的或容易誤判的字只比「整個詞」（GM、puta：不然 Sagami、computadora 會中），長的才比子字串。

const FORMAT = /^[\p{L}\p{N} _-]{2,16}$/u; // 同引擎 m5
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' };

// 冒充官方、管理人員
const RESERVED_ANY = ['admin', 'administrator', 'gamemaster', 'moderator', 'official', 'support', 'sysop', 'gravity',
  '管理員', '管理员', '管理者', '官方', '客服', '系統', '系统', '版主', '巡查', '運營', '运营', '營運', '营运', 'ＧＭ'];
const RESERVED_WORD = ['gm', 'gms', 'mod', 'system'];
// 不雅、仇恨（子字串）
// 英文、西文只放不會出現在一般名字裡的長字；shit（Yoshitaka、Matsushita）、verga（Vergara）、nazi（Ignazio）這類放在「整個詞」
const OFFENSIVE_ANY = ['fuck', 'bitch', 'nigger', 'nigga', 'faggot', 'whore', 'pussy', 'hitler',
  'mierda', 'pendejo', 'cabron', 'cabrón', 'maricon', 'maricón',
  '幹你', '干你娘', '操你', '肏', '屄', '雞巴', '鸡巴', '雞掰', '鸡掰', '機掰', '机掰', '懶叫', '婊子', '賤人', '贱人', '他媽的', '他妈的', '你媽的', '你妈的', '妓女',
  '強姦', '强奸', '支那', '納粹', '纳粹', '希特勒', '傻逼', '傻屄', '煞笔', '草泥馬', '草泥马', '去死'];
// 不雅（只比整個詞）
const OFFENSIVE_WORD = ['shit', 'cunt', 'nazi', 'porn', 'penis', 'vagina', 'rape', 'dick', 'cock', 'cum', 'fag', 'slut', 'tits', 'anal', 'sex',
  'puta', 'puto', 'polla', 'zorra', 'culo', 'verga', 'joder', 'coño'];

const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 把詞變成容許拉長的樣式：fuck → f+u+c+k+；原本就連續兩個的字母至少要兩個（nigger 不會打到 Niger）
function stretch(word) {
  let out = '';
  const cs = [...word];
  for (let i = 0; i < cs.length;) {
    let j = i;
    while (j < cs.length && cs[j] === cs[i]) j++;
    out += esc(cs[i]) + (j - i > 1 ? `{${j - i},}` : '+');
    i = j;
  }
  return out;
}
const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase();
const any = (words) => new RegExp(words.map((w) => stretch(norm(w))).join('|'), 'u');
const whole = (words) => new RegExp(`^(?:${words.map((w) => stretch(norm(w))).join('|')})$`, 'u');
const RE = { reservedAny: any(RESERVED_ANY), reservedWord: whole(RESERVED_WORD), offensiveAny: any(OFFENSIVE_ANY), offensiveWord: whole(OFFENSIVE_WORD) };

export const nameKey = (name) => norm(name).replace(/[\s_-]+/g, '');
const leet = (s) => s.replace(/[013457]/g, (d) => LEET[d]);

// 拆成詞：分隔符號、英文與其他文字的交界、大小寫交界（GMTommy → GM｜Tommy）；每個詞另外加一個去掉尾巴數字的樣子
function words(name) {
  const out = new Set();
  const raw = String(name ?? '').normalize('NFKC');
  for (const part of raw.match(/[A-Za-z0-9]+|[^A-Za-z0-9\s_-]+/gu) ?? []) {
    for (const w of part.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) {
      const t = w.toLowerCase();
      out.add(leet(t));
      out.add(leet(t.replace(/\d+$/, '')));
      out.add(t.replace(/\d+$/, ''));
    }
  }
  out.delete('');
  return [...out];
}

export function nameProblem(name, { format = true, extra = [] } = {}) {
  const raw = typeof name === 'string' ? name.trim() : '';
  if (format && !FORMAT.test(raw)) return 'format';
  if (!raw) return 'format';
  const key = nameKey(raw), keys = [key, leet(key)], ws = [...words(raw), ...keys];
  if (keys.some((k) => RE.reservedAny.test(k)) || ws.some((w) => RE.reservedWord.test(w))) return 'reserved';
  if (keys.some((k) => RE.offensiveAny.test(k)) || ws.some((w) => RE.offensiveWord.test(w))) return 'offensive';
  for (const x of extra) { const k = nameKey(x); if (k && keys.some((y) => y.includes(k))) return 'offensive'; }
  return null;
}

// 環境變數 RO_NAME_BLOCK（逗號分隔）→ 額外的禁用字
export const nameBlockList = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);

// 被換掉的名字：冒險者＋4 位數（由角色 id 算，同一個角色每次都一樣；符合引擎的名字格式）
export function fallbackName(seed) {
  let h = 2166136261;
  for (const c of String(seed ?? '')) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return `冒險者${String(h % 10000).padStart(4, '0')}`;
}
