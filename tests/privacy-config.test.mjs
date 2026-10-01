import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrivacySetup,privacySetupErrors} from '../src/privacy-config.mjs';
import {validatePrivacyConfig} from '../server/supabase-privacy.mjs';
const setup=()=>({version:1,authorized:true,synthetic:true,origin:'https://owned-staging.supabase.co',ownerId:'11111111-1111-4111-8111-111111111111',otherId:'22222222-2222-4222-8222-222222222222',bucket:'documents',object:'customer-a/test.txt',table:'documents',recordId:42,marker:'BOUNDARY_TEST_1234567890123456',retrieval:{mode:'row'}});
test('import preserves server-compatible inputs but requires fresh human consent',()=>{
 const c=parsePrivacySetup(JSON.stringify(setup()));
 assert.equal(c.authorized,false);assert.equal(c.recordId,42);
 assert.deepEqual(privacySetupErrors(c),[]);
 assert.doesNotThrow(()=>validatePrivacyConfig({...c,authorized:true}));
 const rpc=setup();rpc.retrieval={mode:'rpc',functionName:'get_document',reviewedReadOnly:true};
 const imported=parsePrivacySetup(JSON.stringify(rpc));
 assert.equal(imported.retrieval.reviewedReadOnly,false);
 assert.throws(()=>validatePrivacyConfig({...imported,authorized:true}));
 assert.doesNotThrow(()=>validatePrivacyConfig({...imported,authorized:true,retrieval:{...imported.retrieval,reviewedReadOnly:true}}));
});
test('import rejects hidden credential fields without echoing their values',()=>{
 for(const patch of [{ownerToken:'PRIVATE_TOKEN'},{credentials:{ownerToken:'PRIVATE_TOKEN'}},{retrieval:{mode:'row',password:'PRIVATE_TOKEN'}}]){
  assert.throws(()=>parsePrivacySetup(JSON.stringify({...setup(),...patch})),e=>!e.message.includes('PRIVATE_TOKEN')&&/unsupported/.test(e.message));
 }
});
test('invalid targets and identities are rejected before requesting sessions',()=>{
 for(const patch of [{origin:'https://owned-staging.supabase.co@evil.example'},{origin:'https://owned-staging.supabase.co/rest/v1'},{origin:'https://owned-staging.supabase.co/?key=secret'},{object:'../private.txt'},{object:'x/%2e%2e/private.txt'},{otherId:setup().ownerId},{recordId:true},{synthetic:false},{retrieval:{mode:'invented'}}])assert.throws(()=>parsePrivacySetup(JSON.stringify({...setup(),...patch})));
 assert.equal(privacySetupErrors({...setup(),ownerId:'',otherId:''},{step:0}).length,0,'document step does not demand accounts early');
 assert.equal(privacySetupErrors({...setup(),otherId:setup().ownerId},{step:1})[0].field,'otherId');
 assert.throws(()=>parsePrivacySetup('{unfinished'));
 assert.throws(()=>parsePrivacySetup(' '.repeat(16385)));
});
