// X10 半自動霰彈槍。欄位說明見 index.js。
export default {
  id: 'x10', name: 'X10 半自動霰彈槍', slot: 1, price: 2300, mag: 7, rsv: 32, rpm: 240, dmg: 17, head: 36, pen: 0.7, range: 35, spread: 0.045, pellets: 6, speedK: 0.86, reload: 3.1, shell: 0.5, bonus: 900,
  stand: 's8', desc: '半自動連發，可以邊裝邊打。一發一發填，裝填途中開火會中斷。',
  // 裝彈口在機匣底部：翻得比步槍預設多，左手從下方送彈時看得到
  vm: { pose: [0.15, -0.155, 0.18, -2, 0], kick: [9, 0.06, 0.01, 0, 2.5, 13], kind: 'rifle', tilt: [-38, -10, -0.02, -0.035], reach: [0.1, -0.5, -0.1] },
  port: 0.34, flash: 1.5, bigCase: true, snd: [1.45, 1000, 85, 0.3],
};
