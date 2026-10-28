// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "tronBeam"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "1wvygrmib", lib: null, libV: false, libF: false,
  uniforms: [{"name":"uY","type":"float","src":"uY"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uK","type":"float","src":"uK"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vH","type":"float","src":"vH"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uY, uTime, uK, vW, vN, vH, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vH.assign( position.y.div( uY ) );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, normalize, smoothstep, sub, dot, abs, pow, length, sin, mul, add, vec3, Fn } = TSL;
    const { uY, uTime, uK, vW, vN, vH, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const v = normalize( cameraPosition.sub( vW ) ).toVar();
    	const f = sub( 1., smoothstep( .0, 1., vH ) ).mul( smoothstep( -0.05, .08, vH ) ).mul( pow( abs( dot( normalize( vN ), v ) ), 2. ) ).toVar();
    	const d = length( vW.sub( cameraPosition ) ).toVar();
    	const fl = add( .85, mul( .15, sin( uTime.mul( 3.1 ).add( vW.x.mul( .2 ) ) ) ) ).toVar();
    	fragOut_.assign( vec4( vec3( .3, .8, 1. ).mul( f ).mul( fl ).mul( add( .04, mul( .12, uK ) ) ).mul( smoothstep( 3., 25., d ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
