export const resources = ['food', 'wood', 'gold', 'stone'] as const;
export type Resource = typeof resources[number];
export type Entry = {referenceVersion:null; sourceEvidence:string[]; implementationStatus:'not_started'|'in_progress'; testEvidence:string[]; id: string; kind: 'unit'|'building'|'technology'; name: string; cost: Record<Resource, number>; time: number; population: number; requires: string[]; verificationStatus: 'design_default'};
export type Rules = {schemaVersion: number; id: string; reference: {game: string; version: string|null; build: string|null; contentPacks: string[]; verificationStatus: 'unverified'|'verified_against_reference'; sourceEvidence: string[]}; coverage: {contentDenominator: number|null; exactReferenceCoveragePercent: number|null}; settings: {tickHz: number; populationCap: number; mapSize: number; speed: number; mode: string; seed: number; platform: string; provenance: 'design_default'}; entries: Entry[]; production: Record<string,string|null>; civilizations: {id: string; available: string[]; unavailable: string[]}[]};
const entry = (id: string, kind: Entry['kind'], name: string, food=0, wood=0, gold=0, stone=0, requires: string[]=[], population=0): Entry => ({referenceVersion:null,sourceEvidence:['original design defaults: packages/content/rules.ts'],implementationStatus:id==='villager'?'in_progress':'not_started',testEvidence:['tests/foundation.test.ts (data validation only)'],id,kind,name,cost:{food,wood,gold,stone},time:20,population,requires,verificationStatus:'design_default'});
export const rules: Rules = {
 schemaVersion:1,id:'brick-foundation-0.1',
 reference:{game:'Age of Empires II: Definitive Edition',version:null,build:null,contentPacks:[],verificationStatus:'unverified',sourceEvidence:[]},
 coverage:{contentDenominator:null,exactReferenceCoveragePercent:null},
 settings:{tickHz:20,populationCap:40,mapSize:16,speed:1,mode:'command-sandbox',seed:260925,platform:'desktop browser',provenance:'design_default'},
 entries:[entry('villager','unit','村民',50,0,0,0,[],1),entry('town-center','building','城鎮中心',0,200,0,100),entry('house','building','民居',0,30),entry('barracks','building','兵營',0,150),entry('farm','building','農田',0,60),entry('militia','unit','近戰民兵',60,0,20,0,['barracks'],1),entry('archer','unit','弓手',0,40,30,0,['age-2'],1),entry('ram','unit','攻城槌',0,160,75,0,['age-3'],3),entry('scout','unit','斥候',0,0,0,0,[],1),entry('age-2','technology','第二時代',300),entry('age-3','technology','第三時代',500,0,200,0,['age-2']),entry('age-4','technology','第四時代',800,0,400,0,['age-3'])],
 // Which building produces each unit/technology (design_default). null = defined but not producible yet.
 production:{villager:'town-center',militia:'barracks',archer:'barracks',ram:null,scout:null,'age-2':'town-center','age-3':'town-center','age-4':'town-center'},
 civilizations:[{id:'blue-settlement',available:['villager','town-center','house','barracks','farm','militia','archer','ram','scout','age-2','age-3','age-4'],unavailable:[]},{id:'red-settlement',available:['villager','town-center','house','barracks','farm','militia','archer','ram','scout','age-2','age-3','age-4'],unavailable:[]}]
};
// Runtime validator deliberately accepts unknown: pasted JSON is an untrusted boundary.
export function validateRules(value: unknown, exact=false): string[] {
 const errors: string[]=[];
 const obj=(v: unknown): v is Record<string,any> => typeof v==='object' && v!==null && !Array.isArray(v);
 if(!obj(value)) return ['規則必須是 JSON 物件'];
 if(value.schemaVersion!==1) errors.push('schemaVersion 必須為 1');
 if(typeof value.id!=='string'||!value.id.trim()) errors.push('規則 ID 不可空白');
 if(!obj(value.reference)) errors.push('缺少 reference');
 else {
  const r=value.reference;
  if(typeof r.game!=='string'||!r.game.trim()) errors.push('缺少 reference.game');
  if(!['unverified','verified_against_reference'].includes(r.verificationStatus)) errors.push('無效 reference verificationStatus');
  for(const k of ['version','build']) if(r[k]!==null&&(typeof r[k]!=='string'||!r[k].trim())) errors.push(`無效 reference.${k}`);
  if(!Array.isArray(r.contentPacks)||!r.contentPacks.every((x:unknown)=>typeof x==='string')) errors.push('contentPacks 必須為字串陣列');
  if(!Array.isArray(r.sourceEvidence)||!r.sourceEvidence.every((x:unknown)=>typeof x==='string')) errors.push('sourceEvidence 必須為字串陣列');
  if((exact||r.verificationStatus==='verified_against_reference')&&(!r.version||!r.build||!r.sourceEvidence?.length)) errors.push('原作精確驗證失敗：版本、build 與來源證據尚未確認');
 }
 if(!obj(value.coverage)||!(value.coverage.contentDenominator===null||Number.isSafeInteger(value.coverage.contentDenominator)&&value.coverage.contentDenominator>0)||value.coverage.exactReferenceCoveragePercent!==null) errors.push('此階段 coverage 分母可為 unknown，原作覆蓋率必須為 null');
 if(!obj(value.settings)) errors.push('缺少 settings');
 else {for(const k of ['tickHz','populationCap','mapSize','speed']) if(!Number.isSafeInteger(value.settings[k])||value.settings[k]<=0) errors.push(`settings.${k} 必須為正整數`);
 if(!Number.isSafeInteger(value.settings.seed)||value.settings.seed<0||value.settings.seed>4294967295) errors.push('seed 必須為 uint32');
 if(value.settings.provenance!=='design_default') errors.push('此切片參數必須標記 design_default');}
 if(!Array.isArray(value.entries)) return [...errors,'entries 必須為陣列'];
 const entries=value.entries.filter(obj); if(entries.length!==value.entries.length) errors.push('entry 必須為物件');
 const ids=new Set<string>();
 for(const e of entries){
  if(typeof e.id!=='string'||!e.id.trim()) errors.push('entry ID 不可空白');
  else if(ids.has(e.id)) errors.push(`重複 ID：${e.id}`); else ids.add(e.id);
  if(!['unit','building','technology'].includes(e.kind)||typeof e.name!=='string') errors.push(`${e.id} 類型或名稱無效`);
  if(e.referenceVersion!==null||!Array.isArray(e.sourceEvidence)||!e.sourceEvidence.length||!Array.isArray(e.testEvidence)||!['not_started','in_progress'].includes(e.implementationStatus)) errors.push(`${e.id} 追蹤資料無效`);
  if(e.verificationStatus!=='design_default') errors.push(`${e.id} 缺少 design_default`);
  for(const k of resources) if(!obj(e.cost)||!Number.isSafeInteger(e.cost[k])||e.cost[k]<0) errors.push(`${e.id} 無效成本 ${k}`);
  for(const k of ['time','population']) if(!Number.isSafeInteger(e[k])||e[k]<0) errors.push(`${e.id} 無效 ${k}`);
  if(!Array.isArray(e.requires)||!e.requires.every((v:unknown)=>typeof v==='string')) errors.push(`${e.id} requires 必須為字串陣列`);
 }
 const graph=new Map(entries.map(e=>[e.id,Array.isArray(e.requires)?e.requires:[]]));
 const visiting=new Set(),done=new Set();
 function visit(id:string){if(visiting.has(id)){errors.push(`科技圖循環：${id}`);return;} if(done.has(id))return; visiting.add(id);
 for(const dep of graph.get(id)||[]) {if(!ids.has(dep))errors.push(`${id} 懸空前置：${dep}`);else visit(dep);} visiting.delete(id);done.add(id);}
 for(const id of ids)visit(id);
 if(!Array.isArray(value.civilizations))errors.push('civilizations 必須為陣列');
 else {const civIds=new Set();for(const c of value.civilizations){if(!obj(c)||typeof c.id!=='string'||!Array.isArray(c.available)||!Array.isArray(c.unavailable)){errors.push('文明格式無效');continue;}
 if(civIds.has(c.id))errors.push(`重複文明 ID：${c.id}`);civIds.add(c.id);
 for(const id of [...c.available,...c.unavailable])if(!ids.has(id))errors.push(`${c.id} 懸空內容：${id}`);
 for(const id of c.available)if(c.unavailable.includes(id))errors.push(`${c.id} 禁用項出現在可用列表：${id}`);}}
 // Every unit and technology names its producer (or null); producers must be buildings.
 if(!obj(value.production))errors.push('production 必須為物件');
 else{const kinds=new Map(entries.map(e=>[e.id,e.kind]));
  for(const e of entries)if((e.kind==='unit'||e.kind==='technology')&&!(e.id in value.production))errors.push(`${e.id} 缺少生產建築`);
  for(const [id,producer] of Object.entries(value.production)){if(!kinds.has(id)||kinds.get(id)==='building')errors.push(`production 未知項目：${id}`);if(producer!==null&&kinds.get(producer as string)!=='building')errors.push(`${id} 的生產建築無效：${producer}`);}}
 return [...new Set(errors)];
}
