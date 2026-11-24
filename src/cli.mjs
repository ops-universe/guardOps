import {openSync,readSync,closeSync,fstatSync,constants} from 'node:fs';
import {evaluate} from './policy.mjs';
function readJson(path){
  const fd=openSync(path,constants.O_RDONLY|constants.O_NONBLOCK);
  try{
    if(!fstatSync(fd).isFile())throw Error('regular file required');
    const b=Buffer.alloc(65537);let n=0;
    while(n<b.length){const got=readSync(fd,b,n,b.length-n,null);if(!got)break;n+=got;}
    if(n>65536)throw Error('input limit');
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,n)));
  }finally{closeSync(fd);}
}
try{
  if(process.argv.length!==4)throw Error('usage');
  const policy=readJson(process.argv[2]),fixture=readJson(process.argv[3]);
  const result=evaluate(policy,fixture?.principal,fixture?.request);
  console.log(JSON.stringify(result,null,2));
  process.exitCode=({allow:0,deny:2,'require-review':3})[result.decision];
}catch{console.error('guardOps: invalid input or invocation; no authorization');process.exitCode=1;}
