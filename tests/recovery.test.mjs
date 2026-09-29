import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runAssessment} from '../server/runner.mjs';
import {demoProject,demoPatch} from '../server/demo.mjs';
import {verifyIntegrity} from '../server/engine.mjs';
import {markdownReport} from '../server/report.mjs';
const fixture=new URL('./fixtures/startup-recovery.mjs',import.meta.url);
for(const always of [false,true])test(always?'persistent initialization failure remains incomplete after one retry':'fresh-process startup recovery preserves failed evidence and actual results',async()=>{
 const p={...demoProject(),testMarker:path.join(mkdtempSync(path.join(tmpdir(),'boundary-recovery-')),'marker'),testAlwaysFail:always};p.migration+='\n'+demoPatch;
 const r=await runAssessment(p,{processFile:fixture});
 assert.equal(r.startupRecovery.failedAttempts.length,1);assert(verifyIntegrity(r));assert(verifyIntegrity(r.startupRecovery.failedAttempts[0]));assert.equal(r.startupRecovery.failedAttempts[0].summary.passed,0);
 assert.equal(r.startupRecovery.recovered,!always);assert.equal(r.verdict,always?'incomplete':'checks-passed');assert.equal(r.summary.passed,always?0:10);
 assert(markdownReport(r).includes('Startup recovery:'));
});
test('SQL setup failures are not retried as initialization failures',async()=>{const p=demoProject();p.migration='invalid sql';const r=await runAssessment(p);assert.equal(r.setupError.phase,'migration');assert.equal(r.startupRecovery,undefined);assert.equal(r.verdict,'incomplete');});
test('crashed retry retains original initialization evidence without a pass',async()=>{
 const p={...demoProject(),testMarker:path.join(mkdtempSync(path.join(tmpdir(),'boundary-recovery-')),'marker'),testCrashRetry:true};
 const r=await runAssessment(p,{processFile:fixture});assert.equal(r.verdict,'incomplete');assert.equal(r.summary.passed,0);assert.equal(r.startupRecovery.retryFailure.diagnostic.exitCode,9);assert(verifyIntegrity(r));
});
