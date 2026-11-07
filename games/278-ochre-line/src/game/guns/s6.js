// S6 輕型狙擊槍。欄位說明見 index.js。
export default {
  id: 's6', name: 'S6 輕型狙擊槍', slot: 1, price: 1700, mag: 10, rsv: 90, rpm: 48, dmg: 74, head: 215, pen: 0.85, range: 300, spread: 0.0012, hipSpread: 0.06, speedK: 0.93, reload: 3.2, scope: true, bonus: 300,
  stand: 'l40', desc: '輕量栓動，開鏡走得比 L40 快。打身體一槍不倒，要補第二發或打頭。',
  vm: { pose: [0.16, -0.175, 0.2, -2, 0], kick: [6, 0.06, 0.01, 0, 2, 11], kind: 'rifle', cycle: [0.2, 1.05, -24, -8, -0.012, 0.035] },
  port: 0.5, flash: 1.4, bigCase: true, snd: [1.35, 1300, 100, 0.4],
};
