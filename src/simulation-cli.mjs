import {openSync,readSync,closeSync,fstatSync,constants} from 'node:fs';
import {simulate,compareReports} from './simulation.mjs';
function load(path){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK);
 try{if(!fstatSync(fd).isFile())throw Error('regular file required');const b=Buffer.alloc(65537);let n=0;while(n<b.length){const k=readSync(fd,b,n,b.length-n,null);if(!k)break;n+=k;}if(n>65536)throw Error('limit');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,n)));}finally{closeSync(fd);}
}
try{
 const [command,...args]=process.argv.slice(2);let report,pass;
 if(command==='simulate'&&args.length===3){report=simulate(...args.map(load));pass=report.failed===0;}
 else if(command==='compare'&&args.length===2){report=compareReports(...args.map(load));pass=report.pass;}
 else throw Error('usage');
 console.log(JSON.stringify(report,null,2));process.exitCode=pass?0:2;
}catch{console.error('guardOps: invalid simulation input or invocation');process.exitCode=1;}
