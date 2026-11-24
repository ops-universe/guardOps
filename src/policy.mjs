// JSON-data contracts; the host owns policy and authenticates the principal.
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const token=x=>typeof x==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(x);
const own=(x,k)=>Object.hasOwn(x,k);
const exact=(x,ks)=>record(x)&&Object.keys(x).length===ks.length&&ks.every(k=>own(x,k)&&Object.getOwnPropertyDescriptor(x,k)?.get===undefined&&Object.getOwnPropertyDescriptor(x,k)?.set===undefined);
const risks=['low','medium','high','critical'];
const effects=['allow','deny','require-review'];
export function validatePolicy(p){
  try {
    if(!exact(p,['schemaVersion','tools','rules'])||p.schemaVersion!==1||!record(p.tools)||!Array.isArray(p.rules)||p.rules.length>1000||Object.keys(p.tools).length>1000)return false;
    for(const k of Object.keys(p.tools)){const d=Object.getOwnPropertyDescriptor(p.tools,k);if(!token(k)||!own(d,'value')||!risks.includes(d.value))return false;}
    const ids=new Set();
    for(const r of p.rules){
      if(!exact(r,['id','role','tool','effect'])||!token(r.id)||ids.has(r.id)||!token(r.role)||!token(r.tool)||!own(p.tools,r.tool)||!effects.includes(r.effect))return false;
      ids.add(r.id);
    }
    return true;
  } catch{return false;}
}
export function evaluate(policy,principal,request){
  const out=(decision,reason,risk=null,matchedRules=[])=>({schemaVersion:1,decision,reason,risk,matchedRules});
  try{
    if(!validatePolicy(policy))return out('deny','invalid-policy');
    if(!exact(principal,['role'])||!token(principal.role)||!exact(request,['tool'])||!token(request.tool))return out('deny','invalid-request');
    if(!own(policy.tools,request.tool))return out('deny','unknown-tool');
    const risk=policy.tools[request.tool];
    const matched=policy.rules.filter(r=>r.role===principal.role&&r.tool===request.tool);
    const ids=matched.map(r=>r.id).sort();
    if(matched.some(r=>r.effect==='deny'))return out('deny','explicit-deny',risk,ids);
    if(!matched.length)return out('deny','no-matching-rule',risk,ids);
    if(risk==='critical')return out('deny','critical-risk',risk,ids);
    if(risk==='high'||risk==='medium'||matched.some(r=>r.effect==='require-review'))return out('require-review','review-required',risk,ids);
    return out('allow','explicit-allow',risk,ids);
  }catch{return out('deny','evaluation-error');}
}
