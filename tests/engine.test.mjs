import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,verifyIntegrity,hash} from '../server/engine.mjs';
import {demoProject,demoPatch} from '../server/demo.mjs';
import {validateProject,validateContract,coverageWarnings} from '../server/validation.mjs';
import {runAssessment} from '../server/runner.mjs';
import {markdownReport} from '../server/report.mjs';

test('real PostgreSQL identifies cross-organization read and edit failures',async()=>{
 const r=await assess(demoProject());assert.equal(r.setupError,undefined);assert.deepEqual(r.summary,{passed:8,failed:2,errors:0,notRun:0});assert.deepEqual(r.results.filter(c=>c.status==='failed').map(c=>c.id),['read-other','update-other']);assert.match(r.engineVersion,/PostgreSQL/);assert.equal(r.verdict,'needs-attention');
});
test('repair closes the gaps and preserves all normal-use controls; evidence changes',async()=>{
 const p=demoProject(),before=await assess(p);p.migration+='\n'+demoPatch;p.revision='fixed';const after=await assess(p);
 assert.deepEqual(after.summary,{passed:10,failed:0,errors:0,notRun:0});assert.equal(after.verdict,'checks-passed');assert.equal(before.contractHash,after.contractHash);assert.notEqual(before.sourceHash,after.sourceHash);assert(verifyIntegrity(after));
 const altered=structuredClone(after);altered.summary.failed=100;assert.equal(verifyIntegrity(altered),false);
 assert(!JSON.stringify(after).includes('Northstar brief'));assert(!JSON.stringify(after).includes('11111111-1111-4111-8111-111111111111'));assert(!Object.hasOwn(after.results[0],'values'));
 assert.match(markdownReport(after),/Not a customer assessment/);assert.match(markdownReport(after),/Checksum verified at export: yes/);
});
test('missing target rows are unverified, never evidence of denial',async()=>{
 const p=demoProject();p.contract.checks=[{...p.contract.checks[1],match:{id:'dddddddd-dddd-4ddd-8ddd-dddddddddd99'}}];const r=await assess(p);assert.equal(r.results[0].status,'error');assert.equal(r.summary.passed,0);assert.equal(r.verdict,'incomplete');
});
test('schema errors do not pass deny checks',async()=>{
 const p=demoProject();p.contract.checks=[{...p.contract.checks[1],match:{missing_column:'missing'}}];const r=await assess(p);assert.equal(r.results[0].sqlstate,'42703');assert.equal(r.results[0].status,'error');
});
test('constraint errors are not interpreted as permission denial',async()=>{
 const p=demoProject();p.contract.checks=[{...p.contract.checks[8],expected:'deny',values:{...p.contract.checks[8].values,title:null}}];const r=await assess(p);assert.equal(r.results[0].sqlstate,'23502');assert.equal(r.results[0].status,'error');
});
test('broken migration returns not-run coverage without fabricated passes',async()=>{
 const p=demoProject();p.migration='THIS IS NOT SQL;';const r=await assess(p);assert.equal(r.setupError.code,'42601');assert.equal(r.summary.notRun,10);assert.equal(r.results.length,10);assert(r.results.every(x=>x.status==='unknown'));assert.equal(r.summary.passed,0);assert.equal(r.verdict,'incomplete');
});
test('blanket deny repair fails positive controls',async()=>{
 const p=demoProject();p.migration+='\nREVOKE ALL ON public.documents FROM authenticated;';const r=await assess(p);assert.equal(r.summary.failed,4);assert(r.results.filter(x=>x.expected==='allow').every(x=>x.status==='failed'));
});
test('elevated role and ownership inputs are rejected',async()=>{
 const p=demoProject();p.migration+='\nALTER ROLE authenticated BYPASSRLS;';const r=await assess(p);assert.equal(r.setupError.code,'BR001');assert.equal(r.summary.notRun,10);
});
test('modified identity helper cannot silently replace the test identity',async()=>{
 const p=demoProject();p.migration+='\nCREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;';const r=await assess(p);assert.equal(r.setupError.code,'BR002');
});
test('changing a contract produces a new contract hash',async()=>{
 const p=demoProject(),a=await assess(p);p.contract.checks[1].expected='allow';const b=await assess(p);assert.notEqual(a.contractHash,b.contractHash);assert.equal(a.sourceHash,b.sourceHash);
});
test('worker can be stopped without manufacturing a result',async()=>{
 await assert.rejects(runAssessment(demoProject(),{timeoutMs:5}),/stopped/);
});
test('validation rejects injection-shaped identifiers, elevated roles, duplicate IDs and missing consent',()=>{
 const p=demoProject();p.contract.checks[0].table='public.documents; DROP SCHEMA public';assert.throws(()=>validateProject(p),/public.table_name/);
 const p2=demoProject();p2.contract.checks[0].role='postgres';assert.throws(()=>validateProject(p2),/role must/);
 const p3=demoProject();p3.contract.checks[1].id=p3.contract.checks[0].id;assert.throws(()=>validateProject(p3),/unique/);
 const p4=demoProject();p4.authorized=false;assert.throws(()=>validateProject(p4),/authorization/);
});
test('deny-only contracts are explicitly incomplete in coverage',()=>{
 const p=demoProject();p.contract.checks=p.contract.checks.filter(c=>c.expected==='deny');assert(coverageWarnings(validateContract(p.contract)).length>0);
});

test('disabling RLS exposes four cross-organization operations',async()=>{
 const p=demoProject();p.migration+='\nALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;';const r=await assess(p);
 assert.deepEqual(r.results.filter(x=>x.status==='failed').map(x=>x.id),['read-other','update-other','delete-other','insert-other']);
});
test('repaired policies also isolate a second authenticated organization',async()=>{
 const p=demoProject();p.migration+='\n'+demoPatch;
 for(const c of p.contract.checks){if(c.userId)c.userId='22222222-2222-4222-8222-222222222222';if(c.match.id)c.match.id=c.match.id.endsWith('01')?c.match.id.slice(0,-2)+'02':c.match.id.slice(0,-2)+'01';if(c.values.org_id)c.values.org_id=c.values.org_id.startsWith('a')?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';}
 const r=await assess(p);assert.equal(r.summary.passed,10);assert.equal(r.verdict,'checks-passed');
});
test('organization reassignment is prevented by WITH CHECK and exposed when removed',async()=>{
 const p=demoProject();p.migration+='\n'+demoPatch;const c={...p.contract.checks[3],id:'move-org',label:'Move owned record to another organization',expected:'deny',values:{org_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}};p.contract.checks.push(c);
 const good=await assess(p);assert.equal(good.results.at(-1).status,'passed');
 p.migration+='\nALTER POLICY update_documents ON public.documents WITH CHECK (true);\nALTER POLICY read_documents ON public.documents USING (true);';const bad=await assess(p);assert.equal(bad.results.at(-1).status,'failed');
});
test('source fingerprints distinguish migration and seed boundaries',()=>{
 assert.notEqual(hash({migration:'A',seed:'B\n-- seed --\nC'}),hash({migration:'A\n-- seed --\nB',seed:'C'}));
});
