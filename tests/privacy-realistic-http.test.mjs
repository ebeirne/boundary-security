import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {runSupabasePrivacy} from '../server/supabase-privacy.mjs';

const ownerId='11111111-1111-4111-8111-111111111111',otherId='22222222-2222-4222-8222-222222222222';
const marker='BOUNDARY_REALISTIC_SYNTHETIC_123456';
const scenarios=['secure','deleted-during-file-check','deleted-during-retrieval','session-revoked-during-check','expired-session','retrieval-outage','malformed-retrieval','oversized-response','redirect'];
for(const scenario of scenarios)test(`realistic Supabase-shaped HTTP: ${scenario}`,async t=>{
 let fileGone=false,rowGone=false,revoked=false;
 const server=createServer((req,res)=>{
  const owner=req.headers.authorization==='Bearer owner-test',signed=!!req.headers.authorization;
  const json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body))};
  if(req.url==='/auth/v1/user')return !owner&&(revoked||scenario==='expired-session')?json({error:'invalid session'},401):json({id:owner?ownerId:otherId});
  if(req.url.startsWith('/storage/')){
   if(!owner&&signed&&scenario==='deleted-during-file-check')fileGone=true;
   if(!owner&&signed&&scenario==='session-revoked-during-check')revoked=true;
   if(owner&&scenario==='oversized-response')return res.end('x'.repeat(65537));
   if(owner&&scenario==='redirect'){res.writeHead(302,{Location:'/unconfigured'});return res.end()}
   res.statusCode=owner&&!fileGone?200:404;return res.end(owner&&!fileGone?marker:'Not found');
  }
  if(req.url.startsWith('/rest/')){
   if(!owner&&scenario==='deleted-during-retrieval')rowGone=true;
   if(scenario==='retrieval-outage')return json({error:'unavailable'},503);
   if(scenario==='malformed-retrieval')return json({documents:[marker]});
   return json(owner&&!rowGone?[{content:marker}]:[]);
  }
  res.statusCode=404;res.end();
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close()});
 const report=await runSupabasePrivacy({version:1,authorized:true,synthetic:true,origin:`http://127.0.0.1:${server.address().port}`,ownerId,otherId,bucket:'test',object:'test.txt',table:'documents',recordId:1,marker},{publishableKey:'public-test',ownerToken:'owner-test',otherToken:'other-test'});
 assert.equal(report.verdict,scenario==='secure'?'checks-passed':'incomplete',scenario);
 assert.equal(report.summary.failed,0);
 if(scenario!=='secure')assert(report.summary.incomplete>0);
 for(const secret of [marker,'owner-test','other-test',ownerId])assert(!JSON.stringify(report).includes(secret));
});
