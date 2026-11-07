// 第一人稱武器不能用 rendering group 清深度（FAST 快照的 render bundle 會失效），
// 改在頂點階段把 clip z 壓到近端，效果等同 Quake 的 glDepthRange 手法。
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase.js';

const K = 0.04;
export class ViewmodelDepthPlugin extends MaterialPluginBase {
  constructor(material) { super(material, 'VMDepth', 300, { VMDEPTH: false }); this._enable(true); }
  prepareDefines(defines) { defines.VMDEPTH = true; }
  getClassName() { return 'ViewmodelDepthPlugin'; }
  isCompatible() { return true; }
  getCustomCode(type, language) {
    if (type !== 'vertex') return null;
    if (language === 1) return { CUSTOM_VERTEX_MAIN_END: `vertexOutputs.position.z *= ${K};` };   // WGSL：z 0..w
    return { CUSTOM_VERTEX_MAIN_END: `gl_Position.z = (gl_Position.z + gl_Position.w) * ${K} - gl_Position.w;` };
  }
}
