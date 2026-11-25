import {createDurableStore} from './durable-store.mjs';
import {createApprovalLedger} from './approvals.mjs';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const deny=reason=>({decision:'deny',reason});
export function createPersistentApprovalLedger({directory,key,...config}){
 const fixed={...config,policy:structuredClone(config.policy),schemas:structuredClone(config.schemas),reviewerIds:[...config.reviewerIds]};
 const probe=createApprovalLedger(fixed);
 const initial={revision:probe.revision,lastTime:-1,records:[]};
 const store=createDurableStore({directory,key,name:'approvals',initial});
 function call(method,args){try{return store.transaction(state=>{
  if(state.revision!==probe.revision||!Array.isArray(state.records)||!Number.isSafeInteger(state.lastTime))throw Error('invalid approval state');
  const ledger=createApprovalLedger({...fixed,internalState:state});
  return ledger[method](...args);
 });}catch{return method==='listPending'?[]:deny('approval-store-unavailable');}}
 return Object.freeze({revision:probe.revision,initialize:()=>store.initialize(),requestApproval:(...a)=>call('requestApproval',a),review:(...a)=>call('review',a),consume:(...a)=>call('consume',a),listPending:()=>call('listPending',[])});
}
export function createPersistentAudit({directory,key,capacity=1000,clock=Date.now}){
 if(!Number.isSafeInteger(capacity)||capacity<1||capacity>10000)throw Error('invalid capacity');
 const store=createDurableStore({directory,key,name:'audit',initial:{rows:[]}});
 const decisions=['allow','deny','require-review'];
 const reasons=new Set(['invalid-policy','invalid-request','unknown-tool','explicit-deny','no-matching-rule','critical-risk','review-required','explicit-allow','evaluation-error','invalid-tool-request','invalid-schema','payload-limit-or-invalid','schema-mismatch','validation-error','guardrail-error','handler-not-registered','approval-unavailable','approval-invalid','consume-error','approval-store-unavailable','approval-consumed','audit-unavailable','handler-failed','invalid-handler-output']);
 function verify(rows){if(!Array.isArray(rows)||rows.length>capacity)throw Error('invalid audit state');let prev=null;for(const [i,r] of rows.entries()){const {digest,...body}=r;if(r.sequence!==i+1||r.previous!==prev||hash(body)!==digest||!decisions.includes(r.decision)||!reasons.has(r.reason))throw Error('audit integrity failure');prev=digest;}}
 return Object.freeze({initialize:()=>store.initialize(),append(result){return store.transaction(state=>{verify(state.rows);if(state.rows.length>=capacity||!decisions.includes(result.decision)||!reasons.has(result.reason))throw Error('invalid or full audit');const timestamp=clock();if(!Number.isSafeInteger(timestamp)||timestamp<0||timestamp<(state.rows.at(-1)?.timestamp??0))throw Error('invalid timestamp');const row={schemaVersion:1,sequence:state.rows.length+1,timestamp,decision:result.decision,reason:result.reason,previous:state.rows.at(-1)?.digest??null};row.digest=hash(row);state.rows.push(row);return row;});},snapshot(){const state=store.snapshot();verify(state.rows);return state.rows;}});
}
