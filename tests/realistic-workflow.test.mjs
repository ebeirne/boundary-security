import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,verifyIntegrity} from '../server/engine.mjs';
import {realisticProject,realisticScenarios} from '../scripts/realistic-fixtures.mjs';
for(const scenario of realisticScenarios)test(`agency portal: ${scenario.id}`,async()=>{
 const report=await assess(scenario.mutate(realisticProject()));
 assert.equal(report.setupError,undefined);
 assert.deepEqual(report.results.filter(r=>r.status==='failed').map(r=>r.id),scenario.failed);
 assert.deepEqual(report.results.filter(r=>r.status==='error').map(r=>r.id),scenario.errors);
 assert.equal(report.summary.notRun,0);
 assert.equal(report.verdict,scenario.errors.length?'incomplete':scenario.failed.length?'needs-attention':'checks-passed');
 assert(verifyIntegrity(report));
});
