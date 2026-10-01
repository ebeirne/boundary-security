const checks = [
 {id:'distinct-authenticated-users',group:'identity',name:'Two different test customers',intent:'Both sessions must match the declared users.'},
 {id:'file-owner',group:'allow',name:'Owner opens the file',intent:'Should be allowed.'},
 {id:'retrieval-owner',group:'allow',name:'Owner reads the document',intent:'Should be allowed.'},
 {id:'file-other-customer',group:'deny',name:'Other customer opens the file',intent:'Should be blocked.'},
 {id:'retrieval-other-customer',group:'deny',name:'Other customer reads the document',intent:'Should be blocked.'},
 {id:'public-file',group:'deny',name:'Visitor uses the public file address',intent:'Should be blocked.'},
 {id:'anonymous-file',group:'deny',name:'Visitor uses the signed-in file address',intent:'Should be blocked.'},
 {id:'anonymous-retrieval',group:'deny',name:'Visitor reads the document',intent:'Should be blocked.'},
];

function nextAction(id,status,identityReady,ownerReady){
 if(status==='passed')return null;
 if(!identityReady||id==='distinct-authenticated-users')return 'Sign in as each test customer again. Check that the two user IDs and their fresh access tokens match, then rerun.';
 if(id==='file-owner')return 'Ask your builder to confirm the exact bucket, file path and invented marker. The owner must be able to open that file before a blocked result can count.';
 if(id==='retrieval-owner')return 'Ask your builder to confirm the document ID and marker. For a retrieval function, check that it returns an array of rows with text content.';
 if(!ownerReady)return 'Resolve the owner-access check for this document or file first, then rerun. A missing file is not evidence of protection.';
 if(status==='failed'){
  if(id==='anonymous-retrieval')return 'Ask your builder to review anonymous access to the document table or retrieval function. Keep the owner’s document accessible, then rerun.';
  if(id==='public-file'||id==='anonymous-file')return 'Ask your builder to review the test bucket’s public setting and anonymous access rules. Keep owner access working, then rerun all checks.';
  if(id==='retrieval-other-customer')return 'Ask your builder to review the document access rules or retrieval function for the other customer. Keep the owner’s document accessible, then rerun.';
  return 'Ask your builder to review the storage access rules for the other customer. Keep the owner’s file accessible, then rerun.';
 }
 return 'Check the test project is reachable and the expected file or document response still works. Refresh both test sessions and rerun; an unexpected response does not count as blocked access.';
}

// Presentation only: never infer current protection from an older or partial report.
export function privacyResultView(report,{dirty=false,attempt='idle'}={}){
 const source=Array.isArray(report?.results)?report.results:[];
 const rowFor=id=>{const matches=source.filter(r=>r?.id===id);return matches.length===1?matches[0]:null};
 const identityReady=rowFor('distinct-authenticated-users')?.status==='passed';
 const rows=checks.map(check=>{
  const raw=rowFor(check.id);
  const status=['passed','failed','incomplete'].includes(raw?.status)?raw.status:'incomplete';
  const ownerId=check.id.startsWith('retrieval')||check.id==='anonymous-retrieval'?'retrieval-owner':'file-owner';
  return {...check,status,label:status==='passed'?'As expected':status==='failed'?'Access problem found':'Not verified',reason:typeof raw?.reason==='string'?raw.reason:'This check did not return a result.',action:nextAction(check.id,status,identityReady,rowFor(ownerId)?.status==='passed')};
 });
 const counts=Object.fromEntries(['passed','failed','incomplete'].map(status=>[status,rows.filter(r=>r.status===status).length]));
 const unexpected=source.some(r=>!checks.some(c=>c.id===r?.id));
 let outcome=counts.failed?'failed':counts.incomplete||unexpected?'incomplete':'passed';
 const messages={
  failed:['Access was found where it should be blocked.','Review the access problem below with your builder. Preserve owner access while making a repair, then rerun the same checks.'],
  incomplete:['The check could not establish the expected access.','Resolve the first unverified check below, then rerun. An incomplete check is not evidence that access is blocked.'],
  passed:['The selected access checks behaved as expected.','Download this report. After changing your access rules, rerun the same test file and document to compare observations.'],
  stale:['Inputs changed. Run the check again.','The earlier report below does not describe these inputs. Enter fresh test sessions and rerun before using it as current evidence.'],
  failedAttempt:['The latest attempt did not produce a new report.','Resolve the run error and enter fresh test sessions, then rerun. Any earlier report below describes only its earlier run.'],
  running:['A new check is running.','Wait for this attempt to finish. Any earlier report below is historical and does not describe this attempt.'],
 };
 if(dirty)outcome='stale';
 if(attempt==='failed')outcome='failedAttempt';
 if(attempt==='running')outcome='running';
 const [headline,defaultNext]=messages[outcome];
 const next=outcome==='incomplete'&&unexpected?'This report contains unsupported checks. Update the local workbench and rerun before using this report as evidence.':defaultNext;
 const historical=['stale','failedAttempt','running'].includes(outcome);
 return {outcome,headline,next,historical,counts,groups:[
  {id:'identity',title:'Test identities',rows:rows.filter(r=>r.group==='identity')},
  {id:'allow',title:'Owner access — should be allowed',rows:rows.filter(r=>r.group==='allow')},
  {id:'deny',title:'Other access — should be blocked',rows:rows.filter(r=>r.group==='deny')},
 ]};
}
