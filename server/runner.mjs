import {fork} from 'node:child_process';
import {hash} from './engine.mjs';
// Separate process contains native/WASM crashes. The heap flag is not a total-memory cap.
function runOnce(project,{timeoutMs=45000,processFile=new URL('./assessment-process.mjs',import.meta.url)}={}) {
 return new Promise((resolve,reject)=>{
  const started=performance.now();
  const child=fork(processFile,[],{silent:true,windowsHide:true,serialization:'advanced',execArgv:['--max-old-space-size=384']});
  let outcome=null,failure=null,settled=false;
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){error.diagnostic={kind:timedOut?'timeout':'process-failure',elapsedMs:Math.round(performance.now()-started),exitCode:child.exitCode,signal:child.signalCode,node:process.version,platform:process.platform,arch:process.arch};reject(error);}else resolve(result);};
  child.stdout.resume();child.stderr.resume();
  let timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;failure=new Error(`Run exceeded ${timeoutMs} ms and was stopped. No result was marked as passed.`);child.kill();},timeoutMs);
  child.on('message',message=>{if(message?.ok===true&&message.run)outcome=message.run;else if(message?.ok===false)failure=new Error('Input validation or database process initialization failed. No result was saved.');});
  child.on('error',()=>{failure??=new Error('The isolated database process could not start or communicate. No result was saved.');child.kill();if(!child.pid)finish(failure);});
  child.once('exit',(code,signal)=>{if(failure)return finish(failure);if(code!==0||signal||!outcome)return finish(new Error('The isolated database process stopped before completing. No result was marked as passed.'));finish(null,outcome);});
  child.send(project,error=>{if(error){failure??=new Error('The assessment could not be sent to its isolated process. No result was saved.');child.kill();}});
 });
}

export async function runAssessment(project,options={}){
 const started=performance.now(),budget=options.timeoutMs??45000;
 const first=await runOnce(project,options);
 if(first.setupError?.phase!=='initialization')return first;
 const remaining=budget-Math.ceil(performance.now()-started);
 if(remaining<=0)return first;
 let result,retryFailure;
 try{result=await runOnce(project,{...options,timeoutMs:remaining});}
 catch(error){result=first;retryFailure={message:error.message,diagnostic:error.diagnostic};}
 const {integrity,...content}=result;
 content.startupRecovery={recovered:!retryFailure&&result.setupError?.phase!=='initialization',failedAttempts:[first],...(retryFailure?{retryFailure}:{}),meaning:'One fresh-process retry after initialization failed before project SQL execution. Original failed evidence is retained.'};
 return {...content,integrity:{...integrity,digest:hash(content)}};
}


