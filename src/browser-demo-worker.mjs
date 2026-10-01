import {PGlite} from '@electric-sql/pglite';
import wasmUrl from '../node_modules/@electric-sql/pglite/dist/pglite.wasm?url';
import dataUrl from '../node_modules/@electric-sql/pglite/dist/pglite.data?url';
import {runBrowserDemo} from './browser-demo-engine.mjs';
self.onmessage=async({data})=>{try{const [bytes,bundle]=await Promise.all([fetch(wasmUrl).then(r=>{if(!r.ok)throw Error('Database asset unavailable');return r.arrayBuffer()}),fetch(dataUrl).then(r=>{if(!r.ok)throw Error('Database asset unavailable');return r.blob()})]);const module=await WebAssembly.compile(bytes);const result=await runBrowserDemo(()=>PGlite.create({wasmModule:module,fsBundle:bundle}),data.repaired===true);self.postMessage({result});}catch(e){self.postMessage({error:'The browser database could not complete the demo. No result is verified. Please retry or use the walkthrough.'})}};
