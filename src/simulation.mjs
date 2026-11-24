import {createHash} from 'node:crypto';
import {boundedJson,evaluateGuardedTool} from './guardrails.mjs';
import {evaluate,validatePolicy} from './policy.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const decisions=['allow','deny','require-review'];
const token=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(x);
export function simulate(policy,schemas,cases){
 if(!boundedJson(policy)||!validatePolicy(policy)||!boundedJson(schemas)||!boundedJson(cases)||!Array.isArray(cases)||cases.length>500)throw Error('invalid simulation');
 const ids=new Set();
 const records=cases.map(c=>{
  if(!c||!token(c.id)||ids.has(c.id)||!decisions.includes(c.expected)||!Object.hasOwn(c,'principal')||!Object.hasOwn(c,'request'))throw Error('invalid case');
  ids.add(c.id);
  const result=evaluateGuardedTool(policy,c.principal,c.request,schemas,evaluate);
  const actual=decisions.includes(result.decision)?result.decision:'deny';
  // Deliberately omit input, arguments, principal identifiers and raw text.
  return {id:c.id,expected:c.expected,actual,pass:c.expected===actual,reason:result.reason,risk:result.risk??null,matchedRules:result.matchedRules??[]};
 });
 return {schemaVersion:1,mode:'dry-run',policyFingerprint:hash({policy,schemas}),total:records.length,passed:records.filter(r=>r.pass).length,failed:records.filter(r=>!r.pass).length,records};
}
export function compareReports(baseline,current){
 const validate=r=>r&&r.schemaVersion===1&&r.mode==='dry-run'&&Array.isArray(r.records)&&r.records.length<=500&&new Set(r.records.map(x=>x.id)).size===r.records.length&&r.records.every(x=>token(x.id)&&decisions.includes(x.actual)&&decisions.includes(x.expected)&&x.pass===(x.actual===x.expected));
 if(!boundedJson(baseline)||!boundedJson(current)||!validate(baseline)||!validate(current))throw Error('invalid report');
 const old=new Map(baseline.records.map(r=>[r.id,r])),next=new Map(current.records.map(r=>[r.id,r]));
 const removed=[...old.keys()].filter(id=>!next.has(id)).sort(),added=[...next.keys()].filter(id=>!old.has(id)).sort();
 const changes=current.records.filter(r=>old.has(r.id)&&(old.get(r.id).actual!==r.actual||old.get(r.id).expected!==r.expected)).map(r=>({id:r.id,before:old.get(r.id).actual,after:r.actual,expectedChanged:old.get(r.id).expected!==r.expected}));
 return {schemaVersion:1,removed,added,changes,regressions:current.records.filter(r=>!r.pass).map(r=>r.id),pass:removed.length===0&&changes.length===0&&current.records.every(r=>r.pass)};
}
export function createAuditBuffer({capacity=1000,clock=Date.now}={}){
 if(!Number.isSafeInteger(capacity)||capacity<1||capacity>10000)throw Error('invalid capacity');
 const rows=[];let sequence=0;
 return Object.freeze({
 append(result){
  if(!boundedJson(result)||!decisions.includes(result.decision)||!token(result.reason)||!Number.isSafeInteger(sequence+1))throw Error('invalid decision evidence');
  if(rows.length>=capacity)throw Error('audit capacity exhausted');
  const timestamp=clock();if(!Number.isSafeInteger(timestamp)||timestamp<0)throw Error('invalid timestamp');
  const row={schemaVersion:1,sequence:++sequence,timestamp,decision:result.decision,reason:result.reason,previous:rows.at(-1)?.digest??null};
  row.digest=hash(row);rows.push(Object.freeze(row));return {...row};
 },
 snapshot(){return rows.map(r=>({...r}));}
 });
}
export function verifyAudit(rows){
 if(!boundedJson(rows)||!Array.isArray(rows))return false;
 let previous=null,sequence=0;
 for(const row of rows){
  if(!row||Object.keys(row).length!==7||row.schemaVersion!==1||row.sequence!==++sequence||row.previous!==previous||!decisions.includes(row.decision)||!token(row.reason)||!Number.isSafeInteger(row.timestamp)||row.timestamp<0)return false;
  const {digest,...body}=row;if(hash(body)!==digest)return false;previous=digest;
 }
 return true;
}
