import {readFileSync,writeFileSync} from 'node:fs';
import {runAssessment} from './runner.mjs';
import {demoProject,demoPatch} from './demo.mjs';
import {parseOptions} from './options.mjs';
const args=process.argv.slice(2);
if(!args.length){console.log('Usage: node server/cli.mjs --demo [--repaired] [--out result.json]\n       node server/cli.mjs --project project.json [--out result.json]\nOnly import reviewed SQL and synthetic fixtures. Execution is local; no deployment is checked.');process.exit(0);}
try {
  const options=parseOptions(args,{'--project':'value','--demo':'flag','--repaired':'flag','--out':'value'});
  if(Boolean(options['--project'])===Boolean(options['--demo']))throw Error('Choose exactly one of --demo or --project.');
  const p=options['--project']?JSON.parse(readFileSync(options['--project'],'utf8')):demoProject();
  if(!p)throw new Error('Choose --demo or --project project.json.');
  if(args.includes('--repaired')){if(!args.includes('--demo'))throw new Error('--repaired only applies to the demo.');p.migration+='\n'+demoPatch;p.revision='demo-v2-repaired';}
  const r=await runAssessment(p);if(options['--out'])writeFileSync(options['--out'],JSON.stringify(r,null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({verdict:r.verdict,summary:r.summary,setupError:r.setupError,sourceHash:r.sourceHash,contractHash:r.contractHash},null,2));
  process.exitCode=r.verdict==='checks-passed'?0:r.verdict==='incomplete'?2:1;
}catch(e){console.error(e.message);process.exitCode=2;}
