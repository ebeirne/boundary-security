import {PGlite} from '@electric-sql/pglite';
import {createAssessment,canonical} from '../server/assessment-core.mjs';
import pkg from '../package.json';
import dbPkg from '../node_modules/@electric-sql/pglite/package.json';
import wasmUrl from '../node_modules/@electric-sql/pglite/dist/pglite.wasm?url';
import dataUrl from '../node_modules/@electric-sql/pglite/dist/pglite.data?url';
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(typeof value==='string'?value:canonical(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');
self.onmessage=async({data})=>{try{const [bytes,bundle]=await Promise.all([fetch(wasmUrl).then(r=>{if(!r.ok)throw Error();return r.arrayBuffer()}),fetch(dataUrl).then(r=>{if(!r.ok)throw Error();return r.blob()})]);const wasmModule=await WebAssembly.compile(bytes);const {assess}=createAssessment({hash,randomUUID:()=>crypto.randomUUID(),toolVersion:pkg.version,databasePackageVersion:dbPkg.version,defaultDatabase:()=>PGlite.create({wasmModule,fsBundle:bundle}),runtime:()=>({platform:'browser-worker'})});const result=await assess(data.project);self.postMessage({result});}catch{self.postMessage({error:'The supplied project could not run. Check its format and retry. No result is verified.'})}};
