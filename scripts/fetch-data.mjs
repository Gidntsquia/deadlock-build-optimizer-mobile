import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=join(root,'public','data');
const API='https://api.deadlock-api.com';
const ACCOUNT=35187362;
const PUBLIC_DIR=join(root,'public');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function get(url,{retries=4}={}) {
  let last;
  for(let attempt=0;attempt<retries;attempt++){
    try { const response=await fetch(url,{headers:{'user-agent':'DeadlockBuildOptimizer/1.0 (local data snapshot)'}}); if(!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`); return await response.json(); }
    catch(error){last=error;if(attempt<retries-1)await sleep(700*(attempt+1));}
  }
  throw last;
}
async function saveAsset(url,relativePath){
  if(!url)return undefined;
  const target=join(PUBLIC_DIR,relativePath);await mkdir(dirname(target),{recursive:true});
  for(let attempt=0;attempt<4;attempt++){
    try{const response=await fetch(url,{headers:{'user-agent':'DeadlockBuildOptimizer/1.0 (local data snapshot)'}});if(!response.ok)throw new Error(`${response.status} ${response.statusText}`);await writeFile(target,new Uint8Array(await response.arrayBuffer()));return `/${relativePath.replaceAll('\\','/')}`;}
    catch(error){if(attempt===3)throw error;await sleep(500*(attempt+1));}
  }
}
async function mapLimit(values,limit,fn){let next=0;await Promise.all(Array.from({length:limit},async()=>{while(next<values.length){const index=next++;await fn(values[index],index);}}));}
function extOf(url){try{return new URL(url).pathname.split('.').pop()||'png';}catch{return 'png';}}
async function save(name,data){await writeFile(join(dataDir,name),JSON.stringify(data));console.log(`Saved ${name}`);}
await mkdir(dataDir,{recursive:true});
const [allItems,allHeroes,zergggyHistory]=await Promise.all([
  get(`${API}/v1/assets/items`),get(`${API}/v1/assets/heroes`),get(`${API}/v1/players/${ACCOUNT}/match-history`)
]);
// The current assets response includes 250 priced upgrade records; some entries
// omit one of the image variants, so preserve them and let the UI use a fallback.
const items=allItems.filter(item=>(item.type==='upgrade' && Number.isFinite(item.cost) && item.cost>0 && item.item_slot_type && (item.shop_image||item.image_webp))||item.type==='ability');
const heroes=allHeroes.filter(hero=>hero.player_selectable && !hero.disabled && !hero.in_development && hero.development_state==='release');
console.log(`Found ${items.filter(item=>item.type==='upgrade').length} shopable items, ${items.filter(item=>item.type==='ability').length} ability assets, and ${heroes.length} active heroes.`);
await mapLimit(items.filter(item=>item.type==='upgrade'),10,async item=>{const sources=[...new Set([item.shop_image,item.image_webp].filter(Boolean))];for(const url of sources){try{item.image_local=await saveAsset(url,`assets/items/${item.id}.${extOf(url)}`);break;}catch(error){if(url===sources.at(-1))console.warn(`Image unavailable for ${item.name}: ${error.message}`);}}});
await mapLimit(heroes,8,async hero=>{const url=hero.images?.icon_image_small_webp??hero.images?.icon_image_small;try{hero.images.local_icon_image_small_webp=await saveAsset(url,`assets/heroes/${hero.id}.${extOf(url)}`);}catch(error){console.warn(`Portrait unavailable for ${hero.name}: ${error.message}`);}});
const abilityClasses=new Set(heroes.flatMap(hero=>['signature1','signature2','signature3','signature4'].map(key=>hero.items?.[key]).filter(Boolean)));
const heroAbilities=items.filter(item=>item.type==='ability'&&abilityClasses.has(item.class_name));
await mapLimit(heroAbilities,10,async ability=>{const sources=[ability.image_webp,ability.image].filter(Boolean);for(const url of sources){try{ability.image_local=await saveAsset(url,`assets/abilities/${ability.id}.${extOf(url)}`);break;}catch(error){if(url===sources.at(-1))console.warn(`Ability icon unavailable for ${ability.name}: ${error.message}`);}}});
await Promise.all([save('items.json',items),save('heroes.json',heroes)]);
const analytics={};
const permutations={};
for(const [index,hero] of heroes.entries()){
  const params=`hero_id=${hero.id}&game_mode=normal&match_mode=ranked%2Cunranked&min_matches=5`;
  const [itemStats,abilityOrderStats,permutationStats]=await Promise.all([
    get(`${API}/v1/analytics/item-stats?${params}`),
    get(`${API}/v1/analytics/ability-order-stats?${params}`),
    get(`${API}/v1/analytics/item-permutation-stats?hero_id=${hero.id}&game_mode=normal&match_mode=ranked%2Cunranked&comb_size=2&min_matches=1000`)
  ]);
  const rankedOrders=abilityOrderStats.sort((a,b)=>b.matches-a.matches || a.abilities.join(',').localeCompare(b.abilities.join(','))).slice(0,500);
  analytics[String(hero.id)]={itemStats,abilityOrderStats:rankedOrders};
  permutations[String(hero.id)]=permutationStats.sort((a,b)=>b.matches-a.matches || a.item_ids.join(',').localeCompare(b.item_ids.join(','))).slice(0,2500);
  console.log(`Analytics ${hero.name} (${index+1}/${heroes.length})`);
  if(index%5===4) await sleep(1000);
}
await save('analytics.json',analytics);
await save('permutation-stats.json',permutations);
// History match_mode is numeric here: 1/2/4 are matchmaking queues; 7 is
// tutorial/test. Keep unscored normal matches when real non-custom metadata exists;
// only known wins receive the validator's win weight.
const eligible=zergggyHistory.filter(match=>match.hero_id===1 && match.game_mode===1 && [1,2,4].includes(match.match_mode)).sort((a,b)=>b.start_time-a.start_time);
await save('zergggy-infernus-matches.json',eligible);
const purchases=[];
for(const match of eligible){
  try {
    const metadata=await get(`${API}/v1/matches/${match.match_id}/metadata?is_custom=false`);
    const player=metadata.match_info?.players?.find(row=>row.account_id===ACCOUNT && row.hero_id===1);
    if(player) purchases.push({match_id:match.match_id,duration_s:match.match_duration_s,won:match.player_match_outcome===1,items:(player.items??[]).filter(row=>row.item_id>0 && row.game_time_s>=0).map(row=>({item_id:row.item_id,game_time_s:row.game_time_s}))});
  } catch(error){console.warn(`Skipping unavailable match metadata ${match.match_id}: ${error.message}`);}
  if(purchases.length>=30) break;
  await sleep(250);
}
await save('zergggy-infernus-purchases.json',purchases);
await save('snapshot-meta.json',{fetchedAt:new Date().toISOString(),itemCount:items.filter(item=>item.type==='upgrade').length,abilityAssetCount:items.filter(item=>item.type==='ability').length,heroCount:heroes.length,zergggyMatchCount:eligible.length,purchaseMatchCount:purchases.length,source:API});
console.log(`Done. ${purchases.length} held-out Infernus purchase matches captured.`);
