// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "rain"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "slh07g9z0", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: true, libF: false,
  uniforms: [{"name":"uVel","type":"vec3","src":"uVel"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vC","type":"vec2","src":"vC"},{"name":"vL","type":"vec3","src":"vL"},{"name":"vF","type":"float","src":"vF"}],
  attributes: [{"name":"aR","type":"vec4","src":"aR"},{"name":"aC","type":"vec2","src":"aC"}],
  vertex: (TSL, E) => {
    const { vec4, vec3, add, mod, normalize, length, cross, exp, Fn } = TSL;
    const { uVel, vC, vL, vF, aR, aC, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const box = vec3( 34., 22., 34. ).toVar();
    	const sp = add( 10., aR.w.mul( 4. ) ).toVar();
    	const base = aR.xyz.mul( box ).toVar();
    	base.y.subAssign( uTime.mul( sp ) );
    	base.x.addAssign( uTime.mul( 1.6 ) );
    	const cp = uCam.sub( vec3( box.x.mul( .5 ), 7., box.z.mul( .5 ) ) ).toVar();
    	const p = mod( base.sub( cp ), box ).add( cp ).toVar();
    	const vel = vec3( 1.6, sp.negate(), .3 ).sub( uVel ).toVar();
    	const dir = normalize( vel ).toVar();
    	const len = add( .45, length( vel ).mul( .028 ) ).toVar();
    	const tc = normalize( p.sub( uCam ) ).toVar();
    	const side = normalize( cross( dir, tc ) ).mul( add( .008, length( p.sub( uCam ) ).mul( .0011 ) ) ).toVar();
    	const w = p.add( dir.mul( len ).mul( aC.y ) ).add( side.mul( aC.x ) ).toVar();
    	vC.assign( aC );
    	const lg = lampGrid( p, tc.negate(), tc.negate(), 8. ).toVar(), pl = pointLights( p, tc.negate(), tc.negate(), 8. ).toVar();
    	const dif = lg[ 0 ].add( pl[ 0 ] ).toVar(), spc = lg[ 1 ].add( pl[ 1 ] ).toVar();
    	vL.assign( dif.mul( .5 ).add( spc.mul( .4 ) ).add( uFogHi.mul( .7 ) ).add( uFlash.mul( .8 ) ) );
    	vF.assign( exp( length( p.sub( uCam ) ).negate().mul( .045 ) ).mul( uRain ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( vec4( w, 1. ) ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, abs, sub, Fn } = TSL;
    const { uVel, vC, vL, vF, aR, aC, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const a = sub( 1., abs( vC.x ) ).mul( vC.y ).mul( sub( 1., vC.y ) ).mul( 4. ).toVar();
    	fragOut_.assign( vec4( vL.mul( a ).mul( vF ).mul( .55 ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
