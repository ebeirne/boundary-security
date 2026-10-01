import {validatePrivacyContext} from './privacy-context.mjs';
const legacyChecks=['distinct-authenticated-users','file-owner','file-other-customer','retrieval-owner','retrieval-other-customer','public-file','anonymous-file'];
const currentChecks=[...legacyChecks,'anonymous-retrieval'];
const statuses=['passed','failed','incomplete'];
function read(report){
 const checks=report?.adapter==='supabase-document-privacy-v5'?currentChecks:legacyChecks;
 if(report?.version!==1||!['supabase-document-privacy-v3','supabase-document-privacy-v4','supabase-document-privacy-v5'].includes(report.adapter)||! /^[a-f0-9]{64}$/.test(report.requirementsHash??'')||!Array.isArray(report.results)||report.results.length!==checks.length)return null;
 const rows=new Map();
 for(const row of report.results){
  if(!checks.includes(row?.id)||!statuses.includes(row.status)||rows.has(row.id))return null;
  rows.set(row.id,row.status);
 }
 return rows;
}
// Local evidence comparison only. Imported reports are not signed or authenticated.
export function comparePrivacyReports(before,after){
 const a=read(before),b=read(after);
 const checks=before?.adapter==='supabase-document-privacy-v5'?currentChecks:legacyChecks;
 const base={version:1,scope:`Comparison of supplied reports for ${checks.length} exact checks. Does not authenticate reports, verify deployment versions, or certify the application.`};
 if(!a||!b)return {...base,comparable:false,verdict:'incomparable',reason:'A report is unsupported, malformed, or missing a required check.',changes:[]};
 if(before.adapter!==after.adapter)return {...base,comparable:false,verdict:'incomparable',reason:'The check implementation changed. Rerun both observations with the current adapter before claiming a repair.',changes:[]};
 base.classification={adapter:before.adapter,legacy:before.adapter!=='supabase-document-privacy-v5'};
 let beforeContext,afterContext;
 try{beforeContext=validatePrivacyContext(before.evidenceContext);afterContext=validatePrivacyContext(after.evidenceContext)}
 catch{return {...base,comparable:false,verdict:'incomparable',reason:'Application/fixture context is malformed. No linked comparison is established.',changes:[]}}
 if(Boolean(beforeContext)!==Boolean(afterContext))return {...base,comparable:false,verdict:'incomparable',reason:'Only one report declares application/fixture context. Rerun both with the same fixture context, or compare two legacy unlinked reports.',changes:[]};
 if(beforeContext&&beforeContext.fixtureHash!==afterContext.fixtureHash)return {...base,comparable:false,verdict:'incomparable',reason:'The declared synthetic fixture changed. These reports cannot establish a same-fixture repair.',changes:[]};
 base.evidenceContext=beforeContext?{provenance:'operator-declared',beforeApplicationRevision:beforeContext.applicationRevision,afterApplicationRevision:afterContext.applicationRevision,fixtureHash:beforeContext.fixtureHash,deploymentVerified:false}:{provenance:'unlinked',deploymentVerified:false};
 if(before.requirementsHash!==after.requirementsHash)return {...base,comparable:false,verdict:'incomparable',reason:'Requirements changed. These reports cannot establish a repair.',changes:[]};
 const changes=checks.map(id=>({id,before:a.get(id),after:b.get(id)}));
 const failures=changes.filter(r=>r.after==='failed').length;
 const incomplete=changes.some(r=>r.after==='incomplete');
 const regression=changes.some(r=>r.before==='passed'&&r.after!=='passed');
 const wasComplete=changes.every(r=>r.before!=='incomplete');
 const wasFailed=changes.some(r=>r.before==='failed');
 const verdict=regression?'regression':failures?'still-failing':incomplete?'incomplete':!wasComplete?'baseline-incomplete':wasFailed?'repair-verified':'checks-still-pass';
 const reasons={regression:'A previously passing check no longer passes.', 'still-failing':'At least one access check still fails.',incomplete:'At least one current check is incomplete. Protection is not verified.','baseline-incomplete':'Current checks pass, but the baseline was incomplete. A repair is not established.','repair-verified':`The same ${checks.length} checks now pass, including legitimate access. This verifies the observed repair only.`,'checks-still-pass':'The same checks still pass. No failing baseline was supplied.'};
 return {...base,comparable:true,verdict,reason:reasons[verdict]+(base.classification.legacy?` These are legacy ${before.adapter.endsWith('v3')?'v3':'v4'} observations without anonymous retrieval coverage.${before.adapter.endsWith('v3')?' Denial responses containing private content were not reliably detected.':''} Rerun with the current adapter.`:''),changes};
}
