import {readFileSync} from 'node:fs';
import {validateState} from './store.mjs';
try{
 if(!process.argv[2])throw new Error('Usage: node server/check-workspace.mjs path/to/state.json');
 const state=validateState(JSON.parse(readFileSync(process.argv[2],'utf8')));
 console.log(`Workspace structure and evidence checksums verified: ${state.projects.length} projects, ${state.runs.length} runs. SQL was not executed. Checksums are not signatures.`);
}catch(e){console.error(e.message);process.exitCode=1;}
