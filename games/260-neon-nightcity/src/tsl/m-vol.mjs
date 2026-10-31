// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "vol"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "1lisa85a8m", fog: false, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"tDepth","type":"sampler2D","src":"tDepth"},{"name":"uInvVP","type":"mat4","src":"uInvVP"},{"name":"uVolK","type":"float","src":"uVolK"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vUv","type":"vec2","src":"vUv"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { tDepth, uInvVP, uVolK, vUv, zN_, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vUv.assign( uv );
    	glPos_.assign( vec4( position.xy, 0., 1. ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { bool, float, length, max, Break, If, Loop, Fn, vec4, min, fract, exp, add, dot, pow } = TSL;
    const { tDepth, uInvVP, uVolK, vUv, zN_, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const vVis =  Fn( ( [ r ] ) => {

    	const done_ = bool( false ).toVar();
    	const ret_ = float( 0 ).toVar();
    	const sl = max( length( uSun.xz ), 1e-3 ).toVar();
    	const d = uSun.xz.div( sl ).toVar();
    	const k = uSun.y.div( sl ).toVar(), t = float( 1.2 ).toVar();

    	Loop( 12, () => {

    		const ry = r.y.add( t.mul( k ) ).toVar();

    		If( ry.greaterThan( uHM.w ), () => {

    			Break();

    		} );

    		const uv = r.xz.add( d.mul( t ) ).sub( uHM.xy ).mul( uHM.z ).toVar();

    		If( uv.x.lessThan( 0. ).or( uv.y.lessThan( 0. ) ).or( uv.x.greaterThan( 1. ) ).or( uv.y.greaterThan( 1. ) ), () => {

    			Break();

    		} );

    		If( uHMap.sample( uv ).level( 0. ).r.greaterThan( ry ), () => {

    			ret_.assign( 0. );
    			done_.assign( true );
    			Break();

    		} );

    		If( done_.not(), () => {

    			t.assign( t.mul( 1.4 ).add( 1.2 ) );

    		} );

    	} );

    	If( done_.not(), () => {

    		ret_.assign( leafVis( r, d, k ) );
    		done_.assign( true );

    	} );

    	return ret_;

    }, { r: 'vec3', return: 'float' } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const dp = tDepth.sample( vUv ).r.toVar();
    	const wp = uInvVP.mul( vec4( vUv.mul( 2. ).sub( 1. ), zN_( dp ), 1. ) ).toVar();
    	wp.divAssign( wp.w );
    	const rd = wp.xyz.sub( uCam ).toVar();
    	const L = length( rd ).toVar();
    	rd.divAssign( max( L, 1e-3 ) );

    	If( dp.greaterThanEqual( 1. ), () => {

    		L.assign( 400. );

    	} );

    	L.assign( min( L, 160. ) );
    	const j = hw( fragCoord_.xy.add( fract( uTime.mul( 7.31 ) ).mul( 97. ) ) ).toVar(), ds = L.div( float( VOL_N_T ) ).toVar(), acc = float( 0. ).toVar();

    	Loop( VOL_N_T, ( { i } ) => {

    		const s = float( i ).add( j ).mul( ds ).toVar();
    		const r = uCam.add( rd.mul( s ) ).toVar();
    		const den = add( .05, uGI.z.mul( 520. ).mul( exp( max( r.y, 0. ).negate().div( 7. ) ) ) ).toVar();
    		acc.addAssign( vVis( r ).mul( den ).mul( ds ).mul( exp( s.negate().mul( .012 ) ) ) );

    	} );

    	const sd = max( dot( rd, uSun ), 0. ).toVar(), ph = add( .05, sd.mul( sd ).mul( sd ).mul( .9 ) ).add( pow( sd, 20. ).mul( 1.6 ) ).toVar();
    	fragOut_.assign( vec4( uSunCol.mul( ph ).mul( acc ).mul( uVolK ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
