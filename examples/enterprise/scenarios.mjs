import {createGateway} from '../../src/gateway.mjs';
import {createApprovalLedger} from '../../src/approvals.mjs';
import {createAuditBuffer} from '../../src/simulation.mjs';
export function createSyntheticEnterprise(){
 const id={type:'string',maxLength:32};
 const shape=(properties,required=Object.keys(properties))=>({type:'object',properties,required});
 const tools={lookupAccount:'low',issueRefund:'high',readSupplier:'low',approveSupplier:'high',deleteSupplier:'critical'};
 const rules=[['support','lookupAccount'],['support','issueRefund'],['procurement','readSupplier'],['procurement','approveSupplier'],['procurement','deleteSupplier']].map(([role,tool],i)=>({id:'rule-'+i,role,tool,effect:'allow'}));
 const policy={schemaVersion:1,tools,rules};
 const schemas={lookupAccount:shape({id}),issueRefund:shape({id,amount:{type:'integer',minimum:1,maximum:100}}),readSupplier:shape({id}),approveSupplier:shape({id}),deleteSupplier:shape({id})};
 const outputSchemas=Object.fromEntries(Object.keys(tools).map(t=>[t,shape({status:{type:'string',enum:['synthetic-ok']}})]));
 const calls=[];
 const handlers=Object.fromEntries(Object.keys(tools).map(t=>[t,async args=>{calls.push({tool:t,args});return {status:'synthetic-ok'};}]));
 const approvalLedger=createApprovalLedger({policy,schemas,reviewerIds:['synthetic-human']});
 const audit=createAuditBuffer();
 const gateway=createGateway({policy,schemas,handlers,outputSchemas,approvalLedger,audit});
 return {gateway,approvalLedger,audit,calls};
}
