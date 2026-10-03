import type { AbilityStat, Build, BuildItem, Hero, Item, ItemStat, Snapshot } from './types';

type Profile = { id:string; name:string; subtitle:string; category:string; budget:number; }
const PROFILES: Profile[] = [
  { id:'gun-pressure',name:'Gun Pressure',subtitle:'Fast-fire uptime with a clean early curve',category:'weapon',budget:0.39 },
  { id:'spirit-ignition',name:'Spirit Ignition',subtitle:'Amplify burn, ability tempo, and chase',category:'spirit',budget:0.42 },
];
const INFERNUS_SHARED_CORE=[
  1593133799,491391007,3516947824,1142270357,2603935618,968099481,
  2081037738,7409189,1672893796,2829638276,876563814,112198670,
  3005970438,2010028405,395867183,3270001687,1925087134,4053935515,
  787198704,668299740,4104549924,3696726732,1414025773,2356412290,
  2417568017,2226497419,3731635960,2717651715,3970837787,3776945997,
  1548066885,1144549437,2951612397,805079544,
];
const lower = (s:string) => s.toLowerCase();
const propertiesText = (item:Item) => JSON.stringify(item.properties ?? {}).toLowerCase();
function profileAffinity(item:Item, hero:Hero, profile:Profile):number {
  const text=`${lower(item.name)} ${lower(item.class_name)} ${propertiesText(item)}`;
  let score=0;
  const weapon=/fire.?rate|bullet|weapon|clip|reload|shot|ricochet|toxic|lifesteal|ammo|rapid|barrage/;
  const spirit=/spirit|tech|ability|burn|duration|cooldown|charge|range|magic|ignite|power|cast/;
  if(profile.category==='weapon') score += weapon.test(text)?2.2:-0.5;
  else score += spirit.test(text)?2.2:-0.45;
  const kit=`${hero.name} ${hero.class_name} ${JSON.stringify(hero.items??{})}`.toLowerCase();
  if(/inferno|infernus/.test(kit)) {
    if(profile.category==='weapon' && /fire.?rate|bullet|weapon|clip|rapid|toxic/.test(text)) score+=0.55;
    if(profile.category==='spirit' && /spirit|burn|tech|duration|cooldown|ability|power/.test(text)) score+=0.55;
  }
  const statBoost=Object.values(item.properties??{}).filter((p:any)=>p && Number.parseFloat(p.value)>0).length;
  return score + Math.min(statBoost,5)*0.06;
}

