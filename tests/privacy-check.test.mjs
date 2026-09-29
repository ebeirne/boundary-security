import test from 'node:test';
import assert from 'node:assert/strict';
import {checkDocumentPrivacy,localPrivacyAdapter} from '../server/privacy-check.mjs';
import {startPrivacyFixture,fixtureTokens,syntheticMarker} from '../scripts/privacy-fixture.mjs';
const cases=[['secure',0,0],['file-leak',1,0],['retrieval-leak',1,0],['both-leak',2,0],['outage',0,4],['missing-fixture',0,4],['expired-session',0,2],['redirect',0,2],['unknown-body',0,2],['same-identity',0,1]];
for(const [mode,failed,incomplete] of cases)test(`document privacy over HTTP: ${mode}`,async()=>{
 const fixture=await startPrivacyFixture(mode);
 try{
  const report=await checkDocumentPrivacy({request:localPrivacyAdapter({origin:fixture.origin,tokens:fixtureTokens}),owner:'alice',outsider:'bob',marker:syntheticMarker});
  assert.equal(report.summary.failed,failed);assert.equal(report.summary.incomplete,incomplete);
  assert.equal(report.verdict,failed?'needs-attention':incomplete?'incomplete':'checks-passed');
  const serialized=JSON.stringify(report);for(const secret of [syntheticMarker,...Object.values(fixtureTokens)])assert(!serialized.includes(secret));
 }finally{await fixture.close()}
});
test('fixture adapter rejects remote origins and URL credentials',()=>{
 for(const origin of ['https://example.com','http://example.com','http://user:password@127.0.0.1:1234','http://127.0.0.1:1234/other'])assert.throws(()=>localPrivacyAdapter({origin,tokens:fixtureTokens}));
});
test('identical test identities are rejected before requests',async()=>{
 await assert.rejects(checkDocumentPrivacy({request:()=>assert.fail('No request expected'),owner:'alice',outsider:'alice',marker:syntheticMarker}));
});
test('unbounded response is incomplete instead of a passing denial',async()=>{
 const adapter=localPrivacyAdapter({origin:'http://127.0.0.1:1234',tokens:fixtureTokens,fetchImpl:async()=>new Response('x'.repeat(65537))});
 await assert.rejects(adapter({actor:'alice',surface:'file'}),/too large/);
});
