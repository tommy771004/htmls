// Sound effects, synthesised with WebAudio at play time (no audio files, no network). The context starts only
// after a user gesture (browser autoplay rules); until then play() is a no-op. Volume 0 mutes.
export type Sound='select-villager'|'select-soldier'|'order'|'order-attack'|'place'|'built'|'trained'|'hit'|'alarm'|'age'|'victory'|'defeat'|'collapse'|'resign';
export function createAudio(report:(name:string,count:number)=>void=()=>{}){
 let ctx:AudioContext|null=null,master:GainNode|null=null,volume=.6,count=0,noise:AudioBuffer|null=null;
 const lastPlayed=new Map<Sound,number>();
 // Minimum gap per sound, so a battle's many hits or a burst of orders never pile up into noise.
 const spacing:Partial<Record<Sound,number>>={hit:140,order:60,'order-attack':80,trained:250,built:250,alarm:3000};
 function unlock(){
  if(!ctx){const Ctor=window.AudioContext??(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Ctor)return;
   ctx=new Ctor();master=ctx.createGain();master.gain.value=volume;master.connect(ctx.destination);
   noise=ctx.createBuffer(1,ctx.sampleRate*.5,ctx.sampleRate);const data=noise.getChannelData(0);let seed=1;for(let i=0;i<data.length;i++){seed=(seed*1103515245+12345)>>>0;data[i]=(seed/4294967296)*2-1;}}
  if(ctx.state==='suspended')void ctx.resume();
 }
 function setVolume(v:number){volume=Math.max(0,Math.min(1,v));if(master&&ctx)master.gain.setTargetAtTime(volume,ctx.currentTime,.02);}
 // One enveloped oscillator note: frequency may glide to 'to' over the note.
 function tone(type:OscillatorType,freq:number,start:number,length:number,peak:number,to?:number){
  if(!ctx||!master)return;const osc=ctx.createOscillator(),env=ctx.createGain(),t=ctx.currentTime+start;
  osc.type=type;osc.frequency.setValueAtTime(freq,t);if(to)osc.frequency.exponentialRampToValueAtTime(to,t+length);
  env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(peak,t+Math.min(.012,length/4));env.gain.exponentialRampToValueAtTime(.0005,t+length);
  osc.connect(env);env.connect(master);osc.start(t);osc.stop(t+length+.02);}
 // Filtered noise: wood, hits, collapse.
 function burst(filter:BiquadFilterType,freq:number,start:number,length:number,peak:number){
  if(!ctx||!master||!noise)return;const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),env=ctx.createGain(),t=ctx.currentTime+start;
  src.buffer=noise;f.type=filter;f.frequency.value=freq;env.gain.setValueAtTime(peak,t);env.gain.exponentialRampToValueAtTime(.0005,t+length);
  src.connect(f);f.connect(env);env.connect(master);src.start(t);src.stop(t+length+.02);}
 const recipes:Record<Sound,()=>void>={
  'select-villager':()=>{tone('square',660,0,.06,.05);tone('square',880,.06,.07,.05);},
  'select-soldier':()=>{tone('triangle',330,0,.09,.12);burst('bandpass',3200,0,.05,.05);},
  order:()=>tone('sine',520,0,.05,.12),
  'order-attack':()=>{tone('sawtooth',230,0,.1,.06,170);burst('bandpass',1800,0,.06,.05);},
  place:()=>{burst('lowpass',600,0,.14,.3);tone('sine',140,0,.12,.18,90);},
  built:()=>{tone('sine',880,0,.5,.1);tone('sine',1320,.08,.45,.07);},
  trained:()=>{tone('sine',660,0,.4,.1);tone('sine',990,0,.35,.05);},
  hit:()=>burst('bandpass',1500,0,.06,.12),
  alarm:()=>{tone('sawtooth',330,0,.26,.05);tone('sawtooth',440,.28,.3,.05);},
  age:()=>{[523,659,784,1046].forEach((f,i)=>tone('triangle',f,i*.14,.34,.1));},
  victory:()=>{[392,523,659,784].forEach((f,i)=>tone('triangle',f,i*.16,.45,.11));},
  defeat:()=>{[392,330,277,220].forEach((f,i)=>tone('triangle',f,i*.2,.5,.1));},
  collapse:()=>{burst('lowpass',400,0,.55,.35);tone('sine',90,0,.4,.15,50);},
  resign:()=>tone('triangle',294,0,.5,.08,220),
 };
 function play(name:Sound){
  const now=performance.now(),gap=spacing[name]??0;if(gap&&now-(lastPlayed.get(name)??-1e9)<gap)return;lastPlayed.set(name,now);
  count++;report(name,count);if(!ctx||volume===0)return;recipes[name]();}
 return {unlock,setVolume,play,state:()=>ctx?.state??'locked',volume:()=>volume};
}
