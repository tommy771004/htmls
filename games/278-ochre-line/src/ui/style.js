// 版面用 --u 等比縮放（1920×1080 設計稿的 1px）。顏色：深赭底塊、暖白字、鏽紅與銅綠標隊伍。
export const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;--u:max(min(100vw/1920,100vh/1080),.5px);--xc:#f6f1e4;--xl:8;--xg:6;--xw:2;font-variant-numeric:tabular-nums;color:#f2e9d8;text-shadow:0 1px 2px #0009;overflow:hidden}
#ui *{box-sizing:border-box}
.h-b{position:absolute;background:#17130ed9}
#radar{left:calc(28*var(--u));top:calc(28*var(--u));width:calc(300*var(--u));height:calc(300*var(--u));border-radius:50%;background:#17130e;overflow:hidden}
#radar canvas{width:100%;height:100%;display:block}
#zone{position:absolute;left:calc(28*var(--u));top:calc(336*var(--u));width:calc(300*var(--u));text-align:center;font-size:max(11px,calc(19*var(--u)));font-weight:600;text-shadow:0 1px 3px #000}
#top{position:absolute;left:50%;top:0;transform:translateX(-50%);display:grid;grid-template-columns:calc(250*var(--u)) calc(92*var(--u)) calc(164*var(--u)) calc(92*var(--u)) calc(250*var(--u));align-items:stretch;height:calc(74*var(--u))}
#top>div{display:flex;align-items:center;justify-content:center}
#top .sc{flex-direction:column;color:#17130e;text-shadow:none;line-height:1}
#top .sc b{font-size:calc(36*var(--u));font-weight:700}#top .sc small{font-size:max(10px,calc(14*var(--u)));font-weight:600;margin-top:calc(3*var(--u))}
#top .sa{background:#C4552D}#top .sd{background:#5FA89A}
#clock{background:#17130ee0;font-size:calc(40*var(--u));font-weight:700}
#clock.hot{background:#8f2317}
.roster{gap:calc(5*var(--u));background:#17130eb0}
.roster i{display:block;width:calc(30*var(--u));height:calc(40*var(--u));background:var(--c);clip-path:polygon(30% 0,70% 0,70% 34%,100% 42%,100% 100%,0 100%,0 42%,30% 34%)}
.roster i.x{opacity:.2}
.ic{display:inline-block;flex:none;background:currentColor;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat}
#strip{position:absolute;left:0;right:0;bottom:0;padding:calc(46*var(--u)) calc(30*var(--u)) calc(20*var(--u));display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:calc(22*var(--u));background:linear-gradient(to top,#0f0b07d9,#0f0b0780 58%,#0f0b0700)}
#strip .sd{display:flex;align-items:center;gap:calc(24*var(--u));min-width:0}
#money{font-size:calc(30*var(--u));font-weight:700;color:#e6c98a}
.nb{display:flex;align-items:baseline;gap:calc(7*var(--u))}
.nb b{font-size:calc(52*var(--u));font-weight:700;line-height:1}
.nb span{font-size:max(11px,calc(17*var(--u)));color:#cdbfa7;white-space:nowrap}
.nb.low b{color:#f0553a}
.ln{flex:1;min-width:0;height:calc(4*var(--u));background:#f2e9d82e;position:relative;overflow:hidden}
.ln b{position:absolute;inset:0;background:#D8A24A;transform-origin:left center}
.ln.r b{transform-origin:right center}
.ln.low b{background:#f0553a}
#emblem{width:calc(58*var(--u));height:calc(58*var(--u));display:flex;align-items:center;justify-content:center;background:var(--c);color:#17130e;text-shadow:none;font-size:calc(24*var(--u));font-weight:800;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
#wn{display:none}
#rack{position:absolute;right:calc(30*var(--u));bottom:calc(128*var(--u));display:flex;flex-direction:column;align-items:flex-end;gap:calc(4*var(--u));color:#d9cbb0}
#rack .w{display:flex;align-items:center;gap:calc(12*var(--u));height:calc(44*var(--u));padding:0 calc(10*var(--u)) 0 calc(14*var(--u));background:#17130ea8;font-size:max(11px,calc(17*var(--u)));font-weight:600}
#rack .w.on{color:#fffaf0;background:#17130ee0}
#rack .w s{text-decoration:none;font-size:max(10px,calc(15*var(--u)));color:#a99a80;order:3;width:calc(16*var(--u));text-align:right}
#rack .w.on s{color:#D8A24A}
#rack .ic{width:calc(118*var(--u));height:calc(38*var(--u));-webkit-mask-position:right center;mask-position:right center}
#rack .n .ic{width:calc(34*var(--u));height:calc(36*var(--u))}#rack .n .ic.off{opacity:.55}
#log{position:absolute;left:calc(30*var(--u));bottom:calc(128*var(--u));display:flex;flex-direction:column;gap:calc(3*var(--u));font-size:max(11px,calc(18*var(--u)));max-width:calc(620*var(--u))}
#log div{align-self:flex-start;padding:calc(3*var(--u)) calc(11*var(--u));background:#17130ec4;color:#e9dfcc}#log div.g{color:#e6c98a;font-weight:600}
#dpanel{position:absolute;left:50%;bottom:calc(215*var(--u));width:min(92vw,max(300px,calc(470*var(--u))));transform:translateX(-50%);display:none;color:#f6ead0;background:#17130ee8;padding:calc(16*var(--u)) calc(22*var(--u)) calc(18*var(--u));pointer-events:none;transition:opacity .45s var(--ease-out,ease-out),transform .45s var(--ease-out,ease-out)}#hudroot.dead #dpanel{display:block}#dpanel:not(.on){opacity:0;transform:translate(-50%,10px)}#dpanel .dp-h{margin:0 0 calc(6*var(--u));font-size:max(11px,calc(15*var(--u)));color:#b9aa8e}#dpanel .dp-k{display:flex;align-items:center;gap:calc(12*var(--u));font-size:max(13px,calc(18*var(--u)))}#dpanel .dp-k b{font-size:max(17px,calc(30*var(--u)));font-weight:800;margin-right:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#dpanel .dp-k .ic{width:max(54px,calc(96*var(--u)));height:max(18px,calc(32*var(--u)));color:#f6ead0}#dpanel .dp-k em{font-style:normal;font-weight:700;color:#17130e;background:#e6c98a;padding:0 .4em}#dpanel .dp-hp{display:flex;align-items:center;gap:calc(12*var(--u));margin-top:calc(10*var(--u));font-size:max(11px,calc(16*var(--u)));color:#d9cbb0}#dpanel .dp-hp i{flex:1;height:max(4px,calc(7*var(--u)));background:#f6ead01f}#dpanel .dp-hp i b{display:block;height:100%}#dpanel .dp-d{display:grid;grid-template-columns:1fr 1fr;gap:calc(14*var(--u));margin-top:calc(14*var(--u));padding-top:calc(12*var(--u));border-top:1px solid #f6ead01a}#dpanel .dp-d div{display:grid;grid-template-columns:auto 1fr;align-items:baseline;column-gap:calc(10*var(--u))}#dpanel .dp-d span{grid-column:1/-1;font-size:max(11px,calc(15*var(--u)));color:#b9aa8e}#dpanel .dp-d b{font-size:max(18px,calc(32*var(--u)));font-weight:800;font-variant-numeric:tabular-nums}#dpanel .dp-d small{font-size:max(11px,calc(15*var(--u)));color:#d9cbb0}#dpanel.nok .dp-h,#dpanel.nok .dp-hp,#dpanel.nok .dp-d{display:none}#sbar{position:absolute;left:50%;bottom:calc(150*var(--u));transform:translateX(-50%);display:none;align-items:baseline;gap:calc(14*var(--u));max-width:92vw;white-space:nowrap;color:#f6ead0;background:#17130ed9;padding:calc(9*var(--u)) calc(20*var(--u));pointer-events:none}#hudroot.dead #sbar{display:flex}#sbar small{font-size:max(11px,calc(15*var(--u)));color:#b9aa8e}#sbar b{font-size:max(15px,calc(24*var(--u)));font-weight:800}#sbar span{font-size:max(11px,calc(15*var(--u)));color:#b9aa8e;overflow:hidden;text-overflow:ellipsis}#hudroot.dead:not(.fp) #cross,#hudroot.dead:not(.fp) #rack{display:none!important}#hudroot.dead #hint{display:none}
#feed{position:absolute;right:calc(28*var(--u));top:calc(40*var(--u));display:flex;flex-direction:column;align-items:flex-end;gap:calc(5*var(--u))}
#feed div{display:flex;align-items:center;gap:calc(10*var(--u));background:#17130ed8;padding:calc(5*var(--u)) calc(13*var(--u));font-size:max(11px,calc(19*var(--u)));box-shadow:none}
#feed div.me{box-shadow:inset 0 0 0 calc(2*var(--u)) #D8A24A}
#feed u{text-decoration:none;font-weight:700}#feed .ic{width:calc(82*var(--u));height:calc(28*var(--u));transform:scaleX(-1);color:#f2e9d8}
#feed em{font-style:normal;font-size:max(10px,calc(14*var(--u)));font-weight:700;color:#e6c98a}
#rwin{position:absolute;left:50%;top:calc(120*var(--u));width:min(92vw,calc(780*var(--u)));transform:translateX(-50%);display:none;text-align:center;text-shadow:none}
#rwin h3{margin:0;padding:calc(12*var(--u)) calc(20*var(--u));background:var(--c);color:#17130e;font-size:max(20px,calc(42*var(--u)));font-weight:800;line-height:1.15}
#rwin h3 small{display:block;font-size:max(12px,calc(20*var(--u)));font-weight:600;margin-top:calc(3*var(--u))}
#rwin p{margin:0;padding:calc(10*var(--u)) calc(20*var(--u));background:#17130ee8;color:#f2e9d8;font-size:max(12px,calc(21*var(--u)))}
#rwin p b{color:#e6c98a;margin:0 calc(8*var(--u))}
#banner{position:absolute;left:0;right:0;top:calc(190*var(--u));text-align:center;font-size:calc(38*var(--u));font-weight:700;text-shadow:0 2px 6px #000c}
.xh{position:absolute;left:50%;top:50%;width:0;height:0;--xa:calc(var(--xl)*var(--u));--xgp:calc(var(--xg)*var(--u) + var(--xd,0px));--xwd:max(1px,calc(var(--xw)*var(--u)))}
.xh i{position:absolute;background:var(--xc);box-shadow:0 0 0 1px #0007}
.xh i:nth-child(1){left:calc(var(--xwd)/-2);top:calc(-1*(var(--xgp) + var(--xa)));width:var(--xwd);height:var(--xa)}
.xh i:nth-child(2){left:calc(var(--xwd)/-2);top:var(--xgp);width:var(--xwd);height:var(--xa)}
.xh i:nth-child(3){top:calc(var(--xwd)/-2);left:calc(-1*(var(--xgp) + var(--xa)));height:var(--xwd);width:var(--xa)}
.xh i:nth-child(4){top:calc(var(--xwd)/-2);left:var(--xgp);height:var(--xwd);width:var(--xa)}
#fpsr{position:absolute;right:calc(30*var(--u));top:calc(4*var(--u));display:flex;align-items:baseline;gap:.3em;font-size:max(12px,calc(18*var(--u)));font-weight:600;color:#e6c98a;font-variant-numeric:tabular-nums;text-shadow:0 1px 2px #0009;pointer-events:none}#fpsr b{font-weight:700;color:#f6ead0;min-width:2.1em;text-align:right}#fpsr span{opacity:.75;margin-right:.35em}#fpsr small{font-size:.8em;opacity:.7}
#hit{position:absolute;left:50%;top:50%;width:calc(40*var(--u));height:calc(40*var(--u));margin:calc(-20*var(--u)) 0 0 calc(-20*var(--u));opacity:0;background:linear-gradient(45deg,transparent 46%,#fff 46% 54%,transparent 54%),linear-gradient(-45deg,transparent 46%,#fff 46% 54%,transparent 54%);clip-path:polygon(0 0,35% 0,50% 35%,65% 0,100% 0,100% 35%,65% 50%,100% 65%,100% 100%,65% 100%,50% 65%,35% 100%,0 100%,0 65%,35% 50%,0 35%)}
#hurt{position:absolute;left:50%;top:50%;width:calc(560*var(--u));height:calc(560*var(--u));margin:calc(-280*var(--u)) 0 0 calc(-280*var(--u));opacity:0}
#hurt i{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -32deg,#d23a2000,#d23a20 16deg 48deg,#d23a2000 64deg,transparent 0);-webkit-mask:radial-gradient(closest-side,transparent calc(100% - 22*var(--u)),#000 calc(100% - 21*var(--u)));mask:radial-gradient(closest-side,transparent calc(100% - 22*var(--u)),#000 calc(100% - 21*var(--u)))}
#flash{position:absolute;inset:0;background:#fff;opacity:0}
#scope{position:absolute;inset:0;display:none}
#scope .r{position:absolute;inset:0;background:radial-gradient(circle at center,transparent 0 calc(420*var(--u)),#000 calc(424*var(--u)))}
#scope .x{position:absolute;left:0;right:0;top:50%;height:1px;background:#000}#scope .y{position:absolute;top:0;bottom:0;left:50%;width:1px;background:#000}
#prog{position:absolute;left:50%;top:62%;width:calc(380*var(--u));margin-left:calc(-190*var(--u));display:none}
#prog p{margin:0 0 calc(6*var(--u));text-align:center;font-size:calc(21*var(--u))}#prog div{height:calc(10*var(--u));background:#17130ee0}#prog b{display:block;height:100%;width:0;background:#e6c98a}
#hint{position:absolute;left:0;right:0;bottom:calc(150*var(--u));text-align:center;font-size:max(13px,calc(21*var(--u)))}
#hudroot{position:absolute;inset:0;display:none}
body.buying #hudroot{visibility:hidden}
.pn{position:absolute;inset:0;pointer-events:auto;background:#120e0ae6;display:none;align-items:center;justify-content:center;text-shadow:none}
.pn .box{width:min(92vw,calc(1100*var(--u) + 420px));max-height:94vh;overflow:auto;padding:clamp(18px,3vw,44px)}
.pn h1{font-size:clamp(40px,7vw,84px);margin:0;font-weight:800;letter-spacing:.02em}
.pn .box h2{font-size:clamp(22px,3vw,32px);margin:0 0 14px}
.pn .box p{color:#d9cbb0;line-height:1.65;font-size:clamp(14px,1.6vw,17px);margin:14px 0}
.pn .box button{font:inherit;font-weight:700;border:0;border-radius:2px;cursor:pointer;color:#17130e;padding:13px 22px;font-size:clamp(16px,1.8vw,20px);background:#e8dcc4}
.pn .box button:hover{background:#fff}.pn .box button.q{background:none;color:#cdbfa7;font-weight:500;padding:13px 6px}.pn .box button.q:hover{background:none;color:#fffaf0}
.pn .row{display:flex;gap:12px 18px;flex-wrap:wrap;align-items:center;margin:22px 0 4px}
.pn label{display:block;margin:12px 0;color:#d9cbb0}.pn input[type=range]{width:100%;accent-color:#C4552D}
#buy{position:absolute;inset:0;pointer-events:auto;display:none;flex-direction:column;background:#120e0ae0;padding:clamp(12px,3.4vh,40px) clamp(12px,3vw,56px);text-shadow:none;overflow:auto}
#buy header{display:flex;align-items:baseline;gap:clamp(14px,2vw,30px);margin-bottom:clamp(10px,2vh,20px)}
#buy header h2{margin:0;font-size:clamp(22px,2.4vw,32px);font-weight:800}
#buy header .t{color:#cdbfa7;font-size:clamp(13px,1.2vw,16px)}#buy header .t b{color:#f2e9d8;font-size:1.25em;margin-left:.3em}#buy header .t.hot b{color:#f0553a}
#buy header .m{color:#e6c98a;font-size:clamp(20px,2.2vw,30px);font-weight:700}
#buy header button{margin-left:auto;font:inherit;font-weight:700;border:0;border-radius:2px;background:#e8dcc4;color:#17130e;padding:8px 14px;font-size:15px;cursor:pointer}
#buy header button:hover{background:#fff}
#buy .body{--h3:clamp(14px,1.15vw,17px);flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) clamp(250px,21vw,330px);gap:clamp(12px,1.6vw,26px);align-content:center}
#buy .cols{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:clamp(6px,.7vw,10px)}
#buy .col h3{display:flex;align-items:baseline;gap:7px;margin:0 0 8px;height:calc(var(--h3)*1.4);line-height:1.4;font-size:var(--h3);font-weight:700;color:#d9cbb0;white-space:nowrap}
#buy .col h3 s{text-decoration:none;color:#D8A24A}#buy .col.sel h3{color:#fffaf0}
#buy .it{position:relative;display:block;width:100%;height:clamp(92px,15.5vh,136px);margin-bottom:clamp(6px,.7vw,10px);border:0;border-radius:2px;background:#2a2219;color:#f2e9d8;font:inherit;text-align:left;cursor:pointer;padding:0}
#buy .it:last-child{margin-bottom:0}
#buy .it:hover,#buy .it.pick{background:#433626}
#buy .it s{position:absolute;left:9px;top:6px;text-decoration:none;font-size:13px;color:#a99a80}
#buy .it .ic{position:absolute;left:10%;right:10%;top:22px;bottom:50px;width:auto;height:auto;color:#e9dfcc}
#buy .it .sp{position:absolute;left:9px;right:9px;top:27px;font-size:clamp(14px,1.15vw,17px);font-weight:700;color:#e9dfcc;line-height:1.25}
#buy .it .nm{position:absolute;left:9px;right:9px;bottom:7px;display:flex;flex-direction:column;gap:1px;font-size:clamp(12px,.95vw,14px);line-height:1.25;font-weight:600;white-space:nowrap}
#buy .it .nm span{overflow:hidden;text-overflow:ellipsis}
#buy .it em{font-style:normal;color:#e6c98a}
#buy .it.no{cursor:default}#buy .it.no .ic,#buy .it.no .sp,#buy .it.no span{opacity:.42}#buy .it.no em{color:#f0553a}
#buy .it.own{cursor:default;background:#1d1812}#buy .it.own em{color:#a7c8ae}
#buy .info{margin-top:calc(var(--h3)*1.4 + 8px);background:#1d1812;padding:clamp(12px,1.3vw,20px);display:flex;flex-direction:column;min-width:0}
#buy .info .ic{width:100%;height:clamp(70px,11vh,110px);color:#f2e9d8;margin-bottom:12px}
#buy .info h3{margin:0;font-size:clamp(18px,1.6vw,23px);font-weight:800}
#buy .info .pr{color:#e6c98a;font-weight:700;font-size:clamp(15px,1.2vw,18px);margin-top:3px}
#buy .info p{margin:10px 0 12px;color:#d9cbb0;font-size:clamp(13px,1vw,15px);line-height:1.6}
#buy .info dl{margin:auto 0 0;display:grid;grid-template-columns:auto 1fr auto;gap:7px 10px;align-items:center;font-size:clamp(12px,.95vw,14px)}
#buy .info dt{color:#cdbfa7}#buy .info dd{margin:0}#buy .info dd.v{min-width:3.2em;text-align:right;color:#f2e9d8}
#buy .info .tr{height:5px;background:#f2e9d826;position:relative}#buy .info .tr b{position:absolute;left:0;top:0;bottom:0;background:#D8A24A}
#buy footer{margin-top:clamp(8px,1.6vh,18px);color:#a99a80;font-size:13px;display:flex;gap:22px;flex-wrap:wrap}#buy footer b{color:#d9cbb0;font-weight:700;margin-right:5px}
@media (max-width:980px) and (orientation:portrait){#buy .body{display:block;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;margin-right:-6px;padding-right:6px}#buy .cols{grid-template-columns:1fr}#buy .info,#buy footer{display:none}#buy .col{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px}#buy .col h3{grid-column:1/-1;margin:0}#buy .it{margin:0;height:104px}}
@media (max-height:520px){#buy{padding:8px 12px}#buy header{margin-bottom:4px}#buy .body{grid-template-columns:1fr}#buy .info,#buy footer{display:none}#buy .col h3{margin-bottom:3px;font-size:13px}#buy .it{height:calc((100vh - 96px)/3);min-height:66px;margin-bottom:4px}#buy .it .ic{top:16px;bottom:36px}#buy .it s{left:7px;top:3px}#buy .it .sp{left:7px;right:4px;top:22px;font-size:12px;line-height:1.2}#buy .it .nm{left:7px;right:4px;bottom:3px;font-size:12px;letter-spacing:-.02em}}
#board{position:absolute;left:50%;top:calc(170*var(--u));width:calc(760*var(--u));margin-left:calc(-380*var(--u));background:#17130ee8;padding:calc(18*var(--u)) calc(24*var(--u));display:none;font-size:calc(21*var(--u))}
#board table{width:100%;border-collapse:collapse}#board td{padding:calc(5*var(--u)) calc(8*var(--u))}#board td+td{text-align:right}#board tr.dead{opacity:.45}#board tr.t td{font-weight:700;padding-top:calc(12*var(--u))}
.tc{position:absolute;pointer-events:auto;touch-action:none;display:none;align-items:center;justify-content:center;border-radius:50%;background:#17130e8c;color:#f2e9d8;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;--s:40px;width:var(--s);height:var(--s)}
.tc::after{content:'';position:absolute;inset:-5px;border-radius:50%}.tc svg{width:56%;height:56%;pointer-events:none;display:block}.tc.on:not(.k-stick){background:#f2e9d8;color:#17130e}
.k-stick{--s:120px;left:5vw;bottom:96px}.k-buy{left:5vw;bottom:236px}
.k-fire{--s:66px;right:14px;bottom:100px;color:#e6c98a}.k-fire svg{width:46%;height:46%}.tc.k-fire.on{background:#e6c98a}
.k-jump{right:90px;bottom:113px}.k-reload{right:140px;bottom:113px}.k-use{right:190px;bottom:113px}
.k-crouch{right:27px;bottom:176px}.k-scope{right:27px;bottom:226px}.k-swap{right:27px;bottom:276px}
@media (max-width:379px){.k-use{right:27px;bottom:326px}}
@media (min-aspect-ratio:1/1) and (max-height:520px){.k-stick{bottom:56px}.k-buy{left:calc(5vw + 132px);bottom:56px}.k-fire{bottom:56px;right:max(14px,env(safe-area-inset-right))}.k-jump,.k-reload,.k-use{bottom:69px}.k-crouch{bottom:132px}.k-scope{bottom:182px}.k-swap{bottom:232px}}
@media (pointer:coarse){body.playing .tc{display:flex}}
@media (hover:hover) and (pointer:fine) and (min-aspect-ratio:1/1){#dpanel{left:calc(28*var(--u));bottom:calc(112*var(--u));width:max(300px,calc(430*var(--u)));transform:none}#dpanel:not(.on){transform:translateY(10px)}#hudroot.dead #log{bottom:calc(372*var(--u))}}
.tc.buy{display:none!important}body.buying .tc{display:none!important}body.playing.canbuy .tc.buy{display:flex!important}body.playing.canbuy.buying .tc.buy{display:none!important}
@media (hover:hover) and (pointer:fine){.tc.buy,body.playing.canbuy .tc.buy{display:none!important}body.buying .tc{display:none!important}}
.pn.main{--g:clamp(8px,1.5vw,24px);--lw:clamp(214px,23vw,370px);--rw:clamp(170px,17vw,290px);--nav:clamp(44px,6.4vh,62px);--p:#17130ed9;--p2:#2a2219;--p3:#433626;--mut:#a99a80;--sec:#cdbfa7;flex-direction:column;align-items:stretch;justify-content:flex-start;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);background:linear-gradient(90deg,#120e0a8c 0,#120e0a00 34%,#120e0a00 74%,#120e0a59 100%);font-size:15px}
.pn.main:not([data-tab=play]):not([data-tab=team]){background:linear-gradient(90deg,#120e0ae6 0,#120e0ac4 56%,#120e0a00 82%)}
.pn.main button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pn.main button:focus-visible,.m-exit:focus-visible{outline:2px solid #e6c98a;outline-offset:-2px}
.pn.main h2,.pn.main h3,.pn.main p{margin:0}
.m-sil{display:inline-block;flex:none;width:1em;height:1.32em;background:var(--c);clip-path:polygon(30% 0,70% 0,70% 34%,100% 42%,100% 100%,0 100%,0 42%,30% 34%)}
.m-cut{clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
.m-nav{position:relative;z-index:2;flex:none;height:var(--nav);display:flex;align-items:stretch;padding:0 var(--g);background:#17130eeb}
.pn.main .m-logo{flex:0 0 calc(var(--lw) - 4px);display:flex;align-items:baseline;gap:.5em;align-self:center;font-size:clamp(20px,1.9vw,28px);font-weight:800;letter-spacing:.06em;line-height:1;white-space:nowrap}
.m-logo small{font-size:.46em;font-weight:500;color:var(--sec);letter-spacing:.14em}
.m-tabs{flex:1;display:flex;justify-content:center;min-width:0}
.pn.main .m-tabs button{min-width:44px;padding:0 clamp(6px,1.5vw,24px);font-size:clamp(14px,1.2vw,18px);color:var(--sec);transition:color .16s}
.pn.main .m-tabs button:hover{color:#fffaf0}
.pn.main .m-tabs button[aria-selected=true]{color:#fffaf0;font-weight:700}
.m-narrow{display:none}
.m-exit{flex:0 0 auto;display:flex;align-items:center;gap:7px;padding:0 4px 0 12px;min-width:44px;justify-content:flex-end;color:var(--sec);text-decoration:none;font-size:clamp(13px,1vw,15px);transition:color .16s}
.m-exit:hover{color:#fffaf0}.m-exit svg{width:20px;height:20px}
.m-line{position:absolute;left:0;right:0;top:100%;height:10px;background:#D8A24A;clip-path:polygon(0 0,100% 0,100% 2px,0 2px);transition:clip-path .26s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.m-body{position:relative;flex:1;min-height:0}
.m-page{position:absolute;inset:0;display:none;padding:var(--g)}
.main[data-tab=play] #p-play,.main[data-tab=team] #p-play{display:grid}
.main[data-tab=net] #p-net,.main[data-tab=arms] #p-arms,.main[data-tab=brief] #p-brief,.main[data-tab=keys] #p-keys,.main[data-tab=set] #p-set,.main[data-tab=about] #p-about{display:block}
#p-play{grid-template-columns:var(--lw) minmax(0,1fr) var(--rw);column-gap:var(--g)}
#p-play .m-left{grid-column:1}#p-play .m-right{grid-column:3}
.m-left{display:flex;flex-direction:column;gap:clamp(4px,.7vh,8px);min-height:0}
.m-right{display:flex;flex-direction:column;gap:6px;min-height:0}
#m-rec{background:var(--p);padding:clamp(8px,1.5vh,16px) clamp(12px,1.2vw,18px)}
#m-rec h2{font-size:clamp(13px,.95vw,15px);font-weight:500;color:var(--sec)}
#m-rec .big{font-size:clamp(22px,2.4vw,36px);font-weight:800;line-height:1.2;color:#e6c98a}
#m-rec p{font-size:clamp(12px,.9vw,14px);color:var(--sec);margin-top:2px}
.m-modes{display:flex;flex-direction:column;gap:2px;background:#17130e8c}
.pn.main .m-mode{display:grid;grid-template-columns:auto 1fr 18px;align-items:center;gap:clamp(8px,.8vw,12px);width:100%;min-height:clamp(40px,6.4vh,62px);padding:4px clamp(10px,1vw,16px);background:var(--p);text-align:left;font-size:clamp(14px,1.15vw,17px);transition:background .14s}
.pn.main .m-mode:hover{background:var(--p2)}
.pn.main .m-mode[aria-checked=true]{background:var(--p3)}
.m-mode .m-sil{font-size:clamp(13px,1.1vw,17px)}
.m-mode span{min-width:0}.m-mode b{display:block;font-weight:600;line-height:1.25}
.m-mode small{display:block;font-size:clamp(12px,.82vw,13px);color:var(--sec);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-chk{width:18px;height:18px;color:#e6c98a;visibility:hidden}.m-mode[aria-checked=true] .m-chk{visibility:visible}
.pn.main #m-go{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-height:clamp(52px,9.4vh,88px);padding:4px clamp(14px,1.3vw,20px);background:#D8A24A;color:#17130e;text-align:left;transition:background .14s}
.pn.main #m-go:hover{background:#e6c98a}.pn.main #m-go:active{background:#c08c38}
#m-go b{display:block;font-size:clamp(20px,1.9vw,30px);font-weight:800;line-height:1.15;letter-spacing:.04em}
#m-go small{display:block;font-size:clamp(12px,.9vw,14px);font-weight:600;color:#3b2c16}
.m-gno{flex:none;width:clamp(26px,2.5vw,38px);height:clamp(26px,2.5vw,38px);transition:transform .18s cubic-bezier(.2,.8,.2,1)}
#m-go:hover .m-gno{transform:translateX(5px)}
#m-card{margin-top:auto;display:flex;gap:clamp(10px,1vw,14px);align-items:center;background:var(--p);padding:clamp(8px,1.3vh,14px) clamp(12px,1.2vw,18px)}
#m-card>.m-sil{font-size:clamp(26px,2.5vw,38px)}
#m-card>div{flex:1;min-width:0}
#m-card>div>b{display:block;font-size:clamp(15px,1.25vw,19px);font-weight:700;line-height:1.2}
#m-card small{display:block;font-size:clamp(12px,.85vw,13px);color:var(--sec);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-bar{height:4px;background:#f2e9d82e;margin:4px 0 3px}.m-bar b{display:block;height:100%;background:#D8A24A}
#m-roster{flex:0 1 auto;min-height:0;overflow:auto;background:var(--p);padding:clamp(8px,1.5vh,16px) clamp(10px,1vw,16px)}
#m-roster h2{font-size:clamp(14px,1.1vw,17px);font-weight:700}
#m-roster h3{display:flex;align-items:center;gap:7px;font-size:clamp(12px,.9vw,14px);font-weight:600;color:var(--sec);margin-top:clamp(6px,1.6vh,16px)}
#m-roster h3 .m-sil{display:none}
#m-roster ol{list-style:none;margin:clamp(2px,.6vh,6px) 0 0;padding:0}
#m-roster li{display:flex;align-items:center;gap:9px;min-height:clamp(20px,3.5vh,34px);font-size:clamp(13px,1vw,15px)}
#m-roster li .m-sil{font-size:clamp(10px,1vw,15px)}
#m-roster li span{flex:1;min-width:0}#m-roster li small{font-size:clamp(11px,.8vw,12px);color:var(--mut)}
#m-roster li.me{font-weight:700}#m-roster li.me small{color:#e6c98a}
.m-foot{flex:none;margin-top:auto!important;padding:clamp(5px,.9vh,10px) clamp(10px,1vw,16px);background:var(--p);font-size:clamp(11px,.78vw,12px);line-height:1.45;color:var(--sec)}
.m-foot span{display:block;color:#e6c98a}
.m-sheet{max-height:100%;width:min(100%,62vw + 40px);overflow:auto;overscroll-behavior:contain;padding:clamp(12px,2.2vh,28px) clamp(14px,1.8vw,30px);background:var(--p);text-shadow:none;touch-action:pan-y;-webkit-overflow-scrolling:touch}
.m-sheet h2{font-size:clamp(18px,1.6vw,24px);font-weight:800;margin-bottom:8px!important}
.m-sheet p{color:#d9cbb0;line-height:1.65;font-size:clamp(14px,1.05vw,16px)}
.m-sheet dl{margin:0}
.m-arms{display:grid;grid-template-columns:minmax(0,1fr) clamp(200px,21vw,300px);gap:var(--g);align-items:start}
.m-group{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-bottom:clamp(8px,1.4vh,14px)}
.m-group h3{grid-column:1/-1;font-size:clamp(13px,1vw,15px);font-weight:600;color:var(--sec)}
.pn.main .m-tile{display:grid;grid-template-rows:auto minmax(0,1fr) auto;height:clamp(76px,12vh,108px);padding:5px 9px 6px;background:var(--p2);text-align:left;font-size:clamp(12px,.92vw,14px);transition:background .14s}
.pn.main .m-tile:hover{background:#33291d}.pn.main .m-tile[aria-pressed=true]{background:var(--p3)}
.m-tile .ic,.m-tile .sp{min-height:0;width:100%;height:100%;color:#e9dfcc}
.m-tile .sp{display:flex;align-items:center;font-weight:700;font-size:clamp(13px,1vw,15px)}
.m-tile span{white-space:nowrap;letter-spacing:-.01em}.m-tile em{font-style:normal;color:#e6c98a;text-align:right;line-height:1.1}
.m-info{position:sticky;top:0;background:#1d1812;padding:clamp(10px,1.1vw,18px)}
.m-info .ic{display:block;width:100%;height:clamp(52px,9vh,96px);color:#f2e9d8;margin-bottom:8px}
.m-info h3{font-size:clamp(16px,1.4vw,21px);font-weight:800}
.m-info .pr{color:#e6c98a;font-weight:700;margin-top:2px}
.m-info p{margin-top:6px!important;font-size:clamp(13px,.95vw,15px);line-height:1.55}
.m-info dl{margin-top:10px;display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;font-size:clamp(12px,.9vw,14px)}
.m-info dt{color:var(--sec)}.m-info dd{margin:0}.m-info dd.v{min-width:3.2em;text-align:right}
.m-info .tr{height:5px;background:#f2e9d826;position:relative}.m-info .tr b{position:absolute;left:0;top:0;bottom:0;background:#D8A24A}
.m-brief{display:grid;grid-template-columns:minmax(0,auto) minmax(220px,1fr);gap:var(--g);align-items:start}
.m-map{position:relative;width:min(calc(100vh - var(--nav) - 3*var(--g) - 40px),34vw);aspect-ratio:1;min-width:200px;overflow:hidden;background:#17130e}
.m-map img{display:block;width:100%;height:100%;filter:saturate(.8) brightness(.8)}
.m-map u{position:absolute;display:flex;align-items:center;justify-content:center;text-decoration:none;font-weight:800;font-size:clamp(14px,1.4vw,22px);background:#C4552D66;color:#fff4e6;text-shadow:0 1px 2px #0009}
.m-map em{position:absolute;transform:translate(-50%,-50%);font-style:normal;font-weight:700;font-size:clamp(12px,.9vw,14px);padding:1px 6px;white-space:nowrap;background:var(--c);color:#17130e}
.m-brief p{margin-bottom:10px!important}
.m-brief dl{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;font-size:clamp(13px,1vw,15px)}
.m-brief dt{color:var(--sec)}.m-brief dd{margin:0}
.n-sheet{width:min(100%,880px)}
.n-sheet>p{max-width:44em}
.n-form{display:grid;gap:8px;margin-top:clamp(10px,2vh,20px);max-width:560px}
.n-sheet input{font:inherit;font-size:clamp(15px,1.1vw,17px);color:#f2e9d8;background:#0d0a07;border:1px solid #f2e9d833;border-radius:0;padding:0 12px;height:44px;min-width:0}
.n-sheet input:focus{outline:2px solid #e6c98a;outline-offset:-2px;border-color:transparent}
.n-acts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;margin-top:6px}
.n-join{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0}
.pn.main .n-sheet button{min-height:44px;padding:0 18px;background:var(--p3);color:#f2e9d8;font-weight:700;white-space:nowrap;transition:background .14s}
.pn.main .n-sheet button:hover:not(:disabled){background:#584631}
.pn.main .n-sheet button:disabled{opacity:.45;cursor:default}
.pn.main .n-sheet .n-main{background:#D8A24A;color:#17130e}
.pn.main .n-sheet .n-main:hover:not(:disabled){background:#e6c98a}
.n-st{font-size:13px;color:var(--mut)}
.n-err{color:#f0a283!important;font-size:14px!important;margin-top:10px!important}
.n-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.n-head>div{flex:1 1 220px}
.pn.main .n-head h2{margin:0!important}
.n-code{font-size:1.3em;letter-spacing:.12em;color:#e6c98a;font-variant-numeric:tabular-nums}
.n-info{font-size:14px!important;color:var(--sec)!important;margin:10px 0 0!important}
.n-info b{color:#e6c98a}
.n-teams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--g);margin-top:clamp(10px,2vh,18px)}
.n-team{display:flex;flex-direction:column;background:#f2e9d80a;padding:10px 12px 12px}
.n-team h3{display:flex;align-items:baseline;gap:8px;font-size:clamp(15px,1.15vw,18px);font-weight:800}
.n-team h3 .m-sil{font-size:.9em;align-self:center}
.n-team h3 small{margin-left:auto;font-size:12px;font-weight:500;color:var(--mut)}
.n-team ol{list-style:none;margin:8px 0 10px;padding:0;flex:1}
.n-team li{display:flex;align-items:center;gap:9px;min-height:34px;border-top:1px solid #f2e9d812;font-size:clamp(14px,1vw,15px)}
.n-team li .m-sil{font-size:12px}
.n-team li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.n-team li small{font-size:12px;color:var(--mut)}
.n-team li.bot{color:var(--mut)}.n-team li.bot .m-sil{background:#f2e9d840}
.n-team li.me{font-weight:700}.n-team li.me small{color:#e6c98a}
.n-wait{font-size:13px!important;color:var(--sec)!important;margin-top:10px!important}
.n-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:clamp(12px,2vh,18px);font-size:14px;color:var(--sec)}
.pn.main .n-foot .n-main{min-height:52px;padding:0 28px;font-size:clamp(17px,1.4vw,21px);font-weight:800;letter-spacing:.04em}
@media (max-width:560px){.n-teams{grid-template-columns:1fr}.n-acts{grid-template-columns:1fr}}
.m-keys{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--g)}
.m-keys table{border-collapse:collapse;font-size:clamp(13px,1.05vw,16px)}
.m-keys td{padding:clamp(2px,.5vh,5px) 16px clamp(2px,.5vh,5px) 0;color:#d9cbb0;vertical-align:baseline}
.m-keys kbd{font:inherit;font-weight:700;color:#f2e9d8;white-space:nowrap}
.pn.main .m-set{position:relative;width:min(100%,900px);display:flex;flex-direction:column;padding:0;overflow:hidden}
.m-shead{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:8px clamp(14px,2vw,32px);padding:clamp(12px,2vh,22px) clamp(14px,1.8vw,26px) 4px}
.pn.main .m-shead h2{margin:0!important}
.m-stabs{display:flex;gap:2px;min-width:0;max-width:100%;overflow-x:auto;scrollbar-width:none}
.pn.main .m-stabs button{flex:none;min-height:40px;min-width:44px;padding:0 clamp(12px,1.2vw,18px);color:var(--sec);font-size:clamp(14px,1.05vw,16px);transition:background .14s,color .14s}
.pn.main .m-stabs button:hover{color:#fffaf0;background:var(--p2)}
.pn.main .m-stabs button[aria-selected=true]{color:#fffaf0;font-weight:700;background:var(--p3)}
.m-sbody{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:0 clamp(14px,1.8vw,26px) 14px}
.m-sec{display:none}
.m-set[data-st=game] [data-sec=game],.m-set[data-st=mouse] [data-sec=mouse],.m-set[data-st=video] [data-sec=video],.m-set[data-st=audio] [data-sec=audio],.m-set[data-st=cross] [data-sec=cross],.m-set[data-st=data] [data-sec=data]{display:block}
.pn.main .m-sh{font-size:13px;font-weight:600;color:var(--mut);margin:clamp(12px,2vh,20px) 0 6px}
.m-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(200px,44%);align-items:center;gap:6px 20px;min-height:54px;padding:6px 14px;margin-bottom:2px;background:#f2e9d80a;transition:background .14s}
.m-row:hover{background:#f2e9d814}
.pn.main .m-lab{display:block;margin:0;color:#f2e9d8;font-size:clamp(14px,1.05vw,16px);line-height:1.3}
.m-lab small{display:block;font-size:12px;color:var(--mut);margin-top:2px}
.m-snote{font-size:13px;line-height:1.65;color:var(--mut);margin:12px 0 0;max-width:44em}
.m-ctl{min-width:0;display:flex;justify-content:flex-end;align-items:center}
.m-ctl.m-sl{display:grid;grid-template-columns:minmax(0,1fr) 68px;gap:12px}
.m-val{font-weight:600;color:#e6c98a}
.m-set input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:36px;margin:0;background:none;cursor:pointer;--f:.5}
.m-set input[type=range]::-webkit-slider-runnable-track{height:4px;background:linear-gradient(90deg,#D8A24A calc(5px + (100% - 10px)*var(--f)),#f2e9d82e calc(5px + (100% - 10px)*var(--f)))}
.m-set input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:22px;margin-top:-9px;border:0;background:#f2e9d8}
.m-set input[type=range]:hover::-webkit-slider-thumb,.m-set input[type=range]:active::-webkit-slider-thumb{background:#fffaf0}
.m-set input[type=range]::-moz-range-track{height:4px;background:#f2e9d82e}
.m-set input[type=range]::-moz-range-progress{height:4px;background:#D8A24A}
.m-set input[type=range]::-moz-range-thumb{width:10px;height:22px;border:0;border-radius:0;background:#f2e9d8}
.m-set input:focus-visible,.m-set select:focus-visible{outline:2px solid #e6c98a;outline-offset:2px}
.m-set input[type=number]{width:100%;height:36px;box-sizing:border-box;padding:0 6px;border:0;border-radius:0;background:#0e0b08;color:#f2e9d8;font:inherit;font-weight:600;font-variant-numeric:tabular-nums;text-align:center;-moz-appearance:textfield}
.m-set input[type=number]::-webkit-inner-spin-button,.m-set input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.m-set select{-webkit-appearance:none;appearance:none;width:auto;min-width:120px;max-width:100%;height:40px;padding:0 34px 0 12px;border:0;border-radius:0;background:transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23e6c98a' stroke-width='2'/%3E%3C/svg%3E") no-repeat right 12px center/12px 8px;color:#f2e9d8;font:inherit;font-weight:600;cursor:pointer;text-align-last:right;transition:background-color .14s}
.m-set select:hover{background-color:#0e0b0899}
.m-set option{background:#1d1812;color:#f2e9d8}
.m-xp{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:clamp(10px,1.6vh,16px)}
.m-xp>div{position:relative;height:clamp(110px,20vh,180px);background-size:360px;background-position:center;overflow:hidden}
.m-xp span{position:absolute;left:10px;top:8px;font-size:12px;font-weight:700;color:#fffaf0;text-shadow:0 1px 2px #000c}
.pn.main #m-clear{min-height:40px;padding:0 16px;background:var(--p3);font-weight:600;transition:background .14s}
.pn.main #m-clear:not(:disabled):hover{background:#54432f}.pn.main #m-clear:disabled{cursor:default;color:var(--mut);background:var(--p2)}
.m-sfoot{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:2px 6px;padding:6px clamp(10px,1.4vw,22px) 6px clamp(14px,1.8vw,26px);background:#120e0a99}
.pn.main .m-sfoot p{margin-right:auto;font-size:12px;line-height:1.4;color:var(--mut)}
.pn.main .m-sfoot button{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;font-weight:700;color:#f2e9d8;transition:background .14s,color .14s}
.pn.main .m-sfoot button:not(:disabled):hover{background:var(--p2);color:#fffaf0}
.pn.main .m-sfoot button:disabled{color:#a99a8099;cursor:default}
.m-sfoot svg{flex:none;width:20px;height:20px;transition:transform .3s cubic-bezier(.2,.8,.2,1)}
#m-reset:hover svg{transform:rotate(-50deg)}#m-undo:not(:disabled):hover svg{transform:translateX(-3px)}
.m-ask{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;padding:16px;background:#0d0a07cc}
.m-ask[hidden]{display:none}
.m-ask>div{width:min(100%,380px);padding:20px 22px 16px;background:var(--p3);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
.m-ask b{display:block;font-size:17px;line-height:1.35}
.pn.main .m-ask p{margin:6px 0 16px;font-size:14px;color:var(--sec)}
.m-askr{display:flex;justify-content:flex-end;gap:6px}
.pn.main #m-asky{min-height:44px;padding:0 22px;background:#D8A24A;color:#17130e;font-weight:800;transition:background .14s}.pn.main #m-asky:hover{background:#e6c98a}
.pn.main #m-askn{min-height:44px;padding:0 14px;font-weight:600;transition:background .14s}.pn.main #m-askn:hover{background:#54432f}
@media (max-width:620px){.m-row{grid-template-columns:minmax(0,1fr);padding:8px 12px}.m-ctl{justify-content:stretch}.m-set select{width:100%;background-color:#0e0b0899}.m-sfoot{justify-content:flex-end;padding-top:8px}.pn.main .m-sfoot p{flex-basis:100%;margin-right:0}.m-xp>div{height:110px}}
@media (max-height:520px){.m-shead{padding-top:8px}.m-xp>div{height:84px}.pn.main .m-sh{margin-top:8px}.m-row{min-height:48px}}
.m-about{max-width:760px}
.m-about h3{font-size:clamp(14px,1.1vw,16px);font-weight:700;margin-top:14px;color:#e6c98a}
@media (prefers-reduced-motion:no-preference){
.m-page>.m-sheet{animation:m-in .22s cubic-bezier(.2,.8,.2,1)}
.m-left>*{animation:m-in .3s cubic-bezier(.2,.8,.2,1)}.m-right{animation:m-in-r .3s cubic-bezier(.2,.8,.2,1)}
@keyframes m-in{from{transform:translateX(-12px)}}@keyframes m-in-r{from{transform:translateX(12px)}}
}
@media (prefers-reduced-motion:reduce){.m-line,.m-gno{transition:none}.pn.main *{animation:none}}
@media (max-aspect-ratio:1/1){
.pn.main{--g:10px;--nav:48px;background:linear-gradient(to top,#120e0ad9 0,#120e0a99 42%,#120e0a00 62%)}
.pn.main:not([data-tab=play]){background:#120e0ab3}
.m-sheet{background:#17130ef0}
.m-group{grid-template-columns:repeat(2,minmax(0,1fr))}
.m-nav{padding:0 4px}.pn.main .m-logo{position:absolute;left:14px;top:calc(100% + 16px);font-size:34px;text-shadow:0 1px 3px #000c;pointer-events:none}.m-logo small{color:#f2e9d8}.main:not([data-tab=play]) .m-logo{display:none!important}.m-narrow{display:block}
.pn.main .m-tabs{justify-content:space-between}.pn.main .m-tabs button{flex:1;padding:0;min-width:0}
.m-exit{padding:0 8px;min-width:44px}.m-exit span{display:none}
#p-play{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto}
#p-play .m-left{grid-column:1;grid-row:1;justify-content:flex-end;gap:6px}
#p-play .m-right{grid-column:1;grid-row:2;margin-top:6px}
#m-roster{display:none}
.main[data-tab=team] #m-roster{display:block;margin-top:0}
.main[data-tab=team] .m-left{display:none}
.main[data-tab=team] #p-play{grid-template-rows:minmax(0,1fr) auto}
.main[data-tab=team] .m-right{grid-row:1/3;margin-top:0}
.m-foot{font-size:11px;padding:5px 10px}
.m-foot span{display:inline;margin-right:.8em}
#m-card{margin-top:0;order:3}
.m-modes{flex-direction:row;gap:2px}
.pn.main .m-mode{flex:1;min-width:0;grid-template-columns:auto 1fr 16px;min-height:48px;padding:4px 8px;gap:6px}
.m-mode small{display:none}.m-chk{width:16px;height:16px}
.pn.main #m-go{min-height:62px}
#m-rec{padding:8px 12px}#m-rec .big{font-size:22px}
.m-sheet{width:100%}
.m-arms{grid-template-columns:minmax(0,1fr)}.m-info{order:-1;top:calc(-1*clamp(12px,2.2vh,28px));z-index:1;display:grid;grid-template-columns:96px 1fr;gap:0 10px}.m-info .ic{height:64px;margin:0}.m-info i[style*=none]+div{grid-column:1/-1}.m-info dl{grid-column:1/-1}.m-info p{font-size:13px}
.m-brief{grid-template-columns:minmax(0,1fr)}.m-map{width:100%;min-width:0}
.m-keys{grid-template-columns:minmax(0,1fr)}
}
@media (min-aspect-ratio:1/1) and (max-height:520px){
.pn.main{--g:8px;--nav:40px;--lw:clamp(196px,27vw,240px);--rw:clamp(150px,22vw,200px)}
.pn.main .m-logo{flex:0 0 auto;margin-right:8px}.m-logo small{display:none}
.pn.main .m-tabs button{padding:0 8px;font-size:14px}.m-exit span{display:none}
.m-left{gap:3px}
#m-rec{padding:4px 10px}#m-rec h2{display:none}#m-rec .big{font-size:16px}#m-rec p{font-size:12px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pn.main .m-mode{min-height:32px;padding:1px 10px}.m-mode b{display:inline}.m-mode small{display:none}
.pn.main #m-go{min-height:46px}#m-go b{font-size:18px}#m-go small{display:none}
#m-card{padding:5px 10px}#m-card>div>b{display:none}#m-card>.m-sil{font-size:20px}#m-card small{font-size:12px}
#m-roster{padding:5px 8px}#m-roster h2{display:none}#m-roster h3{margin-top:3px;font-size:12px}#m-roster h3:first-of-type{margin-top:0}#m-roster ol{margin:0}#m-roster li{min-height:18px;font-size:12px;gap:6px}#m-roster li .m-sil{font-size:9px}
.m-foot{font-size:11px}
.m-sheet{width:min(100%,70vw);padding:10px 14px}
.m-keys,.m-arms,.m-brief{gap:12px}
.m-map{width:min(calc(100vh - var(--nav) - 40px),30vw);min-width:170px}
.pn.main .m-tile{height:66px;padding:3px 7px 4px}
.m-arms{grid-template-columns:minmax(0,1fr) 170px}
.m-group{margin-bottom:6px}
}
@media (max-aspect-ratio:1/1) and (max-height:700px){#m-rec{display:none}.m-logo small{display:none}#m-card{padding:6px 12px}#m-card>div>b{display:none}.pn.main #m-go{min-height:56px}}
@media (max-height:340px){#m-rec{display:none}.m-foot span{display:none}#m-roster li{min-height:16px}.m-foot{padding:3px 8px}}
@media (max-aspect-ratio:1/1){#ui{--u:.5px}.roster,#emblem,#rack,.ln{display:none!important}#top{left:auto;right:8px;transform:none;grid-template-columns:calc(92*var(--u)) calc(164*var(--u)) calc(92*var(--u))}#strip{grid-template-columns:auto 1fr;padding:18px 12px 12px;gap:8px}#strip .sd{gap:10px}#hint{bottom:auto;top:36%}#rwin{top:300px}#strip .sd:last-child{justify-content:flex-end}#log{left:14px;bottom:auto;top:190px;max-width:62vw}#feed{top:58px;right:8px;max-width:58vw}#fpsr{top:calc(74*var(--u) + 4px);right:8px;font-size:11px}#wn{display:block;font-size:11px;color:#cdbfa7;margin-right:6px}}
@media (min-aspect-ratio:1/1) and (max-width:1000px){.roster,#rack{display:none!important}#top{grid-template-columns:calc(92*var(--u)) calc(164*var(--u)) calc(92*var(--u))}#strip{padding:12px 16px 8px;grid-template-columns:1fr auto 1fr;gap:10px}#strip .sd{gap:10px}#log{display:none}}
`;
