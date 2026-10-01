import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {parseOptions} from '../server/options.mjs';
import {runSupabasePrivacy} from '../server/supabase-privacy.mjs';
import {privacyContextFromOptions} from '../server/privacy-context.mjs';
const usage='Usage: node scripts/check-document-privacy.mjs --config privacy.json --out new-report.json [--app-revision full-commit-hash --fixture-hash sha256]';
if(process.argv.length===3&&process.argv[2]==='--help'){
 console.log(`${usage}\nOptional revision flags must be supplied together: lowercase 40/64-hex application revision and 64-hex SHA-256 of the approved synthetic fixture artifact. The revision belongs to the application being tested, not Boundary. Keep fixture bytes unchanged for a repair comparison. These are operator declarations, not verified deployment identity. Omit both for legacy unlinked reports. No credentials or customer data belong in these values.\nPowerShell fixture hash: (Get-FileHash -Algorithm SHA256 -LiteralPath .\\synthetic-fixture.json).Hash.ToLowerInvariant()`);
 process.exit(0);
}
try{
 const args=parseOptions(process.argv.slice(2),{'--config':'value','--out':'value','--app-revision':'value','--fixture-hash':'value'});
 if(!args['--config']||!args['--out'])throw Error(usage);
 const evidenceContext=privacyContextFromOptions(args);
 if(statSync(args['--config']).size>16384)throw Error('Configuration must be under 16 KB.');
 const config=JSON.parse(readFileSync(args['--config'],'utf8'));
 const report=await runSupabasePrivacy(config,{publishableKey:process.env.BOUNDARY_SUPABASE_PUBLIC_KEY,ownerToken:process.env.BOUNDARY_OWNER_TOKEN,otherToken:process.env.BOUNDARY_OTHER_TOKEN});
 if(evidenceContext)report.evidenceContext=evidenceContext;
 writeFileSync(args['--out'],JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({verdict:report.verdict,summary:report.summary,scope:report.scope},null,2));
 process.exitCode=report.verdict==='checks-passed'?0:report.verdict==='needs-attention'?1:2;
}catch{console.error('Document privacy check could not complete. Check the configuration, test-user environment variables and unused report filename. Optional --app-revision and --fixture-hash must be supplied together as full lowercase hashes; see --help. No protection is verified.');process.exitCode=2}
