// goku 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
export default {};
