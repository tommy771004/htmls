// Match settings chosen in the pre-game lobby (前置開場), after AoE II's single-player setup screen (難易度, 資源, 人口,
// 顯示地圖, 遊戲開始時代, 勝利, 所有科技). Stored in State, so a save, a replay and a recovered Worker rebuild the same
// match. Every value here is design_default for this game's scale (see docs/aoe2-rules-research.md).
import type {Resource} from '../content/rules.ts';
export type Difficulty='easy'|'standard'|'hard'|'hardest';
export type ResourceLevel='low'|'standard'|'medium'|'high';
export type Reveal='normal'|'explored'|'all';
export type Victory='standard'|'conquest';
export type MatchSettings={difficulty:Difficulty;resources:ResourceLevel;popCap:number;reveal:Reveal;startAge:1|2|3|4;victory:Victory;allTechs:boolean};
export const defaultSettings:MatchSettings={difficulty:'standard',resources:'standard',popCap:40,reveal:'normal',startAge:1,victory:'standard',allTechs:false};
export const settingRules={provenance:'design_default',
 // Starting stock per player before civilization bonuses; 'standard' is this game's usual 200/200/100/100. The others
 // follow AoE II's low / medium / high presets in spirit (low: no gold or stone; medium and high: a big head start).
 resources:{low:{food:100,wood:100,gold:0,stone:0},standard:{food:200,wood:200,gold:100,stone:100},medium:{food:500,wood:500,gold:300,stone:300},high:{food:1000,wood:1000,gold:700,stone:700}} as Record<ResourceLevel,Record<Resource,number>>,
 // Population ceilings offered (40 is the game's usual cap; civilization bonuses such as the Goths' still add).
 popCaps:[25,40,75,100] as readonly number[],
 // The computer: how often it thinks (ticks between passes), how many villagers it keeps, how large an attack wave
 // must be and the earliest tick of the first wave. 'standard' is exactly the existing aiRules values.
 difficulty:{easy:{thinkTicks:40,villagerTarget:8,waveSize:8,firstWaveTick:9600},standard:{thinkTicks:20,villagerTarget:12,waveSize:5,firstWaveTick:4800},
  hard:{thinkTicks:20,villagerTarget:14,waveSize:4,firstWaveTick:3600},hardest:{thinkTicks:10,villagerTarget:16,waveSize:4,firstWaveTick:2400}} as Record<Difficulty,{thinkTicks:number;villagerTarget:number;waveSize:number;firstWaveTick:number}>} as const;
const difficulties:readonly Difficulty[]=['easy','standard','hard','hardest'],levels:readonly ResourceLevel[]=['low','standard','medium','high'],reveals:readonly Reveal[]=['normal','explored','all'],victories:readonly Victory[]=['standard','conquest'];
// Fills in defaults and refuses anything unknown (the lobby, a pasted save and the Worker all come through here).
export function matchSettings(v:unknown={}):MatchSettings{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('無效的對局設定');const o={...defaultSettings,...(v as Partial<MatchSettings>)};
 if(!difficulties.includes(o.difficulty))throw Error('未知的難易度');if(!levels.includes(o.resources))throw Error('未知的資源設定');
 if(!settingRules.popCaps.includes(o.popCap))throw Error('未知的人口上限');if(!reveals.includes(o.reveal))throw Error('未知的地圖顯示設定');
 if(![1,2,3,4].includes(o.startAge))throw Error('未知的開始時代');if(!victories.includes(o.victory))throw Error('未知的勝利條件');if(typeof o.allTechs!=='boolean')throw Error('所有科技設定無效');
 return {difficulty:o.difficulty,resources:o.resources,popCap:o.popCap,reveal:o.reveal,startAge:o.startAge,victory:o.victory,allTechs:o.allTechs};}
// A state's settings (older fixtures without the field play the defaults).
export const settingsOf=(s:{settings?:MatchSettings})=>s.settings??defaultSettings;
export const aiTuning=(s:{settings?:MatchSettings})=>settingRules.difficulty[settingsOf(s).difficulty];
