import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Flame, Search, ShieldCheck, Sparkles, Swords, X } from 'lucide-react';
import { generateBuilds } from '../generator';
import { publicPath } from '../publicPath';
import { loadValidationSnapshot, validateBuilds } from '../validation';
import type { Build, Hero, Item, Snapshot, Validation, ValidationSnapshot } from '../types';

const money=(n:number)=>`${new Intl.NumberFormat('en-US').format(n)} souls`;
const abilityKeys=['signature1','signature2','signature3','signature4'];
function propertyLines(item:Item){
  const visibleKeys=new Set((item.tooltip_sections??[]).flatMap(section=>(section.section_attributes??[]).flatMap(attribute=>[
    ...(attribute.properties??[]),...(attribute.important_properties??[]),...(attribute.elevated_properties??[])
  ])));
  return [...visibleKeys].flatMap(key=>{
    const value=item.properties?.[key];
    const label=value?.label;
    const parsed=Number.parseFloat(String(value?.value??''));
    if(!label||!Number.isFinite(parsed)||parsed===0||value?.disable_value===value?.value)return [];
    let shown=`${value?.prefix?.includes('{s:sign}')&&parsed>0?'+':''}${parsed}${value?.postfix??''}`;
    return [{label,value:shown}];
  }).slice(0,9);
}
function describe(item:Item){
  const sections=(item.tooltip_sections??[]).flatMap(section=>(section.section_attributes??[]).map(a=>a.loc_string).filter(Boolean));
  const html=sections[0]??item.description?.desc??item.description?.quip??'';
  return html.replace(/<svg[\s\S]*?<\/svg>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}
function App(){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);const [generated,setGenerated]=useState<Record<string,Build[]>>({});const [validation,setValidation]=useState<Validation|null>(null);const [validationSnapshot,setValidationSnapshot]=useState<ValidationSnapshot|null>(null);const [heroId,setHeroId]=useState(1);const [buildIndex,setBuildIndex]=useState(0);const [selected,setSelected]=useState<Item|null>(null);const [pickerOpen,setPickerOpen]=useState(false);const [query,setQuery]=useState('');const [error,setError]=useState('');
  useEffect(()=>{(async()=>{try{
    const [items,heroes,analytics,savedBuilds]=await Promise.all(['items.json','heroes.json','analytics.json','generated-builds.json'].map(name=>fetch(publicPath(`/data/${name}`)).then(r=>{if(!r.ok)throw Error(`${name} is missing. Run npm run fetch-data.`);return r.json();})));
    const snap:Snapshot={items,heroes,analytics};setSnapshot(snap);
    const built:Record<string,Build[]>={...savedBuilds};
    for(const hero of heroes as Hero[]) if(!built[String(hero.id)]?.length) built[String(hero.id)]=generateBuilds(snap,hero.id);
    const heldOut=await loadValidationSnapshot();setValidationSnapshot(heldOut);setGenerated(built);setValidation(validateBuilds(heldOut,built['1']??[]));
  }catch(e){setError(e instanceof Error?e.message:'Could not load the local snapshots.');}})();},[]);
  const hero=snapshot?.heroes.find(h=>h.id===heroId);const builds=generated[String(heroId)]??[];const activeBuild=builds[buildIndex]??builds[0];
  const itemsById=useMemo(()=>new Map(snapshot?.items.map(item=>[item.id,item])??[]),[snapshot]);
  const filteredHeroes=(snapshot?.heroes??[]).filter(h=>h.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>{if(heroId===1&&validationSnapshot&&activeBuild)setValidation(validateBuilds(validationSnapshot,[...builds]));},[heroId,builds,validationSnapshot,activeBuild]);
  const chooseHero=(id:number)=>{setHeroId(id);setBuildIndex(0);setPickerOpen(false);setQuery('');};
  if(error)return <main className="loading"><Flame/><h1>Snapshots needed</h1><p>{error}</p></main>;
  if(!snapshot||!hero||!activeBuild)return <main className="loading"><Flame className="loading-flame"/><span>Loading local match intelligence…</span></main>;
  const abilityRows=abilityKeys.map((key,index)=>{
    const ability=snapshot.items.find(item=>item.type==='ability'&&item.class_name===hero.items?.[key]);
    return {index,ability,name:ability?.name??`Ability ${index+1}`};
  });
  const itemDetail=selected;
  return <main className="app-shell">
    <header className="topbar"><a className="wordmark" href="#top"><span className="mark"><Flame size={19} fill="currentColor"/></span><span>DEADLOCK <b>LAB</b></span></a><div className="status-pill"><span/> BUILDS FROM LIVE DATA</div><button className="icon-button mobile-menu" aria-label="Search builds"><Search size={19}/></button></header>
    <div className="page-wrap">
      <section className="hero-section" id="top">
        <div className="eyebrow"><Sparkles size={14}/> THE BUILD WORKSHOP <span className="eyebrow-line"/></div>
        <div className="hero-heading"><div><h1>Make every soul<br/><em>count.</em></h1><p>Data-backed builds, tuned to the way each hero fights.</p></div><div className="data-seal"><span>PATCH</span><b>LIVE</b><small>ANALYTICS</small></div></div>
      </section>
      <section className="hero-picker-area">
        <div className="hero-label">CHOOSE YOUR HERO <span>{snapshot.heroes.length} ACTIVE</span></div>
        <div className="picker-wrap"><button className={`hero-picker ${pickerOpen?'is-open':''}`} onClick={()=>setPickerOpen(v=>!v)} aria-expanded={pickerOpen}><img src={publicPath(hero.images?.local_icon_image_small_webp??hero.images?.icon_image_small_webp??hero.images?.icon_image_small)} alt=""/><span className="hero-picker-copy"><small>BUILDING FOR</small><b>{hero.name}</b></span><ChevronDown size={18} className="chevron"/></button>
        {pickerOpen&&<div className="hero-menu"><div className="searchbox"><Search size={16}/><input autoFocus placeholder="Find a hero…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="hero-menu-list">{filteredHeroes.map(h=><button key={h.id} onClick={()=>chooseHero(h.id)} className={h.id===heroId?'chosen':''}><img src={h.images?.local_icon_image_small_webp??h.images?.icon_image_small_webp??h.images?.icon_image_small} alt=""/><span>{h.name}</span>{h.id===heroId&&<Check size={16}/>}</button>)}</div></div>}</div>
        <div className="hero-picker-note"><span className="online-dot"/> Builds generated from aggregate match data</div>
      </section>
      <section className="build-section">
        <div className="section-heading"><div><div className="eyebrow"><span className="flame-dot"/> RECOMMENDED BUILDS</div><h2>{hero.name}<span className="heading-muted"> / 02 PATHS</span></h2></div><div className="build-switcher"><button aria-label="Previous build" onClick={()=>setBuildIndex((buildIndex+builds.length-1)%builds.length)}><ArrowLeft size={17}/></button><span>{String(buildIndex+1).padStart(2,'0')} <i>/</i> {String(builds.length).padStart(2,'0')}</span><button aria-label="Next build" onClick={()=>setBuildIndex((buildIndex+1)%builds.length)}><ArrowRight size={17}/></button></div></div>
        <article className="build-card"><div className="build-card-head"><div className="build-title-row"><span className={`build-icon build-icon-${buildIndex}`}><Swords size={18}/></span><div><h3>{activeBuild.name}</h3><p>{activeBuild.subtitle}</p></div><span className="build-chip">{buildIndex===0?'WEAPON CORE':'SPIRIT CORE'}</span></div><div className="build-meta"><div><small>EST. MATCH</small><b>{activeBuild.estimatedMatchMinutes} <small>MIN</small></b></div><div><small>ITEM INVESTMENT</small><b>{money(activeBuild.total)}</b></div></div></div>
          <div className="buy-list"><div className="list-caption"><span>ITEM BUILD</span><span>{activeBuild.items.length} ITEMS · {money(activeBuild.total)}</span></div>
            {(['early','mid','late'] as const).map(phase=>{const group=activeBuild.items.filter(row=>row.phase===phase);if(!group.length)return null;return <div className={`phase-group phase-board phase-board-${phase}`} key={phase}><div className={`phase-label phase-${phase}`}><span>{phase==='early'?'01':phase==='mid'?'02':'03'}</span>{phase==='late'?'Late game':`${phase} game`}<i/></div><div className="item-grid">{group.map(row=>{const item=itemsById.get(row.item_id);if(!item)return null;const badge=heroId===1?validation?.reports[activeBuild.id]?.badges[String(item.id)]:false;return <button className={`item-tile tile-${item.item_slot_type}`} key={item.id} onClick={()=>setSelected(item)} aria-label={`${item.name}, tier ${item.item_tier}, ${money(item.cost)}${badge?' — repeated pick':''}`}><span className="tile-index">{String(activeBuild.items.indexOf(row)+1).padStart(2,'0')}</span><span className="tile-tier">{['','I','II','III','IV'][item.item_tier]??item.item_tier}</span><span className="tile-art"><img src={publicPath(item.image_local??item.shop_image??item.image_webp)} alt=""/></span><span className="tile-name">{item.name}</span><span className="tile-price">{money(item.cost)}</span>{heroId===1&&<i className={`tile-badge ${badge?'is-core':''}`}>{badge?'CORE':'·'}</i>}</button>})}</div></div>})}
          </div>
          <div className="build-footer"><div className="soul-total"><span>FULL BUILD</span><b>{money(activeBuild.total)}</b></div><div className="synergy-note"><span className="synergy-mark">✳</span><span><b>{heroId===1?'INFERNUS SYNERGY':'HERO SYNERGY'}</b><small>{heroId===1?(buildIndex===0?'Fire rate stacks Afterburn quickly.':'Spirit power increases burn pressure.'):`Scoring reflects ${hero.name} aggregate picks and kit data.`}</small></span></div></div>
        </article>
        <div className="build-tabs">{builds.map((b,i)=><button className={i===buildIndex?'active':''} key={b.id} onClick={()=>setBuildIndex(i)}><span>{i===0?<Swords size={16}/>:<Flame size={16}/>}</span>{b.name}<i/></button>)}</div>
      </section>
      <section className="lower-grid">
        <article className="ability-card"><div className="panel-head"><div><span className="panel-icon"><Sparkles size={16}/></span><div><span className="eyebrow">LEVEL-UP ROUTE</span><h3>Ability point order</h3></div></div><span className="point-count">16 POINTS</span></div><p className="panel-description">Each marker shows when that ability gets a point. Scroll across the timeline on smaller screens.</p><div className="ability-matrix-scroll"><div className="ability-matrix"><div className="matrix-corner">{hero.name}</div>{activeBuild.abilityOrder.map((_,index)=><span className="matrix-point-head" key={`h-${index}`}>{index+1}</span>)}{abilityRows.map(row=><div className="matrix-row" key={row.index}><div className="matrix-ability" title={row.name}><span className="matrix-icon">{row.ability?.image_local||row.ability?.image_webp||row.ability?.image?<img src={publicPath(row.ability.image_local??row.ability.image_webp??row.ability.image)} alt=""/>:row.index+1}</span><b>{row.name}</b></div>{activeBuild.abilityOrder.map((step,index)=>{const isThis=(row.ability&&step.ability===row.ability.id)||(!row.ability&&step.ability===row.index);return <span className={`matrix-cell ${isThis?'has-point':''} ${isThis&&step.kind==='unlock'?'point-unlock':''}`} key={`${row.index}-${index}`} title={isThis?`Point ${index+1}: ${row.name} ${step.kind==='unlock'?'unlock':`upgrade ${step.level-1}`}`:undefined}>{isThis?<i>{step.kind==='unlock'?'✦':step.level-1}</i>:null}</span>})}</div>)}</div></div></article>
        <article className="validation-card"><div className="panel-head"><div><span className="panel-icon validation-icon"><ShieldCheck size={17}/></span><div><span className="eyebrow">HELD-OUT CHECK</span><h3>Does it hold up?</h3></div></div><span className="lock-badge"><span/> TEST SET</span></div>{heroId===1&&validation?.reports[activeBuild.id]?<><div className="agreement"><b>{validation.reports[activeBuild.id].agreement}<span>%</span></b><div><strong>Build agreement</strong><small>Against {validation.matchCount} sampled matches</small></div></div><div className="agreement-bar"><span style={{width:`${validation.reports[activeBuild.id].agreement}%`}}/></div><p className="validation-copy">Compares aggregate-data builds with Zergggy’s recent Infernus matches: 70% recurring core-item overlap and 30% buy-order agreement. These matches evaluate recommendations; they do not train them.</p><div className="validation-legend"><span><i className="core-badge">CORE</i> Repeated pick</span><span><i className="off-badge">OTHER</i> Flexible / experiment</span></div></>:<div className="validation-empty"><ShieldCheck size={22}/><b>Infernus is the held-out check</b><span>This hero’s build is generated independently from aggregate match analytics.</span></div>}</article>
      </section>
      <footer className="footer"><span>DEADLOCK LAB <i>·</i> BUILD INTELLIGENCE</span><span>SNAPSHOTS · OFFLINE READY</span></footer>
    </div>
    {itemDetail&&<div className="modal-backdrop" role="presentation" onClick={()=>setSelected(null)}><section className="item-modal" role="dialog" aria-modal="true" aria-label={`${itemDetail.name} details`} onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)} aria-label="Close item details"><X size={19}/></button><div className="detail-image"><img src={publicPath(itemDetail.image_local??itemDetail.shop_image??itemDetail.image_webp)} alt={itemDetail.name}/><span>{itemDetail.item_slot_type}</span></div><div className="detail-copy"><span className="eyebrow">ITEM INTEL <i/></span><h2>{itemDetail.name}</h2><div className="detail-meta"><span>{money(itemDetail.cost)}</span><span>TIER {itemDetail.item_tier}</span><span>{itemDetail.item_slot_type.toUpperCase()}</span></div><div className="detail-divider"/><h4>STATS & EFFECTS</h4><div className="stat-lines">{propertyLines(itemDetail).map((line,i)=><div key={`${line.label}-${i}`}><span>{line.label}</span><b>{line.value}</b></div>)}{!propertyLines(itemDetail).length&&<span className="no-stats">See item description for its full effect.</span>}</div>{describe(itemDetail)&&<p className="detail-description">{describe(itemDetail)}</p>}<button className="done-button" onClick={()=>setSelected(null)}>BACK TO BUILD <ArrowDown size={16}/></button></div></section></div>}
  </main>;
}
export default App;

