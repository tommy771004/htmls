// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "uberX"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
import airInt from './air-int.mjs';
export default {
"{\"INST_EXTRA\":\"\",\"FAR\":\"*\",\"FARC\":\"\"}": {
  h: "1j751vlvta", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uVilA","type":"sampler2DArray","src":"uVilA"},{"name":"uVilN","type":"sampler2DArray","src":"uVilN"},{"name":"uVil","type":"vec4","src":"uVil"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
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
    const { fwidth, max, smoothstep, sub, Fn, bool, vec2, abs, If, floor, fract, mix, mul, mod, step, select, vec3, dot, clamp, property, length, vec4, add, cross, sin, min, cos, mat2, atan, float, div, pow, exp, mat3, Discard, normalize, int, reflect } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const AI = airInt( TSL, E );
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

    // 帷幕玻璃上的雨（材質 53／54／56，航廈與空橋）：下雨時一條條往下流的水痕（18 cm 一欄，亂數決定有沒有水、寬度、彎曲與流速；水頭在下、往上拖淡），
    // 玻璃濕的時候留著靜止的水珠。水底下的室內光壓暗一半，水珠下緣與水痕帶一點亮（像透鏡收到上方的光）。座標是玻璃面上的（水平切線 × 世界高度），
    // 格子比像素小、60 m 外或面不是直立的時候淡掉
    const glassRain = ( e, n ) => {
    	const h1 = ( x ) => { const t = fract( x.mul( .1031 ) ).toVar(); t.mulAssign( t.add( 33.33 ) ); t.mulAssign( t.add( t ) ); return fract( t ); };
    	const q = vW.xz.sub( uAirA.xy ).toVar();
    	const u = dot( q, vec2( n.z, n.x.negate() ) ).toVar(), y = vW.y.toVar();
    	const fw = max( fwidth( u ), fwidth( y ) ).toVar();
    	const fade = sub( 1., smoothstep( .03, .09, fw ) ).mul( sub( 1., smoothstep( 35., 60., length( uCam.sub( vW ) ) ) ) ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	const cu = u.div( .18 ).toVar(), ci = floor( cu ).toVar(), cf = fract( cu ).sub( .5 ).toVar();
    	const ha = h1( ci ).toVar(), hb = h1( ci.add( 71.3 ) ).toVar();
    	const wig = sin( y.mul( 5.3 ).add( ha.mul( 40. ) ) ).mul( .14 ).add( sin( y.mul( 17. ).add( hb.mul( 20. ) ) ).mul( .05 ) ).toVar();
    	const w = mix( .08, .22, hb ).toVar();
    	const ln = smoothstep( w, w.mul( .35 ), abs( cf.sub( wig ) ) ).mul( step( .6, ha ) ).toVar();
    	const s = fract( y.mul( mix( .12, .3, ha ) ).add( uTime.mul( mix( .15, .45, hb ) ) ).add( hb.mul( 9. ) ) ).toVar();
    	const riv = ln.mul( smoothstep( 0., .03, s ) ).mul( mix( 1., .2, s ) ).mul( uRain ).mul( fade ).toVar();
    	const g = vec2( u, y ).div( .09 ).toVar(), gi = floor( g ).toVar(), gf = fract( g ).sub( .5 ).toVar();
    	const hd = h1( gi.x.add( gi.y.mul( 157.1 ) ) ).toVar();
    	const off = vec2( h1( hd.mul( 91.7 ) ), h1( hd.mul( 37.3 ) ) ).sub( .5 ).mul( .45 ).toVar();
    	const rd = mix( .12, .3, h1( hd.mul( 13.1 ) ) ).toVar();
    	const drop = smoothstep( rd, rd.mul( .6 ), length( gf.sub( off ) ) ).mul( step( .74, hd ) ).mul( smoothstep( .1, .5, uWet ) ).mul( fade ).toVar();
    	const lens = drop.mul( smoothstep( .0, -.25, gf.y.sub( off.y ) ) ).add( riv.mul( .3 ) ).toVar();
    	// 整片的水膜：低頻、慢慢往下流的起伏，讓後面的室內光一明一暗（遠處也看得到，不必反鋸齒）
    	const film = sin( u.mul( 3.1 ).add( sin( y.mul( 1.7 ).add( uTime.mul( .8 ) ) ).mul( 1.5 ) ) ).mul( sin( y.mul( .9 ).add( uTime.mul( 1.2 ) ).add( u.mul( .7 ) ) ) ).mul( .14 ).mul( uRain ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	// 中距離的水簾：15 cm 一道、左右擺動的直條，亮暗沿著往下流（25 m 外還看得出是在下雨的玻璃）
    	const sh = smoothstep( .55, 1., sin( u.mul( 40. ).add( sin( y.mul( 2.3 ).add( h1( floor( u.mul( 6.37 ) ) ).mul( 6. ) ) ).mul( 1.2 ) ) ) ).toVar();
    	const sheet = sh.mul( add( .5, sin( y.mul( 1.3 ).add( uTime.mul( 2.5 ) ).add( u.mul( 5. ) ) ).mul( .5 ) ) ).mul( uRain ).mul( sub( 1., smoothstep( .04, .1, fw ) ) ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	lens.addAssign( sheet.mul( .12 ) );
    	return e.mul( add( 1., film ) ).mul( sub( 1., max( max( riv, drop ), sheet.mul( .7 ) ).mul( .5 ) ) ).add( vec3( .5, .55, .6 ).mul( uDay.mul( .25 ).add( uLamp.mul( .05 ) ) ).add( e.mul( 1.5 ) ).mul( lens ) );
    };

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

    		const wetS = clamp( up.mul( .2 ).add( smoothstep( -0.6, -0.95, n.y ).mul( .05 ) ), 0., 1. ).toVar();
    		const r = fbm3( p.mul( 2.6 ).add( 7. ) ).mul( .92 ).add( mul( .14, n3( p.mul( 23. ) ) ) ).add( wetS ).add( vert.mul( .26 ).mul( smoothstep( .55, .9, fbm( vec2( uv.x.mul( 7. ), p.y.mul( .5 ) ) ) ) ) ).toVar();
    		const rust = smoothstep( .66, .8, r ).toVar(), halo = smoothstep( .54, .66, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, vec3( .11, .1, .09 ), mul( .35, fbm3( p.mul( 1.3 ).add( 2. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .75, .62, .5 ) ), halo.mul( .7 ) ) );
    		alb.assign( mix( alb, mix( vec3( .13, .065, .035 ), vec3( .22, .12, .06 ), n3( p.mul( 31. ) ) ), rust.mul( .85 ) ) );
    		const aa = kxAA( uv.mul( 30. ) ).toVar(), chip = step( .84, n3( p.mul( 34. ) ) ).mul( aa ).mul( sub( 1., rust ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .2, .19 ), chip.mul( .8 ) ) );
    		alb.mulAssign( add( .9, mul( .2, aa ).mul( n2( uv.mul( vec2( 90., 6. ) ) ) ) ) );
    		rough.assign( mix( .45, .9, max( rust, mul( .5, chip ) ) ) );
    		metal.assign( mix( .45, .05, rust ) );
    		envK.assign( mul( .28, sub( 1., rust ) ) );

    	} ).ElseIf( m.equal( 22 ).or( m.equal( 63 ) ), () => {

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

    		const pi = floor( uv.x.div( .9 ) ).toVar(), ph = h21( vec2( pi, sd.mul( 7.1 ).add( 3. ) ) ).toVar(), rep = step( .84, h21( vec2( pi, sd.mul( 3.3 ).add( 9. ) ) ) ).mul( vert ).toVar();
    		alb.mulAssign( mix( vec3( 1. ), add( .87, mul( .26, ph ) ).mul( mix( vec3( 1.03, 1., .96 ), vec3( .96, 1., 1.04 ), h21( vec2( pi, 5.7 ) ) ) ), vert ) );
    		alb.assign( mix( alb, alb.mul( vec3( .9, .96, 1.04 ) ).mul( 1.12 ), rep ) );
    		alb.mulAssign( add( 1., mul( .12, vert ).mul( smoothstep( .5, 3., p.y ) ) ) );
    		alb.mulAssign( add( .82, mul( .3, fbm3( p.mul( 2.2 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .1, .1, .095 ), mul( .25, fbm3( p.mul( .9 ).add( 4. ) ) ).mul( sub( 1., mul( .6, rep ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .35, vert ).mul( kxStreak( p, uv, 5. ) ).mul( sub( 1., mul( .6, rep ) ) ) ) );
    		const fx = fract( uv.x.div( .9 ) ).toVar(), seam = vert.mul( sub( 1., smoothstep( .006, .018, min( fx, sub( 1., fx ) ).mul( .9 ) ) ) ).mul( kxAA( uv.mul( 4. ) ) ).toVar();
    		const bolt = vert.mul( smoothstep( .012, .006, length( vec2( min( fx, sub( 1., fx ) ).mul( .9 ).sub( .03 ), fract( p.y.div( .45 ) ).sub( .5 ).mul( .45 ) ) ) ) ).mul( kxAA( uv.mul( 30. ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .45, seam ) ).mul( sub( 1., mul( .35, bolt ) ) ) );
    		const chip = step( .9, n3( p.mul( 30. ) ) ).mul( smoothstep( .55, .72, fbm3( p.mul( 2. ).add( 3. ) ) ) ).mul( kxAA( uv.mul( 30. ) ) ).mul( sub( 1., rep ) ).toVar();
    		alb.assign( mix( alb, vec3( .24, .24, .23 ), chip.mul( .7 ) ) );
    		rough.assign( mix( .6, .4, chip ) );
    		metal.assign( mix( .05, .8, chip ) );
    		envK.assign( mix( .12, .4, chip ) );

    	} ).ElseIf( m.equal( 30 ), () => {

    		// 30 橡膠、粗塑膠（2026-11-02 補上：原本沒有這一支，畫成素色）：細顆粒、朝上的面一層灰、霧面
    		alb.mulAssign( add( .86, mul( .24, n3( p.mul( 70. ) ) ).mul( kxAA( uv.mul( 70. ) ) ) ).mul( add( .9, mul( .16, fbm3( p.mul( 1.7 ) ) ) ) ) );
    		alb.assign( mix( alb, alb.add( vec3( .03, .028, .025 ) ), up.mul( .6 ) ) );
    		rough.assign( .9 );
    		envK.assign( .04 );

    	} ).ElseIf( m.equal( 52 ), () => {

    		// 52 間知石（2026-11-02，雲梯城寨擋土牆，參考圖的不規則石塊與青苔）：uv 上 34 × 27 cm 的抖動格子取 Voronoi，F2 − F1 是離石縫多遠；
    		// 石縫 2 cm 暗、往內凹，石面中間凸（邊緣暗一點），每塊石頭亮度與色相各取一個雜湊；石縫與朝上、靠下的地方長青苔，牆面有雨水的垂流
    		const cs = vec2( .34, .27 ), g = uv.div( cs ).toVar(), gi = floor( g ).toVar(), gf = fract( g ).toVar();
    		const d1 = float( 9. ).toVar(), d2 = float( 9. ).toVar(), cid = vec2( 0. ).toVar();
    		for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {
    			const o = vec2( i, j ), c = gi.add( o ), r = vec2( h21( c ), h21( c.add( 17.3 ) ) );
    			const d = length( o.add( .12 ).add( r.mul( .76 ) ).sub( gf ).mul( cs ) );
    			d2.assign( select( d.lessThan( d1 ), d1, min( d2, d ) ) );
    			cid.assign( select( d.lessThan( d1 ), c, cid ) );
    			d1.assign( min( d1, d ) );
    		}
    		const edge = d2.sub( d1 ).toVar(), bv = h21( cid.add( 3.7 ) ).toVar();
    		const mort = sub( 1., smoothstep( .012, .026, edge ) ).toVar();
    		const stone = vec3( 1. ).mul( add( .72, mul( .4, bv ) ) ).mul( mix( vec3( 1.04, 1., .94 ), vec3( .95, .98, 1.04 ), h21( cid.add( 9.1 ) ) ) ).toVar();
    		stone.mulAssign( mix( .72, 1., smoothstep( .02, .09, edge ) ) );
    		stone.mulAssign( add( .86, mul( .26, n3( p.mul( 19. ) ) ).mul( kxAA( uv.mul( 19. ) ) ) ) );
    		alb.assign( alb.mul( mix( stone, vec3( .42, .4, .37 ), mort ) ) );
    		const moss = smoothstep( .5, .75, fbm3( p.mul( 1.3 ).add( 11. ) ).add( mort.mul( .25 ) ).add( up.mul( .2 ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .07, .1, .035 ), moss.mul( .75 ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( smoothstep( .6, .9, fbm3( vec3( uv.x.mul( 6. ), p.y.mul( .4 ), 1.7 ) ) ) ) ) );
    		rough.assign( mix( .82, .95, min( mort.add( moss ), 1. ) ) );
    		envK.assign( .05 );

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

    	} ).ElseIf( m.equal( 55 ).or( m.equal( 62 ) ), () => {

    		// 波浪鋼板（機庫外牆、空橋的裙板；blender/airbld.py）：0.2 m 一道的梯形肋（受光的斜面亮、背光的斜面暗、溝底一條陰影），
    		// 1.2 m 一片的色差、片與片的搭接縫、往下的雨痕與牆腳的髒污、零星的鏽點
    		const q = uv.x.div( .2 ).toVar(), f = fract( q ).toVar(), aa = kxAA( vec2( q, 1. ) ).mul( vert ).toVar();
    		const rib = smoothstep( .0, .1, f ).mul( smoothstep( .5, .4, f ) ).toVar(), dk = smoothstep( .5, .56, f ).mul( smoothstep( .78, .66, f ) ).toVar();
    		alb.mulAssign( mix( 1., add( .8, mul( .28, rib ) ).sub( mul( .22, dk ) ), aa ) );
    		const pn = floor( uv.x.div( 1.2 ) ).toVar();
    		alb.mulAssign( add( .93, mul( .12, h21( vec2( pn, sd.add( 3.7 ) ) ) ) ).mul( mix( 1., sub( 1., mul( .35, kxAA( uv.mul( 2. ) ) ) ), vert.mul( step( .985, fract( uv.x.div( 1.2 ) ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .3, vert ).mul( kxStreak( p, uv, 3.5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .55 ).mul( vec3( .9, .85, .78 ) ), sub( 1., smoothstep( .0, 1.2, p.y ) ).mul( vert ).mul( .55 ) ) );
    		const rs = smoothstep( .74, .86, fbm3( p.mul( 1.9 ).add( 8. ) ) ).mul( step( .55, n3( p.mul( 17. ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .1, .05 ), rs.mul( .6 ) ) );
    		rough.assign( mix( .42, .75, rs ) );
    		metal.assign( mix( .45, .1, rs ) );
    		envK.assign( mul( .18, rib ).mul( sub( 1., rs ) ) );

    	} ).ElseIf( m.equal( 53 ), () => {

    		// 航廈的帷幕玻璃（blender/airbld.py）：玻璃後面的大廳由 air-int.mjs 算（interior mapping：地板、夾層、店面、座椅、人、天花燈帶），
    		// 白天看得到裡面、入夜是暖白的燈；420 m 外（隔著海的遠景）只剩平均的亮度
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .9, .74 ).mul( uLamp.mul( .2 ) ).add( vec3( .06, .07, .08 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 420. ), () => { emi.assign( mix( AI.hall( p, n, vW ), far, smoothstep( 300., 420., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 56 ), () => {

    		// 第二航廈 T2 的帷幕玻璃（blender/airbld.py 的 term2）：和 53 一樣，大廳是 air-int.mjs 的 hall2（空側出境大廳挑高、陸側入境大廳有夾層）
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .9, .74 ).mul( uLamp.mul( .2 ) ).add( vec3( .06, .07, .08 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 420. ), () => { emi.assign( mix( AI.hall2( p, n, vW ), far, smoothstep( 300., 420., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 54 ), () => {

    		// 機場的小房間玻璃（blender/airbld.py）：空橋通道、塔台基座、機庫工作間，房間由 air-int.mjs 算；260 m 外只剩平均的亮度
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .95, .86 ).mul( uLamp.mul( .16 ) ).add( vec3( .05, .055, .06 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 260. ), () => { emi.assign( mix( AI.room( p, n, vW ), far, smoothstep( 180., 260., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 49 ), () => {

    		const g = fract( p.xz.div( 1.6 ) ).sub( .5 ).toVar();
    		const d = length( g ).mul( 1.6 ).toVar(), dn = step( n.y, -0.5 ).toVar();
    		// 低角度看時一個像素蓋好幾格：點與光暈照像素的足跡（公尺）淡成整格的平均（點 ≈ 0.005、光暈 ≈ 0.4），不然遠處是同心圓的疊紋
    		const fw = max( fwidth( p.x ), fwidth( p.z ) ).toVar();
    		const dotL = mix( smoothstep( .075, .055, d ), .005, smoothstep( .012, .04, fw ) ).mul( dn ).toVar(), halo = mix( exp( d.negate().mul( d ).mul( 3. ) ), .4, smoothstep( .12, .45, fw ) ).mul( dn ).toVar();
    		alb.mulAssign( add( .9, mul( .1, fbm3( p.mul( 2. ) ) ) ).sub( mul( .25, dotL ) ) );
    		rough.assign( .9 );
    		emi.assign( vec3( 1., .78, .52 ).mul( dotL.mul( 2.6 ).add( halo.mul( .22 ) ) ).mul( uLampOn ) );

    	} ).ElseIf( m.equal( 57 ), () => {

    		// 內照式標誌牌（blender/airbld.py 的滑行道指示牌）：白天是頂點色的壓克力面板，入夜裡面的燈管把面板打亮
    		rough.assign( .3 );
    		emi.assign( alb.mul( uLampOn.mul( .6 ) ) );

    	} ).ElseIf( m.equal( 58 ), () => {

    		// 地勤車的烤漆（blender/airgse.py 的 m58_*；p 是世界座標，機場地面 y ≈ 0）：大片髒污的深淺、細碎掉漆露出灰底漆、零星鏽斑、
    		// 離地 1.3 m 內往下變濃的濺泥（只在直立面；車身下緣約離地 0.5 m）、頂面積灰；掉漆與鏽的細節照世界座標的像素足跡在遠處淡掉（kxAA 的 uv 在車身上變化太快，近處也會被淡掉）
    		const aa = sub( 1., smoothstep( .015, .05, max( max( fwidth( p.x ), fwidth( p.y ) ), fwidth( p.z ) ) ) ).toVar(), low = smoothstep( 1.3, .25, p.y ).toVar(), patch = fbm3( p.mul( 1.2 ) ).sub( .5 ).toVar();
    		const chip = smoothstep( .69, .73, n3( p.mul( 13. ) ).mul( .55 ).add( n3( p.mul( 31. ).add( 3. ) ).mul( .45 ) ).add( patch.mul( .5 ) ).add( low.mul( .08 ) ) ).mul( aa ).toVar();
    		const rust = smoothstep( .7, .76, n3( p.mul( 7.3 ).add( 11. ) ).mul( .6 ).add( n3( p.mul( 19. ) ).mul( .4 ) ).add( patch.mul( .4 ) ).add( low.mul( .12 ) ) ).mul( aa ).toVar();
    		alb.mulAssign( add( .86, mul( .22, fbm3( p.mul( 1.1 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .16, .16, .155 ), chip.mul( .85 ) ) );
    		alb.assign( mix( alb, mix( vec3( .12, .055, .025 ), vec3( .2, .1, .045 ), n3( p.mul( 27. ) ) ), rust.mul( .8 ) ) );
    		const mud = vert.mul( low ).mul( smoothstep( .35, .6, fbm3( vec3( p.x.mul( 2.2 ), p.y.mul( 6. ), p.z.mul( 2.2 ) ) ).add( low.mul( .25 ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .05, .042, .03 ), mud.mul( .85 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .9, .88, .84 ) ).add( .02 ), up.mul( .5 ) ) );
    		rough.assign( mix( .42, .9, max( max( chip, rust ), mud ) ) );
    		envK.assign( mul( .25, sub( 1., max( rust, mud ) ) ) );

    	} ).ElseIf( m.equal( 59 ), () => {

    		// 海上平台的塗漆鋼（21-rig.js）：環氧面漆的半光、細橘皮；掉漆、鏽、鹽、焊縫在後面的做舊（59–63 共用）
    		alb.mulAssign( add( .95, mul( .1, n3( p.mul( 9. ) ) ).mul( kxAA( uv.mul( 9. ) ) ) ) );
    		rough.assign( .5 );
    		metal.assign( .08 );
    		envK.assign( .2 );

    	} ).ElseIf( m.equal( 60 ), () => {

    		// 導管架與浪花帶（21-rig.js；p 是世界座標，海面 y −1.6，浪頂到 +3）：水線附近一圈海藻、藤壺、貽貝，濕滑
    		rough.assign( .55 );
    		metal.assign( .08 );
    		envK.assign( .15 );
    		const wl = add( .6, fbm3( p.mul( .55 ) ).mul( 1.8 ) ).toVar();
    		const gr = sub( 1., smoothstep( wl.sub( .9 ), wl, p.y ) ).toVar();
    		const alg = mix( vec3( .03, .045, .028 ), vec3( .075, .09, .035 ), fbm3( p.mul( 3.1 ) ) ).toVar();
    		const mus = smoothstep( .52, .66, fbm3( p.mul( 4.3 ).add( 6. ) ) ).mul( sub( 1., smoothstep( wl.sub( 1.6 ), wl.sub( .5 ), p.y ) ) ).toVar();
    		const bq = uv.mul( 5.5 ).toVar(), bi = floor( bq ).toVar(), bf = fract( bq ).sub( .5 ).toVar(), bh = h21( bi.add( 2.3 ) ).toVar();
    		const bo = vec2( h21( bi.add( 7.1 ) ), h21( bi.add( 3.9 ) ) ).sub( .5 ).mul( .3 ).toVar(), bd = length( bf.sub( bo ) ).toVar(), br = mix( .2, .34, bh ).toVar();
    		const barn = sub( 1., smoothstep( br.mul( .7 ), br, bd ) ).mul( step( .35, bh ) ).mul( kxAA( bq ) ).toVar();
    		const bcol = vec3( .46, .45, .41 ).mul( add( .55, mul( .45, smoothstep( br.mul( .15 ), br.mul( .45 ), bd ) ) ) ).toVar();
    		alb.assign( mix( alb, alg, gr.mul( .92 ) ) );
    		alb.assign( mix( alb, vec3( .018, .022, .03 ), mus.mul( .9 ) ) );
    		alb.assign( mix( alb, bcol, barn.mul( gr ).mul( sub( 1., mus ) ).mul( .85 ) ) );
    		rough.assign( mix( rough, mix( .32, .7, barn ), gr ) );
    		envK.assign( mix( envK, .3, gr.mul( sub( 1., barn ) ) ) );

    	} ).ElseIf( m.equal( 61 ), () => {

    		// 甲板鋼板（21-rig.js）：頂面是防滑花紋板（3.2 cm 一格、斜向交錯的凸條）、2.4×1.2 m 的板縫、走出來的磨亮路徑、油漬、下雨時的積水；側面當一般鋼板
    		rough.assign( .62 );
    		metal.assign( .3 );
    		envK.assign( .18 );
    		If( up.greaterThan( .5 ), () => {

    			const q = p.xz.div( .032 ).toVar(), qi = floor( q ).toVar(), qf = fract( q ).sub( .5 ).toVar();
    			const dg = select( mod( qi.x.add( qi.y ), 2. ).lessThan( .5 ), qf.x.add( qf.y ), qf.x.sub( qf.y ) ).toVar();
    			const tread = sub( 1., smoothstep( .07, .16, abs( dg ) ) ).mul( sub( 1., smoothstep( .3, .44, max( abs( qf.x ), abs( qf.y ) ) ) ) ).mul( kxAA( q ) ).toVar();
    			alb.mulAssign( add( .86, mul( .3, tread ) ) );
    			const ps = p.xz.div( vec2( 2.4, 1.2 ) ).toVar(), pd = min( abs( fract( ps.x.add( .5 ) ).sub( .5 ) ).mul( 2.4 ), abs( fract( ps.y.add( .5 ) ).sub( .5 ) ).mul( 1.2 ) ).toVar();
    			const seam = sub( 1., smoothstep( .008, .025, pd ) ).mul( kxAA( p.xz.mul( 6. ) ) ).toVar();
    			alb.mulAssign( add( .92, mul( .16, h21( floor( ps ).add( sd ) ) ) ).mul( sub( 1., mul( .5, seam ) ) ) );
    			const wear = smoothstep( .52, .7, fbm3( vec3( p.x.mul( .22 ), 1.7, p.z.mul( .22 ) ) ) ).mul( add( .6, mul( .4, n3( p.mul( 3. ) ) ) ) ).toVar();
    			alb.assign( mix( alb, vec3( .3, .29, .28 ).mul( add( .85, mul( .3, tread ) ) ), wear.mul( .75 ) ) );
    			metal.assign( mix( metal, .75, wear ) );
    			rough.assign( mix( rough, .34, wear ) );
    			const oil = smoothstep( .64, .74, fbm3( vec3( p.x.mul( .8 ), 4.1, p.z.mul( .8 ) ) ).mul( .7 ).add( n3( p.mul( 2.3 ) ).mul( .3 ) ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .6, oil ) ) );
    			rough.assign( mix( rough, .22, oil ) );
    			envK.assign( mix( envK, .4, oil ) );
    			const pud = smoothstep( .5, .62, fbm3( vec3( p.x.mul( .35 ), 9.3, p.z.mul( .35 ) ) ) ).mul( smoothstep( .1, .6, uWet ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .3, pud ) ) );
    			rough.assign( mix( rough, .06, pud ) );
    			envK.assign( mix( envK, .85, pud ) );

    		} );

    	} ).Else( () => {

    		alb.assign( mix( alb, vec3( .075, .072, .068 ), mul( .3, fbm3( p.mul( 4. ) ) ).add( mul( .25, up ) ) ) );
    		alb.mulAssign( add( .88, mul( .2, n2( uv.mul( 60. ) ) ).mul( kxAA( uv.mul( 60. ) ) ) ) );
    		rough.assign( .78 );

    	} );

    	// 海上平台的做舊（59–63，21-rig.js；p 是世界座標）：大片褪色與白化、補漆的色塊、每 2.5 m 的橫焊縫與 3 m 的直焊縫、
    	// 焊縫往下流的鏽水、鏽斑與鏽暈、掉漆露出紅丹底漆、底面與浪花帶的鹽霜、頂面的油污、浪花帶的濕暗
    	If( m.greaterThanEqual( 59 ).and( m.lessThanEqual( 63 ) ), () => {

    		const sz = sub( 1., smoothstep( 1.5, 11., p.y ) ).toVar(), dn = sub( 1., smoothstep( -0.85, -0.4, n.y ) ).toVar();
    		const aw = sub( 1., smoothstep( .02, .08, max( max( fwidth( p.x ), fwidth( p.y ) ), fwidth( p.z ) ) ) ).toVar();
    		alb.mulAssign( add( .8, mul( .34, fbm3( p.mul( .31 ).add( 4. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( .78 ).add( vec3( .06, .06, .055 ) ), up.mul( .4 ) ) );
		alb.assign( mix( alb, alb.mul( .6 ).add( vec3( .035, .03, .025 ) ), add( .2, mul( .34, fbm3( p.mul( .5 ).add( 2. ) ) ) ) ) );
		const gs = kxStreak( p, uv, 1.6 ).mul( vert ).toVar();
		alb.assign( mix( alb, alb.mul( vec3( .5, .46, .42 ) ), gs.mul( .5 ) ) );
    		const rp = vec2( uv.x, p.y ).add( vec2( fbm3( p.mul( .8 ) ), fbm3( p.mul( .8 ).add( 5. ) ) ).sub( .5 ).mul( 1.4 ) ).toVar();
    		const ri = floor( rp.div( vec2( 1.9, 1.3 ) ) ).toVar();
    		const pm = step( .82, h21( ri.add( sd.mul( 3.1 ) ).add( 1.7 ) ) ).mul( vert ).toVar();
    		alb.assign( mix( alb, alb.mul( mix( vec3( 1.12, 1.07, .95 ), vec3( .84, .88, .92 ), h21( ri.add( 9.1 ) ) ) ), pm.mul( .85 ) ) );
    		const sy = fract( p.y.div( 2.5 ) ).toVar(), dy = abs( sy.sub( .5 ) ).mul( -2.5 ).add( 1.25 ).toVar(), dx = abs( fract( uv.x.div( 3. ).add( .5 ) ).sub( .5 ) ).mul( 3. ).toVar();
    		const weld = sub( 1., smoothstep( .012, .035, min( dy, dx ) ) ).mul( vert ).mul( aw ).toVar();
    		alb.mulAssign( sub( 1., mul( .35, weld ) ) );
    		const db = sub( 1., sy ).mul( 2.5 ).toVar(), lane = floor( p.y.div( 2.5 ) ).toVar();
    		const col = smoothstep( .5, .82, fbm( vec2( uv.x.mul( 2.7 ).add( lane.mul( 3.7 ) ), p.y.mul( .07 ) ) ) ).mul( add( .55, mul( .45, n2( vec2( uv.x.mul( 19. ), p.y.mul( 1.3 ) ) ) ) ) ).toVar();
    		const run = col.mul( exp( db.mul( mix( 1.6, .45, h21( vec2( floor( uv.x.mul( 1.3 ) ), lane ) ) ) ).negate() ) ).mul( vert ).toVar();
    		const strk = clamp( run.mul( 1.9 ).add( kxStreak( p, uv, 3.2 ).mul( .45 ) ).add( sz.mul( vert ).mul( .25 ).mul( fbm( vec2( uv.x.mul( 5. ), p.y.mul( .4 ) ) ) ) ), 0., 1. ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .6, .36, .21 ) ).add( vec3( .03, .011, .0 ) ), strk.mul( .8 ) ) );
    		const r = fbm3( p.mul( 1.7 ).add( 3. ) ).mul( .78 ).add( mul( .22, n3( p.mul( 13. ) ) ) ).add( weld.mul( .3 ) ).add( sz.mul( .3 ) ).add( dn.mul( .03 ) ).sub( up.mul( .08 ) ).toVar();
    		const rust = smoothstep( .7, .8, r ).toVar(), halo = smoothstep( .58, .7, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .74, .58, .44 ) ), halo.mul( .75 ) ) );
    		alb.assign( mix( alb, mix( vec3( .15, .065, .028 ), vec3( .3, .13, .05 ), n3( p.mul( 29. ) ) ), rust.mul( .92 ) ) );
    		const chip = step( .78, n3( p.mul( 23. ) ).mul( .6 ).add( n3( p.mul( 57. ).add( 2. ) ).mul( .4 ) ).add( sz.mul( .08 ) ) ).mul( aw ).mul( sub( 1., rust ) ).mul( sub( 1., up.mul( .8 ) ) ).mul( sub( 1., dn.mul( .6 ) ) ).toVar();
    		alb.assign( mix( alb, mix( vec3( .3, .11, .065 ), vec3( .34, .33, .31 ), step( .5, n3( p.mul( 7. ) ) ) ), chip.mul( .85 ) ) );
    		const salt = smoothstep( .5, .78, fbm3( p.mul( 2.4 ).add( 1. ) ) ).mul( clamp( dn.mul( .7 ).add( sz.mul( .8 ) ), 0., 1. ) ).toVar();
    		alb.assign( mix( alb, vec3( .55, .56, .53 ), salt.mul( .45 ) ) );
    		const grime = up.mul( smoothstep( .42, .72, fbm3( p.mul( 1.3 ).add( 8. ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .055, .05, .045 ), grime.mul( .45 ) ) );
    		alb.mulAssign( sub( 1., mul( .3, sz ).mul( add( .4, mul( .6, smoothstep( .5, .9, fbm( vec2( uv.x.mul( .8 ), p.y.mul( .9 ) ) ) ) ) ) ) ) );
    		rough.assign( mix( mix( rough, .93, max( rust, mul( .6, salt ) ) ), .3, sz.mul( .5 ).mul( sub( 1., rust ) ) ) );
    		metal.mulAssign( sub( 1., rust ) );
    		envK.mulAssign( sub( 1., rust ).mul( sub( 1., mul( .5, salt ) ) ) );

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

    		If( m.lessThanEqual( 22 ).or( m.equal( 29 ) ).or( m.equal( 34 ) ).or( m.equal( 26 ) ).or( m.equal( 27 ) ), () => {

    			const hg = vW.y.sub( .15 ).toVar(), vt = sub( 1., smoothstep( .5, .8, abs( n.y ) ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .28, sub( 1., smoothstep( 0., .5, hg ) ) ).mul( step( -0.2, hg ) ).mul( vt ).mul( add( .6, mul( .4, n2( vW.xz.mul( 3. ).add( vW.y.mul( 4. ) ) ) ) ) ) ) );

    			If( m.equal( 21 ).or( m.equal( 29 ) ).or( m.equal( 34 ) ), () => {

    				const rb = sub( 1., smoothstep( .06, add( .25, mul( .1, n2( vW.xz.mul( 5. ) ) ) ), hg ) ).mul( step( -0.2, hg ) ).mul( vt ).mul( smoothstep( .3, .55, n2( vW.xz.mul( 7. ).add( vW.y.mul( 9. ) ) ) ) ).toVar();
    				alb.assign( mix( alb, vec3( .12, .065, .035 ), rb.mul( .8 ) ) );
    				metal.mulAssign( sub( 1., rb ) );
    				envK.mulAssign( sub( 1., rb ) );
    				rough.assign( mix( rough, .9, rb ) );

    			} );

    		} );

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
    		c.addAssign( envMapS( r, 1. ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	// 鏡頭在城外（機場島、外海、對岸）時照完整的距離起霧：石柱峰（21-coast.js 的 KARST）底下的雲海從城外幾乎是側面、看不出來，
    	// 只算 7% 的霧時前面的山整片進霧、石柱峰卻很清楚，像一塊塊浮在天上。城裡（uCityM）照舊；只管離鏡頭 1.8–3 km 以外的：
    	// 機場建築從城西岸（外圈 90 m 在遮罩外）、從機場島上看都在這距離內，照舊清楚
    	const camOut = sub( 1., smoothstep( 0., .3, uCityM.sample( uCam.xz.sub( uHM.xy ).mul( uHM.z ) ).r ) ).mul( smoothstep( 1800., 3000., length( vW.sub( uCam ) ) ) ).toVar();
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( mix( FAR, 1., camOut ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"INST_EXTRA\":\"\"}": {
  h: "1xagqf8vsq", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uVilA","type":"sampler2DArray","src":"uVilA"},{"name":"uVilN","type":"sampler2DArray","src":"uVilN"},{"name":"uVil","type":"vec4","src":"uVil"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
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
    const { fwidth, max, smoothstep, sub, Fn, bool, vec2, abs, If, floor, fract, mix, mul, mod, step, select, vec3, dot, clamp, property, length, vec4, add, cross, sin, min, cos, mat2, atan, float, div, pow, exp, mat3, Discard, normalize, int, reflect } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const AI = airInt( TSL, E );
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

    // 帷幕玻璃上的雨（材質 53／54／56，航廈與空橋）：下雨時一條條往下流的水痕（18 cm 一欄，亂數決定有沒有水、寬度、彎曲與流速；水頭在下、往上拖淡），
    // 玻璃濕的時候留著靜止的水珠。水底下的室內光壓暗一半，水珠下緣與水痕帶一點亮（像透鏡收到上方的光）。座標是玻璃面上的（水平切線 × 世界高度），
    // 格子比像素小、60 m 外或面不是直立的時候淡掉
    const glassRain = ( e, n ) => {
    	const h1 = ( x ) => { const t = fract( x.mul( .1031 ) ).toVar(); t.mulAssign( t.add( 33.33 ) ); t.mulAssign( t.add( t ) ); return fract( t ); };
    	const q = vW.xz.sub( uAirA.xy ).toVar();
    	const u = dot( q, vec2( n.z, n.x.negate() ) ).toVar(), y = vW.y.toVar();
    	const fw = max( fwidth( u ), fwidth( y ) ).toVar();
    	const fade = sub( 1., smoothstep( .03, .09, fw ) ).mul( sub( 1., smoothstep( 35., 60., length( uCam.sub( vW ) ) ) ) ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	const cu = u.div( .18 ).toVar(), ci = floor( cu ).toVar(), cf = fract( cu ).sub( .5 ).toVar();
    	const ha = h1( ci ).toVar(), hb = h1( ci.add( 71.3 ) ).toVar();
    	const wig = sin( y.mul( 5.3 ).add( ha.mul( 40. ) ) ).mul( .14 ).add( sin( y.mul( 17. ).add( hb.mul( 20. ) ) ).mul( .05 ) ).toVar();
    	const w = mix( .08, .22, hb ).toVar();
    	const ln = smoothstep( w, w.mul( .35 ), abs( cf.sub( wig ) ) ).mul( step( .6, ha ) ).toVar();
    	const s = fract( y.mul( mix( .12, .3, ha ) ).add( uTime.mul( mix( .15, .45, hb ) ) ).add( hb.mul( 9. ) ) ).toVar();
    	const riv = ln.mul( smoothstep( 0., .03, s ) ).mul( mix( 1., .2, s ) ).mul( uRain ).mul( fade ).toVar();
    	const g = vec2( u, y ).div( .09 ).toVar(), gi = floor( g ).toVar(), gf = fract( g ).sub( .5 ).toVar();
    	const hd = h1( gi.x.add( gi.y.mul( 157.1 ) ) ).toVar();
    	const off = vec2( h1( hd.mul( 91.7 ) ), h1( hd.mul( 37.3 ) ) ).sub( .5 ).mul( .45 ).toVar();
    	const rd = mix( .12, .3, h1( hd.mul( 13.1 ) ) ).toVar();
    	const drop = smoothstep( rd, rd.mul( .6 ), length( gf.sub( off ) ) ).mul( step( .74, hd ) ).mul( smoothstep( .1, .5, uWet ) ).mul( fade ).toVar();
    	const lens = drop.mul( smoothstep( .0, -.25, gf.y.sub( off.y ) ) ).add( riv.mul( .3 ) ).toVar();
    	// 整片的水膜：低頻、慢慢往下流的起伏，讓後面的室內光一明一暗（遠處也看得到，不必反鋸齒）
    	const film = sin( u.mul( 3.1 ).add( sin( y.mul( 1.7 ).add( uTime.mul( .8 ) ) ).mul( 1.5 ) ) ).mul( sin( y.mul( .9 ).add( uTime.mul( 1.2 ) ).add( u.mul( .7 ) ) ) ).mul( .14 ).mul( uRain ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	// 中距離的水簾：15 cm 一道、左右擺動的直條，亮暗沿著往下流（25 m 外還看得出是在下雨的玻璃）
    	const sh = smoothstep( .55, 1., sin( u.mul( 40. ).add( sin( y.mul( 2.3 ).add( h1( floor( u.mul( 6.37 ) ) ).mul( 6. ) ) ).mul( 1.2 ) ) ) ).toVar();
    	const sheet = sh.mul( add( .5, sin( y.mul( 1.3 ).add( uTime.mul( 2.5 ) ).add( u.mul( 5. ) ) ).mul( .5 ) ) ).mul( uRain ).mul( sub( 1., smoothstep( .04, .1, fw ) ) ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	lens.addAssign( sheet.mul( .12 ) );
    	return e.mul( add( 1., film ) ).mul( sub( 1., max( max( riv, drop ), sheet.mul( .7 ) ).mul( .5 ) ) ).add( vec3( .5, .55, .6 ).mul( uDay.mul( .25 ).add( uLamp.mul( .05 ) ) ).add( e.mul( 1.5 ) ).mul( lens ) );
    };

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

    		const wetS = clamp( up.mul( .2 ).add( smoothstep( -0.6, -0.95, n.y ).mul( .05 ) ), 0., 1. ).toVar();
    		const r = fbm3( p.mul( 2.6 ).add( 7. ) ).mul( .92 ).add( mul( .14, n3( p.mul( 23. ) ) ) ).add( wetS ).add( vert.mul( .26 ).mul( smoothstep( .55, .9, fbm( vec2( uv.x.mul( 7. ), p.y.mul( .5 ) ) ) ) ) ).toVar();
    		const rust = smoothstep( .66, .8, r ).toVar(), halo = smoothstep( .54, .66, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, vec3( .11, .1, .09 ), mul( .35, fbm3( p.mul( 1.3 ).add( 2. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .75, .62, .5 ) ), halo.mul( .7 ) ) );
    		alb.assign( mix( alb, mix( vec3( .13, .065, .035 ), vec3( .22, .12, .06 ), n3( p.mul( 31. ) ) ), rust.mul( .85 ) ) );
    		const aa = kxAA( uv.mul( 30. ) ).toVar(), chip = step( .84, n3( p.mul( 34. ) ) ).mul( aa ).mul( sub( 1., rust ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .2, .19 ), chip.mul( .8 ) ) );
    		alb.mulAssign( add( .9, mul( .2, aa ).mul( n2( uv.mul( vec2( 90., 6. ) ) ) ) ) );
    		rough.assign( mix( .45, .9, max( rust, mul( .5, chip ) ) ) );
    		metal.assign( mix( .45, .05, rust ) );
    		envK.assign( mul( .28, sub( 1., rust ) ) );

    	} ).ElseIf( m.equal( 22 ).or( m.equal( 63 ) ), () => {

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

    		const pi = floor( uv.x.div( .9 ) ).toVar(), ph = h21( vec2( pi, sd.mul( 7.1 ).add( 3. ) ) ).toVar(), rep = step( .84, h21( vec2( pi, sd.mul( 3.3 ).add( 9. ) ) ) ).mul( vert ).toVar();
    		alb.mulAssign( mix( vec3( 1. ), add( .87, mul( .26, ph ) ).mul( mix( vec3( 1.03, 1., .96 ), vec3( .96, 1., 1.04 ), h21( vec2( pi, 5.7 ) ) ) ), vert ) );
    		alb.assign( mix( alb, alb.mul( vec3( .9, .96, 1.04 ) ).mul( 1.12 ), rep ) );
    		alb.mulAssign( add( 1., mul( .12, vert ).mul( smoothstep( .5, 3., p.y ) ) ) );
    		alb.mulAssign( add( .82, mul( .3, fbm3( p.mul( 2.2 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .1, .1, .095 ), mul( .25, fbm3( p.mul( .9 ).add( 4. ) ) ).mul( sub( 1., mul( .6, rep ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .35, vert ).mul( kxStreak( p, uv, 5. ) ).mul( sub( 1., mul( .6, rep ) ) ) ) );
    		const fx = fract( uv.x.div( .9 ) ).toVar(), seam = vert.mul( sub( 1., smoothstep( .006, .018, min( fx, sub( 1., fx ) ).mul( .9 ) ) ) ).mul( kxAA( uv.mul( 4. ) ) ).toVar();
    		const bolt = vert.mul( smoothstep( .012, .006, length( vec2( min( fx, sub( 1., fx ) ).mul( .9 ).sub( .03 ), fract( p.y.div( .45 ) ).sub( .5 ).mul( .45 ) ) ) ) ).mul( kxAA( uv.mul( 30. ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .45, seam ) ).mul( sub( 1., mul( .35, bolt ) ) ) );
    		const chip = step( .9, n3( p.mul( 30. ) ) ).mul( smoothstep( .55, .72, fbm3( p.mul( 2. ).add( 3. ) ) ) ).mul( kxAA( uv.mul( 30. ) ) ).mul( sub( 1., rep ) ).toVar();
    		alb.assign( mix( alb, vec3( .24, .24, .23 ), chip.mul( .7 ) ) );
    		rough.assign( mix( .6, .4, chip ) );
    		metal.assign( mix( .05, .8, chip ) );
    		envK.assign( mix( .12, .4, chip ) );

    	} ).ElseIf( m.equal( 30 ), () => {

    		// 30 橡膠、粗塑膠（2026-11-02 補上：原本沒有這一支，畫成素色）：細顆粒、朝上的面一層灰、霧面
    		alb.mulAssign( add( .86, mul( .24, n3( p.mul( 70. ) ) ).mul( kxAA( uv.mul( 70. ) ) ) ).mul( add( .9, mul( .16, fbm3( p.mul( 1.7 ) ) ) ) ) );
    		alb.assign( mix( alb, alb.add( vec3( .03, .028, .025 ) ), up.mul( .6 ) ) );
    		rough.assign( .9 );
    		envK.assign( .04 );

    	} ).ElseIf( m.equal( 52 ), () => {

    		// 52 間知石（2026-11-02，雲梯城寨擋土牆，參考圖的不規則石塊與青苔）：uv 上 34 × 27 cm 的抖動格子取 Voronoi，F2 − F1 是離石縫多遠；
    		// 石縫 2 cm 暗、往內凹，石面中間凸（邊緣暗一點），每塊石頭亮度與色相各取一個雜湊；石縫與朝上、靠下的地方長青苔，牆面有雨水的垂流
    		const cs = vec2( .34, .27 ), g = uv.div( cs ).toVar(), gi = floor( g ).toVar(), gf = fract( g ).toVar();
    		const d1 = float( 9. ).toVar(), d2 = float( 9. ).toVar(), cid = vec2( 0. ).toVar();
    		for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {
    			const o = vec2( i, j ), c = gi.add( o ), r = vec2( h21( c ), h21( c.add( 17.3 ) ) );
    			const d = length( o.add( .12 ).add( r.mul( .76 ) ).sub( gf ).mul( cs ) );
    			d2.assign( select( d.lessThan( d1 ), d1, min( d2, d ) ) );
    			cid.assign( select( d.lessThan( d1 ), c, cid ) );
    			d1.assign( min( d1, d ) );
    		}
    		const edge = d2.sub( d1 ).toVar(), bv = h21( cid.add( 3.7 ) ).toVar();
    		const mort = sub( 1., smoothstep( .012, .026, edge ) ).toVar();
    		const stone = vec3( 1. ).mul( add( .72, mul( .4, bv ) ) ).mul( mix( vec3( 1.04, 1., .94 ), vec3( .95, .98, 1.04 ), h21( cid.add( 9.1 ) ) ) ).toVar();
    		stone.mulAssign( mix( .72, 1., smoothstep( .02, .09, edge ) ) );
    		stone.mulAssign( add( .86, mul( .26, n3( p.mul( 19. ) ) ).mul( kxAA( uv.mul( 19. ) ) ) ) );
    		alb.assign( alb.mul( mix( stone, vec3( .42, .4, .37 ), mort ) ) );
    		const moss = smoothstep( .5, .75, fbm3( p.mul( 1.3 ).add( 11. ) ).add( mort.mul( .25 ) ).add( up.mul( .2 ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .07, .1, .035 ), moss.mul( .75 ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( smoothstep( .6, .9, fbm3( vec3( uv.x.mul( 6. ), p.y.mul( .4 ), 1.7 ) ) ) ) ) );
    		rough.assign( mix( .82, .95, min( mort.add( moss ), 1. ) ) );
    		envK.assign( .05 );

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

    	} ).ElseIf( m.equal( 55 ).or( m.equal( 62 ) ), () => {

    		// 波浪鋼板（機庫外牆、空橋的裙板；blender/airbld.py）：0.2 m 一道的梯形肋（受光的斜面亮、背光的斜面暗、溝底一條陰影），
    		// 1.2 m 一片的色差、片與片的搭接縫、往下的雨痕與牆腳的髒污、零星的鏽點
    		const q = uv.x.div( .2 ).toVar(), f = fract( q ).toVar(), aa = kxAA( vec2( q, 1. ) ).mul( vert ).toVar();
    		const rib = smoothstep( .0, .1, f ).mul( smoothstep( .5, .4, f ) ).toVar(), dk = smoothstep( .5, .56, f ).mul( smoothstep( .78, .66, f ) ).toVar();
    		alb.mulAssign( mix( 1., add( .8, mul( .28, rib ) ).sub( mul( .22, dk ) ), aa ) );
    		const pn = floor( uv.x.div( 1.2 ) ).toVar();
    		alb.mulAssign( add( .93, mul( .12, h21( vec2( pn, sd.add( 3.7 ) ) ) ) ).mul( mix( 1., sub( 1., mul( .35, kxAA( uv.mul( 2. ) ) ) ), vert.mul( step( .985, fract( uv.x.div( 1.2 ) ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .3, vert ).mul( kxStreak( p, uv, 3.5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .55 ).mul( vec3( .9, .85, .78 ) ), sub( 1., smoothstep( .0, 1.2, p.y ) ).mul( vert ).mul( .55 ) ) );
    		const rs = smoothstep( .74, .86, fbm3( p.mul( 1.9 ).add( 8. ) ) ).mul( step( .55, n3( p.mul( 17. ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .1, .05 ), rs.mul( .6 ) ) );
    		rough.assign( mix( .42, .75, rs ) );
    		metal.assign( mix( .45, .1, rs ) );
    		envK.assign( mul( .18, rib ).mul( sub( 1., rs ) ) );

    	} ).ElseIf( m.equal( 53 ), () => {

    		// 航廈的帷幕玻璃（blender/airbld.py）：玻璃後面的大廳由 air-int.mjs 算（interior mapping：地板、夾層、店面、座椅、人、天花燈帶），
    		// 白天看得到裡面、入夜是暖白的燈；420 m 外（隔著海的遠景）只剩平均的亮度
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .9, .74 ).mul( uLamp.mul( .2 ) ).add( vec3( .06, .07, .08 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 420. ), () => { emi.assign( mix( AI.hall( p, n, vW ), far, smoothstep( 300., 420., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 56 ), () => {

    		// 第二航廈 T2 的帷幕玻璃（blender/airbld.py 的 term2）：和 53 一樣，大廳是 air-int.mjs 的 hall2（空側出境大廳挑高、陸側入境大廳有夾層）
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .9, .74 ).mul( uLamp.mul( .2 ) ).add( vec3( .06, .07, .08 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 420. ), () => { emi.assign( mix( AI.hall2( p, n, vW ), far, smoothstep( 300., 420., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 54 ), () => {

    		// 機場的小房間玻璃（blender/airbld.py）：空橋通道、塔台基座、機庫工作間，房間由 air-int.mjs 算；260 m 外只剩平均的亮度
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .95, .86 ).mul( uLamp.mul( .16 ) ).add( vec3( .05, .055, .06 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 260. ), () => { emi.assign( mix( AI.room( p, n, vW ), far, smoothstep( 180., 260., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 49 ), () => {

    		const g = fract( p.xz.div( 1.6 ) ).sub( .5 ).toVar();
    		const d = length( g ).mul( 1.6 ).toVar(), dn = step( n.y, -0.5 ).toVar();
    		// 低角度看時一個像素蓋好幾格：點與光暈照像素的足跡（公尺）淡成整格的平均（點 ≈ 0.005、光暈 ≈ 0.4），不然遠處是同心圓的疊紋
    		const fw = max( fwidth( p.x ), fwidth( p.z ) ).toVar();
    		const dotL = mix( smoothstep( .075, .055, d ), .005, smoothstep( .012, .04, fw ) ).mul( dn ).toVar(), halo = mix( exp( d.negate().mul( d ).mul( 3. ) ), .4, smoothstep( .12, .45, fw ) ).mul( dn ).toVar();
    		alb.mulAssign( add( .9, mul( .1, fbm3( p.mul( 2. ) ) ) ).sub( mul( .25, dotL ) ) );
    		rough.assign( .9 );
    		emi.assign( vec3( 1., .78, .52 ).mul( dotL.mul( 2.6 ).add( halo.mul( .22 ) ) ).mul( uLampOn ) );

    	} ).ElseIf( m.equal( 57 ), () => {

    		// 內照式標誌牌（blender/airbld.py 的滑行道指示牌）：白天是頂點色的壓克力面板，入夜裡面的燈管把面板打亮
    		rough.assign( .3 );
    		emi.assign( alb.mul( uLampOn.mul( .6 ) ) );

    	} ).ElseIf( m.equal( 58 ), () => {

    		// 地勤車的烤漆（blender/airgse.py 的 m58_*；p 是世界座標，機場地面 y ≈ 0）：大片髒污的深淺、細碎掉漆露出灰底漆、零星鏽斑、
    		// 離地 1.3 m 內往下變濃的濺泥（只在直立面；車身下緣約離地 0.5 m）、頂面積灰；掉漆與鏽的細節照世界座標的像素足跡在遠處淡掉（kxAA 的 uv 在車身上變化太快，近處也會被淡掉）
    		const aa = sub( 1., smoothstep( .015, .05, max( max( fwidth( p.x ), fwidth( p.y ) ), fwidth( p.z ) ) ) ).toVar(), low = smoothstep( 1.3, .25, p.y ).toVar(), patch = fbm3( p.mul( 1.2 ) ).sub( .5 ).toVar();
    		const chip = smoothstep( .69, .73, n3( p.mul( 13. ) ).mul( .55 ).add( n3( p.mul( 31. ).add( 3. ) ).mul( .45 ) ).add( patch.mul( .5 ) ).add( low.mul( .08 ) ) ).mul( aa ).toVar();
    		const rust = smoothstep( .7, .76, n3( p.mul( 7.3 ).add( 11. ) ).mul( .6 ).add( n3( p.mul( 19. ) ).mul( .4 ) ).add( patch.mul( .4 ) ).add( low.mul( .12 ) ) ).mul( aa ).toVar();
    		alb.mulAssign( add( .86, mul( .22, fbm3( p.mul( 1.1 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .16, .16, .155 ), chip.mul( .85 ) ) );
    		alb.assign( mix( alb, mix( vec3( .12, .055, .025 ), vec3( .2, .1, .045 ), n3( p.mul( 27. ) ) ), rust.mul( .8 ) ) );
    		const mud = vert.mul( low ).mul( smoothstep( .35, .6, fbm3( vec3( p.x.mul( 2.2 ), p.y.mul( 6. ), p.z.mul( 2.2 ) ) ).add( low.mul( .25 ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .05, .042, .03 ), mud.mul( .85 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .9, .88, .84 ) ).add( .02 ), up.mul( .5 ) ) );
    		rough.assign( mix( .42, .9, max( max( chip, rust ), mud ) ) );
    		envK.assign( mul( .25, sub( 1., max( rust, mud ) ) ) );

    	} ).ElseIf( m.equal( 59 ), () => {

    		// 海上平台的塗漆鋼（21-rig.js）：環氧面漆的半光、細橘皮；掉漆、鏽、鹽、焊縫在後面的做舊（59–63 共用）
    		alb.mulAssign( add( .95, mul( .1, n3( p.mul( 9. ) ) ).mul( kxAA( uv.mul( 9. ) ) ) ) );
    		rough.assign( .5 );
    		metal.assign( .08 );
    		envK.assign( .2 );

    	} ).ElseIf( m.equal( 60 ), () => {

    		// 導管架與浪花帶（21-rig.js；p 是世界座標，海面 y −1.6，浪頂到 +3）：水線附近一圈海藻、藤壺、貽貝，濕滑
    		rough.assign( .55 );
    		metal.assign( .08 );
    		envK.assign( .15 );
    		const wl = add( .6, fbm3( p.mul( .55 ) ).mul( 1.8 ) ).toVar();
    		const gr = sub( 1., smoothstep( wl.sub( .9 ), wl, p.y ) ).toVar();
    		const alg = mix( vec3( .03, .045, .028 ), vec3( .075, .09, .035 ), fbm3( p.mul( 3.1 ) ) ).toVar();
    		const mus = smoothstep( .52, .66, fbm3( p.mul( 4.3 ).add( 6. ) ) ).mul( sub( 1., smoothstep( wl.sub( 1.6 ), wl.sub( .5 ), p.y ) ) ).toVar();
    		const bq = uv.mul( 5.5 ).toVar(), bi = floor( bq ).toVar(), bf = fract( bq ).sub( .5 ).toVar(), bh = h21( bi.add( 2.3 ) ).toVar();
    		const bo = vec2( h21( bi.add( 7.1 ) ), h21( bi.add( 3.9 ) ) ).sub( .5 ).mul( .3 ).toVar(), bd = length( bf.sub( bo ) ).toVar(), br = mix( .2, .34, bh ).toVar();
    		const barn = sub( 1., smoothstep( br.mul( .7 ), br, bd ) ).mul( step( .35, bh ) ).mul( kxAA( bq ) ).toVar();
    		const bcol = vec3( .46, .45, .41 ).mul( add( .55, mul( .45, smoothstep( br.mul( .15 ), br.mul( .45 ), bd ) ) ) ).toVar();
    		alb.assign( mix( alb, alg, gr.mul( .92 ) ) );
    		alb.assign( mix( alb, vec3( .018, .022, .03 ), mus.mul( .9 ) ) );
    		alb.assign( mix( alb, bcol, barn.mul( gr ).mul( sub( 1., mus ) ).mul( .85 ) ) );
    		rough.assign( mix( rough, mix( .32, .7, barn ), gr ) );
    		envK.assign( mix( envK, .3, gr.mul( sub( 1., barn ) ) ) );

    	} ).ElseIf( m.equal( 61 ), () => {

    		// 甲板鋼板（21-rig.js）：頂面是防滑花紋板（3.2 cm 一格、斜向交錯的凸條）、2.4×1.2 m 的板縫、走出來的磨亮路徑、油漬、下雨時的積水；側面當一般鋼板
    		rough.assign( .62 );
    		metal.assign( .3 );
    		envK.assign( .18 );
    		If( up.greaterThan( .5 ), () => {

    			const q = p.xz.div( .032 ).toVar(), qi = floor( q ).toVar(), qf = fract( q ).sub( .5 ).toVar();
    			const dg = select( mod( qi.x.add( qi.y ), 2. ).lessThan( .5 ), qf.x.add( qf.y ), qf.x.sub( qf.y ) ).toVar();
    			const tread = sub( 1., smoothstep( .07, .16, abs( dg ) ) ).mul( sub( 1., smoothstep( .3, .44, max( abs( qf.x ), abs( qf.y ) ) ) ) ).mul( kxAA( q ) ).toVar();
    			alb.mulAssign( add( .86, mul( .3, tread ) ) );
    			const ps = p.xz.div( vec2( 2.4, 1.2 ) ).toVar(), pd = min( abs( fract( ps.x.add( .5 ) ).sub( .5 ) ).mul( 2.4 ), abs( fract( ps.y.add( .5 ) ).sub( .5 ) ).mul( 1.2 ) ).toVar();
    			const seam = sub( 1., smoothstep( .008, .025, pd ) ).mul( kxAA( p.xz.mul( 6. ) ) ).toVar();
    			alb.mulAssign( add( .92, mul( .16, h21( floor( ps ).add( sd ) ) ) ).mul( sub( 1., mul( .5, seam ) ) ) );
    			const wear = smoothstep( .52, .7, fbm3( vec3( p.x.mul( .22 ), 1.7, p.z.mul( .22 ) ) ) ).mul( add( .6, mul( .4, n3( p.mul( 3. ) ) ) ) ).toVar();
    			alb.assign( mix( alb, vec3( .3, .29, .28 ).mul( add( .85, mul( .3, tread ) ) ), wear.mul( .75 ) ) );
    			metal.assign( mix( metal, .75, wear ) );
    			rough.assign( mix( rough, .34, wear ) );
    			const oil = smoothstep( .64, .74, fbm3( vec3( p.x.mul( .8 ), 4.1, p.z.mul( .8 ) ) ).mul( .7 ).add( n3( p.mul( 2.3 ) ).mul( .3 ) ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .6, oil ) ) );
    			rough.assign( mix( rough, .22, oil ) );
    			envK.assign( mix( envK, .4, oil ) );
    			const pud = smoothstep( .5, .62, fbm3( vec3( p.x.mul( .35 ), 9.3, p.z.mul( .35 ) ) ) ).mul( smoothstep( .1, .6, uWet ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .3, pud ) ) );
    			rough.assign( mix( rough, .06, pud ) );
    			envK.assign( mix( envK, .85, pud ) );

    		} );

    	} ).Else( () => {

    		alb.assign( mix( alb, vec3( .075, .072, .068 ), mul( .3, fbm3( p.mul( 4. ) ) ).add( mul( .25, up ) ) ) );
    		alb.mulAssign( add( .88, mul( .2, n2( uv.mul( 60. ) ) ).mul( kxAA( uv.mul( 60. ) ) ) ) );
    		rough.assign( .78 );

    	} );

    	// 海上平台的做舊（59–63，21-rig.js；p 是世界座標）：大片褪色與白化、補漆的色塊、每 2.5 m 的橫焊縫與 3 m 的直焊縫、
    	// 焊縫往下流的鏽水、鏽斑與鏽暈、掉漆露出紅丹底漆、底面與浪花帶的鹽霜、頂面的油污、浪花帶的濕暗
    	If( m.greaterThanEqual( 59 ).and( m.lessThanEqual( 63 ) ), () => {

    		const sz = sub( 1., smoothstep( 1.5, 11., p.y ) ).toVar(), dn = sub( 1., smoothstep( -0.85, -0.4, n.y ) ).toVar();
    		const aw = sub( 1., smoothstep( .02, .08, max( max( fwidth( p.x ), fwidth( p.y ) ), fwidth( p.z ) ) ) ).toVar();
    		alb.mulAssign( add( .8, mul( .34, fbm3( p.mul( .31 ).add( 4. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( .78 ).add( vec3( .06, .06, .055 ) ), up.mul( .4 ) ) );
		alb.assign( mix( alb, alb.mul( .6 ).add( vec3( .035, .03, .025 ) ), add( .2, mul( .34, fbm3( p.mul( .5 ).add( 2. ) ) ) ) ) );
		const gs = kxStreak( p, uv, 1.6 ).mul( vert ).toVar();
		alb.assign( mix( alb, alb.mul( vec3( .5, .46, .42 ) ), gs.mul( .5 ) ) );
    		const rp = vec2( uv.x, p.y ).add( vec2( fbm3( p.mul( .8 ) ), fbm3( p.mul( .8 ).add( 5. ) ) ).sub( .5 ).mul( 1.4 ) ).toVar();
    		const ri = floor( rp.div( vec2( 1.9, 1.3 ) ) ).toVar();
    		const pm = step( .82, h21( ri.add( sd.mul( 3.1 ) ).add( 1.7 ) ) ).mul( vert ).toVar();
    		alb.assign( mix( alb, alb.mul( mix( vec3( 1.12, 1.07, .95 ), vec3( .84, .88, .92 ), h21( ri.add( 9.1 ) ) ) ), pm.mul( .85 ) ) );
    		const sy = fract( p.y.div( 2.5 ) ).toVar(), dy = abs( sy.sub( .5 ) ).mul( -2.5 ).add( 1.25 ).toVar(), dx = abs( fract( uv.x.div( 3. ).add( .5 ) ).sub( .5 ) ).mul( 3. ).toVar();
    		const weld = sub( 1., smoothstep( .012, .035, min( dy, dx ) ) ).mul( vert ).mul( aw ).toVar();
    		alb.mulAssign( sub( 1., mul( .35, weld ) ) );
    		const db = sub( 1., sy ).mul( 2.5 ).toVar(), lane = floor( p.y.div( 2.5 ) ).toVar();
    		const col = smoothstep( .5, .82, fbm( vec2( uv.x.mul( 2.7 ).add( lane.mul( 3.7 ) ), p.y.mul( .07 ) ) ) ).mul( add( .55, mul( .45, n2( vec2( uv.x.mul( 19. ), p.y.mul( 1.3 ) ) ) ) ) ).toVar();
    		const run = col.mul( exp( db.mul( mix( 1.6, .45, h21( vec2( floor( uv.x.mul( 1.3 ) ), lane ) ) ) ).negate() ) ).mul( vert ).toVar();
    		const strk = clamp( run.mul( 1.9 ).add( kxStreak( p, uv, 3.2 ).mul( .45 ) ).add( sz.mul( vert ).mul( .25 ).mul( fbm( vec2( uv.x.mul( 5. ), p.y.mul( .4 ) ) ) ) ), 0., 1. ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .6, .36, .21 ) ).add( vec3( .03, .011, .0 ) ), strk.mul( .8 ) ) );
    		const r = fbm3( p.mul( 1.7 ).add( 3. ) ).mul( .78 ).add( mul( .22, n3( p.mul( 13. ) ) ) ).add( weld.mul( .3 ) ).add( sz.mul( .3 ) ).add( dn.mul( .03 ) ).sub( up.mul( .08 ) ).toVar();
    		const rust = smoothstep( .7, .8, r ).toVar(), halo = smoothstep( .58, .7, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .74, .58, .44 ) ), halo.mul( .75 ) ) );
    		alb.assign( mix( alb, mix( vec3( .15, .065, .028 ), vec3( .3, .13, .05 ), n3( p.mul( 29. ) ) ), rust.mul( .92 ) ) );
    		const chip = step( .78, n3( p.mul( 23. ) ).mul( .6 ).add( n3( p.mul( 57. ).add( 2. ) ).mul( .4 ) ).add( sz.mul( .08 ) ) ).mul( aw ).mul( sub( 1., rust ) ).mul( sub( 1., up.mul( .8 ) ) ).mul( sub( 1., dn.mul( .6 ) ) ).toVar();
    		alb.assign( mix( alb, mix( vec3( .3, .11, .065 ), vec3( .34, .33, .31 ), step( .5, n3( p.mul( 7. ) ) ) ), chip.mul( .85 ) ) );
    		const salt = smoothstep( .5, .78, fbm3( p.mul( 2.4 ).add( 1. ) ) ).mul( clamp( dn.mul( .7 ).add( sz.mul( .8 ) ), 0., 1. ) ).toVar();
    		alb.assign( mix( alb, vec3( .55, .56, .53 ), salt.mul( .45 ) ) );
    		const grime = up.mul( smoothstep( .42, .72, fbm3( p.mul( 1.3 ).add( 8. ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .055, .05, .045 ), grime.mul( .45 ) ) );
    		alb.mulAssign( sub( 1., mul( .3, sz ).mul( add( .4, mul( .6, smoothstep( .5, .9, fbm( vec2( uv.x.mul( .8 ), p.y.mul( .9 ) ) ) ) ) ) ) ) );
    		rough.assign( mix( mix( rough, .93, max( rust, mul( .6, salt ) ) ), .3, sz.mul( .5 ).mul( sub( 1., rust ) ) ) );
    		metal.mulAssign( sub( 1., rust ) );
    		envK.mulAssign( sub( 1., rust ).mul( sub( 1., mul( .5, salt ) ) ) );

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

    		If( m.lessThanEqual( 22 ).or( m.equal( 29 ) ).or( m.equal( 34 ) ).or( m.equal( 26 ) ).or( m.equal( 27 ) ), () => {

    			const hg = vW.y.sub( .15 ).toVar(), vt = sub( 1., smoothstep( .5, .8, abs( n.y ) ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .28, sub( 1., smoothstep( 0., .5, hg ) ) ).mul( step( -0.2, hg ) ).mul( vt ).mul( add( .6, mul( .4, n2( vW.xz.mul( 3. ).add( vW.y.mul( 4. ) ) ) ) ) ) ) );

    			If( m.equal( 21 ).or( m.equal( 29 ) ).or( m.equal( 34 ) ), () => {

    				const rb = sub( 1., smoothstep( .06, add( .25, mul( .1, n2( vW.xz.mul( 5. ) ) ) ), hg ) ).mul( step( -0.2, hg ) ).mul( vt ).mul( smoothstep( .3, .55, n2( vW.xz.mul( 7. ).add( vW.y.mul( 9. ) ) ) ) ).toVar();
    				alb.assign( mix( alb, vec3( .12, .065, .035 ), rb.mul( .8 ) ) );
    				metal.mulAssign( sub( 1., rb ) );
    				envK.mulAssign( sub( 1., rb ) );
    				rough.assign( mix( rough, .9, rb ) );

    			} );

    		} );

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
    		c.addAssign( envMapS( r, 1. ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{}": {
  h: "zkqtnpvsb", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uVilA","type":"sampler2DArray","src":"uVilA"},{"name":"uVilN","type":"sampler2DArray","src":"uVilN"},{"name":"uVil","type":"vec4","src":"uVil"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
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
    const { fwidth, max, smoothstep, sub, Fn, bool, vec2, abs, If, floor, fract, mix, mul, mod, step, select, vec3, dot, clamp, property, length, vec4, add, cross, sin, min, cos, mat2, atan, float, div, pow, exp, mat3, Discard, normalize, int, reflect } = TSL;
    const { uM, uFacA, uFac, uVilA, uVilN, uVil, vP, vNo, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const AI = airInt( TSL, E );
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

    // 帷幕玻璃上的雨（材質 53／54／56，航廈與空橋）：下雨時一條條往下流的水痕（18 cm 一欄，亂數決定有沒有水、寬度、彎曲與流速；水頭在下、往上拖淡），
    // 玻璃濕的時候留著靜止的水珠。水底下的室內光壓暗一半，水珠下緣與水痕帶一點亮（像透鏡收到上方的光）。座標是玻璃面上的（水平切線 × 世界高度），
    // 格子比像素小、60 m 外或面不是直立的時候淡掉
    const glassRain = ( e, n ) => {
    	const h1 = ( x ) => { const t = fract( x.mul( .1031 ) ).toVar(); t.mulAssign( t.add( 33.33 ) ); t.mulAssign( t.add( t ) ); return fract( t ); };
    	const q = vW.xz.sub( uAirA.xy ).toVar();
    	const u = dot( q, vec2( n.z, n.x.negate() ) ).toVar(), y = vW.y.toVar();
    	const fw = max( fwidth( u ), fwidth( y ) ).toVar();
    	const fade = sub( 1., smoothstep( .03, .09, fw ) ).mul( sub( 1., smoothstep( 35., 60., length( uCam.sub( vW ) ) ) ) ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	const cu = u.div( .18 ).toVar(), ci = floor( cu ).toVar(), cf = fract( cu ).sub( .5 ).toVar();
    	const ha = h1( ci ).toVar(), hb = h1( ci.add( 71.3 ) ).toVar();
    	const wig = sin( y.mul( 5.3 ).add( ha.mul( 40. ) ) ).mul( .14 ).add( sin( y.mul( 17. ).add( hb.mul( 20. ) ) ).mul( .05 ) ).toVar();
    	const w = mix( .08, .22, hb ).toVar();
    	const ln = smoothstep( w, w.mul( .35 ), abs( cf.sub( wig ) ) ).mul( step( .6, ha ) ).toVar();
    	const s = fract( y.mul( mix( .12, .3, ha ) ).add( uTime.mul( mix( .15, .45, hb ) ) ).add( hb.mul( 9. ) ) ).toVar();
    	const riv = ln.mul( smoothstep( 0., .03, s ) ).mul( mix( 1., .2, s ) ).mul( uRain ).mul( fade ).toVar();
    	const g = vec2( u, y ).div( .09 ).toVar(), gi = floor( g ).toVar(), gf = fract( g ).sub( .5 ).toVar();
    	const hd = h1( gi.x.add( gi.y.mul( 157.1 ) ) ).toVar();
    	const off = vec2( h1( hd.mul( 91.7 ) ), h1( hd.mul( 37.3 ) ) ).sub( .5 ).mul( .45 ).toVar();
    	const rd = mix( .12, .3, h1( hd.mul( 13.1 ) ) ).toVar();
    	const drop = smoothstep( rd, rd.mul( .6 ), length( gf.sub( off ) ) ).mul( step( .74, hd ) ).mul( smoothstep( .1, .5, uWet ) ).mul( fade ).toVar();
    	const lens = drop.mul( smoothstep( .0, -.25, gf.y.sub( off.y ) ) ).add( riv.mul( .3 ) ).toVar();
    	// 整片的水膜：低頻、慢慢往下流的起伏，讓後面的室內光一明一暗（遠處也看得到，不必反鋸齒）
    	const film = sin( u.mul( 3.1 ).add( sin( y.mul( 1.7 ).add( uTime.mul( .8 ) ) ).mul( 1.5 ) ) ).mul( sin( y.mul( .9 ).add( uTime.mul( 1.2 ) ).add( u.mul( .7 ) ) ) ).mul( .14 ).mul( uRain ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	// 中距離的水簾：15 cm 一道、左右擺動的直條，亮暗沿著往下流（25 m 外還看得出是在下雨的玻璃）
    	const sh = smoothstep( .55, 1., sin( u.mul( 40. ).add( sin( y.mul( 2.3 ).add( h1( floor( u.mul( 6.37 ) ) ).mul( 6. ) ) ).mul( 1.2 ) ) ) ).toVar();
    	const sheet = sh.mul( add( .5, sin( y.mul( 1.3 ).add( uTime.mul( 2.5 ) ).add( u.mul( 5. ) ) ).mul( .5 ) ) ).mul( uRain ).mul( sub( 1., smoothstep( .04, .1, fw ) ) ).mul( smoothstep( .4, .15, abs( n.y ) ) ).toVar();
    	lens.addAssign( sheet.mul( .12 ) );
    	return e.mul( add( 1., film ) ).mul( sub( 1., max( max( riv, drop ), sheet.mul( .7 ) ).mul( .5 ) ) ).add( vec3( .5, .55, .6 ).mul( uDay.mul( .25 ).add( uLamp.mul( .05 ) ) ).add( e.mul( 1.5 ) ).mul( lens ) );
    };

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

    		const wetS = clamp( up.mul( .2 ).add( smoothstep( -0.6, -0.95, n.y ).mul( .05 ) ), 0., 1. ).toVar();
    		const r = fbm3( p.mul( 2.6 ).add( 7. ) ).mul( .92 ).add( mul( .14, n3( p.mul( 23. ) ) ) ).add( wetS ).add( vert.mul( .26 ).mul( smoothstep( .55, .9, fbm( vec2( uv.x.mul( 7. ), p.y.mul( .5 ) ) ) ) ) ).toVar();
    		const rust = smoothstep( .66, .8, r ).toVar(), halo = smoothstep( .54, .66, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, vec3( .11, .1, .09 ), mul( .35, fbm3( p.mul( 1.3 ).add( 2. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .75, .62, .5 ) ), halo.mul( .7 ) ) );
    		alb.assign( mix( alb, mix( vec3( .13, .065, .035 ), vec3( .22, .12, .06 ), n3( p.mul( 31. ) ) ), rust.mul( .85 ) ) );
    		const aa = kxAA( uv.mul( 30. ) ).toVar(), chip = step( .84, n3( p.mul( 34. ) ) ).mul( aa ).mul( sub( 1., rust ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .2, .19 ), chip.mul( .8 ) ) );
    		alb.mulAssign( add( .9, mul( .2, aa ).mul( n2( uv.mul( vec2( 90., 6. ) ) ) ) ) );
    		rough.assign( mix( .45, .9, max( rust, mul( .5, chip ) ) ) );
    		metal.assign( mix( .45, .05, rust ) );
    		envK.assign( mul( .28, sub( 1., rust ) ) );

    	} ).ElseIf( m.equal( 22 ).or( m.equal( 63 ) ), () => {

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

    		const pi = floor( uv.x.div( .9 ) ).toVar(), ph = h21( vec2( pi, sd.mul( 7.1 ).add( 3. ) ) ).toVar(), rep = step( .84, h21( vec2( pi, sd.mul( 3.3 ).add( 9. ) ) ) ).mul( vert ).toVar();
    		alb.mulAssign( mix( vec3( 1. ), add( .87, mul( .26, ph ) ).mul( mix( vec3( 1.03, 1., .96 ), vec3( .96, 1., 1.04 ), h21( vec2( pi, 5.7 ) ) ) ), vert ) );
    		alb.assign( mix( alb, alb.mul( vec3( .9, .96, 1.04 ) ).mul( 1.12 ), rep ) );
    		alb.mulAssign( add( 1., mul( .12, vert ).mul( smoothstep( .5, 3., p.y ) ) ) );
    		alb.mulAssign( add( .82, mul( .3, fbm3( p.mul( 2.2 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .1, .1, .095 ), mul( .25, fbm3( p.mul( .9 ).add( 4. ) ) ).mul( sub( 1., mul( .6, rep ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .35, vert ).mul( kxStreak( p, uv, 5. ) ).mul( sub( 1., mul( .6, rep ) ) ) ) );
    		const fx = fract( uv.x.div( .9 ) ).toVar(), seam = vert.mul( sub( 1., smoothstep( .006, .018, min( fx, sub( 1., fx ) ).mul( .9 ) ) ) ).mul( kxAA( uv.mul( 4. ) ) ).toVar();
    		const bolt = vert.mul( smoothstep( .012, .006, length( vec2( min( fx, sub( 1., fx ) ).mul( .9 ).sub( .03 ), fract( p.y.div( .45 ) ).sub( .5 ).mul( .45 ) ) ) ) ).mul( kxAA( uv.mul( 30. ) ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .45, seam ) ).mul( sub( 1., mul( .35, bolt ) ) ) );
    		const chip = step( .9, n3( p.mul( 30. ) ) ).mul( smoothstep( .55, .72, fbm3( p.mul( 2. ).add( 3. ) ) ) ).mul( kxAA( uv.mul( 30. ) ) ).mul( sub( 1., rep ) ).toVar();
    		alb.assign( mix( alb, vec3( .24, .24, .23 ), chip.mul( .7 ) ) );
    		rough.assign( mix( .6, .4, chip ) );
    		metal.assign( mix( .05, .8, chip ) );
    		envK.assign( mix( .12, .4, chip ) );

    	} ).ElseIf( m.equal( 30 ), () => {

    		// 30 橡膠、粗塑膠（2026-11-02 補上：原本沒有這一支，畫成素色）：細顆粒、朝上的面一層灰、霧面
    		alb.mulAssign( add( .86, mul( .24, n3( p.mul( 70. ) ) ).mul( kxAA( uv.mul( 70. ) ) ) ).mul( add( .9, mul( .16, fbm3( p.mul( 1.7 ) ) ) ) ) );
    		alb.assign( mix( alb, alb.add( vec3( .03, .028, .025 ) ), up.mul( .6 ) ) );
    		rough.assign( .9 );
    		envK.assign( .04 );

    	} ).ElseIf( m.equal( 52 ), () => {

    		// 52 間知石（2026-11-02，雲梯城寨擋土牆，參考圖的不規則石塊與青苔）：uv 上 34 × 27 cm 的抖動格子取 Voronoi，F2 − F1 是離石縫多遠；
    		// 石縫 2 cm 暗、往內凹，石面中間凸（邊緣暗一點），每塊石頭亮度與色相各取一個雜湊；石縫與朝上、靠下的地方長青苔，牆面有雨水的垂流
    		const cs = vec2( .34, .27 ), g = uv.div( cs ).toVar(), gi = floor( g ).toVar(), gf = fract( g ).toVar();
    		const d1 = float( 9. ).toVar(), d2 = float( 9. ).toVar(), cid = vec2( 0. ).toVar();
    		for ( let i = - 1; i <= 1; i ++ ) for ( let j = - 1; j <= 1; j ++ ) {
    			const o = vec2( i, j ), c = gi.add( o ), r = vec2( h21( c ), h21( c.add( 17.3 ) ) );
    			const d = length( o.add( .12 ).add( r.mul( .76 ) ).sub( gf ).mul( cs ) );
    			d2.assign( select( d.lessThan( d1 ), d1, min( d2, d ) ) );
    			cid.assign( select( d.lessThan( d1 ), c, cid ) );
    			d1.assign( min( d1, d ) );
    		}
    		const edge = d2.sub( d1 ).toVar(), bv = h21( cid.add( 3.7 ) ).toVar();
    		const mort = sub( 1., smoothstep( .012, .026, edge ) ).toVar();
    		const stone = vec3( 1. ).mul( add( .72, mul( .4, bv ) ) ).mul( mix( vec3( 1.04, 1., .94 ), vec3( .95, .98, 1.04 ), h21( cid.add( 9.1 ) ) ) ).toVar();
    		stone.mulAssign( mix( .72, 1., smoothstep( .02, .09, edge ) ) );
    		stone.mulAssign( add( .86, mul( .26, n3( p.mul( 19. ) ) ).mul( kxAA( uv.mul( 19. ) ) ) ) );
    		alb.assign( alb.mul( mix( stone, vec3( .42, .4, .37 ), mort ) ) );
    		const moss = smoothstep( .5, .75, fbm3( p.mul( 1.3 ).add( 11. ) ).add( mort.mul( .25 ) ).add( up.mul( .2 ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .07, .1, .035 ), moss.mul( .75 ) ) );
    		alb.mulAssign( sub( 1., mul( .25, vert ).mul( smoothstep( .6, .9, fbm3( vec3( uv.x.mul( 6. ), p.y.mul( .4 ), 1.7 ) ) ) ) ) );
    		rough.assign( mix( .82, .95, min( mort.add( moss ), 1. ) ) );
    		envK.assign( .05 );

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

    	} ).ElseIf( m.equal( 55 ).or( m.equal( 62 ) ), () => {

    		// 波浪鋼板（機庫外牆、空橋的裙板；blender/airbld.py）：0.2 m 一道的梯形肋（受光的斜面亮、背光的斜面暗、溝底一條陰影），
    		// 1.2 m 一片的色差、片與片的搭接縫、往下的雨痕與牆腳的髒污、零星的鏽點
    		const q = uv.x.div( .2 ).toVar(), f = fract( q ).toVar(), aa = kxAA( vec2( q, 1. ) ).mul( vert ).toVar();
    		const rib = smoothstep( .0, .1, f ).mul( smoothstep( .5, .4, f ) ).toVar(), dk = smoothstep( .5, .56, f ).mul( smoothstep( .78, .66, f ) ).toVar();
    		alb.mulAssign( mix( 1., add( .8, mul( .28, rib ) ).sub( mul( .22, dk ) ), aa ) );
    		const pn = floor( uv.x.div( 1.2 ) ).toVar();
    		alb.mulAssign( add( .93, mul( .12, h21( vec2( pn, sd.add( 3.7 ) ) ) ) ).mul( mix( 1., sub( 1., mul( .35, kxAA( uv.mul( 2. ) ) ) ), vert.mul( step( .985, fract( uv.x.div( 1.2 ) ) ) ) ) ) );
    		alb.mulAssign( sub( 1., mul( .3, vert ).mul( kxStreak( p, uv, 3.5 ) ) ) );
    		alb.assign( mix( alb, alb.mul( .55 ).mul( vec3( .9, .85, .78 ) ), sub( 1., smoothstep( .0, 1.2, p.y ) ).mul( vert ).mul( .55 ) ) );
    		const rs = smoothstep( .74, .86, fbm3( p.mul( 1.9 ).add( 8. ) ) ).mul( step( .55, n3( p.mul( 17. ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .2, .1, .05 ), rs.mul( .6 ) ) );
    		rough.assign( mix( .42, .75, rs ) );
    		metal.assign( mix( .45, .1, rs ) );
    		envK.assign( mul( .18, rib ).mul( sub( 1., rs ) ) );

    	} ).ElseIf( m.equal( 53 ), () => {

    		// 航廈的帷幕玻璃（blender/airbld.py）：玻璃後面的大廳由 air-int.mjs 算（interior mapping：地板、夾層、店面、座椅、人、天花燈帶），
    		// 白天看得到裡面、入夜是暖白的燈；420 m 外（隔著海的遠景）只剩平均的亮度
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .9, .74 ).mul( uLamp.mul( .2 ) ).add( vec3( .06, .07, .08 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 420. ), () => { emi.assign( mix( AI.hall( p, n, vW ), far, smoothstep( 300., 420., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 56 ), () => {

    		// 第二航廈 T2 的帷幕玻璃（blender/airbld.py 的 term2）：和 53 一樣，大廳是 air-int.mjs 的 hall2（空側出境大廳挑高、陸側入境大廳有夾層）
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .9, .74 ).mul( uLamp.mul( .2 ) ).add( vec3( .06, .07, .08 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 420. ), () => { emi.assign( mix( AI.hall2( p, n, vW ), far, smoothstep( 300., 420., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 54 ), () => {

    		// 機場的小房間玻璃（blender/airbld.py）：空橋通道、塔台基座、機庫工作間，房間由 air-int.mjs 算；260 m 外只剩平均的亮度
    		alb.assign( vec3( .02, .026, .032 ) );
    		rough.assign( .04 );
    		metal.assign( 0. );
    		envK.assign( 1. );
    		const dc = length( uCam.sub( vW ) ).toVar(), far = vec3( 1., .95, .86 ).mul( uLamp.mul( .16 ) ).add( vec3( .05, .055, .06 ).mul( uDay ) ).toVar();
    		emi.assign( far );
    		If( dc.lessThan( 260. ), () => { emi.assign( mix( AI.room( p, n, vW ), far, smoothstep( 180., 260., dc ) ) ); } );
    		emi.assign( glassRain( emi, n ) );

    	} ).ElseIf( m.equal( 49 ), () => {

    		const g = fract( p.xz.div( 1.6 ) ).sub( .5 ).toVar();
    		const d = length( g ).mul( 1.6 ).toVar(), dn = step( n.y, -0.5 ).toVar();
    		// 低角度看時一個像素蓋好幾格：點與光暈照像素的足跡（公尺）淡成整格的平均（點 ≈ 0.005、光暈 ≈ 0.4），不然遠處是同心圓的疊紋
    		const fw = max( fwidth( p.x ), fwidth( p.z ) ).toVar();
    		const dotL = mix( smoothstep( .075, .055, d ), .005, smoothstep( .012, .04, fw ) ).mul( dn ).toVar(), halo = mix( exp( d.negate().mul( d ).mul( 3. ) ), .4, smoothstep( .12, .45, fw ) ).mul( dn ).toVar();
    		alb.mulAssign( add( .9, mul( .1, fbm3( p.mul( 2. ) ) ) ).sub( mul( .25, dotL ) ) );
    		rough.assign( .9 );
    		emi.assign( vec3( 1., .78, .52 ).mul( dotL.mul( 2.6 ).add( halo.mul( .22 ) ) ).mul( uLampOn ) );

    	} ).ElseIf( m.equal( 57 ), () => {

    		// 內照式標誌牌（blender/airbld.py 的滑行道指示牌）：白天是頂點色的壓克力面板，入夜裡面的燈管把面板打亮
    		rough.assign( .3 );
    		emi.assign( alb.mul( uLampOn.mul( .6 ) ) );

    	} ).ElseIf( m.equal( 58 ), () => {

    		// 地勤車的烤漆（blender/airgse.py 的 m58_*；p 是世界座標，機場地面 y ≈ 0）：大片髒污的深淺、細碎掉漆露出灰底漆、零星鏽斑、
    		// 離地 1.3 m 內往下變濃的濺泥（只在直立面；車身下緣約離地 0.5 m）、頂面積灰；掉漆與鏽的細節照世界座標的像素足跡在遠處淡掉（kxAA 的 uv 在車身上變化太快，近處也會被淡掉）
    		const aa = sub( 1., smoothstep( .015, .05, max( max( fwidth( p.x ), fwidth( p.y ) ), fwidth( p.z ) ) ) ).toVar(), low = smoothstep( 1.3, .25, p.y ).toVar(), patch = fbm3( p.mul( 1.2 ) ).sub( .5 ).toVar();
    		const chip = smoothstep( .69, .73, n3( p.mul( 13. ) ).mul( .55 ).add( n3( p.mul( 31. ).add( 3. ) ).mul( .45 ) ).add( patch.mul( .5 ) ).add( low.mul( .08 ) ) ).mul( aa ).toVar();
    		const rust = smoothstep( .7, .76, n3( p.mul( 7.3 ).add( 11. ) ).mul( .6 ).add( n3( p.mul( 19. ) ).mul( .4 ) ).add( patch.mul( .4 ) ).add( low.mul( .12 ) ) ).mul( aa ).toVar();
    		alb.mulAssign( add( .86, mul( .22, fbm3( p.mul( 1.1 ) ) ) ) );
    		alb.assign( mix( alb, vec3( .16, .16, .155 ), chip.mul( .85 ) ) );
    		alb.assign( mix( alb, mix( vec3( .12, .055, .025 ), vec3( .2, .1, .045 ), n3( p.mul( 27. ) ) ), rust.mul( .8 ) ) );
    		const mud = vert.mul( low ).mul( smoothstep( .35, .6, fbm3( vec3( p.x.mul( 2.2 ), p.y.mul( 6. ), p.z.mul( 2.2 ) ) ).add( low.mul( .25 ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .05, .042, .03 ), mud.mul( .85 ) ) );
    		alb.assign( mix( alb, alb.mul( vec3( .9, .88, .84 ) ).add( .02 ), up.mul( .5 ) ) );
    		rough.assign( mix( .42, .9, max( max( chip, rust ), mud ) ) );
    		envK.assign( mul( .25, sub( 1., max( rust, mud ) ) ) );

    	} ).ElseIf( m.equal( 59 ), () => {

    		// 海上平台的塗漆鋼（21-rig.js）：環氧面漆的半光、細橘皮；掉漆、鏽、鹽、焊縫在後面的做舊（59–63 共用）
    		alb.mulAssign( add( .95, mul( .1, n3( p.mul( 9. ) ) ).mul( kxAA( uv.mul( 9. ) ) ) ) );
    		rough.assign( .5 );
    		metal.assign( .08 );
    		envK.assign( .2 );

    	} ).ElseIf( m.equal( 60 ), () => {

    		// 導管架與浪花帶（21-rig.js；p 是世界座標，海面 y −1.6，浪頂到 +3）：水線附近一圈海藻、藤壺、貽貝，濕滑
    		rough.assign( .55 );
    		metal.assign( .08 );
    		envK.assign( .15 );
    		const wl = add( .6, fbm3( p.mul( .55 ) ).mul( 1.8 ) ).toVar();
    		const gr = sub( 1., smoothstep( wl.sub( .9 ), wl, p.y ) ).toVar();
    		const alg = mix( vec3( .03, .045, .028 ), vec3( .075, .09, .035 ), fbm3( p.mul( 3.1 ) ) ).toVar();
    		const mus = smoothstep( .52, .66, fbm3( p.mul( 4.3 ).add( 6. ) ) ).mul( sub( 1., smoothstep( wl.sub( 1.6 ), wl.sub( .5 ), p.y ) ) ).toVar();
    		const bq = uv.mul( 5.5 ).toVar(), bi = floor( bq ).toVar(), bf = fract( bq ).sub( .5 ).toVar(), bh = h21( bi.add( 2.3 ) ).toVar();
    		const bo = vec2( h21( bi.add( 7.1 ) ), h21( bi.add( 3.9 ) ) ).sub( .5 ).mul( .3 ).toVar(), bd = length( bf.sub( bo ) ).toVar(), br = mix( .2, .34, bh ).toVar();
    		const barn = sub( 1., smoothstep( br.mul( .7 ), br, bd ) ).mul( step( .35, bh ) ).mul( kxAA( bq ) ).toVar();
    		const bcol = vec3( .46, .45, .41 ).mul( add( .55, mul( .45, smoothstep( br.mul( .15 ), br.mul( .45 ), bd ) ) ) ).toVar();
    		alb.assign( mix( alb, alg, gr.mul( .92 ) ) );
    		alb.assign( mix( alb, vec3( .018, .022, .03 ), mus.mul( .9 ) ) );
    		alb.assign( mix( alb, bcol, barn.mul( gr ).mul( sub( 1., mus ) ).mul( .85 ) ) );
    		rough.assign( mix( rough, mix( .32, .7, barn ), gr ) );
    		envK.assign( mix( envK, .3, gr.mul( sub( 1., barn ) ) ) );

    	} ).ElseIf( m.equal( 61 ), () => {

    		// 甲板鋼板（21-rig.js）：頂面是防滑花紋板（3.2 cm 一格、斜向交錯的凸條）、2.4×1.2 m 的板縫、走出來的磨亮路徑、油漬、下雨時的積水；側面當一般鋼板
    		rough.assign( .62 );
    		metal.assign( .3 );
    		envK.assign( .18 );
    		If( up.greaterThan( .5 ), () => {

    			const q = p.xz.div( .032 ).toVar(), qi = floor( q ).toVar(), qf = fract( q ).sub( .5 ).toVar();
    			const dg = select( mod( qi.x.add( qi.y ), 2. ).lessThan( .5 ), qf.x.add( qf.y ), qf.x.sub( qf.y ) ).toVar();
    			const tread = sub( 1., smoothstep( .07, .16, abs( dg ) ) ).mul( sub( 1., smoothstep( .3, .44, max( abs( qf.x ), abs( qf.y ) ) ) ) ).mul( kxAA( q ) ).toVar();
    			alb.mulAssign( add( .86, mul( .3, tread ) ) );
    			const ps = p.xz.div( vec2( 2.4, 1.2 ) ).toVar(), pd = min( abs( fract( ps.x.add( .5 ) ).sub( .5 ) ).mul( 2.4 ), abs( fract( ps.y.add( .5 ) ).sub( .5 ) ).mul( 1.2 ) ).toVar();
    			const seam = sub( 1., smoothstep( .008, .025, pd ) ).mul( kxAA( p.xz.mul( 6. ) ) ).toVar();
    			alb.mulAssign( add( .92, mul( .16, h21( floor( ps ).add( sd ) ) ) ).mul( sub( 1., mul( .5, seam ) ) ) );
    			const wear = smoothstep( .52, .7, fbm3( vec3( p.x.mul( .22 ), 1.7, p.z.mul( .22 ) ) ) ).mul( add( .6, mul( .4, n3( p.mul( 3. ) ) ) ) ).toVar();
    			alb.assign( mix( alb, vec3( .3, .29, .28 ).mul( add( .85, mul( .3, tread ) ) ), wear.mul( .75 ) ) );
    			metal.assign( mix( metal, .75, wear ) );
    			rough.assign( mix( rough, .34, wear ) );
    			const oil = smoothstep( .64, .74, fbm3( vec3( p.x.mul( .8 ), 4.1, p.z.mul( .8 ) ) ).mul( .7 ).add( n3( p.mul( 2.3 ) ).mul( .3 ) ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .6, oil ) ) );
    			rough.assign( mix( rough, .22, oil ) );
    			envK.assign( mix( envK, .4, oil ) );
    			const pud = smoothstep( .5, .62, fbm3( vec3( p.x.mul( .35 ), 9.3, p.z.mul( .35 ) ) ) ).mul( smoothstep( .1, .6, uWet ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .3, pud ) ) );
    			rough.assign( mix( rough, .06, pud ) );
    			envK.assign( mix( envK, .85, pud ) );

    		} );

    	} ).Else( () => {

    		alb.assign( mix( alb, vec3( .075, .072, .068 ), mul( .3, fbm3( p.mul( 4. ) ) ).add( mul( .25, up ) ) ) );
    		alb.mulAssign( add( .88, mul( .2, n2( uv.mul( 60. ) ) ).mul( kxAA( uv.mul( 60. ) ) ) ) );
    		rough.assign( .78 );

    	} );

    	// 海上平台的做舊（59–63，21-rig.js；p 是世界座標）：大片褪色與白化、補漆的色塊、每 2.5 m 的橫焊縫與 3 m 的直焊縫、
    	// 焊縫往下流的鏽水、鏽斑與鏽暈、掉漆露出紅丹底漆、底面與浪花帶的鹽霜、頂面的油污、浪花帶的濕暗
    	If( m.greaterThanEqual( 59 ).and( m.lessThanEqual( 63 ) ), () => {

    		const sz = sub( 1., smoothstep( 1.5, 11., p.y ) ).toVar(), dn = sub( 1., smoothstep( -0.85, -0.4, n.y ) ).toVar();
    		const aw = sub( 1., smoothstep( .02, .08, max( max( fwidth( p.x ), fwidth( p.y ) ), fwidth( p.z ) ) ) ).toVar();
    		alb.mulAssign( add( .8, mul( .34, fbm3( p.mul( .31 ).add( 4. ) ) ) ) );
    		alb.assign( mix( alb, alb.mul( .78 ).add( vec3( .06, .06, .055 ) ), up.mul( .4 ) ) );
		alb.assign( mix( alb, alb.mul( .6 ).add( vec3( .035, .03, .025 ) ), add( .2, mul( .34, fbm3( p.mul( .5 ).add( 2. ) ) ) ) ) );
		const gs = kxStreak( p, uv, 1.6 ).mul( vert ).toVar();
		alb.assign( mix( alb, alb.mul( vec3( .5, .46, .42 ) ), gs.mul( .5 ) ) );
    		const rp = vec2( uv.x, p.y ).add( vec2( fbm3( p.mul( .8 ) ), fbm3( p.mul( .8 ).add( 5. ) ) ).sub( .5 ).mul( 1.4 ) ).toVar();
    		const ri = floor( rp.div( vec2( 1.9, 1.3 ) ) ).toVar();
    		const pm = step( .82, h21( ri.add( sd.mul( 3.1 ) ).add( 1.7 ) ) ).mul( vert ).toVar();
    		alb.assign( mix( alb, alb.mul( mix( vec3( 1.12, 1.07, .95 ), vec3( .84, .88, .92 ), h21( ri.add( 9.1 ) ) ) ), pm.mul( .85 ) ) );
    		const sy = fract( p.y.div( 2.5 ) ).toVar(), dy = abs( sy.sub( .5 ) ).mul( -2.5 ).add( 1.25 ).toVar(), dx = abs( fract( uv.x.div( 3. ).add( .5 ) ).sub( .5 ) ).mul( 3. ).toVar();
    		const weld = sub( 1., smoothstep( .012, .035, min( dy, dx ) ) ).mul( vert ).mul( aw ).toVar();
    		alb.mulAssign( sub( 1., mul( .35, weld ) ) );
    		const db = sub( 1., sy ).mul( 2.5 ).toVar(), lane = floor( p.y.div( 2.5 ) ).toVar();
    		const col = smoothstep( .5, .82, fbm( vec2( uv.x.mul( 2.7 ).add( lane.mul( 3.7 ) ), p.y.mul( .07 ) ) ) ).mul( add( .55, mul( .45, n2( vec2( uv.x.mul( 19. ), p.y.mul( 1.3 ) ) ) ) ) ).toVar();
    		const run = col.mul( exp( db.mul( mix( 1.6, .45, h21( vec2( floor( uv.x.mul( 1.3 ) ), lane ) ) ) ).negate() ) ).mul( vert ).toVar();
    		const strk = clamp( run.mul( 1.9 ).add( kxStreak( p, uv, 3.2 ).mul( .45 ) ).add( sz.mul( vert ).mul( .25 ).mul( fbm( vec2( uv.x.mul( 5. ), p.y.mul( .4 ) ) ) ) ), 0., 1. ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .6, .36, .21 ) ).add( vec3( .03, .011, .0 ) ), strk.mul( .8 ) ) );
    		const r = fbm3( p.mul( 1.7 ).add( 3. ) ).mul( .78 ).add( mul( .22, n3( p.mul( 13. ) ) ) ).add( weld.mul( .3 ) ).add( sz.mul( .3 ) ).add( dn.mul( .03 ) ).sub( up.mul( .08 ) ).toVar();
    		const rust = smoothstep( .7, .8, r ).toVar(), halo = smoothstep( .58, .7, r ).sub( rust ).toVar();
    		alb.assign( mix( alb, alb.mul( vec3( .74, .58, .44 ) ), halo.mul( .75 ) ) );
    		alb.assign( mix( alb, mix( vec3( .15, .065, .028 ), vec3( .3, .13, .05 ), n3( p.mul( 29. ) ) ), rust.mul( .92 ) ) );
    		const chip = step( .78, n3( p.mul( 23. ) ).mul( .6 ).add( n3( p.mul( 57. ).add( 2. ) ).mul( .4 ) ).add( sz.mul( .08 ) ) ).mul( aw ).mul( sub( 1., rust ) ).mul( sub( 1., up.mul( .8 ) ) ).mul( sub( 1., dn.mul( .6 ) ) ).toVar();
    		alb.assign( mix( alb, mix( vec3( .3, .11, .065 ), vec3( .34, .33, .31 ), step( .5, n3( p.mul( 7. ) ) ) ), chip.mul( .85 ) ) );
    		const salt = smoothstep( .5, .78, fbm3( p.mul( 2.4 ).add( 1. ) ) ).mul( clamp( dn.mul( .7 ).add( sz.mul( .8 ) ), 0., 1. ) ).toVar();
    		alb.assign( mix( alb, vec3( .55, .56, .53 ), salt.mul( .45 ) ) );
    		const grime = up.mul( smoothstep( .42, .72, fbm3( p.mul( 1.3 ).add( 8. ) ) ) ).toVar();
    		alb.assign( mix( alb, vec3( .055, .05, .045 ), grime.mul( .45 ) ) );
    		alb.mulAssign( sub( 1., mul( .3, sz ).mul( add( .4, mul( .6, smoothstep( .5, .9, fbm( vec2( uv.x.mul( .8 ), p.y.mul( .9 ) ) ) ) ) ) ) ) );
    		rough.assign( mix( mix( rough, .93, max( rust, mul( .6, salt ) ) ), .3, sz.mul( .5 ).mul( sub( 1., rust ) ) ) );
    		metal.mulAssign( sub( 1., rust ) );
    		envK.mulAssign( sub( 1., rust ).mul( sub( 1., mul( .5, salt ) ) ) );

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

    		If( m.lessThanEqual( 22 ).or( m.equal( 29 ) ).or( m.equal( 34 ) ).or( m.equal( 26 ) ).or( m.equal( 27 ) ), () => {

    			const hg = vW.y.sub( .15 ).toVar(), vt = sub( 1., smoothstep( .5, .8, abs( n.y ) ) ).toVar();
    			alb.mulAssign( sub( 1., mul( .28, sub( 1., smoothstep( 0., .5, hg ) ) ).mul( step( -0.2, hg ) ).mul( vt ).mul( add( .6, mul( .4, n2( vW.xz.mul( 3. ).add( vW.y.mul( 4. ) ) ) ) ) ) ) );

    			If( m.equal( 21 ).or( m.equal( 29 ) ).or( m.equal( 34 ) ), () => {

    				const rb = sub( 1., smoothstep( .06, add( .25, mul( .1, n2( vW.xz.mul( 5. ) ) ) ), hg ) ).mul( step( -0.2, hg ) ).mul( vt ).mul( smoothstep( .3, .55, n2( vW.xz.mul( 7. ).add( vW.y.mul( 9. ) ) ) ) ).toVar();
    				alb.assign( mix( alb, vec3( .12, .065, .035 ), rb.mul( .8 ) ) );
    				metal.mulAssign( sub( 1., rb ) );
    				envK.mulAssign( sub( 1., rb ) );
    				rough.assign( mix( rough, .9, rb ) );

    			} );

    		} );

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
    		c.addAssign( envMapS( r, 1. ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
