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

test('CI process blocks expired sessions and service failures while exporting only scoped evidence',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'boundary-ci-exit-'));
 let status=401;
 const server=createServer((_req,res)=>{
  res.writeHead(status,{'Content-Type':'application/json'});
  res.end(JSON.stringify({message:'synthetic upstream diagnostic never exported'}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const marker='BOUNDARY_CI_SYNTHETIC_UNAVAILABLE';
 const owner='11111111-1111-4111-8111-111111111111';
 const config={version:1,authorized:true,synthetic:true,origin:`http://127.0.0.1:${server.address().port}`,ownerId:owner,otherId:'22222222-2222-4222-8222-222222222222',bucket:'test',object:'test.txt',table:'documents',recordId:1,marker};
 const input=path.join(directory,'config.json');
 try{
  await writeFile(input,JSON.stringify(config));
  for(const upstreamStatus of [401,503]){
   status=upstreamStatus;
   const output=path.join(directory,`report-${status}.json`);
   await assert.rejects(exec(process.execPath,[fileURLToPath(new URL('../scripts/check-document-privacy.mjs',import.meta.url)),'--config',input,'--out',output],{
    env:{...process.env,BOUNDARY_SUPABASE_PUBLIC_KEY:'public-ci-fixture',BOUNDARY_OWNER_TOKEN:'expired-owner-fixture',BOUNDARY_OTHER_TOKEN:'expired-other-fixture'},windowsHide:true,timeout:10000,
   }),error=>error.code===2&&JSON.parse(error.stdout).verdict==='incomplete');
   const serialized=await readFile(output,'utf8'),report=JSON.parse(serialized);
   assert.equal(report.verdict,'incomplete');
   assert.equal(report.summary.passed,0);
   for(const secret of [marker,owner,config.origin,'expired-owner-fixture','expired-other-fixture','synthetic upstream diagnostic'])assert(!serialized.includes(secret));
  }
 }finally{
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()});
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));
  assert(path.basename(directory).startsWith('boundary-ci-exit-'));
  await rm(directory,{recursive:true,force:true});
 }
});
