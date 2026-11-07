// N9 輕機槍。欄位說明見 index.js。
export default {
  id: 'n9', name: 'N9 輕機槍', slot: 1, price: 4700, mag: 100, rsv: 200, rpm: 800, dmg: 30, head: 100, pen: 0.74, range: 130, spread: 0.016, speedK: 0.74, reload: 5.6, auto: true, rec: 'n9', bonus: 300,
  stand: 'ar5', desc: '百發彈鏈，壓住炸點入口很有用。全場最慢，換彈時完全無法還手。',
  recoil: [0.015, 0.06, 0.8],
  vm: { pose: [0.16, -0.17, 0.2, -2, 0], kick: [2.4, 0.03, 0.004, 0, 1.1, 22], kind: 'rifle', reach: [0.12, -0.62, -0.12] },
  port: 0.4, flash: 1.2, bigCase: true, snd: [1.15, 1250, 105, 0.24],
};
