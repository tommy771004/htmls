// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "wake"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "10tvj6o9w5", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vA","type":"vec4","src":"vA"},{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [{"name":"iP","type":"vec4","src":"iP"},{"name":"iA","type":"vec4","src":"iA"}],
  vertex: (TSL, E) => {
    const { vec4, cos, sin, mat2, add, vec3, Fn } = TSL;
    const { vUv, vA, vW, iP, iA, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const c = cos( iP.w ).toVar(), s = sin( iP.w ).toVar();
    	const q = mat2( c, s, s.negate(), c ).mul( position.xz ).mul( iP.z ).toVar();
    	const w = vec3( iP.x.add( q.x ), add( -1.56, iA.w.mul( .01 ) ), iP.y.add( q.y ) ).toVar();
    	vW.assign( w );
    	vUv.assign( uv );
    	vA.assign( iA );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( vec4( w, 1. ) ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, length, smoothstep, mul, add, abs, sub, select, min, vec3, Fn } = TSL;
    const { vUv, vA, vW, iP, iA, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const q = vUv.sub( .5 ).toVar();
    	const d = length( q ).mul( 2. ).toVar();
    	const n = n2( vW.xz.mul( 1.9 ).add( vA.z.mul( 7. ) ) ).mul( .6 ).add( n2( vW.xz.mul( 5.3 ).sub( vA.z.mul( 3. ) ) ).mul( .4 ) ).toVar();
    	const a = select( vA.y.lessThan( .5 ), smoothstep( 1., .35, d.add( n.sub( .5 ).mul( .7 ) ) ).mul( add( .35, mul( .65, n ) ) ), smoothstep( .16, 0., abs( d.sub( .55 ).sub( vA.x.mul( .4 ) ) ).sub( n.sub( .5 ).mul( .12 ) ) ).mul( sub( 1., smoothstep( .95, 1., d ) ) ) ).toVar();
    	a.mulAssign( sub( 1., vA.x ).mul( sub( 1., vA.x ) ).mul( min( 1., vA.x.mul( 8. ).add( .2 ) ) ) );
    	const c = vec3( .5, .56, .6 ).mul( uAmbTop.mul( sub( 3., uDay.mul( 1.5 ) ) ).add( .22 ).add( uSunCol.mul( .6 ) ) ).toVar();
    	fragOut_.assign( vec4( applyFog( c, vW ), a.mul( .5 ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
