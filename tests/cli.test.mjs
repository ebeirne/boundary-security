import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseOptions} from '../server/options.mjs';
import {runAssessment} from '../server/runner.mjs';
import {demoProject} from '../server/demo.mjs';
import {toolVersion,databasePackageVersion} from '../server/version.mjs';
import {assess,verifyIntegrity} from '../server/engine.mjs';

test('automation rejects unknown, duplicated, and missing options',()=>{
 const spec={'--demo':'flag','--out':'value'};
 for(const args of [['--typo'],['--out'],['--out','--demo'],['--demo','--demo']])assert.throws(()=>parseOptions(args,spec));
 assert.deepEqual(parseOptions(['--demo','--out','a file.json'],spec),{'--demo':true,'--out':'a file.json'});
});
test('CLI rejects conflicting inputs and doctor rejects lost Windows arguments',()=>{
 for(const [file,args] of [['../server/cli.mjs',['--demo','--project','nonexistent.json']],['../scripts/doctor.mjs',['1','startup.json']]]){
  const r=spawnSync(process.execPath,[fileURLToPath(new URL(file,import.meta.url)),...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,2);assert.equal(r.stdout,'');assert.match(r.stderr,/Choose exactly one|Unknown option/);
 }
});
test('failed initialization retains release provenance without exposing error contents',async()=>{
 const r=await assess(demoProject(),{createDatabase:async()=>{throw new WebAssembly.RuntimeError('unreachable private sentinel');}});
 assert.equal(r.toolVersion,toolVersion);assert.equal(r.databasePackageVersion,databasePackageVersion);assert.equal(r.setupError.runtime.failureKind,'wasm-runtime');assert.equal(r.verdict,'incomplete');assert.equal(r.summary.passed,0);assert(verifyIntegrity(r));assert(!JSON.stringify(r).includes('private sentinel'));
});
test('process crash and timeout produce distinguishable safe diagnostics',async()=>{
 await assert.rejects(runAssessment(demoProject(),{processFile:new URL('./fixtures/crash-process.mjs',import.meta.url)}),e=>e.diagnostic.kind==='process-failure'&&e.diagnostic.elapsedMs>=0);
 await assert.rejects(runAssessment(demoProject(),{timeoutMs:1}),e=>e.diagnostic.kind==='timeout'&&e.diagnostic.node===process.version);
});
