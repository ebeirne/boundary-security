import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createAssessment,canonical} from '../server/assessment-core.mjs';
import {verifyIntegrity} from '../server/engine.mjs';
import {demoProject} from '../server/demo.mjs';
const hash=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:canonical(value)))).toString('hex');
const {assess}=createAssessment({hash,randomUUID:()=>crypto.randomUUID(),toolVersion:'test',databasePackageVersion:'test',defaultDatabase:()=>PGlite.create()});
test('async browser-style adapter preserves report integrity and excludes input records',async()=>{const run=await assess(demoProject());assert.deepEqual(run.summary,{passed:8,failed:2,errors:0,notRun:0});assert.equal(verifyIntegrity(run),true);for(const r of run.results){assert.equal('match' in r,false);assert.equal('values'in r,false);assert.equal('userId'in r,false)}});
