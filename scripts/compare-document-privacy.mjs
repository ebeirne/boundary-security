import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {parseOptions} from '../server/options.mjs';
import {comparePrivacyReports} from '../server/privacy-comparison.mjs';
try{
 const args=parseOptions(process.argv.slice(2),{'--before':'value','--after':'value','--out':'value'});
 if(!args['--before']||!args['--after']||!args['--out'])throw Error('Missing paths');
 const read=path=>{if(statSync(path).size>65536)throw Error('Report too large');return JSON.parse(readFileSync(path,'utf8'))};
 const result=comparePrivacyReports(read(args['--before']),read(args['--after']));
 writeFileSync(args['--out'],JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify(result,null,2));
 process.exitCode=['repair-verified','checks-still-pass'].includes(result.verdict)?0:['regression','still-failing'].includes(result.verdict)?1:2;
}catch{console.error('Comparison could not complete. Use two supported reports under 64 KB and an unused output filename. No repair is verified.');process.exitCode=2}
