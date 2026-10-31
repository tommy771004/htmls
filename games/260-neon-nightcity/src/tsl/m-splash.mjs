// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "splash"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "1b0cpr7adv", fog: false, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: true, libF: false,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vC","type":"vec2","src":"vC"},{"name":"vT","type":"float","src":"vT"},{"name":"vL","type":"vec3","src":"vL"}],
  attributes: [{"name":"aR","type":"vec4","src":"aR"},{"name":"aC","type":"vec2","src":"aC"}],
  vertex: (TSL, E) => {
    const { vec4, float, floor, vec2, fract, vec3, abs, select, add, normalize, length, exp, smoothstep, sub, Fn } = TSL;
    const { vC, vT, vL, aR, aC, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const box = float( 26. ).toVar();
    	const cyc = floor( uTime.mul( 2.2 ).add( aR.w.mul( 7. ) ) ).toVar();
    	const rr = fract( aR.xy.add( vec2( h11( cyc.add( aR.z.mul( 91. ) ) ), h11( cyc.mul( 1.3 ).add( aR.z.mul( 37. ) ) ) ) ) ).toVar();
    	const c = vec3( uCam.x.add( rr.x.sub( .5 ).mul( box ) ), 0., uCam.z.add( rr.y.sub( .5 ).mul( box ) ) ).toVar();
    	const X0 = uCity.x.toVar(), Z0 = uCity.y.toVar(), P = uCity.z.toVar(), Q = uCity.w.toVar();
    	const r0 = c.xz.sub( uZone.xy ).toVar(), l = vec2( r0.x.mul( uZone.z ).sub( r0.y.mul( uZone.w ) ), r0.x.mul( uZone.w ).add( r0.y.mul( uZone.z ) ) ).toVar();
    	const dx = abs( l.x.sub( X0.add( floor( l.x.sub( X0 ).div( P ).add( .5 ) ).mul( P ) ) ) ).toVar(), dz = abs( l.y.sub( Z0.add( floor( l.y.sub( Z0 ).div( Q ).add( .5 ) ).mul( Q ) ) ) ).toVar();
    	c.y.assign( select( dx.greaterThan( 8. ).and( dz.greaterThan( 8. ) ), .16, .01 ) );
    	vT.assign( fract( uTime.mul( 2.2 ).add( aR.w.mul( 7. ) ) ) );
    	const right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] ).toVar();
    	const s = add( .05, vT.mul( .12 ) ).toVar();
    	const w = c.add( right.mul( aC.x ).mul( s ) ).add( vec3( 0., aC.y.mul( s ).mul( 1.3 ), 0. ) ).toVar();
    	vC.assign( aC );
    	const tc = normalize( uCam.sub( c ) ).toVar();
    	const lg = lampGrid( c.add( vec3( 0, .3, 0 ) ), tc, tc, 8. ).toVar();
    	const dif = lg[ 0 ].toVar();
    	vL.assign( dif.mul( .6 ).add( uFogHi ).mul( uRain ).mul( exp( length( c.sub( uCam ) ).negate().mul( .06 ) ) ) );
    	vL.mulAssign( sub( 1., smoothstep( 1.3, 2.4, uHMap.sample( c.xz.sub( uHM.xy ).mul( uHM.z ) ).level( 0. ).r.sub( c.y ) ) ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( vec4( w, 1. ) ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, vec2, length, abs, smoothstep, step, sub, Fn } = TSL;
    const { vC, vT, vL, aR, aC, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const q = vec2( vC.x, vC.y.mul( 2. ).sub( 1. ) ).toVar();
    	const r = length( q ).toVar();
    	const a = smoothstep( .15, 0., abs( r.sub( .7 ) ) ).mul( step( vC.y, .55 ) ).mul( sub( 1., vT ) ).toVar();
    	fragOut_.assign( vec4( vL.mul( a ).mul( .9 ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
