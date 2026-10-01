// Ephemeral UI review identity only, not a server authorization or evidence signature.
export function privacyIntentKey(c){
 return JSON.stringify([c.origin,c.ownerId,c.otherId,c.bucket,c.object,c.table,c.recordId,c.marker,c.retrieval?.mode,c.retrieval?.functionName??'']);
}
export function hasReviewedPrivacyIntent(config,reviewedKey){
 return typeof reviewedKey==='string'&&reviewedKey===privacyIntentKey(config);
}
