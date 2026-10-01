import {readFileSync, statSync, writeFileSync} from 'node:fs';
import {parseOptions} from '../server/options.mjs';
import {renderPrivacyHandoff} from '../server/privacy-handoff.mjs';
try {
  const args = parseOptions(process.argv.slice(2), {'--before':'value','--after':'value','--out':'value'});
  if (!args['--before'] || !args['--after'] || !args['--out']) throw Error('Missing paths');
  const read = path => {if(statSync(path).size > 65536) throw Error('Report too large'); return JSON.parse(readFileSync(path,'utf8'));};
  const {comparison,markdown} = renderPrivacyHandoff(read(args['--before']),read(args['--after']));
  writeFileSync(args['--out'],markdown,{flag:'wx',mode:0o600});
  console.log(comparison.verdict);
  process.exitCode = ['repair-verified','checks-still-pass'].includes(comparison.verdict) ? 0 : ['regression','still-failing'].includes(comparison.verdict) ? 1 : 2;
} catch {
  console.error('Export incomplete. Use supported reports under 64 KB and an unused output filename. No protection is verified.');
  process.exitCode = 2;
}
