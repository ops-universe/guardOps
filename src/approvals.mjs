import {createHash,randomUUID} from 'node:crypto';
import {boundedJson,evaluateGuardedTool} from './guardrails.mjs';
import {evaluate} from './policy.mjs';
const token=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(x);
function canonical(x){if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';}
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
const deny=reason=>({decision:'deny',reason});
// In-memory single-process ledger. Authentication and execution are trusted host responsibilities.
export function createApprovalLedger({policy,schemas,reviewerIds,clock=Date.now,maxTtlMs=300000,maxRecords=1000,internalState=null}){
  if(!boundedJson(policy)||!boundedJson(schemas)||!Array.isArray(reviewerIds)||!reviewerIds.length||!reviewerIds.every(token)||!Number.isSafeInteger(maxTtlMs)||maxTtlMs<1||maxTtlMs>3600000||!Number.isSafeInteger(maxRecords)||maxRecords<1||maxRecords>10000)throw Error('invalid configuration');
  const p=structuredClone(policy),s=structuredClone(schemas),reviewers=new Set(reviewerIds),revision=hash({policy:p,schemas:s}),records=new Map(internalState?.records??[]);
  const persist=()=>{if(internalState){internalState.records=[...records.entries()];internalState.lastTime=lastTime;}};
  const now=()=>{const n=clock();if(!Number.isSafeInteger(n)||n<0||n>Number.MAX_SAFE_INTEGER-maxTtlMs)throw Error('invalid clock');return n;};
  let lastTime=internalState?.lastTime??-1;
  const time=()=>{const n=now();if(n<lastTime)throw Error('clock rollback');lastTime=n;persist();return n;};
  function scope(principal,request){
    if(!boundedJson(principal)||!token(principal?.id)||!token(principal?.role)||Object.keys(principal).length!==2||!boundedJson(request))throw Error('invalid scope');
    return hash({revision,principal,request});
  }
  const decision=(principal,request)=>evaluateGuardedTool(p,{role:principal.role},request,s,evaluate);
  function requestApproval(principal,request,ttlMs=maxTtlMs){
    try{
      const fingerprint=scope(principal,request);
      if(decision(principal,request).decision!=='require-review')return deny('review-not-required');
      if(!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>maxTtlMs)return deny('invalid-ttl');
      const n=time();
      for(const [id,r] of records)if(r.expiresAt<=n)records.delete(id);
      if(records.size>=maxRecords)return deny('ledger-full');
      const id=randomUUID(),r={id,scope:fingerprint,requester:principal.id,expiresAt:n+ttlMs,status:'pending'};
      records.set(id,r);persist();return {decision:'require-review',id,expiresAt:r.expiresAt};
    }catch{return deny('invalid-approval-request');}
  }
  function review(id,reviewer,approve){
    try{
      const n=time(),r=records.get(id);
      // Reviewer ID must be obtained from trusted authentication, never model input.
      if(!r||r.expiresAt<=n||r.status!=='pending'||!reviewers.has(reviewer)||reviewer===r.requester||typeof approve!=='boolean')return deny('review-rejected');
      r.status=approve?'approved':'rejected';r.reviewer=reviewer;persist();
      return {status:r.status,id};
    }catch{return deny('review-error');}
  }
  function consume(id,principal,request){
    try{
      const n=time(),fingerprint=scope(principal,request),r=records.get(id);
      if(!r||r.expiresAt<=n||r.status!=='approved'||!reviewers.has(r.reviewer)||r.scope!==fingerprint||decision(principal,request).decision!=='require-review')return deny('approval-invalid');
      // Synchronous check-and-consume: no await before state transition.
      r.status='consumed';persist(); return {decision:'allow',reason:'approval-consumed',id,revision};
    }catch{return deny('consume-error');}
  }
  function listPending(){
    try{const n=time();return [...records.values()].filter(r=>r.status==='pending'&&r.expiresAt>n).map(({id,requester,expiresAt,scope})=>({id,requester,expiresAt,scope}));}catch{return [];}
  }
  return Object.freeze({requestApproval,review,consume,listPending,revision});
}
