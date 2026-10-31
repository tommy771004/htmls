// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "cloudSea"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "1vc74q4a23", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uLayer","type":"float","src":"uLayer"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vE","type":"float","src":"vE"}],
  attributes: [{"name":"aE","type":"float","src":"aE"}],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { uLayer, vW, vE, aE, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vE.assign( aE );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, vec2, mul, add, smoothstep, Discard, If, clamp, sqrt, sub, mix, vec3, max, Fn } = TSL;
    const { uLayer, vW, vE, aE, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const q = vW.xz.mul( .0019 ).add( vec2( uTime.mul( .0045 ), uTime.mul( .0018 ) ) ).toVar();
    	const d = fbm( q ).mul( .62 ).add( fbm( q.mul( 2.9 ).add( 5.3 ) ).mul( .38 ) ).toVar();
    	const th = add( .38, mul( .26, uLayer ).mul( uLayer ) ).toVar();
    	const a = smoothstep( th, th.add( .09 ), d ).mul( vE ).toVar();

    	If( a.lessThan( .004 ), () => {

    		Discard();

    	} );

    	const top = sqrt( clamp( d.sub( .38 ).div( .26 ), 0., 1. ) ).toVar(), deep = clamp( top.sub( uLayer ).mul( 2.4 ), 0., 1. ).toVar();
    	const lit = clamp( add( .55, d.sub( fbm( q.sub( uSun.xz.mul( .06 ) ) ) ).mul( 3.2 ) ), 0., 1. ).toVar();
    	const k = clamp( lit.mul( sub( 1., mul( .7, deep ) ) ).add( mul( .25, uLayer ) ), 0., 1. ).toVar();
    	const base = mix( uAmbBot, uAmbTop, .6 ).mul( 2.2 ).add( uSkyHor.mul( .35 ) ).toVar();
    	const c = base.mul( mix( vec3( .52, .58, .7 ), vec3( 1. ), k ) ).add( uSunCol.mul( max( uSun.y, 0. ) ).mul( add( .3, mul( .9, k ) ) ).mul( .9 ) ).toVar();
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( .08 ) ) ), a.mul( mix( .5, .3, uLayer ) ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
