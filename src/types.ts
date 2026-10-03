export type Item = {
  id: number; class_name: string; name: string; type?: string; cost: number; item_tier: number; image?: string;
  item_slot_type: string; shop_image?: string; image_webp?: string; image_local?: string; properties?: Record<string, any>;
  tooltip_sections?: Array<{ section_type?: string; section_attributes?: Array<{ loc_string?: string; properties?: string[]; important_properties?: string[]; elevated_properties?: string[] }> }>;
  description?: { desc?: string; quip?: string; t2_desc?: string; t3_desc?: string };
};
export type Hero = { id: number; name: string; class_name: string; disabled?: boolean; player_selectable?: boolean; development_state?: string; images?: Record<string,string>; items?: Record<string,string>; popular_items?: Record<string, Array<{item_id:number; pick_pct:number; winrate_pct:number}>>; starting_stats?: Record<string, {value:number}>; standard_level_up_upgrades?: Record<string,number> };
export type ItemStat = { item_id: number; bucket: number; wins: number; losses: number; matches: number; players: number; avg_buy_time_s: number; avg_buy_time_relative: number };
export type AbilityStat = { abilities:number[]; wins:number; losses:number; matches:number };
export type Match = { match_id:number; hero_id:number; game_mode:number; match_mode:number; match_duration_s:number; player_match_outcome:number; start_time:number };
export type Snapshot = { items:Item[]; heroes:Hero[]; analytics:Record<string,{itemStats:ItemStat[]; abilityOrderStats:AbilityStat[]}> };
export type ValidationSnapshot = { matches:Match[]; purchases:Array<{match_id:number;duration_s:number;won:boolean;items:Array<{item_id:number;game_time_s:number}>}> };
export type BuildItem = { item_id:number; phase:'early'|'mid'|'late'; running_total:number };
export type Build = { id:string; name:string; subtitle:string; items:BuildItem[]; abilityOrder:Array<{ability:number;level:number;kind:'unlock'|'upgrade'}>; total:number; estimatedMatchMinutes:number };
export type Generated = { hero_id:number; builds:Build[] };
export type Validation = { threshold:number; matchCount:number; core:Array<{item_id:number;frequency:number;weightedFrequency:number;firstAverageTime:number}>; reports:Record<string,{agreement:number;overlap:number;orderAgreement:number;badges:Record<string,boolean>}> };
