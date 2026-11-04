// 海上鑽油平台（21-rig.js）四周的暴風浪：8 道 Gerstner 波（世界座標，大致順著風往 +x、−z 走）。
// 21-rig.js 的 rigWave（船、拖船、游泳的人照它起伏）與 src/tsl/m-rigSea.mjs 的頂點位移用同一份，兩邊才對得上。
// 每道：方向 (dx, dz)、波數 k、角頻率 w、振幅 A、陡度 Q（Σ Q·k·A < 1，浪頂才不會翻成圈）、相位 ph
export const RIG_TS = .85;   // 時間倍率（uTime × RIG_TS）
export const RIG_WIND = [.35, -.94];   // 風往這邊吹（火焰、黑煙、雨絲也往這邊斜）
const WA = Math.atan2(RIG_WIND[1], RIG_WIND[0]);
export const RIG_WAVES = [[0, 62, 1.45, .2, 1.3], [-.42, 44, 1.05, .19, 4.1], [.5, 32, .78, .15, 2.2], [-.15, 23, .55, .12, 5.7], [.95, 17, .36, .09, .4], [-.85, 12, .23, .07, 3.3], [.3, 7.6, .12, .05, 6], [-1.2, 5, .07, .04, 1.9]]
  .map(([da, L, A, s, ph]) => { const k = Math.PI * 2 / L, a = WA + da; return { dx: Math.cos(a), dz: Math.sin(a), k, w: Math.sqrt(9.81 * k), A, Q: s / (k * A), ph }; });
// 浪從中心 R0 公尺起淡、到 R1 公尺變平（外面是城市原本的海面）；網格做到 R1 + RIG_PAD，原本的海面在 R1 + RIG_PAD − 2 內挖掉
export const RIG_R0 = 210, RIG_R1 = 400, RIG_PAD = 20;
