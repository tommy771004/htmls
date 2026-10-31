// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "tronTrail"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "yxmet67h", fog: false, lib: null, libV: false, libF: false,
  uniforms: [{"name":"uCol","type":"vec3","src":"uCol"},{"name":"uK","type":"float","src":"uK"}],
  varyings: [{"name":"vA","type":"float","src":"vA"}],
  attributes: [{"name":"age","type":"float","src":"age"}],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { uCol, uK, vA, age, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vA.assign( age );
    	glPos_.assign( projectionMatrix.mul( modelViewMatrix ).mul( vec4( position, 1. ) ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, sub, mul, add, Fn } = TSL;
    const { uCol, uK, vA, age, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	fragOut_.assign( vec4( uCol.mul( sub( 1., vA ) ).mul( add( 1.2, mul( 1.4, uK ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
