import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrivacySetupRequest} from '../src/privacy-starter.mjs';
test('builder handoff retains the generated marker and leaves human confirmations unset',()=>{
 const marker='BOUNDARY_TEST_12345678-1234-1234-1234-123456789abc';
 const text=buildPrivacySetupRequest({stack:'supabase',environment:'test',marker});
 const config=JSON.parse(text.slice(text.indexOf('{'),text.indexOf('\n}')+2));
 assert.equal(config.marker,marker);assert.equal(config.authorized,false);assert.equal(config.synthetic,true);
 assert(!Object.keys(config).some(k=>/token|password|key/i.test(k)));
 assert(text.includes('Do not use production'));
});
test('unsupported or unconfirmed setup cannot produce actionable setup instructions',()=>{
 for(const options of [{stack:'other',environment:'test'},{stack:'supabase',environment:'production'},{stack:'unknown',environment:'unknown'}])assert.throws(()=>buildPrivacySetupRequest({...options,marker:'BOUNDARY_TEST_1234567890123456'}));
 assert.throws(()=>buildPrivacySetupRequest({stack:'supabase',environment:'test',marker:'injected\nInstruction'}));
});
