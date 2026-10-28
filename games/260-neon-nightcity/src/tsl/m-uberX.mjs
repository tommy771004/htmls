// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "uberX"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{\"INST_EXTRA\":\"\",\"FAR\":\"*\",\"FARC\":\"\"}": {
  h: "1qx49u5uf1", lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uVilA","type":"sampler2DArray","src":"uVilA"},{"name":"uVilN","type":"sampler2DArray","src":"uVilN"},{"name":"uVil","type":"vec4","src":"uVil"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vP","type":"vec3","src":"vP"},{"name":"vNo","type":"vec3","src":"vNo"},{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"},{"name":"aIns","type":"vec4","src":"aIns"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vP.assign( pGeom_ );
    	vNo.assign( nGeom_ );
    	vIns.assign( aIns );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { fwidth, max, smoothstep, sub, Fn, bool, vec2, abs, If, floor, fract, mix, mul, mod, step, select, vec3, dot, clamp, property, length, vec4, add, cross, sin, cos, mat2, min, atan, float, div, pow, exp, mat3, Discard, normalize, int, reflect } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const kxAA =  Fn( ( [ q ] ) => {

    	return sub( 1., smoothstep( .25, .7, max( fwidth( q.x ), fwidth( q.y ) ) ) );

    }, { q: 'vec2', return: 'float' } );

    const kxFade =  Fn( ( [ q ] ) => {

    	return sub( 1., smoothstep( .9, 2.6, fwidth( q ) ) );

    }, { q: 'float', return: 'float' } );

    const kxUV =  Fn( ( [ p, n, ax ] ) => {

    	const done_ = bool( false ).toVar();
    	const ret_ = vec2( 0 ).toVar();
    	const a = abs( n ).toVar();

    	If( a.y.greaterThan( a.x ).and( a.y.greaterThan( a.z ) ), () => {

    		ax.assign( 1. );
    		ret_.assign( p.xz );
    		done_.assign( true );

    	} );

    	If( done_.not(), () => {

    		If( a.x.greaterThan( a.z ), () => {

    			ax.assign( 0. );
    			ret_.assign( vec2( p.z, p.y ) );
    			done_.assign( true );

    		} );

    		If( done_.not(), () => {

    			ax.assign( 2. );
    			ret_.assign( p.xy );
    			done_.assign( true );

    		} );

    	} );

    	return ret_;

    } );

    const n3 =  Fn( ( [ p ] ) => {

    	const z = floor( p.z ).toVar();
    	const o = vec2( 17.31, 31.73 ).toVar();

    	return mix( n2( p.xy.add( z.mul( o ) ) ), n2( p.xy.add( z.add( 1. ).mul( o ) ) ), smoothstep( 0., 1., fract( p.z ) ) );

    }, { p: 'vec3', return: 'float' } );

    const fbm3 =  Fn( ( [ p ] ) => {

    	return mul( .5, n3( p ) ).add( mul( .3, n3( p.mul( 2.07 ).add( 5.1 ) ) ) ).add( mul( .2, n3( p.mul( 4.3 ).add( 9.7 ) ) ) );

    }, { p: 'vec3', return: 'float' } );

    const kxMortar =  Fn( ( [ q, sz, j, id ] ) => {

    	const b = q.div( sz ).toVar();
    	b.x.addAssign( step( 1., mod( floor( b.y ), 2. ) ).mul( .5 ) );
    	id.assign( floor( b ) );
    	const f = fract( b ).toVar(), w = j.div( sz ).toVar(), fw = fwidth( b ).mul( .8 ).add( 1e-4 ).toVar();
    	const m = smoothstep( w.y, w.y.add( fw.y ), f.y ).mul( smoothstep( w.x, w.x.add( fw.x ), f.x ) ).toVar();

    	return mix( .85, m, sub( 1., smoothstep( .15, .45, fwidth( b.y ) ) ) );

    } );

    const kxStreak =  Fn( ( [ p, uv, k ] ) => {

    	return smoothstep( .5, .85, fbm( vec2( uv.x.mul( k ), p.y.mul( .3 ) ) ).add( mul( .25, n3( p.mul( .7 ) ) ) ).sub( .12 ) );

    }, { p: 'vec3', uv: 'vec2', k: 'float', return: 'float' } );

    const kxVilQ =  Fn( ( [ m, p, uv, ax, sd ] ) => {

    	const L = select( m.equal( 44 ), 1., select( m.equal( 46 ), 3., 0. ) ).toVar(), sc = select( m.equal( 43 ), 2.3, select( m.equal( 44 ), .75, select( m.equal( 45 ), 1.7, 1.6 ) ) ).toVar();
    	const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y.negate() ) ).toVar();

    	return vec3( q.div( sc ).add( fract( vec2( sd.mul( .131 ), sd.mul( .287 ) ) ) ), L );

    }, { m: 'int', p: 'vec3', uv: 'vec2', ax: 'float', sd: 'float', return: 'vec3' } );

    const kxVil =  Fn( ( [ alb, q, chroma ] ) => {

    	const t = texA_( uVilA, q ).rgb.toVar(), mu = texLA_( uVilA, q, 10. ).rgb.toVar(), r = t.mul( t ).div( max( mu.mul( mu ), vec3( .003 ) ) ).toVar();

    	return alb.mul( mix( vec3( dot( r, vec3( .3, .5, .2 ) ) ), r, chroma ) );

    } );

    const kxFloor =  Fn( ( [ q, dc ] ) => {

    	const fu = q.add( vec2( n2( q.mul( .31 ) ), n2( q.mul( .31 ).add( 7.3 ) ) ).sub( .5 ).mul( 6. ) ).sub( uFM.xy ).mul( uFM.z ).toVar(), e1 = vec2( mul( 2.5, uFM.z ), 0. ).toVar(), e2 = vec2( 0., mul( 2.5, uFM.z ) ).toVar();
    	const cv = mul( .25, step( 1., uFMap.sample( fu.add( e1 ) ).level( 0. ).r ).add( step( 1., uFMap.sample( fu.sub( e1 ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.add( e2 ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.sub( e2 ) ).level( 0. ).r ) ) ).toVar();
    	cv.assign( select( uFM.w.greaterThan( 0. ), smoothstep( .1, .9, cv ), .5 ) );
    	const fd = smoothstep( 10., 70., dc ).mul( .85 ).add( smoothstep( 90., 220., dc ).mul( .15 ) ).toVar(), bl = smoothstep( .35, .65, fbm( q.mul( .09 ).add( 4.1 ) ) ).toVar();
    	const lit = mix( mix( texA_( uVilA, vec3( q.div( 2.2 ), 6. ) ).rgb, texA_( uVilA, vec3( q.div( 6.9 ).add( .29 ), 6. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 6. ), 10. ).rgb, fd ).toVar();
    	const mos = mix( mix( texA_( uVilA, vec3( q.div( 2.6 ), 7. ) ).rgb, texA_( uVilA, vec3( q.div( 7.3 ).add( .41 ), 7. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 7. ), 10. ).rgb, fd ).toVar();
    	const grs = mix( mix( texA_( uVilA, vec3( q.div( 2.3 ), 5. ) ).rgb, texA_( uVilA, vec3( q.div( 8.1 ).add( .53 ), 5. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 5. ), 10. ).rgb, fd ).toVar();
    	lit.mulAssign( lit );
    	mos.mulAssign( mos );
    	grs.mulAssign( grs );
    	const lg = dot( grs, vec3( .3, .55, .15 ) ).div( .053 ).toVar(), lm = dot( mos, vec3( .3, .55, .15 ) ).div( .138 ).toVar();
    	grs.assign( vec3( .07, .105, .035 ).mul( lg ) );
    	mos.assign( vec3( .06, .07, .035 ).mul( lm ) );
    	lit.assign( mix( vec3( dot( lit, vec3( .3, .55, .15 ) ) ), lit, .75 ).mul( .36 ) );
    	const cw = mul( .25, step( 1., uFMap.sample( fu.add( e1.mul( 3.6 ) ) ).level( 0. ).r ).add( step( 1., uFMap.sample( fu.sub( e1.mul( 3.6 ) ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.add( e2.mul( 3.6 ) ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.sub( e2.mul( 3.6 ) ) ).level( 0. ).r ) ) ).toVar();
    	cw.assign( select( uFM.w.greaterThan( 0. ), max( cv, cw.mul( .7 ) ), .5 ) );
    	const under = mix( mos, lit, smoothstep( .2, .5, n2( q.mul( .21 ) ).mul( .6 ).add( n2( q.mul( .7 ).add( 1.3 ) ).mul( .4 ) ).add( cv.mul( .35 ) ) ) ).toVar();
    	const op = sub( 1., smoothstep( .15, .75, cw ) ).mul( sub( 1., mul( .45, smoothstep( .55, .7, fbm( q.mul( .05 ).add( 2.6 ) ) ) ) ) ).toVar();

    	return mix( under, grs, op );

    } );

    const kxCrag =  Fn( ( [ p, n ] ) => {

    	return clamp( smoothstep( .68, .56, n.y ).add( smoothstep( .76, .86, fbm( p.xz.mul( .045 ).add( 3.7 ) ) ).mul( .5 ) ), 0., 1. );

    }, { p: 'vec3', n: 'vec3', return: 'float' } );

    const kxRock =  Fn( ( [ p, n ] ) => {

    	return clamp( smoothstep( .9, .72, n.y ).add( smoothstep( .62, .78, fbm( p.xz.mul( .045 ).add( 3.7 ) ) ).mul( .7 ) ), 0., 1. );

    }, { p: 'vec3', n: 'vec3', return: 'float' } );

    const texNrm =  Fn( ( [ m, p, n, io ] ) => {

    	const ax = property( 'float' );
    	const uv = kxUV( p, n, ax ).toVar();
    	const Tg = select( ax.equal( 0. ), vec3( 0., 0., 1. ), vec3( 1., 0., 0. ) ).toVar(), Bg = select( ax.equal( 1. ), vec3( 0., 0., -1 ), vec3( 0., 1., 0. ) ).toVar();
    	const t = property( 'vec4' );
    	const k = select( m.equal( 44 ), .7, 1. ).toVar(), rough = property( 'float' );

    	If( m.equal( 42 ).or( m.equal( 50 ) ), () => {

    		const q = p.xz.toVar();
    		const dc = length( uCam.sub( p ) ).toVar();
    		const g = mix( texA_( uVilN, vec3( q.div( 2.6 ), 7. ) ), texA_( uVilN, vec3( q.div( 2.2 ), 6. ) ), smoothstep( .3, .6, n2( q.mul( .21 ) ).mul( .6 ).add( n2( q.mul( .7 ).add( 1.3 ) ).mul( .4 ) ) ) ).toVar();
    		t.assign( mix( g, texA_( uVilN, vec3( q.div( 4. ).add( .37 ), 4. ) ), kxCrag( p, n ) ) );
    		k.assign( max( clamp( io.y.div( .4 ), 0., 1. ), sub( 1., smoothstep( 220., 330., dc ) ) ).mul( 1.2 ).mul( sub( 1., smoothstep( 10., 150., dc ) ) ) );
    		Tg.assign( vec3( 1., 0., 0. ) );
    		Bg.assign( vec3( 0., 0., -1 ) );
    		rough.assign( -1 );

    	} ).Else( () => {

    		t.assign( texA_( uVilN, kxVilQ( m, p, uv, ax, io.x.add( select( m.equal( 44 ), floor( uv.x.div( .09 ) ).mul( .37 ), 0. ) ) ) ) );
    		rough.assign( select( m.equal( 45 ), mix( .35, .7, t.b ), select( m.equal( 44 ), mix( .5, .8, t.b ), mix( .65, 1., t.b ) ) ) );

    	} );

    	return vec4( Tg.mul( t.r.mul( 2. ).sub( 1. ) ).add( Bg.mul( t.g.mul( 2. ).sub( 1. ) ) ).mul( k ), rough );

    } );

    const texMat =  Fn( ( [ m, p, n, io ] ) => {

    	const alb = io[ 0 ].toVar();
    	const rough = io[ 1 ].x.toVar(), metal = io[ 1 ].y.toVar(), envK = io[ 1 ].z.toVar(), sd = io[ 2 ].x.toVar();
    	const emi = vec3( 0. ).toVar();
    	const ax = property( 'float' );
    	const uv = kxUV( p, n, ax ).toVar();
    	const vert = select( ax.equal( 1. ), 0., 1. ).toVar(), up = smoothstep( .6, .95, n.y ).toVar();

    	If( m.equal( 20 ), () => {

    		const aa = kxAA( uv.mul( 40. ) ).toVar();
    		alb.mulAssign( add( .74, mul( .4, fbm3( p.mul( 1.6 ) ) ) ).add( aa.mul( n2( uv.mul( 40. ) ).sub( .5 ) ).mul( .22 ) ) );
    		alb.mulAssign( sub( 1., mul( .4, aa ).mul( step( .93, n2( uv.mul( 61. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .32, vert ).mul( kxStreak( p, uv, 2.4 ) ) ) );
    		const fl = vert.mul( clamp( smoothstep( .012, 0., abs( fract( uv.x.div( 1.22 ) ).sub( .5 ) ).sub( .488 ) ).add( smoothstep( .01, 0., abs( fract( p.y.div( .61 ) ).sub( .5 ) ).sub( .49 ) ) ), 0., 1. ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .16, fl ).mul( kxAA( uv.mul( 3. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .82, .86, .8 ) ), up.mul( smoothstep( .45, .75, fbm3( p.mul( 3. ) ) ) ) ) );
    		rough.assign( .9 );

    	} ).ElseIf( m.equal( 21 ), () => {

    		const r = fbm3( p.mul( 2.6 ).add( 7. ) ).add( mul( .14, n3( p.mul( 23. ) ) ) ).add( vert.mul( .3 ).mul( smoothstep( .55, .9, fbm( vec2( uv.x.mul( 7. ), p.y.mul( .5 ) ) ) ) ) ).toVar();
    		const rust = smoothstep( .6, .74, r ).toVar(), halo = smoothstep( .5, .62, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, vec3( .11, .1, .09 ), mul( .35, fbm3( p.mul( 1.3 ).add( 2. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .75, .62, .5 ) ), halo.mul( .7 ) ) );
    		alb.assign( mix( alb, mix( vec3( .16, .055, .02 ), vec3( .3, .13, .04 ), n3( p.mul( 31. ) ) ), rust.mul( .9 ) ) );
    		const aa = kxAA( uv.mul( 30. ) ).toVar(), chip = step( .84, n3( p.mul( 34. ) ) ).mul( aa ).mul( sub( 1., rust ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .2, .19 ), chip.mul( .8 ) ) );
    		alb.mulAssign( add( .9, mul( .2, aa ).mul( n2( uv.mul( vec2( 90., 6. ) ) ) ) ) );
    		rough.assign( mix( .45, .9, max( rust, mul( .5, chip ) ) ) );
    		metal.assign( mix( .45, .05, rust ) );
    		envK.assign( mul( .28, sub( 1., rust ) ) );

    	} ).ElseIf( m.equal( 22 ), () => {

    		const sp = h21( floor( uv.mul( 16. ) ) ).toVar(), d = fbm3( p.mul( 1.3 ).add( 3. ) ).toVar();
    		alb.mulAssign( add( .84, mul( .3, sp ).mul( kxAA( uv.mul( 16. ) ) ) ).mul( add( .78, mul( .36, d ) ) ) );
    		alb.assign( mix( alb, vec3( .26, .25, .22 ), mul( .3, smoothstep( .55, .8, fbm3( p.mul( 4. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( kxStreak( p, uv, 4. ) ) ) );
    		rough.assign( add( .32, mul( .32, d ) ) );
    		metal.assign( .85 );
    		envK.assign( .55 );

    	} ).ElseIf( m.greaterThanEqual( 23 ).and( m.lessThanEqual( 25 ) ), () => {

    		const A = select( m.equal( 23 ), vec3( 1, 0, 0 ), select( m.equal( 24 ), vec3( 0, 1, 0 ), vec3( 0, 0, 1 ) ) ).toVar();
    		const along = dot( p, A ).toVar();
    		const t = cross( n, A ).toVar();
    		const tl = length( t ).toVar();
    		const cr = select( tl.greaterThan( .3 ), dot( p, t.div( tl ) ), length( p.sub( along.mul( A ) ) ).mul( 1.3 ) ).toVar();
    		const warp = fbm( vec2( along.mul( .35 ), cr.mul( 4. ) ) ).mul( 5. ).toVar();
    		const streak = fbm( vec2( along.mul( .7 ), cr.mul( 26. ).add( warp ) ) ).toVar();
    		const g = cr.mul( 160. ).add( warp.mul( 6. ) ).toVar();
    		const lines = smoothstep( .55, .95, abs( sin( g ) ) ).mul( kxFade( g ) ).toVar();
    		alb.mulAssign( add( .56, mul( .62, streak ) ) );
    		alb.mulAssign( sub( 1., mul( .24, lines ) ) );
    		alb.mulAssign( add( .82, mul( .3, n2( vec2( along.mul( .25 ), cr.mul( 2.5 ) ) ) ) ) );
    		const knot = smoothstep( .06, .0, length( vec2( fract( along.mul( .55 ) ).sub( .5 ), fract( cr.mul( 3.3 ) ).sub( .5 ).mul( .4 ) ) ) ).mul( step( .7, h21( floor( vec2( along.mul( .55 ), cr.mul( 3.3 ) ) ) ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .5, knot ) ) );
    		alb.assign( mix( alb, vec3( .24, .22, .2 ), up.mul( .35 ).mul( smoothstep( .4, .75, fbm3( p.mul( 2. ) ) ) ) ) );
    		rough.assign( .8 );

    	} ).ElseIf( m.equal( 26 ).or( m.equal( 27 ) ), () => {

    		const id = property( 'vec2' );
    		const q = select( m.equal( 26 ), kxMortar( vec2( uv.x, p.y ), vec2( .4, .2 ), .012, id ), kxMortar( vec2( uv.x, p.y ), vec2( .23, .076 ), .01, id ) ).toVar();

    		If( ax.equal( 1. ), () => {

    			q.assign( 1. );
    			id.assign( floor( uv.mul( 3. ) ) );

    		} );

    		const bv = h21( id.add( 3.7 ) ).toVar();
    		alb.mulAssign( mix( .58, 1., q ).mul( select( m.equal( 26 ), add( .86, mul( .2, bv ) ), add( .74, mul( .42, bv ) ) ) ).mul( add( .84, mul( .26, fbm3( p.mul( 3. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( kxStreak( p, uv, 3. ) ) ) );
    		rough.assign( .9 );

    	} ).ElseIf( m.equal( 28 ), () => {

    		const id = property( 'vec2' );
    		const q = kxMortar( select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ), vec2( .62, .31 ), .015, id ).toVar();
    		const bv = h21( id.add( 1.3 ) ).toVar();
    		alb.mulAssign( mix( .58, 1., q ).mul( add( .76, mul( .38, bv ) ) ).mul( add( .84, mul( .28, n2( uv.mul( 23. ) ) ).mul( kxAA( uv.mul( 23. ) ) ) ) ).mul( add( .88, mul( .22, fbm3( p.mul( 2. ) ) ) ) ) );
    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 29 ), () => {

    		alb.mulAssign( add( .82, mul( .3, fbm3( p.mul( 2.2 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .1, .1, .095 ), mul( .25, fbm3( p.mul( .9 ).add( 4. ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .35, vert ).mul( kxStreak( p, uv, 5. ) ) ) );
    		rough.assign( .55 );
    		metal.assign( .35 );
    		envK.assign( .35 );

    	} ).ElseIf( m.equal( 31 ), () => {

    		const q = uv.div( .006 ).toVar(), c = floor( q ).toVar(), f = fract( q ).toVar();
    		const d = mod( floor( c.x.add( c.y ).mul( .5 ) ), 2. ).toVar(), a = select( d.greaterThan( .5 ), f.y, f.x ).toVar(), aa = kxAA( q ).toVar();
    		alb.mulAssign( mix( 1.3, select( d.greaterThan( .5 ), 1.9, .8 ).mul( add( .55, mul( .45, sin( a.mul( 3.1416 ) ) ) ) ), aa ) );
    		rough.assign( .2 );
    		envK.assign( .45 );

    	} ).ElseIf( m.equal( 32 ), () => {

    		const t = fract( p.z.mul( 3.2 ).add( mul( .12, fbm3( p.mul( 9. ) ) ) ) ).toVar();
    		const a = vec3( .62, .5, .3 ).toVar(), b = vec3( .36, .2, .5 ).toVar(), c = vec3( .2, .34, .62 ).toVar();
    		alb.assign( select( t.lessThan( .5 ), mix( a, b, t.mul( 2. ) ), mix( b, c, t.mul( 2. ).sub( 1. ) ) ) );
    		rough.assign( .2 );
    		metal.assign( 1. );
    		envK.assign( .9 );

    	} ).ElseIf( m.equal( 33 ), () => {

    		const aa = kxAA( uv.mul( 220. ) ).toVar(), c = h21( floor( uv.mul( 220. ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .22, fbm3( p.mul( .35 ) ) ) ) );
    		alb.assign( mix( alb, select( c.greaterThan( .5 ), vec3( .75, .76, .78 ), vec3( .12, .13, .15 ) ), step( .9, abs( c.sub( .5 ) ).mul( 2. ) ).mul( aa ).mul( .5 ) ) );
    		const tire = smoothstep( .62, .82, fbm( vec2( uv.x.mul( 2.6 ), uv.y.mul( .12 ) ) ).add( mul( .3, fbm( vec2( uv.x.mul( 9. ), uv.y.mul( .4 ) ) ) ) ).sub( .15 ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .3, tire ).mul( up ) ) );
    		const oil = max( smoothstep( .78, .84, fbm3( vec3( uv.mul( .45 ), 3.1 ) ).add( mul( .06, n2( uv.mul( 7. ) ) ) ) ), mul( .8, smoothstep( .955, .985, n2( uv.mul( 2.3 ).add( 7. ) ) ) ) ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .62, .6, .58 ) ), oil.mul( up ) ) );
    		const jt = max( smoothstep( .006, 0., abs( fract( uv.x.div( 6. ).add( .5 ) ).sub( .5 ) ).mul( 6. ).sub( .004 ) ), smoothstep( .006, 0., abs( fract( uv.y.div( 6. ).add( .5 ) ).sub( .5 ) ).mul( 6. ).sub( .004 ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .55, jt ).mul( up ).mul( kxAA( uv.mul( 2. ) ) ) ) );
    		const scr = smoothstep( .985, 1., n2( vec2( uv.x.mul( 3. ).add( uv.y.mul( 40. ) ), uv.y.mul( 1.5 ) ) ) ).mul( kxAA( uv.mul( 40. ) ) ).toVar();
    		alb.assign( mix( alb, alb.mul( 1.35 ).add( .03 ), scr.mul( up ) ) );
    		rough.assign( mix( add( .26, mul( .2, tire ) ), .12, oil ) );
    		envK.assign( add( .03, mul( .04, oil ) ) );

    	} ).ElseIf( m.equal( 34 ), () => {

    		const aa = kxAA( uv.mul( 80. ) ).toVar();
    		alb.mulAssign( add( .94, mul( .1, aa ).mul( n2( uv.mul( 80. ) ) ) ).add( mul( .1, fbm3( p.mul( 1.8 ) ).sub( .5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .55 ), sub( 1., smoothstep( .0, .35, p.y ) ).mul( vert ).mul( .6 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .7, .68, .64 ) ), mul( .4, smoothstep( .62, .8, fbm3( p.mul( 5. ).add( 2. ) ) ) ).mul( vert ) ) );
    		const chip = step( .97, n3( p.mul( 40. ) ) ).mul( smoothstep( .55, .7, fbm3( p.mul( 2.3 ).add( 5. ) ) ) ).mul( kxAA( uv.mul( 40. ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .3, .3, .29 ), chip.mul( .8 ) ) );
    		rough.assign( mix( .34, .7, chip ).add( mul( .1, fbm3( p.mul( 3. ) ) ) ) );
    		metal.assign( .15 );
    		envK.assign( mul( .05, sub( 1., chip ) ) );

    	} ).ElseIf( m.equal( 35 ), () => {

    		const aa = kxAA( vec2( uv.x.mul( 4. ), uv.y.mul( 400. ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .14, fbm3( p.mul( 2. ) ) ) ).add( mul( .1, aa ).mul( n2( vec2( uv.x.mul( 4. ), uv.y.mul( 400. ) ) ).sub( .5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .72 ), mul( .35, smoothstep( .6, .85, fbm3( p.mul( 6. ).add( 1. ) ) ) ) ) );
    		rough.assign( add( .3, mul( .16, fbm3( p.mul( 4. ) ) ) ) );
    		metal.assign( .7 );
    		envK.assign( .06 );

    	} ).ElseIf( m.equal( 36 ), () => {

    		const q = uv.div( .0254 ).toVar(), f = fract( q ).sub( .5 ).toVar();
    		const aa = kxAA( q ).toVar();
    		const hole = sub( 1., smoothstep( .16, .23, length( f ) ) ).toVar();
    		alb.mulAssign( mix( .84, sub( 1., mul( .85, hole ) ), aa ).mul( add( .88, mul( .18, fbm3( p.mul( 2.5 ) ) ) ) ) );
    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 40 ), () => {

    		const q = uv.div( .625 ).toVar(), id = floor( q ).toVar(), f = fract( q ).toVar();
    		const hv = h21( id.add( 2.7 ) ).toVar(), ang = hv.mul( 6.2832 ).toVar(), aa = kxAA( uv.mul( 30. ) ).toVar();
    		const r = mat2( cos( ang ), sin( ang ).negate(), sin( ang ), cos( ang ) ).mul( uv.mul( 1.7 ) ).add( id.mul( 3.1 ) ).toVar();
    		const w = fbm( r.mul( .9 ).add( fbm( r.mul( 2.3 ) ).mul( 1.6 ) ) ).toVar();
    		const vein = smoothstep( .06, 0., abs( sin( r.x.add( w.mul( 2.4 ) ).mul( 2.6 ) ) ).sub( .02 ) ).mul( add( .5, mul( .5, fbm( r.mul( 4. ) ) ) ) ).toVar();
    		alb.mulAssign( add( .9, mul( .16, hv ) ).mul( add( .93, mul( .12, w ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .55, .53, .52 ) ), vein.mul( .55 ).mul( aa ) ) );
    		const g = min( min( f.x, sub( 1., f.x ) ), min( f.y, sub( 1., f.y ) ) ).toVar(), grout = sub( 1., smoothstep( .004, .009, g ) ).mul( kxAA( q ) ).toVar();
    		alb.assign( mix( alb, alb.mul( .55 ), grout ) );
    		rough.assign( mix( .14, .5, grout ).add( mul( .08, fbm3( p.mul( 3. ) ) ) ) );
    		envK.assign( .05 );

    	} ).ElseIf( m.equal( 41 ), () => {

    		alb.mulAssign( add( .92, mul( .1, fbm3( p.mul( .8 ) ) ) ).add( mul( .05, kxAA( uv.mul( 60. ) ) ).mul( n2( uv.mul( 60. ) ).sub( .5 ) ) ) );
    		alb.mulAssign( sub( 1., vert.mul( .22 ).mul( sub( 1., smoothstep( 0., .45, p.y ) ) ).mul( add( .6, mul( .4, fbm( vec2( uv.x.mul( 3. ), p.y.mul( 6. ) ) ) ) ) ) ) );
    		alb.mulAssign( sub( 1., vert.mul( .06 ).mul( smoothstep( .85, 1.1, p.y ) ).mul( smoothstep( 1.6, 1.3, p.y ) ).mul( fbm( vec2( uv.x.mul( 1.4 ), 1. ) ) ) ) );
    		rough.assign( .88 );

    	} ).ElseIf( m.greaterThanEqual( 37 ).and( m.lessThanEqual( 39 ) ), () => {

    		const sl = length( n.xz ).toVar();
    		const dS = select( sl.greaterThan( .05 ), n.xz.div( sl ), vec2( 0., 1. ) ).toVar();
    		const a = dot( p.xz, vec2( dS.y.negate(), dS.x ) ).toVar(), b = select( sl.greaterThan( .05 ), p.y.div( max( sl, .25 ) ), dot( p.xz, dS ) ).toVar();
    		const hue = alb.div( max( dot( alb, vec3( .3, .5, .2 ) ), .02 ) ).toVar();

    		If( m.lessThanEqual( 38 ).and( uFac.x.greaterThan( .5 ) ), () => {

    			const t = texA_( uFacA, vec3( vec2( a, b ).div( select( m.equal( 37 ), 2.9, 2. ) ), select( m.equal( 37 ), 5., 6. ) ) ).rgb.toVar();
    			alb.assign( t.mul( t ) );
    			alb.assign( mix( vec3( dot( alb, vec3( .3, .5, .2 ) ) ), alb, select( m.equal( 37 ), .7, 1. ) ).mul( mix( vec3( 1. ), hue, .2 ) ) );
    			rough.assign( select( m.equal( 37 ), .72, .55 ) );
    			envK.assign( select( m.equal( 37 ), 0., .1 ) );

    		} ).ElseIf( m.equal( 37 ), () => {

    			const q = vec2( a.div( .23 ), b.div( .34 ) ).toVar(), id = floor( q ).toVar(), f = fract( q ).toVar();
    			const aa = kxAA( q ).toVar();
    			const barrel = sin( f.x.mul( 3.1416 ) ).toVar(), lip = smoothstep( .78, 1., f.y ).toVar();
    			alb.mulAssign( mix( .86, add( .6, mul( .5, barrel ) ).mul( sub( 1., mul( .38, lip ) ) ), aa ).mul( add( .76, mul( .44, h21( id.add( 4.2 ) ) ) ) ) );
    			alb.assign( mix( alb, alb.mul( vec3( .66, .72, .55 ) ), mul( .55, smoothstep( .55, .85, fbm3( p.mul( 1.4 ) ) ) ) ) );
    			rough.assign( .72 );

    		} ).ElseIf( m.equal( 38 ), () => {

    			const id = property( 'vec2' );
    			const q = kxMortar( vec2( a, b ), vec2( .3, .16 ), .012, id ).toVar();
    			alb.mulAssign( mix( .5, 1., q ).mul( add( .78, mul( .38, h21( id.add( 2.1 ) ) ) ) ).mul( add( .86, mul( .2, fbm3( p.mul( 2. ) ) ) ) ) );
    			rough.assign( .55 );
    			envK.assign( .1 );

    		} ).Else( () => {

    			const d = abs( fract( a.div( .48 ) ).sub( .5 ) ).toVar(), aa = kxAA( vec2( a.div( .48 ), 1. ) ).toVar();
    			alb.mulAssign( mix( 1., add( 1., mul( .3, smoothstep( .45, .49, d ) ) ).mul( sub( 1., mul( .25, smoothstep( .4, .45, d ) ).mul( sub( 1., smoothstep( .45, .47, d ) ) ) ) ), aa ) );
    			alb.mulAssign( add( .82, mul( .28, fbm3( p.mul( 1.2 ) ) ) ).mul( sub( 1., mul( .25, smoothstep( .55, .85, fbm( vec2( a.mul( 3. ), b.mul( .4 ) ) ) ) ) ) ) );
    			alb.assign( mix( alb, vec3( .2, .09, .04 ), mul( .3, smoothstep( .62, .8, fbm3( p.mul( 2.3 ).add( 6. ) ) ) ) ) );
    			rough.assign( .45 );
    			metal.assign( .55 );
    			envK.assign( .3 );

    		} );

    		alb.mulAssign( add( .78, mul( .36, fbm3( p.mul( .21 ).add( 9. ) ) ) ) );
    		alb.assign( mix( alb, vec3( dot( alb, vec3( .3, .5, .2 ) ) ), add( .25, mul( .2, fbm3( p.mul( .37 ).add( 3. ) ) ) ) ) );

    	} ).ElseIf( m.equal( 42 ).or( m.equal( 50 ) ), () => {

    		alb.assign( mix( alb.mul( .55 ), vec3( .05, .06, .035 ), .35 ) );
    		const aa = kxAA( p.xz.mul( .22 ) ).toVar(), crown = n2( p.xz.mul( .22 ) ).mul( .6 ).add( n2( p.xz.mul( .57 ).add( 3.1 ) ).mul( .4 ) ).toVar();
    		const meadow = smoothstep( .58, .72, fbm( p.xz.mul( .006 ).add( 2. ) ) ).toVar(), steep = smoothstep( .8, .6, n.y ).toVar();
    		const forest = mix( alb.mul( .95 ), alb.mul( mix( .55, 1.35, smoothstep( .25, .8, crown ) ) ), aa ).toVar();
    		const grass = vec3( .075, .085, .035 ).mul( add( .8, mul( .4, fbm( p.xz.mul( .05 ) ) ) ) ).toVar(), rock = vec3( .11, .105, .095 ).mul( add( .7, mul( .5, fbm3( p.mul( .3 ) ) ) ) ).toVar();
    		alb.assign( mix( forest, grass, meadow.mul( sub( 1., steep ) ).mul( .85 ) ) );
    		alb.assign( mix( alb, rock, steep.mul( add( .6, mul( .4, fbm( p.xz.mul( .03 ) ) ) ) ) ) );
    		alb.mulAssign( add( .85, mul( .3, fbm( p.xz.mul( .0015 ).add( 5. ) ) ) ) );
    		rough.assign( .95 );
    		envK.assign( 0. );
    		const dc = length( uCam.sub( p ) ).toVar(), wf = max( clamp( io[ 2 ].y.div( .4 ), 0., 1. ), sub( 1., smoothstep( 220., 330., dc ) ) ).toVar();

    		If( uVil.x.greaterThan( .5 ).and( wf.greaterThan( 0. ) ), () => {

    			const q = p.xz.toVar();
    			const rk = kxCrag( p, n ).toVar(), fd = smoothstep( 10., 70., dc ).mul( .85 ).add( smoothstep( 90., 220., dc ).mul( .15 ) ).toVar();
    			const r = mix( texA_( uVilA, vec3( q.div( 4. ).add( .37 ), 4. ) ).rgb, texLA_( uVilA, vec3( q, 4. ), 10. ).rgb, fd.mul( .8 ) ).toVar();
    			r.mulAssign( r );
    			r.assign( mix( vec3( dot( r, vec3( .3, .55, .15 ) ) ), r, .35 ).mul( vec3( .95, .97, 1.05 ) ) );
    			const grd = mix( kxFloor( q, dc ), r, rk ).mul( add( .6, mul( .3, fbm( q.mul( .017 ).add( 1.3 ) ) ) ) ).toVar();
    			alb.assign( mix( alb, grd, clamp( wf.mul( add( .55, mul( .9, fbm( q.mul( .012 ).add( 8. ) ) ) ) ), 0., 1. ) ) );

    		} );

    	} ).ElseIf( m.equal( 51 ), () => {

    		const az = atan( p.z, p.x ).mul( 6. ).toVar(), vf = fbm( vec2( az.mul( .5 ), p.y.mul( .03 ) ) ).toVar();
    		const crack = smoothstep( .82, .97, abs( sin( az.mul( 1.3 ).add( vf.mul( 4. ) ) ) ) ).toVar();
    		const streak = smoothstep( .42, .72, fbm( vec2( az.mul( 1.9 ), p.y.mul( .012 ).add( vf ) ) ) ).toVar();
    		const strata = smoothstep( .93, 1., abs( sin( p.y.mul( .37 ).add( vf.mul( 5. ) ) ) ) ).mul( smoothstep( .3, .6, fbm( vec2( az.mul( .7 ), p.y.mul( .05 ) ) ) ) ).toVar();
    		alb.mulAssign( add( .5, mul( .35, fbm( vec2( az.mul( 3.1 ), p.y.mul( .21 ) ) ) ) ).mul( vec3( .92, .94, .97 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .22, .21, .2 ) ), clamp( streak.mul( .8 ).add( crack.mul( .5 ) ), 0., 1. ) ) );
    		alb.mulAssign( sub( 1., mul( .22, strata ) ) );
    		const moss = clamp( smoothstep( .4, .8, n.y ).add( smoothstep( .62, .78, fbm( vec2( az.mul( 4.3 ), p.y.mul( .27 ) ).add( 3. ) ) ).mul( .45 ) ), 0., 1. ).toVar();
    		alb.assign( mix( alb, vec3( .045, .06, .03 ), moss.mul( .85 ) ) );
    		rough.assign( .93 );

    	} ).ElseIf( m.equal( 43 ), () => {

    		const h = select( ax.equal( 1. ), uv.y, p.y ).toVar(), bd = floor( h.div( .15 ) ).toVar(), aa = kxAA( vec2( uv.x.mul( 8. ), h.div( .15 ) ) ).toVar();
    		const pv = select( uVil.x.greaterThan( .5 ), .5, 1. ).toVar();

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), .25 ).mul( add( .92, mul( .16, h21( vec2( bd, floor( uv.x.div( 2.4 ) ) ) ) ) ) ) );

    		} ).Else( () => {

    			alb.mulAssign( add( .8, mul( .2, h21( vec2( bd, floor( uv.x.div( 2.4 ) ) ) ) ) ).add( mul( .1, fbm3( p.mul( 1.3 ) ) ) ) );
    			alb.mulAssign( sub( 1., mul( .1, aa ).mul( smoothstep( .5, .9, fbm( vec2( uv.x.mul( 1.6 ), h.mul( 30. ).add( bd.mul( 7. ) ) ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .22, pv ).mul( vert ).mul( aa ).mul( smoothstep( .06, .0, abs( fract( h.div( .15 ) ).sub( .5 ) ).sub( .44 ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .5, vert ).mul( kxAA( uv.mul( 3. ) ) ).mul( smoothstep( .03, .015, length( vec2( fract( uv.x.div( .6 ) ).sub( .5 ), fract( h.div( .6 ) ).sub( .5 ) ).mul( .6 ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .2, vert ).mul( kxStreak( p, uv, 2. ) ) ) );
    		rough.assign( .82 );

    	} ).ElseIf( m.equal( 44 ), () => {

    		const a = select( ax.equal( 1. ), uv.x, uv.x ).toVar(), sl = a.div( .09 ).toVar(), id = floor( sl ).toVar(), aa = kxAA( vec2( sl, p.y.mul( 4. ) ) ).toVar();
    		alb.mulAssign( add( .7, mul( .45, h21( vec2( id, 3.1 ) ) ) ) );

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd.add( id.mul( .37 ) ) ), .35 ) );

    		} ).Else( () => {

    			alb.mulAssign( add( .78, mul( .3, fbm( vec2( fract( sl ).mul( 3. ).add( id.mul( 7. ) ), p.y.mul( 1.5 ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .85, vert ).mul( aa ).mul( smoothstep( .12, .05, abs( fract( sl ).sub( .5 ) ).sub( .38 ) ) ) ) );
    		rough.assign( .62 );
    		envK.assign( .04 );

    	} ).ElseIf( m.equal( 45 ), () => {

    		const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ).toVar(), id = floor( q.div( vec2( 1.2, .6 ) ) ).toVar(), f = fract( q.div( vec2( 1.2, .6 ) ) ).toVar();
    		const aa = kxAA( q.mul( 12. ) ).toVar(), vein = fbm( vec2( q.x.mul( .4 ).add( id.y.mul( 3. ) ), q.y.mul( 9. ).add( fbm( q.mul( 1.5 ) ).mul( 2. ) ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .2, h21( id.add( 2.3 ) ) ) ) );
    		alb.mulAssign( add( .82, mul( .3, smoothstep( .3, .7, vein ) ) ) );

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), 0. ) );

    		} ).Else( () => {

    			alb.mulAssign( sub( 1., mul( .35, aa ).mul( step( .86, n2( q.mul( vec2( 30., 60. ) ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .3, kxAA( q.mul( 3. ) ) ).mul( sub( 1., smoothstep( .0, 0.013333333333333334, min( min( f.x, sub( 1., f.x ) ).mul( 2. ), min( f.y, sub( 1., f.y ) ) ) ) ) ) ) );
    		rough.assign( .5 );
    		envK.assign( .08 );

    	} ).ElseIf( m.equal( 46 ), () => {

    		const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ).toVar();
    		const row = floor( q.y.div( .075 ) ).toVar(), th = float( .075 ).toVar(), sh = h21( vec2( row, 1.7 ) ).mul( 3. ).toVar();
    		const len = add( .2, mul( .4, h21( vec2( row, 4.1 ) ) ) ).toVar(), x = q.x.div( len ).add( sh ).toVar(), id = floor( x ).toVar();
    		const fy = fract( q.y.div( th ) ).toVar(), fx = fract( x ).toVar(), aa = kxAA( vec2( x, q.y.div( th ) ) ).toVar();
    		const gap = sub( 1., smoothstep( .0, .14, fy ) ).add( sub( 1., smoothstep( .0, div( .05, len ).mul( .2 ), min( fx, sub( 1., fx ) ) ) ) ).toVar();
    		const tone = h21( vec2( id, row ) ).toVar();

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), .5 ) );

    		} ).Else( () => {

    			alb.mulAssign( mix( vec3( .8 ), mix( vec3( 1.05, .95, .82 ), vec3( .85, .88, .92 ), step( .5, h21( vec2( row, id.add( 9. ) ) ) ) ), .6 ).mul( add( .6, mul( .6, tone ) ) ) );
    			alb.mulAssign( sub( 1., mul( .75, aa ).mul( clamp( gap, 0., 1. ) ) ) );

    		} );

    		rough.assign( .88 );

    	} ).ElseIf( m.equal( 47 ), () => {

    		const t = uTime.mul( .35 ).toVar();
    		const c1 = n2( uv.mul( 1.7 ).add( vec2( t, t.mul( .7 ) ) ) ).toVar(), c2 = n2( uv.mul( 2.9 ).sub( vec2( t.mul( .8 ), t.mul( .4 ) ) ) ).toVar();
    		const caus = pow( sub( 1., abs( c1.add( c2 ).sub( 1. ) ) ), 6. ).mul( kxAA( uv.mul( 3. ) ) ).toVar();
    		alb.assign( alb.mul( add( .75, mul( .5, caus ) ) ) );
    		rough.assign( .05 );
    		envK.assign( .55 );
    		emi.assign( alb.mul( add( .35, mul( .9, caus ) ) ).mul( uLampOn ).mul( 1.3 ) );

    	} ).ElseIf( m.equal( 48 ), () => {

    		const fl = floor( p.y.div( 3.3 ) ).toVar(), fy = fract( p.y.div( 3.3 ) ).toVar(), rm = floor( uv.x.div( 3.2 ) ).toVar();
    		const id = vec2( rm.add( sd.mul( 17. ) ), fl.add( float( ax ).mul( 5. ) ) ).toVar();
    		const on = step( .3, h21( id ) ).toVar(), tk = h21( id.add( 4.7 ) ).toVar();
    		const tint = mix( vec3( 1., .66, .38 ), vec3( 1., .84, .62 ), tk ).toVar();
    		const lit = add( .18, mul( .75, smoothstep( .62, .97, fy ) ) ).add( mul( .3, n2( vec2( uv.x.mul( .8 ), fl ) ) ).mul( add( .5, mul( .5, tk ) ) ) ).toVar();
    		const furn = mix( 1., .25, step( fy, .3 ).mul( step( .45, n2( vec2( uv.x.mul( 1.3 ).add( sd ), fl.mul( 3. ) ) ) ) ) ).toVar();
    		const curt = step( .75, h21( id.add( 1.9 ) ) ).toVar();
    		lit.assign( mix( lit.mul( furn ), .75, curt ) );
    		alb.assign( vec3( .022, .026, .03 ) );
    		rough.assign( .05 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		emi.assign( tint.mul( on ).mul( lit ).mul( uLampOn ).mul( add( .2, mul( .18, h21( id.add( 8.3 ) ) ) ) ) );

    	} ).ElseIf( m.equal( 49 ), () => {

    		const g = fract( p.xz.div( 1.6 ) ).sub( .5 ).toVar();
    		const d = length( g ).mul( 1.6 ).toVar(), dn = step( n.y, -0.5 ).toVar();
    		const dotL = smoothstep( .075, .055, d ).mul( dn ).toVar(), halo = exp( d.negate().mul( d ).mul( 3. ) ).mul( dn ).toVar();
    		alb.mulAssign( add( .9, mul( .1, fbm3( p.mul( 2. ) ) ) ).sub( mul( .25, dotL ) ) );
    		rough.assign( .9 );
    		emi.assign( vec3( 1., .78, .52 ).mul( dotL.mul( 2.6 ).add( halo.mul( .22 ) ) ).mul( uLampOn ) );

    	} ).Else( () => {

    		alb.assign( mix( alb, vec3( .075, .072, .068 ), mul( .3, fbm3( p.mul( 4. ) ) ).add( mul( .25, up ) ) ) );
    		alb.mulAssign( add( .88, mul( .2, n2( uv.mul( 60. ) ) ).mul( kxAA( uv.mul( 60. ) ) ) ) );
    		rough.assign( .78 );

    	} );

    	return mat3( alb, vec3( rough, metal, envK ), emi );

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	If( uFocus.w.greaterThan( 0. ), () => {

    		const ab = uFocus.xyz.sub( uCam ).toVar();
    		const tt = clamp( dot( vW.sub( uCam ), ab ).div( dot( ab, ab ) ), 0., 1. ).toVar();
    		const dd = length( vW.sub( uCam ).sub( ab.mul( tt ) ) ).toVar(), cd = length( vW.sub( uCam ) ).toVar();
    		const fade = max( sub( 1., smoothstep( .5, 1.6, cd ) ), sub( 1., smoothstep( .45, 1., dd ) ).mul( step( tt, .8 ) ).mul( .8 ) ).toVar();

    		If( fract( mul( 52.9829189, fract( dot( fragCoord_.xy, vec2( .06711056, .00583715 ) ) ) ) ).lessThan( fade ), () => {

    			Discard();

    		} );

    	} );

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const m = int( vMat.add( .5 ) ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();

    	If( m.greaterThanEqual( 20 ), () => {

    		const tio = vec3( vIns.z, vMat.sub( float( m ) ), 0. ).toVar();
    		const tm = texMat( m, vP, normalize( vNo ), mat3( alb, vec3( rough, metal, envK ), tio ) ).toVar();
    		alb.assign( tm[ 0 ] );
    		rough.assign( tm[ 1 ].x );
    		metal.assign( tm[ 1 ].y );
    		envK.assign( tm[ 1 ].z );
    		emi.assign( tm[ 2 ] );

    		If( uVil.y.greaterThan( .5 ).and( m.greaterThanEqual( 43 ).and( m.lessThanEqual( 46 ) ).or( m.equal( 42 ) ).or( m.equal( 50 ) ) ), () => {

    			const tn = texNrm( m, vP, normalize( vNo ), tio ).toVar();
    			const ca = cos( vIns.w ).toVar(), sa = sin( vIns.w ).toVar();
    			n.assign( normalize( n.add( vec3( ca.mul( tn.x ).add( sa.mul( tn.z ) ), tn.y, ca.mul( tn.z ).sub( sa.mul( tn.x ) ) ) ) ) );

    			If( tn.w.greaterThanEqual( 0. ), () => {

    				rough.assign( tn.w );

    			} );

    		} );

    	} ).ElseIf( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    	} ).ElseIf( m.equal( 1 ), () => {

    		alb.mulAssign( .12 );
    		rough.assign( .04 );
    		envK.assign( 1.1 );

    	} ).ElseIf( m.equal( 2 ), () => {

    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 3 ), () => {

    		rough.assign( .14 );
    		metal.assign( 1. );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 4 ), () => {

    		emi.assign( vCol.mul( add( .2, uM.x.mul( 1.7 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 5 ), () => {

    		const b = max( uM.y, vIns.x ).toVar();
    		emi.assign( vCol.mul( add( .7, b.mul( 2.6 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 6 ), () => {

    		rough.assign( .92 );
    		alb.mulAssign( .5 );

    	} ).ElseIf( m.equal( 7 ), () => {

    		rough.assign( .3 );
    		metal.assign( 1. );
    		envK.assign( .6 );

    	} ).ElseIf( m.equal( 8 ), () => {

    		emi.assign( vCol.mul( 2.4 ).mul( uM.z ).mul( add( .9, mul( .1, sin( uTime.mul( 2.3 ).add( vIns.y.mul( 9. ) ) ) ) ) ) );
    		alb.mulAssign( .1 );

    	} ).ElseIf( m.equal( 9 ), () => {

    		emi.assign( vCol.mul( step( .5, fract( uTime.mul( 1.3 ).add( vIns.y ) ) ) ).mul( 2.6 ) );

    	} ).ElseIf( m.equal( 10 ), () => {

    		rough.assign( .5 );

    	} ).ElseIf( m.equal( 11 ), () => {

    		emi.assign( vCol.mul( 1.1 ).mul( uM.z ) );
    		alb.mulAssign( .3 );

    	} ).ElseIf( m.greaterThanEqual( 12 ).and( m.lessThanEqual( 14 ) ), () => {

    		const on = select( abs( vIns.x.sub( float( m.sub( 12 ) ) ) ).lessThan( .5 ), 1., 0. ).toVar();
    		emi.assign( vCol.mul( add( .04, on.mul( 3.4 ) ) ) );
    		alb.mulAssign( .15 );

    	} ).ElseIf( m.equal( 15 ), () => {

    		rough.assign( .5 );
    		metal.assign( .8 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 16 ), () => {

    		emi.assign( vCol.mul( uLampOn ).mul( 1.6 ) );
    		alb.assign( vec3( .03 ) );
    		rough.assign( .08 );
    		envK.assign( 1. );

    	} );

    	alb.assign( mix( alb, vec3( .025, .022, .02 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	envK.mulAssign( sub( 1., uM.w ) );
    	emi.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).mul( sub( 1., step( 4., float( m ) ).mul( step( float( m ), 9. ) ) ) ).toVar();
    	wet.assign( 0. );
    	rough.assign( mix( rough, rough.mul( .35 ), wet ) );
    	alb.mulAssign( sub( 1., mul( .3, wet ) ) );
    	const c = shade( vW, n, v, alb, rough, metal ).toVar();

    	If( envK.greaterThan( 0. ).or( wet.greaterThan( .1 ) ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		c.addAssign( envMap( r ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( FAR ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"INST_EXTRA\":\"\"}": {
  h: "1b3qwwwueh", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uVilA","type":"sampler2DArray","src":"uVilA"},{"name":"uVilN","type":"sampler2DArray","src":"uVilN"},{"name":"uVil","type":"vec4","src":"uVil"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vP","type":"vec3","src":"vP"},{"name":"vNo","type":"vec3","src":"vNo"},{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"},{"name":"aIns","type":"vec4","src":"aIns"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vP.assign( pGeom_ );
    	vNo.assign( nGeom_ );
    	vIns.assign( aIns );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { fwidth, max, smoothstep, sub, Fn, bool, vec2, abs, If, floor, fract, mix, mul, mod, step, select, vec3, dot, clamp, property, length, vec4, add, cross, sin, cos, mat2, min, atan, float, div, pow, exp, mat3, Discard, normalize, int, reflect } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const kxAA =  Fn( ( [ q ] ) => {

    	return sub( 1., smoothstep( .25, .7, max( fwidth( q.x ), fwidth( q.y ) ) ) );

    }, { q: 'vec2', return: 'float' } );

    const kxFade =  Fn( ( [ q ] ) => {

    	return sub( 1., smoothstep( .9, 2.6, fwidth( q ) ) );

    }, { q: 'float', return: 'float' } );

    const kxUV =  Fn( ( [ p, n, ax ] ) => {

    	const done_ = bool( false ).toVar();
    	const ret_ = vec2( 0 ).toVar();
    	const a = abs( n ).toVar();

    	If( a.y.greaterThan( a.x ).and( a.y.greaterThan( a.z ) ), () => {

    		ax.assign( 1. );
    		ret_.assign( p.xz );
    		done_.assign( true );

    	} );

    	If( done_.not(), () => {

    		If( a.x.greaterThan( a.z ), () => {

    			ax.assign( 0. );
    			ret_.assign( vec2( p.z, p.y ) );
    			done_.assign( true );

    		} );

    		If( done_.not(), () => {

    			ax.assign( 2. );
    			ret_.assign( p.xy );
    			done_.assign( true );

    		} );

    	} );

    	return ret_;

    } );

    const n3 =  Fn( ( [ p ] ) => {

    	const z = floor( p.z ).toVar();
    	const o = vec2( 17.31, 31.73 ).toVar();

    	return mix( n2( p.xy.add( z.mul( o ) ) ), n2( p.xy.add( z.add( 1. ).mul( o ) ) ), smoothstep( 0., 1., fract( p.z ) ) );

    }, { p: 'vec3', return: 'float' } );

    const fbm3 =  Fn( ( [ p ] ) => {

    	return mul( .5, n3( p ) ).add( mul( .3, n3( p.mul( 2.07 ).add( 5.1 ) ) ) ).add( mul( .2, n3( p.mul( 4.3 ).add( 9.7 ) ) ) );

    }, { p: 'vec3', return: 'float' } );

    const kxMortar =  Fn( ( [ q, sz, j, id ] ) => {

    	const b = q.div( sz ).toVar();
    	b.x.addAssign( step( 1., mod( floor( b.y ), 2. ) ).mul( .5 ) );
    	id.assign( floor( b ) );
    	const f = fract( b ).toVar(), w = j.div( sz ).toVar(), fw = fwidth( b ).mul( .8 ).add( 1e-4 ).toVar();
    	const m = smoothstep( w.y, w.y.add( fw.y ), f.y ).mul( smoothstep( w.x, w.x.add( fw.x ), f.x ) ).toVar();

    	return mix( .85, m, sub( 1., smoothstep( .15, .45, fwidth( b.y ) ) ) );

    } );

    const kxStreak =  Fn( ( [ p, uv, k ] ) => {

    	return smoothstep( .5, .85, fbm( vec2( uv.x.mul( k ), p.y.mul( .3 ) ) ).add( mul( .25, n3( p.mul( .7 ) ) ) ).sub( .12 ) );

    }, { p: 'vec3', uv: 'vec2', k: 'float', return: 'float' } );

    const kxVilQ =  Fn( ( [ m, p, uv, ax, sd ] ) => {

    	const L = select( m.equal( 44 ), 1., select( m.equal( 46 ), 3., 0. ) ).toVar(), sc = select( m.equal( 43 ), 2.3, select( m.equal( 44 ), .75, select( m.equal( 45 ), 1.7, 1.6 ) ) ).toVar();
    	const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y.negate() ) ).toVar();

    	return vec3( q.div( sc ).add( fract( vec2( sd.mul( .131 ), sd.mul( .287 ) ) ) ), L );

    }, { m: 'int', p: 'vec3', uv: 'vec2', ax: 'float', sd: 'float', return: 'vec3' } );

    const kxVil =  Fn( ( [ alb, q, chroma ] ) => {

    	const t = texA_( uVilA, q ).rgb.toVar(), mu = texLA_( uVilA, q, 10. ).rgb.toVar(), r = t.mul( t ).div( max( mu.mul( mu ), vec3( .003 ) ) ).toVar();

    	return alb.mul( mix( vec3( dot( r, vec3( .3, .5, .2 ) ) ), r, chroma ) );

    } );

    const kxFloor =  Fn( ( [ q, dc ] ) => {

    	const fu = q.add( vec2( n2( q.mul( .31 ) ), n2( q.mul( .31 ).add( 7.3 ) ) ).sub( .5 ).mul( 6. ) ).sub( uFM.xy ).mul( uFM.z ).toVar(), e1 = vec2( mul( 2.5, uFM.z ), 0. ).toVar(), e2 = vec2( 0., mul( 2.5, uFM.z ) ).toVar();
    	const cv = mul( .25, step( 1., uFMap.sample( fu.add( e1 ) ).level( 0. ).r ).add( step( 1., uFMap.sample( fu.sub( e1 ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.add( e2 ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.sub( e2 ) ).level( 0. ).r ) ) ).toVar();
    	cv.assign( select( uFM.w.greaterThan( 0. ), smoothstep( .1, .9, cv ), .5 ) );
    	const fd = smoothstep( 10., 70., dc ).mul( .85 ).add( smoothstep( 90., 220., dc ).mul( .15 ) ).toVar(), bl = smoothstep( .35, .65, fbm( q.mul( .09 ).add( 4.1 ) ) ).toVar();
    	const lit = mix( mix( texA_( uVilA, vec3( q.div( 2.2 ), 6. ) ).rgb, texA_( uVilA, vec3( q.div( 6.9 ).add( .29 ), 6. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 6. ), 10. ).rgb, fd ).toVar();
    	const mos = mix( mix( texA_( uVilA, vec3( q.div( 2.6 ), 7. ) ).rgb, texA_( uVilA, vec3( q.div( 7.3 ).add( .41 ), 7. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 7. ), 10. ).rgb, fd ).toVar();
    	const grs = mix( mix( texA_( uVilA, vec3( q.div( 2.3 ), 5. ) ).rgb, texA_( uVilA, vec3( q.div( 8.1 ).add( .53 ), 5. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 5. ), 10. ).rgb, fd ).toVar();
    	lit.mulAssign( lit );
    	mos.mulAssign( mos );
    	grs.mulAssign( grs );
    	const lg = dot( grs, vec3( .3, .55, .15 ) ).div( .053 ).toVar(), lm = dot( mos, vec3( .3, .55, .15 ) ).div( .138 ).toVar();
    	grs.assign( vec3( .07, .105, .035 ).mul( lg ) );
    	mos.assign( vec3( .06, .07, .035 ).mul( lm ) );
    	lit.assign( mix( vec3( dot( lit, vec3( .3, .55, .15 ) ) ), lit, .75 ).mul( .36 ) );
    	const cw = mul( .25, step( 1., uFMap.sample( fu.add( e1.mul( 3.6 ) ) ).level( 0. ).r ).add( step( 1., uFMap.sample( fu.sub( e1.mul( 3.6 ) ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.add( e2.mul( 3.6 ) ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.sub( e2.mul( 3.6 ) ) ).level( 0. ).r ) ) ).toVar();
    	cw.assign( select( uFM.w.greaterThan( 0. ), max( cv, cw.mul( .7 ) ), .5 ) );
    	const under = mix( mos, lit, smoothstep( .2, .5, n2( q.mul( .21 ) ).mul( .6 ).add( n2( q.mul( .7 ).add( 1.3 ) ).mul( .4 ) ).add( cv.mul( .35 ) ) ) ).toVar();
    	const op = sub( 1., smoothstep( .15, .75, cw ) ).mul( sub( 1., mul( .45, smoothstep( .55, .7, fbm( q.mul( .05 ).add( 2.6 ) ) ) ) ) ).toVar();

    	return mix( under, grs, op );

    } );

    const kxCrag =  Fn( ( [ p, n ] ) => {

    	return clamp( smoothstep( .68, .56, n.y ).add( smoothstep( .76, .86, fbm( p.xz.mul( .045 ).add( 3.7 ) ) ).mul( .5 ) ), 0., 1. );

    }, { p: 'vec3', n: 'vec3', return: 'float' } );

    const kxRock =  Fn( ( [ p, n ] ) => {

    	return clamp( smoothstep( .9, .72, n.y ).add( smoothstep( .62, .78, fbm( p.xz.mul( .045 ).add( 3.7 ) ) ).mul( .7 ) ), 0., 1. );

    }, { p: 'vec3', n: 'vec3', return: 'float' } );

    const texNrm =  Fn( ( [ m, p, n, io ] ) => {

    	const ax = property( 'float' );
    	const uv = kxUV( p, n, ax ).toVar();
    	const Tg = select( ax.equal( 0. ), vec3( 0., 0., 1. ), vec3( 1., 0., 0. ) ).toVar(), Bg = select( ax.equal( 1. ), vec3( 0., 0., -1 ), vec3( 0., 1., 0. ) ).toVar();
    	const t = property( 'vec4' );
    	const k = select( m.equal( 44 ), .7, 1. ).toVar(), rough = property( 'float' );

    	If( m.equal( 42 ).or( m.equal( 50 ) ), () => {

    		const q = p.xz.toVar();
    		const dc = length( uCam.sub( p ) ).toVar();
    		const g = mix( texA_( uVilN, vec3( q.div( 2.6 ), 7. ) ), texA_( uVilN, vec3( q.div( 2.2 ), 6. ) ), smoothstep( .3, .6, n2( q.mul( .21 ) ).mul( .6 ).add( n2( q.mul( .7 ).add( 1.3 ) ).mul( .4 ) ) ) ).toVar();
    		t.assign( mix( g, texA_( uVilN, vec3( q.div( 4. ).add( .37 ), 4. ) ), kxCrag( p, n ) ) );
    		k.assign( max( clamp( io.y.div( .4 ), 0., 1. ), sub( 1., smoothstep( 220., 330., dc ) ) ).mul( 1.2 ).mul( sub( 1., smoothstep( 10., 150., dc ) ) ) );
    		Tg.assign( vec3( 1., 0., 0. ) );
    		Bg.assign( vec3( 0., 0., -1 ) );
    		rough.assign( -1 );

    	} ).Else( () => {

    		t.assign( texA_( uVilN, kxVilQ( m, p, uv, ax, io.x.add( select( m.equal( 44 ), floor( uv.x.div( .09 ) ).mul( .37 ), 0. ) ) ) ) );
    		rough.assign( select( m.equal( 45 ), mix( .35, .7, t.b ), select( m.equal( 44 ), mix( .5, .8, t.b ), mix( .65, 1., t.b ) ) ) );

    	} );

    	return vec4( Tg.mul( t.r.mul( 2. ).sub( 1. ) ).add( Bg.mul( t.g.mul( 2. ).sub( 1. ) ) ).mul( k ), rough );

    } );

    const texMat =  Fn( ( [ m, p, n, io ] ) => {

    	const alb = io[ 0 ].toVar();
    	const rough = io[ 1 ].x.toVar(), metal = io[ 1 ].y.toVar(), envK = io[ 1 ].z.toVar(), sd = io[ 2 ].x.toVar();
    	const emi = vec3( 0. ).toVar();
    	const ax = property( 'float' );
    	const uv = kxUV( p, n, ax ).toVar();
    	const vert = select( ax.equal( 1. ), 0., 1. ).toVar(), up = smoothstep( .6, .95, n.y ).toVar();

    	If( m.equal( 20 ), () => {

    		const aa = kxAA( uv.mul( 40. ) ).toVar();
    		alb.mulAssign( add( .74, mul( .4, fbm3( p.mul( 1.6 ) ) ) ).add( aa.mul( n2( uv.mul( 40. ) ).sub( .5 ) ).mul( .22 ) ) );
    		alb.mulAssign( sub( 1., mul( .4, aa ).mul( step( .93, n2( uv.mul( 61. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .32, vert ).mul( kxStreak( p, uv, 2.4 ) ) ) );
    		const fl = vert.mul( clamp( smoothstep( .012, 0., abs( fract( uv.x.div( 1.22 ) ).sub( .5 ) ).sub( .488 ) ).add( smoothstep( .01, 0., abs( fract( p.y.div( .61 ) ).sub( .5 ) ).sub( .49 ) ) ), 0., 1. ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .16, fl ).mul( kxAA( uv.mul( 3. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .82, .86, .8 ) ), up.mul( smoothstep( .45, .75, fbm3( p.mul( 3. ) ) ) ) ) );
    		rough.assign( .9 );

    	} ).ElseIf( m.equal( 21 ), () => {

    		const r = fbm3( p.mul( 2.6 ).add( 7. ) ).add( mul( .14, n3( p.mul( 23. ) ) ) ).add( vert.mul( .3 ).mul( smoothstep( .55, .9, fbm( vec2( uv.x.mul( 7. ), p.y.mul( .5 ) ) ) ) ) ).toVar();
    		const rust = smoothstep( .6, .74, r ).toVar(), halo = smoothstep( .5, .62, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, vec3( .11, .1, .09 ), mul( .35, fbm3( p.mul( 1.3 ).add( 2. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .75, .62, .5 ) ), halo.mul( .7 ) ) );
    		alb.assign( mix( alb, mix( vec3( .16, .055, .02 ), vec3( .3, .13, .04 ), n3( p.mul( 31. ) ) ), rust.mul( .9 ) ) );
    		const aa = kxAA( uv.mul( 30. ) ).toVar(), chip = step( .84, n3( p.mul( 34. ) ) ).mul( aa ).mul( sub( 1., rust ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .2, .19 ), chip.mul( .8 ) ) );
    		alb.mulAssign( add( .9, mul( .2, aa ).mul( n2( uv.mul( vec2( 90., 6. ) ) ) ) ) );
    		rough.assign( mix( .45, .9, max( rust, mul( .5, chip ) ) ) );
    		metal.assign( mix( .45, .05, rust ) );
    		envK.assign( mul( .28, sub( 1., rust ) ) );

    	} ).ElseIf( m.equal( 22 ), () => {

    		const sp = h21( floor( uv.mul( 16. ) ) ).toVar(), d = fbm3( p.mul( 1.3 ).add( 3. ) ).toVar();
    		alb.mulAssign( add( .84, mul( .3, sp ).mul( kxAA( uv.mul( 16. ) ) ) ).mul( add( .78, mul( .36, d ) ) ) );
    		alb.assign( mix( alb, vec3( .26, .25, .22 ), mul( .3, smoothstep( .55, .8, fbm3( p.mul( 4. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( kxStreak( p, uv, 4. ) ) ) );
    		rough.assign( add( .32, mul( .32, d ) ) );
    		metal.assign( .85 );
    		envK.assign( .55 );

    	} ).ElseIf( m.greaterThanEqual( 23 ).and( m.lessThanEqual( 25 ) ), () => {

    		const A = select( m.equal( 23 ), vec3( 1, 0, 0 ), select( m.equal( 24 ), vec3( 0, 1, 0 ), vec3( 0, 0, 1 ) ) ).toVar();
    		const along = dot( p, A ).toVar();
    		const t = cross( n, A ).toVar();
    		const tl = length( t ).toVar();
    		const cr = select( tl.greaterThan( .3 ), dot( p, t.div( tl ) ), length( p.sub( along.mul( A ) ) ).mul( 1.3 ) ).toVar();
    		const warp = fbm( vec2( along.mul( .35 ), cr.mul( 4. ) ) ).mul( 5. ).toVar();
    		const streak = fbm( vec2( along.mul( .7 ), cr.mul( 26. ).add( warp ) ) ).toVar();
    		const g = cr.mul( 160. ).add( warp.mul( 6. ) ).toVar();
    		const lines = smoothstep( .55, .95, abs( sin( g ) ) ).mul( kxFade( g ) ).toVar();
    		alb.mulAssign( add( .56, mul( .62, streak ) ) );
    		alb.mulAssign( sub( 1., mul( .24, lines ) ) );
    		alb.mulAssign( add( .82, mul( .3, n2( vec2( along.mul( .25 ), cr.mul( 2.5 ) ) ) ) ) );
    		const knot = smoothstep( .06, .0, length( vec2( fract( along.mul( .55 ) ).sub( .5 ), fract( cr.mul( 3.3 ) ).sub( .5 ).mul( .4 ) ) ) ).mul( step( .7, h21( floor( vec2( along.mul( .55 ), cr.mul( 3.3 ) ) ) ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .5, knot ) ) );
    		alb.assign( mix( alb, vec3( .24, .22, .2 ), up.mul( .35 ).mul( smoothstep( .4, .75, fbm3( p.mul( 2. ) ) ) ) ) );
    		rough.assign( .8 );

    	} ).ElseIf( m.equal( 26 ).or( m.equal( 27 ) ), () => {

    		const id = property( 'vec2' );
    		const q = select( m.equal( 26 ), kxMortar( vec2( uv.x, p.y ), vec2( .4, .2 ), .012, id ), kxMortar( vec2( uv.x, p.y ), vec2( .23, .076 ), .01, id ) ).toVar();

    		If( ax.equal( 1. ), () => {

    			q.assign( 1. );
    			id.assign( floor( uv.mul( 3. ) ) );

    		} );

    		const bv = h21( id.add( 3.7 ) ).toVar();
    		alb.mulAssign( mix( .58, 1., q ).mul( select( m.equal( 26 ), add( .86, mul( .2, bv ) ), add( .74, mul( .42, bv ) ) ) ).mul( add( .84, mul( .26, fbm3( p.mul( 3. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( kxStreak( p, uv, 3. ) ) ) );
    		rough.assign( .9 );

    	} ).ElseIf( m.equal( 28 ), () => {

    		const id = property( 'vec2' );
    		const q = kxMortar( select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ), vec2( .62, .31 ), .015, id ).toVar();
    		const bv = h21( id.add( 1.3 ) ).toVar();
    		alb.mulAssign( mix( .58, 1., q ).mul( add( .76, mul( .38, bv ) ) ).mul( add( .84, mul( .28, n2( uv.mul( 23. ) ) ).mul( kxAA( uv.mul( 23. ) ) ) ) ).mul( add( .88, mul( .22, fbm3( p.mul( 2. ) ) ) ) ) );
    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 29 ), () => {

    		alb.mulAssign( add( .82, mul( .3, fbm3( p.mul( 2.2 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .1, .1, .095 ), mul( .25, fbm3( p.mul( .9 ).add( 4. ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .35, vert ).mul( kxStreak( p, uv, 5. ) ) ) );
    		rough.assign( .55 );
    		metal.assign( .35 );
    		envK.assign( .35 );

    	} ).ElseIf( m.equal( 31 ), () => {

    		const q = uv.div( .006 ).toVar(), c = floor( q ).toVar(), f = fract( q ).toVar();
    		const d = mod( floor( c.x.add( c.y ).mul( .5 ) ), 2. ).toVar(), a = select( d.greaterThan( .5 ), f.y, f.x ).toVar(), aa = kxAA( q ).toVar();
    		alb.mulAssign( mix( 1.3, select( d.greaterThan( .5 ), 1.9, .8 ).mul( add( .55, mul( .45, sin( a.mul( 3.1416 ) ) ) ) ), aa ) );
    		rough.assign( .2 );
    		envK.assign( .45 );

    	} ).ElseIf( m.equal( 32 ), () => {

    		const t = fract( p.z.mul( 3.2 ).add( mul( .12, fbm3( p.mul( 9. ) ) ) ) ).toVar();
    		const a = vec3( .62, .5, .3 ).toVar(), b = vec3( .36, .2, .5 ).toVar(), c = vec3( .2, .34, .62 ).toVar();
    		alb.assign( select( t.lessThan( .5 ), mix( a, b, t.mul( 2. ) ), mix( b, c, t.mul( 2. ).sub( 1. ) ) ) );
    		rough.assign( .2 );
    		metal.assign( 1. );
    		envK.assign( .9 );

    	} ).ElseIf( m.equal( 33 ), () => {

    		const aa = kxAA( uv.mul( 220. ) ).toVar(), c = h21( floor( uv.mul( 220. ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .22, fbm3( p.mul( .35 ) ) ) ) );
    		alb.assign( mix( alb, select( c.greaterThan( .5 ), vec3( .75, .76, .78 ), vec3( .12, .13, .15 ) ), step( .9, abs( c.sub( .5 ) ).mul( 2. ) ).mul( aa ).mul( .5 ) ) );
    		const tire = smoothstep( .62, .82, fbm( vec2( uv.x.mul( 2.6 ), uv.y.mul( .12 ) ) ).add( mul( .3, fbm( vec2( uv.x.mul( 9. ), uv.y.mul( .4 ) ) ) ) ).sub( .15 ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .3, tire ).mul( up ) ) );
    		const oil = max( smoothstep( .78, .84, fbm3( vec3( uv.mul( .45 ), 3.1 ) ).add( mul( .06, n2( uv.mul( 7. ) ) ) ) ), mul( .8, smoothstep( .955, .985, n2( uv.mul( 2.3 ).add( 7. ) ) ) ) ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .62, .6, .58 ) ), oil.mul( up ) ) );
    		const jt = max( smoothstep( .006, 0., abs( fract( uv.x.div( 6. ).add( .5 ) ).sub( .5 ) ).mul( 6. ).sub( .004 ) ), smoothstep( .006, 0., abs( fract( uv.y.div( 6. ).add( .5 ) ).sub( .5 ) ).mul( 6. ).sub( .004 ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .55, jt ).mul( up ).mul( kxAA( uv.mul( 2. ) ) ) ) );
    		const scr = smoothstep( .985, 1., n2( vec2( uv.x.mul( 3. ).add( uv.y.mul( 40. ) ), uv.y.mul( 1.5 ) ) ) ).mul( kxAA( uv.mul( 40. ) ) ).toVar();
    		alb.assign( mix( alb, alb.mul( 1.35 ).add( .03 ), scr.mul( up ) ) );
    		rough.assign( mix( add( .26, mul( .2, tire ) ), .12, oil ) );
    		envK.assign( add( .03, mul( .04, oil ) ) );

    	} ).ElseIf( m.equal( 34 ), () => {

    		const aa = kxAA( uv.mul( 80. ) ).toVar();
    		alb.mulAssign( add( .94, mul( .1, aa ).mul( n2( uv.mul( 80. ) ) ) ).add( mul( .1, fbm3( p.mul( 1.8 ) ).sub( .5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .55 ), sub( 1., smoothstep( .0, .35, p.y ) ).mul( vert ).mul( .6 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .7, .68, .64 ) ), mul( .4, smoothstep( .62, .8, fbm3( p.mul( 5. ).add( 2. ) ) ) ).mul( vert ) ) );
    		const chip = step( .97, n3( p.mul( 40. ) ) ).mul( smoothstep( .55, .7, fbm3( p.mul( 2.3 ).add( 5. ) ) ) ).mul( kxAA( uv.mul( 40. ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .3, .3, .29 ), chip.mul( .8 ) ) );
    		rough.assign( mix( .34, .7, chip ).add( mul( .1, fbm3( p.mul( 3. ) ) ) ) );
    		metal.assign( .15 );
    		envK.assign( mul( .05, sub( 1., chip ) ) );

    	} ).ElseIf( m.equal( 35 ), () => {

    		const aa = kxAA( vec2( uv.x.mul( 4. ), uv.y.mul( 400. ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .14, fbm3( p.mul( 2. ) ) ) ).add( mul( .1, aa ).mul( n2( vec2( uv.x.mul( 4. ), uv.y.mul( 400. ) ) ).sub( .5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .72 ), mul( .35, smoothstep( .6, .85, fbm3( p.mul( 6. ).add( 1. ) ) ) ) ) );
    		rough.assign( add( .3, mul( .16, fbm3( p.mul( 4. ) ) ) ) );
    		metal.assign( .7 );
    		envK.assign( .06 );

    	} ).ElseIf( m.equal( 36 ), () => {

    		const q = uv.div( .0254 ).toVar(), f = fract( q ).sub( .5 ).toVar();
    		const aa = kxAA( q ).toVar();
    		const hole = sub( 1., smoothstep( .16, .23, length( f ) ) ).toVar();
    		alb.mulAssign( mix( .84, sub( 1., mul( .85, hole ) ), aa ).mul( add( .88, mul( .18, fbm3( p.mul( 2.5 ) ) ) ) ) );
    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 40 ), () => {

    		const q = uv.div( .625 ).toVar(), id = floor( q ).toVar(), f = fract( q ).toVar();
    		const hv = h21( id.add( 2.7 ) ).toVar(), ang = hv.mul( 6.2832 ).toVar(), aa = kxAA( uv.mul( 30. ) ).toVar();
    		const r = mat2( cos( ang ), sin( ang ).negate(), sin( ang ), cos( ang ) ).mul( uv.mul( 1.7 ) ).add( id.mul( 3.1 ) ).toVar();
    		const w = fbm( r.mul( .9 ).add( fbm( r.mul( 2.3 ) ).mul( 1.6 ) ) ).toVar();
    		const vein = smoothstep( .06, 0., abs( sin( r.x.add( w.mul( 2.4 ) ).mul( 2.6 ) ) ).sub( .02 ) ).mul( add( .5, mul( .5, fbm( r.mul( 4. ) ) ) ) ).toVar();
    		alb.mulAssign( add( .9, mul( .16, hv ) ).mul( add( .93, mul( .12, w ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .55, .53, .52 ) ), vein.mul( .55 ).mul( aa ) ) );
    		const g = min( min( f.x, sub( 1., f.x ) ), min( f.y, sub( 1., f.y ) ) ).toVar(), grout = sub( 1., smoothstep( .004, .009, g ) ).mul( kxAA( q ) ).toVar();
    		alb.assign( mix( alb, alb.mul( .55 ), grout ) );
    		rough.assign( mix( .14, .5, grout ).add( mul( .08, fbm3( p.mul( 3. ) ) ) ) );
    		envK.assign( .05 );

    	} ).ElseIf( m.equal( 41 ), () => {

    		alb.mulAssign( add( .92, mul( .1, fbm3( p.mul( .8 ) ) ) ).add( mul( .05, kxAA( uv.mul( 60. ) ) ).mul( n2( uv.mul( 60. ) ).sub( .5 ) ) ) );
    		alb.mulAssign( sub( 1., vert.mul( .22 ).mul( sub( 1., smoothstep( 0., .45, p.y ) ) ).mul( add( .6, mul( .4, fbm( vec2( uv.x.mul( 3. ), p.y.mul( 6. ) ) ) ) ) ) ) );
    		alb.mulAssign( sub( 1., vert.mul( .06 ).mul( smoothstep( .85, 1.1, p.y ) ).mul( smoothstep( 1.6, 1.3, p.y ) ).mul( fbm( vec2( uv.x.mul( 1.4 ), 1. ) ) ) ) );
    		rough.assign( .88 );

    	} ).ElseIf( m.greaterThanEqual( 37 ).and( m.lessThanEqual( 39 ) ), () => {

    		const sl = length( n.xz ).toVar();
    		const dS = select( sl.greaterThan( .05 ), n.xz.div( sl ), vec2( 0., 1. ) ).toVar();
    		const a = dot( p.xz, vec2( dS.y.negate(), dS.x ) ).toVar(), b = select( sl.greaterThan( .05 ), p.y.div( max( sl, .25 ) ), dot( p.xz, dS ) ).toVar();
    		const hue = alb.div( max( dot( alb, vec3( .3, .5, .2 ) ), .02 ) ).toVar();

    		If( m.lessThanEqual( 38 ).and( uFac.x.greaterThan( .5 ) ), () => {

    			const t = texA_( uFacA, vec3( vec2( a, b ).div( select( m.equal( 37 ), 2.9, 2. ) ), select( m.equal( 37 ), 5., 6. ) ) ).rgb.toVar();
    			alb.assign( t.mul( t ) );
    			alb.assign( mix( vec3( dot( alb, vec3( .3, .5, .2 ) ) ), alb, select( m.equal( 37 ), .7, 1. ) ).mul( mix( vec3( 1. ), hue, .2 ) ) );
    			rough.assign( select( m.equal( 37 ), .72, .55 ) );
    			envK.assign( select( m.equal( 37 ), 0., .1 ) );

    		} ).ElseIf( m.equal( 37 ), () => {

    			const q = vec2( a.div( .23 ), b.div( .34 ) ).toVar(), id = floor( q ).toVar(), f = fract( q ).toVar();
    			const aa = kxAA( q ).toVar();
    			const barrel = sin( f.x.mul( 3.1416 ) ).toVar(), lip = smoothstep( .78, 1., f.y ).toVar();
    			alb.mulAssign( mix( .86, add( .6, mul( .5, barrel ) ).mul( sub( 1., mul( .38, lip ) ) ), aa ).mul( add( .76, mul( .44, h21( id.add( 4.2 ) ) ) ) ) );
    			alb.assign( mix( alb, alb.mul( vec3( .66, .72, .55 ) ), mul( .55, smoothstep( .55, .85, fbm3( p.mul( 1.4 ) ) ) ) ) );
    			rough.assign( .72 );

    		} ).ElseIf( m.equal( 38 ), () => {

    			const id = property( 'vec2' );
    			const q = kxMortar( vec2( a, b ), vec2( .3, .16 ), .012, id ).toVar();
    			alb.mulAssign( mix( .5, 1., q ).mul( add( .78, mul( .38, h21( id.add( 2.1 ) ) ) ) ).mul( add( .86, mul( .2, fbm3( p.mul( 2. ) ) ) ) ) );
    			rough.assign( .55 );
    			envK.assign( .1 );

    		} ).Else( () => {

    			const d = abs( fract( a.div( .48 ) ).sub( .5 ) ).toVar(), aa = kxAA( vec2( a.div( .48 ), 1. ) ).toVar();
    			alb.mulAssign( mix( 1., add( 1., mul( .3, smoothstep( .45, .49, d ) ) ).mul( sub( 1., mul( .25, smoothstep( .4, .45, d ) ).mul( sub( 1., smoothstep( .45, .47, d ) ) ) ) ), aa ) );
    			alb.mulAssign( add( .82, mul( .28, fbm3( p.mul( 1.2 ) ) ) ).mul( sub( 1., mul( .25, smoothstep( .55, .85, fbm( vec2( a.mul( 3. ), b.mul( .4 ) ) ) ) ) ) ) );
    			alb.assign( mix( alb, vec3( .2, .09, .04 ), mul( .3, smoothstep( .62, .8, fbm3( p.mul( 2.3 ).add( 6. ) ) ) ) ) );
    			rough.assign( .45 );
    			metal.assign( .55 );
    			envK.assign( .3 );

    		} );

    		alb.mulAssign( add( .78, mul( .36, fbm3( p.mul( .21 ).add( 9. ) ) ) ) );
    		alb.assign( mix( alb, vec3( dot( alb, vec3( .3, .5, .2 ) ) ), add( .25, mul( .2, fbm3( p.mul( .37 ).add( 3. ) ) ) ) ) );

    	} ).ElseIf( m.equal( 42 ).or( m.equal( 50 ) ), () => {

    		alb.assign( mix( alb.mul( .55 ), vec3( .05, .06, .035 ), .35 ) );
    		const aa = kxAA( p.xz.mul( .22 ) ).toVar(), crown = n2( p.xz.mul( .22 ) ).mul( .6 ).add( n2( p.xz.mul( .57 ).add( 3.1 ) ).mul( .4 ) ).toVar();
    		const meadow = smoothstep( .58, .72, fbm( p.xz.mul( .006 ).add( 2. ) ) ).toVar(), steep = smoothstep( .8, .6, n.y ).toVar();
    		const forest = mix( alb.mul( .95 ), alb.mul( mix( .55, 1.35, smoothstep( .25, .8, crown ) ) ), aa ).toVar();
    		const grass = vec3( .075, .085, .035 ).mul( add( .8, mul( .4, fbm( p.xz.mul( .05 ) ) ) ) ).toVar(), rock = vec3( .11, .105, .095 ).mul( add( .7, mul( .5, fbm3( p.mul( .3 ) ) ) ) ).toVar();
    		alb.assign( mix( forest, grass, meadow.mul( sub( 1., steep ) ).mul( .85 ) ) );
    		alb.assign( mix( alb, rock, steep.mul( add( .6, mul( .4, fbm( p.xz.mul( .03 ) ) ) ) ) ) );
    		alb.mulAssign( add( .85, mul( .3, fbm( p.xz.mul( .0015 ).add( 5. ) ) ) ) );
    		rough.assign( .95 );
    		envK.assign( 0. );
    		const dc = length( uCam.sub( p ) ).toVar(), wf = max( clamp( io[ 2 ].y.div( .4 ), 0., 1. ), sub( 1., smoothstep( 220., 330., dc ) ) ).toVar();

    		If( uVil.x.greaterThan( .5 ).and( wf.greaterThan( 0. ) ), () => {

    			const q = p.xz.toVar();
    			const rk = kxCrag( p, n ).toVar(), fd = smoothstep( 10., 70., dc ).mul( .85 ).add( smoothstep( 90., 220., dc ).mul( .15 ) ).toVar();
    			const r = mix( texA_( uVilA, vec3( q.div( 4. ).add( .37 ), 4. ) ).rgb, texLA_( uVilA, vec3( q, 4. ), 10. ).rgb, fd.mul( .8 ) ).toVar();
    			r.mulAssign( r );
    			r.assign( mix( vec3( dot( r, vec3( .3, .55, .15 ) ) ), r, .35 ).mul( vec3( .95, .97, 1.05 ) ) );
    			const grd = mix( kxFloor( q, dc ), r, rk ).mul( add( .6, mul( .3, fbm( q.mul( .017 ).add( 1.3 ) ) ) ) ).toVar();
    			alb.assign( mix( alb, grd, clamp( wf.mul( add( .55, mul( .9, fbm( q.mul( .012 ).add( 8. ) ) ) ) ), 0., 1. ) ) );

    		} );

    	} ).ElseIf( m.equal( 51 ), () => {

    		const az = atan( p.z, p.x ).mul( 6. ).toVar(), vf = fbm( vec2( az.mul( .5 ), p.y.mul( .03 ) ) ).toVar();
    		const crack = smoothstep( .82, .97, abs( sin( az.mul( 1.3 ).add( vf.mul( 4. ) ) ) ) ).toVar();
    		const streak = smoothstep( .42, .72, fbm( vec2( az.mul( 1.9 ), p.y.mul( .012 ).add( vf ) ) ) ).toVar();
    		const strata = smoothstep( .93, 1., abs( sin( p.y.mul( .37 ).add( vf.mul( 5. ) ) ) ) ).mul( smoothstep( .3, .6, fbm( vec2( az.mul( .7 ), p.y.mul( .05 ) ) ) ) ).toVar();
    		alb.mulAssign( add( .5, mul( .35, fbm( vec2( az.mul( 3.1 ), p.y.mul( .21 ) ) ) ) ).mul( vec3( .92, .94, .97 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .22, .21, .2 ) ), clamp( streak.mul( .8 ).add( crack.mul( .5 ) ), 0., 1. ) ) );
    		alb.mulAssign( sub( 1., mul( .22, strata ) ) );
    		const moss = clamp( smoothstep( .4, .8, n.y ).add( smoothstep( .62, .78, fbm( vec2( az.mul( 4.3 ), p.y.mul( .27 ) ).add( 3. ) ) ).mul( .45 ) ), 0., 1. ).toVar();
    		alb.assign( mix( alb, vec3( .045, .06, .03 ), moss.mul( .85 ) ) );
    		rough.assign( .93 );

    	} ).ElseIf( m.equal( 43 ), () => {

    		const h = select( ax.equal( 1. ), uv.y, p.y ).toVar(), bd = floor( h.div( .15 ) ).toVar(), aa = kxAA( vec2( uv.x.mul( 8. ), h.div( .15 ) ) ).toVar();
    		const pv = select( uVil.x.greaterThan( .5 ), .5, 1. ).toVar();

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), .25 ).mul( add( .92, mul( .16, h21( vec2( bd, floor( uv.x.div( 2.4 ) ) ) ) ) ) ) );

    		} ).Else( () => {

    			alb.mulAssign( add( .8, mul( .2, h21( vec2( bd, floor( uv.x.div( 2.4 ) ) ) ) ) ).add( mul( .1, fbm3( p.mul( 1.3 ) ) ) ) );
    			alb.mulAssign( sub( 1., mul( .1, aa ).mul( smoothstep( .5, .9, fbm( vec2( uv.x.mul( 1.6 ), h.mul( 30. ).add( bd.mul( 7. ) ) ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .22, pv ).mul( vert ).mul( aa ).mul( smoothstep( .06, .0, abs( fract( h.div( .15 ) ).sub( .5 ) ).sub( .44 ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .5, vert ).mul( kxAA( uv.mul( 3. ) ) ).mul( smoothstep( .03, .015, length( vec2( fract( uv.x.div( .6 ) ).sub( .5 ), fract( h.div( .6 ) ).sub( .5 ) ).mul( .6 ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .2, vert ).mul( kxStreak( p, uv, 2. ) ) ) );
    		rough.assign( .82 );

    	} ).ElseIf( m.equal( 44 ), () => {

    		const a = select( ax.equal( 1. ), uv.x, uv.x ).toVar(), sl = a.div( .09 ).toVar(), id = floor( sl ).toVar(), aa = kxAA( vec2( sl, p.y.mul( 4. ) ) ).toVar();
    		alb.mulAssign( add( .7, mul( .45, h21( vec2( id, 3.1 ) ) ) ) );

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd.add( id.mul( .37 ) ) ), .35 ) );

    		} ).Else( () => {

    			alb.mulAssign( add( .78, mul( .3, fbm( vec2( fract( sl ).mul( 3. ).add( id.mul( 7. ) ), p.y.mul( 1.5 ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .85, vert ).mul( aa ).mul( smoothstep( .12, .05, abs( fract( sl ).sub( .5 ) ).sub( .38 ) ) ) ) );
    		rough.assign( .62 );
    		envK.assign( .04 );

    	} ).ElseIf( m.equal( 45 ), () => {

    		const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ).toVar(), id = floor( q.div( vec2( 1.2, .6 ) ) ).toVar(), f = fract( q.div( vec2( 1.2, .6 ) ) ).toVar();
    		const aa = kxAA( q.mul( 12. ) ).toVar(), vein = fbm( vec2( q.x.mul( .4 ).add( id.y.mul( 3. ) ), q.y.mul( 9. ).add( fbm( q.mul( 1.5 ) ).mul( 2. ) ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .2, h21( id.add( 2.3 ) ) ) ) );
    		alb.mulAssign( add( .82, mul( .3, smoothstep( .3, .7, vein ) ) ) );

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), 0. ) );

    		} ).Else( () => {

    			alb.mulAssign( sub( 1., mul( .35, aa ).mul( step( .86, n2( q.mul( vec2( 30., 60. ) ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .3, kxAA( q.mul( 3. ) ) ).mul( sub( 1., smoothstep( .0, 0.013333333333333334, min( min( f.x, sub( 1., f.x ) ).mul( 2. ), min( f.y, sub( 1., f.y ) ) ) ) ) ) ) );
    		rough.assign( .5 );
    		envK.assign( .08 );

    	} ).ElseIf( m.equal( 46 ), () => {

    		const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ).toVar();
    		const row = floor( q.y.div( .075 ) ).toVar(), th = float( .075 ).toVar(), sh = h21( vec2( row, 1.7 ) ).mul( 3. ).toVar();
    		const len = add( .2, mul( .4, h21( vec2( row, 4.1 ) ) ) ).toVar(), x = q.x.div( len ).add( sh ).toVar(), id = floor( x ).toVar();
    		const fy = fract( q.y.div( th ) ).toVar(), fx = fract( x ).toVar(), aa = kxAA( vec2( x, q.y.div( th ) ) ).toVar();
    		const gap = sub( 1., smoothstep( .0, .14, fy ) ).add( sub( 1., smoothstep( .0, div( .05, len ).mul( .2 ), min( fx, sub( 1., fx ) ) ) ) ).toVar();
    		const tone = h21( vec2( id, row ) ).toVar();

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), .5 ) );

    		} ).Else( () => {

    			alb.mulAssign( mix( vec3( .8 ), mix( vec3( 1.05, .95, .82 ), vec3( .85, .88, .92 ), step( .5, h21( vec2( row, id.add( 9. ) ) ) ) ), .6 ).mul( add( .6, mul( .6, tone ) ) ) );
    			alb.mulAssign( sub( 1., mul( .75, aa ).mul( clamp( gap, 0., 1. ) ) ) );

    		} );

    		rough.assign( .88 );

    	} ).ElseIf( m.equal( 47 ), () => {

    		const t = uTime.mul( .35 ).toVar();
    		const c1 = n2( uv.mul( 1.7 ).add( vec2( t, t.mul( .7 ) ) ) ).toVar(), c2 = n2( uv.mul( 2.9 ).sub( vec2( t.mul( .8 ), t.mul( .4 ) ) ) ).toVar();
    		const caus = pow( sub( 1., abs( c1.add( c2 ).sub( 1. ) ) ), 6. ).mul( kxAA( uv.mul( 3. ) ) ).toVar();
    		alb.assign( alb.mul( add( .75, mul( .5, caus ) ) ) );
    		rough.assign( .05 );
    		envK.assign( .55 );
    		emi.assign( alb.mul( add( .35, mul( .9, caus ) ) ).mul( uLampOn ).mul( 1.3 ) );

    	} ).ElseIf( m.equal( 48 ), () => {

    		const fl = floor( p.y.div( 3.3 ) ).toVar(), fy = fract( p.y.div( 3.3 ) ).toVar(), rm = floor( uv.x.div( 3.2 ) ).toVar();
    		const id = vec2( rm.add( sd.mul( 17. ) ), fl.add( float( ax ).mul( 5. ) ) ).toVar();
    		const on = step( .3, h21( id ) ).toVar(), tk = h21( id.add( 4.7 ) ).toVar();
    		const tint = mix( vec3( 1., .66, .38 ), vec3( 1., .84, .62 ), tk ).toVar();
    		const lit = add( .18, mul( .75, smoothstep( .62, .97, fy ) ) ).add( mul( .3, n2( vec2( uv.x.mul( .8 ), fl ) ) ).mul( add( .5, mul( .5, tk ) ) ) ).toVar();
    		const furn = mix( 1., .25, step( fy, .3 ).mul( step( .45, n2( vec2( uv.x.mul( 1.3 ).add( sd ), fl.mul( 3. ) ) ) ) ) ).toVar();
    		const curt = step( .75, h21( id.add( 1.9 ) ) ).toVar();
    		lit.assign( mix( lit.mul( furn ), .75, curt ) );
    		alb.assign( vec3( .022, .026, .03 ) );
    		rough.assign( .05 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		emi.assign( tint.mul( on ).mul( lit ).mul( uLampOn ).mul( add( .2, mul( .18, h21( id.add( 8.3 ) ) ) ) ) );

    	} ).ElseIf( m.equal( 49 ), () => {

    		const g = fract( p.xz.div( 1.6 ) ).sub( .5 ).toVar();
    		const d = length( g ).mul( 1.6 ).toVar(), dn = step( n.y, -0.5 ).toVar();
    		const dotL = smoothstep( .075, .055, d ).mul( dn ).toVar(), halo = exp( d.negate().mul( d ).mul( 3. ) ).mul( dn ).toVar();
    		alb.mulAssign( add( .9, mul( .1, fbm3( p.mul( 2. ) ) ) ).sub( mul( .25, dotL ) ) );
    		rough.assign( .9 );
    		emi.assign( vec3( 1., .78, .52 ).mul( dotL.mul( 2.6 ).add( halo.mul( .22 ) ) ).mul( uLampOn ) );

    	} ).Else( () => {

    		alb.assign( mix( alb, vec3( .075, .072, .068 ), mul( .3, fbm3( p.mul( 4. ) ) ).add( mul( .25, up ) ) ) );
    		alb.mulAssign( add( .88, mul( .2, n2( uv.mul( 60. ) ) ).mul( kxAA( uv.mul( 60. ) ) ) ) );
    		rough.assign( .78 );

    	} );

    	return mat3( alb, vec3( rough, metal, envK ), emi );

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	If( uFocus.w.greaterThan( 0. ), () => {

    		const ab = uFocus.xyz.sub( uCam ).toVar();
    		const tt = clamp( dot( vW.sub( uCam ), ab ).div( dot( ab, ab ) ), 0., 1. ).toVar();
    		const dd = length( vW.sub( uCam ).sub( ab.mul( tt ) ) ).toVar(), cd = length( vW.sub( uCam ) ).toVar();
    		const fade = max( sub( 1., smoothstep( .5, 1.6, cd ) ), sub( 1., smoothstep( .45, 1., dd ) ).mul( step( tt, .8 ) ).mul( .8 ) ).toVar();

    		If( fract( mul( 52.9829189, fract( dot( fragCoord_.xy, vec2( .06711056, .00583715 ) ) ) ) ).lessThan( fade ), () => {

    			Discard();

    		} );

    	} );

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const m = int( vMat.add( .5 ) ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();

    	If( m.greaterThanEqual( 20 ), () => {

    		const tio = vec3( vIns.z, vMat.sub( float( m ) ), 0. ).toVar();
    		const tm = texMat( m, vP, normalize( vNo ), mat3( alb, vec3( rough, metal, envK ), tio ) ).toVar();
    		alb.assign( tm[ 0 ] );
    		rough.assign( tm[ 1 ].x );
    		metal.assign( tm[ 1 ].y );
    		envK.assign( tm[ 1 ].z );
    		emi.assign( tm[ 2 ] );

    		If( uVil.y.greaterThan( .5 ).and( m.greaterThanEqual( 43 ).and( m.lessThanEqual( 46 ) ).or( m.equal( 42 ) ).or( m.equal( 50 ) ) ), () => {

    			const tn = texNrm( m, vP, normalize( vNo ), tio ).toVar();
    			const ca = cos( vIns.w ).toVar(), sa = sin( vIns.w ).toVar();
    			n.assign( normalize( n.add( vec3( ca.mul( tn.x ).add( sa.mul( tn.z ) ), tn.y, ca.mul( tn.z ).sub( sa.mul( tn.x ) ) ) ) ) );

    			If( tn.w.greaterThanEqual( 0. ), () => {

    				rough.assign( tn.w );

    			} );

    		} );

    	} ).ElseIf( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    	} ).ElseIf( m.equal( 1 ), () => {

    		alb.mulAssign( .12 );
    		rough.assign( .04 );
    		envK.assign( 1.1 );

    	} ).ElseIf( m.equal( 2 ), () => {

    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 3 ), () => {

    		rough.assign( .14 );
    		metal.assign( 1. );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 4 ), () => {

    		emi.assign( vCol.mul( add( .2, uM.x.mul( 1.7 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 5 ), () => {

    		const b = max( uM.y, vIns.x ).toVar();
    		emi.assign( vCol.mul( add( .7, b.mul( 2.6 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 6 ), () => {

    		rough.assign( .92 );
    		alb.mulAssign( .5 );

    	} ).ElseIf( m.equal( 7 ), () => {

    		rough.assign( .3 );
    		metal.assign( 1. );
    		envK.assign( .6 );

    	} ).ElseIf( m.equal( 8 ), () => {

    		emi.assign( vCol.mul( 2.4 ).mul( uM.z ).mul( add( .9, mul( .1, sin( uTime.mul( 2.3 ).add( vIns.y.mul( 9. ) ) ) ) ) ) );
    		alb.mulAssign( .1 );

    	} ).ElseIf( m.equal( 9 ), () => {

    		emi.assign( vCol.mul( step( .5, fract( uTime.mul( 1.3 ).add( vIns.y ) ) ) ).mul( 2.6 ) );

    	} ).ElseIf( m.equal( 10 ), () => {

    		rough.assign( .5 );

    	} ).ElseIf( m.equal( 11 ), () => {

    		emi.assign( vCol.mul( 1.1 ).mul( uM.z ) );
    		alb.mulAssign( .3 );

    	} ).ElseIf( m.greaterThanEqual( 12 ).and( m.lessThanEqual( 14 ) ), () => {

    		const on = select( abs( vIns.x.sub( float( m.sub( 12 ) ) ) ).lessThan( .5 ), 1., 0. ).toVar();
    		emi.assign( vCol.mul( add( .04, on.mul( 3.4 ) ) ) );
    		alb.mulAssign( .15 );

    	} ).ElseIf( m.equal( 15 ), () => {

    		rough.assign( .5 );
    		metal.assign( .8 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 16 ), () => {

    		emi.assign( vCol.mul( uLampOn ).mul( 1.6 ) );
    		alb.assign( vec3( .03 ) );
    		rough.assign( .08 );
    		envK.assign( 1. );

    	} );

    	alb.assign( mix( alb, vec3( .025, .022, .02 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	envK.mulAssign( sub( 1., uM.w ) );
    	emi.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).mul( sub( 1., step( 4., float( m ) ).mul( step( float( m ), 9. ) ) ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .35 ), wet ) );
    	alb.mulAssign( sub( 1., mul( .3, wet ) ) );
    	const c = shade( vW, n, v, alb, rough, metal ).toVar();

    	If( envK.greaterThan( 0. ).or( wet.greaterThan( .1 ) ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		c.addAssign( envMap( r ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{}": {
  h: "12fp40xue2", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uVilA","type":"sampler2DArray","src":"uVilA"},{"name":"uVilN","type":"sampler2DArray","src":"uVilN"},{"name":"uVil","type":"vec4","src":"uVil"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vP","type":"vec3","src":"vP"},{"name":"vNo","type":"vec3","src":"vNo"},{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vP.assign( pGeom_ );
    	vNo.assign( nGeom_ );
    	vIns.assign( vec4( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { fwidth, max, smoothstep, sub, Fn, bool, vec2, abs, If, floor, fract, mix, mul, mod, step, select, vec3, dot, clamp, property, length, vec4, add, cross, sin, cos, mat2, min, atan, float, div, pow, exp, mat3, Discard, normalize, int, reflect } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const kxAA =  Fn( ( [ q ] ) => {

    	return sub( 1., smoothstep( .25, .7, max( fwidth( q.x ), fwidth( q.y ) ) ) );

    }, { q: 'vec2', return: 'float' } );

    const kxFade =  Fn( ( [ q ] ) => {

    	return sub( 1., smoothstep( .9, 2.6, fwidth( q ) ) );

    }, { q: 'float', return: 'float' } );

    const kxUV =  Fn( ( [ p, n, ax ] ) => {

    	const done_ = bool( false ).toVar();
    	const ret_ = vec2( 0 ).toVar();
    	const a = abs( n ).toVar();

    	If( a.y.greaterThan( a.x ).and( a.y.greaterThan( a.z ) ), () => {

    		ax.assign( 1. );
    		ret_.assign( p.xz );
    		done_.assign( true );

    	} );

    	If( done_.not(), () => {

    		If( a.x.greaterThan( a.z ), () => {

    			ax.assign( 0. );
    			ret_.assign( vec2( p.z, p.y ) );
    			done_.assign( true );

    		} );

    		If( done_.not(), () => {

    			ax.assign( 2. );
    			ret_.assign( p.xy );
    			done_.assign( true );

    		} );

    	} );

    	return ret_;

    } );

    const n3 =  Fn( ( [ p ] ) => {

    	const z = floor( p.z ).toVar();
    	const o = vec2( 17.31, 31.73 ).toVar();

    	return mix( n2( p.xy.add( z.mul( o ) ) ), n2( p.xy.add( z.add( 1. ).mul( o ) ) ), smoothstep( 0., 1., fract( p.z ) ) );

    }, { p: 'vec3', return: 'float' } );

    const fbm3 =  Fn( ( [ p ] ) => {

    	return mul( .5, n3( p ) ).add( mul( .3, n3( p.mul( 2.07 ).add( 5.1 ) ) ) ).add( mul( .2, n3( p.mul( 4.3 ).add( 9.7 ) ) ) );

    }, { p: 'vec3', return: 'float' } );

    const kxMortar =  Fn( ( [ q, sz, j, id ] ) => {

    	const b = q.div( sz ).toVar();
    	b.x.addAssign( step( 1., mod( floor( b.y ), 2. ) ).mul( .5 ) );
    	id.assign( floor( b ) );
    	const f = fract( b ).toVar(), w = j.div( sz ).toVar(), fw = fwidth( b ).mul( .8 ).add( 1e-4 ).toVar();
    	const m = smoothstep( w.y, w.y.add( fw.y ), f.y ).mul( smoothstep( w.x, w.x.add( fw.x ), f.x ) ).toVar();

    	return mix( .85, m, sub( 1., smoothstep( .15, .45, fwidth( b.y ) ) ) );

    } );

    const kxStreak =  Fn( ( [ p, uv, k ] ) => {

    	return smoothstep( .5, .85, fbm( vec2( uv.x.mul( k ), p.y.mul( .3 ) ) ).add( mul( .25, n3( p.mul( .7 ) ) ) ).sub( .12 ) );

    }, { p: 'vec3', uv: 'vec2', k: 'float', return: 'float' } );

    const kxVilQ =  Fn( ( [ m, p, uv, ax, sd ] ) => {

    	const L = select( m.equal( 44 ), 1., select( m.equal( 46 ), 3., 0. ) ).toVar(), sc = select( m.equal( 43 ), 2.3, select( m.equal( 44 ), .75, select( m.equal( 45 ), 1.7, 1.6 ) ) ).toVar();
    	const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y.negate() ) ).toVar();

    	return vec3( q.div( sc ).add( fract( vec2( sd.mul( .131 ), sd.mul( .287 ) ) ) ), L );

    }, { m: 'int', p: 'vec3', uv: 'vec2', ax: 'float', sd: 'float', return: 'vec3' } );

    const kxVil =  Fn( ( [ alb, q, chroma ] ) => {

    	const t = texA_( uVilA, q ).rgb.toVar(), mu = texLA_( uVilA, q, 10. ).rgb.toVar(), r = t.mul( t ).div( max( mu.mul( mu ), vec3( .003 ) ) ).toVar();

    	return alb.mul( mix( vec3( dot( r, vec3( .3, .5, .2 ) ) ), r, chroma ) );

    } );

    const kxFloor =  Fn( ( [ q, dc ] ) => {

    	const fu = q.add( vec2( n2( q.mul( .31 ) ), n2( q.mul( .31 ).add( 7.3 ) ) ).sub( .5 ).mul( 6. ) ).sub( uFM.xy ).mul( uFM.z ).toVar(), e1 = vec2( mul( 2.5, uFM.z ), 0. ).toVar(), e2 = vec2( 0., mul( 2.5, uFM.z ) ).toVar();
    	const cv = mul( .25, step( 1., uFMap.sample( fu.add( e1 ) ).level( 0. ).r ).add( step( 1., uFMap.sample( fu.sub( e1 ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.add( e2 ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.sub( e2 ) ).level( 0. ).r ) ) ).toVar();
    	cv.assign( select( uFM.w.greaterThan( 0. ), smoothstep( .1, .9, cv ), .5 ) );
    	const fd = smoothstep( 10., 70., dc ).mul( .85 ).add( smoothstep( 90., 220., dc ).mul( .15 ) ).toVar(), bl = smoothstep( .35, .65, fbm( q.mul( .09 ).add( 4.1 ) ) ).toVar();
    	const lit = mix( mix( texA_( uVilA, vec3( q.div( 2.2 ), 6. ) ).rgb, texA_( uVilA, vec3( q.div( 6.9 ).add( .29 ), 6. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 6. ), 10. ).rgb, fd ).toVar();
    	const mos = mix( mix( texA_( uVilA, vec3( q.div( 2.6 ), 7. ) ).rgb, texA_( uVilA, vec3( q.div( 7.3 ).add( .41 ), 7. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 7. ), 10. ).rgb, fd ).toVar();
    	const grs = mix( mix( texA_( uVilA, vec3( q.div( 2.3 ), 5. ) ).rgb, texA_( uVilA, vec3( q.div( 8.1 ).add( .53 ), 5. ) ).rgb, bl ), texLA_( uVilA, vec3( q, 5. ), 10. ).rgb, fd ).toVar();
    	lit.mulAssign( lit );
    	mos.mulAssign( mos );
    	grs.mulAssign( grs );
    	const lg = dot( grs, vec3( .3, .55, .15 ) ).div( .053 ).toVar(), lm = dot( mos, vec3( .3, .55, .15 ) ).div( .138 ).toVar();
    	grs.assign( vec3( .07, .105, .035 ).mul( lg ) );
    	mos.assign( vec3( .06, .07, .035 ).mul( lm ) );
    	lit.assign( mix( vec3( dot( lit, vec3( .3, .55, .15 ) ) ), lit, .75 ).mul( .36 ) );
    	const cw = mul( .25, step( 1., uFMap.sample( fu.add( e1.mul( 3.6 ) ) ).level( 0. ).r ).add( step( 1., uFMap.sample( fu.sub( e1.mul( 3.6 ) ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.add( e2.mul( 3.6 ) ) ).level( 0. ).r ) ).add( step( 1., uFMap.sample( fu.sub( e2.mul( 3.6 ) ) ).level( 0. ).r ) ) ).toVar();
    	cw.assign( select( uFM.w.greaterThan( 0. ), max( cv, cw.mul( .7 ) ), .5 ) );
    	const under = mix( mos, lit, smoothstep( .2, .5, n2( q.mul( .21 ) ).mul( .6 ).add( n2( q.mul( .7 ).add( 1.3 ) ).mul( .4 ) ).add( cv.mul( .35 ) ) ) ).toVar();
    	const op = sub( 1., smoothstep( .15, .75, cw ) ).mul( sub( 1., mul( .45, smoothstep( .55, .7, fbm( q.mul( .05 ).add( 2.6 ) ) ) ) ) ).toVar();

    	return mix( under, grs, op );

    } );

    const kxCrag =  Fn( ( [ p, n ] ) => {

    	return clamp( smoothstep( .68, .56, n.y ).add( smoothstep( .76, .86, fbm( p.xz.mul( .045 ).add( 3.7 ) ) ).mul( .5 ) ), 0., 1. );

    }, { p: 'vec3', n: 'vec3', return: 'float' } );

    const kxRock =  Fn( ( [ p, n ] ) => {

    	return clamp( smoothstep( .9, .72, n.y ).add( smoothstep( .62, .78, fbm( p.xz.mul( .045 ).add( 3.7 ) ) ).mul( .7 ) ), 0., 1. );

    }, { p: 'vec3', n: 'vec3', return: 'float' } );

    const texNrm =  Fn( ( [ m, p, n, io ] ) => {

    	const ax = property( 'float' );
    	const uv = kxUV( p, n, ax ).toVar();
    	const Tg = select( ax.equal( 0. ), vec3( 0., 0., 1. ), vec3( 1., 0., 0. ) ).toVar(), Bg = select( ax.equal( 1. ), vec3( 0., 0., -1 ), vec3( 0., 1., 0. ) ).toVar();
    	const t = property( 'vec4' );
    	const k = select( m.equal( 44 ), .7, 1. ).toVar(), rough = property( 'float' );

    	If( m.equal( 42 ).or( m.equal( 50 ) ), () => {

    		const q = p.xz.toVar();
    		const dc = length( uCam.sub( p ) ).toVar();
    		const g = mix( texA_( uVilN, vec3( q.div( 2.6 ), 7. ) ), texA_( uVilN, vec3( q.div( 2.2 ), 6. ) ), smoothstep( .3, .6, n2( q.mul( .21 ) ).mul( .6 ).add( n2( q.mul( .7 ).add( 1.3 ) ).mul( .4 ) ) ) ).toVar();
    		t.assign( mix( g, texA_( uVilN, vec3( q.div( 4. ).add( .37 ), 4. ) ), kxCrag( p, n ) ) );
    		k.assign( max( clamp( io.y.div( .4 ), 0., 1. ), sub( 1., smoothstep( 220., 330., dc ) ) ).mul( 1.2 ).mul( sub( 1., smoothstep( 10., 150., dc ) ) ) );
    		Tg.assign( vec3( 1., 0., 0. ) );
    		Bg.assign( vec3( 0., 0., -1 ) );
    		rough.assign( -1 );

    	} ).Else( () => {

    		t.assign( texA_( uVilN, kxVilQ( m, p, uv, ax, io.x.add( select( m.equal( 44 ), floor( uv.x.div( .09 ) ).mul( .37 ), 0. ) ) ) ) );
    		rough.assign( select( m.equal( 45 ), mix( .35, .7, t.b ), select( m.equal( 44 ), mix( .5, .8, t.b ), mix( .65, 1., t.b ) ) ) );

    	} );

    	return vec4( Tg.mul( t.r.mul( 2. ).sub( 1. ) ).add( Bg.mul( t.g.mul( 2. ).sub( 1. ) ) ).mul( k ), rough );

    } );

    const texMat =  Fn( ( [ m, p, n, io ] ) => {

    	const alb = io[ 0 ].toVar();
    	const rough = io[ 1 ].x.toVar(), metal = io[ 1 ].y.toVar(), envK = io[ 1 ].z.toVar(), sd = io[ 2 ].x.toVar();
    	const emi = vec3( 0. ).toVar();
    	const ax = property( 'float' );
    	const uv = kxUV( p, n, ax ).toVar();
    	const vert = select( ax.equal( 1. ), 0., 1. ).toVar(), up = smoothstep( .6, .95, n.y ).toVar();

    	If( m.equal( 20 ), () => {

    		const aa = kxAA( uv.mul( 40. ) ).toVar();
    		alb.mulAssign( add( .74, mul( .4, fbm3( p.mul( 1.6 ) ) ) ).add( aa.mul( n2( uv.mul( 40. ) ).sub( .5 ) ).mul( .22 ) ) );
    		alb.mulAssign( sub( 1., mul( .4, aa ).mul( step( .93, n2( uv.mul( 61. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .32, vert ).mul( kxStreak( p, uv, 2.4 ) ) ) );
    		const fl = vert.mul( clamp( smoothstep( .012, 0., abs( fract( uv.x.div( 1.22 ) ).sub( .5 ) ).sub( .488 ) ).add( smoothstep( .01, 0., abs( fract( p.y.div( .61 ) ).sub( .5 ) ).sub( .49 ) ) ), 0., 1. ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .16, fl ).mul( kxAA( uv.mul( 3. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .82, .86, .8 ) ), up.mul( smoothstep( .45, .75, fbm3( p.mul( 3. ) ) ) ) ) );
    		rough.assign( .9 );

    	} ).ElseIf( m.equal( 21 ), () => {

    		const r = fbm3( p.mul( 2.6 ).add( 7. ) ).add( mul( .14, n3( p.mul( 23. ) ) ) ).add( vert.mul( .3 ).mul( smoothstep( .55, .9, fbm( vec2( uv.x.mul( 7. ), p.y.mul( .5 ) ) ) ) ) ).toVar();
    		const rust = smoothstep( .6, .74, r ).toVar(), halo = smoothstep( .5, .62, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, vec3( .11, .1, .09 ), mul( .35, fbm3( p.mul( 1.3 ).add( 2. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .75, .62, .5 ) ), halo.mul( .7 ) ) );
    		alb.assign( mix( alb, mix( vec3( .16, .055, .02 ), vec3( .3, .13, .04 ), n3( p.mul( 31. ) ) ), rust.mul( .9 ) ) );
    		const aa = kxAA( uv.mul( 30. ) ).toVar(), chip = step( .84, n3( p.mul( 34. ) ) ).mul( aa ).mul( sub( 1., rust ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .2, .19 ), chip.mul( .8 ) ) );
    		alb.mulAssign( add( .9, mul( .2, aa ).mul( n2( uv.mul( vec2( 90., 6. ) ) ) ) ) );
    		rough.assign( mix( .45, .9, max( rust, mul( .5, chip ) ) ) );
    		metal.assign( mix( .45, .05, rust ) );
    		envK.assign( mul( .28, sub( 1., rust ) ) );

    	} ).ElseIf( m.equal( 22 ), () => {

    		const sp = h21( floor( uv.mul( 16. ) ) ).toVar(), d = fbm3( p.mul( 1.3 ).add( 3. ) ).toVar();
    		alb.mulAssign( add( .84, mul( .3, sp ).mul( kxAA( uv.mul( 16. ) ) ) ).mul( add( .78, mul( .36, d ) ) ) );
    		alb.assign( mix( alb, vec3( .26, .25, .22 ), mul( .3, smoothstep( .55, .8, fbm3( p.mul( 4. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( kxStreak( p, uv, 4. ) ) ) );
    		rough.assign( add( .32, mul( .32, d ) ) );
    		metal.assign( .85 );
    		envK.assign( .55 );

    	} ).ElseIf( m.greaterThanEqual( 23 ).and( m.lessThanEqual( 25 ) ), () => {

    		const A = select( m.equal( 23 ), vec3( 1, 0, 0 ), select( m.equal( 24 ), vec3( 0, 1, 0 ), vec3( 0, 0, 1 ) ) ).toVar();
    		const along = dot( p, A ).toVar();
    		const t = cross( n, A ).toVar();
    		const tl = length( t ).toVar();
    		const cr = select( tl.greaterThan( .3 ), dot( p, t.div( tl ) ), length( p.sub( along.mul( A ) ) ).mul( 1.3 ) ).toVar();
    		const warp = fbm( vec2( along.mul( .35 ), cr.mul( 4. ) ) ).mul( 5. ).toVar();
    		const streak = fbm( vec2( along.mul( .7 ), cr.mul( 26. ).add( warp ) ) ).toVar();
    		const g = cr.mul( 160. ).add( warp.mul( 6. ) ).toVar();
    		const lines = smoothstep( .55, .95, abs( sin( g ) ) ).mul( kxFade( g ) ).toVar();
    		alb.mulAssign( add( .56, mul( .62, streak ) ) );
    		alb.mulAssign( sub( 1., mul( .24, lines ) ) );
    		alb.mulAssign( add( .82, mul( .3, n2( vec2( along.mul( .25 ), cr.mul( 2.5 ) ) ) ) ) );
    		const knot = smoothstep( .06, .0, length( vec2( fract( along.mul( .55 ) ).sub( .5 ), fract( cr.mul( 3.3 ) ).sub( .5 ).mul( .4 ) ) ) ).mul( step( .7, h21( floor( vec2( along.mul( .55 ), cr.mul( 3.3 ) ) ) ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .5, knot ) ) );
    		alb.assign( mix( alb, vec3( .24, .22, .2 ), up.mul( .35 ).mul( smoothstep( .4, .75, fbm3( p.mul( 2. ) ) ) ) ) );
    		rough.assign( .8 );

    	} ).ElseIf( m.equal( 26 ).or( m.equal( 27 ) ), () => {

    		const id = property( 'vec2' );
    		const q = select( m.equal( 26 ), kxMortar( vec2( uv.x, p.y ), vec2( .4, .2 ), .012, id ), kxMortar( vec2( uv.x, p.y ), vec2( .23, .076 ), .01, id ) ).toVar();

    		If( ax.equal( 1. ), () => {

    			q.assign( 1. );
    			id.assign( floor( uv.mul( 3. ) ) );

    		} );

    		const bv = h21( id.add( 3.7 ) ).toVar();
    		alb.mulAssign( mix( .58, 1., q ).mul( select( m.equal( 26 ), add( .86, mul( .2, bv ) ), add( .74, mul( .42, bv ) ) ) ).mul( add( .84, mul( .26, fbm3( p.mul( 3. ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( kxStreak( p, uv, 3. ) ) ) );
    		rough.assign( .9 );

    	} ).ElseIf( m.equal( 28 ), () => {

    		const id = property( 'vec2' );
    		const q = kxMortar( select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ), vec2( .62, .31 ), .015, id ).toVar();
    		const bv = h21( id.add( 1.3 ) ).toVar();
    		alb.mulAssign( mix( .58, 1., q ).mul( add( .76, mul( .38, bv ) ) ).mul( add( .84, mul( .28, n2( uv.mul( 23. ) ) ).mul( kxAA( uv.mul( 23. ) ) ) ) ).mul( add( .88, mul( .22, fbm3( p.mul( 2. ) ) ) ) ) );
    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 29 ), () => {

    		alb.mulAssign( add( .82, mul( .3, fbm3( p.mul( 2.2 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .1, .1, .095 ), mul( .25, fbm3( p.mul( .9 ).add( 4. ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .35, vert ).mul( kxStreak( p, uv, 5. ) ) ) );
    		rough.assign( .55 );
    		metal.assign( .35 );
    		envK.assign( .35 );

    	} ).ElseIf( m.equal( 31 ), () => {

    		const q = uv.div( .006 ).toVar(), c = floor( q ).toVar(), f = fract( q ).toVar();
    		const d = mod( floor( c.x.add( c.y ).mul( .5 ) ), 2. ).toVar(), a = select( d.greaterThan( .5 ), f.y, f.x ).toVar(), aa = kxAA( q ).toVar();
    		alb.mulAssign( mix( 1.3, select( d.greaterThan( .5 ), 1.9, .8 ).mul( add( .55, mul( .45, sin( a.mul( 3.1416 ) ) ) ) ), aa ) );
    		rough.assign( .2 );
    		envK.assign( .45 );

    	} ).ElseIf( m.equal( 32 ), () => {

    		const t = fract( p.z.mul( 3.2 ).add( mul( .12, fbm3( p.mul( 9. ) ) ) ) ).toVar();
    		const a = vec3( .62, .5, .3 ).toVar(), b = vec3( .36, .2, .5 ).toVar(), c = vec3( .2, .34, .62 ).toVar();
    		alb.assign( select( t.lessThan( .5 ), mix( a, b, t.mul( 2. ) ), mix( b, c, t.mul( 2. ).sub( 1. ) ) ) );
    		rough.assign( .2 );
    		metal.assign( 1. );
    		envK.assign( .9 );

    	} ).ElseIf( m.equal( 33 ), () => {

    		const aa = kxAA( uv.mul( 220. ) ).toVar(), c = h21( floor( uv.mul( 220. ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .22, fbm3( p.mul( .35 ) ) ) ) );
    		alb.assign( mix( alb, select( c.greaterThan( .5 ), vec3( .75, .76, .78 ), vec3( .12, .13, .15 ) ), step( .9, abs( c.sub( .5 ) ).mul( 2. ) ).mul( aa ).mul( .5 ) ) );
    		const tire = smoothstep( .62, .82, fbm( vec2( uv.x.mul( 2.6 ), uv.y.mul( .12 ) ) ).add( mul( .3, fbm( vec2( uv.x.mul( 9. ), uv.y.mul( .4 ) ) ) ) ).sub( .15 ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .3, tire ).mul( up ) ) );
    		const oil = max( smoothstep( .78, .84, fbm3( vec3( uv.mul( .45 ), 3.1 ) ).add( mul( .06, n2( uv.mul( 7. ) ) ) ) ), mul( .8, smoothstep( .955, .985, n2( uv.mul( 2.3 ).add( 7. ) ) ) ) ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .62, .6, .58 ) ), oil.mul( up ) ) );
    		const jt = max( smoothstep( .006, 0., abs( fract( uv.x.div( 6. ).add( .5 ) ).sub( .5 ) ).mul( 6. ).sub( .004 ) ), smoothstep( .006, 0., abs( fract( uv.y.div( 6. ).add( .5 ) ).sub( .5 ) ).mul( 6. ).sub( .004 ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .55, jt ).mul( up ).mul( kxAA( uv.mul( 2. ) ) ) ) );
    		const scr = smoothstep( .985, 1., n2( vec2( uv.x.mul( 3. ).add( uv.y.mul( 40. ) ), uv.y.mul( 1.5 ) ) ) ).mul( kxAA( uv.mul( 40. ) ) ).toVar();
    		alb.assign( mix( alb, alb.mul( 1.35 ).add( .03 ), scr.mul( up ) ) );
    		rough.assign( mix( add( .26, mul( .2, tire ) ), .12, oil ) );
    		envK.assign( add( .03, mul( .04, oil ) ) );

    	} ).ElseIf( m.equal( 34 ), () => {

    		const aa = kxAA( uv.mul( 80. ) ).toVar();
    		alb.mulAssign( add( .94, mul( .1, aa ).mul( n2( uv.mul( 80. ) ) ) ).add( mul( .1, fbm3( p.mul( 1.8 ) ).sub( .5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .55 ), sub( 1., smoothstep( .0, .35, p.y ) ).mul( vert ).mul( .6 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .7, .68, .64 ) ), mul( .4, smoothstep( .62, .8, fbm3( p.mul( 5. ).add( 2. ) ) ) ).mul( vert ) ) );
    		const chip = step( .97, n3( p.mul( 40. ) ) ).mul( smoothstep( .55, .7, fbm3( p.mul( 2.3 ).add( 5. ) ) ) ).mul( kxAA( uv.mul( 40. ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .3, .3, .29 ), chip.mul( .8 ) ) );
    		rough.assign( mix( .34, .7, chip ).add( mul( .1, fbm3( p.mul( 3. ) ) ) ) );
    		metal.assign( .15 );
    		envK.assign( mul( .05, sub( 1., chip ) ) );

    	} ).ElseIf( m.equal( 35 ), () => {

    		const aa = kxAA( vec2( uv.x.mul( 4. ), uv.y.mul( 400. ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .14, fbm3( p.mul( 2. ) ) ) ).add( mul( .1, aa ).mul( n2( vec2( uv.x.mul( 4. ), uv.y.mul( 400. ) ) ).sub( .5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .72 ), mul( .35, smoothstep( .6, .85, fbm3( p.mul( 6. ).add( 1. ) ) ) ) ) );
    		rough.assign( add( .3, mul( .16, fbm3( p.mul( 4. ) ) ) ) );
    		metal.assign( .7 );
    		envK.assign( .06 );

    	} ).ElseIf( m.equal( 36 ), () => {

    		const q = uv.div( .0254 ).toVar(), f = fract( q ).sub( .5 ).toVar();
    		const aa = kxAA( q ).toVar();
    		const hole = sub( 1., smoothstep( .16, .23, length( f ) ) ).toVar();
    		alb.mulAssign( mix( .84, sub( 1., mul( .85, hole ) ), aa ).mul( add( .88, mul( .18, fbm3( p.mul( 2.5 ) ) ) ) ) );
    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 40 ), () => {

    		const q = uv.div( .625 ).toVar(), id = floor( q ).toVar(), f = fract( q ).toVar();
    		const hv = h21( id.add( 2.7 ) ).toVar(), ang = hv.mul( 6.2832 ).toVar(), aa = kxAA( uv.mul( 30. ) ).toVar();
    		const r = mat2( cos( ang ), sin( ang ).negate(), sin( ang ), cos( ang ) ).mul( uv.mul( 1.7 ) ).add( id.mul( 3.1 ) ).toVar();
    		const w = fbm( r.mul( .9 ).add( fbm( r.mul( 2.3 ) ).mul( 1.6 ) ) ).toVar();
    		const vein = smoothstep( .06, 0., abs( sin( r.x.add( w.mul( 2.4 ) ).mul( 2.6 ) ) ).sub( .02 ) ).mul( add( .5, mul( .5, fbm( r.mul( 4. ) ) ) ) ).toVar();
    		alb.mulAssign( add( .9, mul( .16, hv ) ).mul( add( .93, mul( .12, w ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .55, .53, .52 ) ), vein.mul( .55 ).mul( aa ) ) );
    		const g = min( min( f.x, sub( 1., f.x ) ), min( f.y, sub( 1., f.y ) ) ).toVar(), grout = sub( 1., smoothstep( .004, .009, g ) ).mul( kxAA( q ) ).toVar();
    		alb.assign( mix( alb, alb.mul( .55 ), grout ) );
    		rough.assign( mix( .14, .5, grout ).add( mul( .08, fbm3( p.mul( 3. ) ) ) ) );
    		envK.assign( .05 );

    	} ).ElseIf( m.equal( 41 ), () => {

    		alb.mulAssign( add( .92, mul( .1, fbm3( p.mul( .8 ) ) ) ).add( mul( .05, kxAA( uv.mul( 60. ) ) ).mul( n2( uv.mul( 60. ) ).sub( .5 ) ) ) );
    		alb.mulAssign( sub( 1., vert.mul( .22 ).mul( sub( 1., smoothstep( 0., .45, p.y ) ) ).mul( add( .6, mul( .4, fbm( vec2( uv.x.mul( 3. ), p.y.mul( 6. ) ) ) ) ) ) ) );
    		alb.mulAssign( sub( 1., vert.mul( .06 ).mul( smoothstep( .85, 1.1, p.y ) ).mul( smoothstep( 1.6, 1.3, p.y ) ).mul( fbm( vec2( uv.x.mul( 1.4 ), 1. ) ) ) ) );
    		rough.assign( .88 );

    	} ).ElseIf( m.greaterThanEqual( 37 ).and( m.lessThanEqual( 39 ) ), () => {

    		const sl = length( n.xz ).toVar();
    		const dS = select( sl.greaterThan( .05 ), n.xz.div( sl ), vec2( 0., 1. ) ).toVar();
    		const a = dot( p.xz, vec2( dS.y.negate(), dS.x ) ).toVar(), b = select( sl.greaterThan( .05 ), p.y.div( max( sl, .25 ) ), dot( p.xz, dS ) ).toVar();
    		const hue = alb.div( max( dot( alb, vec3( .3, .5, .2 ) ), .02 ) ).toVar();

    		If( m.lessThanEqual( 38 ).and( uFac.x.greaterThan( .5 ) ), () => {

    			const t = texA_( uFacA, vec3( vec2( a, b ).div( select( m.equal( 37 ), 2.9, 2. ) ), select( m.equal( 37 ), 5., 6. ) ) ).rgb.toVar();
    			alb.assign( t.mul( t ) );
    			alb.assign( mix( vec3( dot( alb, vec3( .3, .5, .2 ) ) ), alb, select( m.equal( 37 ), .7, 1. ) ).mul( mix( vec3( 1. ), hue, .2 ) ) );
    			rough.assign( select( m.equal( 37 ), .72, .55 ) );
    			envK.assign( select( m.equal( 37 ), 0., .1 ) );

    		} ).ElseIf( m.equal( 37 ), () => {

    			const q = vec2( a.div( .23 ), b.div( .34 ) ).toVar(), id = floor( q ).toVar(), f = fract( q ).toVar();
    			const aa = kxAA( q ).toVar();
    			const barrel = sin( f.x.mul( 3.1416 ) ).toVar(), lip = smoothstep( .78, 1., f.y ).toVar();
    			alb.mulAssign( mix( .86, add( .6, mul( .5, barrel ) ).mul( sub( 1., mul( .38, lip ) ) ), aa ).mul( add( .76, mul( .44, h21( id.add( 4.2 ) ) ) ) ) );
    			alb.assign( mix( alb, alb.mul( vec3( .66, .72, .55 ) ), mul( .55, smoothstep( .55, .85, fbm3( p.mul( 1.4 ) ) ) ) ) );
    			rough.assign( .72 );

    		} ).ElseIf( m.equal( 38 ), () => {

    			const id = property( 'vec2' );
    			const q = kxMortar( vec2( a, b ), vec2( .3, .16 ), .012, id ).toVar();
    			alb.mulAssign( mix( .5, 1., q ).mul( add( .78, mul( .38, h21( id.add( 2.1 ) ) ) ) ).mul( add( .86, mul( .2, fbm3( p.mul( 2. ) ) ) ) ) );
    			rough.assign( .55 );
    			envK.assign( .1 );

    		} ).Else( () => {

    			const d = abs( fract( a.div( .48 ) ).sub( .5 ) ).toVar(), aa = kxAA( vec2( a.div( .48 ), 1. ) ).toVar();
    			alb.mulAssign( mix( 1., add( 1., mul( .3, smoothstep( .45, .49, d ) ) ).mul( sub( 1., mul( .25, smoothstep( .4, .45, d ) ).mul( sub( 1., smoothstep( .45, .47, d ) ) ) ) ), aa ) );
    			alb.mulAssign( add( .82, mul( .28, fbm3( p.mul( 1.2 ) ) ) ).mul( sub( 1., mul( .25, smoothstep( .55, .85, fbm( vec2( a.mul( 3. ), b.mul( .4 ) ) ) ) ) ) ) );
    			alb.assign( mix( alb, vec3( .2, .09, .04 ), mul( .3, smoothstep( .62, .8, fbm3( p.mul( 2.3 ).add( 6. ) ) ) ) ) );
    			rough.assign( .45 );
    			metal.assign( .55 );
    			envK.assign( .3 );

    		} );

    		alb.mulAssign( add( .78, mul( .36, fbm3( p.mul( .21 ).add( 9. ) ) ) ) );
    		alb.assign( mix( alb, vec3( dot( alb, vec3( .3, .5, .2 ) ) ), add( .25, mul( .2, fbm3( p.mul( .37 ).add( 3. ) ) ) ) ) );

    	} ).ElseIf( m.equal( 42 ).or( m.equal( 50 ) ), () => {

    		alb.assign( mix( alb.mul( .55 ), vec3( .05, .06, .035 ), .35 ) );
    		const aa = kxAA( p.xz.mul( .22 ) ).toVar(), crown = n2( p.xz.mul( .22 ) ).mul( .6 ).add( n2( p.xz.mul( .57 ).add( 3.1 ) ).mul( .4 ) ).toVar();
    		const meadow = smoothstep( .58, .72, fbm( p.xz.mul( .006 ).add( 2. ) ) ).toVar(), steep = smoothstep( .8, .6, n.y ).toVar();
    		const forest = mix( alb.mul( .95 ), alb.mul( mix( .55, 1.35, smoothstep( .25, .8, crown ) ) ), aa ).toVar();
    		const grass = vec3( .075, .085, .035 ).mul( add( .8, mul( .4, fbm( p.xz.mul( .05 ) ) ) ) ).toVar(), rock = vec3( .11, .105, .095 ).mul( add( .7, mul( .5, fbm3( p.mul( .3 ) ) ) ) ).toVar();
    		alb.assign( mix( forest, grass, meadow.mul( sub( 1., steep ) ).mul( .85 ) ) );
    		alb.assign( mix( alb, rock, steep.mul( add( .6, mul( .4, fbm( p.xz.mul( .03 ) ) ) ) ) ) );
    		alb.mulAssign( add( .85, mul( .3, fbm( p.xz.mul( .0015 ).add( 5. ) ) ) ) );
    		rough.assign( .95 );
    		envK.assign( 0. );
    		const dc = length( uCam.sub( p ) ).toVar(), wf = max( clamp( io[ 2 ].y.div( .4 ), 0., 1. ), sub( 1., smoothstep( 220., 330., dc ) ) ).toVar();

    		If( uVil.x.greaterThan( .5 ).and( wf.greaterThan( 0. ) ), () => {

    			const q = p.xz.toVar();
    			const rk = kxCrag( p, n ).toVar(), fd = smoothstep( 10., 70., dc ).mul( .85 ).add( smoothstep( 90., 220., dc ).mul( .15 ) ).toVar();
    			const r = mix( texA_( uVilA, vec3( q.div( 4. ).add( .37 ), 4. ) ).rgb, texLA_( uVilA, vec3( q, 4. ), 10. ).rgb, fd.mul( .8 ) ).toVar();
    			r.mulAssign( r );
    			r.assign( mix( vec3( dot( r, vec3( .3, .55, .15 ) ) ), r, .35 ).mul( vec3( .95, .97, 1.05 ) ) );
    			const grd = mix( kxFloor( q, dc ), r, rk ).mul( add( .6, mul( .3, fbm( q.mul( .017 ).add( 1.3 ) ) ) ) ).toVar();
    			alb.assign( mix( alb, grd, clamp( wf.mul( add( .55, mul( .9, fbm( q.mul( .012 ).add( 8. ) ) ) ) ), 0., 1. ) ) );

    		} );

    	} ).ElseIf( m.equal( 51 ), () => {

    		const az = atan( p.z, p.x ).mul( 6. ).toVar(), vf = fbm( vec2( az.mul( .5 ), p.y.mul( .03 ) ) ).toVar();
    		const crack = smoothstep( .82, .97, abs( sin( az.mul( 1.3 ).add( vf.mul( 4. ) ) ) ) ).toVar();
    		const streak = smoothstep( .42, .72, fbm( vec2( az.mul( 1.9 ), p.y.mul( .012 ).add( vf ) ) ) ).toVar();
    		const strata = smoothstep( .93, 1., abs( sin( p.y.mul( .37 ).add( vf.mul( 5. ) ) ) ) ).mul( smoothstep( .3, .6, fbm( vec2( az.mul( .7 ), p.y.mul( .05 ) ) ) ) ).toVar();
    		alb.mulAssign( add( .5, mul( .35, fbm( vec2( az.mul( 3.1 ), p.y.mul( .21 ) ) ) ) ).mul( vec3( .92, .94, .97 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .22, .21, .2 ) ), clamp( streak.mul( .8 ).add( crack.mul( .5 ) ), 0., 1. ) ) );
    		alb.mulAssign( sub( 1., mul( .22, strata ) ) );
    		const moss = clamp( smoothstep( .4, .8, n.y ).add( smoothstep( .62, .78, fbm( vec2( az.mul( 4.3 ), p.y.mul( .27 ) ).add( 3. ) ) ).mul( .45 ) ), 0., 1. ).toVar();
    		alb.assign( mix( alb, vec3( .045, .06, .03 ), moss.mul( .85 ) ) );
    		rough.assign( .93 );

    	} ).ElseIf( m.equal( 43 ), () => {

    		const h = select( ax.equal( 1. ), uv.y, p.y ).toVar(), bd = floor( h.div( .15 ) ).toVar(), aa = kxAA( vec2( uv.x.mul( 8. ), h.div( .15 ) ) ).toVar();
    		const pv = select( uVil.x.greaterThan( .5 ), .5, 1. ).toVar();

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), .25 ).mul( add( .92, mul( .16, h21( vec2( bd, floor( uv.x.div( 2.4 ) ) ) ) ) ) ) );

    		} ).Else( () => {

    			alb.mulAssign( add( .8, mul( .2, h21( vec2( bd, floor( uv.x.div( 2.4 ) ) ) ) ) ).add( mul( .1, fbm3( p.mul( 1.3 ) ) ) ) );
    			alb.mulAssign( sub( 1., mul( .1, aa ).mul( smoothstep( .5, .9, fbm( vec2( uv.x.mul( 1.6 ), h.mul( 30. ).add( bd.mul( 7. ) ) ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .22, pv ).mul( vert ).mul( aa ).mul( smoothstep( .06, .0, abs( fract( h.div( .15 ) ).sub( .5 ) ).sub( .44 ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .5, vert ).mul( kxAA( uv.mul( 3. ) ) ).mul( smoothstep( .03, .015, length( vec2( fract( uv.x.div( .6 ) ).sub( .5 ), fract( h.div( .6 ) ).sub( .5 ) ).mul( .6 ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .2, vert ).mul( kxStreak( p, uv, 2. ) ) ) );
    		rough.assign( .82 );

    	} ).ElseIf( m.equal( 44 ), () => {

    		const a = select( ax.equal( 1. ), uv.x, uv.x ).toVar(), sl = a.div( .09 ).toVar(), id = floor( sl ).toVar(), aa = kxAA( vec2( sl, p.y.mul( 4. ) ) ).toVar();
    		alb.mulAssign( add( .7, mul( .45, h21( vec2( id, 3.1 ) ) ) ) );

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd.add( id.mul( .37 ) ) ), .35 ) );

    		} ).Else( () => {

    			alb.mulAssign( add( .78, mul( .3, fbm( vec2( fract( sl ).mul( 3. ).add( id.mul( 7. ) ), p.y.mul( 1.5 ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .85, vert ).mul( aa ).mul( smoothstep( .12, .05, abs( fract( sl ).sub( .5 ) ).sub( .38 ) ) ) ) );
    		rough.assign( .62 );
    		envK.assign( .04 );

    	} ).ElseIf( m.equal( 45 ), () => {

    		const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ).toVar(), id = floor( q.div( vec2( 1.2, .6 ) ) ).toVar(), f = fract( q.div( vec2( 1.2, .6 ) ) ).toVar();
    		const aa = kxAA( q.mul( 12. ) ).toVar(), vein = fbm( vec2( q.x.mul( .4 ).add( id.y.mul( 3. ) ), q.y.mul( 9. ).add( fbm( q.mul( 1.5 ) ).mul( 2. ) ) ) ).toVar();
    		alb.mulAssign( add( .86, mul( .2, h21( id.add( 2.3 ) ) ) ) );
    		alb.mulAssign( add( .82, mul( .3, smoothstep( .3, .7, vein ) ) ) );

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), 0. ) );

    		} ).Else( () => {

    			alb.mulAssign( sub( 1., mul( .35, aa ).mul( step( .86, n2( q.mul( vec2( 30., 60. ) ) ) ) ) ) );

    		} );

    		alb.mulAssign( sub( 1., mul( .3, kxAA( q.mul( 3. ) ) ).mul( sub( 1., smoothstep( .0, 0.013333333333333334, min( min( f.x, sub( 1., f.x ) ).mul( 2. ), min( f.y, sub( 1., f.y ) ) ) ) ) ) ) );
    		rough.assign( .5 );
    		envK.assign( .08 );

    	} ).ElseIf( m.equal( 46 ), () => {

    		const q = select( ax.equal( 1. ), uv, vec2( uv.x, p.y ) ).toVar();
    		const row = floor( q.y.div( .075 ) ).toVar(), th = float( .075 ).toVar(), sh = h21( vec2( row, 1.7 ) ).mul( 3. ).toVar();
    		const len = add( .2, mul( .4, h21( vec2( row, 4.1 ) ) ) ).toVar(), x = q.x.div( len ).add( sh ).toVar(), id = floor( x ).toVar();
    		const fy = fract( q.y.div( th ) ).toVar(), fx = fract( x ).toVar(), aa = kxAA( vec2( x, q.y.div( th ) ) ).toVar();
    		const gap = sub( 1., smoothstep( .0, .14, fy ) ).add( sub( 1., smoothstep( .0, div( .05, len ).mul( .2 ), min( fx, sub( 1., fx ) ) ) ) ).toVar();
    		const tone = h21( vec2( id, row ) ).toVar();

    		If( uVil.x.greaterThan( .5 ), () => {

    			alb.assign( kxVil( alb, kxVilQ( m, p, uv, ax, sd ), .5 ) );

    		} ).Else( () => {

    			alb.mulAssign( mix( vec3( .8 ), mix( vec3( 1.05, .95, .82 ), vec3( .85, .88, .92 ), step( .5, h21( vec2( row, id.add( 9. ) ) ) ) ), .6 ).mul( add( .6, mul( .6, tone ) ) ) );
    			alb.mulAssign( sub( 1., mul( .75, aa ).mul( clamp( gap, 0., 1. ) ) ) );

    		} );

    		rough.assign( .88 );

    	} ).ElseIf( m.equal( 47 ), () => {

    		const t = uTime.mul( .35 ).toVar();
    		const c1 = n2( uv.mul( 1.7 ).add( vec2( t, t.mul( .7 ) ) ) ).toVar(), c2 = n2( uv.mul( 2.9 ).sub( vec2( t.mul( .8 ), t.mul( .4 ) ) ) ).toVar();
    		const caus = pow( sub( 1., abs( c1.add( c2 ).sub( 1. ) ) ), 6. ).mul( kxAA( uv.mul( 3. ) ) ).toVar();
    		alb.assign( alb.mul( add( .75, mul( .5, caus ) ) ) );
    		rough.assign( .05 );
    		envK.assign( .55 );
    		emi.assign( alb.mul( add( .35, mul( .9, caus ) ) ).mul( uLampOn ).mul( 1.3 ) );

    	} ).ElseIf( m.equal( 48 ), () => {

    		const fl = floor( p.y.div( 3.3 ) ).toVar(), fy = fract( p.y.div( 3.3 ) ).toVar(), rm = floor( uv.x.div( 3.2 ) ).toVar();
    		const id = vec2( rm.add( sd.mul( 17. ) ), fl.add( float( ax ).mul( 5. ) ) ).toVar();
    		const on = step( .3, h21( id ) ).toVar(), tk = h21( id.add( 4.7 ) ).toVar();
    		const tint = mix( vec3( 1., .66, .38 ), vec3( 1., .84, .62 ), tk ).toVar();
    		const lit = add( .18, mul( .75, smoothstep( .62, .97, fy ) ) ).add( mul( .3, n2( vec2( uv.x.mul( .8 ), fl ) ) ).mul( add( .5, mul( .5, tk ) ) ) ).toVar();
    		const furn = mix( 1., .25, step( fy, .3 ).mul( step( .45, n2( vec2( uv.x.mul( 1.3 ).add( sd ), fl.mul( 3. ) ) ) ) ) ).toVar();
    		const curt = step( .75, h21( id.add( 1.9 ) ) ).toVar();
    		lit.assign( mix( lit.mul( furn ), .75, curt ) );
    		alb.assign( vec3( .022, .026, .03 ) );
    		rough.assign( .05 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		emi.assign( tint.mul( on ).mul( lit ).mul( uLampOn ).mul( add( .2, mul( .18, h21( id.add( 8.3 ) ) ) ) ) );

    	} ).ElseIf( m.equal( 49 ), () => {

    		const g = fract( p.xz.div( 1.6 ) ).sub( .5 ).toVar();
    		const d = length( g ).mul( 1.6 ).toVar(), dn = step( n.y, -0.5 ).toVar();
    		const dotL = smoothstep( .075, .055, d ).mul( dn ).toVar(), halo = exp( d.negate().mul( d ).mul( 3. ) ).mul( dn ).toVar();
    		alb.mulAssign( add( .9, mul( .1, fbm3( p.mul( 2. ) ) ) ).sub( mul( .25, dotL ) ) );
    		rough.assign( .9 );
    		emi.assign( vec3( 1., .78, .52 ).mul( dotL.mul( 2.6 ).add( halo.mul( .22 ) ) ).mul( uLampOn ) );

    	} ).Else( () => {

    		alb.assign( mix( alb, vec3( .075, .072, .068 ), mul( .3, fbm3( p.mul( 4. ) ) ).add( mul( .25, up ) ) ) );
    		alb.mulAssign( add( .88, mul( .2, n2( uv.mul( 60. ) ) ).mul( kxAA( uv.mul( 60. ) ) ) ) );
    		rough.assign( .78 );

    	} );

    	return mat3( alb, vec3( rough, metal, envK ), emi );

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	If( uFocus.w.greaterThan( 0. ), () => {

    		const ab = uFocus.xyz.sub( uCam ).toVar();
    		const tt = clamp( dot( vW.sub( uCam ), ab ).div( dot( ab, ab ) ), 0., 1. ).toVar();
    		const dd = length( vW.sub( uCam ).sub( ab.mul( tt ) ) ).toVar(), cd = length( vW.sub( uCam ) ).toVar();
    		const fade = max( sub( 1., smoothstep( .5, 1.6, cd ) ), sub( 1., smoothstep( .45, 1., dd ) ).mul( step( tt, .8 ) ).mul( .8 ) ).toVar();

    		If( fract( mul( 52.9829189, fract( dot( fragCoord_.xy, vec2( .06711056, .00583715 ) ) ) ) ).lessThan( fade ), () => {

    			Discard();

    		} );

    	} );

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const m = int( vMat.add( .5 ) ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();

    	If( m.greaterThanEqual( 20 ), () => {

    		const tio = vec3( vIns.z, vMat.sub( float( m ) ), 0. ).toVar();
    		const tm = texMat( m, vP, normalize( vNo ), mat3( alb, vec3( rough, metal, envK ), tio ) ).toVar();
    		alb.assign( tm[ 0 ] );
    		rough.assign( tm[ 1 ].x );
    		metal.assign( tm[ 1 ].y );
    		envK.assign( tm[ 1 ].z );
    		emi.assign( tm[ 2 ] );

    		If( uVil.y.greaterThan( .5 ).and( m.greaterThanEqual( 43 ).and( m.lessThanEqual( 46 ) ).or( m.equal( 42 ) ).or( m.equal( 50 ) ) ), () => {

    			const tn = texNrm( m, vP, normalize( vNo ), tio ).toVar();
    			const ca = cos( vIns.w ).toVar(), sa = sin( vIns.w ).toVar();
    			n.assign( normalize( n.add( vec3( ca.mul( tn.x ).add( sa.mul( tn.z ) ), tn.y, ca.mul( tn.z ).sub( sa.mul( tn.x ) ) ) ) ) );

    			If( tn.w.greaterThanEqual( 0. ), () => {

    				rough.assign( tn.w );

    			} );

    		} );

    	} ).ElseIf( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    	} ).ElseIf( m.equal( 1 ), () => {

    		alb.mulAssign( .12 );
    		rough.assign( .04 );
    		envK.assign( 1.1 );

    	} ).ElseIf( m.equal( 2 ), () => {

    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 3 ), () => {

    		rough.assign( .14 );
    		metal.assign( 1. );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 4 ), () => {

    		emi.assign( vCol.mul( add( .2, uM.x.mul( 1.7 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 5 ), () => {

    		const b = max( uM.y, vIns.x ).toVar();
    		emi.assign( vCol.mul( add( .7, b.mul( 2.6 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 6 ), () => {

    		rough.assign( .92 );
    		alb.mulAssign( .5 );

    	} ).ElseIf( m.equal( 7 ), () => {

    		rough.assign( .3 );
    		metal.assign( 1. );
    		envK.assign( .6 );

    	} ).ElseIf( m.equal( 8 ), () => {

    		emi.assign( vCol.mul( 2.4 ).mul( uM.z ).mul( add( .9, mul( .1, sin( uTime.mul( 2.3 ).add( vIns.y.mul( 9. ) ) ) ) ) ) );
    		alb.mulAssign( .1 );

    	} ).ElseIf( m.equal( 9 ), () => {

    		emi.assign( vCol.mul( step( .5, fract( uTime.mul( 1.3 ).add( vIns.y ) ) ) ).mul( 2.6 ) );

    	} ).ElseIf( m.equal( 10 ), () => {

    		rough.assign( .5 );

    	} ).ElseIf( m.equal( 11 ), () => {

    		emi.assign( vCol.mul( 1.1 ).mul( uM.z ) );
    		alb.mulAssign( .3 );

    	} ).ElseIf( m.greaterThanEqual( 12 ).and( m.lessThanEqual( 14 ) ), () => {

    		const on = select( abs( vIns.x.sub( float( m.sub( 12 ) ) ) ).lessThan( .5 ), 1., 0. ).toVar();
    		emi.assign( vCol.mul( add( .04, on.mul( 3.4 ) ) ) );
    		alb.mulAssign( .15 );

    	} ).ElseIf( m.equal( 15 ), () => {

    		rough.assign( .5 );
    		metal.assign( .8 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 16 ), () => {

    		emi.assign( vCol.mul( uLampOn ).mul( 1.6 ) );
    		alb.assign( vec3( .03 ) );
    		rough.assign( .08 );
    		envK.assign( 1. );

    	} );

    	alb.assign( mix( alb, vec3( .025, .022, .02 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	envK.mulAssign( sub( 1., uM.w ) );
    	emi.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).mul( sub( 1., step( 4., float( m ) ).mul( step( float( m ), 9. ) ) ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .35 ), wet ) );
    	alb.mulAssign( sub( 1., mul( .3, wet ) ) );
    	const c = shade( vW, n, v, alb, rough, metal ).toVar();

    	If( envK.greaterThan( 0. ).or( wet.greaterThan( .1 ) ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		c.addAssign( envMap( r ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
