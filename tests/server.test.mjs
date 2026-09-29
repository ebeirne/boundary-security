import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import http from 'node:http';
import {createApp} from '../server/index.mjs';
import {demoProject} from '../server/demo.mjs';
import {assess,verifyIntegrity,hash} from '../server/engine.mjs';
import {runAssessment} from '../server/runner.mjs';
import {verifyBackup} from '../server/backup.mjs';

test('console backup requires session authorization and saves a verified workspace',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-backup-api-')),app=createApp({dataDir:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const url=`http://127.0.0.1:${app.server.address().port}/api/backup`;
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Boundary-Token':app.token},body:'{}'});
 assert.equal(response.status,201);const receipt=await response.json();assert.equal(path.dirname(receipt.file),path.join(dir,'backups'));assert.deepEqual(verifyBackup(receipt.file).state.projects,app.state.projects);
});

test('an assessment-process crash leaves the server usable and saves no false result',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-crash-'));let first=true;
 const app=createApp({dataDir:dir,assessor:p=>{const options=first?{processFile:new URL('./fixtures/crash-process.mjs',import.meta.url)}:{};first=false;return runAssessment(p,options);}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,headers={'Content-Type':'application/json','X-Boundary-Token':app.token};
 const crashed=await fetch(base+'/api/projects/demo/run',{method:'POST',headers,body:'{}'});assert.equal(crashed.status,400);assert.match((await crashed.json()).error,/process stopped/);
 const state=await (await fetch(base+'/api/state')).json();assert.equal(state.busy,false);assert.equal(state.runs.length,0);
 const recovered=await fetch(base+'/api/projects/demo/run',{method:'POST',headers,body:'{}'});assert.equal(recovered.status,201);assert.equal((await recovered.json()).summary.failed,2);assert.equal(app.state.runs.length,1);
});

test('local exports are verified, repeatable, and never overwrite changed evidence',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-export-')),app=createApp({dataDir:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,headers={'Content-Type':'application/json','X-Boundary-Token':app.token};
 const run=await (await fetch(base+'/api/projects/demo/run',{method:'POST',headers,body:'{}'})).json();
 const url=base+'/api/export/'+run.id+'?format=json';
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
 const saved=await fetch(url,{method:'POST',headers,body:'{}'});assert.equal(saved.status,201);const receipt=await saved.json();
 assert.equal(path.dirname(receipt.path),path.join(dir,'exports'));const bytes=readFileSync(receipt.path,'utf8');assert.equal(receipt.digest,hash(bytes));assert(verifyIntegrity(JSON.parse(bytes)));
 assert.equal((await fetch(url,{method:'POST',headers,body:'{}'})).status,201);
 writeFileSync(receipt.path,'changed evidence');assert.equal((await fetch(url,{method:'POST',headers,body:'{}'})).status,409);assert.equal(readFileSync(receipt.path,'utf8'),'changed evidence');
 const md=await fetch(base+'/api/export/'+run.id+'?format=md',{method:'POST',headers,body:'{}'});assert.equal(md.status,201);assert.match(readFileSync((await md.json()).path,'utf8'),/Checksum verified at export: yes/);
 assert.equal((await fetch(base+'/api/export/'+run.id+'?format=html')).status,400);
});

test('hostile browser requests and static paths do not expose workspace files',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-protocol-')),app=createApp({dataDir:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 for(const origin of ['null','http://127.0.0.1:1','https://127.0.0.1','https://evil.invalid'])assert.equal((await fetch(base+'/api/state',{headers:{Origin:origin}})).status,403);
 const headers={'X-Boundary-Token':app.token,'Content-Type':'text/plain'};assert.equal((await fetch(base+'/api/demo-project',{method:'POST',headers,body:'{}'})).status,415);
 const state=await fetch(base+'/api/state');assert.match(state.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(state.headers.get('x-content-type-options'),'nosniff');
 for(const route of ['/.boundary/state.json','/server/index.mjs','/%2e%2e%5c.boundary%5cstate.json']){const r=await fetch(base+route);const body=await r.text();assert(!body.includes(app.token));assert(!body.includes('Synthetic seed'));assert(!body.includes('randomBytes'));}
 assert.equal((await fetch(base+'/api/projects/demo/run',{method:'GET'})).status,404);
 assert.equal(app.state.runs.length,0);
});

test('concurrent edits cannot silently overwrite a newer project revision',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-stale-')),app=createApp({dataDir:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;const state=await (await fetch(base+'/api/state')).json();
 const headers={'Content-Type':'application/json','X-Boundary-Token':app.token,'X-Boundary-Version':state.projects[0].inputVersion};
 const responses=await Promise.all(['first','second'].map(revision=>fetch(base+'/api/projects/demo',{method:'PUT',headers,body:JSON.stringify({...demoProject(),revision})})));
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const winner=await responses.find(r=>r.status===200).json();assert.equal(app.state.projects[0].revision,winner.revision);
 assert.equal((await fetch(base+'/api/projects/demo',{method:'PUT',headers,body:JSON.stringify(demoProject())})).status,409);
 const fresh=await (await fetch(base+'/api/state')).json();headers['X-Boundary-Version']=fresh.projects[0].inputVersion;
 assert.equal((await fetch(base+'/api/projects/demo',{method:'PUT',headers,body:JSON.stringify({...demoProject(),revision:'fresh'})})).status,200);
});