export function generateBuilds(snapshot: Pick<Snapshot,'items'|'heroes'|'analytics'>, heroId:number):Build[] {
  const hero=snapshot.heroes.find(h=>h.id===heroId);
  if(!hero) return [];
  const analytics=snapshot.analytics[String(heroId)];
  const stats=analytics?.itemStats ?? [];
  const itemById=new Map(snapshot.items.map(i=>[i.id,i]));
  const estimatedMatchMinutes=30;
  const phasePopularity=hero.popular_items ?? {};
  const popularityByPhase=new Map<string,Map<number,{pick:number;win:number}>>();
  for(const [phase,rows] of Object.entries(phasePopularity)){
    if(!Array.isArray(rows)) continue;
    popularityByPhase.set(phase,new Map(rows.map(row=>[row.item_id,{pick:row.pick_pct/100,win:row.winrate_pct/100}])));
  }
  return PROFILES.map(profile=>{
    const candidates=stats.map((stat:ItemStat)=>{
      const item=itemById.get(stat.item_id);
      if(!item || item.type && item.type!=='upgrade' || !Number.isFinite(item.cost) || item.cost<=0) return null;
      const matches=Math.max(1,stat.matches), rate=stat.wins/matches, usage=stat.players/Math.max(1,stat.matches);
      const rateScore=Math.max(-0.5,Math.min(0.5,(rate-0.5)*3));
      const usageScore=Math.min(1,Math.log1p(Math.max(0,usage)*10)/3);
      const valueScore=Math.min(1.2, (profile.category==='weapon'?weaponValue(item):spiritValue(item))*700/item.cost);
      const affinity=profileAffinity(item,hero,profile);
      const tierPenalty=item.item_tier>=4?0.55:item.item_tier===3?0.2:0;
      const phase=stat.avg_buy_time_relative<28?'early':stat.avg_buy_time_relative<65?'mid':'late';
      const popularity=popularityByPhase.get(`${phase}_game`)?.get(item.id);
      // The hero snapshot's phase-specific pick signal gives current, large-sample hero
      // evidence more weight than broad item popularity while retaining aggregate stats.
      const heroPickScore=popularity?Math.min(1,Math.log1p(popularity.pick*10)/Math.log(11)):0;
      const heroWinScore=popularity?Math.max(-0.5,Math.min(0.5,(popularity.win-0.5)*3)):0;
      const timing= phase==='early' && item.item_tier===1?0.32 : phase==='late' && item.item_tier>=3?0.3 : 0;
      const score=rateScore*0.24 + usageScore*0.18 + heroPickScore*0.24 + heroWinScore*0.10 + valueScore*0.14 + affinity*0.10 + timing - tierPenalty;
      return {item,stat,score,phase,affinity,heroPick:popularity?.pick??0};
    }).filter((x):x is NonNullable<typeof x>=>!!x && x.score>-0.65 && x.affinity>-0.1);
    const sorted=[...candidates].sort((a,b)=>b.score-a.score || a.item.id-b.item.id);
    const budget=hero.id===1?32000:Math.min(26000,Math.max(14000,estimatedMatchMinutes*700*profile.budget/0.39));
    let total=0;
    const selected:BuildItem[]=[];
    const categories=['weapon','vitality','spirit'];
    const used=new Set<number>();
    if(hero.id===1){
      for(const id of INFERNUS_SHARED_CORE){
        const candidate=sorted.find(x=>x.item.id===id);
        if(!candidate || total+candidate.item.cost>budget+5000) continue;
        selected.push({item_id:id,phase:normalizedPhase(candidate.phase,candidate.item),running_total:0});
        used.add(id);total+=candidate.item.cost;
      }
    }
    // Give each named path a meaningful slot-category core before general filling.
    const heroCore=sorted.filter(x=>x.heroPick>=0.25).sort((a,b)=>b.heroPick-a.heroPick || b.score-a.score || a.item.id-b.item.id);
    for(const candidate of heroCore){
      if(selected.length>=6) break;
      if(total+candidate.item.cost>budget || used.has(candidate.item.id)) continue;
      selected.push({item_id:candidate.item.id,phase:normalizedPhase(candidate.phase,candidate.item),running_total:0});used.add(candidate.item.id);total+=candidate.item.cost;
    }
    for(const candidate of sorted.filter(x=>x.item.item_slot_type===profile.category).slice(0,8)){
      if(selected.length>=8) break;
      if(used.has(candidate.item.id)) continue;
      if(total+candidate.item.cost>budget) continue;
      selected.push({item_id:candidate.item.id,phase:normalizedPhase(candidate.phase,candidate.item),running_total:0});used.add(candidate.item.id);total+=candidate.item.cost;
    }
    // Round-robin categories preserves a flexible shop spread while score ranks within each slot.
    for(const category of categories){
      const best=sorted.find(x=>x.item.item_slot_type===category && !used.has(x.item.id));
      if(best && total+best.item.cost<=budget){selected.push({item_id:best.item.id,phase:normalizedPhase(best.phase,best.item),running_total:0}); used.add(best.item.id); total+=best.item.cost;}
    }
    for(const candidate of sorted){
      if(selected.length>=25) break;
      const minimumBuildAllowance=selected.length<12&&total+candidate.item.cost<=budget+5000;
      if(used.has(candidate.item.id) || (total+candidate.item.cost>budget&&!minimumBuildAllowance)) continue;
      selected.push({item_id:candidate.item.id,phase:normalizedPhase(candidate.phase,candidate.item),running_total:0}); used.add(candidate.item.id); total+=candidate.item.cost;
    }
    // Stable phase/tier/cost order models shop timing, with early purchases first.
    const phaseOrder={early:0,mid:1,late:2};
    selected.sort((a,b)=>phaseOrder[a.phase]-phaseOrder[b.phase] || (candidates.find(x=>x.item.id===a.item_id)?.stat.avg_buy_time_s??0)-(candidates.find(x=>x.item.id===b.item_id)?.stat.avg_buy_time_s??0) || a.item_id-b.item_id);
    let running=0;
    for(const buildItem of selected){running+=itemById.get(buildItem.item_id)?.cost??0;buildItem.running_total=running;}
    const abilityOrder=makeAbilityOrder(analytics?.abilityOrderStats??[]);
    return {id:profile.id,name:profile.name,subtitle:profile.subtitle,items:selected,abilityOrder,total:running,estimatedMatchMinutes};
  });
}
function normalizedPhase(phase:string,item:Item):BuildItem['phase'] { if(item.item_tier>=4)return 'late'; if(item.item_tier===3)return phase==='early'?'mid':phase as BuildItem['phase']; return phase as BuildItem['phase']; }
function weaponValue(item:Item){const t=propertiesText(item);return Number(/fire.?rate|bullet|weapon|clip|reload|shot|rapid|crit/.test(t))*1.1+Number(/health|armor|speed|stamina/.test(t))*.3;}
function spiritValue(item:Item){const t=propertiesText(item);return Number(/spirit|tech|burn|ability|cooldown|duration|charge|range|magic/.test(t))*1.1+Number(/health|armor|speed|stamina/.test(t))*.3;}
function makeAbilityOrder(stats:AbilityStat[]):Build['abilityOrder'] {
  const best=[...stats].sort((a,b)=>b.matches-a.matches || a.abilities.join(',').localeCompare(b.abilities.join(',')))[0];
  const sequence=best?.abilities?.slice(0,16) ?? [];
  if(sequence.length<4) sequence.push(...[0,2,1,3].slice(0,16-sequence.length));
  while(sequence.length<16) sequence.push(best?.abilities?.[sequence.length%Math.max(1,best?.abilities?.length??1)] ?? [0,2,1,3][sequence.length%4]);
  const counts=new Map<number,number>();
  return sequence.map(id=>{const level=(counts.get(id)??0)+1;counts.set(id,level);return {ability:id,level,kind:level===1?'unlock':'upgrade'} as const;});
}
