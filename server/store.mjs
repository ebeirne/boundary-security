import {readFileSync,writeFileSync,renameSync,existsSync,copyFileSync,openSync,fsyncSync,closeSync} from 'node:fs';
import path from 'node:path';
import {validateProject} from './validation.mjs';
import {verifyIntegrity} from './engine.mjs';

export function validateState(state) {
  if(state && Object.hasOwn(state,'formatVersion') && state.formatVersion!==1)throw new Error('Unsupported workspace format. Use a compatible Boundary release; original files must be preserved.');
  if(!state || !Array.isArray(state.projects)||!Array.isArray(state.runs)||!state.projects.length||state.projects.length>20||state.runs.length>250)throw new Error('Workspace structure is invalid.');
  const ids=new Set();
  for(const p of state.projects){validateProject(p);if(!/^[a-zA-Z0-9-]+$/.test(p.id)||ids.has(p.id))throw new Error('Workspace project IDs are invalid.');ids.add(p.id);}
  const runs=new Set();
  for(const r of state.runs){if(!ids.has(r.projectId)||runs.has(r.id)||!verifyIntegrity(r))throw new Error('Workspace evidence failed integrity validation.');runs.add(r.id);}
  return state;
}
export function openStore(dir,initial,{write=writeFileSync,sync=fsyncSync,copy=copyFileSync,rename=renameSync}={}) {
  const file=path.join(dir,'state.json');
  let value;
  try {value=existsSync(file)?validateState(JSON.parse(readFileSync(file,'utf8'))):initial;}
  catch {throw new Error('Workspace cannot be verified. Original files were preserved. Follow docs/RECOVERY.md to inspect and restore state.json.bak.');}
  const commit=next=>{
    validateState(next);
    const tmp=file+'.tmp';
    write(tmp,JSON.stringify({...next,formatVersion:1},null,2),{mode:0o600});
    const fd=openSync(tmp,'r+');try{sync(fd);}finally{closeSync(fd);}
    if(existsSync(file)){
      const backupTmp=file+'.bak.tmp';
      copy(file,backupTmp);
      const backupFd=openSync(backupTmp,'r+');try{sync(backupFd);}finally{closeSync(backupFd);}
      rename(backupTmp,file+'.bak');
    }
    rename(tmp,file);
    value=next;
  };
  if(!existsSync(file))commit(value);
  return {get value(){return value;},commit};
}
