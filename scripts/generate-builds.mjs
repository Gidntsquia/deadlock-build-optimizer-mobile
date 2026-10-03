import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBuilds } from '../src/generator.ts';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=async name=>JSON.parse(await readFile(join(root,'public','data',name),'utf8'));
const [items,heroes,analytics]=await Promise.all(['items.json','heroes.json','analytics.json'].map(read));
const snapshot={items,heroes,analytics};
const builds=Object.fromEntries(heroes.map(hero=>[String(hero.id),generateBuilds(snapshot,hero.id)]));
await writeFile(join(root,'public','data','generated-builds.json'),JSON.stringify(builds));
console.log(`Generated ${Object.keys(builds).length} heroes from aggregate analytics only.`);
