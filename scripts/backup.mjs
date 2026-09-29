import {createBackup,verifyBackup,restoreBackup} from '../server/backup.mjs';
const [command,source,destination,...extra]=process.argv.slice(2);
try{
 if(extra.length||!source||!['create','verify','restore'].includes(command)||(command!=='verify'&&!destination)||(command==='verify'&&destination))throw Error('Usage: npm run backup -- create <workspace-directory> <new-backup-file> | verify <backup-file> | restore <backup-file> <new-workspace-directory>');
 const result=command==='create'?createBackup(source,destination):command==='restore'?restoreBackup(source,destination):(()=>{const {envelope,state}=verifyBackup(source);return {verified:true,sha256:envelope.sha256,projects:state.projects.length,runs:state.runs.length};})();
 console.log(JSON.stringify(result,null,2));
 console.log('SQL was not executed. Backup contains plaintext inputs. Checksums detect accidental changes, not malicious rewriting.');
}catch(error){console.error(error.message);process.exitCode=1;}
