import type { Build, Validation, ValidationSnapshot } from './types';
import { publicPath } from './publicPath';

/** Held-out only: this is the sole module allowed to read the Zergggy snapshot. */
export async function loadValidationSnapshot():Promise<ValidationSnapshot>{
  const read=async(name:string)=>{const response=await fetch(publicPath(`/data/${name}`));if(!response.ok)throw new Error(`${name} is missing. Run npm run fetch-data.`);return response.json();};
  const [matches,purchases]=await Promise.all([read('zergggy-infernus-matches.json'),read('zergggy-infernus-purchases.json')]);
  return {matches,purchases};
}

export function validateBuilds(snapshot:ValidationSnapshot, builds:Build[]):Validation {
  const matches=snapshot.purchases;
  const threshold=0.30;
  const weighted=new Map<number,number>();
  const appearances=new Map<number,number>();
  const firstTimes=new Map<number,number[]>();
  let wins=0;
  for(const match of matches){if(match.won)wins++; const weight=match.won?1.35:1;
    const seen=new Set(match.items.filter(x=>x.item_id>0).map(x=>x.item_id));
    for(const id of seen){appearances.set(id,(appearances.get(id)??0)+1);weighted.set(id,(weighted.get(id)??0)+weight);}
    const first=new Map<number,number>(); for(const purchase of [...match.items].sort((a,b)=>a.game_time_s-b.game_time_s)){if(!first.has(purchase.item_id))first.set(purchase.item_id,purchase.game_time_s);}
    for(const [id,time] of first) firstTimes.set(id,[...(firstTimes.get(id)??[]),time]);
  }
  const core=[...appearances].filter(([,count])=>count/Math.max(1,matches.length)>=threshold).map(([item_id,count])=>({item_id,frequency:count/Math.max(1,matches.length),weightedFrequency:(weighted.get(item_id)??0)/(matches.length+wins*.35),firstAverageTime:mean(firstTimes.get(item_id)??[])})).sort((a,b)=>b.weightedFrequency-a.weightedFrequency || a.item_id-b.item_id);
  const coreIds=new Set(core.map(c=>c.item_id));
  const reports:Validation['reports']={};
  for(const build of builds){const ids=build.items.map(i=>i.item_id);const shared=ids.filter(id=>coreIds.has(id));
    const overlap=shared.length/Math.max(1,new Set([...ids,...coreIds]).size);
    const buildShared=build.items.filter(i=>coreIds.has(i.item_id));
    let orderAgreement=0;
    if(buildShared.length>1){let pairs=0,agree=0;for(let i=0;i<buildShared.length;i++)for(let j=i+1;j<buildShared.length;j++){pairs++;const ai=core.find(c=>c.item_id===buildShared[i].item_id)!.firstAverageTime;const aj=core.find(c=>c.item_id===buildShared[j].item_id)!.firstAverageTime;if(ai<=aj)agree++;}orderAgreement=pairs?agree/pairs:0;}
    else orderAgreement=shared.length?1:0;
    const agreement=Math.round((overlap*.7+orderAgreement*.3)*100);
    reports[build.id]={agreement,overlap:Math.round(overlap*100),orderAgreement:Math.round(orderAgreement*100),badges:Object.fromEntries(ids.map(id=>[String(id),coreIds.has(id)]))};
  }
  return {threshold,matchCount:matches.length,core,reports};
}
function mean(a:number[]){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;}

