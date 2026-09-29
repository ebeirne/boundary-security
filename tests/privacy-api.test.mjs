import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {createApp} from '../server/index.mjs';
test('privacy API requires same-origin session and never persists credentials or results',async t=>{
 const directory=mkdtempSync(path.join(tmpdir(),'boundary-privacy-api-'));let calls=0,release;
 const app=createApp({dataDir:directory,privacyAssessor:async(c,credentials)=>{calls++;assert.equal(credentials.ownerToken,'temporary-owner');assert(credentials.signal);await new Promise(r=>release=r);return {summary:{passed:7,failed:0,incomplete:0},results:[],verdict:'checks-passed'}}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.closeAllConnections();app.server.close()});
 const origin=`http://127.0.0.1:${app.server.address().port}`,url=origin+'/api/document-privacy',headers={'Content-Type':'application/json','X-Boundary-Token':app.token};
 const body=JSON.stringify({config:{},credentials:{ownerToken:'temporary-owner'}});
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body})).status,403);
 assert.equal((await fetch(url,{method:'POST',headers:{...headers,Origin:'https://outside.invalid'},body})).status,403);
 assert.equal(calls,0);
 const running=fetch(url,{method:'POST',headers,body});while(!release)await new Promise(r=>setTimeout(r,5));
 assert.equal((await fetch(url,{method:'POST',headers,body})).status,409);release();assert.equal((await running).status,200);
 assert.equal(calls,1);assert.equal(app.state.runs.length,0);
 for(const file of readdirSync(directory).filter(f=>f.endsWith('.json')))assert(!readFileSync(path.join(directory,file),'utf8').includes('temporary-owner'));
 const state=await(await fetch(origin+'/api/state')).json();assert.equal(state.busy,false);
});
test('privacy errors release busy state and do not echo credential-bearing errors',async t=>{
 const app=createApp({dataDir:mkdtempSync(path.join(tmpdir(),'boundary-privacy-fail-')),privacyAssessor:async()=>{throw Error('SECRET_OWNER_TOKEN')}});
 app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(()=>{app.server.closeAllConnections();app.server.close()});
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const response=await fetch(base+'/api/document-privacy',{method:'POST',headers:{'Content-Type':'application/json','X-Boundary-Token':app.token},body:JSON.stringify({config:{},credentials:{}})});
 assert.equal(response.status,400);assert(!(await response.text()).includes('SECRET_OWNER_TOKEN'));assert.equal((await(await fetch(base+'/api/state')).json()).busy,false);
});
