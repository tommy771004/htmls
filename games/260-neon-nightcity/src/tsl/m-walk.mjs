// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "walk"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "pzkd9yetb", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uReflMat","type":"mat4","src":"uReflMat"},{"name":"tRefl","type":"sampler2D","src":"tRefl"},{"name":"uReflOn","type":"float","src":"uReflOn"},{"name":"uWetDbg","type":"float","src":"uWetDbg"},{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFacN","type":"sampler2DArray","src":"uFacN"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vRP","type":"vec4","src":"vRP"},{"name":"vL","type":"vec2","src":"vL"},{"name":"vAx","type":"vec2","src":"vAx"}],
  attributes: [{"name":"aL","type":"vec4","src":"aL"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uReflMat, tRefl, uReflOn, uWetDbg, uFacA, uFacN, uFac, vW, vN, vRP, vL, vAx, aL, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




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
    const { vec3, Fn, vec2, float, floor, fract, length, pow, exp, sub, step, max, Loop, smoothstep, If, bool, normalize, mix, mul, dot, add, property, reflect, clamp, vec4, fwidth, div, min, select, abs, sin, cos } = TSL;
    const { uReflMat, tRefl, uReflOn, uWetDbg, uFacA, uFacN, uFac, vW, vN, vRP, vL, vAx, aL, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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

    const walkTex =  Fn( ( [ q ] ) => {

    	const done_ = bool( false ).toVar();
    	const ret_ = vec4( 0 ).toVar();

    	If( uFac.x.lessThan( .5 ), () => {

    		ret_.assign( vec4( vec3( add( .85, mul( .3, fbm( q.mul( 2. ) ) ) ) ), 0. ) );
    		done_.assign( true );

    	} );

    	If( done_.not(), () => {

    		const t = texA_( uFacA, vec3( q, 2. ) ).rgb.toVar(), m = texLA_( uFacA, vec3( q, 2. ), 10. ).rgb.toVar();
    		ret_.assign( vec4( mix( vec3( 1. ), t.mul( t ).div( max( m.mul( m ), vec3( 1e-3 ) ) ), .8 ), 1. ) );
    		done_.assign( true );

    	} );

    	return ret_;

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const n = normalize( vN ).toVar();
    	const p = vL.toVar();
    	const c = property( 'vec3' );
    	const fwp = max( fwidth( p.x ), fwidth( p.y ) ).toVar(), kFine = clamp( div( .012, max( fwp, 1e-4 ) ), 0., 1. ).toVar();

    	If( n.y.lessThan( .5 ), () => {

    		const dt = walkTex( vec2( p.x.add( p.y ), vW.y ).div( 1.2 ) ).toVar();
    		const alb = vec3( .16, .155, .15 ).mul( dt.rgb ).mul( add( .85, mul( .25, n2( p.mul( 3. ).add( vW.y ) ) ) ) ).toVar();
    		c.assign( shade( vW, n, normalize( uCam.sub( vW ) ), alb, .55, 0. ) );

    	} ).Else( () => {

    		const tile = p.div( 1.5 ).toVar();
    		const tf = fract( tile ).toVar();
    		const ti = floor( tile ).toVar();
    		const hs = h21( ti ).toVar(), hs2 = h21( ti.add( 17. ) ).toVar(), newSl = step( .9, h21( ti.add( 31. ) ) ).toVar();
    		const dt = walkTex( p.div( 2.5 ).add( vec2( hs, hs2 ).mul( 7. ) ) ).toVar();
    		const tone = mix( vec3( 1.03, 1., .96 ), vec3( .95, .98, 1.03 ), hs2 ).mul( add( .82, mul( .3, hs ) ) ).toVar();
    		const alb = vec3( .14, .135, .13 ).mul( tone ).mul( mix( dt.rgb, vec3( 1. ).add( dt.rgb.sub( 1. ).mul( .4 ) ), newSl ) ).mul( mix( 1., 1.3, newSl ) ).mul( add( .88, mul( .24, fbm( p.mul( .8 ) ) ) ) ).toVar();
    		const e = min( tf, sub( 1., tf ) ).mul( 1.5 ).toVar();
    		const ed = min( e.x, e.y ).toVar();
    		const groove = sub( 1., smoothstep( .003, .009, ed ) ).mul( kFine ).toVar(), dirtJ = sub( 1., smoothstep( .0, .07, ed ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .5, groove ) ).mul( sub( 1., mul( .3, dirtJ ).mul( sub( 1., mul( .5, newSl ) ) ) ) ) );
    		const nn = vec3( 0, 1, 0 ).toVar();
    		const bev = sub( 1., smoothstep( .006, .022, ed ) ).mul( kFine ).mul( .5 ).toVar();
    		nn.xz.addAssign( select( e.x.lessThan( e.y ), vec2( select( tf.x.lessThan( .5 ), bev.negate(), bev ), 0. ), vec2( 0., select( tf.y.lessThan( .5 ), bev.negate(), bev ) ) ) );
    		const X0 = uCity.x.toVar(), Z0 = uCity.y.toVar(), P = uCity.z.toVar(), Q = uCity.w.toVar();
    		const ia = floor( p.x.sub( X0 ).div( P ).add( .5 ) ).toVar();
    		const dx = abs( p.x.sub( X0.add( ia.mul( P ) ) ) ).toVar();
    		const js = floor( p.y.sub( Z0 ).div( Q ).add( .5 ) ).toVar();
    		const dz = abs( p.y.sub( Z0.add( js.mul( Q ) ) ) ).toVar();
    		const curb = max( step( dx, 8.35 ).mul( step( 8., dx ) ), step( dz, 8.35 ).mul( step( 8., dz ) ) ).toVar();
    		const ca = hs2.mul( 6.2832 ).toVar();
    		const cd = vec2( sin( ca ).negate(), cos( ca ) ).toVar();
    		const dl = abs( dot( tf.sub( .5 ).sub( vec2( hs, h21( ti.add( 5. ) ) ).sub( .5 ).mul( .4 ) ), cd ) ).add( n2( tf.mul( 7. ).add( hs.mul( 9. ) ) ).sub( .5 ).mul( .05 ) ).toVar();
    		const crack = step( .75, h21( ti.add( 9. ) ) ).mul( sub( 1., newSl ) ).mul( sub( 1., smoothstep( .0015, .005, dl.mul( 1.5 ) ) ) ).mul( smoothstep( .0, .12, ed ) ).mul( kFine ).toVar();
    		alb.mulAssign( sub( 1., mul( .55, crack ) ) );
    		const gq = p.div( .18 ).toVar(), gi = floor( gq ).toVar();
    		const gh = h21( gi.add( 3.7 ) ).toVar();
    		const cdist = min( abs( dx.sub( 8.35 ) ), abs( dz.sub( 8.35 ) ) ).toVar();
    		const go = vec2( h21( gi.add( 1.3 ) ), h21( gi.add( 8.9 ) ) ).mul( .6 ).add( .2 ).toVar();
    		const gum = step( sub( 1., mul( .06, add( 1., mul( 1.2, sub( 1., smoothstep( .5, 3., cdist ) ) ) ) ) ), gh ).mul( sub( 1., smoothstep( .008, .013, length( fract( gq ).sub( go ) ).mul( .18 ) ) ) ).mul( kFine ).mul( sub( 1., curb ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .55, gum ) ) );
    		alb.mulAssign( sub( 1., mul( .22, sub( 1., smoothstep( .0, 1.4, cdist ) ) ).mul( add( .6, mul( .4, n2( p.mul( 1.7 ) ) ) ) ).mul( sub( 1., curb ) ) ) );
    		alb.assign( mix( alb, vec3( .2, .19, .18 ).mul( dt.rgb ).mul( add( .8, mul( .3, n2( p.mul( 6. ) ) ) ) ), curb ) );
    		const stain = smoothstep( .5, .8, fbm( p.mul( .25 ).add( 3. ) ) ).toVar();
    		alb.mulAssign( sub( 1., stain.mul( .35 ) ) );
    		const sunk = step( .94, h21( ti.add( 37. ) ) ).toVar();
    		const pud = smoothstep( .62, .7, fbm( p.mul( .2 ).add( 11. ) ).add( dirtJ.mul( .08 ) ).add( sunk.mul( .12 ) ).add( sub( 1., smoothstep( 0., 1.2, cdist ) ).mul( .05 ) ) ).mul( sub( 1., curb ) ).toVar();
    		const dist = length( vW.sub( uCam ) ).toVar();

    		If( dist.lessThan( 30. ), () => {

    			nn.xz.addAssign( ripple( p, uTime.add( 3. ) ).mul( .35 ).mul( pud ).mul( sub( 1., dist.div( 30. ) ) ).mul( sub( 1., rainCover( vW ) ) ) );

    		} );

    		nn.xz.addAssign( vec2( hs, h21( ti.add( 4. ) ) ).sub( .5 ).mul( .04 ) );

    		If( uFac.y.greaterThan( .5 ).and( dt.a.greaterThan( .5 ) ), () => {

    			const tn = texA_( uFacN, vec3( p.div( 2.5 ).add( vec2( hs, hs2 ).mul( 7. ) ), 2. ) ).rgb.toVar();
    			nn.xz.addAssign( vec2( tn.r.mul( 2. ).sub( 1. ), sub( 1., tn.g.mul( 2. ) ) ).mul( .35 ).mul( sub( 1., pud ) ).mul( kFine ) );

    		} );

    		c.assign( wetSurfaceR( alb, normalize( nW( nn ) ), mul( .6, add( .75, mul( .5, h21( ti.add( 29. ) ) ) ) ), pud, 0., mix( .6, .85, h21( ti.add( 23. ) ) ) ) );

    	} );

    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
