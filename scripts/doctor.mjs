import {writeFileSync} from 'node:fs';
import {runAssessment} from '../server/runner.mjs';
import {demoProject,demoPatch} from '../server/demo.mjs';
import {parseOptions} from '../server/options.mjs';
import {toolVersion} from '../server/version.mjs';
let options;
try{options=parseOptions(process.argv.slice(2),{'--repetitions':'value','--out':'value'});}catch(error){console.error(error.message);process.exit(2);}
const count=Number(options['--repetitions']??3);
if(!Number.isInteger(count)||count<1||count>20)throw Error('Choose 1–20 repetitions.');
const report={at:new Date().toISOString(),toolVersion,node:process.version,platform:process.platform,arch:process.arch,scope:'Owned synthetic startup checks only. Not a production-readiness certification.',results:[]};
for(let i=0;i<count;i++)for(const repaired of [false,true]){
 const p=demoProject();if(repaired)p.migration+='\n'+demoPatch;
 const start=performance.now();
 try{const r=await runAssessment(p);const ok=!r.startupRecovery&&!r.setupError&&r.summary.passed===(repaired?10:8)&&r.summary.failed===(repaired?0:2)&&r.summary.errors===0&&r.summary.notRun===0;
 report.results.push({attempt:i+1,repaired,ok,ms:Math.round(performance.now()-start),engine:r.engineVersion,summary:r.summary,setupError:r.setupError,startupRecovery:r.startupRecovery});}
 catch(error){report.results.push({attempt:i+1,repaired,ok:false,ms:Math.round(performance.now()-start),error:error.message,diagnostic:error.diagnostic});}
 console.log(JSON.stringify(report.results.at(-1)));
}
report.ok=report.results.every(r=>r.ok);
if(options['--out'])writeFileSync(options['--out'],JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
console.log(report.ok?'Local startup checks passed. Release gates still apply.':'Startup checks failed. Preserve this report; do not release.');process.exitCode=report.ok?0:1;


