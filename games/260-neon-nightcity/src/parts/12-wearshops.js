// ═══ 服裝店的店面（69-wear.js 的店內與買賣）：每區挑兩個一樓店面，20-props.js 的店招照常抽亂數，只把招牌換成服裝店的 ═══
// 在這裡挑是因為 20-props.js 的招牌迴圈接著就跑；不用任何全域亂數（rnd／R／r3），只看店面本身與區名，改別的東西不會換掉這些店
// 四種店型輪流：budget 平價、street 街頭、sport 運動、boutique 精品；同一區的兩間一定不同型
const WEAR_TYPES = ['budget', 'street', 'sport', 'boutique'];
const WEAR_NAMES = {
  budget: [['THRIFT LANE', '拾衣巷 · 平價衣著'], ['BASIC BOX', '基本盒 · 每天穿'], ['DAILY THREADS', '日常線 · 平價'], ['CLOTHESLINE', '晾衣繩 · 衣褲鞋帽'], ['STOCK ROOM', '庫存間 · 出清'],
    ['FOLD & GO', '摺好就走 · 平價'], ['PENNY WEAR', '一分錢 · 衣著'], ['EVERYDAY 7', '天天穿 · 七號店'], ['BARGAIN LOFT', '撿便宜閣樓'], ['CORNER STOCK', '轉角庫存']],
  street: [['NIGHTSHIFT', 'SUPPLY · 夜班補給'], ['CONCRETE CULT', '水泥信徒'], ['BACKALLEY', '後巷 · 街頭'], ['STATIC CLUB', '靜電俱樂部'], ['NEON DRIP', '霓虹滴'],
    ['CURB KINGS', '路緣之王'], ['LOW TIDE', '退潮 · 街頭'], ['RUSH HOUR', '尖峰時刻'], ['GRAFFITI CO', '塗鴉社'], ['NO SIGNAL', '沒有訊號']],
  sport: [['PACE LAB', '配速實驗室'], ['SECOND WIND', '第二口氣 · 運動'], ['APEX ATHLETIC', '頂點運動'], ['BLOCK RUNNERS', '街區跑者'], ['TRACK 9', '第九跑道'],
    ['STRIDE HOUSE', '步幅屋'], ['COURTSIDE', '場邊 · 球鞋'], ['HARBOR SPORTS', '港灣運動'], ['CORE & CO', '核心 · 機能'], ['FULL TILT', '全力 · 運動']],
  boutique: [['ATELIER NOIR', '黑色工坊'], ['VELVET & ASH', '絲絨與灰'], ['MAISON LUNE', '月之屋'], ['IVORY ROOM', '象牙廳'], ['OBSIDIAN', '黑曜'],
    ['SILK ROUTE', '絲路 · 精品'], ['HALCYON', '翠鳥 · 精品'], ['CASSIA', '肉桂 · 選物'], ['NORTH STAR', 'TAILORS · 北極星'], ['GILT & GRAIN', '金箔與木紋']],
};
// 招牌與店內的主色（招牌燈光的顏色）
const WEAR_GLOW = { budget: 0xffd23a, street: 0xff3fb4, sport: 0x4ee6ff, boutique: 0xf0c890 };
const WEAR_SHOPS = [];
{
  const byD = new Map();
  for (const su of shopUnits) {
    if (su.special || su.shut || su.w < 4.5 || !su.lot || su.lot.back || su.lot.glb) continue;
    const d = district(su.x, su.z);
    if (d === '城郊 Outskirts') continue;
    // 離安全屋的門、車庫遠一點（門口的互動提示才不會疊在一起）
    if (Object.values(APT_DOORS).some(o => Math.hypot(o.x - su.x, o.z - su.z) < 14)) continue;
    if (!byD.has(d)) byD.set(d, []);
    byD.get(d).push(su);
  }
  WEAR_SHOPS.cand = [...byD].map(([d, l]) => [d, l.length]);
  // 照位置雜湊排順序，第一間取最前面的，第二間取同區離第一間 90 m 以上的第一個（沒有就取最遠的）
  const key = su => { const v = Math.sin(su.x * .731 + su.z * 1.913) * 43758.5453; return v - Math.floor(v); };
  const used = { budget: 0, street: 0, sport: 0, boutique: 0 };
  let di = 0;
  for (const [d, list] of byD) {
    if (list.length < 2) continue;
    const l = [...list].sort((a, b) => key(a) - key(b));
    const a = l[0], far = l.find(u => Math.hypot(u.x - a.x, u.z - a.z) > 90) || l.reduce((m, u) => Math.hypot(u.x - a.x, u.z - a.z) > Math.hypot(m.x - a.x, m.z - a.z) ? u : m, l[1]);
    for (const [j, su] of [a, far].entries()) {
      const type = WEAR_TYPES[(di * 3 + j) % 4], nm = WEAR_NAMES[type][used[type]++ % 10];
      // door：門口外 1.1 m 的互動點（邏輯座標）；out：出門時站的位置與朝向（背對店面）
      const s = { i: WEAR_SHOPS.length, d, type, name: nm[0], sub: nm[1], glow: WEAR_GLOW[type], su, nx: su.nx, nz: su.nz,
        door: { x: su.x + su.nx * 1.1, z: su.z + su.nz * 1.1 }, out: { x: su.x + su.nx * 1.6, z: su.z + su.nz * 1.6, yaw: Math.atan2(su.nx, su.nz) } };
      su.wear = s;
      // 櫥窗裡畫成服裝店（10-city.js 的 shopRoom）：標在這個面的 masks 第 16 位以上（低位是鐵捲門；頂點屬性是 float，只放得下第 16–23 位）；遠景的立面已經建好了，近處的細模串流時才讀得到
      if (su.u < 8 && su.lot.fz && su.lot.fz.masks[su.fk]) su.lot.fz.masks[su.fk][0] |= 1 << (su.u + 16);
      WEAR_SHOPS.push(s);
    }
    di++;
  }
}
