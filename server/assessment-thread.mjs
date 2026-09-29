import {parentPort,workerData} from 'node:worker_threads';
import {assess} from './engine.mjs';
try{parentPort.postMessage({ok:true,run:await assess(workerData)});}
catch{parentPort.postMessage({ok:false});}
