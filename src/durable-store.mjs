import {openSync,closeSync,readFileSync,writeFileSync,fsyncSync,renameSync,unlinkSync,lstatSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
// Trusted private local directory, one transaction at a time. Crash-stale lock intentionally fails closed.
export function createDurableStore({directory,key,name,initial}){
 if(!Buffer.isBuffer(key)||key.length<32||!['approvals','audit'].includes(name)||typeof directory!=='string')throw Error('invalid store configuration');
 const secret=Buffer.from(key),dir=resolve(directory);mkdirSync(dir,{recursive:true,mode:0o700});
 const ds=lstatSync(dir);if(!ds.isDirectory()||ds.isSymbolicLink()||(ds.mode&0o077)!==0)throw Error('private directory required');
 const path=join(dir,name+'.json'),lock=path+'.lock',limit=8*1024*1024;
 const mac=body=>createHmac('sha256',secret).update(body).digest('hex');
 function read(){
  let st;try{st=lstatSync(path);}catch(e){if(e.code==='ENOENT')throw Error('missing state; explicit initialization required');throw e;}
  if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0||st.size>limit)throw Error('invalid state file');
  const envelope=JSON.parse(readFileSync(path,'utf8'));
  if(typeof envelope.body!=='string'||typeof envelope.mac!=='string'||!/^[a-f0-9]{64}$/.test(envelope.mac)||!timingSafeEqual(Buffer.from(mac(envelope.body),'hex'),Buffer.from(envelope.mac,'hex')))throw Error('state integrity failure');
  const decoded=JSON.parse(envelope.body);if(decoded.name!==name||decoded.version!==1)throw Error('state domain mismatch');return decoded.state;
 }
 function write(state){
  const body=JSON.stringify({name,version:1,state}),data=JSON.stringify({body,mac:mac(body)});
  if(Buffer.byteLength(data)>limit)throw Error('store capacity exceeded');
  const temp=path+'.'+randomUUID()+'.tmp';let fd;
  try{fd=openSync(temp,'wx',0o600);writeFileSync(fd,data);fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temp,path);const d=openSync(dir,'r');try{fsyncSync(d);}finally{closeSync(d);}}finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
 }
 function locked(fn){const fd=openSync(lock,'wx',0o600);try{return fn();}finally{closeSync(fd);unlinkSync(lock);}}
 return Object.freeze({
 initialize(){return locked(()=>{try{lstatSync(path);throw Error('state already exists');}catch(e){if(e.code!=='ENOENT')throw e;}write(structuredClone(initial));});},
 transaction(fn){return locked(()=>{const state=read();const result=fn(state);write(state);return result;});},
 snapshot(){return locked(read);}
 });
}
