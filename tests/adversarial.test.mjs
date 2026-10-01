import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,verifyIntegrity} from '../server/engine.mjs';
import {runAssessment} from '../server/runner.mjs';

// A second schema with direct ownership, no demo membership table or repair SQL.
import {fixture,advancedCases,alice} from '../scripts/policy-fixtures.mjs';
for(const c of advancedCases())test('policy semantics: '+c.name,async()=>{
 const r=await assess(c.project);assert.equal(r.setupError,undefined);assert.equal(r.summary.errors,0);assert.deepEqual(r.results.filter(x=>x.status==='failed').map(x=>x.id).sort(),c.failures.sort());assert(verifyIntegrity(r));
});
for(const [name,sql,failures] of [
 ['clean direct ownership','',[]],
 ['broad read','ALTER POLICY r ON public.notes USING(true);',['select-other','outsider']],
 ['broad insert','ALTER POLICY i ON public.notes WITH CHECK(true); ALTER POLICY r ON public.notes USING(true);',['select-other','outsider','insert-other']],
 ['broad update','ALTER POLICY u ON public.notes USING(true) WITH CHECK(true); ALTER POLICY r ON public.notes USING(true);',['select-other','outsider','update-other']],
 ['broad delete','ALTER POLICY d ON public.notes USING(true); ALTER POLICY r ON public.notes USING(true);',['select-other','outsider','delete-other']],
 ['anonymous read','CREATE POLICY visitor ON public.notes FOR SELECT TO anon USING(true);',['select-anon']],
 ['no row security','ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;',['select-other','select-anon','update-other','update-anon','delete-other','delete-anon','insert-other','insert-anon','outsider']],
 ['blanket revoke','REVOKE ALL ON public.notes FROM authenticated;',['select-own','update-own','delete-own','insert-own']]
])test('mutation matrix: '+name,async()=>{const r=await assess(fixture(sql));assert.equal(r.setupError,undefined);assert.equal(r.summary.errors,0);assert.deepEqual(r.results.filter(x=>x.status==='failed').map(x=>x.id).sort(),failures.sort());assert(verifyIntegrity(r));});

test('each write rolls back and cannot contaminate a following read',async()=>{
 const p=fixture();p.contract.checks=[p.contract.checks.find(c=>c.id==='update-own'),{...p.contract.checks[0],id:'read-original',match:{id:1,body:'one'}},p.contract.checks.find(c=>c.id==='delete-own'),{...p.contract.checks[0],id:'read-after-delete'}];
 const r=await assess(p);assert.equal(r.summary.passed,4);assert.equal(r.summary.errors,0);
});
test('database initialization failure is identified and cannot create any passes',async()=>{
 const r=await assess(fixture(),{createDatabase:async()=>{throw new WebAssembly.RuntimeError('unreachable');}});
 assert.equal(r.setupError.phase,'initialization');assert.equal(r.summary.passed,0);assert.equal(r.summary.notRun,13);assert.equal(r.verdict,'incomplete');assert(verifyIntegrity(r));
});
test('ambiguous fixtures and nonexistent resources never become a denial pass',async()=>{
 const p=fixture();p.seed+=`INSERT INTO public.notes VALUES(3,'${alice}','one');`;p.contract.checks=[{...p.contract.checks[1],match:{body:'one'}},{...p.contract.checks[2],id:'no-table',table:'public.missing'}];
 const r=await assess(p);assert.equal(r.summary.passed,0);assert.equal(r.summary.errors,2);assert.equal(r.verdict,'incomplete');
});
test('SQL timeout terminates a live query, then another worker can assess normally',async()=>{
 const p=fixture();p.seed+='SELECT pg_sleep(30);';await assert.rejects(runAssessment(p,{timeoutMs:3000}),/stopped/);
 const next=await runAssessment(fixture());assert.equal(next.summary.passed,13);
});


