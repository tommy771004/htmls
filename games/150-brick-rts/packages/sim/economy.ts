import {resources,rules} from '../content/rules.ts';
import type {Resource} from '../content/rules.ts';
export type Stock=Record<Resource,number>;
export type Reservation={id:string;entryId:string;cost:Stock;population:number;status:'reserved'|'cancelled'|'committed'};
export type Account={stock:Stock;populationUsed:number;populationReserved:number;populationCap:number;reservations:Reservation[]};
export const economyRules={provenance:'design_default',initialStock:{food:200,wood:200,gold:100,stone:100},populationCap:40,cancellationRefundPercent:100} as const;
export function createAccount(populationUsed:number):Account{return {stock:{...economyRules.initialStock},populationUsed,populationReserved:0,populationCap:economyRules.populationCap,reservations:[]};}
// These transactions reserve funding only. Construction/training must separately
// satisfy site, producer, age and technology requirements before calling them.
export function reserve(account:Account,id:string,entryId:string):void{
 const entry=rules.entries.find(e=>e.id===entryId);
 if(!entry||typeof id!=='string'||!id||account.reservations.some(r=>r.id===id))throw Error('無效或重複的預留項目');
 if(account.populationUsed+account.populationReserved+entry.population>account.populationCap)throw Error('人口容量不足');
 for(const key of resources)if(!Number.isSafeInteger(account.stock[key])||account.stock[key]<entry.cost[key])throw Error(`資源不足：${key}`);
 // Commit only after every resource and population check has passed.
 const record:Reservation={id,entryId,cost:{...entry.cost},population:entry.population,status:'reserved'};
 for(const key of resources)account.stock[key]-=record.cost[key];
 account.populationReserved+=record.population;account.reservations.push(record);
}
export function cancelReservation(account:Account,id:string):void{
 const r=account.reservations.find(r=>r.id===id);
 if(!r||r.status!=='reserved')throw Error('預留項目不存在或已結束');
 for(const key of resources)if(!Number.isSafeInteger(account.stock[key]+r.cost[key]))throw Error('退款超過安全整數範圍');
 for(const key of resources)account.stock[key]+=r.cost[key];account.populationReserved-=r.population;r.status='cancelled';
}
export function commitReservation(account:Account,id:string):void{
 const r=account.reservations.find(r=>r.id===id);if(!r||r.status!=='reserved')throw Error('預留項目不存在或已結束');
 account.populationReserved-=r.population;account.populationUsed+=r.population;r.status='committed';
}
