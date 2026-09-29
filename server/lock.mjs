import {openSync,closeSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import path from 'node:path';
export function acquireWorkspace(dir) {
 const file=path.join(dir,'workspace.lock');
 const create=()=>{const fd=openSync(file,'wx',0o600);try{writeFileSync(fd,String(process.pid));}finally{closeSync(fd);}};
 try{create();}catch(e){
   if(e.code!=='EEXIST')throw e;
   const pid=Number(readFileSync(file,'utf8'));let active=true;
   if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')active=false;}}
   if(active)throw new Error('This workspace is already open or has an unverifiable lock. Stop its server before reopening.');
   unlinkSync(file);create();
 }
 let closed=false;
 return ()=>{if(closed)return;closed=true;try{if(readFileSync(file,'utf8')===String(process.pid))unlinkSync(file);}catch{}};
}
