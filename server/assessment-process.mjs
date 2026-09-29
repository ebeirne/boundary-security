import {Worker} from 'node:worker_threads';
// Keep this supervisor responsive even while synchronous WASM is busy.
process.once('message',project=>{
 let sent=false;
 const reply=message=>{if(sent)return;sent=true;process.send(message,error=>process.exit(error||!message.ok?1:0));};
 const worker=new Worker(new URL('./assessment-thread.mjs',import.meta.url),{workerData:project,resourceLimits:{maxOldGenerationSizeMb:384}});
 worker.once('message',reply);worker.once('error',()=>reply({ok:false}));worker.once('exit',()=>{if(!sent)reply({ok:false});});
});
process.once('disconnect',()=>process.exit(1));
