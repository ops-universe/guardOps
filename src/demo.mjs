import {evaluate} from './policy.mjs';
import {readFileSync} from 'node:fs';
const p=JSON.parse(readFileSync(new URL('../examples/policy.json',import.meta.url),'utf8'));
for(const tool of ['lookup','refund','delete'])console.log(JSON.stringify(evaluate(p,{role:'support'},{tool})));
