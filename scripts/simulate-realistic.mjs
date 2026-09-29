import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {assess,verifyIntegrity} from '../server/engine.mjs';
import {realisticProject,realisticScenarios} from './realistic-fixtures.mjs';
const root=new URL('../evidence/realistic-lab/',import.meta.url);await mkdir(root,{recursive:true});
const summary={createdAt:new Date().toISOString(),scope:'Self-authored synthetic embedded PostgreSQL simulation. No real authentication, API, customer data or independent review.',scenarios:[]};
for(const scenario of realisticScenarios){
 const project=scenario.mutate(realisticProject());project.revision=scenario.id;
 const report=await assess(project);
 assert.equal(report.setupError,undefined);
 assert.deepEqual(report.results.filter(r=>r.status==='failed').map(r=>r.id),scenario.failed);
 assert.deepEqual(report.results.filter(r=>r.status==='error').map(r=>r.id),scenario.errors);
 assert(verifyIntegrity(report));
 const {authorized,synthetic,...portable}=project;
 await writeFile(new URL(scenario.id+'.project.json',root),JSON.stringify(portable,null,2));
 await writeFile(new URL(scenario.id+'.report.json',root),JSON.stringify(report,null,2));
 summary.scenarios.push({id:scenario.id,...report.summary,verdict:report.verdict,expectedFailures:scenario.failed,expectedErrors:scenario.errors});
}
await writeFile(new URL('summary.json',root),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
