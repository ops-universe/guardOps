import {evaluate,validatePolicy} from '../../src/policy.mjs';
import {boundedJson,evaluateGuardedTool} from '../../src/guardrails.mjs';
export function parsePolicy(text){try{if(typeof text!=='string'||text.length>65536)return null;const p=JSON.parse(text);return boundedJson(p)&&validatePolicy(p)?p:null;}catch{return null;}}
export function simulateRequest(policy,schemas,role,tool,argsText){try{if(!policy||typeof argsText!=='string'||argsText.length>65536)return {decision:'deny',reason:'invalid-input'};return evaluateGuardedTool(policy,{role},{tool,args:JSON.parse(argsText)},schemas,evaluate);}catch{return {decision:'deny',reason:'invalid-input'};}}
export function permissionMatrix(policy){if(!policy||!validatePolicy(policy))return [];const roles=[...new Set(policy.rules.map(r=>r.role))].sort().slice(0,30);return roles.flatMap(role=>Object.keys(policy.tools).sort().slice(0,30).map(tool=>({role,tool,...evaluate(policy,{role},{tool})})));}
export function reviewDemo(state,action){if(!state||state.status!=='pending'||!['approve','reject'].includes(action))return state;return {...state,status:action==='approve'?'approved-demo':'rejected-demo'};}
