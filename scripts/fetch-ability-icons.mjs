import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=join(root,'public');
const dataDir=join(publicDir,'data');
const items=JSON.parse(await readFile(join(dataDir,'items.json'),'utf8'));
const heroes=JSON.parse(await readFile(join(dataDir,'heroes.json'),'utf8'));
const classes=new Set(heroes.flatMap(hero=>['signature1','signature2','signature3','signature4'].map(key=>hero.items?.[key]).filter(Boolean)));
const abilities=items.filter(item=>item.type==='ability'&&classes.has(item.class_name));
let next=0;
await Promise.all(Array.from({length:8},async()=>{
  while(next<abilities.length){
    const ability=abilities[next++];
    for(const url of [ability.image_webp,ability.image].filter(Boolean)){
      try{
        const response=await fetch(url);
        if(!response.ok)throw new Error(`${response.status} ${url}`);
        const extension=new URL(url).pathname.split('.').pop()||'webp';
        const relative=`assets/abilities/${ability.id}.${extension}`;
        const target=join(publicDir,relative);
        await mkdir(dirname(target),{recursive:true});
        await writeFile(target,new Uint8Array(await response.arrayBuffer()));
        ability.image_local=`/${relative}`;
        break;
      }catch(error){
        if(url===[ability.image_webp,ability.image].filter(Boolean).at(-1))console.warn(`No image for ${ability.name}: ${error.message}`);
      }
    }
  }
}));
await writeFile(join(dataDir,'items.json'),JSON.stringify(items));
console.log(`Saved icons for ${abilities.filter(ability=>ability.image_local).length} of ${abilities.length} hero abilities.`);
