// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "fx"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{\"ADD\":\"\"}": {
  h: "1tjayaoa0x", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [{"name":"iPos","type":"vec3","src":"iPos"},{"name":"iCol","type":"vec4","src":"iCol"},{"name":"iSz","type":"vec2","src":"iSz"}],
  vertex: (TSL, E) => {
    const { vec4, vec3, cos, sin, mat2, Fn } = TSL;
    const { vUv, vCol, vW, iPos, iCol, iSz, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const r = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] ).toVar(), u = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] ).toVar();
    	const c = cos( iSz.y ).toVar(), s = sin( iSz.y ).toVar();
    	const q = mat2( c, s, s.negate(), c ).mul( position.xy ).toVar();
    	const w = iPos.add( r.mul( q.x ).add( u.mul( q.y ) ).mul( iSz.x ) ).toVar();
    	vW.assign( w );
    	vUv.assign( uv );
    	vCol.assign( iCol );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( vec4( w, 1. ) ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, length, smoothstep, exp, Fn } = TSL;
    const { vUv, vCol, vW, iPos, iCol, iSz, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const q = vUv.sub( .5 ).toVar();
    	const d = length( q ).mul( 2. ).toVar();
    	const n = n2( vUv.mul( 3.1 ).add( vCol.a.mul( 5.3 ) ).add( vW.xz.mul( .7 ) ) ).toVar();
    	const a = smoothstep( 1., .25, d.add( n.sub( .5 ).mul( .5 ) ) ).toVar();
    	fragOut_.assign( vec4( vCol.rgb.mul( a ).mul( vCol.a ).mul( exp( length( vW.sub( uCam ) ).negate().mul( uFogDen ).mul( .6 ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{}": {
  h: "1gb0lc7a0p", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [{"name":"iPos","type":"vec3","src":"iPos"},{"name":"iCol","type":"vec4","src":"iCol"},{"name":"iSz","type":"vec2","src":"iSz"}],
  vertex: (TSL, E) => {
    const { vec4, vec3, cos, sin, mat2, Fn } = TSL;
    const { vUv, vCol, vW, iPos, iCol, iSz, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const r = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] ).toVar(), u = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] ).toVar();
    	const c = cos( iSz.y ).toVar(), s = sin( iSz.y ).toVar();
    	const q = mat2( c, s, s.negate(), c ).mul( position.xy ).toVar();
    	const w = iPos.add( r.mul( q.x ).add( u.mul( q.y ) ).mul( iSz.x ) ).toVar();
    	vW.assign( w );
    	vUv.assign( uv );
    	vCol.assign( iCol );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( vec4( w, 1. ) ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, length, smoothstep, sub, vec3, Fn } = TSL;
    const { vUv, vCol, vW, iPos, iCol, iSz, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const q = vUv.sub( .5 ).toVar();
    	const d = length( q ).mul( 2. ).toVar();
    	const n = n2( vUv.mul( 3.1 ).add( vCol.a.mul( 5.3 ) ).add( vW.xz.mul( .7 ) ) ).toVar();
    	const a = smoothstep( 1., .25, d.add( n.sub( .5 ).mul( .5 ) ) ).toVar();
    	const c = vCol.rgb.mul( uAmbTop.mul( sub( 3., uDay.mul( 1.5 ) ) ).add( .32 ).add( uSunCol.mul( .5 ) ) ).add( vec3( .05, .035, .03 ).mul( sub( 1., vUv.y ) ).mul( sub( 1., uDay ) ) ).add( uFlash.mul( .3 ) ).toVar();
    	fragOut_.assign( vec4( applyFog( c, vW ), a.mul( vCol.a ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
