import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {toolVersion} from '../server/version.mjs';
import {checkJourney} from './journey-check.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
function sourceHash(){
 const files=['package.json','package-lock.json','index.html','vite.config.js','Start-Boundary.cmd'];
 const walk=dir=>{for(const entry of readdirSync(path.join(root,dir),{withFileTypes:true})){const name=dir+'/'+entry.name;if(entry.isDirectory())walk(name);else if(entry.isFile())files.push(name);}};
 for(const dir of ['src','server','scripts','public','tests','examples'])walk(dir);
 const hash=createHash('sha256');for(const file of files.sort()){const bytes=readFileSync(path.join(root,file));hash.update(JSON.stringify([file,bytes.length]));hash.update(bytes);}return hash.digest('hex');
}
const output=path.join(root,'.release-checks',new Date().toISOString().replaceAll(':','-'));
mkdirSync(output,{recursive:true});
const report={toolVersion,at:new Date().toISOString(),sourceHash:sourceHash(),scope:'Owned local release checks. Does not approve production or establish independent review.',node:process.version,platform:process.platform,stages:[],ok:false};
function run(name,args){
 console.log(`Checking ${name}...`);
 const result=spawnSync(process.execPath,args,{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 writeFileSync(path.join(output,name+'.log'),(result.stdout??'')+(result.stderr??''),{flag:'wx'});
 report.stages.push({name,ok:result.status===0,exitCode:result.status,error:result.error?.message});
 if(result.status!==0)throw Error(`${name} failed. See the retained log.`);
}
try{
 run('build',['node_modules/vite/bin/vite.js','build']);
 run('tests',['--test','--test-concurrency=1',...readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f)]);
 console.log('Checking imported project, repair, export, restart and recovery...');
 report.journey=await checkJourney(path.join(output,'journey'));
 report.sourceUnchanged=report.sourceHash===sourceHash();if(!report.sourceUnchanged)throw Error('Source changed during verification. Run the release check again.');report.ok=true;
}catch(error){report.error=error.message;process.exitCode=1;}
finally{writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(`${report.ok?'Local checks passed':'Release checks failed'}: ${path.join(output,'report.json')}`);console.log('Independent review, live-target validation and the unresolved startup issue remain separate release gates.');}
