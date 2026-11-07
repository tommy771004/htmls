// 換彈與上膛的聲音時間軸。u 是 reload 進度（0–1），對齊 viewmodel.js 的 poseReload：
// 步槍 .2–.36 抽彈匣、.5–.56 插到底、.76–.8 拉機柄；手槍 .1–.3 掉彈匣、.5–.56 插匣。
// 每項 [u, 片段名, 音高倍率]。由 weapons.js 的 tickWeapon 逐格觸發，換槍中斷時 reloadT 歸零就自然停，不用排程取消。
const rifle = (k = 1) => [[0.14, 'mag_out_r', k], [0.53, 'mag_in_r', k], [0.78, 'bolt_r', k]];
const pistol = (k = 1) => [[0.12, 'mag_out_p', k], [0.52, 'mag_in_p', k], [0.8, 'slide_p', k]];
export const RELOAD_CUE = {
  p9: pistol(1),
  c7: pistol(1.09),
  r50: pistol(0.9),
  v11: [[0.13, 'mag_out_p', 0.94], [0.52, 'mag_in_r', 1.16], [0.8, 'bolt_s', 1.12]],
  m7: [[0.14, 'mag_out_r', 1.1], [0.52, 'mag_in_r', 1.1], [0.72, 'bolt_s', 1], [0.8, 'bolt_s', 0.9]],     // 滾輪閉鎖：拉到底再拍回去
  b90: [[0.13, 'mag_out_r', 0.96], [0.3, 'mag_rattle', 1], [0.55, 'mag_in_r', 0.92], [0.79, 'bolt_s', 0.86]],   // 頂置長彈匣
  ks: rifle(0.96),
  ar5: rifle(1),
  t4: rifle(1.05),
  n9: [[0.08, 'cover_open', 1], [0.2, 'mag_out_r', 0.84], [0.42, 'belt', 1], [0.58, 'mag_in_r', 0.8], [0.68, 'cover_close', 1], [0.86, 'bolt_r', 0.86]],
  l40: [[0.14, 'mag_out_r', 0.9], [0.52, 'mag_in_r', 0.88], [0.76, 'cycle_b', 0.94]],
  s6: [[0.14, 'mag_out_p', 1], [0.52, 'mag_in_p', 1], [0.76, 'cycle_a', 1]],
  s8: [[0.1, 'shell', 1], [0.26, 'shell', 0.97], [0.42, 'shell', 1.03], [0.58, 'shell', 1], [0.8, 'pump', 1]],
};
// 開火後的動作聲：[延遲秒, 片段名, 音高倍率]。l40、s6 栓動，s8 泵動；一發結束手要動，時間要短於 60/rpm
export const AFTER_SHOT = {
  l40: [0.62, 'cycle_b', 0.94],
  s6: [0.3, 'cycle_a', 1],
  s8: [0.32, 'pump', 1],
};
// 單發裝填的最後一下（x10 拉機柄）
export const SHELL_LAST = { x10: ['bolt_r', 1.06] };
export const DRAW = (w) => (w.id === 'knife' ? 'draw_k' : w.slot === 2 ? 'draw_p' : 'draw_r');
