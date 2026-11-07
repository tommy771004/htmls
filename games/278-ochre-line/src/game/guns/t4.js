// T4 輕型步槍。欄位說明見 index.js。
export default {
  id: 't4', name: 'T4 輕型步槍', slot: 1, price: 2000, mag: 35, rsv: 90, rpm: 680, dmg: 27, head: 96, pen: 0.7, range: 120, spread: 0.011, speedK: 0.89, reload: 2.5, auto: true, rec: 't4', bonus: 300,
  support: [0.052, 0.255], stand: 'ks', desc: '買不起主力步槍時的選擇。三十五發，便宜，連射散得比 AR5 開。',
  recoil: [0.0175, 0.05, 1.6],
  vm: { pose: [0.15, -0.155, 0.18, -2, 0], kick: [2, 0.024, 0.003, 0, 0.7, 25], kind: 'rifle', inspect: 0.65, boltT: 0.08, parts: [
    { box: [0.0095, 0.0465, 0.0725, 0.1075, 0.1185, 0.1405], ch: 'bolt', t: [0, 0, -0.055] },   // 左側拉機柄
    { box: [-0.0126, 0.0096, 0.055, 0.084, 0.0915, 0.1645], ch: 'bolt', t: [0, 0, -0.055] },   // 窗內槍機
  ] },
  port: 0.36, flash: 1, snd: [1, 1550, 120, 0.19],
};
