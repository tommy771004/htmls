// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "carShadow"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "103psw89o", lib: null, libV: false, libF: false,
  uniforms: [],
  varyings: [{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { vUv, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vUv.assign( uv );
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, vec2, length, smoothstep, sub, Fn } = TSL;
    const { vUv, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const q = vUv.sub( .5 ).mul( 2. ).toVar();
    	const a = sub( 1., smoothstep( .35, 1., length( q.mul( vec2( 1., .9 ) ) ) ) ).mul( .82 ).toVar();
    	fragOut_.assign( vec4( 0., 0., 0., a ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
