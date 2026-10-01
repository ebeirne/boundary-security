import test from 'node:test';
import assert from 'node:assert/strict';
import {privacyResultView} from '../src/privacy-results.mjs';
const ids=['distinct-authenticated-users','file-owner','retrieval-owner','file-other-customer','retrieval-other-customer','public-file','anonymous-file','anonymous-retrieval'];
const report=()=>({results:ids.map(id=>({id,status:'passed',reason:'Observed test result.'})),summary:{passed:8,failed:0,incomplete:0}});

test('scoped success groups allowed and blocked intent without treating owner success as leakage',()=>{
 const view=privacyResultView(report());
 assert.equal(view.outcome,'passed');assert.equal(view.historical,false);
 assert.equal(view.groups[1].rows.length,2);assert.equal(view.groups[2].rows.length,5);
 assert(view.groups[1].rows.every(r=>r.intent==='Should be allowed.'));
 assert(view.groups[2].rows.every(r=>r.intent==='Should be blocked.'));
 assert.match(view.headline,/selected access checks/);
});

test('a stale report, running rerun, or failed latest attempt cannot keep a passing headline',()=>{
 for(const [state,outcome] of [[{dirty:true},'stale'],[{attempt:'failed'},'failedAttempt'],[{attempt:'running'},'running'],[{dirty:true,attempt:'failed'},'failedAttempt']]){
  const view=privacyResultView(report(),state);
  assert.equal(view.outcome,outcome);assert.equal(view.historical,true);assert.doesNotMatch(view.headline,/behaved as expected/);
 }
});

test('actual failures win over incomplete checks and receive surface-specific repair guidance',()=>{
 const value=report();value.results.find(r=>r.id==='public-file').status='failed';value.results.find(r=>r.id==='retrieval-owner').status='incomplete';
 const view=privacyResultView(value);
 assert.equal(view.outcome,'failed');assert.equal(view.counts.failed,1);
 assert.match(view.groups[2].rows.find(r=>r.id==='public-file').action,/public setting/);
 assert.match(view.groups[1].rows.find(r=>r.id==='retrieval-owner').action,/array of rows/);
});

test('missing checks after identity failure stay unverified with actionable prerequisite',()=>{
 const view=privacyResultView({results:[{id:'distinct-authenticated-users',status:'incomplete'}],summary:{passed:7}});
 assert.equal(view.outcome,'incomplete');assert.equal(view.counts.incomplete,8);
 assert(view.groups.flatMap(g=>g.rows).every(r=>/fresh access tokens/.test(r.action)));
});

test('missing, duplicate, unrecognized status and unknown checks cannot create reassuring complete result',()=>{
 const missing=report();missing.results.pop();
 const duplicate=report();duplicate.results.push(duplicate.results[0]);
 const unknownStatus=report();unknownStatus.results[0].status='safe';
 const unknownCheck=report();unknownCheck.results.push({id:'unexpected',status:'passed'});
 for(const value of [missing,duplicate,unknownStatus,unknownCheck,null])assert.equal(privacyResultView(value).outcome,'incomplete');
});

test('denial that lacks an owner baseline guides toward owner control before retry',()=>{
 const value=report();value.results.find(r=>r.id==='file-owner').status='incomplete';value.results.find(r=>r.id==='file-other-customer').status='incomplete';
 const view=privacyResultView(value);
 assert.match(view.groups[2].rows.find(r=>r.id==='file-other-customer').action,/owner-access check/);
});

test('anonymous document findings use document guidance and legacy seven-check reports remain incomplete',()=>{
 const current=report();current.results.find(r=>r.id==='anonymous-retrieval').status='failed';
 assert.match(privacyResultView(current).groups[2].rows.find(r=>r.id==='anonymous-retrieval').action,/anonymous access to the document/);
 current.results.find(r=>r.id==='retrieval-owner').status='incomplete';
 assert.match(privacyResultView(current).groups[2].rows.find(r=>r.id==='anonymous-retrieval').action,/owner-access check/);
 const legacy=report();legacy.results.pop();legacy.summary.passed=7;
 const view=privacyResultView(legacy);assert.equal(view.outcome,'incomplete');
 assert.equal(view.groups[2].rows.find(r=>r.id==='anonymous-retrieval').label,'Not verified');
});