test('local API rejects cross-origin mutation and persists legitimate imports',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-test-')),app=createApp({dataDir:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const state=await (await fetch(base+'/api/state')).json();assert.equal(state.projects[0].id,'demo');assert.equal(state.runs.length,0);
 let r=await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(demoProject())});assert.equal(r.status,403);
 r=await fetch(base+'/api/state',{headers:{Origin:'https://attacker.invalid'}});assert.equal(r.status,403);
 const hostStatus=await new Promise(resolve=>{http.get(base+'/api/state',{headers:{Host:'attacker.invalid'}},res=>{res.resume();resolve(res.statusCode);});});assert.equal(hostStatus,403);
 r=await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json','X-Boundary-Token':state.token},body:JSON.stringify({...demoProject(),name:'Imported & reviewed',isDemo:true})});assert.equal(r.status,201);const imported=await r.json();assert.equal(imported.isDemo,false);
 assert.equal(JSON.parse(readFileSync(path.join(dir,'state.json'),'utf8')).projects.length,2);
 r=await fetch(base+`/api/projects/${imported.id}/repair`,{method:'POST',headers:{'Content-Type':'application/json','X-Boundary-Token':state.token},body:'{}'});assert.equal(r.status,409);
 r=await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json','X-Boundary-Token':state.token},body:'{'});assert.equal(r.status,400);
 r=await fetch(base+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json','X-Boundary-Token':state.token},body:JSON.stringify({payload:'x'.repeat(360000)})});assert.equal(r.status,413);
});

test('one workspace has one writer; concurrent runs and edits are rejected, evidence survives reopening',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-concurrency-'));
 let unblock,entered;const started=new Promise(r=>entered=r);const gate=new Promise(r=>unblock=r);
 const app=createApp({dataDir:dir,assessor:async p=>{entered();await gate;return assess(p);}});
 assert.throws(()=>createApp({dataDir:dir}),/already open/);
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,headers={'Content-Type':'application/json','X-Boundary-Token':app.token};
 const pending=fetch(base+'/api/projects/demo/run',{method:'POST',headers,body:'{}'});await started;
 for(const [route,method,body] of [['run','POST',{}],['repair','POST',{}],['reset','POST',{}],['','PUT',demoProject()]]){
 const res=await fetch(base+'/api/projects/demo'+(route?'/'+route:''),{method,headers,body:JSON.stringify(body)});assert.equal(res.status,409);
 }
 unblock();const result=await pending;assert.equal(result.status,201);const run=await result.json();
 const report=await fetch(base+'/api/export/'+run.id+'?format=md');assert.equal(report.status,200);assert.match(await report.text(),/Checksum verified at export: yes/);
 await new Promise(r=>app.server.close(r));const reopened=createApp({dataDir:dir});reopened.server.listen(0,'127.0.0.1');await once(reopened.server,'listening');t.after(()=>reopened.server.close());assert.equal(reopened.state.runs[0].id,run.id);
});

test('guided journey creates a separate demo, verifies repair, and exports the same contract',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'boundary-journey-')),app=createApp({dataDir:dir});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>app.server.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,headers={'Content-Type':'application/json','X-Boundary-Token':app.token};
 const post=async(route,body={})=>{const r=await fetch(base+route,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,201);return r.json();};
 const demo=await post('/api/demo-project');assert.notEqual(demo.id,'demo');assert.equal(demo.isDemo,true);assert.equal(app.state.projects[0].revision,'demo-v1');
 const before=await post(`/api/projects/${demo.id}/run`);assert.equal(before.summary.failed,2);
 const repair=await fetch(base+`/api/projects/${demo.id}/repair`,{method:'POST',headers,body:'{}'});assert.equal(repair.status,200);
 const after=await post(`/api/projects/${demo.id}/run`);assert.equal(after.summary.failed,0);assert.equal(after.summary.passed,10);assert.equal(before.contractHash,after.contractHash);assert.notEqual(before.sourceHash,after.sourceHash);
 const json=await (await fetch(base+'/api/export/'+after.id)).json();assert.equal(json.id,after.id);
 const markdown=await (await fetch(base+'/api/export/'+before.id+'?format=md')).text();assert.match(markdown,/8 passed.*2 failed/);assert.match(markdown,/Checksum verified at export: yes/);
 assert.equal(app.state.projects.find(p=>p.id==='demo').revision,'demo-v1');assert.equal(app.state.runs.length,2);
});
