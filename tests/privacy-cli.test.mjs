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
 const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',marker='BOUNDARY_CLI_SYNTHETIC_654321';let leak=false;
 const server=createServer((req,res)=>{
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
  leak=true;args[args.length-1]=path.join(directory,'leak.json');
  await assert.rejects(exec(process.execPath,args,{env,windowsHide:true,timeout:10000}),e=>e.code===1&&JSON.parse(e.stdout).verdict==='needs-attention');
  assert.equal(JSON.parse(await readFile(args.at(-1),'utf8')).summary.failed,3);
 }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()});assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));assert(path.basename(directory).startsWith('boundary-privacy-cli-'));await rm(directory,{recursive:true,force:true})}
});
