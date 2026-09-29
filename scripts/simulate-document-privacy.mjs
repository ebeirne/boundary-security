import {mkdir,writeFile} from 'node:fs/promises';
import {checkDocumentPrivacy,localPrivacyAdapter} from '../server/privacy-check.mjs';
import {startPrivacyFixture,fixtureTokens,syntheticMarker} from './privacy-fixture.mjs';
const reports=[];
for(const scenario of ['secure','file-leak','retrieval-leak','both-leak','missing-fixture','expired-session','outage']){
 const fixture=await startPrivacyFixture(scenario);
 try{reports.push({scenario,...await checkDocumentPrivacy({request:localPrivacyAdapter({origin:fixture.origin,tokens:fixtureTokens}),owner:'alice',outsider:'bob',marker:syntheticMarker})})}finally{await fixture.close()}
}
const directory=new URL('../evidence/document-privacy/',import.meta.url);await mkdir(directory,{recursive:true});
await writeFile(new URL('local-http-results.json',directory),JSON.stringify({createdAt:new Date().toISOString(),environment:'Self-authored loopback HTTP fixture, not Supabase Storage or an AI model.',reports},null,2));
console.log(JSON.stringify(reports.map(({scenario,summary,verdict})=>({scenario,...summary,verdict})),null,2));
