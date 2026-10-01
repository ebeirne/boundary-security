import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../server/index.mjs';
import {comparePrivacyReports} from '../server/privacy-comparison.mjs';

const ownerId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222';
const marker='BOUNDARY_PRESSURE_PRIVATE_SYNTHETIC_482731';
const credentials={publishableKey:'sb_publishable_pressure_fixture',ownerToken:'pressure-owner-session',otherToken:'pressure-other-session'};
const cases=[
 ['secure','checks-passed',[]],
 ['row-leak','needs-attention',['retrieval-other-customer','anonymous-retrieval']],
 ['file-leak','needs-attention',['file-other-customer']],
 ['anonymous-public-leak','needs-attention',['public-file']],
 ['anonymous-authenticated-leak','needs-attention',['anonymous-file']],
 ['denied-file-body-leak','needs-attention',['file-other-customer']],
 ['not-found-file-body-leak','needs-attention',['file-other-customer']],
 ['denied-row-body-leak','needs-attention',['retrieval-other-customer','anonymous-retrieval']],
 ['denied-row-error-object-leak','needs-attention',['retrieval-other-customer','anonymous-retrieval']],
 ['denied-row-invalid-json-leak','needs-attention',['retrieval-other-customer','anonymous-retrieval']],
 ['denied-row-escaped-marker-leak','needs-attention',['retrieval-other-customer','anonymous-retrieval']],
 ['denied-anonymous-body-leak','needs-attention',['public-file','anonymous-file']],
 ['owner-file-denied','incomplete',[]],
 ['owner-row-denied','incomplete',[]],
 ['expired-other-session','incomplete',[]],
 ['wrong-identity','incomplete',[]],
 ['service-unavailable','incomplete',[]],
 ['wrong-marker','incomplete',[]],
 ['malformed-row-json','incomplete',[]],
 ['unexpected-row-shape','incomplete',[]],
 ['malformed-other-row','incomplete',[]],
 ['empty-file-success','incomplete',[]],
 ['oversized-owner-file','incomplete',[]],
 ['owner-disappears-after-denial','incomplete',[]],
 ['redirect','incomplete',[]],
];

