// Gravity GRF（0x200 / 0x300）唯讀存取：只讀需要的檔案，不整包解壓。
// 檔名是 CP949（EUC-KR），以小寫、反斜線路徑作為索引鍵。
import fs from 'node:fs';
import zlib from 'node:zlib';

const dec = new TextDecoder('euc-kr');

export class Grf {
  constructor(path) {
    this.path = path;
    this.fd = fs.openSync(path, 'r');
    const h = this.#read(0, 46);
    if (!['Master of Magic', 'Event Horizon'].some((m) => h.toString('latin1', 0, m.length) === m)) throw new Error(`${path}: 不是 GRF`);
    this.version = h.readUInt32LE(42);
    let tableOff, count;
    if (this.version === 0x200) {
      tableOff = h.readUInt32LE(30) + 46;
      count = h.readUInt32LE(38) - h.readUInt32LE(34) - 7;
    } else if (this.version === 0x300) {
      tableOff = Number(h.readBigUInt64LE(30)) + 46;
      count = h.readUInt32LE(38);
    } else throw new Error(`${path}: 不支援的 GRF 版本 0x${this.version.toString(16)}`);
    let th = this.#read(tableOff, 12);
    let skip = 0;
    if (this.version === 0x300) skip = 4; // 0x300 表頭前多 4 bytes
    const comp = th.readUInt32LE(skip), real = th.readUInt32LE(skip + 4);
    const table = zlib.inflateSync(this.#read(tableOff + skip + 8, comp));
    if (table.length !== real) throw new Error('GRF 檔案表長度不符');
    this.entries = new Map();
    let p = 0;
    for (let i = 0; i < count && p < table.length; i++) {
      const end = table.indexOf(0, p);
      const name = dec.decode(table.subarray(p, end));
      p = end + 1;
      const e = {
        name,
        comp: table.readUInt32LE(p),
        aligned: table.readUInt32LE(p + 4),
        real: table.readUInt32LE(p + 8),
        flags: table[p + 12],
      };
      if (this.version === 0x300) { e.offset = Number(table.readBigUInt64LE(p + 13)) + 46; p += 21; }
      else { e.offset = table.readUInt32LE(p + 13) + 46; p += 17; }
      if (e.flags & 1) this.entries.set(name.toLowerCase().replaceAll('/', '\\'), e);
    }
  }
  #read(pos, len) {
    const b = Buffer.alloc(len);
    fs.readSync(this.fd, b, 0, len, pos);
    return b;
  }
  has(name) { return this.entries.has(name.toLowerCase().replaceAll('/', '\\')); }
  get(name) {
    const e = this.entries.get(name.toLowerCase().replaceAll('/', '\\'));
    if (!e) return null;
    if (e.flags & 6) throw new Error(`${e.name}: 加密的 GRF 項目（DES），尚未支援`);
    const raw = this.#read(e.offset, e.aligned);
    try { return zlib.inflateSync(raw.subarray(0, e.comp)); }
    catch { return raw.subarray(0, e.real); } // 少數項目未壓縮
  }
  list(prefix) {
    const pre = prefix.toLowerCase().replaceAll('/', '\\');
    return [...this.entries.values()].filter((e) => e.name.toLowerCase().replaceAll('/', '\\').startsWith(pre)).map((e) => e.name);
  }
}

// 多個 GRF 疊加：前面的優先（同 RO 客戶端 data.ini 的順序）。
export class GrfSet {
  constructor(paths) { this.grfs = paths.map((p) => new Grf(p)); }
  has(n) { return this.grfs.some((g) => g.has(n)); }
  get(n) { for (const g of this.grfs) if (g.has(n)) return g.get(n); return null; }
  list(prefix) { return [...new Set(this.grfs.flatMap((g) => g.list(prefix)))]; }
}
