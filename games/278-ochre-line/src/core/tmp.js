// 預配置暫存：迴圈內一律用這裡的物件搭配 copyFromFloats / *ToRef，不得 new。
// 每個暫存只在單一函式內有效，呼叫其他模組後視為已被覆寫。
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector.js';

export const TMP_VEC3_A = new Vector3();
export const TMP_VEC3_B = new Vector3();
export const TMP_VEC3_C = new Vector3();
export const TMP_VEC3_D = new Vector3();
export const TMP_VEC3_E = new Vector3();
export const TMP_VEC3_F = new Vector3();
export const TMP_QUAT_A = new Quaternion();
export const TMP_QUAT_B = new Quaternion();
export const TMP_MAT_A = new Matrix();
export const TMP_MAT_B = new Matrix();
export const TMP_MAT_C = new Matrix();
export const ZERO_MAT = Matrix.Scaling(0, 0, 0);

/** 開發版配置計數：包住建構子，accept 用來驗「暖機後每幀 0 次」。 */
export const allocCounter = { vec3: 0, mat: 0, quat: 0, armed: false };

/** FAST 快照是否生效。生效後世界矩陣要自己送進 UBO；WebGL 退回路徑與快照開啟前都不用。 */
export const snapshotActive = { on: false };

/**
 * 把世界矩陣送進 GPU。Babylon 的 UBO 是環形緩衝，同一幀寫第二次會換下一個；快照錄製時綁到哪個就固定是哪個，
 * transferToEffect 卻每幀從第一個寫起。兩者不同時畫面上的網格會留在世界裡，所以每個緩衝都要同步。
 */
export function sendWorld(m) {
  m.transferToEffect(m.getWorldMatrix());
  const u = m.getMeshUniformBuffer(), r = u._buffers;
  if (!r || r.length < 2) return;
  const e = m.getEngine();
  for (let i = 0; i < r.length; i++) if (r[i][0] !== u._buffer) e.updateUniformBuffer(r[i][0], u._bufferData);
}
