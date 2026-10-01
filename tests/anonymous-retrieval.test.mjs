import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {runSupabasePrivacy} from '../server/supabase-privacy.mjs';
const ownerId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222',marker='OWNED_ANONYMOUS_RETRIEVAL_MARKER';
for(const mode of ['row','rpc'])for(const [scenario,expected] of Object.entries({empty:'passed',unauthorized:'passed',forbidden:'passed',leak:'failed',errorLeak:'failed',escapedLeak:'failed',outage:'incomplete',missing:'incomplete',malformed:'incomplete',ownerLost:'incomplete',ownerMissing:'incomplete'})){
 test(`anonymous ${mode}: ${scenario}`,async()=>{
  let anonymousSeen=false,anonymousCalls=0;
  const server=createServer((req,res)=>{
   const owner=req.headers.authorization==='Bearer owner-token';
   const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(typeof body==='string'?body:JSON.stringify(body));};
   if(req.url==='/auth/v1/user')return send(200,{id:owner?ownerId:otherId});
   if(req.url.startsWith('/storage/'))return owner?send(200,marker):send(403,'denied');
   assert.equal(new URL(req.url,'http://localhost').pathname,mode==='rpc'?'/rest/v1/rpc/retrieve_document':'/rest/v1/documents');
   if(owner)return send(200,scenario==='ownerMissing'||(scenario==='ownerLost'&&anonymousSeen)?[]:[{content:marker}]);
   if(req.headers.authorization)return send(200,[]);
   anonymousSeen=true;anonymousCalls++;assert.equal(req.headers.apikey,'sb_publishable_owned');assert.equal(req.method,'GET');
   const payloads={empty:[200,[]],unauthorized:[401,{error:'unauthorized'}],forbidden:[403,{error:'forbidden'}],leak:[200,[{content:marker}]],errorLeak:[404,{error:marker}],escapedLeak:[503,'{"error":"'+[...marker].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')+'"}'],outage:[503,{error:'outage'}],missing:[404,{error:'not found'}],malformed:[200,'not-json'],ownerLost:[200,[]]};
   send(...payloads[scenario]);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
   const report=await runSupabasePrivacy({version:1,authorized:true,synthetic:true,origin:`http://127.0.0.1:${server.address().port}`,ownerId,otherId,bucket:'test-files',object:'owner/test.txt',table:'documents',recordId:1,marker,retrieval:mode==='rpc'?{mode,functionName:'retrieve_document',reviewedReadOnly:true}:{mode}},{publishableKey:'sb_publishable_owned',ownerToken:'owner-token',otherToken:'other-token'});
   assert.equal(report.adapter,'supabase-document-privacy-v5');assert.equal(report.results.length,8);assert.equal(report.results.find(r=>r.id==='anonymous-retrieval').status,expected);assert.equal(anonymousCalls,scenario==='ownerMissing'?0:1);
   for(const secret of [marker,ownerId,'owner-token','sb_publishable_owned'])assert(!JSON.stringify(report).includes(secret));
  }finally{await new Promise(resolve=>server.close(resolve));}
 });
}
