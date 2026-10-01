import {comparePrivacyReports} from './privacy-comparison.mjs';

// Only validated enumerations and strict hash fields are rendered. Never copy imported prose.
export function renderPrivacyHandoff(before, after) {
  const comparison = comparePrivacyReports(before, after);
  const labels = {
    'distinct-authenticated-users': 'Two distinct test sessions verified',
    'file-owner': 'Owner can read the test file',
    'file-other-customer': 'Other customer cannot read the test file',
    'retrieval-owner': 'Owner can retrieve the document',
    'retrieval-other-customer': 'Other customer cannot retrieve the document',
    'public-file': 'Anonymous public file request is blocked',
    'anonymous-file': 'Anonymous authenticated file request is blocked',
    'anonymous-retrieval': 'Anonymous document retrieval is blocked',
  };
  const lines = ['# Customer-data isolation check', '',
    'Experimental Boundary report. Supplied reports are not authenticated. This is not a security certification or a full application audit.', '',
    `Result: ${comparison.verdict}`, '', comparison.reason, '',
    comparison.classification?.adapter==='supabase-document-privacy-v5'?'Scope: one configured synthetic file and document retrieval route, two test users, two exact anonymous file URLs, and anonymous retrieval. Requests are sequential observations.':'Scope: legacy file/document checks without anonymous retrieval coverage. Requests are sequential observations.', ''];
  if(comparison.evidenceContext?.provenance==='operator-declared')lines.push('## Declared revision receipt', '',
    `Before application revision: ${comparison.evidenceContext.beforeApplicationRevision}`,
    `After application revision: ${comparison.evidenceContext.afterApplicationRevision}`,
    `Synthetic fixture SHA-256: ${comparison.evidenceContext.fixtureHash}`, '',
    'These hashes were supplied by the operator. Boundary did not verify that the running deployment or fixture contents match them. Preserve the approved fixture artifact and independently confirm the deployed revision.', '');
  else lines.push('Revision receipt: unlinked or invalid. No matched application/fixture context is established. To include it on new CLI runs, supply --app-revision with a full lowercase commit hash and --fixture-hash with the SHA-256 of the approved synthetic fixture artifact, together on both runs. Existing reports are not retroactively linked.', '');
  if (comparison.comparable) lines.push('| Check | Before | After |', '| --- | --- | --- |',
    ...comparison.changes.map(r => `| ${labels[r.id]} | ${r.before} | ${r.after} |`), '');
  lines.push('## What this does not establish', '',
    'No coverage claim for other resources, write/delete operations in this HTTP pilot, signed links, cached answers, semantic search, chatbot output, membership revocation, or deployment version. An incomplete check is not evidence of protection.', '',
    '## Next action', '', comparison.verdict === 'repair-verified'
      ? 'Retain the unchanged test configuration and rerun after relevant permission changes. Reviewers must confirm which deployment and approved scope these reports belong to.'
      : 'Review failures and incomplete checks with the app maintainer. Confirm the intended access rules, preserve legitimate owner access, review any proposed policy change, then rerun unchanged checks.', '',
    '## Coding-agent handoff', '',
    'Use the approved local configuration and these results to investigate the exact failing check. Do not change the expected permissions to obtain a pass. Request the relevant reviewed schema/policies without credentials or customer data. Propose a minimal policy patch for human review; do not apply it automatically. Preserve owner access and rerun the same checks. Report unresolved or unsupported behavior explicitly.', '');
  return {comparison, markdown: lines.join('\n')};
}
