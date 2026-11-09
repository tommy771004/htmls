#!/usr/bin/env node
// 279 黃昏月台: generates every Japanese-text texture (signs, LED boards, placards, clock, 駅名標, posters) as PNG.
//   node tools/tex.mjs            -> all textures into tex/*.png (HTML sources in tex/src/)
//   node tools/tex.mjs led poster -> only textures whose name contains one of the words
// HTML/CSS pages are screenshotted with chrome-headless-shell; canvas pages (LED dot matrix, scroll bitmap) are
// exported exactly with --dump-dom + toDataURL so their pixel size is exact.
// All names / brands / phone-less copy here are fictional. No real company logo is drawn.
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "tex");
const SRC = join(OUT, "src");
mkdirSync(SRC, { recursive: true });
const CHROME = join(homedir(), "Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell");

const LINE = "#16897f";        // fictional 汐見線 line colour (sea teal)
const SANS = `"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif`;
const MIN = `"Hiragino Mincho ProN", serif`;
const LAT = `"Helvetica Neue", Helvetica, Arial, sans-serif`;

const page = (w, h, css, body, bg = "#000") => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg};}
*{box-sizing:border-box;}
body{font-family:${SANS};-webkit-font-smoothing:antialiased;position:relative;}
${css}</style></head><body>${body}</body></html>`;

// film grain overlay for the printed posters (sits on the print, it IS the print surface)
const GRAIN = `<svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.16;mix-blend-mode:overlay;pointer-events:none" xmlns="http://www.w3.org/2000/svg">
<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
<rect width="100%" height="100%" filter="url(#g)"/></svg>`;

const jobs = [];
const shot = (name, w, h, html) => jobs.push({ name, w, h, html, mode: "shot" });
const canvas = (name, html) => jobs.push({ name, html, mode: "dom" });

// ------------------------------------------------------------------------------------------- direction signs
// face 2.60 x 0.55 m -> 2364 x 500 px
function dirSign(name, num, kanji, eng, numRight) {
  const css = `
  .wrap{position:absolute;inset:0;background:linear-gradient(#1b1c1d,#121314);display:flex;align-items:stretch;}
  .num{width:390px;display:flex;align-items:center;justify-content:center;}
  .num b{width:280px;height:280px;border:10px solid #f4f4f0;border-radius:10px;display:flex;align-items:center;justify-content:center;font:700 236px/1 ${LAT};color:#f4f4f0;padding-top:6px;}
  .bar{width:14px;margin:58px 0;background:${LINE};border-radius:3px;}
  .txt{flex:1;padding:44px 70px 0 70px;color:#f4f4f0;}
  .k{font-weight:600;font-size:204px;line-height:1;letter-spacing:18px;white-space:nowrap;}
  .k i{font-style:normal;display:inline-block;width:70px;}
  .k small{font-size:96px;letter-spacing:6px;margin-left:34px;font-weight:600;}
  .e{font:500 78px/1 ${LAT};margin-top:42px;letter-spacing:1px;white-space:nowrap;}
  .r .txt{text-align:right;}`;
  const n = `<div class="num"><b>${num}</b></div>`, b = `<div class="bar"></div>`;
  const t = `<div class="txt"><div class="k">${kanji.replace("　", "<i></i>")}<small>方面</small></div><div class="e">${eng}</div></div>`;
  shot(name, 2364, 500, page(2364, 500, css, `<div class="wrap ${numRight ? "r" : ""}">${numRight ? t + b + n : n + b + t}</div>`));
}
dirSign("sign_dir_2", "2", "横浜　新横浜", "for Yokohama, Shin-Yokohama", false);
dirSign("sign_dir_1", "1", "川崎　品川", "for Kawasaki, Shinagawa", true);

// ------------------------------------------------------------------------------------------- LED boards
// display 208 x 40 LEDs, pitch 9.5 mm -> 1.976 x 0.380 m; texture 10 px per LED (2080 x 400).
// rows: 2..17 line 1, 22..37 line 2 (the message window on board A).
const LED_JS = `
const FONT = '400 15px "Hiragino Sans"';
function bitmap(spans, W){            // spans: [[text, colour, x], ...] -> {W, H:16, px:[colour|null]}
  const c=document.createElement('canvas'); c.width=W; c.height=16; const g=c.getContext('2d');
  const px=new Array(W*16).fill(null);
  for(const [t,col,x] of spans){
    g.clearRect(0,0,W,16); g.fillStyle='#fff'; g.font=FONT; g.textBaseline='alphabetic'; g.fillText(t,x,13);
    const d=g.getImageData(0,0,W,16).data;
    for(let i=0;i<W*16;i++) if(d[i*4+3]>110) px[i]=col;
  }
  return px;
}
function width(t){const c=document.createElement('canvas').getContext('2d');c.font=FONT;return Math.ceil(c.measureText(t).width);}
const COL={amber:[255,150,26],green:[70,230,90],red:[255,40,18],white:[255,236,200]};
function board(lines, P){             // lines: [{row, spans, W}] ; P = px per LED
  const NX=208, NY=40, c=document.createElement('canvas'); c.width=NX*P; c.height=NY*P; const g=c.getContext('2d');
  g.fillStyle='#0a0a09'; g.fillRect(0,0,c.width,c.height);
  const lit=new Map();
  for(const L of lines){const px=bitmap(L.spans,NX); for(let y=0;y<16;y++)for(let x=0;x<NX;x++){const v=px[y*NX+x]; if(v) lit.set((L.row+y)*NX+x, v);} }
  const r=P*0.36;
  for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){
    const cx=(x+.5)*P, cy=(y+.5)*P, v=lit.get(y*NX+x);
    if(!v){ const gr=g.createRadialGradient(cx-r*.25,cy-r*.3,0,cx,cy,r); gr.addColorStop(0,'#2b2723'); gr.addColorStop(1,'#151311');
      g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); continue; }
    const [R,G,B]=COL[v]; const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);
    gr.addColorStop(0,'rgb('+Math.min(255,R+60)+','+Math.min(255,G+70)+','+Math.min(255,B+60)+')');
    gr.addColorStop(.55,'rgb('+R+','+G+','+B+')'); gr.addColorStop(1,'rgb('+(R*.7|0)+','+(G*.7|0)+','+(B*.7|0)+')');
    g.fillStyle=gr; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill();
  }
  return c.toDataURL('image/png');
}
function strip(text, pad){            // 1 px per LED bitmap, red on black, tiles horizontally
  const W=width(text)+pad, px=bitmap([[text,'red',0]],W);
  const c=document.createElement('canvas'); c.width=W; c.height=16; const g=c.getContext('2d');
  const im=g.createImageData(W,16);
  for(let i=0;i<W*16;i++){ const on=px[i]?255:0; im.data[i*4]=on; im.data[i*4+1]=on?40:0; im.data[i*4+2]=on?18:0; im.data[i*4+3]=255; }
  g.putImageData(im,0,0); return c.toDataURL('image/png');
}
`;
const ledPage = (expr) => `<!doctype html><html><head><meta charset="utf-8"></head><body><pre id="o"></pre><script>${LED_JS}
document.getElementById('o').textContent=${expr};</script></body></html>`;
// x positions in LEDs: 各停 0..31 | time 40.. | dest 98.. | cars 170..
const trainLine = (row, kind, time, dest, cars) => `{row:${row},spans:[["${kind}","green",3],["${time}","amber",42],["${dest}","amber",96],["${cars}","amber",170]]}`;
canvas("sign_led_a", ledPage(`board([${trainLine(2, "各停", "17:02", "横浜", "8両")}],10)`));
canvas("sign_led_b", ledPage(`board([${trainLine(2, "各停", "17:05", "川崎", "8両")},${trainLine(22, "各停", "17:16", "川崎", "8両")}],10)`));
export const SCROLL_TEXT = "★まもなく　2番線に　電車が参ります　黄色い線の内側までお下がりください";
canvas("sign_led_scroll", ledPage(`strip(${JSON.stringify(SCROLL_TEXT)}, 216)`));

// LED header strips 1.976 x 0.10 m -> 1976 x 100
function ledHead(name, num, kanji, eng) {
  const css = `.h{position:absolute;inset:0;background:linear-gradient(#2e3031,#252728);display:flex;align-items:center;padding:0 26px;color:#f1f1ec;gap:22px;}
  .n{width:74px;height:74px;background:#f1f1ec;color:#202122;font:700 62px/74px ${LAT};text-align:center;border-radius:4px;}
  .b{width:8px;height:66px;background:${LINE};border-radius:2px;}
  .k{font-weight:600;font-size:56px;letter-spacing:4px;white-space:nowrap;}
  .e{font:500 36px ${LAT};opacity:.92;white-space:nowrap;margin-left:8px;}`;
  shot(name, 1976, 100, page(1976, 100, css, `<div class="h"><div class="n">${num}</div><div class="b"></div><div class="k">${kanji}</div><div class="e">${eng}</div></div>`));
}
ledHead("sign_ledhead_a", "2", "横浜・新横浜方面", "for Yokohama, Shin-Yokohama");
ledHead("sign_ledhead_b", "1", "川崎・品川方面", "for Kawasaki, Shinagawa");

// ------------------------------------------------------------------------------------------- placards
for (const n of ["1", "2"]) {
  const css = `.p{position:absolute;inset:0;background:#f3f3ef;border:18px solid #1d1e1f;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .n{font:700 252px/1 ${LAT};color:#1d1e1f;margin-top:6px;}
  .s{font-weight:600;font-size:46px;color:#1d1e1f;letter-spacing:6px;margin-top:2px;}`;
  shot("sign_plat_" + n, 400, 400, page(400, 400, css, `<div class="p"><div class="n">${n}</div><div class="s">番線</div></div>`));
}
// car-stop markers: shape encodes the train length (○ 8両, △ 6両, □ 4両)
const shapes = {
  "8": `<circle cx="150" cy="150" r="118" fill="none" stroke="#1d4f95" stroke-width="16"/>`,
  "6": `<path d="M150 22 L276 248 L24 248 Z" fill="none" stroke="#1d4f95" stroke-width="16" stroke-linejoin="round"/>`,
  "4": `<rect x="34" y="34" width="232" height="232" rx="6" fill="none" stroke="#1d4f95" stroke-width="16"/>`,
};
for (const n of ["8", "6", "4"]) {
  const dy = n === "6" ? 178 : 150;
  const css = `.c{position:absolute;inset:0;background:#f4f4f0;}
  svg{position:absolute;left:0;top:14px;width:300px;height:300px;}
  .u{position:absolute;left:0;right:0;bottom:12px;text-align:center;font-weight:600;font-size:40px;color:#1d4f95;letter-spacing:4px;}`;
  shot("sign_car_" + n, 300, 360, page(300, 360, css, `<div class="c"><svg viewBox="0 0 300 300">${shapes[n]}
  <text x="150" y="${dy}" text-anchor="middle" dominant-baseline="central" font-family='Helvetica Neue' font-weight="700" font-size="${n === "6" ? 104 : 168}" fill="#1d4f95">${n}</text></svg>
  <div class="u">${n}両</div></div>`));
}

// elevator sign 0.80 x 0.30 m -> 800 x 300
{
  const css = `.e{position:absolute;inset:0;background:linear-gradient(#1f62ad,#1a579c);display:flex;align-items:center;padding:0 40px;gap:40px;color:#fff;}
  svg{width:200px;height:220px;flex:none;}
  .k{font-weight:600;font-size:72px;letter-spacing:1px;white-space:nowrap;line-height:1;}
  .en{font:500 50px ${LAT};margin-top:22px;}`;
  const icon = `<svg viewBox="0 0 200 220"><rect x="8" y="8" width="184" height="204" rx="10" fill="none" stroke="#fff" stroke-width="12"/>
  <path d="M42 70 L66 36 L90 70 Z M42 150 L66 184 L90 150 Z" fill="#fff"/>
  <circle cx="138" cy="52" r="17" fill="#fff"/><path d="M118 78 h40 a8 8 0 0 1 8 8 v52 h-12 v58 h-14 v-52 h-4 v52 h-14 v-58 h-12 v-52 a8 8 0 0 1 8 -8z" fill="#fff"/></svg>`;
  shot("sign_elevator", 800, 300, page(800, 300, css, `<div class="e">${icon}<div><div class="k">エレベーター</div><div class="en">Elevator</div></div></div>`));
  // small plate on column 1's camera face, 0.45 x 0.28 m -> 640 x 400: pictogram + up arrow on top, text below
  const css2 = `.e{position:absolute;inset:0;background:linear-gradient(#1f62ad,#1a579c);color:#fff;}
  .top{position:absolute;left:0;right:0;top:34px;height:200px;display:flex;justify-content:center;align-items:center;gap:46px;}
  .top svg{height:200px;width:auto;}
  .k{position:absolute;left:0;right:0;top:258px;text-align:center;font-weight:600;font-size:66px;line-height:1;white-space:nowrap;}
  .en{position:absolute;left:0;right:0;top:336px;text-align:center;font:500 40px ${LAT};line-height:1;}`;
  const arrow = `<svg viewBox="0 0 150 200"><path d="M75 6 L144 86 H100 V194 H50 V86 H6 Z" fill="#fff"/></svg>`;
  shot("sign_elevator_col", 640, 400, page(640, 400, css2,
    `<div class="e"><div class="top">${icon.replace('viewBox="0 0 200 220"', 'viewBox="0 0 200 220" style="width:182px"')}${arrow}</div><div class="k">エレベーター</div><div class="en">Elevator</div></div>`));
}

// ------------------------------------------------------------------------------------------- clock face (hands are geometry)
{
  let ticks = "";
  for (let i = 0; i < 60; i++) {
    const a = i * 6, big = i % 5 === 0;
    ticks += `<rect x="${big ? 503 : 507}" y="${big ? 52 : 56}" width="${big ? 18 : 10}" height="${big ? 86 : 34}" fill="#161616" transform="rotate(${a} 512 512)"/>`;
  }
  let nums = "";
  for (let h = 1; h <= 12; h++) {
    const a = (h * 30 - 90) * Math.PI / 180, R = 292;
    nums += `<text x="${(512 + R * Math.cos(a)).toFixed(1)}" y="${(512 + R * Math.sin(a)).toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="Helvetica Neue" font-weight="500" font-size="80" fill="#161616">${h}</text>`;
  }
  const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024"><defs><radialGradient id="f" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fbfbf7"/><stop offset="1" stop-color="#e9e8e1"/></radialGradient></defs>
  <rect width="1024" height="1024" fill="#222"/><circle cx="512" cy="512" r="508" fill="url(#f)"/>${ticks}${nums}
  <text x="512" y="660" text-anchor="middle" font-family="Helvetica Neue" font-weight="500" font-size="30" letter-spacing="6" fill="#555">QUARTZ</text></svg>`;
  shot("sign_clock", 1024, 1024, page(1024, 1024, "", svg, "#222"));
}

// ------------------------------------------------------------------------------------------- 駅名標 (fictional station)
// face 1.80 x 0.60 m -> 1800 x 600. East face (track 1 side): 川崎 on the viewer's right; west face mirrored.
function ekimei(name, leftK, leftR, leftH, rightK, rightR, rightH) {
  const css = `.s{position:absolute;inset:0;background:linear-gradient(#fdfdfb,#f1f1ec);color:#1b1c1d;}
  .line{position:absolute;left:38px;top:30px;font-weight:600;font-size:34px;letter-spacing:3px;color:#444;}
  .line span{font:500 26px ${LAT};margin-left:12px;letter-spacing:0;color:#666;}
  .no{position:absolute;left:150px;top:118px;width:150px;height:160px;border:12px solid ${LINE};border-radius:10px;background:#fff;text-align:center;font:700 44px/1 ${LAT};padding-top:18px;}
  .no b{display:block;font-size:60px;line-height:1;margin-top:8px;}
  .hira{position:absolute;left:0;right:0;top:30px;text-align:center;font-weight:600;font-size:66px;letter-spacing:22px;}
  .kan{position:absolute;left:0;right:0;top:128px;text-align:center;font-weight:600;font-size:186px;line-height:1;letter-spacing:40px;padding-left:40px;}
  .rom{position:absolute;left:0;right:0;top:336px;text-align:center;font:500 58px ${LAT};letter-spacing:4px;}
  .band{position:absolute;left:0;right:0;bottom:0;height:150px;background:${LINE};color:#fff;}
  .nb{position:absolute;top:18px;display:flex;align-items:center;gap:20px;}
  .nb.l{left:40px;} .nb.r{right:40px;flex-direction:row-reverse;text-align:right;}
  .nb svg{width:70px;height:70px;}
  .nk{font-weight:600;font-size:56px;line-height:1.05;letter-spacing:3px;}
  .nr{font:500 30px ${LAT};margin-top:6px;}
  .here{position:absolute;left:50%;top:0;width:96px;margin-left:-48px;height:30px;background:#fff;clip-path:polygon(0 0,100% 0,50% 100%);}`;
  const arrowL = `<svg viewBox="0 0 70 70"><path d="M66 35 H14 M34 12 L10 35 L34 58" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const arrowR = `<svg viewBox="0 0 70 70"><path d="M4 35 H56 M36 12 L60 35 L36 58" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const body = `<div class="s"><div class="line">汐見線<span>Shiomi Line</span></div>
  <div class="no">SM<b>07</b></div><div class="hira">しおみだい</div><div class="kan">汐見台</div><div class="rom">Shiomidai</div>
  <div class="band"><div class="here"></div>
  <div class="nb l">${arrowL}<div><div class="nk">${leftK}<span style="font-size:34px;margin-left:16px;font-weight:300">${leftH}</span></div><div class="nr">${leftR}</div></div></div>
  <div class="nb r">${arrowR}<div><div class="nk"><span style="font-size:34px;margin-right:16px;font-weight:300">${rightH}</span>${rightK}</div><div class="nr">${rightR}</div></div></div></div></div>`;
  shot(name, 1800, 600, page(1800, 600, css, body, "#fff"));
}
ekimei("sign_ekimei_e", "新横浜", "Shin-Yokohama", "しんよこはま", "川崎", "Kawasaki", "かわさき");
ekimei("sign_ekimei_w", "川崎", "Kawasaki", "かわさき", "新横浜", "Shin-Yokohama", "しんよこはま");

// ------------------------------------------------------------------------------------------- posters (B0 landscape, 1.40 x 1.00 m visible)
const PW = 1400, PH = 1000;
// 1 real estate: 汐見台テラス
shot("poster_estate", PW, PH, page(PW, PH, `
.sky{position:absolute;inset:0;background:linear-gradient(176deg,#9fc3d6 0%,#c9dde2 38%,#f0dcc0 70%,#e9c7a0 100%);}
.sun{position:absolute;left:180px;top:520px;width:300px;height:300px;border-radius:50%;background:radial-gradient(#fff6dc 0,#ffe3b0 30%,rgba(255,220,170,0) 70%);}
.sea{position:absolute;left:0;width:860px;top:690px;height:120px;background:linear-gradient(#b9c9c9,#8fa6aa);}
.hill{position:absolute;left:0;width:880px;bottom:0;height:230px;background:linear-gradient(#4f6a3c,#344a2a);clip-path:polygon(0 30%,20% 18%,45% 26%,70% 12%,100% 22%,100% 100%,0 100%);}
.tw{position:absolute;left:420px;top:150px;width:250px;height:720px;background:
  repeating-linear-gradient(#0000 0 34px,#a8adb0 34px 40px),linear-gradient(90deg,#f3f1ec 0,#e7e4dd 62%,#bfc2c3 62%,#a9adaf 100%);}
.tw:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,#0000 0 28px,rgba(70,90,105,.55) 28px 52px);mix-blend-mode:multiply;clip-path:inset(0 38% 0 0);}
.tw2{position:absolute;left:250px;top:420px;width:150px;height:450px;background:repeating-linear-gradient(#0000 0 30px,#9aa0a2 30px 35px),linear-gradient(90deg,#ebe7df,#c8c9c7);}
.tree{position:absolute;border-radius:50%;background:radial-gradient(circle at 40% 35%,#7d9a58,#3f5b2c 70%);}
.panel{position:absolute;right:0;top:0;bottom:0;width:520px;background:#f7f4ee;padding:84px 60px 0 64px;color:#2b2a27;}
.en{font:500 30px ${LAT};letter-spacing:12px;color:#8a7458;}
.ttl{font-family:${MIN};font-weight:600;font-size:104px;line-height:1.1;margin-top:26px;letter-spacing:6px;}
.cp{font-family:${MIN};font-size:38px;line-height:1.7;margin-top:40px;}
.sp{margin-top:56px;font-size:30px;line-height:1.8;}
.pr{font:600 74px ${LAT};margin-top:20px;color:#2b2a27;}.pr small{font-family:${SANS};font-size:32px;margin-left:8px;}
.mr{position:absolute;left:64px;right:60px;bottom:58px;border-top:2px solid #b49d7c;padding-top:22px;font-size:28px;letter-spacing:3px;}
.fine{position:absolute;left:30px;bottom:18px;font-size:14px;color:#f2efe8;opacity:.85;}
`, `<div class="sky"></div><div class="sun"></div><div class="sea"></div><div class="tw2"></div><div class="tw"></div><div class="hill"></div>
<div class="tree" style="left:566px;top:899px;width:120px;height:102px"></div><div class="tree" style="left:338px;top:881px;width:106px;height:90px"></div><div class="tree" style="left:554px;top:776px;width:170px;height:144px"></div><div class="tree" style="left:-27px;top:880px;width:167px;height:141px"></div><div class="tree" style="left:524px;top:819px;width:123px;height:104px"></div><div class="tree" style="left:694px;top:880px;width:114px;height:96px"></div><div class="tree" style="left:816px;top:900px;width:159px;height:135px"></div><div class="tree" style="left:366px;top:798px;width:150px;height:127px"></div><div class="tree" style="left:610px;top:798px;width:119px;height:101px"></div><div class="tree" style="left:359px;top:763px;width:156px;height:132px"></div><div class="tree" style="left:755px;top:776px;width:175px;height:148px"></div><div class="tree" style="left:736px;top:770px;width:110px;height:93px"></div><div class="tree" style="left:758px;top:767px;width:128px;height:108px"></div><div class="tree" style="left:444px;top:859px;width:124px;height:105px"></div><div class="tree" style="left:767px;top:869px;width:181px;height:153px"></div><div class="tree" style="left:705px;top:873px;width:140px;height:119px"></div><div class="tree" style="left:859px;top:853px;width:107px;height:90px"></div><div class="tree" style="left:-4px;top:794px;width:102px;height:86px"></div><div class="tree" style="left:182px;top:826px;width:153px;height:130px"></div><div class="tree" style="left:406px;top:837px;width:176px;height:149px"></div><div class="tree" style="left:479px;top:858px;width:143px;height:121px"></div><div class="tree" style="left:319px;top:896px;width:163px;height:138px"></div><div class="tree" style="left:377px;top:819px;width:164px;height:139px"></div><div class="tree" style="left:658px;top:767px;width:133px;height:113px"></div><div class="tree" style="left:580px;top:801px;width:125px;height:106px"></div><div class="tree" style="left:841px;top:843px;width:179px;height:152px"></div>
<div class="fine">※完成予想図。実際とは異なります。</div>
<div class="panel"><div class="en">SHIOMIDAI TERRACE</div><div class="ttl">汐見台<br>テラス</div>
<div class="cp">駅徒歩3分、<br>海をのぞむ丘の上に。</div>
<div class="sp">全84邸　2LDK〜4LDK<br>予定販売価格</div><div class="pr">4,980<small>万円台〜</small></div>
<div class="mr">モデルルーム 公開中</div></div>${GRAIN}`));

// 2 hot spring trip: 奥霧温泉
shot("poster_onsen", PW, PH, page(PW, PH, `
.bg{position:absolute;inset:0;background:linear-gradient(#d9d3c4 0%,#c7c9bd 30%,#a9b3a3 55%,#59684f 100%);}
.m{position:absolute;left:-100px;right:-100px;}
.m1{top:180px;height:600px;background:linear-gradient(#8f9b92,#6c7b6e);clip-path:polygon(0 60%,14% 22%,26% 40%,40% 6%,55% 34%,70% 14%,86% 44%,100% 26%,100% 100%,0 100%);}
.m2{top:360px;height:600px;background:linear-gradient(#5a6b52,#3a4a34);clip-path:polygon(0 30%,18% 52%,33% 18%,50% 46%,64% 24%,80% 50%,100% 20%,100% 100%,0 100%);}
.mist{position:absolute;left:0;right:0;height:180px;background:linear-gradient(rgba(240,238,230,0),rgba(240,238,230,.75),rgba(240,238,230,0));}
.mp{position:absolute;border-radius:50%;background:radial-gradient(circle,#b8422a 0,#9c3121 55%,rgba(150,50,30,0) 72%);}
.inn{position:absolute;left:250px;top:660px;width:420px;height:150px;background:linear-gradient(#5b4535,#3a2c22);}
.inn:before{content:"";position:absolute;left:-40px;right:-40px;top:-70px;height:80px;background:#2e2a28;clip-path:polygon(10% 0,90% 0,100% 100%,0 100%);}
.inn:after{content:"";position:absolute;left:30px;right:30px;top:40px;height:60px;background:repeating-linear-gradient(90deg,#f2c977 0 46px,#3a2c22 46px 56px);opacity:.9;}
.steam{position:absolute;border-radius:50%;background:radial-gradient(rgba(255,255,255,.7),rgba(255,255,255,0) 70%);}
.river{position:absolute;left:0;right:0;bottom:0;height:170px;background:linear-gradient(#7f9590,#4d625d);}
.v{position:absolute;right:120px;top:90px;writing-mode:vertical-rl;font-family:${MIN};font-weight:600;color:#fff;text-shadow:0 2px 8px rgba(30,30,20,.45);}
.v .a{font-size:150px;letter-spacing:22px;}
.v .b{font-size:52px;letter-spacing:12px;margin-right:34px;margin-top:90px;white-space:nowrap;}
.box{position:absolute;left:70px;top:70px;color:#2a2a26;}
.box .t{font-size:34px;font-weight:600;letter-spacing:4px;}
.box .p{font:600 96px ${LAT};margin-top:8px;}.box .p small{font-family:${SANS};font-size:36px;margin-left:10px;}
.box .n{font-size:26px;margin-top:6px;letter-spacing:2px;}
.foot{position:absolute;left:70px;bottom:44px;color:#fff;font-size:30px;letter-spacing:4px;}
`, `<div class="bg"></div><div class="m m1"></div><div class="mist" style="top:430px"></div><div class="m m2"></div>
<div class="mp" style="left:80px;top:520px;width:260px;height:200px"></div><div class="mp" style="left:690px;top:560px;width:220px;height:170px"></div>
<div class="mp" style="left:980px;top:610px;width:280px;height:200px;opacity:.8"></div>
<div class="inn"></div><div class="steam" style="left:300px;top:480px;width:260px;height:220px"></div><div class="steam" style="left:440px;top:420px;width:200px;height:200px"></div>
<div class="mist" style="top:700px;opacity:.7"></div><div class="river"></div>
<div class="v"><div class="a">奥霧温泉</div><div class="b">湯けむりの郷へ。</div><div class="b" style="margin-top:300px">特急で九十分</div></div>
<div class="box"><div class="t">汐見台から おとな往復</div><div class="p">7,800<small>円</small></div><div class="n">特急券込み・平日限定・2日間有効</div></div>
<div class="foot">旅のご相談は　駅の旅行窓口へ</div>${GRAIN}`));

// 3 canned coffee: 朝凪ブラック
shot("poster_coffee", PW, PH, page(PW, PH, `
.bg{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 40%,#7a2e1d 0,#4a1a12 55%,#2a0f0b 100%);}
.ray{position:absolute;left:-200px;top:-300px;width:900px;height:1700px;background:linear-gradient(90deg,rgba(255,200,150,0),rgba(255,200,150,.12),rgba(255,200,150,0));transform:rotate(24deg);}
.can{position:absolute;left:250px;top:150px;width:300px;height:640px;border-radius:26px 26px 18px 18px;
  background:linear-gradient(90deg,#121212 0,#3a3a3a 16%,#1b1b1b 34%,#0c0c0c 70%,#2a2a2a 90%,#0e0e0e 100%);}
.can:before{content:"";position:absolute;left:0;right:0;top:-34px;height:44px;border-radius:50%/60%;background:linear-gradient(90deg,#8c8c8c,#e4e4e4 24%,#9a9a9a 50%,#6c6c6c 80%,#b0b0b0);}
.lab{position:absolute;left:0;right:0;top:150px;height:330px;background:linear-gradient(90deg,#7d2a16 0,#c4532d 20%,#93351c 44%,#5e1e10 76%,#8a3019 100%);}
.lab .b{position:absolute;left:0;right:0;top:40px;text-align:center;font:800 54px ${LAT};letter-spacing:10px;color:#f6e7d4;}
.lab .k{position:absolute;left:0;right:0;top:120px;text-align:center;font-family:${MIN};font-weight:600;font-size:72px;color:#fff;letter-spacing:4px;}
.lab .s{position:absolute;left:0;right:0;top:232px;text-align:center;font:600 30px ${LAT};letter-spacing:12px;color:#f6e7d4;}
.shade{position:absolute;left:250px;top:116px;width:300px;height:674px;border-radius:26px;background:linear-gradient(90deg,rgba(0,0,0,.1),rgba(255,255,255,.18) 18%,rgba(0,0,0,0) 30%,rgba(0,0,0,.45) 85%);}
.shadow{position:absolute;left:210px;top:770px;width:420px;height:60px;border-radius:50%;background:radial-gradient(rgba(0,0,0,.55),rgba(0,0,0,0) 70%);}
.cp{position:absolute;left:720px;top:190px;color:#fff;}
.cp .a{font-family:${MIN};font-weight:600;font-size:104px;line-height:1.3;letter-spacing:6px;}
.cp .b{font-size:32px;line-height:1.8;margin-top:46px;color:#f1d9c4;letter-spacing:2px;white-space:nowrap;}
.brand{position:absolute;right:80px;bottom:70px;font:800 64px ${LAT};letter-spacing:16px;color:#f6e7d4;}
.sub{position:absolute;right:82px;bottom:46px;font-size:22px;color:#d9b9a0;letter-spacing:4px;}
`, `<div class="bg"></div><div class="ray"></div><div class="shadow"></div><div class="can"><div class="lab"><div class="b">KAZEMI</div><div class="k">朝凪</div><div class="s">BLACK</div></div></div><div class="shade"></div>
<div class="cp"><div class="a">苦みが、<br>目を覚ます。</div><div class="b">深煎り豆だけで淹れた、無糖ブラック。<br>185g　新発売</div></div>
<div class="brand">KAZEMI</div><div class="sub">風見珈琲</div>${GRAIN}`));

// 4 language school: ことのは英会話
shot("poster_school", PW, PH, page(PW, PH, `
.bg{position:absolute;inset:0;background:#f1c232;}
.big{position:absolute;left:80px;top:90px;font:800 190px/0.98 ${LAT};color:#1e1c18;letter-spacing:-4px;}
.bub{position:absolute;right:110px;top:110px;width:400px;height:300px;background:#fff;border-radius:50%;}
.bub:after{content:"";position:absolute;left:60px;bottom:-40px;width:90px;height:90px;background:#fff;clip-path:polygon(0 100%,30% 0,100% 30%);}
.bub span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 110px ${LAT};color:#d4502c;}
.ja{position:absolute;left:84px;top:540px;font-size:48px;font-weight:600;color:#1e1c18;letter-spacing:4px;}
.name{position:absolute;left:80px;bottom:120px;font-weight:800;font-size:100px;color:#1e1c18;letter-spacing:8px;}
.tag{position:absolute;right:80px;top:470px;width:420px;background:#1e1c18;color:#f1c232;padding:30px 36px;font-size:36px;font-weight:600;line-height:1.5;letter-spacing:3px;}
.tag b{font:700 64px ${LAT};color:#fff;display:block;}
.foot{position:absolute;left:84px;bottom:56px;font-size:30px;color:#1e1c18;letter-spacing:3px;}
`, `<div class="bg"></div><div class="big">Speak,<br>tomorrow.</div><div class="bub"><span>Hi!</span></div>
<div class="ja">あしたの自分と、話そう。</div><div class="name">ことのは英会話</div>
<div class="tag">無料体験レッスン<b>0円</b>受付中</div><div class="foot">汐見台駅前校　改札を出て右へ徒歩1分</div>${GRAIN}`));

// 5 museum exhibition: 海の博物誌
shot("poster_museum", PW, PH, page(PW, PH, `
.bg{position:absolute;inset:0;background:#ece6d8;}
.sun{position:absolute;left:820px;top:120px;width:380px;height:380px;border-radius:50%;background:#d8452b;}
svg{position:absolute;left:0;top:300px;width:1400px;height:700px;}
.t{position:absolute;left:90px;top:96px;font-family:${MIN};font-weight:600;font-size:150px;color:#1f2a36;letter-spacing:18px;}
.st{position:absolute;left:96px;top:290px;font:500 34px ${LAT};letter-spacing:10px;color:#1f2a36;}
.d{position:absolute;left:96px;bottom:70px;color:#f3eee2;}
.d .a{font:600 64px ${LAT};letter-spacing:2px;}
.d .b{font-size:32px;margin-top:10px;letter-spacing:4px;}
`, `<div class="bg"></div><div class="sun"></div>
<svg viewBox="0 0 1400 700"><path d="M0 220 C180 120 300 300 470 210 S760 60 900 180 S1200 300 1400 150 V700 H0Z" fill="#2c3e52"/>
<path d="M0 330 C220 250 340 400 560 320 S900 220 1080 330 S1300 380 1400 300 V700 H0Z" fill="#1f2a36"/>
<path d="M120 300 c40 -60 120 -70 160 -20 M620 250 c40 -50 110 -50 150 -10 M980 300 c50 -60 130 -60 170 -10" stroke="#ece6d8" stroke-width="10" fill="none" stroke-linecap="round"/></svg>
<div class="t">海の博物誌</div><div class="st">NATURAL HISTORY OF THE SEA</div>
<div class="d"><div class="a">2026.10.10 Sat. 〜 2027.1.17 Sun.</div><div class="b">県立汐見台美術館　汐見台駅から徒歩12分</div></div>${GRAIN}`));

// 6 vacancy board
shot("poster_vacancy", PW, PH, page(PW, PH, `
.bg{position:absolute;inset:0;background:#f4f3ef;}
.in{position:absolute;inset:60px;border:6px solid #2a5b8c;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#2a5b8c;}
.a{font-weight:800;font-size:170px;letter-spacing:24px;}
.b{font-size:46px;margin-top:40px;letter-spacing:6px;font-weight:600;color:#333;}
.c{font-size:30px;margin-top:70px;letter-spacing:4px;color:#555;}
`, `<div class="bg"></div><div class="in"><div class="a">広告募集中</div><div class="b">この場所に、広告を掲出しませんか。</div>
<div class="c">駅ばり B0判　お問い合わせは駅事務室まで</div></div>`, "#f4f3ef"));

// 7 station manners notice
shot("poster_manners", PW, PH, page(PW, PH, `
.bg{position:absolute;inset:0;background:#fff;}
.top{position:absolute;left:0;right:0;top:0;height:250px;background:#e8a317;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:110px;color:#1c1c1c;letter-spacing:10px;}
.ill{position:absolute;left:150px;top:330px;width:420px;height:520px;}
.tx{position:absolute;left:640px;top:360px;right:80px;font-size:52px;font-weight:600;line-height:1.7;color:#1c1c1c;}
.tx small{display:block;font-size:30px;font-weight:300;margin-top:30px;color:#444;}
.ft{position:absolute;left:0;right:0;bottom:50px;text-align:center;font-size:30px;letter-spacing:6px;color:#666;}
`, `<div class="bg"></div><div class="top">歩きスマホは危険です</div>
<svg class="ill" viewBox="0 0 420 520"><circle cx="210" cy="80" r="56" fill="#1c1c1c"/><path d="M140 160 h140 l30 170 h-40 l-10 190 h-50 l-10 -130 l-10 130 h-50 l-10 -190 h-40z" fill="#1c1c1c"/>
<rect x="250" y="190" width="56" height="90" rx="8" fill="#e8a317" stroke="#1c1c1c" stroke-width="8"/><path d="M20 500 H400" stroke="#e8a317" stroke-width="18" stroke-dasharray="40 20"/></svg>
<div class="tx">ホームでは画面ではなく、<br>足もとを見てください。<small>Please do not use your phone while walking on the platform.</small></div>
<div class="ft">汐見台駅</div>`, "#fff"));

// ------------------------------------------------------------------------------------------- runner
function run(args) {
  return new Promise((res, rej) => execFile(CHROME, args, { maxBuffer: 64 << 20 }, (e, out) => (e ? rej(e) : res(out))));
}
async function render(j) {
  const src = join(SRC, j.name + ".html"), png = join(OUT, j.name + ".png");
  writeFileSync(src, j.html);
  const base = ["--headless", "--hide-scrollbars", "--force-device-scale-factor=1", "--disable-gpu", "--font-render-hinting=none"];
  if (j.mode === "shot") {
    await run([...base, `--window-size=${j.w},${j.h}`, `--screenshot=${png}`, "file://" + src]);
  } else {
    const dom = await run([...base, "--dump-dom", "file://" + src]);
    const m = /data:image\/png;base64,([A-Za-z0-9+/=]+)/.exec(dom);
    if (!m) throw new Error("no data url from " + j.name);
    writeFileSync(png, Buffer.from(m[1], "base64"));
  }
  return png;
}
const want = process.argv.slice(2);
const todo = jobs.filter((j) => !want.length || want.some((w) => j.name.includes(w)));
const t0 = Date.now();
for (let i = 0; i < todo.length; i += 4) {
  const done = await Promise.all(todo.slice(i, i + 4).map(render));
  done.forEach((p) => console.log("[tex]", p));
}
console.log(`[tex] ${todo.length} textures in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
