import {readFileSync,writeFileSync,mkdirSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {validateState} from './store.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function durableWrite(file,bytes){
 const fd=openSync(file,'wx',0o600);
 try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
 if(!readFileSync(file).equals(Buffer.from(bytes)))throw Error('Saved bytes did not match. Preserve the file for investigation.');
}
export function verifyBackup(file){
 const envelope=JSON.parse(readFileSync(file,'utf8'));
 if(envelope.format!=='boundary-backup-v1'||typeof envelope.payload!=='string'||digest(envelope.payload)!==envelope.sha256)throw Error('Backup checksum or format is invalid. No workspace was changed.');
 const state=validateState(JSON.parse(envelope.payload));
 return {envelope,state};
}
export function createBackup(workspace,destination){
 // Read one complete atomic state snapshot; no SQL is executed and no lock is modified.
 const payload=readFileSync(path.join(workspace,'state.json'),'utf8');
 const state=validateState(JSON.parse(payload));
 const envelope={format:'boundary-backup-v1',createdAt:new Date().toISOString(),sha256:digest(payload),payload};
 durableWrite(destination,JSON.stringify(envelope,null,2));
 verifyBackup(destination);
 return {file:path.resolve(destination),projects:state.projects.length,runs:state.runs.length,sha256:envelope.sha256};
}
export function restoreBackup(file,destination){
 const {envelope,state}=verifyBackup(file);
 // Recovery only creates a NEW directory, never overwrites an existing workspace.
 mkdirSync(destination,{recursive:false,mode:0o700});
 durableWrite(path.join(destination,'state.json'),envelope.payload);
 validateState(JSON.parse(readFileSync(path.join(destination,'state.json'),'utf8')));
 return {directory:path.resolve(destination),projects:state.projects.length,runs:state.runs.length,sha256:envelope.sha256};
}
