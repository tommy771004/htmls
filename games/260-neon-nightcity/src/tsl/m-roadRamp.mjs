// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "roadRamp"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "84v7qkdbz", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uReflMat","type":"mat4","src":"uReflMat"},{"name":"tRefl","type":"sampler2D","src":"tRefl"},{"name":"uReflOn","type":"float","src":"uReflOn"},{"name":"uAsB","type":"sampler2D","src":"uAsB"},{"name":"uAsN","type":"sampler2D","src":"uAsN"},{"name":"uAsOn","type":"float","src":"uAsOn"},{"name":"uAsM","type":"vec3","src":"uAsM"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vRP","type":"vec4","src":"vRP"},{"name":"vL","type":"vec2","src":"vL"},{"name":"vAx","type":"vec2","src":"vAx"}],
  attributes: [{"name":"aUV","type":"vec2","src":"aUV"},{"name":"aAx","type":"vec2","src":"aAx"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uReflMat, tRefl, uReflOn, uAsB, uAsN, uAsOn, uAsM, vW, vN, vRP, vL, vAx, aUV, aAx, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vL.assign( aUV );
    	vAx.assign( aAx );
    	vRP.assign( uReflMat.mul( w ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec3, Fn, vec2, float, floor, fract, length, pow, exp, sub, step, max, Loop, normalize, smoothstep, mix, dot, mul, add, property, reflect, If, clamp, vec4, bool, abs, mod, select, min } = TSL;
    const { uReflMat, tRefl, uReflOn, uAsB, uAsN, uAsOn, uAsM, vW, vN, vRP, vL, vAx, aUV, aAx, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const nW =  Fn( ( [ n ] ) => {

    	return vec3( n.x.mul( vAx.x ).sub( n.z.mul( vAx.y ) ), n.y, n.x.mul( vAx.y ).add( n.z.mul( vAx.x ) ) );

    } );

    const ripple =  Fn( ( [ p, t ] ) => {

    	const acc = vec2( 0 ).toVar();

    	Loop( { start: 0, end: 2, name: 'k' }, ( { k } ) => {

    		const q = p.mul( 1.7 ).add( float( k ).mul( vec2( .37, .71 ) ) ).toVar();
    		const ci = floor( q ).toVar(), cf = fract( q ).sub( .5 ).toVar();
    		const hs = h21( ci.add( float( k ).mul( 13. ) ) ).toVar();
    		const off = vec2( h21( ci.add( 3.1 ) ), h21( ci.add( 7.7 ) ) ).sub( .5 ).mul( .5 ).toVar();
    		const tt = fract( t.mul( 1.2 ).add( hs ) ).toVar();
    		const d = cf.sub( off ).toVar();
    		const r = length( d ).toVar();
    		const ring = exp( pow( r.sub( tt.mul( .42 ) ).mul( 28. ), 2. ).negate() ).mul( sub( 1., tt ) ).mul( step( hs, uRain ) ).toVar();
    		acc.addAssign( d.div( max( r, 1e-3 ) ).mul( ring ) );

    	} );

    	return acc;

    }, { p: 'vec2', t: 'float', return: 'vec2' } );

    const reflSample =  Fn( ( [ ruv, blur ] ) => {

    	const c = tRefl.sample( ruv ).rgb.mul( .3 ).toVar();
    	c.addAssign( tRefl.sample( ruv.add( vec2( blur.mul( .15 ), blur ) ) ).rgb.mul( .2 ) );
    	c.addAssign( tRefl.sample( ruv.sub( vec2( blur.mul( .15 ), blur ) ) ).rgb.mul( .2 ) );
    	c.addAssign( tRefl.sample( ruv.add( vec2( 0., blur.mul( 2.2 ) ) ) ).rgb.mul( .15 ) );
    	c.addAssign( tRefl.sample( ruv.sub( vec2( 0., blur.mul( 2.2 ) ) ) ).rgb.mul( .15 ) );

    	return c;

    }, { ruv: 'vec2', blur: 'float', return: 'vec3' } );

    const wetSurface =  Fn( ( [ base, n, wet_immutable, pud_immutable, paint ] ) => {

    	const pud = pud_immutable.toVar();
    	const wet = wet_immutable.toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	pud.mulAssign( smoothstep( .05, .6, uWet ) );
    	wet.mulAssign( uWet );
    	const rough = mix( .75, .08, max( pud, wet.mul( .6 ) ) ).toVar();
    	const c = shade( vW, n, v, base, rough, 0. ).toVar();
    	const F = add( .05, mul( .95, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    	const refl = mix( .3, 1., F ).mul( mix( wet.mul( .55 ), 1., pud ) ).mul( sub( 1., paint.mul( .4 ) ) ).toVar();
    	const rc = property( 'vec3' );

    	If( uReflOn.greaterThan( .5 ), () => {

    		const ruv = vRP.xy.div( vRP.w ).add( n.xz.mul( vec2( .05, .09 ) ).mul( add( 1., mul( 1.5, sub( 1., pud ) ) ) ) ).toVar();
    		const dist = length( vW.sub( uCam ) ).toVar();
    		rc.assign( reflSample( ruv, mix( .024, .003, pud ).div( add( 1., dist.mul( .01 ) ) ) ) );

    	} ).Else( () => {

    		rc.assign( envMap( reflect( v.negate(), n ) ) );

    	} );

    	return mix( c, rc, clamp( refl, 0., 1. ).mul( uWet ) );

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const p = vL.toVar();
    	const X0 = uCity.x.toVar(), Z0 = uCity.y.toVar(), P = uCity.z.toVar(), Q = uCity.w.toVar();
    	const dx = p.x.toVar(), dz = float( 40. ).toVar();
    	const onA = bool( true ).toVar(), onS = bool( false ).toVar();
    	const inter = onA.and( onS ).toVar();
    	const n1 = fbm( p.mul( .3 ) ).toVar(), fine = h21( floor( p.mul( 37. ) ) ).toVar();
    	const alb = vec3( .034, .036, .04 ).mul( add( .7, mul( .6, n1 ) ) ).mul( add( .88, mul( .24, fine ) ) ).toVar();
    	const patchv = step( .66, n2( p.mul( .07 ).add( 3. ) ) ).toVar();
    	alb.mulAssign( mix( 1., .72, patchv ) );
    	alb.mulAssign( add( 1., uDay.mul( sub( 1.6, uWet ) ) ) );
    	const seam = smoothstep( .04, .0, abs( fract( p.x.mul( .031 ).add( n2( p.mul( .05 ) ).mul( .3 ) ) ).sub( .5 ) ) ).mul( .3 ).toVar();
    	alb.mulAssign( sub( 1., seam ) );
    	const asT = vec2( 0. ).toVar();

    	If( uAsOn.greaterThan( .5 ), () => {

    		const tu = p.div( 5.5 ).add( vec2( n2( p.mul( .013 ) ), n2( p.mul( .013 ).add( 5. ) ) ).mul( .6 ) ).toVar();
    		alb.mulAssign( mix( vec3( 1. ), uAsB.sample( tu ).rgb.div( uAsM ), .8 ) );
    		asT.assign( uAsN.sample( tu ).xy.mul( 2. ).sub( 1. ) );

    	} );

    	const paint = float( 0. ).toVar();
    	const pc = vec3( .8 ).toVar();

    	If( onA.and( inter.not() ), () => {

    		const ax = abs( dx ).toVar();
    		const yel = float( 0. ).toVar();

    		If( yel.greaterThan( 0. ), () => {

    			paint.assign( 1. );
    			pc.assign( vec3( .85, .6, .1 ) );

    		} );

    		paint.assign( max( paint, step( abs( ax.sub( 4.55 ) ), .08 ) ) );
    		const cw = step( 8.7, abs( dz ) ).mul( step( abs( dz ), 12.2 ) ).mul( step( .45, fract( dx.div( 1.15 ) ) ) ).mul( step( ax, 7.6 ) ).toVar();
    		paint.assign( max( paint, cw ) );
    		const stop = step( 12.4, abs( dz ) ).mul( step( abs( dz ), 12.85 ) ).mul( step( .3, ax ) ).mul( step( ax, 5.1 ) ).mul( step( 0., dz.mul( dx ) ) ).toVar();
    		paint.assign( max( paint, stop ) );
    		const aa = sub( 19., abs( dz ) ).toVar(), ll = ax.sub( 3. ).toVar();
    		const arrow = step( abs( ll ), .13 ).mul( step( -1.6, aa ) ).mul( step( aa, .6 ) ).add( step( .6, aa ).mul( step( aa, 1.8 ) ).mul( step( abs( ll ), sub( 1.8, aa ).mul( .45 ) ) ) ).toVar();
    		paint.assign( max( paint, clamp( arrow, 0., 1. ).mul( step( 0., dz.mul( dx ) ) ) ) );

    	} );

    	If( onS.and( inter.not() ), () => {

    		const az = abs( dz ).toVar();
    		const yel = step( abs( az.sub( .2 ) ), .085 ).mul( step( .12, az ) ).toVar();

    		If( yel.greaterThan( 0. ), () => {

    			paint.assign( 1. );
    			pc.assign( vec3( .85, .6, .1 ) );

    		} );

    		paint.assign( max( paint, step( abs( az.sub( 5.1 ) ), .07 ).mul( step( .42, fract( p.x.mul( .25 ) ) ) ) ) );
    		const cw = step( 8.7, abs( dx ) ).mul( step( abs( dx ), 12.2 ) ).mul( step( .45, fract( dz.div( 1.15 ) ) ) ).mul( step( az, 7.6 ) ).toVar();
    		paint.assign( max( paint, cw ) );
    		const stop = step( 12.4, abs( dx ) ).mul( step( abs( dx ), 12.85 ) ).mul( step( .3, az ) ).mul( step( az, 5.1 ) ).mul( step( 0., dz.negate().mul( dx ) ) ).toVar();
    		paint.assign( max( paint, stop ) );

    	} );

    	const wear = smoothstep( .35, .7, fbm( p.mul( 1.3 ).add( 9. ) ) ).toVar();
    	alb.assign( mix( alb, pc.mul( .55 ).mul( add( .75, mul( .25, fine ) ) ), paint.mul( sub( 1., wear.mul( .6 ) ) ) ) );
    	const mh = float( 1. ).toVar();

    	If( true, () => {

    		const d = select( onA, length( vec2( abs( dx ).sub( 3. ), mod( p.y.sub( Z0 ), Q ).sub( 31. ) ) ), 99. ).toVar();
    		const d2 = select( onS, length( vec2( mod( p.x.sub( X0 ), P ).sub( 36. ), abs( dz ).sub( 3. ) ) ), 99. ).toVar();
    		const md = min( d, d2 ).toVar();
    		const disc = smoothstep( .45, .43, md ).toVar();
    		alb.assign( mix( alb, vec3( .03, .028, .026 ).mul( add( .8, mul( .4, step( .5, fract( md.mul( 12. ) ) ) ) ) ), disc ) );
    		mh.assign( sub( 1., disc.mul( .6 ) ) );

    	} );

    	const gut = select( onA.and( inter.not() ), smoothstep( 6.6, 7.9, abs( dx ) ), select( onS.and( inter.not() ), smoothstep( 6.6, 7.9, abs( dz ) ), 0. ) ).toVar();
    	const pud = smoothstep( .56, .66, fbm( p.mul( .09 ).add( 7. ) ).add( gut.mul( .25 ) ).add( sub( 1., n1 ).mul( .05 ) ) ).toVar();
    	pud.assign( max( pud, gut.mul( .6 ) ) );
    	const n = vec3( 0., 1., 0. ).toVar();
    	const h0 = n2( p.mul( 4. ) ).toVar(), hx = n2( p.mul( 4. ).add( vec2( .05, 0. ) ) ).toVar(), hz = n2( p.mul( 4. ).add( vec2( 0., .05 ) ) ).toVar();
    	n.xz.subAssign( vec2( hx.sub( h0 ), hz.sub( h0 ) ).mul( 1.6 ).mul( sub( 1., pud ) ) );
    	n.xz.addAssign( vec2( asT.x, asT.y.negate() ).mul( .35 ).mul( sub( 1., pud ) ).mul( sub( 1., paint.mul( .5 ) ) ) );
    	const dist = length( vW.sub( uCam ) ).toVar();

    	If( dist.lessThan( 40. ), () => {

    		n.xz.addAssign( ripple( p, uTime ).mul( .5 ).mul( add( .3, mul( .7, pud ) ) ).mul( sub( 1., dist.div( 40. ) ) ) );

    	} );

    	n.assign( normalize( nW( n ) ) );
    	const c = wetSurface( alb.mul( mh ), n, .8, pud, paint ).toVar();
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
