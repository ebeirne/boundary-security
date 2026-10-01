import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../server/index.mjs';
import {restoreBackup} from '../server/backup.mjs';
import {verifyIntegrity} from '../server/engine.mjs';
import {toolVersion} from '../server/version.mjs';

// Every request stays on an ephemeral loopback server with owned synthetic inputs.
export async function checkJourney(root){
 mkdirSync(root,{recursive:true});
 const dataDir=path.join(root,'workspace'),steps=[];let app,base,token;
 const open=async directory=>{app=createApp({dataDir:directory});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base=`http://127.0.0.1:${app.server.address().port}`;token=app.token;};
 const close=()=>new Promise((resolve,reject)=>app.server.close(e=>e?reject(e):resolve()));
 const call=async(route,{method='GET',body,version,status=200}={})=>{
  const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json','X-Boundary-Token':token,...(version?{'X-Boundary-Version':version}:{})},...(method!=='GET'?{body:JSON.stringify(body??{})}:{})});
  assert.equal(response.status,status,`${method} ${route}: unexpected status`);return response.json();
 };
 try{
  await open(dataDir);
  const source=JSON.parse(readFileSync(new URL('../examples/project.json',import.meta.url),'utf8'));
  source.name='Imported release fixture';source.revision='release-before';
  const project=await call('/api/projects',{method:'POST',body:source,status:201});
  assert.equal(project.isDemo,false);steps.push('Imported reviewed synthetic project through API');
  const before=await call(`/api/projects/${project.id}/run`,{method:'POST',status:201});
  assert.equal(before.startupRecovery,undefined,'Startup recovery blocks release approval');assert.deepEqual(before.summary,{passed:8,failed:2,errors:0,notRun:0});assert(verifyIntegrity(before));steps.push('Detected both intentional cross-organization flaws');
  const state=await call('/api/state'),input=state.projects.find(p=>p.id===project.id);
  const repaired={...input,revision:'release-repaired',migration:input.migration+'\n'+readFileSync(new URL('../examples/demo-repair.sql',import.meta.url),'utf8')};
  await call(`/api/projects/${project.id}`,{method:'PUT',body:repaired,version:input.inputVersion});
  await call(`/api/projects/${project.id}`,{method:'PUT',body:input,version:input.inputVersion,status:409});steps.push('Saved reviewed repair and rejected stale overwrite');
  const after=await call(`/api/projects/${project.id}/run`,{method:'POST',status:201});
  assert.equal(after.startupRecovery,undefined,'Startup recovery blocks release approval');assert.deepEqual(after.summary,{passed:10,failed:0,errors:0,notRun:0});assert.equal(after.contractHash,before.contractHash);assert.notEqual(after.sourceHash,before.sourceHash);assert.equal(after.toolVersion,toolVersion);steps.push('Retested unchanged contract with all legitimate access preserved');
  for(const format of ['json','md']){
   const receipt=await call(`/api/export/${after.id}?format=${format}`,{method:'POST',status:201});
   const text=readFileSync(receipt.path,'utf8');assert.equal(Buffer.byteLength(text),receipt.bytes);
   if(format==='json')assert(verifyIntegrity(JSON.parse(text)));else assert(text.includes(`Tool version: ${toolVersion}`));
  }
  steps.push('Saved and read back JSON and Markdown evidence');
  const backup=await call('/api/backup',{method:'POST',status:201});
  await close();await open(dataDir);
  assert.equal(app.state.runs.length,2);assert.equal(app.state.runs[1].id,before.id);steps.push('Restarted server with both historical runs intact');
  await close();
  const recovered=path.join(root,'recovered');restoreBackup(backup.file,recovered);
  assert.deepEqual(readFileSync(path.join(dataDir,'state.json')),readFileSync(path.join(recovered,'state.json')));
  await open(recovered);const restored=await call('/api/state');assert.equal(restored.runs[0].id,after.id);assert(restored.runs.every(verifyIntegrity));steps.push('Restored backup byte-for-byte and reopened through API');
  return {ok:true,steps,before:before.summary,after:after.summary,contractUnchanged:true,toolVersion};
 }finally{if(app?.server.listening)await close();}
}

