import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile);
test('fresh CLI process exports scoped results and refuses to overwrite evidence',async()=>{
 const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',marker='BOUNDARY_CLI_SYNTHETIC_654321';let leak=false,requests=0;
 const server=createServer((req,res)=>{
  requests++;
  const alice=req.headers.authorization==='Bearer owner-token',authenticated=!!req.headers.authorization;
  if(req.url==='/auth/v1/user'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({id:alice?owner:other}))}
  if(req.url.startsWith('/storage/')){res.statusCode=alice||leak?200:403;return res.end(alice||leak?marker:'Denied')}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(alice&&authenticated?[{content:marker}]:[]));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const directory=await mkdtemp(path.join(tmpdir(),'boundary-privacy-cli-'));
 try{
  const config={version:1,authorized:true,synthetic:true,origin:`http://127.0.0.1:${server.address().port}`,ownerId:owner,otherId:other,bucket:'test',object:'test.txt',table:'documents',recordId:1,marker};
  const input=path.join(directory,'config.json'),output=path.join(directory,'report.json');await writeFile(input,JSON.stringify(config));
  const script=new URL('../scripts/check-document-privacy.mjs',import.meta.url);
  const args=[process.env.BOUNDARY_PRIVACY_CLI_TEST_PATH??fileURLToPath(script),'--config',input,'--out',output];
  const env={...process.env,BOUNDARY_SUPABASE_PUBLIC_KEY:'public-test',BOUNDARY_OWNER_TOKEN:'owner-token',BOUNDARY_OTHER_TOKEN:'other-token'};
  const first=await exec(process.execPath,args,{env,windowsHide:true,timeout:10000});
  assert.equal(JSON.parse(first.stdout).verdict,'checks-passed');const original=await readFile(output,'utf8');
  for(const secret of [marker,'owner-token','other-token',owner])assert(!original.includes(secret));
  await assert.rejects(exec(process.execPath,args,{env,windowsHide:true,timeout:10000}),e=>e.code===2);
  assert.equal(await readFile(output,'utf8'),original);
  const contextual=path.join(directory,'contextual.json');
  const revision='a'.repeat(40),fixtureHash='b'.repeat(64);
  await exec(process.execPath,[args[0],'--config',input,'--out',contextual,'--app-revision',revision,'--fixture-hash',fixtureHash],{env,windowsHide:true,timeout:10000});
  const linked=JSON.parse(await readFile(contextual,'utf8'));
  assert.deepEqual(linked.evidenceContext,{version:1,provenance:'operator-declared',applicationRevision:revision,fixtureHash});
  assert.equal(linked.requirementsHash,JSON.parse(original).requirementsHash,'annotations must not change the tested contract hash');
  const requestCount=requests;
  await assert.rejects(exec(process.execPath,[args[0],'--config',input,'--out',path.join(directory,'invalid.json'),'--app-revision',revision],{env,windowsHide:true,timeout:10000}),e=>e.code===2);
  assert.equal(requests,requestCount,'invalid context must fail before contacting the configured service');
  await assert.rejects(readFile(path.join(directory,'invalid.json')),{code:'ENOENT'});
  const help=await exec(process.execPath,[args[0],'--help'],{windowsHide:true,timeout:10000});
  assert.match(help.stdout,/operator declarations, not verified deployment identity/);
  leak=true;args[args.length-1]=path.join(directory,'leak.json');
  await assert.rejects(exec(process.execPath,args,{env,windowsHide:true,timeout:10000}),e=>e.code===1&&JSON.parse(e.stdout).verdict==='needs-attention');
  assert.equal(JSON.parse(await readFile(args.at(-1),'utf8')).summary.failed,3);
  const comparisonScript=fileURLToPath(new URL('../scripts/compare-document-privacy.mjs',import.meta.url));
  const contextualLeak=path.join(directory,'contextual-leak.json');
  await assert.rejects(exec(process.execPath,[args[0],'--config',input,'--out',contextualLeak,'--app-revision','c'.repeat(40),'--fixture-hash',fixtureHash],{env,windowsHide:true,timeout:10000}),e=>e.code===1);
  const linkedComparison=await exec(process.execPath,[comparisonScript,'--before',contextualLeak,'--after',contextual,'--out',path.join(directory,'linked-comparison.json')],{windowsHide:true,timeout:10000});
  assert.equal(JSON.parse(linkedComparison.stdout).verdict,'repair-verified');
  assert.equal(JSON.parse(linkedComparison.stdout).evidenceContext.beforeApplicationRevision,'c'.repeat(40));
  assert.equal(JSON.parse(linkedComparison.stdout).evidenceContext.afterApplicationRevision,revision);
  const handoff=path.join(directory,'handoff.md');
  await exec(process.execPath,[fileURLToPath(new URL('../scripts/export-privacy-handoff.mjs',import.meta.url)),'--before',contextualLeak,'--after',contextual,'--out',handoff],{windowsHide:true,timeout:10000});
  const handoffText=await readFile(handoff,'utf8');
  assert(handoffText.includes(fixtureHash));
  assert.match(handoffText,/Boundary did not verify/);
  for(const secret of [marker,'owner-token','other-token',owner])assert(!handoffText.includes(secret));
  const comparisonPath=path.join(directory,'comparison.json');
  const compared=await exec(process.execPath,[comparisonScript,'--before',args.at(-1),'--after',output,'--out',comparisonPath],{windowsHide:true,timeout:10000});
  assert.equal(JSON.parse(compared.stdout).verdict,'repair-verified');
  const regressionPath=path.join(directory,'regression.json');
  await assert.rejects(exec(process.execPath,[comparisonScript,'--before',output,'--after',args.at(-1),'--out',regressionPath],{windowsHide:true,timeout:10000}),e=>e.code===1&&JSON.parse(e.stdout).verdict==='regression');
  await assert.rejects(exec(process.execPath,[comparisonScript,'--before',output,'--after',output,'--out',comparisonPath],{windowsHide:true,timeout:10000}),e=>e.code===2);

 }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()});assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));assert(path.basename(directory).startsWith('boundary-privacy-cli-'));await rm(directory,{recursive:true,force:true})}
});
