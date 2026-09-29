import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {demoProject} from '../server/demo.mjs';

test('losing the parent connection stops a process even during a slow SQL query',async t=>{
 const child=fork(new URL('../server/assessment-process.mjs',import.meta.url),[],{silent:true,windowsHide:true,execArgv:['--max-old-space-size=384'],serialization:'advanced'});
 child.stdout.resume();child.stderr.resume();t.after(()=>{if(child.exitCode===null)child.kill();});
 const p=demoProject();p.seed+='SELECT pg_sleep(30);';child.send(p);
 const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 await new Promise(resolve=>setTimeout(resolve,3000));assert.equal(child.exitCode,null);
 child.disconnect();let timer;
 const result=await Promise.race([exit,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Assessment process stayed alive after losing its parent')),2000);})]).finally(()=>clearTimeout(timer));
 assert.equal(result.code,1);
});
