import {createApprovalLedger} from './approvals.mjs';
import {readFileSync} from 'node:fs';
import {createInterface} from 'node:readline/promises';
const policy=JSON.parse(readFileSync(new URL('../examples/policy.json',import.meta.url),'utf8'));
const ledger=createApprovalLedger({policy,schemas:{refund:{type:'object',properties:{amount:{type:'integer',minimum:1,maximum:100}},required:['amount']}},reviewerIds:['synthetic-reviewer']});
const principal={id:'synthetic-agent',role:'support'},request={tool:'refund',args:{amount:25}};
const approval=ledger.requestApproval(principal,request);
console.log('SYNTHETIC DEMO ONLY — terminal operator is not authenticated. No tool is executed.',approval,request);
if(approval.decision==='require-review'){
 const rl=createInterface({input:process.stdin,output:process.stdout});
 try{const answer=await rl.question('Approve this exact synthetic refund? Type APPROVE: ');console.log(ledger.review(approval.id,'synthetic-reviewer',answer==='APPROVE'));console.log(ledger.consume(approval.id,principal,request));}finally{rl.close();}
}
