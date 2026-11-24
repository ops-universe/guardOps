// Bounded JSON-data validation. Not a prompt-injection security boundary.
const own=(o,k)=>Object.hasOwn(o,k);
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const names=['string','number','integer','boolean','null','object','array'];
const exact=(o,allowed)=>record(o)&&Object.keys(o).every(k=>allowed.includes(k));
const safeKey=k=>!['__proto__','constructor','prototype'].includes(k);
export function boundedJson(value,{maxDepth=12,maxNodes=4096,maxBytes=65536}={}){
  let nodes=0,bytes=0;
  function visit(v,depth){
    if(++nodes>maxNodes||depth>maxDepth)return false;
    if(v===null||typeof v==='boolean')return true;
    if(typeof v==='number')return Number.isFinite(v);
    if(typeof v==='string'){bytes+=Buffer.byteLength(v);return bytes<=maxBytes;}
    if(!Array.isArray(v)&&!record(v))return false;
    for(const k of Object.keys(v)){
      if(!safeKey(k))return false;
      bytes+=Buffer.byteLength(k);if(bytes>maxBytes)return false;
      const d=Object.getOwnPropertyDescriptor(v,k);
      if(!d||!own(d,'value')||!visit(d.value,depth+1))return false;
    }
    if(Array.isArray(v)&&v.length!==Object.keys(v).length)return false;
    return true;
  }
  try{return visit(value,0)&&Buffer.byteLength(JSON.stringify(value))<=maxBytes;}catch{return false;}
}
function validSchema(s,depth=0){
  if(depth>12||!exact(s,['type','properties','required','items','maxLength','maxItems','minimum','maximum','enum'])||!names.includes(s.type))return false;
  const allowed={string:['maxLength'],number:['minimum','maximum'],integer:['minimum','maximum'],boolean:[],null:[],object:['properties','required'],array:['items','maxItems']}[s.type];
  if(!Object.keys(s).every(k=>['type','enum',...allowed].includes(k)))return false;
  for(const k of ['maxLength','maxItems'])if(own(s,k)&&(!Number.isSafeInteger(s[k])||s[k]<0))return false;
  for(const k of ['minimum','maximum'])if(own(s,k)&&!Number.isFinite(s[k]))return false;
  if(own(s,'minimum')&&own(s,'maximum')&&s.minimum>s.maximum)return false;
  if(own(s,'enum')&&(!Array.isArray(s.enum)||!s.enum.length||!s.enum.every(x=>x===null||['string','number','boolean'].includes(typeof x))))return false;
  if(s.type==='object'){
    if(!record(s.properties)||!Array.isArray(s.required)||new Set(s.required).size!==s.required.length||!s.required.every(k=>typeof k==='string'&&own(s.properties,k)))return false;
    if(!Object.entries(s.properties).every(([k,v])=>safeKey(k)&&validSchema(v,depth+1)))return false;
  }
  if(s.type==='array'&&!validSchema(s.items,depth+1))return false;
  return true;
}
function matches(v,s){
  const t=s.type;
  if(t==='object'&&!record(v)||t==='array'&&!Array.isArray(v)||t==='null'&&v!==null||t==='integer'&&!Number.isSafeInteger(v)||['string','number','boolean'].includes(t)&&typeof v!==t)return false;
  if(own(s,'enum')&&!s.enum.includes(v))return false;
  if(t==='string'&&own(s,'maxLength')&&v.length>s.maxLength)return false;
  if(['number','integer'].includes(t)&&((own(s,'minimum')&&v<s.minimum)||(own(s,'maximum')&&v>s.maximum)))return false;
  if(t==='array')return (!own(s,'maxItems')||v.length<=s.maxItems)&&v.every(x=>matches(x,s.items));
  if(t==='object')return s.required.every(k=>own(v,k))&&Object.keys(v).every(k=>own(s.properties,k)&&matches(v[k],s.properties[k]));
  return true;
}
export function validatePayload(value,schema){
  try{
    if(!boundedJson(schema)||!validSchema(schema))return {valid:false,reason:'invalid-schema'};
    if(!boundedJson(value))return {valid:false,reason:'payload-limit-or-invalid'};
    return matches(value,schema)?{valid:true,reason:'valid'}:{valid:false,reason:'schema-mismatch'};
  }catch{return {valid:false,reason:'validation-error'};}
}
const detectors={
  email:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  'credential-like':/\b(?:api[_ -]?key|password|secret|access[_ -]?token)\s*[:=]\s*\S{4,}/i,
  'card-like':/\b(?:\d[ -]?){13,19}\b/,
  'instruction-override':/\b(?:ignore|disregard|override)\b.{0,80}\b(?:previous|prior|system|developer)\b/i,
  'instruction-extraction':/\b(?:reveal|print|show|expose)\b.{0,80}\b(?:system prompt|hidden instructions|developer message)\b/i
};
export function inspectText(text,config={}){
  const fail=reason=>({valid:false,reason,signals:[],securityGuarantee:false});
  try{
    if(!boundedJson(config)||!exact(config,['enabled','maxBytes']))return fail('invalid-config');
    const enabled=own(config,'enabled')?config.enabled:Object.keys(detectors);
    const maxBytes=own(config,'maxBytes')?config.maxBytes:16384;
    if(!Array.isArray(enabled)||enabled.length>Object.keys(detectors).length||new Set(enabled).size!==enabled.length||!enabled.every(k=>typeof k==='string'&&own(detectors,k))||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>65536)return fail('invalid-config');
    if(typeof text!=='string'||Buffer.byteLength(text)>maxBytes)return fail('text-limit-or-invalid');
    return {valid:true,reason:'inspected',signals:enabled.filter(k=>detectors[k].test(text)).sort(),securityGuarantee:false};
  }catch{return fail('inspection-error');}
}
export function evaluateGuardedTool(policy,principal,request,schemas,evaluate){
  // The evaluator and schema registry must be trusted host dependencies.
  try{
    if(typeof evaluate!=='function'||!boundedJson(request)||!exact(request,['tool','args'])||typeof request.tool!=='string'||!own(request,'args')||!record(schemas)||!own(schemas,request.tool))return {decision:'deny',reason:'invalid-tool-request'};
    const validation=validatePayload(request.args,schemas[request.tool]);
    if(!validation.valid)return {decision:'deny',reason:validation.reason};
    return evaluate(policy,principal,{tool:request.tool});
  }catch{return {decision:'deny',reason:'guardrail-error'};}
}
