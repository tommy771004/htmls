// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "steam"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "1jjjsg0j9q", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: true, libF: true,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vT","type":"float","src":"vT"},{"name":"vA","type":"float","src":"vA"},{"name":"vQ","type":"vec2","src":"vQ"},{"name":"vL","type":"vec3","src":"vL"},{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [{"name":"aPh","type":"float","src":"aPh"}],
  vertex: (TSL, E) => {
    const { vec4, fract, sin, add, cos, vec3, normalize, Fn } = TSL;
    const { vT, vA, vQ, vL, vW, aPh, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const c0 = position.sub( pGeom_ ).toVar();
    	const t = fract( uTime.mul( .16 ).add( aPh ) ).toVar();
    	const c = c0.add( vec3( sin( aPh.mul( 40. ) ).mul( .5 ).mul( t ).add( t.mul( 1.8 ) ), add( .2, t.mul( 6.5 ) ), cos( aPh.mul( 30. ) ).mul( .5 ).mul( t ) ) ).toVar();
    	const s = add( .7, t.mul( 3.2 ) ).toVar();
    	const right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] ).toVar();
    	const up = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] ).toVar();
    	const w = c.add( right.mul( position.x ).add( up.mul( position.y ) ).mul( s ) ).toVar();
    	vT.assign( t );
    	vQ.assign( position.xy );
    	vW.assign( w );
    	vA.assign( aPh );
    	const lg = lampGrid( c, normalize( uCam.sub( c ) ), normalize( uCam.sub( c ) ), 4. ).toVar(), pl = pointLights( c, normalize( uCam.sub( c ) ), normalize( uCam.sub( c ) ), 4. ).toVar();
    	const dif = lg[ 0 ].add( pl[ 0 ] ).toVar();
    	vL.assign( dif.add( uAmbTop.mul( 1.5 ) ).add( uSunCol.mul( .4 ) ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( vec4( w, 1. ) ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, length, vec2, smoothstep, sub, vec3, Fn } = TSL;
    const { vT, vA, vQ, vL, vW, aPh, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const r = length( vQ ).mul( 2. ).toVar();
    	const nn = fbm( vQ.mul( 2.2 ).add( vec2( vA.mul( 9. ), uTime.negate().mul( .4 ) ) ) ).toVar();
    	const a = smoothstep( 1., .2, r.add( nn.mul( .5 ) ) ).mul( vT ).mul( sub( 1., vT ) ).mul( 2.4 ).mul( .3 ).toVar();
    	a.mulAssign( smoothstep( .8, 4., length( vW.sub( uCam ) ) ) );
    	fragOut_.assign( vec4( applyFog( vL.mul( .55 ).add( vec3( .03 ) ), vW ), a ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
