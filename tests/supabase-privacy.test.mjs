import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePrivacyConfig,supabasePrivacyAdapter,runSupabasePrivacy} from '../server/supabase-privacy.mjs';
const config={version:1,authorized:true,synthetic:true,origin:'https://example.supabase.co',ownerId:'11111111-1111-4111-8111-111111111111',otherId:'22222222-2222-4222-8222-222222222222',bucket:'test-files',object:'alice/test.txt',table:'documents',recordId:1,marker:'SYNTHETIC_MARKER_123456'};
const credentials={publishableKey:'sb_publishable_test',ownerToken:'owner-test-token',otherToken:'other-test-token'};
test('retrieval function uses bounded GET arguments and requires read-only review',async()=>{
 const retrieval={mode:'rpc',functionName:'retrieve_document',reviewedReadOnly:true};
 assert.throws(()=>validatePrivacyConfig({...config,retrieval:{...retrieval,reviewedReadOnly:false}}));
 assert.throws(()=>validatePrivacyConfig({...config,retrieval:{...retrieval,functionName:'other/path'}}));
 let observed;const adapter=supabasePrivacyAdapter({...config,retrieval},{...credentials,fetchImpl:async(url,options)=>{observed={url,options};return Response.json([])}});
 await adapter({actor:config.ownerId,surface:'retrieval'});assert.equal(observed.url.pathname,'/rest/v1/rpc/retrieve_document');assert.equal(observed.url.searchParams.get('document_id'),'1');assert.equal(observed.options.method,undefined);
});
test('Supabase adapter refuses unauthorized inputs and unsafe routes',()=>{
 for(const patch of [{authorized:false},{synthetic:false},{origin:'https://example.com'},{origin:'https://evil.supabase.co.attacker.test'},{origin:'http://example.supabase.co'},{origin:'https://user:secret@example.supabase.co'},{object:'../secret'},{object:'%2e%2e/secret'},{table:'documents?select=*'},{otherId:config.ownerId}])assert.throws(()=>validatePrivacyConfig({...config,...patch}));
});
test('Supabase adapter rejects service credentials and identical sessions',()=>{
 const service='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';
 for(const patch of [{ownerToken:service},{publishableKey:'sb_secret_123'},{otherToken:credentials.ownerToken}])assert.throws(()=>supabasePrivacyAdapter(config,{...credentials,...patch}));
});
test('Supabase routes use distinct sessions, preserve positive controls and redact exports',async()=>{
 const requests=[];
 const fetchImpl=async(url,options)=>{
  requests.push({url:String(url),options});const owner=options.headers.Authorization===`Bearer ${credentials.ownerToken}`;
  if(url.pathname==='/auth/v1/user')return Response.json({id:owner?config.ownerId:config.otherId});
  if(url.pathname.startsWith('/storage/'))return owner?new Response(config.marker):Response.json({statusCode:'404',message:'Object not found'},{status:400});
  return Response.json(owner?[{content:config.marker}]:[]);
 };
 const report=await runSupabasePrivacy(config,{...credentials,fetchImpl});assert.equal(report.verdict,'checks-passed');assert.equal(requests.length,14);
 assert.equal(requests.filter(r=>!r.options.headers.Authorization).length,2);
 assert(requests.every(r=>r.options.redirect==='error'));assert(requests.every(r=>new URL(r.url).origin===config.origin));
 for(const secret of [...Object.values(credentials),config.marker,config.ownerId,config.origin])assert(!JSON.stringify(report).includes(secret));
});
test('Supabase server errors cannot produce safe results',async()=>{
 const report=await runSupabasePrivacy(config,{...credentials,fetchImpl:async()=>Response.json({error:'outage'},{status:503})});assert.equal(report.verdict,'incomplete');
});
test('public bucket disclosure fails even if other-customer authenticated access is denied',async()=>{
 const fetchImpl=async(url,options)=>{
  const owner=options.headers.Authorization===`Bearer ${credentials.ownerToken}`;
  if(url.pathname==='/auth/v1/user')return Response.json({id:owner?config.ownerId:config.otherId});
  if(url.pathname.includes('/public/'))return new Response(config.marker);
  if(url.pathname.startsWith('/storage/'))return owner?new Response(config.marker):new Response('Denied',{status:403});
  return Response.json(owner?[{content:config.marker}]:[]);
 };
 const report=await runSupabasePrivacy(config,{...credentials,fetchImpl});assert.equal(report.verdict,'needs-attention');assert.deepEqual(report.results.filter(r=>r.status==='failed').map(r=>r.id),['public-file']);
});
