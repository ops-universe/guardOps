import {boundedJson,evaluateGuardedTool,validatePayload} from './guardrails.mjs';
import {evaluate,validatePolicy} from './policy.mjs';
const token=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(x);
const deny=reason=>({decision:'deny',reason,executed:false});
export function createGateway({policy,schemas,handlers,outputSchemas,approvalLedger,audit}){
 if(!boundedJson(policy)||!validatePolicy(policy)||!boundedJson(schemas)||!boundedJson(outputSchemas)||!handlers||typeof audit?.append!=='function')throw Error('invalid gateway configuration');
 const p=structuredClone(policy),s=structuredClone(schemas),o=structuredClone(outputSchemas);
 const registry=new Map(Object.entries(handlers));
 for(const [name,fn] of registry)if(!token(name)||typeof fn!=='function'||!Object.hasOwn(p.tools,name)||!Object.hasOwn(s,name)||!Object.hasOwn(o,name))throw Error('invalid handler registration');
 function log(result){try{audit.append({decision:result.decision,reason:result.reason});return true;}catch{return false;}}
 return Object.freeze({async execute(principal,request,approvalId){
  if(!boundedJson(principal)||!token(principal?.id)||!token(principal?.role)||Object.keys(principal).length!==2||!boundedJson(request))return deny('invalid-request');
  // Snapshot JSON data before evaluating or awaiting external code.
  const actor=structuredClone(principal),action=structuredClone(request);
  let result=evaluateGuardedTool(p,{role:actor.role},action,s,evaluate);
  if(!registry.has(action.tool))result={decision:'deny',reason:'handler-not-registered'};
  if(result.decision==='require-review'){
   if(!approvalId){if(!log(result))return deny('audit-unavailable');return {...result,executed:false};}
   try{result=approvalLedger?.consume(approvalId,actor,action)??deny('approval-unavailable');}catch{return deny('approval-unavailable');}
  }
  if(result.decision!=='allow'){if(!log(result))return deny('audit-unavailable');return {...result,executed:false};}
  if(!log(result))return deny('audit-unavailable');
  try{
   const output=await registry.get(action.tool)(structuredClone(action.args));
   if(!validatePayload(output,o[action.tool]).valid)return {decision:'deny',reason:'invalid-handler-output',executed:true};
   return {decision:'allow',reason:result.reason,executed:true,output:structuredClone(output)};
  }catch{return {decision:'deny',reason:'handler-failed',executed:true};}
 }});
}
