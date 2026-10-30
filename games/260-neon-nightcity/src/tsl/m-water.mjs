// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "water"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "7qgubwe50", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uReflMat","type":"mat4","src":"uReflMat"},{"name":"tRefl","type":"sampler2D","src":"tRefl"},{"name":"uReflOn","type":"float","src":"uReflOn"},{"name":"uWetDbg","type":"float","src":"uWetDbg"},{"name":"tTron","type":"sampler2D","src":"tTron"},{"name":"tShore","type":"sampler2D","src":"tShore"},{"name":"uTronA","type":"vec3","src":"uTronA"},{"name":"uTronB","type":"vec3","src":"uTronB"},{"name":"uTronG","type":"vec4","src":"uTronG"},{"name":"uShore","type":"vec4","src":"uShore"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vRP","type":"vec4","src":"vRP"},{"name":"vL","type":"vec2","src":"vL"},{"name":"vAx","type":"vec2","src":"vAx"}],
  attributes: [{"name":"aL","type":"vec4","src":"aL"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uReflMat, tRefl, uReflOn, uWetDbg, tTron, tShore, uTronA, uTronB, uTronG, uShore, vW, vN, vRP, vL, vAx, aL, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vL.assign( aL.xy );
    	vAx.assign( normalize( modelMatrix.mul( vec4( aL.z, 0., aL.w, 0. ) ).xz ) );
    	vRP.assign( uReflMat.mul( w ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec3, Fn, vec2, float, floor, fract, length, pow, exp, sub, step, max, Loop, smoothstep, If, bool, normalize, mix, mul, dot, add, property, reflect, clamp, cos, sin, div, sqrt, vec4, Discard, select, min } = TSL;
    const { uReflMat, tRefl, uReflOn, uWetDbg, tTron, tShore, uTronA, uTronB, uTronG, uShore, vW, vN, vRP, vL, vAx, aL, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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

    const coverAt =  Fn( ( [ p, o ] ) => {

    	return smoothstep( 1.3, 2.4, uHMap.sample( p.xz.add( o ).sub( uHM.xy ).mul( uHM.z ) ).level( 0. ).r.sub( p.y ) );

    }, { p: 'vec3', o: 'vec2', return: 'float' } );

    const rainCover =  Fn( ( [ p ] ) => {

    	const s = coverAt( p, vec2( 0. ) ).mul( .4 ).add( coverAt( p, vec2( .7, 0. ) ).add( coverAt( p, vec2( -0.7, 0. ) ) ).add( coverAt( p, vec2( 0., .7 ) ) ).add( coverAt( p, vec2( 0., -0.7 ) ) ).mul( .15 ) ).toVar();
    	const tr = uTMap.sample( p.xz.sub( uTM.xy ).mul( uTM.z ) ).level( 0. ).rg.toVar();

    	If( tr.x.greaterThan( 0. ).and( tr.y.greaterThan( p.y.add( 1. ) ) ), () => {

    		s.assign( max( s, .35 ) );

    	} );

    	return s;

    }, { p: 'vec3', return: 'float' } );

    const wetSurfaceR =  Fn( ( [ base_immutable, n, wet_immutable, pud_immutable, paint, rough0 ] ) => {

    	const pud = pud_immutable.toVar();
    	const wet = wet_immutable.toVar();
    	const base = base_immutable.toVar();
    	const done_ = bool( false ).toVar();
    	const ret_ = vec3( 0 ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const dry = rainCover( vW ).toVar();
    	pud.mulAssign( smoothstep( .05, .6, uWet ).mul( sub( 1., dry ) ) );
    	wet.mulAssign( uWet.mul( sub( 1., dry ) ) );

    	If( uWetDbg.greaterThan( .5 ), () => {

    		return vec3( dry.add( sub( 1., wet ).mul( sub( 1., pud ) ) ), wet.mul( sub( 1., pud ) ), pud ).mul( 2. );

    	} );

    	If( done_.not(), () => {

    		const rim = smoothstep( .05, .35, pud ).mul( sub( 1., smoothstep( .45, .9, pud ) ) ).toVar();
    		base.mulAssign( mix( 1., .7, wet ).mul( mix( 1., .8, pud ) ).mul( sub( 1., mul( .3, rim ) ) ) );
    		const rough = mix( mix( rough0, .3, wet ), .035, pud ).toVar();
    		const c = shade( vW, n, v, base, rough, 0. ).toVar();
    		const F = add( .05, mul( .95, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const refl = mix( .3, 1., F ).mul( mix( wet.mul( .55 ), .9, pud ) ).mul( sub( 1., paint.mul( .4 ) ) ).toVar();
    		const rc = property( 'vec3' );

    		If( uReflOn.greaterThan( .5 ), () => {

    			const ruv = vRP.xy.div( vRP.w ).add( n.xz.mul( vec2( .05, .09 ) ).mul( add( 1., mul( 1.5, sub( 1., pud ) ) ) ) ).toVar();
    			const dist = length( vW.sub( uCam ) ).toVar();
    			rc.assign( reflSample( ruv, mix( .024, .003, pud ).div( add( 1., dist.mul( .01 ) ) ) ) );

    		} ).Else( () => {

    			rc.assign( envMap( reflect( v.negate(), n ) ) );

    		} );

    		ret_.assign( mix( c, rc, clamp( refl, 0., 1. ).mul( uWet ) ) );
    		done_.assign( true );

    	} );

    	return ret_;

    } );

    const wetSurface =  Fn( ( [ base, n, wet, pud, paint ] ) => {

    	return wetSurfaceR( base, n, wet, pud, paint, .72 );

    } );

    const waves =  Fn( ( [ p, t, dist, g ] ) => {

    	const h = float( 0. ).toVar();
    	g.assign( vec2( 0 ) );
    	const L = float( 60. ).toVar();

    	Loop( 9, ( { i } ) => {

    		const fi = float( i ).toVar(), a = add( -0.55, h21( vec2( fi, 3.7 ) ).sub( .5 ).mul( 1.9 ) ).toVar();
    		const d = vec2( cos( a ), sin( a ) ).toVar();
    		const k = div( 6.2832, L ).toVar(), w = sqrt( mul( 9.8, k ) ).toVar(), A = L.mul( .0055 ).mul( smoothstep( L.mul( 90. ), L.mul( 25. ), dist ) ).toVar();
    		const ph = dot( d, p ).mul( k ).sub( w.mul( t ) ).add( h21( vec2( fi, 9.1 ) ).mul( 6.2832 ) ).toVar();
    		const s = sin( ph ).toVar(), c = cos( ph ).toVar();
    		const b = add( 1., s ).toVar(), sh = pow( b, 1.6 ).toVar();
    		h.addAssign( A.mul( sh ).mul( .5 ) );
    		g.addAssign( A.mul( .8 ).mul( pow( b, .6 ) ).mul( c ).mul( k ).mul( d ) );
    		L.mulAssign( .62 );

    	} );

    	return h;

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const tq = vec2( dot( uTronA, vec3( vW.xz, 1. ) ), dot( uTronB, vec3( vW.xz, 1. ) ) ).sub( uTronG.xy ).div( uTronG.zw ).toVar();

    	If( tq.x.greaterThan( 0. ).and( tq.y.greaterThan( 0. ) ).and( tq.x.lessThan( 1. ) ).and( tq.y.lessThan( 1. ) ).and( tTron.sample( tq ).r.greaterThan( .5 ) ), () => {

    		Discard();

    	} );

    	const p = vL.toVar();
    	const t = uTime.toVar();
    	const dist = length( vW.sub( uCam ) ).toVar();
    	const su = vW.xz.sub( uShore.xy ).mul( uShore.z ).toVar();
    	const shore = select( su.x.greaterThan( 0. ).and( su.y.greaterThan( 0. ) ).and( su.x.lessThan( 1. ) ).and( su.y.lessThan( 1. ) ), tShore.sample( su ).r.mul( uShore.w ), uShore.w ).toVar();
    	const g = property( 'vec2' );
    	const h = waves( vW.xz, t, dist, g ).toVar();
    	const g2 = vec2( n2( p.mul( .33 ).add( vec2( t.mul( .32 ), t.negate().mul( .2 ) ) ) ), n2( p.mul( .29 ).add( vec2( t.negate().mul( .26 ), t.mul( .3 ) ) ).add( 3. ) ) ).sub( .5 ).toVar();
    	const calm = mix( .45, 1., smoothstep( 4., 30., shore ) ).toVar();
    	const n = vec3( g.x.negate().mul( calm ).add( g2.x.mul( .16 ) ), 1., g.y.negate().mul( calm ).add( g2.y.mul( .16 ) ) ).toVar();

    	If( dist.lessThan( 50. ), () => {

    		n.xz.addAssign( ripple( p.mul( .7 ), uTime ).mul( .3 ).mul( sub( 1., dist.div( 50. ) ) ) );

    	} );

    	n.assign( normalize( n ) );
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const F = add( .02, mul( .98, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    	const sh = sub( 1., smoothstep( 2., 26., shore.add( n2( vW.xz.mul( .03 ) ).sub( .5 ).mul( 8. ) ) ) ).toVar();
    	const body = mix( vec3( .004, .014, .026 ), vec3( .014, .04, .034 ), sh ).mul( add( 1., clamp( h, -0.3, .6 ).mul( .9 ) ) ).toVar();
    	const c = shade( vW, vec3( 0., 1., 0. ), v, body, .95, 0. ).add( shade( vW, n, v, vec3( 0. ), .1, 0. ) ).toVar();
    	const rc = property( 'vec3' );

    	If( uReflOn.greaterThan( .5 ), () => {

    		rc.assign( reflSample( vRP.xy.div( vRP.w ).add( n.xz.mul( vec2( .05, .11 ) ) ), add( .003, min( dist, 600. ).mul( .00003 ) ) ) );

    	} ).Else( () => {

    		rc.assign( envMap( reflect( v.negate(), n ) ) );

    	} );

    	c.assign( mix( c, rc, clamp( add( .18, F.mul( .85 ) ), 0., 1. ).mul( sub( 1., sh.mul( .35 ) ) ) ) );
    	const fp = vW.xz.add( g.mul( 6. ) ).toVar();
    	const lace = smoothstep( .42, .72, fbm( fp.mul( .21 ).add( vec2( t.mul( .07 ), t.negate().mul( .05 ) ) ) ) ).mul( .7 ).add( smoothstep( .55, .8, n2( fp.mul( .9 ).sub( t.mul( .3 ) ) ) ).mul( .5 ) ).toVar();
    	const band = sub( 1., smoothstep( .6, add( 2.5, mul( 4., n2( vW.xz.mul( .02 ).add( t.mul( .02 ) ) ) ) ), shore ) ).toVar();
    	const wv = fract( shore.div( 11. ).add( t.mul( .11 ) ).add( n2( vW.xz.mul( .015 ) ).mul( .6 ) ) ).toVar(), line = smoothstep( .0, .05, wv ).mul( smoothstep( .3, .08, wv ) ).mul( sub( 1., smoothstep( 3., 14., shore ) ) ).mul( .55 ).toVar();
    	const cap = smoothstep( .95, 1.2, h.add( n2( vW.xz.mul( .11 ).add( t.mul( .15 ) ) ).sub( .5 ).mul( .3 ) ) ).mul( smoothstep( 300., 80., dist ) ).mul( .3 ).toVar();
    	const foam = clamp( band.mul( add( .2, mul( .9, lace ) ) ).add( line.mul( lace ).mul( .9 ) ).add( cap.mul( lace ) ), 0., 1. ).mul( smoothstep( 1800., 500., dist ) ).toVar();
    	c.assign( mix( c, shade( vW, normalize( vec3( n.x.mul( .3 ), 1., n.z.mul( .3 ) ) ), v, vec3( .62, .66, .68 ), .85, 0. ), foam ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
