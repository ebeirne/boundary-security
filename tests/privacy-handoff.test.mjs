import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPrivacyHandoff} from '../server/privacy-handoff.mjs';
const ids=['distinct-authenticated-users','file-owner','file-other-customer','retrieval-owner','retrieval-other-customer','public-file','anonymous-file'];
const make=()=>({version:1,adapter:'supabase-document-privacy-v3',requirementsHash:'a'.repeat(64),results:ids.map(id=>({id,status:'passed'}))});
test('handoff does not leak untrusted report fields or accept fake passing summaries',()=>{
 const before=make(),after=make();after.results[2].status='failed';after.results[2].reason='PRIVATE_SECRET';after.scope='PRIVATE_SECRET';after.verdict='checks-passed';
 const result=renderPrivacyHandoff(before,after);
 assert.equal(result.comparison.verdict,'regression');assert(!result.markdown.includes('PRIVATE_SECRET'));assert.match(result.markdown,/not a security certification/);
});
test('changed inputs and incomplete baselines cannot claim a repair',()=>{
 const before=make(),after=make();after.requirementsHash='b'.repeat(64);
 assert.equal(renderPrivacyHandoff(before,after).comparison.verdict,'incomparable');
 after.requirementsHash=before.requirementsHash;before.results[1].status='incomplete';
 assert.equal(renderPrivacyHandoff(before,after).comparison.verdict,'baseline-incomplete');
 before.results[1].status='passed';before.results[2].status='failed';
 assert.equal(renderPrivacyHandoff(before,after).comparison.verdict,'repair-verified');
});

test('handoff preserves declared hash receipt while making deployment verification limits explicit',()=>{
 const context={version:1,provenance:'operator-declared',applicationRevision:'a'.repeat(40),fixtureHash:'b'.repeat(64)};
 const before={...make(),evidenceContext:context};
 const after={...make(),evidenceContext:{...context,applicationRevision:'c'.repeat(64)}};
 const linked=renderPrivacyHandoff(before,after);
 assert.match(linked.markdown,/Before application revision: a{40}/);
 assert.match(linked.markdown,/After application revision: c{64}/);
 assert.match(linked.markdown,/Boundary did not verify/);
 const unlinked=renderPrivacyHandoff(make(),make());
 assert.equal(unlinked.comparison.verdict,'checks-still-pass');
 assert.match(unlinked.markdown,/Existing reports are not retroactively linked/);
 after.evidenceContext.applicationRevision='[PRIVATE_SECRET](https://example.com)';
 const invalid=renderPrivacyHandoff(before,after);
 assert.equal(invalid.comparison.verdict,'incomparable');
 assert(!invalid.markdown.includes('PRIVATE_SECRET'));
});
