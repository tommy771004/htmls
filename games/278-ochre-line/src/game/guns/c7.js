// C7 緊湊手槍。欄位說明見 index.js。
export default {
  id: 'c7', name: 'C7 緊湊手槍', slot: 2, price: 300, mag: 20, rsv: 80, rpm: 520, dmg: 26, head: 104, pen: 0.48, range: 80, spread: 0.01, speedK: 0.96, reload: 2.1, semi: true, bonus: 300,
  stand: 'p9', desc: '二十發聚合物手槍，連點很快，裸頭一發能倒。便宜，打穿護甲很吃力，適合經濟局壓人。',
  vm: { pose: [0.135, -0.125, 0.3, -8, -5], kick: [18, 0.02, 0.012, 0.01, 6, 12], kind: 'pistol', slide: 0.03 },
  port: 0.09, flash: 1.3, snd: [0.8, 1750, 165, 0.14],
};
