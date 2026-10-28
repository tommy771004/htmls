// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "lighthouseBeam"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "1qx10kaai", lib: null, libV: false, libF: false,
  uniforms: [{"name":"uFogDen","type":"float","src":"uFogDen"}],
  varyings: [{"name":"vT","type":"float","src":"vT"},{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { uFogDen, vT, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vT.assign( position.x.div( 420. ) );
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, clamp, sub, pow, smoothstep, vec3, Fn } = TSL;
    const { uFogDen, vT, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const a = pow( sub( 1., clamp( vT, 0., 1. ) ), 2.4 ).mul( smoothstep( 0., .03, vT ) ).mul( .07 ).toVar();
    	fragOut_.assign( vec4( vec3( 1., .93, .75 ).mul( a ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
