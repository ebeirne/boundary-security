import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {parseOptions} from '../server/options.mjs';
import {runSupabasePrivacy} from '../server/supabase-privacy.mjs';
try{
 const args=parseOptions(process.argv.slice(2),{'--config':'value','--out':'value'});
 if(!args['--config']||!args['--out'])throw Error('Usage: node scripts/check-document-privacy.mjs --config privacy.json --out new-report.json');
 if(statSync(args['--config']).size>16384)throw Error('Configuration must be under 16 KB.');
 const config=JSON.parse(readFileSync(args['--config'],'utf8'));
 const report=await runSupabasePrivacy(config,{publishableKey:process.env.BOUNDARY_SUPABASE_PUBLIC_KEY,ownerToken:process.env.BOUNDARY_OWNER_TOKEN,otherToken:process.env.BOUNDARY_OTHER_TOKEN});
 writeFileSync(args['--out'],JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({verdict:report.verdict,summary:report.summary,scope:report.scope},null,2));
 process.exitCode=report.verdict==='checks-passed'?0:report.verdict==='needs-attention'?1:2;
}catch{console.error('Document privacy check could not complete. Check the configuration, test-user environment variables and unused report filename. No protection is verified.');process.exitCode=2}