test('pressure matrix crosses actual local API, adapter and owned HTTP service',async t=>{
 const startedAt=new Date().toISOString(),observations=[],reports={};
 let scenario='secure',requests=0,redirectSinkHits=0,ownerFileReads=0,notifyHang;
 const fixture=createServer((req,res)=>{
  requests++;
  const isOwner=req.headers.authorization===`Bearer ${credentials.ownerToken}`;
  const signed=!!req.headers.authorization;
  const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body))};
  const text=(body,status=200)=>{res.writeHead(status,{'Content-Type':'text/plain'});res.end(body)};
  if(req.url==='/redirect-sink'){redirectSinkHits++;return text(marker)}
  if(scenario==='hanging'){notifyHang?.();return}
  if(scenario==='service-unavailable')return json({error:'Synthetic unavailable'},503);
  if(req.url==='/auth/v1/user'){
   if(!isOwner&&scenario==='expired-other-session')return json({error:'Expired synthetic session'},401);
   return json({id:!isOwner&&scenario==='wrong-identity'?ownerId:isOwner?ownerId:otherId});
  }
  const contents=scenario==='wrong-marker'?'UNRELATED_SYNTHETIC_FIXTURE_999':marker;
  if(req.url.startsWith('/storage/v1/object/')){
   if(isOwner){
    ownerFileReads++;
    if(scenario==='owner-file-denied'||(scenario==='owner-disappears-after-denial'&&ownerFileReads>1))return text('Denied',403);
    if(scenario==='oversized-owner-file')return text('x'.repeat(65537));
    if(scenario==='redirect'){res.writeHead(302,{Location:'/redirect-sink'});return res.end()}
    return text(contents);
   }
   if(signed){
    if(scenario==='file-leak')return text(contents);
    if(scenario==='denied-file-body-leak')return text(contents,403);
    if(scenario==='not-found-file-body-leak')return text(contents,404);
    if(scenario==='empty-file-success')return text('');
   }else{
    if(scenario==='anonymous-public-leak'&&req.url.includes('/public/'))return text(contents);
    if(scenario==='anonymous-authenticated-leak'&&req.url.includes('/authenticated/'))return text(contents);
    if(scenario==='denied-anonymous-body-leak')return text(contents,403);
   }
   return text('Denied',403);
  }
  if(req.url.startsWith('/rest/v1/')){
   if(scenario==='malformed-row-json')return text('{"broken":');
   if(scenario==='unexpected-row-shape')return json({rows:[{content:contents}]});
   if(isOwner)return scenario==='owner-row-denied'?json([],403):json([{content:contents}]);
   if(scenario==='row-leak')return json([{content:contents}]);
   if(scenario==='denied-row-body-leak')return json([{content:contents}],403);
   if(scenario==='denied-row-error-object-leak')return json({error:{detail:contents}},403);
   if(scenario==='denied-row-invalid-json-leak')return text('{"error":'+contents,403);
   if(scenario==='denied-row-escaped-marker-leak')return text(JSON.stringify({error:contents}).replaceAll('B','\\u0042'),403);
   if(scenario==='malformed-other-row')return json([{unexpected:'shape'}]);
   return json([]);
  }
  return text('Unsupported fixture route',404);
 });
 fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
 const directory=await mkdtemp(path.join(tmpdir(),'boundary-pressure-'));
 const app=createApp({dataDir:directory});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{
  fixture.closeAllConnections();app.server.closeAllConnections();
  await Promise.all([new Promise(r=>fixture.close(r)),new Promise(r=>app.server.close(r))]);
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));
  assert(path.basename(directory).startsWith('boundary-pressure-'));
  await rm(directory,{recursive:true,force:true});
 });
 const origin=`http://127.0.0.1:${app.server.address().port}`;
 const config={version:1,authorized:true,synthetic:true,origin:`http://127.0.0.1:${fixture.address().port}`,ownerId,otherId,bucket:'test',object:'test.txt',table:'documents',recordId:1,marker,retrieval:{mode:'row'}};
 const headers={'Content-Type':'application/json','X-Boundary-Token':app.token};
 const post=(changes={},options={})=>fetch(`${origin}/api/document-privacy`,{method:'POST',headers,body:JSON.stringify({config:{...config,...changes},credentials}),...options});
 for(const [name,expected,failedIds] of cases)await t.test(name,async()=>{
  scenario=name;ownerFileReads=0;const before=requests;
  const response=await post();assert.equal(response.status,200);
  const report=await response.json();reports[name]=report;
  observations.push({scenario:name,expected,actual:report.verdict,requestCount:requests-before,summary:report.summary,results:report.results});
  assert.equal(report.verdict,expected);
  assert.deepEqual(report.results.filter(r=>r.status==='failed').map(r=>r.id).sort(),[...failedIds].sort());
  for(const secret of [...Object.values(credentials),marker,ownerId,otherId])assert(!JSON.stringify(report).includes(secret),'reports must omit fixture contents and credentials');
  if(expected==='incomplete')assert(report.summary.incomplete>0);
  assert.equal((await(await fetch(`${origin}/api/state`)).json()).busy,false);
 });
 await t.test('redirects are not followed',()=>assert.equal(redirectSinkHits,0));
 await t.test('repair, regression and mismatched fixture reruns',async()=>{
  assert.equal(comparePrivacyReports(reports['row-leak'],reports.secure).verdict,'repair-verified');
  assert.equal(comparePrivacyReports(reports.secure,reports['row-leak']).verdict,'regression');
  scenario='secure';ownerFileReads=0;
  const changed=await(await post({recordId:2})).json();
  assert.equal(comparePrivacyReports(reports.secure,changed).verdict,'incomparable');
  const context={version:1,provenance:'operator-declared',applicationRevision:'a'.repeat(40),fixtureHash:'b'.repeat(64)};
  const before={...reports.secure,evidenceContext:context};
  const after={...reports.secure,evidenceContext:{...context,fixtureHash:'c'.repeat(64)}};
  assert.equal(comparePrivacyReports(before,after).verdict,'incomparable');
  observations.push({scenario:'rerun-comparisons',repair:'repair-verified',regression:'regression',changedRecord:'incomparable',changedDeclaredFixture:'incomparable'});
 });
 await t.test('real API rejects missing token, foreign origin and privileged keys before fixture calls',async()=>{
  const before=requests;
  assert.equal((await post({}, {headers:{'Content-Type':'application/json'}})).status,403);
  assert.equal((await post({}, {headers:{...headers,Origin:'https://outside.invalid'}})).status,403);
  const response=await post({}, {body:JSON.stringify({config,credentials:{...credentials,publishableKey:'sb_secret_SYNTHETIC_REJECT_ME'}})});
  assert.equal(response.status,400);assert(!(await response.text()).includes('sb_secret_SYNTHETIC_REJECT_ME'));
  assert.equal(requests,before);
  observations.push({scenario:'api-preflight-rejections',passed:true,fixtureRequests:0});
 });
 await t.test('client cancellation releases real busy state and next request can run',async()=>{
  scenario='hanging';const reached=new Promise(resolve=>notifyHang=resolve);
  const abort=new AbortController();const pending=post({}, {signal:abort.signal});
  await reached;
  assert.equal((await post()).status,409);
  abort.abort();await assert.rejects(pending,e=>e.name==='AbortError');
  const deadline=Date.now()+3000;let state;
  do{state=await(await fetch(`${origin}/api/state`)).json();if(!state.busy)break;await new Promise(r=>setTimeout(r,20))}while(Date.now()<deadline);
  assert.equal(state.busy,false);
  fixture.closeAllConnections();scenario='secure';ownerFileReads=0;
  assert.equal((await(await post()).json()).verdict,'checks-passed');
  observations.push({scenario:'cancel-and-rerun',passed:true});
 });
 await t.test('privacy runs do not persist sessions, marker or reports',async()=>{
  assert.equal(app.state.runs.length,0);
  for(const filename of await readdir(directory)){
   const content=await readFile(path.join(directory,filename),'utf8');
   for(const secret of [...Object.values(credentials),marker])assert(!content.includes(secret),`sensitive fixture string persisted in ${filename}`);
  }
  observations.push({scenario:'persistence-check',passed:true});
 });
 if(process.env.BOUNDARY_PRESSURE_RECEIPT)await writeFile(process.env.BOUNDARY_PRESSURE_RECEIPT,JSON.stringify({version:1,startedAt,finishedAt:new Date().toISOString(),method:'Actual createApp HTTP API -> default runSupabasePrivacy -> owned Supabase-shaped loopback HTTP fixture; no injected fetch or assessor',limits:['Not hosted Supabase/PostgreSQL policy validation','No customer target or data','No full timeout-duration, cross-browser, signed-link or vector tests'],requests,observations},null,2));
});
