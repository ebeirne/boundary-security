import {existsSync,writeFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {assess} from '../../server/engine.mjs';
process.once('message',async project=>{
 const fail=project.testAlwaysFail||!existsSync(project.testMarker);
 if(!fail&&project.testCrashRetry)process.exit(9);
 if(!existsSync(project.testMarker))writeFileSync(project.testMarker,'attempted',{flag:'wx'});
 const run=await assess(project,{createDatabase:async()=>{if(fail)throw new WebAssembly.RuntimeError('injected startup failure');return PGlite.create();}});
 process.send({ok:true,run},()=>process.exit(0));
});
