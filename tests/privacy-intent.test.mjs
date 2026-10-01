import test from 'node:test';
import assert from 'node:assert/strict';
import {privacyIntentKey,hasReviewedPrivacyIntent} from '../src/privacy-intent.mjs';
const config={origin:'https://test.supabase.co',ownerId:'owner',otherId:'other',bucket:'files',object:'one.txt',table:'documents',recordId:1,marker:'invented',retrieval:{mode:'row'},authorized:false};
test('intent review is absent by default and tied to each declared actor, resource and route',()=>{
 assert.equal(hasReviewedPrivacyIntent(config,null),false);
 const key=privacyIntentKey(config);assert.equal(hasReviewedPrivacyIntent(config,key),true);
 for(const field of ['origin','ownerId','otherId','bucket','object','table','recordId','marker'])assert.equal(hasReviewedPrivacyIntent({...config,[field]:'changed'},key),false,field);
 assert.equal(hasReviewedPrivacyIntent({...config,retrieval:{mode:'rpc',functionName:'read_document'}},key),false);
 const rpc={...config,retrieval:{mode:'rpc',functionName:'first'}};
 assert.equal(hasReviewedPrivacyIntent({...rpc,retrieval:{mode:'rpc',functionName:'second'}},privacyIntentKey(rpc)),false);
});
test('authorization is separate and importing approval data cannot supply UI review state',()=>{
 const key=privacyIntentKey(config);
 assert.equal(hasReviewedPrivacyIntent({...config,authorized:true},key),true);
 assert.equal(hasReviewedPrivacyIntent({...config,intendedAccessReviewed:true,reviewedKey:key},null),false);
 assert(!key.includes('authorized'));
});
