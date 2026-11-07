// M7 衝鋒槍。欄位說明見 index.js。
export default {
  id: 'm7', name: 'M7 衝鋒槍', slot: 1, price: 1500, mag: 30, rsv: 120, rpm: 800, dmg: 26, head: 86, pen: 0.62, range: 80, spread: 0.015, speedK: 0.94, reload: 2.7, auto: true, rec: 'm7', bonus: 600,
  support: [0.04, 0.205], stand: 'v11', desc: '有槍托與前握，比 V11 穩，射速略慢。中近距離的經濟局首選。',
  recoil: [0.012, 0.032, 0.4],
  vm: { pose: [0.15, -0.155, 0.2, -2, 0], kick: [1.6, 0.02, 0.002, 0, 0.7, 28], kind: 'rifle', boltT: 0.065, parts: [
    { box: [0.007, 0.043, 0.0869, 0.0995, 0.171, 0.202], ch: 'bolt', t: [0, 0, -0.03] },   // 左側拉機柄
    { box: [-0.0135, 0.0096, 0.0555, 0.0885, 0.079, 0.151], ch: 'bolt', t: [0, 0, -0.045] },   // 窗內槍機
  ] },
  port: 0.2, flash: 0.9, snd: [0.85, 1900, 150, 0.13],
};
