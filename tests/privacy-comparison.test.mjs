import test from 'node:test';
import assert from 'node:assert/strict';
test('different disclosure classification versions are incomparable and legacy observations are labeled',()=>{
 const old=report(),current={...report(),adapter:'supabase-document-privacy-v4'};
 assert.equal(comparePrivacyReports(old,current).verdict,'incomparable');
 assert.equal(comparePrivacyReports(current,old).verdict,'incomparable');
 assert.equal(comparePrivacyReports(current,current).verdict,'checks-still-pass');
 assert.equal(comparePrivacyReports(current,current).classification.legacy,true);
 const legacy=comparePrivacyReports(old,old);assert.equal(legacy.classification.legacy,true);assert.match(legacy.reason,/legacy v3/);
});
import {comparePrivacyReports} from '../server/privacy-comparison.mjs';
const ids=['distinct-authenticated-users','file-owner','file-other-customer','retrieval-owner','retrieval-other-customer','public-file','anonymous-file'];
const report=(overrides={})=>({version:1,adapter:'supabase-document-privacy-v3',requirementsHash:'a'.repeat(64),results:ids.map(id=>({id,status:overrides[id]??'passed'}))});
test('repair requires matching complete checks and preserves positive controls',()=>{
 const before=report({'file-other-customer':'failed'});
 assert.equal(comparePrivacyReports(before,report()).verdict,'repair-verified');
 assert.equal(comparePrivacyReports(before,report({'file-owner':'incomplete'})).verdict,'regression');
 assert.equal(comparePrivacyReports(before,report({'file-other-customer':'incomplete'})).verdict,'incomplete');
 assert.equal(comparePrivacyReports(before,report({'file-other-customer':'failed'})).verdict,'still-failing');
});
test('a healthy current run cannot turn an incomplete baseline into a verified repair',()=>{
 assert.equal(comparePrivacyReports(report({'file-owner':'incomplete'}),report()).verdict,'baseline-incomplete');
 assert.equal(comparePrivacyReports(report(),report()).verdict,'checks-still-pass');
});
test('changed requirements, unknown adapters, missing and duplicate checks fail closed',()=>{
 const candidates=[{...report(),requirementsHash:'b'.repeat(64)},{...report(),adapter:'future'}, {...report(),results:report().results.slice(1)}, {...report(),results:[...report().results.slice(1),report().results[1]]}, {...report(),requirementsHash:undefined},null];
 for(const value of candidates)assert.equal(comparePrivacyReports(report(),value).verdict,'incomparable');
});
test('result rows override misleading summary and verdict fields; arbitrary content is not copied',()=>{
 const after={...report({'public-file':'failed'}),verdict:'checks-passed',summary:{failed:0},credentials:'SECRET'};
 after.results[0].reason='PRIVATE INPUT';
 const result=comparePrivacyReports(report(),after);
 assert.equal(result.verdict,'regression');
 assert(!JSON.stringify(result).includes('SECRET'));
 assert(!JSON.stringify(result).includes('PRIVATE INPUT'));
});

test('declared revisions can change while the same fixture and access contract establish an observed repair',()=>{
 const context=(revision)=>({version:1,provenance:'operator-declared',applicationRevision:revision.repeat(40),fixtureHash:'c'.repeat(64)});
 const before={...report({'file-other-customer':'failed'}),evidenceContext:context('a')};
 const after={...report(),evidenceContext:context('b')};
 const result=comparePrivacyReports(before,after);
 assert.equal(result.verdict,'repair-verified');
 assert.equal(result.evidenceContext.beforeApplicationRevision,'a'.repeat(40));
 assert.equal(result.evidenceContext.afterApplicationRevision,'b'.repeat(40));
 assert.equal(result.evidenceContext.deploymentVerified,false);
 for(const changed of [undefined,null,{...after.evidenceContext,fixtureHash:'d'.repeat(64)},
  {...after.evidenceContext,applicationRevision:'PRIVATE_SECRET'},
  {...after.evidenceContext,provenance:'verified'},
  {...after.evidenceContext,extra:'PRIVATE_SECRET'}]){
  const invalid=comparePrivacyReports(before,{...after,evidenceContext:changed});
  assert.equal(invalid.verdict,'incomparable');
  assert(!JSON.stringify(invalid).includes('PRIVATE_SECRET'));
 }
 assert.equal(comparePrivacyReports(report(),report()).evidenceContext.provenance,'unlinked');
});

test('v5 requires eight exact checks and cannot silently upgrade seven-check observations',()=>{
 const current=()=>({...report(),adapter:'supabase-document-privacy-v5',results:[...report().results,{id:'anonymous-retrieval',status:'passed'}]});
 const a=current(),b=current();a.results.at(-1).status='failed';
 const comparison=comparePrivacyReports(a,b);assert.equal(comparison.verdict,'repair-verified');assert.equal(comparison.changes.length,8);assert.equal(comparison.classification.legacy,false);assert.match(comparison.reason,/same 8 checks/);
 for(const legacy of [report(),{...report(),adapter:'supabase-document-privacy-v4'}]){
  assert.equal(comparePrivacyReports(legacy,b).verdict,'incomparable');assert.equal(comparePrivacyReports(b,legacy).verdict,'incomparable');assert.match(comparePrivacyReports(legacy,legacy).reason,/without anonymous retrieval/);
 }
 assert.equal(comparePrivacyReports({...b,results:b.results.slice(0,7)},b).verdict,'incomparable');
});
