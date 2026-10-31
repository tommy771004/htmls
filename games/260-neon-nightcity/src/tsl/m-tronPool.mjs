// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "tronPool"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "1xhwikhl1", fog: false, lib: null, libV: false, libF: false,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uK","type":"float","src":"uK"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { uTime, uK, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, sin, cos, vec2, normalize, vec3, dot, max, sub, pow, abs, mul, add, Fn } = TSL;
    const { uTime, uK, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const p = vW.xz.toVar();
    	const t = uTime.toVar();
    	const n = vec2( sin( p.x.mul( 3.1 ).add( t.mul( 1.7 ) ) ).add( sin( p.y.mul( 2.3 ).sub( t.mul( 1.3 ) ).add( p.x ) ) ), cos( p.y.mul( 3.4 ).add( t.mul( 1.9 ) ) ).add( sin( p.x.mul( 2.7 ).add( t.mul( 1.1 ) ) ) ) ).mul( .12 ).toVar();
    	const v = normalize( cameraPosition.sub( vW ) ).toVar(), N = normalize( vec3( n.x, 1., n.y ) ).toVar();
    	const fr = pow( sub( 1., max( dot( N, v ), 0. ) ), 3. ).toVar();
    	const c = pow( abs( sin( p.x.add( n.x.mul( 3. ) ).mul( 2.2 ) ).mul( sin( p.y.add( n.y.mul( 3. ) ).mul( 2.2 ) ) ) ), 8. ).toVar();
    	fragOut_.assign( vec4( vec3( .004, .018, .026 ).add( vec3( .2, .7, 1. ).mul( fr.mul( add( .25, mul( .6, uK ) ) ).add( c.mul( add( .05, mul( .35, uK ) ) ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
